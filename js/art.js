'use strict';
/* Keys Crew — drawing: fish, lobsters, the crew, boats, scenery and the brag card. */

function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function mix(a, b, t) { const x = hexRgb(a), y = hexRgb(b); return `rgb(${Math.round(lerp(x[0], y[0], t))},${Math.round(lerp(x[1], y[1], t))},${Math.round(lerp(x[2], y[2], t))})`; }
function rgba(h, a) { const x = hexRgb(h); return `rgba(${x[0]},${x[1]},${x[2]},${a})`; }
function ell(ctx, x, y, rx, ry, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU); }

/* ================= FISH ================= */
const LOOKS = {
  yellowtail: { h: 0.3, back: '#56789f', mid: '#c4d2dc', belly: '#f4f1e6', fin: '#f0cb35', tail: 'fork', pat: 'yellowstripe', head: 'point', dorsal: 'normal' },
  mangrove: { h: 0.34, back: '#5e4d3f', mid: '#a5876b', belly: '#eadac6', fin: '#b0675a', tail: 'square', pat: 'none', head: 'point', dorsal: 'spiny' },
  mutton: { h: 0.35, back: '#7a874d', mid: '#d39e7a', belly: '#f3dccb', fin: '#e0745a', tail: 'fork', pat: 'blackspot', head: 'point', dorsal: 'spiny' },
  redgrouper: { h: 0.33, back: '#93452f', mid: '#b5654c', belly: '#e8b9a2', fin: '#7d3a2c', tail: 'square', pat: 'whitespots', head: 'round', dorsal: 'spiny', mouth: 'big' },
  blackgrouper: { h: 0.33, back: '#2b302f', mid: '#575d57', belly: '#a6a99e', fin: '#272b2a', tail: 'square', pat: 'blotch', head: 'round', dorsal: 'spiny', mouth: 'big' },
  amberjack: { h: 0.29, back: '#78715a', mid: '#c9b07a', belly: '#eeeae0', fin: '#857957', tail: 'fork', pat: 'amberstripe', head: 'point', dorsal: 'normal' },
  goliath: { h: 0.36, back: '#57472f', mid: '#86704e', belly: '#c6b289', fin: '#463826', tail: 'round', pat: 'mottle', head: 'round', dorsal: 'spiny', mouth: 'big' },
  mahi: { h: 0.27, back: '#1b8a58', mid: '#7fd14d', belly: '#f2e15a', fin: '#2a74c9', tail: 'fork', tailC: '#e3d447', pat: 'bluespots', head: 'blunt', dorsal: 'long' },
  blackfin: { h: 0.3, back: '#131f3c', mid: '#6d7f99', belly: '#e9edf1', fin: '#3b4660', tail: 'lunate', pat: 'tuna', head: 'point', dorsal: 'tuna', finlets: '#c9b56a' },
  wahoo: { h: 0.15, back: '#1b4f86', mid: '#7aa3c4', belly: '#e8eef2', fin: '#1b3f66', tail: 'lunate', pat: 'bars', head: 'long', dorsal: 'low', finlets: '#9ab6cc' },
  kingfish: { h: 0.17, back: '#3d5a73', mid: '#a7bccb', belly: '#eef2f4', fin: '#4e6577', tail: 'lunate', pat: 'none', head: 'long', dorsal: 'low', finlets: '#b8c6d0' },
  sailfish: { h: 0.2, back: '#1a3f78', mid: '#7e98bd', belly: '#eef1f4', fin: '#22408a', tail: 'lunate', pat: 'sailbars', head: 'bill', dorsal: 'sail' },
  bluemarlin: { h: 0.24, back: '#122c63', mid: '#5f7fae', belly: '#e9edf2', fin: '#1a3270', tail: 'lunate', pat: 'sailbars', head: 'bill', dorsal: 'marlin' },
  barracuda: { h: 0.15, back: '#4e5d63', mid: '#b9c3c6', belly: '#f0f2f2', fin: '#5a676c', tail: 'fork', pat: 'cuda', head: 'pike', dorsal: 'low', mouth: 'big' },
  bonefish: { h: 0.24, back: '#8fa59a', mid: '#d5ded8', belly: '#f6f8f6', fin: '#c4cec6', tail: 'fork', pat: 'bonelines', head: 'cone', dorsal: 'normal' },
  permit: { h: 0.55, back: '#6f7e86', mid: '#c4ccd0', belly: '#eef0ee', fin: '#1d2226', tail: 'fork', tailC: '#1d2226', pat: 'none', head: 'round', dorsal: 'sickle', eye: 0.06 },
  tarpon: { h: 0.26, back: '#4f6a70', mid: '#c5d0d4', belly: '#f2f4f4', fin: '#7d8f93', tail: 'fork', pat: 'scales', head: 'point', dorsal: 'tarpon', mouth: 'big', eye: 0.11 },
  redfish: { h: 0.28, back: '#9a5a2e', mid: '#c7884e', belly: '#efd7ba', fin: '#a8683e', tail: 'square', pat: 'tailspot', head: 'round', dorsal: 'spiny' },
  snook: { h: 0.22, back: '#6a6a4e', mid: '#c8c6b2', belly: '#efeee6', fin: '#d6c45a', tail: 'fork', pat: 'lateral', head: 'pike', dorsal: 'spiny', mouth: 'big' },
  trout: { h: 0.23, back: '#5f6e66', mid: '#b9c2bd', belly: '#eef0ec', fin: '#8b958e', tail: 'square', pat: 'spots', head: 'point', dorsal: 'normal' },
  whitegrunt: { h: 0.33, back: '#87939b', mid: '#c6ced2', belly: '#eef0ec', fin: '#c4b07a', tail: 'fork', pat: 'grunt', head: 'point', dorsal: 'spiny' },
  lane: { h: 0.32, back: '#c47a74', mid: '#f0b4a6', belly: '#f8e9e1', fin: '#f2c94c', tail: 'fork', tailC: '#e06b62', pat: 'lane', head: 'point', dorsal: 'spiny' },
  hogfish: { h: 0.42, back: '#9a4e5e', mid: '#e6b6ac', belly: '#f6ece6', fin: '#c97a7a', tail: 'square', tailC: '#b0606a', pat: 'hog', head: 'snout', dorsal: 'hog' },
  trigger: { h: 0.55, back: '#646a6d', mid: '#989ea0', belly: '#c6cac6', fin: '#767c7f', tail: 'fork', pat: 'trigger', head: 'round', dorsal: 'trigger', eye: 0.06 },
  cubera: { h: 0.35, back: '#43332f', mid: '#86655a', belly: '#c8a596', fin: '#57392f', tail: 'square', pat: 'none', head: 'point', dorsal: 'spiny', mouth: 'big' },
  cobia: { h: 0.2, back: '#382c25', mid: '#7a6a5a', belly: '#e8e2d6', fin: '#2c241e', tail: 'lunate', pat: 'cobia', head: 'long', dorsal: 'low', mouth: 'big' },
  pompano: { h: 0.56, back: '#8aa0ab', mid: '#d4dee3', belly: '#f2f5f6', fin: '#a4b4bc', tail: 'lunate', pat: 'none', head: 'blunt', dorsal: 'thread', eye: 0.07 },
  bonita: { h: 0.28, back: '#1c3d63', mid: '#a6bccb', belly: '#eef2f4', fin: '#294a6f', tail: 'lunate', pat: 'bonita', head: 'point', dorsal: 'tuna', finlets: '#5c7990' },
  tripletail: { h: 0.48, back: '#463a20', mid: '#87713f', belly: '#b6a068', fin: '#584829', tail: 'round', pat: 'mottle', head: 'round', dorsal: 'triple', eye: 0.07 },
  yellowfin: { h: 0.3, back: '#13234a', mid: '#7e8ea8', belly: '#eef1f4', fin: '#f0bf18', tail: 'lunate', pat: 'yellowfin', head: 'point', dorsal: 'yellowfin', finlets: '#f2d23a' },
  jack: { h: 0.36, back: '#3d575b', mid: '#b6c6b4', belly: '#eef0d6', fin: '#d6b23a', tail: 'fork', tailC: '#deb52e', pat: 'jack', head: 'blunt', dorsal: 'normal' },
  ladyfish: { h: 0.19, back: '#5b7889', mid: '#c8d7df', belly: '#f6f8f8', fin: '#9db1bb', tail: 'fork', pat: 'none', head: 'point', dorsal: 'normal', eye: 0.1 },
  blackdrum: { h: 0.4, back: '#2c2a28', mid: '#686460', belly: '#b7b2ab', fin: '#282624', tail: 'square', pat: 'drum', head: 'round', dorsal: 'spiny' },
  parrot: { h: 0.38, back: '#1e9c8c', mid: '#3fd0b6', belly: '#f49ac4', fin: '#f06ea8', tail: 'square', tailC: '#f2c13a', pat: 'scales', head: 'round', dorsal: 'normal' },
  angel: { h: 0.62, back: '#1f5fd1', mid: '#36a0e8', belly: '#f2d23c', fin: '#f2c12e', tail: 'round', tailC: '#f2d23c', pat: 'none', head: 'round', dorsal: 'sickle', eye: 0.06 }
};

function fishBodyPath(ctx, L, H, head) {
  const nx = L * 0.5, tb = -L * 0.3, th = H * 0.13;
  ctx.beginPath();
  if (head === 'blunt') {
    ctx.moveTo(nx, H * 0.08);
    ctx.bezierCurveTo(nx + L * 0.02, -H * 0.35, nx - L * 0.05, -H * 0.56, nx - L * 0.2, -H * 0.52);
    ctx.bezierCurveTo(nx - L * 0.42, -H * 0.44, tb + L * 0.12, -H * 0.2, tb, -th);
  } else if (head === 'round') {
    ctx.moveTo(nx, H * 0.06);
    ctx.bezierCurveTo(nx - L * 0.02, -H * 0.32, nx - L * 0.2, -H * 0.56, nx - L * 0.38, -H * 0.5);
    ctx.bezierCurveTo(nx - L * 0.56, -H * 0.44, tb + L * 0.1, -H * 0.22, tb, -th);
  } else if (head === 'snout') {
    ctx.moveTo(nx, H * 0.04);
    ctx.bezierCurveTo(nx - L * 0.07, -H * 0.02, nx - L * 0.1, -H * 0.52, nx - L * 0.3, -H * 0.56);
    ctx.bezierCurveTo(nx - L * 0.52, -H * 0.5, tb + L * 0.1, -H * 0.22, tb, -th);
  } else {
    const k = head === 'long' || head === 'pike' || head === 'bill' ? 0.2 : head === 'cone' ? 0.3 : 0.38;
    ctx.moveTo(nx, 0);
    ctx.bezierCurveTo(nx - L * 0.1, -H * k, nx - L * 0.28, -H * 0.52, nx - L * 0.42, -H * 0.5);
    ctx.bezierCurveTo(nx - L * 0.6, -H * 0.46, tb + L * 0.1, -H * 0.2, tb, -th);
  }
  ctx.lineTo(tb, th);
  ctx.bezierCurveTo(tb + L * 0.15, H * 0.3, nx - L * 0.45, H * 0.52, nx - L * 0.25, H * 0.45);
  ctx.bezierCurveTo(nx - L * 0.12, H * 0.38, nx - L * 0.02, H * 0.2, nx, head === 'blunt' || head === 'round' ? H * 0.06 : head === 'snout' ? H * 0.04 : 0);
  ctx.closePath();
}
function fishTailPath(ctx, L, H, type, swing) {
  ctx.save(); ctx.translate(-L * 0.29, 0); ctx.rotate(swing);
  const tl = L * 0.22, th = H * (type === 'lunate' ? 0.8 : 0.62);
  ctx.beginPath();
  if (type === 'fork') {
    ctx.moveTo(0, -H * 0.1); ctx.quadraticCurveTo(-tl * 0.5, -th * 0.55, -tl, -th);
    ctx.quadraticCurveTo(-tl * 0.62, -th * 0.3, -tl * 0.55, 0); ctx.quadraticCurveTo(-tl * 0.62, th * 0.3, -tl, th);
    ctx.quadraticCurveTo(-tl * 0.5, th * 0.55, 0, H * 0.1);
  } else if (type === 'lunate') {
    ctx.moveTo(0, -H * 0.06); ctx.quadraticCurveTo(-tl * 0.35, -th * 0.45, -tl * 0.95, -th);
    ctx.quadraticCurveTo(-tl * 0.55, -th * 0.22, -tl * 0.48, 0); ctx.quadraticCurveTo(-tl * 0.55, th * 0.22, -tl * 0.95, th);
    ctx.quadraticCurveTo(-tl * 0.35, th * 0.45, 0, H * 0.06);
  } else if (type === 'round') {
    ctx.moveTo(0, -H * 0.15); ctx.quadraticCurveTo(-tl * 0.95, -th * 0.8, -tl * 0.85, 0); ctx.quadraticCurveTo(-tl * 0.95, th * 0.8, 0, H * 0.15);
  } else {
    ctx.moveTo(0, -H * 0.12); ctx.lineTo(-tl * 0.8, -th * 0.66); ctx.quadraticCurveTo(-tl * 0.92, 0, -tl * 0.8, th * 0.66); ctx.lineTo(0, H * 0.12);
  }
  ctx.closePath(); ctx.restore();
}
function fishFins(ctx, L, H, lk, sil) {
  const fc = sil || lk.fin; const d = lk.dorsal;
  ctx.fillStyle = fc; ctx.beginPath();
  if (d === 'normal') { ctx.moveTo(L * 0.12, -H * 0.44); ctx.quadraticCurveTo(L * 0.0, -H * 0.86, -L * 0.14, -H * 0.62); ctx.lineTo(-L * 0.2, -H * 0.3); }
  else if (d === 'spiny') {
    ctx.moveTo(L * 0.2, -H * 0.42); const n = 9;
    for (let i = 0; i <= n; i++) ctx.lineTo(L * 0.2 - (L * 0.43 * i) / n, -H * (0.66 + (i % 2 ? -0.07 : 0.05)));
    ctx.lineTo(-L * 0.25, -H * 0.24);
  } else if (d === 'long') { ctx.moveTo(L * 0.36, -H * 0.46); ctx.quadraticCurveTo(L * 0.3, -H * 0.8, L * 0.14, -H * 0.74); ctx.quadraticCurveTo(-L * 0.12, -H * 0.62, -L * 0.27, -H * 0.32); ctx.lineTo(-L * 0.25, -H * 0.12); }
  else if (d === 'sail') { ctx.moveTo(L * 0.33, -H * 0.38); ctx.bezierCurveTo(L * 0.3, -H * 2.3, -L * 0.06, -H * 2.1, -L * 0.13, -H * 0.9); ctx.quadraticCurveTo(-L * 0.16, -H * 0.5, -L * 0.2, -H * 0.3); }
  else if (d === 'marlin') { ctx.moveTo(L * 0.3, -H * 0.4); ctx.quadraticCurveTo(L * 0.27, -H * 1.3, L * 0.18, -H * 1.18); ctx.quadraticCurveTo(L * 0.08, -H * 0.6, -L * 0.15, -H * 0.42); ctx.lineTo(-L * 0.2, -H * 0.28); }
  else if (d === 'tuna') { ctx.moveTo(L * 0.16, -H * 0.45); ctx.quadraticCurveTo(L * 0.08, -H * 0.86, -L * 0.02, -H * 0.47); ctx.moveTo(-L * 0.06, -H * 0.44); ctx.quadraticCurveTo(-L * 0.1, -H * 0.98, -L * 0.15, -H * 0.36); }
  else if (d === 'sickle') { ctx.moveTo(L * 0.02, -H * 0.46); ctx.quadraticCurveTo(-L * 0.02, -H * 0.82, -L * 0.2, -H * 0.86); ctx.quadraticCurveTo(-L * 0.12, -H * 0.62, -L * 0.2, -H * 0.26); }
  else if (d === 'tarpon') { ctx.moveTo(L * 0.03, -H * 0.46); ctx.quadraticCurveTo(-L * 0.01, -H * 0.96, -L * 0.07, -H * 0.96); ctx.lineTo(-L * 0.24, -H * 1.0); ctx.lineTo(-L * 0.1, -H * 0.76); ctx.lineTo(-L * 0.12, -H * 0.4); }
  else if (d === 'hog') { ctx.moveTo(L * 0.2, -H * 0.42); ctx.quadraticCurveTo(L * 0.0, -H * 0.7, -L * 0.24, -H * 0.36); ctx.lineTo(-L * 0.25, -H * 0.2); }
  else if (d === 'trigger') { ctx.moveTo(L * 0.12, -H * 0.42); ctx.lineTo(L * 0.06, -H * 0.86); ctx.lineTo(L * 0.0, -H * 0.46); ctx.moveTo(-L * 0.04, -H * 0.46); ctx.quadraticCurveTo(-L * 0.12, -H * 0.82, -L * 0.24, -H * 0.3); ctx.lineTo(-L * 0.22, -H * 0.2); }
  else if (d === 'thread') { ctx.moveTo(L * 0.06, -H * 0.46); ctx.quadraticCurveTo(-L * 0.02, -H * 0.7, -L * 0.22, -H * 0.3); ctx.lineTo(-L * 0.2, -H * 0.18); }
  else if (d === 'triple') { ctx.moveTo(L * 0.08, -H * 0.44); ctx.quadraticCurveTo(-L * 0.06, -H * 0.62, -L * 0.18, -H * 0.86); ctx.quadraticCurveTo(-L * 0.32, -H * 0.82, -L * 0.3, -H * 0.2); }
  else if (d === 'yellowfin') { ctx.moveTo(L * 0.16, -H * 0.45); ctx.quadraticCurveTo(L * 0.08, -H * 0.8, -L * 0.02, -H * 0.47); ctx.moveTo(-L * 0.05, -H * 0.44); ctx.quadraticCurveTo(-L * 0.12, -H * 1.5, -L * 0.2, -H * 1.62); ctx.quadraticCurveTo(-L * 0.14, -H * 0.8, -L * 0.15, -H * 0.36); }
  else { ctx.moveTo(L * 0.05, -H * 0.46); ctx.quadraticCurveTo(-L * 0.08, -H * 0.76, -L * 0.22, -H * 0.42); ctx.lineTo(-L * 0.24, -H * 0.2); }
  ctx.closePath(); ctx.fill();
  if (d === 'hog') { ctx.strokeStyle = fc; ctx.lineWidth = Math.max(1, L * 0.012); ctx.lineCap = 'round'; for (let i = 0; i < 3; i++) { const x = L * (0.2 - i * 0.05); ctx.beginPath(); ctx.moveTo(x, -H * 0.44); ctx.quadraticCurveTo(x - L * 0.02, -H * 0.8, x - L * 0.08, -H * (1.0 - i * 0.08)); ctx.stroke(); } }
  if (d === 'thread') { ctx.strokeStyle = fc; ctx.lineWidth = Math.max(0.8, L * 0.006); for (const s2 of [-1, 1]) { ctx.beginPath(); ctx.moveTo(-L * 0.08, s2 * H * 0.56); ctx.quadraticCurveTo(-L * 0.24, s2 * H * 0.78, -L * 0.46, s2 * H * 0.66); ctx.stroke(); } }
  ctx.beginPath();
  if (d === 'sickle') { ctx.moveTo(0, H * 0.42); ctx.quadraticCurveTo(-L * 0.06, H * 0.8, -L * 0.2, H * 0.8); ctx.quadraticCurveTo(-L * 0.12, H * 0.58, -L * 0.2, H * 0.24); }
  else if (d === 'long') { ctx.moveTo(L * 0.02, H * 0.42); ctx.quadraticCurveTo(-L * 0.12, H * 0.62, -L * 0.27, H * 0.3); ctx.lineTo(-L * 0.25, H * 0.12); }
  else if (d === 'tuna') { ctx.moveTo(-L * 0.06, H * 0.42); ctx.quadraticCurveTo(-L * 0.1, H * 0.92, -L * 0.15, H * 0.34); }
  else if (d === 'yellowfin') { ctx.moveTo(-L * 0.05, H * 0.42); ctx.quadraticCurveTo(-L * 0.12, H * 1.45, -L * 0.2, H * 1.55); ctx.quadraticCurveTo(-L * 0.14, H * 0.8, -L * 0.15, H * 0.34); }
  else if (d === 'triple') { ctx.moveTo(-L * 0.02, H * 0.42); ctx.quadraticCurveTo(-L * 0.14, H * 0.6, -L * 0.18, H * 0.84); ctx.quadraticCurveTo(-L * 0.32, H * 0.8, -L * 0.3, H * 0.2); }
  else if (d === 'trigger') { ctx.moveTo(-L * 0.04, H * 0.44); ctx.quadraticCurveTo(-L * 0.12, H * 0.78, -L * 0.24, H * 0.3); ctx.lineTo(-L * 0.22, H * 0.2); }
  else { ctx.moveTo(-L * 0.06, H * 0.4); ctx.quadraticCurveTo(-L * 0.12, H * 0.74, -L * 0.2, H * 0.5); ctx.lineTo(-L * 0.22, H * 0.2); }
  ctx.closePath(); ctx.fill();
  if (lk.finlets) {
    ctx.fillStyle = sil || lk.finlets;
    for (let i = 0; i < 5; i++) {
      const x = -L * 0.17 - i * L * 0.024;
      ctx.beginPath(); ctx.moveTo(x, -H * 0.24 + i * H * 0.02); ctx.lineTo(x - L * 0.02, -H * 0.36 + i * H * 0.04); ctx.lineTo(x - L * 0.018, -H * 0.2 + i * H * 0.02); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x, H * 0.24 - i * H * 0.02); ctx.lineTo(x - L * 0.02, H * 0.36 - i * H * 0.04); ctx.lineTo(x - L * 0.018, H * 0.2 - i * H * 0.02); ctx.fill();
    }
  }
  ctx.fillStyle = fc; ctx.beginPath(); ctx.moveTo(L * 0.18, H * 0.36); ctx.quadraticCurveTo(L * 0.1, H * 0.72, L * 0.04, H * 0.62); ctx.lineTo(L * 0.08, H * 0.36); ctx.closePath(); ctx.fill();
}
function fishPattern(ctx, key, lk, L, H) {
  const rng = mulberry(hashStr(key)); const p = lk.pat;
  const dots = (n, color, r, y0, y1, x0 = -L * 0.27, x1 = L * 0.38) => { ctx.fillStyle = color; for (let i = 0; i < n; i++) { ctx.beginPath(); ctx.arc(lerp(x0, x1, rng()), lerp(y0, y1, rng()), r * (0.6 + rng() * 0.6), 0, TAU); ctx.fill(); } };
  if (p === 'yellowstripe') {
    ctx.fillStyle = '#f4d23c'; ctx.beginPath();
    ctx.moveTo(L * 0.47, -H * 0.02); ctx.quadraticCurveTo(0, -H * 0.14, -L * 0.32, -H * 0.06); ctx.lineTo(-L * 0.32, H * 0.05); ctx.quadraticCurveTo(0, -H * 0.01, L * 0.47, H * 0.05); ctx.fill();
    dots(14, '#f4d23c', H * 0.035, -H * 0.42, -H * 0.2, -L * 0.22, L * 0.28);
  } else if (p === 'bluespots') { dots(26, '#1f73cf', H * 0.04, -H * 0.42, H * 0.1); }
  else if (p === 'bars' || p === 'sailbars') {
    ctx.fillStyle = p === 'bars' ? 'rgba(18,40,92,0.6)' : 'rgba(150,205,255,0.45)';
    for (let i = 0; i < 14; i++) { const x = L * 0.32 - i * L * 0.046; ctx.fillRect(x, -H * 0.5, L * 0.015, H * 0.78); }
  } else if (p === 'blotch') {
    ctx.fillStyle = 'rgba(12,14,14,0.38)';
    for (let i = 0; i < 10; i++) { rr(ctx, lerp(-L * 0.25, L * 0.3, rng()), lerp(-H * 0.45, H * 0.2, rng()), H * (0.18 + rng() * 0.16), H * (0.12 + rng() * 0.12), H * 0.06); ctx.fill(); }
  } else if (p === 'whitespots') { dots(30, 'rgba(255,238,226,0.6)', H * 0.028, -H * 0.45, H * 0.3); }
  else if (p === 'mottle') { dots(16, 'rgba(40,28,14,0.35)', H * 0.12, -H * 0.45, H * 0.35); dots(40, 'rgba(25,18,10,0.6)', H * 0.022, -H * 0.45, H * 0.35); }
  else if (p === 'tuna') {
    ctx.fillStyle = 'rgba(214,176,70,0.35)'; ctx.beginPath(); ctx.moveTo(L * 0.4, -H * 0.12); ctx.quadraticCurveTo(0, -H * 0.2, -L * 0.3, -H * 0.06); ctx.lineTo(-L * 0.3, 0); ctx.quadraticCurveTo(0, -H * 0.08, L * 0.4, -H * 0.04); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; for (let i = 0; i < 10; i++) { const x = L * 0.2 - i * L * 0.045; ctx.beginPath(); ctx.moveTo(x, H * 0.08); ctx.lineTo(x - L * 0.01, H * 0.38); ctx.stroke(); }
  } else if (p === 'amberstripe') {
    ctx.fillStyle = 'rgba(217,166,58,0.8)'; ctx.beginPath(); ctx.moveTo(L * 0.44, -H * 0.06); ctx.quadraticCurveTo(0, -H * 0.12, -L * 0.3, -H * 0.04); ctx.lineTo(-L * 0.3, H * 0.03); ctx.quadraticCurveTo(0, -H * 0.03, L * 0.44, H * 0.02); ctx.fill();
    ctx.strokeStyle = 'rgba(40,30,20,0.55)'; ctx.lineWidth = H * 0.09; ctx.beginPath(); ctx.moveTo(L * 0.34, -H * 0.42); ctx.lineTo(L * 0.44, H * 0.0); ctx.stroke();
  } else if (p === 'blackspot') {
    ctx.fillStyle = '#1b1b1b'; ell(ctx, -L * 0.03, -H * 0.12, H * 0.08, H * 0.065); ctx.fill();
    ctx.strokeStyle = 'rgba(70,160,220,0.8)'; ctx.lineWidth = H * 0.025; ctx.beginPath(); ctx.moveTo(L * 0.44, H * 0.02); ctx.lineTo(L * 0.33, H * 0.12); ctx.moveTo(L * 0.46, -H * 0.06); ctx.lineTo(L * 0.34, 0); ctx.stroke();
  } else if (p === 'tailspot') {
    ctx.fillStyle = '#141414'; ell(ctx, -L * 0.24, -H * 0.06, H * 0.11, H * 0.11); ctx.fill();
    ctx.strokeStyle = 'rgba(255,230,190,0.6)'; ctx.lineWidth = H * 0.025; ctx.stroke();
  } else if (p === 'lateral') {
    ctx.strokeStyle = '#1b1b1b'; ctx.lineWidth = H * 0.04; ctx.beginPath(); ctx.moveTo(L * 0.33, -H * 0.12); ctx.quadraticCurveTo(0, -H * 0.06, -L * 0.33, 0); ctx.stroke();
  } else if (p === 'scales') {
    ctx.strokeStyle = 'rgba(110,130,140,0.4)'; ctx.lineWidth = Math.max(0.8, L * 0.004);
    const sz = H * 0.16;
    for (let row = -2; row <= 2; row++) for (let x = L * 0.26; x > -L * 0.32; x -= sz * 1.1) { ctx.beginPath(); ctx.arc(x + (row % 2) * sz * 0.5, row * sz * 1.1, sz * 0.7, -Math.PI / 2, Math.PI / 2); ctx.stroke(); }
  } else if (p === 'spots') { dots(36, 'rgba(25,28,30,0.85)', H * 0.03, -H * 0.42, H * 0.05); }
  else if (p === 'cuda') {
    ctx.strokeStyle = 'rgba(40,50,56,0.5)'; ctx.lineWidth = H * 0.08;
    for (let i = 0; i < 14; i++) { const x = L * 0.28 - i * L * 0.042; ctx.beginPath(); ctx.moveTo(x, -H * 0.5); ctx.lineTo(x - L * 0.025, -H * 0.12); ctx.stroke(); }
    dots(8, '#1b1b1b', H * 0.05, H * 0.05, H * 0.3, -L * 0.28, -L * 0.05);
  } else if (p === 'grunt') {
    ctx.strokeStyle = 'rgba(70,140,220,0.75)'; ctx.lineWidth = H * 0.035;
    for (let i = 0; i < 4; i++) { const y = -H * 0.3 + i * H * 0.1; ctx.beginPath(); ctx.moveTo(L * 0.5, y + H * 0.06); ctx.quadraticCurveTo(L * 0.4, y, L * 0.28, y + H * 0.02); ctx.stroke(); }
    dots(40, 'rgba(196,160,90,0.55)', H * 0.03, -H * 0.4, H * 0.2, -L * 0.25, L * 0.25);
  } else if (p === 'lane') {
    ctx.strokeStyle = 'rgba(242,201,76,0.85)'; ctx.lineWidth = H * 0.04;
    for (let i = 0; i < 5; i++) { const y = -H * 0.28 + i * H * 0.1; ctx.beginPath(); ctx.moveTo(L * 0.42, y); ctx.quadraticCurveTo(0, y - H * 0.05, -L * 0.3, y * 0.6); ctx.stroke(); }
    ctx.fillStyle = '#1b1b1b'; ell(ctx, -L * 0.06, -H * 0.14, H * 0.09, H * 0.08); ctx.fill();
  } else if (p === 'hog') {
    ctx.fillStyle = 'rgba(90,30,40,0.55)'; ctx.beginPath(); ctx.moveTo(L * 0.52, -H * 0.1); ctx.quadraticCurveTo(L * 0.3, -H * 0.62, L * 0.12, -H * 0.5); ctx.lineTo(L * 0.2, H * 0.1); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#1b1b1b'; ell(ctx, L * 0.04, -H * 0.38, H * 0.06, H * 0.05); ctx.fill();
  } else if (p === 'trigger') {
    ctx.fillStyle = 'rgba(40,44,48,0.28)'; for (let i = 0; i < 3; i++) { const x = L * (0.2 - i * 0.18); ctx.fillRect(x, -H * 0.5, L * 0.08, H); }
    ctx.strokeStyle = 'rgba(120,170,220,0.45)'; ctx.lineWidth = H * 0.02; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(L * 0.48, -H * 0.1 + i * H * 0.08); ctx.lineTo(L * 0.28, -H * 0.2 + i * H * 0.08); ctx.stroke(); }
  } else if (p === 'cobia') {
    ctx.fillStyle = 'rgba(20,16,12,0.75)'; ctx.beginPath(); ctx.moveTo(L * 0.46, -H * 0.06); ctx.quadraticCurveTo(0, -H * 0.16, -L * 0.32, -H * 0.04); ctx.lineTo(-L * 0.32, H * 0.06); ctx.quadraticCurveTo(0, -H * 0.02, L * 0.46, H * 0.06); ctx.fill();
    ctx.strokeStyle = 'rgba(240,236,224,0.5)'; ctx.lineWidth = H * 0.05; ctx.beginPath(); ctx.moveTo(L * 0.42, -H * 0.2); ctx.quadraticCurveTo(0, -H * 0.28, -L * 0.3, -H * 0.16); ctx.stroke();
  } else if (p === 'bonita') {
    ctx.strokeStyle = 'rgba(16,34,60,0.75)'; ctx.lineWidth = H * 0.045;
    for (let i = 0; i < 9; i++) { const x = L * 0.1 - i * L * 0.045; ctx.beginPath(); ctx.moveTo(x, -H * 0.46); ctx.quadraticCurveTo(x - L * 0.03, -H * 0.3, x + L * 0.01, -H * 0.16); ctx.stroke(); }
    dots(5, '#1b1b1b', H * 0.04, H * 0.05, H * 0.18, L * 0.12, L * 0.24);
  } else if (p === 'yellowfin') {
    ctx.fillStyle = 'rgba(240,200,40,0.6)'; ctx.beginPath(); ctx.moveTo(L * 0.42, -H * 0.12); ctx.quadraticCurveTo(0, -H * 0.2, -L * 0.3, -H * 0.06); ctx.lineTo(-L * 0.3, 0); ctx.quadraticCurveTo(0, -H * 0.1, L * 0.42, -H * 0.04); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1; for (let i = 0; i < 10; i++) { const x = L * 0.2 - i * L * 0.045; ctx.beginPath(); ctx.moveTo(x, H * 0.08); ctx.lineTo(x - L * 0.01, H * 0.38); ctx.stroke(); }
  } else if (p === 'jack') {
    ctx.fillStyle = '#141414'; ell(ctx, L * 0.3, -H * 0.12, H * 0.07, H * 0.06); ctx.fill();
    ctx.fillStyle = 'rgba(230,200,60,0.35)'; ctx.fillRect(-L * 0.3, H * 0.1, L * 0.6, H * 0.3);
  } else if (p === 'drum') {
    ctx.fillStyle = 'rgba(15,14,13,0.3)'; for (let i = 0; i < 4; i++) { const x = L * (0.22 - i * 0.14); ctx.fillRect(x, -H * 0.5, L * 0.06, H * 0.9); }
    ctx.strokeStyle = 'rgba(40,36,32,0.8)'; ctx.lineWidth = Math.max(0.8, L * 0.006); for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(L * (0.42 + i * 0.012), H * 0.2); ctx.lineTo(L * (0.42 + i * 0.012), H * 0.32); ctx.stroke(); }
  } else if (p === 'bonelines') {
    ctx.strokeStyle = 'rgba(60,85,75,0.35)'; ctx.lineWidth = H * 0.025;
    for (let i = 0; i < 5; i++) { const y = -H * 0.38 + i * H * 0.09; ctx.beginPath(); ctx.moveTo(L * 0.3, y); ctx.lineTo(-L * 0.3, y * 0.5); ctx.stroke(); }
  }
}
function drawFish(ctx, key, len, o = {}) {
  const lk = LOOKS[key] || LOOKS.yellowtail;
  const L = len, H = L * lk.h, t = o.t || 0;
  const swing = Math.sin(t * (o.speed || 9)) * 0.22 * (o.wig == null ? 1 : o.wig);
  ctx.save();
  if (o.flip) ctx.scale(-1, 1);
  if (o.alpha != null) ctx.globalAlpha *= o.alpha;
  const sil = o.sil;
  fishTailPath(ctx, L, H, lk.tail, swing); ctx.fillStyle = sil || lk.tailC || lk.fin; ctx.fill();
  fishFins(ctx, L, H, lk, sil);
  if (lk.head === 'bill') { ctx.fillStyle = sil || lk.back; ctx.beginPath(); ctx.moveTo(L * 0.46, -H * 0.1); ctx.lineTo(L * 0.8, -H * 0.02); ctx.lineTo(L * 0.46, H * 0.05); ctx.fill(); }
  fishBodyPath(ctx, L, H, lk.head);
  if (sil) { ctx.fillStyle = sil; ctx.fill(); ctx.restore(); return; }
  const g = ctx.createLinearGradient(0, -H * 0.5, 0, H * 0.5);
  g.addColorStop(0, lk.back); g.addColorStop(0.52, lk.mid); g.addColorStop(1, lk.belly);
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.clip(); fishPattern(ctx, key, lk, L, H);
  ctx.fillStyle = 'rgba(255,255,255,0.13)'; ell(ctx, L * 0.05, -H * 0.24, L * 0.3, H * 0.08); ctx.fill();
  ctx.restore();
  fishBodyPath(ctx, L, H, lk.head); ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = Math.max(0.8, L * 0.007); ctx.stroke();
  // gill line
  ctx.beginPath(); ctx.arc(L * 0.3 + H * 0.45, 0, H * 0.45, Math.PI * 0.74, Math.PI * 1.26); ctx.stroke();
  // pectoral fin
  ctx.fillStyle = rgba(lk.fin.startsWith('#') ? lk.fin : '#888888', 0.85);
  ctx.beginPath(); ctx.moveTo(L * 0.27, H * 0.04); ctx.quadraticCurveTo(L * 0.14, H * 0.08, L * 0.08, H * 0.24); ctx.quadraticCurveTo(L * 0.18, H * 0.16, L * 0.28, H * 0.12); ctx.fill();
  // eye
  const ex = lk.head === 'blunt' ? L * 0.43 : lk.head === 'round' ? L * 0.39 : L * 0.4;
  const ey = lk.head === 'blunt' ? H * 0.0 : -H * 0.1; const er = Math.max(1.2, H * (lk.eye || 0.085));
  ctx.fillStyle = '#f6f6ee'; ell(ctx, ex, ey, er, er); ctx.fill();
  ctx.fillStyle = '#111'; ell(ctx, ex + er * 0.12, ey, er * 0.62, er * 0.62); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.8)'; ell(ctx, ex + er * 0.3, ey - er * 0.25, er * 0.2, er * 0.2); ctx.fill();
  // mouth
  ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = Math.max(0.8, L * 0.008); ctx.beginPath();
  if (lk.mouth === 'big') { ctx.moveTo(L * 0.5, -H * 0.02); ctx.lineTo(L * 0.4, H * 0.12); } else { ctx.moveTo(L * 0.5, H * 0.03); ctx.lineTo(L * 0.44, H * 0.06); }
  ctx.stroke();
  ctx.restore();
}

