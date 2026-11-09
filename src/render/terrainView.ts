import * as THREE from 'three';
import { fbm2, mulberry32, ridged2 } from '../sim/noise';
import { smoothstep } from '../sim/geom';
import { LAKE, PADS, WORLD_HALF } from '../world/places';
import type { Terrain } from '../world/terrain';
import { NOISE_GLSL } from './shaderChunks';
import { rangeAt } from '../world/frontRange';
import { shared } from './materials';
import { RANGE_BANDS, SNOW_LIGHT } from './fieldGuide';

/**
 * The ground: snow that is a little blue in the shade and warm in the sun, wind-scoured rock on
 * the steeps, packed roads, groomed pistes and the lake's grey ice. Drawn in chunks so the ones
 * behind you are culled; a ring of far peaks closes the valley.
 */

export const snowUniforms = {
  /** fresh snow: brightens and smooths the ground, fills in tracks */
  fresh: { value: 0.5 },
  sparkle: { value: 1 },
  /** Field Guide Alpine: what the sun's light (lit) and the sky's (shade) do to snow, set by the rig */
  lit: { value: new THREE.Vector3(...SNOW_LIGHT.day.lit) },
  shade: { value: new THREE.Vector3(...SNOW_LIGHT.day.shade) },
  /** the prevailing wind on the ground (xz, unit): drifts and sastrugi lie across it */
  wind: { value: new THREE.Vector2(0.8, 0.6) },
};

/**
 * Scanned detail for the ground (Poly Haven, CC0; public/tex, see CREDITS.md): a granite cliff's colour
 * and relief for exposed rock, and wind-packed snow's relief for the snowfields. Loaded only in a
 * browser; without them the ground falls back to its procedural relief.
 */
function detailTextures(): { rock: THREE.Texture; snowN: THREE.Texture } | null {
  if (typeof document === 'undefined') return null;
  const base = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
  const load = (f: string, srgb: boolean) => {
    const t = new THREE.TextureLoader().load(`${base}tex/${f}`);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = 4;
    return t;
  };
  // the rock in one texture: its relief in red and green, its grain (the scan's brightness) in blue
  return { rock: load('rock_detail.jpg', false), snowN: load('snow_normal.jpg', false) };
}

