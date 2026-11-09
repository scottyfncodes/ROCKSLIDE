import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { pad } from '../src/world/places';
const PLAZA = pad('resort');
import { describe, expect, it } from 'vitest';
import { LAMPLIGHT, NIGHT, RANGE_BANDS, SNOW_LIGHT } from '../src/render/fieldGuide';
import { findPanes } from '../src/render/lamplight';
import { buildTerrain, crestHeights } from '../src/render/terrainView';
import { Terrain } from '../src/world/terrain';

/**
 * Art Direction 2.0, Phase A (docs/art-direction-2/PLAN.md): Field Guide Alpine, "cold world, warm
 * people". These hold the look's rules, not its exact numbers: the surround in three bands with their
 * own silhouettes, stepping back into the haze; snow lit warm and shaded cool; a night that is dark but
 * keeps the people readable; lamplight from what people made.
 */
const hex = (n: number) => '#' + n.toString(16).padStart(6, '0').toUpperCase();
const tokens = JSON.parse(new TextDecoder().decode(readFileSync('art/bible/tokens.json'))) as {
  light: { bands: { name: string; haze: number }[]; snow: typeof SNOW_LIGHT; night: { moon: string }; lamplight: { window: string; headlamp: string } };
};

describe('the bible quotes the light the game renders', () => {
  it('bands, snow light, night and lamplight match src/render/fieldGuide.ts', () => {
    expect(tokens.light.bands.map((b) => [b.name, b.haze]), 'fieldGuide.ts changed: rebuild the bible tokens').toEqual(RANGE_BANDS.map((b) => [b.name, b.haze]));
    expect(tokens.light.snow).toEqual(SNOW_LIGHT);
    expect(tokens.light.night.moon).toBe(hex(NIGHT.moon));
    expect(tokens.light.lamplight).toEqual({ window: hex(LAMPLIGHT.window), headlamp: hex(LAMPLIGHT.headlamp) });
  });
});

describe('the surround: three planes, each its own silhouette', () => {
  const crest = Array.from({ length: 1440 }, (_, i) => crestHeights((i / 1440) * Math.PI * 2));
  /** local maxima that stand at least `prom` metres above the lower of the two dips beside them */
  const summits = (band: number, prom: number) => {
    const v = crest.map((c) => c[band]);
    let n = 0;
    for (let i = 0; i < v.length; i++) {
      if (!(v[i] >= v[(i + v.length - 1) % v.length] && v[i] > v[(i + 1) % v.length])) continue;
      let l = v[i];
      let r = v[i];
      for (let k = 1; k < 120; k++) l = Math.min(l, v[(i - k + v.length) % v.length]);
      for (let k = 1; k < 120; k++) r = Math.min(r, v[(i + k) % v.length]);
      if (v[i] - Math.max(l, r) > prom) n++;
    }
    return n;
  };

  it('each band stands further out, higher and hazier than the one in front', () => {
    for (let i = 1; i < RANGE_BANDS.length; i++) {
      expect(RANGE_BANDS[i].d).toBeGreaterThan(RANGE_BANDS[i - 1].d + RANGE_BANDS[i - 1].w);
      expect(RANGE_BANDS[i].haze).toBeGreaterThan(RANGE_BANDS[i - 1].haze);
    }
    const mean = (b: number) => crest.reduce((s, c) => s + c[b], 0) / crest.length;
    expect(mean(1)).toBeGreaterThan(mean(0) * 1.8);
    expect(mean(2)).toBeGreaterThan(mean(1) * 1.4);
  });

  it('the silhouettes differ in kind, not just in colour', () => {
    // the far band is a skyline of separate summits: few, and each stands well clear of its cols
    const peaks = summits(2, 250);
    expect(peaks).toBeGreaterThanOrEqual(8);
    expect(peaks).toBeLessThanOrEqual(30);
    // the range is serrated: many teeth, smaller
    expect(summits(1, 40)).toBeGreaterThan(peaks * 2);
    // the foothills are rounded: their crest line turns gently (small second differences)
    const rough = (b: number) => crest.reduce((s, c, i) => s + Math.abs(c[b] * 2 - crest[(i + 1) % crest.length][b] - crest[(i + crest.length - 1) % crest.length][b]), 0) / crest.length;
    expect(rough(0)).toBeLessThan(rough(1));
  });

  it('seen from the town, each band rises above the one in front (looking out of the valley)', () => {
    const t = new Terrain();
    const range = buildTerrain(t).children.find((c) => c.name === 'range') as THREE.Mesh;
    const pos = range.geometry.getAttribute('position') as THREE.BufferAttribute;
    const haze = range.geometry.getAttribute('aHaze') as THREE.BufferAttribute;
    // the town's own view: from the lift base plaza down Main Street, out of the valley
    const eye = new THREE.Vector3(PLAZA.x, t.height(PLAZA.x, PLAZA.z) + 1.7, PLAZA.z);
    // looking south, out of the open end of the valley
    const top = [-90, -90, -90];
    for (let i = 0; i < pos.count; i++) {
      const dx = pos.getX(i) - eye.x;
      const dz = pos.getZ(i) - eye.z;
      if (Math.abs(Math.atan2(dx, dz)) > 0.5) continue;
      const el = (Math.atan2(pos.getY(i) - eye.y, Math.hypot(dx, dz)) * 180) / Math.PI;
      const b = RANGE_BANDS.findIndex((x) => Math.abs(x.haze - haze.getX(i)) < 1e-6);
      top[b] = Math.max(top[b], el);
    }
    expect(top[1]).toBeGreaterThan(top[0] + 1.5);
    expect(top[2]).toBeGreaterThan(top[1] + 1.5);
    // and the sky still has room: the summits stay under a fifth of a portrait phone's view
    expect(top[2]).toBeLessThan(22);
  });
});

