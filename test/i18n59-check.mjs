// Fiks 59 · språk (norsk / engelsk):
//  L1 · API: kiLang/kiSetLang/kiT, <html lang>, localStorage 'ki-lang', eventet 'ki-lang', storage-synk mellom faner
//  L2 · bytte til engelsk uten omlasting: Hjem, navbar, Rom, Klima, Lys, Vær, Tilpass-ark og toast oversettes
//  L3 · tilbake til norsk: all tekst er identisk med originalen (dyp tekst i alle shadow roots)
//  L4 · lengre engelske tekster bryter ikke layouten (ingen vannrett scroll, navbar-knapper innenfor)
//  L5 · onboarding: første steg «Språk / Language», valget gjelder straks; Tilpass Hjem har raden «Språk · Language»
//  L6 · HA-språk som standard (hass.language 'en' uten eget valg → engelsk; 'nb' → norsk)
//  L7 · ingen konsollfeil; rapporterer gjenværende norske tekster (MSH.i18n.missing) uten å feile
// Kjør: node test/i18n59-check.mjs   (I18N_MISSING=<fil> skriver manglende tekster til fil)
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { readdirSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const R = resolve('.') + '/';
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/i18n-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle], { cwd: R, stdio: 'inherit' });
const mocks = readdirSync(R + 'test/mock').filter((f) => f.endsWith('.js')).sort().map((f) => R + 'test/mock/' + f);
const browser = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => pw.chromium.launch());
let fails = 0;
const ok = (c, msg) => { console.log((c ? '✔ ' : '✘ ') + msg); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('l59')) { sessionStorage.setItem('l59', '1'); localStorage.removeItem('ki-lang'); } } catch (e) { /* */ } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/net::ERR|fonts\.googleapis/.test(m.text())) errs.push(m.text()); });
await page.goto('file://' + R + 'test/harness.html');
for (const m of mocks) await page.addScriptTag({ path: m });
await page.addScriptTag({ path: bundle });
await page.evaluate(async () => {
  const hass = window.mockHass(); hass.language = 'nb'; window.__H = hass;
  const add = (tag, cfg) => { const el = document.createElement(tag); el.setConfig({ type: 'custom:' + tag, ...cfg }); el.hass = hass; document.getElementById('dash').appendChild(el); return el; };
  window.__els = [add('msh-hjem-card', { card_id: 'hj' }), add('msh-navbar-card', { card_id: 'nb' }), add('msh-rom-card', { card_id: 'r1', area: 'stue' }), add('msh-klima-card', { card_id: 'k1' }), add('msh-lys-card', { card_id: 'l1' }), add('msh-vaer-card', { card_id: 'v1' })];
  await new Promise((r) => setTimeout(r, 1200));
  // Dyp tekst: alle tekstnoder og title/placeholder/aria-label i alle shadow roots under et element
  window.__deep = (root) => {
    const out = [];
    const walk = (n) => {
      if (!n) return;
      if (n.nodeType === 3) { const t = n.nodeValue.trim(); if (t) out.push(t); return; }
      if (n.nodeType === 1) {
        if (/^(STYLE|SCRIPT)$/.test(n.tagName)) return;
        ['title', 'placeholder', 'aria-label'].forEach((a) => { const v = n.getAttribute && n.getAttribute(a); if (v) out.push('@' + v); });
        if (n.shadowRoot) walk(n.shadowRoot);
      }
      n.childNodes && n.childNodes.forEach(walk);
    };
    walk(root);
    return out;
  };
});
// L6: HA-språk som standard
const l6 = await page.evaluate(() => { const M = window.MSH; const a = M.i18n.lang(); M.i18n.fromHass({ language: 'en' }); const b = M.i18n.lang(); M.i18n.fromHass({ language: 'nb' }); const c = M.i18n.lang(); return { a, b, c }; });
ok(l6.a === 'no' && l6.b === 'en' && l6.c === 'no', `L6 · HA-språk som standard (nb → ${l6.a}, en → ${l6.b}, nb → ${l6.c})`);
const before = await page.evaluate(() => window.__deep(document.getElementById('dash')));
// L1 + L2: bytt til engelsk
const l1 = await page.evaluate(async () => {
  let ev = null; window.addEventListener('ki-lang', (e) => { ev = e.detail.lang; }, { once: true });
  window.kiSetLang('en');
  await new Promise((r) => setTimeout(r, 400));
  return { lang: window.kiLang(), html: document.documentElement.lang, ls: localStorage.getItem('ki-lang'), ev, t1: window.kiT('Norsk', 'English'), t2: window.kiT('Avbryt'), t3: window.kiT('Lukk') };
});
ok(l1.lang === 'en' && l1.html === 'en' && l1.ls === 'en' && l1.ev === 'en' && l1.t1 === 'English' && l1.t2 === 'Cancel' && l1.t3 === 'Close', 'L1 · API: ' + JSON.stringify(l1));
const after = await page.evaluate(() => window.__deep(document.getElementById('dash')));
const changed = after.filter((t, i) => t !== before[i]).length;
const has = (arr, re) => arr.some((t) => re.test(t));
ok(changed > 40 && has(after, /^Living room$|Lights|Climate|Weather|Bedroom/) && !has(after, /^(Tilpass|Stue|Soverom|Klima)$/), `L2 · kortene er oversatt uten omlasting (${changed} tekster endret)`);
// Tilpass-ark (overlegg) og toast
const l2b = await page.evaluate(async () => {
  window.dispatchEvent(new CustomEvent('ki-open-editor', { detail: { editor: 'home' } }));
  await new Promise((r) => setTimeout(r, 700));
  const P = window.MSH.portals(), sr = P[P.length - 1] && P[P.length - 1].shadowRoot;
  const txt = sr ? window.__deep(sr).join(' | ') : '';
  window.MSH.toast('Lagret');
  await new Promise((r) => setTimeout(r, 200));
  const toast = window.__deep(window.MSH.overlayRoot()).filter((t) => /Saved|Lagret/.test(t));
  const row = sr && sr.querySelector('.ki-lrow') ? sr.querySelector('.ki-lrow').textContent : '';
  P.forEach((p) => p.remove());
  return { txt: txt.slice(0, 400), customize: /Customize/.test(txt), cancel: /Cancel/.test(txt), toast, row };
});
ok(l2b.customize && l2b.cancel, 'L2 · «Tilpass Hjem»-arket på engelsk: ' + l2b.txt.slice(0, 120));
ok(l2b.toast.includes('Saved'), 'L2 · toast oversatt: ' + JSON.stringify(l2b.toast));
ok(/Språk · Language/.test(l2b.row) && /English/.test(l2b.row), 'L5 · «Tilpass Hjem» har raden «Språk · Language» (språknavn på eget språk): ' + l2b.row);
// L4: layout
const l4 = await page.evaluate(() => {
  const ovf = document.documentElement.scrollWidth > window.innerWidth + 1;
  const nb = document.querySelector('msh-navbar-card');
  const portal = nb && (nb.querySelector('.msh-navbar-portal') || document.querySelector('.msh-navbar-portal'));
  const nav = portal && portal.shadowRoot && portal.shadowRoot.querySelector('nav');
  let navOk = true;
  if (nav) { const r = nav.getBoundingClientRect(); nav.querySelectorAll('.it').forEach((b) => { const q = b.getBoundingClientRect(); if (q.left < r.left - 1 || q.right > r.right + 1) navOk = false; }); }
  // tekst som flyter ut av knapper/chips (scrollWidth > clientWidth uten ellipsis)
  const bad = [];
  const walk = (root) => root.querySelectorAll('button, .ch, .chip, .pl').forEach((b) => { const cs = getComputedStyle(b); if (b.offsetParent && (b.textContent || '').trim().length > 1 && b.scrollWidth > b.clientWidth + 2 && cs.overflow !== 'hidden' && cs.textOverflow !== 'ellipsis') bad.push((b.textContent || '').trim().slice(0, 30)); });
  const all = (n) => { if (n.shadowRoot) { walk(n.shadowRoot); n.shadowRoot.querySelectorAll('*').forEach(all); } };
  document.querySelectorAll('#dash *').forEach(all);
  return { ovf, navOk, bad: bad.slice(0, 10), n: bad.length };
});
ok(!l4.ovf && l4.navOk, `L4 · ingen vannrett scroll, navbar-knapper innenfor navbaren`);
ok(l4.n <= 3, `L4 · knapper/chips som flyter over: ${l4.n} ${JSON.stringify(l4.bad)}`);
// L3: tilbake til norsk
await page.evaluate(async () => { window.kiSetLang('no'); await new Promise((r) => setTimeout(r, 400)); });
const back = await page.evaluate(() => window.__deep(document.getElementById('dash')));
const diff = back.map((t, i) => (t !== before[i] ? [before[i], t] : null)).filter(Boolean).filter(([a, b]) => !/\d/.test(a + b)); // klokke/live-tall kan endre seg
ok(back.length === before.length && diff.length === 0, `L3 · tilbake til norsk: originalteksten (${back.length} tekster, ${diff.length} avvik) ${JSON.stringify(diff.slice(0, 3))}`);
ok((await page.evaluate(() => document.documentElement.lang)) === 'nb', 'L3 · <html lang="nb">');
// L1: storage-synk mellom faner
const st = await page.evaluate(async () => { localStorage.setItem('ki-lang', 'en'); window.dispatchEvent(new StorageEvent('storage', { key: 'ki-lang', newValue: 'en' })); await new Promise((r) => setTimeout(r, 200)); const a = window.kiLang(); window.kiSetLang('no'); return a; });
ok(st === 'en', 'L1 · storage-eventet fra en annen fane bytter språk');
// L5: onboarding (Fiks 61.2: veiviseren v2 – første steg Språk)
const ob = await page.evaluate(async () => {
  window.MSH.openOnboarding({ step: 0 }); await new Promise((r) => setTimeout(r, 400));
  const P = window.MSH.portals(), sr = P[P.length - 1].shadowRoot;
  const t0 = sr.querySelector('.hd b').textContent;
  sr.querySelector('[data-a="lang"][data-v="en"]').click(); await new Promise((r) => setTimeout(r, 300));
  const on = sr.querySelector('.lch.on').dataset.v, next = sr.querySelector('.nx').textContent.trim(), lang = window.kiLang(), t1 = sr.querySelector('.hd b').textContent;
  sr.querySelector('[data-a="lang"][data-v="no"]').click(); await new Promise((r) => setTimeout(r, 200));
  const next2 = sr.querySelector('.nx').textContent.trim();
  P.forEach((p) => p.remove());
  return { t0, t1, on, next, lang, next2 };
});
ok(ob.t0 === 'Språk' && ob.t1 === 'Language' && ob.on === 'en' && ob.lang === 'en' && ob.next === 'Next' && ob.next2 === 'Neste', 'L5 · onboarding: første steg Språk, valget gjelder straks (' + JSON.stringify(ob) + ')');
ok(!errs.length, 'L7 · ingen konsollfeil' + (errs.length ? ' ' + JSON.stringify(errs.slice(0, 3)) : ''));
const miss = await page.evaluate(() => [...window.MSH.i18n.missing]);
console.log(`  (gjenværende tekster uten oversettelse i disse kortene: ${miss.length})`);
if (process.env.I18N_MISSING) writeFileSync(process.env.I18N_MISSING, JSON.stringify(miss, null, 1));
await browser.close();
try { unlinkSync(bundle); } catch (e) { /* */ }
console.log(fails ? `\n${fails} feil` : '\nAlle bestod');
process.exit(fails ? 1 : 0);