export function createSnowMaterial(): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
  const tex = detailTextures();
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uFresh = snowUniforms.fresh;
    shader.uniforms.uSparkle = snowUniforms.sparkle;
    shader.uniforms.uSnowLit = snowUniforms.lit;
    shader.uniforms.uSnowShade = snowUniforms.shade;
    shader.uniforms.uSnowWind = snowUniforms.wind;
    shader.uniforms.uTime = shared.time;
    if (tex) {
      shader.uniforms.uRock = { value: tex.rock };
      shader.uniforms.uSnowN = { value: tex.snowN };
      shader.defines = { ...(shader.defines ?? {}), USE_DETAIL: '' };
    }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vWP;\nvarying vec3 vWN;\nattribute vec2 aGround;\nattribute vec4 aNz;\nattribute vec2 aNz2;\nvarying vec2 vGround;\nvarying vec4 vNz;\nvarying vec2 vNz2;`)
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vWN = normalize(mat3(modelMatrix) * objectNormal);
        vGround = aGround;
        // the slow noises, baked per vertex when the ground is built (see groundNoise)
        vNz = aNz;
        vNz2 = aNz2;
`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        ${NOISE_GLSL}
        varying vec3 vWP;
        varying vec3 vWN;
        varying vec2 vGround;
        varying vec4 vNz;
        varying vec2 vNz2;
        uniform float uFresh;
        uniform float uSparkle;
        uniform vec3 uSnowLit;
        uniform vec3 uSnowShade;
        uniform vec2 uSnowWind;
        #ifdef USE_DETAIL
          uniform sampler2D uRock;
          uniform sampler2D uSnowN;
          vec3 gRockTex;
        #endif
        float gRock;
        `,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec2 wp = vWP.xz;
        float d1 = vNz.x;
        float d2 = eNoise2(wp * 0.6);
        // where the rock shows: the per-vertex mask (steepness, scoured crests), shaped by streaks down
        // the fall line (gullies and ribs) and broken up so it never follows the triangles
        gRock = smoothstep(0.3, 0.7, vGround.x + vNz.y);
        // ledges hold a little snow
        gRock *= 1.0 - smoothstep(0.86, 0.97, vWN.y) * 0.35;
        // Colorado granite: grey, with iron-stained and lichen-dark patches
        vec3 rockTint = mix(vec3(0.5, 0.49, 0.5), vec3(0.56, 0.47, 0.4), smoothstep(0.4, 0.75, vNz.z));
        rockTint *= 0.8 + 0.35 * vNz.w;
        vec3 rockCol = rockTint;
        #ifdef USE_DETAIL
          // a cliff's own colour and grain, projected from the sides (rock faces are steep); only
          // where there is rock to see
          gRockTex = vec3(0.0);
          float rockNear = 1.0 - smoothstep(140.0, 220.0, length(vViewPosition));
          if (gRock > 0.004 && rockNear > 0.0) {
            // relief and grain, projected from the sides (rock faces are steep); one read per axis
            vec3 an = pow(abs(vWN) + 1e-3, vec3(4.0));
            an /= an.x + an.y + an.z;
            vec3 tx = texture2D(uRock, vWP.zy * 0.11).rgb;
            vec3 tz = texture2D(uRock, vWP.xy * 0.11).rgb;
            vec3 ty = texture2D(uRock, vWP.xz * 0.11).rgb;
            float grain = tx.b * an.x + ty.b * an.y + tz.b * an.z;
            rockCol = rockTint * mix(0.78, 0.3 + grain * 0.95, rockNear);
            // keep the relief for the normal, already blended into world space
            vec2 rx = tx.rg * 2.0 - 1.0;
            vec2 rz = tz.rg * 2.0 - 1.0;
            vec2 ry = ty.rg * 2.0 - 1.0;
            gRockTex = (vec3(0.0, rx.y, rx.x) * an.x + vec3(rz.x, rz.y, 0.0) * an.z + vec3(ry.x, 0.0, ry.y) * an.y) * 0.9 * rockNear;
          }
        #endif
        // strata: bands across the faces, lifted and bent by noise
        float band = sin(vWP.y * 0.55 + vNz2.x * 9.0 + d1 * 3.0);
        // (only near: far away the bands would alias into stripes)
        rockCol *= 0.92 + 0.09 * smoothstep(-0.3, 0.9, band) * (1.0 - smoothstep(60.0, 160.0, length(vViewPosition))) + (d1 - 0.5) * 0.25;
        // snow: wind-packed slabs slightly greyer, fresh drifts brighter; ripples on the open snow
        vec3 snowCol = diffuseColor.rgb * (0.965 + 0.05 * d1 + 0.02 * d2);
        float rip = sin(wp.x * 0.9 + wp.y * 0.35 + eNoise2(wp * 0.15) * 6.0);
        snowCol *= 1.0 - (1.0 - uFresh) * 0.025 * rip * (1.0 - smoothstep(60.0, 180.0, length(vViewPosition)));
        snowCol *= mix(1.0, 0.93 + 0.07 * vNz2.y, vGround.y);
        diffuseColor.rgb = mix(snowCol, rockCol, gRock);
        `,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        {
          float th = eFbm2(vWP.xz * 0.35) * 0.5 + eNoise2(vWP.xz * 2.0) * 0.12;
          // fine bump only where it can be resolved: far off it aliases into stripes
          normal = ePerturbNormal(-vViewPosition, normal, th, mix(0.08, 0.35, gRock) * (1.0 - smoothstep(70.0, 220.0, length(vViewPosition))));
          // the snow's own shape, in metres: wind drifts tens of metres long, and up close sastrugi, the
          // ridges the wind carves across itself. Warped, so neither ever lines up into a pattern. Only
          // on snow within 420 m (beyond, the relief is below a pixel), sastrugi only within 70 m: on a
          // phone this costs 4 value noises a pixel near you, 6 at your feet, none further out.
          float sDist = length(vViewPosition);
          float h = 0.0;
          if (sDist < 420.0 && gRock < 0.99) {
            vec2 p = vWP.xz;
            float wn = eNoise2(p * 0.013 + 3.1);
            vec2 q = p + vec2(wn, 1.0 - wn) * 38.0;
            float along = dot(q, uSnowWind);
            float across = dot(q, vec2(-uSnowWind.y, uSnowWind.x));
            // drifts: long in the wind's direction, short across it (two octaves are enough this broad)
            vec2 dq = vec2(along * 0.016, across * 0.042) + wn * 1.5;
            float drift = (eNoise2(dq) * 0.67 + eNoise2(dq * 2.03 + 5.2) * 0.33) * 0.4 + eNoise2(q * 0.11) * 0.14;
            h = drift * (1.0 - smoothstep(160.0, 420.0, sDist));
            if (sDist < 70.0) {
              // sastrugi: sharp-backed ridges a few metres apart
              float sz = eNoise2(vec2(along * 0.09, across * 0.55) + eNoise2(q * 0.3) * 0.8);
              float sg = 1.0 - abs(sz * 2.0 - 1.0);
              h += sg * sg * 0.14 * (1.0 - smoothstep(18.0, 70.0, sDist));
            }
            h *= (1.0 - gRock) * (1.0 - uFresh * 0.45);
          }
          // (the derivatives are taken outside the branch, where every pixel of a quad runs them)
          normal = ePerturbNormal(-vViewPosition, normal, h, 1.0);
          #ifdef USE_DETAIL
            // the scans' relief, in world space, then back into the view space three lights in
            vec3 nw = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
            vec3 pSnow = vec3(0.0);
            vec3 pRock = vec3(0.0);
            // the snow's relief only up close (it is gone by 90 m), the rock's only where there is rock
            float near = 1.0 - smoothstep(25.0, 90.0, length(vViewPosition));
            if (near > 0.0 && gRock < 0.996) {
              vec2 sn = texture2D(uSnowN, vWP.xz * 0.2).xy * 2.0 - 1.0;
              pSnow = vec3(sn.x, 0.0, sn.y) * 0.4 * near;
            }
            pRock = gRockTex;
            nw = normalize(nw + mix(pSnow, pRock, gRock));
            normal = normalize((viewMatrix * vec4(nw, 0.0)).xyz);
          #endif
        }
        `,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = mix(0.86, 0.95, gRock);`,
      )
      .replace(
        '#include <opaque_fragment>',
        `{
          // Field Guide Alpine: snow is never white. The sun's light on it leans cream (peach at the ends
          // of the day), the sky's light in its shade leans cobalt-violet, so the form of every drift
          // and slope reads as two planes of colour, not one grey
          float snowAmt = 1.0 - gRock;
          vec3 dirL = reflectedLight.directDiffuse + reflectedLight.directSpecular;
          vec3 indL = reflectedLight.indirectDiffuse + reflectedLight.indirectSpecular;
          outgoingLight = mix(outgoingLight, dirL * uSnowLit + indL * uSnowShade + totalEmissiveRadiance, snowAmt);
        }
        {
          // glints: a few crystals catch the light as you move (not on bare rock)
          vec3 cell = floor(vWP * 3.0);
          float h = fract(sin(dot(cell, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
          vec3 v = normalize(vViewPosition);
          float g = step(0.93, h) * step(0.6, fract(h * 91.0 + dot(v, vec3(3.1, 1.7, 2.3)) * 2.0));
          g *= step(length(fract(vWP.xz * 3.0) - vec2(0.5)), 0.06);
          float dist = length(vViewPosition);
          outgoingLight += vec3(g) * (1.0 - gRock) * uSparkle * smoothstep(60.0, 8.0, dist) * 0.9;
        }
        #include <opaque_fragment>`,
      );
  };
  m.customProgramCacheKey = () => 'snow-terrain-v6';
  return m;
}

