import { chromium } from 'playwright';
const root = process.argv[2], out = process.argv[3], W = +(process.argv[4]||844), H = +(process.argv[5]||390), touch = process.argv[6] === 'touch';
const browser = await chromium.launch();
const ctxB = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, hasTouch: touch, isMobile: touch });
const page = await ctxB.newPage();
const errs = []; page.on('pageerror', e => errs.push('PAGEERR ' + e.message)); page.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
await page.goto('file://' + root + '/index.html'); await page.waitForTimeout(1600);
let n = 0; const shot = async (name) => { await page.screenshot({ path: `${out}/${String(++n).padStart(2,'0')}-${name}.png` }); const ge = await page.evaluate(()=>Game.error ? String(Game.error.stack||Game.error) : null); if (ge) { errs.push(name+': '+ge); await page.evaluate(()=>{Game.error=null;}); } };
// click a UI button by id, converting logical coords to CSS pixels
const click = async (id) => {
  const pt = await page.evaluate((id) => { const r = UI.byId(id); if (!r) return null; return { x: Game.ox + (r.x + r.w/2) * Game.scale, y: Game.oy + (r.y + r.h/2) * Game.scale }; }, id);
  if (!pt) { errs.push('no button ' + id + ' in ' + await page.evaluate(()=>Game.scene.constructor.name)); return false; }
  if (touch) await page.touchscreen.tap(pt.x, pt.y); else await page.mouse.click(pt.x, pt.y);
  await page.waitForTimeout(450); return true;
};
const scene = () => page.evaluate(() => Game.scene.constructor.name);
await shot('title');
await click('crew'); await shot('crew');
await click('card1'); await click('half'); await click('len90'); await shot('crew-2');   // drop Jorge, half day, 90s
await click('go'); console.log('after cast off:', await scene());
await shot('map');
const spots = ['bughunt', 'flats'];
for (const sp of spots) {
  await click('pin-' + sp); await shot('map-' + sp);
  await click('go'); await page.waitForTimeout(1400); console.log('turn intro:', await scene());
  for (let turn = 0; turn < 2; turn++) {
    await shot(`intro-${sp}-${turn}`);
    await click('ready'); await page.waitForTimeout(1200); console.log(' session:', await scene());
    await shot(`play-${sp}-${turn}`);
    // play a little: pause, resume, then fast-forward the clock
    await click('pause'); await shot(`pause-${sp}-${turn}`); await click('resume');
    await page.evaluate(() => { Game.scene.timeLeft = 0.2; });
    await page.waitForTimeout(2600); console.log(' after time:', await scene());
    await page.waitForTimeout(2500); await shot(`results-${sp}-${turn}`);
    await click('next'); await page.waitForTimeout(800);
  }
}
console.log('end:', await scene()); await page.waitForTimeout(1500); await shot('end');
await click('log'); await shot('logbook');
console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'NO ERRORS');
await browser.close();
