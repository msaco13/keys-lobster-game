// Times BottomScene update + draw at the widest layout. node test/bottom-perf.mjs <repo root>
import { chromium } from 'playwright';
const root = process.argv[2] || process.cwd();
const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 1280, height: 540 } });
await page.goto('file://' + root + '/index.html'); await page.waitForTimeout(1000);
for (const spot of ['bottom', 'wreck']) {
  const r = await page.evaluate((spot) => {
    Trip.start({ mode: 'solo', crew: ['jorge'], plan: 'solo', sessionLen: 120 });
    const s = new BottomScene({ ch: 'jorge', spot, len: 120, weather: Trip.cur.weather, onEnd: () => {} }); Game.scene = s;
    s.bx = s.hot[1].x; s.cam = s.bx - s.baitSX(); s.baitDepth = s.targetDepth = s.maxDepth() - 5;
    const ctx = Game.ctx, N = 300; let tu = 0, td = 0;
    for (let i = 0; i < N; i++) { let a = performance.now(); s.update(1 / 60); tu += performance.now() - a; a = performance.now(); UI.beginFrame(); s.draw(ctx); td += performance.now() - a; }
    return { update: (tu / N).toFixed(2), draw: (td / N).toFixed(2) };
  }, spot);
  console.log(spot.padEnd(7), 'ms/frame update', r.update, 'draw', r.draw);
}
await browser.close();
