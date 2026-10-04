// Fiks 50 · Hjem: A (mini-spilleren – sveip bort virker med 2+ spillere, per entity_id), B (sveip opp på hele kortet →
// utvidet meny, sveip ned lukker unntatt på kontroller), C («Kommer i dag» – tomtilstand med neste utgivelse).
// Kjør: node test/hjem50-check.mjs   (SHOT_DIR=<mappe> gir skjermbilder)
import { createRequire } from 'node:module';
import { readdirSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/hjem50-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = [];
const ok = (name, cond, info) => res.push(`${cond ? '✔' : '✘'} ${name}${!cond && info != null ? ' · ' + JSON.stringify(info).slice(0, 1500) : ''}`);
const SHOT = process.env.SHOT_DIR;
const P3 = ['media_player.kjokken_radio', 'media_player.stue_sonos', 'media_player.inngang_speaker'];

async function setupMini() {
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + resolve('test/harness.html'));
  for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
  await p.addScriptTag({ path: bundle });
  await p.evaluate(async (P3) => {
    try { sessionStorage.clear(); } catch (e) { /* */ }
    window.deepAll = (sel) => { const out = []; const walk = (root) => root.querySelectorAll('*').forEach((e) => { if (e.matches(sel)) out.push(e); if (e.shadowRoot) walk(e.shadowRoot); }); walk(document); return out; };
    window.deep = (sel) => window.deepAll(sel)[0] || null;
    window.__hap = []; window.addEventListener('haptic', (e) => window.__hap.push(e.detail));
    window.__toasts = []; const T = window.MSH.toast; window.MSH.toast = (t, o) => { window.__toasts.push(t); return T(t, o); };
    // lekkasje: hendelser som når dokumentet (popupen/siden under) under sveip
    window.__leak = { pd: 0, pm: 0, tm: 0, ts: 0, click: 0 };
    document.addEventListener('pointermove', () => window.__leak.pm++); document.addEventListener('pointerdown', () => window.__leak.pd++);
    document.addEventListener('touchmove', () => window.__leak.tm++, { passive: true }); document.addEventListener('touchstart', () => window.__leak.ts++, { passive: true });
    document.addEventListener('click', () => window.__leak.click++);
    const H = window.mockHass(); window.H = H;
    const S = H.states;
    Object.keys(S).filter((k) => k.startsWith('media_player.')).forEach((k) => { S[k] = { ...S[k], state: 'off' }; });
    P3.forEach((id, i) => { S[id] = { entity_id: id, ...(S[id] || {}), state: 'playing', last_changed: new Date(Date.now() - i * 60000).toISOString(), attributes: { friendly_name: ['Kjøkken radio', 'Stue Sonos', 'Inngang høyttaler'][i], ...((S[id] || {}).attributes || {}), supported_features: 1 | 2 | 4 | 16 | 32 | 16384, media_title: 'Spor ' + i, media_content_id: 'spor-' + i, media_duration: 200, media_position: 20, media_position_updated_at: new Date().toISOString() } }; });
    window.CUR = { ...S };
    window.setRaw = (id, o) => { window.CUR = { ...window.CUR, [id]: o }; const nb = deep('msh-navbar-card'); nb.hass = { ...H, states: window.CUR }; };
    window.setSt = (id, st, attrs) => { const o = window.CUR[id]; setRaw(id, { ...o, state: st, attributes: { ...o.attributes, ...(attrs || {}) }, last_changed: new Date().toISOString() }); };
    document.getElementById('dash').style.height = '3000px';
    const c = document.createElement('msh-navbar-card'); c.setConfig({ type: 'custom:msh-navbar-card', card_id: 'ki-navbar' }); c.hass = H;
    document.getElementById('dash').appendChild(c);
    await new Promise((q) => setTimeout(q, 800));
  }, P3);
  const cdp = await p.context().newCDPSession(p);
  return { p, errs, cdp };
}
const st = (p) => p.evaluate(() => {
  const m = deep('[data-mini]'), sw = m && m.querySelector('.msw'), rows = sw ? [...sw.children] : [];
  const i = sw && sw.clientWidth ? Math.round(sw.scrollLeft / sw.clientWidth) : 0, nb = deep('msh-navbar-card');
  const f = deep('[data-mrmf]');
  return { off: !m || m.classList.contains('off'), exp: !!(m && m.classList.contains('exp')), h: m ? m.offsetHeight : 0, w: m ? m.offsetWidth : 0,
    ids: rows.map((r) => r.dataset.mid), i, shown: rows[i] ? rows[i].dataset.mid : null, cur: nb._mCur, expId: nb._mExp || null,
    mx: m ? parseFloat(m.style.getPropertyValue('--mx')) || 0 : 0, my: m ? parseFloat(m.style.getPropertyValue('--my')) || 0 : 0,
    field: !!(f && f.classList.contains('on')), dots: m ? m.querySelectorAll('.mdots button').length : 0, dotOn: m ? [...m.querySelectorAll('.mdots button')].findIndex((d) => d.classList.contains('on')) : -1,
    ta: sw ? getComputedStyle(sw).touchAction : null, mta: m ? getComputedStyle(m).touchAction : null,
    gone: JSON.parse(sessionStorage.getItem('ki:mini:gone') || 'null'), hid: !!sessionStorage.getItem('ki:mini:hidden'),
    undo: (deep('[data-mundo] button') || {}).textContent || null, scrollY: window.scrollY, hash: location.hash };
});
const box = (p, sel) => p.evaluate((s) => { const e = deepAll(s).find((x) => { const r = x.getBoundingClientRect(); return r.width && r.left >= -1 && r.right <= innerWidth + 1; }) || deep(s); if (!e) return null; const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; }, sel);
const swipe = async (S, x, y, dx, dy, n = 8, ms = 25, wait = 500, mid) => {
  await S.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let i = 1; i <= n; i++) { await S.cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + (dx * i) / n, y: y + (dy * i) / n }] }); if (ms) await S.p.waitForTimeout(ms); if (mid && i === n) await mid(); }
  await S.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await S.p.waitForTimeout(wait);
};
const tapAt = async (S, x, y) => { await S.p.touchscreen.tap(x, y); await S.p.waitForTimeout(450); };
const hap = (p) => p.evaluate(() => { const h = window.__hap.slice(); window.__hap.length = 0; return h; });
const toasts = (p) => p.evaluate(() => { const t = window.__toasts.slice(); window.__toasts.length = 0; return t; });
const rowPt = async (p) => { const r = await box(p, '[data-mini] .mtx'); return { x: r.l + 10, y: r.t + r.h / 2 }; };
const mpCalls = (p) => p.evaluate(() => (window.__calls || []).filter((c) => c[0] === 'media_player').map((c) => c[1]));

