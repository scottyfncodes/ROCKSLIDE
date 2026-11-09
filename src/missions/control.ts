import { mulberry32 } from '../sim/noise';

/**
 * Avalanche control on the Tannberg side, the way a ski patrol does it: before the runs open, the
 * avalanche tech works a control route over the start zones above the runs and the town, with the
 * right tool for each one.
 *
 * - the **howitzer** at the Patrol HQ bunker: long range, a big round, for the big faces;
 * - the **Avalauncher** (a compressed-gas launcher) on the top station: closer, lighter, quick;
 * - **hand charges** thrown from the ridge top above a zone;
 * - **ski cuts** across a small slope: a fast traverse that lets a soft slab go under your skis.
 *
 * What a shot does depends on the day's snowpack (the danger rating and how the wind loaded each
 * zone): nothing, a small sluff, or a full slide that runs to the bottom. A loaded zone left alone with
 * the runs open can release naturally later in the day. Safety rules: the runs below are closed and the
 * slide path is clear before anything is fired, or the job costs points and reputation.
 *
 * Pure: no scene, no DOM. The game feeds it what happens.
 */

export type Method = 'howitzer' | 'avalauncher' | 'hand' | 'skicut';
export type Outcome = 'none' | 'sluff' | 'full';

export const METHOD_LABEL: Record<Method, string> = {
  howitzer: 'Howitzer (bunker)',
  avalauncher: 'Avalauncher (top station)',
  hand: 'Hand charge from the ridge',
  skicut: 'Ski cut',
};

export interface Zone {
  id: string;
  name: string;
  /** centre of the start zone */
  x: number;
  z: number;
  /** its radius (m) */
  r: number;
  size: 'small' | 'medium' | 'large';
  /** the tools that can work it (the first is the usual one) */
  methods: Method[];
  /** the run or place below it that must be closed */
  below: string;
}

export const ZONES: Zone[] = [
  { id: 'Z1', name: 'Tannberg Headwall', x: 520, z: -300, r: 26, size: 'large', methods: ['avalauncher', 'howitzer'], below: 'Tannberg Run (upper)' },
  { id: 'Z2', name: 'West Face', x: 420, z: -340, r: 28, size: 'large', methods: ['howitzer'], below: 'Tannberg Run (upper)' },
  { id: 'Z3', name: 'Lift Line Gully', x: 500, z: -120, r: 20, size: 'medium', methods: ['howitzer', 'hand'], below: 'The chairlift' },
  { id: 'Z4', name: 'Shelf Rollover', x: 640, z: 0, r: 16, size: 'small', methods: ['skicut', 'hand'], below: 'Fernhut Track' },
  { id: 'Z5', name: 'Hornli Chute', x: 700, z: -40, r: 18, size: 'medium', methods: ['hand', 'howitzer'], below: 'Fernhut Track' },
  { id: 'Z6', name: 'Park Bank', x: 460, z: 160, r: 14, size: 'small', methods: ['skicut', 'hand'], below: 'Terrain Park' },
];
export const zone = (id: string) => ZONES.find((z) => z.id === id)!;

/** The guns: where they stand and how far they reach (m). */
export const GUNS = {
  howitzer: { x: 418, z: 324, range: 950, minRange: 120, label: 'Howitzer' },
  avalauncher: { x: 584, z: -322, range: 340, minRange: 30, label: 'Avalauncher' },
};

/** How hard each tool hits a snowpack (its chance of bringing down what is loaded). */
export const POWER: Record<Method, number> = { howitzer: 1, avalauncher: 0.85, hand: 0.9, skicut: 0.5 };
/** What each charge setting adds (1: light, 2: standard, 3: heavy). */
export const CHARGE_POWER = [0, 0.85, 1, 1.12];

export interface ZoneState {
  id: string;
  /** how loaded and unstable it is today, 0..1 */
  load: number;
  /** done today (controlled, or it ran on its own) */
  done: boolean;
  result: Outcome | null;
  /** attempts so far (each shot rolls again) */
  shots: number;
  /** it ran naturally (not under control) */
  natural: boolean;
}

export interface ControlDay {
  seed: number;
  danger: number;
  zones: ZoneState[];
  /** the runs below the zones are closed for the route */
  runsClosed: boolean;
  /** the runs have been opened for the day */
  opened: boolean;
  score: number;
  rep: number;
  /** a log of what happened, for the end-of-day report */
  log: string[];
  /** safety breaches today */
  breaches: number;
}

/** Today's snowpack: each zone's loading from the danger rating and the wind, seeded by the day. */
export function newControlDay(seed: number, danger: number): ControlDay {
  const rng = mulberry32(seed * 7919 + 17);
  const d = Math.max(1, Math.min(5, danger));
  const zones = ZONES.map((z) => {
    // the higher the danger, the more zones carry a slab; each zone's aspect takes the wind differently
    const aspect = rng();
    const load = Math.max(0, Math.min(1, (d - 1) / 4 * 0.75 + aspect * 0.45 - 0.12 + (z.size === 'large' ? 0.08 : 0)));
    return { id: z.id, load: Math.round(load * 100) / 100, done: false, result: null, shots: 0, natural: false };
  });
  return { seed, danger: d, zones, runsClosed: true, opened: false, score: 0, rep: 0, log: [], breaches: 0 };
}

