// Fiks 35.1 + 35.2 · Server v6 (#server, msh-server-card) – 1:1 mot «Server v6.dc.html» (mål/farger/tekster testes direkte):
//   vertvelger (fanelinje, tab_height, tannhjul / velger: kort med ring + statusprikk), toppkort 184 px (44/300, scrub),
//   prosa-setning (ÉN <p> med inline-piller – 35.7 regel 1), underfaner per vert, ALLE 4 verter × ALLE underfaner,
//   felles liste (søk, filterchips med antall, bryter med stopPropagation, utvidet rad med 6 fliser/stolper/brytere/handlinger),
//   flere switcher (switch-kort med LED-stripe, portgrid, portinfo), Array hold-for-å-bekrefte, Oppdateringer (update.install),
//   System (rød tone = bekreftelse), lys + mørk modus (lys: tekstkontrast ≥ 4,5:1, ingen hvit tekst på lys flate).
//   node test/server35-check.mjs   (SHOTS=<mappe> for skjermbilder)
import { createRequire } from 'node:module';
import { readdirSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/server35-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const shots = process.env.SHOTS || '';
if (shots) mkdirSync(shots, { recursive: true });
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = [], fail = [];
const ok = (name, cond, info) => { res.push(`${cond ? '✔' : '✘'} ${name}${!cond && info !== undefined ? ' · ' + JSON.stringify(info).slice(0, 700) : ''}`); if (!cond) fail.push(name); };
const mocks = readdirSync('test/mock').sort().map((m) => resolve('test/mock/' + m));
const errs = [];

async function page(cfg, o = {}) {
  const p = await b.newPage({ viewport: o.vp || { width: 400, height: 900 }, hasTouch: true });
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/fonts.googleapis|net::ERR/.test(m.text())) errs.push(m.text()); });
  await p.goto('file://' + resolve('test/harness.html'));
  for (const m of mocks) await p.addScriptTag({ path: m });
  await p.addScriptTag({ path: bundle });
  await p.evaluate(async ({ cfg, light }) => {
    const h = window.mockHass();
    if (light) { h.themes = { ...(h.themes || {}), darkMode: false }; document.body.style.background = '#e6e6e6'; }
    window.__h = h;
    window.__haptics = [];
    window.addEventListener('haptic', (e) => window.__haptics.push(e.detail));
    const bc = document.createElement('bubble-card');
    bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash: '#server' });
    bc.innerHTML = `<div class="pop" style="background:${light ? '#f0f0f0' : '#282828'}"><div class="hdr">Server</div><div class="inner"></div></div>`;
    document.getElementById('dash').appendChild(bc);
    location.hash = '#server';
    const c = document.createElement('msh-server-card');
    c.setConfig({ type: 'custom:msh-server-card', card_id: 'pop-server-35', ...(cfg || {}) });
    c.hass = h;
    bc.querySelector('.inner').appendChild(c);
    window.__c = c;
    window.__R = (sel) => c.shadowRoot.querySelector(sel);
    window.__A = (sel) => [...c.shadowRoot.querySelectorAll(sel)];
    window.__t = (e) => (e ? e.textContent.replace(/\s+/g, ' ').trim() : null);
    window.__cs = (sel, k) => { const e = c.shadowRoot.querySelector(sel); return e ? getComputedStyle(e)[k] : null; };
    window.__rgb = (v) => { const p = MSH.theme.parse(v); return p ? p.slice(0, 3).map((x) => Math.round(x)).join(',') : String(v); };
    await new Promise((q) => setTimeout(q, 1000));
  }, { cfg, light: !!o.light });
  return p;
}
const wait = (p, ms) => p.evaluate((ms) => new Promise((q) => setTimeout(q, ms)), ms);
const shot = async (p, n) => { if (shots) await p.screenshot({ path: `${shots}/server35-${n}.png`, fullPage: true }); };
const click = async (p, sel, ms = 250) => { const r = await p.evaluate((sel) => { const e = window.__R(sel); if (!e) return false; e.click(); return true; }, sel); await wait(p, ms); return r; };
const host = (p, k) => click(p, `[data-act="host"][data-v="${k}"]`, 400);
const sub = (p, k) => click(p, `.sb[data-v="${k}"]`, 300);
const calls = (p) => p.evaluate(() => window.__calls.filter((c) => c[0] !== 'ws').map((c) => `${c[0]}.${c[1]}:${JSON.stringify(c[2])}`));
const clearCalls = (p) => p.evaluate(() => { window.__calls.length = 0; });
const toasts = (p) => p.evaluate(() => { const r = MSH.overlayRoot && MSH.overlayRoot(); const t = r && r.querySelector('#msh-toast'); return t ? t.textContent : ''; });

// Lys modus: kontrast for all synlig tekst i kortet (ikke dimmet/deaktivert) mot faktisk bakgrunn (lag + popup #f0f0f0)
const contrastScan = (p) => p.evaluate(() => {
  const P = MSH.theme.parse, over = (f, bg) => { const a = f[3]; return [f[0] * a + bg[0] * (1 - a), f[1] * a + bg[1] * (1 - a), f[2] * a + bg[2] * (1 - a), 1]; };
  const lin = (u) => { u /= 255; return u <= 0.03928 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4); };
  const L = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const popup = P(getComputedStyle(document.querySelector('.pop')).backgroundColor);
  const bgOf = (el) => {
    const layers = [];
    for (let n = el; n && n.nodeType === 1; n = n.parentNode && n.parentNode.nodeType === 11 ? n.parentNode.host : n.parentNode) {
      if (n === window.__c) break;
      const cs = getComputedStyle(n);
      if (cs.backgroundImage && cs.backgroundImage !== 'none' && !/url\(/.test(cs.backgroundImage)) { const m = /(rgba?\([^)]*\)|color\(srgb[^)]*\))/.exec(cs.backgroundImage); if (m) { layers.push(P(m[1])); break; } }
      const c = P(cs.backgroundColor);
      if (c && c[3] > 0) { layers.push(c); if (c[3] >= 0.999) break; }
    }
    let base = popup;
    for (let i = layers.length - 1; i >= 0; i--) base = over(layers[i], base);
    return base;
  };
  const dimmed = (el) => { for (let n = el; n && n !== window.__c; n = n.parentNode && n.parentNode.nodeType === 11 ? n.parentNode.host : n.parentNode) { if (n.nodeType !== 1) continue; if (n.disabled || n.getAttribute('aria-disabled') === 'true' || parseFloat(getComputedStyle(n).opacity) < 0.99) return true; } return false; };
  const out = { n: 0, low: [], white: [], dim: 0 };
  window.__A('*').forEach((el) => {
    if (!el.getClientRects().length || ['STYLE', 'svg', 'path'].includes(el.tagName)) return;
    const txt = [...el.childNodes].filter((x) => x.nodeType === 3).map((x) => x.textContent).join('').trim();
    if (!txt) return;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden') return;
    if (dimmed(el)) { out.dim++; return; }
    const bg = bgOf(el), fg = over(P(cs.color) || [0, 0, 0, 1], bg);
    const l1 = L(fg), l2 = L(bg), cr = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    out.n++;
    if (cr < 4.5) out.low.push(`${txt.slice(0, 24)} ${cr.toFixed(2)} fg=${fg.slice(0, 3).map(Math.round)} bg=${bg.slice(0, 3).map(Math.round)}`);
    if (L(bg) > 0.6 && L(fg) > 0.75) out.white.push(txt.slice(0, 24));
  });
  return out;
});

