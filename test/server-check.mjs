// Fiks 24.10 · Server (#server, msh-server-card): autokonfig fra config entries + enhetsregisteret (mock: UniFi, Proxmox VE,
// Unraid), toppkort med status-pille/effekt/nodekart, varsler, faner = funne integrasjoner, målere, rader med brytere,
// «Konfigurert automatisk», UniFi-enhetsark (portalt, åpnes over popupen og lukkes), «Tilpass» (faner skjul/sortér,
// varselgrenser) ↔ GUI-editor, «Fant ingen integrasjoner».   node test/server-check.mjs   (SHOTS=<mappe> for skjermbilder)
import { createRequire } from 'node:module';
import { readdirSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/server-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const shots = process.env.SHOTS || '';
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = {}, fail = [];
const ok = (name, cond, info) => { res[name] = cond ? 'OK' : ['FEIL', info]; if (!cond) fail.push(name); };
const mocks = readdirSync('test/mock').sort().map((m) => resolve('test/mock/' + m));
const errs = [];
async function page(cfg, vp, pre) {
  const p = await b.newPage({ viewport: vp || { width: 400, height: 900 }, hasTouch: true });
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/fonts.googleapis|net::ERR/.test(m.text())) errs.push(m.text()); });
  await p.goto('file://' + resolve('test/harness.html'));
  for (const m of mocks) await p.addScriptTag({ path: m });
  if (pre) await p.evaluate(pre);
  await p.addScriptTag({ path: bundle });
  await p.evaluate(async (cfg) => {
    window.__h = window.mockHass();
    window.__haptics = [];
    window.addEventListener('haptic', (e) => window.__haptics.push(e.detail));
    const bc = document.createElement('bubble-card');
    bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash: '#server' });
    bc.innerHTML = '<div class="pop"><div class="hdr">Server</div><div class="inner"></div></div>';
    document.getElementById('dash').appendChild(bc);
    location.hash = '#server';
    const c = document.createElement('msh-server-card');
    c.setConfig({ type: 'custom:msh-server-card', card_id: 'pop-server', ...(cfg || {}) });
    c.hass = window.__h;
    bc.querySelector('.inner').appendChild(c);
    window.__c = c;
    await new Promise((q) => setTimeout(q, 900));
  }, cfg);
  return p;
}
const wait = (p, ms) => p.evaluate((ms) => new Promise((q) => setTimeout(q, ms)), ms);
const shot = async (p, n) => { if (shots) await p.screenshot({ path: `${shots}/server-${n}.png`, fullPage: true }); };
const state = (p) => p.evaluate(() => {
  const sr = window.__c.shadowRoot, t = (sel) => [...sr.querySelectorAll(sel)].map((e) => e.textContent.replace(/\s+/g, ' ').trim());
  const tabs = [...sr.querySelectorAll('.tabs [data-act="tab"]')];
  return {
    pill: t('.top .pl')[0], power: t('.top .tv')[0], nodes: [...sr.querySelectorAll('.nd')].map((n) => n.dataset.v), leds: [...sr.querySelectorAll('.nd .led')].map((l) => l.className.replace('led ', '')),
    lines: sr.querySelectorAll('.map svg path').length, packets: sr.querySelectorAll('.map animateMotion').length,
    alerts: t('.al b'), alertCls: [...sr.querySelectorAll('.al')].map((a) => a.className.replace('al ', '')),
    tabs: tabs.map((x) => x.dataset.v), active: tabs.filter((x) => x.getAttribute('aria-selected') === 'true').map((x) => x.dataset.v)[0],
    gauges: t('.ga .gl').map((l, i) => l + '=' + t('.ga .gv')[i]), groups: t('.grp .gt span:first-child'), rows: t('.rw b'), sws: sr.querySelectorAll('.rw .sw').length,
    auto: t('.alh b')[0], autoN: t('.alh .col>span')[0], empty: t('.empty b, .empty span').join(' | '), gear: !!sr.querySelector('.gear[data-act="customize"]'),
  };
});

