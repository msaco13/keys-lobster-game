'use strict';
/* Keys Crew — The Weedline. Trolling offshore, seen from above.
   Steer so your spread crosses the fish: weedlines hold mahi, birds mark tuna,
   the blue-water edge brings wahoo and sailfish. Stay off the trap floats. */

const LURES = [
  { Ld: 170, off: -36, color: '#ff4fa0', name: 'Pink skirt' },
  { Ld: 240, off: 36, color: '#36c8ff', name: 'Blue ballyhoo' },
  { Ld: 310, off: 0, color: '#ffe14a', name: 'Shotgun' }
];

class TrollScene extends SessionBase {
  constructor(o) {
    super(o);
    this.by = Game.H * 0.55; this.ty = this.by; this.bvy = 0; this.speed = 150; this.stall = 0; this.trav = 0;
    this.hist = [{ d: 0, y: this.by }];
    this.lures = LURES.map((l) => Object.assign({}, l, { x: 0, y: 0, fouled: 0 }));
    this.features = []; this.fish = []; this.strike = null; this.dragId = null;
    this.timers = { weed: 1.5, birds: 7, log: 12, buoy: 1, open: 4 };
    this.edgeAt = [this.len * 0.62, this.len * 0.25];
    this.waves = []; for (let i = 0; i < 70; i++) this.waves.push({ x: rand(0, 1400), y: rand(0, 540), l: rand(8, 22) });
  }
  enter() { SFX.setAmbient(1, false); Game.toast('The Weedline', { color: PAL.coral, size: 46, y: 200, sub: 'Drag to steer. Pull your lures past the fish.' }); }
  exit() { SFX.setAmbient(0); }
  boatX() { return Game.W * 0.42; }
  pointerDown(p) { if (this.basePointerDown(p)) return; this.dragId = p.id; this.ty = clamp(p.y, 120, Game.H - 50); }
  pointerMove(p) { if (this.dragId === p.id) this.ty = clamp(p.y, 120, Game.H - 50); }
  pointerUp(p) { if (this.dragId === p.id) this.dragId = null; }
  keyDown(c) { this.baseKeyDown(c); }
  yAtDist(d) {
    const h = this.hist; if (d <= h[0].d) return h[0].y;
    for (let i = h.length - 1; i > 0; i--) if (h[i - 1].d <= d) { const a = h[i - 1], b = h[i]; return lerp(a.y, b.y, (d - a.d) / Math.max(0.001, b.d - a.d)); }
    return h[h.length - 1].y;
  }
  spawnFeature(type) {
    const W = Game.W, H = Game.H, x = W + 140;
    if (type === 'weed') {
      const y = rand(150, H - 90), len = rand(420, 820), ang = rand(-0.25, 0.25), blobs = [];
      for (let s = 0; s < len; s += rand(14, 30)) blobs.push({ dx: s, dy: Math.sin(s * 0.02) * 14 + rand(-8, 8), r: rand(6, 15) });
      const f = { type, x, y, len, ang, blobs }; this.features.push(f);
      const n = chance(0.85) ? randi(2, 4) : 0; for (let i = 0; i < n; i++) this.spawnFish('mahi', x + rand(40, len), y + rand(-30, 30), f);
      if (chance(0.12)) this.spawnFish('sailfish', x + rand(0, len), y + rand(-50, 50), f);
    } else if (type === 'birds') {
      const f = { type, x, y: rand(150, H - 80), r: rand(60, 90), birds: [] };
      for (let i = 0; i < 5; i++) f.birds.push({ a: rand(0, TAU), r: rand(20, 80), h: rand(0.6, 1.2), sp: rand(0.6, 1.2) });
      this.features.push(f);
      for (let i = 0; i < randi(3, 4); i++) this.spawnFish(chance(0.6) ? 'blackfin' : 'mahi', f.x + rand(-60, 60), f.y + rand(-50, 50), f);
      if (chance(0.25)) this.spawnFish('kingfish', f.x, f.y + rand(-40, 40), f);
    } else if (type === 'log') {
      const f = { type, x, y: rand(150, H - 80), rot: rand(-0.6, 0.6) }; this.features.push(f);
      for (let i = 0; i < randi(2, 3); i++) this.spawnFish('mahi', f.x + rand(-40, 40), f.y + rand(-40, 40), f, true);
      if (chance(0.18)) this.spawnFish('wahoo', f.x + rand(-60, 60), f.y + rand(-50, 50), f);
    } else if (type === 'buoy') {
      this.features.push({ type, x, y: rand(130, H - 50), color: pick(['#ff6a3d', '#ffffff', '#ffd23a', '#7be36a', '#ff4fa0']), stripe: pick(['#1b3f8a', '#e03a3a', '#111111']) });
    } else if (type === 'edge') {
      const f = { type, x, len: 900 }; this.features.push(f);
      this.spawnFish('wahoo', x + rand(100, 500), rand(150, H - 80), f);
      if (chance(0.6)) this.spawnFish('sailfish', x + rand(150, 700), rand(150, H - 80), f);
      if (chance(0.5)) this.spawnFish('kingfish', x + rand(100, 700), rand(150, H - 80), f);
      if (chance(0.5)) this.spawnFish('blackfin', x + rand(100, 700), rand(150, H - 80), f);
      if (chance(0.07)) this.spawnFish('bluemarlin', x + rand(300, 800), rand(180, H - 100), f);
      Game.toast('Blue water edge ahead', { color: '#9fd8ff', size: 28, y: 110, sub: 'Wahoo and sailfish country' });
    }
  }
  spawnFish(key, x, y, feat, small) {
    let w = rollWeight(key, this.perks); if (small && key === 'mahi') w = Math.round(Math.min(w, rand(6, 18)) * 10) / 10;
    const n = sizeNorm(key, w);
    this.fish.push({ key, w, x, y, hx: x, hy: y, vx: 0, vy: 0, len: (40 + 70 * n) * (key === 'bluemarlin' ? 1.6 : key === 'wahoo' || key === 'sailfish' ? 1.2 : 1), t: rand(0, 5), state: 'cruise', chase: 0, feat, cool: 0 });
  }
  onFightDone(r) {
    if (r.ok && r.catch && r.catch.key === 'mahi' && chance(0.7)) {
      const L = this.lures[randi(0, 2)];
      for (let i = 0; i < randi(2, 3); i++) this.spawnFish('mahi', L.x + rand(20, 120), L.y + rand(-50, 50), null, true);
      Game.toast('The school followed it up!', { color: '#bff46a', size: 28, y: 120, sub: 'Get a bait back in front of them' });
    }
  }

