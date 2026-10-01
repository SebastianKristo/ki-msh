// Fiks 27.5–27.7 · Innstillinger (#settings, msh-innstillinger-card) mot design/Innstillinger v2.dc.html:
//  27.5 kun varsel-brytere, faner = varsel-kategorier · Tilpass-arket med fast høyde i alle 4 faner · live forhåndsvisning
//       av fanelinjen · show_summary (Avansert + Rader + GUI)
//  27.6 trykk på hele God natt-kortet · optimistisk UI med «Synker …» og tilbakerulling (natt + privat) · kameraet på veggfeste
//  27.7 «Legg til fane» fra KI Varslinger-kategorier (custom_tabs) · 4+ faner · God morgen + soloppgang · Toppkort-scene
// Klokka styres med MSH.innstNow (ingen avhengighet av tidspunktet testen kjøres).
//   node test/innstillinger27-check.mjs   (SHOTS=<mappe> for skjermbilder)
import { createRequire } from 'node:module';
import { readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const bundle = resolve(`test/.build/innst27-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const shots = process.env.SHOTS || '';
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = {}, fail = [];
const ok = (name, cond, info) => { res[name] = cond ? 'OK' : ['FEIL', info]; if (!cond) fail.push(name); };
const mocks = readdirSync('test/mock').sort().map((m) => resolve('test/mock/' + m));
const errs = [];
const NATT = 'switch.nattmodus', PRIV = 'input_boolean.innendors_privace_mode';
// o: { now: [t, m], states: { id: state }, vp }
async function page(cfg, o = {}) {
  const p = await b.newPage({ viewport: o.vp || { width: 360, height: 900 }, hasTouch: true });
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + resolve('test/harness.html'));
  for (const m of mocks) await p.addScriptTag({ path: m });
  await p.addScriptTag({ path: bundle });
  await p.evaluate(async ([cfg, o]) => {
    const [hh, mm] = o.now || [14, 0];
    window.__now = new Date(2026, 0, 15, hh, mm);
    window.MSH.innstNow = () => window.__now;
    const h = window.mockHass();
    Object.entries(o.states || {}).forEach(([id, st]) => { h.states[id] = { ...h.states[id], state: st }; });
    window.__h = h;
    window.__hap = []; window.addEventListener('haptic', (e) => window.__hap.push(e.detail));
    const bc = document.createElement('bubble-card');
    bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash: '#settings' });
    bc.innerHTML = '<div class="pop"><div class="hdr">Innstillinger</div><div class="inner"></div></div>';
    document.getElementById('dash').appendChild(bc);
    location.hash = '#settings';
    const c = document.createElement('msh-innstillinger-card');
    c.setConfig({ type: 'custom:msh-innstillinger-card', card_id: 'pop-innstillinger', dashbord: false, ...(cfg || {}) });
    c.hass = window.__h;
    bc.querySelector('.inner').appendChild(c);
    window.__c = c;
    await new Promise((q) => setTimeout(q, 600));
  }, [cfg || {}, o]);
  return p;
}
const wait = (p, ms) => p.evaluate((ms) => new Promise((q) => setTimeout(q, ms)), ms);
const click = async (p, sel) => { await p.evaluate((sel) => window.__c.shadowRoot.querySelector(sel).click(), sel); await wait(p, 300); };
const shot = async (p, n) => { if (shots) await p.screenshot({ path: `${shots}/innst27-${n}.png`, fullPage: true }); };
const setState = (p, id, st) => p.evaluate(({ id, st }) => { const h = window.__h; window.__h = { ...h, states: { ...h.states, [id]: { ...h.states[id], state: st } } }; window.__c.hass = window.__h; }, { id, st });
const calls = (p) => p.evaluate(() => window.__calls.splice(0).filter((c) => c[2] && c[2].entity_id).map((c) => `${c[0]}.${c[1]}:${[].concat(c[2].entity_id).join("+")}`));
const top = (p) => p.evaluate(() => { const sr = window.__c.shadowRoot, sc = sr.querySelector('.sc'), two = sr.querySelector('.two'); return sc ? { kind: 'scene', cls: sc.className, k: [...sc.querySelectorAll('.stx .k')].map((x) => x.textContent.trim()), t: sc.querySelector('.gt').textContent.trim(), sync: !!sc.querySelector('.sync'), chips: [...sc.querySelectorAll('.cp')].map((x) => x.textContent.trim()) } : two ? { kind: 'split', natt: two.querySelector('.mk.natt .mv').textContent.trim(), nsync: !!two.querySelector('.mk.natt .sync'), priv: two.querySelector('.mk.priv .mv').textContent.trim(), psync: !!two.querySelector('.mk.priv .sync'), pon: two.querySelector('.mk.priv').classList.contains('on') } : null; });
const edOf = (p) => p.evaluate(() => { const find = (root) => { for (const x of root.querySelectorAll('*')) { if (x.localName === 'msh-editor') return x; if (x.shadowRoot) { const y = find(x.shadowRoot); if (y) return y; } } return null; }; window.__ed = find(window.MSH.overlayRoot()); return !!window.__ed; });

// ================================================================ 27.5 · kun varsler
{
  const p = await page();
  const K = await p.evaluate(() => {
    const M = window.MSH, h = window.__h, T = M.innstTabs({}), rows = T.flatMap((t) => M.innstRows(h, {}, t.key));
    return { tabs: T.map((t) => `${t.key}:${t.name}:${t.icon}`), dom: [...new Set(rows.map((r) => r.id.split('.')[0]))], plat: [...new Set(rows.map((r) => r.plattform))], names: rows.map((r) => r.name), kat: M.innstKategorier(h, {}).map((k) => `${k.key}:${k.count}`) };
  });
  ok('27.5 faner = varsel-kategorier: Sikkerhet (shield) · Hjem (home) · Strøm (lyn)', K.tabs.join() === 'sikkerhet:Sikkerhet:mdi:shield,hjem:Hjem:mdi:home,strom:Strøm:mdi:lightning-bolt', K.tabs);
  ok('27.5 bare varsel-brytere: switch/input_boolean fra ki_notifications, ki_energi og input_boolean.varsel_* – ingen automasjoner, KI Utelys eller synk', K.dom.every((d) => ['switch', 'input_boolean'].includes(d)) && K.plat.every((x) => ['ki_notifications', 'ki_energi', 'demo'].includes(x)) && !K.names.some((n) => /Vekking|Ansikt|Autolås|Dørlys|Heimdall|Utelys/.test(n)), K);
  ok('27.7 kategoriene autooppdages med antall regler (Hjem 5 – Støvsuger teller som én regel, Kamera 2, Klima 1)', K.kat.join() === 'hjem:5,kamera:2,klima:1,sikkerhet:3,strom:9', K.kat);
  // ------------------------------------------------ 27.6 · kameraet på veggfeste
  const G = await p.evaluate(() => { const k = window.__c.shadowRoot.querySelector('.mk.priv'), kr = k.getBoundingClientRect(), r = (s) => k.querySelector(s).getBoundingClientRect(), ci = r('.ci'), m = r('.pmount'), t = k.querySelector('.ptilt'); return { mountTop: Math.round(m.top - kr.top), mountRight: Math.round(kr.right - m.right), ciBottom: Math.round(ci.bottom - kr.top), tiltTop: t.offsetTop, ease: getComputedStyle(t).transitionTimingFunction, dur: getComputedStyle(t).transitionDuration, origin: getComputedStyle(t).transformOrigin, w: k.querySelector('.pbody').offsetWidth }; });
  ok('27.6 kamera på veggfeste til høyre (top 74 px), under ikonknappen (ikke bak den), vipp med spring-easing .7 s', G.mountTop === 74 && G.mountRight === 0 && G.ciBottom <= 74 && G.tiltTop >= G.ciBottom && /cubic-bezier\(0\.34, 1\.3, 0\.64, 1\)/.test(G.ease) && G.dur === '0.7s' && G.w === 50, G);
  const P = await p.evaluate(() => { const css = window.__c.shadowRoot.querySelector('style').textContent; const anim = /\.(ptilt|pscan|pcone|plid|prec|lk)[^{]*\{[^}]*\}/g; return (css.match(anim) || []).filter((r) => /transition:/.test(r)).map((r) => r.replace(/^[^{]*\{/, '').match(/transition:([^;}]*)/)[1]); });
  ok('27.6 kameraet animerer bare transform/opacity (+ farge), ingen layoutendring (lokket = scaleY)', P.length && P.every((t) => !/height|width|top|left|right|margin|padding/.test(t)), P);
  await p.close();
}

// ================================================================ 27.6 · God natt-kortet, optimistisk UI, tilbakerulling
{
  const p = await page({}, { states: { [NATT]: 'on' } });
  await wait(p, 200);
  const T0 = await top(p);
  ok('nattmodus på: «God natt»-kortet (184 px) med «Nattmodus på» + vekketid og chipsene Natt på / Privat på', T0.kind === 'scene' && /night/.test(T0.cls) && T0.t === 'God natt' && T0.k[0] === 'Nattmodus på' && /^Vekking kl\. \d\d:\d\d$/.test(T0.k[1]) && T0.chips.join() === 'Natt på,Privat på', T0);
  const H = await p.evaluate(() => Math.round(window.__c.shadowRoot.querySelector('.sc').getBoundingClientRect().height));
  ok('«God natt»-kortet er 184 px', H === 184, H);
  await shot(p, '1-god-natt');
  // chips stopper propagation: bare privat
  await calls(p);
  await click(p, '.sc .cp.p');
  const C1 = await calls(p), T1 = await top(p);
  ok('chip «Privat på»: bare privatmodus (turn_off), kortet trigges ikke; chipen bytter straks + «Synker …»', C1.join() === `homeassistant.turn_off:${PRIV}` && T1.kind === 'scene' && T1.chips[1] === 'Kamera på' && T1.sync, { C1, T1 });
  await setState(p, PRIV, 'off'); await wait(p, 150);
  const T2 = await top(p);
  ok('hass bekrefter → «Synker …» forsvinner', !T2.sync && T2.chips[1] === 'Kamera på', T2);
  // trykk på HELE kortet (tekstflaten) → nattmodus av, byttes straks (kl. 14 → to kort) med «Synker …»
  await p.evaluate(() => window.__c.shadowRoot.querySelector('.sc .gt').click()); await wait(p, 200);
  const C3 = await calls(p), T3 = await top(p);
  ok('trykk på hele God natt-kortet: turn_off nattmodus + kortet byttes UMIDDELBART (to kort, Nattmodus «Av» + «Synker …»)', C3.join() === `homeassistant.turn_off:${NATT}` && T3.kind === 'split' && T3.natt === 'Av' && T3.nsync, { C3, T3 });
  await shot(p, '2-synker');
  await setState(p, NATT, 'off'); await wait(p, 150);
  const T4 = await top(p);
  ok('hass bekrefter natt av → ingen «Synker …»', T4.kind === 'split' && !T4.nsync, T4);
  // tilbakerulling: ingen bekreftelse innen MSH.innstSyncMs (10 s i drift, 700 ms her)
  await p.evaluate(() => { window.MSH.innstSyncMs = 700; window.__hap.length = 0; });
  await click(p, '.mk.natt');
  const T5 = await top(p), C5 = await calls(p);
  ok('Nattmodus-kortet: turn_on + God natt-kortet straks (optimistisk) med «Synker …»', C5.join() === `homeassistant.turn_on:${NATT}` && T5.kind === 'scene' && T5.t === 'God natt' && T5.sync, { T5, C5 });
  await wait(p, 900);
  const T6 = await top(p), toast = await p.evaluate(() => { const t = window.MSH.overlayRoot().querySelector('#msh-toast'); return t ? t.textContent.trim() : ''; }), hap = await p.evaluate(() => window.__hap.slice());
  ok('ingen bekreftelse innen fristen → rulles tilbake (to kort, «Av») + kort feilmelding + haptic warning', T6.kind === 'split' && T6.natt === 'Av' && !T6.nsync && /Fikk ikke svar fra Nattmodus/.test(toast) && hap.includes('warning'), { T6, toast, hap });
  // privatmodus: samme tilbakerulling
  await click(p, '.mk.priv');
  const T7 = await top(p);
  ok('Privatmodus: kortet bytter straks («På», kamera vippet) + «Synker …»', T7.kind === 'split' && T7.priv === 'På' && T7.pon && T7.psync, T7);
  await wait(p, 900);
  const T8 = await top(p);
  ok('Privatmodus uten bekreftelse → rulles tilbake («Av»)', T8.priv === 'Av' && !T8.pon && !T8.psync, T8);
  await p.close();
}

// ================================================================ 27.7 · God morgen + Toppkort-scene
{
  const p = await page({}, { now: [7, 0] });
  await wait(p, 200);
  const M0 = await top(p);
  const A = await p.evaluate(() => { const sc = window.__c.shadowRoot.querySelector('.sc'), an = (s) => getComputedStyle(sc.querySelector(s)); return { sun: an('.sunw').animationName + ' ' + an('.sunw').animationDuration, dawn: an('.dawn').animationName, birds: an('.birds').opacity, moon: an('.moon').opacity }; });
  ok('God morgen (kl. 07, nattmodus av): «Nattmodus av» · «God morgen» · «Ha en fin dag»', M0.kind === 'scene' && /morning/.test(M0.cls) && !/night/.test(M0.cls) && M0.t === 'God morgen' && M0.k.join() === 'Nattmodus av,Ha en fin dag' && M0.chips[0] === 'Natt av', M0);
  ok('soloppgang: sola stiger (sunrise 2,6 s), himmelen fader fra natt-lilla (dawnsky), fugler, ingen måne', A.sun === 'sunrise 2.6s' && A.dawn === 'dawnsky' && A.birds === '1' && A.moon === '0', A);
  await shot(p, '3-god-morgen');
  await calls(p);
  await p.evaluate(() => window.__c.shadowRoot.querySelector('.sc').click()); await wait(p, 200);
  const M1 = await top(p), C = await calls(p);
  ok('trykk på God morgen-kortet: turn_on nattmodus → God natt straks i samme kort', C.join() === `homeassistant.turn_on:${NATT}` && M1.kind === 'scene' && /night/.test(M1.cls) && M1.t === 'God natt' && M1.sync, { M1, C });
  await setState(p, NATT, 'on'); await wait(p, 100); await setState(p, NATT, 'off'); await wait(p, 100);
  await p.evaluate(() => { window.__now = new Date(2026, 0, 15, 11, 0); window.__c.update(); }); await wait(p, 150);
  const M2 = await top(p);
  ok('etter kl. 11 → vanlig todelt kort', M2.kind === 'split', M2);
  await p.evaluate(() => { window.__now = new Date(2026, 0, 15, 4, 30); window.__c.update(); }); await wait(p, 150);
  const M3 = await top(p);
  await p.evaluate(() => { const h = window.__h; window.__h = { ...h, states: { ...h.states, 'sensor.soverom_vekking_neste_alarm': { ...h.states['sensor.soverom_vekking_neste_alarm'], state: '04:15:00' } } }; window.__c.hass = window.__h; }); await wait(p, 150);
  const M4 = await top(p);
  ok('kl. 04:30: to kort før vekketid (06:45), God morgen etter vekketid (04:15)', M3.kind === 'split' && M4.kind === 'scene' && M4.t === 'God morgen', { M3, M4 });
  await p.close();
  // Toppkort-scene
  const sc = async (scene, o) => { const q = await page({ scene }, o); await wait(q, 150); const t = await top(q); await q.close(); return t; };
  const S1 = await sc('dag', { states: { [NATT]: 'on' }, now: [23, 0] }), S2 = await sc('morgen', { now: [15, 0] }), S3 = await sc('natt', { now: [15, 0] }), S4 = await sc('auto', { now: [15, 0] });
  ok('Toppkort-scene: Kun kort = alltid to kort, God morgen = morgenkortet, God natt = natt-kortet (ærlig «Nattmodus av»), Automatisk kl. 15 = to kort', S1.kind === 'split' && S1.natt === 'På' && S2.kind === 'scene' && S2.t === 'God morgen' && S3.kind === 'scene' && S3.t === 'God natt' && S3.k[0] === 'Nattmodus av' && S4.kind === 'split', { S1, S2, S3, S4 });
}

// ================================================================ 27.5 + 27.7 · Tilpass-arket
{
  const p = await page({}, { vp: { width: 390, height: 900 } });
  await click(p, '.bar .gear'); await wait(p, 600); await edOf(p);
  const H = await p.evaluate(async () => {
    const sr = window.__ed.shadowRoot, sh = window.__ed.getRootNode().querySelector('.sh'), w = (ms) => new Promise((q) => setTimeout(q, ms)), out = {};
    for (const t of ['faner', 'rader', 'entiteter', 'avansert']) { sr.querySelector(`[data-a="tab"][data-v="${t}"]`).click(); await w(250); out[t] = Math.round(sh.getBoundingClientRect().height); }
    sr.querySelector('[data-a="tab"][data-v="faner"]').click(); await w(200);
    out.stickyTabs = getComputedStyle(sr.querySelector('.wrap>.chips.sg.tabs')).position;
    out.cancel = getComputedStyle(sr.querySelector('.ttl .hb[data-a="cancel"]')).display;
    return out;
  });
  ok('27.5 Tilpass-arket: samme faste høyde i alle 4 faner = min(660 px, 100 % − 52 px) → 660 ved 900 px', ['faner', 'rader', 'entiteter', 'avansert'].every((k) => H[k] === 660) && H.stickyTabs === 'sticky' && H.cancel === 'none', H);
  // forhåndsvisning
  const pv = () => p.evaluate(() => { const v = window.__ed.shadowRoot.querySelector('.pvw'); return { tabs: [...v.querySelectorAll('.tb')].map((t) => (t.querySelector('ha-icon') ? 'i:' : '') + (t.querySelector('.tl') ? t.querySelector('.tl').textContent.trim() : '')), gear: !!v.querySelector('.gear ha-icon'), pe: getComputedStyle(v.querySelector('.pvb')).pointerEvents, on: (v.querySelector('.tb.on .tl') || {}).textContent, hdr: v.closest('.fsec').querySelector('.fsh').textContent.trim() }; });
  const V0 = await pv();
  ok('27.5 forhåndsvisning øverst i Faner: fanelinjen + tannhjul, ikke trykkbar', V0.hdr === 'Forhåndsvisning' && V0.tabs.join() === 'i:Sikkerhet,i:Hjem,i:Strøm' && V0.gear && V0.pe === 'none' && V0.on === 'Sikkerhet', V0);
  await p.evaluate(async () => {
    const ed = window.__ed, sr = ed.shadowRoot, w = (ms) => new Promise((q) => setTimeout(q, ms));
    ed.__edDrop['inn-tab'](['strom', 'sikkerhet', 'hjem']); await w(200);
    const i = sr.querySelector('input[data-inn="tname"][data-v="hjem"]'); i.value = 'Huset'; i.dispatchEvent(new Event('change', { bubbles: true, composed: true })); await w(200);
    sr.querySelector('[data-op="teye"][data-v="sikkerhet"]').click(); await w(200);
  });
  const V1 = await pv();
  await p.evaluate(async () => { window.__ed.shadowRoot.querySelector('[data-name="tab_labels"][data-v="name"]').click(); await new Promise((q) => setTimeout(q, 200)); });
  const V2 = await pv();
  await p.evaluate(async () => { window.__ed.shadowRoot.querySelector('[data-name="tab_labels"][data-v="ikon"]').click(); await new Promise((q) => setTimeout(q, 200)); });
  const V3 = await pv(), card = await p.evaluate(() => [...window.__c.shadowRoot.querySelectorAll('.bar .tb')].map((t) => t.getAttribute('aria-label') + (t.querySelector('.tl') ? '' : ':ikon')));
  ok('27.5 forhåndsvisningen følger live: rekkefølge, navn, skjult fane og «Faner viser» (tekst / ikoner)', V1.tabs.join() === 'i:Strøm,i:Huset' && V2.tabs.join() === 'Strøm,Huset' && V3.tabs.join() === 'i:,i:' && card.join() === 'Strøm:ikon,Huset:ikon', { V1, V2, V3, card });
  await p.evaluate(async () => { window.__ed.shadowRoot.querySelector('[data-name="tab_labels"][data-v="icon"]').click(); await new Promise((q) => setTimeout(q, 150)); window.__ed.shadowRoot.querySelector('[data-op="teye"][data-v="sikkerhet"]').click(); await new Promise((q) => setTimeout(q, 200)); });
  // show_summary – Rader (designet) og Avansert
  const SS = await p.evaluate(async () => {
    const sr = window.__ed.shadowRoot, w = (ms) => new Promise((q) => setTimeout(q, ms)), cnt = () => !!window.__c.shadowRoot.querySelector('.cnt');
    sr.querySelector('[data-a="tab"][data-v="rader"]').click(); await w(250);
    const inRader = sr.querySelectorAll('[data-name="show_summary"]').length, t = sr.querySelector('[data-name="show_summary"]').closest('.f').textContent.replace(/\s+/g, ' ').trim();
    const c0 = cnt(); sr.querySelector('[data-name="show_summary"]').click(); await w(250);
    const v = window.__ed._config.show_summary, c1 = cnt();
    sr.querySelector('[data-a="tab"][data-v="avansert"]').click(); await w(250);
    const adv = sr.querySelector('[data-name="show_summary"]'), advOff = !adv.classList.contains('on');
    const scene = [...sr.querySelectorAll('[data-name="scene"]')].map((x) => x.textContent.trim());
    const reset = !!sr.querySelector('[data-op="reset"]');
    adv.click(); await w(250);
    return { inRader, t, c0, v, c1, advOff, c2: cnt(), v2: window.__ed._config.show_summary, scene, reset };
  });
  ok('27.5 «Antall på + «Slå alle»» (show_summary) i Rader og Avansert: av skjuler «N av N på» og «Slå alle»', SS.inRader === 1 && /Antall på \+ «Slå alle»/.test(SS.t) && SS.c0 && SS.v === false && !SS.c1 && SS.advOff && SS.c2 && SS.v2 === true, SS);
  ok('27.7 Avansert → Toppkort-scene: Automatisk · God morgen · Kun kort · God natt + «Tilbakestill til standard»', SS.scene.join() === 'Automatisk,God morgen,Kun kort,God natt' && SS.reset, SS);
  // Entiteter (designet): ikon, navn, entitet, chevron → søk
  const EN = await p.evaluate(async () => {
    const sr = window.__ed.shadowRoot, w = (ms) => new Promise((q) => setTimeout(q, ms));
    sr.querySelector('[data-a="tab"][data-v="entiteter"]').click(); await w(250);
    const rows = [...sr.querySelectorAll('.ient')].map((r) => r.querySelector('.nm').textContent.replace(/\s+/g, ' ').trim());
    sr.querySelector('[data-op="entopen"][data-v="natt"]').click(); await w(200);
    const q = sr.querySelector('[data-edq="inn-ent"]'); q.value = 'natt'; q.dispatchEvent(new Event('input', { bubbles: true, composed: true })); await w(200);
    const hits = [...sr.querySelectorAll('[data-op="entset"]')].map((x) => x.dataset.id);
    const pick = hits.find((x) => x !== 'switch.nattmodus');
    if (pick) sr.querySelector(`[data-op="entset"][data-id="${pick}"]`).click(); await w(200);
    const v = window.__ed._config.natt;
    sr.querySelector('[data-op="entopen"][data-v="natt"]').click(); await w(200);
    sr.querySelector('[data-op="entauto"]').click(); await w(200);
    return { rows, hits, pick, v, v2: window.__ed._config.natt };
  });
  ok('Entiteter (designet): Nattmodus/Privatmodus/Vekketid med entitet, søk → velg (natt) → «Automatisk» fjerner overstyringen', EN.rows.length === 3 && /^Nattmodusswitch\.nattmodus · automatisk$/.test(EN.rows[0]) && EN.hits.includes('switch.nattmodus') && EN.pick && EN.v === EN.pick && EN.v2 === undefined, EN);
  await p.evaluate(async () => { window.__ed.shadowRoot.querySelector('[data-a="tab"][data-v="faner"]').click(); await new Promise((q) => setTimeout(q, 250)); });
  // ------------------------------------------------ 27.7 · Legg til fane
  const AD = await p.evaluate(async () => {
    const ed = window.__ed, sr = ed.shadowRoot, w = (ms) => new Promise((q) => setTimeout(q, ms));
    sr.querySelector('[data-op="ntopen"]').click(); await w(250);
    const lbl = sr.querySelector('.ntl').textContent.trim();
    const srcs = [...sr.querySelectorAll('[data-op="ntsrc"]')].map((x) => x.querySelector('.nm').textContent.replace(/\s+/g, ' ').trim());
    const dis0 = sr.querySelector('.ntgo').disabled;
    sr.querySelector('[data-op="ntsrc"][data-v="kamera"]').click(); await w(200);
    const name = sr.querySelector('input[data-inn="ntname"]').value, icon = (sr.querySelector('.nti button.on ha-icon') || {}).getAttribute && sr.querySelector('.nti button.on ha-icon').getAttribute('icon'), dis1 = sr.querySelector('.ntgo').disabled;
    sr.querySelector('[data-op="nticon"][data-v="mdi:paw"]').click(); await w(150);
    const n2 = sr.querySelector('input[data-inn="ntname"]'); n2.value = 'Kamera ute'; n2.dispatchEvent(new Event('input', { bubbles: true, composed: true })); n2.dispatchEvent(new Event('change', { bubbles: true, composed: true })); await w(100);
    sr.querySelector('[data-op="ntadd"]').click(); await w(300);
    const c = ed._config;
    return { lbl, srcs, dis0, name, icon, dis1, ct: c.custom_tabs, tabs: c.tabs.map((t) => t.key), rows: [...sr.querySelectorAll('[data-elist="inn-tab"]')].map((r) => r.dataset.edk + (r.querySelector('.idel') ? ':slett' : '')), open: !!sr.querySelector('.ntp') };
  });
  ok('27.7 «Legg til fane»: kilder fra KI Varslinger med antall (Kamera 2 regler, Klima 1 regel), navn + ikon fylles fra kategorien', AD.lbl === 'Varsler fra KI Varslinger' && AD.srcs.join() === 'Kamera2 regler,Klima1 regel' && AD.dis0 && AD.name === 'Kamera' && AD.icon === 'mdi:video' && !AD.dis1, AD);
  ok('27.7 lagt til → custom_tabs [{ key, name, icon, source }] + tabs[], egen fane med søppelkasse', AD.ct && AD.ct.length === 1 && AD.ct[0].key === 'v_kamera' && AD.ct[0].name === 'Kamera ute' && AD.ct[0].icon === 'mdi:paw' && AD.ct[0].source === 'kamera' && AD.tabs.join() === 'strom,sikkerhet,hjem,v_kamera' && AD.rows.join() === 'strom,sikkerhet,hjem,v_kamera:slett' && !AD.open, AD);
  const CT = await p.evaluate(async () => {
    const sr = window.__c.shadowRoot, w = (ms) => new Promise((q) => setTimeout(q, ms));
    const tabs = [...sr.querySelectorAll('.bar .tb')].map((t) => t.getAttribute('aria-label'));
    sr.querySelector('.tb[data-v="v_kamera"]').click(); await w(250);
    const r1 = [...sr.querySelectorAll('.lst .pr .pt b')].map((x) => x.textContent.trim());
    // ny regel i integrasjonen dukker opp av seg selv
    const h = window.__h, S = { ...h.states }, E = { ...h.entities }, D = { ...h.devices };
    D.n_ukjent = { id: 'n_ukjent', name: 'Kamera - ukjent person', name_by_user: null, model: 'Regel', entry_type: 'service' };
    S['switch.kamera_ukjent_person_varsling'] = { entity_id: 'switch.kamera_ukjent_person_varsling', state: 'on', attributes: { friendly_name: 'Ukjent person - Varsling' } };
    E['switch.kamera_ukjent_person_varsling'] = { entity_id: 'switch.kamera_ukjent_person_varsling', platform: 'ki_notifications', device_id: 'n_ukjent' };
    window.__h = { ...h, states: S, entities: E, devices: D }; window.__c.hass = window.__h; await w(250);
    const r2 = [...sr.querySelectorAll('.lst .pr .pt b')].map((x) => x.textContent.trim());
    const sik = window.MSH.innstRows(window.__h, window.__c.config, 'sikkerhet').map((r) => r.name);
    return { tabs, r1, r2, sik };
  });
  ok('27.7 fanen viser kategoriens varsel-brytere live (ikke lenger i Sikkerhet); ny regel i integrasjonen dukker opp automatisk', CT.tabs.join() === 'Strøm,Sikkerhet,Huset,Kamera ute' && CT.r1.join() === 'Bevegelse ved inngang,Pakke levert' && CT.r2.join() === 'Bevegelse ved inngang,Pakke levert,Ukjent person' && CT.sik.join() === 'Alarm,Dør låst/åpnet,Fastkjørt lås', CT);
  await shot(p, '4-egen-fane');
  // 4 faner ved 390 px: alt får plass (ellipsis ved behov), ingen side-scroll
  const F4 = await p.evaluate(() => { const t = window.__c.shadowRoot.querySelector('.bar .tabs'); return { many: t.classList.contains('many'), fit: t.scrollWidth <= t.clientWidth + 1, page: document.documentElement.scrollWidth <= window.innerWidth }; });
  ok('27.7 4 faner: fanelinjen får plass uten scroll (teksten krymper), ingen side-scroll', !F4.many && F4.fit && F4.page, F4);
  // slett egen fane
  const DL = await p.evaluate(async () => { const sr = window.__ed.shadowRoot, w = (ms) => new Promise((q) => setTimeout(q, ms)); sr.querySelector('[data-op="tdel"][data-v="v_kamera"]').click(); await w(300); const c = window.__ed._config; return { ct: c.custom_tabs, tabs: c.tabs.map((t) => t.key), card: [...window.__c.shadowRoot.querySelectorAll('.bar .tb')].map((t) => t.getAttribute('aria-label')), sik: window.MSH.innstRows(window.__h, window.__c.config, 'sikkerhet').length }; });
  ok('27.7 søppelkassen sletter egen fane (custom_tabs + tabs), reglene går tilbake til Sikkerhet', DL.ct === undefined && !DL.tabs.includes('v_kamera') && DL.card.join() === 'Strøm,Sikkerhet,Huset' && DL.sik === 6, DL);
  await p.close();
}

// ================================================================ 27.7 · 4+ faner + GUI-editoren
{
  const ct = [{ key: 'v_kamera', name: 'Kamera', icon: 'mdi:video', source: 'kamera' }, { key: 'v_klima', name: 'Klima', icon: 'mdi:thermostat', source: 'klima' }, { key: 'v_hv', name: 'Hvitevarer', icon: 'mdi:washing-machine', source: 'hvitevarer' }];
  const p = await page({ custom_tabs: ct, show_summary: false });
  const F6 = await p.evaluate(() => { const t = window.__c.shadowRoot.querySelector('.bar .tabs'), tb = [...t.querySelectorAll('.tb')]; return { n: tb.length, many: t.classList.contains('many'), scroll: t.scrollWidth > t.clientWidth, ox: getComputedStyle(t).overflowX, minW: Math.min(...tb.map((x) => Math.round(x.getBoundingClientRect().width))), page: document.documentElement.scrollWidth <= window.innerWidth, cnt: !!window.__c.shadowRoot.querySelector('.cnt') }; });
  ok('27.7 6 faner ved 360 px: vannrett scroll i fanelinjen (min 60 px per fane), ingen side-scroll; show_summary: false skjuler telleren', F6.n === 6 && F6.many && F6.scroll && F6.ox === 'auto' && F6.minW >= 60 && F6.page && !F6.cnt, F6);
  await shot(p, '5-seks-faner');
  const GU = await p.evaluate(async () => {
    const g = customElements.get('msh-innstillinger-card').getConfigElement(); g.hass = window.__h; g.setConfig(window.__c._rawConfig || window.__c.config); document.body.appendChild(g); await new Promise((q) => setTimeout(q, 300));
    const gs = g.shadowRoot, rows = [...gs.querySelectorAll('[data-elist="inn-tab"]')].map((r) => r.dataset.edk + (r.querySelector('.idel') ? ':slett' : ''));
    let changed = null; g.addEventListener('config-changed', (e) => { changed = e.detail.config; });
    const pv = [...gs.querySelectorAll('.pvw .tb')].length;
    gs.querySelector('[data-op="tdel"][data-v="v_hv"]').click(); await new Promise((q) => setTimeout(q, 250));
    gs.querySelector('[data-a="tab"][data-v="avansert"]').click(); await new Promise((q) => setTimeout(q, 250));
    const sum = gs.querySelector('[data-name="show_summary"]'), sumOn = sum && sum.classList.contains('on');
    return { rows, pv, ct: changed && changed.custom_tabs, sumOn };
  });
  ok('GUI-editoren (getConfigElement): samme Faner med forhåndsvisning og egne faner (slett → custom_tabs i YAML), show_summary i Avansert', GU.rows.join() === 'sikkerhet,hjem,strom,v_kamera:slett,v_klima:slett,v_hv:slett' && GU.pv === 6 && GU.ct && GU.ct.map((x) => x.key).join() === 'v_kamera,v_klima' && GU.sumOn === false, GU);
  await p.close();
}

ok('ingen sidefeil', !errs.length, errs);
await b.close();
console.log(JSON.stringify(res, null, 1));
console.log(fail.length ? `\n${fail.length} FEIL: ${fail.join(' · ')}` : '\nAlle bestod');
process.exit(fail.length ? 1 : 0);
