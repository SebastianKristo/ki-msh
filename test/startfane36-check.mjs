// Fiks 36.5 · Startfane i alle popups med fanelinje (felles MSH.startTab, src/05-start-tab.js).
// For hver popup (ekte Bubble Card-popup i test/harness-bubble.html, 390 px, touch):
//   · start_tab = en annen fane enn første → bytt fane, lukk/åpne via hash → startfanen vises
//   · «Sist brukte» (start_tab: 'last') → lukk/åpne → fanen sist brukt; ny fane → husket (localStorage per bruker)
//   · startfanen skjult → første synlige fane
//   · hold + dra (MSH.tabReorder → onReorder, ekte touch-drag for de første) endrer ikke start_tab
//   · gamle nøkler (Media default_tab, Kalender/Sir Sweeps startTab, Tesla tabs.start, Klima layout.default_tab,
//     Kamera mode, Server tabs.start) virker fortsatt
//   · GUI-editor (getConfigElement, ikke inline): ha-selector select «Startfane» med fanene + «Sist brukte»; valg → config-changed
//   · kortets Tilpass-ark (msh-editor inline / eget ark): chips + «Start»-pill på startfanen; valg → start_tab
// Lys + mørk modus (data-ki-theme), touch. Kjør: node test/startfane36-check.mjs [Kalender …]
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
const bundle = resolve(`test/.build/st36-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const mocks = readdirSync(R + 'test/mock').filter((f) => f.endsWith('.js')).sort().map((f) => R + 'test/mock/' + f);

// [navn, tag, hash, ekstra config, skjul(cfg, id) → patch, gammel nøkkel (cfg-patch for id)]
const CARDS = [
  ['Kalender', 'msh-kalender-card', '#kalender', { tab_labels: 'name' }, (id) => ({ tab_hidden: [id] }), (id) => ({ startTab: id })],
  ['Stovsuger', 'msh-stovsuger-card', '#rolf', {}, (id) => ({ tab_hidden: [id] }), (id) => ({ startTab: id })],
  ['Server', 'msh-server-card', '#server', {}, (id) => ({ hidden_tabs: [id] }), (id) => ({ tabs: { start: id } })],
  ['Avfall', 'msh-avfall-card', '#soppel', {}, (id) => ({ tab_hidden: [id] }), (id) => ({ start_tab: id })],
  ['Varmepumpe', 'msh-varmepumpe-card', '#varmepumpe', {}, (id) => ({ tabs_hidden: [id] }), (id) => ({ start_tab: id })],
  ['Vanning', 'msh-vanning-card', '#vanning', {}, (id, ids) => ({ faner: ids.filter((x) => x !== id) }), (id) => ({ start_tab: id })],
  ['Kamera', 'msh-kamera-card', '#kamera', {}, (id) => ({ tab_hidden: [id] }), (id) => ({ mode: id })],
  ['Innstillinger', 'msh-innstillinger-card', '#settings', {}, (id) => ({ tab_hidden: [id] }), (id) => ({ start_tab: id })],
  ['Basseng', 'msh-basseng-card', '#mitt-basseng', {}, (id) => ({ hidden_tabs: [id] }), (id) => ({ start_tab: id })],
  ['Lys', 'msh-lys-card', '#lys', {}, (id) => ({ hidden_tabs: [id] }), (id) => ({ start_tab: id })],
  ['Klima', 'msh-klima-card', '#klima', {}, (id) => ({ layout: { hidden_tabs: [id] } }), (id) => ({ layout: { default_tab: id } })],
  ['Media', 'msh-media-card', '#media', {}, (id) => ({ hidden_tabs: [id] }), (id) => ({ default_tab: id })],
  ['Tesla', 'msh-tesla-card', '#tesla', {}, (id) => ({ tabs: { hidden: [id] } }), (id) => ({ tabs: { start: id } })],
];
const only = process.argv.slice(2);
const list = only.length ? CARDS.filter((c) => only.some((o) => c[0].toLowerCase() === o.toLowerCase())) : CARDS;

const browser = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = [];
let fails = 0;
const ok = (name, cond, info) => { if (!cond) fails++; res.push(`${cond ? '✔' : '✘'} ${name}${info != null && !cond ? ' · ' + JSON.stringify(info) : ''}`); };

let idx = 0;
for (const [name, tag, hash, extra, hideP, legP] of list) {
  const theme = idx++ % 2 ? 'light' : 'dark';
  const page = await browser.newPage({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('file://' + R + 'test/harness-bubble.html');
  for (const m of mocks) await page.addScriptTag({ path: m });
  await page.addScriptTag({ path: bundle });
  await page.addScriptTag({ path: BC, type: 'module' });
  await page.waitForFunction(() => customElements.get('bubble-card'), null, { timeout: 15000 });
  const cdp = await page.context().newCDPSession(page);
  const wait = (ms) => page.waitForTimeout(ms);
  const ready = await page.evaluate(async ({ tag, hash, extra, theme }) => {
    try { localStorage.clear(); } catch (e) { /* */ }
    window.deepAll = (sel, root) => { const out = []; const walk = (r) => r.querySelectorAll('*').forEach((e) => { if (e.matches(sel)) out.push(e); if (e.shadowRoot) walk(e.shadowRoot); }); walk(root || document); return out; };
    window.H = window.mockHass();
    if (H.themes) H.themes = { ...H.themes, darkMode: theme === 'dark' }; else H.themes = { darkMode: theme === 'dark' };
    window.BASE = { type: 'custom:' + tag, card_id: 'st36_' + tag.replace(/\W/g, '_'), ...extra };
    const bc = document.createElement('bubble-card');
    bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash, name: 'Test', icon: 'mdi:star', margin_top_mobile: '50px', cards: [BASE] });
    window.bc = bc; bc.hass = H; document.getElementById('dash').appendChild(bc);
    await new Promise((r) => setTimeout(r, 400));
    location.hash = hash;
    await new Promise((r) => setTimeout(r, 1200));
    window.card = () => deepAll(tag)[0];
    window.T = () => { const c = card(); if (!c || !c.shadowRoot) return null; const row = [c.shadowRoot, ...deepAll('*', c.shadowRoot).filter((e) => e.shadowRoot).map((e) => e.shadowRoot)].flatMap((r) => [...r.querySelectorAll('*')]).find((e) => e.__tabReorder && e.getClientRects().length); return row ? row.__tabReorder : null; };
    window.ids = () => { const t = T(); return t ? t.items().map((b) => t.idOf(b)) : []; };
    window.act = () => { const t = T(), b = t && t.activeBtn(); return b ? t.idOf(b) : null; };
    window.tap = (id) => { const t = T(), b = t.items().find((x) => t.idOf(x) === id); if (!b) return false; b.scrollIntoView({ block: 'center', inline: 'nearest' }); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
    // Bubble Card lager kortet på nytt ved hver åpning (fra popupens config) → endre popupens config + det levende kortet
    window.BCFG = { type: 'custom:bubble-card', card_type: 'pop-up', hash, name: 'Test', icon: 'mdi:star', margin_top_mobile: '50px' };
    window.setCfg = async (patch) => { const cfg = { ...BASE, ...patch }; try { MSH.store.set('cards.' + BASE.card_id, undefined); } catch (e) { /* */ } window.CUR = cfg; bc.setConfig({ ...BCFG, cards: [cfg] }); const c = card(); if (c) c.setConfig(cfg); await new Promise((r) => setTimeout(r, 300)); };
    window.reopen = async () => { location.hash = ''; await new Promise((r) => setTimeout(r, 700)); location.hash = hash; await new Promise((r) => setTimeout(r, 1100)); };
    // fane-id i fanelinja ↔ id i config (Media bruker data-t/data-key = tv|musikk osv. – idOf gir samme)
    return { n: ids().length, ids: ids(), act: act(), spec: !!(card() && card().constructor.startTabSpec), theme: document.documentElement.dataset.kiTheme };
  }, { tag, hash, extra, theme });
  if (ready.n < 2) { ok(`${name}: fanelinje med ≥ 2 faner`, false, ready); await page.close(); continue; }
  ok(`${name} (${theme}): startTabSpec + ${ready.n} faner, åpner med første (${ready.act})`, ready.spec && ready.act === ready.ids[0], ready);
  const touchTap = async (id) => {
    const p = await page.evaluate((i) => tap(i), id);
    if (!p) return false;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y }] });
    await wait(60);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await wait(450);
    return true;
  };
  const I = ready.ids, first = I[0], X = I[I.length - 1], Y = I[1];

  /* ---------- 1 · startfane ≠ første → bytt fane, lukk/åpne via hash */
  await page.evaluate((x) => setCfg({ start_tab: x }), X);
  await touchTap(first);
  const a1 = await page.evaluate(() => act());
  await page.evaluate(() => reopen());
  const r1 = await page.evaluate(() => ({ act: act(), hash: location.hash }));
  ok(`${name}: start_tab=${X} → gjenåpning via hash viser ${X}`, a1 === first && r1.act === X, { a1, r1 });

  /* ---------- 2 · «Sist brukte» */
  await page.evaluate(() => setCfg({ start_tab: 'last' }));
  await touchTap(Y);
  await page.evaluate(() => reopen());
  const r2 = await page.evaluate(() => act());
  await touchTap(first);
  await page.evaluate(() => reopen());
  const r2b = await page.evaluate(() => act());
  const lsKey = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('ki:last_tab:')));
  ok(`${name}: «Sist brukte» → ${Y}, så ${first} (localStorage ki:last_tab:<bruker>)`, r2 === Y && r2b === first && lsKey.length === 1, { r2, r2b, lsKey });

  /* ---------- 3 · skjult startfane → første synlige */
  await page.evaluate(({ x, p }) => setCfg({ start_tab: x, ...p }), { x: X, p: hideP(X, I) });
  await touchTap((await page.evaluate(() => ids()))[1] || first);
  await page.evaluate(() => reopen());
  const r3 = await page.evaluate(() => ({ act: act(), ids: ids() }));
  ok(`${name}: skjult startfane (${X}) → første synlige (${r3.ids[0]})`, !r3.ids.includes(X) && r3.act === r3.ids[0], r3);

  /* ---------- 4 · hold + dra endrer ikke startfanen */
  await page.evaluate((x) => setCfg({ start_tab: x }), Y);
  await page.evaluate(() => reopen());
  let drag;
  if (idx <= 4) {
    // ekte touch: hold 520 ms + dra første fane sist
    const a = await page.evaluate(() => { const t = T(), b = t.items()[0]; b.scrollIntoView({ block: 'center', inline: 'nearest' }); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    const z = await page.evaluate(() => { const t = T(), b = t.items()[t.items().length - 1]; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2 }; });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: a.x, y: a.y }] });
    await wait(560);
    for (let i = 1; i <= 14; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: a.x + ((z.x + 300 - a.x) * i) / 14, y: a.y }] }); await wait(22); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await wait(900);
    drag = 'touch';
  } else {
    await page.evaluate(() => { const t = T(), o = ids(); t.o.onReorder(o.slice(1).concat(o[0])); });
    await wait(700);
    drag = 'onReorder';
  }
  const r4 = await page.evaluate(() => ({ ids: ids(), st: card()._rawConfig.start_tab }));
  await page.evaluate(() => reopen());
  const r4b = await page.evaluate(() => act());
  ok(`${name}: hold + dra (${drag}) endrer ikke startfanen (${Y})`, r4.ids.join() !== I.join() && r4.st === Y && r4b === Y, { r4, r4b, I });

  /* ---------- 5 · gamle nøkler virker fortsatt */
  await page.evaluate((p) => setCfg(p), legP(X));
  await touchTap(first);
  await page.evaluate(() => reopen());
  const r5 = await page.evaluate(() => act());
  ok(`${name}: gammel nøkkel ${JSON.stringify(legP(X))} → ${X}`, r5 === X, r5);

  /* ---------- 6 · GUI-editor (getConfigElement) med ha-selector-stub + Tilpass-ark (inline) */
  const ed = await page.evaluate(async ({ X, Y }) => {
    const out = {};
    if (!customElements.get('ha-selector')) customElements.define('ha-selector', class extends HTMLElement { set selector(v) { this._s = v; } get selector() { return this._s; } });
    const cls = card().constructor;
    const findTab = async (e) => { // klikk gjennom editorens faner til Startfane-feltet finnes
      const R0 = e.shadowRoot;
      const has = () => R0.querySelector('ha-selector[data-name="start_tab"], [data-mst-field]');
      if (has()) return has();
      for (const b of [...R0.querySelectorAll('[data-a="tab"], [data-a="tetab"]')]) { b.click(); await new Promise((r) => setTimeout(r, 120)); if (has()) return has(); }
      return null;
    };
    try { MSH.store.set('cards.' + BASE.card_id, undefined); } catch (e) { /* */ }
    const cfg0 = { ...BASE, start_tab: X };
    // GUI
    const g = cls.getConfigElement();
    document.body.appendChild(g); g.hass = H; g.setConfig(cfg0);
    await new Promise((r) => setTimeout(r, 200));
    const sel = await findTab(g);
    out.gui = !!sel && sel.localName === 'ha-selector';
    if (out.gui) {
      out.guiOpts = (sel.selector.select.options || []).map((o) => o.value);
      out.guiVal = sel.value;
      let got = null; g.addEventListener('config-changed', (e) => { got = e.detail.config; }, { once: true });
      sel.dispatchEvent(new CustomEvent('value-changed', { detail: { value: 'last' }, bubbles: true, composed: true }));
      await new Promise((r) => setTimeout(r, 80));
      out.guiOut = got && got.start_tab;
    }
    g.remove();
    // Tilpass-arket (msh-editor inline / kortets egen editor)
    const e = cls.getConfigElement();
    e.inline = true; document.body.appendChild(e); e.hass = H; e.setConfig({ ...BASE, start_tab: X });
    await new Promise((r) => setTimeout(r, 200));
    const f = await findTab(e);
    out.inl = !!f && !!f.matches('[data-mst-field]');
    if (out.inl) {
      out.chips = [...f.querySelectorAll('.mst-c')].map((b) => (b.dataset.v || b.dataset.mst));
      out.on = (f.querySelector('.mst-c.on') || {}).dataset;
      out.on = out.on && (out.on.v || out.on.mst);
      out.pill = [...e.shadowRoot.querySelectorAll('[data-mst-pill]')].map((p) => p.dataset.mstPill);
      let got = null; e.addEventListener('msh-change', (ev) => { got = ev.detail.config; });
      const b = [...f.querySelectorAll('.mst-c')].find((x) => (x.dataset.v || x.dataset.mst) === Y);
      if (b) b.click();
      await new Promise((r) => setTimeout(r, 150));
      out.inlOut = got ? got.start_tab : (e._config || {}).start_tab;
      // farge: chip «on» = rosa gradient, tekst --ki-on-accent
      const on = e.shadowRoot.querySelector('.mst-c.on');
      out.onBg = on ? getComputedStyle(on).backgroundImage.slice(0, 15) : null;
    }
    e.remove();
    return out;
  }, { X, Y });
  ok(`${name}: GUI-editor · ha-selector «Startfane» (${ed.guiOpts ? ed.guiOpts.join('|') : '–'}), verdi ${X}, valg → config-changed`, ed.gui && ed.guiOpts && ed.guiOpts.includes(X) && ed.guiOpts.includes('last') && ed.guiVal === X && ed.guiOut === 'last', ed);
  ok(`${name}: Tilpass → Faner · chips + «Sist brukte», ${X} aktiv${ed.pill && ed.pill.length ? ', «Start»-pill' : ''}, valg → start_tab`, ed.inl && ed.chips.includes('last') && ed.chips.includes(X) && ed.on === X && ed.inlOut === Y && /gradient/.test(ed.onBg || '') && (!ed.pill.length || ed.pill.join() === X), ed);
  ok(`${name}: ingen sidefeil`, !errs.length, errs.slice(0, 3));
  await page.close();
}

/* ---------- Klima/Varmepumpe/Tesla: eget Tilpass-ark (customize) har Startfane-chips + «Start»-pill */
for (const [name, tag, hash, open] of [['Klima', 'msh-klima-card', '#klima', 'faner'], ['Varmepumpe', 'msh-varmepumpe-card', '#varmepumpe', 'faner']]) {
  const page = await browser.newPage({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('file://' + R + 'test/harness-bubble.html');
  for (const m of mocks) await page.addScriptTag({ path: m });
  await page.addScriptTag({ path: bundle });
  await page.addScriptTag({ path: BC, type: 'module' });
  await page.waitForFunction(() => customElements.get('bubble-card'), null, { timeout: 15000 });
  const r = await page.evaluate(async ({ tag, hash, open }) => {
    const deepAll = (sel, root) => { const out = []; const walk = (rr) => rr.querySelectorAll('*').forEach((e) => { if (e.matches(sel)) out.push(e); if (e.shadowRoot) walk(e.shadowRoot); }); walk(root || document); return out; };
    const H = window.mockHass();
    const bc = document.createElement('bubble-card');
    bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash, name: 'Test', icon: 'mdi:star', cards: [{ type: 'custom:' + tag, card_id: 'st36s_' + tag.replace(/\W/g, '_') }] });
    bc.hass = H; document.getElementById('dash').appendChild(bc);
    await new Promise((x) => setTimeout(x, 400)); location.hash = hash; await new Promise((x) => setTimeout(x, 1200));
    const c = deepAll(tag)[0];
    c.customize(open);
    await new Promise((x) => setTimeout(x, 700));
    // Varmepumpe: arkets Faner-fane heter 't'
    const tb = deepAll('[data-a="tab"][data-k="t"], [data-a="tab"][data-v="t"]')[0]; if (tb && !deepAll('[data-mst-field]').length) { tb.click(); await new Promise((x) => setTimeout(x, 300)); }
    const f = deepAll('[data-mst-field]')[0];
    if (!f) return { field: false, tabs: deepAll('[data-a]').slice(0, 30).map((e) => e.dataset.a + ':' + (e.dataset.k || e.dataset.v || '')) };
    const chips = [...f.querySelectorAll('[data-mst]')].map((b) => b.dataset.mst);
    const pill0 = deepAll('[data-mst-pill]').map((p) => p.dataset.mstPill);
    const target = chips[chips.length - 2];
    f.querySelector(`[data-mst="${target}"]`).click();
    await new Promise((x) => setTimeout(x, 400));
    const pill1 = deepAll('[data-mst-pill]').map((p) => p.dataset.mstPill);
    const on = (deepAll('[data-mst-field] .mst-c.on')[0] || {}).dataset;
    return { field: true, chips, pill0, pill1, target, on: on && on.mst };
  }, { tag, hash, open });
  ok(`${name}: eget Tilpass-ark · Startfane-chips + «Sist brukte», valg flytter «Start»-pill`, r.field && r.chips.includes('last') && r.pill0.length === 1 && r.pill1.join() === r.target && r.on === r.target, r);
  ok(`${name}: eget ark · ingen sidefeil`, !errs.length, errs.slice(0, 3));
  await page.close();
}

await browser.close();
console.log(res.join('\n'));
console.log(fails ? `\n✘ ${fails} feil` : '\n✔ startfane36: alt ok');
process.exit(fails ? 1 : 0);
