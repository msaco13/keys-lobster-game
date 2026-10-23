'use strict';
/* Keys Crew trailer: every shot, staged inside the game page. tools/trailer/render.mjs loads the game, injects this
   file and steps the game one frame at a time, grabbing a picture of each. Everything here runs in the browser with
   the game's own globals: its scenes play the footage, its art and fonts draw the captions and cards, and every
   sound the game asks for is logged (TRAILER.sfx) so the assembler can lay the real effects under the picture.
   A shot: { secs, warm (frames stepped before the first picture), setup(), tick(frame, t), overlay(ctx, t, frame) }.
   tick runs before the game's frame (frame < 0 during the warm-up), overlay draws on a canvas over the game. */
window.TRAILER = (() => {
  const T = { fps: 30, frame: -1, t: 0, sfx: [], cur: null, shots: {}, state: {}, orig: {} };
  const W = 960, H = 540;
  const CREW = ['michael', 'jorge', 'jemel'];
  const LIGHT = { id: 'light', name: 'Light chop', wind: '5–10 kts', vis: 1, drift: 0.3, aim: 1 };
  const GLASS = { id: 'glass', name: 'Glass calm', wind: '0–5 kts', vis: 1.25, drift: 0, aim: 0.75, tag: '#Glass' };

  /* ---------- plumbing ---------- */
  const seed = (n) => { let s = (n * 7919 + 1) % 2147483647; Math.random = () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; };
  const note = (name, k) => T.sfx.push({ name, f: T.frame, k: k == null ? 1 : k });   // a sound the trailer adds on top of the game's own
  const env = (t, t0, t1, fi = 0.5, fo = 0.4) => (t < t0 || t > t1 ? 0 : Math.min(1, (t - t0) / fi, (t1 - t) / fo));
  const trip = (o = {}) => {
    World.build();
    Trip.start({ mode: 'crew', crew: CREW, plan: 'full', sessionLen: 120 });
    Trip.cur.weather = o.weather || LIGHT; Trip.cur.bounties = o.bounties || [];
    Object.assign(Trip.cur, o.trip || {});
    return Trip.cur;
  };
  const go = (scene) => { Game.go(scene, true); Game.fade = 0; Game.fadeDir = 0; Game.toasts = []; return scene; };
  const blank = () => go({ update() {}, draw(ctx) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); } });
  // the crew's heckles, picked by hand: say(kind) looks up who says what
  const quips = (S, map) => { S.say = (kind) => { const q = map[kind]; if (q) S.quip = { who: q[0], msg: q[1], t: 2.8 }; }; };
  const keys = (...codes) => { Input.keys.clear(); for (const c of codes) Input.keys.add(c); };
  // a fish fight played by a bot. 'good' reels like a good player; 'greedy' never lets go (and snaps the line)
  const bot = (f, dt) => {
    const b = f.__bot || (f.__bot = { hold: true, tap: 0, run: -1, tele: -1, t: 0, mode: 'good' }); b.t += dt;
    if (f.phase === 'turn') { b.hold = true; b.tap += dt; if (b.tap > 1 / 7) { b.tap = 0; f.tap(); } return; }
    if (b.mode === 'greedy') { b.hold = true; return; }
    if (f.tele && b.tele < 0) b.tele = b.t; if (!f.tele && !f.running) b.tele = -1;
    if (f.running && b.run < 0) b.run = b.t; if (!f.running) b.run = -1;
    b.hold = !((b.tele >= 0 && b.t - b.tele > 0.2) || (b.run >= 0 && b.t - b.run > 0.12) || f.jumpT > 0 || f.jumpDelay > 0 || f.T > 0.8 * f.perks.line);
  };
  const hookBot = (f, mode = 'good') => { f.__bot = { hold: true, tap: 0, run: -1, tele: -1, t: 0, mode }; f.holding = () => f.__bot.hold; return f; };
  const runBot = (S) => { const f = S && S.child; if (f && f.__bot) bot(f, 1 / T.fps); return f; };

  // the boat ride. o: x, y, h, v, notch, home, noHud, trip
  const sea = (o = {}) => {
    trip(o); const S = go(new SeaScene(o.home ? { home: true } : {}));
    if (o.x != null) { S.x = o.x; S.y = o.y; S.h = o.h; }
    S.v = o.v || 0; S.notch = o.notch == null ? 1 : o.notch; S.view = 'chase'; S.auto = false; S.dest = o.dest || null;
    Game.toasts = []; S.quip = null; S.t = 14;   // past the first-captain steering tip
    if (o.noHud) { S.drawHud = () => {}; S.drawSteer = () => {}; Sea3D.overlay = () => {}; }
    Chase.reset(S);
    return S;
  };
  // a dive. o: ch, spot, seed
  const dive = (o = {}) => {
    trip(o); seed(o.seed || 1);
    const S = go(new BugHuntScene({ ch: o.ch || 'michael', spot: o.spot || 'bughunt', len: 120, weather: Trip.cur.weather, onEnd() {}, shark: false }));
    S.help = null; S.coach = false; S.intro = null; S.diver.vx = 0; S.diver.vy = 0; S.wasUnder = true; S.breath = S.maxBreath; Game.toasts = [];
    return S;
  };
  // open water somewhere near (x0, y0) with depth between lo and hi, and the same for 500 units ahead on heading h
  const findWater = (x0, y0, lo, hi, h) => {
    for (let r = 0; r < 3000; r += 50) for (let a = 0; a < TAU; a += 0.4) {
      const x = x0 + Math.cos(a) * r, y = y0 + Math.sin(a) * r, d = World.depth(x, y);
      if (d < lo || d > hi) continue;
      let ok = true;
      for (let k = 100; k <= 600; k += 100) { const dd = World.depth(x + Math.cos(h) * k, y + Math.sin(h) * k); if (dd < lo || dd > hi + 3) { ok = false; break; } }
      if (ok) return [x, y];
    }
    return [x0, y0];
  };

  /* ---------- overlay drawing ---------- */
  const black = (c, a) => { if (a <= 0) return; c.fillStyle = `rgba(0,0,0,${clamp(a, 0, 1).toFixed(3)})`; c.fillRect(-10, -10, W + 20, H + 20); };
  const letterbox = (c) => { const bh = Math.round((H - W / 2.39) / 2); c.fillStyle = '#000'; c.fillRect(-10, -10, W + 20, bh + 10); c.fillRect(-10, H - bh, W + 20, bh + 10); };
  const vignette = (c, k = 0.5) => { const g = c.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${k})`); c.fillStyle = g; c.fillRect(0, 0, W, H); };
  const docFont = (size, weight = 300) => `${weight} ${size}px Inter, "Inter Light", "Helvetica Neue", Arial, sans-serif`;
  // the narrator's captions: thin, tracked, white, wrapped to two lines
  const doc = (c, s, a, o = {}) => {
    if (a <= 0) return;
    const size = o.size || 25, y = o.y || H - 112, ls = o.ls == null ? 2.5 : o.ls;
    c.save(); c.globalAlpha = a; c.font = docFont(size, o.weight || 300); c.letterSpacing = ls + 'px'; c.textAlign = 'center'; c.textBaseline = 'middle';
    const lines = [];
    for (const para of String(s).split('\n')) { let line = ''; for (const w of para.split(' ')) { const t2 = line ? line + ' ' + w : w; if (c.measureText(t2).width > (o.maxW || 760) && line) { lines.push(line); line = w; } else line = t2; } lines.push(line); }
    const lh = size * 1.45, y0 = y - ((lines.length - 1) * lh) / 2;
    lines.forEach((l, i) => { c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillText(l, W / 2 + 1, y0 + i * lh + 2); c.fillStyle = o.color || '#fff'; c.fillText(l, W / 2, y0 + i * lh); });
    c.restore();
  };
  // the montage captions: the game's own display face, popping in the way its banners do
  const cap = (c, s, sub, t, t0 = 0.2, o = {}) => {
    if (t < t0) return; const k = easeBack(clamp((t - t0) / 0.26, 0, 1)), size = o.size || 52, y = o.y == null ? 436 : o.y;
    c.save(); c.translate(o.x == null ? W / 2 : o.x, y); c.rotate(o.rot == null ? -0.025 : o.rot); c.scale(k, k);
    text(c, s, 0, 0, { display: true, size, align: 'center', base: 'middle', color: o.color || PAL.sun, stroke: PAL.ink, sw: 11, shadow: 'rgba(0,0,0,0.4)', sy: 6, sx: 2, maxW: o.maxW || W - 70 });
    if (sub) text(c, sub, 0, size * 0.66, { size: 19, align: 'center', base: 'middle', color: '#fff', weight: 800, stroke: PAL.ink, sw: 6 });
    c.restore();
  };
  // the game's logo, as the title screen draws it
  const logo = (c, x, y, size, k = 1, rot = -0.045) => {
    c.save(); c.translate(x, y); c.rotate(rot); c.scale(k, k);
    text(c, 'Keys Crew', 0, 0, { display: true, size, align: 'center', base: 'middle', color: PAL.coral, stroke: PAL.ink, sw: Math.max(8, size * 0.13), shadow: 'rgba(0,0,0,0.35)', sy: size * 0.07, sx: size * 0.02 });
    c.restore();
  };
  // Michael's cap and shades, on anything
  const capAndShades = (c, x, y, r) => {
    const C = CHARS.michael; c.save(); c.translate(x, y);
    c.fillStyle = C.capColor; c.beginPath(); c.moveTo(-r * 0.86, -r * 0.3); c.bezierCurveTo(-r * 0.92, -r * 1.24, r * 0.92, -r * 1.24, r * 0.86, -r * 0.3); c.closePath(); c.fill();
    c.fillStyle = C.capPatch; ell(c, 0, -r * 0.64, r * 0.2, r * 0.2); c.fill(); c.strokeStyle = '#e2b04a'; c.lineWidth = r * 0.04; c.stroke();
    c.fillStyle = '#e2b04a'; c.fillRect(-r * 0.03, -r * 0.76, r * 0.06, r * 0.24); c.fillRect(-r * 0.12, -r * 0.67, r * 0.24, r * 0.06);
    c.fillStyle = C.capBrim; c.beginPath(); c.moveTo(-r * 0.96, -r * 0.3); c.quadraticCurveTo(0, r * 0.02, r * 0.96, -r * 0.3); c.lineTo(r * 0.86, -r * 0.37); c.quadraticCurveTo(0, -r * 0.2, -r * 0.86, -r * 0.37); c.closePath(); c.fill();
    drawShades(c, C.shades, r);
    c.restore();
  };
  // the underwater backdrop for the lobster's close-ups: deep teal, shafts of light, a few bubbles
  const deepWater = (c, t) => {
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0b4e72'); g.addColorStop(0.55, '#063449'); g.addColorStop(1, '#031b28'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 7; i++) { const x = 120 + i * 130 + Math.sin(t * 0.3 + i) * 30, w = 60 + i * 9; const sg = c.createLinearGradient(x, 0, x + 170, H); sg.addColorStop(0, 'rgba(140,220,255,0.14)'); sg.addColorStop(1, 'rgba(140,220,255,0)'); c.fillStyle = sg; c.beginPath(); c.moveTo(x, -20); c.lineTo(x + w, -20); c.lineTo(x + w + 170, H + 20); c.lineTo(x + 170, H + 20); c.closePath(); c.fill(); }
    c.restore();
    c.strokeStyle = 'rgba(230,250,255,0.5)'; c.lineWidth = 1.2;
    for (let i = 0; i < 14; i++) { const ph = (t * (0.06 + (i % 5) * 0.015) + i * 0.173) % 1, x = (i * 173) % W + Math.sin(t * 1.3 + i) * 6, y = H - ph * (H + 40), r = 2 + (i % 4); c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke(); }
  };
  const lobsterStar = (c, t, o = {}) => {
    deepWater(c, t);
    const sand = c.createLinearGradient(0, H - 120, 0, H); sand.addColorStop(0, 'rgba(230,205,150,0)'); sand.addColorStop(1, 'rgba(230,205,150,0.35)'); c.fillStyle = sand; c.fillRect(0, H - 120, W, 120);
    const k = o.push == null ? 1 : o.push;
    c.save(); c.translate(W * 0.5, H * 0.5 + Math.sin(t * 1.1) * 4); c.scale(k, k);
    c.fillStyle = 'rgba(0,0,0,0.3)'; ell(c, 20, 150, 240, 26); c.fill();
    drawLobsterSide(c, 330, { t, flip: true, twitch: o.twitch || 0, tense: o.tense });
    if (o.hat) capAndShades(c, -150, -58, 44);
    c.restore();
    vignette(c, 0.55);
  };

  /* ================= ACT ONE: a nature documentary ================= */
  // first light over the reef line, nobody around
  T.shots.keys = {
    secs: 3.6, warm: 50, hideToasts: true,
    setup() {
      World.build(); const L = World.light, S = sea({ x: L.x - 760, y: L.y + 560, h: 0, v: 30, notch: 1, noHud: true, trip: { legs: 3 } });
      S.h = Math.atan2(L.y - S.y, L.x - S.x) - 0.12; S.homeRun = true; S.dest = null; S.boats = []; Chase.reset(S);
    },
    tick() { const S = Game.scene; S.notch = 1; S.trail = []; if (Sea3D.hero) { Sea3D.hero.visible = false; Sea3D.shadows.visible = false; Sea3D.foam.visible = false; } },
    overlay(c, t) { letterbox(c); doc(c, 'THE FLORIDA KEYS.', env(t, 0.5, 3.6, 0.7, 0.5), { size: 30, ls: 9, weight: 300 }); black(c, clamp(1 - t / 1.1, 0, 1)); black(c, clamp((t - 3.2) / 0.4, 0, 1)); }
  };
  // the reef under the light: antennae in a hole, a moray, a turtle going by
  T.shots.reef = {
    secs: 7.4, warm: 4, hideToasts: true,
    setup() {
      const S = dive({ ch: 'michael', spot: 'alligator', seed: 21 });
      const dens = S.dens.filter((d) => d.kind === 'lobster' && d.x > 700 && d.x < S.WW - 700);
      const den = dens.reduce((a, d) => (!a || d.lob.cl > a.lob.cl ? d : a), null) || S.dens[0];
      den.coax = 0.82; den.lob.temper = 'calm';
      S.diver.x = den.x - den.dir * 50; S.diver.y = den.y - 8; S.diver.facing = den.dir;   // behind the wall, out of sight and out of reach
      S.jellies = []; S.exhaleT = 999; S.maxBreath = S.breath = 999;
      S.updateCam = () => {}; S.cam = clamp(den.x - W * 0.5, 0, S.WW - W); S.camY = clamp(den.y - H * 0.55, 0, S.maxCamY());
      S.drawHud = () => {}; S.drawCoach = () => {}; S.drawNet = () => {}; S.drawQuip = () => {}; S.drawAim = () => {};
      T.orig.drawDiver = T.orig.drawDiver || window.drawDiver; window.drawDiver = () => {};
      // a close-up that slowly pulls back: the whole scene drawn through a zoom centered on the hole
      const draw0 = S.draw.bind(S); T.state.zoom = 2.0; T.state.den = den;
      S.draw = (ctx) => { const z = T.state.zoom, fx = den.x + den.dir * 40 - S.cam, fy = den.y - 10 - S.camY; ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-fx, -fy); draw0(ctx); ctx.restore(); };
    },
    tick(i) { const S = Game.scene; S.diver.vy = 0; S.diver.vx = 0; S.diver.x = T.state.den.x - T.state.den.dir * 50; S.quip = null; T.state.zoom = 2.0 - Math.max(0, i) / T.fps * 0.085; },
    overlay(c, t) {
      letterbox(c);
      doc(c, 'For a hundred million years, the spiny lobster has survived down here.', env(t, 0.3, 3.6, 0.5, 0.4));
      doc(c, 'It has outlasted the dinosaurs. The ice ages. Every hurricane.', env(t, 3.8, 7.4, 0.5, 0.4));
      black(c, clamp(1 - t / 0.5, 0, 1)); black(c, clamp((t - 7.0) / 0.4, 0, 1));
    }
  };
  // "now it must survive them": the boat idling out of the canal at first light
  T.shots.them = {
    secs: 3.6, warm: 40, hideToasts: true,
    setup() { const S = sea({ v: 55, notch: 1, noHud: true }); S.boats = []; },
    tick() { Game.scene.notch = 1; },
    overlay(c, t) { letterbox(c); doc(c, 'Now it must survive them.', env(t, 0.35, 3.6, 0.5, 0.4), { y: 112 }); black(c, clamp(1 - t / 0.5, 0, 1)); black(c, clamp((t - 3.2) / 0.4, 0, 1)); }
  };
  // black: three men, one boat, one phone
  T.shots.three = {
    secs: 4.2, warm: 1,
    setup() { blank(); },
    overlay(c, t) {
      c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
      doc(c, 'Three men.', env(t, 0.2, 4.2, 0.45, 0.35), { y: H / 2 - 52, size: 30, ls: 4 });
      doc(c, 'One boat.', env(t, 1.15, 4.2, 0.45, 0.35), { y: H / 2, size: 30, ls: 4 });
      doc(c, 'One phone, at twelve percent.', env(t, 2.25, 4.2, 0.45, 0.35), { y: H / 2 + 52, size: 30, ls: 4 });
    }
  };
  // the lobster, unbothered
  T.shots.fine = {
    secs: 3.4, warm: 1,
    setup() { blank(); },
    overlay(c, t) { lobsterStar(c, t, { push: 1 + t * 0.012 }); doc(c, 'It will be fine.', env(t, 0.8, 3.4, 0.4, 0.2), { y: H - 64 }); black(c, clamp(1 - t / 0.4, 0, 1)); if (t > 3.15) black(c, 1); }
  };
  // smash cut: Michael, full throttle, Florida Bay
  T.shots.aground = {
    secs: 3.2, warm: 36,
    setup() {
      const [fx, fy] = spotXY('flats'), h = -Math.PI / 2 - 0.3, [x, y] = findWater(fx, fy + 500, 3.4, 6.5, h);
      const S = sea({ x, y, h, v: 320, notch: 4 }); S.boats = [];
      quips(S, { aground: ['jorge', 'Nice parking job.'] });
    },
    tick(i) { const S = Game.scene; if (i < 0) { S.v = 320; S.notch = 4; S.stuck = 0; } if (i === 22) { S.runAground(); note('scratch'); } },
    overlay(c, t) { cap(c, 'MICHAEL.', '(captain, allegedly)', t, 1.6, { y: 372, size: 46 }); }
  };
  // the title: the game's own title screen with the logo hitting the water
  T.shots.title = {
    secs: 3.4, warm: 20,
    setup() {
      trip(); const ts = new TitleScene(); ts.nextJump = 0.9;
      ts.draw = function (ctx) {
        const L = this.layout(), t = this.t; this.drawScene(ctx, L); this.drawBoat(ctx, L); this.drawJump(ctx, L);
        for (let i = 0; i < 2; i++) { const [gx, gy] = L.toScreen(-150 + i * 80 + Math.sin(t * 0.6 + i * 2) * 30, -262 + Math.cos(t * 0.9 + i) * 14 - i * 20); drawGull(ctx, gx, gy, 0.85 * L.s + 0.1, t * 7 + i * 1.7); }
      };
      go(ts);
    },
    tick(i) { const ts = Game.scene; if (ts.jump && !ts.jump.__set) { ts.jump.__set = true; ts.jump.key = 'sailfish'; ts.jump.len = 118 * ts.layout().s; } if (i === 7) { note('slam'); note('horn'); } },
    overlay(c, t) {
      const t0 = 0.23; if (t < t0) return;
      const k = easeOut(clamp((t - t0) / 0.22, 0, 1)), sc = lerp(2.4, 1, k);
      c.save(); c.globalAlpha = k; logo(c, W * 0.4, H * 0.36, 128, sc); c.restore();
      if (t > t0 && t < t0 + 0.35) black(c, 0); // (no flash: the logo carries it)
      const a2 = env(t, t0 + 0.5, 99, 0.3, 1); if (a2 > 0) { c.save(); c.globalAlpha = a2; text(c, 'Lobstering and fishing in the Florida Keys', W * 0.4, H * 0.36 + 92, { size: 24, align: 'center', color: '#fff', weight: 700, stroke: 'rgba(6,34,50,0.85)', sw: 6 }); c.restore(); }
    }
  };

  /* ================= ACT TWO: the montage ================= */
  // Michael tickles out a big bug, nets it clean, gauges it
  T.shots.bug = {
    secs: 5.0, warm: 3,
    setup() {
      const S = dive({ ch: 'michael', spot: 'bughunt', seed: 5 });
      const dens = S.dens.filter((d) => d.kind === 'lobster' && d.x > 800 && d.x < S.WW - 800 && d.y > S.baseFloor(d.x) - 40);
      const den = dens[0] || S.dens.find((d) => d.kind === 'lobster');
      den.lob = { cl: 4.62, w: lobsterWeight(4.62), eggs: false, gold: false, temper: 'calm' }; den.coax = 0.5; den.nextTwitch = 9;
      S.diver.x = den.x + den.dir * 74; S.diver.y = den.y - 6; S.diver.facing = -den.dir;
      S.cam = clamp(S.diver.x - W * 0.45, 0, S.WW - W); S.camY = clamp(S.diver.y - H * 0.5, 0, S.maxCamY());
      quips(S, { big: ['jorge', 'THAT’S a big boy!'], nice: ['jorge', 'Into the cooler!'], pro: ['jemel', 'Textbook!'] });
      T.state.den = den;
    },
    tick(i) {
      const S = Game.scene, den = T.state.den;
      if (i === 2) S.tickPtr = { id: 1, den };
      if (i === 44) S.netBug();
      if (i === 98 && S.gauge) S.decide(true);
    },
    overlay(c, t) { if (t < 1.95) cap(c, 'MICHAEL: THE BUG HUNTER', 'tickle it out. net it.', t, 0.2, { y: 122, size: 44 }); else if (t > 3.5) cap(c, 'GAUGE EVERY BUG.', 'FWC checks the bag at the ramp', t, 3.6, { y: 122, size: 44 }); }
  };
  // Jorge tickles the wrong hole
  T.shots.moray = {
    secs: 2.9, warm: 3,
    setup() {
      const S = dive({ ch: 'jorge', spot: 'bughunt', seed: 8 });
      const den = S.dens.find((d) => d.kind === 'moray' && d.x > 800 && d.x < S.WW - 800) || S.dens.find((d) => d.kind === 'moray');
      den.peekT = 99; den.peek = 0;
      S.diver.x = den.x + den.dir * 74; S.diver.y = den.y - 6; S.diver.facing = -den.dir;
      S.cam = clamp(S.diver.x - W * 0.45, 0, S.WW - W); S.camY = clamp(S.diver.y - H * 0.5, 0, S.maxCamY());
      quips(S, { moray: ['jemel', 'HAHAHA wrong hole!'] });
      T.state.den = den;
    },
    tick(i) { const S = Game.scene; if (i === 10) S.tickPtr = { id: 1, den: T.state.den }; },
    overlay(c, t) { cap(c, 'JORGE: LUCKY SHADES', '(the luck is situational)', t, 0.2, { y: 218, size: 44 }); }
  };
  // the boat ride: airtime off a wake, dolphins on the bow
  T.shots.run = {
    secs: 4.4, warm: 45,
    setup() {
      const S = sea({ x: 8300, y: wy(8300, 1050), h: Math.PI + 0.05, v: 300, notch: 4 });
      quips(S, { air: ['jorge', 'My coffee!'], dolphins: ['jemel', 'Dolphins on the bow!'] });
    },
    tick(i) {
      const S = Game.scene;
      if (i === 18) { S.v = 320; S.airCd = 0; S.hitWake(); }
      if (i === 66) { S.dolphins = { t: 0, dur: 7, pod: [0, 1, 2].map((k) => ({ ox: 60 + k * 25, oy: (k - 1) * 46, ph: k * 2.1 })) }; S.flags.dolphins = true; const [bx, by] = S.boatScreen(); S.fl.add(bx, by - 80, 'Dolphins! +25', '#bff0ff', 22); S.say('dolphins'); SFX.play('dolphin'); }
      if (i > 62 && i < 96) S.steer = { id: 1, x: W * 0.4, y: 300, sx: W * 0.4, sy: 300, t0: 0 }; else S.steer = null;
    },
    overlay(c, t) { if (t < 2.1) cap(c, 'RUN THE WHOLE UPPER KEYS', 'in 3D, on a phone', t, 0.2); else cap(c, 'DOLPHINS.', 'they just show up', t, 2.3); }
  };
  // the officer
  T.shots.fwc = {
    secs: 3.3, warm: 45,
    setup() {
      const S = sea({ x: World.home.x, y: wy(World.home.x, World.home.hw + 40), h: Math.PI / 2, v: 210, notch: 3 });
      quips(S, { fwc: ['jorge', 'Officer, he’s new.'] });
    },
    tick(i) { const S = Game.scene; if (i === 12 && !S.flags.fwc) S.pullOver(); },
    overlay(c, t) { cap(c, 'NO WAKE MEANS NO WAKE.', '(−50 captain’s points)', t, 0.9); }
  };
  // the chart, and the spots you have to find
  T.shots.chart = {
    secs: 2.7, warm: 30,
    setup() { const S = sea({ x: 8300, y: wy(8300, 1050), h: Math.PI, v: 0, notch: 0 }); S.openChart(); S.sel = 'wreck'; Game.toasts = []; },
    overlay(c, t) { cap(c, 'NINE SPOTS. FIVE ARE HIDDEN.', 'the dock talks, if you listen', t, 0.2, { y: 492, size: 36, rot: 0 }); }
  };
  // Jorge reads the finder, hooks a grouper, turns it off the bottom, lands it
  T.shots.ledge = {
    secs: 8.4, warm: 3,
    setup() {
      trip(); seed(3);
      const S = go(new BottomScene({ ch: 'jorge', spot: 'bottom', len: 120, weather: LIGHT, onEnd() {} }));
      const h = S.hot.find((hh) => hh.table.some(([k]) => k === 'blackgrouper')) || S.hot[0];
      S.bx = h.x; S.cam = S.bx - S.baitSX(); S.baitDepth = S.targetDepth = Math.max(25, S.bottomFt(S.bx) - 3); S.settled = true;
      const f = S.spawnFish(h, false, 'blackgrouper'); f.w = 44; f.len = BOT_SP.blackgrouper.len * (0.78 + 0.5 * sizeNorm('blackgrouper', 44));
      T.state.f = f;
    },
    tick(i) {
      const S = Game.scene, f = T.state.f;
      if (i < 44 && i >= 0) { f.tx = S.baitX() - f.face * 60; f.ty = S.yOf(S.baitDepth); }
      if (i === 44) { f.state = 'bite'; f.timer = 6; f.x = S.baitX() - f.face * f.len * 0.42; f.y = S.yOf(S.baitDepth); S.slam = 0.6; Game.toast('BITE!', { color: PAL.sun, size: 52, y: 160, dur: 0.8 }); note('bite'); }
      if (i === 58) { S.hookset(true); if (S.child) hookBot(S.child, 'good'); }
      const ff = runBot(S);
      if (ff && ff.phase === 'fight' && !T.state.beat) { T.state.beat = true; ff.S = 0.03; ff.dist = 15; }
    },
    overlay(c, t) { if (t < 1.9) cap(c, 'JORGE: READ THE FINDER', 'red arches are fish', t, 0.2); else if (t > 2.05) cap(c, 'OFF THE BOTTOM!', 'tap fast or it cuts you off', t, 2.2, { y: 398, size: 48 }); }
  };
  // Jemel follows the birds, bows to the jump, then holds on one second too long
  T.shots.troll = {
    secs: 7.4, warm: 3,
    setup() {
      trip(); seed(11);
      const S = go(new TrollScene({ ch: 'jemel', spot: 'troll', len: 120, weather: LIGHT, onEnd() {} }));
      S.features = []; S.fish = []; S.timers.frigates = 99; S.timers.birds = 99; S.timers.blind = 99; S.timers.debris = 99;
      const fe = S.spawnFeature('frigates', W * 0.86); fe.y = S.by + 40;
      const fi = S.fish.filter((x) => x.feat === fe).sort((a, b) => b.w - a.w)[0]; fi.w = 31; fi.n = sizeNorm('mahi', 31); fi.len = (38 + 64 * fi.n);
      T.state.fe = fe; T.state.fi = fi; T.state.stage = 0;
    },
    tick(i) {
      const S = Game.scene, st = T.state;
      if (i === 16) S.startChase(st.fi, S.lures[0], 4);
      if (i === 44 && !S.strike && !S.child) S.doStrike(st.fi, S.lures[0]);
      if (S.child && !S.child.__bot) { hookBot(S.child, 'good'); st.fightAt = i; }
      const f = runBot(S); if (!f) return;
      const k = i - st.fightAt;
      if (k === 8 && st.stage === 0) { st.stage = 1; f.running = true; f.runT = 3; f.runStr = 1; f.jumpDelay = 0.5; }
      if (st.stage === 1 && f.jumps > 0 && f.jumpT <= 0) { st.stage = 2; f.running = false; f.restT = 0.1; f.pw = 1.08; f.__bot.mode = 'greedy'; }
      if (st.stage === 2 && f.running) f.runStr = 1.12;
    },
    overlay(c, t) {
      if (t < 2.0) cap(c, 'JEMEL: FOLLOW THE BIRDS', 'frigates mean mahi', t, 0.2);
      else { const f = Game.scene.child, over = f && f.phase === 'over'; if (!over) { T.state.overAt = null; cap(c, 'BOW TO THE JUMP...', 'let go when it comes up', t, 2.5); } else { if (T.state.overAt == null) T.state.overAt = t; cap(c, '...THEN KEEP LETTING GO.', '(Jemel.)', t, T.state.overAt + 0.15); } }
    }
  };
  // Jemel's marlin
  T.shots.marlin = {
    secs: 5.8, warm: 3,
    setup() {
      trip(); seed(5);
      const S = go(new TrollScene({ ch: 'jemel', spot: 'hump', len: 120, weather: GLASS, onEnd() {} }));
      S.startFight({ sp: 'bluemarlin', weight: 380, ctxType: 'offshore' }); hookBot(S.child, 'good'); S.child.taxRisk = false; T.state.stage = 0;
    },
    tick(i) {
      const S = Game.scene, st = T.state, f = runBot(S); if (!f) return;
      if (i === 10 && st.stage === 0) { st.stage = 1; f.running = true; f.runT = 3; f.runStr = 1; f.jumpDelay = 0.45; }
      if (st.stage === 1 && f.jumps > 0 && f.jumpT <= 0) { st.stage = 2; f.running = false; f.S = 0.02; f.dist = 17; }
    },
    overlay(c, t) { if (t < 3.3) cap(c, 'JEMEL: BIG GAME', 'reels faster, line takes more', t, 0.2); else cap(c, 'HE WILL BRING THIS UP FOREVER.', 'released, by the way', t, 4.2, { size: 40, y: 470, rot: 0 }); }
  };
  // Michael on the flats: Jemel calls the fish by the clock
  T.shots.flats = {
    secs: 5.6, warm: 3,
    setup() {
      trip({ weather: GLASS }); seed(4);
      const S = go(new FlatsScene({ ch: 'michael', spot: 'flats', len: 120, weather: GLASS, onEnd() {} }));
      S.pickSpecies = () => 'bonefish'; S.fishList = []; S.critters = []; S.spawnT = 99; S.critT = 99; S.introSaid = true;
      const f = S.spawnFish(true); f.brain = 'tail'; f.x = S.bx + 190; f.y = H - 250; f.hd = 0; f.face = 0; f.alpha = 1; f.state = 'cruise'; f.tailing = 3; f.life = 99; f.lead = null;
      for (const o of S.fishList) if (o !== f) o.gone = true;
      T.state.f = f;
    },
    tick(i) {
      const S = Game.scene, f = T.state.f;
      if (i >= 0 && i < 62 && f.state === 'cruise') { f.hd = 0; f.x = S.bx + 190 + i * 0.4; f.y = H - 250; f.tailing = 2.5; }
      if (i === 6) S.callFish(f, false);
      if (i === 46) { const tip = S.rodTip(); S.cast = { sx: tip.x, sy: tip.y, tx: f.x + 58, ty: f.y - 4, t: 0, dur: 0.5 }; S.aim = null; note('cast'); }
      if (i === 70 && f.state === 'follow') f.interest = 1.1;
      if (i === 84 && S.eat) { S.setHook(); if (S.child) hookBot(S.child, 'good'); }
      runBot(S);
    },
    overlay(c, t) { if (t < 2.4) cap(c, 'SIGHT-FISH THE BACKCOUNTRY', 'Jemel’s on the pole', t, 0.2); else cap(c, 'LEAD THE FISH.', 'strip it in his rhythm', t, 2.55); }
  };
  // the shark, and the fastest Michael has ever swum
  T.shots.shark = {
    secs: 4.4, warm: 3,
    setup() {
      const S = dive({ ch: 'michael', spot: 'alligator', seed: 11 });
      S.diver.x = BH.BOATX + 440; S.diver.y = BH.SURF + 150; S.diver.facing = -1; S.jellies = [];
      S.cam = clamp(S.diver.x - W * 0.45, 0, S.WW - W); S.camY = clamp(S.diver.y - H * 0.5, 0, S.maxCamY());
      quips(S, { shark: ['jemel', 'SHARK!! Back to the boat!'], escape: ['jorge', 'Bro walked on water.'] });
    },
    tick(i) { const S = Game.scene; if (i === 3) S.startShark(); if (i === 9) keys('ArrowLeft', 'ArrowUp'); if (S.sharkDone) keys(); },
    overlay(c, t) { cap(c, 'CARDIO.', '(he’s just doing his job)', t, 2.0); }
  };
  // the tax man, at the wreck
  T.shots.tax = {
    secs: 5.0, warm: 3,
    setup() {
      trip(); seed(9);
      const S = go(new BottomScene({ ch: 'jorge', spot: 'wreck', len: 120, weather: LIGHT, onEnd() {} }));
      S.startFight({ sp: 'amberjack', weight: 40, ctxType: 'reef', depth: 100 }); const f = hookBot(S.child, 'good'); f.phase = 'fight'; f.taxRisk = false; f.S = 0.7; f.dist = 60;
    },
    tick(i) { const S = Game.scene, f = runBot(S); if (!f) return; if (i === 8) { f.shark = { t: 2.3, a: 0 }; Game.toast('SHARK!', { color: '#dfe6ea', size: 42, y: 130, sub: 'Wear it out before the tax man gets it' }); note('warn'); } },
    overlay(c, t) { if (t < 3.2) cap(c, 'THE TAX MAN.', 'always collects', t, 0.2); else cap(c, 'STILL COUNTS.', '(it does not)', t, 3.9); }
  };
  // the brag post
  T.shots.brag = {
    secs: 2.6, warm: 1,
    setup() {
      const c = trip(); c.spot = 'alligator'; c.turn = 0; Trip.cur.weather = GLASS;
      const k = makeCatch('lobster', lobsterWeight(4.62), 'michael', 'alligator', [{ label: 'Big boy bonus', pts: 100 }]); k.cl = 4.62;
      const lines = [{ label: 'Lobster 1 · 4.62" · 2.9 lb', pts: k.pts, key: 'lobster', trophy: k.trophy }, { label: 'Backed it into the net', pts: 50 }, { label: 'Outswam a shark back to the boat', pts: 100 }, { label: 'Clean bag · the officer nods', pts: 100 }];
      const res = { catches: [k], lines, total: lines.reduce((a, l) => a + l.pts, 0), best: k, header: 'FWC check at the ramp', under: true };
      const R = go(new ResultsScene('michael', 'alligator', res, 'turn')); R.caption = CAPTIONS.bigbug; R.comments = 7; R.t = 1.3; R.shown = 4;
    },
    overlay(c, t) { cap(c, 'THEN YOU POST ABOUT IT.', 'every. single. time.', t, 0.2, { x: 300, y: 330, size: 36, maxW: 520 }); }
  };
  // the run home at sunset
  T.shots.sunset = {
    secs: 3.4, warm: 45,
    setup() {
      const S = sea({ home: true, trip: { legs: 2 }, x: 7600, y: wy(7600, 1500), h: -2.4, v: 230, notch: 3, dest: 'home' });
      S.planRoute(); S.setAuto(true); Game.toasts = [];
      if (S.route && S.route.length > 1) S.h = Math.atan2(S.route[1][1] - S.y, S.route[1][0] - S.x);   // already pointed down the channel home
      S.v = 230; Chase.reset(S);
      Game.toast('Heading home', { color: PAL.sun, size: 40, y: 150, sub: 'Captain Jemel, take us back to the dock in Tavernier' });
    },
    overlay(c, t) { cap(c, 'RACE THE SUN HOME.', 'most points is Captain of the Day', t, 0.8); }
  };
  // the board
  T.shots.board = {
    secs: 3.6, warm: 1,
    setup() {
      const c = trip(); c.scores = { michael: 2940, jorge: 2610, jemel: 2585 };
      const add = (key, w, ch, spot) => { const k = makeCatch(key, w, ch, spot); if (key === 'lobster') k.cl = 4.62; c.catches.push(k); };
      add('bluemarlin', 380, 'jemel', 'hump'); add('lobster', lobsterWeight(4.62), 'michael', 'alligator'); add('blackgrouper', 44, 'jorge', 'bottom'); add('mutton', 9.4, 'jorge', 'bottom'); add('yellowtail', 2.1, 'jorge', 'bottom'); add('bonefish', 7.2, 'michael', 'flats');
      c.bounties = [Bounties.make('bigbug'), Bounties.make('billfish'), Bounties.make('grouper')]; c.bounties[0].done = true; c.bounties[0].by = 'michael'; c.bounties[1].done = true; c.bounties[1].by = 'jemel'; c.bounties[2].done = true; c.bounties[2].by = 'jorge';
      go(new DayEndScene());
    },
    overlay(c, t) { cap(c, 'ONE CAPTAIN OF THE DAY.', '(it’s whoever owns the phone)', t, 0.3, { x: 190, y: 112, size: 34, maxW: 330 }); }
  };

  /* ================= ACT THREE ================= */
  // the end card: the three of them, each with their fish
  T.shots.end = {
    secs: 4.8, warm: 1,
    setup() { T.state.parts = new Particles(); blank(); },
    overlay(c, t) {
      oceanBackdrop(c, W, H, t, 'sunset'); c.fillStyle = 'rgba(10,14,40,0.28)'; c.fillRect(0, 0, W, H);
      drawSunburst(c, W / 2, H * 0.62, 520, t, 'rgba(255,214,90,0.13)');
      const k = easeBack(clamp((t - 0.2) / 0.4, 0, 1));
      const guys = [['jorge', { kind: 'fish', key: 'blackgrouper', weight: 44 }, W * 0.24], ['michael', { kind: 'lobster', cl: 4.62 }, W * 0.5], ['jemel', { kind: 'fish', key: 'bluemarlin', weight: 380 }, W * 0.76]];
      guys.forEach(([ch, item, x], i) => { const kk = easeBack(clamp((t - 0.25 - i * 0.12) / 0.4, 0, 1)); if (kk <= 0) return; c.save(); c.translate(x, H * 0.58 + Math.sin(t * 1.6 + i) * 3); c.scale(kk, kk); drawHeroShot(c, ch, item, 0, 0, 30, t, { expr: ch === 'jorge' ? 'open' : 'grin' }); c.restore(); });
      if (k > 0) logo(c, W / 2, 86, 104, k);
      const a2 = env(t, 0.9, 99, 0.3, 1);
      if (a2 > 0) {
        c.save(); c.globalAlpha = a2;
        text(c, 'Lobstering and fishing in the Florida Keys', W / 2, 150, { size: 22, align: 'center', color: '#fff', weight: 700, stroke: 'rgba(6,34,50,0.85)', sw: 6 });
        panel(c, W / 2 - 250, H - 62, 500, 42, { r: 21, fill: 'rgba(7,36,51,0.92)' });
        text(c, 'Play free · msaco13.github.io/keys-lobster-game', W / 2, H - 35, { size: 19, align: 'center', color: PAL.sun, weight: 800 });
        text(c, 'For Michael, Jorge & Jemel', W / 2, H - 76, { size: 15, align: 'center', color: '#ffe3c0', weight: 700, stroke: 'rgba(6,34,50,0.6)', sw: 4 });
        c.restore();
      }
      if (t > 0.3 && !T.state.popped) { T.state.popped = true; T.state.parts.burst(W / 2, 140, 70, { kind: 'confetti', color: [PAL.sun, PAL.coral, '#42d3c4', '#fff'], min: 120, max: 460, g: 380, lifeMin: 1.8, lifeMax: 3, sMin: 3, sMax: 7, drag: 0.5 }); note('slam'); }
      T.state.parts.update(1 / T.fps); T.state.parts.draw(c);
      black(c, clamp((t - 4.4) / 0.4, 0, 1));
    }
  };
  // the rating card
  T.shots.rating = {
    secs: 3.6, warm: 1,
    setup() { blank(); },
    overlay(c, t) {
      c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
      const a = env(t, 0.1, 3.6, 0.3, 0.3); if (a <= 0) return;
      c.save(); c.globalAlpha = a;
      const bx = W / 2 - 330, by = 92, bw = 660, bh = 356;
      c.fillStyle = '#fff'; rr(c, bx, by, bw, bh, 6); c.fill();
      c.fillStyle = '#000'; rr(c, bx + 10, by + 10, bw - 20, bh - 20, 4); c.fill();
      c.fillStyle = '#fff'; rr(c, bx + 18, by + 18, bw - 36, bh - 36, 3); c.fill();
      // the big letter, boxed
      c.fillStyle = '#000'; c.fillRect(bx + 44, by + 54, 150, 150); c.fillStyle = '#fff'; c.fillRect(bx + 52, by + 62, 134, 134);
      text(c, 'B', bx + 119, by + 176, { size: 128, align: 'center', color: '#000', weight: 800 });
      text(c, 'FOR BUGS', bx + 230, by + 92, { size: 42, color: '#000', weight: 800 });
      text(c, 'SOME MATERIAL MAY NOT BE SUITABLE FOR LOBSTERS', bx + 230, by + 124, { size: 16, color: '#000', weight: 700 });
      c.fillStyle = '#000'; c.fillRect(bx + 230, by + 142, bw - 274, 3);
      const lines = ['Contains mild heckling, one moray,', 'a shark that was just doing his job,', 'and a captain who ran aground in the opening scene.'];
      lines.forEach((l, i) => text(c, l, bx + 230, by + 176 + i * 28, { size: 20, color: '#000', weight: 700, maxW: bw - 274 }));
      c.fillStyle = '#000'; c.fillRect(bx + 44, by + 246, bw - 88, 3);
      text(c, 'MOTION PICTURE ASSOCIATION OF TAVERNIER, FLORIDA · WATER 79°F · PHONE AT 12%', bx + bw / 2, by + 282, { size: 15, align: 'center', color: '#000', weight: 800, maxW: bw - 80 });
      text(c, 'No fish were harmed. Several were taxed.', bx + bw / 2, by + 316, { size: 18, align: 'center', color: '#000', weight: 700 });
      c.restore();
    }
  };
  // the stinger
  T.shots.stinger = {
    secs: 3.0, warm: 1,
    setup() { blank(); },
    overlay(c, t) { lobsterStar(c, t, { push: 1.04, hat: true, twitch: t > 1.6 && t < 2.0 ? 0.3 : 0 }); if (t > 1.9 && !T.state.bub) { T.state.bub = true; note('bubble'); } doc(c, 'It was fine.', env(t, 0.5, 3.0, 0.4, 0.25), { y: H - 64 }); black(c, clamp(1 - t / 0.5, 0, 1)); black(c, clamp((t - 2.6) / 0.4, 0, 1)); }
  };

  /* ---------- the frame loop, driven from node ---------- */
  T.init = () => {
    T.orig.drawDiver = window.drawDiver; T.orig.seaOverlay = Sea3D.overlay;
    SFX.muted = true; Game._frame = Game.frame; Game.frame = () => {};
    if (typeof GL !== 'undefined') GL.tune = () => {};
    SFX.play = (name, k) => { T.sfx.push({ name, f: T.frame, k: k == null ? 1 : k }); };
    SFX.steel = (f) => { T.sfx.push({ name: 'steel', f: T.frame, hz: f }); };
    const draw0 = Game.draw;
    Game.draw = function (dt) { const S = T.cur; if (S && S.hideToasts) this.toasts = []; return draw0.call(this, dt); };
    const ov = document.createElement('canvas'); ov.id = 'ov'; ov.style.cssText = 'position:absolute;left:0;top:0;z-index:9;pointer-events:none';
    document.getElementById('wrap').appendChild(ov); T.ov = ov; T.octx = ov.getContext('2d');
    T.fit();
  };
  T.fit = () => { const ov = T.ov; ov.width = Game.canvas.width; ov.height = Game.canvas.height; ov.style.width = Game.canvas.style.width; ov.style.height = Game.canvas.style.height; };
  T.begin = (id, fps) => {
    const S = T.shots[id]; if (!S) throw new Error('no shot ' + id);
    T.fps = fps || 30;
    window.drawDiver = T.orig.drawDiver; Sea3D.overlay = T.orig.seaOverlay; if (Sea3D.hero) { Sea3D.hero.visible = true; Sea3D.shadows.visible = true; Sea3D.foam.visible = true; } Input.keys.clear(); Input.pointers.clear();
    for (const k of ['trip', 'charted', 'records', 'trips', 'seaView', 'finder', 'coach_bug3_michael', 'coach_bug3_jorge', 'coach_bug3_jemel']) Store.del(k);
    T.sfx = []; T.frame = -999; T.t = 0; T.cur = S; T.state = {};
    S.setup();
    return { secs: S.secs, warm: S.warm || 3 };
  };
  T.step = (i, ts) => {
    T.frame = i; T.t = i / T.fps; const S = T.cur;
    if (S.tick) S.tick(i, T.t);
    Game._frame.call(Game, ts);
    const c = T.octx; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, T.ov.width, T.ov.height);
    const k = Game.dpr; c.setTransform(k * Game.scale, 0, 0, k * Game.scale, k * Game.ox, k * Game.oy);
    if (S.overlay && i >= 0) S.overlay(c, T.t, i);
    return Game.error ? String(Game.error.stack || Game.error) : null;
  };
  return T;
})();
