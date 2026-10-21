'use strict';
/* Keys Crew — the run. Drive the boat from the home dock to the spot, seen from above.
   Pick a throttle notch, drag to steer. Idle through the no-wake canal (FWC is watching),
   dodge trap floats and shoals, catch air off other boats' wakes, and coast in to the mark. */

const RUN_LEGS = {
  bughunt: [['canal', 540], ['harbor', 700], ['channel', 1900], ['reef', 1100]],
  bottom: [['canal', 540], ['harbor', 700], ['channel', 1900], ['reef', 1300], ['blue', 900]],
  troll: [['canal', 540], ['harbor', 700], ['channel', 1600], ['reef', 1000], ['blue', 1400], ['offshore', 1400]],
  flats: [['canal', 540], ['creek', 700], ['bridge', 700], ['bay', 2600]]
};
const RUN_WATER = { canal: '#2e8a84', harbor: '#3aa4ae', creek: '#3f8f78', bridge: '#45a69a', bay: '#6ccab6', channel: '#36bccb', reef: '#28b0d0', blue: '#1a6db4', offshore: '#0e4e98' };
const RUN_LEG_NAME = { canal: 'The canal', harbor: 'Harbor channel', creek: 'Mangrove creek', bridge: 'The bridge', bay: 'Florida Bay', channel: 'Hawk Channel', reef: 'The reef line', blue: 'Blue water', offshore: 'Offshore' };
const THROTTLE = [{ name: 'IDLE', v: 0 }, { name: 'SLOW', v: 85 }, { name: 'CRUISE', v: 195 }, { name: 'FULL', v: 335 }];
const KNOTS = 0.115; // px/s to knots, for the speedometer
const RUN_QUIPS = {
  aground: ['Nice parking job.', 'We’re not a skiff, bro!', 'Somebody get out and push.'],
  air: ['WOOOO!', 'Send it!', 'My coffee!', 'Again! Again!'],
  fwc: ['Busted!', 'Officer, he’s new.', 'Told you it was no-wake.'],
  dolphins: ['Dolphins on the bow!', 'Look! Dolphins!'],
  manatee: ['Manatee! Easy, easy.', 'Aww, a manatee.'],
  bump: ['Easy on the boat!', 'That’s gonna leave a mark.'],
  trap: ['Trap line! Again?', 'Somebody grab the knife.'],
  arrive: ['Right on the numbers.', 'Smooth, Captain.'],
  hot: ['Came in HOT.', 'Brakes, bro. Brakes.']
};

