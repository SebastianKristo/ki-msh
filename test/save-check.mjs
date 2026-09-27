// Lagring uten navigering: «Tilpass rom» lagrer i ki-store (frontend/set_user_data) ved Ferdig (utkastflyt, fiks
// 15.13) – ingen Lovelace-lagring, ingen rebuild. Eksplisitt Lovelace-lagring (opts.lovelace) → simulert rebuild → popup/editor/scroll gjenopprettes.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readdirSync, existsSync } from 'node:fs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const BC = resolve('test/.vendor/bubble-card.js');
if (!existsSync(BC)) execFileSync('curl', ['-sSL', '-o', BC, 'https://raw.githubusercontent.com/Clooos/Bubble-Card/main/dist/bubble-card.js']);
const bundle = resolve(`test/.build/save-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 390, height: 700 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto('file://' + resolve('test/harness-bubble.html'));
for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
await p.addScriptTag({ path: bundle });
await p.addScriptTag({ path: BC, type: 'module' });
await p.waitForFunction(() => customElements.get('bubble-card'));
const out = await p.evaluate(async () => {
  const wait = (ms) => new Promise((q) => setTimeout(q, ms));
  const res = {};
  const hass = window.mockHass();
  const pop = { type: 'custom:bubble-card', card_type: 'pop-up', hash: '#stue', name: 'Stue', icon: 'mdi:sofa', styles: '.icon-container {background-color:var(--orange)!important;}', cards: [{ type: 'custom:msh-rom-card', card_id: 'rom_stue' }] };
  window.__lc = { views: [{ path: 'hjem', type: 'sections', sections: [{ type: 'grid', cards: [pop] }] }] };
  let saves = 0;
  const ws0 = hass.callWS;
  hass.callWS = (m) => {
    if (m.type === 'lovelace/config') return Promise.resolve(JSON.parse(JSON.stringify(window.__lc)));
    if (m.type === 'lovelace/config/save') {
      saves++; window.__lc = m.config;
      // simulert HA-rebuild: popupen gjenskapes, hashen mistes
      setTimeout(() => {
        document.querySelectorAll('#dash bubble-card').forEach((e) => e.remove());
        history.replaceState(null, '', location.pathname);
        window.dispatchEvent(new CustomEvent('location-changed'));
        mount();
      }, 60);
      return Promise.resolve(null);
    }
    return ws0(m);
  };
  const mount = () => { const cfg = window.__lc.views[0].sections[0].cards[0]; const bc = document.createElement('bubble-card'); bc.setConfig(JSON.parse(JSON.stringify(cfg))); bc.hass = hass; document.getElementById('dash').appendChild(bc); };
  mount();
  await wait(400);
  location.hash = '#stue'; await wait(1200);
  const all = () => { const o = []; const w = (r) => r.querySelectorAll('*').forEach((e) => { o.push(e); if (e.shadowRoot) w(e.shadowRoot); }); w(document); return o; };
  const rom = () => all().find((e) => e.localName === 'msh-rom-card' && e.isConnected);
  const popEl = () => all().find((e) => e.classList && e.classList.contains('bubble-pop-up') && e.isConnected);
  // åpne akkordeoner for å få scroll, og scroll ned
  rom().shadowRoot.querySelectorAll('[data-act="acc"]').forEach((b) => b.click()); await wait(300);
  const sc = () => { const pp = popEl(); const c = pp && pp.querySelector('.bubble-pop-up-container'); return c && c.scrollHeight > c.clientHeight ? c : pp; };
  sc().scrollTop = 150; await wait(100);
  res.scrollBefore = Math.round(sc().scrollTop);
  const first = rom();
  first.customize('spacing'); await wait(300);
  const ed = window.MSH.portals().pop().shadowRoot.querySelector('msh-editor');
  [...ed.shadowRoot.querySelectorAll('.pill')].find((x) => /Tett 4/.test(x.textContent)).click();
  await wait(200);
  res.liveGap = getComputedStyle(first).getPropertyValue('--msh-gap').trim();
  res.savesAfter200ms = saves;
  res.storeGapBeforeDone = (((window.__userData.ki_dashboard || {}).rooms || {}).stue || {}).gap; // ingen autolagring
  ed.shadowRoot.querySelector('[data-a="save"]').click(); // Ferdig: én lagring
  await wait(1800);
  res.lovelaceSaves = saves; // skal være 0 – editorene lagrer i ki-store
  res.storeGap = (((window.__userData.ki_dashboard || {}).rooms || {}).stue || {}).gap;
  res.hash = location.hash;
  res.popupOpen = !!popEl() && popEl().classList.contains('is-popup-opened');
  res.newInstance = rom() !== first;
  res.newGap = rom() && rom()._rawConfig.gap;
  res.editorOpen = window.MSH.portals().length > 0;
  res.scrollAfter = sc() ? Math.round(sc().scrollTop) : null;
  res.savedGap = window.__lc.views[0].sections[0].cards[0].cards[0].gap;
  // romfarge → popupens styles og ikon oppdateres i samme lagring
  rom().setConfig({ ...rom()._rawConfig, look: { col: 'var(--red, #f28073)', icon: 'mdi:knife' } });
  await window.MSH.saveCardConfig(hass, rom()._rawConfig, { ...rom()._rawConfig }, { lovelace: true, immediate: true }); // eksplisitt Lovelace-lagring (rom-look → popup-styles)
  await wait(500);
  const saved = window.__lc.views[0].sections[0].cards[0];
  res.popupStyles = saved.styles; res.popupIcon = saved.icon;
  return res;
});
console.log(JSON.stringify(out, null, 1));
console.log(errs.join('\n') || 'ingen JS-feil');
await b.close();
