// Fiks 17.28 / 17.29 / 17.31 · #klima mot ekte Bubble Card: mellomrom (gap/pad_top/pad_bottom) live fra «Tilpass klima»,
// toppkort-stilene (ring/hus/batteri/maaler/puls/blokker) og hovedbryteren i Varslinger (lukket kort).
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readdirSync, existsSync, mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const BC = resolve('test/.vendor/bubble-card.js');
if (!existsSync(BC)) execFileSync('curl', ['-sSL', '-o', BC, 'https://raw.githubusercontent.com/Clooos/Bubble-Card/main/dist/bubble-card.js']);
mkdirSync(resolve('test/.build'), { recursive: true });
const bundle = resolve(`test/.build/klima17-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const SHOTS = process.env.SHOTS || '';
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto('file://' + resolve('test/harness-bubble.html'));
for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
await p.addScriptTag({ path: bundle });
await p.addScriptTag({ path: BC, type: 'module' });
await p.waitForFunction(() => customElements.get('bubble-card'));
if (SHOTS) await p.exposeFunction('__SHOT', (s) => p.screenshot({ path: `${SHOTS}/klima-${s}.png` }));
await p.evaluate(async () => {
  const wait = (ms) => new Promise((q) => setTimeout(q, ms));
  window.__hass = window.mockHass();
  window.__calls = [];
  const cs = window.__hass.callService;
  window.__hass.callService = (d, s, data) => { window.__calls.push([d, s, JSON.parse(JSON.stringify(data || {}))]); return cs ? cs.call(window.__hass, d, s, data) : Promise.resolve(); };
  const bc = document.createElement('bubble-card');
  bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash: '#klima', name: 'Klima', bg_color: '#282828', bg_opacity: 100, bg_blur: 0, cards: [{ type: 'custom:msh-klima-card', card_id: 'k1' }] });
  bc.hass = window.__hass; document.getElementById('dash').appendChild(bc);
  await wait(400);
  location.hash = '#klima'; await wait(1500);
});
const res = await p.evaluate(async () => {
  const wait = (ms) => new Promise((q) => setTimeout(q, ms));
  const all = () => { const o = []; const w = (r) => r.querySelectorAll('*').forEach((e) => { o.push(e); if (e.shadowRoot) w(e.shadowRoot); }); w(document); return o; };
  const find = () => all().find((e) => e.localName === 'msh-klima-card' && e.getBoundingClientRect().height > 0);
  let k = find();
  const hero = () => k.shadowRoot.querySelector('msh-klima-hero-card');
  const hdr = () => all().filter((e) => e.classList && e.classList.contains('bubble-header-container')).find((e) => e.getBoundingClientRect().height > 0).getBoundingClientRect().bottom;
  const top = () => Math.round(k.getBoundingClientRect().top - hdr());
  const gap = () => { const h = hero(), m = k.shadowRoot.querySelector('.wrap > *:not(:empty)'); return Math.round(m.getBoundingClientRect().top - h.getBoundingClientRect().bottom); };
  const r = { standard: { top: top(), gap: gap(), padBottom: getComputedStyle(k).paddingBottom } };
  // «Tilpass klima» → Mellomrom (live)
  k.customize(); await wait(300);
  const ov = window.MSH.portals().pop(), sh = ov.shadowRoot || ov;
  const box = sh.querySelector('.klima-sheet');
  r.sheet = { sliders: box.querySelectorAll('input[data-sp]').length, heroOpts: [...box.querySelectorAll('.hso')].map((x) => x.textContent.trim()) };
  const slide = (name, v) => { const i = box.querySelector(`input[data-sp="${name}"]`); i.value = String(v); i.dispatchEvent(new Event('input', { bubbles: true })); };
  slide('pad_top', -4); await wait(200); r.liveTop = top();
  slide('pad_top', 44); await wait(200); r.liveTop44 = top();
  slide('gap', 24); await wait(200); r.liveGap = gap();
  box.querySelector('[data-a="sp"][data-k="pad_bottom"][data-v="96"]').click(); await wait(200);
  r.livePadBottom = getComputedStyle(k).paddingBottom;
  // 17.29: bytt stil live
  r.styles = {};
  for (const s of ['hus', 'batteri', 'maaler', 'puls', 'blokker', 'ring']) {
    box.querySelector(`.hso[data-v="${s}"]`).click(); await wait(350);
    const hs = hero().shadowRoot, kh = hs.querySelector('.kh');
    r.styles[s] = { style: kh && (kh.dataset.style || 'ring'), h: Math.round(kh.getBoundingClientRect().height), anims: hs.getAnimations().filter((a) => a.playState === 'running').length, txt: kh.textContent.replace(/\s+/g, ' ').trim().slice(0, 140) };
    if (window.__SHOT) { ov.style.visibility = 'hidden'; k.scrollIntoView(); await wait(900); await window.__SHOT(s); ov.style.visibility = ''; }
  }
  if (window.__SHOT) { box.querySelector('input[data-sp]').scrollIntoView(); await wait(200); await window.__SHOT('ark'); }
  box.querySelector(`.hso[data-v="maaler"]`).click(); await wait(200);
  r.draft = { ...box._config };
  box.querySelector('[data-a="done"]').click(); await wait(1200);
  r.saved = { hero_style: k._rawConfig.hero_style, gap: k._rawConfig.gap, pad_top: k._rawConfig.pad_top, pad_bottom: k._rawConfig.pad_bottom };
  // Lukket popup: animasjonene står stille
  history.replaceState(null, '', location.pathname); window.dispatchEvent(new Event('hashchange')); await wait(900);
  r.closedRun = hero().hasAttribute('data-run');
  location.hash = '#klima'; await wait(1300);
  k = find() || k;
  r.openRun = hero().hasAttribute('data-run');
  r.reopen = { kh: Math.round(k.getBoundingClientRect().height), conn: k.isConnected, open: k.isOpen, hash: location.hash, heroOpen: hero().isOpen };
  // 17.31: Varslinger (fanen Oppsett), lukk kortet → hovedbryter
  k._selectTab('oppsett'); await wait(300);
  const sec = () => k.shadowRoot.querySelector('section.kb[data-block="varslinger"]');
  r.varslerOpen = { master: !!sec().querySelector('.kb-msw') };
  if (!sec().classList.contains('is-col')) { sec().querySelector('.kb-h').click(); await wait(300); }
  const msw = () => sec().querySelector('.kb-msw');
  r.varslerClosed = { master: !!msw(), meta: sec().querySelector('.kb-m').textContent.trim(), on: msw() && msw().classList.contains('on'), w: msw() && Math.round(msw().getBoundingClientRect().width), h: msw() && Math.round(msw().getBoundingClientRect().height) };
  window.__calls.length = 0;
  msw().click(); await wait(300);
  r.masterCalls = window.__calls.slice();
  r.stillClosed = sec().classList.contains('is-col');
  return r;
});
console.log(JSON.stringify(res, null, 1));
const st = res.styles || {};
const ok = !errs.length && res.sheet.sliders === 3 && res.sheet.heroOpts.join(',') === 'Ringer,Hus,Batteri,Måler,Puls,Klosser'
  && Math.abs(res.liveTop - -4) <= 2 && Math.abs(res.liveTop44 - 44) <= 2 && Math.abs(res.liveGap - 24) <= 1 && Math.round(parseFloat(res.livePadBottom) - parseFloat(res.standard.padBottom)) === 56
  && ['hus', 'batteri', 'maaler', 'puls', 'blokker'].every((s) => st[s] && st[s].style === s && st[s].h > 100) && st.ring.style === 'ring'
  && res.saved.hero_style === 'maaler' && res.saved.gap === 24 && res.saved.pad_top === 44 && res.saved.pad_bottom === 96
  && res.closedRun === false && res.openRun === true
  && !res.varslerOpen.master && res.varslerClosed.master && res.varslerClosed.w === 44 && res.varslerClosed.h === 26 && res.masterCalls.length >= 1 && res.stillClosed;
console.log(ok ? '✔ klima17' : '✘ klima17', errs.slice(0, 4).join(' | '));
await b.close();
process.exit(ok ? 0 : 1);
