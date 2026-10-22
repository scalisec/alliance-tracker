import { useMemo, useState } from 'react';
import { useMany } from '../data.js';
import { useSaved } from '../store.js';
import { Empty, Icon, TeamLogo, Top } from '../ui.jsx';
import { back, go } from '../App.jsx';
import { standingFor } from '../teams.js';

export default function FindTeam({ ctx }) {
  const [q, setQ] = useState('');
  const { saved, isSaved, toggle } = useSaved();
  const [toast, setToast] = useState(null);
  const [addedHere, setAddedHere] = useState(0);
  const flash = (msg, undoId) => {
    setToast({ msg, undoId, key: Date.now() });
    clearTimeout(flash.t);
    flash.t = setTimeout(() => setToast(null), 3000);
  };
  const onToggle = (t) => {
    const adding = !isSaved(t.id);
    toggle(t.id);
    setAddedHere((n) => n + (adding ? 1 : -1));
    flash(adding ? `Added ${t.name} · ${t.division}` : `Removed ${t.name}`, adding ? t.id : null);
  };
  const done = () => go('');

  const results = useMemo(() => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    return ctx.teams
      .filter((t) => {
        const hay = `${t.name} ${t.association ?? ''} ${t.division}`.toLowerCase();
        return terms.every((w) => hay.includes(w));
      })
      .sort((a, b) => a.name.localeCompare(b.name) || a.divisionId - b.divisionId)
      .slice(0, 60);
  }, [q, ctx.teams]);

  // Rank + points from the standings of the divisions shown.
  const divIds = [...new Set(results.map((t) => t.divisionId))].filter((id) => ctx.divById(id)?.scored);
  const standings = useMany(divIds.map((id) => `standings/${id}.json`), [ctx.tick]);
  const place = (t) => {
    const { row, rank } = standingFor(standings?.[divIds.indexOf(t.divisionId)]?.regular, t.name);
    return row ? ` · #${rank} · ${row.pts} pts` : '';
  };

  return (
    <>
      <Top
        left={<button className="top-btn" onClick={back}><Icon.back size={20} /> Back</button>}
        title="Find my team"
        right={<button className="done-btn" onClick={done}>Done{saved.length > 0 && <span className="count" aria-label={`${saved.length} saved`}>{saved.length}</span>}</button>}
      />
      <main className="page">
        <div className="search">
          <Icon.search />
          <input autoFocus type="text" inputMode="search" enterKeyHint="search" placeholder="City, association or team name…" value={q} onChange={(e) => setQ(e.target.value)} />
          {q && <button aria-label="Clear" onClick={() => setQ('')}><Icon.x /></button>}
        </div>
        {!q ? (
          <Empty>Search by city, association or team name — for example “Burlington”, “Bulldogs”, “Waterloo” or “U10 BB”.</Empty>
        ) : results.length === 0 ? (
          <Empty>No teams match “{q}”.</Empty>
        ) : (
          <div className="card results">
            {results.map((t) => {
              const on = isSaved(t.id);
              return (
                <div className="result" key={t.id}>
                  <TeamLogo name={t.name} logo={t.logo} size={36} />
                  <div className="grow">
                    <div className="nm">{t.name}</div>
                    <div className="meta">{t.division}{place(t)}</div>
                  </div>
                  <button className={`add-btn ${on ? 'saved' : ''}`} aria-pressed={on} onClick={() => onToggle(t)}>{on ? '✓ Saved' : '+ Add'}</button>
                </div>
              );
            })}
          </div>
        )}
      </main>
      {toast && (
        <div className="toast" role="status" key={toast.key}>
          <span>{toast.msg}</span>
          {toast.undoId ? <button onClick={() => { toggle(toast.undoId); setAddedHere((n) => n - 1); setToast(null); }}>Undo</button>
            : null}
        </div>
      )}
    </>
  );
}
