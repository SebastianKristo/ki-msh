// Fiks 17.13/17.15/17.20: «Hilsen»/«Sted» i headeren (én rad, store bilder, merker), justerbare størrelser,
// tittelen krymper før den kortes. Fiks 18.4/18.7: Fold-oppsettet (≥ 1000 px, berøring ≥ 600 px: Fold, iPad, PC) =
// telefon-innholdet i én kolonne i full bredde, padding-left = rail + 2 × avstand, header skalert 0,72, ingen zoom.
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
  return { hil: !!R.querySelector('.hd.hil'), text: tx.textContent, fs: parseFloat(getComputedStyle(tx).fontSize), cut: tx.scrollWidth > tx.clientWidth + 1,
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
  // Ellipsis bare som siste utvei: 18 px, bildene 32 px og full overlapp (−12)
  ok(!m.cut || (m.fs <= 18.01 && m.av.every((x) => x <= 32) && m.gaps.every((g) => g <= -12)), `${name}: tittelen er kuttet før bildene er krympet (${m.text} ${m.fs}px, ${m.av}, ${m.gaps})`);
  ok(!m.overflow, `${name}: horisontal overflow i header-raden`);
  ok(m.fs >= 18 - 0.01, `${name}: tittel under 18 px`);
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
  ok(z.bd.every((x, i) => x <= z.av[i] / 2 + 0.5), `merke > 50 %: ${z.bd} / ${z.av}`);
  ok(z.fs <= 30.01, `hFont ignoreres: ${z.fs}`);
  ok(z.gaps.every((g) => g < 0), `hGap negativ gir ikke overlapp: ${z.gaps}`);
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
await b.close();
console.log(JSON.stringify(res, null, 1));
if (fails.length) { console.error('FEIL:\n' + fails.join('\n')); process.exit(1); }
console.log('header-check OK');
