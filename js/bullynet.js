'use strict';
/* Keys Crew — bully netting at night. The skiff idles along the grass flats off Tavernier after dark with a light on
   the bow, seen from straight above. Spiny lobster walk out in the open at night: sweep the light (drag, or move the
   mouse) and look for two orange eyes glowing at the edge of the beam. Put the light on a bug and it freezes, and
   your buddy at the wheel idles over and holds up. Drop the bully net just behind its tail: a lobster shoots
   backward, right into the hoop. Then wait for it to kick up into the bag and TWIST the pole to close it.
   Gauge it like a dive (over 3", no eggs). Six per person. Don't net the rays and the sleeping nurse sharks. */

// REACH: how far from the bow a bug can be netted; the hoop itself lands up to SPAN past that (just behind a bug at the
// edge of reach)
const BN = { TILE: 256, REACH: 250, SPAN: 50, LIGHT: 380, LIGHT_MIN: 64, CORE: 92, HALO: 2.7, HOOP: 36, DROP: 0.36, SET: 0.85, LIFT: 0.42, TAP: 80, SENSE: 140, LOOK: 185, BOAT: 0.86, BOW: 72 };
const BN_SPEED = [{ name: 'STOP', v: 0, say: 'holding still' }, { name: 'SLOW', v: 24, say: 'creeping along' }, { name: 'IDLE', v: 46, say: 'idling along' }];
// how a bug takes the light and the net, on top of its Bug Hunt temperament (TEMPER: the tag's name and color).
//   shy: how fast the light wears on it (it freezes, then bolts at 1); react: how far into a net's drop it sees one
//   coming from in front (1 = only when it lands); crouch: seconds it gathers itself before it shoots backward;
//   sense: chance a net landing close by spooks it; walk: px/s; flip: px/s off the bottom; kick: seconds it sits up in
//   the bag (the window to twist); hoop: how forgiving the hoop is; misses: spooks before it's gone for good
const BN_TEMPER = {
  calm: { shy: 0.16, react: 0.95, crouch: 0.12, sense: 0.55, walk: 9, flip: 470, kick: 0.85, hoop: 1.12, misses: 3 },
  skittish: { shy: 0.26, react: 0.45, crouch: 0.07, sense: 0.85, walk: 13, flip: 520, kick: 0.62, hoop: 1, misses: 3 },
  wary: { shy: 0.5, react: 0.3, crouch: 0.05, sense: 1, walk: 17, flip: 580, kick: 0.45, hoop: 0.9, misses: 2 }
};
const bnTemper = (b) => BN_TEMPER[b && b.temper] || BN_TEMPER.skittish;
// the flats at night: lots of shorts, the odd big one
const BN_SITE = { short: 0.36, big: 0.9, gold: 0.8 };
// tonight's crew, from the boat. {c} is a clock position from the bow.
const BN_QUIPS = {
  spot: ['Eyes! Bug at {c} o’clock!', 'I see eyes at {c} o’clock!', 'Bug! {c} o’clock!', 'Orange eyes, {c} o’clock!'],
  nice: ['Nice bug!', 'In the bucket!', 'That’s a keeper!', 'Look at the size of him!'],
  big: ['THAT’S a big boy!', 'Whoa. Monster bug.', 'Now THAT’S a bug!'],
  short: ['Uh… that looked short.', 'FWC loves a short bug.', 'Gauge it again, bro.'],
  pro: ['Backed it right in!', 'Textbook.', 'That’s how it’s done!'],
  miss: ['It shot backward!', 'Behind it, bro! BEHIND it!', 'So close!'],
  rim: ['It went out under the rim!', 'Twist it! Too late.', 'Gotta twist faster!'],
  early: ['Wait for it to kick up!', 'Too soon, bro!'],
  ray: ['That’s a ray, bro!', 'Don’t net the ray!', 'Leave the stingray alone!'],
  shark: ['That’s a nurse shark!', 'You netted a SHARK?!', 'Let the shark sleep, man.'],
  crab: ['That’s a crab.', 'Crab. Toss it.', 'Nice crab, wrong bug.'],
  bolt: ['It’s walking off!', 'Get on it, it’s leaving!', 'Too long in the light!'],
  den: ['It went under the rock.', 'It’s under the sponge. Leave it.'],
  hold: ['Holding up!', 'Stopping!', 'Got it, holding.'],
  far: ['Too far, I’ll bring you over.', 'Hang on, getting closer.'],
  quiet: ['Who brought the bug spray?', 'No-see-ums, man.', 'Nice night for it.', 'Sweep wide. They’re out here.', 'Slow down, slow down.', 'Check the grass edges.'],
  moon: ['Look at that moon.', 'Bright out tonight.'],
  dark: ['Dark as it gets. Perfect.', 'Can’t see my hand out here.'],
  houndfish: ['Houndfish! Watch your face!', 'Whoa! Needlefish!'],
  gold: ['Is that… GOLD?!', 'A golden bug! No way!']
};
// eyeshine: what glows back at the light, and in what color
const BN_EYE = { bug: '#ff9a2e', shrimp: '#ff3b4a', crab: '#b9ffcf', shark: '#d7ff7a', fish: '#e9fbff' };

function bnHash(ix, iy, s) { return Math.floor(flHash(ix, iy, s) * 4294967295) | 0; }
function bnPoisson(rng, lam) { let k = 0, p = Math.exp(-lam), F = p; const u = rng(); while (u > F && k < 12) { k++; p *= lam / k; F += p; } return k; }
const BN_SPRITES = {};
// a soft glowing dot, rendered once per color and reused for every eye in the dark
function bnGlow(col) {
  if (BN_SPRITES[col]) return BN_SPRITES[col];
  const c = document.createElement('canvas'), S = 32; c.width = S; c.height = S;
  const g = c.getContext('2d'), rg = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  rg.addColorStop(0, 'rgba(255,248,225,1)'); rg.addColorStop(0.16, rgba(col, 1)); rg.addColorStop(0.42, rgba(col, 0.35)); rg.addColorStop(1, rgba(col, 0));
  g.fillStyle = rg; g.fillRect(0, 0, S, S);
  return (BN_SPRITES[col] = c);
}

class BullyNetScene extends SessionBase {
  constructor(o) {
    super(o);
    this.music = 'night';
    this.resultHeader = 'FWC check at the ramp';
    this.moon = o.moon || moonPhase();
    this.seed = randi(1, 999983);
    this.boat = { x: 0, y: 0, h: -Math.PI / 2, v: 0 };
    this.camH = this.boat.h; this.cam = { x: 0, y: -BN.LOOK };
    this.notch = 1; this.windA = rand(0, TAU);
    const bow = this.bow();
    this.light = { x: bow.x, y: bow.y - 220, tx: bow.x, ty: bow.y - 220, ox: 0, oy: -220 - BN.BOW, a: -Math.PI / 2, st: 1.2, on: false, lock: null, lockHover: null, still: 0 };
    this.tiles = new Map(); this.chunks = new Map(); this.tileRes = 1;
    this.bugs = []; this.crits = []; this.shrimp = []; this.puffs = []; this.nid = 0;
    this.bait = []; for (let i = 0; i < 12; i++) this.bait.push({ x: rand(-80, 80), y: rand(-300, -150), vx: 0, vy: 0, ph: rand(0, TAU) });
    this.jellies = []; this.snow = []; for (let i = 0; i < 60; i++) this.snow.push({ x: rand(-700, 700), y: rand(-500, 400), z: rand(0.3, 1), ph: rand(0, TAU) });
    this.bio = new Particles();
    this.net = { state: 'carry', t: 0, x: 0, y: 0, cool: 0 };
    this.bag = []; this.gauge = null; this.drops = 0;
    this.press = null; this.drag = null; this.actionPtr = null; this.actionPress = false; this.lastHover = null;
    this.quip = null; this.callCool = 4; this.quietT = rand(14, 22); this.houndT = rand(18, 34); this.hound = null; this.dirT = 1; this.dry = 0; this.holdSaid = false;
    let others = (Trip.cur && Trip.cur.crew ? Trip.cur.crew : CHAR_ORDER).filter((c) => c !== this.ch);
    if (!others.length) others = CHAR_ORDER.filter((c) => c !== this.ch);
    this.others = others.slice(0, 2); this.driver = this.others[0];
    // the coaching (an arrow to the first eyes, where to drop the net, when to twist, the steps) stays on until this angler
    // nets a first bug at night; the how-to card opens by itself on their first night (and any time from ?)
    this.coach = !Store.get('coach_bullynet_' + this.ch, false); this.coachSaw = {};
    this.help = !Store.get('coach_bully1_' + this.ch, false) ? { t: 0 } : null;
    this.intro = { t: 0 };
    this.ensureChunks();
    // the first bug of a learner's night is a calm, legal one, close ahead and turned sideways, so the tail is plain
    if (this.coach) { const f = this.fwd(), b = this.addBug(bow.x + f.x * 250 - f.y * 70, bow.y + f.y * 250 + f.x * 70, { temper: 'calm', cl: rand(3.3, 3.8), eggs: false, gold: false, h: this.boat.h + Math.PI / 2 * (chance(0.5) ? 1 : -1) }); b.first = true; }
  }
  enter() {
    SFX.setAmbient(0.6, false, true); Music.play('night');
    // low, between the light and the boat: the top of the picture is where the bugs are
    Game.toast(SPOTS[this.spot] ? SPOTS[this.spot].name : 'Bully netting', { color: PAL.sun, size: 36, y: 352, dur: 2.2, sub: Game.touch ? 'Drag to sweep the light. Look for orange eyes.' : 'Move the mouse to sweep the light. Look for orange eyes.' });
    if (this.help) Store.set('coach_bully1_' + this.ch, true);
  }
  exit() {
    SFX.setAmbient(0); SFX.setEngine(0);
    for (const c of this.tiles.values()) { c.width = 1; c.height = 1; }   // hand the bitmaps back now (mobile Safari caps canvas memory)
    this.tiles.clear(); if (this.dark) { this.dark.width = 1; this.dark.height = 1; this.dark = null; }
  }
  say(kind, p = 1, c) {
    if (!chance(p) || !BN_QUIPS[kind]) return;
    this.quip = { who: kind === 'hold' || kind === 'far' ? this.driver : pick(this.others), msg: pick(BN_QUIPS[kind]).replace('{c}', c || '12'), t: 2.8 };
  }

  /* ---------- where things are ---------- */
  fwd() { return { x: Math.cos(this.boat.h), y: Math.sin(this.boat.h) }; }
  bow() { const f = this.fwd(); return { x: this.boat.x + f.x * BN.BOW, y: this.boat.y + f.y * BN.BOW }; }
  hands() { const f = this.fwd(); return { x: this.boat.x + f.x * 50, y: this.boat.y + f.y * 50 }; }
  carryPos() { const f = this.fwd(); return { x: this.boat.x + f.x * (BN.BOW + 8) - f.y * 30, y: this.boat.y + f.y * (BN.BOW + 8) + f.x * 30 }; }   // held up off the starboard bow
  toWorld(p) { return [p.x + this.cam.x - Game.W / 2, p.y + this.cam.y - Game.H / 2]; }
  toScreen(x, y) { return [x - this.cam.x + Game.W / 2, y - this.cam.y + Game.H / 2]; }
  // how brightly the light falls on a point: 1 in the middle of the spot, fading out across the halo to 0
  lightAt(x, y) {
    const L = this.light; if (!L.on) return 0;
    const dx = x - L.x, dy = y - L.y, ca = Math.cos(L.a), sa = Math.sin(L.a);
    const u = (dx * ca + dy * sa) / (BN.CORE * L.st), v = (-dx * sa + dy * ca) / BN.CORE, d = Math.hypot(u, v);
    return d < 1 ? 1 - 0.25 * d * d : d < BN.HALO ? 0.75 * Math.pow((BN.HALO - d) / (BN.HALO - 1), 2) : 0;
  }
  grassAt(x, y) { return flStep(0.44, 0.53, flFbm(x * 0.0042 + 11, y * 0.0042 + 7, this.seed % 1000)) * (1 - flStep(0.74, 0.8, flNoise(x * 0.011, y * 0.011, (this.seed + 5) % 1000))); }
  reachable(x, y) { const b = this.bow(); return dist(b.x, b.y, x, y) <= BN.REACH; }
  // the clock position of a point from the bow: 12 dead ahead
  clockOf(x, y) { const a = angleDiff(this.boat.h, Math.atan2(y - this.boat.y, x - this.boat.x)); return String(((Math.round(a / (TAU / 12)) % 12) + 12) % 12 || 12); }
  // a bug you can see and work: not hiding, not already in the net
  open(b) { return !b.gone && b.st !== 'den' && b.st !== 'bag' && b.st !== 'pinned'; }

