'use strict';
/* Keys Crew — bottom fishing. Two spots run on this scene.
   The Ledge (variant 'ledge'): a reef terrace that drops off into 95 feet, coral heads out on the sand
   and a second, lower ledge further out. Eagle Wreck (variant 'wreck'): a freighter broken in two and
   lying over on its side in 110 feet, with a debris field off the bow.
   The boat anchors over a long strip of bottom. Fish are few and hold on structure, and it's dark down
   there: you see them on the fish finder, and in the glow of the deep-drop light on your line.
   Read the marks, move the boat onto them, drop the bait to their depth, sit through the nibbles and
   set the hook on the real bite. */

const BOT = {
  SURF: 146,          // screen y of the surface
  STRIP: 3400,        // world width of the bottom you can fish (px)
  XMIN: 300, XMAX: 3120,  // how far the boat can go along it
  FLOOR: 468,        // screen y of the sand at the spot's base depth
  PING: 1 / 10, COLS: 160,  // fish finder: seconds per ping, columns of history on screen
  NOTICE: 130,        // how far sideways (px) a fish will come for a bait
  LEG: 240, SPEED: 190  // one tap of Move idles the boat this far, at up to this speed
};

/* How each fish lives on the bottom. len: drawn length (px) of an average one.
   z: feet off the bottom it holds (abs: feet below the surface). squid / pin: how badly it wants each bait.
   nt: how many feet above or below it will notice a bait. steal: chance each nibble cleans the hook. */
const BOT_SP = {
  whitegrunt: { len: 30, z: [0.5, 7], squid: 1, pin: 0.12, nt: 9 },
  lane: { len: 31, z: [1, 10], squid: 1, pin: 0.25, nt: 9 },
  yellowtail: { len: 36, z: [34, 62], abs: true, squid: 1, pin: 0.1, nt: 12 },
  mangrove: { len: 40, z: [1, 12], squid: 0.75, pin: 0.7, nt: 10 },
  mutton: { len: 52, z: [0.5, 6], squid: 0.7, pin: 0.8, nt: 10 },
  hogfish: { len: 46, z: [0.3, 3], squid: 1, pin: 0.05, nt: 7 },
  trigger: { len: 36, z: [0.5, 9], squid: 1, pin: 0.1, nt: 9, steal: 0.25 },
  redgrouper: { len: 56, z: [0.3, 5], squid: 0.35, pin: 1, nt: 9 },
  blackgrouper: { len: 70, z: [0.5, 8], squid: 0.15, pin: 1, nt: 10 },
  amberjack: { len: 76, z: [14, 36], squid: 0.06, pin: 1, nt: 16 },
  cobia: { len: 78, z: [10, 34], squid: 0.3, pin: 1, nt: 16 },
  pompano: { len: 58, z: [10, 30], squid: 0.15, pin: 1, nt: 14 },
  cubera: { len: 84, z: [0.5, 10], squid: 0.1, pin: 1, nt: 11 },
  goliath: { len: 150, z: [0.3, 5], squid: 0, pin: 1, nt: 10 },
  barracuda: { len: 72, z: [24, 56], abs: true, squid: 0, pin: 0.8, nt: 18 }
};

/* Where the fish live along the strip. Each structure holds a few fish (cap) and slowly refills
   (re: seconds between arrivals). Everything in between is quiet water. */
const BOT_LAYOUT = {
  ledge: {
    base: 96, range: 110, amb: 48, track: [68, 100], fog: [0.14, 0.36, 0.5], bite: 1,
    spots: [
      { name: 'Reef terrace', x: 540, r: 170, cap: 3, re: [22, 34], sp: { whitegrunt: 4, lane: 3, yellowtail: 2.6, hogfish: 1.4, trigger: 1.2, mangrove: 1 } },
      { name: 'Ledge pockets', x: 1090, r: 125, cap: 3, re: [24, 38], sp: { redgrouper: 2.4, blackgrouper: 1, mutton: 1.4, mangrove: 1.8, goliath: 0.28, amberjack: 0.6 } },
      { name: 'Coral heads', x: 1950, r: 130, cap: 3, re: [22, 36], sp: { mangrove: 1.8, mutton: 1.4, hogfish: 1.6, trigger: 1.4, whitegrunt: 1.4, lane: 1, amberjack: 0.8 } },
      { name: 'Back ledge', x: 2735, r: 135, cap: 3, re: [24, 38], sp: { redgrouper: 2, blackgrouper: 0.9, whitegrunt: 2, lane: 1.5, trigger: 1, mutton: 1, goliath: 0.18 } },
      { name: 'Rubble patch', x: 3110, r: 110, cap: 1, re: [30, 48], sp: { lane: 2, whitegrunt: 1.2, mutton: 1, hogfish: 1 } }
    ],
    roam: { amberjack: 1, yellowtail: 1 },
    schools: [{ x: 520, ft: 58, w: 80, h: 8, n: 30 }, { x: 1975, ft: 72, w: 60, h: 6, n: 22 }, { x: 1530, ft: 60, w: 70, h: 7, n: 24 }]
  },
  wreck: {
    base: 110, range: 125, amb: 44, track: [56, 114], fog: [0.2, 0.46, 0.62], bite: 1.3,   // wreck fish are fewer but hungrier
    spots: [
      { name: 'Debris field', x: 930, r: 190, cap: 2, re: [26, 40], sp: { mutton: 2, blackgrouper: 1, cubera: 0.25, barracuda: 0.5 } },
      { name: 'The bow', x: 1480, r: 140, cap: 3, re: [22, 34], sp: { amberjack: 3, cobia: 1.1, barracuda: 0.9, pompano: 0.7 } },
      { name: 'Midships break', x: 1905, r: 110, cap: 2, re: [30, 46], sp: { goliath: 0.8, blackgrouper: 1.4, cubera: 0.4, mutton: 0.9 } },
      { name: 'The stern', x: 2260, r: 150, cap: 3, re: [22, 34], sp: { amberjack: 2.4, pompano: 1.4, cubera: 0.25, blackgrouper: 0.9, cobia: 0.7 } },
      { name: 'Sand edge', x: 2930, r: 150, cap: 1, re: [30, 50], sp: { cobia: 1, mutton: 1.4, barracuda: 0.8 } }
    ],
    roam: { amberjack: 1, cobia: 0.8, barracuda: 1 },
    schools: [{ x: 1480, ft: 64, w: 80, h: 9, n: 34 }, { x: 2270, ft: 56, w: 90, h: 9, n: 34 }, { x: 3010, ft: 74, w: 60, h: 6, n: 20 }]
  }
};

/* The freighter, in (world x, feet) coordinates: bow half, stern half, and the wheelhouse rolled over on top. */
const BOT_WK = {
  x0: 1380, x1: 2500,
  bow: [[1400, 79.6], [1640, 80.8], [1880, 82.4], [1885, 85], [1877, 88.5], [1889, 92], [1880, 96.5], [1888, 101], [1882, 113], [1468, 113], [1453, 105], [1435, 96], [1416, 87]],
  stern: [[1938, 84.8], [1946, 83.4], [2200, 83.2], [2352, 83.6], [2372, 86.5], [2385, 92.5], [2388, 100], [2380, 113], [1940, 113], [1947, 104], [1934, 98], [1942, 92], [1933, 88]],
  sup: { x: 2236, ft: 84.2, w: 128, h: 16.5, a: 0.2 }
};

/* ---------- small helpers (kept local to this file) ---------- */
function btSmooth(a, b, x) { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
// colors fade toward deep blue the further down they sit
function btTint(hex, ft, to = '#0d3a52') { return mix(hex, to, clamp(0.16 + ft / 250, 0, 0.62)); }
function btShade(hex, k) { return '#' + hexRgb(hex).map((v) => Math.round(v * (1 - k)).toString(16).padStart(2, '0')).join(''); }
// the highest (smallest feet) point of a polygon's outline at x
function btPolyTop(poly, x) {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length], lo = Math.min(p[0], q[0]), hi = Math.max(p[0], q[0]);
    if (x < lo || x > hi || hi === lo) continue;
    const ft = lerp(p[1], q[1], (x - p[0]) / (q[0] - p[0])); if (ft < best) best = ft;
  }
  return best;
}
function btFan(ctx, x, y, s, col, t) {  // sea fan
  ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 0.8 + x * 0.013) * 0.06);
  ctx.save(); ctx.globalAlpha *= 0.42; ctx.fillStyle = col;
  ctx.beginPath(); ctx.moveTo(-s * 0.06, 0); ctx.bezierCurveTo(-s * 0.9, -s * 0.5, -s * 0.62, -s * 1.15, 0, -s * 1.12); ctx.bezierCurveTo(s * 0.62, -s * 1.15, s * 0.9, -s * 0.5, s * 0.06, 0); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = col; ctx.lineCap = 'round';
  for (let i = -3; i <= 3; i++) { ctx.lineWidth = Math.max(0.8, s * (i === 0 ? 0.07 : 0.035)); ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(i * s * 0.1, -s * 0.5, i * s * 0.2, -s * (1.08 - Math.abs(i) * 0.07)); ctx.stroke(); }
  ctx.lineWidth = Math.max(0.6, s * 0.025); for (let k = 1; k <= 3; k++) { ctx.beginPath(); ctx.ellipse(0, 0, s * 0.2 * k, s * 0.36 * k, 0, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); }
  ctx.restore();
}
function btWhip(ctx, x, y, s, col, t) {  // sea whips and sea rods
  ctx.save(); ctx.strokeStyle = col; ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const a = (i - 1.5) * 0.24, sw = Math.sin(t * 1.1 + i + x * 0.02) * s * 0.12;
    ctx.lineWidth = Math.max(1, s * 0.05); ctx.beginPath(); ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.sin(a) * s * 0.5 + sw * 0.5, y - s * 0.55, x + Math.sin(a) * s * 0.8 + sw, y - s * (0.95 + (i % 2) * 0.22)); ctx.stroke();
  }
  ctx.restore();
}
function btBarrel(ctx, x, y, s, col) {  // barrel sponge
  ctx.save(); ctx.fillStyle = col; ctx.beginPath();
  ctx.moveTo(x - s * 0.34, y); ctx.quadraticCurveTo(x - s * 0.64, y - s * 0.6, x - s * 0.5, y - s); ctx.lineTo(x + s * 0.5, y - s); ctx.quadraticCurveTo(x + s * 0.64, y - s * 0.6, x + s * 0.34, y); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1; for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x - s * 0.5 + i * s * 0.25, y - s * 0.96); ctx.lineTo(x - s * 0.34 + i * s * 0.17, y); ctx.stroke(); }
  ctx.fillStyle = 'rgba(5,12,14,0.6)'; ell(ctx, x, y - s, s * 0.5, s * 0.12); ctx.fill();
  ctx.restore();
}
function btTubes(ctx, x, y, s, col) {  // tube and vase sponges
  ctx.save();
  for (let i = 0; i < 3; i++) {
    const ox = (i - 1) * s * 0.32, hh = s * (0.7 + ((i * 37 + Math.round(x)) % 5) * 0.12), lw = s * 0.22, lean = (i - 1) * 0.14;
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x + ox - lw / 2, y); ctx.lineTo(x + ox - lw * 0.6 + lean * hh, y - hh); ctx.lineTo(x + ox + lw * 0.6 + lean * hh, y - hh); ctx.lineTo(x + ox + lw / 2, y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(5,12,14,0.5)'; ell(ctx, x + ox + lean * hh, y - hh, lw * 0.6, lw * 0.22); ctx.fill();
  }
  ctx.restore();
}
function btEncrust(ctx, x, y, s, col) { ctx.fillStyle = col; for (let i = 0; i < 4; i++) { ell(ctx, x + (i - 1.5) * s * 0.35, y - s * 0.1 * (1 + (i % 2)), s * 0.26, s * 0.16 * (1 + (i % 2) * 0.5)); ctx.fill(); } }
function btDome(ctx, b, x, y, ry) {  // brain coral, star coral or a lump of rubble
  const rx = b.r;
  ctx.save();
  const g = ctx.createLinearGradient(0, y - ry, 0, y); g.addColorStop(0, b.c1); g.addColorStop(1, b.c2);
  ctx.fillStyle = g; ctx.beginPath();
  if (b.k === 'rock') { ctx.moveTo(x - rx, y + 3); ctx.quadraticCurveTo(x - rx * 0.9, y - ry * 0.9, x - rx * 0.2, y - ry); ctx.quadraticCurveTo(x + rx * 0.7, y - ry * 1.05, x + rx, y + 3); }
  else ctx.ellipse(x, y + 3, rx, ry + 3, 0, Math.PI, 0);
  ctx.closePath(); ctx.fill();
  if (b.k === 'brain') {
    ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 1.1;
    for (let i = 1; i <= 3; i++) { ctx.beginPath(); for (let a = Math.PI; a <= TAU + 0.001; a += 0.16) { const k = i / 4 + Math.sin(a * 9 + i * 2) * 0.035, px = x + Math.cos(a) * rx * k, py = y + 3 + Math.sin(a) * (ry + 3) * k; a === Math.PI ? ctx.moveTo(px, py) : ctx.lineTo(px, py); } ctx.stroke(); }
  } else if (b.k === 'star') {
    ctx.fillStyle = 'rgba(255,255,230,0.16)'; const n = Math.round(rx / 3.2);
    for (let i = 0; i < n; i++) { const a = Math.PI + (i + 0.5) / n * Math.PI, k = 0.35 + ((i * 7) % 5) * 0.12; ell(ctx, x + Math.cos(a) * rx * k, y + Math.sin(a) * ry * k, 1.6, 1.3); ctx.fill(); }
  }
  ctx.fillStyle = 'rgba(255,255,255,0.08)'; ell(ctx, x - rx * 0.25, y - ry * 0.6, rx * 0.4, Math.max(1, ry * 0.18)); ctx.fill();
  ctx.restore();
}

