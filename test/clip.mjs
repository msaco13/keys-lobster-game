// Records a smooth video clip of the boat ride: the game is stepped at a fixed frame rate and every frame is
// screenshotted, so it comes out smooth even when the machine draws slowly (headless 3D is software-rendered).
// Needs ffmpeg on the PATH.
//   node test/clip.mjs <repo root> <out.mp4> <3d|classic> <scenario> [seconds] [fps] [width] [height]
// scenarios: autopilot (dock to Hen & Chickens), highlights (planing, airtime, dolphins), sunset (the run home)
import { chromium } from 'playwright';
import fs from 'fs'; import path from 'path'; import { execFileSync } from 'child_process';
const [root, outFile, mode = '3d', scenario = 'autopilot'] = process.argv.slice(2);
const secs = +(process.argv[6] || 12), fps = +(process.argv[7] || 30), W = +(process.argv[8] || 1280), H = +(process.argv[9] || 720);
const frames = fs.mkdtempSync(path.join(path.dirname(path.resolve(outFile)), 'frames-'));
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.addInitScript((m) => { localStorage.clear(); localStorage.setItem('keyscrew_gfx', JSON.stringify(m === '3d' ? '3d' : 'classic')); localStorage.setItem('keyscrew_gfxTier', JSON.stringify(3)); }, mode);
await page.goto('file://' + path.resolve(root) + '/index.html'); await page.waitForTimeout(800);
await page.evaluate(([scenario]) => {
  Math.random = (() => { let s = 7; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();   // the same clip every time
  World.build(); Trip.start({ mode: 'crew', crew: ['michael', 'jorge', 'jemel'], plan: 'full', sessionLen: 120 });
  Trip.cur.weather = { id: 'light', name: 'Light chop', wind: '5–10 kts', vis: 1, drift: 0.3, aim: 1, tag: '#Light' };
  if (scenario === 'sunset') { Trip.cur.legs = 3; Trip.cur.boat = { x: 7600, y: wy(7600, 1500), h: -2.4 }; }
  Game.go(new SeaScene(scenario === 'sunset' ? { home: true } : {}), true);
  SFX.muted = true; Game._frame = Game.frame; Game.frame = () => {};   // we drive the frames from here
  if (typeof Sea3D !== 'undefined') Sea3D.tune = () => {};               // and the speed tuner would just see a slow machine
  window.__clip = { t: 0, scenario };
}, [scenario]);
// what happens when, per scenario
const steer = async (t) => page.evaluate(([t]) => {
  const S = Game.scene, C = window.__clip, once = (k) => (C[k] ? false : (C[k] = true));
  if (C.scenario === 'autopilot' && t > 0.8 && once('go')) { S.dest = 'bughunt'; S.planRoute(); S.setAuto(true); S.panel = null; }
  if (C.scenario === 'highlights') {
    if (once('place')) { S.x = 8300; S.y = wy(8300, 1050); S.h = Math.PI + 0.05; S.v = 300; S.notch = 4; Chase.reset(S); }
    if (t > 2.5 && once('air')) { S.v = 320; S.hitWake(); }
    if (t > 5 && once('dolphins')) { S.dolphins = { t: 0, dur: 7, pod: [0, 1, 2].map((i) => ({ ox: 60 + i * 25, oy: (i - 1) * 46, ph: i * 2.1 })) }; SFX.play('dolphin'); }
    if (t > 7 && t < 9) S.steer = { id: 1, x: Game.W * 0.72, y: 300 }; else S.steer = null;
  }
  if (C.scenario === 'sunset' && once('home')) { S.planRoute(); S.setAuto(true); }
}, [t]);
const dt = 1 / fps, total = Math.round(secs * fps);
let ts = 1000;
for (let i = 0; i < Math.round(fps * 0.6); i++) { ts += 1000 / fps; await page.evaluate((ts) => Game._frame.call(Game, ts), ts); }   // let the scene settle
for (let i = 0; i < total; i++) {
  await steer(i * dt);
  ts += 1000 / fps; await page.evaluate((ts) => Game._frame.call(Game, ts), ts);
  await page.screenshot({ path: path.join(frames, String(i).padStart(5, '0') + '.png') });
  if (i % fps === 0) process.stdout.write(`${i / fps}s `);
}
console.log('\nrendered', total, 'frames', mode, scenario, await page.evaluate(() => (typeof Sea3D !== 'undefined' ? Sea3D.state : 'n/a')));
execFileSync('ffmpeg', ['-y', '-v', 'error', '-framerate', String(fps), '-i', path.join(frames, '%05d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', outFile]);
fs.rmSync(frames, { recursive: true, force: true });
console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'NO ERRORS', '->', outFile);
await browser.close();
