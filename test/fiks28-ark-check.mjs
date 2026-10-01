// Fiks 28.8–28.11 · felles ark, toast og mellomrom (agent A):
//   28.8  alle ark forankret i bunnen av dashbordflaten, dekker navbaren, bakteppet helt ned, bunnpadding 16 + safe-area
//   28.11 Tilpass-ark: toppkant 50 px, fast høyde calc(100% − 50px) (også ved fanebytte), popupens bredde på PC (åpen
//         Bubble-popup, ellers 540 px sentrert), full bredde på mobil, radius 28 28 0 0, #282828, håndtak 40×5 #545454,
//         fast header + fanelinje, inn-animasjon translateY(100%) → 0 280 ms, dra ned på håndtaket lukker
//         (Tilpass-menyen, Tilpass Hjem, Tilpass Innstillinger, Tilpass Tesla, Tilpass klima, Tilpass vær)
//   28.9  felles toast-pille: stil, plassering (over navbaren / 16 px over arkets bunnlinje), animasjon, erstatning,
//         varighet (1,8 s / feil 3 s), ikon (check / spinner / error rødt), toasts: false, ingen ha-toast/hass-notification
//   28.10 ki-spacing-editor (Rom v4 «Mellomrom»): rad-layout på 390 px (etikett på én linje, verdi til høyre, slider i full
//         bredde under, chips under), chips/slider virker (Fiks 11: bare vannrett drag), brukt i Innstillinger → Avansert,
//         Tilpass Tesla → Avansert og Tilpass klima
//   SHOTS=dir → skjermbilder (mellomrom side om side med design/Rom v4.dc.html lages av test/fiks28-ark-check.mjs --design)
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readdirSync, mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/fiks28ark-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const shots = process.env.SHOTS || '';
if (shots) mkdirSync(shots, { recursive: true });
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
let fail = 0;
const ok = (m, c, d) => { console.log((c ? 'OK   ' : 'FEIL ') + m + (c || d === undefined ? '' : ' → ' + JSON.stringify(d).slice(0, 600))); if (!c) fail++; };
const near = (a, b, t = 1.5) => Math.abs(a - b) <= t;

