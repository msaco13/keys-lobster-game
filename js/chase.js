'use strict';
/* Keys Crew — the chase camera for the boat ride. The camera rides behind and above the boat, looking out to the horizon.
   Everything that lies flat on the water is drawn top-down into three heading-up textures (near, mid, far), and
   those are laid down a few screen rows at a time in perspective, mode-7 style. Things that stand up (trees, houses,
   posts, the lighthouse, bridges, boats, birds) are projected and painted far to near on top. The boats are little
   3D models, so they look right from any angle. */

const CAM = {
  F: 560, BOAT_SY: 398,                     // focal length, and the screen row the boat sits on
  low: { H: 118, P: 0.255, B: 272 },        // on plane: camera low and long
  high: { H: 158, P: 0.31, B: 262 },        // idling around: a little higher to see over things
  NEAR1: 700, MID1: 2400, FAR1: 9000,       // texture tiers, by distance ahead of the camera
  sN: 1, sM: 1 / 4, sF: 1 / 16
};
const SKIES = {
  morning: { top: [74, 152, 214], hor: [222, 236, 238], haze: [190, 222, 230], sun: [0.55, 0.22] },
  day: { top: [52, 132, 208], hor: [206, 232, 244], haze: [178, 214, 230], sun: [1.75, 0.55] },
  afternoon: { top: [66, 136, 200], hor: [240, 228, 200], haze: [206, 214, 210], sun: [2.25, 0.3] },
  sunset: { top: [52, 70, 130], hor: [255, 178, 112], haze: [220, 170, 140], sun: [2.75, 0.07] }
};
const rgbs = (c, a) => (a == null ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`);
const hexRGB = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

/* ---------- the boat as a little 3D model: x forward, y to starboard, z up, in world units ---------- */
const BOAT3D = (() => {
  const S = [[51, 0], [40, 9], [24, 15], [0, 17.4], [-30, 17.2], [-46, 16.6]];   // sheer line, bow to stern
  const Wl = [[44, 0], [34, 7], [20, 12.5], [0, 15], [-30, 15], [-46, 14.5]];   // waterline
  const at = (i, z) => { const k = z / 13; return [lerp(Wl[i][0], S[i][0], k), lerp(Wl[i][1], S[i][1], k)]; };
  const faces = [], hullC = [0, 0, 6];
  for (const side of [-1, 1]) for (let i = 0; i < 5; i++) for (const [z0, z1, c] of [[0, 2.5, 'boot'], [2.5, 8, 'hull'], [8, 10.5, 'stripe'], [10.5, 13, 'hull']]) {
    const a0 = at(i, z0), a1 = at(i + 1, z0), b1 = at(i + 1, z1), b0 = at(i, z1);
    faces.push({ c, o: hullC, p: [[a0[0], a0[1] * side, z0], [a1[0], a1[1] * side, z0], [b1[0], b1[1] * side, z1], [b0[0], b0[1] * side, z1]] });
  }
  for (const [z0, z1, c] of [[0, 2.5, 'boot'], [2.5, 8, 'hull'], [8, 10.5, 'stripe'], [10.5, 13, 'hull']]) { const w0 = lerp(14.5, 16.6, z0 / 13), w1 = lerp(14.5, 16.6, z1 / 13); faces.push({ c, o: hullC, p: [[-46, -w0, z0], [-46, w0, z0], [-46, w1, z1], [-46, -w1, z1]] }); }
  faces.push({ c: 'deck', o: [0, 0, -20], p: S.map(([x, y]) => [x, y, 12.5]).concat(S.slice(1).reverse().map(([x, y]) => [x, -y, 12.5])) });
  const box = (x0, x1, y0, y1, z0, z1, c, top = true) => {
    const o = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
    faces.push({ c, o, p: [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]] }, { c, o, p: [[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]] });
    faces.push({ c, o, p: [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]] }, { c, o, p: [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]] });
    if (top) faces.push({ c: c + 'Top', o, p: [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]] });
  };
  box(-6, 10, -7, 7, 12.5, 29, 'console');
  faces.push({ c: 'glass', o: [0, 0, 20], p: [[10, -7, 29], [10, 7, 29], [6, 7, 35], [6, -7, 35]] });
  box(-17, -10, -7, 7, 12.5, 23, 'seat');
  box(-56, -47, -11.5, -3.5, 2, 21, 'engine'); box(-56, -47, 3.5, 11.5, 2, 21, 'engine');
  box(-14, 12, -12, 12, 42, 45, 'ttop');
  const lines = [[[-12, -11, 13], [-12, -11, 42]], [[-12, 11, 13], [-12, 11, 42]], [[10, -11, 13], [10, -11, 42]], [[10, 11, 13], [10, 11, 42]],
    [[44, 0, 16], [30, -11, 16]], [[30, -11, 16], [12, -15.5, 16]], [[44, 0, 16], [30, 11, 16]], [[30, 11, 16], [12, 15.5, 16]]];
  return { faces, lines, crew: [[-13, -3.5], [-25, 8], [26, 0]] };
})();
const BOAT_COLS = { boot: [30, 40, 50], hull: [250, 251, 252], stripe: [31, 61, 107], deck: [222, 228, 232], console: [248, 250, 251], consoleTop: [236, 240, 243], glass: [40, 84, 120], seat: [214, 220, 225], seatTop: [64, 84, 104], engine: [52, 58, 64], engineTop: [80, 88, 96], ttop: [29, 53, 87], ttopTop: [36, 64, 104] };

const Chase = {
  yaw: 0, k: 0, c: null, spray: [], life: [], q: 1, slowT: 0, frames: 0,
  canvas(name, w, h) {
    let cv = this[name]; if (!cv) cv = this[name] = document.createElement('canvas');
    w = Math.max(16, Math.ceil(w)); h = Math.max(16, Math.ceil(h));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    return cv;
  },
  reset(s) { this.yaw = s.h; this.k = s.v > 150 ? 1 : 0; this.spray = []; this.life = []; },
  sky(s) { const legs = s.c.legs || 0; return s.homeRun ? SKIES.sunset : legs === 0 ? SKIES.morning : legs >= 3 ? SKIES.afternoon : SKIES.day; },

  /* ---------- camera ---------- */
  update(s, dt) {
    this.yaw += angleDiff(this.yaw, s.h) * (1 - Math.exp(-2.6 * dt));
    this.k = approach(this.k, clamp((s.v - 60) / 170, 0, 1), 1.3, dt);
    // spray: off the bow when we're running, a fan off the outside of a hard turn, and churn behind the engines
    const ca = Math.cos(s.h), sa = Math.sin(s.h), v = s.v, add = (lx, ly, vx, vy, vz, r, life) => {
      if (this.spray.length > 160) return;
      this.spray.push({ x: s.x + ca * lx - sa * ly, y: s.y + sa * lx + ca * ly, z: 2, vx: ca * vx - sa * vy, vy: sa * vx + ca * vy, vz, r, t: 0, life });
    };
    if (!s.air && v > 110 && chance(dt * v * 0.12)) { const side = chance(0.5) ? 1 : -1; add(22, side * 15, v * 0.25, side * rand(60, 120), rand(50, 110), rand(3, 6), rand(0.5, 0.8)); }
    if (!s.air && v > 120 && Math.abs(s.rudder) > 0.4 && chance(dt * 30)) { const side = s.rudder > 0 ? -1 : 1; add(-10, side * 17, 0, side * rand(80, 150), rand(60, 130), rand(4, 8), rand(0.5, 0.9)); }
    if (!s.air && v > 40 && chance(dt * (8 + v * 0.08))) add(-58, rand(-8, 8), v * 0.2, rand(-20, 20), rand(30, 30 + v * 0.35), rand(3, 5 + v * 0.02), rand(0.4, 0.7));
    // wildlife along the way: a turtle coming up to breathe, pelicans gliding the shoreline, gulls
    this.lifeT = (this.lifeT == null ? 3 : this.lifeT) - dt;
    if (this.lifeT <= 0 && World.ready) {
      this.lifeT = rand(5, 11);
      const ahead = rand(500, 1100), lat = rand(-420, 420), x = s.x + ca * ahead - sa * lat, y = s.y + sa * ahead + ca * lat, d = World.gridDepth(x, y), shore = Math.abs(y - chainY(x)) - shoreHW(x);
      const kind = d > 3 && d < 80 && chance(0.45) ? 'turtle' : shore < 1600 && chance(0.6) ? 'pelican' : 'gull';
      if (d > 0.5) this.life.push({ kind, x, y, h: kind === 'turtle' ? rand(0, TAU) : s.h + (lat > 0 ? -Math.PI / 2 : Math.PI / 2) + rand(-0.4, 0.4),   // birds cross in front of us
        z: kind === 'pelican' ? rand(18, 34) : kind === 'gull' ? rand(40, 70) : 0, t: 0, life: kind === 'turtle' ? 9 : 14, ph: rand(0, 9) });
    }
    for (const L of this.life) { L.t += dt; if (L.kind !== 'turtle') { const sp = L.kind === 'pelican' ? 70 : 90; L.x += Math.cos(L.h) * sp * dt; L.y += Math.sin(L.h) * sp * dt; } }
    this.life = this.life.filter((L) => L.t < L.life);
    for (const p of this.spray) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vz -= 320 * dt; p.vx *= 1 - dt * 1.5; p.vy *= 1 - dt * 1.5; }
    this.spray = this.spray.filter((p) => p.t < p.life && p.z > -2);
    // drop to cheaper textures if the device is struggling
    this.frames++;
    if (dt > 0.034) this.slowT += dt; else this.slowT = Math.max(0, this.slowT - dt * 0.5);
    if (this.q === 1 && this.slowT > 2.5 && this.frames > 120) { this.q = 0; this.slowT = 0; }
  },
  splash(s) { for (let i = 0; i < 26; i++) { const a = rand(0, TAU), sp = rand(40, 160); this.spray.push({ x: s.x + rand(-30, 30), y: s.y + rand(-20, 20), z: 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: rand(80, 200), r: rand(5, 10), t: 0, life: rand(0.6, 1) }); } },
  setup(s, W, H, t) {
    const k = this.k, lo = CAM.low, hi = CAM.high, yaw = this.yaw;
    const camH = lerp(hi.H, lo.H, k) + Math.sin(t * 1.6) * 1.6 * s.wind.chop, P = lerp(hi.P, lo.P, k), B = lerp(hi.B, lo.B, k), F = CAM.F - 40 * k;
    const ca = Math.cos(yaw), sa = Math.sin(yaw), cp = Math.cos(P), sp = Math.sin(P);
    const c = { x: s.x - ca * B, y: s.y - sa * B, yaw, ca, sa, H: camH, P, cp, sp, F, B, CX: W / 2, W, Hs: H };
    const Z = B * cp + camH * sp; c.CY = CAM.BOAT_SY - F * (camH * cp - B * sp) / Z; c.hor = c.CY - F * Math.tan(P);
    this.c = c; return c;
  },
  proj(x, y, h = 0) {
    const c = this.c, dx = x - c.x, dy = y - c.y, d = dx * c.ca + dy * c.sa, u = -dx * c.sa + dy * c.ca, q = c.H - h, Z = d * c.cp + q * c.sp;
    if (Z < 6) return null;
    return { x: c.CX + c.F * u / Z, y: c.CY + c.F * (q * c.cp - d * c.sp) / Z, z: Z, d, u, s: c.F / Z };
  },
  rowD(sy) { const c = this.c, k = (sy - c.CY) / c.F; return c.H * (c.cp - k * c.sp) / (k * c.cp + c.sp); },
  rowY(d) { const c = this.c; return c.CY + c.F * (c.H * c.cp - d * c.sp) / (d * c.cp + c.H * c.sp); },
  fog(Z) { return clamp((Z - 900) / 7800, 0, 0.88); },
  fogc(rgb, Z, a) { const f = this.fog(Z), h = this.haze; return rgbs([lerp(rgb[0], h[0], f), lerp(rgb[1], h[1], f), lerp(rgb[2], h[2], f)], a); },
  // world box covered by the view out to distance d1 (for culling)
  box(d0, d1, L) {
    const c = this.c; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const d of [d0, d1]) for (const u of [-L, L]) { const x = c.x + d * c.ca - u * c.sa, y = c.y + d * c.sa + u * c.ca; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    return { x0, y0, x1, y1 };
  },
  latW(d) { const c = this.c; return (c.W / 2 + 60) * (d * c.cp + c.H * c.sp) / c.F; },
  tierXf(g, s, d1, L) { const c = this.c; g.setTransform(-s * c.sa, -s * c.ca, s * c.ca, -s * c.sa, s * (L + c.sa * c.x - c.ca * c.y), s * (d1 + c.ca * c.x + c.sa * c.y)); },

  /* ---------- the frame ---------- */
  draw(s, ctx, W, H, t) {
    const c = this.setup(s, W, H, t), sky = this.sky(s);
    this.haze = sky.haze; this.t = t;
    this.drawSky(ctx, s, W, sky, t);
    // the three textures
    const dBot = this.rowD(H + 2) - 20;
    const tiers = [
      { name: 'near', s: this.q ? CAM.sN : 0.7, lo: dBot, hi: CAM.NEAR1 + 50 },
      { name: 'mid', s: CAM.sM, lo: CAM.NEAR1 - 50, hi: CAM.MID1 + 200 },
      { name: 'far', s: CAM.sF, lo: CAM.MID1 - 200, hi: CAM.FAR1 }
    ];
    for (const T of tiers) {
      T.L = this.latW(T.hi); const w = 2 * T.L * T.s, h = (T.hi - T.lo) * T.s;
      T.cv = this.canvas(T.name, w, h);
      const g = T.cv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0);
      this.tierXf(g, T.s, T.hi, T.L);
      const v = Object.assign(this.box(T.lo, T.hi, T.L), { z: 1, flat: true });
      if (T.name === 'near') {
        const sa = sky.sun[0], dd = 520;
        v.sun = { x: c.x + Math.cos(sa) * dd, y: c.y + Math.sin(sa) * dd, r: 300 };
        s.drawFlat(g, v, t);
      } else this.drawFarTier(g, v, s, T.name === 'mid');
    }
    // lay them down in perspective, a few rows at a time (thin rows near the horizon where things squeeze)
    const top = Math.max(0, Math.ceil(this.rowY(CAM.FAR1)));
    ctx.fillStyle = rgbs(lerp3(sky.haze, [20, 80, 130], 0.35)); ctx.fillRect(0, Math.floor(c.hor), W, top - Math.floor(c.hor) + 2);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'low';
    for (let y = top; y < H;) {
      const gap = y - c.hor, hs = gap < 150 ? 1 : 2, y1 = Math.min(H, y + hs);
      const dTop = this.rowD(y), dB = this.rowD(y1);
      const T = dTop <= tiers[0].hi ? tiers[0] : dTop <= tiers[1].hi ? tiers[1] : tiers[2];
      const Zm = ((dTop + dB) / 2) * c.cp + c.H * c.sp, um = Math.min(T.L, (W / 2 + 4) * Zm / c.F), ppu = c.F / Zm;
      const sy0 = T.s * (T.hi - Math.min(dTop, T.hi)), sy1 = T.s * (T.hi - Math.max(dB, T.lo)), sx0 = T.s * (T.L - um);
      if (sy1 - sy0 > 0.01) ctx.drawImage(T.cv, sx0, sy0, 2 * um * T.s, sy1 - sy0, c.CX - um * ppu, y, 2 * um * ppu, y1 - y + (y1 < H ? 0.6 : 0));
      y = y1;
    }
    // haze where the water meets the sky
    const hz = ctx.createLinearGradient(0, c.hor - 4, 0, c.hor + 46);
    hz.addColorStop(0, rgbs(sky.haze, 0.95)); hz.addColorStop(0.35, rgbs(sky.haze, 0.55)); hz.addColorStop(1, rgbs(sky.haze, 0));
    ctx.fillStyle = hz; ctx.fillRect(0, c.hor - 4, W, 50);
    // everything that stands up, far to near
    const items = [];
    this.gather(s, items, t);
    items.sort((a, b) => b.z - a.z);
    for (const it of items) { if (it.a != null && it.a < 1) { ctx.globalAlpha = it.a; it.f(ctx); ctx.globalAlpha = 1; } else it.f(ctx); }
  },
  drawSky(ctx, s, W, sky, t) {
    const c = this.c, hor = c.hor, g = ctx.createLinearGradient(0, 0, 0, hor + 2);
    g.addColorStop(0, rgbs(sky.top)); g.addColorStop(0.75, rgbs(lerp3(sky.top, sky.hor, 0.65))); g.addColorStop(1, rgbs(sky.hor));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, hor + 2);
    const dir = (az, el) => { const df = angleDiff(c.yaw, az), ce = Math.cos(el), se = Math.sin(el), fz = ce * Math.cos(df) * c.cp - se * c.sp; if (fz < 0.05) return null; return [c.CX + c.F * ce * Math.sin(df) / fz, c.CY + c.F * (-se * c.cp - ce * Math.cos(df) * c.sp) / fz]; };
    const sp = dir(sky.sun[0], sky.sun[1]);
    if (sp && sp[0] > -200 && sp[0] < W + 200) drawSun(ctx, sp[0], sp[1], s.homeRun ? 26 : 18, s.homeRun ? '#ffe2a8' : '#fffbe6');
    if (!this.clouds) { const r = mulberry(77); this.clouds = []; for (let i = 0; i < 18; i++) this.clouds.push({ az: r() * TAU, el: 0.035 + r() * 0.2, s: 0.9 + r() * 1.6, a: 0.55 + r() * 0.35 }); }
    for (const cl of this.clouds) {
      const p = dir(cl.az + t * 0.004, cl.el); if (!p || p[0] < -160 || p[0] > W + 160 || p[1] > hor) continue;
      const sc = cl.s * (0.6 + cl.el * 3);
      drawCloud(ctx, p[0], p[1], sc, cl.a * (s.homeRun ? 0.75 : 1));
      if (s.homeRun) { ctx.fillStyle = 'rgba(255,170,120,0.35)'; ell(ctx, p[0], p[1] + 8 * sc, 50 * sc, 7 * sc); ctx.fill(); }
    }
  },
  drawFarTier(g, v, s, mid) {
    const C = WORLD.CELL;
    g.fillStyle = '#0a3276'; g.fillRect(v.x0 - 50, v.y0 - 50, v.x1 - v.x0 + 100, v.y1 - v.y0 + 100);
    if (v.y0 < 200) { g.fillStyle = '#2f5a35'; g.fillRect(v.x0 - 50, v.y0 - 50, v.x1 - v.x0 + 100, 250 - v.y0); }
    g.imageSmoothingEnabled = true;
    g.drawImage(World.tex, 0, 0, World.gw, World.gh, 0, 0, World.gw * C, World.gh * C);
    World.drawCloudShadows(g, v, 1);
    g.fillStyle = '#2f5a35'; g.fill(World.mainland);
    for (const k of KEYS) { if (k.x + k.r < v.x0 || k.x - k.r > v.x1 || k.y + k.r < v.y0 || k.y - k.r > v.y1) continue; g.fillStyle = '#6b5a3c'; g.fill(k.path); g.fillStyle = '#2f6236'; g.fill(k.veg); }
    for (const I of ISLANDS) { if (I.x1 < v.x0 || I.x0 > v.x1) continue; g.fillStyle = '#d9c99a'; g.fill(I.path); g.fillStyle = '#5f8f4f'; g.fill(I.veg); }
    if (mid) { s.drawSwell(g, v, this.t); s.drawSpotRings(g, v, this.t); s.drawCourse(g, this.t, 16); }
  },

  /* ---------- things that stand up ---------- */
  gather(s, items, t) {
    const c = this.c, P = (x, y, h) => this.proj(x, y, h), W = c.W;
    const near = (x, y, r) => { const dx = x - c.x, dy = y - c.y; return dx * dx + dy * dy < r * r; };
    const onScreen = (p, m = 60) => p && p.x > -m && p.x < W + m;
    const fade = (d) => (d < c.B - 10 ? clamp((d - 20) / (c.B - 30), 0.22, 1) : 1);   // see-through between the camera and the boat
    const view = this.box(0, CAM.FAR1, this.latW(CAM.FAR1));
    // tree lines along both shores of every island, and along the mainland
    const wall = (sample, xa, xb, isTown) => {
      let chunk = [], x = xa;
      const flush = () => { if (chunk.length > 1) { const pts = chunk; let z = 0; for (const p of pts) z += p.b.z; z /= pts.length; items.push({ z, a: fade(pts[(pts.length / 2) | 0].b.d), f: (g) => this.drawWall(g, pts, z) }); } chunk = chunk.length ? [chunk[chunk.length - 1]] : []; };
      while (x <= xb) {
        const pt = sample(x), r = Math.hypot(pt[0] - c.x, pt[1] - c.y), step = clamp(r * 0.045, 22, 360);
        if (pt[2] === null || r > CAM.FAR1) { flush(); chunk = []; x += step; continue; }
        const b = P(pt[0], pt[1], 0), tp = P(pt[0], pt[1], pt[2]);
        if (!b || !tp || b.d < 12 || Math.abs(b.u) > b.d * 1.6 + 300) { flush(); chunk = []; x += step; continue; }
        chunk.push({ b, t: tp, w: step }); if (chunk.length >= 6) flush();
        x += step;
      }
      flush();
    };
    for (const I of ISLANDS) {
      const xa = Math.max(I.x0 + 8, view.x0), xb = Math.min(I.x1 - 8, view.x1, WORLD.W + 300); if (xb <= xa) continue;
      for (const side of [-1, 1]) wall((x) => {
        const hw = islandHW(I, x), town = TOWNS.some((T) => x > T.x0 && x < T.x1), n = vnoise(x * 0.009, side * 3 + I.x0 * 0.001);
        if (hw < 26 || (side > 0 && Math.abs(x - HOME.x) < 48)) return [x, 0, null];
        return [x, chainY(x) + side * (hw - 18), town ? 16 + 10 * n : 30 + 24 * n];
      }, xa, xb);
    }
    const mlY = wy(c.x, mainlandS(c.x));
    if (view.y0 < mlY + 400) wall((x) => [x, wy(x, mainlandS(x)) + 14, 40 + 26 * vnoise(x * 0.006, 9)], Math.max(-300, view.x0), Math.min(WORLD.W + 300, view.x1));
    // mangrove keys: low green domes
    for (const k of KEYS) {
      if (!near(k.x, k.y, 7500)) continue; const p = P(k.x, k.y, 0); if (!onScreen(p, 300) || p.d < 30) continue;
      items.push({ z: p.z, a: fade(p.d), f: (g) => this.drawKey(g, k, p) });
    }
    // houses and palms on the islands
    for (const h of World.houses) { if (!near(h.x, h.y, 2600)) continue; const p = P(h.x, h.y, 0); if (!onScreen(p) || p.d < 20) continue; items.push({ z: p.z, a: fade(p.d), f: (g) => this.drawHouse(g, h, p) }); }
    for (const pm of World.palms) { if (!near(pm.x, pm.y, 2400)) continue; const p = P(pm.x, pm.y, 0); if (!onScreen(p) || p.d < 20) continue; items.push({ z: p.z, a: fade(p.d), f: (g) => this.drawPalm(g, pm, p, t) }); }
    // channel posts, no-wake signs, trap floats, the wreck buoys
    for (const m of World.markers) { if (!near(m.x, m.y, 2600)) continue; const p = P(m.x, m.y, 0); if (!onScreen(p) || p.d < 10) continue; items.push({ z: p.z, a: fade(p.d), f: (g) => this.drawPost(g, m, p) }); }
    for (const sg of World.signs) { if (!near(sg.x, sg.y, 1800)) continue; const p = P(sg.x, sg.y, 0); if (!onScreen(p) || p.d < 10) continue; items.push({ z: p.z, f: (g) => this.drawSign(g, sg.x, sg.y, p) }); }
    for (let i = Math.floor((c.x - 1300) / 400); i <= Math.floor((c.x + 1300) / 400); i++) for (const f of World.floatBuckets.get(i) || []) {
      if (f.hit || !near(f.x, f.y, 1300)) continue; const p = P(f.x, f.y, 0); if (!onScreen(p) || p.d < 10) continue; items.push({ z: p.z, f: (g) => this.drawBall(g, f.x, f.y, p, f.c, f.st, 6, t + f.x) });
    }
    for (const b of World.wreckBuoys) { if (!near(b.x, b.y, 2000)) continue; const p = P(b.x, b.y, 0); if (!onScreen(p) || p.d < 10) continue; items.push({ z: p.z, f: (g) => this.drawBall(g, b.x, b.y, p, '#ffffff', '#2a5bd8', 8, t + b.x) }); }
    // Alligator Light, seen from miles off
    { const L = World.light, p = P(L.x, L.y, 0); if (p && near(L.x, L.y, 12000) && onScreen(p, 400)) items.push({ z: p.z, f: (g) => this.drawLight(g, L, t) }); }
    // the bridges: piers, then the deck in pieces so the boat can run under it
    for (const gp of GAPS) {
      if (gp.x1 < view.x0 - 100 || gp.x0 > view.x1 + 100 || !near(gp.x, gp.y, 8000)) continue;
      for (let x = gp.x0 - 20; x < gp.x1 + 20; x += 40) {
        const xb2 = Math.min(gp.x1 + 20, x + 40), p = P((x + xb2) / 2, chainY((x + xb2) / 2), 26); if (!p || p.d < 8 || !onScreen(p, 200)) continue;
        items.push({ z: p.z, f: (g) => this.drawDeck(g, x, xb2) });
      }
      for (const pr of World.piers) if (pr.g === gp) { const p = P(pr.x, pr.y, 0); if (!p || p.d < 8 || !onScreen(p, 100)) continue; items.push({ z: p.z + 2, f: (g) => this.drawPier(g, pr, p) }); }
      const lp = P(gp.x, gp.y, 70); if (lp && lp.z < 2600 && onScreen(lp)) items.push({ z: lp.z - 1, f: (g) => text(g, gp.name, lp.x, lp.y, { size: clamp(9 + 1500 / lp.z, 12, 18), align: 'center', color: '#fff', weight: 800, stroke: 'rgba(0,0,0,0.5)', sw: 4, alpha: clamp(1 - this.fog(lp.z), 0.3, 1) }) });
    }
    for (const car of World.cars) { if (!gapAt(car.x) || !near(car.x, chainY(car.x), 2500)) continue; const y = chainY(car.x) + (car.dir > 0 ? 6 : -6), p = P(car.x, y, 30); if (!onScreen(p) || p.d < 10) continue; items.push({ z: p.z - 0.5, f: (g) => this.drawCar(g, car, p) }); }
    // fishing spots: a buoy with a flag, and the name hanging over it
    if (!s.homeRun) for (const id of SPOT_ORDER) {
      if (!Charts.isKnown(id)) continue; const [x, y] = spotXY(id), p = P(x, y, 0); if (!p || p.d < 20) continue;
      if (p.z < 4500 && onScreen(p)) items.push({ z: p.z, f: (g) => this.drawSpotBuoy(g, x, y, p, t) });
      const lp = P(x, y, 70); if (lp && lp.z < 7000 && onScreen(lp, 0) && id !== s.dest) items.push({ z: Math.min(lp.z, 200), f: (g) => this.drawSpotLabel(g, s, id, lp) });
    }
    // other boats
    for (const B of s.boats) {
      if (B.dead || !near(B.x, B.y, 5200)) continue; const p = P(B.x, B.y, 0); if (!onScreen(p, 120) || p.d < 30) continue;
      items.push({ z: p.z, f: (g) => this.drawBoat(g, B.x, B.y, B.h, { hull: hexRGB(B.hull), scale: B.big ? 1.15 : 0.85, roll: Math.sin(t * 1.3 + B.x) * 0.03 }, p) });
    }
    if (s.fwc) {
      const k = easeOut(s.fwc.k), x = s.x - Math.cos(s.h) * lerp(400, 90, k) + Math.cos(s.h + Math.PI / 2) * 70, y = s.y - Math.sin(s.h) * lerp(400, 90, k) + Math.sin(s.h + Math.PI / 2) * 70, p = P(x, y, 0);
      if (p && p.d > 20) items.push({ z: p.z, f: (g) => { this.drawBoat(g, x, y, s.h, { hull: [240, 244, 248], stripe: [30, 80, 170], scale: 0.9 }, p); const lt = P(x, y, 52); if (lt) { const on = Math.floor(t * 8) % 2, r = 4 * lt.s + 2; g.fillStyle = on ? '#4aa0ff' : '#ffffff'; ell(g, lt.x - 8 * lt.s, lt.y, r, r); g.fill(); g.fillStyle = on ? '#ffffff' : '#ff4a4a'; ell(g, lt.x + 8 * lt.s, lt.y, r, r); g.fill(); text(g, 'FWC', lt.x, lt.y - 12 * lt.s - 6, { size: 14, align: 'center', color: '#fff', weight: 800, stroke: '#123a8a', sw: 4 }); } } });
    }
    // birds working the Hump
    { const [hx, hy] = HUMP_XY; if (near(hx, hy, 7000)) for (let i = 0; i < 3; i++) { const bx = hx + Math.cos(i * 2.1 + t * 0.05) * 280, by = hy + Math.sin(i * 2.1 + t * 0.05) * 180; for (let k = 0; k < 4; k++) { const a = t * (0.9 + k * 0.2) + k * 2 + i, p = P(bx + Math.cos(a) * 70, by + Math.sin(a) * 40, 70 + k * 14); if (p && onScreen(p) && p.d > 30) items.push({ z: p.z, f: (g) => drawFrigate(g, p.x, p.y, clamp(p.s * 1.6, 0.25, 2.2), t * 6 + k) }); } } }
    for (const L of this.life) {
      const p = P(L.x, L.y, 0); if (!p || p.d < 30 || !onScreen(p)) continue;
      const fadeL = Math.min(1, L.t, L.life - L.t);
      if (L.kind === 'turtle') items.push({ z: p.z, a: fadeL, f: (g) => this.drawSide(g, drawTurtleSide, p, L.h, L.t + L.ph) });
      else items.push({ z: p.z, a: fadeL, f: (g) => this.drawSide(g, L.kind === 'pelican' ? drawPelicanSide : drawGullSide, p, L.h, t * (L.kind === 'pelican' ? 2.2 : 5) + L.ph, L.z) });
    }
    // dolphins on the bow
    if (s.dolphins) {
      const D = s.dolphins, fadeD = Math.min(1, D.t * 2, (D.dur - D.t) * 2), ca = Math.cos(s.h), sa = Math.sin(s.h);
      for (const pd of D.pod) {
        const ph = t * 3 + pd.ph, x = s.x + ca * (pd.ox + 20) - sa * pd.oy, y = s.y + sa * (pd.ox + 20) + ca * pd.oy, p = P(x, y, 0);
        if (p) items.push({ z: p.z, a: fadeD, f: (g) => this.drawSide(g, drawDolphinSide, p, s.h, ph) });
      }
    }
    // our boat, and its spray
    const za = s.air ? Math.sin((s.air.t / s.air.dur) * Math.PI) : 0, bp = P(s.x, s.y, 0);
    if (bp) {
      const bob = Math.sin(t * (2 + s.wind.chop * 2)) * 0.035 * s.wind.chop * (s.v < 50 ? 1 : 0.4);
      const pitch = (s.v > 30 && s.v < 160 ? 0.07 * Math.sin(Math.PI * (s.v - 30) / 130) : 0.02 * this.k) + za * 0.12 + Math.sin(t * 2.3) * 0.012 * s.wind.chop;
      const roll = -s.rudder * clamp(s.v / 200, 0, 1) * 0.16 + bob;
      items.push({ z: bp.z, f: (g) => this.drawBoat(g, s.x, s.y, s.h, { roll, pitch, lift: za * 28, crew: s.crew, hero: true }, bp) });
      const fr = [], nr = [];
      for (const q of this.spray) { const p = P(q.x, q.y, q.z); if (!p) continue; (p.z > bp.z ? fr : nr).push([p, q]); }
      const puff = (list) => (g) => { for (const [p, q] of list) { const k = 1 - q.t / q.life; g.fillStyle = `rgba(255,255,255,${0.75 * k})`; ell(g, p.x, p.y, q.r * p.s * (1.2 - k * 0.4), q.r * p.s * 0.8); g.fill(); } };
      if (fr.length) items.push({ z: bp.z + 1, f: puff(fr) });
      if (nr.length) items.push({ z: bp.z - 1, f: puff(nr) });
    }
    // where we're headed
    const xy = s.destXY();
    if (xy && !s.panel) { const p = P(xy[0], xy[1], 120); if (p && p.d > 60) items.push({ z: 1, f: (g) => this.drawDestPin(g, s, xy, p, t) }); }
  },

  /* ---------- the billboards ---------- */
  drawWall(g, pts, z) {
    const dark = this.fogc([38, 82, 44], z), lite = this.fogc([78, 132, 66], z);
    const edge = (lift) => { for (let i = 1; i < pts.length; i++) { const a = pts[i - 1].t, b = pts[i].t, bump = Math.min(Math.abs(b.x - a.x) * 0.32, (pts[i].b.y - b.y) * 0.5); g.quadraticCurveTo((a.x + b.x) / 2, Math.min(a.y, b.y) - bump - lift, b.x, b.y - lift); } };
    g.fillStyle = dark; g.beginPath(); g.moveTo(pts[0].b.x, pts[0].b.y + 1);
    for (const p of pts) g.lineTo(p.b.x, p.b.y + 1);
    for (let i = pts.length - 1; i >= 0; i--) g.lineTo(pts[i].t.x, pts[i].t.y);
    g.closePath(); g.fill();
    g.beginPath(); g.moveTo(pts[0].t.x, pts[0].t.y); edge(0); g.closePath(); g.fill();
    // sunlit tops of the canopy
    g.fillStyle = lite; g.beginPath(); g.moveTo(pts[0].t.x, pts[0].t.y);
    edge(0);
    for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; g.lineTo(p.t.x, p.t.y + (p.b.y - p.t.y) * 0.35); }
    g.closePath(); g.fill();
  },
  drawKey(g, k, p) {
    const c = this.c, nx = -c.sa, ny = c.ca, cr = Math.cos(k.rot), sr = Math.sin(k.rot);
    const lat = Math.hypot(k.rx * (cr * nx + sr * ny), k.ry * (-sr * nx + cr * ny)), dep = Math.hypot(k.rx * (cr * c.ca + sr * c.sa), k.ry * (-sr * c.ca + cr * c.sa));
    const T = 18 + Math.min(k.rx, k.ry) * 0.18, tp = this.proj(k.x, k.y, T), fr = this.proj(k.x - c.ca * dep * 0.9, k.y - c.sa * dep * 0.9, 0); if (!tp || !fr) return;
    const w = lat * 0.92 * p.s, x = p.x, yb = p.y, yt = tp.y - (fr.y - p.y) * 0.25;
    g.fillStyle = this.fogc([36, 78, 42], p.z); g.beginPath(); g.moveTo(x - w, yb);
    g.bezierCurveTo(x - w * 0.9, yt, x + w * 0.9, yt, x + w, yb); g.quadraticCurveTo(x, fr.y + (fr.y - yb) * 0.3, x - w, yb); g.fill();
    g.fillStyle = this.fogc([70, 124, 62], p.z); g.beginPath(); g.moveTo(x - w * 0.82, yb - (yb - yt) * 0.45);
    g.bezierCurveTo(x - w * 0.7, yt - 1, x + w * 0.7, yt - 1, x + w * 0.82, yb - (yb - yt) * 0.45); g.quadraticCurveTo(x, yb - (yb - yt) * 0.6, x - w * 0.82, yb - (yb - yt) * 0.45); g.fill();
  },
  drawHouse(g, h, p) {
    const top = this.proj(h.x, h.y, 15), roof = this.proj(h.x, h.y, 24); if (!top || !roof) return;
    const w = Math.max(h.w, h.h) * 0.9 * p.s, x = p.x - w / 2;
    g.fillStyle = this.fogc(h.canal ? [244, 236, 220] : [236, 230, 214], p.z); g.fillRect(x, top.y, w, p.y - top.y);
    g.fillStyle = this.fogc(hexRGB(h.roof), p.z); g.beginPath(); g.moveTo(x - w * 0.08, top.y); g.lineTo(p.x, roof.y); g.lineTo(x + w * 1.08, top.y); g.fill();
    if (w > 14) { g.fillStyle = this.fogc([60, 90, 110], p.z); const ww = w * 0.16, wh = (p.y - top.y) * 0.35; g.fillRect(x + w * 0.18, top.y + (p.y - top.y) * 0.25, ww, wh); g.fillRect(x + w * 0.66, top.y + (p.y - top.y) * 0.25, ww, wh); }
  },
  drawPalm(g, pm, p, t) {
    const hgt = 50 + pm.r * 1.4, tp = this.proj(pm.x, pm.y, hgt); if (!tp) return;
    const lean = Math.sin(pm.a) * 10 * p.s, sw = Math.sin(t * 1.3 + pm.x) * 2 * p.s, s = tp.s;
    g.strokeStyle = this.fogc([120, 96, 70], p.z); g.lineWidth = Math.max(1, 3 * s); g.lineCap = 'round';
    g.beginPath(); g.moveTo(p.x, p.y); g.quadraticCurveTo(p.x + lean * 0.2, (p.y + tp.y) / 2, tp.x + lean + sw, tp.y); g.stroke();
    g.strokeStyle = this.fogc([62, 120, 52], p.z); g.lineWidth = Math.max(1, 3.4 * s);
    for (let i = 0; i < 6; i++) { const a = pm.a + i * 1.05, dx = Math.cos(a) * 20 * s, dy = Math.abs(Math.sin(a)) * 6 * s; g.beginPath(); g.moveTo(tp.x + lean + sw, tp.y); g.quadraticCurveTo(tp.x + lean + sw + dx * 0.6, tp.y - 6 * s, tp.x + lean + sw + dx, tp.y + dy + 7 * s); g.stroke(); }
  },
  drawPost(g, m, p) {
    const reef = m.kind === 'reef', white = m.kind === 'white', hgt = reef ? 52 : white ? 24 : 34, tp = this.proj(m.x, m.y, hgt); if (!tp) return;
    const s = tp.s, fz = p.z;
    g.strokeStyle = this.fogc(white ? [236, 236, 230] : [92, 78, 60], fz); g.lineWidth = Math.max(1, 2.6 * s); g.lineCap = 'butt';
    g.beginPath(); g.moveTo(p.x, p.y + 1); g.lineTo(tp.x, tp.y); g.stroke();
    if (white) { g.fillStyle = this.fogc([250, 250, 246], fz); g.fillRect(tp.x - 4 * s, tp.y - 2 * s, 8 * s, 8 * s); return; }
    if (reef) {
      g.fillStyle = this.fogc([250, 250, 246], fz); g.beginPath(); g.moveTo(tp.x, tp.y - 12 * s); g.lineTo(tp.x + 9 * s, tp.y - 2 * s); g.lineTo(tp.x, tp.y + 8 * s); g.lineTo(tp.x - 9 * s, tp.y - 2 * s); g.fill();
      g.fillStyle = this.fogc([232, 116, 44], fz); g.fillRect(tp.x - 6 * s, tp.y - 4 * s, 12 * s, 4 * s);
      if (p.z < 1400) text(g, m.name, tp.x, tp.y - 16 * s - 4, { size: 13, align: 'center', color: '#fff', weight: 800, stroke: 'rgba(0,0,0,0.55)', sw: 4 });
      return;
    }
    const red = m.kind === 'red'; g.fillStyle = this.fogc(red ? [224, 58, 58] : [47, 154, 74], fz); g.beginPath();
    if (red) { g.moveTo(tp.x, tp.y - 15 * s); g.lineTo(tp.x + 9 * s, tp.y + 2 * s); g.lineTo(tp.x - 9 * s, tp.y + 2 * s); } else g.rect(tp.x - 8 * s, tp.y - 13 * s, 16 * s, 15 * s);
    g.fill();
    if (s > 0.9) text(g, String(m.n), tp.x, tp.y - 4 * s, { size: Math.min(16, 8 * s), align: 'center', base: 'middle', color: '#fff', weight: 800 });
  },
  drawSign(g, x, y, p) {
    const tp = this.proj(x, y, 34); if (!tp) return;
    const s = tp.s; g.strokeStyle = '#7a6a54'; g.lineWidth = Math.max(1, 2.4 * s); g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(tp.x, tp.y); g.stroke();
    g.fillStyle = '#fff'; rr(g, tp.x - 26 * s, tp.y - 16 * s, 52 * s, 18 * s, 3 * s); g.fill(); g.strokeStyle = '#ff7a1a'; g.lineWidth = Math.max(1, 2 * s); g.stroke();
    if (s > 0.55) text(g, 'NO WAKE', tp.x, tp.y - 7 * s, { size: Math.min(15, 9 * s), align: 'center', base: 'middle', color: '#1a1a1a', weight: 800 });
  },
  drawBall(g, x, y, p, col, stripe, r, ph) {
    const b = this.proj(x, y, r * 0.8 + Math.sin(ph * 2) * 1.2); if (!b) return;
    const rs = Math.max(1.2, r * b.s);
    g.fillStyle = 'rgba(0,30,50,0.25)'; ell(g, p.x, p.y + 1, rs * 1.3, rs * 0.35); g.fill();
    g.fillStyle = this.fogc(hexRGB(col), p.z); ell(g, b.x, b.y, rs, rs); g.fill();
    if (rs > 2.5) { g.fillStyle = this.fogc(hexRGB(stripe), p.z); g.fillRect(b.x - rs, b.y - rs * 0.25, rs * 2, rs * 0.5); g.fillStyle = 'rgba(255,255,255,0.45)'; ell(g, b.x - rs * 0.35, b.y - rs * 0.45, rs * 0.3, rs * 0.2); g.fill(); }
  },
  drawLight(g, L, t) {
    const c = this.c, legs = [], rings = [30, 80, 140, 200, 248];
    const at = (a, h) => { const r = lerp(44, 14, h / 250); return this.proj(L.x + Math.cos(a) * r, L.y + Math.sin(a) * r, h); };
    const base = this.proj(L.x, L.y, 0); if (!base) return;
    const fz = base.z, col = this.fogc([40, 40, 40], fz), wcol = this.fogc([242, 240, 234], fz), lw = Math.max(1, 2.2 * base.s);
    g.strokeStyle = col; g.lineWidth = lw; g.lineCap = 'round';
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU, p0 = at(a, 0), p1 = at(a, 250); if (p0 && p1) { g.beginPath(); g.moveTo(p0.x, p0.y); g.lineTo(p1.x, p1.y); g.stroke(); legs.push(a); } }
    g.lineWidth = Math.max(0.8, 1.4 * base.s);
    for (const h of rings) { g.beginPath(); for (let i = 0; i <= 8; i++) { const p = at((i / 8) * TAU, h); if (p) i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y); } g.stroke(); }
    // keeper's house on the first deck, then the lantern on top
    const k0 = this.proj(L.x, L.y, 34), k1 = this.proj(L.x, L.y, 56), top = this.proj(L.x, L.y, 250), lan = this.proj(L.x, L.y, 268), cap = this.proj(L.x, L.y, 280);
    if (k0 && k1) { const w = 26 * k0.s; g.fillStyle = wcol; g.fillRect(k0.x - w, k1.y, w * 2, k0.y - k1.y); g.fillStyle = this.fogc([60, 60, 60], fz); g.fillRect(k0.x - w * 1.1, k1.y - 2 * k0.s, w * 2.2, 3 * k0.s); }
    if (top && lan && cap) {
      const w = 11 * top.s; g.fillStyle = wcol; g.fillRect(top.x - w, lan.y, w * 2, top.y - lan.y);
      g.fillStyle = col; g.beginPath(); g.moveTo(top.x - w * 1.2, lan.y); g.lineTo(cap.x, cap.y); g.lineTo(top.x + w * 1.2, lan.y); g.fill();
      const fl = Math.max(0, Math.sin(t * 2.2)), r = w * (0.8 + fl * 1.8);
      if (fl > 0.1) { const gl = g.createRadialGradient(top.x, (top.y + lan.y) / 2, 0, top.x, (top.y + lan.y) / 2, r * 3); gl.addColorStop(0, `rgba(255,246,190,${0.8 * fl})`); gl.addColorStop(1, 'rgba(255,246,190,0)'); g.fillStyle = gl; g.fillRect(top.x - r * 3, (top.y + lan.y) / 2 - r * 3, r * 6, r * 6); }
    }
    if (base.z < 3200) text(g, 'Alligator Light', base.x, base.y + 18, { size: clamp(9 + 1600 / base.z, 12, 17), align: 'center', color: '#fff', weight: 800, stroke: 'rgba(0,0,0,0.5)', sw: 4 });
  },
  drawDeck(g, xa, xb) {
    const c = this.c, ya = chainY(xa), yb = chainY(xb), south = c.y > (ya + yb) / 2, sd = south ? 1 : -1;
    const q = (pts, col) => { const pp = pts.map(([x, y, h]) => this.proj(x, y, h)); if (pp.some((p) => !p)) return null; g.fillStyle = col; g.beginPath(); pp.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.closePath(); g.fill(); return pp; };
    const mid = this.proj((xa + xb) / 2, (ya + yb) / 2, 26); if (!mid) return;
    const fz = mid.z;
    q([[xa, ya - 15, 30], [xb, yb - 15, 30], [xb, yb + 15, 30], [xa, ya + 15, 30]], this.fogc([186, 182, 172], fz));
    q([[xa, ya + 15 * sd, 22], [xb, yb + 15 * sd, 22], [xb, yb + 15 * sd, 31], [xa, ya + 15 * sd, 31]], this.fogc([132, 128, 120], fz));
    const r0 = this.proj(xa, ya + 15 * sd, 34), r1 = this.proj(xb, yb + 15 * sd, 34);
    if (r0 && r1) { g.strokeStyle = this.fogc([210, 206, 196], fz); g.lineWidth = Math.max(1, 1.6 * mid.s); g.beginPath(); g.moveTo(r0.x, r0.y); g.lineTo(r1.x, r1.y); g.stroke(); }
  },
  drawPier(g, pr, p) {
    const c = this.c, tp = this.proj(pr.x, pr.y, 22); if (!tp) return;
    const w = 2 * (7 * Math.abs(-c.sa) + 26 * Math.abs(c.ca)) * 0.5 * p.s;
    g.fillStyle = this.fogc([128, 122, 110], p.z); g.fillRect(p.x - w / 2, tp.y, w, p.y - tp.y + 1);
    g.fillStyle = this.fogc([160, 154, 142], p.z); g.fillRect(p.x - w / 2, tp.y, w * 0.35, p.y - tp.y + 1);
  },
  drawCar(g, car, p) { const w = 12 * p.s, h = 6 * p.s; g.fillStyle = this.fogc(hexRGB(car.c), p.z); rr(g, p.x - w / 2, p.y - h, w, h, 2 * p.s); g.fill(); g.fillStyle = 'rgba(30,50,70,0.6)'; g.fillRect(p.x - w * 0.3, p.y - h * 0.95, w * 0.6, h * 0.4); },
  drawSpotBuoy(g, x, y, p, t) {
    const tp = this.proj(x, y, 50); if (!tp) return;
    const s = tp.s; g.strokeStyle = '#222'; g.lineWidth = Math.max(1, 2 * s); g.beginPath(); g.moveTo(p.x, p.y - 6 * s); g.lineTo(tp.x, tp.y); g.stroke();
    g.fillStyle = PAL.sun; g.beginPath(); g.moveTo(tp.x, tp.y); g.lineTo(tp.x + 22 * s, tp.y + 6 * s + Math.sin(t * 5) * 2 * s); g.lineTo(tp.x, tp.y + 12 * s); g.fill();
    const r = Math.max(2, 10 * p.s); g.fillStyle = PAL.coral; ell(g, p.x, p.y - r * 0.6, r, r * 0.9); g.fill(); g.fillStyle = '#fff'; g.fillRect(p.x - r, p.y - r * 0.8, r * 2, r * 0.35);
  },
  drawSpotLabel(g, s, id, lp) {
    const S = SPOTS[id], ok = spotAllowed(id, s.c), done = s.c.done.includes(id) && s.c.mode === 'crew', here = s.inSpot === id;
    const sz = clamp(10 + 2200 / lp.z, 12, 20), a = (ok ? 1 : 0.6) * clamp(1.15 - this.fog(lp.z) * 0.6, 0.55, 1);
    text(g, S.name, lp.x, lp.y, { size: sz, align: 'center', color: here ? PAL.sun : '#fff', weight: 800, stroke: PAL.ink, sw: 4, alpha: a });
    text(g, done ? 'Fished today' : S.kind, lp.x, lp.y + sz * 0.95, { size: sz * 0.75, align: 'center', color: done ? '#cfd8dc' : PAL.sun, weight: 800, stroke: PAL.ink, sw: 3, alpha: a });
  },
  // a side-view sprite for something heading `h`: squeezed when it's going straight away from us, facing the way it's crossing
  drawSide(g, fn, p, h, arg, lift = 0) {
    const rel = angleDiff(this.c.yaw, h), side = Math.sin(rel), sq = Math.max(0.42, Math.abs(side));
    g.save(); g.translate(p.x, p.y - lift * p.s); g.scale(sq, 1);
    fn(g, 0, 0, p.s * (side < 0 ? -1 : 1), arg, { haze: this.fog(p.z), hazeColor: rgbs(this.haze) });
    g.restore();
  },
  drawDestPin(g, s, xy, p, t) {
    const nm = dist(s.x, s.y, xy[0], xy[1]) / UNITS_PER_NM, y = clamp(p.y + Math.sin(t * 3) * 3, 92, this.c.hor + 60), x = clamp(p.x, 40, this.c.W - 40);
    if (p.x < -10 || p.x > this.c.W + 10) return;   // the HUD points the way when it's off to the side
    const name = s.dest === 'home' ? 'Home dock' : SPOTS[s.dest].name;
    g.save(); g.translate(x, y);
    g.fillStyle = 'rgba(255,214,90,0.95)'; g.beginPath(); g.moveTo(0, 10); g.lineTo(-9, -2); g.lineTo(0, -14); g.lineTo(9, -2); g.closePath(); g.fill(); g.strokeStyle = PAL.ink; g.lineWidth = 2; g.stroke();
    g.restore();
    text(g, name + ' · ' + nm.toFixed(1) + ' nm', x, y - 22, { size: 15, align: 'center', color: PAL.sun, weight: 800, stroke: PAL.ink, sw: 4 });
  },

  /* ---------- the boat model ---------- */
  drawBoat(g, bx, by, h, o, p0) {
    const c = this.c, sc = o.scale || 1, cr = Math.cos(o.roll || 0), sr = Math.sin(o.roll || 0), cpi = Math.cos(o.pitch || 0), spi = Math.sin(o.pitch || 0), ch = Math.cos(h), sh = Math.sin(h), lift = o.lift || 0;
    const far = p0.z > 2200 && !o.hero;
    if (far) {   // a speck: white hull, dark console
      const s = p0.s * sc, rel = angleDiff(c.yaw, h), w = (34 + 60 * Math.abs(Math.sin(rel))) * s;
      g.fillStyle = this.fogc(o.hull || [250, 250, 250], p0.z); ell(g, p0.x, p0.y - 5 * s, w / 2, 6 * s + 0.6); g.fill();
      g.fillStyle = this.fogc([40, 60, 80], p0.z); g.fillRect(p0.x - 5 * s, p0.y - 22 * s, 10 * s, 12 * s);
      return;
    }
    const W3 = (x, y, z) => {   // boat space to world space, after pitch and roll
      x *= sc; y *= sc; z *= sc;
      const x1 = x * cpi - z * spi, z1 = x * spi + z * cpi, y2 = y * cr - z1 * sr, z2 = y * sr + z1 * cr;
      return [bx + x1 * ch - y2 * sh, by + x1 * sh + y2 * ch, z2 + lift];
    };
    const cam = [c.x, c.y, c.H], L = [0.31, 0.57, 0.76];   // light from high overhead, a little toward the ocean
    const cols = Object.assign({}, BOAT_COLS, o.hull ? { hull: o.hull } : null, o.stripe ? { stripe: o.stripe } : null);
    const list = [];
    for (const f of BOAT3D.faces) {
      const wp = f.p.map(([x, y, z]) => W3(x, y, z)), oc = W3(f.o[0], f.o[1], f.o[2]);
      const ux = wp[1][0] - wp[0][0], uy = wp[1][1] - wp[0][1], uz = wp[1][2] - wp[0][2], vx = wp[2][0] - wp[0][0], vy = wp[2][1] - wp[0][1], vz = wp[2][2] - wp[0][2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      let cx = 0, cy = 0, cz = 0; for (const q of wp) { cx += q[0]; cy += q[1]; cz += q[2]; } cx /= wp.length; cy /= wp.length; cz /= wp.length;
      if (nx * (cx - oc[0]) + ny * (cy - oc[1]) + nz * (cz - oc[2]) < 0) { nx = -nx; ny = -ny; nz = -nz; }
      if (nx * (cam[0] - cx) + ny * (cam[1] - cy) + nz * (cam[2] - cz) <= 0) continue;
      const pp = []; let bad = false; for (const q of wp) { const pr = this.proj(q[0], q[1], q[2]); if (!pr) { bad = true; break; } pp.push(pr); } if (bad) continue;
      const nl = Math.hypot(nx, ny, nz) || 1, lam = 0.68 + 0.32 * Math.max(0, (nx * L[0] + ny * L[1] + nz * L[2]) / nl), base = cols[f.c];
      list.push({ z: pp.reduce((a, q) => a + q.z, 0) / pp.length, pp, col: f.c === 'glass' ? rgbs(base, 0.85) : this.fogc([base[0] * lam, base[1] * lam, base[2] * lam], p0.z) });
    }
    // crew standing at the console
    if (o.crew) o.crew.forEach((ch2, i) => {
      const pos = BOAT3D.crew[i]; if (!pos) return; const C = CHARS[ch2], f0 = W3(pos[0], pos[1], 12.5), f1 = W3(pos[0], pos[1], 30), hd = W3(pos[0], pos[1], 35);
      const a = this.proj(...f0), b = this.proj(...f1), e = this.proj(...hd); if (!a || !b || !e) return;
      list.push({ z: a.z - 0.5, person: true, f: () => {
        const w = 5.2 * a.s * sc; g.fillStyle = C.sleeve === 'mahi' ? '#5ec05a' : C.shirt; rr(g, b.x - w, b.y, w * 2, a.y - b.y, w * 0.6); g.fill();
        g.fillStyle = C.skin; g.fillRect(b.x - w * 1.25, b.y + w * 0.3, w * 0.4, (a.y - b.y) * 0.55); g.fillRect(b.x + w * 0.85, b.y + w * 0.3, w * 0.4, (a.y - b.y) * 0.55);
        const r = 3.6 * e.s * sc; g.fillStyle = C.head === 'cap' ? C.capColor : C.head === 'bald' ? C.skin : C.hair; ell(g, e.x, e.y, r, r * 1.05); g.fill();
        if (C.head === 'bald') { g.fillStyle = 'rgba(255,255,255,0.35)'; ell(g, e.x - r * 0.3, e.y - r * 0.4, r * 0.35, r * 0.22); g.fill(); }
      } });
    });
    list.sort((a, b) => b.z - a.z);
    g.lineJoin = 'round';
    for (const it of list) {
      if (it.person) { it.f(); continue; }
      g.fillStyle = it.col; g.beginPath(); it.pp.forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y))); g.closePath(); g.fill();
      if (o.hero) { g.strokeStyle = 'rgba(20,40,60,0.18)'; g.lineWidth = 1; g.stroke(); }
    }
    // rails and T-top legs
    g.strokeStyle = this.fogc([196, 204, 211], p0.z); g.lineWidth = Math.max(0.8, 1.3 * p0.s * sc); g.lineCap = 'round';
    for (const [a, b] of BOAT3D.lines) { const pa = this.proj(...W3(...a)), pb = this.proj(...W3(...b)); if (pa && pb) { g.beginPath(); g.moveTo(pa.x, pa.y); g.lineTo(pb.x, pb.y); g.stroke(); } }
  }
};
function lerp3(a, b, k) { return [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)]; }