// Top-down fish (shadows on the flats, shapes under the trolling spread)
const TOPLOOK = {
  bonefish: { back: '#9fb3a8', edge: '#e8f2ec', tail: '#a8bcb2', wide: 0.2 },
  permit: { back: '#5b666c', edge: '#cfd6d9', tail: '#15191c', wide: 0.34, fins: '#15191c' },
  tarpon: { back: '#3f5458', edge: '#c9d6da', tail: '#4a5f63', wide: 0.2 },
  redfish: { back: '#9a5a2e', edge: '#e2b483', tail: '#7e4a26', wide: 0.22, spot: true },
  snook: { back: '#5e5e48', edge: '#d9d7c2', tail: '#5a5a42', wide: 0.17, line: true },
  trout: { back: '#56645c', edge: '#c9d1cc', tail: '#56645c', wide: 0.18 },
  jack: { back: '#4a6266', edge: '#d8e2cf', tail: '#c9a83a', wide: 0.26 },
  ladyfish: { back: '#6d8796', edge: '#e6eef2', tail: '#7b93a0', wide: 0.15 },
  blackdrum: { back: '#33302d', edge: '#8a847c', tail: '#2c2a28', wide: 0.3 },
  mangrove: { back: '#5a4a3c', edge: '#c9b29a', tail: '#9a5a4a', wide: 0.24 },
  tripletail: { back: '#5a4a28', edge: '#b9a26a', tail: '#5a4a28', wide: 0.36 },
  shadow: { back: '#06263a', edge: '#0b3550', tail: '#06263a', wide: 0.22 }
};
function drawFishTop(ctx, len, look, t, o = {}) {
  const lk = typeof look === 'string' ? TOPLOOK[look] : look;
  const L = len, Wd = L * (lk.wide || 0.22);
  const sw = Math.sin(t * (o.speed || 8)) * (o.amp == null ? 0.35 : o.amp);
  ctx.save();
  ctx.save(); ctx.translate(-L * 0.36, 0); ctx.rotate(sw);
  ctx.fillStyle = lk.tail; ctx.beginPath(); ctx.moveTo(L * 0.04, 0); ctx.lineTo(-L * 0.2, -Wd * 0.95); ctx.quadraticCurveTo(-L * 0.12, 0, -L * 0.2, Wd * 0.95); ctx.closePath(); ctx.fill();
  ctx.restore();
  if (lk.fins) { ctx.fillStyle = lk.fins; ctx.beginPath(); ctx.moveTo(L * 0.1, -Wd * 0.4); ctx.lineTo(-L * 0.1, -Wd * 1.1); ctx.lineTo(-L * 0.05, -Wd * 0.4); ctx.moveTo(L * 0.1, Wd * 0.4); ctx.lineTo(-L * 0.1, Wd * 1.1); ctx.lineTo(-L * 0.05, Wd * 0.4); ctx.fill(); }
  ctx.fillStyle = lk.back; ctx.beginPath();
  ctx.moveTo(L * 0.5, 0);
  ctx.bezierCurveTo(L * 0.46, -Wd * 0.55, L * 0.16, -Wd * 0.62, -L * 0.04, -Wd * 0.52);
  ctx.bezierCurveTo(-L * 0.22, -Wd * 0.4, -L * 0.34, -Wd * 0.16, -L * 0.38, 0);
  ctx.bezierCurveTo(-L * 0.34, Wd * 0.16, -L * 0.22, Wd * 0.4, -L * 0.04, Wd * 0.52);
  ctx.bezierCurveTo(L * 0.16, Wd * 0.62, L * 0.46, Wd * 0.55, L * 0.5, 0);
  ctx.fill();
  if (lk.edge && !o.flat) { ctx.strokeStyle = lk.edge; ctx.globalAlpha *= 0.5; ctx.lineWidth = Math.max(1, L * 0.02); ctx.stroke(); ctx.globalAlpha /= 0.5; }
  if (lk.line) { ctx.strokeStyle = 'rgba(10,10,10,0.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(L * 0.4, 0); ctx.lineTo(-L * 0.36, 0); ctx.stroke(); }
  if (lk.spot) { ctx.fillStyle = '#111'; ell(ctx, -L * 0.3, 0, Wd * 0.18, Wd * 0.18); ctx.fill(); }
  ctx.restore();
}

/* ================= LOBSTERS ================= */
const LOBPAL = {
  normal: { a1: '#d48a45', a2: '#6e3a1b', leg: '#8a3a1c', legS: '#e6b25a', t1: '#a9502a', t2: '#b85d2e', spot: '#f0cf7e', fan: '#c8722f', fanE: '#f2c14e', c1: '#c4632d', c2: '#7a3317', cm: '#cc6a2f', dark: '#5c2510', horn: '#7a3317', speck: 'rgba(245,214,150,0.65)' },
  gold: { a1: '#ffe07a', a2: '#a8741a', leg: '#b8860b', legS: '#fff1a8', t1: '#e0aa22', t2: '#f0c03a', spot: '#fff6c8', fan: '#f2c23a', fanE: '#fff4b0', c1: '#ffd34d', c2: '#b07a10', cm: '#ffd85a', dark: '#8a5a06', horn: '#b07a10', speck: 'rgba(255,250,210,0.8)' }
};
function drawAntenna(ctx, x, y, len, ang, w, bend = -1, LP = LOBPAL.normal) {
  const n = 20; let px = x, py = y;
  const cx = x + Math.cos(ang) * len * 0.5 + Math.cos(ang + Math.PI / 2) * len * 0.14 * bend;
  const cy = y + Math.sin(ang) * len * 0.5 + Math.sin(ang + Math.PI / 2) * len * 0.14 * bend;
  const ex = x + Math.cos(ang) * len, ey = y + Math.sin(ang) * len;
  ctx.lineCap = 'round';
  for (let i = 1; i <= n; i++) {
    const t = i / n, u = 1 - t;
    const qx = u * u * x + 2 * u * t * cx + t * t * ex, qy = u * u * y + 2 * u * t * cy + t * t * ey;
    ctx.strokeStyle = i % 2 ? LP.a1 : LP.a2; ctx.lineWidth = Math.max(0.6, w * (1 - t * 0.85));
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(qx, qy); ctx.stroke(); px = qx; py = qy;
  }
}
function drawLobsterSide(ctx, len, o = {}) {
  const L = len, t = o.t || 0, curl = o.curl || 0, LP = o.gold ? LOBPAL.gold : LOBPAL.normal;
  ctx.save(); if (o.flip) ctx.scale(-1, 1);
  if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = 18; }
  // tense: the warning before a twitch, both antennae held stiff and shivering
  const aw = o.tense ? -0.2 + Math.sin(t * 70) * 0.05 : Math.sin(t * 2.2) * 0.1 + (o.twitch || 0);
  drawAntenna(ctx, L * 0.46, -L * 0.06, L * 1.55, -0.32 - aw, L * 0.04, -1, LP);
  drawAntenna(ctx, L * 0.44, -L * 0.09, L * 1.35, -0.62 + aw * 0.7, L * 0.035, -1, LP);
  ctx.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    const lx = L * 0.4 - i * L * 0.075; const ph = Math.sin(t * 9 + i * 1.3) * (o.walk ? 0.35 : 0.04);
    const kx = lx + L * 0.03 + Math.cos(1.1 + ph) * L * 0.05, ky = L * 0.08 + Math.sin(1.1 + ph) * L * 0.06;
    const fx = kx + Math.cos(1.6 + ph) * L * 0.08, fy = ky + L * 0.09;
    ctx.strokeStyle = LP.leg; ctx.lineWidth = L * 0.022; ctx.beginPath(); ctx.moveTo(lx, L * 0.05); ctx.lineTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke();
    ctx.strokeStyle = LP.legS; ctx.lineWidth = L * 0.01; ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo((kx + fx) / 2, (ky + fy) / 2); ctx.stroke();
  }
  ctx.save(); ctx.translate(L * 0.04, -L * 0.01);
  for (let i = 0; i < 6; i++) {
    ctx.rotate(-curl * 0.34);
    const w = L * 0.082, h = L * (0.19 - i * 0.012);
    ctx.fillStyle = i % 2 ? LP.t1 : LP.t2; rr(ctx, -w, -h * 0.55, w * 1.1, h, h * 0.3); ctx.fill();
    ctx.fillStyle = LP.spot; ell(ctx, -w * 0.45, -h * 0.15, w * 0.16, h * 0.1); ctx.fill();
    if (o.eggs) { ctx.fillStyle = '#ff7a1a'; for (let k = 0; k < 4; k++) { ell(ctx, -w * (0.2 + k * 0.2), h * 0.45 + (k % 2) * 2, w * 0.18, w * 0.16); ctx.fill(); } }
    ctx.translate(-w * 0.9, 0);
  }
  ctx.rotate(-curl * 0.3);
  ctx.fillStyle = LP.fan;
  for (let k = -2; k <= 2; k++) { ctx.save(); ctx.rotate(k * 0.22); ell(ctx, -L * 0.07, 0, L * 0.075, L * 0.035); ctx.fill(); ctx.strokeStyle = LP.fanE; ctx.lineWidth = L * 0.008; ctx.stroke(); ctx.restore(); }
  ctx.restore();
  const cg = ctx.createLinearGradient(0, -L * 0.2, 0, L * 0.1); cg.addColorStop(0, LP.c1); cg.addColorStop(1, LP.c2);
  ctx.fillStyle = cg; ctx.beginPath();
  ctx.moveTo(L * 0.02, L * 0.08); ctx.quadraticCurveTo(-L * 0.01, -L * 0.15, L * 0.18, -L * 0.17);
  ctx.quadraticCurveTo(L * 0.42, -L * 0.18, L * 0.5, -L * 0.05); ctx.lineTo(L * 0.5, L * 0.05);
  ctx.quadraticCurveTo(L * 0.3, L * 0.12, L * 0.02, L * 0.08); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = LP.dark;
  for (let i = 0; i < 6; i++) { const x = L * 0.1 + i * L * 0.06; ctx.beginPath(); ctx.moveTo(x, -L * 0.15); ctx.lineTo(x + L * 0.02, -L * 0.21); ctx.lineTo(x + L * 0.035, -L * 0.155); ctx.fill(); }
  ctx.fillStyle = LP.speck; for (let i = 0; i < 6; i++) { ell(ctx, L * (0.12 + (i % 3) * 0.11), L * (-0.08 + Math.floor(i / 3) * 0.08), L * 0.018, L * 0.014); ctx.fill(); }
  ctx.fillStyle = LP.horn; ctx.beginPath(); ctx.moveTo(L * 0.45, -L * 0.1); ctx.quadraticCurveTo(L * 0.55, -L * 0.2, L * 0.58, -L * 0.24); ctx.lineTo(L * 0.5, -L * 0.08); ctx.fill();
  ctx.fillStyle = '#111'; ell(ctx, L * 0.47, -L * 0.04, L * 0.025, L * 0.025); ctx.fill();
  if (o.gold) { const k = (Math.sin(t * 5) + 1) / 2; ctx.fillStyle = `rgba(255,255,255,${0.5 + 0.5 * k})`; ctx.save(); ctx.translate(L * 0.3, -L * 0.2); ctx.rotate(t); ctx.fillRect(-L * 0.05, -1, L * 0.1, 2); ctx.fillRect(-1, -L * 0.05, 2, L * 0.1); ctx.restore(); }
  ctx.restore();
}
// Dorsal view. Origin = rear edge of the carapace, head toward +x. C = carapace length in px.
// o: t, gold, walk (legs stepping), curl 0..1 (tail tucked under for a tail-flip), ant (antennae swept back 0..1)
function drawLobsterTop(ctx, C, o = {}) {
  const t = o.t || 0, LP = o.gold ? LOBPAL.gold : LOBPAL.normal, tk = 1 - 0.55 * (o.curl || 0), sweep = o.ant || 0;
  ctx.save();
  for (const s of [-1, 1]) drawAntenna(ctx, C * 1.02, s * C * 0.13, C * 2.7, s * (0.3 + sweep * 0.9 + Math.sin(t * 1.4 + s) * 0.04), C * 0.085, s, LP);
  ctx.strokeStyle = '#f2dcae'; ctx.lineWidth = C * 0.02;
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(C * 1.0, s * C * 0.05); ctx.lineTo(C * 1.35, s * C * 0.12); ctx.lineTo(C * 1.5, s * C * 0.08); ctx.stroke(); }
  ctx.lineCap = 'round';
  for (const s of [-1, 1]) for (let i = 0; i < 5; i++) {
    const st = o.walk ? Math.sin(t * 11 + i * 1.9 + (s > 0 ? Math.PI : 0)) * C * 0.09 : 0;   // alternate legs step
    const lx = C * (0.12 + i * 0.17), kx = lx + C * 0.12 + st * 0.5, ky = s * C * 0.58, fx = lx + C * 0.32 + st, fy = s * C * 0.72;
    ctx.strokeStyle = LP.leg; ctx.lineWidth = C * 0.05; ctx.beginPath(); ctx.moveTo(lx, s * C * 0.3); ctx.lineTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke();
    ctx.strokeStyle = LP.legS; ctx.lineWidth = C * 0.022; ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo((kx + fx) / 2, (ky + fy) / 2); ctx.stroke();
  }
  for (let i = 0; i < 6; i++) {
    const x0 = -i * C * 0.2 * tk, w = C * (0.62 - i * 0.03);
    ctx.fillStyle = i % 2 ? LP.t1 : LP.t2; rr(ctx, x0 - C * 0.215, -w / 2, C * 0.225, w, C * 0.08); ctx.fill();
    ctx.strokeStyle = 'rgba(80,30,10,0.4)'; ctx.lineWidth = C * 0.012; ctx.stroke();
    ctx.fillStyle = LP.spot; ell(ctx, x0 - C * 0.1, -w * 0.26, C * 0.04, C * 0.035); ctx.fill(); ell(ctx, x0 - C * 0.1, w * 0.26, C * 0.04, C * 0.035); ctx.fill();
  }
  ctx.save(); ctx.translate(-C * 1.2 * tk, 0);
  for (let k = -2; k <= 2; k++) { ctx.save(); ctx.rotate(Math.PI + k * 0.32); ctx.fillStyle = LP.fan; ell(ctx, C * 0.2, 0, C * 0.22, C * 0.1); ctx.fill(); ctx.strokeStyle = LP.fanE; ctx.lineWidth = C * 0.03; ctx.stroke(); ctx.restore(); }
  ctx.restore();
  const cg = ctx.createLinearGradient(0, -C * 0.4, 0, C * 0.4); cg.addColorStop(0, LP.c2); cg.addColorStop(0.5, LP.cm); cg.addColorStop(1, LP.c2);
  ctx.fillStyle = cg; ctx.beginPath();
  ctx.moveTo(0, -C * 0.36); ctx.quadraticCurveTo(C * 0.55, -C * 0.44, C * 0.92, -C * 0.22); ctx.lineTo(C, 0); ctx.lineTo(C * 0.92, C * 0.22);
  ctx.quadraticCurveTo(C * 0.55, C * 0.44, 0, C * 0.36); ctx.quadraticCurveTo(-C * 0.04, 0, 0, -C * 0.36); ctx.fill();
  ctx.strokeStyle = 'rgba(70,25,8,0.5)'; ctx.lineWidth = C * 0.015; ctx.stroke();
  const rng = mulberry(7);
  for (let i = 0; i < 16; i++) { ctx.fillStyle = i % 2 ? LP.dark : LP.speck; ell(ctx, C * (0.1 + rng() * 0.75), C * (rng() - 0.5) * 0.5, C * 0.03, C * 0.03); ctx.fill(); }
  ctx.fillStyle = LP.horn;
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(C * 0.9, s * C * 0.08); ctx.lineTo(C * 1.22, s * C * 0.2); ctx.lineTo(C * 0.93, s * C * 0.22); ctx.fill(); }
  ctx.fillStyle = '#111'; for (const s of [-1, 1]) { ell(ctx, C * 0.98, s * C * 0.1, C * 0.04, C * 0.04); ctx.fill(); }
  ctx.restore();
}
function drawLobsterUnder(ctx, C, eggs, t = 0) {
  ctx.save();
  for (let i = 0; i < 6; i++) {
    const x0 = -i * C * 0.2, w = C * (0.62 - i * 0.03);
    ctx.fillStyle = i % 2 ? '#e7c79c' : '#efd3ab'; rr(ctx, x0 - C * 0.215, -w / 2, C * 0.225, w, C * 0.08); ctx.fill();
    ctx.strokeStyle = 'rgba(120,80,40,0.45)'; ctx.lineWidth = C * 0.012; ctx.stroke();
    ctx.strokeStyle = '#c9925a'; ctx.lineWidth = C * 0.018; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x0 - C * 0.1, s * w * 0.3); ctx.lineTo(x0 - C * 0.16, s * w * 0.62); ctx.stroke(); }
  }
  ctx.save(); ctx.translate(-C * 1.2, 0);
  for (let k = -2; k <= 2; k++) { ctx.save(); ctx.rotate(Math.PI + k * 0.32); ctx.fillStyle = '#e0b07a'; ell(ctx, C * 0.2, 0, C * 0.22, C * 0.1); ctx.fill(); ctx.restore(); }
  ctx.restore();
  if (eggs) {
    const rng = mulberry(11);
    for (let i = 0; i < 140; i++) {
      const x = -C * 0.05 - rng() * C * 1.05, y = (rng() - 0.5) * C * 0.62 * (1 - (-x / C) * 0.25);
      ctx.fillStyle = i % 3 ? '#ff7a1a' : '#ff9a3c'; ell(ctx, x, y + Math.sin(t * 3 + i) * 0.4, C * 0.035, C * 0.035); ctx.fill();
    }
  }
  ctx.fillStyle = '#d99b62'; ctx.beginPath(); ctx.moveTo(0, -C * 0.3); ctx.quadraticCurveTo(C * 0.6, -C * 0.4, C, 0); ctx.quadraticCurveTo(C * 0.6, C * 0.4, 0, C * 0.3); ctx.closePath(); ctx.fill();
  ctx.restore();
}

