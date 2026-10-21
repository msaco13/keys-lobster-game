'use strict';
/* Keys Crew — boot. Waits briefly for the fonts, restores a trip across live updates, starts the title. */
(function boot() {
  const hot = window.claude && window.claude.hot;
  const start = (data) => {
    if (data && data.trip && data.trip.crew) { Trip.cur = data.trip; Trip.save(); }
    Game.init(new TitleScene());
  };
  const go = () => {
    try { if (hot && hot.snapshot) hot.snapshot(() => ({ trip: Trip.cur && Trip.cur.mode === 'crew' ? Trip.cur : null })); } catch (e) { /* optional */ }
    if (hot && hot.ready) hot.ready(start); else start((hot && hot.data) || {});
  };
  let fonts = Promise.resolve();
  try {
    if (document.fonts && document.fonts.load) {
      fonts = Promise.race([
        Promise.all([dfnt(40), fnt(20, 500), fnt(20, 700), fnt(20, 800)].map((f) => document.fonts.load(f))),
        new Promise((r) => setTimeout(r, 1500))
      ]);
    }
  } catch (e) { /* fall back to system fonts */ }
  fonts.then(go, go);
})();
