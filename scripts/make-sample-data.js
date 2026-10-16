// Generates clearly-labelled SAMPLE data so the app can be designed and tested
// before the real collector has run. meta.sample = true shows a banner.
import fs from 'node:fs/promises';
import path from 'node:path';
import { DIVISIONS, SEASON } from '../collector/config.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DATA = path.join(ROOT, 'public', 'data');
const assoc = JSON.parse(await fs.readFile(path.join(ROOT, 'data-overrides', 'associations.json'), 'utf8'));

let seed = 42;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pick = (a) => a[Math.floor(rnd() * a.length)];

const POOL = [
  'Burlington Bulldogs Blue', 'Burlington Bulldogs White', 'Burlington Raiders', 'Waterloo Wolves',
  'Stratford Warriors', 'Oakridge Aeros', 'Brantford 99ers', 'Kitchener Jr Rangers', 'Sarnia Jr. Sting',
  'West London Hawks', 'Woodstock Jr Navy Vets', 'Cambridge Hawks', 'North London Nationals',
  'London Bandits', 'Lambeth Lancers', 'St. Thomas Jr Stars',
];
const AAA = ['Waterloo Wolves', 'Kitchener Jr Rangers', 'London Jr Knights', 'Elgin-Middlesex Canucks',
  'Huron-Perth Lakers', 'Brantford 99ers', 'Cambridge Hawks', 'Sarnia-Lambton Jr Sting',
  'Chatham-Kent Cyclones', 'Sun County Panthers', 'Windsor Jr Spitfires'];
const VENUES = ['Appleby Ice Centre (3)', 'Mountainside Arena', 'Gretzky Centre (#1)', 'RIM Park (Lions)',
  'Rotary Complex (Rink A)', 'Nichols Arena (A)', 'Reeves CC (Red)', 'Sports Park (1)', 'Clearwater (Blue)',
  'Mr Lube + Tires (Red)', 'Oakridge Arena', 'Bostwick (A)'];
const logoFor = (n) => assoc.find((a) => a.match.some((m) => n.startsWith(m)))?.logo ?? null;
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const p2 = (n) => String(n).padStart(2, '0');

const teams = [];
let gameId = 2400000;
const now = new Date('2026-10-16T09:00:00-04:00');

for (const div of DIVISIONS) {
  const base = div.level === 'AAA' ? AAA : POOL;
  const names = [...base].sort(() => rnd() - 0.5).slice(0, div.level === 'AAA' ? 10 : 12);
  if (div.id === 2712) { // U10 BB: make sure the Bulldogs are in it, split East/West
    for (const n of ['Burlington Bulldogs Blue', 'Burlington Bulldogs White'])
      if (!names.includes(n)) names[names.length - 1 - names.indexOf(n) * 0] = n;
  }
  const uniq = [...new Set(names)];
  const groups = div.id === 2712 || div.id === 2715
    ? [{ name: 'East', teams: uniq.slice(0, 6) }, { name: 'West', teams: uniq.slice(6) }]
    : [{ name: '', teams: uniq }];
  for (const n of uniq) teams.push({ id: `${div.id}:${slug(n)}`, name: n, divisionId: div.id, division: div.name, association: null, logo: logoFor(n), mhr: null });

  const rec = Object.fromEntries(uniq.map((n) => [n, { gp: 0, w: 0, l: 0, t: 0, gf: 0, ga: 0, last: [] }]));
  const games = [];
  for (let d = -26; d <= 30; d++) {
    const day = new Date(now.getTime() + d * 864e5);
    const dow = day.getDay();
    if (!(dow === 0 || dow === 6 || (dow === 5 && rnd() < 0.4))) continue;
    const shuffled = [...uniq].sort(() => rnd() - 0.5);
    for (let i = 0; i + 1 < shuffled.length && i < 6; i += 2) {
      if (rnd() < 0.45) continue;
      const [home, away] = [shuffled[i], shuffled[i + 1]];
      const hour = 8 + Math.floor(rnd() * 12), min = pick([0, 15, 30, 45]);
      const start = `${day.getFullYear()}-${p2(day.getMonth() + 1)}-${p2(day.getDate())}T${p2(hour)}:${p2(min)}:00-04:00`;
      const past = Date.parse(start) < now.getTime() - 2 * 36e5;
      let hs = null, as = null;
      if (past && div.scored) {
        hs = Math.floor(rnd() * 6); as = Math.floor(rnd() * 6);
        const H = rec[home], A = rec[away];
        H.gp++; A.gp++; H.gf += hs; H.ga += as; A.gf += as; A.ga += hs;
        if (hs > as) { H.w++; A.l++; H.last.push('W'); A.last.push('L'); }
        else if (hs < as) { A.w++; H.l++; A.last.push('W'); H.last.push('L'); }
        else { H.t++; A.t++; H.last.push('T'); A.last.push('T'); }
      }
      const id = gameId++;
      games.push({
        id, divisionId: div.id, start, home, away,
        homeScore: hs, awayScore: as, status: hs != null ? 'final' : 'scheduled',
        venue: pick(VENUES), code: `${div.age}${div.level === 'BB' ? 'BR' : div.level === 'AAA' ? 'P' : 'S'}${id % 300}`,
        liveBarn: rnd() < 0.7 ? 'https://livebarn.com/' : null, type: 'regular',
        gamesheet: hs != null ? { season: 15449, game: 3070000 + (id % 9999) } : null,
      });
    }
  }
  await write(`games/${div.id}.json`, games);

  if (div.scored) {
    const streak = (last) => { if (!last.length) return null; const r = last.at(-1); let k = 0; for (let i = last.length - 1; i >= 0 && last[i] === r; i--) k++; return `${r}${k}`; };
    const l10 = (last) => { const s = last.slice(-10); return `${s.filter((x) => x === 'W').length}-${s.filter((x) => x === 'L').length}${s.includes('T') ? '-' + s.filter((x) => x === 'T').length : ''}`; };
    const regular = groups.map((g) => ({
      name: g.name,
      rows: g.teams.map((n) => {
        const r = rec[n];
        return { team: n, teamId: null, gp: r.gp, w: r.w, l: r.l, t: r.t, pts: r.w * 2 + r.t, gf: r.gf, ga: r.ga, diff: r.gf - r.ga, l10: l10(r.last), strk: streak(r.last) };
      }).sort((a, b) => b.pts - a.pts || b.diff - a.diff),
    }));
    await write(`standings/${div.id}.json`, { divisionId: div.id, updatedAt: now.toISOString(), regular, playoffs: null });
  }

}

async function write(rel, v) {
  const f = path.join(DATA, rel);
  await fs.mkdir(path.dirname(f), { recursive: true });
  await fs.writeFile(f, JSON.stringify(v));
}

// A couple of sample MHR ratings to show the feature.
for (const t of teams.filter((t) => t.divisionId === 2712).slice(0, 8)) t.mhr = { id: 1, rating: +(78 + rnd() * 10).toFixed(2), rank: Math.ceil(rnd() * 60) };
await write('teams.json', teams);
await write('meta.json', { season: SEASON, sample: true, updatedAt: now.toISOString(), runs: {}, divisions: DIVISIONS });
console.log(`sample data: ${teams.length} teams across ${DIVISIONS.length} divisions`);
