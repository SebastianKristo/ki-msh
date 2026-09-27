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
    res.storeGap = (((window.__userData.ki_dashboard || {}).cards || {})['room-stue'] || {}).gap;
    const rom = all().find((e) => e.localName === 'msh-rom-card' && e.isConnected && e.getBoundingClientRect().height > 0);
    res.liveGap = rom && rom._rawConfig.gap;
    res.hashAfter = location.hash;
    res.editorStillOpen = window.MSH.portals().length > 0;
    return res;
  }, vp);
  const hashes = r.popups.split(' '); const unique = new Set(hashes).size === hashes.length;
  const ok = !errs.length && unique && r.oneCardEach && r.newArea && r.excluded && r.opened.every((x) => /åpen\/1kort\/header\/innhold/.test(x)) && r.editors.every((x) => /åpen z=9000/.test(x)) && r.saveCalls === 'frontend/set_user_data' && r.storeGap === 18 && r.hashAfter === '#stue' && r.editorStillOpen;
  if (!ok) fail++;
  console.log(`${ok ? '✔' : '✘'} [${vp.n}]`, JSON.stringify(r, null, 1), errs.slice(0, 3).join(' | '));
  await p.close();
}
await b.close();
process.exit(fail ? 1 : 0);
