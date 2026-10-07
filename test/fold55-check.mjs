// Fiks 55 B (Samsung Fold): navbar-modus fra dashbord-containeren + «Tittel per skjerm».
//  B2 · navbar: 360 → 1080×1200 → rotert 1200×1080 → tilbake; appen skjult/synlig (visibilitychange med gammel størrelse
//       i første bilde, så riktig); omstart i liggende modus (panelet uten layout ved start). Navbaren finnes i HVERT
//       bilde (rAF-sampling), riktig modus per størrelse, railen er loddrett sentrert og ikke kuttet, bytte av modus
//       beholder samme <nav>-node, Now Playing står til høyre for railen uten overlapp.
//  B3 · tittel per skjermtype (header.per_screen): riktig px per type, ingen vw/cqw/clamp-skalering, to linjer før «…»,
//       «Tilpass header» → «Tittel per skjerm» (faner, lagring i per_screen, speiling i GUI-editoren) og forhåndsvisning.
// Kjør: node test/fold55-check.mjs   (SHOT_DIR=… for skjermbilder)
import { createRequire } from 'node:module';
import { readdirSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/fold55-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = [];
const ok = (name, cond, info) => res.push(`${cond ? '✔' : '✘'} ${name}${info != null ? ' · ' + JSON.stringify(info) : ''}`);
const SHOT = process.env.SHOT_DIR;
const wait = (p, ms) => p.waitForTimeout(ms);

async function page(vp, touch) {
  const p = await b.newPage({ viewport: vp, hasTouch: touch });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.__errs = errs;
  await p.goto('file://' + resolve('test/harness.html'));
  for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
  await p.addScriptTag({ path: bundle });
  await p.evaluate(() => {
    window.deepAll = (sel) => { const out = []; const walk = (root) => root.querySelectorAll('*').forEach((e) => { if (e.matches(sel)) out.push(e); if (e.shadowRoot) walk(e.shadowRoot); }); walk(document); return out; };
    window.deep = (sel) => window.deepAll(sel)[0] || null;
    window.rect = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { l: +r.left.toFixed(1), t: +r.top.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1), b: +r.bottom.toFixed(1), r: +r.right.toFixed(1) }; };
    // Synlighet kan styres i testen (Android: appen i bakgrunnen)
    window.__vis = 'visible';
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__vis });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.__vis === 'hidden' });
    window.setVis = (v) => { window.__vis = v; document.dispatchEvent(new Event('visibilitychange')); };
    // rAF-sampling: navbaren i hvert bilde (finnes, i vinduet, modus, samme node)
    window.__S = null;
    window.sampleStart = () => {
      window.__S = [];
      const tick = () => {
        if (!window.__S) return;
        const n = deep('nav.nb'), r = n && n.getBoundingClientRect();
        const vis = !!(n && n.isConnected && r.width > 0 && r.height > 0 && r.top >= -0.5 && r.left >= -0.5 && r.bottom <= innerHeight + 0.5 && r.right <= innerWidth + 0.5 && getComputedStyle(n).display !== 'none' && getComputedStyle(n).visibility !== 'hidden');
        window.__S.push({ vis, ex: !!(n && n.isConnected), bg: window.__vis === 'hidden' || document.getElementById('dash').style.display === 'none', rail: !!(n && n.classList.contains('rail')), same: !!(n && window.__nav0 && n === window.__nav0), w: innerWidth, h: innerHeight });
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    window.sampleStop = () => { const s = window.__S || []; window.__S = null; return s; };
  });
  return p;
}
async function mount(p, opt = {}) {
  await p.evaluate(async (opt) => {
    const H = window.mockHass(), S = H.states; window.__H = H;
    Object.keys(S).filter((k) => k.startsWith('media_player.')).forEach((k) => { S[k] = { ...S[k], state: 'off' }; });
    S['media_player.kjokken_radio'] = { ...S['media_player.kjokken_radio'], state: 'playing', last_changed: new Date().toISOString() };
    const dash = document.getElementById('dash');
    if (opt.hideDash) dash.style.display = 'none';
    // kortene i en stabel (som HAs vertical-stack) – ikke direkte i #dash (der kjører mockens egen navbar-selvtest)
    const d = document.createElement('div'); d.className = 'stack'; dash.appendChild(d);
    const hj = document.createElement('msh-hjem-card'); hj.setConfig({ type: 'custom:msh-hjem-card', card_id: 'ki-home', cards: { header: { type: 'custom:msh-hjem-header-card', card_id: 'ki-home-header', servere: 'Oslo, Toten', ...(opt.header || {}) } } }); hj.hass = H; d.appendChild(hj);
    const nb = document.createElement('msh-navbar-card'); nb.setConfig({ type: 'custom:msh-navbar-card', card_id: 'ki-navbar' }); nb.hass = H; d.appendChild(nb);
    await new Promise((q) => setTimeout(q, opt.hideDash ? 400 : 1200));
  }, opt);
}
const navInfo = (p) => p.evaluate(() => {
  const n = deep('nav.nb'), mini = deep('[data-mini]'), dash = document.getElementById('dash');
  if (!window.__nav0 && n) window.__nav0 = n;
  const cs = n && getComputedStyle(n);
  return { nav: rect(n), rail: !!(n && n.classList.contains('rail')), same: !!(n && n === window.__nav0), dash: rect(dash), vh: innerHeight, vw: innerWidth,
    mini: mini && !mini.classList.contains('off') ? rect(mini) : null, ovY: cs && cs.overflowY, maxH: cs && cs.maxHeight };
});
const checkRail = (name, m) => {
  const c = (m.nav.t + m.nav.b) / 2, dc = (m.dash.t + m.vh) / 2;
  ok(`${name}: venstre-rail`, m.rail, m.nav);
  ok(`${name}: railen loddrett sentrert på flaten (ikke i hjørnet)`, Math.abs(c - dc) < 2, { navMid: c, flateMid: dc });
  ok(`${name}: railen ikke kuttet (innenfor flaten, ≥ 16 px luft)`, m.nav.t >= m.dash.t + 15.5 && m.nav.b <= m.vh - 15.5 && m.nav.l >= m.dash.l, m.nav);
  ok(`${name}: mini-spilleren til høyre for railen, ingen overlapp`, !m.mini || (m.mini.l >= m.nav.r + 8 && m.mini.b <= m.vh), { mini: m.mini, nav: m.nav });
};
const frames = async (p, fn, ms) => { await p.evaluate(() => window.sampleStart()); await fn(); await wait(p, ms || 600); return p.evaluate(() => window.sampleStop()); };
const allVis = (S) => S.length > 0 && S.every((x) => x.vis);

