import { mhrSuggestionUrl } from './contact.js';

// MYHockey Rankings links. MHR blocks being shown inside other apps and blocks
// automated lookups, so the app links out. Team IDs are matched by hand in
// public/data/mhr-links.json; unmatched teams fall back to their club's page.
export function mhrLink(team, links) {
  if (!team) return null;
  const year = links?.season ? `y=${links.season}&` : '';
  const t = links?.teams?.[team.id];
  if (t) return { url: `https://myhockeyrankings.com/team-info?${year}t=${t}`, exact: true };
  const a = team.association ? links?.associations?.[team.association] : null;
  if (a) return { url: `https://myhockeyrankings.com/association-info?a=${a}`, exact: false };
  return { url: 'https://myhockeyrankings.com/', exact: false };
}

// Card on the team page, with a way to suggest a (better) link by email.
export function MhrCard({ team, links }) {
  const link = mhrLink(team, links);
  return (
    <>
      <a className="card mhr-link" href={link.url} target="_blank" rel="noopener noreferrer">
        <span className="grow">
          <span className="mhr-title">MYHockey Rankings</span>
          <span className="mhr-sub">{link.exact ? 'Rating, rank and stats' : team.association ? `Find the team on the ${team.association} page` : 'Search for the team on MYHockey'}</span>
        </span>
        <span className="mhr-open">Open ↗</span>
      </a>
      <a className="mhr-suggest" href={mhrSuggestionUrl(team)}>
        {link.exact ? 'Wrong team? Send us the right MYHockey link' : 'Know this team’s MYHockey page? Send us the link'}
      </a>
    </>
  );
}
