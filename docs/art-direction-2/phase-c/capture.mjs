// Phase C before/after captures (every building): identical cameras, clock and weather on two builds.
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

// look at a target (tx, tz) from d metres away on bearing a (0 = from the south): the camera sits behind the player
const look = (tx, tz, a, d, pitch, minute, dist) => ({ x: tx + Math.sin(a) * d, z: tz + Math.cos(a) * d, yaw: a, pitch, minute, dist });
const SHOTS = [
  ['hangar', look(-1, 292, -0.62, 24, 0.12, 10 * 60 + 30, 7), 'Hangar 1 and the pad, 10:30'],
  ['equipment', look(25, 211, -0.8, 14, 0.12, 11 * 60, 6), 'The equipment room, 11:00'],
  ['kennel', look(-8, 272, 0.75, 8, 0.2, 11 * 60, 4), "Koda's kennel, 11:00"],
  ['mast', look(-50.4, 221.6, 0.56, 14, 0.2, 11 * 60, 6), 'The radio mast and its hut, 11:00'],
  ['yard-dusk', { x: 30, z: 254, yaw: 0.35, pitch: 0.2, minute: 18 * 60 + 50 }, 'The yard at dusk, 18:50'],
  ['hollin', look(330, 455, 0.25, 42, 0.16, 11 * 60), 'Hollin: the Kettle and the village row'],
  ['chapel', look(420, 545, 0.55, 26, 0.14, 15 * 60, 7), 'Hollin chapel, 15:00'],
  ['house', look(400, 430, 1.1, 22, 0.14, 11 * 60, 6), 'A Hollin house, 11:00'],
  ['cabin', look(760, -60, 0.4, 11, 0.24, 12 * 60, 5), 'Fernhut cabin, 12:00'],
  ['topstation', look(600, -336, -0.6, 13, 0.16, 11 * 60, 5), 'Tannberg top station hut, 11:00'],
  ['boathouse', look(-342, 392, 0.9, 20, 0.14, 13 * 60, 6), 'The boathouse on Mirror Lake, 13:00'],
  ['barrier', look(-158, -38, 0.5, 14, 0.14, 12 * 60, 5), 'The pass barrier hut, 12:00'],
  ['minecabin', look(-344, -215, 0.6, 18, 0.14, 12 * 60, 6), 'The old mine cabin, 12:00'],
];
const unlock = (page) => page.evaluate(() => window.patrol.game.station.setUpgrades(['kennel', 'workshop', 'equipment', 'hangar', 'mast', 'wing', 'lights']));

// ---------------- phone, portrait: 390 x 844 at 2x ----------------
{
  const { ctx, page } = await boot({ width: 390, height: 844 }, { dpr: 2, mobile: true });
  await hideUi(page, false);
  await page.click('[data-a=new]');
  await page.waitForTimeout(1800);
  await unlock(page);
  for (const [n, s, note] of SHOTS) await at(page, `p-${n}`, 'env', s, `Phone: ${note}`);
  await ctx.close();
}
// ---------------- desktop, 1440 x 900: the yard with every upgrade, and Hollin ----------------
{
  const { ctx, page } = await boot({ width: 1440, height: 900 });
  await page.click('[data-a=new]');
  await page.waitForTimeout(1800);
  await unlock(page);
  await at(page, 'd-yard', 'env', look(5, 250, -2.4, 50, 0.32, 10 * 60), 'The whole yard, every upgrade, 10:00');
  await at(page, 'd-hollin', 'env', look(330, 480, 0.2, 75, 0.22, 11 * 60), 'Hollin from the edge of the village');
  await ctx.close();
}
writeFileSync(`${out}/shots.json`, JSON.stringify({ url, taken: new Date().toISOString(), shots: record, problems }, null, 1));
console.log(JSON.stringify({ shots: record.length, problems }));
await browser.close();
