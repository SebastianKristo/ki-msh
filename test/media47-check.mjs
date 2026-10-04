// Fiks 47 G · Media (#media) mot ekte Bubble Card, mobil 390 px med TOUCH (CDP), mørk og lys modus.
//  · «Tilpass media»-arket (Media v4 cfgOpen): felles Tilpass-størrelse (top 52 / maks 440 / radius 38, håndtak 40×5),
//    tittel 24/600, «Nullstill» (#3a3a3a) + rosa «Ferdig», ikonfaner Faner · TV · Musikk (aktiv viser navnet)
//  · Faner: forhåndsvisning (live, på --ki-bg) + kort med segmentene Fanestil (5) · Faner viser (4) · Startfane (3: TV · Musikk · Sist brukte), haptic
//  · alle 5 fanestiler i kortets fanelinje (beregnede stiler) + 4 visninger + startfane (start_tab + tabs.start)
//  · TV/Musikk: «Rekkefølge» først, så spillerne; Nullstill gjelder bare aktiv fane
//  · GUI-editoren (getConfigElement) har samme faner/segmenter og lagrer samme nøkler (tabs.style/mode/start, start_tab)
//  · lys modus: kontrast ≥ 4,5:1 for fanetekst i alle stiler og segmentene i arket
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readdirSync, existsSync, mkdirSync, rmSync } from 'node:fs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const BC = resolve('test/.vendor/bubble-card.js');
mkdirSync(resolve('test/.vendor'), { recursive: true });
if (!existsSync(BC)) execFileSync('curl', ['-sSL', '-o', BC, 'https://raw.githubusercontent.com/Clooos/Bubble-Card/main/dist/bubble-card.js']);
mkdirSync(resolve('test/.build'), { recursive: true });
const bundle = process.env.MEDIA47_BUNDLE || resolve(`test/.build/media47-${process.pid}.js`);
if (!process.env.MEDIA47_BUNDLE) execFileSync('node', ['build.mjs', bundle]);
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const p = await ctx.newPage();
const cdp = await ctx.newCDPSession(p);
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto('file://' + resolve('test/harness-bubble.html'));
for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
await p.addScriptTag({ path: bundle });
await p.addScriptTag({ path: BC, type: 'module' });
await p.waitForFunction(() => customElements.get('bubble-card'));
await p.evaluate(async () => {
  const wait = (ms) => new Promise((q) => setTimeout(q, ms));
  const H = window.mockHass();
  H.themes = { ...(H.themes || {}), darkMode: true };
  window.__hass = H;
  window.__hap = [];
  window.addEventListener('haptic', (e) => window.__hap.push(e.detail));
  const bc = document.createElement('bubble-card');
  bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash: '#media', name: 'Media', bg_color: '#282828', bg_opacity: 100, bg_blur: 0, cards: [{ type: 'custom:msh-media-card', card_id: 'm47', toasts: false }] });
  bc.hass = H; document.getElementById('dash').appendChild(bc);
  await wait(400);
  location.hash = '#media'; await wait(1500);
  const all = () => { const o = []; const w = (r) => r.querySelectorAll('*').forEach((e) => { o.push(e); if (e.shadowRoot) w(e.shadowRoot); }); w(document); return o; };
  window.__all = all;
  window.__M = () => all().find((e) => e.localName === 'msh-media-card' && e.getBoundingClientRect().height > 0) || all().find((e) => e.localName === 'msh-media-card');
  window.__pt = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; };
  window.__theme = async (light) => {
    window.__hass = { ...window.__hass, themes: { ...(window.__hass.themes || {}), darkMode: !light } };
    all().filter((e) => e.localName === 'bubble-card' || /^msh-/.test(e.localName)).forEach((e) => { try { e.hass = window.__hass; } catch (x) { /* */ } });
    window.MSH.theme.set(light ? 'light' : 'dark');
    await wait(500);
  };
  window.__portal = () => window.MSH.portals().filter((x) => x.dataset.tpSheet === '1').pop();
  window.__ed = () => { const pp = window.__portal(); return pp && pp.shadowRoot.querySelector('msh-editor'); };
  window.__cs = (el) => getComputedStyle(el);
});

const res = {};
const ok = (name, cond, info) => { res[name] = cond ? 'OK' : { FEIL: info }; };
const wait = (ms) => new Promise((q) => setTimeout(q, ms));
async function tap(x, y) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
  await wait(60);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await wait(450);
}
const SHOT = process.env.SHOT_DIR; if (SHOT) mkdirSync(SHOT, { recursive: true });
const shot = async (n) => { if (SHOT) await p.screenshot({ path: resolve(SHOT, n + '.png') }); };
const pt = (sel) => p.evaluate((sel) => { const el = window.__M().shadowRoot.querySelector(sel); return el ? window.__pt(el) : null; }, sel);

