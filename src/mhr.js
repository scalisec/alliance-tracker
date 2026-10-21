// MYHockey Rankings link for a team. MHR blocks being shown inside other apps
// and blocks automated lookups, so team IDs are added by hand in
// public/data/mhr-links.json and we open MHR in the browser.
export function mhrLink(team, links) {
  if (!team || !links) return null;
  const year = links.season ? `y=${links.season}&` : '';
  const t = links.teams?.[team.id];
  if (t) return { url: `https://myhockeyrankings.com/team-info?${year}t=${t}`, exact: true };
  const a = team.association ? links.associations?.[team.association] : null;
  if (a) return { url: `https://myhockeyrankings.com/association-info?a=${a}`, exact: false };
  return null;
}
