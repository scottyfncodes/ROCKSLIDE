// Character Evolution: the eight review states (Phase 8) on a production build, identical cameras, clock
// and weather, so before and after can be compared frame for frame.
//   node docs/character-evolution/capture.mjs <url> <outdir> [only,names] [--phones]
// Phone: portrait 390 x 844 at 2x (iPhone 13/14), touch. With --phones also 375 x 667 (iPhone SE) and
// 430 x 932 (Pro Max) for the HUD and camera. SwiftShader (CPU WebGL): colour, composition, draw calls and
// triangles are exact; frame times are not.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const argv = process.argv.slice(2);
const flags = argv.filter((a) => a.startsWith('--'));
const [url = 'http://localhost:4173/', out = 'shots', only] = argv.filter((a) => !a.startsWith('--'));
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const record = [];
const problems = [];
const want = (n) => !only || only.split(',').some((o) => n.startsWith(o));

async function boot(viewport, opts = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: opts.dpr ?? 1, isMobile: !!opts.mobile, hasTouch: !!opts.mobile });
  const page = await ctx.newPage();
  page.setDefaultTimeout(300000);
  page.on('pageerror', (e) => problems.push(`[pageerror] ${e.message}`));
  await page.goto(url);
  await page.waitForFunction(() => window.patrol, null, { timeout: 240000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => window.patrol, null, { timeout: 240000 });
  await page.waitForTimeout(2500);
  await page.click('[data-a=new]');
  await page.waitForTimeout(1800);
  return { ctx, page };
}
const stage = (page, s) =>
  page.evaluate((s) => {
    const P = window.patrol, g = P.game;
    P.closePanel();
    P.setDay(8);
    P.setTime(s.minute ?? 10 * 60 + 30);
    if (g.mode === 'sled') g.dismount();
    if (s.skis && g.mode !== 'skis') g.toggleSkis(true);
    if (!s.skis && g.mode === 'skis') g.toggleSkis(true);
    P.teleport(s.x, s.z, s.yaw ?? 0);
    P.camYaw(s.cam ?? s.yaw ?? 0);
    if (s.pitch !== undefined) P.camPitch(s.pitch);
    if (s.dog) P.dogTo(s.dog[0], s.dog[1]);
    if (s.hold) { g.holdId = s.hold; g.holdT = 30; } else { g.holdT = 0; g.holdId = null; }
  }, s);
async function shot(page, name, note) {
  await page.screenshot({ path: `${out}/${name}.png` });
  const info = await page.evaluate(() => window.patrol.info());
  const vp = page.viewportSize();
  record.push({ name, note, viewport: `${vp.width}x${vp.height}`, calls: info.calls, tris: info.tris });
  console.log('shot', name, info.calls, info.tris);
}
async function at(page, name, s, note) {
  if (!want(name)) return;
  await stage(page, s);
  await page.waitForTimeout(1500);
  await stage(page, s);
  if (s.walk) {
    // walk (or ski) forward for a moment with the camera settling behind
    if (s.run) await page.keyboard.down('ShiftLeft');
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(s.walk);
    await shot(page, name, note);
    await page.keyboard.up('KeyW');
    if (s.run) await page.keyboard.up('ShiftLeft');
    return;
  }
  await page.waitForTimeout(1600);
  await shot(page, name, note);
}

const STATES = [
  ['1-base', { x: -12, z: 252, yaw: 1.2, dog: [-11.4, 250.6] }, 'Standing at the patrol base (default camera)'],
  ['2-walk-koda', { x: -12, z: 256, yaw: 2.4, dog: [-11, 255], walk: 1800 }, 'Walking with Koda'],
  ['3-behind', { x: 4, z: 262, yaw: 0.4, pitch: 0.22, dog: [5, 261] }, 'From behind, close'],
  ['4-ski', { x: 562, z: -246, yaw: -2.68, skis: true, walk: 2600 }, 'Skiing the Tannberg Run'],
  ['5-work', { x: 27.6, z: 222, yaw: -Math.PI / 2, cam: -Math.PI / 2 - 0.9, hold: 'fix' }, 'Working at the garage bench'],
  ['6-pet', { x: -12, z: 252, yaw: 1.2, cam: 1.2 + 0.9, dog: [-12.9, 251.6], hold: 'pet-pose' }, 'Petting Koda'],
  ['7-heli', { x: -15, z: 285, yaw: 2.21, cam: 2.21 }, 'Near the helicopter'],
  ['8-sled', { x: 21, z: 229, yaw: 0.6, cam: 0.6 }, 'Near the snowmobile'],
  ['9-face', { x: -12, z: 252, yaw: 0, cam: Math.PI - 0.4, pitch: 0.05, dog: [-10.6, 251] }, 'Face, front three-quarter (look drag)'],
];
const phones = [['p', { width: 390, height: 844 }]];
if (flags.includes('--phones')) phones.push(['se', { width: 375, height: 667 }], ['max', { width: 430, height: 932 }]);
for (const [tag, vp] of phones) {
  const { ctx, page } = await boot(vp, { dpr: 2, mobile: true });
  for (const [name, s, note] of STATES) await at(page, `${tag}-${name}`, s, `${note} (${vp.width}x${vp.height})`);
  await ctx.close();
}
if (!flags.includes('--no-desktop')) {
  const { ctx, page } = await boot({ width: 1440, height: 900 });
  for (const [name, s, note] of STATES.filter(([n]) => ['1-base', '4-ski', '9-face', '6-pet'].includes(n))) await at(page, `d-${name}`, s, `${note} (desktop)`);
  await ctx.close();
}
writeFileSync(`${out}/shots.json`, JSON.stringify({ url, taken: new Date().toISOString(), shots: record, problems }, null, 1));
console.log(JSON.stringify({ shots: record.length, problems }));
await browser.close();
