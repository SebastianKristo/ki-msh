// Fiks 47 · Hjem: A (sveip mellom dørlåser), B (lock_sort/lock_default), C (person-hurtigarket: Liquid Glass kun med
// navbar-profilen «Liquid Glass»), D («Kommer i dag» – Sonarr/Radarr-slide i venstre karusell), F (Bekreftelsespille).
// Kjør: node test/hjem47-check.mjs
import { createRequire } from 'node:module';
import { readdirSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/hjem47-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const mocks = readdirSync('test/mock').filter((f) => f.endsWith('.js')).sort().map((m) => resolve('test/mock/' + m));
let fails = 0;
const out = [];
const ok = (name, cond, info) => { if (!cond) fails++; out.push(`${cond ? '✔' : '✘'} ${name}${!cond && info !== undefined ? ' · ' + JSON.stringify(info).slice(0, 1500) : ''}`); };
const errs = [];

async function page(width) {
  const p = await b.newPage({ viewport: { width: width || 430, height: 1100 }, hasTouch: true });
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + resolve('test/harness.html'));
  for (const m of mocks) await p.addScriptTag({ path: m });
  await p.addScriptTag({ path: bundle });
  await p.evaluate(() => {
    window.W = (ms) => new Promise((q) => setTimeout(q, ms));
    window.CALLS = [];
    window.HP = []; window.addEventListener('haptic', (e) => window.HP.push(e.detail));
    window.mkHass = () => { const H = window.mockHass(); const cs = H.callService; H.callService = (d, s, data) => { window.CALLS.push([d, s, data && data.entity_id]); return cs ? cs.call(H, d, s, data) : Promise.resolve(); }; return H; };
    window.mount = async (cfg, H) => {
      const c = document.createElement('msh-hjem-faner-card');
      c.setConfig({ type: 'custom:msh-hjem-faner-card', card_id: 'ki-faner-h47-' + Math.random().toString(36).slice(2), ...cfg });
      c.hass = H; document.getElementById('dash').appendChild(c);
      await window.W(700);
      return c;
    };
    window.setH = async (c, patch) => { const H = c.hass, S = { ...H.states }; Object.keys(patch).forEach((id) => { S[id] = { ...S[id], state: patch[id], last_changed: new Date().toISOString() }; }); const h = { ...H, states: S }; c.hass = h; await window.W(350); return h; };
    window.lockVp = (c) => c.shadowRoot.querySelector('.tsw.snap[data-lsw]');
    window.vpInfo = (c) => { const vp = window.lockVp(c); if (!vp) return null; const ids = vp.dataset.ids.split('|'), i = Number(vp.dataset.i), w = vp.clientWidth; return { ids, i, w, sl: vp.scrollLeft, cur: ids[i], ta: getComputedStyle(vp).touchAction, slotTa: getComputedStyle(vp.querySelector('.u.ht')).touchAction, dots: vp.parentElement.querySelectorAll('.msh-dot').length }; };
  });
  return p;
}

