// TheOneDB (theonedb.com) runs on the same platform as alliancehockey.com.
// Its division schedule pages show one month at a time; other months are at
// `.../Schedule?d=MM-01-YYYY`. theonedb.com publishes no robots.txt rules, so
// those are fair game (we still pace requests). alliancehockey.com itself asks
// crawlers to skip query URLs, which is why season schedules come from here.
import * as cheerio from 'cheerio';
import { toIso } from './alliance.js';

export const BASE = 'https://www.theonedb.com';
export const teamUrl = (teamId) => `${BASE}/Teams/${teamId}/`;
export const monthUrl = (groupPath, year, month) =>
  `${BASE}${groupPath.replace(/\/$/, '')}/Schedule?d=${String(month).padStart(2, '0')}-01-${year}`;

const clean = (s) => (s ?? '').replace(/\s+/g, ' ').trim();

// A team page's menu links every division in the league:
//   "Under 13 BB" => /Groups/17187/Representative-Hockey-League---2026-2027-Under-13-BB/
export function parseGroupMenu(html) {
  const $ = cheerio.load(html);
  const out = {};
  $('a[href*="/Groups/"]').each((_, a) => {
    const name = clean($(a).text());
    const m = name.match(/^Under (\d+) (AAA|AA-A|BB|MD)$/);
    const href = ($(a).attr('href') ?? '').replace(/^https?:\/\/[^/]+/, '');
    if (m && /^\/Groups\/\d+\//.test(href)) out[`U${m[1]} ${m[2]}`] = href.replace(/(Schedule|Calendar|Standings)\/?$/, '');
  });
  return out;
}

// Kept for tests / older callers.
export function findGroupSchedulePath(html) {
  const $ = cheerio.load(html);
  const href = $('a[href*="/Groups/"][href$="/Schedule"]').first().attr('href');
  return href ? href.replace(/^https?:\/\/[^/]+/, '') : null;
}

// Schedule table: Game | Date+Time (narrow) | Date | Time | Visitor | Score | Home | Venue
export function parseScheduleTable(html, divisionId, { seasonStartYear = 2026 } = {}) {
  const $ = cheerio.load(html);
  const games = [];
  $('table').each((_, table) => {
    const head = $(table).find('tr').first().children('th,td').map((__, c) => clean($(c).text()).toLowerCase()).get();
    if (!head.includes('visitor') || !head.includes('home')) return;
    const col = (name) => head.lastIndexOf(name); // the second "Date" is the plain date column
    const ix = { code: col('game'), date: col('date'), time: col('time'), away: col('visitor'), score: col('score'), home: col('home'), venue: col('venue') };

    $(table).find('tr').slice(1).each((__, tr) => {
      const cells = $(tr).children('td,th');
      if (cells.length < 6) return;
      const venueCell = cells.eq(ix.venue);
      const id = Number((venueCell.find('a').attr('href') ?? '').match(/FindForGame\/(\d+)/)?.[1]);
      if (!id) return;
      const team = (i) => { const c = cells.eq(i).clone(); c.find('.score').remove(); return clean(c.text()) || null; };
      const score = clean(cells.eq(ix.score).text());
      const sm = score.match(/^(\d+)\s*-\s*(\d+)$/);
      const dateText = clean(cells.eq(ix.date).text()); // "Oct 02"
      const timeText = clean(cells.eq(ix.time).text()); // "6:30 PM"
      const rowText = clean($(tr).text());
      games.push({
        id, divisionId: Number(divisionId),
        start: dateText ? toIso(`Sat, ${dateText}`, /\d:\d\d\s?[AP]M/i.test(timeText) ? timeText : null, seasonStartYear) : null,
        away: team(ix.away), home: team(ix.home),
        awayScore: sm ? Number(sm[1]) : null, homeScore: sm ? Number(sm[2]) : null,
        status: /cancel|postpon/i.test(rowText) ? 'cancelled' : sm ? 'final' : 'scheduled',
        venue: clean(venueCell.text()) || null,
        code: clean(cells.eq(ix.code).text()) || null,
        liveBarn: null,
        type: 'regular',
        gamesheet: null,
      });
    });
  });
  return games;
}
