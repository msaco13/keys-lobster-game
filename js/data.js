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
    perks: { breath: 1.35, window: 1.3, bite: 1, trophy: 1, reel: 1, line: 1, coax: 1 },
    perkText: ['Big lungs: 35% more breath on dives', 'Quick hands: more time on hook-sets, jumps and bugs']
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
    perkText: ['Lucky shades: fish bite and bugs come out 30% sooner', 'Trophy magnet: better odds at a big one']
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
    perks: { breath: 1, window: 1, bite: 1, trophy: 1, reel: 1.12, line: 1.12, coax: 1 },
    perkText: ['Heavy hands: reel 12% faster', 'Strong line: 12% more pull before it snaps']
  }
};
const CHAR_ORDER = ['michael', 'jorge', 'jemel'];

/* pow: how hard it pulls (0–1), stam: seconds of fight, jump: chance to jump on a run,
   rock: how hard it dives for structure, mult: points per pound */
const SPECIES = {
  // the reef and the ledge
  whitegrunt: { name: 'White Grunt', short: 'Grunt', min: 0.5, max: 3, mult: 70, pow: 0.3, stam: 4, bait: 'squid' },
  lane: { name: 'Lane Snapper', short: 'Lane', min: 0.5, max: 4, mult: 66, pow: 0.35, stam: 4, bait: 'squid' },
  yellowtail: { name: 'Yellowtail Snapper', short: 'Yellowtail', min: 1, max: 5, mult: 55, pow: 0.4, stam: 5, bait: 'squid' },
  mangrove: { name: 'Mangrove Snapper', short: 'Mangrove', min: 1, max: 8, mult: 60, pow: 0.5, stam: 6, rock: 0.35, bait: 'both', crafty: true, spook: 18, notice: 80, strip: 0.5, speed: 20, vis: 0.48 },
  mutton: { name: 'Mutton Snapper', short: 'Mutton', min: 4, max: 16, mult: 38, pow: 0.6, stam: 8, rock: 0.3, bait: 'both' },
  hogfish: { name: 'Hogfish', short: 'Hogfish', min: 2, max: 19, mult: 46, pow: 0.55, stam: 7, rock: 0.4, bait: 'squid' },
  trigger: { name: 'Gray Triggerfish', short: 'Trigger', min: 1.5, max: 10, mult: 50, pow: 0.55, stam: 6, rock: 0.3, bait: 'squid', crafty: true },
  redgrouper: { name: 'Red Grouper', short: 'Red Grouper', min: 5, max: 18, mult: 34, pow: 0.65, stam: 8, rock: 0.6, bait: 'pinfish' },
  blackgrouper: { name: 'Black Grouper', short: 'Black Grouper', min: 12, max: 65, mult: 24, pow: 0.85, stam: 11, rock: 1, bait: 'pinfish' },
  cubera: { name: 'Cubera Snapper', short: 'Cubera', min: 25, max: 100, mult: 11, pow: 0.95, stam: 15, rock: 1.1, bait: 'pinfish', rare: true },
  amberjack: { name: 'Amberjack', short: 'Amberjack', min: 18, max: 60, mult: 13, pow: 0.9, stam: 14, rock: 0.25, bait: 'pinfish' },
  cobia: { name: 'Cobia', short: 'Cobia', min: 12, max: 85, mult: 14, pow: 0.85, stam: 13, jump: 0.05, bait: 'pinfish' },
  pompano: { name: 'African Pompano', short: 'Af. Pompano', min: 10, max: 42, mult: 22, pow: 0.8, stam: 11, bait: 'pinfish' },
  goliath: { name: 'Goliath Grouper', short: 'Goliath', min: 120, max: 400, mult: 3, release: true, relBonus: 400, pow: 1, stam: 20, rock: 1.3, bait: 'pinfish', rare: true },
  // offshore
  bonita: { name: 'Little Tunny', short: 'Bonita', min: 4, max: 18, mult: 16, pow: 0.75, stam: 9 },
  mahi: { name: 'Mahi-Mahi', short: 'Mahi', min: 4, max: 45, mult: 20, pow: 0.75, stam: 11, jump: 0.6 },
  tripletail: { name: 'Tripletail', short: 'Tripletail', min: 3, max: 25, mult: 34, pow: 0.6, stam: 8, jump: 0.2 },
  blackfin: { name: 'Blackfin Tuna', short: 'Blackfin', min: 6, max: 35, mult: 24, pow: 0.85, stam: 13 },
  yellowfin: { name: 'Yellowfin Tuna', short: 'Yellowfin', min: 30, max: 190, mult: 8, pow: 1, stam: 20, rare: true },
  wahoo: { name: 'Wahoo', short: 'Wahoo', min: 18, max: 80, mult: 12, pow: 0.95, stam: 10, jump: 0.05 },
  kingfish: { name: 'Kingfish', short: 'Kingfish', min: 8, max: 45, mult: 13, pow: 0.7, stam: 9, jump: 0.15 },
  sailfish: { name: 'Sailfish', short: 'Sailfish', min: 30, max: 90, mult: 10, release: true, relBonus: 350, pow: 0.8, stam: 15, jump: 0.85 },
  bluemarlin: { name: 'Blue Marlin', short: 'Blue Marlin', min: 180, max: 550, mult: 3, release: true, relBonus: 900, pow: 1, stam: 24, jump: 0.7, rare: true },
  barracuda: { name: 'Barracuda', short: 'Cuda', min: 5, max: 35, mult: 6, pow: 0.8, stam: 8, jump: 0.5 },
  // the backcountry and the bridges
  bonefish: { name: 'Bonefish', short: 'Bonefish', min: 3, max: 11, mult: 100, release: true, pow: 0.9, stam: 8, spook: 30, notice: 92, strip: 0.6, speed: 42, vis: 0.38 },
  permit: { name: 'Permit', short: 'Permit', min: 8, max: 40, mult: 35, release: true, pow: 0.85, stam: 12, spook: 36, notice: 74, strip: 1.15, speed: 36, vis: 0.55 },
  tarpon: { name: 'Tarpon', short: 'Tarpon', min: 40, max: 160, mult: 7, release: true, pow: 0.95, stam: 16, jump: 0.9, spook: 24, notice: 112, strip: 0.45, speed: 30, vis: 0.62 },
  redfish: { name: 'Redfish', short: 'Redfish', min: 4, max: 16, mult: 38, release: true, pow: 0.6, stam: 8, spook: 20, notice: 92, strip: 0.65, speed: 24, vis: 0.66 },
  snook: { name: 'Snook', short: 'Snook', min: 4, max: 22, mult: 36, release: true, pow: 0.7, stam: 8, jump: 0.25, rock: 0.6, spook: 22, notice: 92, strip: 0.4, speed: 20, vis: 0.56 },
  trout: { name: 'Spotted Seatrout', short: 'Seatrout', min: 1, max: 6, mult: 55, release: true, pow: 0.35, stam: 5, spook: 16, notice: 82, strip: 0.5, speed: 22, vis: 0.46 },
  jack: { name: 'Jack Crevalle', short: 'Jack', min: 3, max: 35, mult: 20, release: true, pow: 0.85, stam: 12, spook: 26, notice: 110, strip: 0.35, speed: 40, vis: 0.6 },
  ladyfish: { name: 'Ladyfish', short: 'Ladyfish', min: 0.5, max: 4, mult: 60, release: true, pow: 0.4, stam: 5, jump: 0.8, spook: 18, notice: 96, strip: 0.3, speed: 34, vis: 0.56 },
  blackdrum: { name: 'Black Drum', short: 'Black Drum', min: 5, max: 60, mult: 14, release: true, pow: 0.75, stam: 11, spook: 22, notice: 80, strip: 0.9, speed: 16, vis: 0.6 },
  lobster: { name: 'Spiny Lobster', short: 'Lobster', min: 0.6, max: 7, mult: 150 }
};
const SPECIES_ORDER = ['lobster',
  'whitegrunt', 'lane', 'yellowtail', 'mangrove', 'mutton', 'hogfish', 'trigger', 'redgrouper', 'blackgrouper', 'cubera', 'amberjack', 'cobia', 'pompano', 'goliath',
  'bonita', 'mahi', 'tripletail', 'blackfin', 'yellowfin', 'wahoo', 'kingfish', 'sailfish', 'bluemarlin', 'barracuda',
  'bonefish', 'permit', 'tarpon', 'redfish', 'snook', 'trout', 'jack', 'ladyfish', 'blackdrum'];

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

