// Contact sheets for the sea art: top-down sea life, boats and birds on open water, and the chase-view
// sprites (the player's boat from behind, far boats, markers, floats, the lighthouse) over water with a horizon.
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
  const label = (g, s, x, y, o = {}) => { g.font = `${o.w || 700} ${o.size || 13}px sans-serif`; g.fillStyle = o.color || '#fff'; g.textAlign = o.align || 'left'; g.fillText(s, x, y); };
  // rows of cells: { name, h, cells: [{ w, cap, draw(g, cx, cy) }] }
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

  /* ---------- top-down: boats and birds ---------- */
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
      cell(150, 'gull s 2', (g, x, y) => { drawBirdShadow(g, x, y, 2, 2.2, { t: 0.4, alt: 40 }); drawGullTop(g, x, y, 2, 2.2, { t: 0.4 }); })] }
  ], 1100, water);

  /* ---------- the chase view ---------- */
  const seaH = (g, x, y, w, h, hy, seed = 3) => {   // sky above a horizon at hy, water below with streaks that crowd toward the horizon
    const sky = g.createLinearGradient(0, y, 0, hy); sky.addColorStop(0, '#5aa8e6'); sky.addColorStop(1, '#cfe9f7'); g.fillStyle = sky; g.fillRect(x, y, w, hy - y);
    const sea = g.createLinearGradient(0, hy, 0, y + h); sea.addColorStop(0, '#5b9fc4'); sea.addColorStop(0.18, '#2a7fae'); sea.addColorStop(1, '#165f8a'); g.fillStyle = sea; g.fillRect(x, hy, w, y + h - hy);
    const r = mulberry(seed); g.fillStyle = 'rgba(255,255,255,0.16)';
    for (let i = 0; i < 160; i++) { const k = Math.pow(r(), 1.6), py = hy + k * (y + h - hy), sz = 1 + k * 9; g.beginPath(); g.ellipse(x + r() * w, py, sz * 1.6, sz * 0.22, 0, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(x, hy, w, 1);
  };
  // a mock chase scene: a camera 28 ft up looking ahead; things farther off sit higher, smaller, and are seen at a lower angle
  {
    const W = 1280, H = 720, [c, g] = mk(W, H), hy = 120, F = 629, hc = 28, t = 4.2;
    seaH(g, 0, 0, W, H, hy, 7);
    drawCloud(g, 220, 60, 1.1, 0.9); drawCloud(g, 900, 40, 0.8, 0.8); drawCloud(g, 1150, 90, 0.6, 0.7);
    const proj = (wx, d) => ({ x: W / 2 + F * wx / d, y: hy + F * hc / d, s: F / (d * 12), tilt: Math.atan2(hc, d) });
    const objs = [];
    objs.push([1100, (p) => drawLighthouseSide(g, p.x, p.y, p.s, { t: 0.1, tilt: p.tilt }), -330]);
    for (const [wx, d, kind, n] of [[-34, 95, 'green', 7], [34, 95, 'red', 8], [-34, 190, 'green', 5], [34, 190, 'red', 6], [-34, 330, 'green', 3], [34, 330, 'red', 4], [-34, 520, 'green', 1], [34, 520, 'red', 2]]) objs.push([d, (p) => drawMarkerPost(g, p.x, p.y, p.s, { kind, n, t, tilt: p.tilt }), wx]);
    for (const [wx, d] of [[70, 75], [95, 140], [-80, 120], [-120, 260]]) objs.push([d, (p) => drawMarkerPost(g, p.x, p.y, p.s, { kind: 'white', n: wx, t, tilt: p.tilt }), wx]);
    for (const [wx, d, col, st] of [[-16, 58, '#ff6a3d', '#1b3f8a'], [48, 88, '#ffd23a', '#e03a3a'], [-60, 150, '#ffffff', '#111111'], [14, 230, '#7be36a', '#1b3f8a'], [26, 62, '#ff4fa0', '#111111']]) objs.push([d, (p) => drawTrapFloat(g, p.x, p.y, p.s, { color: col, stripe: st, t, tilt: p.tilt }), wx]);
    for (const [wx, d, a, hull, sp] of [[120, 420, 1.2, '#ffffff', 0.7], [-200, 640, -2.2, '#2f6fb0', 0.5], [40, 900, 0.3, '#f2c33a', 0.4], [-60, 230, 2.9, '#ffffff', 0.6], [110, 170, -1.4, '#24282c', 0.3]]) objs.push([d, (p) => drawBoatChaseFar(g, p.x, p.y, p.s, a, { hull, speed: sp, t, tilt: p.tilt }), wx]);
    objs.sort((a, b) => b[0] - a[0]).forEach(([d, fn, wx]) => fn(proj(wx, d)));
    const hp = proj(0, 40); drawBoatChase(g, hp.x, hp.y, hp.s, { t, speed: 0.85, roll: 0.06, pitch: 0.07, crew: ['michael', 'jorge', 'jemel'] });
    res['chase-scene'] = c.toDataURL('image/png');
  }
  const chaseBg = (hy) => (g, x, y, w, h, seed) => seaH(g, x, y, w, h, y + hy, seed);
  res['chase-hero'] = sheet([
    { name: 'Player boat', sub: 'drawBoatChase s 1', h: 330, cells: [
      cell(270, 'idle, no crew', (g, x, y) => drawBoatChase(g, x, y + 50, 1, { t: 1 })),
      cell(270, 'idle, crew', (g, x, y) => drawBoatChase(g, x, y + 50, 1, { t: 1, crew: ['michael', 'jorge', 'jemel'] })),
      cell(270, 'speed .5', (g, x, y) => drawBoatChase(g, x, y + 50, 1, { t: 1, speed: 0.5, pitch: 0.04, crew: ['jemel', 'michael'] })),
      cell(270, 'speed 1, pitch .1', (g, x, y) => drawBoatChase(g, x, y + 50, 1, { t: 1, speed: 1, pitch: 0.1, crew: ['michael', 'jorge', 'jemel'] }))] },
    { name: 'Banking', sub: 'roll ±.22, speed .8', h: 330, cells: [
      cell(270, 'roll -.22 (left turn)', (g, x, y) => drawBoatChase(g, x, y + 50, 1, { t: 2, speed: 0.8, roll: -0.22, pitch: 0.06, crew: ['michael', 'jorge', 'jemel'] })),
      cell(270, 'roll .22 (right turn)', (g, x, y) => drawBoatChase(g, x, y + 50, 1, { t: 2, speed: 0.8, roll: 0.22, pitch: 0.06, crew: ['michael', 'jorge', 'jemel'] })),
      cell(270, 'navy hull, roll .1', (g, x, y) => drawBoatChase(g, x, y + 50, 1, { t: 3, speed: 0.6, roll: 0.1, hull: '#1f3554', top: '#e9edf0', crew: ['jorge'] })),
      cell(270, 'drifting, roll -.06', (g, x, y) => drawBoatChase(g, x, y + 50, 1, { t: 3, roll: -0.06, pitch: -0.02, crew: ['jemel', 'jorge', 'michael'] }))] },
    { name: 'Sizes', sub: 's .25 / .45 / 1.6', h: 420, cells: [
      cell(110, 's .25', (g, x, y) => drawBoatChase(g, x, y + 30, 0.25, { t: 1, speed: 0.8, crew: ['michael', 'jorge', 'jemel'] })),
      cell(170, 's .45', (g, x, y) => drawBoatChase(g, x, y + 40, 0.45, { t: 1, speed: 0.6, roll: 0.1, crew: ['michael', 'jorge', 'jemel'] })),
      cell(450, 's 1.6', (g, x, y) => drawBoatChase(g, x, y + 80, 1.6, { t: 1.4, speed: 0.75, roll: 0.05, pitch: 0.06, crew: ['michael', 'jorge', 'jemel'] }))] }
  ], 1220, chaseBg(40));
  const heads = [0, 0.785, 1.571, 2.356, 3.1416, -2.356, -1.571, -0.785];
  res['chase-objects'] = sheet([
    { name: 'Far boats', sub: 'drawBoatChaseFar s .45', h: 190, cells: heads.map((a, i) => cell(130, 'ang ' + a.toFixed(2), (g, x, y) => drawBoatChaseFar(g, x, y + 30, 0.45, a, { hull: ['#ffffff', '#2f6fb0', '#f2c33a', '#24282c'][i % 4], speed: 0.6, t: i }))) },
    { name: 'Far boats', sub: 's .2 and .1', h: 110, cells: heads.map((a, i) => cell(130, '', (g, x, y) => { drawBoatChaseFar(g, x - 25, y + 10, 0.2, a, { hull: ['#ffffff', '#2f6fb0', '#f2c33a', '#24282c'][i % 4], speed: 0.6, t: i }); drawBoatChaseFar(g, x + 35, y + 10, 0.1, a, { hull: '#ffffff', speed: 0.5, t: i }); })) },
    { name: 'Markers', sub: 'drawMarkerPost', h: 250, cells: [
      cell(130, 'red 8 s 1', (g, x, y) => drawMarkerPost(g, x, y + 95, 1, { kind: 'red', n: 8, t: 0.1 })),
      cell(130, 'green 7 s 1', (g, x, y) => drawMarkerPost(g, x, y + 95, 1, { kind: 'green', n: 7, t: 1 })),
      cell(130, 'white s 1.4', (g, x, y) => drawMarkerPost(g, x, y + 85, 1.4, { kind: 'white', n: 2, t: 1 })),
      cell(140, 's .5', (g, x, y) => { drawMarkerPost(g, x - 30, y + 60, 0.5, { kind: 'red', n: 12, t: 1 }); drawMarkerPost(g, x + 15, y + 60, 0.5, { kind: 'green', n: 11, t: 1 }); drawMarkerPost(g, x + 45, y + 60, 0.5, { kind: 'white', n: 5, t: 1 }); }),
      cell(140, 's .25', (g, x, y) => { drawMarkerPost(g, x - 30, y + 30, 0.25, { kind: 'red', n: 2, t: 1 }); drawMarkerPost(g, x, y + 30, 0.25, { kind: 'green', n: 1, t: 1 }); drawMarkerPost(g, x + 30, y + 30, 0.25, { kind: 'white', n: 9, t: 1 }); })] },
    { name: 'Trap floats', sub: 'drawTrapFloat', h: 170, cells: [
      cell(130, 's 5', (g, x, y) => drawTrapFloat(g, x, y + 30, 5, { color: '#ff6a3d', stripe: '#1b3f8a', t: 0.5 })),
      cell(130, 's 5 yellow', (g, x, y) => drawTrapFloat(g, x, y + 30, 5, { color: '#ffd23a', stripe: '#e03a3a', t: 1.5 })),
      cell(200, 's 2.5', (g, x, y) => ['#ff6a3d', '#ffffff', '#7be36a', '#ff4fa0'].forEach((col, i) => drawTrapFloat(g, x - 60 + i * 40, y + 20, 2.5, { color: col, stripe: ['#1b3f8a', '#111111', '#1b3f8a', '#111111'][i], t: i }))),
      cell(150, 's 1.2', (g, x, y) => ['#ff6a3d', '#ffffff', '#ffd23a', '#ff4fa0'].forEach((col, i) => drawTrapFloat(g, x - 45 + i * 30, y + 10, 1.2, { color: col, stripe: '#1b3f8a', t: i })))] },
    { name: 'Alligator Light', sub: 'drawLighthouseSide', h: 330, cells: [
      cell(330, 's .14 (flash)', (g, x, y) => drawLighthouseSide(g, x, y + 140, 0.14, { t: 0.1 })),
      cell(200, 's .14 dark', (g, x, y) => drawLighthouseSide(g, x, y + 140, 0.14, { t: 2.5 })),
      cell(160, 's .06', (g, x, y) => drawLighthouseSide(g, x, y + 60, 0.06, { t: 0.65 })),
      cell(120, 's .03', (g, x, y) => drawLighthouseSide(g, x, y + 30, 0.03, { t: 1.2 }))] }
  ], 1180, chaseBg(70));
  // the small sizes, blown up 3x so the pixels can be judged
  {
    const [c, g] = mk(420, 150); water(g, 0, 0, 420, 150, 5);
    drawManateeTop(g, 30, 40, 0.3, -0.4, { t: 1 }); drawDolphinTop(g, 90, 40, 0.35, 0.3, { t: 1, up: 0.6 }); drawTurtleTop(g, 145, 40, 0.5, -0.6, { t: 1 }); drawRayTop(g, 205, 40, 0.45, 0, { t: 1 });
    drawCenterConsoleTop(g, 270, 40, 0.2, -0.4, { hull: '#2f6fb0' }); drawFwcBoatTop(g, 330, 40, 0.2, 0.2, { t: 0.02 }); drawSailboatTop(g, 390, 40, 0.18, -0.5, {});
    drawSkiffTop2(g, 30, 110, 0.27, 0.3, {}); drawKayakTop(g, 90, 110, 0.45, -0.5, { t: 1 }); drawBirdShadow(g, 150, 105, 0.35, 0, { kind: 'pelican', t: 0.3, alt: 14 }); drawPelicanTop(g, 150, 105, 0.35, 0, { t: 0.3 });
    drawBirdShadow(g, 200, 110, 0.5, 0.4, { t: 0.1, alt: 12 }); drawGullTop(g, 200, 110, 0.5, 0.4, { t: 0.1 });
    seaH(g, 230, 70, 190, 80, 80, 2); drawBoatChaseFar(g, 260, 120, 0.12, 1.2, { speed: 0.6 }); drawBoatChaseFar(g, 300, 110, 0.08, -0.4, { hull: '#2f6fb0', speed: 0.6 }); drawMarkerPost(g, 335, 125, 0.2, { kind: 'red', n: 4, t: 1 }); drawMarkerPost(g, 355, 120, 0.15, { kind: 'green', n: 3, t: 1 }); drawTrapFloat(g, 375, 130, 1, { t: 1 }); drawLighthouseSide(g, 400, 95, 0.02, { t: 0.1 }); drawBoatChase(g, 260, 140, 0.18, { speed: 0.7, crew: ['michael', 'jorge', 'jemel'] });
    const [z, zg] = mk(1260, 450); zg.imageSmoothingEnabled = false; zg.drawImage(c, 0, 0, 1260, 450);
    res['small-3x'] = z.toDataURL('image/png');
  }
  return res;
});
// rough per-call cost, to keep the per-frame sprites cheap
const perf = await page.evaluate(() => {
  const c = document.createElement('canvas'); c.width = 960; c.height = 540; const g = c.getContext('2d'), out = {};
  const time = (name, fn, n = 60) => { fn(0); const t0 = performance.now(); for (let i = 0; i < n; i++) fn(i * 0.016); out[name] = +((performance.now() - t0) / n).toFixed(3); };
  time('drawBoatChase s1 speed.8 crew3', (t) => drawBoatChase(g, 480, 400, 1, { t, speed: 0.8, roll: 0.1, pitch: 0.06, crew: ['michael', 'jorge', 'jemel'] }));
  time('drawBoatChaseFar s.3', (t) => drawBoatChaseFar(g, 300, 200, 0.3, 1, { t, speed: 0.6 }), 200);
  time('drawMarkerPost s.5', (t) => drawMarkerPost(g, 300, 200, 0.5, { kind: 'red', n: 4, t }), 400);
  time('drawTrapFloat s2', (t) => drawTrapFloat(g, 300, 200, 2, { t }), 400);
  time('drawLighthouseSide s.08', (t) => drawLighthouseSide(g, 300, 300, 0.08, { t }), 200);
  time('drawCenterConsoleTop s.6', (t) => drawCenterConsoleTop(g, 300, 200, 0.6, t, { crew: ['michael', 'jorge'] }), 200);
  time('drawManateeTop s1', (t) => drawManateeTop(g, 300, 200, 1, t, { t, surfacing: 1 }), 200);
  time('drawDolphinTop s1 up.6', (t) => drawDolphinTop(g, 300, 200, 1, t, { t, up: 0.6 }), 200);
  time('drawRayTop s1', (t) => drawRayTop(g, 300, 200, 1, t, { t }), 200);
  return out;
});
console.log('ms per call:', JSON.stringify(perf));
for (const [k, url] of Object.entries(sheets)) { const f = path.join(out, `seaart-${k}.png`); fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64')); console.log(f); }
console.log(errs.length ? errs.join('\n') : 'ok');
await browser.close();
