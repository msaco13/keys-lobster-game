'use strict';
/* Keys Crew — menus and the trip flow: title, crew pick, the chart, turn hand-offs,
   results, end of day, logbook, how to play. */

const SCENE_FOR = { bughunt: () => BugHuntScene, bottom: () => BottomScene, troll: () => TrollScene, flats: () => FlatsScene };
const WATER_F = [72, 72, 75, 78, 82, 85, 87, 88, 87, 84, 79, 75];

function launchTurn() {
  const c = Trip.cur; const ch = c.mode === 'crew' ? c.crew[c.turn] : c.crew[0];
  const S = SCENE_FOR[c.spot]();
  Game.go(new S({ ch, spot: c.spot, len: c.sessionLen, weather: c.weather, onEnd: (res) => { Trip.record(ch, c.spot, res); Game.go(new ResultsScene(ch, c.spot, res)); } }));
}
function afterResults() {
  const c = Trip.cur;
  if (c.mode === 'crew') {
    c.turn++;
    if (c.turn < c.crew.length) { Trip.save(); Game.go(new TurnIntroScene()); return; }
    if (!c.done.includes(c.spot)) c.done.push(c.spot);
    c.turn = 0; c.spot = null; Trip.save();
    Game.go(c.done.length >= c.spotsNeeded ? new DayEndScene() : new MapScene());
  } else { if (!c.done.includes(c.spot)) c.done.push(c.spot); c.spot = null; Game.go(new MapScene()); }
}
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
  enter() { SFX.setAmbient(0.7, false); }
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
      UI.button(ctx, 'resume', bx, y, bw, 56, 'Resume trip', () => { Trip.resume(); Game.go(Trip.cur.spot ? new TurnIntroScene() : new MapScene()); }, { style: 'coral', size: 22, sub: s.crew.map((c) => CHARS[c].name).join(', ') + ' · ' + s.done.length + '/' + s.spotsNeeded + ' spots' });
      y += 70;
    }
    UI.button(ctx, 'crew', bx, y, bw, 62, 'Crew Trip', () => Game.go(new CrewSetupScene()), { style: 'primary', size: 26, sub: 'Pass the phone · 1 to 3 players', key: 'Enter' }); y += 76;
    UI.button(ctx, 'solo', bx, y, bw, 52, 'Solo Day', () => Game.go(new SoloSetupScene()), { style: 'secondary', size: 22 }); y += 64;
    UI.button(ctx, 'log', bx, y, bw / 2 - 6, 46, 'Logbook', () => Game.go(new LogbookScene()), { style: 'ghost', size: 18 });
    UI.button(ctx, 'how', bx + bw / 2 + 6, y, bw / 2 - 6, 46, 'How to play', () => Game.go(new HowToScene()), { style: 'ghost', size: 18 });
    UI.button(ctx, 'snd', W - 64, H - 60, 48, 44, SFX.muted ? '🔇' : '🔊', () => SFX.setMuted(!SFX.muted), { style: 'dark', size: 18 });
    text(ctx, 'For Michael, Jorge & Jemel', W - 80, H - 32, { size: 16, align: 'right', color: '#fff', weight: 600, alpha: 0.85 });
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
  constructor() { this.t = 0; this.crew = new Set(CHAR_ORDER); this.plan = 'full'; this.len = 120; }
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
    UI.button(ctx, 'full', x0 + 244, oy, 170, 42, 'Full day · all 4', () => (this.plan = 'full'), { style: this.plan === 'full' ? 'primary' : 'ghost', size: 17 });
    text(ctx, 'TURNS', x0, oy + 80, { size: 15, color: '#cfe3ea', weight: 800 });
    [[90, '90 sec'], [120, '2 min'], [180, '3 min']].forEach(([v, l], i) => UI.button(ctx, 'len' + v, x0 + 64 + i * 112, oy + 54, 102, 42, l, () => (this.len = v), { style: this.len === v ? 'primary' : 'ghost', size: 17 }));
    const turns = (this.plan === 'full' ? 4 : 2) * this.crew.size, mins = Math.round((turns * this.len) / 60 + turns * 0.5);
    text(ctx, this.crew.size ? `${turns} turns · about ${mins} minutes` : 'Pick at least one angler', x0 + cw * 3 + gap * 2, oy + 26, { size: 16, align: 'right', color: '#cfe3ea', weight: 700 });
    UI.button(ctx, 'back', 20, H - 66, 120, 48, 'Back', () => Game.go(new TitleScene()), { style: 'ghost', size: 18, key: 'Escape' });
    UI.button(ctx, 'go', W - 240, H - 72, 220, 56, 'Cast off', () => {
      Trip.start({ mode: 'crew', crew: CHAR_ORDER.filter((c) => this.crew.has(c)), plan: this.plan, sessionLen: this.len });
      SFX.play('horn'); Game.go(new MapScene());
    }, { style: 'primary', size: 24, disabled: !this.crew.size, key: 'Enter' });
  }
}
class SoloSetupScene {
  constructor() { this.t = 0; this.ch = 'michael'; this.len = 120; }
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
    text(ctx, 'Fish any spot as many times as you like. Your best catches go in the logbook.', x0, oy + 76, { size: 16, color: '#cfe3ea', weight: 600, maxW: cw * 3 + gap * 2 });
    UI.button(ctx, 'back', 20, H - 66, 120, 48, 'Back', () => Game.go(new TitleScene()), { style: 'ghost', size: 18, key: 'Escape' });
    UI.button(ctx, 'go', W - 240, H - 72, 220, 56, 'Head out', () => { Trip.start({ mode: 'solo', crew: [this.ch], plan: 'solo', sessionLen: this.len }); SFX.play('horn'); Game.go(new MapScene()); }, { style: 'primary', size: 24, key: 'Enter' });
  }
}

