'use strict';
/* Keys Crew — the boat ride in real 3D. The water, islands, boats and wildlife the game already simulates (sea.js,
   world.js) drawn with three.js (WebGL 2) on a canvas under the 2D one. The HUD, labels and menus stay on the 2D canvas
   on top. The camera is the chase camera's own (Chase.setup in chase.js), so anything the 2D code projects with
   Chase.proj lands exactly on the 3D picture.
   The renderer, the safeguards that keep phones smooth, and the shared models live in gl3d.js. A phone that can't keep
   up (or has no WebGL 2) gets the classic 2D chase view in chase.js, which is kept as is. */

// land height in world units above the water, for anything standing on the islands, the keys or the mainland
function landH3(x, y) {
  const s = y - chainY(x), I = islandAt(x);
  if (I) { const hw = islandHW(I, x), e = hw - Math.abs(s); if (e > -6) return 1.2 + (clamp(e, 0, 45) / 45) * 5 + 0.8 * (vnoise(x * 0.02, y * 0.02) - 0.5) * clamp(e / 20, 0, 1); }
  const ms = mainlandS(x); if (s < ms + 6) return 1.0 + (clamp(ms - s, 0, 90) / 90) * 2.6;
  return 2.4;
}
// the bridge deck's height (top) along a gap: up on embankments over the island, level over the channel
function deckTop(g, x) { const up = smooth01((x - (g.x0 - 150)) / 180), down = smooth01((g.x1 + 150 - x) / 180); return 6.8 + 55 * Math.min(up, down); }

/* ---------- shaders ---------- */
// The waves: four swells moving with the wind, calmer over the flats, fading out a long way from the boat.
// waveH() in Sea3D works out the same sum on the CPU so the boats ride them.
const GLSL_WAVES = `
uniform float uTime;
uniform vec4 uWv[4];
uniform vec4 uWa;
uniform vec4 uWp;
uniform vec3 uFade;
uniform sampler2D uMap;
uniform vec4 uMapXf;
float mapDepth(vec2 p) { vec2 uv = p * uMapXf.xy + uMapXf.zw; if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return 60.0; return texture2D(uMap, uv).a * 64.0 - 4.0; }
float waveDamp(vec2 p) { return clamp(mapDepth(p) / 14.0, 0.15, 1.0) * (1.0 - smoothstep(uFade.z * 0.55, uFade.z, distance(p, uFade.xy))); }
vec3 waves(vec2 p) {
  vec3 o = vec3(0.0);
  for (int i = 0; i < 4; i++) { vec4 w = uWv[i]; float ph = dot(w.xy, p) * w.z - w.w * uTime + uWp[i]; o.x += uWa[i] * sin(ph); o.yz += uWa[i] * w.z * cos(ph) * w.xy; }
  return o * waveDamp(p);
}`;
const WATER_VS = `${GLSL_WAVES}
uniform float uWaveOn;
varying vec3 vW; varying vec2 vSl;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vec3 w = uWaveOn > 0.5 ? waves(wp.xz) : vec3(0.0);
  wp.y += w.x; vSl = w.yz; vW = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const WATER_FS = `${GLSL_WAVES}
${GLSL_SKY}
uniform sampler2D uNoise, uNorm;
uniform vec3 uDeep, uFogP;
uniform float uChop;
varying vec3 vW; varying vec2 vSl;
void main() {
  vec2 p = vW.xz, uv = p * uMapXf.xy + uMapXf.zw;
  vec4 m = (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) ? vec4(uDeep, 1.0) : texture2D(uMap, uv);
  float d = m.a * 64.0 - 4.0, dist = distance(vW, cameraPosition);
  vec3 base = m.rgb;
  vec2 tt = vec2(uTime);
  // little ripples on top of the swell
  vec2 rip = texture2D(uNorm, p / 173.0 + tt * vec2(0.011, 0.007)).xy * 2.0 - 1.0;
#ifdef HI
  rip = rip * 0.6 + (texture2D(uNorm, p / 61.0 + tt * vec2(-0.017, 0.012)).xy * 2.0 - 1.0) * 0.4;
#endif
  float rk = (0.1 + 0.3 * uChop) * (1.0 - 0.6 * smoothstep(500.0, 6000.0, dist));
  vec3 N = normalize(vec3(-vSl.x - rip.x * rk, 1.0, -vSl.y - rip.y * rk));
  // the bottom, through clear shallow water: grass beds, sand, light dancing on the sand
  float sh = 1.0 - smoothstep(1.5, 20.0, d);
  if (sh > 0.001) {
    vec2 q = p + rip * min(d, 12.0) * 1.6;
    vec4 nz = texture2D(uNoise, q / 430.0), nz2 = texture2D(uNoise, q / 95.0);
    base = mix(base, base * vec3(0.7, 0.85, 0.79), sh * smoothstep(0.5, 0.66, nz.r) * 0.6);
    base *= 1.0 + sh * (nz2.g - 0.5) * 0.18;
#ifdef HI
    float ca = texture2D(uNoise, q / 72.0 + tt * vec2(0.013, 0.009)).a, cb = texture2D(uNoise, q / 55.0 - tt * vec2(0.011, 0.015)).a;
    base += vec3(0.85, 1.0, 0.95) * pow(clamp(1.0 - abs(ca - cb) * 4.0, 0.0, 1.0), 6.0) * sh * 0.2 * clamp(uSunDir.y * 2.5, 0.0, 1.0);
#endif
  }
  vec3 V = normalize(cameraPosition - vW), R = reflect(-V, N);
  float F = 0.02 + 0.98 * pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 5.0);
  vec3 col = mix(base, skyCol(R), F * 0.88);
  float rs = max(dot(R, uSunDir), 0.0);
  col += uSunCol * (pow(rs, 500.0) * 3.0 + pow(rs, 60.0) * 0.16) * (0.5 + uChop);
  // a line of foam where the water meets the beach
  float shore = 1.0 - smoothstep(0.0, 1.3, d);
  if (shore > 0.001) { float fn = texture2D(uNoise, p / 38.0 + tt * 0.012).g; col = mix(col, vec3(0.95, 0.98, 0.97), shore * smoothstep(0.38, 0.62, fn + shore * 0.35) * 0.75); }
#ifdef HI
  // whitecaps when it blows
  if (uChop > 0.6) { float wc = texture2D(uNoise, p / 150.0 - tt * vec2(0.02, 0.013)).g; col = mix(col, vec3(0.95), smoothstep(0.83, 0.9, wc) * (uChop - 0.6) * 1.6 * (1.0 - smoothstep(800.0, 3000.0, dist))); }
