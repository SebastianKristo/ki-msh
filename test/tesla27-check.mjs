// Fiks 27.9 / 27.9b · Tesla-popupen og «Tilpass Tesla»-arket 1:1 med design/Tesla v3.dc.html:
// hurtigknapper (kvadratiske fliser, ikon 26 + tekst 11/500), ladekort (stav #282828, skravert felt batteri → grense som flyter
// mens den lader, grensemarkør 4 px, chips 30 px), faner (standard Tekst, Fylt #3a3a3a / Kontur) og arket (tittel, rosa Ferdig
// uten ×, tekstfaner, seksjonskort, brytere, segmenter, ladegrense 50–100 i tiere, fast høyde).
//   node test/tesla27-check.mjs
import { createRequire } from 'node:module';
import { readdirSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/tesla27-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = {}, fail = [], errs = [];
const ok = (name, cond, info) => { res[name] = cond ? 'OK' : ['FEIL', info]; if (!cond) fail.push(name); };
const mocks = readdirSync('test/mock').sort().map((m) => resolve('test/mock/' + m));
async function page(cfg, vp) {
  const p = await b.newPage({ viewport: vp || { width: 390, height: 900 }, hasTouch: true });
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + resolve('test/harness.html'));
  for (const m of mocks) await p.addScriptTag({ path: m });
  await p.addScriptTag({ path: bundle });
  await p.evaluate(async (cfg) => {
    window.__h = window.mockHass();
    const bc = document.createElement('bubble-card');
    bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash: '#tesla' });
    bc.innerHTML = '<div class="pop"><div class="hdr">Tesla</div><div class="inner"></div></div>';
    document.getElementById('dash').appendChild(bc);
    location.hash = '#tesla';
    const c = document.createElement('msh-tesla-card');
    c.setConfig({ type: 'custom:msh-tesla-card', card_id: 'pop-tesla27', ...(cfg || {}) });
    c.hass = window.__h; bc.querySelector('.inner').appendChild(c); window.__c = c;
    window.__setS = (o) => { const h = window.__c.hass, st = { ...h.states }; for (const [k, v] of Object.entries(o)) st[k] = { ...(st[k] || { entity_id: k, attributes: {} }), state: String(v) }; window.__c.hass = { ...h, states: st }; };
    await new Promise((q) => setTimeout(q, 900));
  }, cfg || {});
  return p;
}
const wait = (p, ms) => p.evaluate((ms) => new Promise((q) => setTimeout(q, ms)), ms);

/* ---------------------------------------------------------------- popupen */
const p = await page();
const Q = await p.evaluate(() => {
  const sr = window.__c.shadowRoot, cs = (e) => getComputedStyle(e);
  return { gap: cs(sr.querySelector('.qb')).columnGap, b: [...sr.querySelectorAll('.qbtn')].map((e) => { const r = e.getBoundingClientRect(), ic = e.querySelector('ha-icon'), l = e.querySelector('.ql'); return { k: e.dataset.v, w: Math.round(r.width), h: Math.round(r.height), r: cs(e).borderRadius, bg: cs(e).backgroundColor, bgi: cs(e).backgroundImage, col: cs(e).color, gap: cs(e).rowGap, ic: ic.getAttribute('icon'), is: ic.style.width, l: l && l.textContent, lfs: l && cs(l).fontSize, lfw: l && cs(l).fontWeight, cls: e.className, anim: cs(e.querySelector('.qi')).animationName }; }) };
});
const B = Object.fromEntries(Q.b.map((x) => [x.k, x]));
ok('Hurtigknapper: 5 kvadratiske fliser (1:1), r24, gap 8', Q.b.length === 5 && Q.b.every((x) => Math.abs(x.w - x.h) <= 1 && x.r === '24px') && Q.gap === '8px', Q);
ok('Hurtigknapper: hvitt ikon 26 px + tekst 11/500 under (gap 4)', Q.b.every((x) => x.is === '26px' && x.lfs === '11px' && x.lfw === '500' && x.gap === '4px') && B.honk.col === 'rgb(250, 250, 250)' && B.honk.bg === 'rgb(58, 58, 58)', Q.b);
ok('Hurtigknapper: tekster Åpen/Tut/Defrost/Frunk/Bagasje og ikoner lock-open/bullhorn/heat-wave/car/bag-suitcase', Q.b.map((x) => x.l).join('|') === 'Åpen|Tut|Defrost|Frunk|Bagasje' && Q.b.map((x) => x.ic).join('|') === 'mdi:lock-open|mdi:bullhorn|mdi:heat-wave|mdi:car|mdi:bag-suitcase', Q.b);
ok('Hurtigknapper: ulåst oransje + rist, defrost rosa + pust, bagasje rosa, tekst #282828', B.lock.bg === 'rgb(242, 181, 115)' && B.lock.anim === 'rist' && /gradient/.test(B.defrost.bgi) && B.defrost.anim === 'pust' && /gradient/.test(B.trunk.bgi) && B.trunk.col === 'rgb(40, 40, 40)' && !/gradient/.test(B.frunk.bgi), B);
const honk = await p.evaluate(async () => { window.__c.shadowRoot.querySelector('.qbtn[data-v="honk"]').click(); await new Promise((q) => setTimeout(q, 300)); const pt = window.MSH.portals().pop(), okb = pt && pt.shadowRoot.querySelector('[data-k="ok"]'); if (okb) okb.click(); await new Promise((q) => setTimeout(q, 60)); return getComputedStyle(window.__c.shadowRoot.querySelector('.qbtn[data-v="honk"] .qi')).animationName; });
ok('Tut: ikonet rister ved tuting (etter «Tut» i bekreftelsen, designets standard)', honk === 'rist', honk);

