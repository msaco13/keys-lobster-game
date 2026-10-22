'use strict';
/* Keys Crew — the fish fight in 3D. A camera at the waterline splits the picture like a mask half in the water: the
   sky, the boat and the angler working the rod above; the fish, the line, the reef or the wreck below. It draws in two
   passes over the two halves, each with its own air or water. The fight itself (fight.js) is unchanged; this only
   draws its state. Wherever the fight's 2D layout puts the fish on screen, the 3D fish is put on that same spot, so
   the HUD and the floating scores still line up. Runs on the shared renderer in gl3d.js, with the same safeguards. */

// near/deep: water color just under the surface and far down; clear: how far off the haze starts, vis: where it's total;
// tint: how much the water colors the light down there (deeper, more); caus: how strong the rippling light on the bottom is
const FIGHT_STAGES = {
  offshore: { near: [0.1, 0.4, 0.66], deep: [0.02, 0.12, 0.27], clear: 40, vis: 950, tint: 0.35, caus: 0, floor: null },
  reef: { near: [0.14, 0.55, 0.68], deep: [0.03, 0.19, 0.29], clear: 160, vis: 1300, tint: 0.62, caus: 0.3, floor: 'reef' },
  wreck: { near: [0.12, 0.48, 0.62], deep: [0.02, 0.15, 0.25], clear: 150, vis: 1200, tint: 0.68, caus: 0.25, floor: 'wreck' },
  flats: { near: [0.42, 0.79, 0.74], deep: [0.27, 0.58, 0.52], clear: 220, vis: 1500, tint: 0.15, caus: 0.42, floor: 'sand', shore: 'mangrove' },
  bridge: { near: [0.22, 0.6, 0.58], deep: [0.08, 0.34, 0.34], clear: 180, vis: 1250, tint: 0.35, caus: 0.38, floor: 'sand', shore: 'bridge' },
  glades: { near: [0.44, 0.47, 0.31], deep: [0.24, 0.23, 0.12], clear: 120, vis: 800, tint: 0.4, caus: 0.16, floor: 'mud', shore: 'mangrove' }
};
const UNDER_VS = `varying vec3 vD; void main() { vD = position; gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0); }`;
// with a bottom in view, everything under the horizon is that bottom fading into the haze, so the backdrop there is the haze
const UNDER_FS = `uniform vec3 uNear, uDeep, uHaze; uniform float uFloor; varying vec3 vD;
void main() { vec3 d = normalize(vD); float k = smoothstep(0.02, -0.75, d.y); vec3 c = mix(uNear * 1.12, uDeep, k); c += uNear * 0.35 * smoothstep(-0.12, 0.0, d.y);
  c = mix(c, uHaze, uFloor * smoothstep(-0.005, -0.06, d.y)); gl_FragColor = vec4(c, 1.0); }`;
// light rippling over the bottom (world xz in, a web of bright lines out)
const CAUSTIC = `float caustic(vec2 p, float t) {
  vec2 q = p * 0.021; float c = sin(q.x * 1.7 + t * 0.9 + sin(q.y * 1.3 + t * 0.6) * 1.8) + sin(q.y * 1.9 - t * 0.7 + sin(q.x * 1.1 - t * 0.5) * 1.6) + sin((q.x + q.y) * 1.3 + t * 0.8);
  return pow(clamp(1.0 - abs(c) * 0.55, 0.0, 1.0), 5.0); }
`;
// fish swim: the tail half sweeps side to side (local x runs tail -0.5 to nose +0.5)
const SWIM_CHUNK = 'transformed.z += sin(uSwim - position.x * 7.0) * uAmp * smoothstep(0.25, -0.55, position.x);';

