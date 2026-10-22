// Polite HTTP fetcher: one request at a time per host, a fixed delay between
// requests, retries with backoff, and a guard against query-string URLs on
// alliancehockey.com (its robots.txt disallows them).
import { FETCH } from './config.js';

const lastHit = new Map();
let requestCount = 0;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function assertAllowed(url) {
  const u = new URL(url);
  if (u.hostname.endsWith('alliancehockey.com') && u.search) {
    throw new Error(`Refusing query-string URL on alliancehockey.com: ${url}`);
  }
  if (u.hostname.endsWith('gamesheetstats.com') && u.pathname.startsWith('/api/')) {
    throw new Error(`Refusing GameSheet API path (disallowed by robots.txt): ${url}`);
  }
}

export async function fetchText(url, { delayMs } = {}) {
  assertAllowed(url);
  const host = new URL(url).hostname;
  // alliancehockey.com asks for 10s; other sites get a gentler 3s default.
  delayMs ??= host.endsWith('alliancehockey.com') ? FETCH.delayMs : 3000;
  const wait = (lastHit.get(host) ?? 0) + delayMs - Date.now();
  if (wait > 0) await sleep(wait);

  let lastErr;
  for (let attempt = 0; attempt <= FETCH.retries; attempt++) {
    lastHit.set(host, Date.now());
    requestCount++;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), FETCH.timeoutMs);
      const res = await fetch(url, {
        headers: { 'User-Agent': FETCH.userAgent, Accept: 'text/html,*/*' },
        signal: ctrl.signal,
        redirect: 'follow',
      });
      clearTimeout(t);
      if (res.status === 404) return null;
      if (!res.ok) {
        const body = (await res.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 300);
        const err = new Error(`HTTP ${res.status} (server: ${res.headers.get('server') ?? '?'}; cf-mitigated: ${res.headers.get('cf-mitigated') ?? 'no'}) ${body}`);
        err.status = res.status;
        // A block page won't change on retry; stop early.
        if (res.status === 403) throw Object.assign(err, { fatal: true });
        throw err;
      }
      return await res.text();
    } catch (err) {
      lastErr = err;
      if (err.fatal) break;
      await sleep(delayMs * (attempt + 1));
    }
  }
  throw new Error(`Failed ${url}: ${lastErr?.message}`);
}

// Images (logos). Same per-host politeness and timeout as pages; only https
// images under 1 MB are accepted.
export async function fetchBinary(url, { delayMs = 3000, maxBytes = 1_000_000, timeoutMs = FETCH.timeoutMs } = {}) {
  assertAllowed(url);
  if (!url.startsWith('https://')) return null;
  const host = new URL(url).hostname;
  const wait = (lastHit.get(host) ?? 0) + delayMs - Date.now();
  if (wait > 0) await sleep(wait);
  lastHit.set(host, Date.now());
  requestCount++;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': FETCH.userAgent }, signal: ctrl.signal });
    if (!res.ok || !(res.headers.get('content-type') ?? '').startsWith('image/')) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length <= maxBytes ? buf : null;
  } catch { return null; } finally { clearTimeout(t); }
}

export const stats = () => ({ requests: requestCount });
