// "Install app" support.
// - Android/Chromium browsers fire `beforeinstallprompt`; we keep that event so
//   a button can show the real install dialog later.
// - iOS has no install API: we detect it and show Share -> Add to Home Screen steps.
// - Already installed (running standalone): nothing to do.
import { useEffect, useState } from 'react';

let deferred = null;
const listeners = new Set();
const notify = () => listeners.forEach((f) => f());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // we show our own button instead of Chrome's mini-bar
    deferred = e;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    try { localStorage.setItem('at.installed', '1'); } catch {}
    notify();
  });
}

export function platform() {
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
  return {
    iOS,
    iOSSafari: iOS && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua),
    android: /Android/.test(ua),
    standalone,
  };
}

export function useInstall() {
  const [, force] = useState(0);
  useEffect(() => { const f = () => force((n) => n + 1); listeners.add(f); return () => listeners.delete(f); }, []);
  const p = platform();
  return {
    ...p,
    canPrompt: !!deferred,
    async prompt() {
      if (!deferred) return 'unavailable';
      deferred.prompt();
      const { outcome } = await deferred.userChoice;
      deferred = null;
      notify();
      return outcome; // 'accepted' | 'dismissed'
    },
  };
}
