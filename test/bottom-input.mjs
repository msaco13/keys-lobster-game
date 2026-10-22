// Drives bottom fishing with real mouse and keyboard events: Move buttons (tap and hold), A/D keys,
// dragging depth in the water and on the fish finder, bait buttons, chum, and hooking a bite by click and Space.
// node test/bottom-input.mjs <repo root>
import { chromium } from 'playwright';
const root = process.argv[2] || process.cwd();
const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto('file://' + root + '/index.html'); await page.waitForTimeout(1200);
let fails = 0;
const check = (name, ok, info = '') => { console.log((ok ? 'ok   ' : 'FAIL ') + name + (info ? '  ' + info : '')); if (!ok) fails++; };
const fresh = async (spot = 'bottom') => {
  await page.evaluate((spot) => {
    Trip.start({ mode: 'solo', crew: ['michael'], plan: 'solo', sessionLen: 120 });
    Game.go(new BottomScene({ ch: 'michael', spot, len: 120, weather: Trip.cur.weather, onEnd: () => {} }), true);
    const s = Game.scene; s.bx = 1600; s.cam = s.bx - s.baitSX();
  }, spot);
  await page.waitForTimeout(500);
};
const btn = (id) => page.evaluate((id) => { const r = UI.byId(id); return r && { x: r.x + r.w / 2, y: r.y + r.h / 2, disabled: !!r.disabled }; }, id);
const S = (expr) => page.evaluate(expr);
const settle = async () => { for (let i = 0; i < 80; i++) { if (!(await S(() => !!Game.scene.move))) return; await page.waitForTimeout(100); } };

