// Bully netting at night (js/bullynet.js) and the night run around it. Exits 1 on any failure.
//   - Night Run from the title by tapping, phone-sized: the setup, tonight's bounties, the hand-off, the how-to card,
//     then a real drag to sweep the light and a real tap just behind the first bug's tail, the twist, the gauge
//   - how the net works, stepped frame by frame: behind the tail backs any bug in (the pro move), on top of it only
//     fools the calm ones, in front of it never works; twist too soon or too late and it slips out; crabs, rays and
//     nurse sharks; the light holding a bug while the boat idles over and holds up; the bugs that bolt
//   - a day trip with the night run: the run home → nightfall → each netter → the end of the day, quitting to the
//     title and resuming at each step
//   - on a desktop: the light follows the mouse, Space drops the net, Esc pauses; every night screen draws at
//     720, 960 and 1280 wide without errors
//   node test/night.mjs [repo root]
import { chromium } from 'playwright';
import path from 'path'; import { fileURLToPath } from 'url';
const root = process.argv[2] || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fails = []; const check = (ok, what) => { console.log((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) fails.push(what); };
const browser = await chromium.launch();

async function open(o) {
  const ctx = await browser.newContext({ viewport: o.viewport, deviceScaleFactor: 1, hasTouch: !!o.touch, isMobile: !!o.touch });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_|net::|Failed to load resource/i.test(m.text())) errs.push(m.text()); });
  // the boat ride's 3D is checked elsewhere (test/gfx.mjs); here it would only slow the headless browser down
  await page.addInitScript(() => { localStorage.clear(); localStorage.setItem('keyscrew_gfx', JSON.stringify('classic')); });
  await page.goto('file://' + root + '/index.html');
  await page.waitForFunction(() => typeof Game !== 'undefined' && Game.scene, null, { timeout: 15000 });
  await page.waitForTimeout(300);
  const name = () => page.evaluate(() => Game.scene.constructor.name);
  const gameErr = () => page.evaluate(() => { const e = Game.error; Game.error = null; return e ? String(e.stack || e).split('\n').slice(0, 3).join(' | ') : null; });
  const settle = async () => { await page.waitForTimeout(120); await page.waitForFunction(() => Game.fadeDir !== 1 && !Game.next, null, { timeout: 8000 }).catch(() => {}); await page.waitForTimeout(80); };
  const at = (x, y) => page.evaluate(([x, y]) => ({ x: Game.ox + x * Game.scale, y: Game.oy + y * Game.scale }), [x, y]);
  const tap = async (x, y) => { const p = await at(x, y); if (o.touch) await page.touchscreen.tap(p.x, p.y); else await page.mouse.click(p.x, p.y); };
  const press = async (id) => {
    const r = await page.evaluate((id) => { const r = UI.byId(id); return r && !r.disabled ? { x: r.x + r.w / 2, y: r.y + r.h / 2 } : null; }, id);
    if (!r) throw new Error('no button "' + id + '" on ' + (await name()));
    await tap(r.x, r.y); await settle();
  };
  return { ctx, page, errs, name, gameErr, settle, tap, at, press };
}

