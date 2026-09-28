// Fiks 18.5 / 18.6: haptisk feedback av per enhet + navbarens avstand fra bunnen per enhet.
// Fiks 19.13: begge ligger nå i ki-store nav_profiles['<bruker>/<enhetsklasse>'] (Pixel 9 Pro = 'annen'), med migrering
// av eldre localStorage ki-haptic-off / ki-nav-bottom og ki-store haptic_off_devices / nav_bottom_devices.
//  · MSH.haptic sender verken haptic-event eller vibrate når ki-haptic-off = '1'; HA/Bubble-haptic stoppes (capture)
//  · «Tilpass Hjem» → Faner: bryteren «Haptisk feedback» + «Denne enheten: …», lagres i localStorage + ki-store
//  · navbar: standard per enhet (iPhone 0, OnePlus 20, Pixel 16, iPad 12), slider i «Tilpass navbar» live + Standard
// Kjør: node test/fiks18-enhet-check.mjs
import { createRequire } from 'node:module';
import { readdirSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/fiks18e-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = [];
const ok = (name, cond, info) => res.push(`${cond ? '✔' : '✘'} ${name}${info != null ? ' · ' + JSON.stringify(info) : ''}`);
const UA = {
  pixel: 'Mozilla/5.0 (Linux; Android 15; Pixel 9 Pro Build/AP4A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0 Mobile Safari/537.36 Home Assistant/2025.1',
  oneplus: 'Mozilla/5.0 (Linux; Android 15; CPH2653) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
  ipad: 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
};

async function setup(ua, vp, bm) {
  const ctx = await b.newContext({ viewport: vp || { width: 390, height: 844 }, hasTouch: true, userAgent: ua });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + resolve('test/harness.html'));
  if (bm) await p.evaluate((id) => localStorage.setItem('browser_mod-browser-id', id), bm);
  for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
  await p.addScriptTag({ path: bundle });
  await p.evaluate(async () => {
    window.deepAll = (sel) => { const out = []; const walk = (root) => root.querySelectorAll('*').forEach((e) => { if (e.matches(sel)) out.push(e); if (e.shadowRoot) walk(e.shadowRoot); }); walk(document); return out; };
    window.deep = (sel) => window.deepAll(sel)[0] || null;
    window.H = window.mockHass();
    const c = document.createElement('msh-navbar-card'); c.setConfig({ type: 'custom:msh-navbar-card', card_id: 'ki-navbar' }); c.hass = H;
    document.getElementById('dash').appendChild(c);
    await new Promise((q) => setTimeout(q, 700));
  });
  return { p, ctx, errs };
}
const navB = (p) => p.evaluate(() => { const n = deep('nav.nb'), m = deep('[data-mini]'); const r = n.getBoundingClientRect(); return { bottom: Math.round(innerHeight - r.bottom), rail: n.classList.contains('rail'), mini: m && !m.classList.contains('off') ? Math.round(r.top - m.getBoundingClientRect().bottom) : null }; });

/* ---------------- 18.6 standard per enhet */
for (const [k, want] of [['iphone', 0], ['oneplus', 20], ['pixel', 16]]) {
  const { p, ctx, errs } = await setup(UA[k]);
  const r = await navB(p);
  ok(`18.6 ${k}: navbaren står ${want} px fra bunnen uten innstilling`, r.bottom === want && !r.rail, r);
  if (r.mini != null) ok(`18.6 ${k}: mini-spilleren følger (10 px over navbaren)`, Math.abs(r.mini - 10) <= 1, r);
  ok(`18.6 ${k}: ingen JS-feil`, !errs.length, errs);
  await ctx.close();
}
{
  const { p, ctx } = await setup(UA.ipad, { width: 820, height: 1180 });
  ok('18.6 iPad: standard 12 px', await p.evaluate(() => MSH.navBottomDefault()) === 12);
  await ctx.close();
}

