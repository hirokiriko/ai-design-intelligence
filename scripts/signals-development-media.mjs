import { deflateSync } from 'node:zlib';

// Development-server-only, self-drawn fictional diagrams. No real image input.
const fixtureRoles = new Map([
  ['FIXTURE-DEV-CASE-1-MEDIA-A', 'A'], ['FIXTURE-DEV-CASE-1-MEDIA-B', 'B'],
  ['FIXTURE-DEV-CASE-2-MEDIA-A', 'A'], ['FIXTURE-DEV-CASE-2-MEDIA-B', 'B'],
]);
function crc32(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit += 1) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  }
  return (value ^ 0xffffffff) >>> 0;
}
function chunk(kind, body) {
  const type = Buffer.from(kind);
  const length = Buffer.alloc(4); length.writeUInt32BE(body.length);
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc32(Buffer.concat([type, body])));
  return Buffer.concat([length, type, body, checksum]);
}
export function createFictionalMediaPng(id) {
  const role = fixtureRoles.get(id);
  if (!role) return null;
  const width = 640; const height = 480;
  const stride = 1 + width * 3;
  const pixels = Buffer.alloc(stride * height, 255);
  for (let y = 0; y < height; y += 1) pixels[y * stride] = 0;
  const point = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    pixels.fill(35, y * stride + 1 + x * 3, y * stride + 1 + x * 3 + 3);
  };
  const line = (x1, y1, x2, y2) => {
    const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
    for (let step = 0; step <= steps; step += 1) {
      const x = Math.round(x1 + (x2 - x1) * step / (steps || 1));
      const y = Math.round(y1 + (y2 - y1) * step / (steps || 1));
      for (let dx = -1; dx <= 1; dx += 1) for (let dy = -1; dy <= 1; dy += 1) point(x + dx, y + dy);
    }
  };
  const rectangle = (left, top, right, bottom) => {
    line(left, top, right, top); line(right, top, right, bottom);
    line(right, bottom, left, bottom); line(left, bottom, left, top);
  };
  rectangle(140, 60, 500, 410);
  if (role === 'A') {
    for (let angle = 0; angle < 360; angle += 0.25) {
      const radians = angle * Math.PI / 180;
      const x = Math.round(320 + 70 * Math.cos(radians));
      const y = Math.round(235 + 70 * Math.sin(radians));
      point(x, y); point(x + 1, y); point(x, y + 1);
    }
    line(30, 40, 45, 10); line(45, 10, 60, 40); line(37, 27, 53, 27);
  } else {
    rectangle(250, 165, 390, 305);
    rectangle(30, 10, 55, 25); rectangle(30, 25, 60, 40);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4);
  header[8] = 8; header[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]);
}
