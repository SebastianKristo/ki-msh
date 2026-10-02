// Fiks 33.4 · Fanehøyde i alle popups med faner (felles MSH.tabH, 05-tab-bar.js) – ekte Bubble Card, 390 px, touch/mus.
// For hver popup med fanelinje:
//   · uten valg: popupens egen høyde (mørk modus som før)
//   · tab_height 32 / 44 / 56 og egen 60: pillen = H (to-linjers ikon over tekst = H + 16), tekst/ikon skalerer,
//     tannhjulet = sporets høyde, ingen fane kuttet i høyden
//   · «Følg global»: ui.popup_tab_height 44 → følger, endret til 50 → følger live (samme DOM, ingen ny tegning)
//   · egen verdi slår global; GUI-editoren (getConfigElement) har feltet (segment + slider 28–64) og skriver tab_height
//   · kortets eget Tilpass-ark har feltet; valg der vises live i popupen bak arket
//   · hold 400 ms + dra (mus) flytter fanen og glass-drag (sideveis dra uten hold) bytter fane i laveste og høyeste høyde
//   · lys modus: inaktiv fanetekst ≥ 4,5:1 mot sporet i 32 og 56 px
//   · overlever reload (ki-store: kortets tab_height og global verdi)
// + «Tilpass Hjem» → Faner → «Fanehøyde i popups» setter global verdi (utkast → Ferdig).
// Kjør: node test/fanehoyde33-check.mjs [Kalender …]
import { createRequire } from 'node:module';
import { readdirSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const R = resolve('.') + '/';
mkdirSync('test/.build', { recursive: true });
mkdirSync('test/.vendor', { recursive: true });
const BC = resolve('test/.vendor/bubble-card.js');
if (!existsSync(BC)) execFileSync('curl', ['-sSL', '-o', BC, 'https://raw.githubusercontent.com/Clooos/Bubble-Card/main/dist/bubble-card.js']);
const bundle = resolve(`test/.build/fh33-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const mocks = readdirSync(R + 'test/mock').filter((f) => f.endsWith('.js')).sort().map((f) => R + 'test/mock/' + f);

// [navn, tag, hash, ekstra config, fokus for Tilpass-arket, har tannhjul ved fanene]
const CARDS = [
  ['Kalender', 'msh-kalender-card', '#kalender', { tab_labels: 'name' }, 'faner', true],
  ['Stovsuger', 'msh-stovsuger-card', '#rolf', {}, 'faner', true],
  ['Server', 'msh-server-card', '#server', {}, 'visning', true],
  ['Avfall', 'msh-avfall-card', '#soppel', {}, 'faner', false],
  ['Varmepumpe', 'msh-varmepumpe-card', '#varmepumpe', {}, 'faner', true],
  ['Vanning', 'msh-vanning-card', '#vanning', { cog_position: 'tab' }, 'faner', true],
  ['Kamera', 'msh-kamera-card', '#kamera', {}, null, true],
  ['Innstillinger', 'msh-innstillinger-card', '#settings', {}, 'faner', true],
  ['Basseng', 'msh-basseng-card', '#mitt-basseng', {}, null, true],
  ['Lys', 'msh-lys-card', '#lys', {}, 'tabs', true],
  ['Klima', 'msh-klima-card', '#klima', {}, null, true],
  ['Media', 'msh-media-card', '#media', {}, 'faner', true],
  ['Tesla', 'msh-tesla-card', '#tesla', {}, 'faner', true],
];
const only = process.argv.slice(2);
const list = only.length ? CARDS.filter((c) => only.some((o) => c[0].toLowerCase() === o.toLowerCase())) : CARDS;

const browser = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = [];
let fails = 0;
const ok = (name, cond, info) => { if (!cond) fails++; res.push(`${cond ? '✔' : '✘'} ${name}${info != null ? ' · ' + JSON.stringify(info) : ''}`); };

async function open(tag, hash, extra, userData) {
  const page = await browser.newPage({ viewport: { width: 390, height: 800 }, hasTouch: false });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  if (userData) await page.addInitScript((u) => { window.__userData = u; }, userData);
  await page.goto('file://' + R + 'test/harness-bubble.html');
  for (const m of mocks) await page.addScriptTag({ path: m });
  await page.addScriptTag({ path: bundle });
  await page.addScriptTag({ path: BC, type: 'module' });
  await page.waitForFunction(() => customElements.get('bubble-card'), null, { timeout: 15000 });
  await page.evaluate(async ({ tag, hash, extra }) => {
    const wait = (ms) => new Promise((q) => setTimeout(q, ms));
    window.wait = wait;
    window.deepAll = (sel, root) => { const out = []; const walk = (r) => r.querySelectorAll('*').forEach((e) => { if (e.matches(sel)) out.push(e); if (e.shadowRoot) walk(e.shadowRoot); }); walk(root || document); return out; };
    window.H = window.mockHass(); window.H.themes = { ...(window.H.themes || {}), darkMode: true };
    if (window.MSH.store && window.MSH.store.load) await window.MSH.store.load(window.H);
    const bc = document.createElement('bubble-card');
    bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash, name: 'Test', icon: 'mdi:star', margin_top_mobile: '50px', bg_color: '#282828', bg_opacity: 100, bg_blur: 0, cards: [{ type: 'custom:' + tag, card_id: 'fh_' + tag, ...extra }] });
    bc.hass = window.H; document.getElementById('dash').appendChild(bc);
    await wait(400);
    location.hash = hash;
    await wait(1300);
    window.card = () => deepAll(tag).find((e) => e.getClientRects().length) || deepAll(tag)[0];
    window.T = () => { const c = card(); if (!c || !c.shadowRoot) return null; const row = [c.shadowRoot, ...deepAll('*', c.shadowRoot).filter((e) => e.shadowRoot).map((e) => e.shadowRoot)].flatMap((r) => [...r.querySelectorAll('*')]).find((e) => e.__tabReorder && e.getClientRects().length); return row ? row.__tabReorder : null; };
    window.popOpen = () => location.hash === hash && deepAll('.bubble-pop-up').some((p) => p.classList.contains('is-popup-opened'));
    window.bgOf = (el) => { for (let n = el; n; n = n.parentElement || (n.getRootNode && n.getRootNode().host)) { if (n.nodeType !== 1) continue; const P = window.MSH.theme.parse(getComputedStyle(n).backgroundColor); if (P && P[3] > 0.5) return getComputedStyle(n).backgroundColor; } return 'rgb(240, 240, 240)'; };
    // mål: aktiv fane (pille), spor, tannhjul, tekst, ikon
    window.meas = () => {
      const t = T(); if (!t) return null;
      const row = t.row, its = t.items(), act = its.find((b) => b.getAttribute('aria-selected') === 'true' || b.classList.contains('on')) || its[0];
      const pad = parseFloat(getComputedStyle(row).paddingTop) || 0;
      const track = pad > 0 ? row : row.parentElement;
      let gear = null;
      for (let n = row.parentElement, d = 0; n && d < 3 && !gear; n = n.parentElement, d++) gear = [...n.querySelectorAll('.gear,.mtb-g,.cfg,.tune,.mb,.cog-tab')].find((g) => g.getClientRects().length && !row.contains(g) && Math.abs(g.getBoundingClientRect().top + g.getBoundingClientRect().height / 2 - (track.getBoundingClientRect().top + track.getBoundingClientRect().height / 2)) < 4);
      const lab = act.querySelector('span:not(.mtb-ic):not(.ind)') || act;
      const ic = act.querySelector('ha-icon');
      const cut = its.filter((b) => b.scrollHeight > b.clientHeight + 1).length;
      return { h: Math.round(act.getBoundingClientRect().height), track: Math.round(track.getBoundingClientRect().height), gear: gear ? Math.round(gear.getBoundingClientRect().height) : null, gw: gear ? Math.round(gear.getBoundingClientRect().width) : null,
        fs: parseFloat(getComputedStyle(lab).fontSize), ic: ic ? Math.round(ic.getBoundingClientRect().height) : null, r: parseFloat(getComputedStyle(act).borderTopLeftRadius), cut, n: its.length, row };
    };
    // samme vei som kortets egen lagring (YAML + ki-store.cards.<card_id>)
    window.setCfg = async (patch) => { const c = card(); await Promise.race([window.MSH.mshPatchConfig(c, patch), wait(1500)]); await wait(350); };
  }, { tag, hash, extra });
  return { page, errs };
}

const near = (a, b, d = 1) => a != null && b != null && Math.abs(a - b) <= d;
const okH = (m, H) => m && (near(m.h, H) || near(m.h, H + 16));

for (const [name, tag, hash, extra, focus, hasGear] of list) {
  const { page, errs } = await open(tag, hash, extra);
  const r = await page.evaluate(async ({ hasGear }) => {
    const out = {};
    const M = window.MSH;
    const strip = (m) => { if (!m) return m; const { row, ...x } = m; return x; };
    out.native = strip(meas());
    out.sizes = {};
    for (const H of [32, 44, 56, 60]) { await setCfg({ tab_height: H }); out.sizes[H] = strip(meas()); }
    // «Følg global»
    await setCfg({ tab_height: undefined });
    M.tabH.setGlobal(44); await wait(300);
    const m44 = meas(); out.g44 = strip(m44);
    M.tabH.setGlobal(50); await wait(250);
    const m50 = meas(); out.g50 = strip(m50); out.sameDom = m44 && m50 && m44.row === m50.row;
    await setCfg({ tab_height: 32 }); out.ownOverGlobal = strip(meas());
    await setCfg({ tab_height: 'auto' }); out.autoStr = strip(meas());
    M.tabH.setGlobal(null); await setCfg({ tab_height: undefined }); out.back = strip(meas());
    // hold-flytt + glass i laveste/høyeste høyde (mus)
    out.drag = {};
    return out;
  }, { hasGear });
  const nat = r.native;
  ok(`${name}: fanelinje funnet (uten valg: egen høyde ${nat && nat.h} px)`, !!nat && nat.h > 20, nat);
  for (const H of [32, 44, 56, 60]) {
    const m = r.sizes[H];
    ok(`${name}: tab_height ${H} → pille ${H} px (to linjer: ${H + 16})${hasGear ? ', tannhjul = sporet' : ''}, ingen kutt`, okH(m, H) && (!hasGear || near(m.gear, m.track, 1)) && m.cut === 0 && m.track >= m.h, m);
  }
  const s32 = r.sizes[32], s56 = r.sizes[56];
  ok(`${name}: tekst/ikon/radius skalerer med høyden (32 → 56)`, s32 && s56 && s56.fs > s32.fs && (s32.ic == null || s56.ic > s32.ic) && s56.r > s32.r, { fs: [s32 && s32.fs, s56 && s56.fs], ic: [s32 && s32.ic, s56 && s56.ic], r: [s32 && s32.r, s56 && s56.r] });
  ok(`${name}: «Følg global» 44 → følger, 50 → følger live (samme DOM)`, okH(r.g44, 44) && okH(r.g50, 50) && r.sameDom, { g44: r.g44 && r.g44.h, g50: r.g50 && r.g50.h, same: r.sameDom });
  ok(`${name}: egen verdi (32) slår global; 'auto' = følg global; uten global tilbake til egen høyde`, okH(r.ownOverGlobal, 32) && okH(r.autoStr, 50) && r.back && r.back.h === nat.h, { own: r.ownOverGlobal && r.ownOverGlobal.h, auto: r.autoStr && r.autoStr.h, back: r.back && r.back.h, nat: nat && nat.h });

  // hold-flytt + glass (mus) i 32 og 56
  for (const H of [32, 56]) {
    await page.evaluate(async (H) => { await setCfg({ tab_height: H }); }, H);
    const before = await page.evaluate(() => { const t = T(); return t.items().map((b) => t.idOf(b)); });
    const pts = await page.evaluate(async () => { const t = T(), its = t.items(); its[0].scrollIntoView({ block: 'center', inline: 'nearest' }); t.row.scrollLeft = 0; await wait(150); const q = its[0].getBoundingClientRect(), rr = t.row.getBoundingClientRect(), l = its[its.length - 1].getBoundingClientRect(); return { a: { x: q.left + q.width / 2, y: q.top + q.height / 2 }, z: { x: Math.min(l.left + l.width / 2, rr.right - 14) }, n: its.length }; });
    await page.mouse.move(pts.a.x, pts.a.y); await page.mouse.down(); await page.waitForTimeout(520);
    for (let i = 1; i <= 10; i++) { await page.mouse.move(pts.a.x + ((pts.z.x - pts.a.x) * i) / 10, pts.a.y); await page.waitForTimeout(25); }
    await page.mouse.up(); await page.waitForTimeout(700);
    const after = await page.evaluate(() => { const t = T(); return { ids: t.items().map((b) => t.idOf(b)), open: popOpen() }; });
    ok(`${name} ${H} px: hold + dra flytter fanen, popupen er åpen`, after.open && after.ids.join() !== before.join() && after.ids.indexOf(before[0]) > 0, { before, after: after.ids, open: after.open });
    // glass: sideveis dra uten hold fra aktiv fane til nabofanen → bytter fane (når fanene får plass)
    const g = await page.evaluate(() => { const t = T(); const its = t.items(); const fit = t.row.scrollWidth <= t.row.clientWidth + 1; const act = its.findIndex((b) => b.getAttribute('aria-selected') === 'true' || b.classList.contains('on')); const j = act === 0 ? 1 : 0; const c = (b) => { const q = b.getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2 }; }; return { fit, a: c(its[act < 0 ? 0 : act]), b: c(its[j]), want: t.idOf(its[j]) }; });
    if (g.fit) {
      await page.mouse.move(g.a.x, g.a.y); await page.mouse.down();
      for (let i = 1; i <= 8; i++) { await page.mouse.move(g.a.x + ((g.b.x - g.a.x) * i) / 8, g.a.y); await page.waitForTimeout(20); }
      await page.mouse.up(); await page.waitForTimeout(700);
      const cur = await page.evaluate(() => { const t = T(); const b = t.items().find((x) => x.getAttribute('aria-selected') === 'true' || x.classList.contains('on')); return { act: b ? t.idOf(b) : null, open: popOpen() }; });
      ok(`${name} ${H} px: glass-drag (sideveis dra) velger fanen, popupen er åpen`, cur.act === g.want && cur.open, { want: g.want, ...cur });
    }
  }

  // lys modus: kontrast i 32 og 56
  const light = await page.evaluate(async () => {
    window.H = { ...window.H, themes: { ...(window.H.themes || {}), darkMode: false } };
    deepAll('*').filter((e) => e.localName === 'bubble-card' || /^msh-/.test(e.localName)).forEach((e) => { try { e.hass = window.H; } catch (x) { /* */ } });
    window.MSH.theme.set('light'); await wait(500);
    const out = {};
    for (const H of [32, 56]) {
      await setCfg({ tab_height: H });
      const t = T(), its = t.items().filter((b) => !(b.getAttribute('aria-selected') === 'true' || b.classList.contains('on')));
      out[H] = Math.min(...its.map((b) => { const l = b.querySelector('span:not(.mtb-ic)') || b; return window.MSH.theme.contrast(getComputedStyle(l).color, bgOf(t.row)); }));
      out['h' + H] = meas().h;
    }
    window.MSH.theme.set('dark'); window.H = { ...window.H, themes: { ...(window.H.themes || {}), darkMode: true } };
    deepAll('*').filter((e) => e.localName === 'bubble-card' || /^msh-/.test(e.localName)).forEach((e) => { try { e.hass = window.H; } catch (x) { /* */ } });
    await setCfg({ tab_height: undefined }); await wait(300);
    return out;
  });
  ok(`${name}: lys modus – høyden virker og inaktiv fanetekst ≥ 4,5:1 (32 og 56 px)`, light[32] >= 4.5 && light[56] >= 4.5 && okH({ h: light.h32 }, 32) && okH({ h: light.h56 }, 56), light);

  // GUI-editoren (getConfigElement): feltet finnes, segment + slider, skriver tab_height / fjerner den («Følg global»)
  const gui = await page.evaluate(async () => {
    const c = card(), cls = c.constructor, ed = cls.getConfigElement();
    document.body.appendChild(ed);
    ed.hass = window.H; ed.setConfig({ ...(c._rawConfig || {}) });
    await wait(300);
    const all = () => deepAll('[data-mth-field]', ed.shadowRoot || ed);
    let f = all()[0];
    // feltet kan ligge i en annen fane i skjemaet (type tabs) – bla gjennom fanene
    if (!f) for (const b of deepAll('[data-a="tab"]', ed.shadowRoot || ed)) { b.click(); await wait(150); f = all()[0]; if (f) break; }
    if (!f) return { found: false };
    const out = { found: true, chips: [...f.querySelectorAll('[data-mth]')].map((b) => b.textContent.trim().replace(/\s+/g, ' ')), range: !!f.querySelector('input[type=range][min="28"][max="64"]') || !!f.querySelector('ha-selector'), pv: !!f.querySelector('.mtb') || !!(ed.shadowRoot || ed).querySelector('.svp,.pvw,.tsp,[data-key="mtp"]') };
    let last = null; ed.addEventListener('config-changed', (e) => { last = e.detail.config; });
    f.querySelector('[data-mth="50"]').click(); await wait(200);
    out.set50 = last && last.tab_height;
    f = all()[0]; f.querySelector('[data-mth="auto"]').click(); await wait(200);
    out.auto = last ? (last.tab_height === undefined ? 'fjernet' : last.tab_height) : null;
    f = all()[0]; const rg = f.querySelector('input[data-mth-r]');
    if (rg) { rg.value = '61'; rg.dispatchEvent(new Event('input', { bubbles: true, composed: true })); rg.dispatchEvent(new Event('change', { bubbles: true, composed: true })); await wait(200); out.slider = last && last.tab_height; }
    ed.remove();
    return out;
  });
  ok(`${name}: GUI-editoren har «Fanehøyde» (Følg global · Lav 32 · Standard 38 · Middels 44 · Høy 50 · Ekstra 56 + slider 28–64) og skriver tab_height`, gui.found && gui.chips.length === 6 && /Følg global/.test(gui.chips[0]) && gui.range && gui.set50 === 50 && gui.auto === 'fjernet' && (gui.slider == null || gui.slider === 61), gui);

  // kortets eget Tilpass-ark: feltet finnes, valg vises live i popupen bak arket
  const sheet = await page.evaluate(async (focus) => {
    const c = card();
    c.customize(focus || undefined); await wait(900);
    const P = window.MSH.portals();
    const find = () => P.flatMap((p) => deepAll('[data-mth-field]', p.shadowRoot || p))[0];
    let f = find();
    if (!f) for (const p of P) for (const b of deepAll('[data-a="tab"],[data-a="page"][data-p="tabs"],[data-a="etab"][data-k="t"],[data-a="tetab"][data-v="faner"]', p.shadowRoot || p)) { if (f) break; b.click(); await wait(300); f = find(); }
    if (!f) return { found: false };
    f.querySelector('[data-mth="56"]').click(); await wait(500);
    const live = meas();
    const pp = window.MSH.portals().pop(); const bg = pp && pp.shadowRoot && pp.shadowRoot.querySelector('.bg'); if (bg) bg.click(); await wait(600);
    return { found: true, live: live && live.h };
  }, focus);
  ok(`${name}: Tilpass-arket har «Fanehøyde», valget vises live i popupen`, sheet.found && (near(sheet.live, 56) || near(sheet.live, 72)), sheet);
  ok(`${name}: ingen sidefeil`, errs.length === 0, errs.slice(0, 3));

  // overlever reload: kortets tab_height + global verdi i ki-store
  const ud = await page.evaluate(async () => {
    const M = window.MSH, c = card();
    await M.mshPatchConfig(c, { tab_height: 56 });
    M.tabH.setGlobal(44);
    await wait(900); if (M.store.flush) M.store.flush(); if (M.store.save) await M.store.save(); await wait(400);
    return window.__userData;
  });
  await page.close();
  const re = await open(tag, hash, extra, ud);
  const rr = await re.page.evaluate(async () => { await wait(400); const m = meas(); return { h: m && m.h, g: window.MSH.tabH.global() }; });
  ok(`${name}: etter reload – egen 56 px og global 44 står`, okH({ h: rr.h }, 56) && rr.g === 44, rr);
  await re.page.close();
}

// «Tilpass Hjem» → Faner → «Fanehøyde i popups»
if (!only.length || only.some((o) => /hjem/i.test(o))) {
  const { page, errs } = await open('msh-lys-card', '#lys', {});
  const r = await page.evaluate(async () => {
    const M = window.MSH;
    M.openHomeEditor({ focus: 'faner' }); await wait(1000);
    const P = M.portals();
    const f = P.flatMap((p) => deepAll('[data-mth-field]', p.shadowRoot || p))[0];
    if (!f) return { found: false };
    const out = { found: true, label: f.querySelector('.mth-l') && f.querySelector('.mth-l').textContent, chips: [...f.querySelectorAll('[data-mth]')].map((b) => b.textContent.trim().replace(/\s+/g, ' ')) };
    f.querySelector('[data-mth="50"]').click(); await wait(500);
    out.global = M.tabH.global(); out.lys = meas().h;
    out.css = getComputedStyle(document.documentElement).getPropertyValue('--ki-ptab-th').trim();
    const done = P.flatMap((p) => deepAll('[data-a="done"],.done', p.shadowRoot || p))[0];
    if (done) { done.click(); await wait(1200); }
    out.saved = (((window.__userData.ki_dashboard || {}).ui) || {}).popup_tab_height;
    return out;
  });
  ok('Tilpass Hjem → Faner: «Fanehøyde i popups» (segment + slider) setter ui.popup_tab_height, popups følger live, Ferdig lagrer', r.found && /Fanehøyde i popups/.test(r.label) && r.chips.length === 6 && r.global === 50 && r.lys === 50 && r.css === '50px' && r.saved === 50, r);
  ok('Tilpass Hjem: ingen sidefeil', errs.length === 0, errs.slice(0, 3));
  await page.close();
}

await browser.close();
console.log(res.join('\n'));
console.log(fails ? `\n${fails} feil` : '\nAlt OK');
process.exit(fails ? 1 : 0);