/* Fishing spots. mode picks the game, variant dresses it up. at = [x along the Keys, offset from the island chain]
   in world units (positive is the ocean side, negative is Florida Bay). Uncharted spots have to be found on the water. */
const SPOTS = {
  bughunt: { id: 'bughunt', name: 'Hen & Chickens', kind: 'Lobster', mode: 'bughunt', variant: 'patch', depth: '12–20 ft', at: [6960, 1310], r: 300, charted: true, place: 'Plantation Key, Florida',
    species: ['lobster'],
    blurb: 'A patch reef in Hawk Channel off Plantation Key. Free-dive the ledges for spiny lobster: tickle them out, swing the net, gauge every bug.',
    tip: 'Hold on the antennae to tickle, let go when they twitch. When it walks out, click or tap the bug to swing the net.' },
  alligator: { id: 'alligator', name: 'Alligator Reef', kind: 'Lobster', mode: 'bughunt', variant: 'reef', depth: '15–35 ft', at: [4640, 2380], r: 320, charted: false, place: 'Alligator Reef Light',
    species: ['lobster'],
    rumor: 'The reef under Alligator Light is crawling with big lobster. Off Islamorada, out on the reef line.',
    blurb: 'Spur-and-groove reef under the old lighthouse. Deeper dives, bigger bugs, more morays. And the sharks know it.',
    tip: 'Deeper water: watch your air. Put the net behind a bug and it tail-flips right into it.' },
  bottom: { id: 'bottom', name: 'The Ledge', kind: 'Bottom Fishing', mode: 'bottom', variant: 'ledge', depth: '95 ft', at: [8400, 2900], r: 320, charted: true, place: 'Off Tavernier',
    species: ['whitegrunt', 'lane', 'yellowtail', 'mangrove', 'mutton', 'hogfish', 'trigger', 'redgrouper', 'blackgrouper', 'amberjack', 'goliath'],
    blurb: 'The reef edge drops off into 95 feet. Watch the fish finder, drop baits to the marks, wait out the nibbles, set the hook on the real bite.',
    tip: 'Find the marks on the sonar, then drop to that depth. Squid for snapper, pinfish for grouper.' },
  wreck: { id: 'wreck', name: 'Eagle Wreck', kind: 'Wreck Fishing', mode: 'bottom', variant: 'wreck', depth: '110 ft', at: [5360, 3280], r: 300, charted: false, place: 'Eagle Wreck, Islamorada',
    species: ['amberjack', 'cobia', 'pompano', 'cubera', 'mutton', 'blackgrouper', 'goliath', 'barracuda'],
    rumor: 'A sunken freighter sits in 110 feet off Islamorada. Amberjack stack up on it like cordwood.',
    blurb: 'A 287-foot freighter on its side in 110 feet. Amberjack, cobia, cubera and goliath live in the wreckage.',
    tip: 'Big fish, heavy pulls. Live pinfish. Tap fast to pull them out of the wreck before they cut you off.' },
  troll: { id: 'troll', name: 'The Weedline', kind: 'Trolling', mode: 'troll', variant: 'weed', depth: '600+ ft', at: [9440, 4640], r: 360, charted: true, place: 'Offshore, Florida Keys',
    species: ['mahi', 'tripletail', 'bonita', 'blackfin', 'wahoo', 'kingfish', 'sailfish', 'bluemarlin', 'barracuda'],
    blurb: 'Offshore on the Gulf Stream edge. Drag your spread past the sargassum, the birds and the floating debris for mahi, tuna, wahoo and sailfish.',
    tip: 'Frigate birds mean mahi, diving terns mean tuna. Steer so the lures cross the fish. Stay off the trap floats.' },
  hump: { id: 'hump', name: 'The Hump', kind: 'Deep Trolling', mode: 'troll', variant: 'hump', depth: '450 ft', at: [6560, 6240], r: 380, charted: false, place: 'The Islamorada Hump',
    species: ['blackfin', 'yellowfin', 'amberjack', 'wahoo', 'mahi', 'sailfish', 'bluemarlin'],
    rumor: 'Way offshore a hump rises off the bottom, and the current boils over it. Tuna feed there.',
    blurb: 'An underwater mountain far offshore. The current rips over it, bait balls up, and tuna crash it from below.',
    tip: 'Find the bait balls and the diving birds. Tuna come up fast and go back down fast.' },
  flats: { id: 'flats', name: 'Florida Bay', kind: 'Backcountry', mode: 'flats', variant: 'bay', depth: '1–4 ft', at: [7680, -1310], r: 320, charted: true, place: 'Florida Bay',
    species: ['bonefish', 'permit', 'tarpon', 'redfish', 'snook', 'trout'],
    blurb: 'Pole the backcountry flats and sight-cast to bonefish, permit, tarpon, redfish and snook. Lead the fish, strip it home, and don’t spook it.',
    tip: 'Look for tails, wakes and shadows. Cast a few feet in front of the fish, strip in rhythm and set it when it eats.' },
  bridge: { id: 'bridge', name: 'Channel Five', kind: 'Bridge Fishing', mode: 'flats', variant: 'bridge', depth: '8–18 ft', at: [2200, 260], r: 300, charted: false, place: 'Channel Five Bridge',
    species: ['tarpon', 'jack', 'ladyfish', 'snook', 'mangrove', 'permit'],
    rumor: 'Tarpon roll under the Channel Five bridge. Run west down the Keys past Islamorada.',
    blurb: 'Big tide running under the bridge. Tarpon roll in the current, jacks blitz bait, snook and snapper hide on the pilings.',
    tip: 'The current carries your fly. Watch for rolling tarpon and lead them by a lot.' },
  flamingo: { id: 'flamingo', name: 'Flamingo', kind: 'Everglades', mode: 'flats', variant: 'glades', depth: '1–5 ft', at: [4320, -4700], r: 340, charted: false, place: 'Flamingo, Everglades',
    species: ['snook', 'redfish', 'blackdrum', 'tarpon', 'trout', 'jack'],
    rumor: 'All the way across Florida Bay, the Everglades shoreline at Flamingo is full of snook and redfish. Follow the channels.',
    blurb: 'The edge of the Everglades. Mangrove shorelines, tannin water, snook under the roots and reds tailing on the mud.',
    tip: 'Snook hug the mangroves. Drum and reds tail on the mud. Cast tight to the roots.' }
};
const SPOT_ORDER = ['bughunt', 'alligator', 'bottom', 'wreck', 'troll', 'hump', 'flats', 'bridge', 'flamingo'];
const spotMode = (id) => (SPOTS[id] ? SPOTS[id].mode : id);
// Spots this device has found on the water (the starting four are always on the chart)
const Charts = {
  known() { const k = Store.arr('charted'); return new Set(SPOT_ORDER.filter((id) => SPOTS[id].charted || k.includes(id))); },
  isKnown(id) { return this.known().has(id); },
  add(id) { const k = Store.arr('charted'); if (!k.includes(id)) { k.push(id); Store.set('charted', k); } }
};

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
      sessionLen: o.sessionLen, weather: o.weather || rollWeather(), date: new Date().toISOString(),
      done: [], spot: null, turn: 0, scores, catches: [], turns: [], legs: 0, boat: null, found: [],
      bounties: o.bounties || Bounties.roll()   // the day's three goals (the briefing screen rolls them first so it can show them)
    };
    this.save();
  },
  save() { if (this.cur && this.cur.mode === 'crew') Store.set('trip', this.cur); },
  // a saved trip comes back only if this version can play it: every angler and spot still exists. Missing pieces
  // (from older versions) get their defaults; anything unplayable is dropped rather than left to break the title screen.
  load() {
    const t = Store.get('trip', null);
    const ok = t && typeof t === 'object' && Array.isArray(t.crew) && t.crew.length > 0 && t.crew.length <= 3 && t.crew.every((c) => CHARS[c])
      && (t.spot == null || SPOTS[t.spot]);
    if (!ok) { if (t != null) this.clear(); return null; }
    const list = (v) => (Array.isArray(v) ? v : []);
    t.mode = t.mode === 'solo' ? 'solo' : 'crew';
    t.plan = ['full', 'half', 'open', 'solo'].includes(t.plan) ? t.plan : t.mode === 'solo' ? 'solo' : 'full';
    if (typeof t.spotsNeeded !== 'number') t.spotsNeeded = t.plan === 'full' ? 4 : t.plan === 'half' ? 2 : 0;
    if (!(t.sessionLen > 0)) t.sessionLen = 120;
    if (!t.weather || typeof t.weather !== 'object' || !t.weather.id) t.weather = rollWeather();
    t.done = list(t.done).filter((id) => SPOTS[id]); t.found = list(t.found).filter((id) => SPOTS[id]);
    t.catches = list(t.catches).filter((k) => k && typeof k === 'object'); t.turns = list(t.turns).filter((x) => x && typeof x === 'object');
    if (!t.scores || typeof t.scores !== 'object') t.scores = {};
    for (const c of t.crew) if (typeof t.scores[c] !== 'number') t.scores[c] = 0;
    t.turn = clamp(t.turn | 0, 0, t.crew.length - 1); t.first = clamp(t.first | 0, 0, t.crew.length - 1); t.legs = Math.max(0, t.legs | 0);
    if (t.boat && !(Number.isFinite(t.boat.x) && Number.isFinite(t.boat.y) && Number.isFinite(t.boat.h))) t.boat = null;
    if (t.bounties != null) t.bounties = list(t.bounties).filter((b) => b && BOUNTY_DEFS[b.id]);
    if (t.steered != null && (typeof t.steered !== 'object' || Array.isArray(t.steered))) t.steered = {};
    if (t.leg && !(typeof t.leg === 'object' && CHARS[t.leg.ch] && typeof t.leg.pts === 'number')) t.leg = null;
    if (t.legBack && !(typeof t.legBack === 'object' && Array.isArray(t.legBack.lines) && t.legBack.flags)) t.legBack = null;
    return t;
  },
  resume() { this.cur = this.load(); return !!this.cur; },
  clear() { Store.del('trip'); },
  get player() { return this.angler(this.cur, this.cur.turn); },
  // who fishes turn i at this spot: the captain who brought the boat here goes first, then the rest in crew order,
  // so the first shot at the day's bounties moves around the crew instead of always going to the same angler
  angler(c, i) { const n = c.crew.length; return c.crew[(((c.first | 0) + i) % n + n) % n]; },
  record(ch, spot, res) {
    const c = this.cur;
    Records.add(res.catches);          // first: marks personal bests (k.pb) and first-ever catches (k.isNew)
    Bounties.apply(ch, spot, res);     // then any bounty this turn finishes adds its line and bonus to the turn
    c.scores[ch] = (c.scores[ch] || 0) + res.total;
    for (const k of res.catches) c.catches.push(k);
    c.turns.push({ ch, spot, total: res.total, n: res.catches.length });
    this.save();
  },
  leader() {
    const c = this.cur; let best = null;
    for (const ch of c.crew) if (!best || c.scores[ch] > c.scores[best]) best = ch;
    return best;
  }
};