for (const [vn, vp, touch] of [['mobil', { width: 390, height: 844 }, true], ['pc', { width: 1280, height: 900 }, false]]) {
  const p = await b.newPage({ viewport: vp, hasTouch: touch });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + resolve('test/harness.html'));
  for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
  await p.addScriptTag({ path: bundle });
  const cdp = await p.context().newCDPSession(p);
  const W = (ms) => p.waitForTimeout(ms);
  await p.evaluate(async () => {
    window.deepAll = (sel) => { const out = []; const walk = (root) => root.querySelectorAll('*').forEach((e) => { if (e.matches(sel)) out.push(e); if (e.shadowRoot) walk(e.shadowRoot); }); walk(document); return out; };
    window.deep = (sel) => window.deepAll(sel)[0] || null;
    window.__notif = 0; window.addEventListener('hass-notification', () => { window.__notif++; });
    const H = window.H = window.mockHass();
    await MSH.store.load(H);
    const nb = document.createElement('msh-navbar-card'); nb.setConfig({ type: 'custom:msh-navbar-card', card_id: 'ki-navbar' }); nb.hass = H;
    document.getElementById('dash').appendChild(nb);
    await new Promise((q) => setTimeout(q, 800));
    // Bubble-popup (#settings) med Innstillinger + en «åpen popup»-ramme (som Bubble Card: .bubble-pop-up.is-popup-opened)
    const bc = document.createElement('bubble-card');
    bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash: '#settings' });
    bc.innerHTML = '<div class="pop bubble-pop-up is-popup-opened"><div class="hdr">Innstillinger</div><div class="inner"></div></div>';
    document.getElementById('dash').appendChild(bc);
    const c = document.createElement('msh-innstillinger-card'); c.setConfig({ type: 'custom:msh-innstillinger-card', card_id: 'pop-innstillinger', dashbord: false }); c.hass = H;
    bc.querySelector('.inner').appendChild(c);
    window.__inn = c; window.__bc = bc;
    await new Promise((q) => setTimeout(q, 300));
  });
  // PC: popupen er 600 px bred og sentrert i innholdsflaten (som width_desktop: 600px) – Tilpass-arket skal få samme rekt
  if (vn === 'pc') await p.evaluate(() => { const pop = window.__bc.querySelector('.pop'); Object.assign(pop.style, { left: 'auto', right: 'auto', width: '600px', marginLeft: 'calc(50% - 300px + 60px)', top: '50px' }); });

  /* ---------------- 28.8 / 28.11 · geometri for alle Tilpass-ark */
  // åpner arket, venter på inn-animasjonen og måler; returnerer også transform rett etter åpning (før rAF)
  const geo = async (name, openFn, popup) => {
    if (popup) await p.evaluate(() => { location.hash = '#settings'; }); else await p.evaluate(() => { if (location.hash) history.replaceState(null, '', location.pathname); window.__bc.toggleAttribute('hidden-pop', true); });
    await W(150);
    const r = await p.evaluate(async ({ src }) => {
      const wait = (ms) => new Promise((q) => setTimeout(q, ms));
      const n0 = MSH.portals().length;
      const ret = (0, eval)(src)();
      const P = MSH.portals(); const host = P[P.length - 1];
      if (!host || P.length === n0) return { err: 'ingen ark', ret: String(ret) };
      const sh = host.shadowRoot.querySelector('.sh');
      const t0 = getComputedStyle(sh).transform;
      await wait(700);
      const cs = getComputedStyle(sh), R = sh.getBoundingClientRect(), gz = sh.querySelector('.gz > .grab'), gr = gz && gz.getBoundingClientRect();
      const bg = host.shadowRoot.querySelector('.bg').getBoundingClientRect();
      const nav = deep('nav.nb'), nr = nav && nav.getBoundingClientRect();
      const hit = nr ? document.elementFromPoint(nr.left + nr.width / 2, nr.top + nr.height / 2) : null;
      const pop = document.querySelector('.bubble-pop-up.is-popup-opened'), pr = pop && pop.getClientRects().length ? pop.getBoundingClientRect() : null;
      const D = MSH.dashRect(), rx = MSH.railOn && MSH.railPad ? MSH.railPad() : 0;
      return {
        t0, top: Math.round(R.top), bottom: Math.round(R.bottom), h: Math.round(R.height), left: Math.round(R.left), w: Math.round(R.width), vh: innerHeight, vw: innerWidth,
        rad: cs.borderRadius, bg: cs.backgroundColor, pb: cs.paddingBottom, dur: cs.transitionDuration, ease: cs.transitionTimingFunction, tf: cs.transform,
        grab: gr ? { w: Math.round(gr.width), h: Math.round(gr.height), bg: getComputedStyle(gz).backgroundColor, top: Math.round(gr.top - R.top) } : null,
        bgCover: { top: Math.round(bg.top), bottom: Math.round(bg.bottom), left: Math.round(bg.left), w: Math.round(bg.width) },
        navHit: hit && hit.localName, navBottom: nr ? Math.round(nr.bottom) : null,
        pop: pr ? { l: Math.round(pr.left), w: Math.round(pr.width) } : null, dash: { l: Math.round(D.left), w: Math.round(D.width), rx },
      };
    }, { src: openFn.toString() });
    if (shots) await p.screenshot({ path: `${shots}/f28-${vn}-${name}.png` });
    return r;
  };
  const closeAll = async () => { await p.evaluate(async () => { MSH.portals().forEach((h) => { const sr = h.shadowRoot; const bg = sr && sr.querySelector('.bg'); if (bg) bg.click(); }); await new Promise((q) => setTimeout(q, 400)); }); };
  const expectW = (r) => {
    if (vn === 'mobil') return near(r.left, 0) && near(r.w, r.vw);
    if (r.pop) return near(r.left, r.pop.l) && near(r.w, r.pop.w);
    const cw = r.dash.w - r.dash.rx; return near(r.w, Math.min(540, cw)) && near(r.left, r.dash.l + r.dash.rx + (cw - r.w) / 2);
  };
  const SHEETS = [
    ['tilpass-meny', () => deep('msh-navbar-card')._tilpassSheet(), false],
    ['tilpass-hjem', () => window.dispatchEvent(new CustomEvent('ki-open-editor', { detail: { editor: 'home' } })), false],
    ['tilpass-navbar', () => deep('msh-navbar-card').customize(), false],
    ['tilpass-innstillinger', () => window.__inn.customize('spacing'), true],
    ['tilpass-tesla', () => { const t = document.createElement('msh-tesla-card'); t.setConfig({ type: 'custom:msh-tesla-card', card_id: 'f28tesla' }); t.hass = window.H; document.getElementById('dash').appendChild(t); return t.customize('spacing'); }, true],
    ['tilpass-klima', () => { const k = document.createElement('msh-klima-card'); k.setConfig({ type: 'custom:msh-klima-card', card_id: 'f28klima' }); k.hass = window.H; document.getElementById('dash').appendChild(k); window.__klima = k; return k.customize(); }, true],
    ['tilpass-vaer', () => { const v = document.createElement('msh-vaer-card'); v.setConfig({ type: 'custom:msh-vaer-card', card_id: 'f28vaer' }); v.hass = window.H; document.getElementById('dash').appendChild(v); return v.customize(); }, true],
  ];
  for (const [name, fn, popup] of SHEETS) {
    const r = await geo(name, fn, popup);
    if (r.err) { ok(`${vn} ${name}: arket åpnes`, false, r); await closeAll(); continue; }
    ok(`${vn} ${name}: toppkant 50 px, helt ned til bunnen, fast høyde calc(100% − 50px)`, r.top === 50 && near(r.bottom, r.vh) && near(r.h, r.vh - 50), r);
    ok(`${vn} ${name}: bredde = ${vn === 'mobil' ? 'full bredde' : r.pop ? 'popupens (600 px, samme venstrekant)' : '540 px sentrert i innholdsflaten'}`, expectW(r), { left: r.left, w: r.w, pop: r.pop, dash: r.dash });
    ok(`${vn} ${name}: radius 28 28 0 0, #282828, bunnpadding 16 px (+ safe-area)`, r.rad === '28px 28px 0px 0px' && r.bg === 'rgb(40, 40, 40)' && (r.pb === '16px' || r.pb === '0px'), { rad: r.rad, bg: r.bg, pb: r.pb });
    ok(`${vn} ${name}: håndtak 40×5 #545454 øverst`, r.grab && r.grab.w === 40 && r.grab.h === 5 && r.grab.bg === 'rgb(84, 84, 84)' && r.grab.top < 16, r.grab);
    ok(`${vn} ${name}: inn-animasjon translateY(100%) → 0 på 280 ms cubic-bezier(.2,.8,.2,1)`, /matrix\(1, 0, 0, 1, 0, (\d+)/.test(r.t0) && near(Number(r.t0.match(/, (\d+(\.\d+)?)\)$/)[1]), r.h, 2) && /0\.28s/.test(r.dur) && /cubic-bezier\(0\.2, 0\.8, 0\.2, 1\)/.test(r.ease) && (r.tf === 'none' || /matrix\(1, 0, 0, 1, 0, 0\)/.test(r.tf)), { t0: r.t0, dur: r.dur, ease: r.ease, tf: r.tf });
    ok(`${vn} ${name}: dekker navbaren (treff = ki-overlay-root), bakteppet helt ned`, r.navHit === 'ki-overlay-root' && r.bgCover.top === 0 && near(r.bgCover.bottom, r.vh), { hit: r.navHit, bg: r.bgCover });
    await closeAll();
  }
  ok(`${vn} ingen sidefeil`, errs.length === 0, errs);

  /* ---------------- 28.11 · fast høyde ved fanebytte, fast header + fanelinje, dra ned lukker */
  await p.evaluate(() => { location.hash = '#settings'; window.__bc.removeAttribute('hidden-pop'); });
  await W(150);
  const tabs = await p.evaluate(async () => {
    const wait = (ms) => new Promise((q) => setTimeout(q, ms));
    const ui = window.__inn.customize(); await wait(700);
    const sh = ui.overlay.root.querySelector('.sh'), E = ui.editor.shadowRoot;
    const hs = [];
    for (const t of [...E.querySelectorAll('.wrap>.chips.sg.tabs [data-a="tab"]')]) { t.click(); await wait(120); hs.push(Math.round(E.host.closest ? sh.getBoundingClientRect().height : 0)); }
    // scroll til bunnen: tittel og fanelinje står fast
    const tt = E.querySelector('.ttl'), tb = E.querySelector('.wrap>.chips.sg.tabs');
    const before = { tt: Math.round(tt.getBoundingClientRect().top), tb: tb && Math.round(tb.getBoundingClientRect().top) };
    [...E.querySelectorAll('.wrap>.chips.sg.tabs [data-a="tab"]')].pop().click(); await wait(150);
    sh.scrollTop = 99999; await wait(120);
    const after = { tt: Math.round(tt.getBoundingClientRect().top), tb: tb && Math.round(E.querySelector('.wrap>.chips.sg.tabs').getBoundingClientRect().top), scrolled: sh.scrollTop };
    const ttB = tt.getBoundingClientRect().bottom, tbR = E.querySelector('.wrap>.chips.sg.tabs').getBoundingClientRect();
    return { hs, before, after, gapOk: tbR.top >= ttB - 6, n: hs.length };
  });
  ok(`${vn} 28.11 samme arkhøyde i alle faner (Innstillinger)`, tabs.n >= 3 && tabs.hs.every((h) => h === tabs.hs[0]), tabs.hs);
  ok(`${vn} 28.11 header (tittel + Ferdig) og fanelinjen står fast når innholdet scroller`, tabs.after.scrolled > 50 && near(tabs.after.tt, tabs.before.tt, 2) && near(tabs.after.tb, tabs.before.tb, 2) && tabs.gapOk, tabs);
  // Tilpass Hjem: samme faste header + fanelinje
  const hj = await p.evaluate(async () => {
    const wait = (ms) => new Promise((q) => setTimeout(q, ms));
    window.dispatchEvent(new CustomEvent('ki-open-editor', { detail: { editor: 'home' } })); await wait(700);
    const P = MSH.portals(), sr = P[P.length - 1].shadowRoot, sh = sr.querySelector('.sh'), hd = sr.querySelector('.ed>.hd'), sg = sr.querySelector('.ed>.seg.itabs');
    const m = () => ({ hd: Math.round(hd.getBoundingClientRect().top), sg: Math.round(sg.getBoundingClientRect().top), hdB: Math.round(hd.getBoundingClientRect().bottom), h: Math.round(sh.getBoundingClientRect().height) });
    const before = m(); sh.scrollTop = 99999; await wait(150); const after = { ...m(), sc: sh.scrollTop };
    sg.querySelectorAll('[data-a="sec"]')[2].click(); await wait(250); after.h2 = Math.round(sh.getBoundingClientRect().height);
    sr.querySelector('.bg').click(); await wait(400);
    return { before, after };
  });
  ok(`${vn} 28.11 Tilpass Hjem: header + fanelinje står fast, samme høyde ved fanebytte`, hj.after.sc > 50 && near(hj.after.hd, hj.before.hd, 7) && hj.after.sg >= hj.after.hdB - 2 && hj.after.sg - hj.after.hdB < 20 && hj.after.h2 === hj.before.h, hj);
  // dra ned på håndtaket: kort drag fjærer tilbake, langt drag lukker
  const grabPt = async () => p.evaluate(() => { const P = MSH.portals(), sr = P[P.length - 1].shadowRoot, g = sr.querySelector('.gz').getBoundingClientRect(); return { x: Math.round(g.left + g.width / 2), y: Math.round(g.top + g.height / 2), n: P.length }; });
  const drag = async (pt, dy) => {
    if (touch) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pt.x, y: pt.y }] });
      for (let i = 1; i <= 10; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: pt.x, y: Math.round(pt.y + (dy * i) / 10) }] }); await W(24); }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else {
      await p.mouse.move(pt.x, pt.y); await p.mouse.down();
      for (let i = 1; i <= 10; i++) { await p.mouse.move(pt.x, Math.round(pt.y + (dy * i) / 10)); await W(24); }
      await p.mouse.up();
    }
    await W(450);
  };
  const g1 = await grabPt();
  await drag(g1, 30);
  const s1 = await p.evaluate(() => { const P = MSH.portals(), h = P[P.length - 1]; return { n: P.length, closed: !!h.classList.contains('tpout'), top: Math.round(h.shadowRoot.querySelector('.sh').getBoundingClientRect().top) }; });
  ok(`${vn} 28.11 kort drag på håndtaket (30 px) fjærer tilbake – arket står`, s1.n === g1.n && !s1.closed && s1.top === 50, s1);
  await drag(g1, 220);
  const s2 = await p.evaluate(() => ({ n: MSH.portals().length, hash: location.hash }));
  ok(`${vn} 28.11 dra ned på håndtaket (220 px) lukker arket, popupen står`, s2.n === g1.n - 1 && s2.hash === '#settings', s2);

  /* ---------------- 28.9 · toast */
  await closeAll();
  const T1 = await p.evaluate(async () => {
    const wait = (ms) => new Promise((q) => setTimeout(q, ms));
    const t = MSH.toast('Lagret');
    const op0 = getComputedStyle(t).opacity, tf0 = getComputedStyle(t).transform;
    await wait(300);
    const cs = getComputedStyle(t), r = t.getBoundingClientRect(), ic = t.querySelector('.msh-toast-ic');
    const D = MSH.dashRect(), rx = MSH.railOn && MSH.railPad ? MSH.railPad() : 0, nav = deep('nav.nb').getBoundingClientRect();
    return { op0, tf0, op: cs.opacity, h: Math.round(r.height), pad: cs.padding, rad: cs.borderRadius, bg: cs.backgroundColor, col: cs.color, fs: cs.fontSize, fw: cs.fontWeight, ff: cs.fontFamily, ws: cs.whiteSpace, sh: cs.boxShadow, gap: cs.gap, disp: cs.display, ai: cs.alignItems,
      trans: cs.transition, pe: cs.pointerEvents, z: cs.zIndex, ic: !!ic, icon: ic && ic.querySelector('ha-icon') && ic.querySelector('ha-icon').getAttribute('icon'), icW: ic && Math.round(ic.getBoundingClientRect().width),
      cx: Math.round(r.left + r.width / 2), expCx: Math.round(D.left + rx + (D.width - rx) / 2), bottomGap: Math.round(innerHeight - r.bottom), navTop: Math.round(nav.top), toastBottom: Math.round(r.bottom), txt: t.textContent, inRoot: t.getRootNode().host && t.getRootNode().host.localName };
  });
  ok(`${vn} 28.9 pille: 40 px, padding 0 16 0 12 (ikon), r20, #e1e1e1 / #232323, 13/500, nowrap, skygge 0 10 30 rgba(0,0,0,.4), flex gap 6`, T1.h === 40 && T1.pad === '0px 16px 0px 12px' && T1.rad === '20px' && T1.bg === 'rgb(225, 225, 225)' && T1.col === 'rgb(35, 35, 35)' && T1.fs === '13px' && T1.fw === '500' && /Space Grotesk/.test(T1.ff) && T1.ws === 'nowrap' && /rgba\(0, 0, 0, 0\.4\) 0px 10px 30px/.test(T1.sh) && T1.gap === '6px' && T1.disp === 'flex' && T1.ai === 'center', T1);
  ok(`${vn} 28.9 «Lagret» → check-ikon 18 px`, T1.ic && T1.icon === 'mdi:check' && T1.icW === 18, T1);
  ok(`${vn} 28.9 plassering: sentrert i dashbordflaten, bottom 110 px (over navbaren), i ki-overlay-root, z 60, pointer-events none`, near(T1.cx, T1.expCx, 2) && T1.bottomGap === 110 && (vn === 'pc' || T1.toastBottom <= T1.navTop) && T1.inRoot === 'ki-overlay-root' && T1.z === '60' && T1.pe === 'none', T1);
  ok(`${vn} 28.9 inn-animasjon: opacity 0→1 + translateY(8px) scale(.96) → 0/1 på 180 ms cubic-bezier(.2,.8,.2,1)`, T1.op0 === '0' && /matrix\(0\.96, 0, 0, 0\.96, [-\d.]+, 8\)/.test(T1.tf0) && T1.op === '1' && /0\.18s cubic-bezier\(0\.2, 0\.8, 0\.2, 1\)/.test(T1.trans), { op0: T1.op0, tf0: T1.tf0, op: T1.op, trans: T1.trans });
  const T2 = await p.evaluate(async () => {
    const wait = (ms) => new Promise((q) => setTimeout(q, ms));
    const root = MSH.overlayRoot();
    MSH.toastHide(); await wait(250);
    MSH.toast('Lagrer …'); await wait(60);
    const busy = { spin: !!root.querySelector('#msh-toast .msh-toast-spin'), n: root.querySelectorAll('#msh-toast').length };
    await wait(1000);
    const t = MSH.toast('Lagret'); // erstatter (ikke stablet), timeren starter på nytt
    const rep = { n: root.querySelectorAll('#msh-toast').length, txt: t.textContent, check: !!t.querySelector('ha-icon[icon="mdi:check"]') };
    await wait(1500); const mid = root.querySelector('#msh-toast'); rep.at1500 = mid ? getComputedStyle(mid).opacity : 'borte';
    await wait(600); rep.at2100 = root.querySelector('#msh-toast') ? getComputedStyle(root.querySelector('#msh-toast')).opacity : 'borte';
    const out = root.querySelector('#msh-toast'); rep.outTrans = out ? getComputedStyle(out).transition : '';
    await wait(200); rep.gone = !root.querySelector('#msh-toast');
    // feil: samme lyse pille, rødt error-ikon, 3 s
    const e = MSH.toast('Kunne ikke lagre – tidsavbrudd');
    const ecs = getComputedStyle(e), ei = e.querySelector('ha-icon');
    const err = { bg: ecs.backgroundColor, icon: ei && ei.getAttribute('icon'), icol: ei && getComputedStyle(ei).color };
    await wait(2500); err.at2500 = root.querySelector('#msh-toast') ? getComputedStyle(root.querySelector('#msh-toast')).opacity : 'borte';
    await wait(800); err.gone = !root.querySelector('#msh-toast');
    // toasts: false → ingen toast
    const none = MSH.toast('Lagret', { enabled: false });
    err.disabled = none === null && !root.querySelector('#msh-toast');
    err.haToast = deepAll('ha-toast, hass-notification').length; err.notif = window.__notif;
    // Klima (egen toast før 28.9) bruker nå den felles pillen
    MSH.klimaToast({ config: {} }, 'Boost i 1 time'); await wait(50);
    err.klima = { felles: !!root.querySelector('#msh-toast'), egen: !!root.querySelector('#msh-klima-toast'), txt: (root.querySelector('#msh-toast') || {}).textContent };
    MSH.toastHide(); await wait(250);
    return { busy, rep, err };
  });
  ok(`${vn} 28.9 «Lagrer …» → spinner`, T2.busy.spin && T2.busy.n === 1, T2.busy);
  ok(`${vn} 28.9 ny toast erstatter den gamle (én pille), timeren starter på nytt (synlig 1,5 s etter erstatning)`, T2.rep.n === 1 && T2.rep.txt === 'Lagret' && T2.rep.check && T2.rep.at1500 === '1', T2.rep);
  ok(`${vn} 28.9 vises 1,8 s, ut-animasjon 160 ms, så fjernet`, (T2.rep.at2100 === 'borte' || Number(T2.rep.at2100) < 1) && T2.rep.gone && (T2.rep.at2100 === 'borte' || /0\.16s/.test(T2.rep.outTrans)), T2.rep);
  ok(`${vn} 28.9 feil: samme lyse pille, rødt error-ikon, vises 3 s`, T2.err.bg === 'rgb(225, 225, 225)' && T2.err.icon === 'mdi:alert-circle' && T2.err.icol === 'rgb(242, 128, 115)' && T2.err.at2500 === '1' && T2.err.gone, T2.err);
  ok(`${vn} 28.9 toasts: false → ingen toast; aldri ha-toast/hass-notification`, T2.err.disabled && T2.err.haToast === 0 && T2.err.notif === 0, T2.err);
  ok(`${vn} 28.9 Klima-toasten bruker den felles pillen`, T2.err.klima.felles && !T2.err.klima.egen && T2.err.klima.txt === 'Boost i 1 time', T2.err.klima);
  // med åpent ark: 16 px over arkets bunnlinje, ikke oppå headeren
  const T3 = await p.evaluate(async () => {
    const wait = (ms) => new Promise((q) => setTimeout(q, ms));
    const ui = window.__inn.customize(); await wait(700);
    const t = MSH.toast('Lagret'); await wait(300);
    const r = t.getBoundingClientRect(), sh = ui.overlay.root.querySelector('.sh').getBoundingClientRect(), tt = ui.editor.shadowRoot.querySelector('.ttl').getBoundingClientRect();
    const out = { gap: Math.round(sh.bottom - r.bottom), cx: Math.round(r.left + r.width / 2), shCx: Math.round(sh.left + sh.width / 2), belowHeader: r.top > tt.bottom, anchor: t.dataset.anchor, z: getComputedStyle(t).zIndex };
    // Ferdig → «Lagret»-toasten kommer etter at arket lukkes, over navbaren
    MSH.toastHide(); await wait(250);
    const types = []; const mo = new MutationObserver(() => { const x = MSH.overlayRoot().querySelector('#msh-toast'); if (x && types[types.length - 1] !== x.dataset.type + ':' + x.textContent) types.push(x.dataset.type + ':' + x.textContent); });
    mo.observe(MSH.overlayRoot(), { childList: true, subtree: true });
    ui.editor._set('gap', 12);
    ui.editor.shadowRoot.querySelector('[data-a="save"]').click(); await wait(1200);
    mo.disconnect(); out.types = types;
    const t2 = MSH.overlayRoot().querySelector('#msh-toast');
    out.afterDone = t2 ? { txt: t2.textContent, anchor: t2.dataset.anchor, gap: Math.round(innerHeight - t2.getBoundingClientRect().bottom) } : null;
    MSH.toastHide(); await wait(250);
    return out;
  });
  ok(`${vn} 28.9 med åpent ark: 16 px over arkets bunnlinje, sentrert på arket, under headeren`, T3.gap === 16 && near(T3.cx, T3.shCx, 2) && T3.belowHeader && T3.anchor === 'sheet', T3);
  ok(`${vn} 28.9 Ferdig → «Lagrer …» (spinner) → «Lagret» (check) i samme pille`, T3.afterDone && /Lagret/.test(T3.afterDone.txt) && T3.types.some((x) => /^busy:Lagrer/.test(x)) && T3.types.some((x) => /^ok:Lagret/.test(x)), { after: T3.afterDone, types: T3.types });

  /* ---------------- 28.10 · mellomrom-rader */
  const SP = async (openSrc, label) => {
    const r = await p.evaluate(async ({ src }) => {
      const wait = (ms) => new Promise((q) => setTimeout(q, ms));
      (0, eval)(src)(); await wait(800);
      const P = MSH.portals(), host = P[P.length - 1];
      const ks = deepAll('ki-spacing-editor').filter((k) => { let n = k; while (n) { if (n === host) return true; n = n.getRootNode().host; } return false; })[0];
      if (!ks) return { err: 'ingen ki-spacing-editor' };
      ks.scrollIntoView({ block: 'center' }); await wait(200);
      const S = ks.shadowRoot, box = S.querySelector('.box'), bcs = getComputedStyle(box), br = box.getBoundingClientRect();
      const rows = [...S.querySelectorAll('.r')].map((row) => {
        const lt = row.querySelector('.lt'), v = row.querySelector('.v'), ic = row.querySelector('.l ha-icon'), inp = row.querySelector('input[type=range]'), ch = row.querySelector('.c');
        const L = lt.getBoundingClientRect(), V = v.getBoundingClientRect(), I = inp.getBoundingClientRect(), C = ch ? ch.getBoundingClientRect() : null, RR = row.getBoundingClientRect();
        const chips = ch ? [...ch.children] : [];
        const c0 = chips[0] && getComputedStyle(chips[0]), on = ch && ch.querySelector('.on');
        return {
          label: lt.textContent, lh: Math.round(L.height), ws: getComputedStyle(lt).whiteSpace, to: getComputedStyle(lt).textOverflow, lfs: getComputedStyle(lt).fontSize, lfw: getComputedStyle(lt).fontWeight,
          icon: ic && ic.getAttribute('icon'), icW: ic && Math.round(ic.getBoundingClientRect().width), icCol: ic && getComputedStyle(ic).color,
          val: v.textContent, vfs: getComputedStyle(v).fontSize, vcol: getComputedStyle(v).color, vnum: getComputedStyle(v).fontVariantNumeric, valRight: V.left >= L.right - 1 && Math.abs((V.top + V.bottom) / 2 - (L.top + L.bottom) / 2) < 6,
          slW: Math.round(I.width), rowW: Math.round(RR.width), slBelow: I.top >= L.bottom - 1, accent: getComputedStyle(inp).accentColor, step: inp.step,
          chBelow: C ? C.top >= I.bottom - 1 : null, chips: chips.map((x) => x.textContent), chH: c0 && Math.round(chips[0].getBoundingClientRect().height), chRad: c0 && c0.borderRadius, chFs: c0 && c0.fontSize, chPad: c0 && c0.padding, chWs: c0 && c0.whiteSpace,
          onBg: on && getComputedStyle(on).backgroundImage, onCol: on && getComputedStyle(on).color, offBg: chips.find((x) => !x.classList.contains('on')) && getComputedStyle(chips.find((x) => !x.classList.contains('on'))).backgroundColor,
          chipRowsOk: chips.every((x) => Math.round(x.getBoundingClientRect().height) === 30),
        };
      });
      return { box: { bg: bcs.backgroundColor, rad: bcs.borderRadius, pad: bcs.padding, gap: bcs.gap, dir: bcs.flexDirection, w: Math.round(br.width) }, rows };
    }, { src: openSrc.toString() });
    return r;
  };
  for (const [name, open] of [
    ['Innstillinger → Avansert', () => { location.hash = '#settings'; window.__inn.customize('spacing'); }],
    ['Tilpass Tesla → Avansert', () => { const t = document.querySelector('msh-tesla-card'); t.customize('spacing'); }],
    ['Tilpass klima', () => { window.__klima.customize(); }],
  ]) {
    const r = await SP(open);
    if (r.err) { ok(`${vn} 28.10 ${name}: ki-spacing-editor`, false, r); await closeAll(); continue; }
    if (shots) await p.screenshot({ path: `${shots}/f28-${vn}-mellomrom-${name.replace(/[^a-zA-Z]+/g, '-').toLowerCase()}.png` });
    ok(`${vn} 28.10 ${name}: flate #404040 r24, padding 14 16, kolonne gap 16`, r.box.bg === 'rgb(64, 64, 64)' && r.box.rad === '24px' && r.box.pad === '14px 16px' && r.box.gap === '16px' && r.box.dir === 'column', r.box);
    ok(`${vn} 28.10 ${name}: etikett på ÉN linje (nowrap + ellipsis, 14/500), ikon 20 #afafaf`, r.rows.length >= 2 && r.rows.every((x) => x.lh <= 20 && x.ws === 'nowrap' && x.to === 'ellipsis' && x.lfs === '14px' && x.lfw === '500' && x.icW === 20 && x.icCol === 'rgb(175, 175, 175)'), r.rows.map((x) => [x.label, x.lh, x.ws, x.icW]));
    ok(`${vn} 28.10 ${name}: «N px» til høyre på samme linje, 13 px #afafaf tabular-nums`, r.rows.every((x) => x.valRight && /^-?\d+ px$/.test(x.val) && x.vfs === '13px' && x.vcol === 'rgb(175, 175, 175)' && /tabular-nums/.test(x.vnum)), r.rows.map((x) => [x.val, x.valRight]));
    ok(`${vn} 28.10 ${name}: slider i full bredde UNDER etiketten, rosa aksent, step 2`, r.rows.every((x) => x.slBelow && x.slW >= x.rowW - 1 && /242, 133, 201/.test(x.accent) && x.step === '2'), r.rows.map((x) => [x.slW, x.rowW, x.accent, x.step]));
    ok(`${vn} 28.10 ${name}: chips UNDER slideren, 30 px, r15, 12 px, padding 0 12, nowrap; valgt rosa gradient / #3a3a3a, ellers #545454`, r.rows.every((x) => x.chBelow && x.chipRowsOk && x.chRad === '15px' && x.chFs === '12px' && x.chPad === '0px 12px' && x.chWs === 'nowrap' && (!x.onBg || /linear-gradient/.test(x.onBg)) && (!x.onCol || x.onCol === 'rgb(58, 58, 58)') && x.offBg === 'rgb(84, 84, 84)'), r.rows.map((x) => [x.chips, x.chH, x.onBg && x.onBg.slice(0, 30)]));
    await closeAll();
  }
  // interaksjon: chip og vannrett drag endrer verdien i utkastet; loddrett drag gjør det ikke (Fiks 11)
  await p.evaluate(() => { location.hash = '#settings'; });
  await W(150);
  const pos = await p.evaluate(async () => {
    const wait = (ms) => new Promise((q) => setTimeout(q, ms));
    const ui = window.__inn.customize('spacing'); await wait(800);
    window.__ui = ui;
    const ks = ui.editor.shadowRoot.querySelector('ki-spacing-editor'); ks.scrollIntoView({ block: 'center' }); await wait(200);
    const chip = [...ks.shadowRoot.querySelectorAll('.p')].find((x) => x.textContent === 'Tett 4'); chip.click(); await wait(100);
    const after = ui.editor._config.gap;
    const sl = ks.shadowRoot.querySelector('.ks[data-spn="pad_bottom"]').getBoundingClientRect();
    return { after, chipOn: chip.classList.contains('on'), val: ks.shadowRoot.querySelector('.r[data-spn="gap"] .v').textContent, x: Math.round(sl.left + sl.width * 0.3), y: Math.round(sl.top + sl.height / 2), pb0: ui.editor._config.pad_bottom };
  });
  ok(`${vn} 28.10 chip «Tett 4» → gap 4 i utkastet, chip valgt, «4 px»`, pos.after === 4 && pos.chipOn && pos.val === '4 px', pos);
  const dragSl = async (dx, dy) => {
    Object.assign(pos, await p.evaluate(() => { const ks = window.__ui.editor.shadowRoot.querySelector('ki-spacing-editor'); ks.scrollIntoView({ block: 'center' }); const sl = ks.shadowRoot.querySelector('.ks[data-spn="pad_bottom"]').getBoundingClientRect(); return { x: Math.round(sl.left + sl.width * 0.3), y: Math.round(sl.top + sl.height / 2) }; }));
    await W(100);
    if (touch) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pos.x, y: pos.y }] });
      for (let i = 1; i <= 10; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: Math.round(pos.x + (dx * i) / 10), y: Math.round(pos.y + (dy * i) / 10) }] }); await W(20); }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else {
      await p.mouse.move(pos.x, pos.y); await p.mouse.down();
      for (let i = 1; i <= 10; i++) { await p.mouse.move(Math.round(pos.x + (dx * i) / 10), Math.round(pos.y + (dy * i) / 10)); await W(20); }
      await p.mouse.up();
    }
    await W(200);
    return p.evaluate(() => window.__ui.editor._config.pad_bottom);
  };
  const vTap = await dragSl(0, 0);
  ok(`${vn} 28.10 trykk på sporet endrer ingenting`, (vTap == null ? 24 : vTap) === (pos.pb0 == null ? 24 : pos.pb0), { vTap, pb0: pos.pb0 });
  const vV = await dragSl(4, 60);
  ok(`${vn} 28.10 loddrett drag over slideren endrer ingenting (arket scroller)`, (vV == null ? 24 : vV) === (pos.pb0 == null ? 24 : pos.pb0), vV);
  const vH = await dragSl(80, 2);
  ok(`${vn} 28.10 vannrett drag endrer verdien (step 2, partall)`, vH != null && vH > (pos.pb0 || 24) && vH % 2 === 0, vH);
  await closeAll();
  ok(`${vn} ingen sidefeil til slutt`, errs.length === 0, errs);
  await p.close();
}

