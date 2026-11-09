import { Colliders, roomWalls } from './colliders';
import { BUNKER, FUEL, VILLAGE } from './places';

/**
 * Kessel Patrol Station: the home base. It starts as a log lodge, a garage, a helipad and a
 * dog house, and grows as the operation does. Every upgrade is a building you can walk up to.
 */

/**
 * The station was laid out round (0, 250) before the town was planned; it now stands on the west
 * side of Main Street. Every place in it keeps its old layout, moved by this much.
 */
export const HQ_SHIFT = { x: 385, z: 50 };
const X = HQ_SHIFT.x;
const Z = HQ_SHIFT.z;
export const HQ = { x: 0 + X, z: 250 + Z };

export const LODGE = { x: -30 + X, z: 245 + Z, w: 16, d: 12, wallH: 3.1 };
export const GARAGE = { x: 24 + X, z: 226 + Z, w: 12, d: 10, wallH: 3.6 };
export const PAD = { x: -24 + X, z: 292 + Z, r: 8 };
export const HANGAR = { x: -1 + X, z: 292 + Z, w: 14, d: 16, wallH: 6 };
export const EQUIP = { x: 25 + X, z: 211 + Z, w: 9, d: 6, wallH: 3 };
export const WING = { x: -30 + X, z: 231 + Z, w: 12, d: 8, wallH: 3 };
export const KENNEL = { x: -8 + X, z: 272 + Z };
export const MAST = { x: -52 + X, z: 220 + Z };

/** Where things are inside and around the station. */
export const SPOTS = {
  bed: { x: -35.2 + X, z: 240.8 + Z },
  fireplace: { x: -37 + X, z: 247.5 + Z },
  table: { x: -29 + X, z: 246 + Z },
  wardrobe: { x: -24.5 + X, z: 240.3 + Z },
  badges: { x: -30.5 + X, z: 250.6 + Z },
  dogBed: { x: -35 + X, z: 250 + Z },
  lodgeDoor: { x: -21.5 + X, z: 245 + Z },
  lodgeInside: { x: -27 + X, z: 245 + Z },
  sled: { x: 23 + X, z: 226 + Z, yaw: Math.PI / 2 },
  workbench: { x: 28.6 + X, z: 222 + Z },
  locker: { x: 28.6 + X, z: 230.2 + Z },
  crate: { x: 12 + X, z: 236 + Z },
  bowl: { x: -5.5 + X, z: 274.5 + Z },
  kennel: { x: -8 + X, z: 272 + Z },
  heli: { x: PAD.x, z: PAD.z, yaw: Math.PI / 2 },
  equipDoor: { x: 25 + X, z: 214.6 + Z },
  hangarDoor: { x: -8 + X, z: 292 + Z },
  mast: { x: MAST.x, z: MAST.z },
};

export type UpgradeId = 'workshop' | 'hangar' | 'equipment' | 'kennel' | 'mast' | 'wing' | 'lights';

export interface Upgrade {
  id: UpgradeId;
  name: string;
  blurb: string;
  cost: number;
  /** patrol rank needed */
  rank: number;
  /** what it opens */
  opens: string;
}

export const UPGRADES: Upgrade[] = [
  { id: 'kennel', name: 'Kennel run', blurb: 'A fenced run and a proper house for Koda.', cost: 150, rank: 0, opens: 'Husky gear, and Koda tracks scent further' },
  { id: 'workshop', name: 'Garage workshop', blurb: 'A bench, a hoist and real tools.', cost: 220, rank: 1, opens: 'Sled engines, tracks and paint' },
  { id: 'equipment', name: 'Equipment room', blurb: 'Racks for skis, ropes and rescue packs.', cost: 260, rank: 1, opens: 'Ski and uniform gear' },
  { id: 'hangar', name: 'Helicopter hangar', blurb: 'A home for the helicopter out of the weather.', cost: 400, rank: 2, opens: 'Thermal scanner, searchlight, paint' },
  { id: 'mast', name: 'Radio mast', blurb: 'Hear calls from every corner of the valley.', cost: 300, rank: 2, opens: 'Old patrol badges show on the map' },
  { id: 'wing', name: 'Lodge wing', blurb: 'A bunk room and a wall for everything you have found.', cost: 450, rank: 3, opens: 'Sleeping pays a night shift bonus' },
  { id: 'lights', name: 'Yard lights and flags', blurb: 'Lanterns along the yard and the patrol flag on a pole.', cost: 120, rank: 0, opens: 'The station glows at night' },
];