// ladekort: lader (64 % → 80 %)
const lad = () => p.evaluate(() => {
  const sr = window.__c.shadowRoot, cs = (e) => getComputedStyle(e), q = (s) => sr.querySelector(s);
  const lim = q('.lim'), gap = q('.lgap'), mk = q('.lmk'), fill = q('.lbat'), R = (e) => e && e.getBoundingClientRect(), L = R(lim);
  return { card: { r: cs(q('.lc')).borderRadius, p: cs(q('.lc')).padding, g: cs(q('.lc')).rowGap }, st: q('.lt2').textContent, stfs: cs(q('.lt2')).fontSize, big: cs(q('.lc .big')).fontSize, ss: { h: Math.round(R(q('.ss')).height), bg: cs(q('.ss')).backgroundColor, t: q('.ss').textContent.trim() },
    lim: { h: Math.round(L.height), bg: cs(lim).backgroundColor, ta: cs(lim).touchAction }, fill: Math.round(R(fill).width / L.width * 100),
    gap: gap ? { l: Math.round((R(gap).left - L.left) / L.width * 100), w: Math.round(R(gap).width / L.width * 100), img: cs(gap).backgroundImage, anim: cs(gap).animationName } : null,
    mk: mk && { w: Math.round(R(mk).width), top: Math.round(R(mk).top - L.top), sh: cs(mk).boxShadow, x: Math.round((R(mk).left + R(mk).width / 2 - L.left) / L.width * 100) },
    pct: q('.lpct').textContent, chips: [...sr.querySelectorAll('.lchip')].map((c) => ({ t: c.textContent, h: Math.round(R(c).height), w: Math.round(R(c).width), r: cs(c).borderRadius, on: c.classList.contains('on'), bgi: cs(c).backgroundImage })) };
});
const L1 = await lad();
ok('Ladekort: r28, padding 18/18/16, gap 14; status 13 px «Lader», effekt 40 px', L1.card.r === '28px' && L1.card.p === '18px 18px 16px' && L1.card.g === '14px' && L1.st === 'Lader' && L1.stfs === '13px' && L1.big === '40px', L1);
ok('Ladekort: Stopp 44 px hvit mens den lader', L1.ss.h === 44 && L1.ss.bg === 'rgb(250, 250, 250)' && L1.ss.t === 'Stopp', L1.ss);
ok('Ladestav: 56 px på #282828 (ikke grå), touch-action none, fyll til 64 %', L1.lim.h === 56 && L1.lim.bg === 'rgb(40, 40, 40)' && L1.lim.ta === 'none' && Math.abs(L1.fill - 64) <= 1, L1);
ok('Ladestav: skravert felt 64 → 80 % som flyter (flow) mens den lader', L1.gap && Math.abs(L1.gap.l - 64) <= 1 && Math.abs(L1.gap.w - 16) <= 1 && /repeating-linear-gradient/.test(L1.gap.img) && L1.gap.anim === 'flow', L1.gap);
ok('Ladestav: grensemarkør 4 px, 8 px inn, skygge, på 80 %', L1.mk && L1.mk.w === 4 && L1.mk.top === 8 && /0px 0px 0px 3px/.test(L1.mk.sh) && Math.abs(L1.mk.x - 80) <= 1, L1.mk);
ok('Ladegrense-chips: 30 px, min 38, r15, valgt rosa', L1.chips.length === 5 && L1.chips.every((c) => c.h === 30 && c.w >= 38 && c.r === '15px') && L1.chips.filter((c) => c.on).length === 1 && /gradient/.test(L1.chips.find((c) => c.on).bgi), L1.chips);
// lader ikke
await p.evaluate(() => window.__setS({ 'switch.elbillader_charging': 'off', 'sensor.elbillader_charge_power': 0, 'sensor.tesla_model_y_batteri_charge_power': 0, 'select.tesla_model_y_batteri_charging_state': 'stopped' }));
await wait(p, 300);
const L2 = await lad();
ok('Lader ikke: «Tilkoblet · lader ikke», Start #404040, skravert felt står stille', L2.st === 'Tilkoblet · lader ikke' && L2.ss.t === 'Start' && L2.ss.bg === 'rgb(64, 64, 64)' && L2.gap && L2.gap.anim === 'none' && Math.abs(L2.gap.w - 16) <= 1, L2);
// grense < batteri (ferdig)
await p.evaluate(() => window.__setS({ 'sensor.tesla_model_y_batteri_batteriniva': 85, 'select.tesla_model_y_batteri_charging_state': 'complete' }));
await wait(p, 300);
const L3 = await lad();
ok('Batteri over grensen: «Ferdig ladet», ikke noe skravert felt, markør på 80 %', L3.st === 'Ferdig ladet' && L3.gap && L3.gap.w === 0 && Math.abs(L3.mk.x - 80) <= 1 && Math.abs(L3.fill - 85) <= 1, L3);

