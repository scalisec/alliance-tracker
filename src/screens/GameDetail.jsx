import { useJson, fmtLongDay, fmtTime } from '../data.js';
import { Empty, Icon, TeamLogo, Top } from '../ui.jsx';
import { back } from '../App.jsx';

const PERIOD = { 1: '1st Period', 2: '2nd Period', 3: '3rd Period', 4: 'Overtime', 5: 'Shootout' };

export default function GameDetail({ ctx, divId, gameId }) {
  const { data: games } = useJson(`games/${divId}.json`, [ctx.tick]);
  const game = games?.find((g) => String(g.id) === String(gameId));
  const { data: detail, loading } = useJson(game?.detail ? `detail/${gameId}.json` : null, [ctx.tick]);
  const div = ctx.divById(divId);

  return (
    <>
      <Top left={<button className="top-btn" onClick={back}><Icon.back size={20} /> Back</button>} title={div?.name ?? 'Game'} />
      <main className="page">
        {!game ? <Empty>Loading…</Empty> : (
          <>
            <section className="card gd-hero">
              <div className="when">{fmtLongDay(game.start)} · {fmtTime(game.start)}</div>
              <div className="game-body" style={{ padding: 0 }}>
                <Side name={game.away} logo={ctx.logoOf(game.away)} win={game.awayScore > game.homeScore} label="Away" />
                {game.homeScore != null
                  ? <div className="score"><span className={game.awayScore > game.homeScore ? '' : 'lose'}>{game.awayScore}</span><span className="dash">–</span><span className={game.homeScore > game.awayScore ? '' : 'lose'}>{game.homeScore}</span></div>
                  : <span className="at">@</span>}
                <Side name={game.home} logo={ctx.logoOf(game.home)} win={game.homeScore > game.awayScore} label="Home" />
              </div>
              <div className="venue" style={{ justifyContent: 'center', marginTop: 14 }}><Icon.pin /><span>{game.venue ?? 'Venue TBA'}</span></div>
              <div className="btn-row">
                {game.liveBarn && <a className="lb" href={game.liveBarn} target="_blank" rel="noopener noreferrer">Watch on LiveBarn</a>}
                {game.gamesheet && (
                  <a className="ghost" target="_blank" rel="noopener noreferrer" href={`https://gamesheetstats.com/seasons/${game.gamesheet.season}/games/${game.gamesheet.game}`}>GameSheet ↗</a>
                )}
                <a className="ghost" target="_blank" rel="noopener noreferrer" href={`https://alliancehockey.com/Groups/${divId}/Games/${gameId}/`}>Alliance ↗</a>
              </div>
            </section>

            {loading ? <Empty>Loading box score…</Empty>
              : !detail ? <Empty>{game.status === 'final' ? 'Box score not available yet. It usually appears shortly after the game sheet is submitted.' : 'Box score appears after the game.'}</Empty>
                : <BoxScore d={detail} game={game} />}
          </>
        )}
      </main>
    </>
  );
}

function Side({ name, logo, win, label }) {
  return (
    <div className={`side ${win ? 'win' : ''}`}>
      <TeamLogo name={name ?? '?'} logo={logo} size={56} />
      <span className="tn">{name}</span>
      <span className="at" style={{ fontSize: 10, letterSpacing: '.08em' }}>{label.toUpperCase()}</span>
    </div>
  );
}

function BoxScore({ d, game }) {
  const byPeriod = (items) => {
    const m = new Map();
    for (const it of items) { const k = it.period ?? 0; if (!m.has(k)) m.set(k, []); m.get(k).push(it); }
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  };
  const short = (team) => (team === game.home ? 'HOME' : team === game.away ? 'AWAY' : '');
  return (
    <>
      <div className="section-label">Scoring</div>
      {d.goals.length === 0 ? <div className="card gd-sec"><p className="legend">No goals recorded.</p></div> : (
        byPeriod(d.goals).map(([p, goals]) => (
          <section className="card gd-sec" key={`g${p}`}>
            <div className="section-label" style={{ margin: '12px 0 4px' }}>{PERIOD[p] ?? `Period ${p}`}</div>
            {goals.map((g, i) => (
              <div className="gd-row" key={i}>
                <span className="t">{g.time ?? ''}</span>
                <div>
                  <div className="who">{g.scorerNumber ? `#${g.scorerNumber} ` : ''}{g.scorer ?? 'Goal'}{g.type && <span className="tag">{g.type}</span>}</div>
                  <div className="sub">{g.team} {short(g.team) && `· ${short(g.team)}`}{g.assists?.length ? ` · Assists: ${g.assists.join(', ')}` : ' · Unassisted'}</div>
                </div>
              </div>
            ))}
          </section>
        ))
      )}
      <div className="section-label">Penalties</div>
      {d.penalties.length === 0 ? <div className="card gd-sec"><p className="legend">No penalties.</p></div> : (
        <section className="card gd-sec">
          {d.penalties.map((p, i) => (
            <div className="gd-row" key={i}>
              <span className="t">{p.period ? `P${p.period} ` : ''}{p.time ?? ''}</span>
              <div>
                <div className="who">{p.infraction ?? 'Penalty'}{p.minutes ? <span className="tag">{p.minutes} MIN</span> : null}</div>
                <div className="sub">{p.playerNumber ? `#${p.playerNumber} ` : ''}{p.player ?? ''} · {p.team}</div>
              </div>
            </div>
          ))}
        </section>
      )}
      <p className="legend">Box score from GameSheet. Official game sheet prevails.</p>
    </>
  );
}
