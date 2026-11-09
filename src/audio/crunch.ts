/**
 * A boot in snow, synthesised. Snow underfoot is not an impact: it is thousands of tiny ice grains
 * breaking and sliding as the snow compresses under the weight, so it sounds like a dense crackle,
 * bright (most of it 1 to 6 kHz), building over a few milliseconds instead of starting with a bang,
 * usually in two parts as the heel and then the ball of the foot come down, with only a soft, dull
 * press of weight under it. A recorded "footstep" (a hard sole on a hard floor) is the opposite: a
 * resonant knock in the low mids with an instant attack, which is why muffling one never sounded like
 * snow.
 *
 * Packed snow crunches crisp and short; powder is a deeper, softer, longer "whumpf" with the crackle
 * swallowed. Pure: samples in, samples out, so it can be listened to and measured outside the browser
 * (scripts/crunchlab.ts writes them as WAV files).
 */

export type Snow = 'packed' | 'powder';

/** A small seeded generator (mulberry32), so a take is the same every time it is built from the same seed. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** a raised-cosine rise over `a` seconds, then an exponential fall with time constant `tau` */
const hump = (t: number, a: number, tau: number) => (t < 0 ? 0 : t < a ? 0.5 - 0.5 * Math.cos((Math.PI * t) / a) : Math.exp(-(t - a) / tau));

/** One-pole filter coefficient for a cutoff (Hz). */
const pole = (hz: number, sr: number) => Math.exp((-2 * Math.PI * hz) / sr);

export const CRUNCH = {
  /** seconds per take */
  len: 0.36,
  packed: { rise: 0.009, tau: 0.038, toe: [0.045, 0.075], toeGain: [0.55, 0.85], grains: 5200, bed: 0.16, lo: 900, hi: 7500, weight: 0.08 },
  powder: { rise: 0.02, tau: 0.05, toe: [0.06, 0.09], toeGain: [0.45, 0.7], grains: 3000, bed: 0.38, lo: 650, hi: 3600, weight: 0.16 },
} as const;

/**
 * One take of a boot in snow: `seed` picks the take. Mono samples at `sr`, peak 0.9.
 */
export function crunch(sr: number, seed: number, snow: Snow = 'packed'): Float32Array {
  const P = CRUNCH[snow];
  const r = rng(seed * 7919 + (snow === 'powder' ? 104729 : 0));
  const n = Math.round(CRUNCH.len * sr);
  const out = new Float32Array(n);
  const toeAt = P.toe[0] + r() * (P.toe[1] - P.toe[0]);
  const toeGain = P.toeGain[0] + r() * (P.toeGain[1] - P.toeGain[0]);
  const heelAt = 0.002 + r() * 0.004;
  // the crackle: sparse grains breaking, each a click a fraction of a millisecond long, most of them
  // tiny and a few loud ones (the crunch's grit), as dense as the snow is being pressed
  const exc = new Float32Array(n);
  let ring = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const e = hump(t - heelAt, P.rise, P.tau) + toeGain * hump(t - toeAt, P.rise * 0.8, P.tau * 0.85);
    if (r() < (P.grains / sr) * e) {
      const a = Math.pow(r(), 2.6) * (r() < 0.5 ? -1 : 1);
      // as loud as the snow is being pressed: the last few grains settling after it are only ticks
      ring = a * Math.min(1.4, e * 1.3);
    }
    // the click rings down in well under a millisecond
    exc[i] = ring + (r() * 2 - 1) * P.bed * e;
    ring *= 0.55;
  }
  // band it: the grain clicks' low end off (no knock), the very top softened (snow is not glass)
  const lo = pole(P.lo, sr);
  const hi = pole(P.hi, sr);
  let lp1 = 0;
  let lp2 = 0;
  let hpState = 0;
  for (let i = 0; i < n; i++) {
    hpState = lo * hpState + (1 - lo) * exc[i];
    const band = exc[i] - hpState;
    lp1 = hi * lp1 + (1 - hi) * band;
    lp2 = hi * lp2 + (1 - hi) * lp1;
    out[i] = lp2;
  }
  // the weight: a soft, dull press (filtered noise, eased in, no click), well under the crackle
  const w = pole(160, sr);
  let a1 = 0;
  let a2 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    a1 = w * a1 + (1 - w) * (r() * 2 - 1);
    a2 = w * a2 + (1 - w) * a1;
    out[i] += a2 * 14 * P.weight * hump(t - heelAt, 0.018, 0.05);
  }
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(out[i]));
  const k = peak > 0 ? 0.9 / peak : 0;
  // a short fade at the end so the take never clicks off
  const fade = Math.round(0.02 * sr);
  for (let i = 0; i < n; i++) out[i] *= k * Math.min(1, (n - i) / fade);
  return out;
}
