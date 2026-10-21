import { chromium } from 'playwright';
const root = process.argv[2], out = process.argv[3];
const browser = await chromium.launch(); const errs=[];
for (const [w,h] of [[960,540],[844,390]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } }); page.on('pageerror', e=>errs.push(e.message));
  await page.goto('file://' + root + '/index.html'); await page.waitForTimeout(1400);
  await page.evaluate(()=>{ Game.go(new BugHuntScene({ch:'michael', spot:'bughunt', len:120, onEnd:()=>{}}), true); });
  await page.waitForTimeout(600); await page.screenshot({ path: `${out}/g-start-${w}.png` });
  for (const cl of [2.93, 3.05, 5.2]) {
    await page.evaluate((cl)=>{ Game.scene.gauge={lob:{cl,w:1,eggs:cl>5},t:1}; }, cl); await page.waitForTimeout(250);
    await page.screenshot({ path: `${out}/g-${w}-${cl}.png` });
  }
  await page.close();
}
console.log(errs.length? errs.join('\n'):'no errors'); await browser.close();
