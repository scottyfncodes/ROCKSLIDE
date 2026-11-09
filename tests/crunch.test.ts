import { describe, expect, it } from 'vitest';
import { crunch } from '../src/audio/crunch';

const SR = 44100;
/** share of the take's energy above `hz` (a two-pole high-pass) */
function above(x: Float32Array, hz: number) {
  const a = Math.exp((-2 * Math.PI * hz) / SR);
  let l1 = 0;
  let l2 = 0;
  let hi = 0;
  let all = 0;
  for (const v of x) {
    l1 = a * l1 + (1 - a) * v;
    l2 = a * l2 + (1 - a) * l1;
    hi += (v - l2) ** 2;
    all += v * v;
  }
  return hi / all;
}
/** the loudest 5 ms window's start (s) */
function loudest(x: Float32Array) {
  const w = Math.round(0.005 * SR);
  let best = 0;
  let at = 0;
  for (let i = 0; i + w < x.length; i += w) {
    let e = 0;
    for (let j = i; j < i + w; j++) e += x[j] * x[j];
    if (e > best) [best, at] = [e, i / SR];
  }
  return at;
}

describe('boots in snow (the synthesised crunch)', () => {
  it('packed snow is a bright crackle, not a knock: most of it above 1 kHz', () => {
    for (let s = 1; s <= 6; s++) expect(above(crunch(SR, s, 'packed'), 1000)).toBeGreaterThan(0.6);
  });

  it('powder is softer and duller than packed snow, but still not a thud', () => {
    for (let s = 1; s <= 6; s++) {
      const pw = above(crunch(SR, s, 'powder'), 1000);
      expect(pw).toBeLessThan(above(crunch(SR, s, 'packed'), 1000));
      expect(pw).toBeGreaterThan(0.35);
    }
  });

  it('builds as the snow compresses: the first millisecond is quiet, the loudest moment comes later', () => {
    for (let s = 1; s <= 6; s++) {
      const x = crunch(SR, s, 'packed');
      let first = 0;
      for (let i = 0; i < SR * 0.001; i++) first = Math.max(first, Math.abs(x[i]));
      expect(first).toBeLessThan(0.3);
      expect(loudest(x)).toBeGreaterThan(0.004);
    }
  });

  it('is over in a step, ends silent, and every take is its own (the same take from the same seed)', () => {
    const a = crunch(SR, 1, 'packed');
    const b = crunch(SR, 2, 'packed');
    expect(a.length / SR).toBeLessThan(0.4);
    expect(Math.abs(a[a.length - 1])).toBeLessThan(1e-3);
    let tail = 0;
    for (let i = Math.round(0.25 * SR); i < a.length; i++) tail = Math.max(tail, Math.abs(a[i]));
    expect(tail).toBeLessThan(0.05);
    expect(Array.from(crunch(SR, 1, 'packed'))).toEqual(Array.from(a));
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff += Math.abs(a[i] - b[i]);
    expect(diff / a.length).toBeGreaterThan(0.01);
  });
});
