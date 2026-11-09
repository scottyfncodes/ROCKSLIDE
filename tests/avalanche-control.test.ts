import { describe, expect, it } from 'vitest';
import { getTerrain } from '../src/world/terrain';
import { GUNS, LOADED, naturalRisk, newControlDay, openRuns, recordNatural, recordShot, safeToFire, shotOutcome, ZONES, POINTS } from '../src/missions/control';
import { Slide } from '../src/sim/slide';
import { beaconDistance, bury, probe, readBeacon, recordSaved, scoreRescue, shovel, survival, FINE_RANGE, BEACON_RANGE, RESCUE_RATE, type Victim } from '../src/missions/rescue';
import { addBond, hasSkill, searchStats } from '../src/actors/bond';

const t = getTerrain();

describe('avalanche control: the day and the zones', () => {
  it('every start zone is a real avalanche slope (30 to 50 degrees) clear of the roads', () => {
    for (const z of ZONES) {
      const deg = (t.slope(z.x, z.z) * 180) / Math.PI;
      expect(deg, z.name).toBeGreaterThan(28);
      expect(deg, z.name).toBeLessThan(52);
    }
  });

  it('the same day gives the same snowpack; a higher danger loads more of it', () => {
    expect(newControlDay(42, 3)).toEqual(newControlDay(42, 3));
    let low = 0;
    let high = 0;
    for (let s = 1; s < 60; s++) {
      low += newControlDay(s, 1).zones.filter((z) => z.load >= LOADED).length;
      high += newControlDay(s, 5).zones.filter((z) => z.load >= LOADED).length;
    }
    expect(high).toBeGreaterThan(low * 2);
  });

  it('a shot on a loaded zone brings it down more often than on a stable one, and is deterministic', () => {
    const day = newControlDay(7, 3);
    day.zones.forEach((z, i) => (z.load = i % 2 ? 0.9 : 0.1));
    for (const z of day.zones) expect(shotOutcome(day, z.id, 'howitzer', 2, 0)).toBe(shotOutcome(day, z.id, 'howitzer', 2, 0));
    const big = day.zones.filter((z) => z.load > 0.5).map((z) => shotOutcome(day, z.id, 'howitzer', 3));
    const small = day.zones.filter((z) => z.load < 0.5).map((z) => shotOutcome(day, z.id, 'howitzer', 3));
    expect(big.filter((o) => o === 'full').length).toBeGreaterThan(0);
    expect(small.every((o) => o !== 'full')).toBe(true);
    // a ski cut never brings down a whole slope, and does nothing on a large one
    for (const z of ZONES) {
      const o = shotOutcome(day, z.id, 'skicut');
      expect(o).not.toBe('full');
      if (z.size === 'large') expect(o).toBe('none');
    }
  });

  it('results are none, a sluff or a full slide, scored and logged', () => {
    const day = newControlDay(3, 4);
    const z = day.zones[0];
    z.load = 0.95;
    const out = shotOutcome(day, z.id, 'howitzer', 3);
    expect(['none', 'sluff', 'full']).toContain(out);
    const pts = recordShot(day, z.id, 'howitzer', 'full', true);
    expect(pts).toBe(POINTS.full);
    expect(z.done).toBe(true);
    expect(day.log.length).toBe(1);
  });

  it('safety: runs open or somebody in the path blocks a safe shot, and firing anyway costs points and rep', () => {
    const day = newControlDay(9, 3);
    expect(safeToFire(day, 0).ok).toBe(true);
    expect(safeToFire(day, 1).ok).toBe(false);
    day.runsClosed = false;
    expect(safeToFire(day, 0).ok).toBe(false);
    const rep = day.rep;
    const pts = recordShot(day, day.zones[0].id, 'howitzer', 'full', false);
    expect(pts).toBe(POINTS.full + POINTS.breach);
    expect(day.rep).toBeLessThan(rep);
    expect(day.breaches).toBe(1);
  });

  it('opening clean pays; a loaded zone left open risks a natural slide that costs points', () => {
    const clean = newControlDay(11, 2);
    for (const z of clean.zones) z.load = 0.1;
    expect(openRuns(clean).points).toBe(POINTS.openSafe);
    const risky = newControlDay(11, 4);
    risky.zones[0].load = 0.9;
    const before = naturalRisk(risky, risky.zones[0]);
    openRuns(risky);
    expect(naturalRisk(risky, risky.zones[0])).toBeGreaterThan(before);
    expect(naturalRisk(risky, risky.zones[1])).toBe(risky.zones[1].load >= LOADED ? naturalRisk(risky, risky.zones[1]) : 0);
    expect(recordNatural(risky, risky.zones[0].id)).toBe(POINTS.naturalOpen);
  });

  it('the guns can reach their zones', () => {
    for (const z of ZONES) {
      for (const m of z.methods) {
        if (m !== 'howitzer' && m !== 'avalauncher') continue;
        const g = GUNS[m];
        const d = Math.hypot(z.x - g.x, z.z - g.z);
        expect(d, `${m} to ${z.name}`).toBeLessThan(g.range);
        expect(d).toBeGreaterThan(g.minRange);
      }
    }
  });
});

