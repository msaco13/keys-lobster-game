// Smoke test for the built single-file game (dist/keys-crew.html): the page the players actually get.
// Runs before every deploy and on every pull request, so it stays quick (about a minute) and checks only that
// nothing is broken outright:
//   - it loads with no errors, on a phone (touch) and on a desktop
//   - a real crew trip by tapping buttons: title → crew pick → briefing → the captain's hand-off → the boat → a turn
//     → results → the boat
//   - on the phone, a tap just outside a small button (pause, a chart pin) still presses it
//   - every fishing spot opens and runs a few seconds, with a fish fight at each kind of spot
//   - Night Run on the title goes bully netting: tonight's bounties, the hand-off, the night itself (test/night.mjs
//     plays it properly)
//   - a broken or out-of-date save, and a browser that won't save at all, don't take the title screen down
// Exits 1 on any failure.
//   node test/smoke.mjs [path/to/keys-crew.html]
import { chromium } from 'playwright';
import path from 'path'; import fs from 'fs'; import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url));
const file = path.resolve(process.argv[2] || path.join(here, '..', 'dist', 'keys-crew.html'));
if (!fs.existsSync(file)) { console.error('no such file: ' + file + ' (run npm run build first)'); process.exit(1); }
const url = 'file://' + file;
const fails = []; const check = (ok, what) => { console.log((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) fails.push(what); };
const browser = await chromium.launch();

async function open(o) {
  const ctx = await browser.newContext({ viewport: o.viewport, deviceScaleFactor: 1, hasTouch: !!o.touch, isMobile: !!o.touch });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_|net::|Failed to load resource/i.test(m.text())) errs.push(m.text()); });
  if (o.init) await page.addInitScript(o.init, o.arg);
  await page.goto(url);
  await page.waitForFunction(() => typeof Game !== 'undefined' && Game.scene, null, { timeout: 15000 });
  await page.waitForTimeout(300);
  const name = () => page.evaluate(() => Game.scene.constructor.name);
  const gameErr = () => page.evaluate(() => { const e = Game.error; Game.error = null; return e ? String(e.stack || e).split('\n').slice(0, 3).join(' | ') : null; });
  const settle = async () => { await page.waitForTimeout(120); await page.waitForFunction(() => Game.fadeDir !== 1 && !Game.next, null, { timeout: 8000 }).catch(() => {}); await page.waitForTimeout(80); };
  // a real tap or click on a button, by its id, at its spot on screen
  const press = async (id) => {
    const pt = await page.evaluate((id) => { const r = UI.byId(id); return r && !r.disabled ? { x: Game.ox + (r.x + r.w / 2) * Game.scale, y: Game.oy + (r.y + r.h / 2) * Game.scale } : null; }, id);
    if (!pt) throw new Error('no button "' + id + '" on ' + (await name()));
    if (o.touch) await page.touchscreen.tap(pt.x, pt.y); else await page.mouse.click(pt.x, pt.y);
    await settle();
  };
  // the picture isn't blank: some pixels in the middle of the canvas differ from each other
  const drawn = () => page.evaluate(() => { const c = document.getElementById('game'), g = c.getContext('2d'), d = g.getImageData(0, Math.floor(c.height / 2), c.width, 1).data; const seen = new Set(); for (let i = 0; i < d.length; i += 4 * 8) seen.add(d[i] + ',' + d[i + 1] + ',' + d[i + 2]); return seen.size; });
  return { ctx, page, errs, name, gameErr, settle, press, drawn };
}