// ---------- 1 · arket åpnes fra tannhjulet (touch), felles størrelse, header, ikonfaner
let P0 = await pt('.gear[data-act="customize"]');
await p.evaluate(() => { window.__hap.length = 0; });
await tap(P0.x, P0.y);
await wait(500);
const S1 = await p.evaluate(() => {
  const pp = window.__portal(), R = pp && pp.shadowRoot, sh = R && R.querySelector('.sh.tp'), dash = document.getElementById('dash').getBoundingClientRect();
  const E = window.__ed(), ER = E && E.shadowRoot, cs = window.__cs;
  if (!sh || !ER) return { open: false };
  const r = sh.getBoundingClientRect(), g = R.querySelector('.grab').getBoundingClientRect();
  const tt = ER.querySelector('.ttl .tt'), rs = ER.querySelector('.ttl .hb.rs'), dn = ER.querySelector('.ttl .done');
  const bar = ER.querySelector('.mmt'), btns = [...bar.querySelectorAll('.itab')];
  const lbl = (bt) => { const l = bt.querySelector('.itl'); return { t: bt.title, sel: bt.getAttribute('aria-selected'), op: +cs(l).opacity, w: Math.round(l.getBoundingClientRect().width), ic: !!bt.querySelector('ha-icon'), bg: cs(bt).backgroundImage, fg: cs(bt).color }; };
  return {
    open: true, top: Math.round(r.top - dash.top), w: Math.round(r.width), dashW: Math.round(dash.width), rad: cs(sh).borderTopLeftRadius, h: Math.round(r.height), dashH: Math.round(dash.height),
    grab: [Math.round(g.width), Math.round(g.height)],
    v2: tt.parentElement.classList.contains('v2'), title: tt.textContent.trim(), tfs: cs(tt).fontSize, tfw: cs(tt).fontWeight,
    reset: rs && rs.textContent.trim(), resetBg: rs && cs(rs).backgroundColor, done: dn && dn.textContent.trim(), doneBg: dn && cs(dn).backgroundImage, doneFg: dn && cs(dn).color,
    bar: { bg: cs(bar).backgroundColor, pad: cs(bar).paddingTop, rad: cs(bar).borderTopLeftRadius, tabs: btns.map(lbl) },
    hap: window.__hap.slice(),
  };
});
ok('arket åpnes fra tannhjulet (portalt Tilpass-ark)', S1.open, S1);
ok('arket: felles størrelse – top 52 mot dashbordflaten, maks 440 bred, radius 38, til bunnen, håndtak 40×5', S1.top === 52 && S1.w === Math.min(440, S1.dashW) && S1.rad === '38px' && Math.abs(S1.h - (S1.dashH - 52)) <= 2 && S1.grab.join() === '40,5', S1);
ok('header: «Tilpass media» 24/600 (felles _fitTitle krymper på smal skjerm), «Nullstill» #3a3a3a, «Ferdig» rosa gradient med mørk tekst', S1.title === 'Tilpass media' && S1.v2 && parseFloat(S1.tfs) <= 24 && parseFloat(S1.tfs) >= 16 && S1.tfw === '600' && S1.reset === 'Nullstill' && S1.resetBg === 'rgb(58, 58, 58)' && S1.done === 'Ferdig' && /linear-gradient/.test(S1.doneBg) && S1.doneFg !== 'rgb(255, 255, 255)', S1);
const T1 = S1.bar && S1.bar.tabs;
ok('ikonfaner Faner · TV · Musikk: #3a3a3a r24 pad 4, alle med ikon, bare aktiv (Faner) viser navnet', T1 && T1.map((t) => t.t).join() === 'Faner,TV,Musikk' && T1.every((t) => t.ic) && T1[0].sel === 'true' && T1[0].op === 1 && T1[0].w > 20 && T1.slice(1).every((t) => t.sel === 'false' && t.op === 0) && /linear-gradient/.test(T1[0].bg) && S1.bar.bg === 'rgb(58, 58, 58)' && S1.bar.pad === '4px' && S1.bar.rad === '24px', S1.bar);
ok('haptic: én ved trykk på tannhjulet', S1.hap.length === 1, S1.hap);

