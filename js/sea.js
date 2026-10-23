'use strict';
/* Keys Crew — out on the water. Drive the boat anywhere around the Upper Keys, seen from above.
   Point where you want to go (drag, or ← →), pick a throttle notch, and find the spots. The starting four
   are on the chart. The rest you have to find by running past them. Captain's points for a good ride. */

const NOTCH = [{ name: 'STOP', v: 0 }, { name: 'IDLE', v: 45 }, { name: 'SLOW', v: 92 }, { name: 'CRUISE', v: 210 }, { name: 'FULL', v: 320 }];
const SEA_KTS = 0.11, UNITS_PER_NM = 400, NO_WAKE = 100;
const SEA_QUIPS = {
  aground: ['Nice parking job.', 'We’re not a skiff, bro!', 'Somebody get out and push.', 'Brown means shallow, Captain.'],
  air: ['WOOOO!', 'Send it!', 'My coffee!', 'Again! Again!'],
  fwc: ['Busted!', 'Officer, he’s new.', 'Told you it was no-wake.'],
  dolphins: ['Dolphins on the bow!', 'Look! Dolphins!'],
  manatee: ['Manatee! Easy, easy.', 'Aww, a manatee.'],
  bump: ['Easy on the boat!', 'That’s gonna leave a mark.'],
  trap: ['Trap line! Again?', 'Somebody grab the knife.'],
  found: ['Never been out here!', 'Mark it on the chart!', 'Ooh. New spot.', 'Look at that water.'],
  far: ['Where are we going, Captain?', 'Hope we brought enough gas.', 'This is a long way out.'],
  arrive: ['Right on the numbers.', 'Smooth, Captain.', 'Drop it right here.']
};
function runDriver() { const c = Trip.cur; return c.mode === 'crew' ? c.crew[(c.legs || 0) % c.crew.length] : c.crew[0]; }
function spotAllowed(id, c = Trip.cur) { if (!c) return false; if (c.mode === 'solo') return true; return !c.done.includes(id) && c.done.length < c.spotsNeeded; }
// where the chart puts the ? for an uncharted spot: near it but not on it, and always close enough that
// driving to the ? finds the spot (found within r + 300, see updateWorld)
function rumorXY(id) {
  const [x, y] = spotXY(id), dx = (hash2(id.length, 3) - 0.5) * 1400, dy = (hash2(3, id.length) - 0.5) * 900;
  const L = Math.hypot(dx, dy), cap = 0.55 * (SPOTS[id].r + 300), k = L > cap ? cap / L : 1;
  return [x + dx * k, y + dy * k];
}
// the creek (or channel) under the Overseas Highway a path goes through first, from (x, y) on: null if it stays on
// this side of the islands
function creekOn(path, x, y, from = 0) {
  if (!path) return null;
  let a = [x, y];
  for (let i = from; i < path.length; i++) {
    const b = path[i], sa = a[1] - chainY(a[0]), sb = b[1] - chainY(b[0]);
    if (sa * sb < 0) { const xm = a[0] + (b[0] - a[0]) * (sa / (sa - sb)), g = GAPS.find((G) => xm > G.x0 - 150 && xm < G.x1 + 150); if (g) return g; }
    a = b;
  }
  return null;
}
const baySide = (x, y) => y < chainY(x);
// the chart's "what do you want to catch?": each lights up its spots
const SPOT_CATS = [
  { id: 'lobster', name: 'Lobster', icon: 'lobster', has: (S) => S.mode === 'bughunt' },
  { id: 'reef', name: 'Reef & wreck', icon: 'redgrouper', has: (S) => S.mode === 'bottom' },
  { id: 'offshore', name: 'Offshore', icon: 'mahi', has: (S) => S.mode === 'troll' },
  { id: 'bay', name: 'Bayside', icon: 'bonefish', has: (S) => S.mode === 'flats' }
];
function spotsLeft() { const c = Trip.cur; return c.mode === 'crew' && c.done.length >= c.spotsNeeded; }

class SeaScene {
  constructor(o = {}) {
    World.build();
    const c = (this.c = Trip.cur); this.o = o;
    if (!c.found) c.found = []; if (!c.legs) c.legs = 0;   // trips saved by older versions
    this.homeRun = !!o.home || spotsLeft();
    this.driver = runDriver();
    this.crew = [this.driver].concat(c.crew.filter((x) => x !== this.driver));
    this.others = this.crew.length > 1 ? this.crew.slice(1) : CHAR_ORDER.filter((x) => x !== this.driver);
    const b = c.boat;
    if (b) { this.x = b.x; this.y = b.y; this.h = b.h; } else { this.x = World.home.x + 10; this.y = World.home.dockY + 4; this.h = Math.PI / 2; }
    this.v = 0; this.notch = 1; this.rudder = 0; this.steer = null;
    this.dest = this.homeRun ? 'home' : null; this.auto = false; this.route = null; this.ri = 0;
    this.cam = { x: this.x, y: this.y, z: 1 };
    this.foam = []; this.trail = []; this.trailT = 0; this.parts = new Particles(); this.fl = new Floaters();
    this.lines = []; this.flags = { aground: 0, bumps: 0, fwc: false, dolphins: false, manatee: false, airs: 0, far: false };
    this.t = 0; this.legDist = 0; this.stuck = 0; this.stall = 0; this.air = null; this.airCd = 0; this.fwc = null; this.speedT = 0; this.msgCd = 0; this.saveT = 0;
    this.quip = null; this.panel = null; this.sel = null; this.dolphins = null; this.manatee = null; this.zone = null; this.bumpCd = 0;
    const wx = c.weather || { id: 'light' };
    this.wind = { chop: wx.id === 'glass' ? 0.12 : wx.id === 'breezy' ? 1 : 0.5, ang: 2.5 };
    this.boats = []; this.spawnBoats();
    this.inSpot = null; this.atHome = false;
    this.view = Store.get('seaView', 'chase') === 'top' ? 'top' : 'chase';
    // a run picked back up: from the hand-off (Back to the boat) it keeps its distance and its record; from the title
    // the boat also keeps its course and autopilot
    const L = c.legBack || (b && b.run);
    if (L && typeof L === 'object' && Array.isArray(L.lines)) { this.legDist = +L.dist || 0; Object.assign(this.flags, L.flags || {}); this.lines = L.lines.slice(); }
    if (c.legBack) { this.reopened = true; c.legBack = null; }
    if (b && !this.homeRun && b.home) this.homeRun = true;
    if (b && (b.dest === 'home' || (b.dest && SPOTS[b.dest] && spotAllowed(b.dest, c)))) { this.dest = b.dest; this.wantAuto = !!b.auto; }
    if (this.homeRun) this.dest = 'home';
    // a crew passes the phone: a new run opens on a card for its captain, unless the captain is already holding it
    // (fished last). A run picked back up (Back to the boat, or from the title) goes straight on.
    const last = c.turns.filter((u) => SPOTS[u.spot]).pop();
    if (c.mode === 'crew' && c.crew.length > 1 && !this.reopened && !(b && b.run) && (!last || last.ch !== this.driver)) this.panel = { kind: 'captain', t: 0 };
  }
  enter() {
    Music.play(this.homeRun ? 'sunset' : 'run'); SFX.setAmbient(0.7, false);
    if (!this.panel) this.greet();
    if (this.dest) this.planRoute();
    if (this.wantAuto && this.route) { this.auto = true; this.notch = 3; }
    this.wantAuto = false;
    Chase.reset(this);
  }
  // the captain has the phone: the card goes, the clock for the steering tip starts, and the toast says what's next
  takeWheel() { this.panel = null; this.t = 0; this.greet(); }
  greet() {
    const C = CHARS[this.driver];
    if (this.homeRun) Game.toast('Heading home', { color: PAL.sun, size: 40, y: 150, sub: 'Captain ' + C.name + ', take us back to the dock in Tavernier' });
    else if (this.reopened) Game.toast('Captain ' + C.name, { color: PAL.sun, size: 40, y: 150, sub: 'Still your run. Pick a spot on the chart.' });
    else if (!this.c.legs) Game.toast('Cast off!', { color: PAL.sun, size: 44, y: 150, sub: 'Captain ' + C.name + ' at the wheel. Idle out of the canal.' });
    else Game.toast('Captain ' + C.name, { color: PAL.sun, size: 40, y: 150, sub: spotsLeft() ? '' : 'Pick the next spot on the chart, or go exploring' });
  }
  exit() { SFX.setEngine(0); SFX.setAmbient(0); this.saveBoat(); }
  // where the boat is and the run so far, so quitting mid-run and resuming from the title picks it all back up
  saveBoat() {
    const run = this.done ? null : { dist: this.legDist, flags: Object.assign({}, this.flags), lines: this.lines.filter((l) => !l.end) };
    this.c.boat = { x: this.x, y: this.y, h: this.h, dest: this.dest || null, auto: !!this.auto, home: !!this.homeRun, run };
    Trip.save();
  }
  toggleView() { this.view = this.view === 'chase' ? 'top' : 'chase'; Store.set('seaView', this.view); Chase.reset(this); this.steer = null; }
  // the view behind the boat is drawn in 3D when this device can (sea3d.js), else the classic 2D chase view
  uses3D() { return this.view === 'chase' && Sea3D.ready(); }
  // where the boat is on screen, for effects that pop off it
  boatScreen() { return this.view === 'chase' ? [Game.W / 2, CAM.BOAT_SY - 20] : this.toScreen(this.x, this.y); }
  say(kind, p = 1) { if (!chance(p) || !SEA_QUIPS[kind]) return; this.quip = { who: pick(this.others), msg: pick(SEA_QUIPS[kind]), t: 2.8 }; }

  /* ---------- where things are ---------- */
  destXY() {
    if (this.dest === 'home') return [World.home.x, World.home.dockY + 20];
    if (this.dest) return spotXY(this.dest);
    return null;
  }
  areaName() {
    const s = this.y - chainY(this.x), d = World.gridDepth(this.x, this.y);
    if (this.zone) return this.zone.name;
    if (s < -3800) return 'The Everglades';
    if (s < 0) return 'Florida Bay';
    if (s < 1250) return 'Hawk Channel';
    if (s < 2250) return 'Patch reefs';
    if (s < 2600) return 'The reef line';
    if (d < 300) return 'The drop-off';
    return s > 4300 ? 'The Gulf Stream' : 'Offshore';
  }
  spawnBoats() {
    for (let i = 0; i < 5; i++) this.boats.push(this.newBoat(true));
  }
  newBoat(any) {
    for (let k = 0; k < 40; k++) {
      const a = rand(0, TAU), r = any ? rand(900, 3200) : rand(1700, 2600), x = this.x + Math.cos(a) * r, y = this.y + Math.sin(a) * r;
      if (x < 100 || y < 100 || x > WORLD.W - 100 || y > WORLD.H - 100) continue;
      if (World.gridDepth(x, y) < 8) continue;
      return { x, y, h: rand(0, TAU), v: rand(150, 250), turn: 0, trail: [], trailT: 0, hull: pick(['#ffffff', '#e8e2d0', '#d8e6ef', '#f4f0e8']), big: chance(0.3) };
    }
    return { x: -9999, y: -9999, h: 0, v: 0, turn: 0, trail: [], trailT: 0, hull: '#fff', dead: true };
  }

