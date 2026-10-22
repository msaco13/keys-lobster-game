'use strict';
/* Keys Crew — the 3D groundwork shared by the boat ride (sea3d.js) and the fish fight (fight3d.js): one WebGL canvas
   under the 2D one, the graphics settings and the safeguards that keep phones smooth, a geometry builder, painted and
   computed textures, the sky, spray, and the boat and crew models. three.js is bundled in js/vendor.
   Everything is still made in code: shapes are built here and textures are painted or computed at startup. */

/* ---------- graphics settings and the safeguards ---------- */
const GFX = {
  // pr: pixels per CSS pixel (capped by the screen's own), veg: share of trees drawn, hi: the fancier shaders and extras
  TIERS: [
    { name: 'low', pr: 0.75, veg: 0.35, hi: false },
    { name: 'medium', pr: 1, veg: 0.6, hi: false },
    { name: 'high', pr: 1.5, veg: 0.85, hi: true },
    { name: 'max', pr: 2, veg: 1, hi: true }
  ],
  mode: 'auto', tier: 2, auto: false, showFps: false, fps: 0,
  load() {
    const m = Store.get('gfx', 'auto'); this.mode = ['auto', 'classic', '3d'].includes(m) ? m : 'auto';   // '3d': never falls back by itself (tests)
    this.tier = clamp(Store.get('gfxTier', 2) | 0, 0, 3); this.auto = !!Store.get('gfxAuto', false); this.showFps = !!Store.get('gfxFps', false);
  },
  setMode(m) { this.mode = m; Store.set('gfx', m); if (m !== 'classic') { this.auto = false; Store.del('gfxAuto'); } },
  setTier(t) { this.tier = clamp(t, 0, 3); Store.set('gfxTier', this.tier); },
  // the pause-menu switch
  toggle() {
    if (this.mode === 'classic') { this.setMode('auto'); if (GL.state === 'failed' && GL.why === 'slow') { GL.state = GL.r ? 'ready' : 'off'; GL.why = ''; } this.setTier(Math.min(this.tier, 1)); GL.applyTier(); }
    else { this.setMode('classic'); }
  },
  label() { return this.mode === 'classic' || (GL.state === 'failed' && GL.why !== 'slow') ? 'Graphics: classic' : 'Graphics: 3D'; },
  // the Graphics and Frame rate buttons, a row in the pause menus (the boat ride's and the fishing spots')
  pauseRow(ctx, cx, y) {
    const no3d = GL.state === 'failed' && GL.why !== 'slow';
    UI.button(ctx, 'gfx', cx - 130, y, 125, 44, this.label(), () => this.toggle(), { style: 'secondary', size: 15, disabled: no3d, sub: no3d ? 'no 3D on this device' : this.mode === 'classic' ? (this.auto ? 'set for speed' : 'lighter look') : 'tap for classic' });
    UI.button(ctx, 'fps', cx + 5, y, 125, 44, this.showFps ? 'Frame rate: on' : 'Frame rate: off', () => { this.showFps = !this.showFps; Store.set('gfxFps', this.showFps); }, { style: 'ghost', size: 15 });
  },
  // the on-screen readout: frames a second (once there's a reading), and how it's drawing
  readout(in3d, how) {
    const f = in3d && GL.fps ? GL.fps : this.fps;
    return (f ? Math.round(f) + ' fps' : 'measuring…') + ' · ' + (how || (in3d ? '3D ' + this.TIERS[this.tier].name + ' · ' + Math.min(this.TIERS[this.tier].pr, window.devicePixelRatio || 1) + 'x' : 'classic'));
  },
  // a frame counter for the on-screen readout (counts whatever is drawn, 2D or 3D)
  meter: { n: 0, t0: 0, last: 0 },
  count(now) {
    const M = this.meter; if (!M.t0 || now - M.last > 2500) { M.t0 = now; M.n = 0; }   // a slow phone's long frames still count; a hidden tab resets it (GL)
    M.last = now; M.n++; if (now - M.t0 >= 1000) { this.fps = (M.n * 1000) / (now - M.t0); M.n = 0; M.t0 = now; }
  }
};
GFX.load();