// high-country snow: near-white with a cold cast in the shade; packed roads and yards a dirty
// cream where machines and boots have worked them; the lake's grey-green ice
const SNOW = new THREE.Color(0.95, 0.965, 0.99);
const SHADE = new THREE.Color(0.84, 0.88, 0.96);
const ROAD = new THREE.Color(0.8, 0.76, 0.72);
const TRACK = new THREE.Color(0.88, 0.86, 0.84);
const PISTE = new THREE.Color(0.985, 0.99, 1.0);
const ICE = new THREE.Color(0.6, 0.74, 0.76);
const YARD = new THREE.Color(0.84, 0.8, 0.76);

/** The snow side of the ground's colour (snow, roads, yards, ice); the rock is the shader's. */
function groundColor(t: Terrain, x: number, z: number, nx: number, ny: number, nz: number, out: THREE.Color): THREE.Color {
  out.copy(SNOW);
  out.lerp(SHADE, Math.max(0, -nz * 0.9 + nx * 0.3) * 0.6);
  const ld = Math.hypot(x - LAKE.x, z - LAKE.z);
  if (ld < LAKE.r) out.lerp(ICE, smoothstep(LAKE.r, LAKE.r - 14, ld) * (0.75 + fbm2(x / 20, z / 20, 2, 6) * 0.25));
  for (const p of PADS) {
    const d = Math.hypot(x - p.x, z - p.z);
    if (d < p.r) out.lerp(YARD, smoothstep(p.r, p.r * 0.6, d) * 0.55);
  }
  const r = t.onRoute(x, z, 1.5);
  if (r) {
    const k = smoothstep(r.route.width + 1.5, r.route.width * 0.4, r.d);
    out.lerp(r.route.kind === 'road' ? ROAD : r.route.kind === 'track' ? TRACK : PISTE, k);
  }
  return out;
}

