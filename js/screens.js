'use strict';
/* Keys Crew — menus and the trip flow: title, crew pick, turn hand-offs, results,
   end of day, logbook, how to play. The boat ride between spots lives in sea.js. */

const SCENE_FOR = { bughunt: () => BugHuntScene, bottom: () => BottomScene, troll: () => TrollScene, flats: () => FlatsScene };  // keyed by spot mode
const WATER_F = [72, 72, 75, 78, 82, 85, 87, 88, 87, 84, 79, 75];

function launchTurn() {
  const c = Trip.cur, spot = c.spot, ch = c.mode === 'crew' ? c.crew[c.turn] : c.crew[0];
  const S = SCENE_FOR[spotMode(spot)]();
  Game.go(new S({ ch, spot, len: c.sessionLen, weather: c.weather, onEnd: (res) => {
    Trip.record(ch, spot, res);
    // move the trip on as soon as the turn counts, so leaving from the results screen
    // (or closing the tab there) never hands the same angler the same turn twice
    Game.go(new ResultsScene(ch, spot, res, advanceTrip()));
  } }));
}
// where the trip goes after the turn in progress: 'turn' (next angler, same spot), 'sea' or 'home'. Changes nothing.
function tripNext(c) {
  if (c.mode !== 'crew') return 'sea';
  if (c.turn + 1 < c.crew.length) return 'turn';
  return (c.done.includes(c.spot) ? c.done.length : c.done.length + 1) >= c.spotsNeeded ? 'home' : 'sea';
}
// count the finished turn: next angler up, or the spot is done and everyone's back on the boat. Saves.
function advanceTrip() {
  const c = Trip.cur, kind = tripNext(c);
  if (kind === 'turn') c.turn++;
  else { if (!c.done.includes(c.spot)) c.done.push(c.spot); c.turn = 0; c.spot = null; }
  Trip.save();
  return kind;
}
function goNext(kind) { Game.go(kind === 'turn' ? new TurnIntroScene() : new SeaScene({ home: kind === 'home' })); }
function afterResults() { goNext(advanceTrip()); }
function dayLabel() { return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }); }
function crewAvatar(ctx, ch, x, y, r, o = {}) {
  const C = CHARS[ch];
  ctx.save(); ell(ctx, x, y, r, r); ctx.clip(); ctx.fillStyle = o.bg || '#7fc8e8'; ctx.fillRect(x - r, y - r, r * 2, r * 2); drawHead(ctx, C, x, y + r * 0.22, r * 0.78, o); ctx.restore();
  ctx.strokeStyle = o.ring || C.color; ctx.lineWidth = Math.max(2, r * 0.1); ell(ctx, x, y, r, r); ctx.stroke();
}
function drawCrown(ctx, x, y, s) {
  ctx.fillStyle = PAL.sun; ctx.beginPath(); ctx.moveTo(x - s, y); ctx.lineTo(x - s, y - s * 0.8); ctx.lineTo(x - s * 0.5, y - s * 0.35); ctx.lineTo(x, y - s * 1.0); ctx.lineTo(x + s * 0.5, y - s * 0.35); ctx.lineTo(x + s, y - s * 0.8); ctx.lineTo(x + s, y); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = PAL.sunDeep; ctx.lineWidth = 1.5; ctx.stroke();
}
function oceanBackdrop(ctx, W, H, t, mood = 'day') {
  const hz = H * 0.56;
  drawSky(ctx, W, hz, mood);
  if (mood === 'sunset') drawSun(ctx, W * 0.7, hz - 26, 34, '#ffd9a0'); else drawSun(ctx, W * 0.82, 88, 30);
  drawCloud(ctx, (W * 0.18 + t * 6) % (W + 200) - 60, 80, 1.1, mood === 'sunset' ? 0.55 : 0.9);
  drawCloud(ctx, (W * 0.6 + t * 4) % (W + 200) - 60, 140, 0.7, mood === 'sunset' ? 0.45 : 0.8);
  ctx.fillStyle = mood === 'sunset' ? '#3b3046' : '#2e6b56';
  ctx.beginPath(); ctx.moveTo(W * 0.02, hz); ctx.quadraticCurveTo(W * 0.1, hz - 14, W * 0.24, hz - 6); ctx.quadraticCurveTo(W * 0.3, hz - 2, W * 0.34, hz); ctx.fill();
  for (const px of [0.07, 0.12, 0.2]) {
    const x = W * px, y = hz - 8;
    ctx.strokeStyle = mood === 'sunset' ? '#2a2233' : '#3d5a3a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 4, y - 22, x + 2, y - 40); ctx.stroke();
    ctx.fillStyle = ctx.strokeStyle; for (let k = 0; k < 5; k++) { ctx.save(); ctx.translate(x + 2, y - 40); ctx.rotate(-1.2 + k * 0.6 + Math.sin(t + k) * 0.05); ell(ctx, 10, 0, 12, 3); ctx.fill(); ctx.restore(); }
  }
  const g = ctx.createLinearGradient(0, hz, 0, H);
  if (mood === 'sunset') { g.addColorStop(0, '#d9826e'); g.addColorStop(0.3, '#7b5a86'); g.addColorStop(1, '#1d2c55'); }
  else { g.addColorStop(0, '#3db0d6'); g.addColorStop(0.35, '#1683b5'); g.addColorStop(1, '#0a4a7a'); }
  ctx.fillStyle = g; ctx.fillRect(0, hz, W, H - hz);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2;
  for (let i = 0; i < 14; i++) { const y = hz + 10 + i * i * 1.6, off = (t * (10 + i * 3)) % 80; ctx.beginPath(); for (let x = -80 + off; x < W + 80; x += 80) { ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 20, y - 2 - i * 0.2, x + 40, y); } ctx.stroke(); }
  return hz;
}

