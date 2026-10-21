'use strict';
/* Keys Crew — crew, species, spots, captions, trip state and the logbook. */

const CHARS = {
  michael: {
    id: 'michael', name: 'Michael', title: 'The Bug Hunter', color: '#ff6a3d',
    skin: '#dba67d', skinDark: '#b98059', hair: '#2a1c13',
    head: 'cap', capColor: '#1b1e25', capBrim: '#121418', capPatch: '#c8372d',
    beard: 'stubble', beardColor: '#3a291d',
    shades: { frame: '#16181c', lens1: '#1758d6', lens2: '#86e6ff', style: 'sport' },
    shirt: '#eef2f5', sleeve: null, shirtLogo: '#26406a',
    rash: { base: '#2a2622', camo: ['#6a4529', '#8d5f37', '#3d3b33'] },
    shorts: { base: '#f3f3ef', stripes: ['#2b8fdc', '#1b5ea8', '#63bef2'] },
    gloves: '#1d4f8a', expr: 'smile',
    perks: { breath: 1.35, window: 1.3, bite: 1, trophy: 1, reel: 1, line: 1, coax: 1.2 },
    perkText: ['Big lungs: 35% more breath on dives', 'Quick hands: wider hook-set and net timing']
  },
  jorge: {
    id: 'jorge', name: 'Jorge', title: 'Lucky Shades', color: '#ffc845',
    skin: '#c99469', skinDark: '#a67350', hair: null,
    head: 'bald', beard: 'salt', beardColor: '#5e554e',
    shades: { frame: '#f4f6f8', lens1: '#1452c9', lens2: '#8fe8ff', style: 'wrap' },
    shirt: '#d6dbe2', sleeve: null, shirtLogo: null,
    rash: { base: '#c9ced6', camo: null },
    shorts: { base: '#36475c', stripes: ['#4f6580'] },
    gloves: '#2a2d33', expr: 'open',
    perks: { breath: 1, window: 1, bite: 1.3, trophy: 1.2, reel: 1, line: 1, coax: 1 },
    perkText: ['Lucky shades: fish bite 30% sooner', 'Trophy magnet: better odds at a big one']
  },
  jemel: {
    id: 'jemel', name: 'Jemel', title: 'Big Game', color: '#42d3c4',
    skin: '#6b4430', skinDark: '#52321f', hair: '#140f0c',
    head: 'short', beard: 'goatee', beardColor: '#1a120e',
    shades: { frame: '#0f1113', lens1: '#1a5fd8', lens2: '#86e0ff', style: 'sport' },
    shirt: '#f4f6f8', sleeve: 'mahi', shirtLogo: null,
    rash: { base: '#f0f3f5', camo: null, sleeve: 'mahi' },
    shorts: { base: '#3b2a24', stripes: ['#6c5646'] },
    gloves: '#2a2d33', expr: 'grin',
    perks: { breath: 1, window: 1, bite: 1, trophy: 1, reel: 1.25, line: 1.12, coax: 1 },
    perkText: ['Heavy hands: reel 25% faster', 'Strong line: 12% more pull before it snaps']
  }
};
const CHAR_ORDER = ['michael', 'jorge', 'jemel'];

/* pow: how hard it pulls (0–1), stam: seconds of fight, jump: chance to jump on a run,
   rock: how hard it dives for structure, mult: points per pound */