// faner: standard Tekst + Fylt
const T = await p.evaluate(() => {
  const sr = window.__c.shadowRoot, cs = (e) => getComputedStyle(e), tb = sr.querySelector('.tbox');
  return { cls: tb.className, bg: cs(tb).backgroundColor, r: cs(tb).borderRadius, p: cs(tb).padding, tabs: [...sr.querySelectorAll('.tabs .tab')].map((t) => ({ t: t.textContent.trim(), ic: !!t.querySelector('ha-icon'), h: Math.round(t.getBoundingClientRect().height), fs: cs(t).fontSize, col: cs(t).color, bgi: cs(t).backgroundImage })), gear: Math.round(sr.querySelector('.gear').getBoundingClientRect().width) };
});
ok('Faner: standard Tekst (ingen ikoner), Fylt #3a3a3a r24 padding 4, fane 40 px 14 px', /\bfl\b/.test(T.cls) && T.bg === 'rgb(58, 58, 58)' && T.r === '24px' && T.p === '4px' && T.tabs.every((t) => !t.ic && t.h === 40 && t.fs === '14px') && T.tabs.map((t) => t.t).join('|') === 'Lading|Kjøring|Sparing' && T.gear === 48, T);
ok('Faner: aktiv rosa + #3a3a3a, inaktiv #afafaf', /gradient/.test(T.tabs[0].bgi) && T.tabs[0].col === 'rgb(58, 58, 58)' && T.tabs[1].col === 'rgb(175, 175, 175)', T.tabs);
await p.close();

// designets verdier (tekst / Kontur) og Kontur-stilen
const p2 = await page({ tabs: { content: 'tekst', style: 'Kontur' } });
const T2 = await p2.evaluate(() => { const sr = window.__c.shadowRoot, cs = (e) => getComputedStyle(e); return { cls: sr.querySelector('.tbox').className, box: cs(sr.querySelector('.tabs')).boxShadow, tabs: [...sr.querySelectorAll('.tabs .tab')].map((t) => ({ ic: !!t.querySelector('ha-icon'), h: Math.round(t.getBoundingClientRect().height), col: cs(t).color })) }; });
ok('Faner: «tekst»/«Kontur» (designverdier) → bare tekst, kontur 36 px med kant .28', /\bol\b/.test(T2.cls) && /0\.28/.test(T2.box) && T2.tabs.every((t) => !t.ic && t.h === 36) && T2.tabs[1].col === 'rgb(250, 250, 250)', T2);
await p2.close();
const p3 = await page({ button_text: false, tabs: { content: 'icon_active' } });
const T3 = await p3.evaluate(() => { const sr = window.__c.shadowRoot; return { ql: sr.querySelectorAll('.qbtn .ql').length, tabs: [...sr.querySelectorAll('.tabs .tab')].map((t) => [!!t.querySelector('ha-icon'), !!t.querySelector('span')]) }; });
ok('btn_text av → ingen tekst under ikonene; «Ikon + aktiv» → ikon på alle, tekst bare på aktiv', T3.ql === 0 && T3.tabs.every((x) => x[0]) && T3.tabs.filter((x) => x[1]).length === 1, T3);
await p3.close();