export const upgradeDef = (id: UpgradeId) => UPGRADES.find((u) => u.id === id)!;

/** Every solid thing in the valley that is not a tree. */
export function buildColliders(): Colliders {
  const c = new Colliders();
  for (const b of roomWalls(LODGE.x, LODGE.z, LODGE.w, LODGE.d, { side: 'e', width: 2.4 })) c.add(b);
  // inside the lodge: the table, the bed, the hearth
  c.add({ x: SPOTS.table.x, z: SPOTS.table.z, hw: 1.5, hd: 1, rot: 0 });
  c.add({ x: -35.6 + X, z: 240.2 + Z, hw: 1.9, hd: 1.0, rot: 0 });
  c.add({ x: -37.6 + X, z: 247.5 + Z, hw: 0.4, hd: 1.4, rot: 0 });
  // outside the lodge's yard (south) wall: the woodpile under the eaves (Art Direction A, rs_lodge)
  c.add({ x: LODGE.x + 3, z: LODGE.z + LODGE.d / 2 + 0.6, hw: 0.8, hd: 0.35, rot: 0 });
  for (const b of roomWalls(GARAGE.x, GARAGE.z, GARAGE.w, GARAGE.d, { side: 'w', width: 5.5 })) c.add(b);
  c.add({ x: SPOTS.workbench.x + 1.2, z: SPOTS.workbench.z, hw: 0.6, hd: 1.4, rot: 0, tag: 'workshop' });
  c.add({ x: HANGAR.x + 2, z: HANGAR.z - HANGAR.d / 2, hw: HANGAR.w / 2 - 2, hd: 0.3, rot: 0, tag: 'hangar' });
  c.add({ x: HANGAR.x + 2, z: HANGAR.z + HANGAR.d / 2, hw: HANGAR.w / 2 - 2, hd: 0.3, rot: 0, tag: 'hangar' });
  c.add({ x: HANGAR.x + HANGAR.w / 2, z: HANGAR.z, hw: 0.3, hd: HANGAR.d / 2, rot: 0, tag: 'hangar' });
  c.add({ x: EQUIP.x, z: EQUIP.z, hw: EQUIP.w / 2, hd: EQUIP.d / 2, rot: 0, tag: 'equipment' });
  c.add({ x: WING.x, z: WING.z, hw: WING.w / 2, hd: WING.d / 2, rot: 0, tag: 'wing' });
  c.add({ x: KENNEL.x, z: KENNEL.z, hw: 1.1, hd: 1.3, rot: 0 });
  c.add({ x: MAST.x, z: MAST.z, hw: 1.2, hd: 1.2, rot: 0, tag: 'mast' });
  // the avalanche control bunker and the fuel island
  c.add({ x: BUNKER.x, z: BUNKER.z, hw: 4.6, hd: 3.4, rot: BUNKER.rot });
  c.add({ x: FUEL.x + Math.sin(FUEL.rot) * -2.4, z: FUEL.z + Math.cos(FUEL.rot) * -2.4, hw: 2.3, hd: 1.2, rot: FUEL.rot });
  for (const v of VILLAGE) {
    const size = v.kind === 'lodge' || v.kind === 'bar' ? [9, 7] : v.kind === 'baselodge' ? [10, 7.5] : v.kind === 'condo' ? [8, 6.5] : v.kind === 'gear' || v.kind === 'rentals' ? [6.5, 5.5] : v.kind === 'chapel' ? [5, 8] : v.kind === 'clinic' ? [7, 6] : [5.5, 5];
    c.add({ x: v.x, z: v.z, hw: size[0] / 2, hd: size[1] / 2, rot: v.rot });
  }
  return c;
}

/** Inside the lodge (for the roof cutaway and the warm light). */
export function inLodge(x: number, z: number): boolean {
  return Math.abs(x - LODGE.x) < LODGE.w / 2 && Math.abs(z - LODGE.z) < LODGE.d / 2;
}
export function inGarage(x: number, z: number): boolean {
  return Math.abs(x - GARAGE.x) < GARAGE.w / 2 && Math.abs(z - GARAGE.z) < GARAGE.d / 2;
}