class BottomScene extends SessionBase {
  constructor(o) {
    super(o);
    const spot = SPOTS[this.spot] || SPOTS.bottom;
    this.variant = spot.variant === 'wreck' ? 'wreck' : 'ledge';
    this.L = BOT_LAYOUT[this.variant];
    this.ppf = (BOT.FLOOR - BOT.SURF) / this.L.base;   // the logical canvas is always 540 tall
    const list = (spot.species || []).filter((k) => BOT_SP[k] && SPECIES[k]);
    this.species = list.length ? list : Object.keys(BOT_SP).filter((k) => SPECIES[k]);
    this.baitType = this.variant === 'wreck' ? 'pinfish' : 'squid';
    this.baitOn = true; this.baitDepth = 0; this.targetDepth = this.variant === 'wreck' ? 78 : 62; this.rebaitT = 0; this.reeling = false; this.settled = false;
    this.fish = []; this.chumT = 0; this.chumCd = 0; this.slickQ = []; this.slickT = 0; this.chum = new Particles(); this.wake = new Particles();
    this.drag = null; this.twitch = 0; this.slam = 0; this.move = null; this.moveV = 0; this.engOn = false; this.swingK = 1;
    this.alarmT = 0; this.beepT = 0; this.quietT = 0; this.sonar = []; this.pingT = 0; this.sonarRect = null;
    this.track = new Array(Math.ceil(BOT.STRIP / 25) + 2).fill(null); this.wps = []; this.hookX = 0;
    this.others = (Trip.cur && Trip.cur.crew ? Trip.cur.crew : CHAR_ORDER).filter((c) => c !== this.ch).slice(0, 2);
    this.buildBottom();
    // the structure along the strip: only species this spot holds, a few fish on each
    this.hot = [];
    for (const h of this.L.spots) {
      const table = Object.entries(h.sp).filter(([k]) => this.species.includes(k));
      if (table.length) this.hot.push({ name: h.name, x: h.x, r: h.r, re: h.re, cap: clamp(h.cap + randi(-1, 1), 1, 4), table, timer: rand(h.re[0], h.re[1]) * 0.6 });
    }
    // anything the spot lists that no structure holds wanders through now and then
    const held = new Set(); for (const h of this.hot) for (const [k] of h.table) held.add(k);
    this.roamTable = Object.entries(this.L.roam).filter(([k]) => this.species.includes(k));
    for (const k of this.species) if (!held.has(k) && !this.roamTable.some(([r]) => r === k)) this.roamTable.push([k, 0.5]);
    this.roamT = rand(14, 26);
    this.schools = this.L.schools.map((s) => Object.assign({}, s, { ph: rand(0, 10), pts: Array.from({ length: s.n }, () => [rand(-1, 1), rand(-1, 1), rand(0.5, 1.4), rand(0, TAU)]) }));
    // anchor up in quiet water, a move or two from some structure: finding the fish is up to you
    const gap = (x) => this.hot.reduce((a, h) => Math.min(a, Math.abs(x - h.x) - h.r), 1e9);
    const quiet = []; for (let x = BOT.XMIN; x <= BOT.XMAX; x += 10) { const g = gap(x); if (g >= 110 && g <= 280) quiet.push(x); }
    this.bx = quiet.length ? pick(quiet) : 1600;
    this.cam = this.bx - this.baitSX();
    this.initSnow();
    for (const h of this.hot) { const n = randi(h.cap > 1 ? 1 : 0, h.cap); for (let i = 0; i < n; i++) this.spawnFish(h, false); }
    // let the bottom live for a few seconds first, so the fish finder has history on screen
    for (let i = 0; i < BOT.COLS; i++) { this.stepFish(BOT.PING, false); this.ping(); }
  }
  enter() {
    SFX.setAmbient(0.8, false); Music.play('boat');
    Game.toast(SPOTS[this.spot] ? SPOTS[this.spot].name : 'The Ledge', { color: PAL.coral, size: 46, y: 200, sub: 'Read the fish finder. Move the boat to find the marks.' });
  }
  exit() { SFX.setAmbient(0); this.engine(0); }

  /* ---------- layout ---------- */
  colW() { return clamp(Math.round(Game.W * 0.3), 236, 336); }
  colX() { return Game.W - this.colW() - 12; }
  sceneW() { return this.colX() - 6; }
  baitSX() { return this.sceneW() * 0.54; }          // where the line hangs on screen
  yOf(ft) { return BOT.SURF + ft * this.ppf; }
  ftOf(y) { return (y - BOT.SURF) / this.ppf; }
  pxPerFt() { return this.ppf; }
  // the boat swings slowly on its anchor line, which sweeps the fish finder's cone back and forth
  swing() { return Math.sin(this.t * 0.42) * (14 + 16 * this.weather.drift) * this.swingK; }
  baitX() { return this.bx + this.swing() + Math.sin(this.t * 0.9) * 3 + this.weather.drift * 8; }
  maxDepth() { return this.bottomFt(this.baitX()) - 0.8; }
  ambient(ft) { return clamp((1.25 - ft / this.L.amb) * (this.weather.vis || 1), 0, 1); }

