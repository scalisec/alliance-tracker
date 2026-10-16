// Parsers for alliancehockey.com (MBLeagueWeb platform).
// Only path-style URLs are used, per the site's robots.txt.
//
// NOTE: these parsers were written from the rendered page content. They are
// verified against real HTML with `npm run capture` + `npm run test:parsers`
// before the scheduled job is switched on (see README "First run").
import * as cheerio from 'cheerio';

export const BASE = 'https://alliancehockey.com';
export const urls = {
  standings: (g) => `${BASE}/Groups/${g}/Standings/`,
  schedule: (g) => `${BASE}/Groups/${g}/Schedule/`,
  calendar: (g) => `${BASE}/Groups/${g}/Calendar/`,
  game: (g, id) => `${BASE}/Groups/${g}/Games/${id}/`,
  logo: `${BASE}/domains/alliancehockey.com/logo.png`,
};

const clean = (s) => (s ?? '').replace(/\s+/g, ' ').trim();
const num = (s) => {
  const n = parseFloat(String(s).replace(/[^\d.+-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

// ---------- Standings ----------
// Finds every table whose header contains GP and Pts and maps columns by
// header text, so column order changes don't break it.
const COLS = {
  team: ['team'], gp: ['gp'], w: ['w'], l: ['l'], t: ['t'], pts: ['pts'],
  gf: ['gf'], ga: ['ga'], diff: ['diff', 'gd', '+/-'], l10: ['l10'], strk: ['strk', 'stk', 'streak'],
};

export function parseStandings(html) {
  const $ = cheerio.load(html);
  // Page layout: .heading-1-wrapper = round ("Under 10 AAA Regular Season",
  // "... Playdowns", "... Playoffs"); .heading-4-wrapper or .M.spaced = group
  // ("East Division" + a date range); then table.standings.
  const rounds = [];
  let round = null, groupName = '';
  $('.heading-1-wrapper, .heading-4-wrapper, .M.spaced, table').each((_, el) => {
    const $el = $(el);
    if ($el.is('table')) {
      const rows = parseStandingsTable($, el);
      if (!rows) return;
      if (!round) { round = { name: 'Regular Season', groups: [] }; rounds.push(round); }
      round.groups.push({ name: groupName, rows });
      groupName = '';
      return;
    }
    const text = clean($el.text());
    if ($el.hasClass('heading-1-wrapper')) {
      // "Under 13 BB Regular Season" -> "Regular Season"
      round = { name: text.replace(/^Under \d+\s+\S+\s*/i, '') || text, groups: [] };
      rounds.push(round);
    } else {
      // "East DivisionOct 02, 2026-Feb 14, 2027" -> "East Division"
      groupName = text.replace(/\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w* \d{1,2}, \d{4}.*$/, '').trim();
    }
  });
  const withGroups = rounds.filter((r) => r.groups.length);
  // A lone group's name (e.g. "BB-B") adds nothing; drop it.
  for (const r of withGroups) if (r.groups.length === 1) r.groups[0].name = '';
  const isRegular = (r) => /regular/i.test(r.name);
  const regular = withGroups.filter(isRegular).flatMap((r) => r.groups);
  const playoffs = withGroups.filter((r) => !isRegular(r)).flatMap((r) =>
    r.groups.map((g) => ({ ...g, name: [r.name, g.name].filter(Boolean).join(' · ') })));
  // Pages without round headings: everything counts as regular season.
  return { regular: regular.length || playoffs.length ? regular : [], playoffs };
}

function parseStandingsTable($, table) {
  const headers = $(table).find('tr').first().find('th,td')
    .map((__, c) => clean($(c).text()).toLowerCase()).get();
  if (!headers.includes('gp') || !headers.includes('pts')) return null;
  const idx = {};
  for (const [key, names] of Object.entries(COLS)) {
    const i = headers.findIndex((h) => names.includes(h));
    if (i >= 0) idx[key] = i;
  }
  if (idx.team == null) idx.team = 0;
  const rows = [];
  $(table).find('tr').slice(1).each((__, tr) => {
    // The team cell is a <th>; the stat cells are <td>.
    const cells = $(tr).children('th,td');
    if (cells.length < 5) return;
    const teamCell = cells.eq(idx.team);
    const link = teamCell.find('a').attr('href') ?? '';
    const oneDbId = link.match(/Teams\/(\d+)/i)?.[1] ?? null;
    const bg = teamCell.find('[style*="background-image"]').attr('style') ?? '';
    const logoUrl = bg.match(/url\(['"]?([^'")]+)['"]?\)/)?.[1] ?? null;
    const get = (k) => (idx[k] != null ? clean(cells.eq(idx[k]).text()) : '');
    rows.push({
      team: clean(teamCell.text()),
      teamId: oneDbId ? `odb-${oneDbId}` : null,
      logo: logoUrl ? (logoUrl.startsWith('//') ? `https:${logoUrl}` : logoUrl) : null,
      gp: num(get('gp')), w: num(get('w')), l: num(get('l')), t: num(get('t')),
      pts: num(get('pts')), gf: num(get('gf')), ga: num(get('ga')),
      diff: idx.diff != null ? num(get('diff')) : num(get('gf')) - num(get('ga')),
      l10: get('l10') || null, strk: get('strk') || null,
    });
  });
  return rows.length ? rows : null;
}

// ---------- Schedule ----------
// MBLeagueWeb pages (alliancehockey.com and theonedb.com share the platform)
// list each game as `.event-list-item`:
//   .day_of_month "Fri 02" (first game of a day) + .time-primary "6:30 PM"
//   .subject-owner = away team, .subject-text = "@ Home" + .game_no code
//   .location = rink, .game_score "2-4", .tag "Regular Season", a.livebarn-watch
// The month comes from the nearest preceding month heading ("October 2026").
const TIME_RE = /\b(\d{1,2}:\d{2}\s?[AP]M)\b/i;
const SCORE_RE = /^(\d{1,2})\s*-\s*(\d{1,2})$/;
const MONTH_RE = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{4})\b/i;
const DATE_RE = /\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\w*,?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?/i;

export function parseSchedule(html, groupId, { seasonStartYear = 2026, anyGroup = false } = {}) {
  const $ = cheerio.load(html);
  const games = new Map();
  let month = null, year = null, day = null;

  // Walk the document in order so month headings and day labels carry forward.
  $('.heading-1-wrapper, .event-list-item, .day-heading, h2, h3').each((_, el) => {
    const $el = $(el);
    if (!$el.hasClass('event-list-item')) {
      const t = clean($el.text());
      const full = t.match(DATE_RE);
      if (full) { month = full[2]; day = Number(full[3]); if (full[4]) year = Number(full[4]); return; }
      const m = t.match(MONTH_RE);
      if (m) { month = m[1]; year = Number(m[2]); }
      return;
    }
    const link = $el.find('a[href*="/Games/"]').attr('href') ?? '';
    const m = link.match(/\/Groups\/(\d+)\/Games\/(\d+)/) ?? link.match(/\/Games\/(\d+)/);
    if (!m) return;
    const id = Number(m[2] ?? m[1]);
    if (m[2] && !anyGroup && Number(m[1]) !== Number(groupId)) return;

    const dom = clean($el.find('.day_of_month').first().text()); // "Fri 02"
    const dm = dom.match(/(\d{1,2})\s*$/);
    if (dm) day = Number(dm[1]);
    const full = clean($el.find('.date, .full-date').first().text()).match(DATE_RE);
    if (full) { month = full[2]; day = Number(full[3]); if (full[4]) year = Number(full[4]); }

    const timeText = clean($el.find('.time-primary').first().clone().children('.day_of_month').remove().end().text());
    const time = timeText.match(TIME_RE)?.[1] ?? null;
    const away = clean($el.find('.subject-owner').first().text()) || null;
    const homeEl = $el.find('.subject-text').first().clone();
    homeEl.find('.game_no').remove();
    const home = clean(homeEl.text()).replace(/^@\s*/, '').replace(/^vs\.?\s*/i, '') || null;
    const code = clean($el.find('.game_no').first().text()) || null;
    const venue = clean($el.find('.location').first().text()) || null;
    const scoreText = clean($el.find('.game_score').first().text());
    const [, as, hs] = scoreText.match(SCORE_RE) ?? [];
    const tags = $el.find('.tag').map((__, t) => clean($(t).text())).get();
    const type = tags.some((t) => /playoff/i.test(t)) ? 'playoff' : tags.some((t) => /exhibition/i.test(t)) ? 'exhibition' : 'regular';
    const cancelled = tags.some((t) => /cancel|postpon/i.test(t)) || /cancel|postpon/i.test(clean($el.find('.game_result').text()));

    const dateText = month && day ? `Sat, ${month} ${day}${year ? `, ${year}` : ''}` : null;
    games.set(id, {
      id, divisionId: Number(groupId),
      start: toIso(dateText, time, seasonStartYear),
      away, home,
      awayScore: as != null ? Number(as) : null,
      homeScore: hs != null ? Number(hs) : null,
      status: cancelled ? 'cancelled' : as != null ? 'final' : 'scheduled',
      venue, code,
      liveBarn: $el.find('a.livebarn-watch, a[href*="livebarn.com"]').first().attr('href') ?? null,
      type,
      gamesheet: null,
    });
  });
  return [...games.values()];
}

// ---------- Game page ----------
export function parseGamePage(html) {
  const $ = cheerio.load(html);
  const gs = $('a[href*="gamesheetstats.com/seasons/"], iframe[src*="gamesheetstats.com/seasons/"]').first();
  const href = gs.attr('href') ?? gs.attr('src') ?? '';
  const m = href.match(/seasons\/(\d+)\/games\/(\d+)/);
  return {
    gamesheet: m ? { season: Number(m[1]), game: Number(m[2]) } : null,
    liveBarn: $('a[href*="livebarn.com"]').first().attr('href') ?? null,
  };
}

// ---------- helpers ----------
const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
export function toIso(dateText, time, seasonStartYear) {
  if (!dateText) return null;
  const m = dateText.match(DATE_RE);
  if (!m) return null;
  const month = MONTHS[m[2].slice(0, 3).toLowerCase()];
  const day = Number(m[3]);
  const year = m[4] ? Number(m[4]) : month >= 7 ? seasonStartYear : seasonStartYear + 1;
  let h = 12, min = 0;
  if (time) {
    const t = time.match(/(\d{1,2}):(\d{2})\s?([AP]M)/i);
    h = (Number(t[1]) % 12) + (/p/i.test(t[3]) ? 12 : 0);
    min = Number(t[2]);
  }
  // Store as local Toronto wall-clock time with explicit offset.
  const offset = torontoOffset(year, month, day);
  const p = (n) => String(n).padStart(2, '0');
  return `${year}-${p(month + 1)}-${p(day)}T${p(h)}:${p(min)}:00${offset}`;
}

// Eastern time: DST from 2nd Sunday of March to 1st Sunday of November.
function torontoOffset(y, m, d) {
  const nthSunday = (month, n) => {
    const first = new Date(Date.UTC(y, month, 1)).getUTCDay();
    return 1 + ((7 - first) % 7) + (n - 1) * 7;
  };
  const start = nthSunday(2, 2), end = nthSunday(10, 1);
  const dst = (m > 2 && m < 10) || (m === 2 && d >= start) || (m === 10 && d < end);
  return dst ? '-04:00' : '-05:00';
}