/* ================================================================ A · sveip bort med 3 spillere */
{
  const S = await setupMini();
  const { p } = S;
  let s = await st(p);
  ok('A: tre spillere i karusellen, prikker, spiller 1 vises', !s.off && s.ids.length === 3 && s.dots === 3 && s.shown === P3[0], s);
  ok('A: karusellen og kortet har touch-action: none (ikke pan-x underveis)', s.ta === 'none' && s.mta === 'none', s);
  // prikk 2 → spiller 2
  const d2 = await box(p, '[data-mini] .mdots button:nth-child(2)');
  await tapAt(S, d2.l + d2.w / 2, d2.t + d2.h / 2);
  s = await st(p);
  ok('A: trykk på prikk 2 → hopper til spiller 2', s.shown === P3[1] && s.cur === P3[1] && s.dotOn === 1, s);
  ok('A: touch-action fortsatt none på spiller 2', s.ta === 'none', s.ta);
  // sveip høyre på spiller 2 → «Fjern» 1/3
  await p.evaluate(() => { window.scrollTo(0, 300); }); await p.waitForTimeout(300);
  const y0 = (await st(p)).scrollY;
  await p.evaluate(() => { window.__leak = { pd: 0, pm: 0, tm: 0, ts: 0, click: 0 }; });
  await hap(p); await toasts(p);
  let pt = await rowPt(p);
  await swipe(S, pt.x, pt.y, 70, 0, 8, 30);
  s = await st(p);
  let h = await hap(p);
  ok('A: spiller 2 · sveip høyre 70 px → rødt «Fjern»-felt 1/3 (ikke pan-x-rulling)', s.field && Math.abs(s.mx - s.w / 3) < 2 && s.shown === P3[1], s);
  ok('A: haptic selection ved 40 px', h.includes('selection'), h);
  const fb = await box(p, '[data-mrmf] .mrmb');
  await tapAt(S, fb.l + fb.w / 2, fb.t + fb.h / 2);
  await p.waitForTimeout(250);
  s = await st(p); h = await hap(p);
  let t = await toasts(p);
  ok('A: «Fjern» fjerner BARE spiller 2 (de andre vises fortsatt)', !s.off && JSON.stringify(s.ids) === JSON.stringify([P3[0], P3[2]]), s);
  ok('A: lagret per entity_id (ki:mini:gone = { stue_sonos })', s.gone && Object.keys(s.gone).join() === P3[1] && !s.hid, s.gone);
  ok('A: karusellen hopper til neste (spiller 3)', s.shown === P3[2] && s.cur === P3[2], s);
  ok('A: toast «<navn> fjernet»', t.some((x) => /^Stue Sonos fjernet$|Sonos.* fjernet$/.test(x)), t);
  ok('A: haptic medium ved fjerning', h.includes('medium'), h);
  // sveip venstre fra siste → rundt til første
  pt = await rowPt(p);
  await swipe(S, pt.x + 150, pt.y, -120, 0, 8, 25, 700);
  s = await st(p);
  ok('A: sveip venstre på den siste → rundt til den første', s.shown === P3[0] && s.cur === P3[0] && s.dotOn === 0, s);
  pt = await rowPt(p);
  await swipe(S, pt.x + 150, pt.y, -120, 0, 8, 25, 700);
  s = await st(p);
  ok('A: sveip venstre → neste spiller', s.shown === P3[2], s);
  // langt sveip (> 60 %) på den siste → fjernes direkte, hopper til forrige
  pt = await rowPt(p);
  await swipe(S, pt.x - 40, pt.y, Math.round(s.w * 0.7), 0, 10, 25, 700);
  s = await st(p); t = await toasts(p);
  ok('A: langt sveip (70 %) på den siste → fjernet direkte, karusellen hopper til forrige', !s.off && JSON.stringify(s.ids) === JSON.stringify([P3[0]]) && s.shown === P3[0] && s.gone && !!s.gone[P3[2]], s);
  ok('A: toast «Inngang høyttaler fjernet»', t.some((x) => / fjernet$/.test(x)), t);
  const leak = await p.evaluate(() => window.__leak);
  s = await st(p);
  ok('A: ingen lekkasje til siden/popupen (pointer/touch-hendelser stoppet, siden ruller ikke, ingen hash)', leak.pm === 0 && leak.tm === 0 && leak.pd === 0 && leak.ts === 0 && s.scrollY === y0 && s.hash === '', { leak, y0, s: s.scrollY, hash: s.hash });
  // tilbake: ny media_content_id
  await p.evaluate((id) => setSt(id, 'playing', { media_content_id: 'nytt-spor', media_title: 'Nytt spor' }), P3[1]); await p.waitForTimeout(400);
  s = await st(p);
  ok('A: fjernet spiller kommer tilbake ved ny media_content_id', s.ids.includes(P3[1]) && !(s.gone && s.gone[P3[1]]), s);
  // pause → play (samme spor) henter den IKKE tilbake; idle → playing gjør det
  await p.evaluate((id) => setSt(id, 'paused'), P3[2]); await p.waitForTimeout(300);
  await p.evaluate((id) => setSt(id, 'playing'), P3[2]); await p.waitForTimeout(300);
  s = await st(p);
  ok('A: pause → play med samme spor → forblir fjernet', !s.ids.includes(P3[2]) && s.gone && !!s.gone[P3[2]], s);
  await p.evaluate((id) => setSt(id, 'idle'), P3[2]); await p.waitForTimeout(300);
  await p.evaluate((id) => setSt(id, 'playing'), P3[2]); await p.waitForTimeout(400);
  s = await st(p);
  ok('A: idle → playing → kommer tilbake', s.ids.includes(P3[2]) && !s.gone, s);
  // fjern alle én etter én → den siste gir «Mini-spilleren er skjult»
  for (let k = 0; k < 3; k++) {
    pt = await rowPt(p);
    await swipe(S, pt.x - 40, pt.y, Math.round((await st(p)).w * 0.7), 0, 10, 20, 700);
  }
  s = await st(p);
  ok('A: den siste fjernes → mini-spilleren skjules + «Mini-spilleren er skjult»', s.off && /Mini-spilleren er skjult/.test(s.undo || '') && s.gone && Object.keys(s.gone).length === 3, s);
  if (SHOT) await p.screenshot({ path: SHOT + '/hjem50-a-skjult.png' });
  // Angre henter alle tilbake (forrige tilstand av ki:mini:gone)
  const u = await box(p, '[data-mundo] button');
  if (u) await tapAt(S, u.l + u.w / 2, u.t + u.h / 2);
  await p.waitForTimeout(300);
  s = await st(p);
  ok('A: «Angre» → den sist fjernede tilbake', !s.off && s.ids.length === 1, s);
  // hold på play 550 ms skjuler fortsatt alle
  await p.evaluate(() => { sessionStorage.clear(); deep('msh-navbar-card')._schedule(true); }); await p.waitForTimeout(500);
  const pp = await box(p, '[data-mini] .mpp');
  await S.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pp.l + pp.w / 2, y: pp.t + pp.h / 2 }] }); await p.waitForTimeout(800);
  await S.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(400);
  s = await st(p);
  ok('A: hold på play i 550 ms skjuler fortsatt alle (uendret)', s.off && s.hid, s);
  ok('A: ingen sidefeil', !S.errs.length, S.errs);
  await p.close();
}

