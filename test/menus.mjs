// Screenshots of the menus and the meta game (title, setup, briefing, hand-off, results, day end, logbook)
// at several widths, with a save, bounties and a filled-in logbook.
//   node test/menus.mjs [repoRoot] [shotDir] [widths, e.g. 720,960,1280] [only, e.g. title,logbook]
import { chromium } from 'playwright';
import path from 'path'; import fs from 'fs'; import { fileURLToPath } from 'url';
const root = process.argv[2] || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[3] || '/tmp/menus'; fs.mkdirSync(out, { recursive: true });
const widths = (process.argv[4] || '720,960,1280').split(',').map(Number);
const only = process.argv[5] ? process.argv[5].split(',') : null;
const browser = await chromium.launch();
const errs = [];
for (const W of widths) {
  const page = await browser.newPage({ viewport: { width: W, height: 540 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => errs.push(W + ' PAGEERR ' + e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(W + ' ' + m.text()); });
  await page.goto('file://' + root + '/index.html');
  await page.waitForFunction(() => typeof Game !== 'undefined' && Game.scene, null, { timeout: 8000 }); await page.waitForTimeout(600);
  const shot = async (name, wait = 500) => {
    if (only && !only.some((o) => name.startsWith(o))) return;
    await page.waitForTimeout(wait); await page.waitForFunction(() => Game.fade === 0, null, { timeout: 3000 }).catch(() => {});
    await page.screenshot({ path: `${out}/${W}-${name}.png` });
    const ge = await page.evaluate(() => { const e = Game.error; Game.error = null; return e ? String(e.stack || e).split('\n').slice(0, 3).join(' | ') : null; }); if (ge) errs.push(W + ' ' + name + ': ' + ge);
  };
  const go = (expr) => page.evaluate(`Game.go(${expr}, true)`);
  const want = (n) => !only || only.some((o) => n.startsWith(o));
  // a fresh device
  await page.evaluate(() => { localStorage.clear(); Trip.cur = null; });
  if (want('title')) { await go('new TitleScene()'); await shot('title-fresh', 1500); }
  if (want('logbook')) { await go('new LogbookScene()'); await shot('logbook-empty'); }
  // a device with history
  await page.evaluate(() => {
    const rec = {}; const ks = ['lobster', 'yellowtail', 'mangrove', 'hogfish', 'redgrouper', 'blackgrouper', 'mahi', 'blackfin', 'sailfish', 'bonefish', 'tarpon', 'snook', 'redfish', 'kingfish'];
    const chs = ['michael', 'jorge', 'jemel'];
    ks.forEach((k, i) => { const sp = SPECIES[k]; rec[k] = { w: Math.round((sp.min + (sp.max - sp.min) * 0.6) * 10) / 10, ch: chs[i % 3], date: new Date(Date.now() - i * 86400000 * 3).toISOString() }; });
    localStorage.setItem('keyscrew_records', JSON.stringify(rec));
    localStorage.setItem('keyscrew_charted', JSON.stringify(['wreck', 'bridge']));
    const trips = [];
    for (let i = 0; i < 5; i++) trips.push({ date: new Date(Date.now() - i * 86400000 * 6).toISOString(), crew: chs.slice(0, 3 - (i % 2)), scores: { michael: 2400 - i * 100, jorge: 1800 + i * 300, jemel: 1200 + i * 200 }, winner: i % 2 ? 'jorge' : 'michael', bounties: [i % 3, 3] });
    localStorage.setItem('keyscrew_trips', JSON.stringify(trips));
  });
  if (want('logbook')) {
    await go('new LogbookScene()'); await shot('logbook-filled');
    await page.evaluate(() => { Game.scene.scroll = 420; Game.scene.target = 420; }); await shot('logbook-scrolled', 300);
    await page.evaluate(() => { Game.scene.scroll = 99999; Game.scene.target = 99999; }); await shot('logbook-bottom', 300);
  }
  // a crew trip in progress
  await page.evaluate(() => { Trip.start({ mode: 'crew', crew: ['michael', 'jorge', 'jemel'], plan: 'full', sessionLen: 120 }); Trip.cur.done = ['bughunt']; Trip.save(); });
  if (want('title')) { await go('new TitleScene()'); await shot('title-saved', 1500); }
  if (want('crew')) { await go('new CrewSetupScene()'); await shot('crewsetup'); }
  if (want('solo')) { await go('new SoloSetupScene()'); await shot('solosetup'); }
  if (want('brief')) {
    const has = await page.evaluate(() => typeof BriefingScene !== 'undefined');
    if (has) { await go("new BriefingScene({ mode: 'crew', crew: ['michael', 'jorge', 'jemel'], plan: 'full', sessionLen: 120 })"); await shot('briefing', 1200); await go("new BriefingScene({ mode: 'solo', crew: ['jemel'], plan: 'solo', sessionLen: 120 })"); await shot('briefing-solo', 1200); }
  }
  if (want('turn')) {
    await page.evaluate(() => { Trip.cur.spot = 'troll'; Trip.cur.turn = 0; Trip.cur.scores = { michael: 1240, jorge: 880, jemel: 310 }; Trip.save(); });
    await go('new TurnIntroScene()'); await shot('turnintro', 900);
    await page.evaluate(() => { Trip.cur.spot = 'bughunt'; Trip.cur.turn = 2; }); await go('new TurnIntroScene()'); await shot('turnintro-later', 900);
  }
  if (want('results')) {
    // a big turn: new species, a personal best, a bounty, lots of lines
    await page.evaluate(() => {
      Trip.cur.spot = 'troll'; Trip.cur.turn = 0;
      Trip.cur.bounties = [Bounties.make('mahi20'), Bounties.make('bow'), Bounties.make('bugs3')];
      const cs = [makeCatch('mahi', 31.4, 'jemel', 'troll', [{ label: 'Bowed to the jump × 2', pts: 80 }]), makeCatch('wahoo', 44, 'jemel', 'troll'), makeCatch('mahi', 12.2, 'jemel', 'troll'), makeCatch('blackfin', 22, 'jemel', 'troll'), makeCatch('kingfish', 18, 'jemel', 'troll'), makeCatch('barracuda', 21, 'jemel', 'troll'), makeCatch('mahi', 9.1, 'jemel', 'troll'), makeCatch('bonita', 8, 'jemel', 'troll')];
      const lines = cs.map((c) => ({ label: c.name + ' · ' + fmtLb(c.weight), pts: c.pts, key: c.key, trophy: c.trophy }));
      lines.push({ label: 'Cut off by a trap float', pts: -40 });
      lines.push({ label: 'Tripletail under the float', pts: 120 });
      const res = { catches: cs, lines, total: lines.reduce((a, l) => a + l.pts, 0), best: cs[0] };
      Trip.record('jemel', 'troll', res);
      Game.go(new ResultsScene('jemel', 'troll', res, advanceTrip()), true);
    });
    await shot('results-mid', 1500);
    await page.evaluate(() => { Game.scene.t = 99; }); await shot('results-done', 700);
    // a skunk
    await page.evaluate(() => { Trip.cur.spot = 'flats'; const res = { catches: [], lines: [], total: 0, best: null }; Trip.record('michael', 'flats', res); Game.go(new ResultsScene('michael', 'flats', res, advanceTrip()), true); });
    await shot('results-skunk', 900);
  }
  if (want('dayend')) {
    await page.evaluate(() => { if (Trip.cur.bounties) { Trip.cur.bounties[0].done = true; Trip.cur.bounties[0].by = 'jemel'; } Trip.save(); });
    await go('new DayEndScene()'); await shot('dayend', 1500);
    await page.evaluate(() => { Trip.start({ mode: 'solo', crew: ['jorge'], plan: 'solo', sessionLen: 120 }); }); await go('new DayEndScene()'); await shot('dayend-solo', 1500);
  }
  await page.close();
}
await browser.close();
console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'NO ERRORS');
