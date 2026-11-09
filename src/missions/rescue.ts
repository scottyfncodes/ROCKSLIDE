import { mulberry32 } from '../sim/noise';

/**
 * Avalanche rescue, as a companion rescue works:
 *
 * 1. **Signal search**: no signal yet; sweep the debris in strips until a transceiver picks one up
 *    (50 m range).
 * 2. **Coarse search**: follow the direction arrow and the falling distance.
 * 3. **Fine search**: within 3 m the arrow is gone; bracket low over the snow for the lowest reading
 *    (it bottoms out at the burial depth).
 * 4. **Probe** to confirm the depth, then **shovel** (mash to dig; a steady rhythm digs faster).
 *
 * Victims without a beacon give no signal: only Koda's nose finds them. A burial starts a survival
 * clock: odds stay high for about the first 15 minutes, then fall steeply (the asphyxia phase), then
 * level off (an air pocket) and fall away again.
 *
 * Pure: no scene, no DOM.
 */

export interface Victim {
  id: string;
  x: number;
  z: number;
  /** burial depth to the face (m) */
  depth: number;
  beacon: boolean;
  /** found by a probe strike, and how much is dug out (m) */
  probed: boolean;
  dug: number;
  /** out of the snow */
  out: boolean;
  /** pointed out by Koda */
  marked: boolean;
  name: string;
}

export const BEACON_RANGE = 50;
export const FINE_RANGE = 3;

/** Rescue minutes per real second: 15 minutes take two and a half real minutes. */
export const RESCUE_RATE = 6;

/**
 * Survival odds after `min` minutes buried (after the Brugger/Falk survival curve: about 92% at 15
 * minutes, a third by 35, an air-pocket plateau, then little hope after two hours).
 */
const CURVE: [number, number][] = [
  [0, 1],
  [15, 0.92],
  [18, 0.82],
  [25, 0.55],
  [35, 0.32],
  [90, 0.27],
  [130, 0.06],
  [180, 0.02],
];
export function survival(min: number): number {
  if (min <= 0) return 1;
  for (let i = 1; i < CURVE.length; i++) {
    const [m1, s1] = CURVE[i];
    if (min <= m1) {
      const [m0, s0] = CURVE[i - 1];
      return s0 + ((s1 - s0) * (min - m0)) / (m1 - m0);
    }
  }
  return CURVE[CURVE.length - 1][1];
}

export type Stage = 'signal' | 'coarse' | 'fine';

export interface Reading {
  stage: Stage;
  /** the victim the transceiver is locked on, or null */
  id: string | null;
  /** the displayed distance (m, 3D: across the snow and down to the beacon) */
  distance: number;
  /** bearing to the victim (rad, 0 = north, clockwise), coarse stage only */
  bearing: number | null;
}

/** The 3D distance from a transceiver held at the snow surface to a buried beacon. */
export const beaconDistance = (x: number, z: number, v: Victim) => Math.hypot(x - v.x, z - v.z, v.depth);

/** What the transceiver shows at (x, z): the nearest beacon not yet dug out, within range. */
export function readBeacon(x: number, z: number, victims: readonly Victim[]): Reading {
  let best: Victim | null = null;
  let bd = Infinity;
  for (const v of victims) {
    if (!v.beacon || v.out) continue;
    const d = beaconDistance(x, z, v);
    if (d < bd) {
      bd = d;
      best = v;
    }
  }
  if (!best || bd > BEACON_RANGE) return { stage: 'signal', id: null, distance: 0, bearing: null };
  // the display reads in tenths, as a real one does
  const distance = Math.round(bd * 10) / 10;
  if (bd <= FINE_RANGE) return { stage: 'fine', id: best.id, distance, bearing: null };
  return { stage: 'coarse', id: best.id, distance, bearing: Math.atan2(best.x - x, -(best.z - z)) };
}

