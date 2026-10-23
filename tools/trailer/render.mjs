// Renders the trailer's shots to PNG frames: the game is stepped at a fixed frame rate with every frame grabbed, so the
// footage comes out smooth however slowly headless Chromium draws (its WebGL is software-rendered). Each shot gets a
// folder of frames and a meta.json with its length and every sound the game asked for, frame by frame.
//   node tools/trailer/render.mjs <repo root> <out dir> [--shots a,b,c] [--worker k/N] [--fps 30] [--size 1920x1080] [--every n]
// --worker k/N renders the k-th share of the shots (balanced by cost) so N copies can run side by side.
// --every n keeps one frame in n: a quick preview of the staging.
import { chromium } from 'playwright';
import fs from 'fs'; import path from 'path';
import { TIMELINE, HEAVY } from './timeline.mjs';

const args = process.argv.slice(2), root = path.resolve(args[0]), out = path.resolve(args[1]);
const opt = (k, d) => { const i = args.indexOf(k); return i < 0 ? d : args[i + 1]; };
const fps = +opt('--fps', 30), [VW, VH] = opt('--size', '1920x1080').split('x').map(Number), every = +opt('--every', 1);
let shots = opt('--shots', '') ? opt('--shots').split(',') : TIMELINE.slice();
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1 });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.addInitScript(() => { localStorage.clear(); localStorage.setItem('keyscrew_gfx', JSON.stringify('3d')); localStorage.setItem('keyscrew_gfxTier', JSON.stringify(3)); });
await page.goto('file://' + root + '/index.html');
await page.evaluate(async () => { await document.fonts.load('400 40px Shrikhand'); await document.fonts.load('800 20px "Barlow Semi Condensed"'); await document.fonts.load('300 20px Inter'); });
await page.waitForTimeout(500);
await page.addScriptTag({ path: path.join(root, 'tools/trailer/shots.js') });
await page.evaluate(() => TRAILER.init());
const secsOf = await page.evaluate((ids) => Object.fromEntries(ids.map((id) => [id, TRAILER.shots[id].secs])), shots);
// a worker takes its share of the shots, heaviest first onto the lightest pile
const w = opt('--worker', '');
if (w) {
  const [k, n] = w.split('/').map(Number), piles = Array.from({ length: n }, () => ({ cost: 0, ids: [] }));
  const cost = (id) => secsOf[id] * (HEAVY.has(id) ? 1.2 : 0.45) + (HEAVY.has(id) ? 0.9 : 0.1);
  for (const id of shots.slice().sort((a, b) => cost(b) - cost(a))) { const p = piles.reduce((a, b) => (b.cost < a.cost ? b : a)); p.cost += cost(id); p.ids.push(id); }
  shots = piles[k].ids.sort((a, b) => TIMELINE.indexOf(a) - TIMELINE.indexOf(b));
  console.log(`worker ${k}/${n}:`, shots.join(' '), `(~${piles[k].cost.toFixed(0)} s of work per 30 fps second)`);
}
const cdp = await page.context().newCDPSession(page);
for (const id of shots) {
  const dir = path.join(out, id); fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync(dir)) if (f.endsWith('.png')) fs.unlinkSync(path.join(dir, f));
  const t0 = Date.now(); let secs, warm;
  try { ({ secs, warm } = await page.evaluate(([id, fps]) => TRAILER.begin(id, fps), [id, fps])); }
  catch (e) { errs.push(id + ' setup: ' + e.message); console.log(`\n${id}: SETUP FAILED ${e.message.split('\n')[0]}`); continue; }
  const total = Math.round(secs * fps); let ts = 1000, n = 0, err = null;
  for (let i = -warm; i < total; i++) {
    ts += 1000 / fps;
    const e = await page.evaluate(([i, ts]) => TRAILER.step(i, ts), [i, ts]);
    if (e && !err) { err = e; errs.push(id + ': ' + e); }
    if (i < 0 || (i % every)) continue;
    const r = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
    fs.writeFileSync(path.join(dir, String(i).padStart(5, '0') + '.png'), Buffer.from(r.data, 'base64')); n++;
    if (i % fps === 0) process.stdout.write(`${id} ${i / fps}s `);
  }
  const sfx = await page.evaluate(() => TRAILER.sfx.filter((s) => s.f >= 0));
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ id, secs, fps, frames: total, every, sfx, error: err }, null, 1));
  console.log(`\n${id}: ${n} frames in ${((Date.now() - t0) / 1000).toFixed(0)} s${err ? ' ERROR ' + err : ''}`);
}
console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'NO ERRORS');
await browser.close();
process.exitCode = errs.length ? 1 : 0;
