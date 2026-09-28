/* KI MSH · Kalender (#kalender, msh-kalender-card) – fiks 23.8, etter «Kalender v2.dc.html».
 * Étt kort i Bubble-popupen #kalender (mal A). Erstatter den importerte #kalender-popupen fra 15.5 (ki-tabs-card,
 * ki-hytte-card, ki-lansering-card, ki-kalender-card, ki-post-card, ki-bursdag-pro-card): strategien genererer
 * #kalender, kildene fra de gamle kortene migreres til `src`/`calendars` (MSH.kalenderExtra), og den importerte
 * popupen vises som «Erstattet av Kalender» i Egne popups (MSH.POPUP_SUPERSEDE → 04-strategy/28-popup-editor).
 *
 * Topp: fane-pille (Kalender · Hytta · Framover · Bursdager · Posten, MSH.iconTabs, Liquid Glass-drag) + 48×48
 *   modusknapp med to ikoner på en loddrett skinne: trykk = Liste/Måned (Kalender/Framover), hold 480 ms = «Vis
 *   kalendere» (portalt), sveip opp/ned > 16 px = vipp til tannhjul (trykk → «Tilpass kalender»). To prikker = modus.
 * Faner og deler (section_order/section_hidden per fane, tab_order/tab_hidden):
 *   kalender: main · hytta: sok, steder, seg · framover: filter, hero, kommende, plex · bursdager: hero, kommende ·
 *   posten: posten, pakker
 * Config:
 *   src: { hytta, bday, post, parcel, sonarr, radarr, plex }   # overstyring (tom = automatisk)
 *   calendars: [{ entity, name?, color? }]  # tom = alle calendar.* som ikke er kilder
 *   calendars_hidden: [id …] · calendar_colors: { id: farge }
 *   startTab · defaultView (liste|maned) · days (7|14|30) · showPlex · birthdayToday · tab_labels (icon|name)
 *   gap · pad_top · pad_bottom  (Mellomrom; `spacing: { gap, top, bottom }` leses også)
 * Data (fallgruve 8): hentes når #kalender er åpen, mellomlagres 5 min. Kalendere via
 *   hass.callApi('GET', 'calendars/<id>?start&end') (samme som calendar.get_events), ±40 dager.
 * Ingen mock-data: mangler en kilde → «– · Velg entitet».
 */
