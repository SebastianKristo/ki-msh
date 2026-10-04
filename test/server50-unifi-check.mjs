// Fiks 50 · Server → Nettverk · UniFi (del H, I, J, M) – src/58b-server-unifi.js (M.serverUnifi) testet isolert med en
// stub-vert (host) og et rikt UniFi-register: UDM-Pro (9 porter + 2 SFP+, WAN-latens, _2-suffiks), USW-24-G2 (24 + 2 SFP),
// USW-Pro-Max-16-PoE (PoE, power cycle, deaktivert port), Flex Mini (5 porter + LED), to AP-er (ett frakoblet),
// en klient og et WLAN (skal ikke bli enheter).
//  · oppdagelse via device_id, typer, porter/SFP, skjul/rekkefølge (unifi_hidden/unifi_order), prosa
//  · H Enheter: rader, meta, frakoblet, utvidet statistikk per type, latens-barer, LED/PoE-brytere bare når de finnes,
//    handlinger (restart m/ bekreftelse, fastvare install/more-info, Fartstest → UDM, PoE-sykle port → Switch)
//  · J Switch: velgerfliser, toppen (oppetid · x av y porter oppe), PoE-pille + bar, 8 kolonner, LED, lyn, skravert, valgt
//  · I portdetaljer: status/hastighet/PoE, brytere m/ bekreftelse, PoE-sykle, Historikk, lukk, hold 500 ms → meny
//  · M UDM: målere 40/300 + 10 segmenter, 2×3 piller, WAN-latens 24 timesegmenter fra history_during_period (cache 5 min,
//    bare når åpen), akse, handlinger (Porter → go, Fastvare, Start på nytt m/ bekreftelse)
//  · haptic maks én per trykk, more-info på fliser, «–» når entitet mangler, mørk + lys modus uten hardkodede farger
// Kjør: node test/server50-unifi-check.mjs
import { createRequire } from 'node:module';
import { mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync(resolve('test/.build'), { recursive: true });
const bundle = resolve(`test/.build/su50-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = [];
const ok = (name, c, info) => res.push(`${c ? '✔' : '✘'} ${name}${!c && info !== undefined ? ' · ' + JSON.stringify(info) : ''}`);

const p = await b.newPage({ viewport: { width: 430, height: 900 }, hasTouch: true });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto('file://' + resolve('test/harness.html'));
await p.addScriptTag({ path: bundle });

await p.evaluate(() => {
  const S = {}, E = {}, D = {}, areas = { rack: { area_id: 'rack', name: 'Server Rack' }, treet: { area_id: 'treet', name: 'Treet' } };
  const ago = (min) => new Date(Date.now() - min * 60000).toISOString();
  const add = (id, st, at, dev, tk) => { S[id] = { entity_id: id, state: String(st), attributes: { friendly_name: id, ...(at || {}) }, last_changed: ago(5), last_updated: ago(5) }; E[id] = { entity_id: id, platform: 'unifi', device_id: dev, translation_key: tk || null, entity_category: null }; };
  const dev = (id, name, model, area, extra) => { D[id] = { id, name, name_by_user: null, model, manufacturer: 'Ubiquiti Networks', area_id: area || null, config_entries: ['ce_unifi'], ...(extra || {}) }; };
  const pct = { unit_of_measurement: '%' }, tmp = { unit_of_measurement: '°C', device_class: 'temperature' }, spd = { unit_of_measurement: 'Mbit/s', device_class: 'data_rate' }, W = { unit_of_measurement: 'W', device_class: 'power' };
  const base = (o, dv, sfx, st) => {
    add(`device_tracker.${o}`, st === 'disconnected' ? 'not_home' : 'home', {}, dv);
    add(`sensor.${o}_clients`, st === 'disconnected' ? 0 : 7, {}, dv);
    add(`sensor.${o}_cpu_utilisation${sfx}`, st === 'disconnected' ? 'unavailable' : 9, pct, dv);
    add(`sensor.${o}_memory_utilisation${sfx}`, st === 'disconnected' ? 'unavailable' : 44, pct, dv);
    add(`sensor.${o}_uptime${sfx}`, ago(60 * 24 * 23 + 4 * 60 + 10), { device_class: 'timestamp' }, dv);
    add(`sensor.${o}_state`, st || 'connected', { device_class: 'enum' }, dv);
    add(`button.${o}_restart`, 'unknown', { device_class: 'restart' }, dv);
  };
  // Gateway
  dev('d_udm', 'Oslo Dream Machine Pro', 'UDM-Pro', 'rack');
  base('oslo_dream_machine_pro', 'd_udm', '_2');
  S['sensor.oslo_dream_machine_pro_clients'].state = '41';
  S['sensor.oslo_dream_machine_pro_cpu_utilisation_2'].state = '14';
  S['sensor.oslo_dream_machine_pro_memory_utilisation_2'].state = '61';
  add('sensor.oslo_dream_machine_pro_cpu_temperature_2', 53, tmp, 'd_udm');
  add('sensor.oslo_dream_machine_pro_local_temperature', 41, tmp, 'd_udm');
  add('sensor.oslo_dream_machine_pro_cloudflare_wan_latency', 3, { unit_of_measurement: 'ms' }, 'd_udm');
  add('sensor.oslo_dream_machine_pro_microsoft_wan_latency', 9, { unit_of_measurement: 'ms' }, 'd_udm');
  add('sensor.oslo_dream_machine_pro_google_wan_latency', 7, { unit_of_measurement: 'ms' }, 'd_udm');
  add('update.oslo_dream_machine_pro_firmware', 'off', { installed_version: '4.1.13', latest_version: '4.1.13' }, 'd_udm');
  for (let n = 1; n <= 9; n++) { add(`sensor.oslo_dream_machine_pro_port_${n}_link_speed`, 1000, spd, 'd_udm'); add(`switch.oslo_dream_machine_pro_port_${n}`, 'on', {}, 'd_udm'); }
  for (let n = 1; n <= 2; n++) { add(`sensor.oslo_dream_machine_pro_sfp_${n}_link_speed`, 10000, spd, 'd_udm'); add(`switch.oslo_dream_machine_pro_sfp_${n}`, 'on', {}, 'd_udm'); }
  // 24-port switch (fastvare-oppdatering klar)
  dev('d_veien', 'Veien USW-24-G2 🛣️', 'USW-24-G2', null);
  base('veien_usw_24_g2', 'd_veien', '');
  add('update.veien_usw_24_g2_firmware', 'on', { installed_version: '7.1.25', latest_version: '7.1.26' }, 'd_veien');
  for (let n = 1; n <= 24; n++) { add(`sensor.veien_usw_24_g2_port_${n}_link_speed`, [2, 5, 7, 10, 13, 15, 19, 21].includes(n) ? 1000 : n === 3 ? 100 : 0, spd, 'd_veien'); add(`switch.veien_usw_24_g2_port_${n}`, 'on', {}, 'd_veien'); }
  for (let n = 1; n <= 2; n++) { add(`sensor.veien_usw_24_g2_sfp_${n}_link_speed`, 0, spd, 'd_veien'); add(`switch.veien_usw_24_g2_sfp_${n}`, 'on', {}, 'd_veien'); }
  // 16-port PoE
  dev('d_treet', 'Treets USW Pro Max 16 PoE 🌳', 'USW-Pro-Max-16-PoE', 'treet');
  base('treets_usw_pro_max_16_poe', 'd_treet', '');
  const o = 'treets_usw_pro_max_16_poe';
  for (let n = 1; n <= 16; n++) {
    const sp = n === 2 ? 2500 : n <= 12 ? (n % 3 === 0 ? 100 : 1000) : 0;
    add(`sensor.${o}_port_${n}_link_speed`, n === 16 ? 0 : sp, spd, 'd_treet');
    add(`switch.${o}_port_${n}`, n === 16 ? 'off' : 'on', {}, 'd_treet');
    add(`switch.${o}_port_${n}_poe`, 'on', { friendly_name: `Treets USW Pro Max 16 PoE 🌳 ${n === 5 ? 'Kamera inngang' : 'Port ' + n} PoE` }, 'd_treet');
    add(`sensor.${o}_port_${n}_poe_power`, n <= 6 ? 4.8 : 0, W, 'd_treet');
    add(`button.${o}_port_${n}_power_cycle`, 'unknown', {}, 'd_treet');
  }
  // Flex Mini (LED)
  dev('d_flex', 'Spisebord USW Flex Mini 🏓', 'USW-Flex-Mini', null);
  base('spisebord_usw_flex_mini', 'd_flex', '');
  add('light.spisebord_usw_flex_mini_led', 'on', {}, 'd_flex');
  for (let n = 1; n <= 5; n++) { add(`sensor.spisebord_usw_flex_mini_port_${n}_link_speed`, n === 2 ? 0 : 1000, spd, 'd_flex'); add(`switch.spisebord_usw_flex_mini_port_${n}`, 'on', {}, 'd_flex'); }
  // AP-er (ett frakoblet)
  dev('d_fuglen', 'Fuglen U7 Pro XG 🐦', 'U7-Pro-XG', null);
  base('fuglen_u7_pro_xg', 'd_fuglen', ''); add('light.fuglen_u7_pro_xg_led', 'on', {}, 'd_fuglen'); add('update.fuglen_u7_pro_xg_firmware', 'off', { installed_version: '8.0.21' }, 'd_fuglen');
  S['sensor.fuglen_u7_pro_xg_clients'].state = '18';
  dev('d_posten', 'Posten U7 Lite 📯', 'U7-Lite', null);
  base('posten_u7_lite', 'd_posten', '', 'disconnected');
  // klient + WLAN (ikke enheter)
  D.d_phone = { id: 'd_phone', name: 'iPhone', model: null, manufacturer: 'Apple', config_entries: ['ce_unifi'] };
  add('device_tracker.iphone', 'home', {}, 'd_phone'); add('switch.iphone_block', 'on', {}, 'd_phone');
  dev('d_wlan', 'Hjemme', 'UniFi WLAN', null, { entry_type: 'service' });
  add('switch.hjemme', 'on', {}, 'd_wlan'); add('sensor.hjemme_clients', 11, {}, 'd_wlan');

  const calls = []; window.__calls = calls;
  const hist = (id) => { const now = Date.now() / 1000, v = parseFloat(S[id].state); return Array.from({ length: 24 * 6 }, (_, i) => ({ s: String(i >= 30 && i < 42 ? 90 : v + (i % 7)), lu: now - 86400 + i * 600 })); };
  window.__H = {
    states: S, entities: E, devices: D, areas, floors: {}, user: { is_admin: true }, language: 'nb', themes: { darkMode: true },
    services: { button: { press: {} }, update: { install: {} }, switch: { turn_on: {}, turn_off: {} }, light: { turn_on: {}, turn_off: {} } },
    callService: (d, s, data) => { calls.push([d, s, data]); return Promise.resolve(); },
    callWS: (m) => { calls.push(['ws', m.type, m]); if (m.type === 'history/history_during_period') { const r = {}; (m.entity_ids || []).forEach((id) => { r[id] = hist(id); }); return Promise.resolve(r); } return Promise.resolve([]); },
  };
  MSH.lastHass = window.__H;
  window.__w = (ms) => new Promise((q) => setTimeout(q, ms || 0));
  window.__hap = []; window.addEventListener('haptic', (e) => window.__hap.push(e.detail));
  window.__toast = []; const t0 = MSH.toast; MSH.toast = (t, o) => { window.__toast.push(String(t)); return t0(t, o); };
  // Stub-vert (server-kortet) – samme grensesnitt som 58-server.js gir
  window.__mk = (sub, cfg, opts) => {
    opts = opts || {};
    document.getElementById('dash').innerHTML = '';
    Object.keys(MSH.serverUnifi._pend).forEach((k) => delete MSH.serverUnifi._pend[k]);
    const wrap = document.createElement('div'); document.getElementById('dash').appendChild(wrap);
    const sr = wrap.attachShadow({ mode: 'open' });
    sr.innerHTML = `<style>${MSH.BASE_CSS}${MSH.serverUnifi.css}</style><div class="pane"></div>`;
    const el = sr.querySelector('.pane');
    const log = { more: [], go: [], confirm: [], hap: [] };
    const host = {
      hass: window.__H, config: cfg || {}, ui: {}, isOpen: opts.closed ? false : true, isConnected: true, answer: true, log,
      setUI(pp) { Object.assign(this.ui, pp); this.update(); },
      update() { MSH.morph(el, MSH.serverUnifi.html(this, this.sub, null)); MSH.serverUnifi.bind(this, el, this.sub, null); },
      haptic(t) { log.hap.push(t); MSH.haptic(t); },
      moreInfo(id) { log.more.push(id); },
      go(tab, s, extra) { log.go.push([tab, s, extra]); this.sub = s; Object.assign(this.ui, extra || {}); this.update(); },
      confirm(text) { log.confirm.push(text); return Promise.resolve(this.answer); },
      sub,
    };
    host.update();
    window.__host = host; window.__el = el; window.__sr = sr;
    return true;
  };
  window.__portals = () => { const r = document.querySelector('body > ki-overlay-root'); return r && r.shadowRoot ? [...r.shadowRoot.querySelectorAll('.msh-portal')] : []; };
  window.__q = (sel) => window.__sr.querySelector(sel);
  window.__qa = (sel) => [...window.__sr.querySelectorAll(sel)];
  window.__tap = async (sel, i) => { const e = typeof sel === 'string' ? window.__qa(sel)[i || 0] : sel; const n = window.__host.log.hap.length; e.click(); await window.__w(30); return window.__host.log.hap.length - n; };
});

/* ------------------------------------------------------------ oppdagelse + prosa */
const disc = await p.evaluate(() => {
  const X = MSH.serverUnifi.discover(window.__H, null, {});
  const by = Object.fromEntries(X.all.map((d) => [d.id, d]));
  return {
    ids: X.devs.map((d) => d.id), types: X.devs.map((d) => d.type), gw: X.gw && X.gw.id,
    udmPorts: by.d_udm.ports.map((q) => q.key), udmCpu: by.d_udm.cpu, udmLat: by.d_udm.lat.map((l) => l.label), udmUp: by.d_udm.uptime, udmTemp: by.d_udm.cpuTemp, udmLocal: by.d_udm.localTemp,
    veien: by.d_veien.ports.length, treet: by.d_treet.ports.length, flex: by.d_flex.ports.length, treetP5: by.d_treet.ports[4], sfp1: by.d_udm.ports[9],
    prosa: MSH.serverUnifi.prosa(window.__H, null, {}),
    prosaHid: MSH.serverUnifi.prosa(window.__H, null, { unifi_hidden: ['d_posten'] }),
    order: MSH.serverUnifi.discover(window.__H, null, { unifi_order: ['d_flex', 'd_fuglen'] }).devs.map((d) => d.id).slice(0, 3),
    budget: [MSH.serverUnifi._modelBudget('USW-Pro-Max-16-PoE'), MSH.serverUnifi._modelBudget('USW-24-PoE'), MSH.serverUnifi._modelBudget('US-8-60W'), MSH.serverUnifi._modelBudget('U7-Lite')],
  };
});
ok('6 UniFi-enheter (klient og WLAN er ikke enheter)', disc.ids.length === 6 && !disc.ids.includes('d_phone') && !disc.ids.includes('d_wlan'), disc.ids);
ok('typer gw → sw → ap', JSON.stringify(disc.types) === JSON.stringify(['gw', 'sw', 'sw', 'sw', 'ap', 'ap']) && disc.gw === 'd_udm', disc.types);
ok('UDM: 9 porter + SFP S1/S2', JSON.stringify(disc.udmPorts) === JSON.stringify(['1', '2', '3', '4', '5', '6', '7', '8', '9', 'S1', 'S2']) && disc.sfp1.speed === 'sensor.oslo_dream_machine_pro_sfp_1_link_speed', disc.udmPorts);
ok('_2-suffiks: cpu_utilisation_2 / uptime_2 / cpu_temperature_2 + lokal temp', disc.udmCpu === 'sensor.oslo_dream_machine_pro_cpu_utilisation_2' && disc.udmUp === 'sensor.oslo_dream_machine_pro_uptime_2' && disc.udmTemp === 'sensor.oslo_dream_machine_pro_cpu_temperature_2' && disc.udmLocal === 'sensor.oslo_dream_machine_pro_local_temperature', disc);
ok('WAN-latens Cloudflare · Google · Microsoft', JSON.stringify(disc.udmLat) === '["Cloudflare","Google","Microsoft"]', disc.udmLat);
ok('portantall 26 / 16 / 5', disc.veien === 26 && disc.treet === 16 && disc.flex === 5, [disc.veien, disc.treet, disc.flex]);
ok('PoE-port: poe, pw, cyc, speed + portnavn fra UniFi', disc.treetP5.poe && disc.treetP5.pw && disc.treetP5.cyc && disc.treetP5.speed && disc.treetP5.name === 'Kamera inngang', disc.treetP5);
ok('prosa: «1 enhet frakoblet» + «41 klienter»', /Nettet er <span class="pp">1 enhet frakoblet<\/span> og <span class="pp">41 klienter<\/span> er tilkoblet\./.test(disc.prosa), disc.prosa);
ok('prosa: skjult enhet → «helt oppe»', /helt oppe/.test(disc.prosaHid), disc.prosaHid);
ok('unifi_order styrer rekkefølgen', JSON.stringify(disc.order) === '["d_flex","d_fuglen","d_udm"]', disc.order);
ok('PoE-budsjett etter modell (180 / 95 / 60 / ingen)', JSON.stringify(disc.budget) === '[180,95,60,null]', disc.budget);

/* ------------------------------------------------------------ H · Enheter */
await p.evaluate(() => window.__mk('enheter'));
const en = await p.evaluate(async () => {
  const rows = window.__qa('.su-dr').map((r) => ({ n: r.querySelector('b').textContent, m: r.querySelector('.su-dm').textContent, off: r.querySelector('.su-dic').classList.contains('off') }));
  const head = window.__q('.su-ch').textContent;
  const hapUdm = await window.__tap('.su-dr', 0);
  const st = window.__qa('.su-dw.open .su-xt').map((t) => t.querySelector('.su-xl').textContent + '=' + t.querySelector('.su-xv').textContent);
  const bars = window.__qa('.su-dw.open .su-xbr').map((x) => x.textContent.replace(/\s+/g, ' ').trim());
  const barW = window.__qa('.su-dw.open .su-xbt i').map((i) => i.style.width);
  const gwTg = window.__qa('.su-dw.open .su-xgr').length, gwActs = window.__qa('.su-dw.open .su-ab').map((x) => x.textContent.trim());
  // tap på flis → more-info
  await window.__tap(window.__qa('.su-dw.open .su-xt')[1]);
  const more1 = window.__host.log.more.slice(-1)[0];
  // Fartstest → UDM
  await window.__tap(window.__qa('.su-dw.open .su-ab').find((x) => /Fartstest/.test(x.textContent)));
  const go1 = window.__host.log.go.slice(-1)[0];
  return { rows, head, hapUdm, st, bars, barW, gwTg, gwActs, more1, go1 };
});
ok('Enheter: 6 rader + «5 av 6 online»', en.rows.length === 6 && /5 av 6 online/.test(en.head), en);
ok('rad-meta: klienter / porter oppe / porter · W PoE / Frakoblet', en.rows[0].m === '41 klienter' && en.rows[3].m === '9 porter oppe' && /^12 porter · 29 W PoE$/.test(en.rows[2].m) && en.rows[1].m === '4 porter oppe' && en.rows[4].m === '18 klienter' && en.rows[5].m === 'Frakoblet' && en.rows[5].off, en.rows.map((r) => r.m));
ok('emoji i navn vises som de er + rekkefølge gw → sw (alfabetisk) → ap', en.rows.map((r) => r.n.split(' ')[0]).join(',') === 'Oslo,Spisebord,Treets,Veien,Fuglen,Posten' && en.rows[3].n === 'Veien USW-24-G2 🛣️', en.rows.map((r) => r.n));
ok('gw utvidet: 9 fliser i riktig rekkefølge', JSON.stringify(en.st.map((x) => x.split('=')[0])) === JSON.stringify(['Klienter', 'CPU', 'Minne', 'CPU-temp', 'Lokal temp', 'Porter oppe', 'Oppetid', 'Fastvare', 'Tilstand']), en.st);
ok('gw verdier: 41 · 14 % · 61 % · 53° · 41° · 11 / 11 · 23 d 4 t · 4.1.13 · Online', en.st.join('|') === 'Klienter=41|CPU=14%|Minne=61%|CPU-temp=53°|Lokal temp=41°|Porter oppe=11 / 11|Oppetid=23 d 4 t|Fastvare=4.1.13|Tilstand=Online', en.st);
ok('gw latens-barer (20 ms = full)', en.bars.length === 3 && /Cloudflare WAN/.test(en.bars[0]) && /3 ms/.test(en.bars[0]) && en.barW[0] === '15%', en);
ok('gw uten LED/PoE: ingen brytergruppe', en.gwTg === 0, en.gwTg);
ok('gw handlinger: Start på nytt · Fartstest · Fastvare', JSON.stringify(en.gwActs) === JSON.stringify(['Start på nytt', 'Fartstest', 'Fastvare']), en.gwActs);
ok('én haptic per trykk (rad)', en.hapUdm === 1, en.hapUdm);
ok('flis → more-info', en.more1 === 'sensor.oslo_dream_machine_pro_cpu_utilisation_2', en.more1);
ok('Fartstest → go(net, udm)', en.go1 && en.go1[0] === 'net' && en.go1[1] === 'udm', en.go1);

const en2 = await p.evaluate(async () => {
  window.__mk('enheter'); const H = window.__host, C = window.__calls;
  const out = {};
  // PoE-switch
  await window.__tap('.su-dr', 2);
  out.poeSt = window.__qa('.su-dw.open .su-xl').map((x) => x.textContent);
  out.poeTg = window.__qa('.su-dw.open .su-xgr b').map((x) => x.textContent);
  out.poeActs = window.__qa('.su-dw.open .su-ab').map((x) => x.textContent.trim());
  // PoE på alle porter av → bekreftelse (nei) → ingen kall; (ja) → switch.turn_off på 16
  H.answer = false; let n = C.length;
  await window.__tap(window.__q('.su-dw.open [data-su-act="poeall"]')); await window.__w(20);
  out.poeNo = C.length - n; out.conf = H.log.confirm.slice(-1)[0];
  H.answer = true; n = C.length;
  await window.__tap(window.__q('.su-dw.open [data-su-act="poeall"]')); await window.__w(20);
  out.poeYes = C.slice(n).filter((c) => c[0] === 'switch');
  out.poeOpt = window.__q('.su-dw.open [data-su-act="poeall"]').classList.contains('on');
  await window.__tap(window.__qa('.su-dw.open .su-ab').find((x) => /PoE-sykle port/.test(x.textContent)));
  out.go = H.log.go.slice(-1)[0];
  // Veien: fastvare-oppdatering klar → update.install
  window.__mk('enheter'); const H2 = window.__host;
  await window.__tap('.su-dr', 3);
  out.vSt = window.__qa('.su-dw.open .su-xl').map((x) => x.textContent);
  out.vTg = window.__qa('.su-dw.open .su-xg').length;
  n = C.length;
  const up = window.__qa('.su-dw.open .su-ab').find((x) => /Oppdater fastvare/.test(x.textContent));
  out.hasUp = !!up; await window.__tap(up); await window.__w(20);
  out.inst = C.slice(n).find((c) => c[0] === 'update');
  // restart: nei → ingen kall, ja → button.press
  H2.answer = false; n = C.length;
  await window.__tap(window.__qa('.su-dw.open .su-ab')[0]); await window.__w(20);
  out.rsNo = C.length - n;
  H2.answer = true; n = C.length;
  const hb = H2.log.hap.length;
  window.__qa('.su-dw.open .su-ab')[0].click(); await window.__w(30);
  out.rsHap = H2.log.hap.length - hb;
  out.rs = C.slice(n).find((c) => c[0] === 'button');
  // Flex: LED-bryter
  await window.__tap('.su-dr', 1);
  out.fTg = window.__qa('.su-dw.open .su-xgr b').map((x) => x.textContent);
  out.fTgSub = window.__q('.su-dw.open .su-xgr .su-tt>span').textContent;
  n = C.length; await window.__tap(window.__q('.su-dw.open [data-su-act="tgl"]')); await window.__w(20);
  out.led = C.slice(n).find((c) => c[0] === 'light');
  // AP frakoblet
  await window.__tap('.su-dr', 5);
  out.apSt = window.__qa('.su-dw.open .su-xt').map((t) => t.querySelector('.su-xl').textContent + '=' + t.querySelector('.su-xv').textContent);
  out.apRs = window.__qa('.su-dw.open .su-ab')[0].disabled;
  return out;
});
ok('sw PoE: Klienter · CPU · Minne · Porter oppe · PoE · Oppetid · Fastvare · Tilstand', JSON.stringify(en2.poeSt) === JSON.stringify(['Klienter', 'CPU', 'Minne', 'Porter oppe', 'PoE', 'Oppetid', 'Fastvare', 'Tilstand']), en2.poeSt);
ok('sw PoE: bryter «PoE på alle porter» (ingen LED-entitet → ingen LED)', JSON.stringify(en2.poeTg) === '["PoE på alle porter"]', en2.poeTg);
ok('sw PoE: handling «PoE-sykle port» (rød) → go(net, switch, {dev})', en2.poeActs.includes('PoE-sykle port') && en2.go && en2.go[1] === 'switch' && en2.go[2].dev === 'd_treet', en2);
ok('PoE alle av: bekreftelse – Avbryt gir ingen kall', en2.poeNo === 0 && /Slå av PoE på alle 16 porter/.test(en2.conf), en2);
ok('PoE alle av: Bekreft → switch.turn_off på alle 16 (optimistisk av)', en2.poeYes.length === 1 && en2.poeYes[0][1] === 'turn_off' && en2.poeYes[0][2].entity_id.length === 16 && en2.poeOpt === false, en2.poeYes);
ok('sw uten PoE: ingen PoE-flis, ingen brytergruppe', !en2.vSt.includes('PoE') && en2.vSt.includes('Tilstand') && en2.vTg === 0, en2.vSt);
ok('fastvare klar → «Oppdater fastvare» → update.install', en2.hasUp && en2.inst && en2.inst[1] === 'install', en2.inst);
ok('Start på nytt: Avbryt = ingen kall, Bekreft = button.press, én haptic', en2.rsNo === 0 && en2.rs && en2.rs[1] === 'press' && en2.rs[2].entity_id === 'button.veien_usw_24_g2_restart' && en2.rsHap === 1, en2);
ok('Flex Mini: LED-bryter med entitets-ID → light.turn_off', JSON.stringify(en2.fTg) === '["LED"]' && en2.fTgSub === 'light.spisebord_usw_flex_mini_led' && en2.led && en2.led[1] === 'turn_off', en2);
ok('ap frakoblet: 6 fliser, CPU «–», Tilstand Frakoblet, restart deaktivert', en2.apSt.length === 6 && en2.apSt[1] === 'CPU=–' && en2.apSt[5] === 'Tilstand=Frakoblet' && en2.apRs, en2.apSt);

/* ------------------------------------------------------------ J · Switch + I · portdetaljer */
await p.evaluate(() => window.__mk('switch'));
const sw = await p.evaluate(async () => {
  const H = window.__host, out = {};
  out.tiles = window.__qa('.su-swc').map((x) => x.querySelector('.su-swn').textContent + '|' + x.querySelector('.su-sws').textContent);
  out.leds0 = window.__qa('.su-swc')[0].querySelectorAll('.su-leds i').length;
  out.first = window.__q('.su-swh b').textContent;
  // velg Treets
  out.selHap = await window.__tap('.su-swc', 2);
  out.title = window.__q('.su-swh b').textContent; out.sub = window.__q('.su-swh .su-tt>span').textContent;
  out.pill = window.__q('.su-poe') && window.__q('.su-poe').textContent.trim();
  out.bar = window.__q('.su-pb i') && window.__q('.su-pb i').style.width;
  out.cols = getComputedStyle(window.__q('.su-pg')).gridTemplateColumns.split(' ').length;
  const pt = window.__qa('.su-pt');
  out.n = pt.length;
  const cs = getComputedStyle(pt[0]);
  out.h = cs.height; out.r = cs.borderTopLeftRadius;
  out.p16dis = pt[15].classList.contains('dis'); out.p13up = pt[12].classList.contains('up');
  out.led2 = pt[1].querySelector('.su-led').getAttribute('style'); out.led3 = pt[2].querySelector('.su-led').getAttribute('style');
  out.bolt1 = pt[0].querySelector('ha-icon').style.opacity; out.bolt8 = pt[7].querySelector('ha-icon').style.opacity;
  out.legend = [...window.__q('.su-lg').children].map((x) => x.textContent.trim()).join(' ');
  out.hint = window.__q('.su-pinfo') && window.__q('.su-pinfo').textContent;
  // trykk port 2 → detaljpanel
  out.pHap = await window.__tap(window.__qa('.su-pt')[1]);
  out.selCls = window.__qa('.su-pt')[1].classList.contains('sel');
  out.selSh = getComputedStyle(window.__qa('.su-pt')[1]).boxShadow;
  out.pd = !!window.__q('.su-pd'); out.hintGone = !window.__q('.su-pinfo');
  out.pdTitle = window.__q('.su-pdh b').textContent; out.pdStatus = window.__q('.su-pdh .su-tt>span').textContent;
  out.pdStats = window.__qa('.su-pdt').map((x) => [...x.children].map((c) => c.textContent).join(' '));
  out.pdTg = window.__qa('.su-pd .su-xgr').map((x) => x.querySelector('b').textContent + '|' + x.querySelector('.su-tt>span').textContent);
  out.pdActs = window.__qa('.su-pd .su-ab').map((x) => x.textContent.trim());
  // flis → more-info
  await window.__tap(window.__qa('.su-pdt')[2]); out.moreTile = H.log.more.slice(-1)[0];
  // Port aktiv av → bekreftelse
  const C = window.__calls; H.answer = false; let n = C.length;
  await window.__tap(window.__qa('.su-pd [data-su-act="tgl"]')[0]); await window.__w(20);
  out.offNo = C.length - n; out.offTxt = H.log.confirm.slice(-1)[0];
  H.answer = true; n = C.length;
  await window.__tap(window.__qa('.su-pd [data-su-act="tgl"]')[0]); await window.__w(20);
  out.offCall = C.slice(n).find((c) => c[0] === 'switch');
  out.disNow = window.__qa('.su-pt')[1].classList.contains('dis');
  out.pdStatus2 = window.__q('.su-pdh .su-tt>span').textContent;
  // PoE-sykle
  n = C.length; await window.__tap(window.__q('.su-pd .su-ab.hot')); await window.__w(20);
  out.cyc = C.slice(n).find((c) => c[0] === 'button'); out.cycTxt = H.log.confirm.slice(-1)[0];
  // Historikk
  await window.__tap(window.__qa('.su-pd .su-ab').find((x) => /Historikk/.test(x.textContent))); out.hist = H.log.more.slice(-1)[0];
  // lukk
  await window.__tap(window.__q('.su-pdx')); out.closed = !window.__q('.su-pd') && !!window.__q('.su-pinfo');
  // samme port to ganger lukker
  await window.__tap(window.__qa('.su-pt')[4]); const o1 = !!window.__q('.su-pd'); await window.__tap(window.__qa('.su-pt')[4]); out.toggle = o1 && !window.__q('.su-pd');
  // port 5: klientnavn i tittel
  await window.__tap(window.__qa('.su-pt')[4]); out.p5 = window.__q('.su-pdh b').textContent;
  return out;
});
ok('velgerfliser: første ord + «oppe/totalt · W»', JSON.stringify(sw.tiles) === JSON.stringify(['Oslo|11/11', 'Spisebord|4/5', 'Treets|12/16 · 29 W', 'Veien|9/26']), sw.tiles);
ok('LED-strek per port i velgerflisen', sw.leds0 === 11, sw.leds0);
ok('velg switch: selection-haptic (én)', sw.selHap === 1 && sw.title === 'Treets USW Pro Max 16 PoE 🌳', sw);
ok('topp: «Oppetid 23 d 4 t · 12 av 16 porter oppe»', sw.sub === 'Oppetid 23 d 4 t · 12 av 16 porter oppe', sw.sub);
ok('PoE-pille «29 / 180 W» + bar 16 %', sw.pill === '29 / 180 W' && parseFloat(sw.bar) === 16, [sw.pill, sw.bar]);
ok('portfliser: 16 stk, 8 kolonner, høyde 60, radius 14', sw.n === 16 && sw.cols === 8 && sw.h === '60px' && sw.r === '14px', sw);
ok('port 16 av → skravert, port 13 ledig', sw.p16dis && !sw.p13up, sw);
ok('LED: 2,5 G blå m/ glød, 100 M oransje', /--blue/.test(sw.led2) && /box-shadow:\s*0 0 8px/.test(sw.led2) && /--orange/.test(sw.led3), [sw.led2, sw.led3]);
ok('lyn bare der PoE leverer', sw.bolt1 === '1' && sw.bolt8 === '0', [sw.bolt1, sw.bolt8]);
ok('forklaring: 2,5 G+ · 1 G · 100 M · PoE · Deaktivert', sw.legend === '2,5 G+ 1 G 100 M PoE Deaktivert', sw.legend);
ok('uten valgt port: «Trykk på en port for detaljer»', sw.hint === 'Trykk på en port for detaljer', sw.hint);
ok('trykk port: selection-haptic, rosa ramme, panel erstatter linjen', sw.pHap === 1 && sw.selCls && /inset/.test(sw.selSh) && sw.pd && sw.hintGone, sw);
ok('panel: «Port 2» + «Tilkoblet · 2,5 Gbit/s · PoE»', sw.pdTitle === 'Port 2' && sw.pdStatus === 'Tilkoblet · 2,5 Gbit/s · PoE', [sw.pdTitle, sw.pdStatus]);
ok('panel: Status · Hastighet · PoE-strøm', JSON.stringify(sw.pdStats) === JSON.stringify(['Oppe Status', '2,5 Gbit/s Hastighet', '4,8 W PoE-strøm']), sw.pdStats);
ok('panel: Port aktiv + PoE med entitets-ID', sw.pdTg[0] === 'Port aktiv|switch.treets_usw_pro_max_16_poe_port_2' && sw.pdTg[1] === 'PoE|switch.treets_usw_pro_max_16_poe_port_2_poe', sw.pdTg);
ok('panel: PoE-sykle + Historikk', JSON.stringify(sw.pdActs) === '["PoE-sykle","Historikk"]', sw.pdActs);
ok('statflis → more-info (poe_power)', sw.moreTile === 'sensor.treets_usw_pro_max_16_poe_port_2_poe_power', sw.moreTile);
ok('port av: «Slå av port 2? Enheten mister nett.» – Avbryt = ingen kall', sw.offNo === 0 && sw.offTxt === 'Slå av port 2? Enheten mister nett.', sw);
ok('port av: Bekreft → switch.turn_off + skravert straks (optimistisk)', sw.offCall && sw.offCall[1] === 'turn_off' && sw.offCall[2].entity_id === 'switch.treets_usw_pro_max_16_poe_port_2' && sw.disNow && sw.pdStatus2 === 'Deaktivert', sw);
ok('PoE-sykle: bekreftelse → button.press power_cycle', sw.cyc && sw.cyc[2].entity_id === 'button.treets_usw_pro_max_16_poe_port_2_power_cycle' && /PoE-sykle port 2/.test(sw.cycTxt), sw);
ok('Historikk → more-info link_speed', sw.hist === 'sensor.treets_usw_pro_max_16_poe_port_2_link_speed', sw.hist);
ok('lukk-knapp og samme port igjen lukker panelet', sw.closed && sw.toggle, sw);
ok('klientnavn fra UniFi i tittelen («Port 5 · Kamera inngang»)', sw.p5 === 'Port 5 · Kamera inngang', sw.p5);

// SFP på UDM + hold-meny
const hold = await p.evaluate(async () => {
  window.__mk('switch', {}); const H = window.__host, out = {};
  await window.__tap('.su-swc', 0);
  const pt = window.__qa('.su-pt');
  out.labels = pt.map((x) => x.querySelector('.num').textContent);
  await window.__tap(pt[9]);
  out.sfpTitle = window.__q('.su-pdh b').textContent; out.sfpSt = window.__q('.su-pdh .su-tt>span').textContent;
  out.sfpStats = window.__qa('.su-pdt').map((x) => [...x.children].map((c) => c.textContent).join(' '));
  // hold 500 ms på Treets port 3
  await window.__tap('.su-swc', 2);
  const t = window.__qa('.su-pt')[2], r = t.getBoundingClientRect();
  const hb = H.log.hap.length;
  t.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true, clientX: r.x + 5, clientY: r.y + 5, pointerId: 1, button: 0 }));
  await window.__w(300); out.early = !window.__portals().length;
  await window.__w(320);
  t.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, composed: true, pointerId: 1 }));
  t.click(); await window.__w(20); // klikket etter hold svelges
  out.holdHap = H.log.hap.slice(hb);
  const portal = window.__portals().pop(); out.menu = !!portal;
  const sr = portal && portal.shadowRoot;
  out.items = sr ? [...sr.querySelectorAll('[data-m]')].map((x) => x.textContent.trim()) : [];
  out.selAfterHold = H.ui.suPort;
  const C = window.__calls, n = C.length;
  if (sr) sr.querySelector('[data-m="cyc"]').click();
  await window.__w(400);
  out.menuCyc = C.slice(n).find((c) => c[0] === 'button'); out.menuConf = H.log.confirm.slice(-1)[0];
  out.closedMenu = !window.__portals().some((x) => x.shadowRoot.querySelector('[data-m]'));
  // flytt fingeren under hold → ingen meny
  window.__portals().forEach((x) => x.remove());
  const t2 = window.__qa('.su-pt')[3], r2 = t2.getBoundingClientRect();
  t2.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true, clientX: r2.x + 5, clientY: r2.y + 5, pointerId: 2, button: 0 }));
  await window.__w(100);
  t2.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, composed: true, clientX: r2.x + 40, clientY: r2.y + 5, pointerId: 2 }));
  await window.__w(600); out.noMenuMove = !window.__portals().length;
  return out;
});
ok('UDM-porter 1–9 + S1/S2', hold.labels.join(',') === '1,2,3,4,5,6,7,8,9,S1,S2', hold.labels);
ok('SFP-panel: «SFP 1» · «Tilkoblet · 10 Gbit/s» · Klient-flis', hold.sfpTitle === 'SFP 1' && hold.sfpSt === 'Tilkoblet · 10 Gbit/s' && hold.sfpStats[2] === 'Ukjent Klient', hold);
ok('hold 500 ms → meny (ikke før), én medium-haptic, klikk etter hold svelges', hold.early && hold.menu && JSON.stringify(hold.holdHap) === '["medium"]' && hold.selAfterHold === '3', hold);
ok('meny: Slå av port · Slå av PoE · PoE-sykle', JSON.stringify(hold.items) === JSON.stringify(['Slå av port 3', 'Slå av PoE', 'PoE-sykle']), hold.items);
ok('meny PoE-sykle → bekreftelse → button.press, menyen lukkes', hold.closedMenu && hold.menuCyc && hold.menuCyc[2].entity_id === 'button.treets_usw_pro_max_16_poe_port_3_power_cycle' && /PoE-sykle port 3/.test(hold.menuConf), hold);
ok('bevegelse under hold avbryter menyen', hold.noMenuMove, hold);

// go('net','switch',{dev}) velger switchen
const goSel = await p.evaluate(async () => { window.__mk('switch'); window.__host.ui.dev = 'd_flex'; window.__host.update(); return window.__q('.su-swh b').textContent; });
ok('host.ui.dev (fra go) velger switchen', goSel === 'Spisebord USW Flex Mini 🏓', goSel);

/* ------------------------------------------------------------ M · UDM */
const udm = await p.evaluate(async () => {
  const L = MSH.serverUnifi._lat; L.key = ''; L.t = 0; L.data = {};
  ['cloudflare', 'google', 'microsoft'].forEach((k) => MSH.historyForget(`sensor.oslo_dream_machine_pro_${k}_wan_latency`));
  const C = window.__calls, n0 = C.filter((c) => c[1] === 'history/history_during_period').length;
  window.__mk('udm', {}, { closed: true });
  await window.__w(60);
  const closedCalls = C.filter((c) => c[1] === 'history/history_during_period').length - n0;
  window.__mk('udm'); const H = window.__host;
  await window.__w(120);
  const hc = C.filter((c) => c[1] === 'history/history_during_period');
  const out = { closedCalls, nCalls: hc.length - n0, req: hc.slice(-1)[0] && hc.slice(-1)[0][2] };
  H.update(); H.update(); await window.__w(60);
  out.nCalls2 = C.filter((c) => c[1] === 'history/history_during_period').length - n0;
  out.name = window.__q('.su-top b').textContent; out.sub = window.__q('.su-top .su-tt>span').textContent;
  out.chip = window.__q('.su-chip').textContent.trim(); out.chipOk = window.__q('.su-chip').classList.contains('ok');
  out.meters = window.__qa('.su-mt').map((m) => m.querySelector('.su-ml').textContent + '=' + m.querySelector('.su-mv').textContent);
  out.mvFont = getComputedStyle(window.__q('.su-mv .num')); out.mvFont = out.mvFont.fontSize + '/' + out.mvFont.fontWeight;
  out.segs = window.__qa('.su-mt').map((m) => [...m.querySelectorAll('.su-seg i')].filter((i) => !/surface-3/.test(i.getAttribute('style'))).length);
  out.segN = window.__q('.su-seg').children.length;
  out.segCol = window.__qa('.su-mt').map((m) => m.querySelector('.su-seg i').getAttribute('style'));
  out.specs = window.__qa('.su-sp').map((x) => x.querySelector('.su-spl').textContent + '=' + x.querySelector('.su-spv').textContent);
  out.spH = getComputedStyle(window.__q('.su-sp')).height;
  out.latH = [...window.__q('.su-lh').children].map((c) => c.textContent).join(' ');
  out.latRows = window.__qa('.su-lr').map((r) => r.querySelector('.su-ll').textContent + '=' + r.querySelector('.su-lv').textContent);
  out.latSegs = window.__qa('.su-lr').map((r) => r.querySelectorAll('.su-ls i').length);
  const s0 = [...window.__qa('.su-lr')[0].querySelectorAll('.su-ls i')].map((i) => i.getAttribute('style'));
  out.lastFull = !/color-mix/.test(s0[23]) && /color-mix\(in srgb, var\(--green[^)]*\) 50%/.test(s0[10]);
  out.hasRed = s0.some((x) => /--red/.test(x));
  out.axis = [...window.__q('.su-lax').children[1].children].map((c) => c.textContent).join(' ');
  out.expT0 = String((new Date().getHours() + 1) % 24).padStart(2, '0') + ':00';
  out.acts = window.__qa('.su-ap').map((x) => x.textContent.trim());
  out.apH = getComputedStyle(window.__q('.su-ap')).height + '/' + getComputedStyle(window.__q('.su-ap')).borderTopLeftRadius;
  // trykk: målere/piller/latens → more-info (haptic light)
  const hb = H.log.hap.length;
  await window.__tap('.su-mt', 0); await window.__tap('.su-sp', 1); await window.__tap('.su-lr', 1);
  out.more = H.log.more.slice(-3); out.hapL = H.log.hap.slice(hb);
  await window.__tap('.su-ap', 0); out.go = H.log.go.slice(-1)[0];
  window.__mk('udm'); const H2 = window.__host;
  await window.__tap('.su-ap', 1); out.fw = H2.log.more.slice(-1)[0];
  H2.answer = false; let n = C.length; await window.__tap('.su-ap', 2); await window.__w(20); out.rsNo = C.length - n;
  H2.answer = true; n = C.length; await window.__tap('.su-ap', 2); await window.__w(20); out.rs = C.slice(n).find((c) => c[0] === 'button'); out.rsTxt = H2.log.confirm.slice(-1)[0];
  // fastvare klar → «Oppdater» → update.install
  window.__H.states['update.oslo_dream_machine_pro_firmware'].state = 'on';
  window.__mk('udm'); n = C.length;
  out.fwLbl = window.__qa('.su-ap')[1].textContent.trim(); out.fwSpec = window.__qa('.su-sp')[5].querySelector('.su-spv').className + '|' + window.__qa('.su-sp')[5].querySelector('.su-spv').textContent;
  await window.__tap('.su-ap', 1); await window.__w(20); out.inst = C.slice(n).find((c) => c[0] === 'update');
  window.__H.states['update.oslo_dream_machine_pro_firmware'].state = 'off';
  // manglende entitet → «–»
  const keep = window.__H.states['sensor.oslo_dream_machine_pro_local_temperature']; window.__H.states['sensor.oslo_dream_machine_pro_local_temperature'] = { ...keep, state: 'unavailable' };
  window.__mk('udm'); out.ltMissing = window.__qa('.su-sp')[4].querySelector('.su-spv').textContent;
  window.__H.states['sensor.oslo_dream_machine_pro_local_temperature'] = keep;
  return out;
});
ok('historikk hentes ikke når popupen er lukket', udm.closedCalls === 0, udm.closedCalls);
ok('WAN-historikk: én history_during_period (minimal_response, no_attributes, 3 entiteter, 24 t)', udm.nCalls === 1 && udm.req.minimal_response === true && udm.req.no_attributes === true && udm.req.entity_ids.length === 3 && Math.abs(Date.parse(udm.req.end_time) - Date.parse(udm.req.start_time) - 86400000) < 5000, udm.req);
ok('cache 5 min: nye tegninger henter ikke på nytt', udm.nCalls2 === 1, udm.nCalls2);
ok('UDM-topp: navn · «UDM-Pro · Server Rack» · Online-chip', udm.name === 'Oslo Dream Machine Pro' && udm.sub === 'UDM-Pro · Server Rack' && udm.chip === 'Online' && udm.chipOk, udm);
ok('målere: CPU 14 % · Minne 61 % · CPU-temp 53 °C, 40px/300', JSON.stringify(udm.meters) === JSON.stringify(['CPU=14%', 'Minne=61%', 'CPU-temp=53°C']) && udm.mvFont === '40px/300', [udm.meters, udm.mvFont]);
ok('10 segmenter, fylte = round(v/10) min 1 (1 · 6 · 5)', udm.segN === 10 && JSON.stringify(udm.segs) === '[1,6,5]', udm.segs);
ok('farger: CPU grønn · Minne lilla · Temp blå', /--green/.test(udm.segCol[0]) && /--purple/.test(udm.segCol[1]) && /--blue/.test(udm.segCol[2]), udm.segCol);
ok('2×3 piller (56 px): Klienter 41 · Oppetid 23 d 4 t · Porter 11 / 11 · SFP+ 10 Gbit/s · Lokal temp 41° · Fastvare Nyeste', udm.specs.join('|') === 'Klienter=41|Oppetid=23 d 4 t|Porter=11 / 11|SFP+=10 Gbit/s|Lokal temp=41°|Fastvare=Nyeste' && udm.spH === '56px', udm.specs);
ok('WAN-latens: tittel + «siste 24 t · snitt … ms»', /^WAN-latens siste 24 t · snitt \d+ ms$/.test(udm.latH), udm.latH);
ok('latens-rader: Cloudflare 3 · Google 7 · Microsoft 9 ms, 24 segmenter hver', JSON.stringify(udm.latRows) === JSON.stringify(['Cloudflare=3ms', 'Google=7ms', 'Microsoft=9ms']) && udm.latSegs.every((x) => x === 24), udm);
ok('historiske segmenter 50 %, siste full, rød time over 60 ms', udm.lastFull && udm.hasRed, udm);
ok('akse: starttime … «nå»', udm.axis === `${udm.expT0} nå`, [udm.axis, udm.expT0]);
ok('handlinger: Porter · Fastvare · Start på nytt (64 px, radius 32)', JSON.stringify(udm.acts) === '["Porter","Fastvare","Start på nytt"]' && udm.apH === '64px/32px', [udm.acts, udm.apH]);
ok('måler/pille/latens → more-info med haptic «light» (én per trykk)', JSON.stringify(udm.more) === JSON.stringify(['sensor.oslo_dream_machine_pro_cpu_utilisation_2', 'sensor.oslo_dream_machine_pro_uptime_2', 'sensor.oslo_dream_machine_pro_google_wan_latency']) && JSON.stringify(udm.hapL) === '["light","light","light"]', udm);
ok('Porter → go(net, switch, {dev: UDM})', udm.go && udm.go[0] === 'net' && udm.go[1] === 'switch' && udm.go[2].dev === 'd_udm', udm.go);
ok('Fastvare (nyeste) → more-info update', udm.fw === 'update.oslo_dream_machine_pro_firmware', udm.fw);
ok('Start på nytt: bekreftelse, Avbryt = ingen kall, Bekreft = button.press', udm.rsNo === 0 && udm.rs && udm.rs[2].entity_id === 'button.oslo_dream_machine_pro_restart' && /Starte Oslo Dream Machine Pro på nytt/.test(udm.rsTxt), udm);
ok('oppdatering klar: «Oppdater» + oransje «Ny» → update.install', udm.fwLbl === 'Oppdater' && udm.fwSpec === 'su-spv warn|Ny' && udm.inst && udm.inst[1] === 'install', udm);
ok('manglende verdi → «–»', udm.ltMissing === '–', udm.ltMissing);

/* ------------------------------------------------------------ timesnitt + reserve-bekreftelse + uten gateway */
const misc = await p.evaluate(async () => {
  const out = {};
  const now = new Date(); now.setMinutes(30, 0, 0); const T = now.getTime(), h0 = new Date(T); h0.setMinutes(0, 0, 0);
  const st = h0.getTime() - 23 * 3600000;
  // 10 ms hele perioden, 40 ms fra halvveis i time 5 → time 5 snitt 25
  const r = MSH.serverUnifi._hourly([{ t: st - 1000, v: 10 }, { t: st + 5 * 3600000 + 1800000, v: 40 }, { t: st + 6 * 3600000, v: 10 }], T);
  out.h = [r.vals[0], r.vals[5], r.vals[6], r.vals[23]];
  out.empty = MSH.serverUnifi._hourly([], T).vals.every((v) => v === null);
  // reserve-bekreftelse (host uten confirm) – portalt ark
  window.__mk('udm'); const H = window.__host; delete H.confirm; H.confirm = undefined;
  const C = window.__calls; let n = C.length;
  window.__qa('.su-ap')[2].click(); await window.__w(80);
  const portal = window.__portals().pop(); out.sheet = !!(portal && portal.shadowRoot.querySelector('.su-q'));
  portal.shadowRoot.querySelector('[data-q="1"]').click(); await window.__w(60);
  out.fbCall = C.slice(n).find((c) => c[0] === 'button');
  // uten gateway: plassholder
  const keep = { ...window.__H.devices }; delete window.__H.devices.d_udm; window.__H.devices = { ...window.__H.devices };
  const E0 = window.__H.entities; window.__H.entities = Object.fromEntries(Object.entries(E0).filter(([, e]) => e.device_id !== 'd_udm'));
  window.__mk('udm'); out.noGw = window.__q('.su-top') && window.__q('.su-top').textContent.replace(/\s+/g, ' ').trim();
  window.__H.devices = keep; window.__H.entities = E0;
  return out;
});
ok('timesnitt tidsvektet (10 · 25 · 10 · 10)', JSON.stringify(misc.h) === '[10,25,10,10]' && misc.empty, misc.h);
ok('reserve-bekreftelse (host uten confirm): portalt ark → Bekreft → button.press', misc.sheet && misc.fbCall && misc.fbCall[1] === 'press', misc);
ok('uten gateway: kortet vises med «–»', /Gateway/.test(misc.noGw) && /–/.test(misc.noGw), misc.noGw);

/* ------------------------------------------------------------ editor-felt + lys modus */
const edf = await p.evaluate(() => {
  const F = MSH.serverUnifi.editorFields(window.__H, {});
  const sec = F[0], ord = sec.fields.find((f) => f.type === 'order'), pb = sec.fields.filter((f) => f.type === 'number');
  return { sec: sec.label, name: ord.name, hid: ord.hiddenName, opts: ord.options.length, pb: pb.map((f) => f.name + ':' + f.auto()) };
});
ok('editorFields: order unifi_order/unifi_hidden med 6 enheter + poe_budget per PoE-switch', edf.name === 'unifi_order' && edf.hid === 'unifi_hidden' && edf.opts === 6 && JSON.stringify(edf.pb) === '["poe_budget.d_treet:180"]', edf);
const pbCfg = await p.evaluate(async () => { window.__mk('switch', { poe_budget: { d_treet: 300 } }); await window.__tap('.su-swc', 2); return window.__q('.su-poe').textContent.trim(); });
ok('config poe_budget overstyrer modellen', pbCfg === '29 / 300 W', pbCfg);

const light = await p.evaluate(async () => {
  document.documentElement.setAttribute('data-ki-theme', 'light');
  MSH.theme && MSH.theme.update && MSH.theme.update({ themes: { darkMode: false } });
  window.__mk('udm');
  const bg = getComputedStyle(window.__q('.su-card')).backgroundColor, tx = getComputedStyle(window.__q('.su-top b')).color;
  window.__mk('switch'); const pt = getComputedStyle(window.__q('.su-pt')).backgroundColor;
  document.documentElement.setAttribute('data-ki-theme', 'dark');
  MSH.theme && MSH.theme.update && MSH.theme.update({ themes: { darkMode: true } });
  window.__mk('udm'); const bgD = getComputedStyle(window.__q('.su-card')).backgroundColor;
  window.__mk('switch'); const ptD = getComputedStyle(window.__q('.su-pt')).backgroundColor;
  return { bg, tx, pt, bgD, ptD };
});
ok('mørk modus: kort #3a3a3a, portflis #2f2f2f', light.bgD === 'rgb(58, 58, 58)' && light.ptD === 'rgb(47, 47, 47)', light);
ok('lys modus: lyse flater og mørk tekst', light.bg !== light.bgD && light.tx !== 'rgb(250, 250, 250)', light);

ok('ingen sidefeil', errs.length === 0, errs);
const hex = execFileSync('node', ['test/hex-count.mjs', 'src/58b-server-unifi.js']).toString();
ok('ingen hardkodede farger (hex-count = 0)', /58b-server-unifi\.js \|\s+0 \|/.test(hex), hex);

await b.close();
rmSync(bundle, { force: true });
console.log(res.join('\n'));
const bad = res.filter((r) => r.startsWith('✘')).length;
console.log(`\n${res.length - bad}/${res.length} OK`);
process.exit(bad ? 1 : 0);