// ---------------------------------------------------------------- oppdagelse + toppkort
try {
const p = await page();
let S = await state(p);
ok('faner = funne integrasjoner (UniFi, Proxmox, Unraid) + tannhjul', S.tabs.join() === 'unifi,proxmox,unraid' && S.active === 'unifi' && S.gear, S);
ok('status-pille «3 ting trenger tilsyn» (CPU varm, disk full, AP frakoblet)', /3 ting trenger tilsyn/.test(S.pill), S.pill);
ok('effekt i W = sum av effektsensorene (118 + 24)', S.power === '142W', S.power);
ok('nodekart: tre noder med LED, to linjer med animerte pakker', S.nodes.join() === 'unifi,proxmox,unraid' && S.leds.length === 3 && S.lines === 2 && S.packets >= 4, S);
ok('LED: Unraid rød (CPU varm), UniFi oransje (AP frakoblet), Proxmox grønn', S.leds.join() === 'orange,green,red', S.leds);
ok('varsler: CPU varm rød først, disk full og AP frakoblet oransje', /CPU varm · Tower/.test(S.alerts[0]) && S.alertCls[0] === 'red' && S.alerts.some((a) => /Disk nesten full · Disk 3/.test(a)) && S.alerts.some((a) => /AP frakoblet · AP Loft/.test(a)) && S.alertCls.slice(1).every((c) => c === 'orange'), S);
ok('UniFi-fane: 3 målere (CPU 18 %, Minne 54 %, Klienter 4)', S.gauges.join() === 'CPU=18%,Minne=54%,Klienter=4', S.gauges);
ok('UniFi-fane: grupper Enheter + WLAN, enhetene sortert gateway → switch → AP', S.groups.join() === 'Enheter,WLAN' && S.rows.slice(0, 4).join() === 'UDM Pro,Switch Kontor,AP Loft,AP Stue' && S.sws === 2, S);
ok('«Konfigurert automatisk» med antall entiteter', S.auto === 'Konfigurert automatisk' && /\d+ entiteter fra UniFi/.test(S.autoN), S);
await shot(p, '1-unifi');
// trykk node Proxmox → bytter fane
await p.evaluate(() => window.__c.shadowRoot.querySelector('.nd[data-v="proxmox"]').click()); await wait(p, 300);
S = await state(p);
ok('trykk node = bytt fane (Proxmox)', S.active === 'proxmox' && S.gauges.join() === 'CPU=23%,Minne=58%,Disk=47%', S);
ok('Proxmox: Noder, VM-er, LXC, Lagring med brytere for VM/LXC', ['Noder', 'Virtuelle maskiner', 'Containere (LXC)', 'Lagring'].every((g) => S.groups.includes(g)) && S.sws === 4 && S.rows.includes('Home Assistant') && S.rows.includes('AdGuard'), S);
// bryter for stoppet VM → start-knapp
const calls0 = await p.evaluate(() => window.__calls.length);
await p.evaluate(() => { const r = [...window.__c.shadowRoot.querySelectorAll('.rw')].find((x) => /Windows 11/.test(x.textContent)); r.querySelector('.sw').click(); });
const vmCall = await p.evaluate((n) => window.__calls.slice(n).filter((c) => c[0] === 'button'), calls0);
ok('VM-bryter (stoppet) trykker start-knappen', vmCall.length === 1 && vmCall[0][2].entity_id === 'button.windows_11_start', vmCall);
await shot(p, '2-proxmox');
// varsel → gå til fanen
await p.evaluate(() => [...window.__c.shadowRoot.querySelectorAll('.al')].find((a) => /Disk nesten full/.test(a.textContent)).click()); await wait(p, 300);
S = await state(p);
ok('trykk varsel = gå til fanen (Unraid)', S.active === 'unraid' && S.gauges.join() === 'CPU=31%,RAM=61%,Array=78%', S);
ok('Unraid: Docker med brytere, VM, disker', S.groups.join() === 'Containere (Docker),Virtuelle maskiner,Disker' && S.sws === 5 && S.rows.includes('Plex') && S.rows.includes('Disk 3'), S);
// åpne «Konfigurert automatisk»
await p.evaluate(() => window.__c.shadowRoot.querySelector('.alh').click()); await wait(p, 300);
const al = await p.evaluate(() => ({ n: window.__c.shadowRoot.querySelectorAll('.ale').length, exp: window.__c.shadowRoot.querySelector('.alh').getAttribute('aria-expanded') }));
ok('«Konfigurert automatisk» kan foldes ut (liste over funne entiteter)', al.exp === 'true' && al.n > 15, al);
await shot(p, '3-unraid');

// ---------------------------------------------------------------- enhetsark (UniFi, portalt)
await p.evaluate(() => window.__c.shadowRoot.querySelector('.nd[data-v="unifi"]').click()); await wait(p, 300);
const hap0 = await p.evaluate(() => window.__haptics.length);
await p.evaluate(() => [...window.__c.shadowRoot.querySelectorAll('.rw[data-act="dev"]')].find((r) => /Switch Kontor/.test(r.textContent)).click()); await wait(p, 600);
const SH = await p.evaluate(() => {
  const port = window.MSH.portals().pop(); if (!port) return null;
  const r = port.shadowRoot, t = (sel) => [...r.querySelectorAll(sel)].map((e) => e.textContent.replace(/\s+/g, ' ').trim());
  const inPopup = !!window.__c.closest('bubble-card') && !!port.closest('bubble-card');
  return { inPopup, title: t('.dh b')[0], pills: t('.sp'), acts: t('.ac span'), tiles: t('.st span'), h4: t('h4'), ports: r.querySelectorAll('.lst .pn').length, poeSw: r.querySelectorAll('.lst [data-d="tgl"][data-id*="_poe"]').length, clients: t('.lst .tl .ell').filter(Boolean), graph: !!r.querySelector('.gph svg polyline') };
});
ok('enhetsark åpnes portalt (utenfor popupen) med tittel, piller og handlinger', SH && !SH.inPopup && SH.title === 'Switch Kontor' && SH.pills.includes('Online') && SH.acts.join() === 'Start på nytt,Finn enhet,LED', SH);
ok('enhetsark: 4 statistikk-fliser, trafikkgraf, PoE-porter med brytere, klienter, entitetsliste', SH && SH.tiles.length === 4 && SH.h4.some((x) => /Trafikk siste 24 t/.test(x)) && SH.h4.some((x) => /PoE-porter/.test(x)) && SH.ports === 4 && SH.poeSw === 4 && SH.clients.includes('Tower') && SH.h4.some((x) => /Entiteter/.test(x)), SH);
const hap1 = await p.evaluate(() => window.__haptics.length);
ok('én haptic for trykket som åpnet arket', hap1 - hap0 === 1, [hap0, hap1]);
await shot(p, '4-ark-switch');
// PoE-bryter → switch.toggle
const c1 = await p.evaluate(() => window.__calls.length);
await p.evaluate(() => window.MSH.portals().pop().shadowRoot.querySelector('[data-d="tgl"][data-id="switch.switch_kontor_port_3_poe"]').click());
const poe = await p.evaluate((n) => window.__calls.slice(n).filter((c) => c[0] !== 'ws'), c1);
ok('PoE-port-bryter slår porten av/på', poe.length === 1 && poe[0][2].entity_id === 'switch.switch_kontor_port_3_poe', poe);
// lukk med ×
await p.evaluate(() => window.MSH.portals().pop().shadowRoot.querySelector('[data-d="close"]').click()); await wait(p, 400);
ok('enhetsark lukkes (×)', await p.evaluate(() => window.MSH.portals().length === 0));
// AP-ark: radioer + klienter på AP-en
await p.evaluate(() => [...window.__c.shadowRoot.querySelectorAll('.rw[data-act="dev"]')].find((r) => /AP Stue/.test(r.textContent)).click()); await wait(p, 600);
const AP = await p.evaluate(() => { const r = window.MSH.portals().pop().shadowRoot; return { h4: [...r.querySelectorAll('h4')].map((e) => e.textContent.trim()), cl: [...r.querySelectorAll('.lst .tl .ell:first-child')].map((e) => e.textContent.trim()), blk: r.querySelectorAll('.lst .sw[aria-label^="Blokker"]').length }; });
ok('AP-ark: Radioer og klienter på AP-en med blokker-bryter', AP.h4.some((x) => /^Radioer/.test(x)) && AP.cl.join() === 'Apple TV Stue,iPhone Sebastian,Nettbrett barn' && AP.blk === 3, AP);
await shot(p, '5-ark-ap');
// bakteppet lukker
await p.evaluate(() => { const r = window.MSH.portals().pop().shadowRoot; r.querySelector('.bg').click(); }); await wait(p, 400);
ok('enhetsark lukkes (bakteppe)', await p.evaluate(() => window.MSH.portals().length === 0));
// gateway-ark: WAN
await p.evaluate(() => [...window.__c.shadowRoot.querySelectorAll('.rw[data-act="dev"]')].find((r) => /UDM Pro/.test(r.textContent)).click()); await wait(p, 600);
const GW = await p.evaluate(() => { const r = window.MSH.portals().pop().shadowRoot; return { h4: [...r.querySelectorAll('h4')].map((e) => e.textContent.trim()), wan: (() => { const h = [...r.querySelectorAll('h4')].find((x) => /^WAN/.test(x.textContent.trim())); const l = h && h.nextElementSibling; return l ? [...l.querySelectorAll('.ln')].filter((e) => /latency/i.test(e.textContent)).length : 0; })() }; });
ok('gateway-ark: WAN med latens', GW.h4.some((x) => /^WAN/.test(x)) && GW.wan === 2, GW);
await p.evaluate(() => { location.hash = ''; }); await wait(p, 400);
ok('enhetsark lukkes når popupen lukkes (hash)', await p.evaluate(() => window.MSH.portals().length === 0));
await p.evaluate(() => { location.hash = '#server'; }); await wait(p, 300);

// ---------------------------------------------------------------- Tilpass (arket) → faner, varselgrenser
await p.evaluate(() => window.__c.shadowRoot.querySelector('.gear').click()); await wait(p, 900);
const ED = await p.evaluate(() => {
  const port = window.MSH.portals().pop(), ed = port && port.shadowRoot.querySelector('msh-editor');
  if (!ed) return null;
  const r = ed.shadowRoot;
  return { tabs: [...r.querySelectorAll('.tabs [data-a="tab"]')].map((x) => x.getAttribute('aria-label') || x.textContent.trim()), rows: [...r.querySelectorAll('[data-svk]')].map((x) => x.dataset.svk + ':' + x.dataset.found), handles: [...r.querySelectorAll('[data-svdrag]')].map((x) => getComputedStyle(x).touchAction) };
});
ok('Tilpass: 4 faner (Faner, Varsler, Entiteter, Avansert)', ED && ED.tabs.join() === 'Faner,Varsler,Entiteter,Avansert', ED);
ok('Tilpass · Faner: integrasjoner med dra-håndtak (touch-action none)', ED && ED.rows.join() === 'unifi:1,proxmox:1,unraid:1' && ED.handles.every((t) => t === 'none'), ED);
// skjul UniFi med øyet → forhåndsvisning oppdateres straks
await p.evaluate(() => { const ed = window.MSH.portals().pop().shadowRoot.querySelector('msh-editor'); ed.shadowRoot.querySelector('[data-svk="unifi"] [data-a="fn"]').click(); });
await wait(p, 500);
S = await state(p);
ok('Tilpass: skjul UniFi-fanen → forsvinner umiddelbart', S.tabs.join() === 'proxmox,unraid', S.tabs);
// dra Unraid over Proxmox (sortér)
const drag = await p.evaluate(async () => {
  const ed = window.MSH.portals().pop().shadowRoot.querySelector('msh-editor'), r = ed.shadowRoot;
  const hd = r.querySelector('[data-svk="unraid"] [data-svdrag]'), tgt = r.querySelector('[data-svk="unifi"]');
  const a = hd.getBoundingClientRect(), t = tgt.getBoundingClientRect();
  const ev = (type, x, y, el) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, composed: true, pointerId: 7, clientX: x, clientY: y, button: 0, pointerType: 'touch' }));
  ev('pointerdown', a.left + 5, a.top + 5, hd);
  for (let i = 1; i <= 6; i++) ev('pointermove', a.left + 5, a.top + 5 + ((t.top + t.height / 2) - (a.top + 5)) * (i / 6), hd);
  ev('pointerup', a.left + 5, t.top + t.height / 2, hd);
  await new Promise((q) => setTimeout(q, 500));
  return [...ed.shadowRoot.querySelectorAll('[data-svk]')].map((x) => x.dataset.svk).join();
});
await wait(p, 300);
S = await state(p);
ok('Tilpass: dra-og-slipp sorterer fanene (Unraid først)', drag === 'unraid,unifi,proxmox' && S.tabs.join() === 'unraid,proxmox', { drag, tabs: S.tabs });
// Varsler: grense CPU 70 °C → CPU-varselet forsvinner straks
await p.evaluate(() => { const ed = window.MSH.portals().pop().shadowRoot.querySelector('msh-editor'); ed.shadowRoot.querySelector('[data-a="tab"][data-v="varsler"]').click(); });
await wait(p, 300);
const hasRange = await p.evaluate(() => { const ed = window.MSH.portals().pop().shadowRoot.querySelector('msh-editor'); return [...ed.shadowRoot.querySelectorAll('input[type=range]')].map((i) => i.dataset.name + ':' + i.min + '-' + i.max); });
ok('Tilpass · Varsler: grenser CPU 45–70 °C og disk 80–95 %', hasRange.join() === 'limits.cpu_temp:45-70,limits.disk:80-95', hasRange);
await p.evaluate(() => { const ed = window.MSH.portals().pop().shadowRoot.querySelector('msh-editor'); ed._set('limits.cpu_temp', 70); });
await wait(p, 500);
S = await state(p);
ok('Tilpass: CPU-grense 70 °C → CPU-varselet borte umiddelbart', !S.alerts.some((a) => /CPU varm/.test(a)) && /2 ting trenger tilsyn/.test(S.pill), S);
await p.evaluate(() => { const ed = window.MSH.portals().pop().shadowRoot.querySelector('msh-editor'); ed._set('limits.disk', 95); });
await wait(p, 500);
S = await state(p);
ok('Tilpass: disk-grense 95 % → disk-varselet borte', !S.alerts.some((a) => /Disk/.test(a)) && /1 ting trenger tilsyn/.test(S.pill), S);
await shot(p, '6-tilpass');
// Ferdig → lagret config, GUI-editoren viser det samme
await p.evaluate(async () => { const port = window.MSH.portals().pop(); const ed = port.shadowRoot.querySelector('msh-editor'); const btn = ed.shadowRoot.querySelector('[data-a="save"]') || port.shadowRoot.querySelector('[data-a="save"]'); if (btn) btn.click(); await new Promise((q) => setTimeout(q, 1200)); });
const saved = await p.evaluate(() => { const c = window.__c._rawConfig || {}; return { tabs: c.tabs, hid: c.tabs_hidden, lim: c.limits }; });
ok('Ferdig: config lagret (tabs, tabs_hidden, limits)', JSON.stringify(saved.tabs) === '["unraid","unifi","proxmox"]' && JSON.stringify(saved.hid) === '["unifi"]' && saved.lim && saved.lim.cpu_temp === 70 && saved.lim.disk === 95, saved);
const gui = await p.evaluate(async () => {
  const el = customElements.get('msh-server-card').getConfigElement();
  el.hass = window.__h; el.setConfig(window.__c._rawConfig);
  document.body.appendChild(el);
  await new Promise((q) => setTimeout(q, 400));
  const r = el.shadowRoot;
  const rows = [...r.querySelectorAll('[data-svk]')].map((x) => x.dataset.svk + (x.style.opacity ? ':av' : ''));
  el.remove();
  return rows;
});
ok('GUI-editor (getConfigElement) viser samme rekkefølge og skjult fane', gui.join() === 'unraid,unifi:av,proxmox', gui);

