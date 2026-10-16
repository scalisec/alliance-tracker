// MYHockey Rankings (myhockeyrankings.com) — team rating and rank.
// MHR's robots.txt allows all agents. Ratings only appear once a team has
// played enough games, so "not yet rated" is a normal state.
//
// Alliance team -> MHR team id mapping lives in data-overrides/mhr-teams.json.
// Matches are added as MHR lists Alliance teams; nameScore() helps suggest them.
import * as cheerio from 'cheerio';

export const teamUrl = (mhrId, year) => `https://myhockeyrankings.com/team_info.php?y=${year}&t=${mhrId}`;

const clean = (s) => (s ?? '').replace(/\s+/g, ' ').trim();

export function parseTeamPage(html) {
  const $ = cheerio.load(html);
  const text = clean($('body').text());
  const rating = text.match(/Rating[:\s]+(\d{2,3}\.\d{2})/i)?.[1];
  const rank = text.match(/(?:Ranked|Rank)[:\s#]+(\d+)/i)?.[1];
  const record = text.match(/Record[:\s]+(\d+-\d+-\d+)/i)?.[1];
  return {
    rating: rating ? Number(rating) : null,
    rank: rank ? Number(rank) : null,
    record: record ?? null,
  };
}

// Simple name similarity for discovery (token overlap).
export function nameScore(a, b) {
  const tok = (s) => new Set(s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 1 && !['jr', 'the', 'hockey'].includes(w)));
  const A = tok(a), B = tok(b);
  const inter = [...A].filter((x) => B.has(x)).length;
  return inter / Math.max(1, Math.min(A.size, B.size));
}