/* ================= THE CHART ================= */
class MapScene {
  constructor() { this.t = 0; this.sel = null; this.travel = null; this.confirmQuit = false; this.buildChart(); }
  resize() { this.buildChart(); }
  pins() {
    const W = Game.W, H = Game.H;
    return { home: [W * 0.4, H * 0.42], flats: [W * 0.17, H * 0.3], bughunt: [W * 0.47, H * 0.58], bottom: [W * 0.6, H * 0.73], troll: [W * 0.77, H * 0.79] };
  }
  buildChart() {
    const W = Game.W, H = Game.H, c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'); const rng = mulberry(1913);
    const bg = g.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#bfe3df'); bg.addColorStop(0.45, '#9fd6e2'); bg.addColorStop(0.75, '#5fb0d4'); bg.addColorStop(1, '#2a74b0');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(20,50,120,0.35)'; g.beginPath(); g.moveTo(W, H * 0.62); g.quadraticCurveTo(W * 0.75, H * 0.85, W * 0.6, H); g.lineTo(W, H); g.fill();
    g.strokeStyle = 'rgba(30,80,110,0.18)'; g.lineWidth = 1;
    for (let k = 1; k <= 6; k++) { g.beginPath(); for (let x = 0; x <= W; x += 20) { const y = H * (0.1 + k * 0.13) + (x / W) * H * 0.35 - x * 0.18 + Math.sin(x * 0.02 + k) * 6; x === 0 ? g.moveTo(x, y) : g.lineTo(x, y); } g.stroke(); }
    g.fillStyle = '#7a9d63'; g.beginPath(); g.moveTo(0, 0); g.lineTo(W * 0.62, 0); g.quadraticCurveTo(W * 0.42, H * 0.06, W * 0.3, H * 0.09); g.quadraticCurveTo(W * 0.12, H * 0.14, 0, H * 0.16); g.fill();
    g.fillStyle = 'rgba(70,110,60,0.6)'; for (let i = 0; i < 18; i++) { ell(g, W * (0.05 + rng() * 0.3), H * (0.2 + rng() * 0.3), 4 + rng() * 10, 3 + rng() * 6, rng() * 3); g.fill(); }
    const keys = [[0.78, 0.04, 0.09], [0.66, 0.15, 0.1], [0.54, 0.27, 0.09], [0.44, 0.38, 0.06], [0.36, 0.47, 0.07], [0.27, 0.57, 0.07], [0.17, 0.68, 0.08], [0.08, 0.79, 0.07]];
    for (const [x, y, s] of keys) { g.save(); g.translate(W * x, H * y); g.rotate(-0.85); g.fillStyle = '#e8d9a8'; ell(g, 0, 0, W * s, H * 0.022); g.fill(); g.fillStyle = '#6e9c5c'; ell(g, 0, -1, W * s * 0.88, H * 0.014); g.fill(); g.restore(); }
    g.strokeStyle = 'rgba(120,70,40,0.55)'; g.setLineDash([3, 6]); g.lineWidth = 2; g.beginPath(); g.moveTo(W * 1.0, H * 0.32); g.quadraticCurveTo(W * 0.7, H * 0.62, W * 0.4, H * 0.98); g.stroke(); g.setLineDash([]);
    const lab = (s, x, y, o = {}) => { g.font = `${o.it ? 'italic ' : ''}${o.w || 600} ${o.size || 14}px ${FONT_UI}`; g.fillStyle = o.c || 'rgba(20,50,70,0.75)'; g.textAlign = 'center'; g.save(); g.translate(x, y); g.rotate(o.r || 0); g.fillText(s, 0, 0); g.restore(); };
    lab('KEY LARGO', W * 0.7, H * 0.08, { r: -0.62, size: 13, w: 800 }); lab('TAVERNIER', W * 0.38, H * 0.36, { r: -0.62, size: 13, w: 800 });
    lab('PLANTATION KEY', W * 0.26, H * 0.53, { r: -0.62, size: 12, w: 800 }); lab('ISLAMORADA', W * 0.13, H * 0.66, { r: -0.62, size: 13, w: 800 });
    lab('Florida Bay', W * 0.25, H * 0.22, { it: true, size: 22, c: 'rgba(20,60,80,0.45)' }); lab('Hawk Channel', W * 0.5, H * 0.47, { it: true, r: -0.62, size: 16, c: 'rgba(20,60,80,0.45)' });
    lab('reef line', W * 0.76, H * 0.48, { it: true, r: -0.85, size: 13, c: 'rgba(120,70,40,0.7)' }); lab('Atlantic Ocean', W * 0.8, H * 0.66, { it: true, size: 22, c: 'rgba(255,255,255,0.55)' });
    lab('Gulf Stream →', W * 0.92, H * 0.975, { it: true, size: 15, c: 'rgba(255,255,255,0.6)' });
    const cx = W - 70, cy = 150; g.strokeStyle = 'rgba(20,50,70,0.5)'; g.lineWidth = 1.5; ell(g, cx, cy, 34, 34); g.stroke();
    g.fillStyle = 'rgba(20,50,70,0.6)'; g.beginPath(); g.moveTo(cx, cy - 40); g.lineTo(cx + 7, cy); g.lineTo(cx, cy + 40); g.lineTo(cx - 7, cy); g.closePath(); g.fill(); lab('N', cx, cy - 46, { size: 14, w: 800 });
    this.chart = c;
  }
  update(dt) {
    this.t += dt;
    if (this.travel) { this.travel.t += dt; if (this.travel.t >= this.travel.dur) { const s = this.travel.spot; this.travel = null; Trip.cur.spot = s; Trip.cur.turn = 0; Trip.save(); Game.go(new TurnIntroScene()); } }
  }
  allowed(id) { const c = Trip.cur; if (c.mode === 'solo') return true; return !c.done.includes(id) && c.done.length < c.spotsNeeded; }
  draw(ctx) {
    const W = Game.W, H = Game.H, t = this.t, c = Trip.cur, P = this.pins();
    ctx.drawImage(this.chart, 0, 0, W, H);
    // home dock
    const [hx, hy] = P.home; ctx.fillStyle = PAL.ink; ell(ctx, hx, hy, 7, 7); ctx.fill(); ctx.fillStyle = '#fff'; ell(ctx, hx, hy, 3, 3); ctx.fill();
    text(ctx, 'Home dock', hx + 12, hy + 5, { size: 14, color: PAL.ink, weight: 800 });
    for (const id of SPOT_ORDER) {
      const [x, y] = P[id], S = SPOTS[id], done = c.done.includes(id), ok = this.allowed(id), selected = this.sel === id;
      ctx.strokeStyle = 'rgba(12,39,52,0.35)'; ctx.setLineDash([4, 6]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(x, y); ctx.stroke(); ctx.setLineDash([]);
      const r = selected ? 30 : 25, bob = selected ? Math.sin(t * 4) * 3 : 0;
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ell(ctx, x + 2, y + 5, r, r * 0.9); ctx.fill();
      ctx.fillStyle = done ? '#cfd8dc' : selected ? PAL.sun : '#ffffff'; ell(ctx, x, y + bob, r, r); ctx.fill();
      ctx.strokeStyle = done ? '#8aa' : PAL.coral; ctx.lineWidth = 4; ctx.stroke();
      ctx.save(); ctx.translate(x, y + bob); ctx.globalAlpha = done ? 0.5 : 1;
      if (id === 'bughunt') { ctx.rotate(-0.4); drawLobsterSide(ctx, 26, { t }); } else drawFish(ctx, id === 'troll' ? 'mahi' : id === 'flats' ? 'bonefish' : 'redgrouper', 34, { t, wig: 0.4 });
      ctx.restore();
      if (done) { ctx.fillStyle = PAL.good; ell(ctx, x + r * 0.7, y - r * 0.7, 11, 11); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + r * 0.7 - 5, y - r * 0.7); ctx.lineTo(x + r * 0.7 - 1, y - r * 0.7 + 4); ctx.lineTo(x + r * 0.7 + 5, y - r * 0.7 - 4); ctx.stroke(); }
      text(ctx, S.name, x, y + r + 20, { size: 16, align: 'center', color: '#fff', weight: 800, stroke: PAL.ink, sw: 5 });
      text(ctx, S.kind, x, y + r + 37, { size: 13, align: 'center', color: '#fff', weight: 700, stroke: PAL.ink, sw: 4, alpha: 0.9 });
      UI.region('pin-' + id, x - 40, y - 40, 80, 100, () => { if (!this.travel) { this.sel = id; SFX.play('tick'); } });
    }
    if (this.travel) {
      const k = easeInOut(this.travel.t / this.travel.dur), [tx, ty] = P[this.travel.spot];
      const bx = lerp(hx, tx, k), by = lerp(hy, ty, k); const ang = Math.atan2(ty - hy, tx - hx);
      drawBoatTop(ctx, bx, by, 0.32, ang, { crew: c.crew });
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; for (let i = 1; i < 6; i++) { const kk = Math.max(0, k - i * 0.03); ell(ctx, lerp(hx, tx, kk), lerp(hy, ty, kk), 3, 3); ctx.fill(); }
    }
    // header
    panel(ctx, 14, 12, Math.min(520, W - 300), 54, { r: 18 });
    text(ctx, dayLabel(), 32, 36, { size: 19, color: '#fff', weight: 800 });
    const wx = c.weather; text(ctx, `${wx.name} · wind ${wx.wind} · water ${WATER_F[new Date().getMonth()]}°F` + (wx.tag ? '  ' + wx.tag : ''), 32, 56, { size: 14, color: wx.id === 'glass' ? PAL.sun : '#cfe3ea', weight: 700, maxW: Math.min(520, W - 300) - 36 });
    this.drawBoard(ctx, W, H, c);
    if (this.sel && !this.travel) this.drawSpotCard(ctx, W, H, this.sel);
    else if (!this.travel) {
      const msg = c.mode === 'crew' ? (c.done.length ? 'Pick the next spot' : 'Pick a spot to run to') + ` · ${c.done.length}/${c.spotsNeeded} done` : 'Pick a spot. Fish it as often as you like.';
      panel(ctx, W / 2 - 220, H - 62, 440, 44, { r: 22 }); text(ctx, msg, W / 2, H - 34, { size: 18, align: 'center', color: '#fff', weight: 700 });
    }
    if (!this.travel) {
      if (this.confirmQuit) {
        panel(ctx, W / 2 - 200, H / 2 - 80, 400, 160, { r: 20 });
        text(ctx, c.mode === 'crew' ? 'End this trip?' : 'Head home?', W / 2, H / 2 - 36, { display: true, size: 28, align: 'center', color: '#fff' });
        UI.button(ctx, 'qyes', W / 2 - 180, H / 2 + 6, 170, 50, c.mode === 'crew' ? 'End trip' : 'Head home', () => { if (c.mode === 'crew') { Trip.clear(); Game.go(new TitleScene()); } else Game.go(new DayEndScene()); }, { style: 'coral', size: 19 });
        UI.button(ctx, 'qno', W / 2 + 10, H / 2 + 6, 170, 50, 'Keep fishing', () => (this.confirmQuit = false), { style: 'secondary', size: 19, key: 'Escape' });
      } else UI.button(ctx, 'quit', 14, H - 62, 140, 46, c.mode === 'crew' ? 'End trip' : 'Head home', () => (this.confirmQuit = true), { style: 'dark', size: 17 });
    }
  }
  drawBoard(ctx, W, H, c) {
    const bw = 230, bx = W - bw - 14, by = 12, rows = c.crew.length;
    panel(ctx, bx, by, bw, 46 + rows * 44, { r: 18 });
    text(ctx, c.mode === 'crew' ? 'TODAY’S BOARD' : 'TODAY', bx + 16, by + 28, { size: 14, color: '#cfe3ea', weight: 800 });
    const order = c.crew.slice().sort((a, b) => c.scores[b] - c.scores[a]);
    order.forEach((ch, i) => {
      const y = by + 50 + i * 44;
      crewAvatar(ctx, ch, bx + 34, y + 12, 17);
      if (i === 0 && c.scores[ch] > 0 && rows > 1 && c.scores[ch] > c.scores[order[1]]) drawCrown(ctx, bx + 34, y - 6, 9);
      text(ctx, CHARS[ch].name, bx + 60, y + 18, { size: 18, color: '#fff', weight: 800 });
      text(ctx, c.scores[ch].toLocaleString(), bx + bw - 16, y + 18, { size: 19, align: 'right', color: PAL.sun, weight: 800 });
    });
  }
  drawSpotCard(ctx, W, H, id) {
    const S = SPOTS[id], ok = this.allowed(id), c = Trip.cur;
    const cw = Math.min(560, W - 40), ch = 184, cx = W / 2 - cw / 2, cy = H - ch - 14;
    panel(ctx, cx, cy, cw, ch, { r: 20 });
    text(ctx, S.name, cx + 20, cy + 40, { display: true, size: 30, color: '#fff' });
    ctx.font = dfnt(30); const nw = ctx.measureText(S.name).width;
    text(ctx, S.kind.toUpperCase() + ' · ' + S.depth, cx + 30 + nw, cy + 38, { size: 15, color: PAL.coral, weight: 800 });
    para(ctx, S.blurb, cx + 20, cy + 68, cw - 210, { size: 15, weight: 500, color: '#dcebf0', lh: 19 });
    S.species.slice(0, 7).forEach((k, i) => { ctx.save(); ctx.translate(cx + 40 + i * 50, cy + ch - 26); if (k === 'lobster') drawLobsterSide(ctx, 24, {}); else drawFish(ctx, k, 40, { wig: 0 }); ctx.restore(); });
    UI.button(ctx, 'close', cx + cw - 44, cy + 10, 34, 34, '✕', () => (this.sel = null), { style: 'ghost', size: 16, r: 17, key: 'Escape' });
    if (ok) UI.button(ctx, 'go', cx + cw - 180, cy + ch - 70, 164, 56, c.mode === 'crew' ? 'Run there' : 'Fish it', () => { this.travel = { spot: id, t: 0, dur: 1.1 }; SFX.play('horn'); }, { style: 'primary', size: 22, key: 'Enter' });
    else text(ctx, c.done.includes(id) ? 'Already fished today' : 'Day’s spots are set', cx + cw - 20, cy + ch - 34, { size: 16, align: 'right', color: '#9fb8c2', weight: 700 });
  }
}