try {
/* ================================================================ MØRK MODUS · struktur, vertvelger, toppkort, prosa */
let p = await page();
const S0 = await p.evaluate(() => {
  const kids = [...__R('.wrap').children].map((e) => e.className.split(' ')[0]);
  const tb = __A('.trow .tabs .tb'), on = __R('.trow .tb.on');
  return { kids, tabs: tb.map((x) => x.dataset.v), labels: tb.map(__t), on: on && on.dataset.v,
    tabH: Math.round(tb[0].getBoundingClientRect().height), track: __cs('.trow .tabs', 'backgroundColor') + '|' + __cs('.trow .tabs', 'borderRadius') + '|' + __cs('.trow .tabs', 'padding'),
    onBg: getComputedStyle(on).backgroundImage, onCol: getComputedStyle(on).color, offCol: getComputedStyle(tb[1]).color,
    gear: !!__R('.trow > .gear[data-act="customize"]'), gearW: Math.round(__R('.trow > .gear').getBoundingClientRect().width) };
});
ok('rekkefølge: vertvelger → toppkort → prosa → underfaner → innhold', S0.kids.join() === 'trow,hero,prose,subs,pane', S0.kids);
ok('vertvelger: Nettverk · Proxmox · Unraid · HA, Nettverk aktiv, tannhjul til høyre', S0.tabs.join() === 'net,proxmox,unraid,ha' && S0.labels.join() === 'Nettverk,Proxmox,Unraid,HA' && S0.on === 'net' && S0.gear, S0);
ok('fane 44 px (tab_height std), pill-spor #3a3a3a r999 padding 4, tannhjul 52 px', S0.tabH === 44 && /rgb\(58, 58, 58\)\|999px\|4px/.test(S0.track) && S0.gearW === 52, S0);
ok('aktiv fane rosa gradient + --ki-on-accent (#3a3a3a), inaktiv #c7c7c7', /linear-gradient/.test(S0.onBg) && /242, 133, 201/.test(S0.onBg) && S0.onCol === 'rgb(58, 58, 58)' && S0.offCol === 'rgb(199, 199, 199)', S0);
const H0 = await p.evaluate(() => {
  const h = __R('.hero'), r = h.getBoundingClientRect(), g = __R('.hero .graph').getBoundingClientRect(), big = __R('.hero .big');
  return { h: Math.round(r.height), rad: getComputedStyle(h).borderRadius, bg: getComputedStyle(h).backgroundColor, title: __t(__R('.hero .hn')), chip: __t(__R('.hero .chip')), chipCol: __rgb(__cs('.hero .chip', 'color')),
    big: __t(big), bigF: getComputedStyle(big).fontSize + '/' + getComputedStyle(big).fontWeight, unit: __t(__R('.hero .bu')), svs: __A('.hero .sv').map(__t), when: __t(__R('.hero .when')),
    gH: Math.round(g.height), gEdge: Math.round(g.left - r.left) + '|' + Math.round(r.right - g.right) + '|' + Math.round(r.bottom - g.bottom), paths: __A('.hero .graph path').length, valsTop: Math.round(__R('.hero .vals').getBoundingClientRect().top - r.top) };
});
ok('toppkort 184 px r28 #3a3a3a, tittel «Nettverk» + grønn «Online»-chip', H0.h === 184 && H0.rad === '28px' && H0.bg === 'rgb(58, 58, 58)' && H0.title === 'Nettverk' && H0.chip === 'Online' && H0.chipCol === '102,209,158', H0);
ok('toppkort: stor verdi 44/300 «38 Mbit», små Opp «4 Mbit» + «4 klienter», «nå · ned», top 54', H0.big === '38' && H0.bigF === '44px/300' && /Mbit/.test(H0.unit) && H0.svs.join('|') === '4 Mbit|4 klienter' && H0.when === 'nå · ned' && H0.valsTop === 54, H0);
ok('graf 84 px kant til kant (areal + linje)', H0.gH === 84 && H0.gEdge === '0|0|0' && H0.paths === 2, H0);
await click(p, '.hero .sv[data-v="cl"]');
const H1 = await p.evaluate(() => ({ big: __t(__R('.hero .big')), when: __t(__R('.hero .when')), svs: __A('.hero .sv').map(__t), stroke: __R('.hero .graph path:nth-of-type(2)').style.stroke }));
ok('trykk på liten måling (Klienter) bytter graf + stor verdi', H1.big === '4' && H1.when === 'nå · klienter' && H1.svs.length === 2 && /purple/.test(H1.stroke), H1);
const scrub = await p.evaluate(async () => {
  const sc = __R('.scrub'), r = sc.getBoundingClientRect();
  let bub = 0; const cnt = () => { bub++; }; document.addEventListener('pointerdown', cnt); document.addEventListener('touchmove', cnt);
  sc.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true, clientX: r.left + r.width * 0.5, clientY: r.top + 20, pointerId: 3, pointerType: 'touch' }));
  sc.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, composed: true, clientX: r.left + r.width * 0.75, clientY: r.top + 20, pointerId: 3, pointerType: 'touch' }));
  await new Promise((q) => setTimeout(q, 150));
  const when = __t(__R('.hero .when')), mk = !!__R('.hero .graph line.mk');
  sc.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, composed: true, pointerId: 3, pointerType: 'touch' }));
  document.removeEventListener('pointerdown', cnt); document.removeEventListener('touchmove', cnt);
  await new Promise((q) => setTimeout(q, 150));
  return { ta: getComputedStyle(sc).touchAction, when, mk, bub, after: __t(__R('.hero .when')) };
});
ok('scrub: touch-action none + stopPropagation, «−6 t · klienter» + stiplet markør, slipp → «nå»', scrub.ta === 'none' && scrub.bub === 0 && /^−6 t · klienter$/.test(scrub.when) && scrub.mk && /^nå/.test(scrub.after), scrub);
const PR = await p.evaluate(() => {
  const ps = __A('.prose'), pe = ps[0], cs = getComputedStyle(pe), pills = [...pe.querySelectorAll('.pp')];
  return { n: ps.length, tag: pe.tagName, disp: cs.display, fs: cs.fontSize + '/' + cs.lineHeight, col: cs.color, txt: __t(pe), pills: pills.map(__t), pd: pills.map((x) => getComputedStyle(x).display).join(),
    pbg: pills[0] && getComputedStyle(pills[0]).backgroundColor, pfg: pills[0] && getComputedStyle(pills[0]).color, prad: pills[0] && getComputedStyle(pills[0]).borderRadius, kids: [...pe.children].map((x) => x.tagName).join(), lines: Math.round(pe.getBoundingClientRect().height / parseFloat(cs.lineHeight)) };
});
ok('prosa: ÉN <p> (display block, 16/1.9, #e1e1e1), ingen flex/grid', PR.n === 1 && PR.tag === 'P' && PR.disp === 'block' && PR.fs === '16px/30.4px' && PR.col === 'rgb(225, 225, 225)', PR);
ok('prosa: «Nettet er [2 enheter frakoblet] og [4 klienter] er tilkoblet.»', PR.txt === 'Nettet er 2 enheter frakoblet og 4 klienter er tilkoblet.' && PR.pills.join('|') === '2 enheter frakoblet|4 klienter', PR);
ok('prosa-piller er inline (invers #fafafa/#141414, r999) – bare <span>-barn', PR.pd === 'inline,inline' && PR.pbg === 'rgb(250, 250, 250)' && PR.pfg === 'rgb(20, 20, 20)' && PR.kids === 'SPAN,SPAN' && PR.lines <= 3, PR);
const SB = await p.evaluate(() => ({ labels: __A('.subs .sb').map(__t), on: __t(__R('.subs .sb.on')), h: Math.round(__R('.subs .sb').getBoundingClientRect().height), bg: __cs('.subs', 'backgroundColor') + '|' + __cs('.subs', 'borderRadius'), onBg: getComputedStyle(__R('.subs .sb.on')).backgroundImage }));
ok('underfaner Nettverk: Internett · Enheter · Switch (ingen Kameraer), 38 px, spor #3a3a3a r22, aktiv rosa', SB.labels.join() === 'Internett,Enheter,Switch' && SB.on === 'Internett' && SB.h === 38 && SB.bg === 'rgb(58, 58, 58)|22px' && /gradient/.test(SB.onBg), SB);

