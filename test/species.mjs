// Draws every species (side view + top view) on one sheet so the art can be eyeballed.
import { chromium } from 'playwright';
import fs from 'fs';
const root = process.argv[2], out = process.argv[3];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto('file://' + root + '/index.html'); await page.waitForTimeout(1200);
const url = await page.evaluate(() => {
  const keys = SPECIES_ORDER.filter((k) => k !== 'lobster');
  const cols = 5, cw = 300, chh = 130, c = document.createElement('canvas');
  c.width = cols * cw; c.height = Math.ceil(keys.length / cols) * chh;
  const g = c.getContext('2d'); g.fillStyle = '#2a6f95'; g.fillRect(0, 0, c.width, c.height);
  keys.forEach((k, i) => {
    const x = (i % cols) * cw, y = Math.floor(i / cols) * chh;
    g.save(); g.translate(x + 120, y + 62); drawFish(g, k, 170, { t: 0.3 }); g.restore();
    if (TOPLOOK[k]) { g.save(); g.translate(x + 255, y + 70); g.rotate(-Math.PI / 2); drawFishTop(g, 70, k, 0.3); g.restore(); }
    g.fillStyle = '#fff'; g.font = '700 14px sans-serif'; g.fillText(SPECIES[k].name, x + 8, y + chh - 8);
  });
  return c.toDataURL('image/png');
});
fs.writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'));
console.log(errs.length ? errs.join('\n') : 'ok');
await browser.close();
process.exitCode = errs.length ? 1 : 0;