/* ================= TITLE ================= */
class TitleScene {
  constructor() { this.t = 0; this.saved = Trip.load(); }
  enter() { SFX.setAmbient(0.7, false); Music.play('title'); }
  update(dt) { this.t += dt; }
  draw(ctx) {
    const W = Game.W, H = Game.H, t = this.t;
    const hz = oceanBackdrop(ctx, W, H, t, 'dawn');
    for (let i = 0; i < 3; i++) drawFrigate(ctx, W * 0.6 + i * 50 + Math.sin(t * 0.5 + i) * 30, 120 + i * 18 + Math.cos(t * 0.7 + i) * 8, 0.9, t * 5 + i);
    const bob = Math.sin(t * 1.4) * 3;
    drawBoatSide(ctx, W * 0.7, hz + 70 + bob, 0.95, { crew: CHAR_ORDER, rot: Math.sin(t * 1.1) * 0.02, t, flag: false });
    ctx.save(); ctx.translate(W * 0.67, 112); ctx.rotate(-0.06);
    text(ctx, 'Keys Crew', 0, 0, { display: true, size: Math.min(104, W * 0.1), align: 'center', base: 'middle', color: PAL.coral, stroke: PAL.ink, sw: 12, shadow: 'rgba(0,0,0,0.25)', sy: 6 });
    ctx.restore();
    text(ctx, 'Lobstering and fishing in the Florida Keys', W * 0.67, 186, { size: 22, align: 'center', color: '#fff', weight: 700, stroke: 'rgba(10,40,60,0.55)', sw: 5 });
    const bx = Math.max(24, W * 0.06), bw = Math.min(300, W * 0.32);
    let y = 150;
    panel(ctx, bx - 16, y - 20, bw + 32, this.saved ? 306 : 236, { r: 22, fill: 'rgba(7,36,51,0.82)' });
    if (this.saved) {
      const s = this.saved;
      // a trip left mid-spot comes back to that angler's hand-off; otherwise back on the boat
      UI.button(ctx, 'resume', bx, y, bw, 56, 'Resume trip', () => { if (!Trip.resume()) { this.saved = null; return; } Game.go(Trip.cur.spot ? new TurnIntroScene() : new SeaScene()); }, { style: 'coral', size: 22, sub: s.crew.map((c) => CHARS[c].name).join(', ') + ' · ' + s.done.length + '/' + s.spotsNeeded + ' spots', key: 'Enter' });
      y += 70;
    }
    UI.button(ctx, 'crew', bx, y, bw, 62, 'Crew Trip', () => Game.go(new CrewSetupScene()), { style: 'primary', size: 26, sub: 'Pass the phone · 1 to 3 players', key: this.saved ? undefined : 'Enter' }); y += 76;
    UI.button(ctx, 'solo', bx, y, bw, 52, 'Solo Day', () => Game.go(new SoloSetupScene()), { style: 'secondary', size: 22 }); y += 64;
    UI.button(ctx, 'log', bx, y, bw / 2 - 6, 46, 'Logbook', () => Game.go(new LogbookScene()), { style: 'ghost', size: 18 });
    UI.button(ctx, 'how', bx + bw / 2 + 6, y, bw / 2 - 6, 46, 'How to play', () => Game.go(new HowToScene()), { style: 'ghost', size: 18 });
    UI.button(ctx, 'snd', W - 64, H - 60, 48, 44, SFX.muted ? '🔇' : '🔊', () => SFX.setMuted(!SFX.muted), { style: 'dark', size: 18 });
    UI.button(ctx, 'mus', W - 120, H - 60, 48, 44, '♫', () => Music.setOn(!Music.on), { style: Music.on ? 'dark' : 'ghost', size: 20, color: Music.on ? '#fff' : '#9fb8c2' });
    text(ctx, 'For Michael, Jorge & Jemel', W - 136, H - 32, { size: 16, align: 'right', color: '#fff', weight: 600, alpha: 0.85 });
  }
}

