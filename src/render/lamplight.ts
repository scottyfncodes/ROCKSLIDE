import * as THREE from 'three';
import { LAMPLIGHT } from './fieldGuide';

/**
 * Lamplight on the snow (Art Direction 2.0, A3: "the lodge feels like home").
 *
 * Every lit window throws a soft trapezoid of warm light onto the snow below it, and after dark Vince's
 * headlamp throws a pool ahead of him with a faint beam through the falling snow. None of it is a real
 * light: the pools are additive meshes laid on the ground, all the windows in ONE draw call, so the
 * cost on a phone is a little overdraw near buildings and nothing in every other shader.
 *
 * Windows are found from the scene itself: every face drawn with a window material, grouped into panes,
 * keeping only the panes that face out (nothing of the building within a few metres in front of them).
 * Panes on buildings that are not built yet (hidden station upgrades) stay dark until they appear.
 */

type Ground = (x: number, z: number) => number;

const POOL_VERT = /* glsl */ `
  attribute vec2 aUv;
  attribute float aGain;
  varying vec2 vUv;
  varying float vGain;
  varying float vDist;
  void main() {
    vUv = aUv;
    vGain = aGain;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vDist = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;
const POOL_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOn;
  varying vec2 vUv;
  varying float vGain;
  varying float vDist;
  void main() {
    // u: across the pool (-1..1), v: away from the wall (0..1)
    float side = 1.0 - smoothstep(0.2, 1.0, abs(vUv.x));
    float far = 1.0 - smoothstep(0.0, 1.0, vUv.y);
    float wall = smoothstep(0.0, 0.25, vUv.y);
    // brightest a little out from the wall, fading softly out across the snow
    float a = side * side * far * far * wall;
    // the glazing bars, faint, in the first half of the pool
    float bars = 1.0 - 0.28 * (1.0 - smoothstep(0.02, 0.06, abs(vUv.x))) * (1.0 - smoothstep(0.3, 0.55, vUv.y));
    a *= bars * vGain * uOn * (1.0 - smoothstep(110.0, 220.0, vDist));
    gl_FragColor = vec4(uColor * a, 1.0);
  }
`;
const LAMP_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOn;
  varying vec2 vUv;
  varying float vGain;
  varying float vDist;
  void main() {
    // an ellipse, hot near its middle, soft at the rim
    float r = length(vec2(vUv.x, vUv.y * 2.0 - 1.0));
    float a = (1.0 - smoothstep(0.35, 1.0, r)) * (0.6 + 0.4 * (1.0 - smoothstep(0.0, 0.5, r)));
    gl_FragColor = vec4(uColor * a * uOn * vGain, 1.0);
  }
`;
const BEAM_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOn;
  varying vec2 vUv;
  void main() {
    // brightest at the lamp, gone by the ground
    float a = (1.0 - vUv.y) * (1.0 - vUv.y) * 0.16;
    gl_FragColor = vec4(uColor * a * uOn, 1.0);
  }
`;

function additive(frag: string, color: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: POOL_VERT,
    fragmentShader: frag,
    uniforms: { uColor: { value: new THREE.Color(color) }, uOn: { value: 0 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    toneMapped: false,
  });
}

export interface Pane {
  /** centre of the pane (world) */
  x: number;
  y: number;
  z: number;
  /** outward facing, horizontal, unit */
  nx: number;
  nz: number;
  /** width (m) */
  w: number;
  /** what draws it: the pool stays dark while it (or anything above it) is hidden */
  source: THREE.Object3D;
}

/**
 * Group the faces drawn with the window materials into panes, and keep the side of each that looks out
 * (a lone face only when nothing stands within `clear` metres in front of it).
 */
