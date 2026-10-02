// Fiks 35.4 + 35.8 + Del A · Sikkerhet: ingen «Krever oppmerksomhet», hjelpetekst (show_hint, vises under hold),
// rom-seksjonen som variant 2a (statusstripe, aktive rom som kort, rolige som piller i 2 kolonner, sensorliste,
// Rom/Type), tastatur som designet, og lys modus (tokens, mørknet aksent-tekst, kontrast ≥ 4,5:1) + mørk uendret.
//   node test/sikkerhet35-check.mjs        (SHOTS=<mappe> lagrer skjermbilder)
import { createRequire } from 'node:module';
import { readdirSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/sikkerhet35-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const shots = process.env.SHOTS || '';
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = {}, fail = [];
const ok = (name, cond, info) => { res[name] = cond ? 'OK' : ['FEIL', info]; if (!cond) fail.push(name); };
const mocks = readdirSync('test/mock').sort().map((m) => resolve('test/mock/' + m));
const errs = [];
async function page(vp, light) {
  const p = await b.newPage({ viewport: vp || { width: 390, height: 1400 }, hasTouch: true });
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + resolve('test/harness.html'));
  for (const m of mocks) await p.addScriptTag({ path: m });
  await p.addScriptTag({ path: bundle });
  // Felles hjelpere i siden: kortet i en (falsk) Bubble-popup, kontrast-måling
  await p.evaluate((light) => {
    window.__light = light;
    window.mkCard = async (cfg) => {
      const w = (ms) => new Promise((q) => setTimeout(q, ms));
      const h = window.mockHass();
      h.themes = { darkMode: !light };
      // Flere rolige rom (piller i 2 kolonner), ett med langt navn
      const t0 = new Date(Date.now() - 3 * 3600000).toISOString();
      h.areas = { ...h.areas, cybele_lang: { area_id: 'cybele_lang', name: 'Cybele soverom ved gavlveggen', icon: 'mdi:bed', floor_id: 'andre', picture: null } };
      const addS = (id, st, dc, area, nm) => { h.states[id] = { entity_id: id, state: st, attributes: { device_class: dc, friendly_name: nm }, last_changed: t0, last_updated: t0 }; h.entities = { ...h.entities, [id]: { entity_id: id, platform: 'demo', area_id: area, device_id: null } }; };
      addS('binary_sensor.bad_vindu', 'off', 'window', 'bad', 'Bad vindu');
      addS('binary_sensor.hage_port', 'off', 'door', 'hage', 'Hage port');
      addS('binary_sensor.cybele_vindu', 'off', 'window', 'cybele_lang', 'Vindu');
      addS('binary_sensor.basseng_bevegelse', 'off', 'motion', 'basseng', 'Basseng bevegelse');
      if (light) document.documentElement.setAttribute('data-ki-theme', 'light');
      document.getElementById('dash').innerHTML = '';
      const bc = document.createElement('bubble-card');
      bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash: '#sikkerhet' });
      bc.innerHTML = `<div class="pop" style="background:${light ? '#f0f0f0' : '#282828'};color:${light ? '#1c1c1c' : '#fafafa'}"><div class="hdr">Sikkerhet</div><div class="inner"></div></div>`;
      document.getElementById('dash').appendChild(bc);
      location.hash = '#sikkerhet';
      const c = document.createElement('msh-sikkerhet-card');
      c.setConfig({ type: 'custom:msh-sikkerhet-card', card_id: 'sik35', ...cfg });
      c.hass = h;
      bc.querySelector('.inner').appendChild(c);
      window.__h = h; window.__c = c;
      await w(700);
      return c;
    };
    const parse = (s) => {
      s = String(s || '');
      let m = s.match(/color\(srgb\s+([\d.e-]+)\s+([\d.e-]+)\s+([\d.e-]+)(?:\s*\/\s*([\d.e-]+))?\)/);
      if (m) return [m[1] * 255, m[2] * 255, m[3] * 255, m[4] != null ? +m[4] : 1];
      m = s.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)/);
      if (!m) return null;
      let a = m[4] == null ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : +m[4];
      return [+m[1], +m[2], +m[3], a];
    };
    const over = (top, bot) => { const a = top[3]; return [top[0] * a + bot[0] * (1 - a), top[1] * a + bot[1] * (1 - a), top[2] * a + bot[2] * (1 - a), 1]; };
    const up = (e) => e.parentElement || (e.getRootNode && e.getRootNode().host) || null;
    window.bgOf = (el) => {
      const layers = [];
      for (let e = el; e; e = up(e)) {
        const cs = getComputedStyle(e);
        const img = cs.backgroundImage && cs.backgroundImage !== 'none' ? parse(cs.backgroundImage) : null;
        const c = img || parse(cs.backgroundColor);
        if (c && c[3] > 0) { layers.push(c); if (c[3] >= 1) break; }
      }
      let out = window.__light ? [240, 240, 240, 1] : [40, 40, 40, 1];
      for (let i = layers.length - 1; i >= 0; i--) out = over(layers[i], out);
      return out;
    };
    const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
    window.contrast = (el) => { const bg = window.bgOf(el), fg0 = parse(getComputedStyle(el).color) || [0, 0, 0, 1], fg = over(fg0, bg); const a = lum(fg), b2 = lum(bg); return (Math.max(a, b2) + 0.05) / (Math.min(a, b2) + 0.05); };
    window.parseCol = parse;
    // Alle synlige elementer med egen tekst (rekursivt inn i shadow roots)
    window.textEls = (root) => {
      const out = [];
      const walk = (r) => r.querySelectorAll('*').forEach((e) => {
        if (e.shadowRoot && e.localName !== 'ha-icon') walk(e.shadowRoot);
        if (![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) return;
        const rc = e.getBoundingClientRect();
        if (!rc.width || !rc.height) return;
        for (let x = e; x; x = up(x)) if (parseFloat(getComputedStyle(x).opacity) < 1) return;
        out.push(e);
      });
      walk(root);
      return out;
    };
  }, !!light);
  return p;
}
const W = (p, ms) => p.evaluate((ms) => new Promise((q) => setTimeout(q, ms)), ms);