/* ================= CREW + SOLO SETUP ================= */
function charCard(ctx, ch, x, y, w, h, on, t, fn, id) {
  const C = CHARS[ch];
  ctx.save(); ctx.globalAlpha = on ? 1 : 0.55;
  panel(ctx, x, y, w, h, { r: 20, fill: on ? 'rgba(10,52,72,0.95)' : 'rgba(7,36,51,0.85)', line: on ? PAL.sun : PAL.panelLine });
  if (on) { ctx.strokeStyle = PAL.sun; ctx.lineWidth = 3; rr(ctx, x, y, w, h, 20); ctx.stroke(); }
  crewAvatar(ctx, ch, x + w / 2, y + 72, 52, { ring: C.color, bg: '#8fd3ee' });
  text(ctx, C.name, x + w / 2, y + 154, { display: true, size: 30, align: 'center', color: '#fff' });
  text(ctx, C.title, x + w / 2, y + 178, { size: 17, align: 'center', color: C.color, weight: 800 });
  C.perkText.forEach((p, i) => para(ctx, p, x + 16, y + 204 + i * 36, w - 32, { size: 14, weight: 600, color: '#cfe3ea', lh: 16 }));
  if (on) { ctx.fillStyle = PAL.sun; ell(ctx, x + w - 22, y + 22, 13, 13); ctx.fill(); ctx.strokeStyle = PAL.ink; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + w - 28, y + 22); ctx.lineTo(x + w - 23, y + 27); ctx.lineTo(x + w - 15, y + 16); ctx.stroke(); }
  ctx.restore();
  UI.region(id, x, y, w, h, fn);
}
class CrewSetupScene {
  constructor() { this.t = 0; this.crew = new Set(CHAR_ORDER); this.plan = 'full'; this.len = 120; this.saved = !!Trip.load(); }
  enter() { Music.play('title'); }
  update(dt) { this.t += dt; }
  draw(ctx) {
    const W = Game.W, H = Game.H;
    oceanBackdrop(ctx, W, H, this.t, 'day'); ctx.fillStyle = 'rgba(4,28,40,0.55)'; ctx.fillRect(0, 0, W, H);
    text(ctx, 'Who’s on the boat?', W / 2, 52, { display: true, size: 36, align: 'center', color: '#fff' });
    const cw = Math.min(250, (W - 80) / 3), gap = 16, x0 = W / 2 - (cw * 3 + gap * 2) / 2;
    CHAR_ORDER.forEach((ch, i) => charCard(ctx, ch, x0 + i * (cw + gap), 74, cw, 268, this.crew.has(ch), this.t, () => { if (this.crew.has(ch)) this.crew.delete(ch); else this.crew.add(ch); }, 'card' + i));
    const oy = 360;
    text(ctx, 'TRIP', x0, oy + 26, { size: 15, color: '#cfe3ea', weight: 800 });
    UI.button(ctx, 'half', x0 + 64, oy, 170, 42, 'Half day · 2 spots', () => (this.plan = 'half'), { style: this.plan === 'half' ? 'primary' : 'ghost', size: 17 });
    UI.button(ctx, 'full', x0 + 244, oy, 170, 42, 'Full day · 4 spots', () => (this.plan = 'full'), { style: this.plan === 'full' ? 'primary' : 'ghost', size: 17 });
    text(ctx, 'TURNS', x0, oy + 80, { size: 15, color: '#cfe3ea', weight: 800 });
    [[90, '90 sec'], [120, '2 min'], [180, '3 min']].forEach(([v, l], i) => UI.button(ctx, 'len' + v, x0 + 64 + i * 112, oy + 54, 102, 42, l, () => (this.len = v), { style: this.len === v ? 'primary' : 'ghost', size: 17 }));
    const turns = (this.plan === 'full' ? 4 : 2) * this.crew.size, mins = Math.round((turns * this.len) / 60 + turns * 0.5);
    text(ctx, this.crew.size ? `${turns} turns · about ${mins} minutes` : 'Pick at least one angler', x0 + cw * 3 + gap * 2, oy + 26, { size: 16, align: 'right', color: '#cfe3ea', weight: 700 });
    UI.button(ctx, 'back', 20, H - 66, 120, 48, 'Back', () => Game.go(new TitleScene()), { style: 'ghost', size: 18, key: 'Escape' });
    UI.button(ctx, 'go', W - 240, H - 72, 220, 56, 'Cast off', () => {
      Trip.start({ mode: 'crew', crew: CHAR_ORDER.filter((c) => this.crew.has(c)), plan: this.plan, sessionLen: this.len });
      SFX.play('horn'); Game.go(new SeaScene());
    }, { style: 'primary', size: 24, disabled: !this.crew.size, key: 'Enter', sub: this.saved ? 'Replaces your saved trip' : null });
  }
}
class SoloSetupScene {
  constructor() { this.t = 0; this.ch = 'michael'; this.len = 120; }
  enter() { Music.play('title'); }
  update(dt) { this.t += dt; }
  draw(ctx) {
    const W = Game.W, H = Game.H;
    oceanBackdrop(ctx, W, H, this.t, 'day'); ctx.fillStyle = 'rgba(4,28,40,0.55)'; ctx.fillRect(0, 0, W, H);
    text(ctx, 'Who’s fishing today?', W / 2, 52, { display: true, size: 36, align: 'center', color: '#fff' });
    const cw = Math.min(250, (W - 80) / 3), gap = 16, x0 = W / 2 - (cw * 3 + gap * 2) / 2;
    CHAR_ORDER.forEach((ch, i) => charCard(ctx, ch, x0 + i * (cw + gap), 74, cw, 268, this.ch === ch, this.t, () => (this.ch = ch), 'card' + i));
    const oy = 372;
    text(ctx, 'TURNS', x0, oy + 26, { size: 15, color: '#cfe3ea', weight: 800 });
    [[90, '90 sec'], [120, '2 min'], [180, '3 min']].forEach(([v, l], i) => UI.button(ctx, 'len' + v, x0 + 64 + i * 112, oy, 102, 42, l, () => (this.len = v), { style: this.len === v ? 'primary' : 'ghost', size: 17 }));
    text(ctx, 'Run the boat anywhere, find new spots, fish them as often as you like.', x0, oy + 76, { size: 16, color: '#cfe3ea', weight: 600, maxW: cw * 3 + gap * 2 });
    UI.button(ctx, 'back', 20, H - 66, 120, 48, 'Back', () => Game.go(new TitleScene()), { style: 'ghost', size: 18, key: 'Escape' });
    UI.button(ctx, 'go', W - 240, H - 72, 220, 56, 'Head out', () => { Trip.start({ mode: 'solo', crew: [this.ch], plan: 'solo', sessionLen: this.len }); SFX.play('horn'); Game.go(new SeaScene()); }, { style: 'primary', size: 24, key: 'Enter' });
  }
}