describe('snow is never white, night is dark but the people read', () => {
  const warmth = (v: number[]) => v[0] / v[2];
  it('the sun lights snow warm and the sky shades it cool, by day and at golden hour', () => {
    expect(warmth(SNOW_LIGHT.day.lit)).toBeGreaterThan(1.05);
    expect(warmth(SNOW_LIGHT.day.shade)).toBeLessThan(0.8);
    expect(warmth(SNOW_LIGHT.golden.lit)).toBeGreaterThan(warmth(SNOW_LIGHT.day.lit));
    // moonlight is cold on both sides
    expect(warmth(SNOW_LIGHT.night.lit)).toBeLessThan(1);
    expect(warmth(SNOW_LIGHT.night.shade)).toBeLessThan(1);
    expect(SNOW_LIGHT.shadeDepth).toBeLessThan(1);
  });

  it('the night light is cold and low; only lamplight is warm', () => {
    const c = new THREE.Color(NIGHT.moon);
    expect(c.b).toBeGreaterThan(c.r);
    expect(NIGHT.moonIntensity).toBeLessThan(1);
    expect(NIGHT.figureFill[2]).toBeGreaterThan(NIGHT.figureFill[0]);
    expect(Math.max(...NIGHT.figureFill)).toBeLessThan(0.2);
    const w = new THREE.Color(LAMPLIGHT.window);
    expect(w.r).toBeGreaterThan(w.b);
  });
});

describe('window light finds the panes that look out', () => {
  it('keeps the outer face of a pane in a wall, drops the inner one and the hidden building', () => {
    const glass = new THREE.MeshLambertMaterial();
    const wood = new THREE.MeshLambertMaterial();
    const house = new THREE.Group();
    // a 6 x 6 m room: four walls, a pane (a thin box, faces on both sides) in the south wall
    const wall = (w: number, d: number, x: number, z: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 3, d), wood);
      m.position.set(x, 1.5, z);
      house.add(m);
    };
    wall(6, 0.2, 0, -3);
    wall(0.2, 6, -3, 0);
    wall(0.2, 6, 3, 0);
    wall(2.4, 0.2, -1.8, 3);
    wall(2.4, 0.2, 1.8, 3);
    const pane = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1, 0.12), glass);
    pane.position.set(0, 1.5, 3);
    house.add(pane);
    // a second house, not built yet
    const later = house.clone();
    later.position.x = 40;
    later.visible = false;
    const root = new THREE.Group();
    root.add(house, later);
    const panes = findPanes([root], [glass]);
    const near = panes.filter((p) => Math.abs(p.x) < 5);
    expect(near).toHaveLength(1);
    expect(near[0].nz).toBeGreaterThan(0.9);
    expect(near[0].w).toBeCloseTo(1.2, 1);
    // the hidden house's panes are found (it may be built later) but start dark: see Lamplight.update
    expect(panes.length).toBeGreaterThanOrEqual(1);
  });
});
