/* KI MSH · Kalender (#kalender, msh-kalender-card) – fiks 23.8, etter «Kalender v2.dc.html».
 * Étt kort i Bubble-popupen #kalender (mal A). Erstatter den importerte #kalender-popupen fra 15.5 (ki-tabs-card,
 * ki-hytte-card, ki-lansering-card, ki-kalender-card, ki-post-card, ki-bursdag-pro-card): strategien genererer
 * #kalender, kildene fra de gamle kortene migreres til `src`/`calendars` (MSH.kalenderExtra), og den importerte
 * popupen vises som «Erstattet av Kalender» i Egne popups (MSH.POPUP_SUPERSEDE → 04-strategy/28-popup-editor).
 *
 * Topp: fane-pille (Kalender · Hytta · Framover · Bursdager · Posten, MSH.iconTabs, Liquid Glass-drag) + 48×48
 *   modusknapp. Kalender/Framover: to ikoner på en loddrett skinne: trykk = Liste/Måned, hold 480 ms = «Vis kalendere»
 *   (bare Kalender, portalt), sveip opp/ned > 16 px = vipp til tannhjul (trykk → «Tilpass kalender»), to prikker = modus.
 *   36.6: Hytta/Bursdager/Posten: KUN tannhjul (trykk → Tilpass), ingen vipp/sveip/hold, ingen prikker.
 * 36.6: Startvisning (`default_view: list|month`, gammel `defaultView: liste|maned`) gjelder Kalender og Framover ved
 *   hver åpning; knappen bytter bare visningen i økten (lagres ikke). Framover: filteret (Alle/Serier/Filmer/Plex) gjelder
 *   også i måned (merker + dagspanel), chipsene står alltid rett under fanelinjen. Posten: dagene er knapper (ui.pSel).
 * 36.7: «Tilpass kalender» = helt dekkende ark (--ki-popup/#282828), top 52, maks 440, radius 38, bakteppe .5 + blur 4.
 * Faner og deler (section_order/section_hidden per fane, tab_order/tab_hidden):
 *   kalender: main · hytta: sok, steder, seg · framover: filter, hero, kommende, plex · bursdager: hero, kommende ·
 *   posten: kort, postnord (av/på), pakker   (46: gamle `posten` = `kort`; `postnord` står alltid rett etter kortet)
 * Config:
 *   src: { hytta, bday, post, parcel, postnord, sonarr, radarr, plex }   # overstyring (tom = automatisk, 'none' = av;
 *     `sources: { postnord }` leses også) · postnord_outgoing: true = «Vis pakker jeg sender» (standard skjult)
 *   calendars: [{ entity, name?, color? }]  # tom = alle calendar.* som ikke er kilder
 *   calendars_hidden: [id …] · calendar_colors: { id: farge }
 *   startTab · defaultView (liste|maned; `default_view: list|month` leses også) · valgt visning huskes per bruker
 *     (ki-store kalender.view.<kalender|framover>) · days (7|14|30) · showPlex · birthdayToday · tab_labels (icon|name)
 *   gap · pad_top · pad_bottom  (Mellomrom; `spacing: { gap, top, bottom }` leses også)
 * Data (fallgruve 8): hentes når #kalender er åpen, mellomlagres 5 min. Kalendere via
 *   hass.callApi('GET', 'calendars/<id>?start&end') (samme som calendar.get_events), ±40 dager.
 * Ingen mock-data: mangler en kilde → «– · Velg entitet».
 * Fiks 40 · PostNord (ha-postnord) i Posten → Pakker, side om side med Norwegian Parcel Tracker:
 *   kilde = entitetsregisteret (platform postnord), alle `*_incoming_parcels` (sporingskode-hub + kontoer) slås sammen
 *   med `*_awaiting_pickup`/`*_delivered_parcels` (og `*_outgoing_parcels` når postnord_outgoing). Statusmapping PNS,
 *   bærer-chip «PostNord», meta-linje, fakta, «Åpne i PostNord», «+» → postnord.track_parcel for PostNord-koder,
 *   «Slutt å spore» → postnord.untrack_parcel (ikke konto-pakker), «Oppdater» → button.press på PostNord-knappen,
 *   hendelsene postnord_parcel_* mens popupen er åpen (raden oppdateres alene), blå prikk i «Når kommer Posten» fra
 *   PostNord-kalenderen. Uten PostNord er alt som før.
 * Fiks 42 · alle PostNord-entitetene (konto-oppføringer med norske entity_id-er):
 *   rolle = registerets translation_key → unique_id-suffiks → entity_id-suffiks (engelsk eller norsk), gruppert per
 *   enhet/config entry («PostNord (<konto>)»); overstyring per rolle i `sources.postnord.<rolle>` (`src.postnord.<rolle>`
 *   leses også), `postnord_view: account|merged`. 42.1 blå prikk 7 px øverst til høyre + forklaring + leveringsrad for
 *   valgt dag (kalender-hendelser for de 14 dagene som vises); 42.2 (erstattet av 46); 42.3 én rad per `…_pakke_<kode>`, utgående med
 *   «PostNord · Utgående», filter-chip i Pakker-headeren, entity_registry_updated mens popupen er åpen.
 * Fiks 46 · «Når kommer Posten» + PostNord = ÉTT kompakt kort (padding 16, gap 12): topp (tittel 12px med rødt
 *   mail-ikon, «I morgen» 26/300, dato 12px, chip øverst til høyre) → rutenett med blå PostNord-prikker → leveringsrad
 *   (pn_row: valgt = bare valgt dag med levering, alltid = også neste levering uten valgt dag) → tall-chips
 *   Inn/Hentes/Levert/Ut (summert over kontoene, trykk = filter på Pakker) + oppdater (button.press på alle kontoenes
 *   knapper). Delen `postnord` («PostNord-tall», øye) av → chips, oppdater, prikker og leveringsrad skjules.
 *   Det egne PostNord-kortet (42.2), forklaringen og `postnord_view` er fjernet (gammel config tolereres).
 */
