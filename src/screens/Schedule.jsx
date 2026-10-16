import { useState } from 'react';
import { useJson, dayKey, fmtLongDay, isPast } from '../data.js';
import { useSaved } from '../store.js';
import { Empty, GameCard, Icon, Seg, Top } from '../ui.jsx';
import DivisionPicker from './DivisionPicker.jsx';
import { go } from '../App.jsx';

export default function Schedule({ ctx }) {
  const [phase, setPhase] = useState('regular');
  const [when, setWhen] = useState('upcoming');
  const div = ctx.divById(ctx.div);
  const { data: games, loading } = useJson(div ? `games/${div.id}.json` : null, [ctx.tick]);
  const { saved } = useSaved();
  const mine = saved.map((id) => ctx.teams.find((t) => t.id === id)?.name).filter(Boolean);

  const list = (games ?? []).filter((g) => (g.type ?? 'regular') === phase)
    .sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''));
  const shown = when === 'upcoming' ? list.filter((g) => !isPast(g)) : list.filter(isPast).reverse();

  // Group by day.
  const days = [];
  for (const g of shown) {
    const k = g.start ? dayKey(g.start) : 'tba';
    if (!days.length || days.at(-1).key !== k) days.push({ key: k, label: g.start ? fmtLongDay(g.start) : 'Date TBA', games: [] });
    days.at(-1).games.push(g);
  }

  return (
    <>
      <Top title="Schedule" right={<button className="icon-btn" aria-label="Settings" onClick={() => go('settings')}><Icon.gear /></button>} />
      <main className="page">
        <DivisionPicker ctx={ctx} />
        <Seg value={phase} onChange={setPhase} options={[{ value: 'regular', label: 'Regular Season' }, { value: 'playoff', label: 'Playoffs' }]} />
        <Seg value={when} onChange={setWhen} options={[{ value: 'upcoming', label: 'Upcoming' }, { value: 'results', label: div?.scored === false ? 'Played' : 'Results' }]} />

        {loading && !games ? <Empty>Loading…</Empty>
          : !days.length ? <Empty>{phase === 'playoff' ? 'No playoff games scheduled yet.' : when === 'upcoming' ? 'No upcoming games posted.' : 'No results yet.'}</Empty>
            : days.map((d) => (
              <div key={d.key}>
                <div className="date-head">{d.label}</div>
                {d.games.map((g) => (
                  <GameCard key={g.id} game={g} logoOf={ctx.logoOf} mine={mine} onOpen={(x) => go(`game/${x.divisionId}/${x.id}`)} />
                ))}
              </div>
            ))}
      </main>
    </>
  );
}
