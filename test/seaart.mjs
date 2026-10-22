// Contact sheets for the sea art (js/art.js): top-down sea life, boats, birds and floats on open water for the overhead
// view, and the side-view billboards for the chase camera over water with a horizon. Also prints a rough cost per call.
// usage: node test/seaart.mjs <repo root> <out dir> [extra.js to inject after the game's scripts]
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
const root = process.argv[2] || process.cwd(), out = process.argv[3] || 'test/shots', extra = process.argv[4];
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto('file://' + root + '/index.html'); await page.waitForTimeout(1200);
if (extra) await page.addScriptTag({ content: fs.readFileSync(extra, 'utf8') });
const sheets = await page.evaluate(() => {
  const res = {};
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
  const water = (g, x, y, w, h, seed = 1) => {
    const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, '#1f74a0'); gr.addColorStop(1, '#17618a'); g.fillStyle = gr; g.fillRect(x, y, w, h);
    const r = mulberry(seed); g.fillStyle = 'rgba(255,255,255,0.12)';
    for (let i = 0; i < (w * h) / 2600; i++) { const px = x + r() * w, py = y + r() * h; g.beginPath(); g.ellipse(px, py, 6, 1.2, 0, 0, Math.PI * 2); g.fill(); }
  };
  // sky above a horizon at hy, water below with streaks that crowd toward the horizon
  const seaH = (g, x, y, w, h, hy, seed = 3) => {
    const sky = g.createLinearGradient(0, y, 0, hy); sky.addColorStop(0, '#5aa8e6'); sky.addColorStop(1, '#cfe9f7'); g.fillStyle = sky; g.fillRect(x, y, w, hy - y);
    const sea = g.createLinearGradient(0, hy, 0, y + h); sea.addColorStop(0, '#5b9fc4'); sea.addColorStop(0.18, '#2a7fae'); sea.addColorStop(1, '#165f8a'); g.fillStyle = sea; g.fillRect(x, hy, w, y + h - hy);
    const r = mulberry(seed); g.fillStyle = 'rgba(255,255,255,0.16)';
    for (let i = 0; i < 160; i++) { const k = Math.pow(r(), 1.6), py = hy + k * (y + h - hy), sz = 1 + k * 9; g.beginPath(); g.ellipse(x + r() * w, py, sz * 1.6, sz * 0.22, 0, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(x, hy, w, 1);
  };
  const label = (g, s, x, y, o = {}) => { g.font = `${o.w || 700} ${o.size || 13}px sans-serif`; g.fillStyle = o.color || '#fff'; g.textAlign = 'left'; g.fillText(s, x, y); };
  // rows of cells: { name, sub, h, cells: [{ w, cap, draw(g, cx, cy) }] }
  const sheet = (rows, W, bg) => {
    const H = rows.reduce((a, r) => a + r.h, 0), [c, g] = mk(W, H); g.fillStyle = '#0c2734'; g.fillRect(0, 0, W, H);
    let y = 0;
    rows.forEach((row, ri) => {
      let x = 130; label(g, row.name, 10, y + 22, { size: 14 }); if (row.sub) label(g, row.sub, 10, y + 40, { size: 11, w: 500, color: '#9fc3d3' });
      for (const cell of row.cells) {
        bg(g, x + 2, y + 2, cell.w - 4, row.h - 4, ri * 31 + x);
        g.save(); g.beginPath(); g.rect(x + 2, y + 2, cell.w - 4, row.h - 4); g.clip(); cell.draw(g, x + cell.w / 2, y + row.h / 2 - 6); g.restore();
        if (cell.cap) label(g, cell.cap, x + 8, y + row.h - 10, { size: 11, w: 600, color: 'rgba(255,255,255,0.85)' });
        x += cell.w;
      }
      y += row.h;
    });
    return c.toDataURL('image/png');
  };
  const cell = (w, cap, draw) => ({ w, cap, draw });

  /* ---------- top-down: sea life ---------- */
  res['top-life'] = sheet([
    { name: 'Manatee', sub: 'drawManateeTop', h: 250, cells: [
      cell(80, 's .3', (g, x, y) => drawManateeTop(g, x, y, 0.3, -0.4, { t: 1 })),
      cell(150, 's 1 under', (g, x, y) => drawManateeTop(g, x, y, 1, 0, { t: 1 })),
      cell(150, 's 1 surfacing', (g, x, y) => drawManateeTop(g, x, y, 1, 0, { t: 1.6, surfacing: 1 })),
      cell(250, 's 1.9 surfacing .6', (g, x, y) => drawManateeTop(g, x, y, 1.9, -0.25, { t: 2.2, surfacing: 0.6 })),
      cell(150, 's 1 ang 2.3 t 3', (g, x, y) => drawManateeTop(g, x, y, 1, 2.3, { t: 3 }))] },
    { name: 'Dolphin', sub: 'drawDolphinTop', h: 230, cells: [
      cell(80, 's .35', (g, x, y) => drawDolphinTop(g, x, y, 0.35, -0.5, { t: 1 })),
      cell(150, 'up 0', (g, x, y) => drawDolphinTop(g, x, y, 1, 0, { t: 1 })),
      cell(150, 'up .5', (g, x, y) => drawDolphinTop(g, x, y, 1, 0, { t: 1.3, up: 0.5 })),
      cell(170, 'up 1', (g, x, y) => drawDolphinTop(g, x, y, 1, 0, { t: 1.6, up: 1 })),
      cell(250, 's 2 up .2', (g, x, y) => drawDolphinTop(g, x, y, 2, 0.3, { t: 2.1, up: 0.2 }))] },
    { name: 'Turtle', sub: 'drawTurtleTop', h: 230, cells: [
      cell(80, 's .55', (g, x, y) => drawTurtleTop(g, x, y, 0.55, -0.6, { t: 1 })),
      cell(150, 's 1.6 t 0', (g, x, y) => drawTurtleTop(g, x, y, 1.6, 0, { t: 0 })),
      cell(150, 's 1.6 t .8', (g, x, y) => drawTurtleTop(g, x, y, 1.6, 0, { t: 0.8 })),
      cell(250, 's 3', (g, x, y) => drawTurtleTop(g, x, y, 3, -0.3, { t: 1.7 })),
      cell(150, 's 1.6 ang 2', (g, x, y) => drawTurtleTop(g, x, y, 1.6, 2, { t: 2.3 }))] },
    { name: 'Eagle ray', sub: 'drawRayTop', h: 250, cells: [
      cell(80, 's .45', (g, x, y) => drawRayTop(g, x + 10, y, 0.45, -0.4, { t: 1 })),
      cell(170, 's 1.3 t 0', (g, x, y) => drawRayTop(g, x + 20, y, 1.3, 0, { t: 0 })),
      cell(170, 's 1.3 t .7', (g, x, y) => drawRayTop(g, x + 20, y, 1.3, 0, { t: 0.7 })),
      cell(270, 's 2.6', (g, x, y) => drawRayTop(g, x + 40, y, 2.6, -0.2, { t: 1.5 })),
      cell(150, 's 1.3 ang -1.6', (g, x, y) => drawRayTop(g, x, y + 30, 1.3, -1.6, { t: 2 }))] }
  ], 1020, water);

  /* ---------- top-down: boats, birds, floats ---------- */
  res['top-boats'] = sheet([
    { name: 'Center console', sub: 'drawCenterConsoleTop', h: 230, cells: [
      cell(80, 's .2', (g, x, y) => drawCenterConsoleTop(g, x, y, 0.2, -0.5, { hull: '#2f6fb0' })),
      cell(130, 'white s .6', (g, x, y) => drawCenterConsoleTop(g, x, y, 0.6, 0, { crew: ['michael', 'jorge', 'jemel'] })),
      cell(130, 'navy s .6', (g, x, y) => drawCenterConsoleTop(g, x, y, 0.6, 0, { hull: '#1f3554', crew: ['jemel'] })),
      cell(130, 'yellow s .6', (g, x, y) => drawCenterConsoleTop(g, x, y, 0.6, 0.8, { hull: '#f2c33a', crew: ['jorge', 'michael'] })),
      cell(240, 'seafoam s 1.15', (g, x, y) => drawCenterConsoleTop(g, x, y, 1.15, -0.2, { hull: '#7fd0c4', crew: ['michael', 'jemel', 'jorge'] })),
      cell(130, 'black ang 2.6', (g, x, y) => drawCenterConsoleTop(g, x, y, 0.6, 2.6, { hull: '#24282c' }))] },
    { name: 'FWC patrol', sub: 'drawFwcBoatTop', h: 230, cells: [
      cell(80, 's .2', (g, x, y) => drawFwcBoatTop(g, x, y, 0.2, -0.5, { t: 0.02 })),
      cell(140, 't .02 (left)', (g, x, y) => drawFwcBoatTop(g, x, y, 0.6, 0, { t: 0.02 })),
      cell(140, 't .44 (right)', (g, x, y) => drawFwcBoatTop(g, x, y, 0.6, 0, { t: 0.44 })),
      cell(140, 't .3 (dark)', (g, x, y) => drawFwcBoatTop(g, x, y, 0.6, 0, { t: 0.3 })),
      cell(250, 's 1.1', (g, x, y) => drawFwcBoatTop(g, x, y, 1.1, -0.25, { t: 0.13 }))] },
    { name: 'Sailboat', sub: 'drawSailboatTop', h: 260, cells: [
      cell(80, 's .18', (g, x, y) => drawSailboatTop(g, x, y, 0.18, -0.5, {})),
      cell(160, 'sail .45', (g, x, y) => drawSailboatTop(g, x - 10, y - 20, 0.55, 0, { sail: 0.45, t: 1 })),
      cell(160, 'sail -.9', (g, x, y) => drawSailboatTop(g, x, y, 0.55, 0, { sail: -0.9, t: 1 })),
      cell(160, 'sail false', (g, x, y) => drawSailboatTop(g, x, y, 0.55, 0, { sail: false })),
      cell(250, 's 1', (g, x, y) => drawSailboatTop(g, x - 10, y - 20, 1, -0.35, { sail: 0.3, t: 2 }))] },
    { name: 'Flats skiff', sub: 'drawSkiffTop2', h: 200, cells: [
      cell(80, 's .27', (g, x, y) => drawSkiffTop2(g, x, y, 0.27, -0.5, {})),
      cell(150, 's .85', (g, x, y) => drawSkiffTop2(g, x, y, 0.85, 0, {})),
      cell(150, 'poler + angler', (g, x, y) => drawSkiffTop2(g, x, y, 0.85, 0, { poler: 'jorge', angler: 'michael', pole: 0.4 })),
      cell(260, 's 1.6 tan', (g, x, y) => drawSkiffTop2(g, x, y, 1.6, -0.15, { hull: '#d9cdb0', poler: 'jemel', angler: 'jorge' }))] },
    { name: 'Kayak', sub: 'drawKayakTop', h: 200, cells: [
      cell(80, 's .45', (g, x, y) => drawKayakTop(g, x, y, 0.45, -0.5, { t: 1 })),
      cell(150, 'yellow t 0', (g, x, y) => drawKayakTop(g, x, y, 1.3, 0, { t: 0 })),
      cell(150, 'red t .7', (g, x, y) => drawKayakTop(g, x, y, 1.3, 0, { t: 0.7, color: '#e2453a' })),
      cell(150, 'lime t 1.4', (g, x, y) => drawKayakTop(g, x, y, 1.3, 0.6, { t: 1.4, color: '#7ed957' })),
      cell(250, 's 2.5 teal', (g, x, y) => drawKayakTop(g, x, y, 2.5, -0.2, { t: 2, color: '#26b5b0' }))] },
    { name: 'Birds', sub: 'drawPelicanTop, drawGullTop + drawBirdShadow', h: 230, cells: [
      cell(80, 's .35 / .5', (g, x, y) => { drawBirdShadow(g, x - 20, y - 30, 0.35, 0, { kind: 'pelican', t: 0.3, alt: 18 }); drawPelicanTop(g, x - 20, y - 30, 0.35, 0, { t: 0.3 }); drawBirdShadow(g, x + 10, y + 20, 0.5, 0.4, { t: 0.1, alt: 16 }); drawGullTop(g, x + 10, y + 20, 0.5, 0.4, { t: 0.1 }); }),
      cell(150, 'pelican t 0', (g, x, y) => { drawBirdShadow(g, x, y, 1, 0, { kind: 'pelican', t: 0 }); drawPelicanTop(g, x, y, 1, 0, { t: 0 }); }),
      cell(150, 'pelican t .5', (g, x, y) => { drawBirdShadow(g, x, y, 1, 0, { kind: 'pelican', t: 0.5 }); drawPelicanTop(g, x, y, 1, 0, { t: 0.5 }); }),
      cell(130, 'gull t 0 / .2', (g, x, y) => { drawBirdShadow(g, x, y - 40, 1, 0, { t: 0 }); drawGullTop(g, x, y - 40, 1, 0, { t: 0 }); drawBirdShadow(g, x, y + 35, 1, 0, { t: 0.2 }); drawGullTop(g, x, y + 35, 1, 0, { t: 0.2 }); }),
      cell(250, 'pelican s 2', (g, x, y) => { drawBirdShadow(g, x - 10, y - 10, 2, -0.3, { kind: 'pelican', t: 1.1, alt: 50 }); drawPelicanTop(g, x - 10, y - 10, 2, -0.3, { t: 1.1 }); }),
      cell(150, 'gull s 2', (g, x, y) => { drawBirdShadow(g, x, y, 2, 2.2, { t: 0.4, alt: 40 }); drawGullTop(g, x, y, 2, 2.2, { t: 0.4 }); })] },
    { name: 'Trap floats', sub: 'drawTrapFloatTop', h: 120, cells: [
      cell(80, 's .6', (g, x, y) => drawTrapFloatTop(g, x, y, 0.6, 0.4, { t: 1 })),
      cell(260, 's 1', (g, x, y) => ['#ff6a3d', '#ffffff', '#ffd23a', '#7be36a', '#ff4fa0'].forEach((col, i) => drawTrapFloatTop(g, x - 100 + i * 50, y, 1, 0.3, { color: col, stripe: ['#1b3f8a', '#e03a3a', '#111111', '#1b3f8a', '#111111'][i], t: i }))),
      cell(200, 's 2.5', (g, x, y) => drawTrapFloatTop(g, x, y, 2.5, -0.5, { color: '#ff6a3d', t: 2 }))] }
  ], 1100, water);

  /* ---------- side-view billboards for the chase camera ---------- */
  const chaseBg = (hy) => (g, x, y, w, h, seed) => seaH(g, x, y, w, h, y + hy, seed);
  const ph = [0.15, 0.6, 1.57, 2.3, 2.9, 4.2];
  res['side-billboards'] = sheet([
    { name: 'Dolphin', sub: 'drawDolphinSide s 2.4', h: 180, cells: ph.map((p) => cell(150, 'phase ' + p, (g, x, y) => drawDolphinSide(g, x, y + 40, 2.4, p))) },
    { name: 'Dolphin', sub: 's .5 / 1 / -1.4 / haze', h: 130, cells: [
      cell(120, 's .5', (g, x, y) => drawDolphinSide(g, x, y + 30, 0.5, 1.2)), cell(150, 's 1', (g, x, y) => drawDolphinSide(g, x, y + 30, 1, 1.8)),
      cell(180, 's -1.4 (left)', (g, x, y) => drawDolphinSide(g, x, y + 30, -1.4, 1.0)), cell(180, 's 1.4 haze .5', (g, x, y) => drawDolphinSide(g, x, y + 30, 1.4, 1.4, { haze: 0.5 }))] },
    { name: 'Pelican', sub: 'drawPelicanSide s 3.2', h: 170, cells: [0, 1, 2, 3, 4, 5].map((f) => cell(150, 'flap ' + f, (g, x, y) => drawPelicanSide(g, x - 10, y, 3.2, f))) },
    { name: 'Gull', sub: 'drawGullSide s 5', h: 140, cells: [0, 1, 2, 3, 4, 5].map((f) => cell(120, 'flap ' + f, (g, x, y) => drawGullSide(g, x - 5, y, 5, f))) },
    { name: 'Birds small', sub: 's .5 – 1.5', h: 110, cells: [
      cell(200, 'pelicans s .6 / 1 / 1.5', (g, x, y) => { drawPelicanSide(g, x - 65, y, 0.6, 1); drawPelicanSide(g, x - 15, y, 1, 2.5); drawPelicanSide(g, x + 55, y, -1.5, 4); }),
      cell(200, 'gulls s .6 / 1 / 1.5', (g, x, y) => { drawGullSide(g, x - 65, y, 0.6, 1); drawGullSide(g, x - 15, y, 1, 2.5); drawGullSide(g, x + 50, y, -1.5, 4); }),
      cell(160, 'haze .6', (g, x, y) => { drawPelicanSide(g, x - 25, y, 1.4, 0.5, { haze: 0.6 }); drawGullSide(g, x + 45, y, 1.5, 2, { haze: 0.6 }); })] },
    { name: 'Turtle', sub: 'drawTurtleSide s 4', h: 130, cells: [0, 1, 1.75, 2.6, 3.4].map((t) => cell(150, 't ' + t, (g, x, y) => drawTurtleSide(g, x - 5, y + 25, 4, t))).concat([cell(150, 's 1 / 2 / -2', (g, x, y) => { drawTurtleSide(g, x - 50, y + 25, 1, 1.7); drawTurtleSide(g, x - 10, y + 25, 2, 1.7); drawTurtleSide(g, x + 45, y + 25, -2, 0.3); })]) },
    { name: 'Markers', sub: 'drawMarkerPost', h: 200, cells: [
      cell(110, 'red 8 s 2', (g, x, y) => drawMarkerPost(g, x, y + 80, 2, { kind: 'red', n: 8, t: 0.1 })),
      cell(110, 'green 7 s 2', (g, x, y) => drawMarkerPost(g, x, y + 80, 2, { kind: 'green', n: 7, t: 1 })),
      cell(110, 'white s 2.5', (g, x, y) => drawMarkerPost(g, x, y + 70, 2.5, { kind: 'white', n: 2, t: 1 })),
      cell(140, 's 1', (g, x, y) => { drawMarkerPost(g, x - 35, y + 50, 1, { kind: 'red', n: 12, t: 1 }); drawMarkerPost(g, x + 5, y + 50, 1, { kind: 'green', n: 11, t: 1 }); drawMarkerPost(g, x + 45, y + 50, 1, { kind: 'white', n: 5, t: 1 }); }),
      cell(140, 's .4', (g, x, y) => { drawMarkerPost(g, x - 30, y + 20, 0.4, { kind: 'red', n: 2, t: 1 }); drawMarkerPost(g, x, y + 20, 0.4, { kind: 'green', n: 1, t: 1 }); drawMarkerPost(g, x + 30, y + 20, 0.4, { kind: 'white', n: 9, t: 1 }); }),
      cell(140, 's 1 haze .5', (g, x, y) => { drawMarkerPost(g, x - 20, y + 50, 1, { kind: 'red', n: 4, t: 1, haze: 0.5 }); drawMarkerPost(g, x + 25, y + 50, 1, { kind: 'green', n: 3, t: 1, haze: 0.5 }); })] },
    { name: 'Trap floats', sub: 'drawTrapFloat', h: 120, cells: [
      cell(130, 's 3', (g, x, y) => drawTrapFloat(g, x, y + 20, 3, { color: '#ff6a3d', stripe: '#1b3f8a', t: 0.5 })),
      cell(200, 's 1.5', (g, x, y) => ['#ff6a3d', '#ffffff', '#7be36a', '#ff4fa0'].forEach((col, i) => drawTrapFloat(g, x - 60 + i * 40, y + 15, 1.5, { color: col, stripe: ['#1b3f8a', '#111111', '#1b3f8a', '#111111'][i], t: i }))),
      cell(150, 's .6', (g, x, y) => ['#ff6a3d', '#ffffff', '#ffd23a', '#ff4fa0'].forEach((col, i) => drawTrapFloat(g, x - 45 + i * 30, y + 10, 0.6, { color: col, stripe: '#1b3f8a', t: i })))] },
    { name: 'Alligator Light', sub: 'drawLighthouseSide', h: 330, cells: [
      cell(330, 's .45 (flash)', (g, x, y) => drawLighthouseSide(g, x, y + 140, 0.45, { t: 0.1 })),
      cell(200, 's .45 dark', (g, x, y) => drawLighthouseSide(g, x, y + 140, 0.45, { t: 2.5 })),
      cell(160, 's .2 haze .4', (g, x, y) => drawLighthouseSide(g, x, y + 60, 0.2, { t: 0.65, haze: 0.4 })),
      cell(120, 's .1', (g, x, y) => drawLighthouseSide(g, x, y + 30, 0.1, { t: 1.2 }))] }
  ], 1060, chaseBg(70));

  // a mock chase-camera scene: camera 118 units up, focal 560 (like js/chase.js); farther things sit higher and smaller
  {
    const W = 960, H = 540, [c, g] = mk(W, H), hy = 150, F = 560, hc = 118, t = 4.2;
    seaH(g, 0, 0, W, H, hy, 7);
    drawCloud(g, 160, 60, 0.9, 0.9); drawCloud(g, 700, 40, 0.7, 0.8);
    const P = (wx, d, z = 0) => ({ x: W / 2 + F * wx / d, y: hy + F * (hc - z) / d, s: F / d, haze: clamp((d - 900) / 6000, 0, 0.7) });
    const objs = [];
    objs.push([5200, (p) => drawLighthouseSide(g, p.x, p.y, p.s, { t: 0.1, haze: p.haze }), -900]);
    for (const [wx, d, kind, n] of [[-120, 700, 'green', 7], [120, 700, 'red', 8], [-120, 1400, 'green', 5], [120, 1400, 'red', 6], [-120, 2600, 'green', 3], [120, 2600, 'red', 4]]) objs.push([d, (p) => drawMarkerPost(g, p.x, p.y, p.s, { kind, n, t, haze: p.haze }), wx]);
    for (const [wx, d] of [[300, 900], [-330, 1200]]) objs.push([d, (p) => drawMarkerPost(g, p.x, p.y, p.s, { kind: 'white', n: wx, t, haze: p.haze }), wx]);
    for (const [wx, d, col, st] of [[-60, 420, '#ff6a3d', '#1b3f8a'], [170, 600, '#ffd23a', '#e03a3a'], [-230, 900, '#ffffff', '#111111'], [40, 1300, '#7be36a', '#1b3f8a']]) objs.push([d, (p) => drawTrapFloat(g, p.x, p.y, p.s, { color: col, stripe: st, t, haze: p.haze }), wx]);
    objs.push([330, (p) => drawDolphinSide(g, p.x, p.y, p.s, 1.3), -70]);
    objs.push([360, (p) => drawDolphinSide(g, p.x, p.y, p.s, 2.4), 60]);
    objs.push([300, (p) => drawTurtleSide(g, p.x, p.y, p.s, 1.7), 150]);
    for (const [wx, d, z, f, k] of [[-200, 800, 140, 1, 'p'], [-150, 860, 150, 2.4, 'p'], [-250, 900, 130, 3.8, 'p'], [250, 500, 90, 0.6, 'g'], [300, 560, 110, 3.3, 'g']]) objs.push([d, (p) => { const q = P(wx, d, z); (k === 'p' ? drawPelicanSide : drawGullSide)(g, q.x, q.y, q.s, f + t * 4, { haze: q.haze }); }, wx]);
    objs.sort((a, b) => b[0] - a[0]).forEach(([d, fn, wx]) => fn(P(wx, d)));
    res['chase-scene'] = c.toDataURL('image/png');
  }
  // the small sizes, blown up 3x so the pixels can be judged
  {
    const [c, g] = mk(420, 150); water(g, 0, 0, 420, 75, 5);
    drawManateeTop(g, 30, 38, 0.3, -0.4, { t: 1 }); drawDolphinTop(g, 85, 38, 0.35, 0.3, { t: 1, up: 0.6 }); drawTurtleTop(g, 135, 38, 0.5, -0.6, { t: 1 }); drawRayTop(g, 195, 30, 0.45, 0, { t: 1 });
    drawCenterConsoleTop(g, 260, 38, 0.2, -0.4, { hull: '#2f6fb0' }); drawFwcBoatTop(g, 320, 38, 0.2, 0.2, { t: 0.02 }); drawSailboatTop(g, 385, 35, 0.18, -0.5, {});
    seaH(g, 0, 75, 420, 75, 90, 2);
    drawSkiffTop2(g, 30, 60, 0.27, 0.3, {}); drawKayakTop(g, 90, 62, 0.45, -0.5, { t: 1 }); drawTrapFloatTop(g, 140, 62, 0.8, 0, { t: 1 });
    drawDolphinSide(g, 40, 130, 0.5, 1.4); drawPelicanSide(g, 110, 105, 0.7, 1); drawGullSide(g, 150, 110, 0.8, 2); drawTurtleSide(g, 190, 128, 0.9, 1.7);
    drawMarkerPost(g, 240, 135, 0.6, { kind: 'red', n: 4, t: 1 }); drawMarkerPost(g, 265, 125, 0.35, { kind: 'green', n: 3, t: 1 }); drawTrapFloat(g, 300, 135, 0.6, { t: 1 }); drawLighthouseSide(g, 370, 120, 0.08, { t: 0.1 });
    const [z, zg] = mk(1260, 450); zg.imageSmoothingEnabled = false; zg.drawImage(c, 0, 0, 1260, 450);
    res['small-3x'] = z.toDataURL('image/png');
  }
  return res;
});
// rough cost per call (rasterization included), to keep the per-frame sprites cheap
const perf = await page.evaluate(() => {
  const c = document.createElement('canvas'); c.width = 960; c.height = 540; const g = c.getContext('2d'), out = {};
  const time = (name, fn, n = 150) => { for (let k = 0; k < 10; k++) fn(k); g.getImageData(0, 0, 1, 1); const t0 = performance.now(); for (let i = 0; i < n; i++) fn(i * 0.016); g.getImageData(0, 0, 1, 1); out[name] = +((performance.now() - t0) / n).toFixed(3); };
  time('drawManateeTop s1', (t) => drawManateeTop(g, 300, 200, 1, t, { t, surfacing: 1 }));
  time('drawDolphinTop s.6 up.6', (t) => drawDolphinTop(g, 300, 200, 0.6, t, { t, up: 0.6 }));
  time('drawTurtleTop s1', (t) => drawTurtleTop(g, 300, 200, 1, t, { t }));
  time('drawRayTop s1', (t) => drawRayTop(g, 300, 200, 1, t, { t }));
  time('drawCenterConsoleTop s.6 crew', (t) => drawCenterConsoleTop(g, 300, 200, 0.6, t, { crew: ['michael', 'jorge'] }));
  time('drawFwcBoatTop s.6', (t) => drawFwcBoatTop(g, 300, 200, 0.6, t, { t }));
  time('drawSailboatTop s.5', (t) => drawSailboatTop(g, 300, 200, 0.5, t, { t }));
  time('drawSkiffTop2 s.6', (t) => drawSkiffTop2(g, 300, 200, 0.6, t, {}));
  time('drawKayakTop s1', (t) => drawKayakTop(g, 300, 200, 1, t, { t }));
  time('drawPelicanTop+shadow s1', (t) => { drawBirdShadow(g, 300, 200, 1, t, { kind: 'pelican', t }); drawPelicanTop(g, 300, 200, 1, t, { t }); });
  time('drawGullTop s1', (t) => drawGullTop(g, 300, 200, 1, t, { t }));
  time('drawTrapFloatTop s1', (t) => drawTrapFloatTop(g, 300, 200, 1, 0, { t }));
  time('drawDolphinSide s1.5', (t) => drawDolphinSide(g, 300, 300, 1.5, t * 20));
  time('drawPelicanSide s1.5', (t) => drawPelicanSide(g, 300, 200, 1.5, t * 20));
  time('drawGullSide s1.5', (t) => drawGullSide(g, 300, 200, 1.5, t * 20));
  time('drawTurtleSide s2', (t) => drawTurtleSide(g, 300, 300, 2, t * 5));
  time('drawMarkerPost s1', (t) => drawMarkerPost(g, 300, 300, 1, { kind: 'red', n: 4, t }));
  time('drawTrapFloat s1', (t) => drawTrapFloat(g, 300, 300, 1, { t }));
  time('drawLighthouseSide s.3', (t) => drawLighthouseSide(g, 300, 400, 0.3, { t }));
  return out;
});
console.log('ms per call:'); for (const [k, v] of Object.entries(perf)) console.log('  ' + k.padEnd(32) + v);
for (const [k, url] of Object.entries(sheets)) { const f = path.join(out, `seaart-${k}.png`); fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64')); console.log(f); }
console.log(errs.length ? errs.join('\n') : 'ok');
await browser.close();
process.exitCode = errs.length ? 1 : 0;
