// Phase B before/after captures: identical cameras, clock and weather on two builds.
//   node docs/art-direction-2/phase-b/capture.mjs <url> <outdir> [only,names]
// Phone shots are portrait 390 x 844 at 2x with touch and a mobile user agent (the size the brief judges).
// SwiftShader (CPU WebGL) renders these: colours and composition are exact, frame times are not.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [url = 'http://localhost:4173/', out = 'phase-b-shots', only] = process.argv.slice(2);
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

const garage = { x: 21, z: 246, yaw: 0.12, pitch: 0.14, dist: 6 };
const cast = { x: 6, z: 262, yaw: 0, cam: Math.PI - 0.55, pitch: 0.08, dist: 3.2, dog: [7.4, 261.2] };
const back = { x: 6, z: 262, yaw: 0.3, pitch: 0.2, dog: [7.2, 260.4] };

// ---------------- phone, portrait: 390 x 844 at 2x ----------------
{
  const { ctx, page } = await boot({ width: 390, height: 844 }, { dpr: 2, mobile: true });
  if (want('p-title')) await shot(page, 'p-title', 'ui', 'Title on a phone held upright');
  await hideUi(page, false);
  await page.click('[data-a=new]');
  await page.waitForTimeout(1800);
  await at(page, 'p-yard-hud', 'ui', { x: 30, z: 254, yaw: 0.35, minute: 9 * 60 + 30 }, 'Phone HUD in the yard, 09:30 (the gameplay view)');
  await at(page, 'p-back-hud', 'ui', { ...back, minute: 10 * 60 + 30 }, 'Phone HUD, default camera behind Vince with Koda, 10:30');
  await at(page, 'p-garage', 'env', { ...garage, minute: 11 * 60 }, 'Phone, the garage from the yard, 11:00');
  await at(page, 'p-garage-dusk', 'ui', { ...garage, minute: 18 * 60 + 50 }, 'Phone HUD, the garage at dusk, 18:50');
  await at(page, 'p-cast', 'env', { ...cast, minute: 11 * 60 }, 'Phone, Vince and Koda, front three-quarter, 11:00');
  await at(page, 'p-cast-night', 'env', { ...cast, minute: 21 * 60 + 30 }, 'Phone, Vince and Koda at night, 21:30');
  await ctx.close();
}
// ---------------- desktop, 1440 x 900 ----------------
{
  const { ctx, page } = await boot({ width: 1440, height: 900 });
  await page.click('[data-a=new]');
  await page.waitForTimeout(1800);
  await at(page, 'd-garage', 'env', { ...garage, minute: 11 * 60 }, 'The garage from the yard, 11:00');
  await at(page, 'd-cast', 'env', { ...cast, dist: 2.6, minute: 11 * 60 }, 'Vince and Koda, front three-quarter, 11:00');
  await at(page, 'd-yard-hud', 'ui', { x: 30, z: 254, yaw: 0.35, minute: 9 * 60 + 30 }, 'Desktop HUD in the yard, 09:30');
  await ctx.close();
}
writeFileSync(`${out}/shots.json`, JSON.stringify({ url, taken: new Date().toISOString(), shots: record, problems }, null, 1));
console.log(JSON.stringify({ shots: record.length, problems }));
await browser.close();
