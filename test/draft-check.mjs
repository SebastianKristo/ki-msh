// Fiks 15.13 · utkastflyten i «Tilpass …»-arkene (MSH.draftEditor / MSH.store.transaction).
// «Tilpass rom»: ett ark (tannhjulet i klima-toppkortet åpnet to), endringer bare i utkastet (ingen autolagring),
// innkommende ki-store-/setConfig-endringer overskriver ikke utkastet (banner «Endret et annet sted»), dobbelttrykk på
// Ferdig = ÉN frontend/set_user_data, arket lukkes og verdien står (også etter ekko fra HA og reload), Avbryt forkaster,
// feil → arket står med utkastet. Lys, Vær og Tilpass Hjem: én lagring per Ferdig, Avbryt forkaster.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readdirSync, existsSync, mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync(resolve('test/.build'), { recursive: true });
mkdirSync(resolve('test/.vendor'), { recursive: true });
const BC = resolve('test/.vendor/bubble-card.js');
if (!existsSync(BC)) execFileSync('curl', ['-sSL', '-o', BC, 'https://raw.githubusercontent.com/Clooos/Bubble-Card/main/dist/bubble-card.js']);
const bundle = process.env.KI_BUNDLE || resolve(`test/.build/draft-${process.pid}.js`);
if (!process.env.KI_BUNDLE) execFileSync('node', ['build.mjs', bundle]);
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });

// Side med strategi-dashbordet: #stue, #lys og #vaer som Bubble-popups. set_user_data har 120 ms forsinkelse og
// sender (som HA) et ekko til alle frontend/subscribe_user_data-abonnenter. window.__sets teller skriveforsøk.
async function boot(userData) {
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + resolve('test/harness-bubble.html'));
  await p.evaluate((ud) => { localStorage.clear(); localStorage.setItem('ki-device-id', 'testenhet'); window.__userData = ud || {}; window.__sets = []; window.__failSave = false; }, userData);
  for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
  await p.evaluate(() => {
    const base = window.mockHass;
    window.__echo = [];
    window.__remote = (value) => window.__echo.forEach((cb) => cb({ value: JSON.parse(JSON.stringify(value)) }));
    window.mockHass = () => {
      const h = base(); const ws = h.callWS;
      h.callWS = async (m) => {
        if (m.type === 'frontend/set_user_data') {
          window.__sets.push(JSON.parse(JSON.stringify(m.value)));
          await new Promise((q) => setTimeout(q, 120));
          if (window.__failSave) throw new Error('nettverk');
          const r = await ws(m);
          setTimeout(() => window.__remote(m.value), 60); // ekko av egen lagring
          return r;
        }
        return ws(m);
      };
      const sm = h.connection.subscribeMessage;
      h.connection = { ...h.connection, subscribeMessage: (cb, m) => { if (m.type === 'frontend/subscribe_user_data') { window.__echo.push(cb); return Promise.resolve(() => {}); } return sm(cb, m); } };
      return h;
    };
  });
  await p.addScriptTag({ path: bundle });
  await p.addScriptTag({ path: BC, type: 'module' });
  await p.waitForFunction(() => customElements.get('bubble-card'));
  await p.evaluate(async () => {
    const hass = window.mockHass(); window.__hass = hass;
    await window.MSH.store.load(hass);
    const d = await customElements.get('ll-strategy-dashboard-ki-dashboard').generate({}, hass);
    const all = d.views[0].cards[0].cards;
    for (const hash of ['#stue', '#lys', '#vaer']) {
      const pop = all.find((c) => c.hash === hash);
      if (!pop) continue;
      const bc = document.createElement('bubble-card'); bc.setConfig(pop); bc.hass = hass; document.getElementById('dash').appendChild(bc);
    }
    await new Promise((q) => setTimeout(q, 300)); location.hash = '#stue'; await new Promise((q) => setTimeout(q, 1000));
    window.__all = () => { const o = []; const w = (r) => r.querySelectorAll('*').forEach((e) => { o.push(e); if (e.shadowRoot) w(e.shadowRoot); }); w(document); return o; };
    window.__card = (tag) => window.__all().find((e) => e.localName === tag && e.isConnected && !(e._config && e._config.embedded));
    window.__wait = (ms) => new Promise((q) => setTimeout(q, ms));
    window.__haps = []; window.addEventListener('haptic', (e) => window.__haps.push(e.detail));
    window.__toasts = []; new MutationObserver(() => { const t = window.MSH.overlayRoot().querySelector('#msh-toast'); if (t && window.__toasts[window.__toasts.length - 1] !== t.textContent) window.__toasts.push(t.textContent); }).observe(window.MSH.overlayRoot(), { childList: true });
    window.__sets.length = 0;
  });
  return { p, errs };
}