const n01 = (v: number) => Math.min(1, Math.max(0, 0.5 + v * 0.6));
/**
 * The ground's slow noises, once per vertex at build time (they change over 10 m or more, the grid is
 * 6 m): x large-scale variation, y where snow clings (streaks down the fall line plus a broad breakup,
 * centred on 0), z iron staining, w rock brightness; then the strata's bend and the snow's packing.
 */
export function groundNoise(x: number, z: number, nx: number, nz: number, out: Float32Array, o: number, out2: Float32Array, o2: number) {
  const l = Math.hypot(nx, nz) || 1;
  const fx = nx / l;
  const fz = nz / l;
  const along = x * fx + z * fz;
  const across = -x * fz + z * fx;
  const streak = n01(fbm2(across * 0.09, along * 0.022, 4, 61));
  const broad = n01(fbm2(x * 0.045, z * 0.045, 4, 62));
  out[o] = n01(fbm2(x * 0.05, z * 0.05, 4, 63));
  out[o + 1] = (streak - 0.5) * 0.5 + (broad - 0.5) * 0.35;
  out[o + 2] = n01(fbm2(x * 0.012, z * 0.012, 4, 64));
  out[o + 3] = n01(fbm2(x * 0.07, z * 0.07, 4, 65));
  out2[o2] = n01(fbm2(x * 0.02, z * 0.02, 4, 66));
  out2[o2 + 1] = n01(fbm2(x * 0.03, z * 0.03, 4, 67));
}

/**
 * Where the mountain shows through (x) and where the wind has packed and scoured it (y), 0..1.
 * Rock: the steeps (from about 30 degrees, snow clinging in noise-shaped streaks), the crests the wind
 * strips bare (convex ground stands above its neighbours), and more of it high up. Never on a road,
 * a pad, the piste or the lake.
 */
export function groundMasks(t: Terrain, x: number, z: number, ny: number): [number, number] {
  const slope = Math.acos(Math.min(1, ny));
  const cling = fbm2(x / 30, z / 30, 2, 31) * 0.14;
  let rock = smoothstep(0.5 + cling, 0.72 + cling, slope);
  const h = t.height(x, z);
  const around = (t.height(x + 16, z) + t.height(x - 16, z) + t.height(x, z + 16) + t.height(x, z - 16)) / 4;
  const crest = smoothstep(1.2, 4.5, h - around);
  rock = Math.max(rock, crest * smoothstep(0.12, 0.4, slope) * 0.75);
  rock = Math.min(1, rock * (1 + smoothstep(520, 780, h) * 0.35));
  // windward (west-facing), exposed ground is packed and scoured
  const scour = Math.min(1, crest * 0.8 + smoothstep(0.2, 0.6, slope) * 0.4);
  if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 6) rock = 0;
  for (const p of PADS) if (Math.hypot(x - p.x, z - p.z) < p.r + 4) rock *= 0.15;
  const r = t.onRoute(x, z, 3);
  if (r) rock *= 1 - smoothstep(r.route.width + 3, r.route.width, r.d);
  return [rock, scour];
}