  /* ---------- the flat: decor per chunk (dens and all), critters and bugs as you get near ---------- */
  chunkDecor(ix, iy) {
    const key = ix + ',' + iy; let ch = this.chunks.get(key);
    if (ch) return ch;
    const T = BN.TILE, rng = mulberry(bnHash(ix, iy, this.seed)), decor = [], at = () => [ix * T + rng() * T, iy * T + rng() * T];
    const put = (kind, n, o = {}) => { for (let i = 0; i < n; i++) { const [x, y] = at(), g = this.grassAt(x, y); if (o.sand && g > 0.5) continue; if (o.grass && g < 0.4) continue; decor.push(Object.assign({ kind, x, y, r: rand(o.r[0], o.r[1]) * 1, a: rng() * TAU, s: rng(), c: o.cols ? o.cols[Math.floor(rng() * o.cols.length)] : null }, o.extra || {})); } };
    put('rock', rng() < 0.45 ? 1 : rng() < 0.2 ? 2 : 0, { r: [16, 28] });
    put('loggerhead', rng() < 0.3 ? 1 : 0, { r: [14, 22] });
    put('vase', Math.floor(rng() * 2.4), { r: [6, 10], cols: ['#d9772e', '#a85fc0', '#c9a23a'] });
    put('ball', Math.floor(rng() * 3), { r: [4, 7], cols: ['#e5a531', '#d0602c', '#e9c94a'] });
    put('rod', Math.floor(rng() * 3), { r: [8, 14], grass: true, cols: ['#8a4fb8', '#7a4a3a', '#b0643a'] });
    put('urchin', Math.floor(rng() * 3), { r: [4, 6.5] });
    put('star', rng() < 0.35 ? 1 : 0, { r: [8, 12], sand: true, cols: ['#e8742c', '#d9532f', '#f0a23a'] });
    put('cuke', Math.floor(rng() * 2), { r: [7, 10] });
    put('conch', rng() < 0.18 ? 1 : 0, { r: [7, 9], sand: true });
    put('biscuit', Math.floor(rng() * 2), { r: [4, 6], sand: true });
    ch = { decor, dens: decor.filter((d) => d.kind === 'rock' || d.kind === 'loggerhead'), lived: false };
    this.chunks.set(key, ch);
    return ch;
  }
  // bugs, crabs, shrimp, rays and the odd sleeping nurse shark, once per chunk as the boat comes near
  populate(ix, iy) {
    const ch = this.chunkDecor(ix, iy); if (ch.lived) return; ch.lived = true;
    const T = BN.TILE, rng = mulberry(bnHash(ix, iy, this.seed + 77)), at = () => [ix * T + rng() * T, iy * T + rng() * T];
    const b0 = this.boat;
    if (Math.abs(ix * T + T / 2 - b0.x) < T * 1.2 && Math.abs(iy * T + T / 2 - b0.y) < T * 1.2) return;   // nothing under the boat at the start
    const lam = 0.42 * this.moon.walk * Math.sqrt(this.perks.bite);
    for (let i = bnPoisson(rng, lam); i > 0; i--) { const [x, y] = at(); this.addBug(x, y); }
    for (let i = bnPoisson(rng, 0.32); i > 0; i--) { const [x, y] = at(); this.crits.push({ kind: 'crab', x, y, h: rng() * TAU, t: rng() * 9, sp: 0, flee: 0, side: rng() < 0.5 ? 1 : -1 }); }
    for (let i = bnPoisson(rng, 0.55); i > 0; i--) { const [x, y] = at(), dots = []; for (let k = randi(4, 9); k > 0; k--) dots.push({ dx: rand(-40, 40), dy: rand(-40, 40), ph: rand(0, TAU), gone: 0 }); this.shrimp.push({ x, y, dots }); }
    if (rng() < 0.05) { const [x, y] = at(); if (this.grassAt(x, y) < 0.45) this.crits.push({ kind: 'ray', x, y, h: rng() * TAU, t: 0, v: 0, flee: 0, s: rand(0.8, 1.05) }); }
    if (rng() < 0.03) { const [x, y] = at(); this.crits.push({ kind: 'nurse', x, y, h: rng() * TAU, t: 0, v: 0, flee: 0, len: rand(120, 160) }); }
    if (rng() < 0.12) { const [x, y] = at(); this.jellies.push({ x, y, ph: rng() * TAU, r: rand(10, 16) }); }
  }
  addBug(x, y, o = {}) {
    const cl = o.cl != null ? o.cl : rollCL(this.perks, BN_SITE);
    const b = { kind: 'bug', id: ++this.nid, x, y, h: o.h != null ? o.h : rand(0, TAU), cl, w: lobsterWeight(cl), eggs: o.eggs != null ? o.eggs : cl > 3.0 && chance(0.14),
      gold: o.gold != null ? o.gold : cl > 3.0 && chance(0.035 * this.perks.trophy * BN_SITE.gold), st: 'walk', stT: rand(1.5, 4), sp: 0, stress: 0, lit: 0, eyes: 0, misses: 0, vx: 0, vy: 0, t: rand(0, 9), seen: false, gone: false };
    const r = Math.random();
    b.temper = o.temper || (b.gold || (cl >= 4.2 && chance(0.55)) ? 'wary' : cl < 3 && chance(0.6) ? 'calm' : r < 0.5 ? 'calm' : r < 0.85 ? 'skittish' : 'wary');
    b.C = 6.5 + cl * 3.4;
    this.bugs.push(b);
    return b;
  }
  ensureChunks() {
    const T = BN.TILE, W = Game.W, H = Game.H, x0 = Math.floor((this.cam.x - W / 2 - 360) / T), x1 = Math.floor((this.cam.x + W / 2 + 360) / T), y0 = Math.floor((this.cam.y - H / 2 - 420) / T), y1 = Math.floor((this.cam.y + H / 2 + 300) / T);
    for (let iy = y0; iy <= y1; iy++) for (let ix = x0; ix <= x1; ix++) this.populate(ix, iy);
  }
  // keeps the night moving: when there's been nothing ahead of the boat for a while, a bug walks out of the dark ahead
  director(dt) {
    this.dirT -= dt; if (this.dirT > 0) return; this.dirT = 1;
    const b = this.boat, f = this.fwd();
    const ahead = this.bugs.some((g) => this.open(g) && dist(g.x, g.y, b.x, b.y) < 720 && (g.x - b.x) * f.x + (g.y - b.y) * f.y > 60);
    this.dry = ahead ? 0 : this.dry + 1;
    if (this.dry >= 5) { this.dry = 0; const k = rand(380, 520), s = rand(-200, 200); this.addBug(b.x + f.x * k - f.y * s, b.y + f.y * k + f.x * s); }
    // forget what's far behind
    if (this.bugs.length > 60) this.bugs = this.bugs.filter((g) => !g.gone && dist(g.x, g.y, b.x, b.y) < 1600);
    if (this.crits.length > 50) this.crits = this.crits.filter((g) => dist(g.x, g.y, b.x, b.y) < 1600);
    if (this.shrimp.length > 50) this.shrimp = this.shrimp.filter((g) => dist(g.x, g.y, b.x, b.y) < 1600);
  }

  /* ---------- input ---------- */
  actionZone() { return { x: Game.W - 96, y: Game.H - 96, r: 66 }; }
  // the NET / TWIST button only shows (and only takes touches) when there's something to do with it
  actionShown() { return this.net.state === 'pin' || (this.net.state === 'carry' && !!this.netTarget()); }
  inAction(x, y) { const a = this.actionZone(); return this.actionShown() && dist(x, y, a.x, a.y) < a.r + 8; }
  busy() { return !!(this.gauge || this.help || this.intro || this.ended); }
  pointerDown(p) {
    if (this.basePointerDown(p) || this.busy()) return;
    if (this.inAction(p.x, p.y)) { this.actionPtr = p.id; this.actionPress = true; return; }
    if (this.net.state === 'pin') { this.twist(); return; }   // anywhere on the water twists
    this.press = { id: p.id, sx: p.x, sy: p.y, t0: this.t };
  }
  pointerMove(p) {
    if (this.press && this.press.id === p.id && dist(p.x, p.y, this.press.sx, this.press.sy) > 12) { this.drag = { id: p.id, x: p.x, y: p.y }; this.press = null; this.unlock(); }
    if (this.drag && this.drag.id === p.id) { this.drag.x = p.x; this.drag.y = p.y; }
  }
  pointerUp(p) {
    if (this.paused || this.leaving) { this.press = null; this.drag = null; this.actionPtr = null; return; }   // let go under the pause menu: no drop
    if (this.press && this.press.id === p.id) { const [wx, wy] = this.toWorld(p); this.press = null; this.tapAt(wx, wy); }
    if (this.drag && this.drag.id === p.id) { this.drag = null; this.light.still = 0; }
    if (this.actionPtr === p.id) this.actionPtr = null;
  }
  keyDown(c) {
    if (this.help) { if (['Space', 'Enter', 'Escape', 'KeyH'].includes(c)) this.closeHelp(); return; }
    if (this.baseKeyDown(c) || this.busy()) return;
    if (c === 'KeyH') { this.openHelp(); return; }
    if (c === 'Space' || c === 'KeyE' || c === 'KeyF') this.actionPress = true;
  }
  setNotch(n) { const was = this.notch; this.notch = clamp(n, 0, BN_SPEED.length - 1); if (was !== this.notch) { SFX.play('click'); this.holdSaid = false; } }
  openHelp() { if (!this.gauge && !this.ended && !this.paused && this.net.state === 'carry') { this.help = { t: 0 }; this.press = null; this.drag = null; this.actionPtr = null; } }
  closeHelp() { this.help = null; this.press = null; this.drag = null; this.actionPtr = null; }
  // a tap on the water: on (or just behind) a bug you can see and reach, the net drops there. Anywhere else, the light
  // swings there; on a bug too far away, the light goes on it and your buddy brings you over.
  tapAt(wx, wy) {
    if (this.net.state === 'pin') { this.twist(); return; }
    if (this.net.state !== 'carry' || this.net.cool > 0) return;
    const near = this.thingNear(wx, wy, 0.3), bw = this.bow();
    if (near && this.reachable(near.x, near.y) && dist(bw.x, bw.y, wx, wy) <= BN.REACH + BN.SPAN) { this.dropNet(wx, wy); return; }
    if (near) {
      this.aimLight(near.x, near.y, near.kind === 'bug' ? near : null);
      if (!this.coachSaw.far) { this.coachSaw.far = true; Game.toast('Too far for the net', { color: PAL.warn, size: 28, y: 170, sub: 'Keep the light on it. Your buddy idles you over.' }); }
      this.say('far', 0.5);
      return;
    }
    const bug = this.thingNear(wx, wy, 0.01, true);   // only its eyes showing: light it up first
    if (bug) this.aimLight(bug.x, bug.y, bug); else this.aimLight(wx, wy, null);
  }
  // the nearest thing at a point you could see well enough to net (minI: how lit it has to be). bugsOnly: eyes count.
  thingNear(wx, wy, minI, bugsOnly) {
    let best = null, bd = 1e9;
    for (const b of this.bugs) {
      if (!this.open(b)) continue;
      const d = dist(wx, wy, b.x, b.y); if (d > BN.TAP || d >= bd) continue;
      if (bugsOnly ? b.eyes < 0.25 : this.lightAt(b.x, b.y) < minI) continue;
      best = b; bd = d;
    }
    if (bugsOnly) return best;
    for (const c of this.crits) {
      const size = c.kind === 'nurse' ? c.len * 0.42 : c.kind === 'ray' ? 34 : 10, d = Math.max(0, dist(wx, wy, c.x, c.y) - size);
      if (d > BN.TAP * 0.6 || d >= bd || this.lightAt(c.x, c.y) < minI) continue;
      best = c; bd = d;
    }
    return best;
  }
  aimLight(x, y, bug) {
    const L = this.light, bw = this.bow();
    L.ox = x - this.boat.x; L.oy = y - this.boat.y; L.lock = bug || null; L.lockHover = bug && Input.hover ? { x: Input.hover.x, y: Input.hover.y } : null;
    if (dist(bw.x, bw.y, x, y) > BN.LIGHT) { const a = Math.atan2(y - bw.y, x - bw.x); L.ox = bw.x + Math.cos(a) * BN.LIGHT - this.boat.x; L.oy = bw.y + Math.sin(a) * BN.LIGHT - this.boat.y; }
    L.still = 0;
  }
  unlock() { const L = this.light; if (L.lock) { L.ox = L.x - this.boat.x; L.oy = L.y - this.boat.y; } L.lock = null; L.lockHover = null; }
  // the bug the NET button goes after: the one in the light (the locked one first) within the net's reach
  netTarget() {
    if (this.net.state !== 'carry') return null;
    const L = this.light, ok = (b) => b && this.open(b) && b.st !== 'flip' && this.reachable(b.x, b.y) && this.lightAt(b.x, b.y) > 0.35;
    if (ok(L.lock)) return L.lock;
    let best = null, bi = 0.35;
    for (const b of this.bugs) { if (!ok(b)) continue; const I = this.lightAt(b.x, b.y); if (I > bi) { bi = I; best = b; } }
    return best;
  }
  actionHeld() { return this.actionPtr != null || Input.held('Space', 'KeyE'); }

