import { describe, expect, it } from 'vitest';
import { grade, jumpScore, newTricks, offTurn, stepTricks, TRICK, type TrickEvent, type TrickInput, type TrickState } from '../src/actors/tricks';

const dt = 1 / 60;
const idle: TrickInput = { held: false, sx: 0, sy: 0 };

/** Fly for `secs` with the given input per step, then land; returns every event. */
function jump(s: TrickState, plan: (t: number) => TrickInput, secs: number): TrickEvent[] {
  const ev: TrickEvent[] = [];
  for (let t = 0; t < secs; t += dt) ev.push(...stepTricks(s, plan(t), true, dt));
  ev.push(...stepTricks(s, idle, false, dt));
  return ev;
}
const land = (ev: TrickEvent[]) => ev.find((e) => e.type === 'land')!;

describe('tricks', () => {
  it('a tap in the air is a grab, scored on a clean landing', () => {
    const s = newTricks();
    const ev = jump(s, (t) => ({ held: t > 0.1 && t < 0.18, sx: 0, sy: 0 }), 1.0);
    expect(ev.some((e) => e.type === 'trick' && e.trick!.kind === 'grab' && e.trick!.name === 'Mute grab')).toBe(true);
    const l = land(ev);
    expect(l.landing).toBe('clean');
    expect(l.points).toBe(jumpScore([{ kind: 'grab', name: 'Mute grab', points: TRICK.points.grab }], s.airT, false));
    expect(l.boost).toBeGreaterThan(0);
    expect(s.score).toBe(l.points);
  });

  it('a hold spins; let go and it finishes the turn it is on: a clean 360', () => {
    const s = newTricks();
    // hold for 0.45 s (the spin starts at 0.2 s), let go: it rotates on to 360 and stops there
    const ev = jump(s, (t) => ({ held: t > 0.05 && t < 0.5, sx: 0, sy: 0 }), 1.35);
    expect(ev.some((e) => e.type === 'trick' && e.trick!.name === '360')).toBe(true);
    const l = land(ev);
    expect(l.landing).toBe('clean');
    expect(l.off).toBeLessThan(1);
  });

  it('holding into a 720 replaces the 360 in the combo', () => {
    const s = newTricks();
    const ev = jump(s, (t) => ({ held: t > 0.05 && t < 0.95, sx: 1, sy: 0 }), 1.95);
    const l = land(ev);
    expect(l.landing).toBe('clean');
    expect(l.combo).toBe(1);
    expect(l.points).toBe(jumpScore([{ kind: 'spin', name: '720', points: TRICK.points.spin * 2 }], s.airT, false));
  });

  it('chains a grab and a back flip into a two-trick combo', () => {
    const s = newTricks();
    const ev = jump(s, (t) => (t > 0.03 && t < 0.08 ? { held: true, sx: 0, sy: 0 } : t > 0.2 && t < 0.4 ? { held: true, sx: 0, sy: -1 } : idle), 1.4);
    const l = land(ev);
    expect(l.landing).toBe('clean');
    expect(l.combo).toBe(2);
    expect(ev.filter((e) => e.type === 'trick').map((e) => e.trick!.name)).toEqual(['Mute grab', 'back flip']);
  });

  it('landing mid-rotation is a stumble or a wipeout, with a short recovery and no points', () => {
    const half = newTricks();
    const ev = jump(half, (t) => ({ held: t > 0.05 && t < 0.5, sx: 0, sy: 0 }), 0.25 + 0.31);
    expect(['stumble', 'wipeout']).toContain(land(ev).landing);
    expect(land(ev).points).toBe(0);
    expect(half.recoverT).toBeGreaterThan(0);
    expect(half.recoverT).toBeLessThanOrEqual(TRICK.wipeoutSecs);
    expect(grade(Math.PI, 0).landing).toBe('wipeout');
    expect(grade((70 * Math.PI) / 180, 0).landing).toBe('stumble');
    expect(grade((30 * Math.PI) / 180, 0).landing).toBe('clean');
    expect(offTurn(Math.PI * 2 + 0.1)).toBeCloseTo((0.1 * 180) / Math.PI, 5);
  });

  it('a press from the ground carries no trick into the air', () => {
    const s = newTricks();
    stepTricks(s, { held: true, sx: 0, sy: 0 }, false, dt);
    const ev = jump(s, () => ({ held: true, sx: 0, sy: 0 }), 1);
    expect(land(ev).combo).toBe(0);
  });

  it('the style meter fills with tricks and clean lines, drains slowly, and pays out when full', () => {
    const s = newTricks();
    for (let i = 0; i < 60; i++) stepTricks(s, idle, false, dt, true);
    expect(s.style).toBeCloseTo(TRICK.styleLine, 2);
    const before = s.style;
    for (let i = 0; i < 60; i++) stepTricks(s, idle, false, dt, false);
    expect(s.style).toBeLessThan(before);
    expect(s.style).toBeGreaterThan(before - 0.05);
    s.style = 0.999;
    const ev = jump(s, (t) => ({ held: t > 0.1 && t < 0.15, sx: 0, sy: 0 }), 1);
    expect(ev.some((e) => e.type === 'styleFull')).toBe(true);
    expect(s.hotT).toBeGreaterThan(0);
    // and a jump while it is hot scores double
    const hot = jump(s, (t) => ({ held: t > 0.1 && t < 0.15, sx: 0, sy: 0 }), 1);
    expect(land(hot).points).toBe(jumpScore([{ kind: 'grab', name: 'Mute grab', points: TRICK.points.grab }], s.airT || 1, true));
  });
});