/* ---------------------------------------------------------------- Fiks 28.7: smartlading som designet */
{
  const q = await page({ entities: { smart: 'input_boolean.tesla_smartlading' } });
  await q.evaluate(() => { const h = window.__c.hass, st = { ...h.states, 'input_boolean.tesla_smartlading': { entity_id: 'input_boolean.tesla_smartlading', state: 'on', attributes: { friendly_name: 'Smartlading' } } }; window.__c.hass = { ...h, states: st }; });
  await wait(q, 400);
  const SM = await q.evaluate(() => { const sr = window.__c.shadowRoot, cs = (x) => getComputedStyle(x), tg = sr.querySelector('.tg'), i = tg && tg.querySelector('i'), c = sr.querySelector('.pb i.c'); return { tg: tg && [Math.round(tg.getBoundingClientRect().width), Math.round(tg.getBoundingClientRect().height)], knob: i && [Math.round(i.getBoundingClientRect().width), cs(i).top], cheap: c ? cs(c).backgroundImage : null }; });
  ok('28.7 smartlading: bryter 50×28 (knott 20, 4 px inn) som designet, billigste timer = rosa gradient', SM.tg && SM.tg[0] === 50 && SM.tg[1] === 28 && SM.knob[0] === 20 && SM.knob[1] === '4px' && (SM.cheap == null || /gradient/.test(SM.cheap)), SM);
  await q.close();
}

