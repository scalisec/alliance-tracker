// Data access: static JSON files produced by the collector (public/data/).
// meta.json is always fetched fresh; everything else is versioned by
// meta.updatedAt so phones pick up new data without stale caches.
import { useEffect, useState } from 'react';

const cache = new Map();
let version = '0';

export async function loadMeta(force = false) {
  const res = await fetch(`data/meta.json?t=${Date.now()}`, { cache: 'no-store' });
  const meta = await res.json();
  if (force || meta.updatedAt !== version) cache.clear();
  version = meta.updatedAt ?? '0';
  return meta;
}

export function getJson(rel) {
  if (!cache.has(rel)) {
    const p = fetch(`data/${rel}?v=${encodeURIComponent(version)}`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    cache.set(rel, p);
  }
  return cache.get(rel);
}

export function useJson(rel, deps = []) {
  const [state, setState] = useState({ data: null, loading: !!rel });
  useEffect(() => {
    let alive = true;
    if (!rel) { setState({ data: null, loading: false }); return; }
    setState((s) => ({ data: s.data, loading: true }));
    getJson(rel).then((data) => alive && setState({ data, loading: false }));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rel, ...deps]);
  return state;
}

export function useMany(rels, deps = []) {
  const key = rels.join('|');
  const [data, setData] = useState(null);
  useEffect(() => {
    let alive = true;
    Promise.all(rels.map(getJson)).then((d) => alive && setData(d));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ...deps]);
  return data;
}

// ---------- formatting ----------
const TZ = 'America/Toronto';
export const fmtDay = (iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric' });
export const fmtTime = (iso) => new Date(iso).toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' });
export const fmtWhen = (iso) => (iso ? `${fmtDay(iso)} · ${fmtTime(iso)}` : 'Time TBA');
export const fmtLongDay = (iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ, weekday: 'long', month: 'long', day: 'numeric' });
export const dayKey = (iso) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(iso));

export function ago(iso) {
  if (!iso) return 'never';
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

// A game counts as "live" from puck drop until this many minutes later
// (rep slots run ~60–80 min). After that, unscored games await their score.
export const LIVE_MINUTES = 90;

export function gameState(g, { scored = true, now = Date.now() } = {}) {
  if (g.status === 'cancelled') return 'cancelled';
  if (g.status === 'final' && g.homeScore != null) return 'final';
  if (!g.start) return 'upcoming';
  const mins = (now - Date.parse(g.start)) / 60000;
  if (mins < 0) return 'upcoming';
  if (mins < LIVE_MINUTES) return 'live';
  return scored ? 'awaiting' : 'played';
}

export const isPast = (g) => g.status === 'final' || (g.start && Date.parse(g.start) < Date.now() - LIVE_MINUTES * 60000);
