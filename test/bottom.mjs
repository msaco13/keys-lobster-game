// Screenshots of bottom fishing (The Ledge and Eagle Wreck) in a few staged moments.
// node test/bottom.mjs <repo root> <out dir> [width] [height]
import { chromium } from 'playwright';
import fs from 'fs';
const root = process.argv[2] || process.cwd(), out = process.argv[3] || 'test/shots';
const W = +(process.argv[4] || 960), H = +(process.argv[5] || 540);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/fonts|ERR_|net::/i.test(m.text())) errs.push(m.text()); });
await page.goto('file://' + root + '/index.html'); await page.waitForTimeout(1200);
const shot = async (name) => {
  await page.screenshot({ path: `${out}/${W}x${H}-${name}.png` });
  const ge = await page.evaluate(() => (Game.error ? String(Game.error.stack || Game.error) : null));
  if (ge) { errs.push(name + ': ' + ge); await page.evaluate(() => { Game.error = null; }); }
};
for (const spot of ['bottom', 'wreck']) {
  await page.evaluate((spot) => {
    Trip.start({ mode: 'solo', crew: ['jorge'], plan: 'solo', sessionLen: 120 });
    Trip.cur.weather = { id: 'light', name: 'Light chop', wind: '5–10 kts', vis: 1, drift: 0.5, aim: 1 };
    window.__res = null;
    Game.go(new BottomScene({ ch: 'jorge', spot, len: 120, weather: Trip.cur.weather, onEnd: (r) => { window.__res = r; } }), true);
  }, spot);
  await page.waitForTimeout(400); await shot(spot + '-start');
  await page.waitForTimeout(2200); await shot(spot + '-settled');
  // park over the best structure with the bait among the fish
  await page.evaluate(() => {
    const s = Game.scene, h = s.hot.reduce((a, b) => (s.fish.filter((f) => f.hs === b).length > s.fish.filter((f) => f.hs === a).length ? b : a));
    s.bx = h.x; s.cam = s.bx - s.baitSX();
    const f = s.fish.find((f) => f.hs === h); if (f) { s.targetDepth = s.ftOf(f.y); s.baitDepth = s.targetDepth; }
    for (let i = 0; i < 150; i++) { s.stepFish(1 / 15, false); s.ping(); }
  });
  await page.waitForTimeout(600); await shot(spot + '-onfish');
  // a bite
  await page.evaluate(() => {
    const s = Game.scene; let f = s.fish.find((f) => Math.abs(f.x - s.bx) < 200) || s.fish[0];
    f.state = 'bite'; f.timer = 5; f.x = s.baitX() - 24; f.y = s.yOf(s.baitDepth); f.face = 1; s.slam = 5;
  });
  await page.waitForTimeout(250); await shot(spot + '-bite');
  await page.evaluate(() => { const s = Game.scene; const f = s.activeFish(); if (f) s.spook(f); s.slam = 0; s.startMove(1); });
  await page.waitForTimeout(1500); await shot(spot + '-moving');
  await page.waitForTimeout(2500);
  // a wide look at the structure: walk the camera along the strip
  for (const x of spot === 'wreck' ? [1700, 2250, 950] : [1090, 1950, 2735]) {
    await page.evaluate((x) => { const s = Game.scene; s.move = null; s.bx = x; s.cam = x - s.baitSX(); s.baitDepth = s.targetDepth = s.maxDepth(); }, x);
    await page.waitForTimeout(300); await shot(spot + '-at' + x);
  }
  await page.evaluate(() => { Game.scene.togglePause(); }); await page.waitForTimeout(200); await shot(spot + '-pause');
  await page.evaluate(() => { Game.scene.togglePause(); });
}
console.log(errs.length ? errs.join('\n') : 'no errors');
await browser.close();