/** A probe strike at (x, z): hits a victim within half a metre, and tells the depth. */
export const PROBE_HIT = 0.6;
export function probe(x: number, z: number, victims: Victim[]): Victim | null {
  for (const v of victims) {
    if (v.out) continue;
    if (Math.hypot(x - v.x, z - v.z) <= PROBE_HIT) {
      v.probed = true;
      return v;
    }
  }
  return null;
}

/**
 * Shovelling: each stroke moves snow. A steady rhythm (strokes 0.15 to 0.45 s apart, a conveyor of
 * snow) digs half again as fast; a better shovel digs faster still. Returns metres dug this stroke.
 */
export function shovel(v: Victim, gap: number, shovelK = 1): number {
  if (v.out) return 0;
  const steady = gap >= 0.15 && gap <= 0.45;
  const dug = 0.05 * shovelK * (steady ? 1.5 : 1);
  v.dug = Math.min(v.depth, v.dug + dug);
  if (v.dug >= v.depth) v.out = true;
  return dug;
}

export interface Burial {
  victims: Victim[];
  /** rescue minutes since the slide stopped */
  minutes: number;
  probes: number;
  probeHits: number;
  strokes: number;
  steadyStrokes: number;
  /** each victim's survival at the moment they were dug out */
  saved: { id: string; odds: number; minutes: number }[];
}

const NAMES = ['Ines', 'Mats', 'Rosa', 'Theo', 'Lena', 'Joel', 'Anouk', 'Felix'];

/**
 * Bury guests in a debris field (centre, radius): 1..n victims at different depths, some with no
 * beacon. Seeded, so the same slide buries the same people in the same places.
 */
export function bury(cx: number, cz: number, r: number, count: number, seed: number, beaconless = 0.34): Burial {
  const rng = mulberry32(seed);
  const victims: Victim[] = [];
  for (let i = 0; i < count; i++) {
    const a = rng() * Math.PI * 2;
    const d = Math.sqrt(rng()) * Math.max(4, r * 0.7);
    victims.push({
      id: `v${i}`,
      name: NAMES[(seed + i) % NAMES.length],
      x: cx + Math.cos(a) * d,
      z: cz + Math.sin(a) * d,
      depth: Math.round((0.5 + rng() * 1.6) * 10) / 10,
      // the first always carries a beacon, so the transceiver has something to find
      beacon: i === 0 || rng() > beaconless,
      probed: false,
      dug: 0,
      out: false,
      marked: false,
    });
  }
  return { victims, minutes: 0, probes: 0, probeHits: 0, strokes: 0, steadyStrokes: 0, saved: [] };
}

export function tickBurial(b: Burial, realDt: number) {
  b.minutes += realDt * RESCUE_RATE;
}

/** Dig a victim out (the last stroke): their odds at that moment go on the record. */
export function recordSaved(b: Burial, v: Victim) {
  if (b.saved.some((s) => s.id === v.id)) return;
  b.saved.push({ id: v.id, odds: survival(b.minutes), minutes: b.minutes });
}

export interface RescueScore {
  time: number;
  survival: number;
  technique: number;
  total: number;
  /** stars, 1..3 */
  stars: number;
}

/**
 * Score a rescue: time (faster is better), survival (the odds each person was dug out with) and
 * technique (probe strikes that hit, a steady shovel rhythm).
 */
export function scoreRescue(b: Burial): RescueScore {
  const n = Math.max(1, b.victims.length);
  const surv = b.saved.reduce((a, s) => a + s.odds, 0) / n;
  const time = Math.round(Math.max(0, 1 - b.minutes / 60) * 400);
  const survival = Math.round(surv * 600);
  const hitRate = b.probes ? b.probeHits / b.probes : 0;
  const rhythm = b.strokes ? b.steadyStrokes / b.strokes : 0;
  const technique = Math.round(hitRate * 150 + rhythm * 150);
  const total = time + survival + technique;
  const stars = surv >= 0.85 && total >= 850 ? 3 : surv >= 0.5 ? 2 : 1;
  return { time, survival, technique, total, stars };
}
