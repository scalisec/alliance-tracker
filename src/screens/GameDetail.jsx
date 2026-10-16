import { useJson, fmtLongDay, fmtTime } from '../data.js';
import { Empty, Icon, TeamLogo, Top } from '../ui.jsx';
import { back } from '../App.jsx';

export default function GameDetail({ ctx, divId, gameId }) {
  const { data: games } = useJson(`games/${divId}.json`, [ctx.tick]);
  const game = games?.find((g) => String(g.id) === String(gameId));
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
              {game.code && <div className="legend" style={{ textAlign: 'center' }}>Game {game.code}</div>}
              <div className="btn-row">
                {game.status === 'final' && (
                  <a className="primary" target="_blank" rel="noopener noreferrer" href={boxScoreUrl(game, divId)}>Full box score ↗</a>
                )}
                {game.liveBarn && <a className="lb" href={game.liveBarn} target="_blank" rel="noopener noreferrer">{game.status === 'final' ? 'Replay on LiveBarn' : 'Watch on LiveBarn'}</a>}
                <a className="ghost" target="_blank" rel="noopener noreferrer" href={`https://alliancehockey.com/Groups/${divId}/Games/${gameId}/`}>Alliance game page ↗</a>
              </div>
            </section>
            <p className="legend" style={{ textAlign: 'center' }}>
              {game.status === 'final' ? 'Scorers, assists and penalties open on GameSheet.' : 'Score and box score appear after the game.'}
            </p>
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

// GameSheet box score when we know its link; otherwise Alliance's game page,
// which carries the same box score in its own tab.
function boxScoreUrl(game, divId) {
  return game.gamesheet
    ? `https://gamesheetstats.com/seasons/${game.gamesheet.season}/games/${game.gamesheet.game}`
    : `https://alliancehockey.com/Groups/${divId}/Games/${game.id}/`;
}