/* ================= REEF CREATURES ================= */
// Side-view shark facing right. kind: 'reef' (gray, hunting) or 'nurse' (tan, asleep on the bottom)
function drawShark(ctx, len, o = {}) {
  const L = len, nurse = o.kind === 'nurse', H = L * (nurse ? 0.16 : 0.2), t = o.t || 0;
  const C = nurse ? { back: '#8c7a58', belly: '#d9cdae', fin: '#7a6a4b' } : { back: '#66767f', belly: '#eef2f2', fin: '#57666f' };
  const sw = Math.sin(t * (o.speed || 4)) * (nurse ? 0.08 : 0.2);
  ctx.save();
  ctx.save(); ctx.translate(-L * 0.38, -H * 0.04); ctx.rotate(sw);
  ctx.fillStyle = C.fin; ctx.beginPath(); ctx.moveTo(0, -H * 0.14);
  if (nurse) { ctx.quadraticCurveTo(-L * 0.12, -H * 0.5, -L * 0.24, -H * 0.42); ctx.quadraticCurveTo(-L * 0.18, H * 0.1, 0, H * 0.14); }
  else { ctx.quadraticCurveTo(-L * 0.11, -H * 0.9, -L * 0.2, -H * 1.3); ctx.quadraticCurveTo(-L * 0.13, -H * 0.3, -L * 0.1, 0); ctx.quadraticCurveTo(-L * 0.12, H * 0.35, -L * 0.1, H * 0.62); ctx.quadraticCurveTo(-L * 0.03, H * 0.2, 0, H * 0.14); }
  ctx.closePath(); ctx.fill(); ctx.restore();
  ctx.fillStyle = C.fin; ctx.beginPath();
  if (nurse) { ctx.moveTo(-L * 0.02, -H * 0.42); ctx.quadraticCurveTo(-L * 0.06, -H * 1.0, -L * 0.13, -H * 0.9); ctx.lineTo(-L * 0.14, -H * 0.36); ctx.moveTo(-L * 0.18, -H * 0.34); ctx.quadraticCurveTo(-L * 0.21, -H * 0.85, -L * 0.27, -H * 0.75); ctx.lineTo(-L * 0.28, -H * 0.26); }
  else { ctx.moveTo(L * 0.09, -H * 0.46); ctx.lineTo(-L * 0.03, -H * 1.5); ctx.quadraticCurveTo(-L * 0.06, -H * 0.9, -L * 0.12, -H * 0.4); ctx.moveTo(-L * 0.24, -H * 0.3); ctx.lineTo(-L * 0.28, -H * 0.62); ctx.lineTo(-L * 0.31, -H * 0.24); }
  ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(L * 0.5, H * 0.04);
  ctx.quadraticCurveTo(L * 0.47, -H * 0.42, L * 0.25, -H * 0.5); ctx.quadraticCurveTo(-L * 0.1, -H * 0.56, -L * 0.38, -H * 0.15);
  ctx.lineTo(-L * 0.38, H * 0.07); ctx.quadraticCurveTo(-L * 0.1, H * 0.48, L * 0.25, H * 0.42); ctx.quadraticCurveTo(L * 0.46, H * 0.32, L * 0.5, H * 0.04); ctx.closePath();
  const g = ctx.createLinearGradient(0, -H * 0.5, 0, H * 0.45); g.addColorStop(0, C.back); g.addColorStop(0.5, C.back); g.addColorStop(0.62, C.belly); g.addColorStop(1, C.belly);
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.fillStyle = C.fin; ctx.beginPath(); ctx.moveTo(L * 0.2, H * 0.22); ctx.quadraticCurveTo(L * 0.08, H * 0.95, -L * 0.04, H * 1.05); ctx.quadraticCurveTo(L * 0.06, H * 0.5, L * 0.06, H * 0.28); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-L * 0.16, H * 0.38); ctx.lineTo(-L * 0.22, H * 0.62); ctx.lineTo(-L * 0.24, H * 0.32); ctx.fill();
  ctx.strokeStyle = 'rgba(30,40,46,0.45)'; ctx.lineWidth = 1.2;
  for (let i = 0; i < 5; i++) { const x = L * (0.27 - i * 0.022); ctx.beginPath(); ctx.moveTo(x, -H * 0.12); ctx.quadraticCurveTo(x - L * 0.012, H * 0.05, x, H * 0.2); ctx.stroke(); }
  ctx.fillStyle = '#0d1114'; ell(ctx, L * 0.39, -H * 0.12, L * 0.011, L * 0.011); ctx.fill();
  if (nurse) {
    ctx.strokeStyle = '#6a5a3e'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(L * 0.47, H * 0.12); ctx.lineTo(L * 0.5, H * 0.3); ctx.stroke();
    ctx.strokeStyle = '#2b2418'; ctx.beginPath(); ctx.moveTo(L * 0.36, -H * 0.14); ctx.lineTo(L * 0.42, -H * 0.12); ctx.stroke();
  } else {
    const m = o.mouth || 0;
    ctx.fillStyle = '#4a1d22'; ctx.beginPath(); ctx.moveTo(L * 0.44, H * 0.14); ctx.quadraticCurveTo(L * 0.36, H * (0.2 + m * 0.5), L * 0.29, H * (0.18 + m * 0.14)); ctx.lineTo(L * 0.44, H * 0.14); ctx.quadraticCurveTo(L * 0.38, H * 0.2, L * 0.29, H * 0.18); ctx.fill();
    if (m > 0.2) { ctx.fillStyle = '#ffffff'; for (let i = 0; i < 6; i++) { const x = L * (0.43 - i * 0.022), y = H * (0.15 + i * 0.01); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - L * 0.008, y + H * 0.12 * m); ctx.lineTo(x - L * 0.016, y); ctx.fill(); } }
  }
  ctx.restore();
}
function drawTurtle(ctx, s, t) {
  const fl = Math.sin(t * 2.2);
  ctx.save();
  ctx.fillStyle = '#7d8b4c';
  ctx.save(); ctx.translate(s * 0.18, s * 0.08); ctx.rotate(0.5 + fl * 0.6); ell(ctx, -s * 0.05, s * 0.32, s * 0.12, s * 0.4, -0.3); ctx.fill(); ctx.restore();
  ctx.save(); ctx.translate(-s * 0.3, s * 0.1); ctx.rotate(0.8 + fl * 0.3); ell(ctx, 0, s * 0.12, s * 0.07, s * 0.16); ctx.fill(); ctx.restore();
  ctx.fillStyle = '#e8d79a'; ell(ctx, 0, s * 0.1, s * 0.48, s * 0.14); ctx.fill();
  const g = ctx.createLinearGradient(0, -s * 0.35, 0, s * 0.1); g.addColorStop(0, '#6b5a2a'); g.addColorStop(1, '#4a3d1c');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-s * 0.5, s * 0.06); ctx.quadraticCurveTo(-s * 0.4, -s * 0.36, 0, -s * 0.38); ctx.quadraticCurveTo(s * 0.42, -s * 0.36, s * 0.5, s * 0.06); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(230,200,120,0.45)'; ctx.lineWidth = 1.5;
  for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * s * 0.17, s * 0.05); ctx.lineTo(i * s * 0.14, -s * 0.3); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(-s * 0.42, -s * 0.12); ctx.quadraticCurveTo(0, -s * 0.2, s * 0.42, -s * 0.12); ctx.stroke();
  ctx.fillStyle = '#8a9a55'; ell(ctx, s * 0.6, -s * 0.04, s * 0.15, s * 0.11); ctx.fill();
  ctx.fillStyle = '#111'; ell(ctx, s * 0.66, -s * 0.07, s * 0.022, s * 0.022); ctx.fill();
  ctx.fillStyle = '#7d8b4c'; ctx.save(); ctx.translate(s * 0.3, s * 0.08); ctx.rotate(-0.4 + fl * 0.7); ell(ctx, -s * 0.02, s * 0.3, s * 0.1, s * 0.36, -0.2); ctx.fill(); ctx.restore();
  ctx.restore();
}
function drawEagleRay(ctx, s, t, a = 1) {
  const fl = Math.sin(t * 2.4);
  ctx.save(); ctx.globalAlpha *= a;
  ctx.strokeStyle = '#1c2a33'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-s * 0.3, 0); ctx.quadraticCurveTo(-s * 0.9, s * 0.05, -s * 1.5, -s * 0.02); ctx.stroke();
  ctx.fillStyle = '#26343e';
  ctx.beginPath(); ctx.moveTo(s * 0.3, 0); ctx.quadraticCurveTo(0, -s * 0.12, -s * 0.15, -s * 0.62 * fl - s * 0.05); ctx.quadraticCurveTo(-s * 0.15, -s * 0.05, -s * 0.32, 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#1b262e';
  ctx.beginPath(); ctx.moveTo(s * 0.3, 0); ctx.quadraticCurveTo(0, s * 0.12, -s * 0.1, s * 0.42 * fl + s * 0.05); ctx.quadraticCurveTo(-s * 0.15, s * 0.05, -s * 0.32, 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#2c3b46'; ell(ctx, 0, 0, s * 0.34, s * 0.08); ctx.fill();
  ctx.fillStyle = '#2c3b46'; ell(ctx, s * 0.36, 0.5, s * 0.07, s * 0.04); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.75)'; for (let i = 0; i < 6; i++) { ell(ctx, -s * 0.05 - (i % 3) * s * 0.05, -s * 0.12 * fl * (0.6 + (i % 2) * 0.6) - s * 0.03, 1.4, 1.4); ctx.fill(); }
  ctx.restore();
}
function drawOctopus(ctx, s, t, o = {}) {
  const col = o.color || '#c4583a', flee = o.flee || 0;
  ctx.save();
  ctx.strokeStyle = col; ctx.lineCap = 'round';
  for (let i = 0; i < 8; i++) {
    const base = -0.9 + (i / 7) * 1.8 + (flee ? Math.PI : Math.PI / 2) - Math.PI / 2;
    ctx.lineWidth = s * 0.09; ctx.beginPath(); ctx.moveTo(0, s * 0.1);
    let x = 0, y = s * 0.1;
    for (let k = 1; k <= 6; k++) {
      const a = (flee ? Math.PI / 2 + (i - 3.5) * 0.08 : base + Math.sin(t * 3 + i + k * 0.7) * 0.5);
      x += Math.cos(a) * s * 0.12; y += Math.sin(a) * s * 0.12 + (flee ? s * 0.04 : 0);
      ctx.lineTo(x, y); ctx.lineWidth = s * 0.09 * (1 - k / 7);
    }
    ctx.stroke();
  }
  const g = ctx.createRadialGradient(-s * 0.1, -s * 0.25, 2, 0, -s * 0.1, s * 0.5); g.addColorStop(0, mix(col.startsWith('#') ? col : '#c4583a', '#ffffff', 0.3)); g.addColorStop(1, col);
  ctx.fillStyle = g; ell(ctx, 0, -s * 0.12, s * 0.3, s * 0.36, flee ? 0 : 0.2); ctx.fill();
  ctx.fillStyle = '#fff'; ell(ctx, -s * 0.12, s * 0.02, s * 0.07, s * 0.07); ctx.fill(); ell(ctx, s * 0.12, s * 0.02, s * 0.07, s * 0.07); ctx.fill();
  ctx.fillStyle = '#111'; ell(ctx, -s * 0.12, s * 0.03, s * 0.03, s * 0.045); ctx.fill(); ell(ctx, s * 0.12, s * 0.03, s * 0.03, s * 0.045); ctx.fill();
  ctx.restore();
}
function drawCrab(ctx, s, t, walk) {
  const ph = walk ? Math.sin(t * 18) : 0;
  ctx.save(); ctx.strokeStyle = '#b8401f'; ctx.lineWidth = s * 0.08; ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) for (const d of [-1, 1]) { ctx.beginPath(); ctx.moveTo(d * s * 0.25, 0); ctx.lineTo(d * s * (0.55 + i * 0.1), -s * 0.05 + (i % 2 ? ph : -ph) * s * 0.06); ctx.lineTo(d * s * (0.65 + i * 0.12), s * 0.28); ctx.stroke(); }
  ctx.fillStyle = '#e0562e'; ell(ctx, 0, -s * 0.1, s * 0.38, s * 0.24); ctx.fill();
  for (const d of [-1, 1]) { ctx.fillStyle = '#e0562e'; ell(ctx, d * s * 0.52, -s * 0.38 + ph * s * 0.04, s * 0.16, s * 0.12); ctx.fill(); ctx.strokeStyle = '#e0562e'; ctx.beginPath(); ctx.moveTo(d * s * 0.3, -s * 0.15); ctx.lineTo(d * s * 0.45, -s * 0.32); ctx.stroke(); }
  ctx.strokeStyle = '#7a2a12'; ctx.lineWidth = s * 0.05; for (const d of [-1, 1]) { ctx.beginPath(); ctx.moveTo(d * s * 0.1, -s * 0.3); ctx.lineTo(d * s * 0.12, -s * 0.45); ctx.stroke(); ctx.fillStyle = '#111'; ell(ctx, d * s * 0.12, -s * 0.47, s * 0.05, s * 0.05); ctx.fill(); }
  ctx.restore();
}
function drawStarfish(ctx, r, col = '#e8742c') {
  ctx.save(); ctx.fillStyle = col; ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i / 10) * TAU, rr2 = i % 2 ? r * 0.45 : r; i ? ctx.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2 * 0.55) : ctx.moveTo(Math.cos(a) * rr2, Math.sin(a) * rr2 * 0.55); }
  ctx.closePath(); ctx.fill(); ctx.fillStyle = 'rgba(255,230,180,0.7)'; for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i / 5) * TAU; ell(ctx, Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.28, 1.3, 1.3); ctx.fill(); }
  ctx.restore();
}
function drawUrchin(ctx, r, t = 0) {
  ctx.save(); ctx.strokeStyle = '#141018'; ctx.lineWidth = 1.3;
  for (let i = 0; i < 16; i++) { const a = Math.PI + (i / 15) * Math.PI + Math.sin(t + i) * 0.03; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * r * 2.1, Math.sin(a) * r * 2.1); ctx.stroke(); }
  ctx.fillStyle = '#231a2c'; ell(ctx, 0, 0, r, r * 0.8); ctx.fill(); ctx.restore();
}

