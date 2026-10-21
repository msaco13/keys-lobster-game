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
  const aw = Math.sin(t * 2.2) * 0.1 + (o.twitch || 0);
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
function drawLobsterTop(ctx, C, o = {}) {
  const t = o.t || 0, LP = o.gold ? LOBPAL.gold : LOBPAL.normal;
  ctx.save();
  for (const s of [-1, 1]) drawAntenna(ctx, C * 1.02, s * C * 0.13, C * 2.7, s * (0.3 + Math.sin(t * 1.4 + s) * 0.04), C * 0.085, s, LP);
  ctx.strokeStyle = '#f2dcae'; ctx.lineWidth = C * 0.02;
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(C * 1.0, s * C * 0.05); ctx.lineTo(C * 1.35, s * C * 0.12); ctx.lineTo(C * 1.5, s * C * 0.08); ctx.stroke(); }
  ctx.lineCap = 'round';
  for (const s of [-1, 1]) for (let i = 0; i < 5; i++) {
    const lx = C * (0.12 + i * 0.17), kx = lx + C * 0.12, ky = s * C * 0.58, fx = lx + C * 0.32, fy = s * C * 0.72;
    ctx.strokeStyle = LP.leg; ctx.lineWidth = C * 0.05; ctx.beginPath(); ctx.moveTo(lx, s * C * 0.3); ctx.lineTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke();
    ctx.strokeStyle = LP.legS; ctx.lineWidth = C * 0.022; ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo((kx + fx) / 2, (ky + fy) / 2); ctx.stroke();
  }
  for (let i = 0; i < 6; i++) {
    const x0 = -i * C * 0.2, w = C * (0.62 - i * 0.03);
    ctx.fillStyle = i % 2 ? LP.t1 : LP.t2; rr(ctx, x0 - C * 0.215, -w / 2, C * 0.225, w, C * 0.08); ctx.fill();
    ctx.strokeStyle = 'rgba(80,30,10,0.4)'; ctx.lineWidth = C * 0.012; ctx.stroke();
    ctx.fillStyle = LP.spot; ell(ctx, x0 - C * 0.1, -w * 0.26, C * 0.04, C * 0.035); ctx.fill(); ell(ctx, x0 - C * 0.1, w * 0.26, C * 0.04, C * 0.035); ctx.fill();
  }
  ctx.save(); ctx.translate(-C * 1.2, 0);
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
  if (mood === 'sunset') { g.addColorStop(0, '#2b3d74'); g.addColorStop(0.45, '#c8577a'); g.addColorStop(0.8, '#f59a52'); g.addColorStop(1, '#ffd08a'); }
  else if (mood === 'dawn') { g.addColorStop(0, '#3b7fcf'); g.addColorStop(0.6, '#9fd0f0'); g.addColorStop(1, '#ffe4b0'); }
  else { g.addColorStop(0, '#2f7fd6'); g.addColorStop(0.65, '#8fcbf1'); g.addColorStop(1, '#d6eefa'); }
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, h);
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
  if (!o.under) {
    drawSky(ctx, w, ih * 0.52, 'day');
    drawCloud(ctx, w * 0.2, ih * 0.16, 0.6, 0.85); drawCloud(ctx, w * 0.8, ih * 0.1, 0.45, 0.75);
    const sg = ctx.createLinearGradient(0, ih * 0.5, 0, ih); sg.addColorStop(0, '#1d72b8'); sg.addColorStop(1, '#0b3f6e'); ctx.fillStyle = sg; ctx.fillRect(0, ih * 0.5, w, ih * 0.5);
    ctx.fillStyle = 'rgba(255,255,255,0.2)'; for (let i = 0; i < 18; i++) { const yy = ih * 0.53 + (i % 6) * ih * 0.08; ctx.fillRect((i * 97) % w, yy, 26, 2); }
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(w * (0.1 + i * 0.2), 0); ctx.lineTo(w * (0.2 + i * 0.2), 0); ctx.lineTo(w * (0.05 + i * 0.2), ih); ctx.lineTo(w * (-0.05 + i * 0.2), ih); ctx.fill(); }
  }
  const s = w * 0.085;
  drawHeroShot(ctx, c.ch, c.key === 'lobster' ? { kind: 'lobster', cl: c.cl } : { kind: 'fish', key: c.key, weight: c.weight }, w * 0.5, ih * 0.42, s, t);
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
