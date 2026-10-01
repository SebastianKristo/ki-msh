// Én felles config: «Tilpass rom» har ingen omfangsvelger og lagrer felles (PC ser endringen fra telefonen).
// Gammelt enhetsoppsett migreres til felles og slettes. Unntak: Kamera har oppsett per enhet («Denne enheten»
// lagres under devices.<id>, PC ser felles; «Bruk felles oppsett» sletter enhetens eget).
// Sjekker også at popupens bunnluft følger navbarens høyde (MSH.popupBottomPad).
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readdirSync, existsSync } from 'node:fs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const BC = resolve('test/.vendor/bubble-card.js');
if (!existsSync(BC)) execFileSync('curl', ['-sSL', '-o', BC, 'https://raw.githubusercontent.com/Clooos/Bubble-Card/main/dist/bubble-card.js']);
const bundle = process.env.KI_BUNDLE || resolve(`test/.build/device-${process.pid}.js`);
if (!process.env.KI_BUNDLE) execFileSync('node', ['build.mjs', bundle]);
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext({ viewport: { width: 390, height: 700 } });

// Felles «server»-lagring for begge enhetene (frontend/set_user_data)
let server = {};
const open = async (devId) => {
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + resolve('test/harness-bubble.html'));
  await p.evaluate((id) => { localStorage.clear(); localStorage.setItem('ki-device-id', id); }, devId);
  for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
  await p.exposeFunction('__srvGet', () => JSON.stringify(server));
  await p.exposeFunction('__srvSet', (v) => { server = JSON.parse(v); });
  await p.evaluate(() => {
    const base = window.mockHass;
    window.mockHass = () => { const h = base(); const ws = h.callWS; h.callWS = async (m) => {
      if (m.type === 'frontend/get_user_data') return { value: JSON.parse(await window.__srvGet()) };
      if (m.type === 'frontend/set_user_data') { await window.__srvSet(JSON.stringify(m.value)); return null; }
      return ws(m);
    }; return h; };
  });
  await p.addScriptTag({ path: bundle });
  await p.addScriptTag({ path: BC, type: 'module' });
  await p.waitForFunction(() => customElements.get('bubble-card'));
  await p.evaluate(async () => {
    const hass = window.mockHass(); window.__h = hass;
    await window.MSH.store.load(hass);
    const dash = document.getElementById('dash');
    const nav = document.createElement('msh-navbar-card'); nav.setConfig({ type: 'custom:msh-navbar-card', card_id: 'ki-navbar' }); nav.hass = hass; dash.appendChild(nav);
    const pop = { type: 'custom:bubble-card', card_type: 'pop-up', hash: '#stue', name: 'Stue', icon: 'mdi:sofa', cards: [{ type: 'custom:msh-rom-card', card_id: 'room-stue', area: 'stue' }] };
    const bc = document.createElement('bubble-card'); bc.setConfig(pop); bc.hass = hass; dash.appendChild(bc);
    const kp = { type: 'custom:bubble-card', card_type: 'pop-up', hash: '#kamera', name: 'Kamera', icon: 'mdi:cctv', cards: [{ type: 'custom:msh-kamera-card', card_id: 'pop-kamera' }] };
    const kb = document.createElement('bubble-card'); kb.setConfig(kp); kb.hass = hass; dash.appendChild(kb);
    await new Promise((q) => setTimeout(q, 400));
    location.hash = '#stue';
    await new Promise((q) => setTimeout(q, 1200));
  });
  return { p, errs };
};
const helpers = `
  window.__all = () => { const o = []; const w = (r) => r.querySelectorAll('*').forEach((e) => { o.push(e); if (e.shadowRoot) w(e.shadowRoot); }); w(document); return o; };
  window.__rom = () => window.__all().find((e) => e.localName === 'msh-rom-card' && e.isConnected);
  window.__kam = () => window.__all().find((e) => e.localName === 'msh-kamera-card' && e.isConnected);
  window.__wait = (ms) => new Promise((q) => setTimeout(q, ms));
`;
const res = {};
// gammelt enhetsoppsett fra forrige versjon: rom (skal migreres) og kamera (skal bli)
server = { rooms: { stue: { gap: 8 } }, devices: { telefon: { name: 'iPhone', rooms: { kjokken: { gap: 12 }, stue: { gap: 30 } }, cards: { 'pop-kamera': { cam_gap: 2 } } } } };
const A = await open('telefon');
await A.p.evaluate(helpers);
Object.assign(res, await A.p.evaluate(async () => {
  const r = {}, M = window.MSH;
  r.migKjokken = M.store.get('rooms.kjokken');
  r.migStue = M.store.get('rooms.stue');
  r.migDevRooms = M.store.get('devices.telefon.rooms') || null;
  r.migKam = M.store.get('devices.telefon.cards.pop-kamera');
  r.padBottom = window.__rom().style.paddingBottom;
  // Rom: ingen omfangsvelger, lagres felles
  window.__rom().customize('spacing'); await window.__wait(300);
  const sh = M.portals().pop().shadowRoot;
  r.romBar = !!sh.querySelector('msh-scope-bar');
  const ed = sh.querySelector('msh-editor');
  [...ed.shadowRoot.querySelectorAll('.pill'), ...[...ed.shadowRoot.querySelectorAll('ki-spacing-editor')].flatMap((k) => [...k.shadowRoot.querySelectorAll('.p')])].find((x) => /Tett 4/.test(x.textContent)).click(); await window.__wait(100);
  ed.shadowRoot.querySelector('[data-a="save"]').click(); await window.__wait(800); // utkastflyt: lagres ved Ferdig (fiks 15.13)
  r.romShared = M.store.get('rooms.stue');
  r.romDev = M.store.get('devices.telefon.rooms.stue') || null;
  M.portals().forEach((p) => p.remove()); // (arket er allerede lukket av Ferdig)
  // Kamera: per enhet
  location.hash = '#kamera'; await window.__wait(1000);
  const k = window.__kam();
  r.kamGapThis = k.config.cam_gap;
  k.customize(); await window.__wait(400);
  r.kamBar = !!window.__all().find((e) => e.localName === 'msh-scope-bar' && e.isConnected);
  M.store.scope = 'device';
  await M.saveCardConfig(window.__h, k._rawConfig, { ...k._rawConfig, cam_gap: 10 }, { card: k, immediate: true });
  await window.__wait(300);
  r.kamDev = M.store.get('devices.telefon.cards.pop-kamera');
  r.kamShared = M.store.get('cards.pop-kamera') || null;
  r.kamGapAfter = k.config.cam_gap;
  return r;
}));
await A.p.waitForTimeout(300);
// PC: ser felles rom-oppsett, men ikke telefonens kamera-oppsett
const B = await open('pc');
await B.p.evaluate(helpers);
Object.assign(res, await B.p.evaluate(async () => {
  const pcRomGap = window.__rom().config.gap;
  location.hash = '#kamera'; await window.__wait(1000);
  return { pcRomGap, pcKamGap: window.__kam().config.cam_gap };
}));
// Telefon: «Bruk felles oppsett» for kamera
Object.assign(res, await A.p.evaluate(async () => {
  const M = window.MSH; await M.store.refresh(window.__h);
  await M.store.clearOwn('cards.pop-kamera'); await window.__wait(300);
  const set = document.createElement('msh-settings-card'); set.setConfig({ type: 'custom:msh-settings-card' }); set.hass = window.__h; document.body.appendChild(set); await window.__wait(300);
  return { afterClear: M.store.get('devices.telefon.cards.pop-kamera') || null, settingsDevices: /Ingen enheter med eget oppsett/.test(set.shadowRoot.textContent) };
}));
res.errors = [...A.errs, ...B.errs];
await b.close();
console.log(JSON.stringify(res, null, 1));
const ok = res.migKjokken && res.migKjokken.gap === 12 && res.migStue.gap === 8 && !res.migDevRooms && res.migKam && res.migKam.cam_gap === 2
  && !res.romBar && res.romShared && res.romShared.gap === 4 && !res.romDev
  && res.kamGapThis === 2 && res.kamBar && res.kamDev && res.kamDev.cam_gap === 10 && !(res.kamShared && res.kamShared.cam_gap === 10) && res.kamGapAfter === 10
  && res.pcRomGap === 4 && res.pcKamGap !== 10 && !res.afterClear && res.settingsDevices
  && /calc\(var\(--ki-nav-h/.test(res.padBottom) && !res.errors.length;
console.log(ok ? 'OK – én felles config, oppsett per enhet for Kamera' : 'FEIL – oppsett per enhet');
process.exit(ok ? 0 : 1);
