// Fiks 47 S / S.2 / U · Strømregning og Norgespris med kildene fra det gamle ki-strom-detaljer-card (M.stromRegning,
// src/60-strom-regning.js + src/63-strom-sider.js). Mock med brukerens sensorer: sensor.manedlig_forbruk_* (Strømkalkulator),
// ki_enhetsforbruk-oversikten (dager[]/poster/energi/maneder, tjenesten historikk), sensor.nettleie_elvia_*,
// input_number.fastledd_<måned>, sensor.norgespris_besparelse_* og powercalc-kostnadene (_2 spot / _3 Norgespris).
//   node test/strom47-sider-check.mjs
import { createRequire } from 'node:module';
import { mkdirSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/strom47s-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
let fails = 0;
const ok = (name, cond, info) => { if (!cond) fails++; console.log(`${cond ? '✔' : '✘'} ${name}${info != null && !cond ? ' · ' + JSON.stringify(info).slice(0, 900) : ''}`); };
const errs = [];

async function open(opts = {}) {
  const p = await b.newPage({ viewport: { width: opts.w || 400, height: 900 }, hasTouch: true });
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); if (m.type() === 'info' && /ki-msh strøm/.test(m.text())) p.__info.push(m.text()); });
  p.__info = [];
  await p.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#282828;color:#fafafa;font-family:system-ui}</style></head><body></body></html>`);
  await p.addScriptTag({ content: `customElements.define('ha-icon', class extends HTMLElement { connectedCallback(){ if(!this.shadowRoot) this.attachShadow({mode:'open'}).innerHTML='<span style="display:block;width:100%;height:100%;background:currentColor;opacity:.35"></span>'; } });` });
  await p.addScriptTag({ path: bundle });
  await p.evaluate((o) => {
    if (o.debug) window.KI_STROM_DEBUG = true;
    const now = new Date(), HR = 3600000, S = {};
    const add = (id, state, attrs) => { S[id] = { entity_id: id, state: String(state), attributes: { friendly_name: id, ...attrs }, last_updated: now.toISOString(), last_changed: now.toISOString(), context: {} }; };
    const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const d0 = new Date(now); d0.setHours(0, 0, 0, 0);
    // Spotpris i dag: dyr formiddag (> Norgespris 0,80), billig natt/kveld (< 0,80)
    const spot = (h) => (h >= 7 && h <= 11 ? 1.6 : h >= 17 && h <= 19 ? 1.1 : 0.4);
    add('sensor.strommaler_effekt', 2400, { unit_of_measurement: 'W', device_class: 'power' });
    add('sensor.totalpris_strom', spot(now.getHours()), { unit_of_measurement: 'NOK/kWh', raw_today: Array.from({ length: 24 }, (_, h) => ({ start: new Date(d0.getTime() + h * HR).toISOString(), value: spot(h) })) });
    add('sensor.norgespris_pris_na', 0.8, { unit_of_measurement: 'NOK/kWh' });
    add('input_boolean.include_moms', 'on', {});
    if (!o.noSources) {
      // Strømkalkulator (måneden)
      const P = 'sensor.manedlig_forbruk_';
      add(P + 'estimert_manedskostnad', 687.4, { unit_of_measurement: 'kr' }); add(P + 'akkumulert_stromkostnad', 100.4, { unit_of_measurement: 'kr' });
      add(P + 'dagens_kostnad', 42.2, { unit_of_measurement: 'kr' }); add(P + 'manedlig_nettleie_total', 56.3, { unit_of_measurement: 'kr' });
      add(P + 'manedlig_avgifter', 9.2, { unit_of_measurement: 'kr' }); add(P + 'manedlig_stromstotte', 0, { unit_of_measurement: 'kr' });
      add(P + 'norgespris_kompensasjon', 22.6, { unit_of_measurement: 'kr' }); add(P + 'norgespris_besparelse', 22.6, { unit_of_measurement: 'kr' });
      add(P + 'manedlig_forbruk_totalt', 87.1, { unit_of_measurement: 'kWh' }); add(P + 'manedlig_forbruk_dagtariff', 35.7, { unit_of_measurement: 'kWh' }); add(P + 'manedlig_forbruk_natt_helg', 51.4, { unit_of_measurement: 'kWh' });
      // ki_enhetsforbruk: oversikten (ID følger navnet brukeren ga regningen – finnes på attributtene)
      const dager = [];
      for (let i = 45; i >= 0; i--) {
        const d = new Date(d0); d.setDate(d.getDate() - i);
        const k = 10 + (i % 5), n = 6 + (i % 3), a = 1.5, np = -(2 + (i % 4)), sum = k + n + a + np;
        const helg = d.getDay() % 6 === 0;
        const ed = helg ? 0 : 7 + (i % 3), en = helg ? 18 : 9;
        const timer = i === 0 ? Array.from({ length: now.getHours() + 1 }, (_, h) => (h >= 7 && h <= 9 ? 2.5 : 0.8)) : undefined;
        dager.push({ dato: iso(d), sum, poster: { kostnad: k, nettleie: n, avgifter: a, stromstotte: 0, norgespris: np }, energi: { forbruk_dag: ed, forbruk_natt: en, forbruk_totalt: ed + en }, ...(timer ? { timer } : {}), ...(i === 0 ? { pagaende: true } : {}) });
      }
      const today = dager[dager.length - 1];
      const maneder = Array.from({ length: 12 }, (_, m) => (m > now.getMonth() ? { navn: ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember'][m], sum: null, fremtid: true } : { navn: ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember'][m], sum: 400 + m * 10, poster: { kostnad: 250 + m * 10, nettleie: 160, avgifter: 40, stromstotte: 0, norgespris: -50 }, energi: { forbruk_dag: 300, forbruk_natt: 450, forbruk_totalt: 750 }, ...(m === now.getMonth() ? { pagaende: true } : {}) }));
      const mon = new Date(d0); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
      window.__exp = { today, week: dager.filter((x) => x.dato >= iso(mon)), maneder };
      add('sensor.stromregning_hjemme', today.sum, { integrasjon: 'ki_enhetsforbruk', type: 'regning', unit_of_measurement: 'kr', i_dag: today.sum + 5, poster_i_dag: today.poster, dagens_energikostnad: today.poster.kostnad, denne_uken: 99, i_ar: 4321, i_fjor: 5100, ar: now.getFullYear(), dager, maneder });
      // Elvia effekttrinn + effektledd per måned
      const E = 'sensor.nettleie_elvia_';
      add(E + 'snitt_toppforbruk', 3.86, { unit_of_measurement: 'kW' }); add(E + 'toppforbruk', 5.25, { unit_of_measurement: 'kW', tidspunkt: new Date(now.getFullYear(), now.getMonth(), 2, 18).toISOString() });
      add(E + 'toppforbruk_2', 3.64, { unit_of_measurement: 'kW' }); add(E + 'toppforbruk_3', 2.68, { unit_of_measurement: 'kW' });
      add(E + 'margin_til_neste_trinn', 1.14, { unit_of_measurement: 'kW' }); add(E + 'kapasitetstrinn_intervall', '2-5 kW', {});
      add('sensor.neste_effektledd_terskel', 5, { unit_of_measurement: 'kW', trinn: '5-10 kW', spenn: '5–10 kW', kostnad: 415 });
      ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober'].forEach((m, i) => add('input_number.fastledd_' + m, i < 4 ? 415 : 250, { unit_of_measurement: 'kr' }));
      // Norgespris: besparelse + powercalc (spot _2 / Norgespris _3)
      const C = 'sensor.strommaler_strommaler_powercalc_';
      add('sensor.norgespris_besparelse_time', 0.87, {}); add('sensor.norgespris_besparelse_dag', o.devDag ? 4.5 : -2.5, {}); add('sensor.norgespris_besparelse_uke', 10.2, {});
      add('sensor.norgespris_besparelse_maned', -35.2, {}); add('sensor.norgespris_besparelse_ar', 48, {}); // avvik 2 kr mot spot − NP (46) → debug-logg
      add(C + 'daily_energy_cost_2', 21.6, {}); add(C + 'daily_energy_cost_3', 24.1, {});
      add(C + 'weekly_energy_cost_2', 192, {}); add(C + 'weekly_energy_cost_3', 181.8, {});
      add(C + 'monthly_energy_cost_2', 46.1, {}); add(C + 'monthly_energy_cost_3', 81.3, {});
      add(C + 'yearly_energy_cost_2', 1420, {}); add(C + 'yearly_energy_cost_3', 1374, {});
    }
    window.__ws = []; window.__hp = []; window.__mi = [];
    document.addEventListener('hass-more-info', (e) => window.__mi.push(e.detail.entityId));
    const H = window.__hass = {
      states: S, entities: {}, devices: {}, areas: {}, services: {}, user: { id: 'u1', name: 'T' }, language: 'nb', locale: { language: 'nb' }, themes: { darkMode: true },
      callService: () => Promise.resolve(),
      callWS: (m) => {
        window.__ws.push(m);
        if (m.type === 'call_service' && m.domain === 'ki_enhetsforbruk' && m.service === 'historikk') {
          const [y, mo] = m.service_data.maned.split('-').map(Number);
          const dg = Array.from({ length: new Date(y, mo, 0).getDate() }, (_, i) => ({ dato: `${m.service_data.maned}-${String(i + 1).padStart(2, '0')}`, sum: 20 + i, poster: { kostnad: 12 + i, nettleie: 7, avgifter: 1, norgespris: 0 } }));
          return new Promise((r) => setTimeout(() => r({ response: { regninger: { 'sensor.stromregning_hjemme': { dager: dg } } } }), 30));
        }
        return Promise.resolve(m.type === 'recorder/statistics_during_period' ? {} : null);
      },
    };
    if (window.MSH.theme && window.MSH.theme.update) window.MSH.theme.update(H);
    const ROLES = { effekt: 'sensor.strommaler_effekt', spot: 'sensor.totalpris_strom', norge: 'sensor.norgespris_pris_na', dag: null, maned: null, spart: null, forbruk: null };
    class Host extends HTMLElement {
      constructor() { super(); this.root = this.attachShadow({ mode: 'open' }); this.ui = {}; this.config = {}; this.anim = false; this.page = o.page || 'stromregning'; this.hass = H; }
      ent(r) { return ROLES[r] || null; }
      setCfg(p) { this.config = { ...this.config, ...p }; this.render(); }
      go(p) { this.page = p; this.render(); }
      haptic(t) { window.__hp.push(t); }
      render() {
        if (!this.page) { this.root.innerHTML = '<div id="main">hoved</div>'; return; }
        const M = window.MSH;
        this.root.innerHTML = `<style>${M.BASE_CSS || ''}${M.stromSider.css}</style><div id="c" style="padding:14px">${M.stromSider.html(this, this.page)}</div>`;
        M.stromSider.bind(this, this.root.getElementById('c'), this.page);
      }
    }
    customElements.define('ss-test-host', Host);
    const h = document.createElement('ss-test-host');
    document.body.appendChild(h);
    window.__h = h; window.__R = h.root;
    h.render();
  }, opts);
  await p.waitForTimeout(150);
  return p;
}
const q = (p, sel) => p.evaluate((s) => { const e = window.__R.querySelector(s); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; }, sel);
const tap = async (p, sel) => { await p.evaluate((s) => window.__R.querySelector(s).click(), sel); await p.waitForTimeout(60); };
const rows = (p) => p.evaluate(() => { const n = (t) => { const x = t.replace(/[\s ]|kr/g, '').replace('−', '-'); return x === '–' ? null : Number(x); }; return Object.fromEntries([...window.__R.querySelectorAll('.ss-part')].map((r) => [r.dataset.ssPart, n(r.querySelector('.ss-part-v').textContent)])); });
const total = (p) => p.evaluate(() => { const t = window.__R.querySelector('.ss-bill-big').textContent.replace(/[\s ]/g, '').replace('−', '-'); return t === '–' ? null : Number(t); });
const sumOf = (r) => Object.values(r).reduce((t, v) => t + (v || 0), 0);
// Segmenter: like brede knapper, sentrert tekst, aktiv pille med ≥ 3,5 px luft til sporet
const segCheck = (p, sel) => p.evaluate((s) => {
  const tr = window.__R.querySelector(s); if (!tr) return { err: 'mangler ' + s };
  const R = tr.getBoundingClientRect(), bs = [...tr.querySelectorAll('.ki-seg-b')].map((x) => ({ r: x.getBoundingClientRect(), cs: getComputedStyle(x), on: x.classList.contains('on'), t: x.querySelector('span').getBoundingClientRect() }));
  const w = bs.map((x) => x.r.width), on = bs.find((x) => x.on);
  const centered = bs.every((x) => x.cs.justifyContent === 'center' && x.cs.alignItems === 'center' && Math.abs((x.t.left + x.t.width / 2) - (x.r.left + x.r.width / 2)) < 1.5);
  return { n: bs.length, eq: Math.max(...w) - Math.min(...w) < 1, centered, inset: on ? Math.min(on.r.left - R.left, R.right - on.r.right, on.r.top - R.top, R.bottom - on.r.bottom) : null, w };
}, sel);

