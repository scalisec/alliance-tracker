// Parser checks against real pages saved by the "Capture sample pages"
// workflow (fixtures/). Skips cleanly until fixtures exist.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as alliance from '../collector/sources/alliance.js';
import * as gamesheet from '../collector/sources/gamesheet.js';

const fx = (f) => new URL(`../fixtures/${f}`, import.meta.url);
const has = (f) => fs.existsSync(fx(f));
const read = (f) => fs.readFileSync(fx(f), 'utf8');

test('standings: U13 BB table parses with sensible numbers', { skip: !has('alliance-standings-2721.html') }, () => {
  const groups = alliance.parseStandings(read('alliance-standings-2721.html'));
  const rows = groups.flatMap((g) => g.rows);
  assert.ok(rows.length >= 8, `expected 8+ teams, got ${rows.length}`);
  for (const r of rows) {
    assert.ok(r.team.length > 2);
    assert.equal(r.gp, r.w + r.l + r.t, `${r.team}: GP != W+L+T`);
  }
});

test('schedule: games have teams and times', { skip: !has('alliance-schedule-2721.html') }, () => {
  const games = alliance.parseSchedule(read('alliance-schedule-2721.html'), 2721);
  assert.ok(games.length > 5, `expected games, got ${games.length}`);
  const ok = games.filter((g) => g.home && g.away && g.start);
  assert.ok(ok.length / games.length > 0.9, `only ${ok.length}/${games.length} complete`);
  assert.equal(new Set(games.map((g) => `${g.home}|${g.away}|${g.start}`)).size, games.length, 'duplicate games — container detection is off');
});

test('game page: GameSheet link found', { skip: !has('alliance-game-2379380.html') }, () => {
  const info = alliance.parseGamePage(read('alliance-game-2379380.html'));
  assert.deepEqual(info.gamesheet, { season: 15449, game: 3074969 });
});

test('gamesheet: goals and penalties extracted', { skip: !has('gamesheet-game-3074969.html') }, () => {
  const d = gamesheet.parseGamePage(read('gamesheet-game-3074969.html'));
  assert.equal(d.source, 'flight', 'fell back to text — update the GameSheet parser');
  assert.equal(d.goals.length, 3); // known result: 2-1
  assert.equal(d.penalties.length, 4);
});