/* ================================================================ A + B · dørlåser */
{
  const p = await page();
  const r = await p.evaluate(async () => {
    const M = window.MSH, H = window.mkHass(); window.mockLas(4);
    // tilstander: alle låst (Boddør har PIN, de andre ikke)
    ['lock.inngangsdor', 'lock.bod', 'lock.terrassedor', 'lock.kjellerdor'].forEach((id) => { if (H.states[id]) H.states[id] = { ...H.states[id], state: 'locked' }; });
    const L = M.hjemLockList(H);
    const c = await window.mount({ tabs: { hjem: { auto_fill: false, cards: ['lock', 'garage', 'rom:stue'] } }, tile_cfg: { lock: { lock_sort: 'popup' } } }, H);
    window.__c = c; window.__L = L;
    const v = window.vpInfo(c);
    const home = c.shadowRoot.querySelector(`.u.ht[data-lid="${L[0]}"]`);
    const sub = home && home.querySelector('.u-n') ? home.querySelector('.u-n').textContent : null;
    const ttl = home && home.querySelector('.u-l') ? home.querySelector('.u-l').textContent : null;
    return { L, v, sub, ttl, name0: M.hjemLockName(H, L[0]) };
  });
  const { L, v } = r;
  ok('A: 4 låser fra #dorlas-listen (M.lasAuto)', L.length === 4, L);
  const exp = [...L.slice(1).reverse(), L[0]];
  ok('A: rekkefølge i sporet – hjem-låsen med de andre til VENSTRE (2. rett til venstre, 3. to steg …)', v && JSON.stringify(v.ids.slice(0, 4)) === JSON.stringify(exp), { ids: v && v.ids, exp });
  ok('A: sveip videre (høyre → venstre) fra hjem-låsen går til neste kort i gruppen (Garasjeport)', v && v.ids[v.i + 1] === 'garage', v && v.ids);
  ok('A: ved lasting står sporet på hjem-låsen uten animasjon (data-i + scrollLeft)', v && v.cur === L[0] && Math.abs(v.sl - v.i * v.w) < 2, v);
  ok('A: tittel «Låst», undertekst = låsens navn', r.ttl === 'Låst' && r.sub === r.name0, [r.ttl, r.sub, r.name0]);
  ok('A: touch-action pan-x på sporet (og på flisene i sporet)', v && v.ta === 'pan-x' && /pan-x|manipulation/.test(v.slotTa), v && [v.ta, v.slotTa]);
  ok('A: Hjem L-top (sveip alle) → ingen prikker, som de øvrige gruppene', v && v.dots === 0, v && v.dots);

  const sp = await p.evaluate(async () => {
    const c = window.__c, vp = window.lockVp(c), got = [];
    ['pointerdown', 'touchstart', 'touchmove'].forEach((t) => c.addEventListener(t, () => got.push(t)));
    vp.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true, pointerType: 'touch', clientX: 10, clientY: 10 }));
    vp.dispatchEvent(new Event('touchstart', { bubbles: true, composed: true }));
    vp.dispatchEvent(new Event('touchmove', { bubbles: true, composed: true }));
    vp.dispatchEvent(new Event('touchend', { bubbles: true, composed: true }));
    vp.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, composed: true, pointerType: 'touch' }));
    await window.W(450);
    return got;
  });
  ok('A: stopPropagation på pointerdown/touchstart/touchmove (Bubble swipe-to-close / siden får dem ikke)', sp.length === 0, sp);

  // sveip (native scroll) høyre → venstre: neste kort; ingen haptic ved sveip
  const sw = await p.evaluate(async () => {
    const c = window.__c, vp = window.lockVp(c), i0 = Number(vp.dataset.i), hp = window.HP.length;
    vp.scrollLeft = (i0 - 1) * vp.clientWidth; vp.dispatchEvent(new Event('scroll'));
    await window.W(400);
    const a = window.vpInfo(c);
    return { i0, a, hp: window.HP.length - hp };
  });
  ok('A: sveip venstre → høyre fra hjem gir 2. lås (bakover), ingen haptic ved sveip', sw.a.cur === L[1] && sw.a.i === sw.i0 - 1 && sw.hp === 0, sw);

  // trykk/hold treffer riktig lås
  const tp = await p.evaluate(async () => {
    const M = window.MSH, c = window.__c, L = window.__L;
    const plain = L.find((id) => !c.hass.states[id].attributes.code_format && id !== L[0]);
    const q = (id, w) => c.shadowRoot.querySelector(`.u.ht[data-lid="${id}"]${w === 'ic' ? ' [data-w="ic"]' : ''}`);
    window.CALLS = []; const hp0 = window.HP.length;
    q(plain, 'ic').dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, detail: 0 }));
    await window.W(300);
    const icCalls = window.CALLS.slice(), icHp = window.HP.length - hp0;
    history.replaceState(null, '', location.pathname); M.lasPick = null;
    const other = L.find((id) => id !== plain && id !== L[0]);
    q(other, 'card').dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, detail: 0 }));
    await window.W(200);
    const cardHash = location.hash, cardPick = M.lasPick;
    history.replaceState(null, '', location.pathname); M.lasPick = null;
    const third = L.find((id) => ![plain, other, L[0]].includes(id));
    const ic = q(third, 'ic'), rr = ic.getBoundingClientRect();
    ic.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true, pointerType: 'touch', clientX: rr.left + 5, clientY: rr.top + 5 }));
    await window.W(330);
    const early = location.hash;
    await window.W(150);
    const holdHash = location.hash, holdPick = M.lasPick;
    ic.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, composed: true, pointerType: 'touch', clientX: rr.left + 5, clientY: rr.top + 5 }));
    history.replaceState(null, '', location.pathname);
    return { plain, other, third, icCalls, icHp, cardHash, cardPick, early, holdHash, holdPick };
  });
  ok('A: trykk på ikonet veksler DEN låsen (lock.unlock på riktig entitet, én haptic)', tp.icCalls.some((x) => x[0] === 'lock' && x[2] === tp.plain) && !tp.icCalls.some((x) => x[0] === 'lock' && x[2] !== tp.plain) && tp.icHp === 1, tp);
  ok('A: trykk på kortet → lås-dialogen (#dorlas) for DEN låsen', tp.cardHash === '#dorlas' && tp.cardPick === tp.other, tp);
  ok('A: hold på ikonet (400 ms) → lås-dialogen for den låsen (ikke før 400 ms)', tp.early !== '#dorlas' && tp.holdHash === '#dorlas' && tp.holdPick === tp.third, tp);

  /* ---- B · rekkefølge */
  const ord = await p.evaluate(() => {
    const M = window.MSH, L = ['lock.a', 'lock.b', 'lock.c', 'lock.d'];
    const h = (st) => ({ states: Object.fromEntries(L.map((id, i) => [id, { entity_id: id, state: st[i], attributes: {} }])) });
    const lk = ['locked', 'locked', 'locked', 'locked'], ul = ['locked', 'locked', 'unlocked', 'locked'], ud = ['unlocked', 'locked', 'unlocked', 'locked'];
    return {
      un_all: M.hjemLockOrder(h(lk), L, 'unlocked', 'lock.b'),
      un_one: M.hjemLockOrder(h(ul), L, 'unlocked', 'lock.b'),
      un_def: M.hjemLockOrder(h(ud), L, 'unlocked', 'lock.a'),
      def: M.hjemLockOrder(h(ul), L, 'default', 'lock.b'),
      pop: M.hjemLockOrder(h(ul), L, 'popup', 'lock.b'),
      dflt: M.hjemLockOrder(h(lk), L, 'unlocked', null),
    };
  });
  ok('B: unlocked – alle låst → standard-låsen først', JSON.stringify(ord.un_all) === JSON.stringify(['lock.b', 'lock.a', 'lock.c', 'lock.d']), ord.un_all);
  ok('B: unlocked – ulåste først (popup-rekkefølge), så standard, så låste', JSON.stringify(ord.un_one) === JSON.stringify(['lock.c', 'lock.b', 'lock.a', 'lock.d']) && JSON.stringify(ord.un_def) === JSON.stringify(['lock.a', 'lock.c', 'lock.b', 'lock.d']), [ord.un_one, ord.un_def]);
  ok('B: default – standard først, så ulåste, så låste', JSON.stringify(ord.def) === JSON.stringify(['lock.b', 'lock.c', 'lock.a', 'lock.d']), ord.def);
  ok('B: popup – samme rekkefølge som Dørlås-popupen', JSON.stringify(ord.pop) === JSON.stringify(['lock.a', 'lock.b', 'lock.c', 'lock.d']), ord.pop);
  ok('B: uten lock_default → første lås er standard', ord.dflt[0] === 'lock.a', ord.dflt);

  // live: unlocked-modus, bruker har sveipet til en lås → en annen lås låses opp → kortet står på samme lås
  const live = await p.evaluate(async () => {
    const L = window.__L, H0 = window.__c.hass;
    const c = await window.mount({ tabs: { hjem: { auto_fill: false, cards: ['lock', 'garage', 'rom:stue'] } }, tile_cfg: { lock: { lock_default: L[0] } } }, H0);
    const a = window.vpInfo(c), vp = window.lockVp(c);
    vp.scrollLeft = (a.i - 1) * vp.clientWidth; vp.dispatchEvent(new Event('scroll')); await window.W(400);
    const b = window.vpInfo(c);
    await window.setH(c, { [L[3]]: 'unlocked' });
    await window.W(250);
    const after = window.vpInfo(c);
    // uten interaksjon (ny lasting) → hjem = den ulåste
    c._lkV = {}; c._schedule(true); await window.W(400);
    const fresh = window.vpInfo(c);
    c.remove();
    return { a, b, after, fresh, L };
  });
  ok('B: live – ny rekkefølge når en lås låses opp (ulåst blir hjem)', live.fresh.cur === live.L[3] && live.fresh.ids[live.fresh.ids.length - 2] === live.L[3], live.fresh);
  ok('B: live – kortet står på samme lås brukeren ser på (ingen hopp), sporet flyttet uten animasjon', live.after.cur === live.b.cur && Math.abs(live.after.sl - live.after.i * live.after.w) < 2 && live.after.i !== live.b.i, { b: live.b, after: live.after });

  // ett kort, uten sveip: én lås → vanlig kort uten prikker; 4 låser uten «sveip alle» → egen gruppe med prikker
  const one = await p.evaluate(async () => {
    const H = window.__c.hass;
    const c4 = await window.mount({ tabs: { hjem: { auto_fill: false, cards: ['lock', 'rom:stue'] } }, swipe: { hjem: { 'L-top': false } } }, H);
    const g4 = window.vpInfo(c4); c4.remove();
    window.mockLas(1);
    const H1 = { ...H, states: { ...H.states } }; ['lock.bod', 'lock.terrassedor', 'lock.kjellerdor'].forEach((id) => delete H1.states[id]);
    const c1 = await window.mount({ tabs: { hjem: { auto_fill: false, cards: ['lock', 'rom:stue'] } }, swipe: { hjem: { 'L-top': false } } }, H1);
    const r = { g4, snap: !!window.lockVp(c1), tsw: c1.shadowRoot.querySelectorAll('.tsw').length, tiles: c1.shadowRoot.querySelectorAll('.u.ht[data-k="lock"]').length, dots: c1.shadowRoot.querySelector('.u.ht[data-k="lock"]').closest('.swc') ? 1 : 0, lid: c1.shadowRoot.querySelector('.u.ht[data-k="lock"]').dataset.lid || null };
    c1.remove();
    return r;
  });
  ok('A: 4 låser uten «sveip alle» → egen låse-gruppe med 4 prikker', one.g4 && one.g4.ids.length === 4 && one.g4.dots === 4, one.g4);
  ok('A: kun én lås → vanlig kort uten sveip og uten prikker', !one.snap && one.tsw === 0 && one.tiles === 1 && one.dots === 0 && !one.lid, one);
  await p.close();
}

