// Server (#server, msh-server-card) · funksjon og autokonfig (Fiks 24.10/26 → Fiks 35 v6). Designmålene ligger i
// test/server35-check.mjs; her: autokonfig fra registrene (UniFi Network + Protect, Proxmox VE, Unraid, HA/Supervisor),
// Protect-kameraer som rader i Enheter (opptak-bryter), «Finn», rød-tone-bekreftelse på enheter, egne portnavn, integrasjoner
// «Ingen»/«Fant ikke …» + integrasjonsvelgeren (portalt ark, «Bruk» lagrer integrations), HA uten Supervisor, v5-config
// (tabs.order/hidden/start) leses, hero_metric/exclude, «Tilpass Server» (MSH.overlay tilpass) ↔ GUI-editoren (samme skjema:
// velger, tab_height, show_prose, tab_order/hidden_tabs, start_tab), fyller bredden på PC.
//   node test/server-check.mjs   (SHOTS=<mappe> for skjermbilder)
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
    window.__R = (s) => c.shadowRoot.querySelector(s); window.__A = (s) => [...c.shadowRoot.querySelectorAll(s)];
    window.__t = (e) => (e ? e.textContent.replace(/\s+/g, ' ').trim() : null);
    await new Promise((q) => setTimeout(q, 900));
  }, cfg);
  return p;
}
const wait = (p, ms) => p.evaluate((ms) => new Promise((q) => setTimeout(q, ms)), ms);
const shot = async (p, n) => { if (shots) await p.screenshot({ path: `${shots}/server-${n}.png`, fullPage: true }); };
const click = async (p, sel, ms = 250) => { const r = await p.evaluate((sel) => { const e = window.__R(sel); if (!e) return false; e.click(); return true; }, sel); await wait(p, ms); return r; };
const calls = (p) => p.evaluate(() => window.__calls.filter((c) => c[0] !== 'ws').map((c) => `${c[0]}.${c[1]}:${JSON.stringify(c[2])}`));
const clearCalls = (p) => p.evaluate(() => { window.__calls.length = 0; });
const state = (p) => p.evaluate(() => ({ tabs: __A('.trow .tb').map((x) => x.dataset.v), on: (__R('.trow .tb.on') || {}).dataset?.v, title: __t(__R('.hero .hn')), chip: __t(__R('.hero .chip')), big: __t(__R('.hero .big')), when: __t(__R('.hero .when')),
  prose: __t(__R('.prose')), subs: __A('.subs .sb').map(__t), nf: __t(__R('.nf b')), nfb: __A('.nf .pick').map(__t) }));
const ed = (p) => p.evaluate(() => { const o = window.MSH.portals().pop(); const r = o && o.shadowRoot; const e = r && r.querySelector('msh-editor'); return e && e.shadowRoot; });

