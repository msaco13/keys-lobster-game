# Keys Crew

A lobstering and fishing game set in the Florida Keys, made for one phone passed around a boat.
Three friends, one boat, the whole Upper Keys to run around in, and the flats after dark with a light and a bully net.
Whoever brings in the most points is Captain of the Day.
The captain who drives to a spot fishes it first, then the rest of the crew, so the first shot at the day's bounties moves around.

It's plain HTML and JavaScript drawn on a canvas, and the boat ride and the fish fights are real 3D (three.js, bundled in).
There's no install, no build step needed to play, and no art or audio files: every fish, lobster, boat, island and
face is made in code, the 3D world included, and the steel-drum soundtrack is played live by a small synthesizer
inside the game (Music on/off is in the pause menu).

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

The trip starts at the dock behind the house in Tavernier. The boat is yours to drive anywhere
from Long Key to Key Largo: Florida Bay and the Everglades shoreline up top, Hawk Channel, the patch reefs,
the reef line, and the Gulf Stream out past the drop-off. The far spots are 15 to 20 nautical miles out.

- **A new captain gets the phone first.** On a crew trip each run opens on a card: hand the phone to the captain, who
  taps **Take the wheel**. (When the captain is the one who fished last, it skips the card: they're already holding it.)
- **The view** rides behind the boat in 3D. The water goes from gin-clear over the sand to cobalt in the Gulf Stream,
  the way it does in the Keys; the boat rides the chop, banks into turns and throws a wake; and the islands, mangroves,
  bridges, Alligator Light, other boats, dolphins and birds are all out there. **Top-down view** (under the minimap, or V)
  switches to the overhead map view, and it's remembered.
- **Steer** by holding left or right of the boat (or ← →); the farther out you hold, the harder it turns. In the top-down
  view, hold where you want to go. **Throttle** is the lever: STOP, IDLE, SLOW, CRUISE, FULL (or ↑ ↓).
- **The chart** (Chart button or M) shows every spot you know about. Across the top it asks what you want to catch:
  **Lobster**, **Reef & wreck**, **Offshore** or **Bayside** lights up those spots (and any ? that hides one) and picks
  the closest. Tap a spot and the chart draws the way there; anything on the other side of the islands says which creek
  to go through. Then **Set course**: the autopilot drives the channels for you, and you can grab the wheel any time
  (the Autopilot button, or O, turns it on and off; P pauses, like everywhere else).
  **Skip the ride** if you just want to fish: it goes straight to the hand-off, with no captain's points.
- **The bay side and the ocean side.** The islands only open at the creeks and channels under the Overseas Highway
  (Tavernier Creek is right by the dock; Snake Creek, Whale Harbor, Channel Two and Channel Five are farther down). The
  chart marks each one, and labels which side is which. Steering yourself with a course set, the top panel says
  "via Tavernier Creek", the arrow leads along the course to the creek instead of straight over the land, and the creek
  itself is lit up behind the boat.
- **Read the water.** The depth sounder is top-center. Light water is shallow: run it fast and you go aground.
  Florida Bay is a maze of mud banks; follow the marked channels.
- **No-wake zones** (the harbor, under the bridges, Flamingo) mean SLOW. The panel at the top turns white and says so;
  go too fast and a red banner warns you. FWC warns you once, then pulls you over.
- Dodge trap floats and channel markers, thread the bridge spans, catch air off other boats' wakes,
  let dolphins ride the bow, and slow down for manatees. It all adds up to captain's points.
- **Six spots are on the chart from the start.** The other six you have to find. The chart shows a ? and a rumor
  from the dock; run past it to discover the spot and put it on the chart for good.
- When the day's spots are done, run home at sunset and tie up at the dock. With the night run on (the switch on the
  setup screen, on by default) the crew heads back out after dark to bully net the flats; then the end of the day
  names the Captain of the Day (or the tie).
- Casting off a new crew trip while one is saved asks first, and says whose trip it is and how far along.

## Phones and graphics

The 3D (the boat ride and the fish fights) is built for phones. It needs WebGL 2, which any recent iPhone or Android
phone has.

- It draws at a lower resolution than the screen and watches its own frame rate. If a phone is struggling, it lowers
  the resolution and the number of trees a step at a time. A screen that's capped at 30 frames a second (a phone in
  low-power mode) isn't mistaken for a slow phone.
