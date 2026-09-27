// Oppsett per enhet: «Tilpass rom» lagrer som standard under devices.<id> (Denne enheten); «Alle enheter» skriver
// felles oppsett; «Bruk felles oppsett» sletter enhetens eget. En annen enhet (simulert med ny enhets-ID) ser bare
// felles oppsett. Sjekker også at popupens bunnluft følger navbarens høyde (MSH.popupBottomPad).
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
    await new Promise((q) => setTimeout(q, 400));
    location.hash = '#stue';
    await new Promise((q) => setTimeout(q, 1200));
  });
  return { p, errs };
};
const helpers = `
  window.__all = () => { const o = []; const w = (r) => r.querySelectorAll('*').forEach((e) => { o.push(e); if (e.shadowRoot) w(e.shadowRoot); }); w(document); return o; };
  window.__rom = () => window.__all().find((e) => e.localName === 'msh-rom-card' && e.isConnected);
  window.__wait = (ms) => new Promise((q) => setTimeout(q, ms));
`;
const res = {};
const A = await open('telefon');
await A.p.evaluate(helpers);
Object.assign(res, await A.p.evaluate(async () => {
  const r = {}, M = window.MSH;
  r.deviceId = M.store.deviceId;
  r.padBottom = window.__rom().style.paddingBottom;
  r.navH = document.documentElement.style.getPropertyValue('--ki-nav-h');
  window.__rom().customize('spacing'); await window.__wait(300);
  const sh = M.portals().pop().shadowRoot;
  const bar = sh.querySelector('msh-scope-bar');
  r.bar = !!bar && bar.shadowRoot.textContent.replace(/\s+/g, ' ').trim();
  const ed = sh.querySelector('msh-editor');
  const pill = (re) => [...ed.shadowRoot.querySelectorAll('.pill')].find((x) => re.test(x.textContent));
  pill(/Tett 4/).click(); await window.__wait(900);
  r.devAfter = M.store.get('devices.telefon.rooms.stue');
  r.sharedAfter = M.store.get('rooms.stue') || null;
  r.ownChip = /Eget oppsett/.test(bar.shadowRoot.textContent);
  // Alle enheter → felles
  [...bar.shadowRoot.querySelectorAll('[data-s]')].find((x) => x.dataset.s === 'shared').click(); await window.__wait(200);
  pill(/Luftig 18/).click(); await window.__wait(900);
  r.sharedAfter2 = M.store.get('rooms.stue');
  r.effThis = M.store.eff('rooms.stue').gap;
  r.cardGapThis = window.__rom().config.gap;
  return r;
}));
await A.p.waitForTimeout(300);
// Enhet B (PC) ser felles oppsett, ikke telefonens
const B = await open('pc');
await B.p.evaluate(helpers);
Object.assign(res, await B.p.evaluate(async () => ({ pcGap: window.__rom().config.gap, pcDevices: window.MSH.store.devices().map((d) => d.name + (d.current ? '*' : '')) })));
// Tilbake på telefonen: «Bruk felles oppsett» (to trykk = bekreft)
Object.assign(res, await A.p.evaluate(async () => {
  const M = window.MSH; await M.store.refresh(window.__h);
  const bar = M.portals().pop().shadowRoot.querySelector('msh-scope-bar');
  const btn = () => bar.shadowRoot.querySelector('[data-a="clear"]');
  btn().click(); await window.__wait(100); btn().click(); await window.__wait(700);
  const set = document.createElement('msh-settings-card'); set.setConfig({ type: 'custom:msh-settings-card' }); set.hass = window.__h; document.body.appendChild(set); await window.__wait(300);
  return { afterClear: M.store.get('devices.telefon.rooms.stue') || null, gapAfterClear: window.__rom().config.gap, settingsList: set.shadowRoot.textContent.replace(/\s+/g, ' ').match(/Enheter.*?(?=Sebastian)/)?.[0] };
}));
res.errors = [...A.errs, ...B.errs];
await b.close();
console.log(JSON.stringify(res, null, 1));
const ok = res.devAfter && res.devAfter.gap === 4 && !(res.sharedAfter && res.sharedAfter.gap === 4) && res.ownChip
  && res.sharedAfter2 && res.sharedAfter2.gap === 18 && res.effThis === 4 && res.cardGapThis === 4
  && res.pcGap === 18 && !res.afterClear && res.gapAfterClear === 18 && /calc\(var\(--ki-nav-h/.test(res.padBottom) && !res.errors.length;
console.log(ok ? 'OK – oppsett per enhet' : 'FEIL – oppsett per enhet');
process.exit(ok ? 0 : 1);
