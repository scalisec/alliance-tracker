#!/usr/bin/env node
// Alliance Tracker collector.
//   node collector/run.js full     nightly: schedules + standings, all scored divisions
//   node collector/run.js live     game windows: only divisions with games now
//   node collector/run.js weekly   MD divisions (no scores kept) + MHR ratings
//   node collector/run.js capture  save raw HTML samples to fixtures/ (parser checks)
import fs from 'node:fs/promises';
import path from 'node:path';
import { DIVISIONS, SEASON, ONEDB_SEED_TEAM, GAMESHEET_SEASONS, GAME_FINAL_AFTER_MIN, GAME_RECHECK_HOURS } from './config.js';
import { fetchText, fetchBinary, stats } from './fetcher.js';
import * as alliance from './sources/alliance.js';
import * as theonedb from './sources/theonedb.js';
import * as mhr from './sources/mhr.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DATA = path.join(ROOT, 'public', 'data');
const OVERRIDES = path.join(ROOT, 'data-overrides');
const MAX_REQUESTS = Number(process.env.MAX_REQUESTS ?? 120);

const readJson = async (f, fallback) => {
  try { return JSON.parse(await fs.readFile(f, 'utf8')); } catch { return fallback; }
};
const writeJson = async (f, v) => {
  await fs.mkdir(path.dirname(f), { recursive: true });
  const next = JSON.stringify(v, null, 1);
  const prev = await fs.readFile(f, 'utf8').catch(() => null);
  if (prev !== next) await fs.writeFile(f, next);
};
const budgetLeft = () => stats().requests < MAX_REQUESTS;
const totals = { games: 0, rows: 0, warnings: [], failed: 0 };
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// ---------- association logos (by team-name prefix) ----------
const associations = await readJson(path.join(OVERRIDES, 'associations.json'), []);
function associationFor(teamName) {
  const n = teamName.toLowerCase();
  return associations.find((a) => a.match.some((m) => n.startsWith(m.toLowerCase()))) ?? null;
}

// ---------- division refresh ----------
async function refreshDivision(div, { withStandings = true, fullSeason = false } = {}) {
  const gamesFile = path.join(DATA, 'games', `${div.id}.json`);
  const standingsFile = path.join(DATA, 'standings', `${div.id}.json`);
  const existing = await readJson(gamesFile, []);
  const byId = new Map(existing.map((g) => [g.id, g]));
  const merge = (list) => {
    for (const g of list) {
      const prev = byId.get(g.id);
      // Keep fields we learned earlier (GameSheet link, LiveBarn) if the new read lacks them.
      byId.set(g.id, { ...prev, ...g, gamesheet: prev?.gamesheet ?? null, liveBarn: g.liveBarn ?? prev?.liveBarn ?? null });
    }
  };

  let groups = null;
  if (withStandings && div.scored) {
    const stHtml = await fetchText(alliance.urls.standings(div.id));
    const st = stHtml ? alliance.parseStandings(stHtml) : { regular: [], playoffs: [] };
    groups = [...st.regular, ...st.playoffs];
    await writeJson(standingsFile, { divisionId: div.id, updatedAt: new Date().toISOString(), regular: st.regular, playoffs: st.playoffs.length ? st.playoffs : null });
  }

  // Other months from TheOneDB (nightly/weekly); current month from Alliance (every run).
  let seasonCount = 0;
  if (fullSeason) {
    // TheOneDB outages must not sink the run: keep the games we already have.
    try {
      const groupPath = (await onedbGroups(groups))[div.name];
      if (groupPath) {
        const haveMonth = new Set([...byId.values()].map((g) => g.start?.slice(0, 7)));
        for (const [y, m] of seasonMonthsToFetch(haveMonth)) {
          if (!budgetLeft()) break;
          const html = await fetchText(theonedb.monthUrl(groupPath, y, m));
          const list = html ? theonedb.parseScheduleTable(html, div.id) : [];
          seasonCount += list.length;
          merge(list);
        }
      } else log(`div ${div.name}: no TheOneDB link found`);
    } catch (e) {
      totals.warnings.push(`${div.name}: TheOneDB unavailable (${e.message.slice(0, 80)})`);
      log(`div ${div.name}: TheOneDB unavailable, keeping existing season games`);
    }
  }
  const schedHtml = await fetchText(alliance.urls.schedule(div.id));
  const parsed = schedHtml ? alliance.parseSchedule(schedHtml, div.id) : [];
  merge(parsed);

  const games = [...byId.values()].sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''));
  await writeJson(gamesFile, games);

  const rowCount = groups?.reduce((n, g) => n + g.rows.length, 0) ?? 0;
  totals.games += parsed.length + seasonCount;
  totals.rows += rowCount;
  log(`div ${div.name}: ${parsed.length} games this month, ${seasonCount} season (TheOneDB), ${rowCount} standings rows`);
  return { games, groups };
}