{ // ---- a Night Run, by tapping, on a phone ----
  const S = await open({ viewport: { width: 844, height: 390 }, touch: true });
  const { page, name, press, tap, gameErr } = S;
  try {
    await press('night'); check((await name()) === 'CrewSetupScene' && (await page.evaluate(() => Game.scene.nightOnly)), 'Night Run on the title → who’s going out tonight');
    await press('card2'); await press('rounds2');
    await press('go'); check((await name()) === 'BriefingScene', 'Let’s go → tonight’s bounties');
    const bounties = await page.evaluate(() => Game.scene.bounties.map((b) => b.id)), forNight = await page.evaluate(() => Game.scene.bounties.every((b) => BOUNTY_DEFS[b.id].night || b.id === 'bigbug'));
    check(bounties.length === 3 && forNight, 'tonight’s bounties are all for the night (' + bounties.join(', ') + ')');
    await press('castoff');
    const trip = await page.evaluate(() => ({ scene: Game.scene.constructor.name, spot: Trip.cur.spot, plan: Trip.cur.plan, turns: nightTurns(Trip.cur), crew: Trip.cur.crew.join(','), saved: !!Trip.load() }));
    check(trip.scene === 'TurnIntroScene' && trip.spot === 'bullynet' && trip.plan === 'night' && trip.turns === 4 && trip.crew === 'michael,jorge' && trip.saved, 'Cast off → straight to the first netter’s hand-off, two rounds for two (' + JSON.stringify(trip) + ')');
    check(!(await page.evaluate(() => !!UI.byId('chart'))), 'no Back to the boat at night');
    await press('ready');
    const card = await page.evaluate(() => ({ scene: Game.scene.constructor.name, help: !!Game.scene.help, left: Game.scene.timeLeft }));
    check(card.scene === 'BullyNetScene' && card.help && card.left >= 119.9, 'the first night opens How to bully net, and the clock waits (' + JSON.stringify(card) + ')');
    await press('help-ok'); await page.waitForTimeout(1200);
    const start = await page.evaluate(() => { const s = Game.scene, b = s.bugs.find((x) => x.first); return { coach: s.coach, msg: s.coachMsg(), first: !!b, light: s.light.on, temper: b && b.temper }; });
    check(start.coach && start.first && start.light && start.temper === 'calm' && !!start.msg, 'a first night: the light comes on, a calm bug waits ahead, the coaching says what to do (' + start.msg + ')');
    // a real drag on the water swings the light
    const before = await page.evaluate(() => [Game.scene.light.x, Game.scene.light.y]);
    const a = await S.at(Math.round(await page.evaluate(() => Game.W)) * 0.3, 300), b = await S.at(Math.round(await page.evaluate(() => Game.W)) * 0.25, 170);
    const cdp = await S.ctx.newCDPSession(page);
    const touch = (type, p) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: p.x, y: p.y, id: 1 }] });
    await touch('touchStart', a); for (let i = 1; i <= 10; i++) { await touch('touchMove', { x: a.x + (b.x - a.x) * i / 10, y: a.y + (b.y - a.y) * i / 10 }); await page.waitForTimeout(30); }
    await page.waitForTimeout(300); await touch('touchEnd', b); await page.waitForTimeout(200);
    const after = await page.evaluate(() => [Game.scene.light.x, Game.scene.light.y]);
    check(Math.hypot(after[0] - before[0], after[1] - before[1]) > 80, 'dragging on the water sweeps the light (moved ' + Math.round(Math.hypot(after[0] - before[0], after[1] - before[1])) + ')');
    // put the light back on the first bug, let the boat bring it into reach, then tap just behind its tail
    await page.evaluate(() => { const s = Game.scene, b = s.bugs.find((x) => x.first); s.aimLight(b.x, b.y, b); });
    await page.waitForFunction(() => !!Game.scene.netTarget(), null, { timeout: 15000 }).catch(() => {});
    const tgt = await page.evaluate(() => { const s = Game.scene, b = s.netTarget(); if (!b) return null; const [x, y] = s.toScreen(b.x - Math.cos(b.h) * (b.C * 1.15 + 14), b.y - Math.sin(b.h) * (b.C * 1.15 + 14)); return { x, y, action: s.actionLabel }; });
    check(!!tgt && tgt.action === 'NET', 'with the light on it the boat idles over, and the NET button shows (' + JSON.stringify(tgt) + ')');
    if (tgt) await tap(tgt.x, tgt.y);
    await page.waitForFunction(() => Game.scene.net && Game.scene.net.state === 'pin' && Game.scene.net.kick > 0, null, { timeout: 6000 }).catch(() => {});
    const pinned = await page.evaluate(() => ({ state: Game.scene.net.state, pro: Game.scene.net.pro, kick: Game.scene.net.kick > 0, label: Game.scene.actionLabel }));
    check(pinned.state === 'pin' && pinned.pro && pinned.kick && pinned.label === 'TWIST', 'a tap just behind the tail drops the net, the bug backs into it and kicks up into the bag (' + JSON.stringify(pinned) + ')');
    await tap(await page.evaluate(() => Game.W * 0.5), 250);
    await page.waitForFunction(() => !!Game.scene.gauge, null, { timeout: 4000 }).catch(() => {});
    const g = await page.evaluate(() => ({ gauge: !!Game.scene.gauge, coach: Game.scene.coach, lines: Game.scene.extraLines.map((l) => l.label) }));
    check(g.gauge && !g.coach && g.lines.includes('Backed it into the net'), 'TWIST on the kick bags it: the gauge, the pro-move bonus, and the coaching is done (' + JSON.stringify(g) + ')');
    await press('keep');
    check((await page.evaluate(() => Game.scene.bag.length)) === 1, 'KEEP IT puts it in the bag');
    // the clock runs out: the FWC check, and the next netter
    await page.evaluate(() => { Game.scene.timeLeft = 0.05; });
    await page.waitForFunction(() => Game.scene.constructor.name === 'ResultsScene', null, { timeout: 8000 }).catch(() => {});
    await S.settle(); await page.evaluate(() => { Game.scene.t = 99; }); await page.waitForTimeout(150);
    const res = await page.evaluate(() => ({ scene: Game.scene.constructor.name, next: Game.scene.nextLabel && Game.scene.nextLabel(), done: Trip.cur.bounties.filter((b) => b.done).map((b) => b.id) }));
    check(res.scene === 'ResultsScene' && res.next === 'Next up: Jorge' && res.done.includes('nightpro') === bounties.includes('nightpro'), 'time’s up → the FWC check at the ramp, next up Jorge (' + JSON.stringify(res) + ')');
    check(!(await gameErr()) && S.errs.length === 0, 'phone: no errors' + (S.errs.length ? ' — ' + S.errs.slice(0, 3).join(' | ') : ''));
  } catch (e) { check(false, 'phone night run: ' + e.message); }
  await S.ctx.close();
}

