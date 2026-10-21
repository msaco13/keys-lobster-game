import { chromium } from 'playwright';
const root = process.argv[2];
const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errs=[]; page.on('pageerror', e=>errs.push(e.message));
await page.goto('file://' + root + '/index.html'); await page.waitForTimeout(1500);
const r = await page.evaluate(() => {
  const dt = 1/30, weather = { id: 'light', name: 'Light chop', vis: 1, drift: 0.5, aim: 1 };
  const finishChild = (s, log) => { if (s.child) { const f = s.child; log.push(f.key + ' ' + f.weight); s.timeLeft = Math.max(0.01, s.timeLeft - 18); f.toOver(); f.finish(); } };
  const out = {};
  // trolling: steer toward the nearest fish shadow ahead of the lures
  for (let run = 0; run < 3; run++) {
    const log = []; let ended = null;
    const s = new TrollScene({ ch: 'jorge', spot: 'troll', len: 120, weather, onEnd: (res) => { ended = res; } });
    Game.scene = s; s.enter && s.enter();
    for (let i = 0; i < 120 / dt + 200 && !ended; i++) {
      const tgt = s.fish.filter((f) => f.x > s.boatX() - 250 && f.x < Game.W).sort((a, b) => a.x - b.x)[0];
      if (tgt) s.ty = clamp(tgt.y, 120, Game.H - 50);
      s.update(dt); finishChild(s, log);
    }
    out['troll' + run] = log.length + ' strikes: ' + log.join(', ');
  }
  // bottom: read the fish finder, drop to the strongest mark, move the boat when it's quiet, auto hook-set on the bite
  for (let run = 0; run < 3; run++) {
    const log = []; let ended = null, quiet = 0, dir = 1;
    const s = new BottomScene({ ch: 'michael', spot: 'bottom', len: 120, weather, onEnd: (res) => { ended = res; } });
    Game.scene = s;
    for (let i = 0; i < 120 / dt + 200 && !ended; i++) {
      const m = s.sonarMarks(12)[0];
      if (m) { quiet = 0; s.targetDepth = m.ft; if (!s.move && m.s > 0.6 && s.baitType !== 'pinfish') s.rebait('pinfish'); }
      else if (!s.move && !s.activeFish()) { quiet += dt; if (quiet > 5) { quiet = 0; if (s.bx >= BOT.XMAX - 2) dir = -1; if (s.bx <= BOT.XMIN + 2) dir = 1; s.startMove(dir); } }
      if (!s.baitOn && !s.reeling && s.rebaitT <= 0) s.rebait();
      const f = s.activeFish(); if (f && f.state === 'bite' && f.timer < 0.45) s.hookset();
      s.update(dt); finishChild(s, log);
    }
    out['bottom' + run] = log.length + ' fish: ' + log.join(', ');
  }
  // flats: cast 70px in front of the nearest visible fish, strip on its rhythm, set on the eat
  for (let run = 0; run < 3; run++) {
    const log = []; let ended = null, casts = 0;
    const s = new FlatsScene({ ch: 'michael', spot: 'flats', len: 120, weather, onEnd: (res) => { ended = res; } });
    Game.scene = s; let stripT = 0;
    for (let i = 0; i < 120 / dt + 200 && !ended; i++) {
      if (s.eat) s.setHook();
      const fol = s.fishList.find((f) => f.state === 'follow');
      if (fol) { stripT += dt; if (stripT > fol.sp.strip) { stripT = 0; s.strip(); } }
      else if (!s.cast && (!s.lure || s.lure.t > 2.5)) {
        const tg = s.fishList.filter((f) => f.state === 'cruise' && f.alpha > 0.6 && f.y > 100 && f.y < Game.H - 160)[0];
        if (tg) { s.pickUp(); casts++; s.doCast({ x: tg.x + Math.cos(tg.hd) * (tg.len * 0.4 + tg.sp.spook + 30), y: tg.y + Math.sin(tg.hd) * (tg.len * 0.4 + tg.sp.spook + 30), t: 1.2 }); }
      }
      s.update(dt); finishChild(s, log);
    }
    out['flats' + run] = log.length + ' fish / ' + casts + ' casts: ' + log.join(', ');
  }
  return out;
});
for (const [k, v] of Object.entries(r)) console.log(k.padEnd(8), v);
console.log(errs.length ? errs.join('\n') : 'no errors');
await browser.close();
