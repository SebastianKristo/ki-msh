// Del 45 · modul B – Strøm v3 Kurser-fanen + Kurser-editoren (src/62-strom-kurser.js, M.stromKurser).
// Stub-vert (custom element med host-grensesnittet fra 61-strom.js: hass, config, ui, setCfg, render, anim, haptic),
// mock-hass med noen kurs-entiteter. Sjekker: totalkort/fordelingsstripe/fliser/sikringsskap fra entitetene («–» når de
// mangler), Kroner/kWh + I dag/Måneden + prisvalg, fordeling ved trykk, akkordeon, hold 400 ms + dra (mus og touch)
// lagrer ord.cat / ord.kurs via setCfg og svelger klikket, Esc avbryter; editoren (legg til/flytt/slett/rediger/farge/
// underpunkt/gruppe/standardvalg) endrer visningen live; «Vis YAML» er gyldig YAML (MSH.yaml.parse) som rundtur-er
// skjemaet; «Tilbakestill kurser» → KDEF.
//   node test/strom45-kurser-check.mjs
import { createRequire } from 'node:module';
import { mkdirSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const R = resolve('.') + '/';
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/sk45-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const browser = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
let fails = 0;
const ok = (name, cond, info) => { if (!cond) fails++; console.log(`${cond ? '✔' : '✘'} ${name}${info != null && !cond ? ' · ' + JSON.stringify(info).slice(0, 900) : ''}`); };
const errs = [];

async function setup(theme = 'dark') {
  const page = await browser.newPage({ viewport: { width: 390, height: 900 }, hasTouch: true });
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await page.goto('file://' + R + 'test/harness.html');
  await page.addScriptTag({ path: bundle });
  await page.evaluate((theme) => {
    try { localStorage.clear(); } catch (e) { /* */ }
    document.documentElement.setAttribute('data-ki-theme', theme);
    const S = {};
    const add = (id, v, u) => { S[id] = { entity_id: id, state: String(v), attributes: { unit_of_measurement: u } }; };
    add('sensor.um_daily_cost_strommaler', 52.1, 'kr'); add('sensor.um_daily_cost_strommaler_norgespris', 40.5, 'kr');
    add('sensor.um_monthly_cost_strommaler', 812, 'kr');
    add('sensor.norgespris_pris_na', 0.8, 'kr/kWh'); add('sensor.totalpris_strompris_kroner', 1.49, 'kr/kWh');
    add('sensor.um_daily_cost_oppvarming_kurs', 31.9, 'kr'); add('sensor.um_daily_cost_oppvarming_kurs_norgespris', 30, 'kr');
    add('sensor.oppvarming_energy_daily', 25, 'kWh');
    add('sensor.um_daily_cost_lights', 2.01, 'kr'); add('sensor.lys_energy_daily', 1500, 'Wh');
    add('sensor.um_daily_cost_kjoleskap', 3.9, 'kr'); add('sensor.um_daily_cost_oppvaskmaskin_enhet', 2.64, 'kr');
    add('sensor.um_daily_cost_stue_panelovn', 13.4, 'kr'); add('sensor.um_daily_cost_kjokken_panelovn', 2.4, 'kr');
    add('sensor.um_daily_cost_stue_kurs', 26.8, 'kr'); add('sensor.stue_kurs_energy_daily', 12, 'kWh');
    add('sensor.um_daily_cost_kjokken_kurs', 18.2, 'kr');
    add('sensor.um_daily_cost_stue_oljefyr', 'unavailable', 'kr');
    window.H = { states: S, themes: { darkMode: theme === 'dark' } };
    window.HP = [];
    class StubHost extends HTMLElement {
      constructor() { super(); this.root = this.attachShadow({ mode: 'open' }); this.ui = {}; this.anim = true; this.config = {}; this.saves = []; this.draft = undefined; }
      connectedCallback() { this.render(); }
      setCfg(p) { this.config = { ...this.config, ...p }; this.saves.push(JSON.parse(JSON.stringify(p))); this.render(); }
      haptic(t) { window.HP.push(t); }
      render() {
        const K = MSH.stromKurser;
        const html = `<style>${(MSH.theme && MSH.theme.CSS) || ''}${K.css}</style><div id="tab">${K.html(this)}</div><div id="ed">${K.editorHtml(this, this.config.kurs)}</div>`;
        if (!this._did) { this.root.innerHTML = html; this._did = true; } else MSH.morph(this.root, html);
        K.bind(this, this.root.getElementById('tab'));
        K.editorBind(this, this.root.getElementById('ed'), this.config.kurs, (k) => { this.setCfg({ kurs: k }); });
      }
    }
    customElements.define('sk-stub-host', StubHost);
    window.mk = (cfg) => { document.getElementById('dash').innerHTML = ''; const h = document.createElement('sk-stub-host'); h.hass = window.H; if (cfg) h.config = cfg; document.getElementById('dash').appendChild(h); window.h = h; window.sr = h.root; return true; };
    window.T = () => sr.getElementById('tab');
    window.tiles = () => [...T().querySelectorAll('.sk-ktile')].sort((a, b) => +a.style.order - +b.style.order).map((t) => ({ l: t.querySelector('.sk-ktl').textContent, v: t.querySelector('.sk-ktv').textContent, p: t.querySelector('.sk-kpct').textContent, on: t.classList.contains('on') }));
    window.cirs = () => [...T().querySelectorAll('.sk-kbox')[0].querySelectorAll('.sk-kcir')].sort((a, b) => +a.style.order - +b.style.order).map((c) => ({ l: c.querySelector('.sk-kcn').textContent, v: c.querySelector('.sk-kcval').textContent, k: c.querySelector('.sk-kfuse span').textContent, load: c.querySelector('.sk-kload').textContent, ticks: c.querySelectorAll('.sk-kticks .on').length, open: !!c.querySelector('.sk-kcids') }));
    window.tot = () => ({ lab: T().querySelector('.sk-ktot-top .sk-k13').textContent, chip: T().querySelector('.sk-kchip').textContent, sum: T().querySelector('.sk-ksum').textContent, unit: T().querySelector('.sk-kunit').textContent, big: T().querySelectorAll('.sk-ktot > .sk-k13')[0].textContent, stripe: T().querySelectorAll('.sk-kstripe > span').length });
    window.clk = (sel, root) => { const e = (root || sr).querySelector(sel); if (!e) return false; e.click(); return true; };
    window.ctr = (sel) => { const r = sr.querySelector(sel).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
  }, theme);
  return page;
}

const page = await setup();
const ev = (fn, a) => page.evaluate(fn, a);
const wait = (ms) => page.waitForTimeout(ms);
await ev(() => mk());
await wait(100);

/* ---- visning */
let t = await ev(() => tot());
ok('totalkort: I dag, Norgespris-chip med pris, total fra totals + alt_suffix', t.lab === 'I dag' && t.chip === 'Norgespris · 0,80 kr/kWh' && t.sum === '40,50' && t.unit === 'kr', t);
ok('totalkort: «Størst: Oppvarming står for …» og fordelingsstripe', /^Størst: Oppvarming står for \d+ % av forbruket$/.test(t.big) && t.stripe === 3, t);
let tl = await ev(() => tiles());
ok('kategorier: 4 fliser i KDEF-rekkefølge', tl.map((x) => x.l).join('|') === 'Oppvarming|Belysning|Hvitvarer|Data og nettverk', tl);
ok('fliser: verdier fra entitetene (alt_suffix, sum av underpunkter, «–» uten data)', tl[0].v === '30,0 kr' && tl[1].v === '2,01 kr' && tl[2].v === '6,54 kr' && tl[3].v === '–' && tl[3].p === '–', tl);
ok('fliser: Oppvarming valgt som standard → fordeling vises', tl[0].on && await ev(() => /Oppvarming fordelt/.test(T().querySelector('.sk-kbrk').textContent)));
let ci = await ev(() => cirs());
ok('sikringsskap: 8 kurser, K-nummer, verdi, last fra energy_daily, første kurs med underpunkter åpen', ci.length === 8 && ci[1].l === 'Stue' && ci[1].v === '26,8 kr' && ci[1].k === 'K3' && /^\d+,\d \/ 3,7 kW$/.test(ci[1].load) && ci[0].open && ci[2].load === '– / 3,7 kW', ci);
ok('seksjoner: k_total, k_kat, k_kurs med data-rk/data-rid', await ev(() => [...T().querySelectorAll('[data-rk="sec-Kurser"]')].map((s) => s.dataset.rid).join() === 'k_total,k_kat,k_kurs'));
ok('ikoner via ha-icon (mdi:)', await ev(() => [...T().querySelectorAll('ha-icon')].every((i) => /^mdi:/.test(i.getAttribute('icon')))));

/* ---- veksling */
await ev(() => clk('[data-sk-act="unit"][data-sk-v="kwh"]'));
tl = await ev(() => tiles()); t = await ev(() => tot());
ok('kWh: fliser og total i kWh (Wh → kWh), total = sum når totals mangler energi', tl[0].v === '25,0 kWh' && tl[1].v === '1,50 kWh' && t.unit === 'kWh' && t.sum === '26,50', { tl, t });
await ev(() => clk('[data-sk-act="unit"][data-sk-v="kr"]'));
await ev(() => clk('[data-sk-act="per"][data-sk-v="month"]'));
t = await ev(() => tot());
ok('Måneden: månedsnavn + monthly-total', /^[A-ZÆØÅ][a-zæøå]+$/.test(t.lab) && t.lab !== 'I dag' && t.sum === '812', t);
await ev(() => clk('[data-sk-act="per"][data-sk-v="day"]'));
await ev(() => clk('[data-sk-act="alt"]'));
t = await ev(() => tot()); tl = await ev(() => tiles());
ok('chip bytter til Spotpris (hovedentitetene)', t.chip === 'Spotpris · 1,49 kr/kWh' && t.sum === '52,10' && tl[0].v === '31,9 kr', { t, tl });
await ev(() => clk('[data-sk-act="alt"]'));
ok('remember_view: valg i host.ui', await ev(() => h.ui.kursUnit === 'kr' && h.ui.kursPer === 'day' && h.ui.kursAlt === true));
ok('haptic på trykk', await ev(() => HP.length >= 5));

await ev(() => clk('[data-sk-act="cat"][data-sk-v="Hvitvarer"]'));
let brk = await ev(() => { const b = T().querySelector('.sk-kbrk'); return b && { hd: b.querySelector('.sk-kbrk-hd span').textContent, kids: [...b.querySelectorAll('.sk-kkid')].map((k) => k.querySelector('.sk-kkl').textContent + '=' + k.querySelector('.sk-kkv').textContent + '/' + k.querySelector('.sk-kkp').textContent) }; });
ok('trykk Hvitvarer → fordeling sortert etter verdi', brk && brk.hd === 'Hvitvarer fordelt' && brk.kids[0] === 'Kjøleskap=3,90 kr/60 %' && brk.kids[1] === 'Oppvaskmaskin=2,64 kr/40 %' && brk.kids[2].endsWith('=–/–'), brk);
await ev(() => clk('[data-sk-act="catx"]'));
ok('lukk fordeling', await ev(() => !T().querySelector('.sk-kbrk') && h.ui.kursCat === ''));
await ev(() => clk('[data-sk-act="cat"][data-sk-v="Belysning"]'));
ok('flis uten underpunkter åpner ingen fordeling', await ev(() => !T().querySelector('.sk-kbrk')));
await ev(() => clk('[data-sk-act="kurs"][data-sk-v="Stue"]'));
ci = await ev(() => cirs());
ok('akkordeon: Stue åpnes (underpunkter med verdi/andel)', ci[1].open && await ev(() => T().querySelectorAll('.sk-kcir')[1].querySelectorAll('.sk-kcid').length === 6), ci);
await ev(() => clk('[data-sk-act="kurs"][data-sk-v="Stue"]'));
ok('akkordeon: Stue lukkes', !(await ev(() => cirs()))[1].open);

/* ---- hold + dra (mus) – fliser */
await page.evaluate(() => sr.host.scrollIntoView());
let a = await ev(() => ctr('[data-sk-rk="cat"][data-sk-id="Oppvarming"]')), b = await ev(() => ctr('[data-sk-rk="cat"][data-sk-id="Hvitvarer"]'));
await page.mouse.move(a.x, a.y); await page.mouse.down(); await wait(480);
ok('hold 400 ms → løftet flis', await ev(() => !!T().querySelector('.sk-ktile.sk-klift')));
for (let i = 1; i <= 8; i++) { await page.mouse.move(a.x + ((b.x - a.x) * i) / 8, a.y + ((b.y - a.y) * i) / 8); await wait(20); }
await page.mouse.up(); await wait(80);
tl = await ev(() => tiles());
let ordCat = await ev(() => h.config.ord && h.config.ord.cat);
ok('dra flis → ny rekkefølge lagret i ord.cat via setCfg', Array.isArray(ordCat) && ordCat.indexOf('Oppvarming') === 2 && tl[2].l === 'Oppvarming', { ordCat, tl: tl.map((x) => x.l) });
ok('klikket etter dra svelges (ingen fordeling åpnet)', await ev(() => h.ui.kursCat === 'Belysning' || h.ui.kursCat === '') && !(await ev(() => !!T().querySelector('.sk-kbrk'))));
ok('ingen løft etter slipp', await ev(() => !T().querySelector('.sk-klift')));

/* ---- Esc avbryter */
a = await ev(() => ctr('[data-sk-rk="cat"][data-sk-id="Belysning"]')); b = await ev(() => ctr('[data-sk-rk="cat"][data-sk-id="Data og nettverk"]'));
await page.mouse.move(a.x, a.y); await page.mouse.down(); await wait(480);
for (let i = 1; i <= 6; i++) { await page.mouse.move(a.x + ((b.x - a.x) * i) / 6, a.y + ((b.y - a.y) * i) / 6); await wait(20); }
await page.keyboard.press('Escape'); await page.mouse.up(); await wait(60);
ok('Esc avbryter dra (ord.cat uendret)', JSON.stringify(await ev(() => h.config.ord.cat)) === JSON.stringify(ordCat));

/* ---- touch – kurser */
const cdp = await page.context().newCDPSession(page);
a = await ev(() => ctr('[data-sk-rk="kurs"][data-sk-id="Varmtvannsbereder"]')); b = await ev(() => ctr('[data-sk-rk="kurs"][data-sk-id="Kjøkken"]'));
await ev(() => { window.__tm = 0; document.addEventListener('touchmove', () => { window.__tm++; }, { passive: true }); });
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: a.x, y: a.y }] });
await wait(480);
for (let i = 1; i <= 8; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: a.x, y: a.y + ((b.y - a.y) * i) / 8 }] }); await wait(20); }
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await wait(100);
const ordK = await ev(() => h.config.ord.kurs);
ci = await ev(() => cirs());
ok('touch: hold + dra kurs → ord.kurs lagret', Array.isArray(ordK) && ordK.indexOf('Varmtvannsbereder') === 2 && ci[2].l === 'Varmtvannsbereder', { ordK, ci: ci.map((x) => x.l) });
ok('touch: touchmove stoppes (når ikke dokumentet) under dra', await ev(() => window.__tm === 0));
ok('ord.cat beholdt ved lagring av ord.kurs', JSON.stringify(await ev(() => h.config.ord.cat)) === JSON.stringify(ordCat));

