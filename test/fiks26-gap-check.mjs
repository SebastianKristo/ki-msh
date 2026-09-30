// Fiks 26.18: mellomrom under Bubble-headeren (−10 px) – ÉN metode (MSH.applyHeaderGap i 02-popups.js, brukt av strategien og
// buildPopups): alle genererte/egne popups får blokken, gap-card med height 0 øverst fjernes, felles popup_header_gap (ki-store /
// strategi-config) og overstyring per popup (ki-store popups.<key>.header_gap / popup_overrides.header_gap). Mot ekte Bubble Card:
// første kort ligger 10 px tettere på headeren – både msh-kort (pad_top + gap, ikke dobbelt) og egne kort. «Tilpass Hjem» → Popups.
// Kjør: node test/fiks26-gap-check.mjs
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readdirSync, mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/f26gap-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const BC = resolve('test/.vendor/bubble-card.js');
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = [];
const ok = (name, cond, info) => res.push(`${cond ? '✔' : '✘'} ${name}${info != null ? ' · ' + JSON.stringify(info).slice(0, 400) : ''}`);
const mocks = readdirSync('test/mock').filter((f) => f.endsWith('.js')).sort().map((f) => resolve('test/mock/' + f));

// 1) strategien: blokken i alle popups, prioritet for verdiene, gap-card fjernet
{
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + resolve('test/harness.html'));
  for (const m of mocks) await p.addScriptTag({ path: m });
  await p.addScriptTag({ path: bundle });
  const r = await p.evaluate(async () => {
    const M = window.MSH, h = window.mockHass();
    const gapOf = (pp) => { const m = /--ki-popup-header-gap:\s*(-?\d+)px/.exec(pp.styles || ''); return m ? Number(m[1]) : null; };
    const blocks = (pp) => ((pp.styles || '').match(/\/\* ki-header-gap \*\//g) || []).length;
    const gen = async (cfg) => (await M.generateDashboardView(cfg || {}, h)).cards[0].cards.filter((c) => c && c.card_type === 'pop-up');
    await M.store.load(h);
    await M.store.set('custom_popups', [{ type: 'custom:bubble-card', card_type: 'pop-up', hash: '#egen26', name: 'Egen', cards: [{ type: 'custom:gap-card', height: 0 }, { type: 'custom:gap-card', height: '0' }, { type: 'markdown', content: 'x' }, { type: 'custom:gap-card', height: 0 }] }], { immediate: true });
    const out = {};
    let P = await gen();
    out.n = P.length; out.all = P.every((x) => gapOf(x) === -10 && blocks(x) === 1);
    const eg = P.find((x) => x.hash === '#egen26'); out.egen = eg && eg.cards.map((c) => c.type + (c.height != null ? ':' + c.height : ''));
    out.firstGap = P.filter((x) => x.cards && x.cards[0] && x.cards[0].type === 'custom:gap-card' && parseFloat(x.cards[0].height) === 0).map((x) => x.hash);
    // strategi-config og ki-store (felles) og per popup
    P = await gen({ popup_header_gap: -4 }); out.cfg = [...new Set(P.map(gapOf))];
    await M.store.set('popup_header_gap', -6, { immediate: true });
    P = await gen({ popup_header_gap: -4 }); out.store = [...new Set(P.map(gapOf))];
    await M.store.set('popups.vanning', { header_gap: 0 }, { immediate: true });
    P = await gen({ popup_header_gap: -4, popup_overrides: { '#klima': { header_gap: 6 } } });
    out.per = { vanning: gapOf(P.find((x) => x.hash === '#vanning')), klima: gapOf(P.find((x) => x.hash === '#klima')), media: gapOf(P.find((x) => x.hash === '#media')), klimaKey: 'header_gap' in P.find((x) => x.hash === '#klima') };
    // idempotent: blokken byttes ut, legges ikke til to ganger
    const once = M.applyHeaderGap(M.applyHeaderGap(P[0], -3), -8); out.idem = [blocks(once), gapOf(once)];
    // buildPopups (manuelt dashbord) bruker samme metode
    const cws = h.callWS; h.callWS = async (m) => (m && m.type === 'lovelace/config' ? { views: [{ title: 'Hjem', type: 'sections', sections: [{ type: 'grid', cards: [{ type: 'custom:bubble-card', card_type: 'pop-up', hash: '#vanning', styles: '.x{}', cards: [{ type: 'custom:gap-card', height: 0 }, { type: 'custom:msh-vanning-card' }] }] }] }] } : cws.call(h, m));
    const br = await M.buildPopups(h, { dryRun: true }); h.callWS = cws;
    const bp = []; const walk = (o) => { if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === 'object') { if (o.card_type === 'pop-up') bp.push(o); Object.values(o).forEach(walk); } }; walk(br && br.config);
    out.buildDbg = bp.slice(0, 40).map((x) => [x.hash, blocks(x), gapOf(x), x.cards.map((c) => c.type).join("+")].join(" ")); out.build = bp.length > 3 && bp.every((x) => blocks(x) === 1 && gapOf(x) === (x.hash === "#vanning" ? 0 : -6)) && !bp.some((x) => x.cards.some((c) => c.type === 'custom:gap-card'));
    await M.store.set('popup_header_gap', undefined, { immediate: true }); await M.store.set('popups.vanning', undefined, { immediate: true }); await M.store.set('custom_popups', undefined, { immediate: true });
    return out;
  });
  ok('26.18 strategien: alle popups har header-gap-blokken én gang (−10)', r.n > 5 && r.all, r);
  ok('26.18 gap-card med height 0 øverst fjernes (egne/importerte popups), resten står', JSON.stringify(r.egen) === JSON.stringify(['markdown', 'custom:gap-card:0']) && !r.firstGap.length, r.egen);
  ok('26.18 popup_header_gap i strategi-config', r.cfg.length === 1 && r.cfg[0] === -4, r.cfg);
  ok('26.18 ki-store popup_header_gap (Tilpass Hjem) over strategi-config', r.store.length === 1 && r.store[0] === -6, r.store);
  ok('26.18 per popup: ki-store popups.<key>.header_gap og popup_overrides.header_gap', r.per.vanning === 0 && r.per.klima === 6 && r.per.media === -6 && !r.per.klimaKey, r.per);
  ok('26.18 blokken er idempotent', r.idem[0] === 1 && r.idem[1] === -8, r.idem);
  ok('26.18 buildPopups (manuelt dashbord) bruker samme metode (eksisterende popup får blokken, gap-card fjernet)', r.build === true, r.buildDbg);
  ok('26.18 strategi: ingen sidefeil', !errs.length, errs);
  await p.close();
}

