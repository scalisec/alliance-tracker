// Contact by email (no server needed): links open the phone's mail app with a
// pre-filled message to Bench Boss Labs.
export const CONTACT_EMAIL = 'benchbosslabs@gmail.com';

export const mailto = (subject, body = '') =>
  `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}${body ? `&body=${encodeURIComponent(body)}` : ''}`;

/* global __BUILD__ */
const version = () => { try { return `${__BUILD__.sha} (${__BUILD__.time.slice(0, 10)})`; } catch { return 'dev'; } };

export const bugReportUrl = () => mailto('Alliance Tracker: bug report', [
  'What happened?', '', '', 'What did you expect?', '', '',
  '---- please keep the details below; they help find the problem ----',
  `App version: ${version()}`,
  `Screen: ${location.hash || '#/'}`,
  `Device: ${navigator.userAgent}`,
].join('\n'));

export const mhrSuggestionUrl = (team) => mailto(`MYHockey link: ${team.name} (${team.division})`, [
  `Team: ${team.name}`,
  `Division: ${team.division}`,
  'MYHockey team page link (paste it here, it looks like https://myhockeyrankings.com/team-info?t=12345):',
  '', '',
  `---- app team id: ${team.id} ----`,
].join('\n'));