/* ================= TURN HAND-OFF ================= */
class TurnIntroScene {
  // who and where are fixed when the hand-off opens, so it still draws while fading out after Back to the boat clears the spot
  constructor() { const c = (this.c = Trip.cur); this.t = 0; this.spot = c.spot; this.turn = c.turn; this.ch = c.mode === 'crew' ? c.crew[c.turn] : c.crew[0]; }
  enter() { Music.play('title'); }
  update(dt) { this.t += dt; }
  draw(ctx) {
    const W = Game.W, H = Game.H, c = this.c, ch = this.ch, C = CHARS[ch], S = SPOTS[this.spot];
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0d5f86'); g.addColorStop(1, '#062a3f'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    drawSunburst(ctx, W * 0.28, H * 0.48, 380, this.t, rgba(C.color, 0.16));
    const pop = easeBack(Math.min(1, this.t / 0.4));
    ctx.save(); ctx.translate(W * 0.28, H * 0.44); ctx.scale(pop, pop); crewAvatar(ctx, ch, 0, 0, 108, { ring: C.color, bg: '#8fd3ee' }); ctx.restore();
    text(ctx, C.title, W * 0.28, H * 0.44 + 150, { size: 20, align: 'center', color: C.color, weight: 800 });
    const x = W * 0.52, mw = W - x - 36;
    text(ctx, c.mode === 'crew' && c.crew.length > 1 ? 'Hand the phone to ' + C.name : 'You’re up', x, 92, { size: 20, color: '#cfe3ea', weight: 700 });
    text(ctx, C.name + '’s turn', x, 150, { display: true, size: 52, color: '#fff', maxW: mw });
    text(ctx, S.name + ' · ' + S.kind, x, 192, { size: 24, color: PAL.sun, weight: 800 });
    para(ctx, S.tip, x, 228, mw, { size: 18, weight: 600, color: '#fff', lh: 24 });
    C.perkText.forEach((p, i) => text(ctx, '• ' + p, x, 312 + i * 26, { size: 16, color: '#cfe3ea', weight: 600, maxW: mw }));
    text(ctx, fmtTime(c.sessionLen) + ' on the clock', x, 380, { size: 16, color: '#9fb8c2', weight: 700 });
    UI.button(ctx, 'ready', x, H - 110, Math.min(280, mw), 62, 'I’m ready', () => launchTurn(), { style: 'primary', size: 26, key: 'Enter|Space' });
    // before anyone has fished this spot the captain can still pick another one; after that, everyone fishes it.
    // Esc goes back a step: to the boat while that's open, otherwise out to the title (a crew trip stays saved).
    const canLeave = c.mode !== 'crew' || this.turn === 0;
    UI.button(ctx, 'menu', 20, 18, 96, 40, 'Title', () => Game.go(new TitleScene()), { style: 'ghost', size: 17, key: canLeave ? undefined : 'Escape' });
    if (canLeave) UI.button(ctx, 'chart', 20, H - 64, 170, 46, 'Back to the boat', () => { c.spot = null; c.turn = 0; Trip.save(); Game.go(new SeaScene()); }, { style: 'ghost', size: 17, key: 'Escape' });
  }
}