// ---------- 2 · Faner: forhåndsvisning + segmentkort
const S2 = await p.evaluate(() => {
  const ER = window.__ed().shadowRoot, cs = window.__cs, pv = ER.querySelector('.mtpv');
  const segs = [...ER.querySelectorAll('.mseg')].map((m) => ({ title: m.querySelector('span').textContent.trim(), bg: cs(m).backgroundColor, rad: cs(m).borderTopLeftRadius,
    opts: [...m.querySelectorAll('.mso')].map((o) => o.textContent.trim()), on: (m.querySelector('.mso.on') || {}).textContent, cols: cs(m.querySelector('[role=radiogroup]')).gridTemplateColumns.split(' ').length,
    boxBg: cs(m.querySelector('[role=radiogroup]')).backgroundColor, h: Math.round(m.querySelector('.mso').getBoundingClientRect().height) }));
  const order = [...ER.querySelectorAll('.wrap > *')].filter((x) => x.getBoundingClientRect().height > 0 && x.localName !== 'style' && !x.classList.contains('ttl')).map((x) => x.getAttribute('data-key') || x.className);
  return { pv: !!pv, pvBg: pv && cs(pv).backgroundColor, pvRow: pv && [...pv.querySelectorAll('.mtp-t')].map((x) => x.textContent.trim()), pvOn: pv && (pv.querySelector('.mtp-t.on') || {}).textContent, segs, order: order.slice(0, 7) };
});
await shot('47g-ark-faner');
ok('Faner: forhåndsvisning på --ki-bg (#232323) med TV · Musikk, TV aktiv', S2.pv && S2.pvBg === 'rgb(35, 35, 35)' && S2.pvRow.join() === 'TV,Musikk' && S2.pvOn === 'TV', S2);
ok('Faner: segmentkort Fanestil (5) · Faner viser (4) · Startfane (3), #3a3a3a r24, boks #2f2f2f, maks 3 kolonner, 40 px', S2.segs.length === 3
  && S2.segs[0].title === 'Fanestil' && S2.segs[0].opts.join() === 'Kontur,Fylt,Glass,Understrek,Chips' && S2.segs[0].on === 'Kontur' && S2.segs[0].cols === 3
  && S2.segs[1].title === 'Faner viser' && S2.segs[1].opts.join() === 'Tekst,Ikoner,Ikon + aktiv,Begge' && S2.segs[1].on === 'Tekst' && S2.segs[1].cols === 3
  && S2.segs[2].title === 'Startfane' && S2.segs[2].opts.join() === 'TV,Musikk,Sist brukte' && S2.segs[2].on === 'TV' && S2.segs[2].cols === 3
  && S2.segs.every((s) => s.bg === 'rgb(58, 58, 58)' && s.rad === '24px' && s.boxBg === 'rgb(47, 47, 47)' && s.h === 40), S2.segs);
ok('Faner: rekkefølgen i arket = ikonfaner → tekst → forhåndsvisning → segmentkort', S2.order[0] === 'mmt' && S2.order[1] === 'mtp-i' && S2.order[2] === 'mtp' && S2.order[3] === 'mseg-style', S2.order);