const Records = {
  all() { const rec = Store.obj('records'); for (const k in rec) if (!rec[k] || typeof rec[k].w !== 'number') delete rec[k]; return rec; },
  add(catches) {
    const rec = this.all(); let changed = false;
    for (const k of catches) {
      if (!k || !k.weight || k.fine) continue;
      const r = rec[k.key];
      if (!r) k.isNew = true;   // never logged before: a new species for the logbook
      if (!r || k.weight > r.w) { rec[k.key] = { w: k.weight, ch: k.ch, date: new Date().toISOString() }; changed = true; k.pb = true; }
    }
    if (changed) Store.set('records', rec);
  },
  isRecord(key, w) { const r = this.all()[key]; return !r || w > r.w; },
  trips() { return Store.arr('trips').filter((t) => t && typeof t === 'object' && Array.isArray(t.crew)); },
  addTrip(t) { const list = this.trips(); list.unshift(t); Store.set('trips', list.slice(0, 12)); }
};

/* ---------- daily bounties ----------
   Three goals rolled when a trip starts. Whoever finishes one first takes the bonus (a crew trip races for them).
   group spreads the three across the Keys: bugs (bug hunts), reef (ledge + wreck), offshore (trolling),
   flats (backcountry + bridges) and any (anywhere). test(turn, day, res): turn is this turn's catches,
   day is everything this angler has landed today including this turn. */