/** A zone counts as loaded (a hazard to the runs) above this. */
export const LOADED = 0.45;
export const loaded = (s: ZoneState) => !s.done && s.load >= LOADED;
export const LOAD_LABEL = (load: number) => (load >= 0.7 ? 'Heavily loaded' : load >= LOADED ? 'Loaded' : load >= 0.25 ? 'Some new snow' : 'Stable');

/**
 * What a shot brings down. `charge` 1..3 (ignored for a ski cut). The roll is seeded by the day, the
 * zone and the attempt, so the same shot on the same day always does the same thing.
 */
export function shotOutcome(day: ControlDay, zoneId: string, method: Method, charge = 2, attempt = 0): Outcome {
  const s = day.zones.find((z) => z.id === zoneId)!;
  const z = zone(zoneId);
  if (method === 'skicut' && z.size === 'large') return 'none';
  const rng = mulberry32(day.seed * 131 + zoneId.charCodeAt(1) * 977 + attempt * 31 + 5);
  const power = POWER[method] * (method === 'skicut' ? 1 : CHARGE_POWER[Math.max(1, Math.min(3, charge))]);
  const k = s.load * power + (rng() - 0.5) * 0.24;
  // a ski cut only ever lets a small slab or a sluff go: it is a test, not a demolition
  if (method === 'skicut') return k > 0.42 ? 'sluff' : 'none';
  if (k > 0.55) return 'full';
  if (k > 0.3) return 'sluff';
  return 'none';
}

/** Is it safe to fire on a zone: the runs below closed, and nobody (you, Koda, a guest) in its path? */
export function safeToFire(day: ControlDay, inPath: number): { ok: boolean; why: string } {
  if (!day.runsClosed) return { ok: false, why: 'The runs below are open: close them first.' };
  if (inPath > 0) return { ok: false, why: 'Somebody is in the slide path: clear it first.' };
  return { ok: true, why: '' };
}

/** Points for a result: control that brings down a loaded zone is worth the most. */
export const POINTS = { full: 300, sluff: 150, none: 40, breach: -250, naturalOpen: -300, openSafe: 200 };

/**
 * Record a shot's result. `safe`: the safety check passed when it was fired (if not, the shot still
 * happens but costs points and reputation). Returns the points it scored.
 */
export function recordShot(day: ControlDay, zoneId: string, method: Method, out: Outcome, safe: boolean): number {
  const s = day.zones.find((z) => z.id === zoneId)!;
  s.shots++;
  let pts = 0;
  if (out !== 'none') {
    s.done = true;
    s.result = out;
    s.load = out === 'full' ? 0.05 : Math.max(0, s.load - 0.45);
    pts += out === 'full' ? POINTS.full : POINTS.sluff;
  } else {
    pts += POINTS.none;
    // a clean "no result" on a sound slope is a good answer too: it can be opened
    if (s.load < LOADED) s.done = true;
    else s.load = Math.max(0, s.load - 0.1);
  }
  if (!safe) {
    pts += POINTS.breach;
    day.breaches++;
    day.rep -= 15;
  } else day.rep += out === 'full' ? 6 : 3;
  day.score += pts;
  day.log.push(`${zone(zoneId).name}: ${METHOD_LABEL[method]}, ${out === 'full' ? 'full slide to the bottom' : out === 'sluff' ? 'a small sluff' : 'no result'}${safe ? '' : ' (fired unsafe)'}`);
  return pts;
}

/** Open the runs: a bonus when nothing loaded is left above them, a warning count when it is. */
export function openRuns(day: ControlDay): { left: string[]; points: number } {
  day.runsClosed = false;
  day.opened = true;
  const left = day.zones.filter(loaded).map((s) => zone(s.id).name);
  const points = left.length ? 0 : POINTS.openSafe;
  day.score += points;
  day.log.push(left.length ? `Runs opened with ${left.length} loaded zone${left.length > 1 ? 's' : ''} left: ${left.join(', ')}` : 'Runs opened clean: every loaded zone controlled');
  return { left, points };
}

/**
 * The chance (per in-game hour) that a loaded zone lets go on its own. Only zones still loaded; much
 * likelier when it is heavily loaded and the danger is high, and more again with the runs open (people
 * on the slopes are triggers).
 */
export function naturalRisk(day: ControlDay, s: ZoneState): number {
  if (!loaded(s)) return 0;
  return Math.min(0.9, (s.load - LOADED + 0.1) * (0.25 + day.danger * 0.12) * (day.opened ? 1.6 : 1));
}

/** Record a natural release (and its cost if the runs were open below it). */
export function recordNatural(day: ControlDay, zoneId: string): number {
  const s = day.zones.find((z) => z.id === zoneId)!;
  s.done = true;
  s.natural = true;
  s.result = 'full';
  s.load = 0.05;
  const pts = day.opened ? POINTS.naturalOpen : 0;
  if (day.opened) day.rep -= 20;
  day.score += pts;
  day.log.push(`${zone(zoneId).name} ran naturally${day.opened ? ' with the runs open below' : ''}`);
  return pts;
}

/** Ballistics for the guns: where a round lands for a heading, an elevation and a charge (flat ground at the gun's height). */
export function shellRange(gun: 'howitzer' | 'avalauncher', elevationDeg: number, charge: number): number {
  const v = gun === 'howitzer' ? 62 + charge * 14 : 34 + charge * 9;
  const a = (elevationDeg * Math.PI) / 180;
  return (v * v * Math.sin(2 * a)) / 9.81;
}
export const muzzle = (gun: 'howitzer' | 'avalauncher', charge: number) => (gun === 'howitzer' ? 62 + charge * 14 : 34 + charge * 9);