/* ================= TURN HAND-OFF ================= */
class TurnIntroScene {
  constructor() { this.t = 0; }
  update(dt) { this.t += dt; }
  draw(ctx) {
    const W = Game.W, H = Game.H, c = Trip.cur, ch = c.mode === 'crew' ? c.crew[c.turn] : c.crew[0], C = CHARS[ch], S = SPOTS[c.spot];
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
    UI.button(ctx, 'chart', 20, H - 60, 130, 44, 'Chart', () => { if (c.turn === 0) { c.spot = null; Trip.save(); } Game.go(new MapScene()); }, { style: 'ghost', size: 16, disabled: c.mode === 'crew' && c.turn > 0 });
  }
}

/* ================= RESULTS ================= */
class ResultsScene {
  constructor(ch, spot, res) { this.ch = ch; this.spot = spot; this.res = res; this.t = 0; this.parts = new Particles(); this.shown = 0; this.caption = res.best ? captionFor(res.best, Trip.cur.weather) : null; this.comments = randi(1, 9); }
  enter() {
    SFX.setAmbient(0.4, false);
    if (this.res.total > 0) this.parts.burst(Game.W * 0.72, 120, 40, { kind: 'confetti', color: [PAL.sun, PAL.coral, '#42d3c4', '#fff'], min: 100, max: 380, g: 400, lifeMin: 1.4, lifeMax: 2.4, sMin: 3, sMax: 6, drag: 0.5 });
  }
  update(dt) {
    this.t += dt; this.parts.update(dt);
    const n = Math.min(this.res.lines.length, Math.floor(this.t / 0.22));
    if (n > this.shown) { this.shown = n; SFX.play(this.res.lines[n - 1].pts < 0 ? 'warn' : 'tick'); }
  }
  nextLabel() {
    const c = Trip.cur;
    if (c.mode !== 'crew') return 'Back to the chart';
    if (c.turn + 1 < c.crew.length) return 'Next up: ' + CHARS[c.crew[c.turn + 1]].name;
    return c.done.length + 1 >= c.spotsNeeded && !c.done.includes(this.spot) ? 'Head home' : 'Back to the chart';
  }
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
      UI.button(ctx, 'next', 30, H - 70, Math.min(320, lw), 56, this.nextLabel(), () => afterResults(), { style: 'primary', size: 21, key: 'Enter|Space' });
    } else UI.region('skip', 0, 0, W, H, () => { this.t = 99; });
    const cx = W - cardW - 24;
    if (r.best) {
      const ch = bragCardHeight(cardW), s = Math.min(1, (H - 40) / ch);
      ctx.save(); ctx.translate(cx + cardW * (1 - s) / 2, 20); ctx.scale(s, s);
      drawBragCard(ctx, 0, 0, cardW, r.best, { t: this.t, under: this.spot === 'bughunt', place: this.spot === 'flats' ? 'Florida Bay' : this.spot === 'bughunt' ? 'Tavernier, Florida' : 'Florida Keys', crew: Trip.cur.crew, caption: this.caption, weather: Trip.cur.weather, comments: this.comments });
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
    SFX.play('slam'); SFX.setAmbient(0.6, false);
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
    UI.button(ctx, 'again', W / 2 - 250, H - 66, 160, 50, 'New trip', () => Game.go(new CrewSetupScene()), { style: 'primary', size: 19, key: 'Enter' });
    UI.button(ctx, 'log', W / 2 - 80, H - 66, 160, 50, 'Logbook', () => Game.go(new LogbookScene()), { style: 'secondary', size: 19 });
    UI.button(ctx, 'title', W / 2 + 90, H - 66, 160, 50, 'Title', () => Game.go(new TitleScene()), { style: 'ghost', size: 19 });
    this.parts.draw(ctx);
  }
}

