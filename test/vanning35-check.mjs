// Fiks 35.8 · Vanning (#vanning) mot ekte Bubble Card, mobil 390 px, mørk OG lys modus (uavhengig av dato/klokkeslett).
//  · Tilpass → Faner: Tannhjul «I toppkortet» (cog_position: top, standard) / «Ved fanene» (tab), Fanestil Fylt / Kontur
//    (tab_look), Faner viser Ikon + tekst / Tekst / Ikoner / Ikon + aktiv (fanevisning) – i arket og i GUI-skjemaet
//  · tannhjulet ved fanene: samme høyde som sporet, vertikalt sentrert, åpner «Tilpass Vanning»; aldri to tannhjul
//  · lys modus: hagescenen er en mørk øy (data-ki-island, lys tekst), fanelinja/kortene får tokens, tekst ≥ 4,5:1;
//    mørk modus = dagens farger
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readdirSync, existsSync, mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const BC = resolve('test/.vendor/bubble-card.js');
mkdirSync(resolve('test/.vendor'), { recursive: true });
if (!existsSync(BC)) execFileSync('curl', ['-sSL', '-o', BC, 'https://raw.githubusercontent.com/Clooos/Bubble-Card/main/dist/bubble-card.js']);
mkdirSync(resolve('test/.build'), { recursive: true });
const bundle = resolve(`test/.build/vanning35-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto('file://' + resolve('test/harness-bubble.html'));
for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
await p.addScriptTag({ path: bundle });
await p.addScriptTag({ path: BC, type: 'module' });
await p.waitForFunction(() => customElements.get('bubble-card'));
await p.evaluate(async () => {
  const wait = (ms) => new Promise((q) => setTimeout(q, ms));
  window.__hass = window.mockHass();
  window.__hass.themes = { ...(window.__hass.themes || {}), darkMode: true };
  const bc = document.createElement('bubble-card');
  bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash: '#vanning', name: 'Vanning', bg_color: '#282828', bg_opacity: 100, bg_blur: 0, cards: [{ type: 'custom:msh-vanning-card', card_id: 'v35' }] });
  bc.hass = window.__hass; document.getElementById('dash').appendChild(bc);
  await wait(400);
  location.hash = '#vanning'; await wait(1500);
  const all = () => { const o = []; const w = (r) => r.querySelectorAll('*').forEach((e) => { o.push(e); if (e.shadowRoot) w(e.shadowRoot); }); w(document); return o; };
  window.__all = all;
  window.__V = () => all().find((e) => e.localName === 'msh-vanning-card' && e.getBoundingClientRect().height > 0);
  window.__set = async (extra) => { const c = window.__V(); c.setConfig({ type: 'custom:msh-vanning-card', card_id: 'v35', ...(extra || {}) }); await wait(300); return c; };
  window.__bg = (el) => {
    for (let n = el; n; n = n.parentElement || (n.getRootNode && n.getRootNode().host)) {
      if (n.nodeType !== 1) continue;
      const P = window.MSH.theme.parse(getComputedStyle(n).backgroundColor);
      if (P && P[3] > 0.5) return getComputedStyle(n).backgroundColor;
    }
    return 'rgb(240, 240, 240)';
  };
  // Lukk øverste ark (trykk på bakteppet = forkast) – aldri Escape, den lukker Bubble-popupen også
  window.__closeSheet = async () => { const pp = window.MSH.portals().pop(); const bg = pp && pp.shadowRoot && pp.shadowRoot.querySelector('.bg'); if (bg) bg.click(); await wait(500); };
  window.__theme = async (light) => {
    window.__hass = { ...window.__hass, themes: { ...(window.__hass.themes || {}), darkMode: !light } };
    all().filter((e) => e.localName === 'bubble-card' || /^msh-/.test(e.localName)).forEach((e) => { try { e.hass = window.__hass; } catch (x) { /* */ } });
    window.MSH.theme.set(light ? 'light' : 'dark');
    await wait(500);
  };
});

const res = {};
const ok = (name, cond, info) => { res[name] = cond ? 'OK' : { FEIL: info }; };

// ---------- 1 · tannhjul: toppkortet (standard) / ved fanene
const cog = await p.evaluate(async () => {
  const wait = (ms) => new Promise((q) => setTimeout(q, ms));
  let c = await window.__set();
  const R = () => c.shadowRoot;
  const top = { inScene: !!R().querySelector('.scene .cog'), atTabs: !!R().querySelector('.trow .cog'), n: R().querySelectorAll('.cog').length };
  c = await window.__set({ cog_position: 'tab' });
  const tb = R().querySelector('.tbox').getBoundingClientRect(), g = R().querySelector('.trow .cog.cog-tab');
  const rg = g ? g.getBoundingClientRect() : null;
  const tab = { inScene: !!R().querySelector('.scene .cog'), atTabs: !!g, n: R().querySelectorAll('.cog').length, trackH: Math.round(tb.height), gearH: rg && Math.round(rg.height), gearW: rg && Math.round(rg.width), dy: rg ? Math.abs((tb.top + tb.height / 2) - (rg.top + rg.height / 2)) : 99 };
  // Høyde følger «Faner viser»
  const hs = {};
  for (const fv of ['begge', 'tekst', 'ikoner', 'aktiv']) {
    c = await window.__set({ cog_position: 'tab', fanevisning: fv });
    const t2 = R().querySelector('.tbox').getBoundingClientRect(), g2 = R().querySelector('.cog-tab').getBoundingClientRect();
    hs[fv] = [Math.round(t2.height), Math.round(g2.height), +Math.abs((t2.top + t2.height / 2) - (g2.top + g2.height / 2)).toFixed(1)];
  }
  // Trykk åpner «Tilpass Vanning»
  const n0 = window.MSH.portals().length;
  R().querySelector('.cog-tab').click(); await wait(500);
  const opened = window.MSH.portals().length > n0;
  await window.__closeSheet();
  return { top, tab, hs, opened };
});
ok('35.8 · standard: tannhjul i toppkortet (hagescenen), ikke ved fanene', cog.top.inScene && !cog.top.atTabs && cog.top.n === 1, cog.top);
ok('35.8 · «Ved fanene»: tannhjul i fanelinja, ikke i toppkortet (aldri to)', !cog.tab.inScene && cog.tab.atTabs && cog.tab.n === 1, cog.tab);
ok('35.8 · tannhjulet ved fanene = sporets høyde, rundt og sentrert (alle «Faner viser»)', Object.values(cog.hs).every(([t, g, dy]) => Math.abs(t - g) <= 1 && dy <= 1) && cog.tab.gearW === cog.tab.gearH, cog.hs);
ok('35.8 · tannhjulet ved fanene åpner «Tilpass Vanning»', cog.opened, cog.opened);

// ---------- 2 · Fanestil + Faner viser
const look = await p.evaluate(async () => {
  let c = await window.__set({ tab_look: 'kontur' });
  const R = () => c.shadowRoot;
  const k = { sh: getComputedStyle(R().querySelector('.tbox')).boxShadow, bg: getComputedStyle(R().querySelector('.tbox')).backgroundColor, look: R().querySelector('.trow').dataset.look };
  c = await window.__set({});
  const f = { sh: getComputedStyle(R().querySelector('.tbox')).boxShadow, look: R().querySelector('.trow').dataset.look };
  const vis = {};
  for (const fv of ['begge', 'tekst', 'ikoner', 'aktiv']) {
    c = await window.__set({ fanevisning: fv });
    const tabs = [...R().querySelectorAll('.tabs .tab')];
    vis[fv] = { n: tabs.length, ic: tabs.filter((t) => t.querySelector('ha-icon')).length, tl: tabs.filter((t) => t.querySelector('.tl')).length, onTl: !!R().querySelector('.tabs .tab.on .tl'), h: Math.round(tabs[0].getBoundingClientRect().height), dir: getComputedStyle(R().querySelector('.tabs .tab.on')).flexDirection };
  }
  c = await window.__set({});
  return { k, f, vis };
});
ok('35.8 · Kontur: inset 1px rgba(255,255,255,.14) på sporet (#3a3a3a)', look.k.look === 'kontur' && /rgba\(255, 255, 255, 0\.14\) 0px 0px 0px 1px inset/.test(look.k.sh) && look.k.bg === 'rgb(58, 58, 58)', look.k);
ok('35.8 · Fylt (standard): ring .05 som før', look.f.look === 'fylt' && /rgba\(255, 255, 255, 0\.05\) 0px 0px 0px 1px inset/.test(look.f.sh), look.f);
const V = look.vis;
ok('35.8 · Faner viser: Ikon + tekst / Tekst / Ikoner / Ikon + aktiv', V.begge.ic === V.begge.n && V.begge.tl === V.begge.n && V.tekst.ic === 0 && V.tekst.tl === V.tekst.n && V.ikoner.tl === 0 && V.ikoner.ic === V.ikoner.n && V.aktiv.ic === V.aktiv.n && V.aktiv.tl === 1 && V.aktiv.onTl && V.aktiv.dir === 'row', V);

// ---------- 3 · «Tilpass Vanning» → Faner: feltene, live i kortet
const ed = await p.evaluate(async () => {
  const wait = (ms) => new Promise((q) => setTimeout(q, ms));
  const c = await window.__set();
  const ui = c.customize(); await wait(500);
  const E = ui.editor, R = E.shadowRoot;
  const opts = (n) => [...R.querySelectorAll(`[data-a="sel"][data-name="${n}"]`)].map((x) => x.textContent.trim());
  const o = { cog: opts('cog_position'), look: opts('tab_look'), vis: opts('fanevisning') };
  R.querySelector('[data-a="sel"][data-name="cog_position"][data-v="tab"]').click(); await wait(400);
  o.liveCog = !!c.shadowRoot.querySelector('.trow .cog-tab') && !c.shadowRoot.querySelector('.scene .cog');
  R.querySelector('[data-a="sel"][data-name="tab_look"][data-v="kontur"]').click(); await wait(400);
  o.liveLook = c.shadowRoot.querySelector('.trow').dataset.look;
  o.draft = { cog: E._config.cog_position, look: E._config.tab_look };
  // Arkets mellomrom (felles editor): seksjoner/felter står ikke klistret
  const fs = [...R.querySelectorAll('.f, .sec, details')].filter((x) => x.getBoundingClientRect().height > 0 && x.parentElement && x.parentElement.closest && !x.parentElement.closest('.f'));
  const gaps = fs.slice(1).map((x, i) => Math.round(x.getBoundingClientRect().top - fs[i].getBoundingClientRect().bottom)).filter((d) => d >= -1 && d < 60);
  o.minGap = gaps.length ? Math.min(...gaps) : null;
  const sch = window.customElements.get('msh-vanning-card').schema(window.__hass, {});
  const tabs = sch[0].tabs.find((t) => t.key === 'faner').fields.filter((f) => f.name).map((f) => f.name);
  o.gui = tabs;
  await window.__closeSheet();
  return o;
});
ok('35.8 · Tilpass → Faner: Tannhjul «I toppkortet»/«Ved fanene», Fanestil «Fylt»/«Kontur», Faner viser (4 valg)', ed.cog.join() === 'I toppkortet,Ved fanene' && ed.look.join() === 'Fylt,Kontur' && ed.vis.join() === 'Ikon + tekst,Tekst,Ikoner,Ikon + aktiv', ed);
ok('35.8 · valgene vises live i kortet og ligger i utkastet (cog_position / tab_look)', ed.liveCog && ed.liveLook === 'kontur' && ed.draft.cog === 'tab' && ed.draft.look === 'kontur', ed);
ok('35.8 · GUI-editoren (schema) har cog_position, tab_look og fanevisning', ['cog_position', 'tab_look', 'fanevisning'].every((n) => ed.gui.includes(n)), ed.gui);
ok('33.7 · Tilpass Vanning: ingen felt/seksjoner klistret sammen (≥ 8 px)', ed.minGap == null || ed.minGap >= 8, ed.minGap);

// ---------- 4 · lys modus: øy, tokens, kontrast; mørk tilbake
const light = await p.evaluate(async () => {
  const wait = (ms) => new Promise((q) => setTimeout(q, ms));
  await window.__set({ tab_look: 'kontur', cog_position: 'tab' });
  await window.__theme(true);
  const c = window.__V(), R = c.shadowRoot, sc = R.querySelector('.scene');
  const out = { html: document.documentElement.getAttribute('data-ki-theme'), island: sc.hasAttribute('data-ki-island'), sceneBg: getComputedStyle(sc).backgroundImage.slice(0, 60), title: getComputedStyle(sc.querySelector('.tittel')).color,
    tbox: getComputedStyle(R.querySelector('.tbox')).backgroundColor, ring: getComputedStyle(R.querySelector('.tbox')).boxShadow, gear: getComputedStyle(R.querySelector('.cog-tab')).backgroundColor };
  const bad = [];
  for (const t of [...R.querySelectorAll('.tabs .tab')]) {
    t.click(); await wait(400);
    window.__all().filter((e) => R.contains(e) || (e.getRootNode && e.getRootNode().host && c.shadowRoot.contains(e.getRootNode().host))).forEach((e) => {
      if (!e.getBoundingClientRect || !e.getBoundingClientRect().height) return;
      if (![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) return;
      if (e.closest && (e.closest('[data-ki-island]') || e.closest('.tab.on'))) return;
      const cls = String(e.getAttribute('class') || '');
      if (/msh-stp/.test(cls)) return; // felles stepper (09-pickers.js, agent T)
      const cr = window.MSH.theme.contrast(getComputedStyle(e).color, window.__bg(e));
      if (cr < 4.5 && window.__bg(e) !== 'rgb(35, 35, 35)') bad.push([t.getAttribute('aria-label'), e.localName + '.' + cls.split(' ')[0], e.textContent.trim().slice(0, 20), +cr.toFixed(2)]);
    });
  }
  out.bad = bad;
  const offs = [...R.querySelectorAll('.tabs .tab:not(.on)')];
  out.tabMin = Math.min(...offs.map((e) => window.MSH.theme.contrast(getComputedStyle(e).color, getComputedStyle(R.querySelector('.tbox')).backgroundColor)));
  R.querySelector('.tabs .tab').click(); await wait(300);
  await window.__theme(false);
  out.dark = { tbox: getComputedStyle(R.querySelector('.tbox')).backgroundColor, off: getComputedStyle(R.querySelector('.tabs .tab:not(.on)')).color, title: getComputedStyle(R.querySelector('.scene .tittel')).color };
  await window.__set({});
  return out;
});
ok('lys · hagescenen er mørk øy (data-ki-island): mørk gradient, lys tittel', light.html === 'light' && light.island && /gradient/.test(light.sceneBg) && light.title === 'rgb(234, 246, 255)', light);
ok('lys · fanelinja/tannhjul hvite (--ki-surface), Kontur-ring mørk, inaktive faner ≥ 4,5:1', light.tbox === 'rgb(255, 255, 255)' && light.gear === 'rgb(255, 255, 255)' && /rgba\(0, 0, 0/.test(light.ring) && light.tabMin >= 4.5, { tbox: light.tbox, gear: light.gear, ring: light.ring, min: light.tabMin });
ok('lys · all tekst i alle fanene ≥ 4,5:1 (utenfor øyene)', !light.bad.length, light.bad);
ok('mørk igjen uten reload: fanelinje #3a3a3a, inaktiv #979797', light.dark.tbox === 'rgb(58, 58, 58)' && light.dark.off === 'rgb(151, 151, 151)', light.dark);

ok('ingen sidefeil', !errs.length, errs);
await b.close();
console.log(JSON.stringify(res, null, 1));
const bad = Object.values(res).filter((v) => v !== 'OK').length;
console.log(bad ? `\n${bad} feilet` : '\nAlle bestod');
process.exit(bad ? 1 : 0);