/* ---------- small helpers ---------- */
const hex3 = (h) => { const n = parseInt(h.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
const rgb3 = (c) => [c[0] / 255, c[1] / 255, c[2] / 255];
const mix3 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
const mul3 = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const crv = (a, b, c, d, t) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
function crPt(P, u) {   // Catmull-Rom through a list of [x, w] points, u in point-index units
  const i = Math.min(P.length - 2, Math.floor(u)), t = u - i, a = P[Math.max(0, i - 1)], b = P[i], c = P[i + 1], d = P[Math.min(P.length - 1, i + 2)];
  return [crv(a[0], b[0], c[0], d[0], t), Math.max(0, crv(a[1], b[1], c[1], d[1], t))];
}
/* ---------- geometry: everything is merged into a few meshes with vertex colors ---------- */
let V3a, V3b, M3a, Q0, ONE, UP;
class Geo {
  constructor() { this.p = []; this.n = []; this.c = []; this.u = []; this.i = []; }
  get count() { return this.p.length / 3; }
  add(g, m, col) {
    const P = g.attributes.position, N = g.attributes.normal, UV = g.attributes.uv, b = this.count, nm = M3a.getNormalMatrix(m);
    for (let k = 0; k < P.count; k++) {
      V3a.fromBufferAttribute(P, k).applyMatrix4(m); this.p.push(V3a.x, V3a.y, V3a.z);
      const cc = typeof col === 'function' ? col(V3a.x, V3a.y, V3a.z) : col; this.c.push(cc[0], cc[1], cc[2]);
      V3b.fromBufferAttribute(N, k).applyMatrix3(nm).normalize(); this.n.push(V3b.x, V3b.y, V3b.z);
      this.u.push(UV ? UV.getX(k) : 0, UV ? UV.getY(k) : 0);
    }
    if (g.index) for (let k = 0; k < g.index.count; k++) this.i.push(b + g.index.getX(k)); else for (let k = 0; k < P.count; k++) this.i.push(b + k);
    g.dispose(); return this;
  }
  at(x, y, z, ry = 0, sx = 1, sy = 1, sz = 1) { return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(UP, ry), new THREE.Vector3(sx, sy, sz)); }
  box(x, y, z, sx, sy, sz, col, ry = 0) { return this.add(new THREE.BoxGeometry(sx, sy, sz), this.at(x, y, z, ry), col); }
  ball(x, y, z, r, col, sx = 1, sy = 1, sz = 1, ws = 8, hs = 6) { return this.add(new THREE.SphereGeometry(1, ws, hs), this.at(x, y, z, 0, r * sx, r * sy, r * sz), col); }
  cyl(x, y, z, r0, r1, h, col, seg = 8) { return this.add(new THREE.CylinderGeometry(r1, r0, h, seg, 1), this.at(x, y + h / 2, z), col); }
  // a round bar from point a to point b
  rod(a, b, r0, r1, col, seg = 6) {
    const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), L = d.length(); if (L < 1e-4) return this;
    const m = new THREE.Matrix4().compose(new THREE.Vector3((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()), ONE);
    return this.add(new THREE.CylinderGeometry(r1, r0, L, seg, 1), m, col);
  }
  // a grid of points (rows of columns), smooth normals
  sheet(rows, col) {
    const g = new THREE.BufferGeometry(), pos = [], idx = [], nc = rows[0].length;
    for (const r of rows) for (const p of r) pos.push(p[0], p[1], p[2]);
    for (let j = 0; j < rows.length - 1; j++) for (let i = 0; i < nc - 1; i++) { const a = j * nc + i, b = a + 1, c = a + nc, d = c + 1; idx.push(a, b, d, a, d, c); }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    return this.add(g, new THREE.Matrix4(), col);
  }
  // flat triangles, given as a list of points three at a time
  tris(pts, col) {
    const g = new THREE.BufferGeometry(), pos = []; for (const p of pts) pos.push(p[0], p[1], p[2]);
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
    return this.add(g, new THREE.Matrix4(), col);
  }
  // a flat textured board: center c, unit vectors r (its right) and up, size w x h, uv rect [u0, v0, u1, v1]
  quad(c, r, up, w, h, uv, col = [1, 1, 1]) {
    const P = (a, b) => [c[0] + r[0] * a * w / 2 + up[0] * b * h / 2, c[1] + r[1] * a * w / 2 + up[1] * b * h / 2, c[2] + r[2] * a * w / 2 + up[2] * b * h / 2];
    const nx = r[1] * up[2] - r[2] * up[1], ny = r[2] * up[0] - r[0] * up[2], nz = r[0] * up[1] - r[1] * up[0], b = this.count;
    for (const [a, bb, u, v] of [[-1, -1, uv[0], uv[1]], [1, -1, uv[2], uv[1]], [1, 1, uv[2], uv[3]], [-1, 1, uv[0], uv[3]]]) { const p = P(a, bb); this.p.push(p[0], p[1], p[2]); this.n.push(nx, ny, nz); this.c.push(col[0], col[1], col[2]); this.u.push(u, v); }
    this.i.push(b, b + 1, b + 2, b, b + 2, b + 3); return this;
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    g.setIndex(this.i); g.computeBoundingSphere(); return g;
  }
}

/* ---------- textures, painted or computed once ---------- */
function canvasTex(w, h, paint, o = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = o.wrap ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping; t.anisotropy = o.aniso || 1; return t;
}
function tileFbm(S, per, oct, seed) {   // tileable value noise, normalized to 0..1
  const out = new Float32Array(S * S); let amp = 1;
  for (let o = 0; o < oct; o++, amp *= 0.5) {
    const p = per << o, h = (i, j) => hash2((((i % p) + p) % p) + seed * 131 + o * 17, (((j % p) + p) % p) + seed * 71);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const fx = (x / S) * p, fy = (y / S) * p, ix = Math.floor(fx), iy = Math.floor(fy), ux = fx - ix, uy = fy - iy, sx = ux * ux * (3 - 2 * ux), sy = uy * uy * (3 - 2 * uy);
      out[y * S + x] += amp * lerp(lerp(h(ix, iy), h(ix + 1, iy), sx), lerp(h(ix, iy + 1), h(ix + 1, iy + 1), sx), sy);
    }
  }
  let lo = 1e9, hi = -1e9; for (const v of out) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  for (let i = 0; i < out.length; i++) out[i] = (out[i] - lo) / (hi - lo || 1);
  return out;
}
function dataTex(w, h, data, o = {}) {
  const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.wrapS = t.wrapT = o.wrap ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping; t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = o.aniso || 1; t.needsUpdate = true; return t;
}

