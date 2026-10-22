import { useState } from 'react';
import { useJson, ago } from '../data.js';
import { useSaved } from '../store.js';
import { Empty, Icon, Seg, TeamLogo, Top } from '../ui.jsx';
import DivisionPicker from './DivisionPicker.jsx';
import { go } from '../App.jsx';
import { activeGroups } from '../standings.js';
import { slug } from '../teams.js';

export default function Standings({ ctx }) {
  const [phase, setPhase] = useState('regular');
  const div = ctx.divById(ctx.div);
  const { data, loading } = useJson(div?.scored ? `standings/${div.id}.json` : null, [ctx.tick]);
  const { saved } = useSaved();
  const mine = new Set(saved.map((id) => ctx.teams.find((t) => t.id === id)?.name).filter(Boolean));
  const allGroups = phase === 'regular' ? data?.regular : data?.playoffs;
  const groups = activeGroups(allGroups);
  const hidden = (allGroups?.length ?? 0) - groups.length;

  return (
    <>
      <Top title="Standings" right={<button className="icon-btn" aria-label="Settings" onClick={() => go('settings')}><Icon.gear /></button>} />
      <main className="page">
        <DivisionPicker ctx={ctx} />
        <Seg value="current" onChange={() => {}} options={[
          { value: 'archive', label: '2025–26 · Archive', disabled: true },
          { value: 'current', label: `${ctx.meta?.season?.replace('-', '–') ?? '2026–27'} · Current` },
        ]} />
        <Seg value={phase} onChange={setPhase} options={[{ value: 'regular', label: 'Regular Season' }, { value: 'playoffs', label: 'Playoffs' }]} />

        {!div?.scored ? (
          <Empty title="No standings for MD">Modified Division (U8–U9) games don't keep scores. Check the Schedule tab for game times.</Empty>
        ) : loading && !data ? (
          <Empty>Loading…</Empty>
        ) : !groups?.length ? (
          <Empty>{phase === 'playoffs' ? 'Playoff standings appear once playoffs begin.' : 'No standings posted yet.'}</Empty>
        ) : (
          <>
            {groups.map((g, gi) => (
              <section className="card stand" key={gi}>
                {g.name && <h3>{g.name}</h3>}
                <table>
                  <thead>
                    <tr><th>#</th><th className="tm">TEAM</th><th>GP</th><th>W</th><th>L</th><th>T</th><th>PTS</th><th>GD</th><th>GF</th><th>GA</th></tr>
                  </thead>
                  <tbody>
                    {g.rows.map((r, i) => (
                      <tr key={r.team} className={`tap ${mine.has(r.team) ? 'mine' : ''}`} onClick={() => go(`team/${div.id}/${slug(r.team)}`)}>
                        <td>{i + 1}</td>
                        <td className="tm"><div><TeamLogo name={r.team} logo={ctx.logoOf(r.team)} size={22} /><span>{r.team}</span></div></td>
                        <td className="dim">{r.gp}</td><td>{r.w}</td><td className="dim">{r.l}</td><td className="dim">{r.t}</td>
                        <td className="pts">{r.pts}</td>
                        <td className={r.diff > 0 ? 'pos' : r.diff < 0 ? 'neg' : 'dim'}>{r.diff > 0 ? `+${r.diff}` : r.diff}</td>
                        <td className="dim">{r.gf}</td><td className="dim">{r.ga}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ))}
            {hidden > 0 && <p className="legend">A later round with no games played yet is hidden until it starts.</p>}
            <p className="legend">Tap a team to see its games. Order and tiebreakers follow alliancehockey.com. Official rules prevail. Updated {ago(data?.updatedAt)}.</p>
          </>
        )}
      </main>
    </>
  );
}
