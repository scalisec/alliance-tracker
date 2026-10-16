// Builds the home-screen icons. Uses the Alliance logo (public/assets/
// alliance-logo.png, saved by the collector) centred on a dark tile; falls back
// to a simple navy "A" mark when the logo hasn't been downloaded yet.
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = path.join(ROOT, 'public', 'icons');
const logo = path.join(ROOT, 'public', 'assets', 'alliance-logo.png');
await fs.mkdir(out, { recursive: true });

const hasLogo = await fs.access(logo).then(() => true, () => false);

const fallbackSvg = (size, pad) => Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${pad ? 0 : 112}" fill="#0a0a0a"/>
  <g transform="translate(256 256) scale(${pad ? 0.72 : 0.9}) translate(-256 -256)">
    <circle cx="256" cy="256" r="190" fill="#043b83"/>
    <path d="M256 128 L346 368 H306 L288 316 H224 L206 368 H166 Z M236 282 H276 L256 222 Z" fill="#fff"/>
    <rect x="150" y="392" width="212" height="22" rx="11" fill="#d7263d"/>
  </g>
</svg>`);

async function make(size, file, maskable = false) {
  if (hasLogo) {
    const inner = Math.round(size * (maskable ? 0.62 : 0.78));
    const mark = await sharp(logo).resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    await sharp({ create: { width: size, height: size, channels: 4, background: '#0a0a0a' } })
      .composite([{ input: mark, gravity: 'center' }]).png().toFile(path.join(out, file));
  } else {
    await sharp(fallbackSvg(size, maskable)).resize(size, size).png().toFile(path.join(out, file));
  }
}

await make(192, 'icon-192.png');
await make(512, 'icon-512.png');
await make(512, 'icon-512-maskable.png', true);
console.log(`icons built (${hasLogo ? 'Alliance logo' : 'fallback mark'})`);
