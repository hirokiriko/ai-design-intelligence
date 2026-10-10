import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { createFictionalMediaPng } from './signals-development-media.mjs';

describe('self-drawn fictional development PNGs', () => {
  it('only serves explicit fixture media identifiers', () => {
    expect(createFictionalMediaPng('a-real-media-id')).toBeNull();
    expect(createFictionalMediaPng('../FIXTURE-DEV-CASE-1-MEDIA-A')).toBeNull();
    expect(createFictionalMediaPng('FIXTURE-DEV-CASE-1-MEDIA-A')).not.toBeNull();
  });
  it('produces 640×480 PNGs with different central outlines from scratch', () => {
    const read = (id) => {
      const png = createFictionalMediaPng(id);
      expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
      expect(png.readUInt32BE(16)).toBe(640); expect(png.readUInt32BE(20)).toBe(480);
      const dataLength = png.readUInt32BE(33);
      expect(png.subarray(37, 41).toString()).toBe('IDAT');
      const pixels = inflateSync(png.subarray(41, 41 + dataLength));
      expect(pixels.length).toBe((640 * 3 + 1) * 480);
      return pixels;
    };
    const circle = read('FIXTURE-DEV-CASE-1-MEDIA-A');
    const rectangle = read('FIXTURE-DEV-CASE-1-MEDIA-B');
    const corner = 165 * (640 * 3 + 1) + 1 + 250 * 3;
    expect(circle[corner]).toBe(255); expect(rectangle[corner]).toBe(35);
    expect(circle.equals(rectangle)).toBe(false);
  });
});