{ // ---- how the net works, stepped frame by frame ----
  const S = await open({ viewport: { width: 960, height: 540 } });
  const r = await S.page.evaluate(() => {
    const out = {};
    Trip.start({ mode: 'crew', crew: ['michael', 'jorge', 'jemel'], plan: 'night', night: true, sessionLen: 120 });
    const mk = (ch, coach) => { Store.set('coach_bully1_' + ch, true); Store.set('coach_bullynet_' + ch, !coach); const s = new BullyNetScene({ ch, spot: 'bullynet', len: 120, weather: Trip.cur.weather, onEnd: () => {} }); s.intro = null; s.light.on = true; s.bugs = []; s.crits = []; s.shrimp = []; s.dirT = 1e9; return s; };
    const step = (s, sec) => { for (let i = 0; i < sec * 60; i++) s.update(1 / 60); };
    const bugAhead = (s, o) => { const bw = s.bow(), b = s.addBug(bw.x + 20, bw.y - 170, Object.assign({ cl: 3.6, eggs: false, gold: false, h: 0 }, o)); b.st = 'idle'; b.stT = 99; s.notch = 0; return b; };
    const trial = (temper, where) => { const s = mk('jorge', false), b = bugAhead(s, { temper }); s.dropNet(b.x + Math.cos(b.h) * where, b.y + Math.sin(b.h) * where); step(s, 1.4); return s.net.state === 'pin' ? (s.net.pro ? 'pro' : 'pin') : 'miss'; };
    const rate = (temper, where, n = 40) => { const c = { pro: 0, pin: 0, miss: 0 }; for (let i = 0; i < n; i++) c[trial(temper, where)]++; return c; };
    for (const t of ['calm', 'skittish', 'wary']) out[t] = { behind: rate(t, -34), onTop: rate(t, 0), front: rate(t, 40) };
    { const s = mk('jorge', false), b = bugAhead(s, { temper: 'calm' }); s.dropNet(b.x, b.y); step(s, 0.45); s.twist(); out.early = s.net.state + '/' + b.st; }
    { const s = mk('jorge', false), b = bugAhead(s, { temper: 'calm' }); s.dropNet(b.x, b.y); step(s, 6); out.late = s.net.state + '/' + b.st + '/' + b.misses; }
    { const s = mk('jemel', true), b = bugAhead(s, { temper: 'calm' }); s.dropNet(b.x, b.y); step(s, 0.45); s.twist(); out.coachEarly = s.net.state; }
    for (const kind of ['crab', 'ray', 'nurse']) { const s = mk('jorge', false), bw = s.bow(), c = { kind, x: bw.x, y: bw.y - 160, h: 0, t: 0, v: 0, flee: 0, s: 1, len: 140, side: 1 }; s.crits.push(c); const t0 = s.timeLeft; s.dropNet(c.x, c.y); step(s, 0.5); out[kind] = Math.round(t0 - s.timeLeft - 0.5); }
    { const s = mk('jorge', false), bw = s.bow(), b = bugAhead(s, { temper: 'calm', h: 1.2 }); b.x = bw.x + 60; b.y = bw.y - 340; s.notch = 1;
      s.aimLight(b.x, b.y, null); step(s, 0.6); out.lock = s.light.lock === b;
      let tt = 0; while (tt < 15 && !s.netTarget()) { s.update(1 / 60); tt += 1 / 60; } out.reach = +tt.toFixed(1); out.frozen = b.st;
      tt = 0; while (tt < 10 && s.boat.v > 1) { s.update(1 / 60); tt += 1 / 60; } out.hold = +s.boat.v.toFixed(1); out.dist = Math.round(dist(s.bow().x, s.bow().y, b.x, b.y)); out.held = b.st; }
    // how long a skittish bug gives you once the net can reach it (the boat creeping in with the light on it)
    { const left = []; for (let k = 0; k < 12; k++) { const s = mk('jorge', false), bw = s.bow(), b = bugAhead(s, { temper: 'skittish', h: rand(0, 6) }); b.x = bw.x + rand(-80, 80); b.y = bw.y - 340; s.notch = 1; s.aimLight(b.x, b.y, b);
      let tt = 0; while (tt < 15 && !s.netTarget()) { s.update(1 / 60); tt += 1 / 60; } let u = 0; while (u < 15 && b.st === 'freeze') { s.update(1 / 60); u += 1 / 60; } left.push(+u.toFixed(1)); }
      left.sort((a, c) => a - c); out.skittishLeft = left; }
    { const s = mk('jorge', false), b = bugAhead(s, { temper: 'wary', cl: 4.6 }); s.aimLight(b.x, b.y, b); let tt = 0; while (tt < 10 && b.st !== 'bolt') { s.update(1 / 60); tt += 1 / 60; } out.waryBolt = +tt.toFixed(1); }
    { const s = mk('jorge', false); s.dirT = 0; let tt = 0; while (tt < 10 && !s.bugs.length) { s.update(1 / 60); tt += 1 / 60; } out.director = +tt.toFixed(1); }
    { const s = mk('jorge', false); for (let i = 0; i < 6; i++) { s.gauge = { lob: { cl: 3.5, w: 1.3, eggs: false, gold: false }, t: 0 }; s.decide(true); } out.limit = s.endReason; }
    { const s = mk('jorge', false); s.gauge = { lob: { cl: 2.8, w: 0.7, eggs: false, gold: false }, t: 0 }; s.decide(false); s.gauge = { lob: { cl: 3.4, w: 1.2, eggs: true, gold: false }, t: 0 }; s.decide(true); const res = s.buildResult(); out.fwc = res.lines.map((l) => l.pts); }
    return out;
  });
  const pct = (c, k) => c[k] / (c.pro + c.pin + c.miss);
  check(['calm', 'skittish', 'wary'].every((t) => pct(r[t].behind, 'pro') >= 0.95), 'just behind the tail backs every kind of bug into the net (' + ['calm', 'skittish', 'wary'].map((t) => t + ' ' + JSON.stringify(r[t].behind)).join(', ') + ')');
  check(['calm', 'skittish', 'wary'].every((t) => pct(r[t].front, 'miss') === 1), 'in front of it never works: it shoots backward, away');
  check(pct(r.calm.onTop, 'pin') === 1 && pct(r.skittish.onTop, 'pin') > 0.4 && pct(r.skittish.onTop, 'miss') > 0.1 && pct(r.wary.onTop, 'miss') === 1, 'right on top: calm bugs stay put, skittish ones sometimes, wary old bugs never (' + JSON.stringify([r.calm.onTop, r.skittish.onTop, r.wary.onTop]) + ')');
  check(r.early === 'lift/flip' && r.late.startsWith('carry/') && r.late.endsWith('/1') && r.coachEarly === 'pin', 'twist too soon or never and it slips out under the rim; a learner’s early twist is forgiven (' + [r.early, r.late, r.coachEarly].join(', ') + ')');
  check(r.crab === 0 && r.ray === 3 && r.nurse === 5, 'netting a crab costs nothing, a ray 3 seconds, a nurse shark 5 (' + [r.crab, r.ray, r.nurse].join(', ') + ')');
  check(r.lock && r.reach < 8 && r.frozen === 'freeze' && r.hold <= 1 && r.dist < 250 && r.held === 'freeze', 'the light holds a bug, the boat idles over in ' + r.reach + 's and holds up within reach, the bug still frozen (' + JSON.stringify({ frozen: r.frozen, hold: r.hold, dist: r.dist, held: r.held }) + ')');
  check(r.skittishLeft[Math.floor(r.skittishLeft.length / 2)] >= 2 && r.skittishLeft[0] >= 1, 'a skittish bug gives a few seconds once it’s in reach (median ' + r.skittishLeft[Math.floor(r.skittishLeft.length / 2)] + 's, ' + JSON.stringify(r.skittishLeft) + ')');
  check(r.waryBolt > 0.8 && r.waryBolt < 4, 'a wary old bug held in the light bolts in a second or two (' + r.waryBolt + 's)');
  check(r.director <= 6, 'when nothing’s ahead for a while, a bug walks out of the dark (' + r.director + 's)');
  check(r.limit === 'limit', 'six bugs: limited out');
  check(JSON.stringify(r.fwc) === JSON.stringify([-300, 25]), 'a short let go is a good call; eggs in the bag is a fine at the ramp (' + JSON.stringify(r.fwc) + ')');
  check(!(await S.gameErr()) && S.errs.length === 0, 'mechanics: no errors' + (S.errs.length ? ' — ' + S.errs.slice(0, 3).join(' | ') : ''));
  await S.ctx.close();
}

