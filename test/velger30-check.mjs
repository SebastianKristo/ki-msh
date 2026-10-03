// Fiks 30.2 + 30.3 · felles popup-velger-ark og ny handlingsvelger (fasit design/Handlingsvelger.dc.html – målene
// sammenlignes her, designfilen kan ikke rendres i testnettleseren).
//   30.2  «Tilpass navbar» → Ved trykk → Popup → «Bytt ›»: arket (topp 50, radius 38 38 0 0, #282828, flex-kolonne),
//         scrollområdet er en vanlig BLOKK med ÉN indre flex-wrapper, 36 popups (> 30) gruppert Rom · Funksjoner ·
//         Importert med antall, filter + søk (navn, #hash, aliaser som #nibe → #varmepumpe), siste rad og «Bruk egen
//         hash» nås med touch (mobil) og hjul (PC), arket under er låst og lukkes ikke, valg lukker arket (haptic light).
//   30.3  ruter 3 × 2 (76 px, r20, #232323 / valgt #404040 + rosa inset), forklaring, felt per handling (Popup/Egen hash/
//         Sti med chips fra lovelace/config/URL med «Åpne i ny fane»/More-info/Ingen), «Test · åpne …» (44 px, medium),
//         action_style: liste, HA-format i config (tap_action/hold_action), gamle former leses, navbar hold, prosa,
//         Hjem-kort, Søppel (Tilpass Hjem og GUI-editoren – samme valg), aldri én rute alene på en linje.
// Kjør: node test/velger30-check.mjs   (SHOTS=<mappe> lagrer skjermbilder)
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readdirSync, mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/velger30-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const shots = process.env.SHOTS || '';
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
let fail = 0;
const ok = (m, c, d) => { console.log((c ? 'OK   ' : 'FEIL ') + m + (c || d === undefined ? '' : ' → ' + JSON.stringify(d).slice(0, 500))); if (!c) fail++; };
const PINK = /242,\s*133,\s*201/;

