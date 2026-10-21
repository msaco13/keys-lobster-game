'use strict';
/* Keys Crew — the fish fight. Shared by bottom fishing, trolling and the flats.
   Hold to reel. Let go when it runs. Bow when it jumps. Turn grouper off the reef. */

const LOSS_TEXT = {
  snap: ['SNAP!', 'Too much pressure while it was running. Let go on the runs.'],
  slack: ['Spit the hook', 'Too much slack. Keep reeling between runs.'],
  jump: ['Threw the hook!', 'Let go when it jumps. Bow to the fish.'],
  rock: ['Rocked up!', 'It made the reef and cut you off. Tap faster to turn it.'],
  mangrove: ['In the mangroves!', 'It wrapped you in the roots. Tap faster to turn it.'],
  tax: ['Taxed!', 'A shark ate your fish. Only the head came back.'],
  spool: ['Spooled!', 'It took every inch of line.']
};

class FightScene {
  constructor(o) {
    this.o = o; this.key = o.sp; this.sp = SPECIES[o.sp]; this.ch = o.ch; this.C = CHARS[o.ch]; this.perks = this.C.perks;
    this.weight = o.weight; this.wn = sizeNorm(o.sp, o.weight);
    this.pw = clamp(this.sp.pow * (0.62 + 0.48 * this.wn), 0.2, 1.05);
    this.staminaSec = this.sp.stam * (0.7 + 0.8 * this.wn);
    this.kind = o.ctxType || 'offshore';
    this.d0 = this.kind === 'reef' ? (o.depth || 90) : this.kind === 'flats' ? rand(35, 50) + 25 * this.wn : rand(50, 70) + 30 * this.wn;
    this.dist = this.d0; this.maxDist = this.d0 + 130; this.unit = this.kind === 'reef' ? 'ft' : 'yds';
    this.S = 1; this.T = 0.45; this.t = 0; this.fightT = 0;
    const rock = o.rock != null ? o.rock : (this.kind === 'reef' ? (this.sp.rock || 0) : 0);
    this.rockStr = rock; this.phase = rock > 0 ? 'turn' : 'fight'; this.rockBar = 0.45; this.turnGrace = 0.7;
    this.running = false; this.runT = 0; this.runStr = 1; this.restT = rand(0.9, 1.6); this.tele = false;
    this.jumpT = 0; this.jumpDelay = 0; this.jumpHold = 0; this.jumps = 0; this.bows = 0; this.jumpX = 0;
    this.slackT = 0; this.snapT = 0; this.revealed = false;
    this.taxRisk = this.kind !== 'flats' && chance(0.22); this.shark = null;
    this.parts = new Particles(); this.fl = new Floaters();
    this.overT = 0; this.won = false; this.reason = null; this.catch = null; this.landT = 0; this.crankFx = 0;
    this.fx = 0; this.fy = 0; this.fang = 0;
  }
  enter() {
    Game.toasts = [];
    SFX.play('hookset'); Game.vibrate(60);
    Game.toast('FISH ON!', { color: PAL.sun, size: 48, dur: 1.3, y: 120 });
    if (this.phase === 'turn') Game.toast(this.kind === 'flats' ? 'Heading for the roots!' : 'Diving for the reef!', { size: 26, color: '#fff', dur: 1.6, y: 175 });
  }
  exit() { SFX.setDrag(0); }
  holding() { return Input.held('Space', 'ArrowDown', 'KeyS', 'Enter') || !!Input.anyGameplayPointer(); }
  pointerDown() { this.tap(); }
  keyDown(c) { if (['Space', 'ArrowDown', 'KeyS', 'Enter'].includes(c)) this.tap(); }
  tap() {
    if (this.phase === 'turn') { this.rockBar += 0.05 * this.perks.reel; this.crankFx = 0.15; SFX.play('tick'); }
    else if (this.phase === 'over' && this.overT > 0.9) this.finish();
  }
  finish() { if (this.finished) return; this.finished = true; SFX.setDrag(0); this.o.onDone({ ok: this.won, catch: this.catch, reason: this.reason }); }