class BoatRunScene {
  constructor(o) {
    this.o = o; this.to = o.to; this.driver = o.driver; this.weather = o.weather || { id: 'light', drift: 0.5 };
    this.legs = []; let x = 0;
    for (const [type, len] of RUN_LEGS[o.to]) { this.legs.push({ type, x0: x, x1: x + len }); x += len; }
    this.len = x;
    let crew = (Trip.cur && Trip.cur.crew ? Trip.cur.crew : CHAR_ORDER).slice();
    this.crew = [this.driver].concat(crew.filter((c) => c !== this.driver));
    this.others = this.crew.slice(1).length ? this.crew.slice(1) : CHAR_ORDER.filter((c) => c !== this.driver);
    this.t = 0; this.wx = 0; this.speed = 0; this.notch = 1; this.by = Game.H * 0.56; this.ty = this.by; this.vy = 0; this.ang = 0;
    this.stuck = 0; this.stall = 0; this.air = null; this.fwc = null; this.speedingT = 0;
    this.hist = [{ d: 0, y: this.by }]; this.parts = new Particles(); this.fl = new Floaters();
    this.lines = []; this.flags = { aground: 0, bumps: 0, fwc: false, dolphins: false, manatee: false, airs: 0 };
    this.state = 'run'; this.arriveT = 0; this.topSpeed = 0; this.quip = null; this.dragId = null; this.dolphins = null; this.dolTimer = rand(4, 9);
    this.gen();
  }
  enter() { Music.play('run'); SFX.setAmbient(0.7, false); }
  exit() { SFX.setEngine(0); SFX.setAmbient(0); }
  bx() { return Game.W * 0.28; }
  legAt(x) { for (const L of this.legs) if (x < L.x1) return L; return this.legs[this.legs.length - 1]; }
  laneY(x) { return Game.H * 0.56 + Math.sin(x * 0.0016 + 1) * Game.H * 0.17; }
  bounds(x) {
    const L = this.legAt(x).type, H = Game.H;
    if (L === 'canal') return [190, H - 112];
    if (L === 'creek') return [160, H - 92];
    return [92, H - 26];
  }
  waterAt(x) {
    const L = this.legAt(x), i = this.legs.indexOf(L), next = this.legs[i + 1];
    if (next && x > L.x1 - 300) return mix(RUN_WATER[L.type], RUN_WATER[next.type], (x - (L.x1 - 300)) / 300);
    return RUN_WATER[L.type];
  }
  say(kind, p = 1) { if (!chance(p) || !RUN_QUIPS[kind]) return; this.quip = { who: pick(this.others), msg: pick(RUN_QUIPS[kind]), t: 2.6 }; }
  gen() {
    const H = Game.H, objs = this.objs = [], deco = this.deco = [];
    const lane = (x) => this.laneY(x);
    const freeY = (x, gap) => { let y, k = 0; do { y = rand(110, H - 50); k++; } while (Math.abs(y - lane(x)) < gap && k < 30); return y; };
    for (const L of this.legs) {
      const span = L.x1 - L.x0;
      if (L.type === 'canal' || L.type === 'creek') {
        objs.push({ type: 'zone', x0: L.x0, x1: L.type === 'canal' ? L.x1 : L.x0 + 380 });
        objs.push({ type: 'sign', x: L.x0 + 40, y: L.type === 'canal' ? 214 : 182, text: 'NO WAKE' });
        objs.push({ type: 'manatee', x: L.x0 + rand(220, span - 120), y: rand(this.bounds(L.x0 + 10)[0] + 40, this.bounds(L.x0 + 10)[1] - 40), t: rand(0, 5) });
        for (let x = L.x0; x < L.x1; x += rand(90, 140)) for (const side of [-1, 1]) deco.push({ type: L.type === 'canal' ? 'house' : 'mangrove', x, side, c: pick(['#e8c26a', '#7fc4d8', '#f2a57f', '#b9d98a', '#f4f0e6']), roof: pick(['#c0583a', '#5a7a8a', '#e8e2d2', '#4a6a4a']), dock: chance(0.6), boat: chance(0.35) });
      }
      if (L.type === 'harbor') {
        objs.push({ type: 'sign', x: L.x0 + 20, y: 214, text: 'RESUME SAFE SPEED', end: true });
        for (let x = L.x0 + 140, n = 2; x < L.x1; x += 240, n += 2) { const ly = lane(x); objs.push({ type: 'post', x, y: ly - 105, color: 'green', n: n - 1 }); objs.push({ type: 'post', x, y: ly + 105, color: 'red', n }); }
        for (let i = 0; i < 3; i++) { const x = L.x0 + rand(100, span - 100); objs.push({ type: 'trap', x, y: freeY(x, 120), color: pick(['#ff6a3d', '#ffffff', '#ffd23a']) }); }
      }
      if (L.type === 'channel' || L.type === 'reef' || L.type === 'bay') {
        const nShoal = L.type === 'bay' ? 13 : L.type === 'reef' ? 6 : 4;
        for (let i = 0; i < nShoal; i++) { const x = L.x0 + (i + 0.5) * span / nShoal + rand(-60, 60), rx = rand(60, L.type === 'bay' ? 150 : 110), ry = rand(30, 60); const y = freeY(x, 100 + ry); objs.push({ type: 'shoal', x, y, rx, ry, reef: L.type === 'reef', mud: L.type === 'bay', birds: chance(0.4) }); }
        for (let x = L.x0; x < L.x1; x += rand(70, 130)) deco.push({ type: 'grass', x, y: rand(90, H - 20), r: rand(20, 60) });
      }
      if (L.type === 'channel' || L.type === 'reef') {
        const nTrap = L.type === 'channel' ? 14 : 6;
        for (let i = 0; i < nTrap; i++) { const x = L.x0 + rand(60, span - 60); objs.push({ type: 'trap', x, y: rand(100, H - 40), color: pick(['#ff6a3d', '#ffffff', '#ffd23a', '#7be36a', '#ff4fa0']), stripe: pick(['#1b3f8a', '#e03a3a', '#111111']) }); }
        for (let i = 0; i < (L.type === 'channel' ? 3 : 1); i++) objs.push({ type: 'xboat', x: L.x0 + (i + 0.6) * span / 3.2, y: 0, dir: chance(0.5) ? 1 : -1, on: false, y0: 0, hit: false, ch: pick(['#ffffff', '#e8e2d0', '#d8e6ef']) });
      }
      if (L.type === 'reef') objs.push({ type: 'light', x: L.x0 + span * 0.55, y: lane(L.x0 + span * 0.55) - 150 < 110 ? lane(L.x0 + span * 0.55) + 150 : lane(L.x0 + span * 0.55) - 150 });
      if (L.type === 'bay') for (let x = L.x0 + 120; x < L.x1; x += 210) { objs.push({ type: 'post', x, y: lane(x) - 80, color: 'white' }); objs.push({ type: 'post', x: x + 100, y: lane(x + 100) + 80, color: 'white' }); }
      if (L.type === 'bridge') {
        const bxw = L.x0 + span * 0.5, gap = clamp(lane(bxw), 170, H - 120);
        this.bridge = { x: bxw, gap, gw: 150, cars: [] };
        for (let y = 60; y < H + 40; y += 64) if (Math.abs(y - gap) > 96) objs.push({ type: 'pylon', x: bxw, y });
        for (let i = 0; i < 6; i++) this.bridge.cars.push({ y: rand(0, H), dir: i % 2 ? 1 : -1, c: pick(['#e84a3a', '#f4f4f4', '#2a5bd8', '#222222', '#f2c12e', '#8a8f96']), sp: rand(90, 150) });
      }
      if (L.type === 'blue' || L.type === 'offshore') {
        for (let i = 0; i < 5; i++) deco.push({ type: 'weed', x: L.x0 + rand(0, span), y: rand(100, H - 30), len: rand(60, 200) });
        objs.push({ type: 'xboat', x: L.x0 + span * 0.5, y: 0, dir: chance(0.5) ? 1 : -1, on: false, y0: 0, hit: false, big: true, ch: '#f2f4f6' });
      }
    }
    objs.push({ type: 'mark', x: this.len + 140, y: lane(this.len + 140) });
    this.waves = []; for (let i = 0; i < 80; i++) this.waves.push({ x: rand(0, 1400), y: rand(0, 540), l: rand(8, 22) });
  }

  /* ---------- input ---------- */
  setNotch(n) { if (this.state !== 'run' || this.fwc) return; const was = this.notch; this.notch = clamp(n, 0, 3); if (this.notch !== was) SFX.play('click'); }
  pointerDown(p) { if (this.state !== 'run') return; this.dragId = p.id; this.ty = clamp(p.y, 100, Game.H - 30); }
  pointerMove(p) { if (this.dragId === p.id) this.ty = clamp(p.y, 100, Game.H - 30); }
  pointerUp(p) { if (this.dragId === p.id) this.dragId = null; }
  keyDown(c) {
    if (c === 'ArrowRight' || c === 'KeyD') this.setNotch(this.notch + 1);
    if (c === 'ArrowLeft' || c === 'KeyA') this.setNotch(this.notch - 1);
    if (c === 'Digit1') this.setNotch(0); if (c === 'Digit2') this.setNotch(1); if (c === 'Digit3') this.setNotch(2); if (c === 'Digit4') this.setNotch(3);
  }

