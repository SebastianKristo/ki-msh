// Fiks 17.26 / 17.27: mini-spilleren over navbaren + farge på verktøyene i «Mer»-menyen.
//  · mobil: mini-spilleren flyter 10 px over navbaren, samme bredde og midtpunkt, rund pille 64 px, ingen cast
//  · skjules i #media, hold på pause → media_pause + skjult til neste avspilling (sessionStorage), tilbake ved playing
//  · volum: trykk → pille, dra → volume_set; hold → volume_mute
//  · flere spillere → prikker + sveip; av i config → ingen mini
//  · bred (rail) med HA-sidebar: mini-spilleren ligger innenfor dashbordflaten (aldri over sidebaren), over høyre fliskolonne (18.4/18.8)
//  · «Mer»-menyen: verktøyene under streken har samme farge som punktene over (standard og glass)
//  · «Tilpass navbar» → Mini-spiller: av/på, Vis når, Skjul i Media-popupen
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
  // hold pause → skjult til neste avspilling
  await hold(p, '.mpp', 800);
  m = await mini(p);
  const ss = await p.evaluate(() => sessionStorage.getItem('ki:mini:hidden'));
  ok('hold pause → media_pause + skjult + sessionStorage', (await calls(p)).includes('media_pause') && m && m.off && !!ss);
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
  if (SHOT) await p.screenshot({ path: SHOT + '/mini-meny.png' });
  await p.close();
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
    q('[data-a="nbmini"][data-k="on"]')[0].click(); await new Promise((q2) => setTimeout(q2, 50));
    return { has, c1, ent, c2, c3: last && last.mini, after: q('[data-a="nbmcond"]').length };
  });
  ok('editor: Mini-spiller-seksjon', r.has);
  ok('editor: Vis når → Betingelse lagres + entitetsvelger', r.c1 && r.c1.cond === 'entity' && r.ent, r.c1);
  ok('editor: Skjul i Media-popupen av', r.c2 && r.c2.hide_in_media === false, r.c2);
  ok('editor: Vis over navbaren av → resten skjules', r.c3 && r.c3.on === false && r.after === 0, r);
  ok('ingen sidefeil (editor)', !errs.length, errs);
  await p.close();
}
await b.close();
console.log(res.join('\n'));
process.exit(res.some((x) => x.startsWith('✘')) ? 1 : 0);