/* ---------- shaders both scenes use ---------- */
const GLSL_SKY = `
uniform vec3 uTop, uHor, uHaze, uSunDir, uSunCol;
vec3 skyCol(vec3 d) { float e = d.y; vec3 c = mix(uHor, uTop, pow(smoothstep(0.0, 0.55, max(e, 0.0)), 0.8)); return mix(uHaze, c, smoothstep(-0.01, 0.045, e)); }`;
const SKY_VS = `varying vec3 vD; void main() { vD = position; gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0); }`;
const SKY_FS = `${GLSL_SKY}
uniform float uSunR;
varying vec3 vD;
void main() {
  vec3 d = normalize(vD), c = skyCol(d);
  float s = max(dot(d, uSunDir), 0.0);
  c += uSunCol * (pow(s, 10.0) * 0.2 + pow(s, 140.0) * 0.4);
  c = mix(c, uSunCol * 0.25 + vec3(0.92, 0.9, 0.82), smoothstep(cos(uSunR * 1.2), cos(uSunR), s));
  gl_FragColor = vec4(c, 1.0);
}`;
const SPRAY_VS = `attribute float aS; attribute float aA; uniform float uPx; varying float vA;
void main() { vec4 mv = viewMatrix * modelMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = max(1.0, aS * uPx / max(1.0, -mv.z)); vA = aA; }`;
const SPRAY_FS = `varying float vA; void main() { vec2 c = gl_PointCoord - 0.5; float r = dot(c, c) * 4.0; if (r > 1.0) discard; gl_FragColor = vec4(1.0, 1.0, 1.0, vA * (1.0 - r) * (1.0 - r)); }`;