/* ---------------------------------------------------------------- mørk modus */
const p = await page({ width: 390, height: 1400 });
const A = await p.evaluate(async () => {
  const c = await window.mkCard({ code_for: 'alle' });
  const sr = c.shadowRoot, M = window.MSH;
  const S = M.sikAuto(window.__h, c.config).sensors;
  const isAl = (x) => (x.type === 'door' || x.type === 'window' || x.type === 'lock') && x.on;
  const rooms = [...new Set(S.map((x) => x.room))].map((r) => { const L = S.filter((x) => x.room === r); return { r, al: L.filter(isAl).length, mv: L.filter((x) => x.on && !isAl(x)).length }; });
  const st = [...sr.querySelectorAll('.rst')].map((e) => [e.querySelector('.rsn').textContent, e.querySelector('.rsl').textContent]);
  const pills = [...sr.querySelectorAll('.rpl')], cards = [...sr.querySelectorAll('.rac')];
  const g = sr.querySelector('.rcalm');
  const cs = (sel, prop) => { const e = sr.querySelector(sel); return e ? getComputedStyle(e)[prop] : null; };
  const schema = customElements.get('msh-sikkerhet-card').schema(window.__h, c.config);
  const flat = JSON.stringify(schema, (k, v) => (typeof v === 'function' ? undefined : v));
  return {
    text: sr.textContent, alerts: sr.querySelectorAll('.alert').length,
    expAl: rooms.reduce((n, x) => n + x.al, 0), expMv: rooms.reduce((n, x) => n + x.mv, 0), expHot: rooms.filter((x) => x.al || x.mv).map((x) => x.r), expCalm: rooms.filter((x) => !x.al && !x.mv).map((x) => x.r),
    st, cardNames: cards.map((e) => e.querySelector('.ran').textContent), cardSub: cards.map((e) => e.querySelector('.rsub').textContent), pillNames: pills.map((e) => e.querySelector('.rpn').textContent),
    cols: g ? getComputedStyle(g).gridTemplateColumns.split(' ').length : 0, pillW: pills.map((e) => Math.round(e.getBoundingClientRect().width)), pillTops: pills.map((e) => Math.round(e.getBoundingClientRect().top)),
    seg: [...sr.querySelectorAll('.rsg')].map((e) => e.textContent + (e.classList.contains('on') ? '*' : '')),
    hint: sr.querySelector('.hint') && sr.querySelector('.hint').offsetHeight > 0, hintTxt: sr.querySelector('.ht').textContent,
    showHint: /show_hint/.test(flat), showAlerts: /show_alerts/.test(flat), alertsOrder: /Krever oppmerksomhet/.test(flat),
    // mørk modus = som i dag
    dark: { modes: cs('.modes', 'backgroundColor'), cap: cs('.cap', 'color'), hint: cs('.hint', 'color'), own: cs('.own', 'backgroundColor'), evw: cs('.evw', 'color'), host: getComputedStyle(c).color, theme: c.getAttribute('data-ki-theme') },
    rstBg: cs('.rst', 'backgroundColor'), pillBg: cs('.rpl', 'backgroundColor'), smid: cs('.rpl .rpic', 'backgroundColor'),
  };
});
ok('35.4 «Krever oppmerksomhet» er borte (seksjon, varsel-rader og rekkefølge)', !/Krever oppmerksomhet/.test(A.text) && A.alerts === 0 && !A.alertsOrder, A.text.slice(0, 200));
ok('35.4 Tilpass: «Varsler» (show_alerts) fjernet, «Hjelpetekst» (show_hint) finnes', A.showHint && !A.showAlerts, A);
ok('35.4 hjelpeteksten vises som standard', A.hint && /Hold inne for å bytte modus/.test(A.hintTxt), A.hintTxt);
ok('35.4 statusstripe Åpne / Bevegelse / Rom rolig med ekte tall', A.st.length === 3 && A.st[0][1] === 'Åpne' && A.st[1][1] === 'Bevegelse' && A.st[2][1] === 'Rom rolig' && +A.st[0][0] === A.expAl && +A.st[1][0] === A.expMv && +A.st[2][0] === A.expCalm.length, A);
ok('35.4 rom med aktivitet = store kort øverst, rolige = piller', A.cardNames.join() === A.expHot.join() && A.pillNames.join() === A.expCalm.join() && A.expHot.length > 0 && A.expCalm.length > 1, A);
ok('35.4 pillene i 2 kolonner (lik bredde, to per rad)', A.cols === 2 && A.pillW[0] === A.pillW[1] && A.pillTops[0] === A.pillTops[1] && (A.pillTops.length < 3 || A.pillTops[2] > A.pillTops[0]), A);
ok('35.4 Rom/Type-bryter, Rom valgt', A.seg.join() === 'Rom*,Type', A.seg);
ok('35.4 aktivt kort: overskrift «Åpent · vindu» / «Ulåst · lås» / bevegelse', A.cardSub.every((t) => /^(Åpen|Åpent|Ulåst) · |^Bevegelse/.test(t)), A.cardSub);
ok('Del A mørk modus som i dag (#3a3a3a flater, #7f7f7f/#696969 tekst, hvit tekst)', A.dark.modes === 'rgb(58, 58, 58)' && A.dark.cap === 'rgb(127, 127, 127)' && A.dark.hint === 'rgb(105, 105, 105)' && A.dark.own === 'rgb(58, 58, 58)' && A.dark.evw === 'rgb(127, 127, 127)' && A.dark.host === 'rgb(250, 250, 250)' && A.dark.theme === 'dark', A.dark);
ok('35.4 mørk: piller #3a3a3a, ikon-sirkel #2f2f2f, statusboks rolig #3a3a3a', A.pillBg === 'rgb(58, 58, 58)' && A.smid === 'rgb(47, 47, 47)', A);
if (shots) await p.screenshot({ path: shots + '/sik35-dark.png', fullPage: true });