describe('a slide on the Tannberg side', () => {
  it('runs downhill out of its start zone, piles up, and stops', () => {
    for (const z of ZONES) {
      const s = new Slide(t, z.x, z.z, z.r, 50, 3).settle();
      const r = s.result();
      expect(s.done).toBe(true);
      expect(r.run, z.name).toBeGreaterThan(z.r);
      // it ended lower than it started
      expect(t.height(r.cx, r.cz), z.name).toBeLessThan(t.height(z.x, z.z));
    }
  });

  it('catches what is in its path and not what is beside it', () => {
    const z = ZONES[0];
    const s = new Slide(t, z.x, z.z, z.r, 60, 5);
    let caughtBelow = false;
    let caughtFar = false;
    const below = { x: z.x + s.dir.x * 40, z: z.z + s.dir.z * 40 };
    for (let i = 0; i < 400 && !s.done; i++) {
      s.step(1 / 30);
      if (s.caught(below.x, below.z)) caughtBelow = true;
      if (s.caught(z.x - s.dir.z * 150, z.z + s.dir.x * 150)) caughtFar = true;
    }
    expect(caughtBelow).toBe(true);
    expect(caughtFar).toBe(false);
  });
});

describe('avalanche rescue', () => {
  const v: Victim = { id: 'a', name: 'A', x: 10, z: 20, depth: 1.2, beacon: true, probed: false, dug: 0, out: false, marked: false };

  it('the survival clock stays high for the first 15 minutes, then drops sharply', () => {
    expect(survival(0)).toBe(1);
    expect(survival(15)).toBeCloseTo(0.92, 2);
    expect(survival(10)).toBeGreaterThan(0.9);
    expect(survival(35)).toBeLessThan(0.35);
    // the steepest fall is between 15 and 35 minutes
    expect(survival(15) - survival(35)).toBeGreaterThan(survival(0) - survival(15) + 0.4);
    for (let m = 0; m < 200; m += 5) expect(survival(m + 5)).toBeLessThanOrEqual(survival(m));
    // 15 rescue minutes take two and a half real minutes
    expect(15 / RESCUE_RATE).toBeCloseTo(2.5);
  });

  it('beacon distance is 3D: across the snow and down to the victim', () => {
    expect(beaconDistance(10, 20, v)).toBeCloseTo(1.2);
    expect(beaconDistance(13, 24, v)).toBeCloseTo(Math.hypot(3, 4, 1.2));
  });

  it('three stages: no signal out of range, an arrow and a distance, then distance only up close', () => {
    expect(readBeacon(10 + BEACON_RANGE + 5, 20, [v]).stage).toBe('signal');
    const c = readBeacon(10, 20 + 30, [v]);
    expect(c.stage).toBe('coarse');
    // the victim is north of the reader (smaller z): the arrow points north
    expect(Math.abs(c.bearing!)).toBeLessThan(0.01);
    expect(c.distance).toBeCloseTo(Math.hypot(30, 1.2), 1);
    const f = readBeacon(10.5, 20.5, [v]);
    expect(f.stage).toBe('fine');
    expect(f.bearing).toBeNull();
    expect(f.distance).toBeLessThanOrEqual(FINE_RANGE);
    // the strongest reading is right above, and it reads the depth
    expect(readBeacon(10, 20, [v]).distance).toBeCloseTo(1.2);
    // no beacon: no signal at all
    expect(readBeacon(10, 20, [{ ...v, beacon: false }]).stage).toBe('signal');
  });

  it('probe, then shovel: a steady rhythm digs faster', () => {
    const b = bury(0, 0, 20, 3, 9);
    const w = b.victims[0];
    expect(w.beacon).toBe(true);
    expect(probe(w.x + 2, w.z, b.victims)).toBeNull();
    expect(probe(w.x + 0.3, w.z, b.victims)).toBe(w);
    const a = { ...w, dug: 0, out: false };
    const c = { ...w, dug: 0, out: false };
    let ns = 0;
    while (!a.out) {
      shovel(a, 0.3);
      ns++;
    }
    let nr = 0;
    while (!c.out) {
      shovel(c, 1);
      nr++;
    }
    expect(ns).toBeLessThan(nr);
  });

  it('buries different depths, some without a beacon, the same way for the same seed', () => {
    const b = bury(100, 100, 25, 4, 21);
    expect(bury(100, 100, 25, 4, 21)).toEqual(b);
    expect(new Set(b.victims.map((x) => x.depth)).size).toBeGreaterThan(1);
    let none = 0;
    for (let s = 0; s < 40; s++) none += bury(0, 0, 20, 3, s).victims.filter((x) => !x.beacon).length;
    expect(none).toBeGreaterThan(5);
  });

  it('scores on time, survival and technique', () => {
    const fast = bury(0, 0, 20, 1, 4);
    fast.minutes = 6;
    fast.probes = fast.probeHits = 1;
    fast.strokes = fast.steadyStrokes = 20;
    recordSaved(fast, fast.victims[0]);
    const slow = bury(0, 0, 20, 1, 4);
    slow.minutes = 40;
    slow.probes = 5;
    slow.probeHits = 1;
    slow.strokes = 20;
    recordSaved(slow, slow.victims[0]);
    const a = scoreRescue(fast);
    const b = scoreRescue(slow);
    expect(a.total).toBeGreaterThan(b.total);
    expect(a.stars).toBe(3);
    expect(b.stars).toBeLessThan(3);
  });
});

describe("Koda's bond", () => {
  it('grows with play and rescues, caps at 100, and opens skills in order', () => {
    let bond = 0;
    const opened: string[] = [];
    for (let i = 0; i < 20; i++) {
      const r = addBond(bond, 8);
      bond = r.bond;
      opened.push(...r.opened.map((s) => s.id));
    }
    expect(bond).toBe(100);
    expect(opened).toEqual(['nose', 'range', 'finder', 'warning']);
    expect(hasSkill(19, 'nose')).toBe(false);
    expect(searchStats(45).radius).toBeGreaterThan(searchStats(0).radius);
    expect(searchStats(25).speed).toBeGreaterThan(searchStats(0).speed);
  });
});
