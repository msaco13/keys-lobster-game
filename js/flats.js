'use strict';
/* Keys Crew — the flats. Sight-casting a fly from a poled skiff, seen from above.
   One scene dresses three spots: Florida Bay ('bay'), the Channel Five bridge ('bridge') and
   Flamingo in the Everglades ('glades'). The water runs wider than the screen and the poler
   pushes the skiff along it (◀ ▶, or A / D). Fish are few and hard to see: tails, wakes,
   nervous water, rolling tarpon, pops on the roots and mud puffs give them away, and the poler
   calls what he sees by the clock. Press and hold where you want the fly (the circle tightens),
   release to cast. Lead the fish, strip in its rhythm, and set it when it eats. */

const FLATS_WORLD = 2400;   // logical px of water along the flat; the screen shows 720–1280 of it
const FL_DECK = 70;         // bridge: the south edge of the deck (the pilings stand just below it)
const FL_TIDE = 24;         // bridge: how hard the tide pulls under the spans, px/s
const FLATS_VIS = 0.8;      // overall knob for how plainly fish show
const CLOCK = ['12', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'];
// how often each species turns up at each kind of spot (only the species a spot lists are used)
const FLATS_WEIGHT = {
  bay: { bonefish: 4, redfish: 3, snook: 2, trout: 2.4, permit: 1.6, tarpon: 1.8 },
  bridge: { tarpon: 3.2, jack: 2.6, ladyfish: 2.4, snook: 2, mangrove: 2.2, permit: 1.3 },
  glades: { snook: 3.2, redfish: 3, blackdrum: 2.2, tarpon: 1.6, trout: 2.2, jack: 1.6 }
};
// per-spot water: how clear it is, how much of a shadow a fish throws, the light net on the bottom
const FLATS_KIND = {
  bay: { clarity: 1, shadow: 1, caustic: 0.09, mud: '#dfe2d4', shadeCol: '#1b4842', critters: ['ray', 'shark', 'cuda'],
    hint: 'Look for tails and nervous water. I’ll call ’em by the clock.' },
  bridge: { clarity: 0.6, shadow: 0.3, caustic: 0, mud: '#cfd2b4', shadeCol: '#0b2a2a', critters: ['ray', 'cuda', 'turtle'],
    hint: 'Tide’s ripping. Cast up-current of them and let it swing.' },
  glades: { clarity: 0.55, shadow: 0.35, caustic: 0, mud: '#b9a97e', shadeCol: '#191d12', critters: ['ray', 'manatee', 'ray'],
    hint: 'Snook sit tight to the roots. Reds and drum tail on the mud.' }
};
const FL_C = {
  sand: [172, 226, 208], bright: [214, 240, 222], grass: [92, 162, 128], marl: [176, 196, 160], deep: [44, 128, 158],
  bDeep: [22, 80, 78], bMid: [40, 118, 106], bShallow: [92, 168, 144], bSand: [176, 212, 182],
  gDeep: [44, 54, 36], gMid: [80, 86, 54], gMudL: [150, 136, 94], gShade: [26, 32, 20]
};
// tails out of the water (what a tailing fish shows), as seen from the platform
const FL_TAIL = {
  bonefish: { fill: '#e2ecec', edge: '#7d9496' }, permit: { fill: '#16191b', k: 1.3 },
  redfish: { fill: '#bb7840', tip: '#3c74cc' }, blackdrum: { fill: '#24221e', k: 1.25 }
};
const FL_NAME = { trout: 'Trout', mangrove: 'Snapper', blackdrum: 'Black drum', ladyfish: 'Ladyfish', jack: 'Jacks' };

/* small noise + colour helpers, private to the flats */
function flHash(ix, iy, s) { let h = (Math.imul(ix | 0, 374761393) + Math.imul(iy | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
function flNoise(x, y, s = 0) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  return lerp(lerp(flHash(ix, iy, s), flHash(ix + 1, iy, s), sx), lerp(flHash(ix, iy + 1, s), flHash(ix + 1, iy + 1, s), sx), sy);
}
function flFbm(x, y, s = 0) { return flNoise(x, y, s) * 0.55 + flNoise(x * 2.03 + 17, y * 2.03 + 9, s) * 0.3 + flNoise(x * 4.1 + 3, y * 4.1 + 31, s) * 0.15; }
function flStep(a, b, v) { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
function flMix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
function flSegDist(px, py, ax, ay, bx, by) { const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy || 1, k = clamp(((px - ax) * dx + (py - ay) * dy) / l, 0, 1); return dist(px, py, ax + dx * k, ay + dy * k); }

class FlatsScene extends SessionBase {
  constructor(o) {
    super(o);
    const spot = SPOTS[this.spot] || SPOTS.flats;
    this.variant = FLATS_KIND[spot.variant] ? spot.variant : 'bay';
    this.K = FLATS_KIND[this.variant]; this.spotName = spot.name;
    this.speciesList = (spot.species || []).filter((k) => SPECIES[k] && SPECIES[k].spook != null && TOPLOOK[k]);
    if (!this.speciesList.length) this.speciesList = ['bonefish', 'redfish', 'snook'];
    const wid = this.weather.id;
    this.wakeK = wid === 'glass' ? 1.6 : wid === 'breezy' ? 0.5 : 1;   // glass calm shows every push of water
    this.tailK = wid === 'breezy' ? 0.8 : 1;
    this.eyeK = wid === 'glass' ? 1.3 : wid === 'breezy' ? 0.8 : 1;     // how fast the poler picks fish out
    this.WW = FLATS_WORLD; this.bx = this.WW / 2; this.camX = 0;
    this.fishList = []; this.critters = []; this.puffs = [];
    this.spawnT = 0.8; this.spawns = 0; this.unitN = 0; this.critT = rand(6, 12);
    this.aim = null; this.pending = null; this.lure = null; this.cast = null; this.eat = null; this.snagT = 0;
    this.callout = null; this.callCool = 1; this.pointTo = null; this.quietT = 0; this.introSaid = false;
    this.slamDone = {}; this.landed = new Set();
    this.pole = 0; this.poleDir = 0; this.poleV = 0; this.everPoled = false;
    // the coaching (a ring on the fish your buddy calls, where to put the fly, when to strip, the four steps) stays on
    // until this angler hooks a first fish on the flats; the how-to card opens by itself on their first visit (and from ?)
    this.coach = !Store.get('coach_flatset_' + this.ch, false); this.coachF = null;
    this.help = !Store.get('coach_flats1_' + this.ch, false) ? { t: 0 } : null;
    const crew = Trip.cur && Trip.cur.crew ? Trip.cur.crew : CHAR_ORDER;
    // somebody is always up on the platform: on a solo day a buddy from the crew poles
    this.poler = crew.find((c) => c !== this.ch) || CHAR_ORDER.find((c) => c !== this.ch) || null;
    this.cars = [];
    if (this.variant === 'bridge') {
      const cols = ['#d8dde2', '#c8372d', '#26406a', '#f2f2ee', '#3a3f45', '#e0b43a', '#6a8fa8', '#2f6b4a'];
      for (let i = 0; i < 9; i++) { const east = i % 2 === 0; this.cars.push({ x: rand(0, this.WW), y: east ? 40 : 18, v: (east ? 1 : -1) * rand(120, 190), c: cols[i % cols.length], len: rand(22, 32) }); }
    }
    this.buildTerrain(); this.clampCam();
  }
  enter() {
    SFX.setAmbient(0.6, false); Music.play('boat');
    Game.toast(this.spotName, { color: PAL.coral, size: 46, y: 200, sub: 'Press and hold to aim. Release to cast.' });
    if (this.help) Store.set('coach_flats1_' + this.ch, true);
  }
  openHelp() { if (!this.child && !this.ended && !this.paused) { this.help = { t: 0 }; this.aim = null; this.pending = null; } }
  closeHelp() { this.help = null; this.aim = null; this.pending = null; }
  exit() {
    SFX.setAmbient(0);
    // the flat is a big bitmap: hand its memory back now (mobile Safari caps total canvas memory)
    for (const c of [this.terrain, this.over]) if (c) { c.width = 1; c.height = 1; }
    this.causticPat = null;
  }
  resize() { this.clampCam(); }
  clampCam() { const W = Game.W; this.bx = clamp(this.bx, W / 2, this.WW - W / 2); this.camX = this.bx - W / 2; }
  skiff() { return { x: this.bx, y: Game.H - 70 }; }
  rodTip() { return { x: this.bx, y: Game.H - 130 }; }
  onScreen(f, pad = 0) { const sx = f.x - this.camX; return sx > -pad && sx < Game.W + pad; }

  /* ---------- the water: layout, a soft low-res bottom, vector detail, then canopy or deck on top ---------- */
  arrAt(a, x) { const i = clamp(x / 4, 0, a.length - 1.001), i0 = Math.floor(i); return a[i0] + (a[i0 + 1] - a[i0]) * (i - i0); }
  shoreAt(x) { return this.arrAt(this.shore, x); }
  topY(x) { return this.shoreAt(x); }   // the bank, or the line of pilings under the bridge
  gridAt(g, x, y) { const i = clamp(Math.round(x / 4), 0, this.gcols - 1), j = clamp(Math.round(y / 4), 0, this.grows - 1); return g[j * this.gcols + i]; }
  depthAt(x, y) { return this.gridAt(this.depthGrid, x, y); }
  kindAt(x, y) { return this.gridAt(this.kindGrid, x, y) / 255; }   // turtle grass (bay), mud (glades), sand (bridge)
  islandAt(x, y, pad = 0) { for (const s of this.islands) { if (((x - s.x) / (s.rx + pad)) ** 2 + ((y - s.y) / (s.ry + pad)) ** 2 < 1) return s; } return null; }
  current(x, y) {
    if (this.variant === 'bridge') {
      // slack water in the lee of each bent of pilings; the tide eases as it spills onto the shoal
      const i = Math.round((x - 70) / 150), dx = Math.abs(x - (70 + i * 150)), dy = y - (FL_DECK + 26);
      let k = 1;
      if (dy > -20 && dy < 130 && dx < 42) k = lerp(lerp(0.15, 1, flStep(14, 42, dx)), 1, flStep(50, 130, dy));
      const s = FL_TIDE * k * (1 - 0.45 * flStep(330, 480, y));
      return { x: s * 0.16, y: s };
    }
    if (this.creek) { const d = dist(x, y, this.creek.x, this.creek.y); if (d < 160) { const s = 9 * (1 - d / 160); return { x: (x - this.creek.x) / (d + 1) * s * 0.5, y: s }; } }
    return { x: 0, y: 0 };
  }
  glareAt(sx, y) { const gx = Game.W * 0.7, gy = 210; return clamp(1 - ((sx - gx) / 300) ** 2 - ((y - gy) / 105) ** 2, 0, 1); }

  layout(rng, seed) {
    const WW = this.WW, V = this.variant, n = Math.ceil(WW / 4) + 2;
    this.islands = []; this.holes = []; this.muds = []; this.bars = []; this.pilings = []; this.oysters = []; this.birds = []; this.creek = null;
    const sh = this.shore = new Float32Array(n);
    if (V === 'bridge') {
      sh.fill(FL_DECK + 26);
      for (let x = 70; x < WW; x += 150) this.pilings.push({ x, y: FL_DECK + 26 });
      const so = this.shoal = new Float32Array(n);
      for (let i = 0; i < n; i++) { const x = i * 4; so[i] = 410 + (flFbm(x * 0.003, 2.2, seed) - 0.5) * 190 + Math.sin(x * 0.004 + seed) * 18; }
      return;
    }
    // the bank stays low enough on screen that the root line shows under the HUD
    const glades = V === 'glades', base = glades ? 102 : 80, amp = glades ? 120 : 70;
    for (let i = 0; i < n; i++) { const x = i * 4; sh[i] = clamp(base + (flFbm(x * 0.0032, 0.7, seed) - 0.5) * amp + Math.sin(x * 0.0019 + seed) * (glades ? 16 : 9), glades ? 56 : 54, glades ? 165 : 122); }
    if (glades) {
      // a creek mouth breaks the mangrove shoreline; a mangrove island sits out on the other side
      const cx = Math.round(WW * (rng() < 0.5 ? 0.3 + rng() * 0.1 : 0.6 + rng() * 0.1)), cw = 44;
      const mouthY = (this.shoreAt(cx - cw * 2) + this.shoreAt(cx + cw * 2)) / 2;
      for (let i = 0; i < n; i++) { const x = i * 4, k = 1 - flStep(cw * 0.55, cw * 1.7, Math.abs(x - cx)); sh[i] = lerp(sh[i], -40, k); }
      this.creek = { x: cx, y: mouthY + 14 };
      const ix = cx < WW / 2 ? WW * (0.72 + rng() * 0.1) : WW * (0.16 + rng() * 0.1);
      this.islands.push({ x: ix, y: 250 + rng() * 20, rx: 86, ry: 38 });
      for (let i = 0; i < 6; i++) { const x = (i + 0.5) / 6 * WW + (rng() - 0.5) * 160; this.muds.push({ x, y: clamp(this.shoreAt(x) + 110 + rng() * 120, 200, 335), rx: 100 + rng() * 70, ry: 30 + rng() * 22 }); }
      for (let i = 0; i < 5; i++) { const x = 100 + rng() * (WW - 200); if (Math.abs(x - cx) < 120) continue; this.oysters.push({ x, y: this.shoreAt(x) + 36 + rng() * 26, rx: 22 + rng() * 14, ry: 6 + rng() * 3, rot: (rng() - 0.5) * 0.6 }); }
      for (let i = 0; i < 7; i++) { const x = 60 + rng() * (WW - 120); this.holes.push({ x, y: lerp(270, 350, rng()), r: 14 + rng() * 10 }); }
      for (let i = 0; i < 4; i++) { const x = 80 + rng() * (WW - 160); if (Math.abs(x - cx) > 110) this.birds.push({ x, y: this.shoreAt(x) + 14, a: rng() * TAU, kind: 'egret' }); }
      const m = this.muds[1 + Math.floor(rng() * 4)]; this.birds.push({ x: m.x + 30, y: m.y, a: rng() * TAU, kind: 'heron' });
    } else {
      const ch = this.chan = new Float32Array(n), cwd = this.chanWd = new Float32Array(n);
      for (let i = 0; i < n; i++) { const x = i * 4; ch[i] = Math.max(sh[i] + 84, 200 + Math.sin(x * 0.0024 + seed * 0.37) * 44 + (flFbm(x * 0.004, 3.3, seed) - 0.5) * 70); cwd[i] = 28 + 18 * flNoise(x * 0.005, 7.7, seed); }
      const ix = WW * (rng() < 0.5 ? 0.1 : 0.9);
      this.islands.push({ x: ix, y: clamp(this.arrAt(ch, ix) + this.arrAt(cwd, ix) + 84, 270, 320), rx: 62, ry: 28 });
      const bx = WW * (ix < WW / 2 ? 0.62 + rng() * 0.12 : 0.26 + rng() * 0.12);
      this.bars.push({ x: bx, y: 300 + rng() * 30, rx: 170, ry: 36 });   // a white sand bar where bonefish tail
      for (let i = 0; i < 16; i++) { const x = 60 + rng() * (WW - 120); this.holes.push({ x, y: lerp(this.shoreAt(x) + 110, 345, rng()), r: 15 + rng() * 15 }); }
      for (let i = 0; i < 4; i++) { const x = 100 + rng() * (WW - 200); this.muds.push({ x, y: this.shoreAt(x) + 46, rx: 70 + rng() * 40, ry: 20 + rng() * 8 }); }
      for (let i = 0; i < 3; i++) { const x = 80 + rng() * (WW - 160); this.birds.push({ x, y: this.shoreAt(x) + 14, a: rng() * TAU, kind: 'egret' }); }
    }
  }
  bottomAt(x, y, seed) {
    const V = this.variant, top = this.shoreAt(x), n1 = flFbm(x * 0.006, y * 0.008, seed);
    let d, kind = 0, c;
    if (V === 'bridge') {
      d = 0.32 + 0.62 * (1 - flStep(110, 470, y)) + (n1 - 0.5) * 0.34;
      const i = Math.round((x - 70) / 150), sx = x - (70 + i * 150), sy = y - 175;   // scour holes the tide digs below each bent
      d += 0.16 * Math.exp(-(sx * sx) / 2200 - (sy * sy) / 5200);
      const sh = flStep(-40, 50, y - this.arrAt(this.shoal, x)); d = clamp(d - 0.32 * sh, 0, 1);
      c = d > 0.5 ? flMix(FL_C.bMid, FL_C.bDeep, (d - 0.5) / 0.5) : flMix(FL_C.bShallow, FL_C.bMid, d / 0.5);
      // sand waves laid crosswise to the tide on the shoal, grass in the troughs
      kind = sh * flStep(0.38, 0.62, flNoise(x * 0.012, y * 0.05, seed + 9) * 0.7 + flNoise(x * 0.04, y * 0.08, seed + 2) * 0.3);
      c = flMix(c, FL_C.bSand, kind * 0.6);
      const st = 0.93 + 0.14 * flNoise(x * 0.05, y * 0.0055, seed + 5);   // long streaks laid down by the tide
      c = [c[0] * st, c[1] * st, c[2] * st];
    } else if (V === 'glades') {
      d = 0.52 + (n1 - 0.5) * 0.4;
      let mud = 0;
      for (const m of this.muds) { const q = ((x - m.x) / m.rx) ** 2 + ((y - m.y) / m.ry) ** 2; if (q < 2.2) mud = Math.max(mud, 1 - flStep(0.5, 1.15, q + (flNoise(x * 0.025, y * 0.025, seed + 4) - 0.5) * 0.6)); }
      d -= 0.42 * mud; kind = mud;
      const edge = 1 - flStep(0, 50, y - top); d += 0.14 * edge + 0.12 * flStep(330, 520, y);
      if (this.creek) d += 0.25 * (1 - flStep(40, 170, dist(x, y, this.creek.x, this.creek.y - 20)));
      for (const s of this.islands) { const q = ((x - s.x) / (s.rx + 44)) ** 2 + ((y - s.y) / (s.ry + 34)) ** 2; d -= 0.2 * (1 - flStep(0.4, 1, q)); }
      for (const p of this.holes) { const dd = dist(x, y, p.x, p.y); if (dd < p.r * 1.5) d += 0.16 * (1 - flStep(p.r * 0.5, p.r * 1.2, dd)); }
      d = clamp(d, 0, 1);
      c = flMix(FL_C.gMudL, FL_C.gMid, flStep(0.1, 0.48, d)); c = flMix(c, FL_C.gDeep, flStep(0.48, 0.95, d));
      c = flMix(c, FL_C.gShade, edge * 0.45);
      const sp = 0.95 + 0.1 * flNoise(x * 0.06, y * 0.06, seed + 3); c = [c[0] * sp, c[1] * sp, c[2] * sp];
    } else {
      d = 0.13 + 0.2 * n1;
      const cy = this.arrAt(this.chan, x), cw = this.arrAt(this.chanWd, x), chn = 1 - flStep(cw * 0.45, cw * 1.5, Math.abs(y - cy));
      d += 0.62 * chn + 0.07 * flStep(380, 540, y);
      const near = 1 - flStep(0, 64, y - top); d -= 0.08 * near;
      let hole = 0; for (const p of this.holes) { const dd = dist(x, y, p.x, p.y); if (dd < p.r * 1.2) hole = Math.max(hole, 1 - flStep(p.r * 0.55, p.r * 1.1, dd)); }
      d += 0.1 * hole;
      let bar = 0; for (const b of this.bars) { const q = ((x - b.x) / b.rx) ** 2 + ((y - b.y) / b.ry) ** 2; if (q < 2.2) bar = Math.max(bar, 1 - flStep(0.35, 1.1, q + (flNoise(x * 0.02, y * 0.03, seed + 6) - 0.5) * 0.5)); }
      let mud = 0; for (const m of this.muds) { const q = ((x - m.x) / m.rx) ** 2 + ((y - m.y) / m.ry) ** 2; if (q < 1.6) mud = Math.max(mud, 1 - flStep(0.4, 1.2, q)); }
      let isl = 0; for (const s of this.islands) { const q = ((x - s.x) / (s.rx + 50)) ** 2 + ((y - s.y) / (s.ry + 40)) ** 2; isl = Math.max(isl, 1 - flStep(0.3, 1, q)); }
      d = clamp(d - 0.12 * bar - 0.1 * isl, 0, 1);
      kind = flStep(0.43, 0.56, flFbm(x * 0.0065 + 40, y * 0.011, seed + 7)) * (1 - hole) * (1 - chn * 0.75) * (1 - bar);
      c = flMix(FL_C.sand, FL_C.grass, kind);
      c = flMix(c, FL_C.marl, Math.max(near * 0.5, mud * 0.75));
      c = flMix(c, FL_C.bright, Math.max(bar, isl * 0.6) * 0.75);
      c = flMix(c, FL_C.deep, Math.pow(d, 1.3));
      const sp = 0.96 + 0.08 * flNoise(x * 0.06, y * 0.06, seed + 3); c = [c[0] * sp, c[1] * sp, c[2] * sp];
    }
    this._d = d; this._k = kind; return c;
  }
  buildTerrain() {
    const WW = this.WW, H = Game.H;
    const rng = mulberry(hashStr('flats:' + this.spot)), seed = Math.floor(rng() * 9999);
    this.layout(rng, seed);
    const res = this.tres = clamp((Game.dpr || 1) * (Game.scale || 1), 1, 1.5);
    // 1. the bottom, worked out every 4 px and smoothed up: depth, grass or mud, a little mottling
    const S = 4, cols = this.gcols = Math.ceil(WW / S) + 1, rows = this.grows = Math.ceil(H / S) + 1;
    const field = document.createElement('canvas'); field.width = cols; field.height = rows;
    const fg = field.getContext('2d'), img = fg.createImageData(cols, rows), px = img.data;
    const dg = this.depthGrid = new Float32Array(cols * rows), kg = this.kindGrid = new Uint8Array(cols * rows);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const k = j * cols + i, c = this.bottomAt(i * S, j * S, seed);
      dg[k] = this._d; kg[k] = Math.round(this._k * 255);
      px[k * 4] = c[0]; px[k * 4 + 1] = c[1]; px[k * 4 + 2] = c[2]; px[k * 4 + 3] = 255;
    }
    fg.putImageData(img, 0, 0);
    const c = document.createElement('canvas'); c.width = Math.ceil(WW * res); c.height = Math.ceil(H * res);
    const g = c.getContext('2d'); g.scale(res, res); g.imageSmoothingEnabled = true;
    try { g.imageSmoothingQuality = 'high'; } catch (e) { /* older browsers */ }
    g.drawImage(field, 0, 0, cols, rows, -S / 2, -S / 2, cols * S, rows * S);
    // 2. vector detail on the bottom
    if (this.variant === 'bridge') this.paintBridge(g, rng);
    else if (this.variant === 'glades') this.paintGlades(g, rng);
    else this.paintBay(g, rng);
    this.terrain = c;
    // 3. what stands over the water and over the fish: mangrove canopy, or the bridge deck
    let OH = FL_DECK + 2;
    if (this.variant !== 'bridge') { OH = 0; for (let x = 0; x <= WW; x += 8) OH = Math.max(OH, this.shoreAt(x)); for (const s of this.islands) OH = Math.max(OH, s.y + s.ry); OH = Math.ceil(OH + 18); }
    const oc = document.createElement('canvas'); oc.width = Math.ceil(WW * res); oc.height = Math.ceil(OH * res);
    const og = oc.getContext('2d'); og.scale(res, res);
    if (this.variant === 'bridge') this.paintDeck(og, rng); else this.paintCanopy(og, rng);
    this.over = oc; this.overH = OH;
    // 4. a little chart of the whole flat for the pole control
    const mm = document.createElement('canvas'); mm.width = 240; mm.height = 54; const mg = mm.getContext('2d');
    mg.drawImage(c, 0, 0, c.width, c.height, 0, 0, 240, 54); mg.drawImage(oc, 0, 0, oc.width, oc.height, 0, 0, 240, 54 * OH / H);
    this.mini = mm;
    // 5. sprites: the light net on the bottom and the sun's glare
    this.causticImg = this.K.caustic ? this.makeCaustic() : null; this.causticPat = null;
    const gl = document.createElement('canvas'); gl.width = 256; gl.height = 128; const gg = gl.getContext('2d');
    gg.setTransform(1, 0, 0, 0.5, 0, 0); const rg = gg.createRadialGradient(128, 128, 4, 128, 128, 128);
    rg.addColorStop(0, 'rgba(255,253,236,0.95)'); rg.addColorStop(0.3, 'rgba(255,250,228,0.4)'); rg.addColorStop(1, 'rgba(255,250,228,0)');
    gg.fillStyle = rg; gg.fillRect(0, 0, 256, 256); this.glareImg = gl;
  }
  makeCaustic() {
    // cell edges of a wrapping Voronoi pattern read as sunlight focused on the bottom
    const N = 128, c = document.createElement('canvas'); c.width = c.height = N;
    const g = c.getContext('2d'), img = g.createImageData(N, N), d = img.data, rng = mulberry(7), pts = [];
    for (let i = 0; i < 15; i++) pts.push([rng() * N, rng() * N]);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      let f1 = 1e9, f2 = 1e9;
      for (const p of pts) { let dx = Math.abs(x - p[0]), dy = Math.abs(y - p[1]); if (dx > N / 2) dx = N - dx; if (dy > N / 2) dy = N - dy; const q = dx * dx + dy * dy; if (q < f1) { f2 = f1; f1 = q; } else if (q < f2) f2 = q; }
      const a = clamp(1 - (Math.sqrt(f2) - Math.sqrt(f1)) / 3.6, 0, 1), k = (y * N + x) * 4;
      d[k] = 255; d[k + 1] = 255; d[k + 2] = 236; d[k + 3] = Math.round(a * a * a * 230);
    }
    g.putImageData(img, 0, 0); return c;
  }
  paintBay(g, rng) {
    const WW = this.WW, H = Game.H, r = () => rng();
    for (const b of this.bars) {   // ripple marks on the sand bar
      g.strokeStyle = 'rgba(255,255,255,0.22)'; g.lineWidth = 1.3; g.beginPath();
      for (let i = 0; i < 90; i++) { const a = r() * TAU, q = Math.sqrt(r()), x = b.x + Math.cos(a) * q * b.rx * 0.9, y = b.y + Math.sin(a) * q * b.ry * 0.8; g.moveTo(x, y); g.quadraticCurveTo(x + 5, y - 2.5, x + 11, y); }
      g.stroke();
    }
    for (const p of this.holes) {   // potholes: sand bowls in the grass, a little shell hash on the bottom
      g.fillStyle = 'rgba(30,80,56,0.12)'; ell(g, p.x + 2, p.y - p.r * 0.35, p.r * 0.9, p.r * 0.32); g.fill();
      for (let i = 0; i < 7; i++) { const a = r() * TAU, q = Math.sqrt(r()) * p.r * 0.7; g.fillStyle = r() < 0.5 ? 'rgba(255,255,250,0.5)' : 'rgba(120,110,80,0.3)'; ell(g, p.x + Math.cos(a) * q, p.y + Math.sin(a) * q * 0.8, 1.2, 0.9); g.fill(); }
    }
    g.lineCap = 'round'; g.lineWidth = 1.1;   // turtle grass blades
    for (const col of ['rgba(36,96,64,0.34)', 'rgba(58,122,82,0.3)', 'rgba(28,82,58,0.28)']) {
      g.strokeStyle = col; g.beginPath();
      for (let i = 0; i < 1800; i++) {
        const x = r() * WW, y = r() * H; if (y < this.shoreAt(x) + 10 || this.kindAt(x, y) < 0.55 || this.islandAt(x, y, 6)) continue;
        for (let b = 0; b < 3; b++) { const a = -Math.PI / 2 + (r() - 0.5) * 1.3, l = 2.5 + r() * 4; g.moveTo(x + b * 1.6, y); g.lineTo(x + b * 1.6 + Math.cos(a) * l, y + Math.sin(a) * l); }
      }
      g.stroke();
    }
    g.strokeStyle = 'rgba(255,255,255,0.15)'; g.lineWidth = 1.2; g.beginPath();   // sand ripples on bare bottom
    for (let i = 0; i < 900; i++) { const x = r() * WW, y = r() * H; if (y < this.shoreAt(x) + 16 || this.kindAt(x, y) > 0.25 || this.depthAt(x, y) > 0.42) continue; g.moveTo(x, y); g.quadraticCurveTo(x + 6, y - 2.5, x + 12, y); }
    g.stroke();
    // the channel's drop-off: a soft dark lip with a pale shoulder on both edges
    for (const side of [-1, 1]) for (const [w, col, k] of [[6, 'rgba(18,70,92,0.14)', 0.95], [2, 'rgba(255,255,255,0.09)', 1.22]]) {
      g.strokeStyle = col; g.lineWidth = w; g.beginPath();
      for (let x = -10; x <= WW + 10; x += 8) { const y = this.arrAt(this.chan, x) + side * this.arrAt(this.chanWd, x) * k; x < 0 ? g.moveTo(x, y) : g.lineTo(x, y); }
      g.stroke();
    }
    const spg = ['#7b6a3c', '#8a5a3a', '#5f6b3a', '#a08850', '#6d4c5c'];
    for (let i = 0; i < 80; i++) {   // sponges, sea biscuits and soft coral
      const x = r() * WW, y = r() * H; if (y < this.shoreAt(x) + 30 || y > H - 120 || this.depthAt(x, y) > 0.5 || this.islandAt(x, y, 12)) continue;
      const rr0 = 2.5 + r() * 4;
      g.fillStyle = 'rgba(20,50,40,0.18)'; ell(g, x + 2, y + 2, rr0, rr0 * 0.8); g.fill();
      g.fillStyle = rgba(spg[Math.floor(r() * spg.length)], 0.75); ell(g, x, y, rr0, rr0 * 0.8); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.18)'; ell(g, x - rr0 * 0.3, y - rr0 * 0.3, rr0 * 0.4, rr0 * 0.3); g.fill();
    }
    this.paintShoreWater(g, rng);
  }
  paintGlades(g, rng) {
    const r = () => rng();
    for (const m of this.muds) {   // the mud: speckles and feeding pocks
      for (let i = 0; i < 140; i++) {
        const a = r() * TAU, q = Math.sqrt(r()), x = m.x + Math.cos(a) * q * m.rx * 0.9, y = m.y + Math.sin(a) * q * m.ry * 0.9;
        g.fillStyle = r() < 0.5 ? 'rgba(66,54,34,0.28)' : 'rgba(206,190,142,0.22)'; ell(g, x, y, 1 + r() * 2.2, 0.8 + r() * 1.4); g.fill();
      }
    }
    for (const p of this.holes) {   // deeper potholes
      const rg = g.createRadialGradient(p.x, p.y, 1, p.x, p.y, p.r * 1.2);
      rg.addColorStop(0, 'rgba(24,30,18,0.4)'); rg.addColorStop(1, 'rgba(24,30,18,0)'); g.fillStyle = rg; ell(g, p.x, p.y, p.r * 1.2, p.r); g.fill();
    }
    g.lineCap = 'round'; g.lineWidth = 1;   // shoal grass where it is shallow but not mud
    g.strokeStyle = 'rgba(54,74,36,0.35)'; g.beginPath();
    for (let i = 0; i < 2600; i++) {
      const x = r() * this.WW, y = r() * Game.H; if (y < this.shoreAt(x) + 30 || this.kindAt(x, y) > 0.3 || this.depthAt(x, y) > 0.6 || this.islandAt(x, y, 10)) continue;
      for (let b = 0; b < 2; b++) { const a = -Math.PI / 2 + (r() - 0.5) * 1.2, l = 2 + r() * 4; g.moveTo(x + b * 1.4, y); g.lineTo(x + b * 1.4 + Math.cos(a) * l, y + Math.sin(a) * l); }
    }
    g.stroke();
    for (const o of this.oysters) {   // oyster bars
      g.fillStyle = 'rgba(20,20,12,0.3)'; ell(g, o.x + 2, o.y + 3, o.rx, o.ry, o.rot); g.fill();
      for (let i = 0; i < 46; i++) {
        const a = r() * TAU, q = Math.sqrt(r()), lx = Math.cos(a) * q * o.rx, ly = Math.sin(a) * q * o.ry;
        const x = o.x + lx * Math.cos(o.rot) - ly * Math.sin(o.rot), y = o.y + lx * Math.sin(o.rot) + ly * Math.cos(o.rot);
        g.fillStyle = r() < 0.5 ? '#cfcab6' : '#8f8a76'; ell(g, x, y, 1.5 + r() * 2, 1 + r(), r() * 3); g.fill();
      }
    }
    this.paintShoreWater(g, rng);
  }
  paintShoreWater(g, rng) {
    const WW = this.WW, glass = this.weather.id === 'glass', r = () => rng();
    // the canopy's shade and its reflection on the water
    const bands = [[30, glass ? 0.3 : 0.18], [15, glass ? 0.34 : 0.24]];
    for (const [off, a] of bands) {
      g.fillStyle = `rgba(8,30,20,${a})`; g.beginPath(); g.moveTo(-20, -10);
      for (let x = -20; x <= WW + 20; x += 8) g.lineTo(x, this.shoreAt(x) + off * (0.75 + 0.5 * flNoise(x * 0.02, 1, 3)));
      g.lineTo(WW + 20, -10); g.closePath(); g.fill();
      for (const s of this.islands) { ell(g, s.x + off * 0.3, s.y + off * 0.4, s.rx + off * 0.6, s.ry + off * 0.75); g.fill(); }
    }
    // red mangrove prop roots arching into the water
    g.lineCap = 'round'; g.strokeStyle = 'rgba(88,58,34,0.92)'; g.lineWidth = 1.5; g.beginPath();
    for (let x = -10; x < WW + 10; x += 3 + r() * 5) {
      const y0 = this.shoreAt(x) - 6; if (y0 < -10) continue;
      const len = 9 + r() * 14, dx = (r() - 0.5) * 14;
      g.moveTo(x, y0); g.quadraticCurveTo(x + dx * 0.2, y0 + len * 0.7, x + dx, y0 + len);
    }
    for (const s of this.islands) {
      for (let a = 0; a < TAU; a += 0.04 + r() * 0.06) {
        const ca = Math.cos(a), sa = Math.sin(a), x0 = s.x + ca * s.rx * 0.9, y0 = s.y + sa * s.ry * 0.86, len = 7 + r() * 12;
        g.moveTo(x0, y0); g.quadraticCurveTo(x0 + ca * len * 0.5, y0 + sa * len * 0.3 + len * 0.35, x0 + ca * len, y0 + sa * len * 0.55 + len * 0.45);
      }
    }
    g.stroke();
    for (const b of this.birds) this.paintBird(g, b);
  }
  paintBird(g, b) {
    const heron = b.kind === 'heron', s = heron ? 1.4 : 1, body = heron ? '#8b9ba6' : '#f7f8f4';
    g.save(); g.translate(b.x, b.y); g.rotate(b.a); g.scale(s, s);
    g.fillStyle = 'rgba(0,0,0,0.2)'; ell(g, 3, 4, 7, 3.2); g.fill();
    g.strokeStyle = 'rgba(40,40,30,0.6)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-1, 0); g.lineTo(-4, 6); g.moveTo(1, 0); g.lineTo(-2, 6); g.stroke();
    g.fillStyle = body; ell(g, 0, 0, 7, 3.4); g.fill();
    g.strokeStyle = body; g.lineWidth = 1.7; g.beginPath(); g.moveTo(5, 0); g.quadraticCurveTo(9, -3.5, 11, 0); g.stroke();
    g.fillStyle = heron ? '#3b4650' : body; ell(g, 11.5, 0, 1.9, 1.6); g.fill();
    g.strokeStyle = '#e8b830'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(13, 0); g.lineTo(17, 0.5); g.stroke();
    g.restore();
  }
  paintBridge(g, rng) {
    const WW = this.WW, H = Game.H, r = () => rng();
    g.strokeStyle = 'rgba(232,242,222,0.16)'; g.lineWidth = 1.6; g.lineCap = 'round'; g.beginPath();   // sand waves across the tide
    for (let i = 0; i < 800; i++) { const x = r() * WW, y = r() * H; if (y < this.arrAt(this.shoal, x) - 10 || this.kindAt(x, y) < 0.35) continue; const l = 10 + r() * 18; g.moveTo(x, y); g.quadraticCurveTo(x + l / 2, y + 2.5, x + l, y); }
    g.stroke();
    g.strokeStyle = 'rgba(40,96,66,0.34)'; g.lineWidth = 1.1; g.beginPath();   // grass clumps on the shoal
    for (let i = 0; i < 1600; i++) { const x = r() * WW, y = r() * H; if (y < this.arrAt(this.shoal, x) + 20 || this.kindAt(x, y) > 0.4) continue; for (let b = 0; b < 3; b++) { const a = Math.PI / 2 + (r() - 0.5) * 1.2, l = 2 + r() * 4; g.moveTo(x + b * 1.5, y); g.lineTo(x + b * 1.5 + Math.cos(a) * l, y + Math.sin(a) * l); } }
    g.stroke();
    for (const p of this.pilings) for (let i = 0; i < 14; i++) {   // rubble at the footings
      const x = p.x + (r() - 0.5) * 90, y = p.y + 4 + r() * 40, rr0 = 3 + r() * 6;
      g.fillStyle = 'rgba(4,24,24,0.3)'; ell(g, x + 2, y + 2, rr0, rr0 * 0.75); g.fill();
      g.fillStyle = r() < 0.5 ? '#4f5b52' : '#5f6a5e'; ell(g, x, y, rr0, rr0 * 0.75, r()); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.12)'; ell(g, x - rr0 * 0.3, y - rr0 * 0.25, rr0 * 0.4, rr0 * 0.25); g.fill();
    }
    // the bridge's shadow lies on the water just down-tide of the deck
    const sg = g.createLinearGradient(0, FL_DECK, 0, FL_DECK + 74);
    sg.addColorStop(0, 'rgba(4,24,26,0.6)'); sg.addColorStop(0.45, 'rgba(4,24,26,0.28)'); sg.addColorStop(1, 'rgba(4,24,26,0)');
    g.fillStyle = sg; g.fillRect(0, FL_DECK, WW, 74);
    for (const p of this.pilings) for (const ox of [-22, 22]) {   // the columns, seen under the edge of the deck
      const x = p.x + ox;
      g.fillStyle = 'rgba(0,0,0,0.3)'; ell(g, x + 5, p.y + 4, 11, 4); g.fill();
      const cg = g.createLinearGradient(x - 7, 0, x + 7, 0); cg.addColorStop(0, '#aca79b'); cg.addColorStop(0.6, '#8e897f'); cg.addColorStop(1, '#67635b');
      g.fillStyle = cg; g.fillRect(x - 7, FL_DECK - 6, 14, p.y - FL_DECK + 6);
      g.fillStyle = '#39463a'; g.fillRect(x - 7, p.y - 8, 14, 8);
      g.fillStyle = 'rgba(214,200,120,0.35)'; g.fillRect(x - 7, p.y - 10, 14, 2);
    }
  }
  paintCanopy(g, rng) {
    const WW = this.WW, glades = this.variant === 'glades', r = () => rng();
    const P = glades ? ['#163822', '#1e4829', '#285a31', '#386c35', '#58873f'] : ['#1a4029', '#225232', '#2d653b', '#3b7845', '#5a965a'];
    const bg = g.createLinearGradient(0, 0, 0, 170); bg.addColorStop(0, P[0]); bg.addColorStop(1, P[1]);
    g.fillStyle = bg; g.beginPath(); g.moveTo(-20, -10);
    for (let x = -20; x <= WW + 20; x += 6) g.lineTo(x, this.shoreAt(x) - 7);
    g.lineTo(WW + 20, -10); g.closePath(); g.fill();
    const crown = (x, y, rad, lit) => {
      g.fillStyle = P[1 + Math.floor(r() * 3)]; ell(g, x, y, rad, rad * 0.84); g.fill();
      g.fillStyle = rgba(P[4], lit); ell(g, x - rad * 0.28, y - rad * 0.3, rad * 0.52, rad * 0.38); g.fill();
    };
    for (let i = 0; i < WW / 2.5; i++) { const x = r() * WW, sy = this.shoreAt(x); if (sy < 12) continue; crown(x, r() * (sy - 12), 8 + r() * 15, 0.3); }
    for (let x = -10; x < WW + 10; x += 6 + r() * 6) {   // the bumpy outer edge hanging over the water
      const sy = this.shoreAt(x); if (sy < -4) continue; const rad = 9 + r() * 13;
      g.fillStyle = 'rgba(0,0,0,0.16)'; ell(g, x + 3, sy - rad * 0.55 + 4, rad, rad * 0.8); g.fill();
      crown(x, sy - rad * 0.68, rad, 0.42);
    }
    for (const s of this.islands) {
      g.fillStyle = P[1]; ell(g, s.x, s.y - 4, s.rx * 0.92, s.ry * 0.88); g.fill();
      for (let a = 0; a < TAU; a += 0.11 + r() * 0.08) { const rad = 9 + r() * 11; g.fillStyle = 'rgba(0,0,0,0.16)'; ell(g, s.x + Math.cos(a) * s.rx * 0.82 + 3, s.y + Math.sin(a) * s.ry * 0.78 + 2, rad, rad * 0.8); g.fill(); crown(s.x + Math.cos(a) * s.rx * 0.82, s.y + Math.sin(a) * s.ry * 0.78 - 4, rad, 0.42); }
      for (let i = 0; i < 26; i++) { const a = r() * TAU, q = Math.sqrt(r()) * 0.7; crown(s.x + Math.cos(a) * q * s.rx, s.y - 6 + Math.sin(a) * q * s.ry, 8 + r() * 12, 0.36); }
    }
  }
  paintDeck(g, rng) {
    const WW = this.WW, D = FL_DECK, r = () => rng();
    g.fillStyle = '#c9c5ba'; g.fillRect(0, 0, WW, D - 12);
    const ag = g.createLinearGradient(0, 6, 0, D - 20); ag.addColorStop(0, '#4c4e50'); ag.addColorStop(1, '#55575a');
    g.fillStyle = ag; g.fillRect(0, 6, WW, D - 26);   // the road
    for (let i = 0; i < 220; i++) { g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.09)'; ell(g, r() * WW, 9 + r() * (D - 32), 6 + r() * 22, 1.2 + r() * 2.5); g.fill(); }
    for (let x = 0; x < WW; x += 96) { g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x, 6, 1.5, D - 26); }   // expansion joints
    g.fillStyle = '#e8c33a'; g.fillRect(0, 27, WW, 1.4); g.fillRect(0, 30.2, WW, 1.4);
    g.fillStyle = 'rgba(255,255,255,0.82)'; g.fillRect(0, 9, WW, 1.4); g.fillRect(0, D - 23.5, WW, 1.4);
    g.fillStyle = '#ddd9ce'; g.fillRect(0, D - 20, WW, 7); g.fillRect(0, 0, WW, 6);   // barriers
    g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(0, D - 13.5, WW, 1.5); g.fillRect(0, 6, WW, 1.2);
    const fg = g.createLinearGradient(0, D - 13, 0, D); fg.addColorStop(0, '#8f8b81'); fg.addColorStop(1, '#6a665e');
    g.fillStyle = fg; g.fillRect(0, D - 13, WW, 13); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, D - 1.5, WW, 1.5);
    for (let x = 140; x < WW; x += 300) {   // light poles leaning out over the road
      g.strokeStyle = '#8c887f'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(x, D - 17); g.lineTo(x - 2, D - 33); g.stroke();
      g.fillStyle = '#9a968c'; g.fillRect(x - 3, D - 20, 6, 6); g.fillStyle = '#f2ecc8'; ell(g, x - 2, D - 34, 4, 2.2); g.fill();
    }
    for (let i = 0; i < 6; i++) {   // pelicans loafing on the rail
      const x = 40 + r() * (WW - 80), y = D - 17;
      g.fillStyle = 'rgba(0,0,0,0.2)'; ell(g, x + 2, y + 3, 7, 3.5); g.fill();
      g.fillStyle = '#8a7c66'; ell(g, x, y, 7, 3.6); g.fill(); g.fillStyle = '#efe7d2'; ell(g, x + 6, y - 1, 2.6, 2.2); g.fill();
      g.fillStyle = '#c7a24a'; g.beginPath(); g.moveTo(x + 7.5, y - 1.5); g.lineTo(x + 15, y + 0.5); g.lineTo(x + 7.5, y + 0.5); g.fill();
    }
  }

  /* ---------- fish: who turns up where, and how they give themselves away ---------- */
  liveUnits() { const u = new Set(); for (const f of this.fishList) if (f.state !== 'spooked' && !f.leaving) u.add(f.unit); return u.size; }
  pickSpecies() {
    const tbl = FLATS_WEIGHT[this.variant] || {}, live = new Set(this.fishList.map((f) => f.key)); let total = 0; const w = [];
    for (const k of this.speciesList) { const x = (tbl[k] || 1) * (live.has(k) ? 0.35 : 1); w.push([k, x]); total += x; }
    let roll = Math.random() * total; for (const [k, x] of w) if ((roll -= x) <= 0) return k;
    return w[0][0];
  }
  spawnFish(near) {
    const key = this.pickSpecies(), p = this.plan(key, near), unit = ++this.unitN;
    let lead = null;
    for (let i = 0; i < p.n; i++) {
      const f = this.makeFish(key, p, unit);
      if (p.brain === 'school' && lead) { f.lead = lead; f.off = { x: -rand(14, 30) * Math.ceil(i / 2), y: (i % 2 ? 1 : -1) * rand(10, 22) }; f.x = lead.x + f.off.x; f.y = lead.y + f.off.y; f.speed = lead.speed; }
      else if (p.n > 1 && lead) { f.home = { x: p.x + rand(-26, 26), y: p.y + rand(-10, 14) }; f.x = f.home.x; f.y = f.home.y; }
      if (!lead) lead = f;
      this.fishList.push(f);
    }
    return lead;
  }
  makeFish(key, p, unit) {
    const sp = SPECIES[key], w = rollWeight(key, this.perks);
    const len = (30 + 50 * sizeNorm(key, w)) * (key === 'tarpon' ? 1.9 : key === 'permit' ? 1.1 : key === 'blackdrum' ? 1.15 : key === 'ladyfish' ? 0.9 : 1);
    const life = { tail: rand(26, 42), hold: rand(40, 64), roll: rand(28, 42), school: rand(22, 32) }[p.brain] || rand(30, 46);
    return {
      key, sp, w, x: p.x, y: p.y, hd: p.hd, speed: sp.speed * rand(0.85, 1.15) * (p.brain === 'school' ? 1.25 : p.brain === 'roll' ? 0.85 : 1), len,
      brain: p.brain, home: { x: p.x, y: p.y }, face: p.face == null ? p.hd : p.face, cover: !!p.cover, wander: p.wander || 0,
      unit, lead: null, off: null, t: rand(0, 5), seed: rand(0, 100), state: 'cruise', interest: 0, lastStrip: 0, spd: 0,
      turnT: rand(1, 3), tailT: rand(0.6, 2.5), tailing: 0, rollT: rand(1.2, 4), roll: 0, popT: rand(3, 9), pop: 0, leapT: rand(1.5, 4), leap: 0, blitzT: rand(0.8, 3), blitz: 0,
      alpha: 0, life, leaving: false, called: false, calledAt: -99, seen: 0, seenFar: 0, gone: false
    };
  }
  // where a fresh fish shows up and what it is doing, by species and by spot
  plan(key, near) {
    const V = this.variant, W = Game.W, H = Game.H, WW = this.WW, s = this.skiff();
    // the first fish of a turn shows up in view; later ones mostly near the skiff, some further down the flat
    let x = clamp(near ? rand(this.camX + 70, this.camX + W - 70) : chance(0.7) ? rand(this.camX - 240, this.camX + W + 240) : rand(60, WW - 60), 60, WW - 60);
    if (Math.abs(x - s.x) < 220) x = s.x + (x < s.x ? -1 : 1) * rand(220, 320);
    if (this.creek && Math.abs(x - this.creek.x) < 110) x = this.creek.x + (x < this.creek.x ? -1 : 1) * rand(120, 200);   // not up the creek
    x = clamp(x, 60, WW - 60);
    const top = () => this.topY(x), side = () => (chance(0.5) ? 0 : Math.PI) + rand(-0.35, 0.35);
    const flat = () => clamp(rand(top() + 80, H - 190), top() + 60, H - 175);
    const pr = { brain: 'cruise', x, y: 0, hd: side(), n: 1, face: null, cover: false, wander: 0 };
    const nearest = (list) => { let b = null, bd = 1e9; for (const o of list || []) { const d = Math.abs(o.x - x) + (Math.abs(o.x - s.x) < 200 ? 400 : 0); if (d < bd) { bd = d; b = o; } } return b; };
    const roots = () => {   // tight to the mangroves: along the bank or around the island
      const isl = this.islands.find((i) => Math.abs(i.x - x) < 420);
      if (isl && chance(0.45)) { const a = rand(0.15, Math.PI - 0.15); pr.x = isl.x + Math.cos(a) * (isl.rx + 12); pr.y = isl.y + Math.sin(a) * (isl.ry + 10); pr.face = a + rand(-0.4, 0.4); }
      else if (this.creek && V === 'glades' && chance(0.3)) { pr.x = this.creek.x + rand(-60, 60); pr.y = this.topY(pr.x) + rand(14, 30); pr.face = Math.PI / 2 + rand(-0.6, 0.6); }
      else { pr.y = top() + rand(10, 22); pr.face = Math.PI / 2 + rand(-0.5, 0.5); }
      pr.brain = 'hold'; pr.cover = true; pr.hd = pr.face;
    };
    const piling = () => { const p = nearest(this.pilings); pr.x = p.x + rand(-28, 28); pr.y = p.y + rand(16, 48); pr.face = -Math.PI / 2 + rand(-0.25, 0.25); pr.hd = pr.face; pr.brain = 'hold'; pr.cover = true; };
    const onMud = () => { const m = nearest(this.muds); const a = rand(0, TAU), q = Math.sqrt(Math.random()) * 0.7; pr.x = m.x + Math.cos(a) * q * m.rx; pr.y = m.y + Math.sin(a) * q * m.ry; pr.brain = 'tail'; pr.hd = rand(0, TAU); };
    if (V === 'bay') {
      const cy = this.arrAt(this.chan, x), cw = this.arrAt(this.chanWd, x);
      const offChan = (y) => (Math.abs(y - cy) < cw + 24 ? cy + (y < cy ? -1 : 1) * (cw + rand(26, 50)) : y);
      if (key === 'bonefish') {
        const bar = this.bars[0];
        if (bar && Math.abs(bar.x - x) < 500 && chance(0.4)) { pr.x = bar.x + rand(-0.8, 0.8) * bar.rx; pr.y = bar.y + rand(-0.6, 0.6) * bar.ry; pr.brain = 'tail'; }
        else { pr.y = offChan(flat()); pr.brain = chance(0.55) ? 'tail' : 'cruise'; }
      } else if (key === 'permit') { pr.y = cy + (chance(0.5) ? -1 : 1) * (cw + rand(16, 40)); pr.brain = chance(0.4) ? 'tail' : 'cruise'; }
      else if (key === 'tarpon') { pr.y = cy + rand(-8, 8); pr.brain = 'roll'; }
      else if (key === 'redfish') { pr.y = top() + rand(30, 84); pr.brain = chance(0.6) ? 'tail' : 'cruise'; }
      else if (key === 'snook') { if (chance(0.75)) roots(); else { pr.y = top() + rand(30, 60); } }
      else if (key === 'trout' && this.holes.length) { const h = nearest(this.holes); pr.x = h.x; pr.y = h.y; pr.brain = 'hold'; pr.wander = h.r * 0.6; pr.face = rand(0, TAU); pr.hd = pr.face; }
      else if (key === 'jack') { pr.y = flat(); pr.brain = 'school'; pr.n = randi(3, 4); }
      else pr.y = flat();
    } else if (V === 'bridge') {
      if (key === 'tarpon') { pr.y = rand(112, 250); pr.brain = 'roll'; }
      else if (key === 'jack') { pr.y = rand(150, 320); pr.brain = 'school'; pr.n = randi(3, 5); }
      else if (key === 'ladyfish') { pr.y = rand(130, 330); pr.brain = 'school'; pr.n = randi(2, 3); }
      else if (key === 'snook' && this.pilings.length) piling();
      else if (key === 'mangrove' && this.pilings.length) { piling(); pr.n = chance(0.5) ? 2 : 1; }
      else if (key === 'permit') pr.y = chance(0.5) ? rand(124, 190) : clamp(this.arrAt(this.shoal, x) - rand(10, 50), 200, H - 180);
      else pr.y = rand(130, 320);
    } else {
      if (key === 'snook') { if (chance(0.8)) roots(); else { pr.y = top() + rand(30, 70); } }
      else if (key === 'redfish') { if (chance(0.6) && this.muds.length) onMud(); else { pr.y = top() + rand(28, 70); } }
      else if (key === 'blackdrum' && this.muds.length) { onMud(); pr.n = chance(0.35) ? 2 : 1; }
      else if (key === 'tarpon') { if (this.creek && Math.abs(this.creek.x - x) < 500 && chance(0.4)) { pr.x = this.creek.x + rand(-80, 80); pr.y = this.creek.y + rand(40, 110); } else pr.y = rand(240, 340); pr.brain = 'roll'; }
      else if (key === 'trout' && this.holes.length) { const h = nearest(this.holes); pr.x = h.x; pr.y = h.y; pr.brain = 'hold'; pr.wander = h.r * 0.7; pr.face = rand(0, TAU); pr.hd = pr.face; }
      else if (key === 'jack') { pr.y = top() + rand(40, 100); pr.brain = 'school'; pr.n = randi(2, 4); }
      else pr.y = flat();
    }
    pr.x = clamp(pr.x, 40, WW - 40);
    if (!pr.y) pr.y = flat();
    if (pr.brain === 'hold') pr.y = Math.max(pr.y, 74);
    else {
      pr.y = clamp(pr.y, Math.max(this.topY(pr.x) + 26, 104), H - 175);
      const isl = this.islandAt(pr.x, pr.y, 30); if (isl) pr.y = isl.y + isl.ry + 40;
    }
    return pr;
  }
  vis(f) {
    if (f.alpha <= 0) return 0;
    let v = f.sp.vis * FLATS_VIS * this.K.clarity * Math.pow(this.weather.vis || 1, 1.4);
    v *= 1 - 0.55 * this.depthAt(f.x, f.y);
    if (f.cover) v *= 0.55;                              // tucked into the shade of roots or pilings
    v *= 1 - 0.6 * this.glareAt(f.x - this.camX, f.y);   // lost in the sun on the water
    const d = dist(f.x, f.y, this.bx, Game.H - 70); if (d < 280) v += (1 - d / 280) * 0.22;
    if (f.state === 'follow' || f.state === 'eat') v = Math.max(v + 0.2, 0.55);
    if (f.roll > 0) v = Math.max(v, 0.75);
    if (f.leap > 0) v = 1;
    return clamp(v, 0, 1) * f.alpha;
  }
  // how loudly a fish is advertising itself right now (tails, rolls, pops, wakes)
  signal(f) {
    let s = this.vis(f) / Math.max(0.05, f.alpha);
    if (f.tailing > 0) s = Math.max(s, 0.85 * this.tailK);
    if (f.roll > 0 || f.pop > 0 || f.leap > 0 || f.blitz > 0) s = 1;
    if (f.brain === 'school') s = Math.max(s, 0.5 * Math.min(1.3, this.wakeK));
    if ((f.spd || 0) > 18) s = Math.max(s, 0.42 * this.wakeK * (1 - this.depthAt(f.x, f.y)));
    return clamp(s, 0, 1) * f.alpha;
  }
  turnTo(f, ang, rate, dt) { f.hd += clamp(angleDiff(f.hd, ang), -rate * dt, rate * dt); }
  leave(f) {
    f.leaving = true; if (f.lead) return;
    f.brain = f.brain === 'school' ? 'school' : 'cruise'; f.hd = (f.x < this.bx ? Math.PI : 0) + rand(-0.3, 0.3);
  }
  brainCruise(f, dt) {
    f.turnT -= dt; if (f.turnT <= 0) { f.hd += rand(-0.5, 0.5) * (f.brain === 'roll' ? 0.6 : 1); f.turnT = rand(1.6, 3.6); }
    if (Math.abs(Math.sin(f.hd)) > 0.6) this.turnTo(f, Math.cos(f.hd) >= 0 ? 0 : Math.PI, 0.5, dt);   // run along the flat
    if (f.brain === 'roll') { f.rollT -= dt; if (f.rollT <= 0) { this.rollFish(f); f.rollT = rand(3.5, 7.5); } }
    if (f.brain === 'school') {
      if (f.key === 'jack') { f.blitzT -= dt; if (f.blitzT <= 0) { this.blitzFish(f); f.blitzT = rand(2.2, 4.8); } }
      else { f.leapT -= dt; if (f.leapT <= 0) { const m = this.fishList.filter((o) => o.unit === f.unit && o.state === 'cruise'); this.leapFish(pick(m.length ? m : [f])); f.leapT = rand(2, 4.5); } }
    }
    if (f.wakeT == null || (f.wakeT -= dt) <= 0) { f.wakeT = rand(0.35, 0.8); if (this.wakeK * (1 - this.depthAt(f.x, f.y)) > 0.35 && this.onScreen(f, 40)) this.parts.add({ kind: 'ring', x: f.x + Math.cos(f.hd) * f.len * 0.5, y: f.y + Math.sin(f.hd) * f.len * 0.5, size: f.len * 0.1, grow: 14, life: 0.9, color: 'rgba(255,255,255,0.3)', flat: 0.55, lw: 1.3 }); }
    return f.speed;
  }
  brainTail(f, dt) {
    f.tailT -= dt;
    if (f.tailing > 0) {
      f.tailing -= dt;
      const tx = f.x - Math.cos(f.hd) * f.len * 0.5, ty = f.y - Math.sin(f.hd) * f.len * 0.5, hx = f.x + Math.cos(f.hd) * f.len * 0.35, hy = f.y + Math.sin(f.hd) * f.len * 0.35;
      if (chance(dt * 2.4)) this.puff(hx, hy, f.len * 0.2 + 4);
      if (chance(dt * 2.6) && this.onScreen(f, 40)) this.parts.add({ kind: 'ring', x: tx, y: ty, size: 2, grow: 22, life: 0.7, color: 'rgba(255,255,255,0.55)', flat: 0.6, lw: 1.4 });
      return f.speed * 0.06;
    }
    if (f.tailT <= 0) { f.tailing = rand(1.8, 3.6); f.tailT = rand(2.4, 5.5) + f.tailing; }
    f.turnT -= dt; if (f.turnT <= 0) { f.hd += rand(-1, 1); f.turnT = rand(1, 2.4); }
    if (dist(f.x, f.y, f.home.x, f.home.y) > 46) this.turnTo(f, Math.atan2(f.home.y - f.y, f.home.x - f.x), 1.6, dt);
    if (chance(dt * 0.35)) this.puff(f.x + Math.cos(f.hd) * f.len * 0.35, f.y + Math.sin(f.hd) * f.len * 0.35, f.len * 0.12 + 3);
    return f.speed * 0.2;
  }
  brainHold(f, dt) {
    const hx = f.home.x + (f.wander ? Math.sin(f.t * 0.23 + f.seed) * f.wander : 0), hy = f.home.y + (f.wander ? Math.cos(f.t * 0.19 + f.seed) * f.wander * 0.6 : 0);
    const dh = dist(f.x, f.y, hx, hy);
    f.popT -= dt;
    if (f.popT <= 0) { f.popT = rand(7, 15); if (f.key === 'snook' || f.key === 'trout' || chance(0.3)) this.popFish(f); }
    if (dh > 8) { this.turnTo(f, Math.atan2(hy - f.y, hx - f.x), 3, dt); return Math.min(f.speed * 0.6, dh * 1.4); }
    this.turnTo(f, f.face + Math.sin(f.t * 0.5 + f.seed) * 0.25, 1.4, dt);
    return 1 + Math.sin(f.t * 0.7 + f.seed);
  }
  followLead(f, dt) {
    const L = f.lead, c = Math.cos(L.hd), s = Math.sin(L.hd);
    const tx = L.x + c * f.off.x - s * f.off.y, ty = L.y + s * f.off.x + c * f.off.y, d = dist(f.x, f.y, tx, ty);
    this.turnTo(f, d > 4 ? Math.atan2(ty - f.y, tx - f.x) : L.hd, 5, dt);
    if (L.leaving && !f.leaving) f.leaving = true;
    return clamp((L.spd || L.speed) + (d - 5) * 1.8, 0, L.speed * 2.2);
  }
  bounds(f, dt) {
    const top = Math.max(this.topY(f.x) + 30, 100), bot = Game.H - 165;
    if (f.y < top) this.turnTo(f, Math.PI / 2, 2.5, dt); else if (f.y > bot) this.turnTo(f, -Math.PI / 2, 2, dt);
    if (f.x < 50) this.turnTo(f, 0, 2, dt); else if (f.x > this.WW - 50) this.turnTo(f, Math.PI, 2, dt);
    const isl = this.islandAt(f.x, f.y, 28); if (isl) this.turnTo(f, Math.atan2(f.y - isl.y, f.x - isl.x), 3, dt);
  }
  noticeFly(f, dt) {
    const L = this.lure, hx = f.x + Math.cos(f.hd) * f.len * 0.4, hy = f.y + Math.sin(f.hd) * f.len * 0.4;
    const d = dist(L.x, L.y, hx, hy), front = Math.cos(angleDiff(f.hd, Math.atan2(L.y - hy, L.x - hx)));
    const k = (f.brain === 'hold' ? 2.2 : f.brain === 'school' ? 2 : 1.5) * this.perks.bite;
    if (d < f.sp.notice * 0.8 && front > 0.3 && chance(dt * k)) this.startFollow(f, 0.3, 'It found the fly');
  }
  startFollow(f, interest, msg) {
    if (f.lead) { f.lead = null; f.brain = 'school'; }   // one jack peels off the school
    f.state = 'follow'; f.interest = interest; f.lastStrip = this.t;
    this.fl.add(f.x, f.y - 26, msg, '#fff', 17);
  }
  updateFish(f, dt) {
    const H = Game.H, s = this.skiff(), sp = f.sp;
    f.t += dt;
    f.alpha = f.leaving ? f.alpha - dt * 0.3 : Math.min(1, f.alpha + dt * 0.45);
    f.roll = Math.max(0, f.roll - dt); f.pop = Math.max(0, f.pop - dt); f.leap = Math.max(0, f.leap - dt); f.blitz = Math.max(0, f.blitz - dt);
    if (f.lead && (f.lead.gone || f.lead.state !== 'cruise')) { if (f.lead.state === 'spooked' && f.state === 'cruise') this.spookFish(f, null); f.lead = null; }
    const cur = this.current(f.x, f.y);
    if (f.state === 'cruise') {
      f.life -= dt; if (f.life <= 0 && !f.leaving) this.leave(f);
      let spd;
      if (f.lead) spd = this.followLead(f, dt);
      else if (f.brain === 'tail' && !f.leaving) spd = this.brainTail(f, dt);
      else if (f.brain === 'hold' && !f.leaving) spd = this.brainHold(f, dt);
      else spd = this.brainCruise(f, dt);
      f.spd = spd;
      if (!f.leaving && f.brain !== 'hold') this.bounds(f, dt);
      const ck = f.brain === 'hold' && !f.leaving ? 0 : 0.35;
      f.x += (Math.cos(f.hd) * spd + cur.x * ck) * dt; f.y += (Math.sin(f.hd) * spd + cur.y * ck) * dt;
      if (dist(f.x, f.y, s.x, s.y - 30) < (Math.abs(this.poleV) > 12 ? 128 : 100)) this.spookFish(f, this.onScreen(f) ? 'Spooked by the boat' : null);
      else if (this.lure && !this.cast && !this.eat) this.noticeFly(f, dt);
    } else if (f.state === 'follow') {
      if (!this.lure) { f.state = 'cruise'; return; }
      const L = this.lure, dd = dist(f.x, f.y, L.x, L.y);
      f.hd += angleDiff(f.hd, Math.atan2(L.y - f.y, L.x - f.x)) * Math.min(1, dt * 4);
      // a fish on the fly closes fast: it can sprint well past its cruising speed to catch up
      const gap = dd - f.len * 0.55, spd = gap > 0 ? Math.min(sp.speed * 1.3 + gap * 1.2, sp.speed * 3) : 4; f.spd = spd;
      f.x += (Math.cos(f.hd) * spd + cur.x * 0.9) * dt; f.y += (Math.sin(f.hd) * spd + cur.y * 0.9) * dt;
      if (this.t - f.lastStrip > sp.strip * 3) f.interest -= dt * 0.12;
      if (f.interest <= 0) { f.state = 'cruise'; f.hd += rand(-1.2, 1.2); this.fl.add(f.x, f.y - 26, 'Refused', PAL.warn, 18); }
      else if (f.interest >= 1 && dd < f.len * 0.65 && !this.eat) {
        // the window to set the hook: at least a strip on the fish's own rhythm, so tapping at its pace sets it
        const win = Math.max(0.6, sp.strip + 0.25) * this.perks.window * (this.coach ? 1.4 : 1);
        this.eat = { f, t: win, t0: win }; f.state = 'eat';
        Game.toast('IT ATE IT! TAP TO SET!', { color: PAL.sun, size: 44, y: 140, dur: win }); SFX.play('bite'); Game.vibrate(80);
        this.parts.add({ kind: 'ring', x: L.x, y: L.y, size: 4, grow: 50, life: 0.6, color: 'rgba(255,255,255,0.8)', flat: 0.6, lw: 2.5 });
      }
    } else if (f.state === 'eat') {
      f.hd += Math.sin(this.t * 20) * 0.02; f.x += cur.x * 0.9 * dt; f.y += cur.y * 0.9 * dt; f.spd = 0;
    } else if (f.state === 'spooked') {
      f.x += Math.cos(f.hd) * f.speed * dt; f.y += Math.sin(f.hd) * f.speed * dt; f.alpha -= dt * 0.6; f.spd = f.speed;
      if (chance(dt * 10)) this.parts.add({ kind: 'ring', x: f.x, y: f.y, size: 3, grow: 30, life: 0.5, color: 'rgba(255,255,255,0.35)', flat: 0.6 });
    }
    if (f.alpha <= 0 && (f.leaving || f.state === 'spooked')) f.gone = true;
    if (f.x < -100 || f.x > this.WW + 100 || f.y < -80 || f.y > H + 60) f.gone = true;
  }
  rollFish(f) {
    f.roll = 1.15;
    if (!this.onScreen(f, 60)) return;
    for (let i = 0; i < 2; i++) this.parts.add({ kind: 'ring', x: f.x, y: f.y, size: 6 + i * 6, grow: 46, life: 1.2, color: 'rgba(255,255,255,0.55)', flat: 0.6, lw: 1.8 });
    this.parts.burst(f.x, f.y, 8, { color: ['#ffffff', '#dff2f2'], min: 20, max: 70, lifeMin: 0.3, lifeMax: 0.7, sMin: 1.2, sMax: 2.6, drag: 3 });
    SFX.play('plop');
    if (f.called && this.t - f.calledAt > 10 && f.state === 'cruise' && !this.lure && (!this.callout || this.callout.t < 0.5)) this.callFish(f, false, true);
  }
  popFish(f) {
    f.pop = 0.8;
    if (!this.onScreen(f, 60)) return;
    const hx = f.x + Math.cos(f.hd) * f.len * 0.45, hy = f.y + Math.sin(f.hd) * f.len * 0.45;
    this.parts.add({ kind: 'ring', x: hx, y: hy, size: 3, grow: 40, life: 0.9, color: 'rgba(255,255,255,0.7)', flat: 0.6, lw: 2 });
    this.parts.burst(hx, hy, 7, { color: ['#ffffff', '#e8f6f4'], min: 25, max: 80, lifeMin: 0.25, lifeMax: 0.55, sMin: 1, sMax: 2.4, drag: 3 });
    SFX.play('plop');
  }
  blitzFish(f) {
    f.blitz = 0.9;
    if (!this.onScreen(f, 60)) return;
    const hx = f.x + Math.cos(f.hd) * f.len, hy = f.y + Math.sin(f.hd) * f.len;
    this.parts.burst(hx, hy, 16, { color: ['#f2fbff', '#cfe6ee', '#ffffff'], min: 30, max: 120, lifeMin: 0.25, lifeMax: 0.6, sMin: 1, sMax: 2.2, drag: 2.5 });
    for (let i = 0; i < 3; i++) this.parts.add({ kind: 'ring', x: hx + rand(-14, 14), y: hy + rand(-10, 10), size: 3, grow: 34, life: 0.7, color: 'rgba(255,255,255,0.6)', flat: 0.6, lw: 1.6 });
    if (chance(0.6)) SFX.play('splash');
  }
  leapFish(f) {
    f.leap = 0.6;
    if (!this.onScreen(f, 60)) return;
    this.parts.add({ kind: 'ring', x: f.x, y: f.y, size: 3, grow: 34, life: 0.8, color: 'rgba(255,255,255,0.6)', flat: 0.6, lw: 1.6 });
    SFX.play('plop');
  }
  puff(x, y, size) {
    if (this.puffs.length > 36) this.puffs.shift();
    this.puffs.push({ x, y, r: size, life: rand(2.4, 3.6), t: 0 });
  }
  spawnCritter() {
    const kind = pick(this.K.critters), W = Game.W, left = chance(0.5);
    const x = left ? this.camX - 90 : this.camX + W + 90, y = clamp(rand(this.topY(clamp(x, 0, this.WW)) + 90, Game.H - 190), 150, Game.H - 180);
    const c = { kind, x, y, hd: (left ? 0 : Math.PI) + rand(-0.2, 0.2), speed: { ray: 20, shark: 36, cuda: 4, turtle: 15, manatee: 9 }[kind], len: { ray: 44, shark: 78, cuda: 62, turtle: 30, manatee: 108 }[kind], t: rand(0, 9), alpha: 0, life: rand(20, 34) };
    if (kind === 'cuda') { c.x = this.camX + rand(120, W - 120); c.life = rand(12, 20); }   // a barracuda just hangs there
    if (!this.islandAt(c.x, c.y, 30)) this.critters.push(c);
  }

  /* ---------- input ---------- */
  pointerDown(p) {
    if (this.basePointerDown(p) || this.help) return;
    if (this.eat) { this.setHook(); return; }
    if (this.cast || this.snagT > 0) return;
    if (this.lure && !this.aim) {
      // a quick tap while the fly is in the water strips it; a press-and-drag starts a new cast
      this.pending = { id: p.id, x: p.x, y: p.y, t: this.t };
      return;
    }
    this.startAim(p);
  }
  startAim(p) {
    if (p.y > Game.H - 120 && Math.abs(p.x - Game.W / 2) < 60) return;
    if (this.lure) this.pickUp();
    this.aim = { id: p.id, x: p.x, y: p.y, t: 0 };   // screen coordinates while the finger is down
  }
  pointerMove(p) {
    if (this.pending && this.pending.id === p.id && dist(p.x, p.y, this.pending.x, this.pending.y) > 18) { const q = this.pending; this.pending = null; this.startAim({ id: q.id, x: p.x, y: p.y }); }
    if (this.aim && this.aim.id === p.id) { this.aim.x = p.x; this.aim.y = p.y; }
  }
  pointerUp(p, cancel) {
    if (this.pending && this.pending.id === p.id) { this.pending = null; this.strip(); return; }
    if (this.aim && this.aim.id === p.id) { const a = this.aim; this.aim = null; if (!cancel) this.doCast({ x: a.x + this.camX, y: a.y, t: a.t }); }
  }
  keyDown(c) {
    if (this.help) { if (['Space', 'Enter', 'Escape', 'KeyH'].includes(c)) this.closeHelp(); return; }
    if (this.baseKeyDown(c)) return;
    if (c === 'KeyH') { this.openHelp(); return; }
    if (c === 'Space' || c === 'Enter') { if (this.eat) this.setHook(); else if (this.lure) this.strip(); }
    else if (c === 'ArrowLeft' || c === 'KeyA') this.setPole(-1);
    else if (c === 'ArrowRight' || c === 'KeyD') this.setPole(1);
    else if (c === 'ArrowDown' || c === 'KeyS') this.poleDir = 0;
  }
  setPole(d) {
    this.poleDir = this.poleDir === d ? 0 : d;
    if (this.poleDir) { this.everPoled = true; if (this.lure) this.pickUp(); this.pending = null; }
  }
  aimR(d, t) { return lerp(34, 9, clamp(t / 1.0, 0, 1)) * this.weather.aim * (0.6 + d / 600); }
  aimRadius(a) { return this.aimR(dist(Game.W / 2, Game.H - 70, a.x, a.y), a.t); }   // a in screen coordinates
  // a = the target in world coordinates
  doCast(a) {
    if (this.cast || this.snagT > 0) return;
    const s = this.rodTip(); let tx = a.x, ty = a.y;
    const d = dist(s.x, s.y, tx, ty), maxR = 470; if (d > maxR) { tx = s.x + (tx - s.x) * maxR / d; ty = s.y + (ty - s.y) * maxR / d; }
    const r = this.aimR(dist(this.bx, Game.H - 70, a.x, a.y), a.t || 0) * 0.6; tx += gauss() * r; ty += gauss() * r;
    tx = clamp(tx, 10, this.WW - 10); ty = clamp(ty, 40, Game.H - 140);
    this.cast = { sx: s.x, sy: s.y, tx, ty, t: 0, dur: 0.45 + d / 1600 }; SFX.play('cast');
  }
  pickUp() {
    if (!this.lure) return;
    for (const f of this.fishList) if (f.state === 'follow' && dist(f.x, f.y, this.lure.x, this.lure.y) < 50 && chance(0.5)) this.spookFish(f, 'Ripped it out too close');
    for (const f of this.fishList) if (f.state === 'follow') f.state = 'cruise';
    this.lure = null; this.eat = null;
  }
  snagAt(x, y) {
    if (this.variant === 'bridge') return y < FL_DECK || (y < FL_DECK + 26 && this.pilings.some((p) => Math.abs(Math.abs(x - p.x) - 22) < 9));
    return y < this.shoreAt(x) - 4 || !!this.islandAt(x, y, -8);
  }
  land(x, y) {
    if (this.snagAt(x, y)) {
      this.snagT = 1.5; this.lure = null;
      SFX.play('swish');
      this.parts.burst(x, y, 9, { color: this.variant === 'bridge' ? ['#d9d5ca', '#8f8b81'] : ['#3d6b3a', '#6a9a50'], min: 20, max: 70, lifeMin: 0.4, lifeMax: 0.8, sMin: 1.5, sMax: 3, drag: 2 });
      for (const f of this.fishList) if (f.state !== 'spooked' && dist(f.x, f.y, x, y) < 120) this.spookFish(f, null);
      Game.toast(this.variant === 'bridge' ? 'Hit the bridge!' : 'In the mangroves!', { color: PAL.warn, size: 30, y: 130, sub: 'Freeing the fly costs a few seconds' });
      return;
    }
    this.poleDir = 0;   // the poler stops the skiff for the shot
    this.lure = { x, y, t: 0, hop: 0 }; SFX.play('plop');
    this.parts.add({ kind: 'ring', x, y, size: 3, grow: 40, life: 0.8, color: 'rgba(255,255,255,0.7)', flat: 0.6 });
    const tip = this.rodTip(), glass = this.weather.id === 'glass';
    for (const f of this.fishList) {
      if (f.state === 'spooked' || f.alpha < 0.05) continue;
      const hx = f.x + Math.cos(f.hd) * f.len * 0.4, hy = f.y + Math.sin(f.hd) * f.len * 0.4;
      const d = dist(x, y, hx, hy), toL = Math.atan2(y - hy, x - hx), front = Math.cos(angleDiff(f.hd, toL));
      if (d < f.sp.spook * (glass ? 1.15 : 1)) { this.spookFish(f, 'Too close! Spooked it'); continue; }
      // the fly line slapping down across the fish
      if (d > f.sp.notice * 0.45 && flSegDist(f.x, f.y, tip.x, tip.y, x, y) < f.len * 0.2 + 7) { this.spookFish(f, 'Lined it! The line landed on it'); continue; }
      if (d < f.sp.notice && front > 0.2) this.startFollow(f, 0.35, 'It sees it!');
      else if (d < f.sp.notice * 0.6 && front <= 0.2 && chance(0.3)) this.spookFish(f, 'Landed behind it. Spooked');
    }
    const note = { ray: 'Just a ray', shark: 'That’s a shark!', cuda: 'Cuda. Leave him be', turtle: 'Easy, that’s a turtle', manatee: 'Manatee. Let him be' };
    for (const c of this.critters) if (dist(c.x, c.y, x, y) < c.len * 0.7) { this.fl.add(x, y - 22, note[c.kind], '#fff', 17); break; }
  }
  strip() {
    if (!this.lure || this.cast) return;
    const s = this.rodTip(), L = this.lure;
    const ang = Math.atan2(s.y - L.y, s.x - L.x); L.x += Math.cos(ang) * 16; L.y += Math.sin(ang) * 16; L.hop = 0.15;
    SFX.play('strip'); this.parts.add({ kind: 'ring', x: L.x, y: L.y, size: 2, grow: 26, life: 0.5, color: 'rgba(255,255,255,0.5)', flat: 0.6 });
    for (const f of this.fishList) {
      if (f.state !== 'follow') continue;
      const iv = this.t - f.lastStrip, ideal = f.sp.strip; f.lastStrip = this.t;
      if (iv < ideal * 0.55) { f.interest -= 0.14; this.fl.add(f.x, f.y - 24, 'Too fast', PAL.warn, 17); }
      else if (iv > ideal * 2.2) { f.interest += 0.06; this.fl.add(f.x, f.y - 24, 'Slow…', '#cfe3ea', 17); }
      else { f.interest += 0.24 * this.perks.bite; this.fl.add(f.x, f.y - 24, 'Good strip', PAL.good, 17); }
    }
    this.checkFlyAtBoat();
  }
  checkFlyAtBoat() {
    const L = this.lure; if (!L || dist(L.x, L.y, this.bx, Game.H - 70) >= 92) return;
    for (const f of this.fishList) if (f.state === 'follow' || f.state === 'eat') this.spookFish(f, 'It saw the boat');
    this.lure = null; this.eat = null;
  }
  spookFish(f, msg) {
    if (f.state === 'spooked') return;
    f.state = 'spooked'; f.speed = f.sp.speed * 4.5; f.hd += Math.PI + rand(-0.6, 0.6); f.interest = 0; f.tailing = 0;
    if (this.onScreen(f, 30)) {
      for (let i = 0; i < 6; i++) this.parts.add({ kind: 'ring', x: f.x + rand(-10, 10), y: f.y + rand(-10, 10), size: 4, grow: 50, life: 0.7, color: 'rgba(255,255,255,0.45)', flat: 0.6 });
      this.puff(f.x, f.y, f.len * 0.3 + 4);
      SFX.play('splash');
    }
    if (msg) Game.toast(msg, { color: PAL.warn, size: 26, y: 130 });
    if (this.eat && this.eat.f === f) this.eat = null;
    // a school blows up together
    if (f.brain === 'school') for (const o of this.fishList) if (o.unit === f.unit && o !== f && o.state === 'cruise') this.spookFish(o, null);
  }
  setHook() {
    const e = this.eat; if (!e) return; this.eat = null;
    if (this.coach) { this.coach = false; Store.set('coach_flatset_' + this.ch, true); }   // hooked one: you've got it
    const f = e.f; f.gone = true;
    this.fishList = this.fishList.filter((x) => x !== f); this.lure = null; this.poleDir = 0;
    this.lastKey = f.key;
    let rock = 0;
    if (f.key === 'snook') rock = f.cover || f.y < this.topY(f.x) + 70 ? 0.6 : 0.3;
    else if (f.key === 'mangrove' && f.cover) rock = 0.45;
    else if (f.key === 'redfish' && this.variant === 'glades' && f.y < this.topY(f.x) + 50) rock = 0.25;
    this.startFight({ sp: f.key, weight: f.w, ctxType: 'flats', rock });
  }
  onFightDone(r) {
    if (!r.ok) return;
    this.landed.add(r.catch.key);
    const has = (...k) => k.every((x) => this.landed.has(x));
    if (!this.slamDone.grand && has('tarpon', 'bonefish', 'permit')) { this.slamDone.grand = true; this.addLine('GRAND SLAM · tarpon, bonefish, permit', 800); Game.toast('GRAND SLAM!', { color: PAL.sun, size: 56, y: 160, dur: 2.6, sub: 'Tarpon, bonefish and permit in one day' }); SFX.play('slam'); }
    if (!this.slamDone.back && has('snook', 'redfish', 'trout')) { this.slamDone.back = true; this.addLine('Backcountry slam · snook, redfish, trout', 600); Game.toast('BACKCOUNTRY SLAM!', { color: PAL.sun, size: 46, y: 160, dur: 2.4, sub: 'Snook, redfish and trout' }); SFX.play('slam'); }
  }

  /* ---------- update ---------- */
  update(dt) {
    if (this.help && !this.paused) { this.help.t += dt; this.t += dt; Game.toasts = []; return; }   // the clock waits while you read
    if (this.baseUpdate(dt)) return;
    const W = Game.W;
    this.updatePole(dt);
    if (this.aim) this.aim.t += dt;
    this.snagT = Math.max(0, this.snagT - dt);
    if (!this.introSaid && this.t > 1.6) { this.introSaid = true; this.say(this.K.hint, 4.2); }
    // scarce fish: one to three about at a time, a new one every six to ten seconds
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      const live = this.liveUnits();
      if (live < (this.t < 25 ? 2 : 3)) { this.spawnFish(this.spawns < 1); this.spawns++; }
      this.spawnT = live === 0 ? rand(3, 5) : rand(6.5, 10.5);
    }
    this.critT -= dt;
    if (this.critT <= 0) { if (this.critters.length < 1) this.spawnCritter(); this.critT = rand(14, 24); }
    if (this.cast) { this.cast.t += dt; if (this.cast.t >= this.cast.dur) { const c = this.cast; this.cast = null; this.land(c.tx, c.ty); } }
    if (this.lure) {
      const L = this.lure; L.t += dt; L.hop = Math.max(0, L.hop - dt);
      const c = this.current(L.x, L.y); L.x += c.x * dt; L.y += c.y * dt;   // the tide swings the fly
      this.checkFlyAtBoat();
    }
    if (this.eat) { this.eat.t -= dt; if (this.eat.t <= 0) { const f = this.eat.f; this.eat = null; Game.toast('Missed the eat!', { color: PAL.warn, size: 30, y: 130, sub: 'Set it the moment it eats' }); f.state = chance(0.4) ? 'follow' : 'cruise'; f.interest = 0.4; f.lastStrip = this.t; } }
    for (const f of this.fishList) this.updateFish(f, dt);
    this.fishList = this.fishList.filter((f) => !f.gone);
    for (const c of this.critters) {
      c.t += dt; c.life -= dt; c.alpha = c.life < 0 ? c.alpha - dt * 0.4 : Math.min(1, c.alpha + dt * 0.4);
      if (c.kind === 'cuda') c.hd += Math.sin(c.t * 0.4) * 0.002; else if (Math.abs(Math.sin(c.hd)) > 0.3 || chance(dt * 0.3)) c.hd += rand(-0.15, 0.15) * dt * 4;
      const cu = this.current(c.x, c.y);
      c.x += (Math.cos(c.hd) * c.speed + cu.x * 0.3) * dt; c.y = clamp(c.y + (Math.sin(c.hd) * c.speed + cu.y * 0.2) * dt, Math.max(this.topY(clamp(c.x, 0, this.WW)) + 50, 120), Game.H - 170);
      if (c.kind === 'manatee' && chance(dt * 0.7)) this.parts.add({ kind: 'ring', x: c.x - Math.cos(c.hd) * c.len * 0.5, y: c.y - Math.sin(c.hd) * c.len * 0.5, size: 8, grow: 16, life: 2.2, color: 'rgba(255,255,255,0.22)', flat: 0.6, lw: 3 });
    }
    this.critters = this.critters.filter((c) => (c.life > 0 || c.alpha > 0) && c.x > this.camX - 400 && c.x < this.camX + W + 400);
    for (const p of this.puffs) { p.t += dt; const c = this.current(p.x, p.y); p.x += c.x * 0.8 * dt; p.y += c.y * 0.8 * dt; }
    this.puffs = this.puffs.filter((p) => p.t < p.life);
    if (this.variant === 'bridge' && chance(dt * 1.4)) {   // boils welling up in the tide
      const x = this.camX + rand(20, W - 20), y = rand(130, Game.H - 160), c = this.current(x, y);
      this.parts.add({ kind: 'ring', x, y, vx: c.x, vy: c.y, size: rand(4, 9), grow: 12, life: 2.4, color: 'rgba(230,250,242,0.2)', flat: 0.65, lw: 2 });
    }
    for (const car of this.cars) { car.x += car.v * dt; if (car.x > this.WW + 60) car.x -= this.WW + 120; if (car.x < -60) car.x += this.WW + 120; }
    this.spotting(dt);
    if (this.callout) { this.callout.t -= dt; if (this.callout.t <= 0) this.callout = null; }
  }
  updatePole(dt) {
    const W = Game.W, lo = W / 2, hi = this.WW - W / 2;
    this.poleV = approach(this.poleV, this.poleDir * 60, 2.4, dt);
    this.pole += dt * (this.poleDir ? 2.4 : 0.8);
    if (Math.abs(this.poleV) > 0.3) {
      this.bx += this.poleV * (0.62 + 0.38 * Math.sin(this.pole * 2)) * dt;   // surges with each push of the pole
      if (this.bx <= lo || this.bx >= hi) { if (this.poleDir) this.say(this.bx <= lo ? 'That’s the end of the flat this way.' : 'End of the flat. Let’s work back.', 2.6); this.poleDir = 0; this.poleV = 0; }
      if (Math.abs(this.poleV) > 15 && chance(dt * 5)) { const sd = chance(0.5) ? -1 : 1; this.parts.add({ kind: 'ring', x: this.bx + sd * 18, y: Game.H - 70 + rand(-50, 30), size: 3, grow: 18, life: 0.9, color: 'rgba(255,255,255,0.35)', flat: 0.55, lw: 1.3 }); }
    }
    this.clampCam();
  }
  // the poler's eyes: picks out what shows, calls it by the clock, and points out signs further down the flat
  spotting(dt) {
    this.callCool -= dt;
    if (this.pointTo) { this.pointTo.t -= dt; if (this.pointTo.t <= 0 || this.pointTo.f.gone || this.pointTo.f.state === 'spooked' || this.onScreen(this.pointTo.f, -30)) this.pointTo = null; }
    const W = Game.W, H = Game.H, cam = this.camX;
    let best = null, bestFar = false, bestV = 0, anyOn = false;
    for (const f of this.fishList) {
      if (f.state === 'spooked' || f.leaving || f.lead || f.alpha < 0.3) continue;
      const sx = f.x - cam, on = sx > 20 && sx < W - 20 && f.y < H - 140, sig = this.signal(f);
      if (on) { anyOn = true; f.seen += dt * (0.06 + Math.pow(sig, 1.4) * 1.5) * this.eyeK; }
      else if (Math.abs(sx - W / 2) < W * 1.4 && sig > 0.7) f.seenFar += dt * sig * this.eyeK;
      if (f.called) continue;
      const v = on ? f.seen - 1.5 + 1 : f.seenFar - 1.2;
      if ((on ? f.seen > 1.5 : f.seenFar > 1.2) && v > bestV) { best = f; bestFar = !on; bestV = v; }
    }
    if (anyOn || this.lure || this.cast) this.quietT = 0; else this.quietT += dt;
    const busy = this.eat || this.fishList.some((f) => f.state === 'follow');
    if (best && this.callCool <= 0 && (!this.callout || this.callout.t < 0.8) && !busy) this.callFish(best, bestFar);
    else if (this.quietT > 14 && this.poleDir === 0 && this.callCool <= 0 && !this.callout) {
      this.quietT = 0;
      const dir = this.pointTo ? (this.pointTo.f.x < this.bx ? 'left' : 'right') : this.bx < this.WW / 2 ? 'right' : 'left';
      this.say(pick([`Nothing moving here. Let’s pole ${dir} down the flat.`, `Quiet spot. Push us ${dir} with the arrows.`, `Water’s dead here. Try ${dir}.`]), 3.6);
    }
  }
  sayWhat(f) {
    const nm = FL_NAME[f.key] || f.sp.short;
    if (f.brain === 'school') return f.key === 'jack' ? 'Jacks busting bait' : f.key === 'ladyfish' ? 'Ladyfish skyrocketing' : 'School of ' + nm.toLowerCase();
    if (f.tailing > 0) return 'Tailing ' + nm.toLowerCase();
    if (f.key === 'tarpon') return f.roll > 0 ? 'Tarpon rolling' : 'Tarpon';
    if (f.pop > 0) return nm + ' popping';
    if (f.brain === 'tail') return nm + ' feeding';
    if (f.brain === 'hold') return nm + (this.variant === 'bridge' ? ' on the piling' : f.cover ? ' up in the roots' : ' sitting in the hole');
    if (f.key === 'redfish') return 'Redfish pushing water';
    return nm;
  }
  callFish(f, far, again) {
    f.called = true; f.calledAt = this.t; this.callCool = 2.4; this.coachF = f;
    const s = this.skiff(), a = Math.atan2(f.x - s.x, -(f.y - s.y)), hour = Math.round(((a + TAU) % TAU) / (TAU / 12)) % 12;
    const ft = Math.max(10, Math.round(dist(f.x, f.y, s.x, s.y) / 5 / 5) * 5), what = this.sayWhat(f);
    let msg;
    if (far) msg = `${what} ${ft > 200 ? 'way off' : 'off'} to the ${f.x < s.x ? 'left' : 'right'}, ${ft} feet. Pole us over!`;
    else {
      const still = f.brain === 'hold' || (f.brain === 'tail' && !f.leaving);
      const mv = still ? '' : f.brain === 'school' && Math.sin(f.hd) > 0.3 ? 'coming fast' : Math.cos(f.hd) > 0.4 ? 'moving right' : Math.cos(f.hd) < -0.4 ? 'moving left' : Math.sin(f.hd) > 0 ? 'coming at us' : 'heading away';
      msg = `${again ? 'There he is again! ' : ''}${what}, ${CLOCK[hour]} o’clock, ${ft} feet${mv ? ', ' + mv : ''}.`;
    }
    this.callout = { t: 3.4, msg, f, far: !!far };
    if (far) this.pointTo = { f, t: 8 };
  }
  say(msg, dur = 3.4) { this.callout = { t: dur, msg, f: null, far: false }; this.callCool = 2; }

  /* ---------- drawing ---------- */
  draw(ctx) {
    if (this.drawChildOrNull(ctx)) return;
    const W = Game.W, H = Game.H, t = this.t, cam = this.camX, r = this.tres;
    const sw = Math.min(W * r, this.terrain.width), sx = clamp(cam * r, 0, this.terrain.width - sw);
    ctx.drawImage(this.terrain, sx, 0, sw, Math.min(H * r, this.terrain.height), 0, 0, W, H);
    this.drawCaustics(ctx, cam, t);
    ctx.save(); ctx.translate(-cam, 0);
    if (this.variant === 'bridge') this.drawFlow(ctx, cam, t); else if (this.variant === 'glades') this.drawDrift(ctx, cam, t);
    this.drawRipples(ctx, cam, t);
    this.drawPuffs(ctx);
    for (const c of this.critters) if (c.x > cam - 120 && c.x < cam + W + 120) this.drawCritter(ctx, c, t);
    for (const f of this.fishList) if (f.x > cam - 100 && f.x < cam + W + 100) this.drawFlatsFish(ctx, f, t);
    this.parts.draw(ctx);
    ctx.restore();
    this.drawGlare(ctx, t);
    const oh = Math.min(this.overH * r, this.over.height);
    ctx.drawImage(this.over, sx, 0, sw, oh, 0, 0, W, oh / r);
    ctx.save(); ctx.translate(-cam, 0);
    for (const car of this.cars) if (car.x > cam - 40 && car.x < cam + W + 40) this.drawCar(ctx, car);
    const s = this.skiff(), tip = this.rodTip();
    drawSkiffTop(ctx, s.x, s.y, 0.85, { angler: this.ch, poler: this.poler, pole: (Math.sin(this.pole * 0.8) + 1) / 2, aim: this.aim ? Math.atan2(this.aim.y - (H - 70), this.aim.x - W / 2) + Math.PI / 2 : 0 });
    if (this.cast) {
      const k = this.cast.t / this.cast.dur, c = this.cast;
      const x = lerp(c.sx, c.tx, k), y = lerp(c.sy, c.ty, k) - Math.sin(k * Math.PI) * 60;
      ctx.strokeStyle = 'rgba(255,250,220,0.85)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(tip.x, tip.y); ctx.quadraticCurveTo((tip.x + x) / 2, Math.min(tip.y, y) - 50, x, y); ctx.stroke();
    } else if (this.lure) {
      const L = this.lure, cu = this.current(L.x, L.y);
      ctx.strokeStyle = 'rgba(255,250,220,0.75)'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(tip.x, tip.y); ctx.quadraticCurveTo((tip.x + L.x) / 2 + 10 + cu.x * 2, (tip.y + L.y) / 2 + cu.y * 1.5, L.x, L.y); ctx.stroke();
      ctx.fillStyle = '#e8b04a'; ell(ctx, L.x, L.y, 4 + L.hop * 10, 3); ctx.fill(); ctx.fillStyle = '#c0582a'; ell(ctx, L.x - 3, L.y, 2, 2); ctx.fill();
    }
    if (this.eat) { const f = this.eat.f; ctx.strokeStyle = PAL.sun; ctx.lineWidth = 4; ell(ctx, f.x, f.y, f.len * 0.7 + Math.sin(t * 30) * 4, f.len * 0.5); ctx.stroke(); text(ctx, 'TAP!', f.x, f.y - f.len * 0.5 - 14, { size: 24 + Math.sin(t * 20) * 2, align: 'center', color: PAL.sun, weight: 800, stroke: PAL.ink, sw: 5 }); }
    this.fl.draw(ctx);
    ctx.restore();
    if (this.aim) {
      const a = this.aim, rad = this.aimRadius(a), tx = W / 2, ty = H - 130;
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.setLineDash([6, 8]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(a.x, a.y); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = PAL.sun; ctx.lineWidth = 3; ell(ctx, a.x, a.y, rad, rad * 0.7); ctx.stroke();
      ctx.fillStyle = PAL.sun; ell(ctx, a.x, a.y, 3, 3); ctx.fill();
      if (dist(tx, ty, a.x, a.y) > 470) text(ctx, 'Too far · it will fall short', a.x, a.y - rad - 10, { size: 15, align: 'center', color: '#fff', weight: 700, stroke: 'rgba(0,0,0,0.5)', sw: 4 });
    }
    this.drawHud(ctx, W, H);
    if (this.paused) this.drawPause(ctx);
  }
  drawCaustics(ctx, cam, t) {
    if (!this.causticImg) return;
    if (!this.causticPat) this.causticPat = ctx.createPattern(this.causticImg, 'repeat');
    const W = Game.W, H = Game.H, P = 128, wid = this.weather.id, A = this.K.caustic * (wid === 'glass' ? 0.7 : wid === 'breezy' ? 0.75 : 1);
    for (const [sc, vx, vy, a] of [[1.45, 7, 4, 1], [1.95, -5, 7, 0.8]]) {
      ctx.save(); ctx.globalAlpha = A * a; ctx.scale(sc, sc);
      const ox = ((-cam / sc + t * vx) % P) - P, oy = ((t * vy) % P) - P;
      ctx.translate(ox, oy); ctx.fillStyle = this.causticPat; ctx.fillRect(0, 0, W / sc + 2 * P, H / sc + 2 * P);
      ctx.restore();
    }
  }
  drawRipples(ctx, cam, t) {
    const W = Game.W, H = Game.H, wid = this.weather.id, glass = wid === 'glass', breezy = wid === 'breezy';
    const n = glass ? 9 : breezy ? 62 : 36, span = W + 160, drift = t * (breezy ? 22 : glass ? 3 : 10);
    ctx.lineCap = 'round';
    for (const [col, oy, lw] of [['rgba(0,40,50,0.07)', 1.6, 2], [`rgba(255,255,255,${glass ? 0.1 : breezy ? 0.2 : 0.15})`, 0, 1.4]]) {
      ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const h1 = flHash(i, 31, 0), h2 = flHash(i, 32, 0), h3 = flHash(i, 33, 0);
        const x = ((((h1 * span + drift * (0.6 + h3 * 0.8) - cam) % span) + span) % span) - 80 + cam;
        const y = 70 + h2 * (H - 70) + Math.sin(t * 0.9 + i) * 2 + oy, len = glass ? 50 + h3 * 50 : 14 + h3 * 18;
        ctx.moveTo(x, y); ctx.quadraticCurveTo(x + len / 2, y - 2.5 - Math.sin(t * 1.7 + i) * 1.5, x + len, y);
      }
      ctx.stroke();
    }
    if (breezy) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; for (let i = 0; i < 10; i++) { const k = (t * 0.5 + flHash(i, 34, 0)) % 1; if (k > 0.35) continue; const x = ((((flHash(i, 35, 0) * span + drift - cam) % span) + span) % span) - 80 + cam, y = 110 + flHash(i, 36, 0) * (H - 200); ell(ctx, x, y, 7 * (1 - k / 0.35) + 2, 2); ctx.fill(); } }
  }
  drawFlow(ctx, cam, t) {
    // long seams of tide running down-current; the dashes slide along them with the water
    const W = Game.W, H = Game.H, TW = 300;
    ctx.lineCap = 'round';
    for (let grp = 0; grp < 2; grp++) {
      ctx.lineWidth = grp ? 1.4 : 2.2; ctx.strokeStyle = grp ? 'rgba(225,248,238,0.13)' : 'rgba(225,248,238,0.1)';
      ctx.setLineDash(grp ? [26, 46] : [54, 70]); ctx.lineDashOffset = -t * FL_TIDE * (grp ? 1.25 : 1.6); ctx.beginPath();
      for (let ti = Math.floor(cam / TW); ti * TW < cam + W; ti++) for (let i = grp; i < 3; i += 2) {
        let x = ti * TW + (i + flHash(i, 41, ti)) * TW / 3, y = 108 + flHash(i, 42, ti) * 60;
        const ph = flHash(i, 44, ti) * TAU, amp = 6 + flHash(i, 45, ti) * 8;
        ctx.moveTo(x, y);
        while (y < H) {
          const c = this.current(x, y), ny = y + 36, nx = x + c.x * 1.5 + Math.sin(y * 0.026 + ph) * amp * 0.5;
          ctx.quadraticCurveTo(x + Math.sin(y * 0.026 + ph + 0.8) * amp, y + 18, nx, ny); x = nx; y = ny;
        }
      }
      ctx.stroke();
    }
    // wakes and eddies spinning off the pilings
    ctx.strokeStyle = 'rgba(235,250,245,0.26)'; ctx.lineWidth = 1.4; ctx.setLineDash([6, 7]); ctx.lineDashOffset = -t * 30; ctx.beginPath();
    for (const p of this.pilings) {
      if (p.x < cam - 80 || p.x > cam + W + 80) continue;
      for (const ox of [-22, 22]) { const x = p.x + ox; ctx.moveTo(x - 7, p.y + 3); ctx.quadraticCurveTo(x - 12, p.y + 22, x - 22, p.y + 50); ctx.moveTo(x + 7, p.y + 3); ctx.quadraticCurveTo(x + 12, p.y + 22, x + 24, p.y + 50); }
    }
    ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(235,250,245,0.2)'; ctx.lineWidth = 1.3; ctx.beginPath();
    for (const p of this.pilings) {
      if (p.x < cam - 80 || p.x > cam + W + 80) continue;
      for (const ox of [-22, 22]) for (let k = 0; k < 3; k++) {
        const ph = (t * 0.45 + k / 3 + flHash(ox, k, p.x)) % 1, x = p.x + ox, ey = p.y + 10 + ph * 80, ex = x + 3 + Math.sin(ph * 9 + k) * 8 * ph, er = 3 + ph * 8;
        ctx.moveTo(ex + er, ey); ctx.ellipse(ex, ey, er, er * 0.6, 0, 0, TAU * 0.7);
      }
    }
    ctx.stroke();
    ctx.fillStyle = 'rgba(240,250,246,0.6)';
    for (const p of this.pilings) { if (p.x < cam - 40 || p.x > cam + W + 40) continue; for (const ox of [-22, 22]) { ell(ctx, p.x + ox, p.y + 1, 9 + Math.sin(t * 3 + ox) * 1.2, 2.6); ctx.fill(); } }
  }
  drawDrift(ctx, cam, t) {
    // mangrove leaves and foam drifting on the tea-coloured water
    const W = Game.W, TW = 420;
    for (let ti = Math.floor(cam / TW) - 1; ti * TW < cam + W + TW; ti++) for (let i = 0; i < 5; i++) {
      const bx = ti * TW + flHash(i, 51, ti) * TW, by = 140 + flHash(i, 52, ti) * 260, c = this.current(bx, by);
      const x = bx + Math.sin(t * 0.15 + i + ti) * 14 + c.x * 6, y = by + Math.cos(t * 0.12 + i) * 6 + c.y * 4;
      if (y < this.topY(x) + 8 || this.islandAt(x, y, 4)) continue;
      const rot = flHash(i, 53, ti) * TAU + Math.sin(t * 0.3 + i) * 0.3;
      ctx.fillStyle = 'rgba(0,0,0,0.18)'; ell(ctx, x + 1.5, y + 2, 4, 1.8, rot); ctx.fill();
      ctx.fillStyle = flHash(i, 54, ti) < 0.5 ? '#c9a83e' : '#9fae4a'; ell(ctx, x, y, 4, 1.8, rot); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(236,228,200,0.2)'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.beginPath();   // foam lines
    for (let ti = Math.floor(cam / 700); ti * 700 < cam + W; ti++) {
      const x0 = ti * 700 + flHash(1, 55, ti) * 300, y0 = 200 + flHash(2, 55, ti) * 140, wob = Math.sin(t * 0.4 + ti) * 6;
      ctx.moveTo(x0, y0); ctx.bezierCurveTo(x0 + 60, y0 - 10 + wob, x0 + 120, y0 + 14 - wob, x0 + 190, y0 + 4);
    }
    ctx.stroke();
  }
  drawPuffs(ctx) {
    const col = this.K.mud;
    ctx.fillStyle = col;
    for (const p of this.puffs) {
      const k = p.t / p.life, a = (k < 0.12 ? k / 0.12 : 1 - (k - 0.12) / 0.88) * 0.38, rad = p.r * (0.8 + k * 1.6);
      ctx.globalAlpha = a; ell(ctx, p.x, p.y, rad, rad * 0.78); ctx.fill();
      ctx.globalAlpha = a * 0.7; ell(ctx, p.x + rad * 0.35, p.y - rad * 0.2, rad * 0.6, rad * 0.48); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  drawGlare(ctx, t) {
    const W = Game.W, wid = this.weather.id, glass = wid === 'glass', breezy = wid === 'breezy', gx = W * 0.7, gy = 210;
    ctx.globalAlpha = glass ? 0.5 : breezy ? 0.26 : 0.36;
    ctx.drawImage(this.glareImg, gx - 300, gy - 105, 600, 210);
    const n = glass ? 14 : breezy ? 58 : 34;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < n; i++) {
      const a = flHash(i, 11, 0) * TAU, q = Math.sqrt(flHash(i, 12, 0)) * (breezy ? 1.25 : 1);
      const k = Math.sin(t * (2 + flHash(i, 13, 0) * 5) + i * 1.7); if (k < 0.55) continue;
      const px = gx + Math.cos(a) * q * 290 + Math.sin(t * 0.3 + i) * 5, py = gy + Math.sin(a) * q * 95, s = ((k - 0.55) / 0.45) * (glass ? 4.5 : 3) * (1.2 - q * 0.5);
      ctx.globalAlpha = Math.min(1, s / 2.5);
      ctx.fillRect(px - s * 2, py - 0.6, s * 4, 1.2); ctx.fillRect(px - 0.6, py - s * 1.2, 1.2, s * 2.4);
    }
    ctx.globalAlpha = 1;
  }
  drawCar(ctx, car) {
    const x = car.x, y = car.y, L = car.len, dir = Math.sign(car.v);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; rr(ctx, x - L / 2 + 2, y - 5, L, 11, 3); ctx.fill();
    ctx.fillStyle = car.c; rr(ctx, x - L / 2, y - 6, L, 11, 3); ctx.fill();
    ctx.fillStyle = 'rgba(20,30,40,0.75)'; rr(ctx, x + dir * L * 0.12 - 3, y - 4.5, 6, 8, 1.5); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.22)'; rr(ctx, x - dir * L * 0.18 - 4, y - 4, 8, 7, 2); ctx.fill();
  }
  drawCritter(ctx, c, t) {
    const a = clamp(c.alpha, 0, 1) * (this.K.clarity * 0.5 + 0.2); if (a <= 0.01) return;
    const L = c.len;
    ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.hd); ctx.globalAlpha = a;
    if (c.kind === 'ray') {
      const wv = Math.sin(t * 3 + c.t) * 0.18;
      ctx.fillStyle = '#26332f'; ctx.beginPath(); ctx.moveTo(L * 0.42, 0);
      ctx.quadraticCurveTo(L * 0.05, -L * (0.62 + wv), -L * 0.3, 0); ctx.quadraticCurveTo(L * 0.05, L * (0.62 - wv), L * 0.42, 0); ctx.fill();
      ctx.strokeStyle = '#26332f'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-L * 0.3, 0); ctx.quadraticCurveTo(-L * 0.6, Math.sin(t * 2) * 3, -L * 0.9, 0); ctx.stroke();
    } else if (c.kind === 'shark') {
      drawFishTop(ctx, L, { back: '#4e5c5e', tail: '#4e5c5e', wide: 0.15, fins: '#4e5c5e' }, c.t, { speed: 5, flat: true });
      ctx.fillStyle = '#4e5c5e'; ctx.beginPath(); ctx.moveTo(L * 0.42, 0); ctx.lineTo(L * 0.5, -L * 0.1); ctx.lineTo(L * 0.54, 0); ctx.lineTo(L * 0.5, L * 0.1); ctx.fill();   // bonnethead
    } else if (c.kind === 'cuda') {
      drawFishTop(ctx, L, { back: '#4f5f64', edge: '#c9d4d6', tail: '#4f5f64', wide: 0.1 }, c.t, { speed: 2, amp: 0.12 });
    } else if (c.kind === 'turtle') {
      const fl = Math.sin(t * 2.4 + c.t) * 0.5;
      ctx.fillStyle = '#5c5434';
      for (const sd of [-1, 1]) { ctx.save(); ctx.translate(L * 0.12, sd * L * 0.32); ctx.rotate(sd * (0.6 + fl)); ell(ctx, -L * 0.12, 0, L * 0.26, L * 0.08); ctx.fill(); ctx.restore(); }
      ell(ctx, L * 0.5, 0, L * 0.12, L * 0.1); ctx.fill();
      ctx.fillStyle = '#6e5a34'; ell(ctx, 0, 0, L * 0.42, L * 0.34); ctx.fill();
      ctx.strokeStyle = 'rgba(30,24,10,0.5)'; ctx.lineWidth = 1; ell(ctx, 0, 0, L * 0.24, L * 0.18); ctx.stroke();
    } else if (c.kind === 'manatee') {
      ctx.fillStyle = '#5b5a52'; ell(ctx, 0, 0, L * 0.45, L * 0.17); ctx.fill();
      ctx.save(); ctx.translate(-L * 0.46, 0); ctx.rotate(Math.sin(t * 1.2 + c.t) * 0.25); ell(ctx, -L * 0.08, 0, L * 0.1, L * 0.12); ctx.fill(); ctx.restore();
      ell(ctx, L * 0.44, 0, L * 0.08, L * 0.09); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.1)'; ell(ctx, 0, -L * 0.05, L * 0.3, L * 0.05); ctx.fill();
    }
    ctx.restore();
  }
  shadowLook(key) {
    this.shLooks = this.shLooks || {};
    if (!this.shLooks[key]) { const c = this.K.shadeCol, lk = TOPLOOK[key]; this.shLooks[key] = { back: c, tail: c, wide: lk.wide, fins: lk.fins ? c : null }; }
    return this.shLooks[key];
  }
  drawWake(ctx, f) {
    if (f.lead) return;   // a school's leader pushes the water for all of them
    const spd = Math.min(f.spd || 0, 70); if (spd < 12 || f.alpha < 0.05) return;
    const school = f.brain === 'school' && f.state === 'cruise';
    const k = this.wakeK * clamp((spd - 8) / 40, 0, 1) * (1 - this.depthAt(f.x, f.y) * 0.85) * f.alpha * (school ? 1.3 : 1);
    if (k < 0.05) return;
    const c = Math.cos(f.hd), s = Math.sin(f.hd), L = f.len, hx = f.x + c * L * 0.42, hy = f.y + s * L * 0.42, back = L * 0.45 + spd * 0.35, br = L * 0.14 + 3;
    ctx.strokeStyle = `rgba(255,255,255,${Math.min(0.5, 0.36 * k).toFixed(3)})`; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
    ctx.setLineDash([5, 5]); ctx.lineDashOffset = -f.t * 22; ctx.beginPath();
    for (const sd of [-1, 1]) { const a = f.hd + Math.PI + sd * 0.55, x0 = hx + Math.cos(f.hd + sd * 1.2) * br, y0 = hy + Math.sin(f.hd + sd * 1.2) * br; ctx.moveTo(x0, y0); ctx.quadraticCurveTo(x0 + Math.cos(a) * back * 0.5, y0 + Math.sin(a) * back * 0.5 + 1, x0 + Math.cos(a) * back, y0 + Math.sin(a) * back); }
    ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(hx, hy, br, f.hd - 1.1, f.hd + 1.1); ctx.stroke();
    if (school) {   // nervous water over the whole school
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = flHash(f.unit, i, 61) * TAU + f.t * 0.7, q = 10 + flHash(f.unit, i, 62) * 26, px = f.x - c * 22 + Math.cos(a) * q, py = f.y - s * 22 + Math.sin(a) * q * 0.7, l = 5 + flHash(i, f.unit, 63) * 6;
        ctx.moveTo(px - l, py); ctx.quadraticCurveTo(px, py - 2.5, px + l, py);
      }
      ctx.stroke();
    }
  }
  drawFlatsFish(ctx, f, t) {
    const a = this.vis(f), L = f.len, sp = f.state === 'spooked' ? 20 : f.state === 'follow' ? 12 : f.tailing > 0 ? 3 : f.brain === 'hold' ? 4 : 8;
    this.drawWake(ctx, f);
    if (a > 0.015) {
      const dep = this.depthAt(f.x, f.y), so = 5 + 10 * dep, sa = a * 0.55 * this.K.shadow * (1 - dep * 0.6);
      if (sa > 0.01) { ctx.save(); ctx.translate(f.x + so, f.y + so * 1.2); ctx.rotate(f.hd); ctx.globalAlpha = sa; drawFishTop(ctx, L * 1.04, this.shadowLook(f.key), f.t, { flat: true, speed: sp }); ctx.restore(); }
      const lk = f.leap > 0 ? Math.sin((1 - f.leap / 0.6) * Math.PI) : 0;   // a ladyfish in the air: lifted and a touch bigger
      ctx.save(); ctx.translate(f.x, f.y - lk * 16); ctx.rotate(f.hd); ctx.globalAlpha = Math.min(1, a * 0.95);
      if (lk) ctx.scale(1 + lk * 0.25, 1 + lk * 0.25);
      drawFishTop(ctx, L, TOPLOOK[f.key], f.t, { speed: sp, flat: a < 0.45 });
      ctx.restore();
    }
    if (f.tailing > 0) this.drawTail(ctx, f, t);
    if (f.roll > 0) this.drawRoll(ctx, f);
    if (f.state === 'follow') { ctx.strokeStyle = `rgba(255,200,69,${0.3 + f.interest * 0.5})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(f.x, f.y, L * 0.6, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(f.interest, 0, 1)); ctx.stroke(); }
  }
  drawTail(ctx, f, t) {
    const L = f.len, c = Math.cos(f.hd), s = Math.sin(f.hd), tx = f.x - c * L * 0.5, ty = f.y - s * L * 0.5;
    const lk = FL_TAIL[f.key] || FL_TAIL.bonefish, sz = (L * 0.2 + 5) * (lk.k || 1), k = Math.min(1, f.tailing * 3) * this.tailK * f.alpha;
    if (k < 0.03) return;
    ctx.save(); ctx.translate(tx, ty); ctx.rotate(f.hd + Math.PI + Math.sin(t * 6 + f.seed) * 0.45); ctx.globalAlpha = k;
    ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.save(); ctx.translate(3, 4); this.tailPath(ctx, sz); ctx.fill(); ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.4; ell(ctx, 0, 0, sz * 0.55, sz * 0.32); ctx.stroke();
    ctx.fillStyle = lk.fill; this.tailPath(ctx, sz); ctx.fill();
    if (lk.edge) { ctx.strokeStyle = lk.edge; ctx.lineWidth = 1; ctx.stroke(); }
    if (lk.tip) { ctx.fillStyle = lk.tip; ell(ctx, sz * 0.92, -sz * 0.56, sz * 0.12, sz * 0.09); ctx.fill(); ell(ctx, sz * 0.92, sz * 0.56, sz * 0.12, sz * 0.09); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ell(ctx, sz * 0.58, -sz * 0.3, sz * 0.13, sz * 0.05, -0.6); ctx.fill();
    ctx.restore();
  }
  tailPath(ctx, sz) {
    ctx.beginPath(); ctx.moveTo(-sz * 0.1, 0);
    ctx.quadraticCurveTo(sz * 0.5, -sz * 0.12, sz, -sz * 0.62); ctx.quadraticCurveTo(sz * 0.7, -sz * 0.05, sz * 0.78, 0);
    ctx.quadraticCurveTo(sz * 0.7, sz * 0.05, sz, sz * 0.62); ctx.quadraticCurveTo(sz * 0.5, sz * 0.12, -sz * 0.1, 0); ctx.closePath();
  }
  drawRoll(ctx, f) {
    // a tarpon's back and dorsal breaking the surface, sliding forward as it rolls
    const p = 1 - f.roll / 1.15, up = Math.sin(p * Math.PI), L = f.len, bx = (p - 0.5) * L * 0.6;
    if (up < 0.03) return;
    ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.hd); ctx.globalAlpha = Math.min(1, up * 1.3) * f.alpha;
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 2; ell(ctx, bx, 0, L * 0.34 * up + 5, L * 0.12 * up + 3); ctx.stroke();
    const g = ctx.createLinearGradient(0, -L * 0.1, 0, L * 0.1); g.addColorStop(0, '#5f777c'); g.addColorStop(0.45, '#dfe9ec'); g.addColorStop(1, '#a9bcc0');
    ctx.fillStyle = g; ell(ctx, bx, 0, L * 0.3 * up + 2, L * 0.085 * up + 1); ctx.fill();
    ctx.fillStyle = '#41565b'; ctx.beginPath(); ctx.moveTo(bx - L * 0.02, -1); ctx.lineTo(bx - L * 0.17 * up, -L * 0.03); ctx.lineTo(bx - L * 0.11 * up, 1); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ell(ctx, bx + L * 0.06, -L * 0.03 * up, L * 0.1 * up, L * 0.015 + 0.5); ctx.fill();
    ctx.restore();
  }
  drawHud(ctx, W, H) {
    this.drawCallout(ctx, W);
    this.drawPointer(ctx, W, H);
    this.drawTopBar(ctx);
    this.drawSlam(ctx, W);
    this.drawPoleCtl(ctx, W, H);
    // how to catch one, any time (H)
    UI.button(ctx, 'flatshelp', W / 2 + 72, 12, 46, 46, '?', () => this.openHelp(), { style: 'dark', size: 22, r: 14, key: 'KeyH', disabled: !!(this.child || this.help) });
    if (this.coach && !this.help) this.drawCoach(ctx, W, H);
    else {
      const hw = W / 2 - 90, o = { size: 17, color: '#fff', weight: 700, stroke: 'rgba(0,0,0,0.5)', sw: 4, lh: 20 };
      if (this.t < 12 && !this.lure) para(ctx, Game.touch ? 'Press and hold where you want the fly, then let go to cast' : 'Click and hold where you want the fly, then let go to cast', 20, H - 46, hw, o);
      else if (this.lure && !this.eat) para(ctx, Game.touch ? 'Tap to strip. Drag to recast.' : 'Tap or Space to strip. Drag to recast.', 20, H - 26, hw, o);
      else if (!this.everPoled && this.t > 16 && this.t < 40) para(ctx, Game.touch ? 'Tap the arrows to pole along the flat' : 'Arrow keys or A / D pole the skiff along the flat', 20, H - 46, hw, o);
    }
    if (this.help) this.drawHelp(ctx, W, H);
  }
  /* ---------- coaching, until a first fish is hooked ---------- */
  // the fish to work: one following the fly, else the one your buddy called (while it's still around)
  coachFish() {
    const fol = this.fishList.find((f) => f.state === 'follow' || f.state === 'eat'); if (fol) return fol;
    const f = this.coachF; if (!f || f.gone || f.state === 'spooked' || f.leaving || !this.fishList.includes(f)) return null;
    return f;
  }
  // where to put the fly: past where it spooks and inside where it notices, ahead of its nose (where it will be once
  // the fly lands), and not where the line would slap down across it
  leadSpot(f) {
    const tip = this.rodTip(), lead = f.state === 'cruise' && f.brain !== 'hold' && f.brain !== 'tail' ? (f.spd || f.speed) * 0.75 : 0;
    const fx = f.x + Math.cos(f.hd) * lead, fy = f.y + Math.sin(f.hd) * lead, hx = fx + Math.cos(f.hd) * f.len * 0.4, hy = fy + Math.sin(f.hd) * f.len * 0.4, dd = (f.sp.spook + f.sp.notice) / 2;
    for (const da of [0, 0.7, -0.7, 1.1, -1.1]) {
      const a = f.hd + da, x = clamp(hx + Math.cos(a) * dd, 20, this.WW - 20), y = clamp(hy + Math.sin(a) * dd, 60, Game.H - 150);
      if (this.snagAt(x, y) || flSegDist(fx, fy, tip.x, tip.y, x, y) < f.len * 0.2 + 18) continue;
      return { x, y };
    }
    return null;
  }
  drawCoach(ctx, W, H) {
    const t = this.t, cam = this.camX, f = this.coachFish(), fol = this.fishList.find((o) => o.state === 'follow');
    // a ring on the fish, with its name
    if (f && !this.eat) {
      const sx = f.x - cam, r = f.len * 0.75 + 10 + Math.sin(t * 5) * 3;
      if (sx > -30 && sx < W + 30) {
        ctx.strokeStyle = PAL.sun; ctx.lineWidth = 3; ell(ctx, sx, f.y, r, r * 0.75); ctx.stroke();
        text(ctx, (FL_NAME[f.key] || f.sp.short).toUpperCase(), sx, f.y - r * 0.75 - 9, { size: 14, align: 'center', color: PAL.sun, weight: 800, stroke: PAL.ink, sw: 4 });
      }
      // and where to put the fly
      const L = !this.lure && !this.cast && f.state === 'cruise' ? this.leadSpot(f) : null;
      if (L && L.x - cam > 10 && L.x - cam < W - 10) {
        const lx = L.x - cam, pr = 18 + Math.sin(t * 6) * 2;
        ctx.save(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.setLineDash([6, 5]); ctx.lineDashOffset = -t * 20; ell(ctx, lx, L.y, pr, pr * 0.75); ctx.stroke(); ctx.restore();
        ctx.fillStyle = '#fff'; ell(ctx, lx, L.y, 3, 3); ctx.fill();
        text(ctx, 'CAST HERE', lx, L.y + pr + 16, { size: 14, align: 'center', color: '#fff', weight: 800, stroke: PAL.ink, sw: 4 });
      }
    }
    // the strip timing: a ring closes in on the fly over the fish's rhythm; when it's closed (green), tap
    let ready = false;
    if (fol && this.lure && !this.eat) {
      const Lr = this.lure, ph = (t - fol.lastStrip) / fol.sp.strip, lx = Lr.x - cam, rr2 = 12 + 34 * clamp(1 - ph, 0, 1);
      ready = ph >= 0.85 && ph <= 2.2;
      ctx.strokeStyle = ready ? PAL.good : 'rgba(255,255,255,0.85)'; ctx.lineWidth = ready ? 4 : 3; ell(ctx, lx, Lr.y, rr2, rr2 * 0.75); ctx.stroke();
      text(ctx, ready ? 'STRIP!' : 'wait…', lx, Lr.y + 34, { size: ready ? 17 : 14, align: 'center', color: ready ? PAL.good : '#fff', weight: 800, stroke: PAL.ink, sw: 4 });
    }
    // what to do now
    const P = this.poler ? CHARS[this.poler].name : 'Your buddy', tap = Game.touch ? 'Tap' : 'Tap (or Space)';
    const msg = this.eat ? 'It ate it! ' + tap + ' NOW to set the hook!'
      : fol ? 'It’s following! ' + tap + ' to strip the fly each time the ring closes. Not faster.'
      : this.lure ? 'No takers yet. Strip it once or twice, or drag to cast again in front of a fish.'
      : this.aim ? 'Hold until the circle is small, then let go.'
      : f ? (Game.touch ? 'Press and hold on CAST HERE (in front of the fish), then let go.' : 'Click and hold on CAST HERE (in front of the fish), then let go.')
      : P + ' calls fish by the clock: 12 is straight ahead. Watch for tails and wakes, and pole with ◀ ▶.';
    const bw = Math.min(W / 2 - 64, 430); ctx.font = fnt(16, 800); const n = wrapText(ctx, msg, bw - 24).length, bh = 16 + n * 20;
    panel(ctx, 14, H - 16 - bh, bw, bh, { r: 14, fill: 'rgba(255,255,255,0.95)', line: 'rgba(0,0,0,0.1)' });
    para(ctx, msg, 26, H - 16 - bh + 24, bw - 24, { size: 16, color: this.eat ? PAL.bad : PAL.ink, weight: 800, lh: 20 });
    // the four steps from the how-to card, with this one lit
    const step = this.eat ? 3 : fol ? 2 : f || this.lure || this.aim ? 1 : 0, names = ['SPOT', 'CAST', 'STRIP', 'SET'], pw = 74, sx0 = W / 2 - (pw * 4 + 18) / 2, y = 116;
    names.forEach((nm, i) => {
      const px = sx0 + i * (pw + 6), now = i === step, done = i < step;
      ctx.fillStyle = now ? PAL.sun : done ? 'rgba(95,224,138,0.9)' : 'rgba(4,24,34,0.72)'; rr(ctx, px, y, pw, 22, 11); ctx.fill();
      text(ctx, (i + 1) + ' ' + nm, px + pw / 2, y + 15.5, { size: 12, align: 'center', color: now || done ? PAL.ink : '#cfe3ea', weight: 800 });
    });
  }
  // How to catch a fish on the flats: four steps, each with a small moving picture. Opens by itself on each angler's
  // first visit, and from the ? button (or H). The clock waits.
  drawHelp(ctx, W, H) {
    const t = this.help.t, wide = W >= 900;
    ctx.fillStyle = 'rgba(3,22,32,0.93)'; ctx.fillRect(0, 0, W, H);
    UI.region('help-cover', 0, 0, W, H, null);   // nothing under the card answers while it's up
    text(ctx, 'How to catch a fish on the flats', W / 2, 44, { display: true, size: 32, align: 'center', color: '#fff', maxW: W - 40 });
    const cols = wide ? 4 : 2, gap = 12, cw = Math.floor((W - 48 - gap * (cols - 1)) / cols), ch = wide ? 236 : 150, y0 = 70;
    const steps = [
      { title: 'Spot', body: 'Watch for tails, wakes and shadows. Your buddy calls fish by the clock: 12 is straight ahead.' },
      { title: 'Cast', body: (Game.touch ? 'Press and hold' : 'Click and hold') + ' where you want the fly, then let go. Land it a few feet in front of the fish, never on it.' },
      { title: 'Strip', body: 'Tap to strip the fly in, at the fish’s pace: Good strip means keep it up. Too fast and it refuses.' },
      { title: 'Set', body: 'When it eats (IT ATE IT!), tap right away to set the hook. Then fight it in.' }
    ];
    steps.forEach((st, i) => {
      const x = 24 + (i % cols) * (cw + gap), y = y0 + Math.floor(i / cols) * (ch + gap), artW = wide ? cw : Math.min(140, cw * 0.42), artH = wide ? 96 : ch - 20;
      panel(ctx, x, y, cw, ch, { r: 14, fill: 'rgba(20,90,120,0.9)' });
      ctx.save(); rr(ctx, x + 6, y + 6, artW - 12, artH - 6, 10); ctx.clip(); ctx.fillStyle = '#86c7ad'; ctx.fillRect(x, y, artW, artH);
      this.helpArt(ctx, i, x + artW / 2, y + artH / 2 + 4, t);
      ctx.restore();
      const tx = wide ? x + 14 : x + artW + 4, ty = wide ? y + artH + 22 : y + 26, tw = wide ? cw - 28 : cw - artW - 14;
      ctx.fillStyle = PAL.sun; ell(ctx, tx + 11, ty - 6, 11, 11); ctx.fill();
      text(ctx, String(i + 1), tx + 11, ty - 5, { size: 14, align: 'center', base: 'middle', color: PAL.ink, weight: 800 });
      text(ctx, st.title, tx + 28, ty, { size: 19, color: '#fff', weight: 800 });
      para(ctx, st.body, tx, ty + 24, tw, { size: wide ? 16 : 14, color: '#d6ebf2', weight: 600, lh: wide ? 20 : 17 });
    });
    const ky = y0 + (wide ? ch : ch * 2 + gap) + 22;
    para(ctx, '◀ ▶ (bottom right) poles the skiff along the flat. A fly on the fish’s head, the line across its back, or the boat too close spooks it.', 24, ky, W - 48, { size: 15, color: '#cfe3ea', weight: 700, lh: 19 });
    UI.button(ctx, 'help-ok', W / 2 - 110, H - 66, 220, 54, 'Got it', () => this.closeHelp(), { style: 'primary', size: 22, key: 'Enter|Space|Escape|KeyH' });
  }
  // the little moving pictures on the help card
  helpArt(ctx, i, cx, cy, t) {
    const fish = (x, y, a, len = 72) => { ctx.save(); ctx.translate(x, y); ctx.rotate(a); drawFishTop(ctx, len, 'bonefish', t); ctx.restore(); };
    const ring = (x, y, r, col, dash) => { ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 2.5; if (dash) { ctx.setLineDash([5, 4]); ctx.lineDashOffset = -t * 16; } ell(ctx, x, y, r, r * 0.75); ctx.stroke(); ctx.restore(); };
    const lbl = (s, x, y, col) => text(ctx, s, x, y, { size: 14, align: 'center', color: col || '#fff', weight: 800, stroke: PAL.ink, sw: 4 });
    if (i === 0) {   // a tailing fish, and the clock: 12 straight ahead, this one at 11
      const ox = cx - 36; ctx.fillStyle = 'rgba(255,255,255,0.85)'; ell(ctx, ox, cy, 20, 20); ctx.fill(); ctx.strokeStyle = PAL.ink; ctx.lineWidth = 2; ctx.stroke();
      text(ctx, '12', ox, cy - 11, { size: 9, align: 'center', color: PAL.ink, weight: 800 });
      ctx.strokeStyle = PAL.coral; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(ox, cy + 2); ctx.lineTo(ox - 9, cy - 14); ctx.stroke();
      fish(cx + 30, cy + 6, Math.PI * 0.85, 64);
      const k = (t * 1.4) % 1; ring(cx + 10, cy - 4, 4 + k * 16, `rgba(255,255,255,${1 - k})`);
      lbl('11 o’clock', cx + 24, cy - 24);
    } else if (i === 1) {   // the fly lands in front of its nose
      fish(cx - 30, cy + 4, 0); ring(cx + 34, cy + 4, 15, '#fff', true);
      const k = (t % 2) / 2; if (k < 0.4) { const fx = lerp(cx - 70, cx + 34, k / 0.4), fy = cy + 4 - Math.sin(k / 0.4 * Math.PI) * 30; ctx.fillStyle = '#e8b04a'; ell(ctx, fx, fy, 4, 3); ctx.fill(); }
      else { ctx.fillStyle = '#e8b04a'; ell(ctx, cx + 34, cy + 4, 4, 3); ctx.fill(); ring(cx + 34, cy + 4, 4 + (k - 0.4) * 30, `rgba(255,255,255,${1 - (k - 0.4) / 0.6})`); }
      lbl('HERE', cx + 34, cy - 18, PAL.sun);
    } else if (i === 2) {   // strip, strip, strip: the fly hops toward you, the fish follows
      const ph = (t % 3) / 3, hop = Math.floor(ph * 6), fx = cx + 40 - hop * 14 - Math.min(1, (ph * 6 - hop) * 3) * 14;
      ctx.fillStyle = '#e8b04a'; ell(ctx, fx, cy + 4, 4, 3); ctx.fill();
      fish(fx + 40, cy + 4, Math.PI);
      if ((ph * 6) % 1 < 0.35) lbl('strip', fx, cy - 14, PAL.good);
    } else {   // it eats: set!
      const k = (t % 1.6) / 1.6;
      fish(cx + 14, cy + 6, Math.PI); ctx.fillStyle = '#e8b04a'; ell(ctx, cx - 14, cy + 6, 4, 3); ctx.fill();
      ring(cx - 14, cy + 6, 6 + k * 26, `rgba(255,214,90,${1 - k})`);
      lbl('SET!', cx - 6, cy - 22, PAL.sun);
    }
  }
  drawCallout(ctx, W) {
    const c = this.callout; if (!c || !this.poler) return;
    const P = CHARS[this.poler], bw = Math.min(540, W - 120), bx = W / 2 - bw / 2, by = 66, bh = 44;
    ctx.save(); ctx.globalAlpha = Math.min(1, c.t * 2.5);
    panel(ctx, bx, by, bw, bh, { r: 16, fill: 'rgba(255,255,255,0.95)', line: 'rgba(0,0,0,0.1)' });
    ctx.save(); ell(ctx, bx + 24, by + 22, 15, 15); ctx.clip(); ctx.fillStyle = '#7fc8e8'; ctx.fillRect(bx + 8, by + 6, 32, 32); drawHead(ctx, P, bx + 24, by + 26, 12); ctx.restore();
    ctx.strokeStyle = P.color; ctx.lineWidth = 2; ell(ctx, bx + 24, by + 22, 15, 15); ctx.stroke();
    text(ctx, c.msg, bx + 48, by + 28, { size: 17, color: PAL.ink, weight: 700, maxW: bw - 62 });
    ctx.restore();
  }
  drawPointer(ctx, W, H) {
    const p = this.pointTo; if (!p) return;
    const f = p.f, sx = f.x - this.camX, left = sx < 0, x = left ? 30 : W - 30, y = clamp(f.y, 140, H - 160);
    ctx.save(); ctx.globalAlpha = Math.min(1, p.t) * (0.75 + 0.25 * Math.sin(this.t * 6)); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(7,36,51,0.85)'; ell(ctx, 0, 0, 20, 20); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = PAL.sun; ctx.beginPath(); const d = left ? -1 : 1; ctx.moveTo(d * 10, 0); ctx.lineTo(-d * 5, -9); ctx.lineTo(-d * 5, 9); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  drawSlam(ctx, W) {
    const px = W - 236, py = 12;
    panel(ctx, px, py, 222, 46, { r: 23 });
    if (this.variant === 'bridge') {
      // no slam to chase under the bridge: a tally of what lives here instead
      text(ctx, 'LOG', px + 14, py + 29, { size: 14, weight: 800, color: '#cfe3ea' });
      this.speciesList.slice(0, 6).forEach((k, i) => {
        ctx.globalAlpha = this.landed.has(k) ? 1 : 0.32;
        ctx.save(); ctx.translate(px + 64 + i * 27, py + 23); drawFish(ctx, k, 25, { wig: 0 }); ctx.restore(); ctx.globalAlpha = 1;
      });
      return;
    }
    const set = this.variant === 'glades' ? ['snook', 'redfish', 'trout'] : ['tarpon', 'bonefish', 'permit'];
    text(ctx, 'SLAM', px + 14, py + 29, { size: 14, weight: 800, color: '#cfe3ea' });
    set.forEach((k, i) => {
      ctx.globalAlpha = this.landed.has(k) ? 1 : 0.35;
      ctx.save(); ctx.translate(px + 84 + i * 48, py + 23); drawFish(ctx, k, 38, { wig: 0 }); ctx.restore(); ctx.globalAlpha = 1;
    });
  }
  drawPoleCtl(ctx, W, H) {
    const pw = 204, ph = 52, px = W - pw - 14, py = H - ph - 14;
    panel(ctx, px, py, pw, ph, { r: 26 });
    const arrow = (d, on) => (c, x, y, sz) => { c.fillStyle = on ? PAL.ink : '#ffffff'; c.beginPath(); c.moveTo(x + d * sz * 0.42, y); c.lineTo(x - d * sz * 0.3, y - sz * 0.42); c.lineTo(x - d * sz * 0.3, y + sz * 0.42); c.closePath(); c.fill(); };
    UI.button(ctx, 'poleL', px + 6, py + 6, 48, 40, '', () => this.setPole(-1), { style: this.poleDir < 0 ? 'primary' : 'dark', r: 20, icon: arrow(-1, this.poleDir < 0) });
    UI.button(ctx, 'poleR', px + pw - 54, py + 6, 48, 40, '', () => this.setPole(1), { style: this.poleDir > 0 ? 'primary' : 'dark', r: 20, icon: arrow(1, this.poleDir > 0) });
    // a little chart of the whole flat: where the skiff is, what the poler has called
    const mx = px + 62, mw = pw - 124, my = py + 9, mh = 34, WW = this.WW;
    ctx.save(); rr(ctx, mx, my, mw, mh, 7); ctx.clip();
    ctx.drawImage(this.mini, mx, my, mw, mh);
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(mx + this.camX / WW * mw, my, W / WW * mw, mh);
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.2; ctx.strokeRect(mx + this.camX / WW * mw + 0.5, my + 0.5, W / WW * mw - 1, mh - 1);
    for (const f of this.fishList) if (f.called && !f.lead && f.state !== 'spooked' && !f.leaving) { ctx.fillStyle = PAL.sun; ell(ctx, mx + f.x / WW * mw, my + f.y / Game.H * mh, 2.2, 2.2); ctx.fill(); }
    ctx.fillStyle = '#fff'; ell(ctx, mx + this.bx / WW * mw, my + (Game.H - 70) / Game.H * mh, 2.4, 3.2); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1.5; rr(ctx, mx, my, mw, mh, 7); ctx.stroke();
  }
}