// 2) ekte Bubble Card: avstand header → første kort, gap 0 vs −10 (msh-kort med pad_top og et eget kort)
{
  const meas = {};
  for (const [hash, tag, gap] of [['#vanning', 'msh-vanning-card', 0], ['#vanning', 'msh-vanning-card', -10], ['#stue', 'msh-rom-card', 0], ['#stue', 'msh-rom-card', -10], ['#egen', 'x-gap26-card', 0], ['#egen', 'x-gap26-card', -10]]) {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } });
    const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto('file://' + resolve('test/harness-bubble.html'));
    for (const m of mocks) await p.addScriptTag({ path: m });
    await p.addScriptTag({ path: bundle });
    await p.addScriptTag({ path: BC, type: 'module' });
    await p.waitForFunction(() => customElements.get('bubble-card'));
    const d = await p.evaluate(async ({ hash, tag, gap }) => {
      if (!customElements.get('x-gap26-card')) customElements.define('x-gap26-card', class extends HTMLElement { setConfig() {} set hass(h) {} connectedCallback() { this.style.cssText = 'display:block;height:60px;background:#555'; } });
      window.loadCardHelpers = async () => ({ createCardElement: (c) => { const el = document.createElement(c.type.replace('custom:', '')); el.setConfig(c); return el; } });
      const M = window.MSH, hass = window.mockHass();
      let cfg = hash === '#stue' ? M.popupTemplateB({ name: 'Stue', icon: 'mdi:sofa', hash, color: 'var(--orange)', card: { type: 'custom:' + tag, area: 'stue' } }) : M.popupTemplateA({ name: 'X', icon: 'mdi:star', hash, card: { type: 'custom:' + tag } });
      if (hash === '#egen') cfg.cards.unshift({ type: 'custom:gap-card', height: 0 });
      cfg = M.applyHeaderGap(cfg, gap);
      const bc = document.createElement('bubble-card'); bc.setConfig(cfg); bc.hass = hass; document.getElementById('dash').appendChild(bc);
      await new Promise((q) => setTimeout(q, 500)); location.hash = hash; await new Promise((q) => setTimeout(q, 2000));
      const all = []; const walk = (root) => root.querySelectorAll('*').forEach((e) => { all.push(e); if (e.shadowRoot) walk(e.shadowRoot); }); walk(document);
      const card = all.find((e) => e.localName === tag), hdr = all.find((e) => e.classList && e.classList.contains('bubble-header-container'));
      return card && hdr ? Math.round(card.getBoundingClientRect().top - hdr.getBoundingClientRect().bottom) : null;
    }, { hash, tag, gap });
    meas[`${hash}:${gap}`] = d;
    if (errs.length) meas[`${hash}:${gap}:err`] = errs.slice(0, 2);
    await p.close();
  }
  const dv = (h) => meas[h + ':0'] - meas[h + ':-10'];
  ok('26.18 Bubble: msh-kort (pad_top 20) ligger 10 px tettere – ikke doblet', dv('#vanning') === 10 && meas['#vanning:-10'] === 10, meas);
  ok('26.18 Bubble: rom-kort (pad_top −10) ligger 10 px tettere', dv('#stue') === 10, meas);
  ok('26.18 Bubble: eget kort (uten pad_top) ligger 10 px tettere', dv('#egen') === 10, meas);
}

