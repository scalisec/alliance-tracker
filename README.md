# Alliance Tracker — old address forwarding

These files go in a small repo named `alliance-tracker` on the personal GitHub account
(scalisec), published with GitHub Pages, after the app moved to
https://bench-boss-labs.github.io/alliance-tracker/.

- `index.html` / `404.html`: forward any old link (including deep links like `#/team/...`)
  to the new address, carrying the phone's saved teams, theme and division in the
  `#/import?d=...` part of the link (stays on the phone). The new app merges them in.
- `sw.js`: replaces the old app's service worker, clears its cache and removes itself, so
  installed home-screen apps load the forwarding page instead of an old cached copy.
