// Navigation click-through: every way in and out of each screen, the pause menu's quit-to-title
// (with its confirm), Resume trip, results -> next, day end -> title. Clicks real buttons by id
// through the UI registry and checks which scene you land on. Also audits every button on each
// screen: does a click do anything, do any two buttons overlap, does any button leave the screen.
//   node test/nav.mjs [repoRoot] [shotDir]
import { chromium } from 'playwright';
import path from 'path'; import fs from 'fs'; import { fileURLToPath } from 'url';
const root = process.argv[2] || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const shotDir = process.argv[3] || null;
if (shotDir) fs.mkdirSync(shotDir, { recursive: true });

const RUNS = [
  { name: '960', W: 960, touch: false, audit: true },
  { name: '720', W: 720, touch: false, audit: true, layoutOnly: false, clickAudit: false },
  { name: '960-touch', W: 960, touch: true, audit: false },
  { name: '1280', W: 1280, touch: false, audit: true, layoutOnly: true }
];
const results = []; const notes = [];
const browser = await chromium.launch();

for (const run of RUNS) {
  const ctxB = await browser.newContext({ viewport: { width: run.W, height: 540 }, deviceScaleFactor: 1, hasTouch: run.touch, isMobile: run.touch });
  const page = await ctxB.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('file://' + root + '/index.html');
  await page.waitForFunction(() => typeof Game !== 'undefined' && Game.scene, null, { timeout: 8000 });
  await page.evaluate(() => { localStorage.clear(); Game.go(new TitleScene(), true); });
  await page.waitForTimeout(400);

  const scene = () => page.evaluate(() => Game.scene.constructor.name);
  const settle = async (ms = 80) => { await page.waitForTimeout(ms); await page.waitForFunction(() => Game.fadeDir !== 1 && !Game.next, null, { timeout: 4000 }).catch(() => {}); await page.waitForTimeout(60); };
  const gameErr = async () => { const ge = await page.evaluate(() => { const e = Game.error; Game.error = null; return e ? String(e.stack || e).split('\n').slice(0, 3).join(' | ') : null; }); if (ge) errs.push(ge); return ge; };
  // click a UI button by id, converting logical coords to CSS pixels
  const click = async (id) => {
    const pt = await page.evaluate((id) => { const r = UI.byId(id); if (!r) return null; return { x: Game.ox + (r.x + r.w / 2) * Game.scale, y: Game.oy + (r.y + r.h / 2) * Game.scale, dis: !!r.disabled }; }, id);
    if (!pt) throw new Error('no button "' + id + '" on ' + (await scene()));
    if (pt.dis) throw new Error('button "' + id + '" is disabled on ' + (await scene()));
    if (run.touch) await page.touchscreen.tap(pt.x, pt.y); else await page.mouse.click(pt.x, pt.y);
    await settle();
  };
  const key = async (code) => { await page.keyboard.press(code); await settle(); };
  const has = (id) => page.evaluate((id) => !!UI.byId(id), id);
  const jump = async (expr, ms = 300) => { await page.evaluate(`Game.go(${expr}, true)`); await page.waitForTimeout(ms); };
  const expectScene = async (want, ctx) => { const got = await scene(); if (got !== want) throw new Error(`${ctx}: expected ${want}, got ${got}`); };
  const fresh = async () => { await page.evaluate(() => { localStorage.clear(); Trip.cur = null; }); await jump('new TitleScene()'); };
  const shot = async (name) => { if (!shotDir || run.touch) return; await page.waitForFunction(() => Game.fade === 0, null, { timeout: 3000 }).catch(() => {}); await page.waitForTimeout(120); await page.screenshot({ path: `${shotDir}/${run.name}-${name}.png` }); };
  const startCrew = (crew = ['michael', 'jorge', 'jemel'], plan = 'half') => page.evaluate(([crew, plan]) => { Trip.start({ mode: 'crew', crew, plan, sessionLen: 90 }); }, [crew, plan]);
  const toTurn = async (spot = 'bughunt', turn = 0) => { await page.evaluate(([s, t]) => { Trip.cur.spot = s; Trip.cur.turn = t; Trip.save(); }, [spot, turn]); await jump('new TurnIntroScene()', 500); };
  // run the clock out on the current fishing turn and wait for the results screen
  const timeOut = async () => {
    await page.evaluate(() => { const s = Game.scene; s.child = null; s.paused = false; s.timeLeft = 0.05; });
    await page.waitForFunction(() => Game.scene.constructor.name === 'ResultsScene' && Game.fadeDir !== 1, null, { timeout: 8000 });
    await page.evaluate(() => { Game.scene.t = 99; }); await page.waitForTimeout(150);
  };
  const path_ = async (name, fn) => {
    if (run.layoutOnly) return;
    try { await fn(); await gameErr(); results.push({ run: run.name, path: name, ok: true }); }
    catch (e) { await gameErr(); results.push({ run: run.name, path: name, ok: false, detail: String(e.message || e).split('\n')[0] }); await page.screenshot({ path: `${shotDir || '/tmp'}/FAIL-${run.name}-${name.replace(/\W+/g, '_')}.png` }).catch(() => {}); }
  };

  // ---------- menu paths ----------
  await path_('title -> crew -> back', async () => {
    await fresh(); await click('crew'); await expectScene('CrewSetupScene', 'crew'); await click('back'); await expectScene('TitleScene', 'back');
    await click('crew'); await key('Escape'); await expectScene('TitleScene', 'Esc from crew setup');
  });
  await path_('title -> solo -> back', async () => {
    await fresh(); await click('solo'); await expectScene('SoloSetupScene', 'solo'); await click('back'); await expectScene('TitleScene', 'back');
    await click('solo'); await key('Escape'); await expectScene('TitleScene', 'Esc from solo setup');
  });
  await path_('title -> logbook -> back', async () => {
    await fresh(); await click('log'); await expectScene('LogbookScene', 'logbook'); await click('back'); await expectScene('TitleScene', 'back');
    await click('log'); await key('Escape'); await expectScene('TitleScene', 'Esc from logbook');
  });
  await path_('title -> howto -> next... -> done', async () => {
    await fresh(); await click('how'); await expectScene('HowToScene', 'howto');
    const pages = await page.evaluate(() => HOWTO.length);
    for (let i = 0; i < pages - 1; i++) { await click('next'); }
    if ((await page.evaluate(() => Game.scene.page)) !== pages - 1) throw new Error('did not reach the last page');
    await click('prev'); await click('next');
    await click('next'); await expectScene('TitleScene', 'last page button');
    await click('how'); await click('next'); await click('back'); await expectScene('TitleScene', 'Done from page 2');
    await click('how'); await key('Escape'); await expectScene('TitleScene', 'Esc from how to');
  });

  // ---------- crew trip: cast off, hand-off, fish, pause, quit, resume ----------
  await path_('crew setup -> cast off -> SeaScene', async () => {
    await fresh(); await click('crew'); await click('half'); await click('len90'); await click('go');
    await page.waitForTimeout(300); await expectScene('SeaScene', 'cast off');
    const saved = await page.evaluate(() => !!Trip.load()); if (!saved) throw new Error('crew trip not saved after cast off');
  });
  await path_('turn intro -> ready -> fish -> pause -> quit to title -> confirm -> resume -> turn intro', async () => {
    await fresh(); await startCrew(); await toTurn('bughunt', 0);
    await expectScene('TurnIntroScene', 'jump'); await shot('turnintro-first');
    await click('ready'); await page.waitForTimeout(400); await expectScene('BugHuntScene', 'ready');
    await click('pause'); if (!(await page.evaluate(() => Game.scene.paused))) throw new Error('pause button did not pause');
    await shot('pause-crew');
    await click('resume'); if (await page.evaluate(() => Game.scene.paused)) throw new Error('resume did not resume');
    await key('Escape'); if (!(await page.evaluate(() => Game.scene.paused))) throw new Error('Esc did not pause');
    await key('Escape'); if (await page.evaluate(() => Game.scene.paused)) throw new Error('Esc did not resume');
    await key('KeyP'); await key('KeyP'); if (await page.evaluate(() => Game.scene.paused)) throw new Error('P twice should leave it running');
    await key('Escape'); await click('totitle'); if (!(await page.evaluate(() => Game.scene.quitAsk))) throw new Error('quit to title did not ask');
    await shot('quit-confirm-crew');
    await click('quitno'); if (await page.evaluate(() => Game.scene.quitAsk || !Game.scene.paused)) throw new Error('Cancel should go back to the pause menu');
    await click('totitle'); await key('Escape'); if (await page.evaluate(() => Game.scene.quitAsk || !Game.scene.paused)) throw new Error('Esc on confirm should go back to the pause menu');
    const t0 = await page.evaluate(() => Game.scene.timeLeft); await page.waitForTimeout(400);
    if (t0 !== await page.evaluate(() => Game.scene.timeLeft)) throw new Error('clock runs while paused');
    await click('totitle'); await click('quityes'); await expectScene('TitleScene', 'quit confirmed');
    const st = await page.evaluate(() => Trip.load()); if (!st || st.spot !== 'bughunt' || st.turn !== 0) throw new Error('saved trip lost its spot/turn: ' + JSON.stringify(st && { spot: st.spot, turn: st.turn }));
    if (!(await has('resume'))) throw new Error('no Resume trip on the title after quitting');
    await shot('title-saved');
    await click('resume'); await expectScene('TurnIntroScene', 'resume');
    const who = await page.evaluate(() => Trip.cur.crew[Trip.cur.turn] + '@' + Trip.cur.spot); if (who !== 'michael@bughunt') throw new Error('resumed to ' + who);
  });
  await path_('turn intro (turn 0): back to the boat / Esc -> SeaScene, Title -> TitleScene', async () => {
    await fresh(); await startCrew(); await toTurn('bottom', 0);
    await click('chart'); await page.waitForTimeout(300); await expectScene('SeaScene', 'back to the boat');
    if (await page.evaluate(() => Trip.cur.spot)) throw new Error('spot not cleared when going back to the boat');
    await toTurn('bottom', 0); await key('Escape'); await expectScene('SeaScene', 'Esc on first hand-off');
    await toTurn('bottom', 0); await click('menu'); await expectScene('TitleScene', 'Title from hand-off');
    await click('resume'); await expectScene('TurnIntroScene', 'resume after Title from hand-off');
  });
  await path_('results -> next (each angler) -> back to the boat; Title on later hand-off; Results Title', async () => {
    await fresh(); await startCrew(['michael', 'jorge', 'jemel'], 'half'); await toTurn('bottom', 0);
    await click('ready'); await page.waitForTimeout(300); await expectScene('BottomScene', 'ready');
    await timeOut(); await shot('results-next');
    let lb = await page.evaluate(() => Game.scene.nextLabel()); if (lb !== 'Next up: Jorge') throw new Error('results label ' + lb);
    const st = await page.evaluate(() => Trip.load()); if (st.turn !== 1) throw new Error('turn not counted at results (saved turn ' + st.turn + ')');
    await click('next'); await expectScene('TurnIntroScene', 'next');
    if (await has('chart')) throw new Error('Back to the boat should be gone once someone has fished the spot');
    await shot('turnintro-later');
    await key('Escape'); await expectScene('TitleScene', 'Esc on later hand-off');
    await click('resume'); await expectScene('TurnIntroScene', 'resume to Jorge');
    if ((await page.evaluate(() => Trip.cur.crew[Trip.cur.turn])) !== 'jorge') throw new Error('resume lost Jorge');
    await click('ready'); await page.waitForTimeout(300); await timeOut();
    lb = await page.evaluate(() => Game.scene.nextLabel()); if (lb !== 'Next up: Jemel') throw new Error('results label ' + lb);
    await click('title'); await expectScene('TitleScene', 'Results Title');
    await click('resume'); await expectScene('TurnIntroScene', 'resume to Jemel');
    if ((await page.evaluate(() => Trip.cur.crew[Trip.cur.turn])) !== 'jemel') throw new Error('Results -> Title -> Resume did not go to Jemel');
    await click('ready'); await page.waitForTimeout(300); await timeOut();
    lb = await page.evaluate(() => Game.scene.nextLabel()); if (lb !== 'Back to the boat') throw new Error('last angler label ' + lb);
    await click('next'); await page.waitForTimeout(300); await expectScene('SeaScene', 'last angler next');
    const c = await page.evaluate(() => ({ spot: Trip.cur.spot, done: Trip.cur.done, turn: Trip.cur.turn })); if (c.spot || c.turn || !c.done.includes('bottom')) throw new Error('spot not closed out ' + JSON.stringify(c));
  });
  await path_('results on the last spot -> Run home -> SeaScene(home)', async () => {
    await fresh(); await startCrew(['michael'], 'half'); await page.evaluate(() => { Trip.cur.done = ['bughunt']; });
    await toTurn('flats', 0); await click('ready'); await page.waitForTimeout(300); await expectScene('FlatsScene', 'ready');
    await timeOut(); const lb = await page.evaluate(() => Game.scene.nextLabel()); if (lb !== 'Run home') throw new Error('label ' + lb);
    await click('next'); await page.waitForTimeout(300); await expectScene('SeaScene', 'run home');
    if (!(await page.evaluate(() => Game.scene.homeRun))) throw new Error('sea scene not on the run home');
  });
  await path_('fight: pause button + Esc pause the fight, quit from a fight', async () => {
    await fresh(); await startCrew(['jorge', 'jemel']); await toTurn('bottom', 0);
    await click('ready'); await page.waitForTimeout(300);
    await page.evaluate(() => Game.scene.startFight({ sp: 'blackgrouper', weight: 30, ctxType: 'reef', depth: 90 })); await page.waitForTimeout(500);
    await shot('fight');
    await click('pause'); if (!(await page.evaluate(() => Game.scene.paused))) throw new Error('fight pause button did not pause');
    const f0 = await page.evaluate(() => Game.scene.child.t); await page.waitForTimeout(300);
    if (f0 !== await page.evaluate(() => Game.scene.child.t)) throw new Error('fight keeps running while paused');
    await shot('fight-paused');
    await key('Escape'); if (await page.evaluate(() => Game.scene.paused)) throw new Error('Esc did not resume the fight');
    await key('Escape'); await click('totitle'); await click('quityes'); await expectScene('TitleScene', 'quit from fight');
    const st = await page.evaluate(() => Trip.load()); if (st.spot !== 'bottom' || st.turn !== 0) throw new Error('quit from fight changed the trip');
  });
  await path_('pause: End my turn now -> results', async () => {
    await fresh(); await startCrew(['jemel']); await toTurn('troll', 0);
    await click('ready'); await page.waitForTimeout(300); await expectScene('TrollScene', 'ready');
    await click('pause'); await click('quit');
    await page.waitForFunction(() => Game.scene.constructor.name === 'ResultsScene', null, { timeout: 6000 });
  });

  // ---------- solo ----------
  await path_('solo: head out -> SeaScene; quit to title from a turn', async () => {
    await fresh(); await click('solo'); await click('card2'); await click('go'); await page.waitForTimeout(300); await expectScene('SeaScene', 'head out');
    await toTurn('flats', 0); await shot('turnintro-solo');
    await click('ready'); await page.waitForTimeout(300); await expectScene('FlatsScene', 'ready');
    await click('pause'); await click('totitle'); await shot('quit-confirm-solo');
    await click('quityes'); await expectScene('TitleScene', 'solo quit');
    if (await has('resume')) throw new Error('solo day should not offer Resume trip');
  });
  await path_('solo: results -> back to the boat', async () => {
    await fresh(); await page.evaluate(() => Trip.start({ mode: 'solo', crew: ['michael'], plan: 'solo', sessionLen: 90 }));
    await toTurn('bughunt', 0); await click('ready'); await page.waitForTimeout(300); await timeOut();
    const lb = await page.evaluate(() => Game.scene.nextLabel()); if (lb !== 'Back to the boat') throw new Error('label ' + lb);
    await click('next'); await page.waitForTimeout(300); await expectScene('SeaScene', 'solo next');
  });

  // ---------- day end ----------
  await path_('day end -> title / new trip / logbook / Esc', async () => {
    await fresh(); await startCrew(); await jump('new DayEndScene()', 600); await shot('dayend-crew');
    if (await page.evaluate(() => !!Trip.load())) throw new Error('finished trip still offered for resume');
    await click('title'); await expectScene('TitleScene', 'title');
    await startCrew(); await jump('new DayEndScene()', 500); await click('again'); await expectScene('CrewSetupScene', 'new trip');
    await startCrew(); await jump('new DayEndScene()', 500); await click('log'); await expectScene('LogbookScene', 'logbook'); await click('back'); await expectScene('TitleScene', 'logbook back');
    await startCrew(); await jump('new DayEndScene()', 500); await key('Escape'); await expectScene('TitleScene', 'Esc');
    await page.evaluate(() => Trip.start({ mode: 'solo', crew: ['jemel'], plan: 'solo', sessionLen: 90 })); await jump('new DayEndScene()', 500);
    if ((await page.evaluate(() => UI.byId('again') && Game.scene.c.mode)) !== 'solo') throw new Error('solo day end');
    await click('again'); await expectScene('SoloSetupScene', 'solo new day');
  });

  // ---------- audit: every button on each screen does something, nothing overlaps or runs off-screen ----------
  if (run.audit) {
    const SCREENS = [
      ['Title', async () => { await fresh(); }],
      ['Title+saved', async () => { await fresh(); await startCrew(); await jump('new TitleScene()'); }],
      ['CrewSetup', async () => { await fresh(); await jump('new CrewSetupScene()'); }],
      ['CrewSetup+saved', async () => { await fresh(); await startCrew(); await jump('new CrewSetupScene()'); }],
      ['SoloSetup', async () => { await fresh(); await jump('new SoloSetupScene()'); }],
      ['TurnIntro first', async () => { await fresh(); await startCrew(); await toTurn('bughunt', 0); }],
      ['TurnIntro later', async () => { await fresh(); await startCrew(); await toTurn('bughunt', 1); }],
      ['Results', async () => { await fresh(); await startCrew(); await page.evaluate(() => { Trip.cur.spot = 'bottom'; const c = makeCatch('redgrouper', 12, 'michael', 'bottom'); const res = { catches: [c], lines: [{ label: 'Red grouper', pts: c.pts, key: 'redgrouper' }], total: c.pts, best: c }; Trip.record('michael', 'bottom', res); Game.go(new ResultsScene('michael', 'bottom', res, advanceTrip()), true); }); await page.waitForTimeout(400); await page.evaluate(() => { Game.scene.t = 99; }); await page.waitForTimeout(200); }],
      ['DayEnd', async () => { await fresh(); await startCrew(); await jump('new DayEndScene()', 500); }],
      ['Logbook', async () => { await fresh(); await jump('new LogbookScene()'); }],
      ['HowTo p1', async () => { await fresh(); await jump('new HowToScene()'); }],
      ['HowTo last', async () => { await fresh(); await jump('new HowToScene()'); await page.evaluate(() => { Game.scene.page = HOWTO.length - 1; }); await page.waitForTimeout(100); }],
      ['Pause menu', async () => { await fresh(); await startCrew(); await toTurn('bottom', 0); await click('ready'); await page.waitForTimeout(300); await click('pause'); }, true],
      ['Quit confirm', async () => { await fresh(); await startCrew(); await toTurn('bottom', 0); await click('ready'); await page.waitForTimeout(300); await click('pause'); await click('totitle'); }, true]
    ];
    const snap = () => page.evaluate(() => {
      const s = Game.scene, o = {};
      for (const k of Object.keys(s)) {
        if (/^(t|shown|endT|fade|bob|time|timeLeft|age|scroll)$/.test(k)) continue;
        const v = s[k];
        if (v === null || ['number', 'string', 'boolean'].includes(typeof v)) o[k] = v; else if (v instanceof Set) o[k] = [...v].join(',');
      }
      return JSON.stringify({ sc: s.constructor.name, next: Game.next ? Game.next.constructor.name : null, o, m: SFX.muted, mu: Music.on, trip: Trip.cur && JSON.stringify(Trip.cur) });
    });
    for (const [name, setup, pausedScreen] of SCREENS) {
      try {
        await setup();
        const regs = await page.evaluate((onlyEnabled) => UI.prev.filter((r) => !onlyEnabled || !r.disabled).map((r) => ({ id: r.id, x: r.x, y: r.y, w: r.w, h: r.h, dis: !!r.disabled, full: r.w >= Game.W * 0.9 && r.h >= Game.H * 0.9 })), !!pausedScreen);
        const W = await page.evaluate(() => Game.W);
        for (const r of regs) if (r.x < -1 || r.y < -1 || r.x + r.w > W + 1 || r.y + r.h > 541) notes.push(`${run.name} ${name}: button "${r.id}" runs off-screen (${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.w)}x${Math.round(r.h)})`);
        const solid = regs.filter((r) => !r.full);
        for (let i = 0; i < solid.length; i++) for (let j = i + 1; j < solid.length; j++) {
          const a = solid[i], b = solid[j];
          if (a.x < b.x + b.w - 1 && b.x < a.x + a.w - 1 && a.y < b.y + b.h - 1 && b.y < a.y + a.h - 1) notes.push(`${run.name} ${name}: "${a.id}" overlaps "${b.id}"`);
        }
        if (run.layoutOnly || run.clickAudit === false) continue;
        for (const r of regs) {
          if (r.full) continue;
          if (r.dis) { notes.push(`${run.name} ${name}: "${r.id}" is disabled here`); continue; }
          await setup();
          if (!(await has(r.id))) { notes.push(`${run.name} ${name}: "${r.id}" missing after re-setup`); continue; }
          // a choice that's already picked (Full day, 2 min, the selected solo angler) has nothing to change
          const picked = await page.evaluate((id) => { const s = Game.scene; return id === s.plan || id === 'len' + s.len || (typeof s.ch === 'string' && id === 'card' + CHAR_ORDER.indexOf(s.ch)); }, r.id);
          const before = await snap();
          const pt = await page.evaluate((id) => { const q = UI.byId(id); return { x: Game.ox + (q.x + q.w / 2) * Game.scale, y: Game.oy + (q.y + q.h / 2) * Game.scale }; }, r.id);
          await page.mouse.click(pt.x, pt.y); await page.waitForTimeout(60);
          const after = await snap();
          if (before === after && !picked) notes.push(`${run.name} ${name}: clicking "${r.id}" DID NOTHING`);
          await settle(); await gameErr();
        }
      } catch (e) { notes.push(`${run.name} audit ${name}: ${String(e.message || e).split('\n')[0]}`); }
    }
  }

  // ---------- screenshots of the changed screens at this width ----------
  if (shotDir && !run.touch) {
    await fresh(); await shot('title');
    await startCrew(); await jump('new TitleScene()'); await shot('title-saved2');
    await jump('new CrewSetupScene()'); await shot('crewsetup-saved');
    await jump('new HowToScene()'); await page.evaluate(() => { Game.scene.page = HOWTO.length - 1; }); await page.waitForTimeout(150); await shot('howto-last');
    await page.evaluate(() => Trip.start({ mode: 'solo', crew: ['jemel'], plan: 'solo', sessionLen: 90 })); await jump('new DayEndScene()', 900); await shot('dayend-solo');
    if (run.layoutOnly) {
      await startCrew(); await toTurn('bughunt', 0); await shot('turnintro-first'); await toTurn('bughunt', 1); await shot('turnintro-later');
      await click('ready'); await page.waitForTimeout(400); await click('pause'); await shot('pause-crew'); await click('totitle'); await shot('quit-confirm-crew');
      await jump('new BottomScene({ch:"jorge", spot:"bottom", len:90, weather:Trip.cur.weather, onEnd:()=>{}})', 500);
      await page.evaluate(() => Game.scene.startFight({ sp: 'blackgrouper', weight: 30, ctxType: 'reef', depth: 90 })); await page.waitForTimeout(500); await shot('fight');
      await click('pause'); await shot('fight-paused');
      await jump('new LogbookScene()'); await shot('logbook');
    }
  }
  await gameErr();
  if (errs.length) notes.push(`${run.name} console/page errors:\n  ` + [...new Set(errs)].join('\n  '));
  await ctxB.close();
}
await browser.close();

const pad = (s, n) => (s + ' '.repeat(n)).slice(0, n);
let fails = 0;
for (const r of results) { if (!r.ok) fails++; console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${pad(r.run, 10)} ${r.path}${r.ok ? '' : '\n        ' + r.detail}`); }
console.log(`\n${results.length - fails}/${results.length} paths passed`);
if (notes.length) console.log('\nNOTES\n' + [...new Set(notes)].map((n) => '- ' + n).join('\n'));
process.exit(fails ? 1 : 0);