  update(dt) {
    if (this.baseUpdate(dt)) return;
    const W = Game.W, H = Game.H, t = this.t;
    if (Input.held('ArrowUp', 'KeyW')) this.ty = clamp(this.ty - 230 * dt, 120, H - 50);
    if (Input.held('ArrowDown', 'KeyS')) this.ty = clamp(this.ty + 230 * dt, 120, H - 50);
    if (this.stall > 0) { this.stall -= dt; this.speed = approach(this.speed, 0, 6, dt); } else this.speed = approach(this.speed, 150, 2, dt);
    const v = this.speed;
    const dy = clamp(this.ty - this.by, -220 * dt, 220 * dt); this.bvy = dy / Math.max(dt, 1e-4); this.by += dy;
    this.trav += v * dt; this.hist.push({ d: this.trav, y: this.by }); if (this.hist.length > 400) this.hist.shift();
    for (const w of this.waves) { w.x -= (v * 1.0 + 12) * dt; if (w.x < -30) { w.x = W + rand(0, 60); w.y = rand(0, H); } }
    // lures trail the boat's path
    const bx = this.boatX();
    for (const L of this.lures) {
      L.x = bx - L.Ld; L.y = this.yAtDist(this.trav - L.Ld) + L.off; L.fouled = Math.max(0, L.fouled - dt);
      if (!L.fouled && chance(dt * 6)) this.parts.add({ x: L.x - 6, y: L.y + rand(-2, 2), vx: -v * 0.2, life: 0.6, size: rand(1.5, 2.5), color: 'rgba(255,255,255,0.7)' });
    }
    // spawn features
    for (const k of Object.keys(this.timers)) this.timers[k] -= dt * (v / 150);
    if (this.timers.weed <= 0) { this.spawnFeature('weed'); this.timers.weed = rand(6, 9); }
    if (this.timers.birds <= 0) { this.spawnFeature('birds'); this.timers.birds = rand(10, 15); }
    if (this.timers.log <= 0) { this.spawnFeature('log'); this.timers.log = rand(14, 20); }
    if (this.timers.buoy <= 0) { this.spawnFeature('buoy'); this.timers.buoy = rand(1.1, 2.2); }
    if (this.timers.open <= 0) { this.spawnFish(chance(0.5) ? 'kingfish' : 'barracuda', W + 60, rand(150, H - 80), null); this.timers.open = rand(8, 14); }
    if (this.edgeAt.length && this.timeLeft < this.edgeAt[0]) { this.edgeAt.shift(); this.spawnFeature('edge'); }
    for (const f of this.features) {
      f.x -= v * dt;
      if (f.type === 'birds') for (const b of f.birds) b.a += dt * b.sp;
      if (f.type === 'buoy') {
        if (dist(f.x, f.y, bx + 20, this.by) < 26 && !f.hit) { f.hit = true; this.stall = 2.5; Game.toast('Wrapped a trap line!', { color: PAL.warn, size: 32, y: 130, sub: 'Cutting it out of the prop… (stalled)' }); SFX.play('fail'); Game.shake(5); }
        for (const L of this.lures) if (!L.fouled && dist(f.x, f.y, L.x, L.y) < 15) { L.fouled = 3.5; Game.toast('Lure fouled on a trap line', { color: PAL.warn, size: 26, y: 130 }); SFX.play('warn'); }
      }
      if (f.type === 'weed') for (const L of this.lures) {
        if (L.fouled || L.weedCd > t) continue;
        const ca = Math.cos(f.ang), sa = Math.sin(f.ang); const rx = (L.x - f.x) * ca + (L.y - f.y) * sa, ry = -(L.x - f.x) * sa + (L.y - f.y) * ca;
        if (rx > 0 && rx < f.len && Math.abs(ry) < 14) { L.weedCd = t + 3; if (chance(0.25)) { L.fouled = 2; this.fl.add(L.x, L.y - 20, 'weed on it', '#e8d27a', 16); } }
      }
    }
    this.features = this.features.filter((f) => f.x + (f.len || 120) > -200);
    // fish
    for (const fi of this.fish) {
      fi.t += dt; fi.cool = Math.max(0, fi.cool - dt);
      let near = null, nd = 95;
      for (const L of this.lures) { if (L.fouled) continue; const dd = dist(fi.x, fi.y, L.x, L.y); if (dd < nd) { nd = dd; near = L; } }
      if (near && fi.state === 'cruise' && !fi.cool && chance(dt * 4)) { fi.state = 'chase'; fi.chase = rand(1.6, 2.8); fi.lure = near; }
      if (fi.state === 'chase') {
        const L = fi.lure; fi.chase -= dt;
        const ang = Math.atan2(L.y - fi.y, L.x - fi.x); fi.vx = Math.cos(ang) * 230; fi.vy = Math.sin(ang) * 230;
        fi.x += fi.vx * dt; fi.y += fi.vy * dt;
        if (!L.fouled && dist(fi.x, fi.y, L.x, L.y) < 20 && chance(dt * 3.2 * this.perks.bite) && !this.strike) { this.doStrike(fi, L); continue; }
        if (fi.chase <= 0 || L.fouled) { fi.state = 'cruise'; fi.cool = 2; }
      } else {
        fi.x -= v * dt; fi.hx -= v * dt;
        fi.vx = Math.cos(fi.t * 0.7) * 22; fi.vy = Math.sin(fi.t * 0.9) * 18; fi.x += fi.vx * dt; fi.y += fi.vy * dt;
      }
      fi.y = clamp(fi.y, 110, H - 30);
    }
    this.fish = this.fish.filter((f) => f.x > -160 && f.state !== 'gone');
    if (this.strike) {
      this.strike.t -= dt;
      if (this.strike.t <= 0) { const s = this.strike; this.strike = null; this.startFight({ sp: s.fish.key, weight: s.fish.w, ctxType: 'offshore' }); }
    }
    SFX.setDrag(this.strike ? 1 : 0, 1);
  }
  doStrike(fi, L) {
    fi.state = 'gone'; this.strike = { fish: fi, lure: L, t: 0.75 };
    SFX.play('bigsplash'); Game.vibrate(90); Game.toast('STRIKE!', { color: PAL.sun, size: 52, y: 150, dur: 0.8, sub: 'The ' + L.name.toLowerCase() + ' got hit' });
    this.parts.burst(L.x, L.y, 26, { color: ['#ffffff', '#c9f0ff'], min: 60, max: 220, life: 0.7, drag: 2 });
    L.fouled = 0.9;
  }

