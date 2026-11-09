import { describe, expect, it } from 'vitest';
import { CALL_RANK, dateLabel, dateSeed, dayDone, finishStorm, newDayState, newStreak, planDay, prevDate, report, shareText, stormPlan, tickDay, type CallType } from '../src/missions/patrolDay';
import { buildCall, callId, callStars, parseCall, PAR } from '../src/missions/calls';
import { mission } from '../src/missions/catalog';
import { currentStep, interact, newRun, tickRun, type Snapshot } from '../src/missions/runner';
import { migrate, newProfile, adjustSafety } from '../src/progress/profile';
import { RANKS } from '../src/progress/catalog';
import { getTerrain } from '../src/world/terrain';
import { conditions, newWeather, avalancheDanger } from '../src/world/weather';

const snap = (o: Partial<Snapshot> = {}): Snapshot => ({ x: 0, z: 0, vehicle: 'foot', heliLanded: false, heliAgl: 0, heliYaw: 0, avalancheDone: false, ...o });

describe('the Daily Storm', () => {
  it('the same calendar date gives the same day for everyone; another date a different one', () => {
    const d = dateSeed(new Date(Date.UTC(2026, 10, 9, 3)));
    expect(d).toBe(20261109);
    // the same UTC day, any time of day, any time zone it is read from
    expect(dateSeed(new Date(Date.UTC(2026, 10, 9, 23, 59)))).toBe(d);
    expect(stormPlan(d)).toEqual(stormPlan(d));
    expect(JSON.stringify(stormPlan(d))).toBe(JSON.stringify(stormPlan(20261109)));
    const others = [20261110, 20261111, 20261112, 20261113].map((x) => JSON.stringify(stormPlan(x).calls));
    expect(others.some((c) => c !== JSON.stringify(stormPlan(d).calls))).toBe(true);
    expect(dateLabel(d)).toBe('9 November 2026');
  });

  it('the storm does not depend on your rank; free play does', () => {
    const a = stormPlan(20261109);
    expect(planDay(20261109, 2, true)).toEqual(a);
    const rookie = planDay(77, 0);
    const director = planDay(77, 4);
    expect(director.calls.length).toBeGreaterThanOrEqual(rookie.calls.length);
    for (const c of rookie.calls) expect(CALL_RANK[c.type]).toBe(0);
  });

  it('a streak runs on from yesterday, restarts after a gap, counts each day once', () => {
    let s = newStreak();
    s = finishStorm(s, 20261108, 1000);
    s = finishStorm(s, 20261109, 1200);
    expect(s.streak).toBe(2);
    s = finishStorm(s, 20261109, 900);
    expect(s.streak).toBe(2);
    expect(s.scores['20261109']).toBe(1200);
    s = finishStorm(s, 20261112, 800);
    expect(s.streak).toBe(1);
    expect(s.best).toBe(2);
    expect(prevDate(20261201)).toBe(20261130);
    expect(prevDate(20270101)).toBe(20261231);
  });

  it('scores a day and shares it with emoji stars, no timers in the way', () => {
    const plan = stormPlan(20261109);
    const r = report({ control: 900, calls: plan.calls.map((c) => ({ type: c.type, stars: 3, points: 410 })), rescues: 1, safety: 6, style: 3000 });
    expect(r.stars).toBe(3);
    expect(r.total).toBeGreaterThan(2400);
    const weak = report({ control: 0, calls: plan.calls.map((c) => ({ type: c.type, stars: 0, points: 0, skipped: true })), rescues: 0, safety: 0, style: 0 });
    expect(weak.stars).toBe(1);
    const txt = shareText(plan, r, 4);
    expect(txt).toContain('Daily Storm');
    expect(txt).toContain('⭐⭐⭐');
    expect(txt).toContain('streak 4');
    expect(txt.split('\n').length).toBeLessThan(8);
  });

  it('calls come in one at a time, wait while you are busy, and the day ends when they are done', () => {
    const d = newDayState(planDay(5, 2));
    d.phase = 'calls';
    const got: CallType[] = [];
    let busyT = 0;
    for (let i = 0; i < 6000 && !dayDone(d); i++) {
      const c = tickDay(d, 0.1, busyT > 0);
      busyT = Math.max(0, busyT - 0.1);
      if (c) {
        got.push(c.type);
        busyT = 60;
      }
    }
    expect(got.length).toBe(d.plan.calls.length);
    expect(dayDone(d)).toBe(true);
  });
});

