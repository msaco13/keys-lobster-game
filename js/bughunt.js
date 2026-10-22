'use strict';
/* Keys Crew — Bug Hunt. Free-dive the reef for spiny lobster.
   Hold on a hole (or TICKLE) to coax the bug out, and let go when it twitches. When it walks out,
   click or tap it to swing the net. Lobsters tail-flip backward toward their hole, so a net set
   behind one catches it. Gauge every bug: carapace over 3", no eggs. Six per person.
   Now and then a shark shows up, and you race it back to the boat. */

const BH = { SURF: 96, BAG: 6, BOATX: 660 };
const GAUGE_IN = 3.0;
const NET = { REACH: 170, HOOP: 30, SWING: 0.2, SET: 1.3, COOL: 0.3 };
const BH_SITES = {
  patch: { WW: 3400, floor: 500, ledgeH: [62, 120], gap: [150, 260], bugs: 6, morays: 3, extra: 0.3, shark: 0.35, gold: 1, big: 1, short: 0.34, grade: 0.16 },
  reef: { WW: 4300, floor: 700, ledgeH: [110, 240], gap: [120, 220], bugs: 9, morays: 5, extra: 0.35, shark: 0.55, gold: 2, big: 1.7, short: 0.24, grade: 0.36, light: true }
};

function rollCL(perks, site) {
  const r = Math.random(), sh = site ? site.short : 0.3;
  if (r < sh) return Math.round(rand(2.45, 2.97) * 100) / 100;
  if (r < sh + 0.12) return Math.round(rand(2.95, 3.1) * 100) / 100;
  const big = chance(0.16 * ((perks && perks.trophy) || 1) * (site ? site.big : 1));
  return Math.round((3.1 + Math.pow(Math.random(), 1.7) * (big ? 2.9 : 1.6)) * 100) / 100;
}
const lobsterWeight = (cl) => Math.round(0.034 * Math.pow(cl, 2.9) * 10) / 10;
const bugLen = (lob) => 46 + lob.cl * 5;

// what the rest of the crew yells from the boat
const QUIPS = {
  nice: ['Nice bug!', 'That’s dinner!', 'Look at that thing!', 'Into the cooler!'],
  big: ['THAT’S a big boy!', 'Big boy alert!', 'Now THAT’S a bug!'],
  short: ['Uh… that looked short.', 'FWC is gonna love that one.', 'Bro. Gauge it again.'],
  moray: ['HAHAHA wrong hole!', 'Morays bite, bro!', 'That’s an eel house!'],
  jelly: ['Jellies, man.', 'Watch the jellies!'],
  blackout: ['Breathe, bro!', 'Got you. Easy now.'],
  shark: ['SHARK!! Back to the boat!', 'Uhh… SHARK! SWIM!', 'SHARK! Move, move, move!'],
  escape: ['Never seen you swim that fast!', 'Bro walked on water.', 'I was gonna film it.', 'Still counts as a dive.'],
  caught: ['That’s the tax man!', 'He took a bug! HAHA', 'Sharks gotta eat too.'],
  gold: ['Is that… GOLD?!', 'No way. A golden bug!'],
  octo: ['Inked! HAHA', 'The octopus wins that one.'],
  miss: ['Tail-flipped you!', 'So close!', 'Net BEHIND it, bro!'],
  pro: ['Textbook!', 'Right into the net. Clean.', 'That’s how it’s done.'],
  empty: ['Nobody home.', 'Empty hole, bro.']
};

// a tiling caustic pattern (the bright net of light on the sand), built once
let BH_CAUSTIC = null;
function causticTile() {
  if (BH_CAUSTIC) return BH_CAUSTIC;
  const S = 192, c = document.createElement('canvas'); c.width = S; c.height = S;
  const g = c.getContext('2d'), img = g.createImageData(S, S), rng = mulberry(99), pts = [];
  for (let i = 0; i < 16; i++) pts.push([rng() * S, rng() * S]);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let d1 = 1e9, d2 = 1e9;
    for (const [px, py] of pts) for (let oy = -S; oy <= S; oy += S) for (let ox = -S; ox <= S; ox += S) { const dd = Math.hypot(x - px - ox, y - py - oy); if (dd < d1) { d2 = d1; d1 = dd; } else if (dd < d2) d2 = dd; }
    const k = Math.max(0, 1 - (d2 - d1) / 10), p = (y * S + x) * 4;
    img.data[p] = 255; img.data[p + 1] = 255; img.data[p + 2] = 230; img.data[p + 3] = Math.round(255 * k * k);
  }
  g.putImageData(img, 0, 0);
  return (BH_CAUSTIC = c);
}

class BugHuntScene extends SessionBase {
  constructor(o) {
    super(o);
    const v = (SPOTS[o.spot] && SPOTS[o.spot].variant) || 'patch';
    this.variant = BH_SITES[v] ? v : 'patch'; this.site = BH_SITES[this.variant]; this.WW = this.site.WW;
    this.music = 'reef';
    this.resultHeader = 'FWC check at the ramp';
    this.diver = { x: BH.BOATX + 70, y: BH.SURF - 26, vx: 0, vy: 0, facing: 1, stun: 0 };
    this.intro = { t: 0 };
    this.maxBreath = 24 * this.perks.breath; this.breath = this.maxBreath;
    this.bag = []; this.out = null; this.gauge = null; this.blackout = 0; this.beatT = 0;
    this.joy = null; this.press = null; this.tickPtr = null; this.actionPtr = null; this.actionPress = false; this.cam = 0; this.camY = 0; this.goodReleases = 0;
    this.net = { state: 'carry', t: 0, x: 0, y: 0, cool: 0 }; this.seek = null; this.swings = 0;
    let others = (Trip.cur && Trip.cur.crew ? Trip.cur.crew : CHAR_ORDER).filter((c) => c !== this.ch).slice(0, 2);
    if (!others.length) others = CHAR_ORDER.filter((c) => c !== this.ch);
    this.others = others;
    this.quip = null; this.wasUnder = false; this.exhaleT = 2;
    this.coach = !Store.get('coach_bug2_' + this.ch, false); this.coachSaw = {};
    this.shark = null; this.sharkDone = false;
    this.sharkAt = o.shark === true ? 6 : o.shark === false ? null : chance(this.site.shark) ? rand(this.len * 0.22, this.len * 0.62) : null;
    this.gen();
  }
  enter() {
    SFX.setAmbient(1, false); Music.play('reef');
    Game.toast(SPOTS[this.spot] ? SPOTS[this.spot].name : 'Bug Hunt', { color: PAL.coral, size: 44, y: 200, sub: 'Find the antennae. Tickle them out. Swing the net.' });
    if (this.coach) Store.set('coach_bug2_' + this.ch, true);
  }
  exit() { SFX.setAmbient(0); Music.muffle(false); }
  baseFloor(x) { return this.site.floor + 10 * Math.sin(x * 0.004) + 6 * Math.sin(x * 0.013 + 1) + (this.variant === 'reef' ? 22 * Math.sin(x * 0.0017 + 2) : 0); }
  groundAt(x) { for (const L of this.ledges) if (x >= L.x0 - 4 && x <= L.x1 + 4) return L.top; return this.baseFloor(x); }
  solid(x, y) { return y > this.groundAt(x) - 12; }
  elapsed() { return this.len - this.timeLeft; }
  maxCamY() { return Math.max(0, this.site.floor + 46 - Game.H); }
  gen() {
    const S = this.site, WW = this.WW;
    this.ledges = []; let x = 620;
    while (x < WW - 240) { const w = rand(150, 270), h = rand(S.ledgeH[0], S.ledgeH[1]); this.ledges.push({ x0: x, x1: x + w, h, seed: randi(1, 99999) }); x += w + rand(S.gap[0], S.gap[1]); }
    for (const L of this.ledges) {
      L.top = this.baseFloor((L.x0 + L.x1) / 2) - L.h;
      const rng = mulberry(L.seed); L.pts = [];
      L.pts.push([L.x0 - 2, this.baseFloor(L.x0) + 4], [L.x0 - 7, L.top + L.h * 0.55], [L.x0 + 4, L.top + 6]);
      for (let px = L.x0 + 20; px < L.x1 - 14; px += 18) L.pts.push([px, L.top - rng() * 9]);
      L.pts.push([L.x1 - 4, L.top + 6], [L.x1 + 7, L.top + L.h * 0.55], [L.x1 + 2, this.baseFloor(L.x1) + 4]);
      L.deco = [];
      const kinds = this.variant === 'reef' ? ['fan', 'elk', 'elk', 'brain', 'sponge', 'rod', 'barrel'] : ['fan', 'brain', 'sponge', 'rod', 'rod', 'fan', 'urchin', 'barrel'];
      for (let px = L.x0 + 14; px < L.x1 - 10; px += rand(22, 40)) L.deco.push({ x: px, kind: pick(kinds), s: rand(0.7, 1.25), c: pick(['#8a4fb8', '#b85fa8', '#e07a3a', '#d9a441', '#7d5bd0']) });
      L.spots = []; for (let i = 0; i < 10; i++) L.spots.push([L.x0 + rng() * (L.x1 - L.x0), L.top + 10 + rng() * (L.h - 16), 2 + rng() * 6, rng()]);
    }
    // holes: at the foot of every ledge, up the walls of the tall ones. Most are empty.
    this.dens = [];
    for (const L of this.ledges) {
      for (const side of [-1, 1]) { const ex = side < 0 ? L.x0 : L.x1; if (chance(0.9)) this.dens.push(this.makeDen(ex, this.baseFloor(ex) - rand(15, 24), side)); }
      const walls = L.h > 150 ? 2 : L.h > 88 ? 1 : 0;
      for (let i = 0; i < walls; i++) if (chance(0.7)) { const right = chance(0.5); this.dens.push(this.makeDen(right ? L.x1 : L.x0, L.top + rand(26, L.h - 48), right ? 1 : -1)); }
    }
    const order = this.dens.slice().sort(() => Math.random() - 0.5);
    order.forEach((d, i) => {
      if (i < S.morays) d.kind = 'moray';
      else if (i < S.morays + S.bugs) { d.kind = 'lobster'; d.extra = chance(S.extra) ? 1 : 0; d.lob = this.makeLob(); }
      else d.kind = 'empty';
    });
    this.grass = []; for (let i = 0; i < WW / 34; i++) this.grass.push({ x: rand(0, WW), h: rand(10, 26), ph: rand(0, TAU) });
    this.jellies = []; for (let i = 0; i < Math.round(WW / 700); i++) this.jellies.push({ x: rand(700, WW - 100), y: rand(170, this.site.floor - 150), ph: rand(0, TAU), hit: 0 });
    this.schools = [];
    for (let i = 0; i < Math.round(WW / 650); i++) {
      const L = pick(this.ledges), fish = [], kind = pick(['tang', 'sgt', 'grunt', 'yt']);
      for (let k = 0; k < randi(6, 11); k++) fish.push({ ox: rand(-56, 56), oy: rand(-28, 28), ph: rand(0, TAU) });
      this.schools.push({ x: (L.x0 + L.x1) / 2, y: L.top - 40, cx: (L.x0 + L.x1) / 2, cy: L.top - (kind === 'yt' ? 110 : 40), ph: rand(0, TAU), fish, kind });
    }
    this.cuda = { x: rand(900, 2000), y: 230, dir: 1 };
    this.turtle = { x: rand(1000, 2200), y: rand(190, 280), dir: chance(0.5) ? 1 : -1, t: rand(0, 5) };
    this.ray = { x: -300, y: rand(150, 230), t: 0, wait: rand(6, 14), on: false };
    this.critters = [];
    for (let i = 0; i < Math.round(WW / 520); i++) { const L = pick(this.ledges), key = pick(['parrot', 'parrot', 'angel', 'hogfish']); this.critters.push({ key, cx: (L.x0 + L.x1) / 2, x: (L.x0 + L.x1) / 2 + rand(-60, 60), y: L.top - rand(18, 60), vx: rand(16, 30) * (chance(0.5) ? 1 : -1), range: (L.x1 - L.x0) / 2 + 40, t: rand(0, 5), nib: 0, len: key === 'parrot' ? rand(34, 46) : key === 'hogfish' ? rand(40, 52) : rand(26, 32) }); }
    this.crabs = []; for (let i = 0; i < 7; i++) { const cx = rand(200, WW - 200); this.crabs.push({ x: cx, dir: chance(0.5) ? 1 : -1, t: rand(0, 5), pause: rand(0, 2), flee: 0 }); }
    this.sandDeco = []; for (let i = 0; i < WW / 120; i++) this.sandDeco.push({ x: rand(100, WW - 100), kind: i % 3 ? 'star' : 'urchin', r: rand(5, 9), c: pick(['#e8742c', '#d9532f', '#f0a23a', '#c8467a']) });
    const gapL = this.ledges.find((L, i) => i > 0 && i < this.ledges.length - 1) || this.ledges[0];
    this.nurse = { x: gapL.x1 + 82, y: this.baseFloor(gapL.x1 + 82) - 8, dir: -1, t: 0, zT: 1, move: 0 };
    const oL = this.ledges[Math.min(this.ledges.length - 1, 3)];
    this.octo = { x: (oL.x0 + oL.x1) / 2 + rand(-30, 30), y: oL.top - 8, state: 'hide', t: 0, vx: 0, vy: 0, a: 1 };
    // a goliath grouper parked under the biggest ledge at the deep reef
    if (this.variant === 'reef') { const G = this.ledges.reduce((a, L) => (L.h > a.h ? L : a), this.ledges[0]); this.goliath = { x: G.x1 + 70, y: this.baseFloor(G.x1 + 70) - 34, t: 0 }; }
    this.snow = []; for (let i = 0; i < 80; i++) this.snow.push({ x: rand(0, 1400), y: rand(0, 640), r: rand(0.6, 1.8), vy: rand(3, 9), ph: rand(0, TAU) });
    this.fg = []; for (let x = 0; x < WW * 1.4; x += rand(240, 420)) this.fg.push({ x, kind: pick(['fan', 'rock', 'grass', 'grass']), s: rand(0.8, 1.4) });
    this.farFish = []; for (let i = 0; i < 6; i++) this.farFish.push({ x: rand(0, 1400), y: rand(170, 380), sp: rand(8, 18) * (chance(0.5) ? 1 : -1), n: randi(5, 9) });
  }
  makeDen(x, y, dir) { return { x, y, dir, kind: 'empty', coax: 0, spooks: 0, twitch: 0, nextTwitch: rand(0.9, 1.8), badHold: 0, state: 'in', peek: 0, peekT: rand(2, 5), lob: null, extra: 0, probe: 0 }; }
  makeLob() { const cl = rollCL(this.perks, this.site); return { cl, w: lobsterWeight(cl), eggs: cl > 3.0 && chance(0.14), gold: cl > 3.0 && chance(0.04 * this.perks.trophy * this.site.gold) }; }
  say(kind, p = 1) {
    if (!chance(p) || !QUIPS[kind]) return;
    this.quip = { who: pick(this.others), msg: pick(QUIPS[kind]), t: 2.8 };
  }

