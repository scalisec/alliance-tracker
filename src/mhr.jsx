// MYHockey Rankings. MHR blocks being shown inside other apps and blocks
// automated lookups, so the app links out, and each person can type in their
// team's rating (and paste their team's MHR link). That is saved on their
// phone only (localStorage), so they only need to do it once per update.
import { useEffect, useState } from 'react';
import { Sheet } from './ui.jsx';

const KEY = 'at.mhr';
const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) ?? {}; } catch { return {}; } };
let store = read();
const listeners = new Set();
function save(next) {
  store = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode */ }
  listeners.forEach((f) => f());
}

export function useMhrLocal(teamId) {
  const [entry, setEntry] = useState(store[teamId] ?? null);
  useEffect(() => {
    const fn = () => setEntry(store[teamId] ?? null);
    fn(); listeners.add(fn); return () => listeners.delete(fn);
  }, [teamId]);
  const update = (patch) => save({ ...store, [teamId]: { ...(store[teamId] ?? {}), ...patch } });
  const clear = () => { const { [teamId]: _, ...rest } = store; save(rest); };
  return [entry, update, clear];
}

const teamIdFromUrl = (s) => { const m = /myhockeyrankings\.com\/team[-_]info[^\s]*[?&]t=(\d+)/i.exec(s ?? ''); return m ? Number(m[1]) : null; };

// Where "Open" goes: the person's own pasted link, then our list, then the association page.
export function mhrLink(team, links, local) {
  if (!team) return null;
  const year = links?.season ? `y=${links.season}&` : '';
  const t = local?.mhrId ?? links?.teams?.[team.id];
  if (t) return { url: `https://myhockeyrankings.com/team-info?${year}t=${t}`, exact: true };
  const a = team.association ? links?.associations?.[team.association] : null;
  if (a) return { url: `https://myhockeyrankings.com/association-info?a=${a}`, exact: false };
  return { url: `https://myhockeyrankings.com/`, exact: false };
}

const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });

export function MhrChip({ entry }) {
  if (!entry?.rating) return null;
  return <span className="mhr-chip">MHR <b>{Number(entry.rating).toFixed(2)}</b>{entry.rank ? ` · #${entry.rank}` : ''}</span>;
}

// Card on the team page: saved rating, Open and Update.
export function MhrCard({ team, links }) {
  const [entry, update, clear] = useMhrLocal(team.id);
  const [editing, setEditing] = useState(false);
  const link = mhrLink(team, links, entry);
  return (
    <section className="card mhr-card">
      <div className="mhr-row">
        <div className="grow">
          <div className="mhr-title">MYHockey Rankings</div>
          <div className="mhr-sub">
            {entry?.rating
              ? <>Rating <b>{Number(entry.rating).toFixed(2)}</b>{entry.rank ? <> · Rank <b>#{entry.rank}</b></> : null} · as of {fmtDate(entry.updatedAt)}</>
              : link.exact ? 'Open to see the rating, then tap Update to save it here' : 'Open MYHockey, find the team, then tap Update'}
          </div>
        </div>
      </div>
      <div className="mhr-actions">
        <a className="mhr-btn" href={link.url} target="_blank" rel="noopener noreferrer">Open MYHockey ↗</a>
        <button className="mhr-btn solid" onClick={() => setEditing(true)}>{entry?.rating ? 'Update' : 'Add rating'}</button>
      </div>
      {editing && <MhrEdit team={team} entry={entry} needLink={!link.exact} onSave={(v) => { update(v); setEditing(false); }} onClear={() => { clear(); setEditing(false); }} onClose={() => setEditing(false)} />}
    </section>
  );
}

function MhrEdit({ team, entry, needLink, onSave, onClear, onClose }) {
  const [rating, setRating] = useState(entry?.rating ?? '');
  const [rank, setRank] = useState(entry?.rank ?? '');
  const [url, setUrl] = useState('');
  const pastedId = teamIdFromUrl(url);
  const ok = rating === '' || (Number(rating) > 0 && Number(rating) < 100);
  const submit = (e) => {
    e.preventDefault();
    if (!ok) return;
    onSave({
      rating: rating === '' ? null : Number(rating),
      rank: rank === '' ? null : Number(rank),
      ...(pastedId ? { mhrId: pastedId } : {}),
      updatedAt: new Date().toISOString(),
    });
  };
  return (
    <Sheet onClose={onClose}>
      <form onSubmit={submit} className="mhr-form">
        <div className="sheet-head"><h2>MYHockey rating</h2><button type="button" className="link-btn" onClick={onClose}>Cancel</button></div>
        <p className="legend">{team.name}. Copy the numbers from MYHockey Rankings. They're saved on this phone only.</p>
        <label>Rating<input inputMode="decimal" placeholder="e.g. 84.32" value={rating} onChange={(e) => setRating(e.target.value.replace(',', '.'))} /></label>
        <label>Rank (optional)<input inputMode="numeric" placeholder="e.g. 57" value={rank} onChange={(e) => setRank(e.target.value.replace(/\D/g, ''))} /></label>
        {needLink && (
          <label>Your team's MYHockey link (optional)
            <input inputMode="url" placeholder="Paste the team page link" value={url} onChange={(e) => setUrl(e.target.value)} />
            <span className={`hint ${url && !pastedId ? 'bad' : ''}`}>{url ? (pastedId ? 'Got it. Open will go straight to your team.' : "That doesn't look like a MYHockey team link.") : 'So Open goes straight to your team next time.'}</span>
          </label>
        )}
        {!ok && <p className="hint bad">Ratings are between 0 and 100.</p>}
        <button className="primary" type="submit" disabled={!ok}>Save</button>
        {entry && <button type="button" className="link-btn danger" onClick={onClear}>Remove saved rating</button>}
      </form>
    </Sheet>
  );
}
