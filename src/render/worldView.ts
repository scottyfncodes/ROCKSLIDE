import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../sim/noise';
import { BC_GATE, BOWL, BUNKER, DISTRICTS, FUEL, LAKE, LIFT, LZS, pad, ROPE_TOW, SIGNPOSTS, streetLights, VILLAGE } from '../world/places';
import { routeSamples, type Terrain } from '../world/terrain';
import { bakeInPlace, ball, bake, box, cyl, gable, glow, logWall, mat, PAL, shade, snowRoof, windowPane } from './kit';
import { BUILDING_IDS, LIFT_IDS, mountAtPivot, paintModel, roleOf, type BuildingId, type PatrolModels } from './patrolModels';
import { sign } from './stationView';

/**
 * The rest of the valley's hand-made places: Hollin village with its chapel and the Kettle,
 * the Tannberg lift and huts, the weather station on the pass, Fernhut cabin, the boathouse on
 * Mirror Lake, the berm and signs at Kessel Bowl, and snow poles along every road.
 */
export class WorldView {
  readonly group = new THREE.Group();
  readonly smokeSources: THREE.Vector3[] = [];
  private chairs: { m: THREE.Object3D; s: number }[] = [];
  private liftLine: { a: THREE.Vector3; b: THREE.Vector3; len: number; dir: THREE.Vector3 } | null = null;
  private windows: THREE.MeshLambertMaterial;
  /** the lit windows' material (the lamplight finds the panes by it) */
  get windowMaterial(): THREE.Material {
    return this.windows;
  }
  private streetLights: THREE.MeshBasicMaterial;
  private anemo: THREE.Group | null = null;
  /** the MeshCraft weather-station mast (art/3d/scripts/working_mountain.py), if it loaded */
  private weatherMast: THREE.Object3D | null = null;
  /** true when the weather station's mast is the MeshCraft one */
  get weatherModelled() {
    return !!this.weatherMast;
  }
  private stationIce: THREE.Mesh | null = null;
  private stationLight: THREE.Mesh | null = null;
  stationWorking = false;
  private t = 0;
  /** the MeshCraft buildings, when every one of them loaded (otherwise the code builds them all) */
  private bm: Record<BuildingId, THREE.Object3D> | null;
  /** true when the valley's buildings are the MeshCraft models */
  readonly modelled: boolean;
  /** the MeshCraft chairlift (towers, end towers, the chair), when all three loaded */
  private lift: { tower: THREE.Object3D; end: THREE.Object3D; chair: THREE.Object3D } | null;
  /** true when the chairlift is the MeshCraft one */
  get liftModelled() {
    return !!this.lift;
  }
  /** the chairs as one instanced mesh per material (the model's chairs): the cable moves them all */
  private chairInst: THREE.InstancedMesh[] = [];

  constructor(
    private terrain: Terrain,
    models: PatrolModels = {},
  ) {
    this.bm = BUILDING_IDS.every((id) => models[id]) ? (Object.fromEntries(BUILDING_IDS.map((id) => [id, models[id]!])) as unknown as Record<BuildingId, THREE.Object3D>) : null;
    this.modelled = !!this.bm;
    this.weatherMast = models.rs_weather_mast ?? null;
    this.lift = LIFT_IDS.every((id) => models[id]) ? { tower: models.rs_lift_tower!, end: models.rs_lift_tower_end!, chair: models.rs_chair! } : null;
    this.windows = new THREE.MeshLambertMaterial({ color: PAL.window, emissive: 0xffa040, emissiveIntensity: 0.2 });
    this.streetLights = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
    // each place is built, then merged into a handful of meshes of its own (so it still culls)
    const region = (build: () => void, keep: () => THREE.Object3D[] = () => []) => {
      const before = new Set(this.group.children);
      build();
      const g = new THREE.Group();
      for (const c of [...this.group.children]) if (!before.has(c)) g.add(c);
      this.group.add(g);
      bakeInPlace(g, keep());
    };
    region(() => this.buildVillage());
    region(() => this.buildResort(), () => this.chairs.map((c) => c.m));
    region(() => this.buildWeatherStation(), () => [this.anemo!, this.stationIce!, this.stationLight!]);
    region(() => this.buildCabin());
    region(() => this.buildBoathouse());
    region(() => this.buildBowl());
    for (const lz of LZS) region(() => this.buildLZ(lz));
    this.buildPoles();
  }

  private ground(x: number, z: number) {
    return this.terrain.height(x, z);
  }

