// Fiks 26.1–26.8 · Server (#server, msh-server-card): hovedfaner Nettverk/Proxmox/Unraid + tannhjul, toppkort (184 px, graf,
// scrub, bytt måling), prosalinje, underfaner (huskes per fane), seksjoner; Nettverk: Enheter (utvid flis), Kameraer (Protect),
// Switcher (portgrid 8 kolonner, portdetalj med «Port aktiv»/«PoE»/«Strømsyklus PoE»); Proxmox/Unraid: Ytelse, Systeminfo,
// Lagring (Array-rad, bays), Gjester/Docker (søk, filter, spinner), Kontroller (to trykk); fire kilder, «Fant ikke …»,
// integrasjonsvelger (portalt, «Bruk» lagrer integrations), «Tilpass Server» (dra faner/seksjoner, forhåndsvisning) ↔ GUI-editor.
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
const click = (p, sel) => p.evaluate((sel) => { const e = window.__c.shadowRoot.querySelector(sel); if (!e) return false; e.click(); return true; }, sel);
const state = (p) => p.evaluate(() => {
  const sr = window.__c.shadowRoot, t = (sel) => [...sr.querySelectorAll(sel)].map((e) => e.textContent.replace(/\s+/g, ' ').trim());
  const hero = sr.querySelector('.hero'), kids = [...sr.querySelector('.wrap').children].map((e) => e.className.split(' ')[0]);
  return {
    order: kids, tabs: [...sr.querySelectorAll('.tabs .tb')].map((x) => x.dataset.v), active: (sr.querySelector('.tabs .tb.on') || {}).dataset?.v,
    gear: !!sr.querySelector('.trow .gear[data-act="customize"]'), heroH: hero && Math.round(hero.getBoundingClientRect().height),
    heroTitle: t('.hero .hn')[0], chip: t('.hero .chip')[0], right: t('.hero .hr')[0], big: t('.hero .big')[0], unit: t('.hero .bu')[0], svs: t('.hero .sv'), when: t('.hero .when')[0],
    graph: !!sr.querySelector('.hero .graph polyline'), prose: t('.prose')[0], pills: t('.prose .pp'), bad: t('.prose .pp.bad'),
    subs: t('.wrap > .subs .sb'), subOn: t('.wrap > .subs .sb.on')[0], secs: t('.pane .sec .st'), metas: t('.pane .sec .sm'),
    tiles: t('.ti .tih b'), tileSt: t('.ti .tih .col>span'), nf: t('.sec.nf b'), search: sr.querySelectorAll('.srch input').length,
  };
});