// ---------- 3 · alle fanestiler i kortets fanelinje (live utkast), haptic én per valg
const STY = {};
for (const st of ['kontur', 'fylt', 'glass', 'strek', 'chips']) {
  STY[st] = await p.evaluate(async (st) => {
    const ER = window.__ed().shadowRoot;
    window.__hap.length = 0;
    ER.querySelector(`.mso[data-g="style"][data-v="${st}"]`).click();
    await new Promise((q) => setTimeout(q, 350));
    const cs = window.__cs, R = window.__M().shadowRoot, seg = R.querySelector('.seg'), on = seg.querySelector('.tab.on'), off = seg.querySelector('.tab:not(.on)'), gear = R.querySelector('.gear'), tabs = R.querySelector('.tabs');
    const pick = (e) => { const c = cs(e); return { bg: c.backgroundColor, bgi: c.backgroundImage, fg: c.color, sh: c.boxShadow, h: Math.round(e.getBoundingClientRect().height), w: Math.round(e.getBoundingClientRect().width), rad: c.borderTopLeftRadius, fs: c.fontSize, grow: c.flexGrow, bf: c.backdropFilter || c.webkitBackdropFilter, pad: c.paddingTop, gap: c.columnGap, ox: c.overflowX }; };
    const pvSeg = ER.querySelector('.mtpv .seg');
    return { cls: seg.className, seg: pick(seg), on: pick(on), off: pick(off), gear: pick(gear), cols: cs(tabs).gridTemplateColumns.split(' ').length, ind: !!seg.querySelector('.ind'), segW: Math.round(seg.getBoundingClientRect().width), rowW: Math.round(tabs.getBoundingClientRect().width),
      draft: JSON.stringify(window.__ed()._config.tabs || null), pv: pvSeg && pvSeg.className, pvOnBg: pvSeg && cs(pvSeg.querySelector('.tab.on')).backgroundImage, hap: window.__hap.slice() };
  }, st);
  if (SHOT) { await p.evaluate(() => { const pp = window.__portal(); if (pp) pp.style.visibility = 'hidden'; }); await shot('47g-stil-' + st); await p.evaluate(() => { const pp = window.__portal(); if (pp) pp.style.visibility = ''; }); }
}
{
  const K = STY.kontur, F = STY.fylt, G = STY.glass, U = STY.strek, Ch = STY.chips;
  ok('Kontur: ring .14, rosa indikator, 38 px faner, sentrert (tre kolonner)', /ts-kontur/.test(K.cls) && K.ind && /rgba\(255, 255, 255, 0\.14\) 0px 0px 0px 1px inset/.test(K.seg.sh) && K.on.h === 38 && K.cols === 3 && K.on.fs === '13px', K);
  ok('Fylt: spor #3a3a3a r26 + inset .05, faner 44 px fyller bredden, aktiv rosa gradient med mørk tekst', /ts-fylt/.test(F.cls) && !F.ind && F.seg.bg === 'rgb(58, 58, 58)' && F.seg.rad === '26px' && /rgba\(255, 255, 255, 0\.05\)/.test(F.seg.sh) && F.on.h === 44 && F.on.grow === '1' && /linear-gradient/.test(F.on.bgi) && F.on.fg === 'rgb(58, 58, 58)' && F.off.fg === 'rgb(175, 175, 175)' && F.cols === 2 && F.segW > F.rowW - 60, F);
  ok('Glass: spor rgba(255,255,255,.06) + blur(20px) saturate(180%) + lys kant, aktiv hvit glass-gradient med hvit tekst og høylys, glass-tannhjul', /ts-glass/.test(G.cls) && G.seg.bg === 'rgba(255, 255, 255, 0.06)' && /blur\(20px\) saturate\(1\.8\)/.test(G.seg.bf) && /rgba\(255, 255, 255, 0\.16\) 0px 1px 0px 0px inset/.test(G.seg.sh)
    && /linear-gradient\(rgba\(255, 255, 255, 0\.3\), rgba\(255, 255, 255, 0\.1\)\)/.test(G.on.bgi) && G.on.fg === 'rgb(250, 250, 250)' && /rgba\(255, 255, 255, 0\.55\) 0px 1px 0px 0px inset/.test(G.on.sh) && G.off.fg === 'rgb(199, 199, 199)'
    && G.gear.bg === 'rgba(255, 255, 255, 0.08)' && /blur\(20px\)/.test(G.gear.bf), G);
  ok('Understrek: uten spor, faner fyller bredden 44 px, aktiv hvit + 3 px rosa strek, inaktiv #979797 + 1 px strek', /ts-strek/.test(U.cls) && U.seg.bg === 'rgba(0, 0, 0, 0)' && U.seg.sh === 'none' && U.seg.pad === '0px' && U.on.h === 44 && U.on.rad === '0px' && U.on.fs === '15px' && U.on.fg === 'rgb(250, 250, 250)' && /rgb\(242, 133, 201\) 0px -3px 0px 0px inset/.test(U.on.sh) && U.off.fg === 'rgb(151, 151, 151)' && /0px -1px 0px 0px inset/.test(U.off.sh) && U.on.bgi === 'none', U);
  ok('Chips: separate piller 40 px r20, gap 8, inaktiv #3a3a3a, aktiv rosa gradient, vannrett scroll', /ts-chips/.test(Ch.cls) && Ch.seg.gap === '8px' && Ch.seg.ox === 'auto' && Ch.seg.sh === 'none' && Ch.on.h === 40 && Ch.on.rad === '20px' && Ch.off.bg === 'rgb(58, 58, 58)' && Ch.off.fg === 'rgb(225, 225, 225)' && /linear-gradient/.test(Ch.on.bgi) && Ch.on.grow === '0', Ch);
  ok('forhåndsvisningen i arket følger fanestilen live', Object.entries(STY).every(([st, v]) => new RegExp('ts-' + st).test(v.pv || '')), Object.fromEntries(Object.entries(STY).map(([k, v]) => [k, v.pv])));
  ok('utkastet lagrer tabs.style', Object.entries(STY).every(([st, v]) => JSON.parse(v.draft || '{}').style === st), Object.fromEntries(Object.entries(STY).map(([k, v]) => [k, v.draft])));
  ok('haptic: nøyaktig én (selection) per valg av fanestil', Object.values(STY).every((v) => v.hap.length === 1 && v.hap[0] === 'selection'), Object.fromEntries(Object.entries(STY).map(([k, v]) => [k, v.hap])));
}