  /**
   * A copy of a MeshCraft building, painted with the game's own materials: each part carries a
   * palette role, and `paint` says which material that role is for this building (its wall and roof
   * colours, the lit windows). Roles not named take the valley's standard material for them. So a
   * region still bakes into one mesh per material, as the code-built version did.
   */
  private building(id: BuildingId, paint: Record<string, THREE.Material> = {}): THREE.Group {
    const std: Record<string, THREE.Material> = {
      stone: mat(PAL.stone),
      stoneDark: mat(PAL.stoneDark),
      trim: mat(PAL.white),
      logDark: mat(PAL.logDark),
      logLight: mat(PAL.logLight),
      roofSnow: mat(PAL.roofSnow),
      window: this.windows,
      door: mat(0x6b4428),
      log: mat(PAL.log),
      logShade: mat(shade(PAL.log, 0.92)),
      grain: mat(0xd6b38a),
      dome: mat(PAL.mustard),
      spire: mat(PAL.yellow),
      belfry: mat(0x262a30),
      boat: mat(0x6b4428),
      boatDark: mat(0x3d2a1c),
      wall: mat(PAL.white),
      plank: mat(shade(PAL.white, 0.9)),
      roof: mat(PAL.roof),
      shutter: mat(PAL.green),
    };
    const g = this.bm![id].clone(true) as THREE.Group;
    g.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const role = roleOf(m);
      m.material = paint[role] ?? std[role] ?? mat(parseInt(String((m.material as THREE.Material).userData?.gitcraft_color ?? '#cccccc').slice(1), 16));
      m.castShadow = true;
      m.receiveShadow = true;
    });
    return g;
  }

  /**
   * The MeshCraft chalet fitted to a house: the body and roof stretch to its width and depth (the roof
   * pitch follows the shorter side, as the code's did), the balcony moves to its front wall, the door
   * keeps its size. The wide model serves the big houses, the small one the single-storey huts.
   */
  private modelChalet(w: number, d: number, wall: number, roofCol: number, floors: number, balcony: boolean): THREE.Group {
    const [id, w0, d0] = floors < 2 ? (['rs_chalet_small', 4, 3.5] as const) : w >= 8.5 ? (['rs_chalet_wide', 10, 7.5] as const) : (['rs_chalet', 6, 5] as const);
    const g = this.building(id, {
      wall: mat(wall),
      plank: mat(shade(wall, 0.88)),
      roof: mat(roofCol),
      shutter: mat(wall === PAL.mint ? PAL.burgundy : PAL.green),
    });
    const sx = w / w0;
    const sz = d / d0;
    const node = (n: string) => g.getObjectByName(n)!;
    node('body').scale.set(sx, 1, sz);
    node('roof').scale.set(sx, Math.min(w, d) / Math.min(w0, d0), sz);
    // the door keeps its size; it moves to the house's front, to one side (clear of the signs)
    const door = node('door');
    door.position.set(w * 0.28 - w0 * 0.22, 0, (d - d0) / 2);
    const bal = g.getObjectByName('balcony');
    if (bal) {
      bal.position.z = d / 2;
      bal.scale.x = sx;
      bal.visible = balcony && floors > 1;
    }
    // the chimney is placed by whoever adds the smoke (buildVillage); hidden until then
    const chimney = node('chimney');
    chimney.visible = false;
    g.userData.chimney = chimney;
    g.userData.door = door;
    return g;
  }

  /** An alpine chalet: stone ground floor, timber upper, a balcony, a deep snowy roof. */
  private chalet(w: number, d: number, wall: number, roofCol: number, floors = 2, balcony = true): THREE.Group {
    if (this.bm) return this.modelChalet(w, d, wall, roofCol, floors, balcony);
    const g = new THREE.Group();
    const h1 = 2.6;
    g.add(box(w, h1, d, PAL.stone, 0, h1 / 2, 0));
    g.add(box(w + 0.05, 0.25, d + 0.05, PAL.stoneDark, 0, 0.12, 0));
    let top = h1;
    if (floors > 1) {
      g.add(box(w, 2.4, d, wall, 0, h1 + 1.2, 0));
      // a cream band and corner boards: painted timber, picked out
      g.add(box(w + 0.08, 0.18, d + 0.08, PAL.white, 0, h1 + 0.05, 0));
      for (const cx of [-w / 2, w / 2]) for (const cz of [-d / 2, d / 2]) g.add(box(0.16, 2.4, 0.16, PAL.white, cx, h1 + 1.2, cz));
      top = h1 + 2.4;
    }
    // windows with shutters
    for (const s of [-1, 1]) {
      for (const x of [-w / 4, w / 4]) {
        const win = windowPane(0.8, 0.9, this.windows);
        win.position.set(x, floors > 1 ? h1 + 1.3 : 1.5, (s * d) / 2 + s * 0.06);
        if (s < 0) win.rotation.y = Math.PI;
        g.add(win);
        for (const sx of [-0.62, 0.62]) g.add(box(0.4, 1.0, 0.06, wall === PAL.mint ? PAL.burgundy : PAL.green, x + sx, win.position.y, (s * d) / 2 + s * 0.1));
      }
    }
    if (balcony && floors > 1) {
      g.add(box(w * 0.8, 0.12, 1.1, PAL.logDark, 0, h1 + 0.15, d / 2 + 0.55));
      for (let i = 0; i <= 8; i++) g.add(box(0.06, 0.8, 0.06, PAL.logLight, -w * 0.4 + (i * w * 0.8) / 8, h1 + 0.6, d / 2 + 1.05));
      g.add(box(w * 0.8, 0.08, 0.1, PAL.logLight, 0, h1 + 1.0, d / 2 + 1.05));
    }
    const r = snowRoof(w + 1.6, d + 1.8, Math.min(w, d) * 0.42, roofCol);
    r.rotation.y = Math.PI / 2;
    r.position.y = top;
    g.add(r);
    for (const s of [-1, 1]) {
      const ge = gable(0.25, Math.min(w, d) * 0.42, w, wall);
      ge.rotation.y = Math.PI / 2;
      ge.position.set(0, top, s * (d / 2 - 0.05));
      g.add(ge);
    }
    return g;
  }

  private buildVillage() {
    // Hollin as a painted row: pastel facades with cream trim, burgundy and slate roofs
    const roofs = [PAL.burgundy, 0x5a4f6e, 0x8e3f4c, 0x4f5f70];
    const walls = [PAL.blush, PAL.mustard, PAL.mint, PAL.powder, PAL.lavender];
    const rng = mulberry32(31);
    const parts = new THREE.Group();
    for (const v of VILLAGE) {
      const y = this.ground(v.x, v.z);
      let b: THREE.Group;
      switch (v.kind) {
        case 'lodge': {
          b = this.chalet(9, 7, 0xd98b8f, PAL.burgundy, 2, true);
          const s = sign('THE KETTLE', 3.4, 0.7, { bg: '#7b2f3b', fg: '#f6ecdc' });
          s.position.set(0, 2.25, 3.6);
          b.add(s);
          // tables out front with umbrellas folded for winter
          for (const x of [-2.5, 2.5]) b.add(box(1.2, 0.08, 0.8, PAL.logDark, x, 0.75, 5), cyl(0.05, 0.05, 2.2, 5, PAL.logDark, x, 1.1, 5), cyl(0.12, 0.12, 1.1, 6, PAL.red, x, 2.0, 5));
          break;
        }
        case 'clinic': {
          b = this.chalet(7, 6, PAL.mint, 0x4f5f70, 2, false);
          const s = sign('CLINIC', 2.4, 0.6, { bg: '#f6ecdc', fg: '#3a2632', accent: '#d4422f' });
          s.position.set(0, 2.3, 3.07);
          b.add(s);
          b.add(box(1.4, 2.1, 0.1, 0x6f8fbf, 0, 1.05, 3.05));
          // the clinic has its glass door; the model's own front door would be a second one
          if (b.userData.door) b.userData.door.visible = false;
          break;
        }
        case 'shop': {
          b = this.chalet(6, 5, PAL.mustard, PAL.burgundy, 2, true);
          const s = sign('BAKER', 2.2, 0.5, { bg: '#e7aaa6', fg: '#7b2f3b' });
          s.position.set(0, 2.3, 2.57);
          b.add(s);
          break;
        }
        case 'gear': {
          b = this.chalet(6.5, 5.5, PAL.mustard, PAL.burgundy, 2, false);
          const s = sign('GEAR SHOP', 2.8, 0.55, { bg: '#7b2f3b', fg: '#f6ecdc' });
          s.position.set(0, 2.3, 2.82);
          b.add(s);
          // a rack of new skis and poles by the door
          for (let i = 0; i < 6; i++) b.add(box(0.1, 1.7, 0.04, [PAL.red, 0x2f5f9e, PAL.yellow][i % 3], -2.4 + i * 0.22, 0.95, 3.2));
          b.add(box(1.5, 0.08, 0.3, PAL.logDark, -1.85, 1.4, 3.25));
          break;
        }
        case 'rentals': {
          b = this.chalet(6.5, 5.5, PAL.powder, 0x4f5f70, 2, false);
          const s = sign('RENTALS', 2.6, 0.55, { bg: '#2f5f9e', fg: '#f3efe6' });
          s.position.set(0, 2.3, 2.82);
          b.add(s);
          // the rental racks out front: two rows of skis standing in the snow
          for (const row of [3.6, 4.4])
            for (let i = 0; i < 9; i++) b.add(box(0.09, 1.6, 0.04, i % 2 ? PAL.red : 0xf3efe6, -2.4 + i * 0.6, 0.8, row));
          b.add(box(5.6, 0.1, 0.12, PAL.logDark, 0, 1.3, 4));
          break;
        }
        case 'bar': {
          b = this.chalet(9, 7, PAL.blush, PAL.burgundy, 2, true);
          const s = sign('APRÈS', 3, 0.7, { bg: '#7b2f3b', fg: '#f6ecdc', accent: '#f2c230' });
          s.position.set(0, 2.25, 3.6);
          b.add(s);
          // the deck: picnic tables, a fire pit
          for (const x of [-2.8, 0, 2.8]) b.add(box(1.4, 0.08, 0.8, PAL.logDark, x, 0.75, 5.4), box(1.4, 0.06, 0.3, PAL.logDark, x, 0.45, 4.8), box(1.4, 0.06, 0.3, PAL.logDark, x, 0.45, 6));
          b.add(cyl(0.6, 0.7, 0.4, 10, PAL.stone, 0, 0.2, 7.6));
          this.smokeSources.push(new THREE.Vector3(v.x + Math.sin(v.rot) * 7.6, y + 0.8, v.z + Math.cos(v.rot) * 7.6));
          break;
        }
        case 'condo': {
          b = this.chalet(8, 6.5, walls[Math.floor(rng() * walls.length)], roofs[Math.floor(rng() * roofs.length)], 2, true);
          break;
        }
        case 'baselodge': {
          b = this.chalet(10, 7.5, PAL.blush, PAL.burgundy, 2, true);
          const s = sign('TANNBERG', 4, 0.8, { bg: '#2f5f9e', fg: '#f3efe6' });
          s.position.set(0, 5.9, 4.05);
          b.add(s);
          const t2 = sign('TICKETS · PATROL', 3.2, 0.5, { bg: '#f6ecdc', fg: '#2f5f9e' });
          t2.position.set(0, 2.3, 3.81);
          b.add(t2);
          break;
        }
        case 'chapel': {
          if (this.bm) {
            b = this.building('rs_chapel', { wall: mat(PAL.powder), roof: mat(PAL.burgundy) });
            break;
          }
          b = new THREE.Group();
          b.add(box(5, 4.2, 8, PAL.powder, 0, 2.1, 0));
          const r = snowRoof(5.8, 8.8, 2.4, PAL.burgundy);
          r.rotation.y = Math.PI / 2;
          r.position.y = 4.2;
          b.add(r);
          // the bell tower with its onion dome
          b.add(box(2.4, 8, 2.4, PAL.white, 0, 4, -4.6));
          const dome = ball(1.4, PAL.mustard, 0, 9.0, -4.6, 12);
          dome.scale.set(1, 1.15, 1);
          b.add(dome, cyl(0.06, 0.06, 1.6, 4, PAL.yellow, 0, 10.8, -4.6), ball(0.55, PAL.roofSnow, 0, 9.9, -4.6, 8));
          b.add(box(0.9, 1.2, 0.1, 0x262a30, 0, 6.6, -3.35));
          break;
        }
        default:
          b = this.chalet(5 + rng() * 1.5, 4.5 + rng(), walls[Math.floor(rng() * walls.length)], roofs[Math.floor(rng() * roofs.length)], 2, rng() > 0.4);
      }
      b.position.set(v.x, y, v.z);
      b.rotation.y = v.rot;
      parts.add(b);
      // a chimney with smoke on most
      if (v.kind !== 'chapel') {
        const cx = v.x + Math.cos(v.rot) * 1.2;
        const cz = v.z - Math.sin(v.rot) * 1.2;
        this.smokeSources.push(new THREE.Vector3(cx, y + 8.2, cz));
        if (b.userData.chimney) {
          // the model's chimney, where the code put its own (and the smoke)
          const ch = b.userData.chimney as THREE.Object3D;
          ch.position.set(1.2, 5.55, 0);
          ch.visible = true;
        } else b.add(box(0.7, 2.5, 0.7, PAL.stone, 1.2, 6.8, 0));
      }
      // wood piles and a sled by the door
      if (v.kind === 'house') {
        const wp = new THREE.Group();
        for (let i = 0; i < 9; i++) {
          const log = cyl(0.13, 0.13, 1.1, 6, i % 2 ? PAL.log : PAL.logLight, (i % 3) * 0.27 - 0.27, 0.15 + Math.floor(i / 3) * 0.24, 0);
          log.rotation.x = Math.PI / 2;
          wp.add(log);
        }
        wp.position.set(-2.6, 0, 2.2);
        b.add(wp);
      }
    }
    parts.add(this.buildTown());
    this.group.add(parts);
  }

  /**
   * The town's furniture: light poles down both sides of Main Street, signposts at the corners pointing
   * to the districts, the plaza's lit spruce and trail map, the avalanche control bunker and the fuel
   * pumps in the patrol's vehicle yard, and the rope tow up the terrain park.
   */
  private buildTown(): THREE.Group {
    const g = new THREE.Group();
    const dark = 0x262a30;
    for (const p of streetLights()) {
      const l = new THREE.Group();
      l.add(cyl(0.09, 0.12, 4.6, 6, dark, 0, 2.3, 0), box(0.5, 0.55, 0.5, this.streetLights, 0, 4.75, 0), box(0.7, 0.12, 0.7, dark, 0, 5.08, 0));
      // a cream band at eye height: the poles are the way-markers in a whiteout
      l.add(cyl(0.13, 0.13, 0.3, 6, PAL.white, 0, 1.6, 0));
      l.position.set(p.x, this.ground(p.x, p.z), p.z);
      g.add(l);
    }
    // every signpost arm reads from one canvas (a row per district), so the posts merge into one draw call
    const names = Object.fromEntries(DISTRICTS.map((d) => [d.id, d]));
    const rows = DISTRICTS.length;
    const atlas = document.createElement('canvas');
    atlas.width = 512;
    atlas.height = 80 * rows;
    const ctx = atlas.getContext('2d');
    if (ctx) {
      DISTRICTS.forEach((d, i) => {
        ctx.fillStyle = d.id === 'hq' || d.id === 'yard' ? '#7b2f3b' : '#2f5f9e';
        ctx.fillRect(0, i * 80, 512, 80);
        ctx.fillStyle = '#f6ecdc';
        ctx.font = '600 44px Jost, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(d.name.toUpperCase(), 256, i * 80 + 42);
      });
    }
    const tex = new THREE.CanvasTexture(atlas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const armMat = new THREE.MeshLambertMaterial({ map: tex });
    for (const sp of SIGNPOSTS) {
      const post = new THREE.Group();
      post.add(cyl(0.1, 0.12, 3.6, 6, PAL.logDark, 0, 1.8, 0), box(0.3, 0.3, 0.3, PAL.roofSnow, 0, 3.65, 0));
      sp.to.forEach((id, i) => {
        const d = names[id];
        const row = DISTRICTS.indexOf(d);
        // the arm points at the district: a board on the post's side, its text along the arm
        const geo = new THREE.PlaneGeometry(2.2, 0.36);
        const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
        for (let k = 0; k < uv.count; k++) uv.setY(k, 1 - (row + 1 - uv.getY(k)) / rows);
        // the back face carries the text the right way round from the other side
        const back = geo.clone();
        const buv = back.getAttribute('uv') as THREE.BufferAttribute;
        for (let k = 0; k < buv.count; k++) buv.setX(k, 1 - buv.getX(k));
        const ang = Math.atan2(d.x - sp.x, d.z - sp.z) - Math.PI / 2;
        for (const [gg, a2] of [[geo, ang], [back, ang + Math.PI]] as const) {
          const arm = new THREE.Mesh(gg, armMat);
          arm.rotation.y = a2;
          arm.translateX(a2 === ang ? 1.25 : -1.25);
          arm.translateZ(a2 === ang ? 0.02 : 0.02);
          arm.position.y = 3.1 - i * 0.48;
          post.add(arm);
        }
      });
      post.position.set(sp.x, this.ground(sp.x, sp.z), sp.z);
      g.add(post);
    }
    // the plaza: a lit spruce and the trail map, facing down Main Street
    const plaza = pad('resort');
    const sq = new THREE.Group();
    const bulbs = [0xffd23f, 0xff5a3a, 0x7fd3e8].map((c) => glow(c));
    for (let i = 0; i < 4; i++) sq.add(new THREE.Mesh(new THREE.ConeGeometry(2.2 - i * 0.45, 2.4, 8), mat(0x2b4a33)).translateY(1.6 + i * 1.3));
    for (let i = 0; i < 18; i++) {
      const a = i * 1.7;
      const h = 1 + (i / 18) * 5;
      const r = 2.1 - (i / 18) * 1.7;
      // three lit colours, three materials: the merged tree is three draw calls, not eighteen
      sq.add(ball(0.12, bulbs[i % 3], Math.cos(a) * r, h, Math.sin(a) * r, 6));
    }
    sq.position.set(plaza.x - 12, this.ground(plaza.x - 12, plaza.z + 18), plaza.z + 18);
    g.add(sq);
    const map = new THREE.Group();
    map.add(box(0.15, 2.4, 0.15, PAL.logDark, -1.6, 1.2, 0), box(0.15, 2.4, 0.15, PAL.logDark, 1.6, 1.2, 0));
    const board = sign('TRAIL MAP', 3.4, 1.4, { bg: '#f6ecdc', fg: '#2f5f9e', accent: '#d8382a' });
    board.position.set(0, 2.1, 0.09);
    map.add(board, box(3.6, 0.2, 0.5, PAL.roofSnow, 0, 2.95, 0));
    map.position.set(plaza.x + 8, this.ground(plaza.x + 8, plaza.z + 22), plaza.z + 22);
    g.add(map);
    // Patrol HQ's avalanche control bunker: a squat concrete magazine, earthed in, with the cannon storage
    // doors and the howitzer's barrel under a tarp out front
    const bk = new THREE.Group();
    bk.add(box(9, 3, 6.5, 0x8a8d8f, 0, 1.5, 0), box(9.6, 0.4, 7.1, PAL.roofSnow, 0, 3.2, 0));
    bk.add(box(3.4, 2.4, 0.12, 0x4d5a3c, -1.9, 1.2, 3.28), box(1.4, 2.1, 0.12, 0x4d5a3c, 2.6, 1.05, 3.28));
    const bs = sign('AVALANCHE CONTROL', 3.2, 0.5, { bg: '#d8382a', fg: '#ffffff' });
    bs.position.set(0, 2.75, 3.36);
    bk.add(bs);
    const barrel = cyl(0.13, 0.17, 3.2, 8, dark, -2, 1.3, 5.2);
    barrel.rotation.x = Math.PI / 2 - 0.35;
    bk.add(barrel, box(1.2, 0.8, 1.4, 0x4d5a3c, -2, 0.55, 4), cyl(0.45, 0.45, 0.25, 10, dark, -2.75, 0.45, 4).rotateZ(Math.PI / 2), cyl(0.45, 0.45, 0.25, 10, dark, -1.25, 0.45, 4).rotateZ(Math.PI / 2));
    bk.position.set(BUNKER.x, this.ground(BUNKER.x, BUNKER.z), BUNKER.z);
    bk.rotation.y = BUNKER.rot;
    g.add(bk);
    // the vehicle yard's fuel: a tank on a cradle and two pumps on an island
    const fuel = new THREE.Group();
    const tank = cyl(1.1, 1.1, 4.4, 14, PAL.red, 0, 1.6, -2.4);
    tank.rotation.z = Math.PI / 2;
    fuel.add(tank, box(4, 0.6, 1.4, 0x8a8d8f, 0, 0.3, -2.4), box(2.6, 0.25, 1.2, 0x8a8d8f, 0, 0.12, 1));
    for (const x of [-0.7, 0.7]) fuel.add(box(0.5, 1.5, 0.4, PAL.red, x, 0.95, 1), box(0.52, 0.3, 0.42, 0xf3efe6, x, 1.45, 1));
    const fs = sign('FUEL', 1.4, 0.4, { bg: '#f2c230', fg: '#3a2632' });
    fs.position.set(0, 2.4, 1);
    fuel.add(fs, cyl(0.06, 0.06, 2.2, 5, dark, 0, 1.2, 1.2));
    fuel.position.set(FUEL.x, this.ground(FUEL.x, FUEL.z), FUEL.z);
    fuel.rotation.y = FUEL.rot;
    g.add(fuel);
    // the park's rope tow: a bull wheel at each end on posts, the rope between
    const a = ROPE_TOW.from;
    const b = ROPE_TOW.to;
    const ya = this.ground(a.x, a.z);
    const yb = this.ground(b.x, b.z);
    for (const [p, y] of [[a, ya], [b, yb]] as const) g.add(cyl(0.12, 0.12, 2.4, 6, 0xd8382a, p.x, y + 1.2, p.z), cyl(0.5, 0.5, 0.12, 12, dark, p.x, y + 2.4, p.z));
    const ropeGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(a.x, ya + 2.3, a.z), new THREE.Vector3(b.x, yb + 2.3, b.z)]);
    g.add(new THREE.Line(ropeGeo, new THREE.LineBasicMaterial({ color: 0x1d1f22 })));
    // the backcountry gate: posts, a rope, the sign
    {
      const gx = BC_GATE.x;
      const gz = BC_GATE.z;
      for (const o of [-4.5, 4.5]) g.add(cyl(0.07, 0.07, 1.6, 5, 0xf07a1a, gx + o * 0.15, this.ground(gx, gz + o) + 0.8, gz + o));
      const rope = box(0.05, 0.05, 9, 0xd8382a, gx, this.ground(gx, gz) + 1.2, gz);
      rope.rotation.y = 0.15;
      const bs = sign('BACKCOUNTRY GATE', 2.4, 0.5, { bg: '#d8382a', fg: '#ffffff' });
      bs.position.set(gx - 0.1, this.ground(gx, gz) + 1.8, gz);
      bs.rotation.y = -Math.PI / 2;
      g.add(rope, bs);
    }
    const ps = sign('TERRAIN PARK', 2.6, 0.5, { bg: '#2f5f9e', fg: '#f3efe6', accent: '#f2c230' });
    ps.position.set(a.x + 3, ya + 2.2, a.z + 1);
    g.add(ps, cyl(0.08, 0.08, 2.2, 5, dark, a.x + 3, ya + 1.1, a.z + 0.9));
    return g;
  }

  /** The marked LZs for the helicopter: a ring of orange wands on the snow and a windsock, each its own region. */
  private buildLZ(lz: (typeof LZS)[number]) {
    const g = new THREE.Group();
    const dark = 0x262a30;
    for (let i = 0; i < 8; i++) {
      const a2 = (i / 8) * Math.PI * 2;
      const x = lz.x + Math.cos(a2) * lz.r * 0.8;
      const z = lz.z + Math.sin(a2) * lz.r * 0.8;
      const y = this.ground(x, z);
      g.add(cyl(0.04, 0.04, 1.3, 4, dark, x, y + 0.65, z), box(0.14, 0.4, 0.14, 0xf07a1a, x, y + 1.35, z));
    }
    const sx = lz.x + lz.r * 0.95;
    const sy = this.ground(sx, lz.z);
    const sock = cyl(0.28, 0.12, 1.4, 8, 0xf07a1a, sx + 0.7, sy + 3.6, lz.z);
    sock.rotation.z = Math.PI / 2;
    g.add(cyl(0.05, 0.05, 3.8, 5, dark, sx, sy + 1.9, lz.z), sock);
    this.group.add(g);
  }

  private buildResort() {
    const top = pad('lifttop');
    // top station hut
    if (this.bm) {
      // the MeshCraft log cabin fitted to the hut: 6 x 4 m, walls 2.6 m, its roof 7 x 5.4 m, pitch 1.6
      const hut = this.building('rs_cabin');
      hut.getObjectByName('body')!.scale.set(6 / 5, 2.6 / 2.3, 1);
      const roof = hut.getObjectByName('roof')!;
      roof.position.y = 2.6;
      roof.scale.set(7 / 6, 1.6 / 1.7, 5.4 / 5.6);
      hut.position.set(top.x + 10, this.ground(top.x, top.z), top.z - 6 + 2);
      this.group.add(hut);
    } else {
    const hut = new THREE.Group();
    const L = logWall(6, 2.6);
    hut.add(L);
    const L2 = logWall(6, 2.6);
    L2.position.z = 4;
    hut.add(L2);
    for (const x of [-3, 3]) {
      const l = logWall(4, 2.6);
      l.rotation.y = Math.PI / 2;
      l.position.set(x, 0, 2);
      hut.add(l);
    }
    const r = snowRoof(7, 5.4, 1.6);
    r.position.set(0, 2.6, 2);
    hut.add(r);
    hut.position.set(top.x + 10, this.ground(top.x, top.z), top.z - 6);
    this.group.add(hut);
    }
    const ts = sign('TOP STATION', 3, 0.6, { bg: '#2f5f9e', fg: '#f3efe6' });
    ts.position.set(top.x + 10, this.ground(top.x, top.z) + 3.4, top.z - 1.8);
    this.group.add(ts);
    // the chairlift: towers, a cable loop, chairs that move
    const a = new THREE.Vector3(LIFT.from[0], 0, LIFT.from[1]);
    const b = new THREE.Vector3(LIFT.to[0], 0, LIFT.to[1]);
    const n = 10;
    const towers: THREE.Vector3[] = [];
    for (let i = 0; i <= n; i++) {
      const p = a.clone().lerp(b, i / n);
      const y = this.ground(p.x, p.z);
      const hgt = i === 0 || i === n ? 6 : 10;
      const end = i === 0 || i === n;
      const tw = this.lift ? paintModel(end ? this.lift.end : this.lift.tower, {}, (hex) => mat(hex)) : new THREE.Group();
      if (!this.lift) {
        tw.add(box(0.5, hgt, 0.5, 0x6e7a85, 0, hgt / 2, 0), box(3.2, 0.3, 0.4, 0x6e7a85, 0, hgt, 0));
        if (end) tw.add(new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.15, 6, 16), mat(0x262a30)).rotateX(Math.PI / 2).translateZ(-hgt));
      }
      tw.position.set(p.x, y, p.z);
      tw.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
      this.group.add(tw);
      towers.push(new THREE.Vector3(p.x, y + hgt - 0.2, p.z));
    }
    const dir = b.clone().sub(a).normalize();
    const side = new THREE.Vector3(dir.z, 0, -dir.x).multiplyScalar(1.5);
    for (const s2 of [-1, 1]) {
      const pts = towers.map((t) => t.clone().addScaledVector(side, s2));
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      this.group.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x1d1f22 })));
    }
    this.liftLine = { a: towers[0], b: towers[n], len: towers[0].distanceTo(towers[n]), dir };
    const chairMat = mat(0x2f5f9e);
    const chairs = 22;
    if (this.lift) {
      // the MeshCraft chair, drawn as one instanced mesh per material: every chair in a few draw
      // calls. Each chair's place still comes from the cable (update()), through a stand-in object.
      const chair = paintModel(this.lift.chair, {}, (hex) => mat(hex));
      chair.updateMatrixWorld(true);
      const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
      chair.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        const list = byMat.get(m.material as THREE.Material) ?? [];
        list.push(m.geometry.clone().applyMatrix4(m.matrixWorld));
        byMat.set(m.material as THREE.Material, list);
      });
      for (const [material, geos] of byMat) {
        const geo = geos.length === 1 ? geos[0] : mergeGeometries(geos.map((g) => (g.index ? g.toNonIndexed() : g)), false)!;
        const inst = new THREE.InstancedMesh(geo, material, chairs);
        inst.castShadow = true;
        // the chairs travel the whole line: cull them as a lot, by a sphere round the whole lift
        inst.boundingSphere = new THREE.Sphere(towers[0].clone().lerp(towers[n], 0.5), towers[0].distanceTo(towers[n]) / 2 + 6);
        this.chairInst.push(inst);
        this.group.add(inst);
      }
      for (let i = 0; i < chairs; i++) this.chairs.push({ m: new THREE.Object3D(), s: i / chairs });
    } else
    for (let i = 0; i < chairs; i++) {
      const c = new THREE.Group();
      c.add(cyl(0.03, 0.03, 1.6, 4, 0x262a30, 0, -0.8, 0), box(1.2, 0.1, 0.5, chairMat, 0, -1.6, 0), box(1.2, 0.6, 0.08, chairMat, 0, -1.3, 0.25));
      this.group.add(c);
      this.chairs.push({ m: c, s: i / chairs });
    }
    // fences and piste markers along the run
    for (const p of routeSamples(this.terrain, 'piste', 26)) {
      for (const s2 of [-1, 1]) {
        const x = p.x - p.tz * s2 * 17;
        const z = p.z + p.tx * s2 * 17;
        const pole = cyl(0.05, 0.05, 1.6, 4, s2 < 0 ? 0x2f5f9e : 0xf3efe6, x, this.ground(x, z) + 0.8, z);
        const tip = box(0.12, 0.3, 0.12, s2 < 0 ? 0x2f5f9e : 0xd8382a, x, this.ground(x, z) + 1.6, z);
        this.group.add(pole, tip);
      }
    }
  }

  private buildWeatherStation() {
    const st = pad('station');
    const x = -646;
    const z = -296;
    const y = this.ground(x, z);
    const g = new THREE.Group();
    g.position.set(x, y, z);
    this.stationIce = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 6), new THREE.MeshLambertMaterial({ color: 0xcfe8f5, transparent: true, opacity: 0.85 }));
    this.stationIce.position.y = 7.2;
    this.stationIce.scale.set(1.8, 0.7, 1.8);
    this.stationLight = box(0.12, 0.12, 0.05, glow(0xff3020), 0.2, 2.5, 0.37);
    const wm = this.weatherMast;
    if (wm) {
      // the MeshCraft mast; its anemometer is a node on the hub, turned by update() once repaired
      const m = paintModel(wm, { steel: mat(PAL.metal), steelDark: mat(0x5b5e60), dark: mat(0x333333), antenna: mat(PAL.white), catRed: mat(PAL.red), snow: mat(PAL.snow), panel: mat(0x1f3a60) }, (hex) => mat(hex));
      const an = new THREE.Group();
      an.position.y = 7.2;
      mountAtPivot(m.getObjectByName('anemometer')!, an);
      this.anemo = an;
      g.add(m.getObjectByName('mast')!, an, this.stationIce, this.stationLight);
    } else {
      g.add(cyl(0.12, 0.14, 7, 6, PAL.metal, 0, 3.5, 0));
      for (const a of [0, 2.1, 4.2]) {
        const guy = cyl(0.02, 0.02, 8, 3, 0x333333, Math.cos(a) * 2, 3.5, Math.sin(a) * 2);
        guy.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
        g.add(guy);
      }
      // the anemometer: three cups on a hub
      const an = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const arm = box(0.9, 0.04, 0.04, 0x333333);
        arm.position.x = 0.45;
        const cup = ball(0.13, PAL.white, 0.9, 0, 0, 8);
        const holder = new THREE.Group();
        holder.add(arm, cup);
        holder.rotation.y = (i * Math.PI * 2) / 3;
        an.add(holder);
      }
      an.position.y = 7.2;
      this.anemo = an;
      g.add(an, this.stationIce);
      // the logger box, a solar panel, a vane
      g.add(box(0.8, 1.0, 0.4, PAL.white, 0.2, 2.2, 0.15), box(1.4, 0.06, 0.9, 0x1f3a60, -0.2, 4.4, 0));
      g.add(this.stationLight);
      const vane = new THREE.Group();
      vane.add(box(1.2, 0.05, 0.05, 0x333333, 0, 0, 0), box(0.05, 0.3, 0.35, PAL.red, -0.6, 0, 0));
      vane.position.y = 6.2;
      g.add(vane);
    }
    // the little hut it reports from
    const hut = this.chalet(4, 3.5, PAL.mustard, PAL.burgundy, 1, false);
    hut.position.set(st.x + 6, this.ground(st.x + 6, st.z + 4), st.z + 4);
    this.group.add(g, hut);
  }

  private buildCabin() {
    const c = pad('cabin');
    if (this.bm) {
      const cabin = this.building('rs_cabin');
      cabin.position.set(c.x, this.ground(c.x, c.z), c.z);
      this.group.add(cabin);
      return;
    }
    const g = new THREE.Group();
    for (const [len, x, z, rot] of [
      [5, 0, -2, 0],
      [5, 0, 2, 0],
      [4, -2.5, 0, Math.PI / 2],
      [4, 2.5, 0, Math.PI / 2],
    ] as const) {
      const l = logWall(len, 2.3);
      l.rotation.y = rot;
      l.position.set(x, 0, z);
      g.add(l);
    }
    const r = snowRoof(6, 5.6, 1.7);
    r.position.y = 2.3;
    g.add(r);
    const w = windowPane(0.8, 0.7, this.windows);
    w.position.set(0, 1.4, 2.2);
    g.add(w);
    g.add(box(0.6, 1.8, 0.6, PAL.stone, 2.3, 3.2, 1));
    g.position.set(c.x, this.ground(c.x, c.z), c.z);
    this.group.add(g);
  }

  private buildBoathouse() {
    const x = -342;
    const z = 392;
    const y = this.ground(x, z);
    if (this.bm) {
      const bh = this.building('rs_boathouse');
      bh.position.set(x, y, z);
      bh.rotation.y = 0.5;
      this.group.add(bh);
      return;
    }
    const g = new THREE.Group();
    g.add(box(5, 2.4, 7, 0x6b4428, 0, 1.2, 0));
    const r = snowRoof(5.8, 7.8, 1.8, 0x5b3a2a);
    r.rotation.y = Math.PI / 2;
    r.position.y = 2.4;
    g.add(r);
    g.add(box(3, 2, 0.1, 0x3d2a1c, 0, 1.0, 3.55));
    g.add(box(1.6, 0.15, 6, PAL.logDark, 0, 0.3, 6.5));
    g.position.set(x, y, z);
    g.rotation.y = 0.5;
    this.group.add(g);
  }

  private buildBowl() {
    const gx = -150;
    const gz = -40;
    // avalanche warning signs at both ends of the bowl road
    for (const [x, z, rot] of [
      [-120, 10, 0.5],
      [-330, -165, -1.2],
    ] as const) {
      const g = new THREE.Group();
      g.add(cyl(0.06, 0.06, 2.6, 5, PAL.metal, 0, 1.3, 0));
      const s = sign('AVALANCHE AREA', 1.8, 0.9, { bg: '#f2c230', fg: '#262a30' });
      s.position.y = 2.3;
      g.add(s);
      g.position.set(x, this.ground(x, z), z);
      g.rotation.y = rot;
      this.group.add(g);
    }
    // the barrier hut beside the pass road
    const hut = this.bm ? this.building('rs_barrier_hut', { trim: mat(0xf3efe6), roof: mat(PAL.red) }) : new THREE.Group();
    if (!this.bm) {
      hut.add(box(2, 2.2, 2, 0xf3efe6, 0, 1.1, 0));
      const r = snowRoof(2.6, 2.6, 0.7, PAL.red, 0.2);
      r.position.y = 2.2;
      hut.add(r);
    }
    hut.position.set(gx - 8, this.ground(gx - 8, gz), gz + 2);
    this.group.add(hut);
    // the berm's marker posts
    for (let x = BOWL.berm.x0 + 10; x < BOWL.berm.x1; x += 30) {
      const u = (x - BOWL.berm.x0) / (BOWL.berm.x1 - BOWL.berm.x0);
      const z = BOWL.berm.z - Math.sin(u * Math.PI) * 14;
      const p = new THREE.Group();
      p.add(cyl(0.08, 0.08, 2.4, 5, 0x262a30, 0, 1.2, 0), box(0.2, 0.4, 0.2, PAL.yellow, 0, 2.3, 0));
      p.position.set(x, this.ground(x, z), z);
      this.group.add(p);
    }
    // the ridge cairn and a wind-blown cornice along the ridge
    const ridge = pad('ridge');
    const cairn = new THREE.Group();
    for (let i = 0; i < 5; i++) cairn.add(ball(0.6 - i * 0.1, PAL.stone, Math.sin(i) * 0.1, 0.4 + i * 0.5, 0, 6));
    cairn.position.set(ridge.x - 10, this.ground(ridge.x - 10, ridge.z - 8), ridge.z - 8);
    this.group.add(cairn);
    const cornice = new THREE.Group();
    // the cornice: wind-built lips of snow along the top of the start zone
    for (let x = BOWL.slab.x0 + 4; x < BOWL.slab.x1 - 4; x += 7) {
      const z = BOWL.slab.z0 - 14 + Math.sin(x * 0.07) * 3;
      const c = ball(2, PAL.snow, 0, 0, 0, 8);
      c.scale.set(1.7, 0.45, 0.9);
      c.position.set(x, this.ground(x, z) + 0.3, z);
      cornice.add(c);
    }
    this.group.add(bake(cornice));
  }

  /** Orange-tipped snow poles along every road and track, so you can follow them in a whiteout. */
  private buildPoles() {
    const geo = new THREE.CylinderGeometry(0.05, 0.05, 2, 4);
    geo.translate(0, 1, 0);
    const tipGeo = new THREE.BoxGeometry(0.11, 0.35, 0.11);
    tipGeo.translate(0, 2.0, 0);
    const list: THREE.Vector3[] = [];
    for (const g of this.terrain.routes) {
      if (g.route.kind === 'piste') continue;
      for (const p of routeSamples(this.terrain, g.route.id, 22)) {
        for (const s of [-1, 1]) {
          const off = g.route.width + 1.6;
          const x = p.x - p.tz * s * off;
          const z = p.z + p.tx * s * off;
          if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r) continue;
          list.push(new THREE.Vector3(x, this.ground(x, z), z));
        }
      }
    }
    const poles = new THREE.InstancedMesh(geo, mat(0x262a30), list.length);
    const tips = new THREE.InstancedMesh(tipGeo, mat(0xff7a1a), list.length);
    const m = new THREE.Matrix4();
    list.forEach((p, i) => {
      m.makeTranslation(p.x, p.y - 0.1, p.z);
      poles.setMatrixAt(i, m);
      tips.setMatrixAt(i, m);
    });
    poles.computeBoundingSphere();
    tips.computeBoundingSphere();
    this.group.add(poles, tips);
  }

  /** The station's anemometer turns once it has been repaired. */
  setStationWorking(on: boolean) {
    this.stationWorking = on;
    if (this.stationIce) this.stationIce.visible = !on;
    if (this.stationLight) (this.stationLight.material as THREE.MeshBasicMaterial).color.setHex(on ? 0x34e05a : 0xff3020);
  }

  update(dt: number, night: number, wind: number) {
    this.t += dt;
    this.windows.emissiveIntensity = 0.25 + night * 1.6;
    this.streetLights.color.setHex(night > 0.3 ? 0xffd9a0 : 0xc9c2b4);
    if (this.anemo && this.stationWorking) this.anemo.rotation.y += dt * (3 + wind * 10);
    if (this.liftLine) {
      const L = this.liftLine;
      for (const c of this.chairs) {
        c.s = (c.s + dt * 0.006) % 1;
        // up one side, down the other
        const up = c.s < 0.5;
        const f = up ? c.s * 2 : (1 - c.s) * 2;
        const p = L.a.clone().lerp(L.b, f);
        const side = new THREE.Vector3(L.dir.z, 0, -L.dir.x).multiplyScalar(up ? 1.5 : -1.5);
        p.add(side);
        // sag between towers
        p.y -= Math.sin(f * Math.PI * 10) ** 2 * 0.8;
        c.m.position.copy(p);
        c.m.rotation.y = Math.atan2(L.dir.x, L.dir.z) + (up ? 0 : Math.PI);
      }
      if (this.chairInst.length) {
        this.chairs.forEach((c, i) => {
          c.m.updateMatrix();
          for (const inst of this.chairInst) inst.setMatrixAt(i, c.m.matrix);
        });
        for (const inst of this.chairInst) inst.instanceMatrix.needsUpdate = true;
      }
    }
  }
}