  /* ---------- route planning: A* over the depth grid ---------- */
  // the way from the boat to (tx, ty). Leave and come home straight down the middle of Tavernier harbor channel,
  // like everybody does
  routeTo(tx, ty, home) {
    const Hm = World.home, mouth = [Hm.x, Hm.mouthY + 30], outer = [Hm.x, wy(Hm.x, Hm.hw + 640)], inHarbor = World.zones[0], inside = (x, y) => x > inHarbor.x0 && x < inHarbor.x1 && y > inHarbor.y0 && y < inHarbor.y1;
    if (home) {
      if (inside(this.x, this.y)) return [[Hm.x, this.y < Hm.mouthY ? this.y : Hm.mouthY + 30], [Hm.x, Hm.dockY + 20]];
      const p = World.findPath(this.x, this.y, outer[0], outer[1]); return p && p.concat([mouth, [Hm.x, Hm.dockY + 20]]);
    }
    if (inside(this.x, this.y)) { const p = World.findPath(outer[0], outer[1], tx, ty); return p && (this.y < Hm.mouthY ? [[Hm.x, Hm.mouthY - 10], mouth, outer] : [mouth, outer]).concat(p); }
    return World.findPath(this.x, this.y, tx, ty);
  }
  planRoute(quiet) {
    const xy = this.destXY(); if (!xy) { this.route = null; return; }
    const path = this.routeTo(xy[0], xy[1], this.dest === 'home');
    this.route = path; this.ri = 0; this.path = path ? [[this.x, this.y]].concat(path) : null;
    if (!path && !quiet) Game.toast('No clear way through', { color: PAL.warn, size: 26, y: 170, sub: 'Steer it yourself. Follow the deeper (darker) water.' });
  }
  // where the boat is along the course: the nearest of the next few legs, so ri moves on as you pass them
  nearRoute() {
    const P = this.path, N = P.length - 1; let best = 1e9, bi = this.ri, bt = 0;
    for (let i = this.ri; i < Math.min(N, this.ri + 4); i++) {
      const [ax, ay] = P[i], [bx, by] = P[i + 1], vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy || 1, k = clamp(((this.x - ax) * vx + (this.y - ay) * vy) / l2, 0, 1), d = Math.hypot(this.x - ax - vx * k, this.y - ay - vy * k);
      if (d < best) { best = d; bi = i; bt = k; }
    }
    return { best, bi, bt };
  }
  // the point dist0 farther along the course from leg bi (bt of the way along it): [x, y, leg]
  alongRoute(bi, bt, dist0) {
    const P = this.path, N = P.length - 1; if (N < 1) return [P[0][0], P[0][1], 0];
    let L = dist0, i = bi, k = bt;
    for (;;) { const [ax, ay] = P[i], [bx, by] = P[i + 1], seg = Math.hypot(bx - ax, by - ay) || 1, rem = seg * (1 - k); if (L <= rem || i === N - 1) { const q = Math.min(1, k + L / seg); return [ax + (bx - ax) * q, ay + (by - ay) * q, i]; } L -= rem; i++; k = 0; }
  }
  // where the arrow points: a little way along the course (around the islands and through a creek, not across
  // them), or straight at the destination when there's no course or you've wandered well off it
  guideXY() {
    const xy = this.destXY(); if (!xy) return null;
    if (!this.path || this.path.length < 2) return xy;
    const r = this.nearRoute(); if (r.best > 420) return xy;
    const g = this.alongRoute(r.bi, r.bt, 520); return [g[0], g[1]];
  }
  setAuto(on) {
    if (on) this.planRoute();
    this.auto = on && !!this.route;
    if (this.auto && this.notch < 3) this.notch = 3;
    SFX.play('click');
  }

  /* ---------- input ---------- */
  setNotch(n) { if (this.fwc || this.panel) return; const was = this.notch; this.notch = clamp(n, 0, 4); if (was !== this.notch) SFX.play('click'); }
  pointerDown(p) { if (this.panel) return; this.steer = { id: p.id, x: p.x, y: p.y, sx: p.x, sy: p.y, t0: this.t }; }
  // a finger on the water steers; with the autopilot on, only a hold or a drag takes the wheel (a stray tap from a
  // phone being passed around doesn't)
  steerLive() { const s = this.steer; return !!s && (!this.auto || this.t - s.t0 >= 0.25 || dist(s.x, s.y, s.sx, s.sy) > 30); }
  pointerMove(p) { if (this.steer && this.steer.id === p.id) { this.steer.x = p.x; this.steer.y = p.y; } }
  pointerUp(p) { if (this.steer && this.steer.id === p.id) this.steer = null; }
  keyDown(c) {
    if (c === 'Escape') { if (this.panel && this.panel.kind === 'captain') this.takeWheel(); else if (this.panel && this.panel.kind !== 'summary') { this.panel = null; this.sel = null; } else if (!this.panel) this.panel = { kind: 'pause' }; return; }
    if (this.panel) return;
    if (c === 'KeyM' || c === 'Tab') { this.openChart(); return; }
    if (c === 'ArrowUp' || c === 'KeyW') this.setNotch(this.notch + 1);
    if (c === 'ArrowDown' || c === 'KeyS') this.setNotch(this.notch - 1);
    if (/^Digit[1-5]$/.test(c)) this.setNotch(+c.slice(5) - 1);
  }
  // light up one kind of spot and pick the closest one you can fish today (or the ? to go find); again turns it off
  pickCat(id) {
    SFX.play('tick');
    if (this.filt === id) { this.filt = null; return; }
    this.filt = id;
    const K = SPOT_CATS.find((k) => k.id === id), ids = SPOT_ORDER.filter((x) => K.has(SPOTS[x])), far = (x) => { const [px, py] = spotXY(x); return dist(this.x, this.y, px, py); };
    const open = ids.filter((x) => Charts.isKnown(x) && (this.homeRun || spotAllowed(x, this.c))).sort((a, b) => far(a) - far(b));
    this.sel = open[0] || ids.find((x) => !Charts.isKnown(x)) || ids[0] || null;
  }
  // the way to whatever's picked on the chart, drawn before you set course (one route per pick)
  previewPath() {
    const sel = this.sel; if (!sel || (sel === this.dest && this.route)) return null;
    const P = this.prev;
    if (P && P.sel === sel && dist(P.x, P.y, this.x, this.y) < 150) return P.path;
    const [tx, ty] = sel === 'home' ? [World.home.x, World.home.dockY + 20] : Charts.isKnown(sel) ? spotXY(sel) : rumorXY(sel);
    this.prev = { sel, x: this.x, y: this.y, path: this.routeTo(tx, ty, sel === 'home') };
    return this.prev.path;
  }
  // which creek the way there goes through, when it's on the other side of the islands
  wayTo(sel) {
    if (sel === this.dest && this.route) return this.via;
    return creekOn(this.previewPath(), this.x, this.y);
  }
  openChart() { this.panel = { kind: 'chart' }; this.sel = this.dest && this.dest !== 'home' ? this.dest : null; this.steer = null; SFX.play('tick'); }

