// Autopilot from home to every spot (and back): time, bumps, groundings, tickets. Fails if it doesn't get there
// (the spot it was sent to, not the first one it passes) or runs aground on the way.
import { chromium } from 'playwright';
const root = process.argv[2];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errs = []; page.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));
await page.goto('file://' + root + '/index.html'); await page.waitForTimeout(1000);
const res = await page.evaluate(() => {
  localStorage.clear(); World.build();
  const out = [];
  for (const notch of [3, 4]) for (const id of SPOT_ORDER) {
    Trip.start({ mode: 'solo', crew: ['michael'], plan: 'solo', sessionLen: 120 });
    const S = new SeaScene(); S.dest = id; S.planRoute(); S.setAuto(true); S.notch = notch;
    let t = 0; while (t < 400 && S.inSpot !== id) { S.update(1 / 30); t += 1 / 30; if (!S.auto && S.inSpot !== id) { S.setAuto(true); S.notch = notch; } }
    out.push([NOTCH[notch].name, id, Math.round(t), (S.legDist / UNITS_PER_NM).toFixed(1) + 'nm', 'bumps ' + S.flags.bumps, 'aground ' + S.flags.aground, 'fwc ' + S.flags.fwc, S.inSpot === id && !S.flags.aground ? 'OK' : 'FAILED at ' + Math.round(S.x) + ',' + Math.round(S.y - chainY(S.x))]);
  }
  // and the run home at sunset from every spot
  for (const id of SPOT_ORDER) {
    Trip.start({ mode: 'solo', crew: ['michael'], plan: 'solo', sessionLen: 120 });
    const [sx, sy] = spotXY(id); Trip.cur.boat = { x: sx, y: sy, h: 0 };
    const S = new SeaScene({ home: true }); S.planRoute(); S.setAuto(true); S.notch = 3;
    let t = 0; while (t < 400 && !S.atHome) { S.update(1 / 30); t += 1 / 30; if (!S.auto && !S.atHome) { S.setAuto(true); S.notch = 3; } }
    out.push(['HOME from', id, Math.round(t), (S.legDist / UNITS_PER_NM).toFixed(1) + 'nm', 'bumps ' + S.flags.bumps, 'aground ' + S.flags.aground, 'fwc ' + S.flags.fwc, S.atHome && !S.flags.aground ? 'OK' : 'FAILED at ' + Math.round(S.x) + ',' + Math.round(S.y - chainY(S.x))]);
  }
  return out;
});
for (const r of res) console.log(r.join('  '));
console.log(errs.length ? errs.join('\n') : 'no errors');
await browser.close();
const failed = res.filter((r) => r[r.length - 1] !== 'OK').length;
if (failed) console.log('FAILED: ' + failed + ' runs');
process.exitCode = failed || errs.length ? 1 : 0;