  /* ---------- the net ---------- */
  dropNet(tx, ty) {
    const n = this.net; if (n.state !== 'carry' || n.cool > 0) return;
    const bw = this.bow(), d = dist(bw.x, bw.y, tx, ty);
    if (d > BN.REACH + BN.SPAN) { tx = bw.x + (tx - bw.x) * (BN.REACH + BN.SPAN) / d; ty = bw.y + (ty - bw.y) * (BN.REACH + BN.SPAN) / d; }
    const h = this.carryPos();
    this.net = { state: 'drop', t: 0, fx: h.x, fy: h.y, tx, ty, x: h.x, y: h.y, cool: 0, splashed: false, spooked: [] };
    for (const b of this.bugs) { b.react = false; b.rx = 0; }
    this.drops++; this.press = null; this.drag = null;
    SFX.play('swish'); Game.vibrate(15);
  }
  landNet() {
    const n = this.net; n.state = 'set'; n.t = 0; n.x = n.tx; n.y = n.ty;
    this.puff(n.x, n.y, 16);
    // what's under the hoop: a bug pinned (a flipping one backed itself in), or something you shouldn't have netted
    let best = null, bd = 1e9;
    for (const b of this.bugs) {
      if (!this.open(b)) continue;
      const d = dist(b.x, b.y, n.x, n.y), r = BN.HOOP * bnTemper(b).hoop * (1 + (this.perks.window - 1) * 0.4);
      if (d < r * 0.95 && d < bd) { bd = d; best = b; }
    }
    // the pro move: the hoop came down behind its tail (or it shot back into it), so it backed itself into the net
    if (best) { this.pin(best, (n.x - best.x) * Math.cos(best.h) + (n.y - best.y) * Math.sin(best.h) < -best.C * 0.45); return; }
    for (const c of this.crits) { const size = c.kind === 'nurse' ? c.len * 0.4 : c.kind === 'ray' ? 30 : 8; if (dist(c.x, c.y, n.x, n.y) < BN.HOOP + size * 0.6) { this.netCritter(c); return; } }
    for (const d of this.densNear(n.x, n.y, 60)) if (dist(d.x, d.y, n.x, n.y) < d.r + 10 && this.bugs.some((b) => b.st === 'den' && b.den === d)) { this.say('den'); break; }
    // the hoop hitting the bottom close by: it feels that and shoots backward (into the hoop, if you dropped it behind)
    for (const b of this.bugs) {
      if (!this.open(b) || b.st === 'crouch' || b.st === 'flip') continue;
      if (dist(b.x, b.y, n.x, n.y) < BN.SENSE && chance(0.1 + 0.9 * bnTemper(b).sense)) this.spook(b);
    }
  }
  spook(b) { b.st = 'crouch'; b.stT = bnTemper(b).crouch; b.spooked = true; this.net.spooked && this.net.spooked.push(b); }
  pin(b, pro) {
    const n = this.net, T = bnTemper(b);
    n.state = 'pin'; n.t = 0; n.bug = b; n.pro = !!pro; n.kicks = 0; n.kick = 0; n.nextKick = rand(0.3, 0.55);
    n.win = T.kick * this.perks.window * (this.grassAt(n.x, n.y) > 0.6 ? 0.85 : 1) * (this.coach ? 1.35 : 1);
    b.st = 'pinned'; b.vx = 0; b.vy = 0; b.sp = 0; this.light.lock = b;
    SFX.play('net'); Game.vibrate(30);
    if (b.gold) this.say('gold');
  }
  // TWIST (a tap anywhere, or the button) while the bug is in the hoop: right when it kicks up into the bag, it's yours
  twist() {
    const n = this.net; if (n.state !== 'pin') return;
    const b = n.bug;
    if (n.kick > 0) {
      SFX.play('twist'); SFX.play('coin'); Game.vibrate(40);
      if (n.pro) { this.addLine('Backed it into the net', 50); this.fl.add(...this.toScreen(n.x, n.y - 46), 'PRO MOVE +50', PAL.sun, 24); this.say('pro'); }
      else if (!b.misses) { this.addLine('One drop, one bug', 25); this.fl.add(...this.toScreen(n.x, n.y - 46), 'CLEAN DROP +25', PAL.sun, 22); }
      b.st = 'bag'; n.state = 'lift'; n.t = 0; n.caught = b; this.light.lock = null;
      this.coach = false; Store.set('coach_bullynet_' + this.ch, true);
      return;
    }
    if (this.coach) { Game.toast('Not yet!', { color: PAL.warn, size: 30, y: 170, sub: 'Wait for it to kick up into the bag, then TWIST' }); return; }
    this.say('early', 0.8);
    this.slip(b, 'Too soon! It slipped out under the rim', 'Wait for it to kick up into the bag, then twist.');
  }
  // out under the rim: it shoots off away from the boat
  slip(b, msg, sub) {
    const n = this.net, away = Math.atan2(b.y - this.boat.y, b.x - this.boat.x) + rand(-0.8, 0.8);
    b.h = away + Math.PI; b.st = 'flip'; b.vx = Math.cos(away) * bnTemper(b).flip; b.vy = Math.sin(away) * bnTemper(b).flip; b.spooked = false;
    this.missed(b, true); SFX.play('flip'); this.puff(b.x, b.y, 10);
    n.state = 'lift'; n.t = 0; n.caught = null; this.light.lock = null;
    Game.toast(msg, { color: PAL.warn, size: 28, y: 170, sub: b.wise ? 'That bug’s gone. Find another.' : sub });
  }
  missed(b, quiet) {
    b.misses++; b.stress = 1;
    if (b.misses >= bnTemper(b).misses) b.wise = true;   // it's had enough: no more freezing in the light, it heads for cover
    if (!quiet) this.say('miss', 0.6);
  }
  netCritter(c) {
    const n = this.net; n.state = 'lift'; n.t = 0; n.caught = null;
    if (c.kind === 'crab') { Game.toast('Just a crab', { color: '#cfe3ea', size: 28, y: 170, sub: 'Shake it out. Orange eyes are bugs.' }); this.say('crab'); c.flee = 3; c.side = chance(0.5) ? 1 : -1; return; }
    const shark = c.kind === 'nurse', lose = shark ? 5 : 3;
    this.timeLeft = Math.max(0, this.timeLeft - lose); c.flee = 6; c.v = shark ? 70 : 90; c.h = Math.atan2(c.y - this.boat.y, c.x - this.boat.x);
    SFX.play('bigsplash'); Game.shake(shark ? 8 : 5, 0.4); Game.vibrate(shark ? 120 : 60);
    Game.toast(shark ? 'NURSE SHARK!' : 'That’s a stingray!', { color: PAL.bad, size: 34, y: 160, sub: (shark ? 'It thrashed the net and took off.' : 'Don’t net the rays.') + ' (−' + lose + ' sec)' });
    this.say(shark ? 'shark' : 'ray');
    this.puff(c.x, c.y, 26);
  }
  updateNet(dt) {
    const n = this.net; n.cool = Math.max(0, (n.cool || 0) - dt);
    if (n.state === 'carry') { const p = this.carryPos(); n.x = p.x; n.y = p.y; return; }
    n.t += dt;
    if (n.state === 'drop') {
      const k = easeInOut(clamp(n.t / BN.DROP, 0, 1)); n.x = lerp(n.fx, n.tx, k); n.y = lerp(n.fy, n.ty, k);
      if (!n.splashed && n.t > BN.DROP * 0.55) {
        n.splashed = true; SFX.play('plunge');
        this.parts.add({ kind: 'ring', x: n.x, y: n.y, size: BN.HOOP * 0.8, grow: 70, life: 0.7, color: 'rgba(230,245,255,0.6)', lw: 2.5 });
        for (let i = 0; i < 14; i++) this.bio.add({ x: n.x + rand(-30, 30), y: n.y + rand(-30, 30), vx: rand(-20, 20), vy: rand(-20, 20), drag: 2, life: rand(0.6, 1.4), size: rand(1, 2.4), color: '#8ff6ff' });
        for (const f of this.bait) { const a = Math.atan2(f.y - n.y, f.x - n.x); f.vx += Math.cos(a) * 260; f.vy += Math.sin(a) * 260; }
      }
      // the bugs that see it coming (it's in front of them, or right on top): they shoot backward before it lands
      for (const b of this.bugs) {
        if (b.react || !this.open(b) || b.st === 'crouch' || b.st === 'flip') continue;
        if (dist(b.x, b.y, n.tx, n.ty) > BN.SENSE) continue;
        const T = bnTemper(b);
        if (n.t < T.react * (b.st === 'freeze' ? 1.25 : 1) * BN.DROP * (b.rx || (b.rx = rand(0.8, 1.2)))) continue;
        b.react = true;
        const front = (n.tx - b.x) * Math.cos(b.h) + (n.ty - b.y) * Math.sin(b.h) > -BN.HOOP * 0.3;
        if (front && chance(T.sense)) this.spook(b);
      }
      if (n.t >= BN.DROP) this.landNet();
    } else if (n.state === 'set') {
      // a bug shooting backward into the hoop (moving toward its middle, not out past the rim) is caught
      for (const b of this.bugs) if (b.st === 'flip' && !b.gone && dist(b.x, b.y, n.x, n.y) < BN.HOOP * bnTemper(b).hoop * 0.95 && b.vx * (n.x - b.x) + b.vy * (n.y - b.y) > 0) { this.pin(b, b.spooked); return; }
      if (n.t > BN.SET) {
        n.state = 'lift'; n.t = 0; n.caught = null;
        const sp = (n.spooked || []).filter((b) => !b.gone);
        for (const b of sp) this.missed(b, true);
        if (sp.length) {
          const b = sp[0], behind = (n.x - b.x) * Math.cos(b.h) + (n.y - b.y) * Math.sin(b.h) < 0;
          this.say('miss', 0.7); this.coachSaw.behind = true;
          Game.toast(behind ? 'Missed! It shot off sideways' : 'Missed! It shot backward', { color: PAL.warn, size: 28, y: 170, sub: b.wise ? 'That bug’s gone. Find another.' : b.misses === 1 ? 'Lobsters shoot BACKWARD. Drop the net just behind the tail.' : 'One more miss and it’s gone' });
        }
      }
    } else if (n.state === 'pin') {
      const b = n.bug;
      b.x = approach(b.x, n.x, 6, dt); b.y = approach(b.y, n.y, 6, dt); b.t += dt;
      if (n.kick > 0) {
        n.kick -= dt;
        if (n.kick <= 0) { n.kicks++; n.nextKick = rand(0.4, 0.7); if (n.kicks >= 3) { this.say('rim', 0.8); this.slip(b, 'It slipped out under the rim!', 'Tap TWIST the moment it kicks up into the bag.'); } }
      } else {
        n.nextKick -= dt;
        if (n.nextKick <= 0) { n.kick = n.win; SFX.play('flip'); this.puff(n.x, n.y, 6); }
      }
    } else if (n.state === 'lift') {
      const p = this.carryPos(), k = easeOut(clamp(n.t / BN.LIFT, 0, 1));
      n.x = lerp(n.tx, p.x, k); n.y = lerp(n.ty, p.y, k);
      if (n.caught) { n.caught.x = n.x; n.caught.y = n.y; }
      if (n.t >= BN.LIFT) {
        const b = n.caught; this.net = { state: 'carry', t: 0, x: p.x, y: p.y, cool: 0.2 };
        for (let i = 0; i < 8; i++) this.parts.add({ x: p.x + rand(-14, 14), y: p.y + rand(-10, 10), vx: rand(-10, 10), vy: rand(10, 40), life: 0.6, size: rand(1, 2), color: 'rgba(220,240,255,0.8)' });
        if (b) { b.gone = true; this.gauge = { lob: b, t: 0 }; Game.toasts = []; this.drag = null; this.press = null; }
      }
    }
  }
  decide(keep) {
    const lob = this.gauge.lob; this.gauge = null;
    bagDecide(this, lob, keep, this.toScreen(this.boat.x, this.boat.y - 70));
    if (!keep) SFX.play('plop');
  }
  buildResult() { return bagResult(this); }
  // time's up with the net in the water (a bug in the hoop, or on its way down): that drop gets finished first
  lastChance() { const n = this.net; return n.state === 'drop' || n.state === 'set' || n.state === 'pin' || (n.state === 'lift' && !!n.caught); }

