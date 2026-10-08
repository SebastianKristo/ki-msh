// Fiks 58 · Hurtigpanel (mobil, msh-hjem-card) + Stue-dashbord v2 (nettbrett, msh-stue-card) – akseptansekriteriene:
//  H1 · bevisst nedtrekk (ekte touch via CDP) åpner panelet når siden har stått i ro øverst
//  H2 · scroll opp til toppen og fortsett samme bevegelse (innenfor «ro i toppen») åpner IKKE
//  H3 · sideveis sveip i en vannrett karusell ([data-hs]) åpner ikke
//  H4 · popup åpen (hash) → kan ikke åpnes; åpent panel lukkes når en popup åpnes
//  H5 · dra ned i panelet → nivå 2 (exp 1), dra opp → nivå 1, dra videre opp → lukket; Esc og scrim lukker
//  H6 · sveip-innstillingene (localStorage hurtigpanel-cfg) overlever omlasting og styrer gesten (dødsone)
//  H7 · musehjul: opp i toppen over terskelen åpner; etterskli (hjul rett etter å ha nådd toppen) åpner ikke
//  H8 · varsel sveipes bort (> 110 px) og huskes
//  S1 · Stue: faner velges, rekkefølgen lagres i config (tab_order) og overlever ny instans; panelet bare i Hjem-fanen
//  S2 · Stue: nattmodus-kortet følger input_boolean, «Slå av» kaller input_boolean.turn_off
//  S3 · alle trykkflater ≥ 44 px (panel + Stue), ingen konsollfeil
// Kjør: node test/hurtig58-check.mjs
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { readdirSync, mkdirSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const R = resolve('.') + '/';
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/h58-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle], { cwd: R, stdio: 'inherit' });
const mocks = readdirSync(R + 'test/mock').filter((f) => f.endsWith('.js')).sort().map((f) => R + 'test/mock/' + f);
const browser = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => pw.chromium.launch());
let fails = 0;
const ok = (c, msg) => { console.log((c ? '✔ ' : '✘ ') + msg); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function setup(ctx, vp, tag, tall) {
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/net::ERR|fonts\.googleapis/.test(m.text())) errs.push(m.text()); });
  await page.goto('file://' + R + 'test/harness.html');
  for (const m of mocks) await page.addScriptTag({ path: m });
  await page.addScriptTag({ path: bundle });
  await page.evaluate(async ([tag, tall]) => {
    const hass = window.mockHass(); window.__H = hass; window.__calls = [];
    const cs = hass.callService;
    hass.callService = function (d, s, data) { window.__calls.push([d, s, data]); return cs ? cs.apply(this, arguments) : Promise.resolve(); };
    const el = document.createElement(tag);
    el.setConfig({ type: 'custom:' + tag, card_id: tag === 'msh-stue-card' ? 'st' : 'hj' });
    el.hass = hass;
    document.getElementById('dash').appendChild(el);
    if (tall) { const sp = document.createElement('div'); sp.style.height = '2400px'; document.getElementById('dash').appendChild(sp); }
    // vannrett karusell for H3
    const hs = document.createElement('div'); hs.setAttribute('data-hs', ''); hs.id = 'hs';
    Object.assign(hs.style, { position: 'absolute', left: '0', top: '120px', width: '100%', height: '120px', overflowX: 'auto', zIndex: 5 });
    hs.innerHTML = '<div style="width:3000px;height:100px"></div>';
    document.body.appendChild(hs);
    window.__el = el;
    await new Promise((r) => setTimeout(r, 700));
  }, [tag, tall]);
  return { page, errs };
}
// Ekte touch via CDP
async function swipe(page, x0, y0, x1, y1, steps = 12, holdMs = 0) {
  const cdp = await page.context().newCDPSession(page);
  const tp = (x, y) => [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp(x0, y0) });
  if (holdMs) await sleep(holdMs);
  for (let i = 1; i <= steps; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp(x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps) }); await sleep(12); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
  await sleep(420);
}
const st = (page, ctl = '__el.__hurtig') => page.evaluate((c) => { const h = c.split('.').reduce((a, k) => a[k], window); return { open: h.isOpen, exp: h.exp }; }, ctl);
const close = (page, ctl = '__el.__hurtig') => page.evaluate((c) => { c.split('.').reduce((a, k) => a[k], window).close(false); }, ctl);

