'use strict';
/* Keys Crew — The Ledge. Anchored over the reef in 95 feet.
   Pick a bait, set your depth, sit through the nibbles, set the hook on the real bite. */

const BOT = { SURF: 132, FLOOR: 512, MAXFT: 100 };
const BOT_TABLE = [
  // key, spawn weight, depth range (ft), likes squid, likes pinfish, where
  ['yellowtail', 5, [32, 70], 1, 0.1, 'any'],
  ['mangrove', 3, [78, 95], 1, 0.5, 'any'],
  ['mutton', 2, [86, 97], 0.8, 0.7, 'sand'],
  ['redgrouper', 2, [86, 97], 0.4, 1, 'ledge'],
  ['blackgrouper', 1.4, [84, 96], 0.15, 1, 'ledge'],
  ['amberjack', 1.2, [52, 84], 0.05, 1, 'any'],
  ['barracuda', 0.6, [18, 50], 0, 0.8, 'any'],
  ['goliath', 0.22, [92, 97], 0, 1, 'ledge']
];

class BottomScene extends SessionBase {
  constructor(o) {
    super(o);
    this.baitType = 'squid'; this.baitOn = true; this.baitDepth = 0; this.targetDepth = 60; this.rebaitT = 0; this.reeling = false;
    this.fish = []; this.spawnT = 0; this.chumT = 0; this.chumCd = 0; this.chum = new Particles();
    this.drag = null; this.twitch = 0; this.slam = 0;
    this.others = (Trip.cur && Trip.cur.crew ? Trip.cur.crew : CHAR_ORDER).filter((c) => c !== this.ch).slice(0, 2);
    for (let i = 0; i < 6; i++) this.spawn(true);
  }
  enter() { SFX.setAmbient(0.8, false); Game.toast('The Ledge', { color: PAL.coral, size: 46, y: 200, sub: 'Drag to set your depth. Tap on the BITE.' }); }
  exit() { SFX.setAmbient(0); }
  pxPerFt() { return (BOT.FLOOR - BOT.SURF) / BOT.MAXFT; }
  yOf(ft) { return BOT.SURF + ft * this.pxPerFt(); }
  baitX() { return Game.W * 0.5 + Math.sin(this.t * 0.4) * 6 + this.weather.drift * 18; }
  ledgeX0() { return Game.W * 0.47; } ledgeX1() { return Game.W * 0.93; }
  spawn(initial) {
    const chum = this.chumT > 0;
    let total = 0; const table = BOT_TABLE.map((r) => { const w = r[0] === 'yellowtail' && chum ? r[1] * 3 : r[1]; total += w; return [r, w]; });
    let roll = Math.random() * total, row = table[0][0];
    for (const [r, w] of table) { if ((roll -= w) <= 0) { row = r; break; } }
    const [key, , dr, , , where] = row;
    let ft = rand(dr[0], dr[1]); if (key === 'yellowtail' && chum) ft = rand(16, 44);
    const W = Game.W, fromLeft = chance(0.5);
    let x = initial ? rand(60, W - 60) : fromLeft ? -60 : W + 60;
    if (where === 'ledge') x = initial ? rand(this.ledgeX0(), this.ledgeX1()) : rand(this.ledgeX0(), this.ledgeX1());
    const w = rollWeight(key, this.perks);
    const len = clamp(34 + 70 * sizeNorm(key, w), 34, 120) * (key === 'goliath' ? 1.7 : 1);
    this.fish.push({ key, w, x, y: this.yOf(ft), homeY: this.yOf(ft), vx: (fromLeft ? 1 : -1) * rand(18, 40), len, state: 'swim', t: rand(0, 5), nib: 0, timer: 0, where, alpha: initial ? 1 : 0 });
  }
  activeFish() { return this.fish.find((f) => f.state === 'approach' || f.state === 'nibble' || f.state === 'bite'); }

