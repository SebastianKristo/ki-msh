// Fiks 20.10 · Strømpriser «I morgen»: bytter til morgendagens kurve (med data), viser «kommer ca. kl. 13:00» (uten data),
// valget holder seg ved hass-oppdateringer, og trykket når frem (elementFromPoint = knappen). Kjøres mot test/harness.html.
import { createRequire } from 'node:module';
import { readdirSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync(resolve('test/.build'), { recursive: true });
const bundle = resolve(`test/.build/strompris-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const fails = [];
const ok = (c, msg) => { if (!c) fails.push(msg); };

const page = async (cfg, touch) => {
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: !!touch });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + resolve('test/harness.html'));
  for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
  await p.addScriptTag({ path: bundle });
  await p.evaluate(async (cfg) => {
    try { localStorage.clear(); } catch (e) { /* */ }
    const h = window.mockHass(); window.__h = h;
    const el = document.createElement('msh-strompris-card');
    el.setConfig({ type: 'custom:msh-strompris-card', card_id: 'strom_test', ...cfg });
    el.hass = h;
    document.getElementById('dash').appendChild(el);
    window.__c = el;
    await new Promise((q) => setTimeout(q, 500));
  }, cfg);
  return { p, errs };
};
const st = (p) => p.evaluate(() => {
  const r = window.__c.shadowRoot, t = r.querySelector('.sg[data-d="tomorrow"]');
  return {
    label: (r.querySelector('.vc .lb') || {}).textContent, tmrOn: t && t.classList.contains('on'), tmrDis: t && t.disabled,
    note: (r.querySelector('.tmr-note') || {}).textContent || '', dot: !!r.querySelector('.dot'), path: !!r.querySelector('path.spot'),
  };
});
// Ekte trykk midt på knappen (mus eller touch) – sjekker også at ingenting ligger over knappen
const tapTomorrow = async (p, touch) => {
  const pt = await p.evaluate(() => {
    const t = window.__c.shadowRoot.querySelector('.sg[data-d="tomorrow"]'), r = t.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    let hit = document.elementFromPoint(x, y); while (hit && hit.shadowRoot && hit.shadowRoot.elementFromPoint(x, y) && hit.shadowRoot.elementFromPoint(x, y) !== hit) hit = hit.shadowRoot.elementFromPoint(x, y);
    return { x, y, hit: hit === t };
  });
  ok(pt.hit, 'elementFromPoint treffer ikke «I morgen»-knappen');
  if (touch) await p.touchscreen.tap(pt.x, pt.y); else await p.mouse.click(pt.x, pt.y);
  await p.waitForTimeout(300);
};
const bump = (p) => p.evaluate(async () => {
  // ny hass (som HA ved hver state-endring) – også endring på pris-sensoren
  const h = window.__h, s = { ...h.states }, id = 'sensor.nordpool_kwh';
  s[id] = { ...s[id], last_updated: new Date().toISOString() };
  window.__h = { ...h, states: s }; window.__c.hass = window.__h;
  await new Promise((q) => setTimeout(q, 150));
  window.__h = { ...window.__h, states: { ...window.__h.states } }; window.__c.hass = window.__h;
  await new Promise((q) => setTimeout(q, 300));
});

/* 1 · med morgendagens priser (Nord Pool, raw_tomorrow) – mus og touch */
for (const touch of [false, true]) {
  const { p, errs } = await page({}, touch);
  const a = await st(p);
  ok(/nå$/.test(a.label || '') && !a.tmrOn, `[${touch ? 'touch' : 'mus'}] start ikke «I dag»: ` + JSON.stringify(a));
  await tapTomorrow(p, touch);
  const b1 = await st(p);
  ok(b1.tmrOn && /snitt i morgen/.test(b1.label || ''), `[${touch ? 'touch' : 'mus'}] byttet ikke til i morgen: ` + JSON.stringify(b1));
  ok(!b1.dot, 'i morgen: «nå»-markør vises');
  await bump(p);
  const c1 = await st(p);
  ok(c1.tmrOn && /snitt i morgen/.test(c1.label || ''), 'i morgen nullstilt av hass-oppdatering: ' + JSON.stringify(c1));
  // scrub på grafen → «… i morgen kl. 14–15»
  const bx = await p.evaluate(() => { const r = window.__c.shadowRoot.querySelector('.plot').getBoundingClientRect(); return { x: r.left + r.width * (14.5 / 24), y: r.top + r.height / 2 }; });
  if (!touch) {
    await p.mouse.move(bx.x, bx.y); await p.waitForTimeout(250);
    const s2 = await st(p);
    ok(/^I morgen kl\. 14–15$/.test(s2.label || ''), 'scrub i morgen: ' + s2.label);
    await p.mouse.move(bx.x, bx.y - 400); await p.waitForTimeout(250);
  }
  ok(!errs.length, 'feil: ' + errs.join(' | '));
  await p.close();
}

/* 2 · uten morgendagens priser (før kl. 13): knappen virker, tom graf + «kommer ca. kl. 13:00», og data kommer live */
{
  const { p, errs } = await page({ entity: 'sensor.strompris_uten_morgen' });
  const a = await st(p);
  ok(!a.tmrDis, '«I morgen» er deaktivert uten data');
  await tapTomorrow(p, false);
  const b1 = await st(p);
  ok(b1.tmrOn && /kommer ca\. kl\. 13:00/.test(b1.note) && !b1.path && !b1.dot, 'uten data: ' + JSON.stringify(b1));
  await bump(p);
  ok((await st(p)).tmrOn, 'uten data: valget nullstilt ved hass-oppdatering');
  // dataene kommer (Nord Pool publiserer) → oppdateres live i samme visning
  await p.evaluate(async () => {
    const h = window.__h, s = { ...h.states }, id = 'sensor.strompris_uten_morgen';
    // 15-minuttspriser (96 punkter) → snitt per time i grafen
    const q = []; s['sensor.nordpool_kwh'].attributes.tomorrow.forEach((v) => { for (let i = 0; i < 4; i++) q.push(v); });
    s[id] = { ...s[id], attributes: { ...s[id].attributes, tomorrow: q, tomorrow_valid: true } };
    window.__h = { ...h, states: s }; window.__c.hass = window.__h;
    await new Promise((q) => setTimeout(q, 400));
  });
  const c1 = await st(p);
  ok(c1.tmrOn && c1.path && !c1.note && /snitt i morgen/.test(c1.label || ''), 'data kom ikke live: ' + JSON.stringify(c1));
  const r1 = await p.evaluate(() => (window.__c.shadowRoot.querySelector('.vc.r .lb') || {}).textContent);
  ok(/^Billigst kl\. \d\d–\d\d$/.test(r1 || ''), 'i morgen: «Billigst kl. …» mangler: ' + r1);
  ok(!errs.length, 'feil: ' + errs.join(' | '));
  await p.close();
}

await b.close();
if (fails.length) { console.log('FEIL:\n- ' + fails.join('\n- ')); process.exit(1); }
console.log('strompris-check: OK');
