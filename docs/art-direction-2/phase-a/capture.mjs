// Phase A before/after captures: the same cameras, times and weather on two builds.
//   npx vite build && npx vite preview --port 4173 &
//   node docs/art-direction-2/phase-a/capture.mjs <url> <outdir>
// Day 8 is clear in all four periods, so day, dusk and night differ only by the clock; day 1's
// evening is snow. Each shot records the renderer's draw calls and triangles for that frame.
// SwiftShader (CPU WebGL) renders these: colours and composition are exact, frame times are not.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [url = 'http://localhost:4173/', out = 'phase-a-shots', only] = process.argv.slice(2);
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

const lodge = { x: -12, z: 258, yaw: 0.74, pitch: 0.18 };
const V = { x: 6, z: 262 };

// ---------------- desktop, 1440 x 900 ----------------
{
  const { ctx, page } = await boot({ width: 1440, height: 900 });
  await page.click('[data-a=new]');
  await page.waitForTimeout(1800);
  await at(page, 'd-lodge-day', 'env', { ...lodge, minute: 12 * 60 }, 'Lodge front, day 8 12:00, clear');
  await at(page, 'd-lodge-dusk', 'env', { ...lodge, minute: 18 * 60 + 50 }, 'Lodge front, day 8 18:50, clear dusk');
  await at(page, 'd-lodge-night', 'env', { ...lodge, minute: 21 * 60 + 30 }, 'Lodge front, day 8 21:30, clear night');
  await at(page, 'd-lodge-dusk-snow', 'env', { ...lodge, day: 1, minute: 18 * 60 + 40 }, 'Lodge front, day 1 18:40, snow');
  await at(page, 'd-vince-range', 'env', { ...V, yaw: 0, cam: Math.PI, pitch: 0.06, dist: 2.6, minute: 11 * 60 }, 'Vince, front, the range behind him, 11:00');
  await at(page, 'd-yard-day', 'env', { x: 30, z: 254, yaw: 0.35, minute: 9 * 60 }, 'The station yard, 09:00');
  await at(page, 'd-yard-night', 'env', { x: 30, z: 254, yaw: 0.35, minute: 21 * 60 }, 'The station yard, 21:00: the headlamp');
  await at(page, 'd-north', 'env', { x: 40, z: 236, yaw: 2.6, pitch: 0.24, minute: 9 * 60 + 40 }, 'Looking north up the valley, 09:40');
  await at(page, 'd-topstation', 'env', { x: 586, z: -320, yaw: 0.1, pitch: 0.16, minute: 11 * 60 }, 'Tannberg top station, 11:00');
  await at(page, 'd-topstation-dusk', 'env', { x: 586, z: -320, yaw: 0.1, pitch: 0.16, minute: 18 * 60 + 50 }, 'Tannberg top station, 18:50');
  if (want('d-air-valley') || want('d-air-bowl')) {
    await page.evaluate(() => window.patrol.game.mountHeli(true));
    const air = async (name, minute, tx, tz, a, dd, alt, pitch, note) => {
      if (!want(name)) return;
      const f = ([m, tx, tz, a, dd, alt, pitch]) => {
        const P = window.patrol, g = P.game, x = tx + Math.sin(a) * dd, z = tz + Math.cos(a) * dd;
        P.setDay(8); P.setTime(m); P.heliTo(x, z, g.terrain.height(x, z) + alt); g.heli.yaw = a; P.camYaw(a); P.camPitch(pitch);
        g.heliMesh.group.scale.setScalar(0.0001);
      };
      const args = [minute, tx, tz, a, dd, alt, pitch];
      await page.evaluate(f, args); await page.waitForTimeout(3000);
      await page.evaluate(f, args); await page.waitForTimeout(700);
      await shot(page, name, 'env', note + ' (helicopter model hidden)');
    };
    await air('d-air-valley', 10 * 60 + 30, 0, 100, 3.0, 300, 140, 0.12, 'Over the station looking north, 10:30');
    await air('d-air-bowl', 10 * 60 + 30, -125, -420, 0.1, 330, 110, 0.2, 'Kessel Bowl and the ridge from the air');
  }
  await ctx.close();
}

// ---------------- phone, portrait: 390 x 844 at 2x ----------------
{
  const { ctx, page } = await boot({ width: 390, height: 844 }, { dpr: 2, mobile: true });
  if (want('p-title')) await shot(page, 'p-title', 'ui', 'Title on a phone held upright');
  await hideUi(page, false);
  await page.click('[data-a=new]');
  await page.waitForTimeout(1800);
  await at(page, 'p-yard-day', 'ui', { x: 30, z: 254, yaw: 0.35, minute: 9 * 60 + 30 }, 'Phone HUD in the yard, 09:30');
  await at(page, 'p-north-day', 'ui', { x: 40, z: 236, yaw: 2.6, pitch: 0.24, minute: 11 * 60 }, 'Phone, looking north, 11:00');
  await at(page, 'p-lodge-dusk', 'ui', { ...lodge, minute: 18 * 60 + 50 }, 'Phone, lodge at dusk, 18:50');
  await at(page, 'p-lodge-night', 'ui', { ...lodge, minute: 21 * 60 + 30 }, 'Phone, lodge at night, 21:30');
  await at(page, 'p-vince-night', 'env', { ...V, yaw: 0, cam: Math.PI - 0.5, pitch: 0.1, dist: 3.4, minute: 21 * 60 + 30 }, 'Phone, Vince at night, three-quarter');
  await ctx.close();
}
writeFileSync(`${out}/shots.json`, JSON.stringify({ url, taken: new Date().toISOString(), shots: record, problems }, null, 1));
console.log(JSON.stringify({ shots: record.length, problems }));
await browser.close();
