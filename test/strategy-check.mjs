// Strategi custom:ki-dashboard mot ekte Bubble Card: generering, nytt område, editorene, lagring i ki-store.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readdirSync, existsSync } from 'node:fs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const BC = resolve('test/.vendor/bubble-card.js');
if (!existsSync(BC)) execFileSync('curl', ['-sSL', '-o', BC, 'https://raw.githubusercontent.com/Clooos/Bubble-Card/main/dist/bubble-card.js']);
const bundle = resolve(`test/.build/strategy-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
let fail = 0;
for (const vp of [{ n: 'mobil', w: 390, h: 844, sb: 0 }, { n: 'PC', w: 1400, h: 900, sb: 256 }]) {
  const p = await b.newPage({ viewport: { width: vp.w, height: vp.h } });
  if (process.env.DBG) p.on('console', (m) => { console.log('  ·', m.type(), m.text().slice(0,150)); });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/ERR_|CORS|bubble-modules|Failed to/.test(m.text())) errs.push(m.text().slice(0, 160)); });
  await p.goto('file://' + resolve('test/harness-bubble.html'));
  for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
  await p.addScriptTag({ path: bundle });
  await p.addScriptTag({ path: BC, type: 'module' });
  await p.waitForFunction(() => customElements.get('bubble-card'));
  const r = await p.evaluate(async (vp) => {
    const wait = (ms) => new Promise((q) => setTimeout(q, ms));
    document.documentElement.style.setProperty('--sb', vp.sb + 'px');
    const hass = window.mockHass();
    const S = customElements.get('ll-strategy-dashboard-ki-dashboard');
    const res = {};
    console.log('STEG const dash = await S'); const dash = await S.generate({}, hass);
    const v = dash.views[0], stack = v.cards[0];
    const pops = stack.cards.filter((c) => c.card_type === 'pop-up');
    res.shape = `views=${dash.views.length} panel=${v.panel} cards=${v.cards.length} stack=${stack.type}`;
    res.first = stack.cards.slice(0, 2).map((c) => c.type.replace('custom:', '')).join(',');
    res.popups = pops.map((x) => x.hash).join(' ');
    res.oneCardEach = pops.every((x) => x.cards.length === 1);
    res.navbar = JSON.stringify({ bar: stack.cards[1].bar, more: stack.cards[1].more });
    console.log('STEG // nytt område'); // nytt område → ny popup
    hass.areas.loft = { area_id: 'loft', name: 'Loft', icon: 'mdi:home-roof', floor_id: 'andre' };
    window.mockExtend(({ add }) => add('light.loft_tak', 'off', { friendly_name: 'Loft tak' }, { area: 'loft' }));
    const dash2 = await S.generate({}, hass);
    res.newArea = dash2.views[0].cards[0].cards.some((c) => c.hash === '#loft');
    res.excluded = !(await S.generate({ exclude_areas: ['loft'] }, hass)).views[0].cards[0].cards.some((c) => c.hash === '#loft');
    console.log('STEG // #ruter uten entur'); // Fiks 12: popupen lages når navbar/flis/snarvei peker dit, nøyaktig én
    const M0 = window.MSH;
    const h0 = { ...hass, states: Object.fromEntries(Object.entries(hass.states).filter(([id]) => !/entur|ruter_avvik/.test(id))) };
    const nR = (d) => d.views[0].cards[0].cards.filter((c) => c.hash === '#ruter');
    const g0 = await S.generate({}, h0), r0 = nR(g0);
    const gHid = await S.generate({ navbar: { hidden: ['ruter'] } }, h0);
    const gFlis = await S.generate({ navbar: { hidden: ['ruter'] }, home: { cards: { faner: { links: { l01: { title: 'Buss', hash: '#ruter' } } } } } }, h0);
    const gNavEgen = await S.generate({ navbar: { hidden: ['ruter'], buttons: { buss: { custom: true, label: 'Buss', icon: 'directions_bus', hash: 'ruter' } } } }, h0);
    const gYaml = await S.generate({ custom_popups: [{ type: 'custom:bubble-card', card_type: 'pop-up', hash: 'ruter', name: 'Ruter YAML', cards: [] }] }, h0);
    const gAv = await S.generate({ popups: { ruter: false } }, h0);
    res.ruter = {
      utenEntur: r0.length === 1 && r0[0].icon === 'mdi:bus' && r0[0].name === 'Ruter' && r0[0].bg_opacity === '98' && r0[0].bg_blur === '5' && r0[0].cards.length === 1 && r0[0].cards[0].type === 'custom:msh-ruter-card',
      iNavbar: [...g0.views[0].cards[0].cards[1].bar, ...g0.views[0].cards[0].cards[1].more].includes('ruter'),
      skjultNavbarIngenRef: nR(gHid).length === 0,
      flisSnarvei: nR(gFlis).length === 1,
      egenNavKnapp: nR(gNavEgen).length === 1,
      yamlKollisjonEn: nR(gYaml).length === 1 && nR(gYaml)[0].name === 'Ruter YAML',
      popupsFalse: nR(gAv).length === 0,
      medEntur: nR(await S.generate({ navbar: { hidden: ['ruter'] } }, hass)).length === 1,
    };
    await S.generate({}, hass); // tilbake til full generering (MSH.popupReport)
    console.log('STEG // render stacken'); // render stacken (panel = ett kort) og test popups
    const root = document.getElementById('dash');
    for (const c of stack.cards) { const tag = c.type.replace('custom:', ''); const el = document.createElement(tag); el.setConfig(c); el.hass = hass; root.appendChild(el); }
    await wait(700);
    const all = () => { const o = []; const w = (x) => x.querySelectorAll('*').forEach((e) => { o.push(e); if (e.shadowRoot) w(e.shadowRoot); }); w(document); return o; };
    const opened = [];
    for (const pp of pops) {
      console.log('pop '+pp.hash); location.hash = pp.hash; await wait(900);
      const pe = all().find((e) => e.classList && e.classList.contains('bubble-pop-up') && e.classList.contains('is-popup-opened'));
      const cards = pe ? [...pe.querySelectorAll('*')].filter((e) => /^msh-.*-card$/.test(e.localName)) : [];
      const hd = pe && pe.querySelector('.bubble-header-container');
      opened.push(`${pp.hash}:${pe ? 'åpen' : 'LUKKET'}/${cards.length}kort/${hd && hd.getBoundingClientRect().height > 0 ? 'header' : 'INGEN-HEADER'}/${cards[0] && cards[0].getBoundingClientRect().height > 40 ? 'innhold' : 'TOMT'}`);
      history.replaceState(null, '', location.pathname); window.dispatchEvent(new Event('hashchange')); await wait(400);
    }
    res.opened = opened;
    console.log('STEG // editorene via bus'); // editorene via bussen
    const ed = [];
    const ovRoot = document.querySelector('ki-overlay-root');
    for (const [e, extra] of [['home', {}], ['navbar', {}], ['header', {}], ['room', { area: 'stue' }]]) {
      window.MSH.portals().forEach((x) => x.remove());
      console.log('editor '+e); window.dispatchEvent(new CustomEvent('ki-open-editor', { detail: { editor: e, ...extra } }));
      await wait(500);
      const ps = window.MSH.portals(), pr = ps[0] && ps[0].getBoundingClientRect();
      const sheet = ps[0] && ps[0].shadowRoot.querySelector('.sh');
      const sr = sheet && sheet.getBoundingClientRect();
      const z = document.querySelector('ki-overlay-root') ? getComputedStyle(document.querySelector('ki-overlay-root')).zIndex : '–';
      ed.push(`${e}:${ps.length ? 'åpen' : 'IKKE'} z=${z} x=${pr ? Math.round(pr.left) : '–'} ark=${sr ? Math.round(sr.width) : '–'}px`);
    }
    res.editors = ed;
    window.MSH.portals().forEach((x) => x.remove());
    console.log('STEG // lagring fra'); // lagring fra «Tilpass rom» → ki-store, ingen Lovelace-lagring/navigering
    window.__calls.length = 0;
    location.hash = '#stue'; await wait(900);
    window.dispatchEvent(new CustomEvent('ki-open-editor', { detail: { editor: 'room', area: 'stue' } })); await wait(400);
    const edEl = window.MSH.portals().pop().shadowRoot.querySelector('msh-editor');
    [...edEl.shadowRoot.querySelectorAll('.pill')].find((x) => /Luftig 18/.test(x.textContent)).click();
    await wait(1200);
    res.saveCalls = window.__calls.filter((c) => c[0] === 'ws' && /lovelace\/config\/save|frontend\/set_user_data/.test(c[1])).map((c) => c[1]).join(',');
    res.storeGap = (((window.__userData.ki_dashboard || {}).rooms || {}).stue || {}).gap; // «Tilpass rom» lagres per område
    const rom = all().find((e) => e.localName === 'msh-rom-card' && e.isConnected && e.getBoundingClientRect().height > 0);
    res.liveGap = rom && rom._rawConfig.gap;
    res.hashAfter = location.hash;
    res.editorStillOpen = window.MSH.portals().length > 0;

    console.log('STEG // egne popups'); // tre kilder, overstyringer, false-skjuling og kollisjon
    const M = window.MSH;
    M.portals().forEach((x) => x.remove());
    const Y = (hash, name, cards, extra) => ({ type: 'custom:bubble-card', card_type: 'pop-up', hash, name, icon: 'mdi:star', cards: cards || [{ type: 'custom:msh-soppel-card' }], ...(extra || {}) });
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const cfgY = {
      custom_popups: [Y('#verksted', 'Verksted', [{ type: 'custom:msh-soppel-card' }, { type: 'custom:msh-strompris-card' }], { width_desktop: '600px', bg_color: '#123456', ukjent_valg: { liste: [1, 'to'] } }), Y('#vaer', 'Vær YAML')],
      popup_overrides: { '#media': { replace: true, config: Y('#media', 'Media egen', [{ type: 'custom:msh-soppel-card' }], { card_layout: 'normal' }) }, '#basseng': false, '#klima': { name: 'Klimaet', width_desktop: '620px', color: 'var(--red)' } },
    };
    const egen = Y('#egen', 'Egen', [{ type: 'custom:msh-soppel-card' }, { type: 'custom:msh-soppel-card', popup_hash: '#x' }], { styles: '.bubble-name {color: red}\n', close_by_clicking_outside: false });
    M.store.set('custom_popups', [egen, Y('#verksted', 'Kolliderer')]);
    M.store.set('popup_overrides', { '#lys': { replace: true, config: Y('#lys', 'Lys egen') } });
    await M.store.save();
    const d3 = await S.generate(cfgY, hass);
    const st3 = d3.views[0].cards[0], p3 = st3.cards.filter((c) => c.card_type === 'pop-up'), by = (h) => p3.filter((c) => c.hash === h);
    const R3 = M.popupReport, col = (h) => R3.collisions.find((c) => c.hash === h);
    const ent = (h) => R3.entries.find((e) => e.hash === h);
    res.merge = {
      unik: new Set(p3.map((c) => c.hash)).size === p3.length,
      yamlUendret: by('#verksted').length === 1 && same(by('#verksted')[0], cfgY.custom_popups[0]),
      yamlSlaarAuto: by('#vaer').length === 1 && by('#vaer')[0].name === 'Vær YAML',
      kollisjoner: !!(col('#verksted') && col('#verksted').winner === 'yaml' && col('#verksted').losers.join() === 'custom' && col('#vaer') && col('#vaer').winner === 'yaml' && col('#vaer').losers.join() === 'auto'),
      falseSkjuler: by('#basseng').length === 0 && ent('#basseng').hidden && ent('#basseng').hiddenBy === 'yaml' && !JSON.stringify([st3.cards[1].bar, st3.cards[1].more]).includes('basseng'),
      replace: same(by('#media')[0], cfgY.popup_overrides['#media'].config),
      deepMerge: by('#klima')[0].name === 'Klimaet' && by('#klima')[0].width_desktop === '620px' && /var\(--red\)/.test(by('#klima')[0].styles) && by('#klima')[0].cards.length === 1 && by('#klima')[0].cards[0].type === 'custom:msh-klima-card' && ent('#klima').override === 'merge',
      kiStoreUendret: same(by('#egen')[0], egen),
      storeOverride: same(by('#lys')[0], M.popupReport.entries.find((e) => e.hash === '#lys').config) && by('#lys')[0].name === 'Lys egen' && ent('#lys').overrideFrom === 'store',
      rekkefolge: p3.map((c) => c.hash).slice(-3).join() === '#verksted,#vaer,#egen',
      allPopups: ['#egen', '#verksted', '#stue'].every((h) => M.allPopups(hass).some((x) => x.hash === h)) && !M.allPopups(hass).some((x) => x.hash === '#basseng'),
    };

    console.log('STEG // levende oppdatering'); // ki-store endres → popups i DOM oppdateres, åpen popup forblir åpen
    location.hash = '#stue'; await wait(900);
    const openNow = (h) => all().some((e) => e.localName === 'bubble-card' && (e.config || e._config || {}).hash === h && e.shadowRoot && [...e.shadowRoot.querySelectorAll('*')].concat([...e.querySelectorAll('*')]).some((x) => x.classList && x.classList.contains('is-popup-opened')))
      || all().some((x) => x.classList && x.classList.contains('bubble-pop-up') && x.classList.contains('is-popup-opened') && ((x.getRootNode().host || {}).config || {}).hash === h);
    const liveHash = (h) => M.liveBubbles().filter((x) => x.cfg.hash === h).length;
    const stueOpen0 = !!all().find((e) => e.classList && e.classList.contains('is-popup-opened'));
    M.store.set('custom_popups', [egen, Y('#live', 'Live', [{ type: 'custom:msh-soppel-card' }])]);
    await wait(1400);
    const opened2 = all().filter((e) => e.classList && e.classList.contains('bubble-pop-up') && e.classList.contains('is-popup-opened'));
    res.live = { lagt: liveHash('#live') === 1, fjernet: liveHash('#basseng') === 0, egenBeholdt: liveHash('#egen') === 1, stueFortsattAapen: stueOpen0 && opened2.length === 1 && location.hash === '#stue' };
    history.replaceState(null, '', location.pathname); window.dispatchEvent(new Event('hashchange')); await wait(500);
    location.hash = '#live'; await wait(900);
    const pl = all().find((e) => e.classList && e.classList.contains('bubble-pop-up') && e.classList.contains('is-popup-opened'));
    res.live.aapnesViaHash = !!pl && [...pl.querySelectorAll('*')].some((e) => e.localName === 'msh-soppel-card');
    history.replaceState(null, '', location.pathname); window.dispatchEvent(new Event('hashchange')); await wait(500);

    console.log('STEG // popup-editor'); // «Tilpass Hjem» → Popups
    window.dispatchEvent(new CustomEvent('ki-open-editor', { detail: { editor: 'home', focus: 'pop' } })); await wait(700);
    const edRoot = () => { const p = M.portals().pop(); return p && p.shadowRoot; };
    const q = (s) => edRoot().querySelector(s), qa = (s) => [...edRoot().querySelectorAll(s)];
    const act = async (a, v) => { const b = qa(`[data-a="${a}"]`).find((x) => v == null || x.dataset.v === v); if (!b) throw new Error('mangler knapp ' + a + ' ' + (v || '')); b.click(); await wait(250); };
    const type = async (t) => { const ta = q('.ppcode textarea'); ta.value = t; ta.dispatchEvent(new Event('input', { bubbles: true })); await wait(350); };
    const chips = qa('.ppr .ppchip').map((x) => x.textContent);
    const E = { rader: qa('.ppr').length, chips: ['Auto', 'YAML', 'Egen', 'Overstyrt'].every((c) => chips.includes(c)), grupper: qa('.ppgh').map((x) => x.textContent).join('·'), advarsler: qa('.ppwarn').length };
    await act('ppnew'); await act('pptpl', 'tom'); await act('ppcreate');
    E.nyEditor = !!q('.ppcode textarea') && !!q('.ppgut');
    const nyTekst = q('.ppcode textarea').value;
    E.nyHashUnik = /hash: '#ny-popup'/.test(nyTekst);
    const nm = q('[data-in="ppname"]'); nm.value = 'Min popup'; nm.dispatchEvent(new Event('input', { bubbles: true })); await wait(300);
    E.navnHashSynk = /name: Min popup/.test(q('.ppcode textarea').value) && /hash: '#min-popup'/.test(q('.ppcode textarea').value);
    await type("type: custom:bubble-card\ncard_type: pop-up\nhash: '#feil\nname: X\n");
    E.syntaksFeil = /Linje 3/.test(q('.pperrw').textContent) && q('[data-key="ppsave"]').disabled && !!q('.ppgut .bad');
    await type("type: custom:bubble-card\ncard_type: pop-up\nhash: '#stue'\nname: X\n");
    E.duplikat = /Linje 3/.test(q('.pperrw').textContent) && /i bruk/.test(q('.pperrw').textContent) && q('[data-key="ppsave"]').disabled;
    await type("type: custom:bubble-card\ncard_type: popup\nhash: '#ok'\n");
    E.cardType = /Linje 2/.test(q('.pperrw').textContent) && q('[data-key="ppsave"]').disabled;
    const minYaml = "# egen kommentar\ntype: custom:bubble-card\ncard_type: pop-up\nhash: '#minpopup'\nname: Min popup\nicon: mdi:rocket\nbg_opacity: '70'\ncards:\n  - type: custom:msh-soppel-card\n  - type: custom:msh-strompris-card\n";
    await type(minYaml);
    E.gyldig = !q('[data-key="ppsave"]').disabled && !q('.pperrw').textContent.trim();
    await act('ppmode', 'form');
    E.skjema = !!q('[data-in="ppf"][data-f="bg_opacity"]') && q('[data-in="ppf"][data-f="name"]').value === 'Min popup';
    const wd = q('[data-in="ppf"][data-f="width_desktop"]'); wd.value = '700px'; wd.dispatchEvent(new Event('change', { bubbles: true })); await wait(250);
    await act('ppmode', 'yaml');
    E.skjemaTilYaml = /width_desktop: 700px/.test(q('.ppcode textarea').value);
    await act('ppsave'); await wait(1400);
    const cp = M.store.get('custom_popups') || [];
    const mine = cp.find((c) => c.hash === '#minpopup');
    E.lagret = !!mine && mine.cards.length === 2 && mine.bg_opacity === '70' && mine.width_desktop === '700px';
    E.levende = liveHash('#minpopup') === 1;
    E.velgbar = M.popupOptions(hass).some(([h]) => h === '#minpopup');
    // strategi-YAML skrivebeskyttet + kopier til Egne
    await act('ppopen', '#verksted');
    E.yamlSkrivebeskyttet = q('.ppcode textarea').readOnly && !q('[data-key="ppsave"]') && /rå konfigurasjon/.test(q('.ppnote').textContent) && !!q('[data-a="ppclone"]');
    await act('ppclone');
    E.kopiTilEgne = /hash: '#verksted-kopi'/.test(q('.ppcode textarea').value) && !q('[data-key="ppsave"]').disabled;
    await act('ppback');
    // overstyr auto-popup via YAML, så tilbakestill
    await act('ppopen', '#kamera'); await act('ppmode', 'yaml');
    await type(q('.ppcode textarea').value.replace(/^name: .*$/m, 'name: Kamera 2'));
    await act('ppsave'); await wait(1400);
    const ov = (M.store.get('popup_overrides') || {})['#kamera'];
    E.overstyrt = !!ov && ov.replace === true && ov.config.name === 'Kamera 2' && qa('.ppr').some((r) => /Kamera 2/.test(r.textContent) && /Overstyrt/.test(r.textContent));
    await act('ppopen', '#kamera'); await act('ppreset'); await wait(1200);
    E.tilbakestilt = !(M.store.get('popup_overrides') || {})['#kamera'] && qa('.ppr').some((r) => /#kamera/.test(r.textContent) && /Auto/.test(r.textContent));
    // eksport
    await act('ppmenu'); await act('ppexport');
    E.eksport = /custom_popups:/.test(q('.ppcode textarea').value) && /popup_overrides:/.test(q('.ppcode textarea').value) && /#minpopup/.test(q('.ppcode textarea').value);
    await act('ppback');
    // dra for rekkefølge (egne: #egen, #live, #minpopup)
    const hed = M.openHomeEditor();
    const before = (M.store.get('custom_popups') || []).map((c) => c.hash).join();
    M.popupsPanel.drop(hed, { id: '0' }, { drop: 'pop:2', pos: 'b' }); await wait(300);
    E.rekkefolge = before === '#egen,#live,#minpopup' && (M.store.get('custom_popups') || []).map((c) => c.hash).join() === '#live,#minpopup,#egen';
    E.draHaandtak = qa('.ppr[data-drag="pop"] .pph').length === 3;
    // slett med bekreftelse
    await act('ppopen', '#minpopup'); await act('ppdelask');
    E.bekreft = !!q('[data-a="ppdel"]') && (M.store.get('custom_popups') || []).some((c) => c.hash === '#minpopup');
    await act('ppdel'); await wait(1200);
    E.slettet = !(M.store.get('custom_popups') || []).some((c) => c.hash === '#minpopup') && liveHash('#minpopup') === 0;
    // forhåndsvis uten lagring → tilbake til arket med utkastet
    await act('ppnew'); await act('pptpl', 'tom'); await act('ppcreate');
    await type("type: custom:bubble-card\ncard_type: pop-up\nhash: '#utkast'\nname: Utkast\ncards:\n  - type: custom:msh-soppel-card\n");
    await act('pppreview'); await wait(1300);
    const pv = all().find((e) => e.classList && e.classList.contains('bubble-pop-up') && e.classList.contains('is-popup-opened'));
    const pill = [...document.querySelector('ki-overlay-root').shadowRoot.querySelectorAll('button')].find((b) => /Tilbake til Tilpass/.test(b.textContent));
    E.forhandsvis = location.hash === '#utkast' && !!pv && !!pill && !(M.store.get('custom_popups') || []).some((c) => c.hash === '#utkast');
    pill.click(); await wait(900);
    E.tilbakeMedUtkast = !!edRoot() && /#utkast/.test((q('.ppcode textarea') || {}).value || '') && location.hash === '' && liveHash('#utkast') === 0;
    res.editor = E;
    M.portals().forEach((x) => x.remove());
    return res;
  }, vp);
  const hashes = r.popups.split(' '); const unique = new Set(hashes).size === hashes.length;
  const ok = !errs.length && unique && r.oneCardEach && r.newArea && r.excluded && r.opened.every((x) => /åpen\/1kort\/header\/innhold/.test(x)) && r.editors.every((x) => /åpen z=9000/.test(x)) && r.saveCalls === 'frontend/set_user_data' && r.storeGap === 18 && r.hashAfter === '#stue' && r.editorStillOpen
    && Object.values(r.ruter).every(Boolean) && Object.values(r.merge).every(Boolean) && Object.values(r.live).every(Boolean) && Object.values(r.editor).every((v) => v === true || typeof v === 'number' || typeof v === 'string');
  if (!ok) fail++;
  console.log(`${ok ? '✔' : '✘'} [${vp.n}]`, JSON.stringify(r, null, 1), errs.slice(0, 3).join(' | '));
  await p.close();
}
await b.close();
process.exit(fail ? 1 : 0);
