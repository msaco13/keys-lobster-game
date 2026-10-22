// The boat ride in 3D: screenshots around the map with the WebGL view forced on (headless Chromium renders it in
// software, so this checks the picture and the errors, not the speed), plus the frame rate the software renderer gets.
// usage: node test/sea3d.mjs <repo root> <out dir> [width] [height] [only-these,shot-names]
import { chromium } from 'playwright';
import fs from 'fs';
const root = process.argv[2], out = process.argv[3], W = +(process.argv[4] || 960), H = +(process.argv[5] || 540), only = process.argv[6] ? process.argv[6].split(',') : null;
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const errs = []; page.on('pageerror', (e) => errs.push('PAGEERR ' + e.message)); page.on('console', (m) => { if (m.type() === 'error' || (m.type() === 'warning' && /THREE|WebGL|shader/i.test(m.text()))) errs.push(m.type() + ': ' + m.text().slice(0, 400)); });
await page.addInitScript(() => { localStorage.clear(); localStorage.setItem('keyscrew_gfx', JSON.stringify('3d')); localStorage.setItem('keyscrew_gfxTier', JSON.stringify(2)); });
await page.goto('file://' + root + '/index.html'); await page.waitForTimeout(1000);
await page.evaluate(() => { World.build(); Trip.start({ mode: 'crew', crew: ['michael', 'jorge', 'jemel'], plan: 'full', sessionLen: 120 }); Game.go(new SeaScene(), true); });
await page.waitForTimeout(2500);
const state = await page.evaluate(() => ({ state: Sea3D.state, why: Sea3D.why, gl: Sea3D.r && Sea3D.r.getContext().getParameter(Sea3D.r.getContext().VERSION), calls: Sea3D.r && Sea3D.r.info.render.calls, tris: Sea3D.r && Sea3D.r.info.render.triangles }));
console.log('3D', JSON.stringify(state));
let n = 0;
const shot = async (name) => {
  if (only && !only.includes(name)) return;
  await page.screenshot({ path: `${out}/3d-${String(++n).padStart(2, '0')}-${name}.png` });
  const ge = await page.evaluate(() => (Game.error ? String(Game.error.stack || Game.error) : null)); if (ge) { errs.push(name + ': ' + ge); await page.evaluate(() => { Game.error = null; }); }
  const info = await page.evaluate(() => Sea3D.r && { calls: Sea3D.r.info.render.calls, tris: Sea3D.r.info.render.triangles, state: Sea3D.state });
  console.log(name, JSON.stringify(info));
};
// put the boat somewhere: x along the chain, s off it, heading, speed, throttle notch
const place = async (name, x, s, h, v = 0, notch = 1, extra = '') => {
  if (only && !only.includes(name)) return;
  await page.evaluate(([x, s, h, v, notch, extra]) => { const S = Game.scene; S.x = x; S.y = wy(x, s); S.h = h; S.v = v; S.notch = notch; S.cam.x = S.x; S.cam.y = S.y; S.panel = null; S.trail = []; S.foam = []; Chase.reset(S); if (extra) eval(extra); }, [x, s, h, v, notch, extra]);
  await page.waitForTimeout(1600); await shot(name);
};
await shot('home');
await place('harbor', 8740, 420, Math.PI / 2, 60, 1);
await place('hawk-cruise', 8200, 900, Math.PI, 210, 3);
await place('hen-chickens', 6960, 1150, Math.PI / 2, 40, 1);
await place('reef-line', 4800, 2250, 0.3, 300, 4);
await place('alligator', 4640, 2200, 0, 30, 1);
await place('bridge', 6410, 300, -Math.PI / 2, 60, 1);
await place('under-bridge', 6410, 60, -Math.PI / 2, 60, 1);
await place('bay', 6300, -900, -2, 200, 3);
await place('flamingo', 4320, -4500, -Math.PI / 2, 40, 1);
await place('offshore', 9440, 4500, 0, 320, 4);
await place('hump', 6560, 6000, 0, 200, 3);
await place('channel5', 2200, 500, -Math.PI / 2, 40, 1);
await place('dolphins', 9000, 3000, 0.4, 260, 4, "S.dolphins = { t: 1, dur: 60, pod: [0, 1, 2].map((i) => ({ ox: 60 + i * 20, oy: (i - 1) * 46, ph: i * 2 })) };");
await place('airtime', 8000, 1500, 0.2, 300, 4, 'S.air = { t: 15, dur: 30 };');
await place('sunset', 8740, 900, -Math.PI / 2, 210, 3, 'S.homeRun = true; Sea3D.skyNow = null;');
// frame rate in software (not a phone number; just a sanity check that nothing explodes)
const fps = await page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else res(n / 3); }; requestAnimationFrame(f); }));
console.log('software fps', fps.toFixed(1), 'tier', await page.evaluate(() => GFX.tier));
console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'NO ERRORS');
await browser.close();