  /* ---------- input ---------- */
  actionZone() { return { x: Game.W - 96, y: Game.H - 96, r: 66 }; }
  inAction(x, y) { const a = this.actionZone(); return dist(x, y, a.x, a.y) < a.r + 8; }
  toWorld(p) { return [p.x + this.cam, p.y + this.camY]; }
  denAt(wx, wy) { let best = null, bd = 44; for (const den of this.dens) { if (den.state === 'gone') continue; const dd = dist(wx, wy, den.x + den.dir * 6, den.y); if (dd < bd) { bd = dd; best = den; } } return best; }
  pointerDown(p) {
    if (this.basePointerDown(p) || this.gauge || this.blackout > 0 || this.intro) return;
    if (this.inAction(p.x, p.y)) { this.actionPtr = p.id; this.actionPress = true; return; }
    const [wx, wy] = this.toWorld(p);
    if (!this.out) { const den = this.denAt(wx, wy); if (den) { this.tickPtr = { id: p.id, den }; return; } }
    this.press = { id: p.id, sx: p.x, sy: p.y, t0: this.t };
  }
  pointerMove(p) {
    if (this.press && this.press.id === p.id && dist(p.x, p.y, this.press.sx, this.press.sy) > 14) { this.joy = { id: p.id, sx: this.press.sx, sy: this.press.sy, x: p.x, y: p.y }; this.press = null; }
    if (this.joy && this.joy.id === p.id) { this.joy.x = p.x; this.joy.y = p.y; }
  }
  pointerUp(p) {
    if (this.press && this.press.id === p.id) { const [wx, wy] = this.toWorld(p); this.press = null; this.swingAt(wx, wy); }
    if (this.joy && this.joy.id === p.id) this.joy = null;
    if (this.actionPtr === p.id) this.actionPtr = null;
    if (this.tickPtr && this.tickPtr.id === p.id) { this.tickPtr = null; this.seek = null; }
  }
  keyDown(c) {
    if (this.baseKeyDown(c) || this.gauge || this.intro) return;
    if (c === 'Space' || c === 'KeyE' || c === 'KeyF') this.actionPress = true;
  }
  actionHeld() { return this.actionPtr != null || Input.held('Space', 'KeyE'); }

  /* ---------- the net ---------- */
  shoulder() { const d = this.diver; return { x: d.x + d.facing * 10, y: d.y + 2 }; }
  carryPos() { const d = this.diver; return { x: d.x + d.facing * 36, y: d.y + 22 }; }
  bugBody(o) { return { x: o.x, y: o.y - 3 }; }
  swingAt(wx, wy) {
    const n = this.net, d = this.diver;
    if (n.state === 'swing' || n.cool > 0 || this.gauge || this.intro || this.blackout > 0 || d.y < BH.SURF + 10) return;
    const sh = this.shoulder(); let dx = wx - sh.x, dy = wy - sh.y; const L = Math.hypot(dx, dy) || 1;
    if (L > NET.REACH) {
      if (this.out && dist(wx, wy, this.out.x, this.out.y) < 100) { this.seek = { kind: 'net', t: 1.6 }; return; }   // too far: swim at it, swing when in reach
      dx *= NET.REACH / L; dy *= NET.REACH / L;
    }
    const tx = sh.x + dx, ty = Math.min(sh.y + dy, this.groundAt(sh.x + dx) - 6);
    if (Math.abs(dx) > 8) d.facing = dx > 0 ? 1 : -1;
    const from = n.state === 'carry' ? this.carryPos() : { x: n.x, y: n.y };
    this.net = { state: 'swing', t: 0, fx: from.x, fy: from.y, tx, ty, x: from.x, y: from.y, cool: NET.COOL };
    this.swings++; this.seek = null;
    SFX.play('swish');
    for (let i = 0; i < 4; i++) this.parts.add({ kind: 'bubble', x: from.x + rand(-6, 6), y: from.y, vy: -rand(30, 60), vx: rand(-10, 10), life: 1.2, size: rand(1.5, 3) });
  }
  autoSwing() {
    const o = this.out; if (!o) return;
    const b = this.bugBody(o), lead = o.state === 'walk' ? Math.sign(o.tx - o.x) * 16 : 0;
    this.swingAt(b.x + lead, b.y);
  }
  inHoop(o, tight) { const b = this.bugBody(o); return dist(this.net.x, this.net.y, b.x, b.y) < (tight ? NET.HOOP * 0.85 : NET.HOOP + 12); }
  updateNet(dt) {
    const n = this.net; n.cool = Math.max(0, n.cool - dt);
    if (n.state === 'carry') { const p = this.carryPos(); n.x = p.x; n.y = p.y; return; }
    n.t += dt;
    if (n.state === 'swing') {
      const k = easeOut(n.t / NET.SWING); n.x = lerp(n.fx, n.tx, k); n.y = lerp(n.fy, n.ty, k) - Math.sin(k * Math.PI) * 16;
      if (n.t >= NET.SWING) { n.state = 'set'; n.t = 0; n.x = n.tx; n.y = n.ty; this.netImpact(); }
    } else if (n.state === 'set') {
      const o = this.out;
      if (o && o.state === 'flip' && this.inHoop(o)) { this.catchIt(true); return; }
      if (n.t > NET.SET || dist(n.x, n.y, this.diver.x, this.diver.y) > NET.REACH + 60) n.state = 'carry';
    }
  }
  netImpact() {
    const n = this.net, o = this.out;
    if (n.y > this.groundAt(n.x) - 30) this.parts.burst(n.x, n.y + 8, 10, { color: 'rgba(225,205,150,0.7)', min: 20, max: 70, life: 0.9, angle: -Math.PI / 2, spread: 1.2 });
    SFX.play('net');
    if (!o) return;
    if (this.inHoop(o, o.state === 'flip')) { this.catchIt(o.state === 'flip'); return; }
    if (dist(n.x, n.y, o.x, o.y) < 140) this.missed(o);
  }
  missed(o) {
    o.misses++;
    if (o.misses >= 3) { this.sendHome(o, 'It’s running for the rocks!'); return; }
    const behind = (this.net.x - o.x) * o.dir < 0;
    if (behind && o.state !== 'flip') { o.state = 'walk'; o.tx = this.clampWalk(o, o.x + o.dir * rand(60, 90)); o.speed = 2.2; }
    else if (o.state !== 'flip') { o.state = 'crouch'; o.ct = 0.12; }
    Game.toast(behind ? 'Missed! It scooted away' : 'Missed! It tail-flipped', { color: PAL.warn, size: 28, y: 190, sub: o.misses === 1 ? 'Lobsters flip backward. Set the net BEHIND the tail.' : 'One more miss and it’s gone' });
    this.say('miss', 0.5); this.coachSaw.behind = true;
  }
  catchIt(pro) {
    const o = this.out; if (!o) return;
    SFX.play('net'); SFX.play('coin'); Game.vibrate(40);
    this.parts.burst(o.x, o.y, 18, { kind: 'bubble', min: 30, max: 120, life: 1.1 });
    if (pro) { this.addLine('Backed it into the net', 50); this.fl.add(o.x - this.cam, o.y - this.camY - 40, 'PRO MOVE +50', PAL.sun, 24); this.say('pro'); }
    else if (!o.misses) { this.addLine('One swing, one bug', 25); this.fl.add(o.x - this.cam, o.y - this.camY - 40, 'CLEAN SWING +25', PAL.sun, 22); }
    this.gauge = { lob: o.lob, t: 0 }; Game.toasts = [];
    this.out = null; this.net.state = 'carry'; this.coach = false;
  }

