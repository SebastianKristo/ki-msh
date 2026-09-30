// Fiks 26.21 · Rom: «Tilpass rommet»-knappen nederst er av som standard (bare customize_button/show_edit_button: true viser den),
// tannhjulet i klima-toppkortet vises alltid og åpner «Tilpass rom». Kjør: node test/rom26-check.mjs
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readdirSync, mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/rom26-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto('file://' + resolve('test/harness.html'));
for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
await p.addScriptTag({ path: bundle });
const out = await p.evaluate(async () => {
  const M = window.MSH, wait = (ms) => new Promise((q) => setTimeout(q, ms));
  const hass = window.mockHass();
  const R0 = [], ok = (n, c, i) => R0.push(`${c ? '✔' : '✘'} ${n}${i != null ? ' · ' + JSON.stringify(i) : ''}`);
  const dash = document.getElementById('dash');
  M.lastHass = M.lastHass || hass;
  if (M.store && !M.store.loaded) await M.store.load(hass);
  const deepQ = (root, sel) => { let f = root.querySelector(sel); if (f) return f; for (const e of root.querySelectorAll('*')) if (e.shadowRoot) { f = deepQ(e.shadowRoot, sel); if (f) return f; } return null; };
  const lag = async (extra) => { const r = document.createElement('msh-rom-card'); r.setConfig({ type: 'custom:msh-rom-card', card_id: 'r26-' + Math.random().toString(36).slice(2), area: 'stue', ...(extra || {}) }); r.hass = hass; dash.appendChild(r); await wait(500); return r; };

  let r = await lag();
  ok('standard (nøkkel mangler): ingen «Tilpass rommet»-knapp nederst', !r.shadowRoot.querySelector('.tune'));
  const gear = deepQ(r.shadowRoot, '.gear[data-act="customize"]');
  ok('tannhjulet i klima-toppkortet vises alltid', !!gear);
  let opened = null;
  const orig = M.openEditor; M.openEditor = (card, o) => { opened = { card: card.localName, o }; return null; };
  if (gear) gear.click();
  await wait(100);
  M.openEditor = orig;
  ok('tannhjulet åpner «Tilpass rom»', !!opened, opened && opened.card);
  r.remove();

  r = await lag({ customize_button: false });
  ok('customize_button: false → ingen knapp', !r.shadowRoot.querySelector('.tune')); r.remove();
  r = await lag({ customize_button: true });
  ok('customize_button: true → knappen vises', !!r.shadowRoot.querySelector('.tune')); r.remove();
  r = await lag({ show_edit_button: true });
  ok('show_edit_button: true → knappen vises', !!r.shadowRoot.querySelector('.tune')); r.remove();

  const Cls = customElements.get('msh-rom-card');
  const stub = Cls.getStubConfig();
  ok('getStubConfig: customize_button false', stub.customize_button === false && !!stub.card_id, stub);
  const f = [];
  const walk = (L) => (L || []).forEach((x) => { if (!x) return; if (x.name === 'customize_button') f.push(x); walk(x.fields); (x.tabs || []).forEach((t) => walk(t.fields)); });
  walk(typeof Cls.schema === 'function' ? Cls.schema() : Cls.schema);
  ok('GUI-editor: bryteren står som av (default false)', f.length >= 1 && f.every((x) => x.default === false), f.map((x) => x.default));
  return R0;
});
await b.close();
try { (await import('node:fs')).unlinkSync(bundle); } catch (e) { /* */ }
console.log(out.join('\n'));
if (errs.length) console.log('Sidefeil:', errs.slice(0, 5));
const bad = out.filter((l) => l.startsWith('✘')).length;
console.log(bad || errs.length ? `\n${bad} feilet${errs.length ? ` · ${errs.length} sidefeil` : ''}` : '\nAlle bestod');
process.exit(bad || errs.length ? 1 : 0);