/* ------------------------------------------------------------ B2 · navbar */
{
  const p = await page({ width: 360, height: 780 }, true);
  await mount(p);
  let m = await navInfo(p);
  ok('360: bunnlinje', !m.rail && m.nav && m.nav.b <= 780, m.nav);
  const S1 = await frames(p, async () => { await p.setViewportSize({ width: 1080, height: 1200 }); }, 900);
  m = await navInfo(p);
  ok('360 → 1080×1200: navbaren synlig i hvert bilde', allVis(S1), { n: S1.length, miss: S1.filter((x) => !x.vis).length });
  ok('360 → 1080×1200: samme <nav>-node (klassebytte, aldri ny node)', S1.every((x) => x.same) && m.same);
  checkRail('1080×1200', m);
  ok('rail: høyde max-content med tak calc(100% − 32 px) og intern scroll', m.ovY === 'auto' && /px/.test(m.maxH) && m.nav.h < m.vh - 32, { ovY: m.ovY, maxH: m.maxH, h: m.nav.h });
  if (SHOT) await p.screenshot({ path: `${SHOT}/f55-1080x1200.png` });
  // rotasjon (Android: resize + orientationchange)
  const S2 = await frames(p, async () => { await p.setViewportSize({ width: 1200, height: 1080 }); await p.evaluate(() => window.dispatchEvent(new Event('orientationchange'))); }, 900);
  m = await navInfo(p);
  ok('rotert 1200×1080: navbaren synlig i hvert bilde, samme node', allVis(S2) && S2.every((x) => x.same), { n: S2.length, miss: S2.filter((x) => !x.vis).length });
  checkRail('1200×1080', m);
  if (SHOT) await p.screenshot({ path: `${SHOT}/f55-1200x1080.png` });
  const S3 = await frames(p, async () => { await p.setViewportSize({ width: 1080, height: 1200 }); await p.evaluate(() => window.dispatchEvent(new Event('orientationchange'))); }, 900);
  m = await navInfo(p);
  ok('tilbake 1080×1200: synlig i hvert bilde', allVis(S3), { miss: S3.filter((x) => !x.vis).length });
  checkRail('tilbake 1080×1200', m);
  const S4 = await frames(p, async () => { await p.setViewportSize({ width: 360, height: 780 }); }, 900);
  m = await navInfo(p);
  ok('1080 → 360: bunnlinje igjen, synlig i hvert bilde, samme node', !m.rail && allVis(S4) && S4.every((x) => x.same) && m.same, { rail: m.rail, miss: S4.filter((x) => !x.vis).length });

  // Appbytte: skjult (panelet uten layout) → rotert mens skjult → synlig med gammel størrelse i første bilde
  await p.setViewportSize({ width: 1080, height: 1200 }); await wait(p, 700);
  const S5 = await frames(p, async () => {
    await p.evaluate(async () => {
      window.setVis('hidden');
      document.getElementById('dash').style.display = 'none'; // WebView i bakgrunnen: ingen layout
      deep('msh-navbar-card').update(); // hass-oppdatering mens appen er skjult
      await new Promise((q) => setTimeout(q, 300));
    });
    await p.setViewportSize({ width: 1200, height: 1080 }); await wait(p, 300);
    await p.evaluate(async () => {
      const d = document.getElementById('dash'), real = d.getBoundingClientRect.bind(d);
      d.style.display = '';
      // Android: første bildet etter retur rapporterer gammel størrelse (1080×1200)
      d.getBoundingClientRect = () => ({ left: 0, top: 0, right: 1080, bottom: 1200, width: 1080, height: 1200, x: 0, y: 0 });
      window.setVis('visible');
      requestAnimationFrame(() => { d.getBoundingClientRect = real; delete d.getBoundingClientRect; });
    });
  }, 1200);
  m = await navInfo(p);
  const fg = S5.filter((x) => !x.bg);
  ok('appbytte (skjult → synlig): navbaren der i hvert bilde etter retur', fg.length > 10 && allVis(fg), { n: fg.length, miss: fg.filter((x) => !x.vis).map((x) => x.w + 'x' + x.h) });
  ok('appbytte: navbaren aldri fjernet fra DOM mens appen er skjult', S5.every((x) => x.ex), { miss: S5.filter((x) => !x.ex).length });
  checkRail('appbytte → 1200×1080', m);
  ok('B2: ingen sidefeil', !p.__errs.length, p.__errs);
  await p.close();
}
// Omstart i liggende modus: panelet har ingen layout når kortene lages (splash), vises etterpå
{
  const p = await page({ width: 1200, height: 1080 }, true);
  await mount(p, { hideDash: true });
  const S = await frames(p, async () => { await p.evaluate(() => { document.getElementById('dash').style.display = ''; }); }, 900);
  const shown = S.filter((x) => !x.bg), first = shown.findIndex((x) => x.vis); // bildene etter at panelet fikk layout
  const m = await navInfo(p);
  ok('omstart liggende: navbaren der fra første bilde(r) etter splash (≤ 2 bilder)', first >= 0 && first <= 2 && shown.slice(first).every((x) => x.vis), { first, n: shown.length });
  checkRail('omstart 1200×1080', m);
  // og appen startet «skjult» (visibilityState hidden ved oppstart)
  ok('omstart: ingen sidefeil', !p.__errs.length, p.__errs);
  await p.close();
}
// Telefon og PC uendret: telefon = bunn, PC (mus) 1440 = rail, PC-vindu 840 mus = bunn (som før)
for (const [n, w, h, touch, rail] of [['telefon390', 390, 844, true, false], ['pc1440', 1440, 900, false, true], ['mus840', 840, 880, false, false]]) {
  const p = await page({ width: w, height: h }, touch);
  await mount(p);
  const m = await navInfo(p);
  ok(`${n}: ${rail ? 'rail' : 'bunnlinje'} (uendret)`, m.rail === rail, m.nav);
  if (rail) checkRail(n, m);
  await p.close();
}

