import { describe, expect, it } from 'vitest';
import { newGlider, SKIS, stepGlider } from '../src/actors/glide';
import { crouchOf, JUMP, newJump, stepJump, type JumpPop, type JumpState } from '../src/actors/jump';
import { buildColliders } from '../src/world/station';
import { getTerrain } from '../src/world/terrain';

const dt = 1 / 60;

/** Hold JUMP on the snow for `secs`, then let go: the pop. */
function hold(j: JumpState, secs: number): JumpPop | null {
  let pop: JumpPop | null = null;
  for (let t = 0; t < secs; t += dt) pop = stepJump(j, true, false, 0, dt) ?? pop;
  return stepJump(j, false, false, 0, dt) ?? pop;
}

describe('the jump on skis', () => {
  it('crouches at once on the press, deeper as it charges, and only pops on the release', () => {
    const j = newJump();
    expect(stepJump(j, true, false, 0, dt)).toBeNull();
    expect(crouchOf(j)).toBeGreaterThanOrEqual(JUMP.crouchMin);
    const first = crouchOf(j);
    for (let i = 0; i < 10; i++) expect(stepJump(j, true, false, 0, dt)).toBeNull();
    expect(crouchOf(j)).toBeGreaterThan(first);
    const pop = stepJump(j, false, false, 0, dt);
    expect(pop).not.toBeNull();
    expect(pop!.lip).toBe(false);
    expect(crouchOf(j)).toBe(0);
  });

  it('a tap is a small hop; a full crouch is the biggest pop, and holding longer adds nothing', () => {
    const tap = hold(newJump(), dt)!;
    const full = hold(newJump(), JUMP.chargeSecs + 0.05)!;
    const longer = hold(newJump(), 2)!;
    expect(tap.vy).toBeGreaterThanOrEqual(JUMP.pop);
    expect(tap.vy).toBeLessThan(JUMP.pop + 0.2);
    expect(full.vy).toBeCloseTo(JUMP.pop + JUMP.charged, 5);
    expect(longer.vy).toBeCloseTo(full.vy, 5);
  });

  it('carried over a lip, a release just after the skis leave the snow still pops (a little less)', () => {
    const j = newJump();
    for (let t = 0; t < JUMP.chargeSecs; t += dt) stepJump(j, true, false, 0, dt);
    stepJump(j, true, true, 0, dt);
    const pop = stepJump(j, false, true, JUMP.late * 0.5, dt)!;
    expect(pop.lip).toBe(true);
    expect(pop.vy).toBeCloseTo((JUMP.pop + JUMP.charged) * JUMP.lipKeep, 1);
  });

  it('held too long past the lip, the crouch is spent: no pop, and no second pop in one flight', () => {
    const j = newJump();
    for (let t = 0; t < 0.3; t += dt) stepJump(j, true, false, 0, dt);
    let air = 0;
    for (; air < JUMP.late + 0.1; air += dt) stepJump(j, true, true, air, dt);
    expect(crouchOf(j)).toBe(0);
    expect(stepJump(j, false, true, air, dt)).toBeNull();
    // popped off the flat, a second press in the same flight does nothing
    const k = newJump();
    expect(hold(k, 0.2)).not.toBeNull();
    stepJump(k, true, true, 0.02, dt);
    expect(stepJump(k, false, true, 0.04, dt)).toBeNull();
  });

  it('a press that starts in the air does nothing, even if it is still held on landing', () => {
    const j = newJump();
    stepJump(j, true, true, 0.5, dt);
    expect(crouchOf(j)).toBe(0);
    // touching down with it still held: dead until it lets go
    stepJump(j, true, false, 0, dt);
    expect(stepJump(j, false, false, 0, dt)).toBeNull();
    // the next press works
    expect(hold(j, 0.1)).not.toBeNull();
  });

  it('nothing while out of control (a wipeout): no crouch, no pop', () => {
    const j = newJump();
    stepJump(j, true, false, 0, dt, false);
    expect(crouchOf(j)).toBe(0);
    stepJump(j, true, false, 0, dt, true);
    expect(stepJump(j, false, false, 0, dt, true)).toBeNull();
  });

  it('on the real snow: a full crouch on the flat is air enough for a 360, and a pop at the lip flies further', () => {
    const t = getTerrain();
    const solid = buildColliders();
    const flight = (x: number, z: number, yaw: number, v: number, letGo: ((g: ReturnType<typeof newGlider>, k: number) => boolean) | null) => {
      const g = newGlider(x, z, yaw, t);
      g.vx = -Math.sin(yaw) * v;
      g.vz = -Math.cos(yaw) * v;
      const j = newJump();
      let gone = !letGo;
      let air = 0;
      for (let k = 0; k < 360; k++) {
        if (!gone && letGo!(g, k)) gone = true;
        const p = stepJump(j, !gone, g.airborne, g.air, dt);
        if (p?.lip) g.vy += p.vy;
        else if (p) {
          g.vy = Math.max(-12, Math.min(6, g.vy)) + p.vy;
          g.airborne = true;
          g.air = 0;
        }
        const was = g.airborne;
        stepGlider(g, SKIS, 0, 0, dt, t, solid, null, 1);
        if (g.airborne) air += dt;
        else if (was && air > 0.1) break;
      }
      return air;
    };
    // the level snow west of the plaza: a tap is a hop, a full crouch over a second
    expect(t.slope(380, 238)).toBeLessThan(0.02);
    const tap = flight(380, 238, 0, 0, (_, k) => k >= 1);
    const full = flight(380, 238, 0, 0, (_, k) => k >= 30);
    expect(tap).toBeGreaterThan(0.5);
    expect(tap).toBeLessThan(0.7);
    // a 360 is a 0.2 s hold then 0.62 s of spin: it fits
    expect(full).toBeGreaterThan(0.2 + 0.62 + 0.15);
    // the big kicker at 13 m/s: let go right at the lip against not at all
    const lip = { x: 416, z: 188 + 5.5 };
    const none = flight(416, 158, Math.PI, 13, null);
    const popped = flight(416, 158, Math.PI, 13, (g) => g.z >= lip.z - 0.5);
    expect(none).toBeGreaterThan(1.5);
    expect(popped).toBeGreaterThan(none * 1.25);
  });
});