/* ------------------------------------------------------------ mobil */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('h58')) { sessionStorage.setItem('h58', '1'); localStorage.removeItem('hurtigpanel-cfg'); localStorage.removeItem('hurtigpanel-dismissed'); } } catch (e) { /* */ } });
  const { page, errs } = await setup(ctx, null, 'msh-hjem-card', true);
  ok(await page.evaluate(() => !!window.__el.__hurtig), 'msh-hjem-card har hurtigpanel');
  await sleep(500);
  // H1
  await swipe(page, 195, 60, 195, 400);
  ok((await st(page)).open, 'H1 · bevisst nedtrekk fra toppen åpner panelet');
  // H5: dra ned i panelet → nivå 2, opp → nivå 1, videre opp → lukket
  await swipe(page, 195, 60, 195, 330);
  let s = await st(page);
  ok(s.open && s.exp === 1, `H5 · dra ned i panelet → nivå 2 (exp ${s.exp})`);
  await swipe(page, 195, 330, 195, 60);
  s = await st(page);
  ok(s.open && s.exp === 0, `H5 · dra opp → nivå 1 (exp ${s.exp})`);
  await swipe(page, 195, 170, 195, 20); // fra toppfeltet/runde rad (varsellisten ruller selv)
  ok(!(await st(page)).open, 'H5 · dra videre opp (> 90 px) lukker');
  await page.evaluate(() => window.__el.__hurtig.open(1)); await sleep(300);
  await page.keyboard.press('Escape'); await sleep(200);
  ok(!(await st(page)).open, 'H5 · Esc lukker');
  await page.evaluate(() => window.__el.__hurtig.open(1)); await sleep(400);
  await page.evaluate(() => window.__el.__hurtig.scrim.click()); await sleep(200);
  ok(!(await st(page)).open, 'H5 · trykk på scrim lukker');
  // H2: scroll ned, så opp til toppen og fortsett samme bevegelse
  await page.evaluate(() => window.scrollTo(0, 600)); await sleep(300);
  await page.evaluate(() => { window.scrollTo(0, 0); window.dispatchEvent(new Event('scroll')); });
  await swipe(page, 195, 60, 195, 420, 8);
  ok(!(await st(page)).open, 'H2 · scroll til toppen + samme bevegelse åpner ikke (ro i toppen)');
  await sleep(500);
  await swipe(page, 195, 60, 195, 420);
  ok((await st(page)).open, 'H2 · ny bevisst bevegelse etter ro åpner');
  await close(page); await sleep(500);
  // H3: sideveis i karusell (og nedover start i karusellen)
  await swipe(page, 300, 170, 60, 200);
  await swipe(page, 195, 150, 195, 500);
  ok(!(await st(page)).open, 'H3 · sveip som starter i vannrett karusell åpner ikke');
  // H4: popup åpen
  await page.evaluate(() => { location.hash = '#lys'; }); await sleep(300);
  await swipe(page, 195, 60, 195, 420);
  ok(!(await st(page)).open, 'H4 · kan ikke åpnes mens en popup er åpen');
  await page.evaluate(() => { history.replaceState(null, '', location.pathname); window.dispatchEvent(new HashChangeEvent('hashchange')); }); await sleep(500);
  await page.evaluate(() => window.__el.__hurtig.open(1)); await sleep(300);
  await page.evaluate(() => { location.hash = '#lys'; }); await sleep(700);
  ok(!(await st(page)).open, 'H4 · åpent panel lukkes når en popup åpnes');
  await page.evaluate(() => { history.replaceState(null, '', location.pathname); window.dispatchEvent(new HashChangeEvent('hashchange')); }); await sleep(500);
  // H8: varsel sveipes bort
  await page.evaluate(() => window.__el.__hurtig.open(1)); await sleep(500);
  const nc = await page.evaluate(() => { const r = window.__el.__hurtig.root, c = r.querySelector('.nc'); if (!c) return null; const b = c.getBoundingClientRect(); return { id: c.dataset.nc, x: b.left + b.width / 2, y: b.top + b.height / 2, n: r.querySelectorAll('.nc').length }; });
  if (nc) {
    await swipe(page, nc.x - 60, nc.y, nc.x + 140, nc.y + 4);
    await sleep(300);
    const after = await page.evaluate((id) => ({ n: window.__el.__hurtig.root.querySelectorAll('.nc').length, gone: !window.__el.__hurtig.root.querySelector(`[data-nc="${id}"]`), saved: !!(JSON.parse(localStorage.getItem('hurtigpanel-dismissed') || '{}'))[id] }), nc.id);
    ok(after.gone && after.saved && after.n === nc.n - 1, `H8 · varsel sveipet bort og husket (${nc.n} → ${after.n})`);
  } else ok(false, 'H8 · fant ingen varsler i mock');
  // S3 (panel): trykkflater
  const small = await page.evaluate(() => [...window.__el.__hurtig.root.querySelectorAll('button')].filter((b) => b.offsetParent && b.closest('.ex') === null).map((b) => { const r = b.getBoundingClientRect(); return [b.className, Math.round(r.width), Math.round(r.height)]; }).filter(([, w, h]) => w < 44 || h < 36));
  ok(!small.length, 'S3 · panelets knapper ≥ 44 px' + (small.length ? ' ' + JSON.stringify(small) : ''));
  await close(page);
  // H6: innstillinger per enhet overlever omlasting og styrer gesten
  await page.evaluate(() => localStorage.setItem('hurtigpanel-cfg', JSON.stringify({ dead: 140, open: 300 })));
  ok(true, 'H6 · satt dead 140 / open 300');
  await page.reload();
  for (const m of mocks) await page.addScriptTag({ path: m });
  await page.addScriptTag({ path: bundle });
  await page.evaluate(async () => { const hass = window.mockHass(); const el = document.createElement('msh-hjem-card'); el.setConfig({ type: 'custom:msh-hjem-card', card_id: 'hj' }); el.hass = hass; document.getElementById('dash').appendChild(el); window.__el = el; await new Promise((r) => setTimeout(r, 900)); });
  const sw = await page.evaluate(() => window.MSH.hurtigSwipe('mobil'));
  ok(sw.dead === 140 && sw.open === 300 && sw.zone === 'ovre', `H6 · innstillingene lest etter omlasting (${JSON.stringify(sw)})`);
  await swipe(page, 195, 60, 195, 330); // 270 − 140 = 130 < 300 → ikke åpen
  ok(!(await st(page)).open, 'H6 · dødsone/avstand fra innstillingene gjelder (kort trekk åpner ikke)');
  // H7: musehjul
  await page.evaluate(() => localStorage.removeItem('hurtigpanel-cfg'));
  await page.mouse.move(195, 200);
  await sleep(500);
  for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, -60); await sleep(30); }
  await sleep(200);
  ok((await st(page)).open, 'H7 · musehjul opp i toppen åpner');
  await close(page);
  await page.evaluate(() => window.scrollTo(0, 400)); await sleep(150);
  await page.evaluate(() => window.scrollTo(0, 0)); await sleep(30);
  for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, -80); await sleep(40); }
  await sleep(200);
  ok(!(await st(page)).open, 'H7 · etterskli rett etter å ha nådd toppen åpner ikke');
  ok(!errs.length, 'mobil: ingen konsollfeil' + (errs.length ? ' ' + JSON.stringify(errs.slice(0, 3)) : ''));
  await ctx.close();
}

