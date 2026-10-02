// Fiks 28.13 · Alle fanelinjer med tannhjul: hold 400 ms + dra = omorganiser (felles MSH.tabReorder, 05-tab-reorder.js).
// For hver popup med faner (ekte Bubble Card-popup i test/harness-bubble.html, 390 px, touch via CDP + mus):
//   · touch: hold 520 ms + dra første fane til siste plass → ny rekkefølge i raden, lagret i config, popupen åpen
//   · midt i draget: scale(1.06) + skygge 0 8px 20px, raden pulserer (Web Animations), fanen holder seg i raden
//   · mus: hold + dra tilbake → lagret; Esc midt i et mus-drag → rekkefølgen tilbake, ingen fanebytte
//   · > 6 px før 400 ms → ingen omorganisering; kort trykk bytter fane; tannhjulet er ikke med i items()
//   · endring i config (som Tilpass → Faner) → fanelinjen følger
// Kjør: node test/fiks28-faner-check.mjs [Kalender …]
import { createRequire } from 'node:module';
import { readdirSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const R = resolve('.') + '/';
mkdirSync('test/.build', { recursive: true });
mkdirSync('test/.vendor', { recursive: true });
const BC = resolve('test/.vendor/bubble-card.js');
if (!existsSync(BC)) execFileSync('curl', ['-sSL', '-o', BC, 'https://raw.githubusercontent.com/Clooos/Bubble-Card/main/dist/bubble-card.js']);
const bundle = resolve(`test/.build/f28f-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const mocks = readdirSync(R + 'test/mock').filter((f) => f.endsWith('.js')).sort().map((f) => R + 'test/mock/' + f);

const CARDS = [
  ['Kalender', 'msh-kalender-card', '#kalender', { tab_labels: 'name' }],
  ['Stovsuger', 'msh-stovsuger-card', '#rolf', {}],
  ['Server', 'msh-server-card', '#server', {}],
  ['Avfall', 'msh-avfall-card', '#soppel', {}],
  ['Varmepumpe', 'msh-varmepumpe-card', '#varmepumpe', {}],
  ['Vanning', 'msh-vanning-card', '#vanning', {}],
  ['Kamera', 'msh-kamera-card', '#kamera', {}],
  ['Innstillinger', 'msh-innstillinger-card', '#settings', {}],
  ['Basseng', 'msh-basseng-card', '#mitt-basseng', {}], // manuell popup (bassengpopupene er slettet)
  ['Lys', 'msh-lys-card', '#lys', {}],
  ['Klima', 'msh-klima-card', '#klima', {}],
  ['Media', 'msh-media-card', '#media', {}],
  ['Tesla', 'msh-tesla-card', '#tesla', {}],
];
const only = process.argv.slice(2);
const list = only.length ? CARDS.filter((c) => only.some((o) => c[0].toLowerCase() === o.toLowerCase())) : CARDS;

const browser = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = [];
let fails = 0;
const ok = (name, cond, info) => { if (!cond) fails++; res.push(`${cond ? '✔' : '✘'} ${name}${info != null ? ' · ' + JSON.stringify(info) : ''}`); };

for (const [name, tag, hash, extra] of list) {
  const page = await browser.newPage({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('file://' + R + 'test/harness-bubble.html');
  for (const m of mocks) await page.addScriptTag({ path: m });
  await page.addScriptTag({ path: bundle });
  await page.addScriptTag({ path: BC, type: 'module' });
  await page.waitForFunction(() => customElements.get('bubble-card'), null, { timeout: 15000 });
  const cdp = await page.context().newCDPSession(page);
  const wait = (ms) => page.waitForTimeout(ms);
  const ready = await page.evaluate(async ({ tag, hash, extra }) => {
    window.deepAll = (sel, root) => { const out = []; const walk = (r) => r.querySelectorAll('*').forEach((e) => { if (e.matches(sel)) out.push(e); if (e.shadowRoot) walk(e.shadowRoot); }); walk(root || document); return out; };
    window.H = window.mockHass();
    const bc = document.createElement('bubble-card');
    bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash, name: 'Test', icon: 'mdi:star', margin_top_mobile: '50px', cards: [{ type: 'custom:' + tag, card_id: 'f28_' + tag, ...extra }] });
    bc.hass = H; document.getElementById('dash').appendChild(bc);
    await new Promise((r) => setTimeout(r, 400));
    location.hash = hash;
    await new Promise((r) => setTimeout(r, 1200));
    window.card = () => deepAll(tag)[0];
    // fanelinjen = elementet i kortets shadow root som har en MSH.tabReorder-kontroller
    window.T = () => { const c = card(); if (!c || !c.shadowRoot) return null; const row = [c.shadowRoot, ...deepAll('*', c.shadowRoot).filter((e) => e.shadowRoot).map((e) => e.shadowRoot)].flatMap((r) => [...r.querySelectorAll('*')]).find((e) => e.__tabReorder && e.getClientRects().length); return row ? row.__tabReorder : null; };
    window.ids = () => { const t = T(); return t ? t.items().map((b) => t.idOf(b)) : []; };
    window.act = () => { const t = T(), b = t && t.activeBtn(); return b ? t.idOf(b) : null; };
    window.popOpen = () => location.hash === hash && deepAll('.bubble-pop-up').some((p) => p.classList.contains('is-popup-opened'));
    window.ctr = (i) => { const t = T(), b = t.items()[i]; b.scrollIntoView({ block: 'center', inline: 'nearest' }); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width }; };
    // finn en liste i config som (filtrert til synlige faner) er lik rekkefølgen
    window.cfgHas = (order) => {
      const want = order.join('|'), out = [];
      const walk = (o, p) => {
        if (Array.isArray(o)) {
          const ks = o.map((x) => (x && typeof x === 'object' ? x.key : x)).filter((x) => order.includes(x));
          if (ks.join('|') === want) out.push(p);
          o.forEach((x, i) => { if (x && typeof x === 'object') walk(x, p + '.' + i); });
        } else if (o && typeof o === 'object') Object.keys(o).forEach((k) => walk(o[k], p ? p + '.' + k : k));
      };
      walk(card()._rawConfig, '');
      return out;
    };
    const t = T();
    return { has: !!t, n: ids().length, fixedOut: t ? t.items().every((b) => !b.matches('.gear,[data-act="customize"]')) : null, gear: !!(card() && deepAll('.gear,[data-act="customize"],.cfg', card().shadowRoot).length) };
  }, { tag, hash, extra });
  if (!ready.has || ready.n < 2) { ok(`${name}: fanelinje med MSH.tabReorder og ≥ 2 faner`, false, ready); await page.close(); continue; }
  ok(`${name}: fanelinje med MSH.tabReorder (${ready.n} faner), tannhjul utenfor items()`, ready.fixedOut, ready);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });

  /* ---------- touch: hold + dra første → siste */
  const o0 = await page.evaluate(() => ids());
  const a = await page.evaluate(() => ctr(0)), z = await page.evaluate((n) => ctr(n - 1), o0.length);
  const a2 = await page.evaluate(() => ctr(0));
  await touch('touchStart', [{ x: a2.x, y: a2.y }]);
  await wait(560);
  const steps = 16;
  let mid = null;
  for (let i = 1; i <= steps; i++) {
    await touch('touchMove', [{ x: a2.x + ((z.x + 400 - a2.x) * i) / steps, y: a2.y + (i % 2) }]);
    await wait(22);
    if (i === steps) {
      mid = await page.evaluate(() => {
        const t = T(), b = t.items().find((x) => x.classList.contains('tr-lift')), row = t.row;
        if (!b) return { lift: false };
        const rr = row.getBoundingClientRect(), br = b.getBoundingClientRect();
        return { lift: true, tf: b.style.transform, sh: b.style.boxShadow, anim: row.getAnimations ? row.getAnimations().length : 0, ta: b.style.touchAction, inRow: br.right <= rr.right + b.offsetWidth * 0.06 + 2 && br.left >= rr.left - b.offsetWidth * 0.06 - 2, us: getComputedStyle(b).userSelect };
      });
    }
  }
  await touch('touchEnd', []);
  await wait(900);
  const exp1 = o0.slice(1).concat(o0[0]);
  const o1 = await page.evaluate(() => ids());
  ok(`${name} touch: løft scale(1.06) + skygge 0 8px 20px, puls, touch-action none, holder seg i raden`, mid && mid.lift && /scale\(1\.06\)/.test(mid.tf) && /0px 8px 20px/.test(mid.sh) && mid.anim > 0 && mid.ta === 'none' && mid.inRow && mid.us === 'none', mid);
  ok(`${name} touch: hold + dra flytter første fane sist`, o1.join() === exp1.join(), { før: o0, etter: o1 });
  const p1 = await page.evaluate((o) => cfgHas(o), exp1);
  ok(`${name} touch: ny rekkefølge lagret i config`, p1.length > 0, p1);
  ok(`${name} touch: popupen er fortsatt åpen`, await page.evaluate(() => popOpen()));

  /* ---------- Tilpass → Faner: config-endring oppdaterer fanelinjen */
  if (p1.length) {
    const rev = exp1.slice().reverse();
    const o2 = await page.evaluate(async ({ path, rev }) => {
      const c = card(), cfg = JSON.parse(JSON.stringify(c._rawConfig));
      const ks = path.split('.'), last = ks.pop(); let o = cfg; ks.forEach((k) => { o = o[k]; });
      const arr = o[last], vis = arr.filter((x) => rev.includes(x && typeof x === 'object' ? x.key : x));
      const sorted = vis.slice().sort((p, q) => rev.indexOf(p && typeof p === 'object' ? p.key : p) - rev.indexOf(q && typeof q === 'object' ? q.key : q));
      let j = 0; o[last] = arr.map((x) => (rev.includes(x && typeof x === 'object' ? x.key : x) ? sorted[j++] : x));
      // som Tilpass-arket: lagres via MSH.saveCardConfig (ki-store) → kortet får ny config
      const old = c._rawConfig; c.setConfig(cfg); await MSH.saveCardConfig(c.hass, old, cfg, { card: c, immediate: true }); await new Promise((r) => setTimeout(r, 500));
      return ids();
    }, { path: p1[0], rev });
    ok(`${name}: endret rekkefølge i config (Tilpass → Faner) vises i fanelinjen`, o2.join() === rev.join(), { want: rev, got: o2 });
  }

  /* ---------- mus: hold + dra siste → første */
  const om = await page.evaluate(() => ids());
  const m0 = await page.evaluate((n) => ctr(n - 1), om.length), m1 = await page.evaluate(() => ctr(0));
  const ms = await page.evaluate((n) => ctr(n - 1), om.length);
  await page.mouse.move(ms.x, ms.y); await page.mouse.down(); await wait(560);
  for (let i = 1; i <= steps; i++) { await page.mouse.move(ms.x + ((m1.x - 400 - ms.x) * i) / steps, ms.y); await wait(22); }
  await page.mouse.up(); await wait(900);
  const expM = [om[om.length - 1], ...om.slice(0, -1)];
  const oM = await page.evaluate(() => ids());
  ok(`${name} mus: hold + dra flytter siste fane først`, oM.join() === expM.join(), { før: om, etter: oM, m0 });
  ok(`${name} mus: lagret i config`, (await page.evaluate((o) => cfgHas(o), expM)).length > 0);
  ok(`${name} mus: popupen er fortsatt åpen`, await page.evaluate(() => popOpen()));

  /* ---------- Esc avbryter (mus) */
  const oe = await page.evaluate(() => ids()), ae = await page.evaluate(() => act());
  const e0 = await page.evaluate(() => ctr(0)), eN = await page.evaluate((n) => ctr(n - 1), oe.length);
  const e0b = await page.evaluate(() => ctr(0));
  await page.mouse.move(e0b.x, e0b.y); await page.mouse.down(); await wait(560);
  for (let i = 1; i <= 8; i++) { await page.mouse.move(e0b.x + ((eN.x - e0b.x) * i) / 8, e0b.y); await wait(22); }
  await page.keyboard.press('Escape'); await wait(80);
  await page.mouse.up(); await wait(700);
  const oe2 = await page.evaluate(() => ids()), ae2 = await page.evaluate(() => act());
  ok(`${name} Esc: rekkefølgen tilbake, ingen fanebytte, popupen åpen`, oe2.join() === oe.join() && ae2 === ae && (await page.evaluate(() => popOpen())), { før: oe, etter: oe2, ae, ae2, e0 });

  /* ---------- > 6 px før 400 ms avbryter holdet */
  const oa = await page.evaluate(() => ids());
  const s0 = await page.evaluate(() => ctr(0));
  await touch('touchStart', [{ x: s0.x, y: s0.y }]);
  for (let i = 1; i <= 4; i++) { await touch('touchMove', [{ x: s0.x + i * 5, y: s0.y }]); await wait(20); }
  await wait(600);
  for (let i = 1; i <= 8; i++) { await touch('touchMove', [{ x: s0.x + 20 + i * 25, y: s0.y }]); await wait(20); }
  await touch('touchEnd', []); await wait(700);
  ok(`${name}: > 6 px før 400 ms → ingen omorganisering`, (await page.evaluate(() => ids())).join() === oa.join() && (await page.evaluate(() => popOpen())));

  /* ---------- kort trykk bytter fane */
  const cur = await page.evaluate(() => act()), all = await page.evaluate(() => ids());
  const ti = all.findIndex((k) => k !== cur);
  const tp = await page.evaluate((i) => ctr(i), ti);
  await touch('touchStart', [{ x: tp.x, y: tp.y }]); await wait(80); await touch('touchEnd', []); await wait(700);
  const cur2 = await page.evaluate(() => act());
  ok(`${name}: kort trykk bytter fane (${cur} → ${all[ti]})`, cur2 === all[ti] && (await page.evaluate(() => ids())).join() === all.join() && (await page.evaluate(() => popOpen())), { cur2 });
  // mus-klikk bytter også
  const ti2 = all.findIndex((k) => k !== cur2);
  const tq = await page.evaluate((i) => ctr(i), ti2);
  await page.mouse.click(tq.x, tq.y); await wait(700);
  ok(`${name}: museklikk bytter fane`, (await page.evaluate(() => act())) === all[ti2], { want: all[ti2], got: await page.evaluate(() => act()) });
  ok(`${name}: ingen sidefeil`, !errs.length, errs.slice(0, 3));
  await page.close();
}
await browser.close();
console.log(res.join('\n'));
console.log(fails ? `\n${fails} feil` : '\nAlt OK');
process.exit(fails ? 1 : 0);