try {
// ---------------------------------------------------------------- struktur + toppkort (Nettverk)
const p = await page();
let S = await state(p);
ok('rekkefølge: fanerad → toppkort → prosa → underfaner → innhold', S.order.join() === 'trow,hero,prose,subs,pane', S.order);
ok('hovedfaner Nettverk · Proxmox · Unraid + tannhjul (48×48)', S.tabs.join() === 'net,proxmox,unraid' && S.active === 'net' && S.gear, S);
ok('toppkort 184 px med graf, «Internett» + grønn «Online»-chip + klienter til høyre', S.heroH === 184 && S.graph && S.heroTitle === 'Internett' && /^Online/.test(S.chip) && /4 klienter/.test(S.right), S);
ok('toppkort: hovedverdi Ned 38 Mbps, sekundær Opp og Latens, «Ned · nå»', S.big === '38' && S.unit === 'Mbps' && S.svs.length === 2 && /Opp/.test(S.svs[0]) && /Latens/.test(S.svs[1]) && S.when === 'Ned · nå', S);
ok('prosa: «Internett er [online] og [4 klienter] er tilkoblet.»', /^Internett er online og 4 klienter er tilkoblet\.$/.test(S.prose) && S.pills.join() === 'online,4 klienter', S.prose);
ok('underfaner Enheter · Kameraer · Switcher (Enheter aktiv), én seksjon', S.subs.join() === 'Enheter,Kameraer,Switcher' && S.subOn === 'Enheter' && S.secs.join() === 'Gateway og AP-er', S);
ok('Enheter: gateway + AP-er (ikke switch), status i farge, «2 av 3 online»', S.tiles.join() === 'UDM Pro,AP Loft,AP Stue' && S.tileSt.join() === 'Online,Frakoblet,Online' && S.metas[0] === '2 av 3 online', S);
ok('ingen søkefelt i Nettverk', S.search === 0, S.search);
const css = await p.evaluate(() => { const sr = window.__c.shadowRoot, g = (s) => sr.querySelector(s) && getComputedStyle(sr.querySelector(s)); return { sec: g('.pane .sec').backgroundColor + '|' + g('.pane .sec').borderRadius, ti: g('.ti').backgroundColor + '|' + g('.ti').borderRadius, sub: g('.wrap > .subs .sb.on').backgroundColor + '|' + g('.wrap > .subs .sb.on').height, pp: g('.prose .pp').backgroundColor, prose: g('.prose').fontSize + '|' + g('.prose').lineHeight }; });
ok('mål: seksjon #3a3a3a r28, flis #404040 r26, underfane hvit 38 px, pille #e1e1e1, prosa 16/1.9', css.sec === 'rgb(58, 58, 58)|28px' && css.ti === 'rgb(64, 64, 64)|26px' && css.sub === 'rgb(250, 250, 250)|38px' && css.pp === 'rgb(225, 225, 225)' && css.prose === '16px|30.4px', css);
await shot(p, '1-nettverk');
// sekundærverdi → hovedverdi + graf bytter farge
await click(p, '.hero .sv[data-v="lat"]'); await wait(p, 200);
S = await state(p);
ok('trykk sekundærverdi (Latens) = hovedverdi, «Latens · nå»', S.unit === 'ms' && /^9$/.test(S.big) && S.when === 'Latens · nå', S);
// scrub: touch-action none, stopPropagation, tidsetikett
const scrub = await p.evaluate(async () => {
  const sc = window.__c.shadowRoot.querySelector('.scrub'), r = sc.getBoundingClientRect();
  let bub = 0; const cnt = () => { bub++; }; document.addEventListener('pointerdown', cnt);
  sc.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true, clientX: r.left + r.width * 0.5, clientY: r.top + 20, pointerId: 3, pointerType: 'touch' }));
  sc.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, composed: true, clientX: r.left + r.width * 0.25, clientY: r.top + 20, pointerId: 3, pointerType: 'touch' }));
  await new Promise((q) => setTimeout(q, 150));
  const when = window.__c.shadowRoot.querySelector('.hero .when').textContent, cur = !!window.__c.shadowRoot.querySelector('.hero .cursor');
  sc.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, composed: true, pointerId: 3, pointerType: 'touch' }));
  document.removeEventListener('pointerdown', cnt);
  await new Promise((q) => setTimeout(q, 150));
  return { ta: getComputedStyle(sc).touchAction, when, cur, bub, after: window.__c.shadowRoot.querySelector('.hero .when').textContent };
});
ok('scrub: touch-action none, stopPropagation, «−18 t» + stiplet markør, tilbake til «nå»', scrub.ta === 'none' && scrub.bub === 0 && scrub.when === '−18 t' && scrub.cur && /nå/.test(scrub.after), scrub);
// utvid flis (gateway)
await click(p, '.ti .tih[data-v="dev_udm"]'); await wait(p, 200);
const gx = await p.evaluate(() => { const sr = window.__c.shadowRoot, t = sr.querySelector('.ti.open'); return t && { span: getComputedStyle(t).gridColumnStart + '/' + getComputedStyle(t).gridColumnEnd, badge: t.querySelector('.badge').textContent, kpis: [...t.querySelectorAll('.kp span')].map((x) => x.textContent), acts: [...t.querySelectorAll('.ab')].map((x) => x.textContent.trim()) }; });
ok('gateway utvides til full bredde: modell, klienter/CPU/temp, Omstart', gx && gx.span === '1/-1' && /Dream Machine Pro/.test(gx.badge) && gx.kpis.join() === 'Klienter,CPU,Temp' && gx.acts.join() === 'Omstart', gx);
// Omstart = to trykk
await click(p, '.ti.open .ab.danger'); await wait(p, 150);
let armed = await p.evaluate(() => ({ t: window.__c.shadowRoot.querySelector('.ti.open .ab.danger').textContent.trim(), calls: window.__calls.filter((c) => c[0] === 'button').length }));
ok('Omstart: første trykk = rød «Bekreft · trykk igjen», ingen handling', /Bekreft · trykk igjen/.test(armed.t) && armed.calls === 0, armed);
await click(p, '.ti.open .ab.danger'); await wait(p, 150);
armed = await p.evaluate(() => window.__calls.filter((c) => c[0] === 'button').map((c) => c[2].entity_id));
ok('Omstart: andre trykk trykker button.udm_pro_restart', armed.join() === 'button.udm_pro_restart', armed);
// AP: Finn (LED-blink)
await click(p, '.ti .tih[data-v="dev_ap1"]'); await wait(p, 200);
const ap = await p.evaluate(() => { const t = window.__c.shadowRoot.querySelector('.ti.open'); return { kpis: [...t.querySelectorAll('.kp')].map((x) => x.textContent.replace(/\s+/g, ' ').trim()), acts: [...t.querySelectorAll('.ab')].map((x) => x.textContent.trim()) }; });
ok('AP utvidet: klienter, kanal 36, last · Omstart + Finn', ap.kpis.join('|') === '11Klienter|36Kanal|12 %Last' && ap.acts.join() === 'Omstart,Finn', ap);
await click(p, '.ti.open .ab[data-act="locate"]'); await wait(p, 200);
const blink = await p.evaluate(() => ({ b: !!window.__c.shadowRoot.querySelector('.ti.open.blink'), c: window.__calls.filter((c) => c[0] === 'light').map((c) => c[1] + ':' + c[2].flash) }));
ok('Finn: LED blinker (light.turn_on flash long) og flisen blinker', blink.b && blink.c.join() === 'turn_on:long', blink);

// ---------------------------------------------------------------- Kameraer
await click(p, '.wrap > .subs .sb[data-v="kameraer"]'); await wait(p, 200);
S = await state(p);
ok('Kameraer: Protect-fliser (Opptak / Frakoblet / Pause, ringeklokke med)', ['Hage', 'Innkjørsel', 'Ringeklokke'].every((n) => S.tiles.includes(n)) && S.tileSt[S.tiles.indexOf('Hage')] === 'Frakoblet' && S.tileSt[S.tiles.indexOf('Innkjørsel')] === 'Opptak' && S.tileSt[S.tiles.lastIndexOf('Ringeklokke')] === 'Pause' && /av \d+ online/.test(S.metas[0]), S);
const rec = await p.evaluate(() => { const d = window.__c.shadowRoot.querySelector('.ti .rec'); return d && getComputedStyle(d).animationName; });
ok('Opptak: rød pulserende prikk', rec === 'puls', rec);
await click(p, '.ti .tih[data-v="dev_cam1"]'); await wait(p, 200);
const cam = await p.evaluate(() => { const t = window.__c.shadowRoot.querySelector('.ti.open'); return { kpis: [...t.querySelectorAll('.kp span')].map((x) => x.textContent), acts: [...t.querySelectorAll('.ab')].map((x) => x.textContent.trim()) }; });
ok('kamera utvidet: opptaksmodus, siste bevegelse, bitrate · Omstart + Pause opptak', cam.kpis.join() === 'Opptaksmodus,Siste bevegelse,Bitrate' && cam.acts.join() === 'Omstart,Pause opptak', cam);
await click(p, '.ti.open .ab[data-act="tgl"]'); await wait(p, 150);
const rc = await p.evaluate(() => window.__calls.filter((c) => c[0] === 'select').map((c) => c[2].entity_id + '=' + c[2].option));
ok('Pause opptak: select.innkjorsel_recording_mode → never', rc.join() === 'select.innkjorsel_recording_mode=never', rc);
await shot(p, '2-kameraer');

