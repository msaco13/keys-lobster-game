'use strict';
/* Keys Crew — shared plumbing for a timed turn at a spot: clock, pause, top bar,
   running a fish fight on top of the spot, and packaging the results. */

class SessionBase {
  constructor(o) {
    this.o = o; this.ch = o.ch; this.C = CHARS[o.ch]; this.perks = this.C.perks; this.spot = o.spot;
    this.weather = o.weather || { id: 'light', name: 'Light chop', vis: 1, drift: 0.5, aim: 1 };
    this.len = o.len || 120; this.timeLeft = this.len; this.t = 0;
    this.paused = false; this.quitAsk = false; this.leaving = false; this.ended = false; this.endT = 0; this.endReason = null;
    this.catches = []; this.extraLines = []; this.score = 0;
    this.parts = new Particles(); this.fl = new Floaters(); this.child = null; this.music = 'boat';
  }
  tickTime(dt) {
    if (this.timeLeft <= 0) return;
    const before = this.timeLeft; this.timeLeft = Math.max(0, this.timeLeft - dt);
    if (before > 10 && this.timeLeft <= 10) { Game.toast('10 seconds left!', { color: PAL.sun, size: 30, y: 110 }); SFX.play('warn'); }
    if (this.timeLeft <= 0 && this.child) Game.toast('Last fish! Land it!', { color: PAL.sun, size: 30, y: 110 });
  }
  addCatch(c) { this.catches.push(c); this.score += c.pts; }
  addLine(label, pts) { this.extraLines.push({ label, pts }); this.score += pts; }
  startFight(opts) {
    const fs = new FightScene(Object.assign({
      ch: this.ch, spot: this.spot, weather: this.weather,
      tick: (dt) => this.tickTime(dt), timeLeft: () => this.timeLeft,
      onDone: (r) => { this.child = null; Music.play(this.music); if (r.ok) this.addCatch(r.catch); if (this.onFightDone) this.onFightDone(r); if (this.timeLeft <= 0) this.end('time'); }
    }, opts));
    this.child = fs; fs.enter();
  }
  end(reason) {
    if (this.ended) return;
    this.ended = true; this.endT = 0; this.endReason = reason; SFX.setDrag(0);
    const msg = reason === 'limit' ? 'Limited out!' : reason === 'quit' ? 'Heading in' : 'Time’s up!';
    Game.toast(msg, { color: PAL.sun, size: 52, dur: 1.6, y: Game.H / 2 - 20 });
    SFX.play('horn');
  }
  buildResult() {
    const lines = this.catches.map((c) => ({ label: c.name + ' · ' + fmtLb(c.weight), pts: c.pts, key: c.key, trophy: c.trophy }));
    for (const l of this.extraLines) lines.push(l);
    const total = Math.max(0, lines.reduce((a, l) => a + l.pts, 0));
    let best = null; for (const c of this.catches) if (!best || c.pts > best.pts) best = c;
    return { catches: this.catches, lines, total, best, header: this.resultHeader || null };
  }
  finish() { if (this.finished) return; this.finished = true; SFX.setDrag(0); SFX.setAmbient(0); this.o.onEnd(this.buildResult()); }
  // returns true when the subclass should skip its own update
  baseUpdate(dt) {
    if (this.paused || this.leaving) return true;   // a fish fight freezes too
    if (this.child) { this.child.update(dt); return true; }
    this.t += dt; this.parts.update(dt); this.fl.update(dt);
    if (this.ended) { this.endT += dt; if (this.endT > 1.7) this.finish(); return true; }
    this.tickTime(dt);
    if (this.timeLeft <= 0 && !this.child) { this.end('time'); return true; }
    return false;
  }
  togglePause() { if (this.ended || this.leaving) return; this.setPaused(!this.paused); }
  setPaused(on) { this.paused = on; this.quitAsk = false; SFX.setDrag(0); if (on) Game.toasts = []; }  // toasts draw above everything, so clear them off the menu
  // leave mid-turn: this turn never reaches the results. Trip.cur still points at this spot and angler,
  // so Resume trip on the title screen hands the phone right back to them.
  quitToTitle() {
    if (this.leaving) return;
    this.leaving = true; this.finished = true; SFX.setDrag(0); SFX.setAmbient(0);
    if (Trip.cur && Trip.cur.mode === 'crew') Trip.save();
    Game.go(new TitleScene());
  }
  basePointerDown(p) {
    if (this.paused || this.leaving) return true;
    if (this.child) { this.child.pointerDown(p); return true; }
    return this.ended;
  }
  baseKeyDown(c) {
    if (c === 'Escape' || c === 'KeyP') { if (this.quitAsk) this.quitAsk = false; else this.togglePause(); return true; }
    if (this.paused || this.leaving) return true;
    if (this.child) { this.child.keyDown(c); return true; }
    return this.ended;
  }
  drawTopBar(ctx) {
    const W = Game.W;
    UI.button(ctx, 'pause', 14, 12, 46, 46, '❚❚', () => this.togglePause(), { style: 'dark', size: 16, r: 14 });
    panel(ctx, 70, 12, 196, 46, { r: 23 });
    ctx.save(); ell(ctx, 93, 35, 19, 19); ctx.clip(); ctx.fillStyle = '#7fc8e8'; ctx.fillRect(70, 12, 46, 46); drawHead(ctx, this.C, 93, 40, 15); ctx.restore();
    ctx.strokeStyle = this.C.color; ctx.lineWidth = 2.5; ell(ctx, 93, 35, 19, 19); ctx.stroke();
    text(ctx, this.C.name, 120, 31, { size: 17, weight: 800, color: '#fff' });
    text(ctx, this.score.toLocaleString() + ' pts', 120, 50, { size: 15, weight: 700, color: PAL.sun });
    drawTimerPill(ctx, W / 2, 35, this.timeLeft);
  }
  drawPause(ctx) {
    const W = Game.W, H = Game.H, cx = W / 2, crew = Trip.cur && Trip.cur.mode === 'crew';
    for (const r of UI.regions) r.disabled = true;   // nothing under the menu answers clicks or hotkeys while paused
    ctx.fillStyle = 'rgba(3,22,32,0.86)'; ctx.fillRect(0, 0, W, H);
    if (this.quitAsk) return this.drawQuitAsk(ctx, crew);
    text(ctx, 'Paused', cx, 130, { display: true, size: 54, align: 'center', color: '#fff' });
    text(ctx, SPOTS[this.spot].name + ' · ' + fmtTime(this.timeLeft) + ' left', cx, 168, { size: 20, align: 'center', color: '#cfe3ea', weight: 600 });
    UI.button(ctx, 'resume', cx - 130, 194, 260, 56, 'Resume', () => this.setPaused(false), { key: 'Escape|Enter|Space', size: 22 });
    UI.button(ctx, 'mute', cx - 130, 264, 125, 48, SFX.muted ? 'Sound: off' : 'Sound: on', () => SFX.setMuted(!SFX.muted), { style: 'secondary', size: 17 });
    UI.button(ctx, 'music', cx + 5, 264, 125, 48, Music.on ? 'Music: on' : 'Music: off', () => Music.setOn(!Music.on), { style: 'secondary', size: 17 });
    UI.button(ctx, 'quit', cx - 130, 326, 260, 56, 'End my turn now', () => { this.setPaused(false); this.end('quit'); }, { style: 'coral', size: 20, sub: this.child ? 'Right after this fish' : 'Your catches so far still count' });
    UI.button(ctx, 'totitle', cx - 130, 398, 260, 52, 'Quit to title', () => (this.quitAsk = true), { style: 'ghost', size: 19, sub: !crew ? 'Ends your solo day' : Store.failed ? 'This browser isn’t saving' : 'Your trip is saved' });
    GFX.pauseRow(ctx, cx, 464);
  }
  drawQuitAsk(ctx, crew) {
    const W = Game.W, cx = W / 2;
    text(ctx, crew ? 'Leave the trip?' : 'Leave your day?', cx, 150, { display: true, size: 46, align: 'center', color: '#fff', maxW: W - 60 });
    const lines = crew
      ? Store.failed ? ['This browser isn’t saving, so the trip ends here.', 'Private browsing or full storage. Scores so far are lost.'] : ['Your trip is saved. Pick it up with Resume trip on the title screen.', 'This turn won’t count. ' + this.C.name + ' starts it over when you come back.']
      : ['Solo days aren’t saved, so your day ends here.', 'This turn won’t count. Bests from earlier turns stay in the logbook.'];
    lines.forEach((l, i) => text(ctx, l, cx, 202 + i * 30, { size: 19, align: 'center', color: '#cfe3ea', weight: 600, maxW: W - 70 }));
    UI.button(ctx, 'quitno', cx - 230, 280, 220, 56, 'Cancel', () => (this.quitAsk = false), { style: 'ghost', size: 20, key: 'Escape' });
    UI.button(ctx, 'quityes', cx + 10, 280, 220, 56, 'Quit to title', () => this.quitToTitle(), { style: 'coral', size: 20 });
  }
  // a fish fight may be drawn in 3D (the WebGL canvas under this one shows through)
  uses3D() { return !!(this.child && this.child.uses3D && this.child.uses3D()); }
  // during a fish fight the fight draws the whole screen; keep a pause button on it, next to the clock
  drawChildOrNull(ctx) {
    if (!this.child) return false;
    this.child.draw(ctx);
    if (!this.ended && this.child.phase !== 'over') UI.button(ctx, 'pause', Game.W / 2 + 68, 14, 44, 40, '❚❚', () => this.togglePause(), { style: 'dark', size: 15, r: 14 });
    if (this.paused) this.drawPause(ctx);
    return true;
  }
}
