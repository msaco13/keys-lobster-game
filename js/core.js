'use strict';
/* Keys Crew — core: math helpers, canvas + loop, input, immediate-mode buttons,
   synthesized audio, local storage, particles. Everything is drawn on one canvas
   in a logical space that is always 540 units tall and 720–1280 units wide. */

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const chance = (p) => Math.random() < p;
const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
const approach = (v, target, rate, dt) => v + (target - v) * (1 - Math.exp(-rate * dt));
const easeOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const easeBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; t = clamp(t, 0, 1); return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
function gauss() { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); }
function angleDiff(a, b) { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }
function mulberry(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function fmtTime(s) { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
function fmtLb(w) { return (w >= 100 ? Math.round(w) : w.toFixed(1)) + ' lb'; }
function longDate(d = new Date()) { return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }); }

const FONT_D = '"Shrikhand", Georgia, "Times New Roman", serif';
const FONT_UI = '"Barlow Semi Condensed", "Arial Narrow", "Helvetica Neue", Arial, sans-serif';
const fnt = (size, weight = 700) => `${weight} ${size}px ${FONT_UI}`;
const dfnt = (size) => `400 ${size}px ${FONT_D}`;

// Sun-bleached Keys palette: gelcoat white, deep Gulf Stream navy, lobster orange, sun yellow.
const PAL = {
  ink: '#0c2734', inkSoft: '#355564', panel: 'rgba(7,36,51,0.9)', panelLine: 'rgba(255,255,255,0.16)',
  foam: '#f7f3e8', sand: '#efdcae', coral: '#ff6a3d', sun: '#ffc845', sunDeep: '#c98b12',
  sea: '#0e7fa1', deep: '#08405e', shallow: '#62d0cf', good: '#3ccf7c', warn: '#ffad1f', bad: '#ff4f4f', mute: '#9fb8c2'
};

function text(ctx, s, x, y, o = {}) {
  let size = o.size || 20;
  const setFont = () => { ctx.font = o.display ? dfnt(size) : fnt(size, o.weight || 700); };
  setFont();
  ctx.textAlign = o.align || 'left';
  ctx.textBaseline = o.base || 'alphabetic';
  if (o.maxW) { while (size > 8 && ctx.measureText(s).width > o.maxW) { size -= 1; setFont(); } }
  if (o.alpha != null) ctx.globalAlpha = o.alpha;
  if (o.shadow) { ctx.fillStyle = o.shadow; ctx.fillText(s, x + (o.sx || 0), y + (o.sy == null ? 3 : o.sy)); }
  if (o.stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = o.sw || 4; ctx.strokeStyle = o.stroke; ctx.strokeText(s, x, y); }
  ctx.fillStyle = o.color || '#fff';
  ctx.fillText(s, x, y);
  if (o.alpha != null) ctx.globalAlpha = 1;
  return size;
}
function wrapText(ctx, s, maxW) {
  const words = String(s).split(' '); const lines = []; let line = '';
  for (const w of words) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
  if (line) lines.push(line);
  return lines;
}
function para(ctx, s, x, y, maxW, o = {}) {
  ctx.font = fnt(o.size || 18, o.weight || 500);
  const lines = wrapText(ctx, s, maxW); const lh = o.lh || (o.size || 18) * 1.3;
  lines.forEach((l, i) => text(ctx, l, x, y + i * lh, Object.assign({}, o, { size: o.size || 18, weight: o.weight || 500 })));
  return lines.length * lh;
}
function rr(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function panel(ctx, x, y, w, h, o = {}) {
  ctx.save();
  if (o.shadow !== false) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; rr(ctx, x, y + 5, w, h, o.r || 18); ctx.fill(); }
  ctx.fillStyle = o.fill || PAL.panel; rr(ctx, x, y, w, h, o.r || 18); ctx.fill();
  ctx.strokeStyle = o.line || PAL.panelLine; ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();
}