  /* ---------- update ---------- */
  update(dt) {
    this.t += dt; World.update(dt); this.parts.update(dt); this.fl.update(dt);
    if (this.quip) { this.quip.t -= dt; if (this.quip.t <= 0) this.quip = null; }
    this.msgCd = Math.max(0, this.msgCd - dt); this.airCd = Math.max(0, this.airCd - dt);
    if (this.panel && this.panel.kind !== 'chart') { SFX.setEngine(1, this.v / 600); this.updateFoam(dt); return; }
    if (this.panel) { this.v = approach(this.v, 0, 1.5, dt); }
    // steering
    let rud = 0;
    if (Input.held('ArrowLeft', 'KeyA')) rud -= 1; if (Input.held('ArrowRight', 'KeyD')) rud += 1;
    const live = this.steerLive();
    if (live && this.view === 'chase') {   // behind the boat: hold left or right of it to turn that way, harder the farther out
      const dx = this.steer.x - Game.W / 2; if (Math.abs(dx) > 14) rud = clamp((dx - Math.sign(dx) * 14) / (Game.W * 0.2), -1, 1);
    } else if (live) {
      const [sx, sy] = this.toScreen(this.x, this.y), want = Math.atan2(this.steer.y - sy, this.steer.x - sx);
      if (dist(sx, sy, this.steer.x, this.steer.y) > 24) rud = clamp(angleDiff(this.h, want) * 2.4, -1, 1);
    }
    if (rud) {
      if (this.auto) { this.auto = false; Game.toast('Autopilot off', { size: 22, y: 170, color: '#fff' }); }
      (this.c.steered || (this.c.steered = {}))[this.driver] = true;   // this captain has the hang of it: no more steering tip
    }
    // autopilot
    let cap = 999;
    if (this.auto && this.path && !this.panel) {
      // pure pursuit: find where we are along the route, aim at a point a little farther along it
      const P = this.path, N = P.length - 1, { best, bi, bt } = this.nearRoute();
      if (best > 420) { this.planRoute(); return; }     // knocked way off course: plot it again
      this.ri = bi;
      const along = (dist0) => this.alongRoute(bi, bt, dist0);
      const [px, py] = along(clamp(70 + this.v * 0.35, 90, 170));
      const off = angleDiff(this.h, Math.atan2(py - this.y, px - this.x));
      rud = clamp(off * 2.6, -1, 1);
      // slow down for the bends coming up, and for whatever's in the way
      let bend = 0; { let h0 = Math.atan2(P[bi + 1][1] - P[bi][1], P[bi + 1][0] - P[bi][0]); const [, , j] = along(300); for (let i = bi + 1; i <= j && i < N; i++) { const h1 = Math.atan2(P[i + 1][1] - P[i][1], P[i + 1][0] - P[i][0]); bend = Math.max(bend, Math.abs(angleDiff(h0, h1))); h0 = h1; } }
      if (bend > 0.5 || Math.abs(off) > 0.5) cap = NOTCH[2].v; if (bend > 1.1 || Math.abs(off) > 1.1) cap = NOTCH[1].v;
      if (World.inZone(this.x, this.y) || World.inZone(this.x + Math.cos(this.h) * 200, this.y + Math.sin(this.h) * 200)) cap = Math.min(cap, NOTCH[2].v);
      if (World.gridDepth(this.x + Math.cos(this.h) * 160, this.y + Math.sin(this.h) * 160) < 5 || this.shallowAhead() < 2.6) cap = Math.min(cap, 130);   // off plane over a reef crown it would clip
      const end = P[N], left = dist(this.x, this.y, end[0], end[1]);
      if (left < 260) cap = Math.min(cap, NOTCH[2].v);
      if (left < 70 || (bi === N - 1 && bt > 0.98)) { this.auto = false; this.notch = 0; Game.toast('Arrived', { size: 30, y: 160, color: PAL.good }); }
      const ca = Math.cos(this.h), sa = Math.sin(this.h), dodge = (ox, oy, r) => { const fx = ox - this.x, fy = oy - this.y, fwd = fx * ca + fy * sa, lat = -fx * sa + fy * ca; if (fwd > 10 && fwd < 150 && Math.abs(lat) < r + 20) { rud = clamp(rud - Math.sign(lat || 1) * 0.8, -1, 1); cap = Math.min(cap, NOTCH[2].v); } };
      for (const f of World.floatsNear(this.x)) if (!f.hit) dodge(f.x, f.y, 8);
      for (const p of World.piers) if (Math.abs(p.x - this.x) < 180 && Math.abs(p.y - this.y) < 180) dodge(p.x, p.y, 10);
      if (Math.abs(World.light.x - this.x) < 240 && Math.abs(World.light.y - this.y) < 240) dodge(World.light.x, World.light.y, 46);
      // stuck against something: back off, point at the route, and plot it again
      if (this.v < 6 && cap > 30 && NOTCH[this.notch].v > 30 && !this.stall && !this.stuck && !this.fwc) { this.stuckT = (this.stuckT || 0) + dt; if (this.stuckT > 1.2) { this.stuckT = 0; this.x -= Math.cos(this.h) * 24; this.y -= Math.sin(this.h) * 24; this.h = Math.atan2(py - this.y, px - this.x); this.planRoute(); } } else this.stuckT = 0;
    }
    // steering it yourself with a course set: keep up with where you are along it (the arrow and the course line
    // follow it), and plot it again from here once you've wandered well off it
    if (!this.auto && this.path && this.dest && !this.panel) {
      const r = this.nearRoute(); this.reT = Math.max(0, (this.reT || 0) - dt);
      if (r.best <= 420) this.ri = r.bi;
      else if (!this.reT && this.v > 5) { this.reT = 3; this.planRoute(true); }
    }
    this.via = this.dest && this.path ? creekOn(this.path, this.x, this.y, this.ri + 1) : null;
    this.rudder = approach(this.rudder, rud, 8, dt);
    // throttle
    let target = Math.min(NOTCH[this.notch].v, cap);
    if (this.panel) target = 0;
    if (this.fwc) target = 0;
    if (this.stuck > 0) { this.stuck -= dt; target = 0; this.v = 0; }
    if (this.stall > 0) { this.stall -= dt; target = 0; }
    this.v = this.v < target ? Math.min(target, this.v + 120 * dt) : Math.max(target, this.v - 210 * dt);
    const turn = this.rudder * (0.75 + 1.0 * clamp(this.v / 200, 0, 1)) * (this.v < 10 ? 0.75 : 1);
    this.h += turn * dt;
    this.move(dt);
    // camera: look ahead, zoom out with speed
    const look = clamp(this.v * 0.6, 0, 200), zt = lerp(1.05, 0.68, clamp(this.v / 320, 0, 1));
    this.cam.x = approach(this.cam.x, this.x + Math.cos(this.h) * look, 3.2, dt);
    this.cam.y = approach(this.cam.y, this.y + Math.sin(this.h) * look, 3.2, dt);
    this.cam.z = approach(this.cam.z, zt, 1.2, dt);
    // sound
    SFX.setEngine(1, this.v / 320); SFX.setAmbient(0.35 + this.v / 600, false);
    // the hull slapping through the chop when we're running
    this.slapT = (this.slapT || 0) - dt;
    if (this.v > 120 && this.wind.chop > 0.3 && !this.air && this.slapT <= 0) { this.slapT = rand(0.5, 1.5) / (0.6 + this.wind.chop); SFX.play('slap', clamp(this.v / 320 * this.wind.chop * 1.4, 0.3, 1)); }
    this.updateWorld(dt);
    this.updateFoam(dt);
    Chase.update(this, dt);
    this.saveT += dt; if (this.saveT > 3) { this.saveT = 0; this.saveBoat(); }
  }
  toScreen(x, y) { const z = this.cam.z; return [(x - this.cam.x) * z + Game.W / 2, (y - this.cam.y) * z + Game.H / 2]; }
  move(dt) {
    const ca = Math.cos(this.h), sa = Math.sin(this.h);
    const nx = clamp(this.x + ca * this.v * dt, 60, WORLD.W - 60), ny = clamp(this.y + sa * this.v * dt, 60, WORLD.H - 60);
    const bx = nx + ca * 46, by = ny + sa * 46;
    const db = World.depth(bx, by), dc = World.depth(nx, ny);
    if (db <= 0.2 || dc <= 0.2) {
      if (this.v > 70) this.bump('Bumped the shore!'); else if (!this.msgCd) { this.msgCd = 2; Game.toast('Land ho!', { size: 24, y: 170, color: '#fff', sub: 'Turn around' }); }
      this.v = 0; this.x -= ca * 4; this.y -= sa * 4; return;
    }
    if (db < 1.0) {
      this.v = 0; this.x -= ca * 4; this.y -= sa * 4;
      if (!this.msgCd) { this.msgCd = 2.5; Game.toast('Too shallow!', { color: PAL.warn, size: 30, y: 170, sub: 'Back off and find deeper water. The channels are darker.' }); }
      return;
    }
    if (db < 2.6 && this.v > 150 && !this.stuck) { this.runAground(); return; }
    // piers, markers and the lighthouse
    const hard = [];
    for (const p of World.piers) if (Math.abs(p.x - nx) < 80 && Math.abs(p.y - ny) < 80) hard.push([p.x, p.y, 9, true]);
    if (!this.auto) for (const m of World.markers) if (Math.abs(m.x - nx) < 80 && Math.abs(m.y - ny) < 80) hard.push([m.x, m.y, 6]);   // the autopilot threads the channel posts
    if (Math.abs(World.light.x - nx) < 120 && Math.abs(World.light.y - ny) < 120) hard.push([World.light.x, World.light.y, 44]);
    for (const [hx, hy, r, pier] of hard) {
      const dd = Math.min(dist(bx, by, hx, hy), dist(nx, ny, hx, hy), dist(nx - ca * 40, ny - sa * 40, hx, hy));
      if (dd < r + 15) {
        const a = Math.atan2(ny - hy, nx - hx); this.x = hx + Math.cos(a) * (r + 30); this.y = hy + Math.sin(a) * (r + 30);
        if (this.v > 40) this.bump(pier ? 'Clipped a bridge piling!' : 'Bumped a marker!'); this.v *= 0.3; return;
      }
    }
    for (const f of World.floatsNear(nx)) {
      if (!f.hit && dist(bx, by, f.x, f.y) < 16 && this.v > 20) {
        f.hit = true; this.stall = 2.2; this.flags.bumps++;
        Game.toast('Wrapped a trap line!', { color: PAL.warn, size: 32, y: 170, sub: 'Cutting it off the prop…' }); SFX.play('fail'); Game.shake(4); this.say('trap', 0.7);
      }
    }
    // wakes from other boats: airtime if you hit one fast
    for (const B of this.boats) {
      const tr = B.trail; if (!tr.length || dist(nx, ny, B.x, B.y) > 900) continue;
      for (let i = 1; i < tr.length; i++) {
        const a = tr[i - 1], b = tr[i], age = this.t - b.t; if (age < 0.3 || age > 4) continue;
        if (segCross(this.x, this.y, nx, ny, a.x, a.y, b.x, b.y)) { this.hitWake(); break; }
      }
    }
    this.legDist += dist(this.x, this.y, nx, ny);
    this.x = nx; this.y = ny;
  }
  hitWake() {
    if (this.airCd > 0) return; this.airCd = 1.2;
    if (this.v > 220 && !this.air) {
      this.air = { t: 0, dur: 0.75 }; this.flags.airs++;
      if (this.flags.airs <= 4) this.lines.push({ label: 'Airtime off a wake', pts: 25 });
      const [fx, fy] = this.boatScreen(); this.fl.add(fx, fy - 70, 'AIRTIME! +25', PAL.sun, 26); SFX.play('woo'); this.say('air', 0.8);
    } else { Game.shake(3); SFX.play('slap', 1.6); }
  }
  bump(msg) {
    if (this.bumpCd > this.t) return; this.bumpCd = this.t + 1;
    this.flags.bumps++; Game.shake(6); SFX.play('bump'); Game.toast(msg, { color: PAL.warn, size: 28, y: 170 }); this.say('bump', 0.6);
  }
  runAground() {
    this.stuck = 2.6; this.v = 0; this.flags.aground++;
    const bay = this.y < chainY(this.x), bx = this.x + Math.cos(this.h) * 46, by = this.y + Math.sin(this.h) * 46, reef = !bay && nearReefCrown(bx, by);
    const [px, py] = this.boatScreen();
    this.parts.burst(px, py + 10, 20, { color: bay ? 'rgba(140,110,70,0.7)' : 'rgba(230,210,160,0.8)', min: 30, max: 120, life: 1.2, drag: 1.5 });
    Game.toast('Ran aground!', { color: PAL.coral, size: 40, y: 170, sub: reef ? 'That’s a patch reef. Brown water means shallow.' : 'Too fast over the flats. Go slow over light water.' });
    SFX.play('bigsplash'); Game.shake(9, 0.5); Game.vibrate(150); this.say('aground');
    if (this.flags.aground === 1) this.lines.push({ label: 'Ran aground', pts: -25 });
    this.x -= Math.cos(this.h) * 20; this.y -= Math.sin(this.h) * 20;
  }
  pullOver() {
    this.flags.fwc = true; this.fwc = { t: 3.4, k: 0 }; this.notch = 1; this.auto = false;
    this.lines.push({ label: 'FWC warning: speeding in a no-wake zone', pts: -50 });
    SFX.play('siren'); Game.toast('FWC pulled you over!', { color: '#7fb8ff', size: 38, y: 170, sub: 'No-wake zone: idle speed only. (−50)' }); this.say('fwc');
  }
  updateWorld(dt) {
    const c = this.c;
    // no-wake zones and FWC
    this.zone = World.inZone(this.x, this.y);
    // speeding in a no-wake zone: the officer waves you down once, then writes it up if you keep going
    if (this.zone && this.v > NO_WAKE && !this.flags.fwc) {
      this.speedT += dt;
      if (this.speedT > 1.3 && !this.warned) { this.warned = true; SFX.play('siren'); Game.toast('FWC is watching!', { color: '#7fb8ff', size: 32, y: 170, sub: 'Officer: “Slow it down, Captain.” Idle in no-wake zones.' }); }
      if (this.speedT > 4) this.pullOver();
    } else this.speedT = Math.max(0, this.speedT - dt);
    if (this.fwc) { this.fwc.t -= dt; this.fwc.k = Math.min(1, this.fwc.k + dt * 1.2); if (this.fwc.t <= 0) this.fwc = null; }
    if (this.air) { this.air.t += dt; if (this.air.t >= this.air.dur) { this.air = null; SFX.play('bigsplash'); Game.shake(5); Chase.splash(this); for (let i = 0; i < 18; i++) this.foam.push(this.foamBlob(this.x + rand(-30, 30), this.y + rand(-30, 30), rand(-60, 60), rand(-60, 60), rand(8, 18), 1.2)); } }
    // discover uncharted spots by running past them
    for (const id of SPOT_ORDER) {
      if (Charts.isKnown(id)) continue;
      const [sx, sy] = spotXY(id);
      if (dist(this.x, this.y, sx, sy) < SPOTS[id].r + 300) {
        Charts.add(id); if (!c.found.includes(id)) c.found.push(id);
        this.lines.push({ label: 'Found ' + SPOTS[id].name, pts: 75 });
        Game.toast('NEW SPOT: ' + SPOTS[id].name, { color: PAL.sun, size: 40, y: 140, dur: 2.6, sub: SPOTS[id].kind + ' · it’s on the chart now (+75)' });
        SFX.play('found'); this.say('found'); Trip.save();
        bountyToast(Bounties.found(id, this.driver));   // "find a new spot" pays the captain straight away
      }
    }
    // which spot (or the dock) are we sitting on?
    this.inSpot = null;
    if (!this.homeRun) for (const id of SPOT_ORDER) { if (!Charts.isKnown(id)) continue; const [sx, sy] = spotXY(id); if (dist(this.x, this.y, sx, sy) < SPOTS[id].r) { this.inSpot = id; break; } }
    this.atHome = dist(this.x, this.y, World.home.x, World.home.dockY + 30) < 150;
    // the long way out
    if (!this.flags.far && this.legDist > UNITS_PER_NM * 10) { this.flags.far = true; this.say('far', 0.7); }
    // dolphins come ride the bow when you're running in deep water
    const deep = World.gridDepth(this.x, this.y) > 12;
    if (!this.flags.dolphins && !this.dolphins && deep && this.v >= 150 && this.t > 8 && chance(dt * 0.07)) {
      this.dolphins = { t: 0, dur: 6, pod: [0, 1, 2].map((i) => ({ ox: rand(50, 110), oy: (i - 1) * 46 + rand(-8, 8), ph: rand(0, TAU) })) };
      this.flags.dolphins = true; this.lines.push({ label: 'Dolphins rode the bow wake', pts: 25 }); this.fl.add(this.boatScreen()[0], this.boatScreen()[1] - 80, 'Dolphins! +25', '#bff0ff', 22); this.say('dolphins'); SFX.play('dolphin');
    }
    if (this.dolphins) { this.dolphins.t += dt; if (this.dolphins.t > this.dolphins.dur) this.dolphins = null; }
    // manatees in the canals and the shallows near shore
    const shoreS = Math.abs(this.y - chainY(this.x)) - shoreHW(this.x);
    if (!this.flags.manatee && !this.manatee && (this.zone || shoreS < 600) && this.t > 3 && chance(dt * 0.08)) {
      const ax = this.x + Math.cos(this.h) * 300, ay = this.y + Math.sin(this.h) * 300;
      if (World.depth(ax, ay) > 3) this.manatee = { x: ax, y: ay, t: 0, h: this.h + rand(-1, 1) };
    }
    if (this.manatee) {
      const m = this.manatee; m.t += dt; m.x += Math.cos(m.h) * 8 * dt; m.y += Math.sin(m.h) * 8 * dt;
      if (!this.flags.manatee && dist(this.x, this.y, m.x, m.y) < 170) {
        this.flags.manatee = true;
        if (this.v <= NO_WAKE) { this.lines.push({ label: 'Went slow for a manatee', pts: 25 }); this.fl.add(this.boatScreen()[0], this.boatScreen()[1] - 80, 'Manatee +25', '#d8f0e8', 22); this.say('manatee'); SFX.play('coin'); }
        else Game.toast('Manatee! Slow down!', { color: PAL.warn, size: 28, y: 170 });
      }
      if (m.t > 24) this.manatee = null;
    }
    // other boats wander, avoid land, and leave wakes to jump
    for (let i = 0; i < this.boats.length; i++) {
      const B = this.boats[i];
      if (B.dead || dist(B.x, B.y, this.x, this.y) > 4200) { this.boats[i] = this.newBoat(false); continue; }
      const ax = B.x + Math.cos(B.h) * 220, ay = B.y + Math.sin(B.h) * 220;
      if (World.gridDepth(ax, ay) < 7) { const l = World.gridDepth(B.x + Math.cos(B.h - 0.8) * 220, B.y + Math.sin(B.h - 0.8) * 220), r = World.gridDepth(B.x + Math.cos(B.h + 0.8) * 220, B.y + Math.sin(B.h + 0.8) * 220); B.turn = l > r ? -1.2 : 1.2; }
      else if (dist(B.x, B.y, this.x, this.y) < 240) B.turn = angleDiff(B.h, Math.atan2(B.y - this.y, B.x - this.x)) > 0 ? 1 : -1;
      else B.turn = approach(B.turn, Math.sin(this.t * 0.2 + i) * 0.15, 1, dt);
      B.h += B.turn * dt;
      const z = World.inZone(B.x, B.y), sp = z ? 70 : B.v;
      B.x += Math.cos(B.h) * sp * dt; B.y += Math.sin(B.h) * sp * dt;
      if (World.depth(B.x, B.y) < 2) { B.h += Math.PI; }
      B.trailT -= dt; if (B.trailT <= 0) { B.trailT = 0.12; B.trail.push({ x: B.x - Math.cos(B.h) * 40, y: B.y - Math.sin(B.h) * 40, t: this.t }); if (B.trail.length > 36) B.trail.shift(); }
      if (sp > 100 && chance(dt * 30)) this.spawnFoam(B.x, B.y, B.h, sp, B.big ? 1.2 : 0.9);
    }
    this.trailT -= dt;
    if (this.trailT <= 0) { this.trailT = 0.05; if (this.v > 12) this.trail.push({ x: this.x - Math.cos(this.h) * 42, y: this.y - Math.sin(this.h) * 42, h: this.h, v: this.v, t: this.t }); }
    while (this.trail.length && this.t - this.trail[0].t > 4) this.trail.shift();
    if (this.v > 60 && chance(dt * 12)) this.spawnFoam(this.x, this.y, this.h, this.v, 1);
    if (this.v > 160 && chance(dt * 26)) { const bx = this.x + Math.cos(this.h) * 40, by = this.y + Math.sin(this.h) * 40, side = chance(0.5) ? 1 : -1; this.foam.push(this.foamBlob(bx, by, Math.cos(this.h + side * 1.4) * 90, Math.sin(this.h + side * 1.4) * 90, rand(3, 6), 0.5)); }
  }
  foamBlob(x, y, vx, vy, r, life) { return { x, y, vx, vy, r, t: 0, life, grow: r * 0.8 }; }
  spawnFoam(x, y, h, v, s) {
    const ca = Math.cos(h), sa = Math.sin(h), sx = x - ca * 44 * s, sy = y - sa * 44 * s, k = clamp(v / 320, 0, 1);
    if (this.foam.length > 420) return;
    for (const side of [-1, 1]) {
      const px = -sa * side, py = ca * side;
      this.foam.push(this.foamBlob(sx + px * 14 * s, sy + py * 14 * s, px * (12 + 40 * k), py * (12 + 40 * k), (3 + 5 * k) * s, 2.2 + 2 * k));
    }
    this.foam.push(this.foamBlob(sx, sy, -ca * 10, -sa * 10, (4 + 6 * k) * s, 1.2 + 1.6 * k));
  }
  updateFoam(dt) {
    for (const f of this.foam) { f.t += dt; f.x += f.vx * dt; f.y += f.vy * dt; f.vx *= 1 - dt * 0.9; f.vy *= 1 - dt * 0.9; f.r += f.grow * dt; }
    this.foam = this.foam.filter((f) => f.t < f.life);
  }