/* ================= RESULTS ================= */
class ResultsScene {
  // next: what advanceTrip() returned when the turn was counted. Without it (a results screen opened by hand)
  // the trip moves on when the player leaves this screen.
  constructor(ch, spot, res, next) {
    this.ch = ch; this.spot = spot; this.res = res; this.t = 0; this.parts = new Particles(); this.shown = 0; this.caption = res.best ? captionFor(res.best, Trip.cur.weather) : null; this.comments = randi(1, 9);
    const c = Trip.cur; this.advanced = !!next; this.nextKind = next || tripNext(c);
    this.nextUp = this.nextKind === 'turn' ? c.crew[this.advanced ? c.turn : c.turn + 1] : null;
  }
  leave(toTitle) { if (this.left) return; this.left = true; if (!this.advanced) advanceTrip(); if (toTitle) Game.go(new TitleScene()); else goNext(this.nextKind); }
  enter() {
    SFX.setAmbient(0.4, false); Music.play('title');
    if (this.res.total > 0) this.parts.burst(Game.W * 0.72, 120, 40, { kind: 'confetti', color: [PAL.sun, PAL.coral, '#42d3c4', '#fff'], min: 100, max: 380, g: 400, lifeMin: 1.4, lifeMax: 2.4, sMin: 3, sMax: 6, drag: 0.5 });
  }
  update(dt) {
    this.t += dt; this.parts.update(dt);
    const n = Math.min(this.res.lines.length, Math.floor(this.t / 0.22));
    if (n > this.shown) { this.shown = n; SFX.play(this.res.lines[n - 1].pts < 0 ? 'warn' : 'tick'); }
  }
  nextLabel() { return this.nextKind === 'turn' ? 'Next up: ' + CHARS[this.nextUp].name : this.nextKind === 'home' ? 'Run home' : 'Back to the boat'; }
  draw(ctx) {
    const W = Game.W, H = Game.H, C = CHARS[this.ch], r = this.res;
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0d5f86'); g.addColorStop(1, '#062a3f'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const cardW = Math.min(330, W * 0.36), lw = W - cardW - 70;
    text(ctx, r.header || SPOTS[this.spot].name, 30, 52, { display: true, size: 34, color: '#fff', maxW: lw });
    text(ctx, C.name + ' · ' + SPOTS[this.spot].kind, 30, 80, { size: 17, color: C.color, weight: 800 });
    const maxRows = 9, lines = r.lines.slice(0, this.shown), start = Math.max(0, lines.length - maxRows);
    let y = 120;
    if (start > 0) { text(ctx, '… ' + start + ' more above', 30, y - 4, { size: 14, color: '#9fb8c2', weight: 700 }); y += 14; }
    for (let i = start; i < lines.length; i++) {
      const l = lines[i];
      if (l.key) { ctx.save(); ctx.translate(48, y - 6); if (l.key === 'lobster') drawLobsterSide(ctx, 22, {}); else drawFish(ctx, l.key, 36, { wig: 0 }); ctx.restore(); }
      text(ctx, l.label, l.key ? 80 : 30, y, { size: 18, color: l.pts < 0 ? '#ff9a8a' : '#fff', weight: 600, maxW: lw - 130 });
      text(ctx, (l.pts > 0 ? '+' : '') + l.pts, 30 + lw, y, { size: 19, align: 'right', color: l.pts < 0 ? PAL.bad : PAL.sun, weight: 800 });
      y += 34;
    }
    if (!r.lines.length) text(ctx, 'Skunked. The fish won this round.', 30, y, { size: 20, color: '#cfe3ea', weight: 600 });
    const done = this.shown >= r.lines.length;
    if (done) {
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(30, H - 132, lw, 2);
      text(ctx, 'Turn total', 30, H - 96, { size: 22, color: '#fff', weight: 800 });
      text(ctx, r.total.toLocaleString(), 30 + lw, H - 92, { size: 38, align: 'right', color: PAL.sun, weight: 800 });
      const nw = Math.min(320, lw - 110);
      UI.button(ctx, 'next', 30, H - 70, nw, 56, this.nextLabel(), () => this.leave(), { style: 'primary', size: 21, key: 'Enter|Space' });
      UI.button(ctx, 'title', 40 + nw, H - 66, 100, 48, 'Title', () => this.leave(true), { style: 'ghost', size: 17 });
    } else UI.region('skip', 0, 0, W, H, () => { this.t = 99; });
    const cx = W - cardW - 24;
    if (r.best) {
      const ch = bragCardHeight(cardW), s = Math.min(1, (H - 40) / ch);
      ctx.save(); ctx.translate(cx + cardW * (1 - s) / 2, 20); ctx.scale(s, s);
      drawBragCard(ctx, 0, 0, cardW, r.best, { t: this.t, under: spotMode(this.spot) === 'bughunt', place: (SPOTS[this.spot] && SPOTS[this.spot].place) || 'Florida Keys', crew: Trip.cur.crew, caption: this.caption, weather: Trip.cur.weather, comments: this.comments });
      ctx.restore();
    } else {
      panel(ctx, cx, 40, cardW, 300, { r: 18 });
      ctx.save(); ctx.translate(cx + cardW / 2, 200); crewAvatar(ctx, this.ch, 0, -40, 70, { expr: 'smile' }); ctx.restore();
      text(ctx, 'Next time.', cx + cardW / 2, 290, { display: true, size: 28, align: 'center', color: '#fff' });
    }
    this.parts.draw(ctx);
  }
}