/* ---------- the colors of things ---------- */
const COL3 = {
  sand: [0.86, 0.8, 0.62], grass: [0.36, 0.55, 0.3], townGrass: [0.46, 0.62, 0.36], mud: [0.42, 0.35, 0.24], glades: [0.2, 0.36, 0.21], keyGreen: [0.19, 0.38, 0.21], under: [0.82, 0.8, 0.66],
  hull: [0.98, 0.985, 0.99], boot: [0.12, 0.16, 0.2], bottom: [0.16, 0.24, 0.3], stripe: [0.12, 0.24, 0.42], deck: [0.93, 0.95, 0.95], inner: [0.96, 0.97, 0.97],
  console: [0.97, 0.98, 0.98], glass: [0.12, 0.24, 0.33], cushion: [0.2, 0.28, 0.38], canvas: [0.11, 0.21, 0.34], metal: [0.8, 0.83, 0.86], engine: [0.17, 0.19, 0.21], rod: [0.12, 0.12, 0.13],
  post: [0.42, 0.36, 0.28], white: [0.95, 0.95, 0.93], concrete: [0.78, 0.76, 0.72], concreteDark: [0.56, 0.55, 0.52], dock: [0.6, 0.48, 0.33], trunk: [0.47, 0.38, 0.27], frond: [0.27, 0.5, 0.22], wall: [0.93, 0.9, 0.84]
};

