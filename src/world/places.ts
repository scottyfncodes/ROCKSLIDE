import type { Vec2 } from '../sim/geom';

/**
 * The Kessel Valley: one alpine region, laid out by hand.
 * x runs east, z runs south, y is up (metres). North (-z) climbs into the high peaks;
 * the valley floor and the village are to the south.
 */

export const WORLD_HALF = 1000;

export interface Pad {
  id: string;
  name: string;
  x: number;
  z: number;
  /** flat radius */
  r: number;
  /** blend distance beyond r */
  blend: number;
  /** height of the flat (m) */
  h: number;
}

/**
 * Tannberg Village, the base area, is one planned town (see TOWN below): Main Street runs north from
 * the parking lot at the valley road up to the lift base plaza, with Patrol HQ and its vehicle yard on
 * the west side and Hollin, the guest village, on the east.
 */
export const PADS: Pad[] = [
  { id: 'hq', name: 'Patrol HQ', x: 385, z: 300, r: 62, blend: 45, h: 97 },
  { id: 'village', name: 'Hollin', x: 528, z: 345, r: 56, blend: 45, h: 99 },
  { id: 'resort', name: 'Lift Base Plaza', x: 470, z: 226, r: 34, blend: 40, h: 118 },
  { id: 'parking', name: 'Parking', x: 452, z: 432, r: 26, blend: 30, h: 90 },
  { id: 'lifttop', name: 'Tannberg Top Station', x: 590, z: -330, r: 26, blend: 30, h: 455 },
  { id: 'station', name: 'Grauhorn Weather Station', x: -640, z: -300, r: 20, blend: 30, h: 312 },
  { id: 'cabin', name: 'Fernhut Cabin', x: 760, z: -60, r: 18, blend: 26, h: 268 },
  { id: 'ridge', name: 'Kessel Ridge', x: -215, z: -470, r: 26, blend: 30, h: 402 },
  // a ledge in the Weisskopf's bowl: only the helicopter gets there (Snow Safety Director)
  { id: 'helibowl', name: 'Weisskopf Bowl', x: 300, z: -600, r: 11, blend: 22, h: 640 },
];

export const pad = (id: string): Pad => PADS.find((p) => p.id === id)!;

export const LAKE = { x: -430, z: 470, r: 125, h: 86, name: 'Mirror Lake' };

/** Roads and tracks the sled runs on; heights are derived from the ground. */
export interface Route {
  id: string;
  name: string;
  pts: Vec2[];
  /** half width of the flattened, packed surface */
  width: number;
  kind: 'road' | 'track' | 'piste';
}

export const ROUTES: Route[] = [
  {
    id: 'pass',
    name: 'Grauhorn Pass Road',
    kind: 'road',
    width: 5,
    pts: [
      [120, 330], [0, 250], [-60, 160], [-110, 40], [-150, -60], [-170, -120],
      [-260, -150], [-380, -160], [-480, -190], [-560, -240], [-640, -300],
    ],
  },
  {
    id: 'resort',
    name: 'Tannberg Road',
    kind: 'road',
    width: 5,
    pts: [[120, 330], [240, 400], [330, 428], [452, 432]],
  },
  {
    id: 'main',
    name: 'Main Street',
    kind: 'road',
    width: 6,
    pts: [[452, 432], [453, 390], [455, 345], [459, 300], [466, 252]],
  },
  {
    id: 'bowltrack',
    name: 'Kessel Ridge Track',
    kind: 'track',
    width: 3.5,
    pts: [[-300, -158], [-360, -215], [-300, -265], [-372, -310], [-312, -355], [-372, -400], [-300, -440], [-215, -470]],
  },
  {
    id: 'cabintrack',
    name: 'Fernhut Track',
    kind: 'track',
    width: 3,
    pts: [[560, 100], [620, 120], [690, 60], [740, -10], [760, -60]],
  },
  {
    id: 'piste',
    name: 'Tannberg Run',
    kind: 'piste',
    width: 16,
    pts: [[590, -330], [560, -250], [600, -170], [560, -80], [520, 10], [560, 90], [518, 150], [482, 204]],
  },
  {
    id: 'backside',
    name: 'Tannberg Back Track',
    kind: 'track',
    width: 3,
    pts: [[598, -330], [622, -326], [642, -316], [656, -300], [662, -280]],
  },
  {
    id: 'lake',
    name: 'Lake Trail',
    kind: 'track',
    width: 3,
    pts: [[120, 330], [20, 380], [-120, 420], [-260, 450], [-330, 460]],
  },
];