/* ================================================================ B · sveip opp på hele kortet / ned lukker */
{
  const S = await setupMini();
  const { p } = S;
  const d2 = await box(p, '[data-mini] .mdots button:nth-child(2)');
  await tapAt(S, d2.l + d2.w / 2, d2.t + d2.h / 2);
  await p.evaluate(() => { window.__calls.length = 0; }); await hap(p);
  // sveip opp på tekstfeltet (ikke play) på spiller 2 – gummistrikk underveis
  let pt = await rowPt(p), midMy = null;
  await swipe(S, pt.x, pt.y, 4, -80, 8, 25, 600, async () => { midMy = (await st(p)).my; });
  let s = await st(p), h = await hap(p);
  ok('B: sveip opp på tekstfeltet → utvidet meny for den viste spilleren (spiller 2)', s.exp && s.expId === P3[1] && s.h === 172 && s.shown === P3[1], s);
  ok('B: gummistrikk underveis (0,35 × dy, maks 28 px)', midMy != null && midMy < -20 && midMy >= -28, midMy);
  ok('B: haptic selection ved terskel + medium ved åpning', h.includes('selection') && h.includes('medium'), h);
  ok('B: ingen klikk etter gesten (ikke #media, ingen spill/pause)', s.hash === '' && !(await mpCalls(p)).length, { hash: s.hash, c: await mpCalls(p) });
  const exp = await p.evaluate(() => { const r = deep('[data-mini] .mrow.mx'); return r && { id: r.dataset.mid, seek: !!r.querySelector('.mseek'), btn: r.querySelectorAll('.mxb button').length, name: (r.querySelector('.mtx b') || {}).textContent }; });
  ok('B: utvidet: art, navn, søkelinje, ⏮ −10 ⏯ +10 ⏭', exp && exp.id === P3[1] && exp.seek && exp.btn === 5, exp);
  if (SHOT) await p.screenshot({ path: SHOT + '/hjem50-b-utvidet.png' });
  // ned på søkelinjen → lukker IKKE
  const sk = await box(p, '[data-mini] .mseek');
  await swipe(S, sk.l + sk.w / 2, sk.t + sk.h / 2, 0, 80, 8, 25);
  s = await st(p);
  ok('B: sveip ned på søkelinjen lukker ikke', s.exp, s);
  // ned på en knapp (⏭) → lukker IKKE
  await p.evaluate(() => { window.__calls.length = 0; });
  const nx = await box(p, '[data-mini] [data-act="mxtrk"][data-d="1"]');
  await swipe(S, nx.l + nx.w / 2, nx.t + nx.h / 2, 0, 80, 8, 25);
  s = await st(p);
  ok('B: sveip ned på en knapp lukker ikke', s.exp, s);
  // ned på art/tekst → lukker, haptic light
  await hap(p);
  const xt = await box(p, '[data-mini] .mxt .mtx');
  await swipe(S, xt.l + 10, xt.t + xt.h / 2, 0, 70, 8, 25);
  s = await st(p); h = await hap(p);
  ok('B: utvidet → sveip ned hvor som helst ellers lukker (> 40 px)', !s.exp && s.h === 64 && !s.off, s);
  ok('B: haptic light ved lukking', h.includes('light'), h);
  ok('B: ingen klikk etter sveip ned (ikke #media)', s.hash === '', s.hash);
  // kort, raskt sveip (> 0,5 px/ms) opp åpner
  pt = await rowPt(p);
  await swipe(S, pt.x, pt.y, 0, -24, 1, 0, 600);
  s = await st(p);
  ok('B: raskt sveip opp (24 px, > 0,5 px/ms) åpner', s.exp, s);
  // og raskt ned lukker
  const xt2 = (await box(p, '[data-mini] .mxt .mtx')) || (await box(p, '[data-mini] .mtx'));
  await swipe(S, xt2.l + 10, xt2.t + xt2.h / 2, 0, 28, 1, 0, 600);
  s = await st(p);
  ok('B: raskt sveip ned (28 px, > 0,5 px/ms) lukker', !s.exp, s);
  // kort sveip opp (20 px, sakte) åpner ikke; fjærer tilbake
  pt = await rowPt(p);
  await swipe(S, pt.x, pt.y, 0, -22, 8, 40, 600);
  s = await st(p);
  ok('B: kort, sakte sveip opp (22 px) → ikke utvidet, fjærer tilbake', !s.exp && s.my === 0, s);
  // sveip opp på play (som før) → utvidet; chevron lukker
  const pp = await box(p, '[data-mini] .mpp');
  await swipe(S, pp.l + pp.w / 2, pp.t + pp.h / 2, 0, -60, 8, 25, 600);
  s = await st(p);
  ok('B: sveip opp på play → utvidet (samme gest)', s.exp && !(await mpCalls(p)).length, s);
  const ch = await box(p, '[data-mini] [data-act="mexp"]');
  await tapAt(S, ch.l + ch.w / 2, ch.t + ch.h / 2);
  ok('B: pilen (chevron) lukker fortsatt', !(await st(p)).exp);
  // sveip ned på lukket kort gjør ingenting
  pt = await rowPt(p);
  await swipe(S, pt.x, pt.y, 0, 80, 8, 25);
  s = await st(p);
  ok('B: sveip ned på lukket kort gjør ingenting', !s.exp && !s.off && s.my === 0, s);
  ok('B: ingen sidefeil', !S.errs.length, S.errs);
  await p.close();
}