/* ---------------------------------------------------------------- «Tilpass Tesla»-arket */
const e = await page();
const S0 = await e.evaluate(async () => {
  window.__c.shadowRoot.querySelector('.gear').click(); await new Promise((q) => setTimeout(q, 700));
  const portal = window.MSH.portals().pop(), ed = portal.shadowRoot.querySelector('msh-tesla-editor'), R = ed.shadowRoot, cs = (x) => getComputedStyle(x);
  const tt = R.querySelector('.th .tt'), done = R.querySelector('[data-a="save"]'), grab = portal.shadowRoot.querySelector('.grab'), et = R.querySelector('.etabs');
  return { tt: tt.textContent, tfs: cs(tt).fontSize, tfw: cs(tt).fontWeight, done: { t: done.textContent.trim(), h: Math.round(done.getBoundingClientRect().height), r: cs(done).borderRadius, bgi: cs(done).backgroundImage, right: done.getBoundingClientRect().left > tt.getBoundingClientRect().left }, x: !!R.querySelector('[data-a="cancel"]') || !!R.querySelector('ha-icon[icon="mdi:close"]'),
    grab: [Math.round(grab.getBoundingClientRect().width), Math.round(grab.getBoundingClientRect().height), cs(grab).backgroundColor],
    tabs: { cols: cs(et).gridTemplateColumns.split(' ').length, bg: cs(et).backgroundColor, r: cs(et).borderRadius, p: cs(et).padding, txt: [...et.querySelectorAll('button')].map((b) => b.textContent.trim()), icons: et.querySelectorAll('ha-icon').length, h: Math.round(et.querySelector('button').getBoundingClientRect().height), gd: !!et.__gd } };
});
ok('Arket: «Tilpass Tesla» 22/600, rosa Ferdig 40 px r20 øverst til høyre, ingen ×', S0.tt === 'Tilpass Tesla' && S0.tfs === '22px' && S0.tfw === '600' && S0.done.t === 'Ferdig' && S0.done.h === 40 && S0.done.r === '20px' && /gradient/.test(S0.done.bgi) && S0.done.right && !S0.x, S0);
ok('Arket: håndtak 40×5 #545454', S0.grab[0] === 40 && S0.grab[1] === 5, S0.grab);
ok('Arket: tekstfaner Bil · Faner · Entiteter · Avansert (4 kolonner, #3a3a3a r24 p4, 40 px, ingen ikoner, Liquid Glass-drag)', S0.tabs.cols === 4 && S0.tabs.bg === 'rgb(58, 58, 58)' && S0.tabs.r === '24px' && S0.tabs.p === '4px' && S0.tabs.txt.join('|') === 'Bil|Faner|Entiteter|Avansert' && S0.tabs.icons === 0 && S0.tabs.h === 40 && S0.tabs.gd, S0.tabs);
const H = {};
for (const k of ['bil', 'faner', 'ents', 'adv']) {
  H[k] = await e.evaluate(async (k) => {
    const portal = window.MSH.portals().pop(), ed = portal.shadowRoot.querySelector('msh-tesla-editor'), R = ed.shadowRoot, cs = (x) => getComputedStyle(x);
    R.querySelector(`[data-a="tetab"][data-v="${k}"]`).click(); await new Promise((q) => setTimeout(q, 300));
    const sh = portal.shadowRoot.querySelector('.sh'), sc = R.querySelector('.tsc');
    return { h: Math.round(sh.getBoundingClientRect().height), secs: [...sc.children].map((c) => ({ tag: c.tagName, cls: c.className, bg: cs(c).backgroundColor, r: cs(c).borderRadius })), gap: cs(sc).rowGap, scroll: cs(sc).overflowY, fsh: R.querySelectorAll('.fsh').length,
      labs: [...R.querySelectorAll('.lab')].map((l) => l.textContent.trim()), sw: R.querySelectorAll('.tsw').length, eye: R.querySelectorAll('ha-icon[icon^="mdi:eye"]').length, segs: [...R.querySelectorAll('.tseg')].map((s) => ({ bg: cs(s).backgroundColor, r: cs(s).borderRadius, n: s.children.length, cols: cs(s).gridTemplateColumns.split(' ').length })), lims: [...R.querySelectorAll('.lims button')].map((b) => b.textContent.trim()), help: R.querySelectorAll('.help').length };
  }, k);
}
const hs = Object.values(H).map((x) => x.h);
ok('Arket: samme høyde i alle fire faner (bare innholdet scroller)', Math.max(...hs) - Math.min(...hs) <= 1 && Object.values(H).every((x) => x.scroll === 'auto'), hs);
ok('Arket: seksjonene er egne kort #3a3a3a r24 rett på arket (gap 8, ingen ytre ramme / seksjonstittel over alt)', Object.values(H).every((x) => x.gap === '8px' && x.fsh === 0 && x.secs.filter((s) => s.tag !== 'BUTTON').every((s) => s.bg === 'rgb(58, 58, 58)' && s.r === '24px')), H);
ok('Bil: kortene «Bil» og «Hurtigknapper», segment for kapasitet, brytere', H.bil.labs.join('|') === 'Bil|Hurtigknapper' && H.bil.segs.length === 1 && H.bil.segs[0].n === 3 && H.bil.sw === 6, H.bil);
ok('Faner: Forhåndsvisning + Faner (brytere, ikke øye) + valg som segmenter (#282828 r22)', H.faner.labs.join('|') === 'Forhåndsvisning|Faner' && H.faner.sw === 3 && H.faner.eye === 0 && H.faner.segs.length === 3 && H.faner.segs.every((s) => s.bg === 'rgb(40, 40, 40)' && s.r === '22px' && s.cols === s.n) && H.faner.segs.map((s) => s.n).join() === '2,4,3', H.faner);
ok('Faner: ladegrense-knapper bare 50–100 i tiere, ingen hjelpetekst', H.faner.lims.join('|') === '50 %|60 %|70 %|80 %|90 %|100 %' && H.faner.help === 0, H.faner.lims);
ok('Entiteter: tre gruppekort', H.ents.labs.join('|') === 'Batteri og lading|Kjøring og status|Sparing', H.ents.labs);
ok('Avansert: brytere (lås omvendt, bekreftelse), segmenter, prefiks, tilbakestill', H.adv.sw === 2 && H.adv.segs.length >= 1 && H.adv.labs.includes('Mellomrom') && H.adv.secs.some((s) => s.tag === 'BUTTON'), H.adv);
const F = await e.evaluate(async () => {
  const portal = window.MSH.portals().pop(), ed = portal.shadowRoot.querySelector('msh-tesla-editor'), R = ed.shadowRoot, cs = (x) => getComputedStyle(x);
  R.querySelector('[data-a="tetab"][data-v="faner"]').click(); await new Promise((q) => setTimeout(q, 250));
  const row = R.querySelector('.trw'), ic = row.querySelectorAll('ha-icon')[1];
  const out = { h: Math.round(row.getBoundingClientRect().height), icCol: cs(ic).color, icBg: cs(ic.parentElement).backgroundColor, sw: [Math.round(row.querySelector('.tsw').getBoundingClientRect().width), Math.round(row.querySelector('.tsw').getBoundingClientRect().height), cs(row.querySelector('.tsw')).backgroundColor] };
  R.querySelector('[data-a="tsel"][data-name="tabs.content"][data-v="icons"]').click(); await new Promise((q) => setTimeout(q, 250));
  out.prevIcons = R.querySelectorAll('.tsp .tab ha-icon').length; out.cardIcons = window.__c.shadowRoot.querySelectorAll('.tabs .tab ha-icon').length;
  R.querySelector('.lims button:nth-child(5)').click(); await new Promise((q) => setTimeout(q, 250));
  out.lims = ed._config.limits; out.chips = [...window.__c.shadowRoot.querySelectorAll('.lchip')].map((c) => c.textContent);
  return out;
});
ok('Fane-rad 60 px: ikon #afafaf uten sirkel, rosa bryter 44×26', F.h === 60 && F.icCol === 'rgb(175, 175, 175)' && F.icBg === 'rgba(0, 0, 0, 0)' && F.sw[0] === 44 && F.sw[1] === 26 && F.sw[2] === 'rgb(242, 133, 201)', F);
ok('Segment «Ikoner» → forhåndsvisning og popup live; 90 % → ny ladegrense-knapp', F.prevIcons === 3 && F.cardIcons === 3 && F.lims.join() === '50,60,70,80,90,100' && F.chips.join() === '50,60,70,80,90,100', F);
// Fiks 28.7: resten av 27.9/27.9b mot designet – drag_indicator-håndtak, bekreftelse-standard (hovedbryter på, Tut avkrysset),
// arket uten egen høydeoverstyring (felles arkhøyde 28.11)
const F2 = await e.evaluate(async () => {
  const portal = window.MSH.portals().pop(), ed = portal.shadowRoot.querySelector('msh-tesla-editor'), R = ed.shadowRoot, w = (ms) => new Promise((q) => setTimeout(q, ms));
  const drag = R.querySelector('.trw .drg ha-icon').getAttribute('icon');
  R.querySelector('[data-a="tetab"][data-v="bil"]').click(); await w(250);
  const conf = Object.fromEntries([...R.querySelectorAll('.cfm')].map((b) => [b.dataset.name.split('.')[1], b.getAttribute('aria-pressed') === 'true']));
  R.querySelector('[data-a="tetab"][data-v="adv"]').click(); await w(250);
  const master = R.querySelector('.tsw[data-name="confirm"]').getAttribute('aria-checked') === 'true';
  const st = portal.shadowRoot.querySelector('style[data-tesla]').textContent;
  return { drag, conf, master, ownH: /\.sh\{[^}]*\bheight:/.test(st), inline: portal.shadowRoot.querySelector('.sh').style.height || '' };
});
ok('28.7 arket: drag_indicator-håndtak (mdi:drag), bekreftelse som designet (hovedbryter på; lås/tut/frunk/bagasje avkrysset, defrost ikke), ingen egen arkhøyde', F2.drag === 'mdi:drag' && F2.master && F2.conf.lock && F2.conf.honk && !F2.conf.defrost && F2.conf.frunk && F2.conf.trunk && !F2.ownH && !F2.inline, F2);
await e.close();

