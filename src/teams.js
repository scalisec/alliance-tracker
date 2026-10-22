// Small team helpers shared by the app screens and the collector (plain JS, no JSX).
import { activeGroups } from './standings.js';

// "Burlington Bulldogs Blue" -> "burlington-bulldogs-blue" (team ids and page addresses).
export const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const ordinal = (n) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };

// A team's standings row. A team can appear in more than one round; use the one
// where it has played the most games. Returns { row, rank, groupName } (row null if absent).
export function standingFor(groups, name) {
  let row = null, rank = null, groupName = '';
  activeGroups(groups).forEach((g) => g.rows.forEach((r, i) => {
    if (r.team === name && (!row || r.gp > row.gp)) { row = r; rank = i + 1; groupName = g.name; }
  }));
  return { row, rank, groupName };
}
