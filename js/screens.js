'use strict';
/* Keys Crew — menus and the trip flow: title, crew pick, the day's briefing (weather and bounties),
   turn hand-offs, results, end of day, logbook, how to play. The boat ride between spots lives in sea.js. */

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

/* ---------- small drawing helpers for the menus ---------- */
const h01 = (i) => { const v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
// a rounded label; x is its left edge, y its middle. Returns its width.
function pill(ctx, s, x, y, o = {}) {
  const size = o.size || 12; ctx.font = fnt(size, 800);
  const w = Math.ceil(ctx.measureText(s).width) + (o.padX == null ? 8 : o.padX) * 2, h = o.h || size + 9;
  if (o.align === 'right') x -= w; else if (o.align === 'center') x -= w / 2;
  ctx.fillStyle = o.bg || PAL.sun; rr(ctx, x, y - h / 2, w, h, h / 2); ctx.fill();
  if (o.line) { ctx.strokeStyle = o.line; ctx.lineWidth = 1.5; ctx.stroke(); }
  text(ctx, s, x + w / 2, y + 0.5, { size, align: 'center', base: 'middle', color: o.color || PAL.ink, weight: 800 });
  return w;
}
function drawCheck(ctx, x, y, r, color = PAL.good) {
  ctx.fillStyle = color; ell(ctx, x, y, r, r); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(2, r * 0.26); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x - r * 0.45, y + r * 0.02); ctx.lineTo(x - r * 0.1, y + r * 0.38); ctx.lineTo(x + r * 0.5, y - r * 0.36); ctx.stroke();
}
function waterTemp() { return WATER_F[new Date().getMonth()]; }
// the spots a list of ids names, as far as this device knows them: undiscovered ones stay a mystery
function spotNames(ids, joiner = ' · ', lower = false) {
  if (!ids || !ids.length) return lower ? 'anywhere' : 'Anywhere';
  const known = Charts.known(), names = ids.filter((id) => known.has(id)).map((id) => SPOTS[id].name), hidden = ids.length - names.length;
  if (!names.length) return hidden > 1 ? hidden + ' uncharted spots' : (lower ? 'an' : 'An') + ' uncharted spot';
  return names.join(joiner) + (hidden ? joiner + '???' : '');
}
// a flat-colored copy of any drawing (a lobster still to be caught, say), cached. draw(g) draws centered on 0,0.
const SIL_CACHE = {};
function drawSilhouette(ctx, key, w, h, color, draw) {
  const id = key + '|' + Math.round(w) + '|' + color; let c = SIL_CACHE[id];
  if (!c) {
    c = document.createElement('canvas'); c.width = Math.ceil(w * 2); c.height = Math.ceil(h * 2);
    const g = c.getContext('2d'); g.scale(2, 2); g.translate(w / 2, h / 2); draw(g); draw(g);   // twice, so see-through parts come out solid
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
    SIL_CACHE[id] = c;
  }
  ctx.drawImage(c, -w / 2, -h / 2, w, h);
}
function drawGull(ctx, x, y, s, flap) {
  const f = Math.sin(flap) * 5 * s;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3 * s;
  ctx.beginPath(); ctx.moveTo(x - 16 * s, y - s + f); ctx.quadraticCurveTo(x - 7 * s, y - 8 * s - f * 0.6, x, y); ctx.quadraticCurveTo(x + 7 * s, y - 8 * s - f * 0.6, x + 16 * s, y - s + f); ctx.stroke();
  ctx.strokeStyle = '#2a2f36'; ctx.lineWidth = 2.6 * s;
  ctx.beginPath(); ctx.moveTo(x - 16 * s, y - s + f); ctx.lineTo(x - 12.5 * s, y - 3.6 * s + f * 0.6); ctx.moveTo(x + 16 * s, y - s + f); ctx.lineTo(x + 12.5 * s, y - 3.6 * s + f * 0.6); ctx.stroke();
  ctx.fillStyle = '#fff'; ell(ctx, x, y + 0.5 * s, 3 * s, 2 * s); ctx.fill();
}

/* ---------- bounties on screen ---------- */
function drawBountyIcon(ctx, icon, x, y, s, t = 0) {
  ctx.save(); ctx.translate(x, y);
  if (icon === 'lobster') { const L = s * (s < 50 ? 0.62 : 0.5); ctx.translate(-L * 0.62, L * 0.25); ctx.rotate(-0.2); drawLobsterSide(ctx, L, { t }); }
  else if (SPECIES[icon]) drawFish(ctx, icon, s, { t, wig: t ? 0.4 : 0 });
  else if (icon === 'jump') {
    ctx.strokeStyle = 'rgba(220,245,255,0.9)'; ctx.lineWidth = Math.max(1.5, s * 0.05);
    ctx.beginPath(); ctx.ellipse(0, s * 0.26, s * 0.42, s * 0.09, 0, 0, Math.PI); ctx.stroke();
    ctx.rotate(-0.6); drawFish(ctx, 'tarpon', s * 0.86, { t, wig: 0 });
  } else if (icon === 'trophy') {
    const k = s * 0.5; ctx.fillStyle = PAL.sun; ctx.strokeStyle = PAL.sunDeep; ctx.lineWidth = Math.max(1.2, k * 0.08);
    ctx.beginPath(); ctx.ellipse(-k * 0.5, -k * 0.35, k * 0.26, k * 0.24, 0, 0, TAU); ctx.moveTo(k * 0.76, -k * 0.35); ctx.ellipse(k * 0.5, -k * 0.35, k * 0.26, k * 0.24, 0, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-k * 0.52, -k * 0.62); ctx.lineTo(k * 0.52, -k * 0.62); ctx.quadraticCurveTo(k * 0.5, k * 0.1, 0, k * 0.2); ctx.quadraticCurveTo(-k * 0.5, k * 0.1, -k * 0.52, -k * 0.62); ctx.fill(); ctx.stroke();
    ctx.fillRect(-k * 0.08, k * 0.18, k * 0.16, k * 0.28); ctx.fillRect(-k * 0.34, k * 0.44, k * 0.68, k * 0.16);
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(-k * 0.3, -k * 0.54, k * 0.1, k * 0.4);
  } else if (icon === 'new') {
    const star = (cx, cy, r) => { ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU - Math.PI / 2, rr2 = i % 2 ? r * 0.32 : r; ctx.lineTo(cx + Math.cos(a) * rr2, cy + Math.sin(a) * rr2); } ctx.closePath(); ctx.fill(); };
    ctx.fillStyle = '#42d3c4'; star(-s * 0.06, s * 0.02, s * 0.34); ctx.fillStyle = PAL.sun; star(s * 0.27, -s * 0.2, s * 0.16); star(s * 0.22, s * 0.26, s * 0.1);
  } else if (icon === 'chart') {
    const k = s * 0.42; ctx.fillStyle = PAL.coral; ctx.beginPath(); ctx.arc(0, -k * 0.3, k * 0.62, Math.PI * 0.82, Math.PI * 2.18); ctx.lineTo(0, k * 0.95); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#8c2d14'; ctx.lineWidth = Math.max(1, k * 0.08); ctx.stroke();
    text(ctx, '?', 0, -k * 0.26, { size: Math.max(9, k * 0.95), align: 'center', base: 'middle', color: '#fff', weight: 800 });
  } else if (icon === 'five') {
    drawFish(ctx, 'yellowtail', s * 0.78, { wig: 0 });
    text(ctx, '×5', s * 0.3, s * 0.3, { size: Math.max(10, s * 0.36), align: 'center', base: 'middle', color: '#fff', weight: 800, stroke: PAL.ink, sw: 3 });
  } else if (icon === 'big') {
    drawFish(ctx, 'amberjack', s * 0.9, { wig: 0 });
    text(ctx, '50+', s * 0.26, s * 0.3, { size: Math.max(9, s * 0.3), align: 'center', base: 'middle', color: PAL.sun, weight: 800, stroke: PAL.ink, sw: 3 });
  } else { ctx.fillStyle = PAL.sun; ell(ctx, 0, 0, s * 0.3, s * 0.3); ctx.fill(); }
  ctx.restore();
}
/* The day's bounties as a compact list: status, icon, goal, who took it, bonus. Returns the height it used.
   The boat scene can call it in its chart panel. opts:
     bounties   the list (default: Trip.cur.bounties)
     spot       highlight the ones you can do at this spot, dim the rest
     only       'here' lists only the ones you can still do at opts.spot, 'open' only the ones nobody has taken
     title      heading text, or false for none (default "TODAY'S BOUNTIES")
     size       text size (15), rowH row height (2 × size)
     short      true for the short goal text (default: when w < 330)
     theme      'dark' (white text, default) or 'light' (ink text, for the paper logbook) */
function drawBountyList(ctx, x, y, w, opts = {}) {
  const list = opts.bounties || Bounties.list();
  if (!list.length) return 0;
  const light = opts.theme === 'light', size = opts.size || 15, rowH = opts.rowH || Math.round(size * 2);
  const ink = light ? '#2a2418' : '#ffffff', mute = light ? '#7a5a2a' : '#9fb8c2', gold = light ? '#b8401f' : PAL.sun;
  const rows = opts.only === 'here' && opts.spot ? list.filter((b) => Bounties.here(b, opts.spot)) : opts.only === 'open' ? list.filter((b) => !b.done) : list;
  const useShort = opts.short != null ? opts.short : w < 330;
  let yy = y;
  if (opts.title !== false) {
    const nHere = opts.spot ? list.filter((b) => Bounties.here(b, opts.spot)).length : 0;
    text(ctx, (opts.title || 'TODAY’S BOUNTIES') + '  ·  ' + list.filter((b) => b.done).length + '/' + list.length + ' DONE' + (opts.spot && opts.only !== 'here' ? '  ·  ' + (nHere ? nHere + ' YOU CAN GET HERE' : 'NONE HERE') : ''), x, yy + 11, { size: 13, color: mute, weight: 800, maxW: w });
    yy += 20;
  }
  const iconW = Math.round(size * 2);
  for (const b of rows) {
    const here = opts.spot ? Bounties.here(b, opts.spot) : !b.done, cy = yy + rowH / 2, dim = !b.done && opts.spot && !here;
    ctx.save(); if (dim) ctx.globalAlpha *= 0.5;
    if (b.done) drawCheck(ctx, x + 9, cy, 9);
    else { ctx.strokeStyle = here ? gold : mute; ctx.lineWidth = 2; ell(ctx, x + 9, cy, 8, 8); ctx.stroke(); }
    drawBountyIcon(ctx, b.icon, x + 26 + iconW / 2, cy, iconW);
    let rx = x + w;
    const bonusS = '+' + b.bonus; ctx.font = fnt(size, 800); const bw = ctx.measureText(bonusS).width;
    text(ctx, bonusS, rx, cy + size * 0.36, { size, align: 'right', color: b.done ? (light ? '#2a8a4a' : PAL.good) : here ? gold : mute, weight: 800 });
    rx -= bw + 8;
    if (b.done && b.by && CHARS[b.by]) { const ar = Math.round(size * 0.62); crewAvatar(ctx, b.by, rx - ar, cy, ar); rx -= ar * 2 + 6; }
    const tx = x + 30 + iconW, avail = Math.max(40, rx - tx - 4);
    let label = useShort ? b.short : b.text;
    if (!useShort) { ctx.font = fnt(size, 700); if (ctx.measureText(label).width > avail * 1.1) label = b.short; }   // the long goal only if it fits
    text(ctx, label, tx, cy + size * 0.36, { size, color: b.done ? mute : ink, weight: 700, maxW: avail });
    ctx.restore();
    yy += rowH;
  }
  return yy - y;
}
// a bounty just paid out somewhere other than a results screen (found a spot on the water, say)
function bountyToast(list) {
  if (!list || !list.length) return;
  for (const b of list) Game.toast('BOUNTY!', { color: PAL.sun, size: 44, y: 150, dur: 2.6, sub: b.short + ' · +' + b.bonus + (CHARS[b.by] ? ' for ' + CHARS[b.by].name : '') });
  SFX.play('trophy');
}

