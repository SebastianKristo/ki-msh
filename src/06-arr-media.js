/* KI MSH · M.arrMedia – Sonarr/Radarr/Plex «kommer»-media med plakater (Fiks 47 K). Brukes av Kalender → Framover og Hjem «Kommer i dag».
 *
 *   M.arrMedia.items(hass, { from, to, cfg }) → Promise<[{ source:'sonarr'|'radarr'|'plex', title, sub, time, poster, fanart, start, allDay, entity }]>
 *     from/to: Date | ms | ISO (standard i dag 00:00 → +14 d). cfg (valgfri) = kortets config: sonarr_entity, radarr_entity,
 *     plex_entity (tom = autodetekt, M.arrMedia.detect), posters: 'hide' | false → poster/fanart alltid null. Sortert på start.
 *     poster/fanart er allerede sikre URL-er (M.arrMedia.img) eller null → vis plassholder. time = «21:00» ('' hele dagen).
 *   M.arrMedia.art(hass, title, source, cfg) → { poster, fanart } synkront (upcoming_media-sensor → Plex entity_picture →
 *     24 t-cache). M.arrMedia.fetchArt(hass, [titler], source, cfg) → Promise (HA-tjeneste sonarr.* / radarr.* med
 *     return_response, finnes den – aldri API-nøkler i nettleseren; images[] → remoteUrl, ikke url). Fyller cachen.
 *   M.arrMedia.img(hass, url) → sikker URL eller null: https://, //host (→ https), data:image, eller HA-sti /api/… og
 *     /local/… gjort absolutt via hass.hassUrl(). http:// avvises når HA/siden er https (blandet innhold). Bilder som
 *     feilet å laste (onerror) huskes i økten og gir null.
 *   M.arrMedia.detect(hass) → { sonarr, radarr, plex, sonarr_cal, radarr_cal } entitets-IDer (sensor.*upcoming_media* /
 *     sensor med data-attributt først, ellers calendar.sonarr* / radarr*; Plex: sensor *plex*recent*|added ellers media_player plex)
 *   M.arrMedia.cached(title) / M.arrMedia.remember(title, { poster, fanart }) → localStorage per tittel, 24 t (ki-arr:<tittel>)
 *   M.arrMedia.hue(title) → 0–359 (fast plassholderfarge per tittel)
 *   M.arrMedia.imgHTML(url, { cls, title, icon, attrs }) → '<span class="ki-arr-img …" style="--arr-h:…">[ikon]<img loading=lazy
 *     decoding=async referrerpolicy=no-referrer …></span>' – stripet plassholder under; bildet vises ved load, ved error
 *     blir plassholderen stående. Krever M.arrMedia.bind(shadowRoot) etter hver tegning + M.arrMedia.CSS i stilene.
 *   Debug: window.__kiArrDebug = true → console.debug('[ki-arr] kilde/URL per rad'). Av som standard.
 */