// 3) «Tilpass Hjem» → Popups: felles rad + per popup, lagres i ki-store
{
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + resolve('test/harness.html'));
  for (const m of mocks) await p.addScriptTag({ path: m });
  await p.addScriptTag({ path: bundle });
  const r = await p.evaluate(async () => {
    const w = (ms) => new Promise((q) => setTimeout(q, ms));
    const M = window.MSH, h = window.mockHass(); window.__h = h;
    const deep = () => { const o = []; const wk = (r) => r.querySelectorAll('*').forEach((e) => { o.push(e); if (e.shadowRoot) wk(e.shadowRoot); }); wk(document); return o; };
    const d = document.getElementById('dash');
    const c = document.createElement('msh-hjem-card'); c.setConfig({ type: 'custom:msh-hjem-card', card_id: 'ki-home' }); c.hass = h; d.appendChild(c);
    await M.generateDashboardView({}, h); await w(600);
    M.openHomeEditor(); await w(900);
    const ER = () => { const e = deep().find((x) => x.dataset && x.dataset.key === 'ed'); return e && e.getRootNode(); };
    ER().querySelector('[data-a="sec"][data-v="pop"]').click(); await w(600);
    const out = {};
    const g = () => ER().querySelector('input[data-in="ppgap"][data-k=""]');
    out.global = !!g(); out.v0 = g() && g().value;
    if (g()) { g().value = '-4'; g().dispatchEvent(new Event('input', { bubbles: true })); g().dispatchEvent(new Event('change', { bubbles: true })); await w(400); }
    out.store = M.store.get('popup_header_gap');
    // åpne en generert popup (Vanning) → per-popup-glidebryteren
    const row = [...ER().querySelectorAll('[data-a]')].find((x) => /vanning/.test(x.dataset.v || '') && /ppopen|ppitem|popedit|ppedit/.test(x.dataset.a || ''));
    out.row = row ? row.dataset.a : null;
    if (row) { row.click(); await w(600); }
    const pg = () => ER().querySelector('input[data-in="ppgap"][data-k="vanning"]');
    out.per = !!pg();
    if (pg()) { pg().value = '2'; pg().dispatchEvent(new Event('change', { bubbles: true })); await w(400); }
    out.perStore = (M.store.get('popups.vanning') || {}).header_gap;
    const pops = (await M.generateDashboardView(M.strategyConfig || {}, h)).cards[0].cards.filter((x) => x && x.card_type === 'pop-up');
    const gapOf = (pp) => { const m = /--ki-popup-header-gap:\s*(-?\d+)px/.exec((pp && pp.styles) || ''); return m ? Number(m[1]) : null; };
    out.gen = { vanning: gapOf(pops.find((x) => x.hash === '#vanning')), media: gapOf(pops.find((x) => x.hash === '#media')) };
    const rs = ER().querySelector('[data-a="ppgapreset"][data-k="vanning"]'); if (rs) { rs.click(); await w(300); }
    out.reset = (M.store.get('popups.vanning') || {}).header_gap;
    return out;
  });
  ok('26.18 Tilpass Hjem → Popups: felles «mellomrom under headeren» (standard −10) lagres som popup_header_gap', r.global && r.v0 === '-10' && r.store === -4, r);
  ok('26.18 Tilpass Hjem → Popups: overstyring per popup (popups.vanning.header_gap) + Standard', r.per && r.perStore === 2 && r.reset === undefined, r);
  ok('26.18 strategien bruker valgene fra Tilpass Hjem', r.gen.vanning === 2 && r.gen.media === -4, r.gen);
  ok('26.18 Tilpass Hjem: ingen sidefeil', !errs.length, errs);
  await p.close();
}
await b.close();
console.log(res.join('\n'));
process.exit(res.some((x) => x.startsWith('✘')) ? 1 : 0);
