// Dependency-free PNG icon generator (uses Node built-in zlib only).
// Reproduces the favicon.svg design (green rounded doc + white lines) as PNGs
// at the sizes PWA / PWABuilder require: 512, 192, and a maskable 512.
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

// ---- PNG encoder (RGBA, 8-bit) ----
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return (~c) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}
function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  const raw = Buffer.alloc(height * (1 + width * 4));
  let p = 0;
  for (let y = 0; y < height; y++) {
    raw[p++] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      raw[p++] = rgba[i];
      raw[p++] = rgba[i + 1];
      raw[p++] = rgba[i + 2];
      raw[p++] = rgba[i + 3];
    }
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- Shape geometry (normalized 0..1 coords derived from favicon.svg) ----
const GREEN = [22, 163, 74];      // #16a34a
const WHITE = [255, 255, 255];

// doc  x 0.281..0.75, y 0.188..0.812  -> rect
const DOC = { cx: 0.5156, cy: 0.5, w: 0.469, h: 0.625, r: 0.05 };
// rounded-corner background rect
const BG = { x0: 0.02, y0: 0.02, x1: 0.98, y1: 0.98, r: 0.22 };
// lines: y centers and x extents (normalized), thickness 0.0625, round caps
const LINES = [
  { y: 0.469, x0: 0.375, x1: 0.656 },
  { y: 0.578, x0: 0.375, x1: 0.656 },
  { y: 0.688, x0: 0.375, x1: 0.547 },
];

function pointInRoundedRect(px, py, cx, cy, w, h, r) {
  const dx = Math.abs(px - cx) - (w / 2 - r);
  const dy = Math.abs(py - cy) - (h / 2 - r);
  if (dx <= 0 && dy <= 0) return true;
  const ax = Math.max(dx, 0);
  const ay = Math.max(dy, 0);
  return ax * ax + ay * ay <= r * r;
}
function inBgRect(px, py, maskable) {
  if (maskable) return true; // full-bleed for maskable
  return pointInRoundedRect(px, py, 0.5, 0.5, BG.x1 - BG.x0, BG.y1 - BG.y0, BG.r);
}
// distance from point to a horizontal segment with round caps
function lineCoverage(px, py, lx0, lx1, ly, th) {
  const nx = Math.min(Math.max(px, lx0), lx1);
  const dx = px - nx;
  const dy = py - ly;
  const d = Math.hypot(dx, dy);
  return Math.max(0, Math.min(1, (th / 2 - d) + 0.5)); // soft edge
}
function docCoverage(px, py) {
  // approximate rounded-rect coverage via distance to true rounded rect
  const { cx, cy, w, h, r } = DOC;
  const halfW = w / 2 - r, halfH = h / 2 - r;
  const qx = Math.abs(px - cx) - halfW;
  const qy = Math.abs(py - cy) - halfH;
  let d;
  if (qx > 0 && qy > 0) d = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - r;
  else if (qx > 0) d = qx - r;
  else d = qy - r;
  return Math.max(0, Math.min(1, 0.5 - d / 1.0));
}

function shapeAt(px, py, maskable) {
  // returns [r,g,b,a]
  const bgAlpha = inBgRect(px, py, maskable) ? 1 : 0;
  const inDoc = docCoverage(px, py) > 0.5;
  if (inDoc) {
    let line = null;
    for (const L of LINES) {
      const cov = lineCoverage(px, py, L.x0, L.x1, L.y, 0.0625);
      if (cov > 0.5) { line = 0.5; break; }
    }
    if (line !== null) return [...GREEN, 255];
    return [255, 255, 255, 255];
  }
  return bgAlpha > 0.5 ? [GREEN[0], GREEN[1], GREEN[2], 255] : [0, 0, 0, 0];
}

function render(size, maskable) {
  const SS = 3; // supersampling
  const rgba = Buffer.alloc(size * size * 4);
  const colors = { r: 0, g: 0, b: 0, a: 0 };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let R = 0, G = 0, B = 0, A = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = (x + (sx + 0.5) / SS) / size;
          const py = (y + (sy + 0.5) / SS) / size;
          const c = shapeAt(px, py, maskable);
          // straight alpha compositing
          const a = c[3] / 255;
          R += c[0] * a; G += c[1] * a; B += c[2] * a; A += a;
        }
      }
      const n = SS * SS;
      const i = (y * size + x) * 4;
      rgba[i] = Math.round(R / n);
      rgba[i + 1] = Math.round(G / n);
      rgba[i + 2] = Math.round(B / n);
      rgba[i + 3] = Math.round((A / n) * 255);
    }
  }
  return encodePNG(size, size, rgba);
}

writeFileSync('public/icon-512.png', render(512, false));
writeFileSync('public/icon-192.png', render(192, false));
writeFileSync('public/icon-512-maskable.png', render(512, true));
console.log('Generated icon-512.png, icon-192.png, icon-512-maskable.png');