export function buildTerrain(t: Terrain): THREE.Group {
  const group = new THREE.Group();
  const material = createSnowMaterial();
  const n = t.n;
  const chunks = 8;
  const per = (n - 1) / chunks;
  const col = new THREE.Color();
  // normals from the grid
  const normals = new Float32Array(n * n * 3);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const H = t.heights;
      const l = H[j * n + Math.max(0, i - 1)];
      const r = H[j * n + Math.min(n - 1, i + 1)];
      const u = H[Math.max(0, j - 1) * n + i];
      const d = H[Math.min(n - 1, j + 1) * n + i];
      const nx = l - r;
      const nz = u - d;
      const ny = 4 * t.cell;
      const len = Math.hypot(nx, ny, nz);
      normals.set([nx / len, ny / len, nz / len], (j * n + i) * 3);
    }
  for (let cj = 0; cj < chunks; cj++)
    for (let ci = 0; ci < chunks; ci++) {
      const i0 = Math.round(ci * per);
      const j0 = Math.round(cj * per);
      const i1 = Math.round((ci + 1) * per);
      const j1 = Math.round((cj + 1) * per);
      const w = i1 - i0 + 1;
      const h = j1 - j0 + 1;
      const pos = new Float32Array(w * h * 3);
      const nor = new Float32Array(w * h * 3);
      const cols = new Float32Array(w * h * 3);
      const ground = new Float32Array(w * h * 2);
      const nz4 = new Float32Array(w * h * 4);
      const nz2 = new Float32Array(w * h * 2);
      for (let j = 0; j < h; j++)
        for (let i = 0; i < w; i++) {
          const gi = i0 + i;
          const gj = j0 + j;
          const k = (j * w + i) * 3;
          const x = -WORLD_HALF + gi * t.cell;
          const z = -WORLD_HALF + gj * t.cell;
          pos[k] = x;
          pos[k + 1] = t.heights[gj * n + gi];
          pos[k + 2] = z;
          const g = (gj * n + gi) * 3;
          nor[k] = normals[g];
          nor[k + 1] = normals[g + 1];
          nor[k + 2] = normals[g + 2];
          groundColor(t, x, z, nor[k], nor[k + 1], nor[k + 2], col);
          const [rk, sc] = groundMasks(t, x, z, nor[k + 1]);
          ground[(j * w + i) * 2] = rk;
          ground[(j * w + i) * 2 + 1] = sc;
          groundNoise(x, z, nor[k], nor[k + 2], nz4, (j * w + i) * 4, nz2, (j * w + i) * 2);
          cols[k] = col.r;
          cols[k + 1] = col.g;
          cols[k + 2] = col.b;
        }
      const idx: number[] = [];
      for (let j = 0; j < h - 1; j++)
        for (let i = 0; i < w - 1; i++) {
          const a = j * w + i;
          const b = a + 1;
          const c = a + w;
          const d = c + 1;
          // same split as Terrain.height: a-c-b, c-d-b
          idx.push(a, c, b, c, d, b);
        }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      geo.setAttribute('aGround', new THREE.BufferAttribute(ground, 2));
      geo.setAttribute('aNz', new THREE.BufferAttribute(nz4, 4));
      geo.setAttribute('aNz2', new THREE.BufferAttribute(nz2, 2));
      geo.setIndex(idx);
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, material);
      mesh.receiveShadow = true;
      group.add(mesh);
    }
  group.add(buildBackdrop(t));
  return group;
}

/**
 * The range that rings the valley, planned like a field-guide plate: three ridge bands one behind the
 * other, each with a silhouette of its own and its own step of haze, so the eye reads depth in planes.
 * - the foothills: rounded, timbered ridges 0.6 km out, dark spruce broken by glades and slide paths;
 * - the range: serrated granite 1.75 km out, snow held in its bowls and couloirs;
 * - the peaks: a skyline of separate summits 3.3 km out, highest behind Kessel Bowl, palest of all.
 * The bands meet in saddles, so the surface is one closed mesh (one draw call) with no gaps to see
 * through from the helicopter. Erosion detail comes from the GITCRAFT WorldCraft heightfield
 * (src/world/frontRange.ts) on the flanks. Light falls on it in a few soft bands (the screen-print
 * look) and each band is lifted toward the haze by its own amount before the distance fog.
 */
/** distances of the range's rings beyond the valley's edge (m): dense across each crest */
export const RANGE_RINGS = (() => {
  // dense near the valley's edge, where the range eases up out of the valley floor (see buildBackdrop)
  const r = new Set<number>([0, 25, 60, 105, 160, 225, 300, 380]);
  for (const b of RANGE_BANDS) for (let i = 0; i <= 12; i++) r.add(Math.round(b.d + b.w * 1.15 * (i / 6 - 1) * Math.abs(i / 6 - 1) ** 0.35));
  r.add(RANGE_BANDS[2].d + RANGE_BANDS[2].w * 1.25);
  return [...r].filter((v) => v >= 0).sort((a, b) => a - b);
})();

