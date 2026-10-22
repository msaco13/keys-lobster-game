'use strict';
/* Keys Crew — the water around the Upper Keys, seen from above.
   World x runs down the island chain (Long Key on the left, Key Largo on the right). World y runs across it:
   Florida Bay and the Everglades up top, then the islands, Hawk Channel, the reef line and the Gulf Stream.
   Depths are in feet; zero or less is land. Features are laid out as (x, s): s is the offset from the chain,
   positive on the ocean side, negative on the bay side. */

const WORLD = { W: 15400, H: 12700, CELL: 32 };
const HOME = { x: 8740 };

/* ---------- noise ---------- */
function hash2(ix, iy) { let h = (Math.imul(ix | 0, 374761393) + Math.imul(iy | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
function vnoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  return lerp(lerp(hash2(ix, iy), hash2(ix + 1, iy), sx), lerp(hash2(ix, iy + 1), hash2(ix + 1, iy + 1), sx), sy);
}
function fbm(x, y) { return vnoise(x, y) * 0.55 + vnoise(x * 2.03 + 17, y * 2.03 + 9) * 0.3 + vnoise(x * 4.1 + 3, y * 4.1 + 31) * 0.15; }
const smooth01 = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
function segDist(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy; const t = l2 ? clamp(((px - ax) * vx + (py - ay) * vy) / l2, 0, 1) : 0;
  return Math.hypot(px - ax - vx * t, py - ay - vy * t);
}

/* ---------- the island chain ---------- */
function chainY(x) { return 5760 + 110 * Math.sin(x * 0.0004 + 0.5); }
const wy = (x, s) => chainY(x) + s;
const ISLANDS = [
  { name: 'LONG KEY', x0: 480, x1: 2000, hw: 110 },
  { name: 'LOWER MATECUMBE', x0: 2400, x1: 3600, hw: 95 },
  { name: 'ISLAMORADA', x0: 3870, x1: 5600, hw: 130 },
  { name: 'WINDLEY KEY', x0: 5760, x1: 6320, hw: 120 },
  { name: 'PLANTATION KEY', x0: 6500, x1: 8000, hw: 150 },
  { name: 'KEY LARGO', x0: 8180, x1: 16400, hw: 175, grow: true }
];
const GAP_NAMES = ['Channel Five', 'Channel Two', 'Whale Harbor', 'Snake Creek', 'Tavernier Creek'];
const GAPS = ISLANDS.slice(0, -1).map((I, i) => ({ name: GAP_NAMES[i], x0: I.x1, x1: ISLANDS[i + 1].x0, x: (I.x1 + ISLANDS[i + 1].x0) / 2 }));
const TOWNS = [{ name: 'TAVERNIER', x0: 8200, x1: 9900 }, { name: 'ISLAMORADA', x0: 3900, x1: 5500 }, { name: 'KEY LARGO', x0: 11500, x1: 15000 }, { name: 'PLANTATION', x0: 6600, x1: 7900 }];
function islandHW(I, x) {
  if (x < I.x0 || x > I.x1) return 0;
  const hl = (I.x1 - I.x0) / 2, xc = I.x0 + hl, u = Math.abs(x - xc) / hl;
  const end = I.x1 > WORLD.W && x > xc ? 1 : Math.sqrt(Math.max(0, 1 - Math.pow(u, 6)));
  const grow = I.grow ? 1 + clamp((x - 11000) / 4000, 0, 1) * 0.8 : 1;
  return I.hw * grow * (0.93 + 0.14 * vnoise(x * 0.004, I.x0 * 0.01)) * end;
}
function islandAt(x) { for (const I of ISLANDS) if (x >= I.x0 && x <= I.x1) return I; return null; }
function shoreHW(x) { const I = islandAt(x); return I ? islandHW(I, x) : 0; }
function gapAt(x) { for (const g of GAPS) if (x > g.x0 - 6 && x < g.x1 + 6) return g; return null; }
function mainlandS(x) { return -5050 + 320 * (fbm(x * 0.0015, 5.5) - 0.5) - 80 * Math.sin(x * 0.0009); }

/* ---------- Florida Bay: channels, banks and mangrove keys ---------- */
const BAY_CHANNELS = [
  { w: 130, pts: [[6410, -100], [6300, -700], [5900, -1300], [5500, -1900], [5150, -2600], [4800, -3300], [4500, -4000], [4320, -4600], [4320, -5000]] },
  { w: 120, pts: [[8090, -100], [8040, -600], [7800, -1100], [7680, -1310]] },
  { w: 110, pts: [[7800, -1100], [7100, -1350], [6300, -1450], [5900, -1300]] },
  { w: 110, pts: [[5680, -100], [5560, -700], [5900, -1300]] },
  { w: 110, pts: [[3735, -100], [3780, -800], [4300, -1700], [5150, -2600]] },
  { w: 120, pts: [[2200, -100], [2450, -1000], [3100, -1700], [4300, -1700]] }
];
const BAY_SEGS = [];
for (const c of BAY_CHANNELS) for (let i = 1; i < c.pts.length; i++) {
  const [x0, s0] = c.pts[i - 1], [x1, s1] = c.pts[i], ax = x0, ay = wy(x0, s0), bx = x1, by = wy(x1, s1);
  BAY_SEGS.push({ ax, ay, bx, by, hw: c.w / 2, minx: Math.min(ax, bx) - c.w, maxx: Math.max(ax, bx) + c.w, miny: Math.min(ay, by) - c.w, maxy: Math.max(ay, by) + c.w });
}
function channelDist(x, y) { let best = 1e9; for (const c of BAY_SEGS) { if (x < c.minx || x > c.maxx || y < c.miny || y > c.maxy) continue; const d = segDist(x, y, c.ax, c.ay, c.bx, c.by) / c.hw; if (d < best) best = d; } return best; }
function bankK(x, s) { return fbm(x * 0.0016 + 40, s * 0.0042 + 11); }

// mangrove keys: a few real ones by name, the rest scattered on the bay banks
const KEYS = [];
function spotXY(id) { const a = SPOTS[id].at; return [a[0], wy(a[0], a[1])]; }
(function buildKeys() {
  const named = [
    { name: 'Tavernier Key', x: 9150, s: 560, rx: 95, ry: 52, rot: 0.2 },
    { name: 'Rodriguez Key', x: 10500, s: 780, rx: 230, ry: 120, rot: -0.1 },
    { name: 'Indian Key', x: 4150, s: 640, rx: 60, ry: 40, rot: 0.4 },
    { name: 'Lignumvitae Key', x: 3300, s: -760, rx: 170, ry: 120, rot: 0.3 },
    { name: 'Shell Key', x: 4720, s: -560, rx: 110, ry: 66, rot: -0.3 },
    { name: 'Cotton Key', x: 6900, s: -2300, rx: 140, ry: 80, rot: 0.5 },
    { name: 'Buttonwood Key', x: 8800, s: -1900, rx: 160, ry: 90, rot: -0.2 }
  ];
  const ok = (x, y, r) => {
    if (channelDist(x, y) * 60 < r + 120) return false;
    for (const id of SPOT_ORDER) { const [sx, sy] = spotXY(id); if (dist(x, y, sx, sy) < SPOTS[id].r + r + 160) return false; }
    for (const k of KEYS) if (dist(x, y, k.x, k.y) < r + Math.max(k.rx, k.ry) + 60) return false;
    return true;
  };
  for (const k of named) { k.y = wy(k.x, k.s); k.seed = hash2(k.x, 7) * 50; KEYS.push(k); }
  const rng = mulberry(4242);
  for (let i = 0; i < 900 && KEYS.length < 90; i++) {
    const x = 200 + rng() * 15000, s = -4700 + rng() * 4250, y = wy(x, s), rx = 40 + rng() * 150, ry = 30 + rng() * 80;
    if (s > -shoreHW(x) - 360 || s < mainlandS(x) + 260 || bankK(x, s) < 0.6 || !ok(x, y, Math.max(rx, ry))) continue;
    KEYS.push({ x, y, s, rx, ry, rot: rng() * 3, seed: rng() * 50 });
  }
  for (const k of KEYS) k.r = Math.max(k.rx, k.ry) * 1.25;
})();
function keyRadius(k, ang) { return 1 + 0.36 * (vnoise(Math.cos(ang) * 1.6 + k.seed, Math.sin(ang) * 1.6 + k.seed) - 0.5); }
function inKey(k, x, y) {
  const dx = x - k.x, dy = y - k.y; if (Math.abs(dx) > k.r || Math.abs(dy) > k.r) return false;
  const c = Math.cos(k.rot), sn = Math.sin(k.rot), u = (dx * c + dy * sn) / k.rx, v = (-dx * sn + dy * c) / k.ry;
  const r2 = u * u + v * v; if (r2 > 1.6) return false; const w = keyRadius(k, Math.atan2(v, u)); return r2 < w * w;
}

/* ---------- the reef tract ---------- */
const REEF_LINE = [
  { name: 'Tennessee Reef', x: 1300, w: 380 }, { name: 'Alligator Reef', x: 4640, w: 420 }, { name: 'Crocker Reef', x: 5980, w: 320 },
  { name: 'Davis Reef', x: 7250, w: 300 }, { name: 'Pickles Reef', x: 9900, w: 300 }, { name: 'Molasses Reef', x: 12600, w: 420 }, { name: 'French Reef', x: 13600, w: 300 }
];
function crestK(x) { let k = 0.32 * fbm(x * 0.004, 7.7); for (const r of REEF_LINE) { const dx = Math.abs(x - r.x); if (dx < r.w) k = Math.max(k, 0.95 * (1 - (dx / r.w) ** 2) * (0.75 + 0.25 * vnoise(x * 0.02, 3))); } return k; }
const PATCH_REEFS = [];
(function buildReefs() {
  const [hx, hy] = spotXY('bughunt'), rng = mulberry(777);
  for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU + rng(), r = 120 + rng() * 120; PATCH_REEFS.push({ x: hx + Math.cos(a) * r * 1.4, y: hy + Math.sin(a) * r * 0.8, rx: 50 + rng() * 60, ry: 34 + rng() * 40 }); }
  for (let x = 400; x < 15000; x += 420 + rng() * 380) {
    const s = 1260 + rng() * 760, y = wy(x, s), rx = 70 + rng() * 140, ry = 40 + rng() * 80;
    let clear = true; for (const id of SPOT_ORDER) { if (id === 'bughunt') continue; const [sx, sy] = spotXY(id); if (dist(x, y, sx, sy) < SPOTS[id].r + 220) clear = false; }
    if (dist(x, y, hx, hy) < 520) clear = false;
    if (clear) PATCH_REEFS.push({ x, y, rx, ry });
  }
  for (const r of PATCH_REEFS) r.seed = rng() * 100;
})();
// within a boat's swing of a patch reef's groundable crown: routes keep this much sea room, since the autopilot cuts corners
function nearReefCrown(x, y) { const s = y - chainY(x); if (s < 1000 || s > 2300) return false; for (const r of PATCH_REEFS) { const dx = (x - r.x) / (r.rx + 70), dy = (y - r.y) / (r.ry + 70); if (dx * dx + dy * dy < 0.2) return true; } return false; }
function reefK(x, y) { let best = 9; for (const r of PATCH_REEFS) { const dx = (x - r.x) / r.rx; if (Math.abs(dx) > 2) continue; const dy = (y - r.y) / r.ry; const k = dx * dx + dy * dy; if (k < best) best = k; } return best; }

/* ---------- depth ---------- */
function oceanDepth(x, y, s, hw) {
  const d = s - hw;
  let dep;
  if (d < 290) dep = 1.6 + (d / 290) * 3.4 + (fbm(x * 0.006, s * 0.006) - 0.5) * 1.6;
  else if (d < 480) dep = 5 + ((d - 290) / 190) * 11;
  else if (s < 1700) dep = 16 + 6 * fbm(x * 0.0016, s * 0.0016);
  else if (s < 2480) dep = 19 + ((s - 1700) / 780) * 7;
  else if (s < 3200) dep = 26 + Math.pow((s - 2480) / 720, 1.6) * 114;
  else if (s < 4300) dep = 140 + ((s - 3200) / 1100) * 460;
  else dep = 600 + (s - 4300) * 0.6;
  if (hw === 0 && s < 520) dep = Math.max(dep, 11 - s * 0.008);
  if (Math.abs(x - HOME.x) < 70 && d < 680) dep = Math.max(dep, 8 - Math.abs(x - HOME.x) * 0.04);   // the dredged channel out of Tavernier harbor
  const bump = Math.max(0, 1 - ((s - 2400) / 120) ** 2); if (bump > 0) dep -= 22 * crestK(x) * bump;
  if (s > 1100 && s < 2200) { const k = reefK(x, y); if (k < 1) dep = Math.min(dep, 1.6 + 8.4 * k); }   // a patch reef's crown is shallow enough to run aground on at speed (sea.js: under 2.6 ft)
  const [hx, hy] = HUMP_XY; const dh = dist(x, y, hx, hy); if (dh < 1400) dep = Math.min(dep, 450 + (dh / 900) ** 2 * 1300);
  return dep;
}
function bayDepth(x, y, s, hw) {
  const d = -s - hw;
  let dep;
  if (d < 220) dep = 1.4 + (d / 220) * 2.6 + (fbm(x * 0.006, s * 0.006) - 0.5);
  else {
    dep = 4.2 + 2.6 * fbm(x * 0.0011 + 3, s * 0.0011 + 8);
    const b = bankK(x, s); if (b > 0.58) dep = lerp(dep, 0.5, smooth01((b - 0.58) / 0.08));
    const ms = mainlandS(x); if (s < ms + 600) dep = Math.min(dep, 1.6 + ((s - ms) / 600) * 2.6);
  }
  if (hw === 0 && s > -520) dep = Math.max(dep, 11 + s * 0.008);
  const cd = channelDist(x, y); if (cd < 1) dep = Math.max(dep, 7.5 - 4 * cd * cd);
  return dep;
}
let HUMP_XY = [0, 0];
const CARVE = [];  // keep every spot reachable: [x, y, r, min, max]
function depthRaw(x, y) {
  if (x < 0 || y < 0 || x > WORLD.W || y > WORLD.H) return 900;
  const cy = chainY(x), s = y - cy, hw = shoreHW(x);
  if (Math.abs(x - HOME.x) < 30 && s > -60 && s < hw + 6) return 7;          // the canal behind the house
  if (Math.abs(s) < hw) return -1;
  const ms = mainlandS(x);
  if (s < ms) { if (Math.abs(x - SPOTS.flamingo.at[0]) < 64 && s > ms - 240) return 5; return -1; }
  for (const k of KEYS) if (inKey(k, x, y)) return -1;
  let dep = s >= 0 ? oceanDepth(x, y, s, hw) : bayDepth(x, y, s, hw);
  for (const c of CARVE) { const dd = dist(x, y, c[0], c[1]); if (dd < c[2]) dep = clamp(dep, c[3], c[4]); }
  return dep;
}

/* ---------- colors ---------- */
const DEPTH_STOPS = [[0, [214, 240, 226]], [1.5, [190, 234, 220]], [3, [146, 222, 208]], [5, [98, 208, 202]], [9, [62, 192, 205]], [16, [42, 169, 204]], [24, [33, 150, 199]], [40, [26, 127, 190]], [80, [20, 104, 173]], [150, [16, 83, 155]], [400, [13, 65, 137]], [900, [10, 50, 118]]];
function depthRGB(d) {
  if (d <= 0) return [205, 190, 140];
  for (let i = 1; i < DEPTH_STOPS.length; i++) { const [d1, c1] = DEPTH_STOPS[i]; if (d < d1) { const [d0, c0] = DEPTH_STOPS[i - 1], k = (d - d0) / (d1 - d0); return [lerp(c0[0], c1[0], k), lerp(c0[1], c1[1], k), lerp(c0[2], c1[2], k)]; } }
  return DEPTH_STOPS[DEPTH_STOPS.length - 1][1].slice();
}
const mixRGB = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
function waterRGB(x, y, d) {
  const s = y - chainY(x);
  if (d <= 0) {
    const veg = [86, 130, 78]; return mixRGB(veg, [70, 112, 66], fbm(x * 0.01, y * 0.01));
  }
  let c = depthRGB(d);
  if (s < 0 && d < 8) c = mixRGB(c, [168, 204, 160], clamp((8 - d) / 8, 0, 1) * 0.55);                 // the bay is muddier
  if (s < 0 && SPOTS.flamingo && y < wy(x, -3800)) c = mixRGB(c, [150, 150, 100], 0.28);              // tannin water off the Everglades
  const grass = fbm(x * 0.0042 + 5, y * 0.0042 + 1);
  if (d < 22 && grass > 0.52) c = mixRGB(c, [58, 128, 104], clamp((grass - 0.52) * 3, 0, 1) * (s < 0 ? 0.5 : 0.38));
  if (s > 1100 && s < 2200) { const k = reefK(x, y); if (k < 0.75) c = mixRGB(c, [118, 100, 66], 0.62 + 0.25 * fbm(x * 0.03, y * 0.03)); else if (k < 1.7) c = mixRGB(c, [226, 245, 236], 0.45 * (1 - Math.abs(k - 1.2) / 0.5)); }
  const crest = Math.max(0, 1 - ((s - 2400) / 120) ** 2) * crestK(x); if (crest > 0.35) c = mixRGB(c, [128, 108, 70], (crest - 0.35) * 1.1);
  return c;
}
function chartRGB(d, x, y) {
  if (d <= 0) return [233, 218, 160];
  const s = y - chainY(x);
  if (s > 1100 && s < 2200 && reefK(x, y) < 0.9) return [196, 184, 214];
  if (Math.max(0, 1 - ((s - 2400) / 120) ** 2) * crestK(x) > 0.45) return [196, 184, 214];
  return d < 4 ? [178, 220, 240] : d < 12 ? [204, 233, 248] : d < 60 ? [234, 245, 250] : [248, 251, 252];
}
const chartBand = (d) => (d <= 0 ? 0 : d < 4 ? 1 : d < 12 ? 2 : d < 60 ? 3 : d < 300 ? 4 : 5);

/* ---------- the world: textures, paths, structures ---------- */
const World = {
  ready: false,
  // The grid is built a few rows at a time while the title screen is up (warm), and finished on the spot if needed (build).
  build() { if (this.ready) return; this.prep(); while (this.row < this.gh) this.rows(64); this.finish(); },
  warm() {
    if (this.ready || this.warming) return; this.warming = true;
    const step = () => { if (this.ready) return; try { this.prep(); this.rows(10); if (this.row >= this.gh) this.finish(); else setTimeout(step, 0); } catch (e) { console.warn('world warm-up', e); } };
    setTimeout(step, 400);
  },
  prep() {
    if (this.prepped) return; this.prepped = true;
    HUMP_XY = spotXY('hump');
    CARVE.length = 0;
    for (const id of SPOT_ORDER) {
      const [x, y] = spotXY(id), m = SPOTS[id].mode;
      if (m === 'flats') CARVE.push([x, y, SPOTS[id].r * 0.7, 2.4, 6]);
      else if (m === 'bughunt') CARVE.push([x, y, 150, 10, 40]);
    }
    const C = WORLD.CELL, gw = (this.gw = Math.ceil(WORLD.W / C) + 1), gh = (this.gh = Math.ceil(WORLD.H / C) + 1);
    this.grid = new Float32Array(gw * gh);
    const tex = (this.tex = document.createElement('canvas')); tex.width = gw; tex.height = gh;
    const chart = (this.chart = document.createElement('canvas')); chart.width = gw; chart.height = gh;
    this.ti = tex.getContext('2d').createImageData(gw, gh); this.ci = chart.getContext('2d').createImageData(gw, gh);
    this.row = 0;
  },
  rows(n) {
    const C = WORLD.CELL, gw = this.gw, grid = this.grid, ti = this.ti, ci = this.ci, end = Math.min(this.gh, this.row + n);
    for (let j = this.row; j < end; j++) for (let i = 0; i < gw; i++) {
      const x = i * C, y = j * C, d = depthRaw(x, y), nn = j * gw + i, p = nn * 4;
      grid[nn] = d;
      const c = waterRGB(x, y, d), k = chartRGB(d, x, y);
      ti.data[p] = c[0]; ti.data[p + 1] = c[1]; ti.data[p + 2] = c[2]; ti.data[p + 3] = 255;
      ci.data[p] = k[0]; ci.data[p + 1] = k[1]; ci.data[p + 2] = k[2]; ci.data[p + 3] = 255;
    }
    this.row = end;
  },
  finish() {
    const gw = this.gw, gh = this.gh, grid = this.grid, ci = this.ci;
    // depth contours on the chart
    for (let j = 0; j < gh - 1; j++) for (let i = 0; i < gw - 1; i++) {
      const n = j * gw + i, b = chartBand(grid[n]), b1 = chartBand(grid[n + 1]), b2 = chartBand(grid[n + gw]);
      if ((b !== b1 && Math.max(b, b1) > 2) || (b !== b2 && Math.max(b, b2) > 2) || (b === 0) !== (b1 === 0) || (b === 0) !== (b2 === 0)) { const p = n * 4, dark = b === 0 || b1 === 0 || b2 === 0; ci.data[p] = dark ? 120 : 110; ci.data[p + 1] = dark ? 100 : 150; ci.data[p + 2] = dark ? 60 : 190; }
    }
    this.tex.getContext('2d').putImageData(this.ti, 0, 0); this.chart.getContext('2d').putImageData(ci, 0, 0); this.ti = this.ci = null;
    this.buildPaths(); this.buildStuff();
    this.ready = true;
  },
  // bilinear depth from the grid (for the minimap, the autopilot and anything that can live with 32-unit detail)
  gridDepth(x, y) {
    const C = WORLD.CELL, gx = clamp(x / C, 0, this.gw - 1.001), gy = clamp(y / C, 0, this.gh - 1.001), i = Math.floor(gx), j = Math.floor(gy), fx = gx - i, fy = gy - j, g = this.grid, w = this.gw;
    return lerp(lerp(g[j * w + i], g[j * w + i + 1], fx), lerp(g[(j + 1) * w + i], g[(j + 1) * w + i + 1], fx), fy);
  },
  depth(x, y) { return depthRaw(x, y); },
  buildPaths() {
    const poly = (pts) => { const p = new Path2D(); pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y))); p.closePath(); return p; };
    for (const I of ISLANDS) {
      const top = [], bot = [], vt = [], vb = [], x1 = Math.min(I.x1, WORLD.W + 300), xs = [];
      for (let x = I.x0; x < x1; x += 24) xs.push(x);
      xs.push(x1);
      for (const x of xs) {
        const hw = islandHW(I, x), cy = chainY(x); top.push([x, cy - hw]); bot.push([x, cy + hw]);
        const vh = Math.max(0, hw - 22); vt.push([x, cy - vh]); vb.push([x, cy + vh]);
      }
      I.path = poly(top.concat(bot.reverse())); I.veg = poly(vt.concat(vb.reverse()));
    }
    for (const k of KEYS) {
      const out = [], inn = [];
      for (let i = 0; i < 40; i++) {
        const a = (i / 40) * TAU, w = keyRadius(k, a), u = Math.cos(a) * w, v = Math.sin(a) * w, c = Math.cos(k.rot), sn = Math.sin(k.rot);
        const px = (u * k.rx) * c - (v * k.ry) * sn, py = (u * k.rx) * sn + (v * k.ry) * c;
        out.push([k.x + px, k.y + py]); inn.push([k.x + px * 0.8, k.y + py * 0.8]);
      }
      k.path = poly(out); k.veg = poly(inn);
    }
    const ml = [[-400, -400]];
    for (let x = -400; x <= WORLD.W + 400; x += 40) ml.push([x, wy(x, mainlandS(x))]);
    ml.push([WORLD.W + 400, -400]);
    this.mainland = poly(ml);
  },
  buildStuff() {
    const rng = mulberry(1913);
    // canopy, palms and houses on the islands
    this.canopy = []; this.houses = []; this.palms = [];
    for (const I of ISLANDS) for (let x = I.x0 + 30; x < Math.min(I.x1, WORLD.W + 200) - 20; x += 34 + rng() * 30) {
      const hw = islandHW(I, x); if (hw < 40) continue; const cy = chainY(x);
      for (let k = 0; k < 2; k++) this.canopy.push({ x: x + rng() * 20, y: cy + (rng() - 0.5) * hw * 1.4, r: 14 + rng() * 18, c: rng() });
      if (rng() < 0.3) this.palms.push({ x: x + rng() * 20, y: cy + (rng() < 0.5 ? -1 : 1) * (hw - 16), r: 9 + rng() * 5, a: rng() * 6 });
    }
    for (const T of TOWNS) for (let x = T.x0; x < T.x1; x += 46 + rng() * 40) {
      const hw = shoreHW(x); if (hw < 60 || Math.abs(x - HOME.x) < 60) continue; const cy = chainY(x);
      for (const side of [-1, 1]) if (rng() < 0.75) {
        const off = 30 + rng() * (hw - 66);
        this.houses.push({ x, y: cy + side * off, w: 20 + rng() * 14, h: 16 + rng() * 10, roof: pick(['#c0583a', '#5a7a8a', '#e8e2d2', '#4a6a8a', '#d9cfb4', '#7a9a6a']), pool: rng() < 0.15, side });
      }
    }
    // home: the canal, the dock and the neighbors
    const hcy = chainY(HOME.x), hhw = shoreHW(HOME.x);
    this.home = { x: HOME.x, dockY: hcy - 40, mouthY: hcy + hhw, cy: hcy, hw: hhw };
    for (let y = hcy - 50; y < hcy + hhw - 20; y += 38) for (const side of [-1, 1]) this.houses.push({ x: HOME.x + side * 58, y: y + 10, w: 30, h: 24, roof: side < 0 && y === hcy - 50 ? '#ff6a3d' : pick(['#e8c26a', '#7fc4d8', '#f2a57f', '#b9d98a', '#f4f0e6']), pool: rng() < 0.2, side, canal: true });
    // bridges and their piers
    this.piers = [];
    for (const g of GAPS) { g.y = chainY(g.x); for (let x = g.x0 + 36; x < g.x1 - 30; x += 80) if (Math.abs(x - g.x) > 92) this.piers.push({ x, y: chainY(x), g }); }
    // channel markers: out of each harbor on the ocean side, and down the bay channels
    this.markers = [];
    // each harbor channel is two rows of posts; the route finder treats each row as a fence so the autopilot enters from the end
    this.fences = [];
    const harbor = (x, n0) => {
      const hw = shoreHW(x) || 0; let n = n0; const rows = { g: [], r: [] };
      for (let s = hw + 60; s < hw + 640; s += 130, n += 2) { const g = { x: x - 64, y: wy(x - 64, s), kind: 'green', n: n - 1 }, r = { x: x + 64, y: wy(x + 64, s), kind: 'red', n }; this.markers.push(g, r); rows.g.push(g); rows.r.push(r); }
      for (const row of [rows.g, rows.r]) for (let i = 1; i < row.length; i++) this.fences.push([row[i - 1], row[i]]);
    };
    harbor(HOME.x, 2); harbor(GAPS[3].x, 2); harbor(GAPS[2].x, 2); harbor(GAPS[4].x, 2);
    for (const c of BAY_CHANNELS) for (let i = 1; i < c.pts.length; i++) {
      const [x0, s0] = c.pts[i - 1], [x1, s1] = c.pts[i], L = Math.hypot(x1 - x0, s1 - s0), nx = -(s1 - s0) / L, ns = (x1 - x0) / L;
      for (let t = 220; t < L - 60; t += 360) { const side = (Math.round(t / 360) % 2) ? 1 : -1, x = x0 + (x1 - x0) * t / L + nx * side * (c.w * 0.62), s = s0 + (s1 - s0) * t / L + ns * side * (c.w * 0.62); this.markers.push({ x, y: wy(x, s), kind: 'white' }); }
    }
    for (const r of REEF_LINE) if (r.name !== 'Alligator Reef') this.markers.push({ x: r.x, y: wy(r.x, 2405), kind: 'reef', name: r.name });
    const [lx] = spotXY('alligator'); this.light = { x: lx, y: wy(lx, 2420) };
    const [wx, wyy] = spotXY('wreck'); this.wreckBuoys = [{ x: wx - 36, y: wyy + 10 }, { x: wx + 40, y: wyy - 12 }];
    // no-wake zones
    this.zones = [{ kind: 'rect', x0: HOME.x - 140, x1: HOME.x + 140, y0: hcy - 80, y1: wy(HOME.x, hhw + 560), name: 'Tavernier harbor' }];
    for (const g of GAPS) this.zones.push({ kind: 'circle', x: g.x, y: g.y, r: 300, name: g.name });
    const [fx, fy] = spotXY('flamingo'); this.zones.push({ kind: 'circle', x: fx, y: wy(fx, mainlandS(fx)), r: 420, name: 'Flamingo marina' });
    this.signs = [{ x: HOME.x + 80, y: wy(HOME.x, hhw + 40) }, { x: HOME.x - 110, y: wy(HOME.x, hhw + 540) }];
    for (const g of GAPS) { this.signs.push({ x: g.x + 120, y: g.y + 250 }); this.signs.push({ x: g.x - 120, y: g.y - 250 }); }
    // trap floats
    this.floats = []; this.floatBuckets = new Map();
    const fr = mulberry(31337);
    for (let x = 100; x < WORLD.W - 100; x += 230) for (let s = -4200; s < 2300; s += 230) {
      const ocean = s > 0, p = ocean ? (s < 2250 ? 0.42 : 0) : 0.08; if (fr() > p) continue;
      const fx2 = x + fr() * 200, fy2 = wy(fx2, s + fr() * 200), d = depthRaw(fx2, fy2);
      if (d < 4.5 || d > 60 || channelDist(fx2, fy2) < 1.6 || this.inZone(fx2, fy2) || dist(fx2, fy2, HOME.x, hcy) < 900) continue;
      let nearSpot = false; for (const id of SPOT_ORDER) { const [sx, sy] = spotXY(id); if (dist(fx2, fy2, sx, sy) < SPOTS[id].r * 0.8) nearSpot = true; } if (nearSpot) continue;
      const f = { x: fx2, y: fy2, c: pick(['#ff6a3d', '#ffffff', '#ffd23a', '#7be36a', '#ff4fa0']), st: pick(['#1b3f8a', '#e03a3a', '#111111']), hit: false };
      this.floats.push(f); const key = Math.floor(fx2 / 400); if (!this.floatBuckets.has(key)) this.floatBuckets.set(key, []); this.floatBuckets.get(key).push(f);
    }
    // sargassum offshore, thickest around the weedline
    this.weed = [];
    const [tx, ty] = spotXY('troll');
    for (let i = 0; i < 70; i++) { const near = i < 22, x = near ? tx + (fr() - 0.5) * 1800 : 300 + fr() * 14800, y = near ? ty + (fr() - 0.5) * 700 : wy(x, 4200 + fr() * 2400); const blobs = []; const len = 120 + fr() * 420; for (let s = 0; s < len; s += 12 + fr() * 14) blobs.push([s, Math.sin(s * 0.02) * 12 + (fr() - 0.5) * 12, 5 + fr() * 9]); this.weed.push({ x, y, ang: (fr() - 0.5) * 0.6, len, blobs }); }
    // the road: a few cars on US-1
    this.cars = []; for (let i = 0; i < 26; i++) this.cars.push({ x: 300 + fr() * 14800, dir: i % 2 ? 1 : -1, c: pick(['#e84a3a', '#f4f4f4', '#2a5bd8', '#222222', '#f2c12e', '#8a8f96', '#3a7a4a']), sp: 160 + fr() * 120 });
    // cloud shadows drift over everything
    this.clouds = []; for (let i = 0; i < 26; i++) this.clouds.push({ x: fr() * WORLD.W, y: fr() * WORLD.H, r: 260 + fr() * 420, k: 0.6 + fr() * 0.5 });
  },
  // a tiling swell texture: soft light and dark patches that drift across the water
  swell() {
    if (this._swell) return this._swell;
    const S = 256, P = 6, c = document.createElement('canvas'); c.width = S; c.height = S;
    const g = c.getContext('2d'), img = g.createImageData(S, S);
    const h = (i, j) => hash2(((i % P) + P) % P, ((j % P) + P) % P), vn = (x, y) => { const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy); return lerp(lerp(h(ix, iy), h(ix + 1, iy), sx), lerp(h(ix, iy + 1), h(ix + 1, iy + 1), sx), sy); };
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const u = (x / S) * P, v = (y / S) * P, n = vn(u, v) * 0.65 + vn(u * 2 + 0.5, v * 2 + 0.5) * 0.35, p = (y * S + x) * 4, k = (n - 0.5) * 2;
      const lite = k > 0; img.data[p] = lite ? 255 : 0; img.data[p + 1] = lite ? 255 : 30; img.data[p + 2] = lite ? 255 : 60; img.data[p + 3] = Math.round(Math.min(1, Math.abs(k) * 1.4) * 255);
    }
    g.putImageData(img, 0, 0);
    return (this._swell = c);
  },
  inZone(x, y) {
    for (const z of this.zones) { if (z.kind === 'rect' ? x > z.x0 && x < z.x1 && y > z.y0 && y < z.y1 : dist(x, y, z.x, z.y) < z.r) return z; }
    return null;
  },
  floatsNear(x) { const k = Math.floor(x / 400), out = []; for (let i = k - 1; i <= k + 1; i++) { const b = this.floatBuckets.get(i); if (b) out.push(...b); } return out; },
  /* ---------- route finding: A* over the depth grid, then string-pulled to a few waypoints ---------- */
  passMask() {
    if (this.pass) return this.pass;
    const C = WORLD.CELL, gw = this.gw, gh = this.gh, pass = (this.pass = new Uint8Array(gw * gh));
    for (let n = 0; n < pass.length; n++) pass[n] = this.grid[n] >= 3 ? 1 : 0;
    const block = (x, y, r) => { const i0 = Math.round(x / C), j0 = Math.round(y / C); for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) { const i = i0 + di, j = j0 + dj; if (i >= 0 && j >= 0 && i < gw && j < gh) pass[j * gw + i] = 0; } };
    for (const p of this.piers) block(p.x, p.y, 1);
    for (const m of this.markers) block(m.x, m.y, 1);
    for (const [a, b] of this.fences) for (let k = 0; k <= 1; k += 0.1) block(lerp(a.x, b.x, k), lerp(a.y, b.y, k), 1);
    block(this.light.x, this.light.y, 2);
    return pass;
  },
  obstacles() {
    if (this.obst) return this.obst;
    this.obst = this.piers.map((p) => ({ x: p.x, y: p.y, r: 10 })).concat(this.markers.map((m) => ({ x: m.x, y: m.y, r: 7 })), [{ x: this.light.x, y: this.light.y, r: 46 }]);
    for (const [a, b] of this.fences) for (let k = 0.2; k < 1; k += 0.2) this.obst.push({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), r: 7 });
    return this.obst;
  },
  findPath(x0, y0, x1, y1) {
    const C = WORLD.CELL, gw = this.gw, gh = this.gh, N = gw * gh, pass = this.passMask(), grid = this.grid;
    const near = (x, y) => {
      const i0 = clamp(Math.round(x / C), 0, gw - 1), j0 = clamp(Math.round(y / C), 0, gh - 1);
      for (let r = 0; r < 8; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) { if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue; const i = i0 + di, j = j0 + dj; if (i >= 0 && j >= 0 && i < gw && j < gh && pass[j * gw + i]) return j * gw + i; }
      return -1;
    };
    const s = near(x0, y0), g = near(x1, y1); if (s < 0 || g < 0) return null;
    const gi = g % gw, gj = (g / gw) | 0;
    const cost = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    const heap = [], hf = (n) => cost[n] + 1.0 * Math.hypot((n % gw) - gi, ((n / gw) | 0) - gj);
    const push = (n) => { heap.push([hf(n), n]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top[1]; };
    cost[s] = 0; push(s);
    const DI = [1, -1, 0, 0, 1, 1, -1, -1], DJ = [0, 0, 1, -1, 1, -1, 1, -1];
    let found = false, guard = 0;
    while (heap.length && guard++ < 400000) {
      const n = pop(); if (closed[n]) continue; closed[n] = 1; if (n === g) { found = true; break; }
      const i = n % gw, j = (n / gw) | 0;
      for (let k = 0; k < 8; k++) {
        const ii = i + DI[k], jj = j + DJ[k]; if (ii < 0 || jj < 0 || ii >= gw || jj >= gh) continue;
        const m = jj * gw + ii; if (!pass[m] || closed[m]) continue;
        if (k >= 4 && (!pass[j * gw + ii] || !pass[jj * gw + i])) continue;
        const step = (k >= 4 ? 1.414 : 1) * (grid[m] < 6 ? 1.7 : grid[m] < 10 ? 1.2 : 1);
        if (cost[n] + step < cost[m]) { cost[m] = cost[n] + step; from[m] = n; push(m); }
      }
    }
    if (!found) return null;
    const cells = []; for (let n = g; n >= 0; n = from[n]) { cells.push([(n % gw) * C, ((n / gw) | 0) * C]); if (n === s) break; }
    cells.reverse(); cells.push([x1, y1]);
    // string-pull with the real shoreline, a boat's width of clearance, and the posts and pilings
    const obst = this.obstacles();
    const clear = (ax, ay, bx, by) => {
      const L = Math.hypot(bx - ax, by - ay); if (L < 1) return true;
      const nx = -(by - ay) / L, ny = (bx - ax) / L, n = Math.ceil(L / 12);
      for (let k = 0; k <= n; k++) { const x = lerp(ax, bx, k / n), y = lerp(ay, by, k / n); if (depthRaw(x, y) < 2.8 || depthRaw(x + nx * 22, y + ny * 22) < 1.6 || depthRaw(x - nx * 22, y - ny * 22) < 1.6 || nearReefCrown(x, y)) return false; }
      const mnx = Math.min(ax, bx) - 70, mxx = Math.max(ax, bx) + 70, mny = Math.min(ay, by) - 70, mxy = Math.max(ay, by) + 70;
      for (const o of obst) { if (o.x < mnx || o.x > mxx || o.y < mny || o.y > mxy) continue; if (segDist(o.x, o.y, ax, ay, bx, by) < o.r + 26) return false; }
      return true;
    };
    const out = [], last = cells.length - 1; let k = 0, ax = x0, ay = y0;
    while (k < last) {
      let lo = k + 1, hi = -1, step = 1;
      for (;;) { const m = Math.min(last, k + step); if (clear(ax, ay, cells[m][0], cells[m][1])) { lo = m; if (m === last) break; step *= 2; } else { hi = m; break; } }
      if (hi > 0) while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (clear(ax, ay, cells[mid][0], cells[mid][1])) lo = mid; else hi = mid; }
      out.push(cells[lo]); ax = cells[lo][0]; ay = cells[lo][1]; k = lo;
    }
    return out.length ? out : [[x1, y1]];
  },
  update(dt) {
    for (const c of this.cars) { c.x += c.dir * c.sp * dt; if (c.x > WORLD.W + 300) c.x = -300; if (c.x < -300) c.x = WORLD.W + 300; }
    for (const c of this.clouds) { c.x += 14 * dt; c.y -= 5 * dt; if (c.x > WORLD.W + 600) c.x = -600; if (c.y < -600) c.y = WORLD.H + 600; }
  },

  /* ---------- drawing (world transform already applied; v = visible rect in world units) ---------- */
  drawWater(ctx, v, t, o = {}) {
    const C = WORLD.CELL, m = 2;
    const i0 = Math.max(0, Math.floor(v.x0 / C) - m), j0 = Math.max(0, Math.floor(v.y0 / C) - m), i1 = Math.min(this.gw - 1, Math.ceil(v.x1 / C) + m), j1 = Math.min(this.gh - 1, Math.ceil(v.y1 / C) + m);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = v.flat ? 'low' : 'high';   // the chase camera's texture gets redrawn every frame
    ctx.fillStyle = '#0a3276'; ctx.fillRect(v.x0 - 50, v.y0 - 50, v.x1 - v.x0 + 100, v.y1 - v.y0 + 100);
    ctx.drawImage(this.tex, i0, j0, i1 - i0, j1 - j0, i0 * C, j0 * C, (i1 - i0) * C, (j1 - j0) * C);
    // shallow-water detail: grass tufts and sand ripples, only near the boat's zoom
    if (v.z > 0.55) {
      const S = 90;
      for (let gx = Math.floor(v.x0 / S); gx <= v.x1 / S; gx++) for (let gy = Math.floor(v.y0 / S); gy <= v.y1 / S; gy++) {
        const h = hash2(gx, gy); if (h > 0.55) continue;
        const x = gx * S + hash2(gx, gy + 7) * S, y = gy * S + hash2(gx + 3, gy) * S, d = this.gridDepth(x, y);
        if (d <= 0.3 || d > 14) continue;
        const a = 0.16 * (1 - d / 14);
        if (h < 0.3) { ctx.fillStyle = `rgba(30,90,70,${a})`; ell(ctx, x, y, 10 + h * 30, 5 + h * 12, h * 6); ctx.fill(); }
        else { ctx.strokeStyle = `rgba(255,255,240,${a * 1.3})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 14, y); ctx.quadraticCurveTo(x, y - 5, x + 14, y); ctx.stroke(); }
      }
    }
  },
  drawSurface(ctx, v, t, wind) {
    // wave crests and sun glitter, hashed in world space so they stay put on the water
    const S = 64, k = wind.chop, ang = wind.ang, ca = Math.cos(ang), sa = Math.sin(ang);
    ctx.lineCap = 'round';
    for (let gx = Math.floor(v.x0 / S) - 1; gx <= v.x1 / S + 1; gx++) for (let gy = Math.floor(v.y0 / S) - 1; gy <= v.y1 / S + 1; gy++) {
      const h = hash2(gx * 7 + 1, gy * 13 + 5); if (h > 0.2 + k * 0.4) continue;
      const drift = ((t * (10 + k * 14) + h * 64) % 64);
      const x = gx * S + hash2(gx, gy) * S + ca * drift, y = gy * S + hash2(gy, gx) * S + sa * drift;
      const ph = Math.sin(t * 1.4 + h * 40); if (ph < 0) continue;
      const len = 6 + h * 14 + k * 8, a = (0.12 + 0.2 * k) * ph, bow = len * 0.45;
      if (k > 0.3) { ctx.strokeStyle = `rgba(0,40,80,${a * 0.3})`; ctx.lineWidth = 2 + k * 1.4; ctx.beginPath(); ctx.moveTo(x - sa * len + ca * 3, y + ca * len + sa * 3); ctx.quadraticCurveTo(x + ca * (bow + 3), y + sa * (bow + 3), x + sa * len + ca * 3, y - ca * len + sa * 3); ctx.stroke(); }
      ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = 1.6 + k * 1.2;
      ctx.beginPath(); ctx.moveTo(x - sa * len, y + ca * len); ctx.quadraticCurveTo(x + ca * bow, y + sa * bow, x + sa * len, y - ca * len); ctx.stroke();
    }
    const G = 46, sun = v.sun;
    for (let gx = Math.floor(v.x0 / G); gx <= v.x1 / G; gx++) for (let gy = Math.floor(v.y0 / G); gy <= v.y1 / G; gy++) {
      const x = gx * G + hash2(gx + 9, gy) * G, y = gy * G + hash2(gx, gy + 9) * G;
      const mask = Math.exp(-((x - sun.x) ** 2 + (y - sun.y) ** 2) / (2 * sun.r * sun.r)); if (mask < 0.05) continue;
      const tw = Math.pow(Math.max(0, Math.sin(t * (2.5 + hash2(gx, gy) * 3) + hash2(gy, gx) * 30)), 10) * mask;
      if (tw < 0.06) continue;
      const r = 2 + tw * 5; ctx.fillStyle = `rgba(255,252,235,${Math.min(1, tw * 1.3)})`;
      ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x, y - r * 0.35); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r * 0.35); ctx.closePath(); ctx.fill();
    }
  },
  drawCloudShadows(ctx, v, alpha) {
    for (const c of this.clouds) {
      if (c.x + c.r < v.x0 || c.x - c.r > v.x1 || c.y + c.r < v.y0 || c.y - c.r > v.y1) continue;
      const g = ctx.createRadialGradient(c.x, c.y, c.r * 0.2, c.x, c.y, c.r);
      g.addColorStop(0, `rgba(4,24,48,${0.16 * alpha * c.k})`); g.addColorStop(1, 'rgba(4,24,48,0)');
      ctx.fillStyle = g; ell(ctx, c.x, c.y, c.r * 1.3, c.r * 0.8, 0.3); ctx.fill();
    }
  },
  drawLand(ctx, v, t, o = {}) {
    const vis = (x0, x1) => x1 > v.x0 - 60 && x0 < v.x1 + 60;
    // the Everglades
    if (v.y0 < wy(v.x0, -4400) || v.y0 < wy(v.x1, -4400)) {
      ctx.save(); ctx.strokeStyle = 'rgba(190,232,214,0.5)'; ctx.lineWidth = 44; ctx.stroke(this.mainland);
      ctx.fillStyle = '#2f5a35'; ctx.fill(this.mainland); ctx.restore();
      ctx.fillStyle = '#3d7044';
      for (let x = Math.floor(v.x0 / 40) * 40; x < v.x1; x += 40) { const y = wy(x, mainlandS(x)); if (y < v.y0 - 40 || y > v.y1 + 40) continue; ell(ctx, x, y - 14, 26, 18); ctx.fill(); }
      const [fx] = spotXY('flamingo'), fy = wy(fx, mainlandS(fx));
      if (vis(fx - 100, fx + 100)) {
        ctx.fillStyle = RUN_WATER_CANAL; ctx.fillRect(fx - 64, fy - 240, 128, 252);
        ctx.fillStyle = '#9a7b55'; for (let k = 0; k < 4; k++) ctx.fillRect(fx - 60, fy - 220 + k * 52, 40, 8);
        ctx.fillStyle = '#e8e2d2'; ctx.fillRect(fx + 70, fy - 200, 60, 40); ctx.fillStyle = '#5a7a8a'; ctx.fillRect(fx + 70, fy - 200, 60, 16);
        drawBoatTop(ctx, fx - 30, fy - 160, 0.3, 0, {}); drawBoatTop(ctx, fx - 30, fy - 110, 0.3, 0, {});
      }
    }
    // mangrove keys
    for (const k of KEYS) {
      if (!vis(k.x - k.r, k.x + k.r) || k.y + k.r < v.y0 - 40 || k.y - k.r > v.y1 + 40) continue;
      ctx.save(); ctx.strokeStyle = 'rgba(200,236,214,0.45)'; ctx.lineWidth = 26; ctx.stroke(k.path);
      ctx.fillStyle = '#6b5a3c'; ctx.fill(k.path); ctx.fillStyle = '#2f6236'; ctx.fill(k.veg);
      ctx.fillStyle = 'rgba(80,140,80,0.6)';
      for (let i = 0; i < 6; i++) { const a = k.seed + i * 1.1, r = (0.15 + 0.4 * hash2(i, k.seed * 10)) * Math.min(k.rx, k.ry); ell(ctx, k.x + Math.cos(a) * r, k.y + Math.sin(a) * r * 0.7, 10 + 8 * hash2(k.seed * 10, i), 8); ctx.fill(); }
      ctx.restore();
      if (k.name && v.z > 0.5 && !v.flat) text(ctx, k.name, k.x, k.y + 4, { size: 15, align: 'center', base: 'middle', color: 'rgba(255,255,255,0.85)', weight: 800, stroke: 'rgba(20,50,30,0.6)', sw: 3 });
    }
    // the Keys themselves
    for (const I of ISLANDS) {
      if (!vis(I.x0, I.x1)) continue;
      ctx.save();
      ctx.strokeStyle = 'rgba(206,242,226,0.55)'; ctx.lineWidth = 60; ctx.lineJoin = 'round'; ctx.stroke(I.path);
      ctx.strokeStyle = 'rgba(230,248,238,0.6)'; ctx.lineWidth = 22; ctx.stroke(I.path);
      ctx.fillStyle = '#d9c99a'; ctx.fill(I.path);
      ctx.fillStyle = '#5f8f4f'; ctx.fill(I.veg);
      ctx.restore();
    }
    for (const c of this.canopy) { if (c.x < v.x0 - 40 || c.x > v.x1 + 40 || c.y < v.y0 - 40 || c.y > v.y1 + 40) continue; ctx.fillStyle = c.c < 0.5 ? 'rgba(52,100,52,0.75)' : 'rgba(90,140,72,0.7)'; ell(ctx, c.x, c.y, c.r, c.r * 0.8); ctx.fill(); }
    // US-1
    const rx0 = Math.max(0, v.x0 - 40), rx1 = Math.min(WORLD.W, v.x1 + 40);
    if (rx1 > rx0) {
      ctx.strokeStyle = '#6f6f6a'; ctx.lineWidth = 18; ctx.lineCap = 'butt'; ctx.beginPath();
      for (let x = rx0; x <= rx1; x += 30) { if (gapAt(x)) { ctx.moveTo(x + 30, chainY(x + 30)); continue; } x === rx0 ? ctx.moveTo(x, chainY(x)) : ctx.lineTo(x, chainY(x)); }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(242,210,60,0.8)'; ctx.lineWidth = 1.5; ctx.setLineDash([14, 14]); ctx.beginPath();
      for (let x = rx0; x <= rx1; x += 30) { if (gapAt(x)) { ctx.moveTo(x + 30, chainY(x + 30)); continue; } x === rx0 ? ctx.moveTo(x, chainY(x)) : ctx.lineTo(x, chainY(x)); }
      ctx.stroke(); ctx.setLineDash([]);
    }
    for (const h of this.houses) {
      if (h.x < v.x0 - 40 || h.x > v.x1 + 40 || h.y < v.y0 - 40 || h.y > v.y1 + 40) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(h.x - h.w / 2 + 4, h.y - h.h / 2 + 5, h.w, h.h);
      if (v.flat) continue;   // the chase camera builds the houses; just leave their shadows on the ground
      ctx.fillStyle = h.roof; ctx.fillRect(h.x - h.w / 2, h.y - h.h / 2, h.w, h.h);
      ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(h.x - h.w / 2, h.y - h.h / 2, h.w, h.h / 2);
      if (h.pool) { ctx.fillStyle = '#5fd6ee'; rr(ctx, h.x - h.w / 2 + 2, h.y + h.side * (h.h / 2 + 6) - 5, 14, 10, 3); ctx.fill(); }
    }
    if (!v.flat) for (const p of this.palms) { if (p.x < v.x0 - 30 || p.x > v.x1 + 30 || p.y < v.y0 - 30 || p.y > v.y1 + 30) continue; ctx.fillStyle = 'rgba(0,0,0,0.18)'; ell(ctx, p.x + 6, p.y + 7, p.r, p.r * 0.6); ctx.fill(); ctx.fillStyle = '#4f8a3a'; for (let i = 0; i < 6; i++) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a + i * 1.05 + Math.sin(t * 1.3 + p.x) * 0.05); ell(ctx, p.r * 0.6, 0, p.r * 0.7, p.r * 0.2); ctx.fill(); ctx.restore(); } }
    // home canal and dock
    const H = this.home;
    if (vis(H.x - 120, H.x + 120)) {
      ctx.fillStyle = RUN_WATER_CANAL; ctx.fillRect(H.x - 30, H.cy - 62, 60, H.hw + 68);
      ctx.fillStyle = '#e4dfd2'; ctx.fillRect(H.x - 36, H.cy - 66, 6, H.hw + 70); ctx.fillRect(H.x + 30, H.cy - 66, 6, H.hw + 70); ctx.fillRect(H.x - 36, H.cy - 68, 72, 6);
      ctx.fillStyle = '#9a7b55'; ctx.fillRect(H.x - 30, H.cy - 30, 20, 56);
      ctx.strokeStyle = 'rgba(60,40,20,0.45)'; ctx.lineWidth = 1; for (let y = H.cy - 30; y < H.cy + 26; y += 6) { ctx.beginPath(); ctx.moveTo(H.x - 30, y); ctx.lineTo(H.x - 10, y); ctx.stroke(); }
      if (v.z > 0.5 && !v.flat) text(ctx, 'HOME', H.x - 50, H.cy - 82, { size: 14, align: 'center', color: '#fff', weight: 800, stroke: 'rgba(0,0,0,0.5)', sw: 4 });
    }
    // labels (the chase camera stands these up as billboards instead)
    if (v.z > 0.4 && !v.flat) {
      for (const I of ISLANDS) { const lx = clamp((I.x0 + Math.min(I.x1, WORLD.W)) / 2, v.x0 + 200, v.x1 - 200); if (lx < I.x0 + 100 || lx > I.x1 - 100 || !vis(I.x0, I.x1)) continue; text(ctx, I.name, lx, chainY(lx) - 24, { size: 20, align: 'center', base: 'middle', color: 'rgba(255,255,255,0.72)', weight: 800, stroke: 'rgba(30,60,30,0.5)', sw: 4 }); }
    }
  },
  drawMarkers(ctx, v, t) {
    const vis = (x, y, m = 60) => x > v.x0 - m && x < v.x1 + m && y > v.y0 - m && y < v.y1 + m;
    if (!v.flat) for (const f of this.floats) {
      if (f.hit || !vis(f.x, f.y)) continue;
      const bob = Math.sin(t * 2 + f.x) * 1.5;
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x - 16, f.y + 6); ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,0.22)'; ell(ctx, f.x + 3, f.y + 4, 8, 8); ctx.fill();
      ctx.fillStyle = f.c; ell(ctx, f.x, f.y + bob, 8, 8); ctx.fill(); ctx.fillStyle = f.st; ctx.fillRect(f.x - 8, f.y + bob - 2, 16, 4);
    }
    // v.flat: drawing the water for the chase camera, which stands posts, signs and the light up on their own
    if (!v.flat) for (const m of this.markers) {
      if (!vis(m.x, m.y)) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ell(ctx, m.x + 5, m.y + 6, 8, 8); ctx.fill();
      if (m.kind === 'white') { ctx.fillStyle = '#f4f4f0'; ell(ctx, m.x, m.y, 5, 5); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1; ctx.stroke(); continue; }
      if (m.kind === 'reef') { ctx.fillStyle = '#3a3a3a'; ell(ctx, m.x, m.y, 6, 6); ctx.fill(); ctx.fillStyle = '#f4f4f0'; ctx.fillRect(m.x - 9, m.y - 24, 18, 14); ctx.fillStyle = '#e8742c'; ctx.fillRect(m.x - 9, m.y - 20, 18, 5); if (v.z > 0.45) text(ctx, m.name, m.x, m.y + 26, { size: 14, align: 'center', color: '#fff', weight: 800, stroke: 'rgba(0,0,0,0.55)', sw: 4 }); continue; }
      ctx.fillStyle = '#6b5a44'; ell(ctx, m.x, m.y, 5, 5); ctx.fill();
      ctx.fillStyle = m.kind === 'red' ? '#e03a3a' : '#2f9a4a'; ctx.beginPath();
      if (m.kind === 'red') { ctx.moveTo(m.x, m.y - 15); ctx.lineTo(m.x + 12, m.y + 5); ctx.lineTo(m.x - 12, m.y + 5); } else ctx.rect(m.x - 10, m.y - 11, 20, 18);
      ctx.fill(); if (v.z > 0.6) text(ctx, String(m.n), m.x, m.y, { size: 10, align: 'center', base: 'middle', color: '#fff', weight: 800 });
    }
    if (!v.flat) for (const s of this.signs) {
      if (!vis(s.x, s.y)) continue;
      ctx.fillStyle = '#7a6a54'; ctx.fillRect(s.x - 2, s.y, 4, 12);
      ctx.fillStyle = '#ffffff'; rr(ctx, s.x - 34, s.y - 20, 68, 22, 4); ctx.fill(); ctx.strokeStyle = '#ff7a1a'; ctx.lineWidth = 2.5; ctx.stroke();
      text(ctx, 'NO WAKE', s.x, s.y - 8, { size: 11, align: 'center', base: 'middle', color: '#1a1a1a', weight: 800 });
    }
    const L = this.light;
    if (vis(L.x, L.y, 120) && !v.flat) {
      ctx.fillStyle = 'rgba(0,0,0,0.22)'; ell(ctx, L.x + 14, L.y + 18, 48, 48); ctx.fill();
      ctx.strokeStyle = '#2b2b2b'; ctx.lineWidth = 3;
      for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; ctx.beginPath(); ctx.moveTo(L.x + Math.cos(a) * 14, L.y + Math.sin(a) * 14); ctx.lineTo(L.x + Math.cos(a) * 44, L.y + Math.sin(a) * 44); ctx.stroke(); }
      ctx.lineWidth = 2; ctx.beginPath(); for (let i = 0; i <= 8; i++) { const a = (i / 8) * TAU; ctx.lineTo(L.x + Math.cos(a) * 44, L.y + Math.sin(a) * 44); } ctx.stroke();
      ctx.beginPath(); for (let i = 0; i <= 8; i++) { const a = (i / 8) * TAU + 0.2; ctx.lineTo(L.x + Math.cos(a) * 28, L.y + Math.sin(a) * 28); } ctx.stroke();
      ctx.fillStyle = '#f2f0ea'; ell(ctx, L.x, L.y, 14, 14); ctx.fill(); ctx.fillStyle = '#2b2b2b'; ell(ctx, L.x, L.y, 8, 8); ctx.fill();
      ctx.fillStyle = `rgba(255,244,170,${0.4 + 0.6 * Math.max(0, Math.sin(t * 3))})`; ell(ctx, L.x, L.y, 5, 5); ctx.fill();
      if (v.z > 0.4) text(ctx, 'Alligator Light', L.x, L.y + 66, { size: 15, align: 'center', color: '#fff', weight: 800, stroke: 'rgba(0,0,0,0.55)', sw: 4 });
    }
    if (!v.flat) for (const b of this.wreckBuoys) { if (!vis(b.x, b.y)) continue; ctx.fillStyle = 'rgba(0,0,0,0.2)'; ell(ctx, b.x + 3, b.y + 4, 8, 8); ctx.fill(); ctx.fillStyle = '#ffffff'; ell(ctx, b.x, b.y + Math.sin(t * 2 + b.x) * 1.4, 8, 8); ctx.fill(); ctx.fillStyle = '#2a5bd8'; ctx.fillRect(b.x - 8, b.y - 2, 16, 4); }
    for (const w of this.weed) {
      if (!vis(w.x, w.y, w.len + 40)) continue;
      ctx.save(); ctx.translate(w.x, w.y); ctx.rotate(w.ang);
      for (const [dx, dy, r] of w.blobs) { ctx.fillStyle = 'rgba(214,170,58,0.85)'; ell(ctx, dx, dy, r, r * 0.7); ctx.fill(); ctx.fillStyle = 'rgba(150,110,30,0.55)'; ell(ctx, dx + 2, dy + 1, r * 0.5, r * 0.35); ctx.fill(); }
      ctx.restore();
    }
  },
  // drawn after the boats so the boat runs under the bridges
  drawBridges(ctx, v, t) {
    for (const g of GAPS) {
      if (g.x1 < v.x0 - 80 || g.x0 > v.x1 + 80) continue;
      if (v.flat) {   // just the bridge's shadow on the water; the chase camera builds the bridge itself
        ctx.fillStyle = 'rgba(0,20,30,0.25)'; ctx.beginPath();
        for (let x = g.x0 - 20; x <= g.x1 + 20; x += 20) ctx.lineTo(x + 14, chainY(x) + 30);
        for (let x = g.x1 + 20; x >= g.x0 - 20; x -= 20) ctx.lineTo(x + 14, chainY(x) + 2); ctx.fill();
        continue;
      }
      for (const p of this.piers) if (p.g === g) { ctx.fillStyle = 'rgba(0,20,30,0.3)'; ctx.fillRect(p.x - 5, p.y - 20, 16, 48); ctx.fillStyle = '#8d877a'; ctx.fillRect(p.x - 7, p.y - 26, 14, 52); }
      ctx.fillStyle = 'rgba(0,20,30,0.22)'; ctx.beginPath();
      for (let x = g.x0 - 20; x <= g.x1 + 20; x += 20) ctx.lineTo(x + 8, chainY(x) + 22);
      for (let x = g.x1 + 20; x >= g.x0 - 20; x -= 20) ctx.lineTo(x + 8, chainY(x) - 4); ctx.fill();
      ctx.fillStyle = '#c9c4b8'; ctx.beginPath();
      for (let x = g.x0 - 20; x <= g.x1 + 20; x += 20) ctx.lineTo(x, chainY(x) - 15);
      for (let x = g.x1 + 20; x >= g.x0 - 20; x -= 20) ctx.lineTo(x, chainY(x) + 15); ctx.fill();
      ctx.fillStyle = '#7d7a72'; ctx.beginPath();
      for (let x = g.x0 - 20; x <= g.x1 + 20; x += 20) ctx.lineTo(x, chainY(x) - 11);
      for (let x = g.x1 + 20; x >= g.x0 - 20; x -= 20) ctx.lineTo(x, chainY(x) + 11); ctx.fill();
      ctx.strokeStyle = '#f2d23c'; ctx.lineWidth = 1.5; ctx.setLineDash([12, 12]); ctx.beginPath(); for (let x = g.x0 - 20; x <= g.x1 + 20; x += 20) ctx.lineTo(x, chainY(x)); ctx.stroke(); ctx.setLineDash([]);
      // the navigation span: green lights each side
      for (const s of [-1, 1]) { ctx.fillStyle = `rgba(80,255,140,${0.6 + 0.4 * Math.sin(t * 4)})`; ell(ctx, g.x + s * 86, g.y - 20, 4, 4); ctx.fill(); ell(ctx, g.x + s * 86, g.y + 20, 4, 4); ctx.fill(); }
      if (v.z > 0.45) text(ctx, g.name, g.x, g.y - 34, { size: 15, align: 'center', color: '#fff', weight: 800, stroke: 'rgba(0,0,0,0.55)', sw: 4 });
    }
    for (const c of this.cars) {
      if (c.x < v.x0 - 30 || c.x > v.x1 + 30) continue; const y = chainY(c.x) + (c.dir > 0 ? 5 : -5); if (y < v.y0 - 30 || y > v.y1 + 30) continue;
      ctx.fillStyle = c.c; rr(ctx, c.x - 11, y - 5, 22, 10, 3); ctx.fill(); ctx.fillStyle = 'rgba(30,50,70,0.65)'; ctx.fillRect(c.x + (c.dir > 0 ? 2 : -9), y - 4, 7, 8);
    }
  }
};
const RUN_WATER_CANAL = '#2f8f8a';
