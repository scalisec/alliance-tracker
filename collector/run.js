#!/usr/bin/env node
// Alliance Tracker collector.
//   node collector/run.js full     nightly: schedules + standings, all scored divisions
//   node collector/run.js live     game windows: only divisions with games now
//   node collector/run.js weekly   MD divisions (no scores kept) + MHR ratings
//   node collector/run.js capture  save raw HTML samples to fixtures/ (parser checks)
import fs from 'node:fs/promises';
import path from 'node:path';
import { DIVISIONS, SEASON, GAMESHEET_SEASONS, GAME_FINAL_AFTER_MIN, GAME_RECHECK_HOURS } from './config.js';
import { fetchText, fetchBinary, stats } from './fetcher.js';
import * as alliance from './sources/alliance.js';
import * as gamesheet from './sources/gamesheet.js';
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
const totals = { games: 0, rows: 0 };
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// ---------- association logos (by team-name prefix) ----------
const associations = await readJson(path.join(OVERRIDES, 'associations.json'), []);
function associationFor(teamName) {
  const n = teamName.toLowerCase();
  return associations.find((a) => a.match.some((m) => n.startsWith(m.toLowerCase()))) ?? null;
}

// ---------- division refresh ----------
async function refreshDivision(div, { withStandings = true } = {}) {
  const gamesFile = path.join(DATA, 'games', `${div.id}.json`);
  const standingsFile = path.join(DATA, 'standings', `${div.id}.json`);
  const existing = await readJson(gamesFile, []);
  const byId = new Map(existing.map((g) => [g.id, g]));

  const schedHtml = await fetchText(alliance.urls.schedule(div.id));
  const parsed = schedHtml ? alliance.parseSchedule(schedHtml, div.id) : [];
  for (const g of parsed) {
    const prev = byId.get(g.id);
    byId.set(g.id, { ...prev, ...g, gamesheet: prev?.gamesheet ?? null, detail: prev?.detail ?? false });
  }
  const games = [...byId.values()].sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''));
  await writeJson(gamesFile, games);

  let groups = null;
  if (withStandings && div.scored) {
    const stHtml = await fetchText(alliance.urls.standings(div.id));
    groups = stHtml ? alliance.parseStandings(stHtml) : [];
    await writeJson(standingsFile, { divisionId: div.id, updatedAt: new Date().toISOString(), regular: groups, playoffs: null });
  }
  const rowCount = groups?.reduce((n, g) => n + g.rows.length, 0) ?? 0;
  totals.games += parsed.length;
  totals.rows += rowCount;
  log(`div ${div.name}: ${parsed.length} games parsed, ${rowCount} standings rows`);
  return { games, groups };
}

// ---------- game details ----------
async function refreshGameDetails(div, games, now) {
  let changed = false;
  // Newest games first, so recent box scores land before any backfill.
  for (const g of [...games].reverse()) {
    if (!budgetLeft()) break;
    if (g.status !== 'final' || !g.start) continue;
    const ageH = (now - Date.parse(g.start)) / 3.6e6;
    if (g.detail && ageH > GAME_RECHECK_HOURS) continue;
    if (!g.gamesheet) {
      const html = await fetchText(alliance.urls.game(div.id, g.id));
      if (!html) continue;
      const info = alliance.parseGamePage(html);
      g.gamesheet = info.gamesheet;
      g.liveBarn ??= info.liveBarn;
      if (info.gamesheet && GAMESHEET_SEASONS[div.level] == null) GAMESHEET_SEASONS[div.level] = info.gamesheet.season;
      changed = true;
    }
    if (g.gamesheet && budgetLeft()) {
      const html = await fetchText(gamesheet.gameUrl(g.gamesheet.season, g.gamesheet.game));
      if (html) {
        const detail = gamesheet.parseGamePage(html);
        await writeJson(path.join(DATA, 'detail', `${g.id}.json`), { id: g.id, ...detail, fetchedAt: new Date().toISOString() });
        g.detail = detail.source === 'flight';
        changed = true;
      }
    }
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
    st?.regular?.forEach((grp) => grp.rows.forEach((r) => names.add(r.team)));
    games.forEach((g) => { g.home && names.add(g.home); g.away && names.add(g.away); });
    for (const name of names) {
      const id = `${div.id}:${slug(name)}`;
      const a = associationFor(name);
      teams.set(id, {
        id, name, divisionId: div.id, division: div.name,
        association: a?.name ?? null, logo: a?.logo ?? null,
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
  for (const div of DIVISIONS.filter((d) => d.refresh === 'live')) {
    const { games } = await refreshDivision(div);
    await refreshGameDetails(div, games, now);
  }
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
      const recentFinal = g.status === 'final' && sinceStart < GAME_RECHECK_HOURS * 60 && !g.detail;
      return needsResult || recentFinal;
    });
    if (!active) continue;
    const { games: fresh } = await refreshDivision(div);
    await refreshGameDetails(div, fresh, now);
  }
}

async function weekly() {
  for (const div of DIVISIONS.filter((d) => d.refresh === 'weekly')) {
    await refreshDivision(div, { withStandings: false });
  }
  // MHR ratings for mapped teams.
  const mhrMap = await readJson(path.join(OVERRIDES, 'mhr-teams.json'), {});
  const out = await readJson(path.join(DATA, 'mhr.json'), {});
  const year = Number(SEASON.slice(0, 4));
  for (const mhrId of new Set(Object.values(mhrMap))) {
    if (!budgetLeft()) break;
    const html = await fetchText(mhr.teamUrl(mhrId, year), { delayMs: 5000 });
    if (html) out[mhrId] = { ...mhr.parseTeamPage(html), checkedAt: new Date().toISOString() };
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
  const sched = await save('alliance-schedule-2721.html', alliance.urls.schedule(2721));
  await save('alliance-calendar-2721.html', alliance.urls.calendar(2721));
  await save('alliance-schedule-2735-md.html', alliance.urls.schedule(2735));
  await save('alliance-game-2379380.html', alliance.urls.game(2715, 2379380));
  await save('gamesheet-game-3074969.html', gamesheet.gameUrl(15449, 3074969));
  await save('theonedb-team-97224.html', 'https://www.theonedb.com/Teams/97224/');
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
log(`done; ${stats().requests} requests`);