// Trykk på rolig pille → sensorliste; trykk igjen / lukk → bort. Rad → more-info.
const B = await p.evaluate(async () => {
  const w = (ms) => new Promise((q) => setTimeout(q, ms));
  const c = window.__c, sr = () => c.shadowRoot, M = window.MSH;
  const pill = sr().querySelector('.rpl'), name = pill.querySelector('.rpn').textContent;
  pill.click(); await w(250);
  const exp = M.sikAuto(window.__h, c.config).sensors.filter((x) => x.room === name).map((x) => x.id);
  const ol = sr().querySelector('.rol');
  const r1 = { name, open: !!ol, title: ol && ol.querySelector('.roln').textContent, rows: ol ? [...ol.querySelectorAll('.rolr')].map((e) => e.dataset.ent) : [], exp, on: sr().querySelector('.rpl').classList.contains('on') };
  let mi = null;
  c.addEventListener('hass-more-info', (e) => { mi = e.detail.entityId; }, { once: true });
  sr().querySelector('.rolr').click(); await w(100);
  r1.moreInfo = mi;
  sr().querySelector('.rolx').click(); await w(250);
  r1.closed = !sr().querySelector('.rol');
  // aktivt kort åpner også lista, trykk igjen lukker
  sr().querySelector('.rac').click(); await w(250);
  r1.cardOpen = !!sr().querySelector('.rol');
  sr().querySelector('.rac').click(); await w(250);
  r1.cardClosed = !sr().querySelector('.rol');
  return r1;
});
ok('35.4 trykk på pille åpner sensorlista for rommet (ekte sensorer)', B.open && B.title === B.name && B.rows.join() === B.exp.join() && B.on, B);
ok('35.4 sensorrad → more-info', B.moreInfo === B.exp[0], B);
ok('35.4 lukk-knapp og nytt trykk lukker lista', B.closed && B.cardOpen && B.cardClosed, B);

