/* KI MSH · kanallogo for radiospillere uten bilde (Fiks 51 A). Felles for mini-spilleren + utvidet meny (10-navbar.js),
 * Media-popupen (44-media.js) og spillerraden i Rom (31-rom.js). Kilde: Hjem v3.dc.html STATION_LOGOS + stationArt().
 *
 *   M.stationNorm(s) → små bokstaver, «+» → «pluss», uten mellomrom/punktum/bindestrek («NRK P1+» → «nrkp1pluss»)
 *   M.STATION_LOGOS → innebygd tabell [{ file, keys, contain, accent }] (filer i /local/ki/radio-logos/)
 *   M.stationLogo(stateObj, cfg) → { url, file, key, name, contain, accent, own } | null
 *     Navnekilder i rekkefølge: media_channel, media_title, media_artist, source, app_name. Treff = eksakt eller prefiks
 *     (aldri delstreng, så «p3» ikke treffer «mp3»), lengste nøkkel først (P1+ før P1, P3 Musikk før P3).
 *     cfg.station_logos { '<kanalnavn>': '/local/…png' } (normalisert likt) går foran den innebygde tabellen.
 *   M.stationArt(hass, stateObj, cfg, opts) → { url, kind: 'picture'|'logo'|'none', contain, accent, fallback }
 *     entity_picture(_local) først (via hass.hassUrl) – med mindre bildet har feilet før (M.STATION_BAD); da logoen.
 *     cfg utelatt → Media-kortets config (M.mediaCardCfg), så én tabell gjelder alle. opts.noLogo (TV) → bare bildet.
 *   M.stationArtImg(art, { cls, key, attrs }) → <img> med cover/contain-stil + reserve-logo (data-sa-fb)
 *   M.stationArtBind(root, onChange) → én error-lytter (capture) per shadow root: feilet bilde → bytt til logoen,
 *     ellers fjernes bildet (tomtilstand, mdi:radio/ikonet under). onChange (rAF-samlet) → kortet tegner på nytt.
 */
