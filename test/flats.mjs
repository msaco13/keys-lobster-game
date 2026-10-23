// Flats mode check: screenshots of each spot (720/960/1280 wide, both ends of each flat, glass and breezy),
// a phone-sized touch run (pole, cast, strip, hook, pause, end of turn, frame cost), and a catch-rate bot
// that only throws at fish it can see or the poler calls, poles toward his calls, and plays the fights.
// usage: node test/flats.mjs <repoRoot> <outDir> [shots|sim|e2e|all] [runs]
//        PROFILE=sharp|decent|casual picks the bot (default decent); VERBOSE=1 prints every catch.
import { chromium } from 'playwright';
import fs from 'fs';
const root = process.argv[2] || process.cwd();
const out = process.argv[3] || root + '/test/shots';
const what = process.argv[4] || 'all';
const RUNS = +(process.argv[5] || 4);
fs.mkdirSync(out, { recursive: true });
const SPOTS = ['flats', 'bridge', 'flamingo'];
const browser = await chromium.launch();
const errs = [];

async function open(w, h) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await page.goto('file://' + root + '/index.html'); await page.waitForTimeout(900);
  return page;
}
// fresh: a first visit (the how-to card opens, and the coaching is on until a first hook); otherwise an angler who
// has seen it all, so the screenshots and the catch-rate bot measure the game as it plays after that
async function startSpot(page, spot, weatherId, fresh = false) {
  await page.evaluate(([spot, wid, fresh]) => {
    Store.set('coach_flats1_michael', !fresh); Store.set('coach_flatset_michael', !fresh);
    Trip.start({ mode: 'solo', crew: ['michael'], plan: 'solo', sessionLen: 120 });
    if (wid === 'glass') Trip.cur.weather = { id: 'glass', name: 'Glass calm', wind: '0–5 kts', vis: 1.25, drift: 0, aim: 0.75, tag: '#Glass' };
    if (wid === 'light') Trip.cur.weather = { id: 'light', name: 'Light chop', wind: '5–10 kts', vis: 1, drift: 0.5, aim: 1 };
    if (wid === 'breezy') Trip.cur.weather = { id: 'breezy', name: 'Breezy', wind: '15–20 kts', vis: 0.8, drift: 1, aim: 1.35 };
    window.__res = null;
    Game.go(new FlatsScene({ ch: 'michael', spot, len: 120, weather: Trip.cur.weather, onEnd: (r) => { window.__res = r; } }), true);
  }, [spot, weatherId, fresh]);
}