export const route = (id: string): Route => ROUTES.find((r) => r.id === id)!;

/** The Tannberg chairlift: base to top station. */
export const LIFT = { from: [470, 210] as Vec2, to: [588, -310] as Vec2 };

/**
 * Kessel Bowl: a classic avalanche path above the pass road.
 * The start zone is a steep slab under the ridge; the track runs south; a deflection berm
 * (built long before you) sits in the runout between it and the road.
 */
export const BOWL = {
  cx: -120,
  /** north edge (ridge) and south edge (runout) of the designed slope */
  zTop: -480,
  zBottom: -150,
  halfWidth: 150,
  /** start zone, where the slab sits */
  slab: { x0: -205, x1: -35, z0: -430, z1: -355 },
  /** profile down the bowl: [z, height] */
  profile: [
    [-500, 420],
    [-470, 404],
    [-430, 378],
    [-355, 318],
    [-290, 268],
    [-235, 236],
    [-200, 222],
    [-160, 214],
    [-130, 205],
  ] as [number, number][],
  /** the berm: a low earth wall across the runout, protecting the road */
  berm: { z: -172, x0: -225, x1: -15, height: 9, thick: 10 },
  /** stand back this far south of the start zone before firing */
  safeZ: -300,
};

/** Spots where charges can go: the two weak zones and two that are fine. */
export const CHARGE_SPOTS: { id: string; x: number; z: number; weak: boolean; label: string }[] = [
  { id: 'A', x: -175, z: -405, weak: true, label: 'Slope A' },
  { id: 'B', x: -125, z: -425, weak: false, label: 'Slope B' },
  { id: 'C', x: -80, z: -395, weak: true, label: 'Slope C' },
  { id: 'D', x: -45, z: -420, weak: false, label: 'Slope D' },
];

/**
 * Gentle tilted shelves shaped into steeper ground, where something has to be reachable:
 * the forested back side of the Tannberg, where skiers go when they should not.
 */
export const SHELVES: { x: number; z: number; r: number; blend: number; h: number; gx: number; gz: number }[] = [
  { x: 648, z: -238, r: 62, blend: 46, h: 404, gx: -0.04, gz: -0.17 },
  // the terrain park: an even 17-degree pitch off the lift base, falling south into the plaza
  { x: 410, z: 160, r: 50, blend: 34, h: 140, gx: 0.02, gz: -0.3 },
];

/** Stands of trees planted on purpose, with clearings kept open (where Nils sits). */
export const GROVES: { x: number; z: number; r: number; step: number; clear: { x: number; z: number; r: number }[] }[] = [
  { x: 648, z: -232, r: 58, step: 7.5, clear: [{ x: 640, z: -220, r: 6 }] },
];

/** Named mountains for the map. */
export const PEAKS: { name: string; x: number; z: number; h: number; r: number }[] = [
  { name: 'Grauhorn', x: -430, z: -700, h: 360, r: 260 },
  { name: 'Weisskopf', x: 310, z: -760, h: 420, r: 280 },
  { name: 'Hornli', x: 860, z: -320, h: 240, r: 200 },
  { name: 'Westwand', x: -860, z: -40, h: 210, r: 220 },
  { name: 'Kessel Spitz', x: -120, z: -640, h: 210, r: 150 },
];

export type BuildingKind = 'lodge' | 'house' | 'clinic' | 'shop' | 'chapel' | 'gear' | 'rentals' | 'bar' | 'condo' | 'baselodge';

/**
 * Hollin, the guest village, and the buildings round the plaza: [x, z, rot, kind]. `rot` turns the
 * front (local +z) to face: -PI/2 faces west onto Main Street, PI/2 east, 0 south.
 */
