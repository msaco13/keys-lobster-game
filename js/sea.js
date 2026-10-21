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
function spotAllowed(id) { const c = Trip.cur; if (c.mode === 'solo') return true; return !c.done.includes(id) && c.done.length < c.spotsNeeded; }
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
  }
  enter() {
    Music.play(this.homeRun ? 'sunset' : 'run'); SFX.setAmbient(0.7, false);
    const C = CHARS[this.driver];
    if (this.homeRun) Game.toast('Heading home', { color: PAL.sun, size: 40, y: 150, sub: 'Captain ' + C.name + ', take us back to the dock in Tavernier' });
    else if (!this.c.legs) Game.toast('Cast off!', { color: PAL.sun, size: 44, y: 150, sub: 'Captain ' + C.name + ' at the wheel. Idle out of the canal.' });
    else Game.toast('Captain ' + C.name, { color: PAL.sun, size: 40, y: 150, sub: spotsLeft() ? '' : 'Pick the next spot on the chart, or go exploring' });
    if (this.dest) this.planRoute();
  }
  exit() { SFX.setEngine(0); SFX.setAmbient(0); this.saveBoat(); }
  saveBoat() { this.c.boat = { x: this.x, y: this.y, h: this.h }; Trip.save(); }
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
  planRoute() {
    const xy = this.destXY(); if (!xy) { this.route = null; return; }
    // leave and come home straight down the middle of Tavernier harbor channel, like everybody does
    const Hm = World.home, mouth = [Hm.x, Hm.mouthY + 30], outer = [Hm.x, wy(Hm.x, Hm.hw + 640)], inHarbor = World.zones[0], inside = (x, y) => x > inHarbor.x0 && x < inHarbor.x1 && y > inHarbor.y0 && y < inHarbor.y1;
    let path;
    if (this.dest === 'home') {
      if (inside(this.x, this.y)) path = [[Hm.x, this.y < Hm.mouthY ? this.y : Hm.mouthY + 30], [Hm.x, Hm.dockY + 20]];
      else { const p = World.findPath(this.x, this.y, outer[0], outer[1]); path = p && p.concat([mouth, [Hm.x, Hm.dockY + 20]]); }
    } else if (inside(this.x, this.y)) {
      const p = World.findPath(outer[0], outer[1], xy[0], xy[1]);
      path = p && (this.y < Hm.mouthY ? [[Hm.x, Hm.mouthY - 10], mouth, outer] : [mouth, outer]).concat(p);
    } else path = World.findPath(this.x, this.y, xy[0], xy[1]);
    this.route = path; this.ri = 0;
    if (!path) Game.toast('No clear way through', { color: PAL.warn, size: 26, y: 170, sub: 'Steer it yourself. Follow the deeper (darker) water.' });
  }
  setAuto(on) {
    if (on && !this.route) this.planRoute();
    this.auto = on && !!this.route;
    if (this.auto && this.notch < 3) this.notch = 3;
    SFX.play('click');
  }

  /* ---------- input ---------- */
  setNotch(n) { if (this.fwc || this.panel) return; const was = this.notch; this.notch = clamp(n, 0, 4); if (was !== this.notch) SFX.play('click'); }
  pointerDown(p) { if (this.panel) return; this.steer = { id: p.id, x: p.x, y: p.y }; }
  pointerMove(p) { if (this.steer && this.steer.id === p.id) { this.steer.x = p.x; this.steer.y = p.y; } }
  pointerUp(p) { if (this.steer && this.steer.id === p.id) this.steer = null; }
  keyDown(c) {
    if (c === 'Escape') { if (this.panel && this.panel.kind !== 'summary') { this.panel = null; this.sel = null; } else if (!this.panel) this.panel = { kind: 'pause' }; return; }
    if (this.panel) return;
    if (c === 'KeyM' || c === 'Tab') { this.openChart(); return; }
    if (c === 'ArrowUp' || c === 'KeyW') this.setNotch(this.notch + 1);
    if (c === 'ArrowDown' || c === 'KeyS') this.setNotch(this.notch - 1);
    if (/^Digit[1-5]$/.test(c)) this.setNotch(+c.slice(5) - 1);
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
    if (this.steer) {
      const [sx, sy] = this.toScreen(this.x, this.y), want = Math.atan2(this.steer.y - sy, this.steer.x - sx);
      if (dist(sx, sy, this.steer.x, this.steer.y) > 24) rud = clamp(angleDiff(this.h, want) * 2.4, -1, 1);
    }
    if (rud) { if (this.auto) { this.auto = false; Game.toast('Autopilot off', { size: 22, y: 170, color: '#fff' }); } }
    // autopilot
    let cap = 999;
    if (this.auto && this.route && !this.panel) {
      let tgt = this.route[this.ri];
      while (tgt && dist(this.x, this.y, tgt[0], tgt[1]) < 110 && this.ri < this.route.length - 1) { this.ri++; tgt = this.route[this.ri]; }
      if (tgt) {
        const off = angleDiff(this.h, Math.atan2(tgt[1] - this.y, tgt[0] - this.x));
        rud = clamp(off * 2.6, -1, 1);
        if (Math.abs(off) > 0.5) cap = NOTCH[2].v; if (Math.abs(off) > 1.2) cap = NOTCH[1].v;
        // dodge trap floats
        const ca = Math.cos(this.h), sa = Math.sin(this.h);
        for (const f of World.floatsNear(this.x)) { if (f.hit) continue; const fx = f.x - this.x, fy = f.y - this.y, fwd = fx * ca + fy * sa, lat = -fx * sa + fy * ca; if (fwd > 20 && fwd < 190 && Math.abs(lat) < 30) rud = clamp(rud - Math.sign(lat || 1) * 0.9, -1, 1); }
        const ahead = World.gridDepth(this.x + Math.cos(this.h) * 160, this.y + Math.sin(this.h) * 160);
        if (World.inZone(this.x, this.y) || World.inZone(this.x + Math.cos(this.h) * 200, this.y + Math.sin(this.h) * 200)) cap = NOTCH[2].v;
        if (ahead < 5) cap = Math.min(cap, 130);
        if (this.ri === this.route.length - 1 && dist(this.x, this.y, tgt[0], tgt[1]) < 260) cap = Math.min(cap, NOTCH[2].v);
        if (this.ri === this.route.length - 1 && dist(this.x, this.y, tgt[0], tgt[1]) < 70) { this.auto = false; this.notch = 0; Game.toast('Arrived', { size: 30, y: 160, color: PAL.good }); }
      }
    }
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
    this.updateWorld(dt);
    this.updateFoam(dt);
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
    for (const m of World.markers) if (Math.abs(m.x - nx) < 80 && Math.abs(m.y - ny) < 80) hard.push([m.x, m.y, 6]);
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
      this.fl.add(Game.W / 2, Game.H / 2 - 80, 'AIRTIME! +25', PAL.sun, 26); SFX.play('woo'); this.say('air', 0.8);
    } else { Game.shake(3); SFX.play('splash'); }
  }
  bump(msg) {
    if (this.bumpCd > this.t) return; this.bumpCd = this.t + 1;
    this.flags.bumps++; Game.shake(6); SFX.play('chomp'); Game.toast(msg, { color: PAL.warn, size: 28, y: 170 }); this.say('bump', 0.6);
  }
  runAground() {
    this.stuck = 2.6; this.v = 0; this.flags.aground++;
    const d = World.depth(this.x, this.y), bay = this.y < chainY(this.x);
    this.parts.burst(Game.W / 2, Game.H / 2, 20, { color: bay ? 'rgba(140,110,70,0.7)' : 'rgba(230,210,160,0.8)', min: 30, max: 120, life: 1.2, drag: 1.5 });
    Game.toast('Ran aground!', { color: PAL.coral, size: 40, y: 170, sub: d < 4 && !bay && this.y - chainY(this.x) > 1100 ? 'That’s a patch reef. Brown water means shallow.' : 'Too fast over the flats. Go slow over light water.' });
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
    if (this.zone && this.v > NO_WAKE && !this.flags.fwc) { this.speedT += dt; if (this.speedT > 1.3) this.pullOver(); } else this.speedT = Math.max(0, this.speedT - dt);
    if (this.fwc) { this.fwc.t -= dt; this.fwc.k = Math.min(1, this.fwc.k + dt * 1.2); if (this.fwc.t <= 0) this.fwc = null; }
    if (this.air) { this.air.t += dt; if (this.air.t >= this.air.dur) { this.air = null; SFX.play('bigsplash'); Game.shake(5); for (let i = 0; i < 18; i++) this.foam.push(this.foamBlob(this.x + rand(-30, 30), this.y + rand(-30, 30), rand(-60, 60), rand(-60, 60), rand(8, 18), 1.2)); } }
    // discover uncharted spots by running past them
    for (const id of SPOT_ORDER) {
      if (Charts.isKnown(id)) continue;
      const [sx, sy] = spotXY(id);
      if (dist(this.x, this.y, sx, sy) < SPOTS[id].r + 300) {
        Charts.add(id); if (!c.found.includes(id)) c.found.push(id);
        this.lines.push({ label: 'Found ' + SPOTS[id].name, pts: 75 });
        Game.toast('NEW SPOT: ' + SPOTS[id].name, { color: PAL.sun, size: 40, y: 140, dur: 2.6, sub: SPOTS[id].kind + ' · it’s on the chart now (+75)' });
        SFX.play('trophy'); this.say('found'); Trip.save();
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
      this.flags.dolphins = true; this.lines.push({ label: 'Dolphins rode the bow wake', pts: 25 }); this.fl.add(Game.W / 2, Game.H / 2 - 90, 'Dolphins! +25', '#bff0ff', 22); this.say('dolphins'); SFX.play('coin');
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
        if (this.v <= NO_WAKE) { this.lines.push({ label: 'Went slow for a manatee', pts: 25 }); this.fl.add(Game.W / 2, Game.H / 2 - 90, 'Manatee +25', '#d8f0e8', 22); this.say('manatee'); SFX.play('coin'); }
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

  /* ---------- arriving ---------- */
  arrive(id) {
    this.auto = false; this.notch = 0; this.v = 0;
    if (this.legDist > UNITS_PER_NM * 1.5) this.lines.push({ label: 'Ran ' + (this.legDist / UNITS_PER_NM).toFixed(1) + ' nm', pts: Math.min(100, Math.round(this.legDist / UNITS_PER_NM) * 5) });
    if (!this.flags.aground && !this.flags.fwc && !this.flags.bumps && this.legDist > UNITS_PER_NM * 3) this.lines.push({ label: 'Clean run · no bumps, no tickets', pts: 50 });
    this.total = this.lines.reduce((a, l) => a + l.pts, 0);
    this.panel = { kind: 'summary', id, t: 0 };
    SFX.play(this.total > 0 ? 'catch' : 'click'); this.say('arrive', 0.6);
  }
  finishLeg(skipped) {
    if (this.done) return; this.done = true;
    const c = this.c, id = this.panel && this.panel.id, pts = skipped ? 0 : this.total || 0;
    if (pts) { c.scores[this.driver] = (c.scores[this.driver] || 0) + pts; c.turns.push({ ch: this.driver, spot: 'run:' + id, total: pts, n: 0 }); }
    c.legs = (c.legs || 0) + 1;
    if (id === 'home') { this.saveBoat(); Game.go(new DayEndScene()); return; }
    c.spot = id; c.turn = 0; this.saveBoat(); Game.go(new TurnIntroScene());
  }
  skipTo(id) {
    const [sx, sy] = id === 'home' ? [World.home.x + 10, World.home.dockY + 4] : spotXY(id);
    this.x = sx + (id === 'home' ? 0 : -60); this.y = sy + (id === 'home' ? 0 : 30); this.cam.x = this.x; this.cam.y = this.y;
    this.lines = []; this.total = 0; this.trail = []; this.foam = []; this.panel = { kind: 'summary', id, t: 0, skipped: true };
  }

  /* ---------- drawing ---------- */
  draw(ctx) {
    const W = Game.W, H = Game.H, t = this.t, z = this.cam.z;
    const v = { x0: this.cam.x - W / 2 / z, y0: this.cam.y - H / 2 / z, x1: this.cam.x + W / 2 / z, y1: this.cam.y + H / 2 / z, z };
    v.sun = { x: this.cam.x + 260 / z, y: this.cam.y - 140 / z, r: 300 / z };
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-this.cam.x, -this.cam.y);
    World.drawWater(ctx, v, t);
    World.drawCloudShadows(ctx, v, 1);
    // swell: big soft light and dark patches drifting with the wind
    ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = 0.5 + this.wind.chop * 0.3;
    const sp = ctx.createPattern(World.swell(), 'repeat'), ss = 3.2, so = t * (8 + this.wind.chop * 10);
    ctx.scale(ss, ss); ctx.translate(so * 0.6 / ss, so * 0.3 / ss); ctx.fillStyle = sp; ctx.fillRect(v.x0 / ss - so, v.y0 / ss - so, (v.x1 - v.x0) / ss + 2 * so + 10, (v.y1 - v.y0) / ss + 2 * so + 10);
    ctx.restore();
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
    if (this.dolphins) this.drawDolphins(ctx, t);
    for (const B of this.boats) { if (B.dead || B.x < v.x0 - 120 || B.x > v.x1 + 120 || B.y < v.y0 - 120 || B.y > v.y1 + 120) continue; drawBoatTop(ctx, B.x, B.y, B.big ? 0.7 : 0.5, B.h, { hull: B.hull }); }
    if (this.fwc) this.drawFwc(ctx, t);
    const za = this.air ? Math.sin((this.air.t / this.air.dur) * Math.PI) : 0;
    if (za > 0) { ctx.fillStyle = 'rgba(0,30,50,0.25)'; ell(ctx, this.x + 16 * za, this.y + 26 * za, 66, 26, this.h); ctx.fill(); }
    const bob = Math.sin(t * (2 + this.wind.chop * 2)) * 0.02 * this.wind.chop * (this.v < 50 ? 1 : 0.3);
    drawBoatTop(ctx, this.x, this.y - 10 * za, 0.62 * (1 + 0.22 * za), this.h + bob, { crew: this.crew });
    World.drawBridges(ctx, v, t);
    ctx.restore();
    this.parts.draw(ctx);
    // the light: morning, midday, afternoon, sunset on the way home
    const legs = this.c.legs || 0;
    const tint = this.homeRun ? ['rgba(255,120,60,0.2)', 'rgba(40,20,80,0.12)'] : legs === 0 ? ['rgba(255,220,170,0.08)', null] : legs >= 3 ? ['rgba(255,190,110,0.1)', null] : [null, null];
    if (tint[0]) { ctx.fillStyle = tint[0]; ctx.fillRect(0, 0, W, H); }
    if (tint[1]) { const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, tint[1]); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    if (this.v > 200) { const k = (this.v - 200) / 120, g = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, H * 0.95); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,20,40,${0.28 * k})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    this.fl.draw(ctx);
    this.drawHud(ctx, W, H, t);
    if (this.panel) {
      if (this.panel.kind === 'chart') this.drawChart(ctx, W, H, t);
      else if (this.panel.kind === 'summary') this.drawSummary(ctx, W, H, t);
      else if (this.panel.kind === 'pause') this.drawPause(ctx, W, H);
    }
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
      const ok = spotAllowed(id), here = this.inSpot === id;
      ctx.save(); ctx.strokeStyle = here ? 'rgba(255,214,90,0.85)' : ok ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.18)'; ctx.lineWidth = here ? 5 : 3; ctx.setLineDash([18, 16]); ctx.lineDashOffset = -t * 20;
      ell(ctx, x, y, S.r, S.r); ctx.stroke(); ctx.restore();
      // a marker buoy with a flag
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ell(ctx, x + 4, y + 6, 13, 13); ctx.fill();
      ctx.fillStyle = PAL.coral; ell(ctx, x, y, 13, 13); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(x - 13, y - 3, 26, 6);
      ctx.strokeStyle = '#222'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 34); ctx.stroke();
      ctx.fillStyle = PAL.sun; ctx.beginPath(); ctx.moveTo(x, y - 34); ctx.lineTo(x + 22, y - 28 + Math.sin(t * 5) * 2); ctx.lineTo(x, y - 22); ctx.fill();
      const done = this.c.done.includes(id) && this.c.mode === 'crew';
      text(ctx, S.name, x, y + 34, { size: 20 / Math.max(0.7, v.z), align: 'center', color: '#fff', weight: 800, stroke: PAL.ink, sw: 5, alpha: ok ? 1 : 0.6 });
      text(ctx, done ? 'Fished today' : S.kind, x, y + 34 + 20 / Math.max(0.7, v.z), { size: 15 / Math.max(0.7, v.z), align: 'center', color: done ? '#cfd8dc' : PAL.sun, weight: 800, stroke: PAL.ink, sw: 4, alpha: ok ? 1 : 0.6 });
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
      for (let k = 0; k < 3; k++) { const a = t * (0.9 + k * 0.2) + k * 2 + i; drawFrigate(ctx, bx + Math.cos(a) * 70, by + Math.sin(a) * 40 - 40, 1.3, t * 6 + k); }
    }
  }
  drawCourse(ctx, t) {
    if (!this.route || !this.dest) return;
    ctx.save(); ctx.strokeStyle = this.auto ? 'rgba(255,214,90,0.75)' : 'rgba(255,255,255,0.5)'; ctx.lineWidth = 6; ctx.setLineDash([22, 18]); ctx.lineDashOffset = -t * 40; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(this.x, this.y); for (let i = this.ri; i < this.route.length; i++) ctx.lineTo(this.route[i][0], this.route[i][1]); ctx.stroke(); ctx.restore();
  }
  drawManatee(ctx, m, t) {
    const up = Math.sin(m.t * 0.8) > 0.1;
    ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(m.h); ctx.globalAlpha = up ? 0.85 : 0.4;
    ctx.fillStyle = '#7d7f78'; ell(ctx, 0, 0, 34, 16); ctx.fill(); ell(ctx, -36, 0, 13, 15); ctx.fill(); ell(ctx, 30, 0, 12, 10); ctx.fill();
    ctx.fillStyle = '#6a6c66'; ell(ctx, 12, -15, 8, 4, 0.5); ctx.fill(); ell(ctx, 12, 15, 8, 4, -0.5); ctx.fill();
    ctx.restore();
    if (up && chance(0.05)) this.foam.push(this.foamBlob(m.x + Math.cos(m.h) * 34, m.y + Math.sin(m.h) * 34, 0, 0, 4, 0.8));
  }
  drawDolphins(ctx, t) {
    const D = this.dolphins, fade = Math.min(1, D.t * 2, (D.dur - D.t) * 2), ca = Math.cos(this.h), sa = Math.sin(this.h);
    for (const p of D.pod) {
      const ph = t * 3 + p.ph, up = Math.sin(ph), x = this.x + ca * (p.ox + 20) - sa * p.oy, y = this.y + sa * (p.ox + 20) + ca * p.oy;
      ctx.save(); ctx.translate(x, y); ctx.rotate(this.h); ctx.globalAlpha = fade * (up > 0 ? 1 : 0.45);
      const s = 1 + Math.max(0, up) * 0.25; ctx.scale(s, s);
      ctx.fillStyle = '#6d7e8c'; ell(ctx, 0, 0, 26, 8); ctx.fill(); ell(ctx, 26, 0, 6, 3); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(-36, -8); ctx.lineTo(-33, 0); ctx.lineTo(-36, 8); ctx.fill();
      ctx.fillStyle = '#566672'; ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(-14, -3); ctx.lineTo(-10, 0); ctx.fill();
      ctx.restore();
      if (up > 0.95 && chance(0.3)) this.foam.push(this.foamBlob(x, y, 0, 0, 5, 0.6));
    }
  }
  drawFwc(ctx, t) {
    const k = easeOut(this.fwc.k), x = this.x - Math.cos(this.h) * lerp(400, 90, k) + Math.cos(this.h + Math.PI / 2) * 60, y = this.y - Math.sin(this.h) * lerp(400, 90, k) + Math.sin(this.h + Math.PI / 2) * 60;
    drawBoatTop(ctx, x, y, 0.55, this.h, {});
    ctx.fillStyle = 'rgba(40,90,200,0.85)'; rr(ctx, x - 12, y - 12, 26, 24, 4); ctx.fill();
    const on = Math.floor(t * 8) % 2; ctx.fillStyle = on ? '#4aa0ff' : '#ffffff'; ell(ctx, x, y - 8, 4, 4); ctx.fill(); ctx.fillStyle = on ? '#ffffff' : '#4aa0ff'; ell(ctx, x, y + 8, 4, 4); ctx.fill();
    text(ctx, 'FWC', x, y + 32, { size: 14, align: 'center', color: '#fff', weight: 800, stroke: '#123a8a', sw: 4 });
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
    panel(ctx, px, 12, pw, 46, { r: 18 });
    const xy = this.destXY();
    if (xy) {
      const nm = dist(this.x, this.y, xy[0], xy[1]) / UNITS_PER_NM;
      text(ctx, (this.dest === 'home' ? 'Home dock' : SPOTS[this.dest].name) + ' · ' + nm.toFixed(1) + ' nm', px + 16, 32, { size: 15, color: '#fff', weight: 800, maxW: pw - 110 });
    } else text(ctx, this.areaName(), px + 16, 32, { size: 15, color: '#fff', weight: 800, maxW: pw - 110 });
    text(ctx, xy ? this.areaName() : 'Exploring', px + 16, 50, { size: 12, color: '#9fb8c2', weight: 700, maxW: pw - 110 });
    text(ctx, depth > 99 ? (depth > 600 ? '600+' : Math.round(depth)) + ' ft' : depth.toFixed(1) + ' ft', px + pw - 14, 33, { size: 18, align: 'right', color: depth < 3 ? PAL.bad : depth < 5 ? PAL.warn : '#7ff0ff', weight: 800 });
    text(ctx, 'DEPTH', px + pw - 14, 50, { size: 11, align: 'right', color: '#9fb8c2', weight: 800 });
    // minimap (tap for the chart)
    this.drawMinimap(ctx, mmX, mmY, mmW, mmH, t);
    UI.region('mini', mmX, mmY, mmW, mmH, () => this.openChart(), { disabled: open });
    // speed and throttle
    const kts = Math.round(this.v * SEA_KTS), sx = 26, sy = H - 26;
    panel(ctx, sx - 12, sy - 82, 172, 92, { r: 18 });
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(sx + 50, sy - 8, 44, Math.PI, TAU); ctx.stroke();
    ctx.strokeStyle = this.v > 280 ? PAL.coral : PAL.sun; ctx.beginPath(); ctx.arc(sx + 50, sy - 8, 44, Math.PI, Math.PI + Math.PI * clamp(this.v / 320, 0, 1)); ctx.stroke();
    text(ctx, String(kts), sx + 50, sy - 14, { size: 28, align: 'center', color: '#fff', weight: 800 });
    text(ctx, 'KNOTS', sx + 50, sy + 2, { size: 11, align: 'center', color: '#9fb8c2', weight: 800 });
    text(ctx, NOTCH[this.notch].name, sx + 108, sy - 30, { size: 15, color: PAL.sun, weight: 800 });
    text(ctx, this.auto ? 'autopilot' : this.v > 150 ? 'on plane' : this.v > 5 ? 'plowing' : 'stopped', sx + 108, sy - 12, { size: 12, color: this.auto ? PAL.sun : '#9fb8c2', weight: 700 });
    const lx = W - 92, ly0 = mmY + mmH + 46, lh = H - ly0 - 16;
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
      const ok = spotAllowed(this.inSpot), slow = this.v <= 95;
      if (ok) UI.button(ctx, 'fish', bx, by - 8, bw, 56, 'Fish here', () => this.arrive(this.inSpot), { style: 'primary', size: 22, key: 'Enter', disabled: open || !slow, sub: slow ? SPOTS[this.inSpot].name : 'Slow down to stop here' });
      else { panel(ctx, bx, by, bw, 44, { r: 18 }); text(ctx, this.c.done.includes(this.inSpot) ? 'Already fished today' : 'Today’s spots are set', bx + bw / 2, by + 28, { size: 15, align: 'center', color: '#cfe3ea', weight: 700, maxW: bw - 16 }); }
    }
    // banners
    const banner = (msg, fill, col) => { panel(ctx, W / 2 - 170, 66, 340, 34, { r: 17, fill, line: 'rgba(0,0,0,0.1)' }); text(ctx, msg, W / 2, 88, { size: 15, align: 'center', color: col, weight: 800 }); };
    if (this.zone && !open) banner(this.v > NO_WAKE ? 'NO WAKE! Throttle down to SLOW' : 'NO WAKE ZONE · ' + this.zone.name, this.v > NO_WAKE ? 'rgba(200,60,20,0.92)' : 'rgba(255,255,255,0.92)', this.v > NO_WAKE ? '#fff' : PAL.ink);
    else if (!open && World.gridDepth(this.x + Math.cos(this.h) * 120, this.y + Math.sin(this.h) * 120) < 4 && this.v > 110) banner('Shallow ahead! Ease off', 'rgba(230,200,120,0.95)', PAL.ink);
    else if (this.stall > 0 && !open) banner('Prop wrapped… ' + this.stall.toFixed(1) + 's', 'rgba(255,255,255,0.92)', PAL.ink);
    // a pointer to the destination when it's off screen
    if (xy && !open) {
      const [tx, ty] = this.toScreen(xy[0], xy[1]);
      if (tx < 30 || tx > W - 30 || ty < 70 || ty > H - 30) {
        const a = Math.atan2(ty - H / 2, tx - W / 2), r = Math.min(W * 0.42, H * 0.36), ax = W / 2 + Math.cos(a) * r, ay = H / 2 + Math.sin(a) * r;
        ctx.save(); ctx.translate(ax, ay); ctx.rotate(a); ctx.fillStyle = 'rgba(255,214,90,0.9)'; ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-10, -13); ctx.lineTo(-4, 0); ctx.lineTo(-10, 13); ctx.closePath(); ctx.fill(); ctx.restore();
      }
    }
    if (this.t < 9 && !open && !this.c.legs) para(ctx, Game.touch ? 'Hold and drag where you want to go. Throttle is on the right. Tap Chart to pick a spot.' : 'Hold the mouse where you want to go, or ← →. ↑ ↓ or the lever for throttle. M for the chart.', 196, H - 110, Math.min(460, W - 420), { size: 16, color: '#fff', weight: 700, stroke: 'rgba(0,0,0,0.5)', sw: 4, lh: 20 });
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
    lab('EVERGLADES', 9000, wy(9000, -5600), { size: 15, color: 'rgba(60,70,30,0.6)' });
    lab('HAWK CHANNEL', 11500, wy(11500, 1000), { size: 11, color: 'rgba(40,90,130,0.6)' });
    lab('ATLANTIC OCEAN', 11800, wy(11800, 3600), { size: 15, color: 'rgba(40,90,130,0.5)' });
    lab('GULF STREAM →', 12400, wy(12400, 5800), { size: 13, color: 'rgba(40,90,130,0.5)' });
    lab('reef line', 2600, wy(2600, 2430), { size: 10, color: 'rgba(120,80,140,0.8)' });
    for (const I of ISLANDS) { const lx = (I.x0 + Math.min(I.x1, WORLD.W)) / 2; lab(I.name, lx, chainY(lx) + (I.name === 'ISLAMORADA' ? -260 : 260), { size: 9, color: 'rgba(90,70,30,0.85)' }); }
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
      ctx.save(); ctx.translate(X, Y); ctx.globalAlpha = done ? 0.5 : 1;
      if (S.mode === 'bughunt') { ctx.rotate(-0.4); drawLobsterSide(ctx, r * 1.1, { t }); } else drawFish(ctx, S.species[0], r * 1.5, { wig: 0 });
      ctx.restore();
      text(ctx, S.name, X, Y + r + 12, { size: 12, align: 'center', color: '#fff', weight: 800, stroke: PAL.ink, sw: 4 });
      UI.region('chartpin-' + id, X - 22, Y - 22, 44, 44, () => { this.sel = id; SFX.play('tick'); });
    };
    for (const id of SPOT_ORDER) {
      const known = Charts.isKnown(id); let [x, y] = spotXY(id);
      if (!known) { x += (hash2(id.length, 3) - 0.5) * 1400; y += (hash2(3, id.length) - 0.5) * 900; }
      pin(id, x, y, known);
    }
    const hx = M.X(World.home.x), hy = M.Y(World.home.dockY);
    ctx.fillStyle = PAL.ink; ell(ctx, hx, hy, 6, 6); ctx.fill(); ctx.fillStyle = '#fff'; ell(ctx, hx, hy, 2.5, 2.5); ctx.fill();
    text(ctx, 'Home', hx + 9, hy - 6, { size: 11, color: PAL.ink, weight: 800 });
    UI.region('chartpin-home', hx - 16, hy - 16, 32, 32, () => { this.sel = 'home'; SFX.play('tick'); });
    if (this.route && this.dest) { ctx.strokeStyle = 'rgba(210,120,20,0.9)'; ctx.lineWidth = 2.5; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(M.X(this.x), M.Y(this.y)); for (let i = this.ri; i < this.route.length; i++) ctx.lineTo(M.X(this.route[i][0]), M.Y(this.route[i][1])); ctx.stroke(); ctx.setLineDash([]); }
    ctx.save(); ctx.translate(M.X(this.x), M.Y(this.y)); ctx.rotate(this.h); ctx.fillStyle = '#d7262e'; ctx.beginPath(); ctx.moveTo(11, 0); ctx.lineTo(-7, -7); ctx.lineTo(-7, 7); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2; rr(ctx, cx, cy, cw, ch, 12); ctx.stroke();
    // compass rose
    const rx = cx + cw - 34, ry = cy + 40; ctx.save(); ctx.translate(rx, ry); ctx.rotate(-0.75); ctx.fillStyle = 'rgba(40,60,80,0.7)'; ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(5, 0); ctx.lineTo(0, 22); ctx.lineTo(-5, 0); ctx.closePath(); ctx.fill(); text(ctx, 'N', 0, -28, { size: 12, align: 'center', color: 'rgba(40,60,80,0.9)', weight: 800 }); ctx.restore();
    // header
    text(ctx, 'The Chart', 24, 50, { display: true, size: 30, color: '#fff' });
    const known = Charts.known().size;
    text(ctx, 'Spots found: ' + known + ' / ' + SPOT_ORDER.length + (known < SPOT_ORDER.length ? ' · run past a ? to find it' : ' · you found them all!'), 200, 46, { size: 15, color: '#cfe3ea', weight: 700, maxW: W - 360 });
    UI.button(ctx, 'chartclose', W - 130, 14, 116, 44, 'Close', () => { this.panel = null; this.sel = null; }, { style: 'ghost', size: 18, key: 'Escape|KeyM' });
    // the side card
    const sx = cx + cw + 14, sw = W - sx - 14;
    {
      const sel = this.sel;
      panel(ctx, sx, cy, sw, ch, { r: 16 });
      if (!sel) {
        para(ctx, this.homeRun ? 'Tap Home to set a course back to the dock.' : 'Tap a spot to see what bites there. Set a course and the autopilot drives, or skip the ride.', sx + 16, cy + 30, sw - 32, { size: 15, color: '#cfe3ea', weight: 600, lh: 20 });
        let y = cy + 130;
        text(ctx, this.c.mode === 'crew' ? 'TODAY · ' + this.c.done.length + '/' + this.c.spotsNeeded + ' SPOTS' : 'SOLO DAY', sx + 16, y, { size: 13, color: '#9fb8c2', weight: 800 }); y += 24;
        for (const ch2 of this.c.crew.slice().sort((a, b) => this.c.scores[b] - this.c.scores[a])) { crewAvatar(ctx, ch2, sx + 30, y, 14); text(ctx, CHARS[ch2].name, sx + 52, y + 5, { size: 15, color: '#fff', weight: 800 }); text(ctx, this.c.scores[ch2].toLocaleString(), sx + sw - 16, y + 5, { size: 15, align: 'right', color: PAL.sun, weight: 800 }); y += 34; }
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
          para(ctx, '“' + S.rumor + '”', sx + 16, cy + 86, sw - 32, { size: 15, color: '#fff', weight: 600, lh: 20 });
          para(ctx, 'Drive near the ? to find it and put it on the chart.', sx + 16, cy + ch - 60, sw - 32, { size: 14, color: '#9fb8c2', weight: 600, lh: 18 });
        } else {
          const [px2, py2] = spotXY(sel), nm = dist(this.x, this.y, px2, py2) / UNITS_PER_NM;
          text(ctx, S.name, sx + 16, cy + 36, { display: true, size: 22, color: '#fff', maxW: sw - 30 });
          text(ctx, S.kind.toUpperCase() + ' · ' + S.depth + ' · ' + nm.toFixed(1) + ' nm', sx + 16, cy + 60, { size: 13, color: PAL.coral, weight: 800, maxW: sw - 30 });
          const used = para(ctx, S.blurb, sx + 16, cy + 84, sw - 32, { size: 14, color: '#dcebf0', weight: 500, lh: 18 });
          const iy = cy + 96 + used, per = Math.max(1, Math.floor((sw - 24) / 44));
          S.species.slice(0, per * 2).forEach((k, i) => { ctx.save(); ctx.translate(sx + 34 + (i % per) * 44, iy + 10 + Math.floor(i / per) * 30); if (k === 'lobster') drawLobsterSide(ctx, 22, {}); else drawFish(ctx, k, 38, { wig: 0, sil: Records.all()[k] ? null : 'rgba(255,255,255,0.35)' }); ctx.restore(); });
          if (this.homeRun) text(ctx, 'The day’s done. Head home.', sx + 16, cy + ch - 30, { size: 14, color: '#9fb8c2', weight: 700 });
          else if (spotAllowed(sel)) {
            UI.button(ctx, 'setcourse', sx + 14, cy + ch - 126, sw - 28, 54, 'Set course', () => { this.dest = sel; this.planRoute(); this.setAuto(true); this.panel = null; }, { style: 'primary', size: 20, sub: 'Autopilot drives · you can take over' });
            UI.button(ctx, 'skipride', sx + 14, cy + ch - 62, sw - 28, 48, 'Skip the ride', () => this.skipTo(sel), { style: 'secondary', size: 16, sub: 'No captain’s points' });
          } else text(ctx, this.c.done.includes(sel) ? 'Already fished today' : 'Today’s spots are set', sx + 16, cy + ch - 30, { size: 14, color: '#9fb8c2', weight: 700 });
        }
      }
    }
  }
  drawSummary(ctx, W, H, t) {
    const P = this.panel; P.t += 1 / 60;
    ctx.fillStyle = `rgba(3,22,32,${Math.min(0.78, P.t * 2)})`; ctx.fillRect(0, 0, W, H);
    UI.region('sum-bg', 0, 0, W, H, () => {});
    const home = P.id === 'home', name = home ? 'the dock' : SPOTS[P.id].name;
    const lines = P.skipped ? [] : this.lines;
    const pw = Math.min(540, W - 60), px = W / 2 - pw / 2, ph = 150 + Math.max(1, lines.length) * 30, py = Math.max(16, H / 2 - ph / 2 - 34);
    panel(ctx, px, py, pw, ph, { r: 22 });
    text(ctx, (home ? 'Back at ' : 'Anchored at ') + name, px + 24, py + 46, { display: true, size: 28, color: '#fff', maxW: pw - 48 });
    text(ctx, 'Captain ' + CHARS[this.driver].name + (P.skipped ? ' · skipped the ride' : ' · ' + (this.legDist / UNITS_PER_NM).toFixed(1) + ' nm'), px + 24, py + 74, { size: 15, color: '#9fb8c2', weight: 700 });
    let y = py + 108;
    if (!lines.length) text(ctx, P.skipped ? 'No ride, no captain’s points.' : 'Uneventful ride. Nothing to report.', px + 24, y, { size: 17, color: '#cfe3ea', weight: 600 });
    for (const l of lines) { text(ctx, l.label, px + 24, y, { size: 17, color: l.pts < 0 ? '#ff9a8a' : '#fff', weight: 600, maxW: pw - 120 }); text(ctx, (l.pts > 0 ? '+' : '') + l.pts, px + pw - 24, y, { size: 18, align: 'right', color: l.pts < 0 ? PAL.bad : PAL.sun, weight: 800 }); y += 30; }
    const tot = P.skipped ? 0 : this.total || 0;
    text(ctx, 'Captain’s points: ' + (tot > 0 ? '+' : '') + tot, px + 24, py + ph - 18, { size: 18, color: PAL.sun, weight: 800 });
    UI.button(ctx, 'letsfish', W / 2 - 130, py + ph + 16, 260, 56, home ? 'Call it a day' : 'Let’s fish', () => this.finishLeg(P.skipped), { style: 'primary', size: 22, key: 'Enter|Space' });
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
    text(ctx, c.mode === 'crew' ? 'Your trip is saved. Resume it from the title screen.' : 'Solo days aren’t saved. Your logbook is.', W / 2, 440, { size: 15, align: 'center', color: '#9fb8c2', weight: 600 });
  }
}
function segCross(ax, ay, bx, by, cx, cy, dx, dy) {
  const d = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx); if (!d) return false;
  const u = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / d, v = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / d;
  return u >= 0 && u <= 1 && v >= 0 && v <= 1;
}