  /* ---------- update ---------- */
  update(dt) {
    if (this.gauge) { if (!this.paused && !this.child) { this.gauge.t += dt; this.t += dt; } Game.toasts = []; return; }
    if (this.baseUpdate(dt)) return;
    const d = this.diver, t = this.t;
    if (this.quip) { this.quip.t -= dt; if (this.quip.t <= 0) this.quip = null; }
    this.updateScenery(dt, d, t);
    if (this.intro) { this.updateIntro(dt); this.updateCam(dt); return; }
    if (this.blackout > 0) {
      this.blackout -= dt; d.y = approach(d.y, BH.SURF + 4, 1.5, dt);
      if (this.blackout <= 0) { d.y = BH.SURF + 4; this.breath = this.maxBreath * 0.5; this.timeLeft = Math.max(0, this.timeLeft - 6); Game.toast('Your buddy pulled you up', { color: '#fff', size: 30, y: 160, sub: 'Never push a breath-hold. Always dive with a buddy. (−6 sec)' }); this.say('blackout'); }
      this.updateCam(dt); return;
    }
    if (this.press && this.t - this.press.t0 > 0.24) { this.joy = { id: this.press.id, sx: this.press.sx, sy: this.press.sy, x: this.press.sx, y: this.press.sy }; this.press = null; }
    // movement input
    let ix = 0, iy = 0;
    if (Input.held('ArrowLeft', 'KeyA')) ix -= 1; if (Input.held('ArrowRight', 'KeyD')) ix += 1;
    if (Input.held('ArrowUp', 'KeyW')) iy -= 1; if (Input.held('ArrowDown', 'KeyS')) iy += 1;
    if (this.joy) { const jx = (this.joy.x - this.joy.sx) / 55, jy = (this.joy.y - this.joy.sy) / 55; const m = Math.hypot(jx, jy); if (m > 0.12) { ix = jx / Math.max(1, m); iy = jy / Math.max(1, m); } }
    const manual = Math.hypot(ix, iy) > 0.1;
    if (manual && this.seek && this.seek.kind === 'net') this.seek = null;
    // auto-swim: toward a hole you're holding, or toward the bug you clicked
    let seekTo = null;
    if (!manual && this.tickPtr && this.tickPtr.den.state !== 'gone') { const den = this.tickPtr.den; seekTo = [den.x + den.dir * 58, den.y - 2]; }
    if (!manual && this.seek && this.seek.kind === 'net' && this.out) {
      this.seek.t -= dt; const b = this.bugBody(this.out), sh = this.shoulder();
      if (dist(sh.x, sh.y, b.x, b.y) < NET.REACH * 0.9) this.autoSwing(); else if (this.seek.t > 0) seekTo = [b.x - Math.sign(b.x - d.x) * 90, b.y - 10]; else this.seek = null;
    } else if (this.seek && !this.out) this.seek = null;
    if (seekTo) { const dx = seekTo[0] - d.x, dy = seekTo[1] - d.y, m = Math.hypot(dx, dy); if (m > 8) { ix = dx / m * Math.min(1, m / 60); iy = dy / m * Math.min(1, m / 60); } }
    const im = Math.hypot(ix, iy); if (im > 1) { ix /= im; iy /= im; }
    const stunned = d.stun > 0; if (stunned) { d.stun -= dt; ix = 0; iy = 0; }
    const under = d.y > BH.SURF + 14;
    const sp = this.shark && this.shark.state === 'hunt' ? 176 : 168;
    d.vx = approach(d.vx, ix * sp, 4, dt);
    d.vy = approach(d.vy, iy * sp + (iy === 0 ? -16 : 0), 4, dt);
    if (Math.abs(ix) > 0.1 && !(this.net.state === 'swing')) d.facing = ix > 0 ? 1 : -1;
    const drift = under ? -this.weather.drift * 16 : 0;
    let nx = d.x + (d.vx + drift) * dt, ny = d.y + d.vy * dt;
    nx = clamp(nx, 30, this.WW - 30);
    if (this.solid(nx + d.facing * 28, d.y) || this.solid(nx, d.y)) { nx = d.x; d.vx = 0; }
    ny = clamp(ny, BH.SURF + 2, this.site.floor + 80);
    if (this.solid(nx, ny)) { ny = this.groundAt(nx) - 12; d.vy = Math.min(0, d.vy); }
    d.x = nx; d.y = ny;
    this.updateCam(dt);
    // breathing, bubbles and splashes
    if (under && !this.wasUnder) { this.parts.burst(d.x, BH.SURF + 4, 14, { color: ['#ffffff', '#cfefff'], angle: -Math.PI / 2, spread: 0.9, min: 60, max: 160, g: 400, life: 0.7 }); SFX.play('plop'); Music.muffle(true); SFX.setAmbient(1, true); }
    if (!under && this.wasUnder) { this.parts.burst(d.x + d.facing * 16, BH.SURF - 18, 10, { color: ['#ffffff', '#dff6ff'], angle: -Math.PI / 2, spread: 0.4, min: 80, max: 190, g: 500, life: 0.6 }); SFX.noise(0.25, { filter: 'bandpass', f: 1800, vol: 0.12 }); Music.muffle(false); SFX.setAmbient(1, false); }
    this.wasUnder = under;
    if (under) {
      this.breath -= dt * (d.y > 560 ? 1.15 : 1); this.exhaleT -= dt;
      if (this.exhaleT <= 0) { this.exhaleT = rand(2, 2.8); for (let i = 0; i < 5; i++) this.parts.add({ kind: 'bubble', x: d.x + d.facing * 30 + rand(-3, 3), y: d.y - 10, vy: -rand(40, 80), vx: rand(-10, 10), life: 2, size: rand(1.8, 4) }); if (chance(0.5)) SFX.play('bubble'); }
      if (Math.hypot(d.vx, d.vy) > 120 && chance(dt * 8)) this.parts.add({ kind: 'bubble', x: d.x - d.facing * 70, y: d.y + rand(-4, 4), vy: -30, vx: -d.facing * 20, life: 1, size: rand(1, 2.2) });
    } else this.breath = Math.min(this.maxBreath, this.breath + dt * 9);
    if (this.breath < this.maxBreath * 0.28 && under) { this.beatT -= dt; if (this.beatT <= 0) { this.beatT = 0.75; SFX.tone(60, 0.12, { vol: 0.25 }); } }
    if (this.breath <= 0) { this.blackout = 2.2; this.breath = 0; if (this.out) this.sendHome(this.out, null, true); SFX.play('fail'); return; }
    for (const j of this.jellies) if (!j.hit && dist(j.x, j.y, d.x + d.facing * 10, d.y) < 26) { j.hit = 2; d.stun = 0.7; this.breath -= 3; Game.toast('Jellyfish sting!', { color: '#ff9fd6', size: 30, y: 130 }); SFX.play('sting'); Game.shake(4); this.say('jelly', 0.6); }
    // the shark
    if (!this.shark && !this.sharkDone && this.sharkAt != null && this.elapsed() >= this.sharkAt && d.y > BH.SURF + 80 && Math.abs(d.x - BH.BOATX) > 420 && !this.out) this.startShark();
    if (this.shark) this.updateShark(dt);
    const chased = this.shark && this.shark.state === 'hunt';
    // which hole are we working?
    for (const den of this.dens) if (den.kind === 'moray') { den.peekT -= dt; if (den.peekT <= 0) { den.peek = 1.4; den.peekT = rand(3, 6); } den.peek = Math.max(0, den.peek - dt); }
    let target = null;
    if (!chased && !this.out) {
      if (this.tickPtr && this.tickPtr.den.state !== 'gone') target = this.tickPtr.den;
      else { let best = 100; for (const den of this.dens) { if (den.state === 'gone') continue; if ((d.x - den.x) * den.dir < 4) continue; const dd = dist(d.x, d.y, den.x + den.dir * 52, den.y); if (dd < best) { best = dd; target = den; } } }
    }
    this.target = target;
    const reach = target && (d.x - target.x) * target.dir > 4 && dist(d.x, d.y, target.x + target.dir * 52, target.y) < 46;
    this.inReach = !!reach;
    const held = (this.actionHeld() || !!this.tickPtr) && !stunned && !!reach;
    if (held) d.facing = -target.dir;
    this.tickling = false;
    if (held && target.kind === 'moray') {
      target.peek = 1.5; d.stun = 0.9; this.breath -= 4; Game.toast('MORAY! Wrong hole.', { color: PAL.bad, size: 34, y: 130 }); SFX.play('chomp'); Game.shake(7); Game.vibrate(120); this.say('moray');
      this.parts.burst(target.x, target.y, 10, { color: 'rgba(255,255,255,0.7)', kind: 'bubble', min: 20, max: 60, life: 1 });
      this.tickPtr = null; this.seek = null;
    } else if (held && target.kind === 'empty') {
      this.tickling = true; if (chance(dt * 18)) SFX.play('tickle');
      target.probe += dt;
      if (target.probe > 0.8 && !target.probed) { target.probed = true; this.fl.add(target.x - this.cam, target.y - this.camY - 30, 'Nobody home', '#cfe3ea', 18); this.say('empty', 0.3); }
    } else if (held && target.kind === 'lobster') {
      this.tickling = true;
      if (chance(dt * 18)) SFX.play('tickle');
      if (target.twitch > 0) { target.badHold += dt; if (target.badHold > 0.22) this.spook(target); }
      else target.coax += dt * 0.5 * this.perks.coax;
      target.nextTwitch -= dt;
      if (target.nextTwitch <= 0 && target.twitch <= 0) { target.twitch = 0.6; target.badHold = 0; target.nextTwitch = rand(0.8, 1.9); SFX.tone(300, 0.06, { type: 'square', vol: 0.05 }); }
      if (target.coax >= 1) this.emerge(target);
    }
    for (const den of this.dens) if (den.twitch > 0) den.twitch -= dt;
    if (this.out) this.updateOut(dt, d);
    this.updateNet(dt);
    if (this.actionPress) {
      this.actionPress = false;
      if (this.out) this.autoSwing();
      else if (!target) this.parts.burst(d.x + d.facing * 46, d.y + 2, 4, { kind: 'bubble', min: 10, max: 40, life: 0.8 });
    }
  }
  updateIntro(dt) {
    const I = this.intro, d = this.diver; I.t += dt;
    // a back-roll off the gunwale
    if (I.t < 0.5) { d.x = BH.BOATX + 70; d.y = BH.SURF - 26; }
    else if (I.t < 1.15) { const k = (I.t - 0.5) / 0.65; d.x = BH.BOATX + 70 + k * 30; d.y = BH.SURF - 26 + k * k * 96; }
    else { d.vx = 40; d.vy = 30; this.intro = null; this.wasUnder = false; return; }
    if (I.t >= 0.86 && !I.splash) { I.splash = true; this.parts.burst(d.x, BH.SURF, 22, { color: ['#ffffff', '#cfefff'], angle: -Math.PI / 2, spread: 1.1, min: 80, max: 220, g: 500, life: 0.8 }); SFX.play('splash'); }
  }
  updateCam(dt) {
    const d = this.diver;
    this.cam = approach(this.cam, clamp(d.x - Game.W * 0.45, 0, this.WW - Game.W), 6, dt);
    this.camY = approach(this.camY, clamp(d.y - Game.H * 0.5, 0, this.maxCamY()), 5, dt);
  }
  updateScenery(dt, d, t) {
    for (const j of this.jellies) { j.ph += dt; j.x += Math.sin(j.ph * 0.3) * 10 * dt - this.weather.drift * 6 * dt; j.y += Math.sin(j.ph * 0.9) * 8 * dt; j.hit = Math.max(0, j.hit - dt); }
    this.cuda.x += this.cuda.dir * 26 * dt; if (this.cuda.x > this.WW - 200 || this.cuda.x < 300) this.cuda.dir *= -1;
    for (const s of this.schools) { s.ph += dt * 0.5; s.x = s.cx + Math.cos(s.ph) * 70; s.y = s.cy + Math.sin(s.ph * 1.3) * 18; if (dist(s.x, s.y, d.x, d.y) < 70) s.x += (s.x - d.x) * 0.6; }
    const tu = this.turtle; tu.t += dt; tu.x += tu.dir * 26 * dt; tu.y += Math.sin(tu.t * 0.5) * 6 * dt; if (tu.x < 200 || tu.x > this.WW - 200) tu.dir *= -1;
    const ry = this.ray; if (!ry.on) { ry.wait -= dt; if (ry.wait <= 0) { ry.on = true; ry.x = -200; ry.y = rand(150, 240); } } else { ry.t += dt; ry.x += 55 * dt; if (ry.x > Game.W + 260) { ry.on = false; ry.wait = rand(12, 22); } }
    for (const f of this.farFish) { f.x += f.sp * dt; if (f.x > 1500) f.x = -100; if (f.x < -100) f.x = 1500; }
    for (const c of this.critters) {
      c.t += dt;
      const near = dist(c.x, c.y, d.x, d.y) < 90;
      if (c.nib > 0) { c.nib -= dt; if (chance(dt * 6)) this.parts.add({ x: c.x + Math.sign(c.vx) * c.len * 0.5, y: c.y + 4, vx: rand(-10, 10), vy: rand(10, 30), life: 0.7, size: 1.5, color: 'rgba(255,255,240,0.8)' }); }
      else { c.x += c.vx * (near ? 3 : 1) * dt; if (Math.abs(c.x - c.cx) > c.range) { c.vx = -Math.sign(c.x - c.cx) * Math.abs(c.vx); } if (c.key === 'parrot' && chance(dt * 0.15)) c.nib = 1.4; }
      c.y += Math.sin(c.t * 1.3) * 4 * dt;
    }
    for (const c of this.crabs) {
      c.t += dt; const near = Math.abs(c.x - d.x) < 90 && d.y > this.baseFloor(c.x) - 120;
      if (near) { c.flee = 0.8; c.dir = c.x > d.x ? 1 : -1; }
      if (c.flee > 0) { c.flee -= dt; c.x += c.dir * 120 * dt; }
      else if (c.pause > 0) c.pause -= dt;
      else { c.x += c.dir * 24 * dt; if (chance(dt * 0.4)) { c.pause = rand(0.5, 2); if (chance(0.4)) c.dir *= -1; } }
      c.x = clamp(c.x, 40, this.WW - 40); if (this.groundAt(c.x) < this.baseFloor(c.x) - 2) { c.dir *= -1; c.x += c.dir * 6; }
    }
    const n = this.nurse; n.t += dt; n.zT -= dt;
    if (n.zT <= 0) { n.zT = 1.6; this.parts.add({ kind: 'bubble', x: n.x + n.dir * 50, y: n.y - 10, vy: -26, vx: rand(-4, 4), life: 2.2, size: 2.5 }); }
    if (n.move <= 0 && dist(n.x, n.y, d.x, d.y) < 70) { n.move = 2.2; n.dir *= -1; this.fl.add(n.x - this.cam, n.y - this.camY - 40, 'zzz… huh?', '#ffffff', 16); }
    if (n.move > 0) { n.move -= dt; n.x += n.dir * 60 * dt; }
    if (this.goliath) this.goliath.t += dt;
    const o = this.octo; o.t += dt;
    if (o.state === 'hide' && dist(o.x, o.y, d.x, d.y) < 95) {
      o.state = 'flee'; o.vx = (o.x > d.x ? 1 : -1) * 230; o.vy = -150; SFX.noise(0.4, { filter: 'lowpass', f: 600, vol: 0.2 });
      for (let i = 0; i < 26; i++) this.parts.add({ x: o.x + rand(-10, 10), y: o.y + rand(-10, 10), vx: rand(-40, 40), vy: rand(-30, 30), drag: 1.5, life: rand(1.6, 2.6), size: rand(8, 16), color: 'rgba(18,14,30,0.55)' });
      this.fl.add(o.x - this.cam, o.y - this.camY - 40, 'INKED!', '#c9b8ff', 22); this.say('octo', 0.6);
    }
    if (o.state === 'flee') { o.x += o.vx * dt; o.y += o.vy * dt; o.vx *= 1 - dt * 0.8; o.vy *= 1 - dt * 0.8; o.a -= dt * 0.5; if (o.a <= 0) o.state = 'gone'; }
    for (const p of this.snow) { p.y += p.vy * dt; p.ph += dt; if (p.y > 640) { p.y = -10; p.x = rand(0, 1400); } }
  }