- If a phone still can't keep up, the game switches to the classic 2D view and says so, even in the middle of a fight.
  A phone without WebGL 2 gets the classic view straight away. The menus and the fishing spots themselves (casting,
  the Bug Hunt) are 2D either way.
- **Pause → Graphics** switches between 3D and classic by hand. **Pause → Frame rate** shows the frame rate and the
  current detail level at the bottom of the screen. Both are in the pause menu on the boat ride and at every spot.
- On 120 Hz screens it draws the 3D at 60 frames a second, which saves battery.
- The setting that worked is remembered on the device for next time.

On a phone the whole game is drawn smaller (about 0.7x held sideways), so two things make up for it:

- **Small print has a floor.** Text that would come out under about 11 CSS px is drawn bigger instead (`TEXT_FLOOR`
  in `js/core.js`). Headlines and big numbers aren't touched.
- **Small buttons take a near miss.** On a touch screen, a tap just outside a small button (pause, the throttle, the
  chart pins, the fish finder's ▸) still presses it, out to about 48 CSS px. A tap right on a button always wins; two
  near misses go to the closer one (`UI.hit`).

Held upright, the game shows a small turning phone above it: it plays that way too, just smaller.

## The spots

| Spot | Game | Where |
|---|---|---|
| Hen & Chickens | Lobster (the Bug Hunt) | Patch reef in Hawk Channel off Plantation Key |
| Bayside Rocks | Lobster, shallow | Rock piles in the turtle grass, through Snake Creek on the bay side |
| Pickles Reef | Lobster, deeper | The reef line straight out from Tavernier |
| Alligator Reef | Lobster, deeper | Under the old lighthouse on the reef line (find it) |
| Islamorada Patches | Lobster | Little patch reefs in Hawk Channel off Islamorada (find it) |
| The Ledge | Bottom fishing | The reef edge in 95 feet |
| Eagle Wreck | Wreck fishing | A sunken freighter in 110 feet off Islamorada (find it) |
| The Weedline | Trolling | Offshore on the Gulf Stream edge |
| The Hump | Deep trolling | An underwater mountain way offshore (find it) |
| Florida Bay | Backcountry flats | The bay side, through Tavernier Creek from the dock |
| Channel Five | Bridge fishing | Under the Channel Five bridge, down the Keys (find it) |
| Flamingo | Everglades | All the way across Florida Bay (find it) |
| Tavernier Flats | Bully netting, at night | The grass flats off Tavernier, after the run home (or Night Run on the title) |

**Lobster (the Bug Hunt).** Free-dive for spiny lobster at five spots: two patch reefs (Hen & Chickens, the Islamorada
Patches), the reef line (Pickles Reef, Alligator Reef: deeper, bigger bugs, more morays), and Bayside Rocks, a shallow
turtle-grass bay with low rock piles and sponges (easy on your air, lots of shorts). At a lobster spot the button says
**Dive for lobster**, and after the ride **Let's go lobstering**. Look for antennae poking out of holes in the ledges; most holes
are empty, and some have morays. Hold on a hole (or TICKLE) to coax the bug out. Just before it twitches, its antennae go
stiff and shake, and the hole and the button say **LET GO**: let go then, or it backs in. It says **WAIT** while it settles,
then **HOLD AGAIN**. Get close and a tag under the hole says what kind of bug
it is: a **calm bug** gives you plenty of warning and is easy to net, a **skittish bug** gives you less, and a **wary old bug**
(often the big ones, and every golden one) gives you a split second, scuttles fast once it's out, and runs after two misses.
When it walks out, **tap the bug** (or anywhere near it) to swing your net; if it's too far, you swim over and swing.
The ? button (or H) shows how to catch one at any time, and it opens by itself on each angler's first dive. Until an
angler nets a first bug, the dive coaches them: an arrow points at a hole with a bug in it (the one nearest the boat is
always a calm one), the four steps (Find, Tickle, Net, Gauge) show which one they're on, and a tip says what to do now.
Lobsters tail-flip backward toward their hole, so watch for
the crouch, and the pro move is to set the net down behind it and let it flip in. Then gauge it: keep it only if the back of the
shell sits past the end of the 3" gauge and there are no eggs under the tail. Six per person, and FWC checks your bag at the ramp.
Watch your air (Alligator Reef is deeper), the jellyfish and the moray holes. Rare golden bugs score triple.
And now and then a shark shows up, and you race it back to the boat while the crew heckles you.

**Bully netting** (Tavernier Flats, at night). After dark the spiny lobster walk out in the open on the grass flats,
and the crew idles along with a light on the bow while whoever's up works the bully net (a hoop on a long pole).
Drag on the water (or move the mouse, or the arrow keys) to sweep the light. Two orange eyes glowing at the edge of the
beam are a bug; tiny red sparks are shrimp, a close green pair is a crab, and a wide green pair is a nurse shark asleep
on the bottom. Put the light on a bug and it freezes, the light stays on it when you let go, and your buddy at the wheel
idles over and holds up when the net can reach (STOP, SLOW and IDLE set how fast the boat creeps along). The longer the boat
sits close with the light on it, the closer it is to bolting for the nearest rock or sponge, and wary old bugs go fast.
Lobsters shoot backward, so tap just behind the tail to drop the net (the pro move, +50): it backs right in. Right on
top of it works on a calm bug, sometimes on a skittish one, never on a wary one; in front of it never works. Then wait
for it to kick up into the bag and TWIST (tap anywhere, or the button): too soon or too late and it slips out under the
rim. Gauge it like a dive, six per person, FWC at the ramp. Netting a ray costs 3 seconds and a nurse shark 5. The moon
is tonight's real moon: on a dark night more bugs walk; under a bright one they're warier, but you can make out the
bottom. The ? button (or H) shows how, and opens by itself on each angler's first night; until they bag a first bug, the
night coaches them (an arrow to the eyes, where to tap, when to twist). Whoever's last on the board nets first. **Night
Run** on the title is a night on its own: one or two rounds, with tonight's bounties.

**Bottom fishing** (The Ledge, Eagle Wreck). The fish finder is your eyes: arches are fish (red means big),
blue speckle is bait. Fish are scarce and hold on structure (ledge pockets, coral heads, the freighter's bow and stern),
so tap Move to idle along the bottom until the finder lights up, then drop your bait to the marks. Squid for snapper and
hogfish, live pinfish for grouper, amberjack and cobia. Wait out the nibbles and tap when the rod slams down.
Chum brings yellowtail up into the slick. The ▸ button under the finder (or F) makes it smaller, then tucks it away to a
chip that still shows the depth, what's under the boat and the fish alarm, for more room to watch the water. The game
remembers the size you pick.

**Trolling** (The Weedline, The Hump). Steer the boat and drag your three-lure spread through the fish. Most weed is empty,
so read the signs: frigate birds and flying fish for mahi, diving terns and bait sprays for tuna, a lone log or float that
might hide a tripletail. At the Hump, troll the current rip and the bait balls where blackfin bust (and the odd big yellowfin).
Trap floats wrap your prop and foul your lures.

**The backcountry** (Florida Bay, Channel Five, Flamingo). Sight-fishing from a poling skiff. Whoever isn't fishing is on
the pole (◀ ▶), pushing you along the flat and calling fish by the clock. The fish are faint shadows; look for tails, wakes,
mud puffs and rolling tarpon. Press and hold where you want the fly, let go to cast, and lead the fish. Strip in its rhythm
and set the hook when it eats (IT ATE IT! TAP TO SET!): there's always time for one more strip at the fish's own pace, so
tapping in its rhythm sets it. The ? button (or H) shows how, and it opens by itself on each angler's first time on the
flats. Until an angler hooks a first fish there, the flats coach them: a ring and a name on the fish the poler calls, a
CAST HERE target in front of it (past where it spooks, inside where it notices, not where the line would land on it),
a ring on the fly that closes on the fish's strip rhythm and turns green for STRIP!, the four steps (Spot, Cast,
Strip, Set), and a longer window to set that first hook. At Channel Five the tide carries your fly past the pilings; at Flamingo, snook hug the
mangrove roots and reds and drum tail on the mud. Tarpon, bonefish and permit is a Grand Slam.

**The fight** (all fishing spots). Hold to reel and keep the drag needle in the green. The bar at the bottom lights up
while you're reeling and tells you what to do: on a strong run (one that would push the drag into the red) it says LET
IT GO; on a small run you can KEEP CRANKING. Before a jump it says IT'S COMING UP: let go and bow to the fish. Too much
slack and it spits the hook. Once the fish is beat it stops running, comes in fast (CRANK IT IN), and a shark can't take
it; a shark only shows up in a long fight, and you beat it by wearing the fish out. In 3D the camera sits right
at the waterline, half in and half out: the boat and the angler working the rod above, and below, the fish on the line
over the reef, the wreck, the grass flats or the Everglades mud, with the light rippling on the bottom.

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
js/bullynet.js    bully netting at night (Tavernier Flats): the light, the eyes in the dark, the net, the twist
js/world.js       the Upper Keys map: islands, depths, channels, reefs, bridges, route finding
js/chase.js       the behind-the-boat camera, and the classic 2D view for phones without 3D
js/gl3d.js        the shared 3D renderer: the frame-rate safeguards and Graphics setting, the boat and crew models
js/sea3d.js       the boat ride in 3D: water, sky, islands, boats, wildlife
js/fight3d.js     the fish fight in 3D, drawn from the same fight state as the 2D one
js/vendor/        three.min.js: the parts of three.js the game uses (built by tools/vendor-three.mjs)
js/sea.js         driving the boat around the map, the chart, discovering spots
js/screens.js     title, crew pick, hand-offs, nightfall, results, end of day, logbook, how-to
js/main.js        boot
tools/build.mjs   bundles everything into dist/keys-crew.html
tools/vendor-three.mjs + three-entry.js   rebuild js/vendor/three.min.js (npm run vendor)
test/             Playwright playtests, fight-balance and session simulations
```

## The trailer

`trailer/keys-crew-trailer.mp4` is a trailer cut entirely from the game: every shot is the game playing itself in
headless Chromium (`tools/trailer/shots.js` stages each one with the game's own scenes, art and fonts), and every sound
is the game's own synthesizer rendered offline (the songs, and each effect at the frame the game asked for it).

```
node tools/trailer/audio.mjs . /tmp/kc/audio                      # the songs and effects, as WAV (about 5 min)
for k in 0 1 2 3; do node tools/trailer/render.mjs . /tmp/kc/frames --worker $k/4 & done; wait   # the frames, 1080p30
node tools/trailer/assemble.mjs /tmp/kc/frames /tmp/kc/audio trailer/keys-crew-trailer.mp4
```

`--every 12 --size 960x540` on the renderer makes a quick preview of the staging; `tools/trailer/timeline.mjs` is the
running order and the music plan. The whole render takes about ten minutes on four cores.

## Developing

```
npm install            # only needed for the tests (Playwright)
npm run check          # syntax-check every script
npm run build          # rebuild dist/keys-crew.html after changing js/ (and commit dist/: the pull request check compares it)
npm run test:smoke     # the built game plays: a crew trip by tapping, every spot, broken saves, no storage (~1 min)
npm run test:flow      # plays a whole crew trip by tapping the real buttons, phone-sized
npm run test:nav       # clicks every way back to the title screen and checks where each button goes
npm run test:night     # bully netting: a Night Run by tapping, how the net works, the day into the night, mouse and keys
npm run test:fixes     # bugs that were fixed stay fixed (the flats, the buzzer, Move taps, the boat's keys, narrow cards)
npm run test:sea       # screenshots around the map, and the autopilot to every spot
npm run test:balance   # simulates hundreds of fights per species with players of different skill
npm run test:3d        # screenshots of the 3D boat ride around the map (WebGL forced on, software-rendered)
npm run test:gfx       # the 3D safeguards: slow phone, 30 fps screen, lost graphics, the Graphics switch, mid-fight
npm run test:flow3d    # the whole crew trip with 3D on
npm run test:fight3d   # screenshots of the 3D fight at every kind of spot: hooked, running, jumping, landed, lost
npm run vendor         # rebuild js/vendor/three.min.js after changing tools/three-entry.js
```

Every pull request runs `.github/workflows/check.yml`: the scripts parse, dist/ matches the source, the smoke test,
the night run, the fixed-bug checks, the autopilot to every spot, and the 3D safeguards. The deploy to GitHub Pages runs the smoke test on the built page
first and stops if it fails, so the live game stays as it was. Every test exits non-zero when something fails.

`node test/clip.mjs . out.mp4 3d autopilot 16` records a smooth video of the boat ride (needs ffmpeg).
`node test/fightclip.mjs . out.mp4 3d offshore,bridge 12` records fish fights played by a bot (the same fight in 3D
and classic, for a before/after).
Headless Chromium renders WebGL in software, so the 3D tests check the picture and the errors, not the speed;
check the speed on a real phone with Pause → Frame rate.