const bountyBowed = (k) => !!(k.lines && k.lines.some((l) => /^Bowed/.test(l.label)));
const bountyLanded = (keys, min = 0) => (turn) => turn.some((k) => keys.includes(k.key) && k.weight >= min);
const BOUNTY_DEFS = {
  bugs3: { group: 'bugs', text: 'Bag 3 legal lobsters in one dive', short: '3 legal bugs', bonus: 200, icon: 'lobster', sp: ['lobster'], test: (turn) => turn.filter((k) => k.key === 'lobster').length >= 3 },
  bigbug: { group: 'bugs', text: 'Gauge a lobster 4 inches or bigger', short: 'A 4-inch bug', bonus: 250, icon: 'lobster', sp: ['lobster'], test: (turn) => turn.some((k) => k.key === 'lobster' && k.cl >= 4) },
  grouper: { group: 'reef', text: 'Land a grouper', short: 'A grouper', bonus: 150, icon: 'redgrouper', sp: ['redgrouper', 'blackgrouper', 'goliath'], test: bountyLanded(['redgrouper', 'blackgrouper', 'goliath']) },
  hogfish: { group: 'reef', text: 'Land a hogfish', short: 'A hogfish', bonus: 150, icon: 'hogfish', sp: ['hogfish'], test: bountyLanded(['hogfish']) },
  snapper3: { group: 'reef', text: 'One angler lands 3 kinds of snapper', short: '3 kinds of snapper', bonus: 250, icon: 'mutton', sp: ['lane', 'yellowtail', 'mangrove', 'mutton', 'cubera'], test: (turn, day) => new Set(day.filter((k) => ['lane', 'yellowtail', 'mangrove', 'mutton', 'cubera'].includes(k.key)).map((k) => k.key)).size >= 3 },
  aj30: { group: 'reef', text: 'Land an amberjack over 30 lb', short: 'Amberjack over 30 lb', bonus: 250, icon: 'amberjack', sp: ['amberjack'], test: bountyLanded(['amberjack'], 30) },
  cobia: { group: 'reef', text: 'Land a cobia', short: 'A cobia', bonus: 250, icon: 'cobia', sp: ['cobia'], w: 0.6, test: bountyLanded(['cobia']) },
  mahi20: { group: 'offshore', text: 'Land a mahi over 20 lb', short: 'Mahi over 20 lb', bonus: 250, icon: 'mahi', sp: ['mahi'], test: bountyLanded(['mahi'], 20) },
  tuna: { group: 'offshore', text: 'Land a tuna', short: 'A tuna', bonus: 200, icon: 'blackfin', sp: ['blackfin', 'yellowfin'], test: bountyLanded(['blackfin', 'yellowfin']) },
  wahoo: { group: 'offshore', text: 'Land a wahoo', short: 'A wahoo', bonus: 250, icon: 'wahoo', sp: ['wahoo'], test: bountyLanded(['wahoo']) },
  billfish: { group: 'offshore', text: 'Release a sailfish or a marlin', short: 'A billfish', bonus: 400, icon: 'sailfish', sp: ['sailfish', 'bluemarlin'], w: 0.5, test: bountyLanded(['sailfish', 'bluemarlin']) },
  bonefish: { group: 'flats', text: 'Land a bonefish', short: 'A bonefish', bonus: 200, icon: 'bonefish', sp: ['bonefish'], test: bountyLanded(['bonefish']) },
  tarpon: { group: 'flats', text: 'Land a tarpon', short: 'A tarpon', bonus: 250, icon: 'tarpon', sp: ['tarpon'], test: bountyLanded(['tarpon']) },
  snook: { group: 'flats', text: 'Land a snook', short: 'A snook', bonus: 150, icon: 'snook', sp: ['snook'], test: bountyLanded(['snook']) },
  redfish: { group: 'flats', text: 'Land a redfish', short: 'A redfish', bonus: 150, icon: 'redfish', sp: ['redfish'], test: bountyLanded(['redfish']) },
  permit: { group: 'flats', text: 'Land a permit', short: 'A permit', bonus: 350, icon: 'permit', sp: ['permit'], w: 0.6, test: bountyLanded(['permit']) },
  slam: { group: 'flats', text: 'Grand Slam: one angler lands a tarpon, a bonefish and a permit', short: 'Grand Slam', bonus: 400, icon: 'permit', sp: ['tarpon', 'bonefish', 'permit'], w: 0.4, test: (turn, day) => ['tarpon', 'bonefish', 'permit'].every((s) => day.some((k) => k.key === s)) },
  bow: { group: 'any', text: 'Bow to a jumping fish and land it', short: 'Bow to a jumper', bonus: 150, icon: 'jump', test: (turn) => turn.some(bountyBowed) },
  trophy: { group: 'any', text: 'Land a trophy-size fish', short: 'A trophy fish', bonus: 200, icon: 'trophy', test: (turn) => turn.some((k) => k.trophy && k.key !== 'lobster') },
  newsp: { group: 'any', text: 'Catch a species you’ve never logged', short: 'A new species', bonus: 200, icon: 'new', need: (known, rec) => SPECIES_ORDER.some((k) => !rec[k]), test: (turn) => turn.some((k) => k.isNew) },
  newspot: { group: 'any', text: 'Find a new spot', short: 'Find a new spot', bonus: 200, icon: 'chart', sea: true, need: (known) => known.size < SPOT_ORDER.length },
  five: { group: 'any', text: 'Land 5 fish in one turn', short: '5 fish in a turn', bonus: 150, icon: 'five', test: (turn) => turn.filter((k) => k.key !== 'lobster').length >= 5 },
  big50: { group: 'any', text: 'Land a fish over 50 lb', short: 'A 50-pounder', bonus: 250, icon: 'big', test: (turn) => turn.some((k) => k.key !== 'lobster' && k.weight >= 50) }
};
const BOUNTY_GROUPS = ['bugs', 'reef', 'offshore', 'flats'];

