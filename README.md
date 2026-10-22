# Alliance Tracker

Unofficial standings, scores and schedules for **Minor Hockey Alliance of Ontario** rep divisions, modelled on [OWHA Tracker](https://owhatracker.app/). An installable phone web app, hosted free on GitHub Pages.

> Unofficial community app. Not affiliated with or endorsed by ALLIANCE Hockey, GameSheet Inc. or MYHockey Rankings. All data and logos belong to their owners.
>
> Questions or feedback: [benchbosslabs@gmail.com](mailto:benchbosslabs@gmail.com)

## Features

| Screen | What it shows |
|---|---|
| **My Teams** | Saved teams (stored on the phone): GP/W/L/T/GF/GA/PTS, division place, last 5, last result, next 3 games, LiveBarn, "Full division", MYHockey link |
| **Find my team** | Search by city, association, team or division; add/remove |
| **Standings** | Age + level pickers, regular season/playoffs, grouped tables with GD, your teams highlighted; tap a team for its page |
| **Team page** | Record, last 5, results and upcoming games, MYHockey Rankings link, suggest a better MYHockey link |
| **Schedule** | Upcoming/results by day, scores, venues, LiveBarn |
| **Game detail** | Score, rink, game code, live refresh, GameSheet box score (embedded or opened), LiveBarn, Alliance game page |
| **Settings** | Install app, light/dark, last updated + refresh, divisions tracked, saved teams, share, app version, contact, report a bug |

**Divisions:** U10–U18 AAA, AA-A and BB (24 divisions, scores + standings), plus U8–U9 MD (schedule only, weekly). TCHL rec is excluded.

## How it works

```
alliancehockey.com ──┐
theonedb.com ────────┴─► GitHub Actions collector ─► public/data/*.json ─► GitHub Pages ─► phone
                               (Node + cheerio)          (committed)          (static PWA)
```

- **Collector** (`collector/`) reads public pages only, one at a time, 10 s apart: alliancehockey.com (standings, this month's games, GameSheet links; no `?` query URLs, per its robots.txt) and theonedb.com (full-season schedules). GameSheet and MYHockey Rankings block automated reads, so the app links to (or embeds) their pages. Data files are only rewritten when their content changes, so quiet runs publish nothing. Team logos are saved once into `public/logos/`.
- **Data** is plain JSON in `public/data/`: `meta.json`, `teams.json`, `standings/{division}.json`, `games/{division}.json`, `onedb-groups.json`, `mhr-links.json` (MYHockey team ids, matched by hand; see `docs/mhr-matching.md`).
- **App** (`src/`) is React + Vite, no server. Search runs on the phone.

### Update schedule (`.github/workflows/update-data.yml`)

| Run | When (Toronto) | Does |
|---|---|---|
| Live | Sat/Sun every 20 min, 7 AM–midnight; weekdays every 30 min, 5 PM–midnight | Only divisions with games due; scores, standings, box scores. Exits early if nothing is due. |
| Full | Nightly ~3–4 AM | All schedules + standings, box-score backfill (newest first) |
| Weekly | Monday ~5 AM | MD schedules |

A full sync that parses nothing fails instead of publishing empty data.

## First run

1. Create the repo and push (Settings → Pages → Source: **GitHub Actions**).
2. Actions → **Capture sample pages** → Run. This saves real pages to `fixtures/` and runs `npm test` against them.
3. Fix any parser checks that fail (the parsers were written from rendered content, not raw HTML).
4. Actions → **Update data and publish** → Run with mode `full`.

## MYHockey Rankings links

`public/data/mhr-links.json` maps an app team id (`{division}:{team-slug}`) to its MYHockey team id. See `docs/mhr-matching.md` for how they were matched and which teams are still missing. Parents can suggest a link by email from the team page.

## Tests

- `npm test`: parser checks against real pages saved in `fixtures/`.
- `npm run test:screens`: builds the app and clicks through the main screens in a headless browser. Runs automatically before every app publish.

## Local development

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # parser checks (needs fixtures/)
```
