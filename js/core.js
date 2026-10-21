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
  set(k, v) { try { window.localStorage.setItem('keyscrew_' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
  del(k) { try { window.localStorage.removeItem('keyscrew_' + k); } catch (e) { /* storage unavailable */ } }
};

/* ---------- audio: everything is synthesized, nothing to download ---------- */
const SFX = {
  ac: null, master: null, muted: false, nb: null, drag: null, amb: null,
  init() { this.muted = !!Store.get('muted', false); },
  unlock() {
    if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    try {
      const ac = this.ac = new AC();
      this.master = ac.createGain(); this.master.gain.value = this.muted ? 0 : 0.55; this.master.connect(ac.destination);
      const len = ac.sampleRate * 2; const buf = ac.createBuffer(1, len, ac.sampleRate); const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.nb = buf;
      // reel drag scream: band-passed noise chopped by a square LFO
      const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
      const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 1.4;
      const am = ac.createGain(); am.gain.value = 0.5;
      const lfo = ac.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 40;
      const lfoG = ac.createGain(); lfoG.gain.value = 0.5; lfo.connect(lfoG); lfoG.connect(am.gain);
      const g = ac.createGain(); g.gain.value = 0;
      src.connect(bp); bp.connect(am); am.connect(g); g.connect(this.master); src.start(); lfo.start();
      this.drag = { g, lfo, bp };
      // ambient wash of the sea
      const s2 = ac.createBufferSource(); s2.buffer = buf; s2.loop = true;
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600;
      const g2 = ac.createGain(); g2.gain.value = 0;
      s2.connect(lp); lp.connect(g2); g2.connect(this.master); s2.start();
      this.amb = { g: g2, lp };
    } catch (e) { this.ac = null; }
  },
  setMuted(m) { this.muted = m; Store.set('muted', m); if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.55, this.ac.currentTime, 0.05); },
  setDrag(level, pitch = 1) {
    if (!this.drag) return; const t = this.ac.currentTime;
    this.drag.g.gain.setTargetAtTime(clamp(level, 0, 1) * 0.2, t, 0.04);
    this.drag.lfo.frequency.setTargetAtTime(26 + 34 * pitch, t, 0.05);
    this.drag.bp.frequency.setTargetAtTime(2000 + 1400 * pitch, t, 0.05);
  },
  setAmbient(level, under) {
    if (!this.amb) return; const t = this.ac.currentTime;
    this.amb.g.gain.setTargetAtTime(level * 0.06, t, 0.4);
    this.amb.lp.frequency.setTargetAtTime(under ? 240 : 650, t, 0.4);
  },
  tone(f, dur, o = {}) {
    const ac = this.ac; if (!ac || this.muted) return;
    const t = ac.currentTime + (o.delay || 0);
    const osc = ac.createOscillator(); osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(f, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    const g = ac.createGain(); const v = o.vol == null ? 0.2 : o.vol;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + (o.att || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(this.master); osc.start(t); osc.stop(t + dur + 0.05);
  },
  noise(dur, o = {}) {
    const ac = this.ac; if (!ac || this.muted || !this.nb) return;
    const t = ac.currentTime + (o.delay || 0);
    const src = ac.createBufferSource(); src.buffer = this.nb;
    const f = ac.createBiquadFilter(); f.type = o.filter || 'lowpass'; f.frequency.setValueAtTime(o.f || 1000, t); f.Q.value = o.q || 1;
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    const g = ac.createGain(); const v = o.vol == null ? 0.25 : o.vol;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + (o.att || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
  },
  steel(f, delay, vol = 0.16) { // steel-pan-ish bell
    this.tone(f, 0.55, { delay, vol, type: 'sine' });
    this.tone(f * 2.01, 0.3, { delay, vol: vol * 0.35, type: 'sine' });
    this.tone(f * 3.9, 0.12, { delay, vol: vol * 0.12, type: 'triangle' });
  },
  play(name) {
    if (!this.ac || this.muted) return;
    switch (name) {
      case 'click': this.tone(700, 0.06, { type: 'triangle', vol: 0.12 }); break;
      case 'splash': this.noise(0.4, { f: 1600, to: 300, vol: 0.32 }); break;
      case 'bigsplash': this.noise(0.8, { f: 1400, to: 200, vol: 0.5 }); this.tone(90, 0.3, { vol: 0.2, to: 50 }); break;
      case 'plop': this.tone(320, 0.09, { to: 110, vol: 0.22 }); this.noise(0.12, { f: 900, vol: 0.08 }); break;
      case 'nibble': this.tone(420, 0.04, { type: 'square', vol: 0.05 }); this.tone(380, 0.04, { type: 'square', vol: 0.05, delay: 0.08 }); break;
      case 'bite': this.tone(150, 0.16, { vol: 0.4, to: 60 }); this.noise(0.1, { f: 400, vol: 0.2 }); break;
      case 'hookset': this.noise(0.14, { filter: 'highpass', f: 1800, vol: 0.25 }); this.tone(220, 0.12, { to: 520, type: 'sawtooth', vol: 0.1 }); break;
      case 'snap': this.noise(0.09, { filter: 'highpass', f: 3000, vol: 0.5 }); this.tone(1300, 0.16, { to: 180, type: 'square', vol: 0.1 }); break;
      case 'catch': [523, 659, 784, 1046].forEach((f, i) => this.steel(f, i * 0.09)); break;
      case 'trophy': [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => this.steel(f, i * 0.1, 0.18)); break;
      case 'coin': this.tone(988, 0.08, { type: 'square', vol: 0.05 }); this.tone(1319, 0.14, { type: 'square', vol: 0.05, delay: 0.07 }); break;
      case 'bubble': this.tone(rand(500, 900), 0.09, { to: 1500, vol: 0.06 }); break;
      case 'warn': this.tone(880, 0.12, { type: 'square', vol: 0.06 }); break;
      case 'sting': this.noise(0.2, { filter: 'highpass', f: 2500, vol: 0.2 }); this.tone(1500, 0.2, { to: 600, type: 'sawtooth', vol: 0.08 }); break;
      case 'chomp': this.tone(110, 0.16, { type: 'sawtooth', vol: 0.18, to: 60 }); this.noise(0.12, { f: 700, vol: 0.25 }); break;
      case 'tickle': this.tone(1700 + Math.random() * 500, 0.03, { type: 'triangle', vol: 0.035 }); break;
      case 'net': this.noise(0.28, { filter: 'bandpass', f: 700, to: 2200, vol: 0.22 }); break;
      case 'fail': this.tone(392, 0.18, { type: 'triangle', vol: 0.12 }); this.tone(330, 0.18, { type: 'triangle', vol: 0.12, delay: 0.16 }); this.tone(247, 0.35, { type: 'triangle', vol: 0.12, delay: 0.32 }); break;
      case 'cast': this.noise(0.32, { filter: 'bandpass', f: 3200, to: 700, vol: 0.14 }); break;
      case 'strip': this.noise(0.05, { filter: 'highpass', f: 2500, vol: 0.05 }); break;
      case 'horn': this.tone(196, 0.5, { type: 'sawtooth', vol: 0.07 }); this.tone(247, 0.5, { type: 'sawtooth', vol: 0.05 }); break;
      case 'tick': this.tone(2300, 0.02, { type: 'square', vol: 0.03 }); break;
      case 'slam': [392, 523, 659, 784, 1046, 1318, 1568].forEach((f, i) => this.steel(f, i * 0.08, 0.2)); break;
    }
  }
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
  pointers: new Map(), keys: new Set(),
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
    this.resize(); this.bindInput(); SFX.init();
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
    if (this.scene && this.scene.resize) this.scene.resize();
  },
  go(scene, instant) {
    if (instant || !this.scene) { this.switchTo(scene); this.fade = 1; this.fadeDir = -1; return; }
    this.next = scene; this.fadeDir = 1;
  },
  switchTo(scene) {
    if (this.scene && this.scene.exit) this.scene.exit();
    this.scene = scene; UI.reset(); this.toasts = [];
    SFX.setDrag(0);
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
    for (const t of this.toasts) t.t += dt;
    this.toasts = this.toasts.filter((t) => t.t < t.dur);
    this.safe(() => this.draw(dt));
    requestAnimationFrame((t) => this.frame(t));
  },
  draw(dt) {
    const ctx = this.ctx, k = this.dpr;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.fillStyle = '#041d29'; ctx.fillRect(0, 0, this.cw, this.ch);
    let sx = 0, sy = 0;
    if (this.shakeT > 0) { this.shakeT -= dt; const a = this.shakeAmt * (this.reduced ? 0.15 : 1) * Math.min(1, this.shakeT * 4); sx = rand(-a, a); sy = rand(-a, a); }
    ctx.setTransform(k * this.scale, 0, 0, k * this.scale, k * (this.ox + sx * this.scale), k * (this.oy + sy * this.scale));
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, this.W, this.H); ctx.clip();
    UI.beginFrame();
    if (this.scene && this.scene.draw) this.scene.draw(ctx);
    this.drawToasts(ctx);
    if (this.error) {
      ctx.fillStyle = 'rgba(120,0,0,0.85)'; ctx.fillRect(0, this.H - 34, this.W, 34);
      text(ctx, 'Something broke: ' + String(this.error.message || this.error).slice(0, 120), 12, this.H - 12, { size: 15, color: '#fff' });
    }
    if (this.fade > 0) { ctx.fillStyle = `rgba(3,22,32,${this.fade})`; ctx.fillRect(0, 0, this.W, this.H); }
    ctx.restore();
    if (this.portrait && this.touch && this.oy > 40) {
      ctx.setTransform(k, 0, 0, k, 0, 0);
      ctx.font = fnt(16, 700); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillText('Turn your phone sideways for the full view', this.cw / 2, this.oy / 2);
    }
  },
  drawToasts(ctx) {
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