  update(dt) {
    this.t += dt; this.parts.update(dt); this.fl.update(dt); this.crankFx = Math.max(0, this.crankFx - dt);
    if (this.o.tick) this.o.tick(dt);
    if (this.phase === 'over') { this.overT += dt; if (this.overT > (this.won ? 7 : 3.5)) this.finish(); return; }
    if (this.phase === 'landing') { this.landT += dt; this.fightAnim(dt, false); if (this.landT > 0.9) this.toOver(); return; }
    const hold = this.holding(); this.fightT += dt;
    if (this.phase === 'turn') {
      if (this.turnGrace > 0) this.turnGrace -= dt;
      else this.rockBar -= dt * this.rockStr * (0.2 + 0.32 * this.wn);
      if (hold) this.rockBar += dt * 0.2 * this.perks.reel;
      this.T = approach(this.T, hold ? 0.8 : 0.55, 6, dt);
      SFX.setDrag(0.5, 0.7);
      if (this.rockBar >= 1) { this.phase = 'fight'; this.T = 0.5; this.restT = 1.2; Game.toast(this.kind === 'flats' ? 'Out of the roots!' : 'Off the bottom!', { color: PAL.good, size: 32, y: 130 }); SFX.play('coin'); }
      else if (this.rockBar <= 0) return this.lose(this.kind === 'flats' ? 'mangrove' : 'rock');
      this.fightAnim(dt, hold);
      return;
    }
    const S = this.S, life = 0.45 + 0.55 * S, sp = this.sp;
    if (this.running) {
      this.runT -= dt;
      if (this.jumpDelay > 0) { this.jumpDelay -= dt; if (this.jumpDelay <= 0) this.startJump(); }
      if (this.runT <= 0) { this.running = false; this.restT = rand(1.1, 2.6) * (1.25 - this.pw * 0.45) * (1 + (1 - S) * 0.8); }
    } else {
      this.restT -= dt;
      if (this.restT <= 0.5 && !this.tele) { this.tele = true; SFX.play('tick'); }
      if (this.restT <= 0) {
        this.running = true; this.tele = false;
        this.runT = rand(0.8, 2.0) * (0.55 + this.pw) * (0.5 + 0.5 * S); this.runStr = rand(0.88, 1.1);
        if (sp.jump && this.jumps < 5 && chance(sp.jump * (0.4 + 0.6 * S))) this.jumpDelay = rand(0.15, 0.45);
      }
    }
    let p = this.pw * (this.running ? this.runStr : 0.33) * life;
    if (this.jumpT > 0) p *= 0.4;
    const Lmax = this.perks.line;
    const target = hold ? 0.3 + p * 1.05 : p * 0.5;
    this.T = approach(this.T, target + Math.sin(this.t * 13) * 0.02 * p, hold && this.running ? 6 : 4, dt);
    if (this.running) this.dist += 9.5 * this.pw * p * dt * (hold ? 0.45 : 1);
    if (hold) this.dist -= 7.5 * this.perks.reel * (1 - p * 0.8) * dt;
    const inZone = this.T > 0.38 && this.T < 0.86 * Lmax;
    this.S = clamp(this.S - (dt / this.staminaSec) * (inZone ? 1 : 0.35) * (hold ? 1 : 0.6) + (this.T < 0.15 ? dt * 0.015 : 0), 0, 1);
    if (this.T < 0.12) { this.slackT += dt; if (this.slackT > 2.1) return this.lose('slack'); } else if (this.T > 0.2) this.slackT = Math.max(0, this.slackT - dt * 2);
    if (this.T > Lmax) { this.snapT += dt; if (this.snapT > 0.28) return this.lose('snap'); } else this.snapT = Math.max(0, this.snapT - dt);
    if (this.T > 0.86 * Lmax && Math.floor(this.t * 6) !== Math.floor((this.t - dt) * 6)) Game.vibrate(15);
    if (this.dist > this.maxDist) return this.lose('spool');
    if (this.jumpT > 0) { this.jumpT -= dt; if (hold) this.jumpHold += dt; if (this.jumpT <= 0) { this.endJump(); if (this.phase === 'over') return; } }
    if (!this.revealed && (this.dist < this.d0 * 0.45 || this.jumpT > 0)) { this.revealed = true; Game.toast(`It's a ${sp.short.toLowerCase()}!`, { color: '#fff', size: 30, y: 120 }); }
    if (this.taxRisk && !this.shark && this.fightT > 16) { this.shark = { t: 10, a: 0 }; Game.toast('SHARK!', { color: '#dfe6ea', size: 42, y: 130, sub: 'Get it in before the tax man does' }); SFX.play('warn'); }
    if (this.shark) { this.shark.t -= dt; this.shark.a += dt; if (this.shark.t <= 0) return this.lose('tax'); }
    SFX.setDrag(this.running ? (hold ? 0.9 : 0.7) : hold ? 0.12 : 0, this.running ? 1 : 0.4);
    this.fightAnim(dt, hold);
    if (this.dist <= 0.5) this.land();
  }
  startJump() {
    this.jumpT = 1.15; this.jumpHold = 0; this.jumps++;
    SFX.play('bigsplash'); Game.vibrate(40);
    this.parts.burst(this.fx, this.waterY(), 22, { color: ['#ffffff', '#cfefff'], angle: -Math.PI / 2, spread: 1.0, min: 120, max: 320, g: 600, sMin: 2, sMax: 5 });
  }
  endJump() {
    this.parts.burst(this.fx, this.waterY(), 26, { color: ['#ffffff', '#cfefff'], angle: -Math.PI / 2, spread: 1.1, min: 100, max: 300, g: 600 });
    SFX.play('splash');
    if (this.jumpHold > 0.3 && chance(0.7)) { this.lose('jump'); return; }
    if (this.jumpHold <= 0.3) { this.bows++; this.fl.add(this.fx, this.waterY() - 60, 'Bowed! +40', PAL.sun, 24); SFX.play('coin'); }
  }
  land() {
    this.phase = 'landing'; this.landT = 0; this.running = false; SFX.setDrag(0); SFX.play('bigsplash');
    this.parts.burst(this.fx, this.waterY(), 30, { color: ['#ffffff', '#bfe9ff'], angle: -Math.PI / 2, spread: 1.2, min: 80, max: 260, g: 600 });
  }
  toOver() {
    const extras = [];
    if (this.bows) extras.push({ label: 'Bowed to the jump × ' + this.bows, pts: this.bows * 40 });
    if (this.shark) extras.push({ label: 'Beat the shark', pts: 75 });
    this.catch = makeCatch(this.key, this.weight, this.ch, this.o.spot, extras);
    this.isPB = Records.isRecord(this.key, this.weight);
    this.won = true; this.phase = 'over'; this.overT = 0;
    SFX.play(this.catch.trophy ? 'trophy' : 'catch'); Game.vibrate([30, 40, 30]);
    this.confetti = new Particles();
    this.confetti.burst(Game.W / 2, 200, 60, { kind: 'confetti', color: [PAL.sun, PAL.coral, '#42d3c4', '#ffffff'], min: 120, max: 420, g: 420, lifeMin: 1.4, lifeMax: 2.4, sMin: 3, sMax: 6, drag: 0.6 });
  }
  lose(reason) {
    this.reason = reason; this.won = false; this.phase = 'over'; this.overT = 0; SFX.setDrag(0);
    SFX.play(reason === 'snap' ? 'snap' : 'fail'); if (reason === 'tax') SFX.play('chomp');
    Game.shake(reason === 'snap' ? 8 : 4, 0.35); Game.vibrate(120);
  }

