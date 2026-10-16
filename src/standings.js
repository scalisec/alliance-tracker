// Standings pages can hold several rounds (e.g. a second half that hasn't
// started). Show the groups that have games; if none do yet, show them all.
// Unnamed groups get "Group 1, Group 2…" labels when there is more than one.
export function activeGroups(groups) {
  if (!groups?.length) return [];
  const played = groups.filter((g) => g.rows.some((r) => r.gp > 0));
  const list = played.length ? played : groups;
  const unnamed = list.length > 1 && list.every((g) => !g.name);
  return unnamed ? list.map((g, i) => ({ ...g, name: `Group ${i + 1}` })) : list;
}
