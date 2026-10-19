// "Last 5" form row, shared by My Teams and the team page.
export function resultFor(g, name) {
  const us = g.home === name ? g.homeScore : g.awayScore;
  const them = g.home === name ? g.awayScore : g.homeScore;
  return us > them ? 'W' : us < them ? 'L' : 'T';
}

// Most recent first. `games` = this team's games in any order.
export function lastResults(games, name, n = 5) {
  return games
    .filter((g) => g.status === 'final' && g.homeScore != null)
    .sort((a, b) => (b.start ?? '').localeCompare(a.start ?? ''))
    .slice(0, n)
    .map((g) => resultFor(g, name));
}

export function FormRow({ form, streak }) {
  if (!form.length) return null;
  return (
    <div className="form-row" aria-label={`Last ${form.length}: ${form.join(' ')}`}>
      <span className="form-label">Last {form.length}</span>
      {form.map((r, i) => <span key={i} className={`form-pill ${r}`}>{r}</span>)}
      {streak && <span className="form-label" style={{ marginLeft: 'auto' }}>Streak {streak}</span>}
    </div>
  );
}