/* ---------------------------------------------------------------- Nettverk × alle underfaner */
const W = await p.evaluate(() => ({ t: __A('.wan .ch > span').map(__t).join('|'), tiles: __A('.wan .wt').map(__t), bg: __cs('.wan .wt', 'backgroundColor') + '|' + __cs('.wan .wt', 'borderRadius'), vf: __cs('.wan .wv .num', 'fontSize') + '/' + __cs('.wan .wv .num', 'fontWeight') }));
ok('Internett: tittel + «– · 9 ms» (ISP mangler → –), fliser Ned 38 / Opp 4 Mbit/s (#404040 r20, 28/300)', W.t === 'Internett|– · 9 ms' && W.tiles.join('|') === 'Ned38Mbit/s|Opp4Mbit/s' && W.bg === 'rgb(64, 64, 64)|20px' && W.vf === '28px/300', W);
await shot(p, 'net-internett');
await sub(p, 'enheter');
let D = await p.evaluate(() => ({ head: __A('.devs .ch > span').map(__t).join('|'), names: __A('.devs .dr b').map(__t), metas: __A('.devs .dm').map(__t), offCol: (__A('.devs .dm.off')[0] && __rgb(getComputedStyle(__A('.devs .dm.off')[0]).color)) }));
ok('Enheter: gateway, switcher, AP-er (+ Protect-kameraer), «x av y online»', ['UDM Pro', 'Switch Kontor', 'Switch Stue', 'Switch Garasje', 'AP Stue', 'AP Loft', 'Innkjørsel'].every((n) => D.names.includes(n)) && /^Enheter\|\d+ av \d+ online$/.test(D.head), D);
ok('Enheter: «Frakoblet» i oransje, klienter som undertekst', D.metas[D.names.indexOf('AP Loft')] === 'Frakoblet' && D.offCol === '242,181,115' && D.metas[D.names.indexOf('AP Stue')] === '11 klienter', D);
await click(p, '.devs .dr[data-v="dev_udm"]');
D = await p.evaluate(() => { const w = __R('.devs .dw.open'); return w && { bg: getComputedStyle(w).backgroundColor, stats: [...w.querySelectorAll('.xt .xl')].map(__t), vals: [...w.querySelectorAll('.xt .xv')].map(__t), acts: [...w.querySelectorAll('.xa .ab')].map(__t), tg: [...w.querySelectorAll('.xgr b')].map(__t) }; });
ok('Enheter utvidet (gateway, #404040): 6 fliser CPU/Minne/Temp/Klienter/Oppetid/Firmware + handlinger', D && D.bg === 'rgb(64, 64, 64)' && D.stats.join() === 'CPU,Minne,Temp,Klienter,Oppetid,Firmware' && D.vals.slice(0, 3).join() === '18%,54%,52°' && D.vals[5] === '4.1.13' && D.acts.join() === 'Start på nytt,Finn,Oppdater', D);
await click(p, '.devs .dr[data-v="dev_ap1"]');
D = await p.evaluate(() => { const w = __R('.devs .dw.open'); return { n: __A('.devs .dw.open').length, stats: [...w.querySelectorAll('.xt .xl')].map(__t), bars: [...w.querySelectorAll('.xbr')].map(__t), tg: [...w.querySelectorAll('.xgr b')].map(__t), acts: [...w.querySelectorAll('.xa .ab')].map(__t) }; });
ok('AP utvidet: Klienter/Kanal/Sendestyrke …, båndstolper 5/2,4 GHz, «LED-lys»-bryter, én rad åpen', D.n === 1 && D.stats[0] === 'Klienter' && D.stats[1] === 'Kanal' && D.bars.join('|') === '5 GHz7 klienter|2,4 GHz4 klienter' && D.tg.join() === 'LED-lys' && D.acts.includes('Finn'), D);
await shot(p, 'net-enheter-utvidet');
await clearCalls(p);
await click(p, '.devs .dw.open .xgr .tg');
ok('LED-lys-bryteren veksler light.ap_stue_led', (await calls(p)).some((c) => /^(light|homeassistant)\.toggle:.*ap_stue_led/.test(c)), await calls(p));
await sub(p, 'switch');
let SW = await p.evaluate(() => ({ cards: __A('.swg .swc').map((x) => ({ n: __t(x.querySelector('.swn')), s: __t(x.querySelector('.sws')), on: x.classList.contains('on'), leds: x.querySelectorAll('.leds i').length, sh: getComputedStyle(x).boxShadow, ledBg: [...x.querySelectorAll('.leds i')].map((i) => __rgb(getComputedStyle(i).backgroundColor)), ledA: [...x.querySelectorAll('.leds i')].map((i) => +(MSH.theme.parse(getComputedStyle(i).backgroundColor)[3]).toFixed(2)) })),
  grid: __cs('.swg', 'gridTemplateColumns'), head: __A('.swh .col > *').map(__t).join('|'), pcols: getComputedStyle(__R('.pg')).gridTemplateColumns.split(' ').length, ports: __A('.pg .pt').length, info: __t(__R('.pinfo')) }));