#endif
  // cloud shadows drifting over
  col *= 1.0 - 0.14 * smoothstep(0.55, 0.8, texture2D(uNoise, p / 5600.0 + tt * vec2(0.0024, -0.001)).b);
  float f = smoothstep(uFogP.x, uFogP.y, dist) * uFogP.z + (1.0 - uFogP.z) * smoothstep(uFogP.y, 36000.0, dist);
  gl_FragColor = vec4(mix(col, uHaze, f), 1.0);
}`;
// Things painted on the water (wakes, foam, shadows, the course line, weed): they ride the same waves
const DECAL_VS = `${GLSL_WAVES}
attribute float aA;
#ifdef INST
attribute float aIA;
#endif
uniform float uLift;
varying vec2 vUv; varying float vA; varying float vDist;
void main() {
  vec4 lp = vec4(position, 1.0);
#ifdef USE_INSTANCING
  lp = instanceMatrix * lp;
#endif
  vec4 wp = modelMatrix * lp;
  wp.y = waves(wp.xz).x + uLift;
  vUv = uv; vA = aA;
#ifdef INST
  vA *= aIA;
#endif
  vDist = distance(wp.xyz, cameraPosition);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const DECAL_FS = `
uniform sampler2D uTex; uniform vec3 uCol, uHaze, uFogP; uniform float uOp, uTime; uniform vec2 uScroll;
varying vec2 vUv; varying float vA; varying float vDist;
void main() {
  vec4 tx = texture2D(uTex, vUv + uScroll * uTime);
  float a = tx.a * vA * uOp; if (a < 0.003) discard;
  gl_FragColor = vec4(mix(uCol * tx.rgb, uHaze, smoothstep(uFogP.x, uFogP.y, vDist) * 0.85), a);
}`;
/* ---------- the renderer ---------- */
const Sea3D = {
  built: false, lastT: null,
  // ready to draw the ride in 3D: there's a renderer (gl3d.js) and the world has been built for it
  ready() {
    if (!World.ready || !GL.ensure()) return false;
    if (!this.built) {
      try { this.build(); this.built = true; GL.users.push(this); this.onTier(GFX.TIERS[GFX.tier]); }
      catch (e) { console.error('3D boat ride failed to build, using the classic view:', e); GL.fail('error'); return false; }
    }
    return GL.state === 'ready';
  },
  onTier(T) {
    if (this.water) this.water.material = T.hi ? this.waterHi : this.waterLo;
    for (const m of this.veg || []) m.count = Math.max(0, Math.round(m.userData.n * (m.userData.always ? 1 : T.veg)));
  },

  /* ---------- setting up (once per session) ---------- */
  build() {
    const S = (this.scene = new THREE.Scene());
    this.cam = new THREE.PerspectiveCamera(50, 16 / 9, 8, 42000);
    S.fog = new THREE.Fog(0xb2d6e6, 700, 13000);
    this.sun = new THREE.DirectionalLight(0xffffff, 3); this.sun.position.set(0.4, 1, 0.3); S.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xcfe6f5, 0x3f7f8f, 2); S.add(this.hemi);
    this.makeTextures(); this.makeUniforms(); this.makeMaterials();
    this.buildSky(); this.buildWater(); this.buildLand(); this.buildVeg(); this.buildRoads(); this.buildBridges(); this.buildMarkers(); this.buildLight(); this.buildHome();
    this.buildBoats(); this.buildLife(); this.buildDecals();
  },
  makeTextures() {
    // the water's colors and depth, straight from the world map: rgb = the 2D game's water colors, a = depth
    const gw = World.gw, gh = World.gh, src = World.tex.getContext('2d').getImageData(0, 0, gw, gh).data, data = new Uint8Array(gw * gh * 4), shallow = [222, 238, 222];
    for (let n = 0; n < gw * gh; n++) {
      const d = World.grid[n], p = n * 4, land = d <= 0;
      data[p] = land ? shallow[0] : src[p]; data[p + 1] = land ? shallow[1] : src[p + 1]; data[p + 2] = land ? shallow[2] : src[p + 2];
      data[p + 3] = clamp(Math.round(((d + 4) / 64) * 255), 0, 255);
    }
    this.mapTex = dataTex(gw, gh, data, { aniso: 4 });
    Object.assign(this, GL.textures());   // noise, ripples, puffs, blobs, glow, clouds
    // wake foam: soft across the width, streaky along it
    const fs = tileFbm(64, 4, 3, 7);
    this.foamTex = canvasTex(64, 64, (g) => { const im = g.createImageData(64, 64); for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { const u = x / 63, a = Math.pow(Math.sin(u * Math.PI), 0.7) * (0.45 + 0.55 * fs[y * 64 + x]), p = (y * 64 + x) * 4; im.data[p] = im.data[p + 1] = im.data[p + 2] = 255; im.data[p + 3] = a * 255; } g.putImageData(im, 0, 0); }, { wrap: true });
    this.dashTex = canvasTex(64, 16, (g) => { const gr = g.createLinearGradient(0, 0, 0, 16); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.3, 'rgba(255,255,255,1)'); gr.addColorStop(0.7, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(4, 0, 30, 16); }, { wrap: true });
    // dash pattern runs along u, so the dash texture is sampled with u along the line
    this.weedTex = canvasTex(64, 64, (g) => { const r = mulberry(9); for (let i = 0; i < 9; i++) { const x = 12 + r() * 40, y = 14 + r() * 36, rr2 = 6 + r() * 9; g.fillStyle = `rgba(${200 + r() * 30},${150 + r() * 30},${40 + r() * 20},0.95)`; ell(g, x, y, rr2, rr2 * 0.7, r() * 3); g.fill(); g.fillStyle = 'rgba(140,100,25,0.55)'; ell(g, x + 2, y + 1, rr2 * 0.45, rr2 * 0.3); g.fill(); } });
    // the channel daymarks, the reef marker diamond and the NO WAKE sign, side by side
    this.atlas = canvasTex(1024, 64, (g) => {
      const num = (s, x, y, size, col = '#fff') => { g.font = `800 ${size}px ${FONT_UI}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = col; g.fillText(s, x, y); };
      [1, 3, 5, 7, 9].forEach((n, i) => { const x = i * 64; g.fillStyle = '#2f9a4a'; g.fillRect(x + 3, 3, 58, 58); g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 3; g.strokeRect(x + 3, 3, 58, 58); num(String(n), x + 32, 34, 36); });
      [2, 4, 6, 8, 10].forEach((n, i) => { const x = (5 + i) * 64; g.fillStyle = '#e03a3a'; g.beginPath(); g.moveTo(x + 32, 2); g.lineTo(x + 62, 62); g.lineTo(x + 2, 62); g.closePath(); g.fill(); num(String(n), x + 32, 44, 26); });
      { const x = 11 * 64; g.fillStyle = '#f4f4f0'; g.beginPath(); g.moveTo(x + 32, 1); g.lineTo(x + 63, 32); g.lineTo(x + 32, 63); g.lineTo(x + 1, 32); g.closePath(); g.fill(); g.fillStyle = '#e8742c'; g.fillRect(x + 12, 26, 40, 12); }
      { const x = 12 * 64; g.fillStyle = '#ffffff'; rr(g, x + 2, 10, 124, 44, 6); g.fill(); g.strokeStyle = '#ff7a1a'; g.lineWidth = 5; g.stroke(); num('NO WAKE', x + 64, 33, 28, '#1a1a1a'); }
    }, { aniso: 4 });
  },
  makeUniforms() {
    const gw = World.gw, gh = World.gh, C = WORLD.CELL;
    this.U = {
      uTime: { value: 0 }, uWv: { value: [0, 1, 2, 3].map(() => new THREE.Vector4()) }, uWa: { value: new THREE.Vector4() }, uWp: { value: new THREE.Vector4(0.3, 1.7, 4.1, 2.6) },
      uFade: { value: new THREE.Vector3(0, 0, 1250) }, uMap: { value: this.mapTex }, uMapXf: { value: new THREE.Vector4(1 / (gw * C), 1 / (gh * C), 0.5 / gw, 0.5 / gh) },
      uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uHaze: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color(1, 1, 1) },
      uFogP: { value: new THREE.Vector3(700, 13000, 0.86) }, uChop: { value: 0.5 }, uDeep: { value: new THREE.Color(10 / 255, 50 / 255, 118 / 255) },
      uNoise: { value: this.noiseTex }, uNorm: { value: this.normTex }, uSunR: { value: 0.034 },
      uCut: { value: new THREE.Vector4(-9999, -9999, 1, 0) }
    };
  },
  makeMaterials() {
    const U = this.U;
    this.mats = {};
    // everything solid: lit, fogged, and see-through (dithered) where it stands between the camera and our boat
    const solid = (o = {}) => { const m = new THREE.MeshLambertMaterial(Object.assign({ vertexColors: true }, o)); this.cutaway(m); return m; };
    this.mats.solid = solid(); this.mats.solid2 = solid({ side: THREE.DoubleSide });
    this.mats.inst = solid({ vertexColors: false }); this.mats.inst2 = solid({ vertexColors: false, side: THREE.DoubleSide });
    this.mats.boat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    this.mats.land = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.mats.board = new THREE.MeshLambertMaterial({ map: this.atlas, alphaTest: 0.5 });
    this.cutaway(this.mats.board);
  },
  // dither away whatever sits in front of our boat, so islands, trees and bridges never hide it
  cutaway(mat) {
    const U = this.U;
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uCut = U.uCut;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vCamD;').replace('#include <project_vertex>', '#include <project_vertex>\nvCamD = -mvPosition.z;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec4 uCut; varying float vCamD;').replace('void main() {', `void main() {
  vec2 f2 = mod(floor(gl_FragCoord.xy), 2.0); float dth = (f2.x + f2.y * 2.0 + 0.5) / 4.0;
  if (vCamD < uCut.w) { vec2 dd = (gl_FragCoord.xy - uCut.xy) / uCut.z; float k = dot(dd, dd); if (k < 1.0 && dth < 0.85 - k * 0.6) discard; }
  if (vCamD < 190.0 && dth > (vCamD - 70.0) / 120.0) discard;   // right in front of the camera: fade it out`);
    };
    mat.customProgramCacheKey = () => 'cutaway';
  },
  decalMat(tex, col, o = {}) {
    const U = this.U, m = new THREE.ShaderMaterial({
      uniforms: Object.assign({}, U, { uTex: { value: tex }, uCol: { value: new THREE.Color(col[0], col[1], col[2]) }, uOp: { value: o.op == null ? 1 : o.op }, uLift: { value: o.lift || 0.6 }, uScroll: { value: new THREE.Vector2(0, 0) } }),
      vertexShader: DECAL_VS, fragmentShader: DECAL_FS, transparent: true, depthWrite: false, defines: o.inst ? { INST: 1 } : {}
    });
    return m;
  },

  /* ---------- sky ---------- */
  buildSky() {
    const U = this.U;
    const sky = (this.skyMesh = new THREE.Mesh(new THREE.SphereGeometry(36000, 32, 16), new THREE.ShaderMaterial({ uniforms: U, vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false })));
    sky.renderOrder = 2; sky.frustumCulled = false; this.scene.add(sky);
    // clouds: soft painted puffs on big boards far away, all in one mesh, always facing the middle
    const g = new Geo(), r = mulberry(77), R = 30000;
    for (let i = 0; i < 22; i++) {
      const az = r() * TAU, el = 0.025 + r() * 0.17, s = (0.9 + r() * 1.7) * (0.6 + el * 3), d = [Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)];
      const right = [-Math.sin(az), 0, Math.cos(az)], up = [-Math.cos(az) * Math.sin(el), Math.cos(el), -Math.sin(az) * Math.sin(el)];
      g.quad([d[0] * R, d[1] * R, d[2] * R], right, up, 2600 * s, 1300 * s, [0, 0, 1, 1]);
    }
    const geo = g.build(); const a = new Float32Array(geo.attributes.position.count).fill(1); geo.setAttribute('aA', new THREE.BufferAttribute(a, 1));
    this.cloudMat = new THREE.MeshBasicMaterial({ map: this.cloudTex, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide, color: 0xffffff });
    const cl = (this.clouds = new THREE.Mesh(geo, this.cloudMat)); cl.renderOrder = 3; cl.frustumCulled = false; this.scene.add(cl);
  },
  setSky(s) {
    const sky = Chase.sky(s); if (sky === this.skyNow) return; this.skyNow = sky;
    const U = this.U, set = (c, rgb) => c.setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255);
    set(U.uTop.value, sky.top); set(U.uHor.value, sky.hor); set(U.uHaze.value, sky.haze);
    const [az, el] = sky.sun, sunset = sky === SKIES.sunset, low = el < 0.35;
    U.uSunDir.value.set(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)).normalize();
    const sc = sunset ? [1, 0.72, 0.45] : low ? [1, 0.93, 0.8] : [1, 0.98, 0.93]; U.uSunCol.value.setRGB(sc[0], sc[1], sc[2]);
    U.uSunR.value = sunset ? 0.05 : 0.034;
    this.sun.color.setRGB(sc[0], sc[1], sc[2]); this.sun.intensity = sunset ? 2.4 : low ? 2.9 : 3.1;
    this.sun.position.copy(U.uSunDir.value).multiplyScalar(1000);
    this.hemi.color.setRGB(lerp(sky.top[0], 255, 0.45) / 255, lerp(sky.top[1], 255, 0.45) / 255, lerp(sky.top[2], 255, 0.45) / 255);
    this.hemi.groundColor.setRGB(sunset ? 0.36 : 0.25, sunset ? 0.32 : 0.45, sunset ? 0.36 : 0.5); this.hemi.intensity = sunset ? 1.6 : 2.0;
    this.scene.fog.color.copy(U.uHaze.value); GL.r.setClearColor(U.uHaze.value, 1);
    this.cloudMat.color.setRGB(sunset ? 1 : 1, sunset ? 0.78 : 1, sunset ? 0.66 : 1);
  },

  /* ---------- water ---------- */
  buildWater() {
    const U = this.U, mk = (hi, waveOn) => new THREE.ShaderMaterial({ uniforms: Object.assign({}, U, { uWaveOn: { value: waveOn } }), vertexShader: WATER_VS, fragmentShader: WATER_FS, side: THREE.DoubleSide, defines: hi ? { HI: 1 } : {} });
    this.waterHi = mk(true, 1); this.waterLo = mk(false, 1); this.farHi = mk(true, 0); this.farLo = mk(false, 0);
    // near: a fine grid that moves with the boat in whole cells (so the waves don't swim), far: a flat ring out to the horizon
    const N = 192, CELLW = 14, half = (N * CELLW) / 2, g = new THREE.PlaneGeometry(N * CELLW, N * CELLW, N, N); g.rotateX(-Math.PI / 2);
    this.waterCell = CELLW; this.water = new THREE.Mesh(g, this.waterHi); this.water.frustumCulled = false; this.scene.add(this.water);
    const inner = half - CELLW, outer = 40000, fg = new THREE.BufferGeometry(), P = [];
    const ring = [[-outer, -outer], [outer, -outer], [outer, outer], [-outer, outer]], hole = [[-inner, -inner], [inner, -inner], [inner, inner], [-inner, inner]];
    for (let i = 0; i < 4; i++) { const a = ring[i], b = ring[(i + 1) % 4], c = hole[(i + 1) % 4], d = hole[i]; P.push(a[0], -0.4, a[1], d[0], -0.4, d[1], b[0], -0.4, b[1], b[0], -0.4, b[1], d[0], -0.4, d[1], c[0], -0.4, c[1]); }
    fg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    this.farWater = new THREE.Mesh(fg, this.farHi); this.farWater.frustumCulled = false; this.scene.add(this.farWater);
  },
  setWaves(s) {
    const U = this.U, chop = s.wind.chop, ang = s.wind.ang, k = 0.1 + 0.9 * chop;
    this.waves = [[0, 210, 1.6], [0.6, 130, 0.9], [-0.5, 88, 0.6], [1.3, 55, 0.3]].map(([off, len, a], i) => {
      const dx = Math.cos(ang + off), dy = Math.sin(ang + off), kk = TAU / len, w = Math.sqrt(112.7 * kk);
      U.uWv.value[i].set(dx, dy, kk, w); return { dx, dy, k: kk, w, a: a * k, p: U.uWp.value.getComponent(i) };
    });
    U.uWa.value.set(this.waves[0].a, this.waves[1].a, this.waves[2].a, this.waves[3].a); U.uChop.value = chop;
  },
  // the height of the water at (x, y): the same sum the shaders use
  waveH(x, y) {
    const U = this.U, f = U.uFade.value, r = Math.hypot(x - f.x, y - f.y), fade = 1 - smooth01((r - f.z * 0.55) / (f.z * 0.45)); if (fade <= 0) return 0;
    const t = U.uTime.value, damp = clamp(World.gridDepth(x, y) / 14, 0.15, 1) * fade; let h = 0;
    for (const w of this.waves) h += w.a * Math.sin((w.dx * x + w.dy * y) * w.k - w.w * t + w.p);
    return h * damp;
  },

  /* ---------- the islands, keys and mainland: built in tiles, near ones in fine detail ---------- */
  buildLand() {
    const C = WORLD.CELL, gw = World.gw, gh = World.gh, T = (this.TILE = 1024);
    this.tiles = []; this.landG = new THREE.Group(); this.scene.add(this.landG);
    for (let tj = 0; tj * T < WORLD.H; tj++) for (let ti = 0; ti * T < WORLD.W; ti++) {
      let need = false;
      for (let j = Math.floor((tj * T) / C); j <= Math.min(gh - 1, Math.ceil(((tj + 1) * T) / C)) && !need; j++) for (let i = Math.floor((ti * T) / C); i <= Math.min(gw - 1, Math.ceil(((ti + 1) * T) / C)); i++) if (World.grid[j * gw + i] < 1.2) { need = true; break; }
      if (need) this.tiles.push({ ti, tj, x: ti * T + T / 2, y: tj * T + T / 2, fine: null, coarse: this.tileMesh(ti, tj, 64) });
    }
    for (const t of this.tiles) this.landG.add(t.coarse);
    // the Everglades go on past the top of the map
    const g = new Geo(); g.box(WORLD.W / 2, -2, -30000, 120000, 9, 60016, COL3.glades);
    this.landG.add(new THREE.Mesh(g.build(), this.mats.land));
  },
  tileMesh(ti, tj, res) { return this.runJob(this.tileJob(ti, tj, res), Infinity); },
  tileJob(ti, tj, res) { const T = this.TILE; return { ti, tj, res, n: T / res, x0: ti * T, y0: tj * T, j: -1, H: [], pos: [], col: [] }; },
  // the ground at (x, y): [height, color]. The exact shoreline is only worked out where the map says it's near.
  ground(x, y) {
    const gd = World.gridDepth(x, y), exact = (gd < 6 && gd > -0.99) || Math.abs(x - HOME.x) < 90 || Math.abs(x - SPOTS.flamingo.at[0]) < 160, d = exact ? depthRaw(x, y) : gd;
    if (d > 0) return [-0.7 - Math.min(d, 6), COL3.under];
    const h = landH3(x, y), s = y - chainY(x), I = islandAt(x); let c;
    if (I && Math.abs(s) < islandHW(I, x) + 4) { const e = islandHW(I, x) - Math.abs(s), town = TOWNS.some((Tn) => x > Tn.x0 && x < Tn.x1); c = mix3(COL3.sand, town ? COL3.townGrass : COL3.grass, smooth01((e - 12) / 14)); }
    else if (s < mainlandS(x) + 6) c = mix3(COL3.mud, COL3.glades, smooth01((mainlandS(x) - s - 6) / 18));
    else c = mix3(COL3.mud, COL3.keyGreen, 0.55 + 0.45 * vnoise(x * 0.03, y * 0.03));
    return [h, mul3(c, 0.92 + 0.16 * vnoise(x * 0.011 + 7, y * 0.011))];
  },
  // a tile's mesh, a few rows at a time so a slow phone never stalls on one; returns the mesh once it's done
  runJob(J, until) {
    const { n, res, x0, y0 } = J;
    while (J.j <= n + 1) {
      for (let i = -1; i <= n + 1; i++) {
        const skirt = i < 0 || J.j < 0 || i > n || J.j > n, x = x0 + clamp(i, 0, n) * res, y = y0 + clamp(J.j, 0, n) * res, [h0, c] = this.ground(x, y), h = skirt ? h0 - 18 : h0;
        J.H.push(h); J.pos.push(x, h, y); J.col.push(c[0], c[1], c[2]);
      }
      J.j++; if (performance.now() > until) break;
    }
    if (J.j <= n + 1) return null;
    const cols = n + 3, idx = [], H = J.H;
    for (let j = 0; j < n + 2; j++) for (let i = 0; i < n + 2; i++) {
      const a = j * cols + i, b = a + 1, c = a + cols, d = c + 1;
      if (Math.max(H[a], H[b], H[c], H[d]) < -2.5) continue;   // all under water: the water covers it anyway
      idx.push(a, c, d, a, d, b);
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(J.pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(J.col, 3));
    geo.setIndex(idx); geo.computeVertexNormals(); geo.computeBoundingSphere();
    return new THREE.Mesh(geo, this.mats.land);
  },
  // keep fine tiles near the camera, built a little at a time; the coarse ones fill in everywhere else
  updateLand(c) {
    const fx = c.ca, fy = c.sa, budget = performance.now() + (this.warm ? 400 : 4);
    let best = null, bestD = 1e9;
    for (const t of this.tiles) {
      const dx = t.x - c.x, dy = t.y - c.y, d = Math.hypot(dx, dy), ahead = dx * fx + dy * fy;
      t.want = d < 2700 + 724 && ahead > -1500; t.vis = d < 15000;
      if (t.want && !t.fine && d < bestD && !(this.job && this.job.tile === t)) { best = t; bestD = d; }
      if (t.fine && d > 5200) { this.landG.remove(t.fine); t.fine.geometry.dispose(); t.fine = null; }
      if (t.fine) t.fine.visible = t.vis && t.want; t.coarse.visible = t.vis && !(t.fine && t.fine.visible);
    }
    for (let guard = 0; guard < 40; guard++) {
      if (!this.job) { if (!best) break; this.job = Object.assign(this.tileJob(best.ti, best.tj, 16), { tile: best }); best = null; }
      const m = this.runJob(this.job, budget); if (!m) break;
      const t = this.job.tile; t.fine = m; this.landG.add(m); m.visible = t.vis && t.want; t.coarse.visible = t.vis && !m.visible; this.job = null;
      if (!this.warm) break;
      best = null; bestD = 1e9; for (const t2 of this.tiles) if (t2.want && !t2.fine) { const d = Math.hypot(t2.x - c.x, t2.y - c.y); if (d < bestD) { best = t2; bestD = d; } }
    }
    this.warm = false;
  },

  /* ---------- trees, palms and houses: instanced, in big tiles so whole groups get culled ---------- */
  buildVeg() {
    const r = mulberry(4711), trees = [], add = (x, y, rad, hgt, tone) => { if (x < -200 || x > WORLD.W + 400) return; trees.push({ x, y, base: landH3(x, y) - 1.5, rad, hgt, tone }); };
    // the Keys: a mangrove and sea-grape fringe along both shores, a canopy inside, lower in town
    for (const I of ISLANDS) for (let x = I.x0 + 8; x < Math.min(I.x1, WORLD.W + 300) - 8; x += 15 + r() * 9) {
      const hw = islandHW(I, x); if (hw < 14) continue; const cy = chainY(x), town = TOWNS.some((T) => x > T.x0 && x < T.x1);
      if (gapAt(x - 160) || gapAt(x + 160)) { if (r() < 0.5) continue; }
      for (const side of [-1, 1]) {
        if (side > 0 && Math.abs(x - HOME.x) < 70) continue;
        if (town && r() < 0.45) continue;
        add(x + r() * 6, cy + side * (hw - 7 - r() * 7), 8 + r() * 6, town ? 14 + r() * 9 : 20 + r() * 16, r());
      }
    }
    for (const c of World.canopy) if (Math.abs(c.y - chainY(c.x)) > 16 && !World.houses.some((h) => Math.abs(h.x - c.x) < 20 && Math.abs(h.y - c.y) < 20)) add(c.x, c.y, c.r * 0.55, 14 + c.r, c.c);
    // mangrove keys in the bay: a ring around the edge, filled in
    for (const k of KEYS) {
      const per = TAU * (k.rx + k.ry) * 0.5, n = Math.max(6, Math.round(per / 15)), cr = Math.cos(k.rot), sr = Math.sin(k.rot);
      for (let i = 0; i < n; i++) { const a = (i / n) * TAU, w = keyRadius(k, a) * 0.82, u = Math.cos(a) * w * k.rx, v = Math.sin(a) * w * k.ry; add(k.x + u * cr - v * sr, k.y + u * sr + v * cr, 9 + r() * 6, 17 + r() * 12, r()); }
      const fill = Math.round((k.rx * k.ry) / 900);
      for (let i = 0; i < fill; i++) { const a = r() * TAU, w = Math.sqrt(r()) * 0.6, u = Math.cos(a) * w * k.rx, v = Math.sin(a) * w * k.ry; add(k.x + u * cr - v * sr, k.y + u * sr + v * cr, 12 + r() * 8, 20 + r() * 14, r()); }
    }
    // the Everglades: a wall of mangroves along the shore, hammocks behind it
    const [fx] = spotXY('flamingo');
    for (let x = -300; x < WORLD.W + 400; x += 13 + r() * 7) {
      if (Math.abs(x - fx) < 150) continue;
      const sy = wy(x, mainlandS(x)); add(x, sy - 8 - r() * 8, 10 + r() * 8, 26 + r() * 22, r());
      if (r() < 0.7) add(x + r() * 8, sy - 26 - r() * 20, 12 + r() * 10, 30 + r() * 26, r());
      if (r() < 0.35) add(x + r() * 8, sy - 70 - r() * 600, 18 + r() * 14, 34 + r() * 30, r());
    }
    // a blob per tree, a few shades of green; split into tiles of 1024 so the far ones drop out of view together
    const blob = new THREE.IcosahedronGeometry(1, 0), tm = new THREE.MeshLambertMaterial({ flatShading: false }); this.cutaway(tm);
    this.veg = []; this.vegG = new THREE.Group(); this.scene.add(this.vegG);
    const buckets = new Map(), M = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color();
    for (const t of trees) { const key = Math.floor(t.x / 1024) + ',' + Math.floor(t.y / 1024); if (!buckets.has(key)) buckets.set(key, []); buckets.get(key).push(t); }
    for (const list of buckets.values()) {
      for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }   // shuffled, so drawing fewer drops trees evenly
      const im = new THREE.InstancedMesh(blob, tm, list.length);
      list.forEach((t, i) => {
        q.setFromAxisAngle(UP, t.tone * 9); M.compose(new THREE.Vector3(t.x, t.base + t.hgt * 0.5, t.y), q, new THREE.Vector3(t.rad * 1.2, t.hgt * 0.55, t.rad * 1.2)); im.setMatrixAt(i, M);
        const g0 = mix3([0.27, 0.5, 0.25], [0.46, 0.66, 0.3], t.tone); col.setRGB(g0[0], g0[1], g0[2]); im.setColorAt(i, col);
      });
      im.computeBoundingSphere(); im.userData.n = list.length; this.veg.push(im); this.vegG.add(im);
    }
    // palms: a leaning trunk and a crown of drooping fronds
    const trunk = new THREE.CylinderGeometry(0.9, 1.6, 1, 5, 1); trunk.translate(0, 0.5, 0);
    const crown = new Geo();
    for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU, ca = Math.cos(a), sa = Math.sin(a), px = -sa * 2.2, pz = ca * 2.2; crown.tris([[0, 0, 0], [ca * 9 + px, 2.5, sa * 9 + pz], [ca * 9 - px, 2.5, sa * 9 - pz], [ca * 9 + px, 2.5, sa * 9 + pz], [ca * 17, -4.5, sa * 17], [ca * 9 - px, 2.5, sa * 9 - pz]], COL3.frond); }
    const crownGeo = crown.build(), palms = World.palms.filter((p) => Math.abs(p.y - chainY(p.x)) > 14);
    const pt = new THREE.InstancedMesh(trunk, this.mats.inst, palms.length), pc = new THREE.InstancedMesh(crownGeo, this.mats.solid2, palms.length);
    const tc = new THREE.Color(COL3.trunk[0], COL3.trunk[1], COL3.trunk[2]);
    palms.forEach((p, i) => {
      const h = 46 + p.r * 1.4, base = landH3(p.x, p.y) - 1, lean = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(Math.sin(p.a), 0, -Math.cos(p.a)), 0.16);
      M.compose(new THREE.Vector3(p.x, base, p.y), lean, new THREE.Vector3(1, h, 1)); pt.setMatrixAt(i, M); pt.setColorAt(i, tc);
      const top = new THREE.Vector3(0, h, 0).applyQuaternion(lean).add(new THREE.Vector3(p.x, base, p.y));
      M.compose(top, new THREE.Quaternion().setFromAxisAngle(UP, p.a), new THREE.Vector3(1.1, 1, 1.1)); pc.setMatrixAt(i, M);
    });
    for (const m of [pt, pc]) { m.computeBoundingSphere(); m.userData = { n: palms.length, always: true }; this.veg.push(m); this.vegG.add(m); }
    // houses: walls and a hip roof
    const hs = World.houses, walls = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), this.mats.inst, hs.length), roofG = new THREE.ConeGeometry(0.75, 1, 4, 1); roofG.rotateY(Math.PI / 4);
    const roofs = new THREE.InstancedMesh(roofG, this.mats.inst, hs.length);
    hs.forEach((h, i) => {
      const base = landH3(h.x, h.y) - 0.5;
      M.compose(new THREE.Vector3(h.x, base + 8, h.y), Q0, new THREE.Vector3(h.w * 0.9, 16, h.h * 0.9)); walls.setMatrixAt(i, M);
      const wc = h.canal ? [0.96, 0.94, 0.88] : COL3.wall; col.setRGB(wc[0], wc[1], wc[2]); walls.setColorAt(i, col);
      M.compose(new THREE.Vector3(h.x, base + 16 + 5, h.y), Q0, new THREE.Vector3(h.w * 1.15, 10, h.h * 1.15)); roofs.setMatrixAt(i, M);
      const rc = hex3(h.roof); col.setRGB(rc[0], rc[1], rc[2]); roofs.setColorAt(i, col);
    });
    for (const m of [walls, roofs]) { m.computeBoundingSphere(); m.userData = { n: hs.length, always: true }; this.veg.push(m); this.vegG.add(m); }
  },
  // US-1 down the middle of every island, with its yellow line
  buildRoads() {
    const g = new Geo(), y0 = (x) => landH3(x, chainY(x)) + 0.35;
    for (const I of ISLANDS) {
      const xa = I.x0 + 20, xb = Math.min(I.x1, WORLD.W + 300) - 20, pts = [];
      for (let x = xa; x <= xb; x += 24) pts.push(x);
      for (let k = 1; k < pts.length; k++) {
        const a = pts[k - 1], b = pts[k], ya = chainY(a), yb = chainY(b), ha = Math.max(y0(a), deckOver(a)), hb = Math.max(y0(b), deckOver(b));
        g.tris([[a, ha, ya - 9], [b, hb, yb + 9], [b, hb, yb - 9], [a, ha, ya - 9], [a, ha, ya + 9], [b, hb, yb + 9]], [0.42, 0.42, 0.41]);
        if (k % 2) g.tris([[a, ha + 0.15, ya - 0.7], [b, hb + 0.15, yb + 0.7], [b, hb + 0.15, yb - 0.7], [a, ha + 0.15, ya - 0.7], [a, ha + 0.15, ya + 0.7], [b, hb + 0.15, yb + 0.7]], [0.95, 0.82, 0.24]);
      }
    }
    function deckOver(x) { const gp = GAPS.find((G) => x > G.x0 - 150 && x < G.x1 + 150); return gp ? deckTop(gp, x) + 0.3 : -99; }
    this.scene.add(new THREE.Mesh(g.build(), this.mats.solid2));
    // a few cars running up and down
    this.cars = new THREE.InstancedMesh(new THREE.BoxGeometry(12, 5, 6), this.mats.inst, World.cars.length);
    const col = new THREE.Color(); World.cars.forEach((c, i) => { const h = hex3(c.c); col.setRGB(h[0], h[1], h[2]); this.cars.setColorAt(i, col); });
    this.cars.frustumCulled = false; this.scene.add(this.cars);
  },
  // the Overseas Highway's bridges: up on embankments, over the channel on piers, the boat runs under
  buildBridges() {
    const g = new Geo();
    for (const gp of GAPS) {
      const xs = []; for (let x = gp.x0 - 150; x <= gp.x1 + 150; x += 8) xs.push(x);
      const P = (x, lat, h) => [x, h, chainY(x) + lat], top = (x) => deckTop(gp, x), row = (lat, dh) => xs.map((x) => P(x, lat, top(x) + dh));
      g.sheet([row(-15, 0), row(15, 0)], COL3.concrete);                                   // the road deck
      g.sheet([row(15, -5), row(-15, -5)], COL3.concreteDark);                             // its underside
      for (const sd of [-1, 1]) {
        g.sheet([row(sd * 15, 0), row(sd * 15, -5)], [0.7, 0.69, 0.66]);
        g.sheet([row(sd * 13.6, 0), row(sd * 13.6, 3.6), row(sd * 15.2, 3.6), row(sd * 15.2, -0.2)], [0.88, 0.87, 0.84]);   // parapets
        for (const land of [xs.filter((x) => x < gp.x0 - 2), xs.filter((x) => x > gp.x1 + 2)]) if (land.length > 1) g.sheet([land.map((x) => P(x, sd * 13, top(x) - 5)), land.map((x) => P(x, sd * 13, Math.min(top(x) - 5, landH3(x, chainY(x)) - 2)))], COL3.concreteDark);
      }
      for (const pr of World.piers) if (pr.g === gp) { const t2 = top(pr.x) - 5; g.box(pr.x, (t2 - 8) / 2, pr.y, 10, t2 + 8, 30, COL3.concreteDark); g.box(pr.x, t2 - 1.4, pr.y, 13, 2.8, 34, COL3.concrete); }
      for (const sd of [-1, 1]) for (const sz of [-1, 1]) g.box(gp.x + sd * 86, top(gp.x + sd * 86) - 6, gp.y + sz * 16, 3, 3, 3, [0.3, 1, 0.55]);
    }
    this.bridges = new THREE.Mesh(g.build(), this.mats.solid2); this.scene.add(this.bridges);
  },
  // channel posts with their numbered daymarks, white bay-channel posts, reef markers, NO WAKE signs, the wreck buoys
  buildMarkers() {
    const posts = new Geo(), boards = new Geo(), cell = (i, w = 1) => [(i * 64 + 1) / 1024, 0.02, ((i + w) * 64 - 1) / 1024, 0.98];
    const greens = { 1: 0, 3: 1, 5: 2, 7: 3, 9: 4 }, reds = { 2: 5, 4: 6, 6: 7, 8: 8, 10: 9 };
    const board = (x, h, y, w, hh, uv, faceY = true) => {
      const c0 = [x, h, y];
      if (faceY) { boards.quad([x, h, y + 0.3], [1, 0, 0], [0, 1, 0], w, hh, uv); boards.quad([x, h, y - 0.3], [-1, 0, 0], [0, 1, 0], w, hh, uv); }
      else { boards.quad([x + 0.3, h, y], [0, 0, -1], [0, 1, 0], w, hh, uv); boards.quad([x - 0.3, h, y], [0, 0, 1], [0, 1, 0], w, hh, uv); }
      return c0;
    };
    for (const m of World.markers) {
      const reef = m.kind === 'reef', white = m.kind === 'white', hgt = reef ? 52 : white ? 24 : 34;
      posts.cyl(m.x, -6, m.y, 1.5, 1.3, hgt + 6, white ? COL3.white : COL3.post, 6);
      if (white) { posts.box(m.x, hgt + 2, m.y, 8, 8, 8, COL3.white); continue; }
      if (reef) { board(m.x, hgt + 6, m.y, 20, 20, cell(11)); board(m.x, hgt + 6, m.y, 20, 20, cell(11), false); continue; }
      if (m.kind === 'green') board(m.x, hgt - 4, m.y, 17, 17, cell(greens[m.n] != null ? greens[m.n] : 0));
      else board(m.x, hgt - 4, m.y, 19, 19, cell(reds[m.n] != null ? reds[m.n] : 5));
    }
    for (const sg of World.signs) { posts.cyl(sg.x, -6, sg.y, 1.3, 1.1, 34, COL3.post, 6); board(sg.x, 34, sg.y, 54, 19.4, [(12 * 64 + 2) / 1024, 10 / 64, (12 * 64 + 126) / 1024, 54 / 64]); }
    this.scene.add(new THREE.Mesh(posts.build(), this.mats.solid), new THREE.Mesh(boards.build(), this.mats.board));
    // floating things: trap floats near us (refilled every frame), the wreck buoys and the spot buoys (they bob)
    const fb = new THREE.SphereGeometry(4.4, 10, 7), fs = new THREE.CylinderGeometry(4.55, 4.55, 1.8, 10, 1, true);
    this.floatBall = new THREE.InstancedMesh(fb, this.mats.inst, 160); this.floatBand = new THREE.InstancedMesh(fs, this.mats.inst2, 160);
    for (const m of [this.floatBall, this.floatBand]) { m.frustumCulled = false; m.count = 0; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.setColorAt(0, new THREE.Color(1, 1, 1)); this.scene.add(m); }
    this.buoys = [];
    const buoy = (x, y, ball, band, r, flag) => {
      const g = new Geo(); g.ball(0, 2, 0, r, ball, 1, 0.9, 1, 12, 8); g.cyl(0, 1 - r * 0.15, 0, r * 1.02, r * 1.02, r * 0.4, band, 12);
      if (flag) { g.cyl(0, 2, 0, 0.7, 0.6, 50, [0.15, 0.15, 0.15], 5); g.tris([[0, 50, 0], [22, 44, 0], [0, 38, 0]], hex3(PAL.sun)); }
      const m = new THREE.Mesh(g.build(), this.mats.solid2); m.userData = { x, y, ph: hash2(x | 0, y | 0) * 9 }; this.scene.add(m); this.buoys.push(m); return m;
    };
    for (const b of World.wreckBuoys) buoy(b.x, b.y, [1, 1, 1], hex3('#2a5bd8'), 7);
    this.spotBuoys = {};
    for (const id of SPOT_ORDER) { const [x, y] = spotXY(id); this.spotBuoys[id] = buoy(x, y, hex3(PAL.coral), [1, 1, 1], 9, true); }
  },
  // Alligator Light: an iron lattice tower with the keeper's house halfway up
  buildLight() {
    const L = World.light, g = new Geo(), dark = [0.17, 0.17, 0.18], white = [0.94, 0.93, 0.9];
    const at = (a, h) => { const r = lerp(44, 14, h / 250); return [Math.cos(a) * r, h, Math.sin(a) * r]; };
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; g.rod(at(a, -6), at(a, 250), 1.6, 1.1, dark, 5); }
    for (const h of [8, 30, 80, 140, 200, 248]) for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU, b = ((i + 1) / 8) * TAU; g.rod(at(a, h), at(b, h), 0.8, 0.8, dark, 4); if (h < 240) { const h2 = h === 8 ? 30 : h === 30 ? 80 : h === 80 ? 140 : h === 140 ? 200 : 248; g.rod(at(a, h), at(b, h2), 0.5, 0.5, dark, 3); } }
    g.cyl(0, 34, 0, 27, 27, 22, white, 8); g.cyl(0, 55, 0, 30, 4, 7, dark, 8);
    g.cyl(0, 250, 0, 11, 11, 18, white, 10); g.add(new THREE.ConeGeometry(14, 12, 10), g.at(0, 274, 0), dark);
    const m = new THREE.Mesh(g.build(), this.mats.solid); m.position.set(L.x, 0, L.y); this.scene.add(m);
    this.lamp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: 0xfff2c0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true }));
    this.lamp.position.set(L.x, 259, L.y); this.lamp.renderOrder = 6; this.scene.add(this.lamp);
  },
  // home: the canal walls and the dock behind the house; Flamingo's marina
  buildHome() {
    const H = World.home, g = new Geo();
    for (const sd of [-1, 1]) g.box(H.x + sd * 33, 1.5, H.cy - 66 + (H.hw + 70) / 2, 6, 7, H.hw + 70, COL3.concrete);
    g.box(H.x, 1.5, H.cy - 65, 72, 7, 6, COL3.concrete);
    g.box(H.x - 20, 4, H.cy - 2, 20, 2, 56, COL3.dock);
    for (const dz of [-26, 0, 26]) g.cyl(H.x - 10, -4, H.cy + dz, 1.4, 1.4, 12, [0.45, 0.36, 0.26], 6);
    const [fx] = spotXY('flamingo'), fy = wy(fx, mainlandS(fx));
    for (let k = 0; k < 4; k++) g.box(fx - 40, 4, fy - 220 + k * 52, 40, 2, 8, COL3.dock);
    g.box(fx + 100, landH3(fx + 100, fy - 180) + 9, fy - 180, 60, 18, 40, [0.92, 0.89, 0.82]); g.box(fx + 100, landH3(fx + 100, fy - 180) + 19, fy - 180, 64, 3, 44, hex3('#5a7a8a'));
    this.scene.add(new THREE.Mesh(g.build(), this.mats.solid));
  },

  /* ---------- boats ---------- */
  buildBoats() {
    this.hero = new THREE.Group(); this.hero.rotation.order = 'YZX'; this.scene.add(this.hero);
    this.heroHull = new THREE.Mesh(Models.boatGeo(), this.mats.boat); this.hero.add(this.heroHull);
    this.people = {}; this.crewG = new THREE.Group(); this.hero.add(this.crewG);
    // other boats share one simpler model, tinted per boat
    this.otherGeo = Models.boatGeo({ simple: true, n: 12 });
    const pg = Models.personGeo('generic'); this.otherPerson = pg;
    this.others = [];
    for (let i = 0; i < 8; i++) {
      const grp = new THREE.Group(); grp.rotation.order = 'YZX';
      const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
      grp.add(new THREE.Mesh(this.otherGeo, mat));
      const p = new THREE.Mesh(pg.body, this.mats.boat); p.position.set(-10, 6, -2); grp.add(p);
      grp.visible = false; this.scene.add(grp); this.others.push({ g: grp, mat, rx: 0, rz: 0 });
    }
    // FWC: white with a blue stripe and a light bar
    const fg = new Geo(); Models.hullInto(fg, { stripe: hex3('#1e50aa'), n: 12 });
    fg.box(2, 16.5, 0, 16, 21, 14, COL3.console); fg.tris([[10, 27, -7], [10, 27, 7], [5, 33, 7], [10, 27, -7], [5, 33, 7], [5, 33, -7]], COL3.glass);
    for (const [x, z] of [[-15, -10], [-15, 10], [9, -10], [9, 10]]) fg.rod([x, 6, z * 0.75], [x, 42, z], 0.8, 0.8, COL3.metal, 6);
    fg.box(-2.5, 43.2, 0, 29, 2.4, 24, [0.95, 0.95, 0.95]);
    for (const z of [-7.5, 7.5]) { fg.box(-52, 16, z, 9, 12, 7.4, COL3.engine); fg.box(-51, 4, z, 4.5, 12, 2.4, COL3.engine); }
    this.fwcBoat = new THREE.Group(); this.fwcBoat.rotation.order = 'YZX'; this.fwcBoat.add(new THREE.Mesh(fg.build(), this.mats.boat));
    this.fwcLights = [0x2f7bff, 0xff3b3b].map((c, i) => { const m = new THREE.Mesh(new THREE.BoxGeometry(4, 2.6, 8), new THREE.MeshBasicMaterial({ color: c, fog: false })); m.position.set(-2, 46, i ? 6 : -6); this.fwcBoat.add(m); return m; });
    this.fwcBoat.scale.setScalar(0.9); this.fwcBoat.visible = false; this.scene.add(this.fwcBoat);
  },
  setCrew(s) {
    const key = s.crew.join(','); if (key === this.crewKey) return; this.crewKey = key;
    while (this.crewG.children.length) this.crewG.remove(this.crewG.children[0]);
    const spots = [[-10.5, 6, -2.5, 0], [-28, 6, 7, -0.6], [25, 8.5, -1, 0.3]];
    this.crewArms = [];
    s.crew.forEach((ch, i) => {
      const sp = spots[i]; if (!sp) return;
      if (!this.people[ch]) this.people[ch] = Models.personGeo(ch);
      const P = this.people[ch], grp = new THREE.Group(); grp.position.set(sp[0], sp[1], sp[2]); grp.rotation.y = sp[3];
      grp.add(new THREE.Mesh(P.body, this.mats.boat));
      const arms = [-1, 1].map((sd) => { const a = new THREE.Mesh(P.arm, this.mats.boat); a.position.set(0, 17.2, sd * 4.6); grp.add(a); return a; });
      this.crewArms.push({ arms, driver: i === 0, ph: i * 1.7 });
      this.crewG.add(grp);
    });
  },

  /* ---------- wildlife ---------- */
  buildLife() {
    // dolphins: a smooth body, a fin, flukes
    const d = new Geo(), prof = [[22, 0], [18, 2.2], [12, 3.6], [4, 4.6], [-6, 4.2], [-14, 2.8], [-20, 1.4], [-24, 0.6]];
    const rows = [], seg = 10;
    for (const [x, r] of prof) { const row = []; for (let i = 0; i <= seg; i++) { const a = (i / seg) * TAU; row.push([x, Math.sin(a) * r * 0.95, Math.cos(a) * r]); } rows.push(row); }
    d.sheet(rows, (x, y) => (y > -0.8 ? [0.5, 0.59, 0.66] : [0.88, 0.9, 0.91]));
    d.tris([[2, 3.8, 0], [-6, 3.6, 0], [-5, 10, 0]], [0.38, 0.47, 0.55]);
    d.tris([[-23, 0.4, 0], [-29, 0.6, 6], [-27, 0.6, 0], [-23, 0.4, 0], [-27, 0.6, 0], [-29, 0.6, -6]], [0.4, 0.5, 0.58]);
    d.tris([[8, -1.5, 3.5], [3, -2.5, 8], [4, -1.5, 3.5], [8, -1.5, -3.5], [4, -1.5, -3.5], [3, -2.5, -8]], [0.4, 0.5, 0.58]);
    const dg = d.build();
    this.dolphins = [0, 1, 2].map(() => { const m = new THREE.Mesh(dg, this.mats.boat); m.rotation.order = 'YZX'; m.visible = false; this.scene.add(m); return m; });
    // turtles: a domed shell, head and flippers
    const t = new Geo(); t.ball(0, 0, 0, 7, [0.42, 0.36, 0.2], 1.25, 0.42, 1, 10, 6); t.ball(9.5, 0.5, 0, 2.6, [0.55, 0.52, 0.36]);
    for (const [x, z] of [[4, 7], [4, -7], [-6, 6], [-6, -6]]) t.ball(x, -0.5, z, 2.2, [0.5, 0.48, 0.34], 1.6, 0.35, 0.8, 6, 4);
    this.turtleGeo = t.build(); this.turtles = [];
    // birds: a body and two wings that flap
    const bird = (body, wing, span, beak) => {
      const b = new Geo(); b.ball(0, 0, 0, 1, body, 4.5, 1.6, 1.6, 8, 5); b.ball(4.2, 0.8, 0, 1.4, body); if (beak) b.box(7, 0.4, 0, beak, 0.7, 0.9, [0.85, 0.6, 0.25]);
      const w = new Geo(); w.tris([[1.5, 0, 0], [-2.5, 0, 0], [-1, 0, span], [1.5, 0, 0], [-1, 0, span], [0.5, 0, span * 0.7]], wing);
      return { body: b.build(), wing: w.build() };
    };
    this.birdKinds = { pelican: bird([0.55, 0.5, 0.45], [0.45, 0.4, 0.36], 15, 7), gull: bird([0.96, 0.96, 0.96], [0.72, 0.75, 0.78], 10, 2.5), frigate: bird([0.1, 0.11, 0.13], [0.09, 0.1, 0.12], 17, 3) };
    this.birds = [];
    // the manatee's snout when it comes up to breathe
    const mn = new Geo(); mn.ball(0, 0, 0, 4.2, [0.48, 0.48, 0.46], 1.3, 0.6, 1, 8, 5); this.snout = new THREE.Mesh(mn.build(), this.mats.boat); this.snout.visible = false; this.scene.add(this.snout);
  },
  bird(i, kind) {
    let B = this.birds[i];
    if (!B || B.kind !== kind) {
      if (B) this.scene.remove(B.g);
      const K = this.birdKinds[kind], g = new THREE.Group(); g.rotation.order = 'YZX'; g.add(new THREE.Mesh(K.body, this.mats.boat));
      const wl = new THREE.Mesh(K.wing, this.mats.boat), wr = new THREE.Mesh(K.wing, this.mats.boat); wr.scale.z = -1; g.add(wl, wr);
      B = this.birds[i] = { g, wl, wr, kind }; this.scene.add(g);
    }
    B.g.visible = true; return B;
  },

  /* ---------- things painted on the water ---------- */
  buildDecals() {
    const quad = new THREE.PlaneGeometry(1, 1); quad.rotateX(-Math.PI / 2); quad.setAttribute('aA', new THREE.BufferAttribute(new Float32Array(4).fill(1), 1));
    const inst = (tex, col, n, o = {}) => {
      const m = new THREE.InstancedMesh(quad, this.decalMat(tex, col, Object.assign({ inst: true }, o)), n);
      m.geometry = quad.clone(); m.geometry.setAttribute('aIA', new THREE.InstancedBufferAttribute(new Float32Array(n), 1).setUsage(THREE.DynamicDrawUsage));
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; m.count = 0; m.renderOrder = o.order || 1; this.scene.add(m); return m;
    };
    this.shadows = inst(this.blobTex, [0.02, 0.12, 0.2], 16, { lift: 0.4, order: 1 });
    this.foam = inst(this.puffTex, [1, 1, 1], 520, { lift: 0.9, order: 2 });
    this.baits = inst(this.blobTex, [0.04, 0.1, 0.22], 4, { lift: 0.5, order: 1 });
    // sargassum, offshore: every blob of every weedline, fixed
    const blobs = []; for (const w of World.weed) { const ca = Math.cos(w.ang), sa = Math.sin(w.ang); for (const [dx, dy, r] of w.blobs) blobs.push([w.x + dx * ca - dy * sa, w.y + dx * sa + dy * ca, r, w.ang]); }
    this.weed = inst(this.weedTex, [1, 1, 1], blobs.length, { lift: 0.7, order: 1 });
    const M = new THREE.Matrix4(), ia = this.weed.geometry.attributes.aIA;
    blobs.forEach(([x, y, r, a], i) => { M.compose(new THREE.Vector3(x, 0, y), new THREE.Quaternion().setFromAxisAngle(UP, -a), new THREE.Vector3(r * 2.8, 1, r * 2.2)); this.weed.setMatrixAt(i, M); ia.array[i] = 0.95; });
    this.weed.count = blobs.length; ia.needsUpdate = true;
    // ribbons: the wakes (rebuilt every frame), the course line, the dashed rings around the spots
    const ribbon = (max, tex, col, o = {}) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(max * 2), 2).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute('aA', new THREE.BufferAttribute(new Float32Array(max), 1).setUsage(THREE.DynamicDrawUsage));
      g.setDrawRange(0, 0); const m = new THREE.Mesh(g, this.decalMat(tex, col, o)); m.frustumCulled = false; m.renderOrder = o.order || 2; m.userData.max = max; this.scene.add(m); return m;
    };
    this.wakes = ribbon(9000, this.foamTex, [1, 1, 1], { lift: 0.8, order: 2 });
    this.course = ribbon(3000, this.dashTex, [1, 1, 1], { lift: 1.0, order: 3 });
    this.rip = ribbon(400, this.dashTex, [1, 1, 1], { lift: 0.9, order: 3, op: 0.4 });
    this.rings = {};
    for (const id of SPOT_ORDER) {
      const [x, y] = spotXY(id), R = SPOTS[id].r, n = Math.max(48, Math.round(R / 8)), P = [], UV = [], A = [];
      const per = Math.round((TAU * R) / 44);
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * TAU, a1 = ((i + 1) / n) * TAU, u0 = (i / n) * per, u1 = ((i + 1) / n) * per;
        const v = (a, rr) => [x + Math.cos(a) * rr, 0, y + Math.sin(a) * rr], p = [v(a0, R - 3.5), v(a1, R - 3.5), v(a1, R + 3.5), v(a0, R - 3.5), v(a1, R + 3.5), v(a0, R + 3.5)], uu = [[u0, 0], [u1, 0], [u1, 1], [u0, 0], [u1, 1], [u0, 1]];
        for (let k = 0; k < 6; k++) { P.push(...p[k]); UV.push(...uu[k]); A.push(1); }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.setAttribute('aA', new THREE.Float32BufferAttribute(A, 1));
      const m = new THREE.Mesh(g, this.decalMat(this.dashTex, [1, 1, 1], { lift: 0.9 })); m.renderOrder = 3; m.frustumCulled = false; this.scene.add(m); this.rings[id] = m;
    }
    // spray: soft white points
    const sg = new THREE.BufferGeometry(), SN = 260;
    sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SN * 3), 3).setUsage(THREE.DynamicDrawUsage));
    sg.setAttribute('aS', new THREE.BufferAttribute(new Float32Array(SN), 1).setUsage(THREE.DynamicDrawUsage));
    sg.setAttribute('aA', new THREE.BufferAttribute(new Float32Array(SN), 1).setUsage(THREE.DynamicDrawUsage));
    sg.setDrawRange(0, 0);
    this.sprayU = { uPx: { value: 500 } };
    this.spray = new THREE.Points(sg, new THREE.ShaderMaterial({ uniforms: this.sprayU, vertexShader: SPRAY_VS, fragmentShader: SPRAY_FS, transparent: true, depthWrite: false }));
    this.spray.frustumCulled = false; this.spray.renderOrder = 4; this.spray.userData.max = SN; this.scene.add(this.spray);
  },

  /* ---------- every frame ---------- */
  reset(s) {
    if (!this.built) return;
    this.setWaves(s); this.skyNow = null; this.setSky(s); this.setCrew(s);
    this.bob = { y: 0, vy: 0, p: 0, vp: 0, r: 0, vr: 0 }; this.lastT = null; this.slapSeen = 0; this.warm = true;
    GL.settle(); this.U.uFade.value.set(s.x, s.y, 1250);
  },
  draw(s, ctx, W, H, t) {
    const now = performance.now();
    try {
      if (this.boatOf !== s || this.shownFor !== GL.frameNo) { this.boatOf = s; this.reset(s); }   // a new ride, or back from a fight
      const c = Chase.setup(s, W, H, t), busy = !!s.panel;   // under the chart or a menu the picture just holds still
      if (GL.pace(now, busy)) { this.update(s, c, W, H, t); GL.r.render(this.scene, this.cam); GL.drew(now, busy); }
      this.shownFor = GL.frameNo;
    } catch (e) { console.error(e); GL.fail('error'); Chase.draw(s, ctx, W, H, t); return; }
    this.overlay(s, ctx, W, H, t);
  },
  update(s, c, W, H, t) {
    const U = this.U, dt = this.lastT == null ? 1 / 60 : clamp(t - this.lastT, 0, 0.1); this.lastT = t;
    U.uTime.value = t; this.setSky(s);
    // the camera: exactly the chase camera, plus a shake when the boat slams
    const cam = this.cam, sh = Game.shakeT > 0 && !Game.reduced ? Game.shakeAmt * 0.5 * Math.min(1, Game.shakeT * 4) : 0;
    cam.fov = (2 * Math.atan(H / 2 / c.F) * 180) / Math.PI; cam.aspect = W / H; cam.setViewOffset(W, H, 0, H / 2 - c.CY, W, H);
    cam.position.set(c.x + rand(-sh, sh), c.H + rand(-sh, sh), c.y + rand(-sh, sh));
    cam.lookAt(c.x + c.ca * c.cp * 100, c.H - c.sp * 100, c.y + c.sa * c.cp * 100);
    this.sprayU.uPx.value = (GL.r.domElement.height / 2) / Math.tan((cam.fov * Math.PI) / 360);
    // sky and water follow us around
    this.skyMesh.position.copy(cam.position); this.clouds.position.copy(cam.position); this.clouds.rotation.y = -t * 0.004;
    const cw = this.waterCell * 2; this.water.position.set(Math.round(s.x / cw) * cw, 0, Math.round(s.y / cw) * cw); this.farWater.position.copy(this.water.position);
    this.farWater.material = GFX.TIERS[GFX.tier].hi ? this.farHi : this.farLo;
    U.uFade.value.set(s.x, s.y, 1250);
    this.updateLand(c);
    for (const m of this.veg) if (!m.userData.always && m.boundingSphere) { const b = m.boundingSphere; m.visible = Math.hypot(b.center.x - c.x, b.center.z - c.y) < 9500 + b.radius; }
    this.updateHero(s, dt, t);
    this.updateOthers(s, t);
    this.updateFloats(s, t);
    this.updateWater(s, t);
    this.updateLife(s, t);
    this.updateCars();
    // the lighthouse lamp
    const fl = Math.max(0, Math.sin(t * 2.2)); this.lamp.visible = fl > 0.05; this.lamp.scale.setScalar(40 + fl * 120); this.lamp.material.opacity = 0.5 + fl * 0.5;
    // see through whatever stands between the camera and our boat
    const bp = Chase.proj(s.x, s.y, 20), k = GL.r.domElement.height / H;
    if (bp) U.uCut.value.set(bp.x * k, (H - bp.y) * k, 95 * k, Math.max(0, bp.z - 70)); else U.uCut.value.set(-9999, -9999, 1, 0);
  },
  updateHero(s, dt, t) {
    const B = this.bob, h = s.h, ca = Math.cos(h), sa = Math.sin(h), W = (lx, ly) => this.waveH(s.x + ca * lx - sa * ly, s.y + sa * lx + ca * ly);
    // ride the swell: height and tilt from the water under the hull, a spring so it doesn't jitter, smoother when planing
    const hb = W(36, 0), hs = W(-38, 0), hp = W(0, -14), hst = W(0, 14), plane = clamp((s.v - 120) / 150, 0, 1);
    const ty = ((hb + hs + hp + hst) / 4) * (1 - plane * 0.5) - plane * 1.5 + (s.v < 20 ? 0 : -0.5);
    const tp = Math.atan2(hb - hs, 74) * (1 - plane * 0.6) + (s.v > 30 && s.v < 160 ? 0.075 * Math.sin((Math.PI * (s.v - 30)) / 130) : 0.025 * Chase.k);
    const tr = Math.atan2(hst - hp, 28) * (1 - plane * 0.5) - s.rudder * clamp(s.v / 200, 0, 1) * 0.15;
    // a slam over the chop: the same moment the hull-slap sound plays
    if (s.slapT != null && s.slapT > this.slapSeen + 0.05) { B.vp -= 0.5 * clamp(s.v / 320, 0.3, 1) * (0.6 + s.wind.chop); B.vy += 4; }
    this.slapSeen = s.slapT || 0;
    const spring = (x, v, target, kk, d) => { v += (kk * (target - x) - d * v) * dt; return [x + v * dt, v]; };
    [B.y, B.vy] = spring(B.y, B.vy, ty, 60, 11); [B.p, B.vp] = spring(B.p, B.vp, tp, 70, 10); [B.r, B.vr] = spring(B.r, B.vr, tr, 55, 9);
    const za = s.air ? Math.sin((s.air.t / s.air.dur) * Math.PI) : 0;
    this.hero.position.set(s.x, B.y + za * 28, s.y);
    this.hero.rotation.set(-B.r, -h, B.p + za * 0.14);
    // the crew: hands on the wheel, the rest hang on (and throw their arms up for airtime)
    for (const cr of this.crewArms || []) cr.arms.forEach((a, i) => {
      const sd = i ? 1 : -1, cheer = za > 0.2 || (s.dolphins && !cr.driver && Math.sin(t * 3 + cr.ph) > 0.6);
      if (cr.driver && i === 0) { a.rotation.set(0, 0, 0.95); return; }
      a.rotation.set(cheer ? -sd * 2.6 : -sd * 0.12, 0, cr.driver ? 0.95 : 0.1 + Math.sin(t * 1.3 + cr.ph) * 0.05);
    });
    this.heroZa = za;
  },
  updateOthers(s, t) {
    const list = s.boats.filter((B) => !B.dead && dist(B.x, B.y, s.x, s.y) < 6000);
    this.others.forEach((O, i) => {
      const B = list[i]; O.g.visible = !!B; if (!B) return;
      const ca = Math.cos(B.h), sa = Math.sin(B.h), hb = this.waveH(B.x + ca * 36, B.y + sa * 36), hs = this.waveH(B.x - ca * 38, B.y - sa * 38);
      O.g.position.set(B.x, (hb + hs) / 2 - 1, B.y); O.g.rotation.set(Math.sin(t * 1.3 + B.x) * 0.04 + B.turn * 0.08, -B.h, Math.atan2(hb - hs, 74) + 0.05);
      O.g.scale.setScalar(B.big ? 1.15 : 0.85); const hc = hex3(B.hull); O.mat.color.setRGB(hc[0], hc[1], hc[2]);
    });
    const F = this.fwcBoat; F.visible = !!s.fwc;
    if (s.fwc) {
      const k = easeOut(s.fwc.k), x = s.x - Math.cos(s.h) * lerp(400, 90, k) + Math.cos(s.h + Math.PI / 2) * 70, y = s.y - Math.sin(s.h) * lerp(400, 90, k) + Math.sin(s.h + Math.PI / 2) * 70;
      F.position.set(x, this.waveH(x, y) - 1, y); F.rotation.set(0, -s.h, 0.04); const on = Math.floor(t * 8) % 2;
      this.fwcLights[0].material.color.setHex(on ? 0x2f7bff : 0x9fc4ff); this.fwcLights[1].material.color.setHex(on ? 0xffffff : 0xff3b3b);
      this.fwcAt = [x, y];
    }
  },
  updateFloats(s, t) {
    const M = this.M || (this.M = new THREE.Matrix4()), col = this.col || (this.col = new THREE.Color()), V = new THREE.Vector3(), Q = new THREE.Quaternion(), E = new THREE.Euler();
    let n = 0; const cap = 160;
    const near = []; for (let i = Math.floor((s.x - 2400) / 400); i <= Math.floor((s.x + 2400) / 400); i++) for (const f of World.floatBuckets.get(i) || []) near.push(f);
    for (const f of near) {
      if (n >= cap) break; if (f.hit || dist(f.x, f.y, s.x, s.y) > 2400) continue;
      const y = this.waveH(f.x, f.y) + Math.sin(t * 2 + f.x) * 0.6 + 1.2;
      E.set(Math.sin(t * 1.7 + f.y) * 0.2, 0, Math.cos(t * 1.4 + f.x) * 0.2); Q.setFromEuler(E);
      M.compose(V.set(f.x, y, f.y), Q, ONE); this.floatBall.setMatrixAt(n, M); this.floatBand.setMatrixAt(n, M);
      const a = hex3(f.c), b = hex3(f.st); col.setRGB(a[0], a[1], a[2]); this.floatBall.setColorAt(n, col); col.setRGB(b[0], b[1], b[2]); this.floatBand.setColorAt(n, col);
      n++;
    }
    for (const m of [this.floatBall, this.floatBand]) { m.count = n; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    for (const b of this.buoys) { const u = b.userData; b.position.set(u.x, this.waveH(u.x, u.y) + Math.sin(t * 2 + u.ph) * 0.8 - 1, u.y); b.rotation.set(Math.sin(t * 1.3 + u.ph) * 0.08, Math.sin(t * 0.3 + u.ph) * 0.4, Math.cos(t * 1.1 + u.ph) * 0.08); }
    for (const id of SPOT_ORDER) this.spotBuoys[id].visible = Charts.isKnown(id) && !s.homeRun;
  },
  // wakes, foam, spray, shadows, the course, the rings, the bait at the Hump
  updateWater(s, t) {
    // wake ribbons: the white prop wash down the middle and the two spreading arms of the V
    const g = this.wakes.geometry, P = g.attributes.position.array, UV = g.attributes.uv.array, A = g.attributes.aA.array, max = this.wakes.userData.max;
    let n = 0;
    const strip = (pts, wid, off, alpha) => {
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i]; if (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) > 120 || n + 6 > max) continue;
        const aa = alpha(a), ab = alpha(b); if (aa <= 0.01 && ab <= 0.01) continue;
        const wa = wid(a), wb = wid(b), oa = off(a), ob = off(b), na = [-Math.sin(a.h), Math.cos(a.h)], nb = [-Math.sin(b.h), Math.cos(b.h)];
        const L0 = [a.x + na[0] * (oa - wa / 2), a.y + na[1] * (oa - wa / 2)], R0 = [a.x + na[0] * (oa + wa / 2), a.y + na[1] * (oa + wa / 2)];
        const L1 = [b.x + nb[0] * (ob - wb / 2), b.y + nb[1] * (ob - wb / 2)], R1 = [b.x + nb[0] * (ob + wb / 2), b.y + nb[1] * (ob + wb / 2)];
        const va = a.v0 || 0, vb = b.v0 || 0;
        for (const [p, u, v, al] of [[L0, 0, va, aa], [R0, 1, va, aa], [R1, 1, vb, ab], [L0, 0, va, aa], [R1, 1, vb, ab], [L1, 0, vb, ab]]) { P[n * 3] = p[0]; P[n * 3 + 1] = 0; P[n * 3 + 2] = p[1]; UV[n * 2] = u; UV[n * 2 + 1] = v; A[n] = al; n++; }
      }
    };
    const wakeOf = (tr, speedK, scale) => {
      if (tr.length < 2) return;
      let along = 0; for (let i = tr.length - 1; i >= 0; i--) { tr[i].v0 = along / 90; if (i) along += Math.hypot(tr[i].x - tr[i - 1].x, tr[i].y - tr[i - 1].y); }
      const age = (p) => s.t - p.t, kk = (p) => clamp((p.v || 0) / 320, 0, 1) * speedK;
      strip(tr, (p) => (12 + 20 * kk(p)) * (1 - age(p) / 5) * scale, () => 0, (p) => { const f = 1 - age(p) / 4; return f > 0 ? 0.55 * f * f * (0.3 + 0.7 * kk(p)) : 0; });
      for (const sd of [-1, 1]) strip(tr, (p) => (5 + 5 * kk(p)) * scale, (p) => sd * (12 + age(p) * (16 + 34 * kk(p))) * scale, (p) => { const f = 1 - age(p) / 4; return f > 0 ? 0.5 * f * (0.25 + 0.75 * kk(p)) : 0; });
    };
    const mine = s.trail.slice(); if (s.v > 12) mine.push({ x: s.x - Math.cos(s.h) * 46, y: s.y - Math.sin(s.h) * 46, h: s.h, v: s.v, t: s.t });
    if (!this.heroZa || this.heroZa < 0.3) {
      wakeOf(mine, 1, 1);
      // the bow wave: white water peeling off both sides of the hull, more of it the faster we go
      if (s.v > 45) {
        const k = clamp((s.v - 45) / 230, 0, 1), ch = Math.cos(s.h), sh = Math.sin(s.h), odo = s.legDist || 0, hullW = (lx) => (lx > 34 ? ((44 - lx) / 10) * 7 : lx > 20 ? 7 + ((34 - lx) / 14) * 5.5 : lx > 0 ? 12.5 + ((20 - lx) / 20) * 2.5 : 15);
        for (const sd of [-1, 1]) {
          const pts = []; for (let lx = 40; lx >= -70; lx -= 6) pts.push({ x: s.x + ch * lx, y: s.y + sh * lx, h: s.h, lx, v0: (odo - lx) / 70 });
          strip(pts, (p) => (3 + 7 * k) * (p.lx < -40 ? 1 + (-40 - p.lx) / 25 : 1), (p) => sd * (hullW(p.lx) + 2.5 + Math.max(0, 18 - p.lx) * 0.12 * k), (p) => 0.75 * k * clamp((44 - p.lx) / 10, 0, 1) * clamp((p.lx + 72) / 25, 0, 1));
        }
      }
    }
    for (const B of s.boats) if (!B.dead && dist(B.x, B.y, s.x, s.y) < 4000) wakeOf(B.trail.map((p) => ({ x: p.x, y: p.y, h: B.h, v: B.v * 0.8, t: p.t })), 1, B.big ? 1.1 : 0.85);
    g.setDrawRange(0, n); g.attributes.position.needsUpdate = g.attributes.uv.needsUpdate = g.attributes.aA.needsUpdate = true;
    this.wakes.material.uniforms.uScroll.value.set(0, 0);
    // foam blobs, spray and boat shadows
    const M = this.M, V = new THREE.Vector3(), Q = new THREE.Quaternion(), Sc = new THREE.Vector3();
    let k = 0; const fa = this.foam.geometry.attributes.aIA;
    for (const f of s.foam) { if (k >= 520) break; if (Math.abs(f.x - s.x) > 3000 || Math.abs(f.y - s.y) > 3000) continue; const hs = (f.x * 12.9898 + f.y * 78.233) % 1; M.compose(V.set(f.x, 0, f.y), Q.setFromAxisAngle(UP, hs * 6.28), Sc.set(f.r * (2.2 + hs), 1, f.r * (1.5 + hs * 0.6))); this.foam.setMatrixAt(k, M); fa.array[k] = 0.5 * (1 - f.t / f.life); k++; }
    this.foam.count = k; this.foam.instanceMatrix.needsUpdate = true; fa.needsUpdate = true;
    const sp = this.spray.geometry, SP = sp.attributes.position.array, SS = sp.attributes.aS.array, SA = sp.attributes.aA.array; let m = 0;
    for (const q of Chase.spray) { if (m >= this.spray.userData.max) break; SP[m * 3] = q.x; SP[m * 3 + 1] = q.z + 1; SP[m * 3 + 2] = q.y; SS[m] = q.r * 1.5; SA[m] = 0.5 * (1 - q.t / q.life); m++; }
    sp.setDrawRange(0, m); sp.attributes.position.needsUpdate = sp.attributes.aS.needsUpdate = sp.attributes.aA.needsUpdate = true;
    const sun = this.U.uSunDir.value, sl = Math.min(1.6, Math.hypot(sun.x, sun.z) / Math.max(0.2, sun.y)) / Math.max(1e-3, Math.hypot(sun.x, sun.z)), sx = -sun.x * sl, sz = -sun.z * sl, sha = this.shadows.geometry.attributes.aIA;
    let j = 0;
    const shadow = (x, y, h, len, wid, lift, a) => { M.compose(V.set(x + sx * (8 + lift), 0, y + sz * (8 + lift)), Q.setFromAxisAngle(UP, -h), Sc.set(len * (1 + lift * 0.01), 1, wid * (1 + lift * 0.01))); this.shadows.setMatrixAt(j, M); sha.array[j] = a; j++; };
    shadow(s.x, s.y, s.h, 112, 40, (this.heroZa || 0) * 28, 0.22 - (this.heroZa || 0) * 0.08);
    this.others.forEach((O) => { if (O.g.visible) shadow(O.g.position.x, O.g.position.z, -O.g.rotation.y, 96 * O.g.scale.x, 36 * O.g.scale.x, 0, 0.18); });
    if (s.manatee) { const mt = s.manatee, up = Math.sin(mt.t * 0.8) > 0.1; shadow(mt.x, mt.y, mt.h, 72, 30, 0, up ? 0.5 : 0.36); this.snout.visible = up; if (up) this.snout.position.set(mt.x + Math.cos(mt.h) * 30, this.waveH(mt.x, mt.y) + 0.6, mt.y + Math.sin(mt.h) * 30); } else this.snout.visible = false;
    for (const T of this.turtles) if (T.visible) shadow(T.position.x, T.position.z, -T.rotation.y, 26, 20, 0, 0.18);
    this.shadows.count = j; this.shadows.instanceMatrix.needsUpdate = true; sha.needsUpdate = true;
    // the autopilot's course
    const cg = this.course.geometry, CP = cg.attributes.position.array, CU = cg.attributes.uv.array, CA = cg.attributes.aA.array; let c = 0;
    if (s.route && s.dest) {
      const pts = [[s.x, s.y]]; for (let i = s.ri; i < s.route.length; i++) pts.push(s.route[i]);
      let u = 0; const cmax = this.course.userData.max;
      for (let i = 1; i < pts.length && c + 6 <= cmax; i++) {
        const [ax, ay] = pts[i - 1], [bx, by] = pts[i], L = Math.hypot(bx - ax, by - ay); if (L < 1) continue;
        const nx = -(by - ay) / L, ny = (bx - ax) / L, steps = Math.max(1, Math.ceil(L / (dist(ax, ay, s.x, s.y) < 1500 ? 40 : 300)));
        for (let k2 = 0; k2 < steps && c + 6 <= cmax; k2++) {
          const k0 = k2 / steps, k1 = (k2 + 1) / steps, x0 = lerp(ax, bx, k0), y0 = lerp(ay, by, k0), x1 = lerp(ax, bx, k1), y1 = lerp(ay, by, k1), u0 = u + (L * k0) / 60, u1 = u + (L * k1) / 60, w = 4.5;
          const fadeIn = (x, y) => clamp((dist(x, y, s.x, s.y) - 40) / 120, 0, 1);
          for (const [x, y, uu, v, al] of [[x0 - nx * w, y0 - ny * w, u0, 0, fadeIn(x0, y0)], [x0 + nx * w, y0 + ny * w, u0, 1, fadeIn(x0, y0)], [x1 + nx * w, y1 + ny * w, u1, 1, fadeIn(x1, y1)], [x0 - nx * w, y0 - ny * w, u0, 0, fadeIn(x0, y0)], [x1 + nx * w, y1 + ny * w, u1, 1, fadeIn(x1, y1)], [x1 - nx * w, y1 - ny * w, u1, 0, fadeIn(x1, y1)]]) { CP[c * 3] = x; CP[c * 3 + 1] = 0; CP[c * 3 + 2] = y; CU[c * 2] = uu; CU[c * 2 + 1] = v; CA[c] = al; c++; }
        }
        u += L / 60;
      }
      const cm = this.course.material.uniforms; cm.uCol.value.setRGB(s.auto ? 1 : 1, s.auto ? 0.84 : 1, s.auto ? 0.35 : 1); cm.uOp.value = s.auto ? 0.75 : 0.45; cm.uScroll.value.set(-0.66, 0);
    }
    cg.setDrawRange(0, c); cg.attributes.position.needsUpdate = cg.attributes.uv.needsUpdate = cg.attributes.aA.needsUpdate = true;
    // dashed rings around the spots we know
    for (const id of SPOT_ORDER) {
      const m2 = this.rings[id], on = Charts.isKnown(id) && !s.homeRun; m2.visible = on; if (!on) continue;
      const here = s.inSpot === id, ok = spotAllowed(id, s.c), u = m2.material.uniforms;
      u.uCol.value.setRGB(1, here ? 0.84 : 1, here ? 0.35 : 1); u.uOp.value = here ? 0.9 : ok ? 0.55 : 0.25; u.uScroll.value.set(-0.33, 0);
    }
    // the Hump: bait balls, the current rip
    const [hx, hy] = HUMP_XY, nearHump = dist(s.x, s.y, hx, hy) < 7000; let b = 0; const ba = this.baits.geometry.attributes.aIA;
    if (nearHump) for (let i = 0; i < 3; i++) { const bx = hx + Math.cos(i * 2.1 + t * 0.05) * 280, by = hy + Math.sin(i * 2.1 + t * 0.05) * 180; M.compose(V.set(bx, 0, by), Q.setFromAxisAngle(UP, -i), Sc.set(140, 1, 80)); this.baits.setMatrixAt(b, M); ba.array[b] = 0.42; b++; }
    this.baits.count = b; this.baits.instanceMatrix.needsUpdate = true; ba.needsUpdate = true;
    const rg = this.rip.geometry, RP = rg.attributes.position.array, RU = rg.attributes.uv.array, RA = rg.attributes.aA.array; let rc = 0;
    if (nearHump) {
      const pts = []; for (let k2 = -700; k2 <= 700; k2 += 40) pts.push([hx + k2, hy - 260 + Math.sin(k2 * 0.01 + t * 0.6) * 30 + k2 * 0.25]);
      for (let i = 1; i < pts.length; i++) { const [ax, ay] = pts[i - 1], [bx, by] = pts[i], L = Math.hypot(bx - ax, by - ay), nx = (-(by - ay) / L) * 5, ny = ((bx - ax) / L) * 5, u0 = (i - 1) * 0.7, u1 = i * 0.7; for (const [x, y, uu, v] of [[ax - nx, ay - ny, u0, 0], [ax + nx, ay + ny, u0, 1], [bx + nx, by + ny, u1, 1], [ax - nx, ay - ny, u0, 0], [bx + nx, by + ny, u1, 1], [bx - nx, by - ny, u1, 0]]) { RP[rc * 3] = x; RP[rc * 3 + 2] = y; RU[rc * 2] = uu; RU[rc * 2 + 1] = v; RA[rc] = 1; rc++; } }
    }
    rg.setDrawRange(0, rc); rg.attributes.position.needsUpdate = rg.attributes.uv.needsUpdate = rg.attributes.aA.needsUpdate = true;
  },
  updateLife(s, t) {
    // dolphins on the bow: they leap ahead of us and splash back in
    const D = s.dolphins, ca = Math.cos(s.h), sa = Math.sin(s.h);
    this.dolphins.forEach((m, i) => {
      const pd = D && D.pod[i]; m.visible = !!pd; if (!pd) return;
      const ph = t * 3 + pd.ph, up = Math.sin(ph), x = s.x + ca * (pd.ox + 85) - sa * pd.oy * 1.8, y = s.y + sa * (pd.ox + 85) + ca * pd.oy * 1.8, fade = Math.min(1, D.t * 2, (D.dur - D.t) * 2);
      m.position.set(x, this.waveH(x, y) + up * 17 - 5, y); m.rotation.set(0, -s.h, Math.cos(ph) * 0.7); m.scale.setScalar(Math.max(0.01, fade));
      if (pd.lastUp != null && Math.sign(up) !== Math.sign(pd.lastUp) && Chase.spray.length < 150) for (let k = 0; k < 6; k++) Chase.spray.push({ x: x + rand(-6, 6), y: y + rand(-6, 6), z: 1, vx: ca * s.v * 0.8 + rand(-30, 30), vy: sa * s.v * 0.8 + rand(-30, 30), vz: rand(30, 70), r: rand(2, 4), t: 0, life: rand(0.4, 0.7) });
      pd.lastUp = up;
    });
    // turtles and birds from the chase camera's wildlife list, frigates working the Hump
    let ti = 0, bi = 0;
    for (const L of Chase.life) {
      const fade = clamp(Math.min(L.t, L.life - L.t), 0, 1);
      if (L.kind === 'turtle') {
        let T = this.turtles[ti]; if (!T) { T = this.turtles[ti] = new THREE.Mesh(this.turtleGeo, this.mats.boat); this.scene.add(T); }
        T.visible = true; T.position.set(L.x, this.waveH(L.x, L.y) - 2.2 + fade * 1.8, L.y); T.rotation.set(0, -L.h + Math.sin(t * 0.4 + L.ph) * 0.3, 0); ti++;
      } else {
        const B = this.bird(bi++, L.kind), flap = Math.sin(t * (L.kind === 'pelican' ? 2.2 : 5) + L.ph) * (L.kind === 'pelican' ? 0.25 : 0.5);
        B.g.position.set(L.x, L.z + 4, L.y); B.g.rotation.set(0, -L.h, 0); B.g.scale.setScalar(L.kind === 'pelican' ? 1.4 : 1.1);
        B.wl.rotation.x = flap; B.wr.rotation.x = -flap;
      }
    }
    const [hx, hy] = HUMP_XY;
    if (dist(s.x, s.y, hx, hy) < 7000) for (let i = 0; i < 3; i++) {
      const bx = hx + Math.cos(i * 2.1 + t * 0.05) * 280, by = hy + Math.sin(i * 2.1 + t * 0.05) * 180;
      for (let k = 0; k < 4; k++) { const a = t * (0.9 + k * 0.2) + k * 2 + i, B = this.bird(bi++, 'frigate'), x = bx + Math.cos(a) * 70, y = by + Math.sin(a) * 40; B.g.position.set(x, 150 + k * 22, y); B.g.rotation.set(Math.sin(a) * 0.3, -(a + Math.PI / 2), 0); B.g.scale.setScalar(0.85); const fl = Math.sin(t * 6 + k) * 0.18; B.wl.rotation.x = fl; B.wr.rotation.x = -fl; }
    }
    for (let i = ti; i < this.turtles.length; i++) this.turtles[i].visible = false;
    for (let i = bi; i < this.birds.length; i++) if (this.birds[i]) this.birds[i].g.visible = false;
  },
  updateCars() {
    const M = this.M, V = new THREE.Vector3(), Q = new THREE.Quaternion();
    World.cars.forEach((c, i) => {
      const gp = GAPS.find((G) => c.x > G.x0 - 150 && c.x < G.x1 + 150), y = chainY(c.x) + (c.dir > 0 ? 4.5 : -4.5), h = gp ? deckTop(gp, c.x) : landH3(c.x, chainY(c.x)) + 0.35;
      M.compose(V.set(c.x, h + 2.8, y), Q.setFromAxisAngle(UP, -Math.atan2(chainY(c.x + 5) - chainY(c.x - 5), 10)), ONE); this.cars.setMatrixAt(i, M);
    });
    this.cars.instanceMatrix.needsUpdate = true;
  },

  /* ---------- labels on the 2D canvas, where the 3D camera put things ---------- */
  overlay(s, ctx, W, H, t) {
    const P = (x, y, h) => Chase.proj(x, y, h), on = (p, m = 0) => p && p.x > -m && p.x < W + m;
    if (!s.homeRun) for (const id of SPOT_ORDER) { if (!Charts.isKnown(id) || id === s.dest) continue; const [x, y] = spotXY(id), lp = P(x, y, 70); if (lp && lp.z < 7000 && lp.d > 20 && on(lp)) Chase.drawSpotLabel(ctx, s, id, lp); }
    for (const gp of GAPS) { const lp = P(gp.x, gp.y, 80); if (lp && lp.z < 2600 && on(lp)) text(ctx, gp.name, lp.x, lp.y, { size: clamp(9 + 1500 / lp.z, 12, 18), align: 'center', color: '#fff', weight: 800, stroke: 'rgba(0,0,0,0.5)', sw: 4, alpha: clamp(1 - Chase.fog(lp.z), 0.3, 1) }); }
    { const L = World.light, b = P(L.x, L.y, 0); if (b && b.z < 3200 && on(b)) text(ctx, 'Alligator Light', b.x, b.y + 18, { size: clamp(9 + 1600 / b.z, 12, 17), align: 'center', color: '#fff', weight: 800, stroke: 'rgba(0,0,0,0.5)', sw: 4 }); }
    for (const m of World.markers) if (m.kind === 'reef') { const tp = P(m.x, m.y, 70); if (tp && tp.z < 1400 && on(tp)) text(ctx, m.name, tp.x, tp.y - 6, { size: 13, align: 'center', color: '#fff', weight: 800, stroke: 'rgba(0,0,0,0.55)', sw: 4 }); }
    if (s.fwc && this.fwcAt) { const lt = P(this.fwcAt[0], this.fwcAt[1], 60); if (lt) text(ctx, 'FWC', lt.x, lt.y - 8, { size: 14, align: 'center', color: '#fff', weight: 800, stroke: '#123a8a', sw: 4 }); }
    const xy = s.destXY(); if (xy && !s.panel) { const p = P(xy[0], xy[1], 120); if (p && p.d > 60) Chase.drawDestPin(ctx, s, xy, p, t); }
  }

};