// Type-visning
const T = await p.evaluate(async () => {
  const w = (ms) => new Promise((q) => setTimeout(q, ms));
  const c = window.__c, sr = c.shadowRoot;
  sr.querySelector('.rsg[data-v="type"]').click(); await w(250);
  const G = [...sr.querySelectorAll('.rgp')].map((g) => ({ n: g.querySelector('.rgn').textContent, sum: g.querySelector('.rsum').textContent, rows: [...g.querySelectorAll('.rgr')].map((r) => [r.querySelector('.rgrn').textContent, r.querySelector('.rgs').textContent, !!r.querySelector('.rdot').getAttribute('style')]) }));
  const r = { seg: [...sr.querySelectorAll('.rsg')].map((e) => e.textContent + (e.classList.contains('on') ? '*' : '')), G, pills: sr.querySelectorAll('.rpl').length, ui: JSON.parse(localStorage.getItem('ki:sik35:ui') || '{}') };
  sr.querySelector('.rsg[data-v="rom"]').click(); await w(250);
  r.back = sr.querySelectorAll('.rpl').length;
  return r;
});
const sorted = T.G.every((g) => { const a = g.rows.map((x) => x[2]); return a.join() === [...a].sort((x, y) => y - x).join(); });
ok('35.4 Type: grupper Dører/Vinduer/Låser/Bevegelse(/Tilstede), aktive først, oppsummering', T.seg.join() === 'Rom,Type*' && T.pills === 0 && ['Dører', 'Vinduer', 'Låser'].every((n) => T.G.some((g) => g.n === n)) && sorted && T.G.every((g) => /^(Alle \d+ |\d+ av \d+ )/.test(g.sum)), T);
ok('35.4 Rom/Type huskes (UI-tilstand) og tilbake til Rom', T.ui.rview === 'type' && T.back > 0, T);

// show_hint: false → skjult, men vises mens man holder inne
const H = await p.evaluate(async () => {
  const w = (ms) => new Promise((q) => setTimeout(q, ms));
  const c = await window.mkCard({ code_for: 'aldri', show_hint: false });
  const sr = c.shadowRoot, vis = () => sr.querySelector('.hint').offsetHeight > 0;
  const r = { before: vis() };
  const bt = sr.querySelector('.mode:not(.act)'), rc = bt.getBoundingClientRect(), o = { bubbles: true, composed: true, clientX: rc.left + 10, clientY: rc.top + 10, pointerId: 7, button: 0 };
  bt.dispatchEvent(new PointerEvent('pointerdown', o)); await w(300);
  r.during = vis(); r.txt = sr.querySelector('.ht').textContent;
  bt.dispatchEvent(new PointerEvent('pointerup', o)); await w(250);
  r.after = vis();
  return r;
});
ok('35.4 show_hint av: skjult, vises midlertidig under hold («Hold for å sette …»), skjult igjen', !H.before && H.during && /^Hold for å sette /.test(H.txt) && !H.after, H);

