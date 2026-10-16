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
  const groups = [];
  $('table').each((_, table) => {
    const headers = $(table).find('tr').first().find('th,td')
      .map((__, c) => clean($(c).text()).toLowerCase()).get();
    if (!headers.includes('gp') || !headers.includes('pts')) return;
    const idx = {};
    for (const [key, names] of Object.entries(COLS)) {
      const i = headers.findIndex((h) => names.includes(h));
      if (i >= 0) idx[key] = i;
    }
    if (idx.team == null) idx.team = headers.findIndex((h) => h === '' || h.includes('team'));

    const rows = [];
    $(table).find('tr').slice(1).each((__, tr) => {
      const cells = $(tr).find('td');
      if (cells.length < 5) return;
      const teamCell = cells.eq(idx.team ?? 0);
      const link = teamCell.find('a').attr('href') ?? '';
      const oneDbId = link.match(/Teams\/(\d+)/i)?.[1] ?? null;
      const get = (k) => (idx[k] != null ? clean(cells.eq(idx[k]).text()) : '');
      rows.push({
        team: clean(teamCell.text()),
        teamId: oneDbId ? `odb-${oneDbId}` : null,
        gp: num(get('gp')), w: num(get('w')), l: num(get('l')), t: num(get('t')),
        pts: num(get('pts')), gf: num(get('gf')), ga: num(get('ga')),
        diff: idx.diff != null ? num(get('diff')) : num(get('gf')) - num(get('ga')),
        l10: get('l10') || null, strk: get('strk') || null,
      });
    });
    if (!rows.length) return;
    // A heading just before the table (e.g. "East", "West") names the group.
    const heading = clean($(table).prevAll('h1,h2,h3,h4,h5,.title,caption').first().text());
    groups.push({ name: heading && heading.length < 40 ? heading : '', rows });
  });
  return groups.map((g, i) => ({ ...g, rank: undefined, order: i }));
}

// ---------- Schedule ----------
// Each game on a schedule page carries a "Game Details" link
// (/Groups/{g}/Games/{id}/). We walk up from that link to the smallest
// container holding one game, then read its text tokens.
const TIME_RE = /\b(\d{1,2}:\d{2}\s?[AP]M)\b/i;
const SCORE_RE = /^(\d{1,2})\s*-\s*(\d{1,2})$/;
const DATE_RE = /\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\w*,?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?/i;

export function parseSchedule(html, groupId, { seasonStartYear = 2026 } = {}) {
  const $ = cheerio.load(html);
  const games = new Map();
  $(`a[href*="/Games/"]`).each((_, a) => {
    const href = $(a).attr('href') ?? '';
    const m = href.match(/\/Groups\/(\d+)\/Games\/(\d+)/);
    if (!m || Number(m[1]) !== Number(groupId)) return;
    const id = Number(m[2]);
    if (games.has(id)) return;

    // Climb until the container holds a time and an "@", but never so far that
    // it swallows another game's link.
    const textOf = (el) => el.find('*').addBack().contents().filter((__, n) => n.type === 'text')
      .map((__, n) => clean(n.data)).get().filter(Boolean);
    const otherGames = (el) => el.find(`a[href*="/Games/"]`).map((__, x) => $(x).attr('href')).get()
      .some((h) => /\/Games\/\d+/.test(h) && !h.includes(`/Games/${id}`));
    let box = $(a).parent();
    for (let i = 0; i < 8; i++) {
      const joined = textOf(box).join(' ');
      if (TIME_RE.test(joined) && /(^|\s)@|\bvs\b/i.test(joined)) break;
      const up = box.parent();
      if (!up.length || otherGames(up)) break;
      box = up;
    }
    const tokens = textOf(box);

    const time = tokens.find((t) => TIME_RE.test(t))?.match(TIME_RE)?.[1] ?? null;
    const atIdx = tokens.findIndex((t) => t.startsWith('@'));
    const away = atIdx > 0 ? tokens[atIdx - 1] : null;
    const home = atIdx >= 0 ? clean(tokens[atIdx].replace(/^@\s*/, '')) || tokens[atIdx + 1] : null;
    const scoreTok = tokens.find((t) => SCORE_RE.test(t));
    const [, as, hs] = scoreTok?.match(SCORE_RE) ?? [];
    const venue = clean(tokens.find((t) => /\(.+\)$/.test(t)) ?? '') || null;
    const code = tokens.find((t) => /^U\d{1,2}[A-Z]{1,4}-?\d+$/.test(t)) ?? null;
    const liveBarn = box.find('a[href*="livebarn.com"]').attr('href') ?? null;
    const type = tokens.some((t) => /playoff/i.test(t)) ? 'playoff' : 'regular';

    // Date: nearest preceding date heading.
    let dateText = box.text().match(DATE_RE)?.[0];
    if (!dateText) {
      const prev = box.prevAll().filter((__, el) => DATE_RE.test($(el).text())).first();
      dateText = prev.text().match(DATE_RE)?.[0] ?? null;
    }
    games.set(id, {
      id, divisionId: Number(groupId),
      start: toIso(dateText, time, seasonStartYear),
      away, home,
      awayScore: as != null ? Number(as) : null,
      homeScore: hs != null ? Number(hs) : null,
      status: as != null ? 'final' : 'scheduled',
      venue, code, liveBarn, type,
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