/* ---------- the canvas, the renderer, and holding the frame rate ---------- */
const GL = {
  state: 'off', why: '', r: null, cv: null, dirty: true, fps: 0, hz: 0, frameNo: 0, users: [],
  // true once there's a WebGL 2 renderer to draw with (made the first time a 3D scene asks)
  ensure() {
    if (GFX.mode === 'classic' || this.state === 'failed') return false;
    if (this.state === 'ready') return true;
    if (typeof THREE === 'undefined') return false;
    try { this.init(); this.state = 'ready'; return true; }
    catch (e) {
      console.warn('3D unavailable, using the classic view:', e && e.message);
      try { if (this.r) this.r.dispose(); } catch (e2) { /* nothing to free */ }
      if (this.cv) this.cv.remove(); this.r = null; this.cv = null; this.fail('init'); return false;
    }
  },
  init() {
    V3a = new THREE.Vector3(); V3b = new THREE.Vector3(); M3a = new THREE.Matrix3(); Q0 = new THREE.Quaternion(); ONE = new THREE.Vector3(1, 1, 1); UP = new THREE.Vector3(0, 1, 0);
    THREE.ColorManagement.enabled = false;   // colors go in exactly as the 2D game paints them
    const cv = (this.cv = document.createElement('canvas'));
    cv.setAttribute('aria-hidden', 'true'); cv.style.cssText = 'position:absolute;left:0;top:0;display:none;pointer-events:none;z-index:0';
    Game.wrap.insertBefore(cv, Game.wrap.firstChild);
    // ask for the context ourselves first: no WebGL 2, or only a software one, means the classic view, quietly
    const attrs = { alpha: false, antialias: true, depth: true, stencil: false, powerPreference: 'default', failIfMajorPerformanceCaveat: GFX.mode !== '3d' };
    const gl = cv.getContext('webgl2', attrs); if (!gl) throw new Error('no WebGL 2 here');
    const r = (this.r = new THREE.WebGLRenderer(Object.assign({ canvas: cv, context: gl }, attrs)));
    r.outputColorSpace = THREE.LinearSRGBColorSpace; r.toneMapping = THREE.NoToneMapping; r.setClearColor(0x9fc8de, 1);
    cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); console.warn('WebGL context lost: classic view for now'); this.fail('lost'); });
    // the browser hands the context back (after another tab hogged the GPU, or the phone slept): 3D picks up again.
    // three.js re-uploads everything on its next render.
    cv.addEventListener('webglcontextrestored', () => { if (this.why !== 'lost') return; this.state = 'ready'; this.why = ''; this.settle(); });
    this.resize();
  },
  fail(why) {
    this.state = 'failed'; this.why = why; this.show(false);
    if (why === 'slow') {
      GFX.setMode('classic'); GFX.auto = true; Store.set('gfxAuto', true);
      Game.toast('Classic graphics', { color: '#fff', size: 30, y: 196, dur: 4, sub: 'Switched to keep it smooth on this device. Pause → Graphics to try 3D again.' });
    }
  },
  show(on) { if (this.cv) { const d = on ? 'block' : 'none'; if (this.cv.style.display !== d) { this.cv.style.display = d; if (on) this.dirty = true; } } },
  resize() {
    if (!this.r) return;
    const w = Game.W * Game.scale, h = Game.H * Game.scale, s = this.cv.style;
    s.left = Game.ox + 'px'; s.top = Game.oy + 'px'; s.width = w + 'px'; s.height = h + 'px';
    this.r.setSize(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)), false);
    this.applyTier();
  },
  applyTier() {
    if (!this.r) return;
    const T = GFX.TIERS[GFX.tier];
    this.r.setPixelRatio(Math.min(T.pr, window.devicePixelRatio || 1));
    for (const u of this.users) if (u.onTier) u.onTier(T);
    this.dirty = true;
  },
  // Whether to draw a 3D frame now. On 120 Hz screens, 60 pictures a second is plenty: every other frame, to save the
  // battery. Under a menu (busy) the last picture just holds still.
  pace(now, busy) {
    this.frameNo++; this.trackHz(now);
    const skip = this.hz > 100 && this.frameNo % 2 === 1 && !this.dirty;
    return !skip && (!busy || this.dirty);
  },
  drew(now, busy) { this.dirty = false; this.tune(now, busy); },
  trackHz(now) {
    if (this.hz) return; const H = (this.hzS = this.hzS || { last: 0, d: [] });
    if (H.last) H.d.push(now - H.last); H.last = now;
    if (H.d.length >= 40) { H.d.sort((a, b) => a - b); this.hz = 1000 / H.d[20]; }
  },
  // the first moments of a new 3D scene (building, compiling shaders) don't count against the device
  settle() { Object.assign(this.perf, { last: 0, slow: 0, fast: 0, settle: 2, drop: null }); this.dirty = true; },
  // Once a second: if the picture is slow, drop the resolution and detail a step; if dropping didn't help (a screen
  // capped at 30, a phone in low-power mode), go back up and stop trying. At the lowest step and still slow, switch to
  // the classic view and say so. The step that works is remembered for next time.
  perf: { t0: 0, n: 0, last: 0, slow: 0, fast: 0, settle: 2, target: 54, drop: null, locked: false },
  // A paused tab is told apart by the page being hidden (visibilitychange resets the count), not by a long gap: on a
  // phone drawing 2–4 frames a second every gap is long, and those are exactly the frames that must count as slow.
  tune(now, busy) {
    const P = this.perf;
    if (busy || !P.last || now - P.last > 2500) { P.last = now; P.t0 = now; P.n = 0; return; }
    P.last = now; P.n++;
    if (now - P.t0 < 1000) return;
    const fps = (P.n * 1000) / (now - P.t0); P.n = 0; P.t0 = now; this.fps = fps;
    if (P.settle > 0) { P.settle--; return; }
    if (P.drop) {   // did the last step down help?
      const d = P.drop; P.drop = null;
      if (fps < d.fps * 1.12 && d.fps > 24) { GFX.setTier(d.from); this.applyTier(); P.target = Math.min(P.target, d.fps * 0.92); P.locked = true; P.settle = 2; return; }
    }
    if (fps < P.target) {
      P.fast = 0; if (++P.slow < 2) return; P.slow = 0;
      if (GFX.tier > 0) { P.drop = { from: GFX.tier, fps }; GFX.setTier(fps < 18 ? 0 : GFX.tier - 1); this.applyTier(); P.settle = 2; }   // hopeless: straight to the bottom
      else if (fps < 24 && GFX.mode === 'auto') this.fail('slow');
    } else {
      P.slow = Math.max(0, P.slow - 1);
      if (fps > P.target + 4 && ++P.fast >= 15 && !P.locked && GFX.tier < 3) { P.fast = 0; P.drop = null; GFX.setTier(GFX.tier + 1); this.applyTier(); P.settle = 2; P.locked = true; }
    }
  },
  watchVisibility() {
    if (this.watching) return; this.watching = true;
    document.addEventListener('visibilitychange', () => { this.perf.last = 0; GFX.meter.t0 = 0; });
  },
  // textures more than one scene uses, made once
  textures() {
    if (this.tex) return this.tex;
    const T = (this.tex = {});
    // noise: r grass beds, g fine sand and foam, b cloud shadows, a light on the sand
    const S = 128, nr = tileFbm(S, 4, 4, 1), ng = tileFbm(S, 8, 3, 2), nb = tileFbm(S, 2, 4, 3), na = tileFbm(S, 8, 2, 4), nd = new Uint8Array(S * S * 4);
    for (let i = 0; i < S * S; i++) { nd[i * 4] = nr[i] * 255; nd[i * 4 + 1] = ng[i] * 255; nd[i * 4 + 2] = nb[i] * 255; nd[i * 4 + 3] = na[i] * 255; }
    T.noiseTex = dataTex(S, S, nd, { wrap: true, aniso: 4 });
    // ripples: a normal map from a tileable height field
    const hf = tileFbm(S, 8, 3, 9), nm = new Uint8Array(S * S * 4), at = (x, y) => hf[((y + S) % S) * S + ((x + S) % S)];
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * 9, dy = (at(x, y + 1) - at(x, y - 1)) * 9, l = Math.hypot(dx, dy, 1), p = (y * S + x) * 4;
      nm[p] = (-dx / l * 0.5 + 0.5) * 255; nm[p + 1] = (-dy / l * 0.5 + 0.5) * 255; nm[p + 2] = (1 / l * 0.5 + 0.5) * 255; nm[p + 3] = 255;
    }
    T.normTex = dataTex(S, S, nm, { wrap: true, aniso: 4 });
    T.puffTex = canvasTex(64, 64, (g) => { const im = g.createImageData(64, 64), nz = tileFbm(64, 4, 3, 11); for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { const r = Math.hypot(x - 31.5, y - 31.5) / 32, a = clamp((1 - r) * 1.6, 0, 1) * clamp((nz[y * 64 + x] - 0.25) * 1.8, 0, 1), p = (y * 64 + x) * 4; im.data[p] = im.data[p + 1] = im.data[p + 2] = 255; im.data[p + 3] = a * 255; } g.putImageData(im, 0, 0); });
    T.blobTex = canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 2, 32, 32, 31); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
    T.glowTex = canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
    T.cloudTex = canvasTex(256, 128, (g) => {
      const r = mulberry(5);
      for (let i = 0; i < 14; i++) {
        const x = 50 + r() * 156, y = 58 + r() * 34 - Math.max(0, 1 - Math.abs(x - 128) / 90) * 26, rr2 = 18 + r() * 26;
        const gr = g.createRadialGradient(x - rr2 * 0.2, y - rr2 * 0.35, rr2 * 0.1, x, y, rr2); gr.addColorStop(0, 'rgba(255,255,255,0.98)'); gr.addColorStop(0.6, 'rgba(248,251,255,0.9)'); gr.addColorStop(1, 'rgba(225,235,245,0)');
        g.fillStyle = gr; ell(g, x, y, rr2 * 1.25, rr2); g.fill();
      }
      const fl = g.createLinearGradient(0, 70, 0, 110); fl.addColorStop(0, 'rgba(200,214,230,0)'); fl.addColorStop(1, 'rgba(200,214,230,0.5)'); g.globalCompositeOperation = 'source-atop'; g.fillStyle = fl; g.fillRect(0, 0, 256, 128);
    });
    return T;
  }
};
GL.watchVisibility();