export const VILLAGE: { x: number; z: number; rot: number; kind: BuildingKind; name?: string }[] = [
  { x: 480, z: 372, rot: -Math.PI / 2, kind: 'lodge', name: 'The Kettle' },
  { x: 478, z: 398, rot: -Math.PI / 2, kind: 'clinic', name: 'Clinic' },
  { x: 477, z: 350, rot: -Math.PI / 2, kind: 'gear', name: 'Gear shop' },
  { x: 477, z: 330, rot: -Math.PI / 2, kind: 'rentals', name: 'Rentals' },
  { x: 479, z: 306, rot: -Math.PI / 2, kind: 'bar', name: 'Après bar' },
  { x: 506, z: 318, rot: -Math.PI / 2, kind: 'condo' },
  { x: 508, z: 342, rot: -Math.PI / 2, kind: 'condo' },
  { x: 507, z: 366, rot: -Math.PI / 2, kind: 'condo' },
  { x: 534, z: 330, rot: -Math.PI / 2, kind: 'condo' },
  { x: 536, z: 356, rot: -Math.PI / 2, kind: 'house' },
  { x: 548, z: 384, rot: -Math.PI / 2, kind: 'chapel', name: 'Chapel' },
  { x: 487, z: 214, rot: -Math.PI / 2, kind: 'baselodge', name: 'Tannberg base lodge' },
];

/** The base area's districts, for the map, the minimap and the signposts. */
export interface District {
  id: 'hq' | 'yard' | 'village' | 'plaza' | 'parking' | 'park';
  name: string;
  x: number;
  z: number;
  /** radius it covers (m) */
  r: number;
}
export const DISTRICTS: District[] = [
  { id: 'hq', name: 'Patrol HQ', x: 372, z: 282, r: 40 },
  { id: 'yard', name: 'Vehicle Yard', x: 400, z: 336, r: 30 },
  { id: 'village', name: 'Hollin Village', x: 505, z: 350, r: 50 },
  { id: 'plaza', name: 'Lift Base Plaza', x: 470, z: 226, r: 34 },
  { id: 'parking', name: 'Parking', x: 452, z: 432, r: 26 },
  { id: 'park', name: 'Terrain Park', x: 410, z: 160, r: 48 },
];
export const districtAt = (x: number, z: number): District | null => {
  let best: District | null = null;
  let bd = Infinity;
  for (const d of DISTRICTS) {
    const k = Math.hypot(x - d.x, z - d.z) / d.r;
    if (k < 1 && k < bd) {
      bd = k;
      best = d;
    }
  }
  return best;
};

/** Signposts: where they stand on Main Street, and the districts their arms point to. */
export const SIGNPOSTS: { x: number; z: number; to: District['id'][] }[] = [
  { x: 446, z: 412, to: ['plaza', 'hq', 'village'] },
  { x: 446, z: 318, to: ['hq', 'yard', 'plaza'] },
  { x: 464, z: 272, to: ['plaza', 'park', 'village'] },
  { x: 464, z: 360, to: ['village', 'parking'] },
];

/**
 * Marked landing zones for the helicopter (orange-flagged rings on the snow): the patrol's own pad, and
 * the flats it uses on the ridges and at the huts.
 */
export const LZS: { id: string; name: string; x: number; z: number; r: number; rank?: number }[] = [
  { id: 'ridge', name: 'Kessel Ridge LZ', x: -215, z: -470, r: 14 },
  { id: 'lifttop', name: 'Top Station LZ', x: 572, z: -336, r: 12 },
  { id: 'station', name: 'Grauhorn LZ', x: -628, z: -292, r: 12 },
  { id: 'cabin', name: 'Fernhut LZ', x: 770, z: -52, r: 11 },
  { id: 'helibowl', name: 'Weisskopf Bowl LZ', x: 300, z: -600, r: 10, rank: 4 },
];

/** Patrol HQ's avalanche control bunker (cannon storage) and the vehicle yard's fuel island. */
export const BUNKER = { x: 422, z: 334, rot: -Math.PI / 2 };
export const FUEL = { x: 428, z: 286, rot: -Math.PI / 2 };
/** The terrain park's rope tow: from the plaza's west edge to the top of the park. */
/** The backcountry gate: a rope and a sign across the Tannberg Back Track behind the top station. */
export const BC_GATE = { x: 616, z: -327 };
export const ROPE_TOW = { from: { x: 432, z: 214 }, to: { x: 424, z: 116 } };

