// Fiks 32.2 + 32.3 · Garasje (#garasje, msh-garasje-card) – «Sjekk før levering» (uavhengig av dato/klokkeslett).
//   node test/garasje32-check.mjs            (SHOTS=<mappe> gir skjermbilder)
import { createRequire } from 'node:module';
import { readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const bundle = resolve(`test/.build/garasje32-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const shots = process.env.SHOTS || '';
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = {}, fail = [];
const ok = (name, cond, info) => { res[name] = cond ? 'OK' : ['FEIL', info]; if (!cond) fail.push(name); };
const mocks = readdirSync('test/mock').sort().map((m) => resolve('test/mock/' + m));
const errs = [];
async function mount({ cfg = {}, prep = 'window.mockGarasje({ light: "on", motion: true, brytere: true })', open = true, id = 'pop-garasje' } = {}) {
  const p = await b.newPage({ viewport: { width: 390, height: 1500 }, hasTouch: true });
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + resolve('test/harness.html'));
  for (const m of mocks) await p.addScriptTag({ path: m });
  await p.addScriptTag({ path: bundle });
  await p.evaluate(async ({ cfg, prep, open, id }) => {
    try { localStorage.clear(); } catch (e) { /* */ }
    if (prep) (0, eval)(prep);
    window.__h = window.mockHass();
    const bc = document.createElement('bubble-card');
    bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash: '#garasje' });
    bc.innerHTML = '<div class="pop" style="top:0"><div class="hdr">Garasje</div><div class="inner"></div></div>';
    document.getElementById('dash').appendChild(bc);
    location.hash = open ? '#garasje' : '#annet';
    const c = document.createElement('msh-garasje-card');
    c.setConfig({ type: 'custom:msh-garasje-card', card_id: id, ...cfg });
    c.hass = window.__h;
    bc.querySelector('.inner').appendChild(c);
    window.__c = c;
    window.__set = async (id, state, attrs) => { const S = window.__h.states, o = S[id]; window.__h = { ...window.__h, states: { ...S, [id]: { ...o, state, attributes: { ...o.attributes, ...(attrs || {}) }, last_changed: new Date().toISOString() } } }; window.__c.hass = window.__h; await new Promise((q) => setTimeout(q, 250)); };
    window.__hs = []; window.addEventListener('haptic', (e) => window.__hs.push(e.detail));
    await new Promise((q) => setTimeout(q, 700));
  }, { cfg, prep, open, id });
  return p;
}
const info = (p) => p.evaluate(() => {
  const c = window.__c, sr = c.shadowRoot, q = (s) => sr.querySelector(s), qa = (s) => [...sr.querySelectorAll(s)], r = (e) => e && e.getBoundingClientRect();
  const host = c.parentElement, hcs = getComputedStyle(host), btn = (a) => q(`[data-act="${a}"]`);
  const bs = (e) => e && { bg: getComputedStyle(e).backgroundImage !== 'none' ? 'pk' : getComputedStyle(e).backgroundColor, dis: e.getAttribute('aria-disabled') === 'true', w: Math.round(r(e).width), h: Math.round(r(e).height), col: getComputedStyle(e).color };
  const door = q('.gp-door'), open = q('.gp-open'), panel = q('.gp-panel');
  return {
    width: Math.round(r(c).width), host: Math.round(host.clientWidth - parseFloat(hcs.paddingLeft) - parseFloat(hcs.paddingRight)), vw: innerWidth, cards: host.children.length,
    sections: qa('.sk-wrap > *').map((e) => e.className.split(' ')[0]), picks: qa('.sk-pc').map((e) => e.querySelector('.sk-pcn').textContent + '|' + e.querySelector('.sk-pcs').textContent),
    gear: q('.sk-gear') && { right: Math.round(r(q('.sk-gear')).right), w: Math.round(r(q('.sk-gear')).width) },
    state: q('.sk-hstate').textContent, sub: q('.sk-hsub').textContent, chip: q('.sk-chip') && q('.sk-chip').textContent.trim(), blink: q('.sk-chip ha-icon') ? getComputedStyle(q('.sk-chip ha-icon')).animationName : '',
    door: door && { w: Math.round(r(door).width), h: Math.round(r(door).height), panel: panel && Math.round(r(panel).height / r(open).height * 100), panelStyle: panel && panel.style.height, light: q('.gp-light').style.background, bgImg: getComputedStyle(panel).backgroundImage },
    open: bs(btn('g-open')), stop: bs(btn('g-stop')), close: bs(btn('g-close')), conf: q('.gp-conf') && q('.gp-conf').textContent,
    tiles: qa('.sk-tile').map((e) => e.querySelector('.sk-tv').textContent + '|' + e.querySelector('.sk-tl').textContent), lightTile: q('.sk-tile[data-act="g-light"]') && getComputedStyle(q('.sk-tile[data-act="g-light"]')).backgroundColor,
    auto: q('.sk-auto') && { open: !!q('.sk-alist'), sub: q('.sk-auto .sk-ats').textContent, master: q('.sk-master').classList.contains('on'), rows: qa('.sk-ar').map((e) => e.querySelector('.sk-arl').textContent + (e.querySelector('.sk-sw.on') ? ':på' : e.querySelector('.sk-sw') ? ':av' : ':–')), mins: qa('.sk-mins button').map((e) => e.textContent + (e.classList.contains('on') ? '*' : '')), op: q('.sk-alist') ? getComputedStyle(q('.sk-alist')).opacity : null },
    hist: q('.sk-hist') && { sum: q('.sk-hs').textContent, filters: qa('.sk-fc').length, days: qa('.sk-dl').map((e) => e.textContent), rows: qa('.sk-hr').map((e) => e.querySelector('.sk-htt').textContent + ' | ' + (e.querySelector('.sk-hm') ? [...e.querySelector('.sk-hm').children].map((x) => x.textContent.trim()).join(' ') : '')), warn: qa('.sk-hr[data-kind="warn"] .sk-dot').map((d) => /0px 0px 0px 6px/.test(getComputedStyle(d).boxShadow)) },
  };
});
const calls = (p, dom) => p.evaluate((dom) => window.__calls.filter((c) => c[0] === dom).map((c) => [c[1], c[2] && c[2].entity_id]), dom);
const act = (p, a) => p.evaluate(async (a) => { window.__c.shadowRoot.querySelector(`[data-act="${a}"]`).click(); await new Promise((q) => setTimeout(q, 200)); }, a);
const clear = (p) => p.evaluate(() => { window.__calls.length = 0; window.__hs.length = 0; });

/* ---------------------------------------------------------------- åpnes, fyller bredden, ett kort, toppkortet */
let p = await mount();
let I = await info(p);
ok('32.2 fyller bredden (ett kort), rekkefølge velger → toppkort → status → automatikk → historikk', Math.abs(I.width - I.host) <= 1 && I.cards === 1 && I.sections.join() === 'sk-pick,sk-hero,sk-tiles,sk-auto,sk-hist', [I.width, I.host, I.sections]);
ok('32.2 én port: bare tannhjulet (høyrestilt)', I.picks.length === 0 && I.gear && I.gear.w === 56 && Math.abs(I.gear.right - (I.vw - 18)) <= 2, [I.picks, I.gear]);
ok('32.2 lukket: «Lukket», chip «Sikret», «Lukket av … · tid»', I.state === 'Lukket' && I.chip === 'Sikret' && /^Lukket av .+ · /.test(I.sub), [I.state, I.chip, I.sub]);
ok('32.2 portillustrasjon 118 × 104 (CSS, lameller), port 100 % ved current_position 0', I.door.w === 118 && I.door.h === 104 && I.door.panel === 100 && /repeating-linear-gradient/.test(I.door.bgImg), I.door);
ok('32.2 gult lys ovenfra når garasjelyset er på', /242, 210, 111/.test(I.door.light), I.door.light);
ok('32.2 Åpne · Stopp · Lukk (56 px, Stopp 64 px); Lukk deaktivert når lukket', I.open.h === 56 && I.stop.w === 64 && I.stop.h === 56 && I.close.dis && !I.open.dis && I.stop.dis, [I.open, I.stop, I.close]);
ok('32.2 statusfliser: Lys På (gul), Bevegelse Ingen, «Lukket i»', I.tiles[0] === 'På|Lys' && I.tiles[1] === 'Ingen|Bevegelse' && /\|Lukket i$/.test(I.tiles[2]) && /242, 210, 111/.test(I.lightTile), [I.tiles, I.lightTile]);
if (shots) await p.screenshot({ path: shots + '/garasje-1.png', fullPage: true });

/* ---------------------------------------------------------------- porten følger current_position, Stopp */
await clear(p);
await act(p, 'g-open');
let oc = await calls(p, 'cover');
I = await info(p);
ok('32.2 Åpne (ett trykk): cover.open_cover, haptic medium, optimistisk «Åpner …» med aktiv retning rosa', oc.length === 1 && oc[0][0] === 'open_cover' && I.state === 'Åpner …' && I.open.bg === 'pk' && (await p.evaluate(() => window.__hs.includes('medium'))), [oc, I.state, I.open]);
await p.evaluate(() => window.__set('cover.garasjeport', 'opening', { current_position: 45 }));
I = await info(p);
ok('32.2 i bevegelse: chip «I bevegelse» (blinker), «45 % åpen», Stopp rød', I.state === 'Åpner …' && I.chip === 'I bevegelse' && I.blink === 'sk-blink' && I.sub === '45 % åpen' && /242, 128, 115/.test(I.stop.bg) && !I.stop.dis, [I.chip, I.blink, I.sub, I.stop]);
ok('32.2 porten animeres med current_position (høyde 100 − 45 = 55 %)', I.door.panelStyle === '55%', I.door);
await clear(p);
await act(p, 'g-stop');
oc = await calls(p, 'cover');
ok('32.2 Stopp: cover.stop_cover, haptic heavy', oc.length === 1 && oc[0][0] === 'stop_cover' && (await p.evaluate(() => window.__hs.includes('heavy'))), oc);
await p.evaluate(() => window.__set('cover.garasjeport', 'open', { current_position: 45 }));
I = await info(p);
ok('32.2 stoppet halvveis: «Åpen 45 %»', I.state === 'Åpen 45 %' && I.door.panelStyle === '55%', [I.state, I.door]);
await p.evaluate(() => window.__set('cover.garasjeport', 'open', { current_position: 100 }));
I = await info(p);
ok('32.2 helt åpen: «Åpen», port 0 %, Åpne deaktivert, «Åpen i»', I.state === 'Åpen' && I.door.panelStyle === '0%' && I.open.dis && !I.close.dis && /\|Åpen i$/.test(I.tiles[2]), [I.state, I.door, I.open, I.tiles]);
ok('32.2 åpen + Autolukk: chip «Lukkes om 10 min»', I.chip === 'Lukkes om 10 min', I.chip);
await clear(p);
await act(p, 'g-close');
oc = await calls(p, 'cover');
I = await info(p);
ok('32.2 Lukk: cover.close_cover, «Lukker …», success når porten er lukket', oc.length === 1 && oc[0][0] === 'close_cover' && I.state === 'Lukker …', [oc, I.state]);
await p.evaluate(() => window.__set('cover.garasjeport', 'closing', { current_position: 30 }));
await p.evaluate(() => window.__set('cover.garasjeport', 'closed', { current_position: 0 }));
I = await info(p);
ok('32.3 haptic success når handlingen er ferdig', I.state === 'Lukket' && (await p.evaluate(() => window.__hs.includes('success'))), I.state);

/* ---------------------------------------------------------------- lys-flisen */
await clear(p);
await act(p, 'g-light');
const lc = await calls(p, 'homeassistant');
I = await info(p);
ok('32.2 Lys-flisen: trykk slår av (optimistisk)', lc.length === 1 && lc[0][0] === 'turn_off' && lc[0][1] === 'light.garasje' && I.tiles[0] === 'Av|Lys', [lc, I.tiles]);

/* ---------------------------------------------------------------- automatikk */
I = await info(p);
ok('32.2 automatikk lukket som standard, «3 av 4 på · autolukk 10 min»', !I.auto.open && I.auto.sub === '3 av 4 på · autolukk 10 min', I.auto);
await act(p, 'am-open');
I = await info(p);
const GA = await p.evaluate(() => window.MSH.garasjeAutos(window.__h, window.__c.config));
ok('32.2 kilde finnBrytere: Autolukk, Lukk når alle drar, Tesla, Åpen etter 22', GA.auto === 'switch.garasje_autolukk' && GA.away === 'switch.garasje_lukk_alle_drar' && GA.arrive === 'switch.garasje_tesla_ankomst' && GA.night === 'switch.garasje_apen_etter_22', GA);
ok('32.2 radene: Autolukk (5/10/15/30), Lukk når alle drar, Åpne når Tesla kommer, Varsle hvis åpen etter 22:00', I.auto.rows.join() === 'Autolukk:på,Lukk når alle drar:på,Åpne når Tesla kommer:på,Varsle hvis åpen etter 22:00:av' && I.auto.mins.join() === '5 min,10 min*,15 min,30 min', I.auto);
await clear(p);
await act(p, 'am-master');
I = await info(p);
ok('32.3 samme hovedbryter som Dørlås: av → alt av, dempet, utfoldet', !I.auto.master && I.auto.open && I.auto.op === '0.4' && (await calls(p, 'homeassistant')).length === 3, I.auto);
await clear(p);
await p.evaluate(async () => { window.__c.shadowRoot.querySelector('.sk-master').click(); await new Promise((q) => setTimeout(q, 150)); window.__c.shadowRoot.querySelector('.sk-mins button[data-v="15"]').click(); await new Promise((q) => setTimeout(q, 150)); });
const nm = await p.evaluate(() => window.__calls.filter((c) => c[0] === 'number').map((c) => [c[2].entity_id, c[2].value]));
ok('32.2 Autolukk 15 min → number.set_value', nm.length === 1 && nm[0][0] === 'number.garasje_autolukk_tid' && nm[0][1] === 15, nm);

/* ---------------------------------------------------------------- historikk */
I = await info(p);
ok('32.2 historikk: «2 åpninger i dag», ingen filtre, I dag + I går', I.hist.sum === '2 åpninger i dag' && I.hist.filters === 0 && I.hist.days.join() === 'I dag,I går', I.hist);
const want = ['Lukket | Fjernkontroll', 'Åpnet | Tesla Åpen i', 'Lukket | Alle dro', 'Åpnet | Appen Åpen i', 'Lukket | Autolukk', 'Åpen etter 22:00 | Autolukk Stod åpen – lukket', 'Åpnet | Fjernkontroll Åpen i 4 t 34 min'];
const rows = I.hist.rows.slice(-7);
ok('32.2 hendelser: Åpnet (oransje, «Åpen i X»), Lukket, Åpen etter 22:00 (rød glorie), metodene Appen/Autolukk/Tesla/Fjernkontroll/Alle dro', want.every((w, i) => rows[i] && rows[i].startsWith(w)) && I.hist.warn.length >= 1 && I.hist.warn.every(Boolean), I.hist.rows);
const lazy = await mount({ open: false, id: 'pop-garasje-lazy' });
const lz0 = await lazy.evaluate(() => window.__calls.filter((c) => c[1] === 'logbook/get_events').length);
await lazy.evaluate(async () => { location.hash = '#garasje'; await new Promise((q) => setTimeout(q, 500)); });
const lz1 = await lazy.evaluate(() => window.__calls.filter((c) => c[1] === 'logbook/get_events').length);
ok('32.2 logbook bare når popupen er åpen', lz0 === 0 && lz1 === 1, [lz0, lz1]);
await lazy.close();

/* ---------------------------------------------------------------- To trykk og Kun hjemme */
const p2 = await mount({ cfg: { open_confirm: 'to' } });
await clear(p2);
await act(p2, 'g-open');
let I2 = await info(p2);
const first = await calls(p2, 'cover');
ok('32.2 To trykk: første trykk gjør Åpne oransje + «Trykk «Åpne» igjen for å bekrefte», ingen åpning', first.length === 0 && /242, 181, 115/.test(I2.open.bg) && I2.conf === 'Trykk «Åpne» igjen for å bekrefte', [first, I2.open, I2.conf]);
await act(p2, 'g-open');
const second = await calls(p2, 'cover');
ok('32.2 To trykk: andre trykk innen 3 s åpner', second.length === 1 && second[0][0] === 'open_cover', second);
await p2.evaluate(() => window.__set('cover.garasjeport', 'closed', { current_position: 0 }));
await p2.evaluate(async () => { const c = window.__c; if (c._pend) Object.keys(c._pend).forEach((k) => { clearTimeout(c._pend[k].tm); delete c._pend[k]; }); c.update(); await new Promise((q) => setTimeout(q, 200)); });
await clear(p2);
await act(p2, 'g-open');
await p2.waitForTimeout(3300);
I2 = await info(p2);
await act(p2, 'g-open');
const late = await calls(p2, 'cover');
ok('32.2 To trykk: etter 3 s må det bekreftes på nytt', !I2.conf && late.length === 0, [I2.conf, late]);
await p2.close();
const p3 = await mount({ cfg: { open_confirm: 'borte' }, prep: 'window.mockGarasje({}); window.mockExtend(({ S }) => { Object.keys(S).filter((k) => k.startsWith("person.") || k.startsWith("device_tracker.")).forEach((k) => { S[k].state = "not_home"; }); })' });
await clear(p3);
let I3 = await info(p3);
await act(p3, 'g-open');
const away = await calls(p3, 'cover');
ok('32.2 Kun hjemme: ingen hjemme → Åpne deaktivert, ingen åpning', I3.open.dis && away.length === 0 && /hjemme/.test(I3.conf || ''), [I3.open, I3.conf, away]);
await p3.evaluate(() => window.__set('person.sebastian', 'home'));
await act(p3, 'g-open');
const home = await calls(p3, 'cover');
ok('32.2 Kun hjemme: noen hjemme → åpner', home.length === 1 && home[0][0] === 'open_cover', home);
await p3.close();

/* ---------------------------------------------------------------- to porter */
const p4 = await mount({ prep: 'window.mockGarasje({ two: true })' });
const I4 = await info(p4);
ok('32.2 to porter: velgeren (samme kort som Dørlås) + tannhjul, tilstand per port', I4.picks.join() === 'Garasjeport|Lukket,Port 2|Åpen' && I4.gear.right <= I4.vw, I4.picks);
const T4 = await p4.evaluate(async () => { window.__c.shadowRoot.querySelector('.sk-gear').click(); await new Promise((q) => setTimeout(q, 400)); const R = window.MSH.portals().find((x) => x.shadowRoot.querySelector('.sk-sheet')).shadowRoot; const t = [...R.querySelectorAll('.sk-sh-tab')].map((e) => e.textContent); R.querySelector('[data-a="done"]').click(); await new Promise((q) => setTimeout(q, 400)); return t; });
ok('32.2 Tilpass: fanen heter «Porter» med to porter', T4.join() === 'Porter,Seksjoner,Sikkerhet', T4);
if (shots) await p4.screenshot({ path: shots + '/garasje-2.png', fullPage: true });
await p4.close();

/* ---------------------------------------------------------------- Tilpass garasje → config → GUI-editoren */
const TP = await p.evaluate(async () => {
  const w = (ms) => new Promise((q) => setTimeout(q, ms)), M = window.MSH, c = window.__c;
  c.shadowRoot.querySelector('.sk-gear').click(); await w(500);
  const R = M.portals().find((x) => x.shadowRoot.querySelector('.sk-sheet')).shadowRoot, q = (s) => R.querySelector(s), qa = (s) => [...R.querySelectorAll(s)];
  const sh = q('.sh').getBoundingClientRect();
  const out = { top: Math.round(sh.top), bottom: Math.round(sh.bottom), vh: innerHeight, title: q('.sk-sh-tt').textContent, tabs: qa('.sk-sh-tab').map((e) => e.textContent), names: qa('.sk-in').map((e) => e.value), rows: qa('.sk-ent').map((e) => e.querySelector('.sk-ats').textContent + ':' + e.querySelector('.sk-echip').textContent), h: [Math.round(sh.height)] };
  q('.sk-bytt[data-k="light:garasjeport"]').click(); await w(300);
  out.picker = !!q('msh-entity-picker');
  q('msh-entity-picker').dispatchEvent(new CustomEvent('value-changed', { detail: { value: 'none' }, bubbles: true, composed: true })); await w(150);
  q('[data-a="tab"][data-k="secs"]').click(); await w(150); out.h.push(Math.round(q('.sh').getBoundingClientRect().height));
  q('[data-a="bool"][data-k="show_hist"]').click(); await w(100);
  q('[data-a="tab"][data-k="safe"]').click(); await w(150); out.h.push(Math.round(q('.sh').getBoundingClientRect().height));
  q('[data-a="conf"][data-v="to"]').click(); await w(100);
  out.note = q('.sk-note').textContent;
  out.previewHist = !!c.shadowRoot.querySelector('.sk-hist');
  q('[data-a="done"]').click(); await w(900);
  out.stored = M.store.get('cards.pop-garasje');
  out.lightTile = c.shadowRoot.querySelector('.sk-tile').textContent.trim();
  const ed = c.constructor.getConfigElement(); ed.hass = window.__h; ed.setConfig(c._rawConfig); document.body.appendChild(ed); await w(300);
  const E = ed.shadowRoot;
  out.gui = { conf: [...E.querySelectorAll('[data-name="open_confirm"].on')].map((e) => e.dataset.v), hist: (E.querySelector('[data-name="show_hist"]') || {}).className };
  ed.remove();
  return out;
});
ok('32.2 Tilpass garasje: 52 px fra toppen (Fiks 40) til bunnen, fanene Port · Seksjoner · Sikkerhet, samme høyde', TP.top === 52 && TP.bottom === TP.vh && TP.title === 'Tilpass garasje' && TP.tabs.join() === 'Port,Seksjoner,Sikkerhet' && new Set(TP.h).size === 1, TP);
ok('32.2 Port: navn + Port/Lys/Bevegelse med Auto og «Bytt» (søkbar velger)', TP.names.join() === 'Garasjeport' && TP.rows.join() === 'Port:Auto,Lys:Auto,Bevegelse:Auto' && TP.picker, TP);
ok('32.2 «Åpne krever» To trykk med forklaring; forhåndsvisning skjuler Historikk', /andre trykk innen 3 s/.test(TP.note) && !TP.previewHist, TP);
ok('32.2 Ferdig lagrer i config (open_confirm, show_hist, doors_cfg.light = none)', TP.stored && TP.stored.open_confirm === 'to' && TP.stored.show_hist === false && TP.stored.doors_cfg && TP.stored.doors_cfg.garasjeport.light === 'none' && /^–\s*Lys/.test(TP.lightTile), TP);
ok('32.2 GUI-editoren viser de samme valgene', TP.gui.conf.join() === 'to' && !/\bon\b/.test(TP.gui.hist), TP.gui);
await p.close();

/* ---------------------------------------------------------------- strategien: #garasje autogenereres bare med garasjeport */
const ps = await mount();
const ST = await ps.evaluate(async () => {
  const M = window.MSH, h = window.__h;
  const has = M.FUNCTION_POPUPS.find((x) => x[0] === '#garasje'), need = M.popupNeeds['#garasje'](h);
  const h2 = { ...h, states: Object.fromEntries(Object.entries(h.states).filter(([k]) => !k.startsWith('cover.garasjeport'))) };
  return { has: has && has[3], need, need2: M.popupNeeds['#garasje'](h2) };
});
ok('32.2 registrert som ny popup (#garasje → msh-garasje-card, bare med cover garage)', ST.has === 'msh-garasje-card' && ST.need && !ST.need2, ST);
await ps.close();

ok('ingen sidefeil', !errs.length, errs.slice(0, 5));
await b.close();
for (const [k, v] of Object.entries(res)) console.log(v === 'OK' ? '✔' : '✘', k, v === 'OK' ? '' : JSON.stringify(v[1]).slice(0, 700));
console.log(fail.length ? `\n${fail.length} feilet` : '\nAlle bestod');
process.exit(fail.length ? 1 : 0);
