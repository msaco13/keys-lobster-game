// Flats mode check: screenshots of each spot at two widths, error check, and a catch-rate bot.
// usage: node test/flats.mjs <repoRoot> <outDir> [shots|sim|all] [runs]
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
async function startSpot(page, spot, weatherId) {
  await page.evaluate(([spot, wid]) => {
    Trip.start({ mode: 'solo', crew: ['michael'], plan: 'solo', sessionLen: 120 });
    if (wid === 'glass') Trip.cur.weather = { id: 'glass', name: 'Glass calm', wind: '0–5 kts', vis: 1.25, drift: 0, aim: 0.75, tag: '#Glass' };
    if (wid === 'light') Trip.cur.weather = { id: 'light', name: 'Light chop', wind: '5–10 kts', vis: 1, drift: 0.5, aim: 1 };
    if (wid === 'breezy') Trip.cur.weather = { id: 'breezy', name: 'Breezy', wind: '15–20 kts', vis: 0.8, drift: 1, aim: 1.35 };
    window.__res = null;
    Game.go(new FlatsScene({ ch: 'michael', spot, len: 120, weather: Trip.cur.weather, onEnd: (r) => { window.__res = r; } }), true);
  }, [spot, weatherId]);
}

if (what === 'shots' || what === 'all') {
  for (const [w, h] of [[960, 540], [720, 540], [1280, 540]]) {
    const page = await open(w, h);
    for (const spot of SPOTS) {
      await startSpot(page, spot, 'light');
      await page.waitForTimeout(400);
      // fast-forward so fish are on the water, then let it render a frame
      await page.evaluate(() => { const s = Game.scene; for (let i = 0; i < 60 * 14; i++) s.update(1 / 60); });
      await page.waitForTimeout(250);
      await page.screenshot({ path: `${out}/${spot}-${w}.png` });
      if (w === 960) {
        // aiming
        await page.mouse.move(w * 0.62, 230); await page.mouse.down(); await page.waitForTimeout(650);
        await page.screenshot({ path: `${out}/${spot}-${w}-aim.png` });
        await page.mouse.up(); await page.waitForTimeout(1100);
        await page.screenshot({ path: `${out}/${spot}-${w}-cast.png` });
        // show every fish clearly for an art check
        await page.evaluate(() => { const s = Game.scene; s.__debugReveal = true; });
        await page.waitForTimeout(200);
        await page.screenshot({ path: `${out}/${spot}-${w}-reveal.png` });
        await page.evaluate(() => { Game.scene.__debugReveal = false; });
      }
    }
    await page.close();
  }
  // glass calm, light and breezy on the bay at 960
  const page = await open(960, 540);
  for (const wid of ['glass', 'breezy']) {
    await startSpot(page, 'flats', wid); await page.waitForTimeout(300);
    await page.evaluate(() => { const s = Game.scene; for (let i = 0; i < 60 * 16; i++) s.update(1 / 60); });
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
  const res = await page.evaluate(async ([SPOTS, RUNS]) => {
    const dt = 1 / 30;
    const W = { glass: { id: 'glass', name: 'Glass calm', vis: 1.25, drift: 0, aim: 0.75 }, light: { id: 'light', name: 'Light chop', vis: 1, drift: 0.5, aim: 1 }, breezy: { id: 'breezy', name: 'Breezy', vis: 0.8, drift: 1, aim: 1.35 } };
    // a fight takes ~15–25 s of turn time; resolve it at once and charge the clock
    const finishChild = (s, log) => {
      if (!s.child) return;
      const f = s.child; s.timeLeft = Math.max(0.01, s.timeLeft - 18);
      if (Math.random() < 0.8) { log.push(f.key + ' ' + f.weight); f.toOver(); } else { f.lose('slack'); log.push('(lost ' + f.key + ')'); }
      f.finish();
    };
    const out = {};
    for (const spot of SPOTS) for (const wid of ['glass', 'light', 'breezy']) {
      const rows = [];
      for (let run = 0; run < RUNS; run++) {
        const log = []; let ended = null, casts = 0, spooks = 0, seenAt = new Map(), spawned = 0;
        const s = new FlatsScene({ ch: 'michael', spot, len: 120, weather: W[wid], onEnd: (r) => { ended = r; } });
        Game.scene = s; s.enter();
        const sf = s.spawnFish.bind(s); s.spawnFish = (...a) => { spawned++; return sf(...a); };
        const sp0 = s.spookFish.bind(s); s.spookFish = (f, m) => { if (f.state !== 'spooked') spooks++; return sp0(f, m); };
        let stripT = 0, reactT = 0;
        for (let i = 0; i < 120 / dt + 300 && !ended; i++) {
          if (s.eat && s.eat.t < s.eat.t0 - 0.18) s.setHook();
          const fol = s.fishList.find((f) => f.state === 'follow');
          if (fol) { stripT += dt; if (stripT > fol.sp.strip * 1.05) { stripT = 0; s.strip(); } }
          else if (!s.cast && (!s.lure || s.lure.t > 2.2)) {
            // the "decent player": only casts at fish it can actually see on screen, after a human reaction delay
            const vis = s.fishList.filter((f) => f.state === 'cruise' && s.vis(f) > 0.3 && f.x > 30 && f.x < Game.W - 30 && f.y > 90 && f.y < Game.H - 150);
            for (const f of vis) if (!seenAt.has(f)) seenAt.set(f, s.t);
            const tg = vis.find((f) => s.t - seenAt.get(f) > 0.8);
            if (tg) {
              const lead = tg.len * 0.4 + tg.sp.spook + 34 + tg.speed * 0.9;
              let tx = tg.x + Math.cos(tg.hd) * lead, ty = tg.y + Math.sin(tg.hd) * lead;
              const c = s.current ? s.current(tx, ty) : { x: 0, y: 0 }; tx -= c.x * 1.2; ty -= c.y * 1.2;
              s.pickUp(); casts++; s.doCast({ x: tx, y: ty, t: 1.2 });
            }
          }
          s.update(dt); finishChild(s, log);
        }
        rows.push({ n: log.filter((l) => l[0] !== '(').length, casts, spooks, spawned, log: log.join(', ') });
      }
      out[spot + '/' + wid] = rows;
    }
    return out;
  }, [SPOTS, RUNS]);
  for (const [k, rows] of Object.entries(res)) {
    const avg = rows.reduce((a, r) => a + r.n, 0) / rows.length;
    console.log(k.padEnd(18), 'avg landed', avg.toFixed(2), '|', rows.map((r) => `${r.n} (${r.casts}c ${r.spooks}sp ${r.spawned}sw)`).join('  '));
    for (const r of rows) console.log('   ', r.log);
  }
  const ge = await page.evaluate(() => (Game.error ? String(Game.error.stack || Game.error) : null));
  if (ge) errs.push('Game.error: ' + ge);
  await page.close();
}
console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no errors');
await browser.close();