try {
/* ---------------------------------------------------------------- autokonfig (registre + config entries + Supervisor) */
let p = await page();
const A = await p.evaluate(() => {
  const R = MSH.server.oppdag(window.__h, {}), H = MSH.server.oppdagHA(window.__h, {});
  return { found: Object.entries(R.found).filter(([, v]) => v).map(([k]) => k).join(), types: R.unifi.enheter.map((e) => e.navn + ':' + e.type).join(), cams: R.protect.kameraer.length, noder: R.proxmox.noder.map((n) => n.navn).join(), gj: R.proxmox.gjester.length, ur: R.unraid && R.unraid.gjester.length,
    addons: H.addons.map((a) => a.slug).sort().join(), sup: H.supervisor, sys: [H.sys.cpu, H.sys.mem, H.sys.disk, H.sys.uptime].join(), core: H.core.upd };
});
ok('autokonfig: UniFi/Protect/Proxmox/Unraid funnet fra registrene', A.found === 'unifi,protect,proxmox,unraid' && A.noder === 'pve' && A.gj === 4 && A.ur === 5 && A.cams >= 3, A);
ok('autokonfig: gateway, 3 switcher og AP-er (UniFi-enhetstyper)', /UDM Pro:ruter/.test(A.types) && ['Switch Kontor', 'Switch Stue', 'Switch Garasje'].every((n) => A.types.includes(n + ':switch')) && /AP Stue:ap/.test(A.types), A.types);
ok('autokonfig HA: tillegg fra hassio-enheter + Supervisor (slug), systemmonitor/uptime, Core-oppdatering', A.addons === 'a0d7b954_esphome,a0d7b954_nodered,a0d7b954_vscode,core_mosquitto,core_samba' && A.sup && A.sys === 'sensor.system_monitor_processor_use,sensor.system_monitor_memory_usage,sensor.system_monitor_disk_usage,sensor.uptime' && A.core === 'update.home_assistant_core_update', A);

/* ---------------------------------------------------------------- Nettverk: Protect i Enheter, Finn, rød tone, portnavn */
await click(p, '.sb[data-v="enheter"]');
let X = await p.evaluate(() => { const rows = __A('.devs .dw'); const f = (n) => rows.find((r) => __t(r.querySelector('b')) === n); return { innk: __t(f('Innkjørsel').querySelector('.dm')), hage: __t(f('Hage').querySelector('.dm')), ring: !!f('Ringeklokke') }; });
ok('Protect-kameraer ligger som rader i Enheter (Opptak / Frakoblet), ingen Kameraer-underfane', X.innk === 'Opptak' && X.hage === 'Frakoblet' && X.ring && (await p.evaluate(() => !__R('.sb[data-v="kameraer"]'))), X);
await click(p, '.devs .dr[data-v="dev_cam1"]');
X = await p.evaluate(() => { const w = __R('.devs .dw.open'); return { stats: [...w.querySelectorAll('.xt .xl')].map(__t), tg: [...w.querySelectorAll('.xgr b')].map(__t), on: w.querySelector('.xgr .tg').classList.contains('on'), acts: [...w.querySelectorAll('.xa .ab')].map(__t) }; });
ok('kamera utvidet: Opptaksmodus/Siste bevegelse/Bitrate …, «Opptak»-bryter på, «Start på nytt»', X.stats.slice(0, 3).join() === 'Opptaksmodus,Siste bevegelse,Bitrate' && X.tg.join() === 'Opptak' && X.on && X.acts.join() === 'Start på nytt', X);
await clearCalls(p);
await click(p, '.devs .dw.open .xgr .tg');
ok('«Opptak» av → select.innkjorsel_recording_mode = never (Protect-støtten fra v5)', (await calls(p)).some((c) => /select\.select_option:.*innkjorsel_recording_mode.*never/.test(c)), await calls(p));
await click(p, '.devs .dr[data-v="dev_ap1"]');
await clearCalls(p);
await click(p, '.devs .dw.open [data-act="locate"]');
X = { blink: await p.evaluate(() => !!__R('.devs .dw.open.blink')), c: await calls(p) };
ok('«Finn»: LED blinker (light.turn_on flash long) og ikonet blinker', X.blink && X.c.some((c) => /light\.turn_on:.*"flash":"long"/.test(c)), X);
await click(p, '.devs .dr[data-v="dev_udm"]');
await clearCalls(p);
await click(p, '.devs .dw.open .ab.hot');
X = { t: await p.evaluate(() => __t(__R('.devs .dw.open .ab.hot'))), c: await calls(p) };
await click(p, '.devs .dw.open .ab.hot');
X.c2 = await calls(p);
ok('gateway «Start på nytt»: bekreftelse (to trykk) → button.udm_pro_restart', X.t === 'Bekreft · trykk igjen' && X.c.length === 0 && X.c2.some((c) => /button\.press:.*udm_pro_restart/.test(c)), X);
await click(p, '.sb[data-v="switch"]');
await click(p, '.pg .pt[data-v="4"]');
ok('egne portnavn fra UniFi (port-entitetens navn): «Port 4 · Kamera Inngang · 100 M · PoE»', (await p.evaluate(() => __t(__R('.pinfo')))) === 'Port 4 · Kamera Inngang · 100 M · PoE', await p.evaluate(() => __t(__R('.pinfo'))));
await click(p, '.pg .pt[data-v="3"]');
ok('port av (deaktivert) → «Port 3 · Deaktivert»', (await p.evaluate(() => __t(__R('.pinfo')))) === 'Port 3 · Deaktivert', await p.evaluate(() => __t(__R('.pinfo'))));
await shot(p, 'switch');
await p.close();

/* ---------------------------------------------------------------- integrasjoner: «Ingen», velgeren, «Fant ikke» */
p = await page({ integrations: { proxmox: 'none' }, start_tab: 'proxmox' });
let S = await state(p);
ok('«Ingen» for Proxmox: toppkort «–» + «Ikke koblet», prosa «Ingen [Proxmox VE] …», «slått av»-kort, ingen underfaner', S.big === '–' && S.chip === 'Ikke koblet' && S.prose === 'Ingen Proxmox VE er koblet til ennå.' && /slått av/.test(S.nf) && S.subs.length === 0, S);
await click(p, '.nf [data-act="pickint"]', 400);
let pk = await p.evaluate(() => { const o = window.MSH.portals().pop(); const r = o && o.shadowRoot; return r && { rows: [...r.querySelectorAll('.rr b')].map((x) => x.textContent), on: (r.querySelector('.rr.on b') || {}).textContent, auto: r.querySelectorAll('.auto').length, add: !!r.querySelector('[data-p="add"]'), done: getComputedStyle(r.querySelector('.done')).backgroundImage, tp: o.dataset.tpSheet }; });
ok('integrasjonsvelger (portalt Tilpass-ark): pve.lan (Auto) + Ingen valgt, «Legg til», rosa «Bruk»', pk && pk.rows.join() === 'pve.lan,Ingen' && pk.on === 'Ingen' && pk.auto === 1 && pk.add && /gradient/.test(pk.done) && pk.tp === '1', pk);
await p.evaluate(() => { const r = window.MSH.portals().pop().shadowRoot; r.querySelector('.rr[data-v="ce_pve"]').click(); r.querySelector('[data-p="apply"]').click(); });
await wait(p, 900);
pk = await p.evaluate(() => ({ cfg: JSON.stringify(window.__c.config.integrations || null), prose: __t(__R('.prose')) }));
ok('«Bruk» (auto-valget) fjerner «none» fra config og Proxmox vises igjen', pk.cfg === 'null' && /^Proxmox kjører/.test(pk.prose), pk);
await p.evaluate(async () => { window.__c._openPick('protect'); await new Promise((q) => setTimeout(q, 300)); const r = window.MSH.portals().pop().shadowRoot; r.querySelector('.rr[data-v="none"]').click(); r.querySelector('[data-p="apply"]').click(); });
await wait(p, 700);
pk = await p.evaluate(async () => { const c = JSON.stringify(window.__c.config.integrations); __R('[data-act="host"][data-v="net"]').click(); await new Promise((q) => setTimeout(q, 200)); __R('.sb[data-v="enheter"]').click(); await new Promise((q) => setTimeout(q, 300)); return { c, names: __A('.devs .dr b').map(__t) }; });
ok('«Ingen» for Protect lagrer integrations.protect = none → kameraene borte fra Enheter', pk.c === '{"protect":"none"}' && !pk.names.includes('Innkjørsel') && pk.names.includes('UDM Pro'), pk);
await p.close();
p = await page({ start_tab: 'unraid' }, null, () => { window.mockExtend(({ E, S }) => { Object.keys(E).forEach((id) => { if (E[id].platform === 'unraid') { delete E[id]; delete S[id]; } }); }); });
S = await state(p);
ok('Unraid mangler: toppkort «–», «Fant ikke Unraid» + «Velg integrasjon» / «Legg til i HA»', S.big === '–' && S.chip === 'Ikke koblet' && S.nf === 'Fant ikke Unraid' && S.nfb.join() === 'Velg integrasjon,Legg til i HA', S);
await p.close();

/* ---------------------------------------------------------------- HA uten Supervisor (Container/Core) */
p = await page({ start_tab: 'ha' }, null, () => { window.__svNoSup = true; });
X = await p.evaluate(async () => { __R('.gl .gr').click(); await new Promise((q) => setTimeout(q, 400)); const w = __R('.gl .gw.open'); return { head: __t(__R('.gl .ch .cs')), rows: __A('.gl .gr b').length, tg: [...w.querySelectorAll('.xgr')].map((r) => __t(r.querySelector('.col span')) + ':' + r.querySelector('.tg').disabled), prose: __t(__R('.prose')) }; });
ok('uten Supervisor: tilleggene fra hassio-entitetene, brytere uten data = «–» + deaktivert (aldri mock)', X.rows === 5 && X.head === '4 av 5 kjører' && X.tg.every((t) => t === '–:true') && /4 tillegg/.test(X.prose), X);
await p.close();

/* ---------------------------------------------------------------- config: v5-nøkler, hero_metric, exclude, tab_order */
p = await page({ tabs: { order: ['unraid', 'net', 'proxmox'], hidden: ['proxmox'], start: 'unraid' }, hero_metric: { unraid: 'temp' }, exclude: ['update.switch_stue'] });
S = await state(p);
ok('v5-config (tabs.order/hidden/start) leses: Unraid, Nettverk, HA – Unraid først og aktiv', S.tabs.join() === 'unraid,net,ha' && S.on === 'unraid', S);
ok('hero_metric.unraid = temp → «64 °», «nå · cpu-temp»', S.big === '64' && S.when === 'nå · cpu-temp', S);
await click(p, '[data-act="host"][data-v="ha"]', 400);
ok('exclude: update.switch_stue skjules (3 oppdateringer)', (await state(p)).chip === '3 oppdateringer', (await state(p)).chip);
await p.close();
p = await page({ tab_order: ['ha', 'proxmox', 'net', 'unraid'], hidden_tabs: ['net'] });
ok('tab_order + hidden_tabs', (await state(p)).tabs.join() === 'ha,proxmox,unraid', (await state(p)).tabs);
await p.close();

/* ---------------------------------------------------------------- «Tilpass Server» (MSH.overlay tilpass) ↔ GUI-editor */
p = await page();
await click(p, '.trow .gear', 900);
let E = await p.evaluate(() => {
  const o = window.MSH.portals().pop(), r = o.shadowRoot, er = r.querySelector('msh-editor').shadowRoot;
  return { tp: o.dataset.tpSheet, tabs: [...er.querySelectorAll('.chips.tabs [data-a="tab"]')].map((x) => x.getAttribute('aria-label') || x.textContent.trim()), prev: [...er.querySelectorAll('.svp .tb')].map((x) => x.textContent.trim()),
    velger: [...er.querySelectorAll('[data-name="velger"]')].map((x) => x.textContent.trim()), th: !!er.querySelector('[data-name="tab_height"], ki-spacing-editor[rows*="tab_height"], [data-mth-field="tab_height"]') /* 33.4: felles fanehøyde-felt */, prose: !!er.querySelector('[data-name="show_prose"]') };
});
ok('«Tilpass Server» (tilpass-ark): Visning · Faner · Toppkort · Integrasjoner · Avansert, forhåndsvisning av vertvelgeren', E.tp === '1' && E.tabs.join() === 'Visning,Faner,Toppkort,Integrasjoner,Avansert' && E.prev.join() === 'Nettverk,Proxmox,Unraid,HA', E);
ok('Visning: «Vertvelger» Faner/Kort, «Fanehøyde» (tab_height), «Setning under toppkortet» (show_prose)', E.velger.join() === 'Faner,Kort' && E.th && E.prose, E);
await p.evaluate(() => { const er = window.MSH.portals().pop().shadowRoot.querySelector('msh-editor').shadowRoot; er.querySelector('[data-name="velger"][data-v="kort"]').click(); });
await wait(p, 400);
X = await p.evaluate(() => { const er = window.MSH.portals().pop().shadowRoot.querySelector('msh-editor').shadowRoot; return { live: !!__R('.hcards') && !__R('.trow'), prev: er.querySelectorAll('.svp .hc').length }; });
ok('velger → Kort: kortet og forhåndsvisningen oppdateres live', X.live && X.prev === 4, X);
await p.evaluate(() => { const er = window.MSH.portals().pop().shadowRoot.querySelector('msh-editor').shadowRoot; er.querySelector('[data-name="show_prose"]').click(); });
await wait(p, 400);
ok('«Setning under toppkortet» av → setningen forsvinner live', await p.evaluate(() => !__R('.prose')));
await p.evaluate(() => { const er = window.MSH.portals().pop().shadowRoot.querySelector('msh-editor').shadowRoot; [...er.querySelectorAll('.chips.tabs [data-a="tab"]')].find((x) => /Faner/.test(x.getAttribute('aria-label') || x.textContent)).click(); });
await wait(p, 300);
X = await p.evaluate(() => { const er = window.MSH.portals().pop().shadowRoot.querySelector('msh-editor').shadowRoot; return { txt: er.textContent.replace(/\s+/g, ' '), start: [...er.querySelectorAll('[data-name="start_tab"]')].map((x) => x.textContent.trim()) }; });
ok('Faner: rekkefølge (tab_order/hidden_tabs) + «Åpne med»', /Rekkefølge/.test(X.txt) && ['Nettverk', 'Proxmox', 'Unraid', 'HA'].every((n) => X.txt.includes(n)) && X.start.join() === 'Sist brukt,Nettverk,Proxmox,Unraid,HA', X.start);
await p.evaluate(() => { const er = window.MSH.portals().pop().shadowRoot.querySelector('msh-editor').shadowRoot; [...er.querySelectorAll('.chips.tabs [data-a="tab"]')].find((x) => /Integrasjoner/.test(x.getAttribute('aria-label') || x.textContent)).click(); });
await wait(p, 300);
const it = await p.evaluate(() => { const er = window.MSH.portals().pop().shadowRoot.querySelector('msh-editor').shadowRoot; return [...er.querySelectorAll('[data-op="int"]')].map((x) => x.textContent.replace(/\s+/g, ' ').trim()); });
ok('Integrasjoner: «Funnet automatisk · n entiteter» per kilde', it.length === 4 && it.every((x) => /Funnet automatisk · \d+ entiteter/.test(x)), it);
const fd = await p.evaluate(() => { const r = window.MSH.portals().pop().shadowRoot; const all = [r, r.querySelector('msh-editor') && r.querySelector('msh-editor').shadowRoot].filter(Boolean); for (const x of all) { const bt = [...x.querySelectorAll('button')].find((y) => /Ferdig/.test(y.textContent)); if (bt) { const sh = r.querySelector('.sh').getBoundingClientRect(), br = bt.getBoundingClientRect(); return { bg: getComputedStyle(bt).backgroundImage, topHalf: br.top - sh.top < sh.height / 2, right: br.right > sh.left + sh.width * 0.6 }; } } return null; });
ok('Ferdig = rosa pille øverst til høyre (felles Tilpass-ark)', fd && /gradient/.test(fd.bg) && fd.topHalf && fd.right, fd);
await shot(p, 'tilpass');
const gui = await p.evaluate(async () => {
  const el = customElements.get('msh-server-card').getConfigElement(); el.hass = window.__h; el.setConfig({ type: 'custom:msh-server-card', card_id: 'x', velger: 'kort', tab_height: 50 }); document.body.appendChild(el);
  await new Promise((q) => setTimeout(q, 400));
  const sr = el.shadowRoot, tabs = [...sr.querySelectorAll('.chips.tabs [data-a="tab"]')].map((x) => x.getAttribute('aria-label') || x.textContent.trim());
  let got = null; el.addEventListener('config-changed', (e) => { got = e.detail.config; });
  const on = (sr.querySelector('[data-name="velger"].on') || {}).textContent;
  sr.querySelector('[data-name="velger"][data-v="faner"]').click(); await new Promise((q) => setTimeout(q, 200));
  return { tabs, on, got: got && got.velger, th: got && got.tab_height, prev: sr.querySelectorAll('.svp .tb').length };
});
ok('GUI-editor (getConfigElement): samme skjema, speiler velger/tab_height, endring → config-changed', gui.tabs.join() === 'Visning,Faner,Toppkort,Integrasjoner,Avansert' && gui.on === 'Kort' && gui.got === 'faner' && gui.th === 50 && gui.prev === 4, gui);
await p.close();

/* ---------------------------------------------------------------- PC-bredde */
p = await page(null, { width: 1280, height: 900 });
const wd = await p.evaluate(() => { const c = window.__c, pop = c.closest('.inner'); const cs = getComputedStyle(pop); return { c: Math.round(c.getBoundingClientRect().width), p: Math.round(pop.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)) }; });
ok('fyller bredden på PC', Math.abs(wd.c - wd.p) <= 1, wd);
await p.close();
} catch (e) { fail.push('krasj'); res.krasj = String(e && e.stack || e); }
ok('ingen JS-feil', errs.length === 0, errs.slice(0, 5));
await b.close();
console.log(JSON.stringify(res, null, 1));
console.log(fail.length ? `FEIL: ${fail.length} (${fail.join(' | ')})` : 'ALT OK');
process.exit(fail.length ? 1 : 0);
