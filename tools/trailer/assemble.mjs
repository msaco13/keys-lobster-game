// Cuts the rendered shots together and lays the sound under them: the game's songs where timeline.mjs says, and every
// effect the game asked for while the shots were rendered (meta.json), at the frame it asked. Needs ffmpeg.
//   node tools/trailer/assemble.mjs <frames dir> <audio dir> <out.mp4> [--crf 18] [--preset slow]
import fs from 'fs'; import path from 'path'; import { execFileSync } from 'child_process';
import { TIMELINE, MUSIC } from './timeline.mjs';

const args = process.argv.slice(2), frames = path.resolve(args[0]), audio = path.resolve(args[1]), outFile = path.resolve(args[2]);
const opt = (k, d) => { const i = args.indexOf(k); return i < 0 ? d : args[i + 1]; };
const levels = JSON.parse(fs.readFileSync(path.join(audio, 'levels.json'), 'utf8'));
// how loud each effect sits in the mix (dB, after each file is brought to a common peak); the game's quiet UI ticks stay quiet
const GAIN = { click: -14, tick: -14, tickle: -16, bubble: -12, reel: -12, strip: -10, nibble: -10, plop: -6, cast: -5, swish: -5, net: -4, splash: -4, coin: -7, steel: -9,
  bigsplash: 0, woo: -1, dolphin: -2, found: -1, trophy: -1, catch: -2, slam: 0, horn: 0, siren: 1, chomp: 1, snap: 1, fail: -2, warn: -2, bite: -1, hookset: -1, sting: -3, bump: -2, slap: -4, gull: -6, bounty: -2, scratch: 2 };
const MUSIC_DB = -9, SFX_DB = -5;   // where the two buses sit before the final loudness pass
const fps = 30, cuts = [], lines = []; let t = 0;
const meta = {};
for (const id of TIMELINE) {
  const m = JSON.parse(fs.readFileSync(path.join(frames, id, 'meta.json'), 'utf8')); meta[id] = m;
  if (m.every !== 1) throw new Error(id + ' was rendered as a preview (every ' + m.every + ')');
  const files = fs.readdirSync(path.join(frames, id)).filter((f) => f.endsWith('.png')).sort();
  if (files.length !== m.frames) throw new Error(`${id}: ${files.length} frames on disk, ${m.frames} expected`);
  for (const f of files) lines.push(`file '${path.join(frames, id, f)}'`, `duration ${(1 / fps).toFixed(6)}`);
  cuts.push({ id, at: t, secs: m.secs, sfx: m.sfx }); t += m.frames / fps;
}
lines.push(lines[lines.length - 2]);   // the concat demuxer wants the last frame named twice
const total = t, list = path.join(frames, 'frames.txt'); fs.writeFileSync(list, lines.join('\n') + '\n');
const at = (id) => cuts.find((c) => c.id === id).at;
// the sound events, in trailer time
const events = [];
for (const c of cuts) for (const s of c.sfx) if (levels[s.name]) events.push({ name: s.name, t: c.at + s.f / fps, k: s.k == null ? 1 : s.k });
// the same effect fired again within a few frames is one effect (the game spams the reel and the tickle)
events.sort((a, b) => a.t - b.t);
const kept = []; const lastAt = {};
for (const e of events) { if (lastAt[e.name] != null && e.t - lastAt[e.name] < 0.09) continue; lastAt[e.name] = e.t; kept.push(e); }
const scratchAt = kept.find((e) => e.name === 'scratch'); if (!scratchAt) console.warn('no record scratch logged: the reef song will run into the title');
// ffmpeg inputs and the filter graph
const inputs = [], F = [], mixIns = [];
const addInput = (file) => { inputs.push('-i', file); return inputs.length / 2 - 1; };
const db = (v) => `${v.toFixed(2)}dB`, norm = (name, target) => target - 20 * Math.log10(Math.max(1e-4, levels[name].peak));   // dB to bring a file's peak to target dBFS
for (const [mi, M] of MUSIC.entries()) {
  const from = at(M.from), until = M.until === 'scratch' ? (scratchAt ? scratchAt.t : at('title')) : at(M.until) + (M.fadeOut || 0);
  const len = until - from; if (len <= 0) continue;
  const i = addInput(path.join(audio, M.song + '.wav')), lab = `m${mi}`;
  const fo = M.until === 'scratch' ? 0.03 : M.fadeOut || 0.01;
  F.push(`[${i}:a]atrim=0:${len.toFixed(3)},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=${(M.fadeIn || 0.01).toFixed(2)},afade=t=out:st=${Math.max(0, len - fo).toFixed(3)}:d=${fo.toFixed(2)},volume=${db(norm(M.song, -3) + MUSIC_DB + 20 * Math.log10(M.gain || 1))},adelay=${Math.round(from * 1000)}|${Math.round(from * 1000)}[${lab}]`);
  mixIns.push(lab);
}
const byName = {};
for (const e of kept) (byName[e.name] = byName[e.name] || []).push(e);
for (const [name, list] of Object.entries(byName)) {
  const i = addInput(path.join(audio, name + '.wav')), labs = list.map((e, k) => `s_${name}_${k}`);
  F.push(`[${i}:a]volume=${db(norm(name, -3) + SFX_DB + (GAIN[name] || 0))},asplit=${list.length}${labs.map((l) => `[${l}p]`).join('')}`);
  list.forEach((e, k) => { const ms = Math.round(e.t * 1000); F.push(`[${labs[k]}p]adelay=${ms}|${ms}${e.k !== 1 ? `,volume=${db(20 * Math.log10(Math.max(0.1, e.k)))}` : ''}[${labs[k]}]`); mixIns.push(labs[k]); });
}
F.push(`${mixIns.map((l) => `[${l}]`).join('')}amix=inputs=${mixIns.length}:normalize=0:dropout_transition=0,apad,atrim=0:${total.toFixed(3)},loudnorm=I=-14:TP=-1.5:LRA=11,alimiter=limit=0.95[aout]`);
const script = path.join(frames, 'audio.filter'); fs.writeFileSync(script, F.join(';\n'));
console.log(`${cuts.length} shots, ${total.toFixed(1)} s, ${kept.length} sound events (${events.length - kept.length} merged), ${mixIns.length} mix inputs`);
console.log(cuts.map((c) => `${c.at.toFixed(1).padStart(6)}  ${c.id}`).join('\n'));
execFileSync('ffmpeg', ['-y', '-v', 'error', '-stats', '-r', String(fps), '-f', 'concat', '-safe', '0', '-i', list, ...inputs, '-filter_complex_script', script, '-map', '0:v', '-map', '[aout]',
  '-fps_mode', 'cfr', '-r', String(fps), '-c:v', 'libx264', '-preset', opt('--preset', 'slow'), '-crf', opt('--crf', '18'), '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-shortest', outFile], { stdio: 'inherit' });
console.log('->', outFile);