await fresh();
// tap Move ▶: one leg of about BOT.LEG
let x0 = await S(() => Game.scene.bx), b = await btn('moveR');
await page.mouse.click(b.x, b.y); await page.waitForTimeout(150);
check('tap Move starts a move', await S(() => !!Game.scene.move));
await settle();
let dx = (await S(() => Game.scene.bx)) - x0;
check('tap Move goes one leg', dx > 180 && dx < 330, 'moved ' + dx.toFixed(0));
// hold Move ▶: keeps going while held (held 2 s past the moment the boat gets going, about 380 px at full idle: reeling
// the bait up first takes longer the deeper it is, so a fixed hold from the press can come up short)
const going = async (W) => { for (let i = 0; i < 60 && !(await W(() => Game.scene.move && Game.scene.move.phase === 'go')); i++) await new Promise((r) => setTimeout(r, 50)); };
x0 = await S(() => Game.scene.bx);
await page.mouse.move(b.x, b.y); await page.mouse.down(); await going(S); await page.waitForTimeout(2000); await page.mouse.up();
await settle();
dx = (await S(() => Game.scene.bx)) - x0;
check('hold Move keeps going', dx > 330, 'moved ' + dx.toFixed(0));
// keyboard: tap A, hold D
x0 = await S(() => Game.scene.bx);
await page.keyboard.press('KeyA'); await page.waitForTimeout(150); await settle();
dx = (await S(() => Game.scene.bx)) - x0;
check('A moves left one leg', dx < -180 && dx > -330, 'moved ' + dx.toFixed(0));
x0 = await S(() => Game.scene.bx);
await page.keyboard.down('ArrowRight'); await going(S); await page.waitForTimeout(2000); await page.keyboard.up('ArrowRight'); await settle();
dx = (await S(() => Game.scene.bx)) - x0;
check('holding → keeps going', dx > 330, 'moved ' + dx.toFixed(0));
const tl = await S(() => Game.scene.timeLeft);
check('moving costs time', tl < 120 - 8, 'time left ' + tl.toFixed(1));
// drag in the water sets depth
await page.waitForTimeout(400);
let r = await S(() => { const s = Game.scene; return { x: s.baitSX() - 60, y1: s.yOf(30), y2: s.yOf(70) }; });
await page.mouse.move(r.x, r.y1); await page.mouse.down(); await page.mouse.move(r.x, r.y2, { steps: 6 }); await page.mouse.up();
let td = await S(() => Game.scene.targetDepth);
check('drag in the water sets depth', Math.abs(td - 70) < 3, 'target ' + td.toFixed(1));
// drag on the fish finder sets depth on its scale
r = await S(() => { const q = Game.scene.sonarRect; return { x: q.x + q.w * 0.4, y: q.y + (50 / q.range) * q.h }; });
await page.mouse.click(r.x, r.y);
td = await S(() => Game.scene.targetDepth);
check('tap on the fish finder sets depth', Math.abs(td - 50) < 3, 'target ' + td.toFixed(1));
// ↓ key deepens
await page.keyboard.down('ArrowDown'); await page.waitForTimeout(500); await page.keyboard.up('ArrowDown');
check('↓ deepens', (await S(() => Game.scene.targetDepth)) > td + 8);
// bait buttons and chum
b = await btn('pinfish'); await page.mouse.click(b.x, b.y); await page.waitForTimeout(100);
check('Pinfish button swaps bait', await S(() => Game.scene.baitType === 'pinfish' && (Game.scene.reeling || Game.scene.rebaitT > 0 || !Game.scene.baitOn)));
await page.keyboard.press('Digit1'); await page.waitForTimeout(100);
check('1 picks squid', await S(() => Game.scene.baitType === 'squid'));
b = await btn('chum'); await page.mouse.click(b.x, b.y); await page.waitForTimeout(100);
check('chum button', await S(() => Game.scene.chumCd > 0 && Game.scene.chumT > 0));
// wait for the bait to be back down, then stage a bite and hook it with a click in the water
for (let i = 0; i < 60 && !(await S(() => Game.scene.baitOn && Game.scene.settled)); i++) await page.waitForTimeout(100);
// (a fish already working the bait is sent off first: in play only one fish takes the bait at a time)
const stage = () => S(() => { const s = Game.scene, a = s.activeFish(); if (a) s.spook(a); const f = s.spawnFish(s.hot[0], false); f.state = 'bite'; f.timer = 3; f.x = s.baitX() - 20; f.y = s.yOf(s.baitDepth); return true; });
await stage(); await page.mouse.click(200, 300); await page.waitForTimeout(150);
check('click on the BITE hooks the fish', await S(() => !!Game.scene.child));
await S(() => { const f = Game.scene.child; f.toOver(); f.finish(); });
for (let i = 0; i < 60 && !(await S(() => Game.scene.baitOn && Game.scene.settled)); i++) await page.waitForTimeout(100);
await stage(); await page.keyboard.press('Space'); await page.waitForTimeout(150);
check('Space on the BITE hooks the fish', await S(() => !!Game.scene.child));
await S(() => { const f = Game.scene.child; f.toOver(); f.finish(); });
check('a catch is recorded with a track waypoint', await S(() => Game.scene.catches.length === 2 && Game.scene.wps.length === 2));
// tapping during a nibble is too early
for (let i = 0; i < 60 && !(await S(() => Game.scene.baitOn && Game.scene.settled)); i++) await page.waitForTimeout(100);
await S(() => { const s = Game.scene, a = s.activeFish(); if (a) s.spook(a); const f = s.spawnFish(s.hot[0], false); f.state = 'nibble'; f.nib = 3; f.timer = 3; f.x = s.baitX() - 20; f.y = s.yOf(s.baitDepth); });
await page.keyboard.press('Space'); await page.waitForTimeout(100);
check('Space during a nibble is too early', await S(() => !Game.scene.child && !Game.scene.activeFish()));
// pause blocks input
await page.keyboard.press('Escape'); await page.waitForTimeout(100);
x0 = await S(() => Game.scene.bx); b = await btn('moveR');
await page.keyboard.press('KeyD'); await page.waitForTimeout(300);
check('paused: D does nothing', await page.evaluate((x0) => !Game.scene.move && Game.scene.bx === x0, x0));
await page.keyboard.press('Escape');
// wreck loads and plays
await fresh('wreck');
await page.waitForTimeout(800);
check('wreck runs', await S(() => Game.scene.variant === 'wreck' && Game.scene.sonar.length > 0 && !Game.error));
// touch: a phone-sized page with real touch events
{
  const ctx2 = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, deviceScaleFactor: 2 });
  const tp = await ctx2.newPage(); tp.on('pageerror', (e) => errs.push(e.message));
  await tp.goto('file://' + root + '/index.html'); await tp.waitForTimeout(1200);
  const cdp = await ctx2.newCDPSession(tp);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  await tp.evaluate(() => { Trip.start({ mode: 'solo', crew: ['jemel'], plan: 'solo', sessionLen: 120 }); Game.go(new BottomScene({ ch: 'jemel', spot: 'wreck', len: 120, weather: Trip.cur.weather, onEnd: () => {} }), true); const s = Game.scene; s.bx = 2700; s.cam = s.bx - s.baitSX(); });
  await tp.waitForTimeout(500);
  // logical → CSS pixels
  const toCss = (lx, ly) => tp.evaluate(([lx, ly]) => { const r = Game.canvas.getBoundingClientRect(); return [r.left + Game.ox + lx * Game.scale, r.top + Game.oy + ly * Game.scale]; }, [lx, ly]);
  const T = (expr, arg) => tp.evaluate(expr, arg);
  const settleT = async () => { for (let i = 0; i < 80; i++) { if (!(await T(() => !!Game.scene.move))) return; await tp.waitForTimeout(100); } };
  let b2 = await T(() => { const r = UI.byId('moveL'); return [r.x + r.w / 2, r.y + r.h / 2]; });
  let [cx, cy] = await toCss(...b2);
  let bx0 = await T(() => Game.scene.bx);
  await touch('touchStart', cx, cy); await tp.waitForTimeout(80); await touch('touchEnd'); await tp.waitForTimeout(100); await settleT();
  let d = (await T(() => Game.scene.bx)) - bx0;
  check('touch: tap Move ◀ goes one leg', d < -180 && d > -330, 'moved ' + d.toFixed(0));
  bx0 = await T(() => Game.scene.bx);
  await touch('touchStart', cx, cy); await going(T); await tp.waitForTimeout(2000); await touch('touchEnd'); await tp.waitForTimeout(100); await settleT();
  d = (await T(() => Game.scene.bx)) - bx0;
  check('touch: hold Move ◀ keeps going', d < -330, 'moved ' + d.toFixed(0));
  await tp.waitForTimeout(300);
  const [lx, ly1, ly2] = await T(() => { const s = Game.scene; return [s.baitSX() - 50, s.yOf(40), s.yOf(85)]; });
  [cx, cy] = await toCss(lx, ly1); const [, cy2] = await toCss(lx, ly2);
  await touch('touchStart', cx, cy); for (let i = 1; i <= 6; i++) { await touch('touchMove', cx, cy + (cy2 - cy) * i / 6); await tp.waitForTimeout(16); } await touch('touchEnd');
  const td2 = await T(() => Game.scene.targetDepth);
  check('touch: drag sets depth', Math.abs(td2 - 85) < 3, 'target ' + td2.toFixed(1));
  for (let i = 0; i < 60 && !(await T(() => Game.scene.baitOn && Game.scene.settled)); i++) await tp.waitForTimeout(100);
  await T(() => { const s = Game.scene, a = s.activeFish(); if (a) s.spook(a); const f = s.spawnFish(s.hot[0], false); f.state = 'bite'; f.timer = 3; f.x = s.baitX() - 20; f.y = s.yOf(s.baitDepth); });
  [cx, cy] = await toCss(200, 300); await touch('touchStart', cx, cy); await tp.waitForTimeout(50); await touch('touchEnd'); await tp.waitForTimeout(100);
  check('touch: tap on the BITE hooks the fish', await T(() => !!Game.scene.child));
  check('touch: Game.touch detected', await T(() => Game.touch));
  await ctx2.close();
}
console.log(errs.length ? errs.join('\n') : 'no page errors', '| Game.error', await S(() => (Game.error ? String(Game.error) : null)));
console.log(fails ? fails + ' FAILED' : 'all passed');
await browser.close();
process.exit(fails || errs.length ? 1 : 0);