/* ================= LOGBOOK ================= */
class LogbookScene {
  constructor() { this.t = 0; this.scroll = 0; this.drag = null; this.rec = Records.all(); this.trips = Records.trips(); this.onWheel = (e) => { this.scroll += e.deltaY * 0.6; }; }
  enter() { window.addEventListener('wheel', this.onWheel, { passive: true }); }
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
    text(ctx, 'Saved on this device', 210, 52, { size: 15, color: '#9fb8c2', weight: 600 });
    UI.button(ctx, 'back', W - 140, 18, 120, 44, 'Back', () => Game.go(new TitleScene()), { style: 'ghost', size: 18, key: 'Escape' });
  }
}

/* ================= HOW TO PLAY ================= */
const HOWTO = [
  { title: 'The trip', art: 'boat', lines: ['Crew Trip: pass one phone around. Everyone fishes each spot, then you run to the next.', 'Bigger fish and bigger bugs score more. Trophies, slams and clean releases add bonuses.', 'Full day is all four spots. Half day is two. Most points is Captain of the Day.', 'Each angler has perks. Michael dives longer, Jorge gets more bites, Jemel reels harder.'] },
  { title: 'Bug Hunt', art: 'lobster', lines: ['Swim down to the ledges and look for antennae poking out of holes.', 'Hold TICKLE to coax the bug out. When the antennae twitch, let go or it backs in.', 'Tap NET when the white ring shrinks onto the gold circle. Miss and it tail-flips away.', 'Gauge every bug: the carapace has to reach past the 3" gauge, and no eggs. FWC checks your bag.'] },
  { title: 'The Ledge', art: 'grouper', lines: ['Squid for snapper, live pinfish for grouper and amberjack.', 'Drag up or down to set your depth. Grouper live on the bottom by the ledge.', 'Small twitches are nibbles. Wait. When the rod slams down, tap to set the hook.', 'Hooked a grouper? Tap fast to pull it off the reef before it rocks you up.'] },
  { title: 'The Weedline', art: 'mahi', lines: ['Drag up and down to steer. Your lures follow the path the boat took.', 'Mahi hang under weedlines and floating logs. Birds mean tuna are feeding.', 'The blue-water edge holds wahoo, kingfish and sailfish.', 'Trap floats wrap your prop and foul your lures. Steer around them.'] },
  { title: 'Florida Bay', art: 'bonefish', lines: ['Your buddy on the pole calls out fish by the clock: 12 is straight ahead.', 'Press and hold where you want the fly. The circle tightens. Let go to cast.', 'Land it a few feet in front of the fish. Too close or behind it, and it spooks.', 'Tap to strip in the fish’s rhythm. When it eats, tap to set. Tarpon, bonefish and permit is a Grand Slam.'] },
  { title: 'Fighting a fish', art: 'fight', lines: ['Hold to reel. Keep the drag needle in the green.', 'When it runs, let go. Holding on a hard run snaps the line.', 'When it jumps, let go. That’s bowing to the fish, and it earns a bonus.', 'Too much slack and it spits the hook. Take too long and a shark might take it.'] }
];
class HowToScene {
  constructor() { this.t = 0; this.page = 0; }
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
    UI.button(ctx, 'prev', W - 290, H - 70, 120, 48, 'Back', () => (this.page = Math.max(0, this.page - 1)), { style: 'secondary', size: 18, disabled: this.page === 0 });
    if (this.page < HOWTO.length - 1) UI.button(ctx, 'next', W - 160, H - 70, 130, 48, 'Next', () => (this.page += 1), { style: 'primary', size: 18, key: 'Enter|Space' });
    else UI.button(ctx, 'next', W - 160, H - 70, 130, 48, 'Let’s fish', () => Game.go(new TitleScene()), { style: 'primary', size: 18, key: 'Enter|Space' });
  }
}
