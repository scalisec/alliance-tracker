// Small persisted state: saved teams, theme, last-viewed division.
import { useCallback, useEffect, useState } from 'react';

const read = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };

const listeners = new Set();
let saved = read('at.saved', []);

export function useSaved() {
  const [list, setList] = useState(saved);
  useEffect(() => { const fn = () => setList(saved); listeners.add(fn); return () => listeners.delete(fn); }, []);
  const set = useCallback((next) => { saved = next; write('at.saved', next); listeners.forEach((f) => f()); }, []);
  return {
    saved: list,
    isSaved: (id) => list.includes(id),
    toggle: (id) => set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]),
    clear: () => set([]),
  };
}

export function useTheme() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'dark');
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('at.theme', theme); } catch {}
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', theme === 'dark' ? '#0a0a0a' : '#f2f3f6');
  }, [theme]);
  return [theme, setTheme];
}

export function usePersisted(key, initial) {
  const [v, setV] = useState(() => read(key, initial));
  useEffect(() => write(key, v), [key, v]);
  return [v, setV];
}
