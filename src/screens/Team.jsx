import { useState } from 'react';
import { useJson, gameState, isPast, fmtWhen } from '../data.js';
import { useSaved } from '../store.js';
import { Empty, GameCard, Icon, Seg, TeamLogo, Top } from '../ui.jsx';
import { back, go } from '../App.jsx';
import { activeGroups } from '../standings.js';
import { FormRow, lastResults, resultFor } from '../form.jsx';
import { MhrCard } from '../mhr.jsx';

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Team page: record, every game played (newest first) and upcoming games.
// Route: #/team/{divisionId}/{team-slug}
export default function Team({ ctx, divId, teamSlug }) {
  const div = ctx.divById(divId);
  const scored = div?.scored !== false;
  const { data: games } = useJson(`games/${divId}.json`, [ctx.tick]);
  const { data: standings } = useJson(scored ? `standings/${divId}.json` : null, [ctx.tick]);
  const { isSaved, toggle } = useSaved();
  const [view, setView] = useState('results');
  const { data: mhrLinks } = useJson('mhr-links.json', [ctx.tick]);

  const team = ctx.teams.find((t) => t.divisionId === Number(divId) && slug(t.name) === teamSlug)
    ?? { id: `${divId}:${teamSlug}`, name: teamSlug.replace(/-/g, ' '), division: div?.name, logo: null };
  const name = team.name;

  // Standings row: the round where this team has played the most games.
  let row = null, rank = null, groupName = '';
  activeGroups(standings?.regular).forEach((g) => g.rows.forEach((r, i) => {
    if (r.team === name && (!row || r.gp > row.gp)) { row = r; rank = i + 1; groupName = g.name; }
  }));

  const mine = (g) => g.home === name || g.away === name;
  const list = (games ?? []).filter(mine).sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''));
  const played = list.filter(isPast).reverse();
  const upcoming = list.filter((g) => !isPast(g));
  const finals = played.filter((g) => gameState(g, { scored }) === 'final');

  // Record and form from the games themselves (works for every round).
  const resultOf = (g) => resultFor(g, name);
  const form = lastResults(finals, name);
  const gf = finals.reduce((n, g) => n + (g.home === name ? g.homeScore : g.awayScore), 0);
  const ga = finals.reduce((n, g) => n + (g.home === name ? g.awayScore : g.homeScore), 0);
  const stats = row ?? {
    gp: finals.length, w: finals.filter((g) => resultOf(g) === 'W').length,
    l: finals.filter((g) => resultOf(g) === 'L').length, t: finals.filter((g) => resultOf(g) === 'T').length,
    gf, ga, pts: null,
  };
  const on = isSaved(team.id);
  const openGame = (g) => go(`game/${g.divisionId}/${g.id}`);
  const shown = view === 'results' ? played : upcoming;

  return (
    <>
      <Top
        left={<button className="top-btn" onClick={back}><Icon.back size={20} /> Back</button>}
        title={div?.name ?? 'Team'}
        right={team.id && <button className={`add-btn ${on ? 'saved' : ''}`} aria-pressed={on} onClick={() => toggle(team.id)}>{on ? '✓ Saved' : '+ Add'}</button>}
      />
      <main className="page">
        <section className="card team-card">
          <div className="team-head">
            <TeamLogo name={name} logo={team.logo ?? ctx.logoOf(name)} size={52} />
            <div className="grow">
              <div className="name">{name}</div>
              <div className="sub">{div?.name}{groupName ? ` · ${groupName}` : ''}{rank ? ` · ${ordinal(rank)}` : ''}</div>
            </div>
          </div>
          {scored ? (
            <>
              <div className="stats">
                {['gp', 'w', 'l', 't', 'gf', 'ga', 'pts'].map((k) => (
                  <div key={k} className={k}><div className="v">{stats[k] ?? '–'}</div><div className="k">{k.toUpperCase()}</div></div>
                ))}
              </div>
              <FormRow form={form} streak={row?.strk} />
            </>
          ) : <p className="legend">MD divisions don't keep scores or standings.</p>}
        </section>

        {scored && <MhrCard team={team} links={mhrLinks} />}

        <div style={{ marginTop: 14 }}>
          <Seg value={view} onChange={setView} options={[
            { value: 'results', label: `${scored ? 'Results' : 'Played'} (${played.length})` },
            { value: 'upcoming', label: `Upcoming (${upcoming.length})` },
          ]} />
        </div>

        {!games ? <Empty>Loading…</Empty>
          : !shown.length ? <Empty>{view === 'results' ? 'No games played yet.' : 'No upcoming games posted.'}</Empty>
            : view === 'results' && scored ? (
              <section className="card">
                {shown.map((g) => <ResultRow key={g.id} g={g} name={name} state={gameState(g, { scored })} result={gameState(g, { scored }) === 'final' ? resultOf(g) : null} onOpen={openGame} />)}
              </section>
            ) : shown.map((g) => <GameCard key={g.id} game={g} logoOf={ctx.logoOf} mine={[name]} scored={scored} onOpen={openGame} />)}
      </main>
    </>
  );
}

// Compact one-line result: W/L/T · opponent (home/away) · score · date.
function ResultRow({ g, name, state, result, onOpen }) {
  const home = g.home === name;
  const opp = home ? g.away : g.home;
  const us = home ? g.homeScore : g.awayScore;
  const them = home ? g.awayScore : g.homeScore;
  return (
    <button className="result-row" onClick={() => onOpen(g)}>
      <span className={`form-pill ${result ?? 'none'}`}>{result ?? (state === 'cancelled' ? '✕' : '–')}</span>
      <span className="rr-main">
        <span className="rr-opp">{home ? 'vs' : '@'} {opp}</span>
        <span className="rr-when">{fmtWhen(g.start)}{g.venue ? ` · ${g.venue}` : ''}</span>
      </span>
      <span className="rr-score">{result ? `${us}–${them}` : state === 'cancelled' ? 'Cancelled' : 'Awaiting'}</span>
      <Icon.chev size={16} />
    </button>
  );
}

const ordinal = (n) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