// ------------------------------------------------------------------ Strømregning · Måned (Strømkalkulator)
{
  const p = await open({});
  ok('M.stromRegning finnes med STANDARD-nøklene fra ki-strom-detaljer-card', await p.evaluate(() => { const R = window.MSH.stromRegning; return !!R && ['estimat', 'akkumulert', 'idag', 'nettleie', 'avgifter', 'stromstotte', 'kompensasjon', 'besparelse_mnd', 'forbruk_totalt', 'forbruk_dag', 'forbruk_natt', 'snitt', 'topp1', 'topp2', 'topp3', 'margin', 'terskel', 'trinn', 'maned_prefiks', 'spart_time', 'spart_dag', 'spart_uke', 'spart_maned', 'spart_ar', 'spot_dag', 'np_dag', 'spot_ar', 'np_ar', 'regning'].every((k) => k in R.STANDARD); }));
  ok('oversikten finnes på attributtene (ikke gjettet)', (await p.evaluate(() => window.MSH.stromRegning.regningId(window.__hass, window.MSH.stromRegning.sensors({})))) === 'sensor.stromregning_hjemme');
  const r = await rows(p), t = await total(p);
  ok('Måned: rader fra Strømkalkulator (Strøm 100 · Nettleie 56 · Avgifter 9 · Norgespris −23)', r.Strøm === 100 && r.Nettleie === 56 && r.Avgifter === 9 && r.Norgespris === -23, r);
  ok('Måned: total = summen av radene', t != null && Math.abs(t - sumOf(r)) <= 2 && Math.abs(t - (100.4 + 56.3 + 9.2 - 22.6)) < 1, [t, r]);
  ok('Nettleie og Avgifter ikke 0', r.Nettleie > 0 && r.Avgifter > 0);
  ok('Avgifter: «moms 25 %» (moms-bryteren på), aldri 0 %', /moms 25 %/.test(await q(p, '[data-ss-part="Avgifter"] .ss-part-s')) && !/ 0 %/.test(await q(p, '.ss-parts')), await q(p, '[data-ss-part="Avgifter"] .ss-part-s'));
  ok('undertekst: anslag for hele måneden + i dag', /hele måneden anslått 687 kr/.test(await q(p, '.ss-bill-sub')) && /i dag 42 kr/.test(await q(p, '.ss-bill-sub')), await q(p, '.ss-bill-sub'));
  ok('Norgespris-raden grønn (fratrekk) og spart-linje med samme beløp', await p.evaluate(() => window.__R.querySelector('[data-ss-part="Norgespris"] .ss-part-v').classList.contains('neg')) && /^Norgespris har spart deg 23 kr denne måneden$/.test(await q(p, '.ss-saved')), await q(p, '.ss-saved'));
  const icons = await p.evaluate(() => [...window.__R.querySelectorAll('.ss-part')].map((x) => { const c = x.querySelector('.ss-part-ic'), r = c.getBoundingClientRect(), i = c.querySelector('ha-icon'); return [x.dataset.ssPart, i && i.getAttribute('icon'), Math.round(r.width), Math.round(r.height), getComputedStyle(c).backgroundColor]; }));
  ok('ikoner: bolt / transmission-tower / bank / piggy-bank i 40×40 tonede sirkler', JSON.stringify(icons.map((x) => x[1])) === JSON.stringify(['mdi:lightning-bolt', 'mdi:transmission-tower', 'mdi:bank', 'mdi:piggy-bank']) && icons.every((x) => x[2] === 40 && x[3] === 40 && !/rgba\(0, 0, 0, 0\)/.test(x[4])), icons);
  ok('dag/natt fra Strømkalkulator: «Dag 35,7 kWh · 41 %» / «Natt/helg 51,4 kWh · 59 %»', /Dag 35,7 kWh · 41 %/.test(await q(p, '.ss-dn-l')) && /Natt\/helg 51,4 kWh · 59 %/.test(await q(p, '.ss-dn-l')) && /87,1 kWh/.test(await q(p, '.ss-v17')), await q(p, '.ss-dn-l'));
  ok('ingen statistikk hentet når alle kildene finnes (Måned)', await p.evaluate(() => window.__ws.filter((m) => m.type === 'recorder/statistics_during_period').length === 0), await p.evaluate(() => window.__ws.map((m) => m.type)));
  // fordelingsstripe → forklaring (som Q)
  ok('stripe: 3 deler i ikonfargene', await p.evaluate(() => window.__R.querySelectorAll('.ss-stripe .ss-sg').length === 3));
  await p.evaluate(() => { const b = window.__R.querySelector('.ss-stripe'), r = b.getBoundingClientRect(); b.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, clientX: r.left + 2, clientY: r.top - 8 })); }); await p.waitForTimeout(60);
  ok('trykk på baren åpner forklaringen (navn + %)', await p.evaluate(() => [...window.__R.querySelectorAll('.ss-leg-r')].map((x) => [...x.children].map((c) => c.textContent).join(' ').trim()).join('|')) === 'Strøm 61 %|Nettleie 34 %|Avgifter 6 %', await p.evaluate(() => [...window.__R.querySelectorAll('.ss-leg-r')].map((x) => x.textContent)));
  await tap(p, '.ss-leg-r:nth-child(2)');
  ok('valgt del: undertekst «Nettleie står for 34 % av regningen · 56 kr», andre dempet', (await q(p, '.ss-bill-sub')) === 'Nettleie står for 34 % av regningen · 56 kr' && await p.evaluate(() => window.__R.querySelectorAll('.ss-sg.dim').length === 2), await q(p, '.ss-bill-sub'));
  await tap(p, '.ss-leg-r:nth-child(2)');
  ok('trykk igjen fjerner valget', /anslått/.test(await q(p, '.ss-bill-sub')));
  // more-info
  await tap(p, '[data-ss-part="Nettleie"]');
  ok('trykk på Nettleie → more-info manedlig_nettleie_total', (await p.evaluate(() => window.__mi.at(-1))) === 'sensor.manedlig_forbruk_manedlig_nettleie_total', await p.evaluate(() => window.__mi));
  await tap(p, '.ss-bill-sub [data-ss-mer]');
  ok('trykk på anslaget → more-info estimert_manedskostnad', (await p.evaluate(() => window.__mi.at(-1))) === 'sensor.manedlig_forbruk_estimert_manedskostnad');
  ok('én haptic per trykk', await p.evaluate(() => window.__hp.length) === 5, await p.evaluate(() => window.__hp));
  // effekttrinn + effektledd fra sensorene
  ok('effekttrinn fra Elvia: snitt 3,86 · trinn 2–5 på · topper 5,25 / 3,64 / 2,68', /3,86 kW/.test(await q(p, '.ss-p-stromregning .ss-card:nth-last-child(2) .ss-sm')) && (await q(p, '.ss-step-l.on')) === '2–5' && /#1 · 2\. \w+ ?5,25 kW/.test(await q(p, '.ss-peaks')) && /3,64 kW/.test(await q(p, '.ss-peaks')) && /1,1 kW margin/.test(await q(p, '.ss-step-t')), [await q(p, '.ss-peaks'), await q(p, '.ss-step-t')]);
  await tap(p, '.ss-peak');
  ok('trykk på topp → more-info toppforbruk', (await p.evaluate(() => window.__mi.at(-1))) === 'sensor.nettleie_elvia_toppforbruk');
  ok('effektledd fra input_number.fastledd_*: «i år … kr»', /^i år [\d\s ]+ kr$/.test(await q(p, '.ss-p-stromregning .ss-card:last-child .ss-sm')) && (await q(p, '.ss-eff-v')) === (new Date().getMonth() < 4 ? '415' : new Date().getMonth() < 10 ? '250' : '–'), [await q(p, '.ss-p-stromregning .ss-card:last-child .ss-sm'), await q(p, '.ss-eff-v')]);
  // segment
  const sg = await segCheck(p, '.ss-seg-b');
  ok('Dag|Uke|Måned|År: like brede, sentrert, aktiv pille med 4 px luft', sg.n === 4 && sg.eq && sg.centered && sg.inset >= 3.5, sg);
  ok('kalenderikon ved siden av periodevelgeren', await p.evaluate(() => { const k = window.__R.querySelector('.ss-perrow > .ss-kal'), s = window.__R.querySelector('.ss-perrow > .ki-seg'); return !!k && !!s && k.getBoundingClientRect().left > s.getBoundingClientRect().right; }));
  // ---- Dag
  await tap(p, '.ss-seg-b .ki-seg-b:nth-child(1)');
  const rd = await rows(p), td = await total(p), E = await p.evaluate(() => window.__exp);
  ok('Dag: rader fra poster_i_dag', rd.Strøm === Math.round(E.today.poster.kostnad) && rd.Nettleie === Math.round(E.today.poster.nettleie) && rd.Avgifter === Math.round(E.today.poster.avgifter) && rd.Norgespris === Math.round(E.today.poster.norgespris), [rd, E.today.poster]);
  ok('Dag: total = summen av radene (ikke i_dag-attributtet)', Math.abs(td - (E.today.poster.kostnad + E.today.poster.nettleie + E.today.poster.avgifter + E.today.poster.norgespris)) < 1, [td]);
  const wk = new Date().getDay() % 6 === 0;
  ok(wk ? 'Dag i helg: «Helg – lavere sats hele døgnet»' : 'Dag: dag/natt fra energi', wk ? /Helg – lavere sats hele døgnet/.test(await q(p, '.ss-dn-l')) : /Dag [\d,]+ kWh · \d+ %/.test(await q(p, '.ss-dn-l')), await q(p, '.ss-dn-l'));
  ok('Dag: 14 søyler', await p.evaluate(() => window.__R.querySelectorAll('.ss-bc').length === 14));
  await tap(p, '.ss-bc:nth-child(13)');
  const rsel = await rows(p);
  ok('trykk på søyle → hele blokka viser døgnet («trykk igjen»)', (await q(p, '.ss-est')) === 'trykk igjen' && /^Strømregning · \S+dag/.test(await q(p, '.ss-bill-p')) && Math.abs((await total(p)) - sumOf(rsel)) <= 2, [await q(p, '.ss-bill-p'), rsel]);
  await tap(p, '.ss-bc:nth-child(13)');
  ok('trykk igjen → tilbake til perioden', (await q(p, '.ss-est')) === 'hittil' && /· i dag$/.test(await q(p, '.ss-bill-p')));
  // ---- Uke
  await tap(p, '.ss-seg-b .ki-seg-b:nth-child(2)');
  const ru = await rows(p), tu = await total(p);
  const expU = E.week.reduce((t, d) => t + d.poster.kostnad + d.poster.nettleie + d.poster.avgifter + d.poster.norgespris, 0);
  ok('Uke: postene summert fra mandag, total = summen av radene', Math.abs(tu - expU) < 1 && Math.abs(tu - sumOf(ru)) <= 2 && /uke \d+/.test(await q(p, '.ss-bill-p')), [tu, expU, ru]);
  // ---- År
  await tap(p, '.ss-seg-b .ki-seg-b:nth-child(4)');
  const ra = await rows(p), ta = await total(p);
  const expA = E.maneder.filter((m) => m.poster).reduce((t, m) => t + m.poster.kostnad + m.poster.nettleie + m.poster.avgifter + m.poster.norgespris, 0);
  ok('År: postene summert over månedene, 12 søyler', Math.abs(ta - expA) < 1 && Math.abs(ta - sumOf(ra)) <= 3 && await p.evaluate(() => window.__R.querySelectorAll('.ss-bc').length === 12), [ta, expA]);
  ok('År: dag/natt fra energi (40 %)', /Dag [\d\s ,]+ kWh · 40 %/.test(await q(p, '.ss-dn-l')), await q(p, '.ss-dn-l'));
  // ---- Kalender
  await tap(p, '.ss-kal');
  ok('kalender: varmekart med 42 ruter, ingen aktiv periode', await p.evaluate(() => window.__R.querySelectorAll('.ss-cd').length === 42 && !window.__R.querySelector('.ss-seg-b .ki-seg-b.on') && window.__R.querySelector('.ss-kal.on')));
  ok('kalender: total = summen av radene for måneden', Math.abs((await total(p)) - sumOf(await rows(p))) <= 2);
  await tap(p, '[data-ss-act="bla:-1"]'); await tap(p, '[data-ss-act="bla:-1"]'); await tap(p, '[data-ss-act="bla:-1"]');
  await p.waitForTimeout(150);
  const svc = await p.evaluate(() => window.__ws.filter((m) => m.type === 'call_service'));
  ok('eldre måned: ki_enhetsforbruk.historikk med return_response', svc.length >= 1 && svc.every((m) => m.domain === 'ki_enhetsforbruk' && m.service === 'historikk' && m.return_response === true && /^\d{4}-\d{2}$/.test(m.service_data.maned)), svc);
  ok('eldre måned: døgnene fylles fra tjenesten', await p.evaluate(() => window.__R.querySelectorAll('.ss-cd[data-ss-act^="kdag:"]').length >= 28), await q(p, '.ss-cal .ss-sm'));
  const before = svc.length;
  await tap(p, '[data-ss-act="bla:1"]'); await tap(p, '[data-ss-act="bla:-1"]'); await p.waitForTimeout(80);
  ok('tjenestesvaret mellomlagres (ingen ny henting)', (await p.evaluate(() => window.__ws.filter((m) => m.type === 'call_service').length)) === before + 1 || (await p.evaluate(() => window.__ws.filter((m) => m.type === 'call_service').length)) === before, await p.evaluate(() => window.__ws.filter((m) => m.type === 'call_service').map((m) => m.service_data.maned)));
  await tap(p, '.ss-cd[data-ss-act^="kdag:"]');
  ok('trykk på dag i kalenderen → døgnets poster', (await q(p, '.ss-est')) === 'trykk igjen' && Math.abs((await total(p)) - sumOf(await rows(p))) <= 2);
  await tap(p, '.ss-seg-b .ki-seg-b:nth-child(3)');
  ok('periodevalg lukker kalenderen', !(await p.evaluate(() => window.__R.querySelector('.ss-cal'))));
  await p.screenshot({ path: 'test/.build/strom47s-regning.png', fullPage: true });
  await p.close();
}
// ------------------------------------------------------------------ Strømregning uten kilder → estimat, «–»
{
  const p = await open({ noSources: true });
  ok('uten kilder: Avgifter viser «moms 25 %», ikke 0 %', /moms 25 %/.test(await q(p, '[data-ss-part="Avgifter"] .ss-part-s')));
  ok('uten kilder og statistikk: total og rader «–»', (await q(p, '.ss-bill-big')) === '–' && (await rows(p)).Nettleie === null);
  ok('uten kilder: ingen more-info-flater', await p.evaluate(() => !window.__R.querySelector('.ss-parts [data-ss-mer]')));
  await p.close();
}
// ------------------------------------------------------------------ Norgespris (U)
{
  const p = await open({ page: 'norgespris', debug: true });
  const sg = await segCheck(p, '.ss-seg-n');
  ok('I dag|Uke|Måned|År: like brede, sentrert, 4 px luft', sg.n === 4 && sg.eq && sg.centered && sg.inset >= 3.5, sg);
  // Måned: spart-sensor −35,2 (tapt), spot 46,1 / Norgespris 81,3
  ok('Måned: tapt → rødt, «Tapt med Norgespris», −35,2', (await p.evaluate(() => window.__R.querySelector('[data-ss-hero]').dataset.ssHero)) === 'lost' && /^Tapt med Norgespris · denne måneden$/.test(await q(p, '.ss-nx-title')) && (await q(p, '.ss-nx-big')) === '−35,2', [await q(p, '.ss-nx-title'), await q(p, '.ss-nx-big')]);
  ok('merket = (NP − spot)/spot: «76 % dyrere»', (await q(p, '.ss-nx-chip')) === '76 % dyrere', await q(p, '.ss-nx-chip'));
  ok('undertekst ved tapt: «Spotpris var billigere enn 0,80 kr/kWh …», ikke grønn', /^Spotpris var billigere enn 0,80 kr\/kWh denne måneden$/.test(await q(p, '.ss-nx-sub')) && await p.evaluate(() => { const c = getComputedStyle(window.__R.querySelector('.ss-nx-sub')).color.match(/\d+/g).map(Number); return !(c[1] > c[0] + 15); }), await q(p, '.ss-nx-sub'));
  ok('Hva du hadde betalt: 46,1 / 81,3 kr', /46,1 kr/.test(await q(p, '.ss-cmp:nth-of-type(1)')) && /81,3 kr/.test(await q(p, '.ss-card .ss-cmp:last-child')), [await q(p, '.ss-card')]);
  await tap(p, '.ss-card .ss-cmp:last-child');
  ok('trykk på «Med Norgespris» → more-info powercalc _3', (await p.evaluate(() => window.__mi.at(-1))) === 'sensor.strommaler_strommaler_powercalc_monthly_energy_cost_3');
  await tap(p, '.ss-nx-title');
  ok('trykk på toppkortet → more-info besparelse_maned', (await p.evaluate(() => window.__mi.at(-1))) === 'sensor.norgespris_besparelse_maned');
  // fliser
  const tiles = await p.evaluate(() => [...window.__R.querySelectorAll('.ss-tile')].map((t) => [t.querySelector('.ss-tile-v').textContent, t.querySelector('.ss-tile-v').className, t.dataset.ssMer]));
  ok('fliser: «0,87 kr» grønn · «−2,5 kr» rød · «10 kr» grønn', tiles[0][0] === '0,87 kr' && /pos/.test(tiles[0][1]) && tiles[1][0] === '−2,5 kr' && /neg/.test(tiles[1][1]) && tiles[2][0] === '10 kr' && /pos/.test(tiles[2][1]), tiles);
  ok('fliser → more-info norgespris_besparelse_{time,dag,uke}', tiles.map((t) => t[2]).join() === 'sensor.norgespris_besparelse_time,sensor.norgespris_besparelse_dag,sensor.norgespris_besparelse_uke', tiles);
  ok('«Time for time»-summen har samme fortegn som I dag-flisen', /^tapt 2,5 kr i dag$/.test(await q(p, '.ss-hrs-sum')) && await p.evaluate(() => window.__R.querySelector('.ss-hrs-sum').classList.contains('neg')), await q(p, '.ss-hrs-sum'));
  // timesøyler: høyde ∝ |spot − 0,80| × kWh, grønn over / rød under, fremtid dempet
  const hb = await p.evaluate(() => [...window.__R.querySelectorAll('.ss-hcol')].map((c) => ({ up: parseFloat(c.querySelector('.ss-hup>span').style.height) || 0, dn: parseFloat(c.querySelector('.ss-hdn>span').style.height) || 0, fut: c.classList.contains('fut'), kr: c.dataset.kr })));
  const hN = new Date().getHours();
  const sp = (h) => (h >= 7 && h <= 11 ? 1.6 : h >= 17 && h <= 19 ? 1.1 : 0.4), kwh = (h) => (h >= 7 && h <= 9 ? 2.5 : 0.8);
  const expKr = Array.from({ length: hN + 1 }, (_, h) => (sp(h) - 0.8) * kwh(h));
  ok('fortiden: søyle = (spot − 0,80) × kWh fra dager[].timer (grønn opp når Norgespris billigst)', hb.slice(0, hN + 1).every((x, h) => Math.abs(Number(x.kr) - expKr[h]) < 1e-6 && (expKr[h] > 0 ? x.up > 0 && x.dn === 0 : x.dn > 0 && x.up === 0)), hb.slice(0, hN + 1));
  ok('høyder ulike (ikke alle like) og fremtidige timer dempet', new Set(hb.map((x) => Math.round(x.up + x.dn))).size > 2 && hb.slice(hN + 1).every((x) => x.fut), hb.map((x) => x.up - x.dn));
  const g = await p.evaluate(() => { const r = window.__R.querySelector('.ss-hrs').getBoundingClientRect(); return { x: r.left, y: r.top + r.height / 2, w: r.width }; });
  const th = Math.min(hN, 8);
  await p.mouse.click(g.x + g.w * ((th + 0.5) / 24), g.y); await p.waitForTimeout(60);
  ok('trykk på søyle → time, pris, kWh, spart', new RegExp(`^kl\\. ${String(th).padStart(2, '0')} · (spart|tapt) [\\d,]+ kr$`).test(await q(p, '.ss-hrs-sum')) && /^Spot [\d,]+ · Norgespris 0,80 kr\/kWh · [\d,]+ kWh$/.test(await q(p, '.ss-hdet')), [await q(p, '.ss-hrs-sum'), await q(p, '.ss-hdet')]);
  // perioder
  await tap(p, '.ss-seg-n .ki-seg-b:nth-child(4)');
  ok('År: spart 48 (sensoren foretrekkes) → grønn, «Spart», «3 % billigere», «Norgespris var billigere …»', (await p.evaluate(() => window.__R.querySelector('[data-ss-hero]').dataset.ssHero)) === 'won' && (await q(p, '.ss-nx-big')) === '48,0' && (await q(p, '.ss-nx-chip')) === '3 % billigere' && /^Norgespris var billigere enn spotpris i år$/.test(await q(p, '.ss-nx-sub')), [await q(p, '.ss-nx-big'), await q(p, '.ss-nx-chip'), await q(p, '.ss-nx-sub')]);
  await tap(p, '.ss-seg-n .ki-seg-b:nth-child(1)');
  ok('I dag: −2,5 (tapt) – samme fortegn som flisen', (await q(p, '.ss-nx-big')) === '−2,5' && (await p.evaluate(() => window.__R.querySelector('[data-ss-hero]').dataset.ssHero)) === 'lost');
  ok('debug-logg: avvik > 1 kr mellom spart-sensor og spot − NP logges bak flagget', p.__info.some((x) => /Avvik > 1 kr \(ar\)/.test(x)), p.__info);
  await p.screenshot({ path: 'test/.build/strom47s-norgespris.png', fullPage: true });
  await p.close();
}
{ // uten debug-flagget: ingen logg
  const p = await open({ page: 'norgespris' });
  ok('uten flagg: ingen kilde-logg', p.__info.length === 0, p.__info);
  await p.close();
}
{ // Norgespris uten kilder: fallback til statistikk/«–»
  const p = await open({ page: 'norgespris', noSources: true });
  ok('uten kilder: nøytralt toppkort «–», fliser «–»', (await q(p, '.ss-nx-big')) === '–' && await p.evaluate(() => [...window.__R.querySelectorAll('.ss-tile-v')].every((x) => x.textContent === '–')));
  await p.close();
}
{ // smal mobil: segmentene holder seg like brede og sentrert
  const p = await open({ w: 340 });
  const sg = await segCheck(p, '.ss-seg-b');
  ok('340 px: periodevelgeren like brede og sentrert', sg.eq && sg.centered && sg.inset >= 3.5, sg);
  ok('340 px: ingen horisontal overflyt', await p.evaluate(() => document.documentElement.scrollWidth <= 340));
  await p.close();
}

ok('ingen JS-feil', errs.length === 0, errs);
await b.close();
try { unlinkSync(bundle); } catch (e) { /* */ }
console.log(fails ? `\n${fails} feil` : '\nAlle sjekker OK');
process.exit(fails ? 1 : 0);