  /* ----- layout + animation ----- */
  waterY() { return this.kind === 'reef' ? 236 : this.kind === 'flats' ? 300 : 270; }
  anglerX() { return this.kind === 'flats' ? 150 : 200; }
  fightAnim(dt) {
    const W = Game.W, wy = this.waterY();
    const x0 = this.anglerX() + 170, x1 = W - 130;
    let fx, fy;
    const frac = clamp(this.dist / (this.d0 * 1.35), 0, 1);
    if (this.kind === 'reef') {
      fx = lerp(x0 + 40, x1 - 120, 0.45) + Math.sin(this.t * 0.9) * 50 * (this.running ? 1.4 : 0.6);
      fy = wy + 30 + (this.dist / this.maxDist) * (Game.H - wy - 40) * 1.25;
      fy = Math.min(fy, Game.H - 40);
      if (this.phase === 'turn') fy = Game.H - 60 - this.rockBar * 120;
    } else {
      fx = lerp(x0, x1, frac) + Math.sin(this.t * 1.7) * 18;
      fy = wy + (this.kind === 'flats' ? 22 : 45) + Math.sin(this.t * 2.3) * 10;
      if (this.phase === 'turn') { fx = lerp(x0, x1, frac) + 20; fy = wy + 26; }
    }
    if (this.jumpT > 0) { const ph = 1 - this.jumpT / 1.15; fy = wy - Math.sin(ph * Math.PI) * (90 + 60 * this.wn); fx += (ph - 0.5) * 60; this.fang = (ph - 0.5) * 2.2; }
    else this.fang = this.running ? -0.15 : 0.1;
    if (this.phase === 'landing') { const k = easeOut(this.landT / 0.9); fx = lerp(this.fx, this.anglerX() + 90, k); fy = lerp(this.fy, wy - 80, k); }
    this.fx = this.fx ? approach(this.fx, fx, 10, dt || 0.016) : fx; this.fy = this.fy ? approach(this.fy, fy, 10, dt || 0.016) : fy;
    if (this.running && chance(0.3)) this.parts.add({ x: this.fx + rand(-10, 10), y: wy + 2, vy: -rand(20, 60), life: 0.5, size: rand(1.5, 3), color: 'rgba(255,255,255,0.8)', g: 200 });
  }

