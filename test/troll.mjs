// Trolling (The Weedline + The Hump): screenshots and a strike-rate sim.
// node test/troll.mjs <repoRoot> <outDir> [shots|sim|all] [runs]
import { chromium } from 'playwright';
import fs from 'fs';
const root = process.argv[2] || process.cwd();
const out = process.argv[3] || '/tmp/troll';
const what = process.argv[4] || 'all';
const RUNS = +(process.argv[5] || 8);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const errs = [];

async function open(w, h) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('console ' + m.text()); });
  await page.goto('file://' + root + '/index.html'); await page.waitForTimeout(1200);
  return page;
}
async function gameErr(page, tag) { const e = await page.evaluate(() => (Game.error ? String(Game.error.stack || Game.error) : null)); if (e) { errs.push(tag + ': ' + e); await page.evaluate(() => { Game.error = null; }); } }
async function start(page, spot, weather) {
  await page.evaluate(([spot, weather]) => {
    Trip.start({ mode: 'solo', crew: ['jemel'], plan: 'solo', sessionLen: 120 });
    if (weather) Trip.cur.weather = { glass: { id: 'glass', name: 'Glass calm', wind: '0–5 kts', vis: 1.25, drift: 0, aim: 0.75, tag: '#Glass' }, light: { id: 'light', name: 'Light chop', vis: 1, drift: 0.5, aim: 1 }, breezy: { id: 'breezy', name: 'Breezy', vis: 0.8, drift: 1, aim: 1.35 } }[weather];
    window.__res = null;
    const sc = new TrollScene({ ch: 'jemel', spot, len: 120, weather: Trip.cur.weather, onEnd: (r) => { window.__res = r; } });
    if (window.__noStrike) sc.doStrike = () => {};
    Game.go(sc, true);
  }, [spot, weather]);
}