/* ================= THE CREW ================= */
function drawHead(ctx, ch, x, y, r, o = {}) {
  const C = typeof ch === 'string' ? CHARS[ch] : ch; const expr = o.expr || C.expr || 'smile';
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = C.skinDark; ctx.fillRect(-r * 0.36, r * 0.55, r * 0.72, r * 0.75);
  ctx.fillStyle = C.skinDark; ell(ctx, -r * 0.8, r * 0.04, r * 0.16, r * 0.22); ctx.fill(); ell(ctx, r * 0.8, r * 0.04, r * 0.16, r * 0.22); ctx.fill();
  const g = ctx.createRadialGradient(-r * 0.25, -r * 0.3, r * 0.1, 0, 0, r * 1.1);
  g.addColorStop(0, mix(C.skin, '#ffffff', 0.18)); g.addColorStop(0.6, C.skin); g.addColorStop(1, C.skinDark);
  ctx.fillStyle = g; ell(ctx, 0, 0, r * 0.8, r); ctx.fill();
  // beard
  ctx.save(); ell(ctx, 0, 0, r * 0.8, r); ctx.clip();
  if (C.beard === 'stubble') { ctx.fillStyle = rgba(C.beardColor, 0.4); ctx.fillRect(-r, r * 0.16, r * 2, r); ell(ctx, 0, r * 0.32, r * 0.3, r * 0.08); ctx.fill(); }
  else if (C.beard === 'salt') {
    ctx.fillStyle = rgba(C.beardColor, 0.92); ctx.fillRect(-r, r * 0.12, r * 2, r);
    const rng = mulberry(3); ctx.fillStyle = 'rgba(220,220,215,0.7)';
    for (let i = 0; i < 60; i++) { ell(ctx, (rng() - 0.5) * r * 1.5, r * (0.15 + rng() * 0.85), r * 0.025, r * 0.025); ctx.fill(); }
  } else if (C.beard === 'goatee') { ctx.fillStyle = rgba(C.beardColor, 0.18); ctx.fillRect(-r, r * 0.2, r * 2, r); ctx.fillStyle = rgba(C.beardColor, 0.85); ell(ctx, 0, r * 0.31, r * 0.27, r * 0.05); ctx.fill(); ell(ctx, 0, r * 0.86, r * 0.17, r * 0.13); ctx.fill(); }
  ctx.restore();
  if (C.beard === 'salt') { ctx.fillStyle = rgba(C.beardColor, 0.92); ell(ctx, 0, r * 0.86, r * 0.48, r * 0.24); ctx.fill(); }
  // skin around mouth so the mouth reads through the beard
  if (expr === 'open') {
    ctx.fillStyle = '#3a0f0c'; ell(ctx, 0, r * 0.55, r * 0.22, r * 0.27); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillRect(-r * 0.15, r * 0.31, r * 0.3, r * 0.08);
    ctx.fillStyle = '#d0565a'; ell(ctx, 0, r * 0.72, r * 0.12, r * 0.07); ctx.fill();
  } else if (expr === 'grin') {
    ctx.fillStyle = '#3a0f0c'; ctx.beginPath(); ctx.moveTo(-r * 0.3, r * 0.42); ctx.quadraticCurveTo(0, r * 0.78, r * 0.3, r * 0.42); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(-r * 0.27, r * 0.44); ctx.quadraticCurveTo(0, r * 0.58, r * 0.27, r * 0.44); ctx.closePath(); ctx.fill();
  } else {
    ctx.strokeStyle = '#4a1a12'; ctx.lineWidth = r * 0.06; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, r * 0.28, r * 0.26, Math.PI * 0.22, Math.PI * 0.78); ctx.stroke();
  }
  ctx.strokeStyle = rgba(C.skinDark, 0.9); ctx.lineWidth = r * 0.05; ctx.beginPath(); ctx.moveTo(r * 0.04, -r * 0.02); ctx.quadraticCurveTo(r * 0.14, r * 0.2, -r * 0.04, r * 0.22); ctx.stroke();
  // top of head
  if (C.head === 'cap' && !o.noCap) {
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ell(ctx, 0, -r * 0.26, r * 0.78, r * 0.14); ctx.fill();
    ctx.fillStyle = C.hair; ctx.fillRect(-r * 0.82, -r * 0.36, r * 0.14, r * 0.32); ctx.fillRect(r * 0.68, -r * 0.36, r * 0.14, r * 0.32);
    ctx.fillStyle = C.capColor; ctx.beginPath(); ctx.moveTo(-r * 0.86, -r * 0.3); ctx.bezierCurveTo(-r * 0.92, -r * 1.24, r * 0.92, -r * 1.24, r * 0.86, -r * 0.3); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = r * 0.03; ctx.beginPath(); ctx.moveTo(0, -r * 1.0); ctx.lineTo(0, -r * 0.35); ctx.stroke();
    ctx.fillStyle = C.capPatch; ell(ctx, 0, -r * 0.64, r * 0.2, r * 0.2); ctx.fill();
    ctx.strokeStyle = '#e2b04a'; ctx.lineWidth = r * 0.04; ctx.stroke();
    ctx.fillStyle = '#e2b04a'; ctx.fillRect(-r * 0.03, -r * 0.76, r * 0.06, r * 0.24); ctx.fillRect(-r * 0.12, -r * 0.67, r * 0.24, r * 0.06);
    ctx.fillStyle = C.capBrim; ctx.beginPath(); ctx.moveTo(-r * 0.96, -r * 0.3); ctx.quadraticCurveTo(0, r * 0.02, r * 0.96, -r * 0.3);
    ctx.lineTo(r * 0.86, -r * 0.37); ctx.quadraticCurveTo(0, -r * 0.2, -r * 0.86, -r * 0.37); ctx.closePath(); ctx.fill();
  } else if (C.head === 'cap' && o.noCap) {
    ctx.fillStyle = C.hair; ctx.beginPath(); ctx.moveTo(-r * 0.8, -r * 0.2); ctx.bezierCurveTo(-r * 0.92, -r * 1.12, r * 0.92, -r * 1.12, r * 0.8, -r * 0.2); ctx.quadraticCurveTo(r * 0.5, -r * 0.7, 0, -r * 0.7); ctx.quadraticCurveTo(-r * 0.5, -r * 0.7, -r * 0.8, -r * 0.2); ctx.fill();
  } else if (C.head === 'bald') {
    ctx.fillStyle = rgba(C.beardColor, 0.35); ctx.fillRect(-r * 0.82, -r * 0.3, r * 0.12, r * 0.3); ctx.fillRect(r * 0.7, -r * 0.3, r * 0.12, r * 0.3);
    ctx.fillStyle = 'rgba(255,255,255,0.38)'; ell(ctx, -r * 0.26, -r * 0.7, r * 0.24, r * 0.1, -0.4); ctx.fill();
  } else if (C.head === 'short') {
    ctx.fillStyle = C.hair; ctx.beginPath(); ctx.moveTo(-r * 0.8, -r * 0.2); ctx.bezierCurveTo(-r * 0.9, -r * 1.12, r * 0.9, -r * 1.12, r * 0.8, -r * 0.2);
    ctx.quadraticCurveTo(r * 0.62, -r * 0.62, 0, -r * 0.68); ctx.quadraticCurveTo(-r * 0.62, -r * 0.62, -r * 0.8, -r * 0.2); ctx.fill();
  }
  if (o.shades !== false) drawShades(ctx, C.shades, r);
  ctx.restore();
}
function drawShades(ctx, S, r) {
  const lensFill = () => { const g = ctx.createLinearGradient(0, -r * 0.3, 0, r * 0.08); g.addColorStop(0, S.lens1); g.addColorStop(0.55, S.lens2); g.addColorStop(1, S.lens1); return g; };
  if (S.style === 'wrap') {
    ctx.fillStyle = S.frame; ctx.beginPath();
    ctx.moveTo(-r * 0.86, -r * 0.38); ctx.quadraticCurveTo(0, -r * 0.48, r * 0.86, -r * 0.38); ctx.lineTo(r * 0.82, r * 0.03);
    ctx.quadraticCurveTo(r * 0.45, r * 0.17, r * 0.1, r * 0.01); ctx.lineTo(0, -r * 0.08); ctx.lineTo(-r * 0.1, r * 0.01);
    ctx.quadraticCurveTo(-r * 0.45, r * 0.17, -r * 0.82, r * 0.03); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = r * 0.03; ctx.stroke();
    for (const s of [-1, 1]) { ctx.fillStyle = lensFill(); ctx.beginPath(); ctx.moveTo(s * r * 0.12, -r * 0.28); ctx.lineTo(s * r * 0.73, -r * 0.3); ctx.quadraticCurveTo(s * r * 0.75, -r * 0.05, s * r * 0.6, 0); ctx.quadraticCurveTo(s * r * 0.3, r * 0.08, s * r * 0.13, -r * 0.04); ctx.closePath(); ctx.fill(); }
  } else {
    for (const s of [-1, 1]) {
      ctx.fillStyle = lensFill(); ctx.beginPath(); ctx.moveTo(s * r * 0.07, -r * 0.27); ctx.lineTo(s * r * 0.72, -r * 0.31);
      ctx.quadraticCurveTo(s * r * 0.78, -r * 0.05, s * r * 0.58, r * 0.05); ctx.quadraticCurveTo(s * r * 0.22, r * 0.09, s * r * 0.08, -r * 0.06); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = S.frame; ctx.lineWidth = r * 0.07; ctx.stroke();
    }
    ctx.strokeStyle = S.frame; ctx.lineWidth = r * 0.07; ctx.beginPath(); ctx.moveTo(-r * 0.08, -r * 0.2); ctx.quadraticCurveTo(0, -r * 0.26, r * 0.08, -r * 0.2); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = r * 0.04;
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * r * 0.5, -r * 0.24); ctx.lineTo(s * r * 0.3, -r * 0.02); ctx.stroke(); }
}
function sleeveStyle(ctx, C, outfit, x0, y0, x1, y1) {
  const sl = outfit === 'rash' ? (C.rash.sleeve || null) : C.sleeve;
  if (sl === 'mahi') { const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, '#f2e05a'); g.addColorStop(0.5, '#4fbf4a'); g.addColorStop(1, '#2a74c9'); return g; }
  if (outfit === 'rash') return C.rash.camo ? C.rash.base : C.rash.base;
  return C.shirt;
}
function torsoPath(ctx, x, y, w, h) {
  ctx.beginPath(); ctx.moveTo(x - w * 0.16, y);
  ctx.quadraticCurveTo(x - w * 0.5, y + h * 0.02, x - w * 0.52, y + h * 0.3); ctx.lineTo(x - w * 0.46, y + h);
  ctx.lineTo(x + w * 0.46, y + h); ctx.lineTo(x + w * 0.52, y + h * 0.3); ctx.quadraticCurveTo(x + w * 0.5, y + h * 0.02, x + w * 0.16, y); ctx.closePath();
}
function drawTorso(ctx, C, x, y, w, h, outfit = 'shirt') {
  torsoPath(ctx, x, y, w, h);
  const base = outfit === 'rash' ? C.rash.base : C.shirt;
  ctx.fillStyle = base; ctx.fill();
  ctx.save(); ctx.clip();
  if (outfit === 'rash' && C.rash.camo) {
    const rng = mulberry(5);
    for (let i = 0; i < 26; i++) { ctx.fillStyle = C.rash.camo[i % 3]; ell(ctx, x + (rng() - 0.5) * w, y + rng() * h, w * (0.06 + rng() * 0.1), h * (0.04 + rng() * 0.06), rng() * 3); ctx.fill(); }
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = w * 0.02; ctx.beginPath(); ctx.moveTo(x - w * 0.5, y + h * 0.35); ctx.quadraticCurveTo(x - w * 0.2, y + h * 0.2, x - w * 0.1, y); ctx.stroke();
  }
  if (outfit === 'shirt' && C.shirtLogo) { ctx.fillStyle = C.shirtLogo; ell(ctx, x + w * 0.22, y + h * 0.22, w * 0.06, w * 0.06); ctx.fill(); }
  if (C.sleeve === 'mahi' || (outfit === 'rash' && C.rash.sleeve === 'mahi')) {
    // little marlin print across the chest
    ctx.strokeStyle = 'rgba(40,70,110,0.5)'; ctx.lineWidth = w * 0.012; ctx.beginPath(); ctx.moveTo(x - w * 0.18, y + h * 0.22); ctx.lineTo(x + w * 0.06, y + h * 0.18); ctx.stroke();
  }
  const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0); g.addColorStop(0, 'rgba(0,0,0,0.12)'); g.addColorStop(0.4, 'rgba(255,255,255,0.06)'); g.addColorStop(1, 'rgba(0,0,0,0.2)');
  ctx.fillStyle = g; ctx.fillRect(x - w, y, w * 2, h);
  ctx.restore();
  // collar
  ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = w * 0.02; ctx.beginPath(); ctx.moveTo(x - w * 0.16, y); ctx.quadraticCurveTo(x, y + h * 0.1, x + w * 0.16, y); ctx.stroke();
}
function limb(ctx, pts, width, color) {
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke();
}
// Character from the waist up holding a catch. (x, y) = base of the neck; s = head radius.
function drawHeroShot(ctx, ch, item, x, y, s, t = 0, o = {}) {
  const C = CHARS[ch]; const outfit = item.kind === 'lobster' ? 'rash' : 'shirt';
  const w = s * 3.3, h = s * 3.6;
  drawTorso(ctx, C, x, y, w, h, outfit);
  const sl = sleeveStyle(ctx, C, outfit, x - w / 2, y, x - w / 2, y + h);
  const shL = [x - w * 0.42, y + h * 0.12], shR = [x + w * 0.42, y + h * 0.12];
  const elL = [x - w * 0.56, y + h * 0.55], elR = [x + w * 0.56, y + h * 0.5];
  limb(ctx, [shL, elL], s * 0.75, sl); limb(ctx, [shR, elR], s * 0.75, sl);
  let hL, hR;
  if (item.kind === 'lobster') {
    const C2 = s * (0.95 + 0.7 * clamp((item.cl - 3) / 3, 0, 1));
    ctx.save(); ctx.translate(x, y + h * 0.82); ctx.rotate(-Math.PI / 2); drawLobsterTop(ctx, C2, { t }); ctx.restore();
    hL = [x - C2 * 0.42, y + h * 0.82 - C2 * 0.55]; hR = [x + C2 * 0.42, y + h * 0.82 - C2 * 0.45];
  } else {
    const n = sizeNorm(item.key, item.weight);
    const len = s * (3.4 + 3.2 * n) * (item.key === 'goliath' || item.key === 'bluemarlin' ? 1.25 : 1);
    ctx.save(); ctx.translate(x + s * 0.2, y + h * 0.62); ctx.rotate(-0.08); drawFish(ctx, item.key, len, { t, wig: 0.15 }); ctx.restore();
    hL = [x + s * 0.2 - len * 0.26, y + h * 0.66]; hR = [x + s * 0.2 + len * 0.3, y + h * 0.55];
  }
  const fore = outfit === 'rash' && !C.rash.sleeve ? sl : sl;
  limb(ctx, [elL, hL], s * 0.62, fore); limb(ctx, [elR, hR], s * 0.62, fore);
  const glove = item.kind === 'lobster' ? C.gloves : C.skin;
  ctx.fillStyle = glove; ell(ctx, hL[0], hL[1], s * 0.36, s * 0.32); ctx.fill(); ell(ctx, hR[0], hR[1], s * 0.36, s * 0.32); ctx.fill();
  if (item.kind === 'lobster') { ctx.fillStyle = 'rgba(120,220,255,0.6)'; ctx.fillRect(hL[0] - s * 0.2, hL[1] - s * 0.05, s * 0.4, s * 0.08); ctx.fillRect(hR[0] - s * 0.2, hR[1] - s * 0.05, s * 0.4, s * 0.08); }
  drawHead(ctx, C, x, y - s * 0.95, s, { expr: o.expr || C.expr });
}
// Side-view angler standing on a deck, facing right. Returns the rod-hand position.
function drawHeadSide(ctx, C, x, y, r) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = C.skinDark; ctx.fillRect(-r * 0.3, r * 0.5, r * 0.55, r * 0.6);
  const g = ctx.createRadialGradient(r * 0.1, -r * 0.2, r * 0.1, 0, 0, r * 1.1); g.addColorStop(0, mix(C.skin, '#ffffff', 0.15)); g.addColorStop(1, C.skinDark);
  ctx.fillStyle = g; ell(ctx, 0, 0, r * 0.82, r * 0.95); ctx.fill(); ell(ctx, r * 0.32, r * 0.28, r * 0.62, r * 0.55); ctx.fill();
  ctx.fillStyle = C.skin; ctx.beginPath(); ctx.moveTo(r * 0.8, -r * 0.1); ctx.lineTo(r * 1.04, r * 0.18); ctx.lineTo(r * 0.8, r * 0.26); ctx.fill();
  if (C.beard === 'salt' || C.beard === 'stubble' || C.beard === 'goatee') {
    ctx.fillStyle = rgba(C.beardColor, C.beard === 'salt' ? 0.9 : C.beard === 'stubble' ? 0.4 : 0.6);
    ctx.beginPath(); ctx.moveTo(-r * 0.1, r * 0.25); ctx.quadraticCurveTo(r * 0.2, r * 0.95, r * 0.86, r * 0.6); ctx.lineTo(r * 0.86, r * 0.38); ctx.quadraticCurveTo(r * 0.4, r * 0.45, r * 0.1, r * 0.2); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = C.skinDark; ell(ctx, -r * 0.12, r * 0.05, r * 0.16, r * 0.24); ctx.fill();
  if (C.head === 'cap') {
    ctx.fillStyle = C.capColor; ctx.beginPath(); ctx.arc(0, -r * 0.1, r * 0.86, Math.PI * 1.02, Math.PI * 1.98); ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.capBrim; ctx.beginPath(); ctx.moveTo(r * 0.5, -r * 0.3); ctx.lineTo(r * 1.4, -r * 0.2); ctx.lineTo(r * 1.36, -r * 0.1); ctx.lineTo(r * 0.5, -r * 0.14); ctx.fill();
  } else if (C.head === 'short') {
    ctx.fillStyle = C.hair; ctx.beginPath(); ctx.arc(-r * 0.05, -r * 0.05, r * 0.86, Math.PI * 0.95, Math.PI * 1.85); ctx.quadraticCurveTo(r * 0.2, -r * 0.55, -r * 0.3, -r * 0.2); ctx.closePath(); ctx.fill();
  } else { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ell(ctx, r * 0.05, -r * 0.7, r * 0.3, r * 0.1, -0.2); ctx.fill(); }
  const S = C.shades; const lg = ctx.createLinearGradient(0, -r * 0.3, 0, r * 0.05); lg.addColorStop(0, S.lens1); lg.addColorStop(1, S.lens2);
  ctx.strokeStyle = S.frame; ctx.lineWidth = r * (S.style === 'wrap' ? 0.14 : 0.07); ctx.beginPath(); ctx.moveTo(-r * 0.1, -r * 0.12); ctx.lineTo(r * 0.55, -r * 0.14); ctx.stroke();
  ctx.fillStyle = lg; ell(ctx, r * 0.7, -r * 0.1, r * 0.2, r * 0.17); ctx.fill(); ctx.stroke();
  ctx.restore();
}
function drawAnglerSide(ctx, ch, x, y, s, o = {}) {
  const C = CHARS[ch]; const lean = o.lean || 0; const t = o.t || 0;
  ctx.save(); ctx.translate(x, y);
  // legs
  limb(ctx, [[-s * 0.1, -s * 2.0], [-s * 0.35, -s * 1.0], [-s * 0.4, 0]], s * 0.5, C.skinDark);
  limb(ctx, [[s * 0.1, -s * 2.0], [s * 0.45, -s * 1.0], [s * 0.4, 0]], s * 0.5, C.skin);
  ctx.fillStyle = C.shorts.base; rr(ctx, -s * 0.45, -s * 2.3, s * 0.95, s * 1.1, s * 0.2); ctx.fill();
  if (C.shorts.stripes) { ctx.fillStyle = C.shorts.stripes[0]; ctx.fillRect(-s * 0.45, -s * 1.55, s * 0.95, s * 0.14); if (C.shorts.stripes[1]) { ctx.fillStyle = C.shorts.stripes[1]; ctx.fillRect(-s * 0.45, -s * 1.38, s * 0.95, s * 0.1); } }
  ctx.translate(0, -s * 2.15); ctx.rotate(-lean);
  // torso
  ctx.fillStyle = C.shirt; rr(ctx, -s * 0.45, -s * 2.0, s * 0.9, s * 2.1, s * 0.35); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.12)'; rr(ctx, -s * 0.45, -s * 2.0, s * 0.3, s * 2.1, s * 0.3); ctx.fill();
  drawHeadSide(ctx, C, s * 0.12, -s * 2.55, s * 0.55);
  const sh = [s * 0.05, -s * 1.75]; const hand = [s * 0.95, -s * 1.05 + Math.sin(t * 12) * (o.crank ? s * 0.08 : 0)];
  const sl = C.sleeve === 'mahi' ? sleeveStyle(ctx, C, 'shirt', sh[0], sh[1], hand[0], hand[1]) : C.shirt;
  limb(ctx, [sh, [s * 0.6, -s * 1.15], hand], s * 0.36, sl);
  ctx.fillStyle = C.skin; ell(ctx, hand[0], hand[1], s * 0.2, s * 0.18); ctx.fill();
  ctx.restore();
  const cl = Math.cos(-lean), sn = Math.sin(-lean);
  const hx = hand[0] * cl - hand[1] * sn, hy = hand[0] * sn + hand[1] * cl;
  return { x: x + hx, y: y - s * 2.15 + hy };
}
// Free-diver, side view, facing right (o.facing = -1 to face left).
function drawDiver(ctx, ch, x, y, s, o = {}) {
  const C = CHARS[ch]; const t = o.t || 0; const k = o.kick == null ? 0.5 : o.kick;
  ctx.save(); ctx.translate(x, y); ctx.scale(s * (o.facing || 1), s); if (o.tilt) ctx.rotate(o.tilt);
  const kick = Math.sin(t * 7) * (0.08 + 0.22 * k);
  const leg = (hy, a, back) => {
    ctx.save(); ctx.translate(-20, hy); ctx.rotate(a);
    ctx.fillStyle = C.shorts.base; rr(ctx, -20, -6, 24, 12, 5); ctx.fill();
    if (C.shorts.stripes) { ctx.fillStyle = C.shorts.stripes[0]; ctx.fillRect(-20, -1, 24, 3); }
    limb(ctx, [[-17, 0], [-34, 1]], 7, back ? C.skinDark : C.skin);
    ctx.save(); ctx.translate(-36, 1); ctx.rotate(a * 0.7);
    ctx.fillStyle = back ? '#10293d' : '#1b4a6e'; ctx.beginPath(); ctx.moveTo(4, -5); ctx.lineTo(-34, -7); ctx.quadraticCurveTo(-39, 0, -34, 7); ctx.lineTo(4, 5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#0a0f14'; rr(ctx, -6, -5, 12, 10, 4); ctx.fill();
    ctx.restore(); ctx.restore();
  };
  leg(3, kick, true);
  // back arm with net (the Bug Hunt draws its own swinging net and passes noNet)
  const sl = sleeveStyle(ctx, C, 'rash', 0, 0, 30, 10);
  limb(ctx, [[8, 4], [22, 14], [34, 15]], 6, sl);
  ctx.fillStyle = C.gloves; ell(ctx, 34, 15, 3.6, 3.2); ctx.fill();
  if (!o.noNet) { ctx.save(); ctx.translate(34, 15); ctx.rotate((o.netSwing || 0) * -0.9 + 0.25);
  ctx.strokeStyle = '#c9cfd4'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(22, 4); ctx.stroke();
  ctx.strokeStyle = '#e8eef2'; ctx.lineWidth = 2; ell(ctx, 34, 6, 11, 13, 0.2); ctx.stroke();
  ctx.save(); ell(ctx, 34, 6, 11, 13, 0.2); ctx.clip(); ctx.strokeStyle = 'rgba(230,240,245,0.45)'; ctx.lineWidth = 0.8;
  for (let i = -14; i <= 14; i += 4) { ctx.beginPath(); ctx.moveTo(22 + i, -10); ctx.lineTo(34 + i, 22); ctx.stroke(); ctx.beginPath(); ctx.moveTo(46 + i, -10); ctx.lineTo(34 + i, 22); ctx.stroke(); }
  ctx.restore(); ctx.restore(); }
  // torso
  ctx.fillStyle = C.rash.base; rr(ctx, -26, -11, 46, 22, 11); ctx.fill();
  if (C.rash.camo) { ctx.save(); rr(ctx, -26, -11, 46, 22, 11); ctx.clip(); const rng = mulberry(9); for (let i = 0; i < 12; i++) { ctx.fillStyle = C.rash.camo[i % 3]; ell(ctx, -24 + rng() * 44, -10 + rng() * 20, 4 + rng() * 5, 2 + rng() * 3, rng() * 3); ctx.fill(); } ctx.restore(); }
  ctx.fillStyle = 'rgba(0,0,0,0.15)'; rr(ctx, -26, 2, 46, 9, 5); ctx.fill();
  leg(-2, -kick, false);
  // head
  ctx.fillStyle = C.skin; ell(ctx, 27, -4, 10, 9.5); ctx.fill();
  if (C.head === 'bald') { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ell(ctx, 24, -11, 4, 2); ctx.fill(); }
  else { ctx.fillStyle = C.hair; ctx.beginPath(); ctx.arc(26, -5, 10, Math.PI * 0.95, Math.PI * 1.75); ctx.closePath(); ctx.fill(); }
  if (C.beard === 'salt') { ctx.fillStyle = rgba(C.beardColor, 0.9); ell(ctx, 30, 3, 6, 4); ctx.fill(); }
  ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(18, -7); ctx.lineTo(29, -8); ctx.stroke();
  ctx.fillStyle = '#111'; rr(ctx, 28, -11, 11, 10, 3); ctx.fill();
  const mg = ctx.createLinearGradient(30, -10, 37, -2); mg.addColorStop(0, '#9fe9ff'); mg.addColorStop(1, '#2f7fb8'); ctx.fillStyle = mg; rr(ctx, 30, -9.5, 8, 7, 2); ctx.fill();
  ctx.strokeStyle = '#c6f13a'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(32, 3); ctx.quadraticCurveTo(22, 5, 20, -6); ctx.lineTo(17, -21); ctx.stroke();
  ctx.strokeStyle = '#ff7a2f'; ctx.beginPath(); ctx.moveTo(17, -21); ctx.lineTo(16.5, -25); ctx.stroke();
  // front arm with tickle stick
  const wig = o.tickle ? Math.sin(t * 34) * 3 : 0;
  limb(ctx, [[12, -2], [26, 6], [40, 4]], 6, sl);
  ctx.fillStyle = C.gloves; ell(ctx, 40, 4, 3.6, 3.2); ctx.fill();
  ctx.strokeStyle = '#aeb8bf'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(38, 5); ctx.lineTo(82, 1 + wig); ctx.stroke();
  ctx.restore();
}
function drawPersonTop(ctx, ch, x, y, s, ang = 0) {
  const C = CHARS[ch];
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  ctx.fillStyle = C.sleeve === 'mahi' ? '#5ec05a' : C.shirt; ell(ctx, 0, 0, s * 0.6, s * 1.1); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1; ctx.stroke();
  if (C.head === 'cap') { ctx.fillStyle = C.capColor; ell(ctx, 0, 0, s * 0.55, s * 0.55); ctx.fill(); ctx.fillStyle = C.capBrim; ctx.beginPath(); ctx.arc(s * 0.35, 0, s * 0.35, -Math.PI / 2, Math.PI / 2); ctx.fill(); }
  else if (C.head === 'bald') { ctx.fillStyle = C.skin; ell(ctx, 0, 0, s * 0.5, s * 0.5); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.45)'; ell(ctx, -s * 0.12, -s * 0.12, s * 0.15, s * 0.1); ctx.fill(); }
  else { ctx.fillStyle = C.hair; ell(ctx, 0, 0, s * 0.5, s * 0.5); ctx.fill(); }
  ctx.restore();
}

/* ================= BOATS ================= */
function drawBoatSide(ctx, x, y, s, o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s * (o.flip ? -1 : 1), s); if (o.rot) ctx.rotate(o.rot);
  for (let i = 0; i < 2; i++) {
    const ox = -150 - i * 8;
    ctx.fillStyle = '#3a4046'; ctx.fillRect(ox - 12, -30, 10, 46);
    ctx.fillStyle = i ? '#5d646c' : '#7c848c'; rr(ctx, ox - 24, -70, 30, 40, 9); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(ox - 20, -62, 22, 3);
  }
  if (o.crew) {
    o.crew.forEach((ch, i) => {
      const px = -70 + i * 46, C = CHARS[ch];
      ctx.fillStyle = C.sleeve === 'mahi' ? '#f4f6f8' : C.shirt; rr(ctx, px - 13, -82, 26, 44, 10); ctx.fill();
      drawHead(ctx, C, px, -96, 13, { expr: C.expr === 'open' ? 'smile' : C.expr });
    });
  }
  const hg = ctx.createLinearGradient(0, -60, 0, 16); hg.addColorStop(0, '#ffffff'); hg.addColorStop(0.7, '#e9eef2'); hg.addColorStop(1, '#c9d3da');
  ctx.fillStyle = hg; ctx.beginPath();
  ctx.moveTo(-150, -40); ctx.lineTo(118, -46); ctx.quadraticCurveTo(160, -50, 174, -62); ctx.lineTo(152, -12);
  ctx.quadraticCurveTo(112, 14, 40, 16); ctx.lineTo(-150, 12); ctx.closePath(); ctx.fill();
  ctx.save(); ctx.clip(); ctx.fillStyle = o.stripe || '#1f3d6b'; ctx.fillRect(-160, -6, 340, 10); ctx.fillStyle = '#0f1b24'; ctx.fillRect(-160, 4, 340, 20); ctx.restore();
  ctx.strokeStyle = '#26323a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-150, -40); ctx.lineTo(118, -46); ctx.quadraticCurveTo(160, -50, 174, -62); ctx.stroke();
  ctx.strokeStyle = '#c4ccd3'; ctx.lineWidth = 3;
  for (const px of [-10, 46]) { ctx.beginPath(); ctx.moveTo(px, -46); ctx.lineTo(px - 4, -150); ctx.stroke(); }
  ctx.fillStyle = '#fbfcfd'; rr(ctx, -16, -96, 58, 52, 6); ctx.fill(); ctx.strokeStyle = '#c9d3da'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = 'rgba(70,150,200,0.55)'; ctx.beginPath(); ctx.moveTo(30, -96); ctx.lineTo(48, -114); ctx.lineTo(48, -96); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#1d3557'; rr(ctx, -38, -162, 104, 14, 5); ctx.fill();
  ctx.strokeStyle = '#26323a'; ctx.lineWidth = 1.5;
  for (let i = 0; i < 4; i++) { const px = -30 + i * 14; ctx.beginPath(); ctx.moveTo(px, -160); ctx.lineTo(px - 28, -215); ctx.stroke(); ctx.fillStyle = '#9aa3aa'; ell(ctx, px - 6, -170, 3, 3); ctx.fill(); }
  if (o.flag) {
    ctx.strokeStyle = '#ddd'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(62, -162); ctx.lineTo(62, -212); ctx.stroke();
    const wv = Math.sin((o.t || 0) * 4) * 3;
    ctx.fillStyle = '#d7262e'; ctx.beginPath(); ctx.moveTo(62, -212); ctx.lineTo(96, -210 + wv); ctx.lineTo(96, -186 + wv); ctx.lineTo(62, -188); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(63, -210); ctx.lineTo(95, -188 + wv); ctx.stroke();
  }
  ctx.restore();
}
function drawBoatTop(ctx, x, y, s, ang = 0, o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(s, s);
  if (o.rig) { ctx.strokeStyle = 'rgba(220,230,235,0.9)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-6, -24); ctx.lineTo(-58, -78); ctx.moveTo(-6, 24); ctx.lineTo(-58, 78); ctx.stroke(); }
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.moveTo(86, 6); ctx.quadraticCurveTo(64, -22, 4, -24); ctx.lineTo(-68, -23); ctx.lineTo(-68, 31); ctx.lineTo(4, 32); ctx.quadraticCurveTo(64, 30, 86, 6); ctx.fill();
  ctx.fillStyle = o.hull || '#ffffff'; ctx.beginPath(); ctx.moveTo(82, 0); ctx.quadraticCurveTo(62, -27, 0, -28); ctx.lineTo(-72, -27); ctx.lineTo(-74, 27); ctx.lineTo(0, 28); ctx.quadraticCurveTo(62, 27, 82, 0); ctx.fill();
  ctx.strokeStyle = '#9fb0bb'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#e3e8ec'; ctx.beginPath(); ctx.moveTo(70, 0); ctx.quadraticCurveTo(54, -20, 0, -21); ctx.lineTo(-66, -20); ctx.lineTo(-66, 20); ctx.lineTo(0, 21); ctx.quadraticCurveTo(54, 20, 70, 0); ctx.fill();
  ctx.fillStyle = '#3a4148'; rr(ctx, -88, -17, 14, 13, 4); ctx.fill(); rr(ctx, -88, 4, 14, 13, 4); ctx.fill();
  if (o.crew) { const pos = [[-44, -10], [-44, 11], [36, 0]]; o.crew.forEach((ch, i) => { if (pos[i]) drawPersonTop(ctx, ch, pos[i][0], pos[i][1], 9, 0); }); }
  ctx.fillStyle = '#fbfcfd'; rr(ctx, -8, -12, 24, 24, 4); ctx.fill(); ctx.strokeStyle = '#b8c4cc'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = 'rgba(29,53,87,0.82)'; rr(ctx, -24, -22, 50, 44, 7); ctx.fill();
  ctx.restore();
}
function drawSkiffTop(ctx, x, y, s, o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = 'rgba(0,40,40,0.18)'; ctx.beginPath(); ctx.moveTo(8, -88); ctx.quadraticCurveTo(34, -40, 30, 66); ctx.lineTo(-14, 66); ctx.quadraticCurveTo(-18, -40, 8, -88); ctx.fill();
  ctx.fillStyle = '#f7f8f6'; ctx.beginPath(); ctx.moveTo(0, -92); ctx.quadraticCurveTo(26, -44, 22, 60); ctx.lineTo(-22, 60); ctx.quadraticCurveTo(-26, -44, 0, -92); ctx.fill();
  ctx.strokeStyle = '#a9b6b8'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#e4e7e2'; ctx.beginPath(); ctx.moveTo(0, -80); ctx.quadraticCurveTo(18, -44, 17, -30); ctx.lineTo(-17, -30); ctx.quadraticCurveTo(-18, -44, 0, -80); ctx.fill();
  ctx.fillStyle = '#d7dcd6'; rr(ctx, -16, -6, 32, 14, 3); ctx.fill();
  ctx.fillStyle = '#3a4148'; rr(ctx, -9, 58, 18, 14, 4); ctx.fill();
  ctx.strokeStyle = '#b8c2c4'; ctx.lineWidth = 2; ctx.strokeRect(-14, 36, 28, 20);
  ctx.fillStyle = 'rgba(200,210,212,0.9)'; ctx.fillRect(-14, 36, 28, 20);
  if (o.poler) {
    const pl = o.pole || 0;
    ctx.strokeStyle = '#d9c7a0'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(12, 40 - 30 * pl); ctx.lineTo(44 + pl * 6, 120); ctx.stroke();
    drawPersonTop(ctx, o.poler, 0, 46, 9, -Math.PI / 2);
  }
  if (o.angler) drawPersonTop(ctx, o.angler, 0, -46, 9.5, -Math.PI / 2 + (o.aim || 0));
  ctx.restore();
}

/* ================= SCENERY ================= */
function drawSky(ctx, W, h, mood = 'day') {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  if (mood === 'night') { g.addColorStop(0, '#040a1c'); g.addColorStop(0.55, '#0b1838'); g.addColorStop(0.9, '#1a2a52'); g.addColorStop(1, '#2a3560'); }
  else if (mood === 'sunset') { g.addColorStop(0, '#2b3d74'); g.addColorStop(0.45, '#c8577a'); g.addColorStop(0.8, '#f59a52'); g.addColorStop(1, '#ffd08a'); }
  else if (mood === 'dawn') { g.addColorStop(0, '#3b7fcf'); g.addColorStop(0.6, '#9fd0f0'); g.addColorStop(1, '#ffe4b0'); }
  else { g.addColorStop(0, '#2f7fd6'); g.addColorStop(0.65, '#8fcbf1'); g.addColorStop(1, '#d6eefa'); }
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, h);
}
// The moon, lit the way it is tonight. phase: 0 new, 0.25 first quarter (lit on the right), 0.5 full, 0.75 last quarter.
// A soft glow grows with how much of it is lit; the dark part keeps a faint earthshine.
function drawMoon(ctx, x, y, r, phase, o = {}) {
  const lit = (1 - Math.cos(phase * TAU)) / 2;
  ctx.save();
  if (o.glow !== false) {
    const g = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * (2.2 + 2.6 * lit)); g.addColorStop(0, `rgba(220,230,255,${0.1 + 0.32 * lit})`); g.addColorStop(1, 'rgba(220,230,255,0)');
    ctx.fillStyle = g; ctx.fillRect(x - r * 5, y - r * 5, r * 10, r * 10);
  }
  ctx.fillStyle = 'rgba(70,82,110,0.55)'; ell(ctx, x, y, r, r); ctx.fill();
  ctx.translate(x, y); if (phase > 0.5) ctx.scale(-1, 1);
  const k = Math.cos(phase * TAU);   // 1 new, 0 quarter, -1 full: how far the terminator bulges
  if (lit > 0.01) {
    ctx.beginPath(); ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2); ctx.ellipse(0, 0, Math.max(0.01, Math.abs(k) * r), r, 0, Math.PI / 2, -Math.PI / 2, k > 0); ctx.closePath();
    const mg = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r); mg.addColorStop(0, '#fffdf2'); mg.addColorStop(1, '#d9dccb');
    ctx.fillStyle = mg; ctx.fill();
    ctx.save(); ctx.clip(); ctx.fillStyle = 'rgba(150,150,130,0.28)';
    for (const [mx, my, mr] of [[-0.3, -0.25, 0.22], [0.25, 0.1, 0.16], [-0.05, 0.38, 0.13], [0.35, -0.38, 0.1], [-0.42, 0.2, 0.09]]) { ell(ctx, mx * r, my * r, mr * r, mr * r); ctx.fill(); }
    ctx.restore();
  }
  ctx.restore();
}
// a sky full of stars, fixed in place (seeded), twinkling. a: how bright (a full moon washes them out)
function drawStars(ctx, W, h, t, a = 1, n = 120) {
  const rng = mulberry(4242);
  for (let i = 0; i < n; i++) {
    const x = rng() * W, y = Math.pow(rng(), 1.3) * h, r = rng() < 0.08 ? 1.6 : rng() < 0.4 ? 1.1 : 0.7, tw = 0.6 + 0.4 * Math.sin(t * (1 + rng() * 2.5) + i);
    ctx.fillStyle = `rgba(235,240,255,${(a * tw * (1 - y / h * 0.6)).toFixed(3)})`; ctx.fillRect(x, y, r, r);
  }
}
function drawSun(ctx, x, y, r, color = '#fff6c9') {
  const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 3); g.addColorStop(0, 'rgba(255,248,210,0.9)'); g.addColorStop(0.3, 'rgba(255,236,170,0.35)'); g.addColorStop(1, 'rgba(255,236,170,0)');
  ctx.fillStyle = g; ctx.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
  ctx.fillStyle = color; ell(ctx, x, y, r, r); ctx.fill();
}
function drawCloud(ctx, x, y, s, a = 0.9) {
  ctx.fillStyle = `rgba(255,255,255,${a})`;
  ell(ctx, x, y, 40 * s, 16 * s); ctx.fill(); ell(ctx, x - 26 * s, y + 4 * s, 26 * s, 12 * s); ctx.fill();
  ell(ctx, x + 14 * s, y - 12 * s, 26 * s, 18 * s); ctx.fill(); ell(ctx, x + 36 * s, y + 3 * s, 22 * s, 11 * s); ctx.fill();
}
function drawFrigate(ctx, x, y, s, flap = 0) {
  ctx.strokeStyle = '#151a1f'; ctx.lineWidth = 2.2 * s; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const f = Math.sin(flap) * 4 * s;
  ctx.beginPath(); ctx.moveTo(x - 16 * s, y - 2 * s + f); ctx.quadraticCurveTo(x - 8 * s, y - 8 * s - f, x, y); ctx.quadraticCurveTo(x + 8 * s, y - 8 * s - f, x + 16 * s, y - 2 * s + f); ctx.stroke();
}
function drawWaterline(ctx, W, y, t, color = 'rgba(255,255,255,0.55)', amp = 3) {
  ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath();
  for (let x = 0; x <= W; x += 10) { const yy = y + Math.sin(x * 0.03 + t * 2) * amp + Math.sin(x * 0.011 - t * 1.3) * amp * 0.6; x === 0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy); }
  ctx.stroke();
}
function drawSunburst(ctx, x, y, r, t, c1 = 'rgba(255,214,90,0.35)') {
  ctx.save(); ctx.translate(x, y); ctx.rotate(t * 0.2); ctx.fillStyle = c1;
  for (let i = 0; i < 14; i++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r, (i / 14) * TAU, (i / 14) * TAU + TAU / 28); ctx.closePath(); ctx.fill(); }
  ctx.restore();
}
function drawCatchIcon(ctx, key, x, y, size, t = 0) {
  ctx.save(); ctx.translate(x, y);
  if (key === 'lobster') { ctx.rotate(-0.2); drawLobsterSide(ctx, size * 0.75, { t }); }
  else drawFish(ctx, key, size, { t, wig: 0.3 });
  ctx.restore();
}

/* ================= BRAG CARD (a social post) ================= */
function captionFor(c, weather) {
  if (c.key === 'lobster' && c.cl >= 4.4) return CAPTIONS.bigbug;
  if (c.key === 'mahi' && c.weight >= 22) return CAPTIONS.bigmahi;
  if (weather && weather.id === 'glass' && chance(0.5)) return CAPTIONS.glass;
  if (new Date().getDay() === 2 && chance(0.35)) return CAPTIONS.tuesday;
  return pick(CAPTIONS.generic);
}
function bragCardHeight(w) { return 58 + w * 0.8 + 150; }
function drawBragCard(ctx, x, y, w, c, o = {}) {
  const C = CHARS[c.ch]; const h = bragCardHeight(w); const t = o.t || 0;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; rr(ctx, x + 4, y + 8, w, h, 16); ctx.fill();
  ctx.fillStyle = '#ffffff'; rr(ctx, x, y, w, h, 16); ctx.fill();
  ctx.save(); ell(ctx, x + 32, y + 29, 19, 19); ctx.clip(); ctx.fillStyle = '#7fc8e8'; ctx.fillRect(x, y, 70, 60); drawHead(ctx, C, x + 32, y + 34, 15); ctx.restore();
  ctx.strokeStyle = C.color; ctx.lineWidth = 2.5; ell(ctx, x + 32, y + 29, 20, 20); ctx.stroke();
  text(ctx, C.name.toLowerCase(), x + 60, y + 26, { size: 17, color: '#111', weight: 800 });
  text(ctx, o.place || 'Florida Keys', x + 60, y + 45, { size: 14, color: '#333', weight: 500 });
  const iy = y + 58, ih = w * 0.8;
  ctx.save(); ctx.beginPath(); ctx.rect(x, iy, w, ih); ctx.clip(); ctx.translate(x, iy);
  if (o.under) { const g = ctx.createLinearGradient(0, 0, 0, ih); g.addColorStop(0, '#3fb6d6'); g.addColorStop(1, '#0d5f86'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, ih); }
  if (o.night) {   // a flash photo on the boat after dark: the stars, the moon, black water, and everything up close lit white
    drawSky(ctx, w, ih * 0.6, 'night'); drawStars(ctx, w, ih * 0.6, t, 0.8, 50); drawMoon(ctx, w * 0.82, ih * 0.16, w * 0.045, o.moon == null ? 0.5 : o.moon);
    const sg = ctx.createLinearGradient(0, ih * 0.58, 0, ih); sg.addColorStop(0, '#0a1630'); sg.addColorStop(1, '#030812'); ctx.fillStyle = sg; ctx.fillRect(0, ih * 0.58, w, ih * 0.42);
    ctx.fillStyle = 'rgba(255,250,220,0.35)'; for (let i = 0; i < 9; i++) ctx.fillRect(w * 0.82 - 10 + Math.sin(i * 2.3) * 12, ih * 0.62 + i * ih * 0.04, 20 - i, 1.5);
  } else if (!o.under) {
    drawSky(ctx, w, ih * 0.52, 'day');
    drawCloud(ctx, w * 0.2, ih * 0.16, 0.6, 0.85); drawCloud(ctx, w * 0.8, ih * 0.1, 0.45, 0.75);
    const sg = ctx.createLinearGradient(0, ih * 0.5, 0, ih); sg.addColorStop(0, '#1d72b8'); sg.addColorStop(1, '#0b3f6e'); ctx.fillStyle = sg; ctx.fillRect(0, ih * 0.5, w, ih * 0.5);
    ctx.fillStyle = 'rgba(255,255,255,0.2)'; for (let i = 0; i < 18; i++) { const yy = ih * 0.53 + (i % 6) * ih * 0.08; ctx.fillRect((i * 97) % w, yy, 26, 2); }
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(w * (0.1 + i * 0.2), 0); ctx.lineTo(w * (0.2 + i * 0.2), 0); ctx.lineTo(w * (0.05 + i * 0.2), ih); ctx.lineTo(w * (-0.05 + i * 0.2), ih); ctx.fill(); }
  }
  const s = w * 0.085;
  drawHeroShot(ctx, c.ch, c.key === 'lobster' ? { kind: 'lobster', cl: c.cl } : { kind: 'fish', key: c.key, weight: c.weight }, w * 0.5, ih * 0.42, s, t);
  if (o.night) { const fg = ctx.createRadialGradient(w * 0.5, ih * 0.45, ih * 0.15, w * 0.5, ih * 0.45, ih * 0.8); fg.addColorStop(0, 'rgba(0,0,0,0)'); fg.addColorStop(1, 'rgba(0,4,16,0.5)'); ctx.fillStyle = fg; ctx.fillRect(0, 0, w, ih); }
  ctx.restore();
  const ay = iy + ih + 26;
  const heart = (hx, hy, r, fill) => { ctx.beginPath(); ctx.moveTo(hx, hy + r * 0.9); ctx.bezierCurveTo(hx - r * 1.4, hy - r * 0.1, hx - r * 0.6, hy - r * 1.2, hx, hy - r * 0.4); ctx.bezierCurveTo(hx + r * 0.6, hy - r * 1.2, hx + r * 1.4, hy - r * 0.1, hx, hy + r * 0.9); ctx.closePath(); if (fill) { ctx.fillStyle = '#ff3b5c'; ctx.fill(); } else { ctx.strokeStyle = '#111'; ctx.lineWidth = 2.2; ctx.stroke(); } };
  heart(x + 26, ay, 11, true);
  text(ctx, String(c.pts), x + 44, ay + 7, { size: 18, color: '#111', weight: 800 });
  const cx = x + 44 + ctx.measureText(String(c.pts)).width + 26;
  ctx.strokeStyle = '#111'; ctx.lineWidth = 2.2; ell(ctx, cx, ay, 11, 10); ctx.stroke();
  text(ctx, String(o.comments || 3), cx + 18, ay + 7, { size: 18, color: '#111', weight: 700 });
  ctx.strokeStyle = '#111'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(x + w - 30, ay - 10); ctx.lineTo(x + w - 18, ay - 10); ctx.lineTo(x + w - 18, ay + 12); ctx.lineTo(x + w - 24, ay + 6); ctx.lineTo(x + w - 30, ay + 12); ctx.closePath(); ctx.stroke();
  const likers = (o.crew || CHAR_ORDER).filter((k) => k !== c.ch).map((k) => CHARS[k].name.toLowerCase());
  text(ctx, likers.length ? 'Liked by ' + likers.join(', ') + ' and others' : 'Liked by the whole marina', x + 16, ay + 38, { size: 15, color: '#222', weight: 600, maxW: w - 30 });
  ctx.font = fnt(16, 500); const cap = o.caption || captionFor(c, o.weather);
  const nameW = (() => { ctx.font = fnt(16, 800); return ctx.measureText(C.name.toLowerCase() + ' ').width; })();
  text(ctx, C.name.toLowerCase(), x + 16, ay + 62, { size: 16, color: '#111', weight: 800 });
  ctx.font = fnt(16, 500); const lines = wrapText(ctx, cap, w - 36 - nameW);
  text(ctx, lines[0] || '', x + 16 + nameW, ay + 62, { size: 16, color: '#111', weight: 500 });
  if (lines[1]) text(ctx, lines.slice(1).join(' '), x + 16, ay + 82, { size: 16, color: '#111', weight: 500, maxW: w - 30 });
  text(ctx, longDate(), x + 16, y + h - 14, { size: 14, color: '#777', weight: 500 });
  ctx.restore();
  return h;
}


/* ================= SEA LIFE, OTHER BOATS, AND BILLBOARDS FOR THE CHASE CAMERA ================= */
/* Top-down sprites (the overhead view) take (ctx, x, y, s, ang, o): origin at the center, facing +x at ang 0.
   Boats use the drawBoatTop scale (s = 1: a 24 ft center console is ~175 px bow to engines);
   creatures and birds list their own size at s = 1. Light comes from the upper left of the
   screen whatever the heading, so shadows always fall down and to the right.
   The side-view billboards for the chase camera are further down. Test sheet: test/seaart.mjs. */

