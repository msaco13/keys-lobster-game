// Daily bounties: rolling, paying out on a turn, the boat's found() hook and its sync() safety net,
// saving with the trip, and the NEW SPECIES / PERSONAL BEST flags the results screen badges.
//   node test/bounties.mjs [repoRoot]
import { chromium } from 'playwright';
import path from 'path'; import { fileURLToPath } from 'url';
const root = process.argv[2] || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errs = []; page.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));
await page.goto('file://' + root + '/index.html');
await page.waitForFunction(() => typeof Game !== 'undefined' && Game.scene, null, { timeout: 8000 });
const out = await page.evaluate(() => {
  const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
  localStorage.clear();
  // rolling: three, from three different places, never a goal that can't be done
  const seen = {};
  for (let i = 0; i < 400; i++) {
    const r = Bounties.roll(), groups = r.map((b) => b.group);
    ok(r.length === 3, 'roll gave ' + r.length);
    ok(new Set(groups).size === 3, 'two bounties from one place: ' + groups);
    ok(groups.filter((g) => g === 'any').length <= 1, 'more than one anywhere bounty');
    for (const b of r) { seen[b.id] = (seen[b.id] || 0) + 1; ok(BOUNTY_DEFS[b.id] && b.bonus >= 100 && b.bonus <= 400, 'bad bounty ' + b.id); ok(Array.isArray(b.where), 'no where'); }
  }
  ok(Object.keys(seen).length >= 18, 'only ' + Object.keys(seen).length + ' kinds of bounty came up');
  // every species bounty names spots that hold the fish
  for (const id in BOUNTY_DEFS) { const d = BOUNTY_DEFS[id]; if (d.sp) ok(Bounties.spotsFor(id).length > 0, id + ' has nowhere to be done'); }
  // with every spot found, "Find a new spot" never comes up; with every species logged, neither does "a new species"
  localStorage.setItem('keyscrew_charted', JSON.stringify(SPOT_ORDER));
  const rec = {}; SPECIES_ORDER.forEach((k) => (rec[k] = { w: 0.1, ch: 'michael' })); localStorage.setItem('keyscrew_records', JSON.stringify(rec));
  for (let i = 0; i < 300; i++) for (const b of Bounties.roll()) { ok(b.id !== 'newspot', 'newspot with every spot found'); ok(b.id !== 'newsp', 'newsp with everything logged'); }
  localStorage.clear();

  // a turn that finishes two bounties pays both, onto the turn and the angler's score
  Trip.start({ mode: 'crew', crew: ['michael', 'jorge', 'jemel'], plan: 'full', sessionLen: 90 });
  ok(Trip.cur.bounties.length === 3, 'Trip.start did not roll bounties');
  Trip.cur.bounties = [Bounties.make('mahi20'), Bounties.make('bow'), Bounties.make('bugs3')];
  const mahi = makeCatch('mahi', 25, 'jemel', 'troll', [{ label: 'Bowed to the jump × 1', pts: 40 }]);
  const lines = [{ label: 'Mahi', pts: mahi.pts, key: 'mahi' }];
  const res = { catches: [mahi], lines, total: mahi.pts, best: mahi };
  Trip.record('jemel', 'troll', res);
  ok(res.bounties && res.bounties.length === 2, 'expected 2 bounties, got ' + (res.bounties && res.bounties.length));
  ok(res.total === mahi.pts + 250 + 150, 'turn total ' + res.total);
  ok(res.lines.filter((l) => l.bounty).length === 2, 'bounty lines missing');
  ok(Trip.cur.scores.jemel === res.total, 'score ' + Trip.cur.scores.jemel);
  ok(Trip.cur.bounties[0].done && Trip.cur.bounties[0].by === 'jemel' && Trip.cur.bounties[0].spot === 'troll', 'mahi bounty not marked');
  ok(mahi.isNew && mahi.pb, 'first mahi should be new and a best');
  // the same goal again pays nothing: first one to it took it
  const m2 = makeCatch('mahi', 30, 'michael', 'troll'); const r2 = { catches: [m2], lines: [{ label: 'Mahi', pts: m2.pts, key: 'mahi' }], total: m2.pts };
  Trip.record('michael', 'troll', r2);
  ok(!r2.bounties, 'a taken bounty paid twice'); ok(!m2.isNew && m2.pb, 'second, bigger mahi: a best but not new');
  const m3 = makeCatch('mahi', 5, 'jorge', 'troll'); Trip.record('jorge', 'troll', { catches: [m3], lines: [], total: m3.pts }); ok(!m3.isNew && !m3.pb, 'a small mahi is neither new nor a best');
  // three legal bugs in one dive
  const bugs = [3.2, 3.6, 4.1].map((cl) => { const c = makeCatch('lobster', 1.2, 'michael', 'bughunt'); c.cl = cl; return c; });
  const rb = { catches: bugs, lines: [], total: 300 }; Trip.record('michael', 'bughunt', rb);
  ok(rb.bounties && rb.bounties[0].id === 'bugs3', 'bugs3 not paid');
  // saved and loaded with the trip
  const back = Trip.load(); ok(back.bounties.filter((b) => b.done).length === 3, 'bounties lost in the save');

  // the Grand Slam adds up over the day, for one angler
  Trip.start({ mode: 'solo', crew: ['jorge'], plan: 'solo', sessionLen: 90 });
  Trip.cur.bounties = [Bounties.make('slam'), Bounties.make('five'), Bounties.make('trophy')];
  const turn = (keys) => { const cs = keys.map((k) => makeCatch(k, SPECIES[k].min + 1, 'jorge', 'flats')); const r = { catches: cs, lines: [], total: 10 }; Trip.record('jorge', 'flats', r); return r; };
  ok(!turn(['tarpon', 'bonefish']).bounties, 'slam too early');
  const rs = turn(['permit']); ok(rs.bounties && rs.bounties.some((b) => b.id === 'slam'), 'slam not paid over the day');
  ok(turn(['snook', 'redfish', 'trout', 'jack', 'ladyfish']).bounties.some((b) => b.id === 'five'), 'five fish not paid');

  // the boat's hook: found() pays the captain once
  Trip.start({ mode: 'crew', crew: ['michael', 'jorge'], plan: 'half', sessionLen: 90 });
  Trip.cur.bounties = [Bounties.make('newspot'), Bounties.make('tuna'), Bounties.make('snook')];
  const f1 = Bounties.found('wreck', 'jorge'), f2 = Bounties.found('hump', 'michael');
  ok(f1.length === 1 && f2.length === 0, 'found paid ' + f1.length + ', then ' + f2.length);
  ok(Trip.cur.scores.jorge === 200 && Trip.cur.scores.michael === 0, 'found scores ' + JSON.stringify(Trip.cur.scores));
  ok(!Bounties.here(Trip.cur.bounties[0], 'troll'), 'newspot should not count as doable at a fishing spot');
  ok(Bounties.here(Trip.cur.bounties[1], 'troll') && !Bounties.here(Trip.cur.bounties[1], 'flats'), 'tuna here-ness');
  // ...and sync() pays it if the boat didn't: the captain of the leg that just ended
  Trip.start({ mode: 'crew', crew: ['michael', 'jorge', 'jemel'], plan: 'half', sessionLen: 90 });
  Trip.cur.bounties = [Bounties.make('newspot'), Bounties.make('tuna'), Bounties.make('snook')];
  ok(Bounties.sync().length === 0, 'sync paid with nothing found');
  Trip.cur.found = ['hump']; Trip.cur.legs = 2;
  const s1 = Bounties.sync(); ok(s1.length === 1 && s1[0].by === 'jorge', 'sync paid ' + JSON.stringify(s1.map((b) => b.by)));
  ok(Bounties.sync().length === 0, 'sync paid twice');
  // old saves with no bounties at all
  Trip.cur.bounties = undefined; ok(Bounties.list().length === 0 && Bounties.sync().length === 0 && Bounties.found('hump').length === 0, 'old trips without bounties');
  const r0 = { catches: [], lines: [], total: 0 }; Trip.record('michael', 'flats', r0); ok(r0.total === 0, 'old trip record');
  return fails;
});
// the screens draw with bounties, badges and an old trip without them
for (const expr of [
  "Trip.start({ mode: 'crew', crew: ['michael', 'jorge'], plan: 'half', sessionLen: 90 }); Trip.cur.spot = 'troll'; Game.go(new TurnIntroScene(), true)",
  "Trip.cur.bounties = undefined; Trip.cur.spot = 'troll'; Game.go(new TurnIntroScene(), true)",
  "Trip.start({ mode: 'solo', crew: ['jorge'], plan: 'solo', sessionLen: 90 }); Game.go(new DayEndScene(), true)",
  "Trip.cur.bounties = undefined; Game.go(new DayEndScene(), true)",
  "Game.go(new LogbookScene(), true)"
]) { await page.evaluate(expr); await page.waitForTimeout(400); const ge = await page.evaluate(() => { const e = Game.error; Game.error = null; return e ? String(e.stack || e) : null; }); if (ge) errs.push(expr + ': ' + ge); }
await browser.close();
const all = out.concat(errs);
console.log(all.length ? 'FAIL\n' + all.join('\n') : 'bounties: all checks passed');
process.exit(all.length ? 1 : 0);