// ---------------------------------------------------------------- Switcher (portgrid + portdetalj, 360 px)
await p.setViewportSize({ width: 360, height: 900 }); await wait(p, 200);
await click(p, '.wrap > .subs .sb[data-v="switcher"]'); await wait(p, 200);
const sw = await p.evaluate(() => {
  const sr = window.__c.shadowRoot, pts = [...sr.querySelectorAll('.pg .pt')];
  const over = pts.some((pt) => { const r = (s) => pt.querySelector(s).getBoundingClientRect(); const a = r('.pl'), n = r('.pn'), l = r('.pb'); return a.bottom > n.top + 0.5 || n.bottom > l.top + 0.5; });
  const g = getComputedStyle(sr.querySelector('.pg'));
  return { n: pts.length, cols: g.gridTemplateColumns.split(' ').length, h: Math.round(pts[0].getBoundingClientRect().height), over, line: (sr.querySelector('.swl').textContent + sr.querySelector('.poer').textContent).replace(/\s+/g, ' ').trim(), ovf: sr.querySelector('.swl .ell').scrollWidth > sr.querySelector('.swl .ell').clientWidth + 1, poe: !!sr.querySelector('.poeb'), lg: sr.querySelectorAll('.lg span').length, up: sr.querySelectorAll('.pt.up').length, bolts: sr.querySelectorAll('.pt .pb ha-icon').length, bg: getComputedStyle(sr.querySelector('.swc')).backgroundImage };
});
ok('switch-kort: mørk gradient, modell + «4/8 oppe · 30 d 0 t» + PoE-pille og -stolpe', /gradient/.test(sw.bg) && /USW Lite 8 PoE ?4\/8 oppe · 30 d 0 t ?PoE 12,1 \/ 52 W/.test(sw.line) && sw.poe && !sw.ovf, sw);
ok('portgrid: 8 kolonner, 56 px, LED/nummer/lyn stablet uten overlapp på 360 px', sw.n === 8 && sw.cols === 8 && sw.h === 56 && !sw.over && sw.bolts === 3 && sw.lg === 4, sw);
await click(p, '.pg .pt[data-v="3"]'); await wait(p, 200);
let pd = await p.evaluate(() => { const sr = window.__c.shadowRoot, d = sr.querySelector('.pd'); return d && { sel: getComputedStyle(sr.querySelector('.pt.sel')).boxShadow, kp: [...d.querySelectorAll('.kp span')].map((x) => x.textContent), rows: [...d.querySelectorAll('.pdr')].map((r) => r.querySelector('.grow').textContent.trim().slice(0, 9) + '=' + (r.querySelector('.sw') ? (r.querySelector('.sw').disabled ? 'dis' : r.querySelector('.sw').getAttribute('aria-checked')) : '-')), cyc: !!d.querySelector('[data-act="run"]') }; });
ok('port 3 (av): rosa ring, hastighet/PoE/Mbps, «Port aktiv» av, PoE deaktivert, Strømsyklus', pd && /242, 133, 201|f285c9/.test(pd.sel) && pd.kp.join() === 'Hastighet,PoE,Mbps ned/opp' && pd.rows.join() === 'Port akti=false,PoEPorten=dis' && pd.cyc, pd);
await click(p, '.pd .pdr .sw'); await wait(p, 150);
const tg = await p.evaluate(() => window.__calls.filter((c) => c[1] === 'toggle' || c[1] === 'turn_on' || c[1] === 'turn_off').map((c) => c[2].entity_id).pop());
ok('«Port aktiv»-bryteren veksler switch.switch_kontor_port_3 (24.10-funksjonen beholdt)', tg === 'switch.switch_kontor_port_3', tg);
await click(p, '.pg .pt[data-v="1"]'); await wait(p, 200);
pd = await p.evaluate(() => { const d = window.__c.shadowRoot.querySelector('.pd'); return [...d.querySelectorAll('.pdr .sw')].map((s) => s.disabled ? 'dis' : s.getAttribute('aria-checked')).join(); });
ok('port 1: begge brytere på og aktive', pd === 'true,true', pd);
await click(p, '.pd [data-act="run"]'); await wait(p, 150);
const cy = await p.evaluate(() => window.__calls.filter((c) => c[0] === 'button').map((c) => c[2].entity_id).pop());
ok('«Strømsyklus PoE» trykker button.switch_kontor_port_1_power_cycle', cy === 'button.switch_kontor_port_1_power_cycle', cy);
await shot(p, '3-switcher-360');
await p.setViewportSize({ width: 400, height: 900 });