/* ---------- storage (per-browser conveniences only) ---------- */
const Store = {
  get(k, d) { try { const v = window.localStorage.getItem('keyscrew_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  // false when the browser wouldn't keep it (private mode, storage full): the game says so once instead of claiming it saved
  set(k, v) {
    try { window.localStorage.setItem('keyscrew_' + k, JSON.stringify(v)); return true; }
    catch (e) {
      if (!this.warned) { this.warned = true; this.warnPending = true; }   // said once the screen settles (Game.frame): a scene change would wipe it
      this.failed = true; return false;
    }
  },
  del(k) { try { window.localStorage.removeItem('keyscrew_' + k); } catch (e) { /* storage unavailable */ } },
  // typed reads: a value of the wrong shape (an old version, a hand edit, a bad write) reads as empty instead of breaking a screen
  arr(k) { const v = this.get(k, []); return Array.isArray(v) ? v : []; },
  obj(k) { const v = this.get(k, {}); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
};

/* ---------- audio: everything is synthesized, nothing to download ----------
   one-shots + beds ──────────────────────────→ SFX.out ─┐
   music: voices → Music.ch → bus → muffle → duck → SFX.mus ─┼→ SFX.master (mute) → compressor → soft clip → speakers
   reverb sends (sounds and music) → convolver ─────────────┘
   Tonal and drum one-shots are rendered once into small buffers (SFX.buf) and replayed at any pitch
   with playbackRate, so a steel-pan note costs two nodes. The engine, water, sea and reel-drag beds
   are built the first time they're needed and torn down after a few seconds of silence. */
const SFX = {
  ac: null, master: null, out: null, mus: null, verbIn: null, muted: false, nb: null, sm: null, crk: null,
  bank: {}, waves: {}, timer: null, LEVEL: 0.62, st: null,
  engine: null, water: null, amb: null, drag: null,
  init() { this.muted = !!Store.get('muted', false); },
  unlock() {
    if (this.ac) { const s = this.ac.state; if (s !== 'running' && s !== 'closed' && !document.hidden && this.ac.resume) this.ac.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    try {
      const ac = new AC(); this.build(ac);
      const b = ac.createBufferSource(); b.buffer = ac.createBuffer(1, 1, ac.sampleRate); b.connect(ac.destination); b.start(0);   // finishes the unlock on older iOS
      if (ac.state === 'suspended' && ac.resume) ac.resume().catch(() => {});
    } catch (e) { this.ac = null; this.master = null; return; }
    try { Music.attach(); } catch (e) { console.warn('music unavailable', e); }
    if (this.wantAmb) this.setAmbient(this.wantAmb[0], this.wantAmb[1]);   // a scene asked for the sea before the first tap
    this.warm();
    if (!this.timer) this.timer = setInterval(() => { try { this.house(); } catch (e) { /* ambience never stops the game */ } }, 100);
    if (!this.vis) {
      this.vis = true;
      document.addEventListener('visibilitychange', () => { const ac = this.ac; if (!ac) return; try { if (document.hidden) ac.suspend().catch(() => {}); else ac.resume().catch(() => {}); } catch (e) { /* old Safari */ } });
    }
  },
  // the whole mixer, on any (Offline)AudioContext
  build(ac) {
    this.ac = ac; this.bank = {}; this.waves = {}; this.crk = null; this.engine = this.water = this.amb = this.drag = null;
    this.st = { eng: [-1, -1], amb: [-1, false], drag: [-1, -1], hull: 0, hullAuto: 0, hullScene: null };
    const sr = ac.sampleRate, G = (v, to) => { const g = ac.createGain(); g.gain.value = v; if (to) g.connect(to); return g; };
    const nb = ac.createBuffer(1, sr * 2, sr), d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; this.nb = nb;
    // slow random wander (−1..1, a new target every half second, eased): swells, wobble, gusts
    const sm = ac.createBuffer(1, 8000 * 12, 8000), m = sm.getChannelData(0), P = [0];
    for (let k = 1; k < 24; k++) P.push(rand(-1, 1)); P.push(0);
    for (let i = 0; i < m.length; i++) { const k = Math.floor(i / 4000), u = (i % 4000) / 4000; m[i] = P[k] + (P[k + 1] - P[k]) * (0.5 - 0.5 * Math.cos(Math.PI * u)); }
    this.sm = sm;
    this.master = G(this.muted ? 0 : this.LEVEL);
    let tail = this.master;
    try { const c = ac.createDynamicsCompressor(); c.threshold.value = -9; c.knee.value = 8; c.ratio.value = 6; c.attack.value = 0.003; c.release.value = 0.2; tail.connect(c); tail = c; } catch (e) { /* no compressor */ }
    try {
      const ws = ac.createWaveShaper(), n = 2048, cv = new Float32Array(n);   // transparent below 0.75, rounds anything hotter off below 1
      for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1, a = Math.abs(x); cv[i] = Math.sign(x) * (a < 0.75 ? a : 0.75 + 0.24 * Math.tanh((a - 0.75) / 0.24)); }
      ws.curve = cv; tail.connect(ws); tail = ws;
    } catch (e) { /* no shaper */ }
    tail.connect(ac.destination);
    this.out = G(1, this.master); this.mus = G(0.62, this.master); this.verbIn = null;
    try { const cv = ac.createConvolver(); cv.buffer = this.impulse(1.5); const vi = G(1); vi.connect(cv); cv.connect(G(0.42, this.master)); this.verbIn = vi; } catch (e) { /* dry */ }
  },
  impulse(len) { // a soft plate: early taps, then a tail that darkens as it dies
    const ac = this.ac, sr = ac.sampleRate, n = Math.floor(sr * len), b = ac.createBuffer(2, n, sr), pre = Math.floor(sr * 0.011);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c); let lp = 0;
      for (let i = pre; i < n; i++) { const u = (i - pre) / (n - pre); lp += (Math.random() * 2 - 1 - lp) * (0.85 - 0.6 * u); d[i] = lp * Math.pow(1 - u, 2) * Math.exp(-3.2 * u); }
      for (let k = 0; k < 6; k++) { const i = pre + Math.floor(sr * rand(0.004, 0.05)); d[i] += rand(-0.5, 0.5); }
    }
    return b;
  },
  house() { // ten times a second: ambient events, and put idle beds to sleep
    const ac = this.ac; if (!ac || ac.state !== 'running') return;
    const now = ac.currentTime, s = this.st;
    if (s.hull && typeof Game !== 'undefined' && Game.scene !== s.hullScene) { s.hull = 0; this.hullApply(); }
    this.ambEvents(now, 0.45);
    for (const k of ['engine', 'water', 'amb', 'drag']) { const b = this[k]; if (b && b.off != null && now - b.off > 3) this.sleep(k); }
  },
  sleep(k) {
    const b = this[k]; if (!b) return; this[k] = null;
    for (const n of b.src) { try { n.stop(); } catch (e) { /* already stopped */ } }
    try { b.g.disconnect(); } catch (e) { /* gone */ }
    if (k === 'engine') this.st.eng = [-1, -1]; else if (k === 'amb') this.st.amb = [-1, false]; else if (k === 'drag') this.st.drag = [-1, -1];
  },
  warm() { // render the rest of the sample bank in small idle slices after the first tap, so no song or sound waits on it
    const q = ['steel', 'kick', 'shaker', 'rim', 'conga', 'marimba', 'bell', 'hat', 'snare', 'pluck', 'crash', 'tom', 'clap', 'cowbell', 'boom', 'ratchet', 'clave'];
    const next = () => { const n = q.shift(), d = n && this.SMP[n]; if (!d || !this.ac) return; try { for (const b of d.bases || [0]) this.buf(n, b || 1); } catch (e) { return; } setTimeout(next, 40); };
    setTimeout(next, 150);
  },
  setMuted(m) { this.muted = m; Store.set('muted', m); if (this.master) this.master.gain.setTargetAtTime(m ? 0 : this.LEVEL, this.ac.currentTime, 0.05); },

  /* ----- building blocks for the beds ----- */
  kit() {
    const ac = this.ac, t = ac.currentTime, src = [];
    return {
      src, t,
      G: (v, to) => { const g = ac.createGain(); g.gain.value = v; if (to) g.connect(to); return g; },
      F: (type, f, q, to) => { const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; if (to) fl.connect(to); return fl; },
      O: (f, w) => { const o = ac.createOscillator(); if (w && this.WAVES[w]) o.setPeriodicWave(this.wave(w)); else o.type = w || 'sine'; o.frequency.value = f; o.start(t); src.push(o); return o; },
      B: (buf, rate) => { const s = ac.createBufferSource(); s.buffer = buf; s.loop = true; s.playbackRate.value = rate || 1; s.start(t, Math.random() * buf.duration * 0.9); src.push(s); return s; }
    };
  },
  WAVES: { // PeriodicWave recipes: n → [cos, sin] amplitude of harmonic n
    pulse: (n) => [Math.sin(n * Math.PI * 0.17) / n, 0],      // an exhaust-pulse train for the outboards
    ratchet: (n) => [n < 64 ? Math.sin(n * Math.PI * 0.035) / n : 0, 0],  // reel pawl clicks
    bass: (n) => [0, [0, 1, 0.42, 0.16, 0.07, 0.03][n] || 0],
    organ: (n) => [0, [0, 1, 0.65, 0.18, 0.42, 0.06, 0.14, 0, 0.1][n] || 0],
    flute: (n) => [0, [0, 1, 0.16, 0.06, 0.025][n] || 0],
    reed: (n) => [0, n < 14 ? (n % 2 ? 1 : 0.35) / n : 0]
  },
  wave(name) {
    if (this.waves[name]) return this.waves[name];
    const N = 72, re = new Float32Array(N), im = new Float32Array(N), f = this.WAVES[name];
    for (let n = 1; n < N; n++) { const [a, b] = f(n); re[n] = a; im[n] = b; }
    return (this.waves[name] = this.ac.createPeriodicWave(re, im));
  },

  /* ----- twin outboards ----- */
  mkEngine() {
    const { src, G, F, O, B } = this.kit();
    const g = G(0, this.out), am = G(0.7, g), lp = F('lowpass', 300, 1.5, am);
    const a = O(36, 'pulse'), b = O(36.4, 'pulse'), sub = O(18);
    a.connect(G(0.5, lp)); b.connect(G(0.42, lp)); const gs = G(0.6, lp); sub.connect(gs);
    // wobble: each engine drifts on its own slow LFO, plus a shared random waver
    O(0.53).connect(G(7, a.detune)); O(0.81).connect(G(9, b.detune));
    const jg = G(14); B(this.sm, 1.7).connect(jg); jg.connect(a.detune); jg.connect(b.detune); jg.connect(sub.detune);
    // idle burble: exhaust bubbling out through the prop hubs
    const bur = O(7), bg = G(0.4, am.gain); bur.connect(bg);
    const n = B(this.nb, 1), ib = F('bandpass', 230, 0.9), ig = G(0.5, am); n.connect(ib); ib.connect(ig);
    // full-throttle gearcase whine and intake whoosh
    const wh = O(260, 'triangle'), wg = G(0, g); wh.connect(wg);
    const ab = F('bandpass', 1500, 0.6), ag = G(0, g); n.connect(ab); ab.connect(ag);
    return { src, g, lp, a, b, sub, gs, bur, bg, ig, wh, wg, ab, ag, off: null };
  },
  setEngine(level, rpm = 0) {
    if (!this.ac) return;
    const L = clamp(+level || 0, 0, 1), r = clamp(+rpm || 0, 0, 1), s = this.st;
    if (Math.abs(L - s.eng[0]) < 0.005 && Math.abs(r - s.eng[1]) < 0.004) return;   // called every frame: only touch params on a change
    s.eng[0] = L; s.eng[1] = r; s.hullAuto = L * Math.pow(r, 1.2); this.hullApply();
    let e = this.engine; if (!e) { if (!L) return; e = this.engine = this.mkEngine(); }
    const t = this.ac.currentTime, f = 34 + 120 * Math.pow(r, 0.9), idle = Math.pow(1 - r, 2);
    e.off = L ? null : t;
    e.g.gain.setTargetAtTime(L * (0.05 + 0.08 * r), t, L ? 0.15 : 0.35);
    e.a.frequency.setTargetAtTime(f, t, 0.3); e.b.frequency.setTargetAtTime(f * 1.011, t, 0.36); e.sub.frequency.setTargetAtTime(f / 2, t, 0.3);
    e.lp.frequency.setTargetAtTime(240 + 2600 * Math.pow(r, 1.3), t, 0.09);   // opens ahead of the revs: sounds like the props biting
    e.gs.gain.setTargetAtTime(0.65 - 0.45 * r, t, 0.2);
    e.bur.frequency.setTargetAtTime(6.5 + 11 * r, t, 0.3); e.bg.gain.setTargetAtTime(0.03 + 0.42 * idle, t, 0.2); e.ig.gain.setTargetAtTime(0.7 * idle, t, 0.2);
    e.wh.frequency.setTargetAtTime(f * 7.3, t, 0.3); e.wg.gain.setTargetAtTime(0.035 * Math.pow(r, 2.4), t, 0.2);
    e.ab.frequency.setTargetAtTime(900 + 1600 * r, t, 0.2); e.ag.gain.setTargetAtTime(0.4 * Math.pow(r, 1.6), t, 0.2);
  },
  /* ----- water rushing past the hull (follows the engine; setHull adds to it) ----- */
  mkWater() {
    const { src, G, F, B } = this.kit();
    const g = G(0, this.out), n = B(this.nb, 1), hg = G(0.6, g), lp = F('lowpass', 1200, 0.6, hg), hp = F('highpass', 380, 0.5, lp); n.connect(hp);
    const mg = G(0.38, hg.gain); B(this.sm, 2.3).connect(mg);   // the rush rises and falls with the swells
    const rl = F('lowpass', 150, 0.8), rg = G(0, g); n.connect(rl); rl.connect(rg);
    return { src, g, lp, rg, off: null };
  },
  hullApply() {
    const s = this.st, L = Math.max(s.hull, s.hullAuto);
    let w = this.water; if (!w) { if (L < 0.01) return; w = this.water = this.mkWater(); }
    const t = this.ac.currentTime;
    w.g.gain.setTargetAtTime(L * 0.07, t, 0.25); w.lp.frequency.setTargetAtTime(800 + 5000 * L, t, 0.3); w.rg.gain.setTargetAtTime(1.2 * L, t, 0.3);
    w.off = L < 0.01 ? t : null;
  },
  setHull(level) { // 0..1 extra water rush (drifting in a chop, a wake) — call it every frame like setEngine; it clears itself on a scene change
    if (!this.ac) return; const L = clamp(+level || 0, 0, 1), s = this.st;
    s.hullScene = typeof Game !== 'undefined' ? Game.scene : null;
    if (Math.abs(L - s.hull) < 0.01) return; s.hull = L; this.hullApply();
  },
  /* ----- the sea: lapping wash, surf hiss and far gulls up top; a muffled, bubbly bed under ----- */
  mkAmb() {
    const { src, G, F, B } = this.kit();
    const g = G(0, this.out), top = G(1, g), und = G(0.0001, g), n = B(this.nb, 1), n2 = B(this.nb, 0.93), sw = B(this.sm, 1);
    const wg = G(0.55, top), wl = F('lowpass', 520, 0.5, wg); n.connect(wl); sw.connect(G(0.42, wg.gain));
    const hg = G(0.08, top), hb = F('bandpass', 2400, 0.5, hg); n2.connect(hb); sw.connect(G(0.05, hg.gain));
    const ug = G(0.75, und), ul = F('lowpass', 210, 0.7, ug); n2.connect(ul); sw.connect(G(0.4, ug.gain));
    const cg = G(0.5, und), ch = F('highpass', 2200, 0.6, cg); B(this.crackle(), 1).connect(ch);   // snapping shrimp, far off on the reef
    return { src, g, top, und, off: null, L: 0, under: false, nl: 0, ng: 0, nb: 0 };
  },
  crackle() {
    if (this.crk) return this.crk;
    const sr = 24000, n = sr * 4, b = this.ac.createBuffer(1, n, sr), d = b.getChannelData(0);
    for (let k = 0; k < 4 * 60; k++) { const i0 = randi(0, n - 40), a = Math.pow(Math.random(), 3) * (chance(0.5) ? 1 : -1); for (let j = 0; j < 24; j++) d[i0 + j] += a * Math.exp(-j / 3) * (j % 2 ? -1 : 1); }
    return (this.crk = b);
  },
  setAmbient(level, under) {
    this.wantAmb = [level, under];
    if (!this.ac) return; const L = clamp(+level || 0, 0, 1), u = !!under, s = this.st;
    if (Math.abs(L - s.amb[0]) < 0.01 && u === s.amb[1]) return; s.amb[0] = L; s.amb[1] = u;
    let a = this.amb; if (!a) { if (!L) return; a = this.amb = this.mkAmb(); }
    const t = this.ac.currentTime; a.off = L ? null : t; a.L = L; a.under = u;
    a.g.gain.setTargetAtTime(L * 0.1, t, 0.4);
    a.top.gain.setTargetAtTime(u ? 0.0001 : 1, t, 0.15); a.und.gain.setTargetAtTime(u ? 1 : 0.0001, t, 0.15);
  },
  ambEvents(now, ahead) { // schedule the sea's little events up to `ahead` seconds out
    const a = this.amb; if (!a || a.off != null || this.muted || a.L < 0.05) return;
    const end = now + ahead, L = a.L;
    if (a.under) {
      if (a.nb < now) a.nb = now + rand(0.05, 0.4);
      while (a.nb < end) { this.bubbleAt(a.nb, L); a.nb += chance(0.22) ? rand(0.05, 0.12) : rand(0.3, 1.3); }
    } else {
      if (a.nl < now) a.nl = now + rand(0.2, 1.2);
      while (a.nl < end) { this.lapAt(a.nl, L); a.nl += rand(1.2, 3.4); }
      if (a.ng < now) a.ng = now + rand(5, 16);
      while (a.ng < end) { if (L > 0.25) this.gullAt(a.ng, 0.016 * L, rand(-0.85, 0.85), true); a.ng += rand(16, 38); }
    }
  },
  lapAt(t, L) { // a wave lapping the hull: soft swash, sometimes a little glug
    const v = L * rand(0.5, 1);
    this.noise(rand(0.4, 0.75), { at: t, filter: 'bandpass', f: rand(420, 700), to: rand(170, 260), q: 0.9, vol: 0.05 * v, att: rand(0.05, 0.1), pan: rand(-0.6, 0.6) });
    if (chance(0.45)) this.tone(rand(180, 260), 0.08, { at: t + rand(0.08, 0.22), to: rand(320, 440), vol: 0.018 * v, att: 0.006, pan: rand(-0.5, 0.5) });
  },
  bubbleAt(t, L) { const f = rand(380, 1100); this.tone(f, rand(0.05, 0.1), { at: t, to: f * rand(1.5, 2.3), vol: 0.013 * L * rand(0.4, 1), att: 0.004, pan: rand(-0.7, 0.7) }); },
  gullAt(t, v, pan, far) { // laughing gull: a few raspy 'kyow's
    const n = far ? randi(1, 3) : randi(2, 3), base = rand(1150, 1450);
    for (let k = 0; k < n; k++) {
      const t0 = t + k * rand(0.2, 0.3), f = base * rand(0.95, 1.05), len = rand(0.17, 0.26);
      this.tone(f, len, { at: t0, type: 'sawtooth', fseq: [[0, f * 0.78], [0.035, f * 1.3], [len, f * 0.7]], bp: f * (far ? 1.2 : 1.5), q: far ? 1 : 1.5, vol: v * (k ? 0.8 : 1), att: 0.02, pan, verb: far ? 0.6 : 0.25 });
    }
  },
  /* ----- reel drag: pawl clicks ringing in the spool, with a gritty buzz ----- */
  mkDrag() {
    const { src, G, F, O, B } = this.kit();
    const g = G(0, this.out), o = O(40, 'ratchet'), og = G(1, g), b1 = F('bandpass', 2700, 6, og), b2 = F('bandpass', 4300, 5, G(0.6, og)); o.connect(b1); o.connect(b2);
    const am = G(0.5, g), nb = F('bandpass', 3200, 1.2, am); B(this.nb, 1).connect(nb);
    const lfo = O(40, 'square'); lfo.connect(G(0.5, am.gain));
    const jg = G(80); B(this.sm, 3).connect(jg); jg.connect(o.detune); jg.connect(lfo.detune);
    return { src, g, o, lfo, b1, b2, off: null };
  },
  setDrag(level, pitch = 1) {
    if (!this.ac) return; const L = clamp(+level || 0, 0, 1), p = clamp(+pitch || 0, 0, 1.5), s = this.st.drag;
    if (Math.abs(L - s[0]) < 0.01 && Math.abs(p - s[1]) < 0.01) return; const up = L > s[0]; s[0] = L; s[1] = p;
    let d = this.drag; if (!d) { if (!L) return; d = this.drag = this.mkDrag(); }
    const t = this.ac.currentTime, rate = 26 + 62 * p;
    d.off = L ? null : t;
    d.g.gain.setTargetAtTime(L * 0.14, t, up ? 0.02 : 0.05);
    d.o.frequency.setTargetAtTime(rate, t, 0.05); d.lfo.frequency.setTargetAtTime(rate, t, 0.05);
    d.b1.frequency.setTargetAtTime(2300 + 900 * p, t, 0.08); d.b2.frequency.setTargetAtTime(3800 + 1200 * p, t, 0.08);
  },

  /* ----- one-shot voices (o.at = absolute time, o.delay = from now; o.pan, o.verb = reverb send) ----- */
  route(g, o) {
    const ac = this.ac; let n = g;
    if (o.pan && ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = clamp(o.pan, -1, 1); n.connect(p); n = p; }
    n.connect(this.out);
    if (o.verb && this.verbIn) { const s = ac.createGain(); s.gain.value = o.verb; n.connect(s); s.connect(this.verbIn); }
  },
  tone(f, dur, o = {}) {
    const ac = this.ac; if (!ac || this.muted) return;
    try {
      const t = o.at != null ? o.at : ac.currentTime + (o.delay || 0), osc = ac.createOscillator();
      if (o.wave) osc.setPeriodicWave(this.wave(o.wave)); else osc.type = o.type || 'sine';
      if (o.fseq) { osc.frequency.setValueAtTime(o.fseq[0][1], t); for (let k = 1; k < o.fseq.length; k++) osc.frequency.linearRampToValueAtTime(o.fseq[k][1], t + o.fseq[k][0]); }
      else { osc.frequency.setValueAtTime(f, t); if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + (o.glide || dur)); }
      if (o.detune) osc.detune.value = o.detune;
      const g = ac.createGain(), v = o.vol == null ? 0.2 : o.vol, a = o.att || 0.005;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + a);
      if (o.hold) g.gain.setValueAtTime(v, t + a + o.hold);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      let n = osc;
      if (o.lp || o.hp || o.bp) { const fl = ac.createBiquadFilter(); fl.type = o.lp ? 'lowpass' : o.hp ? 'highpass' : 'bandpass'; fl.frequency.value = o.lp || o.hp || o.bp; fl.Q.value = o.q || 0.8; n.connect(fl); n = fl; }
      n.connect(g); this.route(g, o);
      osc.start(t); osc.stop(t + dur + 0.05);
    } catch (e) { /* a bad sound never stops the game */ }
  },
  noise(dur, o = {}) {
    const ac = this.ac; if (!ac || this.muted || !this.nb) return;
    try {
      const t = o.at != null ? o.at : ac.currentTime + (o.delay || 0), src = ac.createBufferSource(); src.buffer = this.nb; src.loop = true;
      if (o.rate) src.playbackRate.value = o.rate;
      const f = ac.createBiquadFilter(); f.type = o.filter || 'lowpass'; f.frequency.setValueAtTime(o.f || 1000, t); f.Q.value = o.q || 1;
      if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + dur);
      const g = ac.createGain(), v = o.vol == null ? 0.25 : o.vol;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + (o.att || 0.01));
      if (o.hold) g.gain.setValueAtTime(v, t + (o.att || 0.01) + o.hold);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f); f.connect(g); this.route(g, o);
      src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
    } catch (e) { /* ignore */ }
  },
  hit(name, f, o = {}) { // a pre-rendered one-shot (steel, marimba, bell, drums…) at pitch f
    const ac = this.ac; if (!ac || this.muted) return;
    try {
      const b = this.buf(name, f); if (!b) return;
      const t = o.at != null ? o.at : ac.currentTime + (o.delay || 0), v = o.vol == null ? 0.2 : o.vol;
      const src = ac.createBufferSource(); src.buffer = b.buf; src.playbackRate.value = b.rate * (o.rate || 1);
      const g = ac.createGain(); g.gain.value = v;
      if (o.len) { g.gain.setValueAtTime(v, t + o.len); g.gain.exponentialRampToValueAtTime(0.0001, t + o.len + 0.08); }
      src.connect(g); this.route(g, o); src.start(t); if (o.len) src.stop(t + o.len + 0.1);
    } catch (e) { /* ignore */ }
  },
  steel(f, delay, vol = 0.16) { this.hit('steel', f, { delay, vol: vol * 1.15, verb: 0.18 }); },   // steel-pan note
  arp(notes, gap, vol, o = {}) { notes.forEach((n, k) => this.hit(o.inst || 'steel', typeof n === 'number' ? n : nf(n), Object.assign({}, o, { delay: (o.delay || 0) + k * gap, vol: vol * (o.grow ? 1 + k * o.grow : 1) }))); },
  drops(n, t0, t1, vol) { for (let k = 0; k < n; k++) { const f = rand(900, 2200); this.tone(f, 0.05, { delay: rand(t0, t1), to: f * 1.7, vol: vol * rand(0.5, 1), att: 0.003, pan: rand(-0.5, 0.5) }); } },

  /* ----- pre-rendered buffers ----- */
  buf(name, f) {
    const def = this.SMP[name]; if (!def || !this.ac) return null;
    let base = def.base || 0;
    if (def.bases) { base = def.bases[0]; for (const b of def.bases) if (Math.abs(Math.log(f / b)) < Math.abs(Math.log(f / base))) base = b; }
    const key = name + base; let b = this.bank[key];
    if (!b) {
      const sr = Math.min(def.sr || 24000, this.ac.sampleRate), n = Math.floor(sr * def.dur);
      b = this.ac.createBuffer(1, n, sr); const d = b.getChannelData(0);
      def.fn.call(this, d, sr, base);
      let pk = 0; for (let i = 0; i < n; i++) pk = Math.max(pk, Math.abs(d[i]));
      const k = pk ? (def.peak || 0.9) / pk : 0, fade = Math.floor(sr * 0.006);
      for (let i = 0; i < n; i++) d[i] *= k * (i > n - fade ? (n - i) / fade : 1);
      this.bank[key] = b;
    }
    return { buf: b, rate: base && f ? f / base : 1 };
  },
  parts(d, sr, f, P, att = 0.001) { // additive partials [ratio, amp, decay per second]
    for (const [r, a, k] of P) {
      const w = (TAU * f * r) / sr; if (w >= Math.PI * 0.9) continue;
      const c = Math.cos(w), s = Math.sin(w), dk = Math.exp(-k / sr); let x = 1, y = 0, e = a;
      for (let i = 0; i < d.length; i++) { const nx = x * c - y * s; y = x * s + y * c; x = nx; d[i] += y * e; e *= dk; }
    }
    const n = Math.floor(att * sr); for (let i = 0; i < n && i < d.length; i++) d[i] *= i / n;
  },
  filt(d, sr, type, f, q = 0.707) { // RBJ biquad, in place
    const w = (TAU * Math.min(f, sr * 0.45)) / sr, cs = Math.cos(w), al = Math.sin(w) / (2 * q), a0 = 1 + al, a1 = -2 * cs, a2 = 1 - al;
    let b0, b1, b2;
    if (type === 'lp') { b1 = 1 - cs; b0 = b2 = b1 / 2; } else if (type === 'hp') { b1 = -(1 + cs); b0 = b2 = (1 + cs) / 2; } else { b0 = al; b1 = 0; b2 = -al; }
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < d.length; i++) { const x = d[i], y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0; x2 = x1; x1 = x; y2 = y1; y1 = y; d[i] = y; }
  },
  nzAdd(d, sr, amp, dec, type, f, q, sec) { // add filtered, decaying noise
    const m = new Float32Array(Math.min(d.length, Math.floor(sr * (sec || 9)))); for (let i = 0; i < m.length; i++) m[i] = Math.random() * 2 - 1;
    if (type) this.filt(m, sr, type, f, q);
    let e = amp; const k = Math.exp(-dec / sr); for (let i = 0; i < m.length; i++) { d[i] += m[i] * e; e *= k; }
  },
  drum(d, sr, f, bend, bendK, dec, h2) { // a pitched membrane: sine with a quick downward bend
    let ph = 0;
    for (let i = 0; i < d.length; i++) { const t = i / sr; ph += (TAU * f * (1 + bend * Math.exp(-t * bendK))) / sr; d[i] += (Math.sin(ph) + (h2 || 0) * Math.sin(2 * ph)) * Math.exp(-t * dec) * (1 - Math.exp(-t * 4000)); }
  },
  SMP: {
    steel: { bases: [196, 392, 784], dur: 1.5, fn(d, sr, f) { this.parts(d, sr, f, [[1, 1, 2.3], [1.0035, 0.3, 2], [2, 0.55, 3.8], [3, 0.2, 6.5], [4, 0.09, 10], [5, 0.04, 15]], 0.0015); this.nzAdd(d, sr, 0.1, 260, 'bp', f * 3, 1.5, 0.05); } },
    marimba: { bases: [262, 523], dur: 1, fn(d, sr, f) { this.parts(d, sr, f, [[1, 1, 6.5], [3.98, 0.32, 24], [9.8, 0.06, 55]], 0.001); this.nzAdd(d, sr, 0.15, 400, 'lp', f * 2, 0.7, 0.02); } },
    pluck: { bases: [262, 523, 1047], dur: 1.4, fn(d, sr, f) { this.parts(d, sr, f, [[1, 1, 3.4], [2, 0.14, 7], [5.92, 0.18, 20], [8.8, 0.05, 36]], 0.001); } },
    bell: { bases: [523, 1047], dur: 1.9, fn(d, sr, f) { this.parts(d, sr, f, [[1, 1, 1.5], [2, 0.32, 2.6], [2.76, 0.24, 3.6], [5.4, 0.1, 6], [8.93, 0.05, 9]], 0.001); } },
    kick: { sr: 32000, dur: 0.42, fn(d, sr) { this.drum(d, sr, 48, 2.4, 32, 7.5); this.nzAdd(d, sr, 0.3, 700, 'lp', 3000, 0.7, 0.012); } },
    snare: { sr: 32000, dur: 0.26, fn(d, sr) { this.drum(d, sr, 185, 0.3, 40, 24, 0.4); this.nzAdd(d, sr, 1.1, 17, 'bp', 2400, 0.6); this.nzAdd(d, sr, 0.35, 30, 'hp', 6000, 0.7); } },
    hat: { sr: 32000, dur: 0.07, fn(d, sr) { this.nzAdd(d, sr, 1, 75, 'hp', 7500, 0.8); } },
    shaker: { sr: 32000, dur: 0.11, fn(d, sr) { this.nzAdd(d, sr, 1, 38, 'bp', 6500, 0.9); const n = Math.floor(sr * 0.014); for (let i = 0; i < n; i++) d[i] *= i / n; } },
    rim: { sr: 32000, dur: 0.06, fn(d, sr) { this.parts(d, sr, 1700, [[1, 0.7, 90], [1.62, 0.25, 120]]); this.nzAdd(d, sr, 0.6, 140, 'bp', 2300, 3); } },
    clap: { sr: 32000, dur: 0.3, fn(d, sr) {
      const m = new Float32Array(d.length); for (let i = 0; i < m.length; i++) m[i] = Math.random() * 2 - 1; this.filt(m, sr, 'bp', 1300, 1.1);
      for (let i = 0; i < d.length; i++) { const t = i / sr; let e = 0; for (const ti of [0, 0.011, 0.022]) if (t >= ti) e = Math.max(e, Math.exp(-(t - ti) * 180)); if (t > 0.026) e = Math.max(e, 0.6 * Math.exp(-(t - 0.026) * 16)); d[i] = m[i] * e; }
    } },
    conga: { base: 240, dur: 0.5, fn(d, sr, f) { this.drum(d, sr, f, 0.12, 50, 12, 0.2); this.nzAdd(d, sr, 0.5, 260, 'bp', 2000, 1, 0.03); } },
    cowbell: { sr: 32000, dur: 0.32, fn(d, sr) {
      for (let i = 0; i < d.length; i++) { const t = i / sr; d[i] = (Math.sign(Math.sin(TAU * 540 * t)) + Math.sign(Math.sin(TAU * 800 * t))) * 0.5; }
      this.filt(d, sr, 'bp', 900, 1.4); for (let i = 0; i < d.length; i++) { const t = i / sr; d[i] *= 0.6 * Math.exp(-t * 60) + 0.4 * Math.exp(-t * 9); }
    } },
    clave: { dur: 0.14, fn(d, sr) { this.parts(d, sr, 2500, [[1, 1, 42]]); } },
    tom: { base: 150, dur: 0.6, fn(d, sr, f) { this.drum(d, sr, f, 0.35, 20, 7); this.nzAdd(d, sr, 0.25, 120, 'lp', 1500, 0.7, 0.03); } },
    crash: { sr: 32000, dur: 1.5, fn(d, sr) { this.parts(d, sr, 3150, [[1, 0.08, 3], [1.49, 0.06, 3.5], [1.93, 0.05, 4]]); this.nzAdd(d, sr, 1, 2.6, 'hp', 4800, 0.6); } },
    boom: { dur: 1.1, fn(d, sr) { this.drum(d, sr, 62, 0.6, 14, 4.5); this.nzAdd(d, sr, 0.5, 25, 'lp', 400, 0.7, 0.2); } },
    ratchet: { sr: 32000, dur: 0.36, fn(d, sr) {
      let t0 = 0.004;
      for (let k = 0; k < 12; k++) { const i0 = Math.floor(t0 * sr), a = rand(0.6, 1); for (let j = 0; j < sr * 0.012 && i0 + j < d.length; j++) { const tt = j / sr; d[i0 + j] += a * (Math.sin(TAU * 3200 * tt) * Math.exp(-tt * 700) + 0.6 * Math.sin(TAU * 5100 * tt) * Math.exp(-tt * 900) + (j < 8 ? (Math.random() * 2 - 1) * 0.8 : 0)); } t0 += rand(0.024, 0.031); }
    } }
  },

  /* ----- the game's sounds ----- */
  play(name, k) {
    if (!this.ac || this.muted) return;
    const fn = this.SND[name]; if (!fn) return;
    try { fn.call(this, k == null ? 1 : clamp(+k || 0, 0, 2)); } catch (e) { /* a bad sound never stops the game */ }
  },
  SND: {
    click() { const f = rand(1040, 1160); this.tone(f, 0.05, { to: f * 0.6, vol: 0.075, att: 0.002 }); this.tone(f / 2, 0.035, { type: 'triangle', vol: 0.025, att: 0.002 }); this.noise(0.012, { filter: 'highpass', f: 4000, vol: 0.012, att: 0.001 }); },
    page() { this.noise(0.2, { filter: 'bandpass', f: 600, to: 2600, q: 1.1, vol: 0.13, att: 0.07 }); this.tone(1480, 0.06, { delay: 0.12, to: 1760, vol: 0.03 }); },
    tick() { const f = rand(1800, 2000); this.tone(f, 0.03, { to: f * 0.8, vol: 0.055, att: 0.001 }); this.noise(0.008, { filter: 'highpass', f: 5000, vol: 0.012, att: 0.001 }); },
    coin() { this.hit('bell', 988, { vol: 0.09, len: 0.12 }); this.hit('bell', 1319, { delay: 0.075, vol: 0.115, len: 0.45, verb: 0.12 }); this.tone(2637, 0.14, { delay: 0.075, vol: 0.012 }); },
    splash() {
      this.noise(0.5, { filter: 'lowpass', f: 3200, to: 380, vol: 0.3, att: 0.008, q: 0.7 }); this.noise(0.25, { filter: 'highpass', f: 2500, vol: 0.07, att: 0.004 });
      this.tone(140, 0.12, { to: 70, vol: 0.11 }); this.drops(3, 0.12, 0.4, 0.022);
    },
    bigsplash() {
      this.noise(0.95, { filter: 'lowpass', f: 2600, to: 220, vol: 0.42, att: 0.01, q: 0.7, verb: 0.12 }); this.noise(0.5, { filter: 'highpass', f: 2000, vol: 0.1, att: 0.01 });
      this.tone(85, 0.35, { to: 42, vol: 0.26 }); this.drops(6, 0.2, 0.8, 0.026);
    },
    plop() { const f = rand(270, 330); this.tone(f, 0.12, { to: f * 3, vol: 0.15, att: 0.003 }); this.noise(0.08, { filter: 'lowpass', f: 1200, vol: 0.05 }); this.tone(110, 0.06, { to: 70, vol: 0.06 }); },
    nibble() { this.tone(520, 0.045, { type: 'triangle', to: 380, vol: 0.085, att: 0.002 }); this.tone(470, 0.045, { type: 'triangle', to: 350, vol: 0.07, delay: 0.085, att: 0.002 }); this.noise(0.012, { filter: 'highpass', f: 3500, vol: 0.02, att: 0.001 }); },
    bite() {
      this.tone(160, 0.22, { to: 55, vol: 0.3, att: 0.003 }); this.noise(0.16, { filter: 'lowpass', f: 900, to: 300, vol: 0.16 });
      this.noise(0.12, { filter: 'bandpass', f: 1800, to: 3800, q: 4, vol: 0.05 }); this.noise(0.28, { filter: 'bandpass', f: 1200, to: 500, vol: 0.08, delay: 0.03 });
    },
    hookset() {
      this.noise(0.14, { filter: 'bandpass', f: 700, to: 3600, q: 1.5, vol: 0.2, att: 0.03 }); this.noise(0.02, { filter: 'highpass', f: 2500, vol: 0.14, delay: 0.11, att: 0.001 });
      this.tone(110, 0.14, { to: 58, vol: 0.2, delay: 0.11 }); this.tone(520, 0.2, { type: 'triangle', to: 780, vol: 0.045, delay: 0.11 });
    },
    snap() {
      this.noise(0.03, { filter: 'highpass', f: 3000, vol: 0.3, att: 0.001 }); this.tone(1600, 0.24, { type: 'triangle', to: 220, vol: 0.09 });
      this.tone(2400, 0.12, { to: 900, vol: 0.035 }); this.noise(0.22, { filter: 'bandpass', f: 2500, to: 600, vol: 0.06, delay: 0.02 });
    },
    catch() {
      Music.duck(1.5);
      this.arp(['C5', 'E5', 'G5'], 0.085, 0.2, { verb: 0.22 });
      for (let r = 0; r < 5; r++) this.hit('steel', nf('C6'), { delay: 0.255 + r * 0.06, vol: r ? 0.13 - r * 0.015 : 0.22, verb: 0.22 });
      this.tone(nf('C3'), 0.5, { wave: 'bass', vol: 0.16, delay: 0.255 }); this.hit('shaker', 0, { delay: 0.255, vol: 0.06 });
    },
    trophy() {
      Music.duck(2.4);
      this.arp(['C5', 'E5', 'G5', 'C6'], 0.075, 0.16, { verb: 0.25 });
      for (const n of ['C5', 'E5', 'G5', 'C6']) this.hit('steel', nf(n), { delay: 0.42, vol: 0.11, verb: 0.3 });
      for (let r = 0; r < 9; r++) this.hit('steel', nf('E6'), { delay: 0.42 + r * 0.065, vol: r ? 0.1 - r * 0.007 : 0.17, verb: 0.3 });
      this.hit('bell', nf('C6'), { delay: 0.42, vol: 0.08, verb: 0.4 }); this.hit('crash', 0, { delay: 0.42, vol: 0.07 });
      this.tone(nf('C3'), 0.8, { wave: 'bass', vol: 0.15, delay: 0.42 }); this.hit('boom', 0, { delay: 0.42, vol: 0.14 });
    },
    slam() {
      Music.duck(2.8);
      this.arp(['G4', 'C5', 'E5', 'G5', 'C6', 'E6'], 0.07, 0.15, { verb: 0.25, grow: 0.06 });
      this.hit('boom', 0, { vol: 0.12 }); this.hit('boom', 0, { delay: 0.5, vol: 0.17 });
      for (const n of ['C4', 'E4', 'G4', 'C5', 'E5', 'G5']) this.hit('steel', nf(n), { delay: 0.5, vol: 0.09, verb: 0.3 });
      for (let r = 0; r < 12; r++) this.hit('steel', nf('G6'), { delay: 0.5 + r * 0.06, vol: r ? 0.09 - r * 0.005 : 0.15, verb: 0.3 });
      this.hit('crash', 0, { delay: 0.5, vol: 0.09 }); this.hit('bell', nf('C6'), { delay: 0.5, vol: 0.09, verb: 0.4 }); this.hit('bell', nf('G5'), { delay: 0.62, vol: 0.06, verb: 0.4 });
      this.tone(nf('C2'), 1, { wave: 'bass', vol: 0.2, delay: 0.5 });
    },
    bubble() { const f = rand(450, 900); this.tone(f, 0.08, { to: f * 2.2, vol: 0.045, att: 0.004 }); if (chance(0.4)) this.tone(f * 1.4, 0.06, { to: f * 3, vol: 0.025, delay: rand(0.04, 0.1), att: 0.004 }); },
    warn() { this.tone(988, 0.11, { type: 'triangle', vol: 0.14, att: 0.006 }); this.tone(784, 0.15, { type: 'triangle', vol: 0.12, delay: 0.12, att: 0.006 }); },
    sting() {
      this.tone(1300, 0.24, { type: 'sawtooth', to: 380, vol: 0.05, lp: 3000 }); this.noise(0.18, { filter: 'highpass', f: 3000, vol: 0.1 });
      for (let k = 0; k < 6; k++) this.noise(0.012, { filter: 'bandpass', f: rand(2500, 5000), q: 2, vol: 0.08, delay: 0.02 + k * 0.026, att: 0.001 });
    },
    chomp() {
      for (const dl of [0, 0.11]) { this.noise(0.11, { filter: 'lowpass', f: 1600, to: 300, vol: 0.4, delay: dl }); this.tone(130, 0.13, { type: 'sawtooth', to: 55, vol: 0.2, lp: 600, delay: dl }); this.noise(0.015, { filter: 'highpass', f: 3000, vol: 0.08, delay: dl, att: 0.001 }); }
    },
    tickle() { const f = rand(1800, 2400); this.tone(f, 0.035, { to: f * 1.2, vol: 0.026, att: 0.002 }); },
    net() { this.noise(0.3, { filter: 'bandpass', f: 500, to: 2000, q: 1.2, vol: 0.32, att: 0.08 }); this.noise(0.3, { filter: 'lowpass', f: 1800, to: 400, vol: 0.16, delay: 0.15 }); this.tone(520, 0.08, { to: 1200, vol: 0.05, delay: 0.22 }); },
    swish() { this.noise(0.22, { filter: 'bandpass', f: 450, to: 1700, q: 2, vol: 0.32, att: 0.07 }); },
    fail() { // a muted horn sighing down
      const o = { wave: 'reed', lp: 1100, q: 0.7, att: 0.02 };
      this.tone(392, 0.2, Object.assign({ vol: 0.07 }, o)); this.tone(370, 0.2, Object.assign({ vol: 0.07, delay: 0.2 }, o)); this.tone(349, 0.6, Object.assign({ vol: 0.07, delay: 0.4, to: 311, glide: 0.6, hold: 0.25 }, o));
    },
    cast() { this.noise(0.25, { filter: 'bandpass', f: 600, to: 2800, q: 1.4, vol: 0.26, att: 0.1 }); this.noise(0.45, { filter: 'bandpass', f: 4200, to: 2000, q: 6, vol: 0.12, delay: 0.12, att: 0.02 }); },
    strip() { this.noise(0.07, { filter: 'bandpass', f: 3200, to: 2000, q: 2, vol: 0.16, att: 0.01 }); },
    horn() { // a twin-trumpet marine air horn, with the mangroves throwing it back
      for (const [dl, v] of [[0, 1], [0.38, 0.22]]) for (const [f, k] of [[220, 1], [277, 0.8]]) {
        this.tone(f, 1.05, { wave: 'reed', fseq: [[0, f * 0.95], [0.06, f], [1.05, f * 0.99]], lp: 1800, q: 0.6, att: 0.05, hold: 0.7, vol: 0.075 * k * v, delay: dl, verb: 0.3, pan: dl ? 0.4 : 0 });
      }
    },
    siren() { // FWC: two quick whoops
      for (const dl of [0, 0.5]) this.tone(480, 0.44, { type: 'sawtooth', fseq: [[0, 480], [0.26, 1400], [0.44, 900]], lp: 3000, q: 0.7, att: 0.02, hold: 0.3, vol: 0.095, delay: dl, verb: 0.2 });
    },
    woo() { // the crew whooping on the airtime
      for (const [f0, f1, dl, p] of [[260, 430, 0, -0.3], [200, 340, 0.06, 0.3]]) {
        this.tone(f0, 0.5, { type: 'sawtooth', fseq: [[0, f0], [0.3, f1], [0.5, f1 * 0.92]], bp: 600, q: 1.4, att: 0.04, hold: 0.25, vol: 0.14, delay: dl, pan: p });
      }
      this.noise(0.45, { filter: 'bandpass', f: 900, to: 1800, q: 0.8, vol: 0.08, att: 0.15 });
    },
    reel() { this.hit('ratchet', 0, { vol: 0.26, rate: rand(0.92, 1.08) }); },
    gull() { this.gullAt(this.ac.currentTime, 0.16, rand(-0.6, 0.6), false); },
    dolphin() {
      const p = rand(-0.6, 0.6);
      let t = 0; for (let k = 0; k < 10; k++) { this.noise(0.006, { filter: 'bandpass', f: rand(4200, 5600), q: 2, vol: 0.07, delay: t, att: 0.001, pan: p }); t += rand(0.018, 0.032); }
      this.tone(2600, 0.42, { fseq: [[0, 2400], [0.12, 4200], [0.28, 3100], [0.42, 3700]], vol: 0.05, delay: t + 0.05, att: 0.02, hold: 0.25, pan: p, verb: 0.2 });
      this.tone(3000, 0.22, { fseq: [[0, 3000], [0.22, 4600]], vol: 0.035, delay: t + 0.55, att: 0.02, pan: p, verb: 0.2 });
    },
    found() { // something new on the chart
      Music.duck(1.8);
      this.arp(['G4', 'C5', 'E5', 'G5'], 0.07, 0.15, { verb: 0.3 });
      this.hit('bell', nf('C6'), { delay: 0.3, vol: 0.1, verb: 0.4 }); this.hit('bell', nf('E6'), { delay: 0.36, vol: 0.08, verb: 0.4 }); this.hit('bell', nf('G6'), { delay: 0.44, vol: 0.07, verb: 0.45 });
      for (const n of ['C4', 'E4', 'G4']) this.tone(nf(n), 1.2, { type: 'triangle', att: 0.25, hold: 0.4, vol: 0.03, delay: 0.28, verb: 0.3 });
      this.hit('crash', 0, { delay: 0.3, vol: 0.035 });
    },
    bounty() { // reward sting: IV then I
      Music.duck(1.5);
      const st = (notes, dl, len, v) => { for (const n of notes) this.tone(nf(n), len, { type: 'sawtooth', lp: 1700, q: 0.8, att: 0.012, hold: len * 0.4, vol: v, delay: dl, verb: 0.2 }); };
      st(['F4', 'A4', 'C5'], 0, 0.14, 0.035); st(['E4', 'G4', 'C5', 'E5'], 0.17, 0.55, 0.035);
      this.hit('boom', 0, { delay: 0.17, vol: 0.18 }); this.hit('steel', nf('C6'), { delay: 0.17, vol: 0.14, verb: 0.3 }); this.hit('steel', nf('G5'), { delay: 0.17, vol: 0.1, verb: 0.3 });
      this.hit('bell', 988, { delay: 0.32, vol: 0.07, len: 0.12 }); this.hit('bell', 1319, { delay: 0.39, vol: 0.09, len: 0.5, verb: 0.2 });
    },
    slap(k) { // the hull slamming down on a wave
      const p = rand(-0.3, 0.3);
      this.noise(0.18, { filter: 'lowpass', f: 1300, to: 350, vol: 0.22 * k, att: 0.004, pan: p }); this.tone(rand(85, 105), 0.18, { to: 48, vol: 0.2 * k, att: 0.003 });
      this.noise(0.32, { filter: 'highpass', f: 2200, vol: 0.06 * k, delay: 0.035, att: 0.02, pan: -p });
    },
    bump() { // hull thunk against a piling or the bottom
      this.tone(95, 0.3, { to: 45, vol: 0.3, att: 0.003 }); this.noise(0.12, { filter: 'lowpass', f: 500, vol: 0.24 }); this.tone(190, 0.09, { type: 'triangle', to: 120, vol: 0.1 });
      this.noise(0.35, { filter: 'bandpass', f: 900, to: 400, vol: 0.08, delay: 0.03 });
    }
  }
};