const Bounties = {
  DEFS: BOUNTY_DEFS,
  // where a bounty can be done: the spots whose water holds its species ([] means anywhere)
  spotsFor(id) { const d = BOUNTY_DEFS[id]; return d && d.sp ? SPOT_ORDER.filter((s) => SPOTS[s].species.some((k) => d.sp.includes(k))) : []; },
  make(id) { const d = BOUNTY_DEFS[id]; return { id, text: d.text, short: d.short, bonus: d.bonus, icon: d.icon, group: d.group, where: this.spotsFor(id), done: false, by: null, spot: null }; },
  // three for the day, from different parts of the Keys: usually two places plus one you can do anywhere
  roll(n = 3) {
    const known = Charts.known(), rec = Records.all();
    const ok = (id) => { const d = BOUNTY_DEFS[id]; return !d.need || d.need(known, rec); };
    const groups = BOUNTY_GROUPS.slice().sort(() => Math.random() - 0.5).slice(0, chance(0.7) ? n - 1 : n);
    if (groups.length < n) groups.push('any');
    return groups.map((g) => {
      const ids = Object.keys(BOUNTY_DEFS).filter((id) => BOUNTY_DEFS[id].group === g && ok(id));
      // weighted; a goal that only lives at spots nobody has found yet comes up less
      const wt = (id) => (BOUNTY_DEFS[id].w || 1) * (this.spotsFor(id).length && !this.spotsFor(id).some((s) => known.has(s)) ? 0.4 : 1);
      let r = Math.random() * ids.reduce((a, id) => a + wt(id), 0);
      for (const id of ids) { r -= wt(id); if (r <= 0) return this.make(id); }
      return this.make(ids[ids.length - 1]);
    });
  },
  list(c = Trip.cur) { return (c && c.bounties) || []; },
  open(c = Trip.cur) { return this.list(c).filter((b) => !b.done); },
  // can this bounty still be finished at this spot?
  here(b, spot) { if (b.done) return false; const d = BOUNTY_DEFS[b.id]; if (d && d.sea) return false; return !b.where || !b.where.length || b.where.includes(spot); },
  // a finished turn: returns the bounties it completes and marks them done for ch. Touches no scores.
  check(ch, spot, res, c = Trip.cur) {
    if (!c || !c.bounties || !res) return [];
    const turn = (res.catches || []).filter(Boolean);
    const day = (c.catches || []).filter((k) => k && k.ch === ch).concat(turn);
    const got = [];
    for (const b of c.bounties) {
      const d = BOUNTY_DEFS[b.id]; if (b.done || !d || !d.test) continue;
      let ok = false; try { ok = !!d.test(turn, day, res); } catch (e) { ok = false; }
      if (ok) { b.done = true; b.by = ch; b.spot = spot; got.push(b); }
    }
    return got;
  },
  // check a turn and pay it: a celebration line and the bonus go onto the turn (Trip.record calls this)
  apply(ch, spot, res) {
    const got = this.check(ch, spot, res);
    if (!got.length) return got;
    if (!res.lines) res.lines = [];
    for (const b of got) { res.lines.push({ label: 'Bounty · ' + b.text, pts: b.bonus, bounty: b.id }); res.total = (res.total || 0) + b.bonus; }
    res.bounties = got;
    return got;
  },
  // the boat scene calls this when a spot gets discovered: pays "Find a new spot" straight to that captain's score.
  // Returns the bounties it completed (empty when there was nothing to pay) so the scene can celebrate.
  found(spotId, ch) {
    const c = Trip.cur; if (!c || !c.bounties) return [];
    if (!ch) ch = c.mode === 'crew' ? c.crew[(c.legs || 0) % c.crew.length] : c.crew[0];
    const got = [];
    for (const b of c.bounties) {
      if (b.done || b.id !== 'newspot') continue;
      b.done = true; b.by = ch; b.spot = spotId; got.push(b);
      c.scores[ch] = (c.scores[ch] || 0) + b.bonus; c.turns.push({ ch, spot: 'bounty:' + b.id, total: b.bonus, n: 0 });
    }
    if (got.length) Trip.save();
    return got;
  },
  // safety net for found(): a spot this trip discovered (Trip.cur.found) pays the captain of the leg that just ended
  sync() {
    const c = Trip.cur; if (!c || !c.found || !c.found.length || !this.open(c).some((b) => b.id === 'newspot')) return [];
    const ch = c.mode === 'crew' ? c.crew[Math.max(0, (c.legs || 0) - 1) % c.crew.length] : c.crew[0];
    return this.found(c.found[c.found.length - 1], ch);
  }
};