  // the shallowest water the bow reaches in the next 1.6 s at this speed: the same depth and the same 2.6 ft that
  // run the boat aground (move), so the banner shows exactly when holding course would ground you. Checked 10x a second.
  shallowAhead() {
    if (this.t < (this.shallowT || 0)) return this.shallowD;
    this.shallowT = this.t + 0.1;
    const ca = Math.cos(this.h), sa = Math.sin(this.h), reach = 46 + Math.max(120, this.v * 1.6);
    let m = 99; for (let d = 46; d <= reach; d += 20) { const dd = World.depth(this.x + ca * d, this.y + sa * d); if (dd > 0 && dd < m) m = dd; }
    return (this.shallowD = m);
  }

  /* ---------- arriving ---------- */
  arrive(id) {
    this.auto = false; this.notch = 0; this.v = 0;
    this.lines = this.lines.filter((l) => !l.end);   // arriving again after Back to the boat: the end-of-run lines are counted fresh
    if (this.legDist > UNITS_PER_NM * 1.5) this.lines.push({ label: 'Ran ' + (this.legDist / UNITS_PER_NM).toFixed(1) + ' nm', pts: Math.min(100, Math.round(this.legDist / UNITS_PER_NM) * 5), end: true });
    if (!this.flags.aground && !this.flags.fwc && !this.flags.bumps && this.legDist > UNITS_PER_NM * 3) this.lines.push({ label: 'Clean run · no bumps, no tickets', pts: 50, end: true });
    this.total = this.lines.reduce((a, l) => a + l.pts, 0);
    this.panel = { kind: 'summary', id, t: 0 };
    SFX.play(this.total > 0 ? 'catch' : 'click'); this.say('arrive', 0.6);
  }
  finishLeg(skipped, id = this.panel && this.panel.id) {
    if (this.done) return; this.done = true;
    const c = this.c, pts = skipped ? 0 : this.total || 0;
    if (pts) { c.scores[this.driver] = (c.scores[this.driver] || 0) + pts; c.turns.push({ ch: this.driver, spot: 'run:' + id, total: pts, n: 0 }); }
    c.legs = (c.legs || 0) + 1;
    if (id === 'home') { this.saveBoat(); Game.go(new DayEndScene()); return; }
    // kept until someone fishes here, so Back to the boat can hand the same captain the same run (reopenLeg)
    c.leg = { ch: this.driver, spot: id, pts, dist: skipped ? 0 : this.legDist, flags: Object.assign({}, this.flags), lines: skipped ? [] : this.lines.filter((l) => !l.end) };
    c.spot = id; c.turn = 0; c.first = Math.max(0, c.crew.indexOf(this.driver)); this.dest = null; this.auto = false; this.saveBoat(); Game.go(new TurnIntroScene());
  }
  // skipping the ride goes straight on to the hand-off (or, going home, the end of the day): nothing happened on the
  // way, so there's no summary to read. The empty panel keeps the controls still while the screen fades.
  skipTo(id) {
    const [sx, sy] = id === 'home' ? [World.home.x + 10, World.home.dockY + 4] : spotXY(id);
    this.x = sx + (id === 'home' ? 0 : -60); this.y = sy + (id === 'home' ? 0 : 30); this.cam.x = this.x; this.cam.y = this.y;
    this.lines = []; this.total = 0; this.trail = []; this.foam = []; this.panel = { kind: 'skipped', id };
    this.auto = false; this.finishLeg(true, id);
  }