  pointerDown(p) {
    if (this.basePointerDown(p)) return;
    if (this.hookset()) return;
    if (p.y > BOT.SURF - 20) { this.drag = p.id; this.setDepthFromY(p.y); }
  }
  pointerMove(p) { if (this.drag === p.id) this.setDepthFromY(p.y); }
  pointerUp(p) { if (this.drag === p.id) this.drag = null; }
  keyDown(c) { if (this.baseKeyDown(c)) return; if (c === 'Space' || c === 'Enter') this.hookset(true); }
  setDepthFromY(y) { this.targetDepth = clamp((y - BOT.SURF) / this.pxPerFt(), 4, 97); }
  hookset(fromKey) {
    const f = this.activeFish();
    if (!f || !this.baitOn) { if (fromKey) this.twitch = 0.2; return false; }
    if (f.state === 'bite') {
      this.fish = this.fish.filter((x) => x !== f);
      this.baitOn = false; this.slam = 0;
      this.startFight({ sp: f.key, weight: f.w, ctxType: 'reef', depth: Math.max(25, this.baitDepth) });
      return true;
    }
    if (f.state === 'nibble' || f.state === 'approach') {
      if (f.state === 'nibble') {
        Game.toast('Too early!', { color: PAL.warn, size: 34, y: 140, sub: 'Wait for the rod to slam down' }); SFX.play('fail');
        if (chance(0.65)) this.stealBait(f, true); else { f.state = 'leave'; }
      }
      return true;
    }
    return false;
  }
  stealBait(f, quiet) {
    this.baitOn = false; f.state = 'leave';
    if (!quiet) { Game.toast('Bait stolen!', { color: PAL.warn, size: 32, y: 140, sub: 'Tap REBAIT and drop back down' }); SFX.play('fail'); }
  }
  rebait(type) {
    if (this.rebaitT > 0 || this.reeling) { if (type) this.baitType = type; return; }
    if (type) this.baitType = type;
    const f = this.activeFish(); if (f) f.state = 'leave';
    this.baitOn = false; this.reeling = true;
  }
  onFightDone() { this.baitDepth = 0; this.reeling = false; this.rebaitT = 0.9; this.baitOn = false; }