{ // ---- a day trip with the night run ----
  const S = await open({ viewport: { width: 960, height: 540 } });
  const { page, name, press, settle } = S;
  try {
    await press('crew');
    const on = await page.evaluate(() => Game.scene.night); await press('night'); const off = await page.evaluate(() => Game.scene.night); await press('night');
    check(on === true && off === false && (await page.evaluate(() => Game.scene.night)) === true, 'the crew setup has a night-run switch, on by default');
    await press('half'); await press('go'); await press('castoff');
    check((await name()) === 'SeaScene' && (await page.evaluate(() => Trip.cur.night && !Trip.cur.nightDone)), 'a day trip with the night run casts off from the dock as usual');
    // the day's spots are done: the run home ends at the dock, and the night begins
    await page.evaluate(() => { const c = Trip.cur; c.done = ['bughunt', 'flats']; c.scores = { michael: 300, jorge: 900, jemel: 600 }; c.legs = 2; Trip.save(); Game.go(new SeaScene(), true); });
    await settle(); if (await page.evaluate(() => !!UI.byId('wheel'))) await press('wheel');
    check(await page.evaluate(() => Game.scene.homeRun && Game.scene.nightNext()), 'the run home knows bully netting is next');
    await page.evaluate(() => Game.scene.skipTo('home')); await settle(); await page.waitForTimeout(300);
    const nf = await page.evaluate(() => ({ scene: Game.scene.constructor.name, spot: Trip.cur.spot, order: Game.scene.order && Game.scene.order.join(',') }));
    check(nf.scene === 'NightfallScene' && nf.spot === 'bullynet' && nf.order === 'michael,jorge,jemel', 'tied up → the sun goes down; last on the board nets first (' + JSON.stringify(nf) + ')');
    await press('menu'); await press('resume');
    check((await name()) === 'TurnIntroScene' && (await page.evaluate(() => Game.scene.ch)) === 'michael', 'Title from nightfall, then Resume trip → the first netter’s hand-off');
    for (let i = 0; i < 3; i++) {
      await press('ready'); if (await page.evaluate(() => !!(Game.scene.help && UI.byId('help-ok')))) await press('help-ok');
      await page.evaluate(() => { Game.scene.timeLeft = 0.05; });
      await page.waitForFunction(() => Game.scene.constructor.name === 'ResultsScene', null, { timeout: 8000 }).catch(() => {});
      await settle(); await page.evaluate(() => { Game.scene.t = 99; }); await page.waitForTimeout(150);
      const lbl = await page.evaluate(() => Game.scene.nextLabel());
      check(lbl === (i < 2 ? 'Next up: ' + ['Jorge', 'Jemel'][i] : 'Call it a night'), 'night turn ' + (i + 1) + ' → ' + lbl);
      if (i === 1) { await press('title'); await press('resume'); check((await name()) === 'TurnIntroScene' && (await page.evaluate(() => Game.scene.ch)) === 'jemel', 'Title from the results, Resume → Jemel nets next'); continue; }
      if (i === 2) { await press('title'); await press('resume'); } else await press('next');
    }
    const end = await page.evaluate(() => ({ scene: Game.scene.constructor.name, night: Game.scene.night, saved: !!Trip.load() }));
    check(end.scene === 'DayEndScene' && end.night && !end.saved, 'after the last netter (even by way of the title) → the end of the day, under the stars, and the trip is done (' + JSON.stringify(end) + ')');
  } catch (e) { check(false, 'day + night: ' + e.message); }
  check(!(await S.gameErr()) && S.errs.length === 0, 'day + night: no errors' + (S.errs.length ? ' — ' + S.errs.slice(0, 3).join(' | ') : ''));
  await S.ctx.close();
}