ok('flere switcher: rutenett av switch-kort (auto-fit 100 px), navn uten «Switch », «oppe/total · W PoE»', SW.cards.length === 3 && SW.cards.map((c) => c.n).join() === 'Kontor,Stue,Garasje' && SW.cards[0].s === '4/8 · 12 W PoE' && SW.cards[1].s === '5/8 · 9 W PoE', SW);
ok('valgt switch = rosa kant, frakoblet = «Frakoblet» + oransje stripe', SW.cards[0].on && /242, 133, 201/.test(SW.cards[0].sh) && SW.cards[2].s === 'Frakoblet' && SW.cards[2].ledBg.every((x) => x === '242,181,115') && SW.cards[2].ledA.every((a) => a === 0.35), SW);
ok('LED-stripe: én strek per port etter hastighet (Stue: blå 2,5 G, grønn 1 G, oransje 100 M, grå ledig)', SW.cards[1].leds === 8 && SW.cards[1].ledBg[0] === '115,185,242' && SW.cards[1].ledBg[1] === '102,209,158' && SW.cards[1].ledBg[3] === '242,181,115' && SW.cards[1].ledBg[4] === '84,84,84', SW.cards[1]);
ok('portgrid 8 per rad + forklaring', SW.pcols === 8 && SW.ports === 8 && SW.head === 'Switch Kontor|USW Lite 8 PoE' && /Grønn 1 G · blå 2,5 G/.test(SW.info), SW);
await click(p, '.swg .swc[data-v="dev_usw2"]');
await click(p, '.pg .pt[data-v="4"]');
SW = await p.evaluate(() => { const pt = (n) => __R(`.pg .pt[data-v="${n}"]`); return { head: __t(__R('.swh b')), info: __t(__R('.pinfo')), sel: getComputedStyle(pt(4)).boxShadow, poe: getComputedStyle(pt(1)).boxShadow, dis: getComputedStyle(pt(8)).backgroundImage, led1: __rgb(pt(1).querySelector('i').style.background), h: Math.round(pt(1).getBoundingClientRect().height) }; });
ok('trykk switch-kort (Stue) → portgrid; port 4 → «Port 4 · Hue Bridge · 100 M · PoE»', SW.head === 'Switch Stue' && SW.info === 'Port 4 · Hue Bridge · 100 M · PoE' && /242, 133, 201/.test(SW.sel), SW);
ok('port: 40 px, PoE = oransje strek under, deaktivert = skravert, LED blå for 2,5 G', SW.h === 40 && /inset/.test(SW.poe) && /repeating-linear-gradient/.test(SW.dis) && SW.led1 === '115,185,242', SW);
await shot(p, 'net-switch-stue');
await click(p, '.swg .swc[data-v="dev_usw3"]');
ok('frakoblet switch valgt: «Frakoblet» i hodet', /Frakoblet/.test(await p.evaluate(() => __t(__R('.swh')))));

/* ---------------------------------------------------------------- Proxmox × alle underfaner */
await host(p, 'proxmox');
let X = await p.evaluate(() => ({ subs: __A('.subs .sb').map(__t), title: __t(__R('.hero .hn')), chip: __t(__R('.hero .chip')), big: __t(__R('.hero .big')), svs: __A('.hero .sv').map(__t), when: __t(__R('.hero .when')), prose: __t(__R('.prose')) }));
ok('Proxmox: underfaner Gjester · Lagring · Backup', X.subs.join() === 'Gjester,Lagring,Backup', X);
ok('Proxmox-toppkort: CPU 23 %, Minne 58 %, IO wait 3,0 %, chip «3 av 4 kjører»', X.title === 'Proxmox' && X.chip === '3 av 4 kjører' && X.big === '23' && X.svs.join('|') === '58%|3,0%' && X.when === 'nå · cpu', X);
ok('Proxmox-prosa: «Proxmox kjører [3 av 4 gjester] og lagringen er [63 % full].»', X.prose === 'Proxmox kjører 3 av 4 gjester og lagringen er 63 % full.', X.prose);
let G = await p.evaluate(() => ({ head: __A('.gl .ch > span').map(__t).join('|'), srchH: Math.round(__R('.gl .srch').getBoundingClientRect().height), srchBg: __cs('.gl .srch', 'backgroundColor'), chips: __A('.gl .cp').map(__t), chipsBg: __cs('.gl .chips', 'backgroundColor'),
  rows: __A('.gl .gr b').map(__t), tags: __A('.gl .gtag').map(__t), subs: __A('.gl .gsub').map(__t), rowH: Math.round(__R('.gl .gr').getBoundingClientRect().height), rowBg: __cs('.gl .gw', 'backgroundColor') + '|' + __cs('.gl .gw', 'borderRadius'),
  icOn: __cs('.gl .gic.on', 'backgroundColor'), tgOn: __cs('.gl .tg.on', 'backgroundColor'), tgW: Math.round(__R('.gl .tg').getBoundingClientRect().width) }));
