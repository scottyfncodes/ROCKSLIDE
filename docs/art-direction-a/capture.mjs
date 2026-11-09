// Art Direction A ("Stylized Alpine 3D"), milestone 1: before/after captures of the three hero assets
// (the patroller, the lodge, the snowmobile) and the ground around them, with identical cameras, clock
// and weather on two builds.
//   node docs/art-direction-a/capture.mjs <url> <outdir> [only,names]
// Phone: portrait 390 x 844 at 2x, touch, mobile UA. Desktop: 1440 x 900.
// SwiftShader (CPU WebGL) renders these: colours, composition, draw calls and triangles are exact; frame
// times are not (see perf.mjs for the frame-time run).
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [url = 'http://localhost:4173/', out = 'shots', only] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const record = [];
const problems = [];
const want = (n) => !only || only.split(',').includes(n);

async function boot(viewport, opts = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: opts.dpr ?? 1, isMobile: !!opts.mobile, hasTouch: !!opts.mobile });
  const page = await ctx.newPage();
  page.setDefaultTimeout(300000);
  page.on('pageerror', (e) => problems.push(`[pageerror] ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'warning' && /SNOW PATROL/.test(m.text())) problems.push(`[warn] ${m.text()}`); });
  await page.goto(url);
  await page.waitForFunction(() => window.patrol, null, { timeout: 240000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => window.patrol, null, { timeout: 240000 });
  await page.waitForTimeout(3000);
  return { ctx, page };
}
async function hideUi(page, hide) {
  await page.evaluate((hide) => {
    let s = document.getElementById('cap-hide');
    if (!s) { s = document.createElement('style'); s.id = 'cap-hide'; document.head.appendChild(s); }
    s.textContent = (hide ? '#ui,#loading{visibility:hidden!important}' : '') + '.dispatch{display:none!important}';
  }, hide);
}
const stage = (page, s) =>
  page.evaluate((s) => {
    const P = window.patrol, g = P.game;
    P.closePanel();
    P.setDay(s.day ?? 8);
    P.setTime(s.minute);
    if (s.sled && g.mode !== 'sled') { P.sledTo(s.x, s.z); g.mountSled(true); }
    if (!s.sled && g.mode === 'sled') g.dismount();
    P.teleport(s.x, s.z, s.yaw ?? 0);
    P.camYaw(s.cam ?? s.yaw ?? 0);
    P.camPitch(s.pitch ?? 0.2);
    if (!g.cam.__orig) g.cam.__orig = g.cam.update;
    g.cam.__dist = s.dist ?? null;
    g.cam.update = function (...a) { if (this.__dist) this.dist = this.__dist; return this.__orig.apply(this, a); };
    if (s.dog) P.dogTo(s.dog[0], s.dog[1]);
  }, s);
async function shot(page, name, kind, note) {
  await hideUi(page, kind === 'env');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/${name}.png` });
  const info = await page.evaluate(() => window.patrol.info());
  const vp = page.viewportSize();
  record.push({ name, kind, note, viewport: `${vp.width}x${vp.height}`, calls: info.calls, tris: info.tris });
  console.log('shot', name, info.calls, info.tris);
}
async function at(page, name, kind, s, note, wait = 2600) {
  if (!want(name)) return;
  await stage(page, s);
  await page.waitForTimeout(wait);
  await stage(page, s);
  await page.waitForTimeout(700);
  await shot(page, name, kind, note);
}

// the lodge (16 x 12 m at -30, 245; the porch and door on the east wall), seen from the yard
const lodge = { x: -9, z: 256, yaw: 1.15, pitch: 0.1, dist: 7 };
// the concept's frame: Vince on the sled in front of the lodge's south-east corner, Koda on the rack
const sled = { x: -14, z: 255, yaw: Math.PI / 2 + 0.2, cam: Math.PI / 2 + 0.2 - 1.0, pitch: 0.12, dist: 6.5, sled: true };
// the patroller, front three-quarter, by the lodge porch
const cast = { x: -15.5, z: 249, yaw: 0, cam: Math.PI - 0.55, pitch: 0.06, dist: 3.0, dog: [-14.3, 248.4] };
const back = { x: -12, z: 252, yaw: 1.2, pitch: 0.18, dog: [-11.4, 250.8] };

{
  const { ctx, page } = await boot({ width: 390, height: 844 }, { dpr: 2, mobile: true });
  await hideUi(page, false);
  await page.click('[data-a=new]');
  await page.waitForTimeout(1800);
  await at(page, 'p-lodge', 'env', { ...lodge, minute: 11 * 60 }, 'Phone, the lodge from the yard, 11:00');
  await at(page, 'p-lodge-dusk', 'ui', { ...lodge, minute: 18 * 60 + 50 }, 'Phone HUD, the lodge at dusk, 18:50');
  await at(page, 'p-cast', 'env', { ...cast, minute: 10 * 60 + 30 }, 'Phone, Vince front three-quarter at the porch, 10:30');
  await at(page, 'p-back-hud', 'ui', { ...back, minute: 10 * 60 + 30 }, 'Phone HUD, default camera behind Vince, 10:30');
  await at(page, 'p-sled', 'ui', { ...sled, minute: 9 * 60 + 44 }, 'Phone HUD, Vince and Koda on the sled at the lodge, 09:44 (the concept frame)');
  await ctx.close();
}
{
  const { ctx, page } = await boot({ width: 1440, height: 900 });
  await page.click('[data-a=new]');
  await page.waitForTimeout(1800);
  await at(page, 'd-lodge', 'env', { ...lodge, dist: 9, minute: 11 * 60 }, 'The lodge from the yard, 11:00');
  await at(page, 'd-sled', 'env', { ...sled, minute: 9 * 60 + 44 }, 'Vince and Koda on the sled at the lodge, 09:44');
  await at(page, 'd-cast', 'env', { ...cast, dist: 2.4, minute: 10 * 60 + 30 }, 'Vince front three-quarter, 10:30');
  await at(page, 'd-lodge-dusk', 'env', { ...lodge, dist: 9, minute: 18 * 60 + 50 }, 'The lodge at dusk, 18:50');
  await ctx.close();
}
writeFileSync(`${out}/shots.json`, JSON.stringify({ url, taken: new Date().toISOString(), shots: record, problems }, null, 1));
console.log(JSON.stringify({ shots: record.length, problems }));
await browser.close();