  /* ---------- update ---------- */
  update(dt) {
    if (this.gauge) { if (!this.paused) { this.gauge.t += dt; this.t += dt; } Game.toasts = []; SFX.setEngine(0.35, 0); return; }
    if (this.help) { this.help.t += dt; this.t += dt; Game.toasts = []; return; }   // the clock stops while you read
    if (this.baseUpdate(dt)) { if (this.ended) this.updateWorld(dt, true); return; }
    if (this.quip) { this.quip.t -= dt; if (this.quip.t <= 0) this.quip = null; }
    if (this.intro) {
      const I = this.intro; I.t += dt;
      this.light.on = I.t > 0.35 && !(I.t > 0.45 && I.t < 0.52) && !(I.t > 0.6 && I.t < 0.64);
      if (I.t > 0.35 && !I.click) { I.click = true; SFX.play('lighton'); }
      if (I.t > 0.9) { this.intro = null; this.light.on = true; }
    }
    this.updateLight(dt);
    this.updateWorld(dt, false);
    this.updateNet(dt);
    if (this.actionPress) {
      this.actionPress = false;
      if (this.net.state === 'pin') this.twist();
      else { const b = this.netTarget(); if (b) this.dropNet(b.x, b.y); }
    }
    // the crew: calls when eyes show up at the edge of the light, chatter when it's quiet
    this.callCool -= dt; this.quietT -= dt;
    if (this.callCool <= 0 && !this.coach) {
      const b = this.bugs.find((g) => this.open(g) && !g.seen && g.eyes > 0.45 && g.lit < 0.6);
      if (b) { b.seen = true; this.callCool = rand(6, 10); this.say('spot', 0.75, this.clockOf(b.x, b.y)); }
    }
    for (const b of this.bugs) if (b.eyes > 0.5) b.seen = true;
    if (this.quietT <= 0) { this.quietT = rand(20, 32); if (!this.quip) this.say(chance(0.3) ? (this.moon.lit > 0.7 ? 'moon' : this.moon.lit < 0.25 ? 'dark' : 'quiet') : 'quiet', 0.6); }
    // the engine idling under it all
    const v = this.boat.v; SFX.setEngine(0.32 + 0.2 * clamp(v / 46, 0, 1), 0.015 + 0.09 * clamp(v / 46, 0, 1));
  }
  updateLight(dt) {
    const L = this.light, b = this.boat, bw = this.bow();
    if (this.intro) { L.still = 0; }
    // where the light wants to be: under the finger while you drag; on the locked bug; or riding along with the boat
    let moved = false;
    if (this.drag) { const [wx, wy] = this.toWorld(this.drag); L.ox = wx - b.x; L.oy = wy - b.y; L.lock = null; moved = true; }
    else if (!Game.touch && Input.hover && !this.press) {
      const h = Input.hover, last = this.lastHover;
      if (!last || dist(h.x, h.y, last.x, last.y) > 0.5) {
        this.lastHover = { x: h.x, y: h.y };
        const overUI = !!UI.hit(h.x, h.y) || this.inAction(h.x, h.y);
        if (last && !overUI && (!L.lock || !L.lockHover || dist(h.x, h.y, L.lockHover.x, L.lockHover.y) > 26)) { const [wx, wy] = this.toWorld(h); L.ox = wx - b.x; L.oy = wy - b.y; L.lock = null; moved = true; }
      }
    }
    let kx = 0, ky = 0;
    if (Input.held('ArrowLeft', 'KeyA')) kx -= 1; if (Input.held('ArrowRight', 'KeyD')) kx += 1;
    if (Input.held('ArrowUp', 'KeyW')) ky -= 1; if (Input.held('ArrowDown', 'KeyS')) ky += 1;
    if (kx || ky) { this.unlock(); L.ox += kx * 320 * dt; L.oy += ky * 320 * dt; moved = true; }
    if (L.lock && (!this.open(L.lock) && L.lock.st !== 'pinned' || dist(bw.x, bw.y, L.lock.x, L.lock.y) > BN.LIGHT + 40)) this.unlock();
    let tx = b.x + L.ox, ty = b.y + L.oy;
    if (L.lock) { tx = L.lock.x; ty = L.lock.y; }
    // keep it out from the bow and within the lamp's throw
    const d = dist(bw.x, bw.y, tx, ty), a = Math.atan2(ty - bw.y, tx - bw.x);
    if (d > BN.LIGHT || d < BN.LIGHT_MIN) { const k = clamp(d, BN.LIGHT_MIN, BN.LIGHT); tx = bw.x + Math.cos(a) * k; ty = bw.y + Math.sin(a) * k; if (!L.lock) { L.ox = tx - b.x; L.oy = ty - b.y; } }
    L.tx = tx; L.ty = ty;
    L.x = approach(L.x, tx, 9, dt); L.y = approach(L.y, ty, 9, dt);
    L.a = Math.atan2(L.y - bw.y, L.x - bw.x); L.st = 1 + 0.4 * clamp(dist(bw.x, bw.y, L.x, L.y) / BN.LIGHT, 0, 1);
    // hold the light still on a bug and it stays on it (lift your finger, the light keeps tracking it)
    L.still = moved ? 0 : L.still + dt;
    if (!L.lock && !this.drag && L.still > 0.25 && this.net.state === 'carry') {
      let best = null, bd = BN.CORE * 0.6;
      for (const g of this.bugs) { if (!this.open(g) || g.st === 'flip') continue; const dd = dist(g.x, g.y, L.x, L.y); if (dd < bd) { bd = dd; best = g; } }
      if (best) { L.lock = best; L.lockHover = Input.hover && !Game.touch ? { x: Input.hover.x, y: Input.hover.y } : null; }
    }
  }
  updateWorld(dt, frozen) {
    const t = this.t;
    if (!frozen) { this.updateBoat(dt); this.updateCam(dt); this.ensureChunks(); this.director(dt); }
    this.bio.update(dt);   // (the session's own particles and floaters tick in baseUpdate)
    const b0 = this.boat;
    for (const b of this.bugs) { if (b.gone || dist(b.x, b.y, b0.x, b0.y) > 1300) continue; this.updateBug(b, dt); }
    for (const c of this.crits) { if (dist(c.x, c.y, b0.x, b0.y) > 1300) continue; this.updateCrit(c, dt); }
    for (const s of this.shrimp) for (const d of s.dots) { d.ph += dt; if (d.gone > 0) d.gone -= dt; else if (this.lightAt(s.x + d.dx, s.y + d.dy) > 0.6) { d.gone = rand(4, 9); if (chance(0.3)) this.puff(s.x + d.dx, s.y + d.dy, 2); } }
    for (const j of this.jellies) { j.ph += dt; j.x += Math.cos(this.windA) * 4 * dt; j.y += Math.sin(this.windA) * 4 * dt + Math.sin(j.ph) * 3 * dt; }
    // glass minnows crowd the light
    const L = this.light;
    for (const f of this.bait) {
      f.ph += dt;
      const tx = L.x + Math.cos(f.ph * 0.7 + f.x * 0.01) * 50, ty = L.y + Math.sin(f.ph * 0.9) * 40;
      if (L.on) { f.vx += (tx - f.x) * 1.6 * dt; f.vy += (ty - f.y) * 1.6 * dt; }
      f.vx *= Math.exp(-1.6 * dt); f.vy *= Math.exp(-1.6 * dt); f.x += f.vx * dt; f.y += f.vy * dt;
      if (dist(f.x, f.y, L.x, L.y) > 900) { f.x = L.x + rand(-60, 60); f.y = L.y + rand(-60, 60); }
    }
    for (const p of this.puffs) { p.t += dt; p.r += dt * 26; }
    this.puffs = this.puffs.filter((p) => p.t < p.life);
    // bioluminescence: the prop wash and the bow wave sparkle when the boat moves
    if (!frozen && b0.v > 4 && chance(dt * (6 + b0.v * 0.4))) {
      const f = this.fwd(), s = rand(-1, 1), back = rand(-70, -86);
      this.bio.add({ x: b0.x + f.x * back - f.y * s * 12, y: b0.y + f.y * back + f.x * s * 12, vx: -f.x * 10 + rand(-6, 6), vy: -f.y * 10 + rand(-6, 6), drag: 1, life: rand(0.8, 1.8), size: rand(0.8, 2), color: chance(0.5) ? '#7ff0ff' : '#b8fff2' });
    }
    // a houndfish skips across the light now and then
    if (!frozen) {
      this.houndT -= dt;
      if (this.houndT <= 0 && !this.hound && L.on) {
        this.houndT = rand(28, 46); const a = rand(0, TAU), side = chance(0.5) ? 1 : -1;
        this.hound = { x: L.x - Math.cos(a) * 340 * side, y: L.y - Math.sin(a) * 340 * side, vx: Math.cos(a) * 560 * side, vy: Math.sin(a) * 560 * side, t: 0 };
        SFX.play('skitter'); this.say('houndfish', 0.6);
      }
    }
    if (this.hound) { const h = this.hound; h.t += dt; h.x += h.vx * dt; h.y += h.vy * dt; if (chance(dt * 30)) this.parts.add({ kind: 'ring', x: h.x, y: h.y, size: 2, grow: 30, life: 0.5, color: 'rgba(230,245,255,0.5)', lw: 1.2 }); if (h.t > 1.3) this.hound = null; }
    void t;
  }
  updateBoat(dt) {
    const b = this.boat, L = this.light, bw = this.bow(), n = this.net;
    let want = BN_SPEED[this.notch].v;
    const lk = L.lock && this.open(L.lock) ? L.lock : null;
    if (lk) {
      // your buddy follows the light to the bug, and holds up once the net can reach it
      const d = dist(bw.x, bw.y, lk.x, lk.y);
      if (d < BN.REACH * 0.8) { want = 0; if (!this.holdSaid && b.v > 6) { this.holdSaid = true; this.say('hold', 0.6); } }
      else { want = Math.min(Math.max(want, 24), d < BN.REACH * 1.3 ? 28 : 44); this.holdSaid = false; }
      if (this.notch === 0) want = 0;
    } else if (this.netTarget()) want *= 0.4;   // a bug in the light: easing off
    if (n.state !== 'carry' || this.intro) want = 0;   // the net's in the water: hold up
    const toL = dist(bw.x, bw.y, L.tx, L.ty), aim = Math.atan2(L.ty - b.y, L.tx - b.x), diff = angleDiff(b.h, aim);
    if (toL > 80 && this.notch > 0 && n.state === 'carry') { const rate = 0.55 * clamp(b.v / 20, 0.3, 1); b.h += clamp(diff, -rate * dt, rate * dt); }
    b.v = approach(b.v, want * (1 - 0.45 * Math.min(1, Math.abs(diff) / 1.5)), want < b.v ? 2.2 : 1.1, dt);
    const drift = this.weather.drift * 6 * (n.state === 'carry' && !(lk && want === 0) ? 1 : 0.3), dx = Math.cos(b.h) * b.v * dt + Math.cos(this.windA) * drift * dt, dy = Math.sin(b.h) * b.v * dt + Math.sin(this.windA) * drift * dt;
    b.x += dx; b.y += dy;
    if (!L.lock) { L.x += dx; L.y += dy; }   // the light rides along with the boat
  }
  updateCam(dt) {
    const b = this.boat; this.camH += angleDiff(this.camH, b.h) * (1 - Math.exp(-1.5 * dt));
    this.cam.x = approach(this.cam.x, b.x + Math.cos(this.camH) * BN.LOOK, 3, dt); this.cam.y = approach(this.cam.y, b.y + Math.sin(this.camH) * BN.LOOK, 3, dt);
  }
  densNear(x, y, r) {
    const T = BN.TILE, out = [], ix0 = Math.floor((x - r - 30) / T), ix1 = Math.floor((x + r + 30) / T), iy0 = Math.floor((y - r - 30) / T), iy1 = Math.floor((y + r + 30) / T);
    for (let iy = iy0; iy <= iy1; iy++) for (let ix = ix0; ix <= ix1; ix++) for (const d of this.chunkDecor(ix, iy).dens) if (dist(d.x, d.y, x, y) < r + d.r) out.push(d);
    return out;
  }
  bolt(b, loud) {
    const L = this.light, T = bnTemper(b);
    b.st = 'bolt'; b.stT = rand(2.2, 3.2) * (b.wise ? 2 : 1); b.stress = b.wise ? 1 : 0.35;
    b.goal = Math.atan2(b.y - L.y, b.x - L.x) + rand(-0.5, 0.5);
    const den = this.densNear(b.x, b.y, 220).sort((p, q) => dist(p.x, p.y, b.x, b.y) - dist(q.x, q.y, b.x, b.y))[0];
    b.den = den && !this.bugs.some((g) => g.st === 'den' && g.den === den) ? den : null;
    if (loud && b.lit > 0.5) this.say('bolt', 0.5);
    void T;
  }
  updateBug(b, dt) {
    const T = bnTemper(b), I = this.lightAt(b.x, b.y);
    b.t += dt; b.lit = I;
    // eyeshine: the light coming straight back off its eyes, strongest when it faces the lamp
    const bw = this.bow(), face = Math.max(0, Math.cos(angleDiff(b.h, Math.atan2(bw.y - b.y, bw.x - b.x))));
    b.eyes = b.st === 'pinned' || b.st === 'bag' ? 0 : clamp((I - 0.008) / 0.18, 0, 1) * (0.55 + 0.45 * face) * (b.st === 'den' ? 0.7 : 1);
    if (b.st === 'pinned' || b.st === 'bag') return;
    const mv = (sp, turnTo, rate) => { if (turnTo != null) b.h += clamp(angleDiff(b.h, turnTo), -rate * dt, rate * dt); b.sp = approach(b.sp, sp, 4, dt); b.x += Math.cos(b.h) * b.sp * dt; b.y += Math.sin(b.h) * b.sp * dt; };
    switch (b.st) {
      case 'walk':
        b.h += (flNoise(b.t * 0.35, b.id * 3.1, 7) - 0.5) * 1.8 * dt; mv(T.walk, null, 0);
        if ((b.stT -= dt) <= 0) { b.st = 'idle'; b.stT = rand(0.8, 2.6); }
        break;
      case 'idle':
        mv(0, null, 0);
        if ((b.stT -= dt) <= 0) { b.st = 'walk'; b.stT = rand(2, 5); b.h += rand(-1.2, 1.2); }
        break;
      case 'freeze':
        mv(0, null, 0);
        break;
      case 'bolt': {
        const goal = b.den ? Math.atan2(b.den.y - b.y, b.den.x - b.x) : b.goal;
        mv(T.walk * 2.6, goal, 4);
        if (b.den && dist(b.x, b.y, b.den.x, b.den.y) < b.den.r * 0.7) { b.st = 'den'; b.stT = b.wise ? 1e9 : rand(9, 16); b.sp = 0; if (b.lit > 0.3) this.say('den', 0.5); break; }
        if ((b.stT -= dt) <= 0) { b.st = 'walk'; b.stT = rand(2, 4); b.stress = b.wise ? 1 : 0.2; }
        break;
      }
      case 'den':
        if ((b.stT -= dt) <= 0 && dist(b.x, b.y, this.boat.x, this.boat.y) > 420) { b.st = 'walk'; b.stT = rand(2, 4); b.h = Math.atan2(b.y - b.den.y, b.x - b.den.x); b.den = null; b.stress = 0; }
        break;
      case 'crouch':
        b.sp = 0;
        if ((b.stT -= dt) <= 0) { b.st = 'flip'; b.vx = -Math.cos(b.h) * T.flip; b.vy = -Math.sin(b.h) * T.flip; SFX.play('flip'); this.puff(b.x, b.y, 8); }
        break;
      case 'flip': {
        b.x += b.vx * dt; b.y += b.vy * dt; const k = Math.exp(-6.5 * dt); b.vx *= k; b.vy *= k;
        if (Math.hypot(b.vx, b.vy) < 40) { b.vx = 0; b.vy = 0; this.bolt(b, false); }
        break;
      }
    }
    // the light: a bug in the middle of it freezes. It holds still while the boat is far off; the closer the boat
    // comes (and the brighter the moon), the sooner it bolts
    if (b.st === 'walk' || b.st === 'idle' || b.st === 'freeze') {
      if (b.wise) { if (I > 0.3) this.bolt(b, false); }
      else if (I > 0.62) {
        b.st = 'freeze'; b.unfreeze = 0;
        const near = clamp(1 - (dist(bw.x, bw.y, b.x, b.y) - 120) / 260, 0.12, 1);
        b.stress += dt * T.shy * near / (this.perks.window * (b.first ? 2.5 : 1)) * (0.9 + 0.3 * this.moon.lit);
        if (b.stress >= 1) this.bolt(b, true);
      } else if (b.st === 'freeze') { b.unfreeze = (b.unfreeze || 0) + dt; if (b.unfreeze > 0.7) { b.st = 'walk'; b.stT = rand(1, 3); } }
      if (I < 0.3) b.stress = Math.max(0, b.stress - dt * 0.2);
    }
  }
  updateCrit(c, dt) {
    c.t += dt; const I = this.lightAt(c.x, c.y);
    if (c.kind === 'crab') {
      if (I > 0.55 && c.flee <= 0) { c.flee = rand(1.2, 2); c.side = chance(0.5) ? 1 : -1; }
      const sp = c.flee > 0 ? 70 : (Math.sin(c.t * 0.7 + c.x) > 0.3 ? 12 : 0); c.flee -= dt;
      c.x += -Math.sin(c.h) * sp * c.side * dt; c.y += Math.cos(c.h) * sp * c.side * dt;   // crabs go sideways
      c.moving = sp > 1;
    } else {
      if (c.flee > 0) { c.flee -= dt; c.x += Math.cos(c.h) * c.v * dt; c.y += Math.sin(c.h) * c.v * dt; c.v = approach(c.v, c.flee > 1 ? c.v : 0, 0.8, dt); }
      else if (I > 0.7) { c.lit = (c.lit || 0) + dt; if (c.lit > 5) { c.flee = 4; c.v = 40; c.lit = 0; } }   // tired of the light: glides off
    }
  }
  puff(x, y, n) { this.puffs.push({ x, y, r: 6 + n * 0.6, t: 0, life: 1.1, a: Math.min(0.55, 0.12 + n * 0.025) }); }

