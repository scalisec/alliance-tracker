# MYHockey Rankings team links

The app links each team to its MYHockey Rankings page. MYHockey blocks automated
lookups (GitHub and Claude's own tools get a security challenge), so the IDs are
matched once by hand and stored in `public/data/mhr-links.json`.

## How the match was done (2026-10-21)

1. In a normal browser (Claude in Chrome), open MYHockey's Alliance league page:
   `https://myhockeyrankings.com/league-info?l=204` (MHAO). It lists one page per
   division (U10 BB/B East and West, U12 AA/A, ...).
2. Read each division page at a normal pace and list team name + team ID (`t=`).
3. Match each Alliance team by division and exact name (ignoring "Jr", dots,
   hyphens and brackets). Unique exact matches are added automatically.
4. Close calls are decided only when there is one possible team; anything else is
   checked with Cristian.

Result: 304 of 316 rep teams linked. U8/U9 MD teams aren't on MYHockey.

Name differences decided by hand: "Sault Major Jr Greyhounds" = MHR "Soo Jr
Greyhounds"; "Cambridge Jr RedHawks" U16 AAA = MHR "Cambridge Hawks"; Burlington
Raiders U11 BB = MHR 32807. Burlington Raiders U10 BB = MHR 40348 (confirmed by
Cristian on 2026-10-22; MYHockey files it under its U11 BB/B division).

## Still to match (re-check later in the season)

**U10 BB:** Woodstock Jr Navy Vets, Dresden Jr Kings, Lambeth Lancers, Mooretown Jr Flags, Lambton Shores
Predators, Elgin-Thames 73s, Petrolia Oilers, South Kent Lightning, Mt Brydges
Cougars, St Thomas Jr Stars.

**U16 AAA:** NOHA Red, NOHA Black.

The same list is in `mhr-links.json` under `unmatched`. When re-checking, also
look for teams that were renamed or added since.