// Division name -> TheOneDB group path. One team page links every division,
// so this is fetched once and cached.
async function onedbGroups(groups) {
  const file = path.join(DATA, 'onedb-groups.json');
  const map = await readJson(file, {});
  if (DIVISIONS.every((d) => map[d.name])) return map;
  const teamId = groups?.flatMap((g) => g.rows).find((r) => r.teamId)?.teamId?.replace('odb-', '') ?? ONEDB_SEED_TEAM;
  const html = await fetchText(theonedb.teamUrl(teamId));
  Object.assign(map, html ? theonedb.parseGroupMenu(html) : {});
  await writeJson(file, map);
  return map;
}

// Season runs September to March. Past months are fetched once (until we have
// games for them); the current and future months every time, since schedules change.
// The current month also comes from Alliance on every run.
function seasonMonthsToFetch(haveMonth) {
  const start = Number(SEASON.slice(0, 4));
  const now = new Date();
  const cur = now.getUTCFullYear() * 12 + now.getUTCMonth();
  const out = [];
  for (let i = 0; i < 7; i++) {
    const y = start + Math.floor((8 + i) / 12), m = ((8 + i) % 12) + 1;
    const idx = y * 12 + (m - 1);
    const key = `${y}-${String(m).padStart(2, '0')}`;
    if (idx < cur && haveMonth.has(key)) continue;
    out.push([y, m]);
  }
  return out;
}

// Look up the GameSheet box-score link for recently finished games (one Alliance
// page each). GameSheet itself blocks automated reads, so the app links out.
async function refreshGameLinks(div, games, now, { maxAgeDays = 3, maxLookups = Infinity } = {}) {
  let changed = false, lookups = 0;
  for (const g of [...games].reverse()) {
    if (!budgetLeft() || lookups >= maxLookups) break;
    if (g.status !== 'final' || !g.start || g.gamesheet) continue;
    if ((now - Date.parse(g.start)) / 864e5 > maxAgeDays) continue;
    lookups++;
    const html = await fetchText(alliance.urls.game(div.id, g.id));
    if (!html) continue;
    const info = alliance.parseGamePage(html);
    g.gamesheet = info.gamesheet;
    g.liveBarn ??= info.liveBarn;
    if (info.gamesheet && GAMESHEET_SEASONS[div.level] == null) GAMESHEET_SEASONS[div.level] = info.gamesheet.season;
    changed = true;
  }
  if (changed) await writeJson(path.join(DATA, 'games', `${div.id}.json`), games);
}

// ---------- teams index (for search + My Teams) ----------
async function rebuildTeams() {
  const teams = new Map();
  const mhrMap = await readJson(path.join(OVERRIDES, 'mhr-teams.json'), {});
  const mhrData = await readJson(path.join(DATA, 'mhr.json'), {});
  for (const div of DIVISIONS) {
    const st = await readJson(path.join(DATA, 'standings', `${div.id}.json`), null);
    const games = await readJson(path.join(DATA, 'games', `${div.id}.json`), []);
    const names = new Set();
    const logos = new Map();
    st?.regular?.forEach((grp) => grp.rows.forEach((r) => { names.add(r.team); if (r.logo) logos.set(r.team, r.logo); }));
    games.forEach((g) => { g.home && names.add(g.home); g.away && names.add(g.away); });
    for (const name of names) {
      const id = `${div.id}:${slug(name)}`;
      const a = associationFor(name);
      teams.set(id, {
        id, name, divisionId: div.id, division: div.name,
        association: a?.name ?? null, logo: logos.get(name) ?? a?.logo ?? null,
        mhr: mhrMap[id] ? { id: mhrMap[id], ...(mhrData[mhrMap[id]] ?? {}) } : null,
      });
    }
  }
  await writeJson(path.join(DATA, 'teams.json'), [...teams.values()]);
  return teams.size;
}
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function writeMeta(mode) {
  const meta = await readJson(path.join(DATA, 'meta.json'), {});
  meta.season = SEASON;
  meta.sample = false;
  meta.updatedAt = new Date().toISOString();
  meta.runs = { ...(meta.runs ?? {}), [mode]: meta.updatedAt };
  meta.gamesheetSeasons = GAMESHEET_SEASONS;
  meta.divisions = DIVISIONS;
  await writeJson(path.join(DATA, 'meta.json'), meta);
}

