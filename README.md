# Keys Crew

A lobstering and fishing game set in the Florida Keys, made for one phone passed around a boat.
Three friends, one boat, the whole Upper Keys to run around in. Whoever brings in the most points is Captain of the Day.

It's plain HTML and JavaScript drawn on a canvas. There's no install, no build step needed to play,
and no art or audio files: every fish, lobster, boat, island and face is drawn in code, and the steel-drum
soundtrack is played live by a small synthesizer inside the game (Music on/off is in the pause menu).

## Play it

**https://msaco13.github.io/keys-lobster-game/** (rebuilt and published automatically on every push to `main`)

- **Easiest:** open `dist/keys-crew.html` in any browser (phone or laptop). It's one self-contained file. Offline, it still plays; the headline fonts just fall back to system fonts.
- **From the repo:** open `index.html`. The Pages site is deployed by `.github/workflows/pages.yml` (Settings → Pages → Source: GitHub Actions).
- Phones play best **sideways**.

## The crew

| Angler | Title | Perks |
|---|---|---|
| Michael | The Bug Hunter | 35% more breath on dives · wider hook-set and net timing |
| Jorge | Lucky Shades | fish bite 30% sooner · better odds at a trophy |
| Jemel | Big Game | reels 25% faster · line takes 12% more pull before it snaps |

Change names, colors, perks or looks in `js/data.js` (`CHARS`).

## Out on the water

The trip starts at the dock behind the house in Tavernier. The boat is yours to drive, top-down, anywhere
from Long Key to Key Largo: Florida Bay and the Everglades shoreline up top, Hawk Channel, the patch reefs,
the reef line, and the Gulf Stream out past the drop-off. The far spots are 15 to 20 nautical miles out.

- **Steer** by holding and dragging where you want to go (or ← →). **Throttle** is the lever: STOP, IDLE, SLOW, CRUISE, FULL (or ↑ ↓).
- **The chart** (Chart button or M) shows every spot you know about. Pick one and **Set course**: the autopilot drives the
  channels for you, and you can grab the wheel any time. **Skip the ride** if you just want to fish.
- **Read the water.** The depth sounder is top-center. Light water is shallow: run it fast and you go aground.
  Florida Bay is a maze of mud banks; follow the marked channels.
- **No-wake zones** (the harbor, under the bridges, Flamingo) mean SLOW, or FWC pulls you over.
- Dodge trap floats and channel markers, thread the bridge spans, catch air off other boats' wakes,
  let dolphins ride the bow, and slow down for manatees. It all adds up to captain's points.
- **Only four spots are on the chart.** The other five you have to find. The chart shows a ? and a rumor
  from the dock; run past it to discover the spot and put it on the chart for good.
- When the day's spots are done, run home at sunset and tie up at the dock.

## The spots

| Spot | Game | Where |
|---|---|---|
| Hen & Chickens | Bug Hunt | Patch reef in Hawk Channel off Plantation Key |
| Alligator Reef | Bug Hunt, deeper | Under the old lighthouse on the reef line (find it) |
| The Ledge | Bottom fishing | The reef edge in 95 feet |
| Eagle Wreck | Wreck fishing | A sunken freighter in 110 feet off Islamorada (find it) |
| The Weedline | Trolling | Offshore on the Gulf Stream edge |
| The Hump | Deep trolling | An underwater mountain way offshore (find it) |
| Florida Bay | Backcountry flats | Behind Tavernier |
| Channel Five | Bridge fishing | Under the Channel Five bridge, down the Keys (find it) |
| Flamingo | Everglades | All the way across Florida Bay (find it) |

**Bug Hunt.** Free-dive for spiny lobster. Look for antennae poking out of holes in the ledges; most holes are empty,
and some have morays. Hold on a hole (or TICKLE) to coax the bug out, and let go when its antennae twitch or it backs in.
When it walks out, **click or tap the bug to swing your net**. Lobsters tail-flip backward toward their hole, so watch for
the crouch, and the pro move is to set the net down behind it and let it flip in. Then gauge it: keep it only if the back of the
shell sits past the end of the 3" gauge and there are no eggs under the tail. Six per person, and FWC checks your bag at the ramp.
Watch your air (Alligator Reef is deeper), the jellyfish and the moray holes. Rare golden bugs score triple.
And now and then a shark shows up, and you race it back to the boat while the crew heckles you.

**Bottom fishing** (The Ledge, Eagle Wreck). Watch the fish finder, drop the bait to the marks, sit through the nibbles,
and tap when the rod slams down. Squid for snapper, live pinfish for grouper, amberjack and cobia. Fish are scarce and
they hold on structure, so move the boat along the bottom until the sonar lights up.

**Trolling** (The Weedline, The Hump). Steer the boat and drag your three-lure spread past fish. The fish are out there,
but you have to read the signs: frigate birds and weedlines for mahi, diving birds and bait balls for tuna, a lone float
that might hide a tripletail. Trap floats wrap your prop and foul your lures.

**The backcountry** (Florida Bay, Channel Five, Flamingo). Sight-fishing from a poling skiff. Whoever isn't fishing is on
the pole, calling fish by the clock. Look for tails, wakes and rolling tarpon. Press and hold where you want the fly, let go to
cast, and lead the fish. Strip in its rhythm and set the hook when it eats. Tarpon, bonefish and permit is a Grand Slam.

**The fight** (all fishing spots). Hold to reel and keep the drag needle in the green. Let go when the fish runs
or jumps. Too much slack and it spits the hook. Fight too long and a shark might tax you.

34 species in all, from white grunts to blue marlin. The Logbook keeps your personal best for every one.

## Scoring

Points are pounds × a per-species value, plus bonuses: trophies, clean releases, bowing to a jump,
beating the shark, big-bug and limit bonuses, clean FWC checks, and slams. Every catch gets a brag post.
Personal bests and past trips are saved on the device in the Logbook.

The fishing rules in here (lobster gauge, egg-bearing females, release-only species) are simplified for a game.
Check current FWC regulations before you actually go.

## Project layout

```
index.html        page shell; loads the scripts in order
js/core.js        canvas, loop, input, buttons, synthesized sound and music, storage
js/data.js        the crew, species, spots, captions, trip state, logbook
js/art.js         all drawing: fish, lobsters, people, boats, scenery, brag cards
js/fight.js       the fish fight shared by every fishing spot
js/session.js     timed turn, pause, top bar, results packaging
js/bughunt.js     Bug Hunt (Hen & Chickens, Alligator Reef)
js/bottom.js      bottom fishing (The Ledge, Eagle Wreck)
js/troll.js       trolling (The Weedline, The Hump)
js/flats.js       the backcountry (Florida Bay, Channel Five, Flamingo)
js/world.js       the Upper Keys map: islands, depths, channels, reefs, bridges, route finding
js/sea.js         driving the boat around the map, the chart, discovering spots
js/screens.js     title, crew pick, hand-offs, results, end of day, logbook, how-to
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
npm run test:nav       # clicks every way back to the title screen and checks where each button goes
npm run test:sea       # screenshots around the map, and the autopilot to every spot
npm run test:balance   # simulates hundreds of fights per species with players of different skill
```