  /* ---------- the bottom ---------- */
  sandFt(x) { return this.L.base + Math.sin(x * 0.013) * 0.8 + Math.sin(x * 0.0041 + 2) * 0.7; }
  rockFt(x) {
    const sand = this.sandFt(x);
    if (this.variant === 'wreck') return sand;
    if (x < 1112) { const ter = 78.5 + Math.sin(x * 0.011) * 2.2 + Math.sin(x * 0.029 + 1) * 1.2; return lerp(ter, sand, btSmooth(1074, 1102, x)); }
    if (x > 1800 && x < 2100) { const u = (x - 1950) / 140; return sand - 9 * Math.pow(Math.max(0, 1 - u * u), 0.75); }
    if (x > 2675 && x < 3210) { const top = 88.6 + Math.sin(x * 0.02) * 1.1; return lerp(sand, top, btSmooth(2686, 2704, x) * (1 - btSmooth(3070, 3205, x))); }
    return sand;
  }
  bottomFt(x) {
    let ft = this.rockFt(x);
    if (this.wTop) { const i = Math.round((x - BOT_WK.x0) / 4); if (i >= 0 && i < this.wTop.length && this.wTop[i] < ft) ft = this.wTop[i]; }
    for (const b of this.bumps) {
      if (b.x - 60 > x) break;
      if (x < b.x - b.r || x > b.x + b.r) continue;
      const u = (x - b.x) / b.r, f = b.base - b.h * Math.sqrt(1 - u * u); if (f < ft) ft = f;
    }
    return ft;
  }
  hardAt(x) { return this.sandFt(x) - this.bottomFt(x) > 0.8 ? 1 : 0.4; }
  buildBottom() {
    const R = mulberry(hashStr('bottom:' + this.variant)), rn = (a, b) => a + (b - a) * R(), pk = (arr) => arr[Math.floor(R() * arr.length)];
    const bumps = []; this.decor = []; this.wTop = null;
    const bump = (x, r, h, k) => bumps.push({ x, r, h, k });
    if (this.variant === 'ledge') {
      for (const b of [[468, 30, 5, 'brain'], [548, 38, 6.5, 'star'], [618, 24, 4, 'brain'], [1888, 30, 4.5, 'star'], [1948, 44, 6.5, 'brain'], [2004, 30, 5, 'star'], [2046, 18, 2.4, 'rock'], [1856, 18, 2.2, 'rock'],
        [2760, 24, 3.5, 'brain'], [2905, 20, 3, 'star'], [3088, 16, 2.6, 'rock'], [3118, 22, 3.4, 'star'], [3150, 14, 2, 'rock']]) bump(...b);
      for (let x = -260; x < 1030; x += rn(70, 130)) if (Math.abs(x - 545) > 120 && R() < 0.75) bump(x, rn(14, 28), rn(1.5, 3.5), pk(['brain', 'star', 'rock']));
      for (let x = 2790; x < 3060; x += rn(60, 110)) if (R() < 0.6) bump(x, rn(12, 22), rn(1.2, 2.8), pk(['brain', 'star', 'rock']));
      for (let x = 1120; x < 3800; x += rn(110, 240)) if (this.rockFt(x) > this.sandFt(x) - 0.5 && R() < 0.55) bump(x, rn(7, 15), rn(0.5, 1.3), 'rock');
    } else {
      // the debris field off the bow: plates, a winch, an anchor, pipe; a funnel lying off the stern
      for (const b of [[780, 22, 2.2, 'anchor'], [1010, 18, 5, 'winch'], [1180, 30, 4, 'pipe'], [2452, 32, 6.5, 'funnel'], [2920, 26, 3.4, 'plate'], [2948, 14, 2, 'rock']]) bump(...b);
      for (let x = 620; x < 1270; x += rn(36, 80)) if (R() < 0.8) bump(x, rn(14, 30), rn(1.6, 4.4), R() < 0.7 ? 'plate' : 'rock');
      for (let x = -200; x < 3800; x += rn(140, 280)) if (R() < 0.45 && (x < 560 || x > 2520) && Math.abs(x - 2930) > 60) bump(x, rn(7, 14), rn(0.5, 1.2), 'rock');
      this.buildWreck();
    }
    bumps.sort((a, b) => a.x - b.x); this.bumps = [];
    for (const b of bumps) {
      b.base = this.rockFt(b.x); b.seed = R();
      const base = b.k === 'brain' ? pk(['#b39a5c', '#a88f5a', '#9c9a62']) : b.k === 'star' ? pk(['#8f8d4e', '#9a7a52', '#7f8f5a']) : b.k === 'rock' ? pk(['#6a6658', '#5e5c50']) : pk(['#6b5444', '#5c5048', '#4f4a44']);
      b.c1 = btTint(base, b.base - b.h); b.c2 = btTint(btShade(base, 0.35), b.base);
      this.bumps.push(b);
    }
    // texture blobs inside the rock (ledge) and growth along the tops
    this.blobs = [];
    if (this.variant === 'ledge') for (let x = -300; x < 3250; x += rn(10, 22)) { if (this.sandFt(x) - this.rockFt(x) < 1.5) continue; this.blobs.push({ x, d: rn(6, 90), rx: rn(5, 15), ry: rn(3, 8), c: pk(['rgba(0,0,0,0.16)', 'rgba(0,0,0,0.1)', 'rgba(255,240,200,0.06)', 'rgba(120,80,120,0.12)']) }); }
    const C = {
      fan: ['#8d5aa8', '#a0507a', '#c27a3a', '#7c4fa0'], whip: ['#c9a24a', '#a8885a', '#8a5aa2', '#b46a3a'], barrel: ['#8a5a3c', '#7a4a3a', '#946446'],
      tubes: ['#b0549a', '#d07a3a', '#7a6ab0', '#c4a03a'], encrust: ['#d0603a', '#c8a03a', '#9a4a8a', '#5a9a7a', '#c84a4a']
    };
    for (let x = -340; x < 3760; x += rn(26, 64)) {
      const ft = this.bottomFt(x), onRock = this.sandFt(x) - ft > 0.8, hull = this.wTop && x > 1395 && x < 2392 && ft < 100;
      let type = null;
      if (hull) { const r = R(); type = r < 0.42 ? 'encrust' : r < 0.64 ? 'fan' : r < 0.84 ? 'whip' : 'tubes'; }
      else if (onRock) { const r = R(); type = r < 0.22 ? 'fan' : r < 0.46 ? 'whip' : r < 0.58 ? 'barrel' : r < 0.7 ? 'tubes' : r < 0.9 ? 'encrust' : null; }
      else if (R() < 0.22) type = pk(['whip', 'encrust', 'tubes', 'whip']);
      if (!type) continue;
      const s = type === 'fan' ? rn(12, 24) : type === 'whip' ? rn(12, 26) : type === 'barrel' ? rn(10, 18) : type === 'tubes' ? rn(9, 16) : rn(6, 11);
      this.decor.push({ x, ft, type, s: onRock || hull ? s : s * 0.7, c: btTint(pk(C[type]), ft) });
    }
  }
  buildWreck() {
    const W = BOT_WK, ppf = this.ppf, s = W.sup;
    // wheelhouse: a box rolled over on the stern deck
    const hp = s.h * ppf, ca = Math.cos(s.a), sa = Math.sin(s.a);
    const corner = (dx, dy) => [s.x + dx * ca - dy * sa, s.ft + (dx * sa + dy * ca) / ppf];
    this.supPoly = [corner(-s.w / 2, 8), corner(s.w / 2, 8), corner(s.w / 2, -hp), corner(-s.w / 2, -hp)];
    const n = Math.ceil((W.x1 - W.x0) / 4) + 1; this.wTop = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = W.x0 + i * 4;
      let ft = Math.min(btPolyTop(W.bow, x), btPolyTop(W.stern, x), btPolyTop(this.supPoly, x));
      if (x > 1884 && x < 1936) ft = Math.min(ft, 93.5 + 2.5 * Math.abs(Math.sin((x - 1884) * 0.25)));   // ribs at the break
      this.wTop[i] = ft;
    }
  }

  /* ---------- fish ---------- */
  rollKey(table) {
    let tot = 0; for (const [, w] of table) tot += w;
    let r = Math.random() * tot; for (const [k, w] of table) { if ((r -= w) <= 0) return k; }
    return table[0][0];
  }
  spawnFish(h, enter, key, o = {}) {
    key = key || this.rollKey(h ? h.table : this.roamTable);
    const sp = BOT_SP[key], w = rollWeight(key, this.perks);
    const len = sp.len * (0.78 + 0.5 * sizeNorm(key, w));
    const cx = h ? h.x : o.x;
    let x = h ? cx + rand(-h.r, h.r) : o.x;
    if (enter && h) x = cx + (chance(0.5) ? -1 : 1) * h.r * rand(1.3, 1.8);
    const f = { key, w, len, hs: h, x, y: 0, tx: x, ty: 0, face: chance(0.5) ? 1 : -1, spd: (sp.abs || sp.z[0] > 8 ? rand(20, 32) : rand(12, 24)), state: 'swim', t: rand(0, 5), nib: 0, timer: 0, wait: 0, alpha: enter ? 0 : 1, roam: o.roam || 0, slick: !!o.slick, inCone: false };
    this.pickTarget(f); f.y = f.ty;
    if (o.ft != null) f.y = this.yOf(o.ft);
    this.fish.push(f); return f;
  }
  pickTarget(f) {
    const sp = BOT_SP[f.key];
    if (f.roam) f.tx = f.x + f.roam * rand(180, 340);
    else { const h = f.hs; f.tx = h.x + rand(-h.r, h.r); }
    const bot = this.bottomFt(f.tx);
    let ft;
    if (f.slick) ft = f.key === 'yellowtail' ? rand(14, 38) : rand(36, 60);
    else if (sp.abs) ft = rand(sp.z[0], sp.z[1]);
    else ft = bot - rand(sp.z[0], sp.z[1]);
    f.ty = this.yOf(clamp(ft, 6, bot - 0.4)); f.wait = rand(0.4, 2.6);
  }
  activeFish() { return this.fish.find((f) => f.state === 'approach' || f.state === 'nibble' || f.state === 'bite'); }
  spook(f) { f.state = 'leave'; f.face = f.x >= this.baitX() ? 1 : -1; }
  stepFish(dt, live) {
    // arrivals: each structure slowly refills, and the odd fish cruises through the quiet water
    for (const h of this.hot) {
      let n = 0; for (const f of this.fish) if (f.hs === h && f.state !== 'leave') n++;
      if (n < h.cap) { h.timer -= dt; if (h.timer <= 0) { this.spawnFish(h, true); h.timer = rand(h.re[0], h.re[1]); } }
    }
    this.roamT -= dt;
    if (this.roamT <= 0) {
      this.roamT = rand(24, 40);
      if (this.roamTable.length && !this.fish.some((f) => f.roam)) { const dir = chance(0.5) ? 1 : -1; this.spawnFish(null, true, null, { x: dir > 0 ? -150 : BOT.STRIP + 150, roam: dir }); }
    }
    for (const q of this.slickQ) { q.t -= dt; if (q.t <= 0) { q.done = true; this.spawnFish({ x: this.bx + 30, r: 90, table: [[q.key, 1]] }, true, q.key, { slick: true }); } }
    this.slickQ = this.slickQ.filter((q) => !q.done);
    if (this.slickT > 0) { this.slickT -= dt; if (this.slickT <= 0) for (const f of this.fish) if (f.slick && f.state === 'swim') this.spook(f); }
    const bx = this.baitX(), by = this.yOf(this.baitDepth), bft = this.baitDepth;
    let taken = !!this.activeFish();
    const canBite = live && this.baitOn && !this.reeling && !this.move && this.baitDepth > 3;
    for (const f of this.fish) {
      f.t += dt;
      const sp = BOT_SP[f.key];
      if (f.state === 'swim') {
        f.alpha = Math.min(1, f.alpha + dt * 0.8);
        this.wander(f, dt);
        if (canBite && !taken && f.alpha > 0.6 && Math.abs(f.x - bx) < BOT.NOTICE) {
          const dft = Math.abs(this.ftOf(f.y) - bft);
          if (dft < sp.nt) {
            const pref = this.baitType === 'squid' ? sp.squid : sp.pin;
            const acc = 1 - 0.65 * (dft / sp.nt) * (dft / sp.nt);
            const k = pref * acc * 0.5 * this.L.bite * this.perks.bite * (this.settled ? 1 : 0.4) * (this.chumT > 0 ? 1.35 : 1);
            if (chance(k * dt)) { f.state = 'approach'; taken = true; }
          }
        }
      } else if (f.state === 'approach') {
        const ang = Math.atan2(by - f.y, bx - f.x), v = 55 + f.len * 0.2;
        f.x += Math.cos(ang) * v * dt; f.y += Math.sin(ang) * v * dt; if (Math.abs(Math.cos(ang)) > 0.2) f.face = Math.cos(ang) >= 0 ? 1 : -1;
        if (!this.baitOn || this.move || this.reeling) this.spook(f);
        else if (dist(f.x, f.y, bx, by) < 14) { f.state = 'nibble'; f.nib = SPECIES[f.key].crafty ? randi(2, 4) : randi(0, 2); f.timer = rand(0.45, 1.0) / this.perks.bite; }
      } else if ((f.state === 'nibble' || f.state === 'bite') && (!this.baitOn || this.move || this.reeling)) {
        this.spook(f);   // nothing left on the hook, or it's on its way up
      } else if (f.state === 'nibble') {
        f.x = approach(f.x, bx - f.face * f.len * 0.42, 6, dt); f.y = approach(f.y, by, 6, dt);
        f.timer -= dt;
        if (f.timer <= 0) {
          if (f.nib > 0) {
            f.nib--; f.timer = rand(0.5, 1.05) / this.perks.bite; this.twitch = 0.18; SFX.play('nibble');
            if (sp.steal && chance(sp.steal)) this.stealBait(f, false, 'Picked clean!');
          } else { f.state = 'bite'; f.timer = 0.6 * this.perks.window; this.slam = f.timer; SFX.play('bite'); Game.vibrate(70); Game.toast('BITE!', { color: PAL.sun, size: 52, y: 160, dur: 0.8 }); }
        }
      } else if (f.state === 'bite') {
        f.timer -= dt; f.x = approach(f.x, bx - f.face * f.len * 0.42, 6, dt); f.y = approach(f.y, by, 6, dt);
        if (f.timer <= 0) this.stealBait(f, false);
      } else if (f.state === 'leave') { f.x += f.face * 110 * dt; f.alpha -= dt * 0.45; }
    }
    this.fish = this.fish.filter((f) => f.alpha > 0 && f.x > -400 && f.x < BOT.STRIP + 400);
  }
  wander(f, dt) {
    const dx = f.tx - f.x, dy = f.ty - f.y, d = Math.hypot(dx, dy);
    if (d < 5) { f.wait -= dt; if (f.wait <= 0) this.pickTarget(f); }
    else { const v = f.spd * Math.min(1, d / 40 + 0.25); f.x += (dx / d) * v * dt; f.y += (dy / d) * v * 0.7 * dt; if (Math.abs(dx) > 3) f.face = dx > 0 ? 1 : -1; }
    const floor = this.yOf(this.bottomFt(f.x) - 0.4); if (f.y > floor) f.y = floor;
  }

  /* ---------- the fish finder ---------- */
  schoolX(s) { return s.x + Math.sin(this.t * 0.11 + s.ph) * 36; }
  speck(s, p) { const t = this.t, cx = this.schoolX(s); return [cx + p[0] * s.w * 0.55 + Math.sin(t * p[2] + p[3]) * s.w * 0.4, s.ft + p[1] * s.h * 0.5 + Math.cos(t * p[2] * 0.7 + p[3]) * s.h * 0.35]; }
  ping() {
    const cx = this.bx + this.swing();
    const bot = Math.min(this.bottomFt(cx - 8), this.bottomFt(cx), this.bottomFt(cx + 8));
    const col = { bot, hard: this.hardAt(cx), fish: [], cloud: [], noise: [], bait: -1, surf: [rand(0.5, 3.5), rand(0.5, 5)] };
    let alarm = false;
    for (const f of this.fish) {
      if (f.alpha < 0.2) { f.inCone = false; continue; }
      const ft = this.ftOf(f.y), cone = 26 + ft, u = (f.x - cx) / cone;
      if (Math.abs(u) > 1) { f.inCone = false; continue; }
      const e = u * u, str = clamp((f.len - 22) / 92, 0.08, 1);   // off to the side of the cone the echo comes back from further away: the classic arch
      if (!(str < 0.3 && chance(0.22 + e * 0.3))) col.fish.push([ft + e * 4.5 + rand(-0.3, 0.3), (0.9 + f.len / 30) * (1 - e * 0.5) * rand(0.8, 1.1), str * (1 - e * 0.35)]);
      if (!f.inCone) { f.inCone = true; alarm = true; }
    }
    for (const s of this.schools) {
      if (Math.abs(this.schoolX(s) - cx) > s.w + 140) continue;
      for (const p of s.pts) { const [px, pft] = this.speck(s, p), cone = 26 + pft, u = (px - cx) / cone; if (Math.abs(u) < 1 && col.cloud.length < 18 && chance(0.6)) col.cloud.push(pft + u * u * 2 + rand(-1.4, 1.4)); }
    }
    if (chance(0.35)) col.noise.push(rand(6, bot - 4));
    if (this.baitDepth > 1.5) col.bait = this.baitDepth;
    this.sonar.push(col); if (this.sonar.length > BOT.COLS) this.sonar.shift();
    const ti = Math.round(cx / 25); if (ti >= 0 && ti < this.track.length) this.track[ti] = bot;
    if (alarm && this.t > 1) { this.alarmT = 1.2; if (this.beepT <= 0) { SFX.tone(1760, 0.05, { vol: 0.025 }); SFX.tone(2100, 0.05, { vol: 0.02, delay: 0.07 }); this.beepT = 2.5; } }
  }
  // what a player reads off the right edge of the screen: marks under the boat now, strongest first
  sonarMarks(n = 12) {
    const out = [];
    for (const c of this.sonar.slice(-n)) for (const r of c.fish) out.push({ ft: r[0], s: r[2], th: r[1] });
    return out.sort((a, b) => b.s - a.s);
  }

  /* ---------- input ---------- */
  pointerDown(p) {
    if (this.basePointerDown(p)) return;
    if (this.hookset()) return;
    const r = this.sonarRect;
    if (r && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) { this.drag = { id: p.id, sonar: true }; this.setDepthFromY(p.y, true); }
    else if (p.x < this.colX() && p.y > BOT.SURF - 20) { this.drag = { id: p.id, sonar: false }; this.setDepthFromY(p.y, false); }
  }
  pointerMove(p) { if (this.drag && this.drag.id === p.id) this.setDepthFromY(p.y, this.drag.sonar); }
  pointerUp(p) { if (this.drag && this.drag.id === p.id) this.drag = null; }
  keyDown(c) {
    if (this.baseKeyDown(c)) return;
    if (c === 'Space' || c === 'Enter') this.hookset(true);
  }
  setDepthFromY(y, sonar) {
    const r = this.sonarRect;
    const ft = sonar && r ? ((y - r.y) / r.h) * r.range : this.ftOf(y);
    this.targetDepth = clamp(ft, 4, Math.max(4, this.maxDepth()));
  }
  hookset(fromKey) {
    const f = this.activeFish();
    if (!f || !this.baitOn) { if (fromKey) this.twitch = 0.2; return false; }
    if (f.state === 'bite') {
      this.fish = this.fish.filter((x) => x !== f);
      this.baitOn = false; this.slam = 0; this.drag = null;
      this.startFight({ sp: f.key, weight: f.w, ctxType: 'reef', depth: Math.max(25, this.baitDepth) });
      return true;
    }
    if (f.state === 'nibble') {
      Game.toast('Too early!', { color: PAL.warn, size: 34, y: 140, sub: 'Wait for the rod to slam down' }); SFX.play('fail');
      if (chance(0.65)) this.stealBait(f, true); else this.spook(f);
    }
    return true;
  }
  stealBait(f, quiet, msg) {
    this.baitOn = false; this.spook(f);
    if (!quiet) { Game.toast(msg || 'Bait stolen!', { color: PAL.warn, size: 32, y: 140, sub: 'Tap REBAIT and drop back down' }); SFX.play('fail'); }
  }
  rebait(type) {
    if (this.move) { if (type) this.baitType = type; this.baitOn = true; return; }   // rig a fresh one while you idle over
    if (this.rebaitT > 0 || this.reeling) { if (type) this.baitType = type; return; }
    if (type) this.baitType = type;
    const f = this.activeFish(); if (f) this.spook(f);
    this.baitOn = false; this.reeling = true;
  }
  dropChum() {
    if (this.chumCd > 0 || this.child) return;
    this.chumT = 12; this.chumCd = 30; this.slickT = 26; SFX.play('splash');
    const sp = this.species;
    if (sp.includes('yellowtail')) { this.slickQ.push({ key: 'yellowtail', t: rand(3, 6) }); if (chance(0.4)) this.slickQ.push({ key: 'yellowtail', t: rand(7, 10) }); }
    else { const up = ['amberjack', 'barracuda'].filter((k) => sp.includes(k)); if (up.length && chance(0.55)) this.slickQ.push({ key: pick(up), t: rand(4, 8) }); }
    Game.toast('Chum’s in the water', { size: 26, y: 140, color: '#fff', sub: sp.includes('yellowtail') ? 'Yellowtail come up into the slick' : 'Something big might come up for it' });
  }
  startFight(opts) { this.hookX = this.bx; this.engine(0); super.startFight(opts); }
  onFightDone(r) {
    for (const f of this.fish) if (f.state === 'approach' || f.state === 'nibble' || f.state === 'bite') this.spook(f);
    if (r && r.ok && r.catch) this.wps.push({ x: this.hookX, key: r.catch.key, big: sizeNorm(r.catch.key, r.catch.weight) > 0.5 || SPECIES[r.catch.key].rare });
    this.baitDepth = 0; this.reeling = false; this.rebaitT = 0.9; this.baitOn = false;
  }

  /* ---------- moving the boat ---------- */
  startMove(dir, fromHold) {
    if (this.child || this.paused || this.ended) return;
    const m = this.move;
    if (m) {
      if (m.hold) { m.hold = false; return; }   // letting go of a held Move button: the hold already did the moving
      if (m.dir === dir) { if (m.phase !== 'down') m.want = Math.min(m.want + BOT.LEG, 2000); }
      else if (m.phase === 'go') m.want = Math.min(m.want, m.done + 30);
      return;
    }
    if ((dir < 0 && this.bx <= BOT.XMIN + 2) || (dir > 0 && this.bx >= BOT.XMAX - 2)) return;
    const f = this.activeFish(); if (f) this.spook(f);
    this.move = { dir, phase: 'up', t: 0, done: 0, want: BOT.LEG, hold: !!fromHold, holdT: 0 };
    this.quietT = 0;
  }
  // a finger (or mouse button) held down on a Move button, or the key held down
  ptrHeld(dir) { const a = UI.active; return !!(a && a.inside && a.id === (dir < 0 ? 'moveL' : 'moveR') && Input.pointers.has(a.pointer)); }
  keyHeld(dir) { return Input.held(dir < 0 ? 'KeyA' : 'KeyD', dir < 0 ? 'ArrowLeft' : 'ArrowRight'); }
  engine(on, rpm = 0) { if (on) { SFX.setEngine(1, rpm); this.engOn = true; } else if (this.engOn) { SFX.setEngine(0); this.engOn = false; } }
  updateMove(dt) {
    const m = this.move;
    if (!m) {
      this.moveV = approach(this.moveV, 0, 6, dt); this.engine(0);
      if (this.ptrHeld(-1)) this.startMove(-1, true);   // start on press, so holding Move feels immediate
      else if (this.ptrHeld(1)) this.startMove(1, true);
      return;
    }
    m.t += dt;
    if (m.phase === 'up') {   // pull the anchor and reel the bait up
      this.engine(1, 0.12);
      if (m.t > 0.7 && this.baitDepth <= 0.5) { m.phase = 'go'; m.t = 0; }
    } else if (m.phase === 'go') {
      const ptr = this.ptrHeld(m.dir);
      if (ptr) { m.holdT += dt; if (m.holdT > 0.25) m.hold = true; }   // a long press steers; a quick tap adds another leg
      if (ptr || this.keyHeld(m.dir)) m.want = Math.max(m.want, m.done + 50);
      const left = m.want - m.done;
      this.moveV = approach(this.moveV, Math.min(BOT.SPEED, left * 3.2 + 30), 4, dt);
      const nx = clamp(this.bx + m.dir * Math.min(left, this.moveV * dt), BOT.XMIN, BOT.XMAX);
      const step = Math.abs(nx - this.bx); m.done += step; this.bx = nx;
      if (step < 1e-4 && left > 1) m.want = m.done;   // end of the strip
      this.engine(1, 0.22 + 0.4 * this.moveV / BOT.SPEED);
      if (chance(dt * 30)) this.wake.add({ kind: 'bubble', x: this.bx - 168 + 88 + rand(-8, 8), y: BOT.SURF + rand(8, 22), vx: -m.dir * rand(10, 40), vy: -rand(8, 26), life: rand(0.5, 1.1), size: rand(1.2, 3) });
      if (m.done >= m.want - 0.5) { m.phase = 'down'; m.t = 0; SFX.play('splash'); }
    } else if (m.t > 0.6) { this.move = null; this.engine(0); }
    else { this.moveV = approach(this.moveV, 0, 8, dt); this.engine(1, 0.08); }
  }

  /* ---------- update ---------- */
  update(dt) {
    if (this.baseUpdate(dt)) { this.engine(0); return; }
    this.chum.update(dt); this.wake.update(dt);
    this.twitch = Math.max(0, this.twitch - dt); this.slam = Math.max(0, this.slam - dt);
    this.alarmT = Math.max(0, this.alarmT - dt); this.beepT -= dt;
    if (this.chumT > 0) {
      this.chumT -= dt;
      if (chance(dt * 16)) this.chum.add({ x: this.bx - 20 + rand(-10, 10), y: BOT.SURF + 4, vx: rand(4, 18) + this.weather.drift * 10, vy: rand(10, 26), life: 7, size: rand(1.4, 3.2), color: 'rgba(205,175,125,0.6)', drag: 0.15 });
    }
    this.chumCd = Math.max(0, this.chumCd - dt);
    const maxD = Math.max(4, this.maxDepth());
    if (Input.held('ArrowUp', 'KeyW')) this.targetDepth = clamp(this.targetDepth - 40 * dt, 4, maxD);
    if (Input.held('ArrowDown', 'KeyS')) this.targetDepth = clamp(this.targetDepth + 40 * dt, 4, maxD);
    this.updateMove(dt);
    this.swingK = approach(this.swingK, this.move ? 0 : 1, 0.8, dt);
    // the bait: up while the boat moves, otherwise down to the depth you set (it rests on the bottom if you ask for more)
    const tgt = Math.min(this.targetDepth, maxD);
    if (this.move) this.baitDepth = Math.max(0, this.baitDepth - 140 * dt);
    else if (this.reeling) { this.baitDepth = Math.max(0, this.baitDepth - 85 * dt); if (this.baitDepth <= 0) { this.reeling = false; this.rebaitT = 0.9; SFX.play('click'); } }
    else if (this.rebaitT > 0) { this.rebaitT -= dt; if (this.rebaitT <= 0) { this.baitOn = true; SFX.play('plop'); } }
    else if (this.baitOn) { const dd = tgt - this.baitDepth; this.baitDepth += clamp(dd, -38 * dt, (dd > 0 ? 50 : 38) * dt); }
    this.settled = this.baitOn && !this.move && !this.reeling && Math.abs(tgt - this.baitDepth) < 1.5;
    this.stepFish(dt, true);
    this.pingT -= dt; while (this.pingT <= 0) { this.pingT += BOT.PING; this.ping(); }
    const marks = this.sonarMarks(20).length;
    this.quietT = this.move || marks ? 0 : this.quietT + dt;
    const cam0 = this.cam; this.cam = approach(this.cam, this.bx - this.baitSX(), 6, dt);
    this.updateSnow(dt, this.cam - cam0);
  }

  /* ---------- drawing ---------- */
  initSnow() { this.snow = []; for (let i = 0; i < 80; i++) this.snow.push({ x: rand(0, 1280), y: rand(BOT.SURF + 6, 540), z: rand(0.35, 1), s: rand(0.7, 1.7) }); }
  updateSnow(dt, dcam) {
    const W = Game.W;
    for (const p of this.snow) {
      p.x -= dcam * p.z + (this.weather.drift * 6 + 3) * p.z * dt; p.y += (2 + 4 * p.z) * dt;
      if (p.x < -10) p.x += W + 20; else if (p.x > W + 10) p.x -= W + 20;
      if (p.y > Game.H) { p.y = BOT.SURF + 6; p.x = rand(0, W); }
    }
  }
  draw(ctx) {
    if (this.drawChildOrNull(ctx)) return;
    const W = Game.W, H = Game.H, t = this.t, cam = this.cam;
    const bxw = this.baitX(), bsx = bxw - cam, by = this.yOf(this.baitDepth);
    this.drawSkyline(ctx, W, t, cam);
    this.drawWater(ctx, W, H, t, cam);
    ctx.save(); ctx.translate(-cam, 0);
    this.drawSchools(ctx, cam, W, bxw, by);
    this.drawBottom(ctx, cam, W, H, t);
    this.drawFishes(ctx, cam, W, bxw, by);
    this.chum.draw(ctx);
    ctx.restore();
    this.drawFog(ctx, W, H, bsx, by);
    this.drawSnow(ctx, bsx, by);
    ctx.save(); ctx.translate(-cam, 0); this.wake.draw(ctx); ctx.restore();
    this.drawRig(ctx, t, cam, bsx, by);
    this.parts.draw(ctx); this.fl.draw(ctx);
    this.drawHud(ctx, W, H);
    if (this.paused) this.drawPause(ctx);
  }
  drawSkyline(ctx, W, t, cam) {
    const S = BOT.SURF, sw = this.sceneW();
    drawSky(ctx, W, S, 'day');
    drawSun(ctx, sw * 0.66, 92, 15);
    const span = W + 300, c0 = -cam * 0.04 + t * 2.5;
    for (const [k, y, s, a] of [[0.05, 76, 0.7, 0.85], [0.36, 48, 0.46, 0.7], [0.62, 84, 0.6, 0.78], [0.86, 64, 0.52, 0.72]]) { const x = (((k * span + c0) % span) + span) % span - 150; drawCloud(ctx, x, y, s, a); }
    // far water out to the horizon
    const hz = S - 15, hg = ctx.createLinearGradient(0, hz, 0, S);
    hg.addColorStop(0, '#2a7fae'); hg.addColorStop(1, '#2391bf');
    ctx.fillStyle = hg; ctx.fillRect(0, hz, W, S - hz + 1);
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(0, hz, W, 1);
    if (this.weather.drift > 0.6) { ctx.fillStyle = 'rgba(255,255,255,0.5)'; for (let i = 0; i < 14; i++) { const x = ((i * 137 - cam * 0.2 + t * 6) % (W + 40) + W + 40) % (W + 40) - 20; ctx.fillRect(x, hz + 4 + (i % 3) * 3, 8, 1.4); } }
    if (this.variant === 'ledge') {   // a reef light out on the horizon
      const lx = sw * 0.9 - cam * 0.03, ly = hz;
      ctx.strokeStyle = 'rgba(40,60,70,0.55)'; ctx.lineWidth = 1.2; ctx.beginPath();
      ctx.moveTo(lx - 7, ly); ctx.lineTo(lx - 2, ly - 34); ctx.moveTo(lx + 7, ly); ctx.lineTo(lx + 2, ly - 34);
      for (let i = 0; i < 4; i++) { const y0 = ly - i * 8, y1 = ly - (i + 1) * 8, w0 = 7 - i * 1.25, w1 = 7 - (i + 1) * 1.25; ctx.moveTo(lx - w0, y0); ctx.lineTo(lx + w1, y1); ctx.moveTo(lx + w0, y0); ctx.lineTo(lx - w1, y1); }
      ctx.stroke(); ctx.fillStyle = 'rgba(40,60,70,0.6)'; ctx.fillRect(lx - 3, ly - 40, 6, 6);
    } else {   // a dive boat working another mooring
      const dx = sw * 0.12 - cam * 0.03 + 40, dy = hz + 1;
      ctx.fillStyle = 'rgba(60,80,92,0.55)'; ctx.beginPath(); ctx.moveTo(dx - 26, dy - 4); ctx.lineTo(dx + 24, dy - 4); ctx.lineTo(dx + 18, dy + 1); ctx.lineTo(dx - 22, dy + 1); ctx.closePath(); ctx.fill();
      ctx.fillRect(dx - 12, dy - 10, 18, 6);
    }
  }
  drawWater(ctx, W, H, t, cam) {
    const S = BOT.SURF, wreck = this.variant === 'wreck';
    const g = ctx.createLinearGradient(0, S, 0, H);
    if (wreck) { g.addColorStop(0, '#279ac2'); g.addColorStop(0.16, '#14789f'); g.addColorStop(0.5, '#0a4868'); g.addColorStop(1, '#041b2e'); }
    else { g.addColorStop(0, '#2eaacd'); g.addColorStop(0.16, '#1886ad'); g.addColorStop(0.5, '#0d5a80'); g.addColorStop(1, '#06283f'); }
    ctx.fillStyle = g; ctx.fillRect(0, S, W, H - S);
    // light coming down through the surface
    const k = wreck ? 0.72 : 1, span = W + 520;
    for (let i = 0; i < 7; i++) {
      const x = (((i * 263 - cam * 0.25) % span) + span) % span - 260;
      const sw = Math.sin(t * 0.35 + i * 1.7) * 18, w0 = 24 + (i % 3) * 16, len = 230 + (i % 2) * 110;
      const rg = ctx.createLinearGradient(0, S, 0, S + len); rg.addColorStop(0, `rgba(205,242,255,${0.11 * k})`); rg.addColorStop(1, 'rgba(205,242,255,0)');
      ctx.fillStyle = rg; ctx.beginPath(); ctx.moveTo(x, S); ctx.lineTo(x + w0, S); ctx.lineTo(x + w0 - 40 + sw, S + len); ctx.lineTo(x - 100 + sw, S + len); ctx.closePath(); ctx.fill();
    }
    // the underside of the surface
    const ug = ctx.createLinearGradient(0, S, 0, S + 22); ug.addColorStop(0, 'rgba(210,248,255,0.28)'); ug.addColorStop(1, 'rgba(210,248,255,0)');
    ctx.fillStyle = ug; ctx.fillRect(0, S, W, 22);
    ctx.strokeStyle = 'rgba(220,250,255,0.14)'; ctx.lineWidth = 1.2;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); for (let x = 0; x <= W; x += 14) { const y = S + 6 + i * 5 + Math.sin(x * 0.05 + t * 1.6 + i * 2 - cam * 0.05) * 1.6; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); }
    // far bottom, slow parallax
    const base = this.L.base, p1 = cam * 0.4;
    ctx.fillStyle = wreck ? 'rgba(6,38,60,0.6)' : 'rgba(8,58,82,0.55)';
    ctx.beginPath(); ctx.moveTo(-10, H);
    for (let x = -10; x <= W + 12; x += 12) { const wx = x + p1; ctx.lineTo(x, this.yOf(base - 15 - Math.sin(wx * 0.0045) * 7 - Math.sin(wx * 0.013 + 1.3) * 3.5 - Math.max(0, Math.sin(wx * 0.0021 + 0.5)) * 9)); }
    ctx.lineTo(W + 12, H); ctx.closePath(); ctx.fill();
    // nearer silhouettes: fans and whips on a closer ridge
    const p2 = cam * 0.7, col = wreck ? 'rgba(4,30,48,0.6)' : 'rgba(6,44,66,0.6)';
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-10, H);
    for (let x = -10; x <= W + 12; x += 10) { const wx = x + p2; ctx.lineTo(x, this.yOf(base - 6 - Math.sin(wx * 0.007 + 2) * 4 - Math.sin(wx * 0.019) * 2)); }
    ctx.lineTo(W + 12, H); ctx.closePath(); ctx.fill();
    const i0 = Math.floor((p2 - 60) / 150), i1 = Math.ceil((p2 + W + 60) / 150);
    for (let i = i0; i <= i1; i++) {
      const hsh = (Math.imul(i, 2654435761) >>> 0) / 4294967296, wx = i * 150 + hsh * 110, x = wx - p2;
      const y = this.yOf(base - 6 - Math.sin(wx * 0.007 + 2) * 4 - Math.sin(wx * 0.019) * 2) + 2;
      if (hsh < 0.45) btFan(ctx, x, y, 16 + hsh * 30, col, t); else if (hsh < 0.8) btWhip(ctx, x, y, 18 + hsh * 16, col, t);
    }
  }
  drawSchools(ctx, cam, W, bxw, by) {   // bait schools: tiny silver fish
    const t = this.t;
    for (const s of this.schools) {
      const c = this.schoolX(s); if (c < cam - 220 || c > cam + W + 220) continue;
      for (const p of s.pts) {
        const [x, ft] = this.speck(s, p), y = this.yOf(ft), r = dist(x, y, bxw, by);
        const vis = Math.max(this.ambient(ft), clamp((220 - r) / 130, 0, 1)), a = 0.06 + vis * 0.8, d = Math.cos(t * p[2] + p[3]) >= 0 ? 1 : -1;
        ctx.fillStyle = `rgba(214,232,240,${a.toFixed(3)})`; ctx.beginPath(); ctx.ellipse(x, y, 3, 1.2, 0, 0, TAU); ctx.moveTo(x - d * 2.4, y); ctx.lineTo(x - d * 5, y - 1.6); ctx.lineTo(x - d * 5, y + 1.6); ctx.closePath(); ctx.fill();
      }
    }
  }
  drawBottom(ctx, cam, W, H, t) {
    const x0 = cam - 40, x1 = cam + W + 40, wreck = this.variant === 'wreck';
    // sand
    const sg = ctx.createLinearGradient(0, this.yOf(this.L.base - 4), 0, H);
    if (wreck) { sg.addColorStop(0, '#6b7c74'); sg.addColorStop(1, '#22343a'); } else { sg.addColorStop(0, '#93977c'); sg.addColorStop(1, '#3a4c4a'); }
    ctx.fillStyle = sg; ctx.beginPath(); ctx.moveTo(x0, H);
    for (let x = x0; x <= x1; x += 8) ctx.lineTo(x, this.yOf(this.sandFt(x)));
    ctx.lineTo(x1, H); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,240,0.07)'; ctx.lineWidth = 1.2;
    for (let x = Math.floor(x0 / 22) * 22; x < x1; x += 22) { const y = this.yOf(this.sandFt(x)) + 6 + ((x / 22) % 3) * 6; ctx.beginPath(); ctx.moveTo(x - 7, y + 1); ctx.quadraticCurveTo(x, y - 2, x + 7, y + 1); ctx.stroke(); }
    if (wreck) this.drawWreck(ctx, x0, x1, H, t); else this.drawLedge(ctx, x0, x1, H);
    for (const b of this.bumps) { if (b.x + b.r < x0 || b.x - b.r > x1) continue; this.drawBump(ctx, b, t); }
    for (const d of this.decor) {
      if (d.x < x0 - 30 || d.x > x1 + 30) continue;
      const y = this.yOf(d.ft) + 1.5;
      if (d.type === 'fan') btFan(ctx, d.x, y, d.s, d.c, t); else if (d.type === 'whip') btWhip(ctx, d.x, y, d.s, d.c, t);
      else if (d.type === 'barrel') btBarrel(ctx, d.x, y, d.s, d.c); else if (d.type === 'tubes') btTubes(ctx, d.x, y, d.s, d.c); else btEncrust(ctx, d.x, y, d.s, d.c);
    }
  }
  drawLedge(ctx, x0, x1, H) {
    // the reef terrace and its wall, the mound under the coral heads, and the back ledge
    for (const [a, b, deep] of [[-500, 1112, 1], [1800, 2100, 0.2], [2675, 3210, 1]]) {
      const xa = Math.max(a, x0), xb = Math.min(b, x1); if (xa >= xb) continue;
      const path = () => {
        ctx.beginPath(); ctx.moveTo(xa, this.yOf(this.rockFt(xa)));
        for (let x = xa; x <= xb; x += 6) ctx.lineTo(x, this.yOf(this.rockFt(x)));
        ctx.lineTo(xb, this.yOf(this.rockFt(xb)));
        for (let x = xb; x >= xa - 6; x -= 12) { const xx = Math.max(x, xa), k = deep * btSmooth(a, a + 160, xx) * (1 - btSmooth(b - 160, b, xx)); ctx.lineTo(xx, Math.min(H + 4, this.yOf(this.sandFt(xx)) + 8 + k * 140)); }
        ctx.closePath();
      };
      const g = ctx.createLinearGradient(0, this.yOf(76), 0, H); g.addColorStop(0, '#6e6a52'); g.addColorStop(0.4, '#535443'); g.addColorStop(1, '#283230');
      path(); ctx.fillStyle = g; ctx.fill();
      ctx.save(); path(); ctx.clip();
      for (const bl of this.blobs) { if (bl.x < xa - 20 || bl.x > xb + 20) continue; ctx.fillStyle = bl.c; ell(ctx, bl.x, this.yOf(this.rockFt(bl.x)) + bl.d, bl.rx, bl.ry); ctx.fill(); }
      // crevices down the walls and a dark band under the lips
      ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = 2;
      for (const cx of [1066, 1081, 1096, 2690, 2700]) { if (cx < xa || cx > xb) continue; ctx.beginPath(); ctx.moveTo(cx, this.yOf(this.rockFt(cx)) + 4); ctx.quadraticCurveTo(cx + 4, this.yOf(this.rockFt(cx)) + 22, cx - 2, this.yOf(this.rockFt(cx)) + 40); ctx.stroke(); }
      ctx.restore();
      // a highlight along the top edge
      ctx.strokeStyle = 'rgba(220,230,200,0.12)'; ctx.lineWidth = 2; ctx.beginPath();
      for (let x = xa; x <= xb; x += 6) { const y = this.yOf(this.rockFt(x)) + 1; x === xa ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
      ctx.stroke();
    }
    // overhanging lips on the two ledges, with the shadow under them
    for (const [wx, dir] of [[1076, 1], [2690, -1]]) {
      if (wx < x0 - 60 || wx > x1 + 60) continue;
      const top = this.yOf(this.rockFt(wx - dir * 6)), lx = wx + dir * 24;
      const sh = ctx.createLinearGradient(0, top, 0, top + 46); sh.addColorStop(0, 'rgba(3,10,12,0.6)'); sh.addColorStop(1, 'rgba(3,10,12,0)');
      ctx.fillStyle = sh; ctx.beginPath(); ctx.moveTo(wx - dir * 4, top + 6); ctx.lineTo(lx, top + 8); ctx.lineTo(wx + dir * 12, top + 48); ctx.lineTo(wx - dir * 2, top + 48); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#5c5b47'; ctx.beginPath(); ctx.moveTo(wx - dir * 10, top - 1); ctx.quadraticCurveTo(wx + dir * 10, top - 4, lx, top + 2);
      ctx.quadraticCurveTo(lx + dir * 2, top + 8, lx - dir * 6, top + 9); ctx.quadraticCurveTo(wx + dir * 6, top + 12, wx - dir * 4, top + 14); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(220,230,200,0.14)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(wx - dir * 10, top); ctx.quadraticCurveTo(wx + dir * 10, top - 3, lx, top + 2); ctx.stroke();
      for (let i = 0; i < 4; i++) { ctx.fillStyle = ['rgba(200,90,60,0.55)', 'rgba(150,80,150,0.5)', 'rgba(200,160,60,0.5)', 'rgba(90,150,120,0.5)'][i]; ell(ctx, wx + dir * (i * 7 - 4), top + 10 + (i % 2) * 2, 4, 2.4); ctx.fill(); }
    }
    // undercut pockets at the foot of each ledge: grouper hide in these
    for (const [px, pft, rx, ry] of [[1078, 93.4, 18, 8], [1093, 88.6, 11, 6], [1058, 95.6, 14, 5], [2700, 93.6, 16, 7], [2712, 90.4, 10, 5]]) {
      if (px < x0 - 30 || px > x1 + 30) continue;
      const y = this.yOf(pft), rg = ctx.createRadialGradient(px, y, 1, px, y, rx);
      rg.addColorStop(0, 'rgba(2,6,8,0.95)'); rg.addColorStop(0.7, 'rgba(4,10,12,0.75)'); rg.addColorStop(1, 'rgba(4,10,12,0)');
      ctx.fillStyle = rg; ell(ctx, px, y, rx, ry); ctx.fill();
    }
  }
  drawBump(ctx, b, t) {
    const x = b.x, y = this.yOf(b.base), ry = b.h * this.ppf;
    if (b.k === 'brain' || b.k === 'star' || b.k === 'rock') { btDome(ctx, b, x, y, ry); return; }
    ctx.save();
    if (b.k === 'plate') {   // a torn hull plate, half buried
      ctx.translate(x, y + 2); ctx.rotate((b.seed - 0.5) * 0.9);
      ctx.fillStyle = b.c1; ctx.fillRect(-b.r, -ry, b.r * 2, ry + 4);
      ctx.fillStyle = 'rgba(120,60,30,0.25)'; ctx.fillRect(-b.r, -ry, b.r * 2, ry * 0.35);
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1; ctx.strokeRect(-b.r, -ry, b.r * 2, ry + 4);
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; for (let i = 0; i < 4; i++) { ell(ctx, -b.r + 5 + i * (b.r * 2 - 10) / 3, -ry + 3, 1.3, 1.3); ctx.fill(); }
    } else if (b.k === 'winch') {
      ctx.fillStyle = b.c2; ctx.fillRect(x - b.r, y - ry * 0.45, b.r * 2, ry * 0.45 + 3);
      ctx.fillStyle = b.c1; ell(ctx, x - b.r * 0.55, y - ry * 0.55, ry * 0.5, ry * 0.5); ctx.fill(); ell(ctx, x + b.r * 0.55, y - ry * 0.55, ry * 0.5, ry * 0.5); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ell(ctx, x - b.r * 0.55, y - ry * 0.55, ry * 0.18, ry * 0.18); ctx.fill(); ell(ctx, x + b.r * 0.55, y - ry * 0.55, ry * 0.18, ry * 0.18); ctx.fill();
      ctx.fillStyle = b.c1; ctx.fillRect(x - b.r * 0.55, y - ry * 0.85, b.r * 1.1, ry * 0.6);
    } else if (b.k === 'anchor') {
      ctx.strokeStyle = b.c1; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x - b.r, y - 2); ctx.lineTo(x + b.r * 0.6, y - ry - 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - b.r * 0.9, y - ry * 0.9); ctx.quadraticCurveTo(x - b.r * 1.2, y + 2, x - b.r * 0.2, y); ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1.5; for (let i = 0; i < 6; i++) { ell(ctx, x + b.r * 0.6 + i * 7, y - ry - 2 + i * 1.5, 3, 2); ctx.stroke(); }
    } else if (b.k === 'pipe' || b.k === 'funnel') {   // a length of pipe, or the funnel off the stern
      const r2 = ry * 0.5;
      ctx.fillStyle = b.c2; ctx.fillRect(x - b.r, y - ry, b.r * 2, ry + 3);
      const pg = ctx.createLinearGradient(0, y - ry, 0, y); pg.addColorStop(0, b.c1); pg.addColorStop(1, b.c2); ctx.fillStyle = pg; ctx.fillRect(x - b.r, y - ry, b.r * 2, ry);
      ctx.fillStyle = b.c1; ell(ctx, x + b.r, y - r2, r2 * 0.45, r2); ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,0.65)'; ell(ctx, x + b.r, y - r2, r2 * 0.3, r2 * 0.75); ctx.fill();
      if (b.k === 'funnel') { ctx.fillStyle = 'rgba(160,50,40,0.35)'; ctx.fillRect(x - b.r * 0.2, y - ry, b.r * 0.4, ry); }
    }
    ctx.restore();
  }
  drawWreck(ctx, x0, x1, H, t) {
    if (x1 < BOT_WK.x0 - 400 || x0 > BOT_WK.x1 + 200) return;
    const Y = (ft) => this.yOf(ft), W = BOT_WK;
    const hullPath = (poly) => { ctx.beginPath(); poly.forEach(([x, ft], i) => (i ? ctx.lineTo(x, Y(ft)) : ctx.moveTo(x, Y(ft)))); ctx.closePath(); };
    // the dive mooring: a line from the ball on the surface down to the bow
    ctx.strokeStyle = 'rgba(220,215,190,0.35)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(1702, BOT.SURF + 2); ctx.quadraticCurveTo(1716 + Math.sin(t * 0.7) * 6, Y(40), 1700, Y(80.6)); ctx.stroke();
    ctx.fillStyle = '#f4f6f4'; ell(ctx, 1702, BOT.SURF - 1 + Math.sin(t * 1.6) * 1.2, 7, 6); ctx.fill(); ctx.fillStyle = '#2a5bd8'; ctx.fillRect(1695, BOT.SURF - 2 + Math.sin(t * 1.6) * 1.2, 14, 3);
    // a dark hold behind the break, the twisted frames in front of it
    ctx.fillStyle = '#081418'; ctx.beginPath(); ctx.moveTo(1880, Y(86)); ctx.lineTo(1940, Y(86.5)); ctx.lineTo(1944, Y(113)); ctx.lineTo(1878, Y(113)); ctx.closePath(); ctx.fill();
    for (const [poly, half] of [[W.bow, 0], [W.stern, 1]]) {
      const top = half ? 83.4 : 80.4;
      hullPath(poly);
      const g = ctx.createLinearGradient(0, Y(top), 0, Y(111)); g.addColorStop(0, '#5a5c54'); g.addColorStop(0.18, '#4b4d47'); g.addColorStop(0.6, '#3b3a35'); g.addColorStop(1, '#232726');
      ctx.fillStyle = g; ctx.fill();
      ctx.save(); hullPath(poly); ctx.clip();
      const xa = half ? 1930 : 1395, xb = half ? 2392 : 1892;
      // the deck, rolled toward us: a darker band with open hatches
      ctx.fillStyle = 'rgba(20,24,24,0.45)'; ctx.beginPath(); ctx.moveTo(xa, Y(top - 1));
      for (let x = xa; x <= xb; x += 10) ctx.lineTo(x, Y(btPolyTop(poly, x) + 5.5)); ctx.lineTo(xb, Y(top - 1)); ctx.closePath(); ctx.fill();
      for (let x = xa + 70; x < xb - 50; x += 92) {
        if (half && x > 2150 && x < 2340) continue;
        const ty = Y(btPolyTop(poly, x)) + 3; ctx.fillStyle = '#5c5a50'; ctx.fillRect(x, ty, 52, 11); ctx.fillStyle = '#0b1214'; ctx.fillRect(x + 3, ty + 2, 46, 8);
      }
      // plates, seams, rust running down from the rivets
      ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1;
      for (let x = xa + 14; x < xb; x += 30) { ctx.beginPath(); ctx.moveTo(x, Y(top + 5)); ctx.lineTo(x + 2, Y(112)); ctx.stroke(); }
      for (const d of [11, 18, 24]) { ctx.beginPath(); ctx.moveTo(xa, Y(top + d)); ctx.lineTo(xb, Y(top + d + 0.6)); ctx.stroke(); }
      const rg = ctx.createLinearGradient(0, Y(top + 6), 0, Y(top + 22)); rg.addColorStop(0, 'rgba(150,80,40,0.38)'); rg.addColorStop(1, 'rgba(150,80,40,0)'); ctx.fillStyle = rg; ctx.beginPath();
      for (let x = xa + 22; x < xb; x += 47) ctx.rect(x, Y(top + 6), 5 + (x % 3) * 2, Y(top + 22) - Y(top + 6));
      ctx.fill();
      // boot-top paint at the old waterline, half in the sand
      ctx.fillStyle = 'rgba(120,40,34,0.42)'; ctx.fillRect(xa, Y(104), xb - xa, Y(108) - Y(104));
      // growth on the plates
      const gp = [new Path2D(), new Path2D(), new Path2D()];
      for (let x = xa + 8; x < xb; x += 13) { const r = ((x * 9301 + 49297) % 233280) / 233280; if (r < 0.5) continue; const q = gp[r < 0.7 ? 0 : r < 0.85 ? 1 : 2], ex = x, ey = Y(top + 6 + r * 18); q.moveTo(ex + 3 + r * 4, ey); q.ellipse(ex, ey, 3 + r * 4, 2 + r * 2, 0, 0, TAU); }
      ['rgba(90,110,70,0.35)', 'rgba(150,80,110,0.3)', 'rgba(180,120,60,0.3)'].forEach((c, i) => { ctx.fillStyle = c; ctx.fill(gp[i]); });
      ctx.restore();
      ctx.strokeStyle = 'rgba(210,220,200,0.14)'; ctx.lineWidth = 2; ctx.beginPath();
      for (let x = xa + 6; x <= xb - 6; x += 8) { const y = Y(btPolyTop(poly, x)) + 1; x === xa + 6 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke();
      // railing along the deck edge, bent and broken
      ctx.strokeStyle = 'rgba(150,150,140,0.45)'; ctx.lineWidth = 1.2; ctx.beginPath();
      for (let x = xa + 20; x < xb - 16; x += 14) { if ((x / 14) % 7 < 1) continue; const y = Y(btPolyTop(poly, x)); ctx.moveTo(x, y); ctx.lineTo(x - 2, y - 7); }
      ctx.stroke();
    }
    // portholes up by the bow, the hawse pipe and the anchor chain hanging to the sand
    for (let i = 0; i < 5; i++) { const px = 1478 + i * 20, py = Y(88.6); ctx.fillStyle = '#6a685c'; ell(ctx, px, py, 4.6, 4.6); ctx.fill(); ctx.fillStyle = '#0a1214'; ell(ctx, px, py, 3, 3); ctx.fill(); }
    ctx.fillStyle = '#0a1214'; ell(ctx, 1432, Y(85.6), 5, 4); ctx.fill();
    ctx.strokeStyle = 'rgba(70,64,56,0.9)'; ctx.lineWidth = 1.6;
    for (let i = 0; i < 9; i++) { const k = i / 8, cx = 1430 - k * 26 + Math.sin(k * 3) * 4, cy = lerp(Y(86.4), Y(109.6), k); ell(ctx, cx, cy, 2.4, 3.4, 0.3); ctx.stroke(); }
    // ribs at the break
    ctx.strokeStyle = '#3f3e38'; ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const x = 1888 + i * 9.5, h = 92 + ((i * 5) % 4) * 1.4, bend = (i % 2 ? 1 : -1) * 8;
      ctx.lineWidth = 3.4; ctx.beginPath(); ctx.moveTo(x, Y(112)); ctx.quadraticCurveTo(x + bend, Y((h + 112) / 2), x + bend * 0.4, Y(h)); ctx.stroke();
    }
    ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(1884, Y(97)); ctx.quadraticCurveTo(1910, Y(95), 1938, Y(99)); ctx.stroke();
    ctx.fillStyle = '#4a4740'; ctx.save(); ctx.translate(1916, Y(95.5)); ctx.rotate(0.5); ctx.fillRect(-7, 0, 14, 16); ctx.restore();
    // the wheelhouse, rolled over on the stern deck
    const s = W.sup, cx = s.x, cy = Y(s.ft), hp = s.h * this.ppf;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(s.a);
    const sg = ctx.createLinearGradient(0, -hp, 0, 0); sg.addColorStop(0, '#5e6058'); sg.addColorStop(1, '#3d3f3a');
    ctx.fillStyle = sg; ctx.fillRect(-s.w / 2, -hp, s.w, hp + 8);
    ctx.fillStyle = '#4c4e47'; ctx.fillRect(-s.w / 2 + 10, -hp - 9, s.w * 0.55, 10); ctx.fillRect(s.w / 2 - 6, -hp + 2, 22, 7);   // bridge deck and a wing
    ctx.fillStyle = '#081214';
    for (let r = 0; r < 2; r++) for (let i = 0; i < 6; i++) { const wx = -s.w / 2 + 10 + i * 19, wy = -hp + 9 + r * 18; ctx.fillRect(wx, wy, 12, 9); }
    ctx.fillStyle = 'rgba(120,190,200,0.12)'; for (let i = 0; i < 6; i++) ctx.fillRect(-s.w / 2 + 11 + i * 19, -hp + 10, 5, 3);
    ctx.fillStyle = '#0a1214'; ctx.fillRect(-s.w / 2 + 6, -12, 13, 19);   // a door hanging open
    ctx.strokeStyle = '#4c4e47'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-s.w / 2 + 40, -hp - 9); ctx.lineTo(-s.w / 2 + 34, -hp - 44); ctx.moveTo(-s.w / 2 + 22, -hp - 32); ctx.lineTo(-s.w / 2 + 48, -hp - 36); ctx.stroke();   // the mast stub
    ctx.fillStyle = 'rgba(150,80,110,0.4)'; for (let i = 0; i < 9; i++) { ell(ctx, -s.w / 2 + 8 + i * 14, -hp - 1, 5, 3); ctx.fill(); }
    ctx.restore();
    // rudder and prop, half buried at the stern
    ctx.fillStyle = '#34342f'; ctx.beginPath(); ctx.moveTo(2384, Y(96)); ctx.lineTo(2398, Y(97)); ctx.lineTo(2400, Y(110)); ctx.lineTo(2384, Y(110)); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#5a5040'; for (const a of [-0.6, 0.5, 1.6]) { ctx.save(); ctx.translate(2378, Y(104)); ctx.rotate(a); ell(ctx, 0, -7, 3.4, 7.5); ctx.fill(); ctx.restore(); }
    // sand drifted up against the hull
    ctx.fillStyle = 'rgba(98,115,111,0.95)'; ctx.beginPath(); ctx.moveTo(1440, Y(113));
    for (let x = 1440; x <= 2420; x += 20) ctx.lineTo(x, Y(this.sandFt(x) - 1.6 - Math.sin(x * 0.05) * 0.8));
    ctx.lineTo(2420, Y(113)); ctx.closePath(); ctx.fill();
  }
  drawFishes(ctx, cam, W, bxw, by) {
    for (const f of this.fish) {
      if (f.x < cam - 180 || f.x > cam + W + 180) continue;
      const ft = this.ftOf(f.y), r = dist(f.x, f.y, bxw, by);
      // in the dark you only see a fish near your light, or up in the brighter water near the surface
      const vis = Math.max(this.ambient(ft), clamp((215 - r) / 125, 0, 1));
      const silA = (1 - vis) * 0.34 * clamp((440 - r) / 240, 0.12, 1);
      const wig = f.state === 'nibble' || f.state === 'bite' ? 1.2 : f.state === 'approach' ? 0.9 : 0.55;
      ctx.save(); ctx.translate(f.x, f.y);
      if (silA > 0.01) drawFish(ctx, f.key, f.len, { t: f.t, flip: f.face < 0, wig, sil: '#03121c', alpha: silA * f.alpha });
      if (vis > 0.02) drawFish(ctx, f.key, f.len, { t: f.t, flip: f.face < 0, wig, alpha: vis * f.alpha });
      ctx.restore();
    }
  }
  drawFog(ctx, W, H, lx, ly) {
    const S = BOT.SURF, k = 0.5, fw = Math.ceil(W * k), fh = Math.ceil((H - S) * k), F = this.L.fog;
    let c = this.fogC;
    if (!c) { try { c = this.fogC = document.createElement('canvas'); } catch (e) { c = null; } }
    const top = 'rgba(2,15,28,0)', s1 = `rgba(2,15,28,${F[0]})`, s2 = `rgba(2,13,25,${F[1]})`, s3 = `rgba(1,9,18,${F[2]})`;
    if (!c) { const g = ctx.createLinearGradient(0, S, 0, H); g.addColorStop(0, top); g.addColorStop(0.3, s1); g.addColorStop(0.7, s2); g.addColorStop(1, s3); ctx.fillStyle = g; ctx.fillRect(0, S, W, H - S); return; }
    if (c.width !== fw || c.height !== fh) { c.width = fw; c.height = fh; }
    const g = c.getContext('2d');
    g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, fw, fh);
    const lg = g.createLinearGradient(0, 0, 0, fh); lg.addColorStop(0, top); lg.addColorStop(0.3, s1); lg.addColorStop(0.7, s2); lg.addColorStop(1, s3);
    g.fillStyle = lg; g.fillRect(0, 0, fw, fh);
    // the deep-drop light on the line pushes the dark back
    g.globalCompositeOperation = 'destination-out';
    const x = lx * k, y = (ly - 22 - S) * k, R = 205 * k, rg = g.createRadialGradient(x, y, 0, x, y, R);
    rg.addColorStop(0, 'rgba(0,0,0,1)'); rg.addColorStop(0.35, 'rgba(0,0,0,0.85)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg; g.fillRect(x - R, y - R, R * 2, R * 2);
    g.globalCompositeOperation = 'source-over';
    ctx.drawImage(c, 0, S, W, H - S);
  }
  drawSnow(ctx, lx, ly) {
    for (const p of this.snow) {
      const lit = clamp(1 - dist(p.x, p.y, lx, ly - 22) / 170, 0, 1), a = 0.05 + 0.1 * p.z + lit * 0.55, s = p.s + lit;
      ctx.fillStyle = `rgba(210,236,245,${a.toFixed(3)})`; ctx.fillRect(p.x, p.y, s, s);
    }
  }
  drawRig(ctx, t, cam, bsx, by) {
    const S = BOT.SURF, m = this.move;
    const boatX = this.bx + this.swing() - cam - 168, bob = Math.sin(t * 1.4) * (1 + this.weather.drift) * 1.2, rot = Math.sin(t * 1.1) * 0.012 * (0.5 + this.weather.drift) + (m && m.phase === 'go' ? -m.dir * 0.02 * this.moveV / BOT.SPEED : 0);
    // the anchor line off the bow, down into the dark
    let ak = 1; if (m) ak = m.phase === 'up' ? Math.max(0, 1 - m.t / 0.7) : m.phase === 'go' ? 0 : Math.min(1, m.t / 0.6);
    if (ak > 0.02) {
      const ax = boatX - 92, ay = S + 6, ex = ax - 300 * ak, ey = ay + 260 * ak;
      const ag = ctx.createLinearGradient(ax, ay, ex, ey); ag.addColorStop(0, 'rgba(235,225,195,0.75)'); ag.addColorStop(1, 'rgba(235,225,195,0)');
      ctx.strokeStyle = ag; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(ax - 80 * ak, ay + 140 * ak, ex, ey); ctx.stroke();
    }
    const hand = drawAnglerSide(ctx, this.ch, boatX + 78, S - 8 + bob, 15, { lean: this.slam > 0 ? -0.35 : 0.05, t });
    drawBoatSide(ctx, boatX, S + 6 + bob, 0.55, { flip: true, crew: this.others, t, rot });
    drawWaterline(ctx, Game.W, S, t, 'rgba(255,255,255,0.7)', 2.5);
    const dip = this.slam > 0 ? 34 : this.twitch > 0 ? 12 : 0;
    const tipX = hand.x + 76, tipY = hand.y - 62 + dip;
    ctx.strokeStyle = '#1d1f22'; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(hand.x - 14, hand.y + 10); ctx.quadraticCurveTo(hand.x + 40, hand.y - 40 + dip * 0.4, tipX, tipY); ctx.stroke();
    // glow from the deep-drop light
    if (this.baitDepth > 6) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const gy = by - 22, gg = ctx.createRadialGradient(bsx, gy, 2, bsx, gy, 120); gg.addColorStop(0, 'rgba(120,230,255,0.24)'); gg.addColorStop(0.4, 'rgba(80,190,230,0.08)'); gg.addColorStop(1, 'rgba(80,190,230,0)');
      ctx.fillStyle = gg; ctx.fillRect(bsx - 120, gy - 120, 240, 240); ctx.restore();
    }
    ctx.strokeStyle = 'rgba(240,240,240,0.78)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(tipX, tipY); ctx.quadraticCurveTo(bsx - 20, S + 10, bsx, by - 14); ctx.stroke();
    // light, sinker, bait, hook
    if (this.baitDepth > 2) { ctx.fillStyle = '#d8fff6'; rr(ctx, bsx - 2, by - 31, 4, 11, 2); ctx.fill(); ctx.fillStyle = 'rgba(120,255,220,0.5)'; ell(ctx, bsx, by - 25.5, 5, 7); ctx.fill(); }
    ctx.fillStyle = '#596067'; ell(ctx, bsx, by - 14, 3, 5); ctx.fill();
    if (this.baitOn) {
      if (this.baitType === 'squid') { ctx.fillStyle = '#f2d6dc'; ctx.beginPath(); ctx.moveTo(bsx, by - 4); ctx.quadraticCurveTo(bsx + 8 + Math.sin(t * 6) * 3, by + 6, bsx + 2, by + 16); ctx.lineTo(bsx - 2, by + 2); ctx.fill(); }
      else { ctx.save(); ctx.translate(bsx + 6, by + 4); drawFish(ctx, 'whitegrunt', 22, { t, wig: 1, speed: 16 }); ctx.restore(); }
    }
    ctx.strokeStyle = '#c9cfd4'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(bsx, by + 2, 4, 0, Math.PI); ctx.stroke();
    // where you're sending it
    if (this.baitOn && !this.reeling && !m) {
      const td = Math.min(this.targetDepth, this.maxDepth()), ty = this.yOf(td);
      if (Math.abs(td - this.baitDepth) > 1.5 || this.drag) { ctx.strokeStyle = 'rgba(255,200,69,0.6)'; ctx.setLineDash([6, 6]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(bsx - 60, ty); ctx.lineTo(bsx + 60, ty); ctx.stroke(); ctx.setLineDash([]); }
    }
    if (this.baitDepth > 2) {
      const onBottom = this.baitDepth >= this.maxDepth() - 0.3;
      text(ctx, Math.round(this.baitDepth) + ' ft' + (onBottom ? ' · bottom' : ''), bsx + 16, by - 10, { size: 15, color: '#fff', weight: 800, stroke: 'rgba(0,0,0,0.55)', sw: 4 });
    }
    const f = this.activeFish();
    if (f && f.state === 'bite') { ctx.strokeStyle = PAL.sun; ctx.lineWidth = 4; const r = 26 + Math.sin(t * 30) * 4; ell(ctx, bsx, by, r, r); ctx.stroke(); }
  }

  /* ---------- HUD: fish finder, bait, moving ---------- */
  drawHud(ctx, W, H) {
    this.drawTopBar(ctx);
    const cw = this.colW(), cx = this.colX(), sw = this.sceneW(), mid = this.baitSX();
    const baitH = 122, sonH = H - 12 - baitH - 10 - 10;
    this.drawSonar(ctx, cx, 10, cw, sonH);
    this.drawBaitPanel(ctx, cx, H - 12 - baitH, cw, baitH);
    // moving the boat
    const mw = Math.min(124, sw * 0.27), my = H - 60, m = this.move;
    UI.button(ctx, 'moveL', 14, my, mw, 46, '◀  Move', () => this.startMove(-1), { style: m && m.dir < 0 ? 'secondary' : 'dark', size: 18, key: 'KeyA|ArrowLeft', disabled: !m && this.bx <= BOT.XMIN + 2 });
    UI.button(ctx, 'moveR', sw - 14 - mw, my, mw, 46, 'Move  ▶', () => this.startMove(1), { style: m && m.dir > 0 ? 'secondary' : 'dark', size: 18, key: 'KeyD|ArrowRight', disabled: !m && this.bx >= BOT.XMAX - 2 });
    // messages sit in open water, clear of the bottom and the buttons
    const my0 = BOT.SURF + 104, maxW = sw - 30;
    const msg = (s) => text(ctx, s, mid, my0, { size: 21, align: 'center', color: '#fff', weight: 800, stroke: 'rgba(0,0,0,0.5)', sw: 5, maxW });
    if (m) msg(m.phase === 'up' ? 'Pulling the anchor…' : m.phase === 'go' ? 'Idling over…' : 'Dropping anchor…');
    else if (!this.baitOn && !this.reeling && this.rebaitT <= 0) UI.button(ctx, 'rebait', mid - 100, my0 - 28, 200, 56, 'REBAIT', () => this.rebait(), { style: 'coral', size: 26, key: 'KeyR|Space|Enter' });
    else if (this.reeling || this.rebaitT > 0) msg(this.reeling ? 'Reeling up…' : 'Baiting the hook…');
    else if (this.t > 1.8 && this.t < 14) {
      const l1 = Game.touch ? 'Drag up or down to set your depth · tap on the BITE' : 'Drag or ↑ ↓ to set depth · Space on the BITE';
      const l2 = Game.touch ? 'Yellow and red marks on the fish finder are fish. None? Move.' : 'Yellow and red marks on the fish finder are fish. None? A / D to move.';
      text(ctx, l1, mid, my0, { size: 17, align: 'center', color: '#fff', weight: 700, alpha: 0.92, stroke: 'rgba(0,0,0,0.55)', sw: 4, maxW });
      text(ctx, l2, mid, my0 + 23, { size: 15, align: 'center', color: '#d8ecf2', weight: 700, alpha: 0.92, stroke: 'rgba(0,0,0,0.55)', sw: 4, maxW });
    } else if (this.quietT > 7) text(ctx, 'Nothing on the fish finder. Try moving the boat.', mid, my0, { size: 17, align: 'center', color: '#d8ecf2', weight: 700, alpha: 0.65 + Math.sin(this.t * 3) * 0.25, stroke: 'rgba(0,0,0,0.55)', sw: 4, maxW });
  }
  drawSonar(ctx, x, y, w, h) {
    const t = this.t, range = this.L.range, cols = this.sonar, last = cols[cols.length - 1];
    // the unit
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; rr(ctx, x, y + 5, w, h, 16); ctx.fill();
    const bz = ctx.createLinearGradient(0, y, 0, y + h); bz.addColorStop(0, '#232b31'); bz.addColorStop(1, '#10161a');
    ctx.fillStyle = bz; rr(ctx, x, y, w, h, 16); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
    text(ctx, 'FISH FINDER', x + 14, y + 22, { size: 13, color: '#8fb0bd', weight: 800 });
    if (this.move) text(ctx, ((this.moveV / BOT.SPEED) * 2.6).toFixed(1) + ' kn', x + 14, y + 39, { size: 12, color: '#6f8f9b', weight: 700 });
    else {   // a color key: what's bait, what's a fish, what's a big one
      let lx = x + 14;
      for (const [c, l] of [['#50b9ff', 'bait'], ['#ffe034', 'fish'], ['#ff3b2c', 'big']]) { ctx.fillStyle = c; rr(ctx, lx, y + 31, 7, 7, 2); ctx.fill(); lx += 10; ctx.font = fnt(12, 700); text(ctx, l, lx, y + 39, { size: 12, color: '#8fb0bd', weight: 700 }); lx += ctx.measureText(l).width + 8; }
    }
    text(ctx, (last ? last.bot : this.L.base).toFixed(1), x + w - 34, y + 36, { size: 28, align: 'right', color: '#f4f8fa', weight: 800 });
    text(ctx, 'ft', x + w - 14, y + 36, { size: 14, align: 'right', color: '#8fb0bd', weight: 800 });
    // the screen
    const sx = x + 10, sy = y + 48, sw = w - 20, sh = h - 48 - 54, scaleW = 30, hw = sw - scaleW;
    this.sonarRect = { x: sx, y: sy, w: sw, h: sh, range };
    const Y = (ft) => sy + (ft / range) * sh, n = BOT.COLS, cw = hw / n, off = n - cols.length, X = (i) => sx + (i + off) * cw;
    ctx.save(); rr(ctx, sx, sy, sw, sh, 8); ctx.clip();
    const bg = ctx.createLinearGradient(0, sy, 0, sy + sh); bg.addColorStop(0, '#0d3a8c'); bg.addColorStop(1, '#071d55');
    ctx.fillStyle = bg; ctx.fillRect(sx, sy, sw, sh);
    ctx.fillStyle = 'rgba(255,255,255,0.07)'; for (let ft = 20; ft < range; ft += 20) ctx.fillRect(sx, Y(ft), hw, 1);
    // surface clutter and weak scatter
    ctx.fillStyle = 'rgba(90,200,255,0.55)'; ctx.beginPath();
    for (let i = 0; i < cols.length; i++) { const c = cols[i]; for (const d of c.surf) ctx.rect(X(i), Y(d) - 1, cw + 0.6, 2); for (const d of c.noise) ctx.rect(X(i), Y(d), 1.6, 1.6); }
    ctx.fill();
    // the bottom: a hard red return fading to yellow, green and blue below it
    const bands = [[0, (c) => 1.0 + 2.4 * c.hard, '#ff3b2c'], [(c) => 1.0 + 2.4 * c.hard, (c) => 2.8 + 2.6 * c.hard, '#ff9a20'], [(c) => 2.8 + 2.6 * c.hard, (c) => 5.2 + 2.6 * c.hard, '#ffe034'], [(c) => 5.2 + 2.6 * c.hard, (c) => 8.6 + 2.6 * c.hard, '#4fcf5a'], [(c) => 8.6 + 2.6 * c.hard, () => 60, '#145e86']];
    const fv = (v, c) => (typeof v === 'function' ? v(c) : v);
    for (const [a, b, col] of bands) {
      if (!cols.length) break;
      ctx.fillStyle = col; ctx.beginPath();
      for (let i = 0; i < cols.length; i++) { const c = cols[i], yy = Y(c.bot + fv(a, c)); if (i) ctx.lineTo(X(i), yy); else ctx.moveTo(X(i), yy); ctx.lineTo(X(i) + cw, yy); }
      for (let i = cols.length - 1; i >= 0; i--) { const c = cols[i], yy = Y(c.bot + fv(b, c)); ctx.lineTo(X(i) + cw, yy); ctx.lineTo(X(i), yy); }
      ctx.closePath(); ctx.fill();
    }
    // bait clouds and fish arches: bigger fish paint bigger, redder marks (batched into one path per color)
    const P = { cg: new Path2D(), cb: new Path2D(), g: new Path2D(), y1: new Path2D(), y2: new Path2D(), o: new Path2D(), r: new Path2D() };
    for (let i = 0; i < cols.length; i++) {
      const c = cols[i], px = X(i);
      for (const d of c.cloud) ((d * 7) % 3 < 1 ? P.cg : P.cb).rect(px, Y(d) - 1, cw + 0.8, 2);
      for (const [d, th, s] of c.fish) {
        const yy = Y(d), hp = Math.max(3, (th / range) * sh * 1.25);
        (s < 0.3 ? P.g : P.y1).rect(px, yy - hp / 2, cw + 0.7, hp);
        if (s > 0.15) { const h2 = hp * 0.62; (s < 0.5 ? P.y2 : P.o).rect(px, yy - h2 / 2, cw + 0.7, h2); }
        if (s > 0.42) { const h3 = hp * 0.34; P.r.rect(px, yy - h3 / 2, cw + 0.7, h3); }
      }
    }
    for (const [k, col] of [['cg', 'rgba(120,235,170,0.75)'], ['cb', 'rgba(80,185,255,0.8)'], ['g', '#46d36a'], ['y1', '#ffe034'], ['y2', '#ffe034'], ['o', '#ff9a20'], ['r', '#ff3b2c']]) { ctx.fillStyle = col; ctx.fill(P[k]); }
    // your bait's track
    ctx.strokeStyle = 'rgba(240,248,255,0.9)'; ctx.lineWidth = 1.5; ctx.beginPath(); let pen = false;
    for (let i = 0; i < cols.length; i++) { const c = cols[i]; if (c.bait < 0) { pen = false; continue; } const yy = Y(c.bait); if (pen) ctx.lineTo(X(i) + cw, yy); else ctx.moveTo(X(i), yy); pen = true; }
    ctx.stroke();
    // depth of the strongest mark under the boat right now
    const now = this.sonarMarks(6)[0];
    if (now && now.s > 0.05) text(ctx, Math.round(now.ft) + '′', sx + hw - 10, Y(now.ft) - 7, { size: 13, align: 'right', color: '#fff', weight: 800, stroke: 'rgba(0,10,40,0.8)', sw: 3 });
    // where your bait is headed
    if (!this.move) {
      const td = Math.min(this.targetDepth, this.maxDepth()), ty = Y(td);
      ctx.strokeStyle = 'rgba(255,200,69,0.75)'; ctx.setLineDash([5, 5]); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(sx, ty); ctx.lineTo(sx + hw, ty); ctx.stroke(); ctx.setLineDash([]);
    }
    // depth scale
    ctx.fillStyle = 'rgba(2,12,36,0.6)'; ctx.fillRect(sx + hw, sy, scaleW, sh);
    for (let ft = 0; ft <= range; ft += 20) { const yy = Y(ft); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(sx + hw, yy, 5, 1.5); if (ft) text(ctx, String(ft), sx + sw - 4, yy + 4.5, { size: 12, align: 'right', color: '#e6f0f5', weight: 700 }); }
    if (!this.move) {
      const td = Math.min(this.targetDepth, this.maxDepth()), ty = clamp(Y(td), sy + 9, sy + sh - 9);
      ctx.fillStyle = PAL.sun; ctx.beginPath(); ctx.moveTo(sx + hw - 6, ty); ctx.lineTo(sx + hw + 2, ty - 8); ctx.lineTo(sx + sw, ty - 8); ctx.lineTo(sx + sw, ty + 8); ctx.lineTo(sx + hw + 2, ty + 8); ctx.closePath(); ctx.fill();
      text(ctx, String(Math.round(td)), sx + hw + 16, ty + 1, { size: 13, align: 'center', base: 'middle', color: PAL.ink, weight: 800 });
    }
    // glass
    const gl = ctx.createLinearGradient(sx, sy, sx + sw * 0.6, sy + sh * 0.5); gl.addColorStop(0, 'rgba(255,255,255,0.07)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gl; ctx.fillRect(sx, sy, sw, sh);
    ctx.restore();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2; rr(ctx, sx, sy, sw, sh, 8); ctx.stroke();
    if (this.move) text(ctx, 'MOVING', sx + 10, sy + 20, { size: 13, color: PAL.sun, weight: 800, stroke: 'rgba(0,0,0,0.5)', sw: 3 });
    if (this.alarmT > 0 && Math.sin(t * 18) > -0.3) {   // fish alarm: something just swam under the boat
      ctx.save(); ctx.translate(sx + hw - 22, sy + 16); ctx.fillStyle = 'rgba(0,10,40,0.7)'; rr(ctx, -17, -10, 34, 20, 8); ctx.fill(); drawFish(ctx, 'mutton', 22, { sil: PAL.sun }); ctx.restore();
    }
    // the track: the bottom you've crossed so far, your catches, and where the boat sits on the strip
    const tx = x + 10, ty = y + h - 46, tw = w - 20, th = 36, [lo, hi] = this.L.track;
    ctx.fillStyle = '#0a1115'; rr(ctx, tx, ty, tw, th, 7); ctx.fill();
    const TX = (wx) => tx + 8 + (wx / BOT.STRIP) * (tw - 16), TY = (ft) => ty + 6 + clamp((ft - lo) / (hi - lo), 0, 1) * (th - 12);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.setLineDash([2, 4]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(tx + 8, ty + th - 8); ctx.lineTo(tx + tw - 8, ty + th - 8); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = '#7fd3ea'; ctx.lineWidth = 1.6; ctx.beginPath(); pen = false;
    for (let i = 0; i < this.track.length; i++) { const v = this.track[i]; if (v == null) { pen = false; continue; } const px = TX(i * 25), py = TY(v); if (pen) ctx.lineTo(px, py); else ctx.moveTo(px, py); pen = true; }
    ctx.stroke();
    for (const wp of this.wps) { ctx.fillStyle = wp.big ? PAL.coral : PAL.sun; ell(ctx, TX(wp.x), ty + 8, 3.2, 3.2); ctx.fill(); }
    const bxp = TX(this.bx), cone = (26 + this.L.base) / BOT.STRIP * (tw - 16);
    ctx.fillStyle = 'rgba(255,200,69,0.18)'; ctx.fillRect(bxp - cone, ty + 3, cone * 2, th - 6);
    ctx.fillStyle = PAL.sun; ctx.beginPath(); ctx.moveTo(bxp - 6, ty + 2); ctx.lineTo(bxp + 6, ty + 2); ctx.lineTo(bxp, ty + 10); ctx.closePath(); ctx.fill();
    ctx.fillRect(bxp - 0.75, ty + 8, 1.5, th - 12);
  }
  drawBaitPanel(ctx, x, y, w, h) {
    panel(ctx, x, y, w, h, { r: 16 });
    const status = !this.baitOn ? (this.reeling || this.rebaitT > 0 ? 'Rebaiting' : 'Hook’s bare') : this.baitDepth >= this.maxDepth() - 0.3 ? 'On the bottom' : this.settled ? 'Fishing ' + Math.round(this.baitDepth) + ' ft' : this.move ? 'Up' : 'Dropping';
    text(ctx, 'BAIT', x + 14, y + 22, { size: 13, color: '#cfe3ea', weight: 800 });
    text(ctx, status, x + w - 14, y + 22, { size: 13, align: 'right', color: this.baitOn ? '#9fb8c2' : PAL.warn, weight: 700 });
    const bw = (w - 28 - 8) / 2, wreck = this.variant === 'wreck';
    UI.button(ctx, 'squid', x + 14, y + 30, bw, 46, 'Squid', () => { if (this.baitType !== 'squid') this.rebait('squid'); }, { style: this.baitType === 'squid' ? 'primary' : 'ghost', size: 18, sub: wreck ? 'muttons' : 'snapper · hogs', key: 'Digit1' });
    UI.button(ctx, 'pinfish', x + 22 + bw, y + 30, bw, 46, 'Pinfish', () => { if (this.baitType !== 'pinfish') this.rebait('pinfish'); }, { style: this.baitType === 'pinfish' ? 'primary' : 'ghost', size: 18, sub: wreck ? 'AJs · big fish' : 'grouper · AJs', key: 'Digit2' });
    const ready = this.chumCd <= 0;
    UI.button(ctx, 'chum', x + 14, y + 84, w - 28, 30, ready ? 'Drop chum' : 'Chum ' + Math.ceil(this.chumCd) + 's', () => this.dropChum(), { style: 'secondary', size: 16, disabled: !ready, key: 'KeyC' });
  }
}
