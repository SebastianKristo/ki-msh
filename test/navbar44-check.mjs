// Del 44 A · «Mer»-menyen: «Tilpass»-knappen (tune) under streken har aldri varselprikk/badge/teller.
//  · rail (layout stor, 1280 px) og bunn (layout mobil, 390 px), mørk + lys modus
//  · prikken vises ikke selv om M.tilpassAltDot() sier true og selv om configen har en badges-regel på '__tilpass'
//  · andre varselprikker virker som før: navbar-knapp med regel → .dot, Mer-element med regel → .mdot, uten regel → ingen
//  Kjør: node test/navbar44-check.mjs   (SHOTS=<mappe> lagrer skjermbilder)
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readdirSync, mkdirSync, rmSync } from 'node:fs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/nav44-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const shots = process.env.SHOTS || '';
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
let fail = 0;
const ok = (n, c, i) => { console.log(`${c ? '✔' : '✘'} ${n}${!c && i != null ? ' · ' + JSON.stringify(i).slice(0, 500) : ''}`); if (!c) fail++; };

for (const variant of ['bunn', 'rail']) {
  for (const dark of [true, false]) {
    const tag = `${variant} · ${dark ? 'mørk' : 'lys'}`;
    const p = await b.newPage({ viewport: variant === 'rail' ? { width: 1280, height: 900 } : { width: 390, height: 844 }, hasTouch: variant === 'bunn' });
    const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto('file://' + resolve('test/harness.html'));
    for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
    await p.addScriptTag({ path: bundle });
    const r = await p.evaluate(async ({ dark, variant }) => {
      const M = window.MSH, wait = (ms) => new Promise((q) => setTimeout(q, ms));
      const deepAll = () => { const out = []; const walk = (root) => root.querySelectorAll('*').forEach((e) => { out.push(e); if (e.shadowRoot) walk(e.shadowRoot); }); walk(document); return out; };
      const hass = window.mockHass(); hass.themes = { ...(hass.themes || {}), darkMode: dark };
      if (M.theme && M.theme.update) M.theme.update(hass);
      if (!dark) document.documentElement.setAttribute('data-ki-theme', 'light');
      const t = new Date().toISOString();
      hass.states['input_boolean.nav44_varsel'] = { entity_id: 'input_boolean.nav44_varsel', state: 'on', attributes: { friendly_name: 'Varsel' }, last_changed: t, last_updated: t, context: {} };
      M.tilpassAltDot = () => true; // «nye rom usjekket» – skal ikke lenger gi prikk på Tilpass
      const rule = [{ entity: 'input_boolean.nav44_varsel', op: '=', value: 'on', text: 'Varsel' }];
      const nb = document.createElement('msh-navbar-card');
      nb.setConfig({ type: 'custom:msh-navbar-card', card_id: 'nav44', layout: variant === 'rail' ? 'stor' : 'mobil', bar: ['vanning', 'media', 'klima', 'ruter'], more: ['gjoremal', 'energi'],
        badges: { media: rule, gjoremal: rule, __tilpass: rule, __more: rule } });
      nb.hass = hass; document.getElementById('dash').appendChild(nb);
      await wait(700);
      const navBtn = (id) => deepAll().find((e) => e.matches && e.matches(`nav.nb [data-id="${id}"]`));
      const out = { errs: [] };
      const nav = deepAll().find((e) => e.matches && e.matches('nav.nb'));
      out.rail = !!nav && (nav.getBoundingClientRect().height > nav.getBoundingClientRect().width);
      out.navDots = ['vanning', 'media', 'klima', 'ruter', '__more'].map((id) => { const x = navBtn(id); return x ? [id, !!x.querySelector('.dot')] : [id, null]; });
      const more = navBtn('__more'); if (more) more.click();
      await wait(500);
      const mis = deepAll().filter((e) => e.matches && e.matches('.mbox .mi'));
      out.menu = mis.map((e) => [e.dataset.id, e.dataset.act, e.querySelectorAll('.mdot, .dot, .badge, .u-badge, .rk-bang').length]);
      const tp = mis.find((e) => e.dataset.id === '__tilpass');
      out.tilpass = !!tp;
      if (tp) {
        // ingen pseudo-element-prikk eller rød bakgrunn på knappen/barna
        const red = [tp, ...tp.querySelectorAll('*')].some((e) => { const c = getComputedStyle(e), a = getComputedStyle(e, '::after'), bf = getComputedStyle(e, '::before'); return /242, 128, 115/.test(c.backgroundColor) || (a.content !== 'none' && a.content !== 'normal') || (bf.content !== 'none' && bf.content !== 'normal'); });
        out.tpRed = red; out.tpHtml = tp.innerHTML.replace(/\s+/g, ' ').slice(0, 300);
      }
      return out;
    }, { dark, variant });
    if (shots) { mkdirSync(shots, { recursive: true }); await p.screenshot({ path: `${shots}/navbar44-${variant}-${dark ? 'mork' : 'lys'}.png` }); }
    ok(`${tag}: riktig variant (rail=${variant === 'rail'})`, r.rail === (variant === 'rail'), r.rail);
    ok(`${tag}: «Tilpass» finnes i Mer-menyen`, r.tilpass, r.menu);
    const tp = (r.menu || []).find((x) => x[0] === '__tilpass');
    ok(`${tag}: ingen prikk/badge på «Tilpass» (også med tilpassAltDot()=true og regel på __tilpass)`, tp && tp[2] === 0 && !r.tpRed, { tp, red: r.tpRed, html: r.tpHtml });
    const g = (r.menu || []).find((x) => x[0] === 'gjoremal'), k = (r.menu || []).find((x) => x[0] === 'energi');
    ok(`${tag}: Mer-element med brukerregel (gjoremal) har fortsatt prikk`, g && g[2] === 1, r.menu);
    ok(`${tag}: Mer-element uten regel (energi) har ingen prikk`, k && k[2] === 0, r.menu);
    const nd = Object.fromEntries(r.navDots || []);
    ok(`${tag}: navbar-knapp med regel (media) har prikk, andre ikke, Mer-knappen aldri`, nd.media === true && nd.vanning === false && nd.klima === false && nd.__more === false, nd);
    ok(`${tag}: ingen sidefeil`, !errs.length, errs);
    await p.close();
  }
}
await b.close();
rmSync(bundle, { force: true });
console.log(fail ? `\n${fail} feil` : '\nAlle OK');
process.exit(fail ? 1 : 0);