// ---------------------------------------------------------------- Proxmox
await click(p, '.tabs .tb[data-v="proxmox"]'); await wait(p, 300);
S = await state(p);
ok('Proxmox: «pve · node 1», Online-chip, «n kjører», CPU 23 % + Minne/Strøm', S.heroTitle === 'pve · node 1' && /^Online/.test(S.chip) && /\d kjører/.test(S.right) && S.big === '23' && S.unit === '%' && /Minne/.test(S.svs[0]) && /Strøm/.test(S.svs[1]), S);
ok('Proxmox-prosa: «Oppetiden er [21 d 0 t] og strømforbruket er [96 W].»', /^Oppetiden er 21 d 0 t og strømforbruket er 96 W\.$/.test(S.prose), S.prose);
ok('Proxmox-underfaner Oversikt · Lagring · Gjester · Kontroller; Oversikt = Ytelse + Systeminfo', S.subs.join() === 'Oversikt,Lagring,Gjester,Kontroller' && S.secs.join() === 'Ytelse,Systeminfo', S);
const perf = await p.evaluate(() => [...window.__c.shadowRoot.querySelectorAll('.perf .pc')].map((c) => c.textContent.replace(/\s+/g, ' ').trim()));
ok('Ytelse: 4 kolonner Last/Swap/IO wait/CPU-temp', perf.length === 4 && /Last$/.test(perf[0]) && /Swap$/.test(perf[1]) && /IO wait$/.test(perf[2]) && /CPU-temp$/.test(perf[3]), perf);
const sys = await p.evaluate(() => [...window.__c.shadowRoot.querySelectorAll('.lr')].map((c) => c.textContent.replace(/\s+/g, ' ').trim()));
ok('Systeminfo: versjon, kernel, oppdateringer, oppetid', /Versjon8\.2\.4/.test(sys[0]) && /Kernel/.test(sys[1]) && /Oppdateringer7 tilgjengelig/.test(sys[2]) && /Oppetid21 d/.test(sys[sys.length - 1]), sys);
await click(p, '.wrap > .subs .sb[data-v="lagring"]'); await wait(p, 200);
const st = await p.evaluate(() => { const sr = window.__c.shadowRoot; return { rows: [...sr.querySelectorAll('.sa b')].map((x) => x.textContent), bars: [...sr.querySelectorAll('.sa .tb2 i')].map((i) => i.style.background), bays: sr.querySelectorAll('.bay').length, bh: Math.round(sr.querySelector('.bay').getBoundingClientRect().height), dd: !!sr.querySelector('.dd'), sel: !!sr.querySelector('.bay.sel') }; });
ok('Proxmox Lagring: local + local-lvm + tank (ZFS 91 % oransje), disk-bays 96 px + detaljkort', st.rows.join() === 'local,local-lvm,tank' && /orange|242, 181/.test(st.bars[2]) && st.bays === 3 && st.bh === 96 && st.dd && st.sel, st);
await click(p, '.wrap > .subs .sb[data-v="gjester"]'); await wait(p, 200);
let gs = await p.evaluate(() => { const sr = window.__c.shadowRoot; return { rows: [...sr.querySelectorAll('.gr .gn b')].map((x) => x.textContent), bdg: [...sr.querySelectorAll('.gr .bdg')].map((x) => x.textContent), seg: [...sr.querySelectorAll('.fseg .sb')].map((x) => x.textContent.replace(/\s+/g, ' ').trim()), srch: getComputedStyle(sr.querySelector('.srch')).height }; });
ok('Gjester: søk 48 px, filter Alle/VM/CT, rader med VM 100/CT 102-badge', gs.srch === '48px' && gs.seg.join() === 'Alle 4,VM 2,CT 2' && gs.rows.length === 4 && gs.bdg.some((x) => /^VM/.test(x)) && gs.bdg.some((x) => /^CT/.test(x)), gs);
await p.evaluate(() => { const i = window.__c.shadowRoot.querySelector('.srch input'); i.focus(); i.value = 'ad'; i.dispatchEvent(new Event('input', { bubbles: true, composed: true })); });
await wait(p, 200);
gs = await p.evaluate(() => { const sr = window.__c.shadowRoot; return { rows: [...sr.querySelectorAll('.gr .gn b')].map((x) => x.textContent), hits: (sr.querySelector('.hits') || {}).textContent, focus: sr.activeElement && sr.activeElement.dataset.input, val: sr.querySelector('.srch input').value }; });
ok('søk filtrerer på navn og viser «n treff», fokus beholdes', gs.rows.join() === 'AdGuard' && gs.hits === '1 treff' && gs.focus === 'q' && gs.val === 'ad', gs);
await click(p, '.srch .clr'); await wait(p, 150);
await click(p, '.fseg .sb[data-v="vm"]'); await wait(p, 150);
gs = await p.evaluate(() => [...window.__c.shadowRoot.querySelectorAll('.gr .gn b')].map((x) => x.textContent));
ok('filter VM', gs.join() === 'Home Assistant,Windows 11', gs);
// bryter for stoppet VM → start-knapp + spinner
await p.evaluate(() => { const r = [...window.__c.shadowRoot.querySelectorAll('.gr')].find((x) => /Windows/.test(x.textContent)); r.querySelector('.sw').click(); });
await wait(p, 150);
gs = await p.evaluate(() => ({ c: window.__calls.filter((c) => c[0] === 'button').map((c) => c[2].entity_id).pop(), spin: !![...window.__c.shadowRoot.querySelectorAll('.gr')].find((x) => /Windows/.test(x.textContent)).querySelector('.spinw') }));
ok('bryter på stoppet VM trykker start-knappen og viser spinner', gs.c === 'button.windows_11_start' && gs.spin, gs);
await click(p, '.gr .grh'); await wait(p, 150);
gs = await p.evaluate(() => { const g = window.__c.shadowRoot.querySelector('.gr.open'); return g && { bars: [...g.querySelectorAll('.gb span:first-child')].map((x) => x.textContent), acts: [...g.querySelectorAll('.ab')].map((x) => x.textContent.trim()) }; });
ok('utvidet rad: CPU/Minne-stolper + Omstart/Slå av/Stopp', gs && gs.bars.join() === 'CPU,Minne' && gs.acts.join() === 'Omstart,Slå av,Stopp', gs);
await click(p, '.wrap > .subs .sb[data-v="kontroller"]'); await wait(p, 200);
let ct = await p.evaluate(() => { const sr = window.__c.shadowRoot; return { l: [...sr.querySelectorAll('.cb .cbl')].map((x) => x.textContent), w: Math.round(sr.querySelector('.cbb').getBoundingClientRect().width), dang: [...sr.querySelectorAll('.cbb.danger')].length }; });
ok('Proxmox Kontroller: runde 56 px-knapper Omstart + Slå av (farlige), handlinger som mangler er skjult', ct.l.join() === 'Omstart,Slå av' && ct.w === 56 && ct.dang === 2, ct);
const n0 = await p.evaluate(() => window.__calls.length);
await click(p, '.cbb.danger'); await wait(p, 350);
ct = await p.evaluate((n0) => ({ l: window.__c.shadowRoot.querySelector('.cb .cbl').textContent, n: window.__calls.length - n0, arm: window.__c.shadowRoot.querySelector('.cbb.armed') && getComputedStyle(window.__c.shadowRoot.querySelector('.cbb.armed')).backgroundColor }), n0);
ok('farlig kontroll: første trykk = rød «Bekreft», ingen handling', ct.l === 'Bekreft' && ct.n === 0 && /242, 128, 115/.test(ct.arm), ct);
await wait(p, 3200);
ct = await p.evaluate(() => window.__c.shadowRoot.querySelector('.cb .cbl').textContent);
ok('farlig kontroll tilbakestilles etter 3 s', ct === 'Omstart', ct);
await shot(p, '4-proxmox');