  update(dt) {
    if (this.baseUpdate(dt)) return;
    const t = this.t, dpf = this.pxPerFt();
    this.chum.update(dt); this.twitch = Math.max(0, this.twitch - dt); this.slam = Math.max(0, this.slam - dt);
    if (this.chumT > 0) { this.chumT -= dt; if (chance(dt * 18)) this.chum.add({ x: Game.W * 0.34 + rand(-10, 10), y: BOT.SURF + 4, vx: rand(10, 30) + this.weather.drift * 10, vy: rand(12, 30), life: 6, size: rand(1.5, 3.5), color: 'rgba(200,170,120,0.65)' }); }
    this.chumCd = Math.max(0, this.chumCd - dt);
    if (Input.held('ArrowUp', 'KeyW')) this.targetDepth = clamp(this.targetDepth - 40 * dt, 4, 97);
    if (Input.held('ArrowDown', 'KeyS')) this.targetDepth = clamp(this.targetDepth + 40 * dt, 4, 97);
    // bait movement
    if (this.reeling) { this.baitDepth = Math.max(0, this.baitDepth - 85 * dt); if (this.baitDepth <= 0) { this.reeling = false; this.rebaitT = 0.9; SFX.play('click'); } }
    else if (this.rebaitT > 0) { this.rebaitT -= dt; if (this.rebaitT <= 0) { this.baitOn = true; SFX.play('plop'); } }
    else if (this.baitOn) {
      const dd = this.targetDepth - this.baitDepth;
      this.baitDepth += clamp(dd, -38 * dt, (dd > 0 ? 50 : 38) * dt);
    }
    const bx = this.baitX(), by = this.yOf(this.baitDepth);
    // fish
    this.spawnT -= dt; if (this.spawnT <= 0 && this.fish.length < 9) { this.spawn(false); this.spawnT = rand(1.2, 2.4) / (this.chumT > 0 ? 2 : 1); }
    const busy = this.activeFish();
    for (const f of this.fish) {
      f.t += dt; f.alpha = Math.min(1, f.alpha + dt * 1.5);
      if (f.state === 'swim') {
        f.x += f.vx * dt; f.y = approach(f.y, f.homeY + Math.sin(f.t * 0.8) * 8, 2, dt);
        if (f.where === 'ledge' && (f.x < this.ledgeX0() - 20 || f.x > this.ledgeX1())) f.vx = -f.vx;
        if (this.baitOn && !busy && !this.reeling && this.baitDepth > 3 && Math.abs(f.x - bx) < 120 && Math.abs(f.y - by) < 46) {
          const row = BOT_TABLE.find((r) => r[0] === f.key); const pref = this.baitType === 'squid' ? row[3] : row[4];
          if (chance(pref * dt * 1.6 * this.perks.bite)) { f.state = 'approach'; }
        }
      } else if (f.state === 'approach') {
        const ang = Math.atan2(by - f.y, bx - f.x);
        f.x += Math.cos(ang) * 60 * dt; f.y += Math.sin(ang) * 60 * dt; f.vx = Math.cos(ang) >= 0 ? 1 : -1;
        if (!this.baitOn) f.state = 'leave';
        else if (dist(f.x, f.y, bx, by) < 14) { f.state = 'nibble'; f.nib = SPECIES[f.key].crafty ? randi(2, 4) : randi(0, 2); f.timer = rand(0.45, 1.0) / this.perks.bite; }
      } else if (f.state === 'nibble') {
        f.x = approach(f.x, bx - Math.sign(f.vx || 1) * f.len * 0.42, 6, dt); f.y = approach(f.y, by, 6, dt);
        f.timer -= dt;
        if (f.timer <= 0) {
          if (f.nib > 0) { f.nib--; f.timer = rand(0.5, 1.05) / this.perks.bite; this.twitch = 0.18; SFX.play('nibble'); }
          else { f.state = 'bite'; f.timer = 0.6 * this.perks.window; this.slam = f.timer; SFX.play('bite'); Game.vibrate(70); Game.toast('BITE!', { color: PAL.sun, size: 52, y: 160, dur: 0.8 }); }
        }
      } else if (f.state === 'bite') {
        f.timer -= dt; f.x = approach(f.x, bx - Math.sign(f.vx || 1) * f.len * 0.42, 6, dt);
        if (f.timer <= 0) this.stealBait(f, false);
      } else if (f.state === 'leave') { f.x += (f.vx >= 0 ? 1 : -1) * 120 * dt; f.alpha -= dt * 0.4; }
    }
    this.fish = this.fish.filter((f) => f.x > -140 && f.x < Game.W + 140 && f.alpha > 0);
  }