/** bumps along the azimuth, irregularly spaced: azimuth (rad), half-width (rad), height (0..1) */
function bumps(seed: number, gap: [number, number], width: [number, number], low: number): [number, number, number][] {
  const rnd = mulberry32(seed);
  const out: [number, number, number][] = [];
  let a = rnd() * gap[0];
  while (a < Math.PI * 2 - gap[0] * 0.6) {
    out.push([a, width[0] + rnd() * (width[1] - width[0]), low + rnd() * (1 - low)]);
    a += gap[0] + rnd() * (gap[1] - gap[0]);
  }
  return out;
}
/** the far band's summits, the range's teeth and the foothills' rounded tops */
const SUMMITS = bumps(1414, [0.2, 0.5], [0.06, 0.16], 0.35);
const TEETH = bumps(2718, [0.05, 0.16], [0.025, 0.07], 0.2);
const HILLS = bumps(3141, [0.07, 0.22], [0.06, 0.16], 0.3);
/** the tallest of `set` at azimuth `a`, each shaped p^`sharp` (pointed > 1, rounded < 1) */
function skyline(set: [number, number, number][], a: number, sharp: number): number {
  let v = 0;
  for (const [sa, sw, sh] of set) {
    let da = Math.abs(a - sa);
    if (da > Math.PI) da = Math.PI * 2 - da;
    if (da >= sw) continue;
    const p = 1 - da / sw;
    v = Math.max(v, sh * (sharp < 1 ? Math.sqrt(1 - (1 - p) * (1 - p)) : p ** sharp));
  }
  return v;
}

/** crest height of each band above the valley's foot, along the azimuth `a` */
export function crestHeights(a: number): [number, number, number] {
  const cx = Math.cos(a);
  const cz = Math.sin(a);
  // the north (behind Kessel Bowl, -z) carries the big peaks; the south opens to lower ridges
  const north = smoothstep(0.25, -0.85, cz);
  const [b1, b2, b3] = RANGE_BANDS;
  // foothills: long, rounded crests
  // a run of separate, rounded hills, no two alike
  const f = 0.4 * n01(fbm2(cx * 1.7 + 9, cz * 1.7, 2, 71)) + 0.6 * skyline(HILLS, a, 0.5);
  const h1 = b1.crest[0] + (b1.crest[1] - b1.crest[0]) * f + b1.north * north;
  // the range: a serrated line, sharp teeth on a slow swell
  const swell = n01(fbm2(cx * 2.1, cz * 2.1 + 5, 2, 72));
  const teeth = 0.55 * skyline(TEETH, a, 1.3) + 0.45 * ridged2(cx * 5 + 3, cz * 5, 2, 73);
  const h2 = b2.crest[0] + (b2.crest[1] - b2.crest[0]) * (0.4 * swell + 0.6 * teeth) + b2.north * north;
  // the peaks: separate pyramids on a high shoulder
  const pk = skyline(SUMMITS, a, 1.35);
  const shoulder = n01(fbm2(cx * 3 + 11, cz * 3, 3, 74));
  const h3 = b3.crest[0] + (b3.crest[1] - b3.crest[0]) * (0.15 * shoulder + 0.85 * pk) + b3.north * north + (ridged2(cx * 9, cz * 9 + 7, 2, 75) - 0.45) * 60;
  return [h1, h2, h3];
}

/** the band profiles across a crest: pointed and concave on the flanks (0..1) */
const profile = (t: number, sharp: number) => {
  const p = Math.max(0, 1 - Math.abs(t));
  return sharp > 0 ? p ** (1 + sharp) : p * p * (3 - 2 * p);
};
/** smooth maximum, so the saddles between bands have no crease */
const smax = (a: number, b: number, k: number) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.max(a, b) + (h * h * k) / 4;
};