describe('the radio calls', () => {
  const types = Object.keys(PAR) as CallType[];

  it('every call type builds a playable mission, and rebuilds the same from its id', () => {
    for (const t of types) {
      const def = buildCall(t, 1234, 2);
      expect(def.steps.length, t).toBeGreaterThan(0);
      expect(mission(callId(t, 1234, 2)), t).toEqual(def);
      expect(parseCall(callId(t, 1234, 2))).toEqual({ type: t, seed: 1234, rank: 2 });
      // every place it sends you is on the map
      const t2 = getTerrain();
      for (const s of def.steps) if ('at' in s && typeof s.at === 'object') expect(t2.inBounds(s.at.x, s.at.z, 20), `${t} ${s.kind}`).toBe(true);
    }
  });

  it('the hoist needs a steady low hover over the spot', () => {
    const def = buildCall('hoist', 9, 1);
    const r = newRun(def.id);
    tickRun(r, snap({ vehicle: 'heli' }), 0.1);
    const s = currentStep(r)!;
    expect(s.kind).toBe('hover');
    if (s.kind !== 'hover') return;
    // too high does not count
    for (let i = 0; i < 100; i++) tickRun(r, snap({ vehicle: 'heli', x: s.at.x, z: s.at.z, heliAgl: 60 }), 0.1);
    expect(currentStep(r)!.kind).toBe('hover');
    for (let i = 0; i < (s.secs + 1) * 10; i++) tickRun(r, snap({ vehicle: 'heli', x: s.at.x, z: s.at.z, heliAgl: 15 }), 0.1);
    expect(currentStep(r)!.kind).toBe('land');
  });

  it('the toboggan haul ends at the clinic on skis; the rescue step waits for everyone to be out', () => {
    const def = buildCall('toboggan', 4, 0);
    const r = newRun(def.id);
    const first = currentStep(r)!;
    if (first.kind === 'goto') tickRun(r, snap({ vehicle: 'skis', x: first.at.x, z: first.at.z }), 0.1);
    interact(r, 'c-aid');
    const tow = currentStep(r)!;
    expect(tow.kind).toBe('tow');
    if (tow.kind === 'tow') {
      tickRun(r, snap({ vehicle: 'foot', x: tow.at.x, z: tow.at.z }), 0.1);
      expect(currentStep(r)!.kind).toBe('tow');
      tickRun(r, snap({ vehicle: 'skis', x: tow.at.x, z: tow.at.z }), 0.1);
      expect(currentStep(r)!.kind).toBe('interact');
    }
    const p = buildCall('poachers', 2, 3);
    const q = newRun(p.id);
    const g = currentStep(q)!;
    if (g.kind === 'goto') tickRun(q, snap({ x: g.at.x, z: g.at.z }), 0.1);
    expect(currentStep(q)!.kind).toBe('rescue');
    tickRun(q, snap({ rescueStarted: false, rescueClear: true }), 0.1);
    expect(currentStep(q)!.kind).toBe('rescue');
    tickRun(q, snap({ rescueStarted: true, rescueClear: true }), 0.1);
    expect(currentStep(q)).toBeNull();
  });

  it('stars: under par and clean is three; each dumped toboggan costs one', () => {
    expect(callStars('toboggan', PAR.toboggan - 10)).toBe(3);
    expect(callStars('toboggan', PAR.toboggan - 10, 1)).toBe(2);
    expect(callStars('race', PAR.race * 1.4)).toBe(2);
    expect(callStars('race', PAR.race * 3, 4)).toBe(1);
  });
});

describe('progression and weather', () => {
  it('ranks run Rookie to Snow Safety Director', () => {
    expect(RANKS.map((r) => r.name)).toEqual(['Rookie', 'Patroller', 'Senior Patroller', 'Avalanche Tech', 'Snow Safety Director']);
  });

  it('the resort safety rating stays between 0 and 100', () => {
    const p = newProfile();
    expect(p.safety).toBe(50);
    adjustSafety(p, 80);
    expect(p.safety).toBe(100);
    adjustSafety(p, -500);
    expect(p.safety).toBe(0);
  });

  it('weather days: a powder day raises the danger, bluebird lowers it, a whiteout grounds the helicopter', () => {
    const w = newWeather();
    w.minute = 11 * 60;
    const base = avalancheDanger(w, conditions(w));
    w.kind = 'powder';
    expect(avalancheDanger(w, conditions(w))).toBe(Math.min(5, base + 1));
    w.kind = 'bluebird';
    expect(conditions(w).sky).toBe('clear');
    expect(avalancheDanger(w, conditions(w))).toBe(Math.max(1, base - 1));
    w.kind = 'whiteout';
    expect(conditions(w).fog).toBeGreaterThan(1);
    expect(conditions(w).grounded).toBe(true);
  });

  it('save migration keeps a call in progress and fills the new fields', () => {
    const id = callId('race', 55, 1);
    const p = migrate({ version: 2, active: { ...newRun(id), step: 1 }, safety: 140, storm: { last: 20261108, streak: 3 } });
    expect(p.active?.id).toBe(id);
    expect(p.safety).toBe(100);
    expect(p.storm.streak).toBe(3);
    expect(p.storm.scores).toEqual({});
    expect(p.xp).toBe(0);
    expect(migrate({ version: 1 }).patrolDay).toBeNull();
  });
});
