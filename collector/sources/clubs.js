// Club team schedules from association sites on the same platform as alliancehockey.com
// (MBLeagueWeb / MB Sports Web), e.g. bghc.ca for the Burlington Barracudas (OWHA girls' hockey).
// A club team page lists that team's games from its own point of view:
//   .subject-owner "Rep • U13 B (Coach)", .subject-text "vs Opponent" (home) or "@ Opponent" (away),
//   .tag "Home Game" / "Away Game" / "Tournament Game" / "Exhibition", .game_score "3-1" + .game_result "W".
// Used by Watch Party (it picks a team's games to fill in game details); Alliance Tracker's own screens
// don't show these teams.
import { scheduleItems } from './alliance.js';

export const urls = {
  schedule: (team) => `${team.site}/Teams/${team.teamId}/Schedule/`,
  team: (team) => `${team.site}/Teams/${team.teamId}/`,
  robots: (team) => `${team.site}/robots.txt`,
  logo: (team) => `${team.site}/domains/${new URL(team.site).hostname}/logo.png`,
};

const clean = (s) => (s ?? '').replace(/\s+/g, ' ').trim();

/**
 * One club team's games in the league format the rest of the data uses:
 * { id, divisionId, start, away, home, awayScore, homeScore, status, venue, code, liveBarn, type, gamesheet }.
 * Our side is named team.name; the opponent as the page shows it.
 */
export function parseClubSchedule(html, team, { seasonStartYear = 2026 } = {}) {
  const out = [];
  for (const it of scheduleItems(html, { seasonStartYear })) {
    const text = it.text;
    let home, away;
    const vs = text.match(/^vs\.?\s+(.+)$/i);
    const at = text.match(/^@\s*(.+)$/);
    if (vs) { home = team.name; away = clean(vs[1]); }
    else if (at) { away = team.name; home = clean(at[1]); }
    else if (it.owner && text) { away = it.owner; home = text; } // league-style "Away @ Home" without the marker
    else continue;
    const opp = home === team.name ? away : home;
    if (!opp || opp === team.name) continue;

    // Score: trust the W/L/T result for which number is ours; otherwise read it as away-home.
    let awayScore = null, homeScore = null;
    const sm = it.scoreText.match(/^(\d{1,2})\s*-\s*(\d{1,2})$/);
    if (sm) {
      const a = Number(sm[1]), b = Number(sm[2]);
      const r = (it.resultText.match(/^\s*([WLT])\b/i)?.[1] ?? '').toUpperCase();
      let us = null, them = null;
      if (r === 'W') { us = Math.max(a, b); them = Math.min(a, b); }
      else if (r === 'L') { us = Math.min(a, b); them = Math.max(a, b); }
      else if (r === 'T') { us = a; them = b; }
      if (us != null) {
        homeScore = home === team.name ? us : them;
        awayScore = home === team.name ? them : us;
      } else { awayScore = a; homeScore = b; }
    }
    out.push({
      id: it.id, divisionId: team.id,
      start: it.start, away, home, awayScore, homeScore,
      status: it.cancelled ? 'cancelled' : sm ? 'final' : 'scheduled',
      venue: it.venue, code: it.code,
      liveBarn: typeof it.liveBarn === 'string' && it.liveBarn.startsWith('https://') ? it.liveBarn : null,
      type: it.type,
      gamesheet: null,
    });
  }
  return out;
}
