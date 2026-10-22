#!/usr/bin/env node
// Alliance Tracker collector.
//   node collector/run.js full     nightly: schedules + standings, all scored divisions
//   node collector/run.js live     game windows: only divisions with games now
//   node collector/run.js weekly   MD divisions (no scores kept)
//   node collector/run.js capture  save raw HTML samples to fixtures/ (parser checks)
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { DIVISIONS, SEASON, ONEDB_SEED_TEAM, GAMESHEET_SEASONS, GAME_FINAL_AFTER_MIN, GAME_RECHECK_HOURS } from './config.js';
import { fetchText, fetchBinary, stats } from './fetcher.js';
import * as alliance from './sources/alliance.js';
import * as theonedb from './sources/theonedb.js';
import { slug } from '../src/teams.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DATA = path.join(ROOT, 'public', 'data');
const OVERRIDES = path.join(ROOT, 'data-overrides');
const MAX_REQUESTS = Number(process.env.MAX_REQUESTS ?? 120);

const readJson = async (f, fallback) => {
  try { return JSON.parse(await fs.readFile(f, 'utf8')); } catch { return fallback; }
};
// Writes only when the content actually changed, and counts real changes, so a
// run that finds nothing new doesn't commit, republish or bust phones' caches.
let changedFiles = 0;
const writeJson = async (f, v) => {
  await fs.mkdir(path.dirname(f), { recursive: true });
  const next = JSON.stringify(v, null, 1);
  const prev = await fs.readFile(f, 'utf8').catch(() => null);
  if (prev === next) return false;
  await fs.writeFile(f, next);
  changedFiles++;
  return true;
};
const budgetLeft = () => stats().requests < MAX_REQUESTS;
const totals = { games: 0, rows: 0, warnings: [], failed: 0 };
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
// One division failing (a site hiccup) must not stop the others.
async function safely(div, fn) {
  try { return await fn(); } catch (e) {
    totals.failed++;
    totals.warnings.push(`${div.name}: ${e.message.slice(0, 100)}`);
    log(`div ${div.name} FAILED: ${e.message.slice(0, 100)}`);
    return null;
  }
}

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
      const lb = [g.liveBarn, prev?.liveBarn].find((u) => typeof u === 'string' && u.startsWith('https://')) ?? null;
      byId.set(g.id, { ...prev, ...g, gamesheet: prev?.gamesheet ?? null, liveBarn: lb });
    }
  };

  let groups = null;
  if (withStandings && div.scored) {
    const stHtml = await fetchText(alliance.urls.standings(div.id));
    const st = stHtml ? alliance.parseStandings(stHtml) : { regular: [], playoffs: [] };
    groups = [...st.regular, ...st.playoffs];
    // Keep the old file (and its updatedAt) when the table itself hasn't changed.
    const prevSt = await readJson(standingsFile, null);
    const playoffs = st.playoffs.length ? st.playoffs : null;
    if (!prevSt || JSON.stringify([prevSt.regular, prevSt.playoffs]) !== JSON.stringify([st.regular, playoffs])) {
      await writeJson(standingsFile, { divisionId: div.id, updatedAt: new Date().toISOString(), regular: st.regular, playoffs });
    }
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
      });
    }
  }
  // Serve logos from the app itself (faster, offline, no third-party requests).
  for (const t of teams.values()) t.logo = await localLogo(t.logo);
  await writeJson(path.join(DATA, 'teams.json'), [...teams.values()]);
  return teams.size;
}

// Remote logo URL -> saved copy at public/logos/<hash>.<ext>. Downloaded once;
// if a download fails the remote URL is kept and retried on a later run.
const LOGOS = path.join(ROOT, 'public', 'logos');
let logoFailures = 0;
async function localLogo(url) {
  if (!url || !/^https:\/\//.test(url)) return url?.startsWith('logos/') ? url : null;
  const ext = (/\.(png|jpe?g|gif|webp|svg)(?:$|\?)/i.exec(url)?.[1] ?? 'png').toLowerCase().replace('jpeg', 'jpg');
  const name = `${crypto.createHash('sha1').update(url).digest('hex').slice(0, 12)}.${ext}`;
  const file = path.join(LOGOS, name);
  if (await fs.access(file).then(() => true, () => false)) return `logos/${name}`;
  if (ext === 'svg') return url; // never self-host SVGs (they can carry scripts)
  // Downloads happen on the nightly run only, and stop for the night after a
  // failure, so a slow image server can never hold up live score updates.
  if (mode !== 'full' || logoFailures > 0) return url;
  const buf = await fetchBinary(url, { timeoutMs: 10_000 });
  if (!buf) { logoFailures++; return url; }
  await fs.mkdir(LOGOS, { recursive: true });
  await fs.writeFile(file, buf);
  changedFiles++;
  log(`saved logo ${name}`);
  return `logos/${name}`;
}

// meta.updatedAt is the data version phones use to refresh their saved copies,
// so it only moves when some data file really changed.
async function writeMeta(mode) {
  const file = path.join(DATA, 'meta.json');
  const meta = await readJson(file, {});
  const core = (m) => JSON.stringify([m.season, m.gamesheetSeasons, m.divisions]);
  const before = core(meta);
  delete meta.sample;
  Object.assign(meta, { season: SEASON, gamesheetSeasons: GAMESHEET_SEASONS, divisions: DIVISIONS });
  if (changedFiles === 0 && core(meta) === before) { log('no data changes; nothing to publish'); return; }
  meta.updatedAt = new Date().toISOString();
  meta.runs = { ...(meta.runs ?? {}), [mode]: meta.updatedAt };
  await writeJson(file, meta);
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
    const r = await safely(div, () => refreshDivision(div, { fullSeason: true }));
    if (r) fresh.push([div, r.games]);
  }
  // MD normally updates weekly; fill it in now if it has under two months of games.
  for (const div of DIVISIONS.filter((d) => d.refresh === 'weekly')) {
    const have = await readJson(path.join(DATA, 'games', `${div.id}.json`), []);
    if (new Set(have.map((g) => g.start?.slice(0, 7))).size < 2) await safely(div, () => refreshDivision(div, { withStandings: false, fullSeason: true }));
  }
  // 2) Then a few GameSheet links per division for the last week's games.
  //    (Live runs pick these up on game days; the app falls back to Alliance's game page.)
  for (const [div, games] of fresh) await safely(div, () => refreshGameLinks(div, games, now, { maxAgeDays: 7, maxLookups: 3 }));
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
    await safely(div, async () => {
      const { games: fresh } = await refreshDivision(div);
      await refreshGameLinks(div, fresh, now);
    });
  }
}

async function weekly() {
  for (const div of DIVISIONS.filter((d) => d.refresh === 'weekly')) {
    await safely(div, () => refreshDivision(div, { withStandings: false, fullSeason: true }));
  }
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

// Keep GameSheet season ids learned on earlier runs (e.g. AAA is auto-detected).
const prevMeta = await readJson(path.join(DATA, 'meta.json'), {});
for (const [k, v] of Object.entries(prevMeta.gamesheetSeasons ?? {})) GAMESHEET_SEASONS[k] ??= v;

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