for (const dev of [{ label: 'phone', viewport: { width: 844, height: 390 }, touch: true }, { label: 'desktop', viewport: { width: 1280, height: 720 } }]) {
  const S = await open(Object.assign({ init: () => localStorage.clear() }, dev));
  const { page, errs, name, gameErr, press, drawn } = S;
  try {
    check((await name()) === 'TitleScene' && (await drawn()) > 4, dev.label + ': title screen is up and drawn');
    // a crew trip, the way a player starts one
    await press('crew'); check((await name()) === 'CrewSetupScene', dev.label + ': Crew Trip → crew pick');
    await press('go'); check((await name()) === 'BriefingScene', dev.label + ': Let’s go → the day’s briefing');
    await press('castoff'); check((await name()) === 'SeaScene', dev.label + ': Cast off → the boat');
    const handoff = await page.evaluate(() => !!UI.byId('wheel')); await press('wheel');
    check(handoff && !(await page.evaluate(() => Game.scene.panel)), dev.label + ': the captain gets the phone, then takes the wheel');
    await page.waitForTimeout(1500);
    check((await drawn()) > 4 && !(await gameErr()), dev.label + ': the boat ride runs (' + (await page.evaluate(() => (Game.scene.uses3D() ? '3D' : 'classic'))) + ')');
    // with the autopilot driving, a quick tap on the water leaves it on; holding takes the wheel
    if (!dev.touch) {
      await page.evaluate(() => { const s = Game.scene; Game.toasts = []; s.dest = 'bottom'; s.planRoute(); s.setAuto(true); });
      const at = { x: dev.viewport.width * 0.7, y: dev.viewport.height * 0.55 };
      await page.mouse.click(at.x, at.y); await page.waitForTimeout(400);
      const afterTap = await page.evaluate(() => Game.scene.auto);
      await page.mouse.move(at.x, at.y); await page.mouse.down(); await page.waitForTimeout(600); await page.mouse.up(); await page.waitForTimeout(100);
      const afterHold = await page.evaluate(() => Game.scene.auto);
      check(afterTap === true && afterHold === false, dev.label + ': a stray tap leaves the autopilot on; a hold takes the wheel (' + afterTap + ', ' + afterHold + ')');
    }
    // on a phone a small button answers a tap just outside it: pause, and a pin on the chart
    if (dev.touch) {
      const tapAt = async (x, y) => { const pt = await page.evaluate(([x, y]) => ({ x: Game.ox + x * Game.scale, y: Game.oy + y * Game.scale }), [x, y]); await page.touchscreen.tap(pt.x, pt.y); await S.settle(); };
      const pz = await page.evaluate(() => { Game.toasts = []; const r = UI.byId('pause'); return { x: r.x + r.w / 2, y: r.y + r.h + 6 }; });
      await tapAt(pz.x, pz.y);
      const paused = await page.evaluate(() => Game.scene.panel && Game.scene.panel.kind);
      if (paused === 'pause') await press('resume');
      await press('chart');
      const pin = await page.evaluate(() => {
        const pins = UI.prev.filter((r) => r.id.startsWith('chartpin-')), c = (r) => [r.x + r.w / 2, r.y + r.h / 2];
        const lonely = pins.map((r) => ({ r, gap: Math.min(...pins.filter((q) => q !== r).map((q) => Math.hypot(c(q)[0] - c(r)[0], c(q)[1] - c(r)[1]))) })).sort((a, b) => b.gap - a.gap)[0].r;
        return { id: lonely.id.slice(9), x: lonely.x + lonely.w + 8, y: lonely.y + lonely.h / 2 };
      });
      await tapAt(pin.x, pin.y);
      const sel = await page.evaluate(() => Game.scene.sel);
      check(paused === 'pause' && sel === pin.id, dev.label + ': a tap just outside a small button still presses it (pause: ' + paused + ', chart pin ' + pin.id + ': ' + sel + ')');
      await press('chartclose');
    }
    // where to go: the chart's picker lights up the lobster spots and the bay side, and the way to the bay goes
    // through a creek. Steering yourself, the arrow leads along the course, not over the islands.
    await press('chart'); await press('cat-lobster');
    const lob = await page.evaluate(() => ({ id: Game.scene.sel, mode: SPOTS[Game.scene.sel] && SPOTS[Game.scene.sel].mode }));
    await press('cat-bay');
    const bay = await page.evaluate(() => { const s = Game.scene, g = s.wayTo('flats'); return { sel: s.sel, via: g && g.name }; });
    check(lob.mode === 'bughunt' && bay.sel === 'flats' && !!bay.via, dev.label + ': the chart picks the lobster spot and the bay side, and the way to the bay goes through a creek (' + JSON.stringify([lob, bay]) + ')');
    await press('setcourse');
    const guide = await page.evaluate(() => { const s = Game.scene; s.auto = false; s.x = 8650; s.y = wy(8650, 900); s.planRoute(true); const g = s.guideXY(), via = creekOn(s.path, s.x, s.y, 1); return { dest: s.dest, via: via && via.name, bay: baySide(g[0], g[1]) }; });
    check(guide.dest === 'flats' && !!guide.via && guide.bay === false, dev.label + ': steering yourself, the arrow leads to the creek first (' + JSON.stringify(guide) + ')');
    // skip the ride to the nearest charted spot and fish it
    await page.evaluate(() => { const s = Game.scene; s.skipTo('bughunt'); });
    await S.settle(); await page.waitForTimeout(300);
    check((await name()) === 'TurnIntroScene', dev.label + ': skipping the ride → straight to the hand-off');
    await press('ready'); await page.waitForTimeout(1500);
    check((await name()) === 'BugHuntScene' && !(await gameErr()), dev.label + ': I’m ready → Bug Hunt runs');
    // a first dive opens the how-to card and the clock waits on it; Got it starts the dive
    const card = await page.evaluate(() => ({ help: !!Game.scene.help, left: Game.scene.timeLeft }));
    await press('help-ok'); await page.waitForTimeout(600);
    const dive = await page.evaluate(() => ({ help: !!Game.scene.help, left: Game.scene.timeLeft }));
    check(card.help && card.left >= 119.9 && !dive.help && dive.left < card.left, dev.label + ': first dive shows how to catch a bug; Got it starts the clock (' + JSON.stringify([card, dive]) + ')');
    await page.waitForTimeout(900);
    const coach = await page.evaluate(() => { const s = Game.scene, b = s.coachBug(); return { coach: s.coach, arrow: !!b }; });
    check(coach.coach && coach.arrow, dev.label + ': a first dive points the way to a bug (' + JSON.stringify(coach) + ')');
    await page.evaluate(() => { const s = Game.scene; s.timeLeft = 0.05; });
    await page.waitForFunction(() => Game.scene.constructor.name === 'ResultsScene', null, { timeout: 15000 }).catch(() => {});
    await S.settle();
    check((await name()) === 'ResultsScene', dev.label + ': time’s up → results');
    await page.evaluate(() => { Game.scene.t = 99; }); await page.waitForTimeout(200);
    await press('next');
    check(['TurnIntroScene', 'SeaScene'].includes(await name()) && !(await gameErr()), dev.label + ': results → next angler (' + (await name()) + ')');
    const saved = await page.evaluate(() => { const t = JSON.parse(localStorage.getItem('keyscrew_trip') || 'null'); return t && t.turns && t.turns.length; });
    check(saved >= 1, dev.label + ': the trip is saved with the turn on it');
    // the second leg's captain (the next angler) brings the boat to the next spot and fishes it first
    const order = await page.evaluate(() => { const c = Trip.cur; c.spot = null; c.turn = 0; c.legs = 1; Game.go(new SeaScene(), true); const S = Game.scene; S.skipTo('bottom');
      return { captain: S.driver, first: Trip.angler(c, 0), order: c.crew.map((_, i) => Trip.angler(c, i)), crew: c.crew.slice() }; });
    await S.settle();
    check(order.captain === order.crew[1] && order.first === order.captain && new Set(order.order).size === order.crew.length && (await page.evaluate(() => Game.scene.ch)) === order.captain, dev.label + ': the captain fishes the spot first, then the rest in turn (' + order.order.join(' → ') + ')');
    // every kind of spot opens, runs, and has a fish fight
    for (const [cls, spot, fight] of [['BottomScene', 'wreck', { sp: 'amberjack', weight: 30, ctxType: 'reef', depth: 100 }], ['TrollScene', 'troll', { sp: 'mahi', weight: 20, ctxType: 'offshore' }], ['FlatsScene', 'flats', { sp: 'redfish', weight: 8, ctxType: 'flats' }], ['BullyNetScene', 'bullynet', null], ['BugHuntScene', 'alligator', null], ['BugHuntScene', 'bayrocks', null]]) {
      await page.evaluate(([cls, spot]) => { Game.go(new (eval(cls))({ ch: 'jorge', spot, len: 120, weather: Trip.cur.weather, onEnd: () => {} }), true); }, [cls, spot]);
      await page.waitForTimeout(1500);
      let ok = (await name()) === cls && !(await gameErr());
      if (fight) { await page.evaluate((f) => Game.scene.startFight(f), fight); await page.waitForTimeout(1500); ok = ok && (await page.evaluate(() => !!Game.scene.child)) && !(await gameErr()); }
      check(ok, dev.label + ': ' + spot + ' runs' + (fight ? ', with a fish fight' : ''));
    }
    // more lobster: the new spots are on the chart (one to find), and a lobster spot asks you to dive, not fish
    const more = await page.evaluate(() => ({ known: ['bayrocks', 'pickles'].every((id) => Charts.isKnown(id)), hidden: !Charts.isKnown('patches'), dive: spotDo('pickles'), fish: spotDo('troll').here, bay: !!(Game.scene.site && Game.scene.site.bay) }));
    check(more.known && more.hidden && more.dive.here === 'Dive for lobster' && more.dive.go === 'Let’s go lobstering' && more.fish === 'Fish here' && more.bay, dev.label + ': new lobster spots, the bayside dive, and lobster spots say dive (' + JSON.stringify(more) + ')');
    // the flats: the first visit opens how to catch one, then the coaching rings the fish your buddy calls; the eat
    // leaves time for a strip at the fish's own pace, and the first hook ends the coaching
    {
      await page.evaluate(() => { Store.set('coach_flats1_jemel', false); Store.set('coach_flatset_jemel', false); Game.go(new FlatsScene({ ch: 'jemel', spot: 'flats', len: 120, weather: Trip.cur.weather, onEnd: () => {} }), true); });
      await page.waitForTimeout(700);
      const card = await page.evaluate(() => ({ help: !!Game.scene.help, left: Game.scene.timeLeft }));
      await press('help-ok');
      const fl = await page.evaluate(() => {
        const s = Game.scene; for (let i = 0; i < 1200 && !s.coachFish(); i++) s.update(1 / 30);
        const f = s.coachFish(); if (!f) return { coach: s.coach, help: !!s.help, fish: false };
        s.lure = { x: f.x + Math.cos(f.hd) * f.len * 0.3, y: f.y + Math.sin(f.hd) * f.len * 0.3, t: 0, hop: 0 }; f.state = 'follow'; f.interest = 1.2; f.lastStrip = s.t; s.update(1 / 30);
        const win = s.eat ? +(s.eat.t0 - f.sp.strip).toFixed(2) : null; s.setHook();
        return { coach: s.coach, help: !!s.help, fish: true, spare: win, done: Store.get('coach_flatset_jemel', false) };
      });
      check(card.help && card.left >= 119.9 && !fl.help && fl.fish && fl.spare >= 0.25 && fl.done && !fl.coach && !(await gameErr()), dev.label + ': the flats show how, ring the called fish, give time to set, and stop coaching after the first hook (' + JSON.stringify([card, fl]) + ')');
    }
    // bully netting at night, from the title: Night Run → go → cast off (over the saved trip) → the first netter
    {
      await page.evaluate(() => Game.go(new TitleScene(), true)); await S.settle();
      await press('night'); await press('go'); await press('castoff');
      if (await page.evaluate(() => !!UI.byId('ask-replace'))) await press('ask-replace');
      const handoff = await name(); await press('ready'); await page.waitForTimeout(800);
      const st = await page.evaluate(() => ({ scene: Game.scene.constructor.name, help: !!Game.scene.help, light: !!(Game.scene.light) }));
      if (st.help) await press('help-ok');
      await page.waitForTimeout(1200);
      const on = await page.evaluate(() => Game.scene.light && Game.scene.light.on);
      check(handoff === 'TurnIntroScene' && st.scene === 'BullyNetScene' && on && !(await gameErr()), dev.label + ': Night Run → tonight’s bounties → the hand-off → bully netting, light on (' + JSON.stringify(st) + ')');
    }
    for (const cls of ['LogbookScene', 'HowToScene', 'TitleScene']) { await page.evaluate((cls) => Game.go(new (eval(cls))(), true), cls); await page.waitForTimeout(500); check((await name()) === cls && !(await gameErr()), dev.label + ': ' + cls + ' opens'); }
  } catch (e) { check(false, dev.label + ': ' + e.message); }
  check(errs.length === 0, dev.label + ': no errors' + (errs.length ? ' — ' + errs.slice(0, 5).join(' | ') : ''));
  await S.ctx.close();
}

