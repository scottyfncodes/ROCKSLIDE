import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { shape, STICK_DEAD } from '../src/core/input';
import { Particles } from '../src/render/fx';
import { FollowCamera } from '../src/game/camera';
import { getTerrain } from '../src/world/terrain';

describe('the touch stick', () => {
  it('ignores a resting thumb inside the deadzone', () => {
    expect(shape(0, 0)).toEqual({ x: 0, y: 0 });
    expect(shape(STICK_DEAD * 0.9, 0)).toEqual({ x: 0, y: 0 });
    expect(shape(0.05, -0.08)).toEqual({ x: 0, y: 0 });
  });

  it('keeps the direction, reaches full speed at full throw, and grows steadily', () => {
    const full = shape(Math.SQRT1_2, Math.SQRT1_2);
    expect(Math.hypot(full.x, full.y)).toBeCloseTo(1, 5);
    expect(full.x).toBeCloseTo(full.y, 6);
    let last = 0;
    for (let m = STICK_DEAD + 0.01; m <= 1; m += 0.05) {
      const v = shape(0, m);
      expect(v.x).toBe(0);
      expect(v.y).toBeGreaterThan(last);
      last = v.y;
    }
    // half a throw is fine control: well under half speed
    expect(shape(0, 0.5).y).toBeLessThan(0.4);
    expect(shape(0, 0.5).y).toBeGreaterThan(0.15);
  });
});

describe('the particle pool', () => {
  it('never grows past its budget and recycles the oldest puff first', () => {
    const p = new Particles(50);
    const fog = new THREE.Fog(0xffffff, 10, 100);
    for (let i = 0; i < 40; i++) p.emit(i, 0, 0, 0, 0, 0, { life: 10 });
    p.update(1 / 60, fog, 400);
    // 30 more: 10 fit, then the 20 oldest (x = 0..19) are reused
    for (let i = 0; i < 30; i++) p.emit(100 + i, 0, 0, 0, 0, 0, { life: 10 });
    p.update(1 / 60, fog, 400);
    const pos = p.points.geometry.getAttribute('position') as THREE.BufferAttribute;
    const n = p.points.geometry.drawRange.count;
    expect(n).toBe(50);
    const xs = new Set<number>();
    for (let i = 0; i < n; i++) xs.add(Math.round(pos.getX(i)));
    for (let i = 0; i < 20; i++) expect(xs.has(i)).toBe(false);
    for (let i = 20; i < 40; i++) expect(xs.has(i)).toBe(true);
    for (let i = 0; i < 30; i++) expect(xs.has(100 + i)).toBe(true);
  });

  it('frees expired puffs', () => {
    const p = new Particles(20);
    const fog = new THREE.Fog(0xffffff, 10, 100);
    for (let i = 0; i < 20; i++) p.emit(0, 0, 0, 0, 0, 0, { life: 0.1 });
    for (let k = 0; k < 10; k++) p.update(1 / 30, fog, 400);
    expect(p.points.geometry.drawRange.count).toBe(0);
  });
});

describe('the follow camera', () => {
  const t = getTerrain();

  it('eases back from the steep lodge view after you walk out, even standing still', () => {
    const cam = new THREE.PerspectiveCamera(55, 2, 0.25, 2600);
    const fc = new FollowCamera(cam, t);
    const pos = new THREE.Vector3(10, t.height(10, 236), 236);
    fc.setMode('indoor');
    for (let i = 0; i < 30; i++) fc.update(1 / 60, pos, 0, 0);
    expect(fc.pitch).toBeGreaterThan(0.9);
    fc.setMode('foot');
    for (let i = 0; i < 120; i++) fc.update(1 / 60, pos, 0, 0);
    expect(fc.pitch).toBeLessThan(0.4);
  });

  it('aims past the character, so it sits below the middle of the screen', () => {
    const cam = new THREE.PerspectiveCamera(55, 2, 0.25, 2600);
    const fc = new FollowCamera(cam, t);
    const pos = new THREE.Vector3(10, t.height(10, 236), 236);
    fc.setMode('foot');
    fc.snapBehind(0);
    for (let i = 0; i < 120; i++) fc.update(1 / 60, pos, 0, 0);
    cam.updateMatrixWorld();
    const ndc = pos.clone().setY(pos.y + 1).project(cam);
    expect(ndc.y).toBeLessThan(-0.05);
    expect(Math.abs(ndc.x)).toBeLessThan(0.05);
  });

  it('pulls back on a phone held upright', () => {
    const cam = new THREE.PerspectiveCamera(55, 2, 0.25, 2600);
    const a = new FollowCamera(cam, t);
    const b = new FollowCamera(cam, t);
    b.portrait = 1;
    const pos = new THREE.Vector3(10, t.height(10, 236), 236);
    for (let i = 0; i < 240; i++) {
      a.update(1 / 60, pos, 0, 0);
      b.update(1 / 60, pos, 0, 0);
    }
    // Character Evolution: a phone held upright already sees more top to bottom (rig.ts), so the camera
    // backs off only a little (it was 1.3x, which left the patroller small in a field of snow)
    expect(b.dist).toBeGreaterThan(a.dist * 1.05);
    expect(b.dist).toBeLessThan(a.dist * 1.2);
  });

  it('frames the patroller on a phone held upright: above the bottom third, about a fifth of the screen tall', () => {
    // 390 x 844 (iPhone 13), with the field of view rig.ts gives a portrait screen
    const aspect = 390 / 844;
    const fov = THREE.MathUtils.clamp((2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(18)) / aspect) * 180) / Math.PI, 55, 70);
    const cam = new THREE.PerspectiveCamera(fov, aspect, 0.25, 2600);
    const fc = new FollowCamera(cam, t);
    fc.portrait = 1;
    fc.reduced = true;
    const pos = new THREE.Vector3(10, t.height(10, 236), 236);
    fc.snapBehind(0);
    for (let i = 0; i < 240; i++) fc.update(1 / 60, pos, 0, 0);
    cam.updateMatrixWorld();
    const feet = pos.clone().project(cam);
    const head = pos.clone().setY(pos.y + 1.95).project(cam);
    // the screen's height is 2 in these units: the figure is 18-30 % of it, centred left to right
    expect(head.y - feet.y).toBeGreaterThan(0.36);
    expect(head.y - feet.y).toBeLessThan(0.6);
    expect(Math.abs(feet.x)).toBeLessThan(0.05);
    // feet well clear of the thumb cluster (about 70 % down), head near the middle of the screen
    expect(feet.y).toBeGreaterThan(-0.55);
    expect(head.y).toBeLessThan(0.15);
  });
});
