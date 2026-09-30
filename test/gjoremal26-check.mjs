// Fiks 26.19 · Gjøremål (#gjoremal, msh-gjoremal-card): rediger på stedet (todo.update_item rename, Enter/Shift+Enter/Esc),
// merkbar tekst (user-select: text), kopier per rad (hake i 1,4 s) og «Kopier» for den synlige lista.
//   node test/gjoremal26-check.mjs   (SHOTS=<mappe> for skjermbilder)
import { createRequire } from 'node:module';
import { readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const bundle = resolve(`test/.build/gjoremal26-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const shots = process.env.SHOTS || '';
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = {}, fail = [], errs = [];
const ok = (name, cond, info) => { res[name] = cond ? 'OK' : ['FEIL', info]; if (!cond) fail.push(name); };
const mocks = readdirSync('test/mock').filter((f) => f.endsWith('.js')).sort().map((m) => resolve('test/mock/' + m));

const p = await b.newPage({ viewport: { width: 400, height: 900 }, hasTouch: true });
p.on('pageerror', (e) => errs.push(e.message));
await p.goto('file://' + resolve('test/harness.html'));
for (const m of mocks) await p.addScriptTag({ path: m });
await p.addScriptTag({ path: bundle });
await p.evaluate(async () => {
  // Utklippstavle: fang writeText (file:// har ikke alltid tilgang)
  window.__clip = [];
  try { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: (t) => { window.__clip.push(t); return Promise.resolve(); } } }); } catch (e) { /* */ }
  window.__hap = [];
  window.addEventListener('haptic', (e) => window.__hap.push(e.detail));
  const h = window.mockHass(); window.__h = h;
  const bc = document.createElement('bubble-card');
  bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash: '#gjoremal' });
  bc.innerHTML = '<div class="pop"><div class="hdr">Gjøremål</div><div class="inner"></div></div>';
  document.getElementById('dash').appendChild(bc);
  location.hash = '#gjoremal';
  const c = document.createElement('msh-gjoremal-card');
  c.setConfig({ type: 'custom:msh-gjoremal-card', card_id: 'pop-gjoremal', entities: ['todo.prosjekter'] });
  c.hass = h;
  bc.querySelector('.inner').appendChild(c);
  window.__c = c;
  await new Promise((q) => setTimeout(q, 600));
});
const wait = (ms) => p.evaluate((ms) => new Promise((q) => setTimeout(q, ms)), ms);
const q = (fn, arg) => p.evaluate(fn, arg);
const calls = () => q(() => window.__calls.filter((c) => c[0] === 'todo').slice());

let R = await q(() => { const sr = window.__c.shadowRoot, t = sr.querySelector('.it .t'); return { us: getComputedStyle(t).userSelect, rm: sr.querySelectorAll('.it [data-act="remove"]').length, cp: sr.querySelectorAll('.it [data-act="copy"]').length, rows: sr.querySelectorAll('.it').length, all: !!sr.querySelector('.flt [data-act="copyall"]') }; });
ok('teksten kan merkes (user-select: text)', R.us === 'text', R);
ok('kopier-knapp per rad erstatter × (ingen slett i raden)', R.cp === R.rows && R.rows === 3 && R.rm === 0, R);
ok('«Kopier» ved filtrene', R.all, R);

// kopier én rad → hake i 1,4 s, én haptic
await q(() => { window.__hap.length = 0; window.__c.shadowRoot.querySelector('.it[data-key="p2"] [data-act="copy"]').click(); });
await wait(150);
R = await q(() => ({ clip: window.__clip.slice(-1)[0], hake: window.__c.shadowRoot.querySelector('.it[data-key="p2"] [data-act="copy"] ha-icon').getAttribute('icon'), hap: window.__hap.slice() }));
ok('kopier per rad → utklippstavle + hake + én haptic(light)', R.clip === 'VVB må ordnes, står bare på i 50 min' && R.hake === 'mdi:check' && R.hap.length === 1 && R.hap[0] === 'light', R);
await wait(1500);
R = await q(() => window.__c.shadowRoot.querySelector('.it[data-key="p2"] [data-act="copy"] ha-icon').getAttribute('icon'));
ok('haken går tilbake etter 1,4 s', R === 'mdi:content-copy', R);

// kopier synlig liste
await q(() => window.__c.shadowRoot.querySelector('[data-act="copyall"]').click());
await wait(150);
R = await q(() => window.__clip.slice(-1)[0]);
ok('«Kopier» = synlig liste som «- [ ] tekst (Prioritet, Person)»', R === '- [ ] VVB må ordnes, står bare på i 50 min (Høy, Rune)\n- [ ] Legg til expand under menyer for servere og panelovner (Medium, Sebastian)\n- [ ] Legg til innstillinger for autolås (Lav)', R);

// fallback execCommand når clipboard mangler
R = await q(async () => {
  const old = navigator.clipboard; Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
  let brukt = 0; const ex = document.execCommand; document.execCommand = (c) => { if (c === 'copy') brukt++; return true; };
  window.__c.shadowRoot.querySelector('.it[data-key="p1"] [data-act="copy"]').click(); await new Promise((r) => setTimeout(r, 100));
  document.execCommand = ex; Object.defineProperty(navigator, 'clipboard', { configurable: true, value: old });
  return brukt;
});
ok('reserve: execCommand(\'copy\') uten navigator.clipboard', R === 1, R);

// trykk på teksten → redigering på stedet
await q(() => window.__c.shadowRoot.querySelector('.it[data-key="p1"] .t').click());
await wait(200);
R = await q(() => { const sr = window.__c.shadowRoot, ta = sr.querySelector('textarea[data-input="edtext"]'); return ta ? { v: ta.value, fokus: sr.activeElement === ta, kant: getComputedStyle(ta).boxShadow, knapper: [...sr.querySelectorAll('.it.red .ea button')].map((b) => b.textContent.trim()) } : null; });
ok('trykk på teksten åpner tekstfelt med rosa kant (fokus) + prioritet, Kopier, Slett, Avbryt, Lagre', R && R.v === 'Legg til expand under menyer for servere og panelovner' && R.fokus && /242, 133, 201/.test(R.kant) && R.knapper.join('|') === 'Medium|Kopier|Slett|Avbryt|Lagre', R);
if (shots) await p.screenshot({ path: `${shots}/gj-rediger.png` });
// tekstfeltet stopper pointerdown/touchmove
R = await q(() => { let n = 0; const spy = () => n++; const host = window.__c; host.addEventListener('pointerdown', spy); host.addEventListener('touchmove', spy);
  const ta = host.shadowRoot.querySelector('textarea[data-input="edtext"]');
  ta.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
  try { const t = new Touch({ identifier: 1, target: ta, clientX: 5, clientY: 5 }); ta.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, composed: true, touches: [t] })); } catch (e) { /* */ }
  host.removeEventListener('pointerdown', spy); host.removeEventListener('touchmove', spy); return n; });
ok('tekstfeltet stopper pointerdown/touchmove (popupen lukkes ikke)', R === 0, R);
// Shift+Enter = ny linje, Enter = lagre
await p.focus('msh-gjoremal-card >>> textarea[data-input="edtext"]').catch(() => {});
await p.keyboard.press('End');
await p.keyboard.type(' nå');
await p.keyboard.press('Shift+Enter');
await p.keyboard.type('linje 2');
R = await q(() => { const ta = window.__c.shadowRoot.querySelector('textarea[data-input="edtext"]'); return ta && ta.value; });
ok('Shift+Enter gir ny linje', /nå\nlinje 2$/.test(R || ''), R);
await q(() => { window.__calls.length = 0; });
await p.keyboard.press('Enter');
await wait(200);
R = { c: await calls(), ed: await q(() => !!window.__c.shadowRoot.querySelector('textarea[data-input="edtext"]')), t: await q(() => window.__c.shadowRoot.querySelector('.it[data-key="p1"] .t').textContent) };
ok('Enter lagrer med todo.update_item (rename)', !R.ed && R.c.some((c) => c[1] === 'update_item' && c[2].item === 'p1' && c[2].rename === 'Legg til expand under menyer for servere og panelovner nå\nlinje 2') && /linje 2/.test(R.t), R);
// Esc avbryter
await q(() => window.__c.shadowRoot.querySelector('.it[data-key="p3"] .t').click());
await wait(150);
await p.keyboard.type(' endret');
await q(() => { window.__calls.length = 0; });
await p.keyboard.press('Escape');
await wait(150);
R = { c: await calls(), ed: await q(() => !!window.__c.shadowRoot.querySelector('textarea[data-input="edtext"]')), t: await q(() => window.__c.shadowRoot.querySelector('.it[data-key="p3"] .t').textContent) };
ok('Esc avbryter uten lagring', !R.ed && !R.c.length && R.t === 'Legg til innstillinger for autolås', R);
// prioritet i redigering + Lagre-knappen
await q(() => window.__c.shadowRoot.querySelector('.it[data-key="p3"] .t').click());
await wait(150);
await q(() => window.__c.shadowRoot.querySelector('[data-act="eprio"]').click());
await wait(80);
await q(() => { window.__calls.length = 0; window.__c.shadowRoot.querySelector('[data-act="esave"]').click(); });
await wait(150);
R = await calls();
ok('prioritet (trykk bytter) + Lagre → update_item med ny beskrivelse', R.some((c) => c[1] === 'update_item' && c[2].item === 'p3' && c[2].description === '[m]' && !c[2].rename), R);
// Slett ligger i redigeringsmodus
await q(() => window.__c.shadowRoot.querySelector('.it[data-key="p3"] .t').click());
await wait(150);
await q(() => { window.__calls.length = 0; window.__c.shadowRoot.querySelector('.it.red [data-act="remove"]').click(); });
await wait(150);
R = await calls();
ok('Slett i redigeringsmodus → todo.remove_item', R.some((c) => c[1] === 'remove_item' && c[2].item[0] === 'p3'), R);

await b.close();
try { (await import('node:fs')).unlinkSync(bundle); } catch (e) { /* */ }
console.log(JSON.stringify(res, null, 1));
if (errs.length) console.log('Sidefeil:', errs.slice(0, 5));
console.log(fail.length || errs.length ? `\n${fail.length} feilet${errs.length ? ` · ${errs.length} sidefeil` : ''}` : '\nAlle bestod');
process.exit(fail.length || errs.length ? 1 : 0);
