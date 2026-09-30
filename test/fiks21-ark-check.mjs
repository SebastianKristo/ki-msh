// Fiks 21.7 · Tilpass-ark: ingen rad klippes, ingen akkordeon med egen scroll, søkeresultater i flyten (maks 6 treff).
// Åpner «Tilpass rom» (MSH.openEditor → MSH.overlay) på mobil og PC, legger til 10+ entiteter i Lys/Enheter/Sensorer (og
// noen i Andre) via søkefeltet og sjekker etter hver: rader innenfor alle foreldres synlige flate (getBoundingClientRect),
// ingen indre scroll (bortsett fra arket), søkefeltet synlig i arket etter «Legg til».
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readdirSync, mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/fiks21ark-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const shots = process.env.SHOTS || '';
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
let fail = 0;
for (const [vpName, vp, touch] of [['mobil', { width: 390, height: 844 }, true], ['pc', { width: 1280, height: 900 }, false]]) {
  const p = await b.newPage({ viewport: vp, hasTouch: touch });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + resolve('test/harness.html'));
  for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
  await p.addScriptTag({ path: bundle });
  if (shots) await p.exposeFunction('__shot', (n) => p.screenshot({ path: `${shots}/fiks21-ark-${vpName}-${n}.png` }));
  // OLD=1: gammel dropdown-CSS (absolutt, max-height + egen scroll) – testen skal da feile (kontroll av testen)
  if (process.env.OLD) await p.evaluate(() => { window.__old = '.menu{position:absolute;left:0;right:0;top:44px;z-index:5;max-height:260px;overflow:auto}'; });
  const out = await p.evaluate(async () => {
    const wait = (ms) => new Promise((q) => setTimeout(q, ms));
    const hass = window.mockHass();
    const add = (id, state, attributes) => { hass.states[id] = { entity_id: id, state, attributes: { friendly_name: id.split('.')[1].replace(/_/g, ' '), ...attributes }, last_changed: new Date().toISOString(), last_updated: new Date().toISOString(), context: {} }; hass.entities[id] = { entity_id: id, platform: 'demo', area_id: null, device_id: null }; };
    for (let i = 1; i <= 14; i++) {
      add(`light.ekstra_lampe_${i}`, 'on', { brightness: 120 });
      add(`switch.ekstra_bryter_${i}`, 'off', {});
      add(`sensor.ekstra_sensor_${i}`, String(20 + i), { unit_of_measurement: '°C', device_class: 'temperature' });
      add(`cover.ekstra_gardin_${i}`, 'open', {});
    }
    const dash = document.getElementById('dash');
    const r = document.createElement('msh-rom-card');
    r.setConfig({ type: 'custom:msh-rom-card', card_id: 'f21', area: 'stue' });
    r.hass = hass; dash.appendChild(r);
    await wait(300);
    const ui = r.customize('entities');
    await wait(500);
    const host = ui.overlay.host, sh = ui.overlay.root.querySelector('.sh'), ed = ui.editor, E = ed.shadowRoot;
    const res = { steps: [], bad: [] };
    const OK_SCROLL = (el) => el === sh || (el.classList && (el.classList.contains('chips') || el.classList.contains('menu') && el.classList.contains('sc') || el.classList.contains('fl')));
    const parentOf = (n) => n.parentElement || (n.parentNode && n.parentNode.host) || null;
    const lbl = (el) => (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : el.tagName) + ':' + (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 30);
    // rader: alle synlige rader/felt i editoren
    const ROWS = '.ent,.f,.fsec,.sec,.fsh,.menu,.menu button,.menu .more,.dd .inp,.chips.sg,.ordrow';
    const check = (tag) => {
      const bad = [];
      const shR = sh.getBoundingClientRect();
      E.querySelectorAll(ROWS).forEach((el) => {
        const r0 = el.getBoundingClientRect();
        if (!r0.height || el.closest('details:not([open]) > .in')) return;
        // klippet: høyden er mindre enn innholdet (krympet rad)
        if (el.scrollHeight > el.clientHeight + 1 && getComputedStyle(el).overflowY !== 'visible' && !OK_SCROLL(el)) bad.push(`${tag} krympet/klippet ${lbl(el)} ${el.clientHeight}<${el.scrollHeight}`);
        for (let a = parentOf(el); a && a !== sh && a !== host; a = parentOf(a)) {
          if (a.nodeType !== 1) continue;
          const cs = getComputedStyle(a);
          if (cs.overflowY === 'visible' && cs.overflowX === 'visible') continue;
          const ra = a.getBoundingClientRect();
          if (r0.top < ra.top - 1 || r0.bottom > ra.bottom + 1) { bad.push(`${tag} ${lbl(el)} utenfor ${lbl(a)} (${Math.round(r0.bottom)}>${Math.round(ra.bottom)})`); break; }
        }
      });
      // ingen indre scroll: bare arket (og vannrette segment/chip-rader)
      [sh, ...sh.querySelectorAll('*'), ...E.querySelectorAll('*')].forEach((el) => {
        if (OK_SCROLL(el)) return;
        const cs = getComputedStyle(el);
        if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1) bad.push(`${tag} indre scroll ${lbl(el)} ${el.clientHeight}/${el.scrollHeight}`);
      });
      // akkordeoner/kort (.sec) har aldri skjult innhold
      E.querySelectorAll('.sec').forEach((s) => { if (s.getBoundingClientRect().height && s.scrollHeight > s.clientHeight + 1) bad.push(`${tag} akkordeon klipper ${lbl(s)} ${s.clientHeight}/${s.scrollHeight}`); });
      if (sh.scrollWidth > sh.clientWidth + 1) bad.push(`${tag} vannrett scroll i arket`);
      return bad;
    };
    const click = async (el) => { el.click(); await wait(120); };
    await click(E.querySelector('.chips.sg.tabs .chip[data-v="ent"]'));
    const PLAN = [['lys', 'lys', 'ekstra_lampe', 12], ['dev', 'enheter', 'ekstra_bryter', 11], ['sens', 'sensorer', 'ekstra_sensor', 10], ['andre', 'gardiner', 'ekstra_gardin', 4]];
    for (const [sub, key, q, n] of PLAN) {
      await click(E.querySelector(`.chips.sg.tsub .chip[data-v="${sub}"]`));
      for (let i = 0; i < n; i++) {
        // søkefeltet i synlighetskortet for listen
        const inp = E.querySelector(`.tpane input[data-act="include"][data-name="${key}"]`);
        if (window.__old && !E.__old) { const st = new CSSStyleSheet(); st.replaceSync(window.__old); E.adoptedStyleSheets = [...E.adoptedStyleSheets, st]; E.__old = 1; }
        if (!inp) { res.bad.push(`${sub}: fant ikke søkefelt`); break; }
        inp.focus(); await wait(60);
        const cur = E.querySelector(`input[data-search="${inp.dataset.search}"]`);
        cur.value = q; cur.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        await wait(120);
        const menu = E.querySelector('.menu'), hits = menu ? menu.querySelectorAll('button[data-a="include"]').length : 0;
        if (window.__shot && i === n - 1 && sub === 'lys') { await wait(50); await window.__shot('lys-sok'); }
        if (i === 0) res.steps.push({ sub, hits, more: menu && menu.querySelector('.more') ? menu.querySelector('.more').textContent : '' });
        if (hits > 6) res.bad.push(`${sub}: ${hits} treff (maks 6)`);
        res.bad.push(...check(`${sub}#${i} søk`));
        const btn = menu && menu.querySelector('button[data-a="include"]:not(.addq)');
        if (!btn) { res.bad.push(`${sub}#${i}: ingen treff`); break; }
        // treffet skal kunne trykkes: helt innenfor arkets synlige flate etter scroll
        btn.scrollIntoView({ block: 'nearest' }); await wait(30);
        await click(btn); await wait(120);
        res.bad.push(...check(`${sub}#${i} lagt til`));
        // etter «Legg til»: søkefeltet tomt og synlig mellom sticky tittel og bunnlinje
        const ni = E.querySelector(`input[data-search="${inp.dataset.search}"]`);
        const rI = ni.getBoundingClientRect(), rS = sh.getBoundingClientRect();
        const ttl = E.querySelector('.ttl').getBoundingClientRect(), act = E.querySelector('.actions') ? E.querySelector('.actions').getBoundingClientRect() : { top: sh.getBoundingClientRect().bottom }; // Fiks 26: Ferdig i headeren, ingen bunnlinje
        const m2 = E.querySelector('.menu button'); if (m2) { const rm = m2.getBoundingClientRect(); if (rm.bottom > Math.min(rS.bottom, act.top) + 1) res.bad.push(`${sub}#${i}: første treff under bunnlinjen`); }
        if (ni.value) res.bad.push(`${sub}#${i}: søkefeltet ikke tømt`);
        if (rI.top < Math.max(rS.top, ttl.bottom) - 1 || rI.bottom > Math.min(rS.bottom, act.top) + 1) res.bad.push(`${sub}#${i}: søkefeltet utenfor synlig flate (${Math.round(rI.top)}–${Math.round(rI.bottom)} vs ${Math.round(ttl.bottom)}–${Math.round(act.top)})`);
      }
      const inc = (ed._config.include || {});
      res.steps.push({ sub, include: Object.fromEntries(Object.entries(inc).map(([k, v]) => [k, v.length])), rows: E.querySelectorAll('.tpane .ent').length, sheetScroll: sh.scrollHeight > sh.clientHeight });
      // lukk menyen (trykk utenfor) og sjekk en gang til
      E.querySelector('.ttl').click(); await wait(100);
      res.bad.push(...check(`${sub} ferdig`));
    }
    // Tilpass rom → alle andre faner (Oppsett/Klima/Kort) + åpne alle akkordeoner
    for (const t of ['oppsett', 'klima', 'kort']) {
      await click(E.querySelector(`.chips.sg.tabs .chip[data-v="${t}"]`));
      E.querySelectorAll('details.sec').forEach((d) => { d.open = true; }); await wait(150);
      res.bad.push(...check(t));
    }
    res.overlayBody = getComputedStyle(ui.overlay.body).display;
    res.bad = [...new Set(res.bad)];
    return res;
  });
  if (shots) await p.screenshot({ path: `${shots}/fiks21-ark-${vpName}.png` });
  console.log(vpName, JSON.stringify(out.steps), 'body:', out.overlayBody);
  if (out.bad.length) { fail++; console.log(`FEIL (${vpName}):\n  ` + out.bad.slice(0, 40).join('\n  ')); }
  if (errs.length) { fail++; console.log('pageerrors', errs); }
  await p.close();
}
await b.close();
console.log(fail ? 'fiks21-ark: FEIL' : 'fiks21-ark: OK');
process.exit(fail ? 1 : 0);