function saBegin(ctx, x, y, s, ang) { ctx.save(); ctx.translate(x, y); if (ang) ctx.rotate(ang); if (s !== 1) ctx.scale(s, s); }
// a screen-space offset (px) expressed in a rotated, scaled sprite's local units
function saOff(ang, s, dx, dy) { const c = Math.cos(ang), n = Math.sin(ang); return [(dx * c + dy * n) / s, (-dx * n + dy * c) / s]; }
function saHex(r, g, b) { return '#' + ((1 << 24) | (clamp(Math.round(r), 0, 255) << 16) | (clamp(Math.round(g), 0, 255) << 8) | clamp(Math.round(b), 0, 255)).toString(16).slice(1); }
function saMix(a, b, t) { const p = hexRgb(a), q = hexRgb(b); return saHex(lerp(p[0], q[0], t), lerp(p[1], q[1], t), lerp(p[2], q[2], t)); }
function saLum(h) { const p = hexRgb(h); return (p[0] * 0.299 + p[1] * 0.587 + p[2] * 0.114) / 255; }
function saFrac(v) { return v - Math.floor(v); }
const SA_DEEP = '#1b5f86';   // what an animal's colors fade toward the deeper it swims
// a smooth closed (or open) curve through points (Catmull-Rom)
function saSmooth(ctx, P, closed = true) {
  const n = P.length, at = (i) => (closed ? P[(i + n) % n] : P[clamp(i, 0, n - 1)]);
  ctx.beginPath(); ctx.moveTo(P[0][0], P[0][1]);
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    ctx.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
  }
  if (closed) ctx.closePath();
}
// mirror a half outline (nose → tail along the −y side, both ends on the axis) into a closed symmetric one
function saSym(half) { const out = half.slice(); for (let i = half.length - 2; i > 0; i--) out.push([half[i][0], -half[i][1]]); return out; }
// a gradient that is light on the sun side of a rotated sprite
function saLightGrad(ctx, ang, r, c1, c2, c3) {
  const [lx, ly] = saOff(ang, 1, -0.6, -0.8);
  const g = ctx.createLinearGradient(lx * r, ly * r, -lx * r, -ly * r);
  g.addColorStop(0, c1); if (c3) { g.addColorStop(0.5, c2); g.addColorStop(1, c3); } else g.addColorStop(1, c2);
  return g;
}
// many small ellipses [x, y, rx, ry, rot] in one path (one fill instead of dozens)
function saDots(ctx, list) { ctx.beginPath(); for (const d of list) { ctx.moveTo(d[0] + d[2] * Math.cos(d[4] || 0), d[1] + d[2] * Math.sin(d[4] || 0)); ctx.ellipse(d[0], d[1], d[2], d[3], d[4] || 0, 0, TAU); } }
// soft dark halo that lifts an underwater animal off the water at any size
function saHalo(ctx, x, y, rx, ry, a = 0.16) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, 1); g.addColorStop(0, `rgba(3,28,44,${a})`); g.addColorStop(0.6, `rgba(3,28,44,${a * 0.75})`); g.addColorStop(1, 'rgba(3,28,44,0)');
  ctx.save(); ctx.translate(x, y); ctx.scale(rx, ry); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 1, 0, TAU); ctx.fill(); ctx.restore();
}

/* ---------- sea life from above ---------- */
// West Indian manatee. s = 1 → ~108 px nose to tail. o: t (s), surfacing 0..1 (snout up: nostrils open, ripples, drier colors), depth 0..1 (water tint override), phase
function drawManateeTop(ctx, x, y, s, ang = 0, o = {}) {
  const t = (o.t || 0) + (o.phase || 0), up = clamp(+o.surfacing || 0, 0, 1);
  const dep = o.depth != null ? o.depth : 0.42 * (1 - up), T = (c) => (dep > 0 ? saMix(c, SA_DEEP, dep) : c);
  const sway = Math.sin(t * 1.25), stroke = Math.cos(t * 2.5), lw = (w) => Math.max(w, 0.7 / s);
  saBegin(ctx, x, y, s, ang);
  saHalo(ctx, -4, 0, 62, 26, 0.2);
  // paddle tail: sways a little and foreshortens as it strokes up and down
  ctx.save(); ctx.translate(-29, 0); ctx.rotate(sway * 0.16); ctx.scale(0.86 + 0.14 * stroke, 1);
  const tail = saSym([[3, 0], [-2, -7.5], [-9, -14], [-18, -16.4], [-25.5, -13], [-29, -6], [-29.6, 0]]);
  saSmooth(ctx, tail);
  let g = ctx.createLinearGradient(0, -16, 0, 16); g.addColorStop(0, T('#5b5d55')); g.addColorStop(0.45, T('#7e8075')); g.addColorStop(1, T('#575950'));
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = rgba(T('#33352f'), 0.45); ctx.lineWidth = lw(0.9); ctx.stroke();
  ctx.strokeStyle = rgba(T('#3b3d36'), 0.17); ctx.lineWidth = lw(0.7);
  ctx.beginPath(); for (let i = 0; i < 4; i++) { ctx.moveTo(-6 - i * 5, -9 - i * 1.5); ctx.quadraticCurveTo(-8 - i * 5, 0, -6 - i * 5, 9 + i * 1.5); } ctx.stroke();
  ctx.restore();
  // flippers, paddling slowly
  for (const d of [-1, 1]) {
    ctx.save(); ctx.translate(18, d * 11.5); ctx.rotate(d * (Math.PI / 2 + 0.62 + Math.sin(t * 1.1 + d) * 0.24)); ctx.scale(1, d);
    saSmooth(ctx, [[-1, -3.8], [8, -4.6], [15, -3.6], [18.6, -0.4], [15.4, 3.4], [8, 4.2], [-1, 3.8]]);
    ctx.fillStyle = T('#65675e'); ctx.fill(); ctx.strokeStyle = rgba(T('#33352f'), 0.45); ctx.lineWidth = lw(0.8); ctx.stroke();
    ctx.fillStyle = rgba(T('#e2ddcb'), 0.85); saDots(ctx, [-1, 0, 1].map((k) => [15.2 - Math.abs(k) * 0.8, k * 1.9, 0.9, 0.7])); ctx.fill();
    ctx.restore();
  }
  // body
  const body = saSym([[51.5, 0], [50.2, -5.4], [46, -8.8], [40, -8.6], [34, -9.6], [25, -14], [12, -17.4], [-4, -17.2], [-17, -13.8], [-26, -9.2], [-31, -6.6], [-33, 0]]);
  saSmooth(ctx, body);
  g = ctx.createRadialGradient(6, -6, 2, 4, 0, 48); g.addColorStop(0, T('#a4a598')); g.addColorStop(0.5, T('#828477')); g.addColorStop(1, T('#595b53'));
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.clip();
  const rng = mulberry(41);
  ctx.fillStyle = rgba(T('#6f8247'), 0.26);   // algae on the back
  const al = []; for (let i = 0; i < 7; i++) al.push([lerp(-26, 30, rng()), lerp(-11, 11, rng()), 5 + rng() * 8, 3 + rng() * 5, rng() * 3]); saDots(ctx, al); ctx.fill();
  ctx.fillStyle = rgba(T('#c9c8b8'), 0.35);   // speckles
  const sk = []; for (let i = 0; i < 26; i++) sk.push([lerp(-28, 40, rng()), lerp(-14, 14, rng()), 0.7, 0.7]); saDots(ctx, sk); ctx.fill();
  ctx.strokeStyle = rgba(T('#dfe2d4'), 0.55); ctx.lineWidth = lw(1.05); ctx.lineCap = 'round';   // old prop scars
  for (const [sx, sy, a, n, len] of [[-4, -3, 0.55, 3, 17], [-21, 6, -0.45, 2, 11]]) {
    ctx.beginPath(); for (let i = 0; i < n; i++) { const ox = Math.cos(a + Math.PI / 2) * i * 2.8, oy = Math.sin(a + Math.PI / 2) * i * 2.8; ctx.moveTo(sx + ox - Math.cos(a) * len / 2, sy + oy - Math.sin(a) * len / 2); ctx.quadraticCurveTo(sx + ox + 1.2, sy + oy - 1.2, sx + ox + Math.cos(a) * len / 2, sy + oy + Math.sin(a) * len / 2); } ctx.stroke();
  }
  ctx.strokeStyle = rgba(T('#34362f'), 0.34); ctx.lineWidth = lw(0.8);   // neck and shoulder folds
  ctx.beginPath(); for (let i = 0; i < 4; i++) { const fx = 27 + i * 2.6; ctx.moveTo(fx, -10 + i * 0.4); ctx.quadraticCurveTo(fx + 2.4, 0, fx, 10 - i * 0.4); } ctx.stroke();
  ctx.fillStyle = `rgba(255,255,255,${0.07 + 0.16 * up})`; ell(ctx, 6, -6.5, 26, 4, -0.05); ctx.fill();   // wet sheen
  ctx.restore();
  saSmooth(ctx, body); ctx.strokeStyle = rgba(T('#2f312b'), 0.5); ctx.lineWidth = lw(1); ctx.stroke();
  // the big bristly muzzle, its wrinkles and whisker pores
  const mg = ctx.createRadialGradient(47, -2, 0.5, 46.5, 0, 8); mg.addColorStop(0, T('#a2a396')); mg.addColorStop(1, T('#7e8075'));
  ctx.fillStyle = mg; ell(ctx, 46.2, 0, 5, 7.8); ctx.fill();
  ctx.strokeStyle = rgba(T('#34362f'), 0.3); ctx.lineWidth = lw(0.6);
  for (const wx of [41.2, 43.2]) { ctx.beginPath(); ctx.moveTo(wx, -6.8); ctx.quadraticCurveTo(wx + 1.3, 0, wx, 6.8); ctx.stroke(); }
  ctx.fillStyle = rgba(T('#3a3b34'), 0.45); const wr = mulberry(9);
  const wp = []; for (let i = 0; i < 16; i++) { const a = wr() * TAU, rr2 = 0.35 + 0.65 * Math.sqrt(wr()); wp.push([46.4 + Math.cos(a) * rr2 * 3.8, Math.sin(a) * rr2 * 6.6, 0.38, 0.38]); } saDots(ctx, wp); ctx.fill();
  ctx.fillStyle = T('#1f201c'); for (const d of [-1, 1]) { ell(ctx, 37.5, d * 8.4, 0.9, 0.7); ctx.fill(); }   // little eyes on the edge
  if (up > 0.02) {   // rings spreading from the snout where it breaks the surface, pushed along by its swimming
    const sl = ctx.createRadialGradient(47, 0, 2, 47, 0, 20); sl.addColorStop(0, `rgba(220,245,250,${0.2 * up})`); sl.addColorStop(1, 'rgba(220,245,250,0)');
    ctx.fillStyle = sl; ell(ctx, 47, 0, 20, 18); ctx.fill();   // the smooth slick a manatee leaves where it breathes
    for (let k = 0; k < 2; k++) {
      const p = saFrac(t * 0.4 + k / 2), r = 8 + p * 26;
      ctx.strokeStyle = `rgba(255,255,255,${(1 - p) * 0.5 * up})`; ctx.lineWidth = lw(1.0 * (1 - p) + 0.3);
      ctx.beginPath(); ctx.ellipse(48, 0, r * 1.1, r, 0, -2.3, 2.3); ctx.stroke();
    }
    ctx.fillStyle = `rgba(255,255,255,${0.5 * up})`; saDots(ctx, [0, 1, 2, 3, 4].map((k) => { const a = k * 1.3 + 0.5 + Math.sin(t * 1.4 + k) * 0.2; return [47 + Math.cos(a) * 6.5, Math.sin(a) * 8.6, 1.1, 0.8, a]; })); ctx.fill();
    ctx.fillStyle = `rgba(255,255,255,${0.22 * up})`; ell(ctx, 46.5, -2.5, 3, 1.6, -0.2); ctx.fill();   // wet shine on the snout
  }
  // nostrils on top of the snout tip: two flaps that open when it breathes
  for (const d of [-1, 1]) {
    if (up > 0.05) { ctx.fillStyle = '#1d1e1a'; ell(ctx, 49.6, d * 2.1, 0.5 + 0.5 * up, 1.0 + 0.3 * up, d * 0.35); ctx.fill(); }
    else { ctx.strokeStyle = rgba(T('#2a2b26'), 0.6); ctx.lineWidth = lw(0.55); ctx.beginPath(); ctx.moveTo(49.3, d * 1.3); ctx.lineTo(49.9, d * 3.0); ctx.stroke(); }
  }
  ctx.restore();
}

// Bottlenose dolphin. s = 1 → 100 px beak to flukes. o: t, up 0..1 (0 = riding just under the surface, 1 = clear of the water: brighter, bigger, shadow and splash), depth, phase
function drawDolphinTop(ctx, x, y, s, ang = 0, o = {}) {
  const t = o.t || 0, up = clamp(o.up || 0, 0, 1), dep = o.depth != null ? o.depth : 0.34 * (1 - up);
  const T = (c) => { let k = dep > 0 ? saMix(c, SA_DEEP, dep) : c; return up > 0 ? saMix(k, '#ffffff', 0.1 * up) : k; };
  const ph = t * 5.2 + (o.phase || 0), lw = (w) => Math.max(w, 0.7 / s);
  const body = saSym([[50, 0], [48.5, -1.4], [43, -2.3], [39.6, -3.5], [35.6, -6.8], [28.5, -9.6], [16, -11.2], [2, -10.8], [-12, -8.4], [-25, -5.2], [-33, -3.1], [-38, -2.3], [-40, 0]]);
  const fluke = saSym([[2, 0], [-2, -3.6], [-6.2, -8.6], [-10.4, -13.6], [-13.8, -15.6], [-14.8, -13.6], [-12.8, -8.2], [-12.4, -3.6], [-13.8, -0.9], [-12.9, 0]]);
  const fk = 0.68 + 0.32 * Math.abs(Math.cos(ph)), fs = Math.sin(ph * 0.5) * 0.1;
  const flukes = (c) => { ctx.save(); ctx.translate(-37.5, 0); ctx.rotate(fs); ctx.scale(fk, 1); saSmooth(ctx, fluke); ctx.fillStyle = c; ctx.fill(); ctx.restore(); };
  saBegin(ctx, x, y, s, ang);
  if (up > 0.02) {
    // its shadow on the water, and the hole it tore in the surface
    const [ox, oy] = saOff(ang, 1, 16 * up, 24 * up);
    ctx.save(); ctx.translate(ox, oy); ctx.scale(0.96, 0.96); const sh = `rgba(0,26,42,${0.24 * up})`;
    saSmooth(ctx, body); ctx.fillStyle = sh; ctx.fill(); flukes(sh); ctx.restore();
    const w = Math.min(1, up * 3) * (1 - up * 0.4), fr = mulberry(17);
    ctx.fillStyle = `rgba(190,240,245,${0.3 * w})`; ell(ctx, -33, 0, 16 + 6 * up, 10 + 3 * up); ctx.fill();   // aerated water
    const fo = [], dr = [];
    for (let i = 0; i < 16; i++) {   // a broken crescent of foam behind the tail
      const a = Math.PI + (fr() - 0.5) * 2.6, rr2 = 9 + fr() * 9, j = Math.sin(t * 3 + i) * 0.8;
      fo.push([-30 + Math.cos(a) * rr2 * 0.9 + j, Math.sin(a) * rr2 * 0.85, 1.6 + fr() * 2.6, 1.1 + fr() * 1.6, a]);
    }
    ctx.fillStyle = `rgba(255,255,255,${0.65 * w})`; saDots(ctx, fo); ctx.fill();
    for (let i = 0; i < 14; i++) {   // droplets flung up and falling back
      const p = saFrac(t * 1.3 + i * 0.37), a = Math.PI + (fr() - 0.5) * 3, dd = 8 + 26 * p, r = 1.3 * (1 - p * 0.6);
      if (p < 0.8) dr.push([-26 + Math.cos(a) * dd * 0.9, Math.sin(a) * dd * 0.8, r, r]);
    }
    ctx.fillStyle = `rgba(255,255,255,${0.8 * Math.min(1, up * 2.5)})`; saDots(ctx, dr); ctx.fill();
  }
  const k = 1 + 0.26 * up; ctx.scale(k, k);
  if (up < 0.6) saHalo(ctx, -2, 0, 52, 16, 0.14 * (1 - up));
  // flukes and flippers under the body
  flukes(T('#4d5f6d'));
  for (const d of [-1, 1]) {
    ctx.save(); ctx.translate(21, d * 8.6); ctx.rotate(d * (Math.PI / 2 + 0.95 + Math.sin(ph * 0.5 + d) * 0.12)); ctx.scale(1, d);
    saSmooth(ctx, [[0, -2.4], [6, -2.7], [11, -1.4], [13.4, 0.6], [10, 2.1], [4, 2.6], [0, 2.4]]); ctx.fillStyle = T('#536573'); ctx.fill(); ctx.restore();
  }
  saSmooth(ctx, body);
  const g = ctx.createLinearGradient(0, -11.2, 0, 11.2);
  g.addColorStop(0, T('#a9b8c2')); g.addColorStop(0.28, T('#738797')); g.addColorStop(0.5, T('#4c5f6e')); g.addColorStop(0.72, T('#738797')); g.addColorStop(1, T('#a9b8c2'));
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = rgba(T('#22323e'), 0.42); ctx.lineWidth = lw(0.9); ctx.stroke();
  // dorsal fin seen from above: a swept sliver, lit on one side
  ctx.fillStyle = T('#3a4b58'); saSmooth(ctx, [[7, 0], [-1, -1.7], [-11, -1.8], [-16.5, -0.6], [-12, 1.1], [-1, 1.5]]); ctx.fill();
  ctx.strokeStyle = `rgba(255,255,255,${0.22 + 0.2 * up})`; ctx.lineWidth = lw(0.7); ctx.beginPath(); ctx.moveTo(5, -0.6); ctx.lineTo(-13, -1.2); ctx.stroke();
  ctx.fillStyle = `rgba(255,255,255,${0.16 + 0.24 * up})`; ell(ctx, 13, -4.6, 18, 1.6, -0.04); ctx.fill();
  ctx.strokeStyle = rgba(T('#15212a'), 0.85); ctx.lineWidth = lw(0.9); ctx.beginPath(); ctx.arc(28.5, 0, 1.6, Math.PI * 0.62, Math.PI * 1.38); ctx.stroke();   // blowhole
  ctx.fillStyle = T('#1a242c'); for (const d of [-1, 1]) { ell(ctx, 37, d * 5.6, 0.8, 0.6); ctx.fill(); }
  if (up < 0.5) {   // the surface glinting over its back
    ctx.strokeStyle = `rgba(255,255,255,${0.32 * (1 - up * 2)})`; ctx.lineWidth = lw(0.9);
    for (let i = 0; i < 4; i++) { const gx = 30 - i * 17 + Math.sin(t * 2 + i) * 2, gy = (i % 2 ? 4 : -5); ctx.beginPath(); ctx.moveTo(gx - 5, gy); ctx.quadraticCurveTo(gx, gy - 1.6, gx + 5, gy); ctx.stroke(); }
  }
  ctx.restore();
}

// Sea turtle. s = 1 → ~60 px head to tail (shell 42), front flippers ~70 px across. o: t, depth, phase
function drawTurtleTop(ctx, x, y, s, ang = 0, o = {}) {
  const t = o.t || 0, dep = o.depth != null ? o.depth : 0.2, T = (c) => (dep > 0 ? saMix(c, SA_DEEP, dep) : c);
  const ph = t * 1.9 + (o.phase || 0), sw = Math.sin(ph), lw = (w) => Math.max(w, 0.6 / s);
  saBegin(ctx, x, y, s, ang);
  saHalo(ctx, 2, 0, 34, 26, 0.16);
  const fl = T('#6c5832'), flE = T('#d8c48c'), out = rgba(T('#2c210f'), 0.5);
  // rear flippers
  for (const d of [-1, 1]) {
    ctx.save(); ctx.translate(-15, d * 9); ctx.rotate(d * (Math.PI - 0.62 + Math.sin(ph + 1) * 0.16)); ctx.scale(1, d);
    saSmooth(ctx, [[0, -2.8], [5, -3.1], [9.6, -1.2], [10.2, 1], [5, 2.8], [0, 2.6]]); ctx.fillStyle = fl; ctx.fill(); ctx.strokeStyle = out; ctx.lineWidth = lw(0.6); ctx.stroke(); ctx.restore();
  }
  // front flippers: a slow wing-beat, foreshortened on the recovery
  for (const d of [-1, 1]) {
    ctx.save(); ctx.translate(10, d * 12.5); ctx.rotate(d * (Math.PI / 2 + 0.22 + 0.58 * sw)); ctx.scale(0.86 + 0.14 * Math.cos(ph), d);
    const fp = [[0, -3.8], [9, -4.7], [19, -3.8], [27, -1.6], [29, 0.4], [22.5, 2.4], [11, 3.7], [0, 3.8]];
    saSmooth(ctx, fp); ctx.fillStyle = fl; ctx.fill(); ctx.strokeStyle = out; ctx.lineWidth = lw(0.6); ctx.stroke();
    ctx.save(); saSmooth(ctx, fp); ctx.clip();
    ctx.strokeStyle = flE; ctx.lineWidth = lw(1.3); ctx.beginPath(); ctx.moveTo(0, -3.8); ctx.quadraticCurveTo(15, -5.2, 29, 0.4); ctx.stroke();
    ctx.strokeStyle = rgba(T('#d8c48c'), 0.45); ctx.lineWidth = lw(0.6);
    ctx.beginPath(); for (let i = 1; i < 5; i++) { ctx.moveTo(i * 5.4, -4.5); ctx.lineTo(i * 5.4 - 1.5, 3.8); } ctx.stroke();
    ctx.restore(); ctx.restore();
  }
  ctx.fillStyle = fl; ctx.beginPath(); ctx.moveTo(-19, -1.4); ctx.lineTo(-25, 0); ctx.lineTo(-19, 1.4); ctx.fill();   // tail
  // neck and head with its plated scales
  ctx.fillStyle = T('#9b8858'); ell(ctx, 20, 0, 5.4, 5.4); ctx.fill();
  ctx.fillStyle = T('#7f6b3b'); ell(ctx, 27, 0, 8, 6.4); ctx.fill(); ctx.strokeStyle = out; ctx.lineWidth = lw(0.6); ctx.stroke();
  ctx.save(); ell(ctx, 27, 0, 8, 6.4); ctx.clip();
  const hg = ctx.createRadialGradient(28, -2, 0.5, 27, 0, 8); hg.addColorStop(0, T('#b8a066')); hg.addColorStop(1, T('#7a663a'));
  ctx.fillStyle = hg; ctx.fillRect(18, -8, 18, 16);
  ctx.strokeStyle = rgba(T('#33260f'), 0.55); ctx.lineWidth = lw(0.55); ctx.beginPath();   // the plates on top of the head
  ctx.moveTo(35, 0); ctx.lineTo(31, 0); ctx.moveTo(33.5, -3.6); ctx.lineTo(31, 0); ctx.lineTo(33.5, 3.6);
  ctx.moveTo(31, 0); ctx.lineTo(28.5, -2.4); ctx.lineTo(25, -2.6); ctx.moveTo(31, 0); ctx.lineTo(28.5, 2.4); ctx.lineTo(25, 2.6);
  ctx.moveTo(28.5, -2.4); ctx.lineTo(28.5, 2.4); ctx.moveTo(25, -2.6); ctx.lineTo(22.5, -4.5); ctx.moveTo(25, 2.6); ctx.lineTo(22.5, 4.5); ctx.moveTo(25, -2.6); ctx.lineTo(25, 2.6); ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#16120a'; for (const d of [-1, 1]) { ell(ctx, 29.8, d * 4.9, 1.3, 0.8, d * 0.3); ctx.fill(); }
  // shell
  const shell = saSym([[21.5, 0], [20, -7.6], [14.2, -14.4], [5, -17.8], [-5, -16.8], [-13.2, -12.2], [-18.6, -6], [-21, 0]]);
  saSmooth(ctx, shell);
  const g = ctx.createRadialGradient(3, -4, 2, 1, 0, 22); g.addColorStop(0, T('#ab8a46')); g.addColorStop(0.55, T('#7b5d2a')); g.addColorStop(1, T('#4a3417'));
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.clip();
  const seam = rgba(T('#e8cf94'), 0.62), streak = rgba(T('#3b2610'), 0.32);
  const vx = [13, 5.6, -1.8, -9.2, -16], vw = [5, 6, 6.2, 5.4, 4];
  // radiating streaks in every plate
  ctx.strokeStyle = streak; ctx.lineWidth = lw(0.7);
  const plates = []; vx.forEach((cx, i) => { plates.push([cx, 0]); if (i < 4) for (const d of [-1, 1]) plates.push([cx - 3.6, d * (vw[i] + 5.2)]); });
  ctx.beginPath(); for (const [px, py] of plates) for (let k = 0; k < 7; k++) { const a = k * 0.9 + px; ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(a) * 3.6, py + Math.sin(a) * 3.6); } ctx.stroke();
  ctx.strokeStyle = seam; ctx.lineWidth = lw(0.85);
  ctx.beginPath();
  vx.forEach((cx, i) => {   // the row of plates down the spine, and the seams out to the edge
    const hw = vw[i]; ctx.moveTo(cx + 3.7, 0); ctx.lineTo(cx + 2.4, -hw); ctx.lineTo(cx - 2.4, -hw); ctx.lineTo(cx - 3.7, 0); ctx.lineTo(cx - 2.4, hw); ctx.lineTo(cx + 2.4, hw); ctx.closePath();
    if (i < 4) for (const d of [-1, 1]) { ctx.moveTo(cx - 2.4, d * hw); ctx.lineTo(cx - 4.4, d * 20); }
  });
  ctx.stroke();
  ctx.restore();
  ctx.save(); ctx.translate(0.5, 0); ctx.scale(0.86, 0.84); saSmooth(ctx, shell); ctx.restore(); ctx.strokeStyle = seam; ctx.lineWidth = lw(0.8); ctx.stroke();   // the rim of edge plates
  ctx.save(); saSmooth(ctx, shell); ctx.clip(); ctx.strokeStyle = seam; ctx.lineWidth = lw(0.6);
  ctx.beginPath(); for (let i = 0; i < 26; i++) { const a = (i / 26) * TAU; ctx.moveTo(Math.cos(a) * 17, Math.sin(a) * 14); ctx.lineTo(Math.cos(a) * 24, Math.sin(a) * 20); } ctx.stroke();
  ctx.restore();
  saSmooth(ctx, shell); ctx.strokeStyle = rgba(T('#2a1c0a'), 0.6); ctx.lineWidth = lw(0.9); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.1)'; ell(ctx, 4, -7, 11, 3.5, -0.15); ctx.fill();
  ctx.restore();
}

// Spotted eagle ray. s = 1 → 80 px wingtip to wingtip, the whip tail trails ~95 px behind. o: t, depth, phase
function drawRayTop(ctx, x, y, s, ang = 0, o = {}) {
  const t = o.t || 0, dep = o.depth != null ? o.depth : 0.24, T = (c) => (dep > 0 ? saMix(c, SA_DEEP, dep) : c);
  const ph = t * 2.3 + (o.phase || 0), fy = 0.8 + 0.2 * Math.cos(ph), W = 40 * fy, tipX = -6 - 5 * Math.sin(ph), lw = (w) => Math.max(w, 0.6 / s);
  saBegin(ctx, x, y, s, ang);
  saHalo(ctx, 0, 0, 44 * fy + 4, 24, 0.15);
  // whip tail
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = T('#1a242d');
  for (let r = 0; r < 4; r++) { ctx.lineWidth = lw(2.2 * (1 - (r + 0.5) / 4) + 0.35); ctx.beginPath(); for (let i = r * 6; i <= r * 6 + 6; i++) { const u = i / 24, nx = -19 - u * 96, ny = Math.sin(u * 7 - t * 3.2) * 3.2 * u; i === r * 6 ? ctx.moveTo(nx, ny) : ctx.lineTo(nx, ny); } ctx.stroke(); }
  ctx.fillStyle = T('#1a242d'); ctx.beginPath(); ctx.moveTo(-18, -1.5); ctx.lineTo(-25, 0); ctx.lineTo(-18, 1.5); ctx.fill();
  const half = [[27.5, 0], [26.4, -2.8], [23, -4.9], [19, -6], [15.6, -7.2], [8, -0.36 * W], [0.5, -0.68 * W], [tipX + 1.6, -0.95 * W], [tipX, -W], [tipX - 1.6, -0.95 * W], [tipX - 3.6, -0.83 * W], [-9.4, -0.58 * W], [-11, -0.33 * W], [-13.4, -0.17 * W], [-17.2, -0.14 * W], [-19.4, -3], [-20, 0]];
  const body = saSym(half);
  saSmooth(ctx, body);
  const g = ctx.createLinearGradient(0, -W, 0, W); g.addColorStop(0, T('#151e26')); g.addColorStop(0.5, T('#2d3c48')); g.addColorStop(1, T('#151e26'));
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.clip();
  const rng = mulberry(77), dots = [], rings = []; ctx.fillStyle = T('#eaf3f6'); ctx.strokeStyle = T('#eaf3f6');
  for (let row = 0; row < 7; row++) for (let col = -8; col <= 8; col++) {   // spots on a jittered grid in wing space, so they stretch with the flap
    const u = (col + (rng() - 0.5) * 0.7) / 9.2, au = Math.abs(u), v = (row + 0.5 + (rng() - 0.5) * 0.6) / 7;
    if (au > 0.9 || rng() < 0.12) continue;
    const lead = lerp(15, tipX + 1, Math.pow(au, 0.8)) - 1.5, trail = lerp(-15, tipX - 2, Math.pow(au, 1.1)) + 1.5; if (lead - trail < 2) continue;
    const sx = lerp(trail, lead, v), sy = u * W, r = (0.55 + rng() * 0.6) * (1 - au * 0.3);
    if (rng() < 0.16) rings.push([sx, sy, r * 1.3, r * 1.3]); else dots.push([sx, sy, r, r]);
  }
  saDots(ctx, dots); ctx.fill(); ctx.lineWidth = lw(0.45); saDots(ctx, rings); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = lw(1.4); ctx.beginPath(); ctx.moveTo(24, 0); ctx.lineTo(-19, 0); ctx.stroke();
  ctx.restore();
  saSmooth(ctx, body); ctx.strokeStyle = rgba(T('#0b1218'), 0.6); ctx.lineWidth = lw(0.8); ctx.stroke();
  for (const d of [-1, 1]) { ctx.fillStyle = T('#111a21'); ell(ctx, 18.6, d * 6.3, 1.7, 1.4); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ell(ctx, 19.1, d * 6.1, 0.5, 0.5); ctx.fill(); }
  ctx.restore();
}

