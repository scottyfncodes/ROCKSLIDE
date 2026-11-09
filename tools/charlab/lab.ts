/**
 * Character lab (dev only, not shipped): Vince and Koda as the game dresses them (its materials, grade
 * and figure light), in a row of views, posed and animated by the game's own code. Used to review the
 * character from the front, side, back and in each pose. Open /tools/charlab/ on the dev server.
 *
 * Query: ?hat=hat-helmet&pose=idle|walk|run|ski|pet|work|ride|carry&t=1.2&views=4&dog=1&zoom=1
 * window.lab.ready is true once the models are in.
 */
import * as THREE from 'three';
import { PatrollerMesh, type Pose } from '../../src/render/characterMesh';
import { HuskyMesh } from '../../src/render/huskyMesh';
import { loadPatrolModels } from '../../src/render/patrolModels';

const q = new URLSearchParams(location.search);
const canvas = document.getElementById('c') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Number(q.get('dpr') ?? 1));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xc9d8e6);
scene.add(new THREE.HemisphereLight(0xd8e6f5, 0xb8a8a8, 1.5));
const sun = new THREE.DirectionalLight(0xfff1dc, 2.4);
sun.position.set(-3, 6, -4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8 });
scene.add(sun);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshLambertMaterial({ color: 0xf1f2f6 }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const views = Number(q.get('views') ?? 4);
const pose = (q.get('pose') ?? 'idle') as Pose;
const hat = q.get('hat') ?? 'hat-beanie';
const gap = 1.25;
const people: PatrollerMesh[] = [];
const dogs: HuskyMesh[] = [];
for (let i = 0; i < views; i++) {
  const p = new PatrollerMesh(false, { hair: 0xe6c27a, long: true });
  p.group.position.x = (i - (views - 1) / 2) * gap;
  // ?rots=0.6,0,-1.57,3.14 (radians; 0 faces the camera): front three-quarter, front, side, back
  const rots = (q.get('rots') ?? '0.6,0,1.5708,3.1416').split(',').map(Number);
  p.group.rotation.y = rots[i % rots.length];
  scene.add(p.group);
  people.push(p);
}
const withDog = q.get('dog') === '1';
const cam = new THREE.PerspectiveCamera(22, 1, 0.1, 200);
const zoom = Number(q.get('zoom') ?? 1);
function frame() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  cam.aspect = w / h;
  const spanW = views * gap + 0.4;
  const dist = Math.max(spanW / 2 / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2) * cam.aspect), 2.6 / 2 / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))) * 1.05 / zoom;
  const y = Number(q.get('y') ?? 1.05);
  cam.position.set(0, y + 0.35, -dist);
  cam.lookAt(0, y, 0);
  cam.updateProjectionMatrix();
}
addEventListener('resize', frame);
frame();

const lab = { ready: false, step: (s: number) => s };
(window as unknown as { lab: typeof lab }).lab = lab;

loadPatrolModels('/models/').then((models) => {
  for (const p of people) {
    p.useModel(models.rs_patroller);
    p.setLook(0xd8382a, 0x2b2f38, hat, hat === 'hat-helmet' ? 0xf3efe6 : 0x2b2f38, hat === 'hat-helmet' ? 0xd8382a : 0xe0b042, 0xf2a33a, 0xc79a62);
    if (pose === 'ski') p.setSkis(true);
  }
  if (withDog) {
    const d = new HuskyMesh();
    d.useModel(models.rs_koda);
    d.group.position.set(0.9, 0, 0.4);
    d.group.rotation.y = Math.PI + 0.9;
    scene.add(d.group);
    dogs.push(d);
  }
  const t = Number(q.get('t') ?? 1.5);
  const speed = pose === 'walk' || pose === 'carry' ? 1.4 : pose === 'run' ? 5.5 : pose === 'ski' ? 6 : 0;
  const dt = 1 / 60;
  let stride = 0;
  for (let k = 0; k < t / dt; k++) {
    stride += speed * dt;
    for (const p of people) p.animate(pose, stride, speed, 0, dt);
  }
  renderer.render(scene, cam);
  lab.ready = true;
  const loop = () => {
    renderer.render(scene, cam);
    requestAnimationFrame(loop);
  };
  loop();
});