  /* ---------- the shark ---------- */
  startShark() {
    const d = this.diver, boatDir = Math.sign(BH.BOATX - d.x) || 1;
    this.shark = { x: clamp(d.x - boatDir * (Game.W * 0.62 + 60), -260, this.WW + 260), y: clamp(d.y + rand(-50, 30), BH.SURF + 60, this.site.floor - 70), ang: boatDir > 0 ? 0 : Math.PI, t: 0, lunge: 0, nextLunge: 3, mouth: 0, state: 'hunt', leaveT: 0 };
    this.target = null; this.tickPtr = null; this.seek = null;
    Music.play('shark'); Music.muffle(false); SFX.play('warn'); Game.shake(6, 0.5); Game.vibrate([60, 60, 60]);
    Game.toast('SHARK!', { color: '#ff5a5a', size: 60, y: 150, dur: 2.2, sub: 'Swim back to the boat!' });
    this.say('shark');
  }
  updateShark(dt) {
    const s = this.shark, d = this.diver; s.t += dt;
    const len = 190;
    if (s.state === 'hunt') {
      const want = Math.atan2(d.y - s.y, d.x - s.x);
      s.ang += clamp(angleDiff(s.ang, want), -1.8 * dt, 1.8 * dt);
      const dd = dist(s.x, s.y, d.x, d.y);
      s.nextLunge -= dt;
      if (s.lunge > 0) s.lunge -= dt; else if (s.nextLunge <= 0 && dd < 300) { s.lunge = 0.6; s.nextLunge = rand(2.4, 3.4); SFX.play('warn'); }
      const speed = s.lunge > 0 ? 268 : 150 + (dd > 480 ? 70 : 0);
      s.x += Math.cos(s.ang) * speed * dt; s.y += Math.sin(s.ang) * speed * dt;
      s.y = clamp(s.y, BH.SURF + 28, this.groundAt(s.x) - 28);
      s.mouth = approach(s.mouth, dd < 180 || s.lunge > 0 ? 1 : 0, 6, dt);
      Music.intensity = clamp(1 - (dd - 80) / 480, 0, 1);
      const mx = s.x + Math.cos(s.ang) * len * 0.42, my = s.y + Math.sin(s.ang) * len * 0.42;
      if (dist(mx, my, d.x, d.y) < 34) this.sharkBite();
      else if (Math.abs(d.x - BH.BOATX) < 90 && d.y < BH.SURF + 34) this.sharkEscape();
    } else {
      s.x += Math.cos(s.ang) * 240 * dt; s.y = approach(s.y, this.site.floor - 170, 1, dt); s.leaveT += dt; s.mouth = approach(s.mouth, 0, 4, dt);
      if (s.leaveT > 4.5) { this.shark = null; Music.play('reef'); Music.muffle(this.diver.y > BH.SURF + 14); }
    }
  }
  sharkBite() {
    const s = this.shark, d = this.diver;
    s.state = 'leave'; s.ang = s.x < d.x ? Math.PI : 0; this.sharkDone = true; Music.intensity = 0;
    SFX.play('chomp'); SFX.play('bigsplash'); Game.shake(11, 0.6); Game.vibrate(220);
    d.stun = 1.1; d.vx = -Math.cos(s.ang) * 60;
    this.parts.burst(d.x, d.y, 24, { kind: 'bubble', min: 40, max: 160, life: 1.2 });
    if (this.bag.length) {
      const lost = this.bag.pop();
      if (lost.cl > GAUGE_IN && !lost.eggs) this.score -= Math.round(lost.w * 100) * (lost.gold ? 3 : 1);
      this.addLine('The shark swiped a bug from your bag', 0);
      Game.toast('CHOMP!', { color: PAL.bad, size: 58, y: 150, dur: 2.2, sub: 'The shark swiped a bug from your bag!' });
    } else {
      this.timeLeft = Math.max(0, this.timeLeft - 6);
      Game.toast('CHOMP!', { color: PAL.bad, size: 58, y: 150, dur: 2.2, sub: 'It got a piece of your fin. (−6 sec)' });
    }
    this.say('caught');
  }
  sharkEscape() {
    const s = this.shark; s.state = 'leave'; s.ang = s.x < BH.BOATX ? Math.PI : 0; this.sharkDone = true; Music.intensity = 0;
    this.addLine('Outswam a shark back to the boat', 100);
    Game.toast('MADE IT!', { color: PAL.good, size: 56, y: 150, dur: 2.2, sub: 'Outswam the shark +100' });
    SFX.play('trophy'); this.say('escape');
  }

  /* ---------- lobsters ---------- */
  spook(den) {
    den.coax = Math.max(0, den.coax - 0.4); den.spooks++; den.twitch = 0; den.badHold = 0;
    SFX.play('fail');
    if (den.spooks >= 3) { den.state = 'gone'; Game.toast('It backed in deep', { color: PAL.warn, size: 30, y: 130, sub: 'That bug is gone. Try another hole.' }); this.tickPtr = null; }
    else Game.toast('Easy! It backed in.', { color: PAL.warn, size: 30, y: 130, sub: 'Let go when the antennae twitch' });
  }
  emerge(den) {
    const lob = den.lob, gx = this.clampWalk({ x: den.x, dir: den.dir }, den.x + den.dir * rand(115, 150));
    this.out = { x: den.x + den.dir * 8, y: den.y, tx: gx, dir: den.dir, lob, state: 'walk', speed: 1.4, t: 0, life: 0, idleT: 0, ct: 0, vx: 0, misses: 0, home: den };
    if (den.extra > 0) { den.extra--; den.coax = 0; den.spooks = 0; den.lob = this.makeLob(); }
    else { den.state = 'empty'; den.kind = 'empty'; }
    this.tickPtr = null; this.seek = null;
    Game.toast(lob.gold ? 'A GOLDEN BUG!' : 'It’s out!', { color: lob.gold ? PAL.sun : PAL.good, size: 34, y: 190, sub: Game.touch ? 'Tap the bug to swing your net' : 'Click the bug to swing your net (or Space)' });
    if (lob.gold) this.say('gold');
    SFX.play('coin');
  }
  clampWalk(o, tx) {
    // stay on open sand: stop short of the next ledge
    const step = Math.sign(tx - o.x) || 1;
    for (let x = o.x + step * 20; step > 0 ? x <= tx : x >= tx; x += step * 10) if (this.groundAt(x) < this.baseFloor(x) - 2) return x - step * 34;
    return clamp(tx, 40, this.WW - 40);
  }
  sendHome(o, msg, quiet) {
    let best = o.home && o.home.state !== 'gone' && o.home.kind === 'empty' ? o.home : null, bd = best ? Math.abs(best.x - o.x) : 1e9;
    for (const den of this.dens) { if (den.kind !== 'empty' || den.state === 'gone') continue; const dd = Math.abs(den.x - o.x); if (dd < bd) { bd = dd; best = den; } }
    if (!best || quiet) { if (best) this.backIn(best, o, true); else this.out = null; return; }
    o.state = 'home'; o.home = best; o.dir = Math.sign(best.x + best.dir * 8 - o.x) || 1;
    if (msg) Game.toast(msg, { color: PAL.warn, size: 28, y: 150 });
  }
  backIn(den, o, quiet) {
    den.kind = 'lobster'; den.lob = o.lob; den.coax = 0.15; den.spooks = 1; den.state = 'in'; den.extra = 0; den.probe = 0; den.probed = false;
    this.out = null; if (this.net.state === 'set') this.net.state = 'carry';
    if (!quiet) Game.toast('It got back in the rocks', { color: PAL.warn, size: 28, y: 130, sub: 'Tickle it out again' });
  }
  updateOut(dt, d) {
    const o = this.out; o.t += dt; o.life += dt;
    const head = o.x + o.dir * bugLen(o.lob) * 0.45, close = Math.abs(d.x - head) < 110 && Math.abs(d.y - o.y) < 90;
    if (o.state === 'walk') {
      o.x = approach(o.x, o.tx, o.speed, dt);
      if (Math.abs(o.x - o.tx) < 3) { o.state = 'idle'; o.idleT = rand(1.1, 2.2) * Math.pow(0.8, o.misses); o.speed = 1.4; }
    } else if (o.state === 'idle') {
      o.idleT -= dt * (close ? 1.8 : 1);
      if (o.idleT <= 0) {
        if (o.life > 12 + o.lob.cl) this.sendHome(o, 'It’s heading back to its hole!');
        else if (chance(close ? 0.3 : 0.5)) { if (chance(0.35)) o.dir *= -1; o.tx = this.clampWalk(o, o.x + o.dir * rand(30, 70)); o.state = 'walk'; }
        else { o.state = 'crouch'; o.ct = 0.5; }
      }
    } else if (o.state === 'crouch') {
      o.ct -= dt;
      if (o.ct <= 0) { o.state = 'flip'; o.vx = -o.dir * rand(470, 580); SFX.play('splash'); this.parts.burst(o.x, o.y + 6, 12, { color: 'rgba(225,205,150,0.8)', min: 20, max: 90, life: 0.9, angle: -Math.PI / 2, spread: 1.4 }); }
    } else if (o.state === 'flip') {
      const nx = o.x + o.vx * dt;
      if (this.groundAt(nx) < this.baseFloor(nx) - 2) o.vx = 0; else o.x = nx;
      o.vx *= 1 - Math.min(1, dt * 6);
      if (chance(0.5)) this.parts.add({ x: o.x, y: o.y + 6, vx: rand(-20, 20), vy: -rand(5, 25), life: 0.8, size: rand(2, 4), color: 'rgba(225,205,150,0.7)' });
      for (const den of this.dens) if ((den.kind === 'empty') && den.state !== 'gone' && Math.abs(den.x + den.dir * 10 - o.x) < 22 && Math.abs(den.y - o.y) < 30) { this.backIn(den, o); return; }
      if (Math.abs(o.vx) < 40) { o.state = 'idle'; o.idleT = rand(0.7, 1.5) * Math.pow(0.8, o.misses); if (chance(0.4)) o.dir *= -1; }
    } else if (o.state === 'home') {
      const den = o.home, mx = den.x + den.dir * 8;
      o.dir = Math.sign(mx - o.x) || o.dir; o.x = approach(o.x, mx, 2.2, dt);
      if (Math.abs(o.x - mx) < 8) { this.backIn(den, o); return; }
    }
    o.y = approach(o.y, (o.state === 'home' && Math.abs(o.x - o.home.x) < 30 ? o.home.y : this.baseFloor(o.x) - 9), 6, dt);
  }
  decide(keep) {
    const lob = this.gauge.lob; this.gauge = null;
    const legal = lob.cl > GAUGE_IN && !lob.eggs;
    if (keep) {
      this.bag.push(lob); SFX.play('coin');
      this.fl.add(this.diver.x - this.cam, this.diver.y - this.camY - 50, 'In the bag ' + this.bag.length + '/' + BH.BAG, '#fff', 22);
      if (legal) { this.score += Math.round(lob.w * 100) * (lob.gold ? 3 : 1); this.say(lob.cl >= 4.4 ? 'big' : 'nice', lob.cl >= 4.4 ? 1 : 0.6); }
      else this.say('short', 0.75);
      if (this.bag.length >= BH.BAG) this.end('limit');
    } else {
      this.parts.burst(this.diver.x + this.diver.facing * 40, this.diver.y, 10, { kind: 'bubble', min: 20, max: 80, life: 1 });
      if (!legal) { this.goodReleases++; this.addLine(lob.eggs ? 'Released an egg-bearing female' : 'Released a short (' + lob.cl.toFixed(2) + '")', 25); this.fl.add(this.diver.x - this.cam, this.diver.y - this.camY - 50, 'Good call +25', PAL.good, 22); SFX.play('coin'); }
      else this.fl.add(this.diver.x - this.cam, this.diver.y - this.camY - 50, 'Let a keeper go', '#cfe3ea', 20);
    }
  }
  buildResult() {
    const lines = [], catches = []; let fines = 0;
    this.bag.forEach((lob, i) => {
      const tag = 'Lobster ' + (i + 1) + ' · ' + lob.cl.toFixed(2) + '"';
      if (lob.eggs) { lines.push({ label: tag + ' · eggs! FWC fine', pts: -300, bad: true }); fines++; }
      else if (lob.cl <= GAUGE_IN) { lines.push({ label: tag + ' · short! FWC fine', pts: -250, bad: true }); fines++; }
      else {
        const extras = lob.cl >= 4.4 ? [{ label: 'Big boy bonus', pts: 100 }] : [];
        if (lob.gold) extras.push({ label: 'Golden bug ×3', pts: Math.round(lob.w * 100) * 2 });
        const c = makeCatch('lobster', lob.w, this.ch, this.spot, extras); c.cl = lob.cl; c.gold = !!lob.gold; catches.push(c);
        lines.push({ label: tag + ' · ' + fmtLb(lob.w) + (lob.gold ? ' · GOLDEN' : ''), pts: c.pts, key: 'lobster', trophy: c.trophy });
      }
    });
    for (const l of this.extraLines) lines.push(l);
    if (this.bag.length >= BH.BAG) lines.push({ label: 'Limited out (6 bugs)', pts: 150 });
    if (catches.length && !fines) lines.push({ label: 'Clean bag · the officer nods', pts: 100 });
    if (!this.bag.length) lines.push({ label: 'Empty bag. The officer waves you through.', pts: 0 });
    const total = Math.max(0, lines.reduce((a, l) => a + l.pts, 0));
    let best = null; for (const c of catches) if (!best || c.pts > best.pts) best = c;
    return { catches, lines, total, best, header: this.resultHeader, under: true };
  }