/* ================================================================ B · editorene */
{
  const p = await page();
  const r = await p.evaluate(async () => {
    const M = window.MSH, H = window.mkHass(); window.mockLas(4);
    const c = await window.mount({ card_id: 'ki-home-faner', tabs: { hjem: { auto_fill: false, cards: ['lock', 'garage', 'rom:stue'] } } }, H);
    const L = M.hjemLockList(H);
    // GUI-editoren (getConfigElement-skjemaet)
    const F = []; const walk = (a) => (a || []).forEach((f) => { if (f.name) F.push(f); if (f.fields) walk(f.fields); });
    walk(customElements.get('msh-hjem-faner-card').schema(H, c.config));
    const fs = F.find((f) => f.name === 'tile_cfg.lock.lock_sort'), fd = F.find((f) => f.name === 'tile_cfg.lock.lock_default');
    // Tilpass Hjem → Kort → dørlås-kortet
    const ed = M.openHomeEditor({ focus: 'kort' }); await window.W(500);
    ed.u.ctx = 'hjem'; ed.u.sel = { t: 'tile', id: 'lock' }; ed.render(); await window.W(400);
    const deep = (sel, root) => { const o = []; const w = (r) => { if (!r || !r.querySelectorAll) return; r.querySelectorAll(sel).forEach((x) => o.push(x)); r.querySelectorAll('*').forEach((e) => { if (e.shadowRoot) w(e.shadowRoot); }); }; w(root); return o; };
    const box = M.portals().flatMap((pp) => deep('[data-key="lksw"]', pp.shadowRoot || pp))[0];
    const sorts = box ? [...box.querySelectorAll('[data-a="locksort"]')].map((x) => x.textContent.trim()) : [];
    const defs = box ? box.querySelectorAll('[data-a="lockdef"]').length : 0;
    if (box) box.querySelector('[data-a="locksort"][data-v="default"]').click();
    await window.W(700);
    const box2 = M.portals().flatMap((pp) => deep('[data-key="lksw"]', pp.shadowRoot || pp))[0];
    if (box2) box2.querySelector(`[data-a="lockdef"][data-v="${L[2]}"]`).click();
    await window.W(900);
    const live = M.liveOf('msh-hjem-faner-card'), lc = ((live && live.config.tile_cfg) || {}).lock || {};
    const v = window.vpInfo(live);
    // GUI-skjemaet viser det samme (samme config-nøkler)
    const F2 = []; const walk2 = (a) => (a || []).forEach((f) => { if (f.name) F2.push(f); if (f.fields) walk2(f.fields); });
    walk2(customElements.get('msh-hjem-faner-card').schema(H, live.config));
    ed.close();
    return { L, fs: fs && fs.options, fsType: fs && fs.type, fd: fd && fd.options.map((o) => o[0]), sorts, defs, lc, cur: v && v.cur, home: v && v.ids[v.ids.length - 2], gui: F2.find((f) => f.name === 'tile_cfg.lock.lock_default').default };
  });
  ok('B: GUI-editoren har «Rekkefølge» (unlocked/default/popup) og «Standard-lås» (låsene fra popupen)', r.fsType === 'select' && JSON.stringify((r.fs || []).map((o) => o[0])) === '["unlocked","default","popup"]' && JSON.stringify(r.fd) === JSON.stringify(r.L), r);
  ok('B: Tilpass Hjem → Kort → Dørlås: «Dørlåser · sveip» med 3 rekkefølge-valg og chips per lås', JSON.stringify(r.sorts) === '["Ulåste først","Standard først","Som i popup"]' && r.defs === r.L.length, r);
  ok('B: valg lagres i kortets config (tile_cfg.lock.lock_sort / lock_default) og kortet følger live', r.lc.lock_sort === 'default' && r.lc.lock_default === r.L[2] && r.home === r.L[2] && r.cur === r.L[2], r);
  ok('B: begge editorene synkronisert (GUI-skjemaet viser valgt standard-lås)', r.gui === r.L[2], r.gui);
  await p.close();
}

