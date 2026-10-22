// Skjermbilder av «Tilpass …»-arkene (felles design, MSH.tp i src/00-c-tilpass.js) i iPhone-størrelse, mørk og lys modus.
//   node test/tilpass-shots.mjs [utmappe] [filter]   → <utmappe>/<ark>-dark.png / -light.png (standard test/.build/tilpass)
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const OUT = resolve(process.argv[2] || 'test/.build/tilpass'), only = process.argv[3];
mkdirSync(OUT, { recursive: true }); mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/tps-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const mocks = readdirSync('test/mock').filter((f) => f.endsWith('.js')).sort().map((f) => resolve('test/mock/' + f));
// Ekte MDI-ikoner (som docs-shots) i stedet for stubbens grå klosser
const MDI = resolve('test/.vendor/mdi.js');
if (!existsSync(MDI)) execFileSync('curl', ['-sSL', '-o', MDI, 'https://raw.githubusercontent.com/Templarian/MaterialDesign-JS/master/mdi.js']);
const mdiMap = {};
for (const m of readFileSync(MDI, 'utf8').matchAll(/export var mdi(\w+) = "([^"]+)"/g)) mdiMap[m[1].replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([A-Za-z])([0-9])/g, '$1-$2').toLowerCase()] = m[2];
const ICON = `customElements.define('ha-icon', class extends HTMLElement {
  static get observedAttributes() { return ['icon']; }
  connectedCallback() { this._r(); } attributeChangedCallback() { this._r(); }
  set icon(v) { this.setAttribute('icon', v || ''); } get icon() { return this.getAttribute('icon') || ''; }
  _r() {
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
    const i = this.getAttribute('icon') || '', n = i.replace(/^(mdi|hass):/, ''), d = (window.__MDI || {})[n] || (window.__MDI || {})['help-circle-outline'] || '';
    this.shadowRoot.innerHTML = '<style>:host{display:inline-flex;align-items:center;justify-content:center;vertical-align:middle;fill:currentcolor;width:var(--mdc-icon-size,24px);height:var(--mdc-icon-size,24px)}svg{width:100%;height:100%;display:block}</style><svg viewBox="0 0 24 24"><path d="' + d + '"></path></svg>';
  }
});`;
// Harnessen ligger i test/ (som harness-bubble.html), ikke i test/.build
const HARNESS = resolve(`test/.harness-tps-${process.pid}.html`);
{
  let h = readFileSync('test/harness-bubble.html', 'utf8');
  h = h.replace(/customElements\.define\('ha-icon'[^\n]*\n/, ICON + '\n');
  h = h.replace('</style>', `html,body{font-family:'Space Grotesk',system-ui,sans-serif}:root{--primary-background-color:#232323;--card-background-color:#282828}</style>`);
  writeFileSync(HARNESS, h);
}
const browser = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const SHOTS = [
  ['navbar', { editor: 'navbar' }],
  ['header', { editor: 'header' }],
  ['hjem', { editor: 'home' }],
  ['rom', { editor: 'room', area: 'stue' }],
  ['alt', { editor: 'tilpass-alt' }],
  ['lys', { card: 'msh-lys-card' }],
  ['kamera', { card: 'msh-kamera-card' }],
  ['klima', { card: 'msh-klima-card' }],
  ['vaer', { card: 'msh-vaer-card' }],
  ['strom', { card: 'msh-strom-card' }],
  ['ringeklokke', { card: 'msh-ringeklokke-card' }],
];
const errs = [];
for (const theme of ['dark', 'light']) for (const [name, d] of SHOTS) {
  if (only && !name.includes(only)) continue;
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  page.on('pageerror', (e) => errs.push(`${name}: ${e.message}`)); page.on('console', (m) => { if (m.type() === 'error') errs.push(name + ': ' + m.text().slice(0, 200)); });
  await page.goto('file://' + HARNESS);
  await page.addScriptTag({ content: 'window.__MDI = ' + JSON.stringify(mdiMap) + ';' });
  for (const m of mocks) await page.addScriptTag({ path: m });
  await page.addScriptTag({ path: bundle });
  const r = await page.evaluate(async ({ d, theme }) => {
    const wait = (ms) => new Promise((q) => setTimeout(q, ms));
    const H = window.mockHass(); H.themes = { ...(H.themes || {}), darkMode: theme === 'dark' };
    await MSH.store.load(H); MSH.lastHass = H;
    if (MSH.theme && MSH.theme.update) MSH.theme.update(H);
    const dash = document.getElementById('dash') || document.body;
    for (const t of ['msh-hjem-card', 'msh-navbar-card']) { const c = document.createElement(t); c.setConfig({ type: 'custom:' + t }); c.hass = H; dash.appendChild(c); }
    await wait(2500); // kortene setter hash/tilstand ved første tegning – åpner vi arket før, lukkes det igjen (hashchange)
    if (d.card) { const c = document.createElement(d.card); c.setConfig({ type: 'custom:' + d.card }); c.hass = H; dash.appendChild(c); await wait(300); c.customize(); }
    else if (d.editor === 'tilpass-alt') window.dispatchEvent(new CustomEvent('ki-open-editor', { detail: d }));
    else if (!MSH.openDashEditor(d)) return { none: true };
    await wait(1200);
    return { portals: MSH.portals().length };
  }, { d, theme });
  await page.screenshot({ path: `${OUT}/${name}-${theme}.png` });
  console.log(name, theme, JSON.stringify(r));
  await page.close();
}
console.log(errs.slice(0, 10).join('\n'));
await browser.close();
try { (await import('node:fs')).unlinkSync(HARNESS); } catch (e) { /* */ }