export function findPanes(roots: THREE.Object3D[], windowMats: THREE.Material[], clear = 1.5): Pane[] {
  const panes: (Pane & { n: number; minA: number; maxA: number })[] = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const n = new THREE.Vector3();
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const meshes: THREE.Mesh[] = [];
  for (const r of roots) {
    r.updateWorldMatrix(true, true);
    r.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && !(m as THREE.InstancedMesh).isInstancedMesh) meshes.push(m);
    });
  }
  for (const m of meshes) {
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    if (!mats.some((x) => windowMats.includes(x))) continue;
    const g = m.geometry;
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    const index = g.getIndex();
    const groups = Array.isArray(m.material) && g.groups.length ? g.groups : [{ start: 0, count: index ? index.count : pos.count, materialIndex: 0 }];
    for (const grp of groups) {
      const mat = Array.isArray(m.material) ? m.material[grp.materialIndex ?? 0] : m.material;
      if (!windowMats.includes(mat)) continue;
      for (let i = grp.start; i < grp.start + grp.count; i += 3) {
        const ia = index ? index.getX(i) : i;
        const ib = index ? index.getX(i + 1) : i + 1;
        const ic = index ? index.getX(i + 2) : i + 2;
        a.fromBufferAttribute(pos, ia).applyMatrix4(m.matrixWorld);
        b.fromBufferAttribute(pos, ib).applyMatrix4(m.matrixWorld);
        c.fromBufferAttribute(pos, ic).applyMatrix4(m.matrixWorld);
        n.crossVectors(e1.subVectors(b, a), e2.subVectors(c, a));
        const area = n.length() / 2;
        if (area < 1e-4) continue;
        n.normalize();
        // only the upright faces of a pane (not its edges, not skylights)
        if (Math.abs(n.y) > 0.4) continue;
        const h = Math.hypot(n.x, n.z);
        const nx = n.x / h;
        const nz = n.z / h;
        const cx = (a.x + b.x + c.x) / 3;
        const cy = (a.y + b.y + c.y) / 3;
        const cz = (a.z + b.z + c.z) / 3;
        // the triangle's reach along the wall
        const la = -a.x * nz + a.z * nx;
        const lb = -b.x * nz + b.z * nx;
        const lc = -c.x * nz + c.z * nx;
        const lo = Math.min(la, lb, lc);
        const hi = Math.max(la, lb, lc);
        let p = panes.find((q) => q.source === m && q.nx * nx + q.nz * nz > 0.9 && Math.hypot(q.x - cx, q.z - cz) < 1.2 && Math.abs(q.y - cy) < 1.0);
        if (!p) {
          p = { x: cx, y: cy, z: cz, nx, nz, w: 0, source: m, n: 0, minA: lo, maxA: hi };
          panes.push(p);
        }
        p.x = (p.x * p.n + cx * area) / (p.n + area);
        p.y = (p.y * p.n + cy * area) / (p.n + area);
        p.z = (p.z * p.n + cz * area) / (p.n + area);
        p.n += area;
        p.minA = Math.min(p.minA, lo);
        p.maxA = Math.max(p.maxA, hi);
      }
    }
  }
  // keep the faces that look out. A pane has a face on each side: the inner one soon meets the far
  // wall of its room, the outer one looks out into the yard, so of each pair keep the side with the
  // longer clear view. A lone face is kept when nothing stands right in front of it.
  const ray = new THREE.Raycaster();
  ray.far = 30;
  // (a pane's thin edges are upright faces too: a real face is wider than a frame is thick)
  const solid = panes.filter((p) => p.n >= 0.05 && p.maxA - p.minA >= 0.3);
  const free = solid.map((p) => {
    p.w = Math.min(2.4, Math.max(0.5, p.maxA - p.minA));
    ray.set(new THREE.Vector3(p.x + p.nx * 0.15, p.y, p.z + p.nz * 0.15), new THREE.Vector3(p.nx, 0, p.nz));
    const hit = ray.intersectObjects(roots, true).find((h) => (h.object as THREE.Mesh).isMesh && h.object.visible);
    return hit ? hit.distance : Infinity;
  });
  const out: Pane[] = [];
  solid.forEach((p, i) => {
    const twin = solid.findIndex((q, j) => j !== i && q.source === p.source && q.nx * p.nx + q.nz * p.nz < -0.9 && Math.hypot(q.x - p.x, q.z - p.z) < 0.35 && Math.abs(q.y - p.y) < 0.3);
    const keep = twin >= 0 ? free[i] > free[twin] || (free[i] === free[twin] && i < twin) : free[i] > clear;
    if (keep) out.push({ x: p.x, y: p.y, z: p.z, nx: p.nx, nz: p.nz, w: p.w, source: p.source });
  });
  return out;
}