// ---------- 4 · «Faner viser» (i Fylt) – ikoner/tekst per fane
await p.evaluate(async () => { window.__ed().shadowRoot.querySelector('.mso[data-g="style"][data-v="fylt"]').click(); await new Promise((q) => setTimeout(q, 300)); });
const MD = {};
for (const md of ['tekst', 'ikon', 'aktiv', 'begge']) {
  MD[md] = await p.evaluate(async (md) => {
    window.__ed().shadowRoot.querySelector(`.mso[data-g="mode"][data-v="${md}"]`).click();
    await new Promise((q) => setTimeout(q, 350));
    const seg = window.__M().shadowRoot.querySelector('.seg');
    return [...seg.querySelectorAll('.tab')].map((t) => ({ t: t.dataset.t, on: t.classList.contains('on'), ic: !!t.querySelector('ha-icon'), lb: (t.querySelector('.tl') || {}).textContent || '', w: Math.round(t.getBoundingClientRect().width), lab: t.getAttribute('aria-label') }));
  }, md);
}
ok('Tekst: bare navn', MD.tekst.every((t) => !t.ic && t.lb), MD.tekst);
ok('Ikoner: bare ikon (aria-label beholder navnet)', MD.ikon.every((t) => t.ic && !t.lb && t.lab), MD.ikon);
ok('Ikon + aktiv: alle ikon, bare aktiv viser navnet og er bredere', MD.aktiv.every((t) => t.ic && (t.on ? !!t.lb : !t.lb)) && MD.aktiv.find((t) => t.on).w > MD.aktiv.find((t) => !t.on).w, MD.aktiv);
ok('Begge: ikon + navn på alle', MD.begge.every((t) => t.ic && t.lb), MD.begge);

// ---------- 5 · Startfane → start_tab + tabs.start, Ferdig lagrer, popupen åpner på startfanen
const S5 = await p.evaluate(async () => {
  const wait2 = (ms) => new Promise((q) => setTimeout(q, ms));
  const E = window.__ed(), ER = E.shadowRoot;
  ER.querySelector('.mso[data-g="start"][data-v="musikk"]').click(); await wait2(300);
  const o = { draft: { st: E._config.start_tab, tabs: E._config.tabs }, pvOn: (ER.querySelector('.mtpv .mtp-t.on') || {}).textContent, segOn: (ER.querySelector('.mso[data-g="start"].on') || {}).textContent };
  ER.querySelector('.ttl .done').click(); await wait2(1200);
  const c = window.__M();
  o.saved = { st: c.config.start_tab, tabs: c.config.tabs };
  o.closed = !window.__portal();
  location.hash = ''; await wait2(900);
  location.hash = '#media'; await wait2(1400);
  const R = window.__M().shadowRoot;
  o.openTab = (R.querySelector('.seg .tab.on') || {}).dataset;
  o.openTab = o.openTab && o.openTab.t;
  o.cls = R.querySelector('.seg').className;
  return o;
});
ok('Startfane: utkastet får start_tab = musikk og tabs.start = musikk, forhåndsvisningen viser Musikk aktiv', S5.draft.st === 'musikk' && S5.draft.tabs && S5.draft.tabs.start === 'musikk' && S5.pvOn === 'Musikk' && S5.segOn === 'Musikk', S5);
ok('Ferdig lagrer tabs: { style, mode, start } (+ start_tab) og lukker arket', S5.closed && S5.saved.st === 'musikk' && S5.saved.tabs && S5.saved.tabs.style === 'fylt' && S5.saved.tabs.mode === 'begge' && S5.saved.tabs.start === 'musikk', S5);
ok('popupen åpner på startfanen (Musikk) med lagret fanestil', S5.openTab === 'musikk' && /ts-fylt/.test(S5.cls), S5);

// ---------- 6 · trykk på fane i ny stil bytter fane (touch), én haptic
P0 = await pt('.seg .tab[data-t="tv"]');
await p.evaluate(() => { window.__hap.length = 0; });
await tap(P0.x, P0.y);
const S6 = await p.evaluate(() => ({ on: (window.__M().shadowRoot.querySelector('.seg .tab.on') || {}).dataset.t, hap: window.__hap.slice() }));
ok('Fylt: kort trykk på TV bytter fane, én haptic', S6.on === 'tv' && S6.hap.length === 1, S6);