// Tastatur (35.8): som designet – 1–9, Avbryt (×), 0, Slett; ingen egen Enter, sendes når koden er full
const K = await p.evaluate(async () => {
  const w = (ms) => new Promise((q) => setTimeout(q, ms));
  const c = await window.mkCard({ code_for: 'alle', code_length: 4 });
  const sr = c.shadowRoot, bt = sr.querySelector('.mode[data-mode="borte"]'), rc = bt.getBoundingClientRect(), o = { bubbles: true, composed: true, clientX: rc.left + 10, clientY: rc.top + 10, pointerId: 8, button: 0 };
  window.__calls.length = 0;
  bt.dispatchEvent(new PointerEvent('pointerdown', o)); await w(1200);
  bt.dispatchEvent(new PointerEvent('pointerup', o)); await w(300);
  const ov = c._ov, R = ov && ov.root;
  if (!R) return { err: 'ingen overlay' };
  const keys = [...R.querySelectorAll('.k')].map((k) => k.dataset.k);
  const sh = R.querySelector('.sh').getBoundingClientRect(), x = R.querySelector('.x').getBoundingClientRect();
  const kb = getComputedStyle(R.querySelector('.k')).backgroundColor, sb = getComputedStyle(R.querySelector('.sh')).backgroundColor;
  const r = { keys, title: R.querySelector('.tt').textContent, msg: R.querySelector('.msg').textContent, xTop: Math.round(x.top - sh.top), xRight: Math.round(sh.right - x.right), kb, sb, theme: ov.host.getAttribute('data-ki-theme') };
  for (const d of ['1', '2', '3', '4']) { R.querySelector(`.k[data-k="${d}"]`).click(); await w(40); }
  await w(400);
  r.call = window.__calls.filter((q) => q[0] === 'alarm_control_panel').map((q) => [q[1], q[2].code]);
  return r;
});
ok('35.8 tastatur: 1–9, Avbryt, 0, Slett – ingen egen Enter-knapp', K.keys && K.keys.join() === '1,2,3,4,5,6,7,8,9,close,0,backspace', K);
ok('35.8 tastatur: tittel/melding, lukk 14 px fra hjørnet, flater #3a3a3a/#404040', K.title === 'Sett alarm til borte' && /4-sifret kode/.test(K.msg) && K.xTop === 14 && K.xRight === 14 && K.sb === 'rgb(58, 58, 58)' && K.kb === 'rgb(64, 64, 64)' && K.theme === 'dark', K);
ok('35.8 tastatur: full kode sendes automatisk (alarm_arm_away med kode)', K.call && K.call.length === 1 && K.call[0][0] === 'alarm_arm_away' && K.call[0][1] === '1234', K.call);
await p.close();