function buildBackdrop(t: Terrain): THREE.Mesh {
  const seg = 560;
  const rings = RANGE_RINGS.length;
  const nv = rings * (seg + 1);
  const pos = new Float32Array(nv * 3);
  const haze = new Float32Array(nv);
  const bandOf = new Uint8Array(nv);
  const baseOf = new Float32Array(nv);
  const riseOf = new Float32Array(nv);
  const base0 = (i: number) => baseOf[i];
  const idx: number[] = [];
  const crests = Array.from({ length: seg + 1 }, (_, s) => crestHeights((s / seg) * Math.PI * 2));
  for (let r = 0; r < rings; r++) {
    for (let s = 0; s <= seg; s++) {
      const a = (s / seg) * Math.PI * 2;
      // the first ring follows the square edge of the valley exactly, the rest spread out round it
      const edge = (WORLD_HALF - 2) / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a)));
      const R = RANGE_RINGS[r];
      const rad = edge + R;
      const x = Math.cos(a) * rad;
      const z = Math.sin(a) * rad;
      const foot = t.height(Math.cos(a) * edge, Math.sin(a) * edge);
      const base = foot * 0.55 + 60;
      // the valley's own slopes run out into the foothills
      let y = foot + (base + 80 - foot) * smoothstep(0, 420, R);
      let best = 0;
      let bestY = -1e9;
      RANGE_BANDS.forEach((b, i) => {
        // the crest line wanders in and out, so no band is a circle
        const dd = b.d + fbm2(Math.cos(a) * 3 + i * 7, Math.sin(a) * 3, 2, 76 + i) * b.w * 0.35;
        const ww = b.w * (0.8 + 0.4 * n01(fbm2(Math.cos(a) * 2.5, Math.sin(a) * 2.5 + i * 3, 2, 79 + i)));
        const yb = base + crests[s][i] * profile((R - dd) / ww, i === 0 ? 0 : i === 1 ? 0.6 : 0.45);
        if (yb > bestY) {
          bestY = yb;
          best = i;
        }
        y = smax(y, yb, i === 0 ? 120 : 160);
      });
      // erosion on the flanks: gullies and spurs from the WorldCraft heightfield, low-passed to what the
      // mesh can carry (anything finer than the rings draws as vertical streaks)
      const flank = smoothstep(base + 40, base + 260, y);
      const hu = 0.5 + x / 10400;
      const hv = 0.5 + z / 10400;
      const e = 0.008;
      const hf = (rangeAt(hu, hv) * 2 + rangeAt(hu + e, hv) + rangeAt(hu - e, hv) + rangeAt(hu, hv + e) + rangeAt(hu, hv - e)) / 6;
      y += (hf - 0.45) * 90 * flank;
      // Ease up out of the valley: the bands' smooth maximum and the flank erosion lifted the first rings
      // about 100 m within 60 m of the valley's edge, a vertical grey curtain under the foothills seen from
      // the valley floor. The surface now leaves the valley at the valley's own grade and steepens over
      // the first 360 m, so that strip reads as snowy, timbered slope running up into the foothills.
      y = foot + (y - foot) * smoothstep(0, 360, R) ** 0.8;
      if (r === 0) y = foot - 1;
      const o = (r * (seg + 1) + s) * 3;
      pos[o] = x;
      pos[o + 1] = y;
      pos[o + 2] = z;
      const v = r * (seg + 1) + s;
      bandOf[v] = R < RANGE_BANDS[0].d * 0.5 ? 0 : best;
      haze[v] = RANGE_BANDS[bandOf[v]].haze;
      baseOf[v] = base;
      // how far up its own band this point stands (0 at the foot, 1 at the crest): haze pools low
      riseOf[v] = Math.min(1, Math.max(0, (y - base) / Math.max(60, crests[s][bandOf[v]])));
    }
  }
  for (let r = 0; r < rings - 1; r++)
    for (let s = 0; s < seg; s++) {
      const a = r * (seg + 1) + s;
      const b = a + 1;
      const cc = a + seg + 1;
      const d = cc + 1;
      idx.push(a, b, cc, b, d, cc);
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const nor = geo.getAttribute('normal') as THREE.BufferAttribute;
  const cols = new Float32Array(pos.length);
  const rise = new Float32Array(nv);
  const c = new THREE.Color();
  const SNOW = new THREE.Color(0.93, 0.95, 0.98);
  const ROCK_A = new THREE.Color(0.33, 0.32, 0.35);
  const ROCK_B = new THREE.Color(0.42, 0.36, 0.32);
  // Engelmann spruce seen from kilometres away: a dark blue-green, never black
  const TIMBER = new THREE.Color(0.04, 0.085, 0.075);
  for (let i = 0; i < nv; i++) {
    const x = pos[i * 3];
    const y = pos[i * 3 + 1];
    const z = pos[i * 3 + 2];
    const ny = nor.getY(i);
    const slope = Math.acos(Math.min(1, Math.max(-1, ny)));
    const n1 = fbm2(x / 380, z / 380, 3, 41);
    const n2 = fbm2(x / 140, z / 140, 2, 43);
    const band = bandOf[i];
    // rock: grey granite with iron-stained patches
    c.copy(ROCK_A).lerp(ROCK_B, smoothstep(-0.2, 0.4, n1)).multiplyScalar(0.88 + n2 * 0.2);
    // snow lies below a band's own steepness limit: the far peaks are mostly white, the range is
    // granite with snow in its bowls, the foothills carry snow wherever the trees open
    const lim = [0.75, 0.62, 0.86][band];
    const hold = smoothstep(lim + 0.12 + n2 * 0.1, lim - 0.18 + n2 * 0.1, slope);
    c.lerp(SNOW, hold);
    // timber: the foothills are dark forest in big patches broken by snowy glades; on the range only
    // its lowest slopes; the peaks none
    const patches = smoothstep(-0.45, -0.05, fbm2(x / 420, z / 420, 3, 49) + n2 * 0.25);
    const low = smoothstep(base0(i) + 260, base0(i) + 60, y);
    const timber = band === 0 ? patches * (0.75 + 0.25 * low) : band === 1 ? patches * low * 0.8 : 0;
    c.lerp(TIMBER, timber * smoothstep(0.95, 0.5, slope) * 0.9);
    cols[i * 3] = c.r;
    cols[i * 3 + 1] = c.g;
    cols[i * 3 + 2] = c.b;
    rise[i] = riseOf[i];
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  geo.setAttribute('aHaze', new THREE.BufferAttribute(haze, 1));
  geo.setAttribute('aRise', new THREE.BufferAttribute(rise, 1));
  geo.computeBoundingSphere();
  const m = new THREE.Mesh(geo, createRangeMaterial());
  m.name = 'range';
  return m;
}

/** how much the bands are lifted into the haze (1 on a clear day; set with the weather) */
export const rangeUniforms = { haze: { value: 1 } };

/**
 * The range's material: Lambert with the light falling into soft bands (sunlit, turning, shade), the
 * screen-print look of a field-guide plate, and each band lifted toward the haze colour by its step.
 */
export function createRangeMaterial(): THREE.MeshLambertMaterial {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uRangeHaze = rangeUniforms.haze;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aHaze;\nattribute float aRise;\nvarying float vHaze;\nvarying float vRise;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHaze = aHaze;\nvRise = aRise;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${NOISE_GLSL}\nvarying float vHaze;\nvarying float vRise;\nuniform float uRangeHaze;`)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        #ifdef USE_FOG
        {
          // dark timber is a forest, not a smear: snow shows between the stands, finer up close
          float dark = 1.0 - smoothstep(0.12, 0.3, dot(diffuseColor.rgb, vec3(0.333)));
          float sp = eNoise2(vFogWorld.xz * 0.045) * 0.6 + eNoise2(vFogWorld.xz * 0.13) * 0.4;
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.8, 0.84, 0.9), dark * smoothstep(0.55, 0.8, sp) * 0.7);
        }
        #endif`,
      )
      .replace(
        '#include <lights_lambert_pars_fragment>',
        THREE.ShaderChunk.lights_lambert_pars_fragment.replace(
          'float dotNL = saturate( dot( geometryNormal, directLight.direction ) );',
          // three soft steps of light instead of a smooth ramp
          `float nl = dot( geometryNormal, directLight.direction );
          float dotNL = smoothstep( -0.02, 0.1, nl ) * 0.42 + smoothstep( 0.32, 0.44, nl ) * 0.36 + smoothstep( 0.62, 0.74, nl ) * 0.22;
          // the further the band, the flatter its light: distance reads as planes, not modelling
          dotNL = mix( dotNL, 0.55, smoothstep( 0.1, 0.6, vHaze ) * 0.6 );`,
        ),
      )
      .replace(
        '#include <fog_fragment>',
        `#ifdef USE_FOG
          // each band one step further into the haze, and the haze lying thicker at its foot
          float hz = vHaze + ( 1.0 - vRise ) * ( 1.0 - vRise ) * ( 0.04 + vHaze * 0.6 );
          gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, clamp( hz * uRangeHaze, 0.0, 0.92 ) );
        #endif
        #include <fog_fragment>`,
      );
  };
  m.customProgramCacheKey = () => 'range-bands-v4';
  return m;
}