async function ensureLogo() {
  const f = path.join(ROOT, 'public', 'assets', 'alliance-logo.png');
  try { await fs.access(f); return; } catch {}
  const buf = await fetchBinary(alliance.urls.logo);
  if (buf) { await fs.mkdir(path.dirname(f), { recursive: true }); await fs.writeFile(f, buf); log('saved Alliance logo'); }
}

// ---------- modes ----------
const torontoDay = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto' }).format(d);

async function full() {
  await ensureLogo();
  const now = Date.now();
  const scored = DIVISIONS.filter((d) => d.refresh === 'live');
  // 1) Standings + schedules for every division first, so they never run out of budget.
  const fresh = [];
  for (const div of scored) {
    try { fresh.push([div, (await refreshDivision(div, { fullSeason: true })).games]); }
    catch (e) { totals.failed++; totals.warnings.push(`${div.name}: ${e.message.slice(0, 100)}`); log(`div ${div.name} FAILED: ${e.message.slice(0, 100)}`); }
  }
  // MD normally updates weekly; fill it in now if it has under two months of games.
  for (const div of DIVISIONS.filter((d) => d.refresh === 'weekly')) {
    const have = await readJson(path.join(DATA, 'games', `${div.id}.json`), []);
    if (new Set(have.map((g) => g.start?.slice(0, 7))).size < 2) await refreshDivision(div, { withStandings: false, fullSeason: true });
  }
  // 2) Then a few GameSheet links per division for the last week's games.
  //    (Live runs pick these up on game days; the app falls back to Alliance's game page.)
  for (const [div, games] of fresh) await refreshGameLinks(div, games, now, { maxAgeDays: 7, maxLookups: 3 });
}

async function live() {
  const now = Date.now();
  const today = torontoDay(new Date());
  for (const div of DIVISIONS.filter((d) => d.refresh === 'live')) {
    if (!budgetLeft()) break;
    const games = await readJson(path.join(DATA, 'games', `${div.id}.json`), []);
    const active = games.some((g) => {
      if (!g.start || torontoDay(new Date(g.start)) !== today) return false;
      const sinceStart = (now - Date.parse(g.start)) / 60000;
      const needsResult = g.status !== 'final' && sinceStart >= GAME_FINAL_AFTER_MIN - 30;
      const recentFinal = g.status === 'final' && sinceStart < GAME_RECHECK_HOURS * 60 && !g.gamesheet;
      return needsResult || recentFinal;
    });
    if (!active) continue;
    try {
      const { games: fresh } = await refreshDivision(div);
      await refreshGameLinks(div, fresh, now);
    } catch (e) { totals.failed++; totals.warnings.push(`${div.name}: ${e.message.slice(0, 100)}`); log(`div ${div.name} FAILED: ${e.message.slice(0, 100)}`); }
  }
}

async function weekly() {
  for (const div of DIVISIONS.filter((d) => d.refresh === 'weekly')) {
    try { await refreshDivision(div, { withStandings: false, fullSeason: true }); }
    catch (e) { totals.failed++; totals.warnings.push(`${div.name}: ${e.message.slice(0, 100)}`); }
  }
  // MHR ratings for mapped teams.
  const mhrMap = await readJson(path.join(OVERRIDES, 'mhr-teams.json'), {});
  const out = await readJson(path.join(DATA, 'mhr.json'), {});
  const year = Number(SEASON.slice(0, 4));
  for (const mhrId of new Set(Object.values(mhrMap))) {
    if (!budgetLeft()) break;
    // MHR blocks automated requests (Cloudflare challenge); don't let that fail the run.
    try {
      const html = await fetchText(mhr.teamUrl(mhrId, year), { delayMs: 5000 });
      if (html) out[mhrId] = { ...mhr.parseTeamPage(html), checkedAt: new Date().toISOString() };
    } catch (e) { totals.warnings.push(`MHR ${mhrId}: ${e.message.slice(0, 60)}`); }
  }
  await writeJson(path.join(DATA, 'mhr.json'), out);
}