// ---------------------------------------------------------------- Unraid
await click(p, '.tabs .tb[data-v="unraid"]'); await wait(p, 300);
S = await state(p);
ok('Unraid: «Tower · Unraid», Online, «14,2 TB brukt», CPU/Minne/Temp', S.heroTitle === 'Tower · Unraid' && /^Online/.test(S.chip) && S.right === '14,2 TB brukt' && /Minne/.test(S.svs[0]) && /Temp/.test(S.svs[1]), S);
ok('Unraid-prosa: «Arrayet er [startet] og lagringen er [78 % full].»', /^Arrayet er startet og lagringen er 78 % full\.$/.test(S.prose), S.prose);
ok('Unraid-underfaner Oversikt · Lagring · Docker · Kontroller', S.subs.join() === 'Oversikt,Lagring,Docker,Kontroller', S.subs);
await click(p, '.wrap > .subs .sb[data-v="lagring"]'); await wait(p, 200);
let ul = await p.evaluate(() => { const sr = window.__c.shadowRoot; return { arr: sr.querySelector('.arr') && sr.querySelector('.arr').textContent.replace(/\s+/g, ' ').trim(), first: sr.querySelector('.pane .sec').firstElementChild.nextElementSibling.className, rows: [...sr.querySelectorAll('.sa b')].map((x) => x.textContent), bays: [...sr.querySelectorAll('.bay')].map((x) => x.textContent.replace(/\s+/g, ' ').trim()), cols: getComputedStyle(sr.querySelector('.bays')).gridTemplateColumns.split(' ').length, rest: sr.querySelectorAll('.bay.rest').length, sw: [...sr.querySelectorAll('.dd .pdr')].map((x) => x.textContent.trim()) }; });
ok('Unraid Lagring: Array-rad først (Startet · Stopp), Array/Cache/docker.img', ul.first === 'arr' && /^ArrayStartetStopp$/.test(ul.arr) && ul.rows.join() === 'Array,Cache,docker.img', ul);
ok('disk-bays: maks 6 kolonner, Disk 2 i «Hvile», detalj med «Aktiv (spinner)»', ul.cols === 5 && ul.rest === 1 && ul.bays.includes('HvileDisk 2') && /Aktiv \(spinner\)/.test(ul.sw[0] || ''), ul);
await click(p, '.arr .ab.danger'); await wait(p, 100);
ul = await p.evaluate(() => ({ t: window.__c.shadowRoot.querySelector('.arr .ab').textContent.trim(), c: window.__calls.filter((c) => /array/.test((c[2] || {}).entity_id || '')).length }));
ok('Array stopp krever to trykk («Bekreft stopp»)', ul.t === 'Bekreft stopp' && ul.c === 0, ul);
await click(p, '.arr .ab.danger'); await wait(p, 100);
ul = await p.evaluate(() => window.__calls.filter((c) => /array/.test((c[2] || {}).entity_id || '')).map((c) => c[0] + '.' + c[1] + ':' + c[2].entity_id).pop());
ok('andre trykk stopper arrayet (switch.tower_array)', /switch\.tower_array$/.test(ul || ''), ul);
await click(p, '.wrap > .subs .sb[data-v="docker"]'); await wait(p, 200);
let dk = await p.evaluate(() => { const sr = window.__c.shadowRoot; return { rows: [...sr.querySelectorAll('.gr .gn b')].map((x) => x.textContent), seg: [...sr.querySelectorAll('.fseg .sb')].map((x) => x.textContent.replace(/\s+/g, ' ').trim()), upd: [...sr.querySelectorAll('.bdg.upd')].map((x) => x.textContent) }; });
ok('Docker: søk + filter Docker/VM, «Oppdatering»-badge på Sonarr', dk.seg.join() === 'Docker 4,VM 1' && dk.rows.length === 4 && dk.upd.join() === 'Oppdatering', dk);
// array stoppet → Docker låst + chip «Array stoppet»
await p.evaluate(() => { const h = window.__h, n = { ...h, states: { ...h.states, 'sensor.tower_array_state': { ...h.states['sensor.tower_array_state'], state: 'Stopped' } } }; window.__h = n; window.__c.hass = n; });
await wait(p, 300);
dk = await p.evaluate(() => { const sr = window.__c.shadowRoot; return { chip: sr.querySelector('.hero .chip').textContent.trim(), dis: [...sr.querySelectorAll('.gr .sw')].every((s) => s.disabled), lock: sr.querySelectorAll('.gr.lock').length, bad: [...sr.querySelectorAll('.prose .pp.bad')].map((x) => x.textContent) }; });
ok('array stoppet: oransje chip «Array stoppet», rød prosapille, Docker/VM låst', dk.chip === 'Array stoppet' && dk.dis && dk.lock === 4 && dk.bad.join() === 'stoppet', dk);
await click(p, '.wrap > .subs .sb[data-v="kontroller"]'); await wait(p, 200);
ct = await p.evaluate(() => [...window.__c.shadowRoot.querySelectorAll('.cb .cbl')].map((x) => x.textContent));
ok('Unraid Kontroller: Paritetssjekk, Spinn ned, Mover, Omstart', ct.join() === 'Paritetssjekk,Spinn ned,Mover,Omstart', ct);
await shot(p, '5-unraid');
// underfane huskes per hovedfane
await click(p, '.tabs .tb[data-v="proxmox"]'); await wait(p, 200);
S = await state(p);
ok('valgt underfane huskes per hovedfane (Proxmox = Kontroller)', S.subOn === 'Kontroller', S.subOn);
const hap = await p.evaluate(() => window.__haptics.length);
ok('haptic ved trykk', hap > 10, hap);
await p.close();

