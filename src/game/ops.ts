import * as THREE from 'three';
import { addBond, BOND, hasSkill, searchStats } from '../actors/bond';
import type { Husky } from '../actors/husky';
import { GUNS, loaded, muzzle, naturalRisk, newControlDay, recordNatural, recordShot, safeToFire, shotOutcome, zone, ZONES, type ControlDay, type Method, type Outcome, type Zone } from '../missions/control';
import { bury, probe, readBeacon, recordSaved, scoreRescue, shovel, survival, tickBurial, type Burial, type RescueScore, type Victim } from '../missions/rescue';
import { mulberry32 } from '../sim/noise';
import { Slide } from '../sim/slide';
import type { Terrain } from '../world/terrain';

/**
 * Patrol operations on the Tannberg side (phase 2 of the expansion): the morning control route with
 * the howitzer, the Avalauncher, hand charges and ski cuts; slides that can catch you (warning, a beat
 * to cut out of the path, slow motion on a near miss, a struggle to stay on top); burials, the
 * transceiver search, the probe and the shovel; and Koda working a debris field.
 *
 * The game owns the scene and the input and asks this class what to show and what to offer; this class
 * owns the state and the meshes it adds (the slide blobs, the shell, the aim line, probe poles).
 */

export interface OpsHost {
  terrain: Terrain;
  scene: THREE.Scene;
  /** where you are and how you are moving */
  pos(): { x: number; z: number };
  mode(): 'foot' | 'sled' | 'heli' | 'skis';
  speed(): number;
  dog: Husky;
  bond(): number;
  setBond(b: number): void;
  toast(text: string, kind?: 'good' | 'warn' | '', secs?: number): void;
  radio(who: string, text: string, secs?: number): void;
  pop(title: string, sub: string, kind: 'trick' | 'clean' | 'bad' | 'hot', secs?: number): void;
  kick(amount: number): void;
  slowMo(secs: number): void;
  buzz(pattern: readonly number[]): void;
  sfx: {
    boom(dist: number): void;
    crack(): void;
    thud(w: number, d: number): void;
    bark(): void;
    whine(): void;
    chime(): void;
    click(): void;
    warning(): void;
    reward(): void;
    work(kind: 'dig'): void;
  };
  fx: {
    blast(x: number, y: number, z: number): void;
    cloud(x: number, y: number, z: number, vx: number, vz: number, k: number): void;
    puff(x: number, y: number, z: number, vx: number, vy: number, vz: number): void;
  };
  /** move you (caught in a slide: carried with it) */
  carry(x: number, z: number): void;
  /** buried: you are out of control until dug out */
  setBuried(on: boolean): void;
  addFunds(n: number, rep: number): void;
  day(): number;
  danger(): number;
  minute(): number;
  save(): void;
}

export type AimGun = 'howitzer' | 'avalauncher';

interface LiveSlide {
  slide: Slide;
  zoneId: string;
  natural: boolean;
  /** seconds of warning left before it releases (natural slides) */
  warn: number;
  /** guests it buries when it stops */
  buries: number;
  /** you were in it */
  caughtYou: boolean;
  nearMissed: boolean;
}

const BLOB = new THREE.IcosahedronGeometry(1, 1);

export class Ops {
  day: ControlDay;
  /** the route is under way (the board said go) */
  routeOn = false;
  /** at a gun, aiming */
  aim: { gun: AimGun; yaw: number; elev: number; charge: number; zoneId: string | null } | null = null;
  /** a round in the air */
  shell: { pts: THREE.Vector3[]; t: number; gun: AimGun; charge: number; zoneId: string | null; safe: boolean } | null = null;
  /** a hand charge on its fuse */
  handCharge: { zoneId: string; x: number; z: number; fuse: number; safe: boolean } | null = null;
  slides: LiveSlide[] = [];
  burial: Burial | null = null;
  /** where the burial's debris lies */
  debris: { x: number; z: number; r: number } | null = null;
  /** caught in a slide: the struggle to stay on top */
  struggle: { t: number; air: number; slide: LiveSlide } | null = null;
  buried = false;
  /** Koda on a debris search */
  search: { target: Victim | null; wander: { x: number; z: number } | null; work: number; barkT: number } | null = null;
  /** the last result, for the debrief */
  lastScore: RescueScore | null = null;
  /** the shot that is being watched (the camera goes there) */
  watch: { x: number; z: number; t: number } | null = null;
  private lastStroke = -1;
  private time = 0;
  private naturalT = 0;
  private skiCutArmed = new Set<string>();
  private rumbleK = 0;
  private group = new THREE.Group();
  private blobs: THREE.InstancedMesh;
  private shellMesh: THREE.Mesh;
  private aimLine: THREE.Line;
  private aimRing: THREE.Mesh;
  private crackLines: THREE.Group = new THREE.Group();
  private poles: THREE.Group = new THREE.Group();
  /** the two guns, turning with the aim: a turret (yaw) carrying a barrel (elevation) */
  private guns: Record<AimGun, { turret: THREE.Group; barrel: THREE.Group }>;
  private readonly m4 = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly v = new THREE.Vector3();
  private readonly s = new THREE.Vector3();

  private cloudPerFrame: number;