const SPECIES = {
  yellowtail: { name: 'Yellowtail Snapper', short: 'Yellowtail', min: 1, max: 5, mult: 55, pow: 0.4, stam: 5, bait: 'squid' },
  mangrove: { name: 'Mangrove Snapper', short: 'Mangrove', min: 1, max: 8, mult: 60, pow: 0.5, stam: 6, rock: 0.35, bait: 'both', crafty: true },
  mutton: { name: 'Mutton Snapper', short: 'Mutton', min: 4, max: 16, mult: 38, pow: 0.6, stam: 8, rock: 0.3, bait: 'both' },
  redgrouper: { name: 'Red Grouper', short: 'Red Grouper', min: 5, max: 18, mult: 34, pow: 0.65, stam: 8, rock: 0.6, bait: 'pinfish' },
  blackgrouper: { name: 'Black Grouper', short: 'Black Grouper', min: 12, max: 65, mult: 24, pow: 0.85, stam: 11, rock: 1, bait: 'pinfish' },
  amberjack: { name: 'Amberjack', short: 'Amberjack', min: 18, max: 60, mult: 13, pow: 0.9, stam: 14, rock: 0.25, bait: 'pinfish' },
  goliath: { name: 'Goliath Grouper', short: 'Goliath', min: 120, max: 400, mult: 3, release: true, relBonus: 400, pow: 1, stam: 20, rock: 1.3, bait: 'pinfish', rare: true },
  mahi: { name: 'Mahi-Mahi', short: 'Mahi', min: 4, max: 45, mult: 20, pow: 0.75, stam: 11, jump: 0.6 },
  blackfin: { name: 'Blackfin Tuna', short: 'Blackfin', min: 6, max: 35, mult: 24, pow: 0.85, stam: 13 },
  wahoo: { name: 'Wahoo', short: 'Wahoo', min: 18, max: 80, mult: 12, pow: 0.95, stam: 10, jump: 0.05 },
  kingfish: { name: 'Kingfish', short: 'Kingfish', min: 8, max: 45, mult: 13, pow: 0.7, stam: 9, jump: 0.15 },
  sailfish: { name: 'Sailfish', short: 'Sailfish', min: 30, max: 90, mult: 10, release: true, relBonus: 350, pow: 0.8, stam: 15, jump: 0.85 },
  bluemarlin: { name: 'Blue Marlin', short: 'Blue Marlin', min: 180, max: 550, mult: 3, release: true, relBonus: 900, pow: 1, stam: 24, jump: 0.7, rare: true },
  barracuda: { name: 'Barracuda', short: 'Cuda', min: 5, max: 35, mult: 6, pow: 0.8, stam: 8, jump: 0.5 },
  bonefish: { name: 'Bonefish', short: 'Bonefish', min: 3, max: 11, mult: 100, release: true, pow: 0.9, stam: 8, spook: 30, notice: 92, strip: 0.6, speed: 42, vis: 0.38 },
  permit: { name: 'Permit', short: 'Permit', min: 8, max: 40, mult: 55, release: true, pow: 0.85, stam: 12, spook: 36, notice: 74, strip: 1.15, speed: 36, vis: 0.55 },
  tarpon: { name: 'Tarpon', short: 'Tarpon', min: 40, max: 160, mult: 7, release: true, pow: 0.95, stam: 16, jump: 0.9, spook: 24, notice: 112, strip: 0.45, speed: 30, vis: 0.62 },
  redfish: { name: 'Redfish', short: 'Redfish', min: 4, max: 16, mult: 38, release: true, pow: 0.6, stam: 8, spook: 20, notice: 92, strip: 0.65, speed: 24, vis: 0.66 },
  snook: { name: 'Snook', short: 'Snook', min: 4, max: 22, mult: 36, release: true, pow: 0.7, stam: 8, jump: 0.25, rock: 0.6, spook: 22, notice: 92, strip: 0.4, speed: 20, vis: 0.56 },
  trout: { name: 'Spotted Seatrout', short: 'Seatrout', min: 1, max: 6, mult: 55, release: true, pow: 0.35, stam: 5, spook: 16, notice: 82, strip: 0.5, speed: 22, vis: 0.46 },
  lobster: { name: 'Spiny Lobster', short: 'Lobster', min: 0.6, max: 7, mult: 100 }
};
const SPECIES_ORDER = ['lobster', 'yellowtail', 'mangrove', 'mutton', 'redgrouper', 'blackgrouper', 'amberjack', 'goliath', 'mahi', 'blackfin', 'wahoo', 'kingfish', 'sailfish', 'bluemarlin', 'barracuda', 'bonefish', 'permit', 'tarpon', 'redfish', 'snook', 'trout'];

function rollWeight(key, perks) {
  const sp = SPECIES[key]; const k = 2.3 / ((perks && perks.trophy) || 1);
  const r = Math.pow(Math.random(), k);
  return Math.round((sp.min + (sp.max - sp.min) * r) * 10) / 10;
}
function sizeNorm(key, w) { const sp = SPECIES[key]; return clamp((w - sp.min) / (sp.max - sp.min), 0, 1); }

// Build a scored catch record. extras: [{label, pts}]
function makeCatch(key, weight, ch, spot, extras = []) {
  const sp = SPECIES[key];
  const lines = [{ label: fmtLb(weight) + ' × ' + sp.mult, pts: Math.round(weight * sp.mult) }];
  const trophy = sizeNorm(key, weight) >= 0.72;
  if (trophy) lines.push({ label: 'Trophy', pts: Math.round(weight * sp.mult * 0.2) });
  if (sp.release && sp.relBonus) lines.push({ label: 'Clean release', pts: sp.relBonus });
  for (const e of extras) lines.push(e);
  const pts = lines.reduce((a, l) => a + l.pts, 0);
  return { key, name: sp.name, weight, ch, spot, trophy, released: !!sp.release, lines, pts, at: Date.now() };
}

