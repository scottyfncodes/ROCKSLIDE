import { describe, expect, it } from 'vitest';
import { loadProfile, migrate, newProfile, OLD_HQ, SAVE_KEY, SAVE_VERSION, type Store } from '../src/progress/profile';
import { HQ_SHIFT, SPOTS } from '../src/world/station';

const mem = (): Store & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
};

describe('save migration', () => {
  it('moves a version-1 save parked at the old station into the town, keeping its progress', () => {
    const v1 = {
      version: 1,
      funds: 812,
      rep: 340,
      completed: { rounds: 1, survey: 1 },
      badges: ['b-lake'],
      upgrades: ['kennel'],
      player: { x: -33.5, z: 243.2, yaw: 1, mode: 'foot' },
      sled: { x: 23, z: 226, yaw: 0 },
      heli: { x: -24, z: 292, yaw: 0 },
    };
    const st = mem();
    st.setItem(SAVE_KEY, JSON.stringify(v1));
    const p = loadProfile(st)!;
    expect(p.version).toBe(SAVE_VERSION);
    expect(p.funds).toBe(812);
    expect(p.rep).toBe(340);
    expect(p.completed).toEqual({ rounds: 1, survey: 1 });
    expect(p.badges).toEqual(['b-lake']);
    expect(p.upgrades).toEqual(['kennel']);
    expect(p.player.x).toBeCloseTo(-33.5 + HQ_SHIFT.x);
    expect(p.player.z).toBeCloseTo(243.2 + HQ_SHIFT.z);
    expect(Math.hypot(p.sled.x - SPOTS.sled.x, p.sled.z - SPOTS.sled.z)).toBeLessThan(0.01);
    expect(Math.hypot(p.heli.x - SPOTS.heli.x, p.heli.z - SPOTS.heli.z)).toBeLessThan(0.01);
    // the new fields come in at their defaults
    expect(p.trickPoints).toBe(0);
    expect(p.trickBest).toBe(0);
  });

  it('leaves a version-1 save out on the mountain where it was', () => {
    const p = migrate({ version: 1, player: { x: -640, z: -300, yaw: 0, mode: 'sled' }, sled: { x: -641, z: -298, yaw: 0 } });
    expect(p.player).toMatchObject({ x: -640, z: -300, mode: 'sled' });
    expect(p.sled).toMatchObject({ x: -641, z: -298 });
    expect(Math.hypot(OLD_HQ.x - -640, OLD_HQ.z - -300)).toBeGreaterThan(110);
  });

  it('migrates once: a current save is never shifted again', () => {
    const p = newProfile();
    const again = migrate(JSON.parse(JSON.stringify(p)));
    expect(again.player).toEqual(p.player);
    expect(again.sled).toEqual(p.sled);
  });

  it('repairs a damaged save with defaults rather than losing it', () => {
    const p = migrate({ version: 1, funds: 50, trickPoints: 'lots', player: null });
    expect(p.funds).toBe(50);
    expect(p.trickPoints).toBe(0);
    expect(Number.isFinite(p.player.x)).toBe(true);
  });
});