/* ------------------------------------------------------------ Stue (nettbrett) */
{
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 1024 }, hasTouch: true });
  await ctx.addInitScript(() => { try { localStorage.removeItem('hurtigpanel-cfg:nettbrett'); } catch (e) { /* */ } });
  const { page, errs } = await setup(ctx, null, 'msh-stue-card', false);
  const S = '__el._hp';
  const tabs = await page.evaluate(() => [...window.__el.shadowRoot.querySelectorAll('.mtb-t')].map((b) => b.dataset.v || b.textContent.trim()));
  ok(tabs.length === 4, 'S1 · fire faner: ' + tabs.join(', '));
  await sleep(500);
  await swipe(page, 683, 60, 683, 500);
  ok((await st(page, S)).open, 'S1 · nedtrekk i Hjem-fanen åpner nettbrettpanelet');
  const lay = await page.evaluate(() => { const r = window.__el._hp.root; return { cols: getComputedStyle(r.querySelector('.cols')).gridTemplateColumns.split(' ').length, w: Math.round(r.querySelector('.pn').getBoundingClientRect().width) }; });
  ok(lay.cols === 2 && lay.w <= 1280, `S1 · delt oppsett: 2 kolonner, bredde ${lay.w} ≤ 1280`);
  await swipe(page, 683, 500, 683, 300);
  ok(!(await st(page, S)).open, 'S1 · dra opp (> 110 px) lukker');
  await page.evaluate(() => window.__el.setUI({ tab: 'lys' })); await sleep(700);
  await swipe(page, 683, 60, 683, 500);
  ok(!(await st(page, S)).open, 'S1 · panelet åpnes ikke i Lys-fanen');
  const one = await page.evaluate(() => window.__el.shadowRoot.querySelectorAll('.cols .col').length);
  ok(one === 1, 'S1 · Lys-fanen viser bare Lys-kolonnen');
  // rekkefølge lagres i config (MSH.mshPatchConfig → saveCardConfig stubbes)
  await page.evaluate(async () => { window.MSH.saveCardConfig = async (h, o, n) => ({ config: n }); await window.MSH.mshPatchConfig(window.__el, { tab_order: ['lys', 'hjem', 'media', 'enheter'] }); });
  await sleep(300);
  const ord = await page.evaluate(() => { const el = document.createElement('msh-stue-card'); el.setConfig({ ...window.__el.config }); el.hass = window.__H; document.body.appendChild(el); return new Promise((r) => setTimeout(() => r([...el.shadowRoot.querySelectorAll('.mtb-t')].map((b) => b.dataset.v)), 400)); });
  ok(ord[0] === 'lys', 'S1 · tab_order i config gir ny rekkefølge i ny instans: ' + ord.join(','));
  const sv = await page.evaluate(() => { const M = window.MSH, v = { cards: [{ type: 'vertical-stack', cards: [{ type: 'custom:msh-hjem-card' }, { type: 'custom:msh-navbar-card' }, { type: 'custom:bubble-card', hash: '#lys' }] }] }; const a = M.stueView({}, v), b = M.stueView({ stue: true }, v); return { off: a, path: b && b.path, panel: b && b.panel, kids: b && b.cards[0].cards.map((c) => c.type) }; });
  ok(!sv.off && sv.path === 'stue' && sv.panel && sv.kids.join() === 'custom:msh-stue-card,custom:bubble-card', 'S1 · strategien: stue: true gir visningen /stue med Stue-kortet + popupene ' + JSON.stringify(sv.kids));
  // S2: nattmodus
  await page.evaluate(() => window.__el.setUI({ tab: 'hjem' })); await sleep(300);
  const nm0 = await page.evaluate(() => !!window.__el.shadowRoot.querySelector('.nm'));
  const nid = await page.evaluate(() => window.MSH.stueAuto(window.__H, {}).night);
  await page.evaluate((id) => { const h = { ...window.__H, states: { ...window.__H.states } }; h.states[id || 'input_boolean.nattmodus'] = { entity_id: id || 'input_boolean.nattmodus', state: 'on', attributes: { friendly_name: 'Nattmodus' }, last_changed: new Date().toISOString() }; window.__H2 = h; window.__el.hass = h; }, nid);
  await sleep(400);
  const nm1 = await page.evaluate(() => !!window.__el.shadowRoot.querySelector('.nm'));
  ok(!nm0 && nm1, `S2 · nattmodus-kortet følger bryteren (av: ${nm0}, på: ${nm1})`);
  await page.evaluate(() => { window.__calls = []; window.__H2.callService = function (d, s, data) { window.__calls.push([d, s, data]); return Promise.resolve(); }; window.__el.hass = { ...window.__H2 }; });
  await sleep(200);
  await page.evaluate(() => window.__el.shadowRoot.querySelector('[data-act="nightoff"]').click());
  await sleep(200);
  const calls = await page.evaluate(() => window.__calls);
  ok(calls.some(([d, s]) => d === 'input_boolean' && s === 'turn_off'), 'S2 · «Slå av» kaller input_boolean.turn_off');
  const small = await page.evaluate(() => [...window.__el.shadowRoot.querySelectorAll('button,[role=button]')].filter((b) => b.offsetParent).map((b) => { const r = b.getBoundingClientRect(); return [b.className || b.dataset.act, Math.round(r.width), Math.round(r.height)]; }).filter(([, w, h]) => w < 44 || h < 36));
  ok(!small.length, 'S3 · Stue: trykkflater ≥ 44 px' + (small.length ? ' ' + JSON.stringify(small.slice(0, 6)) : ''));
  const ovf = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  ok(!ovf, 'S3 · Stue: ingen vannrett scroll på 1366 px');
  ok(!errs.length, 'Stue: ingen konsollfeil' + (errs.length ? ' ' + JSON.stringify(errs.slice(0, 3)) : ''));
  await ctx.close();
}
await browser.close();
try { unlinkSync(bundle); } catch (e) { /* */ }
console.log(fails ? `\n${fails} feil` : '\nAlle bestod');
process.exit(fails ? 1 : 0);