const visibleInScene = (o: THREE.Object3D | null) => {
  for (; o; o = o.parent) if (!o.visible) return false;
  return true;
};

export class Lamplight {
  readonly group = new THREE.Group();
  private poolMat = additive(POOL_FRAG, LAMPLIGHT.window);
  private lampMat = additive(LAMP_FRAG, LAMPLIGHT.headlamp);
  private beamMat: THREE.ShaderMaterial;
  private pools: THREE.Mesh | null = null;
  private panes: Pane[] = [];
  private shown: boolean[] = [];
  private check = 0;
  private lampPool: THREE.Mesh;
  private beam: THREE.Mesh;
  private lampOn = 0;
  private readonly N = 9;

  constructor(private ground: Ground) {
    this.beamMat = new THREE.ShaderMaterial({
      vertexShader: POOL_VERT,
      fragmentShader: BEAM_FRAG,
      uniforms: { uColor: { value: new THREE.Color(LAMPLIGHT.headlamp) }, uOn: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    // the headlamp's pool: a small grid laid on the snow each frame
    const N = this.N;
    const g = new THREE.BufferGeometry();
    const uv = new Float32Array(N * N * 2);
    const gain = new Float32Array(N * N).fill(1);
    const idx: number[] = [];
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) {
        uv[(j * N + i) * 2] = (i / (N - 1)) * 2 - 1;
        uv[(j * N + i) * 2 + 1] = j / (N - 1);
        if (i < N - 1 && j < N - 1) {
          const a = j * N + i;
          idx.push(a, a + N, a + 1, a + N, a + N + 1, a + 1);
        }
      }
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * N * 3), 3));
    g.setAttribute('aUv', new THREE.BufferAttribute(uv, 2));
    g.setAttribute('aGain', new THREE.BufferAttribute(gain, 1));
    g.setIndex(idx);
    this.lampPool = new THREE.Mesh(g, this.lampMat);
    this.lampPool.frustumCulled = false;
    this.lampPool.visible = false;
    // the beam: an open cone from the lamp to the pool, along its own +y
    const cone = new THREE.CylinderGeometry(0.06, 1, 1, 14, 1, true).translate(0, -0.5, 0);
    const cuv = new Float32Array(cone.getAttribute('position').count * 2);
    const cp = cone.getAttribute('position');
    for (let i = 0; i < cp.count; i++) cuv[i * 2 + 1] = -cp.getY(i);
    cone.setAttribute('aUv', new THREE.BufferAttribute(cuv, 2));
    cone.setAttribute('aGain', new THREE.BufferAttribute(new Float32Array(cp.count).fill(1), 1));
    this.beam = new THREE.Mesh(cone, this.beamMat);
    this.beam.frustumCulled = false;
    this.beam.visible = false;
    this.group.add(this.lampPool, this.beam);
  }

  /** Lay a pool under every outward-facing pane. Call again when buildings change. */
  setWindows(panes: Pane[]) {
    if (this.pools) {
      this.group.remove(this.pools);
      this.pools.geometry.dispose();
    }
    this.panes = panes;
    this.shown = panes.map(() => true);
    const R = 5;
    const C = 4;
    const pos: number[] = [];
    const uv: number[] = [];
    const gain: number[] = [];
    const idx: number[] = [];
    for (const p of panes) {
      const gy = this.ground(p.x, p.z);
      const hSill = Math.max(0.3, p.y - gy);
      // higher windows throw their light further out, and a little dimmer
      const len = Math.min(10, 3.4 + hSill * 1.4);
      const k = Math.min(1, 1.6 / Math.sqrt(hSill + 0.6));
      const base = pos.length / 3;
      for (let j = 0; j < R; j++)
        for (let i = 0; i < C; i++) {
          const v = j / (R - 1);
          const u = (i / (C - 1)) * 2 - 1;
          // a trapezoid: the pane's width at the wall, spreading as it goes
          const half = (p.w * 0.8 + v * len * 0.42) * u;
          const out = 0.1 + v * len;
          const x = p.x + p.nx * out - p.nz * half;
          const z = p.z + p.nz * out + p.nx * half;
          pos.push(x, this.ground(x, z) + 0.06, z);
          uv.push(u, v);
          gain.push(k);
        }
      for (let j = 0; j < R - 1; j++)
        for (let i = 0; i < C - 1; i++) {
          const a = base + j * C + i;
          idx.push(a, a + 1, a + C, a + 1, a + C + 1, a + C);
        }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aUv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('aGain', new THREE.Float32BufferAttribute(gain, 1));
    g.setIndex(idx);
    g.computeBoundingSphere();
    this.pools = new THREE.Mesh(g, this.poolMat);
    this.pools.name = 'window-light';
    this.pools.renderOrder = 2;
    this.group.add(this.pools);
    this.check = 0;
  }

  get paneCount() {
    return this.panes.length;
  }

  /**
   * `night` 0..1 (the rig's); `lamp`: where Vince's headlamp is and which way he faces, or null when
   * he is not on foot or it is daylight.
   */
  update(dt: number, night: number, lamp: { x: number; y: number; z: number; yaw: number } | null) {
    const dusk = THREE.MathUtils.smoothstep(night, 0.12, 0.65);
    this.poolMat.uniforms.uOn.value = dusk * 0.7;
    if (this.pools) {
      this.pools.visible = dusk > 0.01;
      // panes of buildings not standing yet stay dark (checked twice a second)
      this.check -= dt;
      if (this.check <= 0 && this.pools.visible) {
        this.check = 0.5;
        const g = this.pools.geometry.getAttribute('aGain') as THREE.BufferAttribute;
        let dirty = false;
        this.panes.forEach((p, i) => {
          const on = visibleInScene(p.source);
          if (on === this.shown[i]) return;
          this.shown[i] = on;
          dirty = true;
          const gy = this.ground(p.x, p.z);
          const k = on ? Math.min(1, 1.6 / Math.sqrt(Math.max(0.3, p.y - gy) + 0.6)) : 0;
          for (let v = 0; v < 20; v++) g.setX(i * 20 + v, k);
        });
        if (dirty) g.needsUpdate = true;
      }
    }
    // the headlamp eases on and off
    const want = lamp ? THREE.MathUtils.smoothstep(night, 0.3, 0.6) : 0;
    this.lampOn += (want - this.lampOn) * Math.min(1, dt * 4);
    const on = this.lampOn > 0.01 && lamp;
    this.lampPool.visible = this.beam.visible = !!on;
    if (!on || !lamp) return;
    this.lampMat.uniforms.uOn.value = this.lampOn * 0.85;
    this.beamMat.uniforms.uOn.value = this.lampOn;
    // the pool: an ellipse 2-7 m ahead of him, laid on the snow
    const N = this.N;
    const fx = -Math.sin(lamp.yaw);
    const fz = -Math.cos(lamp.yaw);
    const pos = this.lampPool.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) {
        const u = (i / (N - 1)) * 2 - 1;
        const v = j / (N - 1);
        const out = 1.6 + v * 5.4;
        const half = (0.9 + v * 1.3) * u;
        const x = lamp.x + fx * out - fz * half;
        const z = lamp.z + fz * out + fx * half;
        pos.setXYZ(j * N + i, x, this.ground(x, z) + 0.07, z);
      }
    pos.needsUpdate = true;
    // the beam: from the lamp to the middle of the pool
    const cx = lamp.x + fx * 4.2;
    const cz = lamp.z + fz * 4.2;
    const cy = this.ground(cx, cz);
    const dir = new THREE.Vector3(cx - lamp.x, cy - lamp.y, cz - lamp.z);
    const len = dir.length();
    this.beam.position.set(lamp.x, lamp.y, lamp.z);
    this.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.normalize());
    this.beam.scale.set(1.5, len, 1.5);
  }
}