// ---------- 6b · Startfane «Sist brukte» → start_tab 'last' (felles MSH.startTab): popupen åpner med fanen brukt sist
const S6b = await p.evaluate(async () => {
  const wait2 = (ms) => new Promise((q) => setTimeout(q, ms));
  window.__M().customize(); await wait2(600);
  const E = window.__ed(), ER = E.shadowRoot, o = {};
  const ft = ER.querySelector('.mmt [data-t="faner"]'); if (ft.getAttribute('aria-selected') !== 'true') { ft.click(); await wait2(250); }
  window.__hap.length = 0;
  ER.querySelector('.mso[data-g="start"][data-v="last"]').click(); await wait2(300);
  o.hap = window.__hap.slice();
  o.draft = { st: E._config.start_tab, tabs: E._config.tabs };
  o.segOn = (ER.querySelector('.mso[data-g="start"].on') || {}).textContent;
  o.pvOn = (ER.querySelector('.mtpv .mtp-t.on') || {}).textContent;
  ER.querySelector('.ttl .done').click(); await wait2(1200);
  o.saved = window.__M().config.start_tab;
  const reopen = async () => { location.hash = ''; await wait2(900); location.hash = '#media'; await wait2(1400); return (window.__M().shadowRoot.querySelector('.seg .tab.on') || {}).dataset.t; };
  window.__M().shadowRoot.querySelector('.seg .tab[data-t="musikk"]').click(); await wait2(400);
  o.r1 = await reopen();
  window.__M().shadowRoot.querySelector('.seg .tab[data-t="tv"]').click(); await wait2(400);
  o.r2 = await reopen();
  return o;
});
ok('Startfane «Sist brukte»: segmentet er rosa, utkastet får start_tab = last (+ tabs.start), én haptic', S6b.segOn === 'Sist brukte' && S6b.draft.st === 'last' && S6b.draft.tabs && S6b.draft.tabs.start === 'last' && S6b.hap.length === 1, S6b);
ok('Startfane «Sist brukte»: lagret, popupen åpner med fanen brukt sist (Musikk, så TV)', S6b.saved === 'last' && S6b.r1 === 'musikk' && S6b.r2 === 'tv', S6b);

// ---------- 7 · TV/Musikk-fanene i arket + Nullstill per fane
const S7 = await p.evaluate(async () => {
  const wait2 = (ms) => new Promise((q) => setTimeout(q, ms));
  window.__M().customize(); await wait2(600);
  const E = window.__ed(), ER = E.shadowRoot, o = {};
  o.startTab = (ER.querySelector('.mmt .itab[aria-selected="true"]') || {}).title; // husker sist valgte fane (Faner)
  const vis = () => [...ER.querySelectorAll('.wrap > *')].filter((x) => x.getBoundingClientRect().height > 0 && x.localName !== 'style' && !x.classList.contains('ttl')).map((x) => x.getAttribute('data-key') || x.getAttribute('data-focus') || x.className);
  ER.querySelector('.mmt [data-t="tv"]').click(); await wait2(250);
  o.tvSel = (ER.querySelector('.mmt .itab[aria-selected="true"]') || {}).title;
  o.tvVis = vis().slice(0, 3);
  o.tvRows = [...ER.querySelectorAll('[data-key^="mo-"]')].map((x) => x.dataset.key.slice(3));
  const mv = () => ER.querySelector('[data-key^="mo-"] [data-a="mv"][data-d="1"]');
  if (mv()) { mv().click(); await wait2(150); }
  const eye = ER.querySelector('[data-key^="mo-"] [data-a="sel"][data-name="hidden"]');
  if (eye) { eye.click(); await wait2(150); }
  ER.querySelector('.mmt [data-t="musikk"]').click(); await wait2(250);
  o.musVis = vis().slice(0, 3);
  o.musRows = [...ER.querySelectorAll('[data-key^="mo-"]')].map((x) => x.dataset.key.slice(3));
  if (mv()) { mv().click(); await wait2(150); }
  o.before = { order: JSON.parse(JSON.stringify(E._config.order || null)), hidden: JSON.parse(JSON.stringify(E._config.hidden || null)), tabs: E._config.tabs };
  // Nullstill i TV-fanen: bare TV
  ER.querySelector('.mmt [data-t="tv"]').click(); await wait2(250);
  window.__hap.length = 0;
  ER.querySelector('.ttl .hb.rs').click(); await wait2(250);
  o.hapReset = window.__hap.slice();
  o.afterTv = { order: JSON.parse(JSON.stringify(E._config.order || null)), hidden: JSON.parse(JSON.stringify(E._config.hidden || null)), tabs: E._config.tabs };
  // Nullstill i Faner: standard fanedesign
  ER.querySelector('.mmt [data-t="faner"]').click(); await wait2(250);
  ER.querySelector('.ttl .hb.rs').click(); await wait2(250);
  o.afterFaner = { tabs: E._config.tabs, st: E._config.start_tab, order: JSON.parse(JSON.stringify(E._config.order || null)), on: [...ER.querySelectorAll('.mso.on')].map((x) => x.textContent.trim()), pv: ER.querySelector('.mtpv .seg').className };
  o.liveCls = window.__M().shadowRoot.querySelector('.seg').className;
  return o;
});
ok('arket husker sist valgte fane (Faner) ved ny åpning', S7.startTab === 'Faner', S7);
ok('TV-fanen: «Rekkefølge» øverst, deretter spillerne', S7.tvSel === 'TV' && S7.tvVis[0] === 'mmt' && S7.tvVis[1] === 'mord-tv' && /^p_/.test(S7.tvVis[2] || ''), S7.tvVis);
ok('Musikk-fanen: «Rekkefølge» øverst, deretter spillerne', S7.musVis[0] === 'mmt' && S7.musVis[1] === 'mord-musikk' && /^p_/.test(S7.musVis[2] || ''), S7.musVis);
ok('Nullstill (TV) fjerner bare TV-rekkefølge og skjulte TV-er – Musikk og fanedesign urørt', S7.before.order && S7.before.order.tv && S7.before.order.musikk && S7.before.hidden
  && S7.afterTv.order && !S7.afterTv.order.tv && JSON.stringify(S7.afterTv.order.musikk) === JSON.stringify(S7.before.order.musikk) && !S7.afterTv.hidden && S7.afterTv.tabs && S7.afterTv.tabs.style === 'fylt', S7);