const SPOTS = {
  bughunt: { id: 'bughunt', name: 'Patch Reefs', kind: 'Bug Hunt', depth: '12–20 ft', species: ['lobster'],
    blurb: 'Free-dive the patch reefs for spiny lobster. Tickle them out of their holes, net them, and gauge every bug before it goes in the bag.',
    tip: 'Let go of TICKLE when the antennae twitch. Tap NET when the ring hits the gold circle.' },
  bottom: { id: 'bottom', name: 'The Ledge', kind: 'Bottom Fishing', depth: '95 ft', species: ['yellowtail', 'mangrove', 'mutton', 'redgrouper', 'blackgrouper', 'amberjack', 'goliath'],
    blurb: 'Anchor up on the reef ledge and drop baits for snapper and grouper. Wait out the nibbles, set the hook on the real bite, then pull them off the rocks.',
    tip: 'Squid for snapper, live pinfish for grouper. Don’t swing on a nibble.' },
  troll: { id: 'troll', name: 'The Weedline', kind: 'Trolling', depth: '600+ ft', species: ['mahi', 'blackfin', 'wahoo', 'kingfish', 'sailfish', 'bluemarlin', 'barracuda'],
    blurb: 'Run offshore to the weedline. Drag your spread past the sargassum, the birds and the floating debris for mahi, tuna, wahoo and sailfish.',
    tip: 'Steer so the lures cross the fish, not the boat. Stay off the trap floats.' },
  flats: { id: 'flats', name: 'Florida Bay', kind: 'Backcountry', depth: '1–4 ft', species: ['bonefish', 'permit', 'tarpon', 'redfish', 'snook', 'trout'],
    blurb: 'Pole the backcountry flats and sight-cast to bonefish, permit, tarpon, redfish and snook. Lead the fish, strip it home, and don’t spook it.',
    tip: 'Cast a few feet in front of the fish. Strip in rhythm and set it when it eats.' }
};
const SPOT_ORDER = ['bughunt', 'bottom', 'troll', 'flats'];

const CAPTIONS = {
  bigbug: 'One of the big boys today 🦞',
  bigmahi: 'The lobster were out but this beauty took the show today 🤙',
  glass: 'Couldn’t have picked a better day. #Glass',
  tuesday: 'Last-minute fishing trip on a Tuesday morning 🎣',
  generic: ['Chill 😎', 'Same crew, same water.', 'Keys therapy.', 'Tight lines and good friends.', 'Another one for the books.', 'Easy day on the water.', 'Ice chest is filling up.', 'Not a bad office.']
};

function rollWeather() {
  const r = Math.random();
  if (r < 0.36) return { id: 'glass', name: 'Glass calm', wind: '0–5 kts', vis: 1.25, drift: 0, aim: 0.75, tag: '#Glass' };
  if (r < 0.8) return { id: 'light', name: 'Light chop', wind: '5–10 kts', vis: 1, drift: 0.5, aim: 1 };
  return { id: 'breezy', name: 'Breezy', wind: '15–20 kts', vis: 0.8, drift: 1, aim: 1.35 };
}

/* ---------- trip state (saved after every turn so a phone nap doesn't wipe the day) ---------- */
const Trip = {
  cur: null,
  start(o) {
    const scores = {}; o.crew.forEach((c) => (scores[c] = 0));
    this.cur = {
      id: Date.now(), mode: o.mode, crew: o.crew.slice(), plan: o.plan,
      spotsNeeded: o.plan === 'full' ? 4 : o.plan === 'half' ? 2 : 0,
      sessionLen: o.sessionLen, weather: rollWeather(), date: new Date().toISOString(),
      done: [], spot: null, turn: 0, scores, catches: [], turns: []
    };
    this.save();
  },
  save() { if (this.cur && this.cur.mode === 'crew') Store.set('trip', this.cur); },
  load() { const t = Store.get('trip', null); return t && t.crew && t.scores ? t : null; },
  resume() { this.cur = this.load(); return !!this.cur; },
  clear() { Store.del('trip'); },
  get player() { return this.cur.crew[this.cur.turn]; },
  record(ch, spot, res) {
    const c = this.cur; c.scores[ch] = (c.scores[ch] || 0) + res.total;
    for (const k of res.catches) c.catches.push(k);
    c.turns.push({ ch, spot, total: res.total, n: res.catches.length });
    Records.add(res.catches);
    this.save();
  },
  leader() {
    const c = this.cur; let best = null;
    for (const ch of c.crew) if (!best || c.scores[ch] > c.scores[best]) best = ch;
    return best;
  }
};

const Records = {
  all() { return Store.get('records', {}); },
  add(catches) {
    const rec = this.all(); let changed = false;
    for (const k of catches) {
      if (!k || !k.weight || k.fine) continue;
      const r = rec[k.key];
      if (!r || k.weight > r.w) { rec[k.key] = { w: k.weight, ch: k.ch, date: new Date().toISOString() }; changed = true; k.pb = true; }
    }
    if (changed) Store.set('records', rec);
  },
  isRecord(key, w) { const r = this.all()[key]; return !r || w > r.w; },
  trips() { return Store.get('trips', []); },
  addTrip(t) { const list = this.trips(); list.unshift(t); Store.set('trips', list.slice(0, 12)); }
};