/* ---------------- side om side: mellomrom mot design/Rom v4.dc.html (bare med SHOTS og vendret React) */
if (shots && process.env.DESIGN_ROUTES) {
  const { designRoutes } = await import(process.env.DESIGN_ROUTES);
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  await designRoutes(p);
  await p.goto('file://' + resolve('design/Rom v4.dc.html')); await p.waitForTimeout(3000);
  // åpne «Tilpass Stue» (tannhjulet i toppkortet) og akkordeonen «Mellomrom»
  await p.evaluate(async () => {
    const wait = (ms) => new Promise((q) => setTimeout(q, ms));
    const g = [...document.querySelectorAll('.ms')].find((x) => x.textContent.trim() === 'settings'); (g.closest('button') || g).click(); await wait(500);
    const m = [...document.querySelectorAll('button')].find((x) => /Mellomrom/.test(x.textContent)); m.click(); await wait(500);
  });
  const box = await p.evaluate(() => { const r = document.querySelector('input[type=range]'); const bx = r.parentElement.parentElement.getBoundingClientRect(); return { y: Math.round(bx.top) }; });
  await p.screenshot({ path: `${shots}/f28-design-mellomrom.png`, clip: { x: 0, y: Math.max(0, box.y - 20), width: 390, height: 360 } });
  await p.close();
}
await b.close();
console.log(fail ? `\n${fail} FEIL` : '\nAlle fiks28-ark-sjekker OK');
process.exit(fail ? 1 : 0);
