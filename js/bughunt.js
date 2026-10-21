'use strict';
/* Keys Crew — Bug Hunt. Free-dive the patch reef for spiny lobster.
   Tickle them out of their holes (let go when they twitch), net them when the ring turns green,
   then gauge every bug: carapace over 3", no eggs. Six per person.
   Now and then a shark shows up, and you race it back to the boat. */

const BH = { WW: 2900, SURF: 96, BAG: 6, BOATX: 660 };
const GAUGE_IN = 3.0;
const NET_R = 26; // the gold target ring

function rollCL(perks) {
  const r = Math.random();
  if (r < 0.3) return Math.round(rand(2.45, 2.97) * 100) / 100;
  if (r < 0.42) return Math.round(rand(2.95, 3.1) * 100) / 100;
  const big = chance(0.16 * ((perks && perks.trophy) || 1));
  return Math.round((3.1 + Math.pow(Math.random(), 1.7) * (big ? 2.9 : 1.6)) * 100) / 100;
}
const lobsterWeight = (cl) => Math.round(0.034 * Math.pow(cl, 2.9) * 10) / 10;

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
  miss: ['Tail-flipped you!', 'So close!']
};

class BugHuntScene extends SessionBase {
  constructor(o) {
    super(o);
    this.music = 'reef';
    this.resultHeader = 'FWC check at the ramp';
    this.diver = { x: 540, y: BH.SURF + 6, vx: 0, vy: 0, facing: 1, stun: 0 };
    this.maxBreath = 24 * this.perks.breath; this.breath = this.maxBreath;
    this.bag = []; this.out = null; this.gauge = null; this.blackout = 0; this.beatT = 0;
    this.joy = null; this.actionPtr = null; this.actionPress = false; this.cam = 0; this.goodReleases = 0;
    let others = (Trip.cur && Trip.cur.crew ? Trip.cur.crew : CHAR_ORDER).filter((c) => c !== this.ch).slice(0, 2);
    if (!others.length) others = CHAR_ORDER.filter((c) => c !== this.ch);
    this.others = others;
    this.quip = null; this.wasUnder = false; this.exhaleT = 2;
    this.coach = !Store.get('coach_bug_' + this.ch, false); this.coachNet = false;
    this.shark = null; this.sharkDone = false;
    this.sharkAt = o.shark === true ? 6 : o.shark === false ? null : chance(0.38) ? rand(this.len * 0.22, this.len * 0.62) : null;
    this.gen();
  }
  enter() {
    SFX.setAmbient(1, true); Music.play('reef');
    Game.toast('Bug Hunt', { color: PAL.coral, size: 46, y: 200, sub: 'Swim down, find antennae, tickle them out' });
    if (this.coach) Store.set('coach_bug_' + this.ch, true);
  }
  exit() { SFX.setAmbient(0); }
  baseFloor(x) { return 500 + 10 * Math.sin(x * 0.004) + 6 * Math.sin(x * 0.013 + 1); }
  groundAt(x) { for (const L of this.ledges) if (x >= L.x0 - 4 && x <= L.x1 + 4) return L.top; return this.baseFloor(x); }
  solid(x, y) { return y > this.groundAt(x) - 12; }
  elapsed() { return this.len - this.timeLeft; }
  gen() {
    this.ledges = []; let x = 620;
    while (x < BH.WW - 240) { const w = rand(150, 260), h = rand(62, 118); this.ledges.push({ x0: x, x1: x + w, h, seed: randi(1, 99999) }); x += w + rand(150, 260); }
    for (const L of this.ledges) {
      L.top = this.baseFloor((L.x0 + L.x1) / 2) - L.h;
      const rng = mulberry(L.seed); L.pts = [];
      L.pts.push([L.x0 - 2, this.baseFloor(L.x0) + 4], [L.x0 - 7, L.top + L.h * 0.55], [L.x0 + 4, L.top + 6]);
      for (let px = L.x0 + 20; px < L.x1 - 14; px += 18) L.pts.push([px, L.top - rng() * 9]);
      L.pts.push([L.x1 - 4, L.top + 6], [L.x1 + 7, L.top + L.h * 0.55], [L.x1 + 2, this.baseFloor(L.x1) + 4]);
      L.deco = [];
      for (let px = L.x0 + 14; px < L.x1 - 10; px += rand(22, 40)) L.deco.push({ x: px, kind: pick(['fan', 'brain', 'sponge', 'rod', 'rod', 'fan', 'urchin']), s: rand(0.7, 1.25), c: pick(['#8a4fb8', '#b85fa8', '#e07a3a', '#d9a441', '#7d5bd0']) });
    }
    this.dens = [];
    for (const L of this.ledges) {
      if (chance(0.88)) this.dens.push(this.makeDen(L.x0, this.baseFloor(L.x0) - rand(15, 24), -1));
      if (chance(0.88)) this.dens.push(this.makeDen(L.x1, this.baseFloor(L.x1) - rand(15, 24), 1));
      if (L.h > 88 && chance(0.55)) { const right = chance(0.5); this.dens.push(this.makeDen(right ? L.x1 : L.x0, L.top + rand(26, L.h - 48), right ? 1 : -1)); }
    }
    const order = this.dens.slice().sort(() => Math.random() - 0.5);
    order.forEach((d, i) => {
      if (i < 2) d.kind = 'moray';
      else if (i < order.length - 3) { d.kind = 'lobster'; d.extra = chance(0.3) ? 1 : 0; d.lob = this.makeLob(); }
      else d.kind = 'empty';
    });
    this.grass = []; for (let i = 0; i < 90; i++) this.grass.push({ x: rand(0, BH.WW), h: rand(10, 26), ph: rand(0, TAU) });
    this.jellies = []; for (let i = 0; i < 4; i++) this.jellies.push({ x: rand(700, BH.WW - 100), y: rand(170, 360), ph: rand(0, TAU), hit: 0 });
    this.schools = []; for (let i = 0; i < 4; i++) { const L = pick(this.ledges); const fish = []; for (let k = 0; k < randi(6, 10); k++) fish.push({ ox: rand(-50, 50), oy: rand(-26, 26), ph: rand(0, TAU) }); this.schools.push({ x: (L.x0 + L.x1) / 2, y: L.top - 40, cx: (L.x0 + L.x1) / 2, cy: L.top - 40, ph: rand(0, TAU), fish, kind: i % 2 ? 'tang' : 'sgt' }); }
    this.cuda = { x: rand(900, 2000), y: 230, dir: 1 };
    // the rest of the neighborhood
    this.turtle = { x: rand(1000, 2200), y: rand(190, 280), dir: chance(0.5) ? 1 : -1, t: rand(0, 5) };
    this.ray = { x: -300, y: rand(150, 230), t: 0, wait: rand(6, 14), on: false };
    this.critters = [];
    for (let i = 0; i < 5; i++) { const L = pick(this.ledges), key = i < 3 ? 'parrot' : 'angel'; this.critters.push({ key, cx: (L.x0 + L.x1) / 2, x: (L.x0 + L.x1) / 2 + rand(-60, 60), y: L.top - rand(18, 60), vx: rand(16, 30) * (chance(0.5) ? 1 : -1), range: (L.x1 - L.x0) / 2 + 40, t: rand(0, 5), nib: 0, len: key === 'parrot' ? rand(34, 46) : rand(26, 32) }); }
    this.crabs = []; for (let i = 0; i < 6; i++) { const cx = rand(200, BH.WW - 200); this.crabs.push({ x: cx, dir: chance(0.5) ? 1 : -1, t: rand(0, 5), pause: rand(0, 2), flee: 0 }); }
    this.sandDeco = []; for (let i = 0; i < 26; i++) this.sandDeco.push({ x: rand(100, BH.WW - 100), kind: i % 3 ? 'star' : 'urchin', r: rand(5, 9), c: pick(['#e8742c', '#d9532f', '#f0a23a', '#c8467a']) });
    const gapL = this.ledges.find((L, i) => i > 0 && i < this.ledges.length - 1) || this.ledges[0];
    this.nurse = { x: gapL.x1 + 82, y: this.baseFloor(gapL.x1 + 82) - 8, dir: -1, t: 0, zT: 1, move: 0 };
    const oL = this.ledges[Math.min(this.ledges.length - 1, 3)];
    this.octo = { x: (oL.x0 + oL.x1) / 2 + rand(-30, 30), y: oL.top - 8, state: 'hide', t: 0, vx: 0, vy: 0, a: 1 };
    this.snow = []; for (let i = 0; i < 70; i++) this.snow.push({ x: rand(0, 1400), y: rand(BH.SURF, 540), r: rand(0.6, 1.8), vy: rand(3, 9), ph: rand(0, TAU) });
    this.fg = []; for (let x = 0; x < BH.WW * 1.4; x += rand(240, 420)) this.fg.push({ x, kind: pick(['fan', 'rock', 'grass', 'grass']), s: rand(0.8, 1.4) });
  }
  makeDen(x, y, dir) { return { x, y, dir, kind: 'empty', coax: 0, spooks: 0, twitch: 0, nextTwitch: rand(0.9, 1.8), badHold: 0, state: 'in', peek: 0, peekT: rand(2, 5), lob: null, extra: 0 }; }
  makeLob() { const cl = rollCL(this.perks); return { cl, w: lobsterWeight(cl), eggs: cl > 3.0 && chance(0.14), gold: cl > 3.0 && chance(0.04 * this.perks.trophy) }; }
  say(kind, p = 1) {
    if (!chance(p) || !QUIPS[kind]) return;
    this.quip = { who: pick(this.others), msg: pick(QUIPS[kind]), t: 2.8 };
  }

