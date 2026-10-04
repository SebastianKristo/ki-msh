// Del 45 §6 · Strøm-popup v3: undersidene Norgespris, Strømregning og Strøminnstillinger (src/63-strom-sider.js,
// M.stromSider = { css, html(host, page), bind(host, el, page) }). Stub-vert (custom element) med grensesnittet fra
// msh-strom-card og en hass-mock (spot/Norgespris/forbruk + recorder/statistics_during_period-stub).
//   node test/strom45-sider-check.mjs
import { createRequire } from 'node:module';
import { mkdirSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/strom45c-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
let fails = 0;
const ok = (name, cond, info) => { if (!cond) fails++; console.log(`${cond ? '✔' : '✘'} ${name}${info != null && !cond ? ' · ' + JSON.stringify(info).slice(0, 900) : ''}`); };
const errs = [];

// opts: { spot: kr/kWh for statistikken, light, withInput, noStats }
async function open(opts = {}) {
  const p = await b.newPage({ viewport: { width: 400, height: 900 }, hasTouch: true });
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await p.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#282828;color:#fafafa;font-family:system-ui}</style></head><body></body></html>`);
  await p.addScriptTag({ content: `customElements.define('ha-icon', class extends HTMLElement { connectedCallback(){ if(!this.shadowRoot) this.attachShadow({mode:'open'}).innerHTML='<span style="display:block;width:100%;height:100%;background:currentColor;opacity:.35"></span>'; } });` });
  await p.addScriptTag({ path: bundle });
  await p.evaluate((o) => {
    const now = new Date(), HR = 3600000;
    const S = {};
    const add = (id, state, attrs) => { S[id] = { entity_id: id, state: String(state), attributes: { friendly_name: id, ...attrs }, last_updated: now.toISOString(), last_changed: now.toISOString(), context: {} }; };
    const d0 = new Date(now); d0.setHours(0, 0, 0, 0);
    const today = Array.from({ length: 24 }, (_, h) => ({ start: new Date(d0.getTime() + h * HR).toISOString(), value: o.spot + (h % 2 ? 0.1 : -0.1) }));
    add('sensor.strommaler_effekt', 2400, { unit_of_measurement: 'W', device_class: 'power' });
    add('sensor.totalpris_strom', o.spot, { unit_of_measurement: 'NOK/kWh', raw_today: today, state_class: 'measurement' });
    add('sensor.norgespris_pris_na', 0.5, { unit_of_measurement: 'NOK/kWh' });
    add('sensor.forbruk_i_dag', (now.getHours() * 1.0 + 0.6).toFixed(2), { unit_of_measurement: 'kWh', device_class: 'energy', state_class: 'total_increasing' });
    add('sensor.kostnad_i_dag', 41.7, { unit_of_measurement: 'NOK', device_class: 'monetary' });
    add('sensor.regning_maned', 587.4, { unit_of_measurement: 'NOK', device_class: 'monetary' });
    if (o.withInput) add('input_number.nettleie_dag', 36.4, { unit_of_measurement: 'øre/kWh', min: 0, max: 200, step: 0.1, friendly_name: 'Nettleie dag' });
    window.__ws = []; window.__svc = []; window.__hp = []; window.__go = []; window.__set = [];
    const year0 = new Date(now.getFullYear(), 0, 1).getTime();
    const H = window.__hass = {
      states: S, entities: {}, devices: {}, areas: {}, services: {}, user: { id: 'u1', name: 'T' }, language: 'nb', locale: { language: 'nb' },
      themes: { darkMode: !o.light },
      callService: (d, s, data) => { window.__svc.push([d, s, data]); if (S[data.entity_id]) S[data.entity_id] = { ...S[data.entity_id], state: String(data.value) }; return Promise.resolve(); },
      callWS: (m) => {
        window.__ws.push(m);
        if (m.type !== 'recorder/statistics_during_period' || o.noStats) return Promise.resolve(m.type === 'recorder/statistics_during_period' ? {} : null);
        const out = {}, st = Date.parse(m.start_time), en = Math.min(Date.parse(m.end_time), Math.floor(now.getTime() / HR) * HR);
        for (const id of m.statistic_ids) {
          const L = [];
          for (let t = Math.max(st, year0 - 7 * 86400000); t < en; t += HR) {
            const d = new Date(t), h = d.getHours();
            if (id === 'sensor.forbruk_i_dag') L.push({ start: t, end: t + HR, change: d.getDate() === 1 && h === 18 ? 5.25 : d.getDate() === 2 && h === 19 ? 3.64 : 1.0 });
            else if (id === 'sensor.totalpris_strom') L.push({ start: t, end: t + HR, mean: o.spot + (h % 2 ? 0.1 : -0.1) });
            else if (id === 'sensor.norgespris_pris_na') L.push({ start: t, end: t + HR, mean: 0.5 });
          }
          // period day/month: timeradene samles (change = sum, mean = snitt) – som recorderen
          const bucket = (t) => { const d = new Date(t); return m.period === 'month' ? new Date(d.getFullYear(), d.getMonth(), 1).getTime() : m.period === 'day' ? new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() : t; };
          const B = new Map(); L.forEach((r) => { const k = bucket(r.start); const x = B.get(k) || { start: k, change: 0, mean: 0, n: 0 }; x.change += r.change || 0; x.mean += r.mean || 0; x.n++; B.set(k, x); });
          const R = [...B.values()].map((x) => (id === 'sensor.forbruk_i_dag' ? { start: x.start, change: x.change } : { start: x.start, mean: x.mean / x.n }));
          if (R.length) out[id] = R;
        }
        return Promise.resolve(out);
      },
    };
    if (window.MSH.theme && window.MSH.theme.update) window.MSH.theme.update(H);
    const ROLES = { effekt: 'sensor.strommaler_effekt', spot: 'sensor.totalpris_strom', norge: 'sensor.norgespris_pris_na', dag: 'sensor.kostnad_i_dag', maned: 'sensor.regning_maned', spart: null, forbruk: 'sensor.forbruk_i_dag' };
    class Host extends HTMLElement {
      constructor() { super(); this.root = this.attachShadow({ mode: 'open' }); this.ui = {}; this.config = {}; this.anim = true; this.page = 'norgespris'; this.hass = H; }
      ent(r) { return (this.config.ent && this.config.ent[r]) || ROLES[r] || null; }
      setCfg(p) { window.__set.push(JSON.parse(JSON.stringify(p))); this.config = { ...this.config, ...p }; this.render(); }
      go(p) { window.__go.push(p); this.page = p; this.render(); }
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
  }, { spot: 1.2, ...opts });
  await p.waitForTimeout(150);
  return p;
}
const q = (p, sel) => p.evaluate((s) => { const e = window.__R.querySelector(s); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; }, sel);
const go = (p, page) => p.evaluate((pg) => { window.__h.page = pg; window.__h.render(); }, page);
const tap = async (p, sel) => { await p.evaluate((s) => window.__R.querySelector(s).click(), sel); await p.waitForTimeout(80); };

// ---------------------------------------------------------------- Norgespris (spot > Norgespris → grønt)
{
  const p = await open({ spot: 1.2 });
  ok('modul finnes', await p.evaluate(() => !!(window.MSH.stromSider && window.MSH.stromSider.css && window.MSH.stromSider.html && window.MSH.stromSider.bind)));
  ok('timestatistikk hentet én gang (hour, change+mean) fra min(mandag, 1. i mnd)', await p.evaluate(() => {
    const L = window.__ws.filter((m) => m.type === 'recorder/statistics_during_period'), n = new Date();
    const mon = new Date(n); mon.setHours(0, 0, 0, 0); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
    const start = Math.min(mon.getTime(), new Date(n.getFullYear(), n.getMonth(), 1).getTime());
    return L.length === 1 && L[0].period === 'hour' && L[0].types.includes('change') && L[0].types.includes('mean') && L[0].statistic_ids.includes('sensor.forbruk_i_dag') && Date.parse(L[0].start_time) === start;
  }), await p.evaluate(() => window.__ws.map((m) => [m.period, m.start_time])));
  ok('hode: tilbake + «Norgespris» + ikon', (await q(p, '.ss-title')) === 'Norgespris' && !!(await p.evaluate(() => window.__R.querySelector('.ss-back .ss-back, .ss-back'))));
  ok('toppkort grønt (won) når Norgespris billigst', (await p.evaluate(() => window.__R.querySelector('[data-ss-hero]').getAttribute('data-ss-hero'))) === 'won');
  ok('tittel «Spart med Norgespris · denne måneden»', (await q(p, '.ss-nx-title')) === 'Spart med Norgespris · denne måneden', await q(p, '.ss-nx-title'));
  ok('stort tall og prosent-chip', /^[\d\s ]+(,\d)?$/.test(await q(p, '.ss-nx-big')) && /% billigere/.test(await q(p, '.ss-nx-chip')), [await q(p, '.ss-nx-big'), await q(p, '.ss-nx-chip')]);
  ok('4 periodevalg, Måned aktiv', await p.evaluate(() => { const b = [...window.__R.querySelectorAll('.ss-seg-n .ki-seg-b')]; return b.length === 4 && b.map((x) => x.textContent).join('|') === 'I dag|Uke|Måned|År' && b[2].classList.contains('on'); }));
  ok('sammenligning: 2 søyler, spot lengst', await p.evaluate(() => { const b = [...window.__R.querySelectorAll('.ss-cmp .ss-bar')]; return b.length === 2 && parseFloat(b[0].style.width) === 100 && parseFloat(b[1].style.width) < 100 && parseFloat(b[1].style.width) > 0; }));
  ok('divergerende timegraf: 24 kolonner, grønne opp', await p.evaluate(() => { const c = [...window.__R.querySelectorAll('.ss-hcol')]; return c.length === 24 && c.filter((x) => parseFloat(x.querySelector('.ss-hup>span').style.height) > 0).length >= 12; }));
  ok('tre fliser med verdier', await p.evaluate(() => { const t = [...window.__R.querySelectorAll('.ss-tile')]; return t.length === 3 && t.map((x) => x.querySelector('.ss-tile-l').textContent).join('|') === 'Denne timen|I dag|Denne uken' && t.every((x) => /kr$/.test(x.querySelector('.ss-tile-v').textContent)); }));
  const mon = await q(p, '.ss-cmp-v');
  await tap(p, '.ss-seg-n .ki-seg-b:nth-child(1)');
  ok('periode I dag: tittel og verdier byttes, haptic', /· i dag$/.test(await q(p, '.ss-nx-title')) && (await q(p, '.ss-cmp-v')) !== mon && (await p.evaluate(() => window.__hp.includes('selection'))) && (await p.evaluate(() => window.__h.ui.ssNp)) === 'I dag');
  await tap(p, '.ss-seg-n .ki-seg-b:nth-child(4)');
  ok('periode År', /· i år$/.test(await q(p, '.ss-nx-title')));
  ok('År: tidligere måneder med period month (ingen time-henting for hele året)', await p.evaluate(() => { const L = window.__ws.filter((m) => m.type === 'recorder/statistics_during_period'), n = new Date(); const mo = L.filter((m) => m.period === 'month'); return (n.getMonth() === 0 ? mo.length === 0 : mo.length === 1 && Date.parse(mo[0].end_time) === new Date(n.getFullYear(), n.getMonth(), 1).getTime()) && L.filter((m) => m.period === 'hour').every((m) => Date.parse(m.end_time) - Date.parse(m.start_time) < 40 * 86400000); }), await p.evaluate(() => window.__ws.map((m) => [m.period, m.start_time, m.end_time])));
  ok('År: tall i toppkortet', /\d/.test(await q(p, '.ss-nx-big')), await q(p, '.ss-nx-big'));
  await tap(p, '.ss-seg-n .ki-seg-b:nth-child(2)');
  ok('periode Uke', /· denne uken$/.test(await q(p, '.ss-nx-title')));
  // scrub i timegrafen
  const g = await p.evaluate(() => { const r = window.__R.querySelector('.ss-hrs').getBoundingClientRect(); return { x: r.left, y: r.top + r.height / 2, w: r.width, ta: getComputedStyle(window.__R.querySelector('.ss-hrs')).touchAction }; });
  ok('timegraf touch-action none', g.ta === 'none', g.ta);
  await p.mouse.move(g.x + g.w * (10.5 / 24), g.y); await p.mouse.down(); await p.mouse.move(g.x + g.w * (14.5 / 24), g.y, { steps: 4 }); await p.mouse.up();
  ok('scrub velger time 14 og viser prisforskjell', /^kl\. 14 · (?:[+−]?\d|(?:spart|tapt) [−-]?\d)/.test(await q(p, '.ss-hrs-sum')) && await p.evaluate(() => window.__R.querySelectorAll('.ss-hcol.sel').length === 1), await q(p, '.ss-hrs-sum'));
  ok('pointerdown i grafen stopper propagasjon', await p.evaluate(() => { let n = 0; const f = () => n++; window.__h.addEventListener('pointerdown', f); const r = window.__R.querySelector('.ss-hrs').getBoundingClientRect(); window.__R.querySelector('.ss-hcol').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true, clientX: r.left + 2, clientY: r.top + 5 })); window.__h.removeEventListener('pointerdown', f); return n === 0; }));
  await tap(p, '.ss-back');
  ok('tilbake → host.go(null)', (await p.evaluate(() => window.__go[window.__go.length - 1])) === null);
  await p.close();
}
// ---------------------------------------------------------------- Norgespris (spot < Norgespris → rødt)
{
  const p = await open({ spot: 0.2 });
  ok('toppkort rødt (lost) når spot billigst', (await p.evaluate(() => window.__R.querySelector('[data-ss-hero]').getAttribute('data-ss-hero'))) === 'lost');
  ok('tittel «Tapt med Norgespris», negativt tall, «dyrere»', /^Tapt med Norgespris/.test(await q(p, '.ss-nx-title')) && /^−/.test(await q(p, '.ss-nx-big')) && /dyrere/.test(await q(p, '.ss-nx-chip')));
  const col = await p.evaluate(() => [getComputedStyle(window.__R.querySelector('.ss-nx-big')).color, getComputedStyle(window.__R.querySelector('.ss-nx')).backgroundImage]);
  ok('rødt tall og rød gradient', /rgb\(240, 120, 100\)/.test(col[0]) && /74, 50, 48/.test(col[1]), col);
  ok('røde ned-søyler i timegrafen', await p.evaluate(() => [...window.__R.querySelectorAll('.ss-hdn>span')].filter((x) => parseFloat(x.style.height) > 0).length >= 12));
  ok('fliser negative i rødt', await p.evaluate(() => [...window.__R.querySelectorAll('.ss-tile-v.neg')].length >= 2));
  await p.close();
}
// ---------------------------------------------------------------- Uten statistikk: «–», flate grafer
{
  const p = await open({ spot: 1.2, noStats: true });
  await p.evaluate(() => { const H = window.__hass; delete H.states['sensor.totalpris_strom']; window.__h.render(); });
  await p.waitForTimeout(80);
  ok('uten data: nøytralt toppkort med «–»', (await p.evaluate(() => window.__R.querySelector('[data-ss-hero]').getAttribute('data-ss-hero'))) === 'none' && (await q(p, '.ss-nx-big')) === '–');
  ok('uten data: flat timegraf og «–»-fliser', await p.evaluate(() => [...window.__R.querySelectorAll('.ss-hup>span,.ss-hdn>span')].every((x) => parseFloat(x.style.height) === 0) && [...window.__R.querySelectorAll('.ss-tile-v')].every((x) => x.textContent === '–')));
  await go(p, 'stromregning'); await p.waitForTimeout(80);
  ok('uten data: total «–» (summen av radene), poster «–»', (await q(p, '.ss-bill-big')) === '–' && (await p.evaluate(() => window.__R.querySelector('[data-ss-part="Strøm"] .ss-part-v').textContent)) === '– kr', await q(p, '.ss-bill-big'));
  await p.close();
}
// ---------------------------------------------------------------- Strømregning
{
  const p = await open({ spot: 1.2 });
  await go(p, 'stromregning'); await p.waitForTimeout(150);
  ok('hode «Strømregning»', (await q(p, '.ss-title')) === 'Strømregning');
  const sumRows = () => p.evaluate(() => { const n = (t) => { const x = t.replace(/\s|kr/g, '').replace('−', '-'); return x === '–' ? 0 : Number(x); }; return [Number(window.__R.querySelector('.ss-bill-big').textContent.replace(/\s/g, '').replace('−', '-')), [...window.__R.querySelectorAll('.ss-part-v')].reduce((t, e) => t + n(e.textContent), 0)]; });
  { const [tot, sr] = await sumRows(); ok('rosa toppkort: total = summen av radene (estimat)', Math.abs(tot - sr) <= 2 && (await q(p, '.ss-est')) === 'estimat', [tot, sr]); }
  ok('stripe (knapp) med segmenter', await p.evaluate(() => window.__R.querySelector('button.ss-stripe') && window.__R.querySelectorAll('.ss-stripe>.ss-sg').length >= 1));
  ok('periodevalg Dag/Uke/Måned/År', await p.evaluate(() => [...window.__R.querySelectorAll('.ss-seg-b .ki-seg-b')].map((x) => x.textContent).join('|') === 'Dag|Uke|Måned|År'));
  ok('poster med ikoner: Strøm, Nettleie, Avgifter, Norgespris', await p.evaluate(() => { const r = [...window.__R.querySelectorAll('.ss-part')]; return r.length === 4 && r.map((x) => x.querySelector('.ss-part-l').textContent).join('|') === 'Strøm|Nettleie|Avgifter|Norgespris' && r.every((x) => x.querySelector('.ss-part-ic ha-icon')); }));
  ok('Norgespris-fratrekk negativt (grønt) og Strøm har verdi', await p.evaluate(() => { const n = window.__R.querySelector('[data-ss-part="Norgespris"] .ss-part-v'); return n.classList.contains('neg') && /^−/.test(n.textContent) && /\d/.test(window.__R.querySelector('[data-ss-part="Strøm"] .ss-part-v').textContent); }));
  ok('grønn spart-linje', /^Norgespris har spart deg \d/.test(await q(p, '.ss-saved')) && !(await p.evaluate(() => window.__R.querySelector('.ss-saved').classList.contains('lost'))), await q(p, '.ss-saved'));
  ok('dag/natt-fordeling', /Dag [\d,]+ kWh · \d+ %/.test(await q(p, '.ss-dn-l')) && /Natt\/helg [\d,]+ kWh · \d+ %/.test(await q(p, '.ss-dn-l')));
  ok('effekttrinn: 5 trinn, ett aktivt, topp 3', await p.evaluate(() => window.__R.querySelectorAll('.ss-step').length === 5 && window.__R.querySelectorAll('.ss-step-b.on').length === 1 && window.__R.querySelectorAll('.ss-peak').length === 3));
  const nowD = new Date().getDate();
  if (nowD > 2) ok('topp 1 = 5,25 kW den 1.', /#1 · 1\. \w+ ?5,25 kW/.test(await q(p, '.ss-peaks')), await q(p, '.ss-peaks'));
  ok('effektledd: 12 måneder, inneværende valgt', await p.evaluate(() => window.__R.querySelectorAll('.ss-ecol').length === 12 && window.__R.querySelectorAll('.ss-ebar.on').length === 1 && [...window.__R.querySelectorAll('.ss-ecol')].findIndex((c) => c.querySelector('.ss-ebar.on')) === new Date().getMonth()));
  await tap(p, '.ss-ecol:nth-child(1)'); await p.waitForTimeout(120);
  ok('trykk på måned velger den', /^Januar/.test(await q(p, '.ss-eff-s')) && (await p.evaluate(() => window.__h.ui.ssEm)) === 0);
  if (new Date().getMonth() > 0) {
    ok('tidligere måned: timer hentes bare for den måneden, bare forbruk', await p.evaluate(() => { const n = new Date(); const m = window.__ws.filter((x) => x.period === 'hour' && Date.parse(x.start_time) === new Date(n.getFullYear(), 0, 1).getTime()); return m.length === 1 && Date.parse(m[0].end_time) === new Date(n.getFullYear(), 1, 1).getTime() && m[0].statistic_ids.join() === 'sensor.forbruk_i_dag'; }), await p.evaluate(() => window.__ws.filter((m) => m.statistic_ids).map((m) => [m.period, m.start_time, m.end_time, m.statistic_ids.join()])));
    ok('januar-søylen vises etter henting', /^Januar · .*snittet$|^Januar$/.test(await q(p, '.ss-eff-s')) && (await q(p, '.ss-eff-v')) !== '–', [await q(p, '.ss-eff-s'), await q(p, '.ss-eff-v')]);
  }
  await tap(p, '.ss-seg-b .ki-seg-b:nth-child(1)');
  { const [tot, sr] = await sumRows(); ok('periode Dag: total = summen av radene', Math.abs(tot - sr) <= 2 && /i dag/.test(await q(p, '.ss-bill-p')), [tot, sr]); }
  await tap(p, '.ss-seg-b .ki-seg-b:nth-child(2)');
  ok('periode Uke: beregnet total og «uke N»', /\d/.test(await q(p, '.ss-bill-big')) && /uke \d+/.test(await q(p, '.ss-bill-p')));
  await tap(p, '.ss-seg-b .ki-seg-b:nth-child(4)');
  await p.waitForTimeout(120);
  ok('periode År', new RegExp(String(new Date().getFullYear())).test(await q(p, '.ss-bill-p')) && /i år/.test(await q(p, '.ss-saved')) && /\d/.test(await q(p, '.ss-bill-big')), [await q(p, '.ss-bill-p'), await q(p, '.ss-saved'), await q(p, '.ss-bill-big')]);
  ok('År: kWh for hele året, dag/natt «–»', /Dag · – %/.test(await q(p, '.ss-dn-l')) && parseFloat((await q(p, '.ss-v17')).replace(/\s/g, '').replace(',', '.')) > 24 * 28, [await q(p, '.ss-v17'), await q(p, '.ss-dn-l')]);
  // effektledd-priser i config → kr
  await p.evaluate(() => { window.__h.config = { sider: { effektledd: [200, 300, 450, 600, 750] } }; window.__h.render(); });
  ok('effektledd-priser gir kr og «i år … kr»', /^i år [\d\s ]+ kr$/.test(await q(p, '.ss-p-stromregning .ss-card:last-child .ss-sm')), await q(p, '.ss-p-stromregning .ss-card:last-child .ss-sm'));
  await p.close();
}
// ---------------------------------------------------------------- Strøminnstillinger
{
  const p = await open({ spot: 1.2, withInput: true });
  await go(p, 'innstillinger'); await p.waitForTimeout(80);
  ok('hode «Strøminnstillinger» + lukk', (await q(p, '.ss-title')) === 'Strøminnstillinger' && !!(await p.evaluate(() => window.__R.querySelector('.ss-close'))));
  ok('8 fliser i riktig rekkefølge', await p.evaluate(() => [...window.__R.querySelectorAll('.ss-set-l')].map((x) => x.textContent).join('|') === 'Nordpool|Totalpris|Nettleie dag|Nettleie natt|Påslag strømselskap|Terskel strømstøtte|Strømstøtte dekker|Moms'));
  ok('Nettleie dag leses fra input_number', (await q(p, '[data-ss-set="grid"] .ss-set-v')) === '36,4 øre/kWh', await q(p, '[data-ss-set="grid"] .ss-set-v'));
  ok('standardsatser: terskel 77, 90 %, moms 25 %', (await q(p, '[data-ss-set="gov"] .ss-set-v')) === '77 øre/kWh' && (await q(p, '[data-ss-set="govPct"] .ss-set-v')) === '90 %' && (await q(p, '[data-ss-set="vat"] .ss-set-v')) === '25 %');
  ok('uten verdi: «–» (natt/påslag)', (await q(p, '[data-ss-set="night"] .ss-set-v')) === '–' && (await q(p, '[data-ss-set="surch"] .ss-set-v')) === '–');
  ok('Nordpool/Totalpris ikke redigerbare', await p.evaluate(() => !window.__R.querySelector('[data-ss-set="nord"]').hasAttribute('data-ss-act') && !window.__R.querySelector('[data-ss-set="total"]').hasAttribute('data-ss-act')));
  // rediger nettleie dag → input_number.set_value
  await tap(p, '[data-ss-set="grid"]');
  ok('trykk åpner tallfelt med fokus', await p.evaluate(() => { const i = window.__R.querySelector('input[data-ss-in="grid"]'); return !!i && window.__R.activeElement === i && i.value === '36,4'; }));
  await p.keyboard.press('Control+A'); await p.keyboard.type('41,25'); await p.keyboard.press('Enter'); await p.waitForTimeout(80);
  ok('Enter → input_number.set_value 41.25', await p.evaluate(() => JSON.stringify(window.__svc[window.__svc.length - 1]) === JSON.stringify(['input_number', 'set_value', { entity_id: 'input_number.nettleie_dag', value: 41.25 }])), await p.evaluate(() => window.__svc));
  ok('feltet lukkes, ny verdi vises', !(await p.evaluate(() => window.__R.querySelector('input[data-ss-in]'))) && (await q(p, '[data-ss-set="grid"] .ss-set-v')) === '41,25 øre/kWh');
  // påslag (ingen entitet) → host.setCfg({ sider })
  await tap(p, '[data-ss-set="surch"]');
  await p.keyboard.type('8,13'); await p.keyboard.press('Enter'); await p.waitForTimeout(80);
  ok('uten entitet → setCfg({ sider: { surch: 8.13 } })', await p.evaluate(() => { const s = window.__set[window.__set.length - 1]; return s && s.sider && s.sider.surch === 8.13; }), await p.evaluate(() => window.__set));
  ok('påslag vises fra config', (await q(p, '[data-ss-set="surch"] .ss-set-v')) === '8,13 øre/kWh');
  // natt via blur (trykk på annen flis)
  await tap(p, '[data-ss-set="night"]');
  await p.keyboard.type('26,4');
  await p.evaluate(() => window.__R.querySelector('input[data-ss-in="night"]').blur()); await p.waitForTimeout(80);
  ok('blur lagrer (natt 26,4 → sider.night)', await p.evaluate(() => window.__h.config.sider && window.__h.config.sider.night === 26.4 && window.__h.config.sider.surch === 8.13));
  // Escape avbryter
  await tap(p, '[data-ss-set="vat"]');
  await p.keyboard.type('99'); await p.keyboard.press('Escape'); await p.waitForTimeout(80);
  ok('Escape avbryter uten lagring', (await q(p, '[data-ss-set="vat"] .ss-set-v')) === '25 %' && !(await p.evaluate(() => window.__R.querySelector('input[data-ss-in]'))));
  ok('Totalpris beregnes (– før Nordpool finnes er ok)', /øre\/kWh$|^–$/.test(await q(p, '[data-ss-set="total"] .ss-set-v')), await q(p, '[data-ss-set="total"] .ss-set-v'));
  ok('haptic på trykk', await p.evaluate(() => window.__hp.filter((x) => x === 'light').length >= 3 && window.__hp.includes('success')));
  await tap(p, '.ss-close');
  ok('lukk → host.go(null)', (await p.evaluate(() => window.__go[window.__go.length - 1])) === null);
  await p.close();
}
// ---------------------------------------------------------------- Lys modus: kontrast på aksentflater
{
  const lum = (c) => { const a = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2]; };
  const cr = (x, y) => { const [l1, l2] = [lum(x), lum(y)].sort((m, n) => n - m); return (l1 + 0.05) / (l2 + 0.05); };
  const p = await open({ spot: 1.2, light: true });
  ok('lys modus aktiv', (await p.evaluate(() => document.documentElement.getAttribute('data-ki-theme'))) === 'light');
  // Farger: les computed color/background (color-mix/color() → rgb via canvas)
  const probe = (sel, prop, bgVar) => p.evaluate(({ sel, prop, bgVar }) => {
    const el = window.__R.querySelector(sel); if (!el) return null;
    const cs = getComputedStyle(el);
    let v = prop === 'bgvar' ? (() => { const d = document.createElement('div'); d.style.background = `var(${bgVar})`; el.appendChild(d); const r = getComputedStyle(d).backgroundColor; d.remove(); return r; })() : cs[prop];
    const cv = document.createElement('canvas'); cv.width = cv.height = 1; const x = cv.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, 1, 1); x.fillStyle = v; x.fillRect(0, 0, 1, 1);
    return [...x.getImageData(0, 0, 1, 1).data].slice(0, 3);
  }, { sel, prop, bgVar });
  const pink1 = [242, 138, 201], pink2 = [246, 201, 196];
  // Norgespris (grønt toppkort): tekst mot tonet flate
  const nxBg = await probe('.ss-nx', 'bgvar', '--ss-l0');
  const nxBig = await probe('.ss-nx-big', 'color'), nxT = await probe('.ss-nx-title', 'color'), nxSub = await probe('.ss-nx-sub', 'color');
  ok('lys: Norgespris-toppkort lys flate', lum(nxBg) > 0.4, nxBg);
  ok('lys: tall/tittel/undertekst ≥ 4,5:1 på toppkortet', cr(nxBig, nxBg) >= 4.5 && cr(nxT, nxBg) >= 4.5 && cr(nxSub, nxBg) >= 4.5, [nxBig, nxT, nxSub, nxBg].map(String));
  const onPill = await probe('.ss-seg-n .ki-seg-b.on', 'color');
  ok('lys: aktiv periode-pille mørk tekst på rosa ≥ 4,5:1', cr(onPill, pink1) >= 4.5 && cr(onPill, pink2) >= 4.5, onPill);
  await go(p, 'stromregning'); await p.waitForTimeout(120);
  const billC = await probe('.ss-bill', 'color'), billOn = await probe('.ss-seg-b .ki-seg-b.on', 'color'), billOff = await probe('.ss-seg-b .ki-seg-b:not(.on)', 'color');
  ok('lys: tekst på rosa regning ≥ 4,5:1', cr(billC, pink1) >= 4.5 && cr(billC, pink2) >= 4.5, billC);
  ok('lys: periodevalg på rosa mørk tekst (aktiv ≥ 4,5, inaktiv ≥ 3)', cr(billOn, pink1) >= 4.5 && cr(billOff, pink1) >= 3, [billOn, billOff]);
  const card = await probe('.ss-card', 'backgroundColor'), partV = await probe('.ss-part-v', 'color'), partS = await probe('.ss-part-s', 'color'), sm = await probe('.ss-sm', 'color');
  ok('lys: kort hvite, tekst ≥ 4,5:1', lum(card) > 0.9 && cr(partV, card) >= 4.5 && cr(partS, card) >= 4.5 && cr(sm, card) >= 4.5, [card, partV, partS, sm]);
  const neg = await probe('.ss-part-v.neg', 'color');
  ok('lys: grønt fratrekk ≥ 4,5:1', cr(neg, card) >= 4.5, neg);
  const savedT = await probe('.ss-saved', 'color');
  ok('lys: spart-linje lesbar (≥ 4,5:1 mot kortflate)', cr(savedT, [240, 240, 240]) >= 4.5, savedT);
  await go(p, 'innstillinger'); await p.waitForTimeout(80);
  const sBg = await probe('.ss-set', 'backgroundColor'), sV = await probe('.ss-set-v', 'color'), sL = await probe('.ss-set-l', 'color');
  ok('lys: innstillingsfliser lesbare', cr(sV, sBg) >= 4.5 && cr(sL, sBg) >= 4.5, [sBg, sV, sL]);
  await p.close();
}

