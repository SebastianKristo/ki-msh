// Runde 2: frontend ↔ KI MSH-integrasjonen (MSH.hus, felles lager), felles Tilpass-kontroller og animasjonsdetaljer.
// Kjør: node test/runde2-check.mjs
import { createRequire } from 'node:module';
import { readdirSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/r2-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
let fail = 0, n = 0;
const ok = (c, m, info) => { n++; console.log((c ? '✔ ' : '✘ ') + m + (info != null && !c ? ' · ' + JSON.stringify(info).slice(0, 500) : '')); if (!c) fail++; };
const page = async () => {
  const p = await b.newPage({ viewport: { width: 420, height: 860 } });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('file://' + resolve('test/harness.html'));
  for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
  await p.addScriptTag({ path: bundle });
  return { p, errs };
};

/* 1 · uten integrasjonen: som før, ingen gjettede reservesensorer */
{
  const { p, errs } = await page();
  const r = await p.evaluate(async () => {
    const H = window.mockHass(); await MSH.store.load(H);
    const v = await MSH.generateDashboardView({}, H);
    return { ok: MSH.hus.ok, data: MSH.hus.data, shared: MSH.store.shared, fb: MSH.FALLBACK, rooms: v.cards[0].cards.filter((c) => c.card_type === 'pop-up' && /msh-rom-card/.test(JSON.stringify(c.cards))).map((c) => c.hash) };
  });
  ok(r.ok === false && r.data === null && r.shared === false, 'uten integrasjonen: MSH.hus = null, ki-store i user_data', r);
  ok(r.fb.temperature === null && r.fb.humidity === null, 'uten integrasjonen: ingen gjettede reservesensorer (sensor.hus_*)', r.fb);
  ok(r.rooms.includes('#stue') && r.rooms.includes('#bad'), 'uten integrasjonen: rom-popups fra registrene', r.rooms);
  ok(!errs.length, 'ingen sidefeil (uten integrasjonen)', errs);
  await p.close();
}

/* 2 · med integrasjonen: husmodell, reserve, KI Rom-kart, felles lager, live-oppdatering */
{
  const { p, errs } = await page();
  const r = await p.evaluate(async () => {
    const wait = (ms) => new Promise((q) => setTimeout(q, ms));
    const H = window.mockHass();
    H.states['sensor.min_husfukt'] = { entity_id: 'sensor.min_husfukt', state: '37', attributes: { unit_of_measurement: '%', device_class: 'humidity' }, last_changed: new Date().toISOString() };
    H.states['sensor.min_hustemp'] = { entity_id: 'sensor.min_hustemp', state: '20.5', attributes: { unit_of_measurement: '°C', device_class: 'temperature' }, last_changed: new Date().toISOString() };
    H.states['sensor.omdopt_bad_lys'] = { entity_id: 'sensor.omdopt_bad_lys', state: '2', attributes: {}, last_changed: new Date().toISOString() };
    const rom = (id, navn) => ({ area_id: id, navn, ikon: null, etasje_id: null, antall: 0, lys: [], media: [], klima: [], gardiner: [], temperatur: [], fuktighet: [], effekt: [], effekt_andre: [], scener: [], skript: [], lysniva: null, brytere: [], vifter: [], sensorer: [], temperatur_entity: null, fuktighet_entity: null, ki_rom: {} });
    let model = { rev: 3, versjon: 'test', lagring: 'felles', etasjer: [], funksjoner: [], popups: [], rom: [rom('stue', 'Stue'), rom('kontor', 'Kontor')],
      kilder: { ki_rom: { lastet: true, rom: { bad: { lys: 'sensor.omdopt_bad_lys' } } }, ki_energi: { lastet: false, entiteter: {} }, brytere: {} },
      energi: { lastet: false }, reserve: { temperatur: 'sensor.min_hustemp', fuktighet: 'sensor.min_husfukt' } };
    const lager = { rev: 0, data: {} }, puts = [];
    let subCb = null;
    const ws = H.callWS;
    H.callWS = (m) => {
      if (m.type === 'ki_msh/hus') return Promise.resolve(model);
      if (m.type === 'ki_msh/lager/hent') return Promise.resolve({ rev: lager.rev, data: lager.data, modus: 'felles' });
      if (m.type === 'ki_msh/lager/lagre') { lager.rev++; lager.data = m.data; puts.push(m.data); return Promise.resolve({ rev: lager.rev }); }
      if (m.type === 'frontend/get_user_data') return Promise.resolve({ value: { cards: { egen: { x: 1 } } } });
      if (m.type === 'frontend/set_user_data') { window.__udSet = (window.__udSet || 0) + 1; return Promise.resolve(null); }
      return ws(m);
    };
    const sub0 = H.connection.subscribeMessage;
    H.connection.subscribeMessage = (cb, m) => { if (m.type === 'ki_msh/hus/abonner') { subCb = cb; setTimeout(() => cb(model), 5); return Promise.resolve(() => {}); } if (m.type === 'ki_msh/lager/abonner') return Promise.resolve(() => {}); return sub0(cb, m); };
    MSH.hus._reset();
    await MSH.store.load(H);
    const v = await MSH.generateDashboardView({}, H);
    MSH.strategyConfig = {}; MSH.lastHass = H;
    const roomsOf = (vv) => vv.cards[0].cards.filter((c) => c.card_type === 'pop-up' && /msh-rom-card/.test(JSON.stringify(c.cards))).map((c) => c.hash);
    const out = { ok: MSH.hus.ok, shared: MSH.store.shared, fb: MSH.FALLBACK, rooms: roomsOf(v), migrert: JSON.stringify(puts[0] || null), kiRom: (MSH.kiRom(H, 'bad', 'lys') || {}).entity_id };
    // egen lagring går til det felles lageret
    MSH.store.set('ui.r2test', 1); await MSH.store.save();
    out.lagret = lager.data && lager.data.ui && lager.data.ui.r2test === 1; out.udSet = window.__udSet || 0;
    // live: ny rev (nytt rom) → 'ki-hus' + popupene genereres på nytt
    let ev = 0; window.addEventListener('ki-hus', () => ev++);
    let refreshed = 0; const rp = MSH.refreshPopups; MSH.refreshPopups = () => { refreshed++; return Promise.resolve(true); };
    await wait(20);
    model = { ...model, rev: 4, rom: [...model.rom, rom('bad', 'Bad')] };
    subCb(model); await wait(20);
    subCb(model); await wait(20); // samme rev → ingenting
    MSH.refreshPopups = rp;
    out.ev = ev; out.refreshed = refreshed;
    out.rooms2 = roomsOf(await MSH.generateDashboardView({}, H));
    // klima-toppkortet: rom uten egen sensor bruker reserven fra integrasjonen
    const kc = document.createElement('msh-rom-klima-card'); kc.setConfig({ type: 'custom:msh-rom-klima-card', area: 'garasje' }); kc.hass = H; document.getElementById('dash').appendChild(kc);
    await wait(150);
    out.klima = [...((kc.shadowRoot && kc.shadowRoot.children) || [])].filter((e) => e.tagName !== 'STYLE').map((e) => e.innerText).join(' ').replace(/\s+/g, ' ').slice(0, 200);
    return out;
  });
  ok(r.ok === true && r.shared === true, 'med integrasjonen: MSH.hus lastet og ki-store bruker det felles lageret', r);
  ok(r.migrert && /"egen"/.test(r.migrert), 'første gang: brukerens oppsett (user_data) lastes opp til det felles lageret', r.migrert);
  ok(r.lagret && r.udSet === 0, 'lagring går til ki_msh/lager/lagre (ikke frontend/set_user_data)', r);
  ok(r.fb.temperature === 'sensor.min_hustemp' && r.fb.humidity === 'sensor.min_husfukt', 'reservesensorene kommer fra integrasjonen (Konfigurer → Kilder)', r.fb);
  ok(r.rooms.join() === ['#kontor', '#stue'].join() || (r.rooms.length === 2 && r.rooms.includes('#stue') && r.rooms.includes('#kontor')), 'rom-popups: bare rommene valgt i integrasjonen', r.rooms);
  ok(r.kiRom === 'sensor.omdopt_bad_lys', 'MSH.kiRom bruker integrasjonens KI Rom-kart (omdøpt sensor)', r.kiRom);
  ok(r.ev === 1 && r.refreshed === 1, 'live: ny rev → én ki-hus-hendelse og popupene genereres på nytt (samme rev ignoreres)', r);
  ok(r.rooms2.includes('#bad'), 'live: nytt rom i integrasjonen gir ny rom-popup', r.rooms2);
  ok(/\b37 %/.test(r.klima), 'klima-toppkortet: rom uten fuktsensor viser reservesensoren fra integrasjonen', r.klima);
  ok(!errs.length, 'ingen sidefeil (med integrasjonen)', errs);
  await p.close();
}

/* 3 · felles kontroller og animasjoner */
{
  const { p, errs } = await page();
  const r = await p.evaluate(async () => {
    const wait = (ms) => new Promise((q) => setTimeout(q, ms));
    const H = window.mockHass(); MSH.lastHass = H;
    const sw = MSH.tp.sw('.t', 'i');
    const base = MSH.BASE_CSS || '';
    // ark lukkes: verten fjernes etter utgangsovergangen, ikke midt i
    const o = MSH.overlay({ html: '<div style="height:200px">x</div>', sheet: true, tilpass: true });
    const open = MSH.portals().length;
    await wait(400);
    o.close();
    await wait(120);
    const after150 = MSH.portals().length;
    await wait(400);
    const after = MSH.portals().length;
    return { open, sw: /translateX\(20px\)/.test(sw) && /prefers-reduced-motion/.test(sw), base: /prefers-reduced-motion: reduce\)\{\*,\*::before/.test(base), entries: MSH.tp.entries(['home', 'navbar']).map((e) => e[2]), after150, after };
  });
  ok(r.sw, 'MSH.tp.sw: felles bryter (20 px knott, fjær, reduser bevegelse)', r);
  ok(r.base, 'BASE_CSS: «Reduser bevegelse» gjelder alle kort', r);
  ok(r.entries.join() === 'Tilpass Hjem,Tilpass navbar', 'MSH.tp.entries: felles Tilpass-oppføringer', r.entries);
  ok(r.open === 1 && r.after150 === 1 && r.after === 0, 'Tilpass-ark: verten står til utgangsovergangen er ferdig, og fjernes så', r);
  ok(!errs.length, 'ingen sidefeil', errs);
  await p.close();
}
await b.close();
console.log(fail ? `${n - fail}/${n} OK` : `Alle ${n} bestod`);
process.exit(fail ? 1 : 0);
