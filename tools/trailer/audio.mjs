// Renders the game's own music and sound effects to WAV files, offline, through the game's real synthesizer and
// mixer (SFX.build on an OfflineAudioContext), so the trailer sounds exactly like the game. Also a record scratch
// the game doesn't have. Writes <out>/<name>.wav and <out>/levels.json (each file's peak, for the mix).
//   node tools/trailer/audio.mjs <repo root> <out dir>
import { chromium } from 'playwright';
import fs from 'fs'; import path from 'path';

const [root, out] = process.argv.slice(2).map((p) => path.resolve(p));
fs.mkdirSync(out, { recursive: true });
const SONGS = { reef: 40, run: 110, sunset: 44 };
const SFX = ['click', 'tick', 'coin', 'splash', 'bigsplash', 'plop', 'nibble', 'bite', 'hookset', 'snap', 'catch', 'trophy', 'slam', 'bubble', 'warn', 'sting', 'chomp', 'tickle', 'net', 'swish', 'fail', 'cast', 'strip', 'horn', 'siren', 'woo', 'reel', 'gull', 'dolphin', 'found', 'bounty', 'slap', 'bump'];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.addInitScript(() => { localStorage.clear(); localStorage.setItem('keyscrew_gfx', JSON.stringify('classic')); });
await page.goto('file://' + root + '/index.html'); await page.waitForTimeout(600);
const render = (what, secs) => page.evaluate(async ([what, secs]) => {
  const sr = 48000, ac = new OfflineAudioContext(2, Math.ceil(sr * secs), sr);
  let s = 12345; Math.random = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };   // the same take every time
  SFX.muted = false; SFX.build(ac); Music.on = true; Music.attach(true);
  if (what.startsWith('sfx:')) SFX.play(what.slice(4));
  else if (what === 'scratch') {   // a needle dragged back across the record
    SFX.noise(0.32, { filter: 'bandpass', f: 3200, to: 260, q: 7, vol: 0.55, att: 0.004 });
    SFX.noise(0.22, { filter: 'bandpass', f: 900, to: 4200, q: 5, vol: 0.3, att: 0.01, delay: 0.14 });
    SFX.tone(1400, 0.3, { type: 'sawtooth', to: 110, vol: 0.12, att: 0.003 });
    SFX.tone(180, 0.26, { type: 'square', to: 42, vol: 0.14, att: 0.002, delay: 0.05 });
  } else if (what === 'steel') { SFX.steel(784, 0, 0.09); }
  else {
    Music.play(what); Music.next = 0.04;
    for (const g of [Music.bus.gain, Music.wet.gain]) { g.cancelScheduledValues(0); g.setValueAtTime(SONGS[what].vol, 0); }
    while (Music.next < secs + 0.5) Music.step1();
  }
  const buf = await ac.startRendering();
  const n = buf.length, ch = buf.numberOfChannels, dv = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const w = (o, str) => { for (let i = 0; i < str.length; i++) dv.setUint8(o + i, str.charCodeAt(i)); };
  w(0, 'RIFF'); dv.setUint32(4, 36 + n * ch * 2, true); w(8, 'WAVE'); w(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, ch, true); dv.setUint32(24, sr, true); dv.setUint32(28, sr * ch * 2, true); dv.setUint16(32, ch * 2, true); dv.setUint16(34, 16, true); w(36, 'data'); dv.setUint32(40, n * ch * 2, true);
  const L = buf.getChannelData(0), R = ch > 1 ? buf.getChannelData(1) : L; let peak = 0, last = 0;
  for (let i = 0; i < n; i++) { const a = Math.max(-1, Math.min(1, L[i])), b = Math.max(-1, Math.min(1, R[i])); const m = Math.max(Math.abs(a), Math.abs(b)); if (m > peak) peak = m; if (m > 0.002) last = i; dv.setInt16(44 + i * 4, a * 32767, true); dv.setInt16(46 + i * 4, b * 32767, true); }
  let bin = ''; const u8 = new Uint8Array(dv.buffer); for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return { b64: btoa(bin), peak, len: last / sr };
}, [what, secs]);
const levels = {};
const jobs = [...Object.entries(SONGS).map(([k, s]) => [k, k, s]), ...SFX.map((k) => ['sfx:' + k, k, 2.5]), ['scratch', 'scratch', 1], ['steel', 'steel', 1.5]];
for (const [what, name, secs] of jobs) {
  const r = await render(what, secs);
  fs.writeFileSync(path.join(out, name + '.wav'), Buffer.from(r.b64, 'base64'));
  levels[name] = { peak: +r.peak.toFixed(4), len: +r.len.toFixed(3) };
  console.log(name.padEnd(10), 'peak', r.peak.toFixed(3), 'len', r.len.toFixed(2));
}
fs.writeFileSync(path.join(out, 'levels.json'), JSON.stringify(levels, null, 1));
console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'NO ERRORS');
await browser.close();
process.exitCode = errs.length ? 1 : 0;