(function () {
  const M = window.MSH;
  if (!M || (M.arrMedia && M.arrMedia.items)) return;
  const DAY = 86400000, TTL = DAY, LSP = 'ki-arr:';
  const dbg = (...a) => { if (window.__kiArrDebug) { try { console.debug('[ki-arr]', ...a); } catch (e) { /* */ } } };
  const norm = (t) => String(t == null ? '' : t).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/\(\d{4}\)/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const pDate = (v) => { if (v == null || v === '') return null; const d = v instanceof Date ? v : new Date(typeof v === 'number' ? v : String(v)); return isNaN(d) ? null : d; };
  const low = (h, id) => { const s = h && h.states[id]; return (id + ' ' + ((s && s.attributes && s.attributes.friendly_name) || '')).toLowerCase(); };
  const plat = (h, id) => (h && h.entities && h.entities[id] && h.entities[id].platform) || '';
  const hm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const failed = new Set();

  /* ---------------------------------------------------------------- sikre URL-er */
  const isHttps = (h) => {
    try { if (location.protocol === 'https:') return true; } catch (e) { /* */ }
    const base = h && h.auth && h.auth.data && h.auth.data.hassUrl;
    return /^https:/i.test(String(base || ''));
  };
  const abs = (h, p) => { try { if (h && typeof h.hassUrl === 'function') return h.hassUrl(p); } catch (e) { /* */ } return p; };
  function img(h, url) {
    if (!url || typeof url !== 'string') return null;
    let u = url.trim();
    if (!u) return null;
    let out = null;
    if (/^data:image\//i.test(u)) out = u;
    else if (/^https:\/\//i.test(u)) out = u;
    else if (/^\/\//.test(u)) out = 'https:' + u;
    else if (/^http:\/\//i.test(u)) out = isHttps(h) ? null : u; // blandet innhold på https → plassholder
    else if (/^\/(api|local)\//.test(u)) out = abs(h, u); // HA-proxy (media_player_proxy, image_proxy) / HAs egne filer
    if (out && failed.has(out)) out = null;
    if (!out) dbg('avvist', url);
    return out;
  }

  /* ---------------------------------------------------------------- cache per tittel (24 t) */
  function cached(title) {
    const k = norm(title);
    if (!k) return null;
    try {
      const o = JSON.parse(localStorage.getItem(LSP + k) || 'null');
      if (!o || Date.now() - (o.t || 0) > TTL) return null;
      return { poster: o.p || null, fanart: o.f || null };
    } catch (e) { return null; }
  }
  function remember(title, o) {
    const k = norm(title);
    if (!k || !o || (!o.poster && !o.fanart)) return;
    const cur = cached(title) || {};
    try { localStorage.setItem(LSP + k, JSON.stringify({ p: o.poster || cur.poster || null, f: o.fanart || cur.fanart || null, t: Date.now() })); } catch (e) { /* */ }
  }

  /* ---------------------------------------------------------------- kilder */
  const dataOf = (st) => {
    let d = st && st.attributes && st.attributes.data;
    if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { d = null; } }
    return Array.isArray(d) ? d.filter((x) => x && x.title && !x.title_default) : [];
  };
  const hasData = (h, id) => { const st = h.states[id]; const d = st && st.attributes && st.attributes.data; return Array.isArray(d) || (typeof d === 'string' && /^\s*\[/.test(d)); };
  function detect(h) {
    const out = { sonarr: null, radarr: null, plex: null, sonarr_cal: null, radarr_cal: null };
    if (!h || !h.states) return out;
    const ids = Object.keys(h.states).sort();
    ['sonarr', 'radarr'].forEach((k) => {
      const rx = new RegExp(k);
      const sens = ids.filter((id) => id.startsWith('sensor.') && (rx.test(id) || plat(h, id) === k + '_upcoming_media'));
      out[k] = sens.find((id) => /upcoming_media/.test(id) && hasData(h, id)) || sens.find((id) => /upcoming|kommende/.test(id) && hasData(h, id)) || sens.find((id) => hasData(h, id)) || null;
      out[k + '_cal'] = ids.find((id) => id.startsWith('calendar.') && rx.test(low(h, id))) || null;
      if (!out[k]) out[k] = out[k + '_cal'];
    });
    out.plex = ids.find((id) => id.startsWith('sensor.') && /plex/.test(id) && /recent|added|nylig|upcoming/.test(id) && hasData(h, id))
      || ids.find((id) => id.startsWith('media_player.') && (plat(h, id) === 'plex' || /plex/.test(id))) || null;
    return out;
  }
  const srcIds = (h, cfg) => {
    const d = detect(h), c = cfg || {};
    const pick = (k) => (c[k + '_entity'] && c[k + '_entity'] !== 'none' ? c[k + '_entity'] : c[k + '_entity'] === 'none' ? null : d[k]);
    return { sonarr: pick('sonarr'), radarr: pick('radarr'), plex: pick('plex'), sonarr_cal: d.sonarr_cal, radarr_cal: d.radarr_cal };
  };
  const postersOff = (cfg) => !!cfg && (cfg.posters === 'hide' || cfg.posters === false);

  // Bilde for en tittel: upcoming_media-data (samme kilde) → Plex media_player entity_picture → cache. Synkront.
  function art(h, title, source, cfg) {
    if (!h || postersOff(cfg)) return { poster: null, fanart: null };
    const S = srcIds(h, cfg), n = norm(title);
    let poster = null, fanart = null, via = '';
    const sid = S[source];
    if (sid && sid.startsWith('sensor.')) {
      const x = dataOf(h.states[sid]).find((r) => norm(r.title) === n);
      if (x) { poster = img(h, x.poster); fanart = img(h, x.fanart); if (poster || fanart) via = sid; }
    }
    if (!poster && source === 'plex') { // Plex-spillerens entity_picture (HA-proxy /api/media_player_proxy/… med token)
      const players = [S.plex, ...Object.keys(h.states).filter((id) => id.startsWith('media_player.') && (plat(h, id) === 'plex' || /plex/.test(id)))].filter((id, i, L) => id && id.startsWith('media_player.') && L.indexOf(id) === i);
      for (const id of players) {
        const a = (h.states[id] || {}).attributes || {};
        if ([a.media_series_title, a.media_title, a.media_album_name].some((t) => t && norm(t) === n)) { poster = img(h, a.entity_picture); if (poster) { via = id; break; } }
      }
    }
    if (!poster || !fanart) {
      const c = cached(title);
      if (c) { poster = poster || img(h, c.poster); fanart = fanart || img(h, c.fanart); if (!via && (poster || fanart)) via = 'cache'; }
    }
    if (poster || fanart) remember(title, { poster, fanart });
    dbg(source, title, via || 'plassholder', poster || '', fanart || '');
    return { poster, fanart };
  }

  /* ---------------------------------------------------------------- HA-tjeneste (sonarr/radarr med return_response) */
  const SVC = { sonarr: ['get_upcoming', 'get_calendar', 'get_series'], radarr: ['get_upcoming', 'get_calendar', 'get_movies'] };
  const svcMemo = new Map();
  function entryOf(h, dom) {
    const E = h.entities || {}, D = h.devices || {};
    for (const id in E) { const e = E[id]; if (e && e.platform === dom) { if (e.config_entry_id) return e.config_entry_id; const d = D[e.device_id]; if (d && d.config_entries && d.config_entries[0]) return d.config_entries[0]; } }
    return null;
  }
  // Leter gjennom svaret etter objekter med tittel + bilder (images[] med coverType/remoteUrl, eller { poster, fanart }).
  function harvest(h, resp) {
    const out = new Map();
    const pickImg = (imgs, type) => {
      if (Array.isArray(imgs)) { const i = imgs.find((x) => x && String(x.coverType || x.cover_type || '').toLowerCase() === type); return i ? img(h, i.remoteUrl || i.remote_url) : null; } // remoteUrl (TMDB/TVDB https), aldri lokal url
      if (imgs && typeof imgs === 'object') return img(h, imgs[type]);
      return null;
    };
    const walk = (o, d, title) => {
      if (!o || typeof o !== 'object' || d > 8) return;
      if (Array.isArray(o)) { o.forEach((x) => walk(x, d + 1, title)); return; }
      const t = o.title || o.series_title || o.seriesTitle || o.movie_title || (o.series && o.series.title) || title;
      const imgs = o.images || (o.series && o.series.images);
      if (t && imgs) { const p = pickImg(imgs, 'poster'), f = pickImg(imgs, 'fanart'); if (p || f) out.set(norm(t), { title: t, poster: p, fanart: f }); }
      Object.keys(o).forEach((k) => { if (o[k] && typeof o[k] === 'object' && k !== 'images') walk(o[k], d + 1, t); });
    };
    walk(resp, 0, null);
    return out;
  }
  function fetchArt(h, titles, source, cfg) {
    if (!h || postersOff(cfg) || !SVC[source]) return Promise.resolve(0);
    const want = (titles || []).filter((t) => t && !cached(t));
    if (!want.length) return Promise.resolve(0);
    const svcs = (h.services && h.services[source]) || {};
    const svc = SVC[source].find((s) => svcs[s]);
    if (!svc || typeof h.callWS !== 'function') return Promise.resolve(0);
    const m = svcMemo.get(source);
    if (m && (m.p || Date.now() - m.t < 600000)) return m.p || Promise.resolve(0); // maks ett kall per 10 min
    const entry = entryOf(h, source);
    const p = Promise.resolve(h.callWS({ type: 'call_service', domain: source, service: svc, service_data: entry ? { entry_id: entry } : {}, return_response: true }))
      .then((r) => { const got = harvest(h, r && (r.response || r)); got.forEach((v) => remember(v.title, v)); dbg('tjeneste', source + '.' + svc, got.size); return got.size; })
      .catch((e) => { dbg('tjeneste feilet', source + '.' + svc, e && e.message); return 0; })
      .finally(() => { svcMemo.set(source, { t: Date.now(), p: null }); });
    svcMemo.set(source, { t: Date.now(), p });
    return p;
  }

  /* ---------------------------------------------------------------- utgivelser */
  const SE_RX = /^(.*?)\s*[-–]\s*(S\d+E\d+|\d+x\d+)\s*(?:[-–]\s*(.*))?$/i;
  const fromRow = (x, source, id) => {
    const start = pDate(x.airdate || x.release_date || x.aired || x.date || x.added);
    const allDay = !x.airdate || !/T\d/.test(String(x.airdate));
    const sub = source === 'sonarr' ? [x.number, x.episode, x.studio || x.network].filter(Boolean).join(' · ')
      : source === 'radarr' ? [x.release ? String(x.release).replace(/\$\w+/g, '').trim() : '', 'film'].filter(Boolean).join(' · ') || 'Film'
        : [x.number || x.episode, 'Plex'].filter(Boolean).join(' · ');
    return { source, title: x.title, sub, start, allDay, poster: x.poster || null, fanart: x.fanart || null, entity: id };
  };
  const fromEvent = (e, source, id) => {
    const st = e.start && typeof e.start === 'object' ? e.start.dateTime || e.start.date : e.start;
    const allDay = /^\d{4}-\d\d-\d\d$/.test(String(st || ''));
    const start = allDay ? new Date(st + 'T00:00:00') : pDate(st);
    const sum = String(e.summary || e.message || '');
    const m = source === 'sonarr' ? SE_RX.exec(sum) : null;
    const rel = /\((cinema|digital|physical)[^)]*\)/i.exec(sum);
    const title = m ? m[1] : sum.replace(/\s*\((cinema|digital|physical)[^)]*\)\s*$/i, '');
    const sub = source === 'sonarr' ? [m && m[2].toUpperCase(), m && m[3], e.location].filter(Boolean).join(' · ') || 'Serie'
      : rel ? `${{ cinema: 'Kino', digital: 'Digital utgivelse', physical: 'Fysisk utgivelse' }[rel[1].toLowerCase()]} · film` : 'Film';
    return { source, title, sub, start, allDay, poster: null, fanart: null, entity: id };
  };
  const evMemo = new Map();
  function events(h, id, from, to) {
    const key = `${id}|${from.getTime()}|${to.getTime()}`, c = evMemo.get(key);
    if (c && Date.now() - c.t < 300000) return c.p;
    const q = `calendars/${id}?start=${encodeURIComponent(from.toISOString())}&end=${encodeURIComponent(to.toISOString())}`;
    const p = Promise.resolve(h.callApi ? h.callApi('GET', q) : []).then((r) => (Array.isArray(r) ? r : [])).catch(() => []);
    evMemo.set(key, { t: Date.now(), p });
    return p;
  }
  async function items(h, o) {
    o = o || {};
    if (!h || !h.states) return [];
    const now = new Date(), d0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const from = pDate(o.from) || d0, to = pDate(o.to) || new Date(d0.getTime() + 14 * DAY), cfg = o.cfg || {};
    const S = srcIds(h, cfg), out = [];
    for (const source of ['sonarr', 'radarr']) {
      const ids = [S[source], S[source + '_cal']].filter((x, i, a) => x && a.indexOf(x) === i);
      for (const id of ids) {
        if (id.startsWith('sensor.')) out.push(...dataOf(h.states[id]).map((x) => fromRow(x, source, id)));
        else if (id.startsWith('calendar.')) out.push(...(await events(h, id, from, to)).map((e) => fromEvent(e, source, id)));
      }
    }
    if (S.plex && S.plex.startsWith('sensor.')) out.push(...dataOf(h.states[S.plex]).map((x) => fromRow(x, 'plex', S.plex)));
    // samme utgivelse fra sensor og kalender → én (sensoren har bildene)
    const seen = new Map();
    out.forEach((x) => {
      if (!x.title || !x.start) return;
      const k = `${x.source}|${norm(x.title)}|${x.start.toDateString()}`, cur = seen.get(k);
      if (!cur || (!cur.poster && x.poster)) seen.set(k, cur ? { ...x, sub: cur.sub && cur.sub.length > x.sub.length ? cur.sub : x.sub } : x);
    });
    let L = [...seen.values()].filter((x) => x.start >= from && x.start < to).sort((a, b) => a.start - b.start);
    const off = postersOff(cfg);
    const fill = () => L.forEach((x) => {
      if (off) { x.poster = null; x.fanart = null; return; }
      let p = img(h, x.poster), f = img(h, x.fanart);
      if (p || f) remember(x.title, { poster: p, fanart: f });
      if (!p || !f) { const a = art(h, x.title, x.source, cfg); p = p || a.poster; f = f || a.fanart; }
      x.poster = p; x.fanart = f;
    });
    fill();
    if (!off) {
      const miss = (s) => L.filter((x) => x.source === s && !x.poster).map((x) => x.title);
      const n = (await Promise.all(['sonarr', 'radarr'].map((s) => (miss(s).length ? fetchArt(h, miss(s), s, cfg) : 0)))).reduce((a, b) => a + b, 0);
      if (n) fill();
    }
    L = L.map((x) => ({ ...x, time: x.allDay ? '' : hm(x.start) }));
    return L;
  }

  /* ---------------------------------------------------------------- rendering */
  const hue = (t) => { let s = 0; const n = norm(t); for (let i = 0; i < n.length; i++) s = (s * 31 + n.charCodeAt(i)) >>> 0; return s % 360; };
  const escA = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  function imgHTML(url, o) {
    o = o || {};
    const ic = o.icon ? `<span class="ki-arr-ic">${M.icon ? M.icon(o.icon, o.iconSize || 20) : ''}</span>` : '';
    return `<span class="ki-arr-img ${url ? 'has' : 'ph'} ${o.cls || ''}" style="--arr-h:${hue(o.title || '')}" ${o.attrs || ''}>${ic}${url ? `<img src="${escA(url)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : ''}</span>`;
  }
  // onload → vis, onerror → plassholderen blir stående (og URL-en huskes som feilet). Kalles etter hver tegning.
  function bind(root) {
    if (!root) return;
    if (!root.__kiArr) {
      root.__kiArr = true;
      root.addEventListener('load', (e) => { const t = e.target; if (t && t.tagName === 'IMG' && t.parentNode && t.parentNode.classList && t.parentNode.classList.contains('ki-arr-img')) t.classList.add('ok'); }, true);
      root.addEventListener('error', (e) => {
        const t = e.target;
        if (!t || t.tagName !== 'IMG' || !t.parentNode || !t.parentNode.classList || !t.parentNode.classList.contains('ki-arr-img')) return;
        failed.add(t.getAttribute('src')); dbg('lasting feilet', t.getAttribute('src'));
        t.classList.remove('ok'); t.parentNode.classList.add('err');
      }, true);
    }
    root.querySelectorAll('.ki-arr-img>img').forEach((t) => {
      if (t.complete && t.naturalWidth > 0) t.classList.add('ok');
      else if (t.complete && failed.has(t.getAttribute('src'))) t.parentNode.classList.add('err');
    });
  }
  const CSS = `
    .ki-arr-img{position:relative;display:grid;place-items:center;overflow:hidden;flex:none;color:rgb(255 255 255 / .45);background:repeating-linear-gradient(135deg,oklch(var(--arr-l1,.42) .04 var(--arr-h,250)) 0 6px,oklch(var(--arr-l2,.37) .04 var(--arr-h,250)) 6px 12px)}
    .ki-arr-img>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;opacity:0;transition:opacity .25s ease}
    .ki-arr-img>img.ok{opacity:1}
    .ki-arr-img.err>img{display:none}
    .ki-arr-ic{position:relative;display:grid;place-items:center}
  `;

  M.arrMedia = { items, art, fetchArt, img, detect, cached, remember, hue, imgHTML, bind, CSS, norm, _failed: failed };
})();