/* ================= END OF DAY ================= */
class DayEndScene {
  constructor() {
    this.t = 0; const c = Trip.cur; this.c = c; this.parts = new Particles();
    this.order = c.crew.slice().sort((a, b) => c.scores[b] - c.scores[a]);
    const fish = c.catches.filter((k) => k.key !== 'lobster'), bugs = c.catches.filter((k) => k.key === 'lobster');
    const top = (arr, f) => arr.reduce((b, x) => (!b || f(x) > f(b) ? x : b), null);
    this.awards = [];
    const bf = top(fish, (x) => x.weight); if (bf) this.awards.push(['Biggest fish', bf.ch, bf.name + ' · ' + fmtLb(bf.weight)]);
    const bb = top(bugs, (x) => x.weight); if (bb) this.awards.push(['Biggest bug', bb.ch, (bb.cl ? bb.cl.toFixed(2) + '" · ' : '') + fmtLb(bb.weight)]);
    if (c.crew.length > 1) { const counts = {}; c.catches.forEach((k) => (counts[k.ch] = (counts[k.ch] || 0) + 1)); const mc = c.crew.reduce((b, ch) => ((counts[ch] || 0) > (counts[b] || 0) ? ch : b), c.crew[0]); if (counts[mc]) this.awards.push(['Most catches', mc, counts[mc] + ' landed']); }
  }
  enter() {
    const c = this.c;
    if (c.mode === 'crew') { Records.addTrip({ date: c.date, crew: c.crew, scores: c.scores, winner: this.order[0] }); Trip.clear(); }
    SFX.play('slam'); SFX.setAmbient(0.6, false); Music.play('sunset');
    this.parts.burst(Game.W / 2, 160, 80, { kind: 'confetti', color: [PAL.sun, PAL.coral, '#42d3c4', '#fff'], min: 120, max: 460, g: 380, lifeMin: 1.8, lifeMax: 3, sMin: 3, sMax: 7, drag: 0.5 });
  }
  update(dt) { this.t += dt; this.parts.update(dt); }
  draw(ctx) {
    const W = Game.W, H = Game.H, t = this.t, c = this.c;
    const hz = oceanBackdrop(ctx, W, H, t, 'sunset');
    drawBoatSide(ctx, W * 0.84 - t * 6 % 60, hz + 40, 0.42, { crew: c.crew, t });
    ctx.fillStyle = 'rgba(10,14,40,0.35)'; ctx.fillRect(0, 0, W, H);
    // the high-five
    const hx = W * 0.5, hy = 128;
    if (c.crew.length > 1) {
      const a = this.order[0], b = this.order[1];
      ctx.save(); ctx.translate(hx - 90, hy + 40); drawTorso(ctx, CHARS[a], 0, 20, 90, 70); limb(ctx, [[30, 30], [62, -10], [84, -46]], 14, CHARS[a].shirt); drawHead(ctx, CHARS[a], 0, -8, 28, { expr: 'grin' }); ctx.restore();
      ctx.save(); ctx.translate(hx + 90, hy + 40); drawTorso(ctx, CHARS[b], 0, 20, 90, 70); limb(ctx, [[-30, 30], [-62, -10], [-84, -46]], 14, CHARS[b].sleeve === 'mahi' ? '#5ec05a' : CHARS[b].shirt); drawHead(ctx, CHARS[b], 0, -8, 28, { expr: CHARS[b].expr }); ctx.restore();
      const clap = Math.abs(Math.sin(t * 2.2));
      ctx.fillStyle = CHARS[a].skin; ell(ctx, hx - 6 - clap * 4, hy - 8, 11, 13); ctx.fill(); ctx.fillStyle = CHARS[b].skin; ell(ctx, hx + 6 + clap * 4, hy - 8, 11, 13); ctx.fill();
      if (clap < 0.2) { ctx.strokeStyle = PAL.sun; ctx.lineWidth = 3; for (let i = 0; i < 8; i++) { const an = (i / 8) * TAU; ctx.beginPath(); ctx.moveTo(hx + Math.cos(an) * 20, hy - 8 + Math.sin(an) * 20); ctx.lineTo(hx + Math.cos(an) * 32, hy - 8 + Math.sin(an) * 32); ctx.stroke(); } }
    } else { ctx.save(); ctx.translate(hx, hy + 30); crewAvatar(ctx, c.crew[0], 0, 0, 64, { expr: 'grin' }); ctx.restore(); }
    text(ctx, 'Out. 🙌', hx, 50, { display: true, size: 46, align: 'center', color: '#fff', stroke: '#1d1636', sw: 8 });
    // standings
    const bw = Math.min(380, W * 0.42), bx = 24, by = 262, rowH = 44;
    panel(ctx, bx, by, bw, 50 + this.order.length * rowH, { r: 18 });
    text(ctx, c.mode === 'crew' ? 'FINAL BOARD' : 'YOUR DAY', bx + 18, by + 30, { size: 15, color: '#cfe3ea', weight: 800 });
    this.order.forEach((ch, i) => {
      const y = by + 50 + i * rowH;
      crewAvatar(ctx, ch, bx + 40, y + 10, 19);
      const lead = this.order.length > 1 && c.scores[this.order[0]] > 0, tied = lead && c.scores[this.order[0]] === c.scores[this.order[1]];
      if (i === 0 && lead && !tied) drawCrown(ctx, bx + 40, y - 12, 11);
      text(ctx, CHARS[ch].name, bx + 72, y + 8, { size: 20, color: '#fff', weight: 800 });
      if (i === 0 && lead) text(ctx, tied ? 'Tied at the top' : 'Captain of the Day', bx + 72, y + 28, { size: 14, color: PAL.sun, weight: 800 });
      text(ctx, c.scores[ch].toLocaleString(), bx + bw - 18, y + 16, { size: 24, align: 'right', color: PAL.sun, weight: 800 });
    });
    const ax = W - Math.min(380, W * 0.42) - 24, aw = W - ax - 24;
    panel(ctx, ax, by, aw, 50 + Math.max(1, this.awards.length) * rowH, { r: 18 });
    text(ctx, 'AWARDS', ax + 18, by + 30, { size: 15, color: '#cfe3ea', weight: 800 });
    if (!this.awards.length) text(ctx, 'No fish today. Same time next week?', ax + 18, by + 70, { size: 17, color: '#fff', weight: 600 });
    this.awards.forEach(([title, ch, detail], i) => {
      const y = by + 50 + i * rowH; crewAvatar(ctx, ch, ax + 38, y + 10, 18);
      text(ctx, title + ': ' + CHARS[ch].name, ax + 66, y + 8, { size: 18, color: '#fff', weight: 800, maxW: aw - 80 });
      text(ctx, detail, ax + 66, y + 28, { size: 14, color: '#cfe3ea', weight: 600, maxW: aw - 80 });
    });
    text(ctx, 'Same crew. Same water. See you next season.', W / 2, 86, { size: 18, align: 'center', color: '#ffe3c0', weight: 700, alpha: 0.95 });
    const solo = c.mode !== 'crew';
    UI.button(ctx, 'again', W / 2 - 250, H - 66, 160, 50, solo ? 'New day' : 'New trip', () => Game.go(solo ? new SoloSetupScene() : new CrewSetupScene()), { style: 'primary', size: 19, key: 'Enter' });
    UI.button(ctx, 'log', W / 2 - 80, H - 66, 160, 50, 'Logbook', () => Game.go(new LogbookScene()), { style: 'secondary', size: 19 });
    UI.button(ctx, 'title', W / 2 + 90, H - 66, 160, 50, 'Title', () => Game.go(new TitleScene()), { style: 'ghost', size: 19, key: 'Escape' });
    this.parts.draw(ctx);
  }
}