/* ---------------- 18.6 slider i «Tilpass navbar» */
{
  const { p, ctx, errs } = await setup(UA.pixel, null, 'pixel9pro');
  const r = await p.evaluate(async () => {
    const ed = document.createElement('msh-navbar-editor');
    ed.cardClass = customElements.get('msh-navbar-card');
    ed.hass = H; ed.setConfig({ type: 'custom:msh-navbar-card', card_id: 'ki-navbar' });
    document.body.appendChild(ed); await new Promise((q) => setTimeout(q, 200));
    const q = (s) => ed.shadowRoot.querySelector(s);
    const gts = [...ed.shadowRoot.querySelectorAll('.gt')].map((e) => e.textContent);
    const order = gts.indexOf('Avstand fra bunnen') === gts.indexOf('Bredde') + 1;
    const hint = q('.nbbot .hint').textContent, std0 = !!q('[data-a="nbbotstd"]');
    const sl = q('[data-nbbot]');
    let bubbled = false; document.addEventListener('pointerdown', () => { bubbled = true; }, { once: true });
    sl.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
    sl.value = '30'; sl.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((x) => setTimeout(x, 100));
    const live = Math.round(innerHeight - deep('nav.nb').getBoundingClientRect().bottom), lbl = q('.nbbv').textContent;
    const NP = () => (MSH.store.get('nav_profiles') || {})['u1/annen'] || null;
    const lsLive = localStorage.getItem('ki-nav-bottom'), stLive = NP();
    sl.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((x) => setTimeout(x, 100));
    const saved = { ls: localStorage.getItem('ki-nav-bottom'), st: NP() && NP().bottom, cls: MSH.deviceClass() };
    const std1 = !!q('[data-a="nbbotstd"]');
    q('[data-a="nbbotstd"]').click();
    await new Promise((x) => setTimeout(x, 150));
    const after = { ls: localStorage.getItem('ki-nav-bottom'), st: NP(), b: Math.round(innerHeight - deep('nav.nb').getBoundingClientRect().bottom), std: !!q('[data-a="nbbotstd"]') };
    return { order, hint, std0, bubbled, live, lbl, lsLive, stLive, saved, std1, after };
  });
  ok('18.6 editor: «Avstand fra bunnen» rett under Bredde', r.order);
  ok('18.6 editor: hint «Gjelder bare Pixel 9 Pro · standard 16 px», ingen Standard-knapp', r.hint === 'Gjelder bare Pixel 9 Pro · standard 16 px' && !r.std0, r.hint);
  ok('18.6 editor: pointerdown stoppes (fallgruve 2)', !r.bubbled);
  ok('18.6 editor: slideren flytter navbaren live (30 px), ikke lagret i ki-store før slipp', r.live === 30 && r.lbl === '30 px' && r.stLive == null, r);
  ok('19.13 editor: slipp lagrer i ki-store nav_profiles[u1/annen].bottom (ikke localStorage)', r.saved.ls == null && r.saved.st === 30 && r.saved.cls === 'annen' && r.std1, r.saved);
  ok('18.6 editor: «Standard» sletter og bruker 16 px igjen', r.after.ls == null && r.after.st == null && r.after.b === 16 && !r.after.std, r.after);
  ok('18.6 editor: ingen JS-feil', !errs.length, errs);
  // reload: verdi i localStorage overlever
  await p.evaluate(() => MSH.setNavBottom(24, true));
  await p.reload();
  for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
  await p.addScriptTag({ path: bundle });
  ok('18.6 reload: egen verdi overlever', await p.evaluate(() => MSH.navBottom()) === 24);
  await ctx.close();
}
/* ---------------- 18.6 rail: uten effekt */
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, userAgent: UA.pixel });
  const p = await ctx.newPage();
  await p.goto('file://' + resolve('test/harness.html'));
  await p.evaluate(() => localStorage.setItem('ki-nav-bottom', '40'));
  for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
  await p.addScriptTag({ path: bundle });
  const r = await p.evaluate(async () => {
    const c = document.createElement('msh-navbar-card'); c.setConfig({ type: 'custom:msh-navbar-card', card_id: 'ki-navbar', layout: 'stor' }); c.hass = window.mockHass();
    document.getElementById('dash').appendChild(c);
    await new Promise((q) => setTimeout(q, 700));
    const ed = document.createElement('msh-navbar-editor'); ed.cardClass = customElements.get('msh-navbar-card'); ed.hass = window.mockHass(); ed.setConfig({ type: 'custom:msh-navbar-card' });
    document.body.appendChild(ed); await new Promise((q) => setTimeout(q, 200));
    return { v: document.documentElement.style.getPropertyValue('--ki-nav-bottom'), hint: ed.shadowRoot.querySelector('.nbbot .hint').textContent };
  });
  ok('18.6 rail: --ki-nav-bottom 0 og hint «brukes når navbaren ligger i bunnen»', r.v === '0px' && /brukes når navbaren ligger i bunnen/.test(r.hint), r);
  await ctx.close();
}