  /* ---------- update ---------- */
  update(dt) {
    this.t += dt; this.parts.update(dt); this.fl.update(dt);
    if (this.quip) { this.quip.t -= dt; if (this.quip.t <= 0) this.quip = null; }
    const W = Game.W, H = Game.H, bx = this.bx();
    if (this.state === 'summary') { SFX.setEngine(1, 0.05); return; }
    if (Input.held('ArrowUp', 'KeyW')) this.ty = clamp(this.ty - 240 * dt, 100, H - 30);
    if (Input.held('ArrowDown', 'KeyS')) this.ty = clamp(this.ty + 240 * dt, 100, H - 30);
    // target speed
    let target = THROTTLE[this.notch].v;
    if (this.state === 'arrive') target = 0;
    if (this.fwc) target = 0;
    if (this.stuck > 0) { this.stuck -= dt; target = 0; this.speed = 0; }
    if (this.stall > 0) { this.stall -= dt; target = 0; }
    const shoal = this.overShoal();
    if (shoal && this.speed <= 115) target = Math.min(target, 55);
    this.speed = this.speed < target ? Math.min(target, this.speed + 115 * dt) : Math.max(target, this.speed - 210 * dt);
    this.topSpeed = Math.max(this.topSpeed, this.speed);
    // steering
    const maxVy = 55 + this.speed * 0.55, dy = this.ty - this.by;
    this.vy = approach(this.vy, clamp(dy * 3, -maxVy, maxVy), 5, dt);
    this.by += this.vy * dt;
    const [top, bot] = this.bounds(this.wx);
    if (this.by < top + 16 || this.by > bot - 16) { this.by = clamp(this.by, top + 16, bot - 16); if (this.speed > 60) this.bump('Bumped the seawall!'); this.vy *= -0.3; }
    this.ang = Math.atan2(this.vy, Math.max(45, this.speed)) * 0.8;
    const prevWx = this.wx; this.wx += this.speed * dt;
    this.hist.push({ d: this.wx, y: this.by }); if (this.hist.length > 300) this.hist.shift();
    for (const w of this.waves) { w.x -= (this.speed + 14) * dt; if (w.x < -30) { w.x = W + rand(0, 80); w.y = rand(0, H); } }
    if (this.air) { this.air.t += dt; if (this.air.t >= this.air.dur) { this.air = null; SFX.play('bigsplash'); this.parts.burst(bx, this.by, 24, { color: ['#ffffff', '#d8f6ff'], min: 60, max: 200, life: 0.7, drag: 2 }); Game.shake(5); } }
    if (this.speed > 150 && chance(dt * 30)) this.parts.add({ x: bx + 44 + rand(-4, 4), y: this.by + rand(-16, 16), vx: -this.speed * 0.6, vy: rand(-40, 40), life: 0.5, size: rand(1.5, 3.5), color: 'rgba(255,255,255,0.85)', drag: 2 });
    SFX.setEngine(1, this.speed / 335); SFX.setAmbient(0.4 + this.speed / 500, false);
    // the world
    const leg = this.legAt(this.wx);
    if (this.zoneAt(this.wx)) {
      if (this.speed > 100 && !this.fwc && !this.flags.fwc) { this.speedingT += dt; if (this.speedingT > 1.3) this.pullOver(); }
      else this.speedingT = Math.max(0, this.speedingT - dt);
    }
    if (this.fwc) { this.fwc.t -= dt; this.fwc.x = approach(this.fwc.x, bx - 20, 2, dt); if (this.fwc.t <= 0) { this.fwc = null; this.notch = 1; } }
    if (!this.flags.dolphins && (leg.type === 'channel' || leg.type === 'blue' || leg.type === 'offshore') && this.speed >= 150) {
      this.dolTimer -= dt;
      if (this.dolTimer <= 0 && !this.dolphins) { this.dolphins = { t: 0, dur: 5.5, pod: [0, 1, 2].map((i) => ({ ox: rand(30, 90), oy: (i - 1) * 46 + rand(-8, 8), ph: rand(0, TAU) })) }; this.flags.dolphins = true; this.lines.push({ label: 'Dolphins rode the bow wake', pts: 25 }); this.fl.add(bx + 60, this.by - 70, 'Dolphins! +25', '#bff0ff', 22); this.say('dolphins'); SFX.play('coin'); }
    }
    if (this.dolphins) { this.dolphins.t += dt; if (this.dolphins.t > this.dolphins.dur) this.dolphins = null; }
    if (this.bridge) for (const c of this.bridge.cars) { c.y += c.dir * c.sp * dt; if (c.y > H + 30) c.y = -30; if (c.y < -30) c.y = H + 30; }
    for (const o of this.objs) this.updateObj(o, prevWx, dt, bx);
    // arrival
    if (this.state === 'run' && this.wx >= this.len) {
      this.state = 'arrive'; this.arriveT = 0;
      if (this.speed <= 100) { this.lines.push({ label: 'Smooth arrival', pts: 25 }); this.say('arrive'); } else this.say('hot');
    }
    if (this.state === 'arrive') { this.arriveT += dt; if (this.speed < 12 && this.arriveT > 0.8) this.toSummary(); }
  }
  zoneAt(x) { for (const o of this.objs) if (o.type === 'zone' && x >= o.x0 && x <= o.x1) return o; return null; }
  overShoal() {
    const bx = this.bx();
    for (const o of this.objs) { if (o.type !== 'shoal') continue; const sx = o.x - this.wx + bx; if (Math.abs(sx - bx) > o.rx + 10) continue; const k = ((bx - sx) / o.rx) ** 2 + ((this.by - o.y) / o.ry) ** 2; if (k < 1) return o; }
    return null;
  }
  updateObj(o, prevWx, dt, bx) {
    const sx = o.x - this.wx + bx;
    if (o.type === 'manatee') { o.t += dt; if (!this.flags.manatee && Math.abs(sx - bx) < 160 && this.speed <= 100) { this.flags.manatee = true; this.lines.push({ label: 'Went slow for a manatee', pts: 25 }); this.fl.add(sx, o.y - 40, 'Manatee +25', '#d8f0e8', 20); this.say('manatee'); } return; }
    if (o.type === 'xboat') {
      if (!o.on && o.x - this.wx < 950) { o.on = true; o.y0 = o.dir > 0 ? -60 : Game.H + 60; o.y = o.y0; }
      if (o.on) o.y += o.dir * (o.big ? 150 : 175) * dt;
      if (!o.hit && o.on && prevWx < o.x && this.wx >= o.x) {
        const lo = Math.min(o.y0, o.y), hi = Math.max(o.y0, o.y);
        if (this.by > lo && this.by < hi) {
          o.hit = true;
          if (this.speed > 220 && !this.air) { this.air = { t: 0, dur: 0.75 }; this.flags.airs++; if (this.flags.airs <= 4) this.lines.push({ label: 'Airtime off a wake', pts: 25 }); this.fl.add(bx, this.by - 80, 'AIRTIME! +25', PAL.sun, 26); SFX.play('woo'); this.say('air', 0.8); }
          else { Game.shake(3); SFX.play('splash'); this.parts.burst(bx, this.by, 10, { color: '#ffffff', min: 40, max: 120, life: 0.5 }); }
        }
      }
      return;
    }
    if (Math.abs(sx - bx) > 70) return;
    const bowX = bx + Math.cos(this.ang) * 40, bowY = this.by + Math.sin(this.ang) * 40;
    if (o.type === 'trap' && !o.hit && dist(bowX, bowY, sx, o.y) < 18) {
      o.hit = true; this.stall = 2.2; this.flags.bumps++; Game.toast('Wrapped a trap line!', { color: PAL.warn, size: 32, y: 170, sub: 'Cutting it off the prop…' }); SFX.play('fail'); Game.shake(4); this.say('trap', 0.7);
    } else if ((o.type === 'post' || o.type === 'pylon' || o.type === 'light') && (o.type === 'pylon' ? Math.abs(bx - sx) < 60 && Math.abs(this.by - o.y) < 22 : dist(bx, this.by, sx, o.y) < (o.type === 'light' ? 34 : 22))) {
      this.by += Math.sign(this.by - o.y || 1) * 24; if (this.speed > 40) this.bump(o.type === 'pylon' ? 'Clipped a bridge piling!' : 'Bumped a marker!');
    } else if (o.type === 'shoal' && this.speed > 115 && !this.stuck) {
      const k = ((bx - sx) / o.rx) ** 2 + ((this.by - o.y) / o.ry) ** 2;
      if (k < 0.85) this.runAground(o);
    }
  }
  bump(msg) {
    if (this.bumpCd > this.t) return; this.bumpCd = this.t + 1;
    this.speed *= 0.35; this.flags.bumps++; Game.shake(6); SFX.play('chomp'); Game.toast(msg, { color: PAL.warn, size: 28, y: 170 }); this.say('bump', 0.6);
  }
  runAground(o) {
    this.stuck = 2.6; this.speed = 0; this.flags.aground++;
    this.parts.burst(this.bx() + 30, this.by, 20, { color: o.mud ? 'rgba(140,110,70,0.7)' : 'rgba(230,210,160,0.8)', min: 30, max: 120, life: 1.2, drag: 1.5 });
    Game.toast('Ran aground!', { color: PAL.coral, size: 40, y: 170, sub: o.reef ? 'That’s a patch reef. Read the water: brown means shallow.' : 'Too fast over the flat. Go slow over light water.' });
    SFX.play('bigsplash'); Game.shake(9, 0.5); Game.vibrate(150); this.say('aground');
    if (this.flags.aground === 1) this.lines.push({ label: 'Ran aground', pts: -25 });
  }
  pullOver() {
    this.flags.fwc = true; this.fwc = { t: 3.4, x: -120 }; this.notch = 0;
    this.lines.push({ label: 'FWC warning: speeding in a no-wake zone', pts: -50 });
    SFX.play('siren'); Game.toast('FWC pulled you over!', { color: '#7fb8ff', size: 38, y: 170, sub: 'No-wake zone. Idle speed only. (−50)' }); this.say('fwc');
  }
  toSummary() {
    this.state = 'summary'; this.sumT = 0;
    if (!this.flags.aground && !this.flags.fwc && !this.flags.bumps) this.lines.push({ label: 'Clean run · no bumps, no tickets', pts: 50 });
    this.total = this.lines.reduce((a, l) => a + l.pts, 0);
    SFX.play(this.total > 0 ? 'catch' : 'click');
  }
  finish(skipped) { if (this.done) return; this.done = true; SFX.setEngine(0); this.o.onArrive(skipped ? 0 : this.total, skipped ? [] : this.lines); }