const Fight3D = {
  built: false,
  ready() {
    if (!GL.ensure()) return false;
    if (!this.built) {
      try { this.build(); this.built = true; GL.users.push(this); this.onTier(GFX.TIERS[GFX.tier]); }
      catch (e) { console.error('3D fight failed to build, using the 2D one:', e); GL.fail('error'); return false; }
    }
    return GL.state === 'ready';
  },
  onTier(T) { this.hi = T.hi; if (this.shafts) for (const m of this.shafts) m.visible = T.hi; if (this.snow) this.snow.visible = T.hi; },
  layer(o, n) { o.traverse((c) => c.layers.set(n)); return o; },

  /* ---------- setting up, once ---------- */
  build() {
    const S = (this.scene = new THREE.Scene()), tx = GL.textures();
    this.lay = new THREE.PerspectiveCamera(40, 16 / 9, 4, 20000);   // where the fight's 2D layout maps into the world
    this.cam = new THREE.PerspectiveCamera(40, 16 / 9, 4, 20000);   // what we actually look through (it drifts and pushes in)
    this.airFog = new THREE.Fog(0xcfe6f2, 1500, 16000); this.waterFog = new THREE.Fog(0x1a6aa0, 60, 900);
    this.sun = new THREE.DirectionalLight(0xfff6e6, 3); this.sun.position.set(300, 800, 500); S.add(this.sun, this.sun.target);   // high and over our shoulder, so the side we see is lit
    this.hemi = new THREE.HemisphereLight(0xd8ecf8, 0x2f6f86, 2.1); S.add(this.hemi);
    // the sky (above only)
    this.U = { uTop: { value: new THREE.Color(0.2, 0.52, 0.82) }, uHor: { value: new THREE.Color(0.81, 0.91, 0.96) }, uHaze: { value: new THREE.Color(0.78, 0.9, 0.95) }, uSunDir: { value: new THREE.Vector3(0.45, 0.62, -0.64).normalize() }, uSunCol: { value: new THREE.Color(1, 0.97, 0.9) }, uSunR: { value: 0.03 } };
    this.sky = this.layer(new THREE.Mesh(new THREE.SphereGeometry(15000, 32, 16), new THREE.ShaderMaterial({ uniforms: this.U, vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false })), 1);
    this.sky.renderOrder = 2; this.sky.frustumCulled = false; S.add(this.sky);
    const cg = new Geo(), r = mulberry(31), R = 12000;
    for (let i = 0; i < 12; i++) { const az = -Math.PI * 0.95 + r() * Math.PI * 0.9, el = 0.05 + r() * 0.22, s = (0.8 + r() * 1.5) * (0.7 + el * 2.5), d = [Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)]; cg.quad([d[0] * R, d[1] * R, d[2] * R], [-Math.sin(az), 0, Math.cos(az)], [-Math.cos(az) * Math.sin(el), Math.cos(el), -Math.sin(az) * Math.sin(el)], 1100 * s, 550 * s, [0, 0, 1, 1]); }
    this.clouds = this.layer(new THREE.Mesh(cg.build(), new THREE.MeshBasicMaterial({ map: tx.cloudTex, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide })), 1);
    this.clouds.renderOrder = 3; this.clouds.frustumCulled = false; S.add(this.clouds);
    // the water around us (below only): a backdrop that darkens with depth, shafts of light, drifting specks
    this.UW = { uNear: { value: new THREE.Color() }, uDeep: { value: new THREE.Color() }, uHaze: { value: new THREE.Color() }, uFloor: { value: 0 } };
    this.under = this.layer(new THREE.Mesh(new THREE.SphereGeometry(15000, 24, 12), new THREE.ShaderMaterial({ uniforms: this.UW, vertexShader: UNDER_VS, fragmentShader: UNDER_FS, side: THREE.BackSide, depthWrite: false, fog: false })), 2);
    this.under.renderOrder = 2; this.under.frustumCulled = false; S.add(this.under);
    const shaftTex = canvasTex(32, 256, (g) => { const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 256); const gx = g.createLinearGradient(0, 0, 32, 0); gx.addColorStop(0, 'rgba(0,0,0,1)'); gx.addColorStop(0.5, 'rgba(0,0,0,0)'); gx.addColorStop(1, 'rgba(0,0,0,1)'); g.globalCompositeOperation = 'destination-out'; g.fillStyle = gx; g.fillRect(0, 0, 32, 256); });
    this.shafts = [];
    for (let i = 0; i < 7; i++) {
      const m = this.layer(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shaftTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0.16, color: 0xd8f4ff })), 2);
      m.userData = { x: -200 + i * 230 + r() * 120, z: -150 - r() * 650, w: 40 + r() * 70, ph: r() * 9 }; m.renderOrder = 4; S.add(m); this.shafts.push(m);
    }
    const SN = 180, sg = new THREE.BufferGeometry(), sp = new Float32Array(SN * 3), ss = new Float32Array(SN), sa = new Float32Array(SN);
    for (let i = 0; i < SN; i++) { sp[i * 3] = -400 + r() * 1800; sp[i * 3 + 1] = -5 - r() * 300; sp[i * 3 + 2] = 150 - r() * 700; ss[i] = 1 + r() * 1.6; sa[i] = 0.25 + r() * 0.35; }
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sg.setAttribute('aS', new THREE.BufferAttribute(ss, 1)); sg.setAttribute('aA', new THREE.BufferAttribute(sa, 1));
    this.pxU = { uPx: { value: 500 } };
    this.snow = this.layer(new THREE.Points(sg, new THREE.ShaderMaterial({ uniforms: this.pxU, vertexShader: SPRAY_VS, fragmentShader: SPRAY_FS, transparent: true, depthWrite: false })), 2);
    this.snow.frustumCulled = false; S.add(this.snow);
    // splashes and bubbles: soft white points thrown about, both halves
    const PN = 260, pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(PN * 3), 3).setUsage(THREE.DynamicDrawUsage));
    pg.setAttribute('aS', new THREE.BufferAttribute(new Float32Array(PN), 1).setUsage(THREE.DynamicDrawUsage));
    pg.setAttribute('aA', new THREE.BufferAttribute(new Float32Array(PN), 1).setUsage(THREE.DynamicDrawUsage));
    pg.setDrawRange(0, 0);
    this.splash = new THREE.Points(pg, new THREE.ShaderMaterial({ uniforms: this.pxU, vertexShader: SPRAY_VS, fragmentShader: SPRAY_FS, transparent: true, depthWrite: false }));
    this.splash.frustumCulled = false; this.splash.renderOrder = 5; S.add(this.splash); this.drops = []; this.dropMax = PN;
    // the boat, the angler and two more of the crew
    this.mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    // the bottom and what's on it: the same, with the light rippling over it from above
    this.causU = { uTime: { value: 0 }, uCaus: { value: 0.5 } };
    this.floorMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    this.floorMat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, this.causU);
      sh.vertexShader = 'varying vec3 vWP; varying float vUp;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vUp = normalize(mat3(modelMatrix) * objectNormal).y;');
      sh.fragmentShader = 'uniform float uTime, uCaus; varying vec3 vWP; varying float vUp;\n' + CAUSTIC + sh.fragmentShader.replace('#include <opaque_fragment>', 'outgoingLight += diffuseColor.rgb * caustic(vWP.xz, uTime) * uCaus * clamp(abs(vUp) * 1.4 - 0.2, 0.0, 1.0);\n#include <opaque_fragment>');
    };
    this.floorMat.customProgramCacheKey = () => 'caustic';
    this.boat = new THREE.Group(); this.boat.rotation.order = 'YZX'; this.boat.add(new THREE.Mesh(Models.boatGeo(), this.mat)); S.add(this.boat);
    this.people = {};
    // the rod (a tapered tube rebuilt as it bends), the reel, and the line (a thin ribbon that faces the camera)
    const RS = 14, RR = 5, rg = new THREE.BufferGeometry(), rIdx = [];
    rg.setAttribute('position', new THREE.BufferAttribute(new Float32Array((RS + 1) * RR * 3), 3).setUsage(THREE.DynamicDrawUsage));
    for (let i = 0; i < RS; i++) for (let k = 0; k < RR; k++) { const a = i * RR + k, b = i * RR + ((k + 1) % RR), c = a + RR, d = b + RR; rIdx.push(a, c, d, a, d, b); }
    rg.setIndex(rIdx); this.rodN = { RS, RR };
    this.rod = new THREE.Mesh(rg, new THREE.MeshLambertMaterial({ color: 0x23262b, side: THREE.DoubleSide })); this.rod.frustumCulled = false; S.add(this.rod);
    const reel = new Geo(); reel.cyl(0, -2.2, 0, 2.2, 2.2, 4.4, [0.62, 0.66, 0.7], 10); reel.box(0, 0, 3.1, 0.7, 0.7, 3.2, [0.15, 0.15, 0.16]); reel.box(0, 1.6, 4.5, 1.2, 3.4, 0.7, [0.15, 0.15, 0.16]);
    this.reel = new THREE.Mesh(reel.build(), this.mat); this.reel.rotation.order = 'YXZ'; S.add(this.reel);
    const LN = 40, lg = new THREE.BufferGeometry(), lIdx = [];
    lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array((LN + 1) * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage));
    for (let i = 0; i < LN; i++) { const a = i * 2; lIdx.push(a, a + 1, a + 3, a, a + 3, a + 2); }
    lg.setIndex(lIdx); this.lineN = LN;
    this.line = new THREE.Mesh(lg, new THREE.MeshBasicMaterial({ color: 0xf1f3f2, side: THREE.DoubleSide })); this.line.frustumCulled = false; S.add(this.line);
    // the shark that comes for the tax
    const sk = new Geo(), prof = [[30, 0], [26, 2.4], [18, 4.6], [6, 6.2], [-6, 5.6], [-18, 3.6], [-28, 1.6], [-34, 0.8]], rows = [];
    for (const [x, rr2] of prof) { const row = []; for (let i = 0; i <= 10; i++) { const a = (i / 10) * TAU; row.push([x, Math.sin(a) * rr2 * 0.95, Math.cos(a) * rr2]); } rows.push(row); }
    sk.sheet(rows, (x, y) => (y > -1 ? [0.36, 0.42, 0.46] : [0.85, 0.87, 0.88]));
    sk.tris([[4, 5.5, 0], [-6, 5, 0], [-6, 14, 0], [-33, 0.6, 0], [-42, 12, 0], [-38, 0.8, 0], [-33, 0.6, 0], [-38, 0.8, 0], [-40, -7, 0], [10, -3, 3], [2, -6, 12], [2, -3, 3], [10, -3, -3], [2, -3, -3], [2, -6, -12]], [0.33, 0.39, 0.43]);
    this.shark = new THREE.Mesh(sk.build(), this.mat); this.shark.rotation.order = 'YZX'; this.shark.visible = false; S.add(this.shark);
    this.stages = {};
  },
  // the dressing for one kind of spot, made the first time it's needed: the bottom below, the shore across the way
  stage(key) {
    if (this.stages[key]) return this.stages[key];
    const st = FIGHT_STAGES[key], below = new THREE.Group(), above = new THREE.Group(), r = mulberry(key.length * 97 + 5), pk = (a) => a[Math.floor(r() * a.length)];
    const add = (grp, geo) => grp.add(new THREE.Mesh(geo, grp === below ? this.floorMat : this.mat));
    if (st.floor) {
      // the bottom: a wide sand or mud floor, in patches of color
      const g = new Geo(), deep = st.floor === 'reef' || st.floor === 'wreck', sand = st.floor === 'mud' ? [0.36, 0.3, 0.2] : deep ? [0.66, 0.63, 0.52] : [0.84, 0.79, 0.62];
      const grass = st.floor === 'mud' ? [0.22, 0.25, 0.13] : deep ? [0.42, 0.4, 0.33] : [0.36, 0.5, 0.3], blade = st.floor === 'mud' ? [0.28, 0.32, 0.15] : [0.34, 0.54, 0.28];
      const patch = (x, z) => smooth01((fbm(x * 0.0045 + 7, z * 0.007 + 3) - 0.5) * 7);   // 0 bare sand .. 1 a grass bed (or rubble)
      const rows = []; for (let j = 0; j <= 36; j++) { const row = []; for (let i = 0; i <= 60; i++) row.push([-1000 + i * 55 + (r() - 0.5) * 16, (r() - 0.5) * 4, 220 - j * 38]); rows.push(row); }
      g.sheet(rows, (x, y, z) => mul3(mix3(sand, grass, patch(x, z) * (deep ? 0.6 : 1)), 0.88 + 0.2 * vnoise(x * 0.02, z * 0.02)));
      if (!deep) {
        // tufts of blades standing up out of the grass beds
        for (let i = 0; i < 900; i++) {
          const x = -600 + r() * 1900, z = 160 - r() * 1150; if (patch(x, z) < 0.55) continue;
          const h = 6 + r() * 9; g.add(new THREE.ConeGeometry(1.5, h, 3), g.at(x, h / 2, z, r() * 6).multiply(new THREE.Matrix4().makeRotationZ((r() - 0.5) * 0.5)), mix3(blade, grass, r() * 0.6));
        }
      }
      if (st.floor === 'reef') {
        // the ledge: coral heads, rock, sea fans and sponges
        for (let i = 0; i < 46; i++) {
          const x = -200 + r() * 1300, z = 80 - r() * 700, s = 14 + r() * 30, ledge = x > 250 && x < 750 ? 1.8 : 1;
          g.add(new THREE.IcosahedronGeometry(1, 1), g.at(x, s * 0.3 * ledge, z, r() * 6, s * 1.3, s * 0.8 * ledge, s), mix3(pk([[0.42, 0.37, 0.29], [0.62, 0.5, 0.3], [0.56, 0.52, 0.34], [0.5, 0.36, 0.3]]), [0.5, 0.45, 0.38], r() * 0.5));   // rock, brain and star coral
          if (r() < 0.5) g.ball(x + (r() - 0.5) * s, s * 0.9 * ledge, z, 4 + r() * 6, pk([[0.72, 0.38, 0.62], [0.86, 0.55, 0.28], [0.55, 0.3, 0.6], [0.9, 0.7, 0.3]]), 1, 1.4, 1, 6, 5);
          if (r() < 0.35) g.add(new THREE.CylinderGeometry(9 + r() * 10, 9 + r() * 10, 1.2, 10), g.at(x, s * ledge + 10, z, r() * 3).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)), [0.6, 0.32, 0.62]);
          if (r() < 0.4) for (let k = 0; k < 3; k++) { const bx = x + (r() - 0.5) * s * 1.6, bz = z + (r() - 0.5) * s, top = s * 0.6 * ledge + 14 + r() * 16; g.rod([bx, s * 0.4 * ledge, bz], [bx + (r() - 0.5) * 10, top, bz], 1.6, 0.9, pk([[0.62, 0.4, 0.22], [0.7, 0.55, 0.3], [0.5, 0.3, 0.5]]), 4); }   // sea rods
        }
      }
      if (st.floor === 'wreck') {
        // the freighter, settled on the bottom with a list toward us: its hull, the deckhouse, a broken mast, rust and growth
        const hg = new Geo(), stn = Models.hullInto(hg, { n: 12 }), white = [1, 1, 1];
        hg.box(-28, 19, 0, 16, 13, 24, white); hg.box(-28, 27, 0, 11, 4, 18, white); hg.rod([16, 6, 0], [16, 20, 0], 1.2, 0.9, white);
        const M = new THREE.Matrix4().compose(new THREE.Vector3(470, 12, -300), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.42, -0.3, 0.04, 'YXZ')), new THREE.Vector3(6, 3.2, 4));
        const steel = [0.24, 0.26, 0.27], rust = [0.47, 0.29, 0.17];
        g.add(hg.build(), M, (x, y, z) => mix3(steel, rust, clamp(vnoise(x * 0.025 + 3, y * 0.04 + z * 0.012) * 1.5 - 0.35, 0, 1)));
        // sponges, soft coral and sea fans grown over the plates
        for (let i = 0; i < 40; i++) {
          const q = stn[1 + Math.floor(r() * (stn.length - 1))], sd = r() < 0.5 ? 1 : -1, ht = r() < 0.5 ? 13 : 2 + r() * 10, p = new THREE.Vector3(lerp(q.xw, q.xs, ht / 13), ht, lerp(q.ww, q.ws, ht / 13) * sd).applyMatrix4(M), s2 = 2 + r() * 5;
          const col = pk([[0.66, 0.36, 0.56], [0.8, 0.5, 0.26], [0.3, 0.5, 0.42], [0.82, 0.66, 0.3], [0.5, 0.3, 0.52]]);
          if (r() < 0.3) g.add(new THREE.CylinderGeometry(s2 * 0.7, s2 * 0.5, s2 * 3.2, 6), g.at(p.x, p.y + s2 * 1.4, p.z, r() * 6), col);   // tube sponges
          else g.ball(p.x, p.y + 1, p.z, s2, col, 1.3, 0.7, 1.1, 6, 4);
        }
      }
      add(below, g.build()); below.userData.floor = true;
    }
    if (st.shore === 'mangrove') {
      // a mangrove shore across the flat: a wall of canopy, prop roots in the water
      const g = new Geo(), dark = key === 'glades' ? [0.16, 0.3, 0.17] : [0.2, 0.38, 0.22];
      for (let x = -2600; x < 3200; x += 16 + r() * 14) { const z = -950 - r() * 60, s = 22 + r() * 22; g.add(new THREE.IcosahedronGeometry(1, 0), g.at(x, 12 + s * 0.7, z, r() * 6, s * 1.4, s, s), mix3(dark, [0.34, 0.52, 0.28], r())); }
      add(above, g.build());
      const rt = new Geo(); for (let x = -900; x < 1600; x += 9 + r() * 10) for (let k = 0; k < 2; k++) rt.rod([x, 6, -930 - r() * 40], [x + (r() - 0.5) * 30, -40, -900 - r() * 40], 1.6, 1.2, [0.3, 0.24, 0.18], 4);
      add(below, rt.build());
    }
    if (st.shore === 'bridge') {
      // Channel Five: the bridge across the way on its pilings, the Keys beyond
      const g = new Geo(), conc = [0.78, 0.76, 0.72], dark = [0.55, 0.54, 0.51];
      g.box(500, 62, -620, 5200, 12, 34, conc); g.box(500, 70, -604, 5200, 4, 2, [0.88, 0.87, 0.84]); g.box(500, 70, -636, 5200, 4, 2, [0.88, 0.87, 0.84]);
      for (let x = -2000; x < 3000; x += 130) g.box(x, 28, -620, 14, 56, 30, dark);
      for (let x = -3000; x < 4000; x += 18 + r() * 14) g.add(new THREE.IcosahedronGeometry(1, 0), g.at(x, 10, -2400 - r() * 80, 0, 20 + r() * 16, 18 + r() * 14, 20), [0.24, 0.42, 0.26]);
      add(above, g.build());
      const p = new Geo(); for (let x = -2000; x < 3000; x += 130) p.box(x, -200, -620, 14, 400, 30, [0.36, 0.38, 0.36]);
      add(below, p.build());
      this.bridgeCars = [0, 1, 2].map((i) => { const m = this.layer(new THREE.Mesh(new THREE.BoxGeometry(14, 6, 7), new THREE.MeshLambertMaterial({ color: [0xe84a3a, 0xf4f4f4, 0x2a5bd8][i] })), 1); m.userData = { sp: (i % 2 ? -1 : 1) * (90 + i * 25), z: -620 + (i % 2 ? 7 : -7), o: i * 900 }; above.add(m); return m; });
    }
    if (key === 'offshore') {
      // sargassum on the surface, seen from below
      const g = new Geo(); for (let i = 0; i < 26; i++) { const x = -300 + r() * 1600, z = -100 - r() * 900; for (let k = 0; k < 6; k++) g.ball(x + (r() - 0.5) * 50, -1.5, z + (r() - 0.5) * 30, 6 + r() * 6, [0.6, 0.45, 0.15], 1.4, 0.25, 1, 6, 3); }
      add(below, g.build());
    }
    this.layer(below, 2); this.layer(above, 1); if (key === 'bridge') for (const c of this.bridgeCars) c.layers.set(1);
    this.scene.add(below, above);
    return (this.stages[key] = { below, above });
  },
  // a fish: the species' own 2D painting as its skin, on a body with real thickness; fins and tail stay thin
  fishModel(key) {
    const lk = LOOKS[key] || LOOKS.yellowtail, L = lk.head === 'bill' ? 300 : 380, CW = 512, CH = Math.round(clamp(L * (lk.h * 2.2 + 0.18), 140, 512) / 8) * 8, cx = 232, cy = CH / 2;
    const tex = canvasTex(CW, CH, (g) => { g.translate(cx, cy); drawFish(g, key, L, { wig: 0 }); });
    tex.anisotropy = 4;
    const uvOf = (x, y) => [(cx + x * L) / CW, 1 - (cy - y * L) / CH];
    const card = new THREE.PlaneGeometry(CW / L, CH / L); card.translate((CW / 2 - cx) / L, (cy - CH / 2) / L, 0);
    const H = lk.h, hz = clamp(0.36 * H, 0.05, 0.12), body = new THREE.SphereGeometry(1, 20, 12), P = body.attributes.position, uv = body.attributes.uv;
    for (let i = 0; i < P.count; i++) { const x = 0.1 + P.getX(i) * 0.4, y = P.getY(i) * H * 0.47, z = P.getZ(i) * hz; P.setXYZ(i, x, y, z); const u = uvOf(x, y); uv.setXY(i, u[0], u[1]); }
    body.computeVertexNormals();
    const swimU = { uSwim: { value: 0 }, uAmp: { value: 0.04 } };
    const swim = (m) => { m.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, swimU); sh.vertexShader = 'uniform float uSwim, uAmp;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + SWIM_CHUNK); }; m.customProgramCacheKey = () => 'swim'; return m; };
    const cardMat = swim(new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.45, side: THREE.DoubleSide })), bodyMat = swim(new THREE.MeshLambertMaterial({ map: tex }));
    const g = new THREE.Group(); g.add(new THREE.Mesh(card, cardMat), new THREE.Mesh(body, bodyMat)); g.rotation.order = 'YZX';
    g.userData = { swimU, mats: [cardMat, bodyMat], tex, geos: [card, body] };
    return g;
  },
  person(ch) {
    if (!this.people[ch]) {
      const P = Models.personGeo(ch), grp = new THREE.Group();
      grp.add(new THREE.Mesh(P.body, this.mat));
      grp.userData.arms = [-1, 1].map((sd) => { const a = new THREE.Mesh(P.arm, this.mat); a.position.set(0, 17.2, sd * 4.6); grp.add(a); return a; });
      this.scene.add(grp); this.people[ch] = grp;
    }
    return this.people[ch];
  },

  /* ---------- a new fight ---------- */
  setup(f, W, H) {
    this.fight = f; this.W = W; this.H = H;
    const wy = f.waterY(), key = f.kind === 'reef' ? (f.variant === 'wreck' ? 'wreck' : 'reef') : f.kind === 'flats' ? (f.variant === 'bridge' ? 'bridge' : f.variant === 'glades' ? 'glades' : 'flats') : 'offshore';
    this.key = key; const st = FIGHT_STAGES[key];
    for (const k in this.stages) { this.stages[k].below.visible = this.stages[k].above.visible = k === key; }
    const sg = this.stage(key); sg.below.visible = sg.above.visible = true;
    this.UW.uNear.value.setRGB(...st.near); this.UW.uDeep.value.setRGB(...st.deep);
    this.waterFog.color.setRGB(...mix3(st.near, st.deep, st.floor ? 0.18 : 0.35)); this.waterFog.near = st.clear; this.waterFog.far = st.vis;
    this.UW.uHaze.value.copy(this.waterFog.color); this.UW.uFloor.value = st.floor ? 1 : 0; this.causU.uCaus.value = st.caus;
    // the light down there: the deeper the spot, the more the water has taken the reds out of it
    const wl = st.near.map((c) => c / Math.max(...st.near)), tn = st.tint;
    this.wet = { sun: new THREE.Color(...mix3([1, 0.97, 0.9], wl, tn)), sunI: 3 * (1 - 0.3 * tn), sky: new THREE.Color(...mix3([0.85, 0.93, 0.97], wl, tn)), gnd: new THREE.Color(...mix3([0.18, 0.44, 0.53], st.deep.map((c) => c * 2), tn)), hemiI: 2.1 * (1 - 0.15 * tn) };
    // the layout camera: at the waterline, a three-quarter view from behind the angler, horizon on the fight's waterline
    const L = this.lay, V = this.view || { phi: 0.62, D: 330, Xp: 150, size: 1.3 }, phi = V.phi, D = V.D, Xp = V.Xp;
    L.fov = 40; L.aspect = W / H; L.position.set(Xp - D * Math.sin(phi), 0, D * Math.cos(phi)); L.lookAt(Xp, 0, 0); L.setViewOffset(W, H, 0, H / 2 - wy, W, H); L.updateMatrixWorld();
    this.camBase = { pos: L.position.clone(), look: new THREE.Vector3(Xp, 0, 0) };
    // the boat sits where the 2D fight puts the angler; the bottom where it draws the bottom
    const a = this.unproject(f.anglerX() + 10, wy - 40, 0); this.anglerAt = new THREE.Vector3(a.x, 0, 0);
    const flats = f.kind === 'flats';
    const bs = V.size * (flats ? 0.92 : 1); this.boat.position.set(a.x - (flats ? 30 : 38) * bs, 0, 0); this.boat.rotation.set(0, Math.PI, 0); this.boat.scale.setScalar(bs); this.size = V.size;
    if (sg.below.userData.floor) { const fl = this.unproject(W * 0.62, H - 22, 0); sg.below.position.set(0, Math.min(-25, fl.y), 0); }
    // the crew: the angler at the stern facing the fish, the others watching
    for (const k in this.people) this.people[k].visible = false;
    const crew = (Trip.cur && Trip.cur.crew ? Trip.cur.crew : CHAR_ORDER).filter((c) => c !== f.ch);
    this.angler = this.person(f.ch); this.angler.visible = true; this.angler.position.set(a.x, (flats ? 9 : 6) * V.size, 4); this.angler.rotation.set(0, 0, 0); this.angler.scale.setScalar(V.size);
    this.watch = crew.slice(0, 2).map((c, i) => { const p = this.person(c); p.visible = true; p.position.set(a.x - (i ? 70 : 40) * V.size, 6 * V.size, (i ? -4 : -11) * V.size); p.rotation.set(0, i ? -0.5 : -0.25, 0); p.scale.setScalar(V.size); return p; });
    // the fish
    if (this.fish) { this.scene.remove(this.fish); const u = this.fish.userData; u.tex.dispose(); for (const m of u.mats) m.dispose(); for (const g2 of u.geos) g2.dispose(); }
    this.fish = this.layer(this.fishModel(f.key), 0); this.scene.add(this.fish);
    const lenPx = (70 + 90 * f.wn) * (f.key === 'goliath' || f.key === 'bluemarlin' ? 1.6 : 1); this.fishLen = lenPx * 0.62;
    this.fishYaw = Math.PI; this.fishPos = null; this.drops = []; this.lastT = null; this.lineGone = null; this.overSeen = false;
    this.shark.visible = false; this.push = 0;
    GL.settle();
  },
  // the world point on the plane z (default 0) under a screen point of the layout camera
  unproject(sx, sy, z = 0) {
    const v = new THREE.Vector3((sx / this.W) * 2 - 1, 1 - (sy / this.H) * 2, 0.5).unproject(this.lay), o = this.lay.position, d = v.sub(o);
    const t = (z - o.z) / (Math.abs(d.z) < 1e-6 ? 1e-6 : d.z); return new THREE.Vector3(o.x + d.x * t, o.y + d.y * t, z);
  },

  /* ---------- every frame ---------- */
  draw(f, ctx, W, H) {
    const now = performance.now(), busy = !!(Game.scene && Game.scene.paused);
    if (this.fight !== f || this.W !== W || this.H !== H) this.setup(f, W, H);
    if (GL.pace(now, busy)) { this.update(f, W, H); this.render(f, W, H); GL.drew(now, busy); }
    // the waterline, where the two halves meet
    const wy = f.waterY();
    const g = ctx.createLinearGradient(0, wy, 0, wy + 16); g.addColorStop(0, 'rgba(255,255,255,0.28)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, wy, W, 16);
    drawWaterline(ctx, W, wy, f.t, 'rgba(255,255,255,0.7)', 2.5);
  },
  render(f, W, H) {
    const r = GL.r, S = this.scene, cam = this.cam, wy = f.waterY(), sz = new THREE.Vector2(); r.getSize(sz);
    const split = Math.round(sz.y * (1 - wy / H));
    r.setScissorTest(true);
    // above the water: air, the sky, the boat and the angler
    S.fog = this.airFog; cam.layers.set(0); cam.layers.enable(1); r.setClearColor(0xcfe6f2, 1);
    this.sun.color.setHex(0xfff6e6); this.sun.intensity = 3; this.hemi.color.setHex(0xd8ecf8); this.hemi.groundColor.setHex(0x2f6f86); this.hemi.intensity = 2.1;
    r.setScissor(0, split, sz.x, sz.y - split); r.render(S, cam);
    // below: the water's own light and haze
    S.fog = this.waterFog; cam.layers.set(0); cam.layers.enable(2); r.setClearColor(this.waterFog.color, 1);
    const w = this.wet; this.sun.color.copy(w.sun); this.sun.intensity = w.sunI; this.hemi.color.copy(w.sky); this.hemi.groundColor.copy(w.gnd); this.hemi.intensity = w.hemiI;
    r.setScissor(0, 0, sz.x, split); r.render(S, cam);
    r.setScissorTest(false);
  },
  update(f, W, H) {
    const t = f.t, dt = this.lastT == null ? 1 / 60 : clamp(t - this.lastT, 0, 0.1); this.lastT = t;
    const wy = f.waterY(), over = f.phase === 'over', won = over && f.won, lost = over && !f.won;
    // where the fish is: on the spot the 2D layout put it, a little behind the line of the boat
    const target = this.unproject(f.fx, f.fy, -10);
    if (!this.fishPos) this.fishPos = target.clone();
    if (lost) {   // it got away: it bolts off and down (the shark takes it, if that's how it went)
      if (!this.overSeen) { this.overSeen = true; this.escape = new THREE.Vector3(1, -0.55, -0.4).normalize(); this.burst(this.fishPos.x, Math.min(0, this.fishPos.y), 26, f.reason === 'tax' ? 1.4 : 0.8); if (f.reason === 'snap') this.lineGone = 0; }
      if (f.reason === 'tax') this.fish.visible = f.overT < 0.35; else this.fishPos.addScaledVector(this.escape, dt * 260);
    } else { this.fish.visible = true; this.fishPos.lerp(target, 1 - Math.exp(-dt * 14)); }
    const fp = this.fishPos, jumping = f.jumpT > 0;
    // which way it faces: at the boat while you reel, off and away when it runs or jumps, along its path when it leaps
    const away = jumping || f.running || lost, want = away ? 0.25 : Math.PI + Math.sin(t * 1.3) * 0.25;
    this.fishYaw += angleDiff(this.fishYaw, want) * (1 - Math.exp(-dt * 5));
    let pitch = f.running ? -0.12 : 0.06 + Math.sin(t * 2.1) * 0.05;
    if (jumping) { const ph = 1 - f.jumpT / 1.15; pitch = Math.cos(ph * Math.PI) * 0.95; }
    if (f.phase === 'landing') pitch = 0.4;
    this.fish.position.copy(fp); this.fish.rotation.set(jumping ? Math.sin(t * 22) * 0.35 : Math.sin(t * 3) * 0.08, this.fishYaw, pitch);
    this.fish.scale.setScalar(this.fishLen);
    const su = this.fish.userData.swimU; su.uSwim.value = t * (f.running || jumping ? 18 : 9); su.uAmp.value = f.running || jumping ? 0.07 : 0.035;
    // a hidden fish is just a dark shape until it shows itself
    const shade = f.revealed || fp.y > 0 ? 1 : 0.28; for (const m of this.fish.userData.mats) m.color.setScalar(lerp(m.color.r, shade, 1 - Math.exp(-dt * (fp.y > 0 ? 12 : 3))));
    // splashes: through the surface on a jump, when it lands, bubbles when it runs
    const was = this.prevY, crossed = was != null && Math.sign(was) !== Math.sign(fp.y) && Math.abs(fp.y - was) < 80;
    if (crossed) this.burst(fp.x, 0, f.phase === 'landing' ? 24 : 30, 1);
    this.prevY = fp.y;
    if (f.running && !jumping && chance(dt * 30)) this.drops.push({ x: fp.x + rand(-10, 10), y: fp.y + rand(-4, 4), z: fp.z + rand(-6, 6), vx: rand(-10, 10), vy: rand(20, 45), vz: 0, s: rand(1, 2.2), a: 0.6, t: 0, life: rand(0.8, 1.6), bub: true });
    this.stepDrops(dt);
    // the boat bobs; the angler leans back with the pull; the crew cheer a jump and the landing
    const bob = Math.sin(t * 1.7) * 0.9, roll = Math.sin(t * 1.3) * 0.03;
    this.boat.position.y = bob - 1; this.boat.rotation.x = roll;
    const A = this.angler, lean = 0.08 + clamp(f.T, 0, 1.2) * 0.28;
    A.position.y = (f.kind === 'flats' ? 9 : 6) * this.size + bob; A.rotation.set(roll, 0, won ? 0 : lean * 0.8);
    const [la, ra] = A.userData.arms, crank = f.holding() && !over, cheerAll = won || f.phase === 'landing' || (jumping && f.jumpHold <= 0.3);
    la.rotation.set(0, 0, 1.75 - lean * 0.6); ra.rotation.set(crank ? Math.sin(t * 16) * 0.35 : 0.1, 0, 1.45 + (crank ? Math.cos(t * 16) * 0.2 : 0));
    if (won) { la.rotation.set(-2.4, 0, 0.3); ra.rotation.set(2.4, 0, 0.3); }
    this.watch.forEach((p, i) => { p.position.y = 6 * this.size + bob; const [l, r2] = p.userData.arms, up = cheerAll && Math.sin(t * 9 + i) > -0.3; l.rotation.set(up ? -2.5 : -0.12, 0, 0.1); r2.rotation.set(up ? 2.5 : 0.12, 0, 0.1); });
    // the rod bends toward the line with the tension; the reel sits under the hands
    const hand = new THREE.Vector3(this.anglerAt.x + 8 * this.size, A.position.y + 15 * this.size, 4);
    const bend = lost ? 0 : clamp(f.T, 0, 1.2), mouth = new THREE.Vector3(0.5, 0, 0).applyMatrix4(new THREE.Matrix4().compose(this.fish.position, new THREE.Quaternion().setFromEuler(this.fish.rotation), this.fish.scale));
    if (this.lineGone != null) this.lineGone += dt;
    const tip = this.updateRod(hand, bend, mouth, t);
    this.reel.position.copy(hand).add(new THREE.Vector3(-3, -3, 0)); this.reel.scale.setScalar(this.size); this.reel.rotation.set(0, 0, crank ? t * 18 : 0);
    this.updateLine(tip, won && f.phase === 'over' ? null : mouth, f, lost);
    // the shark comes in circling the fish, and takes it
    const sh = this.shark;
    if (f.shark && (!over || (lost && f.reason === 'tax' && f.overT < 1.6))) {
      sh.visible = true; const a = f.shark.a;
      let sp = new THREE.Vector3(fp.x + Math.cos(a * 1.8) * 70, Math.min(-12, fp.y - 14 + Math.sin(a * 2.3) * 10), fp.z + Math.sin(a * 1.8) * 60);
      if (lost) { const k = clamp(f.overT / 0.35, 0, 1); sp = sp.lerp(fp.clone().add(new THREE.Vector3(10, -6, 0)), k); }
      const dir = sp.clone().sub(sh.position); sh.position.copy(sp); if (dir.lengthSq() > 0.01) sh.rotation.set(0, -Math.atan2(dir.z, dir.x), clamp(dir.y * 0.05, -0.4, 0.4));
      sh.scale.setScalar(1.15);
    } else sh.visible = false;
    // the camera: a slow drift, a push in toward a jump, a shake with the game's
    const B = this.camBase, cam = this.cam, L = this.lay;
    this.push = approach(this.push, jumping ? 1 : 0, jumping ? 3 : 1.5, dt);
    // (it pushes in on a point between the angler and the fish, so both stay in the picture)
    const mid = new THREE.Vector3((this.anglerAt.x + fp.x) / 2, 0, fp.z / 2);
    const drift = Math.sin(t * 0.21) * 0.035, look = B.look.clone().lerp(mid, 0.25 * this.push);
    const pos = B.pos.clone().sub(B.look).applyAxisAngle(UP, drift).multiplyScalar(1 - 0.08 * this.push).add(look);
    const shk = Game.shakeT > 0 && !Game.reduced ? Game.shakeAmt * 0.6 * Math.min(1, Game.shakeT * 4) : 0;
    cam.fov = L.fov; cam.aspect = L.aspect; cam.position.set(pos.x + rand(-shk, shk), 0, pos.z + rand(-shk, shk)); cam.lookAt(look.x, 0, look.z);
    cam.setViewOffset(W, H, 0, H / 2 - wy, W, H);
    this.sky.position.copy(cam.position); this.clouds.position.copy(cam.position); this.under.position.copy(cam.position);
    for (const m of this.shafts) { const u = m.userData, h = 520; m.position.set(u.x + Math.sin(t * 0.3 + u.ph) * 20, -h / 2 + 2, u.z); m.scale.set(u.w, h, 1); m.rotation.set(0, Math.atan2(cam.position.x - m.position.x, cam.position.z - m.position.z), 0.18); m.material.opacity = 0.1 + 0.08 * Math.sin(t * 0.7 + u.ph); }
    this.causU.uTime.value = t;
    if (this.bridgeCars) for (const c of this.bridgeCars) { const u = c.userData; c.position.set(((u.o + t * u.sp) % 3000 + 3000) % 3000 - 1000, 72, u.z); }
    this.pxU.uPx.value = (GL.r.domElement.height / 2) / Math.tan((cam.fov * Math.PI) / 360);
  },
  // the rod: from the hands, up and out toward the fish, bowing toward the line as the pull grows
  updateRod(hand, bend, mouth, t) {
    const { RS, RR } = this.rodN, P = this.rod.geometry.attributes.position.array, len = 62 * this.size;
    const toFish = mouth.clone().sub(hand); toFish.y = 0; toFish.normalize();
    const up0 = new THREE.Vector3(toFish.x * 0.5, 0.86, toFish.z * 0.5).normalize();
    const pull = mouth.clone().sub(hand).normalize(), k = clamp(bend * 0.55, 0, 0.75);
    const tip = hand.clone().addScaledVector(up0.clone().lerp(pull, k).normalize(), len * (1 - k * 0.12));
    const mid = hand.clone().addScaledVector(up0, len * 0.55);
    let prev = hand.clone(); const side = new THREE.Vector3();
    for (let i = 0; i <= RS; i++) {
      const u = i / RS, p = new THREE.Vector3().copy(hand).multiplyScalar((1 - u) * (1 - u)).addScaledVector(mid, 2 * u * (1 - u)).addScaledVector(tip, u * u);
      const tan = i ? p.clone().sub(prev).normalize() : up0.clone(); prev = p;
      side.crossVectors(tan, UP).normalize(); if (side.lengthSq() < 0.1) side.set(0, 0, 1);
      const nrm = new THREE.Vector3().crossVectors(side, tan).normalize(), rad = lerp(1.1, 0.25, u);
      for (let j = 0; j < RR; j++) { const a = (j / RR) * TAU, o = (i * RR + j) * 3; P[o] = p.x + (side.x * Math.cos(a) + nrm.x * Math.sin(a)) * rad; P[o + 1] = p.y + (side.y * Math.cos(a) + nrm.y * Math.sin(a)) * rad; P[o + 2] = p.z + (side.z * Math.cos(a) + nrm.z * Math.sin(a)) * rad; }
    }
    this.rod.geometry.attributes.position.needsUpdate = true; this.rod.geometry.computeVertexNormals();
    return tip;
  },
  // the line: tip to the fish's mouth, sagging when it's slack; on a snap it whips back and falls away
  updateLine(tip, mouth, f, lost) {
    const N = this.lineN, P = this.line.geometry.attributes.position.array, cam = this.cam.position, perPx = (2 * Math.tan((this.cam.fov * Math.PI) / 360)) / this.H;
    let end = mouth, sag = (1 - clamp(this.fight.T, 0, 1)) * 60;
    if (lost || !mouth) {
      if (f.reason === 'snap' && this.lineGone != null) { const k = clamp(this.lineGone / 0.6, 0, 1); end = tip.clone().add(new THREE.Vector3(-40 * k, -30 - 40 * k, 10)); sag = 20; }
      else { end = tip.clone().add(new THREE.Vector3(30, -70, -10)); sag = 30; }
      if (!mouth && f.won) end = tip.clone().add(new THREE.Vector3(6, -20, 0));
    }
    const ctrl = tip.clone().lerp(end, 0.5); ctrl.y -= sag;
    const pts = []; for (let i = 0; i <= N; i++) { const u = i / N; pts.push(new THREE.Vector3().copy(tip).multiplyScalar((1 - u) * (1 - u)).addScaledVector(ctrl, 2 * u * (1 - u)).addScaledVector(end, u * u)); }
    const off = new THREE.Vector3();
    for (let i = 0; i <= N; i++) {
      const p = pts[i], tan = pts[Math.min(N, i + 1)].clone().sub(pts[Math.max(0, i - 1)]).normalize(), view = cam.clone().sub(p).normalize();
      off.crossVectors(tan, view).normalize().multiplyScalar(Math.max(0.12, p.distanceTo(cam) * perPx * 1.5) / 2);   // about a pixel and a half wide
      const o = i * 6; P[o] = p.x - off.x; P[o + 1] = p.y - off.y; P[o + 2] = p.z - off.z; P[o + 3] = p.x + off.x; P[o + 4] = p.y + off.y; P[o + 5] = p.z + off.z;
    }
    this.line.geometry.attributes.position.needsUpdate = true; this.line.geometry.computeBoundingSphere();
  },
  burst(x, y, n, k = 1) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), sp = rand(15, 55) * k;
      this.drops.push({ x: x + rand(-8, 8), y: y + 1, z: rand(-14, 6), vx: Math.cos(a) * sp, vy: rand(50, 120) * k, vz: Math.sin(a) * sp * 0.6, s: rand(2.5, 5.5) * k, a: 0.9, t: 0, life: rand(0.6, 1.1) });
      if (i % 2) this.drops.push({ x: x + rand(-12, 12), y: -rand(2, 12), z: rand(-12, 6), vx: rand(-15, 15), vy: rand(15, 40), vz: 0, s: rand(1.2, 2.6), a: 0.7, t: 0, life: rand(0.8, 1.6), bub: true });
    }
  },
  stepDrops(dt) {
    const g = this.splash.geometry, P = g.attributes.position.array, S = g.attributes.aS.array, A = g.attributes.aA.array; let n = 0;
    this.drops = this.drops.filter((d) => (d.t += dt) < d.life && (d.bub ? d.y < 0.5 : d.y > -4));
    for (const d of this.drops) {
      if (d.bub) { d.vy += 30 * dt; d.x += d.vx * dt; d.y += d.vy * dt; } else { d.vy -= 260 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt; }
      if (n >= this.dropMax) continue;
      P[n * 3] = d.x; P[n * 3 + 1] = d.y; P[n * 3 + 2] = d.z; S[n] = d.s; A[n] = d.a * (1 - d.t / d.life); n++;
    }
    g.setDrawRange(0, n); g.attributes.position.needsUpdate = g.attributes.aS.needsUpdate = g.attributes.aA.needsUpdate = true;
  }
};
