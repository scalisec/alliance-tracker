// Club team schedules from association sites on the same platform as alliancehockey.com
// (MBLeagueWeb / MB Sports Web), e.g. bghc.ca for the Burlington Barracudas (OWHA girls' hockey).
// A club team page lists that team's games from its own point of view:
//   .subject-owner "Rep • U13 B (Coach)", .subject-text "vs Opponent" (home) or "@ Opponent" (away),
//   .tag "Home Game" / "Away Game" / "Tournament Game" / "Exhibition", .game_score "3-1" + .game_result "W".
// Used by Watch Party (it picks a team's games to fill in game details); Alliance Tracker's own screens
// don't show these teams.
import * as cheerio from 'cheerio';
import { scheduleItems, toIso } from './alliance.js';

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

/**
 * The team page's game list (a carousel of every game this season, played and upcoming):
 * visitor and home rows (ours has class "team", theirs "opponent"), scores, "Thu Sep 24" + "7:00p",
 * and a LiveBarn link. No rink or game type, so the Schedule page fills those in where it has them.
 */
export function parseClubTeamPage(html, team, { seasonStartYear = 2026 } = {}) {
  const $ = cheerio.load(html);
  const out = new Map();
  $('.carousel-item').each((_, el) => {
    const $el = $(el);
    const id = Number(($el.find('a[href*="/Games/"]').attr('href') ?? '').match(/\/Games\/(\d+)/)?.[1]);
    if (!id) return;
    const side = (cls) => {
      const row = $el.find(`.${cls}`).first();
      const us = row.find('.team').length > 0;
      const name = us ? team.name : clean(row.find('.opponent').first().text());
      const sc = clean(row.find('.score').first().text());
      return { name, us, score: /^\d{1,2}$/.test(sc) ? Number(sc) : null };
    };
    const v = side('vteam'), h = side('hteam');
    if (!v.name || !h.name || v.us === h.us) return;
    const dateText = clean($el.find('.date .cell').first().text()); // "Thu Sep 24"
    const tm = clean($el.find('.date .cell').last().text()).match(/(\d{1,2}):(\d{2})\s*([ap])/i); // "7:00p"
    const time = tm ? `${tm[1]}:${tm[2]} ${tm[3].toUpperCase()}M` : null;
    const dm = dateText.match(/^(\w{3})\w*\s+(\w{3})\w*\s+(\d{1,2})/);
    const start = dm ? toIso(`${dm[1]}, ${dm[2]} ${dm[3]}`, time, seasonStartYear) : null;
    if (!start) return;
    const final = v.score != null && h.score != null;
    const lb = $el.find('a.livebarn-watch, a[href*="livebarn.com"]').first().attr('href') ?? null;
    const cancelled = /cancel|postpon/i.test(clean($el.text()));
    out.set(id, {
      id, divisionId: team.id, start, away: v.name, home: h.name,
      awayScore: final ? v.score : null, homeScore: final ? h.score : null,
      status: cancelled ? 'cancelled' : final ? 'final' : 'scheduled',
      venue: null, code: null,
      liveBarn: typeof lb === 'string' && lb.startsWith('https://') ? lb : null,
      type: null, gamesheet: null,
    });
  });
  return [...out.values()];
}

/** Combine games from several reads: later reads win, but a missing value never wipes a known one. */
export function mergeClubGames(...lists) {
  const byId = new Map();
  for (const list of lists) {
    for (const g of list ?? []) {
      const prev = byId.get(g.id) ?? {};
      const next = { ...prev };
      for (const [k, val] of Object.entries(g)) if (val != null || !(k in prev)) next[k] = val;
      byId.set(g.id, next);
    }
  }
  return [...byId.values()].map((g) => ({ ...g, type: g.type ?? 'regular' }))
    .sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''));
}