/* ---------- the boat and the crew, as merged meshes ---------- */
const Models = {
  hullInto(g, o = {}) {
    const S = [[51, 0], [40, 9], [24, 15], [0, 17.4], [-30, 17.2], [-46, 16.6]], Wl = [[44, 0], [34, 7], [20, 12.5], [0, 15], [-30, 15], [-46, 14.5]];
    const N = o.n || 18, st = [], hull = o.hull || COL3.hull, stripe = o.stripe || COL3.stripe;
    for (let k = 0; k <= N; k++) { const u = 5 * Math.pow(k / N, 1.25), s = crPt(S, u), w = crPt(Wl, u); st.push({ xs: s[0], ws: s[1], xw: w[0], ww: w[1], kd: 5.5 * smooth01(u / 1.3) }); }
    const side = (q, z, inset = 0) => { const k = z / 13; return [lerp(q.xw, q.xs, k), z, Math.max(0, lerp(q.ww, q.ws, k) - inset)]; };
    for (const sg of [1, -1]) {
      const f = (p) => [p[0], p[1], p[2] * sg];
      g.sheet([st.map((q) => f([q.xw, -q.kd, 0])), st.map((q) => f([q.xw, -q.kd * 0.5, q.ww * 0.62])), st.map((q) => f([q.xw, 0, q.ww]))], COL3.bottom);
      for (const [z0, z1, c] of [[0, 2.5, COL3.boot], [2.5, 8, hull], [8, 10.5, stripe], [10.5, 13, hull]]) g.sheet([st.map((q) => f(side(q, z0))), st.map((q) => f(side(q, (z0 + z1) / 2))), st.map((q) => f(side(q, z1)))], c);
      const inn = st.slice(1);
      g.sheet([inn.map((q) => f(side(q, 13))), inn.map((q) => f(side(q, 13, 1.6)))], COL3.hull);           // the gunwale cap
      g.sheet([inn.map((q) => f(side(q, 13, 1.6))), inn.map((q) => f(side(q, 6, 1.6)))], COL3.inner);      // inside of the gunwale
    }
    const inn = st.slice(1);
    g.sheet([inn.map((q) => side(q, 6, 1.6)), inn.map((q) => { const p = side(q, 6, 1.6); return [p[0], 6, 0]; }), inn.map((q) => { const p = side(q, 6, 1.6); return [p[0], 6, -p[2]]; })], COL3.deck);
    // the transom
    const q = st[N], out = [[q.xw, -q.kd, 0], [q.xw, -q.kd * 0.5, q.ww * 0.62], [q.xw, 0, q.ww], side(q, 2.5), side(q, 8), side(q, 13)], ring = out.concat(out.slice(1).reverse().map((p) => [p[0], p[1], -p[2]])), cen = [q.xw - 0.2, 4, 0], T = [];
    for (let i = 0; i < ring.length - 1; i++) T.push(cen, ring[i], ring[i + 1]);
    g.tris(T, hull);
    return st;
  },
  boatGeo(o = {}) {
    const g = new Geo(), C = COL3;
    const st = this.hullInto(g, o);
    // console, windshield, leaning post, cooler
    g.box(2, 16.5, 0, 16, 21, 14, C.console); g.box(2, 27.3, 0, 15, 0.8, 13.4, C.consoleTop || [0.92, 0.94, 0.95]);
    g.tris([[10, 27, -7], [10, 27, 7], [5, 33, 7], [10, 27, -7], [5, 33, 7], [5, 33, -7]], C.glass);
    if (!o.simple) { g.box(-16, 13, 0, 6, 14, 14, C.console); g.box(-16, 20.8, 0, 7, 1.8, 15, C.cushion); g.box(15, 9.5, 0, 8, 7, 12, [0.97, 0.97, 0.95]); g.box(15, 13.1, 0, 8.4, 0.6, 12.4, [0.85, 0.87, 0.9]); }
    // the T-top
    for (const [x, z] of [[-15, -10], [-15, 10], [9, -10], [9, 10]]) g.rod([x, 6, z * 0.75], [x, 42, z], 0.8, 0.8, C.metal, 6);
    g.box(-2.5, 43.2, 0, 29, 2.4, 24, C.canvas);
    if (!o.simple) {
      // rods in the rocket launcher, whip antennas
      for (const z of [-9, -3, 3, 9]) { g.rod([-15, 44, z], [-33, 70, z * 1.25], 0.42, 0.28, C.rod, 4); g.box(-20, 50, z * 1.06, 2.5, 2.5, 1.6, [0.75, 0.6, 0.2]); }
      for (const z of [-11, 11]) g.rod([10, 44, z], [2, 92, z * 1.3], 0.5, 0.25, [0.95, 0.95, 0.95], 4);
      // bow rail
      const rail = st.filter((q) => q.xs > 4).map((q) => { const k = 1; return [q.xs - 1.2, 17.5, Math.max(0, q.ws - 1.6)]; });
      for (const sg of [1, -1]) for (let i = 1; i < rail.length; i++) { const a = rail[i - 1], b = rail[i]; g.rod([a[0], a[1], a[2] * sg], [b[0], b[1], b[2] * sg], 0.45, 0.45, C.metal, 4); if (i % 2) g.rod([b[0], 13, b[2] * sg], [b[0], b[1], b[2] * sg], 0.4, 0.4, C.metal, 4); }
    }
    // twin outboards
    for (const z of [-7.5, 7.5]) {
      g.box(-52, 16, z, 9, 12, 7.4, C.engine); g.box(-52, 22.6, z, 8.4, 2, 6.8, [0.24, 0.26, 0.28]); g.box(-52.2, 15, z, 9.2, 1.4, 7.6, [0.9, 0.9, 0.9]);
      g.box(-51, 4, z, 4.5, 12, 2.4, C.engine); g.box(-50, -4.5, z, 9, 1, 4, C.engine);
    }
    return g.build();
  },
  personGeo(ch) {
    const C = CHARS[ch] || {}, skin = hex3(C.skin || '#c99469'), shirt = hex3(C.sleeve === 'mahi' ? '#5ec05a' : C.shirt || '#ffffff'), shorts = hex3((C.shorts && C.shorts.base) || '#36475c');
    const body = new Geo(), arm = new Geo();
    for (const z of [-1.7, 1.7]) { body.box(0, 2.6, z, 2.6, 5.2, 2.6, skin); body.box(0, 7.2, z, 3, 4.4, 3, shorts); }
    body.box(0, 13.4, 0, 4.6, 8.4, 7.6, shirt);
    body.ball(0.3, 20.4, 0, 3.1, skin, 1, 1.08, 1, 10, 8);
    if (C.head === 'cap') { body.ball(-0.1, 21.7, 0, 3.25, hex3(C.capColor || '#222'), 1, 0.62, 1, 10, 6); body.box(3.2, 21.4, 0, 3.4, 0.5, 4.6, hex3(C.capBrim || '#111')); }
    else if (C.head === 'short') body.ball(-0.2, 21.5, 0, 3.2, hex3(C.hair || '#111'), 1, 0.6, 1.02, 10, 6);
    if (C.beard) body.box(2.1, 18.9, 0, 1.6, 1.8, 3.8, hex3(C.beardColor || '#333'));
    const sh = C.shades || {}; body.box(2.85, 20.9, 0, 0.9, 1.3, 5.6, hex3(sh.frame || '#111')); body.box(3.2, 20.9, 0, 0.5, 1, 4.8, hex3(sh.lens1 || '#1758d6'));
    arm.box(0, -4.2, 0, 1.9, 8.4, 1.9, shirt.map((v, i) => (i === 0 ? v : v))); arm.box(0, -7.2, 0, 1.7, 2.6, 1.7, skin);
    return { body: body.build(), arm: arm.build() };
  }
};