  draw(ctx) {
    if (this.drawChildOrNull(ctx)) return;
    const W = Game.W, H = Game.H, t = this.t, bx = this.boatX();
    const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#0f5d9c'); g.addColorStop(1, '#0a3f78');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (const f of this.features) if (f.type === 'edge') {
      ctx.fillStyle = 'rgba(25,20,120,0.35)'; ctx.beginPath(); ctx.moveTo(f.x, 0);
      for (let y = 0; y <= H; y += 20) ctx.lineTo(f.x + Math.sin(y * 0.03 + t) * 16, y);
      ctx.lineTo(f.x + f.len, H); ctx.lineTo(f.x + f.len, 0); ctx.fill();
      ctx.strokeStyle = 'rgba(200,230,255,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); for (let y = 0; y <= H; y += 20) { const x = f.x + Math.sin(y * 0.03 + t) * 16; y === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    for (const w of this.waves) { ctx.beginPath(); ctx.moveTo(w.x, w.y); ctx.quadraticCurveTo(w.x + w.l / 2, w.y - 3, w.x + w.l, w.y); ctx.stroke(); }
    // fish shadows (under everything on the surface)
    for (const fi of this.fish) {
      ctx.save(); ctx.translate(fi.x, fi.y); ctx.rotate(Math.atan2(fi.vy, fi.state === 'chase' ? fi.vx : -150 + fi.vx));
      ctx.globalAlpha = fi.state === 'chase' ? 0.85 : 0.55;
      const tl = fi.key === 'mahi' ? { back: '#1f7a5a', tail: '#1f7a5a', wide: 0.24, edge: '#7fd14d' } : fi.key === 'sailfish' || fi.key === 'bluemarlin' ? { back: '#14305c', tail: '#14305c', wide: 0.18, edge: '#5f7fae' } : 'shadow';
      drawFishTop(ctx, fi.len, tl, fi.t, { speed: fi.state === 'chase' ? 18 : 8 });
      ctx.restore();
    }
    // wake
    for (let d = 0; d < 220; d += 10) {
      const x = bx - 70 - d, y = this.yAtDist(this.trav - d), sp = 10 + d * 0.28, a = 0.4 * (1 - d / 220);
      ctx.fillStyle = `rgba(255,255,255,${a})`; ell(ctx, x, y - sp, 6, 2.5); ctx.fill(); ell(ctx, x, y + sp, 6, 2.5); ctx.fill();
      ctx.fillStyle = `rgba(255,255,255,${a * 0.5})`; ell(ctx, x, y, 9, 5 + d * 0.03); ctx.fill();
    }
    for (const f of this.features) this.drawFeature(ctx, f, t);
    // lines + lures
    const ang = Math.atan2(this.bvy, Math.max(30, this.speed)) * 0.6;
    for (const L of this.lures) {
      const rigY = this.by + (L.off < 0 ? -72 : L.off > 0 ? 72 : 0), rigX = bx - 48;
      ctx.strokeStyle = L.fouled ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(rigX, rigY); ctx.quadraticCurveTo((rigX + L.x) / 2, (rigY + L.y) / 2 + 6, L.x, L.y); ctx.stroke();
      ctx.save(); ctx.translate(L.x, L.y); ctx.globalAlpha = L.fouled ? 0.35 : 1;
      ctx.fillStyle = L.color; ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-10, -4 + Math.sin(t * 20) * 1.5); ctx.lineTo(-10, 4 - Math.sin(t * 20) * 1.5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff'; ell(ctx, 5, 0, 2.5, 2.5); ctx.fill();
      ctx.restore();
    }
    drawBoatTop(ctx, bx, this.by, 0.9, ang, { crew: Trip.cur && Trip.cur.crew ? [this.ch].concat(Trip.cur.crew.filter((c) => c !== this.ch)) : [this.ch], rig: true });
    this.parts.draw(ctx); this.fl.draw(ctx);
    this.drawHud(ctx, W, H);
    if (this.paused) this.drawPause(ctx);
  }
  drawFeature(ctx, f, t) {
    if (f.type === 'weed') {
      ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.ang);
      for (const b of f.blobs) { ctx.fillStyle = 'rgba(214,170,58,0.85)'; ell(ctx, b.dx, b.dy, b.r, b.r * 0.7); ctx.fill(); ctx.fillStyle = 'rgba(150,110,30,0.6)'; ell(ctx, b.dx + 2, b.dy + 1, b.r * 0.5, b.r * 0.35); ctx.fill(); }
      ctx.restore();
    } else if (f.type === 'birds') {
      for (let i = 0; i < 6; i++) { const a = t * 3 + i; if (Math.sin(a * 1.7) > 0.7) { ctx.fillStyle = 'rgba(255,255,255,0.8)'; ell(ctx, f.x + Math.cos(i * 2.1) * 40, f.y + Math.sin(i * 1.3) * 30, 3, 3); ctx.fill(); } }
      for (const b of f.birds) {
        const x = f.x + Math.cos(b.a) * b.r, y = f.y + Math.sin(b.a) * b.r * 0.6;
        ctx.fillStyle = 'rgba(0,20,40,0.25)'; ell(ctx, x + 18, y + 30, 10 * b.h, 3); ctx.fill();
        drawFrigate(ctx, x, y, b.h, t * 6 + b.a);
      }
    } else if (f.type === 'log') {
      ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot);
      ctx.fillStyle = '#6b5236'; rr(ctx, -46, -9, 92, 18, 8); ctx.fill(); ctx.fillStyle = '#8a6b46'; rr(ctx, -42, -6, 84, 6, 3); ctx.fill();
      ctx.fillStyle = 'rgba(214,170,58,0.8)'; ell(ctx, -40, 8, 10, 6); ctx.fill(); ell(ctx, 30, -10, 9, 5); ctx.fill();
      ctx.restore();
    } else if (f.type === 'buoy') {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x + 22, f.y + 6); ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ell(ctx, f.x + 3, f.y + 4, 10, 10); ctx.fill();
      ctx.fillStyle = f.color; ell(ctx, f.x, f.y, 10, 10); ctx.fill();
      ctx.fillStyle = f.stripe; ctx.fillRect(f.x - 10, f.y - 2.5, 20, 5);
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1; ell(ctx, f.x, f.y, 10, 10); ctx.stroke();
    }
  }
  drawHud(ctx, W, H) {
    this.drawTopBar(ctx);
    const px = W - 196, py = 12;
    panel(ctx, px, py, 182, 46, { r: 23 });
    text(ctx, 'SPREAD', px + 14, py + 29, { size: 14, weight: 800, color: '#cfe3ea' });
    this.lures.forEach((L, i) => { ctx.globalAlpha = L.fouled ? 0.3 : 1; ctx.fillStyle = L.color; ell(ctx, px + 96 + i * 28, py + 23, 9, 9); ctx.fill(); ctx.globalAlpha = 1; });
    if (this.stall > 0) text(ctx, 'Prop wrapped… ' + this.stall.toFixed(1) + 's', W / 2, 92, { size: 18, align: 'center', color: PAL.warn, weight: 800, stroke: 'rgba(0,0,0,0.5)', sw: 4 });
    if (this.t < 9) text(ctx, Game.touch ? 'Drag up and down to steer the boat' : 'Drag or ↑ ↓ to steer the boat', W / 2, H - 22, { size: 17, align: 'center', color: '#fff', weight: 700, alpha: 0.85, stroke: 'rgba(0,0,0,0.5)', sw: 4 });
  }
}