/** Light poles down both sides of Main Street, every 24 m. */
export function streetLights(): { x: number; z: number }[] {
  const out: { x: number; z: number }[] = [];
  const m = ROUTES.find((r) => r.id === 'main')!.pts;
  for (let i = 0; i < m.length - 1; i++) {
    const [ax, az] = m[i];
    const [bx, bz] = m[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const nx = -(bz - az) / len;
    const nz = (bx - ax) / len;
    for (let s = i === 0 ? 8 : 0; s < len; s += 24) {
      const k = s / len;
      for (const side of [-1, 1]) out.push({ x: ax + (bx - ax) * k + nx * 8.5 * side, z: az + (bz - az) * k + nz * 8.5 * side });
    }
  }
  return out;
}

/**
 * Jumps: kickers in the terrain park (built from snow: an analytic ramp the skis and the sled ride,
 * drawn as its own mesh), and natural rollers and cornices on the mountain (shaped into the ground).
 * `yaw` is the way you ride it (the fall line), `len` the run-in, `h` the lip height.
 */
export interface Jump {
  id: string;
  kind: 'kicker' | 'roller' | 'cornice';
  x: number;
  z: number;
  yaw: number;
  len: number;
  w: number;
  h: number;
}
export const JUMPS: Jump[] = [
  // the terrain park, a line of three, smallest first
  { id: 'park-s', kind: 'kicker', x: 404, z: 132, yaw: Math.PI, len: 7, w: 6, h: 1.4 },
  { id: 'park-m', kind: 'kicker', x: 410, z: 160, yaw: Math.PI, len: 9, w: 7, h: 2.2 },
  { id: 'park-l', kind: 'kicker', x: 416, z: 188, yaw: Math.PI, len: 11, w: 8, h: 3.0 },
  // natural rollers down the Tannberg run and a cornice off the shelf
  { id: 'roll-1', kind: 'roller', x: 573, z: -210, yaw: Math.PI, len: 22, w: 28, h: 3 },
  { id: 'roll-2', kind: 'roller', x: 582, z: -125, yaw: Math.PI, len: 22, w: 28, h: 2.8 },
  { id: 'roll-3', kind: 'roller', x: 540, z: -35, yaw: Math.PI, len: 22, w: 28, h: 3.2 },
  { id: 'roll-4', kind: 'roller', x: 540, z: 50, yaw: Math.PI, len: 24, w: 30, h: 3.4 },
  { id: 'cornice-1', kind: 'cornice', x: 548, z: 122, yaw: Math.PI, len: 18, w: 24, h: 3.6 },
];

/**
 * Extra height of a jump at a point (m): a kicker's ramp rises on a curved transition to the lip and
 * stops dead (its back wall), a roller is a smooth hump, a cornice a lip with a drop below it.
 */
export function jumpHeight(j: Jump, x: number, z: number): number {
  // into the jump's frame: u along the way you ride it (0 at the start), v across
  const fx = -Math.sin(j.yaw);
  const fz = -Math.cos(j.yaw);
  const dx = x - j.x;
  const dz = z - j.z;
  const u = dx * fx + dz * fz + j.len / 2;
  const v = Math.abs(-dx * fz + dz * fx);
  if (v > j.w / 2 + 3) return 0;
  const side = v < j.w / 2 ? 1 : Math.max(0, 1 - (v - j.w / 2) / 3);
  const sm = side * side * (3 - 2 * side);
  if (j.kind === 'kicker') {
    if (u < 0 || u > j.len + 1.2) return 0;
    if (u <= j.len) {
      const k = u / j.len;
      return j.h * k * k * sm;
    }
    // the back wall: down to the snow in just over a metre
    return j.h * (1 - (u - j.len) / 1.2) * sm;
  }
  if (j.kind === 'roller') {
    if (u < 0 || u > j.len) return 0;
    const k = u / j.len;
    return j.h * Math.sin(Math.PI * k) ** 2 * sm;
  }
  // cornice: a lip built up over the run-in, then the slope below dug away
  if (u < 0 || u > j.len * 1.8) return 0;
  if (u <= j.len) return j.h * Math.sin((Math.PI / 2) * (u / j.len)) * sm;
  return j.h * (1 - (u - j.len) / (j.len * 0.8)) ** 2 * sm - j.h * 0.4 * Math.sin(Math.PI * ((u - j.len) / (j.len * 0.8))) * sm;
}

/** Height above sea level shown on maps and instruments (the valley floor sits at about 1,400 m). */
export const elevation = (y: number) => Math.round(1180 + y * 2.6);
