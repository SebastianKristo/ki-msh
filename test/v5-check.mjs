// Fiks 61 (prompt v5): servere · «Tilpass alt» v2 · strømpris (visning og valuta) · hurtigpanel (scroll, lys-søk, hint) ·
// Ringeopptak. Kjør: node test/v5-check.mjs
import { createRequire } from 'node:module';
import { readdirSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/v5-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = [];
const ok = (name, cond, info) => res.push(`${cond ? '✔' : '✘'} ${name}${info != null ? ' · ' + JSON.stringify(info) : ''}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function page(vp, pre) {
  const ctx = await b.newContext({ viewport: vp || { width: 412, height: 900 }, hasTouch: true });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/net::ERR|fonts\.googleapis|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await p.goto('file://' + resolve('test/harness.html'));
  for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
  if (pre) await p.evaluate(pre);
  await p.addScriptTag({ path: bundle });
  await p.evaluate(() => {
    window.deepAll = (sel) => { const out = []; const walk = (root) => root.querySelectorAll('*').forEach((e) => { if (e.matches(sel)) out.push(e); if (e.shadowRoot) walk(e.shadowRoot); }); walk(document); return out; };
    window.deep = (sel) => window.deepAll(sel)[0] || null;
    window.H = window.mockHass(); MSH.lastHass = window.H; if (MSH.store && !MSH.store.loaded) MSH.store.load(window.H);
    window.mk = async (tag, cfg) => { const el = document.createElement(tag); el.setConfig({ type: 'custom:' + tag, ...(cfg || {}) }); el.hass = window.H; document.getElementById('dash').appendChild(el); await new Promise((r) => setTimeout(r, 500)); return el; };
  });
  return { p, ctx, errs };
}

/* ---------------- 1 · servere */
for (const [label, servere, want] of [['én server', [{ navn: 'Oslo' }], false], ['to servere', [{ navn: 'Oslo' }, { navn: 'Hytta', ikon: 'mdi:home-group' }], true]]) {
  const { p, ctx, errs } = await page();
  const r = await p.evaluate(async (servere) => {
    const el = await window.mk('msh-hjem-header-card', { card_id: 'hh', mode: 'sted', servere, server_navn: 'Oslo' });
    const pil = !!el.shadowRoot.querySelector('.pil');
    const t = el.shadowRoot.querySelector('.ttl'); if (t) t.click();
    await new Promise((q) => setTimeout(q, 600));
    const menu = !!deep('[data-srv-meny], .srvm, .smeny, [role="menu"]');
    return { pil, menu };
  }, servere);
  ok(`1 ${label}: ${want ? 'pil vises' : 'ingen pil'}`, r.pil === want, r);
  if (!want) ok('1 én server: trykk på navnet åpner ingen meny', !r.menu, r);
  ok(`1 ${label}: ingen sidefeil`, !errs.length, errs);
  await ctx.close();
}

/* ---------------- 2 · «Tilpass alt» v2 */
{
  const { p, ctx, errs } = await page();
  await p.evaluate(async () => { await window.mk('msh-navbar-card', { card_id: 'ki-navbar' }); await new Promise((q) => setTimeout(q, 1500)); window.__api = MSH.openTilpassAlt(); await new Promise((q) => setTimeout(q, 300)); });
  const steps = [];
  for (let i = 0; i < 13; i++) { await p.evaluate((i) => deep(`[data-a="dot"][data-v="${i}"]`).click(), i); await sleep(120); steps.push(await p.evaluate(() => deep('.tw .hd b').textContent)); }
  ok('2 13 steg, prikkene er klikkbare', steps.length === 13 && steps[0] === 'Språk' && steps[12] === 'Ferdig' && new Set(steps).size === 13, steps);
  const fin = await p.evaluate(() => deepAll('.tw [data-a="go"]').length);
  ok('2 siste steg viser alle steg med «Endre»', fin === 12, fin);
  await p.evaluate(() => { deep('[data-a="jump"]').click(); });
  await sleep(150);
  const jl = await p.evaluate(() => deepAll('.jl button').length);
  ok('2 «n av 13» åpner en liste over alle steg', jl === 13, jl);
  // Servere: legg til «Hytta» via forslag → lagres i header-kortets config (ki-store)
  await p.evaluate(() => deep('.jl [data-a="go"][data-v="2"]').click()); await sleep(150);
  await p.evaluate(() => deep('[data-a="srvchip"][data-v="Hytta"]').click()); await sleep(300);
  const sv = await p.evaluate(() => (MSH.store.card('ki-home-header') || {}).servere);
  ok('2 Servere: forslag «Hytta» lagres i servere (første rad = denne serveren)', Array.isArray(sv) && sv.length >= 2 && sv.some((x) => x.navn === 'Hytta'), sv);
  // Navbar: flytt Musikk til «Skjult»
  await p.evaluate(() => deep('[data-a="dot"][data-v="6"]').click()); await sleep(150);
  await p.evaluate(() => deep('[data-a="nplace"][data-k="media"][data-v="off"]').click()); await sleep(300);
  const nv = await p.evaluate(() => MSH.store.card('ki-navbar') || {});
  ok('2 Navbar: «Skjult» skrives til navbarens config (hidden)', (nv.hidden || []).includes('media') && !(nv.bar || []).includes('media'), nv);
  // Header: stil «Sted» → header_profiles
  await p.evaluate(() => deep('[data-a="dot"][data-v="4"]').click()); await sleep(150);
  await p.evaluate(() => deep('[data-a="hmode"][data-v="sted"]').click()); await sleep(300);
  const hm = await p.evaluate(() => (MSH.hjemHeaderProfile ? MSH.hjemHeaderProfile() : {}).mode);
  ok('2 Header: stil lagres i header-profilen', hm === 'sted', hm);
  // Språk: engelsk virker straks og tilbake
  await p.evaluate(() => deep('[data-a="dot"][data-v="0"]').click()); await sleep(100);
  await p.evaluate(() => deep('[data-a="lang"][data-v="en"]').click()); await sleep(250);
  const en = await p.evaluate(() => deep('.tw .nx').textContent.trim());
  await p.evaluate(() => kiSetLang('no')); await sleep(200);
  ok('2 Språk: engelsk straks («Next»)', en === 'Next', en);
  const w = await p.evaluate(() => { const r = deep('.tw').getBoundingClientRect(); return Math.round(r.right); });
  ok('2 ingen vannrett overflyt (412 px)', w <= 412, w);
  ok('2 ingen sidefeil', !errs.length, errs);
  await ctx.close();
}

/* ---------------- 3 · strømpris */
{
  const { p, ctx, errs } = await page();
  const r = await p.evaluate(async () => {
    const el = await window.mk('msh-strompris-card', { card_id: 'sp' });
    const txt = () => el.shadowRoot.textContent.replace(/\s+/g, ' ');
    const out = { both: txt().includes('Norgespris') };
    await MSH.store.set('power_price', { chart: 'nordpool' }, { now: true }); await new Promise((q) => setTimeout(q, 300));
    out.np = !el.shadowRoot.querySelector('.lg .dash') && !el.shadowRoot.querySelector('.vc.r .np');
    await MSH.store.set('power_price', { chart: 'static', static_val: 1.25, cur: '€' }, { now: true }); await new Promise((q) => setTimeout(q, 300));
    out.st = txt(); out.unit = el.shadowRoot.querySelector('.lg .unit') ? el.shadowRoot.querySelector('.lg .unit').textContent : '';
    await MSH.store.set('power_price', { cur: 'custom', cur_txt: 'SEK', sub_txt: 'öre' }, { now: true }); await new Promise((q) => setTimeout(q, 300));
    out.cust = MSH.powerPrice(window.H).unit + ' · ' + MSH.powerPrice(window.H).graphUnit;
    let ev = 0; window.addEventListener('hjem-price', () => ev++);
    await MSH.store.set('power_price', { cur: '$' }, { now: true }); await new Promise((q) => setTimeout(q, 200));
    out.ev = ev; out.usd = MSH.powerPrice(window.H).unit;
    return out;
  });
  ok('3 «both»: Norgespris vises', r.both, r);
  ok('3 «nordpool»: Norgespris-tallet og den stiplede linja skjules', r.np, r);
  ok('3 «static»: «Fast pris» + «Statisk pris», € og cent på aksen', /Fast pris/.test(r.st) && /Statisk pris/.test(r.st) && /€\/kWh/.test(r.st) && /cent\/kWh/.test(r.unit), { unit: r.unit, t: r.st.slice(0, 160) });
  ok('3 egendefinert valuta: SEK/kWh og öre/kWh', r.cust === 'SEK/kWh · öre/kWh', r.cust);
  ok('3 lagring sender «hjem-price» og $ gir $/kWh', r.ev > 0 && r.usd === '$/kWh', r);
  ok('3 ingen sidefeil', !errs.length, errs);
  await ctx.close();
}

/* ---------------- 4–6 · hurtigpanel */
{
  const { p, ctx, errs } = await page({ width: 412, height: 900 }, () => window.mockExtend(({ add }) => add('light.alle_lys', 'on', { friendly_name: 'Alle lys', brightness: 128, supported_color_modes: ['brightness'] })));
  await p.evaluate(async () => { localStorage.removeItem('hurtigpanel-cfg'); window.__el = await window.mk('msh-hjem-card', { card_id: 'hj' }); });
  // lys-søk
  const s = await p.evaluate(async () => {
    const hp = window.__el.__hurtig; hp.open(1); await new Promise((q) => setTimeout(q, 400));
    const R = hp.root, out = {};
    out.lockH = getComputedStyle(document.documentElement).overflow === 'hidden' && getComputedStyle(document.body).overflow === 'hidden';
    R.querySelector('[data-a="lpick"]').click(); await new Promise((q) => setTimeout(q, 200));
    const inp = R.querySelector('[data-lq]'); inp.value = 'alle'; inp.dispatchEvent(new Event('input', { bubbles: true })); await new Promise((q) => setTimeout(q, 200));
    out.hit = [...R.querySelectorAll('.lpl .lo2')].map((b) => b.dataset.v).includes('light.alle_lys');
    const i2 = R.querySelector('[data-lq]'); i2.value = 'light.finnes_ikke'; i2.dispatchEvent(new Event('input', { bubbles: true })); await new Promise((q) => setTimeout(q, 200));
    out.custom = !!R.querySelector('.lcu') && R.querySelector('.lcu').textContent.includes('light.finnes_ikke');
    const i3 = R.querySelector('[data-lq]'); i3.value = 'alle'; i3.dispatchEvent(new Event('input', { bubbles: true })); await new Promise((q) => setTimeout(q, 200));
    R.querySelector('.lpl .lo2[data-v="light.alle_lys"]').click(); await new Promise((q) => setTimeout(q, 200));
    out.saved = localStorage.getItem('hurtigpanel-lys');
    out.label = R.querySelector('[data-sl="lights"]').textContent.trim();
    out.list = !!R.querySelector('.nl[data-qs-scroll]');
    hp.close(false); await new Promise((q) => setTimeout(q, 100));
    out.unlock = getComputedStyle(document.documentElement).overflow !== 'hidden';
    return out;
  });
  ok('4 bakgrunnslås mens panelet er åpent (html/body overflow hidden) – fjernes ved lukk', s.lockH && s.unlock, s);
  ok('4 varsellista er [data-qs-scroll]', s.list, s);
  ok('5 søk «alle» viser light.alle_lys', s.hit, s);
  ok('5 ukjent ID → «Bruk denne entiteten»', s.custom, s);
  ok('5 valget lagres i hurtigpanel-lys og slideren viser navnet', /alle_lys/.test(s.saved || '') && /Alle lys/.test(s.label), s);
  // hint
  const hn = await p.evaluate(async () => {
    const hp = window.__el.__hurtig; hp.open(1); await new Promise((q) => setTimeout(q, 300));
    hp.root.querySelector('[data-a="set"]').click(); await new Promise((q) => setTimeout(q, 150));
    hp.root.querySelector('[data-a="hint"]').click(); await new Promise((q) => setTimeout(q, 150));
    const cfg = JSON.parse(localStorage.getItem('hurtigpanel-cfg') || '{}');
    hp.close(false); await new Promise((q) => setTimeout(q, 400));
    hp._hintUpd();
    const off = !hp.hint.classList.contains('on');
    hp.open(1); await new Promise((q) => setTimeout(q, 300));
    hp.root.querySelector('[data-a="set"]') && !hp.setOpen && hp.root.querySelector('[data-a="set"]').click(); await new Promise((q) => setTimeout(q, 150));
    hp.root.querySelector('[data-a="reset"]').click(); await new Promise((q) => setTimeout(q, 150));
    const back = (MSH.hurtigSwipe('mobil').hint !== false);
    hp.close(false);
    return { cfg, off, back };
  });
  ok('6 «Vis hint øverst» av → hint: false lagret og streken skjult', hn.cfg.hint === false && hn.off, hn);
  ok('6 «Tilbakestill» slår hintet på igjen', hn.back, hn);
  ok('4–6 ingen sidefeil', !errs.length, errs);
  await ctx.close();
}

/* ---------------- 7 · Ringeopptak */
{
  const { p, ctx, errs } = await page();
  const r = await p.evaluate(async () => {
    window.__el = await window.mk('msh-hjem-card', { card_id: 'hj' });
    MSH.ringMissedSet(Date.now() - 14 * 60000); await new Promise((q) => setTimeout(q, 400));
    const out = {};
    const ban = deep('msh-ring-banner'); out.banner = !!ban && /Det ringte på/.test(ban.shadowRoot.textContent) && /Trykk for å se video og bilder/.test(ban.shadowRoot.textContent);
    ban.shadowRoot.querySelector('[data-a="mopen"]').click(); await new Promise((q) => setTimeout(q, 300));
    const md = MSH.ringRec.current; out.modal = !!md;
    const R = md.root;
    out.head = /Det ringte på/.test(R.textContent) && /Kl\. \d\d:\d\d · 14 min siden/.test(R.textContent);
    out.tabs = [...R.querySelectorAll('.tb')].map((x) => x.textContent.trim());
    out.seek = !!R.querySelector('[data-seek]');
    R.querySelector('[data-a="mode"][data-v="snap"]').click(); await new Promise((q) => setTimeout(q, 200));
    out.thumbs = R.querySelectorAll('.tm').length;
    out.labels = [...R.querySelectorAll('.tm .lb')].map((x) => x.textContent);
    out.acts = [...R.querySelectorAll('.ac')].map((x) => x.textContent.trim());
    R.querySelector('.bg').click(); await new Promise((q) => setTimeout(q, 200));
    out.closed = !MSH.ringRec.current;
    // hurtigpanelet: varselet «Det ringte på» med «Se opptak» åpner modalen
    const hp = window.__el.__hurtig; hp.open(1); await new Promise((q) => setTimeout(q, 400));
    const nc = hp.root.querySelector('.nc[data-nc="ring"]');
    out.hpCard = !!nc && /Det ringte på/.test(nc.textContent) && /Se opptak/.test(nc.textContent) && !!nc.querySelector('.snp');
    [...nc.querySelectorAll('[data-a="nact"]')].find((b) => /Se opptak/.test(b.textContent)).click(); await new Promise((q) => setTimeout(q, 300));
    out.fromHp = !!MSH.ringRec.current;
    MSH.ringRec.close(); hp.close(false);
    // X fjerner banneret
    MSH.ringMissedSet(Date.now() - 60000); await new Promise((q) => setTimeout(q, 300));
    deep('msh-ring-banner').shadowRoot.querySelector('[data-a="mx"]').click(); await new Promise((q) => setTimeout(q, 400));
    out.xGone = !MSH.ringMissedT() && !deep('msh-ring-banner');
    return out;
  });
  ok('7 tapt ringing: banner «Det ringte på · …» med «Trykk for å se video og bilder»', r.banner, r);
  ok('7 trykk åpner Ringeopptak med topp «Kl. HH:MM · 14 min siden»', r.modal && r.head, r);
  ok('7 fanene Video og Bilder, tidslinje for spoling', JSON.stringify(r.tabs) === '["Video","Bilder"]' && r.seek, r.tabs);
  ok('7 Bilder: fire bilder +0/+2/+4/+6 s', r.thumbs === 4 && r.labels.join() === '+0 s,+2 s,+4 s,+6 s', r.labels);
  ok('7 knapper Se live · Lagre · Del, bakgrunnen lukker', r.acts.join() === 'Se live,Lagre,Del' && r.closed, r.acts);
  ok('7 hurtigpanelet: «Det ringte på»-varsel med play-merke og «Se opptak» → modal', r.hpCard && r.fromHp, r);
  ok('7 X fjerner banneret', r.xGone, r);
  ok('7 ingen sidefeil', !errs.length, errs);
  await ctx.close();
}

await b.close();
console.log(res.join('\n'));
const bad = res.filter((x) => x.startsWith('✘')).length;
console.log(bad ? `\n${bad} feilet` : '\nAlle bestod');
process.exit(bad ? 1 : 0);
