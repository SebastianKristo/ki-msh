// Sjekk før levering – automatisert del. Kjører hver popup/kort i Chromium med mock-hass og en
// Bubble Card-stub (transform på popupen), på mobil (390 px) og PC (1400 px + 256 px HA-sidebar).
import { createRequire } from 'node:module';
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const { chromium } = pw;
const cases = readdirSync('test/cases').filter((f) => f.endsWith('.json')).sort().flatMap((f) => [].concat(JSON.parse(readFileSync('test/cases/' + f, 'utf8'))));
const only = process.argv[2];
const url = 'file://' + resolve('test/harness.html');
// Egen bundle per kjøring (trygt når flere bygger samtidig)
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/ki-msh-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle], { stdio: 'inherit' });
const mocks = existsSync('test/mock') ? readdirSync('test/mock').filter((f) => f.endsWith('.js')).sort().map((f) => resolve('test/mock/' + f)) : [];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
let fails = 0;
const rows = [];
for (const vp of [{ w: 390, h: 844, sb: 0, n: 'mobil' }, { w: 1400, h: 900, sb: 256, n: 'PC' }]) {
  for (const c of cases) {
    if (only && !c.name.includes(only)) continue;
    const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h }, hasTouch: vp.n === 'mobil' });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/fonts.googleapis|net::ERR/.test(m.text())) errors.push(m.text()); });
    await page.goto(url);
    for (const m of mocks) await page.addScriptTag({ path: m });
    await page.addScriptTag({ path: bundle });
    const res = await page.evaluate(async ({ c, vp }) => {
      document.documentElement.style.setProperty('--sb', vp.sb + 'px');
      document.documentElement.style.setProperty('--popw', vp.w > 800 ? '640px' : '100%');
      const hass = window.mockHass();
      const dash = document.getElementById('dash');
      const out = { cards: [] };
      const mk = async (cfg) => {
        const tag = cfg.type.replace('custom:', '');
        await customElements.whenDefined(tag).catch(() => {});
        if (!customElements.get(tag)) throw new Error('Ukjent kort ' + tag);
        const el = document.createElement(tag);
        el.setConfig(cfg);
        el.hass = hass;
        return el;
      };
      let host = dash;
      if (c.hash) {
        const bc = document.createElement('bubble-card');
        bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash: c.hash });
        bc.innerHTML = `<div class="pop"><div class="hdr">${c.name}</div><div class="inner"></div></div>`;
        dash.appendChild(bc);
        host = bc.querySelector('.inner');
        location.hash = c.hash;
      }
      for (const cfg of c.cards) { const el = await mk(cfg); host.appendChild(el); out.cards.push(el); }
      await new Promise((r) => setTimeout(r, 400));
      // hass-oppdatering (ny state-referanse) skal ikke kaste
      const h2 = { ...hass, states: { ...hass.states } };
      out.cards.forEach((el) => { el.hass = h2; });
      await new Promise((r) => setTimeout(r, 200));
      const hcs = getComputedStyle(host); const hostW = host.clientWidth - parseFloat(hcs.paddingLeft) - parseFloat(hcs.paddingRight);
      const r = { widths: [], mdiText: [], icons: 0, badIcons: 0, empty: [], grid: [], editor: [], openTap: 0, heights: [] };
      for (const el of out.cards) {
        const w = el.getBoundingClientRect().width;
        r.widths.push(Math.round(w) + '/' + Math.round(hostW));
        r.heights.push(Math.round(el.getBoundingClientRect().height));
        const txt = el.shadowRoot ? el.shadowRoot.textContent : '';
        if (/\b(mdi|hass|phu|hue):[a-z]/.test(txt.replace(/<style[\s\S]*?<\/style>/g, '').replace(/\{[^}]*\}/g, ''))) r.mdiText.push(el.localName);
        const ics = el.shadowRoot ? el.shadowRoot.querySelectorAll('ha-icon') : [];
        r.icons += ics.length;
        ics.forEach((i) => { if (i.getAttribute('data-ok') !== '1') r.badIcons++; });
        const g = el.getGridOptions ? el.getGridOptions() : null;
        r.grid.push(g && g.columns === 'full' ? 'full' : JSON.stringify(g));
        try {
          const ed = el.constructor.getConfigElement();
          ed.hass = hass; ed.setConfig(el._rawConfig || {});
          document.body.appendChild(ed);
          await new Promise((q) => setTimeout(q, 50));
          const ok = ed.shadowRoot && ed.shadowRoot.innerHTML.length > 50;
          r.editor.push(ok ? 'ok' : 'tom');
          ed.remove();
        } catch (e) { r.editor.push('FEIL ' + e.message); }
        try { const s = el.constructor.getStubConfig(hass); if (!s) r.editor.push('ingen stub'); } catch (e) { r.editor.push('stub-feil ' + e.message); }
        const bg = getComputedStyle(el.shadowRoot.querySelector('ha-card') || el).backgroundColor;
        if (bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') r.empty.push('ha-card bakgrunn ' + bg);
      }
      // trykk på første handling (haptic skal fyres)
      let hapt = 0;
      window.addEventListener('haptic', () => hapt++);
      const first = out.cards[0] && out.cards[0].shadowRoot.querySelector('[data-act]:not([data-act="customize"])');
      if (first) { first.click(); await new Promise((q) => setTimeout(q, 60)); }
      r.haptic = first ? hapt : 'ingen knapp';
      return r;
    }, { c, vp });
    const widthOk = res.widths.every((x) => { const [a, b] = x.split('/').map(Number); return Math.abs(a - b) <= 1; });
    const ok = !errors.length && widthOk && !res.mdiText.length && !res.badIcons && res.grid.every((g) => g === 'full') && res.editor.every((e) => e === 'ok') && !res.empty.length && (res.haptic === 'ingen knapp' || res.haptic >= 1);
    if (!ok) fails++;
    rows.push({ vp: vp.n, name: c.name, hash: c.hash || '–', ok, widthOk, widths: res.widths.join(' '), heights: res.heights.join(' '), icons: res.icons, badIcons: res.badIcons, mdiText: res.mdiText.join(','), grid: res.grid.join(','), editor: res.editor.join(','), haptic: res.haptic, errors: errors.slice(0, 3).join(' | '), extra: res.empty.join(',') });
    if (process.env.SHOT) await page.screenshot({ path: `test/shots/${vp.n}-${c.name.replace(/\W+/g, '_')}.png`, fullPage: true });
    await page.close();
  }
}
await browser.close();
try { (await import('node:fs')).unlinkSync(bundle); } catch (e) { /* */ }
for (const r of rows) console.log(`${r.ok ? '✔' : '✘'} [${r.vp}] ${r.name} ${r.hash} · bredde ${r.widthOk ? 'ok' : 'FEIL ' + r.widths} · h ${r.heights} · ikoner ${r.icons}${r.badIcons ? ' (feil ' + r.badIcons + ')' : ''} · grid ${r.grid} · editor ${r.editor} · haptic ${r.haptic}${r.mdiText ? ' · MDI-TEKST ' + r.mdiText : ''}${r.errors ? ' · FEIL: ' + r.errors : ''}${r.extra ? ' · ' + r.extra : ''}`);
console.log(fails ? `\n${fails} feilet` : '\nAlle bestod');
process.exit(fails ? 1 : 0);
