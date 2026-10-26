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

// ---------- club team pages (bghc.ca etc.) ----------
import * as clubs from '../collector/sources/clubs.js';
const CUDAS = { id: 'bghc-2066', name: 'Burlington Barracudas', site: 'https://bghc.ca', teamId: 2066 };

// Built from what bghc.ca shows (same markup as alliancehockey.com, team point of view).
const item = ({ id, day, time, tag, text, venue, score = '', result = '', lb = '' }) => `<div class="event-list-item hover-function"><div class="content">
  <div class="hover-overlay">${lb ? `<a class="livebarn-watch" href="${lb}">Watch</a>` : ''}<a href="/Teams/2066/Games/${id}/">Game Details</a></div>
  <div class="grid-x"><div class="time-primary"><div class="day_of_month">${day}</div>${time}</div>
  <div class="tag-list"><div class="tag">${tag}</div></div>
  <div class="subject-owner">Rep • U13 B (Emmie McKenzie)</div><div class="subject-text">${text}</div><div class="location">${venue}</div>
  <div class="related-info"><div class="game_score">${score}</div><div class="game_result">${result}</div></div></div></div></div>`;
const SAMPLE = `<div class="heading-1-wrapper"><span class="text">September 2026</span></div>
${item({ id: 59945, day: 'Sun 20', time: '9:00 AM', tag: 'Tournament Game', text: 'vs Lambeth Lancers', venue: 'Memorial Arena', score: '1-3', result: 'L' })}
${item({ id: 59810, day: 'Thu 24', time: '7:00 PM', tag: 'Exhibition', text: 'vs North Halton Twisters', venue: 'Mountainside Arena', score: '4-2', result: 'W', lb: 'https://join.livebarn.com/x' })}
${item({ id: 59853, day: 'Wed 30', time: '6:00 PM', tag: 'Exhibition', text: '@ North Halton Twisters', venue: 'Milton Memorial Arena', score: '2-5', result: 'W' })}
<div class="heading-1-wrapper"><span class="text">November 2026</span></div>
${item({ id: 62190, day: 'Sat 07', time: '12:15 PM', tag: 'Away Game', text: '@ Oakville Hornets<span class="game_no">U13B-114</span>', venue: 'Glen Abbey (1)' })}
<div class="event-list-item"><div class="time-primary"><div class="day_of_month">Tue 10</div>6:00 PM</div><div class="tag">Practice</div><div class="subject-text">Practice</div></div>`;

test('club schedule: team point of view becomes home/away with our score from W/L', () => {
  const g = clubs.parseClubSchedule(SAMPLE, CUDAS);
  assert.equal(g.length, 4, 'practices are skipped');
  const [t, h, a, up] = g;
  assert.deepEqual([t.home, t.away, t.homeScore, t.awayScore, t.type, t.status], ['Burlington Barracudas', 'Lambeth Lancers', 1, 3, 'tournament', 'final']);
  assert.equal(t.start, '2026-09-20T09:00:00-04:00');
  assert.deepEqual([h.home, h.homeScore, h.awayScore, h.type, h.liveBarn], ['Burlington Barracudas', 4, 2, 'exhibition', 'https://join.livebarn.com/x']);
  assert.deepEqual([a.away, a.home, a.awayScore, a.homeScore], ['Burlington Barracudas', 'North Halton Twisters', 5, 2], 'a win away: our 5 is the away score');
  assert.deepEqual([up.home, up.away, up.status, up.code, up.start, up.divisionId], ['Oakville Hornets', 'Burlington Barracudas', 'scheduled', 'U13B-114', '2026-11-07T12:15:00-05:00', 'bghc-2066']);
});

test('club schedule: real bghc.ca team page parses', { skip: !has('club-bghc-2066-schedule.html') }, () => {
  const g = clubs.parseClubSchedule(read('club-bghc-2066-schedule.html'), CUDAS);
  assert.ok(g.length > 0, 'expected games');
  assert.ok(g.every((x) => x.start && x.home && x.away && (x.home === CUDAS.name || x.away === CUDAS.name)), 'every game has a time and includes us');
  assert.equal(new Set(g.map((x) => x.id)).size, g.length);
});

test('club team page: the whole season from the game list, merged with the schedule page', { skip: !has('club-bghc-2066-team.html') || !has('club-bghc-2066-schedule.html') }, () => {
  const season = clubs.parseClubTeamPage(read('club-bghc-2066-team.html'), CUDAS);
  const recent = clubs.parseClubSchedule(read('club-bghc-2066-schedule.html'), CUDAS);
  assert.ok(season.length >= recent.length, `team page should list at least as many games (${season.length} vs ${recent.length})`);
  assert.ok(season.every((g) => g.start && (g.home === CUDAS.name) !== (g.away === CUDAS.name)), 'every game has a time and us on exactly one side');
  const all = clubs.mergeClubGames([], season, recent);
  const withRink = recent.filter((g) => g.venue).length;
  assert.equal(all.filter((g) => g.venue).length, withRink, 'rinks from the schedule page survive the merge');
  assert.ok(all.every((g) => g.type), 'every game has a type');
  assert.ok(all.some((g) => g.start < '2026-10-01'), 'September games come from the team page');
});
