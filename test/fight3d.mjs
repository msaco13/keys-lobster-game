// The fish fight in 3D: screenshots of each kind of spot (offshore, the ledge, the wreck, the flats, the bridge,
// the Everglades) at the moments that matter: hooked, running, jumping, close, landed, snapped, taxed.
// WebGL is forced on and rendered in software, so this checks the picture and the errors, not the speed.
// usage: node test/fight3d.mjs <repo root> <out dir> [width] [height] [only,these,stages]
import { chromium } from 'playwright';
import fs from 'fs';
const root = process.argv[2], out = process.argv[3], W = +(process.argv[4] || 960), H = +(process.argv[5] || 540), only = process.argv[6] ? process.argv[6].split(',') : null;
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const errs = []; page.on('pageerror', (e) => errs.push('PAGEERR ' + e.message)); page.on('console', (m) => { if (m.type() === 'error' || (m.type() === 'warning' && /THREE|WebGL|shader/i.test(m.text()))) errs.push(m.type() + ': ' + m.text().slice(0, 300)); });
await page.addInitScript(() => { localStorage.clear(); localStorage.setItem('keyscrew_gfx', JSON.stringify('3d')); localStorage.setItem('keyscrew_gfxTier', JSON.stringify(2)); });
await page.goto('file://' + root + '/index.html'); await page.waitForTimeout(800);
await page.evaluate(() => { Trip.start({ mode: 'crew', crew: ['michael', 'jorge', 'jemel'], plan: 'full', sessionLen: 120 }); Trip.cur.weather = { id: 'light', name: 'Light chop', vis: 1, drift: 0.3, aim: 1 }; window.__res = null; });
let n = 0;
const shot = async (name) => {
  await page.screenshot({ path: `${out}/f3d-${String(++n).padStart(2, '0')}-${name}.png` });
  const ge = await page.evaluate(() => (Game.error ? String(Game.error.stack || Game.error) : null)); if (ge) { errs.push(name + ': ' + ge); await page.evaluate(() => { Game.error = null; }); }
  const info = await page.evaluate(() => ({ in3d: !!(Game.scene.child && Game.scene.child.in3d), gl: GL.state, calls: GL.r && GL.r.info.render.calls, tris: GL.r && GL.r.info.render.triangles }));
  console.log(name.padEnd(24), JSON.stringify(info));
};
const set = (fn, wait = 900) => page.evaluate(fn).then(() => page.waitForTimeout(wait));
const STAGES = [
  { name: 'offshore', scene: 'TrollScene', spot: 'troll', ch: 'jemel', fish: { sp: 'mahi', weight: 31, ctxType: 'offshore' } },
  { name: 'marlin', scene: 'TrollScene', spot: 'hump', ch: 'jemel', fish: { sp: 'bluemarlin', weight: 380, ctxType: 'offshore' } },
  { name: 'ledge', scene: 'BottomScene', spot: 'bottom', ch: 'jorge', fish: { sp: 'blackgrouper', weight: 44, ctxType: 'reef', depth: 90 } },
  { name: 'wreck', scene: 'BottomScene', spot: 'wreck', ch: 'jorge', fish: { sp: 'amberjack', weight: 40, ctxType: 'reef', depth: 100 } },
  { name: 'flats', scene: 'FlatsScene', spot: 'flats', ch: 'michael', fish: { sp: 'bonefish', weight: 8, ctxType: 'flats', rock: 0 } },
  { name: 'bridge', scene: 'FlatsScene', spot: 'bridge', ch: 'michael', fish: { sp: 'tarpon', weight: 96, ctxType: 'flats', rock: 0 } },
  { name: 'glades', scene: 'FlatsScene', spot: 'flamingo', ch: 'jorge', fish: { sp: 'snook', weight: 14, ctxType: 'flats', rock: 0.4 } }
];
for (const S of STAGES) {
  if (only && !only.includes(S.name)) continue;
  await page.evaluate((S) => { const K = { TrollScene, BottomScene, FlatsScene }[S.scene]; Game.go(new K({ ch: S.ch, spot: S.spot, len: 120, weather: Trip.cur.weather, onEnd: (r) => { window.__res = r; } }), true); }, S);
  await page.waitForTimeout(1500);
  await page.evaluate((S) => Game.scene.startFight(S.fish), S);
  await page.waitForTimeout(1600); await shot(S.name + '-hooked');
  await set(() => { const f = Game.scene.child; f.phase = 'fight'; f.dist = f.d0 * 0.9; f.T = 0.75; f.running = true; f.runT = 3; f.revealed = false; });
  await shot(S.name + '-running');
  if (S.name !== 'ledge' && S.name !== 'wreck') { await set(() => { const f = Game.scene.child; f.revealed = true; f.running = true; f.runT = 3; f.startJump(); f.jumpT = 0.6; }, 450); await shot(S.name + '-jump'); }
  await set(() => { const f = Game.scene.child; f.jumpT = 0; f.running = false; f.revealed = true; f.dist = f.d0 * 0.25; f.T = 0.55; });
  await shot(S.name + '-close');
  if (S.name === 'offshore') {
    await set(() => { const f = Game.scene.child; f.shark = { t: 6, a: 0.4 }; f.dist = f.d0 * 0.5; }, 900); await shot('offshore-shark');
    await set(() => { Game.scene.child.lose('tax'); }, 450); await shot('offshore-taxed');
    await page.waitForTimeout(1200); await shot('offshore-taxed-card');
  } else if (S.name === 'ledge') {
    await set(() => { Game.scene.child.lose('snap'); }, 400); await shot('ledge-snap');
  } else {
    await set(() => { const f = Game.scene.child; f.dist = 0; }, 1500); await shot(S.name + '-landed');
  }
  await page.evaluate(() => { const f = Game.scene.child; if (f) f.finish(); });
}
const fps = await page.evaluate(() => new Promise((res) => { let k = 0; const t0 = performance.now(); const f = () => { k++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res(k / 2); }; requestAnimationFrame(f); }));
console.log('software fps', fps.toFixed(1));
console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'NO ERRORS');
await browser.close();
process.exitCode = errs.length ? 1 : 0;
