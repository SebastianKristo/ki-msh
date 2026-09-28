// Fiks 17.13/17.15/17.20: «Hilsen»/«Sted» i headeren (én rad, store bilder, merker), justerbare størrelser,
// tittelen krymper før den kortes. Fiks 18.4/18.7: Fold-oppsettet (≥ 1000 px, berøring ≥ 600 px: Fold, iPad, PC) =
// telefon-innholdet i én kolonne i full bredde, padding-left = rail + 2 × avstand, header skalert 0,72, ingen zoom.
// Fiks 19.12: navnet har forrang – bildene overlapper (−14), krymper (40), så teksten (28), til slutt «+N»; aldri ellipsis.
// Fiks 19.13: header-profiler per bruker × enhetsklasse (ki-store header_profiles) – «Redigerer: bruker · enhet ▾».
import { createRequire } from 'node:module';
import { readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const bundle = resolve(`test/.build/header-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const SHOTS = process.env.SHOTS || '';
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const fails = [], res = {};
const page = async (w, h, touch) => {
  const p = await b.newPage({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: false });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.__errs = errs;
  await p.goto('file://' + resolve('test/harness.html'));
  for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
  await p.addScriptTag({ path: bundle });
  return p;
};
// Mål headeren: tittel, skriftstørrelse, ellipsis, bilder, merker, overflow
const measure = `(() => {
  const all = []; const w = (r) => r.querySelectorAll('*').forEach((e) => { all.push(e); if (e.shadowRoot) w(e.shadowRoot); }); w(document);
  const H = all.find((e) => e.localName === 'msh-hjem-header-card' && e.getBoundingClientRect().width > 0);
  const R = H.shadowRoot, tx = R.querySelector('.ttl .tx'), top = R.querySelector('.top');
  const av = [...R.querySelectorAll('.faces .av')].map((e) => Math.round(e.getBoundingClientRect().width));
  const bd = [...R.querySelectorAll('.faces .bd')].map((e) => Math.round(e.getBoundingClientRect().width));
  const f = [...R.querySelectorAll('.faces .face')].map((e) => e.getBoundingClientRect());
  const over = f.slice(1).map((r, i) => Math.round(r.left - f[i].right));
  const arrow = tx.nextElementSibling ? Math.round(tx.nextElementSibling.getBoundingClientRect().left - tx.getBoundingClientRect().right) : null;
  const hr = H.getBoundingClientRect(), last = f.length ? f[f.length - 1] : null, lastBd = [...R.querySelectorAll('.faces .bd')].pop();
  const g = all.find((e) => e.classList && e.classList.contains('g'));
  const f0 = R.querySelector('.faces .face'), more = R.querySelector('.faces .face.more');
  return { txR: Math.round(tx.getBoundingClientRect().right), f0L: f0 ? Math.round(f0.getBoundingClientRect().left) : null, more: more ? more.textContent.trim() : null, hR: Math.round(hr.right),
    hil: !!R.querySelector('.hd.hil'), text: tx.textContent, fs: parseFloat(getComputedStyle(tx).fontSize), cut: tx.scrollWidth > tx.clientWidth + 1,
    av, bd, gaps: over, arrowGap: arrow, overflow: top.scrollWidth > top.clientWidth + 1 || (lastBd ? lastBd.getBoundingClientRect().right > hr.right + 0.5 : false),
    layout: g ? g.className : null, gW: g ? Math.round(g.getBoundingClientRect().width) : null, dashW: Math.round(document.getElementById('dash').getBoundingClientRect().width),
    padL: g ? parseFloat(getComputedStyle(g).paddingLeft) : null, zoom: g ? getComputedStyle(g).zoom : null, grid: g ? getComputedStyle(g).display : null,
    cols: (() => { const F = all.find((e) => e.localName === 'msh-hjem-faner-card'); const c = F && F.shadowRoot.querySelector('.cols'); return c ? getComputedStyle(c).gridTemplateColumns.split(' ').length : null; })(),
    hfW: (() => { const F = all.find((e) => e.localName === 'msh-hjem-faner-card'); const h = F && F.shadowRoot.querySelector('.hf'); return h ? Math.round(h.getBoundingClientRect().width) : null; })() };
})()`;
const hjem = async (p, header) => p.evaluate(async (header) => {
  const h = window.mockHass(); window.__h = h;
  const d = document.getElementById('dash'); d.innerHTML = '';
  const c = document.createElement('msh-hjem-card');
  c.setConfig({ type: 'custom:msh-hjem-card', card_id: 'ki-home', cards: { header: header || {} } }); c.hass = h;
  d.appendChild(c); window.__c = c;
  await new Promise((q) => setTimeout(q, 900));
}, header);
const ok = (cond, msg) => { if (!cond) fails.push(msg); };

// 18.4/18.7: Fold / iPad / PC = Fold-oppsettet; telefon og mus < 1000 px = telefon-oppsettet
for (const [name, w, h, touch, fold] of [['telefon412', 412, 915, true, false], ['telefon360', 360, 780, true, false], ['foldÅpen', 840, 880, true, true], ['fold9pro', 884, 1032, true, true], ['b600', 600, 900, true, true], ['b599', 599, 900, true, false], ['b700', 700, 900, true, true], ['b820', 820, 1000, true, true], ['b900', 900, 1000, true, true], ['ipadStaende', 1024, 1366, true, true], ['ipadLiggende', 1366, 1024, true, true], ['mus840', 840, 880, false, false], ['pc1200', 1200, 900, false, true], ['pc1440', 1440, 900, false, true], ['pc1920', 1920, 1080, false, true]]) {
  const p = await page(w, h, touch);
  await hjem(p);
  const m = await p.evaluate(measure);
  res[name] = m;
  ok(/fold/.test(m.layout) === fold && /mob/.test(m.layout) && !/wide/.test(m.layout), `${name}: layout ${m.layout}, ventet ${fold ? 'fold' : 'mob'}`);
  ok(m.gW >= m.dashW - 2, `${name}: kolonnen fyller ikke containeren (${m.gW}/${m.dashW})`);
  ok(m.grid === 'flex' && (m.zoom === '1' || m.zoom == null), `${name}: ikke én kolonne / zoom (${m.grid}, zoom ${m.zoom})`);
  ok(fold ? Math.abs(m.padL - 120) < 0.5 : Math.abs(m.padL - 18) < 0.5, `${name}: padding-left ${m.padL}`);
  ok(m.cols === 2, `${name}: flisene står ikke i to kolonner (${m.cols})`);
  ok(!fold || m.hfW >= m.gW - m.padL - 18 - 2, `${name}: fanene/flisene fyller ikke bredden (max-width?) ${m.hfW}`);
  // Header i Fold: 0,72 × standard (58 → 42 px tekst, 62 → 45 px bilder, 24 → 17 px merker), navnet avkortes ikke
  if (fold) ok(m.fs <= 42.01 && m.av.every((x) => x <= 45) && m.bd.every((x) => x <= 17) && !m.cut, `${name}: header ikke skalert 0,72 (${m.fs}px, ${m.av}, ${m.bd}, kuttet ${m.cut})`);
  else ok(m.fs > 42.01 || m.av.some((x) => x > 45) || w < 420, `${name}: telefon-header er skalert`);
  ok(m.hil, `${name}: standard er ikke Hilsen`);
  // Fiks 19.12: navnet vises alltid helt (ingen ellipsis, ikke dekket av bildene), minst 28 px
  ok(!m.cut && m.text === '👋 Sebastian!' && (m.f0L == null || m.txR <= m.f0L), `${name}: navnet er kuttet/dekket (${m.text} ${m.fs}px, tekst → ${m.txR}, bilder fra ${m.f0L})`);
  ok(!m.overflow, `${name}: horisontal overflow i header-raden`);
  ok(m.fs >= 28 - 0.01, `${name}: tittel under 28 px (${m.fs})`);
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/hdr-${name}.png` });
  ok(!p.__errs.length, `${name}: ${p.__errs.join(' | ')}`);
  // Live bretting: 884 → 412 → 884 uten reload
  if (name === 'fold9pro') {
    await p.setViewportSize({ width: 412, height: 915 }); await p.waitForTimeout(500);
    const m2 = await p.evaluate(measure); res.foldLukket = m2.layout;
    ok(!/fold/.test(m2.layout) && Math.abs(m2.padL - 18) < 0.5, `bretting: ble ikke telefon ved 412 (${m2.layout}, ${m2.padL})`);
    ok(!m2.cut, 'bretting: tittel kuttet ved 412');
    await p.setViewportSize({ width: 884, height: 1032 }); await p.waitForTimeout(500);
    const m3 = await p.evaluate(measure); res.foldIgjen = m3.layout;
    ok(/fold/.test(m3.layout) && Math.abs(m3.padL - 120) < 0.5 && m3.fs <= 42.01, 'bretting: ble ikke Fold igjen');
  }
  await p.close();
}

