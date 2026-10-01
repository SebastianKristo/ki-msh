// Rom-popup mot ekte Bubble Card: mellomrom (gap/pad_top/pad_bottom), klima-velgere, scener, chip.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readdirSync, existsSync } from 'node:fs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const BC = resolve('test/.vendor/bubble-card.js');
if (!existsSync(BC)) execFileSync('curl', ['-sSL', '-o', BC, 'https://raw.githubusercontent.com/Clooos/Bubble-Card/main/dist/bubble-card.js']);
const bundle = resolve(`test/.build/romcheck-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto('file://' + resolve('test/harness-bubble.html'));
for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
await p.addScriptTag({ path: bundle });
await p.addScriptTag({ path: BC, type: 'module' });
await p.waitForFunction(() => customElements.get('bubble-card'));
const out = await p.evaluate(async () => {
  const wait = (ms) => new Promise((q) => setTimeout(q, ms));
  const hass = window.mockHass();
  const res = {};
  try {
  const mk = (hash, cards) => { const bc = document.createElement('bubble-card'); bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash, name: 'Rom', bg_color: '#282828', bg_opacity: 100, bg_blur: 0, cards }); bc.hass = hass; document.getElementById('dash').appendChild(bc); return bc; };
  mk('#stue', [{ type: 'custom:msh-rom-card', card_id: 'r1' }]);
  mk('#bad', [{ type: 'custom:msh-rom-card', card_id: 'r2' }]);
  await wait(400);
  const all = () => { const o = []; const w = (r) => r.querySelectorAll('*').forEach((e) => { o.push(e); if (e.shadowRoot) w(e.shadowRoot); }); w(document); return o; };
  const open = async (h) => { location.hash = h; await wait(1300); };
  const cardsIn = (h) => { const r = all().find((e) => e.localName === 'msh-rom-card' && e.getBoundingClientRect().height > 0); return [r.shadowRoot.querySelector('msh-rom-klima-card'), r]; };
  await open('#stue');
  let [k, r] = cardsIn('#stue');
  const hdr = () => { const c = all().filter((e) => e.classList && e.classList.contains('bubble-header-container')).find((e) => e.getBoundingClientRect().height > 0); return c.getBoundingClientRect().bottom; };
  const dist = () => Math.round(k.getBoundingClientRect().top - hdr());
  res.defaultTop = dist();
  const nxt = () => r.shadowRoot.querySelector('.rom > *'); res.gap = Math.round(nxt().getBoundingClientRect().top - k.getBoundingClientRect().bottom);
  res.padBottom = getComputedStyle(r).paddingBottom;
  for (const v of [-4, 44]) { r.setConfig({ ...r._rawConfig, pad_top: v }); await wait(150); res['top' + v] = dist(); }
  r.setConfig({ ...r._rawConfig, pad_top: 20, gap: 18 }); await wait(150);
  res.gap18 = Math.round(nxt().getBoundingClientRect().top - k.getBoundingClientRect().bottom);
  // chip + scener
  res.chip = k.shadowRoot.querySelector('.chip').textContent.trim();
  res.scenes = [...r.shadowRoot.querySelectorAll('.sc')].map((e) => `${e.textContent.trim()} ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`);
  // Tilpass rom via tannhjulet
  k.shadowRoot.querySelector('.gear').click(); await wait(300);
  const portal = window.MSH.portals().pop();
  const ed = portal.shadowRoot.querySelector('msh-editor');
  res.tabs = [...ed.shadowRoot.querySelectorAll('.chips.sg.tabs .chip')].map((x) => x.textContent.trim()); // 19.20: faner – klimafeltene ligger under Klima
  const kt = ed.shadowRoot.querySelector('.chips.sg.tabs .chip[data-v="klima"]'); if (kt) { kt.click(); await wait(200); }
  const secs = [...ed.shadowRoot.querySelectorAll('details.sec > summary')].map((s) => s.textContent.trim().replace(/\s+/g, ' '));
  res.firstAccordion = secs[0];
  res.ranges = [...ed.shadowRoot.querySelectorAll('input[type=range]'), ...[...ed.shadowRoot.querySelectorAll('ki-spacing-editor')].flatMap((k) => [...k.shadowRoot.querySelectorAll('input[type=range]')])].length; // 28.10: ki-spacing-editor
  // bytt temperatursensor via velgeren
  // felles entitetsvelger (<msh-entity-picker>, egen shadow root)
  const pkEls = () => [...ed.shadowRoot.querySelectorAll('msh-entity-picker')];
  res.pickers = pkEls().map((p) => p.shadowRoot.querySelector('.pk').textContent.trim().replace(/\s+/g, ' ')).slice(0, 4);
  const tempEl = () => pkEls().find((p) => p.closest('.f') && p.closest('.f').textContent.includes('Temperatursensor'));
  tempEl().shadowRoot.querySelector('.pk').click(); await wait(100);
  const rows = [...tempEl().shadowRoot.querySelectorAll('.pls .pr')];
  res.listFirst = rows[0] && rows[0].textContent.trim().replace(/\s+/g, ' ');
  const kjt = rows.find((x) => x.dataset.v === 'sensor.kjokken_temperatur');
  kjt.click(); await wait(250);
  res.liveTemp = k.shadowRoot.querySelector('.big').textContent;
  // tilbake til Automatisk
  tempEl().shadowRoot.querySelector('.pk').click(); await wait(80);
  tempEl().shadowRoot.querySelector('.pls .pr').click(); await wait(250);
  res.autoTemp = k.shadowRoot.querySelector('.big').textContent;
  // slider live (Mellomrom ligger under Oppsett)
  const ot = ed.shadowRoot.querySelector('.chips.sg.tabs .chip[data-v="oppsett"]'); if (ot) { ot.click(); await wait(200); }
  const rg = [...ed.shadowRoot.querySelectorAll('input[type=range]'), ...[...ed.shadowRoot.querySelectorAll('ki-spacing-editor')].flatMap((k) => [...k.shadowRoot.querySelectorAll('input[type=range]')])][1];
  rg.value = '44'; rg.dispatchEvent(new Event('input', { bubbles: true })); await wait(200);
  res.sliderLiveTop = dist();
  res.hashBeforeCancel = location.hash;
  ed.shadowRoot.querySelector('[data-a="cancel"]').click(); await wait(300);
  res.hashAfterCancel = location.hash;
  res.afterCancelTop = dist();
  // bad: KI Rom-tall + streng, scener fra området
  await open('#bad');
  [k, r] = cardsIn('#bad');
  res.badTemp = k.shadowRoot.querySelector('.big').textContent + ' / ' + k.shadowRoot.querySelector('.hv').textContent;
  res.badScenes = [...r.shadowRoot.querySelectorAll('.sc')].map((e) => e.textContent.trim());
  res.badChip = k.shadowRoot.querySelector('.chip').textContent.trim();
  } catch (e) { res.ERROR = e.message; res.hash = location.hash; }
  return res;
});
console.log(JSON.stringify(out, null, 1));
console.log(errs.join('\n') || 'ingen JS-feil');
await p.screenshot({ path: 'test/shots/rom-check.png' });
await b.close();
