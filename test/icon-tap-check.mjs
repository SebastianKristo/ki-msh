// Fiks 15.6 + 15.7: felles ikonvelger (MSH.iconPicker) og trykk-handling i HA-format (MSH.tap) – mot EKTE Bubble Card.
//  · «Tilpass navbar»: ikonfeltet åpner søkbar velger; «robot» finner mdi:robot-vacuum uten «mdi:», egne sett
//    (window.customIcons med getIconList) har egne chips, valg lagres som full ID, «Nylig brukt» fylles.
//  · navbar-knapp med tap { action: navigate, navigation_path: '#tesla' } åpner popupen, er aktiv, trykk igjen lukker.
//  · «Handling» → Egen hash advarer «Ingen popup med #xyz» men lagres; Popup-listen viser egne popups med #hash.
//  · prosa-pille med egen hash åpner popupen; gammel link-nøkkel virker fortsatt.
// mdi-lista (jsDelivr) serveres fra test/fixtures/mdi-meta.json.gz (@mdi/svg 7.4.47 meta.json: navn + aliaser + tagger).
// Kjør: node test/icon-tap-check.mjs
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, mkdirSync, existsSync, unlinkSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const R = resolve('.') + '/';
mkdirSync('test/.build', { recursive: true });
mkdirSync('test/.vendor', { recursive: true });
const BC = resolve('test/.vendor/bubble-card.js');
if (!existsSync(BC)) execFileSync('curl', ['-sSL', '-o', BC, 'https://raw.githubusercontent.com/Clooos/Bubble-Card/main/dist/bubble-card.js']);
const bundle = resolve(`test/.build/icontap-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle], { cwd: R, stdio: 'inherit' });
const mocks = readdirSync(R + 'test/mock').filter((f) => f.endsWith('.js')).sort().map((f) => R + 'test/mock/' + f);
const META = gunzipSync(readFileSync(R + 'test/fixtures/mdi-meta.json.gz'));
const browser = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => pw.chromium.launch());
const res = [];
const ok = (name, cond, info) => { res.push(`${cond ? '✔' : '✘'} ${name}${info != null ? ' · ' + JSON.stringify(info) : ''}`); };

const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
let metaHits = 0;
await page.route('https://cdn.jsdelivr.net/npm/@mdi/svg@*/meta.json', (r) => { metaHits++; r.fulfill({ status: 200, contentType: 'application/json', body: META }); });
await page.goto('file://' + R + 'test/harness-bubble.html');
for (const m of mocks) await page.addScriptTag({ path: m });
await page.addScriptTag({ path: bundle });
await page.addScriptTag({ path: BC, type: 'module' });
await page.waitForFunction(() => customElements.get('bubble-card'), null, { timeout: 10000 });
const wait = (ms) => page.waitForTimeout(ms);
// deep query (shadow DOM)
await page.evaluate(() => {
  window.deepAll = (sel) => { const out = []; const walk = (root) => root.querySelectorAll('*').forEach((e) => { if (e.matches(sel)) out.push(e); if (e.shadowRoot) walk(e.shadowRoot); }); walk(document); return out; };
  window.deep = (sel) => window.deepAll(sel)[0] || null;
});

await page.evaluate(async () => {
  // Egne ikonsett: phu med liste (HA-standarden window.customIcons), hue bare som customIconsets (ingen liste)
  window.customIcons = { phu: { getIcon: async () => ({ path: 'M0 0h24v24H0z' }), getIconList: async () => [{ name: 'tesla-model3', keywords: ['bil', 'car'] }, { name: 'robot-arm' }, 'nibe'] } };
  window.customIconsets = { hue: async () => ({ path: 'M0 0h24v24H0z' }) };
  const M = window.MSH;
  window.H = window.mockHass();
  // Popuplisten (som etter en strategi-generering): innebygde + egen/importert #tesla
  M.popupReport = { entries: [
    { hash: '#stue', name: 'Stue', icon: 'mdi:sofa', group: 'rom', source: 'auto' },
    { hash: '#vaer', name: 'Vær', icon: 'mdi:weather-partly-cloudy', group: 'fn', source: 'auto' },
    { hash: '#lys', name: 'Lys', icon: 'mdi:lightbulb-group', group: 'fn', source: 'auto' },
    { hash: '#tesla', name: 'Tesla', icon: 'mdi:car-electric', group: 'egne', source: 'yaml' },
  ] };
  const dash = document.getElementById('dash');
  const nav = document.createElement('msh-navbar-card');
  nav.setConfig({ type: 'custom:msh-navbar-card', card_id: 'nav1', bar: ['vanning', 'media', 'egen_t'], more: ['gjoremal'],
    buttons: { egen_t: { custom: true, icon: 'mdi:car', label: 'Tesla', tap: { action: 'navigate', navigation_path: '#tesla' } }, media: { hash: '#lys' } } });
  nav.hass = H; dash.appendChild(nav); window.NAV = nav;
  const prosa = document.createElement('msh-prosa-card');
  prosa.setConfig({ type: 'custom:msh-prosa-card', card_id: 'pz1', prose: [
    { id: 'a', pre: 'Bilen', src: 'text', fmt: 'Tesla', post: '.', tap: { action: 'navigate', navigation_path: '#tesla' } },
    { id: 'b', pre: 'Og', src: 'text', fmt: 'Lys', post: '.', link: '#lys' },
    { id: 'c', pre: 'Ingen', src: 'text', fmt: 'Stille', post: '.', tap: { action: 'none' } },
  ] });
  prosa.hass = H; dash.appendChild(prosa); window.PZ = prosa;
  const bc = document.createElement('bubble-card');
  bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash: '#tesla', name: 'Tesla', icon: 'mdi:car-electric', cards: [{ type: 'custom:msh-soppel-card' }] });
  bc.hass = H; dash.appendChild(bc);
  const bl = document.createElement('bubble-card');
  bl.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash: '#lys', name: 'Lys', icon: 'mdi:lightbulb', cards: [{ type: 'custom:msh-soppel-card' }] });
  bl.hass = H; dash.appendChild(bl);
  await new Promise((r) => setTimeout(r, 600));
});
const popOpen = (hash) => page.evaluate((hash) => deepAll('.bubble-pop-up').some((p) => p.classList.contains('is-popup-opened') && (p.closest('bubble-card') || p.getRootNode().host || {}).config && true) && location.hash === hash, hash);
const popState = () => page.evaluate(() => ({ hash: location.hash, open: deepAll('.bubble-pop-up').filter((p) => p.classList.contains('is-popup-opened')).length }));
const navBtn = (id) => page.evaluate((id) => { const b = deep(`.msh-navbar-portal nav [data-id="${id}"]`) || deepAll(`nav [data-id="${id}"]`).find((x) => x.getBoundingClientRect().width > 0); return b ? { cls: b.className } : null; }, id);
const tapNav = async (id) => {
  const box = await page.evaluate((id) => { const b = deepAll(`nav [data-id="${id}"]`).find((x) => x.getBoundingClientRect().width > 0); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, id);
  if (!box) return false;
  await page.touchscreen.tap(box.x, box.y);
  return true;
};

/* ---------------- 15.6 · navbar: egen hash åpner, aktiv, trykk igjen lukker */
await tapNav('egen_t'); await wait(900);
let st = await popState(), nb = await navBtn('egen_t');
ok('navbar #tesla (tap navigate) åpner popupen', st.hash === '#tesla' && st.open === 1, st);
ok('navbar-knappen er aktiv (prikk) på egen hash', !!nb && /\bopen\b/.test(nb.cls), nb);
await wait(500);
await tapNav('egen_t'); await wait(900);
st = await popState();
ok('trykk igjen lukker (MSH.closePopup)', st.hash === '' && st.open === 0, st);
// bakoverkompatibel hash-nøkkel (media → #lys)
await tapNav('media'); await wait(900);
st = await popState(); nb = await navBtn('media');
ok('gammel buttons.<id>.hash virker fortsatt (#lys)', st.hash === '#lys' && st.open === 1 && /\bopen\b/.test(nb.cls), { st, nb });
await wait(500); await tapNav('media'); await wait(900);
st = await popState();
ok('… og lukker ved nytt trykk', st.hash === '' && st.open === 0, st);

/* ---------------- 15.6 · prosa-pille med egen hash */
const tapChip = async (i) => {
  const box = await page.evaluate((i) => { const b = PZ.shadowRoot.querySelector(`[data-act="chip"][data-i="${i}"]`); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, press: b.classList.contains('press') }; }, i);
  if (box) await page.touchscreen.tap(box.x, box.y);
  return box;
};
let cb = await tapChip(0); await wait(900);
st = await popState();
ok('prosa-pille tap #tesla åpner popupen', !!cb && cb.press && st.hash === '#tesla' && st.open === 1, { cb, st });
await page.evaluate(() => MSH.closePopup()); await wait(700);
cb = await tapChip(1); await wait(900);
st = await popState();
ok('prosa-pille med gammel link #lys virker', st.hash === '#lys' && st.open === 1, st);
await page.evaluate(() => MSH.closePopup()); await wait(700);
cb = await tapChip(2); await wait(300);
st = await popState();
ok('prosa-pille tap none: ikke trykkbar, ingen navigasjon', !!cb && !cb.press && st.hash === '', { cb, st });
const defTap = await page.evaluate(() => { const d = document.createElement('msh-prosa-card'); d.setConfig({ type: 'custom:msh-prosa-card' }); d.hass = H; const R = MSH.prosaTapOf; const rows = (d.constructor.schema(H).find((f) => f.name === 'prose') || {}).defaults(H, {}) || []; return rows.map((r) => [r.src, R(r)]); });
ok('standard-prosa: vær → #vaer, lys → #lys (tap)', defTap.some(([s, t]) => s === 'weather' && t && t.navigation_path === '#vaer') && defTap.every(([s, t]) => s !== 'lights' || (t && t.navigation_path === '#lys')), defTap);

/* ---------------- 15.7 · «Tilpass navbar»: ikonvelger */
await page.evaluate(async () => { NAV.customize(); await new Promise((r) => setTimeout(r, 500)); });
const ed = () => page.evaluate(() => !!deep('msh-navbar-editor'));
ok('«Tilpass navbar» åpnet', await ed());
await page.evaluate(async () => { const e = deep('msh-navbar-editor'); window.ED = e; e.shadowRoot.querySelector('[data-a="nbsel"][data-id="egen_t"]').click(); await new Promise((r) => setTimeout(r, 300)); });
const fieldInfo = await page.evaluate(() => { const f = ED.shadowRoot.querySelector('msh-icon-field[data-nbicon="egen_t"]'); const tp = ED.shadowRoot.querySelector('msh-tap-picker[data-nbtap="egen_t"]'); return { field: !!f, value: f && f.value, text: f && f.shadowRoot.textContent.trim(), tap: !!tp, tapMode: tp && tp.mode, noFreeText: !ED.shadowRoot.querySelector('input[data-nbf="icon"]') }; });
ok('ikonfelt (msh-icon-field) i stedet for fritekst, viser ikon + navn', fieldInfo.field && fieldInfo.noFreeText && fieldInfo.value === 'mdi:car' && /Car/.test(fieldInfo.text), fieldInfo);
ok('«Handling» (msh-tap-picker) viser Popup for #tesla', fieldInfo.tap && fieldInfo.tapMode === 'popup', fieldInfo);
// åpne velgeren (trykk på feltet)
const fb = await page.evaluate(() => { const f = ED.shadowRoot.querySelector('msh-icon-field[data-nbicon="egen_t"]'); const r = f.shadowRoot.querySelector('.pk').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
await page.touchscreen.tap(fb.x, fb.y);
await wait(700);
const sheet = await page.evaluate(() => {
  const hosts = [...document.querySelector('ki-overlay-root').shadowRoot.querySelectorAll('.msh-portal')];
  const h = hosts.find((x) => x.shadowRoot.querySelector('.q'));
  window.PK = h && h.shadowRoot;
  if (!PK) return null;
  const cells = PK.querySelectorAll('.vg .ic');
  const vg = PK.querySelector('.vg');
  return { chips: [...PK.querySelectorAll('.chip')].map((c) => c.textContent), cells: cells.length, vgH: vg && vg.offsetHeight, lb: (PK.querySelector('.lb') || {}).textContent, cols: getComputedStyle(PK.querySelector('.vg .gr')).gridTemplateColumns, cellW: cells[0] && cells[0].getBoundingClientRect().width, focus: PK.activeElement && PK.activeElement.className };
});
ok('velgeren åpnet med søkefelt i fokus', !!sheet && sheet.focus === 'q', sheet);
ok('lazy lasting av mdi-lista (én henting)', metaHits === 1, metaHits);
// Fiks 17.8: faner MDI · hass · phu · hue · fapro · si · Alle (faner uten sett skjules), MDI først og Alle sist
ok('faner per ikonsett (MDI · phu · hue · Alle)', !!sheet && sheet.chips[0] === 'MDI' && sheet.chips[sheet.chips.length - 1] === 'Alle' && sheet.chips.includes('phu') && sheet.chips.includes('hue'), sheet && sheet.chips);
ok('virtualisert rutenett: 6 × 48 px (17.8), bare synlige rader rendres (>7000 ikoner)', !!sheet && sheet.cols.split(' ').length === 6 && sheet.cols.startsWith('48px') && Math.round(sheet.cellW) === 48 && sheet.cells > 0 && sheet.cells < 200 && sheet.vgH > 7000 / 6 * 50, sheet);
// scroll langt ned → nye celler
const sc2 = await page.evaluate(async () => { const sc = PK.querySelector('.sc'); sc.scrollTop = 40000; sc.dispatchEvent(new Event('scroll')); await new Promise((r) => setTimeout(r, 100)); const c = PK.querySelectorAll('.vg .ic'); return { n: c.length, first: c[0] && c[0].dataset.v, vis: c[0] && c[0].getBoundingClientRect().bottom > 0 }; });
ok('rulling rendrer riktige rader', sc2.n > 0 && sc2.n < 200 && sc2.first && !/^mdi:a/.test(sc2.first), sc2);
// søk «robot» (uten mdi:) – debounce 120 ms
// Fiks 17.8: søk i «Alle»-fanen (standardfanen er MDI)
await page.evaluate(async () => { PK.querySelector('.chip[data-v="alle"]').click(); await new Promise((r) => setTimeout(r, 50)); const q = PK.querySelector('.q'); q.focus(); });
await page.keyboard.type('robot');
await wait(60);
const early = await page.evaluate(() => (PK.querySelector('.lb') || {}).textContent);
await wait(250);
const hits = await page.evaluate(() => [...PK.querySelectorAll('.vg .ic')].map((b) => b.dataset.v));
ok('søk debounces (120 ms)', !/treff/.test(early || ''), early);
ok('søk «robot» finner mdi:robot-vacuum uten «mdi:»', hits.includes('mdi:robot-vacuum') && hits.indexOf('mdi:robot-vacuum') < 12, hits.slice(0, 12));
ok('søket tar med egne sett (phu:robot-arm)', hits.includes('phu:robot-arm'), hits.filter((x) => x.startsWith('phu:')));
// nøkkelord: «roomba» er alias for robot-vacuum, norsk «støvsuger»
await page.evaluate(() => { const q = PK.querySelector('.q'); q.value = 'roomba'; q.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(250);
const kw = await page.evaluate(() => [...PK.querySelectorAll('.vg .ic')].map((b) => b.dataset.v).slice(0, 6));
await page.evaluate(() => { const q = PK.querySelector('.q'); q.value = 'støvsuger'; q.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(250);
const no = await page.evaluate(() => [...PK.querySelectorAll('.vg .ic')].map((b) => b.dataset.v).slice(0, 8));
ok('søk på nøkkelord (alias «roomba», norsk «støvsuger»)', kw.includes('mdi:robot-vacuum') && no.includes('mdi:robot-vacuum'), { kw, no });
// chip phu → bare phu-ikoner
await page.evaluate(() => { const q = PK.querySelector('.q'); q.value = ''; q.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(250);
await page.evaluate(() => [...PK.querySelectorAll('.chip')].find((c) => /phu/.test(c.textContent)).click()); await wait(100);
const phu = await page.evaluate(() => [...PK.querySelectorAll('.vg .ic')].map((b) => b.dataset.v));
ok('chip «phu» viser egne ikoner fra getIconList()', phu.length === 3 && phu.every((x) => x.startsWith('phu:')), phu);
await page.evaluate(() => [...PK.querySelectorAll('.chip')].find((c) => /hue/.test(c.textContent)).click()); await wait(100);
const hue = await page.evaluate(() => PK.querySelector('.note') && PK.querySelector('.note').textContent);
ok('sett uten liste (customIconsets hue) → hint om å skrive navnet', /hue/.test(hue || ''), hue);
await page.evaluate(() => [...PK.querySelectorAll('.chip')].find((c) => c.textContent === 'Alle').click()); await wait(100);
// velg robot-vacuum
await page.evaluate(() => { const q = PK.querySelector('.q'); q.value = 'robot vacuum'; q.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(250);
const cell = await page.evaluate(() => { const b = PK.querySelector('.vg .ic[data-v="mdi:robot-vacuum"]'); const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
await page.touchscreen.tap(cell.x, cell.y); await wait(500);
const picked = await page.evaluate(() => ({ cfg: ((ED._config.buttons || {}).egen_t || {}).icon, field: ED.shadowRoot.querySelector('msh-icon-field[data-nbicon="egen_t"]').value, recent: JSON.parse(localStorage.getItem('ki:icons:recent') || '[]'), sheetGone: ![...document.querySelector('ki-overlay-root').shadowRoot.querySelectorAll('.msh-portal')].some((x) => x.shadowRoot.querySelector('.q')), editorOpen: !!deep('msh-navbar-editor') }));
ok('valg lagrer full ID i config (buttons.egen_t.icon)', picked.cfg === 'mdi:robot-vacuum' && picked.field === 'mdi:robot-vacuum', picked);
ok('arket lukkes, «Tilpass navbar» forblir åpent', picked.sheetGone && picked.editorOpen, picked);
ok('«Nylig brukt» oppdatert', picked.recent[0] === 'mdi:robot-vacuum', picked.recent);
// åpne igjen: «Nylig brukt» øverst, «Skriv inn manuelt»
await page.touchscreen.tap(fb.x, fb.y); await wait(500);
const again = await page.evaluate(() => { const hosts = [...document.querySelector('ki-overlay-root').shadowRoot.querySelectorAll('.msh-portal')]; window.PK = hosts.find((x) => x.shadowRoot.querySelector('.q')).shadowRoot; return { lb: PK.querySelector('.lb').textContent, rec: [...PK.querySelectorAll('.sc > .gr .ic')].map((b) => b.dataset.v), man: !!PK.querySelector('.mi'), metaHits: 0 }; });
ok('«Nylig brukt» øverst ved ny åpning (lista er mellomlagret)', again.lb === 'Nylig brukt' && again.rec[0] === 'mdi:robot-vacuum' && metaHits === 1, { again, metaHits });
// Fiks 17.8: «Skriv inn selv» er alltid synlig nederst
await page.evaluate(() => { const i = PK.querySelector('.mi'); i.value = 'phu:egen-greie'; });
await page.evaluate(() => PK.querySelector('[data-p="manok"]').click()); await wait(400);
const man = await page.evaluate(() => ((ED._config.buttons || {}).egen_t || {}).icon);
ok('«Skriv inn selv» lagrer fritekst-ikon', man === 'phu:egen-greie', man);
// × tømmer
await page.evaluate(() => ED.shadowRoot.querySelector('msh-icon-field[data-nbicon="egen_t"]').shadowRoot.querySelector('[data-p="x"]').click()); await wait(300);
const cleared = await page.evaluate(() => ((ED._config.buttons || {}).egen_t || {}).icon);
ok('× tømmer ikonet', cleared === undefined, cleared);

/* ---------------- 15.6 · «Handling» i navbar-editoren */
const tp = (fn) => page.evaluate(fn);
// Fiks 17.8: Popup åpner popup-velgeren (ark i ki-overlay-root)
await tp(() => { const t = ED.shadowRoot.querySelector('msh-tap-picker[data-nbtap="egen_t"]'); window.TP = t; t.shadowRoot.querySelector('[data-p="open"]').click(); });
await wait(150);
await tp(() => { window.PP = MSH.portals().map((x) => x.shadowRoot).filter((r) => r.querySelector('.oh')).pop(); });
const list = await tp(() => [...PP.querySelectorAll('.pr')].map((r) => r.textContent.replace(/\s+/g, ' ').trim()));
ok('Popup-listen viser alle popups (ikon, navn, #hash), også egne', list.some((x) => /Tesla.*#tesla/.test(x)) && list.some((x) => /Stue.*#stue/.test(x)) && list.length === 4, list);
await tp(() => { const i = PP.querySelector('.q'); i.value = 'vær'; i.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(50);
const srch = await tp(() => [...PP.querySelectorAll('.pr')].map((r) => r.dataset.v));
ok('søk i popup-listen', srch.length === 1 && srch[0] === '#vaer', srch);
await tp(() => PP.querySelector('.pr[data-v="#vaer"]').click()); await wait(300);
let bt = await tp(() => (ED._config.buttons || {}).egen_t);
ok('valgt popup lagres som tap i HA-format', bt && bt.tap && bt.tap.action === 'navigate' && bt.tap.navigation_path === '#vaer' && !('hash' in bt), bt);
await tp(() => { const t = ED.shadowRoot.querySelector('msh-tap-picker[data-nbtap="egen_t"]'); window.TP = t; [...t.shadowRoot.querySelectorAll('.seg button')].find((b) => b.textContent === 'Egen hash').click(); });
await wait(100);
await tp(() => { const i = TP.shadowRoot.querySelector('[data-f="hash"]'); i.value = 'xyz'; i.dispatchEvent(new Event('input', { bubbles: true })); });
const warn = await tp(() => { const w = TP.shadowRoot.querySelector('.hw'); return { t: w.textContent, warn: w.classList.contains('warn') }; });
ok('Egen hash advarer «Ingen popup med #xyz»', warn.warn && /Ingen popup med #xyz/.test(warn.t), warn);
await tp(() => { const i = TP.shadowRoot.querySelector('[data-f="hash"]'); i.dispatchEvent(new Event('change', { bubbles: true })); }); await wait(300);
bt = await tp(() => (ED._config.buttons || {}).egen_t);
ok('… men lagres likevel', bt && bt.tap && bt.tap.navigation_path === '#xyz', bt);
const mode = await tp(() => ED.shadowRoot.querySelector('msh-tap-picker[data-nbtap="egen_t"]').mode);
ok('ukjent hash vises som «Egen hash»', mode === 'hash', mode);
await tp(() => { const t = ED.shadowRoot.querySelector('msh-tap-picker[data-nbtap="egen_t"]'); window.TP = t; [...t.shadowRoot.querySelectorAll('.seg button')].find((b) => b.textContent === 'Dashbord-sti').click(); });
await wait(50);
await tp(() => { const i = TP.shadowRoot.querySelector('[data-f="path"]'); i.value = 'lovelace/energi'; i.dispatchEvent(new Event('change', { bubbles: true })); }); await wait(300);
bt = await tp(() => (ED._config.buttons || {}).egen_t);
ok('Dashbord-sti lagres som navigate /lovelace/energi', bt && bt.tap && bt.tap.navigation_path === '/lovelace/energi', bt);
await tp(() => { const t = ED.shadowRoot.querySelector('msh-tap-picker[data-nbtap="egen_t"]'); window.TP = t; [...t.shadowRoot.querySelectorAll('.seg button')].find((b) => b.textContent === 'URL').click(); });
await wait(50);
await tp(() => { const i = TP.shadowRoot.querySelector('[data-f="url"]'); i.value = 'https://example.com'; i.dispatchEvent(new Event('change', { bubbles: true })); }); await wait(300);
bt = await tp(() => (ED._config.buttons || {}).egen_t);
ok('URL lagres som { action: url, url_path }', bt && bt.tap && bt.tap.action === 'url' && bt.tap.url_path === 'https://example.com', bt);
// innebygd knapp: standard (#vanning) lagres ikke
await tp(async () => { ED.shadowRoot.querySelector('[data-a="nbsel"][data-id="vanning"]').click(); await new Promise((r) => setTimeout(r, 200)); const t = ED.shadowRoot.querySelector('msh-tap-picker[data-nbtap="vanning"]'); window.TP = t; });
const vm = await tp(() => ({ modes: [...TP.shadowRoot.querySelectorAll('.seg button')].map((b) => b.textContent) }));
ok('innebygd knapp: Popup · Egen hash · Dashbord-sti · URL', JSON.stringify(vm.modes) === JSON.stringify(['Popup', 'Egen hash', 'Dashbord-sti', 'URL']), vm);

/* ---------------- 15.6 · «Tilpass Hjem» → Tekst: «Ved trykk» */
await page.evaluate(() => { document.querySelector('ki-overlay-root').shadowRoot.querySelectorAll('.msh-portal').forEach((p) => p.remove()); });
const gui = await page.evaluate(async () => {
  // GUI-editoren (msh-prosa-card-config): «Ved trykk» som tap-felt i hver rad
  const el = customElements.get('msh-prosa-card').getConfigElement();
  el.hass = H; el.setConfig({ type: 'custom:msh-prosa-card', prose: [{ id: 'a', pre: 'X', src: 'text', fmt: 'Y', post: '', link: '#lys' }] });
  document.body.appendChild(el);
  await new Promise((r) => setTimeout(r, 200));
  el.shadowRoot.querySelector('[data-a="x-ropen"][data-n="prose"]').click(); // Fiks 17.9: seksjonene har egne rader
  await new Promise((r) => setTimeout(r, 200));
  const t = el.shadowRoot.querySelector('msh-tap-picker');
  if (!t) return { none: true };
  let got = null; el.addEventListener('config-changed', (e) => { got = e.detail.config; });
  const m0 = t.mode, v0 = t.value;
  [...t.shadowRoot.querySelectorAll('.seg button')].find((b) => b.textContent === 'Egen hash').click();
  const i = t.shadowRoot.querySelector('[data-f="hash"]'); i.value = '#tesla'; i.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 100));
  el.remove();
  return { m0, v0, modes: [...t.shadowRoot.querySelectorAll('.seg button')].map((b) => b.textContent), saved: got && got.prose && got.prose[0].tap };
});
ok('GUI-editor: «Ved trykk» leser gammel link som Popup #lys', gui.m0 === 'popup' && gui.v0 && gui.v0.navigation_path === '#lys', gui);
ok('GUI-editor: valgene Popup · Egen hash · Sti · URL · More-info · Dørlås · Ingen', gui.modes && gui.modes.length === 7 && gui.modes.includes('More-info') && gui.modes.includes('Ingen'), gui.modes);
ok('GUI-editor: egen hash lagres som tap', gui.saved && gui.saved.navigation_path === '#tesla', gui.saved);

const hjem = await page.evaluate(async () => {
  // «Tilpass Hjem» → Tekst: «Ved trykk» per pille
  const E = MSH.openHomeEditor({ focus: 'tekst' });
  const saves = []; const orig = E.saveP.bind(E); E.saveP = (p) => { saves.push(JSON.parse(JSON.stringify(p))); return orig(p); };
  E.u.proseSel = 0; E.render(); await new Promise((r) => setTimeout(r, 300));
  const t = E.root.querySelector('msh-tap-picker[data-in="ptap"]');
  if (!t) return { none: true, sec: E.u.sec };
  const m0 = t.mode, modes = [...t.shadowRoot.querySelectorAll('.seg button')].map((b) => b.textContent);
  [...t.shadowRoot.querySelectorAll('.seg button')].find((b) => b.textContent === 'Egen hash').click();
  const i = t.shadowRoot.querySelector('[data-f="hash"]'); i.value = 'tesla'; i.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 200));
  const last = saves[saves.length - 1];
  E.ov.close();
  return { m0, modes, row: last && last.prose && last.prose[0] };
});
ok('«Tilpass Hjem» → Tekst: «Ved trykk» med Popup · Egen hash · Sti · URL · More-info · Dørlås · Ingen', !!hjem.modes && JSON.stringify(hjem.modes) === JSON.stringify(['Popup', 'Egen hash', 'Sti', 'URL', 'More-info', 'Dørlås', 'Ingen']), hjem);
ok('«Tilpass Hjem» → Tekst: egen hash lagres som tap (gammel link fjernes)', hjem.row && hjem.row.tap && hjem.row.tap.navigation_path === '#tesla' && !('link' in hjem.row), hjem.row);

const prom = await page.evaluate(async () => {
  // Promise-API (popup-editoren): valgt ID, eller null ved avbryt
  const sheetRoot = () => [...document.querySelector('ki-overlay-root').shadowRoot.querySelectorAll('.msh-portal')].map((x) => x.shadowRoot).find((r) => r.querySelector('.q') && !r.host.__used);
  const p1 = MSH.iconPicker.open({ value: 'mdi:sofa' });
  await new Promise((r) => setTimeout(r, 300));
  const r1 = sheetRoot(); r1.host.__used = true; r1.querySelector('.vg .ic').click();
  const v1 = await p1;
  const p2 = MSH.iconPicker.open({ value: '' });
  await new Promise((r) => setTimeout(r, 100));
  p2.close();
  const v2 = await p2;
  return { v1, v2, thenable: typeof p1.then === 'function' };
});
ok('iconPicker.open() → Promise med valgt ID / null ved avbryt', prom.thenable && /^mdi:/.test(prom.v1 || '') && prom.v2 === null, prom);

ok('ingen sidefeil', errs.length === 0, errs.slice(0, 3));
await page.close();
await browser.close();
try { unlinkSync(bundle); } catch (e) { /* */ }
console.log(res.join('\n'));
const bad = res.filter((r) => r.startsWith('✘')).length;
console.log(bad ? `\n${bad} feil` : '\nAlle ikonvelger-/trykk-sjekker OK');
process.exit(bad ? 1 : 0);
