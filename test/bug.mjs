// Bug Hunt: the how-to card, dive in, tickle with the mouse (letting go on the warning), swing the net, miss,
// net-behind catch, a click on the bug, Space, gauge, reef variant. Exits 1 if a catch that should land doesn't.
import { chromium } from 'playwright';
const root = process.argv[2], out = process.argv[3], W = +(process.argv[4] || 960), H = +(process.argv[5] || 540), touch = process.argv[6] === 'touch';
const browser = await chromium.launch();
const ctxB = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
const page = await ctxB.newPage();
const errs = []; page.on('pageerror', (e) => errs.push('PAGEERR ' + e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto('file://' + root + '/index.html'); await page.waitForTimeout(1200);
let n = 0; const shot = async (name) => { await page.screenshot({ path: `${out}/bug-${String(++n).padStart(2, '0')}-${name}.png` }); const ge = await page.evaluate(() => (Game.error ? String(Game.error.stack || Game.error) : null)); if (ge) { errs.push(name + ': ' + ge); await page.evaluate(() => { Game.error = null; }); } };
const toCss = (x, y) => page.evaluate(([x, y]) => ({ x: Game.ox + x * Game.scale, y: Game.oy + y * Game.scale }), [x, y]);
const check = (ok, what) => { console.log((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) errs.push('FAIL ' + what); };
// the first dive opens the how-to card; Got it closes it (clicked like a player would)
const gotIt = async () => { const r = await page.evaluate(() => { const b = UI.byId('help-ok'); return b && { x: b.x + b.w / 2, y: b.y + b.h / 2 }; }); if (!r) return false; const p = await toCss(r.x, r.y); await page.mouse.click(p.x, p.y); await page.waitForTimeout(200); return !(await page.evaluate(() => !!Game.scene.help)); };
const start = async (spot) => { await page.evaluate((spot) => { localStorage.clear(); Trip.start({ mode: 'solo', crew: ['michael'], plan: 'solo', sessionLen: 120 }); Trip.cur.weather = { id: 'glass', name: 'Glass calm', vis: 1.25, drift: 0, aim: 0.75 }; window.__res = null; Game.go(new BugHuntScene({ ch: 'michael', spot, len: 120, weather: Trip.cur.weather, shark: false, onEnd: (r) => { window.__res = r; } }), true); }, spot); };
await start('bughunt');
await page.waitForTimeout(500); await shot('how-to');
check(await gotIt(), 'how-to card opens on the first dive and Got it closes it');
await page.waitForTimeout(1300); await shot('in-water');
// park next to a lobster hole and hold the mouse on it
const den = await page.evaluate(() => { const s = Game.scene; const den = s.dens.find((d) => d.kind === 'lobster'); s.diver.x = den.x + den.dir * 200; s.diver.y = den.y - 20; s.cam = Math.max(0, s.diver.x - Game.W * 0.45); s.camY = 0; den.nextTwitch = 99; return { x: den.x - s.cam + den.dir * 6, y: den.y - s.camY }; });
let p = await toCss(den.x, den.y); await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.waitForTimeout(900); await shot('swim-to-hole');
await page.waitForTimeout(1600); await shot('tickling');
await page.waitForTimeout(800); await page.mouse.up();
const st = await page.evaluate(() => ({ out: !!Game.scene.out, state: Game.scene.out && Game.scene.out.state }));
console.log('after tickling:', JSON.stringify(st));
if (!st.out) await page.evaluate(() => { const s = Game.scene; const den = s.dens.find((d) => d.kind === 'lobster' && d.state === 'in'); s.emerge(den); });
await page.waitForTimeout(1400); await shot('bug-out');
// hover aim then click right on it
const bug = await page.evaluate(() => { const s = Game.scene, o = s.out; o.state = 'idle'; o.idleT = 5; s.diver.x = o.x + o.dir * 120; s.diver.y = o.y - 40; return { x: o.x - s.cam, y: o.y - s.camY }; });
p = await toCss(bug.x, bug.y); await page.mouse.move(p.x, p.y); await page.waitForTimeout(300); await shot('aim');
// a miss first (click in front of it)
const miss = await page.evaluate(() => { const s = Game.scene, o = s.out; return { x: o.x + o.dir * 90 - s.cam, y: o.y - 50 - s.camY }; });
p = await toCss(miss.x, miss.y); await page.mouse.click(p.x, p.y); await page.waitForTimeout(260); await shot('swing-miss');
await page.waitForTimeout(400); console.log('after miss:', JSON.stringify(await page.evaluate(() => Game.scene.out && { st: Game.scene.out.state, misses: Game.scene.out.misses })));
// pro move: set the net behind it, then make it flip
await page.waitForTimeout(800);
await page.evaluate(() => { const s = Game.scene; if (!s.out) { const den = s.dens.find((d) => d.kind === 'lobster' && d.state === 'in'); s.diver.x = den.x + den.dir * 150; s.diver.y = den.y - 30; s.emerge(den); } });
await page.waitForTimeout(1600);
// (the diver hovers over the bug, so the spot behind its tail is in reach of the net)
const pro = await page.evaluate(() => { const s = Game.scene, o = s.out; if (!o) return null; o.lob.temper = 'skittish'; o.state = 'idle'; o.idleT = 9; o.vx = 0; o.home = null; s.diver.x = o.x; s.diver.y = o.y - 70; s.diver.facing = -o.dir; s.net.cool = 0; s.cam = Math.max(0, s.diver.x - Game.W * 0.45); return { x: o.x - o.dir * 80 - s.cam, y: o.y - s.camY }; });
if (pro) {
  p = await toCss(pro.x, pro.y); await page.mouse.click(p.x, p.y); await page.waitForTimeout(260);
  await page.evaluate(() => { const o = Game.scene.out; if (o) { o.state = 'crouch'; o.ct = 0.05; } });
  await page.waitForTimeout(350); await shot('pro-catch');
}
const g = await page.evaluate(() => ({ gauge: !!Game.scene.gauge, lines: Game.scene.extraLines.map((l) => l.label + ' ' + l.pts) }));
check(g.gauge && g.lines.some((l) => /Backed it into the net/.test(l)), 'net set behind the tail catches it on the flip (' + JSON.stringify(g) + ')');
if (!g.gauge) await page.evaluate(() => { Game.scene.gauge = { lob: { cl: 3.4, w: 1.2, eggs: false }, t: 0 }; });
await page.waitForTimeout(500); await shot('gauge');
await page.evaluate(() => Game.scene.decide(true));
// a direct click catch
await page.evaluate(() => { const s = Game.scene; const den = s.dens.find((d) => d.kind === 'lobster' && d.state === 'in'); s.diver.x = den.x + den.dir * 150; s.diver.y = den.y - 30; s.cam = Math.max(0, s.diver.x - Game.W * 0.45); s.emerge(den); });
await page.waitForTimeout(1500);
const b2 = await page.evaluate(() => { const s = Game.scene, o = s.out; o.state = 'idle'; o.idleT = 5; return { x: o.x - s.cam, y: o.y - s.camY }; });
p = await toCss(b2.x, b2.y); await page.mouse.click(p.x, p.y); await page.waitForTimeout(400);
check(await page.evaluate(() => !!Game.scene.gauge), 'a click on the bug nets it');
await page.evaluate(() => { if (Game.scene.gauge) Game.scene.decide(false); });
// keyboard: space near a lobster in the open swings at it
await page.evaluate(() => { const s = Game.scene; const den = s.dens.find((d) => d.kind === 'lobster' && d.state === 'in'); if (!den) return; s.diver.x = den.x + den.dir * 150; s.diver.y = den.y - 30; s.emerge(den); });
await page.waitForTimeout(1500); await page.evaluate(() => { const o = Game.scene.out; if (o) { o.state = 'idle'; o.idleT = 5; } });
await page.keyboard.press('Space'); await page.waitForTimeout(800);
check(await page.evaluate(() => !!Game.scene.gauge), 'Space nets it (swimming in first if needed)');
await page.evaluate(() => { if (Game.scene.gauge) Game.scene.decide(true); });
// the warning: let go while the antennae are stiff and it doesn't spook; hold straight through the twitch and it does
{
  const at = await page.evaluate(() => { const s = Game.scene, den = s.dens.find((d) => d.kind === 'lobster' && d.state === 'in'); if (!den) return null; window.__d = den; den.lob.temper = 'skittish'; den.coax = 0; den.spooks = 0; den.nextTwitch = 0.4; den.tense = 0; den.twitch = 0;
    s.diver.x = den.x + den.dir * 52; s.diver.y = den.y; s.cam = Math.max(0, s.diver.x - Game.W * 0.45); s.camY = Math.max(0, Math.min(s.maxCamY(), s.diver.y - Game.H * 0.5)); return true; });
  if (at) {
    await page.waitForTimeout(300);
    const holeAt = () => page.evaluate(() => { const s = Game.scene, d = window.__d; return { x: d.x + d.dir * 6 - s.cam, y: d.y - s.camY }; });
    let h = await toCss(...Object.values(await holeAt())); await page.mouse.move(h.x, h.y); await page.mouse.down();
    let sawTense = false;
    for (let i = 0; i < 60; i++) { await page.waitForTimeout(25); if (await page.evaluate(() => window.__d.tense > 0)) { sawTense = true; break; } }
    await page.mouse.up(); await shot('let-go-on-warning');
    await page.waitForTimeout(900);   // the twitch comes and goes with the mouse up
    const calmLetGo = await page.evaluate(() => ({ spooks: window.__d.spooks, again: window.__d.again > 0 }));
    check(sawTense && calmLetGo.spooks === 0 && calmLetGo.again, 'the antennae warn before the twitch; letting go then is safe, and it asks you to hold again (' + JSON.stringify(calmLetGo) + ')');
    await page.evaluate(() => { window.__d.nextTwitch = 0.3; });
    h = await toCss(...Object.values(await holeAt())); await page.mouse.move(h.x, h.y); await page.mouse.down(); await page.waitForTimeout(1500); await page.mouse.up();
    check(await page.evaluate(() => window.__d.spooks >= 1), 'holding straight through the twitch spooks it');
  }
}
// end and results
await page.evaluate(() => { Game.scene.timeLeft = 0.05; }); await page.waitForTimeout(2600);
console.log('RESULT', JSON.stringify(await page.evaluate(() => window.__res && { total: window.__res.total, lines: window.__res.lines.map((l) => l.label + ' ' + l.pts) })));
// the deep reef
await start('alligator'); await page.waitForTimeout(300); await gotIt(); await page.waitForTimeout(1600);
await page.evaluate(() => { const s = Game.scene; s.diver.x = 1500; s.diver.y = 560; }); await page.waitForTimeout(1500); await shot('reef-deep');
await page.evaluate(() => { const s = Game.scene; s.diver.x = 900; s.diver.y = 300; }); await page.waitForTimeout(1200); await shot('reef-mid');
await page.evaluate(() => { const s = Game.scene; s.diver.x = s.goliath.x + 160; s.diver.y = s.goliath.y - 40; }); await page.waitForTimeout(1200); await shot('reef-goliath');
await page.evaluate(() => { const s = Game.scene; s.diver.x = 2400; s.diver.y = 400; s.startShark(); }); await page.waitForTimeout(1200); await shot('reef-shark');
console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'NO ERRORS');
await browser.close();
process.exitCode = errs.length ? 1 : 0;
