// Fiks 17.26 / 17.27: mini-spilleren over navbaren + farge på verktøyene i «Mer»-menyen.
//  · mobil: mini-spilleren flyter 10 px over navbaren, samme bredde og midtpunkt, rund pille 64 px, ingen cast
//  · skjules i #media, hold på play/pause → bare skjult til neste avspilling (19.7: ingen pause), tilbake ved playing
//  · 19.6 spillervalg i nedtrekksliste · 19.9 Mer-menyen over mini-spilleren + hold/dra omorganiserer ikonene · 19.15 TV: − / + i pillen
//  · volum: trykk → pille, dra → volume_set; hold → volume_mute
//  · flere spillere → prikker + sveip; av i config → ingen mini
//  · bred (rail) med HA-sidebar: mini-spilleren ligger innenfor dashbordflaten (aldri over sidebaren), over høyre fliskolonne (18.4/18.8)
//  · «Mer»-menyen: verktøyene under streken har samme farge som punktene over (standard og glass)
//  · «Tilpass navbar» → Mini-spiller: av/på, Vis når, Skjul i Media-popupen
//  · 20.16 «Skjul når en popup er åpen» · 20.20 dra fra play/pause → ⏮/⏭ · 20.6 «Avstand fra bunnen» i «Plassering og oppførsel»
// Kjør: node test/mini-check.mjs
import { createRequire } from 'node:module';
import { readdirSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/mini-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = [];
const ok = (name, cond, info) => res.push(`${cond ? '✔' : '✘'} ${name}${info != null ? ' · ' + JSON.stringify(info) : ''}`);
const SHOT = process.env.SHOT_DIR;

async function setup(vp, cfg, sb) {
  const p = await b.newPage({ viewport: vp, hasTouch: true });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + resolve('test/harness.html'));
  for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
  await p.addScriptTag({ path: bundle });
  await p.evaluate(async ({ cfg, sb }) => {
    if (sb) document.documentElement.style.setProperty('--sb', sb + 'px');
    window.deepAll = (sel) => { const out = []; const walk = (root) => root.querySelectorAll('*').forEach((e) => { if (e.matches(sel)) out.push(e); if (e.shadowRoot) walk(e.shadowRoot); }); walk(document); return out; };
    window.deep = (sel) => window.deepAll(sel)[0] || null;
    window.rect = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { l: +r.left.toFixed(1), t: +r.top.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1), b: +r.bottom.toFixed(1), r: +r.right.toFixed(1) }; };
    const H = window.mockHass(); window.H = H;
    const S = H.states;
    // Bare én spiller spiller (resten av), så testen er forutsigbar
    Object.keys(S).filter((k) => k.startsWith('media_player.')).forEach((k) => { S[k] = { ...S[k], state: 'off' }; });
    S['media_player.kjokken_radio'] = { ...S['media_player.kjokken_radio'], state: 'playing', last_changed: new Date().toISOString() };
    window.CUR = { ...S };
    window.setRaw = (id, o) => { window.CUR = { ...window.CUR, [id]: o }; const nb = deep('msh-navbar-card'); nb.hass = { ...H, states: window.CUR }; };
    window.setSt = (id, st, attrs) => { const o = window.CUR[id]; setRaw(id, { ...o, state: st, attributes: { ...o.attributes, ...(attrs || {}) }, last_changed: new Date().toISOString() }); };
    const c = document.createElement('msh-navbar-card'); c.setConfig({ type: 'custom:msh-navbar-card', card_id: 'ki-navbar', ...cfg }); c.hass = H;
    document.getElementById('dash').appendChild(c);
    await new Promise((q) => setTimeout(q, 700));
  }, { cfg, sb });
  return { p, errs };
}
const mini = (p) => p.evaluate(() => { const m = deep('[data-mini]'); if (!m) return null; const n = deep('nav.nb'); return { m: rect(m), n: rect(n), off: m.classList.contains('off'), rows: m.querySelectorAll('.mrow').length, dots: m.querySelectorAll('.mdots button').length, cast: !!m.querySelector('[icon*="cast"]'), rad: getComputedStyle(m).borderRadius, art: rect(m.querySelector('.mart')), artR: getComputedStyle(m.querySelector('.mart')).borderRadius, img: !!m.querySelector('.mart img'), txt: m.querySelector('.mtx') ? m.querySelector('.mtx').innerText : '' }; });
const tap = async (p, sel) => { const pt = await p.evaluate((s) => { const r = deep(s).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel); await p.touchscreen.tap(pt.x, pt.y); await p.waitForTimeout(350); };
const hold = async (p, sel, ms = 800) => {
  const pt = await p.evaluate((s) => { const r = deep(s).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel);
  const c = await p.context().newCDPSession(p);
  await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pt.x, y: pt.y }] }); await p.waitForTimeout(ms);
  await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(400);
};
const calls = (p) => p.evaluate(() => window.__calls.filter((c) => c[0] === 'media_player').map((c) => c[1]));