/* ================= LOGBOOK ================= */
class LogbookScene {
  constructor() { this.t = 0; this.scroll = 0; this.drag = null; this.rec = Records.all(); this.trips = Records.trips(); this.onWheel = (e) => { this.scroll += e.deltaY * 0.6; }; }
  enter() { window.addEventListener('wheel', this.onWheel, { passive: true }); Music.play('title'); }
  exit() { window.removeEventListener('wheel', this.onWheel); }
  pointerDown(p) { this.drag = { id: p.id, y: p.y, s: this.scroll }; }
  pointerMove(p) { if (this.drag && this.drag.id === p.id) this.scroll = this.drag.s - (p.y - this.drag.y); }
  pointerUp() { this.drag = null; }
  keyDown(c) { if (c === 'ArrowDown') this.scroll += 60; if (c === 'ArrowUp') this.scroll -= 60; }
  update(dt) { this.t += dt; }
  draw(ctx) {
    const W = Game.W, H = Game.H;
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#f3ead2'); g.addColorStop(1, '#e2d3ad'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(120,90,50,0.12)'; ctx.lineWidth = 1; for (let y = 90; y < H; y += 34) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    const lw = Math.min(560, W * 0.58), rows = SPECIES_ORDER.length, contentH = 110 + rows * 40;
    this.scroll = clamp(this.scroll, 0, Math.max(0, contentH - H + 20));
    ctx.save(); ctx.beginPath(); ctx.rect(0, 80, W, H - 80); ctx.clip(); ctx.translate(0, -this.scroll);
    text(ctx, 'PERSONAL BESTS', 30, 112, { size: 15, color: '#7a5a2a', weight: 800 });
    SPECIES_ORDER.forEach((k, i) => {
      const y = 140 + i * 40, r = this.rec[k];
      ctx.globalAlpha = r ? 1 : 0.4;
      ctx.save(); ctx.translate(58, y); if (k === 'lobster') drawLobsterSide(ctx, 26, {}); else drawFish(ctx, k, 44, { wig: 0, sil: r ? null : '#8a7a5a' }); ctx.restore();
      text(ctx, r ? SPECIES[k].name : '???', 100, y + 6, { size: 18, color: '#2a2418', weight: 700 });
      if (r) {
        text(ctx, fmtLb(r.w), 100 + lw * 0.52, y + 6, { size: 18, color: '#b8401f', weight: 800 });
        text(ctx, CHARS[r.ch] ? CHARS[r.ch].name : r.ch, 100 + lw * 0.72, y + 6, { size: 16, color: '#2a2418', weight: 700 });
      }
      ctx.globalAlpha = 1;
    });
    ctx.restore();
    const tx = Math.min(W - 300, 100 + lw + 40), tw = W - tx - 24;
    if (tw > 200) {
      text(ctx, 'RECENT TRIPS', tx, 112, { size: 15, color: '#7a5a2a', weight: 800 });
      if (!this.trips.length) para(ctx, 'Finish a crew trip and it shows up here.', tx, 140, tw, { size: 16, color: '#4a3e2a', weight: 600 });
      this.trips.slice(0, 7).forEach((tr, i) => {
        const y = 140 + i * 56;
        text(ctx, new Date(tr.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), tx, y + 4, { size: 15, color: '#7a5a2a', weight: 700 });
        text(ctx, (CHARS[tr.winner] ? CHARS[tr.winner].name : tr.winner) + ' took it · ' + tr.crew.map((c) => (CHARS[c] ? CHARS[c].name : c) + ' ' + (tr.scores[c] || 0)).join(' · '), tx, y + 26, { size: 15, color: '#2a2418', weight: 700, maxW: tw });
      });
    }
    ctx.fillStyle = '#0c2734'; ctx.fillRect(0, 0, W, 80);
    text(ctx, 'Logbook', 30, 54, { display: true, size: 36, color: '#fff' });
    text(ctx, 'Saved on this device · ' + Object.keys(this.rec).length + ' of ' + SPECIES_ORDER.length + ' species · ' + Charts.known().size + ' of ' + SPOT_ORDER.length + ' spots found', 210, 52, { size: 15, color: '#9fb8c2', weight: 600, maxW: W - 380 });
    UI.button(ctx, 'back', W - 140, 18, 120, 44, 'Back', () => Game.go(new TitleScene()), { style: 'ghost', size: 18, key: 'Escape' });
  }
}