/* ---------- music: a small step sequencer playing synthesized island tunes ---------- */
const NOTE_CACHE = {};
function nf(name) { // 'C4', 'F#3', 'Bb2' -> Hz
  if (NOTE_CACHE[name]) return NOTE_CACHE[name];
  return (NOTE_CACHE[name] = 440 * Math.pow(2, (noteMidi(name) - 69) / 12));
}
function noteMidi(name) { // 'C4' -> 60
  const m = /^([A-G])([#b]?)(\d)$/.exec(name);
  return 12 * (+m[3] + 1) + { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}
const Music = {
  on: true, want: null, cur: null, song: null, i: 0, next: 0, bus: null, lp: null, duckG: null, timer: null, intensity: 0,
  wet: null, wduck: null, wlp: null, ds: null, dly: null, dfb: null, ch: null, bv: [0, 0, 0, 0], sd: 0.125, muf: false,
  init() { this.on = Store.get('music', true) !== false; },
  attach(offline) {
    const ac = SFX.ac, G = (v, to) => { const g = ac.createGain(); g.gain.value = v; if (to) g.connect(to); return g; };
    const LP = (f, to) => { const l = ac.createBiquadFilter(); l.type = 'lowpass'; l.frequency.value = f; if (to) l.connect(to); return l; };
    this.cur = null; this.song = null;
    this.duckG = G(1, SFX.mus); this.lp = LP(16000, this.duckG); this.bus = G(0.0001, this.lp);
    this.wlp = LP(16000, SFX.verbIn || null); this.wduck = G(1, this.wlp); this.wet = G(0.0001, this.wduck);
    // dub echo on the lead, darkening as it repeats
    this.ds = G(0); this.dly = ac.createDelay(2); this.dfb = G(0.3); const dl = LP(2200);
    this.ds.connect(this.dly); this.dly.connect(dl); dl.connect(this.dfb); this.dfb.connect(this.dly); dl.connect(this.bus);
    this.ch = {};
    for (const [k, pan] of [['c', 0], ['l', -0.38], ['r', 0.38], ['lead', 0.1]]) {
      const inp = G(1); let o = inp;
      if (ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = pan; inp.connect(p); o = p; }
      o.connect(this.bus); const vs = G(0, this.wet); o.connect(vs); inp.vs = vs; this.ch[k] = inp;
    }
    this.ch.lead.connect(this.ds);
    if (!offline && !this.timer) this.timer = setInterval(() => this.tick(), 40);
    if (this.want) this.play(this.want);
  },
  hold(p, t) { if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(t); else { const v = p.value; p.cancelScheduledValues(t); p.setValueAtTime(v, t); } },
  play(name) {
    this.want = name;
    if (!this.bus || this.cur === name || !SONGS[name]) return;
    const t = SFX.ac.currentTime, s = SONGS[name], fx = s.fx || {};
    this.cur = name; this.song = s; this.i = 0; this.next = t + 0.32; this.intensity = 0; this.sd = 60 / s.bpm / 4; this.muf = false;
    for (const g of [this.bus.gain, this.wet.gain]) { this.hold(g, t); g.linearRampToValueAtTime(0.0001, t + 0.28); g.linearRampToValueAtTime(this.on ? s.vol : 0.0001, t + 1.1); }
    for (const f of [this.lp.frequency, this.wlp.frequency]) f.setTargetAtTime(s.lp || 16000, t, 0.25);
    for (const k in this.ch) this.ch[k].vs.gain.setTargetAtTime(fx[k] || 0, t + 0.3, 0.1);
    this.ds.gain.setTargetAtTime(fx.dly || 0, t + 0.3, 0.1); this.dfb.gain.setTargetAtTime(fx.fb || 0.3, t + 0.3, 0.1);
    this.dly.delayTime.setValueAtTime(clamp(this.sd * 4 * (fx.dt || 0.75), 0.05, 1.9), t + 0.3);
  },
  setOn(v) {
    this.on = v; Store.set('music', v);
    if (this.bus && this.song) { const t = SFX.ac.currentTime; for (const g of [this.bus.gain, this.wet.gain]) { this.hold(g, t); g.setTargetAtTime(v ? this.song.vol : 0.0001, t, 0.15); } }
  },
  muffle(on) { // underwater: the music goes dull and distant
    on = !!on; if (!this.lp || !this.song || on === this.muf) return; this.muf = on;
    const f = on ? this.song.muf || 900 : this.song.lp || 16000, t = SFX.ac.currentTime;
    this.lp.frequency.setTargetAtTime(f, t, 0.12); this.wlp.frequency.setTargetAtTime(f, t, 0.12);
  },
  duck(d = 1.5) {
    if (!this.duckG) return; const t = SFX.ac.currentTime;
    for (const g of [this.duckG.gain, this.wduck.gain]) { this.hold(g, t); g.linearRampToValueAtTime(0.28, t + 0.08); g.setValueAtTime(0.28, t + d * 0.6); g.linearRampToValueAtTime(1, t + d); }
  },
  tick() {
    const ac = SFX.ac; if (!this.song || !ac || ac.state !== 'running') return;
    const now = ac.currentTime; if (this.next < now - 0.2) this.next = now + 0.05;
    while (this.next < now + 0.3) this.step1();
  },
  step1() { // schedule one sixteenth
    const s = this.song, i = this.i;
    if (i % 16 === 0) this.bv = [Math.random(), Math.random(), Math.random(), Math.random()];   // this bar's dice for variations
    const t = this.next + (i % 2 ? (s.swing || 0) * this.sd : 0);
    if (this.on && !SFX.muted) { try { s.step(i, t, this); } catch (e) { /* a bad note never stops the game */ } }
    this.i++; this.next += this.sd;
  },
  send(k, v, t) { const g = k === 'dly' ? this.ds : this.ch && this.ch[k] && this.ch[k].vs; if (g) g.gain.setTargetAtTime(v, t, 0.3); },
  sec(b, T) { let k = 0; while (k + 1 < T.length && T[k + 1][0] <= b) k++; return [T[k][1], b - T[k][0]]; },
  dia(n, k, sc) { // a note k scale steps from note name n, as Hz
    let m = noteMidi(n), s = Math.abs(k); const dir = Math.sign(k);
    while (s > 0) { m += dir; if (sc.includes(((m % 12) + 12) % 12)) s--; }
    return 440 * Math.pow(2, (m - 69) / 12);
  },
  /* ----- instruments: t = start time, f = Hz, v = level; ch = 'c' | 'l' | 'r' | 'lead' ----- */
  dest(ch) { return (this.ch && this.ch[ch || 'c']) || this.bus; },
  osc(t, f, dur, o = {}) {
    const ac = SFX.ac, osc = ac.createOscillator();
    if (o.wave) osc.setPeriodicWave(SFX.wave(o.wave)); else osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.from || f, t); if (o.from) osc.frequency.exponentialRampToValueAtTime(f, t + 0.03); if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    if (o.detune) osc.detune.value = o.detune;
    const g = ac.createGain(), v = o.vol || 0.1;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + (o.att || 0.005)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); let out = g;
    if (o.lp) { const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = o.lp; g.connect(fl); out = fl; }
    out.connect(this.dest(o.ch)); osc.start(t); osc.stop(t + dur + 0.05);
  },
  nz(t, dur, o = {}) {
    const ac = SFX.ac, src = ac.createBufferSource(); src.buffer = SFX.nb; src.loop = true;
    const fl = ac.createBiquadFilter(); fl.type = o.filter || 'highpass'; fl.frequency.setValueAtTime(o.f || 7000, t); fl.Q.value = o.q || 0.8; if (o.to) fl.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(o.vol || 0.03, t + (o.att || 0.004)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(fl); fl.connect(g); g.connect(this.dest(o.ch || 'r')); src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
  },
  hit(t, name, f, v, o = {}) { // a pre-rendered one-shot: two nodes
    const b = SFX.buf(name, f); if (!b) return;
    const ac = SFX.ac, src = ac.createBufferSource(), g = ac.createGain(); src.buffer = b.buf; src.playbackRate.value = b.rate * (o.rate || 1); g.gain.value = v;
    if (o.len) { g.gain.setValueAtTime(v, t + o.len); g.gain.exponentialRampToValueAtTime(0.0001, t + o.len + 0.06); }
    src.connect(g); g.connect(this.dest(o.ch)); src.start(t); if (o.len) src.stop(t + o.len + 0.08);
  },
  strum(t, name, notes, v, o = {}) { // a chord through one gain, each note a hair later than the last
    const ac = SFX.ac, g = ac.createGain(), len = o.len || 0.4; g.gain.value = v; g.gain.setValueAtTime(v, t + len); g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.06); g.connect(this.dest(o.ch || 'l'));
    notes.forEach((n, k) => { const f = typeof n === 'number' ? n : nf(n), b = SFX.buf(name, f); if (!b) return; const s = ac.createBufferSource(); s.buffer = b.buf; s.playbackRate.value = b.rate * (o.oct || 1); s.connect(g); s.start(t + k * (o.gap == null ? 0.008 : o.gap)); s.stop(t + len + 0.08); });
  },
  steel(t, f, v, len = 0.5, ch) { this.hit(t, 'steel', f, v * 1.1, { ch: ch || 'lead', len: Math.max(0.12, len) }); },
  marimba(t, f, v, ch) { this.hit(t, 'marimba', f, v * 1.1, { ch: ch || 'l' }); },
  pluck(t, f, v, ch) { this.hit(t, 'pluck', f, v * 1.2, { ch: ch || 'l' }); },
  bell(t, f, v, ch) { this.hit(t, 'bell', f, v, { ch: ch || 'lead' }); },
  bass(t, f, v, len = 0.3) { this.osc(t, f, len + 0.08, { wave: 'bass', vol: v, att: 0.006, from: f * 1.02, ch: 'c' }); },
  pad(t, f, v, len, o = {}) { // warm detuned saws, spread left/right, filter swelling open
    const ac = SFX.ac, a = o.att || len * 0.35, fs = (Array.isArray(f) ? f : [f]).map((n) => (typeof n === 'number' ? n : nf(n))), c = o.lp || 700;
    for (const [ch, det] of [['l', -7], ['r', 7]]) {
      const fl = ac.createBiquadFilter(), g = ac.createGain(); fl.type = 'lowpass'; fl.Q.value = 0.6;
      fl.frequency.setValueAtTime(c, t); fl.frequency.linearRampToValueAtTime(c * 2.2, t + a); fl.frequency.linearRampToValueAtTime(c, t + len);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + a); g.gain.setValueAtTime(v, t + len * 0.7); g.gain.linearRampToValueAtTime(0.0001, t + len);
      fl.connect(g); g.connect(this.dest(ch));
      for (const ff of fs) { const os = ac.createOscillator(); os.type = o.type || 'sawtooth'; os.frequency.value = ff; os.detune.value = det; os.connect(fl); os.start(t); os.stop(t + len + 0.05); }
    }
  },
  lead(t, f, v, len, o = {}) { // a breathy flute with delayed vibrato
    const ac = SFX.ac, os = ac.createOscillator(), lfo = ac.createOscillator(), lg = ac.createGain(), g = ac.createGain(), a = o.att || 0.045, end = t + len + 0.15;
    os.setPeriodicWave(SFX.wave(o.wave || 'flute')); os.frequency.setValueAtTime(o.from || f, t); if (o.from) os.frequency.exponentialRampToValueAtTime(f, t + 0.07);
    lfo.frequency.value = 5.2; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(o.vib == null ? 14 : o.vib, t + Math.min(0.35, len)); lfo.connect(lg); lg.connect(os.detune);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(v * 0.7, t + Math.max(a + 0.01, len)); g.gain.exponentialRampToValueAtTime(0.0001, end);
    os.connect(g); g.connect(this.dest(o.ch || 'lead')); os.start(t); lfo.start(t); os.stop(end + 0.02); lfo.stop(end + 0.02);
  },
  skank(t, notes, v, o = {}) { // a short chord chop: reggae guitar (bright) or organ bubble (o.wave 'organ', low f)
    const ac = SFX.ac, fl = ac.createBiquadFilter(), g = ac.createGain(), len = o.len || 0.1;
    fl.type = 'bandpass'; fl.frequency.value = o.f || 1500; fl.Q.value = 0.9;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    fl.connect(g); g.connect(this.dest(o.ch || 'r'));
    notes.forEach((n, k) => { const os = ac.createOscillator(); if (o.wave) os.setPeriodicWave(SFX.wave(o.wave)); else os.type = 'square'; os.frequency.value = nf(n) * (o.oct || 1); os.connect(fl); os.start(t + k * 0.006); os.stop(t + len + 0.05); });
  },
  stab(t, notes, v, len = 0.2, o = {}) { // a little horn section
    const ac = SFX.ac, fl = ac.createBiquadFilter(), g = ac.createGain();
    fl.type = 'lowpass'; fl.Q.value = 1.2; fl.frequency.setValueAtTime(500, t); fl.frequency.exponentialRampToValueAtTime(2800, t + 0.03); fl.frequency.exponentialRampToValueAtTime(900, t + len);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.015); g.gain.setValueAtTime(v, t + len * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.05);
    fl.connect(g); g.connect(this.dest(o.ch || 'l'));
    notes.forEach((n, k) => { const os = ac.createOscillator(); os.type = 'sawtooth'; os.frequency.value = nf(n); os.detune.value = k % 2 ? 8 : -8; os.connect(fl); os.start(t); os.stop(t + len + 0.1); });
  },
  strings(t, notes, v, len, trem, lp) { // a tremolo string cluster that swells and fades
    const ac = SFX.ac, fl = ac.createBiquadFilter(), g = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain();
    fl.type = 'lowpass'; fl.frequency.value = lp || 1200; fl.Q.value = 0.7;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + len * 0.5); g.gain.linearRampToValueAtTime(0.0001, t + len);
    lfo.frequency.value = trem || 8; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(v * 0.6, t + len * 0.5); lg.gain.linearRampToValueAtTime(0, t + len); lfo.connect(lg); lg.connect(g.gain);
    fl.connect(g); g.connect(this.dest('r'));
    notes.forEach((n, k) => { const os = ac.createOscillator(); os.type = 'sawtooth'; os.frequency.value = nf(n); os.detune.value = (k - 1) * 9; os.connect(fl); os.start(t); os.stop(t + len + 0.05); });
    lfo.start(t); lfo.stop(t + len + 0.05);
  },
  kick(t, v) { this.hit(t, 'kick', 0, v * 1.1, { ch: 'c' }); },
  snare(t, v) { this.hit(t, 'snare', 0, v * 1.2, { ch: 'c' }); },
  rim(t, v) { this.hit(t, 'rim', 0, v * 1.1, { ch: 'l' }); },
  hat(t, v) { this.hit(t, 'hat', 0, v * 1.1, { ch: 'r' }); },
  shk(t, v) { this.hit(t, 'shaker', 0, v, { ch: 'r' }); },
  clap(t, v) { this.hit(t, 'clap', 0, v, { ch: 'c' }); },
  conga(t, hi, v) { this.hit(t, 'conga', hi ? 330 : 220, v, { ch: 'l' }); },
  cow(t, v) { this.hit(t, 'cowbell', 0, v, { ch: 'r' }); },
  tom(t, f, v) { this.hit(t, 'tom', f, v, { ch: f > 150 ? 'l' : 'r' }); },
  crash(t, v) { this.hit(t, 'crash', 0, v, { ch: 'r' }); },
  boom(t, v) { this.hit(t, 'boom', 0, v, { ch: 'c' }); },
  low(t, f, v, len) { this.osc(t, f, len, { type: 'sawtooth', vol: v, att: 0.02, lp: 420 }); },
  fill(t, p, v, kind) { // drum fills across the back half of a bar
    if (p < 8) return;
    if (kind === 'conga') { const pat = { 8: 1, 9: 1, 10: 0, 11: 1, 12: 0, 13: 0, 14: 1, 15: 0 }; this.conga(t, pat[p], v * (0.7 + p / 40)); return; }
    if (kind === 'snare') { this.snare(t, v * (0.35 + (p - 8) * 0.09)); return; }
    const T = { 8: 220, 10: 196, 11: 175, 12: 147, 13: 131, 14: 110 }; if (T[p]) this.tom(t, T[p], v); if (p === 15) this.snare(t, v * 0.8);
  },
  // one sixteenth of an eight-slot melody row. o: voice ('steel' | 'lead' | 'marimba' | 'bell'), harm (scale: add a third below),
  // pick (scale: passing notes into a note after a rest), roll (steel-pan roll on long notes), oct (lift long phrase-end notes an octave)
  mel(t, p, row, v, o = {}) {
    const k = p >> 1, vo = o.voice || 'steel';
    const play = (tt, f, vv, len) => { if (vo === 'lead') this.lead(tt, f, vv, len); else if (vo === 'marimba') this.marimba(tt, f, vv, 'lead'); else if (vo === 'bell') this.bell(tt, f, vv); else this.steel(tt, f, vv, len); };
    if (p & 1) { if (o.pick && !row[k] && row[k + 1]) play(t, this.dia(row[k + 1], 1, o.pick), v * 0.5, this.sd * 1.2); return; }
    const n = row[k]; if (!n) return;
    let gap = 1; while (k + gap < 8 && !row[k + gap]) gap++;
    const lift = o.oct && gap >= 3 ? 2 : 1, f = nf(n) * lift, len = this.sd * 2 * gap;
    play(t, f, v, len);
    if (o.harm) play(t, this.dia(n, -2, o.harm) * lift, v * 0.5, len);
    if (o.roll && gap >= 2 && vo === 'steel') { const n32 = Math.min(6, gap * 4 - 2); for (let r = 1; r <= n32; r++) play(t + (r * this.sd) / 2, f, v * (0.5 - 0.03 * r), 0.16); }
  }
};
const KEY_C = [0, 2, 4, 5, 7, 9, 11], KEY_G = [7, 9, 11, 0, 2, 4, 6], KEY_EM = [4, 6, 7, 9, 11, 0, 2], KEY_F = [5, 7, 9, 10, 0, 2, 4];
const TITLE_MEL = [['E5', 'G5', 'A5', 'G5', 'E5', null, 'D5', 'C5'], ['D5', 'E5', 'G5', 'E5', 'D5', null, null, null], ['C5', 'E5', 'A5', 'G5', 'E5', null, 'C5', 'D5'], ['E5', 'D5', 'C5', 'A4', 'C5', null, null, null]];
const TITLE_B = [['A5', null, 'G5', 'F5', 'A5', null, 'C6', null], ['B5', null, 'A5', 'G5', 'D5', null, null, 'G5'], ['G5', null, 'E5', 'G5', 'B5', 'A5', 'G5', 'E5'], ['A5', null, 'E5', null, 'C5', null, null, null]];
const TITLE_B2 = [['F5', 'E5', 'D5', 'F5', 'A5', null, 'F5', null], ['G5', 'F5', 'D5', 'B4', 'D5', null, null, 'B4'], ['C5', 'E5', 'G5', 'C6', 'B5', 'G5', 'E5', null], ['D5', null, 'B4', 'D5', 'G5', null, null, null]];
const TITLE_FORM = ['I', 'A', 'A2', 'B', 'B2', 'A3', 'C', 'A4'];   // four bars each: a 32-bar loop
const BOAT_MEL = [['D5', null, 'B4', 'D5', 'E5', null, 'D5', null], ['B4', null, 'A4', 'G4', null, null, null, null], ['E5', null, 'D5', 'E5', 'G5', null, 'E5', 'D5'], ['B4', 'A4', 'G4', null, null, null, null, null]];
const BOAT_B = [['G5', null, 'E5', null, 'B4', null, 'E5', 'G5'], ['E5', null, 'C5', null, 'G4', null, null, null], ['D5', null, 'B4', 'D5', 'G5', null, 'F#5', 'E5'], ['D5', null, null, null, 'A4', null, null, null]];
const BOAT_FORM = ['G', 'A', 'G2', 'B', 'A2', 'D', 'B2', 'A3'];
const FIGHT_MEL = [['E5', null, 'B4', 'E5', 'G5', null, 'F#5', 'E5'], ['E5', null, 'C5', 'E5', 'G5', null, 'E5', null], ['F#5', null, 'D5', 'F#5', 'A5', null, 'G5', 'F#5'], ['D#5', null, 'B4', 'D#5', 'F#5', null, null, null]];
const FIGHT_B = [['A5', 'G5', 'E5', 'A5', 'C6', null, 'B5', 'A5'], ['G5', 'F#5', 'E5', 'G5', 'B5', null, 'G5', null], ['E5', 'G5', 'C6', 'G5', 'E5', null, 'G5', 'A5'], ['B5', null, 'A5', null, 'F#5', null, 'D#5', null]];
const RUN_MEL = [['G5', 'E5', 'G5', 'A5', 'G5', null, 'E5', 'D5'], ['C5', 'D5', 'E5', null, 'D5', 'C5', 'A4', null], ['G5', 'E5', 'G5', 'A5', 'C6', null, 'A5', 'G5'], ['E5', 'D5', 'C5', 'D5', 'C5', null, null, null]];
const RUN_B = [['A5', null, 'C6', 'A5', 'E5', null, 'A5', null], ['F5', 'G5', 'A5', null, 'C6', null, 'A5', 'F5'], ['G5', null, 'E5', 'G5', 'C6', null, 'B5', 'A5'], ['G5', null, 'D5', null, 'B4', null, 'D5', null]];
const RUN_B2 = [['A5', 'C6', 'A5', 'F5', 'C5', null, 'F5', 'A5'], ['B5', 'D6', 'B5', 'G5', 'D5', null, 'G5', 'B5'], ['G5', null, 'E5', null, 'B5', null, 'G5', 'E5'], ['A5', null, null, 'C6', 'E6', null, null, null]];
const RUN_SECS = [[0, 'I'], [2, 'A'], [6, 'A2'], [10, 'B'], [14, 'K'], [16, 'A3'], [20, 'B2'], [24, 'A4'], [28, 'O']];
const SUNSET_MEL = [['E5', null, null, 'D5', 'E5', null, 'G5', null], ['A5', null, null, null, 'G5', null, 'E5', null], ['F5', null, null, 'E5', 'F5', null, 'A5', null], ['G5', null, null, null, 'D5', null, null, null]];
const SUNSET_B = [['F5', null, 'E5', null, 'D5', null, 'A5', null], ['G5', null, null, 'F5', 'E5', null, 'B4', null], ['C5', null, 'E5', null, 'A5', null, 'G5', null], ['F5', null, null, null, 'D5', null, null, null]];
const SUNSET_FORM = ['A', 'M', 'B', 'M2', 'S', 'B2'];
const REEF_MEL = [['A5', null, null, null, 'G5', null, 'E5', null], ['B5', null, null, null, 'G5', null, null, null], ['A5', null, 'F5', null, 'C6', null, null, null], ['B5', null, 'G5', null, 'E5', null, null, null]];
const REEF_B = [['D6', null, null, 'C6', 'A5', null, null, null], ['C6', null, null, null, 'E5', null, 'G5', null], ['F5', null, 'G5', null, 'A5', null, 'Bb5', null], ['G5', null, null, null, null, null, null, null]];
const SONGS = {
  // menus and the chart: bright calypso. Intro, A, A', B, B', A + harmony, a congas breakdown, A again
  title: { bpm: 116, vol: 0.8, swing: 0.05, fx: { l: 0.16, r: 0.1, lead: 0.22, dly: 0.1, dt: 0.75, fb: 0.25 }, step(i, t, M) {
    const bar = i >> 4, p = i & 15, b = bar & 31, sec = TITLE_FORM[b >> 2], q = b & 3, rv = M.bv;
    const CH = sec === 'B' ? [['F2', ['C4', 'F4', 'A4']], ['G2', ['D4', 'G4', 'B4']], ['E2', ['E4', 'G4', 'B4']], ['A2', ['C4', 'E4', 'A4']]]
      : sec === 'B2' ? [['D3', ['D4', 'F4', 'A4']], ['G2', ['D4', 'G4', 'B4']], ['C3', ['C4', 'E4', 'G4']], ['G2', ['D4', 'F4', 'B4']]]
        : [['C3', ['C4', 'E4', 'G4']], ['G2', ['D4', 'G4', 'B4']], ['A2', ['C4', 'E4', 'A4']], ['F2', ['C4', 'F4', 'A4']]];
    const [root, tri] = CH[q], r = nf(root), brk = sec === 'C', fillBar = (b & 7) === 7;
    if (p === 0) M.bass(t, r, 0.3, 0.4); if (p === 6) M.bass(t, r, 0.2, 0.2); if (p === 8) M.bass(t, r * 1.5, 0.24, 0.35);
    if (p === 14) M.bass(t, rv[1] < 0.6 ? r : r * 2, 0.17, 0.2); if (p === 11 && sec[0] === 'B') M.bass(t, r * 1.5, 0.13, 0.15);
    if (!brk || q >= 2) { if (p === 0 || p === 8) M.kick(t, 0.22); if ((p === 4 || p === 12) && !(fillBar && p === 12)) M.rim(t, 0.1); }
    if (p % 2 === 0) M.shk(t, p % 4 === 2 ? 0.05 : 0.026); else if (p === 15 || (p === 7 && rv[2] < 0.5)) M.shk(t, 0.02);
    const cg = { 2: [1, 0.06], 6: [1, 0.08], 7: [0, 0.05], 10: [1, 0.06], 14: [1, 0.08], 15: [0, 0.06] }[p];
    if (cg && !(fillBar && p >= 8) && (sec !== 'I' || b > 0)) M.conga(t, cg[0], cg[1]);
    if (p % 4 === 2 && !(brk && q < 2 && p % 8 === 6)) M.strum(t, 'steel', tri, 0.032, { ch: 'l', len: 0.3 });
    if (sec === 'A2' && p >= 8 && p % 2 === 0 && p < 14) M.marimba(t, nf(tri[(p - 8) >> 1]) * 2, 0.045, 'r');
    if (sec === 'A') M.mel(t, p, TITLE_MEL[q], 0.085);
    else if (sec === 'A2') M.mel(t, p, TITLE_MEL[q], 0.085, { pick: rv[0] < 0.6 ? KEY_C : null, roll: rv[3] < 0.5 });
    else if (sec === 'B') M.mel(t, p, TITLE_B[q], 0.08, { roll: rv[3] < 0.35 });
    else if (sec === 'B2') M.mel(t, p, TITLE_B2[q], 0.08, { pick: KEY_C });
    else if (sec === 'A3') M.mel(t, p, TITLE_MEL[q], 0.08, { harm: KEY_C });
    else if (sec === 'C') M.mel(t, p, TITLE_MEL[q], 0.07, { voice: 'marimba' });
    else if (sec === 'A4') M.mel(t, p, TITLE_MEL[q], 0.085, { oct: q === 3 || rv[0] < 0.4, roll: true });
    if (fillBar) M.fill(t, p, 0.14, (b & 15) === 15 ? 'tom' : 'conga');
    if (p === 0 && (b & 7) === 0 && bar > 0) M.crash(t, 0.04);
  } },
  // underwater: slow, dreamy, filtered. A, A + glassy melody, B (new chords), B + melody; a flute takes the tune on the second pass
  reef: { bpm: 80, vol: 0.88, lp: 2600, muf: 1100, fx: { c: 0.08, l: 0.3, r: 0.3, lead: 0.42, dly: 0.2, dt: 1.5, fb: 0.35 }, step(i, t, M) {
    const bar = i >> 4, p = i & 15, b = bar & 15, sec = ['A', 'A2', 'B', 'B2'][b >> 2], q = b & 3, beat = 60 / 80, pass = (bar >> 4) & 1;
    const [root, ch] = (sec[0] === 'B' ? [['Bb1', ['Bb2', 'D3', 'F3', 'A3']], ['A1', ['A2', 'C3', 'E3', 'G3']], ['G1', ['G2', 'Bb2', 'D3', 'F3']], ['C2', ['C3', 'F3', 'G3', 'Bb3']]]
      : [['F2', ['F3', 'A3', 'C4', 'E4']], ['E2', ['E3', 'G3', 'B3', 'D4']], ['D2', ['D3', 'F3', 'A3', 'C4']], ['C2', ['C3', 'E3', 'G3', 'B3']]])[q];
    if (p === 0) { M.pad(t, ch, 0.024, beat * 4.2, { lp: 650 }); M.osc(t, nf(root), beat * 3, { vol: 0.2, att: 0.05 }); }
    if (p % 2 === 0 && p !== 10 && !(q === 3 && p >= 12)) { const k = (sec === 'A2' || sec === 'B2' ? [0, 1, 2, 3, 2, 3, 1, 2] : [0, 2, 1, 3, 2, 1, 3, 2])[p / 2]; M.pluck(t, nf(ch[k]) * 2, 0.034); }
    if (p === 10 && (bar % 2 || M.bv[0] < 0.3)) M.bell(t, nf(ch[3]) * 4, 0.012, 'r');
    if (p === 8) M.osc(t, nf(root) * 1.5, beat * 1.5, { vol: 0.1, att: 0.05 });
    if (q === 3 && p >= 12) M.pluck(t, nf(ch[p - 12]) * 4, 0.022, 'r');   // a little run of bubbles up the chord
    const row = sec === 'A2' ? REEF_MEL[q] : sec === 'B2' ? REEF_B[q] : null;
    if (row) { if (pass) M.mel(t, p, row, 0.05, { voice: 'lead' }); else M.mel(t, p, row, 0.045, { voice: 'bell' }); }
  } },
  // anchored up and fishing: laid-back reggae one-drop. Skank, organ bubble, dub echo; a dub breakdown midway
  boat: { bpm: 90, vol: 0.8, swing: 0.1, fx: { l: 0.14, r: 0.14, lead: 0.2, dly: 0.26, dt: 0.75, fb: 0.38 }, step(i, t, M) {
    const bar = i >> 4, p = i & 15, b = bar & 31, sec = BOAT_FORM[b >> 2], q = b & 3, rv = M.bv, dub = sec === 'D';
    const CH = sec === 'B' ? [['E2', ['B3', 'E4', 'G4']], ['C3', ['C4', 'E4', 'G4']], ['G2', ['B3', 'D4', 'G4']], ['D3', ['D4', 'F#4', 'A4']]]
      : sec === 'B2' ? [['E2', ['B3', 'E4', 'G4']], ['C3', ['C4', 'E4', 'G4']], ['A2', ['C4', 'E4', 'A4']], ['D3', ['D4', 'F#4', 'A4']]]
        : [['G2', ['B3', 'D4', 'G4']], ['C3', ['C4', 'E4', 'G4']], ['D3', ['D4', 'F#4', 'A4']], ['C3', ['C4', 'E4', 'G4']]];
    const [root, tri] = CH[q], r = nf(root);
    if (p === 0 && q === 0) { if (dub) { M.send('dly', 0.5, t); M.send('r', 0.35, t); } else if (sec === 'B2') { M.send('dly', 0.26, t); M.send('r', 0.14, t); } }
    if (p === 8) { M.kick(t, 0.3); M.rim(t, 0.13); }   // the one drop
    if (!dub && p % 2 === 0) M.hat(t, p % 4 === 2 ? 0.024 : 0.013);
    if (dub && p % 4 === 2 && q >= 2) M.hat(t, 0.016);
    if (p === 4 || p === 12) { if (!dub || rv[0] < 0.6) M.skank(t, tri, 0.05, { f: 1900, len: 0.09 }); if (!dub) M.strum(t, 'steel', tri, 0.026, { ch: 'l', len: 0.2 }); }
    if (!dub && p % 4 === 2) M.skank(t, tri, 0.022, { wave: 'organ', f: 800, len: 0.08, ch: 'l' });
    const bl = sec[0] === 'B' ? { 0: 1, 3: 1, 6: 1.5, 8: 1.5, 10: 2, 14: 1.335 } : { 0: 1, 3: 1, 6: 1.5, 10: 2, 12: 1.26, 14: 1.5 };
    if (bl[p] && !(dub && q % 2 === 1 && p > 6)) M.bass(t, r * bl[p], 0.26, 0.26);
    if (sec === 'A') M.mel(t, p, BOAT_MEL[q], 0.07);
    else if (sec === 'A2') M.mel(t, p, BOAT_MEL[q], 0.07, { roll: rv[3] < 0.5, pick: rv[0] < 0.5 ? KEY_G : null });
    else if (sec === 'A3') M.mel(t, p, BOAT_MEL[q], 0.068, { harm: KEY_G, oct: q === 3 });
    else if (sec === 'B') M.mel(t, p, BOAT_B[q], 0.068);
    else if (sec === 'B2') M.mel(t, p, BOAT_B[q], 0.066, { harm: KEY_G, roll: rv[3] < 0.4 });
    else if (sec === 'G2' && p >= 8 && p % 2 === 0 && p !== 14) M.marimba(t, nf(tri[[0, 1, 2][(p - 8) >> 1]]) * (q % 2 ? 1 : 2), 0.045, 'r');
    else if (dub && q % 2 === 0 && p < 4) M.mel(t, p, BOAT_MEL[q], 0.06);   // fragments, left to the echo
    if ((b & 7) === 7 && p >= 12) M.fill(t, p, 0.13, 'snare');
    if (p === 0 && (b & 7) === 0 && bar > 0 && !dub) M.crash(t, 0.03);
  } },
  // a fish is on: driving drums. A, A + riff, B (new chords, toms), A + riff in harmony; Music.intensity adds a shaker and lifts the riff
  fight: { bpm: 138, vol: 0.66, fx: { l: 0.1, r: 0.08, lead: 0.15, dly: 0.08, dt: 0.5, fb: 0.2 }, step(i, t, M) {
    const bar = i >> 4, p = i & 15, b = bar & 15, sec = ['A', 'A2', 'B', 'A3'][b >> 2], q = b & 3, k = M.intensity || 0, rv = M.bv;
    const [root, tri] = (sec === 'B' ? [['A2', ['A3', 'C4', 'E4']], ['E2', ['E4', 'G4', 'B4']], ['C3', ['C4', 'E4', 'G4']], ['B2', ['B3', 'D#4', 'F#4']]]
      : [['E2', ['E4', 'G4', 'B4']], ['C3', ['C4', 'E4', 'G4']], ['D3', ['D4', 'F#4', 'A4']], ['B2', ['B3', 'D#4', 'F#4']]])[q];
    const fillBar = (b & 7) === 7;
    if (p % 4 === 0) M.kick(t, 0.26); if ((p === 4 || p === 12) && !(fillBar && p > 8)) M.snare(t, 0.09);
    M.hat(t, p % 2 ? 0.026 : 0.014); if (k > 0.5 && p % 2) M.shk(t, 0.035 * k);
    if (p % 2 === 0) M.bass(t, nf(root) * (p % 4 === 2 ? 2 : 1), 0.2, 0.12);
    if (p === 3 || p === 6 || p === 10) M.strum(t, 'steel', tri, 0.026, { ch: 'l', len: 0.14 });
    if (sec === 'B' && (p === 7 || p === 14)) M.tom(t, p === 7 ? 147 : 110, 0.12);
    if (sec === 'A3' && p === 0) M.stab(t, tri, 0.026, 0.16);
    if (sec === 'A') { if (p % 4 === 0 && bar % 2) M.steel(t, nf(['B4', 'E5', 'D5', 'B4'][p / 4]), 0.05, 0.25); }
    else if (sec === 'A2') M.mel(t, p, FIGHT_MEL[q], 0.055, { oct: k > 0.7 });
    else if (sec === 'B') M.mel(t, p, FIGHT_B[q], 0.05, { roll: rv[3] < 0.4 });
    else M.mel(t, p, FIGHT_MEL[q], 0.052, { harm: KEY_EM, oct: k > 0.5 || q === 3 });
    if (fillBar) M.fill(t, p, 0.15, b === 15 ? 'tom' : 'snare');
    if (p === 0 && (b & 3) === 0 && bar > 0) M.crash(t, 0.04);
  } },
  // the shark is coming: two notes, faster as it gets closer; strings, booms and a high tick creep in with Music.intensity
  shark: { bpm: 100, vol: 0.95, lp: 7000, fx: { c: 0.06, l: 0.25, r: 0.25, lead: 0.3 }, step(i, t, M) {
    const bar = i >> 4, p = i % 16, k = M.intensity || 0, every = k > 0.7 ? 2 : k > 0.35 ? 4 : 8;
    if (i % every === 0) { const hi = Math.floor(i / every) % 2; M.low(t, hi ? 43.65 : 41.2, 0.32, every * 0.12); M.low(t, hi ? 87.3 : 82.4, 0.12, every * 0.1); }
    if (p === 0 || p === 3) M.kick(t, p ? 0.16 : 0.24);
    if (p === 0 && bar % 2 === 0 && k > 0.15) M.strings(t, ['E3', 'F3', 'B3'], 0.016 + 0.03 * k, M.sd * 32, 6 + 6 * k, 500 + 2500 * k);
    if (k > 0.5 && p % 2 === 1) M.osc(t, nf('E5') * (p % 4 === 1 ? 1 : 1.06), 0.1, { type: 'sawtooth', vol: 0.012, lp: 3000, ch: 'r' });
    if (k > 0.3 && p % 4 === 2) M.hat(t, 0.01 + 0.02 * k);
    if (p === 0 && bar % 4 === 0) M.boom(t, 0.18 + 0.14 * k); if (k > 0.75 && p === 8) M.boom(t, 0.2);
    if (p === 4 && M.bv[0] < 0.2 && k < 0.6) M.nz(t, 1.2, { filter: 'bandpass', f: 2200, to: 900, q: 9, vol: 0.02, att: 0.4, ch: 'l' });   // a far-off metallic scrape
    if (p === 12 && k > 0.6 && M.bv[1] < 0.5) M.bell(t, nf('F5'), 0.025, 'r');
  } },
  // running the boat: upbeat soca. Intro, A, A', B with horns, a break with a riser, A + harmony, B', A, horn-riff outro
  run: { bpm: 124, vol: 0.74, swing: 0.03, fx: { l: 0.12, r: 0.1, lead: 0.2, dly: 0.12, dt: 0.75, fb: 0.25 }, step(i, t, M) {
    const bar = i >> 4, p = i & 15, b = bar & 31, [sec, q0] = M.sec(b, RUN_SECS), q = q0 & 3, rv = M.bv;
    const CH = sec === 'B' ? [['A2', ['C4', 'E4', 'A4']], ['F2', ['C4', 'F4', 'A4']], ['C3', ['C4', 'E4', 'G4']], ['G2', ['B3', 'D4', 'G4']]]
      : sec === 'B2' ? [['F2', ['C4', 'F4', 'A4']], ['G2', ['B3', 'D4', 'G4']], ['E2', ['B3', 'E4', 'G4']], ['A2', ['C4', 'E4', 'A4']]]
        : sec === 'K' ? [['F2', ['C4', 'F4', 'A4']], ['G2', ['B3', 'D4', 'G4']]]
          : [['C3', ['C4', 'E4', 'G4']], ['F2', ['C4', 'F4', 'A4']], ['G2', ['B3', 'D4', 'G4']], ['C3', ['C4', 'E4', 'G4']]];
    const [root, tri] = CH[sec === 'K' ? q0 : q], r = nf(root), brk = sec === 'K', big = sec === 'A3' || sec === 'B2' || sec === 'A4' || sec === 'O';
    if (!brk && p % 4 === 0) M.kick(t, 0.24); if (brk && p === 0) M.kick(t, 0.2);
    if ((p === 4 || p === 12) && (big || brk)) M.clap(t, 0.07);
    if (p === 6 || p === 14) M.rim(t, 0.1);
    M.hat(t, p % 2 ? 0.03 : 0.012);
    if (sec !== 'I' && sec !== 'A' && !brk && p % 4 === 2) M.cow(t, 0.035);
    if (brk) { if (p === 0) M.bass(t, r, 0.22, M.sd * 7); if (p === 8) M.bass(t, r * 1.5, 0.18, M.sd * 7); }
    else { const bl = { 0: 1, 3: 1, 6: 1.5, 8: 1, 11: 1, 14: 2 }; if (bl[p]) M.bass(t, r * bl[p], 0.22, 0.18); }
    if (p % 4 === 2) M.strum(t, 'steel', tri, 0.03, { ch: 'l', len: 0.2 });
    if ((sec === 'B' || sec === 'B2') && (p === 0 || p === 6 || p === 10)) M.stab(t, tri, 0.03, p ? 0.1 : 0.22);
    if (sec === 'O' && (p === 0 || p === 3 || p === 6 || (p === 11 && q % 2))) M.stab(t, tri, 0.032, 0.12);
    if (sec === 'A') M.mel(t, p, RUN_MEL[q], 0.07);
    else if (sec === 'A2') M.mel(t, p, RUN_MEL[q], 0.07, { roll: rv[3] < 0.5, pick: rv[0] < 0.5 ? KEY_C : null });
    else if (sec === 'A3') M.mel(t, p, RUN_MEL[q], 0.066, { harm: KEY_C });
    else if (sec === 'A4') M.mel(t, p, RUN_MEL[q], 0.07, { oct: true, roll: rv[3] < 0.5 });
    else if (sec === 'B') M.mel(t, p, RUN_B[q], 0.066);
    else if (sec === 'B2') M.mel(t, p, RUN_B2[q], 0.066, { pick: KEY_C });
    if (brk && q0 === 1) { if (p === 0) M.nz(t, M.sd * 16, { filter: 'bandpass', f: 400, to: 5000, q: 2, vol: 0.03, att: M.sd * 14 }); M.fill(t, p, 0.14, 'snare'); }
    else if (q0 === 3 && p >= 8 && sec !== 'A') M.fill(t, p, 0.14, b === 31 ? 'tom' : 'conga');
    if (p === 0 && q0 === 0 && bar > 0 && sec !== 'K') M.crash(t, 0.04);
  } },
  // heading home: arpeggios, then a flute takes the tune; a quiet steel-only verse; a chime run to round it off
  sunset: { bpm: 76, vol: 0.8, fx: { c: 0.04, l: 0.22, r: 0.22, lead: 0.3, dly: 0.16, dt: 0.75, fb: 0.3 }, step(i, t, M) {
    const bar = i >> 4, p = i & 15, b = bar % 24, sec = SUNSET_FORM[b >> 2], q = b & 3, beat = 60 / 76, rv = M.bv;
    const [root, ch] = (sec[0] === 'B' ? [['D3', ['F4', 'A4', 'C5']], ['E3', ['G4', 'B4', 'D5']], ['F2', ['A3', 'C4', 'E4']], ['G2', ['B3', 'D4', 'F4']]]
      : [['C3', ['E4', 'G4', 'B4']], ['A2', ['C4', 'E4', 'G4']], ['F2', ['A3', 'C4', 'E4']], ['G2', ['B3', 'D4', 'E4']]])[q];
    if (p === 0) { M.pad(t, ch, sec === 'S' ? 0.026 : 0.02, beat * 4.2); M.bass(t, nf(root), 0.24, beat * 1.6); }
    if (p === 10) M.bass(t, nf(root) * 1.5, 0.15, beat);
    if (p % 2 === 0 && sec !== 'S') { const f = nf(ch[[0, 1, 2, 1, 0, 2, 1, 2][p / 2]]) * 2; if (sec[0] === 'B') M.marimba(t, f, 0.04, 'l'); else M.steel(t, f, 0.04, 0.6, 'l'); }
    if (p % 4 === 2 && sec !== 'S') M.shk(t, 0.02);
    if (p === 0 && (sec === 'M2' || sec === 'B2')) M.kick(t, 0.1);
    if (sec === 'M') M.mel(t, p, SUNSET_MEL[q], 0.06, { voice: 'lead' });
    else if (sec === 'M2') { M.mel(t, p, SUNSET_MEL[q], 0.055, { voice: 'lead' }); M.mel(t, p, SUNSET_MEL[q], 0.03, { voice: 'marimba' }); }
    else if (sec === 'B') M.mel(t, p, SUNSET_B[q], 0.058, { voice: 'lead' });
    else if (sec === 'B2') M.mel(t, p, SUNSET_B[q], 0.06, { roll: rv[3] < 0.6 });
    else if (sec === 'S') M.mel(t, p, SUNSET_MEL[q], 0.06, { roll: true });
    if (b === 23 && p >= 8 && p % 2 === 0) M.bell(t, nf(['C6', 'E6', 'G6', 'B6'][(p - 8) >> 1]) / 2, 0.03);
  } }
};