ok('Nullstill (Faner) gir standard fanedesign (Kontur · Tekst · første fane), rekkefølge urørt', !S7.afterFaner.tabs && !S7.afterFaner.st && S7.afterFaner.on.join() === 'Kontur,Tekst,TV' && /ts-kontur/.test(S7.afterFaner.pv) && /ts-kontur/.test(S7.liveCls) && S7.afterFaner.order && S7.afterFaner.order.musikk, S7.afterFaner);
ok('Nullstill: én haptic (medium)', S7.hapReset.length === 1 && S7.hapReset[0] === 'medium', S7.hapReset);
await p.evaluate(async () => { const pp = window.__portal(); if (pp) pp.shadowRoot.querySelector('.bg').click(); await new Promise((q) => setTimeout(q, 600)); });

// ---------- 8 · GUI-editoren (getConfigElement): samme faner/segmenter og nøkler
const S8 = await p.evaluate(async () => {
  const wait2 = (ms) => new Promise((q) => setTimeout(q, ms));
  const ed = window.__M().constructor.getConfigElement(); ed.hass = window.__hass;
  ed.setConfig({ type: 'custom:msh-media-card', card_id: 'gui47', tabs: { style: 'glass', mode: 'aktiv', start: 'musikk' }, start_tab: 'musikk' });
  document.body.appendChild(ed); await wait2(200);
  const R = ed.shadowRoot, out = { changes: [] };
  ed.addEventListener('config-changed', (e) => out.changes.push(e.detail.config));
  R.querySelector('.mmt [data-t="faner"]').click(); await wait2(150);
  out.tabs = [...R.querySelectorAll('.mmt .itab')].map((x) => x.title);
  out.on = [...R.querySelectorAll('.mso.on')].map((x) => x.textContent.trim());
  out.pv = R.querySelector('.mtpv .seg').className;
  out.reset = !!R.querySelector('[data-key="mreset"]');
  R.querySelector('.mso[data-g="style"][data-v="chips"]').click(); await wait2(100);
  R.querySelector('.mso[data-g="mode"][data-v="ikon"]').click(); await wait2(100);
  R.querySelector('.mso[data-g="start"][data-v="tv"]').click(); await wait2(100);
  out.last = out.changes[out.changes.length - 1];
  R.querySelector('.mso[data-g="start"][data-v="last"]').click(); await wait2(100);
  out.lastSt = (out.changes[out.changes.length - 1] || {}).start_tab;
  out.lastOn = (R.querySelector('.mso[data-g="start"].on') || {}).textContent;
  R.querySelector('[data-key="mreset"]').click(); await wait2(100);
  out.afterReset = out.changes[out.changes.length - 1];
  ed.remove();
  return out;
});
ok('GUI-editor: samme ikonfaner, segmentene viser config (Glass · Ikon + aktiv · Musikk), Nullstill-knapp', S8.tabs.join() === 'Faner,TV,Musikk' && S8.on.join() === 'Glass,Ikon + aktiv,Musikk' && /ts-glass/.test(S8.pv) && S8.reset, S8);
ok('GUI-editor: valg lagres i samme nøkler (tabs.style/mode/start + start_tab) via config-changed', S8.last && S8.last.tabs && S8.last.tabs.style === 'chips' && S8.last.tabs.mode === 'ikon' && S8.last.tabs.start === 'tv' && S8.last.start_tab === 'tv', S8.last);
ok('GUI-editor: «Sist brukte» → start_tab last', S8.lastSt === 'last' && S8.lastOn === 'Sist brukte', S8);
ok('GUI-editor: Nullstill (Faner) fjerner tabs/start_tab', S8.afterReset && !S8.afterReset.tabs && !S8.afterReset.start_tab, S8.afterReset);