// ---------------------------------------------------------------- stil «Bare ikon» + innhold av + startfane
const p2 = await page({ tab_style: 'icon', content: { gauges: false }, start_tab: 'unraid', lines: false });
S = await state(p2);
ok('stil ikon, målere av, startfane Unraid, nettverkslinjer av', S.active === 'unraid' && !S.gauges.length && S.groups.length > 0 && S.lines === 0 && S.packets === 0, S);
// live-oppdatering: CPU-temperaturen faller under grensen → varsel og rød LED forsvinner (alle funne entiteter er avhengigheter)
await p2.evaluate(() => { const h = window.__h, id = 'sensor.tower_cpu_temperature'; window.__c.hass = { ...h, states: { ...h.states, [id]: { ...h.states[id], state: '50' } } }; });
await wait(p2, 400);
S = await state(p2);
ok('live: CPU-temp under grensen → CPU-varselet borte, Unraid-LED ikke rød', !S.alerts.some((a) => /CPU varm/.test(a)) && S.leds[2] !== 'red' && /2 ting/.test(S.pill), S);

// ---------------------------------------------------------------- ingen integrasjoner
const p3 = await page({}, null, () => {
  // fjern homelab-entitetene fra registeret og config entries (ikke admin)
  const h0 = window.mockHass;
  window.__svNoEntries = true;
  window.mockHass = function () { const h = h0(); const E = { ...h.entities }; Object.keys(E).forEach((id) => { if (['unifi', 'proxmoxve', 'unraid'].includes(E[id].platform)) delete E[id]; }); return { ...h, entities: E }; };
});
await wait(p3, 400);
S = await state(p3);
ok('ingen integrasjoner → «Fant ingen integrasjoner», toppkortet vises likevel med «–»', /Fant ingen integrasjoner/.test(S.empty) && S.power === '–' && !S.tabs.length && /Ingen integrasjoner/.test(S.pill), S);
const need = await p3.evaluate(() => window.MSH.popupNeeds['#server'](window.__h));
ok('popupNeeds[#server] = false uten integrasjoner', need === false, need);
await shot(p3, '7-tom');

