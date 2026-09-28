// Fiks 21.1 / 21.3 / 21.5 / 21.9 / 21.10 · Energi (#energi, msh-energi-card) mot EKTE Bubble Card:
// åpnes via hash, periode + ‹ › oppdaterer graf/toppforbrukere/vann (statistics_during_period med riktig period),
// scrub lukker ikke popupen, Vis alt, Strømpris-kortet (pris + nivå) og Strømmåler (bare kW), Strømpriser-seksjonen,
// Tilpass energi (5 faner, Ferdig lagrer, GUI-editoren ser endringen), uten Energi-oppsett → «Sett opp Energi»,
// navbar-knappen Energi, hold på strømpris-kortet og effekt-boblen i prosa → #energi.
//   node test/energi-check.mjs      (SHOT=1 → skjermbilder i scratchpad)
import { createRequire } from 'node:module';
import { readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const bundle = resolve(`test/.build/energi-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const BC = resolve('test/.vendor/bubble-card.js');
if (!existsSync(BC)) execFileSync('curl', ['-sSL', '-o', BC, 'https://raw.githubusercontent.com/Clooos/Bubble-Card/main/dist/bubble-card.js']);
const yml = (py) => JSON.parse(execFileSync('python3', ['-c', `import yaml,json;d=yaml.safe_load(open('examples/dashboard.yaml'));cs=[c for s in d['views'][0]['sections'] for c in s['cards']];print(json.dumps(${py}))`]).toString());
const popup = yml("[c for c in cs if c.get('hash')=='#energi'][0]");
const navbarCfg = yml("[c for c in cs if c['type']=='custom:msh-navbar-card'][0]");
const shot = process.env.SHOT ? '/tmp/claude-0/-home-user/edde745c-687c-5d41-9673-062ed20f63c8/scratchpad/' : '';
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = {}, fail = [];
const ok = (name, cond, info) => { res[name] = cond ? 'OK' : ['FEIL', info]; if (!cond) fail.push(name); };
const mocks = readdirSync('test/mock').filter((f) => f.endsWith('.js')).sort().map((m) => resolve('test/mock/' + m));
const errs = [];
async function page(vp, file) {
  const p = await b.newPage({ viewport: vp, hasTouch: true });
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/ERR_|Failed to load resource|bubble-modules|Failed to fetch/.test(m.text())) errs.push(m.text().slice(0, 200)); });
  await p.goto('file://' + resolve(file || 'test/harness-bubble.html'));
  for (const m of mocks) await p.addScriptTag({ path: m });
  await p.addScriptTag({ path: bundle });
  if (!file) { await p.addScriptTag({ path: BC, type: 'module' }); await p.waitForFunction(() => customElements.get('bubble-card'), null, { timeout: 15000 }); }
  return p;
}
const HELP = () => {
  window.__deep = () => { const out = []; const walk = (r) => r.querySelectorAll('*').forEach((e) => { out.push(e); if (e.shadowRoot) walk(e.shadowRoot); }); walk(document); return out; };
  window.__pop = () => window.__deep().find((e) => e.classList && e.classList.contains('bubble-pop-up'));
  window.__card = () => window.__deep().find((e) => e.localName === 'msh-energi-card');
  window.__w = (ms) => new Promise((q) => setTimeout(q, ms));
  window.__ws = (t) => (window.__calls || []).filter((c) => c[0] === 'ws' && c[1] === t);
};
const SETUP = async ({ popup, navbarCfg, sb }) => {
  const w = (ms) => new Promise((q) => setTimeout(q, ms));
  document.documentElement.style.setProperty('--sb', sb + 'px');
  const h = (window.__h = window.mockHass());
  const dash = document.getElementById('dash');
  const nav = document.createElement('msh-navbar-card'); nav.setConfig(navbarCfg); nav.hass = h; dash.appendChild(nav);
  const bc = document.createElement('bubble-card'); bc.setConfig(popup); bc.hass = h; dash.appendChild(bc);
  window.__nav = nav;
  window.__hap = []; window.addEventListener('haptic', (e) => window.__hap.push(e.detail));
  await w(400);
};

/* ---------------------------------------------------------------- registrering */
const p0 = await page({ width: 390, height: 844 });
const reg = await p0.evaluate(() => {
  const M = window.MSH, h = window.mockHass();
  return { fn: M.FUNCTION_POPUPS.some((f) => f[0] === '#energi' && f[3] === 'msh-energi-card' && f[2] === 'mdi:lightning-bolt'), all: M.allPopups(h).some((x) => x.hash === '#energi'), spacing: M.POPUP_CARDS.includes('msh-energi-card') };
});
ok('21.1 #energi i FUNCTION_POPUPS (Energi, mdi:lightning-bolt) + popup-listen + Mellomrom', reg.fn && reg.all && reg.spacing, reg);
ok('21.1 examples/dashboard.yaml: #energi, Mal A, ett kort msh-energi-card', popup.hash === '#energi' && popup.name === 'Energi' && popup.bg_opacity === '98' && popup.bg_blur === '5' && popup.cards.length === 1 && popup.cards[0].type === 'custom:msh-energi-card', popup);
const strat = await p0.evaluate(async () => {
  const S = customElements.get('ll-strategy-dashboard-ki-dashboard') || customElements.get('ll-strategy-ki-dashboard');
  if (!S || !S.generate) return 'ingen strategi';
  const d = await S.generate({}, window.mockHass());
  const find = (o) => (o && typeof o === 'object' ? (o.hash === '#energi' ? o : Object.values(o).map(find).find(Boolean)) : null);
  const e = find(d);
  return e ? { n: e.cards.length, t: e.cards[0].type } : null;
});
ok('21.1 strategien lager #energi med msh-energi-card', strat === 'ingen strategi' || (strat && strat.n === 1 && strat.t === 'custom:msh-energi-card'), strat);
await p0.close();

/* ---------------------------------------------------------------- popupen */
for (const vp of [{ n: 'mobil', width: 390, height: 844, sb: 0 }, { n: 'PC', width: 1400, height: 900, sb: 256 }]) {
  const p = await page({ width: vp.width, height: vp.height });
  await p.evaluate(HELP);
  await p.evaluate(SETUP, { popup, navbarCfg, sb: vp.sb });
  const r = await p.evaluate(async () => {
    const w = window.__w;
    const out = {};
    out.before = window.__ws('recorder/statistics_during_period').length + window.__ws('energy/get_prefs').length; // ingen henting før åpning
    location.hash = '#energi';
    await w(1500);
    const P = window.__pop(), c = window.__card(), R = c.shadowRoot, q = (s) => R.querySelector(s), qa = (s) => [...R.querySelectorAll(s)];
    out.open = !!P && P.classList.contains('is-popup-opened');
    const hdr = window.__deep().find((e) => e.classList && e.classList.contains('bubble-header-container'));
    out.header = !!hdr && hdr.getBoundingClientRect().height > 0;
    const cont = c.parentElement.getBoundingClientRect(), cr = c.getBoundingClientRect();
    out.width = [Math.round(cr.width), Math.round(cont.width)];
    out.secs = qa('.wrap > *').map((e) => e.className.split(' ')[0]);
    out.house = !!q('.house') && Math.round(q('.house').getBoundingClientRect().height);
    out.gear = (() => { const g = q('.prow .gear'), row = q('.prow'); return !!g && row.lastElementChild === g && Math.round(g.getBoundingClientRect().width) === 44; })();
    // 23.2: periodelinjen først, 44×44 ‹ › ⚙, 8 px mellom, 14 px ned til første seksjon, rett under Bubble-headeren
    out.p23 = (() => { const row = q('.prow'), bs = [...row.querySelectorAll('.nb,.gear')].map((b) => b.getBoundingClientRect()), rr = row.getBoundingClientRect(), nx = row.nextElementSibling.getBoundingClientRect(), hr = hdr.getBoundingClientRect(), sg = row.querySelector('.seg').getBoundingClientRect();
      return { first: q('.wrap').firstElementChild === row, btn: bs.map((b) => Math.round(b.width) + 'x' + Math.round(b.height)).join(','), gaps: [Math.round(bs[0].left - sg.right), Math.round(bs[1].left - bs[0].right), Math.round(bs[2].left - bs[1].right)].join(','), down: Math.round(nx.top - rr.bottom), belowHdr: rr.top >= hr.bottom - 1 && rr.top - hr.bottom < 40, drag: row.querySelector('.seg').dataset.glassDrag }; })();
    out.nextDis = q('[data-act="step"][data-d="1"]').disabled;
    out.tiles = qa('.tile').map((t) => t.querySelector('.tt b').textContent + ' | ' + t.querySelector('.tt i').textContent);
    out.kwh = q('.card.pc .big b') && q('.card.pc .big b').textContent;
    out.cost = qa('.sec .sh .cp').map((e) => e.textContent);
    out.powerLine = !!q('[data-plot="power"] path') && q('[data-plot="power"]').dataset.n;
    out.nowMark = !!q('[data-plot="power"] .dot.ring') && !!q('[data-plot="power"] .vl.dash');
    out.tops = qa('.trow').length;
    out.topMeta = q('.sh .meta') && q('.sh .meta').textContent;
    out.rank = qa('.trow .rk').map((e) => e.textContent).join('');
    out.water = q('[data-plot="water"]') ? R.querySelectorAll('.card.pc')[1].querySelector('.big b').textContent : null;
    // Strømpriser
    out.price = { v: q('.ptop .pv b') && q('.ptop .pv b').textContent, sub: q('.ptop .lb') && q('.ptop .lb').textContent, lvl: q('.ptop .lvl') && q('.ptop .lvl').textContent, chips: qa('.pchip').map((e) => e.textContent), grad: !!q('[data-plot="price"] linearGradient[gradientUnits="userSpaceOnUse"]'), hl: !!q('[data-plot="price"] rect'), h: Math.round(q('[data-plot="price"]').getBoundingClientRect().height), tm: [...R.querySelectorAll('[data-act="pday"]')].map((b) => b.textContent + (b.disabled ? ':av' : '')) };
    // Vis alt
    const n0 = qa('.trow').length; q('[data-act="all"]').click(); await w(200);
    out.visAlt = [n0, qa('.trow').length, q('[data-act="all"]').textContent];
    // Scrub i strøm-grafen: verdien i høyre hjørne, popupen lukkes ikke
    const pl = q('[data-plot="power"]'), pr = pl.getBoundingClientRect();
    let leaked = 0; const leak = () => leaked++; document.addEventListener('pointerdown', leak); document.addEventListener('pointermove', leak);
    const ev = (t, x) => pl.dispatchEvent(new PointerEvent(t, { bubbles: true, composed: true, clientX: x, clientY: pr.top + pr.height / 2, pointerId: 7, pointerType: 'touch', isPrimary: true }));
    ev('pointerdown', pr.left + pr.width * 0.3); await w(80); ev('pointermove', pr.left + pr.width * 0.4); await w(120);
    out.scrub = q('.card.pc .rd').textContent;
    ev('pointerup', pr.left + pr.width * 0.4);
    document.removeEventListener('pointerdown', leak); document.removeEventListener('pointermove', leak);
    out.leaked = leaked; out.touchAction = pl.style.touchAction;
    out.stillOpen = location.hash === '#energi' && window.__pop().classList.contains('is-popup-opened');
    // Periode: Uke → stolper per dag (period 'day'), ‹ går tilbake, › aktiveres
    const nCalls = window.__ws('recorder/statistics_during_period').length;
    q('[data-act="per"][data-v="uke"]').click(); await w(700);
    const calls = window.__ws('recorder/statistics_during_period').slice(nCalls).map((x) => x[2].period);
    out.uke = { calls, n: q('[data-plot="power"]').dataset.n, bars: R.querySelectorAll('[data-plot="power"] rect').length, title: q('.card.pc .rd').textContent, water: R.querySelectorAll('[data-plot="water"] rect').length };
    const kUke = q('.card.pc .big b').textContent;
    q('[data-act="step"][data-d="-1"]').click(); await w(700);
    out.forrige = { title: q('.card.pc .rd').textContent, next: q('[data-act="step"][data-d="1"]').disabled, kwh: q('.card.pc .big b').textContent, kUke };
    q('[data-act="per"][data-v="aar"]').click(); await w(700);
    out.aar = { n: q('[data-plot="power"]').dataset.n, p: window.__ws('recorder/statistics_during_period').slice(-1)[0][2].period };
    q('[data-act="per"][data-v="mnd"]').click(); await w(700);
    out.mnd = { n: q('[data-plot="power"]').dataset.n, p: window.__ws('recorder/statistics_during_period').slice(-1)[0][2].period };
    // Cache: tilbake til Måned igjen → ingen ny henting
    const nC = window.__ws('recorder/statistics_during_period').length;
    q('[data-act="per"][data-v="dag"]').click(); await w(300); q('[data-act="per"][data-v="mnd"]').click(); await w(300);
    out.cache = window.__ws('recorder/statistics_during_period').length - nC;
    out.hap = window.__hap.length;
    // Lukk → nullstilles til «I dag», ingen henting mens lukket
    window.MSH.closePopup(); await w(900);
    const nClosed = window.__ws('recorder/statistics_during_period').length;
    window.__h = { ...window.__h, states: { ...window.__h.states } }; window.__card() && (window.__card().hass = window.__h); await w(400);
    out.closedFetch = window.__ws('recorder/statistics_during_period').length - nClosed;
    location.hash = '#energi'; await w(1200);
    const c2 = window.__card();
    out.reset = c2.shadowRoot.querySelector('[data-act="per"].on').dataset.v;
    return out;
  });
  const t = vp.n;
  ok(`21.1 [${t}] åpnes via hash, Bubble-header, full bredde, ingen henting før åpning`, r.open && r.header && Math.abs(r.width[0] - r.width[1]) <= 1 && r.before === 0, r);
  ok(`21.1/23.2 [${t}] rekkefølge: periode, hus, snarveier, strøm, strømpriser, topp, vann`, JSON.stringify(r.secs) === JSON.stringify(['prow', 'house', 'tiles', 'sec', 'sec', 'sec', 'sec']) && r.house >= 340, r.secs);
  ok(`23.2 [${t}] periodelinjen øverst under Bubble-headeren, ‹ › ⚙ 44×44, 8 px mellom, 14 px til første seksjon, Liquid Glass-drag`, r.p23.first && r.p23.btn === '44x44,44x44,44x44' && r.p23.gaps === '8,8,8' && r.p23.down === 14 && r.p23.belowHdr && r.p23.drag === 'x', r.p23);
  ok(`21.1 [${t}] tannhjul 44 px ytterst i periode-raden, › deaktivert i inneværende periode`, r.gear && r.nextDis, r);
  ok(`21.9 [${t}] snarveier: Strømmåler (bare kW) · Strømpris (pris + nivå) · Bil · Elbillader · Varmtvann`, r.tiles.length === 5 && /^Strømmåler \| [\d,]+ kW · Nå$/.test(r.tiles[0]) && /^Strømpris \| [\d,]+ kr\/kWh · (Lav|Normal|Høy|Svært høy)$/.test(r.tiles[1]) && /^Bil \| 68 % · Tilkoblet/.test(r.tiles[2]) && /^Elbillader \| 7,2 kW · Lader/.test(r.tiles[3]) && /^Varmtvann/.test(r.tiles[4]), r.tiles);
  ok(`21.1/21.3 [${t}] Strøm: importert kWh + kostnad fra stat_cost, 96 × 15 min med nå-markør`, /^[\d,]+$/.test(r.kwh || '') && r.cost.length >= 1 && /kr$/.test(r.cost[0]) && r.powerLine === '96' && r.nowMark, r);
  ok(`21.1 [${t}] Toppforbrukere: 3 rader, rang 123, «8 målt · N % av forbruket», Vis alt / Vis færre`, r.tops === 3 && r.rank === '123' && /^8 målt · \d+ % av forbruket$/.test(r.topMeta) && r.visAlt[0] === 3 && r.visAlt[1] === 8 && r.visAlt[2] === 'Vis færre', r);
  ok(`21.1 [${t}] Vann: liter forbrukt`, /^[\d,]+$/.test(r.water || ''), r.water);
  ok(`21.10 [${t}] Strømpriser: nåpris, «minutter igjen · snitt», nivå-chip, graf 180 px m/ gradient + time-markering, lavest/høyest, I morgen`, /^[\d,]+$/.test(r.price.v) && /minutter igjen · snitt [\d,]+ kr/.test(r.price.sub) && /Lav|Normal|Høy/.test(r.price.lvl) && r.price.grad && r.price.hl && r.price.h === 180 && /^Lavest kl \d\d–\d\d · [\d,]+ kr$/.test(r.price.chips[0]) && /^Høyest/.test(r.price.chips[1]) && r.price.tm.length === 2, r.price);
  ok(`21.1 [${t}] scrub: «kl HH:MM · x kW», touch-action pan-y, ingen lekkasje til Bubble, popupen åpen`, /^kl \d\d:\d\d · [\d,]+ kW$/.test(r.scrub) && r.leaked === 0 && r.touchAction === 'pan-y' && r.stillOpen, r);
  ok(`21.1/21.3 [${t}] Uke → period 'day', én stolpe per dag så langt (strøm og vann); ‹ → forrige uke, › aktiv`, r.uke.calls.includes('day') && r.uke.n === '7' && r.uke.bars === ((new Date().getDay() + 6) % 7) + 1 && r.uke.water === r.uke.bars && /^Uke \d+/.test(r.uke.title) && r.forrige.title !== r.uke.title && r.forrige.next === false, { uke: r.uke, forrige: r.forrige });
  ok(`21.1 [${t}] År → period 'month' (12), Måned → 'day'; 5 min cache (ingen ny henting)`, r.aar.n === '12' && r.aar.p === 'month' && r.mnd.p === 'day' && Number(r.mnd.n) >= 28 && r.cache === 0, r);
  ok(`21.1 [${t}] lukket: ingen henting; åpnes igjen på «I dag»; haptic på trykk`, r.closedFetch === 0 && r.reset === 'dag' && r.hap >= 4, r);
  if (shot) await p.screenshot({ path: `${shot}energi-${t}.png`, fullPage: true });
  if (shot && t === 'mobil') {
    await p.evaluate(async () => { location.hash = '#energi'; await window.__w(900); });
    const el = await p.evaluateHandle(() => window.__card());
    await el.screenshot({ path: `${shot}energi-kort.png` });
  }
  await p.close();
}

/* ---------------------------------------------------------------- Tilpass energi (arket + GUI-editoren) */
{
  const p = await page({ width: 390, height: 844 });
  await p.evaluate(HELP);
  await p.evaluate(SETUP, { popup, navbarCfg, sb: 0 });
  const r = await p.evaluate(async () => {
    const w = window.__w, out = {};
    location.hash = '#energi'; await w(1300);
    const c = window.__card();
    c.shadowRoot.querySelector('.prow .gear').click(); await w(700);
    const ed = window.__deep().find((e) => e.localName === 'msh-editor' && e._inline);
    const E = ed.shadowRoot, q = (s) => E.querySelector(s), qa = (s) => [...E.querySelectorAll(s)];
    out.tabs = qa('.chips.tabs .chip').map((b) => b.getAttribute('aria-label'));
    // 23.6: aktiv fane = ikon + navn, de andre bare ikon; flex (ikke grid); ikonene; title/aria-label; 360 px: ingen overlapp
    const tabInfo = () => { const bs = qa('.chips.tabs .chip'), row = q('.chips.tabs').getBoundingClientRect(); return bs.map((b) => { const r = b.getBoundingClientRect(), l = b.querySelector('.itl'), lr = l.getBoundingClientRect(), cs = getComputedStyle(b);
      return { on: b.getAttribute('aria-selected') === 'true', w: r.width, l: r.left, rt: r.right, lblVis: lr.width > 1 && getComputedStyle(l).opacity === '1', cut: l.scrollWidth > l.clientWidth + 1, h: Math.round(r.height), ic: b.querySelector('ha-icon').getAttribute('icon'), title: b.title, flex: cs.flexGrow + ' ' + cs.flexShrink, inRow: r.left >= row.left - 1 && r.right <= row.right + 1 }; }); };
    out.t23 = { disp: getComputedStyle(q('.chips.tabs')).display, tr: getComputedStyle(q('.chips.tabs .chip')).transitionProperty, i0: tabInfo() };
    // Kilder: merker fra Energi
    out.kilder = qa('.tpane .f .line').map((l) => l.textContent.trim().replace(/\s+/g, ' ')).slice(0, 8);
    out.openBtn = qa('button').some((b) => /Åpne Energi-oppsett i Home Assistant/.test(b.textContent));
    // overstyr elbillader via configen i arket → «Overstyrt» + «Fra Energi-oppsettet»
    ed._set('sources.ev', 'sensor.easee_effekt'); await w(200);
    out.overstyrt = qa('.tpane .f .line').some((l) => /Elbillader\s*Overstyrt/.test(l.textContent));
    const fra = qa('button').find((b) => /Fra Energi-oppsettet/.test(b.textContent));
    out.fra = !!fra; fra.click(); await w(200);
    out.fraOk = !(ed._config.sources || {}).ev;
    // Seksjoner: øye skjuler vann, dra Toppforbrukere øverst
    qa('.chips.tabs .chip')[1].click(); await w(60);
    out.t23.mid = tabInfo()[1].w; await w(400); out.t23.i1 = tabInfo();
    out.secRows = qa('[data-elist="sec"][data-edk]').map((e) => e.dataset.edk).join(',');
    E.querySelector('[data-edk="water"] [data-a="fn"]').click(); await w(150);
    const hd = E.querySelector('[data-edk="top"] [data-edrag]'), tgt = E.querySelector('[data-edk="house"]');
    const hr = hd.getBoundingClientRect(), tr = tgt.getBoundingClientRect();
    let leaked = 0; const leak = () => leaked++; document.addEventListener('pointerdown', leak);
    const pe = (el, t, y) => el.dispatchEvent(new PointerEvent(t, { bubbles: true, composed: true, clientX: hr.left + 5, clientY: y, pointerId: 3, pointerType: 'touch', isPrimary: true, button: 0 }));
    pe(hd, 'pointerdown', hr.top + 5); await w(50); pe(hd, 'pointermove', tr.top + 8); await w(50); pe(hd, 'pointerup', tr.top + 8); await w(200);
    document.removeEventListener('pointerdown', leak);
    out.drag = { order: (ed._config.order || []).join(','), leaked, hidden: ed._config.hidden };
    // Snarveier: Strømpris-kortet finnes, utvid → navn/entitet/ikon/farge, legg til
    qa('.chips.tabs .chip')[2].click(); await w(200);
    out.tileRows = qa('[data-elist="tile"][data-edk]').map((e) => e.dataset.edk).join(',');
    E.querySelector('[data-edk="car"] [data-op="exp"]').click(); await w(250);
    out.expFields = { name: !!q('input[data-name="tiles.2.name"]'), icon: !!E.querySelector('[data-name="tiles.2.icon"]'), color: !!q('input[data-name="tiles.2.color"]'), rm: qa('button').some((b) => /Fjern snarvei/.test(b.textContent)) };
    qa('button').find((b) => /Legg til snarvei/.test(b.textContent)).click(); await w(200);
    out.added = (ed._config.tiles || []).length;
    // Hus: 4 hustyper, velg Ved sjøen; Visning: Uke + Alle
    qa('.chips.tabs .chip')[3].click(); await w(200);
    const hb = qa('[data-v="sjo"][data-a="fn"]'); out.husTyper = qa('button[aria-pressed]').length; hb[0].click(); await w(150);
    qa('.chips.tabs .chip')[4].click(); await w(200);
    E.querySelector('[data-a="sel"][data-name="period"][data-v="uke"]').click(); await w(100);
    E.querySelector('[data-a="sel"][data-name="top_n"][data-v="0"]').click(); await w(100);
    out.draft = { style: ed._config.house_style, period: ed._config.period, top: ed._config.top_n };
    ed._set('labels.ev', false); await window.__w(400);
    out.labHidden = { ev: !c.shadowRoot.querySelector('.ehus-lab[data-k="ev"]'), grid: !!c.shadowRoot.querySelector('.ehus-lab[data-k="grid"]'), house: !!c.shadowRoot.querySelector('.ehus') };
    // Ferdig → lagret i ki-store, kortet følger, GUI-editoren viser det samme
    const sh = window.MSH.draftFor('cards.pop-energi') || window.MSH.draftOf(c);
    const save = window.__deep().find((e) => e.localName === 'msh-editor' && e._inline).shadowRoot.querySelector('[data-a="save"]');
    save.click(); await w(1500);
    out.stored = window.MSH.store.get('cards.pop-energi');
    out.cardCfg = { style: c.config.house_style, period: c.config.period, hidden: c.config.hidden, order: (c.config.order || [])[0] };
    out.noWater = !c.shadowRoot.querySelector('[data-plot="water"]');
    out.firstSec = [...c.shadowRoot.querySelectorAll('.wrap > *')].map((e) => e.className.split(' ')[0]).slice(0, 2).join(',');
    const G = window.MSH.Card && customElements.get('msh-energi-card').getConfigElement();
    G.hass = window.__h; G.setConfig({ ...c._yamlConfig }); document.body.appendChild(G); await w(300);
    out.gui = { style: G._config.house_style, period: G._config.period, tabs: [...G.shadowRoot.querySelectorAll('.chips.tabs .chip')].length };
    G.remove();
    return out;
  });
  ok('21.5 fem faner: Kilder · Seksjoner · Snarveier · Hus · Visning', JSON.stringify(r.tabs) === JSON.stringify(['Kilder', 'Seksjoner', 'Snarveier', 'Hus', 'Visning']), r.tabs);
  const T23 = (I, k) => I.every((x, i) => (i === k) === x.on && (i === k) === x.lblVis && !(x.on && x.cut) && x.h === 40 && x.inRow && x.w >= 44) && I.every((x, i) => !i || x.l >= I[i - 1].rt - 0.5) && I[k].flex === '0 0' && I.filter((x, i) => i !== k).every((x) => x.flex === '1 1');
  ok('23.6 faner (390 px): aktiv ikon+navn, andre bare ikon, flex, 40 px, ingen overlapp/kutt, ikoner og title', r.t23.disp === 'flex' && T23(r.t23.i0, 0) && T23(r.t23.i1, 1) && r.t23.i0.map((x) => x.ic).join(',') === 'mdi:meter-electric,mdi:view-agenda,mdi:view-grid,mdi:home,mdi:tune' && r.t23.i0.map((x) => x.title).join(',') === 'Kilder,Seksjoner,Snarveier,Hus,Visning', r.t23);
  ok('23.6 fanebytte animeres (flex/padding .25s)', /flex/.test(r.t23.tr) && /padding/.test(r.t23.tr) && r.t23.mid > 44 && r.t23.mid < r.t23.i1[1].w - 2, { tr: r.t23.tr, mid: r.t23.mid, end: r.t23.i1[1].w });
  ok('21.3/21.5 Kilder: Nett import/eksport, Strømpris, Elbillader, Vann fra «Energi», Sol/Batteri «Mangler», Live effekt «Auto», knapp til /config/energy', /Nett import ?Energi/.test(r.kilder[0]) && /Nett eksport ?Energi/.test(r.kilder[1]) && /Strømpris ?Energi/.test(r.kilder[2]) && /Elbillader ?Energi/.test(r.kilder[3]) && /Sol ?Mangler/.test(r.kilder[4]) && /Batteri ?Mangler/.test(r.kilder[5]) && /Vann ?Energi/.test(r.kilder[6]) && /Live effekt ?Auto/.test(r.kilder[7]) && r.openBtn, r.kilder);
  ok('21.5 overstyring → «Overstyrt», «Fra Energi-oppsettet» fjerner den', r.overstyrt && r.fra && r.fraOk, r);
  ok('21.5 Seksjoner: 6 rader, øye skjuler, dra-håndtak flytter (uten lekkasje)', r.secRows === 'house,tiles,power,price,top,water' && r.drag.order.startsWith('top,house') && r.drag.leaked === 0 && r.drag.hidden && r.drag.hidden.water === true, r);
  ok('21.5/21.9 Snarveier: meter,price,car,charger,vvb; utvidet rad med navn/ikon/farge/fjern; Legg til', r.tileRows === 'meter,price,car,charger,vvb' && r.expFields.name && r.expFields.icon && r.expFields.color && r.expFields.rm && r.added === 6, r);
  ok('21.5 Hus: 4 hustyper, etikett-bryter skjuler Elbillader i husscenen; Visning: periode + toppforbrukere', (!r.labHidden.house || (r.labHidden.ev && r.labHidden.grid)) && r.husTyper === 4 && r.draft.style === 'sjo' && r.draft.period === 'uke' && r.draft.top === 0, r.draft);
  ok('21.5 Ferdig lagrer i config (ki-store), kortet følger, GUI-editoren viser samme', r.stored && r.stored.house_style === 'sjo' && r.cardCfg.style === 'sjo' && r.cardCfg.order === 'top' && r.noWater && r.firstSec === 'prow,sec' && r.gui.style === 'sjo' && r.gui.period === 'uke' && r.gui.tabs === 5, r);
  await p.close();
}

/* ---------------------------------------------------------------- uten Energi-oppsett */
{
  const p = await page({ width: 390, height: 844 });
  await p.evaluate(HELP);
  await p.evaluate(() => { window.__noEnergy = true; });
  await p.evaluate(SETUP, { popup, navbarCfg, sb: 0 });
  const r = await p.evaluate(async () => {
    location.hash = '#energi'; await window.__w(1300);
    const R = window.__card().shadowRoot;
    return { setup: R.querySelector('[data-act="setup"]') && R.querySelector('[data-act="setup"]').textContent.trim(), kwh: R.querySelector('.card.pc .big b').textContent, tops: R.querySelectorAll('.trow').length, house: !!R.querySelector('.house') };
  });
  ok('21.3 uten Energi-oppsett: «Sett opp Energi i Home Assistant», «–», kortet vises', r.setup === 'Sett opp Energi i Home Assistant' && r.kwh === '–' && r.tops === 0 && r.house, r);
  await p.close();
}

/* ---------------------------------------------------------------- inngangene: navbar, strømpris-kortet (hold), prosa-effekt */
{
  const p = await page({ width: 390, height: 844 }, 'test/harness.html');
  await p.evaluate(HELP);
  const r = await p.evaluate(async (navbarCfg) => {
    const w = window.__w, h = window.mockHass(), out = {};
    const dash = document.getElementById('dash') || document.body;
    const nav = document.createElement('msh-navbar-card'); nav.setConfig({ ...navbarCfg, bar: ['energi', 'media'] }); nav.hass = h; dash.appendChild(nav); await w(500);
    const btn = window.__deep().find((e) => e.getAttribute && e.getAttribute('data-id') === 'energi' || (e.dataset && e.dataset.hash === '#energi'));
    out.navBtn = !!btn;
    if (btn) { btn.click(); await w(200); out.navHash = location.hash; }
    location.hash = '';
    const sp = document.createElement('msh-strompris-card'); sp.setConfig({ type: 'custom:msh-strompris-card' }); sp.hass = h; dash.appendChild(sp); await w(500);
    const root = sp.shadowRoot.querySelector('.sp .ttl') || sp.shadowRoot.querySelector('.sp');
    const rr = root.getBoundingClientRect();
    root.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true, clientX: rr.left + 4, clientY: rr.top + 4, pointerId: 1, button: 0 }));
    await w(700);
    root.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, composed: true, clientX: rr.left + 4, clientY: rr.top + 4, pointerId: 1 }));
    out.holdHash = location.hash;
    location.hash = '';
    out.prosa = window.MSH.prosaTapOf({ src: 'watt', pre: 'Vi bruker' });
    out.prosaUser = window.MSH.prosaTapOf({ src: 'watt', tap: { action: 'none' } });
    return out;
  }, navbarCfg);
  ok('21.1 navbar: Energi-knapp åpner #energi', r.navBtn && r.navHash === '#energi', r);
  ok('21.1 hold på strømpris-kortet på Hjem → #energi', r.holdHash === '#energi', r);
  ok('21.1 prosa: effekt-boblen åpner #energi (egen «Ved trykk» vinner)', r.prosa && r.prosa.navigation_path === '#energi' && r.prosaUser && r.prosaUser.action === 'none', r);
  await p.close();
}

/* ---------------------------------------------------------------- 23.6 · fanene på smal telefon (360 px): Energi-arket, Rom (GUI), Tilpass Hjem */
{
  const p = await page({ width: 360, height: 760 });
  await p.evaluate(HELP);
  await p.evaluate(SETUP, { popup, navbarCfg, sb: 0 });
  const r = await p.evaluate(async () => {
    const w = window.__w, out = {};
    const info = (bs) => { const I = bs.map((b) => { const r = b.getBoundingClientRect(), l = b.querySelector('.itl'); return { on: b.getAttribute('aria-selected') === 'true', l: r.left, rt: r.right, w: r.width, lbl: l && l.getBoundingClientRect().width > 1, cut: !l || l.scrollWidth > l.clientWidth + 1, label: b.getAttribute('aria-label') }; });
      const row = bs[0].parentElement.getBoundingClientRect();
      return { ok: I.every((x, i) => x.on === x.lbl && !(x.on && x.cut) && x.w >= 43.5 && x.l >= row.left - 0.5 && x.rt <= row.right + 0.5 && (!i || x.l >= I[i - 1].rt - 0.5)) && I.filter((x) => x.on).length === 1 && row.right <= innerWidth, act: I.find((x) => x.on).label, ws: I.map((x) => Math.round(x.w)).join(',') }; };
    // Energi-arket: hver fane aktiv etter tur
    location.hash = '#energi'; await w(1300);
    window.__card().shadowRoot.querySelector('.prow .gear').click(); await w(700);
    const ed = window.__deep().find((e) => e.localName === 'msh-editor' && e._inline), E = ed.shadowRoot;
    out.energi = [];
    for (let i = 0; i < 5; i++) { E.querySelectorAll('.chips.tabs .chip')[i].click(); await w(450); out.energi.push(info([...E.querySelectorAll('.chips.tabs .chip')])); }
    out.hap = window.__hap.length;
    ed.dispatchEvent(new CustomEvent('msh-cancel', { bubbles: true, composed: true })); await w(300);
    // Rom (GUI-editor, samme type:'tabs')
    const Rom = customElements.get('msh-rom-card'), area = Object.keys((window.__h.areas || {}))[0];
    if (Rom && Rom.getConfigElement) {
      const G = Rom.getConfigElement(); G.style.cssText = 'display:block;width:328px;margin:0 16px'; G.hass = window.__h; G.setConfig({ type: 'custom:msh-rom-card', area }); document.body.appendChild(G); await w(400);
      out.rom = [];
      for (let i = 0; i < 4; i++) { const bs = G.shadowRoot.querySelectorAll('.chips.sg.tabs .chip'); if (!bs[i]) break; bs[i].click(); await w(450); out.rom.push(info([...G.shadowRoot.querySelectorAll('.chips.sg.tabs .chip')])); }
      G.remove();
    }
    // Tilpass Hjem: Kort · Faner · Popups · Tekst
    location.hash = ''; await w(400);
    window.MSH.openHomeEditor(); await w(900);
    const ER = () => { const e = window.__deep().find((x) => x.dataset && x.dataset.key === 'ed'); return e && e.getRootNode(); };
    out.hjem = [];
    for (const v of ['kort', 'faner', 'pop', 'tekst']) { const R = ER(); R.querySelector(`[data-a="sec"][data-v="${v}"]`).click(); await w(500); out.hjem.push(info([...ER().querySelectorAll('.seg.itabs > button')])); }
    return out;
  });
  const all = (L, n) => L && L.length === n && L.every((x) => x.ok);
  ok('23.6 360 px · Tilpass energi: alle fem faner uten overlapp, aktiv viser navnet (hver fane)', all(r.energi, 5) && r.energi.map((x) => x.act).join(',') === 'Kilder,Seksjoner,Snarveier,Hus,Visning', r.energi);
  ok('23.6 360 px · Tilpass rom (4 faner): samme mønster, ingen kutt', all(r.rom, 4), r.rom);
  ok('23.6 360 px · Tilpass Hjem (Kort · Faner · Popups · Tekst): samme mønster, ingen kutt', all(r.hjem, 4) && r.hjem.map((x) => x.act).join(',') === 'Kort,Faner,Popups,Tekst', r.hjem);
  if (shot) await p.screenshot({ path: `${shot}f23-faner-360.png` });
  await p.close();
}

await b.close();
try { (await import('node:fs')).unlinkSync(bundle); } catch (e) { /* */ }
for (const [k, v] of Object.entries(res)) console.log(`${v === 'OK' ? '✔' : '✘'} ${k}${v === 'OK' ? '' : ' → ' + JSON.stringify(v[1]).slice(0, 700)}`);
if (errs.length) console.log('Konsollfeil:', [...new Set(errs)].slice(0, 8));
console.log(fail.length ? `\n${fail.length} feilet` : '\nAlle bestod');
process.exit(fail.length || errs.length ? 1 : 0);
