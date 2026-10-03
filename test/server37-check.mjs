// Fiks 37 · servervelgeren («Bytt sted») i Hjem-headeren – logikk portet fra family-status-card, felles hjelper
// MSH.servervelger (src/06-server.js), meny-design fra Hjem v3.
//  · parsing av servere (streng «Oslo, Strömstad=Strømstad, Toten» / liste), rader uten navn droppes
//  · gjenkjenning (location_name mot navn/server, lowercase, ö→ø, ä→æ) og server_navn
//  · URL homeassistant://navigate/<sti>?server=<navn>, navnet kodes KUN for & ? # % og mellomrom (ø/ö ukodet),
//    sti = s.sti || server_sti || første segment av location.pathname || lovelace; åpnes med window.open (ALDRI location.href)
//  · server_plass tittel / under / navn, plassholdere {server} {name} {temp} {vaer}, ingen servere → ingen meny/pil
//  · gester: trykk i click, hold 500 ms (uten handling → Tilpass), dobbelttrykk 320 ms (menyen åpnes med en gang, andre
//    trykk på bakgrunnen lukker uten animasjon og kjører dobbelttrykket), server_meny_med hold/double_tap/ingen
//  · menyen: portalt lag over dashbordflaten, 260 px ark, «Bytt sted», «Du er her», chevron, «Tilpass …», pila roterer,
//    trykk utenfor / Esc lukker · lys + mørk · migrering fra servers/title_actions · Tilpass header → Steder
// Kjør: node test/server37-check.mjs
import { createRequire } from 'node:module';
import { readdirSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync(resolve('test/.build'), { recursive: true });
const bundle = resolve(`test/.build/srv37-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = [];
const ok = (name, c, info) => res.push(`${c ? '✔' : '✘'} ${name}${!c && info !== undefined ? ' · ' + JSON.stringify(info) : ''}`);

const page = async (w, touch) => {
  const p = await b.newPage({ viewport: { width: w, height: 844 }, hasTouch: !!touch });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.__errs = errs;
  // http-opphav så location.pathname kan være en dashbord-sti (/ki-dashboard/hjem)
  await p.route('http://ki.test/**', (rt) => { const u = new URL(rt.request().url()); rt.fulfill({ path: u.pathname.endsWith('.js') ? resolve('test/' + u.pathname.split('/').pop()) : resolve('test/harness.html') }); });
  await p.goto('http://ki.test/ki-dashboard/hjem');
  for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
  await p.addScriptTag({ path: bundle });
  await p.evaluate(() => {
    window.__open = []; window.open = (u) => { window.__open.push(u); return null; };
    window.__hap = []; window.addEventListener('haptic', (e) => window.__hap.push(e.detail));
    window.__ed = []; window.addEventListener('ki-open-editor', (e) => window.__ed.push(e.detail && e.detail.editor));
    window.__nav = []; const M = window.MSH; M.navigate = (p) => window.__nav.push(p); M.openPopup = (h) => window.__nav.push('pop:' + h);
    window.__w = (ms) => new Promise((q) => setTimeout(q, ms || 0));
    window.__deep = (sel) => { const o = []; const x = (rt) => rt.querySelectorAll('*').forEach((e) => { if (e.matches(sel)) o.push(e); if (e.shadowRoot) x(e.shadowRoot); }); x(document); return o; };
    window.__menu = () => window.__deep('.msh-servermeny')[0] || null;
    window.__mk = async (cfg, loc, h0) => {
      window.__menu() && window.__menu().remove();
      document.getElementById('dash').innerHTML = '';
      const h = h0 || window.mockHass(); h.config = { ...(h.config || {}), location_name: loc == null ? 'Oslo' : loc };
      const c = document.createElement('msh-hjem-header-card');
      c.setConfig({ type: 'custom:msh-hjem-header-card', card_id: 'hd37_' + Math.random().toString(36).slice(2), ...cfg });
      c.hass = h; document.getElementById('dash').appendChild(c); window.__c = c; window.__H = h;
      await window.__w(350);
      return c;
    };
  });
  return p;
};
const SERV = 'Oslo, Strömstad=Strømstad, Toten';

/* ------------------------------------------------------------ 1 · rene funksjoner */
let p = await page(430);
const pure = await p.evaluate(() => {
  const V = MSH.servervelger, out = {};
  out.parse1 = V.parse('Oslo, Strömstad=Strømstad, Toten');
  out.parse2 = V.parse(['Oslo', { navn: 'Strömstad', server: 'Strømstad', ikon: 'mdi:lighthouse', farge: 'var(--blue)', sti: 'dashboard-mysmarthome' }, { server: 'Toten' }, { ikon: 'mdi:x' }, '']);
  const c = { servere: 'Oslo, Strömstad=Strømstad, Toten' };
  const hz = (loc) => ({ config: { location_name: loc } });
  out.navn = ['strømstad', 'STRÖMSTAD', 'Strömstad', 'oslo ', 'Toten', 'Bergen'].map((l) => V.navn(c, hz(l)));
  out.navnAE = V.navn({ servere: 'Mälaren' }, hz('Mælaren'));
  out.over = V.navn({ ...c, server_navn: 'Toten' }, hz('Oslo'));
  out.path = location.pathname;
  out.url1 = V.url({ navn: 'Strömstad', server: 'Strømstad' }, c);
  out.url2 = V.url({ navn: 'X', server: 'Min hytte&Co #1 ?50%' }, c);
  out.url3 = V.url({ navn: 'Toten', server: 'Toten', sti: '/lovelace/gard' }, c);
  out.url4 = V.url({ navn: 'Oslo', server: 'Oslo' }, { ...c, server_sti: '/dashboard-mysmarthome' });
  out.plass = [V.plass({}, 'tittel'), V.plass({ server_plass: 'under' }), V.plass({ server_plass: 'navn' }, 'tittel'), V.plass({}, 'navn')];
  out.stil = V.parse('Oslo, Strömstad, Strømstad, Toten, Bergen, Bodø').map((s, i) => V.stil(s, i));
  out.stil0 = V.stil({ navn: 'Bergen' }, 0); out.stilOv = V.stil({ navn: 'Oslo', ikon: 'mdi:x', farge: 'var(--red)' }, 0);
  out.fyll = V.fyll('{server} · {name} · {first_name} · {temp} {vaer}', { server: 'Oslo', name: 'Ola', temp: '12 °C', vaer: 'Sol' });
  out.gest = ['tap', 'double_tap', 'hold', 'ingen', undefined].map((m) => V.gest({ ...c, server_meny_med: m }, 'tittel'));
  out.gestNone = V.gest({ server_meny_med: 'tap' }, 'tittel');
  // migrering (les begge)
  const old = { servers: [{ name: 'Oslo', icon: 'mdi:office-building', color: 'var(--green)' }, { name: 'Toten', path: '/lovelace/gard' }, { name: 'Bergen', icon: 'mdi:x', color: 'var(--red)', navigation_path: 'homeassistant://navigate/hytta?server=Bergen' }, { icon: 'mdi:y' }], servers_init: true, this_server: { name: 'toten' }, title_actions: { tap: 'config', double_tap: 'server', hold: 'none' }, kiosk_entity: 'input_boolean.k' };
  out.mig = V.fraGammel(old);
  out.eff = V.cfg(old);
  out.migNone = V.fraGammel({ servere: 'A', server_meny_med: 'hold' });
  out.ta = MSH.hjemTitleActions({ title_actions: { tap: 'kiosk', double_tap: 'none', hold: 'server' } });
  out.taStd = MSH.hjemTitleActions({});
  out.fit = [MSH.hjemFitHil(1200, 6, 28, 3, { font: 44, av: 80, badge: 34, gap: 8, tgap: 16 }, false), MSH.hjemFitHil(360, 6, 28, 3, { font: 44, av: 80, badge: 34, gap: 8, tgap: 16 }, true)];
  return out;
});
ok('parse: streng splittes på , og = («Strömstad=Strømstad»)', JSON.stringify(pure.parse1) === JSON.stringify([{ navn: 'Oslo', server: 'Oslo' }, { navn: 'Strömstad', server: 'Strømstad' }, { navn: 'Toten', server: 'Toten' }]), pure.parse1);
ok('parse: liste – strenger → {navn, server}, ikon/farge/sti beholdes, rader uten navn droppes', pure.parse2.length === 3 && pure.parse2[1].sti === 'dashboard-mysmarthome' && pure.parse2[1].ikon === 'mdi:lighthouse' && pure.parse2[2].navn === 'Toten', pure.parse2);
ok('gjenkjenning: location_name mot navn/server, case + ö/ø, trim', pure.navn.join() === 'Strömstad,Strömstad,Strömstad,Oslo,Toten,Bergen', pure.navn);
ok('gjenkjenning: ä → æ', pure.navnAE === 'Mälaren', pure.navnAE);
ok('server_navn overstyrer', pure.over === 'Toten', pure.over);
ok('URL: samme dashbord (første segment av pathname), ø ukodet', pure.path === '/ki-dashboard/hjem' && pure.url1 === 'homeassistant://navigate/ki-dashboard?server=Strømstad', pure.url1);
ok('URL: bare & ? # % og mellomrom kodes', pure.url2 === 'homeassistant://navigate/ki-dashboard?server=Min%20hytte%26Co%20%231%20%3F50%25', pure.url2);
ok('URL: stedets sti (ledende / fjernes) / server_sti', pure.url3 === 'homeassistant://navigate/lovelace/gard?server=Toten' && pure.url4 === 'homeassistant://navigate/dashboard-mysmarthome?server=Oslo', [pure.url3, pure.url4]);
ok('server_plass tittel/under/navn (+ standard)', pure.plass.join() === 'tittel,under,navn,navn', pure.plass);
const st = pure.stil;
ok('standardstil: Oslo grønn byikon, Strömstad/Strømstad blå fyr, Toten gul traktor, andre active-big/purple', st[0].ikon === 'mdi:home-city-outline' && /--green/.test(st[0].farge) && st[1].ikon === 'mdi:lighthouse' && /--blue/.test(st[1].farge) && st[2].ikon === 'mdi:lighthouse' && st[3].ikon === 'mdi:tractor-variant' && /--yellow/.test(st[3].farge) && /--purple/.test(st[4].farge) && /--teal/.test(st[5].farge) && /--active-big/.test(pure.stil0.farge) && pure.stilOv.ikon === 'mdi:x' && /--red/.test(pure.stilOv.farge), [st, pure.stil0, pure.stilOv]);
ok('plassholdere {server} {name} {first_name} {temp} {vaer}', pure.fyll === 'Oslo · Ola · Ola · 12 °C Sol', pure.fyll);
ok('server_meny_med tap/double_tap/hold/ingen (standard tap); ingen servere → ingen meny-gest', pure.gest.join() === 'tap,double_tap,hold,,tap' && pure.gestNone === '', [pure.gest, pure.gestNone]);
const mg = pure.mig;
ok('migrering: servers → servere (gamle standardikoner droppes, path/navigation_path → sti), rader uten navn droppes', JSON.stringify(mg.servere) === JSON.stringify([{ navn: 'Oslo' }, { navn: 'Toten', sti: 'lovelace/gard' }, { navn: 'Bergen', sti: 'hytta', ikon: 'mdi:x', farge: 'var(--red)' }]), mg.servere);
ok('migrering: this_server → server_navn, title_actions → server_meny_med + greeting_*_action', mg.server_navn === 'toten' && mg.server_meny_med === 'double_tap' && mg.greeting_tap_action.navigation_path === '/config' && mg.greeting_hold_action.action === 'none' && !mg.greeting_double_tap_action, mg);
ok('migrering: effektiv config uten gamle nøkler; ingenting å migrere med nye nøkler', !('servers' in pure.eff) && !('title_actions' in pure.eff) && pure.eff.kiosk_entity === 'input_boolean.k' && !Object.keys(pure.migNone).length, pure.eff);
ok('Handlinger på tittelen: gamle verdier vises (kiosk/none/server) og standard = meny/innstillinger/kiosk', JSON.stringify(pure.ta) === '{"tap":"kiosk","double_tap":"none","hold":"server"}' && JSON.stringify(pure.taStd) === '{"tap":"server","double_tap":"config","hold":"kiosk"}', [pure.ta, pure.taStd]);
ok('plassmangel (Hilsen): pila skjules først når navn + pil ikke får plass', pure.fit[0].pil === true && pure.fit[1].pil === false, pure.fit);

/* ------------------------------------------------------------ 2 · meny, bytte, window.open (aldri location.href) */
const m1 = await p.evaluate(async (SERV) => {
  const c = await __mk({ servere: SERV, mode: 'hjem' }, 'Oslo');
  const R = c.shadowRoot, out = {};
  out.title = R.querySelector('.ttl .tx').textContent;
  out.pil = !!R.querySelector('.ttl .pil ha-icon[icon="mdi:menu-down"]');
  __hap.length = 0;
  R.querySelector('.ttl').click();
  out.openSync = !!__menu(); // åpnes MED EN GANG (ingen ventetid, selv med dobbelttrykk-handling)
  await __w(400);
  const host = __menu(), S = host.shadowRoot, meny = S.querySelector('.meny');
  out.inOverlay = host.getRootNode().host && host.getRootNode().host.localName === 'ki-overlay-root';
  out.hostL = Math.round(host.getBoundingClientRect().left); out.dashL = Math.round(document.getElementById('dash').getBoundingClientRect().left);
  out.w = Math.round(meny.getBoundingClientRect().width); out.rad = getComputedStyle(meny).borderRadius;
  out.top = S.querySelector('.topp').textContent;
  out.rows = [...S.querySelectorAll('.rad')].map((r) => ({ n: r.querySelector('.navn').textContent, her: !!r.querySelector('.her'), chev: !!r.querySelector('.gaa'), ic: (r.querySelector('.flis ha-icon') || {}).getAttribute && r.querySelector('.flis ha-icon').getAttribute('icon'), d: r.style.getPropertyValue('--forsink') }));
  out.belowTitle = meny.getBoundingClientRect().top > R.querySelector('.ttl').getBoundingClientRect().bottom;
  out.spiss = getComputedStyle(meny, '::before').width;
  out.rot = R.querySelector('.ttl .pil').classList.contains('apen') && getComputedStyle(R.querySelector('.ttl .pil')).transform;
  out.hapOpen = __hap.slice();
  // trykk på raden du er på → bare lukk
  __open.length = 0;
  S.querySelector('.rad.na').click(); await __w(250);
  out.ownRow = { open: !!__menu(), urls: __open.slice() };
  // bytt til Strömstad
  R.querySelector('.ttl').click(); await __w(400);
  __hap.length = 0;
  const href0 = location.href;
  [...__menu().shadowRoot.querySelectorAll('.rad')].find((r) => /Strömstad/.test(r.textContent)).click(); await __w(250);
  out.swap = { urls: __open.slice(), hap: __hap.slice(), open: !!__menu(), href: location.href === href0, rot: R.querySelector('.ttl .pil').classList.contains('apen') };
  // Tilpass … i menyen
  R.querySelector('.ttl').click(); await __w(400);
  __ed.length = 0;
  __menu().shadowRoot.querySelector('.rad.tilpass').click(); await __w(250);
  out.tilpass = { ed: __ed.slice(), open: !!__menu() };
  // trykk utenfor (bakgrunnen) lukker
  R.querySelector('.ttl').click(); await __w(400);
  __menu().shadowRoot.querySelector('.vern').click(); await __w(250);
  out.outside = !!__menu();
  // Esc lukker
  R.querySelector('.ttl').click(); await __w(400);
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); await __w(250);
  out.esc = !!__menu();
  return out;
}, SERV);
ok('tittel: stedsnavnet med pil (mdi:menu-down) i «Hjem»', m1.title === 'Oslo' && m1.pil, m1);
ok('trykk åpner menyen med en gang', m1.openSync, m1);
ok('menyen portales til ki-overlay-root over dashbord-containeren (ikke vinduet)', m1.inOverlay && m1.hostL === m1.dashL, m1);
ok('ark 260 px, radius 22, under navnet, spiss, «Bytt sted»', m1.w === 260 && m1.rad === '22px' && m1.belowTitle && m1.spiss === '12px' && m1.top === 'Bytt sted', m1);
ok('rader: Oslo «Du er her» (ingen chevron), andre med chevron, standardikoner, forskjøvet 45 ms', m1.rows.length === 4 && m1.rows[0].her && !m1.rows[0].chev && m1.rows[1].chev && m1.rows[2].chev && m1.rows[1].ic === 'mdi:lighthouse' && m1.rows[2].ic === 'mdi:tractor-variant' && m1.rows[2].d === '90ms' && m1.rows[3].n === 'Tilpass …', m1.rows);
ok('pila roterer 180° når menyen er åpen', !!m1.rot && m1.rot !== 'none', m1.rot);
ok('haptic ved åpning (én)', m1.hapOpen.length === 1, m1.hapOpen);
ok('trykk på raden du er på → bare lukk', !m1.ownRow.open && !m1.ownRow.urls.length, m1.ownRow);
ok('bytt: window.open(homeassistant://navigate/ki-dashboard?server=Strømstad), haptic selection, menyen lukkes, location.href urørt', m1.swap.urls.length === 1 && m1.swap.urls[0] === 'homeassistant://navigate/ki-dashboard?server=Strømstad' && m1.swap.hap.includes('selection') && !m1.swap.open && m1.swap.href && !m1.swap.rot, m1.swap);
ok('«Tilpass …» åpner Tilpass header', m1.tilpass.ed.join() === 'header' && !m1.tilpass.open, m1.tilpass);
ok('trykk utenfor lukker menyen', !m1.outside);
ok('Esc lukker menyen', !m1.esc);

/* ------------------------------------------------------------ 3 · gester */
const g = await p.evaluate(async (SERV) => {
  const out = {};
  const down = (el) => { const r = el.getBoundingClientRect(); el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true, clientX: r.left + 5, clientY: r.top + 5, pointerId: 1 })); };
  const up = (el) => el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, composed: true, pointerId: 1 }));
  // standard: dobbelttrykk = /config – første trykk åpner menyen straks, andre (på bakgrunnen, < 320 ms) lukker uten animasjon
  let c = await __mk({ servere: SERV }, 'Oslo');
  let t = c.shadowRoot.querySelector('.ttl');
  __nav.length = 0;
  t.click();
  out.d1 = !!__menu();
  await __w(120);
  __menu().shadowRoot.querySelector('.vern').click();
  out.d2 = { gone: !__menu(), nav: __nav.slice() }; // fjernet straks (ingen utgangsanimasjon)
  // andre trykk ETTER fristen → bare lukk
  t.click(); await __w(450); __nav.length = 0;
  __menu().shadowRoot.querySelector('.vern').click(); await __w(200);
  out.d3 = { open: !!__menu(), nav: __nav.slice() };
  // hold 500 ms → kiosk (standard) · klikket etter hold teller ikke
  __H.__calls = window.__calls; window.__calls.length = 0; __hap.length = 0;
  down(t); await __w(560); up(t); t.click(); await __w(100);
  out.hold = { calls: window.__calls.map((x) => x.slice(0, 2).join('.') + ':' + (x[2] && x[2].entity_id)), menu: !!__menu(), hap: __hap.slice() };
  // hold < 500 ms → ingen hold
  window.__calls.length = 0;
  down(t); await __w(300); up(t); await __w(300);
  out.short = window.__calls.length;
  // hold uten annen handling → Tilpass
  c = await __mk({ servere: SERV, greeting_hold_action: { action: 'none' } }, 'Oslo'); t = c.shadowRoot.querySelector('.ttl');
  __ed.length = 0; down(t); await __w(560); up(t); t.click(); await __w(100);
  out.holdTp = { ed: __ed.slice(), menu: !!__menu() };
  // server_meny_med: hold → hold åpner menyen; trykk kjører greeting_tap_action med en gang (ingen dobbelttrykk)
  c = await __mk({ servere: SERV, server_meny_med: 'hold', greeting_tap_action: { action: 'navigate', navigation_path: '/x' }, greeting_double_tap_action: { action: 'none' } }, 'Oslo'); t = c.shadowRoot.querySelector('.ttl');
  __nav.length = 0; t.click(); out.mh1 = { nav: __nav.slice(), menu: !!__menu() };
  down(t); await __w(560); up(t); t.click(); await __w(100);
  out.mh2 = !!__menu();
  __menu() && __menu().shadowRoot.querySelector('.vern').click(); await __w(200);
  // server_meny_med: double_tap → ett trykk venter (280 ms) og kjører trykket; to trykk åpner menyen
  c = await __mk({ servere: SERV, server_meny_med: 'double_tap', greeting_tap_action: { action: 'navigate', navigation_path: '/y' } }, 'Oslo'); t = c.shadowRoot.querySelector('.ttl');
  __nav.length = 0; t.click(); out.md1 = __nav.length; await __w(330); out.md2 = __nav.slice();
  t.click(); await __w(80); t.click(); await __w(50); out.md3 = { menu: !!__menu(), nav: __nav.length };
  __menu() && __menu().shadowRoot.querySelector('.vern').click(); await __w(200);
  // ingen dobbelttrykk-handling → menyen på trykk, andre trykk innen 320 ms bare lukker (ingen /config)
  c = await __mk({ servere: SERV, greeting_double_tap_action: { action: 'none' } }, 'Oslo'); t = c.shadowRoot.querySelector('.ttl');
  __nav.length = 0; t.click(); out.n1 = !!__menu(); await __w(100); __menu().shadowRoot.querySelector('.vern').click(); await __w(200);
  out.n2 = { menu: !!__menu(), nav: __nav.slice() };
  // server_meny_med: ingen → trykk åpner ingen meny
  c = await __mk({ servere: SERV, server_meny_med: 'ingen' }, 'Oslo'); t = c.shadowRoot.querySelector('.ttl');
  t.click(); await __w(400); out.ingen = !!__menu();
  return out;
}, SERV);
ok('dobbelttrykk: første trykk åpner menyen straks', g.d1, g);
ok('dobbelttrykk: andre trykk innen 320 ms lukker uten utgangsanimasjon og kjører dobbelttrykket (/config)', g.d2.gone && g.d2.nav.join() === '/config', g.d2);
ok('andre trykk etter fristen bare lukker', !g.d3.open && !g.d3.nav.length, g.d3);
ok('hold 500 ms → kiosk-modus (standard), klikket etter hold teller ikke, haptic medium', g.hold.calls.join() === 'input_boolean.toggle:input_boolean.kiosk_mode' && !g.hold.menu && g.hold.hap.includes('medium'), g.hold);
ok('kort trykk (< 500 ms) er ikke hold', g.short === 0, g.short);
ok('hold uten annen handling → Tilpass header', g.holdTp.ed.join() === 'header' && !g.holdTp.menu, g.holdTp);
ok('server_meny_med hold: trykk kjører trykk-handlingen med en gang (ingen dobbelttrykk), hold åpner menyen', g.mh1.nav.join() === '/x' && !g.mh1.menu && g.mh2, [g.mh1, g.mh2]);
ok('server_meny_med double_tap: ett trykk venter og kjører trykket; to trykk åpner menyen', g.md1 === 0 && g.md2.join() === '/y' && g.md3.menu && g.md3.nav === 1, [g.md1, g.md2, g.md3]);
ok('uten dobbelttrykk-handling: andre trykk bare lukker', g.n1 && !g.n2.menu && !g.n2.nav.length, g.n2);
ok('server_meny_med ingen: ingen meny', !g.ingen);

/* ------------------------------------------------------------ 4 · plass, plassholdere, ingen servere */
const pl = await p.evaluate(async (SERV) => {
  const out = {};
  const info = (c) => { const R = c.shadowRoot; return { title: R.querySelector('.ttl .tx').textContent, pil: !!R.querySelector('.ttl .pil'), sub2: R.querySelector('.sub2') ? R.querySelector('.sub2').textContent.replace(/\s+/g, ' ').trim() : null, svv: !!R.querySelector('.svv'), svvIc: R.querySelector('.svv .pil ha-icon') ? R.querySelector('.svv .pil ha-icon').style.getPropertyValue('--mdc-icon-size') || R.querySelector('.svv .pil ha-icon').getAttribute('style') : null, svn: !!R.querySelector('.svn') }; };
  const h = window.mockHass(); h.user = { ...(h.user || {}), name: 'Ola Nordmann' };
  out.tittel = info(await __mk({ servere: SERV, server_plass: 'tittel' }, 'strömstad', h));
  out.tittelServer = info(await __mk({ servere: SERV, server_plass: 'tittel', greeting: 'Hei {name} på {server}' }, 'Toten', h));
  out.navn = info(await __mk({ servere: SERV }, 'Oslo', h));
  out.under = info(await __mk({ servere: SERV, server_plass: 'under', mode: 'hjem' }, 'Oslo', h));
  __c.shadowRoot.querySelector('.svv').click(); await __w(400); out.underMenu = !!__menu();
  out.underRot = __c.shadowRoot.querySelector('.svv .pil').classList.contains('apen');
  __menu().shadowRoot.querySelector('.vern').click(); await __w(200);
  // trykk på hilsenen i «under» åpner IKKE menyen (det er stedsnavnet som er knappen)
  __c.shadowRoot.querySelector('.ttl').click(); await __w(400); out.underTitle = !!__menu(); __menu() && __menu().remove();
  out.undertekst = info(await __mk({ servere: SERV, mode: 'hjem', undertekst: '{temp} • {vaer} · {server}' }, 'Oslo', h));
  out.undertekstTxt = __c.shadowRoot.querySelector('.sub').textContent;
  // ingen servere → ingen meny og ingen pil (stedsnavn som ren tekst)
  out.none = info(await __mk({ mode: 'sted' }, 'Oslo', h));
  __c.shadowRoot.querySelector('.ttl').click(); await __w(400); out.noneMenu = !!__menu();
  out.noneUnder = info(await __mk({ server_plass: 'under' }, 'Oslo', h));
  return out;
}, SERV);
ok('tittel: stedsnavnet (gjenkjent med ö) er den store linja + pil', pl.tittel.title === 'Strömstad' && pl.tittel.pil, pl.tittel);
ok('tittel med {server} i hilsenen: hilsenen beholdes', pl.tittelServer.title === 'Hei Ola på Toten', pl.tittelServer);
ok('navn (Hilsen): hilsenen med pil, ingen stedsnavn', /Ola/.test(pl.navn.title) && pl.navn.pil && pl.navn.sub2 == null, pl.navn);
ok('under: hilsen som før, stedsnavn + liten pil (20 px) og «•» før været på linja under', !/Oslo/.test(pl.under.title) && !pl.under.pil && pl.under.svv && /^Oslo\s*•\s*\S/.test(pl.under.sub2 || '') && /20px/.test(pl.under.svvIc || ''), pl.under);
ok('under: stedsnavnet åpner menyen (pila roterer), hilsenen gjør ikke', pl.underMenu && pl.underRot && !pl.underTitle, [pl.underMenu, pl.underRot, pl.underTitle]);
ok('undertekst med {temp} {vaer} {server}', /°C/.test(pl.undertekstTxt) && /Oslo$/.test(pl.undertekstTxt), pl.undertekstTxt);
ok('ingen servere: ingen pil og ingen meny, stedsnavnet som ren tekst', pl.none.title === 'Oslo' && !pl.none.pil && !pl.noneMenu, pl.none);
ok('ingen servere + under: stedsnavn som ren tekst (ingen knapp)', pl.noneUnder.svn && !pl.noneUnder.svv, pl.noneUnder);

/* ------------------------------------------------------------ 5 · migrering (les begge + skriv én gang) og editor */
const mg2 = await p.evaluate(async () => {
  const M = MSH, out = {};
  const c = await __mk({ servers: [{ name: 'Oslo', icon: 'mdi:office-building', color: 'var(--green)' }, { name: 'Toten', icon: 'mdi:tractor', color: 'var(--yellow)', path: 'lovelace/gard' }], servers_init: true, title_actions: { tap: 'server', double_tap: 'none', hold: 'kiosk' } }, 'Toten');
  c.shadowRoot.querySelector('.ttl').click(); await __w(400);
  out.oldMenu = __menu() ? [...__menu().shadowRoot.querySelectorAll('.rad:not(.tilpass) .navn')].map((x) => x.textContent) : null;
  out.oldHere = __menu() ? __menu().shadowRoot.querySelector('.rad.na .navn').textContent : null;
  __menu() && __menu().shadowRoot.querySelector('.rad:not(.na)').click(); await __w(200);
  out.oldUrl = __open[__open.length - 1];
  // én skriving til ki-store
  const keep = M.store, sets = [];
  M.store = { loaded: true, rev: 1, set: (k, v) => { sets.push([k.split('.').pop(), v === undefined ? '∅' : Array.isArray(v) ? v.map((x) => x.navn).join() : typeof v === 'object' ? JSON.stringify(v) : v]); }, get: () => undefined, subscribe: () => () => {}, card: () => null, data: {} };
  try {
    document.getElementById('dash').innerHTML = '';
    const d = document.createElement('msh-hjem-header-card');
    d.setConfig({ type: 'custom:msh-hjem-header-card', card_id: 'hd_mig', servers: [{ name: 'Oslo' }, { name: 'Bergen' }], servers_init: true, this_server: { name: 'Bergen' } }); d.hass = window.mockHass();
    document.getElementById('dash').appendChild(d);
    await __w(300); d.update(); await __w(200); d.update(); await __w(100);
  } finally { M.store = keep; }
  out.sets = sets;
  // editor (samme skjema i Tilpass header og getConfigElement)
  const ed = c.constructor.getConfigElement(); ed.hass = c.hass;
  ed.setConfig({ type: 'custom:msh-hjem-header-card', card_id: 'hd_ed', servers: [{ name: 'Bergen', path: 'hytta' }], servers_init: true, title_actions: { tap: 'server', double_tap: 'config', hold: 'kiosk' } });
  document.body.appendChild(ed); await __w(200);
  const chg = []; ed.addEventListener('config-changed', (e) => chg.push(e.detail.config));
  const R = ed.shadowRoot;
  const sec = R.querySelector('details[data-focus="servers"]'); if (sec) { sec.open = true; await __w(100); }
  out.edRows = [...R.querySelectorAll('[data-key^="servere-"] .xrh b')].map((x) => x.textContent);
  const ob = R.querySelector('[data-a="x-ropen"][data-n="servere"][data-i="0"]'); if (ob) { ob.click(); await __w(100); }
  out.fields = ['navn', 'server', 'ikon', 'farge', 'sti'].map((f) => !!R.querySelector(`[data-name="servere.0.${f}"]`));
  out.top = ['server_navn', 'server_sti', 'server_plass', 'server_meny_med'].map((f) => !!R.querySelector(`[data-name="${f}"]`));
  out.oldFields = !!R.querySelector('[data-name^="servers."]') || !!R.querySelector('[data-name="this_server.name"]');
  const add = R.querySelector('[data-a="x-radd"][data-n="servere"]'); if (add) { add.click(); await __w(100); }
  const last = chg[chg.length - 1] || {};
  out.added = { servere: (last.servere || []).length, old: 'servers' in last || 'title_actions' in last };
  // Handlinger på tittelen: trykk → Kiosk (menyen flyttes bort), hold → Bytt sted
  const sel = (g) => R.querySelector(`select[data-tact="${g}"]`);
  const pick = async (g, v) => { const s = sel(g); s.value = v; s.dispatchEvent(new Event('change', { bubbles: true })); await __w(100); };
  out.selVals = ['tap', 'double_tap', 'hold'].map((g) => sel(g) && sel(g).value);
  await pick('tap', 'kiosk');
  let l2 = chg[chg.length - 1] || {};
  out.tapKiosk = { act: l2.greeting_tap_action, meny: l2.server_meny_med };
  await pick('hold', 'server');
  l2 = chg[chg.length - 1] || {};
  out.holdServer = { meny: l2.server_meny_med, tap: l2.greeting_tap_action && l2.greeting_tap_action.action };
  out.selVals2 = ['tap', 'double_tap', 'hold'].map((g) => sel(g) && sel(g).value);
  ed.remove();
  return out;
});
ok('eldre servers/title_actions leses: menyen viser stedene, «Du er her» fra location_name', JSON.stringify(mg2.oldMenu) === '["Oslo","Toten"]' && mg2.oldHere === 'Toten' && /^homeassistant:\/\/navigate\/ki-dashboard\?server=Oslo$/.test(mg2.oldUrl || ''), mg2);
const sk = Object.fromEntries(mg2.sets);
ok('migrering skrives til ki-store én gang (servere, server_navn, gamle nøkler fjernes)', sk.servere === 'Oslo,Bergen' && sk.server_navn === 'Bergen' && sk.servers === '∅' && sk.servers_init === '∅' && sk.this_server === '∅' && mg2.sets.filter((x) => x[0] === 'servere').length === 1, mg2.sets);
ok('editor: Steder viser migrerte rader (servere) med felt navn/server/ikon/farge/sti', mg2.edRows.join() === 'Bergen' && mg2.fields.every(Boolean), [mg2.edRows, mg2.fields]);
ok('editor: server_navn, server_sti, server_plass, server_meny_med; ingen gamle felt', mg2.top.every(Boolean) && !mg2.oldFields, [mg2.top, mg2.oldFields]);
ok('editor: legg til sted lagrer servere uten gamle nøkler', mg2.added.servere === 2 && !mg2.added.old, mg2.added);
ok('editor: Handlinger på tittelen viser meny/innstillinger/kiosk', mg2.selVals.join() === 'server,config,kiosk', mg2.selVals);
ok('editor: trykk → Kiosk skriver greeting_tap_action og flytter menyen bort', mg2.tapKiosk.act && mg2.tapKiosk.act.action === 'kiosk' && mg2.tapKiosk.meny === 'ingen', mg2.tapKiosk);
ok('editor: hold → Bytt sted skriver server_meny_med hold', mg2.holdServer.meny === 'hold' && mg2.holdServer.tap === 'kiosk' && mg2.selVals2.join() === 'kiosk,config,server', [mg2.holdServer, mg2.selVals2]);
ok('ingen sidefeil (430)', !p.__errs.length, p.__errs);
await p.close();

/* ------------------------------------------------------------ 6 · touch, plassmangel, lys + mørk */
p = await page(360, true);
const th = await p.evaluate(async () => {
  const out = {};
  const c = await __mk({ servere: 'Oslo, Strömstad=Strømstad, Toten', mode: 'hjem', server_navn: 'Strömstad og omegn hytteforening' }, 'Oslo');
  await __w(300);
  const R = c.shadowRoot, tx = R.querySelector('.ttl .tx');
  out.narrow = { upil: !!R.querySelector('.hd.upil'), pilVis: getComputedStyle(R.querySelector('.ttl .pil')).display, fs: parseFloat(getComputedStyle(tx).fontSize), cut: tx.scrollWidth > tx.clientWidth + 1 };
  const c2 = await __mk({ servere: 'Oslo, Strömstad=Strømstad, Toten', mode: 'hjem' }, 'Oslo');
  await __w(300);
  out.wide = { upil: !!c2.shadowRoot.querySelector('.hd.upil'), fs: parseFloat(getComputedStyle(c2.shadowRoot.querySelector('.ttl .tx')).fontSize) };
  return out;
});
ok('plassmangel (Hjem, 360 px): pila skjules først, teksten krymper til min. 85 % og kortes med …', th.narrow.upil && th.narrow.pilVis === 'none' && th.narrow.fs >= 30 * 0.85 - 0.2 && th.narrow.fs < 30, th.narrow);
ok('kort navn: pila vises, full størrelse', !th.wide.upil && th.wide.fs === 30, th.wide);
// touch: trykk på tittelen åpner menyen (click, ikke pointerup – menyen lukkes ikke igjen av samme trykk)
const box = await p.evaluate(() => { const r = __c.shadowRoot.querySelector('.ttl .tx').getBoundingClientRect(); return { x: r.left + 10, y: r.top + r.height / 2 }; });
await p.touchscreen.tap(box.x, box.y); await p.waitForTimeout(450);
const tt = await p.evaluate(() => !!__menu());
ok('touch: trykk åpner menyen og den blir stående', tt);
const theme = async () => p.evaluate(() => {
  const S = __menu().shadowRoot, meny = S.querySelector('.meny'), na = S.querySelector('.rad.na'), her = S.querySelector('.her'), navn = S.querySelector('.rad .navn'), flis = S.querySelector('.rad:not(.na) .flis'), topp = S.querySelector('.topp');
  const cs = (e, k) => getComputedStyle(e)[k];
  return { bg: cs(meny, 'backgroundColor'), fg: cs(navn, 'color'), topp: cs(topp, 'color'), herBg: cs(her, 'backgroundColor'), herFg: cs(her, 'color'), naIc: cs(na.querySelector('.flis'), 'color'), flisFg: cs(flis, 'color'), flisBg: cs(flis, 'backgroundColor') };
});
const dark = await theme();
await p.evaluate(async () => { __menu().shadowRoot.querySelector('.vern').click(); await __w(250); const h2 = { ...__H, themes: { ...__H.themes, darkMode: false } }; __c.hass = h2; await __w(300); __c.shadowRoot.querySelector('.ttl').click(); await __w(400); });
const light = await theme();
const lum = (c) => { const m = String(c).match(/[\d.]+/g).map(Number); return (0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2]) / 255; };
ok('mørk: ark gray200 (#3a3a3a), lys tekst, «Du er her» mørk tekst på farge', dark.bg === 'rgb(58, 58, 58)' && lum(dark.fg) > 0.9 && lum(dark.herFg) < 0.2 && lum(dark.naIc) < 0.2, dark);
ok('lys: hvitt ark, mørk tekst og overskrift, «Du er her» mørk tekst, flis-ikon mørknet', light.bg === 'rgb(255, 255, 255)' && lum(light.fg) < 0.15 && lum(light.topp) < 0.45 && lum(light.herFg) < 0.2 && lum(light.flisFg) < lum(dark.flisFg), light);
ok('ingen sidefeil (360 touch)', !p.__errs.length, p.__errs);
await p.close();
await b.close();
res.forEach((x) => console.log(x));
const bad = res.filter((x) => x.startsWith('✘')).length;
console.log(bad ? `server37-check: ${bad} FEIL` : `server37-check: OK (${res.length})`);
process.exit(bad ? 1 : 0);
