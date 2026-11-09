import { mulberry32 } from './noise';
import type { Terrain } from '../world/terrain';

/**
 * A slide on any slope: a few dozen parcels of snow let go in the start zone and run down the fall line
 * under gravity against a Voellmy-style friction (dry friction plus turbulent drag), spreading a little
 * and piling up where they stop. Cheap on purpose (no fracture: Kessel Bowl keeps its slab-block sim),
 * so it runs on a phone next to everything else. The parcels that stop form the debris field.
 */

export interface Parcel {
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  /** 0: waiting to release, 1: running, 2: stopped */
  state: 0 | 1 | 2;
  /** seconds until it lets go (the crack runs across the zone) */
  delay: number;
  size: number;
}

export interface SlideResult {
  /** the debris field: centre and radius on the ground plane */
  cx: number;
  cz: number;
  r: number;
  /** how far down the furthest parcel ran from the start zone (m) */
  run: number;
}

const G = 9.81;

export class Slide {
  readonly parcels: Parcel[] = [];
  time = 0;
  done = false;
  /** the crack line across the top of the start zone, for the warning */
  readonly crack: { x: number; z: number }[];
  /** the fall line at the start (unit, ground plane) */
  readonly dir: { x: number; z: number };

  constructor(
    private t: Terrain,
    readonly x: number,
    readonly z: number,
    readonly r: number,
    count: number,
    seed = 1,
    /** friction: how sticky the snow is (lower runs further) */
    readonly mu = 0.2,
    readonly xi = 900,
  ) {
    const rng = mulberry32(seed);
    const n = t.normal(x, z);
    const l = Math.hypot(n.x, n.z) || 1;
    this.dir = { x: n.x / l, z: n.z / l };
    const across = { x: -this.dir.z, z: this.dir.x };
    // the crack: across the slope at the top of the zone
    this.crack = [];
    for (let i = -4; i <= 4; i++) {
      const cx = x - this.dir.x * r * 0.8 + across.x * (i / 4) * r;
      const cz = z - this.dir.z * r * 0.8 + across.z * (i / 4) * r;
      this.crack.push({ x: cx, z: cz });
    }
    for (let i = 0; i < count; i++) {
      const a = rng() * Math.PI * 2;
      const d = Math.sqrt(rng()) * r;
      const px = x + Math.cos(a) * d;
      const pz = z + Math.sin(a) * d;
      // the top of the slab goes first and the release runs down it
      const along = (px - x) * this.dir.x + (pz - z) * this.dir.z;
      this.parcels.push({ x: px, y: t.height(px, pz), z: pz, vx: 0, vz: 0, state: 0, delay: 0.15 + ((along + r) / (2 * r)) * 0.6 + rng() * 0.2, size: 0.8 + rng() * 0.9 });
    }
  }

  get moving(): number {
    let n = 0;
    for (const p of this.parcels) if (p.state === 1) n++;
    return n;
  }

  /** The front of the slide: the running parcel furthest down the fall line. */
  front(out = { x: 0, z: 0, speed: 0 }) {
    let best = -Infinity;
    for (const p of this.parcels) {
      if (p.state === 0) continue;
      const along = (p.x - this.x) * this.dir.x + (p.z - this.z) * this.dir.z;
      if (along > best) {
        best = along;
        out.x = p.x;
        out.z = p.z;
        out.speed = Math.hypot(p.vx, p.vz);
      }
    }
    return out;
  }

  /** Is a point inside the moving flow (within `pad` m of a running parcel)? */
  caught(x: number, z: number, pad = 2.2): boolean {
    for (const p of this.parcels) if (p.state === 1 && Math.hypot(p.vx, p.vz) > 3 && Math.hypot(p.x - x, p.z - z) < pad + p.size) return true;
    return false;
  }

  /** The nearest running parcel's distance to a point (for near-miss slow motion). */
  nearest(x: number, z: number): number {
    let d = Infinity;
    for (const p of this.parcels) if (p.state === 1) d = Math.min(d, Math.hypot(p.x - x, p.z - z));
    return d;
  }

  step(dt: number) {
    if (this.done) return;
    this.time += dt;
    const t = this.t;
    let running = 0;
    for (const p of this.parcels) {
      if (p.state === 2) continue;
      if (p.state === 0) {
        p.delay -= dt;
        if (p.delay <= 0) p.state = 1;
        else continue;
      }
      const n = t.normal(p.x, p.z);
      // gravity along the slope, Voellmy friction against it
      const ax = G * n.x * n.y;
      const az = G * n.z * n.y;
      p.vx += ax * dt;
      p.vz += az * dt;
      const sp = Math.hypot(p.vx, p.vz);
      if (sp > 1e-3) {
        const loss = (this.mu * G * n.y + (G * sp * sp) / this.xi) * dt;
        const k = Math.max(0, sp - loss) / sp;
        p.vx *= k;
        p.vz *= k;
      }
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      if (!t.inBounds(p.x, p.z, 20)) p.state = 2;
      p.y = t.height(p.x, p.z) + p.size * 0.5;
      // stopped: it stays where it is, part of the debris
      if (Math.hypot(p.vx, p.vz) < 0.5 && this.time > 2.5) {
        p.state = 2;
        p.vx = p.vz = 0;
      } else running++;
    }
    if (this.time > 3 && running === 0) this.done = true;
    if (this.time > 60) {
      for (const p of this.parcels) p.state = 2;
      this.done = true;
    }
  }

  /** Run it to the end (tests, a release that happened off-screen). */
  settle(dt = 1 / 30): this {
    while (!this.done) this.step(dt);
    return this;
  }

  result(): SlideResult {
    const ps = this.parcels;
    let cx = 0;
    let cz = 0;
    for (const p of ps) {
      cx += p.x;
      cz += p.z;
    }
    cx /= ps.length;
    cz /= ps.length;
    let r = 0;
    let run = 0;
    for (const p of ps) {
      r = Math.max(r, Math.hypot(p.x - cx, p.z - cz));
      run = Math.max(run, (p.x - this.x) * this.dir.x + (p.z - this.z) * this.dir.z);
    }
    return { cx, cz, r: Math.min(r, 60), run };
  }
}