/* ---- seksjoner (ord['sec-Kurser'] + hid) */
await ev(() => { h.setCfg({ ord: { ...h.config.ord, 'sec-Kurser': ['k_kurs', 'k_total', 'k_kat'] }, hid: { k_total: true } }); });
ok('seksjonsrekkefølge (CSS order) og hid', await ev(() => { const s = (id) => T().querySelector(`[data-rid="${id}"]`); return s('k_kurs').style.order === '1' && s('k_total').style.order === '2' && getComputedStyle(s('k_total')).display === 'none'; }));
await ev(() => { h.setCfg({ ord: { ...h.config.ord, 'sec-Kurser': undefined }, hid: {} }); });

/* ---- editor */
await ev(() => mk({ anim: true }));
await wait(50);
const E = (sel) => ev((s) => { const e = sr.getElementById('ed').querySelector(s); if (!e) return false; e.click(); return true; }, sel);
const ED = () => sr_ed();
await ev(() => { window.sr_ed = () => sr.getElementById('ed'); window.typeIn = (sel, v) => { const i = sr_ed().querySelector(sel); i.focus(); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); return true; }; });
ok('editor: info, Pris og totaler (6 felt + 3 valg), 2 grupper, knapper', await ev(() => { const e = sr_ed(); return /samme oppsett som ki-energi-card-strom/.test(e.querySelector('.sk-kinfo').textContent) && e.querySelectorAll('.sk-kcard > .sk-kfl input').length === 6 && e.querySelectorAll('.sk-keseg').length === 3 && e.querySelectorAll('.sk-kegrp').length === 2 && /Vis YAML/.test(e.textContent) && /Tilbakestill kurser/.test(e.textContent) && /Legg til gruppe/.test(e.textContent); }));
await E('[data-sk-e="adv"]');
console.log(await ev(() => JSON.stringify({ ed: h.__skEd, n: sr_ed().querySelectorAll('[data-sk-f]').length, adv: sr_ed().querySelector('.sk-kadvb').outerHTML.slice(0, 200) })));
ok('Avansert åpner status/laster/logg/tau/bereder', await ev(() => ['status', 'laster', 'logg', 'tau', 'bereder'].every((k) => sr_ed().querySelector(`[data-sk-f="${k}"]`))));
// rediger navn på første kategori → visningen oppdateres live
await E('[data-sk-e="edit"][data-sk-p="0.0"]');
ok('blyant åpner redigeringspanel (navn, ikon, farger, 4 entiteter)', await ev(() => { const p = sr_ed().querySelector('.sk-kepn'); return p && p.querySelectorAll('.sk-kcol').length === 11 && ['cost_daily', 'cost_monthly', 'energy_daily', 'energy_monthly'].every((f) => p.querySelector(`[data-sk-nf="${f}"]`)); }));
await ev(() => typeIn('[data-sk-nf="name"][data-sk-p="0.0"]', 'Varme'));
ok('endre navn → flis heter «Varme» (live) og onChange lagret kurs', (await ev(() => tiles()))[0].l === 'Varme' && await ev(() => h.config.kurs.groups[0].items[0].name === 'Varme'));
ok('fokusert felt beholdes ved live-oppdatering', await ev(() => sr.activeElement && sr.activeElement.dataset.skNf === 'name'));
await E('[data-sk-e="color"][data-sk-p="0.0"][data-sk-v="blue"]');
ok('farge → var(--blue) i config og på flisen', await ev(() => h.config.kurs.groups[0].items[0].color === 'var(--blue)' && /--c:var\(--blue/.test(T().querySelector('.sk-ktile').getAttribute('style'))));
await E('[data-sk-e="color"][data-sk-p="0.0"][data-sk-v=""]');
ok('Arv fjerner farge', await ev(() => !('color' in h.config.kurs.groups[0].items[0])));
await ev(() => typeIn('[data-sk-nf="cost_daily"][data-sk-p="0.0"]', 'sensor.um_daily_cost_kjokken_kurs'));
ok('entitet endret → ny verdi i flisen', (await ev(() => tiles()))[0].v === '18,2 kr');
await E('[data-sk-e="down"][data-sk-p="0.0"]');
ok('flytt ned → rekkefølge i config og fliser', await ev(() => h.config.kurs.groups[0].items[1].name === 'Varme') && (await ev(() => tiles()))[1].l === 'Varme');
await E('[data-sk-e="up"][data-sk-p="0.1"]');
ok('flytt opp', await ev(() => h.config.kurs.groups[0].items[0].name === 'Varme'));
await E('[data-sk-e="toggle"][data-sk-p="0.0"]');
ok('åpne underpunkter (nivå 2)', await ev(() => !!sr_ed().querySelector('[data-sk-e="edit"][data-sk-p="0.0.0"]')));
await E('[data-sk-e="toggle"][data-sk-p="0.0.0"]');
ok('nivå 3', await ev(() => !!sr_ed().querySelector('[data-sk-e="edit"][data-sk-p="0.0.0.0"]')));
await E('[data-sk-e="edit"][data-sk-p="0.1"]');
await E('[data-sk-e="addChild"][data-sk-p="0.1"]');
ok('legg til underpunkt (Belysning) → redigeres, flis får fordeling', await ev(() => h.config.kurs.groups[0].items[1].children.length === 1 && !!sr_ed().querySelector('[data-sk-nf="name"][data-sk-p="0.1.0"]')));
await E('[data-sk-e="del"][data-sk-p="0.1.0"]');
ok('slett underpunkt', await ev(() => h.config.kurs.groups[0].items[1].children.length === 0));
await E('[data-sk-e="add"][data-sk-g="0"]');
ok('legg til punkt → ny flis «Nytt punkt»', (await ev(() => tiles())).some((x) => x.l === 'Nytt punkt') && await ev(() => !!sr_ed().querySelector('[data-sk-nf="name"][data-sk-p="0.4"]')));
await E('[data-sk-e="del"][data-sk-p="0.4"]');
ok('slett punkt → flisen borte', !(await ev(() => tiles())).some((x) => x.l === 'Nytt punkt'));
await E('[data-sk-e="seg"][data-sk-k="default_unit"][data-sk-v="kwh"]');
ok('standardvalg: default_unit = kwh', await ev(() => h.config.kurs.default_unit === 'kwh'));
await ev(() => typeIn('[data-sk-f="totals.cost_daily"]', 'sensor.um_daily_cost_stue_kurs'));
ok('felt i nøstet objekt (totals.cost_daily)', await ev(() => h.config.kurs.totals.cost_daily === 'sensor.um_daily_cost_stue_kurs'));
await E('[data-sk-e="addGroup"]');
await ev(() => typeIn('[data-sk-gf="title"][data-sk-g="2"]', 'Ute'));
ok('legg til gruppe + gruppenavn → egen liste i Kurser-fanen', await ev(() => h.config.kurs.groups.length === 3 && [...T().querySelectorAll('.sk-kht')].some((x) => x.textContent === 'Ute')));
await E('[data-sk-e="gup"][data-sk-g="2"]');
ok('flytt gruppe opp', await ev(() => h.config.kurs.groups[1].title === 'Ute'));
await E('[data-sk-e="gdel"][data-sk-g="1"]');
ok('slett gruppe', await ev(() => h.config.kurs.groups.length === 2 && h.config.kurs.groups[1].title === 'Kurser'));
await E('[data-sk-e="edit"][data-sk-p="1.1"]');
await ev(() => typeIn('[data-sk-nf="amp"][data-sk-p="1.1"]', '10'));
await ev(() => typeIn('[data-sk-nf="fuse"][data-sk-p="1.1"]', 'K9'));
ci = await ev(() => cirs());
ok('sikringsskap-felt (fuse/amp) → K9 og 2,3 kW kapasitet', ci.find((c) => c.l === 'Stue').k === 'K9' && /\/ 2,3 kW$/.test(ci.find((c) => c.l === 'Stue').load), ci);

/* ---- YAML */
await E('[data-sk-e="yaml"]');
const y = await ev(() => { const pre = sr_ed().querySelector('[data-sk-yaml]'); const txt = pre.textContent; let parsed = null, err = null; try { parsed = MSH.yaml.parse(txt); } catch (e) { err = e.message; } return { txt, parsed, err, src: h.config.kurs, label: /Skjul YAML/.test(sr_ed().textContent) }; });
const strip = (o) => JSON.parse(JSON.stringify(o, (k, v) => (v === '' || v === null ? undefined : v)));
ok('Vis YAML → <pre> (knappen heter Skjul YAML)', !!y.txt && y.label);
ok('YAML parser (MSH.yaml.parse)', !y.err && y.parsed && y.parsed.type === 'custom:ki-energi-card-strom', y.err || y.txt.slice(0, 300));
ok('YAML rundtur = kurs-config (skjemaet bevart)', y.parsed && JSON.stringify({ ...y.parsed, type: undefined }) === JSON.stringify({ ...strip(y.src), type: undefined }), { a: y.parsed && y.parsed.groups[1], b: y.src.groups[1] });
const yk = await ev(() => { const txt = MSH.stromKurser.toYaml(null); const p = MSH.yaml.parse(txt); const K = MSH.stromKurser.KDEF; return { ok: JSON.stringify({ ...p, type: undefined }) === JSON.stringify(K), n: p.groups[0].items[0].children[0].children.length, txt: txt.slice(0, 400), quoted: /color: (var\(--red\)|'var\(--red\)'|"var\(--red\)")/.test(txt) }; });
ok('toYaml(KDEF) rundtur (alle nivåer)', yk.ok && yk.n === 5 && yk.quoted, yk);
// reserve-emitter (designets kYaml) – også gyldig
const yf = await ev(() => { const keep = MSH.yaml; const dump = keep.dump; keep.dump = () => { throw new Error('x'); }; let r; try { const txt = MSH.stromKurser.toYaml(h.config.kurs); const p = keep.parse(txt); r = JSON.stringify({ ...p, type: undefined }) === JSON.stringify({ ...JSON.parse(JSON.stringify(h.config.kurs, (k, v) => (v === '' || v === null ? undefined : v))), type: undefined }); } catch (e) { r = e.message; } keep.dump = dump; return r; });
ok('reserve-YAML (kYaml) gir samme rundtur', yf === true, yf);

/* ---- Tilbakestill */
await E('[data-sk-e="reset"]');
ok('Tilbakestill kurser → onChange(null) og visningen = KDEF', await ev(() => h.config.kurs === null) && (await ev(() => tiles())).map((x) => x.l).join('|') === 'Oppvarming|Belysning|Hvitvarer|Data og nettverk');
ok('norm(null/ugyldig) = KDEF-kopi', await ev(() => { const K = MSH.stromKurser; const a = K.norm(null), b = K.norm({ title: 'x' }); return a !== K.KDEF && JSON.stringify(a) === JSON.stringify(K.KDEF) && JSON.stringify(b) === JSON.stringify(K.KDEF); }));

/* ---- lys modus: ingen hardkodet lys tekst på flisene */
const p2 = await setup('light');
await p2.evaluate(() => mk());
await p2.waitForTimeout(80);
const lt = await p2.evaluate(() => { const t = sr.getElementById('tab'); const c = (s) => getComputedStyle(t.querySelector(s)).color; const bg = (s) => getComputedStyle(t.querySelector(s)).backgroundColor; return { tile: bg('.sk-ktile:not(.on)'), ttxt: c('.sk-ktile:not(.on)'), ink: c('.sk-ktot'), box: bg('.sk-kbox') }; });
ok('lys modus: fliser/bokser lyse, tekst mørk, mørk tekst på rosa', lt.tile === 'rgb(255, 255, 255)' && lt.box === 'rgb(255, 255, 255)' && lt.ttxt === 'rgb(28, 28, 28)' && /rgb\(42, 23, 32\)/.test(lt.ink), lt);

ok('ingen sidefeil', errs.length === 0, errs);
await browser.close();
try { unlinkSync(bundle); } catch (e) { /* */ }
console.log(fails ? `\n${fails} feil` : '\nAlle sjekker OK');
process.exit(fails ? 1 : 0);