/* ---------- immediate-mode buttons ---------- */
const BTN = {
  primary: { fill: PAL.sun, shadow: PAL.sunDeep, color: PAL.ink },
  secondary: { fill: PAL.foam, shadow: '#9db3b9', color: PAL.ink },
  coral: { fill: PAL.coral, shadow: '#b8401f', color: '#fff' },
  dark: { fill: 'rgba(8,40,56,0.92)', shadow: 'rgba(0,0,0,0.35)', color: '#fff', line: 'rgba(255,255,255,0.22)' },
  ghost: { fill: 'rgba(255,255,255,0.08)', shadow: 'rgba(0,0,0,0)', color: '#fff', line: 'rgba(255,255,255,0.45)' }
};
const UI = {
  regions: [], prev: [], active: null,
  reset() { this.regions = []; this.prev = []; this.active = null; },
  beginFrame() { this.prev = this.regions; this.regions = []; },
  hit(x, y) {
    for (let i = this.prev.length - 1; i >= 0; i--) {
      const r = this.prev[i];
      if (!r.disabled && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r;
    }
    return null;
  },
  byId(id) { for (let i = this.prev.length - 1; i >= 0; i--) if (this.prev[i].id === id) return this.prev[i]; return null; },
  region(id, x, y, w, h, fn, o = {}) { this.regions.push({ id, x, y, w, h, fn, key: o.key, disabled: o.disabled }); },
  button(ctx, id, x, y, w, h, label, fn, o = {}) {
    const st = BTN[o.style || 'primary'];
    const pressed = this.active && this.active.id === id && this.active.inside;
    const dy = pressed ? 3 : 0; const r = o.r == null ? Math.min(16, h / 2) : o.r;
    ctx.save();
    if (o.disabled) ctx.globalAlpha = 0.45;
    if (st.shadow !== 'rgba(0,0,0,0)') { ctx.fillStyle = st.shadow; rr(ctx, x, y + 4, w, h, r); ctx.fill(); }
    ctx.fillStyle = o.fill || st.fill; rr(ctx, x, y + dy, w, h, r); ctx.fill();
    if (st.line || o.line) { ctx.strokeStyle = o.line || st.line; ctx.lineWidth = 2; ctx.stroke(); }
    if (o.selected) { ctx.strokeStyle = PAL.sun; ctx.lineWidth = 3; rr(ctx, x - 3, y - 3 + dy, w + 6, h + 6, r + 3); ctx.stroke(); }
    const cx = x + w / 2; let cy = y + h / 2 + dy;
    if (o.icon) { o.icon(ctx, x + h * 0.55, cy, h * 0.5); }
    const tx = o.icon ? x + h * 0.95 + (w - h * 0.95) / 2 : cx;
    if (o.sub) {
      text(ctx, label, tx, cy - 7, { size: o.size || 20, align: 'center', base: 'middle', color: o.color || st.color, weight: 800, maxW: w - 20 });
      text(ctx, o.sub, tx, cy + 13, { size: 13, align: 'center', base: 'middle', color: o.color || st.color, weight: 600, alpha: 0.75, maxW: w - 16 });
    } else {
      text(ctx, label, tx, cy + 1, { size: o.size || 20, align: 'center', base: 'middle', color: o.color || st.color, weight: 800, maxW: w - 18 });
    }
    ctx.restore();
    this.regions.push({ id, x, y, w, h, fn, key: o.key, disabled: o.disabled });
  }
};

/* ---------- particles + floating score text ---------- */
class Particles {
  constructor() { this.list = []; }
  add(p) { this.list.push(Object.assign({ x: 0, y: 0, vx: 0, vy: 0, g: 0, life: 1, t: 0, size: 3, color: '#fff', drag: 0, kind: 'dot', rot: 0, vr: 0 }, p)); }
  burst(x, y, n, o = {}) {
    for (let i = 0; i < n; i++) {
      const a = o.angle == null ? rand(0, TAU) : o.angle + rand(-(o.spread || 0.6), o.spread || 0.6);
      const s = rand(o.min || 40, o.max || 160);
      this.add(Object.assign({}, o, { x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(o.lifeMin || 0.4, o.lifeMax || 0.9), size: rand(o.sMin || 2, o.sMax || 5), rot: rand(0, TAU), vr: rand(-8, 8), color: Array.isArray(o.color) ? pick(o.color) : o.color }));
    }
  }
  update(dt) {
    for (const p of this.list) {
      p.t += dt; if (p.drag) { p.vx *= 1 - Math.min(1, p.drag * dt); p.vy *= 1 - Math.min(1, p.drag * dt); }
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    }
    this.list = this.list.filter((p) => p.t < p.life);
  }
  draw(ctx) {
    for (const p of this.list) {
      const k = 1 - p.t / p.life;
      ctx.globalAlpha = clamp(k * (p.alpha || 1), 0, 1);
      if (p.kind === 'bubble') {
        ctx.strokeStyle = 'rgba(230,250,255,0.9)'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(p.x - p.size * 0.35, p.y - p.size * 0.35, p.size * 0.3, 0, TAU); ctx.fill();
      } else if (p.kind === 'ring') {
        ctx.strokeStyle = p.color; ctx.lineWidth = p.lw || 2;
        ctx.beginPath(); ctx.ellipse(p.x, p.y, p.size + p.t * (p.grow || 60), (p.size + p.t * (p.grow || 60)) * (p.flat || 1), 0, 0, TAU); ctx.stroke();
      } else if (p.kind === 'confetti') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.color; ctx.fillRect(-p.size, -p.size * 0.4, p.size * 2, p.size * 0.8); ctx.restore();
      } else {
        ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (p.shrink ? k : 1), 0, TAU); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
}
class Floaters {
  constructor() { this.list = []; }
  add(x, y, s, color = '#fff', size = 22) { this.list.push({ x, y, s, color, size, t: 0 }); }
  update(dt) { for (const f of this.list) f.t += dt; this.list = this.list.filter((f) => f.t < 1.3); }
  draw(ctx) {
    for (const f of this.list) {
      const k = f.t / 1.3; const sc = f.t < 0.15 ? easeBack(f.t / 0.15) : 1;
      ctx.save(); ctx.translate(f.x, f.y - k * 46); ctx.scale(sc, sc);
      text(ctx, f.s, 0, 0, { size: f.size, align: 'center', base: 'middle', color: f.color, stroke: 'rgba(5,30,42,0.85)', sw: 5, weight: 800, alpha: 1 - Math.max(0, k - 0.6) / 0.4 });
      ctx.restore();
    }
  }
}

/* ---------- input ---------- */
const Input = {
  pointers: new Map(), keys: new Set(), hover: null,
  held(...codes) { for (const c of codes) if (this.keys.has(c)) return true; return false; },
  anyGameplayPointer() { for (const p of this.pointers.values()) if (!p.ui && p.scene === Game.scene) return p; return null; }
};

/* ---------- game shell ---------- */
const Game = {
  W: 960, H: 540, scale: 1, ox: 0, oy: 0, dpr: 1, cw: 1, ch: 1,
  canvas: null, ctx: null, wrap: null, scene: null, t: 0, last: 0,
  fade: 0, fadeDir: 0, next: null, shakeT: 0, shakeAmt: 0, toasts: [],
  reduced: false, portrait: false, touch: false, error: null,

  init(first) {
    const c = this.canvas = document.getElementById('game');
    this.ctx = c.getContext('2d'); this.wrap = c.parentElement;
    this.touch = ('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0;
    try { this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* ignore */ }
    const onResize = () => this.resize();
    window.addEventListener('resize', onResize);
    if (window.ResizeObserver) new ResizeObserver(onResize).observe(this.wrap);
    this.resize(); this.bindInput(); SFX.init(); Music.init();
    this.go(first, true);
    requestAnimationFrame((ts) => this.frame(ts));
  },
  resize() {
    const r = this.wrap.getBoundingClientRect();
    const cw = Math.max(1, r.width), ch = Math.max(1, r.height);
    this.cw = cw; this.ch = ch; this.portrait = ch > cw * 1.05;
    this.H = 540; this.W = Math.round(clamp(540 * (cw / ch), 720, 1280));
    this.scale = Math.min(cw / this.W, ch / this.H);
    this.ox = (cw - this.W * this.scale) / 2; this.oy = (ch - this.H * this.scale) / 2;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(cw * this.dpr); this.canvas.height = Math.round(ch * this.dpr);
    this.canvas.style.width = cw + 'px'; this.canvas.style.height = ch + 'px';
    if (typeof GL !== 'undefined') GL.resize();
    if (this.scene && this.scene.resize) this.scene.resize();
  },
  go(scene, instant) {
    if (instant || !this.scene) { this.switchTo(scene); this.fade = 1; this.fadeDir = -1; return; }
    this.next = scene; this.fadeDir = 1;
  },
  switchTo(scene) {
    if (this.scene && this.scene.exit) this.scene.exit();
    this.scene = scene; UI.reset(); this.toasts = []; this.error = null;
    SFX.setDrag(0); SFX.setEngine(0);
    if (scene.enter) scene.enter();
  },
  toast(msg, o = {}) {
    this.toasts = this.toasts.filter((t) => t.msg !== msg);
    this.toasts.push({ msg, t: 0, dur: o.dur || 1.6, color: o.color || '#fff', size: o.size || 34, y: o.y, sub: o.sub });
    if (this.toasts.length > 3) this.toasts.shift();
  },
  shake(a, d = 0.3) { this.shakeAmt = a; this.shakeT = d; },
  vibrate(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* ignore */ } },
  toLogical(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left - this.ox) / this.scale, y: (e.clientY - r.top - this.oy) / this.scale };
  },
  bindInput() {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => {
      e.preventDefault(); SFX.unlock();
      try { c.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      const p = this.toLogical(e);
      const ptr = { id: e.pointerId, x: p.x, y: p.y, sx: p.x, sy: p.y, t0: this.t, scene: this.scene, ui: null };
      this.pointers().set(e.pointerId, ptr);
      if (this.fadeDir === 1) { ptr.scene = null; return; }
      const r = UI.hit(p.x, p.y);
      if (r) { ptr.ui = r.id; UI.active = { id: r.id, pointer: e.pointerId, inside: true, fn: r.fn }; return; }
      this.safe(() => this.scene && this.scene.pointerDown && this.scene.pointerDown(ptr));
    }, { passive: false });
    c.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse') Input.hover = this.toLogical(e);
      const ptr = this.pointers().get(e.pointerId); if (!ptr) return;
      const p = this.toLogical(e); ptr.x = p.x; ptr.y = p.y;
      if (ptr.ui) { if (UI.active && UI.active.pointer === e.pointerId) { const r = UI.byId(ptr.ui); UI.active.inside = !!r && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h; } return; }
      if (ptr.scene === this.scene) this.safe(() => this.scene.pointerMove && this.scene.pointerMove(ptr));
    });
    const up = (e, cancel) => {
      const ptr = this.pointers().get(e.pointerId); if (!ptr) return;
      this.pointers().delete(e.pointerId);
      if (ptr.ui) {
        const a = UI.active; UI.active = null;
        if (!cancel && a && a.pointer === e.pointerId && a.inside && ptr.scene === this.scene && this.fadeDir !== 1) {
          SFX.play('click'); const r = UI.byId(ptr.ui); const fn = (r && r.fn) || a.fn; if (fn) this.safe(fn);
        }
        return;
      }
      if (ptr.scene === this.scene) this.safe(() => this.scene.pointerUp && this.scene.pointerUp(ptr, cancel));
    };
    c.addEventListener('pointerup', (e) => up(e, false));
    c.addEventListener('pointercancel', (e) => up(e, true));
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      SFX.unlock();
      if (e.repeat) return;
      Input.keys.add(e.code);
      if (this.fadeDir === 1) return;
      for (let i = UI.prev.length - 1; i >= 0; i--) {
        const r = UI.prev[i];
        if (r.key && !r.disabled && r.key.split('|').includes(e.code)) { SFX.play('click'); if (r.fn) this.safe(r.fn); return; }
      }
      this.safe(() => this.scene && this.scene.keyDown && this.scene.keyDown(e.code));
    });
    window.addEventListener('keyup', (e) => { Input.keys.delete(e.code); this.safe(() => this.scene && this.scene.keyUp && this.scene.keyUp(e.code)); });
    window.addEventListener('blur', () => { Input.keys.clear(); Input.pointers.clear(); UI.active = null; });
  },
  pointers() { return Input.pointers; },
  safe(fn) { try { fn(); } catch (err) { this.error = err; console.error(err); } },
  frame(ts) {
    const dt = Math.min(0.05, Math.max(0, (ts - (this.last || ts)) / 1000)); this.last = ts; this.t += dt;
    if (this.fadeDir === 1) { this.fade += dt / 0.22; if (this.fade >= 1) { this.fade = 1; const n = this.next; this.next = null; this.fadeDir = -1; this.safe(() => this.switchTo(n)); } }
    else if (this.fadeDir === -1) { this.fade -= dt / 0.3; if (this.fade <= 0) { this.fade = 0; this.fadeDir = 0; } }
    this.safe(() => this.scene && this.scene.update && this.scene.update(dt));
    if (Store.warnPending && this.scene && this.fadeDir === 0) { Store.warnPending = false; this.toast('This browser won’t save', { color: PAL.warn, size: 26, y: 260, dur: 4, sub: 'Private browsing or full storage. Your trip and logbook won’t be kept.' }); }
    for (const t of this.toasts) t.t += dt;
    this.toasts = this.toasts.filter((t) => t.t < t.dur);
    this.safe(() => this.draw(dt));
    requestAnimationFrame((t) => this.frame(t));
  },
  draw(dt) {
    const ctx = this.ctx, k = this.dpr;
    // a scene drawn in 3D (the boat ride) shows through: the WebGL canvas sits under this one
    const see3d = !!(this.scene && this.scene.uses3D && this.scene.uses3D());
    if (typeof GL !== 'undefined') GL.show(see3d);
    ctx.setTransform(k, 0, 0, k, 0, 0);
    if (see3d) ctx.clearRect(0, 0, this.cw, this.ch); else { ctx.fillStyle = '#041d29'; ctx.fillRect(0, 0, this.cw, this.ch); }
    let sx = 0, sy = 0;
    if (this.shakeT > 0) { this.shakeT -= dt; const a = this.shakeAmt * (this.reduced ? 0.15 : 1) * Math.min(1, this.shakeT * 4); sx = rand(-a, a); sy = rand(-a, a); }
    ctx.setTransform(k * this.scale, 0, 0, k * this.scale, k * (this.ox + sx * this.scale), k * (this.oy + sy * this.scale));
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, this.W, this.H); ctx.clip();
    UI.beginFrame();
    // a scene that throws while drawing must not take the frame (or the way out) with it
    ctx.save();
    try { if (this.scene && this.scene.draw) this.scene.draw(ctx); } catch (err) { if (!this.error) console.error(err); this.error = err; }
    ctx.restore();
    this.drawToasts(ctx);
    if (this.error) this.drawError(ctx);
    if (this.fade > 0) { ctx.fillStyle = `rgba(3,22,32,${this.fade})`; ctx.fillRect(0, 0, this.W, this.H); }
    ctx.restore();
    if (this.portrait && this.touch && this.oy > 40) {
      ctx.setTransform(k, 0, 0, k, 0, 0);
      ctx.font = fnt(16, 700); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillText('Turn your phone sideways for the full view', this.cw / 2, this.oy / 2);
    }
  },
  // the way out when something breaks: back to the title, or (if the title itself can't draw) drop the saved trip
  drawError(ctx) {
    const W = this.W, H = this.H, onTitle = typeof TitleScene !== 'undefined' && this.scene instanceof TitleScene;
    ctx.fillStyle = 'rgba(120,0,0,0.9)'; ctx.fillRect(0, H - 52, W, 52);
    text(ctx, 'Something broke: ' + String(this.error.message || this.error).slice(0, 90), 14, H - 20, { size: 15, color: '#fff', maxW: W - 250 });
    UI.button(ctx, 'err-out', W - 222, H - 46, 210, 40, onTitle ? 'Reset saved trip' : 'Back to title', () => {
      if (onTitle) Trip.clear();
      this.error = null; this.go(new TitleScene(), true);
    }, { style: 'secondary', size: 17 });
  },
  drawToasts(ctx) {
    const sc = this.scene; if (sc && (sc.paused || (sc.panel && sc.panel.kind !== 'chart'))) return;   // never on top of a pause menu
    const placed = [];
    for (const t of this.toasts) {
      const a = t.t < 0.18 ? easeBack(t.t / 0.18) : 1; const fadeOut = clamp((t.dur - t.t) / 0.3, 0, 1);
      const h = t.size + (t.sub ? 34 : 12);
      let y = t.y || 150;
      for (let guard = 0; guard < 6; guard++) { const hit = placed.find((p) => Math.abs(p.y - y) < (p.h + h) / 2); if (!hit) break; y = hit.y + (hit.h + h) / 2 + 4; }
      placed.push({ y, h });
      ctx.save(); ctx.translate(this.W / 2, y); ctx.scale(a, a); ctx.globalAlpha = fadeOut;
      text(ctx, t.msg, 0, 0, { size: t.size, display: true, align: 'center', base: 'middle', color: t.color, stroke: 'rgba(4,28,40,0.9)', sw: 8, maxW: this.W - 60 });
      if (t.sub) text(ctx, t.sub, 0, t.size * 0.85, { size: 18, align: 'center', base: 'middle', color: '#fff', stroke: 'rgba(4,28,40,0.9)', sw: 5, weight: 700, maxW: this.W - 60 });
      ctx.restore();
    }
  }
};