if (what === 'shots' || what === 'all') {
  for (const [w, h] of [[960, 540], [720, 540], [1280, 540]]) {
    const page = await open(w, h);
    for (const spot of SPOTS) {
      await startSpot(page, spot, 'light');
      await page.waitForTimeout(400);
      // fast-forward so fish are on the water, then let it render a frame
      await page.evaluate(() => { const s = Game.scene; for (let i = 0; i < 60 * 14; i++) s.update(1 / 60); Game.toasts = []; });
      await page.waitForTimeout(250);
      await page.screenshot({ path: `${out}/${spot}-${w}.png` });
      if (w === 960) {
        // aiming
        await page.mouse.move(w * 0.62, 230); await page.mouse.down(); await page.waitForTimeout(650);
        await page.screenshot({ path: `${out}/${spot}-${w}-aim.png` });
        await page.mouse.up(); await page.waitForTimeout(1100);
        await page.screenshot({ path: `${out}/${spot}-${w}-cast.png` });
        // show every fish clearly for an art check
        await page.evaluate(() => { const s = Game.scene; s.vis = () => 1; Game.toasts = []; });
        await page.waitForTimeout(200);
        await page.screenshot({ path: `${out}/${spot}-${w}-reveal.png` });
        await page.evaluate(() => { delete Game.scene.vis; });
      }
    }
    await page.close();
  }
  // both ends of each flat: what you find when you pole down it
  {
    const page = await open(960, 540);
    for (const spot of SPOTS) for (const end of ['left', 'right']) {
      await startSpot(page, spot, 'light'); await page.waitForTimeout(200);
      await page.evaluate((end) => { const s = Game.scene; s.bx = end === 'left' ? 0 : 1e9; s.clampCam(); for (let i = 0; i < 60 * 12; i++) s.update(1 / 60); s.vis = () => 1; Game.toasts = []; }, end);
      await page.waitForTimeout(200);
      await page.screenshot({ path: `${out}/${spot}-end-${end}.png` });
    }
    await page.close();
  }
  // glass calm, light and breezy on the bay at 960
  const page = await open(960, 540);
  for (const wid of ['glass', 'breezy']) {
    await startSpot(page, 'flats', wid); await page.waitForTimeout(300);
    await page.evaluate(() => { const s = Game.scene; for (let i = 0; i < 60 * 16; i++) s.update(1 / 60); Game.toasts = []; });
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${out}/flats-960-${wid}.png` });
  }
  // the fight still works from each spot
  await startSpot(page, 'bridge', 'light'); await page.waitForTimeout(300);
  await page.evaluate(() => { const s = Game.scene; s.startFight({ sp: 'tarpon', weight: 110, ctxType: 'flats', rock: 0 }); s.child.revealed = true; s.child.dist = 30; });
  await page.waitForTimeout(500); await page.screenshot({ path: `${out}/fight-bridge.png` });
  const ge = await page.evaluate(() => (Game.error ? String(Game.error.stack || Game.error) : null));
  if (ge) errs.push('Game.error: ' + ge);
  await page.close();
  console.log('shots written to', out);
}

if (what === 'sim' || what === 'all') {
  const page = await open(960, 540);
  const res = await page.evaluate(async ([SPOTS, RUNS, PROFILE]) => {
    const dt = 1 / 30;
    const W = { glass: { id: 'glass', name: 'Glass calm', vis: 1.25, drift: 0, aim: 0.75 }, light: { id: 'light', name: 'Light chop', vis: 1, drift: 0.5, aim: 1 }, breezy: { id: 'breezy', name: 'Breezy', vis: 0.8, drift: 1, aim: 1.35 } };
    // the fight is played for real (the session clock keeps running), by a decent fight bot
    function fightStep(fs, st) {
      if (fs.phase === 'turn') { st.hold = true; st.tap += dt; if (st.tap > 1 / 6) { st.tap = 0; fs.tap(); } return; }
      if (fs.tele && st.tele < 0) st.tele = st.t; if (!fs.tele && !fs.running) st.tele = -1;
      if (fs.running && st.run < 0) st.run = st.t; if (!fs.running) st.run = -1;
      const L = fs.perks.line;
      st.hold = !((st.tele >= 0 && st.t - st.tele > 0.25) || (st.run >= 0 && st.t - st.run > 0.18) || fs.jumpT > 0 || fs.T > 0.82 * L);
    }
    const out = {}, why = {};
    for (const spot of SPOTS) for (const wid of ['glass', 'light', 'breezy']) {
      const rows = [];
      for (let run = 0; run < RUNS; run++) {
        const log = []; let ended = null, casts = 0, spooks = 0, spawned = 0, fights = 0, fightT = 0, poled = 0, refusals = 0;
        const s = new FlatsScene({ ch: 'michael', spot, len: 120, weather: W[wid], onEnd: (r) => { ended = r; } });
        Game.scene = s; s.enter();
        const sf = s.spawnFish.bind(s); s.spawnFish = (...a) => { spawned++; return sf(...a); };
        const sp0 = s.spookFish.bind(s); s.spookFish = (f, m) => { if (f.state !== 'spooked') { spooks++; const k = (m || 'silent') + (f.lead ? ' [school]' : ''); why[k] = (why[k] || 0) + 1; } return sp0(f, m); };
        let stripT = 0, nextStrip = 0, seenAt = new Map(), target = null, idleT = 0, fst = null, castWait = 0, huntT = 0, visT = 0, firstSeen = -1;
        const CASUAL = PROFILE === 'casual', SK = PROFILE === 'sharp';
        for (let i = 0; i < 120 / dt + 600 && !ended; i++) {
          if (s.child) {
            const fs = s.child;
            if (!fst) { fst = { t: 0, tap: 0, tele: -1, run: -1, hold: true }; fs.holding = () => fst.hold; fights++; }
            fst.t += dt; fightT += dt;
            if (fs.phase === 'over') { if (fs.overT > 1.4) { if (fs.won) log.push(fs.key + ' ' + fs.weight); else log.push('(lost ' + fs.key + ': ' + fs.reason + ')'); fs.finish(); } }
            else if (fs.phase !== 'landing') fightStep(fs, fst);
            s.update(dt); continue;
          }
          fst = null;
          if (s.eat && s.eat.t < s.eat.t0 - (SK ? 0.22 : CASUAL ? 0.4 : 0.32)) s.setHook();
          const fol = s.fishList.find((f) => f.state === 'follow');
          if (fol) {
            stripT += dt;
            if (stripT > nextStrip) { stripT = 0; nextStrip = fol.sp.strip * (SK ? (0.9 + Math.random() * 0.35) : CASUAL ? (0.6 + Math.random() * 1.1) : (0.75 + Math.random() * 0.7)); s.strip(); }
          } else if (!s.cast && s.snagT <= 0 && (!s.lure || s.lure.t > 2.6)) {
            // a decent player: notices a fish after ~0.8 s if it shows (or the poler calls it), then leads it
            const cam = s.camX;
            const cand = s.fishList.filter((f) => f.state === 'cruise' && !f.leaving && f.x - cam > 30 && f.x - cam < Game.W - 30 && f.y < Game.H - 150 && (f.called || s.signal(f) > (CASUAL ? 0.5 : 0.32)));
            huntT += dt; if (cand.length) { visT += dt; if (firstSeen < 0) firstSeen = s.t; }
            for (const f of cand) if (!seenAt.has(f)) seenAt.set(f, s.t);
            const tg = cand.filter((f) => s.t - seenAt.get(f) > (CASUAL ? 1.6 : 0.8)).sort((a, b) => dist(a.x, a.y, s.bx, 470) - dist(b.x, b.y, s.bx, 470))[0];
            if (tg) {
              castWait += dt;
              if (castWait > 0.25) {
                castWait = 0;
                const still = tg.brain === 'hold' || tg.brain === 'tail';
                const lead = CASUAL ? tg.len * 0.4 + 55 : tg.len * 0.4 + tg.sp.spook + (still ? 26 : 34 + tg.speed * 0.9);
                let tx = tg.x + Math.cos(tg.hd) * lead, ty = tg.y + Math.sin(tg.hd) * lead;
                const c = s.current(tx, ty); if (!CASUAL) { tx -= c.x * 1.6; ty -= c.y * 1.6; }   // cast up-current of it
                const e = SK ? 10 : CASUAL ? 60 : 30; tx += (Math.random() - 0.5) * e; ty += (Math.random() - 0.5) * e;
                if (s.lure) s.pickUp(); casts++; s.doCast({ x: tx, y: ty, t: SK ? 1.1 : CASUAL ? 0.45 : 0.7 }); idleT = 0;
              }
            } else {
              // nothing to throw at: follow the poler's pointer, or pole down the flat when it's dead
              idleT += dt;
              const far = s.pointTo && s.pointTo.f;
              if (far) { const want = far.x < s.bx ? -1 : 1; if (s.poleDir !== want) { s.setPole(want); poled++; } }
              else if (idleT > 9 && s.poleDir === 0) { s.setPole(s.bx < s.WW / 2 ? 1 : -1); poled++; idleT = 0; }
              else if (s.poleDir && idleT > 6) { s.poleDir = 0; idleT = 0; }
            }
          }
          s.update(dt);
        }
        rows.push({ n: log.filter((l) => l[0] !== '(').length, casts, spooks, spawned, fights, fightT: Math.round(fightT), poled, vis: visT / Math.max(1, huntT), first: firstSeen, log: log.join(', ') });
      }
      out[spot + '/' + wid] = rows;
    }
    out.__why = why;
    return out;
  }, [SPOTS, RUNS, process.env.PROFILE || 'decent']);
  const why = res.__why; delete res.__why;
  let all = 0, cnt = 0;
  for (const [k, rows] of Object.entries(res)) {
    const avg = rows.reduce((a, r) => a + r.n, 0) / rows.length; all += avg; cnt++;
    const vf = rows.reduce((a, r) => a + r.vis, 0) / rows.length, fs = rows.reduce((a, r) => a + r.first, 0) / rows.length;
    console.log(k.padEnd(18), 'avg landed', avg.toFixed(2), `| fish showing ${(vf * 100).toFixed(0)}% of hunt time, first at ${fs.toFixed(1)}s |`, rows.map((r) => `${r.n} (${r.casts}c ${r.fights}f ${r.spooks}sp ${r.spawned}sw ${r.poled}p ${r.fightT}s)`).join('  '));
    if (process.env.VERBOSE) for (const r of rows) console.log('   ', r.log);
  }
  console.log('overall avg landed per 2-min turn:', (all / cnt).toFixed(2));
  console.log('spooks by reason:', JSON.stringify(why));
  const ge = await page.evaluate(() => (Game.error ? String(Game.error.stack || Game.error) : null));
  if (ge) errs.push('Game.error: ' + ge);
  await page.close();
}
if (what === 'e2e' || what === 'all') {
  // a phone in landscape: touch, 2x pixels, real taps on the scene and on the pole buttons
  const ctxB = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctxB.newPage();
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('file://' + root + '/index.html'); await page.waitForTimeout(900);
  const toScreen = (x, y) => page.evaluate(([x, y]) => ({ x: Game.ox + x * Game.scale, y: Game.oy + y * Game.scale }), [x, y]);
  const tapBtn = async (id) => { const r = await page.evaluate((id) => { const r = UI.byId(id); return r && !r.disabled ? { x: Game.ox + (r.x + r.w / 2) * Game.scale, y: Game.oy + (r.y + r.h / 2) * Game.scale } : null; }, id); if (!r) { errs.push('no button ' + id); return; } await page.touchscreen.tap(r.x, r.y); await page.waitForTimeout(200); };
  const check = (label, ok, extra = '') => { console.log((ok ? 'ok   ' : 'FAIL ') + label, extra); if (!ok) errs.push('e2e: ' + label + ' ' + extra); };
  for (const spot of ['flats', 'bridge', 'flamingo']) {
    await startSpot(page, spot, 'light', spot === 'flats'); await page.waitForTimeout(500);
    if (spot === 'flats') {   // a first visit: how to catch one opens and the clock waits; Got it, like a player
      const card = await page.evaluate(() => ({ help: !!Game.scene.help, left: Game.scene.timeLeft, coach: Game.scene.coach }));
      await tapBtn('help-ok');
      check(spot + ' first visit opens how to catch one, the clock waits, and Got it closes it', card.help && card.left >= 119.9 && card.coach && !(await page.evaluate(() => !!Game.scene.help)), JSON.stringify(card));
    }
    const W = await page.evaluate(() => Game.W);
    const bx0 = await page.evaluate(() => Game.scene.bx);
    await tapBtn('poleR'); await page.waitForTimeout(1200);
    const st1 = await page.evaluate(() => ({ dir: Game.scene.poleDir, bx: Game.scene.bx }));
    check(spot + ' pole right moves the skiff', st1.dir === 1 && st1.bx > bx0 + 20, JSON.stringify(st1));
    await tapBtn('poleR'); await page.waitForTimeout(600);
    check(spot + ' tapping again stops', await page.evaluate(() => Game.scene.poleDir === 0));
    // press and hold out in the water, then release: a cast
    const p = await toScreen(W * 0.55, 250);
    const cdp = await ctxB.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y }] });
    await page.waitForTimeout(700);
    const aiming = await page.evaluate(() => !!Game.scene.aim);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(1300);
    const lure = await page.evaluate(() => Game.scene.lure && { x: Game.scene.lure.x, y: Game.scene.lure.y });
    check(spot + ' hold aims, release casts', aiming && !!lure, JSON.stringify(lure));
    if (lure) {
      await page.touchscreen.tap(p.x, p.y + 30); await page.waitForTimeout(150);
      const l2 = await page.evaluate(() => Game.scene.lure && { x: Game.scene.lure.x, y: Game.scene.lure.y, hop: Game.scene.lure.hop });
      check(spot + ' tap strips', !!l2 && (l2.hop > 0 || Math.abs(l2.y - lure.y) > 5), JSON.stringify(l2));
    }
    // an eat, then a tap sets the hook and starts the fight
    await page.evaluate(() => { const s = Game.scene; const f = s.spawnFish(true); f.alpha = 1; s.lure = s.lure || { x: f.x + 20, y: f.y, t: 0, hop: 0 }; f.state = 'eat'; s.eat = { f, t: 5, t0: 5 }; });
    await page.touchscreen.tap(p.x, p.y); await page.waitForTimeout(400);
    check(spot + ' tap sets the hook', await page.evaluate(() => !!Game.scene.child && Game.scene.child.constructor.name === 'FightScene'));
    await page.screenshot({ path: `${out}/e2e-${spot}-fight.png` });
    await page.evaluate(() => { const fs = Game.scene.child; fs.toOver(); fs.finish(); });
    await page.waitForTimeout(300);
    await tapBtn('pause'); check(spot + ' pause', await page.evaluate(() => Game.scene.paused));
    await page.screenshot({ path: `${out}/e2e-${spot}-pause.png` });
    await tapBtn('resume'); check(spot + ' resume', await page.evaluate(() => !Game.scene.paused));
    await page.evaluate(() => { Game.scene.timeLeft = 0.2; });
    await page.waitForTimeout(2600);
    const r = await page.evaluate(() => window.__res && { n: window.__res.catches.length, total: window.__res.total });
    check(spot + ' turn ends with a result', !!r && r.n === 1, JSON.stringify(r));
    // frame cost on this phone-sized canvas (software rendering here, so read it as relative)
    await startSpot(page, spot, 'breezy'); await page.waitForTimeout(300);
    const ms = await page.evaluate(() => { const s = Game.scene; for (let i = 0; i < 600; i++) s.update(1 / 60); Game.toasts = []; const t0 = performance.now(); for (let i = 0; i < 120; i++) { s.update(1 / 60); Game.draw(1 / 60); } return (performance.now() - t0) / 120; });
    console.log(`     ${spot}: update+draw ${ms.toFixed(2)} ms/frame at ${await page.evaluate(() => Game.canvas.width + 'x' + Game.canvas.height)}`);
    const ge = await page.evaluate(() => (Game.error ? String(Game.error.stack || Game.error) : null));
    if (ge) errs.push('Game.error: ' + ge);
  }
  await ctxB.close();
}
console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no errors');
await browser.close();
process.exitCode = errs.length ? 1 : 0;