/* ---------- birds from above ---------- */
const SA_BIRDS = {
  // wing: [shoulder x, y], [wrist], [tip], trailing [near tip], [mid], [root]; sizes for s = 1
  pelican: { rate: 3.0, amp: 0.85, wing: [[5, 5], [3, 23], [-9, 50], [-18, 45], [-17, 22], [-11, 5]], fingers: true,
    body: '#7c7366', back: '#a69d8f', cov: '#aba293', wingC: '#8a8174', tip: '#2b2622', head: '#efe2b8', nape: '#4b3627', bill: '#c9a26a', tail: '#5a5248' },
  gull: { rate: 7.2, amp: 0.9, wing: [[3, 2.6], [3.4, 12.5], [-10.5, 28.5], [-11.6, 26.4], [-9, 11.5], [-5.5, 2.6]], tipK: 0.7,
    body: '#f2f4f5', back: '#a2adb5', cov: '#a6b1b9', wingC: '#98a4ad', tip: '#1c1e21', head: '#26272b', bill: '#8e2c2c', tail: '#f4f6f7' }
};
function saBirdWing(ctx, B, f, d) {
  const w = B.wing, sk = 1 - 0.3 * f * f, fold = 1 - 0.16 * Math.max(0, f), bx = -5 * f;
  const P = [[w[0][0], w[0][1]], [w[1][0] + 2 * f, w[1][1] * sk], [w[2][0] + bx, w[2][1] * sk * fold], [w[3][0] + bx, w[3][1] * sk * fold], [w[4][0], w[4][1] * sk], [w[5][0], w[5][1]]].map((p) => [p[0], p[1] * d]);
  return P;
}
function saBird(ctx, kind, x, y, s, ang, o) {
  const B = SA_BIRDS[kind], t = o.t || 0, f = Math.sin(t * B.rate + (o.phase || 0)) * B.amp * (o.glide != null ? 1 - o.glide : 1), lw = (w) => Math.max(w, 0.6 / s);
  saBegin(ctx, x, y, s, ang);
  for (const d of [-1, 1]) {
    const P = saBirdWing(ctx, B, f, d), tipY = P[2][1];
    ctx.beginPath(); ctx.moveTo(P[0][0], P[0][1]); ctx.quadraticCurveTo(P[1][0] + 3, (P[0][1] + P[1][1]) / 2, P[1][0], P[1][1]); ctx.quadraticCurveTo((P[1][0] + P[2][0]) / 2 + 2, (P[1][1] + P[2][1]) / 2, P[2][0], P[2][1]);
    ctx.lineTo(P[3][0], P[3][1]); ctx.quadraticCurveTo((P[3][0] + P[4][0]) / 2 - 2, (P[3][1] + P[4][1]) / 2, P[4][0], P[4][1]); ctx.quadraticCurveTo(P[5][0] - 2, (P[4][1] + P[5][1]) / 2, P[5][0], P[5][1]); ctx.closePath();
    const shade = 0.14 * Math.abs(f);
    ctx.fillStyle = saMix(B.wingC, '#000000', shade); ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = saMix(B.cov, '#000000', shade); ctx.beginPath(); ctx.moveTo(P[0][0] + 1, P[0][1]); ctx.lineTo(P[1][0] + 0.5, P[1][1]); ctx.lineTo(lerp(P[1][0], P[4][0], 0.45), lerp(P[1][1], P[4][1], 0.45)); ctx.lineTo(lerp(P[0][0], P[5][0], 0.45), P[5][1]); ctx.closePath(); ctx.fill();
    if (kind === 'pelican') { ctx.strokeStyle = saMix('#4a4036', '#000000', shade); ctx.lineWidth = lw(3); ctx.beginPath(); ctx.moveTo(P[5][0] - 0.5, P[5][1]); ctx.quadraticCurveTo((P[4][0] + P[5][0]) / 2 - 2, (P[4][1] + P[5][1]) / 2, P[4][0], P[4][1]); ctx.lineTo(P[3][0], P[3][1]); ctx.stroke(); }   // dark flight feathers
    const tk = B.tipK || 0.5;
    ctx.fillStyle = B.tip; ctx.beginPath(); ctx.moveTo(lerp(P[1][0], P[2][0], tk), lerp(P[1][1], P[2][1], tk)); ctx.lineTo(P[2][0] + 6, tipY * 1.1); ctx.lineTo(P[3][0] - 6, tipY * 1.1); ctx.lineTo(lerp(P[4][0], P[3][0], tk - 0.08), lerp(P[4][1], P[3][1], tk - 0.08)); ctx.closePath(); ctx.fill();
    if (kind === 'gull') { ctx.fillStyle = '#ffffff'; ell(ctx, P[2][0] - 0.6, tipY * 0.95, 0.8, 0.8); ctx.fill(); }
    ctx.restore();
    if (B.fingers) {   // the pelican's splayed primaries
      ctx.strokeStyle = B.tip; ctx.lineCap = 'round';
      for (let i = 0; i < 4; i++) { const k = i / 3, bx = lerp(P[2][0], P[3][0], k), by = lerp(P[2][1], P[3][1], k); ctx.lineWidth = lw(2.2 - k * 0.5); ctx.beginPath(); ctx.moveTo(bx + 2, by * 0.94); ctx.lineTo(bx - 2 - k * 2, by + d * (2.6 - k * 0.6)); ctx.stroke(); }
    }
  }
  if (kind === 'pelican') {
    ctx.fillStyle = B.tail; saSmooth(ctx, [[-16, -3.4], [-24, -4.6], [-25.5, 0], [-24, 4.6], [-16, 3.4]]); ctx.fill();
    ctx.fillStyle = B.body; ell(ctx, -2, 0, 17, 6.4); ctx.fill();
    ctx.fillStyle = B.back; ell(ctx, -3, 0, 12, 3.6); ctx.fill();
    ctx.fillStyle = B.nape; ell(ctx, 11, 0, 5.4, 3); ctx.fill();
    ctx.fillStyle = B.head; ell(ctx, 15, 0, 4.4, 3.8); ctx.fill();
    const bg = ctx.createLinearGradient(17, 0, 41, 0); bg.addColorStop(0, saMix(B.bill, '#8a6a40', 0.3)); bg.addColorStop(1, B.bill);
    ctx.fillStyle = bg; ctx.beginPath(); ctx.moveTo(17, -2.2); ctx.lineTo(39, -1.3); ctx.quadraticCurveTo(41.6, 0, 39, 1.3); ctx.lineTo(17, 2.2); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(80,60,30,0.5)'; ctx.lineWidth = lw(0.5); ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(38.5, 0); ctx.stroke();
    ctx.fillStyle = '#141414'; for (const d of [-1, 1]) { ell(ctx, 16.4, d * 2.9, 0.7, 0.55); ctx.fill(); }
  } else {
    ctx.fillStyle = B.tail; saSmooth(ctx, [[-8, -2.6], [-13.4, -3.6], [-14.2, 0], [-13.4, 3.6], [-8, 2.6]]); ctx.fill();
    ctx.fillStyle = B.body; ell(ctx, -1, 0, 9.6, 3.6); ctx.fill();
    ctx.fillStyle = B.back; ell(ctx, 0.5, 0, 6.2, 3.5); ctx.fill();
    ctx.fillStyle = B.head; ell(ctx, 8, 0, 3.2, 2.7); ctx.fill();
    ctx.fillStyle = B.bill; ctx.beginPath(); ctx.moveTo(10.4, -0.9); ctx.lineTo(14.2, 0); ctx.lineTo(10.4, 0.9); ctx.fill();
  }
  ctx.restore();
}
// Brown pelican flying. s = 1 → 100 px wingspan. o: t, phase, glide 0..1 (1 = wings held still)
function drawPelicanTop(ctx, x, y, s, ang = 0, o = {}) { saBird(ctx, 'pelican', x, y, s, ang, o); }
// Laughing gull flying. s = 1 → 56 px wingspan. o: t, phase, glide
function drawGullTop(ctx, x, y, s, ang = 0, o = {}) { saBird(ctx, 'gull', x, y, s, ang, o); }
// The bird's soft shadow on the water. Same (x, y, s, ang) as the bird; o: t, phase, glide, kind ('pelican' | 'gull'), alt = screen px the shadow falls from the bird (default 40·s)
function drawBirdShadow(ctx, x, y, s, ang = 0, o = {}) {
  const B = SA_BIRDS[o.kind === 'pelican' ? 'pelican' : 'gull'], t = o.t || 0, alt = o.alt != null ? o.alt : 40 * s;
  const f = Math.sin(t * B.rate + (o.phase || 0)) * B.amp * (o.glide != null ? 1 - o.glide : 1);
  saBegin(ctx, x + alt * 0.55, y + alt * 0.85, s, ang);
  const L = B === SA_BIRDS.pelican ? 1 : 0.55;
  for (const [k, a] of [[1.12, 0.07], [1, 0.12]]) {
    ctx.save(); ctx.scale(k, k); ctx.fillStyle = `rgba(0,26,44,${a})`;
    for (const d of [-1, 1]) { const P = saBirdWing(ctx, B, f, d); ctx.beginPath(); ctx.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length; i++) ctx.lineTo(P[i][0], P[i][1]); ctx.closePath(); ctx.fill(); }
    ell(ctx, -2 * L, 0, 19 * L, 5.4 * L); ctx.fill(); if (L === 1) { ctx.fillRect(14, -2, 26, 4); }
    ctx.restore();
  }
  ctx.restore();
}

/* ---------- other boats from above ---------- */
// A person seen from above, facing +x. r ≈ shoulder half-width. ch: a CHARS id or a look object { shirt, skin, head, capColor, capBrim, hair, ... }
function saPersonTop(ctx, ch, x, y, r, ang = 0) {
  const C = typeof ch === 'string' ? CHARS[ch] : ch; if (!C) return;
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  ctx.fillStyle = 'rgba(0,20,30,0.18)'; ell(ctx, -r * 0.05, r * 0.3, r * 0.75, r * 1.25); ctx.fill();
  for (const d of [-1, 1]) {   // arms reaching forward
    ctx.fillStyle = C.sleeve === 'mahi' ? (d < 0 ? '#e8d84e' : '#2f7fc8') : (C.sleeveColor || C.shirt);
    ell(ctx, r * 0.34, d * r * 0.9, r * 0.5, r * 0.25, -d * 0.3); ctx.fill();
    ctx.fillStyle = C.skin; ell(ctx, r * 0.84, d * r * 0.68, r * 0.2, r * 0.18); ctx.fill();
  }
  const g = ctx.createLinearGradient(0, -r, 0, r); g.addColorStop(0, saMix(C.shirt, '#ffffff', 0.25)); g.addColorStop(1, saMix(C.shirt, '#0b1a24', 0.22));
  ctx.fillStyle = g; ell(ctx, 0, 0, r * 0.52, r * 1.06); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = r * 0.07; ctx.stroke();
  const hr = r * 0.5;
  if (C.head === 'cap') {
    ctx.fillStyle = C.capBrim || '#111'; ctx.beginPath(); ctx.ellipse(hr * 0.55, 0, hr * 0.85, hr * 0.78, 0, -Math.PI / 2, Math.PI / 2); ctx.fill();
    const cg = ctx.createRadialGradient(-hr * 0.3, -hr * 0.3, hr * 0.1, 0, 0, hr * 1.1); cg.addColorStop(0, saMix(C.capColor, '#ffffff', 0.25)); cg.addColorStop(1, C.capColor);
    ctx.fillStyle = cg; ell(ctx, 0, 0, hr, hr); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ell(ctx, 0, 0, hr * 0.14, hr * 0.14); ctx.fill();
  } else if (C.head === 'bald') {
    ctx.fillStyle = C.skin; ell(ctx, 0, 0, hr, hr); ctx.fill();
    ctx.strokeStyle = rgba(C.beardColor || '#5e554e', 0.6); ctx.lineWidth = hr * 0.22; ctx.beginPath(); ctx.arc(0, 0, hr * 0.86, Math.PI * 0.6, Math.PI * 1.4); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ell(ctx, -hr * 0.15, -hr * 0.3, hr * 0.35, hr * 0.22); ctx.fill();
  } else if (C.head === 'hat') {
    ctx.fillStyle = C.hatBrim || '#e2cc8a'; ell(ctx, 0, 0, hr * 1.55, hr * 1.55); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = hr * 0.1; ctx.stroke();
    ctx.fillStyle = C.hatBand || '#7a3b2a'; ell(ctx, 0, 0, hr * 0.95, hr * 0.95); ctx.fill();
    ctx.fillStyle = C.hatColor || '#d9bf78'; ell(ctx, 0, 0, hr * 0.82, hr * 0.82); ctx.fill();
  } else {
    ctx.fillStyle = C.hair || '#222'; ell(ctx, 0, 0, hr, hr); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ell(ctx, -hr * 0.2, -hr * 0.3, hr * 0.4, hr * 0.25); ctx.fill();
  }
  if (C.shades && C.head !== 'hat') { ctx.strokeStyle = C.shades.frame; ctx.lineWidth = hr * 0.24; ctx.beginPath(); ctx.arc(0, 0, hr * 0.92, -0.85, 0.85); ctx.stroke(); }
  ctx.restore();
}
// A hull outline from above: bow at +x on the axis, flat transom at x = stern. fine = how far back the bow's curve runs (fraction of the length).
function saHullTop(ctx, bow, stern, hb, fine = 0.5, sr = 3) {
  const L = bow - stern, xm = bow - L * fine;
  ctx.beginPath(); ctx.moveTo(bow, 0);
  ctx.bezierCurveTo(bow - L * 0.05, -hb * 0.6, xm + L * 0.2, -hb, xm, -hb);
  ctx.lineTo(stern + sr, -hb * 0.97); ctx.quadraticCurveTo(stern, -hb * 0.97, stern, -hb * 0.97 + sr);
  ctx.lineTo(stern, hb * 0.97 - sr); ctx.quadraticCurveTo(stern, hb * 0.97, stern + sr, hb * 0.97);
  ctx.lineTo(xm, hb); ctx.bezierCurveTo(xm + L * 0.2, hb, bow - L * 0.05, hb * 0.6, bow, 0);
  ctx.closePath();
}
function saShadowFill(ctx, ang, s, dx, dy, a, path) {
  const [ox, oy] = saOff(ang, s, dx, dy); ctx.save(); ctx.translate(ox, oy); path(); ctx.fillStyle = `rgba(0,22,38,${a})`; ctx.fill(); ctx.restore();
}
function saOutboardTop(ctx, x, y, w, h, col = '#2e353c', band = '#c9ced3') {
  const g = ctx.createLinearGradient(0, y - h / 2, 0, y + h / 2); g.addColorStop(0, saMix(col, '#ffffff', 0.25)); g.addColorStop(0.5, col); g.addColorStop(1, saMix(col, '#000000', 0.3));
  ctx.fillStyle = g; rr(ctx, x - w, y - h / 2, w, h, h * 0.42); ctx.fill();
  ctx.fillStyle = band; ctx.fillRect(x - w * 0.62, y - h / 2 + h * 0.08, w * 0.12, h * 0.84);
  ctx.fillStyle = 'rgba(255,255,255,0.22)'; rr(ctx, x - w * 0.95, y - h * 0.32, w * 0.3, h * 0.18, h * 0.08); ctx.fill();
}
const SA_OFFICER = { shirt: '#5f6e4a', skin: '#c99469', head: 'cap', capColor: '#2f3d2c', capBrim: '#1f2a1e', hair: '#2a1c13', shades: { frame: '#111' } };

// Center console, other people's. Same scale as drawBoatTop (s = 1: bow at +84, engines back to −91).
// o: hull (topsides color), top (T-top canvas, defaults from the hull), crew (CHARS ids or look objects, up to 3), t
function drawCenterConsoleTop(ctx, x, y, s, ang = 0, o = {}) {
  const hull = o.hull || '#ffffff', light = saLum(hull) > 0.72, top = o.top || (light ? '#1d3557' : saMix(hull, '#0e141a', 0.5)), lw = (w) => Math.max(w, 0.6 / s);
  saBegin(ctx, x, y, s, ang);
  saShadowFill(ctx, ang, s, 5 * s, 8 * s, 0.22, () => { saHullTop(ctx, 84, -74, 29, 0.48); ctx.rect(-91, -18, 18, 36); });
  for (const d of [-1, 1]) saOutboardTop(ctx, -73, d * 11, 18, 13);
  saHullTop(ctx, 84, -74, 29, 0.48); ctx.fillStyle = saLightGrad(ctx, ang, 30, saMix(hull, '#ffffff', 0.3), hull, saMix(hull, '#0b1a24', 0.3)); ctx.fill();
  ctx.strokeStyle = rgba(saMix(hull, '#0b1a24', 0.55), 0.7); ctx.lineWidth = lw(1.2); ctx.stroke();
  saHullTop(ctx, 80.5, -72.5, 25.6, 0.47); ctx.fillStyle = '#f7f9fa'; ctx.fill();
  saHullTop(ctx, 73, -70.5, 22.4, 0.45); const dg = ctx.createLinearGradient(-70, 0, 73, 0); dg.addColorStop(0, '#d3dade'); dg.addColorStop(1, '#e4e9ec'); ctx.fillStyle = dg; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle = '#eef1f3'; ctx.fillRect(40, -30, 50, 60); ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.fillRect(38.6, -30, 1.6, 60);   // casting deck
  ctx.strokeStyle = 'rgba(0,0,0,0.1)'; ctx.lineWidth = lw(3); saHullTop(ctx, 73, -70.5, 22.4, 0.45); ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = '#c3ccd2'; ctx.lineWidth = lw(1); rr(ctx, 46, -7, 15, 14, 3); ctx.stroke(); rr(ctx, 64, -3.2, 6.5, 6.4, 2); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.rect(16, -40, 80, 80); ctx.clip();   // bow rail
  saHullTop(ctx, 81.6, -72.5, 26.6, 0.47); ctx.strokeStyle = '#b8c2c9'; ctx.lineWidth = lw(1.3); ctx.stroke(); ctx.restore();
  ctx.fillStyle = '#e03a3a'; ell(ctx, 66, -14.5, 1.6, 1.6); ctx.fill(); ctx.fillStyle = '#2fc56a'; ell(ctx, 66, 14.5, 1.6, 1.6); ctx.fill();
  ctx.fillStyle = '#56606a'; saDots(ctx, [-40, -52, -63].flatMap((rx) => [[rx, -24, 1.4, 1.4], [rx, 24, 1.4, 1.4]])); ctx.fill();
  // front cooler seat, leaning post
  ctx.fillStyle = '#fbfcfd'; rr(ctx, 25, -10, 10, 20, 3); ctx.fill(); ctx.fillStyle = top; rr(ctx, 26.5, -8.5, 7, 17, 2.5); ctx.fill();
  ctx.fillStyle = top; rr(ctx, -35, -11, 8, 22, 3); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.18)'; rr(ctx, -34, -10, 3, 20, 1.5); ctx.fill();
  const crew = o.crew || [], pos = [[-46, -10], [-46, 10], [50, 0]];
  crew.forEach((ch, i) => { if (pos[i]) saPersonTop(ctx, ch, pos[i][0], pos[i][1], 8, Math.sin((o.t || 0) * 0.7 + i) * 0.15); });
  // the T-top: canvas on a frame, its shadow on the deck, radar, and a rocket launcher of rods on the aft edge
  saShadowFill(ctx, ang, s, 4 * s, 6 * s, 0.14, () => rr(ctx, -24, -21, 50, 42, 7));
  ctx.strokeStyle = '#2a3036'; ctx.lineWidth = lw(1.1);
  ctx.beginPath(); for (let i = 0; i < 5; i++) { const ry = -14 + i * 7; ctx.moveTo(-23, ry); ctx.lineTo(-33, ry * 1.18); } ctx.stroke();
  rr(ctx, -24, -21, 50, 42, 7); ctx.fillStyle = saLightGrad(ctx, ang, 30, saMix(top, '#ffffff', 0.22), top, saMix(top, '#000000', 0.25)); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = lw(1); ctx.stroke();
  ctx.setLineDash([2, 2]); ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = lw(0.6); rr(ctx, -21.5, -18.5, 45, 37, 5); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = '#c9a94a'; saDots(ctx, [0, 1, 2, 3, 4].map((i) => [-24, -14 + i * 7, 1.6, 1.3])); ctx.fill();
  const rg = ctx.createRadialGradient(9, -2, 1, 10, 0, 7); rg.addColorStop(0, '#ffffff'); rg.addColorStop(1, '#c8d0d6');
  ctx.fillStyle = rg; ell(ctx, 10, 0, 6.4, 6.4); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = lw(0.8); ctx.stroke();
  ctx.fillStyle = '#f4f6f7'; for (const d of [-1, 1]) { ell(ctx, 22, d * 17, 1.5, 1.5); ctx.fill(); }
  ctx.restore();
}