  draw(ctx) {
    const W = Game.W, H = Game.H, wy = this.waterY(), t = this.t;
    this.drawBackdrop(ctx, W, H, wy, t);
    const lean = 0.08 + this.T * 0.28;
    const hand = this.drawRig(ctx, W, H, wy, t, lean);
    this.drawFishBody(ctx, wy);
    this.parts.draw(ctx);
    this.drawLine(ctx, hand, wy);
    if (this.shark && this.phase !== 'over') {
      const a = this.shark.a; const sx = this.fx + Math.cos(a * 1.8) * 90, sy = Math.max(wy + 40, this.fy + 30 + Math.sin(a * 1.8) * 30);
      ctx.save(); ctx.translate(sx, sy); ctx.globalAlpha = 0.75; drawFish(ctx, 'wahoo', 150, { sil: '#20333c', t, flip: Math.sin(a * 1.8) > 0 }); ctx.restore();
    }
    this.fl.draw(ctx);
    this.drawHud(ctx, W, H);
    if (this.phase === 'over') this.drawOver(ctx, W, H);
  }
  drawBackdrop(ctx, W, H, wy, t) {
    if (this.kind === 'flats') {
      drawSky(ctx, W, wy, 'day');
      drawCloud(ctx, W * 0.25, 70, 0.9); drawCloud(ctx, W * 0.75, 110, 0.7);
      ctx.fillStyle = '#1f4a2c'; for (let x = -20; x < W + 40; x += 34) { ell(ctx, x, wy - 10 - (x % 70 ? 6 : 14), 30, 18); ctx.fill(); }
      ctx.fillStyle = '#2b5f37'; for (let x = 0; x < W + 40; x += 46) { ell(ctx, x, wy - 4, 26, 10); ctx.fill(); }
      const g = ctx.createLinearGradient(0, wy, 0, H); g.addColorStop(0, '#6cc9c2'); g.addColorStop(0.5, '#8ad8c8'); g.addColorStop(1, '#d9cf9e');
      ctx.fillStyle = g; ctx.fillRect(0, wy, W, H - wy);
      ctx.fillStyle = 'rgba(70,120,80,0.25)'; for (let i = 0; i < 9; i++) { ell(ctx, (i * 173) % W, wy + 120 + (i * 61) % 110, 70, 14); ctx.fill(); }
    } else {
      drawSky(ctx, W, wy, 'day');
      drawSun(ctx, W * 0.8, 70, 22);
      drawCloud(ctx, W * 0.2 + Math.sin(t * 0.05) * 20, 60, 0.9); drawCloud(ctx, W * 0.55, 110, 0.6, 0.8);
      const g = ctx.createLinearGradient(0, wy, 0, H);
      if (this.kind === 'reef') { g.addColorStop(0, '#1f8fb7'); g.addColorStop(0.6, '#0d5677'); g.addColorStop(1, '#073248'); }
      else { g.addColorStop(0, '#155ea8'); g.addColorStop(1, '#062a52'); }
      ctx.fillStyle = g; ctx.fillRect(0, wy, W, H - wy);
      if (this.kind === 'reef') {
        ctx.fillStyle = 'rgba(255,255,255,0.05)'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(i * W / 5, wy); ctx.lineTo(i * W / 5 + 60, wy); ctx.lineTo(i * W / 5 - 80 + Math.sin(t + i) * 10, H); ctx.lineTo(i * W / 5 - 140, H); ctx.fill(); }
        ctx.fillStyle = '#3e3a30'; ctx.beginPath(); ctx.moveTo(0, H); for (let x = 0; x <= W; x += 40) ctx.lineTo(x, H - 26 - Math.sin(x * 0.02) * 12 - (x > W * 0.45 && x < W * 0.8 ? 40 : 0)); ctx.lineTo(W, H); ctx.fill();
      }
    }
    drawWaterline(ctx, W, wy, t, 'rgba(255,255,255,0.6)', 3);
  }
  drawRig(ctx, W, H, wy, t, lean) {
    const ax = this.anglerX();
    let hand;
    if (this.kind === 'flats') {
      hand = drawAnglerSide(ctx, this.ch, ax + 40, wy - 14, 20, { lean, t, crank: this.holding() });
      ctx.fillStyle = '#f4f5f2'; ctx.beginPath(); ctx.moveTo(-40, wy - 14); ctx.lineTo(ax + 120, wy - 12); ctx.quadraticCurveTo(ax + 140, wy - 12, ax + 150, wy - 20); ctx.lineTo(ax + 120, wy + 8); ctx.lineTo(-40, wy + 8); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#2d6b8f'; ctx.fillRect(-40, wy - 2, ax + 165, 5);
    } else {
      hand = drawAnglerSide(ctx, this.ch, ax + 10, wy - 14, 22, { lean, t, crank: this.holding() });
      drawBoatSide(ctx, ax - 120, wy + 4, 0.8, { flip: true, t });
    }
    return hand;
  }
  rodTip(hand) {
    const bend = this.phase === 'over' && !this.won ? 0 : clamp(this.T, 0, 1.2);
    const ang = -1.05 + bend * 0.55; const len = 150;
    return { bx: hand.x - 22, by: hand.y + 14, tx: hand.x + Math.cos(ang) * len, ty: hand.y + Math.sin(ang) * len, ang, bend };
  }
  drawLine(ctx, hand, wy) {
    const r = this.rodTip(hand);
    ctx.strokeStyle = '#1d1f22'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    const mx = (r.bx + r.tx) / 2 + r.bend * 20, my = (r.by + r.ty) / 2 - r.bend * 6;
    ctx.beginPath(); ctx.moveTo(r.bx, r.by); ctx.quadraticCurveTo(mx, my, r.tx, r.ty); ctx.stroke();
    ctx.strokeStyle = '#ffc845'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(r.bx, r.by); ctx.lineTo(r.bx + (mx - r.bx) * 0.35, r.by + (my - r.by) * 0.35); ctx.stroke();
    ctx.fillStyle = '#9aa3aa'; ell(ctx, hand.x - 6, hand.y + 4, 8, 7); ctx.fill();
    if (this.phase === 'over' && !this.won) {
      ctx.strokeStyle = 'rgba(240,240,240,0.7)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(r.tx, r.ty); ctx.quadraticCurveTo(r.tx + 40, r.ty + 80, r.tx + 30, wy + 30); ctx.stroke();
      return;
    }
    const sag = (1 - clamp(this.T, 0, 1)) * 90;
    ctx.strokeStyle = 'rgba(245,245,245,0.85)'; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(r.tx, r.ty); ctx.quadraticCurveTo((r.tx + this.fx) / 2, Math.max(r.ty, this.fy) - 20 + sag, this.fx + 30, this.fy); ctx.stroke();
  }
  drawFishBody(ctx, wy) {
    if (this.phase === 'over' && !this.won) return;
    const len = 70 + 90 * this.wn * (this.key === 'goliath' || this.key === 'bluemarlin' ? 1.6 : 1);
    ctx.save(); ctx.translate(this.fx, this.fy); ctx.rotate(this.fang);
    const above = this.fy < wy;
    const sil = !this.revealed && !above ? 'rgba(10,30,45,0.75)' : null;
    if (!above) ctx.globalAlpha = 0.85;
    drawFish(ctx, this.key, len, { t: this.t, flip: true, sil, speed: this.running ? 16 : 8 });
    ctx.restore();
  }
  drawHud(ctx, W, H) {
    if (this.phase === 'over') return;
    // fish stamina
    panel(ctx, 16, 12, 250, 84, { r: 14 });
    text(ctx, this.revealed ? this.sp.name : 'Something big…', 30, 37, { size: 20, weight: 800, color: '#fff', maxW: 222 });
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; rr(ctx, 30, 48, 222, 12, 6); ctx.fill();
    ctx.fillStyle = this.S > 0.5 ? PAL.coral : this.S > 0.2 ? PAL.sun : PAL.good; rr(ctx, 30, 48, 222 * this.S, 12, 6); ctx.fill();
    text(ctx, (this.unit === 'ft' ? 'DEPTH ' : 'LINE OUT ') + Math.max(0, Math.round(this.dist)) + ' ' + this.unit, 30, 84, { size: 16, color: '#cfe3ea', weight: 800 });
    text(ctx, 'FISH', 252, 84, { size: 13, align: 'right', color: '#9fb8c2', weight: 800 });
    if (this.o.timeLeft) { const tl = this.o.timeLeft(); drawTimerPill(ctx, W / 2, 34, tl); }
    // tension meter
    const mx = W - 62, my0 = 96, my1 = 400, mh = my1 - my0, L = this.perks.line, scale = 1.25;
    const yOf = (v) => my1 - (v / scale) * mh;
    panel(ctx, mx - 30, my0 - 40, 60, mh + 70, { r: 16 });
    text(ctx, 'DRAG', mx, my0 - 18, { size: 15, align: 'center', color: '#cfe3ea', weight: 800 });
    ctx.fillStyle = 'rgba(120,170,200,0.35)'; ctx.fillRect(mx - 12, yOf(0.12), 24, yOf(0) - yOf(0.12));
    ctx.fillStyle = 'rgba(60,207,124,0.55)'; ctx.fillRect(mx - 12, yOf(0.86 * L), 24, yOf(0.38) - yOf(0.86 * L));
    ctx.fillStyle = 'rgba(255,79,79,0.6)'; ctx.fillRect(mx - 12, yOf(scale), 24, yOf(L) - yOf(scale));
    ctx.fillStyle = 'rgba(255,173,31,0.45)'; ctx.fillRect(mx - 12, yOf(L), 24, yOf(0.86 * L) - yOf(L));
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2; ctx.strokeRect(mx - 12, my0, 24, mh);
    const ny = yOf(clamp(this.T, 0, scale));
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(mx - 22, ny); ctx.lineTo(mx - 12, ny - 7); ctx.lineTo(mx - 12, ny + 7); ctx.fill();
    ctx.fillRect(mx - 12, ny - 2, 24, 4);
    // prompt
    let msg = 'HOLD TO REEL', col = '#fff';
    const danger = this.T > 0.86 * L, slack = this.slackT > 0.6;
    if (this.phase === 'turn') { msg = 'TAP TAP TAP! TURN IT!'; col = PAL.sun; }
    else if (this.jumpT > 0) { msg = 'IT JUMPED! LET GO!'; col = PAL.sun; }
    else if (this.running) { msg = danger ? 'LET GO! IT’S RUNNING' : 'IT’S RUNNING · LET IT GO'; col = danger ? PAL.bad : PAL.warn; }
    else if (this.tele) { msg = 'GET READY…'; col = PAL.warn; }
    else if (slack) { msg = 'SLACK! REEL!'; col = '#9fe0ff'; }
    else if (danger) { msg = 'TOO TIGHT!'; col = PAL.bad; }
    const pw = Math.min(W - 180, 460);
    panel(ctx, W / 2 - pw / 2, H - 70, pw, 52, { r: 26 });
    const pulse = (this.running || this.jumpT > 0 || this.phase === 'turn') ? 1 + Math.sin(this.t * 14) * 0.04 : 1;
    ctx.save(); ctx.translate(W / 2, H - 43); ctx.scale(pulse, pulse);
    text(ctx, msg, 0, 0, { size: 26, align: 'center', base: 'middle', color: col, weight: 800, maxW: pw - 30 });
    ctx.restore();
    if (this.phase === 'turn') {
      const bw = Math.min(420, W - 200), bx = W / 2 - bw / 2, by = H - 128;
      panel(ctx, bx - 14, by - 34, bw + 28, 74, { r: 16 });
      text(ctx, this.kind === 'flats' ? 'KEEP IT OUT OF THE MANGROVES' : 'PULL IT OFF THE BOTTOM', W / 2, by - 12, { size: 16, align: 'center', color: '#cfe3ea', weight: 800 });
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; rr(ctx, bx, by, bw, 20, 10); ctx.fill();
      ctx.fillStyle = this.rockBar < 0.25 ? PAL.bad : PAL.good; rr(ctx, bx, by, bw * clamp(this.rockBar, 0, 1), 20, 10); ctx.fill();
      if (this.crankFx > 0) { ctx.strokeStyle = PAL.sun; ctx.lineWidth = 3; rr(ctx, bx - 3, by - 3, bw + 6, 26, 12); ctx.stroke(); }
    }
  }
  drawOver(ctx, W, H) {
    const k = easeOut(this.overT / 0.35);
    ctx.fillStyle = `rgba(4,26,38,${0.72 * k})`; ctx.fillRect(0, 0, W, H);
    if (!this.won) {
      const [title, sub] = LOSS_TEXT[this.reason] || ['Lost it', ''];
      ctx.save(); ctx.translate(W / 2, H / 2 - 30); ctx.scale(easeBack(Math.min(1, this.overT / 0.3)), easeBack(Math.min(1, this.overT / 0.3)));
      text(ctx, title, 0, 0, { display: true, size: 60, align: 'center', base: 'middle', color: PAL.coral, stroke: '#04202d', sw: 10 });
      ctx.restore();
      text(ctx, sub, W / 2, H / 2 + 30, { size: 22, align: 'center', color: '#fff', weight: 600, maxW: W - 80 });
      if (this.overT > 0.9) text(ctx, Game.touch ? 'Tap to keep fishing' : 'Click or press Space to keep fishing', W / 2, H / 2 + 80, { size: 18, align: 'center', color: '#cfe3ea', weight: 700, alpha: 0.6 + Math.sin(this.t * 4) * 0.3 });
      return;
    }
    const c = this.catch;
    drawSunburst(ctx, W * 0.32, H * 0.5, 420, this.t, 'rgba(255,200,69,0.16)');
    if (this.confetti) { this.confetti.update(1 / 60); this.confetti.draw(ctx); }
    const sc = easeBack(Math.min(1, this.overT / 0.4));
    ctx.save(); ctx.translate(W * 0.32, H * 0.42); ctx.scale(sc, sc);
    drawHeroShot(ctx, this.ch, { kind: 'fish', key: this.key, weight: this.weight }, 0, 0, 36, this.t);
    ctx.restore();
    const px = W * 0.58, pw = Math.min(W * 0.38, 420);
    text(ctx, c.name, px, 120, { display: true, size: 40, color: '#fff', stroke: '#04202d', sw: 8, maxW: pw });
    text(ctx, fmtLb(c.weight), px, 172, { size: 44, color: PAL.sun, weight: 800, stroke: '#04202d', sw: 6 });
    let y = 210;
    const tags = [];
    if (c.trophy) tags.push(['TROPHY', PAL.coral]);
    if (this.isPB) tags.push(['NEW PERSONAL BEST', '#42d3c4']);
    if (c.released) tags.push(['RELEASED', '#7fd98f']);
    let tx = px;
    ctx.font = fnt(15, 800);
    for (const [tg, col] of tags) { const tw = ctx.measureText(tg).width + 22; ctx.fillStyle = col; rr(ctx, tx, y, tw, 28, 14); ctx.fill(); text(ctx, tg, tx + tw / 2, y + 15, { size: 15, align: 'center', base: 'middle', color: '#04202d', weight: 800 }); tx += tw + 8; }
    y += tags.length ? 52 : 18;
    for (const l of c.lines) { text(ctx, l.label, px, y, { size: 19, color: '#cfe3ea', weight: 600 }); text(ctx, '+' + l.pts, px + pw, y, { size: 19, align: 'right', color: '#fff', weight: 800 }); y += 28; }
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(px, y - 14, pw, 2);
    text(ctx, 'Total', px, y + 14, { size: 22, color: '#fff', weight: 800 });
    text(ctx, '+' + c.pts, px + pw, y + 14, { size: 28, align: 'right', color: PAL.sun, weight: 800 });
    if (this.overT > 0.9) text(ctx, Game.touch ? 'Tap to keep fishing' : 'Click or press Space to keep fishing', W / 2, H - 26, { size: 18, align: 'center', color: '#cfe3ea', weight: 700, alpha: 0.6 + Math.sin(this.t * 4) * 0.3 });
  }
}

function drawTimerPill(ctx, x, y, secs) {
  const low = secs <= 10;
  panel(ctx, x - 58, y - 20, 116, 40, { r: 20, fill: low ? 'rgba(160,30,30,0.92)' : PAL.panel });
  text(ctx, fmtTime(secs), x, y + 1, { size: 24, align: 'center', base: 'middle', color: low ? '#fff' : PAL.sun, weight: 800 });
}