ok('felles liste: «Gjester · 3 av 4 kjører», søk 44 px (#404040), chips Alle · VM · CT med antall (spor #2f2f2f)', G.head === 'Gjester|3 av 4 kjører' && G.srchH === 44 && G.srchBg === 'rgb(64, 64, 64)' && G.chips.join() === 'Alle4,VM2,CT2' && G.chipsBg === 'rgb(47, 47, 47)', G);
ok('rader 60 px #404040 r20: kjørende først, tag VM/CT, «Kjører · CPU x % · RAM y %», ikon invers, rosa bryter 50 px', G.rowH === 60 && G.rowBg === 'rgb(64, 64, 64)|20px' && G.rows[G.rows.length - 1] === 'Windows 11' && G.tags.every((t) => /^(VM|CT)/.test(t)) && /^Kjører · CPU \d+ % · RAM \d+ %$/.test(G.subs[0]) && G.subs[G.subs.length - 1] === 'Stoppet' && G.icOn === 'rgb(250, 250, 250)' && G.tgOn === 'rgb(242, 133, 201)' && G.tgW === 50, G);
await p.evaluate(() => { const i = __R('.gl .srch input'); i.focus(); i.value = 'ad'; i.dispatchEvent(new Event('input', { bubbles: true, composed: true })); });
await wait(p, 250);
G = await p.evaluate(() => ({ rows: __A('.gl .gr b').map(__t), clr: !!__R('.gl .clr'), foc: (window.__c.shadowRoot.activeElement || {}).dataset?.input }));
ok('søk filtrerer (AdGuard), tøm-knapp vises, fokus beholdes', G.rows.join() === 'AdGuard' && G.clr && G.foc === 'q', G);
await click(p, '.gl .clr');
await p.evaluate(() => { const i = __R('.gl .srch input'); i.value = 'zzz'; i.dispatchEvent(new Event('input', { bubbles: true, composed: true })); });
await wait(p, 200);
ok('ingen treff → «Ingen treff»', (await p.evaluate(() => __t(__R('.gl .nohit')))) === 'Ingen treff');
await click(p, '.gl .clr');
await click(p, '.gl .cp[data-v="VM"]');
ok('filterchip VM', (await p.evaluate(() => __A('.gl .gr b').map(__t).join())) === 'Home Assistant,Windows 11');
await click(p, '.gl .cp[data-v="Alle"]');
await clearCalls(p);
await click(p, '.gl .gr[data-v="px-dev_vm101"] .tg');
G = await p.evaluate(() => ({ open: !!__R('.gl .gw.open'), on: __R('.gl .gr[data-v="px-dev_vm101"] .tg').classList.contains('on') }));
const c1 = await calls(p);
ok('bryter i raden starter gjesten uten å åpne raden (stopPropagation), optimistisk på', !G.open && G.on && c1.some((c) => /button\.press:.*windows_11_start/.test(c)), { G, c1 });
await click(p, '.gl .gr[data-v="px-dev_vm100"]');
G = await p.evaluate(() => { const w = __R('.gl .gw.open'); return w && { sh: MSH.theme.parse(/(color\([^)]*\)|rgba?\([^)]*\))/.exec(getComputedStyle(w).boxShadow)[1]).map((x, i) => (i < 3 ? Math.round(x) : x)).join(),  n: w.querySelectorAll('.xt').length, stats: [...w.querySelectorAll('.xt .xl')].map(__t), tileBg: getComputedStyle(w.querySelector('.xt')).backgroundColor + '|' + getComputedStyle(w.querySelector('.xt')).borderRadius,
  bars: [...w.querySelectorAll('.xbl')].map(__t), tg: [...w.querySelectorAll('.xgr b')].map(__t), tgDis: [...w.querySelectorAll('.xgr .tg')].map((x) => x.disabled), acts: [...w.querySelectorAll('.xa .ab')].map(__t), hot: __rgb(getComputedStyle(w.querySelector('.xa .ab.hot')).color) }; });
ok('utvidet rad: rosa kant, 6 stat-fliser (#2f2f2f r16), stolper CPU/RAM/Disk', G && G.sh === '242,133,201,0.5' && G.n === 6 && G.stats[0] === 'CPU' && G.stats[3] === 'Oppetid' && G.stats[4] === 'IP' && G.stats[5] === 'Nett ned / opp' && G.tileBg === 'rgb(47, 47, 47)|16px' && G.bars.join() === 'CPU,RAM,Disk', G);
ok('Proxmox-brytere «Start ved oppstart», «Beskyttelse», «Med i nattlig backup» (mangler data → deaktivert, «–»)', G.tg.join() === 'Start ved oppstart,Beskyttelse,Med i nattlig backup' && G.tgDis.every(Boolean), G);
ok('handlinger «Start på nytt» (rød tone) · «Logg» · «Konsoll» · «Snapshot»', G.acts.join() === 'Start på nytt,Logg,Konsoll,Snapshot' && G.hot === '242,128,115', G);
await clearCalls(p);
await click(p, '.gl .gw.open .ab.hot');
const arm = await p.evaluate(() => __t(__R('.gl .gw.open .ab.hot')));
ok('rød tone: første trykk = «Bekreft · trykk igjen», ingen handling', arm === 'Bekreft · trykk igjen' && (await calls(p)).length === 0, arm);
await click(p, '.gl .gw.open .ab.hot');
ok('rød tone: andre trykk → button.press haos_reboot', (await calls(p)).some((c) => /button\.press:.*haos_reboot/.test(c)), await calls(p));
await shot(p, 'proxmox-gjester-utvidet');
await sub(p, 'lagring');
X = await p.evaluate(() => ({ t: __t(__R('.stc .ct')), rows: __A('.stc .stl b').map(__t), meta: __A('.stc .stl span').map(__t), bars: __A('.stc .bar8 i').map((i) => __rgb(i.style.background)), h: Math.round(__R('.stc .bar8').getBoundingClientRect().height) }));
ok('Lagring: én stripe (8 px) per storage, oransje ≥ 80 % (tank 91 %)', X.t === 'Lagring' && X.rows.join() === 'local,local-lvm,tank' && X.meta[1] === '301 av 476 GB' && X.bars[2] === '242,181,115' && X.bars[1] === '115,185,242' && X.h === 8, X);
await sub(p, 'backup');
X = await p.evaluate(() => ({ t: __A('.bkr .col > *').map(__t).join('|'), h: Math.round(__R('.bkr').getBoundingClientRect().height) }));
ok('Backup: rad 64 px med siste jobb-status (mangler → «–»)', X.h === 64 && X.t === 'Backup|–', X);
await shot(p, 'proxmox-backup');

