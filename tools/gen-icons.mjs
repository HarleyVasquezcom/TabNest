import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const png = (w, h, rgba) => {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const i = y * (w * 4 + 1) + 1 + x * 4;
      const j = (y * w + x) * 4;
      raw[i] = rgba[j];
      raw[i + 1] = rgba[j + 1];
      raw[i + 2] = rgba[j + 2];
      raw[i + 3] = rgba[j + 3];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(body) >>> 0, 0);
    return Buffer.concat([len, body, crc]);
  };
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

const S = 128;
const img = Buffer.alloc(S * S * 4);
const px = (x, y, r, g, b, a = 255) => {
  if (x < 0 || y < 0 || x >= S || y >= S) return;
  const i = (y * S + x) * 4;
  const m = Math.min(1, a);
  img[i] = Math.round(r * m + img[i] * (1 - m));
  img[i + 1] = Math.round(g * m + img[i + 1] * (1 - m));
  img[i + 2] = Math.round(b * m + img[i + 2] * (1 - m));
  img[i + 3] = Math.max(img[i + 3], a);
};

const AMBER = [245, 158, 11];
const HONEY = [251, 191, 36];
const DARK = [69, 26, 3];

function hexPath(cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

function inShape(pt, verts) {
  let inside = false;
  for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
    const [xi, yi] = verts[i];
    const [xj, yj] = verts[j];
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function fillHex(cx, cy, r, color) {
  const verts = hexPath(cx, cy, r);
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r * 1.14); x <= Math.ceil(cx + r * 1.14); x++) {
      if (inShape([x + 0.5, y + 0.5], verts)) px(x, y, color[0], color[1], color[2]);
    }
  }
}

fillHex(64, 64, 52, AMBER);
fillHex(64, 64, 32, HONEY);
fillHex(40, 42, 9, DARK);
fillHex(64, 40, 9, DARK);
fillHex(88, 42, 9, DARK);
fillHex(64, 82, 9, DARK);
fillHex(40, 68, 9, DARK);
fillHex(88, 68, 9, DARK);

const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'icons');
fs.mkdirSync(outDir, { recursive: true });
for (const [size, name] of [[16, 'icon16.png'], [48, 'icon48.png'], [128, 'icon128.png']]) {
  const scaled = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sx = Math.min(S - 1, Math.floor((x * S) / size));
      const sy = Math.min(S - 1, Math.floor((y * S) / size));
      const si = (sy * S + sx) * 4;
      const di = (y * size + x) * 4;
      scaled[di] = img[si];
      scaled[di + 1] = img[si + 1];
      scaled[di + 2] = img[si + 2];
      scaled[di + 3] = img[si + 3];
    }
  }
  fs.writeFileSync(path.join(outDir, name), png(size, size, scaled));
  console.log('icon: ' + path.join(outDir, name));
}