(function () {
  const M = window.MSH;
  if (!M || customElements.get('msh-kalender-card')) return;
  const esc = M.esc, C = M.C;
  const HASH = '#kalender';
  const TTL = 300000, DAY = 86400000;
  const TABS = [['kalender', 'Kalender', 'mdi:calendar-month'], ['hytta', 'Hytta', 'mdi:home-roof'], ['framover', 'Framover', 'mdi:movie'], ['bursdager', 'Bursdager', 'mdi:cake-variant'], ['posten', 'Posten', 'mdi:email']];
  const TV = (k, n) => (M.tabH ? M.tabH.v(k, n) : n + 'px'); // 33.4: fanehøyde-variabler (05-tab-bar.js)
  const TABL = Object.fromEntries(TABS.map((t) => [t[0], t]));
  const PARTS = {
    kalender: [['main', 'Kalender']],
    hytta: [['sok', 'Søk'], ['steder', 'Steder'], ['seg', 'Kalender/Opphold/Statistikk']],
    framover: [['filter', 'Filter'], ['hero', 'Neste utgivelse'], ['kommende', 'Kommende'], ['plex', 'Nylig i Plex']],
    bursdager: [['hero', 'Neste bursdag'], ['kommende', 'Kommende']],
    posten: [['kort', 'Når kommer Posten'], ['postnord', 'PostNord-tall'], ['pakker', 'Pakker']], // 46: PostNord-tall = av/på for PostNord i kortet
  };
  const SRC = [
    ['hytta', 'Hyttebesøk', 'mdi:home-roof', C.green],
    ['bday', 'Bursdager', 'mdi:cake-variant', C.purple],
    ['post', 'Når kommer Posten', 'mdi:email', C.red],
    ['parcel', 'Pakkesporing', 'mdi:package-variant', C.orange],
    ['postnord', 'PostNord', 'mdi:package-variant', C.blue], // Fiks 40 (package_2)
    ['sonarr', 'Sonarr', 'mdi:television-classic', C.blue],
    ['radarr', 'Radarr', 'mdi:filmstrip', C.yellow],
    ['plex', 'Plex', 'mdi:plex', C.orange],
  ];
  // Fiks 34/35 · tema: gjennomsiktig hvit/svart (regel 3/4), aksent som tekst/ikon (pkt. 6) og tone-bakgrunn (pkt. 5); mørk = uendret
  const WA = (a) => (M.theme ? M.theme.whiteA(a) : `rgba(255,255,255,${a})`), BA = (a) => (M.theme ? M.theme.blackA(a) : `rgba(0,0,0,${a})`); // ki-hex-ok: reserve uten MSH.theme
  const AT = (c) => { const r = M.theme && M.theme.accentText ? M.theme.accentText(c) : c; return /^color-mix/.test(r) ? c : r; }; // ukjente farger beholdes
  const TONE = (c, a) => (M.theme && M.theme.tone ? M.theme.tone(c, undefined, a).bg : M.alpha(c, a));
  const PAL = [C.blue, C.green, C.orange, C.purple, C.yellow, C.pink, C.red, C.lime, C.lightBlue];
  const MND = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des'];
  const MND_L = ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember'];
  const DAG_L = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag'];
  const UKE = ['ma', 'ti', 'on', 'to', 'fr', 'lø', 'sø'];
  const UKE1 = ['M', 'T', 'O', 'T', 'F', 'L', 'S'];
  // Fiks 24.1: visning list|month (config default_view, ki-store kalender.view.<fane>) ↔ intern liste|maned
  const normView = (v) => (v === 'month' || v === 'maned' ? 'maned' : v === 'list' || v === 'liste' ? 'liste' : null);
  // 36.6: lagret startvisning – `default_view` (list|month) vinner, ellers gamle `defaultView` (liste|maned)
  const startView = (c) => normView((c || {}).default_view) || normView((c || {}).defaultView) || 'liste';
  const FILTERS = [['alle', 'Alle'], ['serier', 'Serier'], ['filmer', 'Filmer'], ['plex', 'Plex']];
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
  // Fiks 40/42 · PostNord-rollene. Rollen avgjøres av registerets translation_key (ha-postnord: incoming_parcels,
  // awaiting_pickup, delivered_parcels, next_delivery, parcel, last_update, outgoing_parcels, outgoing_delivered_parcels,
  // refresh, deliveries), ellers unique_id-suffikset (<entry_id>_<rolle|strekkode>), ellers entity_id-suffikset –
  // engelsk (sporingskode-hub/eldre) eller norsk (konto-oppføring på norsk: …_innkommende_pakker, …_pakke_<kode>).
  const PN_ROLES = ['incoming_parcels', 'awaiting_pickup', 'delivered_parcels', 'next_delivery', 'last_update', 'outgoing_parcels', 'outgoing_delivered_parcels', 'refresh', 'deliveries'];
  const PN_RDOM = { refresh: 'button', deliveries: 'calendar' }; // øvrige roller: sensor
  const PN_ALIAS = { last_successful_update: 'last_update' };
  const PN_RX = [ // lengste/mest spesifikke først (utgående leverte før leverte)
    ['outgoing_delivered_parcels', /_(outgoing_delivered_parcels|utgaende_leverte_pakker)(_\d+)?$/],
    ['outgoing_parcels', /_(outgoing_parcels|utgaende_pakker)(_\d+)?$/],
    ['incoming_parcels', /_(incoming_parcels|innkommende_pakker)(_\d+)?$/],
    ['awaiting_pickup', /_(awaiting_pickup|klar_for_henting)(_\d+)?$/],
    ['delivered_parcels', /_(delivered_parcels|leverte_pakker)(_\d+)?$/],
    ['next_delivery', /_(next_delivery|neste_levering)(_\d+)?$/],
    ['last_update', /_(last_successful_update|last_update|siste_vellykkede_oppdatering)(_\d+)?$/],
    ['refresh', /_(refresh|oppdater)(_\d+)?$/],
    ['deliveries', /_(deliveries|leveringer)(_\d+)?$/],
  ];
  const PN_PRX = /_(?:pakke|parcel)_([a-z0-9]+)$/;
  const PN_SUF = /_(incoming_parcels|innkommende_pakker|awaiting_pickup|klar_for_henting|delivered_parcels|leverte_pakker|outgoing_parcels|utgaende_pakker|outgoing_delivered_parcels|utgaende_leverte_pakker)(_\d+)?$/;
  // objekt-ID uten rolle-suffiks (gruppering når registeret mangler enhet/oppføring)
  const pnPfx = (id) => { let o = String(id || '').replace(/^[a-z_]+\./, ''); const r = PN_RX.find((x) => x[1].test(o)); o = r ? o.replace(r[1], '') : o.replace(PN_PRX, ''); return o; };
  function pnRole(h, id) {
    if (!h || !id) return null;
    const dom = id.split('.')[0], e = (h.entities || {})[id] || {}, st = h.states[id], a = (st && st.attributes) || {};
    const okDom = (r) => (PN_RDOM[r] || 'sensor') === dom;
    const bc = (x) => String(a.barcode || x || '').toUpperCase();
    let tk = e.translation_key; tk = PN_ALIAS[tk] || tk;
    if (tk === 'parcel' && dom === 'sensor') { const m = PN_PRX.exec(id); return { role: 'parcel', code: bc(m && m[1]) }; }
    if (tk && PN_ROLES.includes(tk)) return okDom(tk) ? { role: tk } : null;
    const uid = String(e.unique_id || '');
    if (uid) {
      const ce = e.config_entry_id, rest = ce && uid.startsWith(ce + '_') ? uid.slice(ce.length + 1) : null;
      const r = rest ? PN_ALIAS[rest] || rest : PN_ROLES.find((x) => uid.endsWith('_' + x)) || (uid.endsWith('_last_successful_update') ? 'last_update' : null);
      if (r && PN_ROLES.includes(r)) return okDom(r) ? { role: r } : null;
      if (rest && dom === 'sensor' && /^[A-Za-z0-9]+$/.test(rest)) return { role: 'parcel', code: bc(rest) };
    }
    const obj = id.slice(dom.length + 1), r = PN_RX.find((x) => x[1].test(obj));
    if (r) return okDom(r[0]) ? { role: r[0] } : null;
    const m = dom === 'sensor' ? PN_PRX.exec(obj) : null;
    if (m) return { role: 'parcel', code: bc(m[1]) };
    return null;
  }
  function cands(h, k) {
    if (!h) return [];
    const ids = Object.keys(h.states).sort();
    const dom = (d) => ids.filter((id) => id.startsWith(d + '.'));
    const A = (id) => (h.states[id] || {}).attributes || {};
    if (k === 'hytta') return uniq([...dom('sensor').filter((id) => A(id).integrasjon === 'ki_hyttebesok' && A(id).ki_type === 'oversikt'), ...dom('calendar').filter((id) => /hytt/.test(low(h, id))), ...dom('sensor').filter((id) => /_oversikt$/.test(id) && A(id).sted)]);
    if (k === 'bday') return dom('calendar').filter((id) => /birthday|bursdag|fodsel|fødsel/.test(low(h, id)));
    if (k === 'post') return dom('sensor').filter((id) => /nar_kommer_posten|posten|postal|mail_delivery/.test(id) && !/relati/.test(id)).sort((a, b) => (pDate((h.states[b] || {}).state) ? 1 : 0) - (pDate((h.states[a] || {}).state) ? 1 : 0) || (/_next$/.test(b) ? 1 : 0) - (/_next$/.test(a) ? 1 : 0));
    if (k === 'parcel') return uniq([...dom('sensor').filter((id) => plat(h, id) === 'norwegian_parcel_tracker'), ...dom('sensor').filter((id) => /parcel|pakke|sporing/.test(id) && plat(h, id) !== 'postnord' && !PN_SUF.test(id))]);
    // Fiks 40: PostNord – registeret (platform postnord) først, sporingskode-hub før kontoene
    // Fiks 40/42: PostNord – innkommende-sensoren per konto (registeret/rollene), sporingskode-hub før kontoene
    if (k === 'postnord') return pnAccounts(h, {}).map((a) => a.roles.incoming_parcels).filter(Boolean);
    if (k === 'sonarr') return [...dom('calendar').filter((id) => /sonarr/.test(low(h, id))), ...dom('sensor').filter((id) => /sonarr/.test(id) && /upcoming|kommende|calendar/.test(id))];
    if (k === 'radarr') return [...dom('calendar').filter((id) => /radarr/.test(low(h, id))), ...dom('sensor').filter((id) => /radarr/.test(id) && /upcoming|kommende|calendar/.test(id))];
    if (k === 'plex') return dom('sensor').filter((id) => /plex/.test(id) && /recent|nylig|added/.test(id));
    return [];
  }
  const autoSrc = (h, k) => cands(h, k)[0] || null;
  const srcOf = (h, c, k) => { const v = k === 'postnord' ? pnStr(c) || (pnOvr(c).incoming_parcels || null) : (c.src || {})[k]; if (v === 'none') return null; return v || autoSrc(h, k); };
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
    const ids = Object.keys(h.states).filter((id) => id.startsWith('sensor.') && plat(h, id) !== 'postnord' && (plat(h, id) === 'norwegian_parcel_tracker' || (h.states[id].attributes || {}).tracking_number) && (/_status$/.test(id) || (h.states[id].attributes || {}).tracking_number));
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
  const PK = { klar: ['Klar til henting', C.green, 'mdi:package-variant-closed-check'], transport: ['På vei', C.blue, 'mdi:truck-delivery'], stale: ['Ingen oppdatering', C.orange, 'mdi:clock-alert-outline'], levert: ['Levert', 'var(--ki-text-3, var(--gray600, #7f7f7f))', 'mdi:package-check'] };

  /* ------------------------------------------------------------ PostNord (Fiks 40) */
  // Kanonisk status → [design-type, farge, ikon, tekst]. design-type: out (ute for levering) · klar · transport · stale (avvik) · levert
  const PN_GRAY = 'var(--ki-text-3, var(--gray600, #7f7f7f))';
  const PNS = {
    registered: ['transport', C.blue, 'mdi:truck', 'Registrert'],
    in_transit: ['transport', C.blue, 'mdi:truck', 'Under transport'],
    out_for_delivery: ['out', C.yellow, 'mdi:truck', 'Ute for levering'],
    at_pickup_point: ['klar', C.green, 'mdi:archive', 'Klar til henting'],
    delivered: ['levert', PN_GRAY, 'mdi:check', 'Levert'],
    returning: ['stale', C.orange, 'mdi:clock-outline', 'Returneres til avsender'],
    problem: ['stale', C.red, 'mdi:alert-circle', 'Avvik'],
    unknown: ['transport', PN_GRAY, 'mdi:truck', 'Ikke skannet ennå'],
  };
  const PN_EVENTS = ['postnord_parcel_status_changed', 'postnord_parcel_delivered', 'postnord_parcel_delivery_time_changed'];
  const PN_SETUP = 'Sett opp PostNord (sporingskoder) i Innstillinger';
  const PN_RANK = { out: 0, klar: 1, transport: 2, stale: 3, levert: 4 }; // 40.3: ute → klar → transport → avvik → levert
  const PN_ORDER = ['incoming_parcels', 'awaiting_pickup', 'delivered_parcels', 'outgoing_parcels', 'outgoing_delivered_parcels', 'parcel'];
  const str = (v) => (v == null ? '' : typeof v === 'object' ? String(v.name || v.display_name || v.title || '') : String(v)).trim();
  const pnCode = (p) => str(p.barcode || p.tracking_code || p.tracking_number || p.shipment_id || p.shipmentId || p.code || p.id).toUpperCase();
  // Ser ut som en PostNord-kode: slutter på SE/DK/FI, eller 11–17 sifre
  const pnLooks = (code) => { const s = String(code || '').trim().replace(/\s+/g, '').toUpperCase(); return /^[A-Z0-9]{6,}(SE|DK|FI)$/.test(s) || /^\d{11,17}$/.test(s); };
  // Config: `src.postnord` / `sources.postnord` = entitet (innkommende, Fiks 40) eller 'none' (av);
  // Fiks 42: `sources.postnord.<rolle>` (også `src.postnord.<rolle>`) = overstyring per rolle ('none' = rollen av).
  const pnStr = (c) => { const a = ((c || {}).src || {}).postnord, b = ((c || {}).sources || {}).postnord; return typeof a === 'string' && a ? a : typeof b === 'string' && b ? b : null; };
  function pnOvr(c) {
    const o = {};
    [((c || {}).sources || {}).postnord, ((c || {}).src || {}).postnord].forEach((v) => { if (v && typeof v === 'object') Object.keys(v).forEach((k) => { const r = PN_ALIAS[k] || k; if (PN_ROLES.includes(r) && typeof v[k] === 'string' && v[k] && o[r] == null) o[r] = v[k]; }); });
    return o;
  }
  // Fiks 42: PostNord-kontoene (én per config entry/enhet «PostNord (<konto>)»; sporingskode-hub = «PostNord»).
  // → [{ key, name, hub, roles: { <rolle>: entity_id }, parcels: [{ id, code }] }], hub først.
  const pnGrp = (h, id) => { const e = (h.entities || {})[id] || {}; return e.device_id ? 'd:' + e.device_id : e.config_entry_id ? 'c:' + e.config_entry_id : 'p:' + pnPfx(id); };
  function pnAccounts(h, c) {
    if (!h) return [];
    c = c || {};
    const s = pnStr(c);
    if (s === 'none') return [];
    const ids = uniq([...Object.keys(h.entities || {}).filter((id) => plat(h, id) === 'postnord'), ...Object.keys(h.states).filter((id) => /^sensor\.postnord_/.test(id) && Array.isArray(((h.states[id] || {}).attributes || {}).parcels))]).filter((id) => h.states[id]).sort();
    const by = new Map();
    const acc = (g, id) => {
      if (by.has(g)) return by.get(g);
      const e = (h.entities || {})[id] || {}, dev = e.device_id && h.devices ? h.devices[e.device_id] : null, dn = dev ? String(dev.name_by_user || dev.name || '') : '';
      const m = /\(([^)]+)\)\s*$/.exec(dn), pf = pnPfx(id);
      const hub = dn ? !m : /^postnord(_\d+)?$/.test(pf);
      const name = m ? m[1].trim() : hub ? 'Sporingskoder' : pf.replace(/^postnord_?/, '') || 'PostNord';
      const A = { key: g, name, hub, roles: {}, parcels: [] }; by.set(g, A); return A;
    };
    ids.forEach((id) => {
      const r = pnRole(h, id); if (!r) return;
      const A = acc(pnGrp(h, id), id);
      if (r.role === 'parcel') { if (r.code) A.parcels.push({ id, code: r.code }); } else if (!A.roles[r.role]) A.roles[r.role] = id;
    });
    let L = [...by.values()].filter((A) => Object.keys(A.roles).length || A.parcels.length);
    // Fiks 40: én entitet (innkommende) valgt → bare den kontoen
    if (s) { const g = pnGrp(h, s), A = L.find((x) => x.key === g); L = A ? [A] : h.states[s] ? [{ key: 'o:' + s, name: M.name(h, s), hub: false, roles: { incoming_parcels: s }, parcels: [] }] : []; if (A) A.roles.incoming_parcels = s; }
    // Fiks 42: overstyring per rolle – til kontoen entiteten hører til, ellers den første
    const ov = pnOvr(c);
    Object.keys(ov).forEach((r) => {
      const v = ov[r];
      if (v === 'none') { L.forEach((A) => { delete A.roles[r]; }); return; }
      if (!h.states[v]) return;
      const g = pnGrp(h, v), A = L.find((x) => x.key === g) || L[0];
      if (A) A.roles[r] = v; else L.push({ key: g, name: M.name(h, v), hub: false, roles: { [r]: v }, parcels: [] });
    });
    return L.sort((a, b) => (b.hub ? 1 : 0) - (a.hub ? 1 : 0) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  }
  // Alle PostNord-sensorene med pakker (oppsummeringer + én per pakke), i rekkefølge
  function pnSensors(h, c) {
    const out = [];
    pnAccounts(h, c).forEach((A) => { PN_ORDER.forEach((r) => { if (r === 'parcel') A.parcels.forEach((p) => out.push(p.id)); else if (A.roles[r]) out.push(A.roles[r]); }); });
    return uniq(out);
  }
  const pnPresent = (h) => !!h && (Object.keys(h.entities || {}).some((id) => plat(h, id) === 'postnord') || !!(h.services && h.services.postnord));
  const DAG_S = ['Søn', 'Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør'];
  const dayWord = (d) => { const n = dayDiff(new Date(), d); if (n === 0) return 'I dag'; if (n === 1) return 'I morgen'; if (n === -1) return 'I går'; const b = `${DAG_L[d.getDay()]} ${dShort(d)}`; return b[0].toUpperCase() + b.slice(1); };
  const tShort = (d) => (d.getMinutes() ? hm(d) : String(d.getHours()));
  const hasT = (d) => !!(d && (d.getHours() || d.getMinutes()));
  function pnWin(f, t) {
    if (!f && !t) return '';
    const a = f || t, day = dayWord(a);
    if (f && t && hasT(f) && dk(f) === dk(t)) return `${day} ${tShort(f)}–${tShort(t)}`;
    return hasT(a) ? `${day} ${tShort(a)}` : day;
  }
  const pnWeight = (w) => { if (w == null || w === '') return ''; if (typeof w === 'number' || /^\d+(\.\d+)?$/.test(String(w))) return String(Math.round(Number(w) * 100) / 100).replace('.', ',') + ' kg'; return str(w); };
  function pnItem(key, e) {
    const p = e.p || {}, code = pnCode(p);
    let s = String(p.status || '').toLowerCase().replace(/[\s-]+/g, '_');
    if (!PNS[s]) s = p.delivered === true ? 'delivered' : p.pickup === true ? 'at_pickup_point' : 'unknown';
    const [kind, col, icon, label] = PNS[s];
    const raw = str(p.raw_status || p.status_text || p.statusText || p.status_description);
    const sender = str(p.sender || p.sender_name || p.consignor), receiver = str(p.receiver || p.recipient || p.consignee);
    const method = str(p.delivery_method || p.service || p.service_name || p.product || p.delivery_type);
    const pickup = str(p.pickup_point || p.pickup_location || p.service_point || p.pickup_point_name);
    const win = p.delivery_window && typeof p.delivery_window === 'object' ? p.delivery_window : {};
    const from = pDate(p.planned_from || p.estimated_delivery_from || p.expected_from || win.from || win.start || p.estimated_delivery || p.eta);
    const to = pDate(p.planned_to || p.estimated_delivery_to || p.expected_to || win.to || win.end);
    const dAt = pDate(p.delivered_at || p.delivery_time);
    const hist = Array.isArray(p.history) ? p.history : Array.isArray(p.events) ? p.events : [];
    let events = hist.filter((x) => x && typeof x === 'object').map((x) => ({ t: pDate(x.timestamp || x.time || x.event_time || x.eventTime || x.date), text: str(x.raw_status || x.description || x.eventDescription || x.text || (PNS[x.status] || [])[3]), where: str(x.location || x.place || x.city) })).filter((x) => x.text).sort((x, y) => (y.t || 0) - (x.t || 0));
    if (!events.length && (raw || label)) events = [{ t: pDate(p.last_event_time || p.updated_at || p.last_update || p.status_time || p.timestamp) || dAt, text: raw || label, where: '' }];
    const out = e.dir === 'out';
    // 42.3: navn = avsender fra attributtene, ellers «Pakke <kode>» (utgående: «Pakke <kode>», mottakeren står i meta)
    const name = str(p.name || p.title || p.description) || (out ? '' : sender) || (code ? `Pakke ${code}` : 'PostNord-pakke');
    const est = pnWin(from, to);
    let meta = kind === 'klar' && pickup ? `Hentes på ${pickup}` : kind === 'levert' ? raw || label : (kind === 'out' || kind === 'transport') && est ? `Estimert: ${est}` : raw || label;
    if (kind === 'levert' && dAt) meta = 'Levert ' + (dayDiff(new Date(), dAt) >= -1 ? dayWord(dAt).toLowerCase() : `${DAG_L[dAt.getDay()]} ${dShort(dAt)}`) + (hasT(dAt) ? ' ' + hm(dAt) : '');
    // 42.3: utgående – «Til <mottaker> · estimert <dato>»
    if (out) { const ed = from ? (dayDiff(new Date(), from) === 0 ? 'i dag' : dayDiff(new Date(), from) === 1 ? 'i morgen' : `${DAG_S[from.getDay()].toLowerCase()} ${dShort(from)}`) : ''; meta = `Til ${receiver || '–'} · ${kind !== 'levert' && ed ? 'estimert ' + ed : meta}`; }
    return { id: key, pn: true, code, status: s, kind, col, icon: out ? 'mdi:inbox-arrow-up' : icon, label, raw, meta, name, method, from, to, sender, url: str(p.url || p.tracking_url || p.link || p.deep_link), events, account: !!e.account, dir: e.dir, sensor: e.psensor || e.sensor, acct: e.acct || null,
      chip: out ? 'PostNord · Utgående' : 'PostNord',
      facts: [['Leveringsmåte', method], ['Avsender', sender], ...(out ? [['Mottaker', receiver]] : []), ['Vekt', pnWeight(p.weight != null ? p.weight : p.weight_kg)], ['Sporingsnummer', code]].filter((f) => f[1]) };
  }
  // Alle PostNord-pakker (kontoer slått sammen, duplikater per sporingskode). live = Map(nøkkel → { p, t }) fra hendelsene.
  // opts.out: ta med utgående også når «Vis pakker jeg sender» er av (filteret «Utgående», 42.2).
  const PN_SUM = [['incoming_parcels', 'in'], ['awaiting_pickup', 'in'], ['delivered_parcels', 'in'], ['outgoing_parcels', 'out'], ['outgoing_delivered_parcels', 'out']];
  function pnParcels(h, c, live, opts) {
    if (!h) return [];
    c = c || {};
    const showOut = !!c.postnord_outgoing || !!(opts && opts.out);
    const by = new Map();
    const put = (p, id, dir, A, isParcel, tU) => {
      if (!p || typeof p !== 'object') return;
      const code = pnCode(p); if (!code) return;
      const key = 'pn:' + code, cur = by.get(key);
      const isAcct = !A.hub || p.source === 'account' || p.account === true || p.is_account === true;
      if (!cur) by.set(key, { p: { ...p }, sensor: isParcel ? null : id, psensor: isParcel ? id : null, dir, account: isAcct, acct: A.key, tU });
      else { Object.keys(p).forEach((f) => { if (cur.p[f] == null || cur.p[f] === '') cur.p[f] = p[f]; }); cur.account = cur.account || isAcct; cur.tU = Math.max(cur.tU, tU); if (isParcel) cur.psensor = id; else if (!cur.sensor) cur.sensor = id; }
    };
    pnAccounts(h, c).forEach((A) => {
      PN_SUM.forEach(([r, dir]) => {
        const id = A.roles[r]; if (!id) return;
        if (dir === 'out' && !showOut) return; // 40.1: «Vis pakker jeg sender» (standard av)
        const st = h.states[id], a = (st && st.attributes) || {};
        let L = a.parcels;
        if (typeof L === 'string') { try { L = JSON.parse(L); } catch (x) { L = null; } }
        if (!Array.isArray(L)) return;
        const tU = Date.parse((st && st.last_updated) || '') || 0;
        L.forEach((p) => put(p, id, dir, A, false, tU));
      });
      // 42.3: én rad per …_pakke_<kode>-sensor (state = status, attributtene = pakken)
      A.parcels.forEach(({ id, code }) => {
        const st = h.states[id]; if (!st) return;
        const a = st.attributes || {}, p = { ...a };
        ['friendly_name', 'icon', 'attribution', 'device_class', 'unit_of_measurement'].forEach((k) => delete p[k]);
        p.barcode = p.barcode || code;
        if (!p.status && !/^(unknown|unavailable)$/.test(String(st.state))) p.status = st.state;
        put(p, id, 'in', A, true, Date.parse(st.last_updated || '') || 0);
      });
    });
    if (live) live.forEach((v, key) => {
      const cur = by.get(key);
      if (cur) { if (cur.tU > v.t) return; cur.p = { ...cur.p, ...v.p }; }
      else if (v.p) by.set(key, { p: { ...v.p }, sensor: null, dir: 'in', account: v.p.source === 'account' || v.p.account === true, tU: 0 });
    });
    return [...by.entries()].map(([k, e]) => pnItem(k, e)).sort((a, b) => PN_RANK[a.kind] - PN_RANK[b.kind]);
  }
  // 42.2/46 filtrene (tall-chipsene) på Pakker-lista
  const PN_TILES = [['in', 'Innkommende', 'incoming_parcels', 'Inn'], ['klar', 'Klar for henting', 'awaiting_pickup', 'Hentes'], ['lev', 'Leverte', 'delivered_parcels', 'Levert'], ['out', 'Utgående', 'outgoing_parcels', 'Ut']]; // 46: kort etikett i chipsen
  const PN_FK = { in: (x) => x.dir !== 'out' && x.kind !== 'levert', klar: (x) => x.dir !== 'out' && x.kind === 'klar', lev: (x) => x.dir !== 'out' && x.kind === 'levert', out: (x) => x.dir === 'out' && x.kind !== 'levert' };
  const PN_RLAB = { incoming_parcels: 'Innkommende', awaiting_pickup: 'Klar for henting', delivered_parcels: 'Leverte', next_delivery: 'Neste levering', last_update: 'Siste vellykkede oppdatering', outgoing_parcels: 'Utgående', outgoing_delivered_parcels: 'Utgående leverte', refresh: 'Oppdater-knapp', deliveries: 'Leveringskalender' };

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
  // 46: gamle del-id-er (Posten: `posten` → `kort`)
  const PART_ALIAS = { posten: { posten: 'kort' } };
  const partIds = (t, L) => uniq((Array.isArray(L) ? L : []).map((x) => (PART_ALIAS[t] && PART_ALIAS[t][x]) || x));
  // Nye deler (f.eks. 42.2 PostNord) i en lagret rekkefølge: rett etter delen som står foran dem som standard
  const partOrder = (c, t) => {
    const k = PARTS[t].map((p) => p[0]); const o = partIds(t, ((c.section_order || {})[t])).filter((x) => k.includes(x));
    k.forEach((x, i) => { if (o.includes(x)) return; const prev = k.slice(0, i).reverse().find((y) => o.includes(y)); o.splice(prev ? o.indexOf(prev) + 1 : 0, 0, x); });
    if (t === 'posten') { o.splice(o.indexOf('postnord'), 1); o.splice(o.indexOf('kort') + 1, 0, 'postnord'); } // 46: «PostNord-tall» er en bryter for kortet, ikke en egen plass
    return o;
  };
  const partHidden = (c, t) => new Set(partIds(t, ((c.section_hidden || {})[t])));
  const PART_FIXED = { posten: ['postnord'] }; // 46: ingen dra-håndtak (følger kortet)
  const visTabs = (c) => { const hid = tabHidden(c); const o = tabOrder(c).filter((k) => !hid.has(k)); return o.length ? o : ['kalender']; };
  const hdl = (list) => `<span class="kdrag" data-edrag="${esc(list)}" title="Dra for rekkefølge" style="touch-action:none;cursor:grab;display:inline-flex;color:var(--ki-text-mid, #979797);padding:8px 2px">${M.icon('mdi:drag', 20)}</span>`;
  const eyeB = (key, op, t, v, hid, label) => `<button class="ib" data-a="fn" data-k="${key}" data-op="${op}" data-t="${esc(t || '')}" data-v="${esc(v || '')}" aria-label="${hid ? 'Vis' : 'Skjul'} ${esc(label)}" style="width:40px;height:40px;border-radius:20px;display:grid;place-items:center;flex:none">${M.icon(hid ? 'mdi:eye-off-outline' : 'mdi:eye-outline', 20, `color:${hid ? 'var(--ki-text-lo, #696969)' : 'var(--ki-text, #fafafa)'}`)}</button>`;
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
      item.style.position = 'relative'; item.style.zIndex = '2'; item.style.boxShadow = '0 6px 18px ' + BA(0.4);
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

  // Nullstill (36.7: knappen i headeren på «Tilpass kalender», GUI-editoren: nederst)
  function resetCfg(hh, cc, ed) {
    cc = cc || {};
    const id = cc.card_id || M.uid(); EXP.delete(id); OPEN.delete(id);
    ed._config = { type: cc.type || 'custom:msh-kalender-card', card_id: id }; ed._set('card_id', id);
  }
  function editorSchema(h, c) {
    c = c || {};
    // Faner: piller (56) med dra, ikon, navn + «N deler», pil og øye; utvidet → deler (52) med dra + øye
    const faner = { type: 'html', html: (hh, cc, key, ed) => {
      installEd(ed);
      const hid = tabHidden(cc), open = EXP.get(cid(ed));
      return `<div class="f" style="gap:8px;padding:0;background:none;box-shadow:none">${tabOrder(cc).map((k) => {
        const [, label, icon] = TABL[k], P = PARTS[k], ph = partHidden(cc, k), isO = open === k && P.length > 1;
        const row = `<div class="ordrow ktab" data-edk="${k}" data-elist="tab" data-key="kt-${k}" style="height:56px;border-radius:28px;background:var(--ki-surface, #3a3a3a);display:flex;align-items:center;gap:8px;padding:0 6px 0 10px;${hid.has(k) ? 'opacity:.5' : ''}">${hdl('tab')}
          <span style="width:36px;height:36px;border-radius:18px;display:grid;place-items:center;background:var(--ki-surface-2, #404040);flex:none">${M.icon(icon, 20)}</span>
          <span style="flex:1;min-width:0;display:flex;flex-direction:column"><span style="font-size:14px;font-weight:500;display:flex;align-items:center;gap:6px">${esc(label)}${M.startTab && M.startTab.pill ? M.startTab.pill(cc, k, visTabs(cc), cc.startTab) : ''}</span><span style="font-size:11px;color:var(--ki-text-mid, #979797)">${P.length} ${P.length === 1 ? 'del' : 'deler'}</span></span>
          ${P.length > 1 ? `<button class="ib" data-a="fn" data-k="${key}" data-op="exp" data-v="${k}" aria-expanded="${isO}" aria-label="Deler i ${esc(label)}" style="width:40px;height:40px;border-radius:20px;display:grid;place-items:center;flex:none">${M.icon(isO ? 'mdi:chevron-up' : 'mdi:chevron-down', 22)}</button>` : ''}
          ${eyeB(key, 'eye', '', k, hid.has(k), label)}</div>`;
        const parts = isO ? partOrder(cc, k).map((p) => { const pl = P.find((x) => x[0] === p)[1], fx = (PART_FIXED[k] || []).includes(p); return `<div class="ordrow kpart" data-edk="${p}" data-elist="sec:${k}" data-key="kp-${k}-${p}" style="height:52px;border-radius:26px;margin-left:${fx ? 52 : 28}px;background:var(--ki-surface-2, #404040);display:flex;align-items:center;gap:8px;padding:0 6px 0 ${fx ? 14 : 10}px;${ph.has(p) ? 'opacity:.5' : ''}">${fx ? '' : hdl('sec:' + k)}<span style="flex:1;font-size:13px">${esc(pl)}</span>${eyeB(key, 'peye', k, p, ph.has(p), pl)}</div>`; }).join('') : '';
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
        const S = { ...(cc.section_hidden || {}) }, s = new Set(partIds(dd.t, S[dd.t])); // 46: gamle id-er normaliseres
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
      return `<div class="f" style="gap:8px;padding:0;background:none;box-shadow:none">${L.length ? L.map((x) => `<div class="ordrow" data-key="kc-${esc(x.id)}" style="height:56px;border-radius:28px;background:var(--ki-surface, #3a3a3a);display:flex;align-items:center;gap:10px;padding:0 12px 0 10px">
          <button data-a="fn" data-k="${key}" data-op="col" data-v="${esc(x.id)}" aria-label="Bytt farge" style="width:36px;height:36px;border-radius:18px;display:grid;place-items:center;flex:none;background:var(--ki-surface-2, #404040)"><i style="width:14px;height:14px;border-radius:7px;background:${esc(x.color)}"></i></button>
          <span style="flex:1;min-width:0;display:flex;flex-direction:column"><span style="font-size:14px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(x.name)}</span><span style="font-size:11px;color:var(--ki-text-mid, #979797);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(x.id)}${x.exists ? '' : ' · finnes ikke'}</span></span>
          <button class="sw ${x.hidden ? '' : 'on'}" role="switch" aria-checked="${!x.hidden}" aria-label="Vis ${esc(x.name)}" data-a="fn" data-k="${key}" data-op="cal" data-v="${esc(x.id)}"></button></div>`).join('') : '<div class="small" style="padding:0 6px">Fant ingen calendar.*-entiteter.</div>'}
        ${add ? `<div style="display:flex;flex-direction:column;gap:6px">${add.length ? add.map((id) => `<button data-a="fn" data-k="${key}" data-op="add" data-v="${esc(id)}" style="height:48px;border-radius:24px;background:var(--ki-surface-2, #404040);display:flex;align-items:center;gap:10px;padding:0 14px;text-align:left">${M.icon('mdi:plus', 20)}<span style="flex:1;min-width:0;display:flex;flex-direction:column"><span style="font-size:13px">${esc(M.name(hh, id))}</span><span style="font-size:11px;color:var(--ki-text-mid, #979797)">${esc(id)}</span></span></button>`).join('') : '<div class="small" style="padding:0 6px">Alle kalenderne er allerede med.</div>'}</div>` : ''}
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
    const info = { type: 'html', html: () => `<div style="display:flex;gap:10px;align-items:flex-start;padding:12px 14px;border-radius:20px;background:${TONE(C.blue, 0.14)};color:${AT(C.blue)};font-size:13px;line-height:1.4">${M.icon('mdi:information-outline', 20)}<span>Kildene finnes automatisk i Home Assistant (KI Hyttebesøk, Når kommer Posten, Norwegian Parcel Tracker, PostNord, Sonarr/Radarr, Plex og kalenderne). Velg en annen entitet her bare hvis det automatiske valget er feil.</span></div>` };
    const kilde = ([k, label, icon, col]) => ({ type: 'html', html: (hh, cc, key, ed) => {
      installEd(ed);
      if (!hh) return '';
      const ov = k === 'postnord' ? pnStr(cc) : (cc.src || {})[k], au = autoSrc(hh, k), cur = ov && ov !== 'none' ? ov : ov === 'none' ? null : au; // 42: src.postnord kan være et rolle-objekt
      const kind = ov ? 'over' : au ? 'auto' : 'none';
      if (!ed._inline) {
        const sel = { entity: {} };
        return `<div class="f"><div class="line">${M.icon(icon, 20, `color:${AT(col)}`)}<span style="flex:1;font-size:14px;font-weight:500">${esc(label)}</span>${badge(kind)}</div><ha-selector data-name="src.${k}" data-nomorph data-selector='${esc(JSON.stringify(sel))}' data-label="${esc(label)}" data-helper="${esc(ov ? '' : 'Automatisk' + (au ? ' · ' + au : ' · fant ingen'))}"></ha-selector></div>`;
      }
      const isO = OPEN.get(cid(ed)) === k, q = Q.get(cid(ed) + '|' + k) || '';
      let body = '';
      if (isO) {
        const ql = q.trim().toLowerCase();
        const L = ql ? Object.keys(hh.states).filter((id) => low(hh, id).includes(ql)).sort().slice(0, 12) : cands(hh, k).slice(0, 12);
        body = `<div style="display:flex;flex-direction:column;gap:6px;padding:0 10px 12px">
          <div style="display:flex;align-items:center;gap:8px;height:44px;border-radius:22px;background:var(--ki-surface-2, #2f2f2f);padding:0 6px 0 14px">${M.icon('mdi:magnify', 20, 'color:var(--ki-text-mid, #979797)')}<input data-ksq="${k}" value="${esc(q)}" placeholder="Søk etter entitet" autocapitalize="off" autocorrect="off" spellcheck="false" style="flex:1;min-width:0;height:100%;background:none;border:0;color:var(--ki-text, #fafafa);font-size:14px">${q ? `<button data-a="fn" data-k="${key}" data-op="qclr" data-v="${k}" aria-label="Tøm" style="width:32px;height:32px;border-radius:16px;display:grid;place-items:center;background:var(--ki-surface-2, #404040)">${M.icon('mdi:close', 18)}</button>` : ''}</div>
          <span style="font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--ki-text-3, #7f7f7f);padding:4px 6px 0">${q ? 'Treff' : 'Forslag fra Home Assistant'}</span>
          ${L.length ? L.map((id) => `<button data-a="fn" data-k="${key}" data-op="pick" data-v="${k}" data-id="${esc(id)}" style="min-height:52px;border-radius:26px;background:var(--ki-surface-2, #404040);display:flex;align-items:center;gap:10px;padding:6px 14px;text-align:left">${M.icon(M.domainIcon(id, hh.states[id]), 20, 'color:var(--ki-text-2, #afafaf)')}<span style="flex:1;min-width:0;display:flex;flex-direction:column"><span style="font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(M.name(hh, id))}</span><span style="font-size:11px;color:var(--ki-text-mid, #979797);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(id)}</span></span>${id === cur ? M.icon('mdi:check-circle', 22, `color:${C.green}`) : ''}</button>`).join('') : '<div class="small" style="padding:6px">Ingen treff</div>'}
          ${ov ? `<button class="btn" style="height:44px" data-a="fn" data-k="${key}" data-op="auto" data-v="${k}">${M.icon('mdi:restore', 18)}Bruk automatisk</button>` : ''}</div>`;
      }
      return `<div class="ksrc" data-key="ks-${k}" style="border-radius:26px;background:var(--ki-surface, #3a3a3a);overflow:hidden">
        <button data-a="fn" data-k="${key}" data-op="open" data-v="${k}" aria-expanded="${isO}" style="width:100%;min-height:60px;display:flex;align-items:center;gap:10px;padding:8px 12px;text-align:left">
          <span style="width:40px;height:40px;border-radius:20px;display:grid;place-items:center;flex:none;background:${TONE(col, 0.18)};color:${AT(col)}">${M.icon(icon, 20)}</span>
          <span style="flex:1;min-width:0;display:flex;flex-direction:column"><span style="font-size:14px;font-weight:500">${esc(label)}</span><span style="font-size:11px;color:var(--ki-text-mid, #979797);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(cur || '– · Velg entitet')}</span></span>
          ${badge(kind)}${M.icon(isO ? 'mdi:chevron-up' : 'mdi:chevron-down', 20, 'color:var(--ki-text-mid, #979797)')}</button>${body}</div>`;
    }, click: (dd, ed) => {
      const id = cid(ed);
      if (dd.op === 'open') { M.haptic('selection'); if (OPEN.get(id) === dd.v) OPEN.delete(id); else OPEN.set(id, dd.v); return ed._render(); }
      if (dd.op === 'qclr') { Q.delete(id + '|' + dd.v); return ed._render(); }
      if (dd.op === 'pick') { M.haptic('success'); const au = autoSrc(ed._hass, dd.v); return ed._set('src.' + dd.v, dd.id === au && !(ed._config.src || {})[dd.v] ? undefined : dd.id); }
      if (dd.op === 'auto') { M.haptic('selection'); Q.delete(id + '|' + dd.v); return ed._set('src.' + dd.v, undefined); }
    } });
    // Fiks 42: PostNord-rollene (sources.postnord.<rolle>) – auto fra registeret, overstyr per rolle. GUI: entitetsvelgere.
    const pnRoles = { type: 'html', id: 'postnord_roles', html: (hh, cc, key, ed) => {
      installEd(ed);
      if (!hh) return '';
      const auto = pnAccounts(hh, {}), ov = pnOvr(cc);
      const autoOf = (r) => uniq(auto.map((A) => A.roles[r]));
      const nP = auto.reduce((n, A) => n + A.parcels.length, 0);
      if (!auto.length && !Object.keys(ov).length && !pnPresent(hh)) return '';
      if (!ed._inline) {
        return `<div class="f"><div class="line">${M.icon('mdi:package-variant', 20, `color:${AT(C.blue)}`)}<span style="flex:1;font-size:14px;font-weight:500">PostNord – roller</span></div>${PN_ROLES.map((r) => { const au = autoOf(r); return `<ha-selector data-name="sources.postnord.${r}" data-nomorph data-selector='${esc(JSON.stringify({ entity: { domain: PN_RDOM[r] || 'sensor' } }))}' data-label="${esc(PN_RLAB[r])}" data-helper="${esc(ov[r] ? '' : 'Automatisk · ' + (au.length ? au.join(', ') : 'fant ingen'))}"></ha-selector>`; }).join('')}<span class="help">${auto.length} ${auto.length === 1 ? 'konto' : 'kontoer'} · ${nP} pakke-sensorer (én per sporingsnummer, finnes automatisk).</span></div>`;
      }
      const id = cid(ed), isO = OPEN.get(id) === 'pnroles', sub = OPEN.get(id + '|pnr');
      let body = '';
      if (isO) body = `<div style="display:flex;flex-direction:column;gap:6px;padding:0 10px 12px">${PN_ROLES.map((r) => {
        const au = autoOf(r), o = ov[r], cur = o && o !== 'none' ? o : o === 'none' ? null : au[0] || null, k = o ? 'over' : au.length ? 'auto' : 'none', op = sub === r;
        const dom = PN_RDOM[r] || 'sensor';
        const L = op ? uniq([...au, ...Object.keys(hh.entities || {}).filter((x) => plat(hh, x) === 'postnord' && x.startsWith(dom + '.') && hh.states[x] && (pnRole(hh, x) || {}).role !== 'parcel')]).sort() : [];
        return `<div style="border-radius:22px;background:var(--ki-surface-2, #404040);overflow:hidden"><button data-a="fn" data-k="${key}" data-op="pnr" data-v="${r}" aria-expanded="${op}" style="width:100%;min-height:52px;display:flex;align-items:center;gap:10px;padding:6px 12px 6px 14px;text-align:left"><span style="flex:1;min-width:0;display:flex;flex-direction:column"><span style="font-size:13px;font-weight:500">${esc(PN_RLAB[r])}</span><span style="font-size:11px;color:var(--ki-text-mid, #979797);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(o === 'none' ? 'Av' : cur ? cur + (au.length > 1 && !o ? ` +${au.length - 1}` : '') : '– · Velg entitet')}</span></span>${badge(k)}</button>
          ${op ? `<div style="display:flex;flex-direction:column;gap:4px;padding:0 8px 8px">${L.map((x) => `<button data-a="fn" data-k="${key}" data-op="pnrpick" data-v="${r}" data-id="${esc(x)}" style="min-height:44px;border-radius:22px;background:var(--ki-surface, #3a3a3a);display:flex;align-items:center;gap:8px;padding:4px 12px;text-align:left"><span style="flex:1;min-width:0;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(x)}</span>${x === cur ? M.icon('mdi:check-circle', 20, `color:${C.green}`) : ''}</button>`).join('') || '<div class="small" style="padding:6px">Ingen PostNord-entiteter</div>'}
            <div style="display:flex;gap:6px">${o ? `<button class="btn" style="height:40px;flex:1" data-a="fn" data-k="${key}" data-op="pnrpick" data-v="${r}" data-id="">${M.icon('mdi:restore', 18)}Automatisk</button>` : ''}${o !== 'none' ? `<button class="btn" style="height:40px;flex:1" data-a="fn" data-k="${key}" data-op="pnrpick" data-v="${r}" data-id="none">${M.icon('mdi:eye-off-outline', 18)}Av</button>` : ''}</div></div>` : ''}</div>`;
      }).join('')}<span class="help" style="padding:2px 6px">${auto.length} ${auto.length === 1 ? 'konto' : 'kontoer'} · ${nP} pakke-sensorer (én per sporingsnummer, finnes automatisk).</span></div>`;
      return `<div class="ksrc" data-key="ks-pnroles" style="border-radius:26px;background:var(--ki-surface, #3a3a3a);overflow:hidden">
        <button data-a="fn" data-k="${key}" data-op="pnopen" data-v="" aria-expanded="${isO}" style="width:100%;min-height:60px;display:flex;align-items:center;gap:10px;padding:8px 12px;text-align:left">
          <span style="width:40px;height:40px;border-radius:20px;display:grid;place-items:center;flex:none;background:${TONE(C.blue, 0.18)};color:${AT(C.blue)}">${M.icon('mdi:package-variant', 20)}</span>
          <span style="flex:1;min-width:0;display:flex;flex-direction:column"><span style="font-size:14px;font-weight:500">PostNord – roller</span><span style="font-size:11px;color:var(--ki-text-mid, #979797);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(auto.map((A) => A.name).join(' · ') || '– · Velg entitet')}</span></span>
          ${badge(Object.keys(ov).length ? 'over' : auto.length ? 'auto' : 'none')}${M.icon(isO ? 'mdi:chevron-up' : 'mdi:chevron-down', 20, 'color:var(--ki-text-mid, #979797)')}</button>${body}</div>`;
    }, click: (dd, ed) => {
      const id = cid(ed), cc = ed._config || {};
      if (dd.op === 'pnopen') { M.haptic('selection'); if (OPEN.get(id) === 'pnroles') OPEN.delete(id); else OPEN.set(id, 'pnroles'); return ed._render(); }
      if (dd.op === 'pnr') { M.haptic('selection'); if (OPEN.get(id + '|pnr') === dd.v) OPEN.delete(id + '|pnr'); else OPEN.set(id + '|pnr', dd.v); return ed._render(); }
      if (dd.op === 'pnrpick') {
        M.haptic(dd.id ? 'success' : 'selection');
        // sources.postnord som tekst (Fiks 40: én entitet/'none') flyttes til src.postnord før rollene legges i et objekt
        const S = { ...(cc.sources || {}) }, cur = S.postnord;
        const o = cur && typeof cur === 'object' ? { ...cur } : {};
        if (dd.id) o[dd.v] = dd.id; else delete o[dd.v];
        if (Object.keys(o).length) S.postnord = o; else delete S.postnord;
        if (typeof cur === 'string' && cur && !(cc.src || {}).postnord) ed._config = { ...cc, src: { ...(cc.src || {}), postnord: cur } };
        return ed._set('sources', Object.keys(S).length ? S : undefined);
      }
    } };
    // 46: `postnord_view` (eget PostNord-kort per konto) er fjernet – tallene summeres i «Når kommer Posten»
    // Fiks 40: PostNord-pakker jeg sender (konto: *_outgoing_parcels) – standard skjult
    const pnOut = { type: 'boolean', name: 'postnord_outgoing', label: 'Vis pakker jeg sender', default: false, help: 'PostNord-konto: vis også pakker du har sendt i Pakker.' };
    const spacing = { type: 'section', id: 'spacing', label: 'Mellomrom', icon: 'mdi:arrow-expand-vertical', meta: (hh, cc) => `${cc.gap != null ? cc.gap : 8} px mellom`, fields: [
      { type: 'range', name: 'gap', label: 'Mellom seksjonene', icon: 'mdi:arrow-split-horizontal', min: 0, max: 24, default: 8, presets: [[4, 'Tett 4'], [8, 'Standard 8'], [18, 'Luftig 18']] },
      { type: 'range', name: 'pad_top', label: 'Fra popup-headeren til første kort', icon: 'mdi:format-vertical-align-top', min: -20, max: 60, default: -10, presets: [[-20, 'Inntil −20'], [-10, 'Standard −10'], [6, 'Tett 6'], [44, 'Luftig 44']] },
      { type: 'range', name: 'pad_bottom', label: 'Luft i bunnen', icon: 'mdi:format-vertical-align-bottom', min: 0, max: 300, default: 150, presets: [[0, 'Ingen 0'], [60, 'Litt 60'], [150, 'Standard 150'], [300, 'Maks 300']] },
    ] };
    const visning = [
      { type: 'select', name: 'tab_labels', label: 'Faner viser', options: [['icon', 'Symboler'], ['name', 'Navn']], default: 'icon', help: 'Symboler: bare ikon, den aktive fanen viser også navnet. Navn: bare tekst.' },
      { type: 'select', name: 'days', label: 'Dager fremover', options: [[7, '7'], [14, '14'], [30, '30']], default: 14 },
      ...(M.startTab ? [M.startTab.field({ legacy: (cc) => cc.startTab, clear: ['startTab'], items: (hh, cc) => visTabs(cc).map((k) => { const t = TABS.find((x) => x[0] === k) || [k, k]; return { key: k, label: t[1], icon: t[2] }; }) })] : []), // 36.5: Startfane (felles MSH.startTab; gamle startTab leses)
      // 36.6: Startvisning for Kalender og Framover ved åpning (default_view; gamle defaultView vises/fjernes)
      { type: 'html', id: 'default_view', html: (hh, cc, key, ed) => {
        const v = startView(cc) === 'maned' ? 'month' : 'list', help = 'Gjelder Kalender og Framover hver gang popupen åpnes. Knappen ved fanene bytter bare visningen der og da.';
        if (ed && !ed._inline && customElements.get('ha-selector')) {
          const sel = { select: { mode: 'dropdown', options: [{ value: 'list', label: 'Liste' }, { value: 'month', label: 'Måned' }] } };
          return `<div class="f"><ha-selector data-name="default_view" data-nomorph data-sdef="${v}" data-selector="${esc(JSON.stringify(sel))}" data-label="Startvisning" data-helper="${esc(help)}"></ha-selector></div>`;
        }
        return `<div class="f" data-name="default_view"><label>Startvisning</label><div class="chips sg">${[['list', 'Liste'], ['month', 'Måned']].map(([k, l]) => `<button class="chip ${k === v ? 'on' : ''}" aria-selected="${k === v}" data-a="fn" data-k="${key}" data-op="dv" data-v="${k}">${l}</button>`).join('')}</div><span class="help">${help}</span></div>`;
      }, click: (dd, ed) => { if (dd.op !== 'dv') return; M.haptic('selection'); if ((ed._config || {}).defaultView != null) { const n = { ...ed._config }; delete n.defaultView; ed._config = n; } return ed._set('default_view', dd.v); } },
      // 46: leveringsraden i «Når kommer Posten» – bare for valgt dag, eller alltid (uten valgt dag: neste levering)
      { type: 'select', name: 'pn_row', label: 'PostNord-levering i Posten', options: [['valgt', 'Ved valgt dag'], ['alltid', 'Alltid']], default: 'valgt', help: 'Ved valgt dag: raden vises når du trykker på en dag med levering. Alltid: uten valgt dag vises neste PostNord-levering.' },
      { type: 'boolean', name: 'showPlex', label: 'Vis «Nylig i Plex»', default: true },
      { type: 'boolean', name: 'birthdayToday', label: 'Konfetti når noen har bursdag i dag', default: true },
      spacing,
    ];
    return [
      { type: 'tabs', id: 'kalender', tabs: [
        { key: 'faner', label: 'Faner', icon: 'mdi:tab', focus: ['faner'], fields: [faner, ...(M.tabH ? [M.tabH.field({ items: (hh, cc) => visTabs(cc || {}).map((k) => ({ key: k, label: TABL[k][1], icon: TABL[k][2] })), mode: (cc) => (cc.tab_labels === 'name' ? 'tekst' : 'aktiv'), native: 40, gear: true })] : [])] }, // 33.4: fanehøyde
        { key: 'kalendere', label: 'Kalendere', icon: 'mdi:calendar-multiple', focus: ['kalendere'], fields: [kal] },
        { key: 'kilder', label: 'Kilder', icon: 'mdi:database-search-outline', focus: ['kilder'], fields: [info, ...SRC.map(kilde), pnRoles, pnOut] },
        { key: 'visning', label: 'Visning', icon: 'mdi:tune-variant', focus: ['spacing', 'visning'], fields: visning },
      ] },
      { type: 'button', label: 'Nullstill', icon: 'mdi:restore', run: (hh, cc, ed) => { M.haptic('warning'); resetCfg(hh, cc, ed); } }, // også i headeren (36.7); knappen er dekkende #3a3a3a
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
      // Fiks 24.1: `default_view: list|month` (YAML) = defaultView (GUI-editoren)
      // 36.6: `default_view` (Startvisning, GUI + Tilpass) vinner over gamle `defaultView`
      if (c && normView(c.default_view)) c = { ...c, defaultView: normView(c.default_view) };
      super.setConfig(c);
    }
    connectedCallback() {
      super.connectedCallback();
      if (!this.__mbBound) { this.__mbBound = true; this._bindMode(); this._bindSwipe(); }
      // Fiks 24.1: valgt visning (per bruker i ki-store) endret her eller fra en annen enhet → tegn på nytt
      if (M.store && M.store.subscribe && !this._kvOff) this._kvOff = M.store.subscribe((d, path) => { if (!path || /^kalender(\.|$)/.test(String(path))) this._upd(); });
    }
    disconnectedCallback() {
      if (super.disconnectedCallback) super.disconnectedCallback();
      if (this._kvOff) { this._kvOff(); this._kvOff = null; }
    }
    // 36.6: visning for Kalender/Framover: byttet med knappen i denne åpningen → Startvisning (default_view) → liste.
    // Knappen lagrer ingenting – neste åpning starter i Startvisning igjen.
    _view(t) {
      const k = t === 'kalender' ? 'kview' : 'fview';
      return normView(this.ui[k]) || startView(this.config);
    }
    onOpen() { this._ui = { ...this._ui, kview: null, fview: null, btn: 'view', pSel: null }; this._pnSub(); this.update(); }
    // 36.5: startfane ved åpning (MSH.startTab via basekortet) – start_tab, ellers gamle startTab
    static get startTabSpec() { return { tabs: (card) => visTabs(card.config), legacy: (c) => c.startTab }; }
    onClose() { this._ui = { ...this._ui, mOff: 0, fOff: 0, hOff: 0, selDay: null, fSel: null, btn: 'view', q: '', kview: null, fview: null, pSel: null, pMsg: null, pnF: null }; this._pnUnsub(); clearTimeout(this._pnRegT); clearTimeout(this._pnRegT2); }
    // Fiks 40.5: PostNord-hendelsene kun mens popupen er åpen (ingen polling – integrasjonen poller selv).
    // onClose kalles også fra disconnectedCallback (basekortet), så abonnementet avsluttes alltid.
    _pnSub() {
      this._pnUnsub();
      const h = this.hass, con = h && h.connection;
      if (!con || typeof con.subscribeEvents !== 'function' || !pnPresent(h)) return;
      this._pnLive = this._pnLive || new Map();
      this._pnOffs = [...PN_EVENTS, 'entity_registry_updated'].map((t) => { try { return Promise.resolve(con.subscribeEvents((ev) => (t === 'entity_registry_updated' ? this._pnReg(ev) : this._pnEvent(ev)), t)).catch(() => null); } catch (e) { return Promise.resolve(null); } });
    }
    _pnUnsub() {
      const L = this._pnOffs || []; this._pnOffs = null;
      L.forEach((p) => p.then((off) => { try { if (typeof off === 'function') off(); } catch (e) { /* */ } }));
      if (this._pnLive) this._pnLive.clear();
    }
    // 42.3: nye/forsvunne PostNord-entiteter (pakke-sensorene kommer og går) mens popupen er åpen → tegn på nytt
    // (registeret i hass.entities oppdateres litt etter hendelsen, derfor to forsinkede tegninger)
    _pnReg(ev) {
      if (!this.isOpen) return;
      const d = (ev && ev.data) || {}, id = String(d.entity_id || ''), h = this.hass;
      const ours = /postnord/.test(id) || (h && plat(h, id) === 'postnord') || pnSensors(h, this.config).includes(id);
      if (!ours) return;
      clearTimeout(this._pnRegT); clearTimeout(this._pnRegT2);
      this._pnRegT = setTimeout(() => this._upd(), 200);
      this._pnRegT2 = setTimeout(() => this._upd(), 1500);
    }
    _pnEvent(ev) {
      if (!this.isOpen || !this._pnLive) return;
      const d = (ev && ev.data) || {}, p = d.parcel && typeof d.parcel === 'object' ? d.parcel : d;
      const code = pnCode(p); if (!code) return;
      const key = 'pn:' + code, np = { ...p };
      if (!np.status && d.new_status) np.status = d.new_status;
      if (ev.event_type === 'postnord_parcel_delivered' && !np.status) np.status = 'delivered';
      this._pnLive.set(key, { p: np, t: Date.now() });
      if (this.tab !== 'posten') return; // tegnes med de nye dataene når Posten vises
      // Bare raden: samme plass i lista (samme type) → bytt ut raden alene; ellers (ny/levert/ny rekkefølge) tegn lista
      const row = this.shadowRoot.querySelector(`.pkr[data-key="pk-${key}"]`);
      const x = pnParcels(this.hass, this.config, this._pnLive).find((y) => y.id === key);
      if (!row || !x || row.dataset.kind !== x.kind || ev.event_type === 'postnord_parcel_delivered') return this.update();
      const tpl = document.createElement('template'); tpl.innerHTML = this._pnRow(x).trim();
      if (tpl.content.firstElementChild) row.replaceWith(tpl.content.firstElementChild);
    }
    // 36.7: «Tilpass kalender» – tittel uten «·», «Nullstill» i headeren (ingen X), ark top 52, maks 440, radius 38 (felles, Fiks 40),
    // bakteppe rgba(0,0,0,.5) + blur(4px) over dashbordflaten. Arket er portalt (MSH.overlay i ki-overlay-root) og helt dekkende.
    static get editorTitle() { return 'Tilpass kalender'; }
    static get editorHead() { return { reset: resetCfg }; }
    customize(focus, opts) {
      // Fiks 40: top 52 / maks 440 / radius 38 er nå felles standard for alle Tilpass-ark (MSH.overlay tilpass: true)
      return super.customize(focus, { ...(opts || {}), sheet: { css: `.sh.tp{box-shadow:0 -12px 40px ${BA(0.45)}}
        .bg{-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px)}` } });
    }
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
        const t = this.tab, flip = t === 'kalender' || t === 'framover'; // 36.6: bare Kalender/Framover kan vippe
        g = { id: e.pointerId, y0: e.clientY, done: false, flip };
        if (t === 'kalender' && this.ui.btn !== 'gear') g.t = setTimeout(() => { if (!g || g.done) return; g.done = true; M.haptic('medium'); this._calMenu(b); }, 480);
      });
      R.addEventListener('pointermove', (e) => {
        if (!g || e.pointerId !== g.id) return;
        e.stopPropagation();
        if (g.done || !g.flip) return;
        const dy = e.clientY - g.y0;
        if (Math.abs(dy) > 16) { g.done = true; clearTimeout(g.t); M.haptic('selection'); this.setUI({ btn: this.ui.btn === 'gear' ? 'view' : 'gear' }); }
      });
      const up = (e) => {
        if (!g || e.pointerId !== g.id) return;
        e.stopPropagation();
        clearTimeout(g.t);
        const G = g; g = null; this.__mbT = Date.now();
        if (G.done || e.type === 'pointercancel') return;
        M.haptic('light');
        this._modeTap();
      };
      R.addEventListener('pointerup', up);
      R.addEventListener('pointercancel', up);
      // Fiks 24.1: klikk uten pekerhendelser foran (tastatur, skjermleser, pekeren fanget opp av noe annet) = kort trykk
      R.addEventListener('click', (e) => {
        if (!mb(e)) return;
        e.stopPropagation();
        if (g || Date.now() - (this.__mbT || 0) < 700) return;
        M.haptic('light');
        this._modeTap();
      });
    }
    // Fiks 24.1: sveip venstre/høyre på månedsgridet bytter måned (touch-action pan-y, stopPropagation – fallgruve 2)
    _bindSwipe() {
      const R = this.shadowRoot;
      const zone = (e) => (e.composedPath ? e.composedPath() : []).find((n) => n && n.classList && n.classList.contains('mv7'));
      ['touchstart', 'touchmove', 'touchend'].forEach((t) => R.addEventListener(t, (e) => { if (zone(e)) e.stopPropagation(); }, { passive: true }));
      let s = null;
      R.addEventListener('pointerdown', (e) => { const z = zone(e); if (!z || e.button) return; e.stopPropagation(); s = { id: e.pointerId, x: e.clientX, y: e.clientY, act: z.dataset.swipe }; });
      R.addEventListener('pointermove', (e) => { if (s && e.pointerId === s.id) e.stopPropagation(); });
      const end = (e) => {
        if (!s || e.pointerId !== s.id) return;
        e.stopPropagation();
        const S = s; s = null;
        if (e.type === 'pointercancel') return;
        const dx = e.clientX - S.x, dy = e.clientY - S.y;
        if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
        this.__swT = Date.now();
        const k = { mstep: 'mOff', fstep: 'fOff' }[S.act]; if (!k) return;
        M.haptic('selection');
        this.setUI({ [k]: (Number(this.ui[k]) || 0) + (dx < 0 ? 1 : -1), selDay: null, fSel: null });
      };
      R.addEventListener('pointerup', end);
      R.addEventListener('pointercancel', end);
      // klikket som avslutter et sveip velger ikke en dag
      R.addEventListener('click', (e) => { if (Date.now() - (this.__swT || 0) < 400 && zone(e)) { e.stopPropagation(); e.preventDefault(); } }, true);
    }
    _modeTap() {
      const t = this.tab;
      if (this.ui.btn === 'gear' || !(t === 'kalender' || t === 'framover')) return this.customize();
      // 36.6: byttet gjelder bare denne åpningen – lagret Startvisning (default_view) endres ikke. Framover-filteret beholdes.
      const k = t === 'kalender' ? 'kview' : 'fview', nv = this._view(t) === 'maned' ? 'liste' : 'maned';
      this.setUI({ [k]: nv, selDay: null, fSel: null });
    }
    // «Vis kalendere» (portalt, fallgruve 1): avkrysning per calendar.* med farge-prikk. Fiks 24.1: rett under knappen
    // som åpnet den (modusknappen eller `event`-knappen i månedslinjen), høyrejustert, 264 px, #404040, radius 24.
    _calMenu(anchor) {
      if (this._menu && !this._menu.closed) this._menu.close();
      const a = anchor && anchor.isConnected ? anchor : this.shadowRoot.querySelector('.mb');
      const r = a ? a.getBoundingClientRect() : { bottom: 80, right: window.innerWidth - 16 };
      const D = M.dashRect ? M.dashRect() : { left: 0, width: window.innerWidth };
      const rx = M.railOn && M.railPad ? M.railPad() : 0, hostR = D.left + D.width;
      const top = Math.round(r.bottom + 8), right = Math.max(8, Math.round(hostR - r.right)), w = Math.min(264, Math.max(200, D.width - rx - 16));
      const ov = M.overlay({ html: '', sheet: false, maxWidth: 264, guard: 350, css: `
        .bg{background:transparent!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important}
        .sh{position:absolute;top:${top}px;right:${right}px;left:auto;bottom:auto;width:${w}px;max-width:${w}px;margin:0;max-height:calc(100% - ${top + 16}px);
          --ki-sh-pt:8px;--ki-sh-px:8px;--ki-sh-pb:8px;background:var(--ki-surface, var(--gray300,#404040))!important;border-radius:24px!important;box-shadow:0 12px 32px ${BA(0.45)};
          transform:translate3d(0,-6px,0) scale(.98)!important;transform-origin:top right}
        :host(.on) .sh{transform:translate3d(0,0,0) scale(1)!important}
        .mh{display:flex;align-items:center;gap:8px;padding:6px 8px 8px;font-size:13px;font-weight:600;color:var(--ki-text-2, #afafaf)}
        .mr{display:flex;align-items:center;gap:10px;width:100%;min-height:52px;padding:6px 10px;border-radius:18px;background:transparent;text-align:left;color:var(--ki-text, #fafafa)}
        .mr+.mr{box-shadow:inset 0 1px 0 ${WA(0.06)}}
        .mr i{width:12px;height:12px;border-radius:6px;flex:none}
        .mr .nm{flex:1;min-width:0;display:flex;flex-direction:column}.mr .nm b{font-weight:500;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mr .nm span{font-size:11px;color:var(--ki-text-mid, #979797);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .ck{width:24px;height:24px;border-radius:8px;display:grid;place-items:center;background:var(--ki-ctrl, #545454);flex:none}.ck.on{background:${C.accent};color:var(--ki-on-accent, #2a1720)}
        .none{padding:14px;color:var(--ki-text-mid, #979797);font-size:13px}` });
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
      const viewTab = t === 'kalender' || t === 'framover', gear = viewTab && this.ui.btn === 'gear';
      const view = viewTab ? this._view(t) : 'liste';
      const vIcon = view === 'maned' ? 'mdi:view-agenda' : 'mdi:calendar-month'; // calendar_month ↔ view_agenda
      // 36.6: Hytta/Bursdager/Posten – knappen er KUN tannhjul (ingen skinne, ingen prikker, ingen vipp/hold)
      const mode = viewTab ? `<div class="mode"><button class="mb press" aria-label="${gear ? 'Tilpass kalender' : view === 'maned' ? 'Vis liste' : 'Vis måned'}${t === 'kalender' ? ' · hold for kalendere' : ''} · sveip for tannhjul" data-mode="${gear ? 'gear' : 'view'}">
        <span class="rail" style="transform:translateY(${gear ? 'calc(-1 * var(--mbh, 48px))' : '0px'})"><span>${M.icon(vIcon, 22)}</span><span>${M.icon('mdi:cog', 22)}</span></span></button>
        <span class="mdots" aria-hidden="true"><i class="${gear ? '' : 'on'}"></i><i class="${gear ? 'on' : ''}"></i></span></div>`
        : `<div class="mode"><button class="mb press gear" aria-label="Tilpass kalender" data-mode="gear"><span class="rail"><span>${M.icon('mdi:cog', 22)}</span></span></button></div>`;
      let body;
      try { body = this['_t_' + t](); } catch (e) { body = this._failHTML(e); }
      return `<div class="wrap"><div class="top"${M.tabH && M.tabH.style(c) ? ` style="${M.tabH.style(c)}"` : ''}>${tabs}${mode}</div><div class="pane" data-key="pane-${t}">${body}</div></div>`;
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
      return this._view('kalender') === 'maned' ? this._kMonth() : this._kList();
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
    /* Fiks 24.1 · månedsvisning (Kalender og Framover): KUN månedskalenderen + dagspanelet.
       Linje: ‹ · «September 2026» · `event` (Vis kalendere, bare Kalender) · › · ukedager M T O T F L S · 7 runde celler
       per uke med antall-merke · sveip venstre/høyre bytter måned (.mv7, _bindSwipe). */
    _mvHead(y, m, act, off, cal) {
      const tl = `${MND_L[m][0].toUpperCase() + MND_L[m].slice(1)} ${y}`;
      return `<div class="mvh"><button class="mvb press" data-act="${act}" data-d="-1" data-haptic="selection" aria-label="Forrige måned">${M.icon('mdi:chevron-left', 22)}</button>
        ${off ? `<button class="mvt press" data-act="${act}" data-d="0" aria-label="${esc(tl)} · gå til i dag">${esc(tl)}</button>` : `<b class="mvt">${esc(tl)}</b>`}
        ${cal ? `<button class="mvb press" data-act="calmenu" aria-label="Vis kalendere" aria-haspopup="menu">${M.icon('mdi:calendar', 20)}</button>` : ''}
        <button class="mvb press" data-act="${act}" data-d="1" data-haptic="selection" aria-label="Neste måned">${M.icon('mdi:chevron-right', 22)}</button></div>`;
    }
    _mvGrid(y, m, act, sel, count) {
      const today = dk(d0(new Date())), selAct = act === 'fstep' ? 'fsel' : 'selday';
      const cells = monthGrid(y, m).flat().map((d) => {
        const key = dk(d), out = d.getMonth() !== m, n = out ? 0 : count(d, key);
        return `<button class="mvd ${out ? 'out' : ''} ${key === today ? 'today' : ''} ${key === sel && !out ? 'sel' : ''}" data-act="${selAct}" data-v="${key}" data-haptic="selection" aria-label="${esc(`${d.getDate()}. ${MND_L[d.getMonth()]}${n ? ` · ${n} hendelser` : ''}`)}"><span class="num">${d.getDate()}</span>${n ? `<i class="mvn num ${n >= 3 ? 'hi' : ''}">${n}</i>` : ''}</button>`;
      }).join('');
      return `<div class="mv7" data-swipe="${act}">${UKE1.map((u) => `<span class="mvw">${u}</span>`).join('')}${cells}</div>`;
    }
    _dayPanel(d, rows, empty) {
      const n = dayDiff(new Date(), d), lab = DAG_L[d.getDay()], t = `${lab[0].toUpperCase() + lab.slice(1)} ${d.getDate()}. ${MND_L[d.getMonth()]}`;
      const rel = n === 0 ? 'i dag' : n === 1 ? 'i morgen' : n === -1 ? 'i går' : '';
      return `<section class="card dp" data-key="dp-${dk(d)}"><div class="dph"><b>${esc(t)}</b>${rel ? `<span>${rel}</span>` : ''}</div>${rows || `<div class="none">${esc(empty)}</div>`}</section>`;
    }
    _dpRow(e) {
      const time = e.allDay ? 'Hele dagen' : `${hm(e.start)} – ${hm(e.end)}`;
      const multi = e.allDay && dayDiff(e.start, e.end) > 0 ? ` · til ${dShort(e.end)}` : '';
      return `<button class="dpr press" data-act="evd" data-uid="${esc(e.uid)}" data-cal="${esc(e.cal)}" data-s="${e.start.getTime()}"><i class="dps" style="background:${esc(e.color)}"></i>
        <span class="grow dpc"><span class="dpt num">${esc(time)}</span><b class="ell">${esc(e.summary)}</b><span class="ell">${esc([e.location, e.calName].filter(Boolean).join(' · ') + multi)}</span></span></button>`;
    }
    _kMonth() {
      const off = Number(this.ui.mOff) || 0, now = d0(new Date()), f = new Date(now.getFullYear(), now.getMonth() + off, 1);
      const [s, e] = this._win(off);
      const { list } = this._calEvents(s, e);
      this.__mi = null;
      const med = this._mItems().filter((x) => x.kind !== 'plex' && x.date);
      const on = (d) => { const dE = addD(d, 1); return list.filter((x) => x.start < dE && (x.allDay ? addD(x.end, 1) : x.end) > d); };
      const onM = (key) => med.filter((x) => dk(d0(x.date)) === key);
      const sel = this.ui.selDay || (off ? dk(f) : dk(now));
      const grid = this._mvGrid(f.getFullYear(), f.getMonth(), 'mstep', sel, (d, key) => on(d).length + onM(key).length);
      const sd = fromKey(sel), evs = on(sd), ms = onM(sel);
      return `<div class="mvc">${this._mvHead(f.getFullYear(), f.getMonth(), 'mstep', off, true)}${grid}</div>
        ${this._dayPanel(sd, evs.map((x) => this._dpRow(x)).join('') + ms.map((x) => this._mRow(x)).join(''), 'Ingenting denne dagen')}`;
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
      return `<div class="srch">${M.icon('mdi:magnify', 20, 'color:var(--ki-text-mid, #979797)')}<input data-input="hq" value="${esc(q)}" placeholder="Søk: 12.7 · uke 27 · i går · juli" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="search">${q ? `<button class="x press" data-act="hqclr" aria-label="Tøm">${M.icon('mdi:close', 18)}</button>` : ''}</div>${res}`;
    }
    _hCarousel(S, idx) {
      const ppl = (list) => `<span class="ppl">${list.slice(0, 5).map((p, i) => `<span class="av" style="background:${esc(M.color(p.color, PAL[i % PAL.length]))}${p.here ? ';box-shadow:0 0 0 2px var(--ki-surface, #3a3a3a),0 0 0 4px ' + C.green : ''}" title="${esc(p.name)}">${esc(ini(p.name))}</span>`).join('')}</span>`;
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
      return `<div class="stay"><span class="av" style="background:${esc(o.color)}">${esc(ini(o.person))}</span><span class="grow evc"><b class="ell">${esc(o.person)} <span class="stag" style="--sc:${o.color};--scx:${AT(o.color)}">${esc(o.sted)}</span></b><span class="ell num">${esc(dShort(o.start))}${dk(o.start) !== dk(o.end) ? ' – ' + esc(dShort(o.end)) : ''}${o.planned ? ' · planlagt' : ''}</span></span><span class="snt num ${on ? 'on' : ''}">${on ? 'pågår' : o.nights + (o.nights === 1 ? ' natt' : ' netter')}</span></div>`;
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
    // 36.6: valgt filter → elementene som teller i månedsvisningen (merker + dagspanel). Alle = Sonarr + Radarr (+ Plex når
    // «Nylig i Plex» er på), Serier = Sonarr, Filmer = Radarr, Plex = bare «lagt til i Plex».
    _fFilter() {
      const c = this.config, P = this._parts('framover');
      let f = this.ui.ff || 'alle';
      if (!P.includes('filter') || !FILTERS.some((x) => x[0] === f) || (f === 'plex' && c.showPlex === false)) f = 'alle';
      return f;
    }
    _fPool(f) {
      const items = this._mItems(), up = items.filter((x) => x.kind !== 'plex'), plex = items.filter((x) => x.kind === 'plex');
      const L = f === 'serier' ? up.filter((x) => x.kind === 'serie') : f === 'filmer' ? up.filter((x) => x.kind === 'film') : f === 'plex' ? plex : this.config.showPlex !== false ? [...up, ...plex] : up;
      return L.filter((x) => x.date);
    }
    _fChips(f) {
      const c = this.config;
      return `<div class="chips fchips noscroll" role="toolbar" aria-label="Filter">${FILTERS.filter(([k]) => k !== 'plex' || c.showPlex !== false).map(([k, l]) => `<button class="fc ${k === f ? 'on' : ''}" data-act="ff" data-v="${k}" data-haptic="selection" aria-pressed="${k === f}">${l}</button>`).join('')}</div>`;
    }
    _t_framover() {
      this.__mi = null;
      const h = this.hass, c = this.config;
      const has = ['sonarr', 'radarr', 'plex'].some((k) => srcOf(h, c, k));
      if (!has) return this._missing('Ingen Sonarr, Radarr eller Plex', 'kilder');
      const items = this._mItems(), busy = this.__mBusy;
      const up = items.filter((x) => x.kind !== 'plex'), plex = items.filter((x) => x.kind === 'plex');
      const P = this._parts('framover'), f = this._fFilter();
      // 36.6: filter-chipsene står ALLTID øverst – rett under fanelinjen, over månedsnavigasjonen – i begge visninger
      const chips = P.includes('filter') ? this._fChips(f) : '';
      if (this._view('framover') === 'maned') return chips + this._fMonth(this._fPool(f), f);
      const L = f === 'serier' ? up.filter((x) => x.kind === 'serie') : f === 'filmer' ? up.filter((x) => x.kind === 'film') : f === 'plex' ? [] : up;
      const out = [chips];
      P.forEach((p) => {
        if (p === 'hero' && f !== 'plex') {
          const x = L[0];
          if (!x) { out.push(`<div class="card none">${busy ? 'Henter …' : 'Ingen kommende utgivelser'}</div>`); return; }
          const n = dayDiff(new Date(), x.date);
          out.push(`<button class="hero press" data-ki-island data-act="mdet" data-i="${items.indexOf(x)}"><span class="bdrop ${x.fanart ? '' : 'ph'}">${x.fanart ? `<img src="${esc(x.fanart)}" alt="" loading="lazy">` : ''}</span>
            <span class="hin"><span class="pst lg ${x.poster ? '' : 'ph'}">${x.poster ? `<img src="${esc(x.poster)}" alt="">` : M.icon(x.kind === 'film' ? 'mdi:filmstrip' : 'mdi:television-classic', 26)}</span>
            <span class="grow hcol"><span class="hchips"><span class="mchip">${x.kind === 'film' ? 'Film' : 'Serie'}</span><span class="mchip hl">${esc(n === 0 ? 'I dag' : n === 1 ? 'I morgen' : 'Om ' + n + ' dager')}</span></span>
            <b class="htl">${esc(x.title)}</b><span class="hsub ell">${esc([x.ep, x.epTitle].filter(Boolean).join(' · ') || dShort(x.date))}${x.network ? ' · ' + esc(x.network) : ''}</span></span></span></button>`);
        }
        if (p === 'kommende') {
          if (f === 'plex') { out.push(this._plexGrid(plex, true)); return; }
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
    // Valgt dag i Framover-måneden (ui.fSel, ellers i dag / den 1. i en annen måned)
    _fSelKey() { const off = Number(this.ui.fOff) || 0, now = d0(new Date()), f = new Date(now.getFullYear(), now.getMonth() + off, 1); return this.ui.fSel || (off ? dk(f) : dk(now)); }
    _fMonth(L, flt) {
      const off = Number(this.ui.fOff) || 0, now = d0(new Date()), f = new Date(now.getFullYear(), now.getMonth() + off, 1);
      const sel = this._fSelKey();
      const grid = this._mvGrid(f.getFullYear(), f.getMonth(), 'fstep', sel, (d, key) => L.filter((x) => dk(d0(x.date)) === key).length);
      const ms = L.filter((x) => dk(d0(x.date)) === sel);
      const empty = flt === 'plex' ? 'Ingenting lagt til i Plex denne dagen' : flt === 'serier' ? 'Ingen episoder denne dagen' : flt === 'filmer' ? 'Ingen filmer denne dagen' : 'Ingen utgivelser denne dagen';
      return `<div class="mvc">${this._mvHead(f.getFullYear(), f.getMonth(), 'fstep', off, false)}${grid}</div>${this._dayPanel(fromKey(sel), ms.map((x) => this._mRow(x)).join(''), empty)}`;
    }
    // 36.6: nytt filter i månedsvisningen og valgt dag har ingen treff → hopp til første dag med treff (i den viste måneden
    // hvis den har noen, ellers første fra i dag, ellers den siste) – måneden følger med.
    _fJump(flt) {
      this.__mi = null;
      const L = this._fPool(flt).slice().sort((a, b) => a.date - b.date), sel = this._fSelKey();
      if (!L.length || L.some((x) => dk(d0(x.date)) === sel)) return null;
      const now = d0(new Date()), off = Number(this.ui.fOff) || 0, mf = new Date(now.getFullYear(), now.getMonth() + off, 1);
      const inM = L.find((x) => x.date.getFullYear() === mf.getFullYear() && x.date.getMonth() === mf.getMonth());
      const x = inM || L.find((y) => d0(y.date) >= now) || L[L.length - 1], d = d0(x.date);
      return { fSel: dk(d), fOff: (d.getFullYear() - now.getFullYear()) * 12 + d.getMonth() - now.getMonth() };
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
        .pst{width:96px;aspect-ratio:2/3;border-radius:14px;overflow:hidden;flex:none;background:#404040;display:grid;place-items:center;color:#7f7f7f} /* ki-hex-ok: plakat/bakgrunnsbilde (mørk øy) */
        .pst img{width:100%;height:100%;object-fit:cover;display:block}
        .ph{background:repeating-linear-gradient(135deg,#3a3a3a 0 10px,#404040 10px 20px)} /* ki-hex-ok: plakat/bakgrunnsbilde (mørk øy) */
        .tt{font-size:22px;font-weight:600;line-height:1.2}.sub{font-size:13px;color:var(--ki-text-2, #afafaf);margin-top:4px}
        .chips{display:flex;flex-wrap:wrap;gap:6px}.chip{height:28px;padding:0 12px;border-radius:14px;background:var(--ki-surface-2, #404040);font-size:12px;display:inline-flex;align-items:center;color:var(--ki-text-1, #c7c7c7)}
        .desc{font-size:14px;line-height:1.5;color:var(--ki-text-1, #c7c7c7);white-space:pre-line}
        .acts{display:flex;gap:8px}.acts button{flex:1;height:52px;border-radius:26px;display:inline-flex;align-items:center;justify-content:center;gap:8px;font-size:14px;font-weight:500;background:var(--ki-surface-2, #404040);color:var(--ki-text, #fafafa)}
        .acts .pri{background:${C.accent};color:var(--ki-on-accent, #2a1720)}` ,
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
      const parts = this._parts('posten');
      // Fiks 42: PostNord-kontoene (registeret) – alle entitetene er avhengigheter (nye/forsvunne pakke-sensorer tegnes)
      const accts = pnAccounts(h, c);
      accts.forEach((A) => { Object.values(A.roles).forEach((id) => this.s(id)); A.parcels.forEach((x) => this.s(x.id)); });
      // 46: «PostNord-tall» (delen `postnord`) av → ingen PostNord i kortet (chips, oppdater, prikker, leveringsrad)
      const pnOn = accts.length > 0 && parts.includes('postnord');
      let F = this.ui.pnF && PN_FK[this.ui.pnF.k] ? this.ui.pnF : null;
      if (F && F.a !== '*' && !accts.some((A) => A.key === F.a)) F = null;
      let chipsRef = false; // oppdater-knappen står i kortet → ikke i Pakker-headeren
      parts.forEach((p) => {
        if (p === 'kort') { const r = this._postCard(h, c, accts, pnOn, F); chipsRef = r.ref; out.push(r.html); }
        if (p === 'pakker') {
          const nw = parcelsOf(h, c); nw.forEach((x) => this.s(x.id));
          // Fiks 40: PostNord i samme liste (sortert ute → klar → transport → avvik → levert); uten PostNord som før
          const pnS = pnSensors(h, c); pnS.forEach((id) => this.s(id));
          const pn = pnParcels(h, c, this._pnLive, { out: !!(F && F.k === 'out') });
          const all = pn.length ? [...nw, ...pn].sort((a, b) => PN_RANK[a.kind] - PN_RANK[b.kind]) : nw;
          // 42.2/46: aktivt filter (tall-chip) → bare PostNord-pakkene i den kategorien (alle kontoer, '*')
          const show = F ? all.filter((x) => x.pn && (F.a === '*' || x.acct === F.a) && PN_FK[F.k](x)) : this.ui.pDel ? all : all.filter((x) => x.kind !== 'levert');
          const nDel = all.filter((x) => x.kind === 'levert').length;
          // 40.5: «Oppdater» i Pakker-headeren bare når kortet ikke har oppdater-knappen (PostNord-tall av / kortet skjult)
          const pnBtn = pnS.length && !chipsRef ? (accts.find((A) => A.roles.refresh) || { roles: {} }).roles.refresh : null;
          const fl = F ? (PN_TILES.find((t) => t[0] === F.k) || [])[1] : '';
          out.push(this._hdr('Pakker', `<span class="meta num">${all.filter((x) => x.kind !== 'levert').length || ''}</span>${F ? `<button class="pnfc press" data-act="pnfclr" data-haptic="selection" aria-label="Fjern filteret ${esc(fl)}">${esc(fl)}${M.icon('mdi:close', 16)}</button>` : ''}${pnBtn ? `<button class="add press" data-act="prefresh" data-id="${esc(pnBtn)}" aria-label="Oppdater pakker">${M.icon('mdi:refresh', 22)}</button>` : ''}<button class="add press" data-act="padd" aria-label="Legg til pakke">${M.icon(this.ui.pAdd ? 'mdi:close' : 'mdi:plus', 22)}</button>`));
          if (this.ui.pAdd) out.push(`<div class="card bform"><input data-input="pnum" value="${esc(this.ui.pNum || '')}" placeholder="Sporingsnummer" autocapitalize="characters" autocorrect="off" spellcheck="false"><button class="pri press" data-act="psave" data-haptic="off">${M.icon('mdi:package-variant-plus', 20)}Spor pakken</button>${this.ui.pMsg ? `<div class="pmsg" role="status">${M.icon('mdi:alert-circle-outline', 18)}<span>${esc(this.ui.pMsg)}</span></div>` : ''}</div>`);
          const hasSrc = !!srcOf(h, c, 'parcel') || all.length || pnS.length;
          if (!hasSrc) { out.push(this._missing('Ingen pakkesporing', 'kilder')); return; }
          out.push(show.length ? `<div class="card evl pk">${show.map((x) => (x.pn ? this._pnRow(x) : this._pRow(x))).join('')}</div>` : `<div class="card none">${F ? 'Ingen pakker i dette filteret' : 'Ingen pakker på vei'}</div>`);
          if (nDel && !F) out.push(`<button class="more press" data-act="pdel">${this.ui.pDel ? 'Skjul leverte' : `Vis leverte (${nDel})`}</button>`);
        }
      });
      return out.join('');
    }
    // 46 · «Når kommer Posten» med PostNord bakt inn – ÉTT kompakt kort. → { html, ref: oppdater-knappen vises }
    _postCard(h, c, accts, pnOn, F) {
      const id = srcOf(h, c, 'post'); if (id) { this.s(id); this.s(id + '_relative'); }
      const P = postData(h, id);
      const now = d0(new Date()), n = P && P.next ? dayDiff(now, P.next) : null, today = n === 0;
      const days = []; for (let d = now; days.length < 10; d = addD(d, 1)) if (d.getDay() !== 0 && d.getDay() !== 6) days.push(d);
      // 42.1: leveringer per dag – leveringskalenderen(e) (bare dagene som vises, mens popupen er åpen); uten kalender:
      // pakkenes planlagte tidsvindu (planned_from/-to)
      const pnEv = new Map(), add = (k, e) => { if (!pnEv.has(k)) pnEv.set(k, []); pnEv.get(k).push(e); };
      const items = pnOn ? pnParcels(h, c, this._pnLive) : [];
      if (pnOn) {
        const end = addD(days[days.length - 1], 1), cals = uniq(accts.map((A) => A.roles.deliveries));
        if (cals.length) cals.forEach((cal) => { this.s(cal); (this._ev(cal, now, end) || []).forEach((e) => { for (let d = d0(e.start), i = 0; d <= d0(e.end) && i < 15; d = addD(d, 1), i++) add(dk(d), e); }); });
        else items.filter((x) => x.dir !== 'out' && x.kind !== 'levert' && x.from && d0(x.from) >= now && x.from < end).forEach((x) => add(dk(x.from), { summary: x.name, uid: x.code, start: x.from, end: x.to || x.from, allDay: !hasT(x.from), x }));
      }
      const has = (k) => pnEv.has(k);
      let rel = P && P.next ? (n === 0 ? 'I dag' : n === 1 ? 'I morgen' : n <= 6 ? `På ${DAG_L[P.next.getDay()]}` : dShort(P.next)) : '–';
      let sub = !P ? '' : P.rel && P.rel.toLowerCase() !== rel.toLowerCase() ? P.rel : P.next ? `${DAG_L[P.next.getDay()]} ${dShort(P.next)}${n > 1 ? ' · ' + relDays(n) : ''}` : '';
      // 36.6: valgt dag (trykk i rutenettet) → «I morgen» / «Om 5 dager» + «tirsdag 29. sep · posten kommer|ingen utdeling»
      const sk = this.ui.pSel && days.some((d) => dk(d) === this.ui.pSel) ? this.ui.pSel : null;
      if (sk) { const sd = fromKey(sk), sn = dayDiff(now, sd); rel = sn === 0 ? 'I dag' : sn === 1 ? 'I morgen' : `Om ${sn} dager`; sub = `${DAG_L[sd.getDay()]} ${dShort(sd)}${P ? ' · ' + (P.dates.has(sk) ? 'posten kommer' : 'ingen utdeling') : ''}${has(sk) ? ' · PostNord-levering' : ''}`; }
      // Leveringsrad: valgt dag (begge valgene) · uten valgt dag bare «Alltid» (pn_row) → neste levering (i dag eller senere)
      let dEv = [];
      if (sk) dEv = (pnEv.get(sk) || []).slice().sort((a, b) => a.start - b.start);
      else if (c.pn_row === 'alltid') { const k = [...pnEv.keys()].filter((x) => x >= dk(now)).sort()[0]; if (k) dEv = pnEv.get(k).slice().sort((a, b) => a.start - b.start).slice(0, 1); }
      const dRows = dEv.map((e) => this._pnDay(e, items)).join('');
      const grid = P || pnEv.size ? `<div class="pg">${days.map((d) => { const k = dk(d), on = !!P && P.dates.has(k), sl = k === sk; return `<button class="pd ${on ? 'on' : ''} ${k === dk(now) ? 'today' : ''} ${sl ? 'sel' : ''}" data-act="psel" data-v="${k}" data-haptic="selection" aria-pressed="${sl}" aria-label="${esc(`${DAG_L[d.getDay()]} ${dShort(d)}${P ? ' · ' + (on ? 'posten kommer' : 'ingen utdeling') : ''}${has(k) ? ' · PostNord-levering' : ''}`)}"><span>${UKE[(d.getDay() + 6) % 7]}</span><b class="num">${d.getDate()}</b>${has(k) ? '<i class="pnd" aria-hidden="true"></i>' : ''}</button>`; }).join('')}</div>` : '';
      const chips = pnOn ? this._pnChips(h, accts, F) : { html: '', ref: false };
      // Uten Posten-sensor: toppen viser «–» + «Velg entitet» (kortet, chipsene og leveringsraden vises likevel)
      const chip = P ? `<span class="pchip ${today ? 'on' : ''}">${today ? 'Posten kommer i dag' : 'Ikke i dag'}</span>` : '';
      const subH = P || sk ? `<span class="psub">${esc(sub)}</span>` : this._missing('Ingen Posten-sensor', 'kilder');
      return { ref: chips.ref, html: `<div class="card post" data-ent="${esc(id || '')}"><div class="pt"><div class="grow"><span class="ptl">${M.icon('mdi:email', 16)}Når kommer Posten</span><b class="prel">${esc(rel)}</b>${subH}</div>${chip}</div>${grid}${dRows}${chips.html}</div>` };
    }
    // 46 · leveringsraden: «PostNord · <avsender/pakke>» + «<vindu/estimat> · <status> · <leveringsmåte>» (pakke-attributtene)
    _pnDay(e, items) {
      const u = String(e.uid || '').toUpperCase(), sm = String(e.summary || '').trim();
      const x = e.x || items.find((y) => y.code && (y.code === u || sm.toUpperCase().includes(y.code))) || items.find((y) => y.dir !== 'out' && y.name && y.name === sm) || null;
      const win = e.allDay ? dayWord(e.start) : pnWin(e.start, e.end > e.start ? e.end : null);
      const line = [win || (x && x.from ? pnWin(x.from, x.to) : ''), x ? x.label : '', x ? x.method : ''].filter(Boolean).join(' · ');
      return `<div class="pnday" data-key="pnday-${esc(e.uid || sm)}-${e.start.getTime()}"><span class="pndi">${M.icon('mdi:truck-delivery', 18)}</span><span class="grow evc"><b class="ell">PostNord · ${esc((x && x.name) || sm || 'Pakke')}</b><span class="ell">${esc(line)}</span></span></div>`;
    }
    // 46 · tall-chips (summert over kontoene) = filter på Pakker + oppdater (button.press på alle kontoenes knapper)
    _pnChips(h, accts, F) {
      const ids = (r) => uniq(accts.map((A) => A.roles[r]));
      const num = (r) => { const L = ids(r).map((id) => h.states[id]).filter((st) => st && st.state !== '' && !isNaN(Number(st.state))); return L.length ? L.reduce((s, st) => s + Number(st.state), 0) : null; };
      const btns = ids('refresh'), spin = this._pnSpin && Date.now() - this._pnSpin.t < 600;
      const tiles = PN_TILES.map(([k, lab, r, sh]) => { const v = num(r), on = !!F && F.k === k, t = `${lab}: ${v == null ? 'ukjent' : v}`; return `<button class="pnch press ${on ? 'on' : ''}" data-act="pnf" data-v="${k}" data-g="*" data-haptic="selection" aria-pressed="${on}" title="${esc(t)}" aria-label="${esc(t)}"><b class="num">${v == null ? '–' : v}</b><span>${esc(sh)}</span></button>`; }).join('');
      const ref = btns.length ? `<button class="pnr press ${spin ? 'spin' : ''}" data-act="pnref" data-g="*" data-ids="${esc(btns.join(','))}" data-haptic="off" title="Oppdater PostNord" aria-label="Oppdater PostNord">${M.icon('mdi:refresh', 18)}</button>` : '';
      return { ref: !!ref, html: `<div class="pnchs" data-key="pnchs">${tiles}${ref}</div>` };
    }
    _pRow(x) {
      const [lab, col, icon] = PK[x.kind], open = this.ui.pOpen === x.id;
      const sub = x.kind === 'stale' && x.idleH != null ? `Ingen oppdatering på ${x.idleH} t` : x.events[0] ? x.events[0].text : x.state;
      return `<div class="pkr ${open ? 'open' : ''}" data-key="pk-${esc(x.id)}"><button class="pkh press" data-act="popen" data-v="${esc(x.id)}" aria-expanded="${open}"><span class="pkic" style="background:${TONE(col, 0.2)};color:${AT(col)}">${M.icon(icon, 22)}</span><span class="grow evc"><b class="ell">${esc(x.name)}</b><span class="ell">${esc(sub)}</span></span><span class="pkst" style="color:${AT(col)}">${esc(lab)}</span>${M.icon(open ? 'mdi:chevron-up' : 'mdi:chevron-down', 20, 'color:var(--ki-text-mid, #979797)')}</button>
        ${open ? `<div class="pkb">${x.kind === 'stale' && x.idleH != null ? `<div class="warn">${M.icon('mdi:clock-alert-outline', 18)}Ingen oppdatering på ${x.idleH} t</div>` : ''}
          ${x.facts.length || x.number || x.eta ? `<div class="facts">${x.number ? `<span><i>Sporingsnummer</i><b>${esc(x.number)}</b></span>` : ''}${x.eta ? `<span><i>Forventet</i><b>${esc(dShort(x.eta))}</b></span>` : ''}${x.facts.map(([k, v]) => `<span><i>${esc(k)}</i><b>${esc(v)}</b></span>`).join('')}</div>` : ''}
          ${x.events.length ? `<div class="log">${x.events.slice(0, 8).map((e, i) => `<div class="lg ${i === 0 ? 'on' : ''}"><i></i><span class="grow"><b>${esc(e.text)}</b><span>${esc([e.t ? `${dShort(e.t)} ${hm(e.t)}` : '', e.where].filter(Boolean).join(' · '))}</span></span></div>`).join('')}</div>` : '<div class="none">Ingen hendelser ennå</div>'}
          <div class="pka">${x.home ? `<button class="pri press" data-act="phome" data-v="${esc(x.home)}">${M.icon('mdi:home-import-outline', 18)}Bestill hjemlevering</button>` : ''}<button class="press" data-act="more" data-id="${esc(x.id)}">${M.icon('mdi:information-outline', 18)}Detaljer</button></div></div>` : ''}</div>`;
    }
    // Fiks 40.3: PostNord-rad – bærer-chip, status i farge, meta-linje; utvidet: hendelser, fakta (2 kolonner),
    // «Åpne i PostNord», «Slutt å spore» (bare sporingskode-hubens egne pakker) og «Detaljer».
    _pnRow(x) {
      const open = this.ui.pOpen === x.id, col = x.col, S = (this.hass && this.hass.services && this.hass.services.postnord) || {};
      const canUn = !x.account && x.dir !== 'out' && !!S.untrack_parcel;
      return `<div class="pkr pn ${open ? 'open' : ''}" data-key="pk-${esc(x.id)}" data-kind="${x.kind}" data-st="${esc(x.status)}"><button class="pkh press" data-act="popen" data-v="${esc(x.id)}" aria-expanded="${open}"><span class="pkic" style="background:${TONE(col, 0.2)};color:${AT(col)}">${M.icon(x.icon, 22)}</span><span class="grow evc"><span class="pkn"><b class="ell">${esc(x.name)}</b><span class="ctag">${esc(x.chip || 'PostNord')}</span></span><span class="ell pmeta">${esc(x.meta)}</span></span><span class="pkst" style="color:${AT(col)}">${esc(x.label)}</span>${M.icon(open ? 'mdi:chevron-up' : 'mdi:chevron-down', 20, 'color:var(--ki-text-mid, #979797)')}</button>
        ${open ? `<div class="pkb">${x.kind === 'stale' ? `<div class="warn" style="background:${TONE(col, 0.16)};color:${AT(col)}">${M.icon(x.icon, 18)}${esc(x.raw || x.label)}</div>` : ''}
          ${x.events.length ? `<div class="log">${x.events.slice(0, 8).map((e, i) => `<div class="lg ${i === 0 ? 'on' : ''}"><i></i><span class="grow"><b>${esc(e.text)}</b><span>${esc([e.t ? `${dShort(e.t)} ${hm(e.t)}` : '', e.where].filter(Boolean).join(' · '))}</span></span></div>`).join('')}</div>` : ''}
          ${x.facts.length ? `<div class="facts">${x.facts.map(([k, v]) => `<span><i>${esc(k)}</i><b>${esc(v)}</b></span>`).join('')}</div>` : ''}
          <div class="pka">${x.url ? `<a class="press lnk" data-act="plink" href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${M.icon('mdi:open-in-new', 18)}Åpne i PostNord</a>` : ''}${canUn ? `<button class="press" data-act="pnun" data-v="${esc(x.code)}" data-haptic="off">${M.icon('mdi:package-variant-remove', 18)}Slutt å spore</button>` : ''}${x.sensor ? `<button class="press" data-act="more" data-id="${esc(x.sensor)}">${M.icon('mdi:information-outline', 18)}Detaljer</button>` : ''}</div></div>` : ''}</div>`;
    }
    // 42.2/46: Oppdater → button.press på alle kontoenes oppdater-knapper; ikonet roterer 360° (0,6 s), haptic success
    _pnRefresh(el) {
      const h = this.hass, ids = String(el.dataset.ids || '').split(',').filter(Boolean);
      if (!h || !ids.length) return;
      M.haptic('success');
      this._pnSpin = { k: el.dataset.g, t: Date.now() };
      el.classList.remove('spin'); void el.offsetWidth; el.classList.add('spin');
      clearTimeout(this._pnSpinT); this._pnSpinT = setTimeout(() => { this._pnSpin = null; this._upd(); }, 650);
      ids.forEach((id) => { Promise.resolve(h.callService('button', 'press', { entity_id: id })).catch((e) => { M.haptic('warning'); M.toast('Kunne ikke oppdatere: ' + ((e && e.message) || e)); }); });
    }
    async _pnUntrack(code) {
      const h = this.hass, S = (h && h.services && h.services.postnord) || {};
      if (!code || !S.untrack_parcel) { M.haptic('warning'); M.toast(PN_SETUP); return; }
      try {
        await h.callService('postnord', 'untrack_parcel', { tracking_code: code });
        M.haptic('success'); M.toast('Sluttet å spore pakken');
        if (this._pnLive) this._pnLive.delete('pn:' + code);
        this.setUI({ pOpen: null });
      } catch (e) { M.haptic('warning'); M.toast('Kunne ikke fjerne sporingen: ' + ((e && e.message) || e)); }
    }
    async _pSave() {
      const num = String(this.ui.pNum || '').trim().replace(/\s+/g, '');
      if (num.length < 6) { M.haptic('warning'); M.toast('Skriv inn sporingsnummeret'); return; }
      // Fiks 40.4: PostNord-kode (…SE/DK/FI eller 11–17 sifre) → postnord.track_parcel. Uten PostNord: som før.
      const hs = (this.hass && this.hass.services) || {}, pnSvc = !!(hs.postnord && hs.postnord.track_parcel);
      if (pnLooks(num) && (pnSvc || (pnPresent(this.hass) && (/(SE|DK|FI)$/i.test(num) || !hs.norwegian_parcel_tracker)))) {
        if (!pnSvc) { M.haptic('warning'); this.setUI({ pMsg: PN_SETUP }); return; }
        try {
          await this.hass.callService('postnord', 'track_parcel', { tracking_code: num.toUpperCase() });
          M.haptic('success'); M.toast('Pakken spores i PostNord'); this.setUI({ pAdd: false, pNum: '', pMsg: null });
        } catch (e) { M.haptic('warning'); M.toast('Kunne ikke legge til: ' + ((e && e.message) || e)); }
        return;
      }
      const h = this.hass, S = (h.services && h.services.norwegian_parcel_tracker) || {};
      const svc = Object.keys(S).find((k) => /add|track|spor/.test(k)) || 'add_parcel';
      try { await h.callService('norwegian_parcel_tracker', svc, { tracking_number: num }); M.haptic('success'); M.toast('Pakken spores'); this.setUI({ pAdd: false, pNum: '' }); } catch (e) { M.haptic('failure'); M.toast('Kunne ikke legge til: ' + ((e && e.message) || e)); }
    }

    /* ---------------------------------------------------------- handlinger */
    onInput(name, el, e, kind) {
      if (name === 'hq') { this._ui = { ...this._ui, q: el.value }; clearTimeout(this._qT); this._qT = setTimeout(() => this.update(), kind === 'change' ? 0 : 180); return; }
      if (name === 'bname') this._ui.bName = el.value;
      if (name === 'bdate') this._ui.bDate = el.value;
      if (name === 'pnum') { this._ui.pNum = el.value; if (this._ui.pMsg) this.setUI({ pMsg: null }); }
    }
    onAction(name, el, ev) {
      const d = el.dataset;
      const step = (k, v) => { const n = Number(d.d); this.setUI({ [k]: n === 0 ? 0 : (Number(this.ui[k]) || 0) + n }); };
      switch (name) {
        case 'tab': if (d.v === this.tab) return; return this.setUI({ tab: d.v, btn: 'view' });
        case 'mstep': this._ui.selDay = null; return step('mOff');
        case 'hstep': return step('hOff');
        case 'fstep': this._ui.fSel = null; return step('fOff');
        case 'selday': return this.setUI({ selDay: d.v });
        case 'fsel': return this.setUI({ fSel: d.v });
        case 'calmenu': M.haptic('light'); return this._calMenu(el);
        case 'hseg': return this.setUI({ hSeg: d.v });
        case 'hqclr': return this.setUI({ q: '' });
        case 'hshow': { const s = fromKey(d.v), now = d0(new Date()); return this.setUI({ hSeg: 'kalender', hOff: (s.getFullYear() - now.getFullYear()) * 12 + s.getMonth() - now.getMonth() }); }
        case 'ff': { if (d.v === this._fFilter()) return; const o = { ff: d.v, fmore: false }; if (this.tab === 'framover' && this._view('framover') === 'maned') Object.assign(o, this._fJump(d.v) || {}); return this.setUI(o); }
        case 'fmore': return this.setUI({ fmore: !this.ui.fmore });
        case 'mdet': { this.__mi = null; const x = this._mItems()[Number(d.i)]; return this._mDetail(x); }
        case 'evd': { if (d.cal) M.moreInfo(this, d.cal); return; }
        case 'badd': return this.setUI({ bAdd: !this.ui.bAdd });
        case 'bsave': return this._bSave();
        case 'padd': return this.setUI({ pAdd: !this.ui.pAdd, pMsg: null });
        case 'prefresh': if (d.id && this.hass) { Promise.resolve(this.hass.callService('button', 'press', { entity_id: d.id })).then(() => M.toast('Oppdaterer pakkene …')).catch((e) => { M.haptic('warning'); M.toast('Kunne ikke oppdatere: ' + ((e && e.message) || e)); }); } return;
        case 'pnun': return this._pnUntrack(d.v);
        // 42.2: tall-flis = filter på Pakker (trykk igjen fjerner); «Leverte» slår også på «Vis leverte»
        case 'pnf': { const cur = this.ui.pnF, same = cur && cur.k === d.v && cur.a === d.g; return this.setUI(same ? { pnF: null } : { pnF: { k: d.v, a: d.g }, ...(d.v === 'lev' ? { pDel: true } : {}) }); }
        case 'pnfclr': return this.setUI({ pnF: null });
        case 'pnref': return this._pnRefresh(el);
        case 'plink': return; // lenken åpner PostNord selv (haptic fra basekortet)
        case 'psave': return this._pSave();
        case 'pdel': return this.setUI({ pDel: !this.ui.pDel });
        case 'psel': return this.setUI({ pSel: this.ui.pSel === d.v ? null : d.v }); // 36.6: trykk samme dag igjen → neste utdeling
        case 'popen': return this.setUI({ pOpen: this.ui.pOpen === d.v ? null : d.v });
        case 'phome': if (d.v) window.open(d.v, '_blank', 'noopener'); return;
        default: return super.onAction(name, el, ev);
      }
    }
    afterRender() {
      const R = this.shadowRoot;
      if (M.glassDrag) R.querySelectorAll('.seg').forEach((s) => M.glassDrag(s, { axis: 'x' }));
      // Fiks 28.13: fanelinjen – hold 400 ms + dra = omorganiser (tab_order), sideveis dra = Liquid Glass-valg
      if (M.tabRow) M.tabRow(this, R.querySelector('.top>.tabs'), { active: () => this.tab, order: () => tabOrder(this.config), field: 'tab_order' });
      // Hytta-karusellen: scroll-snap, prikkene følger (MSH.snapCarousel)
      const car = R.querySelector('.hcar');
      if (car && M.snapCarousel) M.snapCarousel(car, { dots: () => R.querySelector('.hdots'), index: () => Number(this.ui.hCar) || 0, onIndex: (i) => { if (i !== (Number(this.ui.hCar) || 0)) this.setUI({ hCar: i }); }, haptic: true });
    }
    get styles() {
      return `
        :host{display:block;width:100%}
        .wrap{display:flex;flex-direction:column;gap:var(--msh-gap,8px)}
        .pane{display:flex;flex-direction:column;gap:var(--msh-gap,8px);min-width:0}
        /* 33.4: fanehøyde (MSH.tabH) – pille H (40), sporet H + 8, knappen = sporets høyde */
        .top{display:flex;align-items:center;gap:8px;min-width:0;--mbh:calc(${TV('th', 40)} + 8px)}
        .tabs{flex:1;min-width:0;display:flex;gap:2px;padding:4px;border-radius:calc(${TV('th', 40)} / 2 + 4px);background:var(--ki-surface-3, var(--gray200,#3a3a3a));position:relative;touch-action:pan-y;overflow:hidden}
        .tabs .itab{color:var(--ki-text-2, var(--gray800,#afafaf));background:transparent}
        .tabs .itab.on,.tabs .ntab.on{background:${C.accent};color:var(--ki-on-accent, #2a1720);font-weight:500}
        ${M.iconTabs.css('.tabs.itabs')}
        .tabs.itabs>.itab{min-width:30px;height:${TV('th', 40)};border-radius:calc(${TV('th', 40)} / 2);font-size:${TV('tf', 14)}}
        .tabs.itabs>.itab ha-icon{--mdc-icon-size:${TV('ti', 20)} !important;width:${TV('ti', 20)} !important;height:${TV('ti', 20)} !important}
        .tabs.itabs>.itab[aria-selected="true"]{padding:0 12px 0 10px}
        .tabs.names{overflow-x:auto;touch-action:pan-x}
        .ntab{flex:1 0 auto;height:${TV('th', 40)};padding:0 ${TV('tp', 14)};border-radius:calc(${TV('th', 40)} / 2);font-size:${TV('tf', 13)};white-space:nowrap;color:var(--ki-text-2, var(--gray800,#afafaf))}
        .mode{position:relative;flex:none;display:flex;align-items:center}
        .mb{width:var(--mbh, 48px);height:var(--mbh, 48px);border-radius:calc(var(--mbh, 48px) / 2);background:var(--ki-surface, var(--gray200,#3a3a3a));overflow:hidden;touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;color:var(--ki-text, var(--white,#fafafa));box-shadow:${C.edge}}
        .rail{display:flex;flex-direction:column;transition:transform .3s cubic-bezier(.34,1.4,.64,1)}
        .rail>span{width:var(--mbh, 48px);height:var(--mbh, 48px);display:grid;place-items:center;flex:none}
        .mdots{position:absolute;right:5px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:4px;pointer-events:none}
        .mdots i{width:4px;height:4px;border-radius:2px;background:var(--ki-text-3, var(--gray500,#696969));transition:background .2s,height .2s}
        .mdots i.on{height:10px;background:var(--ki-text, var(--gray1000,#e1e1e1))}
        .miss{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:8px;padding:22px 16px;border-radius:24px;background:var(--ki-surface, var(--gray200,#3a3a3a));color:var(--ki-text-mid, var(--gray700,#979797));font-size:14px}
        .miss .mdash{font-size:22px;color:var(--ki-text, var(--white,#fafafa))}
        .miss .mt{flex-basis:100%;text-align:center;font-size:12px}
        .sh{display:flex;align-items:center;gap:8px;min-height:40px;padding:0 4px}
        .st{flex:1;font-size:18px;font-weight:500}
        .meta{font-size:13px;color:var(--ki-text-mid, var(--gray700,#979797))}
        .add{width:40px;height:40px;border-radius:20px;display:grid;place-items:center;background:var(--ki-surface, var(--gray200,#3a3a3a));flex:none}
        .none{padding:16px;text-align:center;color:var(--ki-text-mid, var(--gray700,#979797));font-size:13px}
        .none.sm{padding:4px 8px 8px}
        .card.none{padding:18px}
        .day{display:flex;flex-direction:column;gap:6px}
        .dh{display:flex;align-items:center;gap:8px;padding:6px 6px 0;font-size:13px;font-weight:500;color:var(--ki-text-2, var(--gray800,#afafaf))}
        .dn{height:20px;min-width:20px;padding:0 6px;border-radius:10px;background:var(--ki-surface-2, var(--gray300,#404040));font-size:11px;display:inline-grid;place-items:center;color:var(--ki-text-1, var(--gray900,#c7c7c7))}
        .evl{padding:4px;display:flex;flex-direction:column}
        .ev,.mr,.stay,.brow{display:flex;align-items:center;gap:10px;min-height:56px;padding:6px 12px;border-radius:20px;text-align:left;width:100%}
        .ev+.ev,.mr+.mr,.ev+.mr,.stay+.stay,.brow+.brow{box-shadow:inset 0 1px 0 ${WA(0.05)}}
        .evt{width:78px;flex:none;font-size:12px;color:var(--ki-text-2, var(--gray800,#afafaf))}
        .evd{width:8px;height:8px;border-radius:4px;flex:none}
        .evc{display:flex;flex-direction:column;gap:2px}
        .evc b{font-size:14px;font-weight:500}
        .evc>span{font-size:12px;color:var(--ki-text-mid, var(--gray700,#979797))}
        .mcard{padding:10px 10px 12px}
        .mhd{display:flex;align-items:center;gap:6px;padding:0 0 8px}
        .mtl{display:flex;flex-direction:column;align-items:center}
        .mtl b{font-size:15px;font-weight:500}.mtl span{font-size:11px;color:var(--ki-text-mid, var(--gray700,#979797))}
        .nb{width:40px;height:40px;border-radius:20px;display:grid;place-items:center;background:var(--ki-surface-2, var(--gray300,#404040));flex:none}
        .chip{height:30px;padding:0 12px;border-radius:15px;background:var(--ki-surface-2, var(--gray300,#404040));font-size:12px;display:inline-flex;align-items:center;gap:6px;flex:none}
        .mg{display:grid;grid-template-columns:22px repeat(7,minmax(0,1fr));gap:4px}
        .wd{font-size:11px;color:var(--ki-text-3, var(--gray600,#7f7f7f));text-align:center;padding-bottom:2px}
        .wn{font-size:10px;color:var(--ki-text-lo, var(--gray500,#696969));display:grid;place-items:center}
        .gd{position:relative;aspect-ratio:1;min-height:34px;border-radius:12px;display:grid;place-items:center;font-size:13px;background:var(--ki-surface-2, var(--gray300,#404040))}
        .gd.out{opacity:.35}
        .gd.today{box-shadow:inset 0 0 0 2px var(--ki-text, var(--gray1000,#e1e1e1))}
        .gd.sel{background:${C.accent};color:var(--ki-on-accent, #2a1720);font-weight:600}
        .gd .bd{position:absolute;top:2px;right:2px;min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:var(--ki-pill-bg, var(--gray1000,#e1e1e1));color:var(--ki-pill-fg, #232323);font-style:normal;font-size:10px;font-weight:600;display:grid;place-items:center}
        .gd.sel .bd{background:var(--ki-on-accent, #2a1720);color:var(--ki-pill-fg, #fafafa)}
        /* Fiks 24.1 · månedsvisning (Kalender/Framover) */
        .mvc{display:flex;flex-direction:column;min-width:0}
        .mvh{display:flex;align-items:center;gap:8px;padding:0 0 12px}
        .mvb{width:36px;height:36px;border-radius:18px;display:grid;place-items:center;background:var(--ki-surface, var(--gray200,#3a3a3a));color:var(--ki-text, var(--white,#fafafa));flex:none}
        .mvt{flex:1;min-width:0;text-align:center;font-size:15px;font-weight:600;color:var(--ki-text, var(--white,#fafafa));background:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .mv7{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:8px;touch-action:pan-y;-webkit-user-select:none;user-select:none}
        .mvw{font-size:12px;color:var(--ki-text-mid, var(--gray700,#979797));text-align:center;padding-bottom:2px}
        .mvd{position:relative;aspect-ratio:1;min-width:0;border-radius:50%;display:grid;place-items:center;font-size:15px;font-weight:500;background:var(--ki-surface, var(--gray200,#3a3a3a));color:var(--ki-text, var(--white,#fafafa))}
        .mvd.out{background:transparent;color:var(--ki-text-lo, #545454)}
        .mvd.today{box-shadow:inset 0 0 0 2px rgb(242 133 201)}
        .mvd.sel{background:linear-gradient(145deg, rgb(242 133 201) -10%, rgb(245 205 198) 100%);color:var(--ki-on-accent, #282828);box-shadow:none;font-weight:600}
        .mvn{position:absolute;top:0;left:0;min-width:18px;height:18px;padding:0 5px;box-sizing:border-box;border-radius:9px;background:rgb(102 209 158);color:var(--ki-on-accent, #282828);font-style:normal;font-size:10px;font-weight:600;display:grid;place-items:center}
        .mvn.hi{background:rgb(242 133 201)}
        .dp{padding:14px 12px 6px;border-radius:24px;background:var(--ki-surface, var(--gray200,#3a3a3a));display:flex;flex-direction:column}
        .dph{display:flex;align-items:baseline;gap:8px;padding:0 4px 10px}
        .dph b{font-size:15px;font-weight:600}.dph span{font-size:12px;color:var(--ki-text-mid, var(--gray700,#979797))}
        .dp>.dpr,.dp>.mr{box-shadow:inset 0 1px 0 ${WA(0.06)};border-radius:0}
        .dpr{display:flex;align-items:stretch;gap:12px;width:100%;padding:10px 4px;text-align:left;color:var(--ki-text, var(--white,#fafafa))}
        .dps{width:4px;border-radius:2px;flex:none;align-self:stretch}
        .dpc{display:flex;flex-direction:column;gap:2px;min-width:0}
        .dpt{font-size:13px;color:var(--ki-text-2, var(--gray800,#afafaf))}
        .dpc b{font-size:15px;font-weight:500}.dpc>span:last-child{font-size:12px;color:var(--ki-text-3, var(--gray600,#7f7f7f))}
        .dp>.none{padding:10px 4px 12px;text-align:left;box-shadow:inset 0 1px 0 ${WA(0.06)}}
        .gd.hg.plan{outline:2px dashed var(--pc, var(--ki-text-mid, #979797));outline-offset:-2px}
        .leg{display:flex;flex-wrap:wrap;gap:12px;padding:10px 4px 0;font-size:12px;color:var(--ki-text-2, var(--gray800,#afafaf))}
        .leg span{display:inline-flex;align-items:center;gap:6px}
        .leg i{width:10px;height:10px;border-radius:3px}
        .leg i.dash{border:1.5px dashed var(--ki-text-mid, var(--gray700,#979797))}
        .srch{display:flex;align-items:center;gap:8px;height:48px;padding:0 6px 0 16px;border-radius:24px;background:var(--ki-surface, var(--gray200,#3a3a3a))}
        .srch input{flex:1;min-width:0;height:100%;font-size:14px}
        .srch .x{width:36px;height:36px;border-radius:18px;display:grid;place-items:center;background:var(--ki-surface-2, var(--gray300,#404040))}
        .hres{padding:4px}
        .hrh{display:flex;align-items:center;gap:8px;padding:8px 10px}
        .hrh b{font-size:14px}.hrh .num{flex:1;font-size:12px;color:var(--ki-text-mid, var(--gray700,#979797))}
        .hcar{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;gap:0;touch-action:pan-x pan-y;overscroll-behavior-x:contain}
        .hs{flex:0 0 100%;scroll-snap-align:start;padding:0 1px}
        .hcard{position:relative;overflow:hidden;min-height:188px;border-radius:28px;padding:18px;display:flex;flex-direction:column;gap:12px;background:linear-gradient(145deg, color-mix(in srgb, var(--sc) 28%, var(--ki-surface, #3a3a3a)), var(--ki-surface, #3a3a3a) 70%);box-shadow:${C.edge}}
        .hct{display:flex;flex-direction:column;gap:4px;position:relative;z-index:1}
        .hct b{font-size:20px;font-weight:600}
        .hn{display:inline-flex;align-items:center;gap:4px;font-size:12px;color:var(--ki-text-1, var(--gray900,#c7c7c7))}
        .ppl{display:flex;position:relative;z-index:1}
        .av{width:34px;height:34px;border-radius:17px;display:grid;place-items:center;font-size:12px;font-weight:700;color:var(--ki-on-accent, #232323);flex:none}
        .ppl .av{margin-left:-8px;box-shadow:0 0 0 2px var(--ki-surface, #3a3a3a)}.ppl .av:first-child{margin-left:0}
        .hchips{display:flex;flex-wrap:wrap;gap:6px;position:relative;z-index:1}
        .hchip{height:26px;padding:0 10px;border-radius:13px;background:${BA(0.25)};font-size:12px;display:inline-flex;align-items:center;gap:6px}
        .hchip i{width:8px;height:8px;border-radius:4px;background:var(--sc)}
        .hnum{display:flex;gap:20px;margin-top:auto;position:relative;z-index:1}
        .hnum div{display:flex;flex-direction:column}
        .hnum b{font-size:26px;font-weight:500}.hnum span{font-size:12px;color:var(--ki-text-2, var(--gray800,#afafaf))}
        .illu{position:absolute;right:10px;bottom:6px;width:132px;color:var(--sc);opacity:.9}
        .illu svg{width:100%;display:block}
        .hdots{margin-top:-2px}
        .seg{display:flex;gap:2px;padding:4px;border-radius:22px;background:var(--ki-surface-3, var(--gray200,#3a3a3a));position:relative;touch-action:pan-y}
        .seg .sg{flex:1 1 0;min-width:0;height:36px;border-radius:18px;font-size:13px;color:var(--ki-text-2, var(--gray800,#afafaf));white-space:nowrap}
        .seg .sg.on{background:${C.accent};color:var(--ki-on-accent, #2a1720);font-weight:500}
        .stag{display:inline-flex;align-items:center;height:18px;padding:0 7px;border-radius:9px;font-size:11px;font-weight:500;background:color-mix(in srgb, var(--sc) calc(22% * var(--ki-tone-k, 1)), transparent);color:var(--scx, var(--sc));vertical-align:1px;margin-left:4px}
        .snt{font-size:12px;color:var(--ki-text-2, var(--gray800,#afafaf));flex:none}
        .snt.on{color:${AT(C.green)};font-weight:600}
        .stat{padding:14px}
        .bars{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:4px;height:140px;align-items:end}
        .bc{height:100%;display:flex;flex-direction:column;gap:4px;align-items:stretch}
        .bs{flex:1;display:flex;flex-direction:column-reverse;border-radius:6px;overflow:hidden;background:${WA(0.04)}}
        .bs i{display:block;width:100%}
        .bc span{font-size:10px;text-align:center;color:var(--ki-text-3, var(--gray600,#7f7f7f))}
        .tots{display:flex;flex-direction:column;gap:8px;margin-top:14px}
        .tot{display:flex;align-items:center;gap:8px;font-size:13px}
        .tot i{width:10px;height:10px;border-radius:5px}.tot b{font-size:16px;font-weight:600}
        .chips{display:flex;gap:6px;overflow-x:auto}
        .fc{height:36px;padding:0 16px;border-radius:18px;background:var(--ki-surface, var(--gray200,#3a3a3a));font-size:13px;color:var(--ki-text-1, var(--gray900,#c7c7c7));flex:none}
        .fc.on{background:${C.accent};color:var(--ki-on-accent, #2a1720);font-weight:500}
        .pst{width:40px;aspect-ratio:2/3;border-radius:8px;overflow:hidden;flex:none;background:var(--gray300,#404040);display:grid;place-items:center;color:var(--gray600,#7f7f7f)} /* ki-hex-ok: plakat/bakgrunnsbilde (mørk øy) */
        .pst img{width:100%;height:100%;object-fit:cover;display:block}
        .pst.lg{width:84px;border-radius:14px}
        .pst.xl{width:100%;border-radius:14px}
        .ph{background:repeating-linear-gradient(135deg,#3a3a3a 0 10px,#404040 10px 20px)} /* ki-hex-ok: plakat/bakgrunnsbilde (mørk øy) */
        .mt{font-size:12px;color:var(--ki-text-2, var(--gray800,#afafaf));flex:none}
        .hero{position:relative;display:block;width:100%;min-height:196px;border-radius:28px;overflow:hidden;text-align:left;background:var(--gray200,#3a3a3a);color:#fafafa;box-shadow:${C.edge}} /* ki-hex-ok: plakat/bakgrunnsbilde (mørk øy) */
        .bdrop{position:absolute;inset:0}
        .bdrop img{width:100%;height:100%;object-fit:cover;display:block;opacity:.55}
        .bdrop::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(40,40,40,0) 0%,rgba(40,40,40,.92) 85%)}
        .hin{position:relative;display:flex;align-items:flex-end;gap:14px;padding:16px;min-height:196px}
        .hcol{display:flex;flex-direction:column;gap:4px}
        .hchips{display:flex;gap:6px}
        .mchip{height:24px;padding:0 10px;border-radius:12px;background:rgba(255,255,255,.14);color:#fafafa;font-size:11px;font-weight:600;display:inline-flex;align-items:center} /* ki-hex-ok: plakat/bakgrunnsbilde (mørk øy) */
        .mchip.hl{background:${C.accent};color:#2a1720} /* ki-hex-ok: plakat/bakgrunnsbilde (mørk øy) */
        .htl{font-size:20px;font-weight:600;line-height:1.2}
        .hsub{font-size:13px;color:var(--gray900,#c7c7c7)} /* ki-hex-ok: plakat/bakgrunnsbilde (mørk øy) */
        .more{height:44px;border-radius:22px;background:var(--ki-surface, var(--gray200,#3a3a3a));font-size:13px;font-weight:500}
        .prow{display:flex;gap:10px;overflow-x:auto;padding-bottom:2px}
        .prow .pc{flex:0 0 108px}
        .pgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:10px}
        .pc{display:flex;flex-direction:column;gap:4px;text-align:left;min-width:0}
        .pc b{font-size:12px;font-weight:500}.pc>span:last-child{font-size:11px;color:var(--ki-text-mid, var(--gray700,#979797))}
        .bhero{position:relative;overflow:hidden;display:flex;align-items:center;gap:14px;min-height:112px;padding:18px;border-radius:28px;background:var(--ki-surface, var(--gray200,#3a3a3a));box-shadow:${C.edge}}
        .bhero.today{background:linear-gradient(135deg, ${M.alpha(C.purple, 0.55)}, ${M.alpha(C.pink, 0.35)})}
        .bhero .grow{display:flex;flex-direction:column;gap:2px;position:relative;z-index:1}
        .bhero b{font-size:19px;font-weight:600}.bhero .grow>span{font-size:13px;color:var(--ki-text-1, var(--gray900,#c7c7c7))}
        .bhero .lb{font-size:12px;color:var(--ki-text-mid, var(--gray700,#979797))}
        .bic{width:56px;height:56px;border-radius:28px;display:grid;place-items:center;background:${TONE(C.purple, 0.25)};color:${AT(C.purple)};flex:none;position:relative;z-index:1}
        .bhero.today .bic{background:${WA(0.2)};color:var(--ki-text, #fafafa)}
        .bdays{display:flex;flex-direction:column;align-items:center;flex:none}.bdays b{font-size:28px;font-weight:500}.bdays span{font-size:11px;color:var(--ki-text-mid, var(--gray700,#979797))}
        .conf{position:absolute;inset:0;pointer-events:none}
        .conf i{position:absolute;top:-10px;width:7px;height:12px;border-radius:2px;animation:kconf 3.2s linear infinite}
        @keyframes kconf{0%{transform:translateY(0) rotate(0);opacity:1}100%{transform:translateY(140px) rotate(540deg);opacity:0}}
        @media (prefers-reduced-motion: reduce){.conf i{animation:none;opacity:.6;top:auto;bottom:10px}}
        .pill{height:26px;padding:0 10px;border-radius:13px;background:var(--ki-surface-2, var(--gray300,#404040));font-size:12px;display:inline-flex;align-items:center;flex:none;color:var(--ki-text-1, var(--gray900,#c7c7c7))}
        .pill.on{background:${C.accent};color:var(--ki-on-accent, #2a1720);font-weight:600}
        .bform{display:flex;flex-wrap:wrap;gap:8px;padding:10px}
        .bform input{flex:1 1 140px;min-width:0;height:44px;border-radius:22px;background:var(--ki-surface-2, var(--gray300,#404040));padding:0 16px;font-size:14px;color-scheme:dark}
        .bform .pri,.pka .pri{height:44px;padding:0 16px;border-radius:22px;background:${C.accent};color:var(--ki-on-accent, #2a1720);font-weight:600;display:inline-flex;align-items:center;gap:6px;font-size:13px}
        .post{padding:16px;display:flex;flex-direction:column;gap:12px}
        .pt{display:flex;align-items:flex-start;gap:10px}
        .pt .grow{display:flex;flex-direction:column;gap:2px;align-items:flex-start;min-width:0}
        .ptl{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--ki-text-2, var(--gray800,#afafaf))}
        .ptl ha-icon{color:${AT(C.red)}}
        .pt .pchip{flex:none}
        .pt .miss{padding:2px 0 0;background:none;justify-content:flex-start;gap:6px;font-size:12px}.pt .miss .mdash,.pt .miss .mdash+span{display:none}.pt .miss .mt{flex-basis:auto;text-align:left}
        .psub{font-size:12px;color:var(--ki-text-mid, var(--gray700,#979797))}
        .pchip{height:24px;padding:0 10px;border-radius:12px;font-size:11px;font-weight:600;display:inline-flex;align-items:center;background:var(--ki-surface-2, var(--gray300,#404040));color:var(--ki-text-1, var(--gray900,#c7c7c7))}
        .pchip.on{background:${TONE(C.red, 0.25)};color:${AT(C.red)}}
        .prel{font-size:26px;font-weight:300;line-height:1.15;letter-spacing:-.02em}
        .pg{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px}
        .pd{display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 0;border:0;border-radius:14px;background:var(--ki-surface-2, var(--gray300,#404040));font:inherit;font-size:11px;color:var(--ki-text-mid, var(--gray700,#979797));cursor:pointer;-webkit-tap-highlight-color:transparent;transition:transform .12s,box-shadow .15s}
        .pd:active{transform:scale(.94)}
        .pd b{font-size:15px;font-weight:500;color:var(--ki-text-1, var(--gray900,#c7c7c7))}
        .pd.on{background:${TONE(C.red, 0.22)};color:${AT(C.red)}}.pd.on b{color:${AT(C.red)}}
        .pd.today{box-shadow:inset 0 0 0 2px var(--ki-text, var(--gray1000,#e1e1e1))}
        .pd.sel{box-shadow:inset 0 0 0 2px var(--ki-text, #fafafa)}
        .pkr{border-radius:20px}
        .pkr.open{background:var(--ki-surface-2, var(--gray300,#404040))}
        .pkr+.pkr{box-shadow:inset 0 1px 0 ${WA(0.05)}}
        .pkh{display:flex;align-items:center;gap:10px;width:100%;min-height:60px;padding:6px 10px;text-align:left}
        .pkic{width:44px;height:44px;border-radius:22px;display:grid;place-items:center;flex:none}
        .pkst{font-size:12px;font-weight:600;flex:none}
        .pkb{display:flex;flex-direction:column;gap:10px;padding:0 12px 12px}
        .warn{display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:14px;background:${TONE(C.orange, 0.16)};color:${AT(C.orange)};font-size:13px}
        .facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
        .facts span{display:flex;flex-direction:column;padding:8px 12px;border-radius:14px;background:var(--ki-surface, var(--gray200,#3a3a3a))}
        .facts i{font-style:normal;font-size:11px;color:var(--ki-text-mid, var(--gray700,#979797))}.facts b{font-size:13px;font-weight:500;overflow-wrap:anywhere}
        .log{display:flex;flex-direction:column}
        .lg{display:flex;gap:10px;padding:6px 2px;position:relative}
        .lg>i{width:10px;height:10px;border-radius:5px;background:var(--ki-text-3, var(--gray500,#696969));margin-top:4px;flex:none}
        .lg.on>i{background:${C.blue}}
        .lg .grow{display:flex;flex-direction:column}.lg b{font-size:13px;font-weight:500}.lg span span{font-size:11px;color:var(--ki-text-mid, var(--gray700,#979797))}
        .pka{display:flex;gap:8px;flex-wrap:wrap}
        .pka a.lnk{height:44px;padding:0 16px;border-radius:22px;background:var(--ki-surface, var(--gray200,#3a3a3a));display:inline-flex;align-items:center;gap:6px;font-size:13px;color:${AT(C.blue)};text-decoration:none}
        .evc>.pkn{display:flex;align-items:center;gap:8px;min-width:0;font-size:inherit;color:inherit}
        .ctag{height:20px;padding:0 7px;border-radius:10px;flex:none;display:inline-flex;align-items:center;font-size:10px;font-weight:600;background:var(--ki-surface-2, var(--gray300,#404040));color:${AT(C.blue)}}
        .pkr.open .ctag{background:var(--ki-surface, var(--gray200,#3a3a3a))}
        .pmsg{flex:1 1 100%;display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:14px;background:${TONE(C.orange, 0.16)};color:${AT(C.orange)};font-size:13px}
        .pd{position:relative}
        .pnd{position:absolute;top:5px;right:5px;width:7px;height:7px;border-radius:50%;background:${C.blue}}
        .pd.on .pnd{box-shadow:0 0 0 1.5px var(--ki-on-accent, #282828)}
        .pnday{display:flex;align-items:center;gap:12px;min-height:52px;padding:8px 12px;border-radius:20px;background:var(--ki-surface-2, var(--gray300,#404040))}
        .pnday b{font-size:13px;font-weight:500}.pnday .evc>span{font-size:12px;color:var(--ki-text-mid, var(--gray700,#979797))}
        .pndi{width:32px;height:32px;border-radius:16px;display:grid;place-items:center;flex:none;background:${C.blue};color:var(--ki-on-accent, #282828)}
        .pnchs{display:grid;grid-template-columns:repeat(4,minmax(min-content,1fr)) auto;gap:6px;align-items:center}
        .pnch{min-width:min-content;height:36px;padding:0 4px;border-radius:18px;display:flex;align-items:center;justify-content:center;gap:4px;white-space:nowrap;background:transparent;box-shadow:inset 0 0 0 1px ${WA(0.08)};color:var(--ki-text, var(--white,#fafafa));transition:background .15s,color .15s}
        .pnch b{font-size:14px;font-weight:600;line-height:1}
        .pnch span{flex:none;font-size:11px;line-height:1;color:var(--ki-text-mid, var(--gray700,#979797))}
        .pnch.on{background:${C.blue};box-shadow:none;color:var(--ki-on-accent, #282828)}.pnch.on span{color:var(--ki-on-accent, #282828)}
        .pnr{width:36px;height:36px;border-radius:18px;display:grid;place-items:center;flex:none;background:${WA(0.08)};color:var(--ki-text, var(--white,#fafafa))}
        .pnr.spin>*{animation:pnspin .6s ease}
        @keyframes pnspin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        .pnfc{height:30px;padding:0 8px 0 12px;border-radius:15px;display:inline-flex;align-items:center;gap:4px;flex:none;font-size:12px;font-weight:600;background:${C.blue};color:var(--ki-on-accent, #282828)}
        .pka button:not(.pri){height:44px;padding:0 16px;border-radius:22px;background:var(--ki-surface, var(--gray200,#3a3a3a));display:inline-flex;align-items:center;gap:6px;font-size:13px}
      `;
    }
  }
  M.POPUP_CARDS = M.POPUP_CARDS || [];
  if (!M.POPUP_CARDS.includes('msh-kalender-card')) M.POPUP_CARDS.push('msh-kalender-card'); // «Mellomrom» ligger i Visning-fanen
  M.REF_POPUPS = M.REF_POPUPS || {};
  if (!M.REF_POPUPS[HASH]) M.REF_POPUPS[HASH] = { nav: 'kalender' };
  M.kalender = { parseQuery, hyttaData, parcelsOf, postData, bdays, cands, legacyOf, monthGrid, weekNo, pnParcels, pnSensors, pnLooks, PNS, pnAccounts, pnRole };
  M.define('msh-kalender-card', Kalender, 'MSH Kalender', 'Kalender-popup (#kalender): kalendere, hyttebesøk, Sonarr/Radarr/Plex, bursdager, Posten og pakker.');
})();