/* ================= HOW TO PLAY ================= */
const HOWTO = [
  { title: 'The trip', art: 'boat', lines: ['Crew Trip: pass one phone around. The captain drives the boat to a spot, then everyone fishes it.', 'Bigger fish and bigger bugs score more. Trophies, slams and clean releases add bonuses.', 'Full day is four spots, half day is two. Then run home at sunset. Most points is Captain of the Day.', 'Each angler has perks. Michael dives longer, Jorge gets more bites, Jemel reels harder.'] },
  { title: 'Running the boat', art: 'boat', lines: ['Hold and drag where you want the boat to go (or ← →). The throttle is on the right: STOP, IDLE, SLOW, CRUISE, FULL.', 'Open the Chart to pick a spot. Set course and the autopilot drives, and you can take over any time.', 'Watch the depth. Light water is shallow: slow down or you run aground. No-wake zones mean SLOW or FWC pulls you over.', 'Only four spots are charted. Find the rest by exploring: run past a ? on the chart to discover it.'] },
  { title: 'Bug Hunt', art: 'lobster', lines: ['Swim down and look for antennae poking out of holes. Not every hole has a bug in it.', 'Hold on the hole (or the TICKLE button) to coax the bug out. When it twitches, let go or it backs in.', 'When it walks out, click or tap the bug to swing your net. If it crouches, it’s about to tail-flip backward.', 'Pro move: put the net down behind it, and it flips right in. Gauge every bug: past the 3" gauge and no eggs.'] },
  { title: 'Bottom fishing', art: 'grouper', lines: ['Watch the fish finder on the right. Arches are fish (red means big), blue speckle is bait.', 'Drag up or down (or on the fish finder) to drop your bait to the marks. Squid for snapper, pinfish for grouper and jacks.', 'Small twitches are nibbles. Wait. When the rod slams down, tap to set the hook.', 'Nothing on the finder? Tap Move ◀ ▶ to idle along the ledge or the wreck until it lights up.'] },
  { title: 'Trolling', art: 'mahi', lines: ['Drag up and down to steer. Your lures follow the path the boat took.', 'Frigate birds and weed lines mean mahi. Diving terns and bait balls mean tuna.', 'The fish are out there, but you have to find them. Read the birds and the weed.', 'Trap floats wrap your prop and foul your lures. Tripletail like to hide under them.'] },
  { title: 'The backcountry', art: 'bonefish', lines: ['Your buddy poles the skiff (◀ ▶ at the bottom right) and calls fish by the clock: 12 is straight ahead.', 'Look for tails, wakes, mud puffs and rolling tarpon. Press and hold where you want the fly, then let go to cast.', 'Land it a few feet in front of the fish. Too close, behind it, or the line across its back, and it spooks.', 'Tap to strip in the fish’s rhythm. When it eats, tap to set. At the bridge, the tide carries your fly.'] },
  { title: 'Fighting a fish', art: 'fight', lines: ['Hold to reel. Keep the drag needle in the green.', 'When it runs, let go. Holding on a hard run snaps the line.', 'When it jumps, let go. That’s bowing to the fish, and it earns a bonus.', 'Too much slack and it spits the hook. Take too long and a shark might take it.'] }
];
class HowToScene {
  constructor() { this.t = 0; this.page = 0; }
  enter() { Music.play('title'); }
  update(dt) { this.t += dt; }
  keyDown(c) { if (c === 'ArrowRight') this.page = Math.min(HOWTO.length - 1, this.page + 1); if (c === 'ArrowLeft') this.page = Math.max(0, this.page - 1); }
  draw(ctx) {
    const W = Game.W, H = Game.H, P = HOWTO[this.page], t = this.t;
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0d5f86'); g.addColorStop(1, '#062a3f'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    text(ctx, P.title, 40, 70, { display: true, size: 44, color: '#fff' });
    text(ctx, (this.page + 1) + ' / ' + HOWTO.length, W - 40, 66, { size: 18, align: 'right', color: '#9fb8c2', weight: 700 });
    const ax = W * 0.74, ay = H * 0.46;
    drawSunburst(ctx, ax, ay, 220, t, 'rgba(255,200,69,0.1)');
    ctx.save(); ctx.translate(ax, ay);
    if (P.art === 'boat') drawBoatSide(ctx, 0, 60, 0.7, { crew: CHAR_ORDER, t });
    else if (P.art === 'lobster') drawLobsterSide(ctx, 150, { t });
    else if (P.art === 'grouper') drawFish(ctx, 'blackgrouper', 220, { t });
    else if (P.art === 'mahi') drawFish(ctx, 'mahi', 240, { t });
    else if (P.art === 'bonefish') drawFish(ctx, 'bonefish', 210, { t });
    else { drawFish(ctx, 'tarpon', 230, { t }); }
    ctx.restore();
    let y = 130; const mw = W * 0.56;
    P.lines.forEach((l) => { ctx.fillStyle = PAL.sun; ell(ctx, 50, y - 6, 5, 5); ctx.fill(); y += para(ctx, l, 66, y, mw - 30, { size: 19, weight: 600, color: '#fff', lh: 25 }) + 16; });
    UI.button(ctx, 'back', 30, H - 70, 120, 48, 'Done', () => Game.go(new TitleScene()), { style: 'ghost', size: 18, key: 'Escape' });
    // Done (Esc) always leaves; Previous / Next page through, and the last page's button leaves too
    UI.button(ctx, 'prev', W - 290, H - 70, 120, 48, 'Previous', () => (this.page = Math.max(0, this.page - 1)), { style: 'secondary', size: 18, disabled: this.page === 0 });
    if (this.page < HOWTO.length - 1) UI.button(ctx, 'next', W - 160, H - 70, 130, 48, 'Next', () => (this.page += 1), { style: 'primary', size: 18, key: 'Enter|Space' });
    else UI.button(ctx, 'next', W - 160, H - 70, 130, 48, 'Got it', () => Game.go(new TitleScene()), { style: 'primary', size: 18, key: 'Enter|Space' });
  }
}
