'use strict';
/* Keys Crew — shared plumbing for a timed turn at a spot: clock, pause, top bar,
   running a fish fight on top of the spot, and packaging the results. */

class SessionBase {
  constructor(o) {
    this.o = o; this.ch = o.ch; this.C = CHARS[o.ch]; this.perks = this.C.perks; this.spot = o.spot;
    this.weather = o.weather || { id: 'light', name: 'Light chop', vis: 1, drift: 0.5, aim: 1 };
    this.len = o.len || 120; this.timeLeft = this.len; this.t = 0;
    this.paused = false; this.ended = false; this.endT = 0; this.endReason = null;
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
    if (this.child) { this.child.update(dt); return true; }
    if (this.paused) return true;
    this.t += dt; this.parts.update(dt); this.fl.update(dt);
    if (this.ended) { this.endT += dt; if (this.endT > 1.7) this.finish(); return true; }
    this.tickTime(dt);
    if (this.timeLeft <= 0 && !this.child) { this.end('time'); return true; }
    return false;
  }
  togglePause() { if (this.ended || this.child) return; this.paused = !this.paused; SFX.setDrag(0); }
  basePointerDown(p) { if (this.child) { this.child.pointerDown(p); return true; } return this.paused || this.ended; }
  baseKeyDown(c) {
    if (this.child) { this.child.keyDown(c); return true; }
    if (c === 'Escape' || c === 'KeyP') { this.togglePause(); return true; }
    return this.paused || this.ended;
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
    const W = Game.W, H = Game.H;
    ctx.fillStyle = 'rgba(3,22,32,0.78)'; ctx.fillRect(0, 0, W, H);
    text(ctx, 'Paused', W / 2, 150, { display: true, size: 54, align: 'center', color: '#fff' });
    text(ctx, SPOTS[this.spot].name + ' · ' + fmtTime(this.timeLeft) + ' left', W / 2, 192, { size: 20, align: 'center', color: '#cfe3ea', weight: 600 });
    UI.button(ctx, 'resume', W / 2 - 130, 236, 260, 56, 'Resume', () => { this.paused = false; }, { key: 'Escape|Enter|Space', size: 22 });
    UI.button(ctx, 'mute', W / 2 - 130, 308, 125, 50, SFX.muted ? 'Sound: off' : 'Sound: on', () => SFX.setMuted(!SFX.muted), { style: 'secondary', size: 17 });
    UI.button(ctx, 'music', W / 2 + 5, 308, 125, 50, Music.on ? 'Music: on' : 'Music: off', () => Music.setOn(!Music.on), { style: 'secondary', size: 17 });
    UI.button(ctx, 'quit', W / 2 - 130, 374, 260, 50, 'End my turn now', () => { this.paused = false; this.end('quit'); }, { style: 'coral' });
    text(ctx, 'Your catches so far still count.', W / 2, 452, { size: 16, align: 'center', color: '#9fb8c2', weight: 600 });
  }
  drawChildOrNull(ctx) { if (this.child) { this.child.draw(ctx); return true; } return false; }
}
