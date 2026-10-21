# Keys Crew

A lobstering and fishing game set in the Florida Keys, made for one phone passed around a boat.
Three friends, four spots, one day on the water. Whoever brings in the most points is Captain of the Day.

It's plain HTML and JavaScript drawn on a canvas. There's no install, no build step needed to play,
and no art files: every fish, lobster, boat and face is drawn in code.

## Play it

- **Easiest:** open `dist/keys-crew.html` in any browser (phone or laptop). It's one self-contained file. Offline, it still plays; the headline fonts just fall back to system fonts.
- **From the repo:** open `index.html`, or turn on GitHub Pages (Settings → Pages → deploy from `main`, root) and play at the Pages URL.
- Phones play best **sideways**.

## The crew

| Angler | Title | Perks |
|---|---|---|
| Michael | The Bug Hunter | 35% more breath on dives · wider hook-set and net timing |
| Jorge | Lucky Shades | fish bite 30% sooner · better odds at a trophy |
| Jemel | Big Game | reels 25% faster · line takes 12% more pull before it snaps |

Change names, colors, perks or looks in `js/data.js` (`CHARS`).

## The spots

**Patch Reefs: Bug Hunt.** Free-dive for spiny lobster. Look for antennae poking out of holes in the ledges.
Hold TICKLE to coax a bug out, and let go when its antennae twitch or it backs in. Tap NET when the ring
shrinks onto the gold circle; miss and it tail-flips away. Then gauge it: keep it only if the back of the shell
sits past the end of the 3" gauge and there are no eggs under the tail. Six per person. The FWC checks your bag
at the ramp, and shorts or egg-bearing females cost you. Watch your air, the jellyfish and the moray holes.

**The Ledge: Bottom Fishing.** Anchored in 95 feet. Squid for snapper, live pinfish for grouper and amberjack.
Drag to set your depth, sit through the nibbles, and tap when the rod slams down. Grouper dive for the rocks,
so tap fast to pull them off the bottom. Chum brings yellowtail up into the slick.

**The Weedline: Trolling.** Steer the boat and drag your three-lure spread past fish. Weedlines and floating logs
hold mahi, birds mark tuna, and the blue-water edge brings wahoo, kingfish, sailfish and the odd blue marlin.
Trap floats wrap your prop and foul your lures.

**Florida Bay: Backcountry.** Sight-fishing from a poling skiff. Whoever isn't fishing is on the pole, calling fish
by the clock. Press and hold where you want the fly (the circle tightens), let go to cast, and lead the fish.
Too close or behind it and it spooks. Strip in the fish's rhythm and set the hook when it eats.
Tarpon, bonefish and permit in one turn is a Grand Slam.

**The fight** (all fishing spots). Hold to reel and keep the drag needle in the green. Let go when the fish runs
or jumps. Too much slack and it spits the hook. Fight too long and a shark might tax you.

## Scoring

Points are pounds × a per-species value, plus bonuses: trophies, clean releases, bowing to a jump,
beating the shark, big-bug and limit bonuses, clean FWC checks, and slams. Every catch gets a brag post.
Personal bests and past trips are saved on the device in the Logbook.

The fishing rules in here (lobster gauge, egg-bearing females, release-only species) are simplified for a game.
Check current FWC regulations before you actually go.

## Project layout

```
index.html        page shell; loads the scripts in order
js/core.js        canvas, loop, input, buttons, synthesized sound, storage
js/data.js        the crew, species, spots, captions, trip state, logbook
js/art.js         all drawing: fish, lobsters, people, boats, scenery, brag cards
js/fight.js       the fish fight shared by every fishing spot
js/session.js     timed turn, pause, top bar, results packaging
js/bughunt.js     Patch Reefs
js/bottom.js      The Ledge
js/troll.js       The Weedline
js/flats.js       Florida Bay
js/screens.js     title, crew pick, chart, hand-offs, results, end of day, logbook, how-to
js/main.js        boot
tools/build.mjs   bundles everything into dist/keys-crew.html
test/             Playwright playtests, fight-balance and session simulations
```

## Developing

```
npm install            # only needed for the tests (Playwright)
npm run check          # syntax-check every script
npm run build          # rebuild dist/keys-crew.html after changing js/
npm run test:flow      # plays a whole crew trip by tapping the real buttons, phone-sized
npm run test:balance   # simulates hundreds of fights per species with players of different skill
```