  /* ---------- input ---------- */
  actionZone() { return { x: Game.W - 96, y: Game.H - 96, r: 66 }; }
  inAction(x, y) { const a = this.actionZone(); return dist(x, y, a.x, a.y) < a.r + 8; }
  pointerDown(p) {
    if (this.basePointerDown(p) || this.gauge || this.blackout > 0) return;
    if (this.inAction(p.x, p.y)) { this.actionPtr = p.id; this.actionPress = true; return; }
    if (this.out && this.out.state === 'ring' && dist(p.x, p.y, this.out.x - this.cam, this.out.y) < 85) { this.actionPress = true; return; }
    if (!this.joy && p.y > 64) this.joy = { id: p.id, sx: p.x, sy: p.y, x: p.x, y: p.y };
  }
  pointerMove(p) { if (this.joy && this.joy.id === p.id) { this.joy.x = p.x; this.joy.y = p.y; } }
  pointerUp(p) { if (this.joy && this.joy.id === p.id) this.joy = null; if (this.actionPtr === p.id) this.actionPtr = null; }
  keyDown(c) { if (this.baseKeyDown(c) || this.gauge) return; if (c === 'Space' || c === 'KeyE') this.actionPress = true; }
  actionHeld() { return this.actionPtr != null || Input.held('Space', 'KeyE'); }

