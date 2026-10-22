// Prosa på Hjem: trykk på «hendelser»-boblen åpner Kalender-popupen (#kalender) – standard, lagret uten tap og lagret med gammel more-info.
// Kjør: node test/prosa-kalender-check.mjs
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readdirSync, mkdirSync, unlinkSync } from 'node:fs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const R = resolve('.') + '/';
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/pkal-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle], { cwd: R, stdio: 'inherit' });
const mocks = readdirSync(R + 'test/mock').filter((f) => f.endsWith('.js')).sort().map((f) => R + 'test/mock/' + f);
const browser = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = [];
const ok = (name, cond, info) => { res.push(`${cond ? '✔' : '✘'} ${name}${info != null ? ' · ' + JSON.stringify(info) : ''}`); };
const page = await browser.newPage({ viewport: { width: 430, height: 900 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
const P5 = { id: 'p5', pre: 'Vi har', src: 'events', fmt: '{v}', post: 'i dag.', icon: '⏰', color: 'hvit', cop: 'alltid' };
const run = async (name, prose) => {
  await page.goto('file://' + R + 'test/harness.html');
  const ud = { ki_dashboard: { cards: prose ? { prosa_k: { prose } } : {} } };
  await page.evaluate((ud) => { localStorage.clear(); window.__userData = ud; }, ud);
  for (const m of mocks) await page.addScriptTag({ path: m });
  await page.evaluate((ud) => { window.__userData = ud; }, ud);
  await page.addScriptTag({ path: bundle });
  const r = await page.evaluate(async () => {
    window.H = window.mockHass();
    if (window.MSH.store) await window.MSH.store.load(window.H);
    const el = document.createElement('msh-prosa-card'); el.setConfig({ type: 'custom:msh-prosa-card', card_id: 'prosa_k' }); el.hass = window.H;
    document.getElementById('dash').appendChild(el);
    await new Promise((q) => setTimeout(q, 1500)); el.hass = { ...window.H }; await new Promise((q) => setTimeout(q, 400));
    const chip = [...el.shadowRoot.querySelectorAll('.chip')].find((c) => /hendelse/.test(c.textContent));
    if (!chip) return { chip: false };
    history.replaceState(null, '', location.pathname); chip.click(); await new Promise((q) => setTimeout(q, 300));
    return { chip: true, hash: location.hash, pointer: getComputedStyle(chip).cursor };
  });
  ok(name, r.chip && r.hash === '#kalender' && r.pointer === 'pointer', r);
};
await run('standard-prosa: hendelser → #kalender', null);
await run('lagret setning uten «Ved trykk» → #kalender', [P5]);
await run('lagret setning med gammel more-info → #kalender', [{ ...P5, tap: { action: 'more-info' } }]);
ok('ingen JS-feil', !errs.length, errs);
await browser.close();
try { unlinkSync(bundle); } catch (e) {}
console.log(res.join('\n'));
if (res.some((l) => l.startsWith('✘'))) { console.log('\nFEIL'); process.exit(1); } else console.log('\nAlt OK');
