// Erzeugt das App-Symbol als SVG und PNG – ohne Bibliothek.
// Aufruf: node scripts/make-icons.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'icons');
mkdirSync(outDir, { recursive: true });

// Geometrie im 512er-Raster: ein Schnapsglas mit Getränk und Bläschen
const BG_FROM = '#7048e8';
const BG_TO = '#e64980';
const glass = [[168, 124], [344, 124], [308, 392], [204, 392]];
const inner = [[188, 142], [324, 142], [298, 372], [214, 372]];
const level = 200;
const edgeX = (a, b, y) => a[0] + ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]);
const liquid = [
  [edgeX(inner[0], inner[3], level), level],
  [edgeX(inner[1], inner[2], level), level],
  inner[2],
  inner[3],
];
const bubbles = [[236, 300, 14], [278, 262, 10], [262, 338, 8]];

const COLORS = { glass: '#ffffff', air: '#f3d9fa', liquid: '#fcc419', bubble: '#fff3bf' };

// ---------- SVG ----------
const pts = (poly) => poly.map(([x, y]) => `${round(x)},${round(y)}`).join(' ');
const round = (n) => Math.round(n * 100) / 100;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${BG_FROM}"/>
      <stop offset="1" stop-color="${BG_TO}"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  <polygon points="${pts(glass)}" fill="${COLORS.glass}"/>
  <polygon points="${pts(inner)}" fill="${COLORS.air}"/>
  <polygon points="${pts(liquid)}" fill="${COLORS.liquid}"/>
${bubbles.map(([x, y, r]) => `  <circle cx="${x}" cy="${y}" r="${r}" fill="${COLORS.bubble}"/>`).join('\n')}
</svg>
`;
writeFileSync(join(outDir, 'icon.svg'), svg);

// ---------- Rasterisierung ----------
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const C = Object.fromEntries(Object.entries(COLORS).map(([k, v]) => [k, hex(v)]));
const bgA = hex(BG_FROM);
const bgB = hex(BG_TO);

function inConvex(poly, x, y) {
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    const cross = (x2 - x1) * (y - y1) - (y2 - y1) * (x - x1);
    if (cross !== 0) {
      const s = Math.sign(cross);
      if (sign && s !== sign) return false;
      sign = s;
    }
  }
  return true;
}

function colorAt(x, y) {
  for (const [cx, cy, r] of bubbles) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) return C.bubble;
  if (inConvex(liquid, x, y)) return C.liquid;
  if (inConvex(inner, x, y)) return C.air;
  if (inConvex(glass, x, y)) return C.glass;
  const t = (x + y) / 1024;
  return bgA.map((a, i) => a + (bgB[i] - a) * t);
}

function render(size) {
  const SS = 4; // 4×4 Abtastpunkte pro Pixel für glatte Kanten
  const scale = 512 / size;
  const px = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let pxx = 0; pxx < size; pxx++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const c = colorAt((pxx + (sx + 0.5) / SS) * scale, (py + (sy + 0.5) / SS) * scale);
          r += c[0]; g += c[1]; b += c[2];
        }
      }
      const o = (py * size + pxx) * 4;
      px[o] = Math.round(r / (SS * SS));
      px[o + 1] = Math.round(g / (SS * SS));
      px[o + 2] = Math.round(b / (SS * SS));
      px[o + 3] = 255;
    }
  }
  return png(size, size, px);
}

// ---------- PNG-Kodierung ----------
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(w, h, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(w, 0);
  header.writeUInt32BE(h, 4);
  header[8] = 8; // Bit-Tiefe
  header[9] = 6; // RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Das Motiv liegt komplett in der sicheren Zone, darum dient dasselbe Bild auch als „maskable“.
const files = { 'apple-touch-icon.png': 180, 'icon-192.png': 192, 'icon-512.png': 512, 'maskable-512.png': 512 };
for (const [name, size] of Object.entries(files)) {
  writeFileSync(join(outDir, name), render(size));
  console.log(`icons/${name} (${size}×${size})`);
}
console.log('icons/icon.svg');
