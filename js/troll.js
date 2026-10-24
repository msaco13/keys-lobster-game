'use strict';
/* Keys Crew — trolling offshore, seen from above. Two spots run on this scene.
   The Weedline (variant 'weed'): sargassum, floating debris and trap floats. Frigate birds circling
   high mean mahi below, diving terns mean bonita and blackfin, a lone log can hold a bull, a tripletail
   can hide under a float, and now and then something hits out of the blue.
   The Hump (variant 'hump'): a seamount where the current rips up over the top. Bait balls up, tuna
   bust under the bird piles, wahoo and amberjack patrol the rip, and the odd billfish shows up.
   Fish stay hidden in deep water until you're close or they light up on a lure: read the signs and
   steer so the spread crosses them. Stay off the trap floats. */

const LURES = [
  { Ld: 170, off: -36, color: '#ff4fa0', head: '#ffd6ea', name: 'Pink skirt' },
  { Ld: 240, off: 36, color: '#36c8ff', head: '#d9f5ff', name: 'Blue ballyhoo' },
  { Ld: 310, off: 0, color: '#ffe14a', head: '#fff7cf', name: 'Shotgun' }
];

/* How each fish behaves behind a boat. notice: how far it sees a lure (px). eager: how keen it is when a lure
   runs right over it (it falls off fast with distance, so the spread has to go through the fish, not past them).
   speed: chase speed. vis: how easy it is to spot from the boat. size: drawn length. */
const TROLL_FISH = {
  mahi: { notice: 46, eager: 5.5, speed: 250, vis: 1, size: 1 },
  tripletail: { notice: 36, eager: 4.5, speed: 170, vis: 0.5, size: 0.85 },
  bonita: { notice: 44, eager: 5, speed: 300, vis: 0.8, size: 0.85 },
  blackfin: { notice: 44, eager: 4.8, speed: 300, vis: 0.85, size: 1 },
  yellowfin: { notice: 48, eager: 4, speed: 320, vis: 0.95, size: 1.2 },
  wahoo: { notice: 50, eager: 4.4, speed: 340, vis: 0.7, size: 1.2 },
  kingfish: { notice: 46, eager: 4.6, speed: 300, vis: 0.75, size: 1.05 },
  barracuda: { notice: 42, eager: 4, speed: 280, vis: 0.85, size: 1 },
  amberjack: { notice: 44, eager: 4, speed: 230, vis: 0.6, size: 1.05 },
  sailfish: { notice: 52, eager: 3.6, speed: 280, vis: 1, size: 1.25 },
  bluemarlin: { notice: 58, eager: 3.2, speed: 280, vis: 1, size: 1.6 }
};
// Top-down looks. dim: the dark shape you see cruising deep. back/edge: dark back and lighter flanks once it
// lights up on a lure. w: body width / length, ped: tail-stock width, head and tail shapes.
const TROLL_LOOK = {
  mahi: { w: 0.22, ped: 0.14, head: 'blunt', tail: 'fork', dim: '#123f3a', back: '#0d8a66', edge: '#a4ec58', fin: '#2f7fe6', tailC: '#f2d43a' },
  tripletail: { w: 0.4, ped: 0.26, head: 'point', tail: 'round', dim: '#3b3422', back: '#4f4022', edge: '#b9a062', fin: '#4a3c20', tailC: '#5a4a28' },
  bonita: { w: 0.25, ped: 0.1, head: 'point', tail: 'lunate', dim: '#0e2a4c', back: '#1d4472', edge: '#c9d8e4', fin: '#2a4a70', tailC: '#203f66' },
  blackfin: { w: 0.27, ped: 0.1, head: 'point', tail: 'lunate', dim: '#0b2246', back: '#14244c', edge: '#bcc8d8', fin: '#2a3550', tailC: '#1a2a52', finlet: '#c9b56a' },
  yellowfin: { w: 0.27, ped: 0.1, head: 'point', tail: 'lunate', dim: '#0b2248', back: '#122148', edge: '#c6d2de', fin: '#f0bf18', tailC: '#1d2c56', finlet: '#f2d23a', stripe: '#f2c21a' },
  wahoo: { w: 0.12, ped: 0.16, head: 'point', tail: 'lunate', dim: '#0c2a4e', back: '#1a4f8a', edge: '#b9d4e8', fin: '#1b3f66', tailC: '#1b3f66' },
  kingfish: { w: 0.14, ped: 0.14, head: 'point', tail: 'lunate', dim: '#122f4a', back: '#3f5d76', edge: '#dde7ee', fin: '#4e6577', tailC: '#4e6577' },
  barracuda: { w: 0.13, ped: 0.2, head: 'point', tail: 'fork', dim: '#183246', back: '#4e5d63', edge: '#e6ecee', fin: '#5a676c', tailC: '#4e5d63' },
  amberjack: { w: 0.21, ped: 0.12, head: 'point', tail: 'fork', dim: '#24302f', back: '#6d6448', edge: '#e4d6aa', fin: '#857957', tailC: '#857957', stripe: '#d9a640' },
  sailfish: { w: 0.15, ped: 0.12, head: 'point', tail: 'lunate', dim: '#0c2556', back: '#1f3592', edge: '#a2beff', fin: '#3a2f9a', tailC: '#22408a' },
  bluemarlin: { w: 0.19, ped: 0.1, head: 'point', tail: 'lunate', dim: '#0a2152', back: '#18307e', edge: '#97b2ff', fin: '#2a3a9a', tailC: '#1a3270' }
};

// first time each sign shows up in a turn, a small label teaches what it means
const TROLL_HINTS = {
  weed: 'Weedline: troll along the edge',
  frigates: 'Frigate birds: mahi under them',
  terns: 'Terns diving: tuna feeding',
  pile: 'Bird pile: tuna busting!',
  debris: 'Floating debris: fish hide under it',
  buoy: 'Trap float: keep the prop clear',
  bait: 'Bait ball: tuna hunt these',
  rip: 'Current rip over the hump'
};

