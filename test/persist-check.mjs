// «Tilpass rom» → Lagre → reload: verdien er der. Haptic kun på snarvalg + én success etter faktisk lagring.
// Feil ved lagring → «Kunne ikke lagre», haptic failure, arket blir stående. GUI-editoren viser samme verdier.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readdirSync, existsSync } from 'node:fs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const BC = resolve('test/.vendor/bubble-card.js');
if (!existsSync(BC)) execFileSync('curl', ['-sSL', '-o', BC, 'https://raw.githubusercontent.com/Clooos/Bubble-Card/main/dist/bubble-card.js']);
const bundle = resolve(`test/.build/persist-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
async function boot(userData, failSave) {
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + resolve('test/harness-bubble.html'));
  await p.evaluate(({ ud, fail }) => { localStorage.clear(); window.__userData = ud || {}; window.__failSave = fail; }, { ud: userData, fail: failSave });
  for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
  await p.evaluate(() => { const base = window.mockHass; window.mockHass = () => { const h = base(); const ws = h.callWS; h.callWS = (m) => (m.type === 'frontend/set_user_data' && window.__failSave ? Promise.reject(new Error('nettverk')) : ws(m)); return h; }; });
  await p.addScriptTag({ path: bundle });
  await p.addScriptTag({ path: BC, type: 'module' });
  await p.waitForFunction(() => customElements.get('bubble-card'));
  await p.evaluate(async () => {
    const hass = window.mockHass(); window.__hass = hass;
    const d = await customElements.get('ll-strategy-dashboard-ki-dashboard').generate({}, hass);
    const pop = d.views[0].cards[0].cards.find((c) => c.hash === '#stue');
    window.__romCfg = pop.cards[0];
    const bc = document.createElement('bubble-card'); bc.setConfig(pop); bc.hass = hass; document.getElementById('dash').appendChild(bc);
    await new Promise((q) => setTimeout(q, 300)); location.hash = '#stue'; await new Promise((q) => setTimeout(q, 1000));
  });
  return { p, errs };
}
const deep = `(() => { const o = []; const w = (r) => r.querySelectorAll('*').forEach((e) => { o.push(e); if (e.shadowRoot) w(e.shadowRoot); }); w(document); return o; })()`;
let res = {};
// 1) endre og lagre
{
  const { p, errs } = await boot({}, false);
  res.save = await p.evaluate(async (deepSrc) => {
    const wait = (ms) => new Promise((q) => setTimeout(q, ms));
    const haps = []; window.addEventListener('haptic', (e) => haps.push(e.detail));
    window.dispatchEvent(new CustomEvent('ki-open-editor', { detail: { editor: 'room', area: 'stue' } })); await wait(400);
    haps.length = 0;
    const ed = window.MSH.portals().pop().shadowRoot.querySelector('msh-editor');
    const S = ed.shadowRoot;
    // slider (pad_top) → -20: input-events (ingen haptic) + change (commit)
    const rg = [...S.querySelectorAll('input[type=range]')][1];
    for (const v of [10, 0, -10, -20]) { rg.value = String(v); rg.dispatchEvent(new Event('input', { bubbles: true })); await wait(20); }
    rg.dispatchEvent(new Event('change', { bubbles: true }));
    const hapsAfterSlider = haps.length;
    [...S.querySelectorAll('.pill')].find((x) => /Luftig 18/.test(x.textContent)).click(); // snarvalg → light
    await wait(50);
    const hapsAfterPill = haps.slice();
    const statusBefore = (S.querySelector('.stat') || {}).textContent;
    S.querySelector('[data-a="save"]').click();
    await wait(50);
    const statusDuring = (S.querySelector('.stat') || {}).textContent;
    await wait(900);
    return { hapsAfterSlider, hapsAfterPill, statusBefore, statusDuring, hapsAll: haps, stored: (() => { const u = window.__userData.ki_dashboard || {}, d = ((u.devices || {})[window.MSH.store.deviceId] || {}).rooms || {}; return { stue: { ...((u.rooms || {}).stue || {}), ...(d.stue || {}) } }; })(), // felles + denne enhetens oppsett editorOpen: window.MSH.portals().length };
  }, deep);
  res.save.errs = errs;
  const ud = await p.evaluate(() => window.__userData);
  await p.close();
  // 2) reload med samme brukerdata (tom localStorage)
  const r2 = await boot(ud, false);
  res.reload = await r2.p.evaluate(async (deepSrc) => {
    const all = eval(deepSrc);
    const rom = all.find((e) => e.localName === 'msh-rom-card' && e.getBoundingClientRect().height > 0);
    const gui = customElements.get('msh-rom-card').getConfigElement(); gui.hass = window.__hass; gui.setConfig(window.__romCfg); document.body.appendChild(gui);
    await new Promise((q) => setTimeout(q, 80));
    const pad = [...gui.shadowRoot.querySelectorAll('input[type=range]')].map((i) => i.value);
    return { strategyCfg: { gap: window.__romCfg.gap, pad_top: window.__romCfg.pad_top }, cardCfg: rom && { gap: rom._rawConfig.gap, pad_top: rom._rawConfig.pad_top }, guiSliders: pad, marginTop: rom && getComputedStyle(rom.shadowRoot.querySelector('msh-rom-klima-card') ? rom : rom).marginTop };
  }, deep);
  res.reload.errs = r2.errs;
  await r2.p.close();
}
// 3) feil ved lagring
{
  const { p } = await boot({}, true);
  res.fail = await p.evaluate(async () => {
    const wait = (ms) => new Promise((q) => setTimeout(q, ms));
    const haps = []; window.addEventListener('haptic', (e) => haps.push(e.detail));
    window.dispatchEvent(new CustomEvent('ki-open-editor', { detail: { editor: 'room', area: 'stue' } })); await wait(400);
    const S = window.MSH.portals().pop().shadowRoot.querySelector('msh-editor').shadowRoot;
    [...S.querySelectorAll('.pill')].find((x) => /Tett 4/.test(x.textContent)).click();
    S.querySelector('[data-a="save"]').click(); await wait(900);
    return { status: (S.querySelector('.stat') || {}).textContent, haps, editorOpen: window.MSH.portals().length };
  });
  await p.close();
}
await b.close();
console.log(JSON.stringify(res, null, 1));
const ok = res.save.hapsAfterSlider === 0 && res.save.hapsAll.filter((h) => h === 'success').length === 1 && /Lagrer/.test(res.save.statusBefore || '') && /Lagret/.test(res.save.statusDuring || '') && res.save.stored && res.save.stored.stue && res.save.stored.stue.gap === 18 && res.save.stored.stue.pad_top === -20 && res.save.editorOpen === 0
  && res.reload.cardCfg && res.reload.cardCfg.gap === 18 && res.reload.cardCfg.pad_top === -20 && res.reload.strategyCfg.gap === 18 && res.reload.guiSliders.includes('-20')
  && /Kunne ikke lagre/.test(res.fail.status || '') && res.fail.haps.includes('failure') && res.fail.editorOpen === 1 && !res.save.errs.length && !res.reload.errs.length;
console.log(ok ? '\nAlle bestod' : '\nFEILET');
process.exit(ok ? 0 : 1);
