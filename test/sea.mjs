// Open water: build time, screenshots around the map, the chart, autopilot to a spot.
import { chromium } from 'playwright';
const root = process.argv[2], out = process.argv[3], W = +(process.argv[4] || 960), H = +(process.argv[5] || 540);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const errs = []; page.on('pageerror', (e) => errs.push('PAGEERR ' + e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto('file://' + root + '/index.html'); await page.waitForTimeout(1200);
let n = 0; const shot = async (name) => { await page.screenshot({ path: `${out}/sea-${String(++n).padStart(2, '0')}-${name}.png` }); const ge = await page.evaluate(() => (Game.error ? String(Game.error.stack || Game.error) : null)); if (ge) { errs.push(name + ': ' + ge); await page.evaluate(() => { Game.error = null; }); } };
const ms = await page.evaluate(() => { localStorage.clear(); const t0 = performance.now(); World.build(); return Math.round(performance.now() - t0); });
console.log('world build ms', ms, 'keys', await page.evaluate(() => KEYS.length), 'reefs', await page.evaluate(() => PATCH_REEFS.length), 'floats', await page.evaluate(() => World.floats.length));
await page.evaluate(() => { Trip.start({ mode: 'crew', crew: ['michael', 'jorge', 'jemel'], plan: 'full', sessionLen: 120 }); Game.go(new SeaScene(), true); });
await page.waitForTimeout(1500); await shot('home');
const place = async (name, x, s, h, v = 0, notch = 1) => { await page.evaluate(([x, s, h, v, notch]) => { const S = Game.scene; S.x = x; S.y = wy(x, s); S.h = h; S.v = v; S.notch = notch; S.cam.x = S.x; S.cam.y = S.y; S.panel = null; }, [x, s, h, v, notch]); await page.waitForTimeout(900); await shot(name); };
await place('harbor', 8740, 420, Math.PI / 2, 60, 1);
await place('hawk-cruise', 8200, 900, Math.PI, 210, 3);
await place('hen-chickens', 6960, 1150, Math.PI / 2, 40, 1);
await place('reef-line', 4800, 2250, 0.3, 300, 4);
await place('alligator', 4640, 2200, 0, 30, 1);
await place('bridge', 6410, 260, -Math.PI / 2, 60, 1);
await place('bay', 6300, -900, -2, 200, 3);
await place('flamingo', 4320, -4500, -Math.PI / 2, 40, 1);
await place('offshore', 9440, 4500, 0, 320, 4);
await place('hump', 6560, 6000, 0, 200, 3);
await place('channel5', 2200, 500, -Math.PI / 2, 40, 1);
// chart overlay
await page.evaluate(() => { Game.scene.openChart(); }); await page.waitForTimeout(400); await shot('chart');
await page.evaluate(() => { Game.scene.sel = 'bughunt'; }); await page.waitForTimeout(300); await shot('chart-sel');
await page.evaluate(() => { Game.scene.sel = 'wreck'; }); await page.waitForTimeout(300); await shot('chart-rumor');
// autopilot from home to Hen & Chickens: time it in sim seconds
const route = await page.evaluate(() => {
  const S = Game.scene; S.panel = null; S.x = World.home.x + 10; S.y = World.home.dockY + 4; S.h = Math.PI / 2; S.v = 0;
  const t0 = performance.now(); S.dest = 'bughunt'; S.planRoute(); const ms = performance.now() - t0; S.setAuto(true);
  return { ms: Math.round(ms), pts: S.route && S.route.length };
});
console.log('route', JSON.stringify(route));
const sim = await page.evaluate(() => {
  const S = Game.scene; let t = 0; const log = [];
  while (t < 240 && !S.inSpot) { S.update(1 / 30); t += 1 / 30; if (Math.round(t * 30) % 300 === 0) log.push([Math.round(t), Math.round(S.x), Math.round(S.y - chainY(S.x)), Math.round(S.v), S.auto, S.ri]); }
  return { t: Math.round(t), inSpot: S.inSpot, flags: S.flags, lines: S.lines.map((l) => l.label + ' ' + l.pts), log };
});
console.log('autopilot to Hen & Chickens', JSON.stringify(sim));
await page.waitForTimeout(500); await shot('arrived');
// every spot reachable by the autopilot from home?
const reach = await page.evaluate(() => {
  const out = {};
  for (const id of SPOT_ORDER) { const [x, y] = spotXY(id); const p = World.findPath(World.home.x + 10, World.home.dockY + 4, x, y); out[id] = p ? p.length : null; }
  return out;
});
console.log('paths from home', JSON.stringify(reach));
console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'NO ERRORS');
await browser.close();
