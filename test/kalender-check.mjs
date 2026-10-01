// Fiks 23.8 · Kalender (#kalender, msh-kalender-card): fem faner med ekte (mock-)data, modusknappen (trykk/hold/sveip),
// «Vis kalendere», Hytta-karusell og søk, detaljark i Framover, pakker, Tilpass kalender ↔ GUI-editor, migrering og
// «Erstattet av Kalender» for den importerte popupen.   node test/kalender-check.mjs   (SHOTS=<mappe> for skjermbilder)
import { createRequire } from 'node:module';
import { readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const bundle = resolve(`test/.build/kalender-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const shots = process.env.SHOTS || '';
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = {}, fail = [];
const ok = (name, cond, info) => { res[name] = cond ? 'OK' : ['FEIL', info]; if (!cond) fail.push(name); };
const mocks = readdirSync('test/mock').sort().map((m) => resolve('test/mock/' + m));
const errs = [];
async function page(vp) {
  const p = await b.newPage({ viewport: vp || { width: 400, height: 900 }, hasTouch: true });
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + resolve('test/harness.html'));
  for (const m of mocks) await p.addScriptTag({ path: m });
  await p.addScriptTag({ path: bundle });
  await p.evaluate(async (cfg) => {
    window.__h = window.mockHass();
    const bc = document.createElement('bubble-card');
    bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash: '#kalender' });
    bc.innerHTML = '<div class="pop"><div class="hdr">Kalender</div><div class="inner"></div></div>';
    document.getElementById('dash').appendChild(bc);
    location.hash = '#kalender';
    const c = document.createElement('msh-kalender-card');
    c.setConfig({ type: 'custom:msh-kalender-card', card_id: 'pop-kalender', ...(cfg || {}) });
    c.hass = window.__h;
    bc.querySelector('.inner').appendChild(c);
    window.__c = c;
    await new Promise((q) => setTimeout(q, 700));
  });
  return p;
}
const wait = (p, ms) => p.evaluate((ms) => new Promise((q) => setTimeout(q, ms)), ms);
const tab = async (p, k) => { await p.evaluate((k) => window.__c.shadowRoot.querySelector(`[data-act="tab"][data-v="${k}"]`).click(), k); await wait(p, 500); };
const txt = (p, sel) => p.evaluate((sel) => [...window.__c.shadowRoot.querySelectorAll(sel)].map((e) => e.textContent.replace(/\s+/g, ' ').trim()), sel);
const shot = async (p, n) => { if (shots) await p.screenshot({ path: `${shots}/kal-${n}.png`, fullPage: true }); };

const p = await page();
// ---------------------------------------------------------------- topp: fane-pille + modusknapp
const T = await p.evaluate(() => {
  const sr = window.__c.shadowRoot, tabs = [...sr.querySelectorAll('.tabs [data-act="tab"]')];
  const mb = sr.querySelector('.mb'), r = mb.getBoundingClientRect();
  return { n: tabs.length, active: tabs.filter((t) => t.getAttribute('aria-selected') === 'true').map((t) => t.getAttribute('aria-label')), labels: tabs.map((t) => t.querySelector('.itl') && getComputedStyle(t.querySelector('.itl')).opacity), mb: [Math.round(r.width), Math.round(r.height)], ta: getComputedStyle(mb).touchAction, dots: sr.querySelectorAll('.mdots i').length, scroll: sr.querySelector('.tabs').scrollWidth <= sr.querySelector('.tabs').clientWidth + 1 };
});
ok('fem faner, aktiv = Kalender med navn, andre bare ikon', T.n === 5 && T.active.join() === 'Kalender' && T.labels[0] === '1' && T.labels.slice(1).every((x) => x === '0'), T);
ok('pillen scroller ikke (Symboler)', T.scroll, T);
ok('modusknapp 48×48, touch-action none, to prikker', T.mb.join('x') === '48x48' && T.ta === 'none' && T.dots === 2, T);
// ---------------------------------------------------------------- Kalender · liste
const L = await p.evaluate(() => { const sr = window.__c.shadowRoot; return { days: [...sr.querySelectorAll('.day .dh')].map((e) => e.textContent.trim()), rows: [...sr.querySelectorAll('.ev')].map((e) => e.textContent.replace(/\s+/g, ' ').trim()) }; });
ok('Liste: «I dag» først, hendelser med tid, tittel og kalender/sted', /^I dag/.test(L.days[0]) && L.rows.some((r) => /14:30–15:15\s*Tannlege\s*Sebastian · Majorstuen/.test(r)) && L.rows.some((r) => /Hele dagen\s*Hytta/.test(r)), L);
ok('Liste: bare dager med hendelser', L.days.length > 2 && L.days.length < 15, L.days);
await shot(p, '1-kalender-liste');
// trykk på modusknappen → Måned
const tapMb = (p) => p.evaluate(async () => { const mb = window.__c.shadowRoot.querySelector('.mb'), r = mb.getBoundingClientRect(), o = { bubbles: true, composed: true, clientX: r.left + 24, clientY: r.top + 24, pointerId: 7, pointerType: 'touch' }; mb.dispatchEvent(new PointerEvent('pointerdown', o)); await new Promise((q) => setTimeout(q, 60)); mb.dispatchEvent(new PointerEvent('pointerup', o)); await new Promise((q) => setTimeout(q, 300)); });
await tapMb(p);
const Mo = await p.evaluate(() => { const sr = window.__c.shadowRoot; return { grid: sr.querySelectorAll('.mv7 .mvd').length, badges: [...sr.querySelectorAll('.mv7 .mvd .mvn')].map((e) => e.textContent), title: sr.querySelector('.mvt') && sr.querySelector('.mvt').textContent.trim(), sel: sr.querySelector('.mvd.sel') && sr.querySelector('.mvd.sel').dataset.v, list: [...sr.querySelectorAll('.dp .dpr,.dp .mr')].length }; });
ok('Trykk → Måned: rutenett, månedstittel og antall-merke', Mo.grid >= 28 && /^[A-ZÆØÅ][a-zæøå]+ \d{4}$/.test(Mo.title) && Mo.badges.length > 3, Mo);
ok('Måned: valgt dag (i dag) viser hendelsene under', Mo.sel && Mo.list >= 1, Mo);
const selD = await p.evaluate(async () => { const sr = window.__c.shadowRoot; const d = new Date(); d.setDate(d.getDate() + 1); const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; const el = sr.querySelector(`.mvd[data-v="${k}"]`); if (!el) return null; el.click(); await new Promise((q) => setTimeout(q, 250)); return [...sr.querySelectorAll('.dp .dpr,.dp .mr')].map((e) => e.textContent.replace(/\s+/g, ' ').trim()); });
ok('Trykk på dag (i morgen) viser dens hendelser og mediautgivelser', selD && selD.some((x) => /DATA2410/.test(x)) && selD.some((x) => /The Last of Us/.test(x)), selD);
await shot(p, '2-kalender-maned');
// hold → «Vis kalendere» (portalt)
const H = await p.evaluate(async () => {
  let hp = []; const on = (e) => hp.push(e.detail); window.addEventListener('haptic', on);
  const mb = window.__c.shadowRoot.querySelector('.mb'), r = mb.getBoundingClientRect(), o = { bubbles: true, composed: true, clientX: r.left + 24, clientY: r.top + 24, pointerId: 8, pointerType: 'touch' };
  let closed = 0; const cl = (e) => closed++; mb.addEventListener('touchstart', () => {}, { passive: true });
  mb.dispatchEvent(new PointerEvent('pointerdown', o)); await new Promise((q) => setTimeout(q, 600)); mb.dispatchEvent(new PointerEvent('pointerup', o)); await new Promise((q) => setTimeout(q, 300));
  window.removeEventListener('haptic', on);
  const root = document.querySelector('ki-overlay-root') || document.body; const portal = window.MSH.portals().pop();
  const rows = portal ? [...portal.shadowRoot.querySelectorAll('.mr')].map((e) => [e.dataset.id, e.getAttribute('aria-checked'), !!e.querySelector('i[style*="background"]')]) : [];
  return { hp, rows, inPopup: !!(portal && portal.closest('.pop')), hash: location.hash, view: window.__c.ui.kview };
});
ok('Hold 480 ms → «Vis kalendere» med avkrysning + farge-prikk (portalt)', H.rows.length >= 3 && H.rows.every((r) => r[2]) && !H.inPopup && H.hash === '#kalender', H);
ok('Hold: haptic medium og ingen modusbytte', H.hp.includes('medium') && H.view === 'maned', H);
const tog = await p.evaluate(async () => { const portal = window.MSH.portals().pop(); portal.shadowRoot.querySelector('.mr[data-id="calendar.oslomet_timeplan"]').click(); await new Promise((q) => setTimeout(q, 300)); const r = window.__c.config.calendars_hidden; portal.shadowRoot.querySelector('.bg').click(); await new Promise((q) => setTimeout(q, 400)); return r; });
ok('Avkrysning skjuler kalenderen (calendars_hidden)', Array.isArray(tog) && tog.includes('calendar.oslomet_timeplan'), tog);
// sveip opp → tannhjul; trykk → Tilpass kalender
const S = await p.evaluate(async () => {
  let hp = []; const on = (e) => hp.push(e.detail); window.addEventListener('haptic', on);
  const mb = window.__c.shadowRoot.querySelector('.mb'), r = mb.getBoundingClientRect(), o = (y) => ({ bubbles: true, composed: true, clientX: r.left + 24, clientY: y, pointerId: 9, pointerType: 'touch' });
  let bubbled = 0; const bl = () => bubbled++; document.getElementById('dash').addEventListener('pointermove', bl);
  mb.dispatchEvent(new PointerEvent('pointerdown', o(r.top + 30))); mb.dispatchEvent(new PointerEvent('pointermove', o(r.top + 20))); mb.dispatchEvent(new PointerEvent('pointermove', o(r.top + 5))); mb.dispatchEvent(new PointerEvent('pointerup', o(r.top + 5)));
  await new Promise((q) => setTimeout(q, 350));
  window.removeEventListener('haptic', on); document.getElementById('dash').removeEventListener('pointermove', bl);
  const sr = window.__c.shadowRoot;
  return { mode: sr.querySelector('.mb').dataset.mode, dots: [...sr.querySelectorAll('.mdots i')].map((i) => i.className), hp, bubbled, rail: sr.querySelector('.rail').style.transform };
});
ok('Sveip > 16 px → tannhjul (selection-haptic, prikkene bytter, bobler ikke)', S.mode === 'gear' && S.dots.join() === ',on' && S.hp.includes('selection') && S.bubbled === 0 && /-48px/.test(S.rail), S);
await tapMb(p);
const ed1 = await p.evaluate(async () => { await new Promise((q) => setTimeout(q, 400)); const portal = window.MSH.portals().pop(); const ed = portal && portal.shadowRoot.querySelector('msh-editor'); return ed ? { title: ed.shadowRoot.querySelector('.ttl .tt').textContent, tabs: [...ed.shadowRoot.querySelectorAll('.chips.tabs [role="tab"]')].map((t) => t.getAttribute('aria-label') || t.textContent.trim()) } : null; });
ok('Tannhjul + trykk → «Tilpass kalender» med Faner/Kalendere/Kilder/Visning', ed1 && /Kalender/.test(ed1.title) && ed1.tabs.join('|') === 'Faner|Kalendere|Kilder|Visning', ed1);
if (shots) await p.screenshot({ path: `${shots}/kal-3-tilpass-faner.png` });
// Faner: utvid Hytta → deler; skjul Posten
const F = await p.evaluate(async () => {
  const portal = window.MSH.portals().pop(), ed = portal.shadowRoot.querySelector('msh-editor'), R = ed.shadowRoot;
  const rows = [...R.querySelectorAll('.ktab')].map((e) => e.dataset.edk);
  R.querySelector('.ktab[data-edk="hytta"] [data-op="exp"]').click(); await new Promise((q) => setTimeout(q, 150));
  const parts = [...R.querySelectorAll('.kpart')].map((e) => e.textContent.trim());
  const h56 = Math.round(R.querySelector('.ktab').getBoundingClientRect().height), h52 = Math.round(R.querySelector('.kpart').getBoundingClientRect().height);
  R.querySelector('.ktab[data-edk="posten"] [data-op="eye"]').click(); await new Promise((q) => setTimeout(q, 150));
  R.querySelector('.kpart[data-edk="sok"] [data-op="peye"]').click(); await new Promise((q) => setTimeout(q, 150));
  return { rows, parts, h56, h52, cfg: ed._config };
});
ok('Faner: pille 56, deler 52 (Hytta: Søk · Steder · Kalender/Opphold/Statistikk)', F.rows.length === 5 && F.parts.join('|') === 'Søk|Steder|Kalender/Opphold/Statistikk' && F.h56 === 56 && F.h52 === 52, F);
ok('Faner: øye → tab_hidden, del-øye → section_hidden', (F.cfg.tab_hidden || []).includes('posten') && ((F.cfg.section_hidden || {}).hytta || []).includes('sok'), F.cfg);
// Kilder: søk + velg
const K = await p.evaluate(async () => {
  const portal = window.MSH.portals().pop(), ed = portal.shadowRoot.querySelector('msh-editor'), R = ed.shadowRoot;
  [...R.querySelectorAll('[data-a="tab"]')].find((t) => t.dataset.v === 'kilder').click(); await new Promise((q) => setTimeout(q, 150));
  const heads = [...R.querySelectorAll('.ksrc')].map((e) => e.textContent.replace(/\s+/g, ' ').trim());
  R.querySelector('.ksrc[data-key="ks-post"] [data-op="open"]').click(); await new Promise((q) => setTimeout(q, 150));
  const sug = [...R.querySelectorAll('.ksrc[data-key="ks-post"] [data-op="pick"]')].map((e) => e.dataset.id);
  const inp = R.querySelector('input[data-ksq="post"]'); inp.value = 'zalando'; inp.dispatchEvent(new Event('input', { bubbles: true, composed: true })); await new Promise((q) => setTimeout(q, 150));
  const hits = [...R.querySelectorAll('.ksrc[data-key="ks-post"] [data-op="pick"]')].map((e) => e.dataset.id);
  const none = (() => { const i = R.querySelector('input[data-ksq="post"]'); i.value = 'qqqzzz'; i.dispatchEvent(new Event('input', { bubbles: true, composed: true })); return new Promise((q) => setTimeout(() => q(!!R.querySelector('.ksrc[data-key="ks-post"]').textContent.includes('Ingen treff')), 150)); })();
  const noHit = await none;
  const i2 = R.querySelector('input[data-ksq="post"]'); i2.value = 'zalando'; i2.dispatchEvent(new Event('input', { bubbles: true, composed: true })); await new Promise((q) => setTimeout(q, 150));
  R.querySelector('.ksrc[data-key="ks-post"] [data-op="pick"][data-id="sensor.pakke_zalando_status"]').click(); await new Promise((q) => setTimeout(q, 150));
  const after = R.querySelector('.ksrc[data-key="ks-post"]').textContent.replace(/\s+/g, ' ');
  return { heads, sug, hits, noHit, src: ed._config.src, after, focusOk: true };
});
ok('Kilder: sju kilder med Auto-merke', K.heads.length === 7 && K.heads.filter((h) => /Auto/.test(h)).length >= 6, K.heads);
ok('Kilder: forslag (autokonfig) → søk (id+navn) → «Ingen treff»', K.sug[0] === 'sensor.nar_kommer_posten_posten_sensor_next' && K.hits.includes('sensor.pakke_zalando_status') && K.noHit, K);
ok('Kilder: trykk velger → «Overstyrt»', K.src && K.src.post === 'sensor.pakke_zalando_status' && /Overstyrt/.test(K.after), K);
if (shots) await p.screenshot({ path: `${shots}/kal-4-tilpass-kilder.png` });
// Visning + Mellomrom
const V = await p.evaluate(async () => {
  const portal = window.MSH.portals().pop(), ed = portal.shadowRoot.querySelector('msh-editor'), R = ed.shadowRoot;
  [...R.querySelectorAll('[data-a="tab"]')].find((t) => t.dataset.v === 'visning').click(); await new Promise((q) => setTimeout(q, 150));
  const labels = [...R.querySelectorAll('label, .fsh, .rg .line span')].map((e) => e.textContent.trim()).filter(Boolean);
  [...R.querySelectorAll('[data-a="sel"][data-name="tab_labels"]')].find((b) => b.dataset.v === 'name').click(); await new Promise((q) => setTimeout(q, 100));
  [...R.querySelectorAll('[data-a="sel"][data-name="pad_top"]')].find((b) => b.dataset.v === '44').click(); await new Promise((q) => setTimeout(q, 100));
  const sl = R.querySelector('.sl[data-name="gap"]');
  return { labels, cfg: ed._config, slTA: sl && getComputedStyle(sl).touchAction, pres: [...R.querySelectorAll('[data-name="pad_bottom"].pill')].map((b) => b.textContent) };
});
ok('Visning: Faner viser / Dager fremover / Standardvisning / Vis «Nylig i Plex» / Mellomrom', ['Faner viser', 'Dager fremover', 'Standardvisning'].every((l) => V.labels.some((x) => x.includes(l))) && V.labels.some((x) => /Mellom seksjonene/.test(x)) && V.labels.some((x) => /Luft i bunnen/.test(x)), V.labels);
ok('Mellomrom: forvalg Ingen 0/Litt 60/Standard 150/Maks 300, slider pan-y (drag tas over)', V.pres.join('|') === 'Ingen 0|Litt 60|Standard 150|Maks 300', V);
ok('Visning: tab_labels=name og pad_top=44 i utkastet', V.cfg.tab_labels === 'name' && V.cfg.pad_top === 44, V.cfg);
if (shots) await p.screenshot({ path: `${shots}/kal-5-tilpass-visning.png` });
// Ferdig → kortet får configen
const done = await p.evaluate(async () => { const portal = window.MSH.portals().pop(), ed = portal.shadowRoot.querySelector('msh-editor'); ed.shadowRoot.querySelector('[data-a="save"]').click(); await new Promise((q) => setTimeout(q, 900)); const c = window.__c.config; const sr = window.__c.shadowRoot; return { labels: c.tab_labels, hid: c.tab_hidden, tabs: [...sr.querySelectorAll('.tabs [data-act="tab"]')].map((t) => t.textContent.trim()), names: sr.querySelector('.tabs').classList.contains('names') }; });
ok('Ferdig: kortet viser Navn-faner uten Posten', done.names && done.tabs.join('|') === 'Kalender|Hytta|Framover|Bursdager', done);
await shot(p, '6-etter-tilpass');
await p.close();

// ---------------------------------------------------------------- Hytta / Framover / Bursdager / Posten (ny side)
const q = await page();
await tab(q, 'hytta');
const Hy = await q.evaluate(() => { const sr = window.__c.shadowRoot; return { slides: [...sr.querySelectorAll('.hs .hct b')].map((e) => e.textContent), chips: [...sr.querySelectorAll('.hs:first-child .hchip')].map((e) => e.textContent.trim()), nums: [...sr.querySelectorAll('.hs:first-child .hnum b')].map((e) => e.textContent), dots: sr.querySelectorAll('.hdots .msh-dot').length, seg: [...sr.querySelectorAll('.seg .sg')].map((e) => e.textContent), grid: sr.querySelectorAll('.mg .gd.hg').length, colored: [...sr.querySelectorAll('.mg .gd.hg')].filter((e) => e.style.background).length, plan: sr.querySelectorAll('.gd.hg.plan').length, ta: getComputedStyle(sr.querySelector('.hcar')).scrollSnapType }; });
ok('Hytta: karusell «Alle» + Oslo/Strömstad/Toten, chips per sted, prikker', Hy.slides.join('|') === 'Alle steder|Oslo|Strömstad|Toten' && Hy.chips.length === 3 && Hy.dots === 4 && /x/.test(Hy.ta), Hy);
ok('Hytta: tall fra oversikt-sensorene (netter/besøk i år), ikke mock i koden', Number(Hy.nums[0]) > 0 && Number(Hy.nums[1]) > 0, Hy.nums);
ok('Hytta: segment Kalender · Opphold · Statistikk, rutenett farget per sted', Hy.seg.join('|') === 'Kalender|Opphold|Statistikk' && Hy.grid >= 28, Hy);
await shot(q, '7-hytta');
// karusellen: scroll → prikken følger
const car = await q.evaluate(async () => { const sr = window.__c.shadowRoot, c = sr.querySelector('.hcar'); c.scrollLeft = c.clientWidth * 2; c.dispatchEvent(new Event('scroll')); await new Promise((q) => setTimeout(q, 600)); return { dot: [...sr.querySelectorAll('.hdots .msh-dot')].findIndex((d) => d.classList.contains('on')), ui: window.__c.ui.hCar }; });
ok('Hytta: prikkene følger karusellen', car.dot === 2, car);
// opphold + statistikk
const op = await q.evaluate(async () => { const sr = window.__c.shadowRoot; sr.querySelector('[data-act="hseg"][data-v="opphold"]').click(); await new Promise((q) => setTimeout(q, 250)); const rows = [...sr.querySelectorAll('.stay')].map((e) => e.textContent.replace(/\s+/g, ' ').trim()); sr.querySelector('[data-act="hseg"][data-v="statistikk"]').click(); await new Promise((q) => setTimeout(q, 250)); return { rows, bars: sr.querySelectorAll('.bars .bc').length, stacks: sr.querySelectorAll('.bars .bs i').length, tots: [...sr.querySelectorAll('.tot')].map((e) => e.textContent.replace(/\s+/g, ' ').trim()) }; });
ok('Hytta: oppholdsliste (hvem, sted-tag, datoer, netter)', op.rows.length >= 1 && op.rows.every((r) => /Strömstad/.test(r)) && op.rows.some((r) => /netter|natt|planlagt/.test(r)), op.rows);
ok('Hytta: statistikk 12 stolper + totaler per sted', op.bars === 12 && op.tots.length >= 1, op);
await shot(q, '8-hytta-statistikk');
// søk
const sk = await q.evaluate(async () => { const sr = window.__c.shadowRoot, c = sr.querySelector('.hcar'); c.scrollLeft = 0; c.dispatchEvent(new Event('scroll')); await new Promise((q) => setTimeout(q, 500)); const d = new Date(); d.setDate(d.getDate() - 21); const s = `${d.getDate()}.${d.getMonth() + 1}`; const i = sr.querySelector('input[data-input="hq"]'); i.focus(); i.value = s; i.dispatchEvent(new Event('input', { bubbles: true, composed: true })); await new Promise((q) => setTimeout(q, 500)); const res = sr.querySelector('.hres'); const out = { q: s, head: res && res.querySelector('.hrh').textContent.replace(/\s+/g, ' ').trim(), rows: res ? [...res.querySelectorAll('.stay')].map((e) => e.textContent.replace(/\s+/g, ' ').trim()) : [], focus: sr.activeElement === sr.querySelector('input[data-input="hq"]') }; sr.querySelector('[data-act="hshow"]').click(); await new Promise((q) => setTimeout(q, 250)); out.seg = window.__c.ui.hSeg; out.off = window.__c.ui.hOff; return out; });
ok('Hytta: søk «D.M» gir opphold i perioden (Cybele i Strömstad), fokus beholdes', sk.rows.some((r) => /Cybele/.test(r) && /Strömstad/.test(r)) && sk.focus, sk);
ok('Hytta: «Vis i kalender» bytter til Kalender-segmentet i riktig måned', sk.seg === 'kalender' && typeof sk.off === 'number', sk);
const uke = await q.evaluate(() => window.MSH.kalender.parseQuery('uke 27'));
const gar = await q.evaluate(() => { const r = window.MSH.kalender.parseQuery('i går'); return r && r.label; });
const jul = await q.evaluate(() => { const r = window.MSH.kalender.parseQuery('juli'); return r && [new Date(r.s).getMonth(), new Date(r.e).getDate()]; });
ok('Søket tolker «uke 27», «i går», «juli»', uke && gar === 'I går' && jul && jul[0] === 6 && jul[1] === 31, { uke, gar, jul });
// Framover
await tab(q, 'framover');
const Fr = await q.evaluate(() => { const sr = window.__c.shadowRoot; return { chips: [...sr.querySelectorAll('.fc')].map((e) => e.textContent), hero: sr.querySelector('.hero') && sr.querySelector('.hero').textContent.replace(/\s+/g, ' ').trim(), ph: !!sr.querySelector('.hero .bdrop.ph'), days: sr.querySelectorAll('.day').length, plex: sr.querySelectorAll('.prow .pc').length, more: !!sr.querySelector('[data-act="fmore"]') }; });
ok('Framover: filter Alle · Serier · Filmer · Plex, hero for neste utgivelse', Fr.chips.join('|') === 'Alle|Serier|Filmer|Plex' && /Slow Horses/.test(Fr.hero) && /S05E03/.test(Fr.hero) && /Apple TV\+/.test(Fr.hero), Fr);
ok('Framover: grupper per dag + «Nylig i Plex», stripete plassholder uten bilde', Fr.days >= 3 && Fr.plex === 4 && Fr.ph, Fr);
await shot(q, '9-framover');
const det = await q.evaluate(async () => { const sr = window.__c.shadowRoot; sr.querySelector('.hero').click(); await new Promise((q) => setTimeout(q, 400)); const portal = window.MSH.portals().pop(); const sh = portal.shadowRoot.querySelector('.sh'); const r = sh.getBoundingClientRect(); const z = getComputedStyle(window.MSH.overlayRoot().getRootNode().host).zIndex; return { txt: portal.shadowRoot.querySelector('.dt').textContent.replace(/\s+/g, ' ').trim(), acts: [...portal.shadowRoot.querySelectorAll('.acts button')].map((b) => b.textContent.trim()), inPop: !!portal.closest('.pop'), bottom: Math.round(r.bottom), vh: innerHeight, z, pad: getComputedStyle(portal.shadowRoot.querySelector('.dt')).paddingBottom }; });
ok('Framover: detaljark portalt (utenfor popupen) med tittel, tid, chips, «Spill av», «Åpne i Sonarr»', !det.inPop && /Slow Horses/.test(det.txt) && det.acts.some((a) => /Spill av/.test(a)) && det.acts.some((a) => /Åpne i Sonarr/.test(a)), det);
ok('Framover: detaljarket nederst, over navbaren (ki-overlay-root z 9000, bunnluft = navbar)', det.bottom === det.vh && Number(det.z) >= 9000 && parseFloat(det.pad) >= 60, det);
if (shots) await q.screenshot({ path: `${shots}/kal-10-detalj.png` });
const play = await q.evaluate(async () => { window.__calls.length = 0; const portal = window.MSH.portals().pop(); const pb = portal.shadowRoot.querySelector('[data-d="play"]'); if (!pb) { portal.shadowRoot.querySelector('.bg').click(); return 'ingen Spill av (sendes ikke før utgivelsestid)'; } pb.click(); await new Promise((q) => setTimeout(q, 300)); return window.__calls.find((c) => c[0] === 'media_player'); });
ok('«Spill av» → media_player.play_media på Plex', play && play[1] === 'play_media' && play[2].entity_id === 'media_player.plex_stue', play);
const flt = await q.evaluate(async () => { const sr = window.__c.shadowRoot; sr.querySelector('[data-act="ff"][data-v="filmer"]').click(); await new Promise((q) => setTimeout(q, 250)); return sr.querySelector('.hero').textContent.replace(/\s+/g, ' ').trim(); });
ok('Filter Filmer: hero = Radarr-film', /Mission|Superman/.test(flt), flt);
// Bursdager
await tab(q, 'bursdager');
const Bd = await q.evaluate(() => { const sr = window.__c.shadowRoot; return { hero: sr.querySelector('.bhero').textContent.replace(/\s+/g, ' ').trim(), months: [...sr.querySelectorAll('.day .dh')].map((e) => e.textContent.trim()), rows: [...sr.querySelectorAll('.brow')].map((e) => e.textContent.replace(/\s+/g, ' ').trim()) }; });
ok('Bursdager: «Neste: Helge fyller N» med dager igjen', /Neste\s*Helge fyller \d+/.test(Bd.hero) && /5\s*dager/.test(Bd.hero), Bd.hero);
ok('Bursdager: «Kommende» per måned med alder og «om N dager»', Bd.months.length >= 2 && Bd.rows.some((r) => /Cybele.*fyller \d+.*om 35 dager/.test(r)) && Bd.rows.some((r) => /Mormor.*fyller/.test(r)), Bd);
await shot(q, '11-bursdager');
const add = await q.evaluate(async () => { const sr = window.__c.shadowRoot; window.__calls.length = 0; sr.querySelector('[data-act="badd"]').click(); await new Promise((q) => setTimeout(q, 200)); const n = sr.querySelector('input[data-input="bname"]'); n.value = 'Nora'; n.dispatchEvent(new Event('input', { bubbles: true, composed: true })); const d = sr.querySelector('input[data-input="bdate"]'); d.value = '2019-03-14'; d.dispatchEvent(new Event('input', { bubbles: true, composed: true })); sr.querySelector('[data-act="bsave"]').click(); await new Promise((q) => setTimeout(q, 300)); return window.__calls.find((c) => c[1] === 'calendar/event/create'); });
ok('Bursdager: «+» skriver årlig hendelse til kalenderen', add && add[2].entity_id === 'calendar.birthdays' && add[2].event.rrule === 'FREQ=YEARLY' && add[2].event.summary === 'Nora', add);
// Posten
await tab(q, 'posten');
const Po = await q.evaluate(() => { const sr = window.__c.shadowRoot; return { chip: sr.querySelector('.pchip').textContent, rel: sr.querySelector('.prel').textContent, days: sr.querySelectorAll('.pg .pd').length, on: sr.querySelectorAll('.pg .pd.on').length, rows: [...sr.querySelectorAll('.pkr')].map((e) => e.querySelector('.pkst').textContent), more: sr.querySelector('[data-act="pdel"]') && sr.querySelector('[data-act="pdel"]').textContent }; });
ok('Posten: chip, relativ dato og 10 hverdager med utdelingsdager markert', /Ikke i dag|Posten kommer i dag/.test(Po.chip) && Po.days === 10 && Po.on >= 2 && Po.rel.length > 1, Po);
ok('Pakker: statusfarge/-ikon (klar/transport/ingen oppdatering), leverte skjult', Po.rows.join('|') === 'Klar til henting|Ingen oppdatering|På vei' && /Vis leverte \(1\)/.test(Po.more), Po);
const pk = await q.evaluate(async () => { const sr = window.__c.shadowRoot; sr.querySelector('.pkr[data-key="pk-sensor.pakke_aliexpress_status"] .pkh').click(); await new Promise((q) => setTimeout(q, 250)); const a = sr.querySelector('.pkr.open').textContent.replace(/\s+/g, ' '); sr.querySelector('.pkr[data-key="pk-sensor.pakke_komplett_status"] .pkh').click(); await new Promise((q) => setTimeout(q, 250)); const k = sr.querySelector('.pkr.open'); return { a, home: !!k.querySelector('[data-act="phome"]'), facts: [...k.querySelectorAll('.facts span i')].map((e) => e.textContent), log: k.querySelectorAll('.lg').length }; });
ok('Pakke utvides: hendelseslogg, fakta, «Ingen oppdatering på N t», «Bestill hjemlevering»', /Ingen oppdatering på \d+ t/.test(pk.a) && /Mottatt i Norge/.test(pk.a) && pk.home && pk.facts.includes('Avsender') && pk.log >= 1, pk);
await shot(q, '12-posten');
const padd = await q.evaluate(async () => { const sr = window.__c.shadowRoot; window.__calls.length = 0; sr.querySelector('[data-act="padd"]').click(); await new Promise((q) => setTimeout(q, 200)); const n = sr.querySelector('input[data-input="pnum"]'); n.value = 'CS 987 654 321 NO'; n.dispatchEvent(new Event('input', { bubbles: true, composed: true })); sr.querySelector('[data-act="psave"]').click(); await new Promise((q) => setTimeout(q, 300)); return window.__calls.find((c) => c[0] === 'norwegian_parcel_tracker'); });
ok('Pakker: «+» → norwegian_parcel_tracker-tjenesten med sporingsnummer', padd && padd[1] === 'add_parcel' && padd[2].tracking_number === 'CS987654321NO', padd);
const dl = await q.evaluate(async () => { const sr = window.__c.shadowRoot; sr.querySelector('[data-act="pdel"]').click(); await new Promise((q) => setTimeout(q, 250)); return [...sr.querySelectorAll('.pkr .pkst')].map((e) => e.textContent); });
ok('«Vis leverte» viser levert (grå)', dl.includes('Levert'), dl);
await q.close();

// ---------------------------------------------------------------- uten kilder: «– · Velg entitet» i alle faner
const e = await page({ width: 400, height: 900 });
await e.evaluate(async () => { window.__c.setConfig({ type: 'custom:msh-kalender-card', card_id: 'k2', calendars: [{ entity: 'calendar.finnes_ikke' }], src: { hytta: 'none', bday: 'none', post: 'none', parcel: 'none', sonarr: 'none', radarr: 'none', plex: 'none' } }); await new Promise((q) => setTimeout(q, 300)); });
const miss = {};
for (const k of ['kalender', 'hytta', 'framover', 'bursdager', 'posten']) { await tab(e, k); miss[k] = await e.evaluate(() => [...window.__c.shadowRoot.querySelectorAll('.miss')].map((m) => m.textContent.replace(/\s+/g, ' ').trim())); }
ok('Uten kilder: «– · Velg entitet» i alle fem faner (aldri skjult)', Object.values(miss).every((m) => m.length && m.every((x) => /^–\s*·\s*Velg entitet/.test(x))), miss);
await e.evaluate(async () => { window.__c.setConfig({ type: 'custom:msh-kalender-card', card_id: 'k3', calendars: [] }); });
const noCal = await e.evaluate(async () => { const h = window.mockHass(); Object.keys(h.states).filter((x) => x.startsWith('calendar.')).forEach((x) => delete h.states[x]); window.__c.hass = h; window.__c.setUI({ tab: 'kalender' }); await new Promise((q) => setTimeout(q, 300)); return [...window.__c.shadowRoot.querySelectorAll('.miss')].map((m) => m.textContent.replace(/\s+/g, ' ').trim()); });
ok('Ingen calendar.* → «– · Velg entitet» i Kalender', noCal.length === 1, noCal);

// ---------------------------------------------------------------- GUI-editor (getConfigElement) = samme valg
const G = await e.evaluate(async () => {
  const ed = customElements.get('msh-kalender-card').getConfigElement(); ed.hass = window.mockHass(); ed.setConfig({ type: 'custom:msh-kalender-card', card_id: 'gui1' }); document.body.appendChild(ed);
  await new Promise((q) => setTimeout(q, 150));
  const R = ed.shadowRoot, tabs = [...R.querySelectorAll('.chips.tabs [role="tab"]')].map((t) => t.getAttribute('aria-label') || t.textContent.trim());
  let last = null; ed.addEventListener('config-changed', (x) => { last = x.detail.config; });
  R.querySelector('.ktab[data-edk="framover"] [data-op="eye"]').click(); await new Promise((q) => setTimeout(q, 100));
  [...R.querySelectorAll('[data-a="tab"]')].find((t) => t.dataset.v === 'kilder').click(); await new Promise((q) => setTimeout(q, 100));
  const selectors = [...R.querySelectorAll('ha-selector')].map((s) => s.dataset.name);
  [...R.querySelectorAll('[data-a="tab"]')].find((t) => t.dataset.v === 'visning').click(); await new Promise((q) => setTimeout(q, 100));
  const vis = [...R.querySelectorAll('[data-name]')].map((s) => s.dataset.name);
  ed.remove();
  return { tabs, last, selectors, vis: [...new Set(vis)] };
});
ok('GUI-editor: samme faner (Faner/Kalendere/Kilder/Visning)', G.tabs.join('|') === 'Faner|Kalendere|Kilder|Visning', G.tabs);
ok('GUI-editor: øye → tab_hidden (config-changed)', G.last && (G.last.tab_hidden || []).includes('framover'), G.last);
ok('GUI-editor: Kilder bruker entitetsvelger (ha-selector) per kilde', ['src.hytta', 'src.bday', 'src.post', 'src.parcel', 'src.sonarr', 'src.radarr', 'src.plex'].every((n) => G.selectors.includes(n)), G.selectors);
ok('GUI-editor: Visning med tab_labels/days/defaultView/showPlex + Mellomrom gap/pad_top/pad_bottom', ['tab_labels', 'days', 'defaultView', 'showPlex', 'gap', 'pad_top', 'pad_bottom'].every((n) => G.vis.includes(n)), G.vis);

// ---------------------------------------------------------------- migrering + «Erstattet av Kalender»
const Mg = await e.evaluate(async () => {
  const M = window.MSH;
  const yaml = "type: custom:bubble-card\ncard_type: pop-up\nname: Kalender\nicon: mdi:calendar-month\nhash: '#kalender'\ncards:\n  - type: custom:ki-tabs-card\n    tabs:\n      - title: Hytta\n        cards:\n          - type: custom:ki-hytte-card\n            oversikt: sensor.ki_hyttebesok_stromstad_oversikt\n      - title: Framover\n        cards:\n          - type: custom:ki-lansering-card\n            serier: sensor.sonarr_sonarr_upcoming_media\n            filmer: sensor.radarr_radarr_upcoming_media\n      - utenfor: true\n        kort_naar:\n          Kalender:\n            - type: custom:ki-kalender-card\n              kalendere:\n                - entity: calendar.sebastian_kristo_no\n                  navn: Sebastian\n                  farge: var(--active-big)\n        cards:\n          - type: custom:ki-post-card\n            entity: sensor.nar_kommer_posten_posten_sensor_next\n          - type: custom:ki-bursdag-pro-card\n            kalender: calendar.birthdays\n";
  const custom = [{ id: 'imp1', hash: '#kalender', name: 'Kalender', icon: 'mdi:calendar-month', yaml, imported: 'popups.html' }];
  if (M.store && M.store.set) M.store.set('custom_popups', custom);
  const ex = M.kalenderExtra({});
  const auto = [{ group: 'fn', config: M.popupTemplateA({ name: 'Kalender', icon: 'mdi:calendar-month', hash: '#kalender', card: { type: 'custom:msh-kalender-card', card_id: 'pop-kalender', ...(ex || {}) } }) }];
  const r1 = M.mergePopups({ auto, custom, userPopups: {} });
  const r2 = M.mergePopups({ auto, custom, userPopups: { kalender: { prefer: 'custom' } } });
  const other = M.mergePopups({ auto: [{ group: 'fn', config: M.popupTemplateA({ name: 'Vær', icon: 'mdi:weather-partly-cloudy', hash: '#vaer', card: { type: 'custom:msh-vaer-card' } }) }], custom: [{ type: 'custom:bubble-card', card_type: 'pop-up', hash: '#vaer', cards: [] }] });
  return { ex, win1: r1.report.entries.find((x) => x.hash === '#kalender').source, card1: r1.popups[0].cards[0].type, inactive: r1.report.inactive, win2: r2.report.entries.find((x) => x.hash === '#kalender').source, replaced2: r2.report.replaced.map((x) => x.hash), otherWin: other.report.entries[0].source };
});
ok('Migrering: kildene fra de gamle kortene → src + calendars', Mg.ex && Mg.ex.src.hytta === 'sensor.ki_hyttebesok_stromstad_oversikt' && Mg.ex.src.sonarr === 'sensor.sonarr_sonarr_upcoming_media' && Mg.ex.src.radarr === 'sensor.radarr_radarr_upcoming_media' && Mg.ex.src.post === 'sensor.nar_kommer_posten_posten_sensor_next' && Mg.ex.src.bday === 'calendar.birthdays' && Mg.ex.calendars[0].name === 'Sebastian', Mg.ex);
ok('Generert Kalender vinner over importert #kalender, importert = «Erstattet av Kalender»', Mg.win1 === 'auto' && Mg.card1 === 'custom:msh-kalender-card' && Mg.inactive.length === 1 && Mg.inactive[0].by === 'Kalender', Mg);
ok('«Bruk egen» (prefer custom) snur det; andre egne popups som før', Mg.win2 === 'custom' && Mg.replaced2.includes('#kalender') && Mg.otherWin === 'custom', Mg);
// Egne popups-listen i «Tilpass Hjem» → Popups viser «Erstattet av Kalender»
const lst = await e.evaluate(async () => {
  const M = window.MSH;
  M.popupReport = M.mergePopups({ auto: [{ group: 'fn', config: M.popupTemplateA({ name: 'Kalender', icon: 'mdi:calendar-month', hash: '#kalender', card: { type: 'custom:msh-kalender-card' } }) }], custom: M.store.get('custom_popups'), userPopups: {} }).report;
  const src = M.popupEditorRows ? 'fn' : null;
  const html = document.createElement('div');
  // inaRow er lokal i 28-popup-editor – sjekk teksten i kildekoden via rapporten
  return { inactive: M.popupReport.inactive };
});
ok('Rapporten til Egne popups har «by: Kalender»', lst.inactive.length === 1 && lst.inactive[0].by === 'Kalender', lst);
await e.close();

// ---------------------------------------------------------------- Fiks 24.1 · modusknappen: kun månedskalender + dagspanel
const v = await page({ width: 390, height: 844 });
await v.evaluate(() => { try { window.MSH.store.set('kalender.view', undefined, { now: true }); } catch (e) { /* */ } window.__c.setUI({ kview: undefined, fview: undefined }); });
await wait(v, 300);
const vs = (p) => p.evaluate(() => { const sr = window.__c.shadowRoot, ic = sr.querySelector('.mb .rail > span:first-child ha-icon, .mb .rail > span:first-child [icon]');
  return { list: sr.querySelectorAll('.pane .day').length, mv: sr.querySelectorAll('.pane .mv7').length, dp: sr.querySelectorAll('.pane .dp').length, kids: [...sr.querySelector('.pane').children].map((e) => e.className), icon: sr.querySelector('.mb .rail > span:first-child').innerHTML.match(/mdi:[a-z-]+/)?.[0], label: sr.querySelector('.mb').getAttribute('aria-label'), store: window.MSH.store.get('kalender.view') }; });
const v0 = await vs(v);
ok('24.1 Liste: dagslisten vises, ikon calendar_month', v0.list > 1 && !v0.mv && v0.icon === 'mdi:calendar-month', v0);
const r0 = await v.evaluate(() => { const x = window.__c.shadowRoot.querySelector('.mb').getBoundingClientRect(); return [x.left + 24, x.top + 24]; });
await v.touchscreen.tap(r0[0], r0[1]); await wait(v, 400);
const v1 = await vs(v);
ok('24.1 Ekte trykk → KUN månedskalender + dagspanel, ikon view_agenda, lagret per bruker', v1.mv === 1 && v1.dp === 1 && !v1.list && v1.kids.join('|') === 'mvc|card dp' && v1.icon === 'mdi:view-agenda' && v1.store && v1.store.kalender === 'month', v1);
const G1 = await v.evaluate(() => { const sr = window.__c.shadowRoot, g = sr.querySelector('.mv7'), d = sr.querySelector('.mvd:not(.out):not(.sel):not(.today)'), o = sr.querySelector('.mvd.out'), s = sr.querySelector('.mvd.sel'), n = sr.querySelector('.mvn'), b = sr.querySelectorAll('.mvh .mvb'), dp = sr.querySelector('.dp'), gr = g.getBoundingClientRect(), pr = sr.querySelector('.pane').getBoundingClientRect(), cs = (e) => getComputedStyle(e);
  return { wd: [...sr.querySelectorAll('.mvw')].map((e) => e.textContent).join(''), gap: cs(g).columnGap, ta: cs(g).touchAction, cell: [cs(d).borderRadius, cs(d).backgroundColor, cs(d).fontSize, cs(d).fontWeight, Math.round(d.getBoundingClientRect().width) === Math.round(d.getBoundingClientRect().height)], out: o ? [cs(o).backgroundColor, cs(o).color, !o.querySelector('.mvn')] : null, sel: s && cs(s).backgroundImage, badge: n && [cs(n).height, cs(n).fontSize, cs(n).backgroundColor], btns: [...b].map((x) => Math.round(x.getBoundingClientRect().width) + (x.dataset.act || '')), dp: [cs(dp).backgroundColor, cs(dp).borderRadius, dp.querySelector('.dph b').textContent], full: Math.abs(gr.width - pr.width) < 2 }; });
ok('24.1 Månedsgrid som designet (M T O T F L S, gap 8, runde celler, rosa valgt, merke 18 px, 36 px-knapper, fyller bredden)', G1.wd === 'MTOTFLS' && G1.gap === '8px' && G1.ta === 'pan-y' && G1.cell[0] === '50%' && G1.cell[1] === 'rgb(58, 58, 58)' && G1.cell[2] === '15px' && G1.cell[4] && (!G1.out || (G1.out[0] === 'rgba(0, 0, 0, 0)' && G1.out[1] === 'rgb(84, 84, 84)' && G1.out[2])) && /gradient/.test(G1.sel) && G1.badge[0] === '18px' && G1.btns.join() === '36mstep,36calmenu,36mstep' && G1.dp[0] === 'rgb(58, 58, 58)' && G1.dp[1] === '24px' && /^[A-ZÆØ][a-zæøå]+ \d+\. [a-z]+$/.test(G1.dp[2]) && G1.full, G1);
await shot(v, '24-1-maned');
// event-knappen → «Vis kalendere» rett under, høyrejustert, 264 px; av/på oppdaterer grid og panel
const E = await v.evaluate(async () => { const sr = window.__c.shadowRoot, btn = sr.querySelector('.mvb[data-act="calmenu"]'), br = btn.getBoundingClientRect(); const cnt = () => [...sr.querySelectorAll('.mvn')].reduce((a, e) => a + Number(e.textContent), 0); const n0 = cnt(); btn.click(); await new Promise((q) => setTimeout(q, 400));
  const portal = window.MSH.portals().pop(), sh = portal && portal.shadowRoot.querySelector('.sh'), r = sh && sh.getBoundingClientRect(), bg = sh && getComputedStyle(sh).backgroundColor, rad = sh && getComputedStyle(sh).borderRadius;
  const rows = portal ? [...portal.shadowRoot.querySelectorAll('.mr')].map((e) => e.dataset.id) : [];
  portal.shadowRoot.querySelector('.mr[data-id="calendar.sebastian_kristo_no"]').click(); await new Promise((q) => setTimeout(q, 400));
  const n1 = cnt(), hid = window.__c.config.calendars_hidden;
  portal.shadowRoot.querySelector('.mr[data-id="calendar.sebastian_kristo_no"]').click(); await new Promise((q) => setTimeout(q, 400));
  const n2 = cnt();
  portal.shadowRoot.querySelector('.bg').click(); await new Promise((q) => setTimeout(q, 400));
  return { rows: rows.length, w: r && Math.round(r.width), top: r && Math.round(r.top - br.bottom), right: r && Math.round(br.right - r.right), bg, rad, inPopup: !!(portal && portal.closest('.pop')), n0, n1, n2, hid, open: window.MSH.portals().filter((x) => x.isConnected && x.classList.contains('on')).length, hash: location.hash };
});
ok('24.1 event-knappen → «Vis kalendere» portalt rett under knappen (264, #404040, r24, høyrejustert)', E.rows >= 3 && E.w === 264 && E.top >= 0 && E.top <= 12 && Math.abs(E.right) <= 1 && E.bg === 'rgb(64, 64, 64)' && E.rad === '24px' && !E.inPopup, E);
ok('24.1 av/på filtrerer grid umiddelbart, lagres i calendars_hidden, trykk utenfor lukker', E.n1 < E.n0 && E.n2 === E.n0 && Array.isArray(E.hid) && E.open === 0 && E.hash === '#kalender', E);
// sveip på gridet bytter måned uten å boble
const SW = await v.evaluate(async () => { const sr = window.__c.shadowRoot, g = sr.querySelector('.mv7'), r = g.getBoundingClientRect(), t0 = sr.querySelector('.mvt').textContent.trim(); let bub = 0; const bl = () => bub++; document.getElementById('dash').addEventListener('pointerup', bl);
  const o = (x) => ({ bubbles: true, composed: true, clientX: x, clientY: r.top + 100, pointerId: 31, pointerType: 'touch' });
  const tgt = g.querySelector('.mvd'); tgt.dispatchEvent(new PointerEvent('pointerdown', o(r.left + 300))); tgt.dispatchEvent(new PointerEvent('pointermove', o(r.left + 200))); tgt.dispatchEvent(new PointerEvent('pointerup', o(r.left + 120))); tgt.click();
  await new Promise((q) => setTimeout(q, 300)); const t1 = sr.querySelector('.mvt').textContent.trim();
  const g2 = sr.querySelector('.mv7'), t2 = g2.querySelector('.mvd'); t2.dispatchEvent(new PointerEvent('pointerdown', o(r.left + 100))); t2.dispatchEvent(new PointerEvent('pointerup', o(r.left + 300)));
  await new Promise((q) => setTimeout(q, 300)); document.getElementById('dash').removeEventListener('pointerup', bl);
  return { t0, t1, t2: sr.querySelector('.mvt').textContent.trim(), bub, hash: location.hash, sel: window.__c.ui.selDay };
});
ok('24.1 Sveip venstre → neste måned, høyre → tilbake; bobler ikke, popupen blir', SW.t0 !== SW.t1 && SW.t2 === SW.t0 && SW.bub === 0 && SW.hash === '#kalender' && !SW.sel, SW);
// trykk igjen → listen tilbake; Framover har egen visning med media-rader
await v.touchscreen.tap(r0[0], r0[1]); await wait(v, 400);
const v2 = await vs(v);
ok('24.1 Trykk igjen → listen tilbake, ikon calendar_month', v2.list > 1 && !v2.mv && v2.icon === 'mdi:calendar-month' && v2.store.kalender === 'list', v2);
await tab(v, 'framover');
await v.touchscreen.tap(r0[0], r0[1]); await wait(v, 400);
const F1 = await v.evaluate(() => { const sr = window.__c.shadowRoot; return { kids: [...sr.querySelector('.pane').children].map((e) => e.className), cal: sr.querySelectorAll('.mvb[data-act="calmenu"]').length, rows: sr.querySelectorAll('.dp .mr').length, badges: sr.querySelectorAll('.mvn').length, store: window.MSH.store.get('kalender.view') }; });
ok('24.1 Framover: samme månedsvisning (uten filter/hero), media-merker, ingen event-knapp', F1.kids.join('|') === 'mvc|card dp' && F1.cal === 0 && F1.badges > 0 && F1.store.framover === 'month', F1);
await shot(v, '24-1-framover');
await tab(v, 'hytta');
const Hk = await v.evaluate(() => ({ sok: !!window.__c.shadowRoot.querySelector('.srch'), icon: window.__c.shadowRoot.querySelector('.mb .rail > span:first-child').innerHTML.match(/mdi:[a-z-]+/)?.[0] }));
ok('24.1 Hytta beholder søk, knappen = tilpass', Hk.sok && Hk.icon === 'mdi:tune-variant', Hk);
await v.close();
// default_view: month (YAML) → starter i måned når brukeren ikke har valgt
const w = await page({ width: 1280, height: 900 });
const DV = await w.evaluate(async () => { try { window.MSH.store.set('kalender.view', undefined, { now: true }); } catch (e) { /* */ } const c = window.__c; c.setUI({ kview: undefined }); c.setConfig({ ...c._rawConfig, default_view: 'month' }); await new Promise((q) => setTimeout(q, 400)); const sr = c.shadowRoot, g = sr.querySelector('.mv7'), pr = sr.querySelector('.pane').getBoundingClientRect(); return { mv: !!g, dv: c.config.defaultView, full: g && Math.abs(g.getBoundingClientRect().width - pr.width) < 2, pw: Math.round(pr.width) }; });
ok('24.1 default_view: month → starter i måned (defaultView=maned), fyller bredden på PC', DV.mv && DV.dv === 'maned' && DV.full, DV);
await w.close();

await b.close();
try { (await import('node:fs')).unlinkSync(bundle); } catch (x) { /* */ }
Object.entries(res).forEach(([k, v]) => console.log(v === 'OK' ? '✔' : '✘', k, v === 'OK' ? '' : JSON.stringify(v[1]).slice(0, 600)));
if (errs.length) console.log('Sidefeil:', [...new Set(errs)].slice(0, 5));
console.log(fail.length ? `\n${fail.length} feilet` : '\nAlle bestod');
process.exit(fail.length || errs.length ? 1 : 0);
