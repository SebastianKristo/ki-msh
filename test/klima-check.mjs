// Fiks 15.1 + 15.12 · #klima-popupen (msh-klima-card) via strategien custom:ki-dashboard mot ekte Bubble Card.
// Fiks 15.12: to datasett fra opptaket av KI Energi v2.32.0 (test/fixtures/ki-energi-2.32.json) – ett med standard-ID-er og
// ett med avvikende ID-er (kollisjonssuffiks + omdøpt bryter). Testen feiler hvis heroen viser «Venter på KI Energi», popupen er
// tom, eller heroen ikke viser motorens tall fra ki_energi_status (sone, kW, ledig, min igjen, brukt/grense, prognose).
// Tre datasett: fullt mock, uten KI Energi-entiteter (og uten klima-entiteter → #klima via REF_POPUPS) og «ødelagte» data
// (unavailable/unknown, manglende attributter, strenger i stedet for tall, null-lister). Sjekker at hero + faner + innhold er
// synlige (høyde > 0), at ingen pageerror/konsollfeil oppstår, at hero-animasjonen kjører ved åpning og på nytt ved ny åpning,
// at strategien retter tom/gammel popup-config, og at en tvunget feil gir synlig feilkort («Klima-kortet feilet: …»).
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readdirSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const BC = resolve('test/.vendor/bubble-card.js');
if (!existsSync(BC)) execFileSync('curl', ['-sSL', '-o', BC, 'https://raw.githubusercontent.com/Clooos/Bubble-Card/main/dist/bubble-card.js']);
mkdirSync(resolve('test/.build'), { recursive: true });
const bundle = resolve(`test/.build/klima-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

// Fiks 15.12: opptak av KI Energi v2.32.0 (states + entitetsregister). Generert fra integrasjonens kode til brukerens
// ekte eksport finnes (test/fixtures/ki-energi-2.32.gen.py, docs/ki-energi-eksport.md) – samme format.
const FIX = JSON.parse(readFileSync(resolve('test/fixtures/ki-energi-2.32.json'), 'utf8'));
// Forventet innhold i heroen, regnet ut av opptaket selv (virker også når fila byttes med en ekte eksport)
const FORV = (() => {
  const id = (uid) => (FIX.entities.find((e) => e.unique_id === uid) || {}).entity_id;
  const st = (uid) => FIX.states.find((x) => x.entity_id === id(uid)) || null;
  const s = st('ki_energi_ki_energi_status'), a = (s && s.attributes) || {}, est = st('ki_energi_ki_estimert_timesforbruk');
  const nf = (v) => (v == null || v === '' || !isFinite(Number(v)) ? '–' : Number(v).toFixed(2).replace('.', ','));
  const TEKST = { gronn: 'God margin', gul: 'Nærmer seg grensen', oransje: 'Liten margin', rod: 'Fare for ny topp', kritisk: 'Kritisk', fallback: 'Trygg fallback', av: 'Motoren er av' };
  return { state: s && s.state, status: TEKST[s && s.state], kw: nf(a.forventet_effekt_kw), ledig: ['gronn', 'gul'].includes(s && s.state) ? nf(a.ledig_kw) + ' kW' : null,
    min: a.minutter_igjen != null ? `${Math.round(a.minutter_igjen)} min igjen` : null, budsjett: `${nf(a.forbrukt_kwh)} av ${nf(a.grense_kwh)} kWh`,
    prognose: est && isFinite(Number(est.state)) ? 'Prognose ' + nf(est.state) : null };
})();
// Bytt ut mock-dataene for KI Energi med opptaket. hass.entities får bare feltene frontenden faktisk har
// (EntityRegistryDisplayEntry: ingen unique_id); hele registeret (med unique_id) svares på config/entity_registry/list.
const brukOpptak = ({ S, E }) => {
  const F = window.__KI_FIX;
  Object.keys(S).forEach((id) => { if (/\.ki_/.test(id) || (E[id] && E[id].platform === 'ki_energi')) { delete S[id]; delete E[id]; } });
  const now = new Date().toISOString();
  F.states.forEach((x) => { S[x.entity_id] = { entity_id: x.entity_id, state: x.state, attributes: x.attributes, last_changed: now, last_updated: now, context: {} }; });
  F.entities.forEach((e) => { E[e.entity_id] = { entity_id: e.entity_id, platform: e.platform, translation_key: e.translation_key || undefined, device_id: e.device_id, area_id: e.area_id, hidden: false, entity_category: e.entity_category, name: e.name, icon: e.icon }; });
  window.__KI_WS = { 'config_entries/get': [F.config_entry], 'config/entity_registry/list': F.entities };
};
// Datasett: kjøres i siden før strategien genererer (S = hass.states, E = entitetsregisteret)
const SETS = {
  full: () => {},
  // Opptaket slik det er (standard entitets-ID-er)
  ki_energi_232: brukOpptak,
  // Opptaket med avvikende ID-er: statussensoren fikk HAs kollisjonssuffiks (_2) ved installasjon, og brukeren har
  // omdøpt switch.ki_helgemodus → switch.bortemodus (finnes bare via unique_id i registeret).
  ki_energi_232_omdopt: (arg) => {
    const opptak = eval('(' + window.__KI_OPPTAK + ')');
    opptak(arg);
    const { S, E } = arg, F = window.__KI_WS['config/entity_registry/list'];
    const flytt = (uid, til) => {
      const r = F.find((e) => e.unique_id === uid); if (!r) return; const fra = r.entity_id; if (!til) til = fra + '_2';
      S[til] = { ...S[fra], entity_id: til }; delete S[fra]; E[til] = { ...E[fra], entity_id: til }; delete E[fra]; r.entity_id = til;
    };
    flytt('ki_energi_ki_energi_status');
    flytt('ki_energi_ki_helgemodus', 'switch.bortemodus');
    // Gjenglemt pakke-/template-sensor fra før integrasjonen holder på grunn-ID-en: HA viser den som unavailable (restored)
    S['sensor.ki_energi_status'] = { entity_id: 'sensor.ki_energi_status', state: 'unavailable', attributes: { restored: true, friendly_name: 'KI Energistatus' }, last_changed: '', last_updated: '', context: {} };
    E['sensor.ki_energi_status'] = { entity_id: 'sensor.ki_energi_status', platform: 'template', hidden: false };
  },
  // Ingen KI Energi (ingen ki_*-entiteter) og ingen climate/fan → #klima lages bare fordi navbaren peker dit (REF_POPUPS)
  uten_ki: ({ S, E }) => {
    Object.keys(S).forEach((id) => { if (/\.ki_|^(climate|fan)\./.test(id) || (E[id] && E[id].platform === 'ki_energi')) { delete S[id]; delete E[id]; } });
  },
  // Ødelagte data: sensorer unavailable/unknown, tall som strenger, lister null/tomme/feil type, manglende attributter
  odelagt: ({ S }) => {
    let i = 0;
    Object.keys(S).forEach((id) => {
      if (!/\.ki_/.test(id)) return;
      const s = S[id];
      if (id === 'sensor.ki_energi_status') {
        S[id] = { ...s, state: 'unknown', attributes: { friendly_name: 'KI Energi status', effekt_kw: '1.4', tillatt_effekt_kw: 'unknown', forbrukt_kwh: '', grense_kwh: null, minutter_igjen: 'abc', personer: null, laster: 'x', entiteter: null, lading: 'unknown', hustype: null, tankegang: null } };
      } else if (id === 'sensor.ki_laster') {
        S[id] = { ...s, state: 'unavailable', attributes: { friendly_name: 'KI laster', laster: null } };
      } else if (/^sensor\./.test(id)) {
        const k = i++ % 3;
        S[id] = { ...s, state: k === 0 ? 'unavailable' : k === 1 ? 'unknown' : String(s.state), attributes: k === 2 ? { friendly_name: s.attributes.friendly_name, ...Object.fromEntries(Object.keys(s.attributes).map((a) => [a, null])) } : { friendly_name: s.attributes.friendly_name } };
      } else {
        const k = i++ % 4;
        if (k === 0) S[id] = { ...s, state: 'unavailable', attributes: { friendly_name: s.attributes.friendly_name } };
        else if (k === 1) S[id] = { ...s, state: 'unknown', attributes: {} };
      }
    });
  },
};

let fail = 0;
for (const [navn, mut] of Object.entries(SETS)) {
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  if (process.env.DBG) p.on('console', (m) => console.log('  ·', m.type(), m.text().slice(0, 200)));
  const errs = [], info = [];
  p.on('console', async (m) => { if (m.type() === 'info' && /msh-klima-card/.test(m.text())) { try { info.push(await Promise.all(m.args().map((a) => a.jsonValue()))); } catch (e) { info.push([m.text()]); } } });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/ERR_|CORS|bubble-modules|Failed to/.test(m.text()) && !/TVUNGET/.test(m.text())) errs.push(m.text().slice(0, 200)); });
  // Fiks 16.13: ekte hui-card-oppførsel (?huiekte) – stubben skjulte at kortet kastet i HAs _loadElement (element.layout = …)
  await p.goto('file://' + resolve('test/harness-bubble.html') + '?huiekte');
  for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
  // Opptaket + WS-svar (config_entries/get, config/entity_registry/list) for datasettene som bruker det
  await p.evaluate(({ F, opptak }) => {
    window.__KI_FIX = F; window.__KI_OPPTAK = opptak;
    const mh = window.mockHass;
    window.mockHass = () => { const h = mh(), ws = h.callWS; h.callWS = (m) => (window.__KI_WS && window.__KI_WS[m.type] ? Promise.resolve(JSON.parse(JSON.stringify(window.__KI_WS[m.type]))) : ws(m)); return h; };
  }, { F: FIX, opptak: brukOpptak.toString() });
  await p.evaluate(`window.mockExtend(${mut.toString()})`);
  await p.addScriptTag({ path: bundle });
  await p.addScriptTag({ path: BC, type: 'module' });
  await p.waitForFunction(() => customElements.get('bubble-card'));
  const r = await p.evaluate(async () => {
    const wait = (ms) => new Promise((q) => setTimeout(q, ms));
    const M = window.MSH, hass = window.mockHass(), res = {};
    const S = customElements.get('ll-strategy-dashboard-ki-dashboard');
    res.lastet = !!customElements.get('msh-klima-card') && !!customElements.get('msh-klima-hero-card');
    const dash = await S.generate({}, hass);
    const stack = dash.views[0].cards[0];
    const pop = stack.cards.find((c) => c.card_type === 'pop-up' && c.hash === '#klima');
    res.popup = !!pop && pop.cards.length === 1 && pop.cards[0].type === 'custom:msh-klima-card';
    // Strategien: tom cards / gammelt kortnavn i popup_overrides → rettes til msh-klima-card
    const kl = async (cfg) => { const d = await S.generate(cfg, hass); const x = d.views[0].cards[0].cards.find((c) => c.hash === '#klima'); return x ? x.cards.map((c) => c.type).join(',') : 'MANGLER'; };
    const rep = (cards) => ({ popup_overrides: { '#klima': { replace: true, config: { type: 'custom:bubble-card', card_type: 'pop-up', hash: '#klima', name: 'Klima', cards } } } });
    res.strategi = {
      tomMerge: await kl({ popup_overrides: { '#klima': { name: 'Klimaet', cards: [] } } }),
      tomReplace: await kl(rep([])),
      gammeltNavn: await kl(rep([{ type: 'custom:ki-klima-card', card_id: 'x' }])),
      heroAlene: await kl(rep([{ type: 'custom:msh-klima-hero-card' }])),
      egetKort: await kl(rep([{ type: 'custom:msh-soppel-card' }])),
    };
    await S.generate({}, hass);
    // Render navbar + #klima (som i strategiens stack) og åpne popupen
    const root = document.getElementById('dash');
    for (const c of [stack.cards[1], pop]) { const el = document.createElement(c.type.replace('custom:', '')); el.setConfig(c); el.hass = hass; root.appendChild(el); }
    await wait(600);
    const all = () => { const o = []; const w = (x) => x.querySelectorAll('*').forEach((e) => { o.push(e); if (e.shadowRoot) w(e.shadowRoot); }); w(document); return o; };
    const openPop = () => all().find((e) => e.classList && e.classList.contains('bubble-pop-up') && e.classList.contains('is-popup-opened'));
    const h = (el) => (el ? Math.round(el.getBoundingClientRect().height) : 0);
    const look = () => {
      const pe = openPop(), card = pe && [...pe.querySelectorAll('*')].find((e) => e.localName === 'msh-klima-card');
      const sr = card && card.shadowRoot, hero = sr && sr.querySelector('.msh-hero-slot msh-klima-hero-card');
      const kh = hero && hero.shadowRoot.querySelector('.kh');
      const tabs = sr ? [...sr.querySelectorAll('.tabs .tab')] : [];
      const txt = (sr ? sr.textContent : '') + (hero ? hero.shadowRoot.textContent : '');
      return { card, hero, o: {
        apen: !!pe, kort: h(card), hero: h(kh), ring: !!(kh && kh.querySelector('.ring svg')), bar: !!(kh && kh.querySelector('.bar')),
        faner: tabs.length, fanerH: Math.min(...tabs.map(h), 999), innhold: h(sr && sr.querySelector('.kbody')), feil: /kortet feilet|Feil i kortet/.test(txt),
        status: kh ? kh.querySelector('.stt').textContent.trim() : '', kw: kh ? kh.querySelector('.kw').textContent.trim() : '',
        heroTekst: kh ? kh.textContent.replace(/\s+/g, ' ').trim() : '', oppsett: !!(kh && kh.querySelector('.setup[data-path="/config/integrations/integration/ki_energi"]')),
        borte: kh && kh.querySelector('.away') ? kh.querySelector('.away').dataset.id : '', modus: sr ? [...sr.querySelectorAll('.modes .mode')].map((x) => x.dataset.id).join(',') : '',
      } };
    };
    const anims = (el) => (el && el.shadowRoot.getAnimations ? el.shadowRoot.getAnimations().length : 0);
    location.hash = '#klima'; await wait(1200);
    let L = look();
    res.forste = L.o;
    res.anim1 = anims(L.hero);
    // Alle fanene tegnes uten feil
    const fan = [];
    for (const t of [...L.card.shadowRoot.querySelectorAll('.tabs .tab')].map((x) => x.dataset.key)) {
      L.card._selectTab(t); await wait(120);
      const sr = L.card.shadowRoot;
      fan.push(`${t}:${h(sr.querySelector('.kbody')) > 0 && !/kortet feilet|Feil i (kortet|blokken)/.test(sr.textContent) ? 'ok' : 'FEIL'}`);
    }
    res.fanerTegnet = fan.join(' ');
    L.card._selectTab('oversikt'); await wait(200);
    // Lukk og åpne igjen → animasjonen kjører på nytt
    history.replaceState(null, '', location.pathname); window.dispatchEvent(new Event('hashchange')); await wait(700);
    location.hash = '#klima'; await wait(900);
    L = look();
    res.andre = L.o.apen && L.o.hero > 0 && L.o.faner > 0;
    res.anim2 = anims(L.hero);
    // Tvunget feil: render, afterRender og hero → synlig feilkort, ingen tom flate
    const card = L.card, P = Object.getPrototypeOf(card), hero = L.hero, HP = Object.getPrototypeOf(hero);
    const forced = {};
    const tryIt = async (key, patch, unpatch, el) => {
      patch(); card.update(); hero.update(); await wait(250);
      const sr = card.shadowRoot, hs = hero.shadowRoot;
      const t = (el === 'hero' ? hs.textContent : sr.textContent);
      forced[key] = /Klima[^:]*-kortet feilet: TVUNGET/.test(t) && h(card) > 40 ? 'feilkort' : 'INGEN-FEILKORT';
      unpatch(); card.update(); hero.update(); await wait(250);
    };
    const orig = { render: P.render, after: P.afterRender, hr: HP.render };
    await tryIt('render', () => { P.render = function () { throw new Error('TVUNGET render'); }; }, () => { P.render = orig.render; });
    await tryIt('afterRender', () => { P.afterRender = function () { throw new Error('TVUNGET afterRender'); }; }, () => { P.afterRender = orig.after; });
    const sd = Object.getOwnPropertyDescriptor(P, 'styles');
    await tryIt('styles', () => { Object.defineProperty(P, 'styles', { configurable: true, get() { throw new Error('TVUNGET styles'); } }); }, () => { Object.defineProperty(P, 'styles', sd); });
    await tryIt('hero', () => { HP.render = function () { throw new Error('TVUNGET hero'); }; }, () => { HP.render = orig.hr; }, 'hero');
    res.tvunget = forced;
    await wait(300); const Lz = look().o; res.etterpa = Lz.hero > 0 && !Lz.feil; if (!res.etterpa) res.etterpaInfo = Lz;
    return res;
  });
  const o = r.forste;
  // Fiks 15.12: med opptaket skal heroen vise motorens tall – aldri «Venter på KI Energi» eller tom popup
  let ekte = true;
  if (/^ki_energi/.test(navn)) {
    const t = o.heroTekst || '';
    const logg = info.find((a) => a[0] === 'msh-klima-card') || [];
    const L = logg[2] || {};
    r.ki = { logg: L, venter: /Venter på KI Energi/.test(t) };
    const har = (x) => x == null || t.includes(x);
    ekte = !/Venter på KI Energi/.test(t) && !o.oppsett && o.status === FORV.status && o.kw === FORV.kw
      && har(FORV.ledig) && har(FORV.min) && har(FORV.budsjett) && har(FORV.prognose)
      && o.faner >= 7 && o.innhold > 200 && L.entry === true && L.entiteter === FIX.antall_ki_energi && L.status === FORV.state
      && (navn !== 'ki_energi_232_omdopt' || (o.borte === 'switch.bortemodus' && /switch\.bortemodus/.test(o.modus)));
    if (!ekte) console.log('  15.12-sjekk feilet:', JSON.stringify({ forventet: FORV, status: o.status, kw: o.kw, hero: t, borte: o.borte, modus: o.modus, logg: L }));
  } else if (navn === 'uten_ki') {
    // Uten integrasjonen: «Venter på KI Energi» + lenke «Sett opp KI Energi», men hero og faner vises
    ekte = /Venter på KI Energi/.test(o.heroTekst) && o.oppsett;
    if (!ekte) console.log('  uten_ki: mangler «Venter på KI Energi»/«Sett opp KI Energi»:', o.heroTekst);
  } else {
    ekte = !/Venter på KI Energi/.test(o.heroTekst);
  }
  const ok = ekte && !errs.length && r.lastet && r.popup && o.apen && o.kort > 100 && o.hero > 100 && o.ring && o.bar && o.faner > 0 && o.fanerH > 0 && o.innhold > 0 && !o.feil
    && !/FEIL/.test(r.fanerTegnet) && r.andre && r.anim1 > 0 && r.anim2 > 0 && r.etterpa
    && r.strategi.tomMerge === 'custom:msh-klima-card' && r.strategi.tomReplace === 'custom:msh-klima-card' && r.strategi.gammeltNavn === 'custom:msh-klima-card'
    && r.strategi.heroAlene === 'custom:msh-klima-card' && r.strategi.egetKort === 'custom:msh-soppel-card'
    && Object.values(r.tvunget).every((v) => v === 'feilkort');
  if (!ok) fail++;
  console.log(`${ok ? '✔' : '✘'} [${navn}]`, JSON.stringify(r), errs.slice(0, 4).join(' | '));
  await p.close();
}
// ---------------------------------------------------------------------------------------------------------------------
// Fiks 16.13 · ekte Bubble-oppførsel: HAs hui-card (?huiekte), popupen lukket når kortet lages og hass settes, lang tid før
// åpning, fanen «skjult» (rAF stoppet) når popupen åpnes, gjenåpning (kortet kobles fra/til), prefers-reduced-motion av.
// Innholdet skal være synlig (effektiv opacity 1, høyde > 0) etter åpning, ingen animasjon med fill som skjuler innhold,
// diagnose-skriptet i docs/klima-diagnose.md skal kjøre, skjelettet tegnes før hass, vakten gir feilkort etter 3 s usynlig,
// alle msh-kort tåler HAs element.layout/.preview/.editMode, og kontrolltesten utenfor Bubble rendrer.
{
  const md = readFileSync(resolve('docs/klima-diagnose.md'), 'utf8');
  const s0 = md.indexOf('```js') + 5, DIAG = md.slice(s0, md.indexOf('```', s0)).trim().replace(/;\s*$/, '');
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' });
  const errs = [];
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' && !/ERR_|CORS|bubble-modules|Failed to/.test(t) && !/ingenting synlig/.test(t)) errs.push(t.slice(0, 300));
    if (m.type() === 'warning' && /Failed to create card element|animasjon hang/.test(t)) errs.push(t.slice(0, 300));
  });
  await p.goto('file://' + resolve('test/harness-bubble.html') + '?huiekte');
  for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
  await p.evaluate(({ F, opptak }) => {
    window.__KI_FIX = F;
    const mh = window.mockHass;
    window.mockHass = () => { const h = mh(), ws = h.callWS; h.callWS = (m) => (window.__KI_WS && window.__KI_WS[m.type] ? Promise.resolve(JSON.parse(JSON.stringify(window.__KI_WS[m.type]))) : ws(m)); return h; };
    window.mockExtend(eval('(' + opptak + ')'));
    // «Skjult fane»: document.hidden + rAF stoppet til __show()
    const q = [], raf = window.requestAnimationFrame.bind(window);
    window.__hidden = false;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.__hidden });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (window.__hidden ? 'hidden' : 'visible') });
    window.requestAnimationFrame = (cb) => { if (window.__hidden) { q.push(cb); return 1e6 + q.length; } return raf(cb); };
    window.__show = () => { window.__hidden = false; document.dispatchEvent(new Event('visibilitychange')); q.splice(0).forEach((cb) => raf(cb)); };
  }, { F: FIX, opptak: brukOpptak.toString() });
  await p.addScriptTag({ path: bundle });
  await p.addScriptTag({ path: BC, type: 'module' });
  await p.waitForFunction(() => customElements.get('bubble-card'));
  const r = await p.evaluate(async (DIAG) => {
    const wait = (ms) => new Promise((q) => setTimeout(q, ms));
    const hass = window.mockHass(), res = {};
    // 1 · HA/Bubble setter element.layout/.preview/.editMode/.isPanel på kortet (hui-card._loadElement, uten try/catch)
    res.haProps = (window.customCards || []).map((c) => c.type).filter((t) => /^msh-/.test(t)).map((t) => {
      try { const el = document.createElement(t); el.layout = 'grid'; el.preview = false; el.editMode = false; el.isPanel = false; return null; } catch (e) { return `${t}: ${e.message}`; }
    }).filter(Boolean);
    // 2 · Skjelett: tegnet i connectedCallback, før hass
    const sk = document.createElement('msh-klima-card');
    sk.setConfig({ type: 'custom:msh-klima-card' });
    document.body.appendChild(sk);
    const skel = sk.shadowRoot.querySelector('[data-skeleton]');
    res.skjelett = !!skel && /–/.test(skel.textContent) && /Oversikt/.test(skel.textContent) && Math.round(sk.getBoundingClientRect().height) > 100;
    sk.remove();
    const all = () => { const o = []; const w = (x) => x.querySelectorAll('*').forEach((e) => { o.push(e); if (e.shadowRoot) w(e.shadowRoot); }); w(document); return o; };
    // Effektiv opasitet (gjennom shadow-grenser opp til dokumentet) og høyde
    const eop = (el) => { let o = 1; for (let n = el; n && n.nodeType === 1; n = n.parentNode && n.parentNode.nodeType === 11 ? n.parentNode.host : n.parentNode) { const c = getComputedStyle(n); if (c.display === 'none' || c.visibility === 'hidden') return 0; o *= Number(c.opacity); } return Math.round(o * 100) / 100; };
    const h = (el) => (el ? Math.round(el.getBoundingClientRect().height) : 0);
    const syn = (card) => {
      const sr = card && card.shadowRoot, hero = sr && sr.querySelector('msh-klima-hero-card'), hs = hero && hero.shadowRoot;
      const q = (x) => hs && hs.querySelector(x);
      const deler = { kort: card, kh: q('.kh'), stt: q('.stt'), sen: q('.sen'), ring: q('.ring'), us: q('.bar .us'), faner: sr && sr.querySelector('.trow'), innhold: sr && sr.querySelector('.kbody') };
      const o = {}; let ok = true;
      Object.entries(deler).forEach(([k, el]) => { const v = [eop(el), h(el)]; o[k] = v.join('/'); if (!(v[0] >= 0.99 && v[1] > 0)) ok = false; });
      const us = q('.bar .us'); if (us && !/matrix\(1, 0, 0, 1|none/.test(getComputedStyle(us).transform)) { ok = false; o.usTransform = getComputedStyle(us).transform; }
      const an = [...(sr ? sr.getAnimations() : []), ...(hs ? hs.getAnimations() : [])];
      o.anims = an.map((a) => { const t = a.effect.getComputedTiming(); return `${a.effect.target.getAttribute('class') || a.effect.target.localName}:${a.playState}:${t.fill}:${Math.round(a.currentTime || 0)}`; });
      if (an.some((a) => ['backwards', 'both'].includes(a.effect.getComputedTiming().fill))) ok = false;
      if (an.some((a) => a.effect.getComputedTiming().iterations !== Infinity && a.playState !== 'finished')) ok = false;
      o.ok = ok; return o;
    };
    // 3 · Kontrolltest: vanlig visning utenfor Bubble
    const plain = document.createElement('msh-klima-card');
    plain.setConfig({ type: 'custom:msh-klima-card' }); plain.hass = hass;
    document.getElementById('dash').appendChild(plain);
    await wait(2600);
    res.utenforBubble = syn(plain);
    plain.remove();
    // 4 · Via strategien: popupen lukket når kortet lages; hass oppdateres mens den er lukket; lang tid før åpning
    const S = customElements.get('ll-strategy-dashboard-ki-dashboard');
    const dash = await S.generate({}, hass);
    const stack = dash.views[0].cards[0], pop = stack.cards.find((c) => c.card_type === 'pop-up' && c.hash === '#klima');
    const els = [];
    for (const c of [stack.cards[1], pop]) { const el = document.createElement(c.type.replace('custom:', '')); el.setConfig(c); el.hass = hass; document.getElementById('dash').appendChild(el); els.push(el); }
    for (let i = 0; i < 5; i++) { await wait(800); const h2 = { ...hass, states: { ...hass.states } }; els.forEach((e) => (e.hass = h2)); }
    const card = () => { const pe = all().find((e) => e.classList && e.classList.contains('bubble-pop-up') && e.classList.contains('is-popup-opened')); return pe && [...pe.querySelectorAll('*')].find((e) => e.localName === 'msh-klima-card'); };
    // Åpnes mens fanen er «skjult» (rAF stoppet), vises 500 ms senere
    window.__hidden = true; location.hash = '#klima'; await wait(500); window.__show(); await wait(2600);
    res.lukketVedOppstart = syn(card());
    res.diag = await eval(DIAG);
    // 5 · Gjenåpning (Bubble kobler innholdet fra/til), også rask lukk/åpne
    const lukk = () => { history.replaceState(null, '', location.pathname); window.dispatchEvent(new Event('hashchange')); };
    lukk(); await wait(1500); location.hash = '#klima'; await wait(2600);
    res.gjenapnet = syn(card());
    for (let k = 0; k < 3; k++) { lukk(); await wait(40); location.hash = '#klima'; await wait(60); }
    await wait(2600);
    res.raskGjenapning = syn(card());
    // 6 · Vakten: gjør kortet usynlig (opacity 0 på verten), åpne på nytt → feilkort med diagnosen etter 3 s; synlig igjen → borte
    const c0 = card(); c0.style.opacity = '0';
    lukk(); await wait(700); location.hash = '#klima'; await wait(3600);
    const c1 = card(), fk = c1 && c1.shadowRoot.querySelector('[data-blank]');
    res.vakt = !!fk && /"synlig": false/.test(fk.textContent) && /"host"/.test(fk.textContent);
    c1.style.opacity = ''; await wait(3400);
    res.vaktBorte = !c1.shadowRoot.querySelector('[data-blank]');
    res.sammeKort = c1 === c0;
    return res;
  }, DIAG).catch((e) => ({ feil: e.message }));
  const d = r.diag || {}, f1 = d.fase1 || {};
  const diagOk = d.el === true && d.tag === 'msh-klima-card' && d.cards && d.cards[0] === 'custom:msh-klima-card' && f1.host && f1.host.height > 100 && f1.host.opacity === '1' && f1.hero && f1.hero.height > 100 && f1.state && f1.state.hasHass;
  const ok = !r.feil && !errs.length && !r.haProps.length && r.skjelett && r.utenforBubble.ok && r.lukketVedOppstart.ok && r.gjenapnet.ok && r.raskGjenapning.ok && r.vakt && r.vaktBorte && diagOk;
  if (!ok) fail++;
  const kort = { ...r }; kort.diag = diagOk ? 'ok' : r.diag;
  console.log(`${ok ? '✔' : '✘'} [16.13 ekte Bubble-oppførsel]`, JSON.stringify(kort), errs.slice(0, 4).join(' | '));
  await p.close();
}
await b.close();
process.exit(fail ? 1 : 0);
