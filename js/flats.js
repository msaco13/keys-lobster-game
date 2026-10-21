'use strict';
/* Keys Crew — Florida Bay. Poling the backcountry flats, seen from above.
   Spot the fish, press and hold where you want the fly to land (the circle tightens),
   release to cast. Lead the fish. Strip in its rhythm, and set it when it eats. */

const FLATS_TABLE = [['bonefish', 4], ['redfish', 3], ['snook', 2.2], ['trout', 2.6], ['permit', 1.4], ['tarpon', 1.6]];
const CLOCK = ['12', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'];

class FlatsScene extends SessionBase {
  constructor(o) {
    super(o);
    this.fishList = []; this.spawnT = 0.5; this.aim = null; this.lure = null; this.cast = null; this.callout = null; this.slamDone = {};
    this.landed = new Set(); this.pole = 0; this.eat = null;
    const crew = Trip.cur && Trip.cur.crew ? Trip.cur.crew : CHAR_ORDER;
    this.poler = crew.find((c) => c !== this.ch) || null;
    this.buildTerrain();
  }
  enter() { SFX.setAmbient(0.6, false); Music.play('boat'); Game.toast('Florida Bay', { color: PAL.coral, size: 46, y: 200, sub: 'Press and hold to aim. Release to cast.' }); }
  exit() { SFX.setAmbient(0); }
  resize() { this.buildTerrain(); }
  skiff() { return { x: Game.W / 2, y: Game.H - 70 }; }
  rodTip() { const s = this.skiff(); return { x: s.x, y: s.y - 60 }; }
  buildTerrain() {
    const W = Game.W, H = Game.H, c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'); const rng = mulberry(42);
    const base = g.createLinearGradient(0, 0, 0, H); base.addColorStop(0, '#79cdbf'); base.addColorStop(1, '#a9dcc8'); g.fillStyle = base; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 26; i++) { g.fillStyle = rng() < 0.6 ? 'rgba(66,120,82,0.22)' : 'rgba(236,224,180,0.28)'; ell(g, rng() * W, 60 + rng() * (H - 60), 40 + rng() * 80, 22 + rng() * 40, rng() * 3); g.fill(); }
    for (let i = 0; i < 200; i++) { g.fillStyle = 'rgba(60,110,70,0.25)'; ell(g, rng() * W, 60 + rng() * H, 2 + rng() * 5, 1 + rng() * 3); g.fill(); }
    g.fillStyle = 'rgba(30,110,140,0.55)'; g.beginPath(); g.moveTo(0, 150); g.bezierCurveTo(W * 0.3, 110, W * 0.5, 210, W, 130); g.lineTo(W, 210); g.bezierCurveTo(W * 0.55, 280, W * 0.3, 190, 0, 240); g.closePath(); g.fill();
    for (let x = -30; x < W + 40; x += 26) { g.fillStyle = '#244f31'; ell(g, x, 30 + Math.sin(x * 0.05) * 10, 34, 34); g.fill(); g.fillStyle = '#346b40'; ell(g, x + 8, 26 + Math.sin(x * 0.05) * 10, 22, 20); g.fill(); }
    g.strokeStyle = 'rgba(70,45,25,0.6)'; g.lineWidth = 2; for (let x = 0; x < W; x += 9) { g.beginPath(); g.moveTo(x, 58 + Math.sin(x * 0.05) * 10); g.lineTo(x + 4, 70 + Math.sin(x * 0.05) * 10); g.stroke(); }
    this.terrain = c; this.mangroveY = 72;
  }
  spawnFish() {
    let total = 0; for (const r of FLATS_TABLE) total += r[1];
    let roll = Math.random() * total, key = 'bonefish'; for (const [k, w] of FLATS_TABLE) if ((roll -= w) <= 0) { key = k; break; }
    const W = Game.W, H = Game.H, sp = SPECIES[key];
    let x, y, hd;
    if (key === 'snook') { x = chance(0.5) ? -30 : W + 30; y = rand(90, 130); hd = x < 0 ? 0 : Math.PI; }
    else if (key === 'tarpon') { x = chance(0.5) ? -40 : W + 40; y = rand(150, 215); hd = x < 0 ? rand(-0.1, 0.25) : Math.PI + rand(-0.25, 0.1); }
    else { const side = randi(0, 2); if (side === 0) { x = -30; y = rand(140, H - 170); hd = rand(-0.4, 0.4); } else if (side === 1) { x = W + 30; y = rand(140, H - 170); hd = Math.PI + rand(-0.4, 0.4); } else { x = rand(80, W - 80); y = 70; hd = Math.PI / 2 + rand(-0.6, 0.6); } }
    const w = rollWeight(key, this.perks);
    const f = { key, sp, w, x, y, hd, speed: sp.speed * rand(0.8, 1.2), len: (30 + 50 * sizeNorm(key, w)) * (key === 'tarpon' ? 1.9 : key === 'permit' ? 1.1 : 1), t: rand(0, 5), state: 'cruise', interest: 0, lastStrip: 0, turnT: rand(1, 3), tailT: rand(2, 6), tailing: 0, roll: 0, alpha: 0, called: false };
    this.fishList.push(f);
  }
  vis(f) { return clamp(f.sp.vis * this.weather.vis + (f.tailing > 0 ? 0.3 : 0) + (f.state === 'follow' ? 0.15 : 0), 0.15, 1) * f.alpha; }

  /* ---------- input ---------- */
  pointerDown(p) {
    if (this.basePointerDown(p)) return;
    if (this.eat) { this.setHook(); return; }
    if (this.cast) return;
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
    this.aim = { id: p.id, x: p.x, y: p.y, t: 0 };
  }
  pointerMove(p) {
    if (this.pending && this.pending.id === p.id && dist(p.x, p.y, this.pending.x, this.pending.y) > 18) { const q = this.pending; this.pending = null; this.startAim({ id: q.id, x: p.x, y: p.y }); }
    if (this.aim && this.aim.id === p.id) { this.aim.x = p.x; this.aim.y = p.y; }
  }
  pointerUp(p, cancel) {
    if (this.pending && this.pending.id === p.id) { this.pending = null; this.strip(); return; }
    if (this.aim && this.aim.id === p.id) { const a = this.aim; this.aim = null; if (!cancel) this.doCast(a); }
  }
  keyDown(c) {
    if (this.baseKeyDown(c)) return;
    if (c === 'Space' || c === 'Enter') { if (this.eat) this.setHook(); else if (this.lure) this.strip(); }
  }
  aimRadius(a) { const s = this.skiff(); const d = dist(s.x, s.y, a.x, a.y); return lerp(34, 9, clamp(a.t / 1.0, 0, 1)) * this.weather.aim * (0.6 + d / 600); }
  doCast(a) {
    const s = this.rodTip(); let tx = a.x, ty = a.y;
    const d = dist(s.x, s.y, tx, ty), maxR = 470; if (d > maxR) { tx = s.x + (tx - s.x) * maxR / d; ty = s.y + (ty - s.y) * maxR / d; }
    const r = this.aimRadius(a) * 0.6; tx += gauss() * r; ty += gauss() * r;
    tx = clamp(tx, 10, Game.W - 10); ty = clamp(ty, 80, Game.H - 140);
    this.cast = { sx: s.x, sy: s.y, tx, ty, t: 0, dur: 0.45 + d / 1600 }; SFX.play('cast');
  }
  pickUp() {
    if (!this.lure) return;
    for (const f of this.fishList) if (f.state === 'follow' && dist(f.x, f.y, this.lure.x, this.lure.y) < 50 && chance(0.5)) this.spookFish(f, 'Ripped it out too close');
    for (const f of this.fishList) if (f.state === 'follow') f.state = 'cruise';
    this.lure = null; this.eat = null;
  }
  land(x, y) {
    this.lure = { x, y, t: 0, hop: 0 }; SFX.play('plop');
    this.parts.add({ kind: 'ring', x, y, size: 3, grow: 40, life: 0.8, color: 'rgba(255,255,255,0.7)', flat: 0.6 });
    for (const f of this.fishList) {
      if (f.state === 'spooked' || f.state === 'gone') continue;
      const hx = f.x + Math.cos(f.hd) * f.len * 0.4, hy = f.y + Math.sin(f.hd) * f.len * 0.4;
      const d = dist(x, y, hx, hy), toL = Math.atan2(y - hy, x - hx), front = Math.cos(angleDiff(f.hd, toL));
      const spookR = f.sp.spook * (this.weather.id === 'glass' ? 1.15 : 1);
      if (d < spookR) { this.spookFish(f, 'Too close! Spooked it'); continue; }
      if (d < f.sp.notice && front > 0.2) { f.state = 'follow'; f.interest = 0.35; f.lastStrip = this.t; this.fl.add(f.x, f.y - 26, 'It sees it!', '#fff', 18); }
      else if (d < f.sp.notice * 0.6 && front <= 0.2 && chance(0.3)) this.spookFish(f, 'Landed behind it. Spooked');
    }
  }
  strip() {
    if (!this.lure || this.cast) return;
    const s = this.rodTip(); const L = this.lure;
    const ang = Math.atan2(s.y - L.y, s.x - L.x); L.x += Math.cos(ang) * 16; L.y += Math.sin(ang) * 16; L.hop = 0.15;
    SFX.play('strip'); this.parts.add({ kind: 'ring', x: L.x, y: L.y, size: 2, grow: 26, life: 0.5, color: 'rgba(255,255,255,0.5)', flat: 0.6 });
    for (const f of this.fishList) {
      if (f.state !== 'follow') continue;
      const iv = this.t - f.lastStrip, ideal = f.sp.strip; f.lastStrip = this.t;
      if (iv < ideal * 0.55) { f.interest -= 0.14; this.fl.add(f.x, f.y - 24, 'Too fast', PAL.warn, 17); }
      else if (iv > ideal * 2.2) { f.interest += 0.06; this.fl.add(f.x, f.y - 24, 'Slow…', '#cfe3ea', 16); }
      else { f.interest += 0.24; this.fl.add(f.x, f.y - 24, 'Good strip', PAL.good, 17); }
    }
    if (dist(L.x, L.y, s.x, s.y + 60) < 90) { for (const f of this.fishList) if (f.state === 'follow') this.spookFish(f, 'It saw the boat'); this.lure = null; }
  }
  spookFish(f, msg) {
    f.state = 'spooked'; f.speed = f.sp.speed * 4.5; f.hd += Math.PI + rand(-0.6, 0.6); f.interest = 0;
    for (let i = 0; i < 6; i++) this.parts.add({ kind: 'ring', x: f.x + rand(-10, 10), y: f.y + rand(-10, 10), size: 4, grow: 50, life: 0.7, color: 'rgba(255,255,255,0.45)', flat: 0.6 });
    if (msg) Game.toast(msg, { color: PAL.warn, size: 26, y: 130 });
    if (this.eat && this.eat.f === f) this.eat = null;
    SFX.play('splash');
  }
  setHook() {
    const e = this.eat; if (!e) return; this.eat = null;
    this.fishList = this.fishList.filter((x) => x !== e.f); this.lure = null;
    const nearRoots = e.f.y < this.mangroveY + 90;
    this.lastKey = e.f.key;
    this.startFight({ sp: e.f.key, weight: e.f.w, ctxType: 'flats', rock: e.f.key === 'snook' && nearRoots ? 0.6 : e.f.key === 'snook' ? 0.3 : 0 });
  }
  onFightDone(r) {
    if (!r.ok) return;
    this.landed.add(r.catch.key);
    const has = (...k) => k.every((x) => this.landed.has(x));
    if (!this.slamDone.grand && has('tarpon', 'bonefish', 'permit')) { this.slamDone.grand = true; this.addLine('GRAND SLAM · tarpon, bonefish, permit', 1500); Game.toast('GRAND SLAM!', { color: PAL.sun, size: 56, y: 160, dur: 2.6, sub: 'Tarpon, bonefish and permit in one day' }); SFX.play('slam'); }
    if (!this.slamDone.back && has('snook', 'redfish', 'trout')) { this.slamDone.back = true; this.addLine('Backcountry slam · snook, redfish, trout', 600); Game.toast('BACKCOUNTRY SLAM!', { color: PAL.sun, size: 46, y: 160, dur: 2.4, sub: 'Snook, redfish and trout' }); SFX.play('slam'); }
  }

  /* ---------- update ---------- */
  update(dt) {
    if (this.baseUpdate(dt)) return;
    const W = Game.W, H = Game.H, s = this.skiff();
    this.pole += dt;
    if (this.aim) this.aim.t += dt;
    this.spawnT -= dt;
    const live = this.fishList.filter((f) => f.state !== 'spooked').length;
    if (this.spawnT <= 0 && live < 5) { this.spawnFish(); this.spawnT = rand(2.2, 4.2); }
    if (this.cast) {
      this.cast.t += dt;
      if (this.cast.t >= this.cast.dur) { const c = this.cast; this.cast = null; this.land(c.tx, c.ty); }
    }
    if (this.lure) { this.lure.t += dt; this.lure.hop = Math.max(0, this.lure.hop - dt); }
    if (this.eat) { this.eat.t -= dt; if (this.eat.t <= 0) { const f = this.eat.f; this.eat = null; Game.toast('Missed the eat!', { color: PAL.warn, size: 30, y: 130, sub: 'Set it the moment it eats' }); f.state = chance(0.4) ? 'follow' : 'cruise'; f.interest = 0.4; f.lastStrip = this.t; } }
    for (const f of this.fishList) {
      f.t += dt; f.alpha = Math.min(1, f.alpha + dt * 0.8);
      if (f.state === 'cruise') {
        f.turnT -= dt; if (f.turnT <= 0) { f.hd += rand(-0.6, 0.6); f.turnT = rand(1.5, 3.5); }
        f.tailT -= dt; if (f.tailT <= 0 && (f.key === 'bonefish' || f.key === 'permit' || f.key === 'redfish')) { f.tailing = rand(1.5, 2.6); f.tailT = rand(4, 8); }
        if (f.key === 'tarpon' && chance(dt * 0.25)) { f.roll = 0.6; this.parts.add({ kind: 'ring', x: f.x, y: f.y, size: 8, grow: 60, life: 1, color: 'rgba(255,255,255,0.6)', flat: 0.6 }); }
        const spd = f.tailing > 0 ? f.speed * 0.15 : f.speed;
        f.tailing = Math.max(0, f.tailing - dt); f.roll = Math.max(0, f.roll - dt);
        if (f.tailing > 0 && f.key === 'redfish' && chance(dt * 4)) this.parts.add({ x: f.x + rand(-8, 8), y: f.y + rand(-8, 8), life: 1.6, size: rand(6, 12), color: 'rgba(170,150,110,0.25)', vx: rand(-6, 6), vy: rand(-6, 6) });
        f.x += Math.cos(f.hd) * spd * dt; f.y += Math.sin(f.hd) * spd * dt;
        // nervous water: a faint push of ripples ahead of a cruising fish
        if (spd > 10 && chance(dt * 1.6 * this.weather.vis)) this.parts.add({ kind: 'ring', x: f.x + Math.cos(f.hd) * f.len * 0.5, y: f.y + Math.sin(f.hd) * f.len * 0.5, size: f.len * 0.12, grow: 16, life: 0.9, color: 'rgba(255,255,255,0.35)', flat: 0.55, lw: 1.5 });
        if (f.key !== 'snook' && f.y < this.mangroveY + 60) f.hd = approach(f.hd, Math.PI / 2, 2, dt);
        if (f.y > H - 150) f.hd = angleDiff(0, f.hd) > 0 ? f.hd - dt * 1.5 : f.hd + dt * 1.5;
        if (dist(f.x, f.y, s.x, s.y - 30) < 100) this.spookFish(f, 'Spooked by the boat');
        if (this.lure && !this.cast) {
          const hx = f.x + Math.cos(f.hd) * f.len * 0.4, hy = f.y + Math.sin(f.hd) * f.len * 0.4;
          const d = dist(this.lure.x, this.lure.y, hx, hy), front = Math.cos(angleDiff(f.hd, Math.atan2(this.lure.y - hy, this.lure.x - hx)));
          if (d < f.sp.notice * 0.8 && front > 0.3 && chance(dt * 1.5)) { f.state = 'follow'; f.interest = 0.3; f.lastStrip = this.t; this.fl.add(f.x, f.y - 26, 'It found the fly', '#fff', 17); }
        }
      } else if (f.state === 'follow') {
        if (!this.lure) { f.state = 'cruise'; continue; }
        const L = this.lure, ang = Math.atan2(L.y - f.y, L.x - f.x);
        f.hd = f.hd + angleDiff(f.hd, ang) * Math.min(1, dt * 4);
        const dd = dist(f.x, f.y, L.x, L.y);
        const spd = dd > f.len * 0.55 ? f.speed * 1.25 : 4;
        f.x += Math.cos(f.hd) * spd * dt; f.y += Math.sin(f.hd) * spd * dt;
        if (this.t - f.lastStrip > f.sp.strip * 3) { f.interest -= dt * 0.12; }
        if (f.interest <= 0) { f.state = 'cruise'; f.hd += rand(-1.2, 1.2); this.fl.add(f.x, f.y - 26, 'Refused', PAL.warn, 18); }
        else if (f.interest >= 1 && dd < f.len * 0.65 && !this.eat) {
          this.eat = { f, t: 0.55 * this.perks.window }; f.state = 'eat';
          Game.toast('IT ATE IT! SET!', { color: PAL.sun, size: 44, y: 140, dur: 0.7 }); SFX.play('bite'); Game.vibrate(80);
        }
      } else if (f.state === 'eat') {
        f.hd += Math.sin(this.t * 20) * 0.02;
      } else if (f.state === 'spooked') {
        f.x += Math.cos(f.hd) * f.speed * dt; f.y += Math.sin(f.hd) * f.speed * dt; f.alpha -= dt * 0.6;
        if (chance(dt * 10)) this.parts.add({ kind: 'ring', x: f.x, y: f.y, size: 3, grow: 30, life: 0.5, color: 'rgba(255,255,255,0.35)', flat: 0.6 });
      }
      if (!f.called && f.state === 'cruise' && f.alpha > 0.6 && f.x > 20 && f.x < W - 20 && f.y > 90 && f.y < H - 160) { f.called = true; this.callFish(f); }
    }
    this.fishList = this.fishList.filter((f) => f.alpha > 0 && f.x > -80 && f.x < W + 80 && f.y > -60 && f.y < H + 40);
    if (this.callout) { this.callout.t -= dt; if (this.callout.t <= 0) this.callout = null; }
  }
  callFish(f) {
    if (this.callout && this.callout.t > 1.2) return;
    const s = this.skiff(); const a = Math.atan2(f.x - s.x, -(f.y - s.y)); let hour = Math.round(((a + TAU) % TAU) / (TAU / 12)) % 12;
    const ft = Math.round(dist(f.x, f.y, s.x, s.y) / 5 / 5) * 5;
    const mv = Math.cos(f.hd) > 0.4 ? 'moving right' : Math.cos(f.hd) < -0.4 ? 'moving left' : Math.sin(f.hd) > 0 ? 'coming at us' : 'heading away';
    const name = f.key === 'trout' ? 'Trout' : f.sp.short;
    this.callout = { t: 3, msg: `${name}! ${CLOCK[hour]} o’clock, ${ft} feet, ${mv}.` };
  }

  /* ---------- drawing ---------- */
  draw(ctx) {
    if (this.drawChildOrNull(ctx)) return;
    const W = Game.W, H = Game.H, t = this.t, s = this.skiff();
    ctx.drawImage(this.terrain, 0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 26; i++) { const y = 90 + ((i * 37 + t * 6) % (H - 90)), x = (i * 131) % W; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 20, y - 3 + Math.sin(t + i) * 2, x + 40, y); ctx.stroke(); }
    for (const f of this.fishList) this.drawFlatsFish(ctx, f, t);
    this.parts.draw(ctx);
    drawSkiffTop(ctx, s.x, s.y, 0.85, { angler: this.ch, poler: this.poler, pole: (Math.sin(this.pole * 0.8) + 1) / 2, aim: this.aim ? Math.atan2(this.aim.y - s.y, this.aim.x - s.x) + Math.PI / 2 : 0 });
    const tip = this.rodTip();
    if (this.cast) {
      const k = this.cast.t / this.cast.dur, c = this.cast;
      const x = lerp(c.sx, c.tx, k), y = lerp(c.sy, c.ty, k) - Math.sin(k * Math.PI) * 60;
      ctx.strokeStyle = 'rgba(255,250,220,0.85)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(tip.x, tip.y); ctx.quadraticCurveTo((tip.x + x) / 2, Math.min(tip.y, y) - 50, x, y); ctx.stroke();
    } else if (this.lure) {
      const L = this.lure;
      ctx.strokeStyle = 'rgba(255,250,220,0.75)'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(tip.x, tip.y); ctx.quadraticCurveTo((tip.x + L.x) / 2 + 10, (tip.y + L.y) / 2, L.x, L.y); ctx.stroke();
      ctx.fillStyle = '#e8b04a'; ell(ctx, L.x, L.y, 4 + L.hop * 10, 3); ctx.fill(); ctx.fillStyle = '#c0582a'; ell(ctx, L.x - 3, L.y, 2, 2); ctx.fill();
    }
    if (this.aim) {
      const a = this.aim, r = this.aimRadius(a);
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.setLineDash([6, 8]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(tip.x, tip.y); ctx.lineTo(a.x, a.y); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = PAL.sun; ctx.lineWidth = 3; ell(ctx, a.x, a.y, r, r * 0.7); ctx.stroke();
      ctx.fillStyle = PAL.sun; ell(ctx, a.x, a.y, 3, 3); ctx.fill();
      if (dist(tip.x, tip.y, a.x, a.y) > 470) text(ctx, 'Too far · it will fall short', a.x, a.y - r - 10, { size: 15, align: 'center', color: '#fff', weight: 700, stroke: 'rgba(0,0,0,0.5)', sw: 4 });
    }
    if (this.eat) { const f = this.eat.f; ctx.strokeStyle = PAL.sun; ctx.lineWidth = 4; ell(ctx, f.x, f.y, f.len * 0.7 + Math.sin(t * 30) * 4, f.len * 0.5); ctx.stroke(); }
    this.fl.draw(ctx);
    if (this.callout && this.poler) {
      const P = CHARS[this.poler], bw = Math.min(460, W - 120), bx = W / 2 - bw / 2, by = 66;
      ctx.globalAlpha = Math.min(1, this.callout.t * 2);
      panel(ctx, bx, by, bw, 44, { r: 14, fill: 'rgba(255,255,255,0.94)', line: 'rgba(0,0,0,0.1)' });
      text(ctx, P.name + ' on the pole: ' + this.callout.msg, bx + 14, by + 28, { size: 16, color: PAL.ink, weight: 700, maxW: bw - 28 });
      ctx.globalAlpha = 1;
    }
    this.drawHud(ctx, W, H);
    if (this.paused) this.drawPause(ctx);
  }
  drawFlatsFish(ctx, f, t) {
    const a = this.vis(f); if (a <= 0.02) return;
    ctx.save(); ctx.translate(f.x + 7, f.y + 9); ctx.rotate(f.hd); ctx.globalAlpha = a * 0.35;
    drawFishTop(ctx, f.len, { back: '#1f4a40', tail: '#1f4a40', wide: TOPLOOK[f.key].wide }, f.t, { flat: true, speed: f.state === 'spooked' ? 20 : 8 });
    ctx.restore();
    ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.hd); ctx.globalAlpha = a * 0.85;
    drawFishTop(ctx, f.len, TOPLOOK[f.key], f.t, { speed: f.state === 'spooked' ? 20 : f.tailing > 0 ? 3 : 8 });
    ctx.restore();
    if (f.tailing > 0) {
      const tx = f.x - Math.cos(f.hd) * f.len * 0.5, ty = f.y - Math.sin(f.hd) * f.len * 0.5;
      ctx.fillStyle = f.key === 'permit' ? '#15191c' : f.key === 'redfish' ? '#3d6fb8' : 'rgba(235,245,250,0.95)';
      ctx.save(); ctx.translate(tx, ty); ctx.rotate(Math.sin(t * 9 + f.x) * 0.5);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-6, -10); ctx.lineTo(0, -6); ctx.lineTo(6, -10); ctx.closePath(); ctx.fill(); ctx.restore();
      if (chance(0.08)) this.parts.add({ kind: 'ring', x: tx, y: ty, size: 2, grow: 24, life: 0.6, color: 'rgba(255,255,255,0.6)', flat: 0.6 });
    }
    if (f.roll > 0) { ctx.fillStyle = `rgba(230,240,245,${f.roll})`; ell(ctx, f.x, f.y, f.len * 0.35, f.len * 0.12, f.hd); ctx.fill(); }
    if (f.state === 'follow') { ctx.strokeStyle = `rgba(255,200,69,${0.3 + f.interest * 0.5})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(f.x, f.y, f.len * 0.6, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(f.interest, 0, 1)); ctx.stroke(); }
  }
  drawHud(ctx, W, H) {
    this.drawTopBar(ctx);
    const px = W - 236, py = 12;
    panel(ctx, px, py, 222, 46, { r: 23 });
    text(ctx, 'SLAM', px + 14, py + 29, { size: 14, weight: 800, color: '#cfe3ea' });
    ['tarpon', 'bonefish', 'permit'].forEach((k, i) => {
      const got = this.landed.has(k); ctx.globalAlpha = got ? 1 : 0.35;
      ctx.save(); ctx.translate(px + 84 + i * 48, py + 23); drawFish(ctx, k, 38, { wig: 0 }); ctx.restore(); ctx.globalAlpha = 1;
    });
    const hw = W / 2 - 90;
    if (this.t < 12 && !this.lure) para(ctx, Game.touch ? 'Press and hold where you want the fly, then let go to cast' : 'Click and hold where you want the fly, then let go to cast', 20, H - 46, hw, { size: 17, color: '#fff', weight: 700, stroke: 'rgba(0,0,0,0.5)', sw: 4, lh: 20 });
    else if (this.lure && !this.eat) para(ctx, Game.touch ? 'Tap to strip. Drag to recast.' : 'Tap or Space to strip. Drag to recast.', 20, H - 26, hw, { size: 17, color: '#fff', weight: 700, stroke: 'rgba(0,0,0,0.5)', sw: 4 });
  }
}