(function () {
  const M = window.MSH;
  if (!M) return;
  const BASE = '/local/ki/radio-logos/';
  // ki-hex-ok: logoenes dominante farger (aksent/glød fra «art» – NRK Klassisk lilla, P3 gul, mP3 grønn …)
  const T = [
    { file: 'nrk-p1.png', keys: ['NRK 1', 'NRK P1', 'P1'], accent: '#1f5cc4' }, // ki-hex-ok
    { file: 'nrk-p1pluss.png', keys: ['NRK P1+', 'P1+', 'P1 pluss'], accent: '#045f8a' }, // ki-hex-ok
    { file: 'nrk-p2.png', keys: ['NRK P2', 'P2'], accent: '#7a0039' }, // ki-hex-ok
    { file: 'nrk-p3.png', keys: ['NRK P3', 'P3', 'NRK P3 Musikk', 'P3 Musikk'], accent: '#ffe500' }, // ki-hex-ok
    { file: 'nrk-mp3.png', keys: ['NRK mP3', 'mP3'], accent: '#00ffa3' }, // ki-hex-ok
    { file: 'nrk-klassisk.png', keys: ['NRK Klassisk'], accent: '#6b0468' }, // ki-hex-ok
    { file: 'nrk-jazz.png', keys: ['NRK Jazz'], accent: '#4b167d' }, // ki-hex-ok
    { file: 'p4-lyden-av-norge.png', keys: ['P4', 'P4 Lyden av Norge', 'P4LydenAvNorge'], contain: true, accent: '#e4322b' }, // ki-hex-ok
    { file: 'radio-vinyl.png', keys: ['Vinyl', 'Radio Vinyl'], contain: true, accent: '#a67e43' }, // ki-hex-ok
  ];
  M.STATION_LOGOS = T;
  const norm = (s) => String(s == null ? '' : s).toLowerCase().replace(/\+/g, 'pluss').replace(/[\s.\-]+/g, '');
  M.stationNorm = norm;
  // Innebygde nøkler, lengste først
  const BUILT = [];
  T.forEach((e) => e.keys.forEach((k) => BUILT.push({ k: norm(k), e })));
  BUILT.sort((a, b) => b.k.length - a.k.length);
  const SRC = ['media_channel', 'media_title', 'media_artist', 'source', 'app_name'];
  const hit = (n, k) => !!k && (n === k || n.startsWith(k));
  const abs = (h, u) => {
    if (!u) return '';
    u = String(u);
    if (u[0] === '/' && u[1] !== '/' && h && typeof h.hassUrl === 'function') { try { return h.hassUrl(u) || u; } catch (e) { return u; } }
    return u;
  };
  // Mislykkede bilde-URL-er (prøves ikke igjen før siden lastes på nytt)
  const BAD = M.STATION_BAD = M.STATION_BAD || new Set();
  // Media-kortets effektive config (samme som 31-rom.js: live msh-media-card, ellers ki-store cards.pop-media)
  M.mediaCardCfg = M.mediaCardCfg || function () {
    const c = M.liveOf && M.liveOf('msh-media-card');
    return (c && c.config) || (M.store && (M.store.eff ? M.store.eff('cards.pop-media') : M.store.get('cards.pop-media'))) || {};
  };
  const ownTable = (cfg) => {
    const o = cfg && cfg.station_logos;
    if (!o || typeof o !== 'object') return [];
    const L = Array.isArray(o)
      ? o.map((x) => x && [x.name, x.url || x.path])
      : Object.keys(o).map((k) => [k, o[k] && typeof o[k] === 'object' ? o[k].url || o[k].path : o[k]]);
    return L.filter((x) => x && norm(x[0]) && x[1] && String(x[1]).trim()).map(([n, u]) => ({ k: norm(n), name: n, url: String(u).trim() })).sort((a, b) => b.k.length - a.k.length);
  };
  M.stationLogo = function (stateObj, cfg) {
    const a = (stateObj && stateObj.attributes) || {};
    const names = SRC.map((f) => a[f]).filter((v) => v != null && v !== '').map((v) => [String(v), norm(v)]).filter((x) => x[1]);
    if (!names.length) return null;
    const own = ownTable(cfg);
    for (const [raw, n] of names) {
      const o = own.find((x) => hit(n, x.k));
      if (o) return { url: o.url, file: null, key: o.k, name: raw, contain: false, accent: null, own: true };
    }
    for (const [raw, n] of names) {
      const b = BUILT.find((x) => hit(n, x.k));
      if (b) return { url: BASE + b.e.file, file: b.e.file, key: b.k, name: raw, contain: !!b.e.contain, accent: b.e.accent || null, own: false };
    }
    return null;
  };
  M.stationArt = function (hass, stateObj, cfg, opts) {
    opts = opts || {};
    if (cfg === undefined) { try { cfg = M.mediaCardCfg(); } catch (e) { cfg = {}; } }
    const a = (stateObj && stateObj.attributes) || {};
    const pic = abs(hass, a.entity_picture_local || a.entity_picture);
    let logo = null;
    if (!opts.noLogo) {
      const L = M.stationLogo(stateObj, cfg);
      if (L) { const u = abs(hass, L.url); if (u && !BAD.has(u)) logo = { url: u, kind: 'logo', contain: L.contain, accent: L.accent, key: L.key, file: L.file, own: L.own }; }
    }
    if (pic && !BAD.has(pic)) return { url: pic, kind: 'picture', contain: false, accent: null, fallback: logo };
    if (logo) return { ...logo, fallback: null };
    return { url: '', kind: 'none', contain: false, accent: null, fallback: null };
  };
  const CONTAIN = 'object-fit:contain;padding:10%;box-sizing:border-box;background:var(--gray300, #404040)'; // ki-hex-ok: mørk logoflate (prompt 51 A), som et bilde – lik i begge moduser
  const COVER = 'object-fit:cover';
  M.STATION_CONTAIN_CSS = CONTAIN;
  // <img> for en stationArt-verdi. Reserve-logoen (bildet feiler) ligger i data-sa-fb / -fbc (contain) / -fba (aksent).
  M.stationArtImg = function (art, o) {
    o = o || {};
    if (!art || !art.url) return '';
    const esc = M.esc, fb = art.fallback;
    return `<img${o.cls ? ` class="${esc(o.cls)}"` : ''} data-sa="${art.kind}"${art.contain ? ' data-sa-c="1"' : ''}${o.key ? ` data-key="${esc(o.key)}"` : ''}${fb ? ` data-sa-fb="${esc(fb.url)}" data-sa-fbc="${fb.contain ? 1 : 0}"${fb.accent ? ` data-sa-fba="${esc(fb.accent)}"` : ''}` : ''} src="${esc(art.url)}" alt="" draggable="false" style="${art.contain ? CONTAIN : COVER}"${o.attrs ? ' ' + o.attrs : ''}>`;
  };
  const BOUND = new WeakMap();
  M.stationArtBind = function (root, onChange) {
    if (!root || !root.addEventListener) return;
    const prev = BOUND.get(root);
    if (prev) { prev.cb = onChange; return; }
    const st = { cb: onChange, raf: 0 };
    BOUND.set(root, st);
    const kick = () => { if (st.raf || typeof st.cb !== 'function') return; st.raf = requestAnimationFrame(() => { st.raf = 0; try { st.cb(); } catch (e) { /* */ } }); };
    root.addEventListener('error', (e) => {
      const t = e.target;
      if (!t || t.tagName !== 'IMG' || !t.hasAttribute('data-sa')) return;
      const src = t.getAttribute('src');
      if (src) BAD.add(src);
      const fb = t.getAttribute('data-sa-fb');
      if (fb && !BAD.has(fb)) {
        const c = t.getAttribute('data-sa-fbc') === '1';
        t.removeAttribute('data-sa-fb');
        t.setAttribute('data-sa', 'logo');
        if (c) t.setAttribute('data-sa-c', '1'); else t.removeAttribute('data-sa-c');
        t.setAttribute('style', c ? CONTAIN : COVER);
        t.setAttribute('src', fb);
      } else t.remove(); // tomtilstand (ikonet under / neste tegning)
      kick();
    }, true);
  };
})();
