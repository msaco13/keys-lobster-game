// A whole crew trip on a phone-sized screen, tapping real buttons: cast off, pick a spot on the chart,
// skip the ride, everyone fishes, back on the boat, the run home, the end of the day.
import { chromium } from 'playwright';
const root = process.argv[2], out = process.argv[3], W = +(process.argv[4] || 844), H = +(process.argv[5] || 390), touch = process.argv[6] === 'touch';
// GFX=3d plays it with the 3D boat ride forced on (headless Chromium draws WebGL in software, so it's slow but real)
const browser = await chromium.launch(process.env.GFX === '3d' ? { args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] } : {});
const ctxB = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, hasTouch: touch, isMobile: touch });
if (process.env.GFX) await ctxB.addInitScript((m) => localStorage.setItem('keyscrew_gfx', JSON.stringify(m)), process.env.GFX);
const page = await ctxB.newPage();
const errs = []; page.on('pageerror', (e) => errs.push('PAGEERR ' + e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto('file://' + root + '/index.html'); await page.waitForTimeout(1600);
await page.evaluate(() => localStorage.clear());
let n = 0; const shot = async (name) => { await page.screenshot({ path: `${out}/${String(++n).padStart(2, '0')}-${name}.png` }); const ge = await page.evaluate(() => (Game.error ? String(Game.error.stack || Game.error) : null)); if (ge) { errs.push(name + ': ' + ge); await page.evaluate(() => { Game.error = null; }); } };
const click = async (id) => {
  await page.waitForFunction((id) => { const r = UI.byId(id); return Game.fadeDir !== 1 && r && !r.disabled; }, id, { timeout: 15000 }).catch(() => {});
  const pt = await page.evaluate((id) => { const r = UI.byId(id); if (!r || r.disabled) return null; return { x: Game.ox + (r.x + r.w / 2) * Game.scale, y: Game.oy + (r.y + r.h / 2) * Game.scale }; }, id);
  if (!pt) { errs.push('no button ' + id + ' in ' + (await page.evaluate(() => Game.scene.constructor.name))); return false; }
  if (touch) await page.touchscreen.tap(pt.x, pt.y); else await page.mouse.click(pt.x, pt.y);
  await page.waitForTimeout(450); return true;
};
const scene = () => page.evaluate(() => Game.scene.constructor.name);
const expect = async (want, label) => { await page.waitForFunction((w) => Game.scene.constructor.name === w && Game.fadeDir !== 1, want, { timeout: 20000 }).catch(() => {}); const got = await scene(); if (got !== want) errs.push(`${label}: expected ${want}, got ${got}`); console.log(label.padEnd(22), got); };
await shot('title');
await click('crew'); await shot('crew');
await click('card1'); await click('half'); await click('len90'); await shot('crew-2');   // drop Jorge, half day, 90s
await click('go'); await page.waitForTimeout(900); await expect('BriefingScene', 'the briefing'); await shot('briefing');
await click('castoff'); await page.waitForTimeout(800); await expect('SeaScene', 'after cast off'); await shot('sea-dock');
for (const sp of ['bughunt', 'flats']) {
  await click('chart'); await shot('chart-' + sp);
  await click('chartpin-' + sp); await shot('chart-sel-' + sp);
  await click('skipride'); await page.waitForTimeout(500); await shot('summary-' + sp);
  await click('letsfish'); await page.waitForTimeout(800); await expect('TurnIntroScene', 'arrived at ' + sp);
  for (let turn = 0; turn < 2; turn++) {
    await shot(`intro-${sp}-${turn}`);
    await click('ready'); await page.waitForTimeout(1200); console.log(' session:', await scene());
    await shot(`play-${sp}-${turn}`);
    await click('pause'); await shot(`pause-${sp}-${turn}`); await click('resume');
    await page.evaluate(() => { Game.scene.timeLeft = 0.2; });
    await page.waitForTimeout(2600); await expect('ResultsScene', ' after time');
    await page.waitForTimeout(2500); await shot(`results-${sp}-${turn}`);
    await click('next'); await page.waitForTimeout(800);
  }
  await expect('SeaScene', 'back on the boat');
}
await shot('sea-home-run');
console.log('home run:', await page.evaluate(() => Game.scene.homeRun));
await click('chart'); await click('chartpin-home'); await shot('chart-home');
await click('skiphome'); await page.waitForTimeout(500); await click('letsfish'); await page.waitForTimeout(1500);
await expect('DayEndScene', 'end of day'); await shot('end');
await click('log'); await expect('LogbookScene', 'logbook'); await shot('logbook');
console.log('boat ride drawn in:', await page.evaluate(() => (GL.state === 'ready' ? '3D' : 'classic (' + (GL.why || GFX.mode) + ')')));
console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'NO ERRORS');
await browser.close();