  constructor(private h: OpsHost, low: boolean) {
    this.cloudPerFrame = low ? 2 : 4;
    this.day = newControlDay(h.day() * 101 + 7, h.danger());
    const snow = new THREE.MeshLambertMaterial({ color: 0xf7f4ef, emissive: 0x9aa6c4, emissiveIntensity: 0.25 });
    this.blobs = new THREE.InstancedMesh(BLOB, snow, low ? 160 : 260);
    this.blobs.count = 0;
    this.blobs.frustumCulled = false;
    this.blobs.castShadow = true;
    this.shellMesh = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), new THREE.MeshBasicMaterial({ color: 0x262a30 }));
    this.shellMesh.visible = false;
    this.aimLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: 0xd4422f, dashSize: 4, gapSize: 3 }));
    this.aimLine.frustumCulled = false;
    this.aimLine.visible = false;
    this.aimRing = new THREE.Mesh(new THREE.RingGeometry(5, 6.2, 32), new THREE.MeshBasicMaterial({ color: 0xd4422f, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }));
    this.aimRing.rotation.x = -Math.PI / 2;
    this.aimRing.visible = false;
    this.guns = { howitzer: this.buildGun('howitzer'), avalauncher: this.buildGun('avalauncher') };
    this.group.add(this.blobs, this.shellMesh, this.aimLine, this.aimRing, this.crackLines, this.poles);
    h.scene.add(this.group);
  }

  /**
   * The guns, built from the kit's simple solids in the patrol's colours: the howitzer on its
   * pedestal by the bunker (olive drab, a long barrel, a shield), the Avalauncher on the top station's
   * deck (a yellow pressure tube on a tripod with its gas bottle).
   */
  private buildGun(kind: AimGun) {
    const g = GUNS[kind];
    const y = this.h.terrain.height(g.x, g.z);
    const olive = new THREE.MeshLambertMaterial({ color: kind === 'howitzer' ? 0x4d5a3c : 0xe0b042 });
    const dark = new THREE.MeshLambertMaterial({ color: 0x262a30 });
    const base = new THREE.Group();
    base.position.set(g.x, y, g.z);
    const turret = new THREE.Group();
    const barrel = new THREE.Group();
    if (kind === 'howitzer') {
      base.add(new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 0.6, 12), dark).translateY(0.3));
      turret.add(new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 1.4), olive).translateY(0.9));
      turret.add(new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.2, 0.12), olive).translateY(1.5).translateZ(0.7));
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.17, 3.6, 10), dark);
      tube.rotation.x = Math.PI / 2;
      tube.position.z = 1.8;
      barrel.add(tube);
      barrel.position.y = 1.35;
    } else {
      for (const a of [0, 2.1, 4.2]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 5), dark);
        leg.position.set(Math.cos(a) * 0.5, 0.7, Math.sin(a) * 0.5);
        leg.rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4);
        base.add(leg);
      }
      base.add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.9, 10), new THREE.MeshLambertMaterial({ color: 0x2f6f8f })).translateX(0.6).translateY(0.45));
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3, 10), olive);
      tube.rotation.x = Math.PI / 2;
      tube.position.z = 1.2;
      barrel.add(tube);
      barrel.position.y = 1.5;
    }
    turret.add(barrel);
    base.add(turret);
    // laid toward its first zone until someone mans it
    const z0 = ZONES.find((z) => z.methods.includes(kind))!;
    turret.rotation.y = Math.atan2(z0.x - g.x, z0.z - g.z);
    barrel.rotation.x = -0.4;
    this.group.add(base);
    return { turret, barrel };
  }

  /** A new morning: a new snowpack (or a seeded one, for the Daily Storm). */
  newDay(seed?: number) {
    this.day = newControlDay(seed ?? this.h.day() * 101 + 7, this.h.danger());
    this.routeOn = false;
    this.skiCutArmed.clear();
  }

  // ------------------------------------------------------------------ queries for the game

  /** How hard the slides rumble (0..1), for the audio bed. */
  get rumble() {
    return this.rumbleK;
  }

  /** Anything that wants the camera: a shot landing, a slide running near you. */
  get busy() {
    return !!(this.aim || this.shell || this.struggle || this.buried);
  }

  /** The zone at the end of a gun's current aim line, if the impact is in one. */
  private zoneAt(x: number, z: number): Zone | null {
    for (const zz of ZONES) if (Math.hypot(x - zz.x, z - zz.z) < zz.r * 1.35) return zz;
    return null;
  }

  /** People in a zone's slide path: you and Koda (guests come with the runs open). */
  inPath(z: Zone): number {
    const t = this.h.terrain;
    const n = t.normal(z.x, z.z);
    const l = Math.hypot(n.x, n.z) || 1;
    const dx = n.x / l;
    const dz = n.z / l;
    let count = 0;
    const p = this.h.pos();
    for (const q of [p, { x: this.h.dog.x, z: this.h.dog.z }]) {
      const ox = q.x - z.x;
      const oz = q.z - z.z;
      const along = ox * dx + oz * dz;
      const across = Math.abs(-ox * dz + oz * dx);
      if (along > -z.r && along < 260 && across < z.r + 12 + along * 0.15) count++;
    }
    return count;
  }

  /** The gun you are standing at, if any. */
  gunNear(): AimGun | null {
    const p = this.h.pos();
    if (this.h.mode() !== 'foot') return null;
    for (const g of ['howitzer', 'avalauncher'] as const) if (Math.hypot(p.x - GUNS[g].x, p.z - GUNS[g].z) < 4) return g;
    return null;
  }

  /** The ridge spot above a zone from which a hand charge can be thrown. */
  ridgeSpot(z: Zone): { x: number; z: number } {
    const n = this.h.terrain.normal(z.x, z.z);
    const l = Math.hypot(n.x, n.z) || 1;
    return { x: z.x - (n.x / l) * (z.r + 10), z: z.z - (n.z / l) * (z.r + 10) };
  }

  /** A hand charge you could throw from where you stand. */
  handZone(): Zone | null {
    if (this.handCharge || (this.h.mode() !== 'foot' && this.h.mode() !== 'skis')) return null;
    const p = this.h.pos();
    for (const z of ZONES) {
      const s = this.day.zones.find((q) => q.id === z.id)!;
      if (s.done || !z.methods.includes('hand')) continue;
      const r = this.ridgeSpot(z);
      if (Math.hypot(p.x - r.x, p.z - r.z) < 14) return z;
    }
    return null;
  }

  /** On a debris field with someone still under it. */
  onDebris(): boolean {
    if (!this.burial || !this.debris) return false;
    const p = this.h.pos();
    return Math.hypot(p.x - this.debris.x, p.z - this.debris.z) < this.debris.r + 25;
  }

  /** The victim you could dig at (probed, within reach). */
  digTarget(): Victim | null {
    if (!this.burial) return null;
    const p = this.h.pos();
    return this.burial.victims.find((v) => v.probed && !v.out && Math.hypot(p.x - v.x, p.z - v.z) < 1.8) ?? null;
  }

  // ------------------------------------------------------------------ actions

  startRoute() {
    this.routeOn = true;
    this.day.runsClosed = true;
    this.h.radio('Snow safety', `Control route is on. Runs stay closed until you open them. ${this.day.zones.filter(loaded).length} zones are loaded this morning.`, 5);
  }

  /** Man a gun: the aim starts at the nearest loaded zone it can reach. */
  manGun(gun: AimGun) {
    const g = GUNS[gun];
    const cand = ZONES.filter((z) => z.methods.includes(gun) && Math.hypot(z.x - g.x, z.z - g.z) < g.range && !this.day.zones.find((s) => s.id === z.id)!.done);
    const target = cand[0] ?? ZONES.find((z) => z.methods.includes(gun))!;
    const yaw = Math.atan2(target.x - g.x, target.z - g.z);
    this.aim = { gun, yaw, elev: gun === 'howitzer' ? 30 : 38, charge: 2, zoneId: null };
    this.h.sfx.click();
  }

  leaveGun() {
    this.aim = null;
    this.aimLine.visible = this.aimRing.visible = false;
  }

  /** Point the gun at a zone: the heading exactly, the elevation that drops the round on it (QA, and a hint). */
  aimAt(zoneId: string) {
    const a = this.aim;
    if (!a) return;
    const z = zone(zoneId);
    const g = GUNS[a.gun];
    a.yaw = Math.atan2(z.x - g.x, z.z - g.z);
    let best = a.elev;
    let bd = Infinity;
    for (let e = 8; e <= 65; e += 0.5) {
      const pts = this.trajectory(a.gun, a.yaw, e, a.charge);
      const end = pts[pts.length - 1];
      const d = Math.hypot(end.x - z.x, end.z - z.z);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    a.elev = best;
  }

  cycleCharge() {
    if (!this.aim) return;
    this.aim.charge = (this.aim.charge % 3) + 1;
    this.h.sfx.click();
  }

  /** The round's flight for the current aim: integrated through the real terrain (and where it lands). */
  trajectory(gun: AimGun, yaw: number, elevDeg: number, charge: number): THREE.Vector3[] {
    const g = GUNS[gun];
    const t = this.h.terrain;
    const v0 = muzzle(gun, charge);
    const e = (elevDeg * Math.PI) / 180;
    let x = g.x;
    let z = g.z;
    let y = t.height(g.x, g.z) + 1.6;
    let vx = Math.sin(yaw) * Math.cos(e) * v0;
    let vz = Math.cos(yaw) * Math.cos(e) * v0;
    let vy = Math.sin(e) * v0;
    const pts = [new THREE.Vector3(x, y, z)];
    const dt = 0.05;
    for (let i = 0; i < 900; i++) {
      vy -= 9.81 * dt;
      // a little drag on the heavy round
      vx *= 0.9995;
      vz *= 0.9995;
      x += vx * dt;
      y += vy * dt;
      z += vz * dt;
      const gy = t.height(x, z);
      if (y <= gy || !t.inBounds(x, z, 5)) {
        pts.push(new THREE.Vector3(x, gy, z));
        break;
      }
      if (i % 3 === 0) pts.push(new THREE.Vector3(x, y, z));
    }
    return pts;
  }

  fire() {
    const a = this.aim;
    if (!a || this.shell) return;
    const pts = this.trajectory(a.gun, a.yaw, a.elev, a.charge);
    const end = pts[pts.length - 1];
    const zz = this.zoneAt(end.x, end.z);
    const safe = zz ? safeToFire(this.day, this.inPath(zz)).ok : this.day.runsClosed;
    if (zz && !safe) this.h.toast(safeToFire(this.day, this.inPath(zz)).why, 'warn', 3);
    this.shell = { pts, t: 0, gun: a.gun, charge: a.charge, zoneId: zz?.id ?? null, safe };
    this.h.sfx.boom(a.gun === 'howitzer' ? 8 : 20);
    this.h.kick(a.gun === 'howitzer' ? 0.7 : 0.35);
    this.h.buzz([40]);
    const g = GUNS[a.gun];
    this.h.fx.blast(g.x + Math.sin(a.yaw) * 3, this.h.terrain.height(g.x, g.z) + 2, g.z + Math.cos(a.yaw) * 3);
    this.h.radio(a.gun === 'howitzer' ? 'Gun crew' : 'Avalauncher', 'Round away.', 2);
  }

  /** Throw a hand charge from the ridge into the zone below: a fuse to get clear. */
  throwCharge(z: Zone) {
    const n = this.h.terrain.normal(z.x, z.z);
    const l = Math.hypot(n.x, n.z) || 1;
    const x = z.x - (n.x / l) * z.r * 0.4;
    const zz = z.z - (n.z / l) * z.r * 0.4;
    this.handCharge = { zoneId: z.id, x, z: zz, fuse: 8, safe: safeToFire(this.day, 0).ok };
    this.h.sfx.click();
    this.h.radio('Vince', 'Charge thrown. Ninety seconds on the fuse... well, eight. Get back!', 3);
    this.h.toast('Fuse lit: get off the slope', 'warn', 3);
  }

  /** Send Koda across the debris field. */
  sendKoda() {
    if (!this.burial) return;
    this.h.dog.mode = 'work';
    this.search = { target: null, wander: null, work: 0, barkT: 0 };
    this.h.sfx.whine();
    this.h.radio('Vince', 'Koda, search! Find them!', 2.5);
  }

  /** A probe strike where you stand. */
  probeHere(): Victim | null {
    if (!this.burial) return null;
    const p = this.h.pos();
    const b = this.burial;
    b.probes++;
    const hit = probe(p.x, p.z, b.victims);
    this.addPole(p.x, p.z, !!hit);
    if (hit) {
      b.probeHits++;
      this.h.sfx.chime();
      this.h.toast(`Probe strike: ${hit.depth.toFixed(1)} m down`, 'good', 2.4);
      this.h.buzz([20, 40, 20]);
    } else {
      this.h.sfx.click();
      this.h.toast('Nothing: probe again, in a spiral', '', 1.4);
    }
    return hit;
  }

  /** A stroke of the shovel on the probed victim. */
  dig(now: number, shovelK = 1): Victim | null {
    const v = this.digTarget();
    if (!v || !this.burial) return null;
    const gap = this.lastStroke < 0 ? 1 : now - this.lastStroke;
    this.lastStroke = now;
    this.burial.strokes++;
    if (gap >= 0.15 && gap <= 0.45) this.burial.steadyStrokes++;
    shovel(v, gap, shovelK);
    this.h.sfx.work('dig');
    const y = this.h.terrain.height(v.x, v.z);
    this.h.fx.puff(v.x + (Math.random() - 0.5), y + 0.6, v.z + (Math.random() - 0.5), (Math.random() - 0.5) * 3, 2.5, (Math.random() - 0.5) * 3);
    if (v.out) {
      recordSaved(this.burial, v);
      const odds = Math.round(survival(this.burial.minutes) * 100);
      this.h.pop(`${v.name} is out`, `${odds}% odds · ${Math.round(this.burial.minutes)} min`, odds > 70 ? 'clean' : 'trick', 2.2);
      this.h.sfx.reward();
      this.h.buzz([16, 70, 16]);
      this.finishIfDone();
    }
    return v;
  }

  /** Start a burial right here (the rescue drill, and the QA stages). */
  drill(x: number, z: number, count = 2, seed = this.h.day() * 13 + 1) {
    this.burial = bury(x, z, 22, count, seed, 0.5);
    // the drill field is a real debris pile: set blocks of snow, settled
    const pile = new Slide(this.h.terrain, x, z, 20, 46, seed);
    const rng = mulberry32(seed + 3);
    for (const q of pile.parcels) {
      const a = rng() * Math.PI * 2;
      const r = Math.sqrt(rng()) * 21;
      q.x = x + Math.cos(a) * r;
      q.z = z + Math.sin(a) * r * 0.75;
      q.y = this.h.terrain.height(q.x, q.z) + q.size * 0.3;
      q.state = 2;
    }
    pile.done = true;
    this.slides.push({ slide: pile, zoneId: 'Z6', natural: false, warn: 0, buries: 0, caughtYou: false, nearMissed: false });
    this.debris = { x, z, r: 22 };
    this.clearPoles();
    this.h.radio('Snow safety', `Rescue drill: ${count} packs buried, at least one with no transceiver. Clock is running.`, 4.5);
  }

  // ------------------------------------------------------------------ the frame

  /**
   * One frame. `input`: the stick (for the aim), whether the action button went down this frame
   * (mashing in a struggle), the real time.
   */
  update(dt: number, realDt: number, input: { x: number; y: number; mash: boolean }) {
    this.time += realDt;
    const h = this.h;
    // aiming: the stick turns the gun and raises the barrel
    if (this.aim) {
      const a = this.aim;
      a.yaw -= input.x * realDt * 0.6;
      const gm = this.guns[a.gun];
      gm.turret.rotation.y = a.yaw;
      gm.barrel.rotation.x = (-a.elev * Math.PI) / 180;
      a.elev = Math.max(8, Math.min(65, a.elev + input.y * realDt * 12));
      const pts = this.trajectory(a.gun, a.yaw, a.elev, a.charge);
      const end = pts[pts.length - 1];
      const zz = this.zoneAt(end.x, end.z);
      a.zoneId = zz?.id ?? null;
      this.aimLine.geometry.setFromPoints(pts);
      this.aimLine.computeLineDistances();
      this.aimLine.visible = !this.shell;
      this.aimRing.position.set(end.x, end.y + 0.6, end.z);
      this.aimRing.scale.setScalar(a.gun === 'howitzer' ? 2.2 : 1.4);
      (this.aimRing.material as THREE.MeshBasicMaterial).color.set(zz ? 0x3f9a62 : 0xd4422f);
      this.aimRing.visible = !this.shell;
    }
    // a round in the air: fast-forwarded along its arc
    if (this.shell) {
      const s = this.shell;
      s.t += realDt * 3;
      const i = Math.min(s.pts.length - 1, Math.floor(s.t * (1 / 0.15)));
      this.shellMesh.position.copy(s.pts[i]);
      this.shellMesh.visible = true;
      this.watch = { x: s.pts[i].x, z: s.pts[i].z, t: 2 };
      if (i >= s.pts.length - 1) {
        const end = s.pts[i];
        this.shellMesh.visible = false;
        this.shell = null;
        this.impact(end.x, end.z, s.gun, s.charge, s.zoneId, s.safe);
      }
    }
    // a hand charge on its fuse
    if (this.handCharge) {
      const c = this.handCharge;
      c.fuse -= realDt;
      if (Math.floor(c.fuse + realDt) !== Math.floor(c.fuse) && c.fuse > 0) h.toast(`Fuse: ${Math.ceil(c.fuse)}`, 'warn', 0.9);
      if (c.fuse <= 0) {
        this.handCharge = null;
        const z = zone(c.zoneId);
        const safe = safeToFire(this.day, this.inPath(z)).ok;
        this.impact(c.x, c.z, 'hand', 2, c.zoneId, safe);
      }
    }
    // ski cuts: a fast traverse across a small zone
    if (h.mode() === 'skis' && h.speed() > 7) {
      const p = h.pos();
      for (const z of ZONES) {
        if (!z.methods.includes('skicut')) continue;
        const s = this.day.zones.find((q) => q.id === z.id)!;
        if (s.done) continue;
        const d = Math.hypot(p.x - z.x, p.z - z.z);
        if (d < z.r * 0.7 && !this.skiCutArmed.has(z.id)) {
          this.skiCutArmed.add(z.id);
          const out = shotOutcome(this.day, z.id, 'skicut', 2, s.shots);
          recordShot(this.day, z.id, 'skicut', out, this.day.runsClosed);
          if (out !== 'none') {
            // it lets go below your cut line
            const n = h.terrain.normal(z.x, z.z);
            this.release(z, z.x + n.x * z.r * 0.6, z.z + n.z * z.r * 0.6, out, false, 0);
            h.pop('Ski cut', 'It cracked below you: keep going!', 'hot', 1.6);
          } else h.pop('Ski cut', 'Nothing moved', 'trick', 1.2);
        } else if (d > z.r * 1.2) this.skiCutArmed.delete(z.id);
      }
    }
    // natural releases: loaded zones left alone, through the day (checked every few seconds)
    this.naturalT -= dt;
    if (this.naturalT <= 0) {
      this.naturalT = 4;
      const rng = mulberry32(Math.floor(h.minute()) * 977 + this.day.seed);
      for (const s of this.day.zones) {
        // risk per in-game hour; four real seconds are a few in-game minutes
        const p = naturalRisk(this.day, s) * (4 * 0.8) / 60;
        if (p > 0 && rng() < p) {
          this.natural(zone(s.id));
          break;
        }
      }
      // skiing or sledding below a loaded zone is how slides find people
      const pos = h.pos();
      if ((h.mode() === 'skis' || h.mode() === 'sled') && h.speed() > 4) {
        for (const z of ZONES) {
          const s = this.day.zones.find((q) => q.id === z.id)!;
          if (!loaded(s) || this.slides.some((l) => l.zoneId === z.id)) continue;
          const d = Math.hypot(pos.x - z.x, pos.z - z.z);
          if (d < 140 && this.inPath(z) > 0 && rng() < 0.12 * s.load) {
            this.natural(z);
            break;
          }
        }
      }
    }
    this.updateSlides(dt, realDt, input);
    if (this.burial) {
      tickBurial(this.burial, realDt);
      this.updateSearch(dt);
      this.scent(dt);
    }
    if (this.watch) {
      this.watch.t -= realDt;
      if (this.watch.t <= 0) this.watch = null;
    }
    this.drawBlobs();
  }

  /** A natural release: the warning (rumble, the crack, the shake, Koda's bark if he knows), then it goes. */
  natural(z: Zone) {
    const h = this.h;
    const p = h.pos();
    const near = Math.hypot(p.x - z.x, p.z - z.z) < 320;
    const s = this.day.zones.find((q) => q.id === z.id)!;
    const sl = this.release(z, z.x, z.z, 'full', true, near ? 2.2 : 0);
    recordNatural(this.day, z.id);
    // with the runs open, guests are on the slope below it
    sl.buries = this.day.opened ? 1 + (s.load > 0.75 ? 1 : 0) : 0;
    if (near) {
      if (hasSkill(h.bond(), 'warning')) {
        h.sfx.bark();
        h.toast('Koda is barking at the slope!', 'warn', 2);
      }
      h.sfx.warning();
      h.radio('Snow safety', `${z.name} is releasing on its own! Cut to the side, out of the path!`, 4);
      h.kick(0.3);
    } else h.radio('Snow safety', `Natural release on ${z.name}.${sl.buries ? ' People were on the slope below.' : ''}`, 4.5);
  }

  /** Let a zone go: a slide of a size for the result, with or without a warning beat first. */
  private release(z: Zone, x: number, zz: number, out: Outcome, natural: boolean, warn: number): LiveSlide {
    const size = out === 'full' ? (z.size === 'large' ? 70 : z.size === 'medium' ? 50 : 34) : 20;
    const slide = new Slide(this.h.terrain, x, zz, out === 'full' ? z.r : z.r * 0.6, size, this.day.seed + z.id.charCodeAt(1) * 7 + this.slides.length, out === 'full' ? 0.11 : 0.24, out === 'full' ? 1600 : 900);
    const ls: LiveSlide = { slide, zoneId: z.id, natural, warn, buries: 0, caughtYou: false, nearMissed: false };
    this.slides.push(ls);
    this.drawCrack(slide);
    this.h.sfx.crack();
    return ls;
  }

  /** A round or a charge lands. */
  private impact(x: number, z: number, method: Method, charge: number, zoneId: string | null, safe: boolean) {
    const h = this.h;
    const y = h.terrain.height(x, z);
    h.fx.blast(x, y, z);
    const p = h.pos();
    const d = Math.hypot(p.x - x, p.z - z);
    h.sfx.boom(d);
    h.kick(Math.min(0.8, 60 / Math.max(20, d)));
    this.watch = { x, z, t: 6 };
    if (!zoneId) {
      h.toast('Missed the start zone', 'warn', 2);
      return;
    }
    const zz = zone(zoneId);
    const s = this.day.zones.find((q) => q.id === zoneId)!;
    const out = shotOutcome(this.day, zoneId, method, charge, s.shots);
    const pts = recordShot(this.day, zoneId, method, out, safe);
    if (out !== 'none') this.release(zz, zz.x, zz.z, out, false, 0.4);
    h.pop(out === 'full' ? 'Full release' : out === 'sluff' ? 'Small sluff' : 'No result', `${zz.name} · ${pts > 0 ? '+' : ''}${pts}${safe ? '' : ' · unsafe'}`, out === 'full' ? 'clean' : out === 'sluff' ? 'trick' : 'bad', 2.4);
    h.radio('Snow safety', out === 'full' ? `${zz.name} ran full track. Good shot.` : out === 'sluff' ? `${zz.name}: a small sluff. Some load left.` : `${zz.name}: no result.${s.load >= 0.45 ? ' Still loaded: try a heavier charge.' : ' Looks stable.'}`, 4);
    h.addFunds(Math.max(0, Math.round(pts / 6)), 0);
    h.save();
  }

  private updateSlides(dt: number, realDt: number, input: { mash: boolean }) {
    const h = this.h;
    const p = h.pos();
    let moving = 0;
    let nearest = Infinity;
    for (const ls of this.slides) {
      if (ls.warn > 0) {
        ls.warn -= realDt;
        h.kick(0.12);
        this.rumbleK = Math.max(this.rumbleK, 0.4);
        continue;
      }
      const s = ls.slide;
      if (s.done) continue;
      s.step(dt);
      moving += s.moving;
      // a powder cloud boiling off the running snow, a few puffs a frame (fewer on a phone)
      for (let k = 0; k < this.cloudPerFrame; k++) {
        const q = s.parcels[Math.floor(Math.random() * s.parcels.length)];
        if (q.state !== 1) continue;
        const sp = Math.hypot(q.vx, q.vz);
        if (sp > 2) h.fx.cloud(q.x, q.y + 0.6, q.z, q.vx * 0.7, q.vz * 0.7, Math.min(1, sp / 12));
      }
      const dist = s.nearest(p.x, p.z);
      nearest = Math.min(nearest, dist);
      if (!this.struggle && !this.buried && h.mode() !== 'heli' && s.caught(p.x, p.z)) {
        ls.caughtYou = true;
        this.struggle = { t: 0, air: 0.55, slide: ls };
        h.pop('Caught!', 'Swim! Mash the button to stay on top', 'bad', 2.5);
        h.buzz([80, 40, 80]);
        h.kick(1);
      } else if (!ls.nearMissed && dist < 9 && !s.caught(p.x, p.z) && h.mode() !== 'heli') {
        // it went by within a few metres: slow motion for a beat
        ls.nearMissed = true;
        h.slowMo(0.9);
        h.pop('Near miss', 'Out of the path in time', 'hot', 1.6);
        h.buzz([30]);
      }
      if (s.done) this.settled(ls);
    }
    this.rumbleK += (Math.min(1, moving / 40) - this.rumbleK) * Math.min(1, dt * 2);
    if (moving > 0 && nearest < 200) h.kick(Math.min(0.35, (moving / 60) * (60 / Math.max(30, nearest))));
    // the struggle: carried with the flow, swimming to stay up
    if (this.struggle) {
      const st = this.struggle;
      st.t += realDt;
      st.air = Math.max(0, Math.min(1, st.air - realDt * 0.42 + (input.mash ? 0.11 : 0)));
      const f = st.slide.slide.front();
      h.carry(p.x + (f.x - p.x) * Math.min(1, dt * 1.5), p.z + (f.z - p.z) * Math.min(1, dt * 1.5));
      if (st.t > 3.2 || st.slide.slide.done) {
        this.struggle = null;
        if (st.air > 0.45) {
          h.pop('On top!', 'You swam out of it', 'clean', 2);
          h.radio('Vince', 'I am out, I am fine. Somebody else was on that slope...', 3.5);
          // a guest went with it
          st.slide.buries = Math.max(st.slide.buries, 1);
        } else this.buryYou();
      }
    }
  }

  /** Buried: Koda comes for you. */
  private buryYou() {
    this.buried = true;
    this.h.setBuried(true);
    this.h.pop('Buried', 'Koda is on his way...', 'bad', 3);
    this.h.dog.mode = 'work';
    this.search = { target: null, wander: null, work: 0, barkT: 0 };
  }

  /** A slide has stopped: if people went with it, the debris field becomes a rescue. */
  private settled(ls: LiveSlide) {
    const r = ls.slide.result();
    if (ls.buries > 0 && !this.burial) {
      this.burial = bury(r.cx, r.cz, Math.max(10, r.r), ls.buries, this.day.seed + ls.zoneId.charCodeAt(1));
      this.debris = { x: r.cx, z: r.cz, r: Math.max(12, r.r) };
      this.clearPoles();
      this.h.radio('Dispatch', `${ls.buries === 1 ? 'One person is' : `${ls.buries} people are`} missing in the debris of ${zone(ls.zoneId).name}. Transceiver search, and send Koda!`, 5);
      this.h.sfx.warning();
    }
  }

  private finishIfDone() {
    const b = this.burial;
    if (!b || b.victims.some((v) => !v.out)) return;
    const sc = scoreRescue(b);
    this.lastScore = sc;
    const k = this.h.bond();
    this.h.setBond(addBond(k, BOND.rescue).bond);
    this.h.addFunds(Math.round(sc.total / 8), Math.round(sc.total / 20));
    this.h.radio('Dispatch', `Everyone is out. ${'★'.repeat(sc.stars)}${'☆'.repeat(3 - sc.stars)} rescue.`, 4);
    this.burial = null;
    this.debris = null;
    this.search = null;
    if (this.h.dog.mode === 'work') this.h.dog.mode = 'follow';
    this.onRescued?.(sc);
  }

  /** Told when a rescue is finished (the game puts up its score). */
  onRescued: ((s: RescueScore) => void) | null = null;

  /** Koda on the debris: sweep, catch the scent, run to it, paw and bark, dig. */
  private updateSearch(dt: number) {
    const s = this.search;
    const d = this.h.dog;
    if (!s || d.mode !== 'work') return;
    const st = searchStats(this.h.bond());
    const t = this.h.terrain;
    // buried yourself: he comes straight for you and digs
    if (this.buried) {
      const p = this.h.pos();
      const dd = Math.hypot(p.x - d.x, p.z - d.z);
      if (dd > 1.2) this.dogMove(p.x, p.z, 9, dt);
      else {
        d.anim = 'dig';
        s.work += dt;
        if (Math.random() < dt * 6) this.h.fx.puff(d.x, d.y + 0.3, d.z, (Math.random() - 0.5) * 2, 2, (Math.random() - 0.5) * 2);
        if (s.work > 3.2) {
          this.buried = false;
          this.h.setBuried(false);
          this.search = null;
          d.mode = 'follow';
          d.happy = 2;
          this.h.pop('Koda dug you out', 'Good dog.', 'clean', 2.4);
          this.h.setBond(addBond(this.h.bond(), BOND.rescue).bond);
        }
      }
      return;
    }
    const b = this.burial!;
    if (!s.target) {
      // catch a scent within range
      for (const v of b.victims) {
        if (v.out || v.marked) continue;
        if (Math.hypot(v.x - d.x, v.z - d.z) < st.radius) {
          s.target = v;
          s.work = 0;
          this.h.sfx.whine();
          break;
        }
      }
    }
    if (s.target) {
      const v = s.target;
      const dd = Math.hypot(v.x - d.x, v.z - d.z);
      if (dd > 0.9) this.dogMove(v.x, v.z, st.speed + 1.5, dt);
      else {
        s.work += dt;
        d.anim = s.work < st.work ? 'paw' : 'dig';
        s.barkT -= dt;
        if (s.barkT <= 0) {
          s.barkT = 1.3;
          this.h.sfx.bark();
        }
        if (s.work > 0.6 && !v.marked) {
          v.marked = true;
          this.h.pop('Koda has a scent!', `${v.name}: probe where he is digging`, 'hot', 2.4);
          this.h.buzz([20, 30, 20]);
        }
        if (s.work > st.work + 2.5 || v.out) {
          s.target = null;
          s.wander = null;
        }
      }
    } else {
      // sweep the debris: bounding across it
      const deb = this.debris!;
      if (!s.wander || Math.hypot(s.wander.x - d.x, s.wander.z - d.z) < 1.5) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * deb.r;
        s.wander = { x: deb.x + Math.cos(a) * r, z: deb.z + Math.sin(a) * r };
      }
      this.dogMove(s.wander.x, s.wander.z, st.speed, dt);
      if (Math.random() < dt * 0.6) d.anim = 'sniff';
    }
    d.y = t.height(d.x, d.z);
  }

  private dogMove(x: number, z: number, speed: number, dt: number) {
    const d = this.h.dog;
    const dx = x - d.x;
    const dz = z - d.z;
    const l = Math.hypot(dx, dz);
    if (l < 1e-3) return;
    const step = Math.min(l, speed * dt);
    d.x += (dx / l) * step;
    d.z += (dz / l) * step;
    d.stride += step;
    d.speed = speed;
    d.yaw = Math.atan2(-dx, -dz);
    d.anim = speed > 5 ? 'run' : 'trot';
  }

  /** Scent wisps: rising off the burials Koda is near, drifting his way. */
  private scent(dt: number) {
    const b = this.burial!;
    const d = this.h.dog;
    if (!this.search) return;
    for (const v of b.victims) {
      if (v.out) continue;
      const dd = Math.hypot(v.x - d.x, v.z - d.z);
      if (dd > 26 || Math.random() > dt * 5) continue;
      const y = this.h.terrain.height(v.x, v.z);
      const k = 1.4 / Math.max(2, dd);
      this.h.fx.puff(v.x + (Math.random() - 0.5) * 1.5, y + 0.2, v.z + (Math.random() - 0.5) * 1.5, (d.x - v.x) * k, 0.6, (d.z - v.z) * k);
    }
  }

  // ------------------------------------------------------------------ drawing

  private drawBlobs() {
    let n = 0;
    const max = this.blobs.instanceMatrix.count;
    for (const ls of this.slides) {
      if (ls.warn > 0) continue;
      for (const p of ls.slide.parcels) {
        if (p.state === 0 || n >= max) continue;
        this.v.set(p.x, p.y, p.z);
        this.s.set(p.size * (p.state === 2 ? 1.05 : 1.3), p.size * (p.state === 2 ? 0.75 : 0.9), p.size * (p.state === 2 ? 1.05 : 1.3));
        this.q.setFromAxisAngle(this.v.clone().set(0, 1, 0), (p.x + p.z) * 0.7);
        this.m4.compose(this.v, this.q, this.s);
        this.blobs.setMatrixAt(n++, this.m4);
      }
    }
    this.blobs.count = n;
    this.blobs.instanceMatrix.needsUpdate = true;
    // old debris goes once there are too many slides about
    if (this.slides.length > 4) this.slides.splice(0, this.slides.length - 4);
  }

  private drawCrack(s: Slide) {
    const pts = s.crack.map((c) => new THREE.Vector3(c.x, this.h.terrain.height(c.x, c.z) + 0.25, c.z));
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x3a2632 }));
    this.crackLines.add(line);
    while (this.crackLines.children.length > 3) this.crackLines.remove(this.crackLines.children[0]);
  }

  private addPole(x: number, z: number, hit: boolean) {
    const y = this.h.terrain.height(x, z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 4), new THREE.MeshBasicMaterial({ color: hit ? 0xd4422f : 0x8a8d8f }));
    pole.position.set(x, y + 0.8, z);
    this.poles.add(pole);
    while (this.poles.children.length > 30) this.poles.remove(this.poles.children[0]);
  }

  private clearPoles() {
    this.poles.clear();
  }

  /** For the HUD: the transceiver reading where you stand, and the clock. */
  beacon(): { stage: string; distance: number; bearing: number | null; odds: number; minutes: number; left: number } | null {
    if (!this.burial) return null;
    const p = this.h.pos();
    const r = readBeacon(p.x, p.z, this.burial.victims);
    return { stage: r.stage, distance: r.distance, bearing: r.bearing, odds: survival(this.burial.minutes), minutes: this.burial.minutes, left: this.burial.victims.filter((v) => !v.out).length };
  }

  /** Put the debris back and stop everything (a fresh patrol). */
  reset() {
    this.slides = [];
    this.burial = null;
    this.debris = null;
    this.aim = null;
    this.shell = null;
    this.handCharge = null;
    this.struggle = null;
    this.buried = false;
    this.search = null;
    this.clearPoles();
    this.crackLines.clear();
    this.aimLine.visible = this.aimRing.visible = this.shellMesh.visible = false;
  }
}
