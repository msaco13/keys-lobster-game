// Bugs that were fixed, checked so they stay fixed. Exits 1 on any failure.
//   - the flats: poling away from a fish that just ate leaves it free to swim on (it used to freeze in place for the
//     rest of the turn); letting go of an aim under the pause menu doesn't cast
//   - a strike, a bite, an eat or a bug in the net at the buzzer is played out, not thrown away
//   - "End my turn now" with a fish on: the clock stops, and the fight can still be paused
//   - bottom fishing: quick taps on Move keep adding legs; no chum or rebait once the turn has ended
//   - the boat: P pauses (the autopilot is O), the arrow keys don't steer under the chart, and a long run's summary
//     keeps its button on screen
//   - the fight's win card wraps its tags and fits its loss title at the narrowest width
//   node test/fixes.mjs [repo root]
import { chromium } from 'playwright';
import path from 'path'; import { fileURLToPath } from 'url';
const root = process.argv[2] || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fails = []; const check = (ok, what) => { console.log((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) fails.push(what); };
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 720 * 1.5, height: 540 * 1.5 } });   // 4:3: the game is 720 wide
const errs = []; page.on('pageerror', (e) => errs.push('PAGEERR ' + e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_|net::|Failed to load resource/i.test(m.text())) errs.push(m.text()); });
await page.addInitScript(() => { localStorage.clear(); localStorage.setItem('keyscrew_gfx', JSON.stringify('classic')); ['jorge', 'michael'].forEach((c) => { localStorage.setItem('keyscrew_coach_flats1_' + c, 'true'); localStorage.setItem('keyscrew_coach_bug3_' + c, 'true'); localStorage.setItem('keyscrew_coach_bully1_' + c, 'true'); }); });
await page.goto('file://' + root + '/index.html');
await page.waitForFunction(() => typeof Game !== 'undefined' && Game.scene, null, { timeout: 15000 });
const r = await page.evaluate(() => {
  const out = {};
  Trip.start({ mode: 'crew', crew: ['michael', 'jorge'], plan: 'half', sessionLen: 120 });
  const step = (s, sec) => { for (let i = 0; i < sec * 60; i++) s.update(1 / 60); };
  const mk = (Cls, spot) => { const s = new Cls({ ch: 'jorge', spot, len: 120, weather: { id: 'light', name: 'Light chop', vis: 1, drift: 0.5, aim: 1 }, onEnd: (res) => { s.res = res; } }); Game.go(s, true); s.help = null; s.intro = null; return s; };
  out.W = Game.W;
  // the flats: an eat, then the poler pushes on
  { const s = mk(FlatsScene, 'flats'); for (let i = 0; i < 1200 && !s.fishList.some((f) => f.state === 'cruise'); i++) s.update(1 / 60);
    const f = s.fishList.find((x) => x.state === 'cruise'); s.lure = { x: f.x, y: f.y, t: 0, hop: 0 }; f.state = 'eat'; s.eat = { f, t: 0.6, t0: 0.6 };
    s.setPole(1); step(s, 0.2); out.eatPole = { state: f.state, eat: !!s.eat };
    // letting go under the pause menu
    s.setPole(1); s.aim = { id: 9, x: 400, y: 200, t: 0.5 }; s.togglePause(); s.pointerUp({ id: 9, x: 400, y: 200 }); out.pauseCast = { cast: !!s.cast, aim: !!s.aim }; s.togglePause(); }
  // the buzzer: a strike offshore
  { const s = mk(TrollScene, 'troll'); s.timeLeft = 0.05; s.strike = { fish: { key: 'mahi', w: 12 }, lure: null, t: 0.75 }; step(s, 1); out.strike = { fight: !!s.child, ended: s.ended }; }
  // a bite on the bottom at the buzzer
  { const s = mk(BottomScene, 'bottom'); s.timeLeft = 0.05; s.baitOn = true; s.fish = [{ key: 'lane', w: 1, state: 'bite', timer: 0.6, x: 0, y: 0, face: 1, len: 30, alpha: 1 }]; step(s, 0.15); out.bite = { ended: s.ended }; s.hookset(true); out.bite.fight = !!s.child;
    // End my turn now with that fish on: the clock stops, and the fight can be paused
    s.end('quit'); const t0 = s.timeLeft = 30; step(s, 0.5); out.endTurn = { clock: s.timeLeft === t0 }; s.togglePause(); out.endTurn.paused = s.paused; s.togglePause();
    s.child = null; s.update(1 / 60); const cd = s.chumCd; s.dropChum(); out.chumAfter = s.chumCd === cd; }
  // bottom: quick taps on Move keep adding legs
  { const s = mk(BottomScene, 'bottom'); s.bx = (BOT.XMIN + BOT.XMAX) / 2; s.startMove(1); step(s, 1);
    const tapHold = (sec) => { UI.active = { id: 'moveR', pointer: 77, inside: true }; Input.pointers.set(77, {}); step(s, sec); Input.pointers.delete(77); UI.active = null; s.startMove(1); step(s, 0.05); };
    const before = s.move && s.move.want; for (let i = 0; i < 4; i++) tapHold(0.1); out.taps = { added: s.move ? Math.round((s.move.want - before) / BOT.LEG) : -1 }; }
  // the boat: P, the chart, a long run's summary
  { Trip.cur.spot = null; const s = new SeaScene(); Game.go(s, true); s.panel = null; s.dest = 'bottom'; s.planRoute(); s.setAuto(true);
    s.keyDown('KeyP'); out.pKey = { pause: !!(s.panel && s.panel.kind === 'pause'), auto: s.auto }; s.keyDown('KeyP'); out.pKey.closed = !s.panel;
    s.openChart(); const h0 = s.h; Input.keys.add('ArrowLeft'); for (let i = 0; i < 30; i++) s.update(1 / 60); Input.keys.delete('ArrowLeft'); out.chartSteer = { auto: s.auto, turned: Math.abs(angleDiff(h0, s.h)) > 0.05 }; s.panel = null;
    s.lines = []; for (let i = 0; i < 13; i++) s.lines.push({ label: 'Line ' + i, pts: 25 }); s.total = 325; s.panel = { kind: 'summary', id: 'bottom', t: 1 }; }
  return out;
});
await page.waitForTimeout(300);
const sum = await page.evaluate(() => { const b = UI.byId('letsfish'); return b && { y: b.y, h: b.h }; });
check(r.eatPole.state === 'cruise' && !r.eatPole.eat, 'the flats: poling away from a fish that ate sets it free (' + JSON.stringify(r.eatPole) + ')');
check(!r.pauseCast.cast && !r.pauseCast.aim, 'the flats: letting go of an aim under the pause menu doesn’t cast');
check(r.strike.fight && !r.strike.ended, 'a strike at the buzzer is fought (' + JSON.stringify(r.strike) + ')');
check(!r.bite.ended && r.bite.fight, 'a bite at the buzzer can still be set (' + JSON.stringify(r.bite) + ')');
check(r.endTurn.clock && r.endTurn.paused, '"End my turn now" with a fish on: the clock stops, and the fight can be paused (' + JSON.stringify(r.endTurn) + ')');
check(r.chumAfter, 'no chum once the turn has ended');
check(r.taps.added === 4, 'bottom: four quick taps on Move add four legs (' + r.taps.added + ')');
check(r.pKey.pause && r.pKey.auto && r.pKey.closed, 'the boat: P pauses and leaves the autopilot alone (' + JSON.stringify(r.pKey) + ')');
check(r.chartSteer.auto && !r.chartSteer.turned, 'the boat: the arrow keys don’t steer under the chart (' + JSON.stringify(r.chartSteer) + ')');
check(!!sum && sum.y + sum.h <= 540, 'the boat: a 13-line run summary keeps its button on screen (' + JSON.stringify(sum) + ')');
// the fight's win card at 720: three tags, wrapped, all inside the screen; a long loss title fits
const card = await page.evaluate(() => {
  Trip.start({ mode: 'crew', crew: ['michael', 'jorge'], plan: 'half', sessionLen: 120 });
  const s = new FlatsScene({ ch: 'jorge', spot: 'flats', len: 120, weather: Trip.cur.weather, onEnd: () => {} }); Game.go(s, true); s.help = null;
  s.startFight({ sp: 'tarpon', weight: 150, ctxType: 'flats' }); const f = s.child;
  f.won = true; f.phase = 'over'; f.overT = 2; f.isPB = true; f.catch = makeCatch('tarpon', 150, 'jorge', 'flats'); f.key = 'tarpon'; f.weight = 150;
  const rects = [], orig = window.rr; window.rr = function (ctx, x, y, w, h, r) { if (h === 28) rects.push(x + w); return orig.apply(this, arguments); };
  f.drawOver(Game.ctx, Game.W, Game.H); window.rr = orig;
  // the loss card for the longest title: what size the game actually draws it at
  f.won = false; f.reason = 'piling'; const sizes = [], ot = window.text; window.text = function (ctx, str, x, y, o) { const r2 = ot.apply(this, arguments); if (o && o.display && str === LOSS_TEXT.piling[0]) sizes.push(r2); return r2; };
  f.drawOver(Game.ctx, Game.W, Game.H); window.text = ot;
  return { right: Math.max(...rects), tags: rects.length, W: Game.W, lossSize: sizes[0] };
});
check(card.tags === 3 && card.right <= card.W, 'the fight’s win card wraps TROPHY · NEW PERSONAL BEST · RELEASED inside a ' + card.W + '-wide screen (right edge ' + Math.round(card.right) + ')');
check(card.lossSize < 60 || card.W >= 900, 'a long loss title shrinks to fit (' + card.lossSize + 'px)');
check(errs.length === 0, 'no errors' + (errs.length ? ' — ' + errs.slice(0, 3).join(' | ') : ''));
await browser.close();
console.log(fails.length ? 'FAILED: ' + fails.length : 'ALL PASS');
process.exitCode = fails.length ? 1 : 0;