// ---------- 9 · lys modus: kontrast i alle fanestiler + segmentene i arket
const LT = await p.evaluate(async () => {
  const wait2 = (ms) => new Promise((q) => setTimeout(q, ms));
  await window.__theme(true);
  if (location.hash !== '#media') { location.hash = '#media'; await wait2(1200); }
  const c = window.__M(), T = window.MSH.theme, cs = window.__cs, out = {};
  // effektiv bakgrunn bak et element: første ikke-transparente (uten gradient) oppover, ellers popupens
  const bgOf = (el) => { for (let n = el; n; n = n.parentElement || (n.getRootNode && n.getRootNode().host)) { const s = cs(n); if (s.backgroundImage && s.backgroundImage !== 'none' && /gradient/.test(s.backgroundImage)) return 'rgb(244 169 199)'; const bg = s.backgroundColor; const m = bg.match(/rgba?\(([^)]+)\)/); if (m) { const a = m[1].split(',').map(Number); if (a.length < 4 || a[3] > 0.5) return bg; } } return 'rgb(240, 240, 240)'; };
  for (const st of ['kontur', 'fylt', 'glass', 'strek', 'chips']) {
    c.setConfig({ ...c._rawConfig, tabs: { style: st, mode: 'begge' } }); await wait2(250);
    const seg = c.shadowRoot.querySelector('.seg'), on = seg.querySelector('.tab.on'), off = seg.querySelector('.tab:not(.on)');
    const onBg = st === 'kontur' ? 'rgb(244 169 199)' : bgOf(on);
    out[st] = { crOn: +T.contrast(cs(on).color, onBg).toFixed(2), crOff: +T.contrast(cs(off).color, bgOf(off)).toFixed(2), on: cs(on).color, off: cs(off).color, onBg, offBg: bgOf(off) };
  }
  c.customize(); await wait2(600);
  const ER = window.__ed().shadowRoot;
  ER.querySelector('.mmt [data-t="faner"]').click(); await wait2(200);
  const o1 = ER.querySelector('.mso:not(.on)'), o2 = ER.querySelector('.mso.on'), box = o1.parentElement, ttl = ER.querySelector('.mseg span'), card = ER.querySelector('.mseg'), pv = ER.querySelector('.mtpv');
  out.sheet = { crOff: +T.contrast(cs(o1).color, cs(box).backgroundColor).toFixed(2), crOn: +T.contrast(cs(o2).color, 'rgb(244 169 199)').toFixed(2), crTtl: +T.contrast(cs(ttl).color, cs(card).backgroundColor).toFixed(2), card: cs(card).backgroundColor, box: cs(box).backgroundColor, pv: cs(pv).backgroundColor };
  const pp = window.__portal(); if (pp) pp.shadowRoot.querySelector('.bg').click(); await wait2(500);
  await window.__theme(false);
  return out;
});
ok('lys modus: fanetekst ≥ 4,5:1 (aktiv og inaktiv) i alle fanestiler', ['kontur', 'fylt', 'glass', 'strek', 'chips'].every((s) => LT[s].crOn >= 4.5 && LT[s].crOff >= 4.5), LT);
ok('lys modus: arket – segmentkort #fff, boks --ki-surface-3, tekst ≥ 4,5:1, forhåndsvisning på --ki-bg', LT.sheet.card === 'rgb(255, 255, 255)' && LT.sheet.box === 'rgb(222, 222, 222)' && LT.sheet.pv === 'rgb(230, 230, 230)' && LT.sheet.crOff >= 4.5 && LT.sheet.crOn >= 4.5 && LT.sheet.crTtl >= 4.5, LT.sheet);

ok('ingen sidefeil', !errs.length, errs);
await b.close();
if (!process.env.MEDIA47_BUNDLE) try { rmSync(bundle); } catch (e) { /* */ }
console.log(JSON.stringify(res, null, 1));
const bad = Object.values(res).filter((v) => v !== 'OK').length;
console.log(bad ? `\n${bad} feilet` : '\nAlle bestod');
process.exit(bad ? 1 : 0);