/* ================================================================ C · person-hurtigarket */
{
  const p = await page();
  const r = await p.evaluate(async () => {
    const M = window.MSH, H = window.mkHass();
    const hc = document.createElement('msh-hjem-header-card');
    hc.setConfig({ type: 'custom:msh-hjem-header-card', card_id: 'hdr47' }); hc.hass = H; document.getElementById('dash').appendChild(hc);
    await window.W(500);
    const pid = M.all(H, 'person')[0];
    const look = () => {
      const P = M.portals().filter((x) => x.isConnected); const sr = P[P.length - 1].shadowRoot, sh = sr.querySelector('.sh'), seg = sr.querySelector('.seg'), ind = seg && seg.querySelector('.ind');
      const cs = getComputedStyle(sh);
      return { lg: sh.classList.contains('lg'), bg: cs.backgroundColor, bf: cs.backdropFilter, before: getComputedStyle(sh, '::before').content, seg: seg && getComputedStyle(seg).backgroundColor, indImg: ind && getComputedStyle(ind).backgroundImage, orb: getComputedStyle(sr.querySelector('.orb')).boxShadow };
    };
    document.documentElement.dataset.kiGlass = '0';
    let s = hc._quick(pid); await window.W(400);
    const solid = look(); s.ov.close(); await window.W(400);
    // Liquid Glass-temaet for arkene alene (navbar Standard) gir IKKE glass i hurtigarket
    const g0 = M.glassOn; M.glassOn = () => true;
    s = hc._quick(pid); await window.W(400);
    const themeOnly = look(); s.ov.close(); await window.W(400);
    M.glassOn = g0;
    document.documentElement.dataset.kiGlass = '1';
    s = hc._quick(pid); await window.W(400);
    const glass = look(); s.ov.close(); await window.W(300);
    document.documentElement.dataset.kiGlass = '0';
    return { solid, themeOnly, glass };
  });
  ok('C: navbar Standard → solid #3a3a3a, spor #232323, ingen glans', !r.solid.lg && r.solid.bg === 'rgb(58, 58, 58)' && r.solid.seg === 'rgb(35, 35, 35)' && r.solid.before === 'none' && r.solid.indImg === 'none' && /none/.test(r.solid.bf), r.solid);
  ok('C: Liquid Glass-temaet for arkene alene (navbar Standard) → fortsatt solid', !r.themeOnly.lg && r.themeOnly.bg === 'rgb(58, 58, 58)', r.themeOnly);
  ok('C: navbar-profilen Liquid Glass → gjennomsiktig flate + blur, lys kant, glans på aktiv knapp', r.glass.lg && /rgba\(52, 52, 56, 0\.42\)/.test(r.glass.bg) && /blur\(28px\)/.test(r.glass.bf) && r.glass.before !== 'none' && /rgba\(0, 0, 0, 0\.28\)/.test(r.glass.seg) && /gradient/.test(r.glass.indImg) && /rgba\(20, 20, 22, 0\.55\)/.test(r.glass.orb), r.glass);
  await p.close();
}