describe('the terrain park', async () => {
  const { getTerrain } = await import('../src/world/terrain');
  const { newGlider, stepGlider, SKIS } = await import('../src/actors/glide');
  const { buildColliders } = await import('../src/world/station');
  const { JUMPS } = await import('../src/world/places');
  const t = getTerrain();
  const solid = buildColliders();

  it('each kicker, ridden straight at park speed, throws real air and lands on the slope below', () => {
    for (const j of JUMPS.filter((k) => k.kind === 'kicker')) {
      // run in from 25 m above the kicker, straight down the line
      const g = newGlider(j.x, j.z - j.len / 2 - 25, Math.PI, t);
      g.vz = 9;
      let air = 0;
      let longest = 0;
      for (let i = 0; i < 60 * 6; i++) {
        stepGlider(g, SKIS, 0, 0, 1 / 60, t, solid, null);
        if (g.airborne) air += 1 / 60;
        else if (air) {
          longest = Math.max(longest, air);
          air = 0;
        }
        if (g.z > j.z + 40) break;
      }
      expect(longest, j.id).toBeGreaterThan(0.6);
      expect(longest, j.id).toBeLessThan(3.5);
    }
  });
});

describe('natural jumps on the Tannberg run', async () => {
  const { getTerrain } = await import('../src/world/terrain');
  const { newGlider, stepGlider, SKIS } = await import('../src/actors/glide');
  const { buildColliders } = await import('../src/world/station');
  const { JUMPS } = await import('../src/world/places');
  const t = getTerrain();
  const solid = buildColliders();
  it('a fast skier straight down the run catches air off the rollers and the cornice', () => {
    let jumps = 0;
    for (const j of JUMPS.filter((k) => k.kind !== 'kicker')) {
      const g = newGlider(j.x, j.z - j.len / 2 - 30, Math.PI, t);
      g.vz = 15;
      let air = 0;
      let longest = 0;
      for (let i = 0; i < 60 * 5; i++) {
        stepGlider(g, SKIS, 0, 0, 1 / 60, t, solid, null);
        if (g.airborne) air += 1 / 60;
        else if (air) {
          longest = Math.max(longest, air);
          air = 0;
        }
        if (g.z > j.z + 40) break;
      }
      if (longest > 0.3) jumps++;
    }
    expect(jumps).toBeGreaterThanOrEqual(3);
  });
});
