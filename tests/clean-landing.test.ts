import { describe, expect, it } from 'vitest';
import { CLEAN, cleanLanding, newGlider, SKIS, SLED, stepGlider, type Glider } from '../src/actors/glide';
import { Colliders } from '../src/world/colliders';
import type { Terrain } from '../src/world/terrain';

const dt = 1 / 60;
const solid = new Colliders();
// a straight run whose height follows h(distance), as in tests/actors.test.ts
const profile = (h: (s: number) => number) => {
  const n = (s: number) => {
    const k = h(s + 0.5) - h(s - 0.5);
    const m = Math.hypot(1, k);
    return { x: 0, y: 1 / m, z: k / m };
  };
  return { height: (_x: number, z: number) => 100 + h(-z), normal: (_x: number, z: number) => n(-z), surface: () => 'packed', inBounds: () => true } as unknown as Terrain;
};
const kicker = profile((s) => (s < 40 ? 0 : s < 44 ? (s - 40) * Math.tan(0.17) : 4 * Math.tan(0.17) - (s - 44) * 0.5));
const with_ = (flew: number, into: number) => ({ flew, into }) as Glider;

describe('the clean-landing callout', () => {
  it('names a long jump set down softly, and nothing else', () => {
    expect(cleanLanding(with_(1.2, 2))).toBe(1.2);
    expect(cleanLanding(with_(1.2, CLEAN.maxInto + 1))).toBe(0); // slammed in
    expect(cleanLanding(with_(CLEAN.minAir - 0.1, 0))).toBe(0); // a hop, not a jump
    expect(cleanLanding(with_(0, 0))).toBe(0); // no landing this step
  });

  for (const [name, p] of [['sled', SLED], ['skis', SKIS]] as const)
    it(`reports the ${name}'s flight once, on the step it lands, with its real air time`, () => {
      const g = newGlider(0, 0, 0, kicker);
      g.vz = -18;
      let air = 0;
      const landings: { flew: number; air: number; into: number; landed: number }[] = [];
      for (let i = 0; i < 60 * 5; i++) {
        const was = g.airborne;
        stepGlider(g, p, 0, 0.6, dt, kicker, solid, null);
        if (g.airborne) air += dt;
        if (g.flew) landings.push({ flew: g.flew, air, into: g.into, landed: g.landed });
        if (was && !g.airborne) air = 0;
      }
      expect(landings).toHaveLength(1);
      expect(landings[0].flew).toBeGreaterThan(CLEAN.minAir);
      expect(Math.abs(landings[0].flew - landings[0].air)).toBeLessThan(dt * 1.5);
      expect(landings[0].into).toBeGreaterThan(0);
      // the sled's own landing hardness is already speed into the slope: the callout reads the same number
      if (name === 'sled') expect(landings[0].into).toBeCloseTo(landings[0].landed, 5);
    });
});