/* ---------------------------------------------------------------- lys modus */
for (const vw of [360, 390]) {
  const q = await page({ width: vw, height: 1500 }, true);
  const L = await q.evaluate(async () => {
    const w = (ms) => new Promise((q) => setTimeout(q, ms));
    const c = await window.mkCard({ code_for: 'alle' });
    const sr = c.shadowRoot;
    sr.querySelector('.rpl').click(); await w(250);
    const bad = window.textEls(sr).map((e) => ({ t: e.textContent.trim().slice(0, 30), cls: e.className, c: +window.contrast(e).toFixed(2) })).filter((x) => x.c < 4.5);
    const hero = c.shadowRoot.querySelector('msh-sikkerhet-hero-card');
    const badHero = hero ? window.textEls(hero.shadowRoot).map((e) => ({ t: e.textContent.trim().slice(0, 30), c: +window.contrast(e).toFixed(2) })).filter((x) => x.c < 4.5) : [];
    const sub = sr.querySelector('.rac .rsub'), rac = sr.querySelector('.rac'), subC = getComputedStyle(sub).color, racBg = getComputedStyle(rac).backgroundColor;
    const white = window.textEls(sr).filter((e) => { const f = window.parseCol(getComputedStyle(e).color); return f && f[0] > 240 && f[1] > 240 && f[2] > 240; }).map((e) => e.textContent.trim().slice(0, 20));
    // Type-visning også
    sr.querySelector('.rsg[data-v="type"]').click(); await w(250);
    const badT = window.textEls(sr).map((e) => ({ t: e.textContent.trim().slice(0, 30), c: +window.contrast(e).toFixed(2) })).filter((x) => x.c < 4.5);
    sr.querySelector('.rsg[data-v="rom"]').click(); await w(250);
    const over = sr.scrollWidth > sr.host.getBoundingClientRect().width + 1;
    return { theme: c.getAttribute('data-ki-theme'), bad, badHero, badT, white, sub: subC, subRGB: window.parseCol(subC), racBg, modes: getComputedStyle(sr.querySelector('.modes')).backgroundColor, pill: getComputedStyle(sr.querySelector('.rpl')).backgroundColor, text: getComputedStyle(sr.querySelector('.ran')).color, over };
  });
  ok(`Del A lys ${vw}px: host data-ki-theme=light, lyse flater (#fff), mørk tekst`, L.theme === 'light' && L.modes === 'rgb(255, 255, 255)' && L.pill === 'rgb(255, 255, 255)' && /rgb\((2[0-9]|1[0-9]), /.test(L.text), L);
  ok(`Del A lys ${vw}px: aksent som tekst mørknes (amber ≤ 168 98 24 på tone-flate)`, L.subRGB && L.subRGB[0] < 170 && L.subRGB[1] < 110 && L.subRGB[2] < 60, L.sub);
  ok(`Del A lys ${vw}px: tone-bakgrunn sterkere (18 %)`, /\/ 0\.18\)|, 0\.18\)/.test(L.racBg), L.racBg);
  ok(`Del A lys ${vw}px: all tekst ≥ 4,5:1 (rom, sensorliste, type, logg, toppkort)`, !L.bad.length && !L.badT.length && !L.badHero.length, L);
  ok(`Del A lys ${vw}px: ingen hvit tekst på lys flate, ingen horisontal overflyt`, !L.white.length && !L.over, L);
  // Tastaturet i lys modus
  const KL = await q.evaluate(async () => {
    const w = (ms) => new Promise((q) => setTimeout(q, ms));
    const c = window.__c, sr = c.shadowRoot, bt = sr.querySelector('.mode[data-mode="borte"]'), rc = bt.getBoundingClientRect(), o = { bubbles: true, composed: true, clientX: rc.left + 10, clientY: rc.top + 10, pointerId: 9, button: 0 };
    bt.dispatchEvent(new PointerEvent('pointerdown', o)); await w(1200);
    bt.dispatchEvent(new PointerEvent('pointerup', o)); await w(300);
    const R = c._ov && c._ov.root;
    if (!R) return { err: 'ingen overlay' };
    const bad = window.textEls(R).map((e) => ({ t: e.textContent.trim().slice(0, 20), c: +window.contrast(e).toFixed(2) })).filter((x) => x.c < 4.5);
    const r = { theme: c._ov.host.getAttribute('data-ki-theme'), sh: getComputedStyle(R.querySelector('.sh')).backgroundColor, k: getComputedStyle(R.querySelector('.k')).color, bad };
    c._ov.close();
    return r;
  });
  ok(`Del A lys ${vw}px: tastaturet lyst (flate #fff, mørke tall, kontrast ≥ 4,5)`, KL.theme === 'light' && KL.sh === 'rgb(255, 255, 255)' && /rgb\((2[0-9]|1[0-9]), /.test(KL.k) && !KL.bad.length, KL);
  if (shots) await q.screenshot({ path: `${shots}/sik35-light-${vw}.png`, fullPage: true });
  // Modusbytte uten reload: darkMode → true gir mørk igjen
  const SW = await q.evaluate(async () => {
    const w = (ms) => new Promise((q) => setTimeout(q, ms));
    const c = window.__c;
    c.hass = { ...window.__h, themes: { darkMode: true } };
    await w(250);
    return { theme: c.getAttribute('data-ki-theme'), modes: getComputedStyle(c.shadowRoot.querySelector('.modes')).backgroundColor };
  });
  ok(`Del A ${vw}px: bytte til mørk uten reload`, SW.theme === 'dark' && SW.modes === 'rgb(58, 58, 58)', SW);
  await q.close();
}

ok('ingen sidefeil', !errs.length, errs);
await b.close();
for (const [k, v] of Object.entries(res)) console.log(v === 'OK' ? 'OK  ' : 'FEIL', k, v === 'OK' ? '' : String(JSON.stringify(v[1], (k, x) => (k === 'text' ? undefined : x))).slice(0, 900));
console.log(fail.length ? `\n${fail.length} feil` : '\nAlt OK');
process.exit(fail.length ? 1 : 0);
