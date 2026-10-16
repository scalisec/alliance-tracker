import { useState } from 'react';
import { fmtWhen, isPast } from './data.js';

// ---------- icons ----------
const I = ({ d, size = 22, sw = 1.8, fill = 'none' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);
export const Icon = {
  home: (p) => <I {...p} d={<><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h5v-6h4v6h5V9.5" /></>} />,
  list: (p) => <I {...p} d={<><path d="M8 6h13M8 12h13M8 18h13" /><path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" strokeWidth="3" /></>} />,
  cal: (p) => <I {...p} d={<><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>} />,
  gear: (p) => <I {...p} d={<><circle cx="12" cy="12" r="3.2" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></>} />,
  back: (p) => <I {...p} d={<path d="M15 5l-7 7 7 7" />} />,
  chev: (p) => <I {...p} d={<path d="M9 5l7 7-7 7" />} />,
  pin: (p) => <I size={14} {...p} d={<><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21Z" /><circle cx="12" cy="10" r="2.3" /></>} />,
  search: (p) => <I size={18} {...p} d={<><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></>} />,
  x: (p) => <I size={18} {...p} d={<path d="M6 6l12 12M18 6 6 18" />} />,
  share: (p) => <I size={18} {...p} d={<><circle cx="18" cy="5.5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="18.5" r="2.5" /><path d="m8.2 10.8 7.6-4.1M8.2 13.2l7.6 4.1" /></>} />,
  refresh: (p) => <I size={18} {...p} d={<><path d="M20 11a8 8 0 0 0-14.3-4.9L4 8" /><path d="M4 3.5V8h4.5" /><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16" /><path d="M20 20.5V16h-4.5" /></>} />,
  plus: (p) => <I size={16} {...p} d={<path d="M12 5v14M5 12h14" />} />,
};

// ---------- branding ----------
const LOGO_SOURCES = ['assets/alliance-logo.png', 'https://alliancehockey.com/domains/alliancehockey.com/logo.png'];
export function BrandMark({ size = 26 }) {
  const [i, setI] = useState(0);
  if (i >= LOGO_SOURCES.length) return <span className="brand-fallback" style={{ width: size, height: size }}>A</span>;
  return <img className="brand-mark" style={{ width: size, height: size }} src={LOGO_SOURCES[i]} alt="ALLIANCE Hockey" onError={() => setI(i + 1)} />;
}

// ---------- team logo ----------
const PALETTE = ['#043b83', '#b3261e', '#0f766e', '#7c3aed', '#b45309', '#1d4ed8', '#be185d', '#15803d', '#475569'];
const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const initials = (n) => n.replace(/\b(Jr|the)\b\.?/gi, '').replace(/[^\w\s-]/g, '').split(/[\s-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

export function TeamLogo({ name = '', logo, size = 44 }) {
  const [broken, setBroken] = useState(false);
  if (logo && !broken) return <img className="logo" src={logo} alt="" width={size} height={size} loading="lazy" onError={() => setBroken(true)} />;
  return (
    <span className="logo-fallback" style={{ width: size, height: size, fontSize: size * 0.36, background: PALETTE[hash(name) % PALETTE.length] }}>
      {initials(name) || '?'}
    </span>
  );
}

// ---------- controls ----------
export function Select({ value, onChange, options, label }) {
  return (
    <label className="select">
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o.value ?? o} value={o.value ?? o} disabled={o.disabled}>{o.label ?? o}</option>)}
      </select>
    </label>
  );
}

export function Seg({ value, onChange, options }) {
  return (
    <div className="seg" role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} className={value === o.value ? 'on' : ''} disabled={o.disabled} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

export function Top({ left, title, right }) {
  return (
    <header className="top">
      <div className="left">{left}</div>
      <h1>{title}</h1>
      <div className="right">{right}</div>
    </header>
  );
}

export function Sheet({ onClose, children }) {
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true">
        <div className="grab" />
        {children}
      </div>
    </>
  );
}

// ---------- game card ----------
export function GameCard({ game: g, logoOf, mine = [], onOpen }) {
  const final = g.status === 'final' && g.homeScore != null;
  const past = isPast(g);
  const homeWin = final && g.homeScore > g.awayScore;
  const awayWin = final && g.awayScore > g.homeScore;
  const Tag = onOpen && final ? 'button' : 'div';
  return (
    <Tag className={`game ${final ? 'final' : ''}`} onClick={onOpen && final ? () => onOpen(g) : undefined}>
      <div className="game-top">
        <span className="game-when">{fmtWhen(g.start)}</span>
        {g.status === 'cancelled' ? <span className="badge pending">CANCELLED</span>
          : final ? <span className="badge final">FINAL</span>
          : past ? <span className="badge pending">AWAITING SCORE</span>
            : <span className="badge upcoming">UPCOMING</span>}
      </div>
      <div className="game-body">
        <Side name={g.away} logo={logoOf(g.away)} win={awayWin} mine={mine.includes(g.away)} />
        {final ? (
          <div className="score">
            <span className={awayWin ? '' : 'lose'}>{g.awayScore}</span>
            <span className="dash">–</span>
            <span className={homeWin ? '' : 'lose'}>{g.homeScore}</span>
          </div>
        ) : <span className="at">@</span>}
        <Side name={g.home} logo={logoOf(g.home)} win={homeWin} mine={mine.includes(g.home)} />
      </div>
      <div className="game-foot">
        <span className="venue"><Icon.pin /><span>{g.venue ?? 'Venue TBA'}</span></span>
        {g.liveBarn && (
          <a className="lb" href={g.liveBarn} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>LiveBarn</a>
        )}
      </div>
    </Tag>
  );
}

function Side({ name, logo, win, mine }) {
  return (
    <div className={`side ${win ? 'win' : ''} ${mine ? 'mine' : ''}`}>
      <TeamLogo name={name ?? '?'} logo={logo} size={46} />
      <span className="tn">{name ?? 'TBD'}</span>
    </div>
  );
}

export function Empty({ title, children, action }) {
  return (
    <div className="empty">
      <div className="puck" />
      {title && <h2>{title}</h2>}
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}