/* ------------------------------------------------------------ B3 · tittel per skjerm */
const hdr = (p) => p.evaluate(() => {
  const H = deepAll('msh-hjem-header-card').find((e) => e.getBoundingClientRect().width > 0 && !(e.parentElement && e.parentElement.classList.contains('xpvi')));
  const R = H.shadowRoot, tx = R.querySelector('.ttl .tx'), cs = getComputedStyle(tx), ttl = R.querySelector('.ttl');
  const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.15;
  return { ps: R.querySelector('.hd').dataset.ps, text: tx.textContent, fs: parseFloat(cs.fontSize), style: ttl.getAttribute('style') || '', lines: Math.round(tx.getBoundingClientRect().height / lh),
    clamp: cs.webkitLineClamp, cut1: cs.whiteSpace === 'nowrap' && tx.scrollWidth > tx.clientWidth + 1, overflow2: tx.scrollHeight > tx.clientHeight + 1,
    faces: R.querySelectorAll('.faces .face').length, wrap: !!R.querySelector('.hd.hwrap'), shown: getComputedStyle(ttl).display !== 'none' };
});
{
  const PS = { phone: { size: 26 }, unfolded: { size: 32, title: 'navn' }, desktop: { size: 34 } };
  const p = await page({ width: 360, height: 780 }, true);
  await mount(p, { header: { per_screen: PS } });
  let h = await hdr(p);
  ok('telefon 360: skjermtype phone, 26 px fast', h.ps === 'phone' && Math.abs(h.fs - 26) < 0.1 && h.text === '👋 Sebastian!', h);
  const rd0 = await p.evaluate(() => deep('msh-hjem-card').renders || 0);
  await p.evaluate(() => { const hj = deep('msh-hjem-card'); window.__hjR = 0; const o = hj._render.bind(hj); hj._render = () => { window.__hjR++; o(); }; const H = deepAll('msh-hjem-header-card')[0]; window.__hd0 = H.shadowRoot.querySelector('.ttl'); });
  await p.setViewportSize({ width: 1080, height: 1200 }); await wait(p, 800);
  h = await hdr(p);
  const same = await p.evaluate(() => deepAll('msh-hjem-header-card')[0].shadowRoot.querySelector('.ttl') === window.__hd0);
  ok('bretting → 1080×1200: Fold åpen, «Bare navn», 32 px', h.ps === 'unfolded' && h.text === 'Sebastian' && Math.abs(h.fs - 32) < 0.1, h);
  ok('bytte av skjermtype: tittel-noden beholdes (morph, ingen blink)', same, rd0);
  ok('ingen vw/cqw/clamp i tittelstilen', !/vw|cqw|clamp/.test(h.style), h.style);
  await p.setViewportSize({ width: 900, height: 1200 }); await wait(p, 600);
  const h9 = await hdr(p);
  ok('fast px: samme størrelse ved 900 og 1080 px (skalerer ikke med bredden)', Math.abs(h9.fs - h.fs) < 0.1, [h9.fs, h.fs]);
  await p.setViewportSize({ width: 1200, height: 1080 }); await wait(p, 800);
  h = await hdr(p);
  ok('rotert 1200×1080 (nær kvadratisk): fortsatt Fold åpen, ikke kuttet på én linje', h.ps === 'unfolded' && !h.cut1 && !h.overflow2, h);
  await p.setViewportSize({ width: 360, height: 780 }); await wait(p, 800);
  h = await hdr(p);
  ok('tilbake til telefon: hilsen + navn, 26 px', h.ps === 'phone' && h.text === '👋 Sebastian!' && Math.abs(h.fs - 26) < 0.1, h);
  ok('B3 bretting: ingen sidefeil', !p.__errs.length, p.__errs);
  await p.close();
}
// PC (mus, 1440) – desktop 34 px; standard uten per_screen: Fold åpen 30 px, «Stor hilsen» fast px (ingen cqw)
{
  const p = await page({ width: 1440, height: 900 }, false);
  await mount(p, { header: { per_screen: { desktop: { size: 34 } } } });
  let h = await hdr(p);
  ok('PC 1440 (mus): skjermtype desktop, 34 px', h.ps === 'desktop' && Math.abs(h.fs - 34) < 0.1, h);
  await p.close();
}
{
  const p = await page({ width: 1080, height: 1200 }, true);
  await mount(p, { header: { mode: 'stor' } });
  let h = await hdr(p);
  ok('Stor hilsen på Fold åpen: fast 30 px, ingen cqw/clamp', Math.abs(h.fs - 30) < 0.1 && !/vw|cqw|clamp/.test(h.style), h);
  await p.evaluate(() => { const H = deepAll('msh-hjem-header-card')[0]; H.setConfig({ ...H._rawConfig, mode: 'hilsen' }); });
  await wait(p, 500);
  h = await hdr(p);
  ok('Hilsen på Fold åpen uten eget oppsett: standard 30 px', Math.abs(h.fs - 30) < 0.1, h);
  await p.close();
}
// Lang tekst: to linjer før «…» (aldri «Sebast…» på én linje når to får plass)
{
  const p = await page({ width: 360, height: 780 }, true);
  await mount(p, { header: { per_screen: { phone: { size: 34, title: 'egen', text: '{hilsen}, Sebastian Kristoffersen' } } } });
  const h = await hdr(p);
  ok('lang tekst på telefon: brytes til to linjer, ingen ellipse på én linje', h.lines === 2 && h.clamp === '2' && !h.cut1, h);
  // Vis emoji av / avatarer av / ingen tittel
  await p.evaluate(() => { const H = deepAll('msh-hjem-header-card')[0]; H.setConfig({ ...H._rawConfig, per_screen: { phone: { emoji: false, avatars: false } } }); });
  await wait(p, 500);
  const h2 = await hdr(p);
  ok('emoji av + avatarer av', h2.text === 'Sebastian!' && h2.faces === 0, h2);
  await p.evaluate(() => { const H = deepAll('msh-hjem-header-card')[0]; H.setConfig({ ...H._rawConfig, per_screen: { phone: { title: 'ingen', prose: false } } }); });
  await wait(p, 600);
  const h3 = await hdr(p), pr = await p.evaluate(() => { const s = deep('msh-hjem-card').shadowRoot.querySelector('[data-slot="prosa"]'); return getComputedStyle(s).display; });
  ok('ingen tittel + oppsummeringsteksten av', !h3.shown && pr === 'none', { shown: h3.shown, prosa: pr });
  await p.evaluate(() => { const H = deepAll('msh-hjem-header-card')[0]; H.setConfig({ ...H._rawConfig, per_screen: { phone: { prose_lines: 2 } } }); });
  await wait(p, 600);
  const pl = await p.evaluate(() => { const s = deep('msh-hjem-card').shadowRoot.querySelector('[data-slot="prosa"]'); const pz = s.firstElementChild.shadowRoot.querySelector('.pz'); const lh = parseFloat(getComputedStyle(pz).lineHeight); return { h: s.getBoundingClientRect().height, lh, full: pz.getBoundingClientRect().height, disp: getComputedStyle(s).display }; });
  ok('oppsummeringsteksten maks 2 linjer', pl.disp !== 'none' && pl.h <= pl.lh * 2 + 3 && pl.h >= pl.lh * 1.5, pl);
  ok('B3 tekst: ingen sidefeil', !p.__errs.length, p.__errs);
  await p.close();
}
// «Tilpass header» → «Tittel per skjerm»: faner, lagring i header.per_screen, forhåndsvisning, speiling i GUI-editoren
{
  const p = await page({ width: 1080, height: 1200 }, true);
  await mount(p);
  const r = await p.evaluate(async () => {
    const W = (ms) => new Promise((q) => setTimeout(q, ms));
    const H = deepAll('msh-hjem-header-card')[0];
    H.customize(); await W(600);
    const E = deepAll('msh-hjem-editor')[0], R = E.shadowRoot, out = {};
    const pv = () => { const x = R.querySelector('[data-pspv]'); return x && { t: x.dataset.pspv, fs: parseFloat(getComputedStyle(x.querySelector('.pstx')).fontSize), txt: x.querySelector('.pstx').textContent.trim() }; };
    out.pv0 = pv();
    out.top = (() => { const x = R.querySelector('[data-pspv]'), first = R.querySelector('.sec, details'); return !!x && (!first || (x.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING) > 0); })();
    const sec = R.querySelector('details[data-sec="id:per_screen"]'); if (sec) { sec.open = true; E._open['id:per_screen'] = true; E._render(); await W(100); }
    out.sec = !!sec && sec.querySelector('summary').textContent.trim();
    out.tabs = [...R.querySelectorAll('[data-a="tab"][data-k="ps"]')].map((b) => b.textContent.trim());
    const tab = (v) => R.querySelector(`[data-a="tab"][data-k="ps"][data-v="${v}"]`);
    out.sel0 = (R.querySelector('[data-a="tab"][data-k="ps"].on') || {}).dataset;
    out.sel0 = out.sel0 && out.sel0.v;
    tab('unfolded').click(); await W(150);
    R.querySelector('[data-a="sel"][data-name="per_screen.unfolded.title"][data-v="navn"]').click(); await W(150);
    const rg = R.querySelector('input[type=range][data-name="per_screen.unfolded.size"]');
    rg.value = '36'; rg.dispatchEvent(new Event('input', { bubbles: true })); rg.dispatchEvent(new Event('change', { bubbles: true })); await W(200);
    out.pv1 = pv();
    tab('phone').click(); await W(150);
    out.pv2 = pv();
    R.querySelector('[data-a="save"]').click(); await W(900);
    out.store = JSON.parse(JSON.stringify((MSH.store.get('cards.ki-home-header') || {}).per_screen || null));
    // GUI-editoren til msh-hjem-card viser samme valg, og lagrer + speiler
    const hj = deep('msh-hjem-card');
    const G = customElements.get('msh-hjem-card').getConfigElement(); G.hass = window.__H; G.setConfig(JSON.parse(JSON.stringify(hj._yamlConfig || hj._rawConfig))); document.body.appendChild(G); await W(300);
    const GR = G.shadowRoot, gs = GR.querySelector('details[data-sec="id:per_screen"]'); if (gs) { G._open['id:per_screen'] = true; G._render(); await W(100); }
    out.gsec = !!gs;
    out.gpv = !!GR.querySelector('[data-pspv]');
    GR.querySelector('[data-a="tab"][data-k="ps"][data-v="unfolded"]').click(); await W(150);
    const on = GR.querySelector('[data-a="sel"][data-name="cards.header.per_screen.unfolded.title"].on');
    out.gTitle = on && on.dataset.v;
    out.gSize = (() => { const x = GR.querySelector('input[type=range][data-name="cards.header.per_screen.unfolded.size"]'); return x && x.value; })();
    let ev = null; G.addEventListener('config-changed', (e) => { ev = e.detail.config; });
    GR.querySelector('[data-a="sel"][data-name="cards.header.per_screen.unfolded.title"][data-v="hilsen"]').click(); await W(300);
    out.gEv = ev && ev.cards && ev.cards.header && ev.cards.header.per_screen;
    out.store2 = JSON.parse(JSON.stringify((MSH.store.get('cards.ki-home-header') || {}).per_screen || null));
    G.remove();
    return out;
  });
  ok('forhåndsvisning øverst i «Tilpass header»', r.top && r.pv0 && r.pv0.t === 'unfolded', r.pv0);
  ok('seksjonen «Tittel per skjerm» med tre faner', r.sec && /Tittel per skjerm/.test(r.sec) && r.tabs.join('|') === 'Telefon / Fold lukket|Fold åpen / nettbrett|PC', { sec: r.sec, tabs: r.tabs });
  ok('fanen for skjermen du står på er valgt (Fold åpen)', r.sel0 === 'unfolded', r.sel0);
  ok('forhåndsvisningen følger valgt fane med riktig størrelse', r.pv1 && r.pv1.t === 'unfolded' && Math.abs(r.pv1.fs - 36) < 0.1 && r.pv1.txt === 'Sebastian' && r.pv2 && r.pv2.t === 'phone' && r.pv2.txt === '👋 Sebastian!', { pv1: r.pv1, pv2: r.pv2 });
  ok('lagret i header.per_screen.unfolded (bare Fold åpen)', r.store && r.store.unfolded && r.store.unfolded.title === 'navn' && r.store.unfolded.size === 36 && !r.store.phone && !r.store.desktop, r.store);
  ok('GUI-editoren (msh-hjem-card) viser samme valg', r.gsec && r.gpv && r.gTitle === 'navn' && r.gSize === '36', { gsec: r.gsec, gpv: r.gpv, t: r.gTitle, s: r.gSize });
  ok('GUI-editoren lagrer til cards.header.per_screen og speiles til «Tilpass header» (ki-store)', r.gEv && r.gEv.unfolded && r.gEv.unfolded.title === 'hilsen' && r.gEv.unfolded.size === 36 && r.store2 && r.store2.unfolded.title === 'hilsen', { ev: r.gEv, store: r.store2 });
  const h = await hdr(p);
  ok('Fold åpen-valget påvirker headeren på åpen skjerm (36 px)', Math.abs(h.fs - 36) < 0.1, h);
  await p.setViewportSize({ width: 360, height: 780 }); await wait(p, 800);
  const h2 = await hdr(p);
  ok('… men ikke telefon (som før)', h2.ps === 'phone' && h2.text === '👋 Sebastian!' && Math.abs(h2.fs - 36) > 0.5, h2);
  if (SHOT) await p.screenshot({ path: `${SHOT}/f55-editor.png` });
  ok('editor: ingen sidefeil', !p.__errs.length, p.__errs);
  await p.close();
}

await b.close();
console.log(res.join('\n'));
const bad = res.filter((x) => x.startsWith('✘'));
console.log(bad.length ? `fold55-check: ${bad.length} feil` : 'fold55-check OK');
process.exit(bad.length ? 1 : 0);
