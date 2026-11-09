import * as THREE from 'three';

/**
 * Contact shadows: a soft, cool pool of shade on the snow right under Vince, Koda, the sled and the
 * helicopter, lying along the slope. The sun's shadow falls off to one side (and at noon is small);
 * this is the shade where a body meets the ground, which is what makes a figure stand on bright snow
 * instead of floating over it. One small transparent quad each, one shared 64 px texture, no extra
 * pass (Character Evolution, environment polish).
 */
export class ContactShadows {
  readonly group = new THREE.Group();
  private readonly tex: THREE.Texture;
  private readonly pool = new Map<string, THREE.Mesh>();
  private readonly up = new THREE.Vector3(0, 1, 0);
  private readonly n = new THREE.Vector3();
  private readonly q = new THREE.Quaternion();
  private readonly q2 = new THREE.Quaternion();

  constructor() {
    this.group.name = 'contact-shadows';
    this.tex = ContactShadows.texture();
  }

  /** A radial falloff, dense in the middle and gone at the rim (cool lavender, the snow's own shade). */
  static texture(): THREE.Texture {
    const size = 64;
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const dx = (x + 0.5) / size - 0.5;
        const dy = (y + 0.5) / size - 0.5;
        const r = Math.min(1, Math.hypot(dx, dy) * 2);
        const a = Math.pow(1 - r, 1.6) * (1 - r * r);
        const i = (y * size + x) * 4;
        data[i] = 70;
        data[i + 1] = 66;
        data[i + 2] = 96;
        data[i + 3] = Math.round(a * 255);
      }
    const t = new THREE.DataTexture(data, size, size);
    t.colorSpace = THREE.SRGBColorSpace;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearFilter;
    t.needsUpdate = true;
    return t;
  }

  /**
   * Place (or hide, strength 0) the shadow `key`: centred on (x, z) at ground height y, `w` by `d` m,
   * turned to `yaw` and laid on the ground's normal (nx, ny, nz).
   */
  set(key: string, x: number, y: number, z: number, w: number, d: number, yaw: number, strength: number, nx = 0, ny = 1, nz = 0) {
    let m = this.pool.get(key);
    if (!m) {
      const mat = new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mat);
      m.name = `contact-${key}`;
      m.renderOrder = 1;
      m.frustumCulled = true;
      this.pool.set(key, m);
      this.group.add(m);
    }
    m.visible = strength > 0.01;
    if (!m.visible) return;
    (m.material as THREE.MeshBasicMaterial).opacity = Math.min(1, strength);
    m.position.set(x, y + 0.03, z);
    this.n.set(nx, ny, nz).normalize();
    this.q.setFromUnitVectors(this.up, this.n);
    this.q2.setFromAxisAngle(this.up, yaw);
    m.quaternion.copy(this.q).multiply(this.q2);
    m.scale.set(w, 1, d);
  }
}
