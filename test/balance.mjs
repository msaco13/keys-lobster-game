import { chromium } from 'playwright';
const root = process.argv[2];
const browser = await chromium.launch(); const page = await browser.newPage();
const errs=[]; page.on('pageerror', e=>errs.push(e.message));
await page.goto('file://' + root + '/index.html'); await page.waitForTimeout(1500);
const res = await page.evaluate(() => {
  const species = [['yellowtail','reef'],['mangrove','reef'],['mutton','reef'],['redgrouper','reef'],['blackgrouper','reef'],['amberjack','reef'],['goliath','reef'],['mahi','offshore'],['blackfin','offshore'],['wahoo','offshore'],['kingfish','offshore'],['sailfish','offshore'],['bluemarlin','offshore'],['bonefish','flats'],['permit','flats'],['tarpon','flats'],['redfish','flats'],['snook','flats'],['trout','flats']];
  const out = {};
  for (const [sk, kind] of species) for (const bot of ['good','casual']) for (const ch of ['michael','jemel']) {
    let wins=0, time=0, reasons={}; const N=120;
    for (let i=0;i<N;i++) {
      const w = rollWeight(sk, CHARS[ch].perks);
      const fs = new FightScene({ sp: sk, weight: w, ch, ctxType: kind, depth: 90, rock: sk==='snook' ? 0.6 : undefined, onDone: ()=>{} });
      fs.taxRisk = false;
      let hold = true, tapAcc = 0, runSeen = -1, teleSeen = -1, t = 0; const dt = 1/60;
      fs.holding = () => hold;
      while (fs.phase !== 'over' && t < 150) {
        t += dt;
        if (fs.phase === 'turn') { hold = true; tapAcc += dt; const rate = bot==='good'? 7 : 5; if (tapAcc > 1/rate) { tapAcc = 0; fs.tap(); } }
        else {
          if (fs.tele && teleSeen < 0) teleSeen = t; if (!fs.tele && !fs.running) teleSeen = -1;
          if (fs.running && runSeen < 0) runSeen = t; if (!fs.running) runSeen = -1;
          const L = fs.perks.line;
          if (bot === 'good') hold = !((teleSeen >= 0 && t - teleSeen > 0.2) || (runSeen >= 0 && t - runSeen > 0.12) || fs.jumpT > 0 || fs.T > 0.8 * L);
          else hold = !((runSeen >= 0 && t - runSeen > 0.3) || (fs.jumpT > 0 && fs.jumpT < 0.85) || fs.T > 0.92 * L);
        }
        fs.update(dt);
        if (fs.phase === 'landing') { while (fs.phase === 'landing') fs.update(dt); }
      }
      if (fs.won) { wins++; time += t; } else reasons[fs.reason||'timeout'] = (reasons[fs.reason||'timeout']||0)+1;
    }
    out[`${sk}/${bot}/${ch}`] = { win: Math.round(wins/N*100), avgT: wins? Math.round(time/wins) : 0, reasons };
  }
  return out;
});
for (const [k,v] of Object.entries(res)) console.log(k.padEnd(28), String(v.win).padStart(3)+'%', String(v.avgT).padStart(3)+'s', JSON.stringify(v.reasons));
console.log(errs.length? errs.join('\n') : 'no errors');
await browser.close();
process.exitCode = errs.length ? 1 : 0;
