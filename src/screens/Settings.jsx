import { useState } from 'react';
import { ago } from '../data.js';
import { useSaved, useTheme } from '../store.js';
import { BrandMark, Icon, Sheet } from '../ui.jsx';
import InstallCard from './InstallCard.jsx';
import { CONTACT_EMAIL, bugReportUrl, mailto } from '../contact.js';

/* global __BUILD__ */
// e.g. "Oct 17, 1:52 PM · 811b1a5"
function buildLabel() {
  try {
    const t = new Date(__BUILD__.time).toLocaleString('en-US', { timeZone: 'America/Toronto', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    return `${t} · ${__BUILD__.sha}`;
  } catch { return 'dev'; }
}

export default function Settings({ ctx, onClose, onRefresh }) {
  const [theme, setTheme] = useTheme();
  const { saved, clear } = useSaved();
  const [busy, setBusy] = useState(false);
  const scored = ctx.divisions.filter((d) => d.scored).length;
  const md = ctx.divisions.filter((d) => !d.scored).length;

  const share = async () => {
    const data = { title: 'Alliance Tracker', text: 'Standings, scores and schedules for ALLIANCE Hockey rep teams', url: location.href.split('#')[0] };
    try {
      if (navigator.share) await navigator.share(data);
      else { await navigator.clipboard.writeText(data.url); alert('Link copied'); }
    } catch { /* cancelled */ }
  };

  return (
    <Sheet onClose={onClose}>
      <div className="sheet-head">
        <h2>Settings</h2>
        <button className="icon-btn" aria-label="Close" onClick={onClose}><Icon.x /></button>
      </div>

      <div className="section-label">Install</div>
      <InstallCard />

      <div className="section-label">Appearance</div>
      <div className="card set">
        <div className="set-row">
          <div><div className="lbl">Theme</div><div className="hint">Choose your preferred display</div></div>
          <div className="pill-toggle">
            {['light', 'dark'].map((t) => <button key={t} className={theme === t ? 'on' : ''} onClick={() => setTheme(t)}>{t[0].toUpperCase() + t.slice(1)}</button>)}
          </div>
        </div>
      </div>

      <div className="section-label">Data</div>
      <div className="card set">
        <div className="set-row">
          <div><div className="lbl">Last updated</div><div className="hint">{ago(ctx.meta?.updatedAt)}</div></div>
          <div className="val" style={{ fontSize: 12 }}>Every 20–30 min on game days</div>
        </div>
        <div className="set-row">
          <button className="link-btn" disabled={busy} onClick={async () => { setBusy(true); await onRefresh(); setBusy(false); }}>
            <Icon.refresh /> {busy ? 'Refreshing…' : 'Refresh now'}
          </button>
        </div>
      </div>

      <div className="section-label">Season</div>
      <div className="card set">
        <div className="set-row"><div className="lbl">Current season</div><div className="val">{ctx.meta?.season?.replace('-', '–')}</div></div>
        <div className="set-row">
          <div className="lbl">Divisions tracked</div>
          <div className="val">U10–U18 AAA · AA-A · BB ({scored})<br />U8–U9 MD, weekly ({md})</div>
        </div>
      </div>

      <div className="section-label">My teams</div>
      <div className="card set">
        <div className="set-row"><div className="lbl">Saved teams</div><div className="val">{saved.length} {saved.length === 1 ? 'team' : 'teams'}</div></div>
        {saved.length > 0 && (
          <div className="set-row"><button className="danger" onClick={() => confirm('Remove all saved teams?') && clear()}>Clear all saved teams</button></div>
        )}
      </div>

      <div className="section-label">Share</div>
      <div className="card set">
        <div className="set-row"><button className="link-btn" onClick={share}>Share Alliance Tracker</button><Icon.share /></div>
      </div>

      <div className="section-label">About</div>
      <div className="card set" style={{ marginBottom: 14 }}>
        <div className="set-row">
          <div><div className="lbl">App version</div><div className="hint">Changes with every update</div></div>
          <div className="val">{buildLabel()}</div>
        </div>
      </div>
      <div className="card set">
        <div className="set-row">
          <div className="lbl" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><BrandMark size={22} /> Alliance Tracker</div>
          <div className="val">v1.1</div>
        </div>
        <p className="hint" style={{ lineHeight: 1.5 }}>
          Standings, scores and schedules for Minor Hockey Alliance of Ontario rep divisions. Data sourced from alliancehockey.com and theonedb.com. Box scores open on GameSheet; ratings on MYHockey Rankings.
        </p>
        <div className="set-row">
          <div><div className="lbl">Questions or feedback</div><div className="hint">Bench Boss Labs</div></div>
          <a className="val" href={mailto('Alliance Tracker')} style={{ color: 'var(--accent)', fontWeight: 600 }}>{CONTACT_EMAIL}</a>
        </div>
        <div className="set-row">
          <div><div className="lbl">Report a bug</div><div className="hint">Opens an email with your app version and phone type filled in</div></div>
          <a className="val" href={bugReportUrl()} style={{ color: 'var(--accent)', fontWeight: 600, whiteSpace: 'nowrap' }}>Report</a>
        </div>
        <p className="fine">
          Alliance Tracker is an unofficial community app. It is not affiliated with or endorsed by the Minor Hockey Alliance of Ontario (ALLIANCE Hockey), GameSheet Inc. or MYHockey Rankings. All data and logos remain the property of their respective owners.
        </p>
      </div>
    </Sheet>
  );
}
