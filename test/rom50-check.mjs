// Fiks 50 D (Rom v4 ac.klima / climCards / climSw): Klima-akkordeonet – 8 px mellom alle elementer, 8 px side-/bunnpadding,
// prikk-raden bare ved 2+ kort (12 px høy, prikker 10/aktiv 12, gap 6, 8 px over og under). Samme regel for Media-karusellen.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readdirSync, mkdirSync, unlinkSync } from 'node:fs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/rom50-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto('file://' + resolve('test/harness.html'));
for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
await p.addScriptTag({ path: bundle });
const out = await p.evaluate(async () => {
  const wait = (ms) => new Promise((q) => setTimeout(q, ms));
  const hass = window.mockHass();
  const add = (id, state, attributes) => { hass.states[id] = { entity_id: id, state, attributes: { friendly_name: id.split('.')[1], ...attributes }, last_changed: new Date().toISOString(), last_updated: new Date().toISOString(), context: {} }; };
  add('climate.stue_ekstra', 'heat', { friendly_name: 'Ekstra', current_temperature: 20, temperature: 21, hvac_action: 'idle' });
  const dash = document.getElementById('dash');
  const R2 = (n) => Math.round(n * 10) / 10;
  const mk = async (id, cfg) => {
    const r = document.createElement('msh-rom-card');
    r.setConfig({ type: 'custom:msh-rom-card', card_id: id, area: 'stue', ...cfg });
    r.hass = hass; dash.appendChild(r);
    await wait(300); r.setUI({ acc: { klima: true, media: true } }); await wait(500);
    return r;
  };
  const rect = (el) => el.getBoundingClientRect();
  const measure = (r, sec) => {
    const R = r.shadowRoot, S = R.querySelector(`[data-key="sec-${sec}"]`), cw = S.querySelector('.cw'), car = cw.querySelector('.car');
    const dots = cw.querySelector('.dots'), next = cw.nextElementSibling;
    const cb = rect(car).bottom;
    const o = { cards: car.children.length, dotsEl: !!dots, cwChildren: cw.children.length, padL: R2(rect(car).left - rect(S).left), padR: R2(rect(S).right - rect(car).right) };
    if (dots) {
      const d = rect(dots), ds = [...dots.querySelectorAll('.msh-dot')];
      o.carToDots = R2(d.top - cb); o.dotsH = R2(d.height);
      o.dotSizes = ds.map((x) => `${R2(rect(x).width)}x${R2(rect(x).height)}${x.classList.contains('on') ? '*' : ''}`);
      o.dotGap = ds.length > 1 ? R2(rect(ds[1]).left - rect(ds[0]).right) : null;
      o.dotCols = ds.map((x) => getComputedStyle(x).backgroundColor);
      o.dotsCenter = R2((d.left + d.right) / 2 - (rect(S).left + rect(S).right) / 2);
      o.dotsBottom = d.bottom;
    }
    const after = o.dotsEl ? o.dotsBottom : cb;
    // neste rad (vifte-raden i Klima) eller bunnen av seksjonen
    const nextRow = next && (next.querySelector('.lst > *') || next);
    o.toNext = nextRow ? R2(rect(nextRow).top - after) : null;
    o.toBottom = next ? null : R2(rect(S).bottom - after);
    return o;
  };
  const res = {};
  // Klima: ett kort + vifte
  let r = await mk('r50a', { exclude: [] }); res.k1 = measure(r, 'klima');
  res.m2 = measure(r, 'media');
  // Klima: to kort + vifte
  r = await mk('r50b', { include: { climate: ['climate.stue_ekstra'] } }); res.k2 = measure(r, 'klima');
  // Klima: ett kort, ingen vifte (bunnpadding)
  r = await mk('r50c', { exclude: ['fan.stue_vifte'] }); res.k1nofan = measure(r, 'klima');
  // Klima: to kort, ingen vifte
  r = await mk('r50d', { exclude: ['fan.stue_vifte'], include: { climate: ['climate.stue_ekstra'] } }); res.k2nofan = measure(r, 'klima');
  // Media: ett kort
  r = await mk('r50e', { exclude: ['media_player.stue_sonos'] }); res.m1 = measure(r, 'media');
  return res;
});
await b.close();
try { unlinkSync(bundle); } catch (e) {}
let fail = 0;
const ok = (c, m, extra) => { console.log(`${c ? 'OK  ' : 'FEIL'} ${m}${c ? '' : ' → ' + JSON.stringify(extra)}`); if (!c) fail++; };
const near = (a, v, t = 0.6) => a != null && Math.abs(a - v) <= t;
const { k1, k2, k1nofan, k2nofan, m1, m2 } = out;
ok(k1.cards === 1 && !k1.dotsEl && k1.cwChildren === 1, 'Klima, ett kort: ingen prikk-rad (ingen tom .dots)', k1);
ok(near(k1.toNext, 8), `Klima, ett kort: kort → vifte-rad 8 px (${k1.toNext})`, k1);
ok(near(k1.padL, 8) && near(k1.padR, 8), `Klima: 8 px sidepadding (${k1.padL}/${k1.padR})`, k1);
ok(near(k1nofan.toBottom, 8) && !k1nofan.dotsEl, `Klima, ett kort uten vifte: 8 px bunnpadding (${k1nofan.toBottom})`, k1nofan);
ok(k2.cards === 2 && k2.dotsEl, 'Klima, to kort: prikk-rad finnes', k2);
ok(near(k2.carToDots, 8) && near(k2.dotsH, 12) && near(k2.toNext, 8), `Klima, to kort: kort → 8 → prikker 12 → 8 → vifte (${k2.carToDots}/${k2.dotsH}/${k2.toNext})`, k2);
ok(near(k2nofan.carToDots, 8) && near(k2nofan.toBottom, 8), `Klima, to kort uten vifte: 8 / 12 / 8 bunn (${k2nofan.carToDots}/${k2nofan.dotsH}/${k2nofan.toBottom})`, k2nofan);
ok(k2.dotSizes.join() === '12x12*,10x10' && near(k2.dotGap, 6) && near(k2.dotsCenter, 0, 1), `Klima-prikker 12 (aktiv) / 10, gap 6, sentrert (${k2.dotSizes} gap ${k2.dotGap})`, k2);
ok(k2.dotCols[0] === 'rgb(127, 127, 127)' && k2.dotCols[1] === 'rgb(84, 84, 84)', `Klima-prikker aktiv #7f7f7f, inaktiv #545454 (${k2.dotCols})`, k2);
ok(m1.cards === 1 && !m1.dotsEl && m1.cwChildren === 1, 'Media, ett kort: ingen prikk-rad', m1);
ok(near(m1.toBottom, 8), `Media, ett kort: 8 px bunn (${m1.toBottom})`, m1);
ok(m2.cards === 2 && m2.dotsEl && near(m2.carToDots, 8) && near(m2.dotsH, 12) && near(m2.toBottom, 8) && near(m2.dotGap, 6), `Media, to kort: 8 / 12 / 8, gap 6 (${m2.carToDots}/${m2.dotsH}/${m2.toBottom}/${m2.dotGap})`, m2);
ok(!errs.length, 'ingen sidefeil', errs);
console.log(fail ? `\n${fail} FEIL` : '\nAlle OK');
process.exit(fail ? 1 : 0);