  /* ---------- drawing ---------- */
  waterColor(wy) {
    const stops = [[BH.SURF, this.weather.vis > 1.1 ? [76, 205, 224] : [58, 184, 208]], [300, [34, 150, 192]], [480, [20, 118, 164]], [640, [12, 84, 126]], [820, [7, 56, 90]]];
    for (let i = 1; i < stops.length; i++) if (wy < stops[i][0]) { const [a, c0] = stops[i - 1], [b, c1] = stops[i], k = clamp((wy - a) / (b - a), 0, 1); return `rgb(${Math.round(lerp(c0[0], c1[0], k))},${Math.round(lerp(c0[1], c1[1], k))},${Math.round(lerp(c0[2], c1[2], k))})`; }
    const c = stops[stops.length - 1][1]; return `rgb(${c[0]},${c[1]},${c[2]})`;
  }
  draw(ctx) {
    if (this.drawChildOrNull(ctx)) return;
    const W = Game.W, H = Game.H, t = this.t, cam = this.cam, cy = this.camY, d = this.diver, sy = BH.SURF - cy;
    // sky, then the water column shaded by real depth
    if (sy > 0) {
      drawSky(ctx, W, sy, 'day'); drawSun(ctx, W * 0.85, Math.min(40, sy - 20), 16);
      drawCloud(ctx, ((200 - cam * 0.1) % (W + 200) + W + 200) % (W + 200) - 100, sy - 62, 0.6, 0.9);
      drawCloud(ctx, ((700 - cam * 0.1) % (W + 200) + W + 200) % (W + 200) - 100, sy - 44, 0.45, 0.8);
      if (this.site.light) this.drawLighthouseTop(ctx, 1500 - cam * 0.6, sy, t);
    }
    const g = ctx.createLinearGradient(0, Math.max(0, sy), 0, H);
    g.addColorStop(0, this.waterColor(Math.max(BH.SURF, cy))); g.addColorStop(1, this.waterColor(cy + H));
    ctx.fillStyle = g; ctx.fillRect(0, Math.max(0, sy), W, H - Math.max(0, sy));
    if (sy > -80) {
      const sg0 = ctx.createLinearGradient(0, sy, 0, sy + 80); sg0.addColorStop(0, 'rgba(210,250,255,0.38)'); sg0.addColorStop(1, 'rgba(210,250,255,0)');
      ctx.fillStyle = sg0; ctx.fillRect(0, sy, W, 80);
      ctx.strokeStyle = 'rgba(230,255,255,0.22)'; ctx.lineWidth = 1.5;
      for (let k = 0; k < 3; k++) { ctx.beginPath(); for (let x = 0; x <= W; x += 14) { const yy = sy + 8 + k * 9 + Math.sin(x * 0.045 + t * (1.6 + k * 0.4) + k) * 2.5; x ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); } ctx.stroke(); }
    }
    // far layer: hazy reef, schools far off, the odd eagle ray
    const fy = this.site.floor - 120 - cy * 0.75;
    ctx.fillStyle = 'rgba(30,110,140,0.32)'; ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W + 20; x += 24) { const wx = x + cam * 0.2; ctx.lineTo(x, fy - 34 * Math.abs(Math.sin(wx * 0.004)) - 22 * Math.sin(wx * 0.011)); }
    ctx.lineTo(W, H); ctx.fill();
    ctx.fillStyle = 'rgba(20,80,110,0.35)';
    for (const f of this.farFish) { const fx = ((f.x - cam * 0.15) % (W + 200) + W + 200) % (W + 200) - 100; for (let i = 0; i < f.n; i++) { ell(ctx, fx + (i % 4) * 12 + Math.sin(t + i) * 2, f.y - cy * 0.7 + Math.floor(i / 4) * 8, 5, 2); ctx.fill(); } }
    if (this.ray.on) { ctx.save(); ctx.translate(this.ray.x, this.ray.y - cy * 0.7 + Math.sin(this.ray.t * 0.8) * 10); drawEagleRay(ctx, 62, this.ray.t, 0.55); ctx.restore(); }
    // god rays, slow and soft
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) {
      const bx = ((i * 240 - cam * 0.3) % (W + 360) + W + 360) % (W + 360) - 180, sw = Math.sin(t * 0.5 + i * 1.7) * 26, top = Math.max(sy, -40);
      const rg = ctx.createLinearGradient(0, top, 0, top + 440); rg.addColorStop(0, `rgba(190,240,255,${0.07 + 0.03 * Math.sin(t * 0.8 + i)})`); rg.addColorStop(1, 'rgba(190,240,255,0)');
      ctx.fillStyle = rg; ctx.beginPath(); ctx.moveTo(bx, top); ctx.lineTo(bx + 46 + i * 4, top); ctx.lineTo(bx - 90 + sw, top + 440); ctx.lineTo(bx - 170 + sw, top + 440); ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = 'rgba(10,70,95,0.5)'; ctx.beginPath(); ctx.moveTo(0, H);
    const my = this.site.floor - 80 - cy * 0.88;
    for (let x = 0; x <= W + 20; x += 20) { const wx = x + cam * 0.5; ctx.lineTo(x, my - 30 * Math.abs(Math.sin(wx * 0.006)) - 18 * Math.sin(wx * 0.017)); }
    ctx.lineTo(W, H); ctx.fill();
    // the world
    ctx.save(); ctx.translate(-cam, -cy);
    const bot = cy + H;
    if (this.site.light) this.drawLighthouseLegs(ctx, t);
    drawBoatSide(ctx, BH.BOATX, BH.SURF + 8, 0.42, { crew: this.others, flag: true, t });
    // sand, caustics, grass
    const sandPath = new Path2D(); sandPath.moveTo(cam - 10, bot + 10);
    for (let x = cam - 10; x <= cam + W + 20; x += 16) sandPath.lineTo(x, this.baseFloor(x)); sandPath.lineTo(cam + W + 20, bot + 10); sandPath.closePath();
    const sg = ctx.createLinearGradient(0, this.site.floor - 30, 0, this.site.floor + 60); sg.addColorStop(0, '#dcc994'); sg.addColorStop(1, '#a8955f');
    ctx.fillStyle = sg; ctx.fill(sandPath);
    ctx.save(); ctx.clip(sandPath); ctx.globalCompositeOperation = 'lighter';
    const pat = ctx.createPattern(causticTile(), 'repeat');
    ctx.globalAlpha = 0.15 * (this.weather.vis > 1.1 ? 1.2 : 1) * (this.variant === 'reef' ? 0.75 : 1); ctx.fillStyle = pat;
    let ox = (t * 14) % 192, oy = (t * 6) % 192; ctx.translate(ox, oy); ctx.fillRect(cam - 200 - ox, this.site.floor - 80 - oy, W + 400, 300); ctx.translate(-ox, -oy);
    ctx.globalAlpha *= 0.6; ctx.scale(1.35, 1.35); ox = (-t * 10) % 192; oy = (t * 4) % 192; ctx.translate(ox, oy); ctx.fillRect((cam - 200) / 1.35 - ox, (this.site.floor - 80) / 1.35 - oy, (W + 400) / 1.35, 260); ctx.restore();
    ctx.strokeStyle = '#4f8a46'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    for (const gr of this.grass) { if (gr.x < cam - 20 || gr.x > cam + W + 20) continue; const by = this.baseFloor(gr.x) + 4; ctx.beginPath(); ctx.moveTo(gr.x, by); ctx.quadraticCurveTo(gr.x + Math.sin(t * 1.4 + gr.ph) * 6, by - gr.h * 0.6, gr.x + Math.sin(t * 1.4 + gr.ph) * 10, by - gr.h); ctx.stroke(); }
    for (const s of this.sandDeco) { if (s.x < cam - 30 || s.x > cam + W + 30 || this.groundAt(s.x) < this.baseFloor(s.x) - 2) continue; ctx.save(); ctx.translate(s.x, this.baseFloor(s.x) + 6); if (s.kind === 'star') drawStarfish(ctx, s.r, s.c); else drawUrchin(ctx, s.r * 0.7, t); ctx.restore(); }
    const n = this.nurse; if (n.x > cam - 120 && n.x < cam + W + 120) { ctx.save(); ctx.translate(n.x, n.y); if (n.dir < 0) ctx.scale(-1, 1); drawShark(ctx, 130, { kind: 'nurse', t: n.t, speed: n.move > 0 ? 6 : 1.2 }); ctx.restore(); }
    if (this.goliath && this.goliath.x > cam - 160 && this.goliath.x < cam + W + 160) { ctx.save(); ctx.translate(this.goliath.x, this.goliath.y); drawFish(ctx, 'goliath', 150, { t: this.goliath.t, flip: true, wig: 0.15, speed: 2 }); ctx.restore(); }
    for (const L of this.ledges) { if (L.x1 < cam - 60 || L.x0 > cam + W + 60) continue; this.drawLedge(ctx, L, t); }
    for (const den of this.dens) { if (den.x < cam - 80 || den.x > cam + W + 80) continue; this.drawDen(ctx, den, t); }
    for (const c of this.crabs) { if (c.x < cam - 30 || c.x > cam + W + 30) continue; ctx.save(); ctx.translate(c.x, this.groundAt(c.x) + 2); drawCrab(ctx, 11, c.t, c.flee > 0 || c.pause <= 0); ctx.restore(); }
    const o = this.octo;
    if (o.state !== 'gone' && o.x > cam - 60 && o.x < cam + W + 60) {
      ctx.save(); ctx.globalAlpha = clamp(o.a, 0, 1); ctx.translate(o.x, o.y);
      const camo = o.state === 'hide' ? mix('#8a7a5a', '#c4583a', (Math.sin(o.t * 0.7) + 1) / 2) : '#f2efe8';
      drawOctopus(ctx, 22, o.t, { color: camo, flee: o.state === 'flee' ? 1 : 0 }); ctx.restore();
    }
    for (const c of this.critters) { if (c.x < cam - 60 || c.x > cam + W + 60) continue; ctx.save(); ctx.translate(c.x, c.y); drawFish(ctx, c.key, c.len, { t: c.t, flip: c.vx < 0, wig: c.nib > 0 ? 0.2 : 0.6 }); ctx.restore(); }
    for (const s of this.schools) {
      if (s.x < cam - 120 || s.x > cam + W + 120) continue;
      for (const f of s.fish) {
        const fx = s.x + f.ox + Math.sin(t * 2 + f.ph) * 4, fy = s.y + f.oy;
        if (s.kind === 'grunt' || s.kind === 'yt') { ctx.save(); ctx.translate(fx, fy); drawFish(ctx, s.kind === 'yt' ? 'yellowtail' : 'whitegrunt', 22, { t: t + f.ph, flip: Math.cos(s.ph) < 0, wig: 0.6 }); ctx.restore(); continue; }
        ctx.save(); ctx.translate(fx, fy); if (Math.cos(s.ph) < 0) ctx.scale(-1, 1);
        ctx.fillStyle = s.kind === 'tang' ? '#2b62d6' : '#e2d867'; ell(ctx, 0, 0, 7, 4); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(-11, -4); ctx.lineTo(-11, 4); ctx.fill();
        if (s.kind === 'sgt') { ctx.fillStyle = '#222'; ctx.fillRect(-3, -4, 1.4, 8); ctx.fillRect(1, -4, 1.4, 8); }
        ctx.restore();
      }
    }
    ctx.save(); ctx.translate(this.cuda.x, this.cuda.y + Math.sin(t * 0.6) * 10); drawFish(ctx, 'barracuda', 120, { t, flip: this.cuda.dir < 0, wig: 0.4, alpha: 0.85 }); ctx.restore();
    const tu = this.turtle; if (tu.x > cam - 100 && tu.x < cam + W + 100) { ctx.save(); ctx.translate(tu.x, tu.y); if (tu.dir < 0) ctx.scale(-1, 1); drawTurtle(ctx, 64, tu.t); ctx.restore(); }
    for (const j of this.jellies) this.drawJelly(ctx, j, t);
    if (this.out) this.drawOut(ctx, t);
    // depth grading: everything gets bluer and darker as it gets deeper
    const gg = ctx.createLinearGradient(0, BH.SURF + 120, 0, this.site.floor + 40);
    gg.addColorStop(0, 'rgba(4,34,62,0)'); gg.addColorStop(1, `rgba(4,34,62,${this.site.grade})`);
    ctx.fillStyle = gg; ctx.fillRect(cam - 20, Math.max(BH.SURF, cy), W + 40, H + 20);
    this.drawNet(ctx, t, true);
    const moving = Math.hypot(d.vx, d.vy) / 168;
    let tilt = clamp(d.vy / 400, -0.35, 0.35) * d.facing;
    if (this.intro && this.intro.t > 0.5) tilt = -((this.intro.t - 0.5) / 0.65) * 2.2;
    drawDiver(ctx, this.ch, d.x, d.y, 0.95, { t, facing: d.facing, kick: this.intro ? 0 : moving, tickle: this.tickling, tilt, noNet: true });
    this.drawNet(ctx, t, false);
    if (this.shark) this.drawSharkSprite(ctx);
    this.parts.draw(ctx);
    this.drawAim(ctx, t);
    ctx.restore();
    // drifting specks and the near-side reef, each on their own parallax
    ctx.fillStyle = 'rgba(235,250,255,0.5)';
    for (const p of this.snow) { const x = (((p.x - cam * 0.6) % (W + 40)) + W + 40) % (W + 40) - 20, y = ((p.y - cy * 0.6) % 660 + 660) % 660 - 60; if (y < sy + 4) continue; ell(ctx, x + Math.sin(p.ph) * 4, y, p.r, p.r); ctx.fill(); }
    for (const f of this.fg) {
      const x = f.x - cam * 1.35; if (x < -140 || x > W + 140) continue;
      ctx.save(); ctx.translate(x, H + 30 + (this.maxCamY() - cy) * 0.35); ctx.scale(f.s * 0.6, f.s * 0.6); ctx.globalAlpha = 0.42; ctx.fillStyle = 'rgba(4,34,46,0.88)';
      if (f.kind === 'rock') { ctx.beginPath(); ctx.moveTo(-90, 0); ctx.quadraticCurveTo(-70, -60, -10, -66); ctx.quadraticCurveTo(50, -70, 80, 0); ctx.fill(); }
      else if (f.kind === 'fan') { ctx.rotate(Math.sin(t * 0.9 + f.x) * 0.06); ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-60, -50, -34, -110); ctx.quadraticCurveTo(0, -130, 34, -110); ctx.quadraticCurveTo(60, -50, 0, 0); ctx.fill(); }
      else { ctx.strokeStyle = 'rgba(4,34,46,0.88)'; ctx.lineWidth = 6; ctx.lineCap = 'round'; for (let k = -3; k <= 3; k++) { const sw = Math.sin(t * 1.2 + k + f.x) * 10; ctx.beginPath(); ctx.moveTo(k * 8, 0); ctx.quadraticCurveTo(k * 8 + sw * 0.5, -40, k * 10 + sw, -70 - (k % 2) * 16); ctx.stroke(); } }
      ctx.restore();
    }
    if (sy > -10) drawWaterline(ctx, W, sy, t, 'rgba(255,255,255,0.7)', 2.5);
    const vis = this.weather.vis;
    if (vis < 1) { ctx.fillStyle = 'rgba(40,90,90,0.18)'; ctx.fillRect(0, Math.max(0, sy), W, H); }
    // low air, blackout, and shark tension
    const air = this.breath / this.maxBreath;
    if ((air < 0.28 && d.y > BH.SURF + 14) || this.blackout > 0) {
      const k = this.blackout > 0 ? 1 - this.blackout / 2.2 * 0.2 : (0.28 - air) / 0.28;
      const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.9);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(150,10,30,${0.3 + 0.5 * k + Math.sin(t * 8) * 0.08})`);
      ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
      if (this.blackout > 0) { ctx.fillStyle = `rgba(0,0,0,${0.6 * (1 - this.blackout / 2.2) + 0.3})`; ctx.fillRect(0, 0, W, H); }
    }
    if (this.shark && this.shark.state === 'hunt') {
      const k = Music.intensity, vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(120,0,0,${0.12 + 0.3 * k + Math.sin(t * 9) * 0.05 * k})`);
      ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
      this.drawChaseMarkers(ctx, W, H, t);
    }
    this.fl.draw(ctx);
    this.drawHud(ctx, W, H);
    if (this.gauge) this.drawGauge(ctx, W, H);
    if (this.paused) this.drawPause(ctx);
  }
  drawLighthouseTop(ctx, x, sy, t) {
    // Alligator Light standing out of the water in the distance
    ctx.save(); ctx.globalAlpha = 0.55; ctx.strokeStyle = '#2b2f33'; ctx.lineWidth = 2;
    const h = Math.min(120, sy - 4), top = sy - h;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + s * 22, sy); ctx.lineTo(x + s * 6, top + 18); ctx.stroke(); }
    for (let y = sy - 14; y > top + 22; y -= 14) { ctx.beginPath(); ctx.moveTo(x - 20 + (sy - y) * 0.14, y); ctx.lineTo(x + 20 - (sy - y) * 0.14, y - 10); ctx.stroke(); }
    ctx.fillStyle = '#e8e4da'; ctx.fillRect(x - 7, top + 6, 14, 14); ctx.fillStyle = '#2b2f33'; ctx.fillRect(x - 8, top + 2, 16, 4);
    ctx.fillStyle = `rgba(255,244,170,${0.5 + 0.5 * Math.max(0, Math.sin(t * 3))})`; ell(ctx, x, top + 12, 3, 3); ctx.fill();
    ctx.restore();
  }
  drawLighthouseLegs(ctx, t) {
    // the iron legs of the old lighthouse going down into the reef
    const x0 = 1500, floor = this.baseFloor(x0);
    ctx.save(); ctx.strokeStyle = 'rgba(20,40,50,0.28)'; ctx.lineWidth = 10;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x0 + s * 40, BH.SURF - 10); ctx.lineTo(x0 + s * 120, floor); ctx.stroke(); }
    ctx.lineWidth = 4; for (let y = BH.SURF + 40; y < floor - 20; y += 90) { const k = (y - BH.SURF) / (floor - BH.SURF); ctx.beginPath(); ctx.moveTo(x0 - 40 - 80 * k, y); ctx.lineTo(x0 + 40 + 80 * (k + 0.15), y + 80); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x0 + 40 + 80 * k, y); ctx.lineTo(x0 - 40 - 80 * (k + 0.15), y + 80); ctx.stroke(); }
    ctx.restore();
  }
  drawNet(ctx, t, back) {
    const n = this.net, d = this.diver; if (this.intro || this.blackout > 0) return;
    const hx = d.x + d.facing * 12, hy = d.y + 8, ang = Math.atan2(n.y - hy, n.x - hx), R = NET.HOOP;
    const open = n.state === 'set' ? 0.85 : n.state === 'swing' ? 0.6 : 0.42;
    const bagA = n.state === 'swing' ? Math.atan2(n.fy - n.ty, n.fx - n.tx) : n.state === 'set' ? Math.PI / 2 + Math.sin(t * 2) * 0.15 : Math.PI / 2 - d.facing * 0.6;
    if (back) {
      // the mesh bag hangs behind the hoop
      const bx = n.x + Math.cos(bagA) * R * 1.5, by = n.y + Math.sin(bagA) * R * 1.5, px = -Math.sin(ang), py = Math.cos(ang);
      ctx.save(); ctx.beginPath(); ctx.moveTo(n.x + px * R, n.y + py * R); ctx.quadraticCurveTo(bx + px * R * 0.6, by + py * R * 0.6, bx, by); ctx.quadraticCurveTo(bx - px * R * 0.6, by - py * R * 0.6, n.x - px * R, n.y - py * R); ctx.closePath();
      ctx.fillStyle = 'rgba(220,235,240,0.18)'; ctx.fill(); ctx.clip();
      ctx.strokeStyle = 'rgba(230,240,245,0.5)'; ctx.lineWidth = 1;
      for (let i = -6; i <= 6; i++) { ctx.beginPath(); ctx.moveTo(n.x - 60 + i * 9, n.y - 60); ctx.lineTo(n.x + 60 + i * 9, n.y + 60); ctx.stroke(); ctx.beginPath(); ctx.moveTo(n.x + 60 + i * 9, n.y - 60); ctx.lineTo(n.x - 60 + i * 9, n.y + 60); ctx.stroke(); }
      ctx.restore();
      return;
    }
    ctx.strokeStyle = '#b9c3ca'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(n.x - Math.cos(ang) * R * open, n.y - Math.sin(ang) * R * open); ctx.stroke();
    ctx.strokeStyle = n.state === 'set' && this.out && this.inHoop(this.out) ? PAL.good : '#eef4f6'; ctx.lineWidth = 3;
    ell(ctx, n.x, n.y, R, R * open, ang + Math.PI / 2); ctx.stroke();
    ctx.fillStyle = C_GLOVE(this.C); ell(ctx, hx, hy, 4, 3.5); ctx.fill();
  }
  drawAim(ctx, t) {
    const o = this.out; if (!o || this.gauge || this.paused || this.net.state === 'swing') return;
    const d = this.diver, sh = this.shoulder(), b = this.bugBody(o);
    // a faint circle shows how far the net reaches
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 2; ctx.setLineDash([6, 10]); ell(ctx, sh.x, sh.y, NET.REACH, NET.REACH); ctx.stroke(); ctx.restore();
    if (Input.hover && !Game.touch) {
      let hx = Input.hover.x + this.cam, hy = Input.hover.y + this.camY; const L = dist(sh.x, sh.y, hx, hy);
      if (L > NET.REACH) { hx = sh.x + (hx - sh.x) * NET.REACH / L; hy = sh.y + (hy - sh.y) * NET.REACH / L; }
      const on = dist(hx, hy, b.x, b.y) < NET.HOOP + 12;
      ctx.save(); ctx.strokeStyle = on ? 'rgba(80,255,150,0.9)' : 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2.5; ctx.setLineDash([5, 5]); ell(ctx, hx, hy, NET.HOOP, NET.HOOP * 0.8); ctx.stroke(); ctx.restore();
      if (L > NET.REACH + 20) text(ctx, 'click: swim in and swing', hx, hy - NET.HOOP - 10, { size: 13, align: 'center', color: '#fff', weight: 800, stroke: 'rgba(0,0,0,0.5)', sw: 3 });
    } else {
      const k = (Math.sin(t * 6) + 1) / 2;
      ctx.strokeStyle = `rgba(255,214,90,${0.5 + 0.4 * k})`; ctx.lineWidth = 3; ell(ctx, b.x, b.y, 38 + k * 6, 26 + k * 4); ctx.stroke();
    }
    if (o.state === 'crouch') {
      // it's about to tail-flip backward: show where it'll land
      const lx = o.x - o.dir * 110;
      ctx.save(); ctx.strokeStyle = 'rgba(255,120,80,0.85)'; ctx.lineWidth = 3; ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.moveTo(o.x - o.dir * 30, o.y - 16); ctx.quadraticCurveTo(o.x - o.dir * 70, o.y - 44, lx, o.y - 8); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,120,80,0.85)'; ctx.beginPath(); ctx.moveTo(lx, o.y - 2); ctx.lineTo(lx + o.dir * 12, o.y - 16); ctx.lineTo(lx + o.dir * 16, o.y); ctx.fill(); ctx.restore();
      text(ctx, '!', o.x, o.y - 40, { size: 30, align: 'center', color: PAL.warn, stroke: '#1a1a1a', sw: 5, weight: 800 });
    }
  }
  drawSharkSprite(ctx) {
    const s = this.shark;
    ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.ang); if (Math.cos(s.ang) < 0) ctx.scale(1, -1);
    drawShark(ctx, 190, { t: s.t, mouth: s.mouth, speed: s.lunge > 0 ? 12 : 5 });
    ctx.restore();
  }
  drawChaseMarkers(ctx, W, H, t) {
    const bx = BH.BOATX - this.cam, sy = BH.SURF - this.camY;
    const pulse = 1 + Math.sin(t * 8) * 0.08;
    if (bx < 30 || bx > W - 30 || sy < 20) {
      const left = bx < W / 2, x = bx < 30 ? 46 : bx > W - 30 ? W - 46 : clamp(bx, 46, W - 46), y = sy < 20 ? 120 : 150;
      ctx.save(); ctx.translate(x, y); ctx.scale(pulse, pulse); ctx.rotate(sy < 20 && bx >= 30 && bx <= W - 30 ? -Math.PI / 2 : left ? Math.PI : 0);
      ctx.fillStyle = PAL.good; ctx.beginPath(); ctx.moveTo(26, 0); ctx.lineTo(-10, -22); ctx.lineTo(-10, 22); ctx.closePath(); ctx.fill();
      ctx.restore();
      text(ctx, 'BOAT', x, y + 40, { size: 18, align: 'center', color: '#fff', weight: 800, stroke: 'rgba(0,0,0,0.6)', sw: 4 });
    } else {
      ctx.save(); ctx.translate(bx, sy + 46 + Math.sin(t * 6) * 6);
      ctx.fillStyle = PAL.good; ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(-16, 4); ctx.lineTo(16, 4); ctx.closePath(); ctx.fill(); ctx.restore();
      text(ctx, 'CLIMB OUT HERE', bx, sy + 78, { size: 16, align: 'center', color: '#fff', weight: 800, stroke: 'rgba(0,0,0,0.6)', sw: 4 });
    }
    const sx = this.shark.x - this.cam;
    if (sx < -40 || sx > W + 40) { const left = sx < 0; text(ctx, '🦈', left ? 30 : W - 30, clamp(this.shark.y - this.camY, 120, H - 40), { size: 30, align: 'center', base: 'middle', alpha: 0.6 + 0.4 * Math.sin(t * 10) }); }
  }
  drawLedge(ctx, L, t) {
    const g = ctx.createLinearGradient(0, L.top, 0, L.top + L.h); g.addColorStop(0, '#827660'); g.addColorStop(0.5, '#6a604c'); g.addColorStop(1, '#45402f');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(L.pts[0][0], L.pts[0][1]); for (const p of L.pts) ctx.lineTo(p[0], p[1]); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.clip();
    for (const [x, y, r, k] of L.spots) { ctx.fillStyle = k < 0.5 ? 'rgba(40,34,24,0.35)' : 'rgba(170,140,100,0.25)'; ell(ctx, x, y, r * 2, r); ctx.fill(); }
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(L.x0 - 4, L.top + L.h * 0.6, L.x1 - L.x0 + 8, L.h * 0.45);
    const sh = ctx.createLinearGradient(0, L.top, 0, L.top + 30); sh.addColorStop(0, 'rgba(255,255,220,0.22)'); sh.addColorStop(1, 'rgba(255,255,220,0)'); ctx.fillStyle = sh; ctx.fillRect(L.x0 - 10, L.top - 10, L.x1 - L.x0 + 20, 40);
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,220,0.16)'; ctx.lineWidth = 2;
    for (let x = L.x0 + 10; x < L.x1 - 10; x += 26) { const a = Math.sin(x * 0.09 + t * 2) * 0.5 + 0.5; if (a < 0.4) continue; ctx.beginPath(); ctx.moveTo(x, L.top + 8); ctx.quadraticCurveTo(x + 8, L.top + 4, x + 16, L.top + 9); ctx.stroke(); }
    for (const dc of L.deco) {
      const x = dc.x, y = L.top - 2, s = dc.s;
      if (dc.kind === 'fan') { ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 1.1 + x) * 0.08); ctx.fillStyle = rgba(dc.c, 0.85); ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-24 * s, -20 * s, -14 * s, -40 * s); ctx.quadraticCurveTo(0, -50 * s, 14 * s, -40 * s); ctx.quadraticCurveTo(24 * s, -20 * s, 0, 0); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1; for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(k * 6 * s, -42 * s); ctx.stroke(); } ctx.restore(); }
      else if (dc.kind === 'brain') { ctx.fillStyle = '#c9b27a'; ell(ctx, x, y - 6 * s, 16 * s, 11 * s); ctx.fill(); ctx.strokeStyle = 'rgba(120,90,50,0.5)'; ctx.lineWidth = 1.2; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(x, y - 2 * s, (5 + k * 4) * s, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); } }
      else if (dc.kind === 'sponge') { ctx.fillStyle = dc.c; rr(ctx, x - 5 * s, y - 26 * s, 10 * s, 26 * s, 4 * s); ctx.fill(); rr(ctx, x + 5 * s, y - 18 * s, 8 * s, 18 * s, 4 * s); ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ell(ctx, x, y - 25 * s, 3 * s, 1.5 * s); ctx.fill(); }
      else if (dc.kind === 'barrel') { ctx.fillStyle = '#9a5a3a'; ctx.beginPath(); ctx.moveTo(x - 14 * s, y); ctx.lineTo(x - 18 * s, y - 30 * s); ctx.lineTo(x + 18 * s, y - 30 * s); ctx.lineTo(x + 14 * s, y); ctx.fill(); ctx.fillStyle = '#3a1e14'; ell(ctx, x, y - 30 * s, 18 * s, 5 * s); ctx.fill(); ctx.strokeStyle = 'rgba(255,220,180,0.2)'; ctx.lineWidth = 1.5; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(x - 15 * s, y - (8 + k * 8) * s); ctx.lineTo(x + 15 * s, y - (8 + k * 8) * s); ctx.stroke(); } }
      else if (dc.kind === 'elk') { ctx.strokeStyle = '#c98a4a'; ctx.lineCap = 'round'; const br = (bx, by, a, l, w) => { if (l < 5) return; const ex = bx + Math.cos(a) * l, ey = by + Math.sin(a) * l; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke(); br(ex, ey, a - 0.5, l * 0.68, w * 0.7); br(ex, ey, a + 0.45, l * 0.62, w * 0.7); }; br(x, y, -Math.PI / 2 + Math.sin(x) * 0.2, 18 * s, 5 * s); }
      else if (dc.kind === 'urchin') { ctx.save(); ctx.translate(x, y + 2); drawUrchin(ctx, 5 * s, t); ctx.restore(); }
      else { ctx.strokeStyle = '#8a5a3a'; ctx.lineWidth = 2.5 * s; ctx.lineCap = 'round'; for (let k = 0; k < 3; k++) { const sw = Math.sin(t * 1.3 + x * 0.1 + k) * 6; ctx.beginPath(); ctx.moveTo(x + k * 4, y); ctx.quadraticCurveTo(x + k * 4 + sw * 0.5, y - 18 * s, x + k * 5 + sw, y - (28 + k * 6) * s); ctx.stroke(); } }
    }
  }
  drawDen(ctx, den, t) {
    const hg = ctx.createRadialGradient(den.x, den.y, 2, den.x, den.y, 22); hg.addColorStop(0, '#050807'); hg.addColorStop(0.7, '#141815'); hg.addColorStop(1, 'rgba(20,24,21,0)');
    ctx.fillStyle = hg; ell(ctx, den.x, den.y, 22, 16); ctx.fill();
    const d = this.diver, dd = dist(d.x, d.y, den.x, den.y);
    if (den.kind === 'lobster' && den.state === 'in') {
      // from a distance you only see the antennae; get close to see the bug
      const c = den.coax, tw = den.twitch > 0 ? Math.sin(t * 40) * 0.25 + 0.3 : 0;
      ctx.save(); ctx.beginPath(); ctx.rect(den.x - (den.dir < 0 ? 400 : 18), den.y - 200, 418, 260); ctx.clip();
      ctx.save(); ctx.translate(den.x + den.dir * (-22 + c * 30), den.y + 3); ctx.globalAlpha = clamp(0.4 + 0.6 * (1 - (dd - 120) / 220), 0.4, 1) * (0.6 + 0.4 * c);
      drawLobsterSide(ctx, bugLen(den.lob), { t, flip: den.dir < 0, twitch: tw, gold: den.lob.gold });
      ctx.restore(); ctx.restore();
    } else if (den.kind === 'moray') {
      if (Math.sin(t * 2.3 + den.x) > 0.6 || den.peek > 0) { ctx.fillStyle = '#e8f04a'; ell(ctx, den.x + den.dir * 4, den.y - 3, 2, 2); ctx.fill(); ell(ctx, den.x + den.dir * 9, den.y - 2, 2, 2); ctx.fill(); }
      if (den.peek > 0) {
        const k = Math.min(1, den.peek) * 30;
        ctx.save(); ctx.translate(den.x, den.y); ctx.scale(den.dir, 1);
        ctx.fillStyle = '#58662c'; ctx.beginPath(); ctx.moveTo(-6, -9); ctx.quadraticCurveTo(k * 0.6, -14, k, -4); ctx.lineTo(k + 4, 2); ctx.lineTo(k - 2, 4); ctx.quadraticCurveTo(k * 0.6, 10, -6, 9); ctx.fill();
        ctx.strokeStyle = '#2a2f12'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(k * 0.55, 1); ctx.lineTo(k + 2, 1); ctx.stroke();
        ctx.fillStyle = '#fff'; ell(ctx, k * 0.7, -5, 2.2, 2.2); ctx.fill(); ctx.fillStyle = '#000'; ell(ctx, k * 0.72, -5, 1.1, 1.1); ctx.fill();
        ctx.restore();
      }
    } else if (den.state === 'gone') {
      ctx.strokeStyle = 'rgba(210,130,70,0.4)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(den.x, den.y - 4); ctx.lineTo(den.x + den.dir * 16, den.y - 14); ctx.stroke();
    }
    if (this.target === den && !this.out) {
      const tw = den.kind === 'lobster' && den.twitch > 0, c = den.kind === 'lobster' ? den.coax : den.probe / 0.8;
      if (this.inReach) { ctx.strokeStyle = tw ? PAL.bad : 'rgba(255,200,69,0.9)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(den.x, den.y, 30, -Math.PI * 0.5, -Math.PI * 0.5 + TAU * clamp(c, 0, 1)); ctx.stroke(); }
      const msg = !this.inReach ? (this.tickPtr ? 'Swimming over…' : '') : tw ? 'LET GO!' : this.tickling ? 'Keep tickling…' : Game.touch ? 'HOLD TO TICKLE' : 'HOLD TO TICKLE';
      if (msg) {
        const col = tw ? PAL.bad : this.tickling ? '#ffffff' : PAL.sun, sc = tw ? 1 + Math.sin(t * 30) * 0.06 : 1;
        ctx.save(); ctx.translate(den.x + den.dir * 10, den.y - 52); ctx.scale(sc, sc);
        text(ctx, msg, 0, 0, { size: tw ? 26 : 18, align: 'center', base: 'middle', color: col, stroke: 'rgba(0,0,0,0.65)', sw: 5, weight: 800 });
        ctx.restore();
      }
    } else if (den.kind === 'lobster' && den.twitch > 0 && den.state === 'in') text(ctx, '!', den.x + den.dir * 20, den.y - 30, { size: 30, align: 'center', color: PAL.warn, stroke: '#1a1a1a', sw: 5, weight: 800 });
  }
  drawOut(ctx, t) {
    const o = this.out;
    ctx.save(); ctx.translate(o.x, o.y);
    drawLobsterSide(ctx, bugLen(o.lob), { t, flip: o.dir < 0, walk: o.state === 'walk' || o.state === 'home', curl: o.state === 'flip' ? 1 : o.state === 'crouch' ? 0.55 : 0, twitch: o.state === 'crouch' ? 0.3 : 0, gold: o.lob.gold });
    ctx.restore();
  }
  drawJelly(ctx, j, t) {
    ctx.save(); ctx.translate(j.x, j.y + Math.sin(t * 2 + j.ph) * 4);
    const pulse = 1 + Math.sin(t * 3 + j.ph) * 0.08;
    ctx.fillStyle = 'rgba(220,235,255,0.45)'; ctx.beginPath(); ctx.ellipse(0, 0, 18 * pulse, 13 / pulse, 0, Math.PI, 0); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,170,220,0.6)'; ctx.lineWidth = 2; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(-9 + k * 6, -4, 3, 0, TAU); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(220,235,255,0.5)'; ctx.lineWidth = 1; for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(k * 6, 0); ctx.quadraticCurveTo(k * 6 + Math.sin(t * 3 + k) * 5, 12, k * 5, 24); ctx.stroke(); }
    ctx.restore();
  }
  drawHud(ctx, W, H) {
    const t = this.t;
    this.drawTopBar(ctx);
    const bx = 70, by = 64, air = clamp(this.breath / this.maxBreath, 0, 1);
    panel(ctx, bx, by, 196, 34, { r: 17 });
    text(ctx, 'AIR', bx + 14, by + 23, { size: 15, weight: 800, color: '#cfe3ea' });
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; rr(ctx, bx + 48, by + 11, 134, 12, 6); ctx.fill();
    ctx.fillStyle = air > 0.5 ? '#6fe0ff' : air > 0.28 ? PAL.warn : PAL.bad; rr(ctx, bx + 48, by + 11, 134 * air, 12, 6); ctx.fill();
    const depthFt = Math.max(0, Math.round((this.diver.y - BH.SURF) / 18));
    text(ctx, depthFt + ' ft', bx + 196 + 10, by + 23, { size: 15, weight: 800, color: '#cfe3ea', stroke: 'rgba(0,0,0,0.4)', sw: 3 });
    const gx = W - 214;
    panel(ctx, gx, 12, 200, 46, { r: 23 });
    text(ctx, 'BAG', gx + 14, 41, { size: 15, weight: 800, color: '#cfe3ea' });
    for (let i = 0; i < BH.BAG; i++) { const lx = gx + 64 + i * 22, lob = this.bag[i]; ctx.globalAlpha = lob ? 1 : 0.25; ctx.save(); ctx.translate(lx, 36); ctx.rotate(-0.5); drawLobsterSide(ctx, 16, { gold: lob && lob.gold }); ctx.restore(); ctx.globalAlpha = 1; }
    const mmw = Math.min(260, W - 600), mmx = W / 2 - mmw / 2 + 40, mmy = 64;
    if (mmw > 120) {
      ctx.fillStyle = 'rgba(3,30,44,0.55)'; rr(ctx, mmx, mmy, mmw, 12, 6); ctx.fill();
      ctx.fillStyle = 'rgba(160,140,100,0.9)'; for (const L of this.ledges) ctx.fillRect(mmx + (L.x0 / this.WW) * mmw, mmy + 3, Math.max(2, ((L.x1 - L.x0) / this.WW) * mmw), 6);
      ctx.fillStyle = '#fff'; ell(ctx, mmx + (BH.BOATX / this.WW) * mmw, mmy + 6, 3, 3); ctx.fill();
      if (this.shark) { ctx.fillStyle = PAL.bad; ell(ctx, mmx + clamp(this.shark.x / this.WW, 0, 1) * mmw, mmy + 6, 4, 4); ctx.fill(); }
      ctx.fillStyle = PAL.sun; ell(ctx, mmx + (this.diver.x / this.WW) * mmw, mmy + 6, 4.5, 4.5); ctx.fill();
    }
    // the action button: TICKLE at a hole, LET GO on a twitch, NET when a bug is out
    const a = this.actionZone();
    let label = 'NET', fill = 'rgba(255,255,255,0.18)', fg = '#fff', active = false, prog = null, hot = false;
    if (this.out) { active = true; hot = this.out.state === 'idle'; label = 'NET'; fill = PAL.good; fg = PAL.ink; }
    else if (this.target && this.inReach) {
      active = true; const tw = this.target.kind === 'lobster' && this.target.twitch > 0;
      label = tw ? 'LET GO' : 'TICKLE'; fill = tw ? PAL.bad : PAL.sun; fg = tw ? '#fff' : PAL.ink;
      prog = this.target.kind === 'lobster' ? this.target.coax : clamp(this.target.probe / 0.8, 0, 1);
    }
    // held down (a finger on it, or Space): it sinks in a little and gets a bright rim, so you know it's registering
    const down = this.actionHeld();
    const pulse = down ? 0.93 : active ? 1 + Math.sin(t * (hot ? 14 : 6)) * (hot ? 0.06 : 0.03) : 1;
    ctx.save(); ctx.translate(a.x, a.y + (down ? 3 : 0)); ctx.scale(pulse, pulse);
    ctx.globalAlpha = active || down ? 1 : 0.5;
    if (active) { ctx.fillStyle = rgba(fill.startsWith('#') ? fill : '#ffffff', 0.25); ell(ctx, 0, 0, a.r + 12, a.r + 12); ctx.fill(); }
    if (down) { ctx.save(); ctx.shadowColor = '#fff'; ctx.shadowBlur = 20; ctx.fillStyle = fill; ell(ctx, 0, 0, a.r, a.r); ctx.fill(); ctx.restore(); }
    ctx.fillStyle = fill; ell(ctx, 0, 0, a.r, a.r); ctx.fill();
    if (down) { ctx.fillStyle = 'rgba(255,255,255,0.22)'; ell(ctx, 0, 0, a.r, a.r); ctx.fill(); }
    ctx.strokeStyle = down ? '#ffffff' : 'rgba(255,255,255,0.8)'; ctx.lineWidth = down ? 5 : 3; ell(ctx, 0, 0, a.r, a.r); ctx.stroke();
    if (prog != null) {
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 7; ell(ctx, 0, 0, a.r + 6, a.r + 6); ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, a.r + 6, -Math.PI / 2, -Math.PI / 2 + TAU * prog); ctx.stroke();
    }
    text(ctx, label, 0, 2, { size: label.length > 4 ? 20 : 26, align: 'center', base: 'middle', color: fg, weight: 800 });
    if (!Game.touch) text(ctx, 'SPACE', 0, 26, { size: 12, align: 'center', base: 'middle', color: fg, weight: 800, alpha: 0.7 });
    ctx.restore();
    if (this.joy) {
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 3; ell(ctx, this.joy.sx, this.joy.sy, 55, 55); ctx.stroke();
      const jx = clamp(this.joy.x - this.joy.sx, -55, 55), jy = clamp(this.joy.y - this.joy.sy, -55, 55);
      ctx.fillStyle = 'rgba(255,255,255,0.45)'; ell(ctx, this.joy.sx + jx, this.joy.sy + jy, 22, 22); ctx.fill();
    } else if (this.t < 8 && !this.coach) {
      text(ctx, Game.touch ? 'Drag to swim · hold a hole to tickle · tap the bug to net it' : 'WASD to swim · hold on a hole to tickle · click the bug to net it', 24, H - 30, { size: 17, color: '#fff', weight: 700, alpha: 0.85, stroke: 'rgba(0,0,0,0.4)', sw: 4, maxW: W - 200 });
    }
    if (this.coach && !this.paused) this.drawCoach(ctx, W, H, t);
    if (this.quip && !(this.coachMsg() && !Game.toasts.length)) this.drawQuip(ctx, W);
  }
  coachMsg() {
    if (!this.coach) return null;
    let msg = null;
    if (this.out) msg = Game.touch ? 'Tap the bug to swing your net!' : 'Click the bug to swing your net!';
    else if (this.target && this.inReach && this.target.kind === 'lobster' && this.target.twitch > 0) msg = 'It twitched: LET GO, then hold again';
    else if (this.target && this.inReach) msg = Game.touch ? 'Hold on the hole (or TICKLE) to coax it out' : 'Hold the mouse on the hole (or Space) to tickle';
    else if (this.coachSaw.behind) msg = 'Lobsters flip backward. Set the net BEHIND the tail.';
    else if (this.t < 14) msg = 'Swim down. Look for antennae poking out of holes.';
    return msg;
  }
  drawCoach(ctx, W, H, t) {
    const msg = this.coachMsg();
    if (!msg || Game.toasts.length) return;
    const w = Math.min(470, W - 280), x = W / 2 - w / 2, y = 116;
    panel(ctx, x, y - 22, w, 44, { r: 14, fill: 'rgba(255,255,255,0.95)', line: 'rgba(0,0,0,0.1)' });
    text(ctx, msg, x + w / 2, y + 1, { size: 16, align: 'center', base: 'middle', color: PAL.ink, weight: 800, maxW: w - 16 });
  }
  drawQuip(ctx, W) {
    const q = this.quip, C = CHARS[q.who], qw = Math.min(400, W * 0.44), qx = W - qw - 14, qy = 84;
    ctx.save(); ctx.globalAlpha = Math.min(1, q.t * 3);
    panel(ctx, qx, qy, qw, 44, { r: 22, fill: 'rgba(255,255,255,0.95)', line: 'rgba(0,0,0,0.1)' });
    crewAvatar(ctx, q.who, qx + 24, qy + 22, 17);
    text(ctx, C.name + ': ' + q.msg, qx + 48, qy + 28, { size: 16, color: PAL.ink, weight: 800, maxW: qw - 60 });
    ctx.restore();
  }
  drawGauge(ctx, W, H) {
    const g = this.gauge, lob = g.lob, k = easeOut(g.t / 0.3);
    ctx.fillStyle = `rgba(3,22,32,${0.82 * k})`; ctx.fillRect(0, 0, W, H);
    text(ctx, 'Gauge it', W / 2, 62, { display: true, size: 40, align: 'center', color: '#fff' });
    if (lob.gold) text(ctx, 'RARE GOLDEN BUG · ×3 POINTS', W - 30, 58, { size: 16, align: 'right', color: PAL.sun, weight: 800 });
    text(ctx, 'Legal if the back of the shell (dashed line) sits past the end of the 3" gauge, with no eggs under the tail.', W / 2, 92, { size: 17, align: 'center', color: '#cfe3ea', weight: 600, maxW: W - 60 });
    const lw = Math.min(W * 0.58, 640), lx = 24, ly = 112, lh = 300;
    panel(ctx, lx, ly, lw, lh, { r: 16, fill: 'rgba(20,90,120,0.95)' });
    const ppi = Math.min(72, (lw - 150) / Math.max(lob.cl, 3.3));
    const C = lob.cl * ppi, rearX = lx + 70, cy = ly + lh / 2 - 14, laneY = ly + lh - 32;
    const front = rearX + C, gaugeEnd = front - GAUGE_IN * ppi, gw = GAUGE_IN * ppi;
    const bg = ctx.createLinearGradient(0, laneY - 11, 0, laneY + 11); bg.addColorStop(0, '#f2d27a'); bg.addColorStop(1, '#b8892c');
    const drawGaugeLane = () => {
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; rr(ctx, gaugeEnd + 2, laneY - 8, gw, 22, 6); ctx.fill();
      ctx.fillStyle = bg; rr(ctx, gaugeEnd, laneY - 11, gw, 22, 6); ctx.fill();
      ctx.strokeStyle = '#6b4c12'; ctx.lineWidth = 1.5;
      for (let i = 0; i <= 12; i++) { const x = gaugeEnd + (i / 12) * gw; ctx.beginPath(); ctx.moveTo(x, laneY - 11); ctx.lineTo(x, laneY - 11 + (i % 4 ? 6 : 11)); ctx.stroke(); }
      ctx.fillStyle = '#4a3510'; ctx.fillRect(gaugeEnd - 2, laneY - 18, 4, 36); ctx.fillRect(front - 2, laneY - 18, 4, 36);
      ctx.strokeStyle = '#ffffff'; ctx.setLineDash([6, 5]); ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(rearX, cy - C * 0.36); ctx.lineTo(rearX, laneY + 20); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(front, cy); ctx.lineTo(front, laneY + 20); ctx.stroke(); ctx.setLineDash([]);
    };
    ctx.save(); rr(ctx, lx, ly, lw, lh, 16); ctx.clip();
    ctx.save(); ctx.translate(rearX, cy); drawLobsterTop(ctx, C, { t: this.t, gold: lob.gold }); ctx.restore();
    drawGaugeLane();
    text(ctx, '3" GAUGE', gaugeEnd + gw / 2, laneY + 5, { size: 13, align: 'center', color: '#3a2a0a', weight: 800 });
    ctx.restore();
    text(ctx, 'back of shell', rearX - 4, laneY + 34 > ly + lh ? laneY - 22 : laneY + 34, { size: 12, align: 'right', color: '#fff', weight: 800, alpha: 0.85 });
    // 4x magnifier on the back end of the gauge, where close calls are decided
    const zr = 64, zx = lx + lw - zr - 14, zy = ly + zr + 12, zs = 4;
    ctx.save(); ell(ctx, zx, zy, zr, zr); ctx.clip();
    ctx.fillStyle = '#1b6f92'; ctx.fillRect(zx - zr, zy - zr, zr * 2, zr * 2);
    ctx.translate(zx, zy); ctx.scale(zs, zs); ctx.translate(-gaugeEnd, -laneY);
    drawGaugeLane();
    ctx.restore();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ell(ctx, zx, zy, zr, zr); ctx.stroke();
    text(ctx, 'END OF GAUGE · 4× ZOOM', zx, zy + zr + 16, { size: 11, align: 'center', color: '#cfe3ea', weight: 800 });
    text(ctx, 'CARAPACE', lx + 16, ly + 26, { size: 15, color: '#cfe3ea', weight: 800 });
    // underside
    const rx = lx + lw + 16, rw = W - rx - 24;
    panel(ctx, rx, ly, rw, lh, { r: 16, fill: 'rgba(20,90,120,0.95)' });
    text(ctx, 'UNDER THE TAIL', rx + 16, ly + 26, { size: 15, color: '#cfe3ea', weight: 800 });
    ctx.save(); rr(ctx, rx, ly, rw, lh, 16); ctx.clip();
    const uc = Math.min(rw * 0.42, 110); ctx.translate(rx + rw * 0.72, ly + lh / 2 + 10); drawLobsterUnder(ctx, uc, lob.eggs, this.t);
    ctx.restore();
    const by = ly + lh + 22, bw = Math.min(220, (W - 72) / 2);
    UI.button(ctx, 'keep', W / 2 - bw - 12, by, bw, 58, 'KEEP IT', () => this.decide(true), { style: 'primary', size: 24, sub: 'Bag ' + this.bag.length + '/' + BH.BAG, key: 'KeyK' });
    UI.button(ctx, 'release', W / 2 + 12, by, bw, 58, 'LET IT GO', () => this.decide(false), { style: 'secondary', size: 24, sub: 'Back to the reef', key: 'KeyR' });
    if (!Game.touch) text(ctx, 'K to keep · R to release', W / 2, by + 84, { size: 14, align: 'center', color: '#9fb8c2', weight: 700 });
  }
}
const C_GLOVE = (C) => C.gloves || '#2a2d33';