// ---------------------------------------------------------------- Fant ikke + integrasjonsvelger
const p2 = await page({ integrations: { proxmox: 'none' } });
await click(p2, '.tabs .tb[data-v="proxmox"]'); await wait(p2, 300);
S = await state(p2);
ok('«Ingen» for Proxmox: toppkort med «–» og «Ikke koblet», prosa «Ingen [Proxmox VE] …», «slått av»-kort', S.heroH === 184 && S.big === '–' && S.chip === 'Ikke koblet' && /^Ingen Proxmox VE er koblet til ennå\.$/.test(S.prose) && /slått av/.test(S.nf[0]), S);
await click(p2, '.sec.nf [data-act="pickint"]'); await wait(p2, 400);
let pk = await p2.evaluate(() => { const o = window.MSH.portals().pop(); const r = o && o.shadowRoot; return r && { rows: [...r.querySelectorAll('.rr b')].map((x) => x.textContent), on: (r.querySelector('.rr.on b') || {}).textContent, auto: [...r.querySelectorAll('.auto')].length, add: !!r.querySelector('[data-p="add"]'), done: getComputedStyle(r.querySelector('.done')).backgroundImage }; });
ok('integrasjonsvelger (portalt): pve.lan (Auto) + Ingen valgt, «Legg til integrasjon», rosa «Bruk»', pk && pk.rows.join() === 'pve.lan,Ingen' && pk.on === 'Ingen' && pk.auto === 1 && pk.add && /gradient/.test(pk.done), pk);
await p2.evaluate(() => { const r = window.MSH.portals().pop().shadowRoot; r.querySelector('.rr[data-v="ce_pve"]').click(); r.querySelector('[data-p="apply"]').click(); });
await wait(p2, 900);
pk = await p2.evaluate(() => ({ cfg: JSON.stringify(window.__c.config.integrations || null), prose: window.__c.shadowRoot.querySelector('.prose').textContent }));
ok('«Bruk» (auto-valget) fjerner «none» fra config og Proxmox vises igjen', pk.cfg === 'null' && /Oppetiden/.test(pk.prose), pk);
await click(p2, '.tabs .tb[data-v="net"]'); await wait(p2, 200);
await click(p2, '.wrap > .subs .sb[data-v="kameraer"]'); await wait(p2, 200);
await p2.evaluate(async () => { window.__c._openPick('protect'); await new Promise((q) => setTimeout(q, 300)); const r = window.MSH.portals().pop().shadowRoot; r.querySelector('.rr[data-v="none"]').click(); r.querySelector('[data-p="apply"]').click(); });
await wait(p2, 600);
const cfgNone = await p2.evaluate(() => JSON.stringify(window.__c.config.integrations));
ok('velger «Ingen» for Protect lagrer integrations.protect = none', cfgNone === '{"protect":"none"}', cfgNone);
await wait(p2, 300);
pk = await p2.evaluate(() => (window.__c.shadowRoot.querySelector('.missrow') || {}).textContent);
ok('uten Protect: raden «UniFi Protect … · kameraer skjult · Velg»', /kameraer skjult/.test(pk || '') && /Velg/.test(pk || ''), pk);
await click(p2, '.missrow'); await wait(p2, 400);
await p2.evaluate(() => { const r = window.MSH.portals().pop().shadowRoot; r.querySelector('.rr[data-v="ce_protect"]') ? r.querySelector('.rr[data-v="ce_protect"]').click() : null; r.querySelector('[data-p="apply"]').click(); });
await wait(p2, 900);
pk = await p2.evaluate(() => window.__c.shadowRoot.querySelectorAll('.ti').length);
ok('velger fra Protect-raden: kameraene tilbake', pk >= 3, pk);
await p2.close();
// Unraid ikke funnet (ingen entiteter/entry) → «Fant ikke Unraid» + knapper
const p3 = await page(null, null, () => { window.mockExtend(({ E, S }) => { Object.keys(E).forEach((id) => { if (E[id].platform === 'unraid') { delete E[id]; delete S[id]; } }); }); });
await click(p3, '.tabs .tb[data-v="unraid"]'); await wait(p3, 300);
S = await state(p3);
const nfb = await p3.evaluate(() => [...window.__c.shadowRoot.querySelectorAll('.sec.nf .pick')].map((x) => x.textContent.trim()));
ok('Unraid mangler: toppkort «–», «Fant ikke Unraid» med «Velg integrasjon» + «Legg til i HA»', S.big === '–' && S.chip === 'Ikke koblet' && S.nf[0] === 'Fant ikke Unraid' && nfb.join() === 'Velg integrasjon,Legg til i HA', { S, nfb });
await p3.close();

