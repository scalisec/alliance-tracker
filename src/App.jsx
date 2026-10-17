import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadMeta, getJson } from './data.js';
import { hideSplash } from './splash.js';
import { usePersisted } from './store.js';
import { Icon } from './ui.jsx';
import MyTeams from './screens/MyTeams.jsx';
import FindTeam from './screens/FindTeam.jsx';
import Standings from './screens/Standings.jsx';
import Schedule from './screens/Schedule.jsx';
import GameDetail from './screens/GameDetail.jsx';
import Settings from './screens/Settings.jsx';

// Hash routes: #/  #/standings  #/schedule  #/find  #/game/{div}/{id}  #/settings
const parse = () => {
  const parts = (location.hash.replace(/^#\/?/, '') || 'teams').split('/');
  return { name: parts[0], args: parts.slice(1) };
};
export const go = (path) => { location.hash = `#/${path}`; };
export const back = () => (history.length > 1 ? history.back() : go(''));

const TABS = [
  { key: 'teams', label: 'My Teams', icon: Icon.home },
  { key: 'standings', label: 'Standings', icon: Icon.list },
  { key: 'schedule', label: 'Schedule', icon: Icon.cal },
];

export default function App() {
  const [route, setRoute] = useState(parse);
  const [lastTab, setLastTab] = useState('teams');
  const [meta, setMeta] = useState(null);
  const [teams, setTeams] = useState([]);
  const [error, setError] = useState(null);
  const [div, setDiv] = usePersisted('at.division', 2712); // default U10 BB
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const on = () => setRoute(parse());
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  useEffect(() => { if (TABS.some((t) => t.key === route.name)) setLastTab(route.name); }, [route.name]);

  const refresh = useCallback(async (force = false) => {
    try {
      const m = await loadMeta(force);
      setMeta(m);
      setTeams((await getJson('teams.json')) ?? []);
      setTick((t) => t + 1);
      setError(null);
      hideSplash();
    } catch (e) {
      setError('Could not load data. Check your connection and try again.');
      hideSplash();
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  // Re-check for new data when the app comes back to the foreground.
  useEffect(() => {
    const on = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, [refresh]);

  const divisions = meta?.divisions ?? [];
  const ctx = useMemo(() => {
    const logoByName = new Map(teams.map((t) => [t.name, t.logo]));
    return {
      meta, teams, divisions, tick, div, setDiv, refresh,
      divById: (id) => divisions.find((d) => d.id === Number(id)),
      logoOf: (name) => logoByName.get(name) ?? null,
    };
  }, [meta, teams, divisions, tick, div, setDiv, refresh]);

  const tab = TABS.some((t) => t.key === route.name) ? route.name : lastTab;
  const overlay = route.name;

  let screen;
  if (overlay === 'find') screen = <FindTeam ctx={ctx} />;
  else if (overlay === 'game') screen = <GameDetail ctx={ctx} divId={route.args[0]} gameId={route.args[1]} />;
  else if (tab === 'standings') screen = <Standings ctx={ctx} />;
  else if (tab === 'schedule') screen = <Schedule ctx={ctx} />;
  else screen = <MyTeams ctx={ctx} />;

  const showNav = overlay !== 'find' && overlay !== 'game';

  return (
    <div className="app">
      {error && <div className="page"><div className="banner">{error}</div></div>}
      {meta?.sample && showNav && (
        <div className="page" style={{ paddingTop: 'calc(8px + env(safe-area-inset-top))', paddingBottom: 0 }}>
          <div className="banner"><b>Preview with sample data.</b> Real Alliance standings and schedules appear after the first data update.</div>
        </div>
      )}
      {meta ? screen : !error && <div className="empty"><div className="puck" /><p>Loading…</p></div>}
      {showNav && (
        <nav className="nav">
          {TABS.map((t) => (
            <button key={t.key} className={tab === t.key ? 'on' : ''} onClick={() => go(t.key === 'teams' ? '' : t.key)} aria-current={tab === t.key ? 'page' : undefined}>
              <t.icon size={22} />{t.label}
            </button>
          ))}
        </nav>
      )}
      {overlay === 'settings' && <Settings ctx={ctx} onClose={back} onRefresh={() => refresh(true)} />}
    </div>
  );
}
