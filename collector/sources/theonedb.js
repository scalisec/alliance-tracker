// TheOneDB (theonedb.com) runs on the same platform as alliancehockey.com and
// offers a path-only "Full Schedule" page per division, which covers the whole
// season. alliancehockey.com only shows the current month without query URLs.
//
// Alliance standings link each team to theonedb.com/Teams/{id}/; a team page
// links to its division ("Group") pages, which is how we find the group id.
import * as cheerio from 'cheerio';

export const BASE = 'https://www.theonedb.com';
export const teamUrl = (teamId) => `${BASE}/Teams/${teamId}/`;

// Returns the division's Full Schedule path from a team page, e.g.
// /Groups/17187/Representative-Hockey-League---2026-2027-Under-13-BB/Schedule
export function findGroupSchedulePath(html) {
  const $ = cheerio.load(html);
  const href = $('a[href*="/Groups/"][href$="/Schedule"]').first().attr('href');
  return href ? href.replace(/^https?:\/\/[^/]+/, '') : null;
}