// ---------------------------------------------------------------- Tilpass Server (egen) ↔ GUI-editor
const p4 = await page({ tabs: { order: ['unraid', 'net', 'proxmox'], hidden: ['proxmox'], style: 'active' }, sections: { hidden: ['net.cams'], map: { 'net.sw': 'enheter' } }, subtabs: { style: 'pills' } });
S = await state(p4);
ok('config: fanerekkefølge + skjult Proxmox + stil «Aktiv» (ikon på inaktive)', S.tabs.join() === 'unraid,net' && await p4.evaluate(() => [...window.__c.shadowRoot.querySelectorAll('.tabs .tb')].map((b) => !!b.querySelector('span') + '').join()) === 'true,false', S.tabs);
await click(p4, '.tabs .tb[data-v="net"]'); await wait(p4, 200);
S = await state(p4);
ok('seksjon flyttet til annen underfane + skjult Kameraer → underfaneraden skjules (bare Enheter igjen)', S.subs.length === 0 && S.secs.join() === 'Gateway og AP-er,Switcher', S);
await click(p4, '.trow .gear'); await wait(p4, 900);
const ed = await p4.evaluate(() => {
  const o = window.MSH.portals().pop(); const r = o && o.shadowRoot; const ed = r && r.querySelector('msh-editor'); const er = ed && ed.shadowRoot;
  return er && { tabs: [...er.querySelectorAll('.chips.tabs .chip, .chips.tabs .itab')].map((x) => x.getAttribute('aria-label') || x.textContent.trim()), prev: [...er.querySelectorAll('.svp .tb')].map((x) => x.getAttribute('aria-label')), rows: [...er.querySelectorAll('[data-svlist="tabs"] [data-svk]')].map((x) => x.dataset.svk), handle: getComputedStyle(er.querySelector('[data-svdrag]')).touchAction };
});
ok('«Tilpass Server»: faner Faner/Seksjoner/Toppkort/Integrasjoner/Avansert, live forhåndsvisning + dra-liste', ed && ed.tabs.join().includes('Seksjoner') && ed.tabs.join().includes('Integrasjoner') && ed.prev.join() === 'Unraid,Nettverk' && ed.rows.join() === 'unraid,net,proxmox' && ed.handle === 'none', ed);
// dra Nettverk øverst (touch-pointer)
const drag = await p4.evaluate(async () => {
  const er = window.MSH.portals().pop().shadowRoot.querySelector('msh-editor').shadowRoot;
  const row = er.querySelector('[data-svk="net"]'), hd = row.querySelector('[data-svdrag]'), r = hd.getBoundingClientRect(), up = er.querySelector('[data-svk="unraid"]').getBoundingClientRect();
  let bub = 0; const cnt = () => { bub++; }; document.addEventListener('pointerdown', cnt);
  const ev = (t, y) => hd.dispatchEvent(new PointerEvent(t, { bubbles: true, composed: true, clientX: r.left + 5, clientY: y, pointerId: 7, pointerType: 'touch', isPrimary: true }));
  ev('pointerdown', r.top + 5); for (let i = 1; i <= 8; i++) { ev('pointermove', r.top + 5 - (i * (r.top - up.top + 10)) / 8); await new Promise((q) => setTimeout(q, 16)); }
  ev('pointerup', up.top - 5); document.removeEventListener('pointerdown', cnt);
  await new Promise((q) => setTimeout(q, 300));
  return { bub, order: [...er.querySelectorAll('[data-svlist="tabs"] [data-svk]')].map((x) => x.dataset.svk).join(), prev: [...er.querySelectorAll('.svp .tb')].map((x) => x.getAttribute('aria-label')).join(), live: [...window.__c.shadowRoot.querySelectorAll('.tabs .tb')].map((x) => x.dataset.v).join() };
});
ok('dra fane (touch): ny rekkefølge, forhåndsvisning og kortet oppdateres live, ingen bobling', drag.order === 'net,unraid,proxmox' && drag.prev === 'Nettverk,Unraid' && drag.live === 'net,unraid' && drag.bub === 0, drag);
// øye: vis Proxmox, stil → Ikon: forhåndsvisning live
await p4.evaluate(() => { const er = window.MSH.portals().pop().shadowRoot.querySelector('msh-editor').shadowRoot; er.querySelector('[data-svk="proxmox"] [data-op="tab"]').click(); });
await wait(p4, 200);
const pv = await p4.evaluate(() => { const er = window.MSH.portals().pop().shadowRoot.querySelector('msh-editor').shadowRoot; return [...er.querySelectorAll('.svp .tb')].map((x) => x.getAttribute('aria-label')).join(); });
ok('øye: Proxmox vises igjen i forhåndsvisningen', pv === 'Nettverk,Unraid,Proxmox', pv);
// Seksjoner-fanen: dra Switcher (under Enheter) til Switcher-overskriften
await p4.evaluate(() => { const er = window.MSH.portals().pop().shadowRoot.querySelector('msh-editor').shadowRoot; [...er.querySelectorAll('.chips.tabs [data-a="tab"]')].find((x) => /Seksjoner/.test(x.getAttribute('aria-label') || x.textContent)).click(); });
await wait(p4, 300);
const sx = await p4.evaluate(async () => {
  const er = window.MSH.portals().pop().shadowRoot.querySelector('msh-editor').shadowRoot;
  const seq0 = [...er.querySelectorAll('[data-svlist="secs"] > *')].map((x) => x.dataset.svk || '#' + x.dataset.svsub).join();
  const row = er.querySelector('[data-svk="net.sw"]'), hd = row.querySelector('[data-svdrag]'), r = hd.getBoundingClientRect(), tgt = er.querySelector('[data-svsub="switcher"]').getBoundingClientRect();
  const ev = (t, y) => hd.dispatchEvent(new PointerEvent(t, { bubbles: true, composed: true, clientX: r.left + 5, clientY: y, pointerId: 8, pointerType: 'touch', isPrimary: true }));
  ev('pointerdown', r.top + 5); const dy = tgt.bottom + 20 - r.top; for (let i = 1; i <= 10; i++) { ev('pointermove', r.top + 5 + (i * dy) / 10); await new Promise((q) => setTimeout(q, 16)); }
  ev('pointerup', r.top + 5 + dy); await new Promise((q) => setTimeout(q, 300));
  const ed = window.MSH.portals().pop().shadowRoot.querySelector('msh-editor');
  return { seq0, map: JSON.stringify((ed._config.sections || {}).map || null), live: [...window.__c.shadowRoot.querySelectorAll('.wrap > .subs .sb')].map((x) => x.textContent).join() };
});
ok('dra seksjon til annen underfane: sections.map ryddes (Switcher tilbake), underfaneraden live', sx.map === 'null' && sx.live === 'Enheter,Switcher', sx);
// Integrasjoner-fanen: status per kilde
await p4.evaluate(() => { const er = window.MSH.portals().pop().shadowRoot.querySelector('msh-editor').shadowRoot; [...er.querySelectorAll('.chips.tabs [data-a="tab"]')].find((x) => /Integrasjoner/.test(x.getAttribute('aria-label') || x.textContent)).click(); });
await wait(p4, 300);
const it = await p4.evaluate(() => { const er = window.MSH.portals().pop().shadowRoot.querySelector('msh-editor').shadowRoot; return [...er.querySelectorAll('[data-op="int"]')].map((x) => x.textContent.replace(/\s+/g, ' ').trim()); });
ok('Integrasjoner: «Funnet automatisk · n entiteter» per kilde', it.length === 4 && it.every((x) => /Funnet automatisk · \d+ entiteter/.test(x)), it);
// Ferdig = rosa pille øverst i arket (felles editor)
const fd = await p4.evaluate(() => { const r = window.MSH.portals().pop().shadowRoot; const all = [r, r.querySelector('msh-editor') && r.querySelector('msh-editor').shadowRoot].filter(Boolean); for (const x of all) { const b = [...x.querySelectorAll('button')].find((y) => /Ferdig/.test(y.textContent)); if (b) { const sh = r.querySelector('.sh').getBoundingClientRect(), br = b.getBoundingClientRect(); return { bg: getComputedStyle(b).backgroundImage, topHalf: br.top - sh.top < sh.height / 2, right: br.right > sh.left + sh.width * 0.6 }; } } return null; });
ok('Ferdig = rosa pille øverst til høyre (felles Tilpass-ark)', fd && /gradient/.test(fd.bg) && fd.topHalf && fd.right, fd);
await shot(p4, '6-tilpass');
// GUI-editoren (getConfigElement) har samme skjema
const gui = await p4.evaluate(async () => {
  const el = customElements.get('msh-server-card').getConfigElement(); el.hass = window.__h; el.setConfig({ type: 'custom:msh-server-card', card_id: 'x', tabs: { style: 'icon' } }); document.body.appendChild(el);
  await new Promise((q) => setTimeout(q, 400));
  const sr = el.shadowRoot; const tabs = [...sr.querySelectorAll('.chips.tabs [data-a="tab"]')].map((x) => x.getAttribute('aria-label') || x.textContent.trim());
  let got = null; el.addEventListener('config-changed', (e) => { got = e.detail.config; });
  sr.querySelector('[data-svk="proxmox"] [data-op="tab"]').click(); await new Promise((q) => setTimeout(q, 200));
  return { tabs, got: got && JSON.stringify(got.tabs), prev: [...sr.querySelectorAll('.svp .tb')].map((x) => !x.querySelector('span')).every(Boolean) };
});
ok('GUI-editor: samme faner, øye lagrer tabs.hidden i config, forhåndsvisning «Ikon»', gui.tabs.length === 5 && /"hidden":\["proxmox"\]/.test(gui.got || '') && gui.prev, gui);
await p4.close();

// ---------------------------------------------------------------- PC-bredde
const p5 = await page(null, { width: 1280, height: 900 });
const wd = await p5.evaluate(() => { const c = window.__c, pop = c.closest('.inner'); const cs = getComputedStyle(pop); return { c: Math.round(c.getBoundingClientRect().width), p: Math.round(pop.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)) }; });
ok('fyller bredden på PC', Math.abs(wd.c - wd.p) <= 1, wd);
await p5.close();
} catch (e) { fail.push('krasj'); res.krasj = String(e && e.stack || e); }
ok('ingen JS-feil', errs.length === 0, errs.slice(0, 5));
await b.close();
console.log(JSON.stringify(res, null, 1));
console.log(fail.length ? `FEIL: ${fail.length} (${fail.join(' | ')})` : 'ALT OK');
process.exit(fail.length ? 1 : 0);
