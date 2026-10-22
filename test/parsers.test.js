// Parser checks against real pages saved by the "Capture sample pages"
// workflow (fixtures/). Skips cleanly until fixtures exist.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as alliance from '../collector/sources/alliance.js';
import * as theonedb from '../collector/sources/theonedb.js';

const fx = (f) => new URL(`../fixtures/${f}`, import.meta.url);
const has = (f) => fs.existsSync(fx(f));
const read = (f) => fs.readFileSync(fx(f), 'utf8');

test('standings: U13 BB table parses with sensible numbers', { skip: !has('alliance-standings-2721.html') }, () => {
  const { regular } = alliance.parseStandings(read('alliance-standings-2721.html'));
  const rows = regular.flatMap((g) => g.rows);
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

test('schedule: MD division parses with no scores', { skip: !has('alliance-schedule-2735-md.html') }, () => {
  const games = alliance.parseSchedule(read('alliance-schedule-2735-md.html'), 2735);
  assert.ok(games.length > 0);
  assert.ok(games.every((g) => g.start && g.home && g.away));
});

test('theonedb: team page links to the division full schedule', { skip: !has('theonedb-team-97224.html') }, () => {
  assert.match(theonedb.findGroupSchedulePath(read('theonedb-team-97224.html')), /^\/Groups\/\d+\/.+\/Schedule$/);
});

test('theonedb: menu links all 26 divisions', { skip: !has('theonedb-team-97224.html') }, () => {
  const menu = theonedb.parseGroupMenu(read('theonedb-team-97224.html'));
  assert.equal(Object.keys(menu).length, 26);
  assert.ok(menu['U8 MD'] && menu['U18 AAA']);
});

// The two samples may be captured on different days, so a game can be scored in
// one and not yet in the other: teams must match, nearly all times, and scores when both have one.
test('theonedb: month table matches Alliance', { skip: !has('theonedb-schedule-u13bb.html') }, () => {
  const t = theonedb.parseScheduleTable(read('theonedb-schedule-u13bb.html'), 2721);
  const a = new Map(alliance.parseSchedule(read('alliance-schedule-2721.html'), 2721).map((g) => [g.id, g]));
  assert.ok(t.length > 0);
  const common = t.filter((g) => a.has(g.id));
  assert.ok(common.length >= t.length * 0.8, `only ${common.length}/${t.length} games found on Alliance`);
  for (const g of common) {
    const x = a.get(g.id);
    assert.deepEqual([g.away, g.home], [x.away, x.home], `teams for game ${g.id}`);
    if (g.homeScore != null && x.homeScore != null) assert.deepEqual([g.awayScore, g.homeScore], [x.awayScore, x.homeScore], `score for game ${g.id}`);
  }
  // Times are read from two different page layouts; nearly all must agree (a few may be rescheduled).
  const sameTime = common.filter((g) => g.start === a.get(g.id).start).length;
  assert.ok(sameTime >= common.length * 0.9, `times match for only ${sameTime}/${common.length} games`);
});

test('theonedb: another month parses', { skip: !has('theonedb-schedule-u13bb-nov.html') }, () => {
  const t = theonedb.parseScheduleTable(read('theonedb-schedule-u13bb-nov.html'), 2721);
  assert.ok(t.length > 0 && t.every((g) => g.start?.startsWith('2026-11')), 'November games expected');
});

test('standings: rounds and group names (U10 AAA)', { skip: !has('alliance-standings-2710-u10aaa.html') }, () => {
  const st = alliance.parseStandings(read('alliance-standings-2710-u10aaa.html'));
  assert.deepEqual(st.regular.map((g) => g.name), ['East Division', 'West Division']);
  assert.deepEqual(st.playoffs.map((g) => g.name), ['Playdowns · East Division', 'Playdowns · West Division']);
});

test('standings: single group has no label (U13 BB)', { skip: !has('alliance-standings-2721.html') }, () => {
  const st = alliance.parseStandings(read('alliance-standings-2721.html'));
  assert.equal(st.regular.length, 1);
  assert.equal(st.regular[0].name, '');
  assert.equal(st.playoffs.length, 0);
});
