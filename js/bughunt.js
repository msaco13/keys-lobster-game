'use strict';
/* Keys Crew — Bug Hunt. Free-dive the patch reef for spiny lobster.
   Tickle them out of their holes (ease off when they twitch), net them on the ring,
   then gauge every bug: carapace over 3", no eggs. Six per person. */

const BH = { WW: 2900, SURF: 96, BAG: 6, BOATX: 660 };
const GAUGE_IN = 3.0;

function rollCL(perks) {
  const r = Math.random();
  if (r < 0.3) return Math.round(rand(2.45, 2.97) * 100) / 100;
  if (r < 0.42) return Math.round(rand(2.95, 3.1) * 100) / 100;
  const big = chance(0.16 * ((perks && perks.trophy) || 1));
  return Math.round((3.1 + Math.pow(Math.random(), 1.7) * (big ? 2.9 : 1.6)) * 100) / 100;
}
const lobsterWeight = (cl) => Math.round(0.034 * Math.pow(cl, 2.9) * 10) / 10;

class BugHuntScene extends SessionBase {
  constructor(o) {
    super(o);
    this.resultHeader = 'FWC check at the ramp';
    this.diver = { x: 540, y: BH.SURF + 6, vx: 0, vy: 0, facing: 1, stun: 0 };
    this.maxBreath = 24 * this.perks.breath; this.breath = this.maxBreath;
    this.bag = []; this.out = null; this.gauge = null; this.blackout = 0; this.beatT = 0;
    this.joy = null; this.actionPtr = null; this.actionPress = false; this.cam = 0; this.goodReleases = 0;
    this.others = (Trip.cur && Trip.cur.crew ? Trip.cur.crew : CHAR_ORDER).filter((c) => c !== this.ch).slice(0, 2);
    this.gen();
  }
  enter() { SFX.setAmbient(1, true); Game.toast('Bug Hunt', { color: PAL.coral, size: 46, y: 200, sub: 'Swim down, find antennae, tickle them out' }); }
  exit() { SFX.setAmbient(0); }
  baseFloor(x) { return 500 + 10 * Math.sin(x * 0.004) + 6 * Math.sin(x * 0.013 + 1); }
  groundAt(x) { for (const L of this.ledges) if (x >= L.x0 - 4 && x <= L.x1 + 4) return L.top; return this.baseFloor(x); }
  solid(x, y) { return y > this.groundAt(x) - 12; }
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
      for (let px = L.x0 + 14; px < L.x1 - 10; px += rand(22, 40)) L.deco.push({ x: px, kind: pick(['fan', 'brain', 'sponge', 'rod', 'rod', 'fan']), s: rand(0.7, 1.25), c: pick(['#8a4fb8', '#b85fa8', '#e07a3a', '#d9a441', '#7d5bd0']) });
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
  }
  makeDen(x, y, dir) { return { x, y, dir, kind: 'empty', coax: 0, spooks: 0, twitch: 0, nextTwitch: rand(0.9, 1.8), badHold: 0, state: 'in', peek: 0, peekT: rand(2, 5), lob: null, extra: 0 }; }
  makeLob() { const cl = rollCL(this.perks); return { cl, w: lobsterWeight(cl), eggs: cl > 3.0 && chance(0.14) }; }

  /* ---------- input ---------- */
  actionZone() { return { x: Game.W - 96, y: Game.H - 96, r: 66 }; }
  inAction(x, y) { const a = this.actionZone(); return dist(x, y, a.x, a.y) < a.r + 8; }
  pointerDown(p) {
    if (this.basePointerDown(p) || this.gauge || this.blackout > 0) return;
    if (this.inAction(p.x, p.y)) { this.actionPtr = p.id; this.actionPress = true; return; }
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
    if (this.blackout > 0) {
      this.blackout -= dt; d.y = approach(d.y, BH.SURF + 4, 1.5, dt);
      if (this.blackout <= 0) { d.y = BH.SURF + 4; this.breath = this.maxBreath * 0.5; this.timeLeft = Math.max(0, this.timeLeft - 6); Game.toast('Your buddy pulled you up', { color: '#fff', size: 30, y: 160, sub: 'Never push a breath-hold. Always dive with a buddy. (−6 sec)' }); }
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
    const sp = 168;
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
    // breath
    if (under) { this.breath -= dt; if (chance(dt * 2.2)) this.parts.add({ kind: 'bubble', x: d.x + d.facing * 20, y: d.y - 14, vy: -50, vx: rand(-8, 8), life: 1.6, size: rand(2, 4) }); }
    else this.breath = Math.min(this.maxBreath, this.breath + dt * 9);
    if (this.breath < this.maxBreath * 0.28 && under) { this.beatT -= dt; if (this.beatT <= 0) { this.beatT = 0.75; SFX.tone(60, 0.12, { vol: 0.25 }); } }
    if (this.breath <= 0) { this.blackout = 2.2; this.breath = 0; if (this.out) this.lobsterFlees(); SFX.play('fail'); return; }
    // creatures
    for (const j of this.jellies) {
      j.ph += dt; j.x += Math.sin(j.ph * 0.3) * 10 * dt - this.weather.drift * 6 * dt; j.y += Math.sin(j.ph * 0.9) * 8 * dt; j.hit = Math.max(0, j.hit - dt);
      if (!j.hit && dist(j.x, j.y, d.x + d.facing * 10, d.y) < 26) { j.hit = 2; d.stun = 0.7; this.breath -= 3; Game.toast('Jellyfish sting!', { color: '#ff9fd6', size: 30, y: 130 }); SFX.play('sting'); Game.shake(4); }
    }
    this.cuda.x += this.cuda.dir * 26 * dt; if (this.cuda.x > BH.WW - 200 || this.cuda.x < 300) this.cuda.dir *= -1;
    for (const s of this.schools) { s.ph += dt * 0.5; s.x = s.cx + Math.cos(s.ph) * 70; s.y = s.cy + Math.sin(s.ph * 1.3) * 18; if (dist(s.x, s.y, d.x, d.y) < 70) { s.x += (s.x - d.x) * 0.6; } }
    // dens
    const hx = d.x + d.facing * 46, hy = d.y + 2;
    let target = null, best = 52;
    for (const den of this.dens) {
      if (den.kind === 'moray') { den.peekT -= dt; if (den.peekT <= 0) { den.peek = 1.4; den.peekT = rand(3, 6); } den.peek = Math.max(0, den.peek - dt); }
      const dd = dist(hx, hy, den.x + den.dir * 8, den.y);
      if (dd < best && d.facing === -den.dir && den.state === 'in' && den.kind !== 'empty') { best = dd; target = den; }
    }
    this.target = target;
    const held = this.actionHeld() && !stunned;
    this.tickling = false;
    if (target && target.kind === 'moray' && held) {
      target.peek = 1.5; d.stun = 0.9; this.breath -= 4; Game.toast('MORAY! Wrong hole.', { color: PAL.bad, size: 34, y: 130 }); SFX.play('chomp'); Game.shake(7); Game.vibrate(120);
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
      if (this.out && this.out.state === 'ring' && dist(this.out.x, this.out.y, d.x, d.y) < 140) this.tryNet();
      else if (!target) this.parts.burst(hx, hy, 4, { kind: 'bubble', min: 10, max: 40, life: 0.8 });
    }
  }
  spook(den) {
    den.coax = Math.max(0, den.coax - 0.4); den.spooks++; den.twitch = 0; den.badHold = 0;
    SFX.play('fail');
    if (den.spooks >= 3) { den.state = 'gone'; Game.toast('It backed in deep', { color: PAL.warn, size: 30, y: 130, sub: 'That bug is gone. Try another hole.' }); }
    else Game.toast('Easy! It backed in.', { color: PAL.warn, size: 30, y: 130, sub: 'Let go of TICKLE when the antennae twitch' });
  }
  emerge(den) {
    const lob = den.lob;
    this.out = { x: den.x + den.dir * 6, y: den.y, tx: den.x + den.dir * 52, ty: this.baseFloor(den.x + den.dir * 52) - 9, dir: den.dir, lob, state: 'walk', t: 0, ringT: 0, ringDur: 1.15, misses: 0, vx: 0 };
    if (den.extra > 0) { den.extra--; den.coax = 0; den.spooks = 0; den.lob = this.makeLob(); }
    else { den.state = 'empty'; den.kind = 'empty'; }
    Game.toast('It’s out!', { color: PAL.good, size: 32, y: 130, sub: 'Tap NET when the ring hits the gold circle' });
    SFX.play('coin');
  }
  updateOut(dt, d) {
    const o = this.out; o.t += dt;
    if (o.state === 'walk') { o.x = approach(o.x, o.tx, 4, dt); o.y = approach(o.y, o.ty, 4, dt); if (Math.abs(o.x - o.tx) < 3) { o.state = 'ring'; o.ringT = 0; } }
    else if (o.state === 'ring') {
      if (dist(o.x, o.y, d.x, d.y) < 140) { o.ringT += dt; if (o.ringT > o.ringDur + 0.12) this.bolt(); }
      else o.ringT = Math.max(0, o.ringT - dt);
    } else if (o.state === 'bolt') {
      o.x += o.vx * dt; o.vx *= 1 - Math.min(1, dt * 3.2); o.t2 -= dt;
      const gy = this.groundAt(o.x); if (gy < o.y + 4) { o.x -= o.vx * dt; o.vx = 0; }
      o.y = approach(o.y, this.baseFloor(o.x) - 9, 5, dt);
      if (chance(0.5)) this.parts.add({ x: o.x, y: o.y + 6, vx: rand(-20, 20), vy: -rand(5, 25), life: 0.8, size: rand(2, 4), color: 'rgba(225,205,150,0.7)' });
      if (o.t2 <= 0) { o.state = 'ring'; o.ringT = 0; o.ringDur *= 0.86; }
    }
  }
  ringRadius() { const o = this.out; return lerp(84, 10, clamp(o.ringT / o.ringDur, 0, 1)); }
  tryNet() {
    const r = this.ringRadius(), tol = 8 * this.perks.window;
    if (Math.abs(r - 26) <= tol) {
      const perfect = Math.abs(r - 26) <= 3;
      SFX.play('net'); Game.vibrate(40);
      this.parts.burst(this.out.x, this.out.y, 18, { kind: 'bubble', min: 30, max: 120, life: 1.1 });
      if (perfect) { this.addLine('Perfect net', 25); this.fl.add(this.out.x - this.cam, this.out.y - 40, 'PERFECT +25', PAL.sun, 22); }
      this.gauge = { lob: this.out.lob, t: 0 }; Game.toasts = [];
      this.out = null;
    } else this.bolt();
  }
  bolt() {
    const o = this.out, d = this.diver;
    o.misses++;
    if (o.misses >= 3) { this.lobsterFlees(); return; }
    o.state = 'bolt'; o.t2 = 0.6; o.vx = (Math.sign(o.x - d.x) || 1) * 430;
    SFX.play('splash'); Game.toast('Missed! It tail-flipped away', { color: PAL.warn, size: 28, y: 130, sub: 'Chase it down and try again' });
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
      if (legal) this.score += Math.round(lob.w * 100);
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
        const c = makeCatch('lobster', lob.w, this.ch, 'bughunt', extras); c.cl = lob.cl; catches.push(c);
        lines.push({ label: tag + ' · ' + fmtLb(lob.w), pts: c.pts, key: 'lobster', trophy: c.trophy });
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
    g.addColorStop(0, vis > 1.1 ? '#43c7da' : '#35b2cc'); g.addColorStop(0.55, '#1683a8'); g.addColorStop(1, '#0c5a7a');
    ctx.fillStyle = g; ctx.fillRect(0, BH.SURF, W, H - BH.SURF);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    for (let i = 0; i < 7; i++) { const bx = ((i * 260 - cam * 0.3) % (W + 300) + W + 300) % (W + 300) - 150; ctx.beginPath(); ctx.moveTo(bx, BH.SURF); ctx.lineTo(bx + 50, BH.SURF); ctx.lineTo(bx - 70 + Math.sin(t * 0.7 + i) * 18, H); ctx.lineTo(bx - 150 + Math.sin(t * 0.7 + i) * 18, H); ctx.fill(); }
    // far reef silhouettes
    ctx.fillStyle = 'rgba(10,70,95,0.55)'; ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W + 20; x += 20) { const wx = x + cam * 0.5; ctx.lineTo(x, 420 - 30 * Math.abs(Math.sin(wx * 0.006)) - 18 * Math.sin(wx * 0.017)); }
    ctx.lineTo(W, H); ctx.fill();
    ctx.save(); ctx.translate(-cam, 0);
    // boat at the surface with the rest of the crew
    drawBoatSide(ctx, BH.BOATX, BH.SURF + 8, 0.42, { crew: this.others, flag: true, t });
    // sand
    const sg = ctx.createLinearGradient(0, 470, 0, H); sg.addColorStop(0, '#d8c58f'); sg.addColorStop(1, '#a8955f');
    ctx.fillStyle = sg; ctx.beginPath(); ctx.moveTo(cam - 10, H);
    for (let x = cam - 10; x <= cam + W + 20; x += 16) ctx.lineTo(x, this.baseFloor(x)); ctx.lineTo(cam + W + 20, H); ctx.fill();
    ctx.strokeStyle = '#4f8a46'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    for (const gr of this.grass) { if (gr.x < cam - 20 || gr.x > cam + W + 20) continue; const by = this.baseFloor(gr.x) + 4; ctx.beginPath(); ctx.moveTo(gr.x, by); ctx.quadraticCurveTo(gr.x + Math.sin(t * 1.4 + gr.ph) * 6, by - gr.h * 0.6, gr.x + Math.sin(t * 1.4 + gr.ph) * 10, by - gr.h); ctx.stroke(); }
    for (const L of this.ledges) { if (L.x1 < cam - 60 || L.x0 > cam + W + 60) continue; this.drawLedge(ctx, L, t); }
    for (const den of this.dens) { if (den.x < cam - 80 || den.x > cam + W + 80) continue; this.drawDen(ctx, den, t); }
    for (const s of this.schools) for (const f of s.fish) {
      const fx = s.x + f.ox + Math.sin(t * 2 + f.ph) * 4, fy = s.y + f.oy;
      ctx.save(); ctx.translate(fx, fy); if (Math.cos(s.ph) < 0) ctx.scale(-1, 1);
      ctx.fillStyle = s.kind === 'tang' ? '#2b62d6' : '#e2d867'; ell(ctx, 0, 0, 7, 4); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(-11, -4); ctx.lineTo(-11, 4); ctx.fill();
      if (s.kind === 'sgt') { ctx.fillStyle = '#222'; ctx.fillRect(-3, -4, 1.4, 8); ctx.fillRect(1, -4, 1.4, 8); }
      ctx.restore();
    }
    ctx.save(); ctx.translate(this.cuda.x, this.cuda.y + Math.sin(t * 0.6) * 10); drawFish(ctx, 'barracuda', 120, { t, flip: this.cuda.dir < 0, wig: 0.4, alpha: 0.85 }); ctx.restore();
    for (const j of this.jellies) this.drawJelly(ctx, j, t);
    if (this.out) this.drawOut(ctx, t);
    const moving = Math.hypot(d.vx, d.vy) / 168;
    drawDiver(ctx, this.ch, d.x, d.y, 0.95, { t, facing: d.facing, kick: moving, tickle: this.tickling, tilt: clamp(d.vy / 400, -0.35, 0.35) * d.facing });
    this.parts.draw(ctx);
    ctx.restore();
    drawWaterline(ctx, W, BH.SURF, t, 'rgba(255,255,255,0.7)', 2.5);
    if (vis < 1) { ctx.fillStyle = 'rgba(40,90,90,0.18)'; ctx.fillRect(0, BH.SURF, W, H - BH.SURF); }
    // low-air vignette
    const air = this.breath / this.maxBreath;
    if ((air < 0.28 && d.y > BH.SURF + 14) || this.blackout > 0) {
      const k = this.blackout > 0 ? 1 - this.blackout / 2.2 * 0.2 : (0.28 - air) / 0.28;
      const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.9);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(150,10,30,${0.3 + 0.5 * k + Math.sin(t * 8) * 0.08})`);
      ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
      if (this.blackout > 0) { ctx.fillStyle = `rgba(0,0,0,${0.6 * (1 - this.blackout / 2.2) + 0.3})`; ctx.fillRect(0, 0, W, H); }
    }
    this.fl.draw(ctx);
    this.drawHud(ctx, W, H);
    if (this.gauge) this.drawGauge(ctx, W, H);
    if (this.paused) this.drawPause(ctx);
  }
  drawLedge(ctx, L, t) {
    const g = ctx.createLinearGradient(0, L.top, 0, L.top + L.h); g.addColorStop(0, '#7a6f58'); g.addColorStop(1, '#4b4536');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(L.pts[0][0], L.pts[0][1]); for (const p of L.pts) ctx.lineTo(p[0], p[1]); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(L.x0 - 4, L.top + L.h * 0.6, L.x1 - L.x0 + 8, L.h * 0.45);
    for (const dc of L.deco) {
      const x = dc.x, y = L.top - 2, s = dc.s;
      if (dc.kind === 'fan') { ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 1.1 + x) * 0.08); ctx.fillStyle = rgba(dc.c, 0.85); ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-24 * s, -20 * s, -14 * s, -40 * s); ctx.quadraticCurveTo(0, -50 * s, 14 * s, -40 * s); ctx.quadraticCurveTo(24 * s, -20 * s, 0, 0); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1; for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(k * 6 * s, -42 * s); ctx.stroke(); } ctx.restore(); }
      else if (dc.kind === 'brain') { ctx.fillStyle = '#c9b27a'; ell(ctx, x, y - 6 * s, 16 * s, 11 * s); ctx.fill(); ctx.strokeStyle = 'rgba(120,90,50,0.5)'; ctx.lineWidth = 1.2; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(x, y - 2 * s, (5 + k * 4) * s, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); } }
      else if (dc.kind === 'sponge') { ctx.fillStyle = dc.c; rr(ctx, x - 5 * s, y - 26 * s, 10 * s, 26 * s, 4 * s); ctx.fill(); rr(ctx, x + 5 * s, y - 18 * s, 8 * s, 18 * s, 4 * s); ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ell(ctx, x, y - 25 * s, 3 * s, 1.5 * s); ctx.fill(); }
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
      drawLobsterSide(ctx, 46 + den.lob.cl * 5, { t, flip: den.dir < 0, twitch: tw });
      ctx.restore(); ctx.restore();
      if (den.twitch > 0) text(ctx, '!', den.x + den.dir * 20, den.y - 30, { size: 30, align: 'center', color: PAL.warn, stroke: '#1a1a1a', sw: 5, weight: 800 });
      if (this.target === den) { ctx.strokeStyle = 'rgba(255,200,69,0.8)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(den.x, den.y, 30, -Math.PI * 0.5, -Math.PI * 0.5 + TAU * c); ctx.stroke(); }
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
    const o = this.out;
    ctx.save(); ctx.translate(o.x, o.y); drawLobsterSide(ctx, 46 + o.lob.cl * 5, { t, flip: o.dir < 0, walk: o.state === 'walk', curl: o.state === 'bolt' ? 1 : 0 }); ctx.restore();
    if (o.state === 'ring') {
      const r = this.ringRadius(), tol = 8 * this.perks.window, inZone = Math.abs(r - 26) <= tol;
      ctx.strokeStyle = 'rgba(255,200,69,0.9)'; ctx.lineWidth = tol * 2; ctx.globalAlpha = 0.35; ell(ctx, o.x, o.y, 26, 26); ctx.stroke(); ctx.globalAlpha = 1;
      ctx.strokeStyle = PAL.sun; ctx.lineWidth = 2; ell(ctx, o.x, o.y, 26, 26); ctx.stroke();
      ctx.strokeStyle = inZone ? PAL.good : '#ffffff'; ctx.lineWidth = 4; ell(ctx, o.x, o.y, r, r); ctx.stroke();
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
    this.drawTopBar(ctx);
    // breath
    const bx = 70, by = 64, air = clamp(this.breath / this.maxBreath, 0, 1);
    panel(ctx, bx, by, 196, 34, { r: 17 });
    text(ctx, 'AIR', bx + 14, by + 23, { size: 15, weight: 800, color: '#cfe3ea' });
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; rr(ctx, bx + 48, by + 11, 134, 12, 6); ctx.fill();
    ctx.fillStyle = air > 0.5 ? '#6fe0ff' : air > 0.28 ? PAL.warn : PAL.bad; rr(ctx, bx + 48, by + 11, 134 * air, 12, 6); ctx.fill();
    // bag
    const gx = W - 214;
    panel(ctx, gx, 12, 200, 46, { r: 23 });
    text(ctx, 'BAG', gx + 14, 41, { size: 15, weight: 800, color: '#cfe3ea' });
    for (let i = 0; i < BH.BAG; i++) { const lx = gx + 64 + i * 22; ctx.globalAlpha = i < this.bag.length ? 1 : 0.25; ctx.save(); ctx.translate(lx, 36); ctx.rotate(-0.5); drawLobsterSide(ctx, 16, {}); ctx.restore(); ctx.globalAlpha = 1; }
    // minimap
    const mmw = Math.min(260, W - 580), mmx = W / 2 - mmw / 2, mmy = 64;
    if (mmw > 120) {
      ctx.fillStyle = 'rgba(3,30,44,0.55)'; rr(ctx, mmx, mmy, mmw, 12, 6); ctx.fill();
      ctx.fillStyle = 'rgba(160,140,100,0.9)'; for (const L of this.ledges) ctx.fillRect(mmx + (L.x0 / BH.WW) * mmw, mmy + 3, Math.max(2, ((L.x1 - L.x0) / BH.WW) * mmw), 6);
      ctx.fillStyle = '#fff'; ell(ctx, mmx + (BH.BOATX / BH.WW) * mmw, mmy + 6, 3, 3); ctx.fill();
      ctx.fillStyle = PAL.sun; ell(ctx, mmx + (this.diver.x / BH.WW) * mmw, mmy + 6, 4.5, 4.5); ctx.fill();
    }
    // controls
    const a = this.actionZone();
    let label = 'NET', active = false;
    if (this.out && this.out.state === 'ring') { label = 'NET'; active = dist(this.out.x, this.out.y, this.diver.x, this.diver.y) < 140; }
    else if (this.target) { label = 'TICKLE'; active = true; }
    ctx.globalAlpha = active ? 1 : 0.55;
    ctx.fillStyle = active ? (label === 'NET' ? PAL.coral : PAL.sun) : 'rgba(255,255,255,0.18)';
    ell(ctx, a.x, a.y, a.r, a.r); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 3; ctx.stroke();
    text(ctx, label, a.x, a.y + 2, { size: label.length > 4 ? 20 : 26, align: 'center', base: 'middle', color: active ? PAL.ink : '#fff', weight: 800 });
    if (!Game.touch) text(ctx, 'SPACE', a.x, a.y + 26, { size: 12, align: 'center', base: 'middle', color: active ? PAL.ink : '#fff', weight: 800, alpha: 0.7 });
    ctx.globalAlpha = 1;
    if (this.joy) {
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 3; ell(ctx, this.joy.sx, this.joy.sy, 55, 55); ctx.stroke();
      const jx = clamp(this.joy.x - this.joy.sx, -55, 55), jy = clamp(this.joy.y - this.joy.sy, -55, 55);
      ctx.fillStyle = 'rgba(255,255,255,0.45)'; ell(ctx, this.joy.sx + jx, this.joy.sy + jy, 22, 22); ctx.fill();
    } else if (this.t < 8) {
      text(ctx, Game.touch ? 'Drag anywhere to swim' : 'Arrow keys or WASD to swim', 24, H - 30, { size: 18, color: '#fff', weight: 700, alpha: 0.8, stroke: 'rgba(0,0,0,0.4)', sw: 4 });
    }
    if (this.target && this.target.kind === 'lobster' && !this.out && this.t > 0) text(ctx, 'Hold TICKLE · let go on the twitch', W / 2, H - 28, { size: 18, align: 'center', color: '#fff', weight: 700, stroke: 'rgba(0,0,0,0.5)', sw: 4 });
  }
  drawGauge(ctx, W, H) {
    const g = this.gauge, lob = g.lob, k = easeOut(g.t / 0.3);
    ctx.fillStyle = `rgba(3,22,32,${0.82 * k})`; ctx.fillRect(0, 0, W, H);
    text(ctx, 'Gauge it', W / 2, 62, { display: true, size: 40, align: 'center', color: '#fff' });
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
    ctx.save(); ctx.translate(rearX, cy); drawLobsterTop(ctx, C, { t: this.t }); ctx.restore();
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