  /* ---------- update ---------- */
  update(dt) {
    if (this.gauge) { this.gauge.t += dt; this.t += dt; Game.toasts = []; return; }
    if (this.baseUpdate(dt)) return;
    const d = this.diver, t = this.t;
    if (this.quip) { this.quip.t -= dt; if (this.quip.t <= 0) this.quip = null; }
    this.updateScenery(dt, d, t);
    if (this.blackout > 0) {
      this.blackout -= dt; d.y = approach(d.y, BH.SURF + 4, 1.5, dt);
      if (this.blackout <= 0) { d.y = BH.SURF + 4; this.breath = this.maxBreath * 0.5; this.timeLeft = Math.max(0, this.timeLeft - 6); Game.toast('Your buddy pulled you up', { color: '#fff', size: 30, y: 160, sub: 'Never push a breath-hold. Always dive with a buddy. (−6 sec)' }); this.say('blackout'); }
      return;
    }
    // movement input
    let ix = 0, iy = 0;
    if (Input.held('ArrowLeft', 'KeyA')) ix -= 1; if (Input.held('ArrowRight', 'KeyD')) ix += 1;
    if (Input.held('ArrowUp', 'KeyW')) iy -= 1; if (Input.held('ArrowDown', 'KeyS')) iy += 1;
    if (this.joy) { const jx = (this.joy.x - this.joy.sx) / 55, jy = (this.joy.y - this.joy.sy) / 55; const m = Math.hypot(jx, jy); if (m > 0.12) { ix = jx / Math.max(1, m); iy = jy / Math.max(1, m); } }
    const im = Math.hypot(ix, iy); if (im > 1) { ix /= im; iy /= im; }
    const stunned = d.stun > 0; if (stunned) { d.stun -= dt; ix = 0; iy = 0; }
    const under = d.y > BH.SURF + 14;
    const sp = this.shark && this.shark.state === 'hunt' ? 176 : 168;
    d.vx = approach(d.vx, ix * sp, 4, dt);
    d.vy = approach(d.vy, iy * sp + (iy === 0 ? -16 : 0), 4, dt);
    if (Math.abs(ix) > 0.1) d.facing = ix > 0 ? 1 : -1;
    const drift = under ? -this.weather.drift * 16 : 0;
    let nx = d.x + (d.vx + drift) * dt, ny = d.y + d.vy * dt;
    nx = clamp(nx, 30, BH.WW - 30);
    if (this.solid(nx + d.facing * 28, d.y) || this.solid(nx, d.y)) { nx = d.x; d.vx = 0; }
    ny = clamp(ny, BH.SURF + 2, 600);
    if (this.solid(nx, ny)) { ny = this.groundAt(nx) - 12; d.vy = Math.min(0, d.vy); }
    d.x = nx; d.y = ny;
    this.cam = approach(this.cam, clamp(d.x - Game.W * 0.45, 0, BH.WW - Game.W), 6, dt);
    // breathing, bubbles and splashes
    if (under && !this.wasUnder) { this.parts.burst(d.x, BH.SURF + 4, 14, { color: ['#ffffff', '#cfefff'], angle: -Math.PI / 2, spread: 0.9, min: 60, max: 160, g: 400, life: 0.7 }); SFX.play('plop'); }
    if (!under && this.wasUnder) { this.parts.burst(d.x + d.facing * 16, BH.SURF - 18, 10, { color: ['#ffffff', '#dff6ff'], angle: -Math.PI / 2, spread: 0.4, min: 80, max: 190, g: 500, life: 0.6 }); SFX.noise(0.25, { filter: 'bandpass', f: 1800, vol: 0.12 }); }
    this.wasUnder = under;
    if (under) {
      this.breath -= dt; this.exhaleT -= dt;
      if (this.exhaleT <= 0) { this.exhaleT = rand(2, 2.8); for (let i = 0; i < 5; i++) this.parts.add({ kind: 'bubble', x: d.x + d.facing * 30 + rand(-3, 3), y: d.y - 10, vy: -rand(40, 80), vx: rand(-10, 10), life: 2, size: rand(1.8, 4) }); if (chance(0.5)) SFX.play('bubble'); }
      if (Math.hypot(d.vx, d.vy) > 120 && chance(dt * 8)) this.parts.add({ kind: 'bubble', x: d.x - d.facing * 70, y: d.y + rand(-4, 4), vy: -30, vx: -d.facing * 20, life: 1, size: rand(1, 2.2) });
    } else this.breath = Math.min(this.maxBreath, this.breath + dt * 9);
    if (this.breath < this.maxBreath * 0.28 && under) { this.beatT -= dt; if (this.beatT <= 0) { this.beatT = 0.75; SFX.tone(60, 0.12, { vol: 0.25 }); } }
    if (this.breath <= 0) { this.blackout = 2.2; this.breath = 0; if (this.out) this.lobsterFlees(); SFX.play('fail'); return; }
    for (const j of this.jellies) if (!j.hit && dist(j.x, j.y, d.x + d.facing * 10, d.y) < 26) { j.hit = 2; d.stun = 0.7; this.breath -= 3; Game.toast('Jellyfish sting!', { color: '#ff9fd6', size: 30, y: 130 }); SFX.play('sting'); Game.shake(4); this.say('jelly', 0.6); }
    // the shark
    if (!this.shark && !this.sharkDone && this.sharkAt != null && this.elapsed() >= this.sharkAt && d.y > BH.SURF + 80 && Math.abs(d.x - BH.BOATX) > 420 && !this.out) this.startShark();
    if (this.shark) this.updateShark(dt);
    const chased = this.shark && this.shark.state === 'hunt';
    // dens
    const hx = d.x + d.facing * 46, hy = d.y + 2;
    let target = null, best = 52;
    for (const den of this.dens) {
      if (den.kind === 'moray') { den.peekT -= dt; if (den.peekT <= 0) { den.peek = 1.4; den.peekT = rand(3, 6); } den.peek = Math.max(0, den.peek - dt); }
      const dd = dist(hx, hy, den.x + den.dir * 8, den.y);
      if (!chased && dd < best && d.facing === -den.dir && den.state === 'in' && den.kind !== 'empty') { best = dd; target = den; }
    }
    this.target = target;
    const held = this.actionHeld() && !stunned;
    this.tickling = false;
    if (target && target.kind === 'moray' && held) {
      target.peek = 1.5; d.stun = 0.9; this.breath -= 4; Game.toast('MORAY! Wrong hole.', { color: PAL.bad, size: 34, y: 130 }); SFX.play('chomp'); Game.shake(7); Game.vibrate(120); this.say('moray');
      this.parts.burst(target.x, target.y, 10, { color: 'rgba(255,255,255,0.7)', kind: 'bubble', min: 20, max: 60, life: 1 });
    } else if (target && target.kind === 'lobster' && held && !this.out) {
      this.tickling = true;
      if (chance(dt * 18)) SFX.play('tickle');
      if (target.twitch > 0) { target.badHold += dt; if (target.badHold > 0.16) this.spook(target); }
      else target.coax += dt * 0.42 * this.perks.coax;
      target.nextTwitch -= dt;
      if (target.nextTwitch <= 0 && target.twitch <= 0) { target.twitch = 0.6; target.badHold = 0; target.nextTwitch = rand(0.8, 1.9); SFX.tone(300, 0.06, { type: 'square', vol: 0.05 }); }
      if (target.coax >= 1) this.emerge(target);
    }
    for (const den of this.dens) if (den.twitch > 0) den.twitch -= dt;
    // the lobster in the open
    if (this.out) this.updateOut(dt, d);
    if (this.actionPress) {
      this.actionPress = false;
      if (this.out && this.out.state === 'ring' && dist(this.out.x, this.out.y, d.x, d.y) < 150) this.tryNet();
      else if (!target) this.parts.burst(hx, hy, 4, { kind: 'bubble', min: 10, max: 40, life: 0.8 });
    }
  }
  updateScenery(dt, d, t) {
    for (const j of this.jellies) { j.ph += dt; j.x += Math.sin(j.ph * 0.3) * 10 * dt - this.weather.drift * 6 * dt; j.y += Math.sin(j.ph * 0.9) * 8 * dt; j.hit = Math.max(0, j.hit - dt); }
    this.cuda.x += this.cuda.dir * 26 * dt; if (this.cuda.x > BH.WW - 200 || this.cuda.x < 300) this.cuda.dir *= -1;
    for (const s of this.schools) { s.ph += dt * 0.5; s.x = s.cx + Math.cos(s.ph) * 70; s.y = s.cy + Math.sin(s.ph * 1.3) * 18; if (dist(s.x, s.y, d.x, d.y) < 70) s.x += (s.x - d.x) * 0.6; }
    const tu = this.turtle; tu.t += dt; tu.x += tu.dir * 26 * dt; tu.y += Math.sin(tu.t * 0.5) * 6 * dt; if (tu.x < 200 || tu.x > BH.WW - 200) tu.dir *= -1;
    const ry = this.ray; if (!ry.on) { ry.wait -= dt; if (ry.wait <= 0) { ry.on = true; ry.x = -200; ry.y = rand(150, 240); } } else { ry.t += dt; ry.x += 55 * dt; if (ry.x > Game.W + 260) { ry.on = false; ry.wait = rand(12, 22); } }
    for (const c of this.critters) {
      c.t += dt;
      const near = dist(c.x, c.y, d.x, d.y) < 90;
      if (c.nib > 0) { c.nib -= dt; if (chance(dt * 6)) this.parts.add({ x: c.x + Math.sign(c.vx) * c.len * 0.5, y: c.y + 4, vx: rand(-10, 10), vy: rand(10, 30), life: 0.7, size: 1.5, color: 'rgba(255,255,240,0.8)' }); }
      else { c.x += c.vx * (near ? 3 : 1) * dt; if (Math.abs(c.x - c.cx) > c.range) { c.vx = -Math.sign(c.x - c.cx) * Math.abs(c.vx); } if (c.key === 'parrot' && chance(dt * 0.15)) c.nib = 1.4; }
      c.y += Math.sin(c.t * 1.3) * 4 * dt;
    }
    for (const c of this.crabs) {
      c.t += dt; const near = Math.abs(c.x - d.x) < 90 && d.y > 380;
      if (near) { c.flee = 0.8; c.dir = c.x > d.x ? 1 : -1; }
      if (c.flee > 0) { c.flee -= dt; c.x += c.dir * 120 * dt; }
      else if (c.pause > 0) c.pause -= dt;
      else { c.x += c.dir * 24 * dt; if (chance(dt * 0.4)) { c.pause = rand(0.5, 2); if (chance(0.4)) c.dir *= -1; } }
      c.x = clamp(c.x, 40, BH.WW - 40); if (this.groundAt(c.x) < this.baseFloor(c.x) - 2) { c.dir *= -1; c.x += c.dir * 6; }
    }
    const n = this.nurse; n.t += dt; n.zT -= dt;
    if (n.zT <= 0) { n.zT = 1.6; this.parts.add({ kind: 'bubble', x: n.x + n.dir * 50, y: n.y - 10, vy: -26, vx: rand(-4, 4), life: 2.2, size: 2.5 }); }
    if (n.move <= 0 && dist(n.x, n.y, d.x, d.y) < 70) { n.move = 2.2; n.dir *= -1; this.fl.add(n.x - this.cam, n.y - 40, 'zzz… huh?', '#ffffff', 16); }
    if (n.move > 0) { n.move -= dt; n.x += n.dir * 60 * dt; }
    const o = this.octo; o.t += dt;
    if (o.state === 'hide' && dist(o.x, o.y, d.x, d.y) < 95) {
      o.state = 'flee'; o.vx = (o.x > d.x ? 1 : -1) * 230; o.vy = -150; SFX.noise(0.4, { filter: 'lowpass', f: 600, vol: 0.2 });
      for (let i = 0; i < 26; i++) this.parts.add({ x: o.x + rand(-10, 10), y: o.y + rand(-10, 10), vx: rand(-40, 40), vy: rand(-30, 30), drag: 1.5, life: rand(1.6, 2.6), size: rand(8, 16), color: 'rgba(18,14,30,0.55)' });
      this.fl.add(o.x - this.cam, o.y - 40, 'INKED!', '#c9b8ff', 22); this.say('octo', 0.6);
    }
    if (o.state === 'flee') { o.x += o.vx * dt; o.y += o.vy * dt; o.vx *= 1 - dt * 0.8; o.vy *= 1 - dt * 0.8; o.a -= dt * 0.5; if (o.a <= 0) o.state = 'gone'; }
    for (const p of this.snow) { p.y += p.vy * dt; p.ph += dt; if (p.y > 545) { p.y = BH.SURF + 2; p.x = rand(0, 1400); } }
  }