/* ---------------------------------------------------------------- GUI-editoren: samme valg (ladegrense i tiere) */
const g = await page();
const G = await g.evaluate(async () => { const ed = customElements.get('msh-tesla-card').getConfigElement(); ed.hass = window.mockHass(); ed.setConfig({ type: 'custom:msh-tesla-card', card_id: 'gui27' }); document.body.appendChild(ed); await new Promise((q) => setTimeout(q, 150)); const R = ed.shadowRoot; [...R.querySelectorAll('[data-a="tab"]')].find((t) => t.dataset.v === 'faner').click(); await new Promise((q) => setTimeout(q, 150)); const v = [...R.querySelectorAll('[data-op="lim"]')].map((x) => x.dataset.v); ed.remove(); return v; });
ok('GUI-editor: ladegrense-knapper 50–100 i tiere (samme som arket)', G.join() === '50,60,70,80,90,100', G);
await g.close();

ok('Ingen sidefeil', !errs.length, errs);
await b.close();
for (const [k, v] of Object.entries(res)) console.log(v === 'OK' ? 'OK  ' : 'FEIL', k, v === 'OK' ? '' : JSON.stringify(v[1]).slice(0, 700));
console.log(fail.length ? `\n${fail.length} feil` : '\nAlle Tesla 27-sjekker OK');
process.exit(fail.length ? 1 : 0);