/* ---------------- 18.5 haptic */
{
  const { p, ctx, errs } = await setup(UA.pixel, null, 'pixel9pro');
  const r = await p.evaluate(async () => {
    const log = { ev: 0, vib: 0, ha: 0 };
    navigator.vibrate = () => { log.vib++; return true; };
    window.addEventListener('haptic', () => { log.ha++; }); // som HA-frontenden / companion-appen (ikke-capture)
    const fire = () => window.dispatchEvent(new CustomEvent('haptic', { detail: 'light' })); // Bubble Card sin haptic
    const wait = (ms) => new Promise((x) => setTimeout(x, ms));
    MSH.haptic('light'); await wait(60); fire();
    const on = { ...log };
    MSH.openHomeEditor({ focus: 'faner' });
    await wait(800);
    const btn = deep('[data-a="hapticdev"]');
    if (!btn) return { found: false };
    const txt = btn.textContent;
    btn.click(); await wait(200);
    const NP = () => (MSH.store.get('nav_profiles') || {})['u1/annen'] || null;
    const st = { np: NP(), old: MSH.store.get('haptic_off_devices'), flag: window.__kiHapticOff, aria: deep('[data-a="hapticdev"]').getAttribute('aria-checked') };
    log.ev = log.vib = log.ha = 0;
    MSH.haptic('light'); await wait(60); MSH.haptic('success'); await wait(60); fire();
    const off = { ...log };
    // tilbake på
    deep('[data-a="hapticdev"]').click(); await wait(200);
    const back = { np: NP(), flag: window.__kiHapticOff };
    log.vib = log.ha = 0; MSH.haptic('light'); await wait(60);
    // arv: «Alle brukere · Alle enheter» (*/*) av → av her; av/på her overstyrer (false lagres på u1/annen)
    MSH.profileSet('nav_profiles', { haptic_off: true }, '*/*');
    const inh = MSH.hapticOff();
    MSH.setHapticOff(false);
    const over = { off: MSH.hapticOff(), np: NP() };
    MSH.profileSet('nav_profiles', null, '*/*'); MSH.profileSet('nav_profiles', null, 'u1/annen');
    return { found: true, txt, on, st, off, back, again: { ...log }, inh, over };
  });
  ok('18.5 standard på: haptic-event + vibrate', r.on && r.on.vib === 1 && r.on.ha === 2, r.on);
  ok('18.5 Tilpass Hjem → Faner: bryteren «Haptisk feedback» med «Denne enheten: Pixel 9 Pro · Android»', r.found && /Haptisk feedback/.test(r.txt) && /Gjelder bare denne enheten/.test(r.txt) && /Denne enheten: Pixel 9 Pro · Android/.test(r.txt), r.txt);
  ok('19.13 av: lagret i ki-store nav_profiles[u1/annen].haptic_off', r.st && r.st.np && r.st.np.haptic_off === true && r.st.old == null && r.st.flag === true && r.st.aria === 'false', r.st);
  ok('18.5 av: ingen vibrate og ingen haptic-event (heller ikke Bubble/HA)', r.off && r.off.vib === 0 && r.off.ha === 0, r.off);
  ok('19.13 på igjen: nivået tømt, vibrerer igjen', r.back && r.back.np == null && r.back.flag === false && r.again.vib === 1, { back: r.back, again: r.again });
  ok('19.13 arv: */* av → av her; på her lagres som haptic_off: false', r.inh === true && r.over.off === false && r.over.np && r.over.np.haptic_off === false, { inh: r.inh, over: r.over });
  ok('18.5 ingen JS-feil', !errs.length, errs);
  await ctx.close();
}
{
  const { p, ctx } = await setup(UA.iphone);
  ok('18.5 iPhone: enhetsnavn «iPhone · iOS», haptic på', await p.evaluate(() => MSH.deviceInfo().label === 'iPhone · iOS' && !MSH.hapticOff()));
  await ctx.close();
}