  /* ---------- the ground: soft tiles of sand and turtle grass with everything that lives on it, made once ---------- */
  tileAt(ix, iy) {
    const key = ix + ',' + iy; let c = this.tiles.get(key);
    if (c) return c;
    const T = BN.TILE, res = this.tileRes, N = T / 4 + 2;
    c = document.createElement('canvas'); c.width = Math.ceil(T * res); c.height = Math.ceil(T * res);
    const g = c.getContext('2d');
    if (!this.cell) { this.cell = document.createElement('canvas'); this.cell.width = N; this.cell.height = N; }
    const cg = this.cell.getContext('2d'), img = cg.createImageData(N, N), s3 = (this.seed + 3) % 1000;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const wx = ix * T + (i - 1) * 4 + 2, wy = iy * T + (j - 1) * 4 + 2, gk = this.grassAt(wx, wy), n = flNoise(wx * 0.08, wy * 0.08, s3), m = flNoise(wx * 0.02, wy * 0.02, s3 + 9);
      const sand = [206 + 16 * m, 196 + 14 * m, 160 + 8 * m], grass = [50 + 20 * m, 86 + 26 * m, 58 + 14 * m], col = flMix(sand, grass, gk), k = 0.86 + 0.2 * n, p = (j * N + i) * 4;
      img.data[p] = col[0] * k; img.data[p + 1] = col[1] * k; img.data[p + 2] = col[2] * k; img.data[p + 3] = 255;
    }
    cg.putImageData(img, 0, 0);
    g.imageSmoothingEnabled = true; g.drawImage(this.cell, 0, 0, N, N, -4 * res, -4 * res, (T + 8) * res, (T + 8) * res);
    g.scale(res, res); g.translate(-ix * T, -iy * T);
    const rng = mulberry(bnHash(ix, iy, this.seed + 11));
    // turtle grass: flat blades leaning with the current, darker underneath
    g.lineCap = 'round';
    for (let k = 0; k < 900; k++) {
      const x = ix * T + rng() * T, y = iy * T + rng() * T, gk = this.grassAt(x, y);
      if (rng() > gk * 1.1) continue;
      const a = -2.2 + (rng() - 0.5) * 0.9, l = 5 + rng() * 8, sh = rng();
      g.strokeStyle = sh < 0.4 ? 'rgba(28,58,36,0.75)' : sh < 0.8 ? 'rgba(74,122,70,0.8)' : 'rgba(120,160,90,0.7)'; g.lineWidth = 1.4 + rng() * 1.2;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + 1.5, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    // bits of shell on the sand
    for (let k = 0; k < 70; k++) { const x = ix * T + rng() * T, y = iy * T + rng() * T; if (this.grassAt(x, y) > 0.4) continue; g.fillStyle = rng() < 0.5 ? 'rgba(250,244,226,0.75)' : 'rgba(120,110,86,0.35)'; ell(g, x, y, 0.8 + rng() * 1.4, 0.6 + rng()); g.fill(); }
    for (let jy = iy - 1; jy <= iy + 1; jy++) for (let jx = ix - 1; jx <= ix + 1; jx++) for (const d of this.chunkDecor(jx, jy).decor) {
      if (d.x < ix * T - 40 || d.x > ix * T + T + 40 || d.y < iy * T - 40 || d.y > iy * T + T + 40) continue;
      this.drawDecor(g, d);
    }
    this.tiles.set(key, c);
    if (this.tiles.size > 64) { for (const [k, v] of this.tiles) { const [a, b2] = k.split(',').map(Number); if (Math.abs(a * T - this.cam.x) > 1400 || Math.abs(b2 * T - this.cam.y) > 1000) { v.width = 1; v.height = 1; this.tiles.delete(k); } } }
    return c;
  }
  drawDecor(g, d) {
    const { x, y, r, a } = d;
    g.save(); g.translate(x, y); g.rotate(a);
    if (d.kind === 'rock') {
      g.fillStyle = 'rgba(20,28,20,0.35)'; ell(g, 3, 4, r * 1.1, r * 0.85); g.fill();
      const rng = mulberry(Math.floor(d.s * 1e6)); g.beginPath();
      for (let i = 0; i <= 10; i++) { const an = (i / 10) * TAU, rr2 = r * (0.78 + rng() * 0.3); i ? g.lineTo(Math.cos(an) * rr2, Math.sin(an) * rr2 * 0.8) : g.moveTo(Math.cos(an) * rr2, Math.sin(an) * rr2 * 0.8); }
      g.closePath(); const rg = g.createRadialGradient(-r * 0.3, -r * 0.3, 2, 0, 0, r); rg.addColorStop(0, '#9c917a'); rg.addColorStop(1, '#5e5644'); g.fillStyle = rg; g.fill();
      g.fillStyle = 'rgba(30,26,18,0.85)'; g.beginPath(); g.ellipse(r * 0.55, 0, r * 0.32, r * 0.42, 0, -Math.PI / 2, Math.PI / 2); g.fill();   // the hole under the ledge
      g.fillStyle = 'rgba(160,110,150,0.55)'; for (let i = 0; i < 4; i++) { ell(g, (rng() - 0.6) * r, (rng() - 0.5) * r * 0.9, 2 + rng() * 2.5, 2 + rng() * 2); g.fill(); }
    } else if (d.kind === 'loggerhead') {
      g.fillStyle = 'rgba(20,28,20,0.35)'; ell(g, 3, 4, r * 1.05, r * 1.05); g.fill();
      const rg = g.createRadialGradient(-r * 0.3, -r * 0.3, 2, 0, 0, r); rg.addColorStop(0, '#7a6244'); rg.addColorStop(1, '#4a3a26'); g.fillStyle = rg; ell(g, 0, 0, r, r); g.fill();
      g.fillStyle = '#2a2016'; ell(g, 0, 0, r * 0.38, r * 0.38); g.fill(); g.strokeStyle = 'rgba(160,130,90,0.5)'; g.lineWidth = 1.2; ell(g, 0, 0, r * 0.7, r * 0.7); g.stroke();
    } else if (d.kind === 'vase') {
      g.fillStyle = d.c; ell(g, 0, 0, r, r); g.fill(); g.fillStyle = 'rgba(30,20,20,0.75)'; ell(g, 0, 0, r * 0.5, r * 0.5); g.fill();
    } else if (d.kind === 'ball') {
      g.fillStyle = d.c; for (let i = 0; i < 3; i++) { ell(g, Math.cos(i * 2.1) * r * 0.6, Math.sin(i * 2.1) * r * 0.6, r * 0.7, r * 0.7); g.fill(); }
    } else if (d.kind === 'rod') {
      g.strokeStyle = d.c; g.lineCap = 'round'; g.lineWidth = 2;
      for (let i = 0; i < 4; i++) { const an = i * 1.6 + d.s * 3; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(Math.cos(an) * r * 0.5, Math.sin(an) * r * 0.5 + 3, Math.cos(an + 0.3) * r, Math.sin(an + 0.3) * r); g.stroke(); }
      g.fillStyle = '#3a2a2a'; ell(g, 0, 0, 2.5, 2.5); g.fill();
    } else if (d.kind === 'urchin') {
      g.strokeStyle = '#121418'; g.lineWidth = 1; for (let i = 0; i < 14; i++) { const an = (i / 14) * TAU; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(an) * r * 2.2, Math.sin(an) * r * 2.2); g.stroke(); }
      g.fillStyle = '#1b1d24'; ell(g, 0, 0, r, r); g.fill(); g.fillStyle = 'rgba(255,255,255,0.25)'; ell(g, -r * 0.3, -r * 0.3, r * 0.3, r * 0.3); g.fill();
    } else if (d.kind === 'star') {
      g.fillStyle = d.c; g.beginPath(); for (let i = 0; i < 10; i++) { const an = (i / 10) * TAU, rr2 = i % 2 ? r * 0.55 : r; g.lineTo(Math.cos(an) * rr2, Math.sin(an) * rr2); } g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,230,180,0.6)'; for (let i = 0; i < 5; i++) { const an = (i / 5) * TAU; ell(g, Math.cos(an) * r * 0.45, Math.sin(an) * r * 0.45, 1.2, 1.2); g.fill(); }
    } else if (d.kind === 'cuke') {
      g.fillStyle = '#4a3622'; rr(g, -r, -r * 0.38, r * 2, r * 0.76, r * 0.38); g.fill(); g.fillStyle = 'rgba(200,160,110,0.45)'; for (let i = 0; i < 5; i++) { ell(g, -r * 0.7 + i * r * 0.35, -r * 0.12, 1.3, 1.3); g.fill(); }
    } else if (d.kind === 'conch') {
      g.fillStyle = '#e8c4a8'; g.beginPath(); g.moveTo(r, 0); g.quadraticCurveTo(0, -r * 0.9, -r, -r * 0.2); g.quadraticCurveTo(-r * 0.4, r * 0.7, r, 0); g.fill();
      g.fillStyle = '#f2a0a0'; ell(g, r * 0.1, r * 0.1, r * 0.4, r * 0.22); g.fill();
    } else if (d.kind === 'biscuit') {
      g.fillStyle = '#ece4cc'; ell(g, 0, 0, r, r * 0.9); g.fill(); g.strokeStyle = 'rgba(150,130,100,0.6)'; g.lineWidth = 0.8; for (let i = 0; i < 5; i++) { const an = (i / 5) * TAU; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(an) * r * 0.6, Math.sin(an) * r * 0.6); g.stroke(); }
    }
    g.restore();
  }

  /* ---------- drawing ---------- */
  draw(ctx) {
    const W = Game.W, H = Game.H, t = this.t;
    const res = clamp(Math.round(Game.scale * Game.dpr * 4) / 4, 0.75, 2);
    if (res !== this.tileRes) { for (const c of this.tiles.values()) { c.width = 1; c.height = 1; } this.tiles.clear(); this.tileRes = res; }
    ctx.save(); ctx.translate(W / 2 - this.cam.x, H / 2 - this.cam.y);
    // the bottom
    const T = BN.TILE, x0 = Math.floor((this.cam.x - W / 2) / T), x1 = Math.floor((this.cam.x + W / 2) / T), y0 = Math.floor((this.cam.y - H / 2) / T), y1 = Math.floor((this.cam.y + H / 2) / T);
    for (let iy = y0; iy <= y1; iy++) for (let ix = x0; ix <= x1; ix++) ctx.drawImage(this.tileAt(ix, iy), ix * T, iy * T, T + 0.6, T + 0.6);
    const vis = (x, y, pad) => Math.abs(x - this.cam.x) < W / 2 + pad && Math.abs(y - this.cam.y) < H / 2 + pad;
    for (const p of this.puffs) { if (!vis(p.x, p.y, 60)) continue; ctx.fillStyle = `rgba(214,200,160,${(p.a * (1 - p.t / p.life)).toFixed(3)})`; ell(ctx, p.x, p.y, p.r, p.r * 0.85); ctx.fill(); }
    for (const c of this.crits) if (vis(c.x, c.y, 180)) this.drawCrit(ctx, c, t);
    for (const s of this.shrimp) { if (!vis(s.x, s.y, 60)) continue; ctx.fillStyle = 'rgba(230,200,180,0.5)'; for (const d of s.dots) if (d.gone <= 0) { ell(ctx, s.x + d.dx, s.y + d.dy, 2.4, 1.1, d.ph * 0.2); ctx.fill(); } }
    for (const b of this.bugs) if (!b.gone && b.st !== 'bag' && vis(b.x, b.y, 120)) this.drawBug(ctx, b, t);
    if (this.net.state === 'set' || this.net.state === 'pin') this.drawHoop(ctx, this.net, t, false);
    // the water over it all: a little green, and the glass minnows and jellies in it
    ctx.fillStyle = 'rgba(8,52,60,0.2)'; ctx.fillRect(this.cam.x - W / 2, this.cam.y - H / 2, W, H);
    for (const j of this.jellies) { if (!vis(j.x, j.y, 40)) continue; ctx.fillStyle = 'rgba(230,240,255,0.22)'; ell(ctx, j.x, j.y, j.r * (1 + Math.sin(j.ph * 2) * 0.08), j.r); ctx.fill(); ctx.strokeStyle = 'rgba(255,190,230,0.5)'; ctx.lineWidth = 1.2; for (let k = 0; k < 4; k++) { ell(ctx, j.x + Math.cos(k * 1.57) * j.r * 0.35, j.y + Math.sin(k * 1.57) * j.r * 0.35, j.r * 0.22, j.r * 0.22); ctx.stroke(); } }
    for (const f of this.bait) { ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(Math.atan2(f.vy, f.vx || 0.01)); ctx.fillStyle = 'rgba(200,225,230,0.32)'; ell(ctx, 0, 0, 3.4, 1); ctx.fill(); ctx.restore(); }
    if (this.hound) { const h = this.hound; ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(Math.atan2(h.vy, h.vx)); ctx.fillStyle = 'rgba(220,240,245,0.85)'; ell(ctx, 0, 0, 26, 2.4); ctx.fill(); ctx.fillStyle = 'rgba(120,200,190,0.8)'; ctx.fillRect(-26, -0.8, 30, 1.6); ctx.restore(); }
    this.parts.draw(ctx);
    if (this.net.state === 'drop' || this.net.state === 'lift' || this.net.state === 'carry') this.drawHoop(ctx, this.net, t, true);
    this.drawBoat(ctx, t);
    this.drawPole(ctx);
    ctx.restore();
    this.drawDark(ctx, W, H, t);
    // what shows up in the dark: the warm spill of the lamp, eyes shining back, the boat's lights, the plankton
    ctx.save(); ctx.translate(W / 2 - this.cam.x, H / 2 - this.cam.y);
    this.drawGlow(ctx, t, vis);
    ctx.restore();
    this.fl.draw(ctx);
    this.drawHud(ctx, W, H, t);
    if (this.gauge) drawLobsterGauge(ctx, W, H, this.gauge, this.bag.length, (keep) => this.decide(keep), { t: this.t, back: 'Back on the flat' });
    if (this.paused) this.drawPause(ctx);
  }
  drawBug(ctx, b, t) {
    const C = b.C;
    ctx.save(); ctx.translate(b.x, b.y);
    if (b.st === 'den') {   // tucked under the rock: only the antennae poke out
      ctx.rotate(b.h + Math.PI); ctx.globalAlpha = 0.85;
      for (const s of [-1, 1]) drawAntenna(ctx, 0, s * C * 0.12, C * 2.2, s * (0.25 + Math.sin(t * 1.3 + s + b.id) * 0.08), C * 0.07, s, b.gold ? LOBPAL.gold : LOBPAL.normal);
      ctx.restore(); return;
    }
    ctx.rotate(b.h);
    const flip = b.st === 'flip' ? clamp(Math.hypot(b.vx, b.vy) / 300, 0, 1) : b.st === 'crouch' ? 0.45 : 0;
    ctx.fillStyle = 'rgba(10,20,14,0.3)'; ell(ctx, -C * 0.2 + 3, 3, C * 1.5, C * 0.55); ctx.fill();
    if (b.st === 'pinned') ctx.translate(Math.sin(t * 30) * 1.2, Math.cos(t * 27) * 1.2);
    ctx.translate(C * 0.3, 0);
    drawLobsterTop(ctx, C, { t: b.t, gold: b.gold, walk: (b.st === 'walk' || b.st === 'bolt') && b.sp > 3, curl: flip, ant: flip * 0.6 });
    ctx.restore();
  }
  drawCrit(ctx, c, t) {
    ctx.save(); ctx.translate(c.x, c.y);
    if (c.kind === 'crab') {
      ctx.rotate(c.h); const w = 1, step = c.moving ? Math.sin(c.t * 16) * 2 : 0;
      ctx.strokeStyle = '#3d6f7a'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
      for (const s of [-1, 1]) for (let i = 0; i < 4; i++) { const lx = -4 + i * 3; ctx.beginPath(); ctx.moveTo(lx, s * 4); ctx.lineTo(lx - 2 + (i % 2 ? step : -step), s * 11); ctx.stroke(); }
      ctx.fillStyle = '#3f7c88'; ctx.beginPath(); ctx.moveTo(-6 * w, 0); ctx.quadraticCurveTo(-5, -8, 0, -7); ctx.lineTo(4, -12); ctx.lineTo(5, -6); ctx.quadraticCurveTo(8, 0, 5, 6); ctx.lineTo(4, 12); ctx.lineTo(0, 7); ctx.quadraticCurveTo(-5, 8, -6, 0); ctx.fill();
      ctx.strokeStyle = '#5aa0d8'; ctx.lineWidth = 2.4; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(5, s * 3); ctx.lineTo(10, s * 7); ctx.lineTo(14, s * 3); ctx.stroke(); }
      ctx.fillStyle = '#e8584a'; for (const s of [-1, 1]) { ell(ctx, 14.5, s * 3, 1.6, 1.2); ctx.fill(); }
    } else if (c.kind === 'ray') {
      ctx.globalAlpha = c.flee > 0 ? 1 : 0.88; drawRayTop(ctx, 0, 0, c.s, c.h, { t: c.flee > 0 ? c.t : 0, depth: 0 });
      if (c.flee <= 0) { ctx.fillStyle = 'rgba(214,200,160,0.35)'; ell(ctx, 0, 0, 30 * c.s, 14 * c.s, c.h); ctx.fill(); }   // half buried in the sand
    } else if (c.kind === 'nurse') {
      ctx.rotate(c.h); const L = c.len, sw = c.flee > 0 ? Math.sin(c.t * 5) * 0.25 : Math.sin(c.t * 0.6) * 0.04;
      ctx.fillStyle = 'rgba(10,20,14,0.3)'; ell(ctx, 4, 5, L * 0.5, L * 0.13); ctx.fill();
      ctx.fillStyle = '#9a7a52';
      ctx.save(); ctx.translate(-L * 0.3, 0); ctx.rotate(sw); ctx.beginPath(); ctx.moveTo(0, -L * 0.04); ctx.quadraticCurveTo(-L * 0.25, -L * 0.03, -L * 0.36, -L * 0.08); ctx.lineTo(-L * 0.3, L * 0.02); ctx.quadraticCurveTo(-L * 0.15, L * 0.05, 0, L * 0.04); ctx.fill(); ctx.restore();
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(L * 0.18, s * L * 0.08); ctx.lineTo(L * 0.02, s * L * 0.22); ctx.lineTo(L * 0.06, s * L * 0.07); ctx.fill(); ctx.beginPath(); ctx.moveTo(-L * 0.12, s * L * 0.05); ctx.lineTo(-L * 0.2, s * L * 0.12); ctx.lineTo(-L * 0.2, s * L * 0.04); ctx.fill(); }
      const g = ctx.createLinearGradient(0, -L * 0.1, 0, L * 0.1); g.addColorStop(0, '#8a6a44'); g.addColorStop(0.5, '#b08e60'); g.addColorStop(1, '#8a6a44');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(L * 0.42, 0); ctx.quadraticCurveTo(L * 0.42, -L * 0.1, L * 0.25, -L * 0.1); ctx.quadraticCurveTo(-L * 0.05, -L * 0.1, -L * 0.32, -L * 0.03); ctx.lineTo(-L * 0.32, L * 0.03); ctx.quadraticCurveTo(-L * 0.05, L * 0.1, L * 0.25, L * 0.1); ctx.quadraticCurveTo(L * 0.42, L * 0.1, L * 0.42, 0); ctx.fill();
      ctx.fillStyle = '#7a5c3c'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(-L * 0.02, s * L * 0.02); ctx.lineTo(-L * 0.1, s * L * 0.01); ctx.lineTo(-L * 0.06, 0); ctx.fill(); }
      ctx.strokeStyle = '#7a5c3c'; ctx.lineWidth = 1.4; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(L * 0.41, s * L * 0.025); ctx.lineTo(L * 0.46, s * L * 0.03); ctx.stroke(); }
    }
    ctx.restore();
  }
  // the hoop and its bag. inAir: on its way down or coming back up (bigger, with a shadow below it)
  drawHoop(ctx, n, t, inAir) {
    const R = BN.HOOP;
    let lift = 0;
    if (n.state === 'carry') lift = 1; else if (n.state === 'drop') lift = 1 - clamp(n.t / BN.DROP, 0, 1) * 1.05; else if (n.state === 'lift') lift = clamp(n.t / BN.LIFT, 0, 1);
    lift = clamp(lift, 0, 1);
    // held up, the hoop stands on edge (a thin ellipse from above); it swings flat as it comes down
    const sc = 1 + lift * 0.18, x = n.x, y = n.y - lift * 14, edge = 1 - 0.78 * easeInOut(lift), h = this.hands(), pa = Math.atan2(n.y - h.y, n.x - h.x);
    if (inAir && lift > 0.05) { ctx.fillStyle = `rgba(0,10,10,${0.25 * lift})`; ell(ctx, n.x + 10 * lift, n.y + 12 * lift, R, R * Math.max(edge, 0.25), pa); ctx.fill(); }
    ctx.save(); ctx.translate(x, y); ctx.rotate(pa); ctx.scale(sc, sc * edge); ctx.rotate(-pa);
    // the bag: mesh inside the hoop (twisted shut once it's caught)
    ctx.save(); ell(ctx, 0, 0, R, R); ctx.clip();
    ctx.fillStyle = n.state === 'lift' && n.caught ? 'rgba(20,30,30,0.35)' : 'rgba(220,235,235,0.08)'; ctx.fillRect(-R, -R, R * 2, R * 2);
    ctx.strokeStyle = 'rgba(225,235,235,0.38)'; ctx.lineWidth = 0.9;
    const tw = n.state === 'lift' && n.caught ? 0.6 : 0;
    ctx.rotate(tw);
    for (let i = -R; i <= R; i += 7) { ctx.beginPath(); ctx.moveTo(i, -R); ctx.lineTo(i + R * 0.4, R); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-R, i); ctx.lineTo(R, i + R * 0.4); ctx.stroke(); }
    ctx.restore();
    if (n.state === 'pin' && n.kick > 0) { const k = clamp(n.kick / (n.win || 0.6), 0, 1); ctx.fillStyle = `rgba(95,224,138,${0.18 + 0.2 * k})`; ell(ctx, 0, 0, R, R); ctx.fill(); }
    ctx.strokeStyle = '#dfe5e8'; ctx.lineWidth = 3.2; ell(ctx, 0, 0, R, R); ctx.stroke();
    ctx.strokeStyle = 'rgba(80,90,95,0.6)'; ctx.lineWidth = 1; ell(ctx, 0, 0, R - 2, R - 2); ctx.stroke();
    ctx.restore();
    // a bug kicking up into the bag: it rises toward you and looks bigger
    if (n.state === 'pin' && n.kick > 0 && n.bug) {
      const b = n.bug; ctx.save(); ctx.translate(n.x, n.y - 6); ctx.rotate(b.h); ctx.scale(1.15, 1.15); ctx.translate(b.C * 0.3, 0);
      drawLobsterTop(ctx, b.C, { t: this.t, gold: b.gold, curl: 0.7, ant: 0.4 }); ctx.restore();
      ctx.save(); ctx.translate(n.x, n.y - 6); ell(ctx, 0, 0, R, R); ctx.clip(); ctx.strokeStyle = 'rgba(225,235,235,0.45)'; ctx.lineWidth = 0.9; for (let i = -R; i <= R; i += 7) { ctx.beginPath(); ctx.moveTo(i, -R); ctx.lineTo(i + R * 0.4, R); ctx.stroke(); } ctx.restore();
    }
    if (n.state === 'lift' && n.caught) { const b = n.caught; ctx.save(); ctx.translate(x, y); ctx.rotate(b.h + 0.6); ctx.scale(0.8, 0.8); drawLobsterTop(ctx, b.C, { t: this.t, gold: b.gold, curl: 0.9, ant: 0.8 }); ctx.restore(); }
  }
  drawPole(ctx) {
    const n = this.net, h = this.hands(), R = BN.HOOP;
    let lift = n.state === 'carry' ? 1 : n.state === 'drop' ? clamp(1 - n.t / BN.DROP, 0, 1) : n.state === 'lift' ? clamp(n.t / BN.LIFT, 0, 1) : 0;
    const a = Math.atan2(n.y - lift * 14 - h.y, n.x - h.x), ex = n.x - Math.cos(a) * R * (1 + lift * 0.18), ey = n.y - lift * 14 - Math.sin(a) * R * (1 + lift * 0.18);
    ctx.strokeStyle = '#2a3036'; ctx.lineWidth = 4.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.strokeStyle = '#c3cbd1'; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.lineTo(ex, ey); ctx.stroke();
  }
  drawBoat(ctx, t) {
    const b = this.boat, crew = [this.driver, this.others[1] || null, this.ch];
    drawCenterConsoleTop(ctx, b.x, b.y, BN.BOAT, b.h, { crew, t, hull: '#f2f4f2', top: '#26344a' });
    // the lamp on the bow, pointed down the beam
    const f = this.fwd(), lx = b.x + f.x * 62, ly = b.y + f.y * 62, L = this.light;
    ctx.save(); ctx.translate(lx, ly); ctx.rotate(L.a); ctx.fillStyle = '#2a2f35'; rr(ctx, -6, -5, 12, 10, 3); ctx.fill(); ctx.fillStyle = L.on ? '#fff6d8' : '#6a6f74'; rr(ctx, 4, -4, 3, 8, 1.5); ctx.fill(); ctx.restore();
  }
  // the dark: everything outside the light, drawn on a small canvas and stretched (soft edges for free)
  drawDark(ctx, W, H, t) {
    const q = 0.5, cw = Math.ceil(W * q), ch = Math.ceil(H * q);
    if (!this.dark || this.dark.width !== cw || this.dark.height !== ch) { this.dark = document.createElement('canvas'); this.dark.width = cw; this.dark.height = ch; this.darkCtx = this.dark.getContext('2d'); }
    const g = this.darkCtx, L = this.light;
    g.setTransform(q, 0, 0, q, 0, 0); g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, W, H);
    g.fillStyle = `rgba(2,6,20,${(0.97 - 0.1 * this.moon.lit).toFixed(3)})`; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'destination-out';
    const hole = (x, y, rx, ry, rot, stops) => {
      g.save(); g.translate(x, y); g.rotate(rot); g.scale(rx, ry);
      const rg = g.createRadialGradient(0, 0, 0, 0, 0, 1); for (const [k, a] of stops) rg.addColorStop(k, `rgba(0,0,0,${a})`);
      g.fillStyle = rg; g.beginPath(); g.arc(0, 0, 1, 0, TAU); g.fill(); g.restore();
    };
    if (L.on) {
      const [sx, sy] = this.toScreen(L.x, L.y), wob = this.weather.id === 'breezy' ? 1 + Math.sin(t * 3.1) * 0.04 : 1, H0 = BN.HALO;
      hole(sx, sy, BN.CORE * L.st * H0 * wob, BN.CORE * H0 * wob, L.a, [[0, 1], [0.25, 1], [1 / H0, 0.93], [0.5, 0.5], [0.72, 0.18], [1, 0]]);
      // spill along the beam, from the lamp out to the spot
      const bw = this.bow(), [bx, by] = this.toScreen(bw.x, bw.y);
      for (let k = 1; k <= 4; k++) { const u = k / 5; hole(lerp(bx, sx, u), lerp(by, sy, u), 26 + 34 * u, 26 + 34 * u, 0, [[0, 0.22], [1, 0]]); }
    }
    const [ox, oy] = this.toScreen(this.boat.x, this.boat.y);
    hole(ox, oy, 125, 125, 0, [[0, 0.62], [0.6, 0.35], [1, 0]]);   // the deck light and the nav lights
    ctx.drawImage(this.dark, 0, 0, W, H);
  }
  drawGlow(ctx, t, vis) {
    const L = this.light, bw = this.bow(), f = this.fwd();
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    if (L.on) {
      // the warm spill of the lamp, and the beam through the water from the bow
      ctx.save(); ctx.translate(L.x, L.y); ctx.rotate(L.a); ctx.scale(BN.CORE * L.st * 1.5, BN.CORE * 1.5);
      const rg = ctx.createRadialGradient(0, 0, 0, 0, 0, 1); rg.addColorStop(0, 'rgba(255,214,150,0.2)'); rg.addColorStop(0.6, 'rgba(255,200,130,0.08)'); rg.addColorStop(1, 'rgba(255,200,130,0)');
      ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(0, 0, 1, 0, TAU); ctx.fill(); ctx.restore();
      const d = dist(bw.x, bw.y, L.x, L.y), pa = L.a + Math.PI / 2, wEnd = BN.CORE * 0.8;
      const bg = ctx.createLinearGradient(bw.x, bw.y, L.x, L.y); bg.addColorStop(0, 'rgba(255,240,205,0.14)'); bg.addColorStop(1, 'rgba(255,240,205,0.02)');
      ctx.fillStyle = bg; ctx.beginPath(); ctx.moveTo(bw.x + Math.cos(pa) * 4, bw.y + Math.sin(pa) * 4); ctx.lineTo(L.x + Math.cos(pa) * wEnd, L.y + Math.sin(pa) * wEnd); ctx.lineTo(L.x - Math.cos(pa) * wEnd, L.y - Math.sin(pa) * wEnd); ctx.lineTo(bw.x - Math.cos(pa) * 4, bw.y - Math.sin(pa) * 4); ctx.closePath(); ctx.fill();
      // specks drifting in the beam, and glints off the ripples where the light hits the surface
      for (const s of this.snow) {
        const x = L.x + s.x * 0.3, y = L.y + s.y * 0.3, I = this.lightAt(x, y); if (I < 0.15) continue;
        ctx.fillStyle = `rgba(255,250,230,${(0.5 * I * s.z * (0.5 + 0.5 * Math.sin(t * 2 + s.ph))).toFixed(3)})`; ctx.fillRect(x + Math.sin(t * 0.5 + s.ph) * 6, y + ((t * 6 * s.z) % 20), 1.4, 1.4);
      }
      const nG = this.weather.id === 'glass' ? 3 : this.weather.id === 'breezy' ? 14 : 7;
      for (let i = 0; i < nG; i++) {
        const u = h01(i * 3.1 + Math.floor(t * 1.2 + i * 0.37)), v = h01(i * 7.7 + Math.floor(t * 1.2 + i * 0.37)), x = L.x + (u - 0.5) * BN.CORE * 2.2, y = L.y + (v - 0.5) * BN.CORE * 2, I = this.lightAt(x, y);
        if (I < 0.25) continue; const k = Math.sin(((t * 1.2 + i * 0.37) % 1) * Math.PI), l = 6 + 8 * u;
        ctx.strokeStyle = `rgba(255,248,225,${(0.28 * I * k).toFixed(3)})`; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x - l, y); ctx.quadraticCurveTo(x, y - 2.5, x + l, y); ctx.stroke();
      }
    }
    // eyes shining back at the light
    const eye = (x, y, r, col, a) => { if (a < 0.03) return; ctx.globalAlpha = clamp(a * 1.25, 0, 1); ctx.drawImage(bnGlow(col), x - r * 4.5, y - r * 4.5, r * 9, r * 9); };
    for (const b of this.bugs) {
      if (b.gone || b.eyes < 0.03 || !vis(b.x, b.y, 80)) continue;
      const C = b.C, ca = Math.cos(b.h), sa = Math.sin(b.h), fx = b.st === 'den' ? -C * 0.4 : C * 1.28, tw = 0.85 + 0.15 * Math.sin(t * 9 + b.id);
      for (const s of [-1, 1]) eye(b.x + ca * fx - sa * s * C * 0.1, b.y + sa * fx + ca * s * C * 0.1, 1.9 + C * 0.035, BN_EYE.bug, b.eyes * tw);
    }
    for (const s of this.shrimp) { if (!vis(s.x, s.y, 60)) continue; for (const d of s.dots) { if (d.gone > 0) continue; const I = this.lightAt(s.x + d.dx, s.y + d.dy); eye(s.x + d.dx, s.y + d.dy, 0.9, BN_EYE.shrimp, clamp(I / 0.25, 0, 1) * (0.6 + 0.4 * Math.sin(t * 5 + d.ph))); } }
    for (const c of this.crits) {
      if (!vis(c.x, c.y, 120)) continue; const I = clamp(this.lightAt(c.x, c.y) / 0.25, 0, 1); if (I < 0.03) continue;
      const ca = Math.cos(c.h), sa = Math.sin(c.h);
      if (c.kind === 'crab') for (const s of [-1, 1]) eye(c.x + ca * 8 - sa * s * 2.2, c.y + sa * 8 + ca * s * 2.2, 0.9, BN_EYE.crab, I * 0.8);
      else if (c.kind === 'nurse') for (const s of [-1, 1]) eye(c.x + ca * c.len * 0.3 - sa * s * c.len * 0.07, c.y + sa * c.len * 0.3 + ca * s * c.len * 0.07, 1.4, BN_EYE.shark, I * 0.7);
    }
    for (const f2 of this.bait) { const I = this.lightAt(f2.x, f2.y); if (I > 0.3 && Math.sin(t * 7 + f2.ph * 5) > 0.85) eye(f2.x, f2.y, 0.8, BN_EYE.fish, I * 0.6); }
    ctx.globalAlpha = 1;
    this.bio.draw(ctx);
    // the boat's running lights: red to port, green to starboard, the white all-round light aft
    const b = this.boat, s = BN.BOAT, P = (dx, dy) => [b.x + (f.x * dx - f.y * dy) * s, b.y + (f.y * dx + f.x * dy) * s];
    for (const [dx, dy, col, r] of [[66, -14.5, '#ff3b3b', 9], [66, 14.5, '#3bff7a', 9], [-60, 0, '#fff7e0', 11]]) { const [x, y] = P(dx, dy); ctx.globalAlpha = 0.9; ctx.drawImage(bnGlow(col), x - r * 2, y - r * 2, r * 4, r * 4); }
    ctx.globalAlpha = 1;
    if (L.on) { const lx = b.x + f.x * 64, ly = b.y + f.y * 64; ctx.drawImage(bnGlow('#fff2c8'), lx - 14, ly - 14, 28, 28); }
    ctx.restore();
    this.drawGuides(ctx, t);
  }
  // what the player needs to read in the dark: how far the net reaches, the bug the light is on, where to drop
  drawGuides(ctx, t) {
    if (this.gauge || this.intro) return;
    const bw = this.bow(), tgt = this.netTarget(), n = this.net;
    ctx.save(); ctx.setLineDash([6, 9]); ctx.lineWidth = 2; ctx.strokeStyle = tgt ? 'rgba(120,255,170,0.35)' : 'rgba(255,255,255,0.1)';
    ctx.beginPath(); ctx.arc(bw.x, bw.y, BN.REACH, this.boat.h - 1.9, this.boat.h + 1.9); ctx.stroke(); ctx.restore();
    const L = this.light, lk = L.lock;
    if (lk && this.open(lk) && n.state === 'carry') {   // brackets on the bug the light is holding
      const r = lk.C * 1.9, k = 0.6 + 0.4 * Math.sin(t * 5);
      ctx.save(); ctx.translate(lk.x, lk.y); ctx.strokeStyle = `rgba(255,214,90,${(0.45 + 0.35 * k).toFixed(3)})`; ctx.lineWidth = 2.5;
      for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.moveTo(r, r - 9); ctx.lineTo(r, r); ctx.lineTo(r - 9, r); ctx.stroke(); }
      ctx.restore();
    }
    if (tgt) {
      // close enough to net: the tag says what kind of bug it is, and (while you're learning) where to drop the net
      const T = TEMPER[tgt.temper] || TEMPER.skittish;
      ctx.font = fnt(12, 800); const pw = ctx.measureText(T.name).width + 18, px = tgt.x - pw / 2, py = tgt.y + tgt.C * 1.7 + 8;   // under the bug: the top of the screen is busy
      ctx.fillStyle = 'rgba(4,24,34,0.82)'; rr(ctx, px, py, pw, 18, 9); ctx.fill(); ctx.strokeStyle = T.col; ctx.lineWidth = 1.5; ctx.stroke();
      text(ctx, T.name, px + pw / 2, py + 9.5, { size: 12, align: 'center', base: 'middle', color: T.col, weight: 800 });
      if (this.coach || this.coachSaw.behind) {
        const bx = tgt.x - Math.cos(tgt.h) * (tgt.C * 1.15 + 14), by = tgt.y - Math.sin(tgt.h) * (tgt.C * 1.15 + 14), k = (Math.sin(t * 5) + 1) / 2;
        ctx.save(); ctx.setLineDash([5, 6]); ctx.lineDashOffset = -t * 20; ctx.strokeStyle = `rgba(95,224,138,${(0.6 + 0.35 * k).toFixed(3)})`; ctx.lineWidth = 2.5; ell(ctx, bx, by, BN.HOOP, BN.HOOP); ctx.stroke(); ctx.restore();
        text(ctx, (Game.touch ? 'TAP' : 'CLICK') + ' HERE', bx, by + 4, { size: 14, align: 'center', base: 'middle', color: '#bff5cf', weight: 800, stroke: 'rgba(0,0,0,0.7)', sw: 4 });
      }
    }
    // the eyes to go after, while you're learning: an arrow over them
    const eyes = this.coachEyes();
    if (eyes) {
      const [sx, sy] = this.toScreen(eyes.x, eyes.y), on = sx > 40 && sx < Game.W - 40 && sy > 150 && sy < Game.H - 40;
      if (on) {
        const y = eyes.y - 48 - Math.abs(Math.sin(t * 4)) * 12;
        ctx.save(); ctx.translate(eyes.x, y); ctx.fillStyle = PAL.sun; ctx.strokeStyle = PAL.ink; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(-11, -14); ctx.lineTo(11, -14); ctx.lineTo(11, 0); ctx.lineTo(19, 0); ctx.lineTo(0, 19); ctx.lineTo(-19, 0); ctx.lineTo(-11, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
        text(ctx, 'EYES!', eyes.x, y - 22, { size: 16, align: 'center', color: PAL.sun, weight: 800, stroke: PAL.ink, sw: 5 });
      }
    }
  }
  // while you're learning: the bug whose eyes you can see but haven't put the light on yet
  coachEyes() {
    if (!this.coach || this.net.state !== 'carry' || this.netTarget() || (this.light.lock && this.open(this.light.lock))) return null;
    let best = null, bd = 1e9;
    for (const b of this.bugs) { if (!this.open(b) || b.eyes < 0.2) continue; const d = dist(b.x, b.y, this.light.x, this.light.y); if (d < bd) { bd = d; best = b; } }
    return best;
  }
  drawHud(ctx, W, H, t) {
    this.drawTopBar(ctx);
    // the bag, and tonight's moon under it
    const gx = W - 214;
    panel(ctx, gx, 64, 200, 30, { r: 15 });
    drawMoon(ctx, gx + 18, 79, 8.5, this.moon.phase, { glow: false });
    text(ctx, this.moon.name, gx + 34, 84, { size: 14, weight: 800, color: '#dfe8ff', maxW: 156 });
    panel(ctx, gx, 12, 200, 46, { r: 23 });
    text(ctx, 'BAG', gx + 14, 41, { size: 15, weight: 800, color: '#cfe3ea' });
    for (let i = 0; i < BH.BAG; i++) { const lx = gx + 64 + i * 22, lob = this.bag[i]; ctx.globalAlpha = lob ? 1 : 0.25; ctx.save(); ctx.translate(lx, 36); ctx.rotate(-0.5); drawLobsterSide(ctx, 16, { gold: lob && lob.gold }); ctx.restore(); ctx.globalAlpha = 1; }
    // the boat: how fast your buddy idles along
    const sx = 14, sy = H - 74;
    panel(ctx, sx, sy - 22, 234, 82, { r: 18 });
    const lk = this.light.lock && this.open(this.light.lock), holding = this.net.state !== 'carry' || (lk && this.boat.v < 3 && this.notch > 0);
    text(ctx, 'BOAT · ' + (holding ? 'holding up' : this.boat.v > 3 ? BN_SPEED[this.notch].say : this.notch ? 'getting going' : BN_SPEED[0].say), sx + 14, sy - 4, { size: 12, color: '#9fb8c2', weight: 800, maxW: 206 });
    BN_SPEED.forEach((S, i) => UI.button(ctx, 'speed' + i, sx + 10 + i * 72, sy + 6, 66, 44, S.name, () => this.setNotch(i), { style: this.notch === i ? 'primary' : 'ghost', size: 15, r: 12, key: 'Digit' + (i + 1), disabled: !!(this.gauge || this.help) }));
    // the action button, only when there's something to do: NET when a bug's in the light within reach, TWIST while
    // one's in the hoop (WAIT until it kicks up into the bag). Tapping the water does the same.
    const a = this.actionZone(), active = this.actionShown();
    let label = '', fill = PAL.good, fg = PAL.ink, hot = false;
    if (this.net.state === 'pin') { const kick = this.net.kick > 0; label = kick ? 'TWIST' : 'WAIT'; fill = kick ? PAL.good : '#8fa9b3'; hot = kick; }
    else if (active) { label = 'NET'; fill = PAL.sun; }
    this.actionLabel = active ? label : '';   // what the button says (the tests read it)
    if (active && !this.gauge && !this.help) {
      const down = this.actionHeld(), pulse = down ? 0.93 : 1 + Math.sin(t * (hot ? 16 : 6)) * (hot ? 0.07 : 0.03);
      ctx.save(); ctx.translate(a.x, a.y + (down ? 3 : 0)); ctx.scale(pulse, pulse);
      ctx.fillStyle = rgba(fill, 0.25); ell(ctx, 0, 0, a.r + 12, a.r + 12); ctx.fill();
      ctx.fillStyle = fill; ell(ctx, 0, 0, a.r, a.r); ctx.fill();
      if (down) { ctx.fillStyle = 'rgba(255,255,255,0.22)'; ell(ctx, 0, 0, a.r, a.r); ctx.fill(); }
      ctx.strokeStyle = down ? '#ffffff' : 'rgba(255,255,255,0.8)'; ctx.lineWidth = down ? 5 : 3; ell(ctx, 0, 0, a.r, a.r); ctx.stroke();
      if (this.net.state === 'pin' && this.net.kick > 0) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, a.r + 6, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(this.net.kick / this.net.win, 0, 1)); ctx.stroke(); }
      text(ctx, label, 0, 2, { size: label.length > 4 ? 22 : 26, align: 'center', base: 'middle', color: fg, weight: 800 });
      if (!Game.touch) text(ctx, 'SPACE', 0, 26, { size: 12, align: 'center', base: 'middle', color: fg, weight: 800, alpha: 0.7 });
      ctx.restore();
    }
    // the hoop says when: WAIT while the bug's down in it, TWIST! when it kicks up into the bag
    if (this.net.state === 'pin') {
      const [nx, ny] = this.toScreen(this.net.x, this.net.y), kick = this.net.kick > 0, sc = kick ? 1 + Math.sin(t * 30) * 0.06 : 1;
      ctx.save(); ctx.translate(nx, ny < 160 ? ny + BN.HOOP + 28 : ny - BN.HOOP - 26); ctx.scale(sc, sc);
      text(ctx, kick ? 'TWIST!' : 'WAIT…', 0, 0, { size: kick ? 28 : 20, align: 'center', base: 'middle', color: kick ? PAL.good : '#cfe3ea', stroke: 'rgba(0,0,0,0.7)', sw: 5, weight: 800 });
      ctx.restore();
    }
    UI.button(ctx, 'bnhelp', W / 2 + 72, 12, 46, 46, '?', () => this.openHelp(), { style: 'dark', size: 22, r: 14, key: 'KeyH', disabled: !!(this.gauge || this.net.state !== 'carry') });
    if (this.t < 12 && !this.coach && !this.help && !this.gauge) {
      para(ctx, Game.touch ? 'Drag to sweep the light · tap just behind a bug to drop the net · ? for help' : 'Move the mouse to sweep the light · click just behind a bug to drop the net · H for help', 24, 84, Math.min(520, W - 260), { size: 16, color: '#fff', weight: 700, alpha: 0.85, stroke: 'rgba(0,0,0,0.5)', sw: 4, lh: 20 });
    }
    if (this.coach && !this.paused && !this.help && !this.gauge) this.drawCoach(ctx, W, H, t);
    if (this.quip && !this.help && !this.gauge && !(this.coachMsg() && !Game.toasts.length)) this.drawQuip(ctx, W);
    if (GFX.showFps) text(ctx, GFX.readout(false, '2D night'), W / 2, H - 8, { size: 13, align: 'center', color: '#fff', weight: 800, stroke: 'rgba(0,0,0,0.6)', sw: 4 });
    if (this.help) this.drawHelp(ctx, W, H);
  }
  coachMsg() {
    if (!this.coach) return null;
    const n = this.net, tgt = this.netTarget(), lk = this.light.lock && this.open(this.light.lock) ? this.light.lock : null;
    if (n.state === 'pin') return n.kick > 0 ? 'It kicked up into the bag: TWIST! (tap)' : 'Hold it there… wait for it to kick up into the bag';
    if (n.state !== 'carry') return null;
    if (tgt) return Game.touch ? 'Tap just behind its tail. It shoots backward, into the net.' : 'Click just behind its tail. It shoots backward, into the net.';
    if (lk) return 'Good. It froze in the light. Your buddy is idling you over…';
    if (this.coachEyes()) return Game.touch ? 'Orange eyes! Drag the light right onto the bug.' : 'Orange eyes! Move the light right onto the bug.';
    return Game.touch ? 'Drag on the water to sweep the light. Look for two orange eyes.' : 'Move the mouse to sweep the light. Look for two orange eyes.';
  }
  drawCoach(ctx, W, H, t) {
    const msg = this.coachMsg();
    if (!msg || Game.toasts.length) return;
    // between the score on the left and the bag on the right, as high as it goes: the bugs are lower down
    const x = 70, w = W - 224 - x - 10, y = 64;
    panel(ctx, x, y, w, 30, { r: 12, fill: 'rgba(255,255,255,0.95)', line: 'rgba(0,0,0,0.1)', shadow: false });
    text(ctx, msg, x + w / 2, y + 15.5, { size: 15, align: 'center', base: 'middle', color: PAL.ink, weight: 800, maxW: w - 16 });
    const n = this.net, lk = this.light.lock && this.open(this.light.lock);
    const step = n.state === 'pin' ? 3 : this.netTarget() ? 2 : lk ? 1 : 0, names = ['FIND', 'LIGHT', 'NET', 'TWIST', 'GAUGE'], pw = Math.min(74, (w - 24) / 5), sx0 = x + w / 2 - (pw * 5 + 24) / 2;
    names.forEach((nm, i) => {
      const px = sx0 + i * (pw + 6), now = i === step, done = i < step;
      ctx.fillStyle = now ? PAL.sun : done ? 'rgba(95,224,138,0.9)' : 'rgba(4,24,34,0.75)'; rr(ctx, px, y + 34, pw, 18, 9); ctx.fill();
      text(ctx, (i + 1) + ' ' + nm, px + pw / 2, y + 47, { size: 11, align: 'center', color: now || done ? PAL.ink : '#cfe3ea', weight: 800, maxW: pw - 6 });
    });
  }
  drawQuip(ctx, W) {
    const q = this.quip, C = CHARS[q.who]; if (!C) return;
    const qw = Math.min(400, W * 0.44), qx = W - qw - 14, qy = 102;
    ctx.save(); ctx.globalAlpha = Math.min(1, q.t * 3);
    panel(ctx, qx, qy, qw, 44, { r: 22, fill: 'rgba(255,255,255,0.95)', line: 'rgba(0,0,0,0.1)' });
    crewAvatar(ctx, q.who, qx + 24, qy + 22, 17);
    text(ctx, C.name + ': ' + q.msg, qx + 48, qy + 28, { size: 16, color: PAL.ink, weight: 800, maxW: qw - 60 });
    ctx.restore();
  }
  // How to bully net: four steps, each with a small moving picture, and what glows back in the dark.
  // Opens by itself on each angler's first night, and from ? (or H). The turn clock waits.
  drawHelp(ctx, W, H) {
    const t = this.help.t, wide = W >= 900;
    ctx.fillStyle = 'rgba(2,10,24,0.95)'; ctx.fillRect(0, 0, W, H);
    UI.region('help-cover', 0, 0, W, H, null);
    text(ctx, 'How to bully net', W / 2, 44, { display: true, size: 34, align: 'center', color: '#fff' });
    const cols = wide ? 4 : 2, gap = 12, cw = Math.floor((W - 48 - gap * (cols - 1)) / cols), ch = wide ? 236 : 150, y0 = 70;
    const steps = [
      { title: 'Find', body: (Game.touch ? 'Drag on the water to sweep the light.' : 'Move the mouse to sweep the light.') + ' Two orange eyes at the edge of the beam are a bug. Tiny red sparks are shrimp.' },
      { title: 'Light it', body: 'Put the light right on it. It freezes, but not for long. Your buddy idles over and holds up.' },
      { title: 'Net it', body: (Game.touch ? 'Tap' : 'Click') + ' just behind its tail. Lobsters shoot backward, right into the net. Drop it in front and they’re gone.' },
      { title: 'Twist', body: 'Wait for it to kick up into the bag, then TWIST. Too soon and it slips out under the rim. Then gauge it.' }
    ];
    steps.forEach((s, i) => {
      const x = 24 + (i % cols) * (cw + gap), y = y0 + Math.floor(i / cols) * (ch + gap), artW = wide ? cw : Math.min(140, cw * 0.42), artH = wide ? 96 : ch - 20;
      panel(ctx, x, y, cw, ch, { r: 14, fill: 'rgba(16,40,72,0.95)' });
      ctx.save(); rr(ctx, x + 6, y + 6, artW - 12, artH - 6, 10); ctx.clip(); ctx.fillStyle = '#04101e'; ctx.fillRect(x, y, artW, artH);
      this.helpArt(ctx, i, x + artW / 2, y + artH / 2 + 4, t, artW);
      ctx.restore();
      const tx = wide ? x + 14 : x + artW + 4, ty = wide ? y + artH + 22 : y + 26, tw = wide ? cw - 28 : cw - artW - 14;
      ctx.fillStyle = PAL.sun; ell(ctx, tx + 11, ty - 6, 11, 11); ctx.fill();
      text(ctx, String(i + 1), tx + 11, ty - 5, { size: 14, align: 'center', base: 'middle', color: PAL.ink, weight: 800 });
      text(ctx, s.title, tx + 28, ty, { size: 19, color: '#fff', weight: 800 });
      para(ctx, s.body, tx, ty + 24, tw, { size: wide ? 16 : 14, color: '#d6e4f2', weight: 600, lh: wide ? 20 : 17 });
    });
    // what glows back in the dark
    const ky = y0 + (wide ? ch : ch * 2 + gap) + 22;
    const items = [[BN_EYE.bug, true, 'a lobster: net it'], [BN_EYE.shrimp, false, 'shrimp'], [BN_EYE.crab, true, 'a crab'], [BN_EYE.shark, true, 'a nurse shark: leave it']];
    let kx = 24;
    ctx.font = fnt(14, 700);
    for (const [col, pair, what] of items) {
      const ww = ctx.measureText(what).width; if (kx + 34 + ww > W - 24) break;
      ctx.fillStyle = 'rgba(2,8,16,1)'; rr(ctx, kx, ky - 13, 30, 24, 8); ctx.fill();
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = bnGlow(col); if (pair) { ctx.drawImage(g, kx + 5, ky - 9, 12, 12); ctx.drawImage(g, kx + 13, ky - 9, 12, 12); } else ctx.drawImage(g, kx + 10, ky - 6, 9, 9); ctx.restore();
      text(ctx, what, kx + 36, ky + 4, { size: 14, color: '#d6e4f2', weight: 700 });
      kx += 36 + ww + 22;
    }
    UI.button(ctx, 'help-ok', W / 2 - 110, H - 66, 220, 54, 'Got it', () => this.closeHelp(), { style: 'primary', size: 22, key: 'Enter|Space|Escape|KeyH' });
  }
  // the little moving pictures on the help card: a dark patch of flat, the light, a bug
  helpArt(ctx, i, cx, cy, t, aw) {
    const C = 15, spot = (x, y, r, a = 1) => { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(214,200,150,${a})`); g.addColorStop(0.55, `rgba(150,140,100,${a * 0.6})`); g.addColorStop(1, 'rgba(20,24,20,0)'); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); };
    const eyes = (x, y, h, a) => { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a; for (const s of [-1, 1]) ctx.drawImage(bnGlow(BN_EYE.bug), x + Math.cos(h) * C * 1.28 - Math.sin(h) * s * C * 0.1 - 6, y + Math.sin(h) * C * 1.28 + Math.cos(h) * s * C * 0.1 - 6, 12, 12); ctx.restore(); };
    const bug = (x, y, h, o = {}) => { ctx.save(); ctx.translate(x, y); ctx.rotate(h); ctx.translate(C * 0.3, 0); drawLobsterTop(ctx, C, Object.assign({ t }, o)); ctx.restore(); };
    const hoop = (x, y, a = 1, col = '#dfe5e8') => { ctx.strokeStyle = col; ctx.globalAlpha = a; ctx.lineWidth = 2.5; ell(ctx, x, y, 24, 24); ctx.stroke(); ctx.globalAlpha = 1; };
    if (i === 0) {   // the light sweeps; eyes glow at its edge; a red speck is a shrimp
      const sx = cx + Math.sin(t * 1.2) * aw * 0.28; spot(sx, cy, 44);
      const bx = cx + aw * 0.22, by = cy - 4, I = clamp(1 - Math.abs(sx - bx) / 90, 0, 1);
      ctx.globalAlpha = clamp(I * 2 - 0.9, 0, 1); bug(bx, by, Math.PI); ctx.globalAlpha = 1; eyes(bx, by, Math.PI, I);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = clamp(1 - Math.abs(sx - (cx - aw * 0.2)) / 90, 0, 1); ctx.drawImage(bnGlow(BN_EYE.shrimp), cx - aw * 0.2 - 4, cy + 14, 8, 8); ctx.restore();
    } else if (i === 1) {   // the light on a bug: it freezes; a ring drains
      spot(cx, cy, 50); bug(cx - 6, cy + 4, -0.3);
      const k = 1 - ((t % 3) / 3); ctx.strokeStyle = PAL.sun; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy - 32, 8, -Math.PI / 2, -Math.PI / 2 + TAU * k); ctx.stroke();
    } else if (i === 2) {   // the net drops behind the tail; it shoots backward into it
      spot(cx, cy, 52); const ph = t % 2.6, h = 0, bx0 = cx + 18, hx = cx - 26;
      const fl = ph > 1.1 ? clamp((ph - 1.1) / 0.25, 0, 1) : 0, bx = lerp(bx0, hx + 6, easeOut(fl));
      if (ph > 0.6) hoop(hx, cy + 2, Math.min(1, (ph - 0.6) * 4), ph > 1.35 ? PAL.good : '#dfe5e8');
      bug(bx, cy + 2, h, { curl: fl > 0 && fl < 1 ? 0.8 : 0 });
      if (ph < 0.9) text(ctx, 'TAP', hx, cy + 7, { size: 13, align: 'center', color: '#bff5cf', weight: 800 });
    } else {   // in the hoop: it kicks up into the bag, then TWIST
      spot(cx, cy, 50); const ph = t % 2.2, kick = ph > 0.9 && ph < 1.6;
      hoop(cx, cy + 2, 1, kick ? PAL.good : '#dfe5e8');
      ctx.save(); ctx.translate(cx, cy + 2); ctx.scale(kick ? 1.15 : 1, kick ? 1.15 : 1); bug(0, 0, -0.6, { curl: kick ? 0.7 : 0 }); ctx.restore();
      text(ctx, kick ? 'TWIST!' : 'WAIT…', cx, cy - 32, { size: 15, align: 'center', color: kick ? PAL.good : '#cfe3ea', weight: 800, stroke: 'rgba(0,0,0,0.6)', sw: 4 });
    }
  }
}
