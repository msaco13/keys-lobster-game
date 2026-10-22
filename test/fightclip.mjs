// Records a smooth video of fish fights, played by a bot that reels the way a good player does: the game is stepped at
// a fixed frame rate and every frame is screenshotted, so it comes out smooth even though headless 3D is
// software-rendered. The game's dice are seeded and the picture gets its own dice, so the same fight plays out
// the same way in 3D and in classic (handy for a before/after). Needs ffmpeg on the PATH.
//   node test/fightclip.mjs <repo root> <out.mp4> <3d|classic> <stage,stage,...> [seconds per stage] [fps] [width] [height]
// stages: offshore, marlin, ledge, wreck, flats, bridge, glades
import { chromium } from 'playwright';
import fs from 'fs'; import path from 'path'; import { execFileSync } from 'child_process';
const [root, outFile, mode = '3d', list = 'offshore'] = process.argv.slice(2), DRY = !!process.env.DRY;   // DRY=1: no video, just say when it jumps and ends
let jumping = false;
const secs = +(process.argv[6] || 10), fps = +(process.argv[7] || 30), W = +(process.argv[8] || 1280), H = +(process.argv[9] || 720);
const STAGES = {
  offshore: { scene: 'TrollScene', spot: 'troll', ch: 'jemel', fish: { sp: 'mahi', weight: 31, ctxType: 'offshore' }, seed: 11 },
  marlin: { scene: 'TrollScene', spot: 'hump', ch: 'jemel', fish: { sp: 'bluemarlin', weight: 380, ctxType: 'offshore' }, seed: 5 },
  ledge: { scene: 'BottomScene', spot: 'bottom', ch: 'jorge', fish: { sp: 'blackgrouper', weight: 44, ctxType: 'reef', depth: 90 }, seed: 3 },
  wreck: { scene: 'BottomScene', spot: 'wreck', ch: 'jorge', fish: { sp: 'amberjack', weight: 40, ctxType: 'reef', depth: 100 }, seed: 9 },
  flats: { scene: 'FlatsScene', spot: 'flats', ch: 'michael', fish: { sp: 'bonefish', weight: 8, ctxType: 'flats', rock: 0 }, seed: 4 },
  bridge: { scene: 'FlatsScene', spot: 'bridge', ch: 'michael', fish: { sp: 'tarpon', weight: 96, ctxType: 'flats', rock: 0 }, seed: 7 },
  glades: { scene: 'FlatsScene', spot: 'flamingo', ch: 'jorge', fish: { sp: 'snook', weight: 14, ctxType: 'flats', rock: 0.4 }, seed: 2 }
};
const frames = fs.mkdtempSync(path.join(path.dirname(path.resolve(outFile)), 'frames-'));
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.addInitScript((m) => { localStorage.clear(); localStorage.setItem('keyscrew_gfx', JSON.stringify(m === '3d' ? '3d' : 'classic')); localStorage.setItem('keyscrew_gfxTier', JSON.stringify(3)); }, mode);
await page.goto('file://' + path.resolve(root) + '/index.html'); await page.waitForTimeout(800);
await page.evaluate(() => {
  SFX.muted = true; Game._frame = Game.frame; Game.frame = () => {};   // we drive the frames from here
  if (typeof GL !== 'undefined') GL.tune = () => {};                // and the speed tuner would just see a slow machine
  const draw = Game.draw;   // drawing rolls its own dice, so the 3D extras (spray, bubbles) don't change how the fight goes
  Game.draw = function (...a) { const g = Math.random; Math.random = window.__visRnd; try { return draw.apply(this, a); } finally { Math.random = g; } };
  window.__seed = (n) => { const mk = (s) => () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; Math.random = mk(n * 7919 + 1); window.__visRnd = mk(n * 104729 + 3); };
});
let ts = 1000, n = 0;
const step = () => page.evaluate((ts) => Game._frame.call(Game, ts), (ts += 1000 / fps));
for (const name of list.split(',')) {
  const S = STAGES[name]; if (!S) throw new Error('no stage ' + name);
  await page.evaluate((S) => {
    window.__seed(S.seed);
    Trip.start({ mode: 'crew', crew: ['michael', 'jorge', 'jemel'], plan: 'full', sessionLen: 120 });
    Trip.cur.weather = { id: 'light', name: 'Light chop', vis: 1, drift: 0.3, aim: 1 };
    const K = { TrollScene, BottomScene, FlatsScene }[S.scene];
    Game.go(new K({ ch: S.ch, spot: S.spot, len: 120, weather: Trip.cur.weather, onEnd: () => {} }), true);
  }, S);
  for (let i = 0; i < fps * 0.8; i++) await step();
  // hook up, then play it like a good player: hold to reel, let go when it runs, jumps or the drag gets close to the red
  await page.evaluate((S) => {
    Game.scene.startFight(S.fish);
    const f = Game.scene.child, b = (window.__bot = { hold: true, tap: 0, run: -1, tele: -1, t: 0 });
    f.holding = () => b.hold;
  }, S);
  let overAt = -1;
  for (let i = 0; i < secs * fps; i++) {
    await page.evaluate((dt) => {
      const f = Game.scene.child, b = window.__bot; if (!f) return; b.t += dt;
      if (f.phase === 'turn') { b.hold = true; b.tap += dt; if (b.tap > 1 / 7) { b.tap = 0; f.tap(); } return; }
      if (f.tele && b.tele < 0) b.tele = b.t; if (!f.tele && !f.running) b.tele = -1;
      if (f.running && b.run < 0) b.run = b.t; if (!f.running) b.run = -1;
      b.hold = !((b.tele >= 0 && b.t - b.tele > 0.2) || (b.run >= 0 && b.t - b.run > 0.12) || f.jumpT > 0 || f.T > 0.8 * f.perks.line);
    }, 1 / fps);
    await step();
    if (!DRY) await page.screenshot({ path: path.join(frames, String(n++).padStart(5, '0') + '.png') });
    const st = await page.evaluate(() => { const f = Game.scene.child; return f ? { over: f.phase === 'over', jump: f.jumpT > 0 } : { over: true }; });
    if (DRY && st.jump && !jumping) console.log('  jump at', (i / fps).toFixed(1));
    jumping = st.jump;
    if (st.over && overAt < 0) { overAt = i; if (DRY) console.log('  over at', (i / fps).toFixed(1)); }
    if (overAt >= 0 && i - overAt > fps * 3.2) break;   // a few seconds of the result card, then on to the next
  }
  const res = await page.evaluate(() => { const f = Game.scene.child; return f ? { phase: f.phase, won: f.won, reason: f.reason, S: +f.S.toFixed(2) } : 'done'; });
  console.log(name, JSON.stringify(res));
  await page.evaluate(() => { const f = Game.scene.child; if (f) f.finish(); });
}
if (!DRY) execFileSync('ffmpeg', ['-y', '-v', 'error', '-framerate', String(fps), '-i', path.join(frames, '%05d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', outFile]);
fs.rmSync(frames, { recursive: true, force: true });
console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'NO ERRORS', '->', outFile, n, 'frames');
await browser.close();
