# Alliance Tracker

Unofficial standings, scores and schedules for **Minor Hockey Alliance of Ontario** rep divisions, modelled on [OWHA Tracker](https://owhatracker.app/). An installable phone web app, hosted free on GitHub Pages.

> Unofficial community app. Not affiliated with or endorsed by ALLIANCE Hockey, GameSheet Inc. or MYHockey Rankings. All data and logos belong to their owners.

## Features

| Screen | What it shows |
|---|---|
| **My Teams** | Saved teams (stored on the phone): GP/W/L/T/GF/GA/PTS, division place, MHR rating, last result, next 3 games, LiveBarn links, "Full division" |
| **Find my team** | Search by city, association, team or division; add/remove |
| **Standings** | Age + level pickers, regular season/playoffs, grouped tables with GD, your teams highlighted |
| **Schedule** | Upcoming/results by day, scores, venues, LiveBarn |
| **Game detail** | Score, rink, game code, "Full box score" (opens GameSheet), LiveBarn, Alliance game page |
| **Settings** | Light/dark, last updated + refresh, divisions tracked, clear saved teams, share, about |

**Divisions:** U10–U18 AAA, AA-A and BB (24 divisions, scores + standings), plus U8–U9 MD (schedule only, weekly). TCHL rec is excluded.

## How it works

```
alliancehockey.com ──┐
theonedb.com ───────┼─► GitHub Actions collector ─► public/data/*.json ─► GitHub Pages ─► phone
myhockeyrankings.com ┘        (Node + cheerio)          (committed)          (static PWA)
```

- **Collector** (`collector/`) reads public pages only, one at a time, 10 s apart: alliancehockey.com (standings, this month's games, GameSheet links; no `?` query URLs, per its robots.txt) and theonedb.com (full-season schedules). GameSheet blocks automated reads, so box scores open on GameSheet.
- **Data** is plain JSON in `public/data/`: `meta.json`, `teams.json`, `standings/{division}.json`, `games/{division}.json`, `detail/{game}.json`, `mhr.json`.
- **App** (`src/`) is React + Vite, no server. Search runs on the phone.

### Update schedule (`.github/workflows/update-data.yml`)

| Run | When (Toronto) | Does |
|---|---|---|
| Live | Sat/Sun every 20 min, 7 AM–midnight; weekdays every 30 min, 5 PM–midnight | Only divisions with games due; scores, standings, box scores. Exits early if nothing is due. |
| Full | Nightly ~3–4 AM | All schedules + standings, box-score backfill (newest first) |
| Weekly | Monday ~5 AM | MD schedules, MHR ratings |

A full sync that parses nothing fails instead of publishing empty data.

## First run

1. Create the repo and push (Settings → Pages → Source: **GitHub Actions**).
2. Actions → **Capture sample pages** → Run. This saves real pages to `fixtures/` and runs `npm test` against them.
3. Fix any parser checks that fail (the parsers were written from rendered content, not raw HTML).
4. Actions → **Update data and publish** → Run with mode `full`. Sample data is cleared automatically.

Until step 4, the app shows clearly-labelled sample data (`npm run sample`).

## MHR ratings

`data-overrides/mhr-teams.json` maps an Alliance team id (`{division}:{team-slug}`) to its MYHockey Rankings team id. Ratings appear once teams have played enough games.

## Local development

```bash
npm install
npm run sample   # sample data
npm run dev      # http://localhost:5173
npm test         # parser checks (needs fixtures/)
```
