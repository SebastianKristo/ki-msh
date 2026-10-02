// Fiks 33.7 + 35.8 · Klima (#klima) mot ekte Bubble Card, mobil 390 px, mørk OG lys modus (uavhengig av dato/klokkeslett).
//  · «Tilpass klima» (fasit Klima v3 layOpen): 22 px mellom seksjonene, 8 px overskrift–kort, 8 px mellom kortene i én
//    seksjon (Faner: innstillingskort + fanelista), hjelpeteksten 8 px under kortet, kort r24, rader ≥ 60 px med 1 px
//    skillelinje, overskrift 12 px/500 uppercase .08em, toppkort-stil-rutenettet gap 6 px
//  · Fanestil Fylt / Kontur / Linje (layout.tab_look): spor --ki-surface (+ inset 1px .14 for Kontur), Linje = transparent
//    spor med bunnlinje og rosa understrek på aktiv fane; lagres via arket (Ferdig) og i GUI-editoren (schema)
//  · tannhjulet har samme høyde som sporet og er vertikalt sentrert mot fanelinja (alle stiler × Faner viser)
//  · lys modus: tokens (spor hvitt, tekst mørk) og tekstkontrast ≥ 4,5:1 i fanelinja og arket; mørk modus = dagens farger
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readdirSync, existsSync, mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const BC = resolve('test/.vendor/bubble-card.js');
mkdirSync(resolve('test/.vendor'), { recursive: true });
if (!existsSync(BC)) execFileSync('curl', ['-sSL', '-o', BC, 'https://raw.githubusercontent.com/Clooos/Bubble-Card/main/dist/bubble-card.js']);
mkdirSync(resolve('test/.build'), { recursive: true });
const bundle = resolve(`test/.build/klima33-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto('file://' + resolve('test/harness-bubble.html'));
for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
await p.addScriptTag({ path: bundle });
await p.addScriptTag({ path: BC, type: 'module' });
await p.waitForFunction(() => customElements.get('bubble-card'));
await p.evaluate(async () => {
  const wait = (ms) => new Promise((q) => setTimeout(q, ms));
  window.__hass = window.mockHass();
  window.__hass.themes = { ...(window.__hass.themes || {}), darkMode: true };
  const bc = document.createElement('bubble-card');
  bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash: '#klima', name: 'Klima', bg_color: '#282828', bg_opacity: 100, bg_blur: 0, cards: [{ type: 'custom:msh-klima-card', card_id: 'k33' }] });
  bc.hass = window.__hass; document.getElementById('dash').appendChild(bc);
  await wait(400);
  location.hash = '#klima'; await wait(1500);
  // Felles hjelpere i siden
  const all = () => { const o = []; const w = (r) => r.querySelectorAll('*').forEach((e) => { o.push(e); if (e.shadowRoot) w(e.shadowRoot); }); w(document); return o; };
  window.__K = () => all().find((e) => e.localName === 'msh-klima-card' && e.getBoundingClientRect().height > 0);
  // Effektiv bakgrunn: første ikke-gjennomsiktige bakgrunn oppover (også gjennom shadow roots)
  window.__bg = (el) => {
    for (let n = el; n; n = n.parentElement || (n.getRootNode && n.getRootNode().host)) {
      if (n.nodeType !== 1) continue;
      const c = getComputedStyle(n).backgroundColor, P = window.MSH.theme.parse(c);
      if (P && P[3] > 0.5) return c;
    }
    return getComputedStyle(document.documentElement).backgroundColor || 'rgb(255,255,255)';
  };
  window.__cr = (el) => { const c = getComputedStyle(el).color; return +window.MSH.theme.contrast(c, window.__bg(el)).toFixed(2); };
  window.__theme = async (light) => {
    window.__hass = { ...window.__hass, themes: { ...(window.__hass.themes || {}), darkMode: !light } };
    all().filter((e) => e.localName === 'bubble-card' || /^msh-/.test(e.localName)).forEach((e) => { try { e.hass = window.__hass; } catch (x) { /* */ } });
    window.MSH.theme.set(light ? 'light' : 'dark');
    await wait(500);
  };
});

const res = {};
const ok = (name, cond, info) => { res[name] = cond ? 'OK' : { FEIL: info }; };

// ---------- 1 · fanelinja: Fylt / Kontur / Linje × Faner viser, tannhjulet = sporets høyde, sentrert
const bar = await p.evaluate(async () => {
  const wait = (ms) => new Promise((q) => setTimeout(q, ms));
  const k = window.__K(), out = {};
  for (const look of ['fylt', 'kontur', 'linje']) {
    for (const st of ['both', 'text', 'icon']) {
      k.setConfig({ type: 'custom:msh-klima-card', card_id: 'k33', layout: { tab_look: look, tab_style: st } }); await wait(250);
      const R = k.shadowRoot, tb = R.querySelector('.tbox'), g = R.querySelector('.gear'), on = R.querySelector('.tabs>.tab.on'), off = R.querySelector('.tabs>.tab:not(.on)');
      const rt = tb.getBoundingClientRect(), rg = g.getBoundingClientRect(), cs = getComputedStyle(tb), co = getComputedStyle(on);
      out[look + '/' + st] = {
        trackH: Math.round(rt.height), gearH: Math.round(rg.height), gearW: Math.round(rg.width), dy: Math.abs((rt.top + rt.height / 2) - (rg.top + rg.height / 2)),
        bg: cs.backgroundColor, sh: cs.boxShadow, r: cs.borderRadius, onBg: co.backgroundImage, onSh: co.boxShadow, onR: co.borderRadius, offC: getComputedStyle(off).color,
        look: R.querySelector('.trow').dataset.look,
      };
    }
  }
  k.setConfig({ type: 'custom:msh-klima-card', card_id: 'k33' }); await wait(250);
  return out;
});
const B = Object.values(bar);
ok('35.8 · tannhjulet har samme høyde som sporet og er sirkel (alle stiler × Faner viser)', B.every((x) => Math.abs(x.gearH - x.trackH) <= 1 && x.gearW === x.gearH), bar);
ok('35.8 · tannhjulet er vertikalt sentrert mot fanelinja (≤ 1 px)', B.every((x) => x.dy <= 1), B.map((x) => x.dy));
ok('35.8 · Fylt: spor #3a3a3a, inset .05, r30, rosa aktiv', bar['fylt/both'].bg === 'rgb(58, 58, 58)' && /rgba\(255, 255, 255, 0\.05\)/.test(bar['fylt/both'].sh) && bar['fylt/both'].r === '30px' && /gradient/.test(bar['fylt/both'].onBg), bar['fylt/both']);
ok('35.8 · Kontur: spor --ki-surface (#3a3a3a) + inset 0 0 0 1px rgba(255,255,255,.14)', bar['kontur/both'].bg === 'rgb(58, 58, 58)' && /rgba\(255, 255, 255, 0\.14\) 0px 0px 0px 1px inset/.test(bar['kontur/both'].sh) && bar['kontur/both'].look === 'kontur', bar['kontur/both']);
ok('35.8 · Linje: transparent spor med bunnlinje, aktiv = rosa understrek (ingen pille)', bar['linje/both'].bg === 'rgba(0, 0, 0, 0)' && /0px -1px 0px 0px inset/.test(bar['linje/both'].sh) && bar['linje/both'].onBg === 'none' && /rgb\(242, 133, 201\) 0px -3px 0px 0px inset/.test(bar['linje/both'].onSh) && bar['linje/both'].onR === '0px', bar['linje/both']);
ok('35.8 · mørk: inaktiv fanetekst #979797 som før', bar['fylt/both'].offC === 'rgb(151, 151, 151)', bar['fylt/both'].offC);

// ---------- 2 · «Tilpass klima»: mellomrom målt (33.7)
const sheet = await p.evaluate(async () => {
  const wait = (ms) => new Promise((q) => setTimeout(q, ms));
  const k = window.__K();
  k.customize(); await wait(500);
  const ov = window.MSH.portals().pop(), R = ov.shadowRoot, box = R.querySelector('.klima-sheet');
  const rc = (e) => e.getBoundingClientRect();
  const secs = [...box.querySelectorAll('.secs > .sec')];
  const between = secs.slice(1).map((s, i) => Math.round(rc(s).top - rc(secs[i]).bottom));
  const inner = {};
  secs.forEach((s) => {
    const kids = [...s.children].filter((c) => rc(c).height > 0);
    inner[s.dataset.sec] = kids.slice(1).map((c, i) => [kids[i].className.split(' ')[0] + '→' + c.className.split(' ')[0], Math.round(rc(c).top - rc(kids[i]).bottom)]);
  });
  const cap = getComputedStyle(box.querySelector('.cap'));
  const grp = getComputedStyle(box.querySelector('.grp'));
  const rows = [...box.querySelectorAll('.grp > .r')].filter((r) => !r.classList.contains('col2') && !r.classList.contains('sp'));
  const second = box.querySelector('.grp > .r + .r');
  const fanerGrps = [...box.querySelectorAll('.sec[data-sec="faner"] > .grp')];
  const secsCs = getComputedStyle(box.querySelector('.secs'));
  return {
    n: secs.length, between, inner,
    cap: { fs: cap.fontSize, fw: cap.fontWeight, tt: cap.textTransform, ls: cap.letterSpacing, pad: cap.paddingLeft + ' ' + cap.paddingRight },
    grp: { r: grp.borderRadius }, minRow: Math.min(...rows.map((r) => Math.round(rc(r).height))), rowMinH: getComputedStyle(rows[0]).minHeight,
    line: second ? getComputedStyle(second).borderTopWidth + ' ' + getComputedStyle(second).borderTopColor : null,
    fanerGap: fanerGrps.length === 2 ? Math.round(rc(fanerGrps[1]).top - rc(fanerGrps[0]).bottom) : null,
    note: (() => { const n = box.querySelector('.sec[data-sec="faner"] > .note'); return { gap: Math.round(rc(n).top - rc(fanerGrps[1]).bottom), pad: getComputedStyle(n).paddingLeft }; })(),
    hsgGap: getComputedStyle(box.querySelector('.hsg')).columnGap,
    secsPad: secsCs.paddingTop + ' ' + secsCs.paddingBottom, secsGap: secsCs.rowGap,
    looks: [...box.querySelectorAll('[data-a="look"]')].map((x) => x.textContent.trim()),
    shows: [...box.querySelectorAll('[data-a="style"]')].map((x) => x.textContent.trim()),
  };
});
ok('33.7 · fire seksjoner med 22 px mellom (gap 22, padding 4/28)', sheet.n === 4 && sheet.between.every((x) => x === 22) && sheet.secsGap === '22px' && sheet.secsPad === '4px 28px', sheet);
ok('33.7 · 8 px overskrift–kort og mellom alle kort/hjelpetekst i hver seksjon (aldri 0)', Object.values(sheet.inner).every((l) => l.length && l.every(([, d]) => d === 8)), sheet.inner);
ok('33.7 · Faner: innstillingskortet og fanelista har 8 px mellom', sheet.fanerGap === 8, sheet.fanerGap);
ok('33.7 · hjelpeteksten står 8 px under fanelista, padding 0 6px', sheet.note.gap === 8 && sheet.note.pad === '6px', sheet.note);
ok('33.7 · overskrift 12 px/500 uppercase .08em, padding 0 6px', sheet.cap.fs === '12px' && sheet.cap.fw === '500' && sheet.cap.tt === 'uppercase' && Math.abs(parseFloat(sheet.cap.ls) - 0.96) < 0.01 && sheet.cap.pad === '6px 6px', sheet.cap);
ok('33.7 · kort r24, rader ≥ 60 px med 1 px skillelinje rgba(255,255,255,.06)', sheet.grp.r === '24px' && sheet.rowMinH === '60px' && sheet.minRow >= 60 && /^1px rgba\(255, 255, 255, 0\.06\)/.test(sheet.line), { grp: sheet.grp, minRow: sheet.minRow, line: sheet.line });
ok('33.7 · toppkort-stil-rutenettet gap 6 px', sheet.hsgGap === '6px', sheet.hsgGap);
ok('35.8 · arket: Fanestil Fylt/Kontur/Linje + Faner viser', sheet.looks.join() === 'Fylt,Kontur,Linje' && sheet.shows.join() === 'Ikon + tekst,Tekst,Ikon', { looks: sheet.looks, shows: sheet.shows });

// ---------- 3 · Fanestil i arket: live bak arket, lagres med Ferdig; GUI-skjemaet har feltet
const save = await p.evaluate(async () => {
  const wait = (ms) => new Promise((q) => setTimeout(q, ms));
  const k = window.__K(), R = window.MSH.portals().pop().shadowRoot, box = R.querySelector('.klima-sheet');
  box.querySelector('[data-a="look"][data-v="kontur"]').click(); await wait(400);
  const live = k.shadowRoot.querySelector('.trow').dataset.look;
  box.querySelector('[data-a="done"]').click(); await wait(1400);
  const cfg = (k._rawConfig || k.config).layout || {};
  const sch = window.customElements.get('msh-klima-card').schema(window.__hass, k.config);
  const vis = sch.find((x) => x.id === 'visning'), f = vis && vis.fields.find((x) => x.name === 'layout.tab_look');
  return { live, saved: cfg.tab_look, gui: f ? f.options.map((o) => o[1]).join() : null };
});
ok('35.8 · Kontur valgt i arket vises live og lagres (layout.tab_look)', save.live === 'kontur' && save.saved === 'kontur', save);
ok('35.8 · GUI-editoren har «Fanestil» Fylt/Kontur/Linje', save.gui === 'Fylt,Kontur,Linje', save.gui);

// ---------- 4 · lys modus: tokens + kontrast ≥ 4,5:1, mørk modus tilbake uten reload
const light = await p.evaluate(async () => {
  const wait = (ms) => new Promise((q) => setTimeout(q, ms));
  await window.__theme(true);
  const k = window.__K();
  k.setConfig({ type: 'custom:msh-klima-card', card_id: 'k33L', layout: { tab_look: 'fylt' } }); await wait(300);
  const tf = k.shadowRoot.querySelector('.tbox'), fOff = [...k.shadowRoot.querySelectorAll('.tabs>.tab:not(.on)')];
  const fylt = { bg: getComputedStyle(tf).backgroundColor, cr: Math.min(...fOff.map((e) => window.MSH.theme.contrast(getComputedStyle(e).color, getComputedStyle(tf).backgroundColor))) };
  k.setConfig({ type: 'custom:msh-klima-card', card_id: 'k33L', layout: { tab_look: 'kontur' } }); await wait(300);
  const R = k.shadowRoot, tb = R.querySelector('.tbox'), on = R.querySelector('.tabs>.tab.on'), offs = [...R.querySelectorAll('.tabs>.tab:not(.on)')];
  const out = { fylt, html: document.documentElement.getAttribute('data-ki-theme'), trackBg: getComputedStyle(tb).backgroundColor, trackSh: getComputedStyle(tb).boxShadow, gearBg: getComputedStyle(R.querySelector('.gear')).backgroundColor,
    offC: getComputedStyle(offs[0]).color, onC: getComputedStyle(on).color, crOff: Math.min(...offs.map((e) => window.MSH.theme.contrast(getComputedStyle(e).color, getComputedStyle(tb).backgroundColor))),
    crOn: +window.MSH.theme.contrast(getComputedStyle(on).color, 'rgb(244 169 199)').toFixed(2) };
  k.customize(); await wait(500);
  const S = window.MSH.portals().pop().shadowRoot, box = S.querySelector('.klima-sheet');
  const texts = [...box.querySelectorAll('.cap,.rl,.rs,.note,.nt,.seg button:not(.on),.bseg button:not(.on)')].filter((e) => e.getBoundingClientRect().height > 0 && e.textContent.trim());
  const crs = texts.map((e) => [e.className.split(' ')[0] + ':' + e.textContent.trim().slice(0, 18), window.__cr(e)]);
  out.sheetMin = Math.min(...crs.map((x) => x[1])); out.sheetBad = crs.filter((x) => x[1] < 4.5);
  out.grpBg = getComputedStyle(box.querySelector('.grp')).backgroundColor;
  out.line = getComputedStyle(box.querySelector('.grp > .r + .r')).borderTopColor;
  window.MSH.portals().pop().shadowRoot.querySelector('[data-a="done"]').click(); await wait(900);
  await window.__theme(false);
  out.darkAgain = { trackBg: getComputedStyle(window.__K().shadowRoot.querySelector('.tbox')).backgroundColor, offC: getComputedStyle(window.__K().shadowRoot.querySelector('.tabs>.tab:not(.on)')).color, html: document.documentElement.getAttribute('data-ki-theme') };
  return out;
});
ok('lys · data-ki-theme=light, Kontur: spor hvitt (--ki-surface), ring mørk i lys modus', light.html === 'light' && light.trackBg === 'rgb(255, 255, 255)' && light.gearBg === 'rgb(255, 255, 255)' && /rgba\(0, 0, 0, 0\.1[0-9]*\) 0px 0px 0px 1px inset/.test(light.trackSh), light);
ok('lys · Fylt: fanespor --ki-surface-3 (#dedede), inaktive faner ≥ 4,5:1', light.fylt.bg === 'rgb(222, 222, 222)' && light.fylt.cr >= 4.5, light.fylt);
ok('lys · inaktive faner ≥ 4,5:1 mot sporet, aktiv fane mørk tekst (--ki-on-accent) på rosa', light.crOff >= 4.5 && light.crOn >= 4.5 && light.onC !== 'rgb(250, 250, 250)', { crOff: light.crOff, crOn: light.crOn, onC: light.onC });
ok('lys · «Tilpass klima»: all tekst ≥ 4,5:1, skillelinje mørk', light.sheetMin >= 4.5 && /^rgba\(0, 0, 0/.test(light.line), { min: light.sheetMin, bad: light.sheetBad, line: light.line, grp: light.grpBg });
ok('mørk igjen uten reload: spor #3a3a3a, inaktiv #979797', light.darkAgain.html === 'dark' && light.darkAgain.trackBg === 'rgb(58, 58, 58)' && light.darkAgain.offC === 'rgb(151, 151, 151)', light.darkAgain);

ok('ingen sidefeil', !errs.length, errs);
await b.close();
console.log(JSON.stringify(res, null, 1));
const bad = Object.values(res).filter((v) => v !== 'OK').length;
console.log(bad ? `\n${bad} feilet` : '\nAlle bestod');
process.exit(bad ? 1 : 0);
