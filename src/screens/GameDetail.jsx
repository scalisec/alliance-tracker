import { useEffect, useState } from 'react';
import { useJson, fmtLongDay, fmtTime, gameState, ago } from '../data.js';
import { Empty, Icon, TeamLogo, Top } from '../ui.jsx';
import { back } from '../App.jsx';

const AUTO_CHECK_MS = 2 * 60 * 1000;

export default function GameDetail({ ctx, divId, gameId }) {
  const { data: games } = useJson(`games/${divId}.json`, [ctx.tick]);
  const game = games?.find((g) => String(g.id) === String(gameId));
  const div = ctx.divById(divId);
  const state = game ? gameState(game, { scored: div?.scored !== false }) : null;
  const waiting = state === 'live' || state === 'awaiting';
  const [busy, setBusy] = useState(false);
  const [checkedAt, setCheckedAt] = useState(null);
  const [, setNow] = useState(0);

  const check = async () => {
    setBusy(true);
    try { await ctx.refresh(true); } finally { setCheckedAt(Date.now()); setBusy(false); }
  };
  // While a live/awaiting game is open, look for new data every 2 minutes,
  // and re-render each 30 s so "checked … ago" stays accurate.
  useEffect(() => {
    if (!waiting) return;
    const a = setInterval(check, AUTO_CHECK_MS);
    const b = setInterval(() => setNow((n) => n + 1), 30000);
    return () => { clearInterval(a); clearInterval(b); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waiting]);

  const [showGs, setShowGs] = useState(false);
  const gsSeason = game?.gamesheet?.season ?? ctx.meta?.gamesheetSeasons?.[div?.level] ?? null;
  const gsUrl = game?.gamesheet
    ? `https://gamesheetstats.com/seasons/${game.gamesheet.season}/games/${game.gamesheet.game}`
    : gsSeason ? `https://gamesheetstats.com/seasons/${gsSeason}/games` : null;

  return (
    <>
      <Top left={<button className="top-btn" onClick={back}><Icon.back size={20} /> Back</button>} title={div?.name ?? 'Game'} />
      <main className="page">
        {!game ? <Empty>Loading…</Empty> : (
          <>
            <section className="card gd-hero">
              <div className="when">
                {state === 'live' && <span className="badge live" style={{ marginRight: 8 }}>LIVE</span>}
                {state === 'awaiting' && <span className="badge pending" style={{ marginRight: 8 }}>AWAITING SCORE</span>}
                {fmtLongDay(game.start)} · {fmtTime(game.start)}
              </div>
              <div className="game-body" style={{ padding: 0 }}>
                <Side name={game.away} logo={ctx.logoOf(game.away)} win={game.awayScore > game.homeScore} label="Away" />
                {game.homeScore != null
                  ? <div className="score"><span className={game.awayScore > game.homeScore ? '' : 'lose'}>{game.awayScore}</span><span className="dash">–</span><span className={game.homeScore > game.awayScore ? '' : 'lose'}>{game.homeScore}</span></div>
                  : <span className="at">@</span>}
                <Side name={game.home} logo={ctx.logoOf(game.home)} win={game.homeScore > game.awayScore} label="Home" />
              </div>
              <div className="venue" style={{ justifyContent: 'center', marginTop: 14 }}><Icon.pin /><span>{game.venue ?? 'Venue TBA'}</span></div>
              {game.code && <div className="legend" style={{ textAlign: 'center' }}>Game {game.code}</div>}
              {waiting && (
                <div className="live-panel">
                  <button className="refresh-btn" onClick={check} disabled={busy}>
                    <span className={busy ? 'spin' : ''}><Icon.refresh /></span> {busy ? 'Checking…' : 'Refresh score'}
                  </button>
                  <div className="hint">
                    {checkedAt ? `Checked ${ago(new Date(checkedAt).toISOString())}` : 'Checks automatically every 2 min'}
                    {' · '}Alliance data from {ago(ctx.meta?.updatedAt)}
                  </div>
                  <div className="hint">Alliance posts the score once the game sheet is submitted, usually shortly after the game.</div>
                </div>
              )}
              <div className="btn-row">
                {waiting && game.liveBarn && <a className="lb" href={game.liveBarn} target="_blank" rel="noopener noreferrer">{state === 'live' ? 'Watch live on LiveBarn' : 'Replay on LiveBarn'}</a>}
                {waiting && gsUrl && (
                  <a className="ghost" target="_blank" rel="noopener noreferrer" href={gsUrl}>{game.gamesheet ? 'Live score on GameSheet ↗' : `Live scores on GameSheet (${div?.name}) ↗`}</a>
                )}
                {game.status === 'final' && (
                  <a className="primary" target="_blank" rel="noopener noreferrer" href={boxScoreUrl(game, divId)}>Full box score ↗</a>
                )}
                {!waiting && game.liveBarn && <a className="lb" href={game.liveBarn} target="_blank" rel="noopener noreferrer">{game.status === 'final' ? 'Replay on LiveBarn' : 'Watch on LiveBarn'}</a>}
                <a className="ghost" target="_blank" rel="noopener noreferrer" href={`https://alliancehockey.com/Groups/${divId}/Games/${gameId}/`}>Alliance game page ↗</a>
              </div>
            </section>
            {gsUrl && (state === 'live' || state === 'awaiting' || state === 'final') && (
              <section className="card gs-embed">
                <button className="gs-toggle" onClick={() => setShowGs((v) => !v)} aria-expanded={showGs}>
                  <span>{state === 'final' ? 'Box score from GameSheet' : `Live on GameSheet${game.gamesheet ? '' : ` · ${div?.name} games`}`}</span>
                  <span className="chev" style={{ transform: showGs ? 'rotate(90deg)' : 'none' }}><Icon.chev size={18} /></span>
                </button>
                {showGs && (
                  <>
                    <iframe
                      title="GameSheet"
                      src={embedUrl(gsUrl)}
                      loading="lazy"
                      referrerPolicy="strict-origin-when-cross-origin"
                    />
                    <div className="gs-foot">
                      <span>Blank or error above? GameSheet may not allow showing it here.</span>
                      <a href={gsUrl} target="_blank" rel="noopener noreferrer">Open in GameSheet ↗</a>
                    </div>
                  </>
                )}
              </section>
            )}
            <p className="legend" style={{ textAlign: 'center' }}>
              {state === 'final' ? 'Scorers, assists and penalties open on GameSheet.'
                : state === 'live' ? 'GameSheet shows live scoring when the scorekeeper uses the GameSheet app.'
                : waiting ? '' : 'Score and box score appear after the game.'}
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

// GameSheet's embed mode (what alliancehockey.com uses): no site navigation,
// no outbound links, Alliance navy as the accent colour.
function embedUrl(url) {
  const q = 'configuration%5Bnavigation%5D=false&configuration%5Blinks%5D=false'
    + '&configuration%5Bprimary-colour%5D=043B83&configuration%5Bsecondary-colour%5D=777777';
  return url + (url.includes('?') ? '&' : '?') + q;
}