{ // lys modus, rødt toppkort
  const p = await open({ spot: 0.2, light: true });
  const r = await p.evaluate(() => { const g = (el, prop, v) => { const cs = getComputedStyle(el); let c = cs[prop]; if (v) { const d = document.createElement('div'); d.style.background = `var(${v})`; el.appendChild(d); c = getComputedStyle(d).backgroundColor; d.remove(); } const cv = document.createElement('canvas'); cv.width = cv.height = 1; const x = cv.getContext('2d'); x.fillStyle = c; x.fillRect(0, 0, 1, 1); return [...x.getImageData(0, 0, 1, 1).data].slice(0, 3); };
    const R = window.__R; return { bg: g(R.querySelector('.ss-nx'), null, '--ss-l0'), big: g(R.querySelector('.ss-nx-big'), 'color'), chip: g(R.querySelector('.ss-nx-chip'), 'color') }; });
  const lum = (c) => { const a = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2]; };
  const cr = (x, y) => { const [l1, l2] = [lum(x), lum(y)].sort((m, n) => n - m); return (l1 + 0.05) / (l2 + 0.05); };
  ok('lys: rødt toppkort, rødt tall ≥ 4,5:1', cr(r.big, r.bg) >= 4.5 && cr(r.chip, r.bg) >= 3, r);
  await p.screenshot({ path: 'test/.build/strom45c-light-norge.png', fullPage: true });
  await p.close();
}
for (const pg of ['norgespris', 'stromregning', 'innstillinger']) { // skjermbilder (mørk) for side-om-side-sammenligning
  const p = await open({ spot: 1.2, withInput: true });
  await go(p, pg); await p.waitForTimeout(700);
  await p.screenshot({ path: `test/.build/strom45c-${pg}.png`, fullPage: true });
  await p.close();
}

ok('ingen JS-feil', errs.length === 0, errs);
await b.close();
try { unlinkSync(bundle); } catch (e) { /* */ }
console.log(fails ? `\n${fails} feil` : '\nAlle sjekker OK');
process.exit(fails ? 1 : 0);