  /* ---------- drawing ---------- */
  sx(x) { return x - this.wx + this.bx(); }
  draw(ctx) {
    const W = Game.W, H = Game.H, t = this.t, bx = this.bx();
    // water, shading left-to-right as the route changes
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, this.waterAt(this.wx - bx)); g.addColorStop(0.5, this.waterAt(this.wx + W * 0.2)); g.addColorStop(1, this.waterAt(this.wx + W - bx));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    this.drawBanks(ctx, W, H, t);
    for (const d of this.deco) { const x = this.sx(d.x); if (x < -220 || x > W + 220) continue; this.drawDeco(ctx, d, x, t); }
    ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    for (const w of this.waves) { ctx.beginPath(); ctx.moveTo(w.x, w.y); ctx.quadraticCurveTo(w.x + w.l / 2, w.y - 3, w.x + w.l, w.y); ctx.stroke(); }
    for (const o of this.objs) { if (o.type === 'shoal') { const x = this.sx(o.x); if (x > -260 && x < W + 260) this.drawShoal(ctx, o, x, t); } }
    for (const o of this.objs) { if (o.type === 'shoal' || o.type === 'zone') continue; const x = this.sx(o.x); if (x < -160 || x > W + 160) continue; this.drawObj(ctx, o, x, t); }
    // wake behind the boat
    for (let d = 0; d < 260; d += 10) {
      const hp = this.hist; let y = this.by; for (let i = hp.length - 1; i > 0; i--) if (hp[i - 1].d <= this.wx - d) { const a = hp[i - 1], b = hp[i]; y = lerp(a.y, b.y, (this.wx - d - a.d) / Math.max(0.001, b.d - a.d)); break; }
      const x = bx - 40 - d, k = this.speed / 335, sp = 8 + d * (0.12 + 0.2 * k), a = (0.15 + 0.35 * k) * (1 - d / 260);
      ctx.fillStyle = `rgba(255,255,255,${a})`; ell(ctx, x, y - sp, 6, 2.5); ctx.fill(); ell(ctx, x, y + sp, 6, 2.5); ctx.fill();
      ctx.fillStyle = `rgba(255,255,255,${a * 0.6})`; ell(ctx, x, y, 8, 4 + d * 0.03); ctx.fill();
    }
    if (this.dolphins) this.drawDolphins(ctx, bx, t);
    if (this.fwc) this.drawFwc(ctx, this.fwc.x, this.by + 70, t);
    // the boat (and its shadow when it catches air)
    const z = this.air ? Math.sin((this.air.t / this.air.dur) * Math.PI) : 0;
    if (z > 0) { ctx.fillStyle = 'rgba(0,30,50,0.25)'; ell(ctx, bx + 14 * z, this.by + 26 * z, 70, 26); ctx.fill(); }
    drawBoatTop(ctx, bx, this.by - 10 * z, 0.62 * (1 + 0.22 * z), this.ang, { crew: this.crew });
    this.parts.draw(ctx);
    if (this.bridge) this.drawBridgeDeck(ctx, this.sx(this.bridge.x), H, t);
    this.fl.draw(ctx);
    this.drawHud(ctx, W, H, t);
    if (this.state === 'summary') this.drawSummary(ctx, W, H, t);
  }
  drawBanks(ctx, W, H, t) {
    for (const L of this.legs) {
      if (L.type !== 'canal' && L.type !== 'creek') continue;
      const x0 = this.sx(L.x0), x1 = this.sx(L.x1); if (x1 < -40 || x0 > W + 40) continue;
      const [top, bot] = this.bounds(L.x0 + 1), a = Math.max(-40, x0), b = Math.min(W + 40, x1);
      if (L.type === 'canal') {
        ctx.fillStyle = '#7da05c'; ctx.fillRect(a, 0, b - a, top); ctx.fillRect(a, bot, b - a, H - bot);
        ctx.fillStyle = '#e4dfd2'; ctx.fillRect(a, top - 8, b - a, 8); ctx.fillRect(a, bot, b - a, 8);
      } else {
        ctx.fillStyle = '#2f5a35'; ctx.fillRect(a, 0, b - a, top - 10); ctx.fillRect(a, bot + 10, b - a, H - bot);
        ctx.fillStyle = '#3e7444'; for (let x = a; x < b; x += 26) { ell(ctx, x, top - 10, 22, 16); ctx.fill(); ell(ctx, x + 13, bot + 10, 22, 16); ctx.fill(); }
      }
    }
  }
  drawDeco(ctx, d, x, t) {
    const H = Game.H;
    if (d.type === 'grass') { ctx.fillStyle = 'rgba(40,110,80,0.22)'; ell(ctx, x, d.y, d.r * 1.6, d.r, 0.3); ctx.fill(); return; }
    if (d.type === 'weed') { ctx.fillStyle = 'rgba(214,170,58,0.8)'; for (let k = 0; k < d.len; k += 16) { ell(ctx, x + k, d.y + Math.sin(k * 0.05) * 8, 7, 5); ctx.fill(); } return; }
    const [top, bot] = this.bounds(d.x);
    const y0 = d.side < 0 ? top - 8 : bot + 8;
    if (d.type === 'house') {
      if (d.dock) { ctx.fillStyle = '#9a7b55'; ctx.fillRect(x - 6, d.side < 0 ? top - 6 : bot - 34, 40, 40); ctx.strokeStyle = 'rgba(60,40,20,0.4)'; ctx.lineWidth = 1; for (let k = 0; k < 40; k += 6) { ctx.beginPath(); ctx.moveTo(x - 6 + k, d.side < 0 ? top - 6 : bot - 34); ctx.lineTo(x - 6 + k, d.side < 0 ? top + 34 : bot + 6); ctx.stroke(); } }
      if (d.boat) drawBoatTop(ctx, x + 66, d.side < 0 ? top + 22 : bot - 22, 0.32, 0, {});
      const hy = d.side < 0 ? top - 70 : bot + 26;
      ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(x + 4, hy + 6, 56, 42);
      ctx.fillStyle = d.roof; ctx.fillRect(x, hy, 56, 42); ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x, hy, 56, 21);
      ctx.fillStyle = '#3f7a3a'; for (let k = 0; k < 6; k++) { ctx.save(); ctx.translate(x + 74, d.side < 0 ? top - 30 : bot + 40); ctx.rotate(k * 1.05 + Math.sin(t + d.x) * 0.05); ell(ctx, 10, 0, 12, 3.5); ctx.fill(); ctx.restore(); }
    } else {
      ctx.strokeStyle = 'rgba(70,45,25,0.6)'; ctx.lineWidth = 2; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(x + k * 9, y0); ctx.lineTo(x + k * 9 + 4, y0 + d.side * -14); ctx.stroke(); }
    }
  }
  drawShoal(ctx, o, x, t) {
    ctx.fillStyle = o.mud ? 'rgba(220,235,190,0.45)' : 'rgba(170,240,230,0.45)'; ell(ctx, x, o.y, o.rx * 1.35, o.ry * 1.45); ctx.fill();
    ctx.fillStyle = o.reef ? '#a8875a' : o.mud ? '#cdbf8a' : '#e6d6a4'; ell(ctx, x, o.y, o.rx, o.ry); ctx.fill();
    if (o.reef) { ctx.fillStyle = 'rgba(120,70,50,0.6)'; const rng = mulberry(Math.floor(o.x)); for (let i = 0; i < 12; i++) { ell(ctx, x + (rng() - 0.5) * o.rx * 1.5, o.y + (rng() - 0.5) * o.ry * 1.4, 6 + rng() * 10, 4 + rng() * 7); ctx.fill(); } }
    if (o.birds) for (let i = 0; i < 3; i++) { ctx.fillStyle = '#f4f4f0'; ell(ctx, x - 20 + i * 18, o.y - 4 + (i % 2) * 6, 5, 3); ctx.fill(); ctx.fillStyle = '#e8a23a'; ell(ctx, x - 14 + i * 18, o.y - 4 + (i % 2) * 6, 2, 1); ctx.fill(); }
  }
  drawObj(ctx, o, x, t) {
    if (o.type === 'trap') {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, o.y); ctx.lineTo(x - 18, o.y + 5); ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ell(ctx, x + 3, o.y + 4, 9, 9); ctx.fill();
      ctx.fillStyle = o.color; ell(ctx, x, o.y, 9, 9); ctx.fill(); ctx.fillStyle = o.stripe || '#1b3f8a'; ctx.fillRect(x - 9, o.y - 2, 18, 4);
    } else if (o.type === 'post') {
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ell(ctx, x + 4, o.y + 5, 9, 9); ctx.fill();
      if (o.color === 'white') { ctx.fillStyle = '#f4f4f0'; ell(ctx, x, o.y, 4, 4); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1; ctx.stroke(); }
      else {
        ctx.fillStyle = '#6b5a44'; ell(ctx, x, o.y, 6, 6); ctx.fill();
        ctx.fillStyle = o.color === 'red' ? '#e03a3a' : '#2f9a4a'; ctx.beginPath();
        if (o.color === 'red') { ctx.moveTo(x, o.y - 16); ctx.lineTo(x + 13, o.y + 6); ctx.lineTo(x - 13, o.y + 6); } else ctx.rect(x - 11, o.y - 12, 22, 20);
        ctx.fill(); text(ctx, String(o.n), x, o.y + 2, { size: 11, align: 'center', base: 'middle', color: '#fff', weight: 800 });
        if (o.n % 4 === 1) { ctx.fillStyle = '#f2f2ee'; ell(ctx, x + 2, o.y - 18, 5, 4); ctx.fill(); }
      }
    } else if (o.type === 'pylon') {
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; rr(ctx, x - 50, o.y - 8, 104, 22, 6); ctx.fill();
      ctx.fillStyle = '#9d978a'; rr(ctx, x - 52, o.y - 12, 104, 22, 6); ctx.fill(); ctx.fillStyle = '#c4beb0'; rr(ctx, x - 52, o.y - 12, 104, 8, 4); ctx.fill();
    } else if (o.type === 'light') {
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; rr(ctx, x - 22, o.y - 16, 52, 52, 4); ctx.fill();
      ctx.strokeStyle = '#3a3a3a'; ctx.lineWidth = 3; ctx.strokeRect(x - 28, o.y - 28, 56, 56);
      ctx.beginPath(); ctx.moveTo(x - 28, o.y - 28); ctx.lineTo(x + 28, o.y + 28); ctx.moveTo(x + 28, o.y - 28); ctx.lineTo(x - 28, o.y + 28); ctx.stroke();
      ctx.fillStyle = '#d9d4c8'; rr(ctx, x - 10, o.y - 10, 20, 20, 3); ctx.fill();
      ctx.fillStyle = `rgba(255,240,150,${0.5 + 0.5 * Math.sin(t * 4)})`; ell(ctx, x, o.y, 6, 6); ctx.fill();
      text(ctx, 'Reef light', x, o.y + 46, { size: 13, align: 'center', color: '#fff', weight: 800, stroke: 'rgba(0,0,0,0.5)', sw: 4 });
    } else if (o.type === 'sign') {
      ctx.fillStyle = '#7a6a54'; ctx.fillRect(x - 2, o.y, 4, 14);
      ctx.fillStyle = '#ffffff'; rr(ctx, x - 44, o.y - 22, 88, 26, 4); ctx.fill(); ctx.strokeStyle = o.end ? '#2f9a4a' : '#ff7a1a'; ctx.lineWidth = 3; ctx.stroke();
      text(ctx, o.text, x, o.y - 8, { size: o.text.length > 10 ? 9 : 13, align: 'center', base: 'middle', color: '#1a1a1a', weight: 800 });
    } else if (o.type === 'manatee') {
      const up = Math.sin(o.t * 0.8) > 0.2;
      ctx.save(); ctx.translate(x, o.y); ctx.globalAlpha = up ? 0.85 : 0.35;
      ctx.fillStyle = '#7d7f78'; ell(ctx, 0, 0, 34, 16); ctx.fill(); ell(ctx, -36, 0, 13, 15); ctx.fill(); ell(ctx, 30, 0, 12, 10); ctx.fill();
      ctx.restore();
      if (up && chance(0.06)) this.parts.add({ kind: 'ring', x: x + 34, y: o.y, size: 4, grow: 20, life: 0.6, color: 'rgba(255,255,255,0.5)', flat: 0.6 });
    } else if (o.type === 'xboat' && o.on) {
      const ang = o.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x, o.y0); ctx.lineTo(x, o.y - o.dir * 30); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + s * 10, o.y - o.dir * 40); ctx.lineTo(x + s * 26, o.y0); ctx.stroke(); }
      drawBoatTop(ctx, x, o.y, o.big ? 0.7 : 0.5, ang, {});
    } else if (o.type === 'mark') {
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ell(ctx, x + 4, o.y + 6, 16, 16); ctx.fill();
      ctx.fillStyle = PAL.coral; ell(ctx, x, o.y, 16, 16); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(x - 16, o.y - 3, 32, 6);
      ctx.strokeStyle = '#222'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, o.y); ctx.lineTo(x, o.y - 40); ctx.stroke();
      ctx.fillStyle = PAL.sun; ctx.beginPath(); ctx.moveTo(x, o.y - 40); ctx.lineTo(x + 26, o.y - 33 + Math.sin(t * 5) * 2); ctx.lineTo(x, o.y - 26); ctx.fill();
      text(ctx, SPOTS[this.to].name, x, o.y + 36, { size: 18, align: 'center', color: '#fff', weight: 800, stroke: PAL.ink, sw: 5 });
      if (chance(0.05)) this.parts.add({ kind: 'ring', x, y: o.y, size: 18, grow: 40, life: 1.2, color: 'rgba(255,255,255,0.3)', flat: 0.7 });
    }
  }
  drawBridgeDeck(ctx, x, H, t) {
    if (x < -100 || x > Game.W + 100) return;
    ctx.fillStyle = 'rgba(0,20,30,0.2)'; ctx.fillRect(x - 30, 0, 80, H);
    ctx.fillStyle = '#c9c4b8'; ctx.fillRect(x - 38, 0, 76, H);
    ctx.fillStyle = '#7d7a72'; ctx.fillRect(x - 32, 0, 64, H);
    ctx.strokeStyle = '#f2d23c'; ctx.lineWidth = 2; ctx.setLineDash([12, 12]); ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); ctx.setLineDash([]);
    for (const c of this.bridge.cars) { const cx = x + (c.dir > 0 ? -15 : 15); ctx.fillStyle = c.c; rr(ctx, cx - 9, c.y - 15, 18, 30, 5); ctx.fill(); ctx.fillStyle = 'rgba(30,50,70,0.6)'; ctx.fillRect(cx - 7, c.y + (c.dir > 0 ? 2 : -10), 14, 8); }
    text(ctx, 'US-1 · OVERSEAS HWY', x, 96, { size: 12, align: 'center', color: '#fff', weight: 800, stroke: 'rgba(0,0,0,0.5)', sw: 3 });
    const gy = this.bridge.gap; ctx.strokeStyle = 'rgba(80,255,150,0.7)'; ctx.lineWidth = 3; ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.moveTo(x - 70, gy - this.bridge.gw / 2 + 12); ctx.lineTo(x - 70, gy + this.bridge.gw / 2 - 12); ctx.stroke(); ctx.setLineDash([]);
    text(ctx, 'CHANNEL', x - 78, gy, { size: 12, align: 'right', base: 'middle', color: '#bfffd6', weight: 800, stroke: 'rgba(0,0,0,0.5)', sw: 3 });
  }
  drawDolphins(ctx, bx, t) {
    const D = this.dolphins, fade = Math.min(1, D.t * 2, (D.dur - D.t) * 2);
    for (const p of D.pod) {
      const ph = t * 3 + p.ph, up = Math.sin(ph), x = bx + p.ox + 30, y = this.by + p.oy;
      ctx.save(); ctx.translate(x, y); ctx.globalAlpha = fade * (up > 0 ? 1 : 0.45);
      const s = 1 + Math.max(0, up) * 0.25;
      ctx.scale(s, s); ctx.fillStyle = '#6d7e8c'; ell(ctx, 0, 0, 26, 8); ctx.fill(); ell(ctx, 26, 0, 6, 3); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(-36, -8); ctx.lineTo(-33, 0); ctx.lineTo(-36, 8); ctx.fill();
      ctx.fillStyle = '#566672'; ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(-14, -3); ctx.lineTo(-10, 0); ctx.fill();
      ctx.restore();
      if (up > 0.95 && chance(0.3)) this.parts.add({ kind: 'ring', x, y, size: 6, grow: 30, life: 0.6, color: 'rgba(255,255,255,0.5)', flat: 0.6 });
    }
  }
  drawFwc(ctx, x, y, t) {
    drawBoatTop(ctx, x, y, 0.55, 0, {});
    ctx.fillStyle = 'rgba(40,90,200,0.85)'; rr(ctx, x - 10, y - 12, 26, 24, 4); ctx.fill();
    const on = Math.floor(t * 8) % 2;
    ctx.fillStyle = on ? '#4aa0ff' : '#ffffff'; ell(ctx, x, y - 8, 4, 4); ctx.fill(); ctx.fillStyle = on ? '#ffffff' : '#4aa0ff'; ell(ctx, x, y + 8, 4, 4); ctx.fill();
    text(ctx, 'FWC', x + 2, y + 30, { size: 13, align: 'center', color: '#fff', weight: 800, stroke: '#123a8a', sw: 4 });
  }
  drawHud(ctx, W, H, t) {
    const C = CHARS[this.driver];
    panel(ctx, 14, 12, 210, 46, { r: 23 });
    crewAvatar(ctx, this.driver, 38, 35, 17);
    text(ctx, 'Captain ' + C.name, 62, 31, { size: 16, weight: 800, color: '#fff', maxW: 150 });
    text(ctx, 'driving the boat', 62, 49, { size: 13, weight: 600, color: '#9fb8c2' });
    // route progress
    const pw = Math.min(420, W - 520), px = W / 2 - pw / 2, py = 22;
    panel(ctx, px - 14, 10, pw + 28, 50, { r: 18 });
    const k = clamp(this.wx / this.len, 0, 1), nm = Math.max(0, (this.len - this.wx) / 1800).toFixed(1);
    text(ctx, 'To ' + SPOTS[this.to].name + ' · ' + nm + ' nm', px, py + 10, { size: 14, color: '#fff', weight: 800, maxW: pw - 110 });
    text(ctx, RUN_LEG_NAME[this.legAt(this.wx).type], px + pw, py + 10, { size: 13, align: 'right', color: '#9fb8c2', weight: 700 });
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; rr(ctx, px, py + 18, pw, 8, 4); ctx.fill();
    for (const L of this.legs) { ctx.fillStyle = RUN_WATER[L.type]; ctx.fillRect(px + (L.x0 / this.len) * pw, py + 19, ((L.x1 - L.x0) / this.len) * pw - 1, 6); }
    ctx.fillStyle = PAL.sun; ell(ctx, px + k * pw, py + 22, 6, 6); ctx.fill();
    if (this.state === 'run') UI.button(ctx, 'skip', W - 132, 12, 118, 44, 'Skip ride', () => this.finish(true), { style: 'dark', size: 16, key: 'Escape' });
    // speedometer
    const kts = Math.round(this.speed * KNOTS), sx = 26, sy = H - 26;
    panel(ctx, sx - 12, sy - 82, 170, 92, { r: 18 });
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(sx + 50, sy - 8, 44, Math.PI, TAU); ctx.stroke();
    ctx.strokeStyle = this.speed > 280 ? PAL.coral : PAL.sun; ctx.beginPath(); ctx.arc(sx + 50, sy - 8, 44, Math.PI, Math.PI + Math.PI * clamp(this.speed / 335, 0, 1)); ctx.stroke();
    text(ctx, String(kts), sx + 50, sy - 14, { size: 28, align: 'center', color: '#fff', weight: 800 });
    text(ctx, 'KNOTS', sx + 50, sy + 2, { size: 11, align: 'center', color: '#9fb8c2', weight: 800 });
    text(ctx, THROTTLE[this.notch].name, sx + 108, sy - 30, { size: 15, color: PAL.sun, weight: 800 });
    text(ctx, this.speed > 150 ? 'on plane' : this.speed > 5 ? 'plowing' : 'idle', sx + 108, sy - 12, { size: 12, color: '#9fb8c2', weight: 700 });
    // throttle lever
    const lx = W - 92, ly0 = H - 300, lh = 252;
    panel(ctx, lx - 12, ly0 - 34, 92, lh + 46, { r: 20 });
    text(ctx, 'THROTTLE', lx + 34, ly0 - 12, { size: 12, align: 'center', color: '#9fb8c2', weight: 800 });
    for (let i = 3; i >= 0; i--) {
      const y = ly0 + (3 - i) * (lh / 4);
      UI.button(ctx, 'thr' + i, lx, y + 4, 68, lh / 4 - 10, THROTTLE[i].name, () => this.setNotch(i), { style: this.notch === i ? (i === 3 ? 'coral' : 'primary') : 'ghost', size: 14, r: 12, disabled: this.state !== 'run' });
    }
    // zone and shallow warnings
    const zone = this.zoneAt(this.wx);
    if (zone && this.state === 'run') {
      const warn = this.speed > 100;
      panel(ctx, W / 2 - 150, 68, 300, 34, { r: 17, fill: warn ? 'rgba(200,60,20,0.92)' : 'rgba(255,255,255,0.92)', line: 'rgba(0,0,0,0.1)' });
      text(ctx, warn ? 'NO WAKE! Throttle down to SLOW' : 'NO WAKE ZONE · keep it slow', W / 2, 90, { size: 15, align: 'center', color: warn ? '#fff' : PAL.ink, weight: 800 });
    } else if (this.overShoal() && this.state === 'run') {
      panel(ctx, W / 2 - 130, 68, 260, 34, { r: 17, fill: 'rgba(230,200,120,0.95)' });
      text(ctx, 'Shallow! Easy on the throttle', W / 2, 90, { size: 15, align: 'center', color: PAL.ink, weight: 800 });
    }
    if (this.t < 7 && this.state === 'run') para(ctx, Game.touch ? 'Drag up and down to steer. Tap the throttle on the right.' : 'Drag or ↑ ↓ to steer. ← → or the lever for throttle.', 200, H - 54, W - 420, { size: 16, color: '#fff', weight: 700, stroke: 'rgba(0,0,0,0.5)', sw: 4, lh: 20 });
    if (this.quip) {
      const q = this.quip, qw = Math.min(380, W * 0.42), qx = W - qw - 14, qy = 112;
      ctx.save(); ctx.globalAlpha = Math.min(1, q.t * 3);
      panel(ctx, qx, qy, qw, 44, { r: 22, fill: 'rgba(255,255,255,0.95)', line: 'rgba(0,0,0,0.1)' });
      crewAvatar(ctx, q.who, qx + 24, qy + 22, 17);
      text(ctx, CHARS[q.who].name + ': ' + q.msg, qx + 48, qy + 28, { size: 15, color: PAL.ink, weight: 800, maxW: qw - 60 });
      ctx.restore();
    }
  }
  drawSummary(ctx, W, H, t) {
    this.sumT += 1 / 60;
    ctx.fillStyle = `rgba(3,22,32,${Math.min(0.75, this.sumT * 2)})`; ctx.fillRect(0, 0, W, H);
    const pw = Math.min(520, W - 60), px = W / 2 - pw / 2, ph = 150 + Math.max(1, this.lines.length) * 30, py = Math.max(20, H / 2 - ph / 2 - 30);
    panel(ctx, px, py, pw, ph, { r: 22 });
    text(ctx, 'Arrived at ' + SPOTS[this.to].name, px + 24, py + 46, { display: true, size: 28, color: '#fff', maxW: pw - 48 });
    text(ctx, 'Captain ' + CHARS[this.driver].name + ' · top speed ' + Math.round(this.topSpeed * KNOTS) + ' kts', px + 24, py + 74, { size: 15, color: '#9fb8c2', weight: 700 });
    let y = py + 108;
    if (!this.lines.length) text(ctx, 'Uneventful ride. Nothing to report.', px + 24, y, { size: 17, color: '#cfe3ea', weight: 600 });
    for (const l of this.lines) { text(ctx, l.label, px + 24, y, { size: 17, color: l.pts < 0 ? '#ff9a8a' : '#fff', weight: 600, maxW: pw - 120 }); text(ctx, (l.pts > 0 ? '+' : '') + l.pts, px + pw - 24, y, { size: 18, align: 'right', color: l.pts < 0 ? PAL.bad : PAL.sun, weight: 800 }); y += 30; }
    text(ctx, 'Captain’s points: ' + (this.total > 0 ? '+' : '') + this.total, px + 24, py + ph - 18, { size: 18, color: PAL.sun, weight: 800 });
    UI.button(ctx, 'fish', W / 2 - 120, py + ph + 16, 240, 56, 'Let’s fish', () => this.finish(false), { style: 'primary', size: 22, key: 'Enter|Space' });
  }
}
