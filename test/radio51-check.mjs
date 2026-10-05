// Fiks 51 A · kanallogo når radioen ikke sender entity_picture (felles M.stationArt, src/06-station-art.js).
//  · treff: alle eksemplene i prompten (NRK P1 Østfold, P1+, P1 pluss, P3 Musikk vs mP3, P4LydenAvNorge, Radio Vinyl …),
//    lengste nøkkel først, eksakt/prefiks (aldri delstreng), kilderekkefølge media_channel → … → app_name
//  · config station_logos går foran den innebygde tabellen (normalisert likt); entity_picture går foran logoen
//  · feilet bilde → logoen; feilet logo / ingen treff → tomtilstand (mdi:radio)
//  · tegning i mini-spilleren, utvidet meny, Media-popupen og Rom-raden: cover vs contain (P4/Vinyl på --gray300 + 10 % padding)
//  · aksent: logoens farge i Media (Detaljert-kort og Album-bakgrunn) og glød i utvidet mini-spiller
//  · GUI: «Kanallogoer» i Musikk-fanen (kortets Tilpass og getConfigElement) – legg til, rediger, fjern → station_logos
// Kjør: node test/radio51-check.mjs
import { createRequire } from 'node:module';
import { readdirSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/radio51-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = [];
const ok = (name, cond, info) => res.push(`${cond ? '✔' : '✘'} ${name}${info != null ? ' · ' + JSON.stringify(info) : ''}`);

// Logo-«server»: http://logos.test/local/ki/radio-logos/<fil> → SVG i en farge per fil; MISSING → 404; /broken.jpg → 404
const COLS = { 'nrk-klassisk.png': '#7d3cf0', 'nrk-p3.png': '#f5d020', 'p4-lyden-av-norge.png': '#e4322b', 'radio-vinyl.png': '#f2a541', 'own.png': '#00aa88' };
async function page(missing = []) {
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('http://logos.test/**', (r) => {
    const u = new URL(r.request().url()), f = u.pathname.split('/').pop();
    if (f === 'broken.jpg' || missing.includes(f)) return r.fulfill({ status: 404, body: 'nope' });
    const col = COLS[f] || '#3f8fe8';
    return r.fulfill({ status: 200, headers: { 'content-type': 'image/svg+xml', 'access-control-allow-origin': '*' }, body: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="${col}"/></svg>` });
  });
  await p.goto('file://' + resolve('test/harness.html'));
  for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
  await p.addScriptTag({ path: bundle });
  await p.evaluate(() => {
    try { sessionStorage.clear(); localStorage.clear(); } catch (e) { /* */ }
    window.deepAll = (sel) => { const out = []; const walk = (root) => root.querySelectorAll('*').forEach((e) => { if (e.matches(sel)) out.push(e); if (e.shadowRoot) walk(e.shadowRoot); }); walk(document); return out; };
    window.deep = (sel) => window.deepAll(sel)[0] || null;
    window.wait = (ms) => new Promise((q) => setTimeout(q, ms));
    const H = window.mockHass(); H.themes = { ...(H.themes || {}), darkMode: true };
    H.hassUrl = (u) => (u && u[0] === '/' ? 'http://logos.test' + u : u);
    window.H = H;
    Object.keys(H.states).filter((k) => k.startsWith('media_player.')).forEach((k) => { H.states[k] = { ...H.states[k], state: 'off' }; });
    window.radio = (attrs) => {
      const s = H.states['media_player.kjokken_radio'], a = { ...s.attributes };
      ['entity_picture', 'media_title', 'media_artist', 'media_channel', 'source', 'app_name'].forEach((k) => delete a[k]);
      H.states['media_player.kjokken_radio'] = { ...s, state: 'playing', last_changed: new Date().toISOString(), attributes: { ...a, ...attrs } };
      window.H = { ...H, states: { ...H.states } }; window.H.hassUrl = H.hassUrl;
      return window.H;
    };
  });
  return { p, errs };
}

/* ---------------- 1. treff (enhetstester) */
{
  const { p, errs } = await page();
  const U = await p.evaluate(() => {
    const M = window.MSH, st = (a) => ({ entity_id: 'media_player.x', state: 'playing', attributes: a });
    const f = (a, cfg) => { const L = M.stationLogo(st(a), cfg || {}); return L ? L.file || ('own:' + L.url) : null; };
    const ch = (n) => f({ media_channel: n });
    return {
      norm: [M.stationNorm('NRK P1+'), M.stationNorm('P4 Lyden av Norge'), M.stationNorm('N.R.K-P 3'), M.stationNorm('P1 pluss')],
      cases: [
        ['NRK 1', ch('NRK 1')], ['NRK P1', ch('NRK P1')], ['P1', ch('P1')], ['NRK P1 Østfold', ch('NRK P1 Østfold')], ['NRK P1 Trøndelag', ch('NRK P1 Trøndelag')],
        ['NRK P1+', ch('NRK P1+')], ['P1+', ch('P1+')], ['P1 pluss', ch('P1 pluss')], ['nrk p1 pluss', ch('nrk p1 pluss')],
        ['NRK P2', ch('NRK P2')], ['P2', ch('P2')],
        ['NRK P3', ch('NRK P3')], ['P3', ch('P3')], ['NRK P3 Musikk', ch('NRK P3 Musikk')], ['P3 Musikk', ch('P3 Musikk')],
        ['NRK mP3', ch('NRK mP3')], ['mP3', ch('mP3')], ['MP3', ch('MP3')],
        ['NRK Klassisk', ch('NRK Klassisk')], ['NRK Jazz', ch('NRK Jazz')],
        ['P4', ch('P4')], ['P4 Lyden av Norge', ch('P4 Lyden av Norge')], ['P4LydenAvNorge', ch('P4LydenAvNorge')],
        ['Vinyl', ch('Vinyl')], ['Radio Vinyl', ch('Radio Vinyl')],
      ],
      neg: [ch('Radio Norge'), ch('Spotify'), ch('xP3'), ch('Klassisk'), ch('NRK Super'), f({})],
      // kilderekkefølge: media_channel før media_title; uten kanal → media_title, media_artist, source, app_name
      order: [f({ media_channel: 'NRK Jazz', media_title: 'P3' }), f({ media_title: 'Nyheter', media_artist: 'NRK P2' }), f({ source: 'Radio Vinyl' }), f({ app_name: 'NRK mP3' }), f({ media_title: 'Almost Blue', source: 'P4' })],
      // config: går foran innebygd (også på kortere/prefiks), normaliseres likt, tomme stier ignoreres
      own: [
        f({ media_channel: 'NRK P3' }, { station_logos: { 'nrk p3': '/local/own.png' } }),
        f({ media_channel: 'NRK P1 Østfold' }, { station_logos: { 'NRK-P1': '/local/own.png' } }),
        f({ media_channel: 'Radio Norge' }, { station_logos: { 'radio norge': '/local/own.png' } }),
        f({ media_channel: 'NRK P3' }, { station_logos: { 'NRK P3': '' } }),
        f({ media_title: 'P3', media_channel: 'Radio Norge' }, { station_logos: { 'P3': '/local/own.png' } }), // config over hele kildelisten
      ],
      meta: ['nrk-klassisk.png', 'nrk-p3.png', 'nrk-mp3.png', 'p4-lyden-av-norge.png', 'radio-vinyl.png', 'nrk-p1.png'].map((file) => { const e = M.STATION_LOGOS.find((x) => x.file === file); return [file, !!e.contain, e.accent]; }),
      // stationArt: bilde foran logo, logo uten bilde, ingenting
      art: [
        (({ url, kind, fallback }) => ({ url, kind, fb: fallback && fallback.url }))(M.stationArt(window.H, st({ media_channel: 'NRK Klassisk', entity_picture: '/api/media_player_proxy/x?token=1' }), {})),
        (({ url, kind, contain, accent }) => ({ url, kind, contain, accent }))(M.stationArt(window.H, st({ media_channel: 'NRK Klassisk' }), {})),
        (({ url, kind, contain }) => ({ url, kind, contain }))(M.stationArt(window.H, st({ media_channel: 'P4 Lyden av Norge' }), {})),
        (({ url, kind }) => ({ url, kind }))(M.stationArt(window.H, st({ media_channel: 'Ukjent' }), {})),
        (({ kind }) => ({ kind }))(M.stationArt(window.H, st({ media_channel: 'NRK Klassisk' }), {}, { noLogo: true })),
        (({ url, kind }) => ({ url, kind }))(M.stationArt(window.H, st({ media_channel: 'Min kanal' }), { station_logos: { 'Min kanal': '/local/own.png' } })),
      ],
    };
  });
  ok('normalisering', JSON.stringify(U.norm) === JSON.stringify(['nrkp1pluss', 'p4lydenavnorge', 'nrkp3', 'p1pluss']), U.norm);
  const want = { 'NRK 1': 'nrk-p1.png', 'NRK P1': 'nrk-p1.png', P1: 'nrk-p1.png', 'NRK P1 Østfold': 'nrk-p1.png', 'NRK P1 Trøndelag': 'nrk-p1.png',
    'NRK P1+': 'nrk-p1pluss.png', 'P1+': 'nrk-p1pluss.png', 'P1 pluss': 'nrk-p1pluss.png', 'nrk p1 pluss': 'nrk-p1pluss.png',
    'NRK P2': 'nrk-p2.png', P2: 'nrk-p2.png', 'NRK P3': 'nrk-p3.png', P3: 'nrk-p3.png', 'NRK P3 Musikk': 'nrk-p3.png', 'P3 Musikk': 'nrk-p3.png',
    'NRK mP3': 'nrk-mp3.png', mP3: 'nrk-mp3.png', MP3: 'nrk-mp3.png', 'NRK Klassisk': 'nrk-klassisk.png', 'NRK Jazz': 'nrk-jazz.png',
    P4: 'p4-lyden-av-norge.png', 'P4 Lyden av Norge': 'p4-lyden-av-norge.png', P4LydenAvNorge: 'p4-lyden-av-norge.png', Vinyl: 'radio-vinyl.png', 'Radio Vinyl': 'radio-vinyl.png' };
  const bad = U.cases.filter(([n, f]) => want[n] !== f);
  ok(`alle ${U.cases.length} kanalnavn i prompten treffer riktig logo (P1+ før P1, P3 Musikk før P3, mP3 ≠ P3)`, !bad.length, bad.length ? bad : undefined);
  ok('ingen treff: Radio Norge, Spotify, xP3 (ikke delstreng), Klassisk (uten NRK), NRK Super, tomt', U.neg.every((x) => x === null), U.neg);
  ok('kilderekkefølge media_channel → media_title → media_artist → source → app_name', JSON.stringify(U.order) === JSON.stringify(['nrk-jazz.png', 'nrk-p2.png', 'radio-vinyl.png', 'nrk-mp3.png', 'p4-lyden-av-norge.png']), U.order);
  ok('config station_logos går foran innebygd (normalisert, prefiks), tom sti ignoreres', JSON.stringify(U.own) === JSON.stringify(['own:/local/own.png', 'own:/local/own.png', 'own:/local/own.png', 'nrk-p3.png', 'own:/local/own.png']), U.own);
  const meta = Object.fromEntries(U.meta.map(([f, c, a]) => [f, [c, a]]));
  ok('contain bare for P4 og Vinyl', meta['p4-lyden-av-norge.png'][0] && meta['radio-vinyl.png'][0] && !meta['nrk-klassisk.png'][0] && !meta['nrk-p3.png'][0] && !meta['nrk-p1.png'][0], meta);
  const hue = (hex) => { const [r, g, bb] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255), mx = Math.max(r, g, bb), mn = Math.min(r, g, bb), d = mx - mn; if (!d) return 0; let h = mx === r ? ((g - bb) / d) % 6 : mx === g ? (bb - r) / d + 2 : (r - g) / d + 4; h *= 60; return h < 0 ? h + 360 : h; };
  const hk = hue(meta['nrk-klassisk.png'][1]), h3 = hue(meta['nrk-p3.png'][1]), hm = hue(meta['nrk-mp3.png'][1]);
  ok('aksent: Klassisk lilla, P3 gul, mP3 grønn', hk > 270 && hk < 320 && h3 > 40 && h3 < 65 && hm > 100 && hm < 170, { hk, h3, hm });
  const A = U.art;
  ok('entity_picture foran logo (hassUrl), logoen som reserve', A[0].kind === 'picture' && A[0].url === 'http://logos.test/api/media_player_proxy/x?token=1' && A[0].fb === 'http://logos.test/local/ki/radio-logos/nrk-klassisk.png', A[0]);
  ok('uten bilde: logo /local/ki/radio-logos/ via hassUrl, cover + aksent', A[1].kind === 'logo' && A[1].url === 'http://logos.test/local/ki/radio-logos/nrk-klassisk.png' && !A[1].contain && !!A[1].accent, A[1]);
  ok('P4: contain', A[2].kind === 'logo' && A[2].contain === true, A[2]);
  ok('ingen treff → kind none', A[3].kind === 'none' && A[3].url === '', A[3]);
  ok('TV (noLogo) → ingen logo', A[4].kind === 'none', A[4]);
  ok('egen logo fra config via hassUrl', A[5].kind === 'logo' && A[5].url === 'http://logos.test/local/own.png', A[5]);
  ok('ingen sidefeil (treff)', !errs.length, errs);
  await p.close();
}

/* ---------------- 2. mini-spilleren + utvidet meny */
const artOf = (p, root) => p.evaluate((root) => {
  const el = root === 'mini' ? deepAll('[data-mini] .mrow').map((r) => r.querySelector('.mart')).find(Boolean) : null;
  if (!el) return null;
  const img = el.querySelector('img'), cs = img && getComputedStyle(img), r = el.getBoundingClientRect();
  return { kind: el.dataset.saKind, src: img && img.getAttribute('src'), sa: img && img.dataset.sa, fit: cs && cs.objectFit, pad: cs && cs.paddingLeft, bg: cs && cs.backgroundColor, ok: !!(img && img.complete && img.naturalWidth), w: r.width,
    icon: (el.querySelector('ha-icon') ? el.querySelector('ha-icon').getAttribute('icon') : null), bgArt: el.style.background, sh: el.style.boxShadow, radius: getComputedStyle(el).borderRadius, iw: img ? img.getBoundingClientRect().width : 0 };
}, root);
{
  const { p, errs } = await page(['nrk-jazz.png']);
  const mount = async (attrs) => p.evaluate(async (attrs) => {
    const H = window.radio(attrs);
    let c = deep('msh-navbar-card');
    if (!c) { c = document.createElement('msh-navbar-card'); c.setConfig({ type: 'custom:msh-navbar-card', card_id: 'ki-navbar' }); document.getElementById('dash').appendChild(c); }
    c.hass = H; await wait(700);
  }, attrs);
  await mount({ media_channel: 'NRK Klassisk', media_title: 'Symfoni nr. 5' });
  let a = await artOf(p, 'mini');
  ok('mini: NRK Klassisk uten bilde → logo, cover, lastet', a && a.kind === 'logo' && /nrk-klassisk\.png$/.test(a.src) && a.fit === 'cover' && a.ok && a.pad === '0px', a);
  ok('mini: samme radius som vanlig art (rund 48 px, bildet fyller flaten)', a && a.radius === '50%' && Math.abs(a.iw - a.w) < 1, a && { r: a.radius, w: a.w, iw: a.iw });
  await mount({ media_channel: 'P4 Lyden av Norge' });
  a = await artOf(p, 'mini');
  ok('mini: P4 → contain på --gray300 (#404040) med 10 % padding', a && /p4-lyden-av-norge\.png$/.test(a.src) && a.fit === 'contain' && a.bg === 'rgb(64, 64, 64)' && Math.abs(parseFloat(a.pad) - 4.8) < 0.2, a);
  await mount({ media_channel: 'Radio Vinyl' });
  a = await artOf(p, 'mini');
  ok('mini: Radio Vinyl → contain', a && /radio-vinyl\.png$/.test(a.src) && a.fit === 'contain', a);
  await mount({ media_channel: 'NRK P3', entity_picture: 'http://logos.test/broken.jpg' });
  await p.waitForTimeout(400);
  a = await artOf(p, 'mini');
  ok('mini: bilde feiler → bytter til logoen (P3)', a && a.sa === 'logo' && /nrk-p3\.png$/.test(a.src) && a.ok, a);
  await mount({ media_channel: 'NRK Jazz' }); // filen mangler (404)
  await p.waitForTimeout(400);
  a = await artOf(p, 'mini');
  ok('mini: logofil mangler → tomtilstand (mdi:radio, intet bilde)', a && !a.src && a.icon === 'mdi:radio', a);
  await mount({ media_channel: 'Radio Norge' });
  a = await artOf(p, 'mini');
  ok('mini: ingen treff, ingen bilde → tomtilstand mdi:radio', a && !a.src && a.kind === 'none' && a.icon === 'mdi:radio', a);
  // utvidet meny
  await mount({ media_channel: 'NRK Klassisk' });
  await p.evaluate(async () => { const c = deep('msh-navbar-card'); c._mExp = 'media_player.kjokken_radio'; c._schedule(true); await wait(500); });
  const x = await p.evaluate(() => { const el = deep('.mrow.mx .mart'); if (!el) return null; const img = el.querySelector('img'); return { src: img && img.getAttribute('src'), fit: img && getComputedStyle(img).objectFit, sh: getComputedStyle(el).boxShadow, bg: getComputedStyle(el).backgroundColor }; });
  ok('utvidet meny: logo + lilla aksent-glød', x && /nrk-klassisk\.png$/.test(x.src) && x.fit === 'cover' && /rgba?\(|srgb/.test(x.sh) && x.sh !== 'none', x);
  // aksentglød er lilla (r og b > g)
  const m = x && (x.sh.match(/rgba?\(([\d.]+), ([\d.]+), ([\d.]+)/) || x.sh.match(/srgb ([\d.]+) ([\d.]+) ([\d.]+)/));
  ok('utvidet meny: glødfargen er lilla', !!m && +m[3] > +m[2] && +m[1] > +m[2], m && m.slice(1, 4));
  // station_logos fra Media-kortets config (felles tabell)
  await p.evaluate(async () => {
    const mc = document.createElement('msh-media-card'); mc.setConfig({ type: 'custom:msh-media-card', card_id: 'pop-media', station_logos: { 'Radio Norge': '/local/own.png' } }); mc.hass = window.H; mc.style.display = 'none'; document.getElementById('dash').appendChild(mc);
    await wait(300);
  });
  await mount({ media_channel: 'Radio Norge' });
  await p.evaluate(async () => { const c = deep('msh-navbar-card'); c._mExp = null; c._schedule(true); await wait(400); });
  a = await artOf(p, 'mini');
  ok('mini leser station_logos fra Media-kortet (Radio Norge → egen logo)', a && /\/local\/own\.png$/.test(a.src) && a.ok, a);
  ok('ingen sidefeil (mini)', !errs.length, errs);
  await p.close();
}

/* ---------------- 3. Media-popupen (Album og Detaljert) */
{
  const { p, errs } = await page();
  const media = (attrs, cfg) => p.evaluate(async ({ attrs, cfg }) => {
    const H = window.radio(attrs);
    document.querySelectorAll('msh-media-card').forEach((x) => x.remove());
    const mc = document.createElement('msh-media-card'); mc.setConfig({ type: 'custom:msh-media-card', card_id: 'pop-media', start_tab: 'musikk', toasts: false, ...cfg }); mc.hass = H; document.getElementById('dash').appendChild(mc);
    await wait(900);
    const sec = deepAll('section[data-ent="media_player.kjokken_radio"]')[0];
    if (!sec) return null;
    const art = sec.querySelector('.al-art, .art'), img = art && art.querySelector('img'), cs = img && getComputedStyle(img);
    return { kind: art.dataset.saKind, src: img && img.getAttribute('src'), fit: cs && cs.objectFit, pad: cs && cs.paddingLeft, ibg: cs && cs.backgroundColor, ok: !!(img && img.complete && img.naturalWidth), aw: art.getBoundingClientRect().width, iw: img ? img.getBoundingClientRect().width : 0,
      rad: getComputedStyle(art).borderRadius, secBg: getComputedStyle(sec).backgroundColor, secBgImg: sec.style.background, artSh: art.style.boxShadow, icon: (art.querySelector('ha-icon') ? art.querySelector('ha-icon').getAttribute('icon') : null) };
  }, { attrs, cfg: cfg || {} });
  let m = await media({ media_channel: 'NRK Klassisk', media_title: 'Symfoni nr. 5' });
  ok('Media (Album): NRK Klassisk → logo, cover, fyller art (104 px, radius 20)', m && m.kind === 'logo' && /nrk-klassisk\.png$/.test(m.src) && m.fit === 'cover' && m.ok && Math.abs(m.iw - m.aw) < 1 && m.rad === '20px', m);
  const bgK = m && m.secBg;
  const mm = bgK && bgK.match(/rgb\((\d+), (\d+), (\d+)/);
  ok('Media (Album): bakgrunn fra logoens aksent (lilla, mørknet)', !!mm && +mm[3] > +mm[2] && +mm[1] > +mm[2], bgK);
  m = await media({ media_channel: 'NRK P3' });
  const m3 = m && m.secBg.match(/rgb\((\d+), (\d+), (\d+)/);
  ok('Media (Album): P3 → gul tone (r,g > b)', !!m3 && +m3[1] > +m3[3] && +m3[2] > +m3[3], m && m.secBg);
  m = await media({ media_channel: 'P4' });
  ok('Media (Album): P4 → contain på --gray300 med 10 % padding', m && m.fit === 'contain' && m.ibg === 'rgb(64, 64, 64)' && Math.abs(parseFloat(m.pad) - 10.4) < 0.3, m);
  m = await media({ media_channel: 'NRK Klassisk' }, { now_playing: { style: 'detailed' } });
  ok('Media (Detaljert): logo + aksent i bakgrunn og skygge', m && /nrk-klassisk\.png$/.test(m.src) && /#6b0468/i.test(m.secBgImg || '') && /107, 4, 104|#6b0468/i.test(m.artShadow || m.artSh || ''), m && { src: m.src, bg: m.secBgImg, sh: m.artSh });
  m = await media({ media_channel: 'NRK Klassisk', entity_picture: 'http://logos.test/cover.jpg' });
  ok('Media: entity_picture vinner over logoen', m && m.kind === 'picture' && /cover\.jpg$/.test(m.src), m);
  m = await media({ media_channel: 'NRK Klassisk', entity_picture: 'http://logos.test/broken.jpg' });
  await p.waitForTimeout(300);
  m = await p.evaluate(() => { const sec = deepAll('section[data-ent="media_player.kjokken_radio"]')[0], img = sec && sec.querySelector('.al-art img'); return img ? { src: img.getAttribute('src'), sa: img.dataset.sa } : null; });
  ok('Media: feilet bilde → logoen', m && m.sa === 'logo' && /nrk-klassisk\.png$/.test(m.src), m);
  m = await media({ media_channel: 'Ukjent kanal' });
  ok('Media: ingen treff → tomtilstand (mdi:radio)', m && !m.src && m.kind === 'none' && m.icon === 'mdi:radio', m);
  m = await media({ media_channel: 'Ukjent kanal' }, { station_logos: { 'ukjent kanal': '/local/own.png' } });
  ok('Media: egen station_logos i kortets config', m && m.kind === 'logo' && /own\.png$/.test(m.src) && m.ok, m);
  ok('ingen sidefeil (Media)', !errs.length, errs);
  await p.close();
}

/* ---------------- 4. Rom-popupens spillerrad */
{
  const { p, errs } = await page();
  const rom = (attrs) => p.evaluate(async (attrs) => {
    const H = window.radio(attrs);
    document.querySelectorAll('msh-rom-card').forEach((x) => x.remove());
    const r = document.createElement('msh-rom-card'); r.setConfig({ type: 'custom:msh-rom-card', card_id: 'r51', area: 'kjokken' }); r.hass = H; document.getElementById('dash').appendChild(r);
    await wait(300); r.setUI({ acc: { media: true } }); await wait(600);
    const mt = r.shadowRoot.querySelector('.mt[data-ent="media_player.kjokken_radio"]');
    if (!mt) return null;
    const art = mt.querySelector('.art'), img = art.querySelector('img'), cs = img && getComputedStyle(img);
    return { kind: art.dataset.saKind, src: img && img.getAttribute('src'), fit: cs && cs.objectFit, ibg: cs && cs.backgroundColor, ok: !!(img && img.complete && img.naturalWidth), rad: getComputedStyle(art).borderRadius, aw: art.getBoundingClientRect().width, iw: img ? img.getBoundingClientRect().width : 0 };
  }, attrs);
  let r = await rom({ media_channel: 'NRK Klassisk' });
  ok('Rom: NRK Klassisk → logo, cover, fyller den runde art-flaten', r && r.kind === 'logo' && /nrk-klassisk\.png$/.test(r.src) && r.fit === 'cover' && r.ok && Math.abs(r.iw - r.aw) < 1, r);
  r = await rom({ media_channel: 'Radio Vinyl' });
  ok('Rom: Radio Vinyl → contain på --gray300', r && r.fit === 'contain' && r.ibg === 'rgb(64, 64, 64)', r);
  r = await rom({ media_channel: 'NRK P3', entity_picture: 'http://logos.test/broken.jpg' });
  await p.waitForTimeout(300);
  r = await p.evaluate(() => { const img = deep('msh-rom-card').shadowRoot.querySelector('.mt[data-ent="media_player.kjokken_radio"] .art img'); return img ? { src: img.getAttribute('src'), sa: img.dataset.sa } : null; });
  ok('Rom: feilet bilde → logoen', r && r.sa === 'logo' && /nrk-p3\.png$/.test(r.src), r);
  r = await rom({ media_channel: 'Ukjent' });
  ok('Rom: ingen treff → tomtilstand (ikon, intet bilde)', r && !r.src && r.kind === 'none', r);
  ok('ingen sidefeil (Rom)', !errs.length, errs);
  await p.close();
}

/* ---------------- 5. GUI: Kanallogoer (kortets Tilpass-skjema = getConfigElement) */
{
  const { p, errs } = await page();
  const G = await p.evaluate(async () => {
    const El = customElements.get('msh-media-card'), ed = El.getConfigElement();
    let last = null; ed.addEventListener('config-changed', (e) => { last = e.detail.config; });
    ed.hass = window.H; ed.setConfig({ type: 'custom:msh-media-card', card_id: 'gui51', station_logos: { 'Radio Norge': '/local/rn.png' } });
    document.getElementById('dash').appendChild(ed); await wait(300);
    const R = ed.shadowRoot;
    const tab = R.querySelector('[data-t="musikk"]'); if (tab) tab.click(); await wait(300);
    const out = { tabs: !!tab, sec: !!R.querySelector('[data-key="msl"]'), rows0: R.querySelectorAll('[data-sl="name"]').length, v0: (R.querySelector('[data-sl="url"]') || {}).value };
    R.querySelector('[data-op="sladd"]').click(); await wait(200);
    out.afterAdd = JSON.parse(JSON.stringify(last && last.station_logos));
    const names = R.querySelectorAll('[data-sl="name"]'), urls = R.querySelectorAll('[data-sl="url"]');
    out.rows1 = names.length;
    names[1].value = 'NRK P1+'; names[1].dispatchEvent(new Event('change', { bubbles: true, composed: true })); await wait(200);
    const u2 = R.querySelectorAll('[data-sl="url"]')[1]; u2.value = '/local/p1pluss.png'; u2.dispatchEvent(new Event('change', { bubbles: true, composed: true })); await wait(200);
    out.afterEdit = JSON.parse(JSON.stringify(last && last.station_logos));
    R.querySelectorAll('[data-op="sldel"]')[0].click(); await wait(200);
    out.afterDel = JSON.parse(JSON.stringify(last && last.station_logos));
    out.urls1 = urls.length;
    // kortets egen Tilpass bruker samme skjema
    const mc = document.createElement('msh-media-card'); mc.setConfig({ type: 'custom:msh-media-card', card_id: 'own51' }); mc.hass = window.H; document.getElementById('dash').appendChild(mc); await wait(300);
    const sch = El.schema(window.H, {});
    out.schemaHas = sch.some((f) => f && f.type === 'html' && /Kanallogoer/.test(String(f.html && f.html(window.H, {}, 'k', null))));
    return out;
  });
  ok('GUI: Musikk-fanen har «Kanallogoer» med eksisterende rad', G.tabs && G.sec && G.rows0 === 1 && G.v0 === '/local/rn.png', G);
  ok('GUI: «Legg til» → ny rad (Ny kanal, /local/ki/radio-logos/)', G.afterAdd && G.afterAdd['Radio Norge'] === '/local/rn.png' && G.afterAdd['Ny kanal'] === '/local/ki/radio-logos/' && G.rows1 === 2, G.afterAdd);
  ok('GUI: rediger navn + sti → station_logos', G.afterEdit && G.afterEdit['NRK P1+'] === '/local/p1pluss.png' && !('Ny kanal' in G.afterEdit), G.afterEdit);
  ok('GUI: fjern → raden borte', G.afterDel && !('Radio Norge' in G.afterDel) && G.afterDel['NRK P1+'] === '/local/p1pluss.png', G.afterDel);
  ok('kortets Tilpass-skjema (samme som getConfigElement) har Kanallogoer i Musikk', G.schemaHas, G.schemaHas);
  ok('ingen sidefeil (GUI)', !errs.length, errs);
  await p.close();
}

await b.close();
try { rmSync(bundle); } catch (e) { /* */ }
console.log(res.join('\n'));
const fail = res.filter((r) => r.startsWith('✘')).length;
console.log(`\n${res.length - fail}/${res.length} ok`);
process.exit(fail ? 1 : 0);