if (what === 'shots' || what === 'all') {
  for (const [w, h] of [[960, 540], [720, 540]]) {
    const page = await open(w, h);
    await page.evaluate(() => { window.__noStrike = true; });
    for (const spot of ['troll', 'hump']) {
      for (const weather of ['light', 'glass']) {
        await start(page, spot, weather);
        await page.waitForTimeout(400); await page.screenshot({ path: `${out}/${spot}-${weather}-${w}-intro.png` });
        await page.waitForTimeout(5000); await page.screenshot({ path: `${out}/${spot}-${weather}-${w}-cruise.png` });
        await gameErr(page, `${spot}-${weather}-${w}`);
      }
      // stage the signs right in front of the boat so they can be judged
      await start(page, spot, 'light'); await page.waitForTimeout(3800);
      await page.evaluate((spot) => {
        const s = Game.scene, W = Game.W, H = Game.H;
        s.features = s.features.filter((f) => f.type === 'rip' || f.type === 'slick'); s.fish = [];
        if (spot === 'troll') {
          const wd = s.spawnWeed(W * 0.5, 'line'); wd.y = 400; wd.ang = -0.08; wd.spr = s.weedSprite(wd);
          s.spawnFish('mahi', W * 0.72, 420, wd);
          const fr = s.spawnFrigatesOver(W * 0.72, 410, wd);
          const b = s.spawnFeature('birds', W * 0.82); b.y = 220;
          for (const fi of s.fish) if (fi.feat === b) { fi.x = b.x + (Math.random() - 0.5) * 60; fi.y = b.y + (Math.random() - 0.5) * 50; fi.ox = fi.x - b.x; fi.oy = fi.y - b.y; }
          const d = s.spawnDebris(W * 0.6, 'log'); d.y = 180; s.fish = s.fish.filter((fi) => fi.feat !== d);
          const buoy = s.spawnBuoy(s.boatX() + 30); buoy.y = s.by + 70;
          const tt = s.spawnFish('tripletail', buoy.x + 2, buoy.y + 10, buoy);
          // a mahi lit up chasing the shotgun
          const L = s.lures[2]; const m = s.spawnFish('mahi', L.x + 70, L.y + 30, null, { big: true }); s.startChase(m, L, 20); m.lit = 1; m.alpha = 1;
          s.hint = { f: fr, text: TROLL_HINTS.frigates, t: 1, dur: 30 };
        } else {
          const bb = s.spawnBait(W * 0.7); bb.y = 200; bb.vx = 0; bb.vy = 0; bb.spd = 0;
          if (!bb.school) { Object.assign(bb, { school: true, up: true, cycle: 30, bustT: 0.2, holds: true }); s.addTerns(bb, 3); s.spawnFish('blackfin', bb.x, bb.y, bb, { school: true }); }
          bb.cycle = 30;
          const p = s.spawnFeature('birds', W * 0.86); p.y = 400; p.cycle = 30; p.up = true;
          for (const fi of s.fish) if (fi.feat === p) { fi.ox = (Math.random() - 0.5) * 70; fi.oy = (Math.random() - 0.5) * 50; }
          const L = s.lures[1]; const y = s.spawnFish('yellowfin', L.x + 60, L.y - 40, null, { big: true }); s.startChase(y, L, 20); y.lit = 1; y.alpha = 1;
          const sf = s.spawnFish('sailfish', s.boatX() + 160, s.by - 90, null); sf.fin = true; sf.alpha = 0.6;
        }
      }, spot);
      await page.waitForTimeout(1300); await page.screenshot({ path: `${out}/${spot}-signs-${w}.png` });
      await gameErr(page, `${spot}-signs-${w}`);
    }
    // breezy weed + hump at this width
    await start(page, 'troll', 'breezy'); await page.waitForTimeout(6000); await page.screenshot({ path: `${out}/troll-breezy-${w}.png` });
    await gameErr(page, `breezy-${w}`);
    // time running down, then the results callback
    await page.evaluate(() => { Game.scene.timeLeft = 0.3; }); await page.waitForTimeout(2600);
    const res = await page.evaluate(() => !!window.__res); if (!res) errs.push('no onEnd result at ' + w);
    await page.close();
  }
  console.log('shots written to', out);
}

