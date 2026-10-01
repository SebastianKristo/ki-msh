// Fiks 26 · Tilpass-ark og velgere:
//   26.16 ark dekker navbaren (bakteppe over navbaren, navbar/mini/«Mer» uten pointer-events mens arket er åpent,
//         arket helt ned til bunnen, navbaren tilbake etter lukking) – mobil (bunn-navbar) og PC (rail)
//   26.9  popup-velgeren med 35 popups: gruppert Rom/Funksjoner/Andre, alle rader, scroller med hjul og touch,
//         valgt rad scrolles inn (scrollTop); inline-listen i msh-tap-picker og entitetsvelgeren scroller også
//   Ferdig = rosa pille øverst til høyre (felles editor, Tilpass kameraer, Tilpass kiosk-modus), ingen bunnlinje
//   Brytere er rosa (felles .sw, kiosk-arket)
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readdirSync, mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/fiks26ark-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const shots = process.env.SHOTS || '';
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
let fail = 0;
const ok = (m, c, d) => { console.log((c ? 'OK   ' : 'FEIL ') + m + (c || d === undefined ? '' : ' → ' + JSON.stringify(d).slice(0, 400))); if (!c) fail++; };
const PINK_RE = /242,\s*133,\s*201|rgb\(242 133 201/;

for (const [vpName, vp, touch] of [['mobil', { width: 390, height: 844 }, true], ['pc', { width: 1280, height: 900 }, false]]) {
  const p = await b.newPage({ viewport: vp, hasTouch: touch });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + resolve('test/harness.html'));
  for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
  await p.addScriptTag({ path: bundle });
  const cdp = await p.context().newCDPSession(p);
  // Touch-sveip via CDP-touchhendelser (synthesizeScrollGesture scroller ikke i headless) – loddrett dra oppover dy px
  const swipe = async (x, y0, dy) => {
    x = Math.round(x); y0 = Math.round(y0);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }] });
    for (let i = 1; i <= 12; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: Math.round(y0 - (dy * i) / 12) }] }); await p.waitForTimeout(16); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await p.waitForTimeout(250);
  };
  await p.evaluate(async () => {
    window.deepAll = (sel) => { const out = []; const walk = (root) => root.querySelectorAll('*').forEach((e) => { if (e.matches(sel)) out.push(e); if (e.shadowRoot) walk(e.shadowRoot); }); walk(document); return out; };
    window.deep = (sel) => window.deepAll(sel)[0] || null;
    const H = window.H = window.mockHass();
    await MSH.store.load(H);
    const c = document.createElement('msh-navbar-card'); c.setConfig({ type: 'custom:msh-navbar-card', card_id: 'ki-navbar' }); c.hass = H;
    document.getElementById('dash').appendChild(c);
    await new Promise((q) => setTimeout(q, 700));
  });

  /* ---------------- 26.16 · arket dekker navbaren */
  const cov = await p.evaluate(async () => {
    const wait = (ms) => new Promise((q) => setTimeout(q, ms));
    const nb = deep('msh-navbar-card'), nav = deep('nav.nb');
    const nr = nav.getBoundingClientRect(), portal = nav.getRootNode().host;
    const ui = nb.customize(); await wait(500);
    const host = ui.overlay.host, sh = ui.overlay.root.querySelector('.sh'), bg = ui.overlay.root.querySelector('.bg');
    const cx = nr.left + nr.width / 2, cy = nr.top + nr.height / 2;
    const hit = document.elementFromPoint(cx, cy);
    const inner = ui.overlay.root.elementFromPoint(cx, cy);
    const br = bg.getBoundingClientRect(), sr = sh.getBoundingClientRect();
    const out = {
      nav: { l: nr.left, t: nr.top, w: nr.width, h: nr.height },
      hitRoot: hit && hit.localName, hitInner: inner && (inner.className || inner.localName),
      bgCovers: br.left <= nr.left + 1 && br.right >= nr.right - 1 && br.top <= nr.top + 1 && br.bottom >= nr.bottom - 1,
      bgOpacity: getComputedStyle(bg).opacity, bgBack: getComputedStyle(bg).backgroundColor,
      sheetBottom: Math.round(sr.bottom), vh: innerHeight,
      navPE: getComputedStyle(nav).pointerEvents, dataSheet: portal.hasAttribute('data-sheet'), htmlSheet: document.documentElement.hasAttribute('data-ki-sheet'),
      zHost: getComputedStyle(host).zIndex, zRoot: getComputedStyle(document.querySelector('ki-overlay-root')).zIndex,
      padB: getComputedStyle(sh).paddingBottom,
    };
    // trykk på navbarens plass treffer ikke navbaren (det er bakteppet)
    let navClicked = false; const onC = () => { navClicked = true; }; nav.addEventListener('click', onC, true);
    ui.overlay.close(); await wait(350);
    out.after = { navPE: getComputedStyle(nav).pointerEvents, dataSheet: portal.hasAttribute('data-sheet'), htmlSheet: document.documentElement.hasAttribute('data-ki-sheet'), navRect: (() => { const r = nav.getBoundingClientRect(); return { l: r.left, t: r.top }; })() };
    nav.removeEventListener('click', onC, true);
    out.navClicked = navClicked;
    return out;
  });
  ok(`${vpName} 26.16 ki-overlay-root over navbaren (treff på navbarens plass = arkets lag)`, cov.hitRoot === 'ki-overlay-root' && /bg|sh|body|gz/.test(String(cov.hitInner)) || cov.hitRoot === 'ki-overlay-root', cov);
  ok(`${vpName} 26.16 bakteppet dekker navbaren (dimming over navbaren)`, cov.bgCovers && Number(cov.bgOpacity) > 0.9, cov);
  ok(`${vpName} 26.16 navbaren pointer-events: none mens arket er åpent`, cov.navPE === 'none' && cov.dataSheet && cov.htmlSheet, cov);
  ok(`${vpName} 26.16 arket går helt ned (bottom = dashbordflatens bunn), padding 16 + safe-area (28.8)`, Math.abs(cov.sheetBottom - cov.vh) <= 1 && cov.padB === '16px', cov);
  ok(`${vpName} 26.16 lag: ark-vert z 42 i ki-overlay-root (z 9000)`, cov.zHost === '42' && cov.zRoot === '9000', cov);
  ok(`${vpName} 26.16 lukking gir navbaren tilbake uten hopp`, cov.after.navPE !== 'none' && !cov.after.dataSheet && !cov.after.htmlSheet && Math.abs(cov.after.navRect.l - cov.nav.l) < 1 && Math.abs(cov.after.navRect.t - cov.nav.t) < 1, cov.after);

  // Ekte trykk (touch/mus) på navbarens plass mens arket er åpent → lukker arket (bakteppet), åpner ingen popup
  const pt = await p.evaluate(async () => { const nav = deep('nav.nb'), it = nav.querySelector('[data-act="go"]') || nav; const r = it.getBoundingClientRect(); window.__h0 = location.hash; window.__ui = deep('msh-navbar-card').customize(); await new Promise((q) => setTimeout(q, 700)); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  if (touch) await p.touchscreen.tap(pt.x, pt.y); else await p.mouse.click(pt.x, pt.y);
  await p.waitForTimeout(400);
  const tapRes = await p.evaluate(async () => { const r = { hash: location.hash, h0: window.__h0, closed: !!window.__ui.overlay.closed }; window.__ui.overlay.close(); await new Promise((q) => setTimeout(q, 300)); return r; });
  ok(`${vpName} 26.16 trykk på navbarens plass under arket åpner ingen popup (arket/bakteppet tar trykket)`, tapRes.hash === tapRes.h0, tapRes);

  /* ---------------- Ferdig-plassering og bryterfarge */
  const fer = await p.evaluate(async () => {
    const wait = (ms) => new Promise((q) => setTimeout(q, ms));
    const res = {};
    const pill = (btn, sh) => { if (!btn) return null; const r = btn.getBoundingClientRect(), s = sh.getBoundingClientRect(), cs = getComputedStyle(btn); return { txt: btn.textContent.trim(), top: Math.round(r.top - s.top), right: Math.round(s.right - r.right), h: Math.round(r.height), bg: cs.backgroundImage + ' ' + cs.backgroundColor, color: cs.color }; };
    // felles editor (Tilpass navbar)
    const ui = deep('msh-navbar-card').customize(); await wait(500);
    const E = ui.editor.shadowRoot, sh = ui.overlay.root.querySelector('.sh');
    res.common = pill(E.querySelector('.ttl [data-a="save"]'), sh);
    res.commonTitle = (() => { const t = E.querySelector('.ttl .tt'); const cs = getComputedStyle(t); return { fs: cs.fontSize, fw: cs.fontWeight, left: Math.round(t.getBoundingClientRect().left - sh.getBoundingClientRect().left) }; })();
    res.commonActions = !!E.querySelector('.actions');
    // bryter (felles .sw) – slå på en og mål fargen
    const sw = E.querySelector('.sw.on') || (() => { const x = E.querySelector('.sw'); if (x) { x.style.transition = 'none'; x.classList.add('on'); } return x; })();
    res.sw = sw ? getComputedStyle(sw).backgroundColor : null;
    // Ferdig følger med når arket scrolles (sticky header)
    sh.scrollTop = 600; await wait(80);
    res.commonScrolled = pill(E.querySelector('.ttl [data-a="save"]'), sh);
    ui.overlay.close(); await wait(300);
    // Tilpass kiosk-modus
    const ko = MSH.kioskSheet({ hass: window.H }); await wait(400);
    const ksh = ko.root.querySelector('.sh');
    res.kiosk = pill(ko.root.querySelector('.hd [data-a="close"]'), ksh);
    res.kioskTitle = ko.root.querySelector('.hd .t').textContent;
    res.kioskBottom = [...ko.root.querySelectorAll('button')].filter((x) => /Ferdig/.test(x.textContent)).length;
    res.kioskSec = [...ko.root.querySelectorAll('.h')].map((x) => { const cs = getComputedStyle(x); return x.textContent.trim().split('\n')[0] + '|' + cs.fontSize + '|' + cs.textTransform + '|' + cs.color; });
    res.kioskGrp = [...ko.root.querySelectorAll('.grp')].map((g) => { const cs = getComputedStyle(g); return cs.backgroundColor + '|' + cs.borderRadius; });
    res.kioskTopInGrp = !!ko.root.querySelector('.grp .top') && !!ko.root.querySelector('.grp .entf');
    res.kioskPre = getComputedStyle(ko.root.querySelector('pre')).whiteSpace;
    res.kioskCopy = !!ko.root.querySelector('.h [data-a="copy"]');
    const ktrk = ko.root.querySelector('.trk'); ktrk.style.transition = 'none'; ktrk.classList.add('on'); res.kioskSw = getComputedStyle(ktrk).backgroundColor;
    ko.close(); await wait(300);
    // Tilpass kameraer
    const cam = document.createElement('msh-kamera-card'); cam.setConfig({ type: 'custom:msh-kamera-card', card_id: 'f26cam' }); cam.hass = window.H; document.getElementById('dash').appendChild(cam); await wait(300);
    const cu = cam.customize(); await wait(500);
    if (cu && cu.editor) {
      const csh = cu.overlay.root.querySelector('.sh'), CE = cu.editor.shadowRoot;
      res.kamera = pill(CE.querySelector('.hd [data-a="done"]'), csh);
      res.kameraAct = !!CE.querySelector('.act');
      const s2 = CE.querySelector('.sw.on') || CE.querySelector('.sw'); if (s2) { s2.style.transition = 'none'; s2.classList.add('on'); res.kameraSw = getComputedStyle(s2).backgroundColor; }
      cu.overlay.close(); await wait(300);
    }
    cam.remove();
    return res;
  });
  const topRight = (x) => x && x.txt === 'Ferdig' && x.top < 80 && x.right < 40 && x.h === 40 && PINK_RE.test(x.bg);
  ok(`${vpName} Ferdig i felles editor: rosa pille øverst til høyre, ingen bunnlinje`, topRight(fer.common) && !fer.commonActions, fer.common);
  ok(`${vpName} Felles editor: tittel 22/600 til venstre`, fer.commonTitle.fs === '22px' && fer.commonTitle.fw === '600' && fer.commonTitle.left < 40, fer.commonTitle);
  ok(`${vpName} Ferdig forblir øverst når arket scrolles (sticky)`, fer.commonScrolled && fer.commonScrolled.top < 80, fer.commonScrolled);
  ok(`${vpName} Felles bryter (.sw) er rosa`, /242,\s*133,\s*201/.test(fer.sw || ''), fer.sw);
  ok(`${vpName} 26.17 Tilpass kiosk-modus: tittel + rosa Ferdig øverst, ingen Ferdig nederst`, topRight(fer.kiosk) && fer.kioskTitle === 'Tilpass kiosk-modus' && fer.kioskBottom === 1, fer);
  ok(`${vpName} 26.17 seksjonsoverskrifter 12 px versaler #7f7f7f (GRUPPER, ENHETER, YAML · KIOSK_MODE)`, fer.kioskSec.length === 3 && fer.kioskSec.every((s) => /\|12px\|uppercase\|rgb\(127, 127, 127\)/.test(s)) && /YAML/.test(fer.kioskSec[2]), fer.kioskSec);
  ok(`${vpName} 26.17 én #3a3a3a-flate (r24) per seksjon, status + entitet i samme flate`, fer.kioskGrp.length === 4 && fer.kioskGrp.every((g) => g === 'rgb(58, 58, 58)|24px') && fer.kioskTopInGrp, fer.kioskGrp);
  ok(`${vpName} 26.17 YAML: Kopier-pille ved overskriften, koden brytes (pre-wrap)`, fer.kioskCopy && fer.kioskPre === 'pre-wrap', fer.kioskPre);
  ok(`${vpName} 26.17 kiosk-bryteren er rosa`, /242,\s*133,\s*201/.test(fer.kioskSw || ''), fer.kioskSw);
  ok(`${vpName} Tilpass kameraer: rosa Ferdig øverst til høyre, ingen knapper nederst, rosa bryter`, topRight(fer.kamera) && !fer.kameraAct && /242,\s*133,\s*201/.test(fer.kameraSw || ''), { k: fer.kamera, act: fer.kameraAct, sw: fer.kameraSw });

  /* ---------------- 26.9 · popup-velgeren med 35 popups */
  const setup = await p.evaluate(async () => {
    const wait = (ms) => new Promise((q) => setTimeout(q, ms));
    const E = [];
    for (let i = 1; i <= 14; i++) E.push({ hash: '#rom' + i, name: 'Rom ' + i, icon: 'mdi:sofa', group: 'rom', source: 'auto' });
    for (let i = 1; i <= 14; i++) E.push({ hash: '#fn' + i, name: 'Funksjon ' + i, icon: 'mdi:apps', group: 'fn', source: 'auto' });
    for (let i = 1; i <= 7; i++) E.push({ hash: '#egen' + i, name: 'Egen ' + i, icon: 'mdi:star', group: 'egne', source: 'custom' });
    MSH.popupReport = { entries: E, collisions: [], invalid: [] };
    const P = MSH.popupPicker.open({ value: '#egen6', hass: window.H }); window.__pp = P;
    await wait(500);
    const R = P.sheet.root, sc = R.querySelector('.sc'), on = sc.querySelector('.pr.on');
    const r = sc.getBoundingClientRect(), ro = on.getBoundingClientRect();
    return {
      rows: sc.querySelectorAll('.pr').length, groups: [...sc.querySelectorAll('.lb')].map((x) => x.textContent),
      scrollable: sc.scrollHeight > sc.clientHeight + 50, sh: sc.scrollHeight, ch: sc.clientHeight,
      selTop: sc.scrollTop, selVisible: ro.top >= r.top - 1 && ro.bottom <= r.bottom + 1,
      css: (() => { const cs = getComputedStyle(sc); return { ta: cs.touchAction, oy: cs.overflowY, ob: cs.overscrollBehaviorY, mh: getComputedStyle(sc.parentNode).minHeight }; })(),
      box: { x: r.left + r.width / 2, y: r.top + r.height / 2 },
    };
  });
  ok(`${vpName} 26.9 popup-velger: alle 35 popups (ingen slice), gruppert Rom/Funksjoner/Andre`, setup.rows === 35 && setup.groups.join('|') === 'Rom|Funksjoner|Andre', setup);
  ok(`${vpName} 26.9 listen er scrollbar (flex:1, min-height:0, overflow-y:auto, touch-action pan-y)`, setup.scrollable && setup.css.oy === 'auto' && setup.css.ta === 'pan-y' && setup.css.ob === 'contain' && setup.css.mh === '0px', setup);
  ok(`${vpName} 26.9 valgt rad (#egen6) scrollet inn med scrollTop ved åpning`, setup.selTop > 0 && setup.selVisible, setup);
  // hjul (PC) og touch (mobil) – begge på begge viewporter
  const st = () => p.evaluate(() => window.__pp.sheet.root.querySelector('.sc').scrollTop);
  await p.evaluate(() => { const sc = window.__pp.sheet.root.querySelector('.sc'); sc.scrollTop = 0; window.__pv = 0; window.addEventListener('wheel', (e) => { if (e.defaultPrevented) window.__pv++; }, { passive: true }); });
  await p.mouse.move(setup.box.x, setup.box.y);
  await p.mouse.wheel(0, 400); await p.waitForTimeout(400);
  const w1 = await st();
  ok(`${vpName} 26.9 hjul/trackpad scroller listen`, w1 > 100, { w1 });
  await p.evaluate(() => { window.__pp.sheet.root.querySelector('.sc').scrollTop = 0; });
  if (touch) {
    await swipe(setup.box.x, setup.box.y + 120, 300);
    const t1 = await st(), shT = await p.evaluate(() => window.__pp.sheet.root.querySelector('.sh').scrollTop + scrollY);
    ok(`${vpName} 26.9 touch-sveip scroller listen – ikke arket/siden (ingen preventDefault)`, t1 > 100 && shT === 0, { t1, shT });
    // helt ned: siste rad kan nås
    for (let i = 0; i < 12; i++) await swipe(setup.box.x, setup.box.y + 150, 300);
    await p.waitForTimeout(400);
    const last = await p.evaluate(() => { const sc = window.__pp.sheet.root.querySelector('.sc'), rows = sc.querySelectorAll('.pr'), l = rows[rows.length - 1].getBoundingClientRect(), r = sc.getBoundingClientRect(); return { vis: l.bottom <= r.bottom + 1 && l.top >= r.top - 1, name: rows[rows.length - 1].textContent }; });
    ok(`${vpName} 26.9 siste popup nås ved å scrolle (touch)`, last.vis, last);
  }
  // søk filtrerer i samme liste
  const q = await p.evaluate(async () => { const R = window.__pp.sheet.root, i = R.querySelector('.q'); i.value = 'egen'; i.dispatchEvent(new Event('input')); await new Promise((r) => setTimeout(r, 50)); const n = R.querySelectorAll('.sc .pr').length; window.__pp.close(); await new Promise((r) => setTimeout(r, 300)); return n; });
  ok(`${vpName} 26.9 søk filtrerer i samme liste`, q === 7, q);

  // inline-listen i msh-tap-picker (uten ark) og entitetsvelgeren
  const inl = await p.evaluate(async () => {
    const wait = (ms) => new Promise((q) => setTimeout(q, ms));
    const res = {};
    const pp = MSH.popupPicker; MSH.popupPicker = null; // tvinger inline-listen
    const tp = document.createElement('msh-tap-picker'); tp.setAttribute('modes', 'popup,hash'); tp.hass = window.H; document.getElementById('dash').appendChild(tp); await wait(50);
    tp._open = true; tp._mode = 'popup'; tp._render(); await wait(50);
    const pls = tp.shadowRoot.querySelector('.pls');
    res.tap = pls ? { rows: pls.querySelectorAll('.pr').length, scroll: pls.scrollHeight > pls.clientHeight, ta: getComputedStyle(pls).touchAction, groups: [...pls.querySelectorAll('.gl')].map((x) => x.textContent) } : null;
    if (pls) { const r = pls.getBoundingClientRect(); res.tapBox = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
    window.__pls = pls;
    MSH.popupPicker = pp;
    // entitetsvelger med mange lys
    const st2 = { ...window.H.states }; // nytt states-objekt (søkeindeksen caches per states-objekt)
    for (let i = 1; i <= 40; i++) { const id = `light.f26_lampe_${i}`; st2[id] = { entity_id: id, state: 'off', attributes: { friendly_name: 'Lampe ' + i } }; }
    window.H = { ...window.H, states: st2 };
    const ep = document.createElement('msh-entity-picker'); ep.setAttribute('domains', 'light'); ep.setAttribute('value', 'light.f26_lampe_35'); ep.hass = window.H; document.getElementById('dash').appendChild(ep); await wait(50);
    ep.open(); await wait(150);
    const L = ep.shadowRoot.querySelector('.pls'), on = L.querySelector('.pr.on');
    res.ent = { scroll: L.scrollHeight > L.clientHeight, top: L.scrollTop, vis: on && on.getBoundingClientRect().top >= L.getBoundingClientRect().top - 1 && on.getBoundingClientRect().bottom <= L.getBoundingClientRect().bottom + 1 };
    const r2 = L.getBoundingClientRect(); res.entBox = { x: r2.left + r2.width / 2, y: r2.top + r2.height / 2 }; window.__epl = L; L.scrollTop = 0;
    return res;
  });
  ok(`${vpName} 26.9 msh-tap-picker inline-liste: alle 35, gruppert, pan-y`, inl.tap && inl.tap.rows === 35 && inl.tap.scroll && inl.tap.ta === 'pan-y' && inl.tap.groups.join('|') === 'Rom|Funksjoner|Andre', inl.tap);
  ok(`${vpName} 26.9 entitetsvelger: valgt rad scrollet inn ved åpning`, inl.ent.scroll && inl.ent.top > 0 && inl.ent.vis, inl.ent);
  await p.evaluate(() => { window.__pls.scrollTop = 0; });
  await p.mouse.move(inl.tapBox.x, inl.tapBox.y); await p.mouse.wheel(0, 300); await p.waitForTimeout(300);
  await p.mouse.move(inl.entBox.x, inl.entBox.y); await p.mouse.wheel(0, 300); await p.waitForTimeout(300);
  const wl = await p.evaluate(() => ({ tap: window.__pls.scrollTop, ent: window.__epl.scrollTop }));
  ok(`${vpName} 26.9 hjul scroller inline popup-liste og entitetsliste`, wl.tap > 50 && wl.ent > 50, wl);

  /* ---------------- ikonvelger scroller */
  const ic = await p.evaluate(async () => {
    const S = MSH.iconPicker && MSH.iconPicker.open ? MSH.iconPicker.open({ value: 'mdi:sofa', hass: window.H }) : null;
    await new Promise((r) => setTimeout(r, 600));
    const sh = S && (S.sheet || S); const root = sh && sh.root; const sc = root && root.querySelector('.sc');
    if (!sc) return null;
    const r = sc.getBoundingClientRect(); window.__isc = sc; window.__ipk = S;
    return { scroll: sc.scrollHeight > sc.clientHeight, ta: getComputedStyle(sc).touchAction, box: { x: r.left + r.width / 2, y: r.top + r.height / 2 } };
  });
  if (ic) {
    await p.mouse.move(ic.box.x, ic.box.y); await p.mouse.wheel(0, 300); await p.waitForTimeout(300);
    const iw = await p.evaluate(() => window.__isc.scrollTop);
    ok(`${vpName} 26.9 ikonvelger: listen scroller med hjul, pan-y`, ic.scroll && ic.ta === 'pan-y' && iw > 50, { ...ic, iw });
    await p.evaluate(() => { const S = window.__ipk; (S.close || (S.sheet && S.sheet.close) || (() => {}))(); });
  } else ok(`${vpName} 26.9 ikonvelger åpnes`, false, ic);

  if (shots) await p.screenshot({ path: `${shots}/fiks26-ark-${vpName}.png` });
  ok(`${vpName} ingen sidefeil`, !errs.length, errs);
  await p.close();
}
await b.close();
console.log(fail ? `\n${fail} feil` : '\nAlt OK');
process.exit(fail ? 1 : 0);
