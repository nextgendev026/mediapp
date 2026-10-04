import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve('public');
fs.mkdirSync(OUT, { recursive: true });

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
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

function encodePNG(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

const GREEN = [0x1d, 0xa8, 0x4a];
const DARK = [0x0d, 0x5c, 0x2a];
const WHITE = [255, 255, 255];

function px(rgba, w, x, y, color, alpha = 255) {
  if (x < 0 || y < 0 || x >= w) return;
  const i = (y * w + x) * 4;
  rgba[i] = Math.round((color[0] * alpha + rgba[i] * (255 - alpha)) / 255);
  rgba[i + 1] = Math.round((color[1] * alpha + rgba[i + 1] * (255 - alpha)) / 255);
  rgba[i + 2] = Math.round((color[2] * alpha + rgba[i + 2] * (255 - alpha)) / 255);
  rgba[i + 3] = Math.max(rgba[i + 3], alpha);
}

function fill(rgba, w, h, color) {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) px(rgba, w, x, y, color, 255);
}

function roundRect(rgba, w, h, x0, y0, x1, y1, r, color, alpha = 255) {
  for (let y = Math.max(0, y0); y < Math.min(h, y1); y++) {
    for (let x = Math.max(0, x0); x < Math.min(w, x1); x++) {
      const dx = Math.max(x0 + r - x, x - (x1 - 1 - r), 0);
      const dy = Math.max(y0 + r - y, y - (y1 - 1 - r), 0);
      if (dx * dx + dy * dy <= r * r) px(rgba, w, x, y, color, alpha);
    }
  }
}

function cross(rgba, w, h, cx, cy, size, thick, color) {
  roundRect(rgba, w, h, cx - thick / 2, cy - size / 2, cx + thick / 2, cy + size / 2, thick / 4, color);
  roundRect(rgba, w, h, cx - size / 2, cy - thick / 2, cx + size / 2, cy + thick / 2, thick / 4, color);
}

function circle(rgba, w, h, cx, cy, r, color, alpha = 255) {
  for (let y = Math.max(0, cy - r); y < Math.min(h, cy + r); y++)
    for (let x = Math.max(0, cx - r); x < Math.min(w, cx + r); x++)
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px(rgba, w, x, y, color, alpha);
}

function makeIcon(size, { maskable = false, transparentBg = false }) {
  const rgba = Buffer.alloc(size * size * 4);
  if (transparentBg) {
    // transparent corners for legacy favicon use
    roundRect(rgba, size, size, 0, 0, size, size, size * 0.18, GREEN);
  } else {
    fill(rgba, size, size, GREEN);
  }
  if (maskable) {
    const s = size * 0.72;
    cross(rgba, size, size, size / 2, size / 2, s * 0.5, s * 0.16, WHITE);
  } else {
    circle(rgba, size, size, size / 2, size / 2, size * 0.36, WHITE, 40);
    cross(rgba, size, size, size / 2, size / 2, size * 0.42, size * 0.13, WHITE);
  }
  return encodePNG(size, size, rgba);
}

function makeOg() {
  const w = 1200, h = 630;
  const rgba = Buffer.alloc(w * h * 4);
  fill(rgba, w, h, [0x0a, 0x3d, 0x1d]);
  circle(rgba, w, h, 980, 120, 260, GREEN, 90);
  circle(rgba, w, h, 160, 560, 300, DARK, 160);
  // left card with cross
  roundRect(rgba, w, h, 90, 155, 330, 395, 40, WHITE);
  cross(rgba, w, h, 210, 275, 140, 44, GREEN);
  // right side "headline" bars (abstract typography)
  roundRect(rgba, w, h, 400, 190, 1080, 232, 16, WHITE);
  roundRect(rgba, w, h, 400, 254, 940, 296, 16, WHITE, 210);
  roundRect(rgba, w, h, 400, 318, 760, 360, 16, WHITE, 140);
  // accent pill
  roundRect(rgba, w, h, 400, 410, 640, 458, 24, GREEN);
  roundRect(rgba, w, h, 660, 410, 840, 458, 24, WHITE, 60);
  return encodePNG(w, h, rgba);
}

fs.writeFileSync(path.join(OUT, 'icon-192.png'), makeIcon(192, {}));
fs.writeFileSync(path.join(OUT, 'icon-512.png'), makeIcon(512, {}));
fs.writeFileSync(path.join(OUT, 'maskable-512.png'), makeIcon(512, { maskable: true }));
fs.writeFileSync(path.join(OUT, 'apple-touch-icon.png'), makeIcon(180, {}));
fs.writeFileSync(path.join(OUT, 'favicon.png'), makeIcon(64, { transparentBg: true }));
fs.writeFileSync(path.join(OUT, 'og.png'), makeOg());
fs.mkdirSync(path.resolve('app'), { recursive: true });
fs.writeFileSync(path.resolve('app/icon.png'), makeIcon(64, { transparentBg: true }));
console.log('icons written to', OUT);
