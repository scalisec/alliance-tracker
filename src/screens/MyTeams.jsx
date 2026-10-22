import { useJson, ago } from '../data.js';
import { useSaved } from '../store.js';
import { BrandMark, Empty, GameCard, Icon, TeamLogo, Top } from '../ui.jsx';
import { go } from '../App.jsx';
import { ordinal, slug, standingFor } from '../teams.js';
import { FormRow, lastResults } from '../form.jsx';
import { mhrLink } from '../mhr.jsx';

export default function MyTeams({ ctx }) {
  const { saved } = useSaved();
  const myTeams = saved.map((id) => ctx.teams.find((t) => t.id === id)).filter(Boolean);

  return (
    <>
      <Top
        left={<button className="top-btn" onClick={() => go('find')}><Icon.plus /> Team</button>}
        title={<><BrandMark /> My Teams</>}
        right={<button className="icon-btn" aria-label="Settings" onClick={() => go('settings')}><Icon.gear /></button>}
      />
      <main className="page">
        {myTeams.length === 0 ? (
          <Empty
            title="Follow your team"
            action={<button className="primary" onClick={() => go('find')}>Find my team</button>}
          >
            Save one or more teams to see their record, upcoming games and latest results here.
          </Empty>
        ) : (
          myTeams.map((t) => <TeamCard key={t.id} team={t} ctx={ctx} />)
        )}
      </main>
    </>
  );
}

function TeamCard({ team, ctx }) {
  const div = ctx.divById(team.divisionId);
  const { data: standings } = useJson(div?.scored ? `standings/${team.divisionId}.json` : null, [ctx.tick]);
  const { data: games } = useJson(`games/${team.divisionId}.json`, [ctx.tick]);
  const { data: mhrLinks } = useJson('mhr-links.json', [ctx.tick]);
  const mhr = mhrLink(team, mhrLinks);

  const { row, rank, groupName } = standingFor(standings?.regular, team.name);

  const mine = (g) => g.home === team.name || g.away === team.name;
  const list = (games ?? []).filter(mine).sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''));
  const now = Date.now();
  const upcoming = list.filter((g) => g.status !== 'final' && Date.parse(g.start) > now - 90 * 60000).slice(0, 3);
  const last = list.filter((g) => g.status === 'final').slice(-1);

  const openDivision = () => { ctx.setDiv(team.divisionId); go('standings'); };
  const openGame = (g) => go(`game/${g.divisionId}/${g.id}`);
  const stats = row ?? { gp: 0, w: 0, l: 0, t: 0, gf: 0, ga: 0, pts: 0 };

  return (
    <section className="card team-card">
      <div className="team-head tap" role="button" onClick={() => go(`team/${team.divisionId}/${slug(team.name)}`)}>
        <TeamLogo name={team.name} logo={team.logo} size={46} />
        <div className="grow">
          <div className="name">{team.name}</div>
          <div className="sub">
            {team.division}{groupName ? ` · ${groupName}` : ''}{rank ? ` · ${ordinal(rank)}` : ''}
          </div>
        </div>
      </div>

      {div?.scored ? (
        <>
          <div className="stats">
            {['gp', 'w', 'l', 't', 'gf', 'ga', 'pts'].map((k) => (
              <div key={k} className={k}><div className="v">{stats[k]}</div><div className="k">{k.toUpperCase()}</div></div>
            ))}
          </div>
          <FormRow form={lastResults(list, team.name)} streak={row?.strk} />
        </>
      ) : (
        <p className="legend">MD divisions don't keep scores or standings. Schedule updates weekly.</p>
      )}

      {last.length > 0 && (
        <>
          <div className="section-label">Last result</div>
          {last.map((g) => <GameCard key={g.id} game={g} logoOf={ctx.logoOf} mine={[team.name]} scored={div?.scored !== false} onOpen={openGame} />)}
        </>
      )}

      <div className="section-label">Next games</div>
      {upcoming.length ? upcoming.map((g) => <GameCard key={g.id} game={g} logoOf={ctx.logoOf} mine={[team.name]} scored={div?.scored !== false} onOpen={openGame} />)
        : <p className="legend">No upcoming games posted yet.</p>}

      <button className="full-link" onClick={openDivision}>Full division <Icon.chev size={18} /></button>
      {div?.scored && (
        <a className="full-link" href={mhr.url} target="_blank" rel="noopener noreferrer">
          {mhr.exact ? 'MYHockey Rankings' : 'Find on MYHockey Rankings'} <span>↗</span>
        </a>
      )}
      <div className="updated">Updated {ago(ctx.meta?.updatedAt)}</div>
    </section>
  );
}