// 19.12: telefon 360 / 393 / 412 (Pixel 9 Pro / Fold lukket) / 430 – «👋 Sebastian!» helt; bildene tilpasser seg
for (const w of [360, 393, 412, 430]) {
  const p = await page(w, 900, true);
  await hjem(p);
  const m = await p.evaluate(measure); res['w' + w] = { fs: m.fs, av: m.av, gaps: m.gaps, bd: m.bd, more: m.more, txR: m.txR, f0L: m.f0L };
  ok(m.text === '👋 Sebastian!' && !m.cut && m.txR <= m.f0L, `19.12 ${w}: navnet dekkes (${m.txR} / ${m.f0L})`);
  ok(m.fs >= 28 - 0.01, `19.12 ${w}: tekst under 28 px (${m.fs})`);
  ok(m.av.every((x) => x >= 40), `19.12 ${w}: bilder under 40 px (${m.av})`);
  ok(m.av.length < 2 || m.gaps.every((g) => g <= -13), `19.12 ${w}: bildene overlapper ikke før de krymper (${m.gaps})`);
  ok(m.bd.every((x, i) => x <= 24 && x <= Math.round(m.av[i] * 0.4) + 1), `19.12 ${w}: merke ikke 40 % av bildet (${m.bd} / ${m.av})`);
  ok(!m.overflow, `19.12 ${w}: overflow`);
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/hdr1912-${w}.png` });
  ok(!p.__errs.length, `19.12 ${w}: ${p.__errs.join(' | ')}`);
  await p.close();
}
// 19.12 ④: mange personer på smal skjerm → «+N» i stedet for de siste bildene
{
  const p = await page(360, 900, true);
  await hjem(p);
  const m = await p.evaluate(measure);
  ok(m.more == null || /^\+\d$/.test(m.more), `19.12 +N: ${m.more}`);
  res.plusN = m.more;
  await p.close();
}

// 17.13/17.15: telefon 412 – standardverdier, merker, migrering, Sted, størrelser live
{
  const p = await page(412, 915, true);
  await hjem(p);
  const m = await p.evaluate(measure);
  ok(m.text === '👋 Sebastian!', `tekst: ${m.text}`);
  ok(m.av.length === 3 || m.av.length >= 3, `bilder: ${m.av.length}`);
  ok(m.bd.every((x) => x <= 24 && x <= Math.max(...m.av) / 2 + 0.5), `merker for store: ${m.bd}`);
  ok(m.arrowGap != null && m.arrowGap <= 6, `▾ står ikke rett etter teksten: ${m.arrowGap}`);
  res.def412 = m;
  // migrering: familie/under/kompakt → hilsen
  for (const mode of ['familie', 'under', 'kompakt']) {
    await hjem(p, { mode });
    ok((await p.evaluate(measure)).hil, `${mode} vises ikke som Hilsen`);
  }
  // Sted med langt husnavn
  await hjem(p, { mode: 'sted', this_server: { name: 'Hytta på Strømstad sommerhus' } });
  const s = await p.evaluate(measure); res.stedLang = s;
  ok(s.hil && !s.overflow, 'Sted: ikke hil / overflow');
  // størrelser: stort merke klemmes til 50 %, overlapp
  await hjem(p, { hBadge: 32, hAv: 40, hGap: -12, hFont: 30, hTGap: 0 });
  const z = await p.evaluate(measure); res.sizes = z;
  ok(z.bd.every((x, i) => x <= z.av[i] * 0.4 + 0.5), `merke > 40 %: ${z.bd} / ${z.av}`);
  ok(z.fs <= 30.01, `hFont ignoreres: ${z.fs}`);
  ok(z.gaps.every((g) => g < 0), `hGap negativ gir ikke overlapp: ${z.gaps}`);
  ok(z.fs <= 30.01 && !z.cut, `hFont 30: ${z.fs}`);
  // live endring via setConfig på headeren (som editoren gjør)
  const live = await p.evaluate(async () => {
    const all = []; const w = (r) => r.querySelectorAll('*').forEach((e) => { all.push(e); if (e.shadowRoot) w(e.shadowRoot); }); w(document);
    const H = all.find((e) => e.localName === 'msh-hjem-header-card');
    const before = H.shadowRoot.querySelector('.bd').getBoundingClientRect().width;
    H.setConfig({ ...H._rawConfig, hBadge: 14 }); await new Promise((q) => setTimeout(q, 200));
    return [before, H.shadowRoot.querySelector('.bd').getBoundingClientRect().width];
  });
  res.live = live; ok(Math.round(live[1]) === 14, `live hBadge: ${live}`);
  // «Tilpass header»: Oppsett-valg + Størrelser-slidere
  const ed = await p.evaluate(async () => {
    const all = () => { const o = []; const w = (r) => r.querySelectorAll('*').forEach((e) => { o.push(e); if (e.shadowRoot) w(e.shadowRoot); }); w(document); return o; };
    const H = all().find((e) => e.localName === 'msh-hjem-header-card');
    H.setConfig({ type: 'custom:msh-hjem-header-card', mode: 'familie' }); await new Promise((q) => setTimeout(q, 100));
    H.customize(); await new Promise((q) => setTimeout(q, 500));
    const E = all().find((e) => e.localName === 'msh-hjem-editor' || (e.localName === 'msh-editor' && e.shadowRoot && e.shadowRoot.querySelector('.xmodes')));
    if (!E) return null;
    const modes = [...E.shadowRoot.querySelectorAll('.xmode')].map((x) => x.querySelector('b').textContent + (x.classList.contains('on') ? '*' : ''));
    const sums = [...E.shadowRoot.querySelectorAll('summary')].map((s) => s.textContent.trim().replace(/\s+/g, ' '));
    const rng = [...E.shadowRoot.querySelectorAll('input[type=range]')].map((i) => i.dataset.name);
    return { modes, sums, rng };
  });
  res.editor = ed;
  ok(ed && ed.modes.join(',') === 'Hilsen*,Sted,Navn,Hjem,Stor hilsen,Profil', `Oppsett: ${ed && ed.modes}`);
  ok(ed && ['hFont', 'hAv', 'hBadge', 'hGap', 'hTGap'].every((k) => ed.rng.includes(k)), `slidere: ${ed && ed.rng}`);
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/hdr-editor.png` });
  ok(!p.__errs.length, `412: ${p.__errs.join(' | ')}`);
  await p.close();
}
// GUI-editoren (getConfigElement) har de samme feltene
{
  const p = await page(412, 915, true);
  const g = await p.evaluate(async () => {
    const C = customElements.get('msh-hjem-header-card');
    const el = C.getConfigElement(); el.hass = window.mockHass(); el.setConfig({ type: 'custom:msh-hjem-header-card', mode: 'sted' });
    document.body.appendChild(el); await new Promise((q) => setTimeout(q, 400));
    const R = el.shadowRoot;
    return { modes: [...R.querySelectorAll('.xmode')].map((x) => x.querySelector('b').textContent + (x.classList.contains('on') ? '*' : '')),
      names: [...R.querySelectorAll('[data-name]')].map((x) => x.dataset.name) };
  });
  res.gui = { modes: g.modes, h: g.names.filter((n) => /^h[A-Z]/.test(n)) };
  ok(g.modes.join(',') === 'Hilsen,Sted*,Navn,Hjem,Stor hilsen,Profil', `GUI Oppsett: ${g.modes}`);
  ok(['hFont', 'hAv', 'hBadge', 'hGap', 'hTGap'].every((k) => g.names.includes(k)), `GUI slidere mangler: ${g.names.filter((n) => /^h[A-Z]/.test(n))}`);
  await p.close();
}
// 19.13: header-profil per bruker × enhetsklasse
{
  const FOLD = 'Mozilla/5.0 (Linux; Android 15; Pixel 9 Pro Fold Build/AP4A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0 Mobile Safari/537.36';
  const ctx = await b.newContext({ viewport: { width: 884, height: 1032 }, hasTouch: true, userAgent: FOLD });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + resolve('test/harness.html'));
  for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
  await p.addScriptTag({ path: bundle });
  await hjem(p);
  const hdrFs = () => p.evaluate(() => { const o = []; const w = (r) => r.querySelectorAll('*').forEach((e) => { o.push(e); if (e.shadowRoot) w(e.shadowRoot); }); w(document); const H = o.find((e) => e.localName === 'msh-hjem-header-card' && e.getBoundingClientRect().width > 0 && !(e.parentElement && e.parentElement.classList.contains('xpvi'))); return parseFloat(getComputedStyle(H.shadowRoot.querySelector('.ttl .tx')).fontSize); });
  const fs0 = await hdrFs();
  const r = await p.evaluate(async () => {
    const wait = (ms) => new Promise((q) => setTimeout(q, ms));
    const all = () => { const o = []; const w = (r) => r.querySelectorAll('*').forEach((e) => { o.push(e); if (e.shadowRoot) w(e.shadowRoot); }); w(document); return o; };
    const H = all().find((e) => e.localName === 'msh-hjem-header-card');
    H.customize(); await wait(600);
    const E = all().find((e) => e.localName === 'msh-hjem-editor'), R = E.shadowRoot;
    const bar = () => R.querySelector('.xprof .xpl1 .xpsel b').parentElement.parentElement.querySelectorAll('.xpsel > b');
    const out = { cls: MSH.deviceClass(), line: [...bar()].map((x) => x.textContent).join(' · '), lab: R.querySelector('.xplab').textContent, pv: R.querySelector('.xpvi') && R.querySelector('.xpvi').style.width };
    const sl = () => R.querySelector('input[type=range][data-name="hFont"]');
    const s = sl(); s.value = '30'; s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true }));
    await wait(300);
    out.store = JSON.parse(JSON.stringify(MSH.store.get('header_profiles') || {}));
    out.dot = !!R.querySelector('.xpown');
    const cs = R.querySelector('select[data-psel="cls"]'); cs.value = 'fold_closed'; cs.dispatchEvent(new Event('change', { bubbles: true })); await wait(300);
    out.closed = { v: sl().value, pv: R.querySelector('.xpvi').style.width, help: R.querySelector('.xprof .help').textContent, opts: [...R.querySelector('select[data-psel="cls"]').options].map((o) => o.textContent) };
    const us = R.querySelector('select[data-psel="user"]'); out.users = [...us.options].map((o) => o.textContent);
    // GUI-editoren har samme velger
    const G = customElements.get('msh-hjem-header-card').getConfigElement(); G.hass = H.hass; G.setConfig({ type: 'custom:msh-hjem-header-card' }); document.body.appendChild(G); await wait(300);
    out.gui = !!G.shadowRoot.querySelector('.xprof select[data-psel="cls"]');
    G.remove();
    window.__E = E;
    return out;
  });
  res.prof = r;
  ok(r.cls === 'fold_open' && r.lab === 'Redigerer:' && /^Sebastian · Pixel Fold \(åpen\)denne$/.test(r.line), `19.13 linjen: ${r.lab} ${r.line}`);
  ok(r.pv === '840px', `19.13 forhåndsvisning Fold åpen: ${r.pv}`);
  ok(r.store['u1/fold_open'] && r.store['u1/fold_open'].hFont === 30 && Object.keys(r.store).length === 1 && r.dot, `19.13 lagret: ${JSON.stringify(r.store)}`);
  const fs1 = await hdrFs();
  ok(Math.abs(fs1 - 30 * 0.72) < 0.6 && fs0 > fs1, `19.13 headeren følger profilen live: ${fs0} → ${fs1}`);
  ok(r.closed.v === '58' && r.closed.pv === '412px' && /Arver fra kortets oppsett/.test(r.closed.help) && r.closed.opts.includes('● Pixel Fold (åpen) · denne'), `19.13 Fold lukket arver: ${JSON.stringify(r.closed)}`);
  ok(r.users.join(',') === '● Sebastian,Alle brukere', `19.13 brukere (admin): ${r.users}`);
  ok(r.gui, '19.13 GUI-editoren mangler bruker-/enhetsvelgeren');
  // bretting uten reload: 884 → 412 (fold_closed: standard) → 884 (fold_open: 30 px · 0,72)
  await p.setViewportSize({ width: 412, height: 915 }); await p.waitForTimeout(600);
  const fsC = await hdrFs(), clsC = await p.evaluate(() => MSH.deviceClass());
  await p.setViewportSize({ width: 884, height: 1032 }); await p.waitForTimeout(600);
  const fsO = await hdrFs();
  res.bretting = [clsC, fsC, fsO];
  ok(clsC === 'fold_closed' && fsC >= 28 && Math.abs(fsC - fs1) > 2 && Math.abs(fsO - fs1) < 0.6, `19.13 bretting bytter profil: ${res.bretting}`);
  // iPhone (samme bruker) påvirkes ikke
  const fsI = await p.evaluate(async () => { MSH.deviceClassOverride('iphone'); await new Promise((q) => setTimeout(q, 300)); const v = MSH.hjemHeaderProfile().hFont; MSH.deviceClassOverride(null); return v; });
  ok(fsI == null, `19.13 iPhone arver ikke Fold åpen: ${fsI}`);
  // Tilbakestill til arvet
  const rs = await p.evaluate(async () => {
    const E = window.__E, R = E.shadowRoot, wait = (ms) => new Promise((q) => setTimeout(q, ms));
    const cs = R.querySelector('select[data-psel="cls"]'); cs.value = 'fold_open'; cs.dispatchEvent(new Event('change', { bubbles: true })); await wait(200);
    const btn = R.querySelector('[data-a="x-preset"]'), dis0 = btn.disabled;
    btn.click(); await wait(300);
    return { dis0, store: MSH.store.get('header_profiles') || null, v: R.querySelector('input[type=range][data-name="hFont"]').value, dis1: R.querySelector('[data-a="x-preset"]').disabled };
  });
  const fsR = await hdrFs();
  ok(!rs.dis0 && rs.store == null && rs.v === '58' && rs.dis1 && Math.abs(fsR - fs0) < 0.6, `19.13 Tilbakestill til arvet: ${JSON.stringify(rs)} ${fsR}`);
  ok(!errs.length, `19.13: ${errs.join(' | ')}`);
  await ctx.close();
}
// 19.13: en annen bruker (ikke admin) ser bare sin egen profil
{
  const p = await page(412, 915, true);
  await p.evaluate(() => localStorage.setItem('ki:store', JSON.stringify({ header_profiles: { 'u1/annen': { hFont: 30 }, 'u1/*': { hFont: 31 } } })));
  const r = await p.evaluate(async () => {
    const wait = (ms) => new Promise((q) => setTimeout(q, ms));
    const h = window.mockHass(); h.user = { id: 'u2', name: 'Kari Nordmann', is_admin: false };
    const d = document.getElementById('dash'); d.innerHTML = '';
    const c = document.createElement('msh-hjem-header-card'); c.setConfig({ type: 'custom:msh-hjem-header-card', card_id: 'hdr' }); c.hass = h; d.appendChild(c);
    await wait(500);
    const fs = parseFloat(getComputedStyle(c.shadowRoot.querySelector('.ttl .tx')).fontSize);
    c.customize(); await wait(500);
    const all = () => { const o = []; const w = (r) => r.querySelectorAll('*').forEach((e) => { o.push(e); if (e.shadowRoot) w(e.shadowRoot); }); w(document); return o; };
    const E = all().find((e) => e.localName === 'msh-hjem-editor'), R = E.shadowRoot;
    return { fs, users: [...R.querySelector('select[data-psel="user"]').options].map((o) => o.textContent), copy: [...R.querySelectorAll('select[data-pcopy] option')].length, sel: E._pkey() };
  });
  res.u2 = r;
  ok(r.fs > 31 && r.users.join(',') === 'Kari' && r.copy === 1 && /^u2\//.test(r.sel), `19.13 annen bruker: ${JSON.stringify(r)}`);
  await p.close();
}
// 22.7: handlinger på personbilder (trykk = person-popup, hold = hurtigark, dobbelttrykk venter 260 ms, migrering, editor)
{
  const p = await page(412, 915, true);
  const r = await p.evaluate(async () => {
    const wait = (ms) => new Promise((q) => setTimeout(q, ms));
    const h = window.mockHass(); const d = document.getElementById('dash');
    const log = []; const oo = MSH.openPopup; MSH.openPopup = (x) => log.push('pop:' + x);
    MSH.allPopups = () => [{ hash: '#kart' }, ...Object.keys(h.states).filter((e) => e.startsWith('person.')).map((e) => ({ hash: '#person-' + e.split('.')[1] }))];
    const mk = (cfg) => { d.innerHTML = ''; const c = document.createElement('msh-hjem-header-card'); c.setConfig({ type: 'custom:msh-hjem-header-card', card_id: 'hdr', ...cfg }); c.hass = h; d.appendChild(c); return c; };
    const out = {};
    out.mig = [MSH.hjemPersonActions({}), MSH.hjemPersonActions({ person_tap: 'quick' }), MSH.hjemPersonActions({ person_tap: 'kart' }), MSH.hjemPersonActions({ person_tap: 'quick', person_actions: { hold: 'more' } })];
    let c = mk({}); await wait(500);
    const f = () => c.shadowRoot.querySelector('.faces .face[data-act="person"]');
    const pid = f().dataset.id; out.pid = pid;
    f().click(); out.tap = log.slice(); log.length = 0;
    // hold
    const r0 = f().getBoundingClientRect();
    f().dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true, clientX: r0.x + 5, clientY: r0.y + 5 }));
    await wait(650); f().dispatchEvent(new PointerEvent('pointerup', { bubbles: true, composed: true })); f().click();
    await wait(100);
    const all = () => { const o = []; const w = (r) => r.querySelectorAll('*').forEach((e) => { o.push(e); if (e.shadowRoot) w(e.shadowRoot); }); w(document); return o; };
    out.sheet = !!(c._sheets && c._sheets.size);
    out.holdPop = log.slice(); log.length = 0;
    document.querySelectorAll('body > *:not(#dash)').forEach((e) => { if (!/SCRIPT|STYLE/.test(e.tagName)) e.remove(); });
    // dobbelttrykk = more, trykk = kart
    const mi = []; window.addEventListener('hass-more-info', (e) => mi.push(e.detail.entityId));
    const fe = []; window.addEventListener('msh-kart-focus', (e) => fe.push(e.detail.entity_id));
    customElements.get('msh-kart-card') || customElements.define('msh-kart-card', class extends HTMLElement {});
    c = mk({ person_actions: { tap: 'kart', double: 'more', hold: 'none' } }); await wait(500);
    f().click(); out.waiting = log.length; await wait(320); out.kart = log.slice(); out.focus = fe.slice(); log.length = 0;
    f().click(); await wait(80); f().click(); await wait(350); out.dbl = { pop: log.slice(), mi: mi.slice() };
    // editor: seksjonen finnes og lagrer person_actions
    c.customize(); await wait(600);
    const E = all().find((e) => e.localName === 'msh-hjem-editor');
    const sel = E && E.shadowRoot.querySelector('select[data-pact="hold"]');
    out.ed = { has: !!sel, rows: E ? E.shadowRoot.querySelectorAll('[data-pact]').length : 0 };
    if (sel) { sel.value = 'popup'; sel.dispatchEvent(new Event('change', { bubbles: true })); await wait(300); out.ed.cfg = (E._config || {}).person_actions; }
    MSH.openPopup = oo;
    return out;
  });
  res.p227 = r;
  const [m0, m1, m2, m3] = r.mig;
  ok(m0.tap === 'popup' && m0.double === 'none' && m0.hold === 'quick' && m1.tap === 'quick' && m2.tap === 'popup' && m3.tap === 'popup' && m3.hold === 'more', `22.7 migrering: ${JSON.stringify(r.mig)}`);
  ok(r.tap.length === 1 && r.tap[0] === 'pop:#person-' + r.pid.split('.')[1], `22.7 trykk: ${JSON.stringify(r.tap)}`);
  ok(r.sheet && !r.holdPop.length, `22.7 hold → hurtigark: ${r.sheet} ${JSON.stringify(r.holdPop)}`);
  ok(r.waiting === 0 && r.kart.join() === 'pop:#kart' && r.focus.join() === r.pid, `22.7 kart + 260 ms: ${JSON.stringify(r)}`);
  ok(!r.dbl.pop.length && r.dbl.mi.join() === r.pid, `22.7 dobbelttrykk: ${JSON.stringify(r.dbl)}`);
  ok(r.ed.has && r.ed.rows === 3 && r.ed.cfg && r.ed.cfg.hold === 'popup', `22.7 editor: ${JSON.stringify(r.ed)}`);
  ok(!p.__errs.length, `22.7: ${p.__errs.join(' | ')}`);
  await p.close();
}
await b.close();
console.log(JSON.stringify(res, null, 1));
if (fails.length) { console.error('FEIL:\n' + fails.join('\n')); process.exit(1); }
console.log('header-check OK');