// ---------------------------------------------------------------- PC-bredde: fyller bredden, nodekart følger bredden
const p4 = await page({}, { width: 1400, height: 900 });
const pc = await p4.evaluate(() => { const c = window.__c, host = c.parentElement.getBoundingClientRect(), r = c.getBoundingClientRect(), svg = c.shadowRoot.querySelector('.map svg'); return { full: Math.abs(r.width - (host.width - 36)) < 2, svgW: svg ? Number(svg.getAttribute('width')) : 0, top: c.shadowRoot.querySelector('.top').clientWidth, xR: [...c.shadowRoot.querySelectorAll('.nd')].map((n) => parseFloat(n.style.left)) }; });
ok('PC: kortet fyller bredden og nodekartet måles mot kortet', pc.full && Math.abs(pc.svgW - (pc.top - 36)) <= 3 && pc.xR[1] > pc.svgW - 60, pc);
await shot(p4, '8-pc');

} catch (e) { ok('testen kjørte ferdig', false, String(e && e.message || e).split('\n')[0]); }
ok('ingen JS-feil', errs.length === 0, errs.slice(0, 5));
await b.close();
console.log(JSON.stringify(res, null, 1));
console.log(fail.length ? `\n${fail.length} FEIL` : '\nAlle OK');
process.exit(fail.length ? 1 : 0);