/* ================= TITLE ================= */
// The front door: a morning run down the Keys. The boat holds still on screen and the water, the wake,
// the far keys and the clouds slide past. Gulls follow the boat; now and then a fish jumps alongside.
const TITLE_LOOP = 2400;
const TITLE_FAR = [
  { k: 'key', x: 0, w: 300, h: 10, palms: [0.16, 0.3, 0.72], houses: [0.46, 0.55] },
  { k: 'bridge', x: 360, w: 560 },
  { k: 'key', x: 940, w: 170, h: 7, palms: [0.5] },
  { k: 'light', x: 1300 },
  { k: 'key', x: 1560, w: 400, h: 12, palms: [0.1, 0.22, 0.58, 0.83], houses: [0.36, 0.42, 0.7] },
  { k: 'key', x: 2080, w: 120, h: 6, palms: [0.4] }
];
function drawFarPalm(ctx, x, y, hgt, lean, t) {
  ctx.strokeStyle = '#3f6f60'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + lean * 0.4, y - hgt * 0.6, x + lean, y - hgt); ctx.stroke();
  ctx.fillStyle = '#3f6f60';
  for (let k = 0; k < 5; k++) { ctx.save(); ctx.translate(x + lean, y - hgt); ctx.rotate(-2.6 + k * 0.62 + Math.sin(t * 1.3 + k + x) * 0.06); ell(ctx, 5, 0, 6, 1.5); ctx.fill(); ctx.restore(); }
}
function drawFarThing(ctx, o, x, hz, t) {
  if (o.k === 'key') {
    const w = o.w, h = o.h;
    ctx.fillStyle = '#5a9483'; ctx.beginPath(); ctx.moveTo(x - 8, hz + 1);
    ctx.bezierCurveTo(x + w * 0.06, hz - h, x + w * 0.24, hz - h * 1.05, x + w * 0.5, hz - h); ctx.bezierCurveTo(x + w * 0.76, hz - h * 0.95, x + w * 0.94, hz - h, x + w + 8, hz + 1); ctx.closePath(); ctx.fill();
    for (const p of o.houses || []) { const hx = x + w * p; ctx.fillStyle = '#e9e4d8'; ctx.fillRect(hx, hz - h - 3, 8, 5); ctx.fillStyle = '#b5705a'; ctx.beginPath(); ctx.moveTo(hx - 1, hz - h - 3); ctx.lineTo(hx + 4, hz - h - 7); ctx.lineTo(hx + 9, hz - h - 3); ctx.fill(); }
    for (const p of o.palms || []) drawFarPalm(ctx, x + w * p, hz - h * 0.85, 12 + h * 0.9, 3 + (p * 10 % 3), t);
  } else if (o.k === 'bridge') {
    // the Overseas Highway: a long low span with a hump for the boats in the middle
    const w = o.w, deck = (u) => hz - 7 - 9 * Math.exp(-Math.pow((u - 0.55) / 0.08, 2));
    ctx.fillStyle = '#86a2ad';
    for (let px = 8; px < w; px += 15) { const y0 = deck(px / w); ctx.fillRect(x + px, y0, 1.6, hz - y0); }
    ctx.strokeStyle = '#7d98a4'; ctx.lineWidth = 2.4; ctx.beginPath();
    for (let px = 0; px <= w; px += 6) { const y0 = deck(px / w); if (px === 0) ctx.moveTo(x, y0); else ctx.lineTo(x + px, y0); }
    ctx.stroke();
  } else if (o.k === 'light') {
    // Alligator Reef Light: an iron skeleton tower standing in the water
    const s = 1.1, base = hz + 1;
    ctx.strokeStyle = '#55636b'; ctx.lineWidth = 1.4; ctx.beginPath();
    ctx.moveTo(x - 9 * s, base); ctx.lineTo(x - 3 * s, base - 46 * s); ctx.moveTo(x + 9 * s, base); ctx.lineTo(x + 3 * s, base - 46 * s);
    for (let i = 0; i < 4; i++) { const y1 = base - i * 11 * s, y2 = base - (i + 1) * 11 * s, k1 = 9 - i * 1.5, k2 = 9 - (i + 1) * 1.5; ctx.moveTo(x - k1 * s, y1); ctx.lineTo(x + k2 * s, y2); ctx.moveTo(x + k1 * s, y1); ctx.lineTo(x - k2 * s, y2); }
    ctx.stroke();
    ctx.fillStyle = '#3f4a52'; ctx.fillRect(x - 5 * s, base - 54 * s, 10 * s, 8 * s); ctx.fillRect(x - 2.5 * s, base - 60 * s, 5 * s, 6 * s);
    const glow = 0.5 + 0.5 * Math.sin(t * 2.2);
    ctx.fillStyle = `rgba(255,236,160,${0.35 + glow * 0.5})`; ell(ctx, x, base - 57 * s, 3 + glow * 2, 3 + glow * 2); ctx.fill();
  }
}
const TITLE_SEA = ['#5fb4d6', '#2b98c6', '#1a86b6', '#0d6a9a', '#0a5584'];
function titleSea(f) { f = clamp(f, 0, 1) * (TITLE_SEA.length - 1); const i = Math.min(TITLE_SEA.length - 2, Math.floor(f)); return mix(TITLE_SEA[i], TITLE_SEA[i + 1], f - i); }