/* ================================================================ D · «Kommer i dag» */
{
  const p = await page();
  const r = await p.evaluate(async () => {
    const M = window.MSH, H = window.mkHass();
    M.HJEM_ARR_MS = 600; // test: rask autoavspilling (5 s i drift)
    // to utgivelser i dag (Sonarr-sensoren + Radarr-kalenderen fra mocken), med https-bilde på den ene
    const now = new Date(), at = (h) => { const d = new Date(now); d.setHours(h, 0, 0, 0); return d.toISOString(); };
    const S = H.states['sensor.sonarr_sonarr_upcoming_media'];
    const data = S.attributes.data.slice(); data.splice(1, 0, { airdate: at(21), title: 'The Bear', number: 'S04E03', episode: 'Ny', studio: 'Hulu', poster: 'https://image.tmdb.org/t/p/w300/x.jpg', fanart: 'https://image.tmdb.org/t/p/original/bear-fanart.jpg' });
    H.states['sensor.sonarr_sonarr_upcoming_media'] = { ...S, attributes: { ...S.attributes, data } };
    const c = await window.mount({ tabs: { hjem: { auto_fill: false, cards: ['rom:stue', 'rom:kjokken'] } } }, H);
    await window.W(700);
    const car = c.shadowRoot.querySelector('.col .car');
    const el = c.shadowRoot.querySelector('.sl.arr');
    if (!el) return { none: true };
    const items = [...el.querySelectorAll('.arl')].map((x) => ({ on: x.classList.contains('on'), title: x.querySelector('.arti').textContent, src: x.querySelector('.ars').textContent, time: (x.querySelector('.art') || {}).textContent, img: x.querySelector('.arc').dataset.img || null }));
    const bars = el.querySelectorAll('.arbar').length, r0 = el.getBoundingClientRect();
    const top = el.querySelector('.artop').textContent;
    // gå til sliden (karusellen) så den er synlig
    const slides = [...car.querySelectorAll('.slot')], idx = slides.findIndex((s) => s.contains(el));
    c._ui = { ...c._ui, sw: { ...(c._ui.sw || {}), [car.dataset.sw]: idx } }; car.dataset.i = idx; car.firstElementChild.style.transform = `translateX(-${idx * 100}%)`;
    await window.W(300);
    const on0 = [...el.querySelectorAll('.arl')].findIndex((x) => x.classList.contains('on'));
    await window.W(700);
    const on1 = [...el.querySelectorAll('.arl')].findIndex((x) => x.classList.contains('on'));
    const bar1 = [...el.querySelectorAll('.arbar')].findIndex((x) => x.classList.contains('on'));
    // pause når dokumentet er skjult
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    await window.W(1400);
    const on2 = [...el.querySelectorAll('.arl')].findIndex((x) => x.classList.contains('on'));
    delete document.hidden;
    // pause når kortet ikke er synlig (karusellen står på et annet kort)
    c._arrVis = false; const keep = c._arrVis; await window.W(1400);
    const on3 = [...el.querySelectorAll('.arl')].findIndex((x) => x.classList.contains('on'));
    // trykk → Kalender · Framover
    sessionStorage.removeItem('ki-cal-tab'); history.replaceState(null, '', location.pathname); const hp = window.HP.length;
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, detail: 0 }));
    await window.W(200);
    const tap = { tab: sessionStorage.getItem('ki-cal-tab'), hash: location.hash, hp: window.HP.length - hp };
    history.replaceState(null, '', location.pathname);
    const cs = getComputedStyle(el), ars = el.querySelectorAll('.ars');
    const res = { items, bars, h: Math.round(r0.height), rad: cs.borderRadius, ov: cs.overflow, top, on0, on1, bar1, on2, on3, keep, tap, arrOk: !!M.arrMedia, mod: typeof (M.arrMedia || {}).items };
    // lokal reserve (uten 06-arr-media.js): samme utgivelser
    const AM = M.arrMedia; M.arrMedia = undefined;
    const cL = await window.mount({ tabs: { hjem: { auto_fill: false, cards: ['rom:stue'] } } }, H);
    await window.W(700);
    res.local = [...cL.shadowRoot.querySelectorAll('.sl.arr .arl')].map((x) => [x.querySelector('.ars').textContent, x.querySelector('.arti').textContent, (x.querySelector('.art') || {}).textContent, x.querySelector('.arc').dataset.img || null]);
    M.arrMedia = AM; cL.remove();
    // tom dag: ingen utgivelser i dag → «INGENTING I DAG» + «Neste: …»
    const H2 = window.mkHass(); const S2 = H2.states['sensor.sonarr_sonarr_upcoming_media'];
    H2.states['sensor.sonarr_sonarr_upcoming_media'] = { ...S2, attributes: { ...S2.attributes, data: S2.attributes.data.filter((x, i) => i === 0 || new Date(x.airdate) > new Date(new Date().setHours(23, 59, 59))) } };
    H2.callApi = () => Promise.resolve([]);
    const c2 = await window.mount({ tabs: { hjem: { auto_fill: false, cards: ['rom:stue'] } } }, H2);
    await window.W(800);
    const e2 = c2.shadowRoot.querySelector('.sl.arr');
    res.empty = e2 && { t: (e2.querySelector('.are-t') || {}).textContent, s: (e2.querySelector('.are-s') || {}).textContent, bars: e2.querySelectorAll('.arbar').length, layers: e2.querySelectorAll('.arl').length };
    // kan fjernes / flyttes: slides.hjem.L.arr = false skjuler den, slide_order styrer rekkefølgen
    const c3 = await window.mount({ tabs: { hjem: { auto_fill: false, cards: ['rom:stue'] } }, slides: { hjem: { L: { arr: false } } } }, H2);
    res.removed = !c3.shadowRoot.querySelector('.sl.arr');
    const c4 = await window.mount({ tabs: { hjem: { auto_fill: false, cards: ['rom:stue'] } }, slides: { hjem: { L: { cal: true } } }, slide_order: { hjem: { L: ['arr', 'cal'] } } }, H2);
    res.order = [...c4.shadowRoot.querySelectorAll('.col .car .sl')].map((x) => x.dataset.s);
    const c5 = await window.mount({ tabs: { hjem: { auto_fill: false, cards: ['rom:stue'] } }, slides: { hjem: { L: { cal: true } } } }, H2);
    res.order2 = [...c5.shadowRoot.querySelectorAll('.col .car .sl')].map((x) => x.dataset.s);
    // ingen kilde → ingen autokonfig-slide
    const H3 = window.mkHass(); Object.keys(H3.states).filter((id) => /sonarr|radarr|upcoming/.test(id)).forEach((id) => delete H3.states[id]);
    const c6 = await window.mount({ tabs: { hjem: { auto_fill: false, cards: ['rom:stue'] } } }, H3);
    res.noSrc = !c6.shadowRoot.querySelector('.sl.arr');
    return res;
  });
  if (r.none) ok('D: «Kommer i dag»-sliden finnes i venstre karusell', false, r);
  else {
    ok('D: slide i venstre karusell – ett kort 220 px, radius 28, overflow hidden, «Kommer i dag» øverst', r.h === 220 && r.rad === '28px' && r.ov === 'hidden' && r.top === 'Kommer i dag', r);
    const bear = r.items.find((x) => x.title === 'The Bear');
    ok('D: dagens Sonarr/Radarr-utgivelser med kilde-chip + tid (21:00)', r.items.length >= 2 && !!bear && bear.src === 'Sonarr' && bear.time === '21:00' && r.items.some((x) => x.src === 'Sonarr'), r.items);
    ok('D: cover art kant-til-kant = fanart (https), plakat som reserve', !!bear && bear.img === 'https://image.tmdb.org/t/p/original/bear-fanart.jpg', bear);
    ok('D: fremdriftsstreker (én per utgivelse) og autoavspilling (crossfade-lag bytter)', r.bars === r.items.length && r.on1 === (r.on0 + 1) % r.items.length && r.bar1 === r.on1, r);
    ok('D: lokal reserve (M.hjemArrLocal) gir de samme utgivelsene med plakat', r.local && r.local.length === r.items.length && r.local.some((x) => x[1] === 'The Bear' && x[2] === '21:00' && /^https:/.test(x[3] || '')), r.local);
    ok('D: pause når dokumentet er skjult', r.on2 === r.on1, r);
    ok('D: pause når kortet ikke er synlig', r.on3 === r.on2, r);
    ok('D: trykk → sessionStorage ki-cal-tab=fram + #kalender, én haptic', r.tap.tab === 'fram' && r.tap.hash === '#kalender' && r.tap.hp === 1, r.tap);
    ok('D: ingenting i dag → «INGENTING I DAG» + «Neste: …», ingen streker', r.empty && /ingenting i dag/i.test(r.empty.t) && /^Neste: /.test(r.empty.s) && r.empty.s !== 'Neste: –' && r.empty.bars === 0 && r.empty.layers === 0, r.empty);
    ok('D: kan fjernes (slides.hjem.L.arr = false) og flyttes (slide_order)', r.removed && JSON.stringify(r.order) === '["arr","cal"]' && JSON.stringify(r.order2) === '["cal","arr"]', [r.removed, r.order, r.order2]);
    ok('D: ingen Sonarr/Radarr-kilde → ingen slide (autokonfig, ingen mock)', r.noSrc, r.noSrc);
    out.push(`  (datakilde: ${r.mod === 'function' ? 'M.arrMedia.items' : 'lokal reserve M.hjemArrLocal'})`);
  }
  await p.close();
}