if (what === 'sim' || what === 'all') {
  const page = await open(960, 540);
  const r = await page.evaluate((RUNS) => {
    const dt = 1 / 30, W = Game.W, H = Game.H;
    const WEATHER = { glass: { id: 'glass', name: 'Glass calm', vis: 1.25, drift: 0, aim: 0.75 }, light: { id: 'light', name: 'Light chop', vis: 1, drift: 0.5, aim: 1 }, breezy: { id: 'breezy', name: 'Breezy', vis: 0.8, drift: 1, aim: 1.35 } };
    // a decent player: reads the signs (birds, frigates, debris, bait, weed edges, any fish he can see), avoids trap floats
    function decent(s) {
      const bx = s.boatX(); let best = null, bv = 0;
      const consider = (x, y, val) => { if (x < bx - 140 || x > W + 60) return; const sc = val / (1 + Math.max(0, x - bx) / 450); if (sc > bv) { bv = sc; best = y; } };
      for (const f of s.features) {
        if (f.type === 'birds') consider(f.x, f.y, f.up ? 10 : 6);
        else if (f.type === 'frigates') consider(f.x, f.y, 9);
        else if (f.type === 'debris') consider(f.x, f.y + 20, 6);
        else if (f.type === 'bait') consider(f.x, f.y, f.terns && f.terns.length ? 9 : 4);
        else if (f.type === 'weed' || f.type === 'rip') {
          const x1 = f.x + f.len * Math.cos(f.ang); if (x1 < bx - 140) continue;
          const val = f.type === 'rip' ? 3 : f.kind === 'mat' ? 4 : f.kind === 'line' ? 3 : 1;
          const x = Math.max(f.x, bx - 140); consider(Math.max(f.x, bx), s.lineYAt(f, Math.min(x + 150, x1)) + (f.type === 'rip' ? f.side * 24 : 34), val);
        }
      }
      for (const fi of s.fish) if (fi.alpha > 0.25 && fi.state === 'idle') consider(fi.x, fi.y, 8);
      if (best == null) return null;
      for (const f of s.features) if (f.type === 'buoy' && f.x > bx - 10 && f.x < bx + 140 && Math.abs(f.y - best) < 34) best += best > f.y ? 36 : -36;
      return clamp(best, 120, H - 50);
    }
    function fightBot(s) {
      const f = s.child; if (!f) { Input.keys.delete('Space'); return; }
      if (f.phase === 'over') { Input.keys.delete('Space'); if (f.overT > 1) f.finish(); return; }
      if (f.phase === 'turn') { f.tap(); Input.keys.add('Space'); return; }
      const hold = !f.running && f.jumpT <= 0 && f.T < 0.8;
      if (hold) Input.keys.add('Space'); else Input.keys.delete('Space');
    }
    function run(spot, wx, bot) {
      let ended = null; const strikes = [], src = []; let fightTime = 0;
      const s = new TrollScene({ ch: 'jemel', spot, len: 120, weather: WEATHER[wx], onEnd: (res) => { ended = res; } });
      Game.scene = s;
      const orig = s.doStrike.bind(s); s.doStrike = (fi, L) => { strikes.push(fi.key + ' ' + fi.w); src.push(fi.feat ? fi.feat.type + (fi.feat.kind ? ':' + fi.feat.kind : '') : fi.follow != null ? 'follow' : fi.blind ? 'blind' : 'raise'); orig(fi, L); };
      let rt = 0, bait = 0;
      for (let i = 0; i < 400 / dt && !ended; i++) {
        if (s.child) fightTime += dt;
        else if (bot === 'decent') { const y = decent(s); if (y != null) s.ty = y; }
        else if (bot === 'random') { rt -= dt; if (rt <= 0) { rt = 2 + Math.random() * 3; s.ty = 120 + Math.random() * (H - 170); } }
        fightBot(s);
        s.update(dt);
        if (i % 90 === 0) s.draw(Game.ctx);
      }
      Input.keys.clear();
      return { strikes, src, caught: ended ? ended.catches.length : -1, fightTime };
    }
    const out = {};
    for (const spot of ['troll', 'hump']) for (const wx of ['light', 'glass', 'breezy']) for (const bot of ['decent', 'random', 'idle']) {
      if (wx === 'breezy' && bot === 'idle') continue;
      const rs = []; for (let k = 0; k < RUNS; k++) rs.push(run(spot, wx, bot));
      const n = rs.map((r) => r.strikes.length), mean = n.reduce((a, b) => a + b, 0) / n.length;
      const sp = {}; for (const r of rs) for (const x of r.strikes) { const k = x.split(' ')[0]; sp[k] = (sp[k] || 0) + 1; }
      const so = {}; for (const r of rs) for (const x of r.src) so[x] = (so[x] || 0) + 1;
      out[`${spot}/${wx}/${bot}`] = { mean: +mean.toFixed(2), runs: n.join(','), fightSec: +(rs.reduce((a, r) => a + r.fightTime, 0) / rs.length).toFixed(1), caught: +(rs.reduce((a, r) => a + r.caught, 0) / rs.length).toFixed(1), species: sp, src: so };
    }
    return out;
  }, RUNS);
  for (const [k, v] of Object.entries(r)) console.log(k.padEnd(20), 'strikes', String(v.mean).padEnd(5), '[' + v.runs + ']', 'fight', v.fightSec + 's', 'landed', v.caught, JSON.stringify(v.species), process.env.SRC ? '\n      src ' + JSON.stringify(v.src) : '');
  await gameErr(page, 'sim');
  await page.close();
}
console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no errors');
await browser.close();
