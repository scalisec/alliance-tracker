// Splash: index.html shows it immediately; fade it once the app has data
// (at least ~0.8 s so the logo registers, at most 3 s if the network is slow).
const shownAt = performance.now();
export function hideSplash() {
  const el = document.getElementById('splash');
  if (!el || el.classList.contains('hide')) return;
  const wait = Math.max(0, 800 - (performance.now() - shownAt));
  setTimeout(() => { el.classList.add('hide'); setTimeout(() => el.remove(), 400); }, wait);
}
setTimeout(hideSplash, 3000);