/* ---------------- mobil, standard */
{
  const { p, errs } = await setup({ width: 390, height: 844 }, {});
  let m = await mini(p);
  ok('mobil: mini-spilleren vises når noe spiller', m && !m.off, m && m.txt);
  ok('mobil: like bred som navbaren og sentrert', m && Math.abs(m.m.w - m.n.w) < 1 && Math.abs(m.m.l - m.n.l) < 1, m && { mini: m.m, nav: m.n });
  ok('mobil: 10 px over navbaren', m && Math.abs(m.n.t - m.m.b - 10) <= 1, m && m.n.t - m.m.b);
  ok('mobil: rund pille 64 px, rundt albumbilde 48, ingen cast', m && m.m.h === 64 && m.rad === '40px' && m.art.w === 48 && m.artR === '50%' && !m.cast && m.img, m && { h: m.m.h, rad: m.rad, art: m.art.w, artR: m.artR, img: m.img });
  if (SHOT) await p.screenshot({ path: SHOT + '/mini-mobil.png' });
  // spill/pause
  await tap(p, '.mpp');
  ok('play/pause → media_play_pause', (await calls(p)).includes('media_play_pause'));
  // volum
  await tap(p, '.mvb');
  const vp = await p.evaluate(() => !!deep('.mvp'));
  ok('volum-knapp → volum-pille', vp);
  if (vp) {
    const r = await p.evaluate(() => rect(deep('.mvp')));
    const cdp = await p.context().newCDPSession(p);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: r.l + r.w * 0.2, y: r.t + r.h / 2 }] });
    for (let i = 1; i <= 6; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: r.l + r.w * (0.2 + i * 0.1), y: r.t + r.h / 2 }] }); await p.waitForTimeout(60); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(300);
    const vs = await p.evaluate(() => window.__calls.filter((c) => c[1] === 'volume_set').map((c) => c[2].volume_level));
    ok('dra på pillen → volume_set (throttlet)', vs.length >= 1 && vs.length <= 6 && Math.abs(vs[vs.length - 1] - 0.8) < 0.05, vs);
    await p.waitForTimeout(3300);
    ok('volum-pillen lukkes etter 3 s', await p.evaluate(() => !deep('.mvp')));
  }
  await hold(p, '.mvb', 700);
  ok('hold volum → volume_mute', (await calls(p)).includes('volume_mute') && await p.evaluate(() => !deep('.mvp')));
  // hold rad → more-info
  await p.evaluate(() => { window.__mi = []; window.addEventListener('hass-more-info', (e) => window.__mi.push(e.detail.entityId), true); });
  await hold(p, '.mhit', 800);
  ok('hold raden → more-info', await p.evaluate(() => window.__mi.includes('media_player.kjokken_radio')), await p.evaluate(() => window.__mi));
  // trykk rad → #media
  await tap(p, '.mhit');
  ok('trykk raden → #media', await p.evaluate(() => location.hash === '#media'));
  await p.waitForTimeout(300);
  m = await mini(p);
  ok('skjult i Media-popupen', m && m.off);
  await p.evaluate(() => { history.replaceState(null, '', location.pathname); window.dispatchEvent(new Event('hashchange')); });
  await p.waitForTimeout(400);
  m = await mini(p);
  ok('tilbake når popupen lukkes', m && !m.off);
  // hold play/pause → bare skjult til neste avspilling (Fiks 19.7: ingen pause)
  await p.evaluate(() => { window.__calls.length = 0; });
  await hold(p, '.mpp', 800);
  m = await mini(p);
  const ss = await p.evaluate(() => sessionStorage.getItem('ki:mini:hidden'));
  const hc = await calls(p);
  ok('19.7 hold play/pause → skjult + sessionStorage, INGEN media_pause/play_pause', !hc.length && m && m.off && !!ss, hc);
  await p.evaluate(() => setSt('media_player.kjokken_radio', 'paused')); await p.waitForTimeout(300);
  ok('forblir skjult når spilleren pauses', (await mini(p)).off);
  await p.evaluate(() => setSt('media_player.kjokken_radio', 'playing')); await p.waitForTimeout(300);
  m = await mini(p);
  ok('kommer tilbake ved ny avspilling', m && !m.off && !(await p.evaluate(() => sessionStorage.getItem('ki:mini:hidden'))));
  // flere spillere
  await p.evaluate(() => setSt('media_player.stue_sonos', 'playing')); await p.waitForTimeout(300);
  m = await mini(p);
  ok('flere spillere → sveip + prikker', m && m.rows === 2 && m.dots === 2, m && { rows: m.rows, dots: m.dots });
  const sw = await p.evaluate(() => { const s = deep('.msw'); return { ta: getComputedStyle(s).touchAction, snap: getComputedStyle(s).scrollSnapType }; });
  ok('scroll-snap + touch-action pan-x', /pan-x/.test(sw.ta) && /x/.test(sw.snap), sw);
  await tap(p, '.mdots button:nth-child(2)'); await p.waitForTimeout(500);
  ok('prikk → spiller 2', await p.evaluate(() => { const s = deep('.msw'); return Math.round(s.scrollLeft / s.clientWidth) === 1 && deep('.mdots button.on') === deepAll('.mdots button')[1]; }));
  // 20.19: retur fra bakgrunn → første spiller som spiller (posisjonen lagres ikke)
  await p.evaluate(() => { const vs = (v) => Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v }); vs('hidden'); document.dispatchEvent(new Event('visibilitychange')); vs('visible'); document.dispatchEvent(new Event('visibilitychange')); delete document.visibilityState; }); await p.waitForTimeout(400);
  ok('20.19 retur fra bakgrunn → spiller 1', await p.evaluate(() => { const s = deep('.msw'); return Math.round(s.scrollLeft / s.clientWidth) === 0 && deep('.mdots button.on') === deepAll('.mdots button')[0]; }));
  await tap(p, '.mdots button:nth-child(2)'); await p.waitForTimeout(500);
  // scroll → krymper med navbaren
  await p.evaluate(() => { document.getElementById('dash').style.height = '3000px'; window.scrollTo(0, 400); }); await p.waitForTimeout(700);
  m = await mini(p);
  ok('følger navbarens krymping', m && Math.abs(m.m.w - m.n.w) < 1.5 && m.n.t - m.m.b > 4 && m.n.t - m.m.b < 12, m && { mw: m.m.w, nw: m.n.w, gap: m.n.t - m.m.b });
  await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(500);
  // 17.27: Mer-menyen
  await tap(p, 'nav.nb [data-id="__more"]'); await p.waitForTimeout(400);
  const col = await p.evaluate(() => deepAll('.mbox .mi').map((e) => [e.dataset.id, getComputedStyle(e).color, getComputedStyle(e.querySelector('ha-icon')).color, getComputedStyle(e).opacity]));
  const tools = col.filter((x) => x[0].startsWith('__')), list = col.filter((x) => !x[0].startsWith('__'));
  ok('17.27 standard: verktøy = samme farge som punktene over', tools.length && list.length && tools.every((t) => t[1] === list[0][1] && t[2] === list[0][2] && t[3] === '1'), col);
  ok('ingen sidefeil (mobil)', !errs.length, errs);
  // 19.9: menyen løftes over mini-spilleren (dekker den ikke)
  const ov = await p.evaluate(() => { const mb = deep('.mbox'), mi = deep('[data-mini]'); return mb && mi ? { mb: rect(mb), mi: rect(mi), off: mi.classList.contains('off') } : null; });
  ok('19.9 Mer-menyen står over mini-spilleren uten å dekke den', ov && !ov.off && ov.mb.b <= ov.mi.t - 4, ov);
  if (SHOT) await p.screenshot({ path: SHOT + '/mini-meny.png' });
  await p.close();
}
/* ---------------- 19.9: hold og dra for å omorganisere navbar-ikonene */
{
  const { p, errs } = await setup({ width: 390, height: 844 }, { hidden: ['basseng'] });
  const order = () => p.evaluate(() => deepAll('nav.nb .it').map((b) => b.dataset.id));
  const o0 = await order();
  const pts = await p.evaluate(() => deepAll('nav.nb .it').map((b) => { const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }));
  await p.evaluate(() => { window.__hash0 = location.hash; });
  const c = await p.context().newCDPSession(p);
  await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pts[0].x, y: pts[0].y }] }); await p.waitForTimeout(600);
  const lift = await p.evaluate(() => { const b = deep('nav.nb .it.lift'); return b ? getComputedStyle(b).transform : null; });
  for (let i = 1; i <= 8; i++) { await c.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: pts[0].x + (pts[2].x - pts[0].x + 6) * i / 8, y: pts[0].y }] }); await p.waitForTimeout(40); }
  await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(700);
  const o1 = await order();
  const bar = await p.evaluate(() => deep('msh-navbar-card').config.bar);
  ok('19.9 hold + dra → løftet ikon (scale 1.12)', !!lift && /matrix\(1\.12/.test(lift), lift);
  ok('19.9 ny rekkefølge i navbaren', o1[0] === o0[1] && o1[1] === o0[2] && o1[2] === o0[0], { o0, o1 });
  ok('19.9 lagret i config.bar, skjult ikon beholder plassen', Array.isArray(bar) && bar[3] === 'basseng' && bar.indexOf(o0[0]) === 2, bar);
  ok('19.9 draget åpnet ingen popup', await p.evaluate(() => location.hash === window.__hash0));
  // vanlig trykk virker som før
  await tap(p, `nav.nb [data-id="${o1[0]}"]`);
  ok('19.9 vanlig trykk åpner fortsatt popupen', await p.evaluate((id) => location.hash === '#' + id, o1[0]));
  // flytt > 8 px før holdet → avbrutt
  await p.evaluate(() => { history.replaceState(null, '', location.pathname); window.dispatchEvent(new Event('hashchange')); }); await p.waitForTimeout(300);
  await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pts[1].x, y: pts[1].y }] }); await p.waitForTimeout(100);
  await c.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: pts[1].x + 30, y: pts[1].y }] }); await p.waitForTimeout(500);
  const noLift = await p.evaluate(() => !deep('nav.nb .it.lift'));
  await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(400);
  ok('19.9 bevegelse > 8 px før holdet → ingen omorganisering', noLift && JSON.stringify(await order()) === JSON.stringify(o1));
  ok('ingen sidefeil (omorganiser)', !errs.length, errs);
  await p.close();
}
/* ---------------- 19.15: TV i mini-spilleren → − / % / + i pillen */
{
  const { p, errs } = await setup({ width: 390, height: 844 }, {});
  await p.evaluate(() => { setSt('media_player.kjokken_radio', 'off'); setSt('media_player.prosjektor', 'playing'); }); await p.waitForTimeout(400);
  await tap(p, '.mvb');
  const tv = await p.evaluate(() => { const v = deep('.mvp'); if (!v) return null; const st = [...v.querySelectorAll('.mst')].map((b) => rect(b)); return { tvs: v.classList.contains('tvs'), n: st.length, w: st.map((r) => r.w), txt: v.innerText.trim(), h: rect(v).h, x: !!deep('.mvb [icon="mdi:close"]') }; });
  ok('19.15 TV: pille med − · % · + (34 px), knappen blir ✕', tv && tv.tvs && tv.n === 2 && tv.w.every((w) => w === 34) && /24\s*%/.test(tv.txt) && tv.h === 40 && tv.x, tv);
  await p.evaluate(() => { window.__calls.length = 0; });
  await tap(p, '.mvp .mst[data-d="1"]');
  ok('19.15 trykk + → media_player.volume_up', JSON.stringify(await calls(p)) === '["volume_up"]', await calls(p));
  await p.evaluate(() => { window.__calls.length = 0; });
  await hold(p, '.mvp .mst[data-d="-1"]', 1200);
  const dn = await calls(p);
  ok('19.15 hold − → gjentar (hvert 250 ms etter 400 ms)', dn.length >= 3 && dn.every((x) => x === 'volume_down'), dn);
  await p.waitForTimeout(3300);
  ok('19.15 pillen lukkes 3 s etter siste trykk', await p.evaluate(() => !deep('.mvp')));
  await p.evaluate(() => setSt('media_player.prosjektor', 'playing', { volume_level: undefined })); await p.waitForTimeout(300);
  await tap(p, '.mvb');
  ok('19.15 uten volume_level: bare ikonet (ingen %)', await p.evaluate(() => { const v = deep('.mvp .mvl'); return v && !/%|–/.test(v.innerText); }));
  ok('ingen sidefeil (TV)', !errs.length, errs);
  await p.close();
  const e2 = await setup({ width: 390, height: 844 }, { mini: { tv_vol: 'slider' } });
  await e2.p.evaluate(() => { setSt('media_player.kjokken_radio', 'off'); setSt('media_player.prosjektor', 'playing'); }); await e2.p.waitForTimeout(400);
  await tap(e2.p, '.mvb');
  ok('19.15 «Volum for TV: Slider» → vanlig slider', await e2.p.evaluate(() => { const v = deep('.mvp'); return v && !v.classList.contains('tvs') && v.dataset.set === '1'; }));
  await e2.p.close();
}
/* ---------------- glass + meny */
{
  const { p, errs } = await setup({ width: 390, height: 844 }, { style: 'glass' });
  const m = await mini(p);
  ok('glass: mini-spilleren vises, samme bredde', m && !m.off && Math.abs(m.m.w - m.n.w) < 1 && Math.abs(m.n.t - m.m.b - 10) <= 1, m && { m: m.m, n: m.n });
  if (SHOT) await p.screenshot({ path: SHOT + '/mini-glass.png' });
  await p.waitForTimeout(1200); // test/mock/10-navbar.js sin egen #klima-sjekk lukker menyen hvis den åpnes før den er ferdig
  await tap(p, 'nav.nb [data-id="__more"]'); await p.waitForTimeout(400);
  const col = await p.evaluate(() => deepAll('.mbox .mi').map((e) => [e.dataset.id, getComputedStyle(e).color, getComputedStyle(e.querySelector('ha-icon')).color]));
  ok('17.27 glass: alle ikonene #fafafa', col.length && col.every((x) => x[1] === 'rgb(250, 250, 250)' && x[2] === 'rgb(250, 250, 250)'), col);
  ok('17.27 glass: skillestrek rgba(255,255,255,0.18)', await p.evaluate(() => { const s = deep('.mbox .sep'); return s && getComputedStyle(s).backgroundColor; }) === 'rgba(255, 255, 255, 0.18)', await p.evaluate(() => { const s = deep('.mbox .sep'); return s && getComputedStyle(s).backgroundColor; }));
  ok('ingen sidefeil (glass)', !errs.length, errs);
  await p.close();
}
/* ---------------- av i config / betingelse */
{
  const { p } = await setup({ width: 390, height: 844 }, { mini: { on: false } });
  ok('mini.on = false → ingen mini-spiller', !(await mini(p)));
  await p.close();
  const e = await setup({ width: 390, height: 844 }, { mini: { cond: 'entity', entity: 'input_boolean.vis_mini', state: 'on' } });
  ok('Betingelse (entitet mangler) → skjult', !(await mini(e.p)) || (await mini(e.p)).off);
  await e.p.evaluate(() => { setSt('media_player.kjokken_radio', 'off'); setRaw('input_boolean.vis_mini', { entity_id: 'input_boolean.vis_mini', state: 'on', attributes: { friendly_name: 'Vis mini' }, last_changed: new Date().toISOString() }); });
  await e.p.waitForTimeout(300);
  const m = await mini(e.p);
  ok('Betingelse på → siste spiller vises (også når ingenting spiller)', m && !m.off, m && m.txt);
  await e.p.close();
}
/* ---------------- bred + HA-sidebar */
{
  const { p, errs } = await setup({ width: 1440, height: 900 }, {}, 256);
  const m = await mini(p);
  const dash = await p.evaluate(() => rect(document.getElementById('dash')));
  // Fiks 18.4/18.8: Fold-oppsettet – nederst til høyre over høyre fliskolonne (uten Hjem: utregningen (innhold − 8) / 2,
  // høyrekant = innholdets padding-right 18), innenfor dashbordflaten og til høyre for railen
  const tr = await p.evaluate(() => getComputedStyle(deep('[data-mini]')).transform);
  ok('bred: mini-spilleren innenfor dashbordflaten, over høyre kolonne (ikke over sidebaren/railen)', m && !m.off && m.m.l >= 256 + 120 && Math.abs(m.m.r - (dash.r - 18)) < 2 && Math.abs(m.m.w - (dash.w - 120 - 18 - 8) / 2) < 2 && m.m.b <= 900 - 15, m && { m: m.m, dash });
  ok('bred: ingen translateX/sentrering', /^(none|matrix\(1, 0, 0, 1, 0, [-\d.]+\))$/.test(tr), tr);
  if (SHOT) await p.screenshot({ path: SHOT + '/mini-bred.png' });
  ok('ingen sidefeil (bred)', !errs.length, errs);
  await p.close();
}
/* ---------------- Fiks 20.16: skjul når en popup er åpen · 20.20: dra fra play/pause → forrige/neste */
{
  const { p, errs } = await setup({ width: 360, height: 780 }, {});
  // Bubble-popuper i dashbordet (config.hash som Bubble Card)
  await p.evaluate(() => ['#stue', '#lys', '#media'].forEach((h) => { const bc = document.createElement('bubble-card'); bc.config = { type: 'custom:bubble-card', card_type: 'pop-up', hash: h }; document.getElementById('dash').appendChild(bc); }));
  const go = async (h) => { await p.evaluate((x) => { if (x) location.hash = x; else { history.replaceState(null, '', location.pathname); window.dispatchEvent(new Event('location-changed')); } }, h); await p.waitForTimeout(400); };
  await go('#stue');
  ok('20.16 av (standard): mini-spilleren vises i #stue som før', !(await mini(p)).off);
  await go('');
  // bryteren i Tilpass navbar (per bruker × enhet, nav_profiles)
  const tg = await p.evaluate(async () => {
    const ed = document.createElement('msh-navbar-editor'); ed.cardClass = customElements.get('msh-navbar-card');
    ed.hass = H; ed.setConfig({ type: 'custom:msh-navbar-card', card_id: 'ki-navbar' }); document.body.appendChild(ed); await new Promise((q) => setTimeout(q, 200));
    const mk = () => [...ed.shadowRoot.querySelectorAll('[data-a="nbmini"],[data-a="nbmhpop"]')].map((b) => b.dataset.a === 'nbmhpop' ? 'POP' : b.dataset.k);
    const order = mk();
    ed.shadowRoot.querySelector('[data-a="nbmhpop"]').click(); await new Promise((q) => setTimeout(q, 300));
    const on = ed.shadowRoot.querySelector('[data-a="nbmhpop"] .trk').classList.contains('on');
    ed.remove();
    return { order, on, prof: MSH.navProfile().mini_hide_popups };
  });
  ok('20.16 bryteren ligger rett under «Skjul i Media-popupen», lagres i nav_profiles', tg.order.indexOf('POP') === tg.order.indexOf('hide_in_media') + 1 && tg.on && tg.prof === true, tg);
  let m = await mini(p);
  ok('20.16 på: synlig uten popup', m && !m.off);
  for (const h of ['#stue', '#lys', '#media']) {
    await go(h);
    const st = await p.evaluate(() => { const e = deep('[data-mini]'); const cs = getComputedStyle(e); return { off: e.classList.contains('off'), pe: cs.pointerEvents }; });
    ok(`20.16 på: skjult i ${h} (opacity 0, pointer-events none)`, st.off && st.pe === 'none', st);
    await go('');
    ok(`20.16 tilbake når ${h} lukkes`, !(await mini(p)).off);
  }
  ok('20.16 ingen media-kall (avspillingen påvirkes ikke)', !(await calls(p)).length, await calls(p));
  await p.evaluate(() => MSH.profileSet('nav_profiles', { mini_hide_popups: undefined }));
  await p.waitForTimeout(300);
  // 20.20 – spilleren støtter forrige/neste
  await p.evaluate(() => { window.__calls.length = 0; window.__toast = []; const o = window.CUR['media_player.kjokken_radio']; setRaw('media_player.kjokken_radio', { ...o, attributes: { ...o.attributes, supported_features: (o.attributes.supported_features | 16 | 32) } }); window.__ts = []; const t0 = MSH.toast; MSH.toast = (x, o2) => { window.__ts.push(x); return t0(x, o2); }; });
  await p.waitForTimeout(300);
  const cdp = await p.context().newCDPSession(p);
  const pp = await p.evaluate(() => rect(deep('.mpp')));
  const mr = await p.evaluate(() => rect(deep('[data-mini]')));
  const T = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const drag = async (toX, rel = true) => {
    const x0 = pp.l + pp.w / 2, y0 = pp.t + pp.h / 2;
    await T('touchStart', x0, y0); await p.waitForTimeout(60);
    const n = 10; for (let i = 1; i <= n; i++) { await T('touchMove', x0 + (toX - x0) * i / n, y0); await p.waitForTimeout(30); }
    await p.waitForTimeout(450);
    const st = await p.evaluate(() => ({ b: deepAll('.mskb').map((b) => ({ k: b.dataset.sk, r: rect(b), on: b.classList.contains('on'), dis: b.classList.contains('dis') })), sl: deep('.msw').scrollLeft }));
    if (rel) { await T('touchEnd'); await p.waitForTimeout(400); }
    return st;
  };
  const cx = mr.l + mr.w / 2;
  let st = await drag(cx - 62);
  const prev = st.b.find((b) => b.k === 'prev'), next = st.b.find((b) => b.k === 'next');
  ok('20.20 dra fra play/pause → ⏮ og ⏭ midt på kortet (± 62 px), 46 px, samme høyde som knappen', prev && next && Math.abs(prev.r.l + prev.r.w / 2 - (cx - 62)) < 9 && Math.abs(next.r.l + next.r.w / 2 - (cx + 62)) < 3 && Math.abs(next.r.w - 46) < 1 && Math.abs(next.r.t + 23 - (pp.t + pp.h / 2)) < 2, { st, cx, pp });
  ok('20.20 begge synlige på 360 px', prev && next && prev.r.l >= 0 && next.r.r <= 360 && next.r.r < pp.l + 4, st.b.map((b) => b.r));
  ok('20.20 fingeren over ⏮ → markert (rosa, scale 1.14)', prev && prev.on && !next.on, st.b);
  let c = await p.evaluate(() => window.__calls.filter((x) => x[0] === 'media_player').map((x) => x[1]));
  ok('20.20 slipp på ⏮ → media_previous_track (ingen play/pause)', JSON.stringify(c) === '["media_previous_track"]', c);
  ok('20.20 toast «Forrige spor»', await p.evaluate(() => window.__ts.includes('Forrige spor')), await p.evaluate(() => window.__ts));
  ok('20.20 knappene trekkes inn igjen', await p.evaluate(() => !deep('.msk')));
  ok('20.20 sveip mellom spillere trigges ikke', st.sl === 0, st.sl);
  await p.evaluate(() => { window.__calls.length = 0; });
  st = await drag(cx + 62);
  c = await p.evaluate(() => window.__calls.filter((x) => x[0] === 'media_player').map((x) => x[1]));
  ok('20.20 slipp på ⏭ → media_next_track', JSON.stringify(c) === '["media_next_track"]' && st.b.find((b) => b.k === 'next').on, c);
  await p.evaluate(() => { window.__calls.length = 0; });
  await drag(cx);
  c = await p.evaluate(() => window.__calls.filter((x) => x[0] === 'media_player').map((x) => x[1]));
  ok('20.20 slipp i midten → ingenting', !c.length, c);
  // uten PREVIOUS_TRACK: ⏮ grå og gjør ingenting
  await p.evaluate(() => { const o = window.CUR['media_player.kjokken_radio']; setRaw('media_player.kjokken_radio', { ...o, attributes: { ...o.attributes, supported_features: (o.attributes.supported_features & ~16) } }); window.__calls.length = 0; });
  await p.waitForTimeout(300);
  st = await drag(cx - 62);
  c = await p.evaluate(() => window.__calls.filter((x) => x[0] === 'media_player').map((x) => x[1]));
  ok('20.20 uten PREVIOUS_TRACK: ⏮ grå, slipp gjør ingenting', st.b.find((b) => b.k === 'prev').dis && !st.b.find((b) => b.k === 'prev').on && !c.length, { b: st.b, c });
  // trykk = spill/pause, hold = skjul (uendret)
  await tap(p, '.mpp');
  c = await p.evaluate(() => window.__calls.filter((x) => x[0] === 'media_player').map((x) => x[1]));
  ok('20.20 trykk = spill/pause som før', JSON.stringify(c) === '["media_play_pause"]', c);
  await hold(p, '.mpp', 800);
  ok('20.20 hold 550 ms = skjul som før', (await mini(p)).off && !!(await p.evaluate(() => sessionStorage.getItem('ki:mini:hidden'))));
  if (SHOT) await p.screenshot({ path: SHOT + '/mini-skip.png' });
  ok('ingen sidefeil (20.16/20.20)', !errs.length, errs);
  await p.close();
}
/* ---------------- Fiks 20.6: «Avstand fra bunnen» inni «Plassering og oppførsel» */
{
  const { p, errs } = await setup({ width: 390, height: 844 }, {});
  const r = await p.evaluate(async () => {
    const ed = document.createElement('msh-navbar-editor'); ed.cardClass = customElements.get('msh-navbar-card');
    ed.hass = H; ed.setConfig({ type: 'custom:msh-navbar-card', card_id: 'ki-navbar' }); document.body.appendChild(ed); await new Promise((q) => setTimeout(q, 200));
    const R = ed.shadowRoot, sec = [...R.querySelectorAll('details.sec')].find((d) => /Plassering og oppførsel/.test(d.querySelector('summary').textContent));
    if (!sec) return null;
    sec.open = true; await new Promise((q) => setTimeout(q, 50));
    const inSec = (sel) => !!sec.querySelector(sel);
    const lbl = [...sec.querySelectorAll('.gt')].find((g) => g.textContent === 'Avstand fra bunnen');
    const gts = [...sec.querySelectorAll('.gt')].map((g) => g.textContent);
    const all = [...R.querySelectorAll('.gt, details.sec > summary')].map((g) => g.textContent.trim());
    const cs = lbl && getComputedStyle(lbl);
    // Rekkefølge i kortet: brytere → Bredde → Avstand; Stil rett etter kortet
    const kids = [...sec.querySelectorAll('[data-a="bool"], [data-a="nbtog"], .wseg, .nbbot')].map((e) => e.dataset.a || e.className);
    const iS = all.findIndex((t) => /Plassering og oppførsel/.test(t)), next = all.slice(iS + 1).find((t) => !gts.includes(t));
    // slideren virker som før (live + lagres ved slipp)
    const sl = sec.querySelector('[data-nbbot]'); sl.value = '30'; sl.dispatchEvent(new Event('input', { bubbles: true, composed: true })); sl.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    await new Promise((q) => setTimeout(q, 300));
    return { sl: inSec('[data-nbbot]') && inSec('.nbbot .hint'), outside: [...R.querySelectorAll('[data-nbbot]')].filter((e) => !sec.contains(e)).length, fs: cs && cs.fontSize, col: cs && cs.color, bt: cs && cs.borderTopWidth + ' ' + cs.borderTopColor, gts, kids, next, bottom: MSH.navProfile().bottom, std: !!sec.querySelector('[data-a="nbbotstd"]') };
  });
  ok('20.6 «Avstand fra bunnen» ligger inni «Plassering og oppførsel» (ikke egen seksjon)', r && r.sl && r.outside === 0, r);
  ok('20.6 etikett 12 px #979797, skilt med tynn linje', r && r.fs === '12px' && r.col === 'rgb(151, 151, 151)' && /^1px rgba\(255, 255, 255, 0\.06\)/.test(r.bt), r && { fs: r.fs, col: r.col, bt: r.bt });
  ok('20.6 rekkefølge: brytere → Bredde → Avstand fra bunnen', r && r.kids[r.kids.length - 1] === 'nbbot' && r.kids[r.kids.length - 2] === 'wseg' && r.kids.indexOf('bool') < r.kids.indexOf('wseg') && r.gts.join('|') === 'Visning|Bredde|Avstand fra bunnen', r && { kids: r.kids, gts: r.gts });
  ok('20.6 «Stil» kommer rett etter kortet', r && r.next === 'Stil', r && r.next);
  ok('20.6 slideren virker som før (nav_profiles.bottom + Standard-knapp)', r && r.bottom === 30 && r.std, r && { b: r.bottom, std: r.std });
  ok('ingen sidefeil (20.6)', !errs.length, errs);
  await p.close();
}
/* ---------------- editor */
{
  const { p, errs } = await setup({ width: 390, height: 844 }, {});
  const r = await p.evaluate(async () => {
    const ed = document.createElement('msh-navbar-editor');
    ed.cardClass = customElements.get('msh-navbar-card');
    let last = null; ed.addEventListener('config-changed', (e) => { last = e.detail.config; });
    ed.hass = H; ed.setConfig({ type: 'custom:msh-navbar-card', card_id: 'x' });
    document.body.appendChild(ed); await new Promise((q) => setTimeout(q, 200));
    const q = (s) => { const o = []; const w = (r) => r.querySelectorAll('*').forEach((e) => { if (e.matches(s)) o.push(e); if (e.shadowRoot) w(e.shadowRoot); }); w(ed.shadowRoot); return o; };
    const has = q('.gt').some((e) => e.textContent === 'Mini-spiller');
    q('[data-a="nbmcond"][data-v="entity"]')[0].click(); await new Promise((q2) => setTimeout(q2, 50));
    const c1 = last && last.mini;
    const ent = q('[data-search="nbmq"]').length > 0;
    q('[data-a="nbmini"][data-k="hide_in_media"]')[0].click(); await new Promise((q2) => setTimeout(q2, 50));
    const c2 = last && last.mini;
    // 19.6: Spillere = én lukket rad (msh-entity-multi) → åpen: søk, Vanlige/Valgt/Alle, gruppert liste, «Alle»
    const mm = q('msh-entity-multi')[0], ms = mm && mm.shadowRoot;
    const closed = mm ? { rows: ms.querySelectorAll('.mh').length, h: ms.querySelector('.mh').getBoundingClientRect().height, txt: ms.querySelector('.mh').innerText, list: !!ms.querySelector('.ls'), chips: q('[data-a="nbmpl"]').length } : null;
    if (mm) { ms.querySelector('.mh').click(); await new Promise((q2) => setTimeout(q2, 50)); }
    const open = mm ? { sq: !!ms.querySelector('.sq'), seg: [...ms.querySelectorAll('.sg button')].map((b) => b.textContent), gh: [...ms.querySelectorAll('.gh')].map((b) => b.textContent), rows: ms.querySelectorAll('.rw').length, mh: getComputedStyle(ms.querySelector('.ls')).maxHeight, ov: getComputedStyle(ms.querySelector('.ls')).overflowY, osb: getComputedStyle(ms.querySelector('.ls')).overscrollBehaviorY } : null;
    let pl = null;
    if (mm) {
      ms.querySelector('.rw[data-v="media_player.kjokken_radio"]').click(); await new Promise((q2) => setTimeout(q2, 50));
      pl = last && last.mini && last.mini.players;
      const i = ms.querySelector('.sq'); i.value = 'prosj'; i.dispatchEvent(new Event('input', { bubbles: true, composed: true })); await new Promise((q2) => setTimeout(q2, 50));
      open.search = [...ms.querySelectorAll('.rw')].map((b) => b.dataset.v);
      ms.querySelector('.ft button').click(); await new Promise((q2) => setTimeout(q2, 50));
      open.cleared = last && last.mini ? last.mini.players : 'x';
      open.headAfter = ms.querySelector('.mh').innerText;
    }
    q('[data-a="nbmtv"][data-v="slider"]')[0].click(); await new Promise((q2) => setTimeout(q2, 50));
    const tvv = last && last.mini && last.mini.tv_vol;
    q('[data-a="nbmini"][data-k="on"]')[0].click(); await new Promise((q2) => setTimeout(q2, 50));
    return { has, c1, ent, c2, c3: last && last.mini, after: q('[data-a="nbmcond"]').length, closed, open, pl, tvv };
  });
  ok('editor: Mini-spiller-seksjon', r.has);
  ok('editor: Vis når → Betingelse lagres + entitetsvelger', r.c1 && r.c1.cond === 'entity' && r.ent, r.c1);
  ok('editor: Skjul i Media-popupen av', r.c2 && r.c2.hide_in_media === false, r.c2);
  ok('19.6 Spillere er én lukket rad (48 px, ingen chip-vegg)', r.closed && r.closed.rows === 1 && Math.round(r.closed.h) === 48 && !r.closed.list && !r.closed.chips && /Alle spillere/.test(r.closed.txt), r.closed);
  ok('19.6 åpen: søk, Vanlige · Valgt · Alle, grupper med antall, liste 300 px som ruller inni', r.open && r.open.sq && r.open.seg.length === 3 && /^Vanlige/.test(r.open.seg[0]) && /^Valgt · \d/.test(r.open.seg[1]) && /^Alle · \d/.test(r.open.seg[2]) && r.open.gh.some((g) => /^TV · \d/.test(g)) && r.open.mh === '300px' && r.open.ov === 'auto' && r.open.osb === 'contain', r.open);
  ok('19.6 avkrysning lagrer mini.players', Array.isArray(r.pl) && r.pl.length === 1 && r.pl[0] === 'media_player.kjokken_radio', r.pl);
  ok('19.6 søk filtrerer, «Alle» tømmer valget', r.open && r.open.search.length >= 1 && r.open.search.every((x) => /prosj/.test(x)) && r.open.cleared === undefined && /Alle spillere/.test(r.open.headAfter), r.open);
  ok('19.15 editor: Volum for TV → Slider lagres', r.tvv === 'slider', r.tvv);
  ok('editor: Vis over navbaren av → resten skjules', r.c3 && r.c3.on === false && r.after === 0, r);
  ok('ingen sidefeil (editor)', !errs.length, errs);
  await p.close();
}
await b.close();
console.log(res.join('\n'));
process.exit(res.some((x) => x.startsWith('✘')) ? 1 : 0);