/* ---------------------------------------------------------------- Unraid × alle underfaner */
await host(p, 'unraid');
X = await p.evaluate(() => ({ subs: __A('.subs .sb').map(__t), chip: __t(__R('.hero .chip')), big: __t(__R('.hero .big')), svs: __A('.hero .sv').map(__t), prose: __t(__R('.prose')) }));
ok('Unraid: underfaner Array · Gjester, CPU 31 % · Minne 61 % · CPU-temp 64°, «Alt OK»', X.subs.join() === 'Array,Gjester' && X.chip === 'Alt OK' && X.big === '31' && X.svs.join('|') === '61%|64°', X);
ok('Unraid-prosa: «Arrayet er [startet] og lagringen er [78 % full].»', X.prose === 'Arrayet er startet og lagringen er 78 % full.', X.prose);
X = await p.evaluate(() => ({ sub: __t(__R('.arr .arh .col span')), btn: __t(__R('.arr .hold')), bta: __cs('.arr .hold', 'touchAction'), bays: __A('.arr .bay .bn b').map(__t), bayH: Math.round(__R('.arr .bb').getBoundingClientRect().height), par: __rgb(/(color\([^)]*\)|rgba?\([^)]*\))/.exec(getComputedStyle(__R('.arr .bb.par')).boxShadow)[1]), sl: __A('.arr .bb.sl').length, use: __t(__R('.arr .ut')), cols: getComputedStyle(__R('.arr .bays')).gridTemplateColumns.split(' ').length }));
ok('Array: «Startet · 18 TB · 1 i hvile», Stopp-knapp (touch-action none), skuffer P/1/2/3/C 72 px, paritet rosa, hvile-ikon', X.sub === 'Startet · 18 TB · 1 i hvile' && X.btn === 'Stopp' && X.bta === 'none' && X.bays.join() === 'P,1,2,3,C' && X.bayH === 72 && X.par === '242,133,201' && X.sl === 1 && X.cols === 6, X);
ok('Array: bruksstripe brukt/ledig', X.use === '14,2 TB brukt3,8 TB ledig', X);
await clearCalls(p);
const holdShort = await p.evaluate(async () => {
  const hb = __R('.arr .hold'), r = hb.getBoundingClientRect(), o = { bubbles: true, composed: true, clientX: r.left + 10, clientY: r.top + 10, pointerId: 7, pointerType: 'touch' };
  hb.dispatchEvent(new PointerEvent('pointerdown', o)); await new Promise((q) => setTimeout(q, 300));
  const mid = { lbl: __t(hb.querySelector('.hl')), w: parseFloat(hb.querySelector('.hf').style.width) };
  hb.dispatchEvent(new PointerEvent('pointerup', o)); await new Promise((q) => setTimeout(q, 200));
  return { mid, w: hb.querySelector('.hf').style.width };
});
const toast1 = await toasts(p);
ok('Array hold: «Hold…» + fyll under hold; slipp før 900 ms → ingen handling + «Hold inne for å bekrefte»', holdShort.mid.lbl === 'Hold…' && holdShort.mid.w > 10 && holdShort.mid.w < 60 && (await calls(p)).length === 0 && /Hold inne for å bekrefte/.test(toast1), { holdShort, toast1 });
const holdLong = await p.evaluate(async () => {
  const hb = __R('.arr .hold'), r = hb.getBoundingClientRect(), o = { bubbles: true, composed: true, clientX: r.left + 10, clientY: r.top + 10, pointerId: 8, pointerType: 'touch' };
  hb.dispatchEvent(new PointerEvent('pointerdown', o)); await new Promise((q) => setTimeout(q, 1100));
  hb.dispatchEvent(new PointerEvent('pointerup', o)); await new Promise((q) => setTimeout(q, 100));
  return true;
});
ok('Array hold 900 ms → stopper arrayet (switch.tower_array)', holdLong && (await calls(p)).some((c) => /^switch\.toggle:.*tower_array"/.test(c)), await calls(p));
await shot(p, 'unraid-array');
await sub(p, 'gjester');
X = await p.evaluate(() => ({ chips: __A('.gl .cp').map(__t), rows: __A('.gl .gr b').map(__t), tags: __A('.gl .gtag').map(__t), head: __A('.gl .ch > span').map(__t).join('|') }));
ok('Unraid Gjester: chips Alle · Docker · VM med antall, Sonarr med «Oppdatering»-tag', X.chips.join() === 'Alle5,Docker4,VM1' && X.head === 'Gjester|3 av 5 kjører' && X.tags[X.rows.indexOf('Sonarr')] === 'Oppdatering', X);
await click(p, '.gl .gr[data-v="ur-switch.tower_docker_plex"]');
X = await p.evaluate(() => { const w = __R('.gl .gw.open'); return { tg: [...w.querySelectorAll('.xgr b')].map(__t), acts: [...w.querySelectorAll('.xa .ab')].map(__t) }; });
ok('Docker utvidet: «Autostart», «Automatisk oppdatering», «Med i appdata-backup» + Start på nytt/Logg/Konsoll/Oppdater', X.tg.join() === 'Autostart,Automatisk oppdatering,Med i appdata-backup' && X.acts.join() === 'Start på nytt,Logg,Konsoll,Oppdater', X);
await shot(p, 'unraid-gjester-utvidet');
// array stoppet → brytere låst, toast «Start arrayet først»
await p.evaluate(async () => { const h = { ...window.__h, states: { ...window.__h.states, 'switch.tower_array': { ...window.__h.states['switch.tower_array'], state: 'off' }, 'sensor.tower_array_state': { ...window.__h.states['sensor.tower_array_state'], state: 'Stopped' } } }; window.__h = h; window.__c.hass = h; await new Promise((q) => setTimeout(q, 300)); });
await clearCalls(p);
await click(p, '.gl .gr[data-v="ur-switch.tower_docker_plex"] .tg');
X = await p.evaluate(() => ({ lock: __A('.gl .tg.lock').length, chip: __t(__R('.hero .chip')), sub: __t(__R('.gl .gsub')), dis: __A('.gl .gw.open .xgr .tg').every((x) => x.disabled) }));
const t2 = await toasts(p);
ok('array stoppet: Docker/VM-brytere låst, «Start arrayet først», ingen handling, chip «Array stoppet»', X.lock === 5 && /Start arrayet først/.test(t2) && (await calls(p)).length === 0 && X.chip === 'Array stoppet' && /arrayet er stoppet/.test(X.sub) && X.dis, { X, t2 });
await sub(p, 'array');
X = await p.evaluate(() => ({ sub: __t(__R('.arr .arh .col span')), btn: __t(__R('.arr .hold')), use: __t(__R('.arr .ut')) }));
ok('Array stoppet: «Stoppet · Docker og VM-er er av», Start-knapp, «Utilgjengelig»', X.sub === 'Stoppet · Docker og VM-er er av' && X.btn === 'Start' && X.use === 'Utilgjengelig', X);

/* ---------------------------------------------------------------- HA × alle underfaner */
await host(p, 'ha');
await wait(p, 300);
X = await p.evaluate(() => ({ subs: __A('.subs .sb').map(__t), chip: __t(__R('.hero .chip')), big: __t(__R('.hero .big')), svs: __A('.hero .sv').map(__t), prose: __t(__R('.prose')) }));
ok('HA: underfaner Tillegg · Oppdateringer · System; CPU · Minne · Disk; chip «4 oppdateringer»', X.subs.join() === 'Tillegg,Oppdateringer,System' && X.big === '9,0' && X.svs.join('|') === '44%|38%' && X.chip === '4 oppdateringer', X);
ok('HA-prosa: «Home Assistant har [4 oppdateringer] og [4 tillegg] kjører.»', X.prose === 'Home Assistant har 4 oppdateringer og 4 tillegg kjører.', X.prose);
X = await p.evaluate(() => ({ head: __A('.gl .ch > span').map(__t).join('|'), chips: __A('.gl .cp').map(__t), rows: __A('.gl .gr b').map(__t), tags: __A('.gl .gtag').map(__t), ph: __R('.gl .srch input').placeholder }));
ok('Tillegg: «4 av 5 kjører», chips Alle · Kjører · Stoppet, tag «Tillegg», søk «Søk i tillegg», stoppet sist', X.head === 'Tillegg|4 av 5 kjører' && X.chips.join() === 'Alle5,Kjører4,Stoppet1' && X.tags.every((t) => t === 'Tillegg') && X.ph === 'Søk i tillegg' && X.rows[X.rows.length - 1] === 'Studio Code Server', X);
await click(p, '.gl .cp[data-v="Stoppet"]');
ok('chip «Stoppet» filtrerer', (await p.evaluate(() => __A('.gl .gr b').map(__t).join())) === 'Studio Code Server');
await click(p, '.gl .cp[data-v="Alle"]');
await click(p, '.gl .gr[data-slug="a0d7b954_nodered"]', 600);
X = await p.evaluate(() => { const w = __R('.gl .gw.open'); return w && { stats: [...w.querySelectorAll('.xt')].map(__t), tg: [...w.querySelectorAll('.xgr')].map((r) => __t(r.querySelector('b')) + '=' + r.querySelector('.tg').classList.contains('on')), acts: [...w.querySelectorAll('.xa .ab')].map(__t) }; });
ok('Tillegg utvidet (Supervisor info/stats): CPU, RAM av GB, Versjon, Nett', X && /^3%CPU/.test(X.stats[0]) && /RAM av 4,1 GB/.test(X.stats[1]) && X.stats[4] === '19.0.1Versjon' && /12,4 \/ 3,1MBNett ned \/ opp/.test(X.stats[5]), X);
ok('Tillegg-brytere: Start ved oppstart · Watchdog · Automatisk oppdatering · Vis i sidepanel (fra Supervisor)', X.tg.join() === 'Start ved oppstart=true,Watchdog=true,Automatisk oppdatering=false,Vis i sidepanel=true', X);
ok('Tillegg-handlinger: Start på nytt · Logg · Åpne · Backup', X.acts.join() === 'Start på nytt,Logg,Åpne,Backup', X);
await clearCalls(p);
await click(p, '.gl .gw.open .xgr:nth-child(2) .tg', 400);
X = await p.evaluate(() => ({ ws: window.__calls.filter((c) => c[0] === 'ws' && c[1] === 'supervisor/api' && c[2].method === 'post').map((c) => c[2].endpoint + JSON.stringify(c[2].data)), on: __R('.gl .gw.open .xgr:nth-child(2) .tg').classList.contains('on'), open: !!__R('.gl .gw.open') }));
ok('Watchdog-bryter → Supervisor POST /addons/<slug>/options {watchdog:false}, raden forblir åpen', X.ws.join() === '/addons/a0d7b954_nodered/options{"watchdog":false}' && !X.on && X.open, X);
await clearCalls(p);
await click(p, '.gl .gr[data-slug="a0d7b954_vscode"] .tg');
ok('bryter på stoppet tillegg → hassio.addon_start {addon}', (await calls(p)).some((c) => c === 'hassio.addon_start:{"addon":"a0d7b954_vscode"}'), await calls(p));
await shot(p, 'ha-tillegg-utvidet');
await sub(p, 'oppdateringer');
X = await p.evaluate(() => ({ head: __A('.upd .ch > span').map(__t).join('|'), rows: __A('.upd .ur').map((r) => __t(r.querySelector('b')) + '|' + __t(r.querySelector('.col span')) + '|' + __t(r.querySelector('.ub'))), rowH: Math.round(__R('.upd .ur').getBoundingClientRect().height),
  go: getComputedStyle(__R('.upd .ub.go')).backgroundImage, done: __cs('.upd .ub.done', 'color') }));
ok('Oppdateringer: «4 tilgjengelig», rader 64 px «nåværende → ny» + rosa Installer, nyeste = «Oppdatert»', X.head === 'Oppdateringer|4 tilgjengelig' && X.rowH === 64 && X.rows.includes('Home Assistant Core|2026.9.3 → 2026.10.0|Installer') && X.rows.includes('Home Assistant Operating System|16.2 · nyeste|Oppdatert') && /gradient/.test(X.go) && X.done === 'rgb(151, 151, 151)', X);
await clearCalls(p);
await click(p, '.upd .ur[data-key="u-update.home_assistant_core_update"] .ub');
X = await p.evaluate(() => __t(__R('.upd .ur[data-key="u-update.home_assistant_core_update"] .ub')));
ok('Installer → update.install + «Installerer…»', X === 'Installerer…' && (await calls(p)).some((c) => c === 'update.install:{"entity_id":"update.home_assistant_core_update"}'), { X, c: await calls(p) });
await p.evaluate(async () => { const id = 'update.home_assistant_core_update', h = { ...window.__h, states: { ...window.__h.states, [id]: { ...window.__h.states[id], state: 'off', attributes: { ...window.__h.states[id].attributes, installed_version: '2026.10.0' } } } }; window.__h = h; window.__c.hass = h; await new Promise((q) => setTimeout(q, 300)); });
X = await p.evaluate(() => ({ b: __t(__R('.upd .ur[data-key="u-update.home_assistant_core_update"] .ub')), v: __t(__R('.upd .ur[data-key="u-update.home_assistant_core_update"] .col span')), chip: __t(__R('.hero .chip')) }));
ok('installert → «Oppdatert», «2026.10.0 · nyeste», chip «3 oppdateringer»', X.b === 'Oppdatert' && X.v === '2026.10.0 · nyeste' && X.chip === '3 oppdateringer', X);
await shot(p, 'ha-oppdateringer');
await sub(p, 'system');
X = await p.evaluate(() => ({ tiles: __A('.sys .syt').map((t) => __t(t.lastElementChild) + '=' + __t(t.firstElementChild)), cols: getComputedStyle(__R('.sys')).gridTemplateColumns.split(' ').length, tileBg: __cs('.sys .syt', 'backgroundColor'), acts: __A('.xa .ab').map(__t), hot: __A('.xa .ab.hot').map(__t) }));
ok('System: fliser Core, OS, Oppetid, Database, Entiteter, Integrasjoner (3 kolonner, #404040)', X.tiles.map((t) => t.split('=')[0]).join() === 'Core,OS,Oppetid,Database,Entiteter,Integrasjoner' && X.tiles[0] === 'Core=2026.10.0' && X.tiles[1] === 'OS=16.2' && /^Oppetid=14 d 6 t$/.test(X.tiles[2]) && X.tiles[3] === 'Database=–' && X.cols === 3 && X.tileBg === 'rgb(64, 64, 64)', X);
ok('System-knapper: Start HA på nytt (rød) · Sjekk config · Ta backup · Start vert på nytt (rød)', X.acts.join() === 'Start HA på nytt,Sjekk config,Ta backup,Start vert på nytt' && X.hot.join() === 'Start HA på nytt,Start vert på nytt', X);
await clearCalls(p);
await click(p, '.xa .ab[data-key="ha-rs"]');
X = { t: await p.evaluate(() => __t(__R('.xa .ab[data-key="ha-rs"]'))), c: await calls(p) };
ok('«Start HA på nytt»: første trykk krever bekreftelse (ingen handling)', X.t === 'Bekreft · trykk igjen' && X.c.length === 0, X);
await click(p, '.xa .ab[data-key="ha-rs"]');
await click(p, '.xa .ab[data-key="ha-cc"]');
X = await calls(p);
ok('bekreftet → homeassistant.restart; «Sjekk config» uten bekreftelse → homeassistant.check_config', X.some((c) => /^homeassistant\.restart/.test(c)) && X.some((c) => /^homeassistant\.check_config/.test(c)), X);
await shot(p, 'ha-system');
const hap = await p.evaluate(() => window.__haptics.length);
ok('haptic ved trykk', hap > 15, hap);
await p.close();

/* ================================================================ velger: kort, show_prose av, tab_height */
p = await page({ velger: 'kort', show_prose: false, start_tab: 'proxmox' });
X = await p.evaluate(() => {
  const cs = __A('.hcards .hc');
  return { n: cs.length, cols: getComputedStyle(__R('.hcards')).gridTemplateColumns.split(' ').length, names: cs.map((c) => __t(c.querySelector('b'))), subs: cs.map((c) => __t(c.querySelector('.hcb span'))), on: cs.findIndex((c) => c.classList.contains('on')),
    onSh: getComputedStyle(cs[1]).boxShadow, onBg: getComputedStyle(cs[1]).backgroundColor, ring: cs.every((c) => c.querySelectorAll('.ring svg circle').length === 2), dots: cs.map((c) => c.querySelector('.dot').className.replace('dot ', '')),
    trow: !!__R('.trow'), cog: !!__R('.hero .hcog[data-act="customize"]'), cogW: __R('.hero .hcog') && Math.round(__R('.hero .hcog').getBoundingClientRect().width), prose: !!__R('.prose'), kids: [...__R('.wrap').children].map((e) => e.className.split(' ')[0]) };
});
ok('velger: kort → 2 kolonner med ring + statusprikk + navn/undertekst', X.n === 4 && X.cols === 2 && X.names.join() === 'Nettverk,Proxmox,Unraid,HA' && X.ring && X.subs[0] === '38 Mbit ned' && X.subs[1] === 'CPU 23 %' && X.dots.join() === 'ok,ok,ok,warn', X);
ok('kort-velger: valgt = #404040 + rosa kant, tannhjul (44 px) i toppkortet, ingen fanelinje', X.on === 1 && /242, 133, 201/.test(X.onSh) && X.onBg === 'rgb(64, 64, 64)' && !X.trow && X.cog && X.cogW === 44, X);
ok('show_prose: false → ingen setning', !X.prose && X.kids.join() === 'hcards,hero,subs,pane', X);
await click(p, '.hcards .hc[data-v="unraid"]', 400);
ok('kort-velger: trykk bytter vert', (await p.evaluate(() => __t(__R('.hero .hn')))) === 'Unraid');
await shot(p, 'velger-kort');
await p.close();
p = await page({ tab_height: 56 });
X = await p.evaluate(() => ({ tb: Math.round(__R('.trow .tb').getBoundingClientRect().height), gear: Math.round(__R('.trow .gear').getBoundingClientRect().height) }));
ok('tab_height 56 → faner 56 px, tannhjul 64 px', X.tb === 56 && X.gear === 64, X);
await p.close();

/* ================================================================ LYS MODUS · alle verter × alle underfaner + utvidet rad */
p = await page({}, { light: true });
X = await p.evaluate(() => ({ mode: document.documentElement.getAttribute('data-ki-theme'), hero: __cs('.hero', 'backgroundColor'), track: __cs('.trow .tabs', 'backgroundColor'), onCol: __cs('.trow .tb.on', 'color'), pill: __cs('.prose .pp', 'backgroundColor') + '|' + __cs('.prose .pp', 'color'), prose: __cs('.prose', 'color'), chip: __rgb(__cs('.hero .chip', 'color')) }));
ok('lys modus: data-ki-theme=light, toppkort/spor hvite (--ki-surface), pille invers (#1c1c1c/#fafafa), aktiv fane --ki-on-accent', X.mode === 'light' && X.hero === 'rgb(255, 255, 255)' && X.track === 'rgb(255, 255, 255)' && X.pill === 'rgb(28, 28, 28)|rgb(250, 250, 250)' && X.onCol === 'rgb(42, 23, 32)' && X.prose === 'rgb(51, 51, 51)', X);
const lowAll = [], whiteAll = []; let nAll = 0;
const scan = async (tag) => { const r = await contrastScan(p); nAll += r.n; r.low.forEach((x) => lowAll.push(tag + ': ' + x)); r.white.forEach((x) => whiteAll.push(tag + ': ' + x)); };
for (const [hk, subsL] of [['net', ['internett', 'enheter', 'switch']], ['proxmox', ['gjester', 'lagring', 'backup']], ['unraid', ['array', 'gjester']], ['ha', ['tillegg', 'oppdateringer', 'system']]]) {
  await host(p, hk);
  for (const s of subsL) {
    await sub(p, s);
    if (s === 'enheter') await click(p, '.devs .dr[data-v="dev_ap2"]');
    if (s === 'switch') { await click(p, '.swg .swc[data-v="dev_usw2"]'); await click(p, '.pg .pt[data-v="1"]'); }
    if (s === 'gjester' || s === 'tillegg') await click(p, '.gl .gr', 600);
    await scan(`${hk}/${s}`);
    await shot(p, `lys-${hk}-${s}`);
  }
}
ok(`lys modus: all tekst (${nAll} elementer, alle verter × underfaner, utvidet rad, switch) har kontrast ≥ 4,5:1`, lowAll.length === 0 && nAll > 300, lowAll.slice(0, 12));
ok('lys modus: ingen hvit tekst på lys flate', whiteAll.length === 0, whiteAll.slice(0, 8));
await p.close();

/* ================================================================ mørk modus uendret (stikkprøver mot designet) */
p = await page();
await host(p, 'ha');
X = await p.evaluate(() => ({ mode: document.documentElement.getAttribute('data-ki-theme') || 'dark', row: __cs('.gl .gw', 'backgroundColor'), card: __cs('.gl', 'backgroundColor'), sub: __cs('.gl .gsub', 'color'), tag: __cs('.gl .gtag', 'backgroundColor') + '|' + __cs('.gl .gtag', 'color'), tgOff: __cs('.gl .tg:not(.on)', 'backgroundColor'), ic: __cs('.gl .gic:not(.on)', 'backgroundColor'), knob: getComputedStyle(__R('.gl .tg i')).backgroundColor }));
ok('mørk modus = designet: kort #3a3a3a, rad #404040, tag #2f2f2f/#c7c7c7, undertekst #afafaf, bryter av #545454, knott #fafafa', X.mode === 'dark' && X.card === 'rgb(58, 58, 58)' && X.row === 'rgb(64, 64, 64)' && X.tag === 'rgb(47, 47, 47)|rgb(199, 199, 199)' && X.sub === 'rgb(175, 175, 175)' && X.tgOff === 'rgb(84, 84, 84)' && X.ic === 'rgb(84, 84, 84)' && X.knob === 'rgb(250, 250, 250)', X);
await p.close();
} catch (e) { ok('kjøring uten unntak', false, e.stack); }
ok('ingen JS-feil', errs.length === 0, errs.slice(0, 5));
await b.close();
console.log(res.join('\n'));
console.log(fail.length ? `\n${fail.length} FEIL` : `\nAlle ${res.length} OK`);
process.exit(fail.length ? 1 : 0);