  /* ---------- the shark ---------- */
  startShark() {
    const d = this.diver, boatDir = Math.sign(BH.BOATX - d.x) || 1;
    this.shark = { x: clamp(d.x - boatDir * (Game.W * 0.62 + 60), -260, BH.WW + 260), y: clamp(d.y + rand(-50, 30), BH.SURF + 60, 430), ang: boatDir > 0 ? 0 : Math.PI, t: 0, lunge: 0, nextLunge: 3, mouth: 0, state: 'hunt', leaveT: 0 };
    this.target = null;
    Music.play('shark'); SFX.play('warn'); Game.shake(6, 0.5); Game.vibrate([60, 60, 60]);
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
      s.x += Math.cos(s.ang) * 240 * dt; s.y = approach(s.y, 330, 1, dt); s.leaveT += dt; s.mouth = approach(s.mouth, 0, 4, dt);
      if (s.leaveT > 4.5) { this.shark = null; Music.play('reef'); }
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
    if (den.spooks >= 3) { den.state = 'gone'; Game.toast('It backed in deep', { color: PAL.warn, size: 30, y: 130, sub: 'That bug is gone. Try another hole.' }); }
    else Game.toast('Easy! It backed in.', { color: PAL.warn, size: 30, y: 130, sub: 'Let go of TICKLE when the antennae twitch' });
  }
  emerge(den) {
    const lob = den.lob;
    this.out = { x: den.x + den.dir * 6, y: den.y, tx: den.x + den.dir * 52, ty: this.baseFloor(den.x + den.dir * 52) - 9, dir: den.dir, lob, state: 'walk', t: 0, ringT: 0, ringDur: 1.4, misses: 0, vx: 0 };
    if (den.extra > 0) { den.extra--; den.coax = 0; den.spooks = 0; den.lob = this.makeLob(); }
    else { den.state = 'empty'; den.kind = 'empty'; }
    Game.toast(lob.gold ? 'A GOLDEN BUG!' : 'It’s out!', { color: lob.gold ? PAL.sun : PAL.good, size: 34, y: 130, sub: 'Tap NET (or the bug) when the ring turns green' });
    if (lob.gold) this.say('gold');
    if (this.coach) this.coachNet = true;
    SFX.play('coin');
  }
  updateOut(dt, d) {
    const o = this.out; o.t += dt;
    if (o.state === 'walk') { o.x = approach(o.x, o.tx, 4, dt); o.y = approach(o.y, o.ty, 4, dt); if (Math.abs(o.x - o.tx) < 3) { o.state = 'ring'; o.ringT = 0; } }
    else if (o.state === 'ring') {
      if (dist(o.x, o.y, d.x, d.y) < 150) { const was = this.inNetZone(); o.ringT += dt; if (!was && this.inNetZone()) SFX.tone(1200, 0.06, { type: 'triangle', vol: 0.06 }); if (o.ringT > o.ringDur + 0.12) this.bolt(); }
      else o.ringT = Math.max(0, o.ringT - dt);
    } else if (o.state === 'bolt') {
      o.x += o.vx * dt; o.vx *= 1 - Math.min(1, dt * 3.2); o.t2 -= dt;
      const gy = this.groundAt(o.x); if (gy < o.y + 4) { o.x -= o.vx * dt; o.vx = 0; }
      o.y = approach(o.y, this.baseFloor(o.x) - 9, 5, dt);
      if (chance(0.5)) this.parts.add({ x: o.x, y: o.y + 6, vx: rand(-20, 20), vy: -rand(5, 25), life: 0.8, size: rand(2, 4), color: 'rgba(225,205,150,0.7)' });
      if (o.t2 <= 0) { o.state = 'ring'; o.ringT = 0; o.ringDur = Math.max(0.95, o.ringDur * 0.88); }
    }
  }
  netTol() { return 10 * this.perks.window; }
  ringRadius() { const o = this.out; return lerp(84, 10, clamp(o.ringT / o.ringDur, 0, 1)); }
  inNetZone() { return this.out && this.out.state === 'ring' && Math.abs(this.ringRadius() - NET_R) <= this.netTol(); }
  tryNet() {
    const r = this.ringRadius();
    if (Math.abs(r - NET_R) <= this.netTol()) {
      const perfect = Math.abs(r - NET_R) <= 3;
      SFX.play('net'); Game.vibrate(40);
      this.parts.burst(this.out.x, this.out.y, 18, { kind: 'bubble', min: 30, max: 120, life: 1.1 });
      if (perfect) { this.addLine('Perfect net', 25); this.fl.add(this.out.x - this.cam, this.out.y - 40, 'PERFECT +25', PAL.sun, 22); }
      this.gauge = { lob: this.out.lob, t: 0 }; Game.toasts = [];
      this.out = null; this.coachNet = false; this.coach = false;
    } else this.bolt(r > NET_R ? 'early' : 'late');
  }
  bolt(why) {
    const o = this.out, d = this.diver;
    o.misses++;
    if (o.misses >= 3) { this.lobsterFlees(); return; }
    o.state = 'bolt'; o.t2 = 0.6; o.vx = (Math.sign(o.x - d.x) || 1) * 430;
    SFX.play('splash');
    Game.toast(why === 'early' ? 'Too early! It bolted' : why === 'late' ? 'Too late! It bolted' : 'Missed! It tail-flipped away', { color: PAL.warn, size: 28, y: 130, sub: 'Swim after it. Tap when the ring is GREEN.' });
    this.say('miss', 0.4);
    this.parts.burst(o.x, o.y + 4, 14, { color: 'rgba(225,205,150,0.8)', min: 20, max: 90, life: 0.9, angle: -Math.PI / 2, spread: 1.4 });
  }
  lobsterFlees() {
    const o = this.out; if (!o) return;
    let best = null, bd = 1e9;
    for (const den of this.dens) { if (den.kind !== 'empty' || den.state === 'gone') continue; const dd = Math.abs(den.x - o.x); if (dd < bd) { bd = dd; best = den; } }
    if (best && bd < 600) { best.kind = 'lobster'; best.lob = o.lob; best.coax = 0.15; best.spooks = 1; best.state = 'in'; best.extra = 0; }
    this.out = null; Game.toast('It got back into the rocks', { color: PAL.warn, size: 28, y: 130 });
  }
  decide(keep) {
    const lob = this.gauge.lob; this.gauge = null;
    const legal = lob.cl > GAUGE_IN && !lob.eggs;
    if (keep) {
      this.bag.push(lob); SFX.play('coin');
      this.fl.add(this.diver.x - this.cam, this.diver.y - 50, 'In the bag ' + this.bag.length + '/' + BH.BAG, '#fff', 22);
      if (legal) { this.score += Math.round(lob.w * 100) * (lob.gold ? 3 : 1); this.say(lob.cl >= 4.4 ? 'big' : 'nice', lob.cl >= 4.4 ? 1 : 0.6); }
      else this.say('short', 0.75);
      if (this.bag.length >= BH.BAG) this.end('limit');
    } else {
      this.parts.burst(this.diver.x + this.diver.facing * 40, this.diver.y, 10, { kind: 'bubble', min: 20, max: 80, life: 1 });
      if (!legal) { this.goodReleases++; this.addLine(lob.eggs ? 'Released an egg-bearing female' : 'Released a short (' + lob.cl.toFixed(2) + '")', 25); this.fl.add(this.diver.x - this.cam, this.diver.y - 50, 'Good call +25', PAL.good, 22); SFX.play('coin'); }
      else this.fl.add(this.diver.x - this.cam, this.diver.y - 50, 'Let a keeper go', '#cfe3ea', 20);
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
        const c = makeCatch('lobster', lob.w, this.ch, 'bughunt', extras); c.cl = lob.cl; c.gold = !!lob.gold; catches.push(c);
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
  draw(ctx) {
    if (this.drawChildOrNull(ctx)) return;
    const W = Game.W, H = Game.H, t = this.t, cam = this.cam, d = this.diver;
    drawSky(ctx, W, BH.SURF, 'day');
    drawSun(ctx, W * 0.85, 40, 16);
    drawCloud(ctx, ((200 - cam * 0.1) % (W + 200) + W + 200) % (W + 200) - 100, 34, 0.6, 0.9);
    drawCloud(ctx, ((700 - cam * 0.1) % (W + 200) + W + 200) % (W + 200) - 100, 52, 0.45, 0.8);
    const vis = this.weather.vis;
    const g = ctx.createLinearGradient(0, BH.SURF, 0, H);
    g.addColorStop(0, vis > 1.1 ? '#47cbdc' : '#38b5ce'); g.addColorStop(0.45, '#1a8cb0'); g.addColorStop(1, '#0a4f6e');
    ctx.fillStyle = g; ctx.fillRect(0, BH.SURF, W, H - BH.SURF);
    // light just under the surface
    const sg0 = ctx.createLinearGradient(0, BH.SURF, 0, BH.SURF + 70); sg0.addColorStop(0, 'rgba(210,250,255,0.35)'); sg0.addColorStop(1, 'rgba(210,250,255,0)');
    ctx.fillStyle = sg0; ctx.fillRect(0, BH.SURF, W, 70);
    ctx.strokeStyle = 'rgba(230,255,255,0.22)'; ctx.lineWidth = 1.5;
    for (let k = 0; k < 3; k++) { ctx.beginPath(); for (let x = 0; x <= W; x += 14) { const yy = BH.SURF + 8 + k * 9 + Math.sin(x * 0.045 + t * (1.6 + k * 0.4) + k) * 2.5; x ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); } ctx.stroke(); }
    // farthest layer: hazy reef and the odd eagle ray
    ctx.fillStyle = 'rgba(30,110,140,0.35)'; ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W + 20; x += 24) { const wx = x + cam * 0.2; ctx.lineTo(x, 380 - 34 * Math.abs(Math.sin(wx * 0.004)) - 22 * Math.sin(wx * 0.011)); }
    ctx.lineTo(W, H); ctx.fill();
    if (this.ray.on) { ctx.save(); ctx.translate(this.ray.x, this.ray.y + Math.sin(this.ray.t * 0.8) * 10); drawEagleRay(ctx, 62, this.ray.t, 0.55); ctx.restore(); }
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    for (let i = 0; i < 7; i++) { const bx = ((i * 260 - cam * 0.3) % (W + 300) + W + 300) % (W + 300) - 150; ctx.beginPath(); ctx.moveTo(bx, BH.SURF); ctx.lineTo(bx + 50, BH.SURF); ctx.lineTo(bx - 70 + Math.sin(t * 0.7 + i) * 18, H); ctx.lineTo(bx - 150 + Math.sin(t * 0.7 + i) * 18, H); ctx.fill(); }
    ctx.fillStyle = 'rgba(10,70,95,0.55)'; ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W + 20; x += 20) { const wx = x + cam * 0.5; ctx.lineTo(x, 420 - 30 * Math.abs(Math.sin(wx * 0.006)) - 18 * Math.sin(wx * 0.017)); }
    ctx.lineTo(W, H); ctx.fill();
    ctx.save(); ctx.translate(-cam, 0);
    drawBoatSide(ctx, BH.BOATX, BH.SURF + 8, 0.42, { crew: this.others, flag: true, t });
    // sand, caustics, grass
    const sg = ctx.createLinearGradient(0, 470, 0, H); sg.addColorStop(0, '#dcc994'); sg.addColorStop(1, '#a8955f');
    ctx.fillStyle = sg; ctx.beginPath(); ctx.moveTo(cam - 10, H);
    for (let x = cam - 10; x <= cam + W + 20; x += 16) ctx.lineTo(x, this.baseFloor(x)); ctx.lineTo(cam + W + 20, H); ctx.fill();
    ctx.lineWidth = 2; ctx.lineCap = 'round';
    for (let x = Math.floor((cam - 20) / 22) * 22; x < cam + W + 20; x += 22) {
      const a = 0.1 + 0.12 * Math.sin(x * 0.07 + t * 2.1) * Math.sin(x * 0.031 - t * 1.4);
      if (a <= 0.03) continue; const y = this.groundAt(x) + 6 + (x * 7) % 14;
      ctx.strokeStyle = `rgba(255,255,220,${a})`; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 9, y - 4 + Math.sin(t * 2 + x) * 2, x + 18, y + 1); ctx.stroke();
    }
    ctx.strokeStyle = '#4f8a46'; ctx.lineWidth = 2.5;
    for (const gr of this.grass) { if (gr.x < cam - 20 || gr.x > cam + W + 20) continue; const by = this.baseFloor(gr.x) + 4; ctx.beginPath(); ctx.moveTo(gr.x, by); ctx.quadraticCurveTo(gr.x + Math.sin(t * 1.4 + gr.ph) * 6, by - gr.h * 0.6, gr.x + Math.sin(t * 1.4 + gr.ph) * 10, by - gr.h); ctx.stroke(); }
    for (const s of this.sandDeco) { if (s.x < cam - 30 || s.x > cam + W + 30 || this.groundAt(s.x) < this.baseFloor(s.x) - 2) continue; ctx.save(); ctx.translate(s.x, this.baseFloor(s.x) + 6); if (s.kind === 'star') drawStarfish(ctx, s.r, s.c); else drawUrchin(ctx, s.r * 0.7, t); ctx.restore(); }
    const n = this.nurse; if (n.x > cam - 120 && n.x < cam + W + 120) { ctx.save(); ctx.translate(n.x, n.y); if (n.dir < 0) ctx.scale(-1, 1); drawShark(ctx, 130, { kind: 'nurse', t: n.t, speed: n.move > 0 ? 6 : 1.2 }); ctx.restore(); }
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
    for (const s of this.schools) for (const f of s.fish) {
      const fx = s.x + f.ox + Math.sin(t * 2 + f.ph) * 4, fy = s.y + f.oy;
      ctx.save(); ctx.translate(fx, fy); if (Math.cos(s.ph) < 0) ctx.scale(-1, 1);
      ctx.fillStyle = s.kind === 'tang' ? '#2b62d6' : '#e2d867'; ell(ctx, 0, 0, 7, 4); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(-11, -4); ctx.lineTo(-11, 4); ctx.fill();
      if (s.kind === 'sgt') { ctx.fillStyle = '#222'; ctx.fillRect(-3, -4, 1.4, 8); ctx.fillRect(1, -4, 1.4, 8); }
      ctx.restore();
    }
    ctx.save(); ctx.translate(this.cuda.x, this.cuda.y + Math.sin(t * 0.6) * 10); drawFish(ctx, 'barracuda', 120, { t, flip: this.cuda.dir < 0, wig: 0.4, alpha: 0.85 }); ctx.restore();
    const tu = this.turtle; if (tu.x > cam - 100 && tu.x < cam + W + 100) { ctx.save(); ctx.translate(tu.x, tu.y); if (tu.dir < 0) ctx.scale(-1, 1); drawTurtle(ctx, 64, tu.t); ctx.restore(); }
    for (const j of this.jellies) this.drawJelly(ctx, j, t);
    if (this.out) this.drawOut(ctx, t);
    const moving = Math.hypot(d.vx, d.vy) / 168;
    drawDiver(ctx, this.ch, d.x, d.y, 0.95, { t, facing: d.facing, kick: moving, tickle: this.tickling, tilt: clamp(d.vy / 400, -0.35, 0.35) * d.facing });
    if (this.shark) this.drawSharkSprite(ctx);
    this.parts.draw(ctx);
    ctx.restore();
    // drifting specks and the near-side reef, both on their own parallax
    ctx.fillStyle = 'rgba(235,250,255,0.5)';
    for (const p of this.snow) { const x = (((p.x - cam * 0.6) % (W + 40)) + W + 40) % (W + 40) - 20; ell(ctx, x + Math.sin(p.ph) * 4, p.y, p.r, p.r); ctx.fill(); }
    for (const f of this.fg) {
      const x = f.x - cam * 1.35; if (x < -140 || x > W + 140) continue;
      ctx.save(); ctx.translate(x, H + 6); ctx.scale(f.s * 0.62, f.s * 0.62); ctx.globalAlpha = 0.6; ctx.fillStyle = 'rgba(4,34,46,0.88)';
      if (f.kind === 'rock') { ctx.beginPath(); ctx.moveTo(-90, 0); ctx.quadraticCurveTo(-70, -60, -10, -66); ctx.quadraticCurveTo(50, -70, 80, 0); ctx.fill(); }
      else if (f.kind === 'fan') { ctx.rotate(Math.sin(t * 0.9 + f.x) * 0.06); ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-60, -50, -34, -110); ctx.quadraticCurveTo(0, -130, 34, -110); ctx.quadraticCurveTo(60, -50, 0, 0); ctx.fill(); }
      else { ctx.strokeStyle = 'rgba(4,34,46,0.88)'; ctx.lineWidth = 6; ctx.lineCap = 'round'; for (let k = -3; k <= 3; k++) { const sw = Math.sin(t * 1.2 + k + f.x) * 10; ctx.beginPath(); ctx.moveTo(k * 8, 0); ctx.quadraticCurveTo(k * 8 + sw * 0.5, -40, k * 10 + sw, -70 - (k % 2) * 16); ctx.stroke(); } }
      ctx.restore();
    }
    drawWaterline(ctx, W, BH.SURF, t, 'rgba(255,255,255,0.7)', 2.5);
    if (vis < 1) { ctx.fillStyle = 'rgba(40,90,90,0.18)'; ctx.fillRect(0, BH.SURF, W, H - BH.SURF); }
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
  drawSharkSprite(ctx) {
    const s = this.shark;
    ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.ang); if (Math.cos(s.ang) < 0) ctx.scale(1, -1);
    drawShark(ctx, 190, { t: s.t, mouth: s.mouth, speed: s.lunge > 0 ? 12 : 5 });
    ctx.restore();
  }
  drawChaseMarkers(ctx, W, H, t) {
    const bx = BH.BOATX - this.cam;
    const pulse = 1 + Math.sin(t * 8) * 0.08;
    if (bx < 30 || bx > W - 30) {
      const left = bx < 30, x = left ? 46 : W - 46, y = 150;
      ctx.save(); ctx.translate(x, y); ctx.scale(pulse, pulse);
      ctx.fillStyle = PAL.good; ctx.beginPath(); if (left) { ctx.moveTo(-26, 0); ctx.lineTo(10, -22); ctx.lineTo(10, 22); } else { ctx.moveTo(26, 0); ctx.lineTo(-10, -22); ctx.lineTo(-10, 22); } ctx.closePath(); ctx.fill();
      ctx.restore();
      text(ctx, 'BOAT', x, y + 40, { size: 18, align: 'center', color: '#fff', weight: 800, stroke: 'rgba(0,0,0,0.6)', sw: 4 });
    } else {
      ctx.save(); ctx.translate(bx, BH.SURF + 46 + Math.sin(t * 6) * 6);
      ctx.fillStyle = PAL.good; ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(-16, 4); ctx.lineTo(16, 4); ctx.closePath(); ctx.fill(); ctx.restore();
      text(ctx, 'CLIMB OUT HERE', bx, BH.SURF + 78, { size: 16, align: 'center', color: '#fff', weight: 800, stroke: 'rgba(0,0,0,0.6)', sw: 4 });
    }
    const sx = this.shark.x - this.cam;
    if (sx < -40 || sx > W + 40) { const left = sx < 0; text(ctx, '🦈', left ? 30 : W - 30, clamp(this.shark.y, 120, H - 40), { size: 30, align: 'center', base: 'middle', alpha: 0.6 + 0.4 * Math.sin(t * 10) }); }
  }
  drawLedge(ctx, L, t) {
    const g = ctx.createLinearGradient(0, L.top, 0, L.top + L.h); g.addColorStop(0, '#7a6f58'); g.addColorStop(1, '#4b4536');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(L.pts[0][0], L.pts[0][1]); for (const p of L.pts) ctx.lineTo(p[0], p[1]); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(L.x0 - 4, L.top + L.h * 0.6, L.x1 - L.x0 + 8, L.h * 0.45);
    ctx.strokeStyle = 'rgba(255,255,220,0.16)'; ctx.lineWidth = 2;
    for (let x = L.x0 + 10; x < L.x1 - 10; x += 26) { const a = Math.sin(x * 0.09 + t * 2) * 0.5 + 0.5; if (a < 0.4) continue; ctx.beginPath(); ctx.moveTo(x, L.top + 8); ctx.quadraticCurveTo(x + 8, L.top + 4, x + 16, L.top + 9); ctx.stroke(); }
    for (const dc of L.deco) {
      const x = dc.x, y = L.top - 2, s = dc.s;
      if (dc.kind === 'fan') { ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 1.1 + x) * 0.08); ctx.fillStyle = rgba(dc.c, 0.85); ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-24 * s, -20 * s, -14 * s, -40 * s); ctx.quadraticCurveTo(0, -50 * s, 14 * s, -40 * s); ctx.quadraticCurveTo(24 * s, -20 * s, 0, 0); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1; for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(k * 6 * s, -42 * s); ctx.stroke(); } ctx.restore(); }
      else if (dc.kind === 'brain') { ctx.fillStyle = '#c9b27a'; ell(ctx, x, y - 6 * s, 16 * s, 11 * s); ctx.fill(); ctx.strokeStyle = 'rgba(120,90,50,0.5)'; ctx.lineWidth = 1.2; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(x, y - 2 * s, (5 + k * 4) * s, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); } }
      else if (dc.kind === 'sponge') { ctx.fillStyle = dc.c; rr(ctx, x - 5 * s, y - 26 * s, 10 * s, 26 * s, 4 * s); ctx.fill(); rr(ctx, x + 5 * s, y - 18 * s, 8 * s, 18 * s, 4 * s); ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ell(ctx, x, y - 25 * s, 3 * s, 1.5 * s); ctx.fill(); }
      else if (dc.kind === 'urchin') { ctx.save(); ctx.translate(x, y + 2); drawUrchin(ctx, 5 * s, t); ctx.restore(); }
      else { ctx.strokeStyle = '#8a5a3a'; ctx.lineWidth = 2.5 * s; ctx.lineCap = 'round'; for (let k = 0; k < 3; k++) { const sw = Math.sin(t * 1.3 + x * 0.1 + k) * 6; ctx.beginPath(); ctx.moveTo(x + k * 4, y); ctx.quadraticCurveTo(x + k * 4 + sw * 0.5, y - 18 * s, x + k * 5 + sw, y - (28 + k * 6) * s); ctx.stroke(); } }
    }
  }
  drawDen(ctx, den, t) {
    const hg = ctx.createRadialGradient(den.x, den.y, 2, den.x, den.y, 22); hg.addColorStop(0, '#050807'); hg.addColorStop(0.7, '#141815'); hg.addColorStop(1, 'rgba(20,24,21,0)');
    ctx.fillStyle = hg; ell(ctx, den.x, den.y, 22, 16); ctx.fill();
    if (den.kind === 'lobster' && den.state === 'in') {
      const c = den.coax; const tw = den.twitch > 0 ? Math.sin(t * 40) * 0.25 + 0.3 : 0;
      ctx.save(); ctx.beginPath(); ctx.rect(den.x - (den.dir < 0 ? 400 : 18), den.y - 200, 418, 260); ctx.clip();
      ctx.save(); ctx.translate(den.x + den.dir * (-18 + c * 26), den.y + 3); ctx.globalAlpha = 0.55 + 0.45 * c;
      drawLobsterSide(ctx, 46 + den.lob.cl * 5, { t, flip: den.dir < 0, twitch: tw, gold: den.lob.gold });
      ctx.restore(); ctx.restore();
      if (this.target === den) {
        ctx.strokeStyle = den.twitch > 0 ? PAL.bad : 'rgba(255,200,69,0.9)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(den.x, den.y, 30, -Math.PI * 0.5, -Math.PI * 0.5 + TAU * c); ctx.stroke();
        const msg = den.twitch > 0 ? 'LET GO!' : this.tickling ? 'Keep tickling…' : 'HOLD TICKLE';
        const col = den.twitch > 0 ? PAL.bad : this.tickling ? '#ffffff' : PAL.sun;
        const sc = den.twitch > 0 ? 1 + Math.sin(t * 30) * 0.06 : 1;
        ctx.save(); ctx.translate(den.x + den.dir * 10, den.y - 52); ctx.scale(sc, sc);
        text(ctx, msg, 0, 0, { size: den.twitch > 0 ? 26 : 18, align: 'center', base: 'middle', color: col, stroke: 'rgba(0,0,0,0.65)', sw: 5, weight: 800 });
        ctx.restore();
      } else if (den.twitch > 0) text(ctx, '!', den.x + den.dir * 20, den.y - 30, { size: 30, align: 'center', color: PAL.warn, stroke: '#1a1a1a', sw: 5, weight: 800 });
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
    } else if (den.kind === 'lobster' && den.state === 'gone') {
      ctx.strokeStyle = 'rgba(210,130,70,0.4)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(den.x, den.y - 4); ctx.lineTo(den.x + den.dir * 16, den.y - 14); ctx.stroke();
    }
  }
  drawOut(ctx, t) {
    const o = this.out, zone = this.inNetZone(), near = dist(o.x, o.y, this.diver.x, this.diver.y) < 150;
    ctx.save(); ctx.translate(o.x, o.y); drawLobsterSide(ctx, 46 + o.lob.cl * 5, { t, flip: o.dir < 0, walk: o.state === 'walk', curl: o.state === 'bolt' ? 1 : 0, gold: o.lob.gold, glow: zone ? 'rgba(80,255,150,0.9)' : null }); ctx.restore();
    if (o.state === 'ring') {
      const r = this.ringRadius(), tol = this.netTol();
      ctx.strokeStyle = zone ? 'rgba(60,207,124,0.45)' : 'rgba(255,200,69,0.3)'; ctx.lineWidth = tol * 2; ell(ctx, o.x, o.y, NET_R, NET_R); ctx.stroke();
      ctx.strokeStyle = zone ? PAL.good : PAL.sun; ctx.lineWidth = 2; ell(ctx, o.x, o.y, NET_R, NET_R); ctx.stroke();
      if (near) { ctx.strokeStyle = zone ? PAL.good : '#ffffff'; ctx.lineWidth = zone ? 6 : 4; ell(ctx, o.x, o.y, r, r); ctx.stroke(); }
      const label = !near ? 'Swim closer' : zone ? 'NOW! TAP!' : 'Wait for green…';
      const sc = zone ? 1.15 + Math.sin(t * 25) * 0.05 : 1;
      ctx.save(); ctx.translate(o.x, o.y - 70); ctx.scale(sc, sc);
      text(ctx, label, 0, 0, { size: zone ? 26 : 18, align: 'center', base: 'middle', color: zone ? '#7dffb0' : '#ffffff', stroke: 'rgba(0,0,0,0.7)', sw: 5, weight: 800 });
      ctx.restore();
    }
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
    const gx = W - 214;
    panel(ctx, gx, 12, 200, 46, { r: 23 });
    text(ctx, 'BAG', gx + 14, 41, { size: 15, weight: 800, color: '#cfe3ea' });
    for (let i = 0; i < BH.BAG; i++) { const lx = gx + 64 + i * 22, lob = this.bag[i]; ctx.globalAlpha = lob ? 1 : 0.25; ctx.save(); ctx.translate(lx, 36); ctx.rotate(-0.5); drawLobsterSide(ctx, 16, { gold: lob && lob.gold }); ctx.restore(); ctx.globalAlpha = 1; }
    const mmw = Math.min(260, W - 580), mmx = W / 2 - mmw / 2, mmy = 64;
    if (mmw > 120) {
      ctx.fillStyle = 'rgba(3,30,44,0.55)'; rr(ctx, mmx, mmy, mmw, 12, 6); ctx.fill();
      ctx.fillStyle = 'rgba(160,140,100,0.9)'; for (const L of this.ledges) ctx.fillRect(mmx + (L.x0 / BH.WW) * mmw, mmy + 3, Math.max(2, ((L.x1 - L.x0) / BH.WW) * mmw), 6);
      ctx.fillStyle = '#fff'; ell(ctx, mmx + (BH.BOATX / BH.WW) * mmw, mmy + 6, 3, 3); ctx.fill();
      if (this.shark) { ctx.fillStyle = PAL.bad; ell(ctx, mmx + clamp(this.shark.x / BH.WW, 0, 1) * mmw, mmy + 6, 4, 4); ctx.fill(); }
      ctx.fillStyle = PAL.sun; ell(ctx, mmx + (this.diver.x / BH.WW) * mmw, mmy + 6, 4.5, 4.5); ctx.fill();
    }
    // the action button: TICKLE near a lobster hole, NET when a bug is out, green NOW! in the window
    const a = this.actionZone();
    let label = 'NET', fill = 'rgba(255,255,255,0.18)', fg = '#fff', active = false, prog = null, zone = false;
    if (this.out && this.out.state === 'ring' && dist(this.out.x, this.out.y, this.diver.x, this.diver.y) < 150) {
      active = true; zone = this.inNetZone(); label = zone ? 'NOW!' : 'NET'; fill = zone ? PAL.good : PAL.coral; fg = zone ? PAL.ink : '#fff';
      prog = clamp(this.out.ringT / this.out.ringDur, 0, 1);
    } else if (this.target && this.target.kind !== 'empty') {
      active = true; const tw = this.target.twitch > 0;
      label = tw ? 'LET GO' : 'TICKLE'; fill = tw ? PAL.bad : PAL.sun; fg = tw ? '#fff' : PAL.ink;
      if (this.target.kind === 'lobster') prog = this.target.coax;
    }
    const pulse = active ? 1 + Math.sin(t * (zone ? 22 : 6)) * (zone ? 0.07 : 0.03) : 1;
    ctx.save(); ctx.translate(a.x, a.y); ctx.scale(pulse, pulse);
    ctx.globalAlpha = active ? 1 : 0.5;
    if (active) { ctx.fillStyle = rgba(fill.startsWith('#') ? fill : '#ffffff', 0.25); ell(ctx, 0, 0, a.r + 12, a.r + 12); ctx.fill(); }
    ctx.fillStyle = fill; ell(ctx, 0, 0, a.r, a.r); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 3; ctx.stroke();
    if (prog != null) {
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 7; ell(ctx, 0, 0, a.r + 6, a.r + 6); ctx.stroke();
      if (this.out) { const tol = this.netTol(), z0 = (84 - NET_R - tol) / 74, z1 = (84 - NET_R + tol) / 74; ctx.strokeStyle = 'rgba(60,207,124,0.9)'; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(0, 0, a.r + 6, -Math.PI / 2 + TAU * z0, -Math.PI / 2 + TAU * z1); ctx.stroke(); }
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
      text(ctx, Game.touch ? 'Drag anywhere to swim' : 'Arrow keys or WASD to swim', 24, H - 30, { size: 18, color: '#fff', weight: 700, alpha: 0.8, stroke: 'rgba(0,0,0,0.4)', sw: 4 });
    }
    if (this.coach) this.drawCoach(ctx, W, H, t, a);
    if (this.quip) this.drawQuip(ctx, W);
  }
  drawCoach(ctx, W, H, t, a) {
    const bubble = (x, y, msg, w) => { panel(ctx, x - w / 2, y - 22, w, 44, { r: 14, fill: 'rgba(255,255,255,0.95)', line: 'rgba(0,0,0,0.1)' }); text(ctx, msg, x, y + 1, { size: 17, align: 'center', base: 'middle', color: PAL.ink, weight: 800, maxW: w - 16 }); };
    if (this.coachNet && this.out) {
      const k = (Math.sin(t * 6) + 1) / 2;
      bubble(a.x - 120, a.y - a.r - 44, 'Tap when the ring turns GREEN', 280);
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(a.x - 30, a.y - a.r - 16 + k * 6); ctx.lineTo(a.x - 46, a.y - a.r - 22 + k * 6); ctx.lineTo(a.x - 22, a.y - a.r - 30 + k * 6); ctx.fill();
      return;
    }
    if (this.t > 9) return;
    const k = (Math.sin(t * 3) + 1) / 2;
    const hx = 150 + k * 60, hy = H - 120 + k * 20;
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ell(ctx, 150, H - 120, 46, 46); ctx.fill();
    ctx.fillStyle = '#ffffff'; ell(ctx, hx, hy, 14, 14); ctx.fill(); ctx.strokeStyle = PAL.ink; ctx.lineWidth = 2; ctx.stroke();
    bubble(170, H - 186, Game.touch ? 'Drag here to swim' : 'Arrows / WASD to swim', 220);
    bubble(a.x - 70, a.y - a.r - 44, 'Tickle & net with this', 230);
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
    // 3x magnifier on the back end of the gauge, where close calls are decided
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