for (const [vp, size, touch] of [['mobil', { width: 390, height: 844 }, true], ['pc', { width: 1280, height: 900 }, false]]) {
  const p = await b.newPage({ viewport: size, hasTouch: touch });
  p.setDefaultTimeout(60000);
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + resolve('test/harness.html'));
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) { /* */ } window.__userData = { ki_dashboard: { onboarded: true } }; });
  for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
  await p.addScriptTag({ path: bundle });
  const cdp = await p.context().newCDPSession(p);
  const swipe = async (x, y0, dy) => {
    x = Math.round(x); y0 = Math.round(y0);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }] });
    for (let i = 1; i <= 12; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: Math.round(y0 - (dy * i) / 12) }] }); await p.waitForTimeout(16); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await p.waitForTimeout(200);
  };
  const W = (ms) => p.waitForTimeout(ms);
  await p.evaluate(async () => {
    window.deepAll = (sel, root) => { const out = []; const walk = (r) => r.querySelectorAll('*').forEach((e) => { if (e.matches(sel)) out.push(e); if (e.shadowRoot) walk(e.shadowRoot); }); walk(root || document); return out; };
    window.deep = (sel, root) => window.deepAll(sel, root)[0] || null;
    window.wait = (ms) => new Promise((q) => setTimeout(q, ms));
    window.__hp = []; window.addEventListener('haptic', (e) => window.__hp.push(e.detail));
    const H = window.H = window.mockHass();
    // lovelace/config gir dashbordets visninger (sti-chips hentes herfra, ikke hardkodet)
    window.__lc = 0;
    const cws = H.callWS && H.callWS.bind(H);
    H.callWS = (m) => { if (m && m.type === 'lovelace/config') { window.__lc++; return Promise.resolve({ views: [{ title: 'Oversikt', path: 'oversikt', icon: 'mdi:home' }, { title: 'Kart', path: 'kart', icon: 'mdi:map' }, { title: 'Energi', path: 'energi' }] }); } return cws ? cws(m) : Promise.reject(new Error('x')); };
    MSH.lastHass = H;
    await MSH.store.load(H);
    // 36 popups (> 30): 12 rom med romfarge, 15 funksjoner (inkl. #varmepumpe), 9 importerte
    const E = [];
    const COL = ['rgb(242 192 115)', 'rgb(115 185 242)', 'rgb(182 155 242)', 'rgb(115 214 214)'];
    for (let i = 1; i <= 12; i++) E.push({ hash: i === 1 ? '#stue' : '#rom' + i, name: i === 1 ? 'Stue' : 'Rom ' + i, icon: 'mdi:sofa', group: 'rom', source: 'auto', color: COL[i % 4] });
    E.push({ hash: '#varmepumpe', name: 'Varmepumpe', icon: 'mdi:heat-pump', group: 'fn', source: 'auto' });
    E.push({ hash: '#vaer', name: 'Vær', icon: 'mdi:weather-partly-cloudy', group: 'fn', source: 'auto' });
    E.push({ hash: '#klima', name: 'Klima', icon: 'mdi:thermostat', group: 'fn', source: 'auto' });
    E.push({ hash: '#lys', name: 'Lys', icon: 'mdi:lightbulb-group', group: 'fn', source: 'auto' });
    E.push({ hash: '#soppel', name: 'Søppel', icon: 'mdi:trash-can', group: 'fn', source: 'auto' });
    for (let i = 1; i <= 10; i++) E.push({ hash: '#fn' + i, name: 'Funksjon ' + i, icon: 'mdi:apps', group: 'fn', source: 'auto' });
    for (let i = 1; i <= 9; i++) E.push({ hash: '#imp' + i, name: 'Importert ' + i, icon: 'mdi:star', group: 'egne', source: 'yaml' });
    MSH.popupReport = { entries: E, collisions: [], invalid: [] };
    const nb = document.createElement('msh-navbar-card');
    // gamle config-former: media = buttons.<id>.hash, vanning = buttons.<id>.tap
    nb.setConfig({ type: 'custom:msh-navbar-card', card_id: 'ki-navbar', bar: ['klima', 'media', 'vanning', 'ruter'], buttons: { media: { hash: '#lys' }, vanning: { tap: { action: 'navigate', navigation_path: '#klima' } } } });
    nb.hass = H; window.NAV = nb;
    document.getElementById('dash').appendChild(nb);
    await wait(700);
  });
  ok(`${vp} 30.1-alias: #nibe → #varmepumpe (bassengpopupen er slettet: #basseng er ingen alias)`, await p.evaluate(() => MSH.canonHash('#nibe') === '#varmepumpe' && MSH.canonHash('#basseng') === '#basseng'));

  /* ---------------- «Tilpass navbar» → knappen Klima → handlingsvelgeren */
  await p.evaluate(async () => {
    NAV.customize(); await wait(600);
    window.ED = deep('msh-navbar-editor');
    ED.shadowRoot.querySelector('[data-a="nbsel"][data-id="klima"]').click(); await wait(400);
    window.TP = ED.shadowRoot.querySelector('msh-tap-picker[data-nbtap="klima"][data-nbw="tap"]');
    window.HP = ED.shadowRoot.querySelector('msh-tap-picker[data-nbtap="klima"][data-nbw="hold"]');
  });
  const tiles = await p.evaluate(() => {
    const R = TP.shadowRoot, T = [...R.querySelectorAll('.tl')];
    const cs = (e) => getComputedStyle(e);
    const rows = {}; T.forEach((t) => { const y = Math.round(t.getBoundingClientRect().top); rows[y] = (rows[y] || 0) + 1; });
    const on = R.querySelector('.tl.on'), off = R.querySelector('.tl:not(.on)'), ic = on.querySelector('ha-icon'), lab = on.querySelector('.tn'), sub = R.querySelector('.sub'), tst = R.querySelector('.tst');
    return {
      labels: T.map((t) => t.textContent.trim()), rows: Object.values(rows), w: [...new Set(T.map((t) => Math.round(t.getBoundingClientRect().width)))], h: [...new Set(T.map((t) => Math.round(t.getBoundingClientRect().height)))],
      rad: cs(on).borderTopLeftRadius, onBg: cs(on).backgroundColor, onSh: cs(on).boxShadow, offBg: cs(off).backgroundColor, offSh: cs(off).boxShadow,
      icon: Math.round(ic.getBoundingClientRect().width), icCol: cs(ic).color, icOn: ic.getAttribute('icon'), icOff: off.querySelector('ha-icon').getAttribute('icon'), lab: cs(lab).fontSize + '/' + cs(lab).fontWeight,
      sub: sub && [sub.textContent, cs(sub).fontSize, cs(sub).color], tst: tst && [Math.round(tst.getBoundingClientRect().height), tst.textContent.trim(), cs(tst).boxShadow, cs(tst).borderRadius],
      mode: TP.mode, holdMode: HP && HP.mode, style: R.querySelector('.w').dataset.style, fld: R.querySelector('.fld').dataset.mode, anim: cs(R.querySelector('.fld')).animationDuration,
      pf: (() => { const f = R.querySelector('.pf'); const c = f.querySelector('.ci'); return { h: Math.round(f.getBoundingClientRect().height), r: cs(f).borderRadius, ci: Math.round(c.getBoundingClientRect().width), by: f.querySelector('.by').textContent.trim(), name: f.querySelector('.nm b').textContent, hash: f.querySelector('.nm i').textContent, mono: /monospace/.test(cs(f.querySelector('.nm i')).fontFamily) }; })(),
    };
  });
  ok(`${vp} 30.3 seks ruter: Popup · Egen hash · Sti · URL · More-info · Ingen`, tiles.labels.join('|') === 'Popup|Egen hash|Sti|URL|More-info|Ingen', tiles.labels);
  ok(`${vp} 30.3 rutenett 3 × 2, like store ruter, ingen rute alene på en linje`, tiles.rows.join() === '3,3' && tiles.w.length === 1 && tiles.h.join() === '76', tiles);
  ok(`${vp} 30.3 rute r20, #232323; valgt #404040 + inset 1.5 px rosa, fylt rosa ikon 24 px`, tiles.rad === '20px' && tiles.offBg === 'rgb(35, 35, 35)' && tiles.offSh === 'none' && tiles.onBg === 'rgb(64, 64, 64)' && PINK.test(tiles.onSh) && /1\.5px/.test(tiles.onSh) && tiles.icon === 24 && PINK.test(tiles.icCol) && tiles.icOn === 'mdi:application', tiles);
  ok(`${vp} 30.3 etikett 13/500, forklaring 12 px #7f7f7f`, tiles.lab === '13px/500' && tiles.sub && tiles.sub[0] === 'Åpner en popup i dashbordet' && tiles.sub[1] === '12px' && tiles.sub[2] === 'rgb(127, 127, 127)', tiles);
  ok(`${vp} 30.3 standard-handlingen (#klima) vises som Popup-felt: sirkel 44, navn, #hash mono, «Bytt ›», fade 200 ms`, tiles.mode === 'popup' && tiles.fld === 'popup' && tiles.anim === '0.2s' && tiles.pf.ci === 44 && tiles.pf.name === 'Klima' && tiles.pf.hash === '#klima' && tiles.pf.mono && tiles.pf.by === 'Bytt' && tiles.pf.h >= 60 && tiles.pf.r === '18px', tiles.pf);
  ok(`${vp} 30.3 «Test · åpne #klima» (konturknapp 44 px)`, tiles.tst && tiles.tst[0] === 44 && tiles.tst[1] === 'Test · åpne #klima' && /1\.5px/.test(tiles.tst[2]), tiles.tst);
  ok(`${vp} 30.3 navbar har også «Ved hold» (Ingen som standard)`, tiles.holdMode === 'none', tiles.holdMode);

  /* ---------------- 30.2 · popup-velger-arket */
  await p.evaluate(async () => { window.__hp = []; TP.shadowRoot.querySelector('.pf').click(); await wait(500); const P = MSH.portals(); window.PS = P[P.length - 1].shadowRoot; window.UNDER = P[P.length - 2].shadowRoot; });
  const sh = await p.evaluate(() => {
    const cs = (e) => getComputedStyle(e), S = PS.querySelector('.sh'), sc = PS.querySelector('.sc'), r = S.getBoundingClientRect(), D = MSH.dashRect();
    const wr = sc.children;
    return {
      top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight, rad: cs(S).borderTopLeftRadius + ' ' + cs(S).borderTopRightRadius + ' ' + cs(S).borderBottomLeftRadius, bg: cs(S).backgroundColor, disp: cs(S).display + ' ' + cs(S).flexDirection, sOv: cs(S).overflowY,
      title: PS.querySelector('.hd b').textContent, count: PS.querySelector('.hd i').textContent, tSize: cs(PS.querySelector('.hd b')).fontSize + '/' + cs(PS.querySelector('.hd b')).fontWeight, x: Math.round(PS.querySelector('.hd .x').getBoundingClientRect().width),
      search: [Math.round(PS.querySelector('.sr').getBoundingClientRect().height), cs(PS.querySelector('.sr')).borderRadius, PS.querySelector('.q').placeholder],
      filters: [...PS.querySelectorAll('.flt button')].map((x) => x.textContent), fOn: cs(PS.querySelector('.flt button.on')).backgroundImage,
      sc: { disp: cs(sc).display, flex: cs(sc).flexGrow, mh: cs(sc).minHeight, oy: cs(sc).overflowY, ob: cs(sc).overscrollBehaviorY, ta: cs(sc).touchAction, kids: wr.length, wrDisp: wr[0] && cs(wr[0]).display + ' ' + cs(wr[0]).flexDirection, wrGap: wr[0] && cs(wr[0]).rowGap, wrMax: wr[0] && cs(wr[0]).maxHeight, sh: sc.scrollHeight, ch: sc.clientHeight },
      groups: [...PS.querySelectorAll('.lb')].map((x) => x.textContent), rows: PS.querySelectorAll('.pr').length,
      row: (() => { const rw = PS.querySelector('.pr[data-v="#stue"]'), ci = rw.querySelector('.ci'), nm = rw.querySelector('.nm b'), h = rw.querySelector('.h'); return { h: Math.round(rw.getBoundingClientRect().height), ci: Math.round(ci.getBoundingClientRect().width), ciBg: cs(ci).backgroundColor, nm: cs(nm).fontSize + '/' + cs(nm).fontWeight, hs: cs(h).fontSize, hc: cs(h).color, mono: /monospace/.test(cs(h).fontFamily) }; })(),
      fnCi: cs(PS.querySelector('.pr[data-v="#lys"] .ci')).backgroundColor,
      sel: (() => { const on = PS.querySelector('.pr.on'); return on && { v: on.dataset.v, bg: cs(on).backgroundColor, ck: cs(on.querySelector('.ck')).opacity, ckc: cs(on.querySelector('.ck')).color }; })(),
      gb: cs(PS.querySelector('.gb')).backgroundColor + ' ' + cs(PS.querySelector('.gb')).borderRadius,
      cust: PS.querySelector('.cust').textContent.replace(/\s+/g, ' ').trim(),
      underLocked: getComputedStyle(UNDER.querySelector('.sh')).overflowY, portals: MSH.portals().length, hp: window.__hp.slice(),
      dashTop: Math.round(D.top || 0),
    };
  });
  ok(`${vp} 30.2 arket: topp 52 px (Fiks 40), radius 38 38 0, #282828, helt ned`, sh.top === 52 && sh.rad === '38px 38px 0px' && sh.bg === 'rgb(40, 40, 40)' && Math.abs(sh.bottom - sh.vh) <= 1, sh);
  ok(`${vp} 30.2 arket er flex-kolonne uten egen scroll`, sh.disp === 'flex column' && sh.sOv === 'hidden', sh.disp);
  ok(`${vp} 30.2 tittel «Velg popup» 22/600 + «36 popups i dashbordet», lukk 40 px`, sh.title === 'Velg popup' && sh.count === '36 popups i dashbordet' && sh.tSize === '22px/600' && sh.x === 40, sh);
  ok(`${vp} 30.2 søk 46 px r23 «Søk navn eller #hash», filter Alle/Rom/Funksjoner/Importert (rosa gradient)`, sh.search[0] === 46 && sh.search[1] === '23px' && sh.search[2] === 'Søk navn eller #hash' && sh.filters.join('|') === 'Alle|Rom|Funksjoner|Importert' && /gradient/.test(sh.fOn), sh);
  ok(`${vp} 30.2 scrollområdet er en BLOKK (flex 1, min-height 0, auto, contain, pan-y) med ÉN indre flex-wrapper (gap 8, ingen høydegrense)`, sh.sc.disp === 'block' && sh.sc.flex === '1' && sh.sc.mh === '0px' && sh.sc.oy === 'auto' && sh.sc.ob === 'contain' && sh.sc.ta === 'pan-y' && sh.sc.kids === 1 && sh.sc.wrDisp === 'flex column' && sh.sc.wrGap === '8px' && sh.sc.wrMax === 'none', sh.sc);
  ok(`${vp} 30.2 listen er scrollbar (scrollHeight > clientHeight)`, sh.sc.sh > sh.sc.ch + 100, sh.sc);
  ok(`${vp} 30.2 alle 36 popups, gruppert Rom · 12 / Funksjoner · 15 / Importert · 9 (#3a3a3a r22)`, sh.rows === 36 && sh.groups.join('|') === 'Rom · 12|Funksjoner · 15|Importert · 9' && sh.gb === 'rgb(58, 58, 58) 22px', sh);
  ok(`${vp} 30.2 rad ≥ 60 px: sirkel 40 i romfarge (andre #2f2f2f), navn 15/500, hash 12 px mono #979797`, sh.row.h >= 60 && sh.row.ci === 40 && sh.row.ciBg !== 'rgb(47, 47, 47)' && sh.fnCi === 'rgb(47, 47, 47)' && sh.row.nm === '15px/500' && sh.row.hs === '12px' && sh.row.hc === 'rgb(151, 151, 151)' && sh.row.mono, sh.row);
  ok(`${vp} 30.2 valgt (#klima): #404040 + rosa check_circle`, sh.sel && sh.sel.v === '#klima' && sh.sel.bg === 'rgb(64, 64, 64)' && sh.sel.ck === '1' && PINK.test(sh.sel.ckc), sh.sel);
  ok(`${vp} 30.2 «Bruk egen hash» nederst`, /Bruk egen hash.*For popups som ikke finnes ennå/.test(sh.cust), sh.cust);
  ok(`${vp} 30.2 arket under er låst mens velgeren er åpen, haptic light ved åpning`, sh.underLocked === 'hidden' && sh.portals === 2 && sh.hp.includes('light'), sh);
  if (shots) await p.screenshot({ path: `${shots}/velger30-ark-${vp}.png` });

  // scroll helt ned – touch (mobil) og hjul (PC)
  const box = await p.evaluate(() => { const r = PS.querySelector('.sc').getBoundingClientRect(); PS.querySelector('.sc').scrollTop = 0; window.__us = UNDER.querySelector('.sh').scrollTop; return { x: r.left + r.width / 2, y: r.top + r.height / 2, h: r.height }; });
  if (touch) { for (let i = 0; i < 14; i++) await swipe(box.x, box.y + box.h * 0.3, Math.min(300, box.h * 0.6)); }
  else { await p.mouse.move(box.x, box.y); for (let i = 0; i < 10; i++) { await p.mouse.wheel(0, 600); await W(60); } }
  await W(400);
  const bot = await p.evaluate(() => {
    const sc = PS.querySelector('.sc'), r = sc.getBoundingClientRect(), rows = sc.querySelectorAll('.pr'), l = rows[rows.length - 1].getBoundingClientRect(), c = PS.querySelector('.cust').getBoundingClientRect();
    return { st: sc.scrollTop, max: sc.scrollHeight - sc.clientHeight, last: rows[rows.length - 1].dataset.v, lastVis: l.top >= r.top - 1 && l.bottom <= r.bottom + 1, custVis: c.top >= r.top - 1 && c.bottom <= r.bottom + 1, portals: MSH.portals().length, under: UNDER.querySelector('.sh').scrollTop, us0: window.__us, scrollY };
  });
  ok(`${vp} 30.2 ${touch ? 'touch-sveip' : 'hjul'}: helt ned – siste rad (#imp9) og «Bruk egen hash» synlige`, bot.st > 300 && Math.abs(bot.st - bot.max) <= 2 && bot.last === '#imp9' && bot.lastVis && bot.custVis, bot);
  ok(`${vp} 30.2 arket under er ikke lukket eller scrollet, siden står stille`, bot.portals === 2 && bot.under === bot.us0 && bot.scrollY === 0, bot);
  if (touch) {
    // dra i tittelraden lukker ikke Tilpass-arket under (stopPropagation), og et sveip nedover i listen scroller opp igjen
    await swipe(box.x, box.y - box.h * 0.2, -260);
    const up = await p.evaluate(() => ({ st: PS.querySelector('.sc').scrollTop, portals: MSH.portals().length }));
    ok(`${vp} 30.2 sveip nedover i listen scroller opp (lukker ikke noe)`, up.portals === 2 && up.st < bot.st, up);
  }
  if (shots) await p.screenshot({ path: `${shots}/velger30-ark-bunn-${vp}.png` });

  // filter og søk
  const fs = await p.evaluate(async () => {
    const R = PS, set = async (q) => { const i = R.querySelector('.q'); i.value = q; i.dispatchEvent(new Event('input', { bubbles: true })); await wait(30); return [...R.querySelectorAll('.pr')].map((x) => x.dataset.v); };
    const f = async (k) => { R.querySelector(`.flt [data-v="${k}"]`).click(); await wait(30); return { n: R.querySelectorAll('.pr').length, g: [...R.querySelectorAll('.lb')].map((x) => x.textContent) }; };
    const out = { rom: await f('rom'), imp: await f('imp'), fn: await f('fn') };
    await f('alle');
    out.bass = await set('varmepumpe'); out.alias = await set('#nibe'); out.hash = await set('#klima');
    await set('zzz'); out.none = (R.querySelector('.none') || {}).textContent;
    await set('');
    out.all = R.querySelectorAll('.pr').length;
    return out;
  });
  ok(`${vp} 30.2 filter Rom → 12, Importert → 9, Funksjoner → 15`, fs.rom.n === 12 && fs.rom.g.join() === 'Rom · 12' && fs.imp.n === 9 && fs.fn.n === 15, fs);
  ok(`${vp} 30.2 søk treffer navn, #hash og alias (#nibe → #varmepumpe)`, fs.bass.join() === '#varmepumpe' && fs.alias.join() === '#varmepumpe' && fs.hash.join() === '#klima' && fs.all === 36, fs);
  ok(`${vp} 30.2 ingen treff: «Ingen popup heter «zzz»»`, fs.none === 'Ingen popup heter «zzz»', fs.none);

  // trykk på siste rad velger, lukker arket, haptic light, lagres i HA-format
  const pick = await p.evaluate(async () => { window.__hp = []; PS.querySelector('.pr[data-v="#imp9"]').click(); await wait(700); return { portals: MSH.portals().length, hp: window.__hp.slice(), cfg: (ED._config.buttons || {}).klima, mode: TP.mode, name: TP.shadowRoot.querySelector('.pf .nm b').textContent, under: getComputedStyle(UNDER.querySelector('.sh')).overflowY }; });
  ok(`${vp} 30.2 trykk på siste rad: arket lukkes (Tilpass navbar står), haptic light, arket under låses opp`, pick.portals === 1 && pick.hp[0] === 'light' && pick.under !== 'hidden', pick);
  ok(`${vp} 30.3 lagres som buttons.klima.tap_action { action: navigate, navigation_path: '#imp9' }`, pick.cfg && pick.cfg.tap_action && pick.cfg.tap_action.action === 'navigate' && pick.cfg.tap_action.navigation_path === '#imp9' && !('tap' in pick.cfg) && pick.mode === 'popup' && pick.name === 'Importert 9', pick);

  // «Bruk egen hash» → handlingen Egen hash
  const own = await p.evaluate(async () => {
    TP.shadowRoot.querySelector('.pf').click(); await wait(500);
    const P = MSH.portals(); P[P.length - 1].shadowRoot.querySelector('.cust').click(); await wait(500);
    const R = TP.shadowRoot, out = { portals: MSH.portals().length, mode: TP.mode, tileOn: R.querySelector('.tl.on .tn').textContent, hasHash: !!R.querySelector('.hf input[data-f="hash"]') };
    const i = R.querySelector('[data-f="hash"]'), cs = getComputedStyle(R.querySelector('.hf'));
    out.hf = [Math.round(R.querySelector('.hf').getBoundingClientRect().height), cs.borderRadius, R.querySelector('.hf span').textContent];
    i.value = 'finnesikke'; i.dispatchEvent(new Event('input', { bubbles: true })); await wait(30);
    let m = R.querySelector('.hm'); out.warn = [m.textContent, getComputedStyle(m).color];
    i.value = 'nibe'; i.dispatchEvent(new Event('input', { bubbles: true })); await wait(30);
    m = R.querySelector('.hm'); out.okm = [m.textContent, getComputedStyle(m).color];
    i.value = 'finnesikke'; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); await wait(400);
    out.cfg = ED._config.buttons.klima.tap_action; out.tst = (R.querySelector('.tst') || {}).textContent;
    return out;
  });
  ok(`${vp} 30.2 «Bruk egen hash» lukker arket og bytter til Egen hash (felt med fast «#», 48 px r16)`, own.portals === 1 && own.mode === 'hash' && own.tileOn === 'Egen hash' && own.hasHash && own.hf[0] === 48 && own.hf[1] === '16px' && own.hf[2] === '#', own);
  ok(`${vp} 30.3 Egen hash: gul «finnes ikke … lagres likevel», grønn «Åpner Varmepumpe» (alias #nibe)`, /Popupen finnes ikke i dette dashbordet – lagres likevel/.test(own.warn[0]) && own.warn[1] === 'rgb(242, 192, 115)' && own.okm[0].trim() === 'Åpner Varmepumpe' && own.okm[1] === 'rgb(102, 209, 158)', own);
  ok(`${vp} 30.3 ukjent hash lagres likevel, Test · åpne #finnesikke`, own.cfg && own.cfg.navigation_path === '#finnesikke' && own.tst.trim() === 'Test · åpne #finnesikke', own);

  // Sti: chips fra lovelace/config
  const path = await p.evaluate(async () => {
    const R = TP.shadowRoot;
    [...R.querySelectorAll('.tl')].find((t) => t.textContent.trim() === 'Sti').click(); await wait(400);
    const chips = [...R.querySelectorAll('.chips button')].map((c) => [c.textContent.trim(), c.dataset.v]);
    const k = [...R.querySelectorAll('.chips button')].find((c) => c.textContent.trim() === 'Kart'); k && k.click(); await wait(400);
    const on = R.querySelector('.chips button.on');
    return { chips, lc: window.__lc, cfg: ED._config.buttons.klima.tap_action, on: on && [on.textContent.trim(), getComputedStyle(on).backgroundImage, Math.round(on.getBoundingClientRect().height)], inp: R.querySelector('[data-f="path"]').value, tst: R.querySelector('.tst').textContent.trim(), sub: R.querySelector('.sub').textContent };
  });
  ok(`${vp} 30.3 Sti: chips med dashbordets visninger fra lovelace/config (ikke hardkodet)`, path.lc >= 1 && path.chips.some((c) => c[0] === 'Kart' && /\/kart$/.test(c[1])) && path.chips.some((c) => c[0] === 'Oversikt'), path);
  ok(`${vp} 30.3 chip velger stien (navigate), valgt chip rosa 34 px, «Test · gå til visning»`, path.cfg && path.cfg.action === 'navigate' && /\/kart$/.test(path.cfg.navigation_path) && path.on && /gradient/.test(path.on[1]) && path.on[2] === 34 && path.inp === path.cfg.navigation_path && path.tst === 'Test · gå til visning' && path.sub === 'Går til en annen visning', path);

  // URL + «Åpne i ny fane»
  const url = await p.evaluate(async () => {
    const R = TP.shadowRoot;
    [...R.querySelectorAll('.tl')].find((t) => t.textContent.trim() === 'URL').click(); await wait(200);
    const i = R.querySelector('[data-f="url"]'); i.value = 'https://example.com'; i.dispatchEvent(new Event('change', { bubbles: true })); await wait(400);
    const a = ED._config.buttons.klima.tap_action, sw0 = R.querySelector('.tg .trk').className;
    R.querySelector('[data-p="newtab"]').click(); await wait(400);
    return { a, sw0, b: ED._config.buttons.klima.tap_action, sw1: R.querySelector('.tg .trk').className, tst: R.querySelector('.tst').textContent.trim() };
  });
  ok(`${vp} 30.3 URL: { action: url, url_path }, «Åpne i ny fane» av → new_tab: false`, url.a.action === 'url' && url.a.url_path === 'https://example.com' && /on/.test(url.sw0) && url.b.new_tab === false && !/on/.test(url.sw1) && url.tst === 'Test · åpne nettside', url);

  // More-info og Ingen
  const mi = await p.evaluate(async () => {
    const R = TP.shadowRoot, t = (n) => [...R.querySelectorAll('.tl')].find((x) => x.textContent.trim() === n);
    t('More-info').click(); await wait(400);
    const out = { a: ED._config.buttons.klima.tap_action, ent: !!R.querySelector('msh-entity-picker[data-f="ent"]'), tst: (R.querySelector('.tst') || {}).textContent };
    window.__hp = []; t('Ingen').click(); await wait(400);
    out.b = ED._config.buttons.klima.tap_action; out.noTest = !R.querySelector('.tst'); out.hint = R.querySelector('.fld .hint').textContent; out.hp = window.__hp.slice();
    return out;
  });
  ok(`${vp} 30.3 More-info: entitetsvelger, { action: more-info }, «Test · vis dialog»`, mi.a.action === 'more-info' && mi.ent && /Test · vis dialog/.test(mi.tst), mi);
  ok(`${vp} 30.3 Ingen: { action: none }, ingen Test-knapp, forklaring, haptic selection`, mi.b.action === 'none' && mi.noTest && /gjør ingenting/.test(mi.hint) && mi.hp[0] === 'selection', mi);

  // Hold: velg popup i «Ved hold» → hold_action; hold på navbar-ikonet kjører den
  const hold = await p.evaluate(async () => {
    const R = HP.shadowRoot;
    [...R.querySelectorAll('.tl')].find((x) => x.textContent.trim() === 'Popup').click(); await wait(200);
    R.querySelector('.pf').click(); await wait(500);
    const P = MSH.portals(); P[P.length - 1].shadowRoot.querySelector('.pr[data-v="#stue"]').click(); await wait(700);
    return { cfg: ED._config.buttons.klima.hold_action };
  });
  ok(`${vp} 30.3 navbar «Ved hold» lagres som hold_action i HA-format`, hold.cfg && hold.cfg.action === 'navigate' && hold.cfg.navigation_path === '#stue', hold);
  if (shots) await p.screenshot({ path: `${shots}/velger30-ruter-${vp}.png` });

  // action_style: liste
  const lst = await p.evaluate(async () => {
    ED._set('action_style', 'liste'); await wait(500);
    const t = ED.shadowRoot.querySelector('msh-tap-picker[data-nbtap="klima"][data-nbw="hold"]'), R = t.shadowRoot, L = R.querySelector('.lst');
    if (!L) return { none: true, st: t.getAttribute('action-style') };
    const on = R.querySelector('.lr.on'), cs = (e) => getComputedStyle(e);
    const out = { style: R.querySelector('.w').dataset.style, n: R.querySelectorAll('.lr').length, sub: [...R.querySelectorAll('.lr .nm i')].map((x) => x.textContent), onBg: cs(on).backgroundColor, h: Math.round(on.getBoundingClientRect().height), ck: cs(on.querySelector('.ck')).opacity, ci: Math.round(on.querySelector('.ci').getBoundingClientRect().width), ciBg: cs(on.querySelector('.ci')).backgroundImage, lBg: cs(L).backgroundColor, lR: cs(L).borderRadius };
    ED._set('action_style', undefined); await wait(400);
    return out;
  });
  ok(`${vp} 30.3 action_style: liste → radioliste (sirkel 40, navn, undertekst, hake), #232323 r18`, lst.style === 'liste' && lst.n === 6 && lst.sub[0] === 'Åpner en popup i dashbordet' && lst.onBg === 'rgb(64, 64, 64)' && lst.h >= 60 && lst.ck === '1' && lst.ci === 40 && /gradient/.test(lst.ciBg) && lst.lBg === 'rgb(35, 35, 35)' && lst.lR === '18px', lst);

  // gamle config-former leses
  const old = await p.evaluate(async () => {
    const pick = async (id) => { ED.shadowRoot.querySelector(`[data-a="nbsel"][data-id="${id}"]`).click(); await wait(300); const t = ED.shadowRoot.querySelector(`msh-tap-picker[data-nbtap="${id}"][data-nbw="tap"]`); return t ? [t.mode, (t.value || {}).navigation_path] : null; };
    return { media: await pick('media'), vanning: await pick('vanning') };
  });
  ok(`${vp} 30.3 gamle former: buttons.media.hash '#lys' og buttons.vanning.tap '#klima' vises som Popup`, old.media && old.media.join() === 'popup,#lys' && old.vanning && old.vanning.join() === 'popup,#klima', old);

  // Test-knappen kjører handlingen (haptic medium)
  const tst = await p.evaluate(async () => {
    const t = ED.shadowRoot.querySelector('msh-tap-picker[data-nbtap="vanning"][data-nbw="tap"]');
    window.__hp = []; t.shadowRoot.querySelector('.tst').click(); await wait(300);
    const out = { hash: location.hash, hp: window.__hp.slice() };
    MSH.closePopup(); await wait(300);
    return out;
  });
  ok(`${vp} 30.3 «Test · åpne #klima» åpner popupen med én gang, haptic medium`, tst.hash === '#klima' && tst.hp[0] === 'medium', tst);
  // utkastet i editoren → kortet (som «Ferdig»)
  await p.evaluate(async () => { const c = { ...NAV.config, buttons: ED._config.buttons }; MSH.portals().forEach((h) => h.remove()); MSH.sheetCount && MSH.sheetCount(-9); NAV.setConfig(c); NAV.hass = H; await wait(400); });

  // hold på navbar-ikonet (Klima) → hold_action (#stue) – trykk-handlingen er Ingen (lagret over)
  const nbBox = await p.evaluate(async () => { await wait(300); const b = deepAll('nav [data-id="klima"]').find((x) => x.getBoundingClientRect().width > 0); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  if (touch) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: Math.round(nbBox.x), y: Math.round(nbBox.y) }] }); await W(700); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); }
  else { await p.mouse.move(nbBox.x, nbBox.y); await p.mouse.down(); await W(700); await p.mouse.up(); }
  await W(500);
  const hh = await p.evaluate(() => location.hash);
  if (process.env.DBG) console.log(await p.evaluate(() => JSON.stringify({ cfg: NAV.config.buttons, store: MSH.store.get('cards.ki-navbar') })));
  ok(`${vp} 30.3 hold på navbar-knappen kjører hold_action (#stue)`, hh === '#stue', hh);
  await p.evaluate(async () => { MSH.closePopup(); await wait(300); });

  /* ---------------- prosa-piller (Tilpass Hjem → Tekst) */
  const pr = await p.evaluate(async () => {
    const E = MSH.openHomeEditor({ focus: 'tekst' });
    const saves = []; const orig = E.saveP.bind(E); E.saveP = (x) => { saves.push(JSON.parse(JSON.stringify(x))); return orig(x); };
    E.u.proseSel = 0; E.render(); await wait(400);
    const t = E.root.querySelector('msh-tap-picker[data-in="ptap"]');
    if (!t) return { none: true };
    const R = t.shadowRoot, rows = {}; [...R.querySelectorAll('.tl')].forEach((x) => { const y = Math.round(x.getBoundingClientRect().top); rows[y] = (rows[y] || 0) + 1; });
    const labels = [...R.querySelectorAll('.tl')].map((x) => x.textContent.trim());
    [...R.querySelectorAll('.tl')].find((x) => x.textContent.trim() === 'Popup').click(); await wait(200);
    R.querySelector('.pf').click(); await wait(500);
    const P = MSH.portals(), S = P[P.length - 1].shadowRoot, n = S.querySelectorAll('.pr').length;
    S.querySelector('.pr[data-v="#varmepumpe"]').click(); await wait(500);
    const last = saves[saves.length - 1];
    E.ov.close(); await wait(300);
    return { labels, rows: Object.values(rows), n, row: last && last.prose && last.prose[0] };
  });
  ok(`${vp} 30.3 prosa: samme handlingsvelger (7 valg → 4 + 3 ruter, ingen alene)`, pr.labels && pr.labels.join('|') === 'Popup|Egen hash|Sti|URL|More-info|Dørlås|Ingen' && pr.rows.every((n) => n >= 2), pr);
  ok(`${vp} 30.2 prosa: samme popup-velger-ark (36), valget lagres som tap i HA-format`, pr.n === 36 && pr.row && pr.row.tap && pr.row.tap.navigation_path === '#varmepumpe', pr);

  /* ---------------- Søppel: Tilpass Hjem → Kort → Søppel og GUI-editoren (samme valg) */
  const so = await p.evaluate(async () => {
    const hj = document.createElement('msh-soppel-card'); hj.setConfig({ type: 'custom:msh-soppel-card', card_id: MSH.CARD_IDS ? MSH.CARD_IDS.soppel : 'hjem-soppel', popup_hash: '#soppel' }); hj.hass = H; document.getElementById('dash').appendChild(hj); await wait(300);
    const E = MSH.openHomeEditor({ focus: 'kort' }); await wait(600);
    const top = () => { const P = MSH.portals(); return P[P.length - 1].shadowRoot; };
    const b = top().querySelector('button[data-a="blked"][data-v="soppel"]'); if (b) { b.click(); await wait(400); }
    const tp = [...top().querySelectorAll('msh-tap-picker[data-in="trtap"]')];
    const modes = (t) => [...t.shadowRoot.querySelectorAll('.tl')].map((x) => x.dataset.v);
    const rows = (t) => { const r = {}; [...t.shadowRoot.querySelectorAll('.tl')].forEach((x) => { const y = Math.round(x.getBoundingClientRect().top); r[y] = (r[y] || 0) + 1; }); return Object.values(r); };
    const out = { n: tp.length, modes: tp[0] && modes(tp[0]), rows: tp[0] && rows(tp[0]), shown: tp[0] && [tp[0].mode, (tp[0].value || {}).navigation_path] };
    E.ov && E.ov.close && E.ov.close(); MSH.portals().forEach((h) => h.remove()); await wait(300);
    // GUI-editoren (HA): samme valg, gamle former leses, valg lagres i HA-format
    if (!customElements.get('ha-selector')) customElements.define('ha-selector', class extends HTMLElement {});
    const el = customElements.get('msh-soppel-card').getConfigElement(); el.hass = H;
    el.setConfig({ type: 'custom:msh-soppel-card', popup_hash: '#soppel', hold_action: { action: 'popup', hash: '#klima' } });
    document.body.appendChild(el); await wait(400);
    const root = el.shadowRoot || el, ed = root.querySelector('msh-editor') || el;
    const sr = ed.shadowRoot || ed;
    const g = sr.querySelector('msh-tap-picker[data-name="tap_action"]'), gh = sr.querySelector('msh-tap-picker[data-name="hold_action"]');
    out.gui = g && { modes: modes(g), gui: g.hasAttribute('gui'), shown: [g.mode, (g.value || {}).navigation_path], hold: gh && [gh.mode, (gh.value || {}).navigation_path] };
    let got = null; el.addEventListener('config-changed', (e) => { got = e.detail.config; });
    if (g) {
      g.shadowRoot.querySelector('.pf').click(); await wait(500);
      const P = MSH.portals(), S = P[P.length - 1].shadowRoot; out.guiRows = S.querySelectorAll('.pr').length;
      S.querySelector('.pr[data-v="#vaer"]').click(); await wait(500);
      // More-info i GUI-editoren = ha-selector entity
      [...g.shadowRoot.querySelectorAll('.tl')].find((x) => x.dataset.v === 'more').click(); await wait(300);
      const hs = g.shadowRoot.querySelector('ha-selector[data-f="ent"]'); out.haSel = hs ? JSON.stringify(hs.selector) : null;
    }
    out.saved = got && got.tap_action;
    el.remove(); hj.remove();
    return out;
  });
  ok(`${vp} 30.3 Søppel (Tilpass Hjem): Trykk og Hold med handlingsvelgeren, 8 valg → 3+3+2 ruter`, so.n === 2 && so.modes && so.modes.join() === 'std,popup,hash,path,url,more,service,none' && so.rows.every((n) => n >= 2), so);
  ok(`${vp} 30.3 Søppel GUI-editor: samme valg som Tilpass Hjem (paritet), gui-modus`, so.gui && so.gui.modes.join() === so.modes.join() && so.gui.gui, so.gui);
  ok(`${vp} 30.3 Søppel GUI: gammel popup_hash og { action: popup, hash } leses som Popup`, so.gui && so.gui.shown.join() === 'popup,#soppel' && so.gui.hold && so.gui.hold.join() === 'popup,#klima', so.gui);
  ok(`${vp} 30.2 Søppel GUI: «Bytt» åpner samme ark (36), valget lagres som tap_action navigate`, so.guiRows === 36 && so.saved && (so.saved.action === 'navigate' || so.saved.action === 'more-info'), so);
  ok(`${vp} 30.3 GUI-editoren: More-info bruker ha-selector entity`, so.haSel === '{"entity":{}}', so.haSel);

  /* ---------------- Hjem-kort (faner/fliser): GUI-editoren har handlingsvelgeren med 9 valg (3 × 3) */
  const hk = await p.evaluate(async () => {
    const el = customElements.get('msh-hjem-faner-card').getConfigElement(); el.hass = H;
    el.setConfig({ type: 'custom:msh-hjem-faner-card', card_id: 'f30' });
    document.body.appendChild(el); await wait(400);
    const ed = (el.shadowRoot || el).querySelector('msh-editor') || el, sr = ed.shadowRoot || ed;
    // åpne alle seksjoner så tap-feltene tegnes
    sr.querySelectorAll('details').forEach((d) => { d.open = true; }); sr.querySelectorAll('[data-a="x-ropen"]').forEach((x) => x.click()); await wait(400);
    const T = [...sr.querySelectorAll('msh-tap-picker')];
    const t = T.find((x) => (x.getAttribute('modes') || '').split(',').length === 9) || T[0];
    const out = { n: T.length, modes: t && t.getAttribute('modes'), cols: t && getComputedStyle(t.shadowRoot.querySelector('.grid')).gridTemplateColumns.split(' ').length };
    el.remove();
    return out;
  });
  ok(`${vp} 30.3 Hjem-kort (GUI): handlingsvelger med URL i tillegg (9 valg, 3 kolonner)`, hk.n > 0 && hk.modes === 'std,toggle,popup,hash,path,url,more,service,none' && hk.cols === 3, hk);

  /* ---------------- popup_hash-felt (GUI, f.eks. Hjem · gjøremål) → samme ark, ikke ha-selector select */
  const ph = await p.evaluate(async () => {
    const el = customElements.get('msh-hjem-gjoremal-card').getConfigElement(); el.hass = H;
    el.setConfig({ type: 'custom:msh-hjem-gjoremal-card', popup_hash: '#nibe' });
    document.body.appendChild(el); await wait(400);
    const ed = (el.shadowRoot || el).querySelector('msh-editor') || el, sr = ed.shadowRoot || ed;
    const f = sr.querySelector('msh-popup-field[data-name="popup_hash"]'), sel = sr.querySelector('ha-selector[data-name="popup_hash"]');
    const out = { field: !!f, sel: !!sel, text: f && f.shadowRoot.querySelector('.nm b').textContent, by: f && f.shadowRoot.querySelector('.by').textContent.trim() };
    let got = null; el.addEventListener('config-changed', (e) => { got = e.detail.config; });
    if (f) { f.shadowRoot.querySelector('[data-p="open"]').click(); await wait(500); const P = MSH.portals(), S = P[P.length - 1].shadowRoot; out.rows = S.querySelectorAll('.pr').length; out.on = (S.querySelector('.pr.on') || {}).dataset; out.on = out.on && out.on.v; S.querySelector('.pr[data-v="#lys"]').click(); await wait(500); }
    out.saved = got && got.popup_hash;
    el.remove();
    return out;
  });
  ok(`${vp} 30.2 popup_hash i GUI-editoren: popup-felt (alias #nibe → Varmepumpe, «Bytt»), samme ark, lagres`, ph.field && !ph.sel && ph.text === 'Varmepumpe' && ph.by === 'Bytt' && ph.rows === 36 && ph.on === '#varmepumpe' && ph.saved === '#lys', ph);

  if (shots) await p.screenshot({ path: `${shots}/velger30-slutt-${vp}.png` });
  ok(`${vp} ingen sidefeil`, !errs.length, errs.slice(0, 4));
  await p.close();
}
await b.close();
console.log(fail ? `\n${fail} FEIL` : '\nAlle velger30-sjekker OK');
process.exit(fail ? 1 : 0);