/* ---------- small helpers (kept local to this file) ---------- */
function trollHash(a, b, s) {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296;
}
// value noise that repeats every P lattice cells across x, so the water tile wraps seamlessly
function trollNoise(x, y, P, s) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const x0 = ((ix % P) + P) % P, x1 = (x0 + 1) % P;
  const a = trollHash(x0, iy, s), b = trollHash(x1, iy, s), c = trollHash(x0, iy + 1, s), d = trollHash(x1, iy + 1, s);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uy);
}
function trollPickW(table) {
  let tot = 0; for (const r of table) tot += r[1];
  let k = Math.random() * tot; for (const r of table) if ((k -= r[1]) <= 0) return r[0];
  return table.length ? table[table.length - 1][0] : null;
}
const TROLL_CACHE = {};
// One 640-wide tile of open ocean: soft depth and color variation plus long low swells. Built once per spot type.
function trollWaterTile(variant) {
  if (TROLL_CACHE[variant]) return TROLL_CACHE[variant];
  const TW = 640, H = 540, cell = 8, lw = TW / cell + 3, lh = Math.ceil(H / cell) + 3;
  const low = document.createElement('canvas'); low.width = lw; low.height = lh;
  const lg = low.getContext('2d'), img = lg.createImageData(lw, lh);
  const pal = variant === 'hump' ? [[7, 44, 100], [10, 63, 130], [17, 86, 148]] : [[9, 64, 130], [12, 85, 156], [22, 106, 176]];
  const seed = variant === 'hump' ? 7 : 3;
  for (let j = 0; j < lh; j++) for (let i = 0; i < lw; i++) {
    const px = (i - 1) * cell, py = (j - 1) * cell;
    const n = trollNoise(px / 128, py / 128, 5, seed) * 0.55 + trollNoise(px / 64, py / 64, 10, seed + 4) * 0.3 + trollNoise(px / 32, py / 32, 20, seed + 8) * 0.15;
    const k = clamp((n - 0.5) * 1.7 + 0.5, 0, 1), A = k < 0.5 ? pal[0] : pal[1], B = k < 0.5 ? pal[1] : pal[2], u = k < 0.5 ? k * 2 : (k - 0.5) * 2;
    const o = (j * lw + i) * 4;
    img.data[o] = lerp(A[0], B[0], u); img.data[o + 1] = lerp(A[1], B[1], u); img.data[o + 2] = lerp(A[2], B[2], u); img.data[o + 3] = 255;
  }
  lg.putImageData(img, 0, 0);
  const cv = document.createElement('canvas'); cv.width = TW + 4; cv.height = H;
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = true;
  g.drawImage(low, -cell, -cell, lw * cell, lh * cell);
  const rng = mulberry(variant === 'hump' ? 77 : 41);
  for (let i = 0; i < 54; i++) {
    const x = rng() * TW, y = rng() * H, l = 80 + rng() * 200, h = 3 + rng() * 6, rot = -0.1 + rng() * 0.06, light = rng() < 0.5;
    g.fillStyle = light ? 'rgba(130,195,245,0.035)' : 'rgba(0,18,58,0.055)';
    for (const ox of [-TW, 0, TW]) { ell(g, x + ox, y, l, h, rot); g.fill(); }
  }
  // deeper toward the bottom of the screen, a little haze toward the top (the tile never scrolls vertically)
  const vg = g.createLinearGradient(0, 0, 0, H);
  vg.addColorStop(0, 'rgba(150,200,240,0.07)'); vg.addColorStop(0.35, 'rgba(0,10,40,0)'); vg.addColorStop(0.75, 'rgba(0,10,40,0.08)'); vg.addColorStop(1, 'rgba(0,8,34,0.26)');
  g.fillStyle = vg; g.fillRect(0, 0, TW + 4, H);
  g.fillStyle = 'rgba(255,255,255,0.035)';
  for (let i = 0; i < 700; i++) { const x = rng() * TW, y = rng() * H, l = 2 + rng() * 5; g.fillRect(x, y, l, 1); if (x < 8) g.fillRect(x + TW, y, l, 1); }
  return (TROLL_CACHE[variant] = cv);
}
// a soft cloud shadow, drawn a few times drifting over the water
function trollCloudSprite() {
  if (TROLL_CACHE.cloud) return TROLL_CACHE.cloud;
  const cv = document.createElement('canvas'); cv.width = 440; cv.height = 260;
  const g = cv.getContext('2d'), rng = mulberry(9);
  for (let i = 0; i < 8; i++) {
    const x = 120 + rng() * 200, y = 90 + rng() * 80, r = 50 + rng() * 60;
    const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(0,12,36,0.12)'); gr.addColorStop(0.6, 'rgba(0,12,36,0.07)'); gr.addColorStop(1, 'rgba(0,12,36,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  return (TROLL_CACHE.cloud = cv);
}
// frigate bird from above: long crooked wings and a forked tail, facing +x
function trollFrigate(ctx, x, y, s, ang, flap, color) {
  const k = 1 - 0.18 * Math.max(0, flap);
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(s, s);
  ctx.fillStyle = color; ctx.beginPath();
  ctx.moveTo(8, 0); ctx.lineTo(4, -2.2); ctx.lineTo(4, -13 * k); ctx.lineTo(-11, -30 * k); ctx.lineTo(-3, -12 * k); ctx.lineTo(-6, -2.2);
  ctx.lineTo(-11, -1.2); ctx.lineTo(-22, -6); ctx.lineTo(-15, 0); ctx.lineTo(-22, 6); ctx.lineTo(-11, 1.2);
  ctx.lineTo(-6, 2.2); ctx.lineTo(-3, 12 * k); ctx.lineTo(-11, 30 * k); ctx.lineTo(4, 13 * k); ctx.lineTo(4, 2.2);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}
// tern from above: white, narrow swept wings with dark tips, black cap, facing +x. open: 0 folded … 1 spread
function trollTern(ctx, x, y, s, ang, open) {
  const w = 0.25 + 0.75 * open;
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(s, s);
  ctx.fillStyle = '#f4f7f9'; ctx.beginPath();
  ctx.moveTo(3, -1); ctx.lineTo(-1, -12 * w); ctx.lineTo(-6, -14 * w); ctx.lineTo(-3, -1);
  ctx.lineTo(-3, 1); ctx.lineTo(-6, 14 * w); ctx.lineTo(-1, 12 * w); ctx.lineTo(3, 1); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#7d8a94'; ctx.beginPath(); ctx.moveTo(-1.5, -11 * w); ctx.lineTo(-6, -14 * w); ctx.lineTo(-3.5, -10 * w); ctx.moveTo(-1.5, 11 * w); ctx.lineTo(-6, 14 * w); ctx.lineTo(-3.5, 10 * w); ctx.fill();
  ctx.fillStyle = '#f4f7f9'; ell(ctx, 0, 0, 6, 1.8); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(-10, -3); ctx.lineTo(-7.5, 0); ctx.lineTo(-10, 3); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#1c1f22'; ell(ctx, 4.6, 0, 2, 1.5); ctx.fill();
  ctx.fillStyle = '#ff9a2a'; ctx.fillRect(6.2, -0.45, 3, 0.9);
  ctx.restore();
}

// body outline of an offshore fish seen from above, nose at +x; k narrows it (the dark back down the middle)
function trollBody(ctx, L, W, lk, k) {
  const w = W * k, hx = lk.head === 'blunt' ? 0.3 : 0.26, ped = W * lk.ped;
  ctx.beginPath(); ctx.moveTo(L * 0.5, 0);
  if (lk.head === 'blunt') ctx.bezierCurveTo(L * 0.5, -w * 0.42, L * 0.43, -w * 0.6, L * hx, -w * 0.6); else ctx.quadraticCurveTo(L * 0.44, -w * 0.42, L * hx, -w * 0.58);
  ctx.bezierCurveTo(L * 0.04, -w * 0.66, -L * 0.2, -w * 0.42, -L * 0.37, -ped * k);
  ctx.lineTo(-L * 0.37, ped * k);
  ctx.bezierCurveTo(-L * 0.2, w * 0.42, L * 0.04, w * 0.66, L * hx, w * (lk.head === 'blunt' ? 0.6 : 0.58));
  if (lk.head === 'blunt') ctx.bezierCurveTo(L * 0.43, w * 0.6, L * 0.5, w * 0.42, L * 0.5, 0); else ctx.quadraticCurveTo(L * 0.44, w * 0.42, L * 0.5, 0);
  ctx.closePath();
}
// an offshore fish from above, facing +x. lit: show its colors (else a dark shape down deep)
function trollFishTop(ctx, key, L, lk, t, o = {}) {
  const W = L * lk.w, sw = Math.sin(t * (o.speed || 8)) * 0.32, lit = !!o.lit;
  ctx.save(); ctx.translate(-L * 0.36, 0); ctx.rotate(sw);
  ctx.fillStyle = lit ? lk.tailC : lk.dim; ctx.beginPath();
  if (lk.tail === 'lunate') { ctx.moveTo(L * 0.03, -W * 0.08); ctx.quadraticCurveTo(-L * 0.05, -W * 0.5, -L * 0.15, -W * 1.2); ctx.quadraticCurveTo(-L * 0.08, -W * 0.4, -L * 0.06, 0); ctx.quadraticCurveTo(-L * 0.08, W * 0.4, -L * 0.15, W * 1.2); ctx.quadraticCurveTo(-L * 0.05, W * 0.5, L * 0.03, W * 0.08); }
  else if (lk.tail === 'fork') { ctx.moveTo(L * 0.03, -W * 0.1); ctx.lineTo(-L * 0.15, -W * 0.95); ctx.lineTo(-L * 0.08, 0); ctx.lineTo(-L * 0.15, W * 0.95); ctx.lineTo(L * 0.03, W * 0.1); }
  else ctx.ellipse(-L * 0.05, 0, L * 0.09, W * 0.55, 0, 0, TAU);
  ctx.closePath(); ctx.fill(); ctx.restore();
  if (!lit) { ctx.fillStyle = lk.dim; trollBody(ctx, L, W, lk, 1); ctx.fill(); return; }
  // pectoral fins
  const pl = L * (key === 'yellowfin' || key === 'blackfin' ? 0.2 : key === 'bluemarlin' ? 0.17 : 0.12);
  ctx.fillStyle = lk.fin; ctx.beginPath();
  for (const s of [-1, 1]) { ctx.moveTo(L * 0.22, s * W * 0.42); ctx.quadraticCurveTo(L * 0.12, s * (W * 0.5 + pl * 0.5), L * 0.22 - pl, s * (W * 0.42 + pl * 0.55)); ctx.lineTo(L * 0.13, s * W * 0.36); }
  ctx.fill();
  ctx.fillStyle = lk.edge; trollBody(ctx, L, W, lk, 1); ctx.fill();
  ctx.fillStyle = lk.back; trollBody(ctx, L, W, lk, 0.56); ctx.fill();
  if (lk.stripe) { ctx.strokeStyle = lk.stripe; ctx.lineWidth = Math.max(1, L * 0.014); ctx.beginPath(); for (const s of [-1, 1]) { ctx.moveTo(L * 0.3, s * W * 0.34); ctx.quadraticCurveTo(0, s * W * 0.4, -L * 0.24, s * W * 0.2); } ctx.stroke(); }
  if (lk.finlet) { ctx.fillStyle = lk.finlet; for (let i = 0; i < 5; i++) { ell(ctx, -L * (0.1 + i * 0.055), 0, Math.max(1, L * 0.012), Math.max(1, L * 0.012)); ctx.fill(); } }
  if (key === 'mahi') { // the long blue dorsal down the back and the blue spots
    ctx.fillStyle = 'rgba(28,96,200,0.75)'; ell(ctx, L * 0.02, 0, L * 0.34, W * 0.1); ctx.fill();
    ctx.fillStyle = 'rgba(40,130,240,0.9)'; for (let i = 0; i < 6; i++) { ell(ctx, L * (0.26 - i * 0.1), (i % 2 ? 1 : -1) * W * 0.3, Math.max(1, L * 0.012), Math.max(1, L * 0.012)); ctx.fill(); }
  } else if (key === 'wahoo') {
    ctx.strokeStyle = 'rgba(12,28,66,0.75)'; ctx.lineWidth = Math.max(1, L * 0.016); ctx.beginPath();
    for (let i = 0; i < 8; i++) { const x = L * (0.3 - i * 0.075); ctx.moveTo(x, -W * 0.42); ctx.lineTo(x - L * 0.02, W * 0.42); }
    ctx.stroke();
  } else if (key === 'bonita') {
    ctx.strokeStyle = 'rgba(10,26,56,0.7)'; ctx.lineWidth = 1.1; ctx.beginPath();
    for (let i = 0; i < 4; i++) { const x = L * (0.05 - i * 0.07); ctx.moveTo(x, -W * 0.2); ctx.quadraticCurveTo(x - L * 0.03, 0, x, W * 0.2); }
    ctx.stroke();
  } else if (key === 'tripletail') {
    ctx.fillStyle = 'rgba(40,30,12,0.45)'; for (let i = 0; i < 6; i++) { ell(ctx, L * (0.25 - i * 0.09), (i % 2 ? 1 : -1) * W * 0.2, L * 0.04, W * 0.12); ctx.fill(); }
  }
  if (key === 'sailfish' || key === 'bluemarlin') { ctx.strokeStyle = lk.back; ctx.lineWidth = Math.max(1.5, L * 0.022); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(L * 0.48, 0); ctx.lineTo(L * 0.78, 0); ctx.stroke(); }
  ctx.fillStyle = 'rgba(255,255,255,0.8)'; for (const s of [-1, 1]) { ell(ctx, L * 0.4, s * W * 0.3, Math.max(0.8, L * 0.012), Math.max(0.8, L * 0.012)); ctx.fill(); }
}

class TrollScene extends SessionBase {
  constructor(o) {
    super(o);
    const spot = SPOTS[this.spot] || SPOTS.troll || {};
    this.variant = spot.variant === 'hump' ? 'hump' : 'weed'; this.spotName = spot.name || 'Offshore';
    this.allowed = new Set(spot.species || []);
    const wid = this.weather.id; this.glass = wid === 'glass'; this.breezy = wid === 'breezy';
    // how far down the crew can make out a fish: glass calm is the best day to see them
    this.visR = this.glass ? 190 : this.breezy ? 110 : 140; this.visMax = this.glass ? 0.85 : this.breezy ? 0.5 : 0.66;
    this.by = Game.H * 0.55; this.ty = this.by; this.bvy = 0; this.speed = 150; this.stall = 0; this.trav = 0;
    this.hist = [{ d: 0, y: this.by }];
    this.lures = LURES.map((l) => Object.assign({}, l, { x: 0, y: 0, fouled: 0, weedCd: 0 }));
    this.features = []; this.fish = []; this.flyers = []; this.strike = null; this.lastStrike = null; this.dragId = null;
    this.taught = new Set(); this.hint = null; this.strikes = 0;
    const hump = this.variant === 'hump';
    this.timers = hump
      ? { rip: rand(30, 38), bait: rand(4, 7), birds: rand(12, 17), weed: rand(14, 22), buoy: rand(3, 6), raise: rand(30, 46), blind: rand(26, 40), slick: 0.5 }
      : { weed: rand(7, 9), frigates: rand(8, 12), birds: rand(18, 26), debris: rand(4, 7), buoy: 1.2, blind: rand(22, 34) };
    this.edgeAt = !hump && this.len >= 60 ? [this.len * 0.5] : [];
    // the sea itself
    this.scroll = 0; this.crests = []; this.clouds = []; this.glints = [];
    const nC = this.glass ? 26 : this.breezy ? 92 : 60;
    for (let i = 0; i < nC; i++) this.crests.push(this.newCrest(true));
    for (let i = 0; i < (this.glass ? 2 : 3); i++) this.clouds.push({ x: rand(-300, 1300), y: rand(40, 480), s: rand(0.9, 1.7), sp: rand(6, 20) });
    for (let i = 0; i < (this.glass ? 70 : this.breezy ? 34 : 50); i++) this.glints.push({ ph: rand(0, TAU), sp: rand(2.2, 4.6), s: rand(1.4, 3.2) });
    // something on the water right away
    if (hump) { this.spawnFeature('rip', Game.W * 0.55); this.spawnFeature('slick', Game.W * 0.3); }
    else this.spawnFeature('weed', Game.W * 0.62);
  }
  enter() {
    SFX.setAmbient(1, false); Music.play('boat');
    Game.toast(this.spotName, { color: PAL.coral, size: 46, y: 200, sub: this.variant === 'hump' ? 'Find the bait and the birds. Drag to steer.' : 'Read the signs: weed, birds, debris. Drag to steer.' });
  }
  exit() { SFX.setAmbient(0); }
  boatX() { return Math.max(Game.W * 0.42, 352); } // far enough right that the shotgun stays on screen at 720 wide
  pointerDown(p) { if (this.basePointerDown(p)) return; this.dragId = p.id; this.ty = clamp(p.y, 120, Game.H - 50); }
  pointerMove(p) { if (this.dragId === p.id) this.ty = clamp(p.y, 120, Game.H - 50); }
  pointerUp(p) { if (this.dragId === p.id) this.dragId = null; }
  lastChance() { return !!this.strike; }   // a strike at the buzzer still gets fought
  keyDown(c) { this.baseKeyDown(c); }
  yAtDist(d) {
    const h = this.hist; if (d <= h[0].d) return h[0].y;
    for (let i = h.length - 1; i > 0; i--) if (h[i - 1].d <= d) { const a = h[i - 1], b = h[i]; return lerp(a.y, b.y, clamp((d - a.d) / Math.max(0.001, b.d - a.d), 0, 1)); }
    return h[h.length - 1].y;
  }
  newCrest(init) {
    const W = Game.W, H = Game.H;
    return { x: rand(-20, W + 40), y: rand(64, H + 10), l: rand(9, 22) * (this.glass ? 1.6 : this.breezy ? 1.25 : 1), ph: init ? rand(0, 1) : 0, sp: rand(0.25, 0.55), cap: this.breezy && chance(0.3) };
  }
  // a y for something new that keeps clear of what's already coming up on the right
  freeY(lo, hi) {
    const W = Game.W; let best = rand(lo, hi), bd = -1;
    for (let i = 0; i < 7; i++) {
      const y = rand(lo, hi); let d = 1e9;
      for (const f of this.features) if (f.y != null && f.x + (f.ext || 60) > W - 120 && !f.wide) d = Math.min(d, Math.abs(f.y - y));
      if (d > bd) { bd = d; best = y; }
    }
    return best;
  }
  linePt(f, s) {
    const ca = Math.cos(f.ang), sa = Math.sin(f.ang), w = f.type === 'rip' ? Math.sin(s * 0.012 + f.ph) * 16 : 0;
    return { x: f.x + s * ca - w * sa, y: f.y + s * sa + w * ca };
  }
  lineYAt(f, x) { return this.linePt(f, clamp((x - f.x) / Math.cos(f.ang), 0, f.len)).y; }
  anchorOf(f) {
    if (f.type === 'weed' || f.type === 'rip') {
      const x = clamp(Math.max(f.x + 40, this.boatX() + 90), -50, Math.min(f.x + f.len * Math.cos(f.ang) - 30, Game.W - 110));
      return { x, y: this.lineYAt(f, x) };
    }
    return { x: f.x, y: f.y };
  }

  /* ---------- what's out there ---------- */
  spawnFeature(type, x) {
    x = x == null ? Game.W + 140 : x;
    switch (type) {
      case 'weed': return this.spawnWeed(x);
      case 'frigates': return this.spawnFrigates(x);
      case 'birds': case 'pile': return this.spawnBirds(x);
      case 'debris': return this.spawnDebris(x);
      case 'log': return this.spawnDebris(x, 'log');
      case 'buoy': return this.spawnBuoy(x);
      case 'bait': return this.spawnBait(x);
      case 'rip': return this.spawnRip(x);
      case 'edge': return this.spawnEdge(x);
      case 'slick': { const f = { type: 'slick', x, y: rand(130, Game.H - 50), r: rand(30, 60), grow: rand(3, 7), t: 0, life: rand(8, 14), ext: 120, wide: true }; this.features.push(f); return f; }
    }
    return null;
  }
  spawnFish(key, x, y, feat, o = {}) {
    if (!SPECIES[key] || (this.allowed.size && !this.allowed.has(key))) return null;
    let w = rollWeight(key, this.perks);
    if (o.big) w = Math.max(w, rollWeight(key, this.perks));
    if (o.maxW) w = Math.max(SPECIES[key].min, Math.round(Math.min(w, rand(o.maxW * 0.45, o.maxW)) * 10) / 10);
    const n = sizeNorm(key, w), B = TROLL_FISH[key] || TROLL_FISH.mahi;
    const fi = {
      key, w, n, B, x, y, len: (38 + 64 * n) * B.size, t: rand(0, 5), ph: rand(0, TAU), state: 'idle', feat: feat || null,
      ox: feat ? x - feat.x : 0, oy: feat ? y - feat.y : 0, wr: rand(6, 16), wf: rand(0.35, 0.7), vx: 0, vy: 0, hd: feat && feat.fishHd != null ? feat.fishHd + rand(-0.5, 0.5) : rand(0, TAU),
      cool: 0, tries: 0, alpha: 0, lit: 0, down: false, school: !!o.school, free: !feat
    };
    if (key === 'tripletail') { fi.wr = rand(2, 5); fi.wf = rand(0.15, 0.3); } // lying on its side, barely moving
    this.fish.push(fi); return fi;
  }
  weedSpot(f, under, off) { // a point along the weed, just off its edge unless under it
    const c = pick(f.clumps), side = chance(0.5) ? 1 : -1;
    const lx = c.x, ly = c.y + (under ? rand(-5, 5) : side * (f.halfW + rand(12, off || 30)));
    const ca = Math.cos(f.ang), sa = Math.sin(f.ang);
    return { x: f.x + lx * ca - ly * sa, y: f.y + lx * sa + ly * ca };
  }
  spawnWeed(x, kind) {
    const H = Game.H, hump = this.variant === 'hump';
    kind = kind || (hump ? 'scatter' : trollPickW([['scatter', 4], ['line', 4.5], ['mat', 1.5]]));
    const len = kind === 'mat' ? rand(170, 250) : kind === 'line' ? rand(480, 820) : rand(240, 420);
    const f = { type: 'weed', kind, x, y: this.freeY(145, H - 60), len, ang: kind === 'mat' ? rand(-0.4, 0.4) : rand(-0.22, 0.22), t: 0, ext: len + 40, clumps: [], fishHd: rand(0, TAU), sign: kind === 'scatter' ? null : 'weed' };
    f.halfW = kind === 'line' ? 14 : kind === 'mat' ? 30 : 8;
    const ph = rand(0, TAU);
    if (kind === 'line') { for (let s = 0; s < len; s += rand(8, 18)) f.clumps.push({ x: s, y: Math.sin(s * 0.018 + ph) * 12 + rand(-5, 5), r: rand(4, 11) * (0.55 + 0.45 * Math.sin(Math.PI * s / len)) + 2.5 }); }
    else if (kind === 'mat') { const n = Math.round(len * 0.32); for (let i = 0; i < n; i++) { const a = rand(0, TAU), q = Math.sqrt(Math.random()); f.clumps.push({ x: len / 2 + Math.cos(a) * q * len / 2, y: Math.sin(a) * q * 30, r: rand(5, 12) }); } }
    else { for (let s = 0; s < len; s += rand(24, 56)) { const m = randi(1, 3); for (let j = 0; j < m; j++) f.clumps.push({ x: s + rand(-8, 8), y: Math.sin(s * 0.01 + ph) * 18 + rand(-12, 12), r: rand(3, 7) }); } }
    f.spr = this.weedSprite(f);
    this.features.push(f);
    // most weed is empty water: only some of it holds fish
    const pMahi = kind === 'mat' ? 0.45 : kind === 'line' ? 0.25 : hump ? 0.3 : 0.06;
    if (chance(pMahi)) {
      const n = kind === 'scatter' ? randi(1, 2) : randi(2, 3); let first = null;
      for (let i = 0; i < n; i++) { const p = this.weedSpot(f, false); const fi = this.spawnFish('mahi', p.x, p.y, f, kind === 'mat' && i === 0 ? { big: true } : { maxW: 18 }); first = first || fi; }
      f.holds = true;
      if (first && !hump && chance(0.5)) this.spawnFrigatesOver(first.x, first.y, f);
    }
    if (kind !== 'scatter' && chance(0.1)) { const p = this.weedSpot(f, true); this.spawnFish('tripletail', p.x, p.y, f); }
    if (kind === 'line' && chance(0.06)) { const p = this.weedSpot(f, false, 60); this.spawnFish('wahoo', p.x, p.y, f); }
    return f;
  }
  // render a weedline once into its own little canvas: a slick, shadow, lobed golden clumps on stems, bladders
  weedSprite(f) {
    const k = 1.5, pad = 26, rng = mulberry(Math.floor(f.len * 7 + f.clumps.length * 13));
    let minY = 0, maxY = 0;
    for (const c of f.clumps) {
      minY = Math.min(minY, c.y - c.r * 1.2); maxY = Math.max(maxY, c.y + c.r * 1.2);
      c.lobes = [{ dx: 0, dy: 0, r: c.r * 0.62 }];
      for (let i = 2 + Math.floor(rng() * 4); i > 0; i--) { const a = rng() * TAU, q = c.r * (0.35 + rng() * 0.4); c.lobes.push({ dx: Math.cos(a) * q, dy: Math.sin(a) * q * 0.75, r: c.r * (0.32 + rng() * 0.3), a }); }
    }
    const w = f.len + pad * 2, h = maxY - minY + pad * 2;
    const cv = document.createElement('canvas'); cv.width = Math.ceil(w * k); cv.height = Math.ceil(h * k);
    const g = cv.getContext('2d'); g.scale(k, k); g.translate(pad, pad - minY);
    const lobes = (fill, grow, dx, dy, whole) => {
      g.fillStyle = fill; g.beginPath();
      for (const c of f.clumps) {
        if (whole) { const r = c.r * grow; g.moveTo(c.x + dx + r, c.y + dy); g.ellipse(c.x + dx, c.y + dy, r, r * 0.75, 0, 0, TAU); continue; }
        for (const l of c.lobes) { const r = l.r * grow, x = c.x + l.dx + dx, y = c.y + l.dy + dy; g.moveTo(x + r, y); g.ellipse(x, y, r, r * 0.8, l.a || 0, 0, TAU); }
      }
      g.fill();
    };
    lobes('rgba(150,205,235,0.09)', 2.3, 0, 0, true);       // the calm slick the weed collects on
    // stems tying the clumps together
    g.strokeStyle = 'rgba(120,82,22,0.75)'; g.lineWidth = 1.4; g.lineCap = 'round'; g.beginPath();
    const cl = f.clumps.slice().sort((p, q) => p.x - q.x);
    for (let i = 1; i < cl.length; i++) { const p = cl[i - 1], q = cl[i]; if (q.x - p.x > 40 || Math.abs(q.y - p.y) > 26) continue; g.moveTo(p.x, p.y); g.quadraticCurveTo((p.x + q.x) / 2, (p.y + q.y) / 2 + (rng() - 0.5) * 8, q.x, q.y); }
    g.stroke();
    lobes('rgba(4,24,44,0.32)', 1.08, 2.5, 3.5);             // shadow on the water
    lobes('#9c6a1c', 1, 0, 0);
    lobes('#c98f2e', 0.8, -0.7, -0.8);
    lobes('#e6b84e', 0.45, -1.4, -1.5);
    // air bladders and frilly leaf tips
    g.fillStyle = '#f2d27c';
    for (const c of f.clumps) for (let i = 0; i < 3; i++) { const a = rng() * TAU, q = rng() * c.r * 0.85; g.beginPath(); g.arc(c.x + Math.cos(a) * q, c.y + Math.sin(a) * q * 0.7, 1 + rng() * 0.7, 0, TAU); g.fill(); }
    g.strokeStyle = 'rgba(214,160,58,0.9)'; g.lineWidth = 1.1; g.beginPath();
    for (const c of f.clumps) for (let i = 0; i < 2; i++) { if (rng() < 0.4) continue; const a = rng() * TAU, r0 = c.r * 0.8, r1 = c.r + 3 + rng() * 3; g.moveTo(c.x + Math.cos(a) * r0, c.y + Math.sin(a) * r0 * 0.7); g.quadraticCurveTo(c.x + Math.cos(a + 0.3) * r1, c.y + Math.sin(a + 0.3) * r1 * 0.7, c.x + Math.cos(a + 0.12) * (r1 + 2), c.y + Math.sin(a + 0.12) * (r1 + 2) * 0.7); }
    g.stroke();
    return { cv, ox: -pad, oy: minY - pad, w, h };
  }
  birdFeature(type, x, y, nFrig) {
    const f = { type, x, y, t: 0, ext: 130, birds: [], sign: type };
    for (let i = 0; i < nFrig; i++) f.birds.push({ a: rand(0, TAU), r: rand(40, 90), sp: rand(0.35, 0.6) * (chance(0.5) ? 1 : -1), h: rand(0.85, 1.25), ph: rand(0, TAU) });
    this.features.push(f); return f;
  }
  spawnFrigatesOver(x, y, host) { const f = this.birdFeature('frigates', x, y, randi(1, 3)); f.host = host; return f; }
  // a school of mahi roaming open water with frigates riding along above them
  spawnFrigates(x) {
    const f = this.birdFeature('frigates', x, this.freeY(150, Game.H - 70), randi(1, 3));
    f.spd = 18; f.vx = rand(-18, 18); f.vy = rand(-12, 12); f.turnT = rand(2, 4); f.holds = true;
    const n = randi(2, 3); for (let i = 0; i < n; i++) this.spawnFish('mahi', f.x + rand(-40, 40), f.y + rand(-22, 22), f, i ? { maxW: 22 } : {});
    return f;
  }
  // tuna (or bonita) blitzing bait with terns diving on it; the school comes up and goes back down
  spawnBirds(x) {
    const hump = this.variant === 'hump';
    const f = this.birdFeature('birds', x, this.freeY(150, Game.H - 70), hump ? randi(1, 2) : 0);
    Object.assign(f, { kind: hump ? 'pile' : 'terns', sign: hump ? 'pile' : 'terns', spd: hump ? 38 : 34, vx: rand(-40, 40), vy: rand(-30, 30), turnT: rand(1.5, 3), up: true, cycle: rand(6, 9), bustT: 0.3, school: true, terns: [], holds: true });
    this.addTerns(f, hump ? randi(7, 10) : randi(4, 6));
    let key = 'blackfin', n = randi(2, 3), big = false;
    if (hump) { if (chance(0.16)) { key = 'yellowfin'; n = randi(1, 2); big = true; } else n = randi(2, 4); }
    else if (chance(0.7)) { key = 'bonita'; n = randi(2, 4); }
    for (let i = 0; i < n; i++) this.spawnFish(key, f.x + rand(-40, 40), f.y + rand(-22, 22), f, { school: true, big });
    return f;
  }
  addTerns(f, n) {
    f.terns = f.terns || [];
    for (let i = 0; i < n; i++) { const r = rand(18, 66); f.terns.push({ a: rand(0, TAU), r, r0: r, sp: rand(1.1, 2) * (chance(0.5) ? 1 : -1), dive: 0, diveT: rand(0.2, 2), dx: 0, dy: 0, px: f.x, py: f.y, ang: 0, sc: 1, ph: rand(0, TAU) }); }
  }
  spawnDebris(x, kind) {
    const hump = this.variant === 'hump';
    kind = kind || trollPickW([['log', 4], ['pallet', 3], ['plank', 1.5], ['cooler', 1.5]]);
    const f = { type: 'debris', kind, x, y: this.freeY(145, Game.H - 60), rot: rand(-0.8, 0.8), t: rand(0, 5), ext: 70, fishHd: rand(0, TAU), sign: 'debris' };
    if (kind === 'log') { f.L = rand(76, 112); f.r = rand(7, 10); }
    this.features.push(f);
    // a lone object out here is worth a look: a bull mahi, a tripletail, sometimes a wahoo, often nothing
    const r = Math.random();
    if (r < 0.38) {
      this.spawnFish('mahi', f.x + rand(-40, 40), f.y + rand(-34, 34), f, { big: true }); f.holds = true;
      if (chance(0.3)) this.spawnFish('mahi', f.x + rand(-40, 40), f.y + rand(-34, 34), f, { maxW: 20 });
      if (!hump && chance(0.35)) this.spawnFrigatesOver(f.x, f.y, f);
    } else if (r < 0.6) { const a = rand(0, TAU); if (this.spawnFish('tripletail', f.x + Math.cos(a) * rand(26, 34), f.y + Math.sin(a) * rand(18, 26), f)) f.holds = true; }
    else if (r < 0.68) { if (this.spawnFish('wahoo', f.x + rand(-60, 60), f.y + rand(-50, 50), f)) f.holds = true; }
    return f;
  }
  spawnBuoy(x) {
    const f = { type: 'buoy', x, y: rand(130, Game.H - 50), t: rand(0, 5), ext: 50, sign: 'buoy',
      color: pick(['#ff6a3d', '#ffffff', '#ffd23a', '#7be36a', '#ff4fa0']), stripe: pick(['#1b3f8a', '#e03a3a', '#111111']),
      tag: chance(0.3) ? { dx: rand(16, 26), dy: rand(-8, 8) } : null };
    this.features.push(f);
    // tripletail lie on their sides under trap floats, invisible until you're right on them
    if (this.variant === 'weed' && chance(0.12) && this.spawnFish('tripletail', f.x + rand(-5, 5), f.y + rand(8, 14), f)) f.holds = true;
    return f;
  }
  spawnBait(x) {
    const f = { type: 'bait', x, y: this.freeY(150, Game.H - 70), t: 0, ext: 90, spd: 22, vx: rand(-20, 20), vy: rand(-14, 14), turnT: rand(2, 4), r: rand(24, 36), dots: [], birds: [], up: false, sign: 'bait' };
    for (let i = 0; i < 46; i++) f.dots.push({ a: rand(0, TAU), q: Math.sqrt(Math.random()), sp: rand(0.4, 1.1) * (chance(0.5) ? 1 : -1), ph: rand(0, TAU) });
    this.features.push(f);
    if (chance(0.55)) { // tuna underneath: they push it up and the terns find it
      Object.assign(f, { school: true, up: true, cycle: rand(5, 8), bustT: 0.4, holds: true });
      this.addTerns(f, randi(2, 4));
      if (chance(0.12)) this.spawnFish('yellowfin', f.x + rand(-30, 30), f.y + rand(-24, 24), f, { school: true, big: true });
      else for (let i = randi(1, 3); i > 0; i--) this.spawnFish('blackfin', f.x + rand(-35, 35), f.y + rand(-28, 28), f, { school: true });
    }
    if (chance(0.18) && this.spawnFish('amberjack', f.x + rand(-30, 30), f.y + rand(-25, 25), f)) f.holds = true;
    if (chance(0.1)) { const fi = this.spawnFish('sailfish', f.x + rand(-40, 40), f.y + rand(-30, 30), f); if (fi) { fi.fin = true; f.holds = true; } }
    return f;
  }
  // the current hits the hump and rips up: a long line of standing chop with greener upwelled water on one side
  spawnRip(x) {
    const len = rand(1000, 1400);
    const f = { type: 'rip', x, y: this.freeY(170, Game.H - 100), len, ang: rand(-0.2, 0.2), ph: rand(0, TAU), side: chance(0.5) ? 1 : -1, wid: rand(170, 260), t: 0, ext: len + 80, sign: 'rip', wide: true };
    this.features.push(f);
    const along = (key) => { const s = rand(len * 0.1, len * 0.9), p = this.linePt(f, s), off = f.side * rand(6, 34); const fi = this.spawnFish(key, p.x - Math.sin(f.ang) * off, p.y + Math.cos(f.ang) * off, f); if (fi) { fi.nervous = true; f.holds = true; } return fi; };
    if (chance(0.45)) along('wahoo');
    if (chance(0.42)) for (let i = randi(1, 2); i > 0; i--) along('blackfin');
    if (chance(0.3)) along('amberjack');
    if (chance(0.08)) { const fi = along('sailfish'); if (fi) fi.fin = true; }
    return f;
  }
  // weedline variant: the color change where green water meets the cobalt Gulf Stream
  spawnEdge(x) {
    const f = { type: 'edge', x, y: Game.H / 2, slope: rand(-0.15, 0.15), ph: rand(0, TAU), t: 0, len: 900, ext: 980, wide: true };
    this.features.push(f);
    const at = (key) => this.spawnFish(key, x + rand(60, 760), rand(160, Game.H - 80), f);
    if (chance(0.4)) at('wahoo');
    if (chance(0.3)) { const fi = at('sailfish'); if (fi && chance(0.7)) fi.fin = true; }
    if (chance(0.25)) at('kingfish');
    if (chance(0.2)) at('blackfin');
    if (chance(0.05)) { const fi = at('bluemarlin'); if (fi) fi.fin = chance(0.6); }
    Game.toast('Blue water edge ahead', { color: '#9fd8ff', size: 28, y: 110, sub: 'Wahoo and sailfish cruise the color change' });
    return f;
  }
  // out of nowhere: a fish comes up on a lure in open water
  blindStrike() {
    const hump = this.variant === 'hump';
    if (this.strike || !chance(0.24)) return;
    const open = this.lures.filter((l) => !l.fouled); if (!open.length) return;
    const table = (hump ? [['wahoo', 5], ['blackfin', 3], ['amberjack', 2]] : [['bonita', 3], ['kingfish', 3], ['barracuda', 2.5], ['wahoo', 1.5]]).filter((r) => !this.allowed.size || this.allowed.has(r[0]));
    const key = trollPickW(table); if (!key) return;
    const L = pick(open), a = rand(Math.PI * 0.65, Math.PI * 1.35);
    const fi = this.spawnFish(key, L.x + Math.cos(a) * 120, L.y + Math.sin(a) * 90, null); if (!fi) return;
    fi.hd = a + Math.PI; fi.blind = true; this.startChase(fi, L, rand(2, 2.8));
  }
  // a billfish shows up behind the spread, lit up, and makes up its mind
  raiseBill() {
    if (this.strike || !chance(0.45)) return;
    const open = this.lures.filter((l) => !l.fouled); if (!open.length) return;
    const key = chance(0.8) ? 'sailfish' : 'bluemarlin', L = pick(open);
    const fi = this.spawnFish(key, L.x - 150, L.y + rand(-40, 40), null); if (!fi) return;
    fi.state = 'raise'; fi.lure = L; fi.raiseT = rand(2.2, 3.4); fi.hd = 0;
    Game.toast(key === 'sailfish' ? 'Sailfish in the spread!' : 'Blue marlin in the spread!', { color: '#9fd8ff', size: 30, y: 116 });
    SFX.play('warn');
  }
  startChase(fi, L, time) { fi.state = 'chase'; fi.lure = L; fi.chase = time; fi.chaseT = 0; if (fi.x > -40 && fi.x < Game.W + 40) SFX.play('nibble'); }
  spawnFlyers(x, y, n) {
    for (let i = 0; i < n; i++) { const a = rand(0, TAU), s = rand(160, 250); this.flyers.push({ x: x + rand(-8, 8), y: y + rand(-8, 8), vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6, t: 0, life: rand(0.7, 1.4), s: rand(0.8, 1.1) }); }
  }
  // spray that sits in the water (drifts back with it), not on the screen
  wsplash(x, y, n, o = {}) {
    const v = this.speed;
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), s = rand(o.min || 30, o.max || 110);
      this.parts.add({ x, y, vx: Math.cos(a) * s - v, vy: Math.sin(a) * s * 0.8, life: rand((o.life || 0.5) * 0.6, o.life || 0.5), size: rand(o.sMin || 1.2, o.sMax || 2.8), color: o.color || (chance(0.5) ? '#ffffff' : '#dff3ff') });
    }
    if (o.ring) this.parts.add({ kind: 'ring', x, y, vx: -v, size: o.ring, grow: o.grow || 40, life: o.ringLife || 0.6, color: 'rgba(255,255,255,0.55)', lw: 1.6, flat: 0.75 });
  }
  // tuna crash the bait at the surface
  bust(f) {
    const m = this.fish.filter((fi) => fi.feat === f && fi.school && fi.state === 'idle');
    const p = m.length ? pick(m) : { x: f.x + rand(-30, 30), y: f.y + rand(-25, 25) };
    if (p.x < -40 || p.x > Game.W + 40) return;
    this.parts.add({ x: p.x, y: p.y, vx: -this.speed, life: 0.8, size: rand(7, 12), alpha: 0.4, color: '#ffffff' });
    this.wsplash(p.x, p.y, 12, { min: 30, max: 120, life: 0.55, ring: 5, grow: 46 });
    this.wsplash(p.x + rand(-12, 12), p.y + rand(-12, 12), 7, { min: 60, max: 150, life: 0.4, sMin: 0.9, sMax: 1.6, color: '#c9dbe6' });
    if (p.x > -20 && p.x < Game.W + 20 && chance(0.25)) SFX.play('plop');
  }

  onFightDone(r) {
    const s = this.lastStrike; this.lastStrike = null;
    if (!s || !r.ok || !r.catch) return;
    const f = s.feat;
    if (s.key === 'mahi' && f && !f.dead) {
      // keep one in the water and the school follows it to the boat
      const mates = this.fish.filter((fi) => fi.feat === f && fi.key === 'mahi' && fi.state === 'idle' && !fi.wary);
      if (mates.length && chance(0.5)) {
        for (const fi of mates.slice(0, randi(1, 2))) { const L = pick(this.lures); fi.feat = null; fi.free = true; fi.follow = rand(4, 6); fi.x = L.x + rand(30, 110); fi.y = L.y + rand(-50, 50); fi.cool = 0.6; }
        Game.toast('The school followed it up!', { color: '#bff46a', size: 28, y: 120, sub: 'Get a bait back in front of them' });
      }
    } else if (f && f.school) { f.up = false; f.cycle = rand(3.5, 6); } // the rest of the tuna sound
  }

  update(dt) {
    if (this.baseUpdate(dt)) { SFX.setEngine(this.paused ? 0 : 1, 0.05); SFX.setHull(0); return; }
    const W = Game.W, H = Game.H;
    if (Input.held('ArrowUp', 'KeyW')) this.ty = clamp(this.ty - 230 * dt, 120, H - 50);
    if (Input.held('ArrowDown', 'KeyS')) this.ty = clamp(this.ty + 230 * dt, 120, H - 50);
    if (this.stall > 0) { this.stall -= dt; this.speed = approach(this.speed, 0, 6, dt); } else this.speed = approach(this.speed, 150, 2, dt);
    const v = this.speed;
    SFX.setEngine(1, 0.12 + v / 1200); SFX.setHull(0.22 * v / 150);   // outboards at trolling speed, water past the hull
    const dy = clamp(this.ty - this.by, -220 * dt, 220 * dt); this.bvy = dy / Math.max(dt, 1e-4); this.by += dy;
    this.trav += v * dt;
    const last = this.hist[this.hist.length - 1];
    if (this.trav - last.d >= 2) { this.hist.push({ d: this.trav, y: this.by }); if (this.hist.length > 420) this.hist.shift(); } else last.y = this.by;
    // the sea moves past
    this.scroll += v * dt;
    for (const c of this.crests) { c.x -= v * dt; c.ph += dt * c.sp; if (c.ph >= 1 || c.x < -40) Object.assign(c, this.newCrest(false)); }
    for (const c of this.clouds) { c.x -= (v + c.sp) * dt; if (c.x < -480) { c.x = W + rand(60, 500); c.y = rand(40, 480); c.s = rand(0.9, 1.7); } }
    // lures trail the boat's path, smoking bubbles
    const bx = this.boatX();
    for (const L of this.lures) {
      L.x = bx - L.Ld; L.y = this.yAtDist(this.trav - L.Ld) + L.off; L.fouled = Math.max(0, L.fouled - dt);
      if (!L.fouled && chance(dt * 8)) this.parts.add({ x: L.x - 7, y: L.y + rand(-2, 2), vx: -v * 0.85, vy: rand(-6, 6), life: rand(0.4, 0.7), size: rand(1.1, 2.3), color: 'rgba(235,250,255,0.75)' });
    }
    if (v > 90 && chance(dt * 16)) { const sd = chance(0.5) ? 1 : -1; this.parts.add({ x: bx + 52, y: this.by + sd * 20, vx: -v * 0.5, vy: sd * rand(30, 70), life: rand(0.25, 0.45), size: rand(1.2, 2.4), color: '#ffffff' }); }
    // spawn what's coming up, by distance run
    const k = dt * (v / 150);
    for (const key of Object.keys(this.timers)) this.timers[key] -= k;
    const T = this.timers;
    if (this.variant === 'hump') {
      if (T.rip <= 0) { this.spawnFeature('rip'); T.rip = rand(34, 46); }
      if (T.bait <= 0) { this.spawnFeature('bait'); T.bait = rand(12, 17); }
      if (T.birds <= 0) { this.spawnFeature('birds'); T.birds = rand(24, 34); }
      if (T.weed <= 0) { this.spawnFeature('weed'); T.weed = rand(18, 28); }
      if (T.buoy <= 0) { this.spawnFeature('buoy'); T.buoy = rand(5, 8); }
      if (T.raise <= 0) { this.raiseBill(); T.raise = rand(30, 46); }
      if (T.blind <= 0) { this.blindStrike(); T.blind = rand(30, 44); }
      if (T.slick <= 0) { this.spawnFeature('slick', W + rand(40, 120)); T.slick = rand(3, 6); }
    } else {
      if (T.weed <= 0) { this.spawnFeature('weed'); T.weed = rand(8, 12); }
      if (T.frigates <= 0) { this.spawnFeature('frigates'); T.frigates = rand(30, 40); }
      if (T.birds <= 0) { this.spawnFeature('birds'); T.birds = rand(34, 46); }
      if (T.debris <= 0) { this.spawnFeature('debris'); T.debris = rand(17, 24); }
      if (T.buoy <= 0) { this.spawnFeature('buoy'); T.buoy = rand(2.4, 4.2); }
      if (T.blind <= 0) { this.blindStrike(); T.blind = rand(28, 42); }
      if (this.edgeAt.length && this.timeLeft < this.edgeAt[0]) { this.edgeAt.shift(); this.spawnFeature('edge'); }
    }
    this.updateFeatures(dt, v, bx);
    this.updateFish(dt, v, bx);
    for (const fl of this.flyers) { fl.t += dt; fl.x += (fl.vx - v) * dt; fl.y += fl.vy * dt; if (fl.t >= fl.life) { fl.done = true; this.wsplash(fl.x, fl.y, 4, { min: 15, max: 50, life: 0.35 }); } }
    this.flyers = this.flyers.filter((fl) => !fl.done);
    if (v > 100 && chance(dt * 0.05)) this.spawnFlyers(bx + 110, this.by + rand(-30, 30), randi(1, 3)); // the boat flushes a few
    // teach each sign the first time it shows
    if (this.hint) { this.hint.t += dt; if (this.hint.t > this.hint.dur) this.hint = null; }
    if (!this.hint && this.t > 3.5) for (const f of this.features) {
      if (!f.sign || this.taught.has(f.sign)) continue;
      const a = this.anchorOf(f);
      if (a.x < W - 70 && a.x > bx - 20) { this.taught.add(f.sign); this.hint = { f, text: TROLL_HINTS[f.sign], t: 0, dur: 3.4 }; break; }
    }
    for (const f of this.features) if (f.x + (f.ext || 120) < -220 || (f.type === 'slick' && f.t > f.life)) f.dead = true;
    this.features = this.features.filter((f) => !f.dead);
    this.fish = this.fish.filter((fi) => fi.x > -180 && fi.state !== 'gone');
    if (this.strike) {
      this.strike.t -= dt;
      if (this.strike.t <= 0) { const s = this.strike; this.strike = null; this.startFight({ sp: s.fish.key, weight: s.fish.w, ctxType: 'offshore' }); }
    }
    SFX.setDrag(this.strike ? 1 : 0, 1);
  }
  updateFeatures(dt, v, bx) {
    const W = Game.W, H = Game.H, t = this.t;
    for (const f of this.features) {
      const px = f.x, py = f.y; f.t += dt;
      f.x -= v * dt;
      if (f.spd) { // schools and bait wander around in the water
        f.turnT -= dt; if (f.turnT <= 0) { f.turnT = rand(1.5, 3.5); const a = rand(0, TAU); f.vx = Math.cos(a) * f.spd; f.vy = Math.sin(a) * f.spd * 0.7; }
        f.x += f.vx * dt; f.y += f.vy * dt;
        if (f.y < 160) f.vy = Math.abs(f.vy); if (f.y > H - 80) f.vy = -Math.abs(f.vy);
      }
      f.dx = f.x - px; f.dy = f.y - py;
      const onScreen = f.x > -80 && f.x < W + 80;
      if (f.school) {
        f.cycle -= dt; if (f.cycle <= 0) { f.up = !f.up; f.cycle = f.up ? rand(5, 8) : rand(3.5, 6); }
        if (f.up) { f.bustT -= dt; if (f.bustT <= 0) { f.bustT = rand(0.25, 0.7); if (onScreen) this.bust(f); } }
      }
      if (f.birds) for (const b of f.birds) b.a += dt * b.sp * (f.school && !f.up ? 0.7 : 1);
      if (f.terns) for (const b of f.terns) {
        b.a += dt * b.sp; b.r = approach(b.r, !f.school || f.up ? b.r0 : b.r0 * 1.8, 1.5, dt);
        const cx = f.x + Math.cos(b.a) * b.r, cy = f.y + Math.sin(b.a) * b.r * 0.7, s = Math.sign(b.sp) || 1;
        b.ang = Math.atan2(Math.cos(b.a) * 0.7 * s, -Math.sin(b.a) * s);
        if (b.dive > 0) {
          const before = b.dive; b.dive += dt / 0.9;
          if (before < 0.55 && b.dive >= 0.55 && onScreen) this.wsplash(f.x + b.dx, f.y + b.dy, 6, { min: 20, max: 70, life: 0.4, ring: 3, grow: 28 });
          if (b.dive >= 1) { b.dive = 0; b.diveT = rand(0.5, 2.2); }
        } else if (f.up) { b.diveT -= dt; if (b.diveT <= 0) { b.dive = 0.001; b.dx = rand(-36, 36); b.dy = rand(-28, 28); } }
        const kd = b.dive > 0 ? easeInOut(b.dive < 0.55 ? b.dive / 0.55 : 1 - (b.dive - 0.55) / 0.45) : 0;
        b.px = lerp(cx, f.x + b.dx, kd); b.py = lerp(cy, f.y + b.dy, kd); b.sc = 1 - 0.5 * kd; b.open = 1 - 0.85 * kd;
      }
      if (f.type === 'slick') f.r += f.grow * dt;
      else if (f.type === 'buoy') {
        if (!f.hit && dist(f.x, f.y, bx + 20, this.by) < 26) { f.hit = true; this.stall = 2.5; Game.toast('Wrapped a trap line!', { color: PAL.warn, size: 32, y: 130, sub: 'Cutting it out of the prop… (stalled)' }); SFX.play('fail'); Game.shake(5); }
        for (const L of this.lures) if (!L.fouled && dist(f.x, f.y, L.x, L.y) < 15) { L.fouled = 3.5; Game.toast('Lure fouled on a trap line', { color: PAL.warn, size: 26, y: 130 }); SFX.play('warn'); }
      } else if (f.type === 'weed') {
        const ca = Math.cos(f.ang), sa = Math.sin(f.ang);
        for (const L of this.lures) {
          if (L.fouled || L.weedCd > t) continue;
          const rx = (L.x - f.x) * ca + (L.y - f.y) * sa, ry = -(L.x - f.x) * sa + (L.y - f.y) * ca;
          if (rx < -16 || rx > f.len + 16 || Math.abs(ry) > 60) continue;
          if (f.clumps.some((c) => Math.abs(c.x - rx) < c.r + 3 && Math.abs(c.y - ry) < c.r * 0.72 + 3)) {
            L.weedCd = t + 3;
            if (chance(0.25)) { L.fouled = 2; this.fl.add(L.x, L.y - 20, 'weed on it', '#e8d27a', 16); }
          }
        }
        if (f.holds && onScreen && chance(dt * 0.3)) {
          const p = this.weedSpot(f, false); this.spawnFlyers(p.x, p.y, randi(1, 3));
          if (!this.taught.has('flyers') && p.x > 60 && p.x < W - 60) { this.taught.add('flyers'); this.fl.add(p.x, p.y - 26, 'Flying fish: mahi feeding', '#bff46a', 17); }
        }
      } else if (f.type === 'frigates' && f.spd && onScreen && chance(dt * 0.25)) this.spawnFlyers(f.x + rand(-30, 30), f.y + rand(-20, 20), randi(1, 2));
    }
  }
  fishVis(fi, bx) {
    if (fi.hide) return 0;
    if (fi.state === 'chase' || fi.state === 'raise') return 1;
    if (fi.down) return 0;
    let d = dist(fi.x, fi.y, bx, this.by);
    for (const L of this.lures) d = Math.min(d, dist(fi.x, fi.y, L.x, L.y) * 1.2);
    const R = this.visR * fi.B.vis * (0.8 + 0.4 * fi.n);
    let a = clamp((R - d) / (R * 0.5), 0, 1) * this.visMax;
    if (fi.school && fi.feat && fi.feat.up) a = Math.max(a, 0.24); // flashes of them crashing bait
    if (fi.fin) a = Math.max(a, 0.3);
    if (fi.follow > 0) a = Math.max(a, 0.5);
    return a;
  }
  updateFish(dt, v, bx) {
    const W = Game.W, bite = this.perks.bite || 1;
    for (const fi of this.fish) {
      fi.t += dt; fi.cool = Math.max(0, fi.cool - dt);
      if (fi.feat && fi.feat.dead) { fi.feat = null; fi.free = true; }
      const f = fi.feat, B = fi.B;
      fi.down = !!(f && fi.school && !f.up);
      if (fi.state === 'chase') {
        const L = fi.lure; fi.chase -= dt; fi.chaseT += dt;
        const ang = Math.atan2(L.y - fi.y, L.x - fi.x), sp = B.speed * (fi.blind && fi.chaseT < 0.7 ? 0.6 : 1);
        fi.vx = Math.cos(ang) * sp; fi.vy = Math.sin(ang) * sp; fi.x += fi.vx * dt; fi.y += fi.vy * dt;
        fi.hd += angleDiff(fi.hd, Math.atan2(fi.vy, fi.vx + v)) * Math.min(1, 10 * dt);
        if (!L.fouled && !this.strike && dist(fi.x, fi.y, L.x, L.y) < 22 && chance(dt * 3.6 * bite)) { this.doStrike(fi, L); continue; }
        if (fi.chase <= 0 || L.fouled) { fi.state = 'idle'; fi.vx = 0; fi.vy = 0; fi.cool = rand(2.5, 4); if (++fi.tries >= 3) fi.wary = true; }
      } else if (fi.state === 'raise') {
        const L = fi.lure; fi.raiseT -= dt;
        fi.x = approach(fi.x, L.x - 40 - fi.len * 0.35, 2.2, dt); fi.y = approach(fi.y, L.y + Math.sin(fi.t * 1.6) * 16, 2.5, dt);
        fi.hd += angleDiff(fi.hd, Math.sin(fi.t * 1.6) * 0.3) * Math.min(1, 4 * dt);
        if (fi.raiseT <= 0 || L.fouled) {
          if (!L.fouled && !this.strike && chance(0.55)) this.startChase(fi, L, 2.6);
          else { fi.state = 'idle'; fi.free = true; fi.wary = true; fi.hide = true; fi.vx = -60; }
        }
      } else {
        if (f && !fi.free) { // holding on its weed, debris or school
          fi.x += f.dx; fi.y += f.dy;
          const tx = f.x + fi.ox + Math.cos(fi.t * fi.wf + fi.ph) * fi.wr, ty = f.y + fi.oy + Math.sin(fi.t * fi.wf * 1.3 + fi.ph) * fi.wr * 0.6;
          const nx = approach(fi.x, tx, 1.6, dt), ny = approach(fi.y, ty, 1.6, dt);
          const wvx = (nx - fi.x) / Math.max(dt, 1e-4) + (f.vx || 0), wvy = (ny - fi.y) / Math.max(dt, 1e-4) + (f.vy || 0);
          fi.x = nx; fi.y = ny;
          if (wvx * wvx + wvy * wvy > 64) fi.hd += angleDiff(fi.hd, Math.atan2(wvy, wvx)) * Math.min(1, 2.5 * dt);
        } else if (fi.follow > 0) { // tagging along behind the boat
          fi.follow -= dt; fi.x += Math.sin(fi.t * 1.3 + fi.ph) * 14 * dt; fi.y += Math.cos(fi.t * 1.1 + fi.ph) * 12 * dt;
          fi.hd += angleDiff(fi.hd, 0) * Math.min(1, 3 * dt);
        } else {
          fi.x += (fi.vx - v) * dt; fi.y += fi.vy * dt;
          if (fi.vx * fi.vx + fi.vy * fi.vy > 64) fi.hd += angleDiff(fi.hd, Math.atan2(fi.vy, fi.vx)) * Math.min(1, 3 * dt);
        }
        if (!fi.cool && !fi.down && !fi.wary && !this.strike && fi.x < W + 20) {
          const reach = B.notice * (fi.school && f && f.up ? 1.15 : 1);
          for (const L of this.lures) {
            if (L.fouled) continue;
            const d = dist(fi.x, fi.y, L.x, L.y); if (d >= reach) continue;
            const q = 1 - d / reach;
            if (chance(dt * B.eager * bite * q * q)) { this.startChase(fi, L, rand(1.6, 2.6)); break; }
          }
        }
        // bait getting nervous around a predator on the rip
        if (fi.nervous && !fi.down && fi.x > 0 && fi.x < W && chance(dt * 0.4)) {
          this.wsplash(fi.x + rand(-18, 18), fi.y + rand(-14, 14), 5, { min: 40, max: 110, life: 0.35, sMin: 0.9, sMax: 1.5, color: '#cfe0ea' });
          if (!this.taught.has('nervous') && fi.x > 80 && fi.x < W - 80 && this.t > 4) { this.taught.add('nervous'); this.fl.add(fi.x, fi.y - 26, 'Bait spraying: something under it', '#cfe8ff', 17); }
        }
      }
      fi.y = clamp(fi.y, 100, Game.H - 24);
      const tgt = this.fishVis(fi, bx);
      fi.alpha = approach(fi.alpha, tgt, tgt > fi.alpha ? 5 : 2.5, dt);
      fi.lit = approach(fi.lit, fi.state === 'chase' || fi.state === 'raise' ? 1 : 0, fi.lit < 0.5 ? 8 : 2, dt);
      if (fi.key === 'tripletail' && !fi.seen && fi.alpha > 0.3) { fi.seen = true; this.fl.add(fi.x, fi.y - 28, 'Tripletail!', '#f0d98a', 18); }
    }
  }
  doStrike(fi, L) {
    fi.state = 'gone'; this.strikes++;
    this.strike = { fish: fi, lure: L, t: 0.75 }; this.lastStrike = { feat: fi.feat, key: fi.key };
    SFX.play('bigsplash'); Game.vibrate(90); Game.toast('STRIKE!', { color: PAL.sun, size: 52, y: 150, dur: 0.8, sub: 'The ' + L.name.toLowerCase() + ' got hit' });
    this.wsplash(L.x, L.y, 26, { min: 60, max: 220, life: 0.7, ring: 6, grow: 70 });
    L.fouled = 0.9;
  }

  /* ---------- drawing ---------- */
  draw(ctx) {
    if (this.drawChildOrNull(ctx)) return;
    const W = Game.W, H = Game.H, t = this.t, bx = this.boatX();
    this.drawSea(ctx, W, H, t);
    for (const f of this.features) if (f.type === 'edge') this.drawEdge(ctx, f, t); else if (f.type === 'rip') this.drawRip(ctx, f, t); else if (f.type === 'slick') this.drawSlick(ctx, f);
    this.drawCrests(ctx);
    for (const f of this.features) if (f.type === 'bait') this.drawBait(ctx, f, t);
    for (const fi of this.fish) this.drawFishShape(ctx, fi, t);
    this.drawWake(ctx, bx);
    this.drawGlitter(ctx, W, H, t);
    for (const f of this.features) if (f.type === 'weed' || f.type === 'debris' || f.type === 'buoy') this.drawFeature(ctx, f, t);
    for (const fi of this.fish) if (fi.fin && !fi.down && fi.state === 'idle' && !fi.hide) this.drawFins(ctx, fi, t);
    for (const f of this.features) if (f.birds || f.terns) this.drawBirdShadows(ctx, f, t);
    for (const fl of this.flyers) this.drawFlyer(ctx, fl);
    this.drawSpread(ctx, bx, t);
    const ang = Math.atan2(this.bvy, Math.max(30, this.speed)) * 0.6;
    drawBoatTop(ctx, bx, this.by, 0.9, ang, { crew: Trip.cur && Trip.cur.crew ? [this.ch].concat(Trip.cur.crew.filter((c) => c !== this.ch)) : [this.ch], rig: true });
    this.parts.draw(ctx);
    for (const f of this.features) if (f.birds || f.terns) this.drawBirds(ctx, f, t);
    this.drawHint(ctx, W);
    this.fl.draw(ctx);
    this.drawHud(ctx, W, H);
    if (this.paused) this.drawPause(ctx);
  }
  // the sun's sheen on the water, fixed on screen (upper right), only as big as it needs to be
  overlay(W, H) {
    if (this.ov && this.ovW === W) return this.ov;
    const w = Math.round(W * 0.62), h = Math.round(H * 0.8), cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const g = cv.getContext('2d'), sx = W * 0.8 - (W - w), sy = H * 0.26, r = Math.min(W * 0.45, w);
    const gr = g.createRadialGradient(sx, sy, 10, sx, sy, r);
    gr.addColorStop(0, `rgba(255,244,214,${this.glass ? 0.2 : 0.12})`); gr.addColorStop(0.45, 'rgba(255,244,214,0.04)'); gr.addColorStop(1, 'rgba(255,244,214,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    this.ov = cv; this.ovW = W; return cv;
  }
  drawSea(ctx, W, H, t) {
    const tile = trollWaterTile(this.variant), TW = tile.width - 4;
    const x0 = -(this.scroll % TW);
    for (let x = x0; x < W; x += TW) ctx.drawImage(tile, x, 0, TW + 4, H);
    const cs = trollCloudSprite();
    ctx.globalAlpha = this.glass ? 0.55 : 0.85;
    for (const c of this.clouds) ctx.drawImage(cs, c.x, c.y - 130 * c.s, 440 * c.s, 260 * c.s);
    ctx.globalAlpha = 1;
    const ov = this.overlay(W, H); ctx.drawImage(ov, W - ov.width, 0);
  }
  drawCrests(ctx) {
    const base = this.glass ? 0.11 : this.breezy ? 0.3 : 0.22;
    ctx.lineCap = 'round';
    for (let b = 0; b < 3; b++) {
      const lo = b / 3, hi = (b + 1) / 3, list = [];
      for (const c of this.crests) { const a = Math.sin(Math.PI * c.ph); if (a >= lo && a < hi) list.push(c); }
      if (!list.length) continue;
      const k = (b + 0.6) / 3;
      ctx.strokeStyle = `rgba(0,16,50,${base * 0.8 * k})`; ctx.lineWidth = 2; ctx.beginPath();
      for (const c of list) { ctx.moveTo(c.x, c.y + 2.5); ctx.quadraticCurveTo(c.x + c.l / 2, c.y + 0.5, c.x + c.l, c.y + 2.5); }
      ctx.stroke();
      ctx.strokeStyle = `rgba(235,248,255,${base * k})`; ctx.lineWidth = this.glass ? 1.2 : 1.8; ctx.beginPath();
      for (const c of list) { ctx.moveTo(c.x, c.y); ctx.quadraticCurveTo(c.x + c.l / 2, c.y - 3, c.x + c.l, c.y); }
      ctx.stroke();
      if (this.breezy && b === 2) { ctx.fillStyle = 'rgba(255,255,255,0.32)'; ctx.beginPath(); for (const c of list) if (c.cap) { ctx.moveTo(c.x + c.l * 0.75, c.y - 1); ctx.ellipse(c.x + c.l * 0.55, c.y - 1, c.l * 0.22, 2.2, 0, 0, TAU); } ctx.fill(); }
    }
  }
  drawGlitter(ctx, W, H, t) {
    const cx = W * 0.8, cy = H * 0.27, rx = W * 0.25, ry = H * 0.24, amp = this.glass ? 1 : 0.78;
    ctx.fillStyle = '#fffbea';
    for (let i = 0; i < this.glints.length; i++) {
      const g = this.glints[i], ph = t * g.sp + g.ph, s = Math.sin(ph);
      if (s < 0.5) continue;
      const cyc = Math.floor(ph / TAU), u = trollHash(i, cyc, 1) * 2 - 1, w = trollHash(i, cyc, 2) * 2 - 1, r2 = u * u + w * w;
      if (r2 > 1) continue;
      const a = (s - 0.5) / 0.5, x = cx + u * rx, y = cy + w * ry, sz = g.s * (0.6 + 0.4 * a) * (1 - 0.45 * r2);
      ctx.globalAlpha = a * amp * (1 - 0.5 * r2);
      ctx.fillRect(x - sz * 1.7, y - 0.55, sz * 3.4, 1.1); ctx.fillRect(x - 0.55, y - sz, 1.1, sz * 2);
    }
    ctx.globalAlpha = 1;
  }
  drawEdge(ctx, f, t) {
    const H = Game.H, W = Game.W, ys = [];
    for (let y = -10; y <= H + 12; y += 18) ys.push([f.x + (y - f.y) * f.slope + Math.sin(y * 0.03 + t * 0.8 + f.ph) * 14, y]);
    let mn = 1e9; for (const p of ys) mn = Math.min(mn, p[0]);
    if (mn > W + 20 || mn + f.len < -40) return;
    for (const [wid, a] of [[f.len, 0.12], [f.len * 0.6, 0.08], [f.len * 0.25, 0.08]]) {
      ctx.fillStyle = `rgba(22,14,120,${a})`; ctx.beginPath(); ys.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      for (let i = ys.length - 1; i >= 0; i--) ctx.lineTo(ys[i][0] + wid, ys[i][1]); ctx.closePath(); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(210,235,255,0.3)'; ctx.lineWidth = 2.5; ctx.beginPath(); ys.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke();
    ctx.fillStyle = 'rgba(214,165,60,0.85)'; ctx.beginPath();
    ys.forEach((p, i) => { const r = 2 + trollHash(i, 3, 9) * 4, dx = (trollHash(i, 5, 9) - 0.5) * 14; ctx.moveTo(p[0] + dx + r, p[1]); ctx.ellipse(p[0] + dx, p[1], r, r * 0.7, 0, 0, TAU); });
    ctx.fill();
  }
  drawRip(ctx, f, t) {
    const W = Game.W, ca = Math.cos(f.ang), sa = Math.sin(f.ang);
    const s0 = clamp((-120 - f.x) / ca, 0, f.len), s1 = clamp((W + 120 - f.x) / ca, 0, f.len); if (s1 - s0 < 2) return;
    const nx = -sa * f.side, ny = ca * f.side, step = 24, pts = [];
    for (let s = s0; s < s1 + step; s += step) { const ss = Math.min(s, s1), p = this.linePt(f, ss); p.s = ss; p.taper = clamp(ss / 160, 0, 1) * clamp((f.len - ss) / 160, 0, 1); pts.push(p); }
    // greener upwelled water on the far side of the rip
    for (const [wk, a] of [[1, 0.06], [0.55, 0.07], [0.22, 0.08]]) {
      ctx.fillStyle = `rgba(40,170,170,${a})`; ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i], w = f.wid * wk * p.taper; ctx.lineTo(p.x + nx * w, p.y + ny * w); }
      ctx.closePath(); ctx.fill();
    }
    // a foam streak on the line and standing chop just upstream of it
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(235,250,255,0.22)'; ctx.lineWidth = 3; ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
    const i0 = Math.floor(s0 / 12), i1 = Math.ceil(s1 / 12), flick = Math.floor(t * 2.5);
    const dark = new Path2D(), lite = new Path2D(), foam = new Path2D();
    for (let i = i0; i <= i1; i++) {
      const s = i * 12; if (s < 0 || s > f.len) continue;
      const tp = clamp(s / 160, 0, 1) * clamp((f.len - s) / 160, 0, 1); if (tp <= 0) continue;
      for (let r = 0; r < 2; r++) {
        if (trollHash(i, r + flick * 3, 21) < 0.35) continue;
        const p = this.linePt(f, s + (trollHash(i, r, 5) - 0.5) * 10), off = (r * 16 + trollHash(i, r, 7) * 14 - 4) * tp;
        const x = p.x + nx * off, y = p.y + ny * off, l = (7 + trollHash(i, r, 8) * 8) * tp;
        dark.moveTo(x - ca * l / 2 + 0, y - sa * l / 2 + 2.2); dark.quadraticCurveTo(x, y + 0.5, x + ca * l / 2, y + sa * l / 2 + 2.2);
        lite.moveTo(x - ca * l / 2, y - sa * l / 2); lite.quadraticCurveTo(x - nx * 3, y - ny * 3, x + ca * l / 2, y + sa * l / 2);
        if (trollHash(i, r + flick, 33) < 0.18) { foam.moveTo(x + 2.6, y); foam.ellipse(x, y, 2.6, 1.6, f.ang, 0, TAU); }
      }
    }
    ctx.strokeStyle = 'rgba(0,20,50,0.25)'; ctx.lineWidth = 2; ctx.stroke(dark);
    ctx.strokeStyle = 'rgba(240,252,255,0.5)'; ctx.lineWidth = 1.8; ctx.stroke(lite);
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fill(foam);
  }
  drawSlick(ctx, f) {
    const a = Math.sin(Math.PI * clamp(f.t / f.life, 0, 1)); if (a <= 0.01 || f.x < -200 || f.x > Game.W + 200) return;
    ctx.fillStyle = `rgba(150,210,240,${0.08 * a})`; ell(ctx, f.x, f.y, f.r, f.r * 0.72); ctx.fill();
    ctx.strokeStyle = `rgba(230,248,255,${0.1 * a})`; ctx.lineWidth = 1.5; ctx.stroke();
  }
  drawBait(ctx, f, t) {
    if (f.x < -100 || f.x > Game.W + 100) return;
    const r = f.r * (f.school && f.up ? 0.8 : 1) * (1 + 0.06 * Math.sin(t * 1.3));
    ctx.fillStyle = 'rgba(6,20,36,0.26)'; ell(ctx, f.x, f.y, r * 1.2, r * 0.85, Math.sin(t * 0.4) * 0.3); ctx.fill();
    ell(ctx, f.x + Math.sin(t * 0.9) * r * 0.25, f.y + Math.cos(t * 0.7) * r * 0.2, r * 0.75, r * 0.55); ctx.fill();
    ctx.fillStyle = 'rgba(214,232,244,0.8)'; ctx.beginPath();
    for (const d of f.dots) {
      if (Math.sin(t * 7 + d.ph * 3) < 0.1) continue;
      const a = d.a + t * d.sp, q = d.q * r * 1.05, x = f.x + Math.cos(a) * q, y = f.y + Math.sin(a) * q * 0.72;
      ctx.moveTo(x + 1.8, y); ctx.ellipse(x, y, 1.8, 0.7, a + Math.PI / 2 * Math.sign(d.sp), 0, TAU);
    }
    ctx.fill();
    // nervous water on top
    ctx.strokeStyle = 'rgba(230,248,255,0.22)'; ctx.lineWidth = 1.2; ctx.beginPath();
    for (let i = 0; i < 5; i++) { const a = i * 1.3 + t * 0.5, x = f.x + Math.cos(a) * r * 0.6, y = f.y + Math.sin(a * 1.3) * r * 0.45; ctx.moveTo(x - 5, y); ctx.quadraticCurveTo(x, y - 2, x + 5, y); }
    ctx.stroke();
  }
  drawFishShape(ctx, fi, t) {
    const a = fi.alpha; if (a < 0.02 || fi.x < -120 || fi.x > Game.W + 120) return;
    const lk = TROLL_LOOK[fi.key] || TROLL_LOOK.mahi, L = fi.len, spd = fi.state === 'chase' ? 20 : 7;
    ctx.save(); ctx.translate(fi.x, fi.y); ctx.rotate(fi.hd);
    if (fi.lit < 0.98) { ctx.globalAlpha = a * (1 - fi.lit); trollFishTop(ctx, fi.key, L, lk, fi.t, { speed: spd }); }
    if (fi.lit > 0.02) {
      const k = a * fi.lit, W = L * lk.w;
      // lit up: a glow in the water around it and the push of water off its head
      ctx.globalAlpha = k * 0.22; ctx.fillStyle = fi.key === 'mahi' ? '#8ff0c8' : '#9fdcff'; ell(ctx, 0, 0, L * 0.62, W * 1.5 + 6); ctx.fill();
      if (fi.state === 'chase') { ctx.globalAlpha = k * 0.5; ctx.strokeStyle = '#e8f8ff'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(L * 0.55, 0); ctx.quadraticCurveTo(L * 0.2, -W * 0.9, -L * 0.25, -W * 1.5 - 4); ctx.moveTo(L * 0.55, 0); ctx.quadraticCurveTo(L * 0.2, W * 0.9, -L * 0.25, W * 1.5 + 4); ctx.stroke(); }
      ctx.globalAlpha = k;
      if (fi.key === 'sailfish') { // sail flopped open
        ctx.fillStyle = 'rgba(74,62,200,0.7)'; ctx.beginPath(); ctx.moveTo(L * 0.32, -W * 0.15); ctx.quadraticCurveTo(L * 0.05, -L * 0.36, -L * 0.22, -W * 0.25); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(140,200,255,0.8)'; for (let i = 0; i < 4; i++) { ell(ctx, L * (0.2 - i * 0.1), -L * (0.12 + 0.03 * Math.sin(i)), 1.6, 1.6); ctx.fill(); }
      }
      trollFishTop(ctx, fi.key, L, lk, fi.t, { speed: spd, lit: true });
    }
    ctx.restore();
  }
  drawFins(ctx, fi, t) {
    if (fi.x < -60 || fi.x > Game.W + 60) return;
    const L = fi.len;
    ctx.save(); ctx.translate(fi.x, fi.y); ctx.rotate(fi.hd);
    ctx.strokeStyle = 'rgba(240,252,255,0.5)'; ctx.lineWidth = 1.4; ctx.lineCap = 'round'; ctx.beginPath();
    ctx.moveTo(L * 0.18, -3); ctx.quadraticCurveTo(0, -L * 0.1, -L * 0.2, -L * 0.15); ctx.moveTo(L * 0.18, 3); ctx.quadraticCurveTo(0, L * 0.1, -L * 0.2, L * 0.15);
    ctx.moveTo(-L * 0.38, -L * 0.12); ctx.quadraticCurveTo(-L * 0.5, 0, -L * 0.38, L * 0.12); ctx.stroke();
    ctx.fillStyle = '#1b2350';
    ctx.save(); ctx.translate(-L * 0.42, 0); ctx.rotate(Math.sin(t * 4 + fi.ph) * 0.35);
    ctx.beginPath(); ctx.moveTo(0, -1.5); ctx.quadraticCurveTo(-L * 0.04, -L * 0.08, -L * 0.1, -L * 0.15); ctx.quadraticCurveTo(-L * 0.02, -L * 0.06, 2, 0); ctx.quadraticCurveTo(-L * 0.02, L * 0.06, -L * 0.1, L * 0.15); ctx.quadraticCurveTo(-L * 0.04, L * 0.08, 0, 1.5); ctx.fill();
    ctx.restore();
    ctx.beginPath(); ctx.moveTo(L * 0.3, -1); ctx.quadraticCurveTo(L * 0.1, -L * 0.07, -L * 0.14, -2); ctx.lineTo(L * 0.3, 1.5); ctx.fill();
    ctx.restore();
  }
  drawWake(ctx, bx) {
    const k = clamp(this.speed / 150, 0, 1); if (k < 0.04) return;
    const trav = this.trav, sx = bx - 60, N = 20, step = 11;
    // prop wash: a churned band behind the motors, its edges ruffled in the water
    const edge = (d, side) => { const q = trav - d; return this.yAtDist(q) + side * (6 + d * 0.05) * (1 + 0.3 * Math.sin(q * 0.09) * side + 0.2 * Math.sin(q * 0.23)); };
    ctx.beginPath();
    for (let i = 0; i <= N; i++) { const d = i * step; i ? ctx.lineTo(sx - d, edge(d, -1)) : ctx.moveTo(sx - d, edge(d, -1)); }
    for (let i = N; i >= 0; i--) { const d = i * step; ctx.lineTo(sx - d, edge(d, 1)); }
    ctx.closePath();
    const g = ctx.createLinearGradient(sx, 0, sx - N * step, 0);
    g.addColorStop(0, `rgba(240,250,255,${0.55 * k})`); g.addColorStop(0.3, `rgba(200,234,250,${0.22 * k})`); g.addColorStop(1, 'rgba(200,234,250,0)');
    ctx.fillStyle = g; ctx.fill();
    // foam flecks that stay put in the water
    ctx.fillStyle = `rgba(255,255,255,${0.7 * k})`; ctx.beginPath();
    const base = Math.floor(trav / 6);
    for (let j = 0; j < 46; j++) {
      const id = base - j, d = trav - id * 6; if (d < 0 || d > 270) continue;
      const spread = (7 + d * 0.11) * (trollHash(id, 2, 9) < 0.15 ? 1.8 : 1);
      const y = this.yAtDist(trav - d) + (trollHash(id, 7, 3) - 0.5) * spread * 2, r = (0.8 + trollHash(id, 11, 5) * 2.2) * (1 - d / 300);
      ctx.moveTo(sx - d + r, y); ctx.arc(sx - d, y, r, 0, TAU);
    }
    ctx.fill();
    // the V of the bow wave spreading out behind, with little breaking crests along it
    ctx.lineCap = 'round';
    for (const side of [-1, 1]) {
      for (const [w0, sp, a, lw] of [[20, 0.3, 0.5, 2.2], [26, 0.4, 0.22, 1.6]]) {
        ctx.beginPath();
        for (let i = 0; i <= 14; i++) { const d = i * 22, y = this.yAtDist(trav - d) + side * (w0 + d * sp); i ? ctx.lineTo(bx + 34 - d, y) : ctx.moveTo(bx + 34 - d, y); }
        const lg = ctx.createLinearGradient(bx + 34, 0, bx + 34 - 300, 0);
        lg.addColorStop(0, `rgba(235,248,255,${a * k})`); lg.addColorStop(1, 'rgba(235,248,255,0)');
        ctx.strokeStyle = lg; ctx.lineWidth = lw; ctx.stroke();
      }
      ctx.fillStyle = `rgba(255,255,255,${0.45 * k})`; ctx.beginPath();
      const b0 = Math.floor(trav / 26);
      for (let j = 0; j < 11; j++) {
        const id = b0 - j, d = trav - id * 26 - 34; if (d < 10 || d > 260) continue;
        const y = this.yAtDist(trav - d) + side * (20 + d * 0.3 + (trollHash(id, side + 3, 4) - 0.5) * 8), r = 2.6 * (1 - d / 280);
        ctx.moveTo(bx + 34 - d + r * 1.8, y); ctx.ellipse(bx + 34 - d, y, r * 1.8, r, side * 0.5, 0, TAU);
      }
      ctx.fill();
    }
    // spray peeling off the bow
    ctx.strokeStyle = `rgba(255,255,255,${0.75 * k})`; ctx.lineWidth = 2; ctx.beginPath();
    const fl = Math.sin(this.t * 23) * 2;
    ctx.moveTo(bx + 70, this.by - 6); ctx.quadraticCurveTo(bx + 52, this.by - 24 - fl, bx + 30, this.by - 27);
    ctx.moveTo(bx + 70, this.by + 6); ctx.quadraticCurveTo(bx + 52, this.by + 24 + fl, bx + 30, this.by + 27);
    ctx.stroke();
  }
  drawSpread(ctx, bx, t) {
    for (const L of this.lures) {
      const rigY = this.by + (L.off < 0 ? -72 : L.off > 0 ? 72 : 0), rigX = bx - 48;
      ctx.strokeStyle = L.fouled ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(rigX, rigY); ctx.quadraticCurveTo((rigX + L.x) / 2, (rigY + L.y) / 2 + 6, L.x, L.y); ctx.stroke();
      ctx.save(); ctx.translate(L.x, L.y); ctx.globalAlpha = L.fouled ? 0.35 : 1;
      if (!L.fouled) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(-4, -6); ctx.lineTo(-2, 0); ctx.lineTo(-4, 6); ctx.closePath(); ctx.fill(); }
      const wig = Math.sin(t * 20) * 1.5;
      ctx.fillStyle = L.color; ctx.beginPath(); ctx.moveTo(4, -2.6); ctx.lineTo(-11, -4.5 + wig); ctx.lineTo(-13, 0); ctx.lineTo(-11, 4.5 - wig); ctx.lineTo(4, 2.6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = L.head; ell(ctx, 4.5, 0, 3.2, 2.8); ctx.fill();
      ctx.fillStyle = '#1b2a33'; ell(ctx, 5.6, 0, 0.9, 0.9); ctx.fill();
      ctx.restore();
    }
  }
  drawFeature(ctx, f, t) {
    if (f.x > Game.W + 160) return;
    if (f.type === 'weed') {
      if (f.x + f.len * Math.cos(f.ang) < -80) return;
      const s = f.spr; ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.ang); ctx.drawImage(s.cv, s.ox, s.oy, s.w, s.h); ctx.restore();
      return;
    }
    if (f.x < -120) return;
    const bob = Math.sin(t * 1.7 + f.t) * 0.04;
    if (f.type === 'buoy') {
      const x = f.x, y = f.y;
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 22, y + 6); if (f.tag) { ctx.moveTo(x, y); ctx.quadraticCurveTo(x + f.tag.dx * 0.5, y + f.tag.dy + 4, x + f.tag.dx, y + f.tag.dy); } ctx.stroke();
      const ring = (Math.sin(t * 2 + f.t) + 1) / 2;
      ctx.strokeStyle = `rgba(230,248,255,${0.25 * (1 - ring)})`; ell(ctx, x, y, 12 + ring * 8, (12 + ring * 8) * 0.8); ctx.stroke();
      if (f.tag) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ell(ctx, x + f.tag.dx + 2, y + f.tag.dy + 3, 5.5, 5.5); ctx.fill(); ctx.fillStyle = f.color; ell(ctx, x + f.tag.dx, y + f.tag.dy, 5.5, 5.5); ctx.fill(); }
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ell(ctx, x + 3, y + 4, 10, 10); ctx.fill();
      ctx.fillStyle = f.color; ell(ctx, x, y, 10, 10); ctx.fill();
      ctx.save(); ell(ctx, x, y, 10, 10); ctx.clip(); ctx.fillStyle = f.stripe; ctx.fillRect(x - 10, y - 2.5, 20, 5); ctx.fillStyle = 'rgba(0,0,0,0.16)'; ell(ctx, x + 4, y + 4, 9, 9); ctx.fill(); ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ell(ctx, x - 3.5, y - 3.5, 3, 2.2); ctx.fill();
      return;
    }
    // debris
    ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot + bob);
    const ring = (Math.sin(t * 1.5 + f.t) + 1) / 2;
    ctx.strokeStyle = `rgba(230,248,255,${0.22 * (1 - ring)})`; ctx.lineWidth = 1.3;
    if (f.kind === 'log') {
      const L = f.L, r = f.r;
      rr(ctx, -L / 2 - 6 - ring * 6, -r - 5 - ring * 4, L + 12 + ring * 12, r * 2 + 10 + ring * 8, r + 6); ctx.stroke();
      ctx.fillStyle = 'rgba(4,22,42,0.38)'; rr(ctx, -L / 2 + 3, -r + 4, L, r * 2, r); ctx.fill();
      ctx.fillStyle = 'rgba(206,158,52,0.9)'; ell(ctx, -L / 2 + 4, r * 0.7, 10, 6); ctx.fill(); ell(ctx, L * 0.25, -r - 1, 9, 5); ctx.fill(); ell(ctx, L * 0.4, r * 0.8, 7, 4); ctx.fill();
      const g = ctx.createLinearGradient(0, -r, 0, r); g.addColorStop(0, '#a3825a'); g.addColorStop(0.5, '#73563a'); g.addColorStop(1, '#4a3622');
      ctx.fillStyle = g; rr(ctx, -L / 2, -r, L, r * 2, r); ctx.fill();
      ctx.strokeStyle = 'rgba(40,26,14,0.5)'; ctx.lineWidth = 1; ctx.beginPath();
      for (let i = 0; i < 4; i++) { const y = -r * 0.6 + i * r * 0.4; ctx.moveTo(-L / 2 + 8 + i * 5, y); ctx.lineTo(L / 2 - 14 + i * 3, y + (i % 2 ? 1 : -1)); }
      ctx.stroke();
      ctx.fillStyle = '#caa978'; ell(ctx, L / 2 - 1, 0, r * 0.45, r * 0.95); ctx.fill();
      ctx.strokeStyle = 'rgba(110,80,46,0.7)'; ell(ctx, L / 2 - 1, 0, r * 0.25, r * 0.55); ctx.stroke();
      ctx.fillStyle = 'rgba(238,236,224,0.85)'; for (let i = 0; i < 6; i++) { ell(ctx, -L / 2 + 6 + i * 3.2, r * (0.5 - (i % 3) * 0.3), 1.3, 1.3); ctx.fill(); }
    } else if (f.kind === 'pallet') {
      rr(ctx, -30 - ring * 6, -27 - ring * 6, 60 + ring * 12, 54 + ring * 12, 8); ctx.stroke();
      ctx.fillStyle = 'rgba(4,22,42,0.38)'; ctx.fillRect(-21, -17, 46, 40);
      ctx.fillStyle = '#6f5a3e'; for (const y of [-18, -2, 14]) ctx.fillRect(-24, y, 48, 6);
      ctx.fillStyle = '#b39a70'; for (let i = 0; i < 5; i++) ctx.fillRect(-23 + i * 10, -21, 7, 42);
      ctx.fillStyle = 'rgba(0,0,0,0.12)'; for (let i = 0; i < 5; i++) ctx.fillRect(-23 + i * 10 + 5, -21, 2, 42);
      ctx.fillStyle = 'rgba(206,158,52,0.9)'; ell(ctx, -24, 16, 9, 5); ctx.fill(); ell(ctx, 22, -20, 7, 4); ctx.fill();
    } else if (f.kind === 'plank') {
      rr(ctx, -42 - ring * 6, -11 - ring * 4, 84 + ring * 12, 22 + ring * 8, 8); ctx.stroke();
      ctx.fillStyle = 'rgba(4,22,42,0.38)'; ctx.fillRect(-34, -3, 70, 11);
      ctx.fillStyle = '#c4a678'; ctx.fillRect(-36, -6, 70, 11); ctx.fillStyle = 'rgba(90,64,36,0.45)'; ctx.fillRect(-36, -1, 70, 1); ctx.fillRect(-20, 2, 40, 1);
      ctx.fillStyle = 'rgba(206,158,52,0.9)'; ell(ctx, -34, 5, 7, 4); ctx.fill();
    } else { // a lost cooler lid
      rr(ctx, -24 - ring * 6, -17 - ring * 5, 48 + ring * 12, 34 + ring * 10, 9); ctx.stroke();
      ctx.fillStyle = 'rgba(4,22,42,0.38)'; rr(ctx, -15, -9, 34, 24, 5); ctx.fill();
      ctx.fillStyle = '#f2f4f2'; rr(ctx, -18, -12, 34, 24, 5); ctx.fill();
      ctx.strokeStyle = '#c7ccc8'; ctx.lineWidth = 1.5; rr(ctx, -14, -8, 26, 16, 3); ctx.stroke();
      ctx.fillStyle = '#3c78b8'; ctx.fillRect(-4, -12, 8, 3);
      ctx.fillStyle = 'rgba(120,150,70,0.5)'; ell(ctx, 12, 9, 6, 3); ctx.fill();
    }
    ctx.restore();
  }
  frigatePos(f, b) {
    const x = f.x + Math.cos(b.a) * b.r, y = f.y + Math.sin(b.a) * b.r * 0.75, s = Math.sign(b.sp) || 1;
    return { x, y, ang: Math.atan2(Math.cos(b.a) * 0.75 * s, -Math.sin(b.a) * s) };
  }
  drawBirdShadows(ctx, f, t) {
    if (f.x < -200 || f.x > Game.W + 200) return;
    if (f.birds) for (const b of f.birds) { const p = this.frigatePos(f, b); trollFrigate(ctx, p.x + 18 * b.h, p.y + 52 * b.h, 0.62 * b.h, p.ang, 0, 'rgba(0,12,32,0.13)'); }
    if (f.terns) { ctx.fillStyle = 'rgba(0,12,32,0.16)'; ctx.beginPath(); for (const b of f.terns) { const o = 14 * b.sc; ctx.moveTo(b.px + o * 0.4 + 5, b.py + o); ctx.ellipse(b.px + o * 0.4, b.py + o, 5 * b.sc, 2 * b.sc, b.ang, 0, TAU); } ctx.fill(); }
  }
  drawBirds(ctx, f, t) {
    if (f.x < -200 || f.x > Game.W + 200) return;
    if (f.terns) for (const b of f.terns) trollTern(ctx, b.px, b.py, 1.1 * b.sc, b.ang, b.dive > 0 ? b.open : 0.55 + 0.45 * Math.abs(Math.sin(t * 11 + b.ph)));
    if (f.birds) for (const b of f.birds) {
      const p = this.frigatePos(f, b), flap = Math.sin(t * 0.6 + b.ph) > 0.8 ? Math.sin(t * 9 + b.ph) : 0;
      trollFrigate(ctx, p.x, p.y, 0.95 * b.h, p.ang, flap, '#141a20');
    }
  }
  drawFlyer(ctx, fl) {
    const k = fl.t / fl.life, h = Math.sin(Math.PI * k) * 14 * fl.s, ang = Math.atan2(fl.vy, fl.vx - this.speed * 0.3);
    ctx.fillStyle = 'rgba(0,14,34,0.22)'; ell(ctx, fl.x + h * 0.3, fl.y + h, 6 * fl.s, 2.4 * fl.s, ang); ctx.fill();
    ctx.save(); ctx.translate(fl.x, fl.y - h * 0.15); ctx.rotate(ang); ctx.scale(fl.s, fl.s);
    ctx.fillStyle = 'rgba(205,232,255,0.92)'; ctx.beginPath(); ctx.moveTo(2, -1); ctx.lineTo(-3, -9); ctx.lineTo(-6, -8); ctx.lineTo(-3, 0); ctx.lineTo(-6, 8); ctx.lineTo(-3, 9); ctx.lineTo(2, 1); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#3d74b0'; ell(ctx, 0, 0, 6.5, 1.7); ctx.fill();
    ctx.restore();
  }
  drawHint(ctx, W) {
    const h = this.hint; if (!h || h.f.dead) return;
    const a = clamp(Math.min(h.t / 0.25, (h.dur - h.t) / 0.4), 0, 1); if (a <= 0) return;
    const p = this.anchorOf(h.f);
    ctx.save(); ctx.font = fnt(15, 800);
    const tw = ctx.measureText(h.text).width + 24, x = clamp(p.x, tw / 2 + 10, W - tw / 2 - 10);
    let y = p.y - 64; const below = y < 104; if (below) y = p.y + 64;
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(6,30,46,0.85)'; rr(ctx, x - tw / 2, y - 14, tw, 28, 14); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 1.5; ctx.stroke();
    const px = clamp(p.x, x - tw / 2 + 16, x + tw / 2 - 16);
    ctx.fillStyle = 'rgba(6,30,46,0.85)'; ctx.beginPath();
    if (below) { ctx.moveTo(px - 7, y - 13); ctx.lineTo(px, y - 22); ctx.lineTo(px + 7, y - 13); } else { ctx.moveTo(px - 7, y + 13); ctx.lineTo(px, y + 22); ctx.lineTo(px + 7, y + 13); }
    ctx.fill();
    text(ctx, h.text, x, y + 1, { size: 15, weight: 800, align: 'center', base: 'middle', color: '#fff' });
    ctx.restore();
  }
  drawHud(ctx, W, H) {
    this.drawTopBar(ctx);
    const px = W - 196, py = 12;
    panel(ctx, px, py, 182, 46, { r: 23 });
    text(ctx, 'SPREAD', px + 14, py + 29, { size: 14, weight: 800, color: '#cfe3ea' });
    this.lures.forEach((L, i) => { ctx.globalAlpha = L.fouled ? 0.3 : 1; ctx.fillStyle = L.color; ell(ctx, px + 96 + i * 28, py + 23, 9, 9); ctx.fill(); ctx.globalAlpha = 1; });
    if (this.stall > 0) text(ctx, 'Prop wrapped… ' + this.stall.toFixed(1) + 's', W / 2, 92, { size: 18, align: 'center', color: PAL.warn, weight: 800, stroke: 'rgba(0,0,0,0.5)', sw: 4 });
    let tip = null;
    if (this.t < 9) tip = Game.touch ? 'Drag up and down to steer the boat' : 'Drag or ↑ ↓ to steer the boat';
    else if (this.t < 14 && this.glass) tip = 'Glass calm: you can see fish deeper today';
    else if (this.t < 14 && this.breezy) tip = 'Choppy: fish are hard to see, watch the birds';
    if (tip) text(ctx, tip, W / 2, H - 22, { size: 17, align: 'center', color: '#fff', weight: 700, alpha: 0.85, stroke: 'rgba(0,0,0,0.5)', sw: 4 });
  }
}