// Florida Fish & Wildlife patrol boat: gray hull, white hard top with a flashing blue light bar, FWC on the foredeck.
// s = 1: bow at +90, engines back to −97. o: t (drives the lights), lights (default true), crew (default two officers)
function drawFwcBoatTop(ctx, x, y, s, ang = 0, o = {}) {
  const t = o.t || 0, hull = '#7a868f', lw = (w) => Math.max(w, 0.6 / s);
  saBegin(ctx, x, y, s, ang);
  saShadowFill(ctx, ang, s, 5 * s, 8 * s, 0.22, () => { saHullTop(ctx, 90, -80, 31, 0.48); ctx.rect(-97, -19, 18, 38); });
  for (const d of [-1, 1]) saOutboardTop(ctx, -79, d * 12, 18, 14, '#d9dde0', '#4a5560');
  saHullTop(ctx, 90, -80, 31, 0.48); ctx.fillStyle = saLightGrad(ctx, ang, 32, '#9aa5ad', hull, '#56626b'); ctx.fill();
  ctx.strokeStyle = '#3e4950'; ctx.lineWidth = lw(1.2); ctx.stroke();
  saHullTop(ctx, 86.5, -78.5, 27.6, 0.47); ctx.fillStyle = '#1f6b45'; ctx.fill();   // the green stripe along the rail
  saHullTop(ctx, 85, -78, 26.4, 0.47); ctx.fillStyle = '#f5f7f8'; ctx.fill();
  saHullTop(ctx, 78, -76, 23, 0.45); ctx.fillStyle = '#d6dce0'; ctx.fill();
  ctx.save(); ctx.clip(); ctx.fillStyle = '#e8ecee'; ctx.fillRect(38, -30, 50, 60); ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.fillRect(36.6, -30, 1.6, 60); ctx.restore();
  ctx.save(); ctx.translate(58, 0); if (Math.cos(ang) < 0) ctx.rotate(Math.PI);   /* keep the lettering upright */ ctx.fillStyle = '#16402b'; ctx.font = `900 17px ${FONT_UI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('FWC', 0, 0.5); ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.rect(20, -40, 80, 80); ctx.clip(); saHullTop(ctx, 86.5, -78.5, 27.6, 0.47); ctx.strokeStyle = '#b8c2c9'; ctx.lineWidth = lw(1.3); ctx.stroke(); ctx.restore();
  ctx.fillStyle = '#56606a'; for (const rx of [-44, -58]) for (const d of [-1, 1]) { ell(ctx, rx, d * 25, 1.4, 1.4); ctx.fill(); }
  const crew = o.crew || [SA_OFFICER, SA_OFFICER], pos = [[-48, -9], [-50, 11]];
  crew.forEach((ch, i) => { if (pos[i]) saPersonTop(ctx, ch, pos[i][0], pos[i][1], 8, Math.sin(t * 0.6 + i) * 0.12); });
  ctx.fillStyle = '#2e5a8a'; rr(ctx, -37, -11, 8, 22, 3); ctx.fill();
  // hard top
  saShadowFill(ctx, ang, s, 4 * s, 6 * s, 0.15, () => rr(ctx, -26, -22, 54, 44, 6));
  rr(ctx, -26, -22, 54, 44, 6); ctx.fillStyle = saLightGrad(ctx, ang, 30, '#ffffff', '#eef1f3', '#cfd6db'); ctx.fill();
  ctx.strokeStyle = 'rgba(40,60,70,0.35)'; ctx.lineWidth = lw(1); ctx.stroke();
  ctx.strokeStyle = 'rgba(40,60,70,0.18)'; rr(ctx, -22, -18, 46, 36, 4); ctx.stroke();
  ctx.fillStyle = '#f4f6f7'; for (const d of [-1, 1]) { ell(ctx, -18, d * 17, 1.5, 1.5); ctx.fill(); }
  ctx.fillStyle = '#9aa4ab'; rr(ctx, -6, -4, 10, 8, 2); ctx.fill();
  // the light bar: alternating double flashes, blue and white
  const on = o.lights !== false, p = saFrac(t * 1.25), L = on && (p < 0.07 || (p > 0.13 && p < 0.2)), R = on && ((p > 0.5 && p < 0.57) || (p > 0.63 && p < 0.7)), W = on && saFrac(t * 2.5) < 0.05;
  ctx.fillStyle = '#1b2228'; rr(ctx, 19, -18, 6.5, 36, 3); ctx.fill();
  const pod = (py, lit, white) => { ctx.fillStyle = lit ? (white ? '#ffffff' : '#7cc0ff') : '#1f3f73'; rr(ctx, 19.8, py - 6.5, 4.9, 13, 2.2); ctx.fill(); if (!lit) { ctx.fillStyle = 'rgba(120,170,255,0.25)'; rr(ctx, 20.6, py - 5, 1.6, 10, 0.8); ctx.fill(); } };
  pod(-10.5, L, false); pod(10.5, R, false); ctx.fillStyle = W ? '#ffffff' : '#c9d2d8'; rr(ctx, 20.4, -2.5, 3.8, 5, 1.2); ctx.fill();
  if (L || R || W) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const [lit, py, c] of [[L, -10.5, '60,140,255'], [R, 10.5, '60,140,255'], [W, 0, '200,220,255']]) {
      if (!lit) continue; const g = ctx.createRadialGradient(22, py, 0, 22, py, 34); g.addColorStop(0, `rgba(${c},0.75)`); g.addColorStop(0.35, `rgba(${c},0.25)`); g.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = g; ctx.fillRect(-12, py - 34, 68, 68);
    }
    ctx.restore();
  }
  ctx.restore();
}

// Cruising sailboat (~30 ft). s = 1: bow at +100, stern −92 (the boom can swing past it).
// o: sail = boom angle −1..1 (sign = the side the boom is out to, default 0.45) or false for sails down; t (sail flutter)
function drawSailboatTop(ctx, x, y, s, ang = 0, o = {}) {
  const t = o.t || 0, lw = (w) => Math.max(w, 0.6 / s), up = o.sail !== false, sv = up ? clamp(o.sail == null ? 0.45 : o.sail, -1, 1) : 0;
  const side = sv < 0 ? -1 : 1, ba = sv * 0.95, mx = 40, bl = 92;
  const bex = mx - Math.cos(ba) * bl, bey = Math.sin(ba) * bl;
  const hull = () => { ctx.beginPath(); ctx.moveTo(100, 0); ctx.bezierCurveTo(88, -20, 40, -34, -10, -33); ctx.bezierCurveTo(-55, -32, -86, -28, -92, -25); ctx.quadraticCurveTo(-94, 0, -92, 25); ctx.bezierCurveTo(-86, 28, -55, 32, -10, 33); ctx.bezierCurveTo(40, 34, 88, 20, 100, 0); ctx.closePath(); };
  saBegin(ctx, x, y, s, ang);
  saShadowFill(ctx, ang, s, 6 * s, 10 * s, 0.22, hull);
  if (up) {   // the sails' shadow, thrown well clear of the boat by the tall rig
    const [hx, hy] = saOff(ang, 1, 60, 96);
    ctx.fillStyle = 'rgba(0,22,38,0.13)'; ctx.beginPath(); ctx.moveTo(mx, 0); ctx.lineTo(mx + hx, hy); ctx.lineTo(bex + hx * 0.08, bey + hy * 0.08); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(98, 0); ctx.lineTo(mx + hx * 0.85, hy * 0.85); ctx.lineTo(18 + hx * 0.05, side * 12 + hy * 0.05); ctx.closePath(); ctx.fill();
  }
  hull(); ctx.fillStyle = saLightGrad(ctx, ang, 34, '#ffffff', '#eef1f3', '#c9d1d7'); ctx.fill(); ctx.strokeStyle = '#8c9aa4'; ctx.lineWidth = lw(1.2); ctx.stroke();
  ctx.save(); ctx.translate(2, 0); ctx.scale(0.94, 0.88); hull(); ctx.restore(); ctx.fillStyle = '#e6e1d4'; ctx.fill();
  ctx.save(); ctx.translate(2, 0); ctx.scale(0.94, 0.88); hull(); ctx.restore(); ctx.strokeStyle = '#a87a4a'; ctx.lineWidth = lw(1.2); ctx.stroke();
  // cockpit with teak seats and the wheel
  ctx.fillStyle = '#f2f0ea'; rr(ctx, -84, -19, 64, 38, 8); ctx.fill();
  ctx.fillStyle = '#b4834f'; rr(ctx, -80, -15, 58, 30, 6); ctx.fill();
  ctx.strokeStyle = 'rgba(70,40,15,0.45)'; ctx.lineWidth = lw(0.6); for (let i = -12; i <= 12; i += 3) { ctx.beginPath(); ctx.moveTo(-79, i); ctx.lineTo(-23, i); ctx.stroke(); }
  ctx.fillStyle = '#ece8dc'; rr(ctx, -66, -6, 38, 12, 4); ctx.fill();
  ctx.strokeStyle = '#2c3238'; ctx.lineWidth = lw(1.6); ell(ctx, -72, 0, 3.4, 10); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-72, -10); ctx.lineTo(-72, 10); ctx.stroke();
  // cabin trunk with hatches and portlights
  ctx.fillStyle = 'rgba(0,0,0,0.08)'; rr(ctx, -20, -19, 70, 39, 12); ctx.fill();
  const cg = ctx.createLinearGradient(0, -18, 0, 18); cg.addColorStop(0, '#ffffff'); cg.addColorStop(1, '#dfe4e8'); ctx.fillStyle = cg; rr(ctx, -22, -18, 70, 36, 12); ctx.fill();
  ctx.strokeStyle = '#b7c1c8'; ctx.lineWidth = lw(0.9); ctx.stroke();
  ctx.fillStyle = '#c9cfd4'; rr(ctx, -22, -6, 14, 12, 3); ctx.fill();
  ctx.fillStyle = 'rgba(40,70,90,0.55)'; rr(ctx, 4, -6.5, 12, 13, 2.5); ctx.fill(); rr(ctx, 28, -5, 10, 10, 2.5); ctx.fill();
  ctx.fillStyle = '#3a4a56'; saDots(ctx, [-10, 6, 22].flatMap((px) => [[px, -16.2, 3, 1.1], [px, 16.2, 3, 1.1]])); ctx.fill();
  // lifelines and pulpits
  ctx.strokeStyle = '#c3cbd1'; ctx.lineWidth = lw(0.9); ctx.save(); ctx.translate(1, 0); ctx.scale(0.97, 0.94); hull(); ctx.restore(); ctx.stroke();
  ctx.fillStyle = '#9aa5ad'; saDots(ctx, [-80, -50, -15, 20, 55].flatMap((px) => [[px, -(px > 40 ? 26 : 30), 1.2, 1.2], [px, px > 40 ? 26 : 30, 1.2, 1.2]])); ctx.fill();
  // shrouds, mast and spreaders
  ctx.strokeStyle = 'rgba(60,70,80,0.75)'; ctx.lineWidth = lw(0.6);
  for (const d of [-1, 1]) { ctx.beginPath(); ctx.moveTo(mx, 0); ctx.lineTo(mx - 3, d * 31); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(mx, 0); ctx.lineTo(99, 0); ctx.stroke();
  ctx.strokeStyle = '#7e8a93'; ctx.lineWidth = lw(1.4); ctx.beginPath(); ctx.moveTo(mx + 1, -17); ctx.lineTo(mx + 1, 17); ctx.stroke();
  if (up) {
    const fl = Math.sin(t * 6.5) * 1.4;
    // jib: forestay to a clew by the mast, bellied to leeward
    const jx = 24, jy = side * (9 + Math.abs(sv) * 13), jb = side * (17 + Math.abs(sv) * 9) + fl;
    const jg = ctx.createLinearGradient(0, 0, 0, jb); jg.addColorStop(0, '#c9d5de'); jg.addColorStop(1, '#fbfcfd');
    ctx.fillStyle = jg; ctx.beginPath(); ctx.moveTo(97, 0); ctx.quadraticCurveTo(64, jb, jx, jy); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(45,65,80,0.6)'; ctx.lineWidth = lw(0.8); ctx.stroke();
  }
  // boom (and main)
  ctx.strokeStyle = '#596670'; ctx.lineWidth = lw(2.2); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(mx, 0); ctx.lineTo(bex, bey); ctx.stroke();
  if (up) {
    // the main seen from above: a full curve of sail from the mast to the end of the boom, bellied to leeward
    const nx = Math.sin(ba), ny = Math.cos(ba), bel = (24 + Math.abs(sv) * 6) + Math.sin(t * 5.3) * 0.8, mxm = (mx + bex) / 2, mym = bey / 2;
    const cpx = mxm + nx * bel * side, cpy = mym + ny * bel * side;
    const sg = ctx.createLinearGradient(mxm, mym, cpx, cpy); sg.addColorStop(0, '#c3cfd9'); sg.addColorStop(1, '#fdfefe');
    ctx.fillStyle = sg; ctx.beginPath(); ctx.moveTo(mx, 0); ctx.quadraticCurveTo(cpx, cpy, bex, bey); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(45,65,80,0.6)'; ctx.lineWidth = lw(0.9); ctx.stroke();
    ctx.strokeStyle = 'rgba(110,130,148,0.65)'; ctx.lineWidth = lw(0.6);
    for (let i = 1; i <= 3; i++) { const u = i / 4, ax = lerp(mx, bex, u), ay = lerp(0, bey, u), q = 2 * u * (1 - u) * 0.95; ctx.beginPath(); ctx.moveTo(ax + (cpx - mxm) * q * 0.45, ay + (cpy - mym) * q * 0.45); ctx.lineTo(ax + (cpx - mxm) * q, ay + (cpy - mym) * q); ctx.stroke(); }
  } else {
    ctx.strokeStyle = '#1e3a5f'; ctx.lineWidth = lw(5); ctx.beginPath(); ctx.moveTo(mx - 3, 0); ctx.lineTo(lerp(mx, bex, 0.85), lerp(0, bey, 0.85)); ctx.stroke();
    ctx.strokeStyle = '#e8eef2'; ctx.lineWidth = lw(2.4); ctx.beginPath(); ctx.moveTo(98, 0); ctx.lineTo(mx + 6, 0); ctx.stroke();
  }
  ctx.fillStyle = '#4a5560'; ell(ctx, mx, 0, 3.2, 2.6); ctx.fill(); ctx.fillStyle = '#c9d2d8'; ell(ctx, mx - 0.6, -0.6, 1.2, 1); ctx.fill();
  ctx.restore();
}

// Flats skiff with a poling platform over the outboard. s = 1: bow at +62, motor back to −70.
// o: hull (default pale seafoam), poler / angler (CHARS ids), pole 0..1 (poling stroke), t
function drawSkiffTop2(ctx, x, y, s, ang = 0, o = {}) {
  const hull = o.hull || '#e3ece8', lw = (w) => Math.max(w, 0.6 / s);
  const shape = (b, st, hb) => { ctx.beginPath(); ctx.moveTo(b, 0); ctx.bezierCurveTo(b - 20, -hb * 0.7, b - 60, -hb, st + 30, -hb); ctx.lineTo(st + 2, -hb * 0.96); ctx.quadraticCurveTo(st, -hb * 0.96, st, -hb * 0.8); ctx.lineTo(st, hb * 0.8); ctx.quadraticCurveTo(st, hb * 0.96, st + 2, hb * 0.96); ctx.lineTo(st + 30, hb); ctx.bezierCurveTo(b - 60, hb, b - 20, hb * 0.7, b, 0); ctx.closePath(); };
  saBegin(ctx, x, y, s, ang);
  saShadowFill(ctx, ang, s, 4 * s, 7 * s, 0.2, () => { shape(62, -56, 18); ctx.rect(-70, -7, 16, 14); });
  saOutboardTop(ctx, -55, 0, 14, 11);
  shape(62, -56, 18); ctx.fillStyle = saLightGrad(ctx, ang, 20, saMix(hull, '#ffffff', 0.4), hull, saMix(hull, '#0b1a24', 0.25)); ctx.fill();
  ctx.strokeStyle = rgba(saMix(hull, '#0b1a24', 0.5), 0.75); ctx.lineWidth = lw(1.1); ctx.stroke();
  shape(59, -54, 15.6); ctx.fillStyle = '#f6f8f7'; ctx.fill();
  ctx.fillStyle = '#e9eeec'; rr(ctx, 18, -11, 34, 22, 6); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.08)'; ctx.lineWidth = lw(1); ctx.stroke();
  ctx.strokeStyle = '#c8d0cd'; ctx.lineWidth = lw(0.9); rr(ctx, 26, -6, 16, 12, 3); ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.12)'; rr(ctx, -7, -5.5, 14, 13, 3); ctx.fill();
  ctx.fillStyle = '#fbfcfc'; rr(ctx, -8, -6.5, 14, 13, 3); ctx.fill(); ctx.strokeStyle = '#b9c3c0'; ctx.lineWidth = lw(0.8); ctx.stroke();
  ctx.fillStyle = 'rgba(40,90,120,0.55)'; ctx.beginPath(); ctx.moveTo(6, -6); ctx.quadraticCurveTo(10, 0, 6, 6); ctx.lineTo(4.5, 5); ctx.quadraticCurveTo(7.5, 0, 4.5, -5); ctx.fill();
  ctx.fillStyle = '#fbfcfc'; rr(ctx, -20, -6, 9, 12, 2); ctx.fill(); ctx.fillStyle = '#2f6f8f'; rr(ctx, -19, -5, 7, 10, 2); ctx.fill();
  // push pole in its gunwale clips
  ctx.strokeStyle = '#d9d2bd'; ctx.lineWidth = lw(1.8); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-50, 13.4); ctx.lineTo(58, 11.6); ctx.stroke();
  ctx.strokeStyle = '#3a3f44'; ctx.lineWidth = lw(2.2); ctx.beginPath(); ctx.moveTo(-50, 13.4); ctx.lineTo(-46, 13.3); ctx.stroke();
  ctx.fillStyle = '#9aa4a8'; for (const px of [-30, 10, 40]) { rr(ctx, px - 1, 11.4, 2, 3, 0.6); ctx.fill(); }
  // poling platform: raised over the motor, so it throws a shadow
  saShadowFill(ctx, ang, s, 3 * s, 5 * s, 0.18, () => rr(ctx, -62, -10, 15, 20, 2));
  ctx.strokeStyle = '#aab4b8'; ctx.lineWidth = lw(1.3); for (const [px, py] of [[-59, -8], [-59, 8], [-49, -8], [-49, 8]]) { ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + 1.5, py * 1.08); ctx.stroke(); }
  const pg = ctx.createLinearGradient(-62, -10, -47, 10); pg.addColorStop(0, '#f1f4f5'); pg.addColorStop(1, '#b9c2c6'); ctx.fillStyle = pg; rr(ctx, -62, -10, 15, 20, 2); ctx.fill();
  ctx.strokeStyle = 'rgba(80,95,100,0.35)'; ctx.lineWidth = lw(0.5); for (let i = -7; i <= 7; i += 3.5) { ctx.beginPath(); ctx.moveTo(-61, i); ctx.lineTo(-48, i); ctx.stroke(); }
  ctx.strokeStyle = '#8a969b'; ctx.lineWidth = lw(0.9); rr(ctx, -62, -10, 15, 20, 2); ctx.stroke();
  if (o.poler) {
    const pl = o.pole || 0;
    ctx.strokeStyle = '#d9d2bd'; ctx.lineWidth = lw(1.8); ctx.beginPath(); ctx.moveTo(-50 + 8 * pl, 7); ctx.lineTo(-96 + 26 * pl, 30 - 8 * pl); ctx.stroke();
    saPersonTop(ctx, o.poler, -54, 0, 7.5, 0);
  }
  if (o.angler) saPersonTop(ctx, o.angler, 35, 0, 8, o.aim || 0);
  ctx.restore();
}

// Sit-on-top kayak and paddler. s = 1: 80 px long, paddle 52 px across. o: color (hull), t (paddle strokes), phase
function drawKayakTop(ctx, x, y, s, ang = 0, o = {}) {
  const t = (o.t || 0) + (o.phase || 0), col = o.color || '#ffb21a', lw = (w) => Math.max(w, 0.6 / s);
  const hull = () => { ctx.beginPath(); ctx.moveTo(41, 0); ctx.bezierCurveTo(30, -6.5, 12, -9, -4, -9); ctx.bezierCurveTo(-22, -9, -34, -6, -41, 0); ctx.bezierCurveTo(-34, 6, -22, 9, -4, 9); ctx.bezierCurveTo(12, 9, 30, 6.5, 41, 0); ctx.closePath(); };
  const pa = Math.sin(t * 2.4) * 0.5, dip = Math.cos(t * 2.4) > 0 ? -1 : 1;
  saBegin(ctx, x, y, s, ang);
  saShadowFill(ctx, ang, s, 3 * s, 5 * s, 0.2, hull);
  // ripples where the blade is in
  const hx = 3, half = 26, bx = hx - Math.sin(pa) * half * dip, by = dip * Math.cos(pa) * half;
  for (let k = 0; k < 2; k++) { const p = saFrac(t * 0.8 + k * 0.5); ctx.strokeStyle = `rgba(255,255,255,${0.5 * (1 - p)})`; ctx.lineWidth = lw(0.9); ell(ctx, bx - 4 - p * 8, by, 3 + p * 7, 2 + p * 4); ctx.stroke(); }
  hull(); ctx.fillStyle = saLightGrad(ctx, ang, 10, saMix(col, '#ffffff', 0.35), col, saMix(col, '#000000', 0.22)); ctx.fill();
  ctx.strokeStyle = rgba(saMix(col, '#000000', 0.5), 0.6); ctx.lineWidth = lw(0.9); ctx.stroke();
  ctx.fillStyle = rgba(saMix(col, '#000000', 0.25), 0.55); rr(ctx, -16, -5.6, 22, 11.2, 5); ctx.fill();
  for (const d of [-1, 1]) { rr(ctx, 9, d * 3.2 - 1.6, 12, 3.2, 1.6); ctx.fill(); }
  ctx.strokeStyle = '#1d1f22'; ctx.lineWidth = lw(0.7);
  for (const [ax, bx2] of [[24, 33], [33, 24]]) { ctx.beginPath(); ctx.moveTo(ax, -4.6); ctx.lineTo(bx2, 4.6); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(-26, -5); ctx.lineTo(-34, 5); ctx.moveTo(-34, -5); ctx.lineTo(-26, 5); ctx.stroke();
  ctx.fillStyle = '#1d1f22'; rr(ctx, 39, -1.5, 2.5, 3, 1); ctx.fill(); rr(ctx, -42, -1.5, 2.5, 3, 1); ctx.fill();
  // paddler: legs out front, life vest, sun hat
  ctx.fillStyle = '#c99469'; for (const d of [-1, 1]) { rr(ctx, 2, d * 3 - 1.5, 13, 3, 1.5); ctx.fill(); }
  ctx.fillStyle = '#2f5d7c'; for (const d of [-1, 1]) { rr(ctx, -3, d * 3 - 2, 8, 4, 2); ctx.fill(); }
  const sx = -6;
  for (const d of [-1, 1]) {   // arms to the shaft
    const gx = hx - Math.sin(pa) * 8 * d, gy = d * Math.cos(pa) * 8;
    ctx.strokeStyle = '#2b4f6e'; ctx.lineWidth = lw(2.4); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(sx, d * 4.5); ctx.lineTo((sx + gx) / 2 + 1, (d * 4.5 + gy) / 2 + d * 1.5); ctx.stroke();
    ctx.strokeStyle = '#c99469'; ctx.lineWidth = lw(2); ctx.beginPath(); ctx.moveTo((sx + gx) / 2 + 1, (d * 4.5 + gy) / 2 + d * 1.5); ctx.lineTo(gx, gy); ctx.stroke();
  }
  ctx.fillStyle = '#e8552b'; rr(ctx, sx - 4, -6, 8, 12, 3.5); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(sx - 4, -0.5, 8, 1);
  ctx.save(); ctx.translate(hx, 0); ctx.rotate(pa);   // paddle
  ctx.strokeStyle = '#2a2f34'; ctx.lineWidth = lw(1.4); ctx.beginPath(); ctx.moveTo(0, -half + 3); ctx.lineTo(0, half - 3); ctx.stroke();
  ctx.fillStyle = '#e84b3c'; for (const d of [-1, 1]) { ell(ctx, 0, d * (half - 1), 2.2, 4.6); ctx.fill(); }
  ctx.restore();
  ctx.fillStyle = '#e2cc8a'; ell(ctx, sx - 0.5, 0, 6.2, 6.2); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = lw(0.6); ctx.stroke();
  ctx.fillStyle = '#7a3b2a'; ell(ctx, sx - 0.5, 0, 3.6, 3.6); ctx.fill(); ctx.fillStyle = '#d6bc72'; ell(ctx, sx - 0.5, 0, 3, 3); ctx.fill();
  ctx.restore();
}

// A trap float from above (the overhead view). s = 1 → 16 px across, like the floats on the chart. o: color, stripe, t, phase; ang = the way the current runs
function drawTrapFloatTop(ctx, x, y, s, ang = 0, o = {}) {
  const t = (o.t || 0) * 2.2 + (o.phase != null ? o.phase : x * 0.031 + y * 0.017), col = o.color || '#ff6a3d', st = o.stripe || '#1b3f8a', bob = 1 + Math.sin(t) * 0.05;
  saBegin(ctx, x, y, s, ang);
  ctx.strokeStyle = 'rgba(10,40,55,0.35)'; ctx.lineWidth = Math.max(0.6, 1 / s); ctx.beginPath(); ctx.moveTo(-6, 0); ctx.quadraticCurveTo(-14, 2, -22, 1); ctx.stroke();   // the line, trailing down-current
  const p = saFrac(t / 5.5); ctx.strokeStyle = `rgba(255,255,255,${0.4 * (1 - p)})`; ctx.lineWidth = Math.max(0.6, 1.2 / s); ell(ctx, 0, 0, 9 + p * 8, 9 + p * 8); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.moveTo(6, -5); ctx.lineTo(-4, -11); ctx.moveTo(6, 5); ctx.lineTo(-4, 11); ctx.stroke();   // current curling past it
  const [ox, oy] = saOff(ang, s, 3 * s, 4 * s); ctx.fillStyle = 'rgba(0,22,38,0.25)'; ell(ctx, ox, oy, 8, 8); ctx.fill();
  ctx.save(); ctx.scale(bob, bob);
  const g = ctx.createRadialGradient(-2.5, -2.5, 0.5, 0, 0, 8.5); g.addColorStop(0, saMix(col, '#ffffff', 0.45)); g.addColorStop(0.6, col); g.addColorStop(1, saMix(col, '#000000', 0.3));
  ctx.fillStyle = g; ell(ctx, 0, 0, 8, 8); ctx.fill();
  ctx.save(); ell(ctx, 0, 0, 8, 8); ctx.clip(); ctx.fillStyle = st; ctx.fillRect(-1.6, -9, 3.6, 18); ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ell(ctx, -3, -3, 2.4, 1.6, -0.6); ctx.fill();
  ctx.fillStyle = '#3a3226'; ell(ctx, 0, 0, 1.3, 1.3); ctx.fill();
  ctx.restore(); ctx.restore();
}

/* ---------- side-view billboards for the chase camera ----------
   Drawn standing up at (x, y) = the waterline (birds: at the bird), in the chase camera's world units:
   s = px per world unit (~4.4 units to the foot, so our 24 ft boat is ~107). A negative s faces the sprite left.
   o.haze 0..1 fades the colors toward o.hazeColor (default a pale sea haze) for distance. */
const SA_UPF = 4.4, SA_TILT = 0.28;   // world units per foot; the chase camera's pitch (sets how flat the water rings look)
function saHazer(o) { const k = o.haze || 0, hc = o.hazeColor || '#c4dde8'; return k > 0 ? (c) => saMix(c, hc, k) : (c) => c; }
function saRings(ctx, x, y, r0, r1, es, p, a, lw) {   // ripple rings on the water, p = 0..1 age
  if (p < 0 || p > 1) return; const r = lerp(r0, r1, p); ctx.strokeStyle = `rgba(255,255,255,${a * (1 - p)})`; ctx.lineWidth = lw; ell(ctx, x, y, r, r * es); ctx.stroke();
}
function saSplash(ctx, x, y, w, k, t, seed, lw) {   // a crown of white water and flung droplets, k = 0..1 strength (local units)
  if (k <= 0.01) return;
  const r = mulberry(seed); ctx.fillStyle = `rgba(255,255,255,${0.8 * k})`; ctx.beginPath(); ctx.ellipse(x, y, w * (0.8 + 0.4 * k), w * 0.26, 0, 0, TAU); ctx.fill();
  ctx.beginPath();
  for (let i = 0; i < 7; i++) { const u = (i / 6 - 0.5) * 2, h = w * (0.5 + r() * 0.7) * k * (1 - Math.abs(u) * 0.5), bx = x + u * w * 0.7; ctx.moveTo(bx - w * 0.12, y); ctx.quadraticCurveTo(bx + u * w * 0.2, y - h * 1.1, bx + u * w * 0.35 + w * 0.06, y - h); ctx.quadraticCurveTo(bx + u * w * 0.1 + w * 0.12, y - h * 0.4, bx + w * 0.12, y); }
  ctx.fill();
  ctx.fillStyle = `rgba(255,255,255,${0.9 * k})`; ctx.beginPath();
  for (let i = 0; i < 9; i++) { const a = -Math.PI / 2 + (r() - 0.5) * 2.6, p = saFrac(t * 1.7 + r()), d = w * (0.4 + 1.3 * p), dx = x + Math.cos(a) * d, dy = y + Math.sin(a) * d * 1.3 + p * p * w * 1.6, rr2 = Math.max(lw * 0.6, w * 0.07 * (1 - p * 0.5)); ctx.moveTo(dx + rr2, dy); ctx.arc(dx, dy, rr2, 0, TAU); }
  ctx.fill();
}

// Bottlenose dolphin arcing out of the water, side view (~40 units long, the leap ~60 across and ~16 high).
// (x, y) = the waterline under the middle of the leap. phase in radians, as with sin(): 0 → nose breaks the surface,
// π/2 → top of the arc, π → tail slips back in; from π to 2π it's under and only the rings it left show. o: haze, hazeColor
function drawDolphinSide(ctx, x, y, s, phase = 0, o = {}) {
  const dir = s < 0 ? -1 : 1; s = Math.abs(s); if (s <= 0) return;
  const C = saHazer(o), p = saFrac(phase / TAU) * 2, L = 40, R = 33, th0 = 1.0, yc = R * Math.cos(th0), xe = R * Math.sin(th0), ext = (L / 2) / R, Rb = 70, es = 0.28, lw = 1 / s;
  ctx.save(); ctx.translate(x, y); ctx.scale(dir * s, s); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // rings where it came out and where it went back in
  for (let k = 0; k < 2; k++) { saRings(ctx, -xe, 0, 3, 20, es, (p - k * 0.25) / 1.3, 0.55, lw * 1.2); saRings(ctx, xe, 0, 3, 20, es, (p - 1 - k * 0.25) / 0.9, 0.55, lw * 1.2); }
  if (p < 1) {
    const th = lerp(-th0 - ext, th0 + ext, p), cx = R * Math.sin(th), cy = yc - R * Math.cos(th), Tx = Math.cos(th), Ty = Math.sin(th), Nx = Math.sin(th), Ny = -Math.cos(th);
    const M = (u, v) => { const a = u / Rb, lx = (Rb + v) * Math.sin(a), ly = (Rb + v) * Math.cos(a) - Rb; return [cx + Tx * lx + Nx * ly, cy + Ty * lx + Ny * ly]; };
    const body = [[20, -0.2], [17.8, 0.7], [15, 2.2], [11.5, 3.9], [5, 5.0], [-2, 4.9], [-9, 3.9], [-14, 2.4], [-17.5, 1.2], [-19.5, 0.8], [-19.5, -0.6], [-17.5, -1.0], [-13, -2.3], [-6, -4.3], [1, -4.9], [8, -4.1], [13, -2.7], [16, -1.5], [18, -0.9]].map(([u, v]) => M(u, v));
    const fin = [[-0.5, 4.8], [-3.5, 7.6], [-7.6, 9.8], [-7.3, 7.2], [-9.2, 3.8]].map(([u, v]) => M(u, v));
    const pec = [[9.5, -3.4], [6.8, -6.6], [3.6, -8.0], [4.6, -5.6], [6.4, -3.8]].map(([u, v]) => M(u, v));
    const fl = Math.sin(p * Math.PI * 2) * 1.2, fluke = [[-18.8, 0.8], [-23.2, 2.4 + fl], [-25.4, 1.9 + fl], [-22.6, 0.1], [-25.4, -1.6 + fl], [-23.2, -2.0 + fl], [-18.8, -0.6]].map(([u, v]) => M(u, v));
    const g = ctx.createLinearGradient(cx + Nx * 5, cy + Ny * 5, cx - Nx * 5, cy - Ny * 5);
    g.addColorStop(0, C('#4c5f6e')); g.addColorStop(0.45, C('#7a8f9e')); g.addColorStop(0.62, C('#c9d4da')); g.addColorStop(1, C('#e6ecef'));
    const paint = (under) => {
      const k = under ? (c) => saMix(C(c), SA_DEEP, 0.55) : C;
      saSmooth(ctx, fin); ctx.fillStyle = k('#465867'); ctx.fill();
      saSmooth(ctx, fluke); ctx.fill();
      saSmooth(ctx, body); ctx.fillStyle = under ? k('#6f8493') : g; ctx.fill();
      ctx.strokeStyle = rgba(k('#22323e'), 0.45); ctx.lineWidth = Math.max(lw * 0.8, 0.5); ctx.stroke();
      saSmooth(ctx, pec); ctx.fillStyle = k('#56697a'); ctx.fill();
    };
    ctx.save(); ctx.beginPath(); ctx.rect(-80, 0, 160, 60); ctx.clip(); ctx.globalAlpha *= 0.42; paint(true); ctx.restore();   // the part still under, seen through the water
    ctx.save(); ctx.beginPath(); ctx.rect(-80, -60, 160, 60); ctx.clip(); paint(false);
    if (s * 40 > 24) {
      const e = M(12.4, 0.9); ctx.fillStyle = '#111a20'; ell(ctx, e[0], e[1], 0.8, 0.8); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ell(ctx, e[0] + 0.25, e[1] - 0.25, 0.25, 0.25); ctx.fill();
      const m0 = M(19.5, -0.4), m1 = M(16.5, -0.9), m2 = M(14, -0.4); ctx.strokeStyle = rgba(C('#22323e'), 0.6); ctx.lineWidth = Math.max(lw * 0.7, 0.4); ctx.beginPath(); ctx.moveTo(m0[0], m0[1]); ctx.quadraticCurveTo(m1[0], m1[1], m2[0], m2[1]); ctx.stroke();
      const h0 = M(12, 3.3), h1 = M(2, 4.2), h2 = M(-8, 3.0); ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = Math.max(lw, 0.8); ctx.beginPath(); ctx.moveTo(h0[0], h0[1]); ctx.quadraticCurveTo(h1[0], h1[1], h2[0], h2[1]); ctx.stroke();
    }
    // water streaming off it
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath();
    for (let i = 0; i < 6; i++) { const u = -16 + i * 6, q = M(u, -4), d = saFrac(p * 3 + i * 0.37) * 6, r = Math.max(lw, 0.5); if (q[1] + d < 0) { ctx.moveTo(q[0] + r, q[1] + d); ctx.arc(q[0], q[1] + d, r, 0, TAU); } }
    ctx.fill();
    ctx.restore();
    // white water where it breaks the surface, and where it goes back in
    saSplash(ctx, -xe, 0, 7, Math.max(0, 1 - Math.abs(p - 0.14) / 0.2), p * 4, 3, lw);
    saSplash(ctx, xe, 0, 7, Math.max(0, 1 - Math.abs(p - 0.88) / 0.16), p * 4, 9, lw);
  }
  ctx.restore();
}

// Birds in flight, side view, facing right (negative s faces left). (x, y) = the bird; to fly it h units over a water point, pass y − h·s.
// flap = wing-beat angle in radians (as with drawFrigate). o: haze, hazeColor
const SA_SIDEBIRDS = {
  pelican: { span: 15, rate: 0.85, wing: '#8b8275', far: '#6c645a', cov: '#a9a091', tip: '#2b2622', fingers: true },
  gull: { span: 9.5, rate: 1, wing: '#9ba7b0', far: '#7e8a93', cov: '#b3bdc4', tip: '#1c1e21', fingers: false }
};
function saBirdSideWing(ctx, B, f, near, x0, y0, sc, C) {
  const e = f * 0.95, span = B.span * sc, tipY = -span * Math.sin(e) + (near ? 1 : -1) * span * Math.cos(e) * 0.3, sw = (1 - Math.abs(Math.sin(e)) * 0.3);
  const P = [[x0 + 2.6 * sc, y0], [x0 + 1.6 * sc, y0 + tipY * 0.45], [x0 - 6.5 * sc * sw, y0 + tipY], [x0 - 9 * sc, y0 + tipY * 0.86], [x0 - 7.5 * sc, y0 + tipY * 0.4], [x0 - 5.2 * sc, y0]];
  ctx.beginPath(); ctx.moveTo(P[0][0], P[0][1]); ctx.quadraticCurveTo(P[1][0] + 1.5 * sc, (P[0][1] + P[1][1]) / 2, P[1][0], P[1][1]); ctx.lineTo(P[2][0], P[2][1]); ctx.lineTo(P[3][0], P[3][1]); ctx.quadraticCurveTo(P[4][0] - 1.2 * sc, (P[3][1] + P[4][1]) / 2, P[4][0], P[4][1]); ctx.lineTo(P[5][0], P[5][1]); ctx.closePath();
  ctx.fillStyle = C(near ? B.wing : B.far); ctx.fill();
  ctx.save(); ctx.clip();
  if (near) { ctx.fillStyle = C(B.cov); ctx.beginPath(); ctx.moveTo(P[0][0], P[0][1]); ctx.lineTo(P[1][0], P[1][1]); ctx.lineTo(lerp(P[1][0], P[4][0], 0.45), lerp(P[1][1], P[4][1], 0.45)); ctx.lineTo(lerp(P[0][0], P[5][0], 0.45), P[0][1]); ctx.fill(); }
  ctx.fillStyle = C(B.tip); ctx.beginPath(); ctx.moveTo(lerp(P[1][0], P[2][0], 0.55), lerp(P[1][1], P[2][1], 0.55)); ctx.lineTo(P[2][0] + 3 * sc, P[2][1] + tipY * 0.2); ctx.lineTo(P[3][0] - 3 * sc, P[3][1] + tipY * 0.2); ctx.lineTo(lerp(P[4][0], P[3][0], 0.5), lerp(P[4][1], P[3][1], 0.5)); ctx.fill();
  ctx.restore();
  if (B.fingers && Math.abs(tipY) > span * 0.25) { ctx.strokeStyle = C(B.tip); ctx.lineWidth = 0.9 * sc; ctx.lineCap = 'round'; ctx.beginPath(); for (let i = 0; i < 3; i++) { const k = i / 2, bx = lerp(P[2][0], P[3][0], k), by = lerp(P[2][1], P[3][1], k); ctx.moveTo(bx, by); ctx.lineTo(bx - 1.6 * sc, by + Math.sign(tipY) * 1.6 * sc); } ctx.stroke(); }
}
// Brown pelican flying: ~30 units bill to tail, wings ~15 units. 
function drawPelicanSide(ctx, x, y, s, flap = 0, o = {}) {
  const dir = s < 0 ? -1 : 1; s = Math.abs(s); if (s <= 0) return;
  const C = saHazer(o), B = SA_SIDEBIRDS.pelican, f = Math.sin(flap * B.rate);
  ctx.save(); ctx.translate(x, y); ctx.scale(dir * s, s); ctx.lineJoin = 'round';
  saBirdSideWing(ctx, B, f, false, 0, -1.5, 1, C);
  ctx.fillStyle = C('#4d453c'); ctx.beginPath(); ctx.moveTo(-9, -1); ctx.lineTo(-15.5, -1.6); ctx.lineTo(-15, 0.6); ctx.lineTo(-9, 1.2); ctx.fill();   // tail
  ctx.fillStyle = C('#5a5046'); ctx.beginPath(); ctx.moveTo(-10, 0.2); ctx.quadraticCurveTo(-10, -2.6, -3, -3); ctx.quadraticCurveTo(5, -3.4, 8, -1); ctx.quadraticCurveTo(8.5, 2.6, 2, 2.8); ctx.quadraticCurveTo(-6, 3, -10, 0.2); ctx.fill();   // body
  ctx.fillStyle = C('#9b9284'); ctx.beginPath(); ctx.moveTo(-9, -0.6); ctx.quadraticCurveTo(-6, -2.9, 1, -3.1); ctx.quadraticCurveTo(-3, -1.2, -9, -0.6); ctx.fill();   // silvery back
  ctx.fillStyle = C('#efe6cf'); ell(ctx, 8.6, -2.2, 3.4, 3.2); ctx.fill();   // the neck folded back on the shoulders
  ctx.fillStyle = C('#4b3627'); ctx.beginPath(); ctx.ellipse(8.3, -2.6, 3.0, 2.7, 0, Math.PI * 0.7, Math.PI * 1.6); ctx.fill();
  ctx.fillStyle = C('#f1e2a8'); ell(ctx, 9.4, -5.2, 2.7, 2.2); ctx.fill();
  ctx.fillStyle = C('#5e5a52'); ctx.beginPath(); ctx.moveTo(10.5, -4.3); ctx.lineTo(26, -2.2); ctx.quadraticCurveTo(18, -1.4, 11.5, -2.9); ctx.fill();   // pouch
  const bg = ctx.createLinearGradient(10, 0, 28, 0); bg.addColorStop(0, C('#9f8150')); bg.addColorStop(1, C('#cfa86c'));
  ctx.fillStyle = bg; ctx.beginPath(); ctx.moveTo(10.2, -6.1); ctx.lineTo(27.6, -2.9); ctx.quadraticCurveTo(28.6, -2.2, 27.4, -1.6); ctx.lineTo(26.2, -2.2); ctx.lineTo(10.6, -4.4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#121212'; ell(ctx, 10, -5.6, 0.55, 0.5); ctx.fill();
  saBirdSideWing(ctx, B, f, true, 0.5, -1.8, 1, C);
  ctx.restore();
}
// Laughing gull flying: ~13 units beak to tail, wings ~9.5 units.
function drawGullSide(ctx, x, y, s, flap = 0, o = {}) {
  const dir = s < 0 ? -1 : 1; s = Math.abs(s); if (s <= 0) return;
  const C = saHazer(o), B = SA_SIDEBIRDS.gull, f = Math.sin(flap * B.rate), k = 0.62;
  ctx.save(); ctx.translate(x, y); ctx.scale(dir * s, s); ctx.lineJoin = 'round';
  saBirdSideWing(ctx, B, f, false, 0, -0.8, k, C);
  ctx.fillStyle = C('#f4f6f7'); ctx.beginPath(); ctx.moveTo(-7.5, -0.6); ctx.lineTo(-4, -1.6); ctx.quadraticCurveTo(2, -2.4, 4.4, -1.2); ctx.quadraticCurveTo(5, 1.4, 1, 1.7); ctx.quadraticCurveTo(-4, 1.6, -7.5, 0.4); ctx.closePath(); ctx.fill();   // body and tail
  ctx.fillStyle = C('#a2adb5'); ctx.beginPath(); ctx.moveTo(-4.5, -1.2); ctx.quadraticCurveTo(0, -2.4, 3, -1.6); ctx.quadraticCurveTo(-1, -0.7, -4.5, -1.2); ctx.fill();   // gray mantle
  ctx.fillStyle = C('#26272b'); ell(ctx, 5.2, -2.1, 1.8, 1.5); ctx.fill();   // black hood
  ctx.fillStyle = C('#8e2c2c'); ctx.beginPath(); ctx.moveTo(6.6, -2.4); ctx.lineTo(9.2, -1.7); ctx.lineTo(6.7, -1.4); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(5.6, -2.5, 0.45, Math.PI, 0); ctx.fill();
  saBirdSideWing(ctx, B, f, true, 0.3, -1.0, k, C);
  ctx.restore();
}
// Sea turtle at the surface, side view: the top of the shell awash and the head coming up to breathe (shell ~18 units long).
// (x, y) = the waterline at the turtle. t = time in seconds (breaths, flipper strokes, ripples). o: haze, hazeColor, phase
function drawTurtleSide(ctx, x, y, s, t = 0, o = {}) {
  const dir = s < 0 ? -1 : 1; s = Math.abs(s); if (s <= 0) return;
  const C = saHazer(o), tt = t + (o.phase || 0), es = 0.28, lw = 1 / s, br = Math.pow(Math.max(0, Math.sin(tt * 0.9)), 2), stroke = Math.sin(tt * 1.7);
  ctx.save(); ctx.translate(x, y); ctx.scale(dir * s, s); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  for (let k = 0; k < 2; k++) saRings(ctx, 1, 0, 9, 22, es, saFrac(tt * 0.35 + k * 0.5), 0.5, lw * 1.1);
  // what's under: the rest of the shell, flippers and belly, through the water
  ctx.save(); ctx.globalAlpha *= 0.4; const U = (c) => saMix(C(c), SA_DEEP, 0.55);
  ctx.fillStyle = U('#6c5832'); ctx.save(); ctx.translate(5, 1.2); ctx.rotate(0.5 + stroke * 0.5); ell(ctx, -1, 4.5, 2.2, 6, -0.2); ctx.fill(); ctx.restore();
  ell(ctx, -8, 2.5, 3.4, 1.5, 0.4); ctx.fill();
  ctx.fillStyle = U('#c9b27a'); ell(ctx, 0, 1.2, 9.2, 2.6); ctx.fill();
  ctx.restore();
  // shell awash
  ctx.beginPath(); ctx.moveTo(-9.5, 0); ctx.bezierCurveTo(-8.4, -2.5, -3, -3.3, 1, -3.2); ctx.bezierCurveTo(5.5, -3.1, 8.8, -2.1, 9.6, 0); ctx.ellipse(0, 0, 9.6, 9.6 * es, 0, 0, Math.PI); ctx.closePath();
  const g = ctx.createLinearGradient(0, -3.3, 0, 1); g.addColorStop(0, C('#a8873f')); g.addColorStop(1, C('#5a4320')); ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.clip(); ctx.strokeStyle = rgba(C('#e3c88a'), 0.6); ctx.lineWidth = Math.max(lw * 0.8, 0.45);
  ctx.beginPath(); for (const sx of [-5.5, -1.5, 2.5, 6]) { ctx.moveTo(sx, -3.4); ctx.lineTo(sx * 1.08, -0.9); } ctx.moveTo(-9, -1.1); ctx.quadraticCurveTo(0, -2.1, 9, -1.1); ctx.stroke(); ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; ell(ctx, -1, -2.6, 4.5, 0.6, -0.05); ctx.fill();
  // a front flipper breaking the surface on the stroke
  if (stroke > 0.2) { const k = (stroke - 0.2) / 0.8; ctx.fillStyle = C('#6c5832'); ctx.beginPath(); ctx.moveTo(3.5, 0.2); ctx.quadraticCurveTo(1.5, -3.5 * k, -1.8, -4.2 * k); ctx.quadraticCurveTo(0.5, -1.2 * k, 1.2, 0.3); ctx.fill(); }
  // head up to breathe
  const hy = -0.9 - br * 2.4, hx = 12.2 + br * 0.6;
  ctx.fillStyle = C('#8f7c4c'); ctx.beginPath(); ctx.moveTo(8.2, 0.3); ctx.quadraticCurveTo(10, hy + 0.6, hx - 1, hy - 0.4); ctx.lineTo(hx - 0.4, hy + 2.4); ctx.quadraticCurveTo(10.6, 0.6, 9.6, 0.4); ctx.fill();
  ctx.fillStyle = C('#9a8452'); ell(ctx, hx, hy, 2.5, 1.9, -0.25); ctx.fill();
  ctx.strokeStyle = rgba(C('#3a2c14'), 0.55); ctx.lineWidth = Math.max(lw * 0.7, 0.4); ctx.beginPath(); ctx.moveTo(hx - 1.4, hy - 1.4); ctx.lineTo(hx - 0.6, hy + 1.6); ctx.moveTo(hx + 0.4, hy - 1.8); ctx.lineTo(hx + 0.8, hy + 0.6); ctx.stroke();
  ctx.fillStyle = '#16120a'; ell(ctx, hx + 0.7, hy - 0.4, 0.45, 0.4); ctx.fill();
  if (br > 0.6) { const k = (br - 0.6) / 0.4; ctx.fillStyle = `rgba(255,255,255,${0.5 * k})`; ell(ctx, hx + 2.6, hy - 1.6 - k, 1 + k, 0.7 + k * 0.5); ctx.fill(); }   // a puff as it breathes
  // the waterline: a collar of foam around the shell
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.ellipse(0, 0, 10.4, 10.4 * es, 0, 0, Math.PI); ctx.ellipse(0, -0.3, 9.2, 9.2 * es, 0, Math.PI, 0, true); ctx.fill();
  ctx.restore();
}

// Channel marker for the chase view: a piling with a red triangle (even numbers) or green square (odd) daymark and a light,
// or a white PVC stake on the flats. (x, y) = the waterline at the foot; ~14 ft (62 units) tall, stakes 8 ft.
// o: kind 'red' | 'green' | 'white', n (number), t (the light blinks), tilt (camera pitch, sets the water rings), haze, hazeColor
function drawMarkerPost(ctx, x, y, s, o = {}) {
  const kind = o.kind || 'red', t = o.t || 0, K = SA_UPF * s, es = Math.sin(o.tilt != null ? o.tilt : SA_TILT), C = saHazer(o);
  const Z = (f) => -f * K, X = (f) => f * K, px = (f) => Math.max(0.7, f * K);
  ctx.save(); ctx.translate(x, y); ctx.lineCap = 'round';
  const ring = (rx, ph) => { for (let k = 0; k < 2; k++) saRings(ctx, 0, 0, rx, rx * 2.6, es, saFrac(t * 0.45 + k * 0.5 + ph), 0.45, Math.max(0.6, rx * 0.1)); };
  const collar = (rx, a) => { ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.beginPath(); ctx.ellipse(0, 0, rx * 1.12, rx * 1.12 * es, 0, 0, Math.PI); ctx.ellipse(0, -rx * es * 0.12, rx * 0.94, rx * 0.94 * es, 0, Math.PI, 0, true); ctx.fill(); };
  if (kind === 'white') {
    const lean = Math.sin((o.n || 3) * 12.9898) * 0.06, h = 8, w = Math.max(1, X(0.32));
    ring(X(0.45), (o.n || 0) * 0.37);
    ctx.save(); ctx.rotate(lean);
    const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0); g.addColorStop(0, C('#ffffff')); g.addColorStop(0.6, C('#e6eaec')); g.addColorStop(1, C('#a9b3b9'));
    ctx.fillStyle = g; ctx.fillRect(-w / 2, Z(h), w, -Z(h));
    ctx.fillStyle = 'rgba(90,110,70,0.55)'; ctx.fillRect(-w / 2, Z(0.7), w, -Z(0.7));
    ctx.fillStyle = C('#ff7a1a'); ctx.fillRect(-w / 2, Z(h - 1.1), w, -Z(0.45));
    ctx.restore(); collar(X(0.2), 0.6); ctx.restore(); return;
  }
  const h = 12.5, pw = Math.max(1, X(0.95)), red = kind === 'red';
  ring(X(0.6), (o.n || 0) * 0.29);
  const rg = ctx.createLinearGradient(0, 0, 0, -Z(2.6)); rg.addColorStop(0, 'rgba(40,30,20,0.35)'); rg.addColorStop(1, 'rgba(40,30,20,0)');
  ctx.fillStyle = rg; ctx.fillRect(-pw / 2, 0, pw, -Z(2.6));   // its reflection
  const g = ctx.createLinearGradient(-pw / 2, 0, pw / 2, 0); g.addColorStop(0, C('#9b7d58')); g.addColorStop(0.45, C('#7a6046')); g.addColorStop(1, C('#4b3a2a'));
  ctx.fillStyle = g; ctx.fillRect(-pw / 2, Z(h), pw, -Z(h));
  const bg = ctx.createLinearGradient(0, 0, 0, Z(1.8)); bg.addColorStop(0, C('#2f3a26')); bg.addColorStop(1, C('#5d6b45'));   // slime and barnacles at the waterline
  ctx.fillStyle = bg; ctx.fillRect(-pw / 2, Z(1.8), pw, -Z(1.8));
  collar(pw / 2, 0.7);
  ctx.fillStyle = C('#a5896a'); ell(ctx, 0, Z(h), pw / 2, Math.max(0.6, pw / 2 * es)); ctx.fill();
  if (K > 2) { ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(X(-0.3), Z(h), px(0.12), -Z(1.4)); ctx.fillRect(X(0.12), Z(h), px(0.09), -Z(0.8)); }   // the birds have been here
  const lit = saFrac(t / 2.5 + (o.n || 0) * 0.13) < 0.12, lc = red ? '#ff4b3a' : '#3bd46a';
  ctx.fillStyle = C('#22272b'); ctx.fillRect(X(-0.25), Z(h + 0.75), Math.max(1, X(0.5)), -Z(0.75));
  ctx.fillStyle = lit ? '#ffffff' : saMix(lc, '#000000', 0.35); ell(ctx, 0, Z(h + 1.0), Math.max(0.8, X(0.24)), Math.max(0.7, X(0.2))); ctx.fill();
  if (lit) { const R = Math.max(5, X(2.2)), gg = ctx.createRadialGradient(0, Z(h + 1), 0, 0, Z(h + 1), R); gg.addColorStop(0, rgba(lc, 0.9)); gg.addColorStop(1, rgba(lc, 0)); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = gg; ctx.fillRect(-R, Z(h + 1) - R, R * 2, R * 2); ctx.restore(); }
  const cz = 9.6, dc = C(red ? '#d8352e' : '#2b8a47');
  const board = () => { ctx.beginPath(); if (red) { ctx.moveTo(0, Z(cz + 2.0)); ctx.lineTo(X(1.9), Z(cz - 1.2)); ctx.lineTo(X(-1.9), Z(cz - 1.2)); } else ctx.rect(X(-1.55), Z(cz + 1.55), X(3.1), -Z(3.1)); ctx.closePath(); };
  const dg = ctx.createLinearGradient(X(-1.9), Z(cz + 2), X(1.9), Z(cz - 1.6)); dg.addColorStop(0, saMix(dc, '#ffffff', 0.15)); dg.addColorStop(1, saMix(dc, '#000000', 0.18));
  board(); ctx.fillStyle = dg; ctx.fill();
  if (K > 2) {
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = px(0.16); ctx.beginPath();
    if (red) { ctx.moveTo(0, Z(cz + 1.55)); ctx.lineTo(X(1.5), Z(cz - 0.95)); ctx.lineTo(X(-1.5), Z(cz - 0.95)); ctx.closePath(); } else ctx.rect(X(-1.32), Z(cz + 1.32), X(2.64), -Z(2.64));
    ctx.stroke();
  }
  if (o.n != null && K > 3) { ctx.fillStyle = '#ffffff'; ctx.font = fnt(Math.round(X(red ? 1.25 : 1.5)), 800); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(o.n), 0, Z(red ? cz - 0.1 : cz) + X(0.05)); }
  ctx.restore();
}
// A trap float bobbing, side view, for the chase camera. (x, y) = the waterline under it; ~14 units across (as overstated as the chart's floats).
// o: color, stripe, t, phase, tilt, haze, hazeColor
function drawTrapFloat(ctx, x, y, s, o = {}) {
  const t = o.t || 0, C = saHazer(o), col = C(o.color || '#ff6a3d'), st = C(o.stripe || '#1b3f8a'), K = s * 10.5, es = Math.sin(o.tilt != null ? o.tilt : SA_TILT);
  const ph = o.phase != null ? o.phase : x * 0.031 + y * 0.017, bob = Math.sin(t * 2.2 + ph) * 0.1, tl = Math.sin(t * 1.6 + ph * 1.3) * 0.14;
  const X = (f) => f * K, Z = (f) => -f * K, w = 0.66, h = 1.25 + bob, px = (f) => Math.max(0.6, f * K);
  ctx.save(); ctx.translate(x, y);
  for (let k = 0; k < 2; k++) saRings(ctx, 0, 0, X(w * 1.05), X(w * 2.8), es, saFrac(t * 0.45 + k * 0.5 + ph * 0.1), 0.45, Math.max(0.6, X(0.08)));
  ctx.save(); ctx.rotate(tl);
  ctx.fillStyle = rgba(saMix(col, SA_DEEP, 0.65), 0.5); ctx.beginPath(); ctx.ellipse(0, 0, X(w), X(w) * es, 0, 0, Math.PI); ctx.lineTo(X(-w * 0.8), -Z(0.35)); ctx.quadraticCurveTo(0, -Z(0.5), X(w * 0.8), -Z(0.35)); ctx.closePath(); ctx.fill();
  const body = () => { ctx.beginPath(); ctx.moveTo(X(-w), 0); ctx.lineTo(X(-w), Z(h * 0.55)); ctx.bezierCurveTo(X(-w), Z(h * 1.08), X(w), Z(h * 1.08), X(w), Z(h * 0.55)); ctx.lineTo(X(w), 0); ctx.ellipse(0, 0, X(w), X(w) * es, 0, 0, Math.PI); ctx.closePath(); };
  body(); const g = ctx.createLinearGradient(X(-w), 0, X(w), 0); g.addColorStop(0, saMix(col, '#ffffff', 0.35)); g.addColorStop(0.45, col); g.addColorStop(1, saMix(col, '#000000', 0.32));
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.clip(); ctx.fillStyle = st; ctx.beginPath(); ctx.ellipse(0, Z(h * 0.36), X(w * 1.1), X(w) * es, 0, 0, TAU); ctx.ellipse(0, Z(h * 0.56), X(w * 1.1), X(w) * es, 0, 0, TAU); ctx.fill('evenodd');
  ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(X(w * 0.42), Z(h * 1.1), X(w), -Z(h * 1.2)); ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.42)'; ell(ctx, X(-w * 0.32), Z(h * 0.84), X(w * 0.2), X(w * 0.14)); ctx.fill();
  if (K > 4) { ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = px(0.05); body(); ctx.stroke(); }
  ctx.fillStyle = '#3a3226'; ell(ctx, 0, Z(h * 1.01), Math.max(0.6, X(0.13)), Math.max(0.5, X(0.08))); ctx.fill();   // the rope knotted on top
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath(); ctx.ellipse(0, 0, X(w * 1.12), X(w * 1.12) * es, 0, 0, Math.PI); ctx.ellipse(0, -X(w) * es * 0.12, X(w * 0.94), X(w * 0.94) * es, 0, Math.PI, 0, true); ctx.fill();
  ctx.restore();
}
// Alligator Reef Light: octagonal skeletal iron tower on the reef, keeper's quarters, white stair tube and a lantern that flashes in groups of four.
// (x, y) = the waterline at the center of the base. 136 ft ≈ 600 units tall (s 0.1 → 60 px, s 0.5 → 300 px). o: t, tilt, haze, hazeColor
function drawLighthouseSide(ctx, x, y, s, o = {}) {
  const t = o.t || 0, K = SA_UPF * s, es = Math.sin(o.tilt != null ? o.tilt : SA_TILT), C = saHazer(o);
  const X = (f) => f * K, Z = (f) => -f * K, px = (f, m = 0.6) => Math.max(m, f * K);
  const iron = C('#2f3439'), white = C('#f2efe6'), hw = (z, outer) => lerp(outer ? 27 : 11.2, outer ? 7.2 : 3, z / 118), zs = [12, 30, 46, 62, 78, 94, 108, 118];
  ctx.save(); ctx.translate(x, y); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.save(); ctx.scale(1, es); const sg0 = ctx.createRadialGradient(0, 0, 0, 0, 0, X(60)); sg0.addColorStop(0, 'rgba(120,225,215,0.38)'); sg0.addColorStop(0.55, 'rgba(110,210,205,0.18)'); sg0.addColorStop(1, 'rgba(110,210,205,0)');
  ctx.fillStyle = sg0; ctx.beginPath(); ctx.arc(0, 0, X(60), 0, TAU); ctx.fill(); ctx.restore();   // the reef shallows around it
  ctx.strokeStyle = C('#69717a'); ctx.lineWidth = px(0.7, 0.5); ctx.beginPath();   // the far side's braces, seen through the frame
  for (let i = 0; i < zs.length - 1; i++) { const a = zs[i], b = zs[i + 1]; ctx.moveTo(X(-hw(a, false)), Z(a)); ctx.lineTo(X(hw(b, false)), Z(b)); ctx.moveTo(X(hw(a, false)), Z(a)); ctx.lineTo(X(-hw(b, false)), Z(b)); }
  ctx.stroke();
  ctx.fillStyle = white; ctx.fillRect(X(-12.5), Z(44), X(25), -Z(22));   // keeper's quarters
  ctx.fillStyle = 'rgba(0,0,0,0.13)'; ctx.fillRect(X(4), Z(44), X(8.5), -Z(22));
  ctx.fillStyle = C('#3b4148'); ctx.fillRect(X(-14), Z(45.5), X(28), -Z(1.5)); ctx.fillRect(X(-14), Z(23), X(28), -Z(1.2));
  if (K > 0.6) { ctx.fillStyle = C('#2a3036'); for (const wx of [-8, -1.5, 5]) for (const wz of [27, 36]) ctx.fillRect(X(wx), Z(wz + 4.5), X(3), -Z(4.5)); }
  const sg = ctx.createLinearGradient(X(-3.3), 0, X(3.3), 0); sg.addColorStop(0, C('#ffffff')); sg.addColorStop(0.5, white); sg.addColorStop(1, C('#b9b4a8'));
  ctx.fillStyle = sg; ctx.fillRect(X(-3.2), Z(118), Math.max(1, X(6.4)), -Z(118 - 44));   // stair tube
  for (const [d, outer] of [[-1, true], [1, true], [-1, false], [1, false]]) { ctx.strokeStyle = outer ? iron : C('#3c4248'); ctx.lineWidth = px(outer ? 1.5 : 1.1, outer ? 1 : 0.7); ctx.beginPath(); ctx.moveTo(X(d * hw(0, outer)), X(0.6) * es); ctx.lineTo(X(d * hw(118, outer)), Z(118)); ctx.stroke(); }
  ctx.strokeStyle = iron; ctx.lineWidth = px(0.9, 0.7); ctx.beginPath();
  for (const z of zs.slice(0, -1)) { ctx.moveTo(X(-hw(z, true)), Z(z)); ctx.lineTo(X(hw(z, true)), Z(z)); }
  ctx.stroke();
  ctx.strokeStyle = rgba(iron, 0.85); ctx.lineWidth = px(0.55, 0.5); ctx.beginPath();
  for (let i = 0; i < zs.length - 1; i++) for (const d of [-1, 1]) { const a = zs[i], b = zs[i + 1]; ctx.moveTo(X(d * hw(a, true)), Z(a)); ctx.lineTo(X(d * hw(b, false)), Z(b)); ctx.moveTo(X(d * hw(a, false)), Z(a)); ctx.lineTo(X(d * hw(b, true)), Z(b)); }
  ctx.stroke();
  if (K > 0.6) { ctx.strokeStyle = 'rgba(120,80,52,0.6)'; ctx.lineWidth = px(0.5); ctx.beginPath(); for (const z of [12, 30, 46]) { ctx.moveTo(X(-hw(z, true)), Z(z) + px(0.6)); ctx.lineTo(X(hw(z, true)), Z(z) + px(0.6)); } ctx.stroke(); }
  ctx.fillStyle = C('#3b4148'); ctx.fillRect(X(-30), Z(12), X(60), -Z(1.2));   // the landing deck
  ctx.fillStyle = iron; ctx.fillRect(X(-10), Z(119), X(20), -Z(1.4));   // gallery, watch room, lantern, dome
  ctx.strokeStyle = iron; ctx.lineWidth = px(0.35, 0.5); ctx.beginPath(); ctx.moveTo(X(-10), Z(122.5)); ctx.lineTo(X(10), Z(122.5)); for (let i = -10; i <= 10; i += 2.5) { ctx.moveTo(X(i), Z(119)); ctx.lineTo(X(i), Z(122.5)); } ctx.stroke();
  ctx.fillStyle = C('#25292d'); ctx.fillRect(X(-5.2), Z(127), X(10.4), -Z(8));
  const p = saFrac(t / 6), flash = [0, 0.09, 0.18, 0.27].some((f) => p > f && p < f + 0.035);
  const lg = ctx.createLinearGradient(0, Z(135), 0, Z(127)); lg.addColorStop(0, flash ? '#fffbe0' : C('#6b6a52')); lg.addColorStop(1, flash ? '#ffe680' : C('#3e3d30'));
  ctx.fillStyle = lg; ctx.fillRect(X(-4.2), Z(135), X(8.4), -Z(8));
  if (K > 0.6) { ctx.strokeStyle = '#1e2226'; ctx.lineWidth = px(0.35, 0.5); ctx.beginPath(); for (const i of [-2.1, 0, 2.1]) { ctx.moveTo(X(i), Z(127)); ctx.lineTo(X(i), Z(135)); } ctx.stroke(); }
  ctx.fillStyle = iron; ctx.fillRect(X(-7), Z(127.6), X(14), -Z(0.8));
  ctx.beginPath(); ctx.moveTo(X(-5), Z(135)); ctx.quadraticCurveTo(0, Z(141), X(5), Z(135)); ctx.closePath(); ctx.fill();
  ell(ctx, 0, Z(141.3), px(0.9), px(0.9)); ctx.fill(); ctx.strokeStyle = iron; ctx.lineWidth = px(0.3, 0.5); ctx.beginPath(); ctx.moveTo(0, Z(141)); ctx.lineTo(0, Z(145)); ctx.stroke();
  if (flash) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const R = Math.max(10, X(26)), g = ctx.createRadialGradient(0, Z(131), 0, 0, Z(131), R); g.addColorStop(0, 'rgba(255,250,215,0.95)'); g.addColorStop(0.25, 'rgba(255,240,170,0.45)'); g.addColorStop(1, 'rgba(255,240,170,0)');
    ctx.fillStyle = g; ctx.fillRect(-R, Z(131) - R, R * 2, R * 2);
    for (const d of [-1, 1]) { const bl = Math.max(30, X(120)), bg = ctx.createLinearGradient(0, 0, d * bl, 0); bg.addColorStop(0, 'rgba(255,245,200,0.4)'); bg.addColorStop(1, 'rgba(255,245,200,0)'); ctx.fillStyle = bg; ctx.beginPath(); ctx.moveTo(0, Z(131) - px(2, 1)); ctx.lineTo(d * bl, Z(131) - Math.max(5, X(14))); ctx.lineTo(d * bl, Z(131) + Math.max(5, X(14))); ctx.lineTo(0, Z(131) + px(2, 1)); ctx.fill(); }
    ctx.restore();
  }
  const fr = mulberry(19); ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath();   // surf working around the piles
  for (let i = 0; i < 16; i++) { const ex = -30 + fr() * 60, ez = (fr() - 0.3) * 6, j = Math.max(0, Math.sin(t * 2.1 + i * 1.9)), rx = px(1.2 + fr() * 2.4 + j, 0.6), ry = px((0.5 + fr() * 0.6) * (1 + j), 0.4); ctx.moveTo(X(ex) + rx, X(ez) * es); ctx.ellipse(X(ex), X(ez) * es, rx, ry, 0, 0, TAU); }
  ctx.fill();
  ctx.restore();
}