class TitleScene {
  constructor() {
    this.t = 0; this.saved = Trip.load(); this.nSpecies = Object.keys(Records.all()).length;
    this.foam = []; this.foamT = 0; this.spray = new Particles(); this.splash = new Particles(); this.jump = null; this.nextJump = 3.2;
  }
  enter() { SFX.setAmbient(0.7, false); Music.play('title'); }
  layout() {
    const W = Game.W, H = Game.H, hz = Math.round(H * 0.55), s = clamp(W / 1150, 0.64, 0.9);
    const mx = Math.round(clamp(W * 0.04, 24, 52)), mw = Math.round(clamp(W * 0.29, 272, 330));
    const bx = Math.round(clamp(W * 0.69, mx + mw + 205 * s, W - 190 * s)), by = Math.round(hz + 66 * s + Math.sin(this.t * 2.3) * 2);
    const rot = -0.035 + Math.sin(this.t * 1.7) * 0.012 + Math.sin(this.t * 3.1) * 0.005;
    const toScreen = (px, py) => [bx + (px * Math.cos(rot) - py * Math.sin(rot)) * s, by + (px * Math.sin(rot) + py * Math.cos(rot)) * s];
    return { W, H, hz, s, mx, mw, bx, by, rot, toScreen, wl: by + 7 * s };
  }
  // how fast the water slides past at a given screen height (perspective: faster up close)
  seaSpeed(y, L) { return 20 + clamp((y - L.hz) / (L.H - L.hz), 0, 1) * 330 * L.s; }
  update(dt) {
    this.t += dt; const L = this.layout();
    // prop wash peels off the transom and drifts back
    const sx = L.toScreen(-176, 0)[0], sy = L.wl, v = this.seaSpeed(sy, L);
    this.foamT += dt;
    while (this.foamT > 1 / 50) { this.foamT -= 1 / 50; this.foam.push({ x: sx + rand(-8, 4), y: sy + rand(-1, 3), vx: -v * rand(0.8, 1.02), vy: rand(-3, 7), r: rand(3, 7) * L.s, g: rand(7, 16) * L.s, age: 0, life: rand(1.8, 3) }); }
    for (const f of this.foam) { f.age += dt; f.x += f.vx * dt; f.y += f.vy * dt; f.r += f.g * dt; }
    this.foam = this.foam.filter((f) => f.age < f.life && f.x > -80);
    // spray off the bow
    const fx = L.toScreen(112, 0)[0], fy = L.wl - 4;
    if (!Game.reduced) for (let i = 0; i < 2; i++) if (chance(dt * 22)) this.spray.add({ x: fx + rand(-14, 8) * L.s, y: fy, vx: rand(-90, 20), vy: -rand(70, 170) * L.s, g: 460, life: rand(0.45, 0.8), size: rand(1.2, 3), color: chance(0.5) ? '#ffffff' : '#dff4ff' });
    this.spray.update(dt); this.splash.update(dt);
    // a fish jumps now and then, racing the boat
    this.nextJump -= dt;
    if (!this.jump && this.nextJump <= 0 && !Game.reduced) {
      const key = pick(['mahi', 'sailfish', 'tarpon', 'mahi']), wy0 = L.wl + rand(34, 74) * L.s;
      const x0 = rand(Math.max(L.mx + L.mw + 120, L.bx - 40 * L.s), L.W - 90);
      this.jump = { key, x0, wy: wy0, t: 0, dur: rand(0.95, 1.25), h: rand(60, 100) * L.s, vx: rand(50, 95) * L.s, len: (key === 'sailfish' ? 118 : key === 'tarpon' ? 104 : 84) * L.s };
      this.splashAt(x0, wy0, 14);
    }
    if (this.jump) {
      const j = this.jump; j.t += dt;
      if (j.t >= j.dur) { this.splashAt(j.x0 + j.vx * j.dur, j.wy, 22); this.jump = null; this.nextJump = rand(5.5, 9); }
    }
  }
  splashAt(x, y, n) {
    this.splash.burst(x, y, n, { color: ['#ffffff', '#d6f3ff'], angle: -Math.PI / 2, spread: 0.85, min: 60, max: 190, g: 520, sMin: 1.5, sMax: 3.6, lifeMin: 0.4, lifeMax: 0.85 });
    this.splash.add({ kind: 'ring', x, y, size: 6, grow: 46, flat: 0.28, life: 0.9, color: 'rgba(255,255,255,0.7)', lw: 2, vx: -60 });
  }
  drawScene(ctx, L) {
    const { W, H, hz, s } = L, t = this.t;
    // sky and sun
    const sky = ctx.createLinearGradient(0, 0, 0, hz);
    sky.addColorStop(0, '#2a6fc0'); sky.addColorStop(0.5, '#6db7e6'); sky.addColorStop(0.86, '#c9e6f3'); sky.addColorStop(1, '#ffe7c2');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, hz + 1);
    const sunX = W * 0.8, sunY = hz * 0.4;
    drawSun(ctx, sunX, sunY, 28, '#fff8dc');
    for (const [k, y, sc, sp, a] of [[0.08, 0.2, 1.1, 5, 0.94], [0.47, 0.34, 0.72, 3.4, 0.86], [0.72, 0.13, 0.9, 4.4, 0.9], [0.3, 0.62, 0.48, 2, 0.7], [0.93, 0.57, 0.52, 2.3, 0.7]]) {
      const span = W + 300; drawCloud(ctx, ((k * span - t * sp) % span + span) % span - 150, hz * y, sc, a);
    }
    // frigate birds riding the wind way up
    for (let i = 0; i < 3; i++) { const span = W + 240, x = ((0.15 + i * 0.29) * span + t * (6 + i * 2.5)) % span - 120; drawFrigate(ctx, x, hz * (0.16 + i * 0.07) + Math.sin(t * 0.5 + i) * 6, 0.62 + i * 0.08, t * 1.5 + i * 2); }
    // the far keys, the bridge and the lighthouse slide past on the horizon
    for (const o of TITLE_FAR) {
      let x = ((o.x - t * 7) % TITLE_LOOP + TITLE_LOOP) % TITLE_LOOP - 220;
      for (; x < W + 40; x += TITLE_LOOP) drawFarThing(ctx, o, x, hz, t);
    }
    // the sea
    const sea = ctx.createLinearGradient(0, hz, 0, H);
    TITLE_SEA.forEach((c, i) => sea.addColorStop(i / (TITLE_SEA.length - 1), c));
    ctx.fillStyle = sea; ctx.fillRect(0, hz, W, H - hz);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(0, hz, W, 1.5);
    // sun glitter on the water below the sun
    for (let i = 0; i < 80; i++) {
      const f = (i + 0.5) / 80, d = Math.pow(f, 1.6), y = hz + 3 + d * (H - hz - 3), spread = 10 + d * 170;
      const x = sunX + (h01(i) - 0.5) * 2 * spread + Math.sin(t * 0.8 + i) * 4 - d * 30;
      const tw = Math.max(0, Math.sin(t * (2.2 + h01(i + 40) * 3) + i * 2.3)), a = tw * tw * (0.9 - d * 0.55);
      if (a < 0.04) continue;
      const len = 4 + d * 30; ctx.fillStyle = `rgba(255,250,228,${a.toFixed(3)})`; ctx.fillRect(x - len / 2, y, len, 1 + d * 2.2);
    }
    // wave crests (and troughs) slide back past the running boat
    ctx.lineCap = 'round';
    for (let j = 0; j < 28; j++) {
      const f = j / 27, d = Math.pow(f, 1.9), y = hz + 5 + d * (H - hz - 2), sp = this.seaSpeed(y, L), gap = 46 + d * 160, len = 8 + d * 50;
      const off = (t * sp + h01(j) * 997) % gap;
      for (const [col, dy, ph] of [['255,255,255', 0, 0], ['0,40,70', 3 + d * 5, 0.5]]) {
        ctx.strokeStyle = `rgba(${col},${(0.1 + d * 0.2) * (ph ? 0.6 : 1)})`; ctx.lineWidth = 1 + d * 1.8; ctx.beginPath();
        for (let x = -off + ((j * 0.37 + ph) % 1) * gap - gap; x < W + gap; x += gap) { ctx.moveTo(x, y + dy); ctx.quadraticCurveTo(x + len / 2, y + dy - 1.5 - d * 3, x + len, y + dy); }
        ctx.stroke();
      }
    }
  }
  // the V of the wake: two foamy arms streaming back from the transom
  drawWakeArm(ctx, L, slope, alpha) {
    const sx = L.toScreen(-170, 0)[0], sy = L.wl + 1, len = Math.max(220, sx + 40), t = this.t, N = 110;
    for (let k = 0; k < N; k++) {
      const u = (k + (t * 2.2) % 1) / N, x = sx - u * len, y = sy + u * len * slope + Math.sin(u * 40 - t * 7) * 1.2 * u;
      const a = Math.pow(1 - u, 1.15) * alpha * (0.75 + 0.25 * Math.sin(k * 2.7)); if (a < 0.02 || x < -30) continue;
      ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`; ell(ctx, x, y, (4 + u * 12) * L.s, (1.3 + u * 3) * L.s); ctx.fill();
    }
  }
  drawBoat(ctx, L) {
    const t = this.t, s = L.s;
    this.drawWakeArm(ctx, L, -0.03, 0.45);
    for (const f of this.foam) { const k = 1 - f.age / f.life; ctx.fillStyle = `rgba(255,255,255,${(Math.pow(k, 1.2) * 0.78).toFixed(3)})`; ell(ctx, f.x, f.y, f.r, f.r * 0.38); ctx.fill(); }
    // up on plane: everything under the surface is hidden, so the stern digs in and the bow rides up
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, L.W, L.wl + 1); ctx.clip();
    drawBoatSide(ctx, L.bx, L.by, s, { crew: CHAR_ORDER, rot: L.rot, t, flag: false });
    ctx.restore();
    // white water along the chine, heaviest at the transom, and a curl where the hull leaves the water
    for (let x = -186; x <= 112; x += 4) {
      const k = 1 - (x + 186) / 298, px = L.toScreen(x, 0)[0];
      ctx.fillStyle = `rgba(255,255,255,${(0.55 + 0.4 * k).toFixed(3)})`; ell(ctx, px, L.wl + Math.sin(x * 0.3 + t * 15) * 1.1, (3.5 + 5 * k) * s, (1.6 + 2.8 * k) * s); ctx.fill();
    }
    for (let i = 0; i < 4; i++) { const [px] = L.toScreen(-176 - i * 7, 0); ctx.fillStyle = 'rgba(255,255,255,0.8)'; ell(ctx, px + Math.sin(t * 13 + i) * 2, L.wl - 2 - i * 0.6 + Math.cos(t * 11 + i * 2) * 1.5, (7 - i) * s, (4 - i * 0.5) * s); ctx.fill(); }
    const [bx2] = L.toScreen(112, 0);
    ctx.fillStyle = 'rgba(255,255,255,0.88)'; ctx.beginPath(); ctx.moveTo(bx2 - 50 * s, L.wl + 1); ctx.quadraticCurveTo(bx2 - 10 * s, L.wl - 2 * s, bx2 + 6 * s, L.wl - 9 * s + Math.sin(t * 12) * 1.5); ctx.quadraticCurveTo(bx2 + 4 * s, L.wl - 1, bx2 + 18 * s, L.wl + 3 * s); ctx.quadraticCurveTo(bx2 - 20 * s, L.wl + 5 * s, bx2 - 50 * s, L.wl + 1); ctx.fill();
    this.spray.draw(ctx);
    this.drawWakeArm(ctx, L, 0.12, 0.7);
  }
  drawJump(ctx, L) {
    const j = this.jump;
    if (j) {
      const u = j.t / j.dur, x = j.x0 + j.vx * j.t, y = j.wy - 4 * j.h * u * (1 - u), vy = -4 * j.h * (1 - 2 * u) / j.dur;
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, L.W, j.wy); ctx.clip();
      ctx.translate(x, y); ctx.rotate(Math.atan2(vy, j.vx) * 0.8); drawFish(ctx, j.key, j.len, { t: this.t, wig: 0.7, speed: 16 });
      ctx.restore();
    }
    this.splash.draw(ctx);
  }
  draw(ctx) {
    const L = this.layout(), { W, H, mx, mw } = L, t = this.t;
    this.drawScene(ctx, L);
    this.drawBoat(ctx, L);
    this.drawJump(ctx, L);
    for (let i = 0; i < 2; i++) { const [gx, gy] = L.toScreen(-150 + i * 80 + Math.sin(t * 0.6 + i * 2) * 30, -262 + Math.cos(t * 0.9 + i) * 14 - i * 20); drawGull(ctx, gx, gy, 0.85 * L.s + 0.1, t * 7 + i * 1.7); }
    // the menu side: a soft shade so the buttons read over the water
    const sh = ctx.createLinearGradient(0, 0, mx + mw + 170, 0);
    sh.addColorStop(0, 'rgba(4,30,46,0.62)'); sh.addColorStop(0.62, 'rgba(4,30,46,0.42)'); sh.addColorStop(1, 'rgba(4,30,46,0)');
    ctx.fillStyle = sh; ctx.fillRect(0, 0, mx + mw + 170, H);
    // logo
    const ls = Math.round(clamp(W * 0.082, 64, 92));
    ctx.save(); ctx.translate(mx - 4, 74 + Math.sin(t * 1.3) * 1.5); ctx.rotate(-0.045);
    text(ctx, 'Keys Crew', 0, 0, { display: true, size: ls, base: 'middle', color: PAL.coral, stroke: PAL.ink, sw: 12, shadow: 'rgba(0,0,0,0.3)', sy: 6, sx: 2 });
    ctx.restore();
    text(ctx, 'Lobstering and fishing in the Florida Keys', mx + 2, 74 + ls * 0.62 + 10, { size: 19, color: '#fff', weight: 700, stroke: 'rgba(6,34,50,0.75)', sw: 5, maxW: Math.max(mw + 60, W * 0.46) });
    // the menu, centered in the space under the logo
    const saved = this.saved, h = (saved ? 72 : 0) + 76 + 64 + 50, top = Math.max(150, Math.round(lerp(150, H - 62 - h, saved ? 0.5 : 0.36)));
    let y = top;
    // the main way in breathes a little
    const glow = (bx, by, bw, bh, col) => { const k = 0.5 + 0.5 * Math.sin(t * 2.6); ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 12 + k * 18; ctx.fillStyle = col; rr(ctx, bx + 4, by + 6, bw - 8, bh - 6, 16); ctx.fill(); ctx.restore(); };
    if (saved) {
      const lead = saved.crew.length > 1 ? saved.crew.reduce((b, c) => ((saved.scores[c] || 0) > (saved.scores[b] || 0) ? c : b), saved.crew[0]) : null;
      glow(mx, y, mw, 60, 'rgba(255,106,61,0.85)');
      // a trip left mid-spot comes back to that angler's hand-off; otherwise back on the boat
      UI.button(ctx, 'resume', mx, y, mw, 60, 'Resume trip', () => { if (!Trip.resume()) { this.saved = null; return; } Game.go(Trip.cur.spot ? new TurnIntroScene() : new SeaScene()); },
        { style: 'coral', size: 23, sub: saved.crew.map((c) => CHARS[c].name).join(', ') + ' · ' + saved.done.length + '/' + saved.spotsNeeded + ' spots' + (lead && saved.scores[lead] > 0 ? ' · ' + CHARS[lead].name + ' leads' : ''), key: 'Enter' });
      y += 72;
    } else glow(mx, y, mw, 64, 'rgba(255,200,69,0.85)');
    UI.button(ctx, 'crew', mx, y, mw, 64, 'Crew Trip', () => Game.go(new CrewSetupScene()), { style: 'primary', size: 27, sub: 'Pass the phone · 1 to 3 players', key: saved ? undefined : 'Enter' }); y += 76;
    UI.button(ctx, 'solo', mx, y, mw, 52, 'Solo Day', () => Game.go(new SoloSetupScene()), { style: 'secondary', size: 22, sub: 'Fish the Keys your way' }); y += 64;
    const hw = (mw - 12) / 2;
    UI.button(ctx, 'log', mx, y, hw, 50, 'Logbook', () => Game.go(new LogbookScene()), { style: 'dark', size: 18, sub: this.nSpecies + ' / ' + SPECIES_ORDER.length + ' species' });
    UI.button(ctx, 'how', mx + hw + 12, y, hw, 50, 'How to play', () => Game.go(new HowToScene()), { style: 'dark', size: 18 });
    // what's new
    const ny = H - 30, nw = pill(ctx, 'NEW', mx, ny, { bg: PAL.coral, color: '#fff', size: 13, h: 22 });
    text(ctx, 'Drive anywhere in the Keys, find hidden spots, chase daily bounties', mx + nw + 10, ny + 5, { size: 15, color: '#fff', weight: 700, stroke: 'rgba(6,34,50,0.7)', sw: 4, maxW: W - 150 - mx - nw - 10 });
    // sound + music, and who it's for
    UI.button(ctx, 'snd', W - 64, H - 60, 48, 44, SFX.muted ? '🔇' : '🔊', () => SFX.setMuted(!SFX.muted), { style: 'dark', size: 18 });
    UI.button(ctx, 'mus', W - 120, H - 60, 48, 44, '♫', () => Music.setOn(!Music.on), { style: Music.on ? 'dark' : 'ghost', size: 20, color: Music.on ? '#fff' : '#9fb8c2' });
    text(ctx, 'For Michael, Jorge & Jemel', W - 20, 30, { size: 15, align: 'right', color: '#fff', weight: 700, stroke: 'rgba(6,34,50,0.55)', sw: 4 });
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
  // o: the picks to start from (coming back from the briefing keeps them)
  constructor(o = {}) { this.t = 0; this.crew = new Set(o.crew || CHAR_ORDER); this.plan = o.plan || 'full'; this.len = o.sessionLen || 120; this.saved = !!Trip.load(); }
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
    UI.button(ctx, 'go', W - 240, H - 72, 220, 56, 'Let’s go', () => {
      const o = { mode: 'crew', crew: CHAR_ORDER.filter((c) => this.crew.has(c)), plan: this.plan, sessionLen: this.len };
      Game.go(new BriefingScene(o, () => new CrewSetupScene(o)));
    }, { style: 'primary', size: 24, disabled: !this.crew.size, key: 'Enter', sub: this.saved ? 'Replaces your saved trip' : 'See today’s bounties' });
  }
}
class SoloSetupScene {
  constructor(o = {}) { this.t = 0; this.ch = (o.crew && o.crew[0]) || 'michael'; this.len = o.sessionLen || 120; }
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
    UI.button(ctx, 'go', W - 240, H - 72, 220, 56, 'Let’s go', () => {
      const o = { mode: 'solo', crew: [this.ch], plan: 'solo', sessionLen: this.len };
      Game.go(new BriefingScene(o, () => new SoloSetupScene(o)));
    }, { style: 'primary', size: 24, key: 'Enter', sub: 'See today’s bounties' });
  }
}

/* ================= THE BRIEFING: today's weather and bounties, then cast off ================= */
class BriefingScene {
  // o: the trip options from the setup screen. back: makes the setup screen to go back to.
  // The weather and the bounties are rolled here so they can be shown; the trip starts at Cast off.
  constructor(o, back) {
    this.o = o; this.back = back || (() => (o.mode === 'crew' ? new CrewSetupScene(o) : new SoloSetupScene(o)));
    this.t = 0; this.weather = rollWeather(); this.bounties = Bounties.roll(); this.ticks = 0;
    this.saved = o.mode === 'crew' && !!Trip.load();
  }
  enter() { Music.play('title'); SFX.setAmbient(0.5, false); }
  update(dt) {
    this.t += dt;
    const n = Math.min(this.bounties.length, Math.floor((this.t - 0.15) / 0.16) + 1);
    if (n > this.ticks) { this.ticks = n; SFX.play('tick'); }
  }
  castOff() {
    Trip.start(Object.assign({}, this.o, { weather: this.weather, bounties: this.bounties }));
    SFX.play('horn'); Game.go(new SeaScene());
  }
  draw(ctx) {
    const W = Game.W, H = Game.H, t = this.t, o = this.o, crew = o.mode === 'crew';
    oceanBackdrop(ctx, W, H, t, 'day'); ctx.fillStyle = 'rgba(4,28,40,0.62)'; ctx.fillRect(0, 0, W, H);
    text(ctx, 'Today’s bounties', W / 2, 50, { display: true, size: 36, align: 'center', color: '#fff' });
    const wx = this.weather;
    text(ctx, dayLabel() + '  ·  ' + wx.name + ', ' + wx.wind + '  ·  Water ' + waterTemp() + '°F', W / 2, 80, { size: 17, align: 'center', color: '#cfe3ea', weight: 700, maxW: W - 60 });
    // three cards, as tall as the wordiest one; the cards, the rules and the crew sit centered under the header
    const n = this.bounties.length, gap = 16, cw = Math.min(260, (W - 56 - gap * (n - 1)) / n), x0 = W / 2 - (cw * n + gap * (n - 1)) / 2;
    const whereOf = (b) => (b.id === 'newspot' ? 'Run past a ? on the chart' : spotNames(b.where));
    const lines = (s2, size, weight) => { ctx.font = fnt(size, weight); return wrapText(ctx, s2, cw - 36).length; };
    const ch = Math.max(212, ...this.bounties.map((b) => 160 + lines(b.text, 19, 800) * 22 + 2 + lines(whereOf(b), 14, 700) * 17 + 4));
    const y0 = Math.round(clamp(lerp(96, H - 84 - (ch + 74), 0.4), 96, 120));
    this.bounties.forEach((b, i) => {
      const k = easeBack(clamp((t - 0.15 - i * 0.16) / 0.38, 0, 1)); if (k <= 0) return;
      const x = x0 + i * (cw + gap), cx = x + cw / 2;
      ctx.save(); ctx.translate(cx, y0 + ch / 2); ctx.scale(k, k); ctx.translate(-cx, -(y0 + ch / 2));
      panel(ctx, x, y0, cw, ch, { r: 20, fill: 'rgba(8,44,62,0.94)', line: 'rgba(255,214,90,0.55)' });
      // the art on a little sunburst
      ctx.save(); rr(ctx, x + 10, y0 + 10, cw - 20, 104, 14); ctx.clip();
      const sg = ctx.createLinearGradient(0, y0 + 10, 0, y0 + 114); sg.addColorStop(0, '#1f8fbf'); sg.addColorStop(1, '#0c5f8a'); ctx.fillStyle = sg; ctx.fillRect(x + 10, y0 + 10, cw - 20, 104);
      drawSunburst(ctx, cx, y0 + 62, 150, t + i, 'rgba(255,214,90,0.13)');
      drawBountyIcon(ctx, b.icon, cx, y0 + 62, Math.min(130, cw * 0.56), t + i * 0.7);
      pill(ctx, '+' + b.bonus, x + cw - 18, y0 + 30, { size: 19, h: 30, padX: 11, align: 'right' });
      ctx.restore();
      const group = b.id === 'newspot' ? 'EXPLORE' : { bugs: 'BUG HUNT', reef: 'THE REEF', offshore: 'OFFSHORE', flats: 'BACKCOUNTRY', any: 'ANYWHERE' }[b.group] || '';
      text(ctx, group, x + 18, y0 + 136, { size: 13, color: PAL.coral, weight: 800 });
      const used = para(ctx, b.text, x + 18, y0 + 160, cw - 36, { size: 19, weight: 800, color: '#fff', lh: 22 });
      para(ctx, whereOf(b), x + 18, y0 + 160 + used + 2, cw - 36, { size: 14, weight: 700, color: '#9fd6e6', lh: 17 });
      ctx.restore();
    });
    // the rules, the crew and the plan
    const ry = y0 + ch + 32;
    text(ctx, crew && o.crew.length > 1 ? 'First one to finish a bounty takes the bonus. Pick your spots on the chart.' : 'Finish them for bonus points. Pick your spots on the chart.', W / 2, ry, { size: 17, align: 'center', color: '#fff', weight: 700, maxW: W - 60 });
    const plan = crew ? (o.plan === 'full' ? 'Full day · 4 spots' : 'Half day · 2 spots') : 'Solo day';
    const label = plan + ' · ' + fmtTime(o.sessionLen) + ' turns';
    ctx.font = fnt(15, 700); const lw = ctx.measureText(label).width, aw = o.crew.length * 30, tx = W / 2 - (aw + 10 + lw) / 2;
    o.crew.forEach((c, i) => crewAvatar(ctx, c, tx + 14 + i * 30, ry + 30, 13));
    text(ctx, label, tx + aw + 10, ry + 35, { size: 15, color: '#cfe3ea', weight: 700 });
    UI.button(ctx, 'back', 20, H - 66, 120, 48, 'Back', () => Game.go(this.back()), { style: 'ghost', size: 18, key: 'Escape' });
    UI.button(ctx, 'castoff', W - 240, H - 72, 220, 56, 'Cast off', () => this.castOff(), { style: 'primary', size: 24, key: 'Enter|Space', sub: this.saved ? 'Replaces your saved trip' : null });
  }
}

/* ================= TURN HAND-OFF ================= */
class TurnIntroScene {
  // who and where are fixed when the hand-off opens, so it still draws while fading out after Back to the boat clears the spot
  constructor() {
    const c = (this.c = Trip.cur); this.t = 0; this.spot = c.spot; this.turn = c.turn; this.ch = c.mode === 'crew' ? c.crew[c.turn] : c.crew[0];
    this.paid = Bounties.sync();   // a spot found on the way here pays its bounty, if the boat didn't already
  }
  enter() { Music.play('title'); if (this.paid.length) bountyToast(this.paid); }
  update(dt) { this.t += dt; }
  draw(ctx) {
    const W = Game.W, H = Game.H, c = this.c, ch = this.ch, C = CHARS[ch], S = SPOTS[this.spot];
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0d5f86'); g.addColorStop(1, '#062a3f'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const ax = W * 0.27, ay = H * 0.42;
    drawSunburst(ctx, ax, ay + 10, 380, this.t, rgba(C.color, 0.16));
    const pop = easeBack(Math.min(1, this.t / 0.4));
    ctx.save(); ctx.translate(ax, ay); ctx.scale(pop, pop); crewAvatar(ctx, ch, 0, 0, 104, { ring: C.color, bg: '#8fd3ee' }); ctx.restore();
    text(ctx, C.title, ax, ay + 142, { size: 20, align: 'center', color: C.color, weight: 800 });
    C.perkText.forEach((p, i) => text(ctx, p, ax, ay + 168 + i * 22, { size: 15, align: 'center', color: '#cfe3ea', weight: 600, maxW: W * 0.46 }));
    const x = W * 0.52, mw = W - x - 30;
    text(ctx, c.mode === 'crew' && c.crew.length > 1 ? 'Hand the phone to ' + C.name : 'You’re up', x, 92, { size: 20, color: '#cfe3ea', weight: 700, maxW: mw });
    text(ctx, C.name + '’s turn', x, 148, { display: true, size: 50, color: '#fff', maxW: mw });
    text(ctx, S.name + ' · ' + S.kind, x, 186, { size: 23, color: PAL.sun, weight: 800, maxW: mw });
    const tipH = para(ctx, S.tip, x, 218, mw, { size: 17, weight: 600, color: '#fff', lh: 22 });
    // the day's bounties, the ones you can get here lit up
    if (Bounties.list(c).length) {
      const ly = Math.max(282, 218 + tipH - 4), rowH = clamp(Math.floor((H - 128 - ly - 20) / Bounties.list(c).length), 22, 30);
      drawBountyList(ctx, x, ly, Math.min(mw, 470), { bounties: Bounties.list(c), spot: this.spot, size: rowH > 25 ? 15 : 14, rowH, title: 'BOUNTIES' });
    }
    // the board, for a crew
    if (c.mode === 'crew' && c.crew.length > 1) {
      const order = c.crew.slice().sort((a, b) => (c.scores[b] || 0) - (c.scores[a] || 0));
      let bx = W - 22;
      for (let i = order.length - 1; i >= 0; i--) {
        const k = order[i], s = (c.scores[k] || 0).toLocaleString(); ctx.font = fnt(16, 800); const sw = ctx.measureText(s).width;
        text(ctx, s, bx, 44, { size: 16, align: 'right', color: k === ch ? PAL.sun : '#fff', weight: 800 });
        crewAvatar(ctx, k, bx - sw - 18, 38, 13); bx -= sw + 46;
      }
    }
    UI.button(ctx, 'ready', x, H - 112, Math.min(280, mw), 64, 'I’m ready', () => launchTurn(), { style: 'primary', size: 26, key: 'Enter|Space', sub: fmtTime(c.sessionLen) + ' on the clock' });
    // before anyone has fished this spot the captain can still pick another one; after that, everyone fishes it.
    // Esc goes back a step: to the boat while that's open, otherwise out to the title (a crew trip stays saved).
    const canLeave = c.mode !== 'crew' || this.turn === 0;
    UI.button(ctx, 'menu', 20, 18, 96, 40, 'Title', () => Game.go(new TitleScene()), { style: 'ghost', size: 17, key: canLeave ? undefined : 'Escape' });
    if (canLeave) UI.button(ctx, 'chart', 20, H - 64, 170, 46, 'Back to the boat', () => { c.spot = null; c.turn = 0; Trip.save(); Game.go(new SeaScene()); }, { style: 'ghost', size: 17, key: 'Escape' });
  }
}

/* ================= RESULTS ================= */
const RESULT_SCALE = [523, 587, 659, 784, 880, 1046, 1175, 1318, 1568, 1760];   // C major pentatonic, climbing
class ResultsScene {
  // next: what advanceTrip() returned when the turn was counted. Without it (a results screen opened by hand)
  // the trip moves on when the player leaves this screen.
  constructor(ch, spot, res, next) {
    this.ch = ch; this.spot = spot; this.res = res; this.t = 0; this.parts = new Particles(); this.fl = new Floaters(); this.shown = 0; this.caption = res.best ? captionFor(res.best, Trip.cur.weather) : null; this.comments = randi(1, 9);
    const c = (this.c = Trip.cur); this.advanced = !!next; this.nextKind = next || tripNext(c);   // this.c: still drawable if the trip is cleared under us
    this.nextUp = this.nextKind === 'turn' ? c.crew[this.advanced ? c.turn : c.turn + 1] : null;
    // which lines get a badge: match each catch line to its catch, in order
    const pool = (res.catches || []).slice();
    this.badges = res.lines.map((l) => {
      if (!l.key) return null;
      const i = pool.findIndex((k) => k && k.key === l.key); if (i < 0) return null;
      const k = pool.splice(i, 1)[0];
      return k.isNew ? 'new' : k.pb ? 'pb' : null;
    });
    // the reveal: a beat per line, a longer one for a badge and a bounty
    let at = 0.1; this.revealAt = res.lines.map((l, i) => (at += l.bounty ? 0.5 : this.badges[i] ? 0.32 : 0.22));
    this.doneAt = at + 0.15;
    this.scroll = 0; this.target = 0; this.maxScroll = 0; this.drag = null; this.running = 0;
    this.onWheel = (e) => { if (this.t >= this.doneAt) this.target = clamp(this.target + e.deltaY * 0.6, 0, this.maxScroll); };
  }
  leave(toTitle) { if (this.left) return; this.left = true; if (!this.advanced) advanceTrip(); if (toTitle) Game.go(new TitleScene()); else goNext(this.nextKind); }
  enter() {
    SFX.setAmbient(0.4, false); Music.play('title'); window.addEventListener('wheel', this.onWheel, { passive: true });
    if (this.res.total > 0) this.parts.burst(Game.W * 0.72, 120, 40, { kind: 'confetti', color: [PAL.sun, PAL.coral, '#42d3c4', '#fff'], min: 100, max: 380, g: 400, lifeMin: 1.4, lifeMax: 2.4, sMin: 3, sMax: 6, drag: 0.5 });
  }
  exit() { window.removeEventListener('wheel', this.onWheel); }
  pointerDown(p) { if (this.t >= this.doneAt) this.drag = { id: p.id, y: p.y, s: this.target }; }
  pointerMove(p) { if (this.drag && this.drag.id === p.id) this.target = this.scroll = clamp(this.drag.s - (p.y - this.drag.y), 0, this.maxScroll); }
  pointerUp() { this.drag = null; }
  keyDown(c) { if (c === 'ArrowDown') this.target = clamp(this.target + 68, 0, this.maxScroll); if (c === 'ArrowUp') this.target = clamp(this.target - 68, 0, this.maxScroll); }
  update(dt) {
    this.t += dt; this.parts.update(dt); this.fl.update(dt);
    const lines = this.res.lines; let n = 0; while (n < lines.length && this.revealAt[n] <= this.t) n++;
    if (n > this.shown) {
      this.follow = true;
      const fresh = lines.slice(this.shown, n), bounty = fresh.some((l) => l.bounty), badge = this.badges.slice(this.shown, n).some(Boolean);
      this.shown = n;
      if (bounty) {
        SFX.play('trophy'); Game.vibrate([20, 30, 20]);
        const L = this.listBox(); this.parts.burst(L.x + L.w * 0.75, Math.min(L.bot - 20, L.top + n * L.rowH - this.target - 16), 34, { kind: 'confetti', color: [PAL.sun, PAL.coral, '#42d3c4', '#fff'], min: 80, max: 300, g: 380, lifeMin: 1, lifeMax: 1.8, sMin: 3, sMax: 5, drag: 0.6 });
      } else if (fresh[fresh.length - 1].pts < 0) SFX.play('warn');
      else {
        // each line rings a steel-pan note a step up the scale, like the tally climbing
        SFX.steel(RESULT_SCALE[Math.min(RESULT_SCALE.length - 1, n - 1)], 0, 0.07);
        if (badge) SFX.play('coin');
      }
    }
    if (!this.landed && this.t >= this.doneAt) { this.landed = true; this.pop = 0.35; if (this.res.lines.length) SFX.play('coin'); }
    if (this.pop) this.pop = Math.max(0, this.pop - dt);
    // the running total climbs with the lines; the list follows the newest line, then scrolls by hand
    const sum = lines.slice(0, this.shown).reduce((a, l) => a + l.pts, 0) + (this.shown >= lines.length ? this.res.total - lines.reduce((a, l) => a + l.pts, 0) : 0);
    this.running = Math.abs(sum - this.running) < 1 ? sum : approach(this.running, sum, 12, dt);
    if (this.t < this.doneAt) this.target = this.maxScroll;
    if (!this.drag) this.scroll = approach(this.scroll, this.target, 14, dt);
  }
  nextLabel() { return this.nextKind === 'turn' ? 'Next up: ' + CHARS[this.nextUp].name : this.nextKind === 'home' ? 'Run home' : 'Back to the boat'; }
  listBox() { const W = Game.W, H = Game.H, cardW = Math.min(330, W * 0.36), lw = W - cardW - 70; return { x: 30, w: lw, top: 98, bot: H - 146, rowH: 34, cardW }; }
  draw(ctx) {
    const W = Game.W, H = Game.H, C = CHARS[this.ch], r = this.res, L = this.listBox(), lw = L.w;
    const bgTop = '#0d5f86', bgBot = '#062a3f';
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, bgTop); g.addColorStop(1, bgBot); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    text(ctx, r.header || SPOTS[this.spot].name, 30, 50, { display: true, size: 34, color: '#fff', maxW: lw });
    text(ctx, C.name + ' · ' + SPOTS[this.spot].kind, 30, 78, { size: 17, color: C.color, weight: 800, maxW: lw });
    // the lines, in a box that scrolls once they're all in
    const n = this.shown, viewH = L.bot - L.top;
    this.maxScroll = Math.max(0, n * L.rowH - viewH);
    if (this.follow) { this.target = this.maxScroll; this.follow = false; }
    if (this.target > this.maxScroll) this.target = this.maxScroll;
    ctx.save(); ctx.beginPath(); ctx.rect(0, L.top - 4, L.x + lw + 12, viewH + 6); ctx.clip();
    for (let i = 0; i < n; i++) {
      const l = r.lines[i], y0 = L.top + i * L.rowH - this.scroll, y = y0 + L.rowH * 0.62;
      if (y0 > L.bot || y0 + L.rowH < L.top - 4) continue;
      const age = this.t - this.revealAt[i], k = easeOut(clamp(age / 0.28, 0, 1)), dx = (1 - k) * -22;
      ctx.save(); ctx.globalAlpha = k; ctx.translate(dx, 0);
      if (l.bounty) {
        ctx.fillStyle = 'rgba(255,200,69,0.16)'; rr(ctx, L.x - 6, y0 + 2, lw + 12, L.rowH - 4, 10); ctx.fill();
        ctx.strokeStyle = 'rgba(255,200,69,0.7)'; ctx.lineWidth = 1.5; ctx.stroke();
      }
      const iconKey = l.key || (l.bounty && BOUNTY_DEFS[l.bounty] ? BOUNTY_DEFS[l.bounty].icon : null);
      if (iconKey) drawBountyIcon(ctx, iconKey, 49, y - 6, 38);
      const tx = iconKey ? 80 : 30, badge = this.badges[i];
      const bLabel = badge === 'new' ? 'NEW SPECIES' : badge === 'pb' ? 'PERSONAL BEST' : null;
      ctx.font = fnt(12, 800); const bw = bLabel ? ctx.measureText(bLabel).width + 16 : 0;
      const ptsS = (l.pts > 0 ? '+' : '') + l.pts.toLocaleString(); ctx.font = fnt(19, 800); const pw = ctx.measureText(ptsS).width;
      const maxL = L.x + lw - pw - 14 - tx - (bLabel ? bw + 10 : 0);
      let label = l.label;
      if (l.bounty && BOUNTY_DEFS[l.bounty]) { ctx.font = fnt(18, 800); if (ctx.measureText(label).width > maxL * 1.12) label = 'Bounty · ' + BOUNTY_DEFS[l.bounty].short; }
      text(ctx, label, tx, y, { size: 18, color: l.pts < 0 ? '#ff9a8a' : l.bounty ? PAL.sun : '#fff', weight: l.bounty ? 800 : 600, maxW: maxL });
      const labW = ctx.measureText(label).width;
      if (bLabel) {
        const pk = easeBack(clamp((age - 0.12) / 0.3, 0, 1));
        if (pk > 0) { ctx.save(); const px = tx + Math.min(labW, maxL) + 10; ctx.translate(px + bw / 2, y - 6); ctx.scale(pk, pk); pill(ctx, bLabel, -bw / 2, 0, { size: 12, h: 21, bg: badge === 'new' ? '#42d3c4' : PAL.sun }); ctx.restore(); }
      }
      const pp = 1 + 0.25 * Math.max(0, 1 - age / 0.25);
      ctx.save(); ctx.translate(L.x + lw, y - 6); ctx.scale(pp, pp);
      text(ctx, ptsS, 0, 6, { size: 19, align: 'right', color: l.pts < 0 ? PAL.bad : PAL.sun, weight: 800 });
      ctx.restore();
      ctx.restore();
    }
    ctx.restore();
    // fade the list out under its edges when there's more to scroll
    const fade = (y, up) => {
      const a = hexRgb(bgTop), b = hexRgb(bgBot), c0 = a.map((v, i) => Math.round(lerp(v, b[i], y / H))).join(',');
      const gg = ctx.createLinearGradient(0, y, 0, y + (up ? 26 : -26)); gg.addColorStop(0, `rgba(${c0},1)`); gg.addColorStop(1, `rgba(${c0},0)`);
      ctx.fillStyle = gg; ctx.fillRect(0, up ? y : y - 26, L.x + lw + 12, 26);
    };
    if (this.scroll > 2) fade(L.top - 4, true);
    if (this.scroll < this.maxScroll - 2) fade(L.bot + 2, false);
    if (this.maxScroll > 0 && this.t >= this.doneAt) {
      const th = Math.max(30, viewH * viewH / (viewH + this.maxScroll)), ty = L.top + (viewH - th) * (this.scroll / this.maxScroll);
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; rr(ctx, L.x + lw + 8, ty, 4, th, 2); ctx.fill();
    }
    if (!r.lines.length) text(ctx, 'Skunked. The fish won this round.', 30, L.top + 22, { size: 20, color: '#cfe3ea', weight: 600 });
    // a short turn leaves room to see what's still up for grabs today
    const open = Bounties.open(this.c), listY = L.top + Math.max(1, n) * L.rowH + 18;
    if (this.t >= this.doneAt && open.length && listY + 20 + open.length * 28 <= L.bot) {
      ctx.save(); ctx.globalAlpha = clamp((this.t - this.doneAt) / 0.4, 0, 1);
      drawBountyList(ctx, L.x, listY, Math.min(lw, 470), { bounties: Bounties.list(this.c), only: 'open', title: 'STILL UP FOR GRABS', rowH: 28 });
      ctx.restore();
    }
    // the total, counting up
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(30, H - 132, lw, 2);
    text(ctx, 'Turn total', 30, H - 96, { size: 22, color: '#fff', weight: 800 });
    if (r.bounties && r.bounties.length && this.shown >= r.lines.length) text(ctx, '★ ' + r.bounties.length + (r.bounties.length > 1 ? ' bounties' : ' bounty'), 152, H - 96, { size: 16, color: PAL.sun, weight: 800 });
    const tp = 1 + 0.18 * Math.sin(Math.PI * clamp((this.pop || 0) / 0.35, 0, 1));
    ctx.save(); ctx.translate(30 + lw, H - 104); ctx.scale(tp, tp);
    text(ctx, Math.round(this.running).toLocaleString(), 0, 12, { size: 38, align: 'right', color: PAL.sun, weight: 800 });
    ctx.restore();
    const done = this.t >= this.doneAt;
    if (done) {
      const nw = Math.min(320, lw - 110), k = easeBack(clamp((this.t - this.doneAt) / 0.3, 0, 1));
      ctx.save(); ctx.globalAlpha = clamp(k, 0, 1); ctx.translate(0, (1 - k) * 16);
      UI.button(ctx, 'next', 30, H - 70, nw, 56, this.nextLabel(), () => this.leave(), { style: 'primary', size: 21, key: 'Enter|Space' });
      UI.button(ctx, 'title', 40 + nw, H - 66, 100, 48, 'Title', () => this.leave(true), { style: 'ghost', size: 17 });
      ctx.restore();
    } else UI.region('skip', 0, 0, W, H, () => { this.t = 99; });
    const cx = W - L.cardW - 24;
    if (r.best) {
      const bh = bragCardHeight(L.cardW), s = Math.min(1, (H - 40) / bh);
      ctx.save(); ctx.translate(cx + L.cardW * (1 - s) / 2, 20); ctx.scale(s, s);
      drawBragCard(ctx, 0, 0, L.cardW, r.best, { t: this.t, under: spotMode(this.spot) === 'bughunt', place: (SPOTS[this.spot] && SPOTS[this.spot].place) || 'Florida Keys', crew: this.c.crew, caption: this.caption, weather: this.c.weather, comments: this.comments });
      ctx.restore();
    } else {
      panel(ctx, cx, 40, L.cardW, 300, { r: 18 });
      ctx.save(); ctx.translate(cx + L.cardW / 2, 200); crewAvatar(ctx, this.ch, 0, -40, 70, { expr: 'smile' }); ctx.restore();
      text(ctx, 'Next time.', cx + L.cardW / 2, 290, { display: true, size: 28, align: 'center', color: '#fff' });
    }
    this.parts.draw(ctx); this.fl.draw(ctx);
  }
}

/* ================= END OF DAY ================= */
class DayEndScene {
  constructor() {
    this.t = 0; const c = Trip.cur; this.c = c; this.parts = new Particles();
    this.paid = Bounties.sync();
    this.order = c.crew.slice().sort((a, b) => c.scores[b] - c.scores[a]);
    const fish = c.catches.filter((k) => k.key !== 'lobster'), bugs = c.catches.filter((k) => k.key === 'lobster');
    const top = (arr, f) => arr.reduce((b, x) => (!b || f(x) > f(b) ? x : b), null);
    this.awards = [];
    const bf = top(fish, (x) => x.weight); if (bf) this.awards.push(['Biggest fish', bf.ch, bf.name + ' · ' + fmtLb(bf.weight)]);
    const bb = top(bugs, (x) => x.weight); if (bb) this.awards.push(['Biggest bug', bb.ch, (bb.cl ? bb.cl.toFixed(2) + '" · ' : '') + fmtLb(bb.weight)]);
    if (c.crew.length > 1) { const counts = {}; c.catches.forEach((k) => (counts[k.ch] = (counts[k.ch] || 0) + 1)); const mc = c.crew.reduce((b, ch) => ((counts[ch] || 0) > (counts[b] || 0) ? ch : b), c.crew[0]); if (counts[mc]) this.awards.push(['Most catches', mc, counts[mc] + ' landed']); }
    const firsts = c.catches.filter((k) => k.isNew); if (firsts.length && this.awards.length < 3) this.awards.push(['New in the logbook', firsts[0].ch, firsts.map((k) => SPECIES[k.key].short).filter((v, i, a) => a.indexOf(v) === i).join(', ')]);
    this.bounties = Bounties.list(c);
  }
  enter() {
    const c = this.c;
    if (c.mode === 'crew') { Records.addTrip({ date: c.date, crew: c.crew, scores: c.scores, winner: this.order[0], bounties: [this.bounties.filter((b) => b.done).length, this.bounties.length] }); Trip.clear(); }
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
    const hx = W * 0.5, hy = 122;
    if (c.crew.length > 1) {
      const a = this.order[0], b = this.order[1];
      ctx.save(); ctx.translate(hx - 90, hy + 40); drawTorso(ctx, CHARS[a], 0, 20, 90, 70); limb(ctx, [[30, 30], [62, -10], [84, -46]], 14, CHARS[a].shirt); drawHead(ctx, CHARS[a], 0, -8, 28, { expr: 'grin' }); ctx.restore();
      ctx.save(); ctx.translate(hx + 90, hy + 40); drawTorso(ctx, CHARS[b], 0, 20, 90, 70); limb(ctx, [[-30, 30], [-62, -10], [-84, -46]], 14, CHARS[b].sleeve === 'mahi' ? '#5ec05a' : CHARS[b].shirt); drawHead(ctx, CHARS[b], 0, -8, 28, { expr: CHARS[b].expr }); ctx.restore();
      const clap = Math.abs(Math.sin(t * 2.2));
      ctx.fillStyle = CHARS[a].skin; ell(ctx, hx - 6 - clap * 4, hy - 8, 11, 13); ctx.fill(); ctx.fillStyle = CHARS[b].skin; ell(ctx, hx + 6 + clap * 4, hy - 8, 11, 13); ctx.fill();
      if (clap < 0.2) { ctx.strokeStyle = PAL.sun; ctx.lineWidth = 3; for (let i = 0; i < 8; i++) { const an = (i / 8) * TAU; ctx.beginPath(); ctx.moveTo(hx + Math.cos(an) * 20, hy - 8 + Math.sin(an) * 20); ctx.lineTo(hx + Math.cos(an) * 32, hy - 8 + Math.sin(an) * 32); ctx.stroke(); } }
    } else { ctx.save(); ctx.translate(hx, hy + 30); crewAvatar(ctx, c.crew[0], 0, 0, 64, { expr: 'grin' }); ctx.restore(); }
    text(ctx, 'Out. 🙌', hx, 48, { display: true, size: 46, align: 'center', color: '#fff', stroke: '#1d1636', sw: 8 });
    text(ctx, 'Same crew. Same water. See you next season.', W / 2, 82, { size: 18, align: 'center', color: '#ffe3c0', weight: 700, alpha: 0.95 });
    // the day's bounties: a banner in front of the crew
    const by0 = 228, nb = this.bounties.length;
    if (nb) {
      const gap = 10, bw = Math.min(250, (W - 48 - gap * (nb - 1)) / nb), bx0 = W / 2 - (bw * nb + gap * (nb - 1)) / 2;
      this.bounties.forEach((b, i) => {
        const x = bx0 + i * (bw + gap), k = easeBack(clamp((t - 0.5 - i * 0.15) / 0.35, 0, 1)); if (k <= 0) return;
        ctx.save(); ctx.translate(x + bw / 2, by0 + 22); ctx.scale(k, k); ctx.translate(-(x + bw / 2), -(by0 + 22));
        panel(ctx, x, by0, bw, 44, { r: 14, fill: b.done ? 'rgba(20,70,52,0.94)' : 'rgba(7,30,46,0.88)', line: b.done ? 'rgba(60,207,124,0.8)' : 'rgba(255,255,255,0.16)' });
        if (b.done) drawCheck(ctx, x + 18, by0 + 22, 9); else { ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2; ell(ctx, x + 18, by0 + 22, 8, 8); ctx.stroke(); }
        ctx.save(); if (!b.done) ctx.globalAlpha *= 0.55; drawBountyIcon(ctx, b.icon, x + (bw >= 236 ? 50 : 45), by0 + 22, bw >= 236 ? 34 : 28); ctx.restore();
        const right = b.done && CHARS[b.by] ? '+' + b.bonus : 'missed', wide = bw >= 236;
        ctx.font = fnt(15, 800); const rw = ctx.measureText(right).width;
        text(ctx, right, x + bw - 12, by0 + 27, { size: 15, align: 'right', color: b.done ? PAL.sun : '#8aa2ad', weight: 800 });
        const tx2 = wide ? x + 74 : x + 66; let tw = x + bw - 20 - rw - tx2;
        if (wide && b.done && CHARS[b.by]) { crewAvatar(ctx, b.by, x + bw - rw - 30, by0 + 22, 11); tw -= 26; }
        text(ctx, b.short, tx2, by0 + 20, { size: 15, color: b.done ? '#fff' : '#b9cbd2', weight: 800, maxW: tw });
        text(ctx, b.done && CHARS[b.by] ? CHARS[b.by].name : 'Not today', tx2, by0 + 36, { size: 12, color: b.done ? '#9fe0b8' : '#8aa2ad', weight: 700, maxW: tw });
        ctx.restore();
      });
    }
    // standings
    const top = nb ? by0 + 56 : 262, rowH = 40, bw2 = Math.min(380, W * 0.42), bx = 24;
    panel(ctx, bx, top, bw2, 54 + this.order.length * rowH, { r: 18 });
    text(ctx, c.mode === 'crew' ? 'FINAL BOARD' : 'YOUR DAY', bx + 18, top + 26, { size: 15, color: '#cfe3ea', weight: 800 });
    this.order.forEach((ch, i) => {
      const y = top + 54 + i * rowH;
      crewAvatar(ctx, ch, bx + 38, y + 8, 17);
      const lead = this.order.length > 1 && c.scores[this.order[0]] > 0, tied = lead && c.scores[this.order[0]] === c.scores[this.order[1]];
      if (i === 0 && lead && !tied) drawCrown(ctx, bx + 38, y - 12, 10);
      text(ctx, CHARS[ch].name, bx + 66, y + (i === 0 && lead ? 4 : 14), { size: 19, color: '#fff', weight: 800 });
      if (i === 0 && lead) text(ctx, tied ? 'Tied at the top' : 'Captain of the Day', bx + 66, y + 22, { size: 13, color: PAL.sun, weight: 800 });
      text(ctx, c.scores[ch].toLocaleString(), bx + bw2 - 18, y + 15, { size: 23, align: 'right', color: PAL.sun, weight: 800 });
    });
    const ax = W - bw2 - 24, aw = W - ax - 24;
    panel(ctx, ax, top, aw, 54 + Math.max(1, this.awards.length) * rowH, { r: 18 });
    text(ctx, 'AWARDS', ax + 18, top + 26, { size: 15, color: '#cfe3ea', weight: 800 });
    if (!this.awards.length) text(ctx, 'No fish today. Same time next week?', ax + 18, top + 72, { size: 17, color: '#fff', weight: 600, maxW: aw - 36 });
    this.awards.forEach(([title, ch, detail], i) => {
      const y = top + 54 + i * rowH; crewAvatar(ctx, ch, ax + 36, y + 8, 16);
      text(ctx, title + ': ' + CHARS[ch].name, ax + 62, y + 6, { size: 17, color: '#fff', weight: 800, maxW: aw - 76 });
      text(ctx, detail, ax + 62, y + 24, { size: 13, color: '#cfe3ea', weight: 600, maxW: aw - 76 });
    });
    const solo = c.mode !== 'crew';
    UI.button(ctx, 'again', W / 2 - 250, H - 62, 160, 48, solo ? 'New day' : 'New trip', () => Game.go(solo ? new SoloSetupScene() : new CrewSetupScene()), { style: 'primary', size: 19, key: 'Enter' });
    UI.button(ctx, 'log', W / 2 - 80, H - 62, 160, 48, 'Logbook', () => Game.go(new LogbookScene()), { style: 'secondary', size: 19 });
    UI.button(ctx, 'title', W / 2 + 90, H - 62, 160, 48, 'Title', () => Game.go(new TitleScene()), { style: 'ghost', size: 19, key: 'Escape' });
    this.parts.draw(ctx);
  }
}

/* ================= LOGBOOK: the collection ================= */
function logGroups() {
  const iOff = SPECIES_ORDER.indexOf('bonita'), iBack = SPECIES_ORDER.indexOf('bonefish');
  if (iOff < 0 || iBack < iOff) return [{ name: 'Species', keys: SPECIES_ORDER }];
  return [{ name: 'The reef, the ledge and the wreck', keys: SPECIES_ORDER.slice(0, iOff) }, { name: 'Offshore', keys: SPECIES_ORDER.slice(iOff, iBack) }, { name: 'The backcountry and the bridges', keys: SPECIES_ORDER.slice(iBack) }];
}
const LOG_INK = '#2a2418', LOG_BROWN = '#7a5a2a', LOG_RED = '#b8401f';
class LogbookScene {
  constructor() {
    this.t = 0; this.scroll = 0; this.target = 0; this.vel = 0; this.drag = null; this.maxScroll = 0;
    this.rec = Records.all(); this.trips = Records.trips(); this.known = Charts.known(); this.found = new Set(Store.get('charted', []));
    this.onWheel = (e) => { this.vel = 0; this.target = clamp(this.target + e.deltaY * (e.deltaMode === 1 ? 30 : 0.9), 0, this.maxScroll); };
  }
  enter() { window.addEventListener('wheel', this.onWheel, { passive: true }); Music.play('title'); }
  exit() { window.removeEventListener('wheel', this.onWheel); }
  pointerDown(p) { this.vel = 0; this.drag = { id: p.id, y: p.y, s: this.target, ly: p.y, lt: performance.now(), v: 0 }; }
  pointerMove(p) {
    const d = this.drag; if (!d || d.id !== p.id) return;
    const now = performance.now(), dt = Math.max(1, now - d.lt) / 1000;
    d.v = lerp(d.v, -(p.y - d.ly) / dt, 0.4); d.ly = p.y; d.lt = now;
    this.target = this.scroll = clamp(d.s - (p.y - d.y), 0, this.maxScroll);
  }
  pointerUp(p) { const d = this.drag; if (d && d.id === p.id) { if (performance.now() - d.lt < 90) this.vel = clamp(d.v, -2600, 2600); this.drag = null; } }
  keyDown(c) {
    const page = Game.H - 140;
    const step = { ArrowDown: 70, ArrowUp: -70, PageDown: page, PageUp: -page, Space: page }[c];
    if (step) { this.vel = 0; this.target = clamp(this.target + step, 0, this.maxScroll); }
    if (c === 'Home') this.target = 0; if (c === 'End') this.target = this.maxScroll;
  }
  update(dt) {
    this.t += dt;
    if (this.drag) return;
    if (Math.abs(this.vel) > 20) { this.target = clamp(this.target + this.vel * dt, 0, this.maxScroll); this.vel *= Math.exp(-3.2 * dt); if (this.target <= 0 || this.target >= this.maxScroll) this.vel = 0; } else this.vel = 0;
    this.scroll = approach(this.scroll, this.target, 16, dt);
  }
  sectionHead(ctx, label, right, x, y, w) {
    text(ctx, label, x, y, { size: 15, color: LOG_BROWN, weight: 800 });
    if (right) text(ctx, right, x + w, y, { size: 14, align: 'right', color: LOG_BROWN, weight: 700 });
    ctx.fillStyle = 'rgba(122,90,42,0.35)'; ctx.fillRect(x, y + 8, w, 1.5);
  }
  drawSpot(ctx, id, x, y, w, h) {
    const S = SPOTS[id], known = this.known.has(id), t = this.t;
    ctx.save();
    ctx.fillStyle = known ? 'rgba(255,252,240,0.7)' : 'rgba(122,90,42,0.07)'; rr(ctx, x, y, w, h, 12); ctx.fill();
    ctx.strokeStyle = known ? 'rgba(122,90,42,0.35)' : 'rgba(122,90,42,0.4)'; ctx.lineWidth = 1.5; if (!known) ctx.setLineDash([5, 4]); ctx.stroke(); ctx.setLineDash([]);
    const ix = x + 34, iy = y + h / 2;
    if (known) {
      ctx.save(); ctx.translate(ix, iy); if (S.mode === 'bughunt') { ctx.rotate(-0.3); drawLobsterSide(ctx, 30, {}); } else drawFish(ctx, S.species[0], 50, { wig: 0 }); ctx.restore();
      text(ctx, S.name, x + 66, y + 30, { size: 16, color: LOG_INK, weight: 800, maxW: w - 74 });
      text(ctx, S.kind + ' · ' + S.depth, x + 66, y + 48, { size: 13, color: LOG_BROWN, weight: 700, maxW: w - 74 });
      const mine = this.found.has(id) && !S.charted;
      text(ctx, mine ? '✓ Found it' : '✓ On the chart', x + 66, y + 67, { size: 13, color: '#2a8a4a', weight: 800 });
    } else {
      ctx.fillStyle = 'rgba(122,90,42,0.18)'; ell(ctx, ix, iy, 19, 19); ctx.fill();
      text(ctx, '?', ix, iy + 1, { size: 24, align: 'center', base: 'middle', color: LOG_BROWN, weight: 800 });
      text(ctx, '???', x + 66, y + 30, { size: 16, color: LOG_BROWN, weight: 800 });
      text(ctx, 'Not found yet', x + 66, y + 48, { size: 13, color: LOG_BROWN, weight: 700 });
      text(ctx, 'Run past a ? on the chart', x + 66, y + 67, { size: 12, color: 'rgba(122,90,42,0.75)', weight: 600, maxW: w - 74 });
    }
    ctx.restore();
  }
  drawSpecies(ctx, k, x, y, w, h) {
    const sp = SPECIES[k], r = this.rec[k];
    ctx.fillStyle = r ? 'rgba(255,252,240,0.78)' : 'rgba(122,90,42,0.07)'; rr(ctx, x, y, w, h, 12); ctx.fill();
    ctx.strokeStyle = 'rgba(122,90,42,0.3)'; ctx.lineWidth = 1.5; ctx.stroke();
    const cx = x + w / 2, fy = y + 40, len = Math.min(w * 0.62, 104);
    ctx.save(); rr(ctx, x + 2, y + 2, w - 4, 66, 10); ctx.clip(); ctx.translate(cx, fy);
    if (k === 'lobster') { const L = len * 0.54; ctx.translate(-L * 0.78, 8); ctx.rotate(-0.12); if (r) drawLobsterSide(ctx, L, {}); else drawSilhouette(ctx, 'lobster' + L, L * 4.4, L * 2.2, '#c9b68c', (g) => drawLobsterSide(g, L, {})); }
    else drawFish(ctx, k, len, { wig: 0, sil: r ? null : '#c9b68c' });
    ctx.restore();
    if (sp.rare) pill(ctx, 'RARE', x + w - 8, y + 15, { size: 10, h: 16, padX: 6, bg: r ? PAL.coral : 'rgba(184,64,31,0.45)', color: '#fff', align: 'right' });
    if (r) {
      if (sizeNorm(k, r.w) >= 0.72) pill(ctx, 'TROPHY', x + 8, y + 15, { size: 10, h: 16, padX: 6, bg: PAL.sun, color: PAL.ink });
      text(ctx, sp.name, cx, y + 82, { size: 15, align: 'center', color: LOG_INK, weight: 800, maxW: w - 14 });
      const who = CHARS[r.ch] ? CHARS[r.ch].name : r.ch, wS = fmtLb(r.w); ctx.font = fnt(16, 800); const ww = ctx.measureText(wS).width; ctx.font = fnt(13, 700); const nw = ctx.measureText(who).width;
      const tot = ww + 10 + 20 + nw, sx = cx - tot / 2;
      text(ctx, wS, sx, y + 104, { size: 16, color: LOG_RED, weight: 800 });
      if (CHARS[r.ch]) crewAvatar(ctx, r.ch, sx + ww + 18, y + 99, 9);
      text(ctx, who, sx + ww + 30, y + 104, { size: 13, color: LOG_INK, weight: 700 });
      if (r.date) text(ctx, new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), cx, y + 121, { size: 11, align: 'center', color: LOG_BROWN, weight: 600 });
    } else {
      text(ctx, '???', cx, y + 82, { size: 15, align: 'center', color: LOG_BROWN, weight: 800 });
      ctx.font = fnt(12, 600); const lines = wrapText(ctx, 'Lives at ' + spotNames(SPOT_ORDER.filter((s) => SPOTS[s].species.includes(k)), ', ', true), w - 16).slice(0, 2);
      lines.forEach((l, i) => text(ctx, l, cx, y + 102 + i * 15, { size: 12, align: 'center', color: 'rgba(122,90,42,0.85)', weight: 600, maxW: w - 12 }));
    }
  }
  drawTrip(ctx, tr, x, y, w, h) {
    ctx.fillStyle = 'rgba(255,252,240,0.7)'; rr(ctx, x, y, w, h, 12); ctx.fill(); ctx.strokeStyle = 'rgba(122,90,42,0.3)'; ctx.lineWidth = 1.5; ctx.stroke();
    const win = tr.winner, name = (k) => (CHARS[k] ? CHARS[k].name : k);
    if (CHARS[win]) { crewAvatar(ctx, win, x + 32, y + h / 2 + 3, 18); if (tr.crew && tr.crew.length > 1) drawCrown(ctx, x + 32, y + h / 2 - 15, 9); }
    let right = x + w - 14;
    if (tr.bounties && tr.bounties[1]) { const bw = pill(ctx, '★ ' + tr.bounties[0] + '/' + tr.bounties[1], right, y + 24, { size: 12, h: 20, align: 'right', bg: tr.bounties[0] ? PAL.sun : 'rgba(122,90,42,0.2)', color: tr.bounties[0] ? PAL.ink : LOG_BROWN }); right -= bw + 8; }
    text(ctx, (tr.crew && tr.crew.length > 1 ? name(win) + ' took the day' : name(win) + '’s day'), x + 62, y + 28, { size: 16, color: LOG_INK, weight: 800, maxW: right - x - 66 });
    const date = new Date(tr.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    text(ctx, date + ' · ' + (tr.crew || []).map((k) => name(k) + ' ' + (tr.scores[k] || 0).toLocaleString()).join(' · '), x + 62, y + 50, { size: 13, color: LOG_BROWN, weight: 700, maxW: x + w - 14 - x - 62 });
  }
  draw(ctx) {
    const W = Game.W, H = Game.H, top = 78, pad = 24, cw = W - pad * 2;
    if (this.drawn) { this.target = clamp(this.target, 0, this.maxScroll); this.scroll = clamp(this.scroll, 0, this.maxScroll); }
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#f3ead2'); g.addColorStop(1, '#e2d3ad'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.beginPath(); ctx.rect(0, top, W, H - top); ctx.clip(); ctx.translate(0, -Math.round(this.scroll));
    const view0 = this.scroll + top - 140, view1 = this.scroll + H + 20;   // cull what's off screen
    ctx.strokeStyle = 'rgba(120,90,50,0.1)'; ctx.lineWidth = 1;
    for (let ly = top + 34 * Math.floor((this.scroll) / 34) + 20; ly < this.scroll + H; ly += 34) { ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(W, ly); ctx.stroke(); }
    let y = top + 30;
    // spots
    const nKnown = SPOT_ORDER.filter((id) => this.known.has(id)).length;
    this.sectionHead(ctx, 'SPOTS', nKnown + ' of ' + SPOT_ORDER.length + ' on the chart', pad, y, cw); y += 20;
    const sg = 12, scols = [9, 5, 3].find((c) => (cw - sg * (c - 1)) / c >= 168) || 3, sw = (cw - sg * (scols - 1)) / scols, sh = 84;
    SPOT_ORDER.forEach((id, i) => { const sx = pad + (i % scols) * (sw + sg), sy = y + Math.floor(i / scols) * (sh + sg); if (sy + sh > view0 && sy < view1) this.drawSpot(ctx, id, sx, sy, sw, sh); });
    y += Math.ceil(SPOT_ORDER.length / scols) * (sh + sg) + 26;
    // species, by where they live
    const nCaught = SPECIES_ORDER.filter((k) => this.rec[k]).length;
    this.sectionHead(ctx, 'SPECIES', nCaught + ' of ' + SPECIES_ORDER.length + ' caught', pad, y, cw); y += 18;
    const gg = 12, cols = Math.max(3, Math.floor((cw + gg) / (150 + gg))), cardW = (cw - gg * (cols - 1)) / cols, cardH = 132;
    for (const grp of logGroups()) {
      const got = grp.keys.filter((k) => this.rec[k]).length;
      y += 14; text(ctx, grp.name, pad, y + 4, { size: 14, color: LOG_INK, weight: 800 }); text(ctx, got + ' / ' + grp.keys.length, pad + cw, y + 4, { size: 13, align: 'right', color: LOG_BROWN, weight: 700 }); y += 16;
      grp.keys.forEach((k, i) => { const x = pad + (i % cols) * (cardW + gg), yy = y + Math.floor(i / cols) * (cardH + gg); if (yy + cardH > view0 && yy < view1) this.drawSpecies(ctx, k, x, yy, cardW, cardH); });
      y += Math.ceil(grp.keys.length / cols) * (cardH + gg) + 6;
    }
    y += 20;
    // trips
    this.sectionHead(ctx, 'RECENT TRIPS', this.trips.length ? this.trips.length + (this.trips.length > 1 ? ' crew trips' : ' crew trip') : '', pad, y, cw); y += 20;
    if (!this.trips.length) { para(ctx, 'Finish a crew trip and it shows up here, with who took the day.', pad, y + 20, cw, { size: 16, color: '#4a3e2a', weight: 600 }); y += 50; }
    const tcols = W >= 900 ? 2 : 1, tg = 12, tw = (cw - tg * (tcols - 1)) / tcols, th = 64;
    this.trips.forEach((tr, i) => { const x = pad + (i % tcols) * (tw + tg), yy = y + Math.floor(i / tcols) * (th + tg); if (yy + th > view0 && yy < view1) this.drawTrip(ctx, tr, x, yy, tw, th); });
    y += Math.ceil(this.trips.length / tcols) * (th + tg) + 24;
    ctx.restore();
    this.maxScroll = Math.max(0, y - H); this.drawn = true;
    // scrollbar
    if (this.maxScroll > 0) {
      const vh = H - top - 12, thH = Math.max(36, vh * (H - top) / (H - top + this.maxScroll)), ty = top + 6 + (vh - thH) * clamp(this.scroll / this.maxScroll, 0, 1);
      ctx.fillStyle = 'rgba(122,90,42,0.35)'; rr(ctx, W - 9, ty, 5, thH, 2.5); ctx.fill();
    }
    // header: title, progress, back
    ctx.fillStyle = PAL.ink; ctx.fillRect(0, 0, W, top);
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(0, top, W, 4);
    text(ctx, 'Logbook', pad, 50, { display: true, size: 34, color: '#fff' });
    ctx.font = dfnt(34); let sx = pad + ctx.measureText('Logbook').width + 26;
    const stat = (big, label, frac) => {
      if (sx + 70 > W - 160) return;
      text(ctx, big, sx, 38, { size: 22, color: PAL.sun, weight: 800 });
      text(ctx, label, sx, 56, { size: 12, color: '#9fb8c2', weight: 800 });
      if (frac != null) { ctx.fillStyle = 'rgba(255,255,255,0.15)'; rr(ctx, sx, 62, 76, 5, 2.5); ctx.fill(); if (frac > 0) { ctx.fillStyle = PAL.sun; rr(ctx, sx, 62, Math.max(5, 76 * frac), 5, 2.5); ctx.fill(); } }
      sx += 104;
    };
    stat(nCaught + ' / ' + SPECIES_ORDER.length, 'SPECIES', nCaught / SPECIES_ORDER.length);
    stat(nKnown + ' / ' + SPOT_ORDER.length, 'SPOTS', nKnown / SPOT_ORDER.length);
    stat(String(this.trips.length), this.trips.length === 1 ? 'TRIP' : 'TRIPS', null);
    UI.button(ctx, 'back', W - 140, 17, 120, 44, 'Back', () => Game.go(new TitleScene()), { style: 'ghost', size: 18, key: 'Escape' });
  }
}

/* ================= HOW TO PLAY ================= */
const HOWTO = [
  { title: 'The trip', art: 'boat', lines: ['Crew Trip: pass one phone around. The captain drives the boat to a spot, then everyone fishes it.', 'Bigger fish and bigger bugs score more. Trophies, slams and clean releases add bonuses.', 'Every day has three bounties, like a mahi over 20\u00a0lb. The first one to finish a bounty takes its bonus.', 'Full day is four spots, half day is two. Then run home at sunset. Most points is Captain of the Day.'] },
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
    const ax = Math.max(W * 0.74, W - 150), ay = H * 0.46, ak = clamp(W / 960, 0.8, 1);   // narrow screens: the art moves over and shrinks to clear the text
    drawSunburst(ctx, ax, ay, 220, t, 'rgba(255,200,69,0.1)');
    ctx.save(); ctx.translate(ax, ay); ctx.scale(ak, ak);
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