  /* ---------- drawing ---------- */
  draw(ctx) {
    const W = Game.W, H = Game.H, t = this.t, in3d = this.uses3D();
    GFX.count(performance.now());
    if (this.view === 'chase') { if (in3d) Sea3D.draw(this, ctx, W, H, t); else Chase.draw(this, ctx, W, H, t); } else this.drawTop(ctx, W, H, t);
    this.parts.draw(ctx);
    // the light: morning, midday, afternoon, sunset on the way home (the 3D sky does its own)
    const legs = this.c.legs || 0;
    const tint = in3d ? [null, null] : this.homeRun ? ['rgba(255,120,60,0.2)', 'rgba(40,20,80,0.12)'] : legs === 0 ? ['rgba(255,220,170,0.08)', null] : legs >= 3 ? ['rgba(255,190,110,0.1)', null] : [null, null];
    if (tint[0]) { ctx.fillStyle = tint[0]; ctx.fillRect(0, 0, W, H); }
    if (tint[1]) { const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, tint[1]); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    if (this.v > 200) { const k = (this.v - 200) / 120, g = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, H * 0.95); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,20,40,${0.28 * k})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    this.fl.draw(ctx);
    if (this.steerLive() && !this.panel) this.drawSteer(ctx);
    this.drawHud(ctx, W, H, t);
    if (this.panel) {
      if (this.panel.kind === 'chart') this.drawChart(ctx, W, H, t);
      else if (this.panel.kind === 'summary') this.drawSummary(ctx, W, H, t);
      else if (this.panel.kind === 'captain') this.drawCaptain(ctx, W, H, t);
      else if (this.panel.kind === 'pause') this.drawPause(ctx, W, H);
    }
  }
  drawTop(ctx, W, H, t) {
    const z = this.cam.z, v = { x0: this.cam.x - W / 2 / z, y0: this.cam.y - H / 2 / z, x1: this.cam.x + W / 2 / z, y1: this.cam.y + H / 2 / z, z };
    v.sun = { x: this.cam.x + 260 / z, y: this.cam.y - 140 / z, r: 300 / z };
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-this.cam.x, -this.cam.y);
    this.drawFlat(ctx, v, t);
    ctx.restore();
  }
  // the water and everything on it, seen from straight above. v.flat: the chase camera's ground textures, which leave
  // out whatever the chase camera stands up on its own (boats, posts, flags, trees)
  drawFlat(ctx, v, t) {
    World.drawWater(ctx, v, t);
    World.drawCloudShadows(ctx, v, 1);
    this.drawSwell(ctx, v, t);
    World.drawSurface(ctx, v, t, this.wind);
    this.drawSpotRings(ctx, v, t);
    this.drawHumpLife(ctx, v, t);
    World.drawLand(ctx, v, t);
    World.drawMarkers(ctx, v, t);
    this.drawCourse(ctx, t);
    for (const B of this.boats) if (!B.dead) this.drawWake(ctx, B.trail.map((p) => ({ x: p.x, y: p.y, h: B.h, v: B.v * 0.8, t: p.t })), 0.7);
    this.drawWake(ctx, this.trail, 1);
    for (const f of this.foam) { const k = 1 - f.t / f.life; ctx.fillStyle = `rgba(255,255,255,${0.55 * k})`; ell(ctx, f.x, f.y, f.r, f.r * 0.7); ctx.fill(); }
    if (this.manatee) this.drawManatee(ctx, this.manatee, t);
    const za = this.air ? Math.sin((this.air.t / this.air.dur) * Math.PI) : 0, seen = (B) => !B.dead && B.x > v.x0 - 120 && B.x < v.x1 + 120 && B.y > v.y0 - 120 && B.y < v.y1 + 120;
    if (v.flat) {   // shadows under the boats
      ctx.fillStyle = 'rgba(0,30,50,0.22)';
      for (const B of this.boats) if (seen(B)) { ell(ctx, B.x + 4, B.y + 5, B.big ? 52 : 40, B.big ? 18 : 14, B.h); ctx.fill(); }
      ctx.fillStyle = `rgba(0,30,50,${0.3 - za * 0.12})`; ell(ctx, this.x + 4 + 18 * za, this.y + 5 + 22 * za, 50, 18, this.h); ctx.fill();
    } else {
      if (this.dolphins) this.drawDolphins(ctx, t);
      for (const B of this.boats) if (seen(B)) drawCenterConsoleTop(ctx, B.x, B.y, B.big ? 0.7 : 0.5, B.h, { hull: B.hull, t });
      if (this.fwc) this.drawFwc(ctx, t);
      if (za > 0) { ctx.fillStyle = 'rgba(0,30,50,0.25)'; ell(ctx, this.x + 16 * za, this.y + 26 * za, 66, 26, this.h); ctx.fill(); }
      const bob = Math.sin(t * (2 + this.wind.chop * 2)) * 0.02 * this.wind.chop * (this.v < 50 ? 1 : 0.3);
      drawCenterConsoleTop(ctx, this.x, this.y - 10 * za, 0.62 * (1 + 0.22 * za), this.h + bob, { crew: this.crew, t });
    }
    World.drawBridges(ctx, v, t);
  }
  // swell: big soft light and dark patches drifting with the wind
  drawSwell(ctx, v, t) {
    ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = 0.5 + this.wind.chop * 0.3;
    const sp = ctx.createPattern(World.swell(), 'repeat'), ss = 3.2, so = t * (8 + this.wind.chop * 10);
    ctx.scale(ss, ss); ctx.translate(so * 0.6 / ss, so * 0.3 / ss); ctx.fillStyle = sp; ctx.fillRect(v.x0 / ss - so, v.y0 / ss - so, (v.x1 - v.x0) / ss + 2 * so + 10, (v.y1 - v.y0) / ss + 2 * so + 10);
    ctx.restore();
  }
  drawWake(ctx, tr, s) {
    // a continuous V behind the boat, spreading and fading with age, and the white prop wash in the middle
    if (tr.length < 2) return;
    ctx.lineCap = 'round';
    for (let i = 1; i < tr.length; i++) {
      const a = tr[i - 1], b = tr[i], age = this.t - b.t, k = clamp(b.v / 320, 0, 1), fade = 1 - age / 4; if (fade <= 0 || Math.abs(a.x - b.x) + Math.abs(a.y - b.y) > 90) continue;
      ctx.strokeStyle = `rgba(255,255,255,${0.42 * fade * fade * (0.3 + 0.7 * k) * s})`; ctx.lineWidth = (10 + 18 * k) * (1 - age / 5) * s;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      for (const side of [-1, 1]) {
        const sa = (this.t - a.t) * (16 + 34 * k), sb = age * (16 + 34 * k);
        const ax = a.x - Math.sin(a.h) * side * (12 + sa), ay = a.y + Math.cos(a.h) * side * (12 + sa), bx = b.x - Math.sin(b.h) * side * (12 + sb), by = b.y + Math.cos(b.h) * side * (12 + sb);
        ctx.strokeStyle = `rgba(255,255,255,${0.5 * fade * (0.25 + 0.75 * k) * s})`; ctx.lineWidth = (2.5 + 3 * k) * s;
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      }
    }
  }
  drawSpotRings(ctx, v, t) {
    for (const id of SPOT_ORDER) {
      if (!Charts.isKnown(id) || this.homeRun) continue;
      const [x, y] = spotXY(id), S = SPOTS[id]; if (x + S.r < v.x0 || x - S.r > v.x1 || y + S.r < v.y0 || y - S.r > v.y1) continue;
      const ok = spotAllowed(id, this.c), here = this.inSpot === id;
      ctx.save(); ctx.strokeStyle = here ? 'rgba(255,214,90,0.85)' : ok ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.18)'; ctx.lineWidth = here ? 5 : 3; ctx.setLineDash([18, 16]); ctx.lineDashOffset = -t * 20;
      ell(ctx, x, y, S.r, S.r); ctx.stroke(); ctx.restore();
      if (v.flat) continue;
      // a marker buoy with a flag
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ell(ctx, x + 4, y + 6, 13, 13); ctx.fill();
      ctx.fillStyle = PAL.coral; ell(ctx, x, y, 13, 13); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(x - 13, y - 3, 26, 6);
      ctx.strokeStyle = '#222'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 34); ctx.stroke();
      ctx.fillStyle = PAL.sun; ctx.beginPath(); ctx.moveTo(x, y - 34); ctx.lineTo(x + 22, y - 28 + Math.sin(t * 5) * 2); ctx.lineTo(x, y - 22); ctx.fill();
      const done = this.c.done.includes(id) && this.c.mode === 'crew';
      text(ctx, S.name, x, y + 34, { size: 20 / Math.max(0.7, v.z), align: 'center', color: '#fff', weight: 800, stroke: PAL.ink, sw: 5, alpha: ok ? 1 : 0.6 });
      text(ctx, done ? 'Done today' : S.kind, x, y + 34 + 20 / Math.max(0.7, v.z), { size: 15 / Math.max(0.7, v.z), align: 'center', color: done ? '#cfd8dc' : PAL.sun, weight: 800, stroke: PAL.ink, sw: 4, alpha: ok ? 1 : 0.6 });
    }
  }
  drawHumpLife(ctx, v, t) {
    const [hx, hy] = HUMP_XY; if (hx + 800 < v.x0 || hx - 800 > v.x1 || hy + 800 < v.y0 || hy - 800 > v.y1) return;
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 3; ctx.setLineDash([4, 10]); ctx.beginPath();
    for (let k = -700; k <= 700; k += 40) { const x = hx + k, y = hy - 260 + Math.sin(k * 0.01 + t * 0.6) * 30 + k * 0.25; k === -700 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke(); ctx.setLineDash([]);
    for (let i = 0; i < 3; i++) {
      const bx = hx + Math.cos(i * 2.1 + t * 0.05) * 280, by = hy + Math.sin(i * 2.1 + t * 0.05) * 180;
      ctx.fillStyle = 'rgba(20,40,70,0.35)'; ell(ctx, bx, by, 60, 34, i); ctx.fill();
      if (Math.sin(t * 3 + i * 2) > 0.85) { ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2; ell(ctx, bx + Math.sin(t * 7 + i) * 30, by, 10 + (t * 30 % 20), 5 + (t * 15 % 10)); ctx.stroke(); }
      if (!v.flat) for (let k = 0; k < 3; k++) { const a = t * (0.9 + k * 0.2) + k * 2 + i; drawFrigate(ctx, bx + Math.cos(a) * 70, by + Math.sin(a) * 40 - 40, 1.3, t * 6 + k); }
    }
  }
  drawCourse(ctx, t, w = 6) {
    if (!this.route || !this.dest) return;
    ctx.save(); ctx.strokeStyle = this.auto ? 'rgba(255,214,90,0.75)' : 'rgba(255,255,255,0.5)'; ctx.lineWidth = w; ctx.setLineDash([w * 3.6, w * 3]); ctx.lineDashOffset = -t * 40; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(this.x, this.y); for (let i = this.ri; i < this.route.length; i++) ctx.lineTo(this.route[i][0], this.route[i][1]); ctx.stroke(); ctx.restore();
  }
  drawManatee(ctx, m, t) {
    const sf = Math.sin(m.t * 0.8), up = sf > 0.1;
    drawManateeTop(ctx, m.x, m.y, 0.85, m.h, { t, surfacing: clamp(sf * 1.4, 0, 1), depth: up ? 0.2 : 0.6 });
    if (up && chance(0.05)) this.foam.push(this.foamBlob(m.x + Math.cos(m.h) * 34, m.y + Math.sin(m.h) * 34, 0, 0, 4, 0.8));
  }
  drawDolphins(ctx, t) {
    const D = this.dolphins, fade = Math.min(1, D.t * 2, (D.dur - D.t) * 2), ca = Math.cos(this.h), sa = Math.sin(this.h);
    for (const p of D.pod) {
      const ph = t * 3 + p.ph, up = Math.sin(ph), x = this.x + ca * (p.ox + 20) - sa * p.oy, y = this.y + sa * (p.ox + 20) + ca * p.oy;
      ctx.save(); ctx.globalAlpha = fade; drawDolphinTop(ctx, x, y, 0.62, this.h, { t, up: Math.max(0, up), phase: p.ph }); ctx.restore();
      if (up > 0.95 && chance(0.3)) this.foam.push(this.foamBlob(x, y, 0, 0, 5, 0.6));
    }
  }
  // a finger (or the mouse) held on the water to steer: a ring where it is and an arrow for how hard the wheel is over,
  // so it's plain the boat has heard you
  drawSteer(ctx) {
    const s = this.steer, r = this.rudder || 0;
    if (this.view === 'top') {
      const [bx, by] = this.toScreen(this.x, this.y);
      ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(s.x, s.y); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.16)'; ell(ctx, s.x, s.y, 26, 26); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 3; ell(ctx, s.x, s.y, 26, 26); ctx.stroke();
    if (Math.abs(r) > 0.06) {
      const d = Math.sign(r), len = 16 + Math.abs(r) * 30, x0 = s.x + d * 34;
      ctx.fillStyle = PAL.sun; ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x0, s.y - 7); ctx.lineTo(x0 + d * len, s.y - 7); ctx.lineTo(x0 + d * len, s.y - 13); ctx.lineTo(x0 + d * (len + 14), s.y); ctx.lineTo(x0 + d * len, s.y + 13); ctx.lineTo(x0 + d * len, s.y + 7); ctx.lineTo(x0, s.y + 7); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  }
  // where the FWC boat is while it pulls you over: it comes up from astern and stops alongside, to starboard.
  // One place, so the top-down, chase and 3D views all put it in the same spot.
  fwcXY() {
    const k = easeOut(this.fwc.k), back = lerp(420, -10, k), ca = Math.cos(this.h), sa = Math.sin(this.h);
    return [this.x - ca * back - sa * 85, this.y - sa * back + ca * 85];
  }
  drawFwc(ctx, t) {
    const [x, y] = this.fwcXY();
    drawFwcBoatTop(ctx, x, y, 0.5, this.h, { t });
    text(ctx, 'FWC', x, y + 34, { size: 14, align: 'center', color: '#fff', weight: 800, stroke: '#123a8a', sw: 4 });
  }

  /* ---------- HUD ---------- */
  drawHud(ctx, W, H, t) {
    const C = CHARS[this.driver], open = !!this.panel;
    UI.button(ctx, 'pause', 14, 12, 46, 46, '❚❚', () => { if (!this.panel) this.panel = { kind: 'pause' }; }, { style: 'dark', size: 16, r: 14, disabled: open });
    panel(ctx, 70, 12, 204, 46, { r: 23 });
    crewAvatar(ctx, this.driver, 93, 35, 17);
    text(ctx, 'Captain ' + C.name, 118, 31, { size: 16, weight: 800, color: '#fff', maxW: 150 });
    const legPts = this.lines.reduce((a, l) => a + l.pts, 0);
    text(ctx, (legPts >= 0 ? '+' : '') + legPts + ' captain pts', 118, 49, { size: 13, weight: 700, color: PAL.sun });
    // where are we: destination, area, depth sounder
    const mmW = Math.min(196, W * 0.2), mmH = mmW * (WORLD.H / WORLD.W), mmX = W - mmW - 14, mmY = 12;
    const pw = Math.min(360, mmX - 300), px = 288;
    const depth = World.depth(this.x, this.y);
    // in a no-wake zone the panel says so (a banner only when you're going too fast for it)
    const zone = this.zone && !open;
    panel(ctx, px, 12, pw, 46, { r: 18, fill: zone ? 'rgba(255,255,255,0.94)' : undefined });
    const xy = this.destXY();
    if (xy) {
      const nm = dist(this.x, this.y, xy[0], xy[1]) / UNITS_PER_NM;
      text(ctx, (this.dest === 'home' ? 'Home dock' : SPOTS[this.dest].name) + ' · ' + nm.toFixed(1) + ' nm', px + 16, 32, { size: 15, color: zone ? PAL.ink : '#fff', weight: 800, maxW: pw - 110 });
    } else text(ctx, this.areaName(), px + 16, 32, { size: 15, color: zone ? PAL.ink : '#fff', weight: 800, maxW: pw - 110 });
    text(ctx, zone ? 'NO WAKE ZONE · keep it SLOW' : xy ? (this.via ? 'via ' + this.via.name : this.areaName()) : 'Exploring', px + 16, 50, { size: 12, color: zone ? '#c0392b' : '#9fb8c2', weight: 800, maxW: pw - 110 });
    text(ctx, depth > 99 ? (depth > 600 ? '600+' : Math.round(depth)) + ' ft' : depth.toFixed(1) + ' ft', px + pw - 14, 33, { size: 18, align: 'right', color: depth < 3 ? PAL.bad : depth < 5 ? PAL.warn : zone ? '#0b7285' : '#7ff0ff', weight: 800 });
    text(ctx, 'DEPTH', px + pw - 14, 50, { size: 11, align: 'right', color: zone ? '#5b7380' : '#9fb8c2', weight: 800 });
    // minimap (tap for the chart)
    this.drawMinimap(ctx, mmX, mmY, mmW, mmH, t);
    UI.region('mini', mmX, mmY, mmW, mmH, () => this.openChart(), { disabled: open });
    const vbY = mmY + mmH + 8;
    UI.button(ctx, 'view', mmX, vbY, mmW, 30, this.view === 'chase' ? 'Top-down view' : 'Behind the boat', () => this.toggleView(), { style: 'dark', size: 13, r: 10, key: 'KeyV', disabled: open });
    // speed and throttle
    const kts = Math.round(this.v * SEA_KTS), sx = 26, sy = H - 26;
    panel(ctx, sx - 12, sy - 82, 172, 92, { r: 18 });
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(sx + 50, sy - 8, 44, Math.PI, TAU); ctx.stroke();
    ctx.strokeStyle = this.v > 280 ? PAL.coral : PAL.sun; ctx.beginPath(); ctx.arc(sx + 50, sy - 8, 44, Math.PI, Math.PI + Math.PI * clamp(this.v / 320, 0, 1)); ctx.stroke();
    text(ctx, String(kts), sx + 50, sy - 14, { size: 28, align: 'center', color: '#fff', weight: 800 });
    text(ctx, 'KNOTS', sx + 50, sy + 2, { size: 11, align: 'center', color: '#9fb8c2', weight: 800 });
    text(ctx, NOTCH[this.notch].name, sx + 108, sy - 30, { size: 15, color: PAL.sun, weight: 800 });
    text(ctx, this.auto ? 'autopilot' : this.v > 150 ? 'on plane' : this.v > 5 ? 'plowing' : 'stopped', sx + 108, sy - 12, { size: 12, color: this.auto ? PAL.sun : '#9fb8c2', weight: 700 });
    const lx = W - 92, ly0 = vbY + 76, lh = H - ly0 - 16;
    panel(ctx, lx - 12, ly0 - 30, 92, lh + 40, { r: 20 });
    text(ctx, 'THROTTLE', lx + 34, ly0 - 10, { size: 12, align: 'center', color: '#9fb8c2', weight: 800 });
    for (let i = 4; i >= 0; i--) {
      const y = ly0 + (4 - i) * (lh / 5);
      UI.button(ctx, 'thr' + i, lx, y + 3, 68, lh / 5 - 8, NOTCH[i].name, () => this.setNotch(i), { style: this.notch === i ? (i === 4 ? 'coral' : 'primary') : 'ghost', size: 13, r: 12, disabled: open });
    }
    // chart, autopilot and the big context button
    const by = H - 64;
    UI.button(ctx, 'chart', 196, by, 104, 48, 'Chart', () => this.openChart(), { style: 'dark', size: 18, key: 'KeyM', disabled: open });
    if (this.dest) UI.button(ctx, 'auto', 308, by, 104, 48, this.auto ? 'AUTO on' : 'Autopilot', () => this.setAuto(!this.auto), { style: this.auto ? 'primary' : 'dark', size: this.auto ? 17 : 15, key: 'KeyP', disabled: open });
    // the big context button sits in the space between the left buttons and the throttle
    const left = this.dest ? 424 : 312, room = lx - 24 - left, bw = Math.min(300, room), bx = left + (room - bw) / 2;
    if (this.homeRun && this.atHome) {
      UI.button(ctx, 'tieup', bx, by - 8, bw, 56, 'Tie up at the dock', () => this.arrive('home'), { style: 'primary', size: 20, key: 'Enter', disabled: open || this.v > NO_WAKE, sub: this.v > NO_WAKE ? 'Slow down first' : 'End the day' });
    } else if (this.inSpot) {
      const ok = spotAllowed(this.inSpot, this.c), slow = this.v <= 95;
      if (ok) UI.button(ctx, 'fish', bx, by - 8, bw, 56, spotDo(this.inSpot).here, () => this.arrive(this.inSpot), { style: 'primary', size: 22, key: 'Enter', disabled: open || !slow, sub: slow ? SPOTS[this.inSpot].name : 'Slow down to stop here' });
      else { panel(ctx, bx, by, bw, 44, { r: 18 }); text(ctx, this.c.done.includes(this.inSpot) ? 'Already been here today' : 'Today’s spots are set', bx + bw / 2, by + 28, { size: 15, align: 'center', color: '#cfe3ea', weight: 700, maxW: bw - 16 }); }
    }
    // banners
    const banner = (msg, fill, col) => { panel(ctx, W / 2 - 170, 66, 340, 34, { r: 17, fill, line: 'rgba(0,0,0,0.1)' }); text(ctx, msg, W / 2, 88, { size: 15, align: 'center', color: col, weight: 800 }); };
    if (this.zone && !open && this.v > NO_WAKE) banner('NO WAKE! Throttle down to SLOW', 'rgba(200,60,20,0.92)', '#fff');
    else if (!open && this.v > 140 && this.shallowAhead() < 2.6) banner('Shallow ahead! Ease off', 'rgba(230,200,120,0.95)', PAL.ink);
    else if (this.stall > 0 && !open) banner('Prop wrapped… ' + this.stall.toFixed(1) + 's', 'rgba(255,255,255,0.92)', PAL.ink);
    // a pointer the way to go when that's off screen: along the course (around the islands, through the creek), not
    // straight at the spot. Behind the boat it says which way to turn, so not while the autopilot drives: it's already
    // turning, often around an island, and "Turn around" would only tell you to fight it
    const gxy = this.guideXY();
    if (gxy && !open && !this.auto && this.view === 'chase') {
      const c = Chase.c, rel = angleDiff(Chase.yaw, Math.atan2(gxy[1] - c.y, gxy[0] - c.x)), half = Math.atan((W / 2 - 40) / c.F);
      if (Math.abs(rel) > half) {
        const side = rel > 0 ? 1 : -1, ax = side > 0 ? W - mmW - 70 : 64, ay = c.hor + 40, pulse = 1 + Math.sin(t * 5) * 0.08;
        ctx.save(); ctx.translate(ax, ay); ctx.scale(side * pulse, pulse); ctx.fillStyle = 'rgba(255,214,90,0.95)'; ctx.strokeStyle = PAL.ink; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(26, 0); ctx.lineTo(-6, -20); ctx.lineTo(0, 0); ctx.lineTo(-6, 20); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
        text(ctx, Math.abs(rel) > 2.4 ? 'Turn around' : side > 0 ? 'Turn right' : 'Turn left', ax, ay + 40, { size: 15, align: 'center', color: PAL.sun, weight: 800, stroke: PAL.ink, sw: 4 });
        if (this.via) text(ctx, 'to ' + this.via.name, ax, ay + 58, { size: 13, align: 'center', color: '#fff', weight: 800, stroke: PAL.ink, sw: 4 });
      }
    } else if (gxy && !open && this.view !== 'chase') {
      const [tx, ty] = this.toScreen(gxy[0], gxy[1]);
      if (tx < 30 || tx > W - 30 || ty < 70 || ty > H - 30) {
        const a = Math.atan2(ty - H / 2, tx - W / 2), r = Math.min(W * 0.42, H * 0.36), ax = W / 2 + Math.cos(a) * r, ay = H / 2 + Math.sin(a) * r;
        ctx.save(); ctx.translate(ax, ay); ctx.rotate(a); ctx.fillStyle = 'rgba(255,214,90,0.9)'; ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-10, -13); ctx.lineTo(-4, 0); ctx.lineTo(-10, 13); ctx.closePath(); ctx.fill(); ctx.restore();
      }
    }
    // each captain gets the steering tip on their first time at the wheel, until they've steered
    const newCaptain = !(this.c.steered && this.c.steered[this.driver]), chartTip = this.dest ? '' : Game.touch ? ' Tap Chart to pick a spot.' : ' M for the chart.';
    if (this.view === 'chase') {
      if (this.t > 2 && this.t < 12 && !open && newCaptain && !Game.toasts.length) {   // the tip steps aside while a banner is up
        const hw = Math.min(600, W - 2 * mmW - 70), a = Math.min(1, (this.t - 2) * 3, (12 - this.t) * 2);
        const msg = this.auto ? (Game.touch ? 'The autopilot is driving. Hold or drag on the water to take the wheel.' : 'The autopilot is driving. Hold the mouse on the water, or ← →, to take the wheel.')
          : Game.touch ? 'Hold your finger left or right of the boat to steer. Throttle is on the right.' + chartTip : 'Hold the mouse left or right of the boat to steer, or ← →. ↑ ↓ or the lever for throttle.' + chartTip + ' V changes the view.';
        ctx.font = fnt(15, 700); const n = wrapText(ctx, msg, hw - 28).length;
        ctx.save(); ctx.globalAlpha = a; panel(ctx, W / 2 - hw / 2, 108, hw, 14 + n * 19, { r: 16 });
        para(ctx, msg, W / 2, 129, hw - 28, { size: 15, align: 'center', color: '#fff', weight: 700, lh: 19 });
        ctx.restore();
      }
    } else if (this.t < 9 && !open && newCaptain && !this.auto) para(ctx, Game.touch ? 'Hold and drag where you want to go. Throttle is on the right.' + chartTip : 'Hold the mouse where you want to go, or ← →. ↑ ↓ or the lever for throttle.' + chartTip, 196, H - 110, Math.min(460, W - 420), { size: 16, color: '#fff', weight: 700, stroke: 'rgba(0,0,0,0.5)', sw: 4, lh: 20 });
    if (GFX.showFps) {
      text(ctx, GFX.readout(this.uses3D(), this.view !== 'chase' ? 'top-down' : null), W / 2, H - 8, { size: 13, align: 'center', color: '#fff', weight: 800, stroke: 'rgba(0,0,0,0.6)', sw: 4 });
    }
    if (this.quip && !open) {
      const q = this.quip, qw = Math.min(360, W * 0.42), qx = 14, qy = H - 170;
      ctx.save(); ctx.globalAlpha = Math.min(1, q.t * 3);
      panel(ctx, qx, qy, qw, 44, { r: 22, fill: 'rgba(255,255,255,0.95)', line: 'rgba(0,0,0,0.1)' });
      crewAvatar(ctx, q.who, qx + 24, qy + 22, 17);
      text(ctx, CHARS[q.who].name + ': ' + q.msg, qx + 48, qy + 28, { size: 15, color: PAL.ink, weight: 800, maxW: qw - 60 });
      ctx.restore();
    }
  }
  chartRect(x, y, w, h) { return { X: (wx) => x + (wx / WORLD.W) * w, Y: (wyv) => y + (wyv / WORLD.H) * h }; }
  drawMinimap(ctx, x, y, w, h, t) {
    ctx.save(); rr(ctx, x - 3, y - 3, w + 6, h + 6, 12); ctx.fillStyle = 'rgba(8,40,56,0.9)'; ctx.fill();
    rr(ctx, x, y, w, h, 10); ctx.clip(); ctx.imageSmoothingEnabled = true; ctx.drawImage(World.tex, x, y, w, h);
    const M = this.chartRect(x, y, w, h);
    for (const id of SPOT_ORDER) { if (!Charts.isKnown(id)) continue; const [sx, sy] = spotXY(id); ctx.fillStyle = id === this.dest ? PAL.sun : this.c.done.includes(id) && this.c.mode === 'crew' ? '#8aa' : PAL.coral; ell(ctx, M.X(sx), M.Y(sy), 3.5, 3.5); ctx.fill(); }
    ctx.fillStyle = '#222'; ell(ctx, M.X(World.home.x), M.Y(World.home.dockY), 2.5, 2.5); ctx.fill();
    if (this.route && this.dest) { ctx.strokeStyle = 'rgba(200,120,20,0.9)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(M.X(this.x), M.Y(this.y)); for (let i = this.ri; i < this.route.length; i++) ctx.lineTo(M.X(this.route[i][0]), M.Y(this.route[i][1])); ctx.stroke(); }
    if (this.view === 'chase') { ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.moveTo(M.X(this.x), M.Y(this.y)); ctx.arc(M.X(this.x), M.Y(this.y), 22, Chase.yaw - 0.55, Chase.yaw + 0.55); ctx.closePath(); ctx.fill(); }
    ctx.save(); ctx.translate(M.X(this.x), M.Y(this.y)); ctx.rotate(this.h); ctx.fillStyle = '#d7262e'; ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -4.5); ctx.lineTo(-5, 4.5); ctx.closePath(); ctx.fill(); ctx.restore();
    ctx.restore();
    text(ctx, 'CHART', x + w - 6, y + h - 6, { size: 10, align: 'right', color: 'rgba(30,60,80,0.8)', weight: 800 });
  }
  drawChart(ctx, W, H, t) {
    ctx.fillStyle = 'rgba(3,22,32,0.82)'; ctx.fillRect(0, 0, W, H);
    UI.region('chart-bg', 0, 0, W, H, () => { this.sel = null; });
    const ch = Math.min(H - 84, (W - 272) / (WORLD.W / WORLD.H)), cw = ch * (WORLD.W / WORLD.H), cx = Math.max(14, Math.min(W - cw - 258, W / 2 - cw / 2 - 90)), cy = 70;
    ctx.save(); rr(ctx, cx, cy, cw, ch, 12); ctx.clip(); ctx.imageSmoothingEnabled = true; ctx.drawImage(World.chart, cx, cy, cw, ch);
    const M = this.chartRect(cx, cy, cw, ch), lab = (s, x, y, o = {}) => text(ctx, s, M.X(x), M.Y(y), Object.assign({ size: 12, align: 'center', base: 'middle', color: 'rgba(40,60,80,0.75)', weight: 800 }, o));
    lab('FLORIDA BAY', 7600, wy(7600, -3000), { size: 15, color: 'rgba(40,90,130,0.55)' });
    lab('EVERGLADES', 9000, wy(9000, -5390), { size: 15, color: 'rgba(60,70,30,0.6)' });   // low enough to clear the chart's top edge
    lab('HAWK CHANNEL', 11500, wy(11500, 1000), { size: 11, color: 'rgba(40,90,130,0.6)' });
    lab('ATLANTIC OCEAN', 11800, wy(11800, 3600), { size: 15, color: 'rgba(40,90,130,0.5)' });
    lab('GULF STREAM →', 12400, wy(12400, 5800), { size: 13, color: 'rgba(40,90,130,0.5)' });
    lab('reef line', 2600, wy(2600, 2430), { size: 10, color: 'rgba(120,80,140,0.8)' });
    // each key's name goes just south of it, or north, or slid along the key, wherever it doesn't run into a
    // neighbor's name, a pin or a spot's name
    const boxes = [], hits = (b) => boxes.some((o) => o[0] < b[2] && b[0] < o[2] && o[1] < b[3] && b[1] < o[3]);
    for (const id of SPOT_ORDER) {
      const known = Charts.isKnown(id), [x, y] = known ? spotXY(id) : rumorXY(id), X = M.X(x), Y = M.Y(y);
      boxes.push([X - 15, Y - 15, X + 15, Y + 15]);
      if (known) { ctx.font = fnt(12, 800); const nw = ctx.measureText(SPOTS[id].name).width / 2 + 3; boxes.push([X - nw, Y + 12, X + nw, Y + 28]); }
    }
    boxes.push([M.X(World.home.x) - 8, M.Y(World.home.dockY) - 16, M.X(World.home.x) + 40, M.Y(World.home.dockY) + 8]);
    // which side of the islands is which: you only get from one to the other through a creek, under the bridge
    for (const [s2, msg] of [[-660, 'BAY SIDE ▲'], [600, 'OCEAN SIDE ▼']]) {
      const X = M.X(14150), Y = M.Y(wy(14150, s2)); ctx.font = fnt(11, 800); const hw2 = ctx.measureText(msg).width / 2 + 3;
      boxes.push([X - hw2, Y - 7, X + hw2, Y + 7]); lab(msg, 14150, wy(14150, s2), { size: 11, color: 'rgba(25,75,115,0.9)' });
    }
    ctx.font = fnt(9, 800);
    for (const I of ISLANDS) {
      const lx = (I.x0 + Math.min(I.x1, WORLD.W)) / 2, hw = ctx.measureText(I.name).width / 2 + 3, side = I.name === 'ISLAMORADA' ? -260 : 260;
      const at = ([dx, dy]) => { const X = M.X(lx + dx), Y = M.Y(chainY(lx + dx) + dy); return [X - hw, Y - 6, X + hw, Y + 6]; };
      const tries = [];
      for (const dy of [side, -side, side * 1.9, -side * 1.9]) for (const px of [0, 12, -12, 24, -24, 36, -36, 48, -48]) if (Math.abs(px) < hw) tries.push([px * WORLD.W / cw, dy]);   // slid by up to its own half-width, then a bit farther out
      const spot = tries.find((p) => !hits(at(p)));
      if (!spot) continue;   // a small chart with no room: better no name than two on top of each other
      const [dx, dy] = spot;
      boxes.push(at([dx, dy])); lab(I.name, lx + dx, chainY(lx + dx) + dy, { size: 9, color: 'rgba(90,70,30,0.85)' });
    }
    // the creeks: the only ways through the islands. The one the way there goes through is lit up and named.
    const pv = this.previewPath(), via = this.sel ? this.wayTo(this.sel) : this.via;
    for (const G of GAPS) {
      const X = M.X(G.x), Y = M.Y(chainY(G.x)), hot = via === G, r = hot ? 6.5 : 4.5;
      ctx.fillStyle = hot ? PAL.sun : '#ffffff'; ell(ctx, X, Y, r, r); ctx.fill(); ctx.strokeStyle = '#1f6fa8'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#1f6fa8'; for (const d of [-1, 1]) { ctx.beginPath(); ctx.moveTo(X - r * 0.5, Y + d * r * 0.15); ctx.lineTo(X + r * 0.5, Y + d * r * 0.15); ctx.lineTo(X, Y + d * r * 0.75); ctx.closePath(); ctx.fill(); }
    }
    // spots, rumors and home
    const pin = (id, x, y, known) => {
      const X = M.X(x), Y = M.Y(y), S = SPOTS[id], sel = this.sel === id, done = this.c.mode === 'crew' && this.c.done.includes(id);
      if (!known) {
        ctx.fillStyle = sel ? PAL.sun : 'rgba(255,255,255,0.9)'; ell(ctx, X, Y, 12, 12); ctx.fill(); ctx.strokeStyle = 'rgba(40,60,80,0.6)'; ctx.lineWidth = 2; ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]);
        text(ctx, '?', X, Y + 1, { size: 16, align: 'center', base: 'middle', color: PAL.ink, weight: 800 });
        UI.region('chartpin-' + id, X - 18, Y - 18, 36, 36, () => { this.sel = id; SFX.play('tick'); });
        return;
      }
      const r = sel ? 15 : 12;
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ell(ctx, X + 1.5, Y + 3, r, r); ctx.fill();
      ctx.fillStyle = done ? '#cfd8dc' : sel ? PAL.sun : '#ffffff'; ell(ctx, X, Y, r, r); ctx.fill(); ctx.strokeStyle = id === this.dest ? PAL.sun : PAL.coral; ctx.lineWidth = 3; ctx.stroke();
      ctx.save(); ctx.translate(X, Y); ctx.globalAlpha *= done ? 0.5 : 1;
      if (S.mode === 'bughunt') { ctx.rotate(-0.45); ctx.translate(-r * 0.1, r * 0.15); drawLobsterSide(ctx, r * 1.75, { t }); } else drawFish(ctx, S.species[0], r * 1.5, { wig: 0 });
      ctx.restore();
      text(ctx, S.name, X, Y + r + 12, { size: 12, align: 'center', color: '#fff', weight: 800, stroke: PAL.ink, sw: 4 });
      UI.region('chartpin-' + id, X - 22, Y - 22, 44, 44, () => { this.sel = id; SFX.play('tick'); });
    };
    const K = this.filt && SPOT_CATS.find((k) => k.id === this.filt);
    for (const id of SPOT_ORDER) {
      const known = Charts.isKnown(id), [x, y] = known ? spotXY(id) : rumorXY(id), lit = !K || K.has(SPOTS[id]), X = M.X(x), Y = M.Y(y);
      ctx.save(); if (!lit) ctx.globalAlpha = 0.28;
      if (K && lit) { const rg = 20 + Math.sin(t * 5) * 2; ctx.strokeStyle = PAL.sun; ctx.lineWidth = 3; ell(ctx, X, Y, rg, rg); ctx.stroke(); }
      pin(id, x, y, known);
      // a ? the picker lit up: what you'd find there
      if (K && lit && !known) { ctx.save(); ctx.translate(X + 15, Y - 14); if (K.icon === 'lobster') { ctx.rotate(-0.4); drawLobsterSide(ctx, 18, {}); } else drawFish(ctx, K.icon, 22, { wig: 0 }); ctx.restore(); }
      ctx.restore();
    }
    const hx = M.X(World.home.x), hy = M.Y(World.home.dockY);
    ctx.fillStyle = PAL.ink; ell(ctx, hx, hy, 6, 6); ctx.fill(); ctx.fillStyle = '#fff'; ell(ctx, hx, hy, 2.5, 2.5); ctx.fill();
    text(ctx, 'Home', hx + 9, hy - 6, { size: 11, color: PAL.ink, weight: 800 });
    UI.region('chartpin-home', hx - 16, hy - 16, 32, 32, () => { this.sel = 'home'; SFX.play('tick'); });
    if (pv) {
      const way = () => { ctx.beginPath(); ctx.moveTo(M.X(this.x), M.Y(this.y)); for (const q of pv) ctx.lineTo(M.X(q[0]), M.Y(q[1])); ctx.stroke(); };
      ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 5; way();
      ctx.strokeStyle = '#0b3d5c'; ctx.lineWidth = 2.5; ctx.setLineDash([4, 6]); ctx.lineDashOffset = -t * 14; way(); ctx.setLineDash([]); ctx.lineDashOffset = 0;
    }
    if (via) {
      const X = M.X(via.x), Y = M.Y(chainY(via.x)); ctx.font = fnt(12, 800); const w2 = ctx.measureText(via.name).width + 16, bx = clamp(X - w2 / 2, cx + 4, cx + cw - w2 - 4), by = Y + 10;
      ctx.fillStyle = 'rgba(8,40,56,0.9)'; rr(ctx, bx, by, w2, 20, 10); ctx.fill();
      text(ctx, via.name, bx + w2 / 2, by + 14.5, { size: 12, align: 'center', color: PAL.sun, weight: 800 });
    }
    if (this.route && this.dest) { ctx.strokeStyle = 'rgba(210,120,20,0.9)'; ctx.lineWidth = 2.5; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(M.X(this.x), M.Y(this.y)); for (let i = this.ri; i < this.route.length; i++) ctx.lineTo(M.X(this.route[i][0]), M.Y(this.route[i][1])); ctx.stroke(); ctx.setLineDash([]); }
    ctx.save(); ctx.translate(M.X(this.x), M.Y(this.y)); ctx.rotate(this.h); ctx.fillStyle = '#d7262e'; ctx.beginPath(); ctx.moveTo(11, 0); ctx.lineTo(-7, -7); ctx.lineTo(-7, 7); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2; rr(ctx, cx, cy, cw, ch, 12); ctx.stroke();
    // compass rose
    const rx = cx + cw - 34, ry = cy + 40; ctx.save(); ctx.translate(rx, ry); ctx.rotate(-0.75); ctx.fillStyle = 'rgba(40,60,80,0.7)'; ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(5, 0); ctx.lineTo(0, 22); ctx.lineTo(-5, 0); ctx.closePath(); ctx.fill(); text(ctx, 'N', 0, -28, { size: 12, align: 'center', color: 'rgba(40,60,80,0.9)', weight: 800 }); ctx.restore();
    // header
    text(ctx, 'The Chart', 24, 50, { display: true, size: 30, color: '#fff' });
    const known = Charts.known().size;
    // what do you want to catch? Lights up those spots and picks the closest one
    const x0 = 196, gap = 8, chipW = Math.min(136, (W - 142 - x0 - gap * (SPOT_CATS.length - 1)) / SPOT_CATS.length), icons = chipW >= 112;
    SPOT_CATS.forEach((K2, i) => {
      const on = this.filt === K2.id, icon = !icons ? null : (g, ix, iy) => { g.save(); g.translate(ix, iy); if (K2.icon === 'lobster') { g.rotate(-0.4); drawLobsterSide(g, 22, {}); } else drawFish(g, K2.icon, 26, { wig: 0 }); g.restore(); };
      UI.button(ctx, 'cat-' + K2.id, x0 + i * (chipW + gap), 16, chipW, 40, K2.name, () => this.pickCat(K2.id), { style: on ? 'primary' : 'dark', size: 15, r: 20, icon, selected: on });
    });
    UI.button(ctx, 'chartclose', W - 130, 14, 116, 44, 'Close', () => { this.panel = null; this.sel = null; }, { style: 'ghost', size: 18, key: 'Escape|KeyM' });
    // the side card
    const sx = cx + cw + 14, sw = W - sx - 14;
    {
      const sel = this.sel;
      panel(ctx, sx, cy, sw, ch, { r: 16 });
      if (!sel) {
        const used = para(ctx, this.homeRun ? 'Tap Home to set a course back to the dock.' : 'Pick what to catch up top, or tap a spot. Set course and the autopilot drives you there.', sx + 16, cy + 30, sw - 32, { size: 15, color: '#cfe3ea', weight: 600, lh: 20 });
        text(ctx, 'Spots found: ' + known + ' / ' + SPOT_ORDER.length + (known < SPOT_ORDER.length ? ' · run past a ? to find it' : ' · all of them!'), sx + 16, cy + 30 + used + 4, { size: 13, color: '#9fb8c2', weight: 700, maxW: sw - 32 });
        let y = Math.max(cy + 130, cy + 30 + used + 30);
        text(ctx, this.c.mode === 'crew' ? 'TODAY · ' + this.c.done.length + '/' + this.c.spotsNeeded + ' SPOTS' : 'SOLO DAY', sx + 16, y, { size: 13, color: '#9fb8c2', weight: 800 }); y += 24;
        for (const ch2 of this.c.crew.slice().sort((a, b) => this.c.scores[b] - this.c.scores[a])) { crewAvatar(ctx, ch2, sx + 30, y, 14); text(ctx, CHARS[ch2].name, sx + 52, y + 5, { size: 15, color: '#fff', weight: 800 }); text(ctx, this.c.scores[ch2].toLocaleString(), sx + sw - 16, y + 5, { size: 15, align: 'right', color: PAL.sun, weight: 800 }); y += 34; }
        if (!this.homeRun && y + 110 < cy + ch) drawBountyList(ctx, sx + 16, y + 10, sw - 32, { bounties: Bounties.list(this.c), size: 14 });
      } else if (sel === 'home') {
        text(ctx, 'Home dock', sx + 16, cy + 36, { display: true, size: 22, color: '#fff', maxW: sw - 30 });
        text(ctx, 'Tavernier · ' + (dist(this.x, this.y, World.home.x, World.home.dockY) / UNITS_PER_NM).toFixed(1) + ' nm', sx + 16, cy + 60, { size: 14, color: PAL.coral, weight: 800 });
        const end = () => { if (this.c.mode === 'crew' && !this.homeRun) { this.panel = { kind: 'pause', confirm: true }; } else { this.dest = 'home'; this.homeRun = true; this.planRoute(); this.setAuto(true); this.panel = null; } };
        UI.button(ctx, 'sethome', sx + 14, cy + ch - 132, sw - 28, 54, this.homeRun ? 'Set course home' : 'Head home', end, { style: 'primary', size: 18, sub: this.homeRun ? 'Autopilot drives' : 'Ends the day' });
        if (this.homeRun) UI.button(ctx, 'skiphome', sx + 14, cy + ch - 66, sw - 28, 50, 'Skip the ride', () => this.skipTo('home'), { style: 'secondary', size: 17 });
      } else {
        const S = SPOTS[sel], known2 = Charts.isKnown(sel);
        if (!known2) {
          text(ctx, 'Uncharted', sx + 16, cy + 36, { display: true, size: 22, color: '#fff' });
          text(ctx, 'Word on the dock:', sx + 16, cy + 62, { size: 14, color: PAL.coral, weight: 800 });
          const used = para(ctx, '“' + S.rumor + '”', sx + 16, cy + 86, sw - 32, { size: 15, color: '#fff', weight: 600, lh: 20 }), g2 = this.wayTo(sel), [rx, ry] = rumorXY(sel);
          if (g2) text(ctx, (baySide(rx, ry) ? 'BAY SIDE' : 'OCEAN SIDE') + ': go through ' + g2.name, sx + 16, cy + 104 + used, { size: 13, color: PAL.sun, weight: 800, maxW: sw - 30 });
          para(ctx, 'Drive near the ? to find it and put it on the chart.', sx + 16, cy + ch - 60, sw - 32, { size: 14, color: '#9fb8c2', weight: 600, lh: 18 });
        } else {
          const [px2, py2] = spotXY(sel), nm = dist(this.x, this.y, px2, py2) / UNITS_PER_NM;
          text(ctx, S.name, sx + 16, cy + 36, { display: true, size: 22, color: '#fff', maxW: sw - 30 });
          text(ctx, S.kind.toUpperCase() + ' · ' + S.depth + ' · ' + nm.toFixed(1) + ' nm', sx + 16, cy + 60, { size: 13, color: PAL.coral, weight: 800, maxW: sw - 30 });
          const g2 = this.homeRun ? null : this.wayTo(sel), by0 = cy + 84 + (g2 ? 22 : 0);
          if (g2) text(ctx, (baySide(px2, py2) ? 'BAY SIDE' : 'OCEAN SIDE') + ': go through ' + g2.name, sx + 16, cy + 82, { size: 13, color: PAL.sun, weight: 800, maxW: sw - 30 });
          const used = para(ctx, S.blurb, sx + 16, by0, sw - 32, { size: 14, color: '#dcebf0', weight: 500, lh: 18 });
          const iy = by0 + 12 + used, per = Math.max(1, Math.floor((sw - 24) / 44));
          const nIc = Math.min(S.species.length, per * 2), here = this.homeRun ? [] : Bounties.list(this.c).filter((b) => Bounties.here(b, sel)), by = iy + Math.ceil(nIc / per) * 30 + 6;
          if (here.length && by + 20 + here.length * 28 < cy + ch - 132) drawBountyList(ctx, sx + 16, by, sw - 32, { bounties: Bounties.list(this.c), spot: sel, only: 'here', title: 'BOUNTIES HERE', size: 14, rowH: 28 });
          S.species.slice(0, per * 2).forEach((k, i) => { ctx.save(); ctx.translate(sx + 34 + (i % per) * 44, iy + 10 + Math.floor(i / per) * 30); if (k === 'lobster') drawLobsterSide(ctx, 22, {}); else drawFish(ctx, k, 38, { wig: 0, sil: Records.all()[k] ? null : 'rgba(255,255,255,0.35)' }); ctx.restore(); });
          if (this.homeRun) text(ctx, 'The day’s done. Head home.', sx + 16, cy + ch - 30, { size: 14, color: '#9fb8c2', weight: 700 });
          else if (spotAllowed(sel, this.c)) {
            UI.button(ctx, 'setcourse', sx + 14, cy + ch - 126, sw - 28, 54, 'Set course', () => { this.dest = sel; this.planRoute(); this.setAuto(true); this.panel = null; }, { style: 'primary', size: 20, sub: 'Autopilot drives · you can take over' });
            UI.button(ctx, 'skipride', sx + 14, cy + ch - 62, sw - 28, 48, 'Skip the ride', () => this.skipTo(sel), { style: 'secondary', size: 16, sub: 'No captain’s points' });
          } else text(ctx, this.c.done.includes(sel) ? 'Already been here today' : 'Today’s spots are set', sx + 16, cy + ch - 30, { size: 14, color: '#9fb8c2', weight: 700 });
        }
      }
    }
  }
  // the hand-off to a new captain, before the boat moves
  drawCaptain(ctx, W, H, t) {
    const P = this.panel, C = CHARS[this.driver], ax = W / 2, ay = 128; P.t += 1 / 60;
    ctx.fillStyle = `rgba(3,22,32,${Math.min(0.8, 0.5 + P.t * 2)})`; ctx.fillRect(0, 0, W, H);
    UI.region('captain-bg', 0, 0, W, H, () => {});
    drawSunburst(ctx, ax, ay, 240, t, rgba(C.color, 0.16));
    const pop = easeBack(Math.min(1, P.t / 0.4));
    ctx.save(); ctx.translate(ax, ay); ctx.scale(pop, pop); crewAvatar(ctx, this.driver, 0, 0, 66, { ring: C.color, bg: '#8fd3ee' }); ctx.restore();
    text(ctx, 'Hand the phone to ' + C.name, ax, 228, { size: 20, align: 'center', color: '#cfe3ea', weight: 700, maxW: W - 60 });
    text(ctx, 'Captain ' + C.name, ax, 282, { display: true, size: 48, align: 'center', color: '#fff', maxW: W - 60 });
    const job = this.homeRun ? 'Take us home to the dock in Tavernier.' : !this.c.legs ? 'Idle out of the canal, then pick a spot on the chart.' : 'Pick the next spot on the chart and take us there.';
    text(ctx, job, ax, 320, { size: 19, align: 'center', color: PAL.sun, weight: 800, maxW: W - 60 });
    text(ctx, 'Captain’s points for a clean run: no groundings, no tickets.', ax, 348, { size: 16, align: 'center', color: '#cfe3ea', weight: 600, maxW: W - 60 });
    UI.button(ctx, 'wheel', ax - 140, H - 132, 280, 64, 'Take the wheel', () => this.takeWheel(), { style: 'primary', size: 24, key: 'Enter|Space' });
  }
  drawSummary(ctx, W, H, t) {
    const P = this.panel; P.t += 1 / 60;
    ctx.fillStyle = `rgba(3,22,32,${Math.min(0.78, P.t * 2)})`; ctx.fillRect(0, 0, W, H);
    UI.region('sum-bg', 0, 0, W, H, () => {});
    const home = P.id === 'home', name = home ? 'the dock' : SPOTS[P.id].name;
    const lines = this.lines;
    const pw = Math.min(540, W - 60), px = W / 2 - pw / 2, ph = 150 + Math.max(1, lines.length) * 30, py = Math.max(16, H / 2 - ph / 2 - 34);
    panel(ctx, px, py, pw, ph, { r: 22 });
    text(ctx, (home ? 'Back at ' : 'Anchored at ') + name, px + 24, py + 46, { display: true, size: 28, color: '#fff', maxW: pw - 48 });
    text(ctx, 'Captain ' + CHARS[this.driver].name + ' · ' + (this.legDist / UNITS_PER_NM).toFixed(1) + ' nm', px + 24, py + 74, { size: 15, color: '#9fb8c2', weight: 700 });
    let y = py + 108;
    if (!lines.length) text(ctx, 'Uneventful ride. Nothing to report.', px + 24, y, { size: 17, color: '#cfe3ea', weight: 600 });
    for (const l of lines) { text(ctx, l.label, px + 24, y, { size: 17, color: l.pts < 0 ? '#ff9a8a' : '#fff', weight: 600, maxW: pw - 120 }); text(ctx, (l.pts > 0 ? '+' : '') + l.pts, px + pw - 24, y, { size: 18, align: 'right', color: l.pts < 0 ? PAL.bad : PAL.sun, weight: 800 }); y += 30; }
    const tot = this.total || 0;
    text(ctx, 'Captain’s points: ' + (tot > 0 ? '+' : '') + tot, px + 24, py + ph - 18, { size: 18, color: PAL.sun, weight: 800 });
    UI.button(ctx, 'letsfish', W / 2 - 130, py + ph + 16, 260, 56, home ? 'Call it a day' : spotDo(this.panel.id).go, () => this.finishLeg(false), { style: 'primary', size: 22, key: 'Enter|Space' });
  }
  drawPause(ctx, W, H) {
    ctx.fillStyle = 'rgba(3,22,32,0.82)'; ctx.fillRect(0, 0, W, H);
    UI.region('pause-bg', 0, 0, W, H, () => {});
    const c = this.c;
    if (this.panel.confirm) {
      text(ctx, c.mode === 'crew' ? 'End the trip early?' : 'Head home?', W / 2, 170, { display: true, size: 40, align: 'center', color: '#fff' });
      text(ctx, c.mode === 'crew' ? 'Scores so far go on the board.' : 'You can run home or skip the ride.', W / 2, 206, { size: 18, align: 'center', color: '#cfe3ea', weight: 600 });
      UI.button(ctx, 'run-home', W / 2 - 230, 250, 220, 56, 'Run home', () => { this.dest = 'home'; this.homeRun = true; this.panel = null; this.planRoute(); this.setAuto(true); Music.play('sunset'); }, { style: 'primary', size: 20 });
      UI.button(ctx, 'end-now', W / 2 + 10, 250, 220, 56, 'End it here', () => { this.panel = null; Game.go(new DayEndScene()); }, { style: 'coral', size: 20 });
      UI.button(ctx, 'keep', W / 2 - 110, 324, 220, 50, 'Keep going', () => (this.panel = null), { style: 'ghost', size: 18, key: 'Escape' });
      return;
    }
    text(ctx, 'Paused', W / 2, 140, { display: true, size: 54, align: 'center', color: '#fff' });
    text(ctx, this.areaName() + ' · Captain ' + CHARS[this.driver].name, W / 2, 182, { size: 20, align: 'center', color: '#cfe3ea', weight: 600 });
    UI.button(ctx, 'resume', W / 2 - 130, 222, 260, 56, 'Resume', () => (this.panel = null), { key: 'Enter|Space', size: 22 });
    UI.button(ctx, 'mute', W / 2 - 130, 294, 125, 50, SFX.muted ? 'Sound: off' : 'Sound: on', () => SFX.setMuted(!SFX.muted), { style: 'secondary', size: 17 });
    UI.button(ctx, 'music', W / 2 + 5, 294, 125, 50, Music.on ? 'Music: on' : 'Music: off', () => Music.setOn(!Music.on), { style: 'secondary', size: 17 });
    UI.button(ctx, 'endtrip', W / 2 - 130, 360, 125, 50, c.mode === 'crew' ? 'End the trip' : 'Head home', () => (this.panel = { kind: 'pause', confirm: true }), { style: 'coral', size: 17 });
    UI.button(ctx, 'totitle', W / 2 + 5, 360, 125, 50, 'Quit to title', () => { this.saveBoat(); Game.go(new TitleScene()); }, { style: 'ghost', size: 17 });
    GFX.pauseRow(ctx, W / 2, 422);
    text(ctx, c.mode !== 'crew' ? 'Solo days aren’t saved. Your logbook is.' : Store.failed ? 'This browser isn’t saving, so the trip ends if you leave.' : 'Your trip is saved. Resume it from the title screen.', W / 2, 496, { size: 15, align: 'center', color: '#9fb8c2', weight: 600 });
  }
}
function segCross(ax, ay, bx, by, cx, cy, dx, dy) {
  const d = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx); if (!d) return false;
  const u = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / d, v = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / d;
  return u >= 0 && u <= 1 && v >= 0 && v <= 1;
}
