// Alliance Tracker — collector configuration.
// Division ("Group") IDs come from https://alliancehockey.com/Seasons/Current/
// TCHL (recreational) is intentionally excluded.

export const SEASON = '2026-27';
export const LEAGUE_ID = 1356; // Representative League
// Any TheOneDB team in the league; its page links every division. (Waterloo Wolves U13 BB)
export const ONEDB_SEED_TEAM = 97224;

// GameSheet season IDs by tier (found on Alliance game pages).
// AAA and MD are filled in automatically by the collector when it first
// sees a GameSheet link for those tiers.
export const GAMESHEET_SEASONS = {
  'AA-A': 15448,
  BB: 15449,
  AAA: null,
  MD: null,
};

const ages = ['U10', 'U11', 'U12', 'U13', 'U14', 'U15', 'U16', 'U18'];
const tiers = [
  { level: 'AAA', start: 2710 },
  { level: 'AA-A', start: 2711 },
  { level: 'BB', start: 2712 },
];

// Group IDs step by 3 per age: 2710 (U10 AAA), 2711 (U10 AA-A), 2712 (U10 BB),
// 2713 (U11 AAA) ... 2733 (U18 BB).
export const DIVISIONS = [
  ...ages.flatMap((age, i) =>
    tiers.map((t) => ({
      id: t.start + i * 3,
      age,
      level: t.level,
      name: `${age} ${t.level}`,
      scored: true,
      refresh: 'live',
    }))
  ),
  // Modified Division: no scores kept, schedule refreshed weekly.
  { id: 2734, age: 'U9', level: 'MD', name: 'U9 MD', scored: false, refresh: 'weekly' },
  { id: 2735, age: 'U8', level: 'MD', name: 'U8 MD', scored: false, refresh: 'weekly' },
];

export const AGES = ['U8', 'U9', ...ages];
export const LEVELS = ['AAA', 'AA-A', 'BB', 'MD'];

// Polite fetching: alliancehockey.com asks for a 10 second crawl delay and no
// query-string URLs. We apply the same pace to every host.
export const FETCH = {
  delayMs: 10_000,
  timeoutMs: 30_000,
  retries: 2,
  userAgent:
    'AllianceTracker/1.0 (unofficial family app; +https://scalisec.github.io/alliance-tracker/; benchbosslabs@gmail.com)',
};

// How long after puck drop a game is expected to have a final score.
export const GAME_FINAL_AFTER_MIN = 75;
// How long after a final we keep re-checking for box-score corrections.
export const GAME_RECHECK_HOURS = 6;