// saves that would have broken the title screen: garbage, an older shape, a trip with a character or spot that's gone
for (const [label, val] of [['garbage', '{not json'], ['wrong shape', '{"crew":"jorge"}'], ['missing angler', '{"mode":"crew","crew":["nobody"],"done":[],"scores":{}}'], ['old version', '{"mode":"crew","crew":["jorge","jemel"],"spot":null}'], ['bad records', null]]) {
  const S = await open({ viewport: { width: 960, height: 540 }, arg: [label, val], init: (v) => { localStorage.clear(); if (v[1] != null) localStorage.setItem('keyscrew_trip', v[1]); else { localStorage.setItem('keyscrew_records', '[1,2,3]'); localStorage.setItem('keyscrew_charted', '{"a":1}'); localStorage.setItem('keyscrew_trips', '"x"'); } } });
  await S.page.evaluate(() => {}).catch(() => {});
  const st = await S.page.evaluate(() => ({ scene: Game.scene.constructor.name, err: Game.error && String(Game.error) }));
  const resumes = label === 'old version' ? await S.page.evaluate(() => { const b = UI.byId('resume'); if (!b) return 'no resume button'; b.fn(); return null; }) : null;
  if (label === 'old version') { await S.settle(); await S.page.waitForTimeout(800); }
  const after = await S.page.evaluate(() => ({ scene: Game.scene.constructor.name, err: Game.error && String(Game.error) }));
  check(st.scene === 'TitleScene' && !st.err && !after.err && !resumes && (await S.drawn()) > 4 && S.errs.length === 0, 'save "' + label + '": title still works' + (label === 'old version' ? ' and Resume trip opens ' + after.scene : '') + (st.err || after.err || resumes ? ' (' + (st.err || after.err || resumes) + ')' : '') + (S.errs.length ? ' ' + S.errs[0] : ''));
  await S.ctx.close();
}
{ // a browser that won't save at all (private mode, full storage): plays on and says so once
  const S = await open({ viewport: { width: 960, height: 540 }, init: () => { localStorage.clear(); Storage.prototype.setItem = function () { throw new Error('QuotaExceededError'); }; } });
  await S.press('crew'); await S.press('go'); await S.press('castoff'); await S.page.waitForTimeout(400);
  const st = await S.page.evaluate(() => ({ scene: Game.scene.constructor.name, err: Game.error && String(Game.error), failed: !!Store.failed, toast: Game.toasts.map((t) => t.msg).join('|') }));
  check(st.scene === 'SeaScene' && !st.err && st.failed && /won’t save/.test(st.toast) && S.errs.length === 0, 'no storage: the trip still starts and the game says it won’t save (' + JSON.stringify(st) + ')');
  await S.ctx.close();
}
await browser.close();
console.log(fails.length ? 'FAILED: ' + fails.length : 'ALL PASS');
process.exitCode = fails.length ? 1 : 0;