  draw(ctx) {
    if (this.drawChildOrNull(ctx)) return;
    const W = Game.W, H = Game.H, t = this.t;
    drawSky(ctx, W, BOT.SURF, 'day'); drawSun(ctx, W * 0.84, 46, 18);
    drawCloud(ctx, W * 0.16, 52, 0.7); drawCloud(ctx, W * 0.62, 34, 0.5, 0.8);
    const g = ctx.createLinearGradient(0, BOT.SURF, 0, H); g.addColorStop(0, '#2a9fc4'); g.addColorStop(0.5, '#106f97'); g.addColorStop(1, '#073f5c');
    ctx.fillStyle = g; ctx.fillRect(0, BOT.SURF, W, H - BOT.SURF);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 6; i++) { const x = i * W / 5; ctx.beginPath(); ctx.moveTo(x, BOT.SURF); ctx.lineTo(x + 50, BOT.SURF); ctx.lineTo(x - 70 + Math.sin(t * 0.6 + i) * 14, H); ctx.lineTo(x - 140 + Math.sin(t * 0.6 + i) * 14, H); ctx.fill(); }
    // depth scale
    for (let ft = 20; ft <= 80; ft += 20) { const y = this.yOf(ft); ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(0, y, 18, 2); text(ctx, ft + ' ft', 24, y + 5, { size: 13, color: 'rgba(255,255,255,0.45)', weight: 700 }); }
    // bottom: sand + ledge
    ctx.fillStyle = '#9d8a5b'; ctx.beginPath(); ctx.moveTo(0, H); for (let x = 0; x <= W; x += 20) ctx.lineTo(x, BOT.FLOOR + 6 + Math.sin(x * 0.02) * 5); ctx.lineTo(W, H); ctx.fill();
    const lx0 = this.ledgeX0(), lx1 = this.ledgeX1();
    ctx.fillStyle = '#4c4636'; ctx.beginPath(); ctx.moveTo(lx0 - 20, H);
    for (let x = lx0 - 20; x <= lx1 + 20; x += 16) { const k = Math.min(1, (x - lx0 + 20) / 60, (lx1 + 20 - x) / 60); ctx.lineTo(x, BOT.FLOOR - 50 * k - Math.sin(x * 0.09) * 6 * k); }
    ctx.lineTo(lx1 + 20, H); ctx.fill();
    ctx.fillStyle = '#0b0f0d'; for (let i = 0; i < 5; i++) { ell(ctx, lx0 + 40 + i * (lx1 - lx0 - 80) / 4, BOT.FLOOR - 20 - (i % 2) * 12, 16, 10); ctx.fill(); }
    ctx.fillStyle = 'rgba(140,80,170,0.8)'; for (let i = 0; i < 6; i++) { const x = lx0 + 30 + i * (lx1 - lx0) / 6; ctx.beginPath(); ctx.moveTo(x, BOT.FLOOR - 48); ctx.quadraticCurveTo(x - 14, BOT.FLOOR - 66, x, BOT.FLOOR - 80 - Math.sin(t + i) * 3); ctx.quadraticCurveTo(x + 14, BOT.FLOOR - 66, x, BOT.FLOOR - 48); ctx.fill(); }
    // fish
    for (const f of this.fish) {
      ctx.save(); ctx.translate(f.x, f.y); ctx.globalAlpha = f.alpha * 0.82;
      drawFish(ctx, f.key, f.len, { t: f.t, flip: f.vx < 0, wig: f.state === 'nibble' || f.state === 'bite' ? 1.2 : 0.6 });
      ctx.restore();
    }
    this.chum.draw(ctx);
    ctx.fillStyle = 'rgba(8,60,90,0.18)'; ctx.fillRect(0, BOT.SURF, W, H - BOT.SURF);
    // boat + angler + line
    const bxBoat = W * 0.22;
    const hand = drawAnglerSide(ctx, this.ch, bxBoat + 78, BOT.SURF - 8, 15, { lean: this.slam > 0 ? -0.35 : 0.05, t });
    drawBoatSide(ctx, bxBoat, BOT.SURF + 6, 0.55, { flip: true, crew: this.others, t });
    drawWaterline(ctx, W, BOT.SURF, t, 'rgba(255,255,255,0.7)', 2.5);
    const dip = this.slam > 0 ? 34 : this.twitch > 0 ? 12 : 0;
    const tipX = hand.x + 76, tipY = hand.y - 62 + dip;
    ctx.strokeStyle = '#1d1f22'; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(hand.x - 14, hand.y + 10); ctx.quadraticCurveTo(hand.x + 40, hand.y - 40 + dip * 0.4, tipX, tipY); ctx.stroke();
    const bx = this.baitX(), by = this.yOf(this.baitDepth);
    ctx.strokeStyle = 'rgba(240,240,240,0.8)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(tipX, tipY); ctx.quadraticCurveTo(bx - 20, BOT.SURF + 10, bx, by); ctx.stroke();
    ctx.fillStyle = '#596067'; ell(ctx, bx, by - 14, 3, 5); ctx.fill();
    if (this.baitOn || this.rebaitT > 0 || this.reeling) {
      if (this.baitOn) {
        if (this.baitType === 'squid') { ctx.fillStyle = '#f2d6dc'; ctx.beginPath(); ctx.moveTo(bx, by - 4); ctx.quadraticCurveTo(bx + 8 + Math.sin(t * 6) * 3, by + 6, bx + 2, by + 16); ctx.lineTo(bx - 2, by + 2); ctx.fill(); }
        else { ctx.save(); ctx.translate(bx + 6, by + 4); drawFish(ctx, 'yellowtail', 22, { t, wig: 1, speed: 16 }); ctx.restore(); }
      }
    }
    ctx.strokeStyle = '#c9cfd4'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(bx, by + 2, 4, 0, Math.PI); ctx.stroke();
    // target depth marker
    if (this.baitOn && !this.reeling) {
      const ty = this.yOf(this.targetDepth);
      ctx.strokeStyle = 'rgba(255,200,69,0.45)'; ctx.setLineDash([6, 6]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(bx - 60, ty); ctx.lineTo(bx + 60, ty); ctx.stroke(); ctx.setLineDash([]);
    }
    text(ctx, Math.round(this.baitDepth) + ' ft', bx + 16, by - 10, { size: 15, color: '#fff', weight: 800, stroke: 'rgba(0,0,0,0.5)', sw: 4 });
    const f = this.activeFish();
    if (f && f.state === 'bite') { ctx.strokeStyle = PAL.sun; ctx.lineWidth = 4; ell(ctx, bx, by, 26 + Math.sin(t * 30) * 4, 26 + Math.sin(t * 30) * 4); ctx.stroke(); }
    this.parts.draw(ctx); this.fl.draw(ctx);
    this.drawHud(ctx, W, H);
    if (this.paused) this.drawPause(ctx);
  }
  drawHud(ctx, W, H) {
    this.drawTopBar(ctx);
    const px = W - 200, py = 12;
    panel(ctx, px - 8, py, 194, 160, { r: 16 });
    text(ctx, 'BAIT', px + 6, py + 24, { size: 14, color: '#cfe3ea', weight: 800 });
    UI.button(ctx, 'squid', px + 4, py + 34, 84, 40, 'Squid', () => { if (this.baitType !== 'squid') this.rebait('squid'); }, { style: this.baitType === 'squid' ? 'primary' : 'ghost', size: 17, key: 'Digit1' });
    UI.button(ctx, 'pinfish', px + 94, py + 34, 84, 40, 'Pinfish', () => { if (this.baitType !== 'pinfish') this.rebait('pinfish'); }, { style: this.baitType === 'pinfish' ? 'primary' : 'ghost', size: 17, key: 'Digit2' });
    const chumReady = this.chumCd <= 0;
    UI.button(ctx, 'chum', px + 4, py + 86, 174, 34, chumReady ? 'Drop chum' : 'Chum ' + Math.ceil(this.chumCd) + 's', () => { if (this.chumCd <= 0) { this.chumT = 12; this.chumCd = 18; SFX.play('splash'); Game.toast('Chum’s in the water', { size: 26, y: 140, color: '#fff', sub: 'Yellowtail come up into the slick' }); } }, { style: 'secondary', size: 16, disabled: !chumReady, key: 'KeyC' });
    text(ctx, this.baitType === 'squid' ? 'Snapper love squid' : 'Grouper and AJs eat pinfish', px + 6, py + 146, { size: 13, color: '#9fb8c2', weight: 600, maxW: 176 });
    if (!this.baitOn && !this.reeling && this.rebaitT <= 0) {
      UI.button(ctx, 'rebait', W / 2 - 110, H - 128, 220, 58, 'REBAIT', () => this.rebait(), { style: 'coral', size: 26, key: 'KeyR|Space|Enter' });
    } else if (this.reeling || this.rebaitT > 0) {
      text(ctx, this.reeling ? 'Reeling up…' : 'Baiting the hook…', W / 2, H - 92, { size: 22, align: 'center', color: '#fff', weight: 800, stroke: 'rgba(0,0,0,0.5)', sw: 5 });
    }
    if (this.t < 10 && this.baitOn) text(ctx, Game.touch ? 'Drag up or down to set your depth · tap on the BITE' : 'Drag or ↑ ↓ to set depth · Space on the BITE', W / 2, H - 22, { size: 17, align: 'center', color: '#fff', weight: 700, alpha: 0.85, stroke: 'rgba(0,0,0,0.5)', sw: 4 });
  }
}
