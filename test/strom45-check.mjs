// Del 45 · Strøm-popup v3 (#strom) mot EKTE Bubble Card – integrasjon av A (61-strom.js), B (62-strom-kurser.js) og C (63-strom-sider.js)
//   · strategien lager #strom (mal A) med ÉTT msh-strom-card; åpnes via hash; kortet fyller bredden
//   · toppkort: energi-hus-v2.svg (med bilen), BRUKER NÅ fra effekt-sensoren, ingen mock-verdier fra designet
//   · faner bytter (Priser/Forbruk/Kurser), hold 400 ms + dra omorganiserer (order), seksjon hold + dra (ord.sec-Priser)
//   · Tilpass strøm-arket (Nullstill/Ferdig, 4 faner, håndtaket 58 %) og GUI-editoren lagrer de samme nøklene
//   · undersider: regning → Strømregning, tilbake; #norgespris → #strom + Norgespris
//   node test/strom45-check.mjs
import { createRequire } from 'node:module';
import { readdirSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
mkdirSync('test/.vendor', { recursive: true });
const BC = resolve('test/.vendor/bubble-card.js');
if (!existsSync(BC)) execFileSync('curl', ['-sSL', '-o', BC, 'https://raw.githubusercontent.com/Clooos/Bubble-Card/main/dist/bubble-card.js']);
const bundle = resolve(`test/.build/strom45-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const mocks = readdirSync('test/mock').filter((f) => f.endsWith('.js')).sort().map((m) => resolve('test/mock/' + m));
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const fail = [];
const ok = (name, cond, info) => { console.log(`${cond ? '✔' : '✘'} ${name}${cond ? '' : ' · ' + JSON.stringify(info)}`); if (!cond) fail.push(name); };

const p = await b.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => { if (m.type() === 'error' && !/ERR_|CORS|bubble-modules|Failed to/.test(m.text())) errs.push(m.text().slice(0, 160)); });
await p.goto('file://' + resolve('test/harness-bubble.html'));
for (const m of mocks) await p.addScriptTag({ path: m });
await p.addScriptTag({ path: bundle });
await p.addScriptTag({ path: BC, type: 'module' });
await p.waitForFunction(() => customElements.get('bubble-card'));
const wait = (ms) => p.waitForTimeout(ms);

// ---- generer dashbordet og åpne #strom
const G = await p.evaluate(async () => {
  const wait = (ms) => new Promise((q) => setTimeout(q, ms));
  const M = window.MSH, S = customElements.get('ll-strategy-dashboard-ki-dashboard');
  const h = window.mockHass();
  window.__h = h;
  await M.store.load(h);
  const d = await S.generate({}, h), stack = d.views[0].cards[0];
  const pops = stack.cards.filter((c) => c.card_type === 'pop-up');
  const P = pops.find((c) => c.hash === '#strom');
  const root = document.getElementById('dash');
  for (const c of stack.cards) { const el = document.createElement(c.type.replace('custom:', '')); el.setConfig(c); el.hass = h; root.appendChild(el); }
  await wait(700);
  location.hash = '#strom'; await wait(1300);
  const all = () => { const o = []; const w = (x) => x.querySelectorAll('*').forEach((e) => { o.push(e); if (e.shadowRoot) w(e.shadowRoot); }); w(document); return o; };
  window.__all = all;
  const pe = all().find((e) => e.classList && e.classList.contains('bubble-pop-up') && e.classList.contains('is-popup-opened'));
  const cards = pe ? [...pe.querySelectorAll('*')].filter((e) => /^msh-.*-card$/.test(e.localName)) : [];
  window.__card = cards[0];
  window.__pop = pe;
  return { has: !!P, n: P ? P.cards.length : 0, type: P && P.cards[0].type, tmplA: !!P && P.bg_opacity === '98' && P.bg_blur === '5', icon: P && P.icon, name: P && P.name, open: !!pe, cards: cards.map((c) => c.localName), energi: pops.some((c) => c.hash === '#energi'), needs: M.popupNeeds['#strom'](h), mods: { B: !!M.stromKurser, C: !!M.stromSider } };
});
ok('strategien lager #strom (mal A, «Strøm», mdi:power-plug) med ÉTT msh-strom-card', G.has && G.n === 1 && G.type === 'custom:msh-strom-card' && G.tmplA && G.icon === 'mdi:power-plug' && G.name === 'Strøm', G);
ok('#strom åpnes via hash med ett kort', G.open && G.cards.length === 1 && G.cards[0] === 'msh-strom-card', G);
console.log('  moduler:', JSON.stringify(G.mods), '· #energi beholdes:', G.energi);
await wait(800); // statistikk (Energi-oppsettet) hentes ved åpning

const H = await p.evaluate(() => {
  const c = window.__card, R = c.shadowRoot, pop = window.__pop;
  const cr = c.getBoundingClientRect(), cont = pop.querySelector('.bubble-pop-up-container') || pop, pr = cont.getBoundingClientRect();
  const img = R.querySelector('img.hus'), src = img ? decodeURIComponent(img.getAttribute('src')) : '';
  const txt = R.querySelector('.wrap').textContent.replace(/\s+/g, ' ');
  const ir = img && img.getBoundingClientRect(), hr = R.querySelector('.hero').getBoundingClientRect();
  return { w: Math.round(cr.width), pw: Math.round(pr.width), heroH: Math.round(hr.height), svg: /<svg/.test(src) && /cTop/.test(src) && /cGlass/.test(src), imgW: ir && Math.round(ir.width), imgTop: ir && Math.round(ir.top - hr.top), heroW: Math.round(hr.width),
    watt: R.querySelector('[data-watt]').textContent, ent: c.ent('effekt'), txt, island: R.querySelector('.hero').hasAttribute('data-ki-island'),
    glow: getComputedStyle(R.querySelector('.hglow')).animationName, ping: getComputedStyle(R.querySelector('.pdot .pg')).animationName,
    draw: (R.querySelector('.pc svg path[pathLength]') || { style: {} }).style.animation || '', tabs: [...R.querySelectorAll('[data-tabbar] button')].map((x) => x.dataset.v) };
});
ok('kortet fyller popup-bredden', H.w >= H.pw - 40 && H.w > 300, H);
// Fiks 47 M: huset skaleres etter høyden (calc(100% - 96px)), maks 58 % bredde
ok('toppkort: energi-hus-v2.svg med bilen (cTop/cGlass), høyde 100 % − 96 px, maks 58 % bredde, top 6 px, ≥ 250 px', H.svg && H.imgW <= Math.round(H.heroW * 0.58) + 1 && H.imgTop === 6 && H.heroH >= 250, H);
ok('BRUKER NÅ = effekt-sensoren (live), mørk øy, glowP + ping', H.ent && H.watt !== '–' && H.island && H.glow === 'glowP' && H.ping === 'ping', { ent: H.ent, watt: H.watt });
ok('ingen mock-verdier fra designet (883 W, 687 kr, 1,49 kr, 0,80 kr, 49 kr)', !/\b883\b|687 kr|1,49 kr|0,80 kr|\b49 kr/.test(H.txt) && !/Spotpris middels · 1,49/.test(H.txt), H.txt.slice(0, 300));
ok('Priser: pris time for time tegnes med draw', /draw/.test(H.draw), H.draw);
ok('fanelinja Priser · Forbruk · Kurser', JSON.stringify(H.tabs) === '["Priser","Forbruk","Kurser"]', H.tabs);

// ---- fanebytte
const tabClick = (v) => p.evaluate((v) => { window.__card.shadowRoot.querySelector(`[data-tabbar] button[data-v="${v}"]`).click(); }, v);
await tabClick('Forbruk'); await wait(700);
const F = await p.evaluate(() => { const R = window.__card.shadowRoot; return { uc: R.querySelectorAll('.uc').length, rows: R.querySelectorAll('.fr').length, bars: R.querySelectorAll('.ba .col i').length, grow: (R.querySelector('.ba .col i') || { style: {} }).style.animation || '', src: R.querySelectorAll('.srr').length, leg: R.querySelectorAll('.leg span').length }; });
ok('Forbruk: 2 kort, Dag/Måned/År, stablede timesøyler (grow), kildetabell', F.uc === 2 && F.rows === 3 && F.bars > 5 && /grow/.test(F.grow) && F.src >= 2, F);
await tabClick('Kurser'); await wait(500);
const K = await p.evaluate(() => { const R = window.__card.shadowRoot; return { host: !!R.querySelector('[data-skhost]'), b: !!R.querySelector('[data-sk-root]'), wait: !!R.querySelector('[data-sk-wait]'), n: (R.querySelector('[data-skhost]') || { textContent: '' }).textContent.length }; });
ok('Kurser: modul B tegnes i fanen' + (G.mods.B ? '' : ' (plassholder – B mangler)'), G.mods.B ? K.host && K.b && K.n > 20 : K.wait, K);
await tabClick('Priser'); await wait(400);

// ---- hold 400 ms + dra: faner (mus)
const rectOf = (sel) => p.evaluate((sel) => { window.__card.shadowRoot.querySelector(sel).scrollIntoView({ block: 'center' }); const r = window.__card.shadowRoot.querySelector(sel).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel);
let a = await rectOf('[data-tabbar] button[data-v="Priser"]'), z = await rectOf('[data-tabbar] button[data-v="Kurser"]');
await p.mouse.move(a.x, a.y); await p.mouse.down(); await wait(520);
for (let i = 1; i <= 10; i++) { await p.mouse.move(a.x + ((z.x + 10 - a.x) * i) / 10, a.y); await wait(30); }
await p.mouse.up(); await wait(900);
const O = await p.evaluate(() => ({ order: window.__card.config.order, tab: window.__card.ui.tab, open: !!window.__pop.classList.contains('is-popup-opened') }));
ok('hold + dra på fanene endrer rekkefølgen (config.order), popupen står åpen', Array.isArray(O.order) && O.order[O.order.length - 1] === 'Priser' && O.open, O);

// ---- hold + dra: seksjon «Hva koster det nå» over «Regning og kostnad»
await rectOf('[data-rid="p_kort"]'); [a, z] = await p.evaluate(() => ['p_eks', 'p_kort'].map((k) => { const r = window.__card.shadowRoot.querySelector(`[data-rid="${k}"]`).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + Math.min(26, r.height / 2) }; }));
await p.mouse.move(a.x, a.y); await p.mouse.down(); await wait(520);
for (let i = 1; i <= 10; i++) { await p.mouse.move(a.x, a.y + ((z.y - 40 - a.y) * i) / 10); await wait(30); }
await p.mouse.up(); await wait(900);
const SO = await p.evaluate(() => ({ ord: (window.__card.config.ord || {})['sec-Priser'], ex: !!window.__card.ui.ex }));
ok('hold + dra på seksjonene lagrer ord.sec-Priser (klikket etter dra svelges)', Array.isArray(SO.ord) && SO.ord[0] === 'p_eks' && !SO.ex, SO);

await tabClick('Kurser'); await wait(500);
// B: seksjonene i Kurser-fanen (hold + dra) lagres i ord.sec-Kurser
await rectOf('[data-skhost] [data-rid="k_kat"]');
{ const [ka, kz] = await p.evaluate(() => ['k_kurs', 'k_kat'].map((k) => { const r = window.__card.shadowRoot.querySelector(`[data-skhost] [data-rid="${k}"]`).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + Math.min(20, r.height / 2) }; }));
  if (ka.y > 830) await p.evaluate(() => window.__card.shadowRoot.querySelector('[data-skhost] [data-rid="k_kurs"]').scrollIntoView({ block: 'end' }));
  const [a2, z2] = await p.evaluate(() => ['k_kurs', 'k_kat'].map((k) => { const r = window.__card.shadowRoot.querySelector(`[data-skhost] [data-rid="${k}"]`).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + Math.min(20, r.height / 2) }; }));
  await p.mouse.move(a2.x, a2.y); await p.mouse.down(); await wait(520);
  for (let i = 1; i <= 12; i++) { await p.mouse.move(a2.x, a2.y + ((z2.y - 10 - a2.y) * i) / 12); await wait(30); }
  await p.mouse.up(); await wait(900);
  const KO = await p.evaluate(() => (window.__card.config.ord || {})['sec-Kurser']);
  ok('Kurser: hold + dra på seksjonene (modul B) lagrer ord.sec-Kurser én gang', Array.isArray(KO) && KO.indexOf('k_kurs') < KO.indexOf('k_kat'), { KO, a2, z2 }); }
await tabClick('Priser'); await wait(500);
// ---- scrub i prisgrafen
const sc = await rectOf('[data-scrub]');
await p.mouse.move(sc.x - 60, sc.y); await p.mouse.down(); await p.mouse.move(sc.x + 20, sc.y, { steps: 4 }); await p.mouse.up(); await wait(300);
const SC = await p.evaluate(() => ({ selH: window.__card.ui.selH, ta: window.__card.shadowRoot.querySelector('[data-scrub]').style.touchAction, lab: window.__card.shadowRoot.querySelector('.gh .sl').textContent }));
ok('scrub i prisgrafen velger time (touch-action none)', SC.selH != null && SC.ta === 'none' && /kl\./.test(SC.lab), SC);

// ---- Tilpass strøm-arket
await p.evaluate(() => window.__card.shadowRoot.querySelector('[data-act="tilpass"]').click()); await wait(700);
const T1 = await p.evaluate(() => {
  const P = window.MSH.portals().find((x) => x.shadowRoot && x.shadowRoot.querySelector('.tp'));
  window.__tp = P;
  if (!P) return { open: false, n: window.MSH.portals().length, hash: location.hash };
  const r = P.shadowRoot, sh = r.querySelector('.sh');
  return { open: !!P, title: r.querySelector('.tt').textContent, btns: [...r.querySelectorAll('.tph button')].map((x) => x.textContent.trim()), tabs: [...r.querySelectorAll('.tpt button')].map((x) => x.title), h: Math.round(sh.getBoundingClientRect().height), vh: innerHeight, rows: r.querySelectorAll('.trw').length };
});
ok('Tilpass strøm: tittel, Nullstill + Ferdig, fanene Faner/Entiteter/Kurser/Visning, full høyde', T1.open && T1.title === 'Tilpass strøm' && T1.btns.join() === 'Nullstill,Ferdig' && T1.tabs.join() === 'Faner,Entiteter,Kurser,Visning' && T1.h >= T1.vh - 60 && T1.rows === 3, T1);
await p.evaluate(() => window.__tp.shadowRoot.querySelector('.gz').click()); await wait(450);
const T58 = await p.evaluate(() => Math.round(window.__tp.shadowRoot.querySelector('.sh').getBoundingClientRect().height / innerHeight * 100));
ok('håndtaket bytter til 58 %', Math.abs(T58 - 58) <= 2, T58);
const tpClick = async (sel) => { await p.evaluate((sel) => window.__tp.shadowRoot.querySelector(sel).click(), sel); await wait(250); };
await tpClick('[data-a="tptab"][data-v="vis"]');
// Fiks 47 O: lange seksjoner er akkordeoner (lukket som standard)
await tpClick('[data-a="acc"][data-v="ts"]');
await tpClick('[data-a="ts"][data-v="ikoner"]');
await tpClick('[data-a="acc"][data-v="ex"]');
await tpClick('[data-a="exp"][data-v="norge"]');
await tpClick('[data-a="exs"][data-v="tv"]');
await tpClick('[data-a="acc"][data-v="uc"]');
await tpClick('[data-a="uc"][data-s="0"][data-v="cost"]');
await tpClick('[data-a="gear"][data-v="tab"]');
await tpClick('[data-a="tptab"][data-v="ent"]');
await tpClick('[data-a="ent"][data-v="effekt"]');
const pick = await p.evaluate(() => { const b = window.__tp.shadowRoot.querySelector('[data-a="pick"]'); const v = b && b.dataset.v; if (b) b.click(); return v; }); await wait(300);
const TS = await p.evaluate(() => { const c = window.__card.config, R = window.__card.shadowRoot; return { cfg: { tabStyle: c.tabStyle, exPrice: c.exPrice, exShow: c.exShow, useCards: c.useCards, gear: c.gear, ent: c.ent }, tgear: !!R.querySelector('.tgear'), hgear: !!R.querySelector('.hgear'), kurs: !!window.__tp.shadowRoot.querySelector('.tpt') }; });
ok('Tilpass → Visning/Entiteter lagrer tabStyle, exPrice, exShow, useCards, gear, ent – popupen følger live', TS.cfg.tabStyle === 'ikoner' && TS.cfg.exPrice === 'norge' && TS.cfg.exShow.includes('tv') && TS.cfg.useCards[0] === 'cost' && TS.cfg.gear === 'tab' && TS.tgear && !TS.hgear && TS.cfg.ent && TS.cfg.ent.effekt === pick, TS);
await tpClick('[data-a="tptab"][data-v="kurs"]');
const TK = await p.evaluate(() => { const r = window.__tp.shadowRoot; return { ed: !!r.querySelector('[data-skedit]'), n: (r.querySelector('[data-skedit]') || { textContent: '' }).textContent.length, wait: /lastes/.test(r.querySelector('.tpb').textContent) }; });
ok('Tilpass → Kurser viser Kurser-editoren (modul B)' + (G.mods.B ? '' : ' (plassholder)'), G.mods.B ? TK.ed && TK.n > 50 : TK.wait, TK);
await tpClick('[data-a="tptab"][data-v="faner"]');
await tpClick('[data-a="eye"][data-v="Kurser"]');
const HD = await p.evaluate(() => ({ hid: window.__card.config.hid, tabs: [...window.__card.shadowRoot.querySelectorAll('[data-tabbar] button')].map((x) => x.dataset.v) }));
ok('Faner: øyet skjuler fanen (hid) og fanelinja oppdateres', HD.hid && HD.hid.Kurser === true && !HD.tabs.includes('Kurser'), HD);
await tpClick('[data-a="reset"]');
const RS = await p.evaluate(() => { const c = window.__card.config; return { hid: c.hid, order: c.order, tabStyle: c.tabStyle, ent: c.ent }; });
ok('Nullstill fjerner valgene', !RS.hid && !RS.order && !RS.tabStyle && !RS.ent, RS);
await tpClick('[data-a="done"]'); await wait(400);
ok('Ferdig lukker arket', await p.evaluate(() => !window.MSH.portals().some((x) => x.shadowRoot && x.shadowRoot.querySelector('.tp') && x.isConnected)));

// ---- GUI-editoren: samme valg, samme nøkler
const GE = await p.evaluate(async () => {
  const wait = (ms) => new Promise((q) => setTimeout(q, ms));
  const cls = customElements.get('msh-strom-card'), ed = cls.getConfigElement();
  document.body.appendChild(ed); ed.hass = window.__h; ed.setConfig({ type: 'custom:msh-strom-card', card_id: 'gui-strom-test' });
  const out = [];
  ed.addEventListener('config-changed', (e) => out.push(e.detail.config));
  const R = ed.shadowRoot, click = async (s) => { R.querySelector(s).click(); await wait(80); };
  const tabs = [...R.querySelectorAll('.tpt button')].map((x) => x.title);
  await click('[data-a="tptab"][data-v="vis"]');
  await click('[data-a="acc"][data-v="ts"]'); await click('[data-a="ts"][data-v="kompakt"]'); await click('[data-a="size"][data-v="kompakt"]'); await click('[data-a="start"][data-v="Forbruk"]'); await click('[data-a="sw"][data-v="anim"]');
  const last = out[out.length - 1] || {};
  ed.remove();
  return { tabs, n: out.length, cfg: { tabStyle: last.tabStyle, cardSize: last.cardSize, start: last.start, anim: last.anim, card_id: last.card_id } };
});
ok('GUI-editoren: samme fire faner og samme nøkler (tabStyle, cardSize, start, anim)', GE.tabs.join() === 'Faner,Entiteter,Kurser,Visning' && GE.cfg.tabStyle === 'kompakt' && GE.cfg.cardSize === 'kompakt' && GE.cfg.start === 'Forbruk' && GE.cfg.anim === false && GE.cfg.card_id === 'gui-strom-test', GE);

// ---- undersider
await p.evaluate(() => window.__card.shadowRoot.querySelector('.bill').click()); await wait(700);
const S1 = await p.evaluate(() => { const R = window.__card.shadowRoot; return { page: window.__card.ui.page, hero: !!R.querySelector('.hero'), ss: !!R.querySelector('[data-sshost]'), txt: (R.querySelector('[data-sshost]') || { textContent: '' }).textContent.replace(/\s+/g, ' ').slice(0, 80), back: !!R.querySelector('[data-ss-act="back"],[data-act="back"]') }; });
ok('Regning-kortet åpner undersiden Strømregning (modul C) med tilbake-pil' + (G.mods.C ? '' : ' (plassholder)'), S1.page === 'stromregning' && !S1.hero && S1.ss && S1.back && (!G.mods.C || /Strømregning/.test(S1.txt)), S1);
await p.evaluate(() => window.__card.shadowRoot.querySelector('[data-ss-act="back"],[data-act="back"]').click()); await wait(500);
const S2 = await p.evaluate(() => ({ page: window.__card.ui.page || null, hero: !!window.__card.shadowRoot.querySelector('.hero') }));
ok('tilbake-pila går tilbake til hovedsiden', !S2.page && S2.hero, S2);
await p.evaluate(() => { location.hash = '#norgespris'; }); await wait(1300);
const S3 = await p.evaluate(() => { const pe = window.__all().find((e) => e.classList && e.classList.contains('bubble-pop-up') && e.classList.contains('is-popup-opened')); const c = pe && [...pe.querySelectorAll('*')].find((e) => e.localName === 'msh-strom-card'); return { hash: location.hash, open: !!c, page: c && c.ui.page, alias: window.MSH.canonHash('#stromregning') }; });
ok('#norgespris åpner #strom på undersiden Norgespris (#stromregning er alias)', S3.hash === '#strom' && S3.open && S3.page === 'norgespris' && S3.alias === '#strom', S3);

ok('ingen JS-feil', errs.length === 0, errs.slice(0, 5));
await b.close();
try { rmSync(bundle); } catch (e) { /* */ }
console.log(fail.length ? `\n${fail.length} feil` : '\nAlle bestod');
process.exit(fail.length ? 1 : 0);