(function () {
  const M = window.MSH;
  if (!M || customElements.get('msh-kalender-card')) return;
  const esc = M.esc, C = M.C;
  const HASH = '#kalender';
  const TTL = 300000, DAY = 86400000;
  const TABS = [['kalender', 'Kalender', 'mdi:calendar-month'], ['hytta', 'Hytta', 'mdi:home-roof'], ['framover', 'Framover', 'mdi:movie'], ['bursdager', 'Bursdager', 'mdi:cake-variant'], ['posten', 'Posten', 'mdi:email']];
  const TABL = Object.fromEntries(TABS.map((t) => [t[0], t]));
  const PARTS = {
    kalender: [['main', 'Kalender']],
    hytta: [['sok', 'Søk'], ['steder', 'Steder'], ['seg', 'Kalender/Opphold/Statistikk']],
    framover: [['filter', 'Filter'], ['hero', 'Neste utgivelse'], ['kommende', 'Kommende'], ['plex', 'Nylig i Plex']],
    bursdager: [['hero', 'Neste bursdag'], ['kommende', 'Kommende']],
    posten: [['posten', 'Når kommer Posten'], ['pakker', 'Pakker']],
  };
  const SRC = [
    ['hytta', 'Hyttebesøk', 'mdi:home-roof', C.green],
    ['bday', 'Bursdager', 'mdi:cake-variant', C.purple],
    ['post', 'Når kommer Posten', 'mdi:email', C.red],
    ['parcel', 'Pakkesporing', 'mdi:package-variant', C.orange],
    ['sonarr', 'Sonarr', 'mdi:television-classic', C.blue],
    ['radarr', 'Radarr', 'mdi:filmstrip', C.yellow],
    ['plex', 'Plex', 'mdi:plex', C.orange],
  ];
  const PAL = [C.blue, C.green, C.orange, C.purple, C.yellow, C.pink, C.red, C.lime, C.lightBlue];
  const MND = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des'];
  const MND_L = ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember'];
  const DAG_L = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag'];
  const UKE = ['ma', 'ti', 'on', 'to', 'fr', 'lø', 'sø'];
  const DEF = { days: 14, defaultView: 'liste', showPlex: true, birthdayToday: true, tab_labels: 'icon' };

  /* ------------------------------------------------------------ dato-hjelpere */
  const d0 = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const addD = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const dk = (d) => `${d.getFullYear()}-${M.pad(d.getMonth() + 1)}-${M.pad(d.getDate())}`;
  const fromKey = (s) => { const m = /^(\d{4})-(\d\d)-(\d\d)/.exec(String(s || '')); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
  const pDate = (v) => { if (v == null || v === '') return null; if (v instanceof Date) return v; const s = String(v); if (/^\d{4}-\d\d-\d\d$/.test(s)) return fromKey(s); const d = new Date(s); return isNaN(d) ? null : d; };
  const dayDiff = (a, b) => Math.round((d0(b) - d0(a)) / DAY);
  const hm = (d) => `${M.pad(d.getHours())}:${M.pad(d.getMinutes())}`;
  const weekNo = (dato) => { const d = d0(dato); d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7)); const f = new Date(d.getFullYear(), 0, 4); return 1 + Math.round(((d - f) / DAY - 3 + ((f.getDay() + 6) % 7)) / 7); };
  const dShort = (d) => `${d.getDate()}. ${MND[d.getMonth()]}`;
  const dayLabel = (d) => { const n = dayDiff(new Date(), d); const b = `${DAG_L[d.getDay()]} ${dShort(d)}`; return n === 0 ? 'I dag · ' + b : n === 1 ? 'I morgen · ' + b : n === -1 ? 'I går · ' + b : b[0].toUpperCase() + b.slice(1); };
  const relDays = (n) => (n === 0 ? 'i dag' : n === 1 ? 'i morgen' : n < 0 ? `for ${-n} dager siden` : `om ${n} dager`);
  const ini = (n) => String(n || '?').trim().split(/\s+/).map((x) => x[0]).slice(0, 2).join('').toUpperCase();
  const uniq = (a) => [...new Set(a.filter(Boolean))];
  // Uke mandag først: rutenett for måneden (hele uker)
  function monthGrid(y, m) {
    const first = new Date(y, m, 1), start = addD(first, -((first.getDay() + 6) % 7));
    const weeks = [];
    for (let w = 0; w < 6; w++) {
      const days = Array.from({ length: 7 }, (_, i) => addD(start, w * 7 + i));
      if (w > 3 && days[0].getMonth() !== m) break;
      weeks.push(days);
    }
    return weeks;
  }
  // Søket i Hytta: «12.7» · «12.7.2026» · «2026-07-12» · «4. juli» · «uke 27» · «i går» · «i dag» · «juli»
  function parseQuery(q) {
    const s = String(q || '').trim().toLowerCase();
    if (!s) return null;
    const now = d0(new Date()), y = now.getFullYear();
    const one = (d, label) => ({ s: d, e: d, label });
    if (s === 'i dag') return one(now, 'I dag');
    if (s === 'i går' || s === 'i gar') return one(addD(now, -1), 'I går');
    if (s === 'i morgen') return one(addD(now, 1), 'I morgen');
    let m = /^uke\s*(\d{1,2})(?:\s+(\d{4}))?$/.exec(s);
    if (m) { const yy = m[2] ? +m[2] : y, j4 = new Date(yy, 0, 4), mon = addD(j4, -((j4.getDay() + 6) % 7) + (+m[1] - 1) * 7); return { s: mon, e: addD(mon, 6), label: 'Uke ' + m[1] }; }
    m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(s);
    if (m) return one(new Date(+m[1], +m[2] - 1, +m[3]), s);
    m = /^(\d{1,2})\.(\d{1,2})\.?(\d{4})?$/.exec(s);
    if (m) { const d = new Date(m[3] ? +m[3] : y, +m[2] - 1, +m[1]); return one(d, dShort(d)); }
    m = /^(\d{1,2})\.?\s+([a-zæøå]+)(?:\s+(\d{4}))?$/.exec(s);
    if (m) { const i = MND_L.findIndex((x) => x.startsWith(m[2].slice(0, 3))); if (i >= 0) { const d = new Date(m[3] ? +m[3] : y, i, +m[1]); return one(d, dShort(d)); } }
    m = /^([a-zæøå]+)(?:\s+(\d{4}))?$/.exec(s);
    if (m && m[1].length >= 3) { const i = MND_L.findIndex((x) => x.startsWith(m[1].slice(0, 3))); if (i >= 0) { const yy = m[2] ? +m[2] : y; return { s: new Date(yy, i, 1), e: new Date(yy, i + 1, 0), label: MND_L[i][0].toUpperCase() + MND_L[i].slice(1) }; } }
    return null;
  }

  /* ------------------------------------------------------------ kilder (autokonfig) */
  const low = (h, id) => (id + ' ' + String(((h.states[id] || {}).attributes || {}).friendly_name || '')).toLowerCase();
  const plat = (h, id) => ((h.entities || {})[id] || {}).platform || '';
  function cands(h, k) {
    if (!h) return [];
    const ids = Object.keys(h.states).sort();
    const dom = (d) => ids.filter((id) => id.startsWith(d + '.'));
    const A = (id) => (h.states[id] || {}).attributes || {};
    if (k === 'hytta') return uniq([...dom('sensor').filter((id) => A(id).integrasjon === 'ki_hyttebesok' && A(id).ki_type === 'oversikt'), ...dom('calendar').filter((id) => /hytt/.test(low(h, id))), ...dom('sensor').filter((id) => /_oversikt$/.test(id) && A(id).sted)]);
    if (k === 'bday') return dom('calendar').filter((id) => /birthday|bursdag|fodsel|fødsel/.test(low(h, id)));
    if (k === 'post') return dom('sensor').filter((id) => /nar_kommer_posten|posten|postal|mail_delivery/.test(id) && !/relati/.test(id)).sort((a, b) => (pDate((h.states[b] || {}).state) ? 1 : 0) - (pDate((h.states[a] || {}).state) ? 1 : 0) || (/_next$/.test(b) ? 1 : 0) - (/_next$/.test(a) ? 1 : 0));
    if (k === 'parcel') return uniq([...dom('sensor').filter((id) => plat(h, id) === 'norwegian_parcel_tracker'), ...dom('sensor').filter((id) => /parcel|pakke|sporing/.test(id))]);
    if (k === 'sonarr') return [...dom('calendar').filter((id) => /sonarr/.test(low(h, id))), ...dom('sensor').filter((id) => /sonarr/.test(id) && /upcoming|kommende|calendar/.test(id))];
    if (k === 'radarr') return [...dom('calendar').filter((id) => /radarr/.test(low(h, id))), ...dom('sensor').filter((id) => /radarr/.test(id) && /upcoming|kommende|calendar/.test(id))];
    if (k === 'plex') return dom('sensor').filter((id) => /plex/.test(id) && /recent|nylig|added/.test(id));
    return [];
  }
  const autoSrc = (h, k) => cands(h, k)[0] || null;
  const srcOf = (h, c, k) => { const v = (c.src || {})[k]; if (v === 'none') return null; return v || autoSrc(h, k); };
  M.kalenderSources = (h, c) => Object.fromEntries(SRC.map(([k]) => [k, srcOf(h, c || {}, k)]));

  function calsOf(h, c) {
    const srcIds = new Set(['sonarr', 'radarr', 'hytta', 'bday'].map((k) => srcOf(h, c, k)).filter((id) => id && id.startsWith('calendar.')));
    const L = Array.isArray(c.calendars) && c.calendars.length ? c.calendars.map((x) => (typeof x === 'string' ? { entity: x } : x)).filter((x) => x && x.entity)
      : M.all(h, 'calendar').filter((id) => !srcIds.has(id)).map((entity) => ({ entity }));
    const hid = new Set(c.calendars_hidden || []), col = c.calendar_colors || {};
    return L.map((x, i) => ({ id: x.entity, name: x.name || M.name(h, x.entity), color: M.color(col[x.entity] || x.color, PAL[i % PAL.length]), hidden: hid.has(x.entity), exists: !!(h && h.states[x.entity]) }));
  }
  M.kalenderCalendars = calsOf;

  /* ------------------------------------------------------------ gammel config (fiks 15.5-importen) */
  const OLD_RX = /custom:ki-(tabs|hytte|lansering|kalender|post|bursdag-pro)-card/;
  const cfgOf = (e) => { try { return M.customPopupConfig ? M.customPopupConfig(e).cfg : e; } catch (x) { return null; } };
  function legacyOf(cfg) {
    if (!cfg || typeof cfg !== 'object') return null;
    const h = String(cfg.hash || '').trim().replace(/^#?/, '#');
    if (h !== HASH) return null;
    let js = ''; try { js = JSON.stringify(cfg); } catch (e) { return null; }
    if (!OLD_RX.test(js)) return null;
    const src = {}; let calendars = null;
    const walk = (o, d) => {
      if (!o || typeof o !== 'object' || d > 30) return;
      if (Array.isArray(o)) { o.forEach((x) => walk(x, d + 1)); return; }
      const t = String(o.type || '');
      if (t === 'custom:ki-lansering-card') { if (o.serier) src.sonarr = src.sonarr || o.serier; if (o.filmer) src.radarr = src.radarr || o.filmer; if (o.bursdag && o.bursdag.kalender) src.bday = src.bday || o.bursdag.kalender; }
      if (t === 'custom:ki-post-card' && o.entity) src.post = src.post || o.entity;
      if (t === 'custom:ki-bursdag-pro-card' && o.kalender) src.bday = src.bday || o.kalender;
      if (t === 'custom:ki-hytte-card' && o.oversikt) src.hytta = src.hytta || o.oversikt;
      if (t === 'custom:ki-kalender-card' && Array.isArray(o.kalendere) && !calendars) calendars = o.kalendere.filter((x) => x && x.entity).map((x) => ({ entity: x.entity, ...(x.navn ? { name: x.navn } : {}), ...(x.farge ? { color: x.farge } : {}) }));
      Object.keys(o).forEach((k) => { if (o[k] && typeof o[k] === 'object') walk(o[k], d + 1); });
    };
    walk(cfg, 0);
    Object.keys(src).forEach((k) => { if (typeof src[k] !== 'string' || !/^[a-z_]+\./.test(src[k])) delete src[k]; });
    return { src, calendars };
  }
  // Kildene fra den gamle importerte popupen (ki-store custom_popups + strategiens custom_popups) → { src, calendars }
  M.kalenderExtra = function (config) {
    const lists = [(M.store && (M.store.get('custom_popups') || [])) || [], (config && config.custom_popups) || []];
    for (const L of lists) for (const e of (Array.isArray(L) ? L : [])) {
      const r = legacyOf(cfgOf(e));
      if (r && (Object.keys(r.src).length || r.calendars)) return { ...(Object.keys(r.src).length ? { src: r.src } : {}), ...(r.calendars && r.calendars.length ? { calendars: r.calendars } : {}) };
    }
    return undefined;
  };
  M.kalenderLegacy = (config) => { const lists = [(M.store && (M.store.get('custom_popups') || [])) || [], (config && config.custom_popups) || []]; return lists.some((L) => (Array.isArray(L) ? L : []).some((e) => !!legacyOf(cfgOf(e)))); };
  // Generert popup som erstatter en egen/importert med samme hash (04-strategy: auto vinner, «Erstattet av Kalender»)
  M.POPUP_SUPERSEDE = M.POPUP_SUPERSEDE || {};
  M.POPUP_SUPERSEDE[HASH] = { name: 'Kalender', test: (cfg) => !!legacyOf(cfg) };

  /* ------------------------------------------------------------ hendelser (mellomlager 5 min) */
  const EV = new Map();
  function normEv(e, cal) {
    const st = e.start && typeof e.start === 'object' ? e.start.dateTime || e.start.date : e.start;
    const en = e.end && typeof e.end === 'object' ? e.end.dateTime || e.end.date : e.end;
    const allDay = /^\d{4}-\d\d-\d\d$/.test(String(st || ''));
    const s = pDate(st); let t = pDate(en) || s;
    if (!s) return null;
    if (allDay && t > s) t = addD(t, -1); // slutt-datoen er eksklusiv
    return { cal, summary: e.summary || e.message || '(uten tittel)', start: s, end: t, allDay, location: e.location || '', description: e.description || '', uid: e.uid || '' };
  }
  function evFetch(hass, id, s, e, done) {
    const key = `${id}|${dk(s)}|${dk(e)}`;
    const cur = EV.get(key);
    if (cur && (cur.busy || Date.now() - cur.t < TTL)) return cur.list;
    EV.set(key, { busy: true, t: cur ? cur.t : 0, list: cur ? cur.list : null });
    const q = `calendars/${id}?start=${encodeURIComponent(s.toISOString())}&end=${encodeURIComponent(e.toISOString())}`;
    const p = hass.callApi ? hass.callApi('GET', q) : Promise.resolve([]);
    Promise.resolve(p).then((r) => (Array.isArray(r) ? r : []).map((x) => normEv(x, id)).filter(Boolean)).catch(() => [])
      .then((list) => { EV.set(key, { busy: false, t: Date.now(), list }); done && done(); });
    return cur ? cur.list : null;
  }
  M.kalenderForget = () => EV.clear();

  /* ------------------------------------------------------------ media (Sonarr/Radarr/Plex) */
  const SE_RX = /^(.*?)\s*[-–]\s*(S\d+E\d+|\d+x\d+)\s*(?:[-–]\s*(.*))?$/i;
  function upcomingData(st) {
    let d = st && st.attributes && st.attributes.data;
    if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { d = null; } }
    return Array.isArray(d) ? d.filter((x) => x && x.title && !x.title_default) : [];
  }
  function mediaFromSensor(h, id, kind) {
    return upcomingData(h.states[id]).map((x) => {
      const date = pDate(x.airdate || x.release_date || x.aired || x.date);
      return { kind, title: x.title, ep: x.number || '', epTitle: x.episode || '', network: x.studio || x.network || '', date, allDay: !x.airdate || !/T\d/.test(String(x.airdate)), poster: x.poster || '', fanart: x.fanart || '', desc: x.summary || x.overview || '', rating: x.rating || '', runtime: x.runtime || '', genres: x.genres || '', src: id, url: x.deep_link || x.url || '' };
    }).filter((x) => x.title);
  }
  function mediaFromEvents(list, id, kind) {
    return (list || []).map((e) => {
      const m = kind === 'serie' ? SE_RX.exec(e.summary) : null;
      return { kind, title: m ? m[1] : e.summary.replace(/\s*\((cinema|digital|physical)[^)]*\)\s*$/i, ''), ep: m ? m[2].toUpperCase() : '', epTitle: m ? m[3] || '' : '', network: e.location || '', date: e.start, allDay: e.allDay, poster: '', fanart: '', desc: e.description, src: id, url: '' };
    });
  }

  /* ------------------------------------------------------------ Hytta */
  const MOTIF = (sted, rolle, i) => {
    const n = String(sted || '').toLowerCase();
    if (/ström|strom|kyst|sjø|sjo|hav|strand/.test(n)) return { color: C.blue, motif: 'kyst' };
    if (/toten|gård|gard|land|åker|aker|fjell/.test(n)) return { color: C.yellow, motif: 'land' };
    if (/oslo|hjem|by/.test(n) || rolle === 'hjem') return { color: C.green, motif: 'hus' };
    return { color: [C.orange, C.purple, C.pink, C.lime][i % 4], motif: 'hus' };
  };
  const ILLU = {
    hus: '<svg viewBox="0 0 120 72" aria-hidden="true"><path d="M8 66h104" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity=".5"/><path d="M30 66V38l30-22 30 22v28z" fill="currentColor" fill-opacity=".22" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M52 66V48h16v18" stroke="currentColor" stroke-width="3" fill="none"/><path d="M74 26V14h8v18" stroke="currentColor" stroke-width="3" fill="none"/></svg>',
    kyst: '<svg viewBox="0 0 120 72" aria-hidden="true"><path d="M6 58c10-6 18-6 28 0s18 6 28 0 18-6 28 0 18 6 24 2" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M6 68c10-6 18-6 28 0s18 6 28 0 18-6 28 0 18 6 24 2" stroke="currentColor" stroke-width="3" fill="none" opacity=".5" stroke-linecap="round"/><path d="M58 48V28l20-14 20 14v20z" fill="currentColor" fill-opacity=".22" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><circle cx="26" cy="20" r="8" fill="currentColor" fill-opacity=".35"/></svg>',
    land: '<svg viewBox="0 0 120 72" aria-hidden="true"><path d="M4 50c30-10 70-10 112 0v18H4z" fill="currentColor" fill-opacity=".18"/><path d="M4 58h112M14 64h92" stroke="currentColor" stroke-width="2" opacity=".5"/><path d="M68 50V30l16-12 16 12v20z" fill="currentColor" fill-opacity=".25" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M78 50V40h12v10" stroke="currentColor" stroke-width="2.5" fill="none"/><path d="M26 50V30M20 36l6-8 6 8" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round"/></svg>',
  };
  function hyttaData(h, c, evs) {
    const id = srcOf(h, c, 'hytta');
    if (!id) return []; // src.hytta: 'none' (eller ingenting funnet)
    const sensors = cands(h, 'hytta').filter((x) => x.startsWith('sensor.') && h.states[x]);
    if (id && id.startsWith('sensor.') && !sensors.includes(id) && h.states[id]) sensors.unshift(id);
    const yr = new Date().getFullYear(), today = d0(new Date());
    const steder = sensors.map((sid, i) => {
      const a = h.states[sid].attributes || {};
      const sted = a.sted || M.name(h, sid).replace(/\s*oversikt$/i, '');
      const mo = MOTIF(sted, a.rolle, i);
      const stay = (o, planned) => { const s = pDate(o.start), e = pDate(o.slutt || o.end) || s; return s ? { person: o.person || 'Ukjent', start: d0(s), end: d0(e), nights: Number(o.netter) || Math.max(1, dayDiff(s, e)), planned, sted, color: mo.color, id: sid } : null; };
      const opphold = [...(a.opphold || []).map((o) => stay(o, false)), ...(a.kommende || []).map((o) => stay(o, true))].filter(Boolean);
      (a.her_naa || []).forEach((p) => { const s = pDate(p.siden) || today; if (!opphold.some((o) => o.person === p.navn && o.start <= today && o.end >= today)) opphold.push({ person: p.navn, start: d0(s), end: today, nights: Math.max(0, dayDiff(s, today)), planned: false, ongoing: true, sted, color: mo.color, id: sid }); });
      opphold.forEach((o) => { if (!o.planned && o.start <= today && o.end >= today) o.ongoing = true; });
      const thisYr = opphold.filter((o) => !o.planned && o.start.getFullYear() === yr);
      const nights = a.netter_i_aar != null ? Number(a.netter_i_aar) : thisYr.reduce((s, o) => s + o.nights, 0);
      const visits = a.besok_i_aar != null ? Number(a.besok_i_aar) : thisYr.length;
      const persons = (a.personer || []).map((p) => ({ name: p.navn || p, color: p.farge || null, here: !!p.her }));
      const here = (a.her_naa || []).map((p) => p.navn);
      return { id: sid, sted, rolle: a.rolle || '', ...mo, nights, visits, persons, here, opphold };
    });
    // Reserve: bare kalender (calendar.hyttebesok): sted = hendelsens sted, person = tittelen
    if (!steder.length && id && id.startsWith('calendar.')) {
      const by = {};
      (evs || []).forEach((e) => { const st = e.location || M.name(h, id); (by[st] = by[st] || []).push(e); });
      Object.keys(by).forEach((st, i) => {
        const mo = MOTIF(st, '', i);
        const opphold = by[st].map((e) => ({ person: e.summary, start: d0(e.start), end: d0(e.end), nights: Math.max(1, dayDiff(e.start, e.end)), planned: d0(e.start) > today, ongoing: d0(e.start) <= today && d0(e.end) >= today, sted: st, color: mo.color, id }));
        const yrs = opphold.filter((o) => !o.planned && o.start.getFullYear() === yr);
        steder.push({ id, sted: st, rolle: '', ...mo, nights: yrs.reduce((s, o) => s + o.nights, 0), visits: yrs.length, persons: uniq(opphold.map((o) => o.person)).map((name) => ({ name, here: opphold.some((o) => o.ongoing && o.person === name) })), here: opphold.filter((o) => o.ongoing).map((o) => o.person), opphold });
      });
    }
    return steder;
  }

  /* ------------------------------------------------------------ Posten og pakker */
  function postData(h, id) {
    const st = id && h.states[id];
    if (!st) return null;
    const a = st.attributes || {};
    const next = pDate(st.state) || pDate(a.next_delivery || a.neste);
    const list = [a.delivery_dates, a.next_delivery_dates, a.dates, a.upcoming, a.leveringsdager].find(Array.isArray) || [];
    const dates = uniq([...list.map((x) => { const d = pDate(x); return d ? dk(d0(d)) : null; }), next ? dk(d0(next)) : null]);
    const relId = id + '_relative', rel = (h.states[relId] && h.states[relId].state) || a.relative || '';
    return { next: next ? d0(next) : null, dates: new Set(dates), rel };
  }
  function parcelsOf(h, c) {
    const pid = srcOf(h, c, 'parcel');
    const ids = Object.keys(h.states).filter((id) => id.startsWith('sensor.') && (plat(h, id) === 'norwegian_parcel_tracker' || (h.states[id].attributes || {}).tracking_number) && (/_status$/.test(id) || (h.states[id].attributes || {}).tracking_number));
    if (pid && h.states[pid] && !ids.includes(pid) && (h.states[pid].attributes || {}).tracking_number) ids.push(pid);
    return uniq(ids).map((id) => {
      const st = h.states[id], a = st.attributes || {};
      const s = String(st.state || '').toLowerCase();
      const events = (Array.isArray(a.events) ? a.events : Array.isArray(a.hendelser) ? a.hendelser : []).map((e) => ({ t: pDate(e.time || e.timestamp || e.tid), text: e.description || e.text || e.beskrivelse || '', where: e.location || e.sted || '' })).filter((e) => e.text).sort((x, y) => (y.t || 0) - (x.t || 0));
      const last = events[0] && events[0].t ? events[0].t : pDate(a.last_update || a.sist_oppdatert) || null;
      const idleH = last ? Math.floor((Date.now() - last.getTime()) / 3600000) : null;
      const levert = /levert|delivered|utlevert/.test(s) && !/ikke levert|not delivered/.test(s);
      const klar = !levert && /hentes|ready|klar|pickup|utleveringssted|hentested/.test(s);
      const stale = !levert && !klar && (!!a.stale || !!a.stuck || (idleH != null && idleH >= 48));
      const kind = levert ? 'levert' : klar ? 'klar' : stale ? 'stale' : 'transport';
      return { id, name: (a.friendly_name || id.slice(7)).replace(/\s*status\s*$/i, '').trim() || 'Pakke', state: st.state, kind, events, idleH, number: a.tracking_number || '',
        facts: [['Hentested', a.pickup_point || a.hentested], ['Metode', a.delivery_method || a.metode], ['Avsender', a.sender || a.avsender], ['Vekt', a.weight != null ? a.weight + (typeof a.weight === 'number' ? ' kg' : '') : a.vekt]].filter((f) => f[1]),
        eta: pDate(a.estimated_delivery || a.forventet_levering), home: a.home_delivery_url || (a.home_delivery_available ? a.tracking_url || '' : '') || '' };
    }).sort((a, b) => ['klar', 'stale', 'transport', 'levert'].indexOf(a.kind) - ['klar', 'stale', 'transport', 'levert'].indexOf(b.kind));
  }
  const PK = { klar: ['Klar til henting', C.green, 'mdi:package-variant-closed-check'], transport: ['På vei', C.blue, 'mdi:truck-delivery'], stale: ['Ingen oppdatering', C.orange, 'mdi:clock-alert-outline'], levert: ['Levert', 'var(--gray600, #7f7f7f)', 'mdi:package-check'] };

  /* ------------------------------------------------------------ Bursdager */
  const BD_STRIP = /\s*(\(\d{4}\)|'s birthday|s bursdag|bursdag|birthday|fødselsdag)\s*/gi;
  function bdays(h, c, evs) {
    const today = d0(new Date());
    const out = [];
    (evs || []).forEach((e) => {
      const yM = /\((\d{4})\)/.exec(e.summary) || /(?:f\.|født|born)\s*(\d{4})/i.exec(e.description) || /(\d{4})-\d\d-\d\d/.exec(e.description);
      const name = e.summary.replace(BD_STRIP, ' ').replace(/\s+/g, ' ').trim() || e.summary;
      const date = d0(e.start);
      if (date < today) return;
      if (out.some((b) => b.name === name && dk(b.date) === dk(date))) return;
      out.push({ name, date, born: yM ? +yM[1] : null });
    });
    const S = (M.store && M.store.get('kalender.bursdager')) || [];
    (Array.isArray(S) ? S : []).forEach((b) => {
      const bd = fromKey(b.date); if (!bd || !b.name) return;
      let nx = new Date(today.getFullYear(), bd.getMonth(), bd.getDate()); if (nx < today) nx = new Date(today.getFullYear() + 1, bd.getMonth(), bd.getDate());
      if (!out.some((x) => x.name === b.name && dk(x.date) === dk(nx))) out.push({ name: b.name, date: nx, born: bd.getFullYear() > 1900 ? bd.getFullYear() : null, store: true });
    });
    return out.map((b) => ({ ...b, age: b.born ? b.date.getFullYear() - b.born : null, days: dayDiff(today, b.date) })).sort((a, b) => a.date - b.date);
  }

  /* ============================================================ editoren (Tilpass kalender + GUI) */
  const EXP = new Map(); // utvidet fane i Faner (card_id → fane)
  const OPEN = new Map(); // åpen kilde i Kilder (card_id → kilde)
  const Q = new Map(); // søketekst i Kilder (card_id|kilde → tekst)
  const ADDCAL = new Set(); // «Legg til kalender»-listen er åpen (card_id)
  const tabOrder = (c) => { const k = TABS.map((t) => t[0]); const o = (Array.isArray(c.tab_order) ? c.tab_order : []).filter((x) => k.includes(x)); k.forEach((x) => { if (!o.includes(x)) o.push(x); }); return o; };
  const tabHidden = (c) => { const h = c.tab_hidden; return new Set(Array.isArray(h) ? h : h && typeof h === 'object' ? Object.keys(h).filter((k) => h[k]) : []); };
  const partOrder = (c, t) => { const k = PARTS[t].map((p) => p[0]); const o = (((c.section_order || {})[t]) || []).filter((x) => k.includes(x)); k.forEach((x) => { if (!o.includes(x)) o.push(x); }); return o; };
  const partHidden = (c, t) => new Set(((c.section_hidden || {})[t]) || []);
  const visTabs = (c) => { const hid = tabHidden(c); const o = tabOrder(c).filter((k) => !hid.has(k)); return o.length ? o : ['kalender']; };
  const hdl = (list) => `<span class="kdrag" data-edrag="${esc(list)}" title="Dra for rekkefølge" style="touch-action:none;cursor:grab;display:inline-flex;color:#979797;padding:8px 2px">${M.icon('mdi:drag', 20)}</span>`;
  const eyeB = (key, op, t, v, hid, label) => `<button class="ib" data-a="fn" data-k="${key}" data-op="${op}" data-t="${esc(t || '')}" data-v="${esc(v || '')}" aria-label="${hid ? 'Vis' : 'Skjul'} ${esc(label)}" style="width:40px;height:40px;border-radius:20px;display:grid;place-items:center;flex:none">${M.icon(hid ? 'mdi:eye-off-outline' : 'mdi:eye-outline', 20, `color:${hid ? '#696969' : '#fafafa'}`)}</button>`;
  const BADGE = { auto: ['Auto', C.green, '#12291d'], over: ['Overstyrt', C.pink, '#2a1720'], none: ['Mangler', C.orange, '#2c1d0c'] };
  const badge = (k) => { const [t, bg, fg] = BADGE[k]; return `<span style="flex:none;height:22px;padding:0 9px;border-radius:11px;display:inline-flex;align-items:center;font-size:11px;font-weight:600;color:${fg};background:${bg}">${t}</span>`; };
  const cid = (ed) => ((ed && ed._config && ed._config.card_id) || '_');

  // Dra-håndtak (touch-action none + stopPropagation, fallgruve 2) og søkefeltet i Kilder. Én gang per editor.
  function installEd(ed) {
    if (!ed || ed.__kalInst || !ed.shadowRoot) return;
    ed.__kalInst = true;
    const R = ed.shadowRoot;
    let d = null;
    const stop = (e) => { if (e.target.closest && e.target.closest('[data-edrag]')) e.stopPropagation(); };
    R.addEventListener('touchstart', stop, { passive: true });
    R.addEventListener('touchmove', stop, { passive: true });
    R.addEventListener('input', (e) => { const t = e.target; if (!t.dataset || t.dataset.ksq == null) return; e.stopPropagation(); Q.set(cid(ed) + '|' + t.dataset.ksq, t.value); ed._render(); }, true);
    R.addEventListener('pointerdown', (e) => {
      const hd = e.target.closest && e.target.closest('[data-edrag]');
      if (!hd || e.button) return;
      const item = hd.closest('[data-edk]');
      if (!item) return;
      e.stopPropagation(); e.preventDefault();
      if (hd.dataset.edrag === 'tab' && EXP.get(cid(ed))) { EXP.delete(cid(ed)); R.querySelectorAll('.kpart').forEach((x) => x.remove()); } // fanen lukkes før den dras
      d = { list: hd.dataset.edrag, k: item.dataset.edk, item, y0: e.clientY, id: e.pointerId, over: null };
      try { hd.setPointerCapture(e.pointerId); } catch (x) { /* */ }
      item.style.position = 'relative'; item.style.zIndex = '2'; item.style.boxShadow = '0 6px 18px rgba(0,0,0,.4)';
      M.haptic('medium');
    });
    R.addEventListener('pointermove', (e) => {
      if (!d || e.pointerId !== d.id) return;
      e.stopPropagation(); e.preventDefault();
      d.item.style.transform = `translateY(${e.clientY - d.y0}px)`;
      d.item.style.pointerEvents = 'none';
      const el = R.elementFromPoint ? R.elementFromPoint(e.clientX, e.clientY) : null;
      d.item.style.pointerEvents = '';
      const ov = el && el.closest && el.closest('[data-edk]');
      const ok = ov && ov !== d.item && ov.dataset.elist === d.list ? ov : null;
      if (ok !== d.over) { if (d.over) d.over.style.outline = ''; d.over = ok; if (ok) { ok.style.outline = '2px solid rgba(242,133,201,.6)'; M.haptic('selection'); } }
    });
    const end = (e) => {
      if (!d || (e && e.pointerId !== d.id)) return;
      const D = d; d = null;
      D.item.style.transform = ''; D.item.style.zIndex = ''; D.item.style.boxShadow = '';
      if (D.over) D.over.style.outline = '';
      if (!D.over) { ed._render(); return; }
      const c = ed._config || {};
      const tab = D.list.startsWith('sec:') ? D.list.slice(4) : null;
      const arr = tab ? partOrder(c, tab) : tabOrder(c), to = D.over.dataset.edk, i = arr.indexOf(D.k), j0 = arr.indexOf(to);
      const o = arr.filter((x) => x !== D.k), j = o.indexOf(to);
      o.splice(i <= j0 ? j + 1 : j, 0, D.k);
      M.haptic('success');
      if (tab) ed._set('section_order', { ...(c.section_order || {}), [tab]: o });
      else ed._set('tab_order', o);
    };
    R.addEventListener('pointerup', end);
    R.addEventListener('pointercancel', end);
  }

  function editorSchema(h, c) {
    c = c || {};
    // Faner: piller (56) med dra, ikon, navn + «N deler», pil og øye; utvidet → deler (52) med dra + øye
    const faner = { type: 'html', html: (hh, cc, key, ed) => {
      installEd(ed);
      const hid = tabHidden(cc), open = EXP.get(cid(ed));
      return `<div class="f" style="gap:8px;padding:0;background:none;box-shadow:none">${tabOrder(cc).map((k) => {
        const [, label, icon] = TABL[k], P = PARTS[k], ph = partHidden(cc, k), isO = open === k && P.length > 1;
        const row = `<div class="ordrow ktab" data-edk="${k}" data-elist="tab" data-key="kt-${k}" style="height:56px;border-radius:28px;background:#3a3a3a;display:flex;align-items:center;gap:8px;padding:0 6px 0 10px;${hid.has(k) ? 'opacity:.5' : ''}">${hdl('tab')}
          <span style="width:36px;height:36px;border-radius:18px;display:grid;place-items:center;background:#404040;flex:none">${M.icon(icon, 20)}</span>
          <span style="flex:1;min-width:0;display:flex;flex-direction:column"><span style="font-size:14px;font-weight:500">${esc(label)}</span><span style="font-size:11px;color:#979797">${P.length} ${P.length === 1 ? 'del' : 'deler'}</span></span>
          ${P.length > 1 ? `<button class="ib" data-a="fn" data-k="${key}" data-op="exp" data-v="${k}" aria-expanded="${isO}" aria-label="Deler i ${esc(label)}" style="width:40px;height:40px;border-radius:20px;display:grid;place-items:center;flex:none">${M.icon(isO ? 'mdi:chevron-up' : 'mdi:chevron-down', 22)}</button>` : ''}
          ${eyeB(key, 'eye', '', k, hid.has(k), label)}</div>`;
        const parts = isO ? partOrder(cc, k).map((p) => { const pl = P.find((x) => x[0] === p)[1]; return `<div class="ordrow kpart" data-edk="${p}" data-elist="sec:${k}" data-key="kp-${k}-${p}" style="height:52px;border-radius:26px;margin-left:28px;background:#404040;display:flex;align-items:center;gap:8px;padding:0 6px 0 10px;${ph.has(p) ? 'opacity:.5' : ''}">${hdl('sec:' + k)}<span style="flex:1;font-size:13px">${esc(pl)}</span>${eyeB(key, 'peye', k, p, ph.has(p), pl)}</div>`; }).join('') : '';
        return row + parts;
      }).join('')}<span class="help">Dra i håndtaket for rekkefølge. Pilen viser delene i fanen, øyet skjuler. Minst én fane må være synlig.</span></div>`;
    }, click: (dd, ed) => {
      const cc = ed._config || {}, id = cid(ed);
      if (dd.op === 'exp') { M.haptic('selection'); if (EXP.get(id) === dd.v) EXP.delete(id); else EXP.set(id, dd.v); return ed._render(); }
      if (dd.op === 'eye') {
        const hid = tabHidden(cc);
        if (!hid.has(dd.v) && TABS.filter((t) => !hid.has(t[0])).length <= 1) { M.haptic('warning'); M.toast('Minst én fane må være synlig'); return; }
        if (hid.has(dd.v)) hid.delete(dd.v); else hid.add(dd.v);
        M.haptic('selection'); return ed._set('tab_hidden', hid.size ? [...hid] : undefined);
      }
      if (dd.op === 'peye') {
        const S = { ...(cc.section_hidden || {}) }, s = new Set(S[dd.t] || []);
        if (s.has(dd.v)) s.delete(dd.v); else s.add(dd.v);
        if (s.size) S[dd.t] = [...s]; else delete S[dd.t];
        M.haptic('selection'); return ed._set('section_hidden', Object.keys(S).length ? S : undefined);
      }
    } };
    // Kalendere: farge-prikk (trykk = neste farge), navn, entitet og bryter · «Legg til kalender»
    const kal = { type: 'html', html: (hh, cc, key, ed) => {
      installEd(ed);
      if (!hh) return '';
      const L = calsOf(hh, cc), inL = new Set(L.map((x) => x.id));
      const add = ADDCAL.has(cid(ed)) ? M.all(hh, 'calendar').filter((id) => !inL.has(id)) : null;
      return `<div class="f" style="gap:8px;padding:0;background:none;box-shadow:none">${L.length ? L.map((x) => `<div class="ordrow" data-key="kc-${esc(x.id)}" style="height:56px;border-radius:28px;background:#3a3a3a;display:flex;align-items:center;gap:10px;padding:0 12px 0 10px">
          <button data-a="fn" data-k="${key}" data-op="col" data-v="${esc(x.id)}" aria-label="Bytt farge" style="width:36px;height:36px;border-radius:18px;display:grid;place-items:center;flex:none;background:#404040"><i style="width:14px;height:14px;border-radius:7px;background:${esc(x.color)}"></i></button>
          <span style="flex:1;min-width:0;display:flex;flex-direction:column"><span style="font-size:14px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(x.name)}</span><span style="font-size:11px;color:#979797;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(x.id)}${x.exists ? '' : ' · finnes ikke'}</span></span>
          <button class="sw ${x.hidden ? '' : 'on'}" role="switch" aria-checked="${!x.hidden}" aria-label="Vis ${esc(x.name)}" data-a="fn" data-k="${key}" data-op="cal" data-v="${esc(x.id)}"></button></div>`).join('') : '<div class="small" style="padding:0 6px">Fant ingen calendar.*-entiteter.</div>'}
        ${add ? `<div style="display:flex;flex-direction:column;gap:6px">${add.length ? add.map((id) => `<button data-a="fn" data-k="${key}" data-op="add" data-v="${esc(id)}" style="height:48px;border-radius:24px;background:#404040;display:flex;align-items:center;gap:10px;padding:0 14px;text-align:left">${M.icon('mdi:plus', 20)}<span style="flex:1;min-width:0;display:flex;flex-direction:column"><span style="font-size:13px">${esc(M.name(hh, id))}</span><span style="font-size:11px;color:#979797">${esc(id)}</span></span></button>`).join('') : '<div class="small" style="padding:0 6px">Alle kalenderne er allerede med.</div>'}</div>` : ''}
        <button class="btn" style="height:48px" data-a="fn" data-k="${key}" data-op="addopen" data-v="">${M.icon(add ? 'mdi:close' : 'mdi:calendar-plus', 20)}${add ? 'Lukk' : 'Legg til kalender'}</button></div>`;
    }, click: (dd, ed) => {
      const hh = ed._hass, cc = ed._config || {};
      if (dd.op === 'addopen') { M.haptic('selection'); if (ADDCAL.has(cid(ed))) ADDCAL.delete(cid(ed)); else ADDCAL.add(cid(ed)); return ed._render(); }
      if (dd.op === 'cal') { const s = new Set(cc.calendars_hidden || []); if (s.has(dd.v)) s.delete(dd.v); else s.add(dd.v); M.haptic('selection'); return ed._set('calendars_hidden', s.size ? [...s] : undefined); }
      if (dd.op === 'col') { const L = calsOf(hh, cc), x = L.find((y) => y.id === dd.v); const i = PAL.indexOf(x && x.color); M.haptic('selection'); return ed._set('calendar_colors', { ...(cc.calendar_colors || {}), [dd.v]: PAL[(i + 1) % PAL.length] }); }
      if (dd.op === 'add') {
        const old = Array.isArray(cc.calendars) ? cc.calendars : [];
        const L = calsOf(hh, cc).map((x) => { const o = old.find((y) => y && (y.entity || y) === x.id); const { name, color } = o && typeof o === 'object' ? o : {}; return { entity: x.id, ...(name ? { name } : {}), ...(color ? { color } : {}) }; });
        L.push({ entity: dd.v }); M.haptic('success'); return ed._set('calendars', L);
      }
    } };
    // Kilder: blått info-kort + akkordeon per kilde (søk, forslag, «Bruk automatisk»). GUI-editoren: entitetsvelger.
    const info = { type: 'html', html: () => `<div style="display:flex;gap:10px;align-items:flex-start;padding:12px 14px;border-radius:20px;background:rgba(115,185,242,.14);color:${C.blue};font-size:13px;line-height:1.4">${M.icon('mdi:information-outline', 20)}<span>Kildene finnes automatisk i Home Assistant (KI Hyttebesøk, Når kommer Posten, Norwegian Parcel Tracker, Sonarr/Radarr, Plex og kalenderne). Velg en annen entitet her bare hvis det automatiske valget er feil.</span></div>` };
    const kilde = ([k, label, icon, col]) => ({ type: 'html', html: (hh, cc, key, ed) => {
      installEd(ed);
      if (!hh) return '';
      const ov = (cc.src || {})[k], au = autoSrc(hh, k), cur = ov && ov !== 'none' ? ov : ov === 'none' ? null : au;
      const kind = ov ? 'over' : au ? 'auto' : 'none';
      if (!ed._inline) {
        const sel = { entity: {} };
        return `<div class="f"><div class="line">${M.icon(icon, 20, `color:${col}`)}<span style="flex:1;font-size:14px;font-weight:500">${esc(label)}</span>${badge(kind)}</div><ha-selector data-name="src.${k}" data-nomorph data-selector='${esc(JSON.stringify(sel))}' data-label="${esc(label)}" data-helper="${esc(ov ? '' : 'Automatisk' + (au ? ' · ' + au : ' · fant ingen'))}"></ha-selector></div>`;
      }
      const isO = OPEN.get(cid(ed)) === k, q = Q.get(cid(ed) + '|' + k) || '';
      let body = '';
      if (isO) {
        const ql = q.trim().toLowerCase();
        const L = ql ? Object.keys(hh.states).filter((id) => low(hh, id).includes(ql)).sort().slice(0, 12) : cands(hh, k).slice(0, 12);
        body = `<div style="display:flex;flex-direction:column;gap:6px;padding:0 10px 12px">
          <div style="display:flex;align-items:center;gap:8px;height:44px;border-radius:22px;background:#2f2f2f;padding:0 6px 0 14px">${M.icon('mdi:magnify', 20, 'color:#979797')}<input data-ksq="${k}" value="${esc(q)}" placeholder="Søk etter entitet" autocapitalize="off" autocorrect="off" spellcheck="false" style="flex:1;min-width:0;height:100%;background:none;border:0;color:#fafafa;font-size:14px">${q ? `<button data-a="fn" data-k="${key}" data-op="qclr" data-v="${k}" aria-label="Tøm" style="width:32px;height:32px;border-radius:16px;display:grid;place-items:center;background:#404040">${M.icon('mdi:close', 18)}</button>` : ''}</div>
          <span style="font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#7f7f7f;padding:4px 6px 0">${q ? 'Treff' : 'Forslag fra Home Assistant'}</span>
          ${L.length ? L.map((id) => `<button data-a="fn" data-k="${key}" data-op="pick" data-v="${k}" data-id="${esc(id)}" style="min-height:52px;border-radius:26px;background:#404040;display:flex;align-items:center;gap:10px;padding:6px 14px;text-align:left">${M.icon(M.domainIcon(id, hh.states[id]), 20, 'color:#afafaf')}<span style="flex:1;min-width:0;display:flex;flex-direction:column"><span style="font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(M.name(hh, id))}</span><span style="font-size:11px;color:#979797;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(id)}</span></span>${id === cur ? M.icon('mdi:check-circle', 22, `color:${C.green}`) : ''}</button>`).join('') : '<div class="small" style="padding:6px">Ingen treff</div>'}
          ${ov ? `<button class="btn" style="height:44px" data-a="fn" data-k="${key}" data-op="auto" data-v="${k}">${M.icon('mdi:restore', 18)}Bruk automatisk</button>` : ''}</div>`;
      }
      return `<div class="ksrc" data-key="ks-${k}" style="border-radius:26px;background:#3a3a3a;overflow:hidden">
        <button data-a="fn" data-k="${key}" data-op="open" data-v="${k}" aria-expanded="${isO}" style="width:100%;min-height:60px;display:flex;align-items:center;gap:10px;padding:8px 12px;text-align:left">
          <span style="width:40px;height:40px;border-radius:20px;display:grid;place-items:center;flex:none;background:${M.alpha(col, 0.18)};color:${col}">${M.icon(icon, 20)}</span>
          <span style="flex:1;min-width:0;display:flex;flex-direction:column"><span style="font-size:14px;font-weight:500">${esc(label)}</span><span style="font-size:11px;color:#979797;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(cur || '– · Velg entitet')}</span></span>
          ${badge(kind)}${M.icon(isO ? 'mdi:chevron-up' : 'mdi:chevron-down', 20, 'color:#979797')}</button>${body}</div>`;
    }, click: (dd, ed) => {
      const id = cid(ed);
      if (dd.op === 'open') { M.haptic('selection'); if (OPEN.get(id) === dd.v) OPEN.delete(id); else OPEN.set(id, dd.v); return ed._render(); }
      if (dd.op === 'qclr') { Q.delete(id + '|' + dd.v); return ed._render(); }
      if (dd.op === 'pick') { M.haptic('success'); const au = autoSrc(ed._hass, dd.v); return ed._set('src.' + dd.v, dd.id === au && !(ed._config.src || {})[dd.v] ? undefined : dd.id); }
      if (dd.op === 'auto') { M.haptic('selection'); Q.delete(id + '|' + dd.v); return ed._set('src.' + dd.v, undefined); }
    } });
    const spacing = { type: 'section', id: 'spacing', label: 'Mellomrom', icon: 'mdi:arrow-expand-vertical', meta: (hh, cc) => `${cc.gap != null ? cc.gap : 8} px mellom`, fields: [
      { type: 'range', name: 'gap', label: 'Mellom seksjonene', icon: 'mdi:arrow-split-horizontal', min: 0, max: 24, default: 8, presets: [[4, 'Tett 4'], [8, 'Standard 8'], [18, 'Luftig 18']] },
      { type: 'range', name: 'pad_top', label: 'Fra popup-headeren til første kort', icon: 'mdi:format-vertical-align-top', min: -20, max: 60, default: -10, presets: [[-20, 'Inntil −20'], [-10, 'Standard −10'], [6, 'Tett 6'], [44, 'Luftig 44']] },
      { type: 'range', name: 'pad_bottom', label: 'Luft i bunnen', icon: 'mdi:format-vertical-align-bottom', min: 0, max: 300, default: 150, presets: [[0, 'Ingen 0'], [60, 'Litt 60'], [150, 'Standard 150'], [300, 'Maks 300']] },
    ] };
    const visning = [
      { type: 'select', name: 'tab_labels', label: 'Faner viser', options: [['icon', 'Symboler'], ['name', 'Navn']], default: 'icon', help: 'Symboler: bare ikon, den aktive fanen viser også navnet. Navn: bare tekst.' },
      { type: 'select', name: 'days', label: 'Dager fremover', options: [[7, '7'], [14, '14'], [30, '30']], default: 14 },
      { type: 'select', name: 'defaultView', label: 'Standardvisning', options: [['liste', 'Liste'], ['maned', 'Måned']], default: 'liste' },
      { type: 'select', name: 'startTab', label: 'Startfane', options: TABS.map((t) => [t[0], t[1]]), default: 'kalender' },
      { type: 'boolean', name: 'showPlex', label: 'Vis «Nylig i Plex»', default: true },
      { type: 'boolean', name: 'birthdayToday', label: 'Konfetti når noen har bursdag i dag', default: true },
      spacing,
    ];
    return [
      { type: 'tabs', id: 'kalender', tabs: [
        { key: 'faner', label: 'Faner', icon: 'mdi:tab', focus: ['faner'], fields: [faner] },
        { key: 'kalendere', label: 'Kalendere', icon: 'mdi:calendar-multiple', focus: ['kalendere'], fields: [kal] },
        { key: 'kilder', label: 'Kilder', icon: 'mdi:database-search-outline', focus: ['kilder'], fields: [info, ...SRC.map(kilde)] },
        { key: 'visning', label: 'Visning', icon: 'mdi:tune-variant', focus: ['spacing', 'visning'], fields: visning },
      ] },
      { type: 'button', label: 'Nullstill', icon: 'mdi:restore', run: (hh, cc, ed) => { M.haptic('warning'); const id = (cc && cc.card_id) || M.uid(); EXP.delete(id); OPEN.delete(id); ed._config = { type: cc.type || 'custom:msh-kalender-card', card_id: id }; ed._set('card_id', id); } },
    ];
  }

  /* ============================================================ kortet */
  class Kalender extends M.Card {
    static get cardName() { return 'Kalender'; }
    static get defaults() { return { ...DEF }; }
    static getStubConfig() { return { card_id: M.uid() }; }
    static get schema() { return editorSchema; }
    static get uiPersist() { return ['tab']; }
    static get spacingDefaults() { return { gap: 8, pad_top: -10, pad_bottom: 150 }; }
    get cardSize() { return 12; }
    setConfig(c) {
      // `spacing: { gap, top, bottom }` (designet) → felles nøkler gap/pad_top/pad_bottom (MSH.Card._applySpacing)
      if (c && c.spacing && typeof c.spacing === 'object') { const s = c.spacing; c = { ...c, gap: c.gap != null ? c.gap : s.gap, pad_top: c.pad_top != null ? c.pad_top : s.top, pad_bottom: c.pad_bottom != null ? c.pad_bottom : s.bottom }; }
      super.setConfig(c);
    }
    connectedCallback() {
      super.connectedCallback();
      if (!this.__mbBound) { this.__mbBound = true; this._bindMode(); }
    }
    onOpen() { this.update(); }
    onClose() { this._ui = { ...this._ui, mOff: 0, fOff: 0, hOff: 0, selDay: null, fSel: null, btn: 'view', q: '' }; }
    get tab() { const V = visTabs(this.config); const t = this.ui.tab || this.config.startTab; return V.includes(t) ? t : V[0]; }
    _upd() { if (this.isConnected) this.update(); }
    _ev(id, s, e) { if (!id || !this.hass || !this.isOpen) { const k = `${id}|${dk(s)}|${dk(e)}`; const x = EV.get(k); return x ? x.list : null; } return evFetch(this.hass, id, s, e, () => this._upd()); }
    async _save(patch) {
      const old = this._rawConfig || this.config, n = { ...old, ...patch };
      Object.keys(patch).forEach((k) => { if (patch[k] === undefined) delete n[k]; });
      this.setConfig(n);
      try { const r = await M.saveCardConfig(this.hass, old, n, { card: this }); if (r && r.config) this.setConfig(r.config); } catch (e) { console.warn('[ki-msh] Kalender', e); }
    }

    /* ---------------------------------------------------------- modusknappen: trykk / hold / sveip */
    _bindMode() {
      const R = this.shadowRoot;
      const mb = (e) => (e.composedPath ? e.composedPath() : []).find((n) => n && n.classList && n.classList.contains('mb'));
      const stopT = (e) => { if (mb(e)) e.stopPropagation(); };
      R.addEventListener('touchstart', stopT, { passive: true });
      R.addEventListener('touchmove', (e) => { if (mb(e)) { e.stopPropagation(); if (e.cancelable) e.preventDefault(); } }, { passive: false });
      let g = null;
      R.addEventListener('pointerdown', (e) => {
        const b = mb(e); if (!b || e.button) return;
        e.stopPropagation();
        try { b.setPointerCapture(e.pointerId); } catch (x) { /* */ }
        g = { id: e.pointerId, y0: e.clientY, done: false };
        g.t = setTimeout(() => { if (!g || g.done) return; g.done = true; M.haptic('medium'); this._calMenu(); }, 480);
      });
      R.addEventListener('pointermove', (e) => {
        if (!g || e.pointerId !== g.id) return;
        e.stopPropagation();
        if (g.done) return;
        const dy = e.clientY - g.y0;
        if (Math.abs(dy) > 16) { g.done = true; clearTimeout(g.t); M.haptic('selection'); this.setUI({ btn: this.ui.btn === 'gear' ? 'view' : 'gear' }); }
      });
      const up = (e) => {
        if (!g || e.pointerId !== g.id) return;
        e.stopPropagation();
        clearTimeout(g.t);
        const G = g; g = null;
        if (G.done || e.type === 'pointercancel') return;
        M.haptic('light');
        this._modeTap();
      };
      R.addEventListener('pointerup', up);
      R.addEventListener('pointercancel', up);
    }
    _modeTap() {
      const t = this.tab;
      if (this.ui.btn === 'gear' || !(t === 'kalender' || t === 'framover')) return this.customize();
      const k = t === 'kalender' ? 'kview' : 'fview', cur = this.ui[k] || (t === 'kalender' ? this.config.defaultView : 'liste') || 'liste';
      this.setUI({ [k]: cur === 'maned' ? 'liste' : 'maned', selDay: null, fSel: null });
    }
    // «Vis kalendere» (portalt, fallgruve 1): avkrysning per calendar.* med farge-prikk
    _calMenu() {
      const ov = M.overlay({ html: '', maxWidth: 420, guard: 350, css: `
        .mh{display:flex;align-items:center;gap:10px;padding:4px 4px 12px;font-size:18px;font-weight:500}
        .mr{display:flex;align-items:center;gap:12px;width:100%;min-height:56px;padding:6px 14px;border-radius:28px;background:#3a3a3a;margin-bottom:6px;text-align:left;color:#fafafa}
        .mr i{width:14px;height:14px;border-radius:7px;flex:none}
        .mr .nm{flex:1;min-width:0;display:flex;flex-direction:column}.mr .nm b{font-weight:500;font-size:14px}.mr .nm span{font-size:11px;color:#979797}
        .ck{width:26px;height:26px;border-radius:8px;display:grid;place-items:center;background:#545454;flex:none}.ck.on{background:${C.accent};color:#2a1720}
        .none{padding:14px;color:#979797;font-size:13px}` });
      const draw = () => {
        const L = calsOf(this.hass, this.config);
        ov.body.innerHTML = `<div class="mh">${M.icon('mdi:calendar-multiple-check', 22)}<span>Vis kalendere</span></div>${L.length ? L.map((x) => `<button class="mr" data-id="${esc(x.id)}" role="checkbox" aria-checked="${!x.hidden}"><i style="background:${esc(x.color)}"></i><span class="nm"><b>${esc(x.name)}</b><span>${esc(x.id)}</span></span><span class="ck ${x.hidden ? '' : 'on'}">${x.hidden ? '' : M.icon('mdi:check', 18)}</span></button>`).join('') : '<div class="none">Fant ingen calendar.*-entiteter.</div>'}`;
      };
      draw();
      ov.body.addEventListener('click', (e) => {
        const b = e.target.closest && e.target.closest('.mr'); if (!b) return;
        M.haptic('selection');
        const s = new Set(this.config.calendars_hidden || []); if (s.has(b.dataset.id)) s.delete(b.dataset.id); else s.add(b.dataset.id);
        this._save({ calendars_hidden: s.size ? [...s] : undefined }).then(draw); draw();
      });
      this._menu = ov;
    }

    /* ---------------------------------------------------------- tegning */
    render() {
      const c = this.config, t = this.tab;
      const V = visTabs(c), names = c.tab_labels === 'name';
      const tabs = `<div class="tabs ${names ? 'names noscroll' : 'itabs'}" role="tablist" data-glass-drag="x">${V.map((k) => {
        const [, label, icon] = TABL[k];
        return names ? `<button class="ntab ${k === t ? 'on' : ''}" role="tab" aria-selected="${k === t}" data-act="tab" data-v="${k}" data-haptic="selection">${esc(label)}</button>`
          : M.iconTabs.btn({ label, icon }, k === t, `data-act="tab" data-v="${k}" data-haptic="selection"`, k === t ? 'on' : '');
      }).join('')}</div>`;
      const gear = this.ui.btn === 'gear', viewTab = t === 'kalender' || t === 'framover';
      const view = t === 'kalender' ? this.ui.kview || c.defaultView || 'liste' : this.ui.fview || 'liste';
      const vIcon = !viewTab ? 'mdi:tune-variant' : view === 'maned' ? 'mdi:format-list-bulleted' : 'mdi:calendar-month-outline';
      const mode = `<div class="mode"><button class="mb press" aria-label="${gear ? 'Tilpass kalender' : viewTab ? (view === 'maned' ? 'Vis liste' : 'Vis måned') : 'Tilpass kalender'} · hold for kalendere · sveip for tannhjul" data-mode="${gear ? 'gear' : 'view'}">
        <span class="rail" style="transform:translateY(${gear ? -48 : 0}px)"><span>${M.icon(vIcon, 22)}</span><span>${M.icon('mdi:cog', 22)}</span></span></button>
        <span class="mdots" aria-hidden="true"><i class="${gear ? '' : 'on'}"></i><i class="${gear ? 'on' : ''}"></i></span></div>`;
      let body;
      try { body = this['_t_' + t](); } catch (e) { body = this._failHTML(e); }
      return `<div class="wrap"><div class="top">${tabs}${mode}</div><div class="pane" data-key="pane-${t}">${body}</div></div>`;
    }
    _parts(t) { const hid = partHidden(this.config, t); return partOrder(this.config, t).filter((p) => !hid.has(p)); }
    _missing(text, section) { return `<div class="miss"><span class="mdash">–</span><span>·</span><button class="pick press" data-act="customize" data-section="${esc(section || 'kilder')}">${M.icon('mdi:plus', 18)}Velg entitet</button>${text ? `<span class="mt">${esc(text)}</span>` : ''}</div>`; }
    _hdr(title, extra) { return `<div class="sh"><span class="st">${esc(title)}</span>${extra || ''}</div>`; }

    /* ---------------------------------------------------------- Kalender */
    _calEvents(s, e) {
      const L = calsOf(this.hass, this.config).filter((x) => !x.hidden && x.exists);
      const out = []; let busy = false;
      L.forEach((x) => { this.s(x.id); const r = this._ev(x.id, s, e); if (r == null) busy = true; (r || []).forEach((ev) => out.push({ ...ev, color: x.color, calName: x.name })); });
      return { list: out.sort((a, b) => a.start - b.start || (b.allDay ? 1 : 0) - (a.allDay ? 1 : 0)), busy, cals: L };
    }
    _win(off) { const now = d0(new Date()); if (!off) return [addD(now, -40), addD(now, 41)]; const f = new Date(now.getFullYear(), now.getMonth() + off, 1); return [addD(f, -7), addD(new Date(f.getFullYear(), f.getMonth() + 1, 1), 7)]; }
    _t_kalender() {
      const all = calsOf(this.hass, this.config);
      if (!all.some((x) => x.exists)) return this._missing(all.length ? 'Fant ikke de valgte kalenderne' : 'Ingen kalendere', 'kalendere');
      const view = this.ui.kview || this.config.defaultView || 'liste';
      return view === 'maned' ? this._kMonth() : this._kList();
    }
    _evRow(e) {
      const time = e.allDay ? 'Hele dagen' : `${hm(e.start)}–${hm(e.end)}`;
      const multi = e.allDay && dayDiff(e.start, e.end) > 0 ? ` · til ${dShort(e.end)}` : '';
      return `<button class="ev press" data-act="evd" data-uid="${esc(e.uid)}" data-cal="${esc(e.cal)}" data-s="${e.start.getTime()}">
        <span class="evt num">${esc(time)}</span><i class="evd" style="background:${esc(e.color)}"></i>
        <span class="grow evc"><b class="ell">${esc(e.summary)}</b><span class="ell">${esc([e.calName, e.location].filter(Boolean).join(' · ') + multi)}</span></span></button>`;
    }
    _kList() {
      const n = Number(this.config.days) || 14, today = d0(new Date());
      const [s, e] = this._win(0);
      const { list, busy } = this._calEvents(s, e);
      const out = [];
      for (let i = 0; i < n; i++) {
        const d = addD(today, i), dE = addD(d, 1);
        const evs = list.filter((x) => x.start < dE && (x.allDay ? addD(x.end, 1) : x.end) > d && (x.allDay || x.end > d || x.start >= d));
        if (!evs.length && i > 0) continue;
        out.push(`<section class="day" data-key="d-${dk(d)}"><div class="dh">${esc(dayLabel(d))}${evs.length ? `<span class="dn num">${evs.length}</span>` : ''}</div>
          <div class="card evl">${evs.length ? evs.map((x) => this._evRow(x)).join('') : `<div class="none">${busy ? 'Henter …' : 'Ingenting i dag'}</div>`}</div></section>`);
      }
      if (out.length === 1 && !busy) out.push(`<div class="none sm">Ingen flere hendelser de neste ${n} dagene</div>`);
      return out.join('');
    }
    _monthHead(y, m, act, off) {
      const wk = monthGrid(y, m), w0 = weekNo(wk[0][0]), w1 = weekNo(wk[wk.length - 1][0]);
      return `<div class="mhd"><button class="nb press" data-act="${act}" data-d="-1" aria-label="Forrige måned">${M.icon('mdi:chevron-left', 22)}</button>
        <div class="grow mtl"><b>${MND_L[m][0].toUpperCase() + MND_L[m].slice(1)} ${y}</b><span class="num">Uke ${w0}–${w1}</span></div>
        ${off ? `<button class="chip press" data-act="${act}" data-d="0">i dag</button>` : ''}
        <button class="nb press" data-act="${act}" data-d="1" aria-label="Neste måned">${M.icon('mdi:chevron-right', 22)}</button></div>`;
    }
    _gridHTML(y, m, cell) {
      const today = dk(d0(new Date()));
      return `<div class="mg"><span class="wn"></span>${UKE.map((u) => `<span class="wd">${u}</span>`).join('')}${monthGrid(y, m).map((w) => `<span class="wn num">${weekNo(w[0])}</span>${w.map((d) => cell(d, dk(d), d.getMonth() !== m, dk(d) === today)).join('')}`).join('')}</div>`;
    }
    _media() {
      const h = this.hass, c = this.config, out = [];
      const now = d0(new Date()), s = addD(now, -1), e = addD(now, 61);
      let busy = false;
      [['sonarr', 'serie'], ['radarr', 'film']].forEach(([k, kind]) => {
        const id = srcOf(h, c, k); if (!id) return;
        this.s(id);
        if (id.startsWith('calendar.')) { const r = this._ev(id, s, e); if (r == null) busy = true; out.push(...mediaFromEvents(r, id, kind)); } else out.push(...mediaFromSensor(h, id, kind));
      });
      return { list: out.filter((x) => x.date && d0(x.date) >= now).sort((a, b) => a.date - b.date), busy };
    }
    _kMonth() {
      const off = Number(this.ui.mOff) || 0, now = d0(new Date()), f = new Date(now.getFullYear(), now.getMonth() + off, 1);
      const [s, e] = this._win(off);
      const { list } = this._calEvents(s, e);
      this.__mi = null;
      const med = this._mItems().filter((x) => x.kind !== 'plex' && x.date);
      const on = (d) => { const dE = addD(d, 1); return list.filter((x) => x.start < dE && (x.allDay ? addD(x.end, 1) : x.end) > d); };
      const onM = (key) => med.filter((x) => dk(d0(x.date)) === key);
      const sel = this.ui.selDay || dk(now);
      const grid = this._gridHTML(f.getFullYear(), f.getMonth(), (d, key, out, isT) => {
        const n = on(d).length + onM(key).length;
        return `<button class="gd ${out ? 'out' : ''} ${isT ? 'today' : ''} ${key === sel ? 'sel' : ''}" data-act="selday" data-v="${key}" data-haptic="selection"><span class="num">${d.getDate()}</span>${n ? `<i class="bd num">${n}</i>` : ''}</button>`;
      });
      const sd = fromKey(sel), evs = on(sd), ms = onM(sel);
      return `<div class="card mcard">${this._monthHead(f.getFullYear(), f.getMonth(), 'mstep', off)}${grid}</div>
        <section class="day"><div class="dh">${esc(dayLabel(sd))}</div><div class="card evl">${evs.length || ms.length ? evs.map((x) => this._evRow(x)).join('') + ms.map((x) => this._mRow(x)).join('') : '<div class="none">Ingenting denne dagen</div>'}</div></section>`;
    }

    /* ---------------------------------------------------------- Hytta */
    _t_hytta() {
      const h = this.hass, c = this.config, id = srcOf(h, c, 'hytta');
      let evs = null;
      if (id && id.startsWith('calendar.')) { const now = d0(new Date()); evs = this._ev(id, addD(now, -400), addD(now, 200)); }
      if (id) this.s(id);
      cands(h, 'hytta').forEach((x) => this.s(x));
      const S = hyttaData(h, c, evs);
      if (!S.length) return this._missing(id ? 'Fant ingen opphold ennå' : 'Ingen hyttebesøk-kilde', 'kilder');
      const P = this._parts('hytta');
      const idx = M.clamp(Number(this.ui.hCar) || 0, 0, S.length);
      const sel = idx === 0 ? S : [S[idx - 1]];
      const out = [];
      P.forEach((p) => {
        if (p === 'sok') out.push(this._hSearch(S));
        if (p === 'steder') out.push(this._hCarousel(S, idx));
        if (p === 'seg') out.push(this._hSeg(sel, S));
      });
      return out.join('');
    }
    _hSearch(S) {
      const q = this.ui.q || '', r = parseQuery(q);
      let res = '';
      if (q.trim()) {
        if (!r) res = '<div class="none sm">Prøv «12.7», «uke 27», «i går» eller «juli»</div>';
        else {
          const hits = S.flatMap((x) => x.opphold).filter((o) => o.start <= r.e && o.end >= r.s).sort((a, b) => b.start - a.start);
          res = `<div class="card hres"><div class="hrh"><b>${esc(r.label)}</b><span class="num">${hits.length} opphold</span><button class="chip press" data-act="hshow" data-v="${dk(r.s)}">${M.icon('mdi:calendar-search', 16)}Vis i kalender</button></div>${hits.length ? hits.slice(0, 8).map((o) => this._stayRow(o)).join('') : '<div class="none">Ingen opphold i perioden</div>'}</div>`;
        }
      }
      return `<div class="srch">${M.icon('mdi:magnify', 20, 'color:#979797')}<input data-input="hq" value="${esc(q)}" placeholder="Søk: 12.7 · uke 27 · i går · juli" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="search">${q ? `<button class="x press" data-act="hqclr" aria-label="Tøm">${M.icon('mdi:close', 18)}</button>` : ''}</div>${res}`;
    }
    _hCarousel(S, idx) {
      const ppl = (list) => `<span class="ppl">${list.slice(0, 5).map((p, i) => `<span class="av" style="background:${esc(M.color(p.color, PAL[i % PAL.length]))}${p.here ? ';box-shadow:0 0 0 2px #3a3a3a,0 0 0 4px ' + C.green : ''}" title="${esc(p.name)}">${esc(ini(p.name))}</span>`).join('')}</span>`;
      const all = { sted: 'Alle steder', color: C.pink, motif: 'hus', nights: S.reduce((s, x) => s + x.nights, 0), visits: S.reduce((s, x) => s + x.visits, 0), persons: uniq(S.flatMap((x) => x.persons.map((p) => p.name))).map((name) => { const p = S.flatMap((x) => x.persons).find((y) => y.name === name) || {}; return { name, color: p.color, here: S.some((x) => x.here.includes(name)) }; }), here: S.flatMap((x) => x.here) };
      const slide = (x, i, isAll) => `<div class="hs" data-key="hs-${i}"><div class="hcard" style="--sc:${x.color}">
          <div class="hct"><b>${esc(x.sted)}</b>${x.here.length ? `<span class="hn">${M.icon('mdi:map-marker', 14)}${esc(x.here.slice(0, 3).join(', '))} ${x.here.length === 1 ? 'er' : 'er'} der</span>` : '<span class="hn dim">Ingen der nå</span>'}</div>
          ${isAll ? `<div class="hchips">${S.map((s) => `<span class="hchip" style="--sc:${s.color}"><i></i>${esc(s.sted)} · ${s.nights}</span>`).join('')}</div>` : ppl(x.persons)}
          <div class="hnum"><div><b class="num">${x.nights}</b><span>netter i år</span></div><div><b class="num">${x.visits}</b><span>besøk i år</span></div>${isAll ? `<div><b class="num">${x.persons.length}</b><span>personer</span></div>` : ''}</div>
          <span class="illu">${ILLU[x.motif] || ILLU.hus}</span></div></div>`;
      return `<div class="hcar noscroll" data-key="hcar">${slide(all, 0, true)}${S.map((x, i) => slide(x, i + 1, false)).join('')}</div>${M.dotsHTML(S.length + 1, idx, 'hdots')}`;
    }
    _stayRow(o) {
      const today = d0(new Date()), on = o.ongoing || (o.start <= today && o.end >= today && !o.planned);
      return `<div class="stay"><span class="av" style="background:${esc(o.color)}">${esc(ini(o.person))}</span><span class="grow evc"><b class="ell">${esc(o.person)} <span class="stag" style="--sc:${o.color}">${esc(o.sted)}</span></b><span class="ell num">${esc(dShort(o.start))}${dk(o.start) !== dk(o.end) ? ' – ' + esc(dShort(o.end)) : ''}${o.planned ? ' · planlagt' : ''}</span></span><span class="snt num ${on ? 'on' : ''}">${on ? 'pågår' : o.nights + (o.nights === 1 ? ' natt' : ' netter')}</span></div>`;
    }
    _hSeg(sel, S) {
      const seg = this.ui.hSeg || 'kalender';
      const segs = `<div class="seg" role="tablist" data-glass-drag="x">${[['kalender', 'Kalender'], ['opphold', 'Opphold'], ['statistikk', 'Statistikk']].map(([k, l]) => `<button class="sg ${k === seg ? 'on' : ''}" role="tab" aria-selected="${k === seg}" data-act="hseg" data-v="${k}" data-haptic="selection">${l}</button>`).join('')}</div>`;
      const stays = sel.flatMap((x) => x.opphold);
      let body = '';
      if (seg === 'kalender') {
        const off = Number(this.ui.hOff) || 0, now = d0(new Date()), f = new Date(now.getFullYear(), now.getMonth() + off, 1);
        const grid = this._gridHTML(f.getFullYear(), f.getMonth(), (d, key, out, isT) => {
          const hit = stays.filter((o) => o.start <= d && o.end >= d);
          const planned = hit.length && hit.every((o) => o.planned);
          const cols = uniq(hit.map((o) => o.color));
          const bg = cols.length === 1 ? M.alpha(cols[0], planned ? 0.14 : 0.42) : cols.length > 1 ? `linear-gradient(135deg, ${cols.map((x, i) => `${M.alpha(x, 0.42)} ${Math.round((i / cols.length) * 100)}% ${Math.round(((i + 1) / cols.length) * 100)}%`).join(',')})` : '';
          return `<span class="gd hg ${out ? 'out' : ''} ${isT ? 'today' : ''} ${planned ? 'plan' : ''}" style="${bg ? `background:${bg};` : ''}${planned ? `--pc:${cols[0]}` : ''}" title="${esc(hit.map((o) => o.person + ' · ' + o.sted).join(', '))}"><span class="num">${d.getDate()}</span></span>`;
        });
        body = `<div class="card mcard">${this._monthHead(f.getFullYear(), f.getMonth(), 'hstep', off)}${grid}<div class="leg">${uniq(sel.map((x) => x.sted)).map((st) => { const x = sel.find((y) => y.sted === st); return `<span><i style="background:${x.color}"></i>${esc(st)}</span>`; }).join('')}<span><i class="dash"></i>Planlagt</span></div></div>`;
      } else if (seg === 'opphold') {
        const L = stays.slice().sort((a, b) => b.start - a.start);
        body = `<div class="card evl">${L.length ? L.slice(0, 30).map((o) => this._stayRow(o)).join('') : '<div class="none">Ingen opphold registrert</div>'}</div>`;
      } else {
        const yr = new Date().getFullYear();
        const per = Array.from({ length: 12 }, (_, mi) => sel.map((x) => ({ x, n: x.opphold.filter((o) => !o.planned).reduce((s, o) => { let k = 0; for (let i = 0; i < o.nights; i++) { const d = addD(o.start, i); if (d.getFullYear() === yr && d.getMonth() === mi) k++; } return s + k; }, 0) })));
        const mx = Math.max(1, ...per.map((m) => m.reduce((s, y) => s + y.n, 0)));
        body = `<div class="card stat"><div class="bars">${per.map((m, i) => { const tot = m.reduce((s, y) => s + y.n, 0); return `<div class="bc" title="${MND_L[i]}: ${tot} netter"><div class="bs">${m.filter((y) => y.n).map((y) => `<i style="height:${((y.n / mx) * 100).toFixed(1)}%;background:${y.x.color}"></i>`).join('')}</div><span>${MND[i][0].toUpperCase()}</span></div>`; }).join('')}</div>
          <div class="tots">${sel.map((x) => `<div class="tot"><i style="background:${x.color}"></i><span class="grow">${esc(x.sted)}</span><b class="num">${x.nights}</b><span class="dim">netter · ${x.visits} besøk</span></div>`).join('')}</div></div>`;
      }
      return `${segs}${body}`;
    }

    /* ---------------------------------------------------------- Framover */
    _mRow(x) {
      const i = this._mItems().indexOf(x);
      return `<button class="mr press" data-act="mdet" data-i="${i}">
        <span class="pst ${x.poster ? '' : 'ph'}">${x.poster ? `<img src="${esc(x.poster)}" alt="" loading="lazy">` : M.icon(x.kind === 'film' ? 'mdi:filmstrip' : 'mdi:television-classic', 18)}</span>
        <span class="grow evc"><b class="ell">${esc(x.title)}</b><span class="ell">${esc([x.ep, x.epTitle].filter(Boolean).join(' · ') || (x.kind === 'film' ? 'Film' : x.kind === 'plex' ? 'Plex' : 'Serie'))}${x.network ? ' · ' + esc(x.network) : ''}</span></span>
        <span class="mt num">${x.allDay || x.kind === 'plex' ? '' : esc(hm(x.date))}</span></button>`;
    }
    _plex() { const id = srcOf(this.hass, this.config, 'plex'); if (!id) return []; this.s(id); return mediaFromSensor(this.hass, id, 'plex'); }
    _mItems() { if (!this.__mi) { const m = this._media(); this.__mi = [...m.list, ...this._plex()]; this.__mBusy = m.busy; } return this.__mi; }
    _t_framover() {
      this.__mi = null;
      const h = this.hass, c = this.config;
      const has = ['sonarr', 'radarr', 'plex'].some((k) => srcOf(h, c, k));
      if (!has) return this._missing('Ingen Sonarr, Radarr eller Plex', 'kilder');
      const items = this._mItems(), busy = this.__mBusy;
      const up = items.filter((x) => x.kind !== 'plex'), plex = items.filter((x) => x.kind === 'plex');
      const f = this.ui.ff || 'alle';
      const L = f === 'serier' ? up.filter((x) => x.kind === 'serie') : f === 'filmer' ? up.filter((x) => x.kind === 'film') : f === 'plex' ? [] : up;
      const view = this.ui.fview || 'liste';
      const out = [];
      this._parts('framover').forEach((p) => {
        if (p === 'filter') out.push(`<div class="chips noscroll">${[['alle', 'Alle'], ['serier', 'Serier'], ['filmer', 'Filmer'], ['plex', 'Plex']].map(([k, l]) => `<button class="fc ${k === f ? 'on' : ''}" data-act="ff" data-v="${k}" data-haptic="selection" aria-pressed="${k === f}">${l}</button>`).join('')}</div>`);
        if (p === 'hero' && f !== 'plex') {
          const x = L[0];
          if (!x) { out.push(`<div class="card none">${busy ? 'Henter …' : 'Ingen kommende utgivelser'}</div>`); return; }
          const n = dayDiff(new Date(), x.date);
          out.push(`<button class="hero press" data-act="mdet" data-i="${items.indexOf(x)}"><span class="bdrop ${x.fanart ? '' : 'ph'}">${x.fanart ? `<img src="${esc(x.fanart)}" alt="" loading="lazy">` : ''}</span>
            <span class="hin"><span class="pst lg ${x.poster ? '' : 'ph'}">${x.poster ? `<img src="${esc(x.poster)}" alt="">` : M.icon(x.kind === 'film' ? 'mdi:filmstrip' : 'mdi:television-classic', 26)}</span>
            <span class="grow hcol"><span class="hchips"><span class="mchip">${x.kind === 'film' ? 'Film' : 'Serie'}</span><span class="mchip hl">${esc(n === 0 ? 'I dag' : n === 1 ? 'I morgen' : 'Om ' + n + ' dager')}</span></span>
            <b class="htl">${esc(x.title)}</b><span class="hsub ell">${esc([x.ep, x.epTitle].filter(Boolean).join(' · ') || dShort(x.date))}${x.network ? ' · ' + esc(x.network) : ''}</span></span></span></button>`);
        }
        if (p === 'kommende') {
          if (f === 'plex') { out.push(this._plexGrid(plex, true)); return; }
          if (view === 'maned') { out.push(this._fMonth(L)); return; }
          const rest = L.slice(1), days = uniq(rest.map((x) => dk(d0(x.date))));
          const nShow = this.ui.fmore ? days.length : Math.min(5, days.length);
          out.push(days.length ? days.slice(0, nShow).map((k) => `<section class="day" data-key="fd-${k}"><div class="dh">${esc(dayLabel(fromKey(k)))}</div><div class="card evl">${rest.filter((x) => dk(d0(x.date)) === k).map((x) => this._mRow(x)).join('')}</div></section>`).join('') + (days.length > 5 ? `<button class="more press" data-act="fmore">${this.ui.fmore ? 'Vis færre' : `Vis mer (${days.length - 5})`}</button>` : '') : '');
        }
        if (p === 'plex' && f === 'alle' && c.showPlex !== false && plex.length) out.push(`${this._hdr('Nylig i Plex')}${this._plexGrid(plex, false)}`);
      });
      return out.join('');
    }
    _plexGrid(plex, full) {
      if (!plex.length) return srcOf(this.hass, this.config, 'plex') ? '<div class="card none">Ingenting nylig lagt til</div>' : this._missing('Ingen Plex-kilde', 'kilder');
      const items = this._mItems();
      return `<div class="${full ? 'pgrid' : 'prow noscroll'}">${plex.slice(0, full ? 24 : 12).map((x) => `<button class="pc press" data-act="mdet" data-i="${items.indexOf(x)}"><span class="pst xl ${x.poster ? '' : 'ph'}">${x.poster ? `<img src="${esc(x.poster)}" alt="" loading="lazy">` : M.icon('mdi:plex', 24)}</span><b class="ell">${esc(x.title)}</b><span class="ell">${esc(x.ep || x.epTitle || '')}</span></button>`).join('')}</div>`;
    }
    _fMonth(L) {
      const off = Number(this.ui.fOff) || 0, now = d0(new Date()), f = new Date(now.getFullYear(), now.getMonth() + off, 1);
      const sel = this.ui.fSel || dk(now);
      const grid = this._gridHTML(f.getFullYear(), f.getMonth(), (d, key, out, isT) => { const n = L.filter((x) => dk(d0(x.date)) === key).length; return `<button class="gd ${out ? 'out' : ''} ${isT ? 'today' : ''} ${key === sel ? 'sel' : ''}" data-act="fsel" data-v="${key}" data-haptic="selection"><span class="num">${d.getDate()}</span>${n ? `<i class="bd num">${n}</i>` : ''}</button>`; });
      const ms = L.filter((x) => dk(d0(x.date)) === sel);
      return `<div class="card mcard">${this._monthHead(f.getFullYear(), f.getMonth(), 'fstep', off)}${grid}</div><section class="day"><div class="dh">${esc(dayLabel(fromKey(sel)))}</div><div class="card evl">${ms.length ? ms.map((x) => this._mRow(x)).join('') : '<div class="none">Ingen utgivelser denne dagen</div>'}</div></section>`;
    }
    // Detaljark (portalt, fallgruve 1): plakat, tittel, tid, chips, beskrivelse, «Spill av», «Åpne i Sonarr/Radarr»
    _mDetail(x) {
      if (!x) return;
      const h = this.hass;
      const players = Object.keys(h.states).filter((id) => id.startsWith('media_player.') && (plat(h, id) === 'plex' || /plex/.test(id)));
      const canPlay = x.kind === 'plex' || (players.length && x.date && x.date <= new Date());
      const openLbl = x.kind === 'film' ? 'Åpne i Radarr' : x.kind === 'serie' ? 'Åpne i Sonarr' : null;
      const when = x.kind === 'plex' ? (x.date ? 'Lagt til ' + dShort(x.date) : 'Nylig lagt til') : `${dayLabel(d0(x.date))}${x.allDay ? '' : ' · ' + hm(x.date)}`;
      const ov = M.overlay({ maxWidth: 480, guard: 350, css: `
        .dt{display:flex;flex-direction:column;gap:14px;padding-bottom:calc(var(--ki-nav-h, 68px) + var(--ki-nav-bottom, 8px))}
        .dtop{display:flex;gap:14px;align-items:flex-end}
        .pst{width:96px;aspect-ratio:2/3;border-radius:14px;overflow:hidden;flex:none;background:#404040;display:grid;place-items:center;color:#7f7f7f}
        .pst img{width:100%;height:100%;object-fit:cover;display:block}
        .ph{background:repeating-linear-gradient(135deg,#3a3a3a 0 10px,#404040 10px 20px)}
        .tt{font-size:22px;font-weight:600;line-height:1.2}.sub{font-size:13px;color:#afafaf;margin-top:4px}
        .chips{display:flex;flex-wrap:wrap;gap:6px}.chip{height:28px;padding:0 12px;border-radius:14px;background:#404040;font-size:12px;display:inline-flex;align-items:center;color:#c7c7c7}
        .desc{font-size:14px;line-height:1.5;color:#c7c7c7;white-space:pre-line}
        .acts{display:flex;gap:8px}.acts button{flex:1;height:52px;border-radius:26px;display:inline-flex;align-items:center;justify-content:center;gap:8px;font-size:14px;font-weight:500;background:#404040;color:#fafafa}
        .acts .pri{background:${C.accent};color:#2a1720}` ,
      html: `<div class="dt"><div class="dtop"><span class="pst ${x.poster ? '' : 'ph'}">${x.poster ? `<img src="${esc(x.poster)}" alt="">` : M.icon(x.kind === 'film' ? 'mdi:filmstrip' : 'mdi:television-classic', 32)}</span>
        <div><div class="tt">${esc(x.title)}</div><div class="sub">${esc([x.ep, x.epTitle].filter(Boolean).join(' · '))}</div><div class="sub">${esc(when)}</div></div></div>
        <div class="chips"><span class="chip">${x.kind === 'film' ? 'Film' : x.kind === 'plex' ? 'Plex' : 'Serie'}</span>${x.network ? `<span class="chip">${esc(x.network)}</span>` : ''}${x.runtime ? `<span class="chip">${esc(x.runtime)} min</span>` : ''}${x.rating ? `<span class="chip">★ ${esc(x.rating)}</span>` : ''}${x.genres ? `<span class="chip">${esc(String(x.genres).split(',').slice(0, 2).join(', '))}</span>` : ''}</div>
        ${x.desc ? `<div class="desc">${esc(x.desc)}</div>` : ''}
        <div class="acts">${canPlay && players.length ? `<button class="pri" data-d="play">${M.icon('mdi:play', 22)}Spill av</button>` : ''}${openLbl ? `<button data-d="open">${M.icon('mdi:open-in-new', 20)}${openLbl}</button>` : ''}</div></div>` });
      ov.body.addEventListener('click', (e) => {
        const b = e.target.closest && e.target.closest('[data-d]'); if (!b) return;
        M.haptic('light');
        if (b.dataset.d === 'play') { M.call(h, 'media_player', 'play_media', { entity_id: players[0], media_content_type: x.kind === 'film' ? 'movie' : 'episode', media_content_id: 'plex://' + JSON.stringify({ title: x.title, ...(x.kind === 'serie' && x.ep ? { show_name: x.title, episode_name: x.epTitle } : {}) }) }); ov.close(); }
        if (b.dataset.d === 'open') { const u = x.url || this.config[(x.kind === 'film' ? 'radarr' : 'sonarr') + '_url']; if (u) window.open(u, '_blank', 'noopener'); else { ov.close(); M.moreInfo(this, x.src); } }
      });
      this._detail = ov;
      return ov;
    }

    /* ---------------------------------------------------------- Bursdager */
    _t_bursdager() {
      const h = this.hass, c = this.config, id = srcOf(h, c, 'bday');
      const now = d0(new Date());
      let busy = false, evs = [];
      if (id) { this.s(id); const r = this._ev(id, now, addD(now, 367)); if (r == null) busy = true; evs = r || []; }
      const B = bdays(h, c, evs);
      if (!id && !B.length && !this.ui.bAdd) return this._missing('Ingen bursdagskalender', 'kilder');
      const out = [];
      this._parts('bursdager').forEach((p) => {
        if (p === 'hero') {
          const td = B.filter((b) => b.days === 0), nx = B.find((b) => b.days > 0);
          if (td.length) {
            const conf = c.birthdayToday !== false ? `<span class="conf" aria-hidden="true">${Array.from({ length: 18 }, (_, i) => `<i style="left:${(i * 53) % 100}%;background:${PAL[i % PAL.length]};animation-delay:${((i * 37) % 20) / 10}s"></i>`).join('')}</span>` : '';
            out.push(`<div class="bhero today">${conf}<span class="bic">${M.icon('mdi:cake-variant', 30)}</span><div class="grow"><b>Gratulerer, ${esc(td.map((b) => b.name).join(' og '))}!</b><span>${esc(td.map((b) => (b.age != null ? `${b.name} fyller ${b.age}` : b.name)).join(' · '))} i dag</span></div></div>`);
          } else if (nx) out.push(`<div class="bhero"><span class="bic">${M.icon('mdi:cake-variant', 30)}</span><div class="grow"><span class="lb">Neste</span><b>${esc(nx.name)}${nx.age != null ? ` fyller ${nx.age}` : ''}</b><span>${esc(DAG_L[nx.date.getDay()])} ${esc(dShort(nx.date))}</span></div><span class="bdays"><b class="num">${nx.days}</b><span>${nx.days === 1 ? 'dag' : 'dager'}</span></span></div>`);
          else out.push(`<div class="card none">${busy ? 'Henter …' : 'Ingen bursdager det neste året'}</div>`);
        }
        if (p === 'kommende') {
          out.push(this._hdr('Kommende', `<button class="add press" data-act="badd" aria-label="Legg til bursdag">${M.icon(this.ui.bAdd ? 'mdi:close' : 'mdi:plus', 22)}</button>`));
          if (this.ui.bAdd) out.push(`<div class="card bform"><input data-input="bname" value="${esc(this.ui.bName || '')}" placeholder="Navn" autocapitalize="words"><input data-input="bdate" type="date" value="${esc(this.ui.bDate || '')}"><button class="pri press" data-act="bsave">${M.icon('mdi:check', 20)}Legg til</button></div>`);
          const rest = B.filter((b) => b.days > 0 || !B.some((x) => x.days === 0) || b.days === 0).slice(0, 40);
          const byM = {};
          rest.forEach((b) => { const k = b.date.getFullYear() * 12 + b.date.getMonth(); (byM[k] = byM[k] || []).push(b); });
          out.push(Object.keys(byM).length ? Object.keys(byM).map((k) => { const L = byM[k], d = L[0].date; return `<section class="day" data-key="bm-${k}"><div class="dh">${esc(MND_L[d.getMonth()][0].toUpperCase() + MND_L[d.getMonth()].slice(1))}${d.getFullYear() !== now.getFullYear() ? ' ' + d.getFullYear() : ''}</div><div class="card evl">${L.map((b, i) => `<div class="brow"><span class="av" style="background:${PAL[(b.name.length + i) % PAL.length]}">${esc(ini(b.name))}</span><span class="grow evc"><b class="ell">${esc(b.name)}</b><span class="ell">${esc(dShort(b.date))}${b.age != null ? ` · fyller ${b.age}` : ''}</span></span><span class="pill num ${b.days === 0 ? 'on' : ''}">${esc(b.days === 0 ? 'i dag' : relDays(b.days))}</span></div>`).join('')}</div></section>`; }).join('') : `<div class="card none">${busy ? 'Henter …' : 'Ingen kommende bursdager'}</div>`);
        }
      });
      return out.join('');
    }
    async _bSave() {
      const name = String(this.ui.bName || '').trim(), date = String(this.ui.bDate || '');
      if (!name || !/^\d{4}-\d\d-\d\d$/.test(date)) { M.haptic('warning'); M.toast('Skriv navn og dato'); return; }
      const h = this.hass, id = srcOf(h, this.config, 'bday'), st = id && h.states[id];
      const bd = fromKey(date), now = d0(new Date());
      let nx = new Date(now.getFullYear(), bd.getMonth(), bd.getDate()); if (nx < now) nx = new Date(now.getFullYear() + 1, bd.getMonth(), bd.getDate());
      const canWrite = st && ((Number(st.attributes.supported_features) || 0) & 1);
      let ok = false;
      if (canWrite) {
        try {
          await h.callWS({ type: 'calendar/event/create', entity_id: id, event: { summary: name, dtstart: dk(nx), dtend: dk(addD(nx, 1)), rrule: 'FREQ=YEARLY', description: bd.getFullYear() > 1900 && bd.getFullYear() < now.getFullYear() ? 'født ' + bd.getFullYear() : '' } });
          ok = true;
        } catch (e) {
          try { await h.callService('calendar', 'create_event', { entity_id: id, summary: name, start_date: dk(nx), end_date: dk(addD(nx, 1)), description: 'født ' + bd.getFullYear() }); ok = true; } catch (e2) { ok = false; }
        }
      }
      if (!ok && M.store) { const L = (M.store.get('kalender.bursdager') || []).filter((b) => !(b.name === name && b.date === date)); L.push({ name, date }); M.store.set('kalender.bursdager', L, { now: true }); }
      EV.forEach((v, k) => { if (id && k.startsWith(id + '|')) EV.delete(k); });
      M.haptic('success'); M.toast(ok ? `${name} er lagt til i kalenderen` : `${name} er lagret (kalenderen er skrivebeskyttet)`);
      this.setUI({ bAdd: false, bName: '', bDate: '' });
    }

    /* ---------------------------------------------------------- Posten */
    _t_posten() {
      const h = this.hass, c = this.config;
      const out = [];
      this._parts('posten').forEach((p) => {
        if (p === 'posten') {
          const id = srcOf(h, c, 'post'); if (id) { this.s(id); this.s(id + '_relative'); }
          const P = postData(h, id);
          if (!P) { out.push(this._hdr('Når kommer Posten') + this._missing('Ingen Posten-sensor', 'kilder')); return; }
          const now = d0(new Date()), n = P.next ? dayDiff(now, P.next) : null, today = n === 0;
          const days = []; for (let d = now; days.length < 10; d = addD(d, 1)) if (d.getDay() !== 0 && d.getDay() !== 6) days.push(d);
          const rel = P.next ? (n === 0 ? 'I dag' : n === 1 ? 'I morgen' : n <= 6 ? `På ${DAG_L[P.next.getDay()]}` : dShort(P.next)) : '–';
          out.push(`<div class="card post" data-ent="${esc(id)}"><div class="pt"><span class="pic ${today ? 'on' : ''}">${M.icon('mdi:email', 26)}</span><div class="grow"><span class="pchip ${today ? 'on' : ''}">${today ? 'Posten kommer i dag' : 'Ikke i dag'}</span><b class="prel">${esc(rel)}</b><span class="dim">${esc(P.rel && P.rel.toLowerCase() !== rel.toLowerCase() ? P.rel : P.next ? `${DAG_L[P.next.getDay()]} ${dShort(P.next)}${n > 1 ? ' · ' + relDays(n) : ''}` : '')}</span></div></div>
            <div class="pg">${days.map((d) => { const on = P.dates.has(dk(d)); return `<span class="pd ${on ? 'on' : ''} ${dk(d) === dk(now) ? 'today' : ''}"><span>${UKE[(d.getDay() + 6) % 7]}</span><b class="num">${d.getDate()}</b></span>`; }).join('')}</div></div>`);
        }
        if (p === 'pakker') {
          const all = parcelsOf(h, c); all.forEach((x) => this.s(x.id));
          const show = this.ui.pDel ? all : all.filter((x) => x.kind !== 'levert');
          const nDel = all.filter((x) => x.kind === 'levert').length;
          out.push(this._hdr('Pakker', `<span class="meta num">${all.filter((x) => x.kind !== 'levert').length || ''}</span><button class="add press" data-act="padd" aria-label="Legg til pakke">${M.icon(this.ui.pAdd ? 'mdi:close' : 'mdi:plus', 22)}</button>`));
          if (this.ui.pAdd) out.push(`<div class="card bform"><input data-input="pnum" value="${esc(this.ui.pNum || '')}" placeholder="Sporingsnummer" autocapitalize="characters" autocorrect="off" spellcheck="false"><button class="pri press" data-act="psave">${M.icon('mdi:package-variant-plus', 20)}Spor pakken</button></div>`);
          const hasSrc = !!srcOf(h, c, 'parcel') || all.length;
          if (!hasSrc) { out.push(this._missing('Ingen pakkesporing', 'kilder')); return; }
          out.push(show.length ? `<div class="card evl pk">${show.map((x) => this._pRow(x)).join('')}</div>` : '<div class="card none">Ingen pakker på vei</div>');
          if (nDel) out.push(`<button class="more press" data-act="pdel">${this.ui.pDel ? 'Skjul leverte' : `Vis leverte (${nDel})`}</button>`);
        }
      });
      return out.join('');
    }
    _pRow(x) {
      const [lab, col, icon] = PK[x.kind], open = this.ui.pOpen === x.id;
      const sub = x.kind === 'stale' && x.idleH != null ? `Ingen oppdatering på ${x.idleH} t` : x.events[0] ? x.events[0].text : x.state;
      return `<div class="pkr ${open ? 'open' : ''}" data-key="pk-${esc(x.id)}"><button class="pkh press" data-act="popen" data-v="${esc(x.id)}" aria-expanded="${open}"><span class="pkic" style="background:${M.alpha(col, 0.2)};color:${col}">${M.icon(icon, 22)}</span><span class="grow evc"><b class="ell">${esc(x.name)}</b><span class="ell">${esc(sub)}</span></span><span class="pkst" style="color:${col}">${esc(lab)}</span>${M.icon(open ? 'mdi:chevron-up' : 'mdi:chevron-down', 20, 'color:#979797')}</button>
        ${open ? `<div class="pkb">${x.kind === 'stale' && x.idleH != null ? `<div class="warn">${M.icon('mdi:clock-alert-outline', 18)}Ingen oppdatering på ${x.idleH} t</div>` : ''}
          ${x.facts.length || x.number || x.eta ? `<div class="facts">${x.number ? `<span><i>Sporingsnummer</i><b>${esc(x.number)}</b></span>` : ''}${x.eta ? `<span><i>Forventet</i><b>${esc(dShort(x.eta))}</b></span>` : ''}${x.facts.map(([k, v]) => `<span><i>${esc(k)}</i><b>${esc(v)}</b></span>`).join('')}</div>` : ''}
          ${x.events.length ? `<div class="log">${x.events.slice(0, 8).map((e, i) => `<div class="lg ${i === 0 ? 'on' : ''}"><i></i><span class="grow"><b>${esc(e.text)}</b><span>${esc([e.t ? `${dShort(e.t)} ${hm(e.t)}` : '', e.where].filter(Boolean).join(' · '))}</span></span></div>`).join('')}</div>` : '<div class="none">Ingen hendelser ennå</div>'}
          <div class="pka">${x.home ? `<button class="pri press" data-act="phome" data-v="${esc(x.home)}">${M.icon('mdi:home-import-outline', 18)}Bestill hjemlevering</button>` : ''}<button class="press" data-act="more" data-id="${esc(x.id)}">${M.icon('mdi:information-outline', 18)}Detaljer</button></div></div>` : ''}</div>`;
    }
    async _pSave() {
      const num = String(this.ui.pNum || '').trim().replace(/\s+/g, '');
      if (num.length < 6) { M.haptic('warning'); M.toast('Skriv inn sporingsnummeret'); return; }
      const h = this.hass, S = (h.services && h.services.norwegian_parcel_tracker) || {};
      const svc = Object.keys(S).find((k) => /add|track|spor/.test(k)) || 'add_parcel';
      try { await h.callService('norwegian_parcel_tracker', svc, { tracking_number: num }); M.haptic('success'); M.toast('Pakken spores'); this.setUI({ pAdd: false, pNum: '' }); } catch (e) { M.haptic('failure'); M.toast('Kunne ikke legge til: ' + ((e && e.message) || e)); }
    }

    /* ---------------------------------------------------------- handlinger */
    onInput(name, el, e, kind) {
      if (name === 'hq') { this._ui = { ...this._ui, q: el.value }; clearTimeout(this._qT); this._qT = setTimeout(() => this.update(), kind === 'change' ? 0 : 180); return; }
      if (name === 'bname') this._ui.bName = el.value;
      if (name === 'bdate') this._ui.bDate = el.value;
      if (name === 'pnum') this._ui.pNum = el.value;
    }
    onAction(name, el, ev) {
      const d = el.dataset;
      const step = (k, v) => { const n = Number(d.d); this.setUI({ [k]: n === 0 ? 0 : (Number(this.ui[k]) || 0) + n }); };
      switch (name) {
        case 'tab': if (d.v === this.tab) return; return this.setUI({ tab: d.v, btn: 'view' });
        case 'mstep': return step('mOff');
        case 'hstep': return step('hOff');
        case 'fstep': return step('fOff');
        case 'selday': return this.setUI({ selDay: d.v });
        case 'fsel': return this.setUI({ fSel: d.v });
        case 'hseg': return this.setUI({ hSeg: d.v });
        case 'hqclr': return this.setUI({ q: '' });
        case 'hshow': { const s = fromKey(d.v), now = d0(new Date()); return this.setUI({ hSeg: 'kalender', hOff: (s.getFullYear() - now.getFullYear()) * 12 + s.getMonth() - now.getMonth() }); }
        case 'ff': return this.setUI({ ff: d.v, fmore: false });
        case 'fmore': return this.setUI({ fmore: !this.ui.fmore });
        case 'mdet': { this.__mi = null; const x = this._mItems()[Number(d.i)]; return this._mDetail(x); }
        case 'evd': { if (d.cal) M.moreInfo(this, d.cal); return; }
        case 'badd': return this.setUI({ bAdd: !this.ui.bAdd });
        case 'bsave': return this._bSave();
        case 'padd': return this.setUI({ pAdd: !this.ui.pAdd });
        case 'psave': return this._pSave();
        case 'pdel': return this.setUI({ pDel: !this.ui.pDel });
        case 'popen': return this.setUI({ pOpen: this.ui.pOpen === d.v ? null : d.v });
        case 'phome': if (d.v) window.open(d.v, '_blank', 'noopener'); return;
        default: return super.onAction(name, el, ev);
      }
    }
    afterRender() {
      const R = this.shadowRoot;
      if (M.glassDrag) R.querySelectorAll('.tabs,.seg').forEach((s) => M.glassDrag(s, { axis: 'x' }));
      // Hytta-karusellen: scroll-snap, prikkene følger (MSH.snapCarousel)
      const car = R.querySelector('.hcar');
      if (car && M.snapCarousel) M.snapCarousel(car, { dots: () => R.querySelector('.hdots'), index: () => Number(this.ui.hCar) || 0, onIndex: (i) => { if (i !== (Number(this.ui.hCar) || 0)) this.setUI({ hCar: i }); }, haptic: true });
    }
    get styles() {
      return `
        :host{display:block;width:100%}
        .wrap{display:flex;flex-direction:column;gap:var(--msh-gap,8px)}
        .pane{display:flex;flex-direction:column;gap:var(--msh-gap,8px);min-width:0}
        .top{display:flex;align-items:center;gap:8px;min-width:0}
        .tabs{flex:1;min-width:0;display:flex;gap:2px;padding:4px;border-radius:24px;background:var(--gray200,#3a3a3a);position:relative;touch-action:pan-y;overflow:hidden}
        .tabs .itab{color:var(--gray800,#afafaf);background:transparent}
        .tabs .itab.on,.tabs .ntab.on{background:${C.accent};color:#2a1720;font-weight:500}
        ${M.iconTabs.css('.tabs.itabs')}
        .tabs.itabs>.itab{min-width:30px}
        .tabs.itabs>.itab[aria-selected="true"]{padding:0 12px 0 10px}
        .tabs.names{overflow-x:auto;touch-action:pan-x}
        .ntab{flex:1 0 auto;height:40px;padding:0 14px;border-radius:20px;font-size:13px;white-space:nowrap;color:var(--gray800,#afafaf)}
        .mode{position:relative;flex:none;display:flex;align-items:center}
        .mb{width:48px;height:48px;border-radius:24px;background:var(--gray200,#3a3a3a);overflow:hidden;touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;color:var(--white,#fafafa);box-shadow:${C.edge}}
        .rail{display:flex;flex-direction:column;transition:transform .3s cubic-bezier(.34,1.4,.64,1)}
        .rail>span{width:48px;height:48px;display:grid;place-items:center;flex:none}
        .mdots{position:absolute;right:5px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:4px;pointer-events:none}
        .mdots i{width:4px;height:4px;border-radius:2px;background:var(--gray500,#696969);transition:background .2s,height .2s}
        .mdots i.on{height:10px;background:var(--gray1000,#e1e1e1)}
        .miss{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:8px;padding:22px 16px;border-radius:24px;background:var(--gray200,#3a3a3a);color:var(--gray700,#979797);font-size:14px}
        .miss .mdash{font-size:22px;color:var(--white,#fafafa)}
        .miss .mt{flex-basis:100%;text-align:center;font-size:12px}
        .sh{display:flex;align-items:center;gap:8px;min-height:40px;padding:0 4px}
        .st{flex:1;font-size:18px;font-weight:500}
        .meta{font-size:13px;color:var(--gray700,#979797)}
        .add{width:40px;height:40px;border-radius:20px;display:grid;place-items:center;background:var(--gray200,#3a3a3a);flex:none}
        .none{padding:16px;text-align:center;color:var(--gray700,#979797);font-size:13px}
        .none.sm{padding:4px 8px 8px}
        .card.none{padding:18px}
        .day{display:flex;flex-direction:column;gap:6px}
        .dh{display:flex;align-items:center;gap:8px;padding:6px 6px 0;font-size:13px;font-weight:500;color:var(--gray800,#afafaf)}
        .dn{height:20px;min-width:20px;padding:0 6px;border-radius:10px;background:var(--gray300,#404040);font-size:11px;display:inline-grid;place-items:center;color:var(--gray900,#c7c7c7)}
        .evl{padding:4px;display:flex;flex-direction:column}
        .ev,.mr,.stay,.brow{display:flex;align-items:center;gap:10px;min-height:56px;padding:6px 12px;border-radius:20px;text-align:left;width:100%}
        .ev+.ev,.mr+.mr,.ev+.mr,.stay+.stay,.brow+.brow{box-shadow:inset 0 1px 0 rgba(255,255,255,.05)}
        .evt{width:78px;flex:none;font-size:12px;color:var(--gray800,#afafaf)}
        .evd{width:8px;height:8px;border-radius:4px;flex:none}
        .evc{display:flex;flex-direction:column;gap:2px}
        .evc b{font-size:14px;font-weight:500}
        .evc>span{font-size:12px;color:var(--gray700,#979797)}
        .mcard{padding:10px 10px 12px}
        .mhd{display:flex;align-items:center;gap:6px;padding:0 0 8px}
        .mtl{display:flex;flex-direction:column;align-items:center}
        .mtl b{font-size:15px;font-weight:500}.mtl span{font-size:11px;color:var(--gray700,#979797)}
        .nb{width:40px;height:40px;border-radius:20px;display:grid;place-items:center;background:var(--gray300,#404040);flex:none}
        .chip{height:30px;padding:0 12px;border-radius:15px;background:var(--gray300,#404040);font-size:12px;display:inline-flex;align-items:center;gap:6px;flex:none}
        .mg{display:grid;grid-template-columns:22px repeat(7,minmax(0,1fr));gap:4px}
        .wd{font-size:11px;color:var(--gray600,#7f7f7f);text-align:center;padding-bottom:2px}
        .wn{font-size:10px;color:var(--gray500,#696969);display:grid;place-items:center}
        .gd{position:relative;aspect-ratio:1;min-height:34px;border-radius:12px;display:grid;place-items:center;font-size:13px;background:var(--gray300,#404040)}
        .gd.out{opacity:.35}
        .gd.today{box-shadow:inset 0 0 0 2px var(--gray1000,#e1e1e1)}
        .gd.sel{background:${C.accent};color:#2a1720;font-weight:600}
        .gd .bd{position:absolute;top:2px;right:2px;min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:var(--gray1000,#e1e1e1);color:#232323;font-style:normal;font-size:10px;font-weight:600;display:grid;place-items:center}
        .gd.sel .bd{background:#2a1720;color:#fafafa}
        .gd.hg.plan{outline:2px dashed var(--pc,#979797);outline-offset:-2px}
        .leg{display:flex;flex-wrap:wrap;gap:12px;padding:10px 4px 0;font-size:12px;color:var(--gray800,#afafaf)}
        .leg span{display:inline-flex;align-items:center;gap:6px}
        .leg i{width:10px;height:10px;border-radius:3px}
        .leg i.dash{border:1.5px dashed var(--gray700,#979797)}
        .srch{display:flex;align-items:center;gap:8px;height:48px;padding:0 6px 0 16px;border-radius:24px;background:var(--gray200,#3a3a3a)}
        .srch input{flex:1;min-width:0;height:100%;font-size:14px}
        .srch .x{width:36px;height:36px;border-radius:18px;display:grid;place-items:center;background:var(--gray300,#404040)}
        .hres{padding:4px}
        .hrh{display:flex;align-items:center;gap:8px;padding:8px 10px}
        .hrh b{font-size:14px}.hrh .num{flex:1;font-size:12px;color:var(--gray700,#979797)}
        .hcar{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;gap:0;touch-action:pan-x pan-y;overscroll-behavior-x:contain}
        .hs{flex:0 0 100%;scroll-snap-align:start;padding:0 1px}
        .hcard{position:relative;overflow:hidden;min-height:188px;border-radius:28px;padding:18px;display:flex;flex-direction:column;gap:12px;background:linear-gradient(145deg, color-mix(in srgb, var(--sc) 28%, #3a3a3a), #3a3a3a 70%);box-shadow:${C.edge}}
        .hct{display:flex;flex-direction:column;gap:4px;position:relative;z-index:1}
        .hct b{font-size:20px;font-weight:600}
        .hn{display:inline-flex;align-items:center;gap:4px;font-size:12px;color:var(--gray900,#c7c7c7)}
        .ppl{display:flex;position:relative;z-index:1}
        .av{width:34px;height:34px;border-radius:17px;display:grid;place-items:center;font-size:12px;font-weight:700;color:#232323;flex:none}
        .ppl .av{margin-left:-8px;box-shadow:0 0 0 2px #3a3a3a}.ppl .av:first-child{margin-left:0}
        .hchips{display:flex;flex-wrap:wrap;gap:6px;position:relative;z-index:1}
        .hchip{height:26px;padding:0 10px;border-radius:13px;background:rgba(0,0,0,.25);font-size:12px;display:inline-flex;align-items:center;gap:6px}
        .hchip i{width:8px;height:8px;border-radius:4px;background:var(--sc)}
        .hnum{display:flex;gap:20px;margin-top:auto;position:relative;z-index:1}
        .hnum div{display:flex;flex-direction:column}
        .hnum b{font-size:26px;font-weight:500}.hnum span{font-size:12px;color:var(--gray800,#afafaf)}
        .illu{position:absolute;right:10px;bottom:6px;width:132px;color:var(--sc);opacity:.9}
        .illu svg{width:100%;display:block}
        .hdots{margin-top:-2px}
        .seg{display:flex;gap:2px;padding:4px;border-radius:22px;background:var(--gray200,#3a3a3a);position:relative;touch-action:pan-y}
        .seg .sg{flex:1 1 0;min-width:0;height:36px;border-radius:18px;font-size:13px;color:var(--gray800,#afafaf);white-space:nowrap}
        .seg .sg.on{background:${C.accent};color:#2a1720;font-weight:500}
        .stag{display:inline-flex;align-items:center;height:18px;padding:0 7px;border-radius:9px;font-size:11px;font-weight:500;background:color-mix(in srgb, var(--sc) 22%, transparent);color:var(--sc);vertical-align:1px;margin-left:4px}
        .snt{font-size:12px;color:var(--gray800,#afafaf);flex:none}
        .snt.on{color:${C.green};font-weight:600}
        .stat{padding:14px}
        .bars{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:4px;height:140px;align-items:end}
        .bc{height:100%;display:flex;flex-direction:column;gap:4px;align-items:stretch}
        .bs{flex:1;display:flex;flex-direction:column-reverse;border-radius:6px;overflow:hidden;background:rgba(255,255,255,.04)}
        .bs i{display:block;width:100%}
        .bc span{font-size:10px;text-align:center;color:var(--gray600,#7f7f7f)}
        .tots{display:flex;flex-direction:column;gap:8px;margin-top:14px}
        .tot{display:flex;align-items:center;gap:8px;font-size:13px}
        .tot i{width:10px;height:10px;border-radius:5px}.tot b{font-size:16px;font-weight:600}
        .chips{display:flex;gap:6px;overflow-x:auto}
        .fc{height:36px;padding:0 16px;border-radius:18px;background:var(--gray200,#3a3a3a);font-size:13px;color:var(--gray900,#c7c7c7);flex:none}
        .fc.on{background:${C.accent};color:#2a1720;font-weight:500}
        .pst{width:40px;aspect-ratio:2/3;border-radius:8px;overflow:hidden;flex:none;background:var(--gray300,#404040);display:grid;place-items:center;color:var(--gray600,#7f7f7f)}
        .pst img{width:100%;height:100%;object-fit:cover;display:block}
        .pst.lg{width:84px;border-radius:14px}
        .pst.xl{width:100%;border-radius:14px}
        .ph{background:repeating-linear-gradient(135deg,#3a3a3a 0 10px,#404040 10px 20px)}
        .mt{font-size:12px;color:var(--gray800,#afafaf);flex:none}
        .hero{position:relative;display:block;width:100%;min-height:196px;border-radius:28px;overflow:hidden;text-align:left;background:var(--gray200,#3a3a3a);box-shadow:${C.edge}}
        .bdrop{position:absolute;inset:0}
        .bdrop img{width:100%;height:100%;object-fit:cover;display:block;opacity:.55}
        .bdrop::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(40,40,40,0) 0%,rgba(40,40,40,.92) 85%)}
        .hin{position:relative;display:flex;align-items:flex-end;gap:14px;padding:16px;min-height:196px}
        .hcol{display:flex;flex-direction:column;gap:4px}
        .hchips{display:flex;gap:6px}
        .mchip{height:24px;padding:0 10px;border-radius:12px;background:rgba(255,255,255,.14);font-size:11px;font-weight:600;display:inline-flex;align-items:center}
        .mchip.hl{background:${C.accent};color:#2a1720}
        .htl{font-size:20px;font-weight:600;line-height:1.2}
        .hsub{font-size:13px;color:var(--gray900,#c7c7c7)}
        .more{height:44px;border-radius:22px;background:var(--gray200,#3a3a3a);font-size:13px;font-weight:500}
        .prow{display:flex;gap:10px;overflow-x:auto;padding-bottom:2px}
        .prow .pc{flex:0 0 108px}
        .pgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:10px}
        .pc{display:flex;flex-direction:column;gap:4px;text-align:left;min-width:0}
        .pc b{font-size:12px;font-weight:500}.pc>span:last-child{font-size:11px;color:var(--gray700,#979797)}
        .bhero{position:relative;overflow:hidden;display:flex;align-items:center;gap:14px;min-height:112px;padding:18px;border-radius:28px;background:var(--gray200,#3a3a3a);box-shadow:${C.edge}}
        .bhero.today{background:linear-gradient(135deg, ${M.alpha(C.purple, 0.55)}, ${M.alpha(C.pink, 0.35)})}
        .bhero .grow{display:flex;flex-direction:column;gap:2px;position:relative;z-index:1}
        .bhero b{font-size:19px;font-weight:600}.bhero .grow>span{font-size:13px;color:var(--gray900,#c7c7c7)}
        .bhero .lb{font-size:12px;color:var(--gray700,#979797)}
        .bic{width:56px;height:56px;border-radius:28px;display:grid;place-items:center;background:${M.alpha(C.purple, 0.25)};color:${C.purple};flex:none;position:relative;z-index:1}
        .bhero.today .bic{background:rgba(255,255,255,.2);color:#fafafa}
        .bdays{display:flex;flex-direction:column;align-items:center;flex:none}.bdays b{font-size:28px;font-weight:500}.bdays span{font-size:11px;color:var(--gray700,#979797)}
        .conf{position:absolute;inset:0;pointer-events:none}
        .conf i{position:absolute;top:-10px;width:7px;height:12px;border-radius:2px;animation:kconf 3.2s linear infinite}
        @keyframes kconf{0%{transform:translateY(0) rotate(0);opacity:1}100%{transform:translateY(140px) rotate(540deg);opacity:0}}
        @media (prefers-reduced-motion: reduce){.conf i{animation:none;opacity:.6;top:auto;bottom:10px}}
        .pill{height:26px;padding:0 10px;border-radius:13px;background:var(--gray300,#404040);font-size:12px;display:inline-flex;align-items:center;flex:none;color:var(--gray900,#c7c7c7)}
        .pill.on{background:${C.accent};color:#2a1720;font-weight:600}
        .bform{display:flex;flex-wrap:wrap;gap:8px;padding:10px}
        .bform input{flex:1 1 140px;min-width:0;height:44px;border-radius:22px;background:var(--gray300,#404040);padding:0 16px;font-size:14px;color-scheme:dark}
        .bform .pri,.pka .pri{height:44px;padding:0 16px;border-radius:22px;background:${C.accent};color:#2a1720;font-weight:600;display:inline-flex;align-items:center;gap:6px;font-size:13px}
        .post{padding:16px;display:flex;flex-direction:column;gap:14px}
        .pt{display:flex;align-items:center;gap:14px}
        .pic{width:60px;height:60px;border-radius:30px;display:grid;place-items:center;background:rgba(250,251,252,.1);flex:none}
        .pic.on{background:${C.red};color:#232323}
        .pt .grow{display:flex;flex-direction:column;gap:4px;align-items:flex-start}
        .pchip{height:24px;padding:0 10px;border-radius:12px;font-size:11px;font-weight:600;display:inline-flex;align-items:center;background:var(--gray300,#404040);color:var(--gray900,#c7c7c7)}
        .pchip.on{background:${M.alpha(C.red, 0.25)};color:${C.red}}
        .prel{font-size:22px;font-weight:500}
        .pg{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px}
        .pd{display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 0;border-radius:14px;background:var(--gray300,#404040);font-size:11px;color:var(--gray700,#979797)}
        .pd b{font-size:15px;font-weight:500;color:var(--gray900,#c7c7c7)}
        .pd.on{background:${M.alpha(C.red, 0.22)};color:${C.red}}.pd.on b{color:${C.red}}
        .pd.today{box-shadow:inset 0 0 0 2px var(--gray1000,#e1e1e1)}
        .pkr{border-radius:20px}
        .pkr.open{background:var(--gray300,#404040)}
        .pkr+.pkr{box-shadow:inset 0 1px 0 rgba(255,255,255,.05)}
        .pkh{display:flex;align-items:center;gap:10px;width:100%;min-height:60px;padding:6px 10px;text-align:left}
        .pkic{width:44px;height:44px;border-radius:22px;display:grid;place-items:center;flex:none}
        .pkst{font-size:12px;font-weight:600;flex:none}
        .pkb{display:flex;flex-direction:column;gap:10px;padding:0 12px 12px}
        .warn{display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:14px;background:${M.alpha(C.orange, 0.16)};color:${C.orange};font-size:13px}
        .facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
        .facts span{display:flex;flex-direction:column;padding:8px 12px;border-radius:14px;background:var(--gray200,#3a3a3a)}
        .facts i{font-style:normal;font-size:11px;color:var(--gray700,#979797)}.facts b{font-size:13px;font-weight:500;overflow-wrap:anywhere}
        .log{display:flex;flex-direction:column}
        .lg{display:flex;gap:10px;padding:6px 2px;position:relative}
        .lg>i{width:10px;height:10px;border-radius:5px;background:var(--gray500,#696969);margin-top:4px;flex:none}
        .lg.on>i{background:${C.blue}}
        .lg .grow{display:flex;flex-direction:column}.lg b{font-size:13px;font-weight:500}.lg span span{font-size:11px;color:var(--gray700,#979797)}
        .pka{display:flex;gap:8px;flex-wrap:wrap}
        .pka button:not(.pri){height:44px;padding:0 16px;border-radius:22px;background:var(--gray200,#3a3a3a);display:inline-flex;align-items:center;gap:6px;font-size:13px}
      `;
    }
  }
  M.POPUP_CARDS = M.POPUP_CARDS || [];
  if (!M.POPUP_CARDS.includes('msh-kalender-card')) M.POPUP_CARDS.push('msh-kalender-card'); // «Mellomrom» ligger i Visning-fanen
  M.REF_POPUPS = M.REF_POPUPS || {};
  if (!M.REF_POPUPS[HASH]) M.REF_POPUPS[HASH] = { nav: 'kalender' };
  M.kalender = { parseQuery, hyttaData, parcelsOf, postData, bdays, cands, legacyOf, monthGrid, weekNo };
  M.define('msh-kalender-card', Kalender, 'MSH Kalender', 'Kalender-popup (#kalender): kalendere, hyttebesøk, Sonarr/Radarr/Plex, bursdager, Posten og pakker.');
})();