async function capture() {
  const dir = path.join(ROOT, 'fixtures');
  await fs.mkdir(dir, { recursive: true });
  const report = [];
  const save = async (name, url) => {
    try {
      const html = await fetchText(url);
      if (html) await fs.writeFile(path.join(dir, name), html);
      const line = `OK   ${name}  ${html ? html.length + ' bytes' : '404'}  ${url}`;
      report.push(line); log(line);
      return html;
    } catch (e) {
      const line = `FAIL ${name}  ${url}\n     ${e.message}`;
      report.push(line); log(line);
      return null;
    }
  };
  await save('alliance-robots.txt', 'https://alliancehockey.com/robots.txt');
  await save('alliance-standings-2721.html', alliance.urls.standings(2721));
  await save('alliance-standings-2710-u10aaa.html', alliance.urls.standings(2710));
  await save('alliance-standings-2712-u10bb.html', alliance.urls.standings(2712));
  const sched = await save('alliance-schedule-2721.html', alliance.urls.schedule(2721));
  await save('alliance-schedule-2735-md.html', alliance.urls.schedule(2735));
  await save('alliance-game-2379380.html', alliance.urls.game(2715, 2379380));
  const team = await save('theonedb-team-97224.html', theonedb.teamUrl(97224));
  const gp = team ? theonedb.findGroupSchedulePath(team) : null;
  if (gp) await save('theonedb-schedule-u13bb.html', theonedb.BASE + gp);
  const menu = team ? theonedb.parseGroupMenu(team) : {};
  if (menu['U13 BB']) await save('theonedb-schedule-u13bb-nov.html', theonedb.monthUrl(menu['U13 BB'], 2026, 11));
  // MYHockey Rankings: Burlington Lions Optimist (Bulldogs) association + U10 BB (White) team.
  const MHR = 'https://myhockeyrankings.com';
  await save('mhr-assoc-1798-default.html', `${MHR}/association-info?a=1798`);
  await save('mhr-assoc-1798-2026.html', `${MHR}/association-info?a=1798&y=2026`);
  await save('mhr-team-16142-2026.html', `${MHR}/team-info?y=2026&t=16142`);
  await save('mhr-team-16142-2025.html', `${MHR}/team-info?y=2025&t=16142`);
  if (sched) {
    const parsed = alliance.parseSchedule(sched, 2721);
    report.push(`schedule parser: ${parsed.length} games; first: ${JSON.stringify(parsed[0] ?? null)}`);
  }
  await fs.writeFile(path.join(dir, 'capture-report.txt'), report.join('\n') + '\n');
}

const mode = process.argv[2] ?? 'live';
const modes = { full, live, weekly, capture };
if (!modes[mode]) { console.error(`Unknown mode ${mode}`); process.exit(1); }
log(`mode=${mode}`);

// First real run: clear the preview sample data so it never mixes with real data.
const prevMeta = await readJson(path.join(DATA, 'meta.json'), {});
if (prevMeta.sample && (mode === 'live' || mode === 'weekly')) {
  log('Sample data still in place; waiting for the first full sync. Nothing to do.');
  process.exit(0);
}
if (prevMeta.sample && mode === 'full') {
  for (const d of ['games', 'standings', 'detail']) await fs.rm(path.join(DATA, d), { recursive: true, force: true });
  await fs.rm(path.join(DATA, 'teams.json'), { force: true });
  log('cleared sample data');
}

await modes[mode]();

// Safety net: if a full sync parsed nothing at all, the site layout probably
// changed. Fail loudly instead of publishing empty data.
if (mode === 'full' && totals.games === 0 && totals.rows === 0) {
  console.error('Full sync parsed 0 games and 0 standings rows — parsers need attention. Not publishing.');
  process.exit(1);
}
if (mode !== 'capture') {
  const n = await rebuildTeams();
  await writeMeta(mode);
  log(`teams indexed: ${n}`);
}
if (totals.warnings.length) {
  console.log(`::warning::${totals.warnings.length} problem(s): ` + totals.warnings.slice(0, 5).join(' | '));
}
log(`done; ${stats().requests} requests`);
