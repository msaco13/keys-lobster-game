// The trailer, shot by shot, in order. Each id is a shot in shots.js; the lengths live there too.
export const TIMELINE = [
  // act one: a nature documentary
  'keys', 'reef', 'them', 'three', 'fine', 'aground', 'title',
  // act two: the montage
  'bug', 'moray', 'run', 'fwc', 'chart', 'ledge', 'troll', 'marlin', 'flats', 'shark', 'tax', 'brag', 'sunset', 'board',
  // act three
  'end', 'rating', 'stinger'
];
// shots drawn in 3D cost about three times as much per frame (software WebGL), which is what the workers balance by
export const HEAVY = new Set(['keys', 'them', 'aground', 'run', 'fwc', 'chart', 'ledge', 'troll', 'marlin', 'flats', 'tax', 'sunset']);
// the music: which of the game's songs plays under which stretch (see assemble.mjs)
export const MUSIC = [
  { song: 'reef', from: 'keys', until: 'scratch', fadeIn: 2.5, gain: 0.8 },          // until the record scratch in 'aground'
  { song: 'run', from: 'title', until: 'sunset', fadeIn: 0, fadeOut: 1.2, gain: 1 },  // the montage, crossfading into
  { song: 'sunset', from: 'sunset', until: 'stinger', fadeIn: 1.2, fadeOut: 2.5, gain: 0.9 }
];
