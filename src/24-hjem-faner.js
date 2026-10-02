/* msh-hjem-faner-card · Hjem: fanerad + romkort. Kilde: Hjem v2.dc.html (floorTabs/glassTabs, karusell, liste, aktuelt,
 * batterier, snarvei-fliser, sveip-slides, rom-merker, custEditVals/editVals/lookEd; layout: Fold-oppsettet via MSH.isFold, fiks 18.7/19.11).
 * Faner = Hjem + etasjer fra hass.floors (+ «Andre rom» + egne faner) + Aktuelt (+ Batterier når noe er lavt).
 * Rom = alle HA-områder (M.areas), nye rom dukker opp automatisk. Romkortene rendres med M.romkortHTML fra 32-romkort.js
 * (slås opp ved render-tid – filen lastes etter denne).
 * Fanerad (felles MSH.tabReorder, 05-tab-reorder.js): scroller vannrett, aktiv fane scrolles inn. Dra sideveis = scroll
 * (eller liquid glass-valg når alle faner får plass); hold inne 400 ms + dra = flytt fanen (config.tab_order) – mus og touch.
 */
(function () {
  const M = window.MSH, esc = M.esc, C = M.C;
  const get = (o, p) => String(p).split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  const TAB_H = { lav: 32, std: 38, mid: 44, hoy: 50, ekstra: 56 };
  /* Fiks 31.4 · fanestil (Etasjevelger.dc.html + Hjem v3 · fs): tab_style pille | glide | chips | to | popup | gear
   * (standard pille = dagens, uendret). popup/gear = felles MSH.tabBar (05-tab-bar.js, samme komponent som popupene og Lys).
   * tab_mode ikon | tekst | begge (standard begge) gjelder «Som popups». tab_icons.<fane> = eget ikon (alle stiler med ikon). */
  const TAB_STYLES = [['pille', 'Pille'], ['glide', 'Glidende · ikon'], ['chips', 'Chips med status'], ['to', 'To nivåer'], ['popup', 'Som popups'], ['gear', 'Tekst + tannhjul']];
  const TAB_MODES = [['ikon', 'Ikon'], ['tekst', 'Tekst'], ['begge', 'Begge']];
  M.HJEM_TAB_STYLES = TAB_STYLES;
  M.HJEM_TAB_MODES = TAB_MODES;
  const tabStyle = (c) => (TAB_STYLES.some(([v]) => v === (c && c.tab_style)) ? c.tab_style : 'pille');
  M.hjemTabStyle = tabStyle;
  // Kortnavn for etasjer (Hjem og Lys): «1. etasje» → «1. etg»
  M.floorShort = (n) => String(n == null ? '' : n).replace(/\s*etasje\b/i, ' etg').replace(/^\s+/, '');
  const OUT_RX = /(^|_)(ute|utendors|utvendig|outdoor|outside|hage|garden|yard|terrasse|uteomrade)(_|$)/;
  const VIEWS = [['karusell', 'Karusell'], ['liste', 'Kortliste'], ['batterier', 'Batterier']];
  const SLOTS = [['off', 'Av'], ['L-top', 'Venstre · over rom'], ['L-bottom', 'Venstre · under rom'], ['R-top', 'Høyre · over rom'], ['R-bottom', 'Høyre · under rom']];
  const KINDS = { lock: ['key', 'Dørlås'], garage: ['garage', 'Garasjeport'], alarm: ['shield', 'Alarm'], cam: ['videocam', 'Kamera'], ruter: ['tram', 'Ruter'], todo: ['handyman', 'Gjøremål'], dish: ['dishwasher_gen', 'Oppvaskmaskin'], vacr: ['robot_2', 'Støvsuger'], tv: ['tv', 'TV'], wash: ['local_laundry_service', 'Vaskemaskin'], dry: ['dry_cleaning', 'Tørketrommel'], jul: ['park', 'Jul'] };
  const KIND_ORDER = Object.keys(KINDS);
  // Aktuelt har ingen faste snarveier lenger (fiks 15.10): apparater, TV, dører, batterier og avvik vises dynamisk etter tabs.aktuelt.types.
  const TILE_DEF = { hjem: { lock: 'L-top', garage: 'L-top', alarm: 'L-bottom', cam: 'R-bottom', ruter: 'R-bottom', todo: 'R-bottom' }, aktuelt: {} };
  const STACK_DEF = { hjem: { cam: true, ruter: true } };
  const APPL = { dish: [/oppvask|dish.?wash/i, 'dishwasher_gen', 'Oppvaskmaskin', 180], wash: [/vaskemaskin|washing.?machine|washer/i, 'local_laundry_service', 'Vaskemaskin', 120], dry: [/t[øo]rketrommel|tumble|dryer/i, 'dry_cleaning', 'Tørketrommel', 90] };
  const SLIDES = { cal: ['calendar_month', 'Kalender'], vaer: ['partly_cloudy_day', 'Vær'], strom: ['bolt', 'Strøm'], trash: ['delete', 'Søppel'] };
  const TCOL = { gronn: C.green, gul: C.yellow, oransje: C.orange, rod: C.red, bla: C.blue };
  const TSW = [['ingen', 'Grå'], ['gronn', 'Grønn'], ['gul', 'Gul'], ['oransje', 'Oransje'], ['rod', 'Rød'], ['bla', 'Blå'], ['rosa', 'Rosa']];
  const WX = { 'clear-night': 'Klart', cloudy: 'Skyet', exceptional: 'Ekstremvær', fog: 'Tåke', hail: 'Hagl', lightning: 'Torden', 'lightning-rainy': 'Torden og regn', partlycloudy: 'Delvis skyet', pouring: 'Kraftig regn', rainy: 'Regn', snowy: 'Snø', 'snowy-rainy': 'Sludd', sunny: 'Sol', windy: 'Vind', 'windy-variant': 'Vind og skyer' };
  const pad2 = (n) => String(n).padStart(2, '0');
  // Fiks 20.13 (Hjem v3 · noRooms / layDefault aktuelt → []): Aktuelt-fanen (id aktuelt eller view 'aktuelt') viser aldri romkort
  const isAkt = (t) => !!t && (t.id === 'aktuelt' || t.kind === 'aktuelt' || t.view === 'aktuelt');
  M.hjemIsAkt = isAkt;
  // Fiks 31.4 · «To nivåer»: underraden har alle faner av typen Kortliste (etasjer, Andre rom, egne kortlister) – ikke Hjem/Aktuelt
  const isFloorTab = (t) => !!t && t.view === 'liste' && !isAkt(t) && t.kind !== 'hjem' && t.kind !== 'batterier';
  /* Fiks 16.11 · snarvei-fliser med egen entitet, navn, ikon, undertekst og fire handlinger.
   * Config per flis: tile_cfg.<id> = { kind, entity, name, icon, sub, tap_icon, tap_card, hold_icon, hold_card, side, pos }
   *   id = typen for første flis (lock, alarm, cam …), ekstra fliser av samme type: <type>_<n> (lock_2) med kind.
   *   Plassen per fane ligger som før i tiles.<fane>.<id>.slot (side-pos, f.eks. L-top); side/pos i tile_cfg er standard
   *   for en ny flis. Handlingene er HA-format ({ action: toggle | navigate | more-info | perform-action | none }),
   *   tom = standard fra DEF_TAP. Bakoverkompatibelt: overrides.<type> (entitet) og tap.<type> (card_hash/icon) leses
   *   når tile_cfg mangler. Fiks 16.7-aliaser (Dørlås): tap_action (begge trykk), hold_action, icon_hold_action. */
  const NAV = (h) => ({ action: 'navigate', navigation_path: h });
  const CAM_NAV = NAV('/dashboard-kamera'); // fiks 19.3: standard trykk på Kamera-flisen
  // Fiks 19.3 · «migrering» uten lagring: en Kamera-flis uten egen trykk-handling (tap_card, 16.7-aliaset tap_action eller
  // gammel tap.cam.card_hash) får Navigate /dashboard-kamera, og begge editorene viser den som valgt. Config skrives ikke
  // om (en lagret tile_cfg i ki-store ville ellers skygget for YAML-ens tile_cfg); en handling brukeren velger, lagres som før.
  const camTapShown = (c, id) => {
    const t = ((c && c.tile_cfg) || {})[id] || {}, legacy = id === 'cam' && ((c && c.tap) || {}).cam;
    return t.tap_card || t.tap_action || (legacy && legacy.card_hash) ? null : { ...CAM_NAV };
  };
  // Standardhandlinger (Hjem v3 · DEF_TAP): ic = trykk på ikonet, card = trykk på kortet, hold_ic / hold_card = hold.
  // Mangler en nøkkel: ikon → typens veksling (ellers som kortet), kort → typens popup (ellers more-info),
  // hold på kortet → more-info, hold på ikonet → ingen.
  const DEF_TAP = {
    lock: { ic: { action: 'toggle' }, card: NAV('#dorlas'), hold_ic: NAV('#dorlas'), hold_card: { action: 'more-info' } }, // 32.3: kortet åpner #dorlas
    garage: { ic: { action: 'toggle' }, card: NAV('#garasje'), hold_card: { action: 'more-info' } }, // 32.3: kortet åpner #garasje
    alarm: { ic: { action: 'toggle' }, card: NAV('#sikkerhet') },
    cam: { card: CAM_NAV }, // fiks 19.3: trykk → kamera-dashbordet (ikonet følger kortet), hold → more-info
    jul: { ic: { action: 'none' }, card: { action: 'none' } },
  };
  const TAP_KEYS = { ic: 'tap_icon', card: 'tap_card', hold_ic: 'hold_icon', hold_card: 'hold_card' };
  const TAP_FIELDS = [['ic', 'Trykk på ikonet'], ['card', 'Trykk på kortet'], ['hold_ic', 'Hold på ikonet'], ['hold_card', 'Hold på kortet']];
  const TAP_MODES = ['std', 'toggle', 'popup', 'hash', 'path', 'url', 'more', 'service', 'none']; // 30.3: + URL (3 × 3 ruter)
  const TAP_LABELS = { path: 'Navigate' }; // fiks 19.3: dashbord-sti (f.eks. /dashboard-kamera)
  // Entitetsdomene per flis-type (søkbar velger i «Tilpass Hjem» → Kort og GUI-editoren). Apparater: status-sensor.
  const TILE_DOM = { lock: 'lock', alarm: 'alarm_control_panel', cam: 'camera', todo: 'todo', garage: 'cover', ruter: 'sensor', tv: 'media_player', vacr: 'vacuum', dish: ['sensor', 'binary_sensor', 'switch'], wash: ['sensor', 'binary_sensor', 'switch'], dry: ['sensor', 'binary_sensor', 'switch'] };
  const tapLabel = (a, w) => {
    if (!a) return w === 'ic' ? 'typens handling' : w === 'card' ? 'typens popup / detaljer' : w === 'hold_card' ? 'More-info' : 'Ingen';
    if (a.action === 'toggle') return 'Veksle';
    if (a.action === 'more-info') return 'More-info';
    if (a.action === 'none') return 'Ingen';
    if (a.action === 'navigate') return a.navigation_path[0] === '#' ? a.navigation_path : 'Navigate · ' + a.navigation_path;
    return M.tap ? M.tap.label(a) : a.action;
  };
  /* Fiks 20.7 · Tekst per tilstand (Hjem v3 · STATE_TXT / stTxt / t.ed.stx). Config: tile_cfg.<id>.state_text =
   *   { <tilstand>: { title, sub } } – tomt felt = standardteksten. Tokens: {state} {default} {name} {attr:<navn>} {since}
   *   og [[[ js ]]] (entity, hass, states, state, def). Farge og ikon følger fortsatt tilstanden. Kamera: on = aktiv.
   *   Tilstander: domene-standard + attributes.options + tilstander sett i denne økten + de som har overstyring. */
  const STATE_TXT = {
    alarm: ['disarmed', 'armed_home', 'armed_away', 'armed_night', 'armed_vacation', 'armed_custom_bypass', 'arming', 'pending', 'triggered'],
    lock: ['locked', 'unlocked', 'locking', 'unlocking', 'open', 'opening', 'jammed'],
    garage: ['closed', 'open', 'opening', 'closing'],
    cam: ['on', 'off'],
    tv: ['on', 'off', 'playing', 'paused', 'idle', 'standby'],
    vacr: ['cleaning', 'docked', 'paused', 'returning', 'idle', 'error'],
  };
  const ST_SEEN = {}; // entitet → Set av tilstander sett i denne økten («sett i historikken»)
  /* Fiks 21.2 · lås/garasje/alarm: ÉN variant per tilstand – bakgrunn, ikon, tittel og undertekst kommer alltid fra samme
   * variant (aldri undertekst fra «solid» på nøytral bakgrunn). busy = nøytral + ikonet pulserer svakt (opasitet 1 → 0,5). */
  const TV_N = { bg: 'var(--ki-surface, var(--gray100, #2f2f2f))', fg: 'var(--ki-text, var(--white, #fafafa))', icon: null, circle: null, sub: 'var(--ki-text-2, var(--gray600, #7f7f7f))', flat: false };
  const TILE_VAR = {
    solid: { bg: 'var(--green, #66d19e)', fg: 'var(--ki-on-accent, #2f2f2f)', icon: 'var(--ki-on-accent, #2f2f2f)', circle: 'rgb(0 0 0/0.1)', sub: 'rgba(31,42,36,0.75)', flat: true },
    neutral: TV_N,
    busy: { ...TV_N, blink: true },
    error: { ...TV_N, icon: 'var(--ki-red-text, var(--red, #f28073))' },
    alert: { bg: 'var(--red, #f28073)', fg: 'var(--ki-on-accent, #2f2f2f)', icon: 'var(--ki-on-accent, #2f2f2f)', circle: 'rgb(0 0 0/0.1)', sub: 'rgba(42,23,23,0.75)', flat: true }, // alarm utløst
    pink: { bg: C.accent, fg: 'var(--ki-on-accent, #2f2f2f)', icon: 'var(--ki-on-accent, #2f2f2f)', circle: 'rgba(42,23,32,0.1)', sub: 'rgba(42,23,32,0.7)', flat: true }, // alarm armert
  };
  const tileVariant = (kind, v) => {
    v = String(v || '');
    if (!v || v === 'unavailable' || v === 'unknown' || v === 'jammed') return 'error';
    if (/^(locking|unlocking|opening|closing|arming|pending)$/.test(v)) return 'busy';
    if (kind === 'alarm') return v === 'triggered' ? 'alert' : /^armed/.test(v) ? 'pink' : 'neutral';
    return v === 'unlocked' || v === 'open' ? 'solid' : 'neutral';
  };
  const stStates = (hass, kd, ent, cfg) => {
    const base = STATE_TXT[kd];
    if (!base) return [];
    const st = ent && hass && hass.states[ent], opts = st && Array.isArray(st.attributes.options) ? st.attributes.options.map(String) : [];
    const seen = kd === 'cam' ? [] : [...(ST_SEEN[ent] || [])];
    return [...new Set([...base, ...opts, ...seen, ...Object.keys((cfg && cfg.state_text) || {}), 'unavailable', 'unknown'])];
  };
  // Standardtekst for en tilstand (plassholder i editorene) – samme regler som _kindModel
  const stDefault = (kd, v, nm) => {
    const un = v === 'unavailable' || v === 'unknown';
    switch (kd) {
      case 'lock': return { title: un ? '–' : v === 'jammed' ? 'Feil' : v === 'locked' ? 'Låst' : v === 'locking' ? 'Låser …' : v === 'unlocking' ? 'Låser opp …' : v === 'open' ? 'Åpen' : 'Ulåst', sub: 'Dørlås' };
      case 'alarm': { // Fiks 25: samme tekst som flisen (M.alarmState + state_map fra Sikkerhet)
        if (M.alarmState) { const id = 'alarm_control_panel.x', A = M.alarmState({ states: { [id]: { entity_id: id, state: v, attributes: {} } } }, { ...(M.sikCfg ? M.sikCfg() : {}), state_entity: id }, id); return { title: un ? '–' : A.text, sub: 'Alarm' }; }
        return { title: v === 'triggered' ? 'Utløst' : /^armed/.test(v) ? 'Armert' : /arming|pending/.test(v) ? 'Armerer' : 'Av', sub: 'Alarm' };
      }
      case 'garage': return { title: v === 'open' ? 'Åpen' : v === 'opening' ? 'Åpner' : v === 'closing' ? 'Lukker' : 'Lukket', sub: 'Garasjeport' };
      case 'cam': return { title: 'Kamera', sub: v === 'on' ? 'Bevegelse nå' : 'Ingen bevegelse' };
      case 'tv': return { title: nm || 'TV', sub: un ? '–' : ['off', 'standby'].includes(v) ? 'Av' : 'På' };
      case 'vacr': return { title: nm || 'Støvsuger', sub: { cleaning: 'Rengjør', paused: 'Pauset', returning: 'Kjører hjem', error: 'Feil', idle: 'Klar', docked: 'I laderen' }[v] || '–' };
      default: return { title: '', sub: '' };
    }
  };
  const sinceTxt = (iso) => {
    const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
    if (!iso || isNaN(s)) return '';
    if (s < 60) return 'i under 1 min';
    if (s < 3600) return `i ${Math.round(s / 60)} min`;
    if (s < 86400) return `i ${Math.round(s / 3600)} t`;
    return `i ${Math.round(s / 86400)} d`;
  };
  // Fyll tokens i en tekst. x = { hass, ent, state, def, name }
  const stTxt = (tpl, x) => {
    let t = String(tpl == null ? '' : tpl);
    if (!t.trim()) return null;
    const h = x.hass || M.lastHass, so = x.ent && h ? h.states[x.ent] : null;
    t = t.replace(/\[\[\[([\s\S]*?)\]\]\]/g, (m0, code) => {
      try { const r = new Function('entity', 'hass', 'states', 'state', 'def', code)(so, h, h ? h.states : {}, x.state, x.def); return r == null ? '' : String(r); } catch (e) { return '⚠ feil i kode'; }
    });
    return t.replace(/\{(state|default|name|since|attr:([^}]+))\}/g, (m0, k, a) => {
      if (k === 'state') return x.state != null ? x.state : '';
      if (k === 'default') return x.def != null ? x.def : '';
      if (k === 'name') return (so && so.attributes.friendly_name) || x.name || x.ent || '';
      if (k === 'since') return so ? sinceTxt(so.last_changed) : '';
      const v = so ? so.attributes[a.trim()] : null;
      return v == null ? '' : Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? JSON.stringify(v) : String(v);
    });
  };
  // Ny id for en ekstra flis av samme type: lock_2, lock_3 …
  M.hjemNewTileId = (c, kd) => { let n = 2; while (tileCfg(c, kd + '_' + n).kind || (c.links || {})[kd + '_' + n]) n++; return kd + '_' + n; };
  const tileCfg = (c, id) => ((c && c.tile_cfg) || {})[id] || {};
  const kindOf = (c, id) => (KINDS[id] ? id : (KINDS[tileCfg(c, id).kind] && id !== 'jul' ? tileCfg(c, id).kind : null));
  const extraIds = (c) => Object.keys((c && c.tile_cfg) || {}).filter((id) => !KINDS[id] && kindOf(c, id) && kindOf(c, id) !== 'jul').sort((a, b) => a.localeCompare(b, 'nb', { numeric: true }));
  const regOk = (hass, id) => { const e = M.regEntry(hass, id); return !e || !(e.hidden || e.hidden_by || e.disabled_by); };
  // Tidsvindu «HH:MM»–«HH:MM» (over midnatt er lov). Mangler en av dem → false.
  const hmMin = (v) => { const m = /^(\d{1,2})(?::(\d{2}))?$/.exec(String(v == null ? '' : v).trim()); return m ? Number(m[1]) * 60 + Number(m[2] || 0) : null; };
  const inWin = (from, to, d) => { const f = hmMin(from), t = hmMin(to); if (f == null || t == null || f === t) return false; const n = (d || new Date()).getHours() * 60 + (d || new Date()).getMinutes(); return f < t ? n >= f && n < t : n >= f || n < t; };
  const hhmm = (t) => { const d = new Date(t); return isNaN(d) ? '' : `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
  const listOf = (x) => (Array.isArray(x) ? x : x && typeof x === 'object' ? Object.keys(x).sort().map((k) => x[k]) : []);

  /* Fiks 17.11 · Ruter-flisen: neste avgang fra entur-sensoren (M.enturDepartures fra 47-ruter.js, lastes før render).
   * Minutter telles ned lokalt: due_at (HH:MM) regnes mot klokka, due_in/state minus tiden siden last_updated. */
  const ruterInfo = (st) => {
    if (!st) return null;
    const A = st.attributes || {}, D = M.enturDepartures ? M.enturDepartures(st) : [];
    const since = Math.max(0, (Date.now() - Date.parse(st.last_updated || st.last_changed || Date.now())) / 60000) || 0;
    const live = (v, at) => (v == null ? null : at ? v : Math.max(0, v - since));
    const d0 = D[0], d1 = D[1];
    let due = d0 ? live(d0.min, !!d0.at) : M.isNum(st.state) ? live(Number(st.state), false) : null;
    const route = d0 ? d0.line : String(A.route || A.line || '').split(' ')[0];
    const next = d1 ? live(d1.min, !!d1.at) : null;
    const delay = M.isNum(A.delay) ? Number(A.delay) : 0;
    if (due != null) due = Math.max(0, due);
    return { due, route, next: next != null ? Math.max(0, next) : null, delay, mode: String((d0 && d0.mode) || A.transport_mode || '').toLowerCase() };
  };
  M.hjemRuterInfo = ruterInfo;
  const RUTER_IC = { bus: 'mdi:bus', coach: 'mdi:bus', tram: 'mdi:tram', metro: 'mdi:subway-variant', rail: 'mdi:train', water: 'mdi:ferry', air: 'mdi:airplane' };
  const RUTER_FMT = 'Linje {route} om {due_in} min';
  // Undertekst etter format med tokens {route} {due_in} {delay} {next} {avvik}. Mangler tokenet i formatet, legges
  // forsinkelse / neste / avvik til bak (neste bare med show_next). Returnerer { text, html }.
  const ruterSub = (R, nAv, fmt, showNext) => {
    const f = String(fmt || RUTER_FMT);
    const now = R.due != null && R.due < 1;
    const part = { route: R.route || '', due_in: R.due == null ? '–' : now ? 'nå' : String(Math.round(R.due)) };
    const dl = R.delay > 0 ? `+${Math.round(R.delay)} min` : '', nx = showNext !== false && R.next != null ? `${Math.round(R.next)} min` : '', av = nAv ? `${nAv} avvik` : '';
    const tx = (s) => s.replace(/om \{due_in\} min/g, now ? 'nå' : 'om {due_in} min').replace(/\{due_in\} min/g, now ? 'nå' : '{due_in} min')
      .replace(/\{(route|due_in)\}/g, (m, k) => part[k]).replace(/Linje\s+(om|nå)/, '$1').trim();
    let text = tx(f), html = M.esc(text);
    const put = (tok, val, col, pre) => {
      if (f.includes('{' + tok + '}')) { text = text.replace('{' + tok + '}', val); html = html.replace('{' + tok + '}', val ? `<span style="color:${col}">${M.esc(val)}</span>` : ''); return; }
      if (!val) return;
      text += pre + val; html += M.esc(pre) + (col ? `<span style="color:${col}">${M.esc(val)}</span>` : M.esc(val));
    };
    put('delay', dl, 'var(--ki-orange-text, var(--orange, #f2b573))', ' · ');
    put('next', nx ? nx : '', '', ', deretter ');
    put('avvik', av, 'var(--ki-red-text, var(--red, #f28073))', ' · ');
    return { text: text.replace(/\s+·\s*$/, ''), html };
  };

  /* Fiks 17.16 · Kamera-flisen: aktiv-tilstand styrt av brukerens regler (tile_cfg.<id>.active).
   * active = { mode: any|all, triggers: [{ entity, attribute, op, value }], hold_min, only_when: [away|home|night|armed|entity],
   *   night: { from, to }, only_entity, quiet: { from, to }, style: tint|solid|pink|icon, color, icon, pulse, sub_active,
   *   sub_after, on_activate: none|haptic|popup|top }. Tom triggers = autokonfig (bevegelse/tilstedeværelse ved kameraet). */
  const CAM_ONLY = [['away', 'Alle borte'], ['home', 'Noen hjemme'], ['night', 'Natt'], ['armed', 'Alarm armert'], ['entity', 'Egen entitet']];
  const CAM_STYLES = [['tint', 'Tonet'], ['solid', 'Fylt'], ['pink', 'Rosa'], ['icon', 'Bare ikon']];
  const CAM_ACT = [['none', 'Ingen'], ['haptic', 'Haptic'], ['popup', 'Åpne #kamera'], ['top', 'Vis øverst']];
  const CAM_OPS = [['=', 'er'], ['!=', 'er ikke'], ['>', 'over'], ['<', 'under']];
  const camAuto = (hass, cam) => {
    if (!hass || !cam) return [];
    const area = M.areaOf(hass, cam), dev = (M.regEntry(hass, cam) || {}).device_id;
    return M.all(hass, 'binary_sensor', (x, i) => {
      const e = M.regEntry(hass, i) || {}, sameDev = !!dev && e.device_id === dev;
      const mot = ['motion', 'occupancy'].includes(x.attributes.device_class) || /_(person|bevegelse|motion)(_|$)/.test(i);
      return mot && (sameDev || (!!area && M.areaOf(hass, i) === area));
    });
  };
  /* Fiks 17.7 · Kalender-kortet (sveip-kortet «cal»): calendar = { entities: [], all_day: true, tap_action, hold_action }.
   * Handlingene lagres i HA-format (M.tap); spec-formen { action: default|popup|navigate|url, hash, navigation_path, url }
   * leses også. null = Standard (trykk: kalender-arket/more-info, hold: ingen). */
  const calNorm = (a) => {
    if (a && typeof a === 'object') {
      if (a.action === 'default') return null;
      if (a.action === 'popup') { const h = String(a.hash || a.navigation_path || '').trim(); return h ? { action: 'navigate', navigation_path: h[0] === '#' ? h : '#' + h } : null; }
      if (a.action === 'url' && !a.url_path && a.url) return { action: 'url', url_path: a.url };
      if (a.action === 'navigate' && /^https?:\/\//i.test(a.navigation_path || '')) return { action: 'url', url_path: a.navigation_path };
    }
    return M.tap ? M.tap.norm(a) : null;
  };
  M.hjemCalNorm = calNorm;
  M.hjemCam = { CAM_ONLY, CAM_STYLES, CAM_ACT, CAM_OPS, camAuto, listOf };
  const trigHit = (st, t) => {
    if (!st || M.unavailable(st)) return false;
    const raw = t.attribute ? st.attributes[t.attribute] : st.state, op = t.op || '=', val = t.value == null || t.value === '' ? 'on' : String(t.value);
    if (op === '>' || op === '<') { const a = Number(raw), b = Number(val); return !isNaN(a) && !isNaN(b) && (op === '>' ? a > b : a < b); }
    const eq = val.split('|').map((x) => x.trim()).includes(String(raw));
    return op === '!=' ? !eq : eq;
  };

  /* ------------------------------------------------------------ adaptiv layout */
  // Mål dashbordflaten (ikke vinduet). Mobil = én kolonne (maks 420 px), Fold (MSH.isFold) = samme kolonne i full bredde.
  // Fiks 19.11: alltid denne definisjonen (ingen «||» – en eldre kopi av bunten skal ikke kunne beholde den brede griden).
  M.hjemLayout = function (mode, vw) {
    const w = vw || M.dashRect().width;
    // Fiks 18.7: den brede griden (2/3 kolonner + zoom) er erstattet av Fold-oppsettet: telefon-innholdet i full bredde,
    // ingen max-width og ingen zoom. «Stor» = Fold.
    const fold = mode === 'stor' ? true : mode === 'mobil' ? false : M.isFold(w);
    return { fold, vw: w };
  };

  /* ------------------------------------------------------------ swipe (karusell / flis-stabler) */
  // Horisontal sveip med touch-action: pan-y + stopPropagation (Bubble Card lukker/scroller ikke). Klikk etter drag svelges.
  // Ingen haptic ved sveip/snap – bare trykk (åpne romkort) gir haptic.
  M.hjemSwiper = M.hjemSwiper || function (card, vp, onIndex) {
    const track = () => vp.firstElementChild;
    const n = () => Number(vp.dataset.n) || 1, idx = () => Number(vp.dataset.i) || 0;
    const dotsEl = () => { const d = vp.nextElementSibling; return d && d.classList.contains('msh-dots') ? d : null; };
    // Fiks 17.17: ny side settes rett i DOM-en (track + prikker) og lagres stille (onIndex → setUI(…, true)).
    // Kortet tegnes IKKE på nytt ved slipp, og hass-oppdateringer venter til snap-animasjonen (.45 s) er ferdig.
    const go = (i) => {
      i = M.clamp(i, 0, n() - 1);
      const tr = track();
      tr.style.transition = '';
      tr.style.transform = `translateX(${-i * 100}%)`;
      vp.dataset.i = i;
      M.setDots(dotsEl(), i);
      card._busy = true;
      clearTimeout(vp.__snapT);
      vp.__snapT = setTimeout(() => { card._busy = false; if (card._skipped) { card._skipped = false; card._schedule(); } }, 480);
      onIndex(i);
    };
    M.bindDots(dotsEl(), go); // 17.12: trykk på prikk → den siden
    if (vp.__sw) return;
    vp.__sw = true;
    M.guardDrag(vp, 'x');
    let st = null, wheel = 0, wt = 0;
    vp.addEventListener('pointerdown', (e) => { if (card._onDown) card._onDown(e); if (e.button || n() < 2) return; st = { x: e.clientX, y: e.clientY, t: Date.now(), w: vp.clientWidth || 1, lock: null, dx: 0, id: e.pointerId }; });
    vp.addEventListener('pointermove', (e) => {
      if (!st) return;
      const mx = e.clientX - st.x, my = e.clientY - st.y;
      if (!st.lock) {
        if (Math.abs(mx) > 6 && Math.abs(mx) > Math.abs(my)) { st.lock = 'x'; card._busy = true; try { vp.setPointerCapture(st.id); } catch (x) { /* */ } } else if (Math.abs(my) > 8) { st = null; return; } else return;
      }
      e.preventDefault();
      st.dx = mx;
      const i = idx(), edge = (i === 0 && mx > 0) || (i === n() - 1 && mx < 0);
      const tr = track();
      tr.style.transition = 'none';
      tr.style.transform = `translateX(${-i * st.w + (edge ? mx * 0.35 : mx)}px)`;
    });
    const end = (e) => {
      if (!st) return;
      const s0 = st; st = null;
      if (s0.lock !== 'x') return;
      card._busy = false;
      card._swallow = true;
      setTimeout(() => { card._swallow = false; }, 350);
      const v = s0.dx / Math.max(1, Date.now() - s0.t);
      let i = idx();
      if (e.type === 'pointerup') { if (s0.dx < -s0.w * 0.2 || v < -0.45) i++; else if (s0.dx > s0.w * 0.2 || v > 0.45) i--; }
      go(i); // ingen haptic ved sveip – kun trykk på et romkort gir haptic

    };
    vp.addEventListener('pointerup', end);
    vp.addEventListener('pointercancel', end);
    vp.addEventListener('wheel', (e) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || n() < 2) return;
      e.preventDefault();
      wheel += e.deltaX;
      const now = Date.now();
      if (Math.abs(wheel) > 40 && now - wt > 450) { wt = now; const i = M.clamp(idx() + (wheel > 0 ? 1 : -1), 0, n() - 1); wheel = 0; if (i !== idx()) go(i); }
    }, { passive: false });
  };

  /* ------------------------------------------------------------ oppslag */
  const outdoorFloor = (f) => [M.slug(f.name), M.slug(f.floor_id)].some((x) => OUT_RX.test(x)) ? 1 : 0;
  const customTabs = (c) => String(c.custom_tabs || '').split(',').map((x) => x.trim()).filter(Boolean).map((l) => ({ id: 'c_' + M.slug(l), label: l, view: 'liste', kind: 'custom' }));
  function autoTabs(hass, c) {
    const areas = M.areas(hass), T = [{ id: 'hjem', label: 'Hjem', view: 'karusell', kind: 'hjem' }];
    const floors = M.floors(hass).slice().sort((a, b) => outdoorFloor(a) - outdoorFloor(b) || (a.level ?? 0) - (b.level ?? 0));
    const RES = ['hjem', 'aktuelt', 'batterier', 'uten_etasje'];
    floors.forEach((f) => { if (areas.some((a) => a.floor === f.floor_id)) T.push({ id: floorTabId(f.floor_id), label: M.floorShort(f.name), view: 'liste', kind: 'floor', floor: f.floor_id }); });
    if (floors.length && areas.some((a) => !a.floor)) T.push({ id: 'uten_etasje', label: 'Andre rom', view: 'liste', kind: 'andre' });
    customTabs(c).forEach((t) => { if (!T.some((x) => x.id === t.id)) T.push(t); });
    T.push({ id: 'aktuelt', label: 'Aktuelt', view: 'liste', kind: 'aktuelt' });
    T.push({ id: 'batterier', label: 'Batterier', view: 'batterier', kind: 'batterier' });
    return T;
  }
  function floorTabId(fid) { return ['hjem', 'aktuelt', 'batterier', 'uten_etasje'].includes(fid) || String(fid).startsWith('c_') ? 'f_' + fid : fid; }
  // Fiks 31.5: etasjens kortnavn slik det står på Hjem (tab_labels.<fane> i Hjem-kortets config, ellers M.floorShort)
  M.hjemFloorLabel = function (fid, name) {
    let c = null;
    try {
      const live = M.liveOf && M.liveOf('msh-hjem-faner-card');
      c = live && live.config ? live.config : M.effectiveConfig && M.CARD_IDS ? M.effectiveConfig({ type: 'custom:msh-hjem-faner-card', card_id: M.CARD_IDS.faner }, null, { shared: true }) : null;
    } catch (e) { c = null; }
    return (c && fid && get(c, 'tab_labels.' + floorTabId(fid))) || M.floorShort(name);
  };
  // Fiks 31.4 · ikon per fane (designet: Hjem home, 1./2. etg counter_1/2, Ute yard, Aktuelt bolt, Batterier battery_alert)
  function tabIcon(hass, c, t) {
    const own = get(c, 'tab_icons.' + t.id);
    if (own) return own;
    if (t.kind === 'hjem') return 'mdi:home';
    if (isAkt(t)) return 'mdi:lightning-bolt';
    if (t.kind === 'batterier') return 'mdi:battery-alert';
    if (t.kind === 'floor') {
      const f = M.floors(hass).find((x) => x.floor_id === t.floor);
      if (f && outdoorFloor(f)) return 'yard';
      const lv = f ? Number(f.level) : NaN;
      if (Number.isInteger(lv) && lv >= 0 && lv <= 9) return `mdi:numeric-${lv}-circle-outline`;
      return (f && f.icon) || 'mdi:layers';
    }
    return 'mdi:layers';
  }
  M.hjemTabIcon = tabIcon;
  function allTabs(hass, c) {
    const A = autoTabs(hass, c), ord = Array.isArray(c.tab_order) ? c.tab_order : [];
    const out = [...ord.map((id) => A.find((t) => t.id === id)).filter(Boolean), ...A.filter((t) => !ord.includes(t.id))];
    return out.map((t) => ({ ...t, autoLabel: t.label, defView: t.view, label: get(c, 'tab_labels.' + t.id) || t.label, view: t.kind === 'batterier' ? 'batterier' : get(c, 'tab_views.' + t.id) || t.view, hidden: (c.tab_hidden || []).includes(t.id), hc: t.kind === 'hjem' ? hjemHC(hass, c) : null }));
  }
  // Rom som hører til fanen (før skjuling): etasjens rom + rom hentet fra andre etasjer.
  function floorRank(hass) {
    const fl = M.floors(hass).slice().sort((a, b) => outdoorFloor(a) - outdoorFloor(b) || (a.level ?? 0) - (b.level ?? 0)), rk = {};
    fl.forEach((f, i) => { rk[f.floor_id] = i; });
    return rk;
  }
  function baseRooms(hass, c, t) {
    const rk = floorRank(hass);
    const areas = M.areas(hass).slice().sort((a, b) => (a.floor ? rk[a.floor] ?? 50 : 99) - (b.floor ? rk[b.floor] ?? 50 : 99) || a.name.localeCompare(b.name, 'nb'));
    // Etasjefaner autofylles fra HA-etasjen (tabs.<fane>.auto_fill, standard på). Hjem: kuratert liste (t.hc = M.hjemCards).
    const fill = get(c, `tabs.${t.id}.auto_fill`) !== false;
    let base = t.kind === 'floor' ? (fill ? areas.filter((a) => a.floor === t.floor) : []) : t.kind === 'andre' ? (fill ? areas.filter((a) => !a.floor) : []) : t.kind === 'custom' ? [] : t.hc ? t.hc.cards.filter((x) => /^rom:/.test(x)).map((x) => areas.find((a) => a.id === x.slice(4))).filter(Boolean) : areas;
    const add = Object.values(get(c, `layout.${t.id}.add`) || {}).filter(Boolean);
    add.forEach((id) => { const a = areas.find((x) => x.id === id); if (a && !base.includes(a)) base = [...base, a]; });
    // Hjem med autofyll (gammelt oppsett): rom med klimadata først (som favorittene i designet), deretter resten
    if (t.kind === 'hjem' && !t.hc && M.roomAuto) { const has = (a) => { const au = M.roomAuto(hass, a.id); return au.temp || au.thermo ? 0 : 1; }; base = base.map((a, i) => [a, has(a), i]).sort((x, y) => x[1] - y[1] || x[2] - y[2]).map((x) => x[0]); }
    const ord = get(c, `layout.${t.id}.order`) || [];
    return [...ord.map((id) => base.find((a) => a.id === id)).filter(Boolean), ...base.filter((a) => !ord.includes(a.id))];
  }
  // Apparater (oppvask/vask/tørk): status, gjenstående tid, program, effekt, bryter – kun det som finnes.
  function applFind(hass, kind, ov) {
    const [rx] = APPL[kind];
    const other = Object.keys(APPL).filter((k) => k !== kind).map((k) => APPL[k][0]);
    const txt = (id) => id + ' ' + ((hass.states[id].attributes || {}).friendly_name || '');
    const ids = Object.keys(hass.states).filter((id) => /^(sensor|binary_sensor|switch|select|button)\./.test(id) && regOk(hass, id) && rx.test(txt(id)) && !(kind !== 'dish' && other.some((o, i) => o.test(txt(id)) && !rx.test(id))));
    if (!ids.length && !ov) return null;
    const st = (id) => hass.states[id], num = (id) => M.isNum(st(id).state);
    const isRem = (id) => /gjenst|remain|time.?left|rest.?tid|finish|end.?time|slutt|ferdig.?kl|done.?at/i.test(id) && id.startsWith('sensor.');
    const isProg = (id) => /program|prog|cycle|syklus/i.test(id) && !num(id) && /^(sensor|select)\./.test(id);
    const cand = ids.filter((id) => !isRem(id) && !isProg(id));
    const status = ov || cand.find((id) => id.startsWith('sensor.') && /status|state|tilstand|operation|drift|job|run/i.test(id) && !num(id))
      || cand.find((id) => id.startsWith('sensor.') && !num(id) && st(id).attributes.device_class !== 'timestamp')
      || cand.find((id) => id.startsWith('binary_sensor.')) || cand.find((id) => id.startsWith('switch.')) || null;
    if (!status) return null;
    return {
      status, remain: ids.find(isRem) || null, prog: ids.find(isProg) || null,
      power: ids.find((id) => id.startsWith('sensor.') && st(id).attributes.device_class === 'power') || null,
      sw: ids.find((id) => id.startsWith('switch.')) || null, area: M.areaOf(hass, status) || (ids.map((id) => M.areaOf(hass, id)).find(Boolean) || null),
    };
  }
  function tileEnts(hass, c) {
    const o = c.overrides || {}, first = (a) => a[0] || null;
    const tvs = M.all(hass, 'media_player', (s) => s.attributes.device_class === 'tv');
    return {
      lock: o.lock || first(M.all(hass, 'lock')),
      garage: o.garage || first(M.all(hass, 'cover', (s) => ['garage', 'gate'].includes(s.attributes.device_class))),
      alarm: o.alarm || first(M.all(hass, 'alarm_control_panel')),
      cam: o.cam || first(M.all(hass, 'camera')),
      ruter: o.ruter || (() => {
        // Fiks 17.11: entur-sensoren med kortest due_in (ellers sensorer med route + due_in/due_at-attributter)
        let L = [...M.byPlatform(hass, 'entur_public_transport', 'sensor'), ...M.byPlatform(hass, 'entur', 'sensor')];
        if (!L.length) L = M.all(hass, 'sensor', (x) => x.attributes.route != null && (x.attributes.due_in != null || x.attributes.due_at != null));
        const due = (id) => { const R = ruterInfo(hass.states[id]); return R && R.due != null ? R.due : 1e9; };
        return L.slice().sort((a, b) => due(a) - due(b))[0] || null;
      })(),
      ruterSx: hass.states['sensor.ruter_avvik_summary'] ? 'sensor.ruter_avvik_summary' : first(M.byPlatform(hass, 'entur_sx')),
      todo: o.todo || first(M.all(hass, 'todo')), todos: M.all(hass, 'todo'),
      tv: o.tv || (() => { const L = tvs.length ? tvs : M.all(hass, 'media_player', (s, id) => /(^|[_\s.-])tv($|[_\s-])/i.test(id + ' ' + (s.attributes.friendly_name || ''))); return L.find((id) => !['off', 'standby', 'unavailable', 'unknown'].includes(hass.states[id].state)) || first(L); })(),
      vacr: o.vacr || first(M.all(hass, 'vacuum')),
      dish: applFind(hass, 'dish', o.dish), wash: applFind(hass, 'wash', o.wash), dry: applFind(hass, 'dry', o.dry),
      weather: o.weather || first(M.all(hass, 'weather')), price: o.price || M.hjemPriceId(hass), watt: o.watt || M.kiRomId(hass, null, 'effekt'),
      calendar: o.calendar || first(M.all(hass, 'calendar')),
      trash: o.trash || c.trash_sensor || first(Object.keys(hass.states).filter((id) => id.startsWith('sensor.') && /s(ø|o)ppel|avfall|renovasjon|trash|waste|garbage/i.test(id) && M.isNum(hass.states[id].state)).sort()),
    };
  }
  const availKinds = (E, c) => [...KIND_ORDER.filter((k) => k === 'jul' || E[k] || tileCfg(c, k).entity), ...extraIds(c).filter((id) => tileCfg(c, id).entity || E[kindOf(c, id)]), ...Object.keys(c.links || {}).filter((k) => c.links[k] && c.links[k].title).sort()];
  const kindLabel = (k, c) => { const kd = kindOf(c, k); if (!kd) return ((c.links || {})[k] || {}).title || 'Snarvei'; const n = tileCfg(c, k).name; return n || KINDS[kd][1] + (k !== kd ? ' ' + String(k).slice(kd.length + 1) : ''); };
  const kindIcon = (k, c) => { const kd = kindOf(c, k); return kd ? tileCfg(c, k).icon || KINDS[kd][0] : ((c.links || {})[k] || {}).icon || 'mdi:star'; };
  // Standardplass for en flis: tile_cfg.<id>.side/pos (ny flis) → standard for typen
  const defSlot = (c, tk, k) => { const x = tileCfg(c, k); if (/^[LR]$/.test(x.side || '') && /^(top|bottom)$/.test(x.pos || '')) return x.side + '-' + x.pos; return (TILE_DEF[tk] || {})[kindOf(c, k) || k]; };
  /* ------------------------------------------------------------ Fiks 20.4: «Vis først når …» per karusell */
  // carousel.<fane>.<L|R> = { dots: false (prikkene av), first: [{ slide: 'rooms'|'cal'|'vaer'|'strom'|'trash', condition: <HA-condition> }] }.
  // Første regel (ovenfra) som slår til bestemmer kortet karusellen står på; ingen treff → første kort. Evaluering: MSH.condEval.
  const carPresets = (hass, c) => {
    const E = tileEnts(hass, c || {}), cals = listOf(get(c || {}, 'calendar.entities')).filter((x) => typeof x === 'string'), cal = cals[0] || M.all(hass, 'calendar')[0] || 'calendar.familie';
    return [
      ['cal', 'Kalender-event pågår', { condition: 'state', entity_id: cal, state: 'on' }],
      ['trash', 'Søppel i dag', { condition: 'numeric_state', entity_id: E.trash || 'sensor.soppel', below: 1 }],
      ['price', 'Strømpris > 1,5 kr', { condition: 'numeric_state', entity_id: E.price || 'sensor.strompris', above: 1.5 }],
      ['morning', 'Morgen 06–09', { condition: 'time', after: '06:00:00', before: '09:00:00' }],
      ['tpl', 'Mal', { condition: 'template', value_template: `{{ state_attr('${cal}','message') == 'Fotball' }}` }],
    ];
  };
  // Kortene en regel kan peke på: Rommene + sveip-kortene som er lagt til på karusellen
  const carSlides = (c, tab, side) => { const sl = get(c, `slides.${tab}.${side}`) || {}; return [['rooms', 'Rommene'], ...Object.keys(SLIDES).filter((k) => sl[k]).map((k) => [k, SLIDES[k][1]])]; };
  M.hjemCar = { presets: carPresets, slides: carSlides };
  M.hjemTiles = { STATE_TXT, stStates, stDefault, stTxt, KINDS, DEF_TAP, TAP_KEYS, TAP_FIELDS, TAP_MODES, TAP_LABELS, CAM_NAV, camTapShown, TILE_DOM, tapLabel, tileCfg, kindOf, extraIds, kindLabel, kindIcon, defSlot, availKinds: (E, c) => availKinds(E, c) };
  // Hjem med kuratert liste (t.hc): bare kort i tabs.hjem.cards vises; plass = lagret plass eller standard (apparater o.l.: høyre, over rom).
  const tileSlot = (c, t, k) => {
    if (t.hc) {
      const sl = get(c, `tiles.${t.id}.${k}.slot`), set = !!sl && sl !== 'off';
      if (!t.hc.cards.includes(k) && !(set && !t.hc.exclude.includes(k))) return 'off';
      return set ? sl : defSlot(c, 'hjem', k) || 'R-top';
    }
    return get(c, `tiles.${t.id}.${k}.slot`) || defSlot(c, t.kind, k) || 'off';
  };
  const seasonOk = (c, t, k) => {
    const f = get(c, `tiles.${t.id}.${k}.fra`) ?? (k === 'jul' ? '11-01' : ''), tl = get(c, `tiles.${t.id}.${k}.til`) ?? (k === 'jul' ? '03-01' : '');
    if (!/^\d\d-\d\d$/.test(f) || !/^\d\d-\d\d$/.test(tl)) return true;
    const d = new Date(), md = pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
    return f <= tl ? md >= f && md < tl : md >= f || md < tl;
  };
  const fakeCard = (hass, c) => ({ hass, config: c, s: (id) => (id && hass && hass.states[id]) || null, n: (id) => M.num(hass, id) });
  // Rom-overstyring fra rooms.<id>: temperature|humidity|climate (nye) eller temperatur|fuktighet|termostat (gamle);
  // farge fra rooms.<id>.color (eller col). Kun satte nøkler sendes videre (M.roomClimate slår sammen med rom-popupens config).
  const roomCfgOf = (c, area) => {
    const rc = get(c, 'rooms.' + area) || {}, ov = {};
    const t = rc.temperature || rc.temperatur, h = rc.humidity || rc.fuktighet, k = rc.climate || rc.termostat;
    if (t) ov.temperature = t;
    if (h) ov.humidity = h;
    if (k) ov.climate = k;
    // Ikon-sirkelen: standard for alle rom (icon_color_mode / icon_tap i dette kortet, «Tilpass Hjem» → Kort);
    // «Tilpass rom» (ki-store rooms.<area>) vinner – slås opp i M.romData.
    return { overrides: ov, look: { icon: rc.icon, color: rc.color || rc.col }, icon_color_default: c.icon_color_mode, icon_tap_default: c.icon_tap };
  };

  /* ------------------------------------------------------------ Hjem kuratert · Aktuelt dynamisk (fiks 15.10) */
  // tabs.hjem    = { auto_fill: false, cards: ['lock', 'alarm', 'cam', 'todo', 'rom:stue', …], exclude: [...], seen: [...] }
  // tabs.aktuelt = { auto_fill: false, types: ['appliances', 'doors', 'battery', 'lights', 'media', 'alerts'] }
  // tabs.<etasje>.auto_fill = true (standard): etasjefanene fylles fra HA-områder/etasjer.
  // Kort-ID: snarvei = kind (lock, alarm, cam, todo, dish …, egen lenke l01), rom = 'rom:<area_id>'.
  // Autofyll én gang: kortet lagrer den kuraterte listen første gang (ki-store lastet, card_id finnes). Fjernede kort
  // legges i exclude og kommer ikke tilbake; nye rom/enheter (ikke i seen) blir «Forslag» i «Tilpass Hjem» → Kort.
  // Bakoverkompatibelt: har Hjem lagret oppsett fra før (layout/tiles/tile_order/tile_hidden.hjem) og ingen tabs.hjem,
  // gjelder autofyll (alle rom + standard snarveier) som før.
  const HJEM_TILES = ['lock', 'alarm', 'cam', 'todo', 'ruter']; // 17.11: Ruter-flisen kommer med når en Entur-sensor finnes
  const HJEM_MAX = 4;
  const DYN = ['dish', 'vacr', 'tv', 'wash', 'dry'];
  const AKT_TYPES = [['appliances', 'Apparat kjører eller er ferdig', 'mdi:washing-machine'], ['doors', 'Dør eller vindu åpen', 'mdi:door-open'], ['battery', 'Lavt batteri', 'mdi:battery-alert'], ['lights', 'Lys på i tomt rom', 'mdi:lightbulb-on-outline'], ['media', 'Media spiller', 'mdi:play-circle-outline'], ['alerts', 'Avvik (fukt, temperatur, lekkasje, røyk, feil)', 'mdi:alert-circle-outline']];
  M.AKT_TYPES = AKT_TYPES;
  M.aktTypes = (c) => { const t = get(c, 'tabs.aktuelt.types'); return Array.isArray(t) ? t : AKT_TYPES.map((x) => x[0]); };
  const DOOR_DC = ['door', 'window', 'garage_door', 'opening'];
  const PROB_DC = ['moisture', 'smoke', 'gas', 'carbon_monoxide', 'problem', 'safety', 'tamper'];
  const PRES_DC = ['motion', 'occupancy', 'presence'];
  const ROOM_RX = [[/stue|living/, 40], [/kj(o|oe)kken|kitchen/, 35], [/soverom|bedroom|master/, 30]];
  const legacyHjem = (c) => ['layout', 'tiles', 'tile_order', 'tile_hidden'].some((k) => get(c, k + '.hjem') != null);
  const statsC = new WeakMap();
  const areaStats = (hass) => {
    const S = hass.states;
    if (statsC.has(S)) return statsC.get(S);
    const out = {};
    Object.keys(S).forEach((id) => {
      const ar = M.areaOf(hass, id);
      if (!ar || !regOk(hass, id)) return;
      const o = out[ar] || (out[ar] = { n: 0, light: 0, sensor: 0, climate: 0 }), d = id.split('.')[0];
      o.n++;
      if (d === 'light') o.light++; else if (d === 'sensor' || d === 'binary_sensor') o.sensor++; else if (d === 'climate') o.climate++;
    });
    statsC.set(S, out);
    return out;
  };
  const isFav = (hass, id) => { const a = hass.areas && hass.areas[id]; return !!a && (a.labels || []).some((l) => /favorit|favourite|favorite/i.test(l + ' ' + ((hass.labels && hass.labels[l] && hass.labels[l].name) || ''))); };
  // Rom rangert for Hjem: favoritter (områdeetikett «favoritt»), climate.*, mest aktivitet (lys, sensorer, entiteter),
  // Stue/Kjøkken/Soverom. Uterom nederst.
  M.hjemRoomRank = function (hass) {
    const st = areaStats(hass);
    return M.areas(hass).map((a, i) => {
      const x = st[a.id] || {}, nm = M.slug(a.name) + ' ' + a.id, fl = a.floorName ? M.slug(a.floorName) : '';
      let sc = (isFav(hass, a.id) ? 1000 : 0) + (x.climate ? 100 : 0) + (x.light || 0) * 3 + (x.sensor || 0) + (x.n || 0) * 0.5;
      ROOM_RX.forEach(([rx, p]) => { if (rx.test(nm)) sc += p; });
      if (OUT_RX.test(M.slug(a.name)) || OUT_RX.test(a.id) || (fl && fl.split(' ').some((w) => OUT_RX.test(w)))) sc -= 200;
      return { id: a.id, sc, i };
    }).sort((x, y) => y.sc - x.sc || x.i - y.i).map((x) => x.id);
  };
  M.hjemCards = function (hass, c) {
    const H = get(c, 'tabs.hjem') || {}, stored = Array.isArray(H.cards);
    const auto = H.auto_fill != null ? !!H.auto_fill : !stored && legacyHjem(c);
    const E = tileEnts(hass, c), exclude = Array.isArray(H.exclude) ? H.exclude : [];
    const candidates = [...M.areas(hass).map((a) => 'rom:' + a.id), ...availKinds(E, c).filter((k) => k !== 'jul')];
    const curated = () => [...HJEM_TILES.filter((k) => E[k]), ...M.hjemRoomRank(hass).slice(0, HJEM_MAX).map((id) => 'rom:' + id)];
    const cards = stored ? H.cards.filter((x) => typeof x === 'string') : curated().filter((x) => !exclude.includes(x));
    const seen = Array.isArray(H.seen) ? H.seen : stored ? cards : candidates;
    const suggest = candidates.filter((x) => !cards.includes(x) && !exclude.includes(x) && !seen.includes(x));
    return { auto, stored, cards, exclude, seen, candidates, suggest, curated, E };
  };
  const hcC = new WeakMap();
  function hjemHC(hass, c) {
    if (!hass || !c) return null;
    const o = hcC.get(c);
    if (o && o.S === hass.states && o.h === hass) return o.v;
    const r = M.hjemCards(hass, c), v = r.auto ? null : r;
    hcC.set(c, { S: hass.states, h: hass, v });
    return v;
  }

  // 17.16 · «Aktiv-tilstand» for en kamera-flis i GUI-editoren (samme felt som «Tilpass Hjem» → Kort). Tre utløser-plasser.
  function camFields(hass, c, k, P) {
    const A = P + '.active', a = get(c, A) || {}, ow = listOf(a.only_when), auto = camAuto(hass, get(c, P + '.entity') || tileEnts(hass, c).cam);
    const f = [{ type: 'info', label: 'Aktiv-tilstand · når flisen vises som aktiv. Tomme utløsere = automatisk: ' + (auto.length ? auto.join(', ') : 'fant ingen bevegelsessensor ved kameraet') }];
    f.push({ type: 'select', name: A + '.mode', label: 'Utløsere', options: [['any', 'Hvilken som helst'], ['all', 'Alle']], default: 'any' });
    const trig = listOf(a.triggers);
    [0, 1, 2].slice(0, Math.min(3, trig.filter((t) => t && t.entity).length + 1)).forEach((i) => {
      const tp = `${A}.triggers.${i}`;
      f.push({ type: 'entity', name: tp + '.entity', label: `Utløser ${i + 1} · entitet` });
      if (trig[i] && trig[i].entity) f.push({ type: 'text', name: tp + '.attribute', label: 'Attributt (valgfri)' }, { type: 'select', name: tp + '.op', label: 'Betingelse', options: CAM_OPS, default: '=' }, { type: 'text', name: tp + '.value', label: 'Verdi', placeholder: 'on' });
    });
    f.push({ type: 'number', name: A + '.hold_min', label: 'Hold aktiv i (min etter at utløseren slutter)', min: 0, max: 30, placeholder: '2' });
    CAM_ONLY.forEach(([v, l]) => f.push({ type: 'button', label: (ow.includes(v) ? '✓ ' : '+ ') + 'Bare når · ' + l, icon: ow.includes(v) ? 'mdi:checkbox-marked' : 'mdi:checkbox-blank-outline', run: (h, cc, ed) => { const cur = listOf(get(cc, A + '.only_when')); ed._set(A + '.only_when', cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]); } }));
    if (ow.includes('night')) f.push({ type: 'text', name: A + '.night.from', label: 'Natt fra', placeholder: '22:00' }, { type: 'text', name: A + '.night.to', label: 'Natt til', placeholder: '06:00' });
    if (ow.includes('entity')) f.push({ type: 'entity', name: A + '.only_entity', label: 'Egen entitet (på = tillatt)' });
    f.push({ type: 'text', name: A + '.quiet.from', label: 'Stille-periode fra (ikke aktiver)', placeholder: '07:00' }, { type: 'text', name: A + '.quiet.to', label: 'Stille-periode til', placeholder: '16:00' });
    f.push({ type: 'select', name: A + '.style', label: 'Stil', options: CAM_STYLES, default: 'tint' },
      { type: 'color', name: A + '.color', label: 'Farge', placeholder: 'var(--blue)' },
      { type: 'icon', name: A + '.icon', label: 'Ikon når aktiv', placeholder: M.iconName('videocam') },
      { type: 'boolean', name: A + '.pulse', label: 'Puls rundt ikonet' },
      { type: 'text', name: A + '.sub_active', label: 'Undertekst mens aktiv', placeholder: 'Bevegelse nå', help: 'Tokens: {tid} {siden} {entitet} {sone}' },
      { type: 'text', name: A + '.sub_after', label: 'Undertekst i holdetiden', placeholder: 'Bevegelse for {siden} siden' },
      { type: 'select', name: A + '.on_activate', label: 'Ved aktivering', options: CAM_ACT, default: 'none' });
    return f;
  }


  /* Fiks 31.4 · CSS for fanestilene (kortet og forhåndsvisningen i «Tilpass Hjem» → Faner → Fanestil). Prefiks hts-. */
  const PK = C.accent, RD = 'var(--red,#f28073)', RDT = 'var(--ki-red-text, var(--red,#f28073))', EDGE = 'inset 0 0 0 1px rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.05*var(--ki-wa-k,1)),var(--ki-wa-max,1)))';
  M.HJEM_TABS_CSS = `
    ${M.tabBar ? M.tabBar.CSS : ''}
    .hts-glide,.hts-chips,.hts-top,.hts-sub{user-select:none;-webkit-user-select:none;touch-action:pan-y}
    .hts-glide>*,.hts-chips>*,.hts-top>*,.hts-sub>*,.hts-bat,.hts-pt{-webkit-tap-highlight-color:transparent;-webkit-touch-callout:none;cursor:pointer;font-family:inherit;border:0;margin:0;box-sizing:border-box}
    .hts-ic{display:inline-flex;flex:none;line-height:0}
    .hts-glide{position:relative;display:grid;padding:4px;border-radius:26px;background:var(--ki-surface-3, var(--gray100,#2f2f2f));box-shadow:${EDGE};box-sizing:border-box;min-width:0}
    .hts-thumb{position:absolute;top:4px;bottom:4px;border-radius:22px;background:${PK};box-shadow:0 6px 16px rgb(242 133 201 / 0.25);transition:left .28s cubic-bezier(.2,.8,.2,1);pointer-events:none}
    .hts-glide.tr-drag .hts-thumb{opacity:.35}
    .hts-gt{position:relative;z-index:1;height:56px;min-width:0;padding:0 2px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;background:transparent;color:var(--ki-text-2, var(--gray800,#afafaf));font-size:11px;font-weight:500;transition:color .2s}
    .hts-gt.on{color:var(--ki-on-accent, var(--gray100,#2f2f2f))}
    .hts-gl{white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis}
    .hts-gt.warn:not(.on) .hts-ic{color:${RDT}}
    .hts-chips{display:flex;gap:8px;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;overscroll-behavior-x:contain;margin:0 -2px;padding:0 2px;min-width:0}
    .hts-chips::-webkit-scrollbar,.hts-sub::-webkit-scrollbar{display:none}
    .hts-ch{flex:none;height:56px;padding:0 16px 0 12px;border-radius:28px;display:flex;align-items:center;gap:10px;background:var(--ki-surface, var(--gray100,#2f2f2f));color:var(--ki-text, var(--white,#fafafa));box-shadow:${EDGE};transition:background .2s;text-align:left}
    .hts-ch .hts-ic{color:var(--ki-text-2, var(--gray800,#afafaf))}
    .hts-ch.on{background:${PK};color:var(--ki-on-accent, var(--gray100,#2f2f2f));box-shadow:none}
    .hts-ch.on .hts-ic{color:var(--ki-on-accent, var(--gray100,#2f2f2f))}
    .hts-cx{display:flex;flex-direction:column;align-items:flex-start;gap:1px}
    .hts-cl{font-size:14px;font-weight:500;white-space:nowrap;line-height:1.2}
    .hts-cm{font-size:11px;white-space:nowrap;color:var(--ki-text-mid, var(--gray700,#979797));line-height:1.2}
    .hts-ch.on .hts-cm{color:rgba(47,47,47,0.75)}
    .hts-ch.warn:not(.on) .hts-ic,.hts-ch.warn:not(.on) .hts-cm{color:${RDT}}
    .hts-to{display:flex;flex-direction:column;gap:10px;min-width:0}
    .hts-tor{display:flex;align-items:center;gap:8px;min-width:0}
    .hts-top{flex:1;min-width:0;display:grid;gap:2px;padding:4px;border-radius:26px;background:var(--ki-surface-3, var(--gray100,#2f2f2f));box-shadow:${EDGE};box-sizing:border-box}
    .hts-tt{height:48px;border-radius:22px;min-width:0;padding:0 6px;display:flex;align-items:center;justify-content:center;gap:6px;font-size:14px;font-weight:500;white-space:nowrap;overflow:hidden;background:transparent;color:var(--ki-text-2, var(--gray900,#c7c7c7));transition:background .2s}
    .hts-tt.on{background:${PK};color:var(--ki-on-accent, var(--gray100,#2f2f2f))}
    .hts-tl{overflow:hidden;text-overflow:ellipsis}
    .hts-bat{position:relative;width:56px;height:56px;border-radius:28px;flex:none;display:grid;place-items:center;padding:0;background:var(--ki-surface, var(--gray100,#2f2f2f));color:var(--ki-text-2, var(--gray800,#afafaf));box-shadow:${EDGE};transition:background .2s}
    .hts-bat.warn{color:${RDT}}
    .hts-bat.on{background:${RD};color:var(--ki-on-accent, var(--gray100,#2f2f2f))}
    .hts-bn{position:absolute;top:4px;right:4px;min-width:18px;height:18px;padding:0 5px;box-sizing:border-box;border-radius:9px;background:${RD};color:var(--ki-on-accent, var(--gray100,#2f2f2f));font-size:11px;font-weight:600;display:grid;place-items:center;line-height:1}
    .hts-bat.on .hts-bn{background:var(--ki-surface, var(--gray100,#2f2f2f));color:${RDT}}
    .hts-sub{display:flex;gap:6px;padding:0 4px;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;overscroll-behavior-x:contain;min-width:0}
    .hts-st{flex:none;height:36px;padding:0 16px;border-radius:18px;font-size:13px;font-weight:500;white-space:nowrap;background:transparent;box-shadow:inset 0 0 0 1px var(--ki-surface-2, var(--gray200,#3a3a3a));color:var(--ki-text-2, var(--gray800,#afafaf));display:flex;align-items:center}
    .hts-st.on{background:var(--ki-surface-2, var(--gray300,#404040));box-shadow:inset 0 0 0 1.5px var(--pink,#f285c9);color:var(--ki-text, var(--white,#fafafa))}
    .hts-pp{padding:4px;border-radius:24px;box-shadow:inset 0 0 0 1px rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.14*var(--ki-wa-k,1)),var(--ki-wa-max,1)));align-self:flex-start;max-width:100%;box-sizing:border-box;overflow-x:auto;scrollbar-width:none}
    .hts-pp.full{align-self:stretch}
    .hts-ppr{display:flex;gap:0}
    .hts-pt{flex:0 0 auto;display:grid;place-items:center;font-size:13px;font-weight:500;white-space:nowrap;border-radius:999px;color:var(--ki-text-2, var(--gray800,#afafaf))}
    .hts-pp.full .hts-pt{flex:1 0 auto}
    .hts-pt.on{background:${PK};color:var(--ki-on-accent, var(--gray100,#2f2f2f))}
  `;

  /* ------------------------------------------------------------ kort */
  class HjemFaner extends M.Card {
    static get cardName() { return 'Hjem · faner og romkort'; }
    static get defaults() { return { toasts: true }; }
    // fiks 19.3: ny flis-oppsett har Kamera-trykket valgt som Navigate /dashboard-kamera
    static getStubConfig() { return { ...super.getStubConfig(), tile_cfg: { cam: { tap_card: { ...CAM_NAV } } } }; }
    static get schema() {
      return (hass, c) => {
        if (!hass) return [];
        const fc = fakeCard(hass, c), T = allTabs(hass, c), areas = M.areas(hass), E = tileEnts(hass, c), avail = availKinds(E, c);
        const romData = (id) => (M.romData ? M.romData(fc, id, roomCfgOf(c, id)) : null);
        const fields = [
          { type: 'order', name: 'tab_order', hiddenName: 'tab_hidden', label: 'Faner · rekkefølge og synlighet', options: T.map((t) => [t.id, t.label]) },
          { type: 'section', id: 'faner', label: 'Faner', icon: 'mdi:tab', fields: [
            { type: 'info', label: 'Dra sideveis over fanene for å bytte. Hold inne en fane og dra for å flytte den. Etasjer fra HA dukker opp automatisk.' },
            // Fiks 17.18: global, lagres i ki-store ui.glass_anim (ikke i kort-configen) – samme bryter som «Tilpass Hjem» → Faner
            { type: 'boolean', label: 'Liquid Glass-animasjon', help: 'Glass-linse når du drar eller trykker i faner og segmenter i hele dashbordet', get: () => (M.glassAnimOn ? M.glassAnimOn() : true), set: (v) => { if (M.setGlassAnim) M.setGlassAnim(v); } },
            ...T.map((t) => ({ type: 'text', name: `tab_labels.${t.id}`, label: `Navn · ${t.autoLabel}`, placeholder: t.autoLabel })),
            ...T.filter((t) => t.kind !== 'batterier').map((t) => ({ type: 'select', name: `tab_views.${t.id}`, label: `Visning · ${t.label}`, options: VIEWS, default: t.defView })),
            { type: 'text', name: 'custom_tabs', label: 'Egne faner', placeholder: 'Favoritter, Barn', help: 'Kommaseparert. Legg rom på fanen under «Rom og snarveier».' },
            { type: 'text', name: 'default_tab', label: 'Startfane', placeholder: T[0] ? T[0].id : 'hjem', help: 'Id: ' + T.map((t) => t.id).join(', ') },
            { type: 'select', name: 'tab_height', label: 'Høyde', options: [['std', 'Standard'], ['lav', 'Lav'], ['mid', 'Middels'], ['hoy', 'Høy'], ['ekstra', 'Ekstra'], ['custom', 'Egendefinert']], default: 'std' },
            ...(c.tab_height === 'custom' ? [{ type: 'number', name: 'tab_height_px', label: 'Høyde (px)', min: 24, max: 80, placeholder: '38' }] : []),
            { type: 'select', name: 'tab_width', label: 'Bredde per fane', options: [['std', 'Standard'], ['kompakt', 'Kompakt'], ['full', 'Full'], ['custom', 'Egendefinert']], default: 'std' },
            ...(c.tab_width === 'custom' ? [{ type: 'number', name: 'tab_width_px', label: 'Bredde (px)', min: 48, max: 200, placeholder: '88' }] : []),
            // Fiks 31.4: samme valg som «Tilpass Hjem» → Faner → Fanestil (høyde/bredde gjelder Pille)
            { type: 'select', name: 'tab_style', label: 'Fanestil · stil', options: TAB_STYLES, default: 'pille', help: 'Høyde og bredde gjelder Pille. De andre stilene har faste mål.' },
            ...(tabStyle(c) === 'popup' ? [{ type: 'select', name: 'tab_mode', label: 'Fanene viser', options: TAB_MODES, default: 'begge' }] : []),
            ...(['glide', 'chips', 'to', 'popup'].includes(tabStyle(c)) ? T.map((t) => ({ type: 'icon', name: `tab_icons.${t.id}`, label: `Ikon · ${t.label}`, placeholder: M.iconName ? M.iconName(tabIcon(hass, c, t)) : tabIcon(hass, c, t) })) : []),
          ] },
          { type: 'section', id: 'batterier', label: 'Batterier', icon: 'mdi:battery-alert', fields: [
            { type: 'number', name: 'battery.limit', label: 'Grense for lavt batteri (%)', min: 5, max: 60, step: 5, placeholder: '20' },
            { type: 'select', name: 'battery.show', label: 'Liste', options: [['lav', 'Bare lave'], ['alle', 'Alle']], default: 'lav' },
            { type: 'boolean', name: 'battery.always', label: 'Vis fanen alltid', help: 'Ignorer betingelsen' },
            { type: 'entity', name: 'battery.cond', label: 'Vis fanen når denne er på', domain: 'binary_sensor', help: 'Tom = vises når et batteri (device_class battery) er under grensen' },
          ] },
          { type: 'section', id: 'appliances', label: 'Hvitevarer', icon: 'mdi:washing-machine', fields: [
            { type: 'select', name: 'appliance_animation', label: 'Animasjon', options: [['full', 'Full'], ['calm', 'Rolig'], ['off', 'Av']], default: 'full', help: 'Oppvask, vask, tørk og støvsuger på snarveiene. Rolig = halv fart og utslag' },
          ] },
        ];
        T.filter((t) => t.view !== 'batterier').forEach((t) => {
          const base = baseRooms(hass, c, t), f = [];
          const openEd = { type: 'button', label: 'Åpne «Tilpass Hjem» → Kort', icon: 'mdi:pencil', run: () => { if (M.openHomeEditor) M.openHomeEditor({ focus: 'tab-' + t.id }); } };
          if (t.kind === 'hjem') f.push({ type: 'info', label: t.hc ? `Kuratert: ${t.hc.cards.length} kort (tabs.hjem.cards). Legg til, fjern og se forslag i «Tilpass Hjem» → Kort.` : 'Autofyll: alle rom og standard snarveier vises.' }, { type: 'boolean', name: 'tabs.hjem.auto_fill', label: 'Autofyll Hjem med alle rom', default: !t.hc }, openEd);
          if (isAkt(t)) f.push({ type: 'info', label: 'Aktuelt viser ikke rom, bare kort som er aktive nå. Velg typer (tabs.aktuelt.types) i «Tilpass Hjem» → Kort.' }, openEd);
          if (t.kind === 'floor' || t.kind === 'andre') f.push({ type: 'boolean', name: `tabs.${t.id}.auto_fill`, label: 'Autofyll fra HA-områder/etasjen', default: true });
          if (!isAkt(t)) f.push({ type: 'order', name: `layout.${t.id}.order`, hiddenName: `layout.${t.id}.hidden`, label: 'Rom på fanen', options: base.map((a) => [a.id, a.name + (t.kind === 'floor' && a.floor !== t.floor && a.floorName ? ' · ' + a.floorName : '')]) });
          if (['floor', 'custom', 'andre'].includes(t.kind)) {
            const add = get(c, `layout.${t.id}.add`) || {}, keys = Object.keys(add).sort(), nx = 'a' + pad2(keys.reduce((m, k) => Math.max(m, parseInt(k.slice(1), 10) || 0), 0) + 1);
            [...keys, nx].forEach((k, i) => f.push({ type: 'area', name: `layout.${t.id}.add.${k}`, label: i === keys.length ? 'Hent rom fra en annen etasje' : 'Hentet rom', help: i === keys.length ? 'Velg et område – det legges til fanen' : '' }));
          }
          base.forEach((a) => f.push({ type: 'select', name: `layout.${t.id}.side.${a.id}`, label: `Kolonne · ${a.name}`, options: [['L', 'Venstre'], ['R', 'Høyre']], help: get(c, `layout.${t.id}.side.${a.id}`) ? '' : 'Auto' }));
          if (t.view === 'karusell') Object.keys(SLIDES).forEach((s) => ['L', 'R'].forEach((sd) => f.push({ type: 'boolean', name: `slides.${t.id}.${sd}.${s}`, label: `Sveip-kort · ${sd === 'L' ? 'venstre' : 'høyre'} karusell · ${SLIDES[s][1]}` })));
          // Fiks 20.4: «Vis prikker» + «Vis først når …» per karusell (HAs egen condition-editor via ha-selector)
          if (t.view === 'karusell') ['L', 'R'].forEach((sd) => {
            const P = `carousel.${t.id}.${sd}`, sn = sd === 'L' ? 'venstre' : 'høyre', L = listOf(get(c, P + '.first'));
            f.push({ type: 'boolean', name: P + '.dots', label: `Vis prikker · ${sn} karusell`, default: true });
            L.forEach((r, i) => {
              const nm = `${P}.first.${i}`;
              f.push({ type: 'select', name: nm + '.slide', label: `Vis først når … ${i + 1} · ${sn} karusell · kort`, options: carSlides(c, t.id, sd), default: 'rooms' });
              f.push({ type: 'html', html: (hh, cc, key, ed) => {
                const cur = get(cc, nm + '.condition'), ok = M.condParse(cur), res = ok.value ? M.condEval(hh, ok.value, { onChange: ed ? ed.__crCb || (ed.__crCb = () => ed._render && ed._render()) : null }) : null;
                const badge = `<div class="small" style="padding:0 6px;color:${res === true ? 'var(--ki-green-text, #8fd9a8)' : 'var(--ki-text-mid, #979797)'}">${res === true ? 'Slår til nå' : ok.error ? 'Ugyldig: ' + M.esc(ok.error) : 'Nei nå'}</div>`;
                if (ed && !ed._inline && customElements.get('ha-selector')) return `<div class="f"><ha-selector data-name="${M.esc(nm + '.condition')}" data-nomorph data-selector="${M.esc(JSON.stringify({ condition: {} }))}" data-label="Betingelse (HA-condition)"></ha-selector></div>${badge}`;
                return `<div class="small" style="padding:0 6px">Betingelsen redigeres i «Tilpass Hjem» → Kort → Swipe-kort.</div>${badge}`;
              } });
              f.push({ type: 'button', label: `Fjern regel ${i + 1}`, icon: 'mdi:delete-outline', run: (hh, cc, ed) => { const l2 = listOf(get(cc, P + '.first')).filter((_, j) => j !== i); ed._set(P + '.first', l2.length ? l2 : undefined); } });
            });
            f.push({ type: 'button', label: `Vis først når … · ${sn} karusell · legg til regel`, icon: 'mdi:plus', run: (hh, cc, ed) => ed._set(P + '.first', [...listOf(get(cc, P + '.first')), { slide: 'rooms', condition: [] }]) });
          });
          avail.filter((k) => !(t.kind === 'aktuelt' && DYN.includes(k))).forEach((k) => {
            const on = tileSlot(c, t, k) !== 'off';
            f.push({ type: 'select', name: `tiles.${t.id}.${k}.slot`, label: `Snarvei · ${kindLabel(k, c)}`, options: SLOTS, default: (TILE_DEF[t.kind] || {})[k] || 'off' });
            if (on) {
              f.push({ type: 'boolean', name: `tiles.${t.id}.${k}.stack`, label: `${kindLabel(k, c)} · sveip sammen med andre i samme plass`, default: !!(STACK_DEF[t.kind] || {})[k] });
              f.push({ type: 'text', name: `tiles.${t.id}.${k}.fra`, label: `${kindLabel(k, c)} · vis fra (MM-DD)`, placeholder: k === 'jul' ? '11-01' : 'tomt = alltid' });
              f.push({ type: 'text', name: `tiles.${t.id}.${k}.til`, label: `${kindLabel(k, c)} · vis til (MM-DD)`, placeholder: k === 'jul' ? '03-01' : 'tomt = alltid' });
            }
          });
          SLOTS.slice(1).forEach(([sl, lab]) => {
            if (avail.filter((k) => tileSlot(c, t, k) === sl).length > 1) f.push({ type: 'boolean', name: `swipe.${t.id}.${sl}`, label: `Sveip alle snarveier · ${lab}`, default: t.kind === 'hjem' && sl === 'L-top' });
          });
          const en = avail.filter((k) => tileSlot(c, t, k) !== 'off');
          if (en.length > 1) f.push({ type: 'order', name: `tile_order.${t.id}`, hiddenName: `tile_hidden.${t.id}`, label: 'Snarveier · rekkefølge', options: en.map((k) => [k, kindLabel(k, c)]) });
          fields.push({ type: 'section', id: 'tab-' + t.id, label: `Rom og snarveier · ${t.label}`, icon: 'mdi:view-grid-outline', fields: f });
        });
        // Snarveier: entitet, navn, ikon, undertekst og fire handlinger per flis (fiks 16.11 – samme som «Tilpass Hjem» → Kort).
        // Fiks 17.10: gruppert i fire soner (Hjem-fanen) som i «Tilpass Hjem» → Kort. Config er uendret (tiles.hjem.<id>.slot, swipe.hjem.<sone>).
        const HT0 = T.find((t) => t.kind === 'hjem'), ZONES = [['L-top', 'Venstre · over rommene'], ['R-top', 'Høyre · over rommene'], ['L-bottom', 'Venstre · under rommene'], ['R-bottom', 'Høyre · under rommene']];
        // Fiks 20.7 · GUI-editoren: Tekst per tilstand – én rad (tittel + undertekst) per tilstand, plassholder = standard
        const stFields = (h, cc, k, kd, P) => {
          if (!STATE_TXT[kd]) return [];
          const ent = (() => { const e = tileEnts(h, { ...cc, overrides: k === kd ? cc.overrides : {} })[kd]; return tileCfg(cc, k).entity || (e && typeof e === 'object' ? e.status : e); })();
          const so = ent && h.states[ent], nm = tileCfg(cc, k).name, now = kd === 'cam' ? null : so ? so.state : null;
          return [{ type: 'section', id: 'stx-' + k, label: 'Tekst per tilstand', icon: 'mdi:format-text', meta: `${ent || '–'}${now ? ' · nå: ' + now : ''}`, fields: [
            { type: 'info', label: 'Tomt felt = standard. Tokens: {state} {default} {name} {attr:changed_by} {since} og [[[ return … ]]].' },
            ...stStates(h, kd, ent, tileCfg(cc, k)).flatMap((v) => { const D = stDefault(kd, v, nm || (so && so.attributes.friendly_name)); return [
              { type: 'text', name: `${P}.state_text.${v}.title`, label: `${v}${v === now ? ' · nå' : ''} · tittel`, placeholder: D.title },
              { type: 'text', name: `${P}.state_text.${v}.sub`, label: `${v} · undertekst`, placeholder: D.sub }]; }),
          ] }];
        };
        const tileF = (k) => {
          const kd = kindOf(c, k), L = kindLabel(k, c), P = `tile_cfg.${k}`, dom = TILE_DOM[kd], out = [];
          if (HT0) out.push({ type: 'select', name: `tiles.hjem.${k}.slot`, label: 'Plassering', options: ZONES.map(([v, l]) => [v, l]), default: HT0 ? tileSlot(c, HT0, k) : 'R-bottom' });
          if (!kd) { // egen snarvei (lenke)
            const lp = `links.${k}`;
            out.push({ type: 'text', name: lp + '.title', label: 'Tittel' }, { type: 'text', name: lp + '.sub', label: 'Undertekst' }, { type: 'icon', name: lp + '.icon', label: 'Ikon', placeholder: 'mdi:star' },
              { type: 'select', name: lp + '.color', label: 'Farge', options: TSW, default: 'ingen' }, { type: 'hash', name: lp + '.hash', label: 'Trykk på kortet åpner popup', placeholder: '#strom' },
              { type: 'entity', name: lp + '.entity', label: 'Entitet (ikon-trykk / mer info)' }, { type: 'select', name: lp + '.act', label: 'Trykk på ikonet', options: [['toggle', 'Veksle entitet'], ['popup', 'Åpne popup'], ['more', 'Mer info'], ['none', 'Ingen']], default: 'toggle' });
          } else if (kd !== 'jul') {
            out.push(
              ...(dom ? [{ type: 'entity', name: P + '.entity', label: kd === 'ruter' ? 'Stopp (Entur-sensor)' : 'Entitet', domain: dom, auto: (h, cc) => { const e = tileEnts(h, { ...cc, overrides: k === kd ? cc.overrides : {} })[kd]; return e && typeof e === 'object' ? e.status : e; } }] : []),
              { type: 'text', name: P + '.name', label: 'Navn', placeholder: kd === 'ruter' ? 'Stoppnavn / Ruter' : KINDS[kd][1] },
              { type: 'icon', name: P + '.icon', label: 'Ikon', placeholder: M.iconName(KINDS[kd][0]) },
              ...(kd === 'ruter' ? [
                { type: 'entity', name: P + '.avvik_entity', label: 'Avvik-sensor (valgfri)', domain: 'sensor', auto: (h) => tileEnts(h, {}).ruterSx },
                { type: 'boolean', name: P + '.show_next', label: 'Vis neste etter («, deretter 7 min»)', default: true },
                { type: 'text', name: P + '.sub_format', label: 'Undertekst · format', placeholder: RUTER_FMT, help: 'Tokens: {route} {due_in} {delay} {next} {avvik}' },
              ] : [{ type: 'text', name: P + '.sub', label: 'Undertekst', placeholder: KINDS[kd][1] }]),
              ...(kd === 'cam' ? camFields(hass, c, k, P) : []),
              ...stFields(hass, c, k, kd, P),
              ...(kd === 'lock' || kd === 'garage' ? [{ type: 'hash', name: P + '.popup_hash', label: 'Popup (popup_hash) · trykk på kortet', placeholder: kd === 'lock' ? '#dorlas' : '#garasje' }] : []), // 32.3
              ...TAP_FIELDS.map(([w, lab]) => ({ type: 'tap', name: `${P}.${TAP_KEYS[w]}`, label: lab, modes: TAP_MODES, labels: TAP_LABELS, ...(kd === 'cam' && w === 'card' ? { auto: (h, cc) => camTapShown(cc, k) } : {}), stdHint: 'Standard: ' + tapLabel(DEF_TAP[kd] && DEF_TAP[kd][w], w) })));
          }
          out.push({ type: 'button', label: 'Fjern kortet', icon: 'mdi:delete', run: (h, cc, ed) => {
            const hc = get(cc, 'tabs.hjem.cards'), extra = kd && k !== kd;
            if (extra) ed._set(P, undefined);
            if (Array.isArray(hc)) { ed._set('tabs.hjem.cards', hc.filter((x) => x !== k)); if (!extra) ed._set('tabs.hjem.exclude', [...(get(cc, 'tabs.hjem.exclude') || []).filter((x) => x !== k), k]); } else if (!extra) ed._set(`tiles.hjem.${k}.slot`, 'off');
          } });
          return { type: 'section', id: 'tile-' + k, label: L, icon: kindIcon(k, c), fields: out };
        };
        const tapF = [{ type: 'info', label: 'Tomt felt = standard. Dørlås: trykk på ikonet låser/låser opp, trykk på kortet og hold på ikonet åpner #dorlas, hold på kortet viser detaljer. Garasjeport: ikonet åpner/lukker, kortet åpner #garasje.' }];
        const onHjem = HT0 ? avail.filter((k) => tileSlot(c, HT0, k) !== 'off' && !(get(c, 'tile_hidden.hjem') || []).includes(k)) : [];
        ZONES.forEach(([sl, lab]) => {
          const inZ = onHjem.filter((k) => tileSlot(c, HT0, k) === sl), zf = [];
          if (inZ.length > 1) zf.push({ type: 'boolean', name: `swipe.hjem.${sl}`, label: 'Swipe · ett kort om gangen, sveip for neste', default: sl === 'L-top' });
          if (!inZ.length) zf.push({ type: 'info', label: 'Tomt · legg til med knappene under' });
          inZ.forEach((k) => zf.push(tileF(k)));
          tapF.push({ type: 'section', id: 'zone-' + sl, label: lab, icon: 'mdi:view-grid-outline', meta: inZ.length ? `${inZ.length} kort` : 'Tom', fields: zf });
        });
        const rest = avail.filter((k) => !onHjem.includes(k) && kindOf(c, k) && kindOf(c, k) !== 'jul');
        if (rest.length) tapF.push({ type: 'section', id: 'zone-off', label: 'Ikke på Hjem', icon: 'mdi:eye-off', meta: `${rest.length} kort`, fields: rest.map(tileF) });
        KIND_ORDER.filter((kd) => TILE_DOM[kd]).forEach((kd) => tapF.push({ type: 'button', label: '+ Legg til ' + KINDS[kd][1].toLowerCase(), icon: 'mdi:plus', run: (h, cc, ed) => {
          const id = M.hjemNewTileId(cc, kd);
          ed._set('tile_cfg.' + id, { kind: kd, side: 'R', pos: 'bottom' });
          const hc = get(cc, 'tabs.hjem.cards');
          if (Array.isArray(hc)) ed._set('tabs.hjem.cards', [...hc, id]);
        } }));
        fields.push({ type: 'section', id: 'tap', label: 'Snarveier · soner, entitet og handlinger', icon: 'mdi:gesture-tap', fields: tapF });
        // Fiks 17.7 · Kalender-kortet (sveip-kort): kalendere, «Hele dagen» og trykk/hold
        fields.push({ type: 'section', id: 'kalender', label: 'Sveip-kort · kalender', icon: 'mdi:calendar', fields: [
          { type: 'entities', name: 'calendar.entities', label: 'Kalendere (tom = alle)', domain: 'calendar', domains: ['calendar'], multiple: true },
          { type: 'boolean', name: 'calendar.all_day', label: 'Ta med «Hele dagen»-hendelser', default: true },
          { type: 'tap', name: 'calendar.tap_action', label: 'Trykk', modes: ['std', 'popup', 'hash', 'path', 'url', 'more', 'none'], labels: { path: 'Navigate' }, stdHint: 'Standard: kalender-arket (detaljer)' },
          { type: 'tap', name: 'calendar.hold_action', label: 'Hold', modes: ['std', 'popup', 'hash', 'path', 'url', 'more', 'none'], labels: { path: 'Navigate' }, stdHint: 'Standard: ingen' },
        ] });
        fields.push({ type: 'overrides', label: 'Bytt entiteter for snarveier og sveip-kort', fields: [
          ['lock', 'Dørlås', 'lock'], ['garage', 'Garasjeport', 'cover'], ['alarm', 'Alarm', 'alarm_control_panel'], ['cam', 'Kamera', 'camera'], ['ruter', 'Ruter (avganger)', 'sensor'], ['todo', 'Gjøremål', 'todo'], ['tv', 'TV', 'media_player'], ['vacr', 'Støvsuger', 'vacuum'],
          ['dish', 'Oppvaskmaskin (status)', null], ['wash', 'Vaskemaskin (status)', null], ['dry', 'Tørketrommel (status)', null], ['weather', 'Vær', 'weather'], ['price', 'Strømpris', 'sensor'], ['watt', 'Effekt (hele huset)', 'sensor'], ['calendar', 'Kalender', 'calendar'], ['trash', 'Søppel (dager til tømming)', 'sensor'],
        ].map(([name, label, domain]) => ({ name, label, domain: domain || undefined, auto: (h, cc) => { const e = tileEnts(h, { ...cc, overrides: {} })[name]; return e && typeof e === 'object' ? e.status : e; } })) });
        // Egne snarveier (lenker)
        const links = c.links || {}, lk = Object.keys(links).sort(), lnx = 'l' + pad2(lk.reduce((m, k) => Math.max(m, parseInt(k.slice(1), 10) || 0), 0) + 1);
        const linkF = [];
        [...lk, lnx].forEach((k, i) => {
          const p = `links.${k}`, has = !!(links[k] && links[k].title);
          linkF.push({ type: 'text', name: p + '.title', label: i === lk.length ? 'Ny snarvei · tittel' : `Snarvei ${i + 1} · tittel`, placeholder: 'Tittel', help: i === lk.length ? 'Skriv en tittel, og velg plass på fanen under «Rom og snarveier»' : '' });
          if (!has) return;
          linkF.push({ type: 'text', name: p + '.sub', label: 'Undertekst', placeholder: 'F.eks. {sensor.nordpool_kwh} nå' });
          linkF.push({ type: 'icon', name: p + '.icon', label: 'Ikon', placeholder: 'mdi:star' });
          linkF.push({ type: 'select', name: p + '.color', label: 'Farge', options: TSW, default: 'ingen' });
          linkF.push({ type: 'hash', name: p + '.hash', label: 'Trykk på kortet åpner popup', placeholder: '#strom' });
          linkF.push({ type: 'entity', name: p + '.entity', label: 'Entitet (ikon-trykk / mer info)' });
          linkF.push({ type: 'select', name: p + '.act', label: 'Trykk på ikonet', options: [['toggle', 'Veksle entitet'], ['popup', 'Åpne popup'], ['more', 'Mer info'], ['none', 'Ingen']], default: 'toggle' });
        });
        fields.push({ type: 'section', id: 'links', label: 'Egne snarveier', icon: 'mdi:link-variant', fields: linkF });
        fields.push({ type: 'section', id: 'soppel', label: 'Sveip-kort · søppel', icon: 'mdi:delete', fields: [
          { type: 'hash', name: 'trash_hash', label: 'Popup', placeholder: '#soppel' },
          { type: 'entity', name: 'trash_type_sensor', label: 'Type avfall (valgfri)', domain: 'sensor' },
        ] });
        fields.push({ type: 'section', id: 'romikon', label: 'Romkort · ikon (standard for alle rom)', icon: 'mdi:circle-slice-8', fields: [
          { type: 'select', name: 'icon_color_mode', label: 'Ikonfarge', options: M.ICON_MODES || [], default: 'lights', help: 'Romfarge når lys er på, alltid eller aldri. «Tilpass rom» → Utseende vinner per rom.' },
          { type: 'select', name: 'icon_tap', label: 'Trykk på ikonet', options: M.ICON_TAPS || [], default: 'toggle_lights', help: '«Tilpass rom» → Handlinger vinner per rom. Termostat-knappene påvirkes ikke.' },
        ] });
        areas.forEach((a) => {
          const r = romData(a.id), P = `rooms.${a.id}`, au = M.roomAuto ? M.roomAuto(hass, a.id) : {};
          fields.push({ type: 'section', id: 'rom-' + a.id, label: `Rom · ${a.name}`, icon: 'mdi:texture-box', fields: [
            { type: 'icon', name: P + '.icon', label: 'Ikon', auto: () => (r ? r.icon : a.icon || '') },
            { type: 'color', name: P + '.color', label: 'Farge (ikon når lys er på)', auto: () => (M.romColor ? M.romColor(a.id, hass) : '') },
            { type: 'select', name: P + '.size', label: 'Størrelse i kortliste', options: [['S', 'Liten'], ['M', 'Medium'], ['L', 'Stor']], default: r && (r.temp != null || r.thermo) ? 'M' : 'S' },
            { type: 'boolean', name: P + '.klima', label: 'Klima-knapp (+/−)', help: r && r.thermo ? 'Termostat: ' + r.thermo + ' · kun på medium/store kort og karusell' : 'Ingen termostat i rommet', default: !!(r && r.thermo) },
            { type: 'entity', name: P + '.temperature', label: 'Temperatur', domain: 'sensor', device_class: 'temperature', auto: () => get(c, P + '.temperatur') || au.temp || null },
            { type: 'entity', name: P + '.humidity', label: 'Luftfuktighet', domain: 'sensor', device_class: 'humidity', auto: () => get(c, P + '.fuktighet') || au.hum || null },
            { type: 'entity', name: P + '.climate', label: 'Termostat', domain: 'climate', auto: () => get(c, P + '.termostat') || au.thermo || null },
            ...(M.romBadgeFields ? M.romBadgeFields(hass, c, P + '.badges_own', P + '.badges', r) : []),
          ] });
        });
        fields.push({ type: 'section', id: 'utseende', label: 'Layout', icon: 'mdi:page-layout-body', fields: [
          { type: 'select', name: 'layout_mode', label: 'Layout', options: [['auto', 'Auto (mål dashbordet)'], ['mobil', 'Mobil'], ['stor', 'Stor skjerm']], default: 'auto', help: 'Stor skjerm = Fold-oppsettet: telefon-innholdet i full bredde (auto: ≥ 1000 px, berøring ≥ 600 px).' },
          { type: 'boolean', name: 'toasts', label: 'Bekreftelsesmeldinger (f.eks. «Garasjeporten åpnes»)', default: true },
        ] });
        return fields;
      };
    }
    get cardSize() { return 8; }
    roomCfg(area) { return roomCfgOf(this.config, area); }
    connectedCallback() {
      super.connectedCallback();
      // Fiks 20.19: retur fra bakgrunn (bfcache / appen skjult) eller tilbake til dashbordet → karusellene starter på første kort
      if (!this._onVis) {
        this._onVis = (e) => {
          if (document.visibilityState === 'hidden') { this._hidAt = Date.now(); return; }
          if ((e.type === 'pageshow' && e.persisted) || (e.type === 'visibilitychange' && this._hidAt)) { this._hidAt = 0; this._carReset(); }
        };
        document.addEventListener('visibilitychange', this._onVis);
        window.addEventListener('pageshow', this._onVis);
      }
      if (this._offAt && Date.now() - this._offAt > 1000) this._carReset();
      this._offAt = 0;
      if (!this._ro && window.ResizeObserver) {
        this._ro = new ResizeObserver(() => { const L = this._calcLayout(), o = this._L; if (!o || o.fold !== L.fold) this.update(); });
        this._ro.observe(this);
      }
    }
    disconnectedCallback() {
      super.disconnectedCallback();
      if (this._ro) { this._ro.disconnect(); this._ro = null; }
      if (this._tick) { clearInterval(this._tick); this._tick = null; }
      if (this._mT) { clearInterval(this._mT); this._mT = null; }
      if (this._crT) { clearInterval(this._crT); this._crT = null; }
      if (this._onVis) { document.removeEventListener('visibilitychange', this._onVis); window.removeEventListener('pageshow', this._onVis); this._onVis = null; }
      this._offAt = Date.now();
      if (this._tabRO) { this._tabRO.disconnect(); this._tabRO = null; }
      if (this._tcRO) { this._tcRO.disconnect(); this._tcRO = null; this._tcEl = null; }
    }
    _toast(msg) { if (this.config.toasts !== false) M.toast(msg); }
    _calcLayout() {
      const c = this.config;
      const ha = !!document.querySelector('home-assistant');
      const vw = ha ? M.dashRect().width : ((this.parentElement && this.parentElement.getBoundingClientRect().width) || M.dashRect().width);
      const L = M.hjemLayout(c.layout_mode || 'auto', vw);
      if (this.mshEmbedded) L.fold = !!this.mshEmbedded.fold; // i msh-hjem-card bestemmer containeren (Fold / mobil)
      return L;
    }

    /* ---------- faner */
    _batteries() {
      const hass = this.hass, c = this.config, lim = Number(get(c, 'battery.limit')) || 20, out = [];
      let dev = null;
      const devEnts = () => { if (dev) return dev; dev = {}; Object.values(hass.entities || {}).forEach((e) => { if (e.device_id) (dev[e.device_id] = dev[e.device_id] || []).push(e.entity_id); }); return dev; };
      Object.keys(hass.states).forEach((id) => {
        if (!/^(sensor|binary_sensor)\./.test(id)) return;
        const s0 = hass.states[id];
        if (s0.attributes.device_class !== 'battery' || !regOk(hass, id)) return;
        const s = this.s(id), bin = id.startsWith('binary_sensor.');
        const pct = bin ? null : M.isNum(s.state) ? Number(s.state) : undefined;
        if (pct === undefined) return;
        const e = M.regEntry(hass, id), d = e && e.device_id && hass.devices ? hass.devices[e.device_id] : null;
        const name = (d && (d.name_by_user || d.name)) || String(s.attributes.friendly_name || id).replace(/\s*(battery|batteri)(\s*level|nivå)?$/i, '') || id;
        const area = M.areaOf(hass, id) || (d && d.area_id);
        const sib = d ? (devEnts()[e.device_id] || []).find((x) => x !== id && hass.states[x] && hass.states[x].attributes.device_class !== 'battery') : null;
        out.push({ id, name, room: area ? M.areaName(hass, area) : '', pct, bin, low: bin ? s.state === 'on' : pct < lim, icon: sib ? M.domainIcon(sib, hass.states[sib]) : bin ? 'mdi:battery-alert' : 'mdi:battery' });
      });
      return { list: out, lim };
    }
    _tabsV(B) {
      const c = this.config, T = allTabs(this.hass, c);
      const cond = get(c, 'battery.cond');
      const batOn = !!get(c, 'battery.always') || (cond ? M.isOn(this.s(cond)) : B.list.some((b) => b.low));
      const v = T.filter((t) => !t.hidden && (t.view !== 'batterier' || batOn));
      return v.length ? v : T.slice(0, 1);
    }
    _curTab(TV) {
      let id = this.ui.tab;
      if (id == null && this.config.card_id) { try { id = localStorage.getItem('msh-hjem-tab-' + this.config.card_id); } catch (e) { id = null; } }
      return TV.find((t) => t.id === id) || TV.find((t) => t.id === this.config.default_tab) || TV[0];
    }
    _pickTab(i) {
      const t = (this._TV || [])[i];
      if (!t) return;
      if (this.config.card_id) { try { localStorage.setItem('msh-hjem-tab-' + this.config.card_id, t.id); } catch (e) { /* */ } }
      this.setUI(t.id !== this.ui.tab ? { tab: t.id, sw: {} } : { tab: t.id }); // 20.19: ny fane → karusellene på første kort
    }
    async _reorderTabs(from, to) {
      const TV = this._TV || [], all = allTabs(this.hass, this.config).map((t) => t.id), vis = TV.map((t) => t.id);
      const nv = vis.slice(); const [m] = nv.splice(from, 1); nv.splice(to, 0, m);
      return this._saveTabOrder(nv);
    }
    // Ny rekkefølge for de synlige fanene → full tab_order (skjulte beholder plassen sin)
    async _saveTabOrder(nv) {
      const all = allTabs(this.hass, this.config).map((t) => t.id), vis = (this._TV || []).map((t) => t.id);
      let k = 0;
      const order = all.map((id) => (vis.includes(id) ? nv[k++] : id));
      await this._saveCfg({ tab_order: order });
    }
    async _saveCfg(patch) {
      const old = this._rawConfig || this.config, nc = { ...old, ...patch };
      if (!nc.card_id) nc.card_id = old.card_id || M.uid();
      this.setConfig(nc);
      try { const r = await M.saveCardConfig(this.hass, old, nc); if (r && r.config) { this._rawConfig = r.config; } } catch (e) { /* */ }
    }
    // Fanerad: flex-rad som scroller vannrett (scroll-snap proximity), fanene krymper aldri og kuttes aldri.
    // Linsen (.ind) posisjoneres etter målt fane (afterRender) – bredden følger fanen.
    // Fiks 31.4: fanestilen (tab_style) velger markup. pv = forhåndsvisning i «Tilpass Hjem» ({ attrs(t, i) } per fane).
    _tabsHTML(TV, cur, pv) {
      const st = tabStyle(this.config);
      if (st === 'pille') return pv ? this._pillePV(TV, cur, pv) : this._pilleHTML(TV, cur);
      const B = this._B || this._batteries(), low = B.list.filter((b) => b.low).length;
      const A = (t, i) => (pv ? pv.attrs(t, i) : `data-act="tab" data-i="${i}" data-v="${esc(t.id)}" data-haptic="selection"`);
      const tag = pv ? 'span' : 'button', role = (on) => (pv ? '' : `role="tab" aria-selected="${on}"`);
      const icon = (t) => tabIcon(this.hass, this.config, t), warn = (t) => t.kind === 'batterier' && low > 0;
      const idx = Math.max(0, TV.indexOf(cur));
      if (st === 'popup' || st === 'gear') {
        const items = TV.map((t) => ({ key: t.id, label: t.label, icon: icon(t), warn: warn(t) }));
        return M.tabBar.html(items, cur.id, {
          variant: st === 'gear' ? 'gear' : 'pop', mode: this.config.tab_mode, key: 'hts-bar', preview: !!pv,
          attrs: (t, i) => A(TV[i], i), gearAttrs: 'data-act="hjemedit" data-haptic="light"', gearLabel: 'Tilpass Hjem',
        });
      }
      if (st === 'glide') {
        const N = TV.length || 1;
        return `<div class="hts-glide" data-key="hts-glide" style="grid-template-columns:repeat(${N},minmax(0,1fr))" ${pv ? '' : 'role="tablist"'} data-gd-skip>
          <span class="hts-thumb" data-key="hts-thumb" style="left:calc(4px + (100% - 8px) / ${N} * ${idx});width:calc((100% - 8px) / ${N})"></span>
          ${TV.map((t, i) => `<${tag} class="hts-gt${i === idx ? ' on' : ''}${warn(t) ? ' warn' : ''}" ${role(i === idx)} aria-label="${esc(t.label)}" data-key="hts-${esc(t.id)}" ${A(t, i)}><span class="hts-ic">${M.icon(icon(t), 20)}</span><span class="hts-gl">${esc(t.label)}</span></${tag}>`).join('')}
        </div>`;
      }
      if (st === 'chips') {
        return `<div class="hts-chips" data-key="hts-chips" ${pv ? '' : 'role="tablist"'} data-gd-skip>${TV.map((t, i) => `<${tag} class="hts-ch${i === idx ? ' on' : ''}${warn(t) ? ' warn' : ''}" ${role(i === idx)} aria-label="${esc(t.label)}" data-key="hts-${esc(t.id)}" ${A(t, i)}><span class="hts-ic">${M.icon(icon(t), 22)}</span><span class="hts-cx"><span class="hts-cl">${esc(t.label)}</span><span class="hts-cm">${esc(this._tabMeta(t, B))}</span></span></${tag}>`).join('')}</div>`;
      }
      // to nivåer: hovedrad (Hjem · Etasjer · Aktuelt · egne faner som ikke er Kortliste) + Batterier-knapp; underrad = Kortliste-fanene
      const flo = TV.filter(isFloorTab), inFlo = flo.includes(cur), bat = TV.find((t) => t.kind === 'batterier');
      const top = [];
      TV.forEach((t) => {
        if (t === bat) return;
        if (isFloorTab(t)) { if (!top.some((x) => x.etg)) top.push({ etg: true }); return; }
        top.push(t);
      });
      const tBtn = (x) => {
        if (x.etg) { const tg = inFlo ? cur : flo[0], i = TV.indexOf(tg); return `<${tag} class="hts-tt${inFlo ? ' on' : ''}" ${role(inFlo)} aria-label="Etasjer" data-key="hts-etg" ${A(tg, i).replace(/data-v="[^"]*"/, 'data-v="__etg"')}><span class="hts-ic">${M.icon('mdi:layers-triple', 18)}</span><span class="hts-tl">Etasjer</span></${tag}>`; }
        const i = TV.indexOf(x), on = x === cur;
        return `<${tag} class="hts-tt${on ? ' on' : ''}" ${role(on)} aria-label="${esc(x.label)}" data-key="hts-${esc(x.id)}" ${A(x, i)}><span class="hts-ic">${M.icon(icon(x), 18)}</span><span class="hts-tl">${esc(x.label)}</span></${tag}>`;
      };
      const batB = bat ? `<${tag} class="hts-bat${bat === cur ? ' on' : ''}${low ? ' warn' : ''}" ${role(bat === cur)} aria-label="${esc(bat.label)}" title="${esc(bat.label)}" data-key="hts-bat" data-tr-fixed ${A(bat, TV.indexOf(bat))}>${M.icon(icon(bat), 22)}${low ? `<span class="hts-bn">${low}</span>` : ''}</${tag}>` : '';
      const sub = inFlo ? `<div class="hts-sub" data-key="hts-sub" ${pv ? '' : 'role="tablist"'} data-gd-skip>${flo.map((t) => { const on = t === cur; return `<${tag} class="hts-st${on ? ' on' : ''}" ${role(on)} data-key="hts-s-${esc(t.id)}" ${A(t, TV.indexOf(t))}>${esc(t.label)}</${tag}>`; }).join('')}</div>` : '';
      return `<div class="hts-to" data-key="hts-to"><div class="hts-tor"><div class="hts-top" data-key="hts-top" style="grid-template-columns:repeat(${top.length || 1},minmax(0,1fr))" ${pv ? '' : 'role="tablist"'} data-gd-skip>${top.map(tBtn).join('')}</div>${batB}</div>${sub}</div>`;
    }
    // Status under navnet (Chips): «N favoritter», «N rom · N lys», «Nå», «N lave» / «Alle ok» – fra ekte data
    _tabMeta(t, B) {
      if (t.kind === 'batterier') { const n = B.list.filter((b) => b.low).length; return n ? `${n} lave` : 'Alle ok'; }
      if (isAkt(t)) return 'Nå';
      let R = [];
      try { R = this._rooms(t); } catch (e) { R = []; }
      if (t.kind === 'hjem') return R.length ? `${R.length} ${R.length === 1 ? 'favoritt' : 'favoritter'}` : '–';
      if (!R.length) return '–';
      const lit = R.reduce((n, r) => n + (r.lightsOn || 0), 0);
      return `${R.length} rom${lit ? ` · ${lit} lys` : ''}`;
    }
    // Pille i forhåndsvisningen: statisk (aktiv fane bærer pillen), samme høyde/bredde som på Hjem
    _pillePV(TV, cur, pv) {
      const c = this.config, h = c.tab_height === 'custom' ? Number(c.tab_height_px) || 38 : TAB_H[c.tab_height || 'std'] || 38;
      const w = c.tab_width || 'std', tw = w === 'custom' ? `width:${Number(c.tab_width_px) || 88}px;` : '';
      const pad = w === 'custom' ? '0 6px' : w === 'kompakt' ? '0 12px' : '0 18px';
      return `<div class="hts-pp${w === 'full' ? ' full' : ''}" data-key="hts-pp"><div class="hts-ppr">${TV.map((t, i) => `<span class="hts-pt${t === cur ? ' on' : ''}" data-key="hts-pt-${esc(t.id)}" ${pv.attrs(t, i)} style="height:${h}px;padding:${pad};${tw}">${esc(t.label)}</span>`).join('')}</div></div>`;
    }
    _pilleHTML(TV, cur) {
      const c = this.config, idx = Math.max(0, TV.indexOf(cur));
      const h = c.tab_height === 'custom' ? Number(c.tab_height_px) || 38 : TAB_H[c.tab_height || 'std'] || 38;
      const w = c.tab_width || 'std';
      const tw = w === 'custom' ? `width:${Number(c.tab_width_px) || 88}px;` : '';
      const pad = w === 'custom' ? '0 6px' : w === 'kompakt' ? '0 12px' : '0 18px';
      const P = (this._tabPos || {})[(TV[idx] || {}).id];
      const ind = P ? `left:${P[0]}px;width:${P[1]}px` : 'left:0;width:0;opacity:0';
      // Fiks 20.18: data-ip = linsen (.ind) er målt og plassert. Uten den bærer aktiv fane selv den rosa pillen (CSS),
      // så den er rosa fra første frame – også når kortet ikke er lagt ut ennå (bredde 0, fonter som lastes).
      return `<div class="tabs ${w === 'full' ? 'full' : ''}"><div class="tg msh-tr" data-tabs="1" data-gd-skip${this._tabPos ? ' data-ip' : ''}>
        <span class="ind" style="${ind}"></span>
        ${TV.map((t, i) => `<button class="tab ${i === idx ? 'on' : ''}" role="tab" aria-selected="${i === idx}" data-act="tab" data-i="${i}" data-id="${esc(t.id)}" data-haptic="selection" data-key="tab-${esc(t.id)}" style="height:${h}px;padding:${pad};${tw}">${esc(t.label)}${t.kind === 'hjem' && i !== idx && M.ringDot && M.ringDot() ? '<span class="rdot" style="display:inline-block;width:7px;height:7px;border-radius:4px;margin-left:6px;vertical-align:middle;background:var(--pink,#f285c9)"></span>' : ''}</button>`).join('')}
      </div></div>`;
    }

    /* ---------- snarvei-fliser */
    // Flis-modell for en flis-id (type eller ekstra flis lock_2 …): egen entitet/navn/ikon/undertekst fra tile_cfg.<id>.
    _tileModel(id, E) {
      const c = this.config, kd = kindOf(c, id);
      if (!kd) return this._kindModel(id, E);
      const cfg = tileCfg(c, id);
      let E2 = E;
      if (cfg.entity || id !== kd) {
        E2 = { ...E };
        if (cfg.entity && this.hass.states[cfg.entity]) {
          E2[kd] = APPL[kd] ? applFind(this.hass, kd, cfg.entity) : cfg.entity;
          if (kd === 'todo') E2.todos = [cfg.entity];
        }
      }
      const m = this._kindModel(kd, E2, id);
      if (!m) return null;
      m.kind = id; m.type = kd;
      if (cfg.icon) { m.icon = cfg.icon; m.aIcon = null; }
      if (m.actIcon) m.icon = m.actIcon; // 17.16: ikon når kameraet er aktivt
      const nm = cfg.name;
      if (nm && ['tv', 'vacr', 'cam', 'ruter', 'dish', 'wash', 'dry', 'jul'].includes(kd)) m.title = nm;
      if ((cfg.sub || nm) && !(nm && !cfg.sub && m.title === nm) && !(m.camOn && cfg.sub)) { m.sub = cfg.sub || nm; m.subHtml = null; }
      // Fiks 20.7 · tekst per tilstand: tilstanden flisen viser (lås: også «Låser …» mens den venter; kamera: aktiv = on)
      if (STATE_TXT[kd] && m.ent) {
        const so = this.hass.states[m.ent];
        m.stEnt = m.ent;
        m.stState = kd === 'cam' ? (m.camOn ? 'on' : 'off') : kd === 'lock' && m.lock ? m.lock : so ? so.state : 'unavailable';
        if (kd !== 'cam' && so) (ST_SEEN[m.ent] = ST_SEEN[m.ent] || new Set()).add(so.state);
        const o = (cfg.state_text || {})[m.stState];
        if (o && typeof o === 'object') {
          const x = { hass: this.hass, ent: m.ent, state: m.stState, name: nm };
          const ti = stTxt(o.title, { ...x, def: m.title }), su = stTxt(o.sub, { ...x, def: m.sub });
          if (ti != null) m.title = ti;
          if (su != null) { m.sub = su; m.subHtml = null; }
          if (/\{since\}/.test(`${o.title || ''}${o.sub || ''}`)) this._minTick = true;
        }
      }
      return m;
    }
    _kindModel(kind, E, tid) {
      const hass = this.hass, c = this.config, s = (id) => this.s(id);
      const T = (o) => ({ kind, icon: (KINDS[kind] || [])[0], ...o });
      switch (kind) {
        case 'lock': {
          // Fiks 16.7/17.2: farger via universal-regler (_tileHTML), trykk = lås / lås opp med én gang (PIN bare ved code_format)
          const id = E.lock, st = s(id); if (!id) return null;
          const pend = this._lkPend && this._lkPend.id === id && this._lkPend.from === (st && st.state) && this._lkPend.t > Date.now() ? this._lkPend.to : null;
          const v = pend || (st ? st.state : ''), L = v === 'locked', jam = v === 'jammed', nm = tileCfg(c, tid || 'lock').name || 'Dørlås';
          return T({ ent: id, st, lock: v, variant: tileVariant('lock', !st || M.unavailable(st) ? 'unavailable' : v), icon: L || !st ? 'key' : 'lock_open', title: !st || M.unavailable(st) ? '–' : jam ? 'Feil' : L ? 'Låst' : v === 'locking' ? 'Låser …' : v === 'unlocking' ? 'Låser opp …' : v === 'open' ? 'Åpen' : 'Ulåst', sub: 'Dørlås', cardHash: '#sikkerhet',
            ic: () => this._lockTap(id, nm) });
        }
        case 'alarm': {
          // Fiks 24.6: status-entitet + state_map fra Sikkerhet (M.alarmState) – samme tekst/modus som popupen
          const SC = M.sikCfg ? M.sikCfg() : {}, A = M.alarmState ? M.alarmState(hass, SC, E.alarm) : null;
          const id = (A && A.entity) || E.alarm, st = s(id); if (!id) return null;
          if (E.alarm && E.alarm !== id) s(E.alarm);
          const v = st ? st.state : '', trig = v === 'triggered', busy = /arming|pending/.test(v), armed = A ? A.armed && !trig : /^armed/.test(v);
          const un = !st || M.unavailable(st), al = E.alarm && hass.states[E.alarm];
          return T({ ent: id, title: un ? '–' : A ? A.text : trig ? 'Utløst' : armed ? 'Armert' : busy ? 'Armerer' : 'Av', sub: 'Alarm', variant: A ? (un ? 'error' : trig ? 'alert' : busy ? 'busy' : armed ? 'pink' : 'neutral') : tileVariant('alarm', un ? 'unavailable' : v), cardHash: '#sikkerhet',
            ic: () => { if (!un && !armed && !busy && !trig && (al ? !al.attributes.code_arm_required : /^(select|input_select)\./.test(id)) && M.sikSetMode) { M.sikSetMode(hass, SC, 'borte', null, al ? E.alarm : null).then(() => this._toast('Alarm armert')).catch(() => M.openPopup('#sikkerhet')); } else M.openPopup('#sikkerhet'); } });
        }
        case 'cam': {
          const id = E.cam; if (!id) return null;
          const cams = M.all(hass, 'camera'), A = this._camActive(id, tid || 'cam');
          const idle = A.trig.length ? 'Ingen bevegelse' : `${cams.length} ${cams.length === 1 ? 'kamera' : 'kameraer'}`;
          if (!A.on) return T({ ent: id, title: 'Kamera', sub: idle, tone: null, cardHash: '#kamera' });
          return T({ ent: id, title: 'Kamera', sub: A.sub, tone: A.style === 'pink' ? 'pink' : A.color, camStyle: A.style, camOn: true, pulse: A.pulse, top: A.top, actIcon: A.icon || null, cardHash: '#kamera' });
        }
        case 'ruter': {
          const id = E.ruter, st = s(id), rc = tileCfg(c, tid || 'ruter');
          if (!id || !st) return T({ ent: null, title: 'Ruter', sub: 'Velg stopp', tone: null, cardHash: '#ruter' });
          const sxId = rc.avvik_entity || E.ruterSx, sx = sxId ? s(sxId) : null;
          const nAv = sx && !M.unavailable(sx) ? (M.isNum(sx.state) ? Number(sx.state) : listOf(sx.attributes.meldinger || sx.attributes.messages).length) : 0;
          const R = ruterInfo(st), sub = ruterSub(R, nAv, rc.sub_format, rc.show_next);
          const stop = String(st.attributes.stop_name || st.attributes.friendly_name || '').replace(/^entur\s+/i, '').trim();
          this._minTick = true;
          return T({ ent: id, title: stop || 'Ruter', sub: sub.text, subHtml: sub.html, icon: RUTER_IC[R.mode] || 'mdi:bus', tone: null, cardHash: '#ruter' });
        }
        case 'todo': {
          if (!E.todo) return null;
          const n = E.todos.reduce((t, id) => t + (this.n(id) || 0), 0);
          return T({ ent: E.todo, title: `${n} gjøremål`, sub: E.todos.length > 1 ? `${E.todos.length} lister` : M.name(hass, E.todo), cardHash: '#gjoremal' });
        }
        case 'garage': {
          const id = E.garage, st = s(id); if (!id) return null;
          const v = st ? st.state : '', open = v === 'open';
          return T({ ent: id, title: !st ? '–' : open ? 'Åpen' : v === 'opening' ? 'Åpner' : v === 'closing' ? 'Lukker' : 'Lukket', sub: 'Garasjeport', variant: tileVariant('garage', !st || M.unavailable(st) ? 'unavailable' : v),
            ic: () => { M.call(hass, 'cover', 'toggle', { entity_id: id }); this._toast(open || v === 'opening' ? 'Garasjeporten lukkes' : 'Garasjeporten åpnes'); } });
        }
        case 'tv': {
          const id = E.tv, st = s(id); if (!id) return null;
          const on = !!st && !['off', 'standby', 'unavailable', 'unknown'].includes(st.state);
          const sub = st ? [st.attributes.app_name, st.attributes.media_title].filter(Boolean).join(' · ') || (on ? 'På' : 'Av') : '–';
          return T({ ent: id, title: M.name(hass, id), sub, tone: on ? C.blue : null, hide: !on, cardHash: '#media',
            ic: () => { M.call(hass, 'media_player', 'toggle', { entity_id: id }); this._toast(on ? 'TV slått av' : 'TV slått på'); } });
        }
        case 'vacr': {
          const id = E.vacr, st = s(id); if (!id) return null;
          const v = st ? st.state : '', bat = st && st.attributes.battery_level != null ? ` · ${st.attributes.battery_level} %` : '';
          const run = v === 'cleaning';
          const sub = run ? `Rengjør${bat}` : v === 'paused' ? 'Pauset' : v === 'returning' ? 'Kjører hjem' : v === 'error' ? 'Feil' : v === 'idle' ? 'Klar' : v === 'docked' ? 'I laderen' : '–';
          return T({ ent: id, title: M.name(hass, id), sub, aIcon: this._aIcon('vacuum', run, { done: M.applianceDone && M.applianceDone(id, run, v === 'returning') }), tone: run ? C.green : v === 'paused' || v === 'returning' ? C.orange : v === 'error' ? C.red : null, hide: v === 'docked',
            ic: () => { M.call(hass, 'vacuum', run ? 'pause' : 'start', { entity_id: id }); this._toast(run ? 'Støvsuger pauset' : 'Støvsuger starter'); } });
        }
        case 'dish': case 'wash': case 'dry': {
          const A = this._appl(kind, E[kind]); if (!A) return null;
          if (tid && tileCfg(c, tid).name) A.name = tileCfg(c, tid).name;
          const left = A.secs != null ? `${Math.ceil(A.secs / 60)} min igjen` : '';
          const sub = A.mode === 'run' ? [left, A.prog].filter(Boolean).join(' · ') || 'Kjører' : A.mode === 'done' ? 'Ferdig · klar til å tømmes' : A.mode === 'paused' ? ['Pauset', left].filter(Boolean).join(' · ') : 'Av';
          return T({ ent: A.ent, title: A.name, sub, aIcon: this._applIcon(A), tone: A.mode === 'run' ? C.blue : A.mode === 'done' ? C.green : A.mode === 'paused' ? C.orange : null, solid: A.mode === 'done', hide: A.mode === 'idle', cardHash: A.area ? '#' + A.area : null,
            ic: () => this._applAct(A) });
        }
        case 'jul': {
          const now = new Date(); let tg = new Date(now.getFullYear(), 11, 24);
          if (now > new Date(now.getFullYear(), 11, 27)) tg = new Date(now.getFullYear() + 1, 11, 24);
          const d = Math.ceil((tg - now) / 864e5);
          return T({ title: d > 0 ? `${d} ${d === 1 ? 'dag' : 'dager'} til jul` : 'God jul!', sub: 'Julelys og automasjon', tone: C.green });
        }
        default: {
          const L = (c.links || {})[kind];
          if (!L || !L.title) return null;
          const fill = (t) => String(t || '').replace(/\{([a-z_]+\.[a-z0-9_]+)\}/g, (m, id) => (hass.states[id] ? (this.s(id), M.fmtState(hass, id)) : m));
          const col = L.color && L.color !== 'ingen' ? (L.color === 'rosa' ? 'pink' : TCOL[L.color]) : null;
          return { kind, icon: L.icon || 'mdi:star', title: fill(L.title), sub: fill(L.sub), tone: col, ent: L.entity || null, cardHash: L.hash || null,
            ic: () => { const a = L.act || 'toggle'; if (a === 'none') return; if (a === 'popup' && L.hash) return M.openPopup(L.hash); if (a === 'more' || !L.entity) return L.entity ? M.moreInfo(this, L.entity) : L.hash && M.openPopup(L.hash); M.toggle(hass, L.entity); this._toast(`${fill(L.title)} ${M.isOn(this.s(L.entity)) ? 'av' : 'på'}`); } };
        }
      }
    }
    // 17.16 · aktiv-tilstand for kamera-flisen tid. Holdetid: sist sett aktiv (minne) eller last_changed da utløseren slapp.
    _camActive(cam, tid) {
      const hass = this.hass, a = tileCfg(this.config, tid).active || {}, now = Date.now();
      const own = listOf(a.triggers).filter((t) => t && t.entity);
      const trig = own.length ? own : camAuto(hass, cam).map((e) => ({ entity: e, op: '=', value: 'on' }));
      const hits = trig.map((t) => trigHit(this.s(t.entity), t));
      let on = trig.length > 0 && (a.mode === 'all' ? hits.every(Boolean) : hits.some(Boolean));
      const holdMs = M.clamp(Number(a.hold_min ?? 2) || 0, 0, 30) * 60000;
      const mem = (this._camMem = this._camMem || {});
      let after = false, endT = null, src = trig[hits.findIndex(Boolean)] || null;
      if (on) mem[tid] = { t: now, ent: src && src.entity };
      else if (holdMs && trig.length) {
        const last = trig.map((t) => this.s(t.entity)).filter((x) => x && x.state === 'off').map((x) => Date.parse(x.last_changed));
        const lc = last.length ? Math.max(...last) : 0;
        endT = Math.max(mem[tid] ? mem[tid].t : 0, trig.every((t) => !t.attribute && (t.op || '=') === '=' && (t.value || 'on') === 'on') ? lc : 0);
        if (endT && now - endT < holdMs) { after = true; src = trig.find((t) => mem[tid] && mem[tid].ent === t.entity) || trig[0]; this._minTick = true; }
      }
      // Bare når (minst én) og stille-periode
      const ow = listOf(a.only_when).filter((x) => typeof x === 'string');
      if ((on || after) && ow.length) {
        const P = M.all(hass, 'person'), home = P.some((p) => this.s(p) && this.s(p).state === 'home');
        const ok = { away: () => P.length > 0 && !home, home: () => home, night: () => inWin(get(a, 'night.from') || '22:00', get(a, 'night.to') || '06:00'), armed: () => M.all(hass, 'alarm_control_panel').some((x) => /^armed/.test((this.s(x) || {}).state || '')), entity: () => !!a.only_entity && M.isOn(this.s(a.only_entity)) };
        if (!ow.some((k) => ok[k] && ok[k]())) { on = false; after = false; }
      }
      if ((on || after) && a.quiet && inWin(a.quiet.from, a.quiet.to)) { on = false; after = false; }
      // Ved aktivering (stigende flanke; aldri ved første tegning eller i frakoblede editor-instanser)
      const prev = (this._camPrev = this._camPrev || {});
      if (this.isConnected && prev[tid] === false && on) {
        const act = a.on_activate || 'none';
        if (act === 'haptic') M.haptic('medium');
        if (act === 'popup' && document.visibilityState === 'visible' && this.getClientRects().length && now - (this._camPop || 0) > 300000) { this._camPop = now; setTimeout(() => M.openPopup('#kamera'), 0); }
      }
      if (this.isConnected) prev[tid] = on;
      const active = on || after;
      if (!active) return { on: false, trig };
      const sst = src ? this.s(src.entity) : null, t0 = on ? (sst ? Date.parse(sst.last_changed) : now) : endT;
      const mins = Math.max(0, Math.floor((now - (after ? endT : t0)) / 60000));
      const tok = { tid: hhmm(t0), siden: mins < 1 ? 'under 1 min' : `${mins} min`, entitet: src ? M.name(hass, src.entity) : '', sone: (() => { const ar = M.areaOf(hass, (src && src.entity) || cam) || M.areaOf(hass, cam); return ar ? M.areaName(hass, ar) : ''; })() };
      const fill = (f) => String(f).replace(/\{(tid|siden|entitet|sone)\}/g, (m0, k) => tok[k]);
      return { on: true, trig, style: a.style || 'tint', color: a.color || C.blue, icon: a.icon || null, pulse: !!a.pulse, top: a.on_activate === 'top',
        sub: on ? fill(a.sub_active || 'Bevegelse nå') : fill(a.sub_after || 'Bevegelse for {siden} siden') };
    }
    _appl(kind, info) {
      if (!info) return null;
      const st = this.s(info.status), pw = this.n(info.power), rem = info.remain ? this.s(info.remain) : null, prog = info.prog ? this.s(info.prog) : null;
      const raw = String(st ? st.state : '').toLowerCase();
      let mode = 'idle';
      if (!st || raw === 'unavailable' || raw === 'unknown') mode = 'idle';
      else if (/pause/.test(raw)) mode = 'paused';
      else if (/finish|done|ferdig|complete|slutt|klar til|t(ø|o)m|empty|end$/.test(raw)) mode = 'done';
      else if (/^(off|idle|standby|ready|klar|av|inactive|none|stopped|stoppet|0|false|disconnected)$/.test(raw)) mode = 'idle';
      else if (/^(switch|binary_sensor)\./.test(info.status)) mode = raw === 'on' ? 'run' : 'idle';
      else mode = 'run';
      if (mode === 'idle' && pw != null && pw > 5) mode = 'run';
      let secs = null;
      if (rem && !M.unavailable(rem)) {
        if (rem.attributes.device_class === 'timestamp' || /\d{4}-\d\d-\d\dT/.test(rem.state)) { const t = Date.parse(rem.state); if (!isNaN(t)) secs = Math.max(0, (t - Date.now()) / 1000); } else if (M.isNum(rem.state)) {
          const v = Number(rem.state), u = String(rem.attributes.unit_of_measurement || 'min').toLowerCase();
          const mins = u.startsWith('h') || u === 't' ? v * 60 : u.startsWith('s') ? v / 60 : v;
          const since = mode === 'run' ? Math.max(0, (Date.now() - Date.parse(rem.last_updated || rem.last_changed || Date.now())) / 1000) : 0;
          secs = Math.max(0, mins * 60 - Math.min(since, 59));
        }
      }
      if (mode === 'done') secs = 0;
      const [, icon, name, nominal] = APPL[kind];
      return { kind, mode, secs, prog: prog && !M.unavailable(prog) ? prog.state : '', name, icon, ent: info.status, sw: info.sw, area: info.area, nominal };
    }
    // Animerte hvitevare-ikoner (06-appliance-icons.js); nivå fra appliance_animation (full|calm|off)
    _aIcon(type, run, o, size) {
      if (!M.renderApplianceIcon) return '';
      return M.renderApplianceIcon(type, run, { ...(o || {}), level: this.config.appliance_animation || 'full', size: size || 24 });
    }
    _applIcon(A, size) {
      const type = { dish: 'dishwasher', wash: 'washer', dry: 'dryer' }[A.kind], run = A.mode === 'run';
      const raw = A.ent ? String((this.s(A.ent) || {}).state || '') : '';
      const done = M.applianceDone ? M.applianceDone(A.ent, run, A.mode === 'done') : false;
      return this._aIcon(type, run, { phase: M.appliancePhase ? M.appliancePhase(raw + ' ' + (A.prog || '')) : '', done }, size);
    }
    _applAct(A) {
      if (A.sw) { const on = M.isOn(this.s(A.sw)); M.toggle(this.hass, A.sw); this._toast(`${A.name} ${on ? 'pauset' : 'fortsetter'}`); return; }
      M.moreInfo(this, A.ent);
    }
    _tilesAt(t, side, pos, E) {
      const c = this.config, slot = side + '-' + pos, hid = get(c, `tile_hidden.${t.id}`) || [], ord = get(c, `tile_order.${t.id}`) || [];
      const kinds = availKinds(E, c).filter((k) => tileSlot(c, t, k) === slot && !hid.includes(k) && seasonOk(c, t, k) && !(DYN.includes(k) && t.kind === 'aktuelt'));
      kinds.sort((a, b) => { const ia = ord.indexOf(a), ib = ord.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
      const raw = kinds.map((k) => ({ k, m: this._tileModel(k, E) })).filter((x) => x.m && !x.m.hide);
      raw.sort((x, y) => (y.m.top ? 1 : 0) - (x.m.top ? 1 : 0)); // 17.16: «Vis øverst» mens kameraet er aktivt
      const all = get(c, `swipe.${t.id}.${slot}`) ?? (t.kind === 'hjem' && slot === 'L-top');
      const stack = (k) => get(c, `tiles.${t.id}.${k}.stack`) ?? !!(STACK_DEF[t.kind] || {})[k];
      const stR = raw.filter((x) => all || stack(x.k)), useS = stR.length > 1;
      const flat = (useS ? raw.filter((x) => !stR.includes(x)) : raw).map((x) => this._tileHTML(x.m, `ti-${x.k}`)).join('');
      if (!useS) return flat;
      const key = `${t.id}-${slot}`, n = stR.length, i = M.clamp(get(this.ui, 'sw.' + key) || 0, 0, n - 1);
      return flat + `<div class="swc" data-key="tsw-${esc(key)}"><div class="tsw" data-sw="${esc(key)}" data-n="${n}" data-i="${i}"><div class="track" style="transform:translateX(-${i * 100}%)">${stR.map((x) => `<div class="slot">${this._tileHTML(x.m, 'ts-' + x.k)}</div>`).join('')}</div></div>${!all ? this._dots(n, i) : ''}</div>`;
    }
    // Snarvei-flis = universal small-rad (07-universal.js) i tileV-form (Hjem v2): klassen «ht» gir pille 64 px / radius 32 (Fiks 15.3)
    // på samme element som bakgrunnen, ikon-sirkel 56/28, ikon 24. Ikon-sirkelen er egen knapp (data-w="ic").
    _tileHTML(t, key) {
      const o = { background_color: null, text_color: 'var(--ki-text, var(--white, #fafafa))', icon_color: null, circle_color: null, style: '' };
      if (t.solid && t.tone) Object.assign(o, { background_color: t.tone, text_color: 'var(--ki-on-accent, var(--gray100, #2f2f2f))', circle_color: 'rgb(0 0 0/0.1)', style: 'box-shadow:none;--ht-sub:rgba(31,42,36,0.75)' });
      else if (t.tone === 'pink') Object.assign(o, { background_color: C.accent, text_color: 'var(--ki-on-accent, var(--gray100, #2f2f2f))', circle_color: 'rgba(42,23,32,0.1)', style: 'box-shadow:none;--ht-sub:rgba(42,23,32,0.7)' });
      else if (t.camStyle === 'icon' && t.tone) Object.assign(o, { icon_color: t.tone });
      else if (t.camStyle === 'tint' && t.tone) Object.assign(o, { background_color: M.alpha(t.tone, 0.16), icon_color: t.tone, circle_color: M.alpha(t.tone, 0.2), style: `box-shadow:inset 0 0 0 1px ${M.alpha(t.tone, 0.35)}` });
      else if (t.camStyle === 'solid' && t.tone) Object.assign(o, { background_color: t.tone, text_color: 'var(--ki-on-accent, var(--gray100, #2f2f2f))', circle_color: 'rgb(0 0 0/0.1)', style: 'box-shadow:none;--ht-sub:rgba(35,35,35,0.75)' });
      else if (t.tone) Object.assign(o, { background_color: M.alpha(t.tone, 0.14), icon_color: t.tone, circle_color: M.alpha(t.tone, 0.2), style: `box-shadow:inset 0 0 0 1px ${M.alpha(t.tone, 0.4)}` });
      // Fiks 21.2: lås/garasje/alarm – hele flisen fra én variant (TILE_VAR), ingen universal-tilstandsregler som kan
      // treffe en annen tilstand enn den flisen viser (f.eks. «Låser opp …» mens HA fortsatt sier locked).
      const st = null;
      let blink = false;
      if (t.variant && TILE_VAR[t.variant]) {
        const V = TILE_VAR[t.variant];
        blink = !!V.blink;
        Object.assign(o, { background_color: V.bg, text_color: V.fg, icon_color: V.icon, circle_color: V.circle, style: `${V.flat ? 'box-shadow:none;' : ''}--ht-sub:${V.sub}` });
      }
      // Innebygde fliser (lås, alarm, kamera …) har to soner med egne hold-handlinger (_bindTileHold) – ingen data-ent.
      const zones = !!t.type;
      const ring = zones && this._tapFor(t.kind, 'hold_ic', t).action !== 'none' ? '<svg class="hr" viewBox="0 0 56 56" aria-hidden="true"><circle cx="28" cy="28" r="26.5" pathLength="100"></circle></svg>' : '';
      return M.universal({ ...o, mode: 'sensor', size: 'small', st, cls: 'ht' + (zones ? ' hz' : '') + (t.pulse ? ' hpulse' : '') + (blink ? ' hblink' : ''), icon: t.icon, icon_html: ring + (t.aIcon || M.icon(t.icon || 'mdi:link', 24)), main_text: t.title, sub_text: t.sub || '', sub_html: t.subHtml || null,
        act: 'tile', id: null, ent: zones ? false : t.ent || false, key, attrs: { 'data-k': t.kind, 'data-w': 'card', 'data-hz': zones ? '1' : null },
        icon_attrs: { role: 'button', 'data-act': 'tile', 'data-k': t.kind, 'data-w': 'ic' } });
    }
    // Handling for en flis og sone (ic | card | hold_ic | hold_card): tile_cfg.<id> → 16.7-aliaser → gammel tap.<type> → DEF_TAP.
    _tapFor(id, w, t) {
      const c = this.config, kd = kindOf(c, id), cfg = tileCfg(c, id);
      let a = cfg[TAP_KEYS[w]];
      if (a == null || a === '') a = w === 'hold_ic' ? cfg.icon_hold_action : w === 'hold_card' ? cfg.hold_action : cfg.tap_action;
      if ((a == null || a === '') && w === 'card' && cfg.popup_hash) a = NAV('#' + String(cfg.popup_hash).trim().replace(/^#/, '')); // 32.3: tile_cfg.<id>.popup_hash
      a = M.tap ? M.tap.norm(a) : null;
      if (a) return a;
      const tp = get(c, 'tap.' + id) || {};
      if (w === 'card' && tp.card_hash) return NAV(tp.card_hash);
      if (w === 'ic' && tp.icon && tp.icon !== 'auto') {
        if (tp.icon === 'none') return { action: 'none' };
        if (tp.icon === 'more') return { action: 'more-info' };
        if (tp.icon === 'popup') { const h = tp.icon_hash || tp.card_hash || (t && t.cardHash); return h ? NAV(h) : { action: 'none' }; }
        if (tp.icon === 'script') return tp.script ? { action: 'perform-action', perform_action: 'script.turn_on', data: { entity_id: tp.script } } : { action: 'none' };
      }
      const d = (DEF_TAP[kd] || {})[w];
      if (d) return d;
      if (w === 'ic') return t && t.ic ? { action: 'toggle' } : this._tapFor(id, 'card', t);
      if (w === 'card') { const h = tp.card_hash || (t && t.cardHash); return h ? NAV(h) : { action: 'more-info' }; }
      if (w === 'hold_card') return { action: 'more-info' };
      return { action: 'none' };
    }
    // #dorlas finnes bare når det er lås(er) (og popupen ikke er skjult) – ellers faller ikon-holdet tilbake til more-info
    _hasPopup(hash) {
      if (hash === '#dorlas' && !M.all(this.hass, 'lock').length) return false;
      if (hash === '#garasje' && !M.all(this.hass, 'cover', (st) => st.attributes.device_class === 'garage').length) return false;
      const R = M.popupReport;
      if (R && Array.isArray(R.entries) && R.entries.length) return R.entries.some((e) => e.hash === hash && !e.hidden);
      return true;
    }
    _doTap(t, a) {
      const ent = t.ent || null;
      if (!a || a.action === 'none') return;
      if (a.action === 'toggle') { if (t.ic) return t.ic(); if (ent) M.toggle(this.hass, ent); return; }
      if (a.action === 'more-info') { const e = a.entity || ent; if (e) M.moreInfo(this, e); return; }
      if (a.action === 'navigate' && /^#/.test(a.navigation_path) && !this._hasPopup(a.navigation_path)) { if (ent) M.moreInfo(this, ent); return; }
      if (a.action === 'navigate' && a.navigation_path === '#dorlas' && ent && /^lock\./.test(ent)) M.lasPick = ent; // popupen viser låsen på flisen
      if (a.action === 'navigate' && a.navigation_path === '#garasje' && ent && /^cover\./.test(ent)) M.garasjePick = ent; // 32.3: popupen viser porten på flisen
      if (a.action === 'perform-action' || a.action === 'call-service') { if (M.tap.run(this, a, { entity: ent, hass: this.hass })) this._toast('Kjørte ' + (a.perform_action || a.service)); return; }
      if (M.tap) M.tap.run(this, a, { entity: ent, hass: this.hass });
    }
    _runTile(kind, w) {
      if (/^akt:/.test(kind)) return this._runAkt(kind);
      const c = this.config, t = this._tileModel(kind, this._E || tileEnts(this.hass, c));
      if (!t) return;
      if (kindOf(c, kind)) return this._doTap(t, this._tapFor(kind, w, t));
      // egne snarveier (lenker)
      if (w === 'card') { if (t.cardHash) return M.openPopup(t.cardHash); if (t.ent) return M.moreInfo(this, t.ent); return; }
      if (t.ic) return t.ic();
      if (t.cardHash) return M.openPopup(t.cardHash);
      if (t.ent) M.moreInfo(this, t.ent);
    }
    // Dørlås (fiks 17.2): ett trykk låser / låser opp med én gang – ingen bekreftelse, ingen toast. PIN-tastatur bare når
    // låsen har code_format (M.lockUnlock portaler det ut). Flisen viser «Låser …» / «Låser opp …» til ny state kommer.
    _lockTap(id, name) {
      const hass = this.hass, st = hass.states[id];
      if (!st || M.unavailable(st)) return;
      const lock = st.state !== 'locked' && st.state !== 'locking';
      if (lock) M.call(hass, 'lock', 'lock', { entity_id: id }).catch(() => {});
      else if (M.lockUnlock) { M.lockUnlock(this, id, { name, toast: () => {} }); if (st.attributes.code_format) return; } else M.call(hass, 'lock', 'unlock', { entity_id: id }).catch(() => {});
      this._lkPend = { id, from: st.state, to: lock ? 'locking' : 'unlocking', t: Date.now() + 20000 };
      clearTimeout(this._lkT);
      this._lkT = setTimeout(() => { this._lkPend = null; this.update(); }, 20000);
      this.update();
    }
    // Fiks 16.7 · to soner per flis: ikon-sirkelen og resten av kortet. Hold 500 ms → hold_ic / hold_card (én haptic
    // medium; klikket etterpå svelges). Mens ikonet holdes fylles en tynn ring 0 → 100 %. > 8 px bevegelse avbryter
    // (sveip i flis-stabelen / scroll). contextmenu og tekstmarkering blokkeres (CSS + preventDefault).
    _bindTileHold() {
      if (this._thB) return;
      this._thB = true;
      const R = this.shadowRoot;
      R.addEventListener('pointerdown', (e) => { this._pdXY = [e.clientX, e.clientY]; }, true); // 17.7: trykk vs. sveip
      let st = null;
      const end = () => {
        if (!st) return;
        clearTimeout(st.t);
        if (st.ic) st.ic.classList.remove('holding');
        st = null;
        if (this._busy === 'hold') { this._busy = false; this._schedule(); }
      };
      R.addEventListener('pointerdown', (e) => {
        if (e.button) return;
        const tile = this._el(e, '.u.ht[data-hz]', true);
        if (!tile) return;
        end();
        const icEl = this._el(e, '[data-w="ic"]', true), zone = icEl && tile.contains(icEl) ? 'hold_ic' : 'hold_card', k = tile.dataset.k;
        const t = this._tileModel(k, this._E || tileEnts(this.hass, this.config));
        if (!t) return;
        const a = this._tapFor(k, zone, t);
        if (!a || a.action === 'none') return;
        const s0 = (st = { x: e.clientX, y: e.clientY, ic: zone === 'hold_ic' ? icEl : null });
        if (!this._busy) this._busy = 'hold'; // ingen ny tegning midt i holdet (ringen skal ikke nullstilles)
        if (s0.ic) { void s0.ic.offsetWidth; s0.ic.classList.add('holding'); }
        s0.t = setTimeout(() => {
          if (st !== s0) return;
          end();
          this._swallow = true;
          setTimeout(() => { this._swallow = false; }, 700);
          M.haptic('medium');
          this._runTile(k, zone);
        }, 500);
      }, true);
      R.addEventListener('pointermove', (e) => { if (st && Math.hypot(e.clientX - st.x, e.clientY - st.y) > 8) end(); }, true);
      ['pointerup', 'pointercancel'].forEach((ty) => R.addEventListener(ty, end, true));
      R.addEventListener('contextmenu', (e) => { if (this._el(e, '.u.ht[data-hz]', true)) e.preventDefault(); });
    }
    _dots(n, i) { return M.dotsHTML(n, i); } // felles trykkbare prikker (17.12)

    /* ---------- sveip-slides */
    _slide(id, E) {
      const hass = this.hass, c = this.config, s = (x) => this.s(x);
      if (id === 'vaer') {
        const w = s(E.weather), a = w ? w.attributes : {};
        return { top: w ? a.friendly_name || 'Vær' : 'Vær', title: w && a.temperature != null ? `${M.nf(a.temperature, 1)}°` : '–', line1: w ? WX[w.state] || w.state : '–', line2: w ? [a.humidity != null ? `Fukt ${M.nf(a.humidity, 0)} %` : '', a.wind_speed != null ? `vind ${M.nf(a.wind_speed, 0)} ${a.wind_speed_unit || 'm/s'}` : ''].filter(Boolean).join(' · ') : '', hash: '#vaer' };
      }
      if (id === 'strom') {
        // Felles strømpris-kilde (MSH.powerPrice): pris som vises, enhet og SEK→kr fra power_price; overrides.price bytter sensor
        const P = M.powerPrice(this.hass, (c.overrides || {}).price ? M.powerPriceCfg(null, { spot_entity: c.overrides.price, se_entity: c.overrides.price }) : null, this), W = this.n(E.watt);
        const m = P.cheapest();
        return { top: 'Strøm nå', title: P.fmt(P.now), line1: W != null ? `${M.nf(W, 0)} W` : '–', line2: m ? `Billigst kl. ${pad2(m.h)} · ${P.fmt(m.v)}` : '', hash: '#strom' };
      }
      if (id === 'cal') {
        // 17.7: valgte kalendere (standard: alle), tidligste hendelse; «Hele dagen» kan utelates
        const K = c.calendar || {}, sel = listOf(K.entities).filter((x) => typeof x === 'string' && hass.states[x]);
        const ids = sel.length ? sel : (c.overrides || {}).calendar && E.calendar ? [E.calendar] : M.all(hass, 'calendar');
        const T0 = (x) => (x ? new Date(String(x).replace(' ', 'T')) : null);
        let best = null;
        ids.forEach((cid) => { const k = s(cid), a = k ? k.attributes : {}; const st = T0(a.start_time); if (!st || isNaN(st) || (K.all_day === false && a.all_day)) return; if (!best || st < best.st) best = { id: cid, a, st }; });
        const a = best ? best.a : {}, st = best ? best.st : null, en = T0(a.end_time);
        const tm = (d) => `${d.getHours()}:${pad2(d.getMinutes())}`;
        return { top: st ? st.toLocaleDateString('nb-NO', { weekday: 'long' }) : 'Kalender', title: st ? st.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' }) : '–', line1: st ? (a.all_day ? 'Hele dagen' : tm(st) + (en && !isNaN(en) ? ' · ' + tm(en) : '')) : 'Ingen hendelser', line2: a.message || '', ent: best ? best.id : ids[0] || E.calendar || null };
      }
      const d = this.n(E.trash), ty = c.trash_type_sensor ? s(c.trash_type_sensor) : null, ts = E.trash ? s(E.trash) : null;
      const type = ty ? ty.state : ts ? ts.attributes.type || ts.attributes.avfallstype || ts.attributes.friendly_name : '';
      return { top: 'Søppel', title: d == null ? '–' : d <= 0 ? 'I dag' : d === 1 ? 'I morgen' : `Om ${M.nf(d, 0)} dager`, line1: type || '–', line2: '', hash: c.trash_hash || '#soppel' };
    }
    _slideHTML(id, E) {
      const x = this._slide(id, E);
      // Kalender: hold gjør ingenting som standard (17.7) – data-ent (hold-timer) bare når hold-handling er valgt
      const hold = id !== 'cal' || (calNorm(get(this.config, 'calendar.hold_action')) || { action: 'none' }).action !== 'none';
      return `<div class="rk sl" data-act="slide" data-s="${id}" data-key="sl-${id}" ${x.ent && hold ? `data-ent="${esc(x.ent)}"` : ''}>
        <span class="sl-top ell">${esc(x.top)}</span><span class="sl-ti ell">${esc(x.title)}</span><span style="flex:1"></span><span class="sl-bar"></span>
        <span class="sl-l1 num">${esc(x.line1)}</span><span class="sl-l2 ell">${esc(x.line2)}</span></div>`;
    }

    /* ---------- rom */
    _rooms(t) {
      if (isAkt(t)) return []; // 20.13: Aktuelt viser aldri romkort (uansett lagret layout)
      const c = this.config, hid = get(c, `layout.${t.id}.hidden`) || [];
      const list = baseRooms(this.hass, c, t).filter((a) => !hid.includes(a.id)).map((a) => M.romData(this, a.id, this.roomCfg(a.id))).filter(Boolean);
      if (t.kind !== 'aktuelt') return list;
      // Aktuelt: rom vises bare når de er aktuelle – media spiller, lys på i tomt rom, eller avvik (romvarsel).
      const on = M.aktTypes(c), hass = this.hass;
      const busy = (r) => M.all(hass, 'binary_sensor', (s, id) => PRES_DC.includes(s.attributes.device_class) && M.areaOf(hass, id) === r.id).some((id) => M.isOn(this.s(id)));
      const alert = (r) => { const rc = get(c, 'rooms.' + r.id) || {}; return !!(M.romAlert && M.romAlert(this, r, rc.badges_own, rc.badges)); };
      return list.filter((r) => (on.includes('media') && r.mediaOn > 0) || (on.includes('lights') && r.lightsOn > 0 && !busy(r)) || (on.includes('alerts') && alert(r)));
    }
    _size(r) { return get(this.config, `rooms.${r.id}.size`) || (r.temp != null || r.thermo ? 'M' : 'S'); }
    _klima(r) { return (get(this.config, `rooms.${r.id}.klima`) ?? true) && !!r.thermo && r.set != null; }
    _sides(t, rooms, car) {
      const c = this.config, L = [], R = [];
      let hl = 0, hr = 0;
      rooms.forEach((r, i) => {
        const h = car ? 1 : ({ S: 66, M: this._klima(r) ? 210 : 140, L: 246 })[this._size(r)] + 8;
        let sd = get(c, `layout.${t.id}.side.${r.id}`);
        if (!sd) sd = car || t.kind === 'aktuelt' ? (i % 2 ? 'R' : 'L') : hl <= hr ? 'L' : 'R';
        if (sd === 'R') { R.push(r); hr += h; } else { L.push(r); hl += h; }
      });
      return { L, R };
    }
    _roomHTML(r, variant) {
      const rc = get(this.config, 'rooms.' + r.id) || {};
      const alert = M.romAlert ? M.romAlert(this, r, rc.badges_own, rc.badges) : '';
      return M.romkortHTML(r, { variant, klima: this._klima(r), alert, key: `rk-${variant}-${r.id}` });
    }
    _carousel(t, side, rooms, E) {
      const sl = get(this.config, `slides.${t.id}.${side}`) || {}, slides = Object.keys(SLIDES).filter((k) => sl[k]);
      const items = [...rooms.map((r) => this._roomHTML(r, 'karusell')), ...slides.map((k) => this._slideHTML(k, E))];
      if (!items.length) return '';
      const key = `${t.id}-car-${side}`, n = items.length;
      // Fiks 20.4/20.19: uten manuell sveip står karusellen på regelens kort (ellers første). Endres regelens resultat, rulles den dit –
      // men en manuell sveip de siste 60 s overstyres aldri. Indeksen lagres bare i minnet (ikke localStorage).
      const T = this._carFirst(t, side, rooms, slides), CT = (this._carT = this._carT || {}), prev = CT[key];
      CT[key] = T;
      const sw = this._ui.sw || {};
      if (sw[key] != null && prev != null && prev !== T && Date.now() - ((this._swT || {})[key] || 0) > 60000) { const o = { ...sw }; delete o[key]; this._ui.sw = o; }
      const i = M.clamp(get(this.ui, 'sw.' + key) ?? T, 0, n - 1), dots = get(this.config, `carousel.${t.id}.${side}.dots`) !== false;
      return `<div class="carw" data-key="car-${esc(key)}"><div class="car" data-sw="${esc(key)}" data-n="${n}" data-i="${i}"><div class="track" style="transform:translateX(-${i * 100}%)">${items.map((h) => `<div class="slot">${h}</div>`).join('')}</div></div>${dots ? this._dots(n, i) : ''}</div>`;
    }
    // Fiks 20.4: indeksen den første regelen som slår til gir (Rommene = 0, sveip-kort etter rommene); ingen treff → 0
    _carFirst(t, side, rooms, slides) {
      const L = listOf(get(this.config, `carousel.${t.id}.${side}.first`));
      if (!L.length) return 0;
      const cb = this._carCb || (this._carCb = () => { if (this.isConnected) this._schedule(true); });
      for (const r of L) {
        if (!r || typeof r !== 'object') continue;
        const k = r.slide || 'rooms', j = slides.indexOf(k), idx = k === 'rooms' ? (rooms.length ? 0 : -1) : j < 0 ? -1 : rooms.length + j;
        if (idx < 0) continue;
        const p = M.condParse(r.condition);
        if (p.error || !p.value) continue; // ugyldig YAML / tom betingelse → hoppes over
        if (M.condEval(this.hass, p.value, { dep: (id) => this.s(id), onChange: cb }) === true) return idx;
      }
      return 0;
    }
    // Fiks 20.19: tilbake til første kort (eller regelens) – uten animasjon, så første frame viser riktig kort
    _carReset() {
      this._ui = { ...this._ui, sw: {} };
      this._swT = {}; this._carT = {};
      this.classList.add('nt');
      clearTimeout(this._ntT);
      this._ntT = setTimeout(() => this.classList.remove('nt'), 150);
      this._schedule(true);
    }
    // Aktuelt: dynamiske snarvei-fliser (bare når noe er aktuelt) etter tabs.aktuelt.types.
    _aktItems(E, B) {
      const hass = this.hass, c = this.config, on = M.aktTypes(c), hidT = get(c, 'tile_hidden.aktuelt') || [], out = [];
      const put = (m) => { if (m && !m.hide) out.push(m); };
      const bins = (dcs) => Object.keys(hass.states).filter((id) => id.startsWith('binary_sensor.') && dcs.includes(hass.states[id].attributes.device_class) && regOk(hass, id));
      const where = (id) => { const a = M.areaOf(hass, id); return a ? M.areaName(hass, a) : ''; };
      this._akt = {};
      const dyn = (id, o) => { const k = 'akt:' + id; this._akt[k] = o; put({ kind: k, ...o }); };
      if (on.includes('appliances') && E.vacr && !hidT.includes('vacr')) { const st = this.s(E.vacr), m = this._tileModel('vacr', E); if (m && st && /cleaning|paused|returning|error/.test(st.state)) put(m); }
      if (on.includes('media') && !hidT.includes('tv')) put(this._tileModel('tv', E));
      if (on.includes('doors')) {
        bins(DOOR_DC).forEach((id) => {
          const st = this.s(id);
          if (!M.isOn(st)) return;
          const win = st.attributes.device_class === 'window';
          dyn(id, { ent: id, icon: win ? 'mdi:window-open-variant' : 'mdi:door-open', title: M.name(hass, id), sub: [win ? 'Vindu åpent' : 'Åpen', where(id)].filter(Boolean).join(' · '), tone: C.orange });
        });
        if (E.garage) { const st = this.s(E.garage); if (st && st.state === 'open') dyn(E.garage, { ent: E.garage, icon: 'mdi:garage-open', title: M.name(hass, E.garage), sub: 'Garasjeporten er åpen', tone: C.orange }); }
      }
      if (on.includes('battery')) {
        const low = B.list.filter((b) => b.low);
        if (low.length) dyn('batterier', { ent: low[0].id, icon: 'mdi:battery-alert', title: `${low.length} ${low.length === 1 ? 'batteri' : 'batterier'} lavt`, sub: low.slice(0, 2).map((b) => b.name).join(', ') + (low.length > 2 ? ' …' : ''), tone: C.red, tab: 'batterier' });
      }
      if (on.includes('alerts')) {
        bins(PROB_DC).forEach((id) => { const st = this.s(id); if (M.isOn(st)) dyn(id, { ent: id, icon: 'mdi:alert-circle', title: M.name(hass, id), sub: ['Avvik', where(id)].filter(Boolean).join(' · '), tone: C.red, solid: true }); });
        { const A = M.alarmState ? M.alarmState(hass, M.sikCfg ? M.sikCfg() : {}, E.alarm) : null, aid = (A && A.entity) || E.alarm, st = aid && this.s(aid); if (st && st.state === 'triggered') dyn(aid, { ent: aid, icon: 'shield', title: A && A.text !== 'triggered' ? A.text : 'Alarm utløst', sub: M.name(hass, aid), tone: C.red, solid: true, hash: '#sikkerhet' }); } // 24.6: status-entitet
        if (E.lock) { const st = this.s(E.lock); if (st && st.state === 'jammed') dyn(E.lock, { ent: E.lock, icon: 'lock_open', title: 'Dørlås feil', sub: M.name(hass, E.lock), tone: C.red, hash: '#sikkerhet' }); }
      }
      return out;
    }
    _runAkt(kind) {
      const x = (this._akt || {})[kind];
      if (!x) return;
      if (x.tab) { const i = (this._TV || []).findIndex((t) => t.id === x.tab); if (i >= 0) return this._pickTab(i); }
      if (x.hash) return M.openPopup(x.hash);
      if (x.ent) M.moreInfo(this, x.ent);
    }
    // Autofyll én gang (første oppsett): lagre kuratert Hjem og Aktuelt-typer når ki-store er lastet og kortet har card_id.
    _autoFillOnce() {
      const c = this.config, hass = this.hass;
      if (this._afDone || !this.isConnected || !c.card_id || !hass || !hass.entities || !M.store || !M.store.loaded || get(c, 'tabs.hjem')) return;
      if (!M.areas(hass).length) return;
      this._afDone = true;
      const hc = M.hjemCards(hass, c), tabs = { ...(c.tabs || {}) };
      tabs.hjem = hc.auto ? { auto_fill: true } : { auto_fill: false, cards: hc.cards, seen: hc.candidates };
      if (!tabs.aktuelt) tabs.aktuelt = { auto_fill: false, types: M.aktTypes(c) };
      setTimeout(() => { if (!get(this.config, 'tabs.hjem')) this._saveCfg({ tabs }); }, 0);
    }
    // 20.13 · migrering: rom lagret i layout.aktuelt.order tømmes én gang (rendering ignorerer dem uansett)
    _aktMigOnce() {
      const c = this.config, o = get(c, 'layout.aktuelt.order');
      if (this._akMig || !Array.isArray(o) || !o.length || !this.isConnected || !c.card_id || !M.store || !M.store.loaded || window.__kiSaving || (M.draftOf && M.draftOf(this))) return;
      this._akMig = true;
      setTimeout(() => { const L = { ...(get(this.config, 'layout') || {}) }; if (!get(L, 'aktuelt.order')) return; const a = { ...L.aktuelt }; delete a.order; L.aktuelt = a; this._saveCfg({ layout: L }); }, 0);
    }
    _applCards(E) {
      const cards = ['dish', 'wash', 'dry'].map((k) => this._appl(k, E[k])).filter((A) => A && A.mode !== 'idle');
      const now = Date.now();
      this._applT = cards.filter((A) => A.mode === 'run' && A.secs != null).map((A) => ({ kind: A.kind, end: now + A.secs * 1000, nominal: A.nominal }));
      this._ticking = this._applT.length > 0;
      if (!cards.length) return '';
      const hms = (s) => `${Math.floor(s / 3600)}:${pad2(Math.floor((s % 3600) / 60))}:${pad2(Math.floor(s % 60))}`;
      return `<div class="apg">${cards.map((A) => {
        const p = A.mode === 'done' ? 100 : A.secs != null ? M.clamp((1 - A.secs / 60 / A.nominal) * 100, 2, 100) : 100;
        const time = A.mode === 'done' ? 'Ferdig' : A.secs != null ? hms(A.secs) : A.mode === 'paused' ? 'Pauset' : 'Kjører';
        const col = A.mode === 'done' ? 'var(--ki-green-text, ' + C.green + ')' : A.mode === 'paused' ? 'var(--ki-text-2, var(--gray800,#afafaf))' : 'var(--ki-text, var(--white,#fafafa))';
        const bar = A.mode === 'done' ? C.green : A.mode === 'paused' ? 'var(--ki-text-mid, var(--gray700,#979797))' : 'var(--ki-text, var(--white,#fafafa))';
        return `<div class="ap" data-key="ap-${A.kind}" data-ent="${esc(A.ent)}">
          <div class="ap-h"><span class="ap-n ell">${esc(A.name)}</span><button class="ap-b" data-act="appl" data-k="${A.kind}" title="${A.mode === 'done' ? 'Tøm' : A.mode === 'run' ? 'Pause' : 'Fortsett'}">${this._applIcon(A, 20) || M.icon(A.icon, 20)}</button></div>
          <span style="flex:1"></span><span class="ap-t num" style="color:${col}">${time}</span>
          <span class="ap-s ell">${esc(A.mode === 'done' ? 'Klar til å tømmes' : (A.mode === 'paused' ? 'Pauset · ' : '') + (A.prog || ''))}</span>
          <div class="ap-bar"><span style="width:${p.toFixed(1)}%;background:${bar};${A.secs == null && A.mode !== 'done' ? 'opacity:.35' : ''}"></span></div></div>`;
      }).join('')}</div>`;
    }
    _batView(B) {
      const c = this.config, show = get(c, 'battery.show') || 'lav', lim = B.lim;
      const low = B.list.filter((b) => b.low).length;
      const list = B.list.filter((b) => show !== 'lav' || b.low).sort((a, b) => (a.pct ?? -1) - (b.pct ?? -1));
      const head = low ? `${low} ${low === 1 ? 'batteri' : 'batterier'} under ${lim} %` : `Alle batterier over ${lim} %`;
      const meta = `${show === 'lav' ? 'Viser lave' : 'Viser alle ' + B.list.length} · auto fra device_class battery`;
      if (!B.list.length) return M.emptyState('Fant ingen batterisensorer (device_class battery)', 'batterier');
      return `<div class="bv"><div class="bh"><span class="bh-t">${esc(head)}</span><span class="bh-m">${esc(meta)}</span></div>
        <section class="bl">${list.length ? list.map((b, i) => {
          const col = b.bin ? C.red : b.pct < 15 ? C.red : b.pct < 30 ? C.orange : C.green, warn = b.bin || b.pct < 30;
          return `<div class="br" data-key="b-${esc(b.id)}" data-ent="${esc(b.id)}" data-act="more" data-id="${esc(b.id)}" style="${i ? '' : 'border-top:0'}">
            ${M.icon(b.icon, 22, `width:26px;color:${warn ? (M.theme ? M.theme.accentText(col) : col) : 'var(--ki-text-2, var(--gray800,#afafaf))'}`)}
            <span class="bn"><span class="bnn ell">${esc(b.name)}</span><span class="bnr ell">${esc([b.room, b.id].filter(Boolean).join(' · '))}</span></span>
            <span class="bb"><span style="width:${b.bin ? 100 : M.clamp(b.pct, 0, 100)}%;background:${col}"></span></span>
            <span class="bp num" style="color:${warn ? (M.theme ? M.theme.accentText(col) : col) : 'var(--ki-text, var(--white,#fafafa))'}">${b.bin ? 'Lavt' : M.nf(b.pct, 0) + ' %'}</span></div>`;
        }).join('') : `<div class="br" style="border-top:0;color:var(--ki-text-mid, var(--gray700,#979797));font-size:13px">Ingen batterier under ${lim} %</div>`}</section></div>`;
    }

    /* ---------- render */
    render() {
      const c = this.config, hass = this.hass;
      if (!M.romkortHTML || !M.romData) return '<div class="empty">Romkort-modulen mangler</div>';
      const L = (this._L = this._calcLayout());
      this._ticking = false;
      const wrap = (inner) => `<div class="hf ${L.fold ? 'fold' : ''}">${inner}</div>`;
      if (!M.areas(hass).length) return wrap(M.emptyState('Fant ingen rom (områder) i Home Assistant', 'faner'));
      const B = (this._B = this._batteries()), E = (this._E = tileEnts(hass, c));
      const TV = (this._TV = this._tabsV(B)), cur = this._curTab(TV);
      this._autoFillOnce();
      this._aktMigOnce();
      this._cur = cur;
      let view = '';
      if (cur.view === 'batterier') view = this._batView(B);
      else {
        const rooms = this._rooms(cur), car = cur.view === 'karusell', S = this._sides(cur, rooms, car);
        const akt = isAkt(cur) ? this._aktItems(E, B) : [];
        const col = (side) => {
          const dyn = akt.filter((x, i) => (i % 2 ? 'R' : 'L') === side).map((x) => this._tileHTML(x, 'ak-' + x.kind)).join('');
          const top = dyn + this._tilesAt(cur, side, 'top', E), bot = this._tilesAt(cur, side, 'bottom', E);
          const mid = car ? this._carousel(cur, side, S[side], E) : S[side].map((r) => this._roomHTML(r, this._size(r))).join('');
          return `<div class="col">${top}${mid}${bot}</div>`;
        };
        const appl = isAkt(cur) && M.aktTypes(c).includes('appliances') ? this._applCards(E) : '';
        const cols = col('L') + col('R');
        const empty = !rooms.length && !/class="(tile|slot|rk|u u-)/.test(cols);
        view = appl + (empty ? (isAkt(cur) ? (appl ? '' : `<div class="akt0" data-key="akt0">${M.icon('mdi:check-circle-outline', 28, 'color:#696969')}<span>Ingenting som trenger deg nå</span></div>`) : M.emptyState('Ingen rom på denne fanen', 'tab-' + cur.id)) : `<div class="cols">${cols}</div>`);
      }
      const ring = cur.kind === 'hjem' ? '<div class="ring-slot" style="display:contents" data-ring-slot data-key="ring-slot" data-nomorph></div>' : ''; // 19.18: ringe-kortet (monteres av msh-hjem-card)
      return wrap(`<section class="sec">${this._tabsHTML(TV, cur)}${ring}${view}</section>`);
    }
    onAction(name, el, ev) {
      const d = el.dataset;
      if (name === 'tab') return this._pickTab(Number(d.i));
      if (name === 'hjemedit') { if (M.openDashEditor) M.openDashEditor({ editor: 'home' }); return; } // 31.4: tannhjulet (Tekst + tannhjul)
      if (name === 'tile') {
        // fiks 19.3: sveip i flis-stabelen (Kamera/Ruter) er ikke trykk – pekeren må ha flyttet seg < 8 px (tastatur: detail 0)
        if (ev && ev.detail !== 0 && this._pdXY && ev.clientX != null && Math.hypot(ev.clientX - this._pdXY[0], ev.clientY - this._pdXY[1]) >= 8) return;
        return this._runTile(d.k, d.w);
      }
      if (name === 'appl') { const A = this._appl(d.k, (this._E || {})[d.k]); if (A) this._applAct(A); return; }
      if (name === 'slide' && d.s === 'cal') {
        // swipe mellom sidene er ikke trykk: pekeren må ha flyttet seg < 8 px (tastatur: detail 0)
        if (ev && ev.detail !== 0 && this._pdXY && Math.hypot(ev.clientX - this._pdXY[0], ev.clientY - this._pdXY[1]) >= 8) return;
        return this._calRun('tap');
      }
      if (name === 'slide') { const x = this._slide(d.s, this._E || tileEnts(this.hass, this.config)); if (x.hash) return M.openPopup(x.hash); if (x.ent) return M.moreInfo(this, x.ent); return; }
      if (M.romkortAction && M.romkortAction(this, name, el, ev)) return;
      return super.onAction(name, el, ev);
    }
    onHold(ent, el) { if (el && el.dataset && el.dataset.s === 'cal') { this._calRun('hold'); return true; } return undefined; }
    _calRun(w) {
      const x = this._slide('cal', this._E || tileEnts(this.hass, this.config)), a = calNorm(get(this.config, `calendar.${w === 'hold' ? 'hold' : 'tap'}_action`));
      if (!a) { if (w !== 'hold' && x.ent) M.moreInfo(this, x.ent); return; }
      if (a.action === 'none') return;
      if (a.action === 'more-info') { const e = a.entity || x.ent; if (e) M.moreInfo(this, e); return; }
      if (M.tap) M.tap.run(this, a, { entity: x.ent, hass: this.hass });
    }
    afterRender() {
      const root = this.shadowRoot;
      root.querySelectorAll('[data-sw]').forEach((vp) => M.hjemSwiper(this, vp, (i) => { (this._swT = this._swT || {})[vp.dataset.sw] = Date.now(); this.setUI({ sw: { ...(this.ui.sw || {}), [vp.dataset.sw]: i } }, true); }));
      // 20.4: tidsstyrte regler (time/sun/for) sjekkes hvert 30. s; state og template gir ny tegning selv
      const rules = /"first":\[\{/.test(JSON.stringify(this.config.carousel || {}));
      if (rules && !this._crT) this._crT = setInterval(() => { if (this.isConnected && !this._busy) this._schedule(true); }, 30000);
      else if (!rules && this._crT) { clearInterval(this._crT); this._crT = null; }
      this._bindTileHold();
      this._bindTabs();
      this._placeTabs();
      this._tColObs();
      // nedtelling for apparater (kun når Aktuelt vises og noe kjører)
      if (this._ticking && !this._tick) this._tick = setInterval(() => this._tickAppl(), 1000);
      else if (!this._ticking && this._tick) { clearInterval(this._tick); this._tick = null; }
      // 17.11/17.16: lokal minutt-nedtelling (Ruter-avgang, kameraets holdetid) – bare ny tegning, ingen henting
      const need = !!this._minTick; this._minTick = false;
      if (need && !this._mT) this._mT = setInterval(() => { if (this.isConnected) this.update(); }, 60000);
      else if (!need && this._mT) { clearInterval(this._mT); this._mT = null; }
    }
    // Fiks 18.8: høyre fliskolonne måles (ikke regnes) for mini-spilleren i Fold-oppsettet (msh-navbar-card).
    // ResizeObserver på flis-griden (.cols, to kolonner, gap 8): bredde = (grid − 8) / 2, left = grid.left + bredde + 8
    // i viewport-koordinater. Siste målte verdi beholdes når griden ikke finnes (andre faner).
    _tColObs() {
      if (!window.ResizeObserver) return;
      const g = this.shadowRoot.querySelector('.cols');
      if (!this._tcRO) this._tcRO = new ResizeObserver(() => this._tColMeasure());
      if (this._tcEl !== g) { if (this._tcEl) this._tcRO.unobserve(this._tcEl); this._tcEl = g; if (g) this._tcRO.observe(g); }
      this._tColMeasure();
    }
    _tColMeasure() {
      const g = this._tcEl;
      if (!g || !g.isConnected) return;
      const r = g.getBoundingClientRect();
      if (!r.width) return;
      const w = (r.width - 8) / 2, v = { left: Math.round((r.left + w + 8) * 10) / 10, width: Math.round(w * 10) / 10 };
      const o = M.hjemTCol;
      if (o && o.left === v.left && o.width === v.width) return;
      M.hjemTCol = v;
      window.dispatchEvent(new CustomEvent('msh-tcol', { detail: v }));
    }
    _tickAppl() {
      if (!this.isConnected || !this._applT) return;
      const now = Date.now();
      this._applT.forEach((a) => {
        const el = this.shadowRoot.querySelector(`[data-key="ap-${a.kind}"]`);
        if (!el) return;
        const secs = Math.max(0, (a.end - now) / 1000), t = el.querySelector('.ap-t'), b = el.querySelector('.ap-bar span');
        if (t) t.textContent = `${Math.floor(secs / 3600)}:${pad2(Math.floor((secs % 3600) / 60))}:${pad2(Math.floor(secs % 60))}`;
        if (b) b.style.width = M.clamp((1 - secs / 60 / a.nominal) * 100, 2, 100).toFixed(1) + '%';
      });
    }
    // Linse (.ind) på aktiv fane. Scroll av aktiv fane inn i synlig område (row.scrollTo smooth) og kant-fade: MSH.tabReorder.
    _placeTabs() {
      const row = this.shadowRoot.querySelector('.tg');
      if (!row) return;
      const T = row.__tabReorder, busy = T && T.st && T.st.phase !== 'hold';
      const on = row.querySelector('.tab.on'), ind = row.querySelector('.ind');
      // Fiks 20.18: mål på nytt når raden/aktiv fane endrer størrelse (kortet lagt ut, fonter lastet) – ikke først ved
      // neste hass-oppdatering (det var de ~3 s med «grå» aktiv fane: .ind hadde bredde 0 / opacity 0 til neste render)
      if (window.ResizeObserver) {
        if (!this._tabRO) this._tabRO = new ResizeObserver(() => { if (this.isConnected) this._placeTabs(); });
        [row, on].forEach((el) => { if (el && !el.__tabRO) { el.__tabRO = true; this._tabRO.observe(el); } });
      }
      if (on && ind && !busy && on.offsetWidth > 0) {
        const L = on.offsetLeft, W = on.offsetWidth;
        if (!row.hasAttribute('data-ip')) row.setAttribute('data-ip', '');
        (this._tabPos = this._tabPos || {})[on.dataset.id] = [L, W];
        const first = ind.style.opacity === '0';
        if (first) ind.style.transition = 'none';
        ind.style.left = L + 'px'; ind.style.width = W + 'px'; ind.style.opacity = '';
        if (first) { void ind.offsetWidth; ind.style.transition = ''; }
      }
    }
    // Fanelinjen: felles MSH.tabReorder. Vanlig sveip scroller raden (touch: native; mus: dra-scroll). Får fanene
    // plass, er sideveis dra = liquid glass-linse (.ind følger fingeren). Flytt fane KUN etter langt trykk (400 ms)
    // eller i redigeringsmodus (this.editMode / window.__kiEditMode).
    _bindTabs() {
      if (tabStyle(this.config) !== 'pille') return this._bindStyleTabs();
      const row = this.shadowRoot.querySelector('.tg');
      if (!row) return;
      const items = () => [...row.querySelectorAll('.tab')];
      M.tabReorder(row, {
        card: this, glass: true, holdMs: 400,
        items, idOf: (b) => b.dataset.id,
        isEdit: () => !!(this.editMode || window.__kiEditMode),
        onReorder: (ids) => this._saveTabOrder(ids),
        onSelect: (id) => { const i = (this._TV || []).findIndex((t) => t.id === id); if (i >= 0) this._pickTab(i); },
        onGlassMove: (b, x) => {
          row.classList.add('drag');
          const ind = row.querySelector('.ind');
          if (ind) {
            const rr = row.getBoundingClientRect(), W = b.offsetWidth, cx = x - rr.left + row.scrollLeft;
            ind.style.width = W + 'px';
            ind.style.left = M.clamp(cx - W / 2, 0, Math.max(0, row.scrollWidth - W)) + 'px';
          }
          items().forEach((t) => t.classList.toggle('near', t === b));
        },
        onGlassEnd: (b) => { row.classList.remove('drag'); items().forEach((t) => t.classList.remove('near')); if (!b) this.update(); },
      });
    }
    // Fiks 31.4: de andre fanestilene – felles MSH.tabRow (hold 400 ms + dra = flytt → tab_order, Esc avbryter, kort trykk
    // bytter fane, glass-valg ved sideveis dra, haptic selection, touch-action pan-y + stopPropagation – fallgruve 2).
    _bindStyleTabs() {
      const R = this.shadowRoot, st = tabStyle(this.config), TV = this._TV || [];
      const all = () => allTabs(this.hass, this.config).map((t) => t.id);
      const save = (keys) => this._saveCfg({ tab_order: M.tabMerge(keys, all()) });
      const base = { active: () => (this._cur || {}).id, order: all, save: (full, keys) => save(keys) };
      if (st === 'popup' || st === 'gear') { if (M.tabBar) M.tabBar.bind(this, R.querySelector('.mtb'), base); return; }
      if (!M.tabRow) return;
      const row = (sel, items, o) => { const el = R.querySelector(sel); if (el) M.tabRow(this, el, { ...base, items: () => [...el.querySelectorAll(items)], ...(o || {}) }); };
      if (st === 'glide') return row('.hts-glide', '.hts-gt');
      if (st === 'chips') return row('.hts-chips', '.hts-ch');
      // to nivåer: «Etasjer» flyttes som én blokk (alle Kortliste-fanene), underraden omorganiserer etasjene innbyrdes
      const flo = TV.filter(isFloorTab).map((t) => t.id);
      row('.hts-top', '.hts-tt', { active: () => (flo.includes((this._cur || {}).id) ? '__etg' : (this._cur || {}).id), save: (full, keys) => save(keys.flatMap((k) => (k === '__etg' ? flo : [k]))) });
      row('.hts-sub', '.hts-st');
    }
    get styles() {
      return `${M.romkortCSS || ''}
        ${M.APPLIANCE_CSS || ''}
        .hf{display:block;width:100%}
        .hf:not(.fold){max-width:420px;margin:0 auto}
        .hf.fold{max-width:none;margin:0}
        .sec{display:flex;flex-direction:column;gap:12px}
        .tabs{position:relative;padding:4px;border-radius:24px;box-shadow:inset 0 0 0 1px rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.14*var(--ki-wa-k,1)),var(--ki-wa-max,1)));align-self:flex-start;max-width:100%;min-width:0;box-sizing:border-box;overflow:hidden;user-select:none;-webkit-user-select:none;cursor:pointer}
        .tabs.full{align-self:stretch}
        ${M.TAB_ROW_CSS || ''}
        ${M.HJEM_TABS_CSS}
        .tg{position:relative;border-radius:999px}
        .ind{position:absolute;top:0;bottom:0;border-radius:999px;pointer-events:none;background:${C.accent};transition:left .5s cubic-bezier(.34,1.4,.64,1),width .35s cubic-bezier(.34,1.2,.64,1),transform .45s cubic-bezier(.34,1.8,.64,1),background .35s,opacity .2s}
        .tab{position:relative;z-index:1;flex:0 0 auto;min-width:max-content;scroll-snap-align:start;display:grid;place-items:center;font-size:13px;font-weight:500;white-space:nowrap;text-transform:none;color:var(--ki-text-2, var(--gray800,#afafaf));transition:color .25s,transform .25s cubic-bezier(.34,1.6,.64,1),background .2s;border-radius:999px}
        .tabs.full .tab{flex:1 0 auto}
        .tab.on{color:var(--ki-on-accent, var(--gray100,#2f2f2f))}
        .tg:not([data-ip])>.tab.on{background:${C.accent}}
        .tg.drag .ind{background:linear-gradient(180deg, rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.3*var(--ki-wa-k,1)),var(--ki-wa-max,1))), rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.1*var(--ki-wa-k,1)),var(--ki-wa-max,1))));box-shadow:inset 0 1px 0 rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.6*var(--ki-wa-k,1)),var(--ki-wa-max,1))), inset 0 -1px 1px rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.15*var(--ki-wa-k,1)),var(--ki-wa-max,1))), inset 0 0 0 0.5px rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.35*var(--ki-wa-k,1)),var(--ki-wa-max,1))), 0 8px 20px rgb(0 0 0/max(var(--ki-ka-min,0),calc(0.35*var(--ki-ka-k,1))));backdrop-filter:blur(6px) saturate(200%);-webkit-backdrop-filter:blur(6px) saturate(200%);transform:scale(1.12,1.1);transition:transform .25s cubic-bezier(.34,1.8,.64,1),background .2s,width .2s}
        .tg.drag .tab{color:var(--ki-text-2, var(--gray800,#afafaf))}
        .tg.drag .tab.near{color:#fff}
        .tg.tr-drag .ind{opacity:0}
        .tg.tr-drag .tab{color:var(--ki-text-2, var(--gray800,#afafaf))}
        .tg.tr-drag>.tab.tr-lift{color:#fff !important;background:rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.14*var(--ki-wa-k,1)),var(--ki-wa-max,1)));box-shadow:0 8px 20px rgb(0 0 0/max(var(--ki-ka-min,0),calc(0.35*var(--ki-ka-k,1))))}
        .cols{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px;align-items:start}
        .col{display:flex;flex-direction:column;gap:8px;min-width:0}
        .carw,.swc{display:flex;flex-direction:column;gap:10px;align-items:center;width:100%;min-width:0}
        .car{box-sizing:content-box;width:100%;overflow:hidden;padding-top:10px;margin-top:-10px;touch-action:pan-y}
        .tsw{width:100%;overflow:hidden;border-radius:32px;touch-action:pan-y}
        ${M.UNIVERSAL_CSS || ''}
        .u-i[data-act]{cursor:pointer;transition:transform .2s,background .25s}
        .u-i[data-act]:active{transform:scale(.9)}
        /* tileV (Hjem v2 · Fiks 15.3 MySmartHome): pille 64 px høy, ikon-sirkel 56, 4 px til venstre – faste px, ikke
           tema-radius. Radius, bakgrunn og overflow på samme element. */
        .u.ht{height:64px;padding:0 14px 0 4px;border-radius:32px;overflow:hidden;column-gap:12px;row-gap:2px;align-content:center;box-shadow:inset 0 0 0 1px rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.04*var(--ki-wa-k,1)),var(--ki-wa-max,1)));grid-template-columns:56px minmax(0,1fr) !important;grid-template-rows:min-content min-content !important;transition:background .25s,transform .15s}
        .u.ht[data-act]:active{transform:scale(.97)}
        .u.ht .u-i{width:56px;height:56px;border-radius:28px;margin:0;border:0;align-self:center;background:var(--ki-surface-2, var(--gray200,#3a3a3a))}
        .u.ht .u-l{align-self:end !important;font-size:15px;font-weight:500;line-height:1.25}
        .u.ht .u-n{align-self:start;padding-top:0;font-size:12px;font-weight:400;line-height:1.3;opacity:1;color:var(--ht-sub,var(--ki-text-3, #7f7f7f));transition:none}
        .u.ht:not(:has(.u-n)){grid-template-rows:1fr !important}
        /* Fiks 16.7: to soner (ikon/kort) med hold – ingen tekstmarkering eller kontekstmeny, ring på ikonet under holdet */
        .u.ht.hz{touch-action:manipulation;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
        .tsw .u.ht.hz{touch-action:pan-y}
        .u.ht .u-i{position:relative}
        .u.ht.hpulse .u-i::after{content:'';position:absolute;inset:0;border-radius:50%;box-shadow:0 0 0 2px currentColor;opacity:0;pointer-events:none;animation:htpulse 1.6s ease-out infinite}
        @keyframes htpulse{0%{transform:scale(1);opacity:.7}100%{transform:scale(1.28);opacity:0}}
        @media (prefers-reduced-motion: reduce){.u.ht.hpulse .u-i::after{animation:none;opacity:0}}
        /* Fiks 21.2: overgang (låser/åpner/armerer) – ikonet pulserer svakt; undertekst uten color-transition */
        .u.ht.hblink .u-i>ha-icon,.u.ht.hblink .u-i>svg:not(.hr){animation:htblink 1.2s ease-in-out infinite alternate}
        @keyframes htblink{from{opacity:1}to{opacity:.5}}
        @media (prefers-reduced-motion: reduce){.u.ht.hblink .u-i>*{animation:none}}
        .u.ht .hr{position:absolute;inset:0;width:100%;height:100%;transform:rotate(-90deg);pointer-events:none;opacity:0;transition:opacity .15s}
        .u.ht .hr circle{fill:none;stroke:currentColor;stroke-width:2.5;stroke-linecap:round;stroke-dasharray:100;stroke-dashoffset:100}
        .u.ht .u-i.holding .hr{opacity:1}
        .u.ht .u-i.holding .hr circle{stroke-dashoffset:0;transition:stroke-dashoffset .5s linear}
        .u.ht:not(:has(.u-n)) .u-l{align-self:center !important}
        .track{display:flex;width:100%;transition:transform .45s cubic-bezier(.34,1.2,.64,1);will-change:transform}
        :host(.nt) .track{transition:none}
        .slot{flex:none;width:100%;min-width:0}
        /* Karusell-prikker (MySmartHome): aktiv 12 px #696969, andre 9 px #404040, gap 10 */
        /* prikkrader: felles .msh-dots i BASE_CSS (18.3: 10/12 px, gap 8 px) */
        .tile{display:flex;align-items:center;gap:12px;height:64px;padding:0 14px 0 4px;border-radius:32px;width:100%;box-sizing:border-box;background:var(--ki-surface, var(--gray100,#2f2f2f));box-shadow:inset 0 0 0 1px rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.04*var(--ki-wa-k,1)),var(--ki-wa-max,1)));color:var(--ki-text, var(--white,#fafafa));cursor:pointer;transition:background .25s;user-select:none;-webkit-user-select:none}
        .tic{width:56px;height:56px;border-radius:28px;flex:none;display:grid;place-items:center;background:var(--ki-surface-2, var(--gray200,#3a3a3a));color:var(--ki-text, var(--white,#fafafa));cursor:pointer;transition:transform .2s}
        .tic:active{transform:scale(.9)}
        .tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;text-align:left}
        .tt{font-size:15px;font-weight:500}
        .ts{font-size:12px;color:var(--ki-text-3, #7f7f7f);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .sl{flex:none;width:100%;height:220px;padding:18px;display:flex;flex-direction:column}
        .sl-top{font-size:15px;color:var(--ki-text-2, var(--gray800,#afafaf))}
        .sl-ti{font-size:30px;font-weight:300;letter-spacing:-0.01em;line-height:1.15;text-transform:uppercase}
        .sl-bar{width:16px;height:1.5px;background:var(--ki-text-2, var(--gray800,#afafaf));margin-bottom:12px;flex:none}
        .sl-l1{font-size:14px;font-weight:500;white-space:nowrap}
        .sl-l2{font-size:13px;color:var(--ki-text-2, var(--gray800,#afafaf));padding-top:4px}
        .apg{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px}
        .ap{position:relative;height:150px;border-radius:26px;background:var(--ki-surface, var(--gray100,#2f2f2f));overflow:hidden;display:flex;flex-direction:column;box-shadow:inset 0 0 0 1px rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.04*var(--ki-wa-k,1)),var(--ki-wa-max,1)))}
        .ap-h{display:flex;align-items:flex-start;gap:8px;padding:14px 12px 0 16px}
        .ap-n{flex:1;min-width:0;font-size:13px;color:var(--ki-text-1, var(--gray900,#c7c7c7));padding-top:4px}
        .ap-b{width:40px;height:40px;border-radius:20px;flex:none;display:grid;place-items:center;background:var(--ki-surface-2, var(--gray200,#3a3a3a));transition:transform .2s}
        .ap-b:active{transform:scale(.9)}
        .ap-t{font-size:34px;font-weight:300;letter-spacing:-0.02em;line-height:1;padding:0 16px}
        .ap-s{font-size:11px;color:var(--ki-text-mid, var(--gray700,#979797));padding:2px 16px 10px}
        .ap-bar{position:relative;height:26px;background:repeating-linear-gradient(135deg, #5c5c5c 0 2px, transparent 2px 7px);flex:none}
        .ap-bar span{position:absolute;left:0;top:0;bottom:0;transition:width 1s linear}
        .bv{display:flex;flex-direction:column}
        .bh{display:flex;justify-content:space-between;align-items:baseline;gap:10px;padding:0 4px 8px}
        .bh-t{font-size:15px;font-weight:500;white-space:nowrap;flex:none}
        .bh-m{font-size:12px;color:var(--ki-text-lo, var(--gray500,#696969));white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
        .bl{display:flex;flex-direction:column;padding:4px 16px;border-radius:24px;background:var(--ki-surface, var(--gray100,#2f2f2f))}
        .br{display:flex;align-items:center;gap:12px;min-height:58px;border-top:1px solid rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.05*var(--ki-wa-k,1)),var(--ki-wa-max,1)));cursor:pointer}
        .bn{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
        .bnn{font-size:14px;font-weight:500}
        .bnr{font-size:11px;color:var(--ki-text-3, var(--gray600,#7f7f7f))}
        .bb{width:56px;height:8px;border-radius:4px;background:var(--ki-surface-2, var(--gray200,#3a3a3a));overflow:hidden;flex:none}
        .bb span{display:block;height:100%;border-radius:4px}
        .bp{font-size:14px;font-weight:600;min-width:44px;text-align:right}
        .akt0{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:48px 16px;color:var(--ki-text-mid, #979797);font-size:14px;line-height:1.4;text-align:center}
        .none{padding:22px 16px;border-radius:24px;background:var(--ki-surface, var(--gray100,#2f2f2f));color:var(--ki-text-mid, var(--gray700,#979797));font-size:13px;text-align:center}
      `;
    }
  }
  /* Fiks 31.4 · forhåndsvisning i «Tilpass Hjem» → Faner → Fanestil: valgt stil med brukerens egne faner (ekte data, config
   * = utkastet). attrs(t, i) gir hver fane arkets egne data-a-attributter (trykk bytter fane på Hjem). */
  M.hjemTabsPreview = function (hass, c, curId, attrs) {
    if (!hass || !c) return '';
    const p = M.__hjemPV || (M.__hjemPV = document.createElement('msh-hjem-faner-card'));
    p._rawConfig = c; p._config = { ...HjemFaner.defaults, ...c }; p._hass = hass;
    const B = (p._B = p._batteries()), TV = (p._TV = p._tabsV(B)), cur = (p._cur = TV.find((t) => t.id === curId) || p._curTab(TV));
    return p._tabsHTML(TV, cur, { attrs });
  };
  M.define('msh-hjem-faner-card', HjemFaner, 'MSH Hjem · faner og romkort', 'Fanerad (Hjem, etasjer, Aktuelt, Batterier) med sveipbare romkort, kortliste, snarveier, apparater og rom-varsler.');
})();
