// Phase A cost check: the same views on two builds, phone portrait (390 x 844 at 1.5x, the game's own
// phone pixel ratio), recording draw calls, triangles and frame time.
//   node docs/art-direction-2/phase-a/perf.mjs <before-url> <after-url> <out.json>
// SwiftShader renders on the CPU, so its frame times are a RELATIVE measure of shading work on this
// machine only: they say which build asks more of the GPU, not how either runs on an iPhone.
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [before, after, out = 'perf.json'] = process.argv.slice(2);
const VIEWS = [
  { name: 'yard-day', x: 30, z: 254, yaw: 0.35, minute: 9 * 60 + 30 },
  { name: 'north-day', x: 40, z: 236, yaw: 2.6, minute: 11 * 60 },
  { name: 'lodge-dusk', x: -12, z: 258, yaw: 0.74, minute: 18 * 60 + 50 },
  { name: 'lodge-night', x: -12, z: 258, yaw: 0.74, minute: 21 * 60 + 30 },
];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
async function measure(url) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1.5, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(300000);
  await page.goto(url);
  await page.waitForFunction(() => window.patrol, null, { timeout: 240000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => window.patrol, null, { timeout: 240000 });
  await page.waitForTimeout(3000);
  await page.click('[data-a=new]');
  await page.waitForTimeout(2500);
  const res = {};
  for (const v of VIEWS) {
    const stage = (v) => page.evaluate((v) => { const P = window.patrol; P.closePanel(); P.setDay(8); P.setTime(v.minute); P.teleport(v.x, v.z, v.yaw); P.camYaw(v.yaw); P.camPitch(0.2); }, v);
    await stage(v);
    await page.waitForTimeout(2500);
    // frame times from requestAnimationFrame over 6 s, holding the clock
    const r = await page.evaluate(async (v) => {
      const P = window.patrol;
      const ts = [];
      let last = performance.now();
      await new Promise((done) => {
        const end = last + 6000;
        const f = (t) => { ts.push(t - last); last = t; P.setTime(v.minute); if (t < end) requestAnimationFrame(f); else done(); };
        requestAnimationFrame(f);
      });
      ts.sort((a, b) => a - b);
      const info = P.info();
      return { frames: ts.length, medianMs: +ts[Math.floor(ts.length / 2)].toFixed(1), p95Ms: +ts[Math.floor(ts.length * 0.95)].toFixed(1), calls: info.calls, tris: info.tris, scale: P.game.rig.renderScale };
    }, v);
    res[v.name] = r;
    console.log(url, v.name, JSON.stringify(r));
  }
  await ctx.close();
  return res;
}
const result = { note: 'SwiftShader (CPU WebGL) on the build machine: relative only, not an iPhone measurement', before: await measure(before), after: await measure(after) };
writeFileSync(out, JSON.stringify(result, null, 1));
await browser.close();
