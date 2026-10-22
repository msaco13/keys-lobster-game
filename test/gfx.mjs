// The 3D view's safeguards, with made-up frame timings (headless Chromium can't tell us about a phone's speed):
// a slow device steps down and then falls back to the classic view, a 30 fps screen isn't mistaken for a slow one,
// a lost WebGL context falls back cleanly, and the pause menu's Graphics switch works both ways.
//   node test/gfx.mjs <repo root>
import { chromium } from 'playwright';
const root = process.argv[2];
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const fails = []; const check = (ok, what) => { console.log((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) fails.push(what); };
const open = async () => {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  const errs = []; page.on('pageerror', (e) => errs.push('PAGEERR ' + e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.addInitScript(() => { localStorage.clear(); localStorage.setItem('keyscrew_gfx', JSON.stringify('3d')); localStorage.setItem('keyscrew_gfxTier', JSON.stringify(2)); });
  await page.goto('file://' + root + '/index.html'); await page.waitForTimeout(700);
  await page.evaluate(() => { World.build(); Trip.start({ mode: 'crew', crew: ['michael', 'jorge', 'jemel'], plan: 'full', sessionLen: 120 }); Game.go(new SeaScene(), true); });
  await page.waitForFunction(() => GL.state === 'ready' && Sea3D.boatOf === Game.scene, null, { timeout: 30000 });
  // from here on, act like an ordinary player's 'auto' setting, and feed the tuner frames at a given rate
  await page.evaluate(() => { GFX.mode = 'auto'; window.feed = (fps, secs) => { const P = GL.perf; let t = (P.last || performance.now()) + 1; P.last = t; for (let i = 0; i < fps * secs; i++) { t += 1000 / fps; GL.tune(t, false); } return { tier: GFX.tier, state: GL.state, target: GL.perf.target }; }; });
  return { page, errs };
};
{ // a slow device: steps down, then hands over to the classic view and says so
  const { page, errs } = await open();
  const r1 = await page.evaluate(() => feed(40, 6));
  check(r1.tier < 2 && r1.state === 'ready', 'at 40 fps it steps down (tier ' + r1.tier + ')');
  const r2 = await page.evaluate(() => feed(12, 20));
  check(r2.state === 'failed', 'at 12 fps it gives up on 3D (' + r2.state + ')');
  const after = await page.evaluate(() => ({ mode: GFX.mode, stored: localStorage.getItem('keyscrew_gfx'), uses: Game.scene.uses3D(), toast: Game.toasts.map((t) => t.msg).join('|') }));
  check(after.mode === 'classic' && after.stored === '"classic"' && !after.uses, 'classic view, remembered (' + JSON.stringify(after) + ')');
  check(/Classic graphics/.test(after.toast), 'and it says so');
  await page.waitForTimeout(800);
  const drawn = await page.evaluate(() => { const c = document.getElementById('game').getContext('2d').getImageData(400, 300, 1, 1).data; return c[3]; });
  check(drawn === 255, 'the classic view is drawing (2D canvas opaque)');
  // the pause menu switch brings 3D back
  await page.evaluate(() => { Game.scene.panel = { kind: 'pause' }; }); await page.waitForTimeout(300);
  const lbl = await page.evaluate(() => GFX.label()); check(lbl === 'Graphics: classic', 'pause menu shows "' + lbl + '"');
  await page.evaluate(() => UI.byId('gfx').fn()); await page.evaluate(() => { Game.scene.panel = null; }); await page.waitForTimeout(1500);
  const back = await page.evaluate(() => ({ mode: GFX.mode, uses: Game.scene.uses3D(), tier: GFX.tier }));
  check(back.mode === 'auto' && back.uses, '3D again after flipping the switch (' + JSON.stringify(back) + ')');
  check(errs.length === 0, 'no errors ' + errs.join(' | '));
  await page.close();
}
{ // a screen capped at 30 fps (a phone in low-power mode): one step down doesn't help, so it goes back and settles
  const { page, errs } = await open();
  const r = await page.evaluate(() => feed(30, 12));
  check(r.state === 'ready' && r.tier === 2 && r.target < 30, '30 fps cap: stays 3D at its tier, target ' + r.target.toFixed(1));
  const r2 = await page.evaluate(() => feed(30, 20));
  check(r2.state === 'ready' && r2.tier === 2, 'and keeps it (tier ' + r2.tier + ')');
  check(errs.length === 0, 'no errors ' + errs.join(' | '));
  await page.close();
}
{ // a very slow device (2–3 frames a second): every gap between frames is long, and it still counts as slow
  const { page, errs } = await open();
  const r = await page.evaluate(() => feed(2.5, 30));
  check(r.state === 'failed', 'at 2.5 fps it gives up on 3D (' + r.state + ', tier ' + r.tier + ')');
  check(errs.length === 0, 'no errors ' + errs.join(' | '));
  await page.close();
}
{ // a hidden tab (switching apps) doesn't count against the device
  const { page } = await open();
  const r = await page.evaluate(() => { feed(60, 3); document.dispatchEvent(new Event('visibilitychange')); return { last: GL.perf.last, state: GL.state }; });
  check(r.last === 0 && r.state === 'ready', 'hiding the page restarts the count (' + JSON.stringify(r) + ')');
  await page.close();
}
{ // a fast device climbs a step
  const { page } = await open();
  const r = await page.evaluate(() => feed(60, 22));
  check(r.tier === 3, 'at a steady 60 it tries the top tier (tier ' + r.tier + ')');
  await page.close();
}
{ // the WebGL context gets lost (the browser reclaims the GPU): classic view, no crash
  const { page, errs } = await open();
  await page.evaluate(() => { window.lc = GL.r.getContext().getExtension('WEBGL_lose_context'); window.lc.loseContext(); }); await page.waitForTimeout(1200);
  const st = await page.evaluate(() => ({ state: GL.state, why: GL.why, uses: Game.scene.uses3D(), err: Game.error && String(Game.error) }));
  check(st.state === 'failed' && st.why === 'lost' && !st.uses && !st.err, 'context lost: classic view (' + JSON.stringify(st) + ')');
  // and when the browser gives it back, 3D picks up again
  await page.evaluate(() => window.lc.restoreContext()); await page.waitForTimeout(2500);
  const st2 = await page.evaluate(() => ({ state: GL.state, uses: Game.scene.uses3D(), shown: GL.cv.style.display, err: Game.error && String(Game.error) }));
  check(st2.state === 'ready' && st2.uses && st2.shown === 'block' && !st2.err, 'context restored: 3D again (' + JSON.stringify(st2) + ')');
  check(errs.filter((e) => !/CONTEXT_LOST|context lost/i.test(e)).length === 0, 'no errors ' + errs.join(' | '));
  await page.close();
}
{ // the same safeguards in a fish fight: a slow device hands the fight over to the 2D picture mid-fight, and it carries on
  const { page, errs } = await open();
  await page.evaluate(() => { Game.go(new TrollScene({ ch: 'jemel', spot: 'troll', len: 120, weather: Trip.cur.weather, onEnd: () => {} }), true); });
  await page.waitForTimeout(1200);
  await page.evaluate(() => Game.scene.startFight({ sp: 'mahi', weight: 30, ctxType: 'offshore' }));
  await page.waitForFunction(() => Game.scene.child && Game.scene.child.in3d && Fight3D.fight === Game.scene.child, null, { timeout: 30000 });
  check(await page.evaluate(() => Game.scene.uses3D()), 'the fight is drawn in 3D');
  const r = await page.evaluate(() => feed(12, 20));
  check(r.state === 'failed', 'at 12 fps mid-fight it gives up on 3D (' + r.state + ')');
  await page.waitForTimeout(800);
  const st = await page.evaluate(() => { const f = Game.scene.child, c = document.getElementById('game').getContext('2d').getImageData(400, 300, 1, 1).data; return { in3d: f.in3d, phase: f.phase, alpha: c[3], err: Game.error && String(Game.error) }; });
  check(!st.in3d && st.alpha === 255 && !st.err, 'the fight carries on in 2D (' + JSON.stringify(st) + ')');
  check(errs.length === 0, 'no errors ' + errs.join(' | '));
  await page.close();
}
{ // and a lost WebGL context in the middle of a fight
  const { page, errs } = await open();
  await page.evaluate(() => { Game.go(new BottomScene({ ch: 'jorge', spot: 'wreck', len: 120, weather: Trip.cur.weather, onEnd: () => {} }), true); });
  await page.waitForTimeout(1200);
  await page.evaluate(() => Game.scene.startFight({ sp: 'amberjack', weight: 40, ctxType: 'reef', depth: 100 }));
  await page.waitForFunction(() => Game.scene.child && Game.scene.child.in3d, null, { timeout: 30000 });
  await page.evaluate(() => GL.r.getContext().getExtension('WEBGL_lose_context').loseContext()); await page.waitForTimeout(1200);
  const st = await page.evaluate(() => ({ state: GL.state, in3d: Game.scene.child && Game.scene.child.in3d, err: Game.error && String(Game.error) }));
  check(st.state === 'failed' && !st.in3d && !st.err, 'context lost mid-fight: 2D fight (' + JSON.stringify(st) + ')');
  check(errs.filter((e) => !/CONTEXT_LOST|context lost/i.test(e)).length === 0, 'no errors ' + errs.join(' | '));
  await page.close();
}
console.log(fails.length ? 'FAILED: ' + fails.length : 'ALL PASS');
await browser.close();
process.exitCode = fails.length ? 1 : 0;
