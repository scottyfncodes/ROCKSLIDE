// Jump lab: the real ski model (src/actors/glide.ts) and the jump (src/actors/jump.ts) on the real valley,
// at the game's fixed 60 Hz. Measures the air a pop gives on the flat (by how long JUMP was held) and off
// the terrain park's big kicker (by where it was let go, in metres from the lip), against no pop at all.
//
//   npx tsx scripts/jumplab.ts
//
// "air" is seconds off the snow, "peak" the highest the skis got above the snow under them.
import { newGlider, SKIS, stepGlider } from '../src/actors/glide';
import { newJump, stepJump } from '../src/actors/jump';
import { JUMPS } from '../src/world/places';
import { buildColliders } from '../src/world/station';
import { getTerrain } from '../src/world/terrain';

const t = getTerrain();
const solid = buildColliders();
const DT = 1 / 60;

/** Ski straight from (x, z) on `yaw` at `v` m/s, JUMP held from the start until `letGo` says so; the first flight. */
function run(x: number, z: number, yaw: number, v: number, letGo: ((g: ReturnType<typeof newGlider>, step: number) => boolean) | null) {
  const g = newGlider(x, z, yaw, t);
  g.vx = -Math.sin(yaw) * v;
  g.vz = -Math.cos(yaw) * v;
  const j = newJump();
  let gone = !letGo;
  let air = 0;
  let peak = 0;
  for (let k = 0; k < 60 * 6; k++) {
    if (!gone && letGo!(g, k)) gone = true;
    const p = stepJump(j, !gone, g.airborne, g.air, DT);
    if (p?.lip) g.vy += p.vy;
    else if (p) {
      g.vy = Math.max(-12, Math.min(6, g.vy)) + p.vy;
      g.airborne = true;
      g.air = 0;
    }
    const was = g.airborne;
    stepGlider(g, SKIS, 0, 0, DT, t, solid, null, 1);
    if (g.airborne) {
      air += DT;
      peak = Math.max(peak, g.y - t.height(g.x, g.z));
    } else if (was && air > 0.1) break;
  }
  return `air ${air.toFixed(2)} s, peak ${peak.toFixed(2)} m`;
}

// the flat: the first level, open spot west of the plaza
let fx = 0;
let fz = 0;
for (let x = 380; x < 520 && !fx; x += 2) for (let z = 200; z < 330 && !fx; z += 2) if (t.slope(x, z) < 0.02 && !solid.resolve(x, z, 2).hit) [fx, fz] = [x, z];
console.log(`The flat (${fx}, ${fz}):`);
for (const steps of [1, 6, 14, 27]) console.log(`  standing, held ${(steps / 60).toFixed(2)} s: ${run(fx, fz, 0, 0, (_, k) => k >= steps)}`);
for (const steps of [1, 27]) console.log(`  at 8 m/s, held ${(steps / 60).toFixed(2)} s: ${run(fx, fz, 0, 8, (_, k) => k >= steps)}`);

// the big kicker, ridden straight at 13 m/s from 30 m out
const K = JUMPS.find((j) => j.id === 'park-l')!;
const fwd = { x: -Math.sin(K.yaw), z: -Math.cos(K.yaw) };
const start = { x: K.x - fwd.x * 30, z: K.z - fwd.z * 30 };
const toLip = (g: { x: number; z: number }) => (g.x - K.x) * fwd.x + (g.z - K.z) * fwd.z - K.len / 2;
console.log(`The big kicker (${K.id}, ${K.h} m):`);
console.log(`  no pop: ${run(start.x, start.z, K.yaw, 13, null)}`);
for (const at of [-3, -1.5, -0.5, 0, 0.8, 1.6, 3]) console.log(`  let go ${at >= 0 ? '+' : ''}${at} m from the lip: ${run(start.x, start.z, K.yaw, 13, (g) => toLip(g) >= at)}`);