/* ---------------- 19.13 migrering fra 18.5/18.6 */
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, userAgent: UA.pixel });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + resolve('test/harness.html'));
  await p.evaluate(() => {
    localStorage.setItem('browser_mod-browser-id', 'pixel9pro');
    localStorage.setItem('ki-nav-bottom', '22'); localStorage.setItem('ki-haptic-off', '1');
    localStorage.setItem('ki:store', JSON.stringify({ haptic_off_devices: ['pixel9pro', 'ipad1'], nav_bottom_devices: { pixel9pro: 22, ipad1: 12 } }));
  });
  for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
  await p.addScriptTag({ path: bundle });
  const r = await p.evaluate(async () => {
    const c = document.createElement('msh-navbar-card'); c.setConfig({ type: 'custom:msh-navbar-card', card_id: 'ki-navbar' }); c.hass = window.mockHass();
    document.getElementById('dash').appendChild(c);
    await new Promise((q) => setTimeout(q, 800));
    return { np: MSH.store.get('nav_profiles'), L: MSH.store.get('haptic_off_devices'), B: MSH.store.get('nav_bottom_devices'), ls: [localStorage.getItem('ki-nav-bottom'), localStorage.getItem('ki-haptic-off')], off: MSH.hapticOff(), bot: MSH.navBottom(), user: MSH.userId() };
  });
  ok('19.13 migrering: 18.5/18.6-verdiene flyttet til nav_profiles[u1/annen]', r.np && r.np['u1/annen'] && r.np['u1/annen'].bottom === 22 && r.np['u1/annen'].haptic_off === true && r.off === true && r.bot === 22, r);
  ok('19.13 migrering: gamle nøkler slettet (andre enheters verdier beholdt)', JSON.stringify(r.L) === '["ipad1"]' && JSON.stringify(r.B) === '{"ipad1":12}' && r.ls[0] == null && r.ls[1] == null, r);
  ok('19.13 migrering: ingen JS-feil', !errs.length, errs);
  // enhetsklasser
  const cls = await p.evaluate(() => MSH.deviceClass());
  ok('19.13 Pixel 9 Pro → enhetsklasse «annen»', cls === 'annen', cls);
  await ctx.close();
}
for (const [ua, vp, want] of [[UA.iphone, { width: 393, height: 852 }, 'iphone'], [UA.ipad, { width: 820, height: 1180 }, 'ipad'], [UA.oneplus, { width: 412, height: 915 }, 'oneplus'],
  [UA.pixel.replace('Pixel 9 Pro', 'Pixel 9 Pro Fold'), { width: 412, height: 915 }, 'fold_closed'], [UA.pixel.replace('Pixel 9 Pro', 'Pixel 9 Pro Fold'), { width: 884, height: 1032 }, 'fold_open']]) {
  const { p, ctx } = await setup(ua, vp);
  ok(`19.13 enhetsklasse ${want}`, await p.evaluate(() => MSH.deviceClass()) === want);
  if (want === 'fold_open') {
    await p.evaluate(() => { window.__cls = 0; window.addEventListener('ki-device-class', () => { window.__cls++; }); });
    await p.setViewportSize({ width: 412, height: 915 }); await p.waitForTimeout(400);
    const r = await p.evaluate(() => ({ c: MSH.deviceClass(), ev: window.__cls }));
    ok('19.13 bretting 884 → 412: fold_closed + ki-device-class uten reload', r.c === 'fold_closed' && r.ev >= 1, r);
  }
  await ctx.close();
}

await b.close();
console.log(res.join('\n'));
const bad = res.filter((x) => x.startsWith('✘')).length;
console.log(bad ? `\n${bad} feil` : '\nAlt OK');
process.exit(bad ? 1 : 0);