const res = {};
const { p, errs } = await boot({});
// ---------------------------------------------------------------- Tilpass rom
res.rom = await p.evaluate(async () => {
  const M = window.MSH, W = window.__wait, r = {};
  const rom = window.__card('msh-rom-card');
  const gear = window.__all().find((e) => e.dataset && e.dataset.act === 'customize' && e.getRootNode().host && e.getRootNode().host.localName === 'msh-rom-klima-card');
  gear.click(); await W(300);
  r.sheetsAfterGear = M.portals().length; // skal være 1 (før: to ark oppå hverandre)
  const ov = () => M.portals().pop();
  const ed = () => ov().shadowRoot.querySelector('msh-editor');
  const S = () => ed().shadowRoot;
  // endre: snarvalg + slider (input under drag, change ved slipp)
  [...S().querySelectorAll('.pill'), ...[...S().querySelectorAll('ki-spacing-editor')].flatMap((k) => [...k.shadowRoot.querySelectorAll('.p')])].find((x) => /Luftig 18/.test(x.textContent)).click();
  const rg = [...S().querySelectorAll('input[type=range]'), ...[...S().querySelectorAll('ki-spacing-editor')].flatMap((k) => [...k.shadowRoot.querySelectorAll('input[type=range]')])][1];
  for (const v of [10, 0, -20]) { rg.value = String(v); rg.dispatchEvent(new Event('input', { bubbles: true })); await W(20); }
  rg.dispatchEvent(new Event('change', { bubbles: true }));
  await W(900);
  r.setsBeforeDone = window.__sets.length; // ingen autolagring
  r.previewGap = rom._rawConfig.gap;
  r.statusBeforeDone = (S().querySelector('.stat') || {}).textContent || '';
  // innkommende endring fra en annen enhet (subscribe_user_data) mens utkastet er åpent
  window.__remote({ ...window.__userData.ki_dashboard, rooms: { stue: { area: 'stue', gap: 30, pad_top: 5 } } });
  await W(80);
  r.afterRemote = { draftGap: ed()._config.gap, draftPad: ed()._config.pad_top, cardGap: rom._rawConfig.gap, banner: !!ov().shadowRoot.querySelector('.msh-draft-banner'), storeGap: (M.store.get('rooms.stue') || {}).gap };
  // innkommende setConfig fra HA (Lovelace sender config på nytt)
  rom.setConfig(rom._yamlConfig); await W(50);
  r.afterSetConfig = { draftGap: ed()._config.gap, cardGap: rom._rawConfig.gap };
  // Ferdig – dobbelttrykk
  window.__haps.length = 0;
  const btn = S().querySelector('[data-a="save"]');
  btn.click(); btn.click();
  await W(20);
  r.busyDisabled = btn.disabled === true;
  btn.click();
  await W(700);
  r.setsAfterDone = window.__sets.length;
  r.sheetsAfterDone = M.portals().length;
  r.saved = (((window.__userData.ki_dashboard || {}).rooms || {}).stue) || null;
  r.cardAfterDone = { gap: rom._rawConfig.gap, pad_top: rom._rawConfig.pad_top };
  r.successHaptics = window.__haps.filter((h) => h === 'success').length;
  r.toastLagret = window.__toasts.includes('Lagret');
  await W(400); // ekko fra HA av egen lagring
  r.cardAfterEcho = rom._rawConfig.gap;
  // åpne på nytt → ny verdi; Avbryt forkaster
  rom.customize('spacing'); await W(300);
  r.reopenGap = ed()._config.gap;
  [...S().querySelectorAll('.pill'), ...[...S().querySelectorAll('ki-spacing-editor')].flatMap((k) => [...k.shadowRoot.querySelectorAll('.p')])].find((x) => /Tett 4/.test(x.textContent)).click(); await W(50);
  r.cancelPreview = rom._rawConfig.gap;
  S().querySelector('[data-a="cancel"]').click(); await W(300);
  r.afterCancel = { sheets: M.portals().length, cardGap: rom._rawConfig.gap, storeGap: (M.store.get('rooms.stue') || {}).gap, sets: window.__sets.length };
  // lagring feiler → arket står med utkastet, feilmelding; neste Ferdig lagrer
  window.__failSave = true;
  rom.customize('spacing'); await W(300);
  [...S().querySelectorAll('.pill'), ...[...S().querySelectorAll('ki-spacing-editor')].flatMap((k) => [...k.shadowRoot.querySelectorAll('.p')])].find((x) => /Tett 4/.test(x.textContent)).click(); await W(50);
  window.__haps.length = 0;
  S().querySelector('[data-a="save"]').click(); await W(500);
  r.fail = { sheets: M.portals().length, status: (S().querySelector('.stat') || {}).textContent, draftGap: ed()._config.gap, storeGap: (M.store.get('rooms.stue') || {}).gap, haptic: window.__haps.includes('failure'), btnEnabled: !S().querySelector('[data-a="save"]').disabled };
  window.__failSave = false;
  const n0 = window.__sets.length;
  S().querySelector('[data-a="save"]').click(); await W(500);
  r.retry = { sets: window.__sets.length - n0, sheets: M.portals().length, cardGap: rom._rawConfig.gap, saved: window.__userData.ki_dashboard.rooms.stue.gap };
  return r;
});
const ud = await p.evaluate(() => window.__userData);
// ---------------------------------------------------------------- Lys, Vær, Tilpass Hjem
res.andre = await p.evaluate(async () => {
  const M = window.MSH, W = window.__wait, r = {};
  // Lys
  location.hash = '#lys'; await W(900);
  const lys = window.__card('msh-lys-card');
  if (lys) {
    const n0 = window.__sets.length;
    lys.customize(); await W(300);
    const R = M.portals().pop().shadowRoot;
    const seg = R.querySelector('[data-a="seg"][data-k="gap"][data-v="18"]') || [...R.querySelectorAll('[data-a="seg"]')].find((x) => !x.classList.contains('on'));
    seg.click(); await W(700);
    r.lysBefore = window.__sets.length - n0;
    const done = R.querySelector('[data-a="done"]'); done.click(); done.click(); await W(600);
    r.lysSets = window.__sets.length - n0; r.lysSheets = M.portals().length;
    r.lysSaved = !!(window.__userData.ki_dashboard.cards && window.__userData.ki_dashboard.cards[lys._rawConfig.card_id]);
  }
  // Vær
  location.hash = '#vaer'; await W(900);
  const vaer = window.__card('msh-vaer-card');
  if (vaer) {
    // 28.1: bryterne lagres i sections { k: false } (gamle `hide` telles fortsatt med, i tilfelle alias)
    const offN = (c) => (Array.isArray(c.hide) ? c.hide.length : 0) + Object.values(c.sections && typeof c.sections === 'object' && !Array.isArray(c.sections) ? c.sections : {}).filter((v) => v === false).length;
    const n0 = window.__sets.length;
    vaer.customize(); await W(300);
    const R = M.portals().pop().shadowRoot;
    R.querySelector('[data-a="sec"]').click(); await W(700); // 26.25: «Tilpass Vær» → Seksjoner av/på (hide)
    r.vaerBefore = window.__sets.length - n0;
    r.vaerPreview = offN(vaer._rawConfig);
    R.querySelector('[data-a="done"]').click(); R.querySelector('[data-a="done"]').click(); await W(600);
    r.vaerSets = window.__sets.length - n0; r.vaerSheets = M.portals().length;
    // Avbryt forkaster
    vaer.customize(); await W(300);
    const R2 = M.portals().pop().shadowRoot, hid0 = offN(vaer._rawConfig);
    R2.querySelectorAll('[data-a="sec"]')[1].click(); await W(50);
    vaer._sheet.ov.close(); await W(300); // utenfor/Esc forkaster
    r.vaerCancel = { sheets: M.portals().length, same: offN(vaer._rawConfig) === hid0, sets: window.__sets.length - n0 };
  }
  // Tilpass Hjem (utkast i ki-store)
  location.hash = ''; await W(300);
  let h = M.openHomeEditor(); await W(400);
  const n0 = window.__sets.length;
  h.saveH({ show_todo: false }); await W(700);
  r.hjemBefore = window.__sets.length - n0;
  r.hjemPreview = (M.store.get('cards.ki-home') || {}).show_todo;
  h.root.querySelector('[data-a="cancel"]').click(); await W(300);
  r.hjemCancel = { closed: h.closed, value: (M.store.get('cards.ki-home') || {}).show_todo, sets: window.__sets.length - n0 };
  h = M.openHomeEditor(); await W(400);
  h.saveH({ show_todo: false }); await W(100);
  const dn = h.root.querySelector('[data-a="done"]'); dn.click(); dn.click(); await W(600);
  r.hjemSets = window.__sets.length - n0; r.hjemClosed = h.closed;
  r.hjemSaved = ((window.__userData.ki_dashboard.cards || {})['ki-home'] || {}).show_todo;
  return r;
});
res.errs = errs;
await p.close();
// ---------------------------------------------------------------- reload
{
  const r2 = await boot(ud);
  res.reload = await r2.p.evaluate(async () => {
    const rom = window.__card('msh-rom-card');
    rom.customize('spacing'); await window.__wait(300);
    const ed = window.MSH.portals().pop().shadowRoot.querySelector('msh-editor');
    return { cardGap: rom._rawConfig.gap, cardPad: rom._rawConfig.pad_top, editorGap: ed._config.gap };
  });
  res.reloadErrs = r2.errs;
  await r2.p.close();
}
await b.close();
console.log(JSON.stringify(res, null, 1));
const R = res.rom, A = res.andre;
const checks = {
  'ett ark fra tannhjulet': R.sheetsAfterGear === 1,
  'ingen autolagring før Ferdig': R.setsBeforeDone === 0 && !/Lagre/.test(R.statusBeforeDone),
  'live forhåndsvisning': R.previewGap === 18,
  'innkommende store-endring overskriver ikke utkastet': R.afterRemote.draftGap === 18 && R.afterRemote.draftPad === -20 && R.afterRemote.cardGap === 18 && R.afterRemote.storeGap === 30,
  'banner «Endret et annet sted»': R.afterRemote.banner,
  'setConfig fra HA overskriver ikke utkastet': R.afterSetConfig.draftGap === 18 && R.afterSetConfig.cardGap === 18,
  'Ferdig deaktivert mens det lagres': R.busyDisabled,
  'dobbelttrykk = én set_user_data': R.setsAfterDone === 1,
  'arket lukkes, verdien står': R.sheetsAfterDone === 0 && R.saved && R.saved.gap === 18 && R.saved.pad_top === -20 && R.cardAfterDone.gap === 18 && R.cardAfterDone.pad_top === -20,
  'haptic success én gang + «Lagret»': R.successHaptics === 1 && R.toastLagret,
  'ekko fra HA tilbakestiller ikke': R.cardAfterEcho === 18,
  'åpne på nytt viser ny verdi': R.reopenGap === 18,
  'Avbryt forkaster': R.cancelPreview === 4 && R.afterCancel.sheets === 0 && R.afterCancel.cardGap === 18 && R.afterCancel.storeGap === 18 && R.afterCancel.sets === 1,
  'feil: arket står med utkastet': R.fail.sheets === 1 && /Kunne ikke lagre/.test(R.fail.status || '') && R.fail.draftGap === 4 && R.fail.storeGap === 18 && R.fail.haptic && R.fail.btnEnabled,
  'ny Ferdig etter feil lagrer én gang': R.retry.sets === 1 && R.retry.sheets === 0 && R.retry.cardGap === 4 && R.retry.saved === 4,
  'reload viser ny verdi': res.reload.cardGap === 4 && res.reload.cardPad === -20 && res.reload.editorGap === 4,
  'Tilpass lys: én lagring ved Ferdig': A.lysBefore === 0 && A.lysSets === 1 && A.lysSheets === 0 && A.lysSaved,
  'Tilpass været: én lagring ved Ferdig, Avbryt forkaster': A.vaerBefore === 0 && A.vaerPreview > 0 && A.vaerSets === 1 && A.vaerSheets === 0 && A.vaerCancel.sheets === 0 && A.vaerCancel.same && A.vaerCancel.sets === 1,
  'Tilpass Hjem: utkast, Avbryt forkaster, én lagring ved Ferdig': A.hjemBefore === 0 && A.hjemPreview === false && A.hjemCancel.closed && A.hjemCancel.value === undefined && A.hjemCancel.sets === 0 && A.hjemSets === 1 && A.hjemClosed && A.hjemSaved === false,
  'ingen JS-feil': !res.errs.length && !res.reloadErrs.length,
};
Object.entries(checks).forEach(([k, v]) => console.log(`${v ? '✔' : '✘'} ${k}`));
const ok = Object.values(checks).every(Boolean);
console.log(ok ? '\nAlle bestod' : '\nFEILET');
process.exit(ok ? 0 : 1);