/* ================================================================ C · «Kommer i dag» – tomtilstand */
{
  const p = await b.newPage({ viewport: { width: 430, height: 1100 }, hasTouch: true });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + resolve('test/harness.html'));
  for (const m of readdirSync('test/mock').filter((f) => f.endsWith('.js')).sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
  await p.addScriptTag({ path: bundle });
  const LONG = 'Marshals: A Yellowstone Story – The Extended Special Edition Part Two of the Saga';
  const r = await p.evaluate(async (LONG) => {
    const M = window.MSH, W = (ms) => new Promise((q) => setTimeout(q, ms));
    const at = (n, hh, mm = 0) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(hh, mm, 0, 0); return d; };
    const mk = (rows) => {
      const H = window.mockHass(); const S0 = H.states['sensor.sonarr_sonarr_upcoming_media'];
      Object.keys(H.states).filter((id) => /^calendar\.(sonarr|radarr)|radarr/.test(id)).forEach((id) => delete H.states[id]);
      H.states['sensor.sonarr_sonarr_upcoming_media'] = { ...S0, attributes: { ...S0.attributes, data: [{ title_default: '$title', line1_default: '$episode' }, ...rows] } };
      H.callApi = () => Promise.resolve([]);
      return H;
    };
    const mount = async (H) => { const c = document.createElement('msh-hjem-faner-card'); c.setConfig({ type: 'custom:msh-hjem-faner-card', card_id: 'ki-h50-' + Math.random().toString(36).slice(2), tabs: { hjem: { auto_fill: false, cards: ['rom:stue'] } } }); c.hass = H; document.getElementById('dash').appendChild(c); await W(900); return c; };
    const info = (c) => {
      const el = c.shadowRoot.querySelector('.sl.arr'); if (!el) return null;
      const e = el.querySelector('.are'), t = el.querySelector('.are-t'), s = el.querySelector('.are-s'), n = el.querySelector('.are-n');
      const er = e && e.getBoundingClientRect(), cr = el.getBoundingClientRect();
      const cs = (x) => x && getComputedStyle(x);
      return { t: t && t.textContent, s: s ? s.textContent : null, n: n ? n.textContent : null,
        tFs: cs(t).fontSize, tFw: cs(t).fontWeight, tLh: cs(t).lineHeight, tWrap: cs(t).textWrap || cs(t).textWrapStyle, tTt: cs(t).textTransform,
        sFs: s && cs(s).fontSize, sCol: s && cs(s).color, sWs: s && cs(s).whiteSpace, sTop: s && s.getBoundingClientRect().top, tBot: t.getBoundingClientRect().bottom,
        nFs: n && cs(n).fontSize, nFw: n && cs(n).fontWeight, nCol: n && cs(n).color, nClamp: n && (cs(n).webkitLineClamp || cs(n).lineClamp), nOw: n && cs(n).overflowWrap,
        nH: n && n.getBoundingClientRect().height, nSh: n && n.scrollHeight, nCh: n && n.clientHeight, nTop: n && n.getBoundingClientRect().top, sBot: s && s.getBoundingClientRect().bottom,
        left: er && Math.round(er.left - cr.left), right: er && Math.round(cr.right - er.right), bottom: er && Math.round(cr.bottom - er.bottom), minW: e && cs(e).minWidth, cardW: Math.round(cr.width), eW: er && Math.round(er.width) };
    };
    const out = {};
    // ingenting i dag, neste i morgen 20:00 (serie, S01E02, lang tittel)
    const c1 = await mount(mk([{ airdate: at(1, 20).toISOString(), title: LONG, number: 'S01E02', episode: 'Pilot', studio: 'Paramount+', poster: '', fanart: '' }, { airdate: at(4, 21).toISOString(), title: 'Senere', number: 'S02E01', poster: '' }]));
    out.tomorrow = info(c1);
    // kort tittel → én linje
    const c2 = await mount(mk([{ airdate: at(1, 20).toISOString(), title: 'Andor', number: 'S03E02', poster: '' }]));
    out.short = info(c2);
    // ingen kommende → bare «INGENTING I DAG»
    const c3 = await mount(mk([]));
    out.none = info(c3);
    // relativ dag (enhetstest av M.hjemArrNext)
    const d0 = new Date(); d0.setHours(0, 0, 0, 0);
    const wd = (n) => at(n, 12).toLocaleDateString('nb-NO', { weekday: 'long' });
    out.rel = {
      k1: M.hjemArrNext({ st: at(1, 20), title: 'X', sub: 'S01E02 · Pilot', source: 'sonarr' }, d0),
      k3: M.hjemArrNext({ st: at(3, 21, 30), title: 'X', source: 'sonarr', sub: '' }, d0), wd3: wd(3),
      k5: M.hjemArrNext({ st: at(5, 18), title: 'Film', source: 'radarr', sub: 'Digital utgivelse · film' }, d0), wd5: wd(5),
      k9: M.hjemArrNext({ st: at(9, 0), allDay: true, title: 'Film', source: 'radarr', sub: '' }, d0),
      none: M.hjemArrNext(null, d0),
    };
    out.gray = { afafaf: 'rgb(175, 175, 175)', e1: 'rgb(225, 225, 225)' };
    return out;
  }, LONG);
  const T = r.tomorrow;
  ok('C: «INGENTING I DAG» 26px / 300 / line-height 1.1 / balance / uppercase', T && T.tFs === '26px' && T.tFw === '300' && Math.abs(parseFloat(T.tLh) - 28.6) < 0.2 && /balance/.test(T.tWrap || '') && T.tTt === 'uppercase', T);
  ok('C: etikett på egen linje «Neste: i morgen · 20:00 · S01E02» 12px #afafaf', T && T.s === 'Neste: i morgen · 20:00 · S01E02' && T.sFs === '12px' && T.sCol === r.gray.afafaf && T.sTop >= T.tBot - 0.5, T);
  ok('C: tittel under (serienavn), 15px / 500 / #e1e1e1', T && T.n === LONG && T.nFs === '15px' && T.nFw === '500' && T.nCol === r.gray.e1 && T.nTop >= T.sBot - 0.5, T);
  ok('C: tittel maks 2 linjer (line-clamp 2, overflow-wrap anywhere), ellipsis først etter linje 2', T && String(T.nClamp) === '2' && T.nOw === 'anywhere' && T.nH > 15 * 1.25 * 1.5 && T.nH <= 15 * 1.25 * 2 + 1 && T.nSh > T.nCh, T);
  ok('C: blokken left/right/bottom 18px, min-width 0, innenfor kortet', T && T.left === 18 && T.right === 18 && T.bottom === 18 && T.minW === '0px' && T.eW === T.cardW - 36, T);
  ok('C: kort tittel → én linje (ingen kutt)', r.short && r.short.n === 'Andor' && r.short.nH <= 15 * 1.25 + 1 && r.short.nSh <= r.short.nCh + 1 && r.short.s === 'Neste: i morgen · 20:00 · S03E02', r.short);
  ok('C: ingen kommende → bare «INGENTING I DAG» (ingen etikett, ingen tittel)', r.none && /ingenting i dag/i.test(r.none.t) && r.none.s == null && r.none.n == null, r.none);
  const R = r.rel;
  ok('C: relativ dag: «i morgen · 20:00 · S01E02»', R.k1.next === 'i morgen · 20:00 · S01E02' && R.k1.nextTitle === 'X', R.k1);
  ok('C: relativ dag: «på <ukedag> · 21:30»', R.k3.next === `på ${R.wd3} · 21:30`, R.k3);
  ok('C: film (Radarr) uten SxxEyy: «på <ukedag> · 18:00»', R.k5.next === `på ${R.wd5} · 18:00` && R.k5.nextTitle === 'Film', R.k5);
  ok('C: «om 9 dager» (heldags → uten klokkeslett)', R.k9.next === 'om 9 dager', R.k9);
  ok('C: ingen → tom etikett og tittel', R.none.next === '' && R.none.nextTitle === '', R.none);
  if (SHOT) {
    await p.evaluate(() => { const c = [...document.querySelectorAll('msh-hjem-faner-card')][0]; const el = c.shadowRoot.querySelector('.sl.arr'); el.scrollIntoView(); });
    await p.screenshot({ path: SHOT + '/hjem50-c-tom.png' });
  }
  ok('C: ingen sidefeil', !errs.length, errs);
  await p.close();
}

await b.close();
try { rmSync(bundle); } catch (e) { /* */ }
res.forEach((x) => console.log(x));
const bad = res.filter((x) => x.startsWith('✘')).length;
console.log(bad ? `hjem50-check: ${bad} FEIL` : `hjem50-check: OK (${res.length})`);
process.exit(bad ? 1 : 0);
