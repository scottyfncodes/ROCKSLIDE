// Phase evidence: the same staged views at desktop (1280x800) and phone (393x852) width, with the
// console checked at both. Usage: node scripts/shots.mjs <url> <outdir> <shot,shot,...>
// Each shot stages itself through the QA handle `window.patrol`; a shot whose hook the build does
// not have is skipped and reported.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [url = 'http://localhost:4173/', out = 'docs/expansion/shots', list = 'town'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const SIZES = { desktop: { width: 1280, height: 800, mobile: false }, phone: { width: 393, height: 852, mobile: true } };
const report = {};
for (const [size, vp] of Object.entries(SIZES)) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, isMobile: vp.mobile, hasTouch: vp.mobile });
  const page = await ctx.newPage();
  page.setDefaultTimeout(240000);
  const logs = [];
  page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && logs.push(`${m.type()}: ${m.text()}`));
  await page.goto(url);
  await page.waitForFunction(() => window.patrol, null, { timeout: 240000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => window.patrol, null, { timeout: 240000 });
  await page.waitForTimeout(2500);
  await page.click('[data-a=new]').catch(() => page.tap('[data-a=new]'));
  await page.waitForTimeout(2500);
  await page.evaluate(() => window.patrol.closePanel());
  for (const name of list.split(',')) {
    const ok = await page.evaluate(async (name) => {
      const P = window.patrol;
      P.closePanel();
      P.setTime(11 * 60);
      if (P.stage) return P.stage(name);
      // builds before the expansion: the patrol station is the town
      if (name === 'town') { P.teleport(40, 300, 0.75); P.camYaw(0.75); P.camPitch(0.55); return true; }
      return false;
    }, name);
    if (!ok) { (report[size] ??= {})[name] = 'skipped'; continue; }
    await page.waitForTimeout(name === 'town' ? 3500 : 1800);
    await page.screenshot({ path: `${out}/${name}-${size}.png` });
    (report[size] ??= {})[name] = 'ok';
    console.log('shot', name, size);
  }
  // a few seconds of frames for the phone-width frame time
  const ft = await page.evaluate(() => new Promise((ok) => { const ts = []; let l = performance.now(); const f = () => { const n = performance.now(); ts.push(n - l); l = n; if (ts.length < 90) requestAnimationFrame(f); else ok(ts.sort((a, b) => a - b)[45]); }; requestAnimationFrame(f); }));
  report[size].medianFrameMs = +ft.toFixed(1);
  report[size].console = logs;
  await ctx.close();
}
writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
