// Plays 2-minute bottom-fishing turns with bots and reports catch rates.
// The bots read the fish finder (marks under the boat), drop to the strongest mark, pick bait by mark size,
// move the boat when the finder is empty, hook on the bite after a reaction delay, and fight the fish
// through the real FightScene. node test/bottom-sim.mjs <repo root> [runs per case]
import { chromium } from 'playwright';
const root = process.argv[2] || process.cwd(), RUNS = +(process.argv[3] || 10);
const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto('file://' + root + '/index.html'); await page.waitForTimeout(1200);
const res = await page.evaluate(({ RUNS }) => {
  const weather = { id: 'light', name: 'Light chop', vis: 1, drift: 0.5, aim: 1 };
  const BOTS = {
    // reads the finder, reacts fast, moves when it's quiet, uses chum
    good: { react: 0.22, noise: 1, quiet: 5, stale: 22, fightTap: 7, chum: true, holdErr: 0.12, read: true },
    // slower hands, sloppier depth, waits longer before moving
    casual: { react: 0.4, noise: 4, quiet: 12, stale: 40, fightTap: 5, chum: false, holdErr: 0.3, read: true },
    // never looks at the finder or moves: sits at one depth like the old game
    camper: { react: 0.25, noise: 0, quiet: 1e9, stale: 1e9, fightTap: 7, chum: false, holdErr: 0.12, read: false }
  };
  const out = {};
  for (const spot of ['bottom', 'wreck']) for (const [bn, B] of Object.entries(BOTS)) {
    const runs = [];
    for (let run = 0; run < RUNS; run++) {
      const ch = ['jorge', 'michael', 'jemel'][run % 3];
      let ended = null; const st = { bites: 0, hooked: 0, lost: {}, stolen: 0, moves: 0, moveT: 0, fightT: 0 };
      const s = new BottomScene({ ch, spot, len: 120, weather, onEnd: (r) => { ended = r; } });
      Game.scene = s;
      const dt = 1 / 30; let dir = s.bx > BOT.STRIP / 2 ? -1 : 1, biteT = -1, quietT = 0, staleT = 0, retargetT = 0, switchT = 0;
      let fs = null, hold = true, tapAcc = 0, runSeen = -1, teleSeen = -1, ft = 0;
      const origSteal = s.stealBait.bind(s); s.stealBait = (...a) => { st.stolen++; return origSteal(...a); };
      if (!B.read) { s.targetDepth = spot === 'wreck' ? 80 : 90; s.baitType = 'pinfish'; }
      for (let i = 0; i < 400 / dt && !ended; i++) {
        if (s.child) {
          if (s.child !== fs) { fs = s.child; fs.holding = () => hold; tapAcc = 0; runSeen = -1; teleSeen = -1; ft = 0; }
          ft += dt; st.fightT += dt;
          if (fs.phase === 'turn') { hold = true; tapAcc += dt; if (tapAcc > 1 / B.fightTap) { tapAcc = 0; fs.tap(); } }
          else if (fs.phase === 'over') { if (fs.overT > 1.0) { if (!fs.won) st.lost[fs.reason] = (st.lost[fs.reason] || 0) + 1; fs.tap(); } }
          else {
            if (fs.tele && teleSeen < 0) teleSeen = ft; if (!fs.tele && !fs.running) teleSeen = -1;
            if (fs.running && runSeen < 0) runSeen = ft; if (!fs.running) runSeen = -1;
            const L = fs.perks.line;
            hold = !((teleSeen >= 0 && ft - teleSeen > 0.2) || (runSeen >= 0 && ft - runSeen > B.holdErr) || fs.jumpT > 0 || fs.T > 0.8 * L);
          }
          s.update(dt); continue;
        }
        if (!s.ended) {
          if (!s.baitOn && !s.reeling && s.rebaitT <= 0 && !s.move) s.rebait();
          const f = s.activeFish();
          if (f && f.state === 'bite') { if (biteT < 0) { biteT = 0; st.bites++; } biteT += dt; if (biteT >= B.react) { biteT = -1; if (s.hookset()) st.hooked++; } }
          else biteT = -1;
          if (s.move) st.moveT += dt;
          if (B.read && !s.move && !f) {
            const marks = s.sonarMarks(15);
            if (marks.length) {
              quietT = 0; staleT += dt; retargetT -= dt;
              const m = marks[0];
              if (retargetT <= 0) { s.targetDepth = clamp(m.ft + (Math.random() - 0.5) * 2 * B.noise, 4, s.maxDepth()); retargetT = 1.5; }
              const want = m.s > 0.4 ? 'pinfish' : 'squid';
              if (want !== s.baitType) { switchT += dt; if (switchT > 2) { s.rebait(want); switchT = 0; } } else switchT = 0;
              if (staleT > B.stale) { staleT = 0; if ((dir < 0 && s.bx <= BOT.XMIN + 5) || (dir > 0 && s.bx >= BOT.XMAX - 5)) dir = -dir; s.startMove(dir); st.moves++; }
            } else {
              quietT += dt;
              if (quietT > B.quiet) { quietT = 0; staleT = 0; if ((dir < 0 && s.bx <= BOT.XMIN + 5) || (dir > 0 && s.bx >= BOT.XMAX - 5)) dir = -dir; s.startMove(dir); st.moves++; }
            }
          }
          if (B.read && s.move && s.move.phase === 'go') {
            // keep idling until something shows up on the finder
            if (!s.sonarMarks(3).length && s.move.want - s.move.done < 60) s.startMove(s.move.dir);
            if (s.bx <= BOT.XMIN + 1 || s.bx >= BOT.XMAX - 1) dir = -s.move.dir;
          }
          if (B.chum && s.chumCd <= 0 && s.t > 6 && !s.move) s.dropChum();
        }
        s.update(dt);
      }
      runs.push({ n: ended ? ended.catches.length : -1, pts: ended ? ended.total : 0, keys: ended ? ended.catches.map((c) => c.key + ' ' + c.weight) : [], st });
    }
    const ns = runs.map((r) => r.n), avg = ns.reduce((a, b) => a + b, 0) / ns.length;
    const sp = {}; for (const r of runs) for (const k of r.keys) { const key = k.split(' ')[0]; sp[key] = (sp[key] || 0) + 1; }
    const lost = {}; for (const r of runs) for (const [k, v] of Object.entries(r.st.lost)) lost[k] = (lost[k] || 0) + v;
    const m = (f) => (runs.reduce((a, r) => a + f(r), 0) / runs.length).toFixed(1);
    out[spot + '/' + bn] = { avg: avg.toFixed(2), min: Math.min(...ns), max: Math.max(...ns), pts: m((r) => r.pts), bites: m((r) => r.st.bites), hooked: m((r) => r.st.hooked), stolen: m((r) => r.st.stolen), moves: m((r) => r.st.moves), moveT: m((r) => r.st.moveT), fightT: m((r) => r.st.fightT), lost, sp, counts: ns.join(',') };
  }
  return out;
}, { RUNS });
for (const [k, v] of Object.entries(res)) {
  console.log(k.padEnd(16), 'fish/turn avg', v.avg, `(min ${v.min}, max ${v.max})`, 'pts', v.pts, '| bites', v.bites, 'hooked', v.hooked, 'stolen', v.stolen, 'moves', v.moves, 'moveT', v.moveT + 's', 'fightT', v.fightT + 's');
  console.log(' '.repeat(16), 'counts', v.counts, '| lost', JSON.stringify(v.lost));
  console.log(' '.repeat(16), 'species', JSON.stringify(v.sp));
}
console.log(errs.length ? errs.join('\n') : 'no page errors');
await browser.close();
process.exitCode = errs.length ? 1 : 0;