{ // ---- on a desktop: the mouse, the keys, and every night screen at three widths ----
  for (const Wd of [1280, 960, 720]) {
    const S = await open({ viewport: { width: Wd, height: 540 } });
    const { page } = S;
    try {
      await page.evaluate(() => { Trip.start({ mode: 'crew', crew: ['michael', 'jorge', 'jemel'], plan: 'full', night: true, sessionLen: 120 }); startNight(Trip.cur); });
      const screens = [['NightfallScene', 'new NightfallScene()'], ['TurnIntroScene', 'new TurnIntroScene()'], ['CrewSetupScene', "new CrewSetupScene({ plan: 'night' })"], ['BriefingScene', "new BriefingScene({ mode: 'crew', crew: ['michael', 'jorge'], plan: 'night', nightRounds: 2, sessionLen: 90 })"], ['HowToScene', 'new HowToScene()']];
      const bad = [];
      for (const [cls, expr] of screens) {
        await page.evaluate((e) => { Game.go(eval(e), true); if (Game.scene.constructor.name === 'HowToScene') Game.scene.page = HOWTO.findIndex((p) => p.art === 'night'); }, expr); await page.waitForTimeout(350);
        const regs = await page.evaluate(() => UI.prev.filter((r) => r.w < Game.W * 0.9).map((r) => ({ id: r.id, x: r.x, y: r.y, w: r.w, h: r.h })));
        for (let i = 0; i < regs.length; i++) for (let j = i + 1; j < regs.length; j++) { const a = regs[i], b = regs[j]; if (a.x < b.x + b.w - 1 && b.x < a.x + a.w - 1 && a.y < b.y + b.h - 1 && b.y < a.y + a.h - 1) bad.push(cls + ': ' + a.id + ' overlaps ' + b.id); }
        const W = await page.evaluate(() => Game.W); for (const a of regs) if (a.x < -1 || a.y < -1 || a.x + a.w > W + 1 || a.y + a.h > 541) bad.push(cls + ': ' + a.id + ' runs off-screen');
        const err = await S.gameErr(); if (err) bad.push(cls + ': ' + err);
      }
      // the night itself: the mouse sweeps the light, Space nets, Esc pauses
      await page.evaluate(() => { Store.set('coach_bully1_jorge', true); Store.set('coach_bullynet_jorge', true); Game.go(new BullyNetScene({ ch: 'jorge', spot: 'bullynet', len: 120, weather: Trip.cur.weather, onEnd: () => {} }), true); });
      await page.waitForTimeout(1300);
      const l0 = await page.evaluate(() => [Game.scene.light.x, Game.scene.light.y]);
      const LW = await page.evaluate(() => Game.W), m1 = await S.at(LW * 0.25, 160), m2 = await S.at(LW * 0.3, 150);
      await page.mouse.move(m1.x, m1.y); await page.mouse.move(m2.x, m2.y, { steps: 6 }); await page.waitForTimeout(500);
      const l1 = await page.evaluate(() => [Game.scene.light.x, Game.scene.light.y]);
      if (Math.hypot(l1[0] - l0[0], l1[1] - l0[1]) < 60) bad.push('the light did not follow the mouse');
      await page.evaluate(() => { const s = Game.scene, bw = s.bow(), b = s.addBug(bw.x, bw.y - 150, { temper: 'calm', cl: 3.6, h: 0 }); b.st = 'idle'; b.stT = 99; s.aimLight(b.x, b.y, b); });
      await page.waitForTimeout(400); await page.keyboard.press('Space'); await page.waitForTimeout(150);
      const st = await page.evaluate(() => Game.scene.net.state);
      if (st === 'carry') bad.push('Space did not drop the net');
      await page.waitForTimeout(800); await page.keyboard.press('Escape'); await page.waitForTimeout(150);
      if (!(await page.evaluate(() => Game.scene.paused))) bad.push('Esc did not pause');
      await page.keyboard.press('Escape');
      const err = await S.gameErr(); if (err) bad.push('night: ' + err);
      check(!bad.length && S.errs.length === 0, Wd + ' wide: the night screens draw, nothing overlaps; the mouse sweeps the light, Space nets, Esc pauses' + (bad.length || S.errs.length ? ' — ' + bad.concat(S.errs).slice(0, 4).join(' | ') : ''));
    } catch (e) { check(false, Wd + ' wide: ' + e.message); }
    await S.ctx.close();
  }
}

await browser.close();
console.log(fails.length ? 'FAILED: ' + fails.length : 'ALL PASS');
process.exitCode = fails.length ? 1 : 0;