/* ================================================================ F · bekreftelsespille */
{
  const p = await page();
  const r = await p.evaluate(async () => {
    const M = window.MSH, H = window.mkHass();
    const c = await window.mount({ card_id: 'ki-home-faner', tabs: { hjem: { auto_fill: false, cards: ['garage', 'rom:stue'] } } }, H);
    const pill = () => { const t = M.overlayRoot().querySelector('#msh-toast'); return !!t && t.style.opacity === '1' && !t.__out; };
    const hide = () => { const t = M.overlayRoot().querySelector('#msh-toast'); if (t) t.remove(); };
    hide(); M.toast('Test på'); const on = pill(); hide();
    // Tilpass Hjem → Faner: bryteren rett under «Liquid Glass-animasjon»
    const ed = M.openHomeEditor({ focus: 'faner' }); await window.W(600);
    const deep = (sel, root) => { const o = []; const w = (r) => { if (!r || !r.querySelectorAll) return; r.querySelectorAll(sel).forEach((x) => o.push(x)); r.querySelectorAll('*').forEach((e) => { if (e.shadowRoot) w(e.shadowRoot); }); }; w(root); return o; };
    const rows = M.portals().flatMap((pp) => deep('[data-key="glassanim"],[data-key="toasts"]', pp.shadowRoot || pp));
    const order = rows.map((x) => x.dataset.key);
    const sw = rows.find((x) => x.dataset.key === 'toasts');
    const label = sw && sw.textContent;
    if (sw) sw.click();
    await window.W(800);
    const cfgOff = c.config.toasts;
    hide();
    const hp0 = window.HP.length; window.CALLS = [];
    // handlinger rundt i dashbordet: Hjem-flisen (garasje), andre kort med egen toast-hjelper, direkte MSH.toast
    const g = c.shadowRoot.querySelector('.u.ht[data-k="garage"] [data-w="ic"]');
    g.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, detail: 0 }));
    await window.W(200);
    const afterTile = pill();
    M.toast('Lagret'); M.hjemToast(null, 'Hei'); if (M.klimaToast) M.klimaToast(null, 'Varme på');
    const afterAll = pill();
    const err = M.toast('Feil: noe gikk galt'); const errShown = !!err; hide();
    const act = { calls: window.CALLS.filter((x) => x[0] === 'cover').length, hp: window.HP.length - hp0 };
    // GUI-editoren har samme nøkkel
    const F = []; const walk = (a) => (a || []).forEach((f) => { if (f.name) F.push(f); if (f.fields) walk(f.fields); });
    walk(customElements.get('msh-hjem-faner-card').schema(H, c.config));
    const gui = F.find((f) => f.name === 'toasts');
    const sec = (() => { let s = null; (customElements.get('msh-hjem-faner-card').schema(H, c.config)).forEach((f) => { if (f.id === 'faner') s = f.fields.map((x) => x.label); }); return s; })();
    // på igjen
    const sw2 = M.portals().flatMap((pp) => deep('[data-key="toasts"]', pp.shadowRoot || pp))[0]; if (sw2) sw2.click(); await window.W(800);
    hide(); M.toast('Igjen'); const back = pill(); hide();
    ed.close();
    return { on, order, label, cfgOff, afterTile, afterAll, errShown, act, gui: gui && [gui.type, gui.label, gui.default], sec, back, cfgBack: c.config.toasts };
  });
  ok('F: standard på – toast-pillen vises', r.on, r);
  ok('F: Tilpass Hjem → Faner: «Bekreftelsespille» rett under «Liquid Glass-animasjon»', JSON.stringify(r.order) === '["glassanim","toasts"]' && /Bekreftelsespille/.test(r.label || ''), r);
  ok('F: av → toasts: false i config', r.cfgOff === false, r.cfgOff);
  ok('F: av → ingen toast-pille noe sted (Hjem-flis, MSH.toast, hjemToast, klimaToast)', !r.afterTile && !r.afterAll, r);
  ok('F: haptic og selve handlingen påvirkes ikke', r.act.calls === 1 && r.act.hp >= 1, r.act);
  ok('F: GUI-editoren: samme nøkkel (toasts, boolean, standard på) under Faner etter Liquid Glass-animasjon', r.gui && r.gui[0] === 'boolean' && r.gui[2] === true && r.sec && r.sec.indexOf('Bekreftelsespille') === r.sec.indexOf('Liquid Glass-animasjon') + 1, [r.gui, r.sec]);
  ok('F: på igjen → pillen vises', r.back && r.cfgBack !== false, r);
  out.push(`  (feilmeldinger vises fortsatt med toasts av: ${r.errShown})`);
  await p.close();
}

ok('ingen sidefeil', errs.length === 0, errs.slice(0, 5));
await b.close();
try { rmSync(bundle); } catch (e) { /* */ }
console.log(out.join('\n'));
console.log(fails ? `\n${fails} feil` : '\nAlt OK');
process.exit(fails ? 1 : 0);
