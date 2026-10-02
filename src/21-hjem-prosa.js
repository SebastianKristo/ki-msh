/* msh-prosa-card · Hjem-visningen, prosa-kortet. Kilde: Hjem v2.dc.html (prose, DEF_PROSE, SRC/ACTS/TOK/OPS,
 * runAct, custEditVals → «Tekst»-fanen). Live verdier i chips, handling per chip, betingelser («Når»).
 * Autokonfig: weather.* (første), sensor.hele_huset_effekt / _lys (KI Rom), strømpris (plattform nordpool/tibber),
 * person.*, lock.*, alarm_control_panel.*, calendar.*, todo.*, søppel-sensor. Standardprosaen bygges bare av
 * det som faktisk finnes.
 * Config: prose[] = { id, pre, src, fmt ({v} = verdien), post, icon, color, tap, act, cop/csrc/cval (betingelse),
 *   ent (entitet for src 'custom', påkrevd), ent_override (overstyr entiteten til en fast kilde, tom = automatisk),
 *   cent (entitet for betingelsen, tom = samme som boblen), hidden, svc/target/data },
 *   tap = «Ved trykk» i HA-format (Fiks 15.6, src/09-tap-picker.js): { action: navigate, navigation_path: '#tesla' }
 *     (popup / egen hash / dashbord-sti) · { action: url, url_path } · { action: more-info } · { action: lock-sheet }
 *     (hurtigark for dørlåsen) · { action: none }. Standard som før: vær → #vaer, lys → #lys, hendelser → more-info.
 *     Bakoverkompatibelt: uten tap leses de gamle nøklene link ('#x' / 'lock') og act: 'more'.
 *   act = «Utfør også» (tjeneste: lås, alarm, lys, egendefinert …) – kjøres i tillegg til tap.
 *   prose_font_size (valgfri overstyring i em av kortets 14 px, 1,4–2,8; tom = automatisk clamp(22px, 7,4cqi, 34px)
 *   med kortet som container – MySmartHome), prose_line_height (ganger tekststørrelsen, 1,3–2,0, standard 1,55),
 *   overrides.<kilde> (alle setninger), price_high/price_mid, alarm_hash, toasts.
 * Seksjoner (Fiks 17.9, som ki-prosa-card): vaer, hjemkomst[], ringeklokke, apparater[], planter, pris, bursdag – brukerens
 *   standard-config (SEC_STD) i getStubConfig og fylt inn for manglende nøkler (exclude: [pris] / pris: false = av).
 *   Hver seksjon vises bare når entiteten finnes. Rekkefølge: rekkefolge[] (standard vær → hjemkomst → ringeklokke →
 *   apparater → planter → pris → setninger (prose[]) → bursdag). Aktive vær/pris-seksjoner erstatter standardprosaens vær/pris.
 * Fiks 18.1: aktive vær/pris-seksjoner erstatter også lagrede vær/pris-setninger i prose[] (cleanProse, migreres og lagres én gang),
 *   eldre weather/price/strom-nøkler → vaer/pris, hver fast kilde maks én gang, og «og vi bruker …» fortsetter pris-setningen.
 *   planter: KI Planter-steder via entitetsregisteret (platform ki_planter) eller attributtet integrasjon: ki_planter;
 *   sensor.<sted>_planter_trenger_vann (antall, trenger_vann[], trenger_vann_tekst). Trykk → path (#planter),
 *   hold → «Merk alle som vannet?» → button.<sted>_planter_alle_vannet. Maler: {pille}/{planter}, {navn}, {antall}, {sted}.
 *   Ikon: prefiks → <ha-icon>, emoji → tekst, ki:vaskemaskin/oppvask/torketrommel → animert hvitevare, attributt:sti.
 * Utseende (Fiks 15.3 · MySmartHome, overstyrer Fiks 13): hvit tekst #fafafa, piller 1,6em høye av 0,8em pilletekst,
 * #fafafa/#2f2f2f/600, pris-prikk med glød. Teksten flyter naturlig (ingen &nbsp;/text-wrap), kun tegnsetting rett
 * etter en pille limes til pillen. Tall: «15.2°» (vær, som HA-tilstanden), «2395W», «1,16 kr»; lys-pillen ✨.
 */
(function () {
  const M = window.MSH, esc = M.esc, C = M.C;
  const PINK = C.accent;
  const TOK = { 'vær': 'weather', temp: 'temp', pris: 'price', watt: 'watt', lys: 'lights', hendelser: 'events', hjemme: 'home', 'lås': 'lock', alarm: 'alarm', 'søppel': 'trash', 'gjøremål': 'todo' };
  const SRC = [['none', 'Ingen boble'], ['text', 'Fast tekst'], ['weather', 'Vær'], ['temp', 'Ute-temp'], ['price', 'Strømpris'], ['watt', 'Effekt'], ['lights', 'Lys på'], ['events', 'Hendelser'], ['home', 'Hjemme'], ['lock', 'Dørlås'], ['alarm', 'Alarm'], ['trash', 'Søppel'], ['todo', 'Gjøremål'], ['custom', 'Egendefinert']];
  const ACTS = [['', 'Ingen'], ['more', 'Vis detaljer'], ['lock_toggle', 'Veksle dørlås'], ['lock', 'Lås dør'], ['unlock', 'Lås opp'], ['alarm_toggle', 'Veksle alarm'], ['alarm_on', 'Armer alarm'], ['alarm_off', 'Slå av alarm'], ['lights_on', 'Alle lys på'], ['lights_off', 'Alle lys av'], ['garage_toggle', 'Veksle garasjeport'], ['tv_toggle', 'Veksle TV'], ['vac_toggle', 'Pause/start støvsuger'], ['service', 'Egendefinert tjeneste']];
  const OPS = [['alltid', 'Alltid'], ['>', 'Over'], ['<', 'Under'], ['=', 'Er'], ['!=', 'Er ikke']];
  const ICONS = [['', 'Ingen'], ['dot', '● Prikk'], ['✨', '✨'], ['💡', '💡'], ['⏰', '⏰'], ['🌤️', '🌤️'], ['⚡', '⚡'], ['🔒', '🔒'], ['🚨', '🚨'], ['🗑️', '🗑️'], ['🏠', '🏠'], ['👋', '👋']];
  const SIZE_FIELDS = [
    { type: 'range', name: 'prose_font_size', label: 'Tekststørrelse', icon: 'mdi:format-size', min: 1.4, max: 2.8, step: 0.05, unit: 'em', help: 'Auto = tilpasses kortets bredde (22–34 px, som MySmartHome) · ellers em av kortets 14 px', presets: [['', 'Auto'], [1.8, 'Liten 1,8'], [2.15, 'Middels 2,15'], [2.5, 'Stor 2,5']] },
    { type: 'range', name: 'prose_line_height', label: 'Linjehøyde', icon: 'mdi:format-line-spacing', min: 1.3, max: 2, step: 0.05, default: 1.55, unit: 'em', help: 'Ganger tekststørrelsen · standard 1,55 (≈ 46,6 px per linje)', presets: [[1.4, 'Tett 1,4'], [1.55, 'Standard 1,55'], [1.75, 'Luftig 1,75']] },
  ];
  function textSizeOf(c) {
    const n = (v, d, lo, hi) => { const x = Number(v); return v == null || v === '' || isNaN(x) ? d : M.clamp(x, lo, hi); };
    const [F, L] = SIZE_FIELDS;
    // fs = null → automatisk størrelse etter kortets bredde (PROSA_AUTO_FS)
    return { fs: n(c && c.prose_font_size, null, F.min, F.max), lh: n(c && c.prose_line_height, L.default, L.min, L.max) };
  }
  const PCOL = { hvit: '#fafafa', gronn: C.green, gul: C.yellow, oransje: C.orange, rod: C.red, bla: C.blue, rosa: C.pink };
  const PSW = [['hvit', 'var(--gray1000, #e1e1e1)', 'Hvit'], ['auto', `conic-gradient(${C.green}, ${C.yellow}, ${C.red}, ${C.green})`, 'Auto etter verdi'], ['gronn', C.green, 'Grønn'], ['gul', C.yellow, 'Gul'], ['oransje', C.orange, 'Oransje'], ['rod', C.red, 'Rød'], ['bla', C.blue, 'Blå'], ['rosa', C.pink, 'Rosa']];
  // «Ved trykk» for en setning: tap (HA-format) → ellers gamle link/act 'more' (bakoverkompatibelt)
  function tapOf(p) {
    if (!p) return null;
    const t = M.tap ? M.tap.norm(p.tap_action || p.tap) : null; // 30.3: tap_action (HA-standard) leses også
    if (t) return t;
    const l = String(p.link || '').trim();
    if (l === 'lock') return { action: 'lock-sheet' };
    if (l) return { action: 'navigate', navigation_path: /^(#|\/|https?:)/.test(l) ? l : '#' + l };
    if (p.act === 'more') return { action: 'more-info' };
    if (p.src === 'watt' && !p.act) return { action: 'navigate', navigation_path: '#energi' }; // 21.1: effekt-boblen åpner Energi
    return null;
  }
  M.prosaTapOf = tapOf;
  const TAP_MODES = ['popup', 'hash', 'path', 'url', 'more', 'lock', 'none'];
  M.PROSA_TAP_MODES = TAP_MODES;
  const nav = (h) => ({ tap: { action: 'navigate', navigation_path: h } });
  const srcL = (id) => (SRC.find((x) => x[0] === id) || ['', id || ''])[1];
  // Faste kilder som kan pekes til en annen entitet (prose[].ent_override)
  const FIXED = ['weather', 'temp', 'price', 'watt', 'lights', 'events', 'home', 'lock', 'alarm', 'trash', 'todo'];
  const nb = (n, d) => M.nf(n, d);
  // Tallformat som MySmartHome (Fiks 15.3): vær/ute-temp med én desimal og punktum som HA-tilstanden («15.2°»),
  // effekt uten mellomrom/tusenskille («2395W»), pris med komma («1,16 kr», MSH.powerPrice.fmt).
  const deg = (v) => `${Number(v).toFixed(1)}°`;
  // Værtilstanden oversatt av HA selv (hass.formatEntityState → «Overskyet»); uoversatt (rå tilstand) → egen tabell.
  const condOf = (h, w) => {
    let t = '';
    if (h && h.formatEntityState) { try { t = String(h.formatEntityState(w) || ''); } catch (e) { t = ''; } }
    if (!t || t === w.state) t = M.hjemCond(w.state);
    return t.toLowerCase();
  };
  const pnum = (v) => parseFloat(String(v == null ? '' : v).replace(',', '.'));

  // Kalenderhendelser i dag (hentes sjelden, deles mellom kort).
  const EV = { t: 0, n: null, busy: false, key: '' };
  function loadEvents(hass, ids, done) {
    const key = ids.join(',');
    if (!hass || !hass.callApi || !ids.length || EV.busy || (EV.key === key && Date.now() - EV.t < 15 * 60000)) return;
    EV.busy = true;
    const s = new Date(); s.setHours(0, 0, 0, 0);
    const e = new Date(s.getTime() + 86400000);
    Promise.all(ids.map((id) => hass.callApi('GET', `calendars/${id}?start=${encodeURIComponent(s.toISOString())}&end=${encodeURIComponent(e.toISOString())}`).catch(() => [])))
      .then((r) => { EV.n = r.reduce((t, l) => t + (Array.isArray(l) ? l.length : 0), 0); })
      .finally(() => { EV.busy = false; EV.t = Date.now(); EV.key = key; done && done(); });
  }

  // Autokonfig per kilde. Returnerer entitets-ID (eller liste) for hver kilde.
  const AUTO = {
    weather: (h) => M.all(h, 'weather')[0] || null,
    temp: () => null, // standard: temperaturen fra vær-entiteten
    // Felles strømpris-kilde (MSH.powerPrice, 15-strompris-kilde.js): samme sensor som strømpriskortet og sliden.
    price: (h) => (M.powerPrice ? M.powerPrice(h).entity : null),
    watt: (h) => M.kiRomId(h, null, 'effekt') || null,
    lights: (h) => M.kiRomId(h, null, 'lys') || null,
    lock: (h) => M.all(h, 'lock')[0] || null,
    alarm: (h) => M.all(h, 'alarm_control_panel')[0] || null,
    trash: (h) => (M.hjemTrashAuto ? M.hjemTrashAuto(h) : null),
  };
  const ents = (h, c) => {
    const o = {};
    Object.keys(AUTO).forEach((k) => { o[k] = M.pick(c, k, AUTO[k](h)); });
    o.calendars = M.applyLists(c, 'kalendere', M.all(h, 'calendar'));
    o.todos = M.applyLists(c, 'lister', M.all(h, 'todo'));
    o.persons = M.all(h, 'person');
    return o;
  };
  M.hjemProseEnts = ents;

  // Kildeverdier: key → [tekst, tall, farge, entity_id]
  function sources(h, c, rd) {
    rd = rd || ((id) => h.states[id]);
    const E = ents(h, c), S = {};
    const lvlP = (p) => (p > (Number(c.price_high) || 1.5) ? C.red : p > (Number(c.price_mid) || 1.1) ? C.yellow : C.green);
    const w = E.weather && rd(E.weather);
    if (w && !M.unavailable(w)) {
      const t = w.attributes.temperature;
      S.weather = [`${condOf(h, w)}${t != null && M.isNum(t) ? ' og ' + deg(t) : ''}`, t != null ? Number(t) : null, null, E.weather];
    }
    const ts = E.temp && rd(E.temp);
    if (ts && M.isNum(ts.state)) S.temp = [deg(ts.state), Number(ts.state), null, E.temp];
    else if (w && M.isNum(w.attributes.temperature)) S.temp = [deg(w.attributes.temperature), Number(w.attributes.temperature), null, E.weather];
    const p = E.price && rd(E.price);
    if (p && M.isNum(p.state)) {
      // Pris som vises / enhet / SEK→kr fra power_price; egen entitet i boblen (overrides.price / ent_override) overstyrer bare sensoren
      const own = M.powerPrice && E.price !== AUTO.price(h) ? M.powerPriceCfg(null, { spot_entity: E.price, se_entity: E.price }) : null;
      const P = M.powerPrice ? M.powerPrice(h, own) : null, v = P ? P.now : Number(p.state);
      if (P && P.grid) rd(P.grid.entity);
      if (v != null) S.price = [P ? P.fmt(v) : `${nb(v, 2)} kr`, v, lvlP(v), E.price];
    }
    const wt = E.watt && rd(E.watt);
    if (wt && M.isNum(wt.state)) { const v = Number(wt.state); S.watt = [`${Math.round(v)}W`, v, v > 3000 ? C.red : v > 1500 ? C.yellow : C.green, E.watt]; }
    const ls = E.lights && rd(E.lights);
    if (ls && M.isNum(ls.state)) { const v = Number(ls.state); S.lights = [`${v} lys`, v, C.orange, E.lights]; }
    else {
      const all = M.all(h, 'light');
      if (all.length) { const v = all.filter((id) => { const s = rd(id); return s && s.state === 'on'; }).length; S.lights = [`${v} lys`, v, C.orange, null]; }
    }
    if (E.calendars.length) { const n = EV.n; S.events = [n == null ? '– hendelser' : n === 0 ? 'ingen hendelser' : `${n} ${n === 1 ? 'hendelse' : 'hendelser'}`, n, C.blue, E.calendars[0]]; }
    if (E.persons.length) { const n = E.persons.filter((id) => { const s = rd(id); return s && s.state === 'home'; }).length; S.home = [`${n} hjemme`, n, C.green, E.persons[0]]; }
    const lk = E.lock && rd(E.lock);
    if (lk) { const L = lk.state === 'locked'; S.lock = [L ? 'låst' : lk.state === 'jammed' ? 'fastlåst' : M.unavailable(lk) ? '–' : 'ulåst', L ? 1 : 0, L ? C.green : C.orange, E.lock]; }
    const al = E.alarm && rd(E.alarm);
    // Fiks 25: samme tekst/status-entitet/state_map som Sikkerhet og Hjem-flisen (MSH.alarmState), lest via rd
    const AS = al && M.alarmState ? M.alarmState({ ...h, states: new Proxy(h.states || {}, { get: (t, k) => (typeof k === 'string' ? rd(k) : t[k]) }) }, M.sikCfg && M.sikCfg(), E.alarm) : null;
    if (AS) S.alarm = [AS.text, AS.armed ? 1 : 0, AS.triggered ? C.red : AS.armed ? C.pink : null, AS.entity || E.alarm];
    else if (al) {
      const st = al.state, armed = /^armed/.test(st);
      const T = { disarmed: 'av', triggered: 'utløst', arming: 'armerer', pending: 'venter', disarming: 'slås av' };
      S.alarm = [armed ? 'armert' : T[st] || (M.unavailable(al) ? '–' : st), armed ? 1 : 0, armed ? C.pink : st === 'triggered' ? C.red : null, E.alarm];
    }
    const tr = E.trash && rd(E.trash);
    if (tr) { const d = M.hjemTrashParse ? M.hjemTrashParse(tr).days : M.hjemTrashDays(tr); // «0,Restavfall,…» (Fiks 17.14)
      S.trash = [d == null ? '–' : d === 0 ? 'i dag' : d === 1 ? 'i morgen' : `${d} dager`, d, d != null && d <= 1 ? C.orange : null, E.trash]; }
    if (E.todos.length) { const n = E.todos.reduce((t, id) => { const s = rd(id); return t + (s && M.isNum(s.state) ? Number(s.state) : 0); }, 0); S.todo = [`${n} gjøremål`, n, null, E.todos[0]]; }
    return S;
  }

  // {nøkkel}: kilde, TOK-alias, <område>.temp/.fukt/.lys, <person>.hjemme/.sover, eller entity_id.
  function getter(h, c, S, rd) {
    rd = rd || ((id) => h.states[id]);
    return (k) => {
      k = String(k || '').trim();
      if (S[k]) return S[k];
      if (TOK[k] && S[TOK[k]]) return S[TOK[k]];
      if (/^[a-z_]+\.[a-z0-9_]+$/.test(k) && h.states[k]) { const s = rd(k); return [M.fmtState(h, k), M.isNum(s.state) ? Number(s.state) : M.isOn(s) ? 1 : 0, null, k]; }
      const m = /^([a-z0-9_]+)\.(temp|fukt|lys|mål|hjemme|sover)$/.exec(k);
      if (!m) return null;
      const [, a, f] = m;
      if (h.states['person.' + a] && (f === 'hjemme' || f === 'sover')) {
        // Fiks 20.5: samme status som headeren (header-configen: personoppsett + «Status og soner»)
        const hc = M.hjemHeaderCfg ? M.hjemHeaderCfg() : null, pc = hc && Object.keys(hc).length ? hc : c;
        const P = M.hjemPersonInfo ? M.hjemPersonInfo(h, 'person.' + a, pc, rd) : null;
        if (!P) return null;
        const hs = M.hjemStatusStyle ? M.hjemStatusStyle(pc, 'home') : { color: C.green }, ss = M.hjemStatusStyle ? M.hjemStatusStyle(pc, 'sleep') : { color: null };
        return f === 'hjemme' ? [P.home ? 'hjemme' : 'borte', P.home ? 1 : 0, P.home ? hs.color : null, P.id] : [P.sleep ? 'sover' : 'våken', P.sleep ? 1 : 0, P.sleep && ss.own ? ss.color : null, P.sleepId];
      }
      if (h.areas && h.areas[a]) {
        const R = M.roomAuto ? M.roomAuto(h, a) : { temp: M.byClass(h, 'sensor', 'temperature', a)[0], hum: M.byClass(h, 'sensor', 'humidity', a)[0], thermo: null, lights: M.all(h, 'light', (s, id) => M.areaOf(h, id) === a) };
        if (f === 'temp' && R.temp) { const v = M.num(h, R.temp); rd(R.temp); return v == null ? null : [`${nb(v, 1)}°`, v, null, R.temp]; }
        if (f === 'fukt' && R.hum) { const v = M.num(h, R.hum); rd(R.hum); return v == null ? null : [`${nb(v, 0)} %`, v, null, R.hum]; }
        if (f === 'lys') { const n = (R.lights || []).filter((id) => { const s = rd(id); return s && s.state === 'on'; }).length; return [n ? 'på' : 'av', n ? 1 : 0, n ? C.orange : null, (R.lights || [])[0]]; }
        if (f === 'mål' && R.thermo) { const s = rd(R.thermo); const v = s && s.attributes.temperature; return v == null ? null : [`${nb(Number(v), 1)}°`, Number(v), null, R.thermo]; }
      }
      return null;
    };
  }

  // Standardprosa: kun setninger for kilder som faktisk finnes.
  function defaultProse(h, c, skip) {
    const S = { ...sources(h, c) };
    // Fiks 17.9: vær/pris vises av seksjonene når de er aktive – ikke dobbelt
    // Fiks 18.1: aktiv pris-seksjon = prisen finnes; effekt/lys fortsetter pris-setningen («… kr og vi bruker …»)
    const secP = !!(skip && skip.pris);
    if (skip && skip.vaer) delete S.weather;
    if (secP) delete S.price;
    const out = [];
    const row = (id, pre, src, post, extra) => out.push({ id, pre, src, fmt: '{v}', post, icon: '', color: 'hvit', cop: 'alltid', ...(extra || {}) });
    if (S.weather) row('p1', 'Ute er det', 'weather', '.', nav('#vaer'));
    const P = secP || !!S.price, W = !!S.watt, L = !!S.lights;
    const pr = (post) => { if (!secP) row('p2', 'Strømmen koster', 'price', post, { icon: 'dot' }); };
    if (P && W && L) { pr(''); row('p3', 'og vi bruker', 'watt', ''); row('p4', 'med', 'lights', 'på.', { icon: '✨', ...nav('#lys') }); }
    else if (P && W) { pr(''); row('p3', 'og vi bruker', 'watt', '.'); }
    else if (P && L) { if (secP) row('p4', 'og vi har', 'lights', 'på.', { icon: '✨', ...nav('#lys') }); else { pr('.'); row('p4', 'Vi har', 'lights', 'på.', { icon: '✨', ...nav('#lys') }); } }
    else if (W && L) { row('p3', 'Vi bruker', 'watt', ''); row('p4', 'med', 'lights', 'på.', { icon: '✨', ...nav('#lys') }); }
    else if (P) pr('.');
    else if (W) row('p3', 'Vi bruker', 'watt', '.');
    else if (L) row('p4', 'Det er', 'lights', 'på.', { icon: '✨', ...nav('#lys') });
    if (S.events) row('p5', 'Vi har', 'events', 'i dag.', { icon: '⏰', tap: { action: 'more-info' } });
    return out;
  }
  // Fiks 18.1 · én vær/pris: lagrede setninger (prose[] fra før 17.9, eller lagret av editoren) med kilde vær/strømpris
  // fjernes når vær-/pris-seksjonen er aktiv (config vinner over autokonfig). Idempotent, så ingen dobbel etter omlasting;
  // editorene viser og lagrer den rensede listen (migreringen følger med ved første lagring, se også Prosa._migrate).
  const SEC_SRC = { weather: 'vaer', price: 'pris' };
  function cleanProse(rows, active) {
    return (rows || []).filter((p) => !(p && SEC_SRC[p.src] && active && active[SEC_SRC[p.src]]));
  }
  // Eldre toppnivå-nøkler → vaer/pris (entitet), slettes fra config
  const LEGACY = { weather: 'vaer', 'vær': 'vaer', price: 'pris', strom: 'pris', 'strøm': 'pris', strompris: 'pris' };
  function legacyOf(c) {
    if (!c) return null;
    let o = null;
    Object.keys(LEGACY).forEach((k) => {
      if (c[k] == null || typeof c[k] === 'boolean') return;
      o = o || { ...c };
      const t = LEGACY[k], v = c[k];
      // weather.* → tilstand + temperatur (som den gamle autokonfigen), ikke attributtet «weather» fra standarden
      if (o[t] == null) o[t] = typeof v === 'string' ? (t === 'vaer' && v.indexOf('weather.') === 0 ? { entity: v, attributt: '', enhet: '' } : { entity: v }) : v;
      delete o[k];
    });
    return o;
  }
  let LH = null; // siste hass (editorens rad-normalisering har ikke hass)


  /* ------------------------------------------------------------ Fiks 17.9 · seksjoner (standard-config + KI Planter) */
  // Brukerens egen standard (eksplisitt ønsket, unntak fra fallgruve 4). Hver seksjon brukes bare når entiteten finnes.
  // Manglende seksjoner fylles inn fra STD (migrering); seksjoner i exclude (eller satt til false) legges ikke inn igjen.
  const SEC_STD = {
    vaer: { entity: 'sensor.dashboard_index', attributt: 'weather', enhet: '°', mellomrom: false, ikon: 'attributt:current.icon', ikon_plassering: 'slutt', 'små_bokstaver': true, tekst: 'Ute er det {pille}.', path: '#vaer' },
    apparater: [{ navn: 'Vaskemaskinen', vis: { entity: 'input_select.vaskemaskin_status', state: 'Vasker' }, verdi: 'sensor.vaskemaskin_power', ikon: 'ki:vaskemaskin', animasjon: 'auto' }],
    pris: { entity: 'sensor.norgespris_total_strompris_norgespris' },
    hjemkomst: [{ navn: 'Mamma', aktiv: 'input_boolean.ki_cybele_pa_vei_hjem_fra_jobb', reisetid: 'sensor.cybele_reisetid_fra_job', ikon: '🚗', animasjon: 'hopp', tekst: '{navn} kommer hjem ca. kl {pille}.', path: '#personer' }],
    bursdag: { vis: 'binary_sensor.vis_bursdagskort' },
    ringeklokke: { entity: 'input_boolean.ki_ringeklokke_varsel_aktiv' },
    planter: { auto: true, sted: [], ikon: 'mdi:sprout', animasjon: 'vugg', tekst: '{planter} trenger vann.', path: '#planter' },
  };
  // Tekstmaler og ikoner som ikke står i brukerens config (samme som ki-prosa-card)
  const SEC_TXT = {
    vaer: 'Ute er det {pille}.', pris: 'Strømmen koster {pille}.', apparater: '{navn} vasker {pille} nå.', hjemkomst: '{navn} kommer hjem ca. kl {pille}.',
    ringeklokke: '{pille} Noen ringer på døren!', bursdag: 'I dag har {pille} bursdag! 🎉', planter: '{planter} trenger vann.',
  };
  const SEC_IKON = { ringeklokke: '🔔', bursdag: '🎂', planter: 'mdi:sprout', hjemkomst: '🚗' };
  const SEC_KEYS = ['vaer', 'hjemkomst', 'ringeklokke', 'apparater', 'planter', 'pris', 'setninger', 'bursdag'];
  const SEC_L = { vaer: 'Vær', hjemkomst: 'Hjemkomst', ringeklokke: 'Ringeklokke', apparater: 'Apparater', planter: 'Planter', pris: 'Strømpris', setninger: 'Setninger', bursdag: 'Bursdag' };
  const ANIMS = [['', 'Ingen'], ['auto', 'Auto'], ['hopp', 'Hopp'], ['vugg', 'Vugg'], ['vink', 'Vink'], ['snurr', 'Snurr'], ['puls', 'Puls']];
  const KI_FIG = { vaskemaskin: 'washer', oppvask: 'dishwasher', oppvaskmaskin: 'dishwasher', torketrommel: 'dryer', 'tørketrommel': 'dryer' };
  const BDAY_BG = 'linear-gradient(135deg, #f294c8, #f5cfd0)';
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const exOf = (c) => new Set((c && c.exclude) || []);
  // Effektiv seksjon (null = av)
  function secOf(c, k) {
    if (exOf(c).has(k)) return null;
    const v = c ? c[k] : undefined;
    if (v === false) return null;
    const d = SEC_STD[k];
    if (v == null) return clone(d);
    if (Array.isArray(d)) return Array.isArray(v) ? v : clone(d);
    if (typeof v === 'string') return { ...clone(d), entity: v };
    return { ...clone(d), ...v };
  }
  function secOrder(c) {
    const o = Array.isArray(c && c.rekkefolge) ? c.rekkefolge.filter((k) => SEC_KEYS.includes(k)) : [];
    SEC_KEYS.forEach((k) => { if (!o.includes(k)) o.push(k); });
    return o;
  }
  // «Aktiv»-betingelse: entitet (på), { entity, state } eller { entity, over | under }
  function aktiv(a, rd) {
    if (a === true) return true;
    if (!a) return false;
    const id = typeof a === 'string' ? a : a.entity, s = id && rd(id);
    if (!s || M.unavailable(s)) return false;
    if (typeof a === 'string') return M.isOn(s) || s.state === 'on';
    if (a.over != null) return pnum(s.state) > Number(a.over);
    if (a.under != null) return pnum(s.state) < Number(a.under);
    if (a.state != null) return String(s.state) === String(a.state);
    return M.isOn(s) || s.state === 'on';
  }
  const attrPath = (st, path) => { let v = st && st.attributes; String(path || '').split('.').filter(Boolean).forEach((p) => { v = v != null ? v[p] : undefined; }); return v; };
  // Ikon: 'attributt:sti' leses fra entiteten; ki:<figur> → animert hvitevare-ikon (06-appliance-icons)
  function iconOf(ikon, st) {
    if (!ikon) return { ic: '' };
    let k = String(ikon);
    if (k.indexOf('attributt:') === 0) { const v = attrPath(st, k.slice(10)); k = v ? String(v) : ''; }
    const m = /^ki:(.+)$/.exec(k);
    if (m && KI_FIG[m[1]] && M.renderApplianceIcon) return { ic: '', appl: KI_FIG[m[1]] };
    return { ic: k };
  }
  const listTxt = (a) => (a.length > 1 ? `${a.slice(0, -1).join(', ')} og ${a[a.length - 1]}` : a[0] || '');
  // Verdien i pillen: tall + enhet (mellomrom styrbart), ellers teksten
  function valTxt(st, o) {
    if (!st || M.unavailable(st)) return '–';
    let v = o.attributt ? attrPath(st, o.attributt) : st.state;
    if (v == null || v === '') v = o.attributt ? st.state : '';
    if (v == null || v === '') return '–';
    if (typeof v === 'object') v = v.condition || v.state || JSON.stringify(v);
    const n = pnum(v), isN = !isNaN(n) && /^\s*-?[\d.,]+\s*$/.test(String(v));
    const dd = o.desimaler != null ? Number(o.desimaler) : (Math.abs(n) < 10 && n % 1 ? 1 : 0);
    let t = isN ? (o.tusenskille ? nb(n, dd) : Number(n).toFixed(dd).replace('.', ',')) : String(v); // «1180W» (uten tusenskille, som ki-prosa)
    const u = o.enhet != null ? o.enhet : isN ? st.attributes.unit_of_measurement || '' : '';
    if (u && isN) t += (o.mellomrom === false || u === '°' ? '' : ' ') + u;
    return o['små_bokstaver'] ? t.toLowerCase() : t;
  }
  // Fyller malen: {navn} {antall} {sted} …; {pille}/{planter} er der pillen står → [før, etter]
  function tmpl(t, felt) {
    let x = String(t || '{pille}');
    Object.keys(felt || {}).forEach((k) => { x = x.split('{' + k + '}').join(felt[k] == null ? '' : String(felt[k])); });
    const m = /\{(pille|planter)\}/.exec(x);
    if (!m) return [x, ''];
    return [x.slice(0, m.index), x.slice(m.index + m[0].length)];
  }
  const tapNav = (path) => (path ? { action: 'navigate', navigation_path: String(path) } : null);

  /* ---- KI Planter (v1.4.0): steder fra entitetsregisteret (platform ki_planter) eller attributtet integrasjon */
  function plantSteder(h) {
    if (!h || !h.states) return [];
    const out = [];
    Object.keys(h.states).forEach((id) => {
      if (id.indexOf('sensor.') !== 0) return;
      const st = h.states[id], a = (st && st.attributes) || {}, reg = h.entities && h.entities[id];
      if (!((reg && reg.platform === 'ki_planter') || a.integrasjon === 'ki_planter')) return;
      // stedets sensor: type 'sted' eller listen trenger_vann; navnet sensor.<sted>_planter_trenger_vann eller sensor.<sted>_trenger_vann
      if (!(a.type === 'sted' || Array.isArray(a.trenger_vann) || (!a.type && /_trenger_vann$/.test(id)))) return;
      const base = id.slice(7).replace(/_trenger_vann$/, '');
      const sib = (dom, suf) => {
        const dev = reg && reg.device_id;
        if (dev && h.entities) { const f = Object.keys(h.entities).find((x) => x.indexOf(dom + '.') === 0 && h.entities[x].device_id === dev && h.entities[x].platform === 'ki_planter' && x.endsWith('_' + suf)); if (f) return f; }
        return [`${dom}.${base}_${suf}`, `${dom}.${base}_planter_${suf}`].find((x) => h.states[x]) || null;
      };
      out.push({ id, sted: a.sted || String(a.friendly_name || base).replace(/\s*(planter)?\s*trenger vann$/i, '') || base, btn: sib('button', 'alle_vannet'), test: sib('switch', 'testvisning') });
    });
    return out.sort((x, y) => (x.sted < y.sted ? -1 : 1));
  }
  M.prosaPlantSteder = plantSteder;
  function plantInfo(h, o, rd) {
    const all = plantSteder(h), want = [].concat(o.sted || []).filter(Boolean);
    const L = (o.auto === false && !want.length) ? [] : all.filter((p) => !want.length || want.includes(p.id) || want.map(fold).includes(fold(p.sted)));
    let n = 0; const names = [], txt = [], steder = [];
    L.forEach((p) => {
      const st = rd(p.id); if (!st || M.unavailable(st)) return;
      if (p.test) rd(p.test);
      const a = st.attributes || {}, cnt = M.isNum(st.state) ? Number(st.state) : Array.isArray(a.trenger_vann) ? a.trenger_vann.length : 0;
      if (cnt <= 0) return;
      n += cnt; steder.push(p);
      if (Array.isArray(a.trenger_vann)) a.trenger_vann.forEach((x) => { if (x && !names.includes(x)) names.push(String(x)); });
      else if (a.trenger_vann_tekst) txt.push(String(a.trenger_vann_tekst));
    });
    const count = Math.max(n, names.length);
    const label = count > 3 ? `${count} planter` : names.length ? listTxt(names) : txt.join(' og ') || `${count} ${count === 1 ? 'plante' : 'planter'}`;
    return { n: count, label, steder, all };
  }
  const fold = (x) => String(x || '').toLowerCase().replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'a');

  // Seksjonene → { active: { vaer, pris … } (entiteten finnes), items: { key: [vis-element] } }
  function sections(h, c, rd) {
    rd = rd || ((id) => h.states[id]);
    const has = (id) => !!(id && h.states[id]);
    const active = {}, items = {};
    const item = (k, j, o) => {
      const [pre, post] = tmpl(o.tekst || SEC_TXT[k], o.felt);
      const I = iconOf(o.ikon, o.ikonSt);
      (items[k] = items[k] || []).push({ sec: k, j, pre: pre.trim() ? pre.trim() + ' ' : '', post: post ? (/^[.,!?:;]/.test(post) ? post : ' ' + post.replace(/^\s+/, '')) + ' ' : ' ', hasChip: true,
        chip: o.chip, dot: o.dot || null, emoji: I.ic, appl: I.appl, iconEnd: o.ikon_plassering === 'slutt', anim: o.animasjon || '', bg: o.bg || '#fafafa', id: o.id || null, tap: true, act: o.act || null, hold: o.hold || null });
    };
    // vær
    const V = secOf(c, 'vaer');
    if (V && has(V.entity)) {
      active.vaer = true;
      const st = rd(V.entity);
      let chip;
      if (!V.attributt && String(V.entity).indexOf('weather.') === 0 && st && !M.unavailable(st)) { const t = st.attributes.temperature; chip = `${condOf(h, st)}${t != null && M.isNum(t) ? ' og ' + deg(t) : ''}`; } else chip = valTxt(st, V);
      item('vaer', 0, { ...V, chip, ikonSt: st, id: V.entity, act: tapNav(V.path) });
    }
    // hjemkomst
    const HK = secOf(c, 'hjemkomst');
    (HK || []).forEach((a, j) => {
      if (!a || !has(a.aktiv || a.vis)) return;
      active.hjemkomst = true;
      if (!aktiv(a.aktiv || a.vis, rd)) return;
      const rs = a.reisetid && rd(a.reisetid), min = rs && !M.unavailable(rs) ? pnum(rs.state) : NaN;
      const kl = isNaN(min) ? '–' : new Date(Date.now() + min * 60000).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
      item('hjemkomst', j, { ...a, ikon: a.ikon || SEC_IKON.hjemkomst, felt: { navn: a.navn || '' }, chip: kl, id: a.reisetid || null, act: tapNav(a.path) || (a.reisetid ? { action: 'more-info', entity: a.reisetid } : null) });
    });
    // ringeklokke
    const RK = secOf(c, 'ringeklokke');
    if (RK && has(RK.entity)) {
      active.ringeklokke = true;
      if (aktiv(RK.entity, rd)) item('ringeklokke', 0, { ...RK, ikon: RK.ikon || SEC_IKON.ringeklokke, animasjon: RK.animasjon != null ? RK.animasjon : 'vink', chip: RK.pille || '', bg: C.orange, id: RK.entity,
        act: RK.path ? tapNav(RK.path) : { action: 'perform-action', perform_action: RK.tjeneste || (String(RK.entity).split('.')[0] + '.turn_off'), data: { entity_id: RK.entity } } });
    }
    // apparater
    const AP = secOf(c, 'apparater');
    (AP || []).forEach((a, j) => {
      const u = a && (a.vis || a.aktiv), uid = u && (typeof u === 'string' ? u : u.entity);
      if (!a || !(has(uid) || has(a.verdi))) return;
      active.apparater = true;
      if (!aktiv(u || a.verdi, rd)) return;
      const src = has(a.verdi) ? a.verdi : uid, st = rd(src);
      const chip = valTxt(st, { enhet: a.enhet != null ? a.enhet : 'W', mellomrom: a.mellomrom === true, desimaler: a.desimaler != null ? a.desimaler : 0 });
      item('apparater', j, { ...a, felt: { navn: a.navn || '' }, chip, ikonSt: st, id: src, act: tapNav(a.path) || { action: 'more-info', entity: src } });
    });
    // planter
    const PL = secOf(c, 'planter');
    if (PL) {
      const P = plantInfo(h, PL, rd);
      if (P.all.length) active.planter = true;
      if (P.n > 0) {
        let ikSt = null;
        if (String(PL.ikon || '').indexOf('attributt:') === 0) { // plantens eget ikon (første som trenger vann)
          const first = Object.keys(h.states).find((id) => id.indexOf('binary_sensor.') === 0 && h.states[id].attributes.integrasjon === 'ki_planter' && M.isOn(h.states[id]));
          ikSt = first ? h.states[first] : null;
          if (!ikSt || !attrPath(ikSt, String(PL.ikon).slice(10))) PL.ikon = SEC_IKON.planter;
        }
        item('planter', 0, { ...PL, ikon: PL.ikon || SEC_IKON.planter, ikonSt: ikSt, felt: { antall: P.n, sted: listTxt(P.steder.map((x) => x.sted)) }, chip: P.label, id: (P.steder[0] || {}).id || null, act: tapNav(PL.path || '#planter'), hold: 'planter' });
      }
    }
    // pris
    const PR = secOf(c, 'pris');
    if (PR && has(PR.entity)) {
      active.pris = true;
      const st = rd(PR.entity), v = st && M.isNum(st.state) ? Number(st.state) : null;
      const lvl = v == null ? null : v > (Number(c.price_high) || 1.5) ? C.red : v > (Number(c.price_mid) || 1.1) ? C.yellow : C.green;
      item('pris', 0, { ...PR, chip: v == null ? '–' : `${nb(v, PR.desimaler != null ? Number(PR.desimaler) : 2)} ${PR.enhet || 'kr'}`, dot: lvl, id: PR.entity, act: tapNav(PR.path) || { action: 'more-info', entity: PR.entity } });
    }
    // bursdag
    const BD = secOf(c, 'bursdag');
    if (BD && has(BD.vis)) {
      active.bursdag = true;
      if (aktiv(BD.vis, rd) && !(BD.skjult && aktiv(BD.skjult, rd))) {
        const ns = BD.navn && rd(BD.navn), navn = ns && !M.unavailable(ns) && ns.state ? ns.state : 'noen';
        item('bursdag', 0, { ...BD, ikon: BD.ikon || SEC_IKON.bursdag, chip: navn, bg: BDAY_BG, id: BD.navn && has(BD.navn) ? BD.navn : BD.vis, act: tapNav(BD.path) || { action: 'more-info', entity: BD.navn && has(BD.navn) ? BD.navn : BD.vis } });
      }
    }
    return { active, items };
  }
  M.prosaSections = sections;

  // Beregn synlige setninger → [{ pre, post, chip, hasChip, dot, emoji, bg, i, row, id, tap }]
  function compute(h, c, rd) {
    c = legacyOf(c) || c; // Fiks 18.1: eldre weather/price/strom-nøkler → vaer/pris
    if (h) LH = h;
    const S = sources(h, c, rd), getS = getter(h, c, S, rd);
    const SX = sections(h, c, rd);
    // Fiks 18.1: lagrede setninger renses for vær/pris når seksjonen er aktiv (én kilde per type)
    const rows = Array.isArray(c.prose) ? cleanProse(c.prose, SX.active) : defaultProse(h, c, SX.active);
    // Verdi for en kilde. Faste kilder kan pekes til en annen entitet (ent_override / cent); «Egendefinert» bruker ent.
    const valFor = (src, ov) => {
      if (src === 'custom') return getS(ov) || null;
      if (!ov) return S[src] || null;
      if (AUTO[src]) { const S2 = sources(h, { ...c, overrides: { ...(c.overrides || {}), [src]: ov } }, rd); if (S2[src]) return S2[src]; }
      return getS(ov) || null;
    };
    const valOf = (p) => valFor(p.src, p.src === 'custom' ? p.ent : p.ent_override);
    const fill = (str) => String(str || '').replace(/\{([^}]+)\}/g, (m, k) => { const v = getS(k); return v ? v[0] : '–'; });
    const test = (p) => {
      const op = p.cop || 'alltid';
      if (op === 'alltid') return true;
      // Betingelsens entitet: cent, ellers samme entitet som boblen når betingelsen gjelder samme kilde
      const ck = p.csrc || p.src, same = ck === p.src ? (ck === 'custom' ? p.ent : p.ent_override) : '';
      const sv = valFor(ck, p.cent || same || '');
      if (!sv) return true;
      const x = pnum(p.cval), num = !isNaN(x);
      if (op === '>') return num && sv[1] > x;
      if (op === '<') return num && sv[1] < x;
      const eq = num ? sv[1] === x : String(sv[0]).toLowerCase() === String(p.cval || '').trim().toLowerCase();
      return op === '=' ? eq : !eq;
    };
    const seen = new Set(); // Fiks 18.1: hver fast kilde (vær, pris, effekt, lys …) vises maks én gang – første synlige vinner
    const once = (p) => { const k = p.src; if (!FIXED.includes(k)) return true; if (seen.has(k)) return false; seen.add(k); return true; };
    const vis = rows.map((p, i) => ({ p, i })).filter(({ p }) => p && !p.hidden && test(p) && once(p)).map(({ p, i }) => {
      const post = fill(p.post), sv = valOf(p);
      const bg = p.color === 'auto' ? (sv && sv[2]) || '#fafafa' : PCOL[p.color] || M.color(p.color, '#fafafa');
      return { i, row: p, pre: p.pre ? fill(p.pre) + ' ' : '', post: post ? (/^[.,!?:;]/.test(post) ? post : ' ' + post) + ' ' : ' ', hasChip: (p.src || 'none') !== 'none',
        chip: p.src === 'text' ? fill(p.fmt) : fill(String(p.fmt || '{v}').replace(/\{v\}/g, sv ? sv[0] : '–')),
        dot: p.icon === 'dot' ? (sv && sv[2]) || C.green : null, emoji: p.icon && p.icon !== 'dot' ? p.icon : '', bg, id: sv ? sv[3] : null, tap: !!((p.act && p.act !== 'more') || (tapOf(p) && tapOf(p).action !== 'none')) };
    });
    // Auto-entiteten for en fast kilde (uten overstyring) – vises som «Automatisk · …» i velgeren.
    const autoOf = (src) => (S[src] && S[src][3]) || (AUTO[src] ? ents(h, c)[src] : null) || null;
    // Fiks 17.9: seksjonene og setningene i valgt rekkefølge («setninger» = prose[])
    const ex = exOf(c), all = [];
    secOrder(c).forEach((k) => { if (k === 'setninger') { if (!ex.has('setninger')) all.push(...vis); } else if (SX.items[k]) all.push(...SX.items[k]); });
    // Fiks 18.1: setning som fortsetter (liten forbokstav, «og vi bruker …») slås sammen med pris-pillen foran
    // («Strømmen koster 1,16 kr og vi bruker …»); står den ikke etter en setning som fortsetter, får den stor forbokstav.
    for (let i = 0; i < all.length; i++) {
      const v = all[i], pv = all[i - 1];
      if (v.sec || !/^[a-zæøå]/.test(v.pre)) continue;
      if (pv && pv.sec === 'pris' && /\.\s*$/.test(pv.post)) all[i - 1] = { ...pv, post: pv.post.replace(/\s*\.\s*$/, ' ') };
      else if (!pv || /[.!?]\s*$/.test(pv.post)) all[i] = { ...v, pre: v.pre.charAt(0).toUpperCase() + v.pre.slice(1) };
    }
    return { S, getS, rows, vis: all, rowVis: vis, test, valOf, valFor, autoOf, fill, SX };
  }

  // Ikon: prefiks → <ha-icon>, emoji → tekst, ki:<figur> → animert hvitevare (17.9). Plassering start/slutt og animasjon.
  const icoHTML = (v) => {
    const ic = v.appl ? M.renderApplianceIcon(v.appl, v.anim !== '' && v.anim !== 'ingen', { size: 16 }) : v.emoji ? (v.emoji.indexOf(':') > 0 ? M.icon(v.emoji, 14) : `<span class="em">${esc(v.emoji)}</span>`) : '';
    return ic && v.anim && v.anim !== 'auto' && v.anim !== 'ingen' ? `<span class="an an-${esc(v.anim)}">${ic}</span>` : ic;
  };
  const chipHTML = (v) => { const ic = icoHTML(v); return `${v.dot ? `<span class="dot" style="background:${v.dot};box-shadow:0 0 0.35em ${v.dot}"></span>` : ''}${v.iconEnd ? '' : ic}${v.chip !== '' ? `<span>${esc(v.chip)}</span>` : ''}${v.iconEnd ? ic : ''}`; };
  // Hele prosaen som én flytende tekst (MySmartHome): ord og piller skilles med vanlige mellomrom og brytes naturlig –
  // ingen &nbsp;-binding eller text-wrap: pretty/balance (Fiks 15.3). Eneste unntak: tegnsetting rett etter en pille
  // limes til pillen (nowrap-bit .pzg), så «.» aldri havner alene på neste linje.
  // mark(v) (valgfri, Fiks 20.9): klasse for setningen → hele setningen pakkes i <span class="…"> (markering i editorene)
  function prosaHTML(vis, pill, mark) {
    const A = [];
    vis.forEach((v) => {
      const B = [];
      const words = (t) => String(t || '').trim().split(/\s+/).filter(Boolean).forEach((w) => B.push(esc(w)));
      words(v.pre);
      let post = String(v.post || '').trim();
      if (v.hasChip) {
        const m = /^[.,!?:;…»)\]]+/.exec(post), pu = m ? m[0] : '';
        if (pu) post = post.slice(pu.length);
        B.push(pu ? `<span class="pzg">${pill(v)}${esc(pu)}</span>` : pill(v));
      }
      words(post);
      const mk = mark && B.length ? mark(v) : '';
      if (mk) A.push(`<span class="${mk}">${B.join(' ')}</span>`); else A.push(...B);
    });
    return A.join(' ');
  }
  // Tidligere gruppedeling (Fiks 13) – ikke lenger nødvendig; beholdes som no-op for eldre kall.
  M.fitProsa = function () {};
  M.prosaHTML = prosaHTML;
  // Samme utseende i kortet, i GUI-editorens forhåndsvisning og i «Tilpass Hjem» → Tekst (00-base legger font på :host).
  M.PROSA_CSS = `
    .pz{margin:0;padding:4px 0 0 0;font-family:${M.FONT};font-weight:400;letter-spacing:-0.01em;overflow-wrap:break-word;color:var(--gray1000-white,#fafafa)}
    /* Pille: 1,6em høy av 0,8em tekst (≈ 0,82 × linjehøyden 1,55) – endrer ikke linjerytmen */
    .pz .chip{display:inline-flex;align-items:center;gap:8px;height:1.6em;margin:0;padding:0 .55em;border:0;border-radius:999px;box-shadow:none;background:#fafafa;color:#2f2f2f;font:inherit;font-size:.8em;font-weight:600;line-height:1;letter-spacing:0;white-space:nowrap;vertical-align:.08em;font-variant-numeric:tabular-nums;box-sizing:border-box;-webkit-tap-highlight-color:transparent;transition:transform .15s cubic-bezier(.34,1.5,.64,1),background .3s}
    .pz .chip.press:active{transform:scale(.96)}
    .pz .chip ha-icon{color:#2f2f2f;--mdc-icon-size:.9em !important;width:.9em !important;height:.9em !important}
    .pz .chip .em{font-size:.9em;line-height:1;flex:none}
    .pz .dot{width:.42em;height:.42em;border-radius:50%;flex:none;transition:background .3s}
    .pz .pzg{white-space:nowrap}
    /* Fiks 20.9: delen som redigeres (forhåndsvisningen i editorene); skjult av betingelsen → gjennomstreket og svak */
    .pz .pzm{background:rgb(242 133 201 / 0.14);box-shadow:0 .1em 0 rgb(242 133 201 / 0.55);border-radius:.3em;-webkit-box-decoration-break:clone;box-decoration-break:clone;transition:background .2s}
    .pz .pzm.off{text-decoration:line-through;text-decoration-color:rgb(250 250 250 / 0.6);opacity:.5}
    .pz .chip svg.ma{width:1em;height:1em;flex:none}
    .pz .chip .an{display:inline-flex;line-height:0}
    .pz .an-hopp{animation:pz-hopp 1.6s ease-in-out infinite}
    .pz .an-vugg{animation:pz-vugg 2.4s ease-in-out infinite;transform-origin:50% 90%}
    .pz .an-vink{animation:pz-vink 1.8s ease-in-out infinite;transform-origin:50% 20%}
    .pz .an-snurr{animation:pz-snurr 2s linear infinite}
    .pz .an-puls{animation:pz-puls 1.6s ease-in-out infinite}
    @keyframes pz-hopp{0%,60%,100%{transform:none}30%{transform:translateY(-.22em)}}
    @keyframes pz-vugg{0%,100%{transform:rotate(-8deg)}50%{transform:rotate(8deg)}}
    @keyframes pz-vink{0%,50%,100%{transform:none}10%,30%{transform:rotate(-16deg)}20%,40%{transform:rotate(16deg)}}
    @keyframes pz-snurr{to{transform:rotate(360deg)}}
    @keyframes pz-puls{0%,100%{transform:none}50%{transform:scale(1.18)}}
    @media (prefers-reduced-motion: reduce){.pz .an{animation:none!important}}
  `;
  // Standard: clamp(22px, 7,4cqi, 34px) – kortet (eller forhåndsvisningen) er container (container-type: inline-size)
  // Fiks 18.4: i Fold-oppsettet setter msh-hjem-card --msh-prosa-max (telefonens størrelse) – prosaen blir ikke større enn på telefon
  const AUTO_FS = 'clamp(22px, 7.4cqi, var(--msh-prosa-max, 34px))';
  M.PROSA_AUTO_FS = AUTO_FS;
  const textStyle = (c) => { const T = textSizeOf(c); return `font-size:${T.fs != null ? T.fs + 'em' : AUTO_FS};line-height:${T.lh}`; };
  /* Fiks 20.9: live forhåndsvisning i editorene (Tilpass Hjem → Tekst og GUI-editoren) – samme compute/prosaHTML/chipHTML
   * som kortet. o.sel = setningen som redigeres (markeres; skjult av betingelsen/øyet → vises gjennomstreket og svakt).
   * o.act = data-a på boblene (trykk åpner delen i listen i stedet for å kjøre handlingen), data-i = setningens indeks. */
  M.prosaPreviewInner = function (h, c, o) {
    o = o || {};
    if (!h) return '';
    const cc = { ...Prosa.defaults, ...(c || {}) };
    let R = compute(h, cc), off = null;
    const sel = o.sel != null && o.sel !== '' && !isNaN(Number(o.sel)) ? Number(o.sel) : null;
    if (sel != null && R.rows[sel] && !R.vis.some((v) => !v.sec && v.i === sel)) {
      off = sel;
      R = compute(h, { ...cc, prose: R.rows.map((p, i) => (i === sel ? { ...p, cop: 'alltid', hidden: undefined } : p)) });
    }
    if (!R.vis.length) return '<span style="color:#7f7f7f">Ingen setninger vises nå</span>';
    const act = o.act ? ` data-a="${esc(o.act)}"` : '';
    return prosaHTML(R.vis, (v) => (v.sec
      ? `<span class="chip" style="background:${v.bg}">${chipHTML(v)}</span>`
      : `<span class="chip"${act} data-i="${v.i}" style="background:${v.bg};cursor:pointer">${chipHTML(v)}</span>`),
    (v) => (!v.sec && v.i === sel ? (v.i === off ? 'pzm off' : 'pzm') : ''));
  };
  // Sticky boks øverst i arket: «FORHÅNDSVISNING · LIVE» + prosaen (maks 34vh, egen scroll). o.style = ekstra stil på .pz.
  M.PROSA_PREV_CSS = `
    .xpz{position:sticky;top:calc(var(--ki-grab-h, 0px) - 12px);z-index:5;padding:10px 16px 14px;margin:0 0 12px;border-radius:24px;background:#232323;box-shadow:0 12px 14px -2px var(--ki-sheet-bg, #282828);font-size:var(--ha-font-size-m, 14px);line-height:normal;container-type:inline-size}
    .xpzl{display:flex;align-items:center;gap:6px;font-size:11px;font-weight:600;letter-spacing:.08em;color:#979797;margin:0 0 6px;font-family:${M.FONT}}
    .xpzd{width:7px;height:7px;border-radius:50%;background:${C.green};box-shadow:0 0 6px ${C.green};flex:none}
    .xpzb{max-height:34vh;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:none;touch-action:pan-y}
    .xpzb::-webkit-scrollbar{display:none}
    .xpzb .pz{padding:0}
  `;
  M.prosaPreviewHTML = function (h, c, o) {
    o = o || {};
    return `<div class="xpz" data-key="${esc(o.key || 'prev')}" data-pzprev="1"><style>${M.PROSA_CSS}${M.APPLIANCE_CSS || ''}${M.PROSA_PREV_CSS}</style><div class="xpzl"><span class="xpzd"></span>FORHÅNDSVISNING · LIVE</div><div class="xpzb"><div class="pz" style="${o.style || textStyle(c || {})}">${M.prosaPreviewInner(h, c, o)}</div></div></div>`;
  };
  // Scroll forhåndsvisningen (egen scroll) så den markerte delen er synlig.
  M.prosaPreviewScroll = function (root) {
    const b = root && root.querySelector('[data-pzprev] .xpzb'), m = b && b.querySelector('.pzm');
    if (!b || !m) return;
    const br = b.getBoundingClientRect(), mr = m.getBoundingClientRect();
    if (mr.top < br.top || mr.bottom > br.bottom) b.scrollTop += mr.top - br.top - Math.max(0, (br.height - Math.min(mr.height, br.height)) / 2);
  };
  const previewHTML = (h, c, o) => M.prosaPreviewHTML(h, c, o);

  // Utfør handling for en setning (runAct i designet).
  function runAct(card, p, id) {
    const h = card.hass, E = ents(h, card.config), a = p.act || '', T = tapOf(p);
    const t = (m) => M.hjemToast(card, m);
    const st = (x) => x && h.states[x];
    if (a === 'more' && !(T && T.action === 'more-info')) M.moreInfo(card, id || E.weather);
    if (a === 'lock_toggle' || a === 'lock' || a === 'unlock') {
      const l = st(E.lock);
      if (!l) t('Fant ingen dørlås');
      else {
        const lock = a === 'lock' ? true : a === 'unlock' ? false : l.state !== 'locked';
        if (!lock && l.attributes.code_format) M.moreInfo(card, E.lock);
        else M.call(h, 'lock', lock ? 'lock' : 'unlock', { entity_id: E.lock }).then(() => t(lock ? 'Dørlås låst' : 'Dørlås låst opp')).catch(() => {});
      }
    } else if (a.indexOf('alarm') === 0) {
      const al = st(E.alarm);
      if (!al) t('Fant ingen alarm');
      else {
        const armed = /^armed|triggered/.test(al.state), want = a === 'alarm_on' ? true : a === 'alarm_off' ? false : !armed;
        const needCode = al.attributes.code_format && (!want || al.attributes.code_arm_required !== false);
        if (needCode) M.openPopup(card.config.alarm_hash || '#sikkerhet');
        else M.call(h, 'alarm_control_panel', want ? 'alarm_arm_away' : 'alarm_disarm', { entity_id: E.alarm }).then(() => t(want ? 'Alarm armert' : 'Alarm slått av')).catch(() => {});
      }
    } else if (a === 'lights_on' || a === 'lights_off') {
      const on = a === 'lights_on';
      M.call(h, 'light', on ? 'turn_on' : 'turn_off', { entity_id: 'all' }).then(() => t(on ? 'Alle lys er på' : 'Alle lys er av')).catch(() => {});
    } else if (a === 'garage_toggle') {
      const g = M.pick(card.config, 'garage', M.all(h, 'cover', (s) => s.attributes.device_class === 'garage')[0]);
      if (!g) t('Fant ingen garasjeport'); else M.call(h, 'cover', 'toggle', { entity_id: g }).then(() => t(h.states[g].state === 'open' ? 'Garasjeporten lukkes' : 'Garasjeporten åpnes')).catch(() => {});
    } else if (a === 'tv_toggle') {
      const tv = M.pick(card.config, 'tv', M.all(h, 'media_player', (s) => s.attributes.device_class === 'tv')[0]);
      if (!tv) t('Fant ingen TV'); else M.call(h, 'media_player', 'toggle', { entity_id: tv }).then(() => t(M.isOn(h.states[tv]) || h.states[tv].state === 'on' ? 'TV slått av' : 'TV slått på')).catch(() => {});
    } else if (a === 'vac_toggle') {
      const v = M.pick(card.config, 'vacuum', M.all(h, 'vacuum')[0]);
      if (!v) t('Fant ingen støvsuger');
      else { const run = h.states[v].state === 'cleaning'; M.call(h, 'vacuum', run ? 'pause' : 'start', { entity_id: v }).then(() => t(run ? 'Støvsuger pauset' : 'Støvsuger starter')).catch(() => {}); }
    } else if (a === 'service') runService(card, p);
    // Ved trykk (tap): popup / egen hash / sti / URL / more-info / dørlås-ark
    if (T) {
      if (T.action === 'lock-sheet') M.hjemLockSheet(card, E.lock);
      else if (T.action === 'more-info') M.moreInfo(card, T.entity || id || E.weather);
      else if (M.tap) M.tap.run(card, T);
    }
  }
  function parseData(s) {
    if (!s) return {};
    if (typeof s === 'object') return s;
    try { return JSON.parse(s); } catch (e) { /* k: v-linjer */ }
    const o = {};
    String(s).split(/[\n,]/).forEach((l) => { const m = /^\s*([\w.]+)\s*[:=]\s*(.+?)\s*$/.exec(l); if (m) o[m[1]] = M.isNum(m[2]) ? Number(m[2]) : m[2].replace(/^['"]|['"]$/g, ''); });
    return o;
  }
  function runService(card, p, hass) {
    const h = hass || card.hass, svc = String(p.svc || '').trim();
    const m = /^([a-z_]+)\.([a-z0-9_]+)$/.exec(svc);
    if (!m) { M.toast('Ugyldig tjeneste: ' + (svc || '–')); return; }
    const data = parseData(p.data);
    if (p.target) data.entity_id = p.target;
    M.call(h, m[1], m[2], data).then(() => M.hjemToast(card, `Kjørte ${svc}`)).catch(() => {});
  }


  /* ---- Fiks 17.9 · editor for seksjonene (kortets egen editor + GUI-editoren, samme skjema) */
  const tx = (k, extra) => ({ type: 'text', name: k + '.tekst', label: 'Tekstmal · {pille} er pillen', placeholder: (SEC_STD[k] && SEC_STD[k].tekst) || SEC_TXT[k], ...(extra || {}) });
  const stdEnt = (k, f) => () => (SEC_STD[k] || {})[f] || null;
  const SEC_SCHEMA = [
    { type: 'order', name: 'rekkefolge', hiddenName: 'exclude', label: 'Seksjoner · rekkefølge (skjult = av)', options: SEC_KEYS.map((k) => [k, SEC_L[k]]) },
    { type: 'section', id: 'sek-vaer', label: 'Vær', icon: 'mdi:weather-partly-cloudy', meta: (h, c) => (secOf(c, 'vaer') ? secOf(c, 'vaer').entity : 'Av'), fields: [
      { type: 'entity', name: 'vaer.entity', label: 'Entitet', domains: ['sensor', 'weather'], auto: stdEnt('vaer', 'entity') },
      { type: 'text', name: 'vaer.attributt', label: 'Attributt (tom = tilstanden)', placeholder: SEC_STD.vaer.attributt },
      { type: 'text', name: 'vaer.enhet', label: 'Enhet', placeholder: SEC_STD.vaer.enhet },
      { type: 'boolean', name: 'vaer.mellomrom', label: 'Mellomrom mellom tall og enhet', default: false },
      { type: 'text', name: 'vaer.ikon', label: 'Ikon · mdi:, emoji eller attributt:current.icon', placeholder: SEC_STD.vaer.ikon },
      { type: 'select', name: 'vaer.ikon_plassering', label: 'Ikon i pillen', options: [['start', 'Før'], ['slutt', 'Etter']], default: 'slutt' },
      { type: 'boolean', name: 'vaer.små_bokstaver', label: 'Små bokstaver', default: true },
      tx('vaer'),
      { type: 'hash', name: 'vaer.path', label: 'Trykk åpner popup', placeholder: '#vaer' },
    ] },
    { type: 'section', id: 'sek-hjemkomst', label: 'Hjemkomst', icon: 'mdi:car', fields: [
      { type: 'rows', name: 'hjemkomst', label: 'Personer på vei hjem', addLabel: 'Ny person', defaults: () => clone(SEC_STD.hjemkomst),
        newRow: () => ({ navn: 'Ny', aktiv: '', reisetid: '', ikon: '🚗', animasjon: 'hopp', tekst: SEC_TXT.hjemkomst, path: '#personer' }),
        title: (r) => r.navn || 'Uten navn', sub: (r) => [r.aktiv, r.reisetid].filter(Boolean).join(' · ') || 'Velg entiteter',
        fields: [
          { type: 'text', name: 'navn', label: 'Navn' },
          { type: 'entity', name: 'aktiv', label: 'På vei hjem (på/av)', domains: ['input_boolean', 'binary_sensor', 'switch'] },
          { type: 'entity', name: 'reisetid', label: 'Reisetid (minutter)', domain: 'sensor' },
          { type: 'text', name: 'ikon', label: 'Ikon · emoji eller mdi:…', placeholder: '🚗' },
          { type: 'select', name: 'animasjon', label: 'Animasjon', options: ANIMS, default: '' },
          { type: 'text', name: 'tekst', label: 'Tekstmal · {navn} {pille}', placeholder: SEC_TXT.hjemkomst },
          { type: 'hash', name: 'path', label: 'Trykk åpner popup', placeholder: '#personer' },
        ] },
    ] },
    { type: 'section', id: 'sek-ringeklokke', label: 'Ringeklokke', icon: 'mdi:doorbell', fields: [
      { type: 'entity', name: 'ringeklokke.entity', label: 'Varsel aktiv (på/av)', domains: ['input_boolean', 'binary_sensor', 'switch'], auto: stdEnt('ringeklokke', 'entity') },
      tx('ringeklokke'),
      { type: 'select', name: 'ringeklokke.animasjon', label: 'Animasjon', options: ANIMS, default: 'vink' },
      { type: 'hash', name: 'ringeklokke.path', label: 'Trykk åpner popup (tom = slå av varselet)' },
    ] },
    { type: 'section', id: 'sek-apparater', label: 'Apparater', icon: 'mdi:washing-machine', fields: [
      { type: 'rows', name: 'apparater', label: 'Apparater som går', addLabel: 'Nytt apparat', defaults: () => clone(SEC_STD.apparater),
        newRow: () => ({ navn: 'Nytt apparat', vis: { entity: '', state: '' }, verdi: '', ikon: 'mdi:power-plug', animasjon: 'auto' }),
        title: (r) => r.navn || 'Uten navn', sub: (r) => { const u = r.vis || r.aktiv; return u ? (typeof u === 'string' ? u : `${u.entity || '–'}${u.state != null && u.state !== '' ? ' = ' + u.state : u.over != null ? ' > ' + u.over : ''}`) : 'Velg entitet'; },
        fields: [
          { type: 'text', name: 'navn', label: 'Navn' },
          { type: 'entity', name: 'vis.entity', label: 'Vises når … (entitet)', domains: ['input_select', 'select', 'sensor', 'binary_sensor', 'switch', 'input_boolean'] },
          { type: 'text', name: 'vis.state', label: '… har tilstanden (tom = på)', placeholder: 'Vasker' },
          { type: 'entity', name: 'verdi', label: 'Verdi i pillen (effekt)', domain: 'sensor' },
          { type: 'text', name: 'ikon', label: 'Ikon · ki:vaskemaskin / ki:oppvask / ki:torketrommel, mdi:… eller emoji', placeholder: 'ki:vaskemaskin' },
          { type: 'select', name: 'animasjon', label: 'Animasjon', options: ANIMS, default: 'auto' },
          { type: 'text', name: 'tekst', label: 'Tekstmal · {navn} {pille}', placeholder: SEC_TXT.apparater },
          { type: 'hash', name: 'path', label: 'Trykk åpner popup (tom = detaljer)' },
        ] },
    ] },
    { type: 'section', id: 'sek-planter', label: 'Planter · KI Planter', icon: 'mdi:sprout', meta: (h) => { const n = plantSteder(h).length; return n ? `${n} ${n === 1 ? 'sted' : 'steder'}` : 'Fant ingen'; }, fields: [
      { type: 'boolean', name: 'planter.auto', label: 'Finn stedene automatisk (KI Planter)', default: true },
      { type: 'html', render: (h, c) => {
        const L = plantSteder(h), sel = [].concat((c.planter && c.planter.sted) || []);
        if (!L.length) return '<span class="help" style="padding:0 6px">Fant ingen steder fra KI Planter (sensor.&lt;sted&gt;_planter_trenger_vann).</span>';
        return `<div class="f"><label>Steder · ingen valgt = alle</label><div class="chips">${L.map((p) => `<button class="chip ${sel.includes(p.id) ? 'on' : ''}" data-a="hid" data-name="planter.sted" data-v="${esc(p.id)}">${esc(p.sted)}</button>`).join('')}</div></div>`;
      } },
      { type: 'text', name: 'planter.tekst', label: 'Tekstmal · {planter} {antall} {sted}', placeholder: SEC_STD.planter.tekst },
      { type: 'icon', name: 'planter.ikon', label: 'Ikon (attributt:ikon = plantens eget)', placeholder: SEC_STD.planter.ikon },
      { type: 'select', name: 'planter.animasjon', label: 'Animasjon', options: ANIMS, default: 'vugg' },
      { type: 'hash', name: 'planter.path', label: 'Trykk åpner popup · hold = alle vannet', placeholder: '#planter' },
    ] },
    { type: 'section', id: 'sek-pris', label: 'Strømpris', icon: 'mdi:lightning-bolt', fields: [
      { type: 'entity', name: 'pris.entity', label: 'Entitet', domain: 'sensor', auto: stdEnt('pris', 'entity') },
      tx('pris', { placeholder: SEC_TXT.pris }),
      { type: 'hash', name: 'pris.path', label: 'Trykk åpner popup (tom = detaljer)' },
    ] },
    { type: 'section', id: 'sek-bursdag', label: 'Bursdag', icon: 'mdi:cake-variant', fields: [
      { type: 'entity', name: 'bursdag.vis', label: 'Vises når (på/av)', domains: ['binary_sensor', 'input_boolean'], auto: stdEnt('bursdag', 'vis') },
      { type: 'entity', name: 'bursdag.navn', label: 'Navn (sensor med dagens bursdager)', domain: 'sensor' },
      tx('bursdag', { placeholder: SEC_TXT.bursdag }),
    ] },
  ];

  class Prosa extends M.Card {
    static get cardName() { return 'Hjem · prosa'; }
    static get defaults() { return { price_high: 1.5, price_mid: 1.1, alarm_hash: '#sikkerhet' }; }
    // Fiks 17.9: nytt kort får brukerens standard-config (seksjonene); manglende seksjoner fylles inn også i eldre kort
    static getStubConfig() { return { card_id: M.uid(), ...this.defaults, ...clone(SEC_STD) }; }
    // Tekststørrelse i em av HA-kortets 14 px (standard 2,15 em ≈ 30 px = MySmartHome på mobil, skaleres med temaets
    // tekststørrelse) og linjehøyde som faktor av tekststørrelsen (standard 1,55). Delt med «Tilpass Hjem» → Tekst.
    static get sizeFields() { return SIZE_FIELDS; }
    static textSize(c) { return textSizeOf(c); }
    static getConfigElement() { return M.hjemEditorEl(this); }
    static get schema() {
      return (hass) => {
        const areas = hass ? M.areas(hass).slice(0, 8) : [];
        const persons = hass ? M.all(hass, 'person') : [];
        const toks = [...Object.keys(TOK).map((k) => [`+ {${k}}`, `{${k}}`]), ...areas.map((a) => [`+ {${a.id}.temp}`, `{${a.id}.temp}`]), ...persons.map((p) => { const o = p.split('.')[1]; return [`+ {${o}.hjemme}`, `{${o}.hjemme}`]; })];
        const cond = (r) => r.cop && r.cop !== 'alltid';
        return [
          // Fiks 20.9: sticky live forhåndsvisning (msh-hjem-editor oppdaterer den per tastetrykk og markerer åpen setning)
          { type: 'html', live: 'prose', render: (h, c, ed) => previewHTML(h, c, { sel: ed && ed._ropen ? ed._ropen.prose : null, act: 'x-pzsel' }) },
          ...Prosa.sizeFields,
          ...SEC_SCHEMA,
          { type: 'rows', name: 'prose', label: 'Setninger', hide: true, addLabel: 'Ny setning',
            help: 'Hver setning kan ha en boble med live verdi. Lag to setninger med motsatte betingelser for å bytte tekst eller farge etter tilstand.',
            defaults: (h, c) => defaultProse(h, c, sections(h, legacyOf(c) || c).active),
            norm: (list, c) => (LH ? cleanProse(list, sections(LH, legacyOf(c) || c).active) : list), // Fiks 18.1
            newRow: () => ({ id: 'p' + Date.now().toString(36), pre: 'Ny tekst', src: 'none', fmt: '{v}', post: '', icon: '', color: 'hvit', cop: 'alltid' }),
            title: (p) => [p.pre, (p.src || 'none') === 'none' ? '' : `[${p.src === 'text' ? p.fmt || '' : p.src === 'custom' ? p.ent || 'state' : srcL(p.src)}]`, p.post].filter(Boolean).join(' ') || 'Tom setning',
            sub: (p, i, h, c) => { const op = p.cop || 'alltid'; if (op === 'alltid') return 'Vises alltid'; const R = compute(h, c); return `Når ${srcL(p.csrc || p.src).toLowerCase()} ${(OPS.find((o) => o[0] === op) || ['', ''])[1].toLowerCase()} ${p.cval || '…'} · ${R.test(p) ? 'vises nå' : 'skjult nå'}`; },
            fields: [
              { type: 'text', name: 'pre', label: 'Tekst før', placeholder: 'F.eks. Strømmen koster' },
              { type: 'tokens', target: 'pre', tokens: toks },
              { type: 'select', name: 'src', label: 'Verdi i boblen', options: SRC, default: 'none' },
              { type: 'entity', name: 'ent', label: 'Entitet', required: true, placeholder: 'Velg entitet …', help: 'Påkrevd for «Egendefinert». Kan også være {område}.temp o.l. i tekstfeltene.', rowWhen: (r) => r.src === 'custom' },
              { type: 'entity', name: 'ent_override', label: 'Entitet', help: 'Automatisk = kildens standard-entitet. Velg en annen sensor for å overstyre bare denne setningen.', rowWhen: (r) => FIXED.includes(r.src), auto: (r, h, c) => compute(h, c).autoOf(r.src) },
              { type: 'html', rowWhen: (r) => r.src && r.src !== 'none' && r.src !== 'text', render: (r, h, c) => { const R = compute(h, c), v = R.valOf(r); return `<span class="help" style="padding:0 6px">${v ? 'Nå: ' + esc(v[0]) : 'Fant ingen verdi – velg en entitet'}</span>`; } },
              { type: 'text', name: 'fmt', label: 'Visning i boblen · {v} er verdien', rowWhen: (r) => r.src && r.src !== 'none' && r.src !== 'text', placeholder: '{v}' },
              { type: 'text', name: 'fmt', label: 'Tekst i boblen', rowWhen: (r) => r.src === 'text' },
              { type: 'text', name: 'post', label: 'Tekst etter', placeholder: 'F.eks. i dag.' },
              { type: 'tokens', target: 'post', tokens: toks },
              { type: 'select', name: 'icon', label: 'Ikon i boblen', options: ICONS, default: '' },
              { type: 'text', name: 'icon', label: 'Eller skriv inn en emoji / mdi:ikon' },
              { type: 'swatches', name: 'color', label: 'Farge · Auto følger verdien (pris, lås, alarm …)', options: PSW, default: 'hvit' },
              { type: 'tap', name: 'tap', label: 'Ved trykk', modes: TAP_MODES, labels: { path: 'Sti' }, auto: (r) => tapOf({ ...r, tap: undefined }) || { action: 'none' } },
              { type: 'select', name: 'act', label: 'Utfør også', options: ACTS.filter((x) => x[0] !== 'more'), default: '' },
              { type: 'text', name: 'svc', label: 'Utfør handling · domene.tjeneste', placeholder: 'light.turn_on', rowWhen: (r) => r.act === 'service' },
              { type: 'entity', name: 'target', label: 'Mål', rowWhen: (r) => r.act === 'service' },
              { type: 'text', name: 'data', label: 'Data (JSON eller nøkkel: verdi)', placeholder: '{"brightness_pct": 60}', rowWhen: (r) => r.act === 'service' },
              { type: 'button', label: 'Test handling', icon: 'mdi:play', rowWhen: (r) => r.act === 'service', run: (r, h) => runService({ hass: h, config: {} }, r, h) },
              { type: 'select', name: 'cop', label: 'Vises', options: OPS, default: 'alltid' },
              { type: 'select', name: 'csrc', label: 'Når', options: SRC.filter((x) => x[0] !== 'none' && x[0] !== 'text'), rowWhen: cond },
              { type: 'entity', name: 'cent', label: 'Entitet (betingelse)', help: 'For faste kilder: tom = samme entitet som kilden. Påkrevd for «Egendefinert».', rowWhen: (r) => cond(r), auto: (r, h, c) => { const R = compute(h, c), ck = r.csrc || r.src; return ck === 'custom' ? null : ck === r.src && r.ent_override ? r.ent_override : R.autoOf(ck); } },
              { type: 'text', name: 'cval', label: 'Verdi', placeholder: 'F.eks. 1,5 eller låst', rowWhen: cond },
            ] },
          { type: 'overrides', label: 'Bytt entiteter (kilder)', fields: [
            { name: 'weather', label: 'Vær', domain: 'weather', auto: (h) => AUTO.weather(h) },
            { name: 'temp', label: 'Ute-temp (tom = fra vær)', domain: 'sensor', device_class: 'temperature', auto: () => null },
            { name: 'price', label: 'Strømpris', domain: 'sensor', auto: (h) => AUTO.price(h) },
            { name: 'watt', label: 'Effekt (hele huset)', domain: 'sensor', device_class: 'power', auto: (h) => AUTO.watt(h) },
            { name: 'lights', label: 'Lys på (hele huset)', domain: 'sensor', auto: (h) => AUTO.lights(h) },
            { name: 'lock', label: 'Dørlås', domain: 'lock', auto: (h) => AUTO.lock(h) },
            { name: 'alarm', label: 'Alarm', domain: 'alarm_control_panel', auto: (h) => AUTO.alarm(h) },
            { name: 'trash', label: 'Søppel (dager til tømming)', domain: 'sensor', auto: (h) => AUTO.trash(h) },
            { name: 'garage', label: 'Garasjeport', domain: 'cover', auto: (h) => M.all(h, 'cover', (s) => s.attributes.device_class === 'garage')[0] },
            { name: 'tv', label: 'TV', domain: 'media_player', auto: (h) => M.all(h, 'media_player', (s) => s.attributes.device_class === 'tv')[0] },
            { name: 'vacuum', label: 'Støvsuger', domain: 'vacuum', auto: (h) => M.all(h, 'vacuum')[0] },
          ] },
          { type: 'lists', label: 'Kalendere og gjøremålslister', lists: (h) => [{ key: 'kalendere', label: 'Kalendere (hendelser i dag)', ids: M.all(h, 'calendar'), domains: ['calendar'] }, { key: 'lister', label: 'Gjøremålslister', ids: M.all(h, 'todo'), domains: ['todo'] }] },
          { type: 'section', label: 'Farger og popups', icon: 'mdi:palette', fields: [
            { type: 'number', name: 'price_high', label: 'Strømpris rød over (kr)', step: 0.1, placeholder: '1.5' },
            { type: 'number', name: 'price_mid', label: 'Strømpris gul over (kr)', step: 0.1, placeholder: '1.1' },
            { type: 'hash', name: 'alarm_hash', label: 'Alarm-popup (når kode kreves)', placeholder: '#sikkerhet' },
            { type: 'boolean', name: 'toasts', label: 'Bekreftelsesmeldinger', default: true },
          ] },
        ];
      };
    }
    get cardSize() { return 2; }
    customize(focus) { return M.hjemCustomize(this, focus); }
    connectedCallback() { super.connectedCallback(); this._evT = setInterval(() => this._events(), 15 * 60000); }
    disconnectedCallback() { super.disconnectedCallback(); clearInterval(this._evT); }
    _events() { if (!this.hass) return; const E = ents(this.hass, this.config); loadEvents(this.hass, E.calendars, () => this.update()); }
    render() {
      if (!this._evOnce) { this._evOnce = true; setTimeout(() => this._events(), 0); }
      if (M.powerPriceWatch) M.powerPriceWatch(this); // power_price i ki-store endret → tegn på nytt
      const R = compute(this.hass, this.config, (id) => this.s(id));
      this._R = R;
      this._migrate(R);
      this._sheets && this._sheets.forEach((sh) => sh.update());
      const pzS = `style="${textStyle(this.config)}"`;
      if (!R.vis.length) {
        return `<div class="pz" ${pzS} data-ent="__tilpass"><span class="dim">–</span> <button class="pick press" data-act="customize" data-section="prose">${M.icon('mdi:plus', 18)}Legg til setning</button></div>`;
      }
      return `<div class="pz" ${pzS} data-ent="__tilpass">${prosaHTML(R.vis, (v) => (v.sec
        ? `<button class="chip press" data-key="s-${v.sec}-${v.j}" data-act="sec" data-s="${v.sec}" data-j="${v.j}" ${v.id || v.hold ? `data-ent="${esc(v.id || '__' + v.hold)}"` : ''} ${v.hold ? `data-hold="${esc(v.hold)}"` : ''} style="background:${v.bg};cursor:pointer">${chipHTML(v)}</button>`
        : `<button class="chip ${v.tap ? 'press' : ''}" data-key="c${v.i}" data-act="chip" data-i="${v.i}" ${v.id ? `data-ent="${esc(v.id)}"` : ''} ${v.tap ? '' : 'data-haptic="off"'} style="background:${v.bg};cursor:${v.tap ? 'pointer' : 'default'}">${chipHTML(v)}</button>`))}</div>`;
    }
    // Fiks 18.1 · migrering, lagres én gang per kort: eldre vær/pris-nøkler → vaer/pris, og vær/pris-setninger i prose[]
    // fjernes når seksjonen er aktiv. Bare det levende kortet (ikke editorens frakoblede instans), ikke mens et utkast er åpent.
    _migrate(R) {
      const raw = this._rawConfig, id = raw && raw.card_id;
      if (!id || !this.isConnected || !this.hass || !M.store || !M.store.loaded || (M.draftOf && M.draftOf(this))) return;
      const done = (M._prosaMig = M._prosaMig || new Set());
      if (done.has(id)) return;
      const L = legacyOf(raw), base = L || raw;
      const cut = Array.isArray(base.prose) && R.rows.length !== base.prose.length;
      if (!L && !cut) return;
      done.add(id);
      const nc = { ...base };
      if (cut) nc.prose = R.rows.map((x) => clone(x));
      try { M.saveCardConfig(this.hass, raw, nc, { toasts: false, card: this }); } catch (e) { console.warn('[ki-msh] prosa-migrering', e); }
    }
    onHold(id, el) {
      if (id === '__tilpass') { this.customize('prose'); return true; }
      if (el && el.dataset.hold === 'planter') { this._plantsDone(); return true; } // Fiks 17.9: hold → «alle vannet»
      return undefined;
    }
    // Hold på plante-pillen: bekreft «Merk alle som vannet?» → button.<sted>_planter_alle_vannet for hvert sted som trenger vann
    _plantsDone() {
      const h = this.hass, PL = secOf(this.config, 'planter');
      if (!h || !PL) return;
      const P = plantInfo(h, PL, (id) => this.s(id)), btns = P.steder.map((p) => p.btn).filter(Boolean);
      if (!btns.length) { M.hjemToast(this, 'Fant ingen «alle vannet»-knapp i KI Planter'); return; }
      const sheet = M.hjemSheet(this, {
        render: () => `<div class="orb" style="background:${M.alpha(C.green, 0.2)};box-shadow:0 0 0 6px var(--gray200,#3a3a3a)">${M.icon('mdi:watering-can', 40, `color:${C.green}`)}</div>
          <div class="nm"><b>Merk alle som vannet?</b><span>${esc(P.label)}${P.steder.length > 1 ? ' · ' + esc(listTxt(P.steder.map((x) => x.sted))) : ''}</span></div>
          <div class="opts"><button class="opt" data-a="close">Avbryt</button><button class="opt" data-a="ok" data-haptic="off" style="background:${C.green};color:#12291d;font-weight:600">Alle vannet</button></div>`,
        onAct: (a) => {
          if (a !== 'ok') return;
          sheet.ov.close();
          Promise.all(btns.map((b) => M.call(h, 'button', 'press', { entity_id: b }))).then(() => { M.haptic('success'); M.hjemToast(this, 'Alle planter er merket som vannet'); }).catch(() => {});
        },
      });
    }
    onAction(name, el, ev) {
      if (name === 'sec') { // Fiks 17.9: trykk på en seksjons-pille → path (popup) / tjeneste / more-info
        const v = ((this._R && this._R.SX.items[el.dataset.s]) || []).find((x) => String(x.j) === el.dataset.j);
        const a = v && v.act;
        if (!a) return;
        if (a.action === 'more-info') return M.moreInfo(this, a.entity || v.id);
        if (M.tap) M.tap.run(this, a, { entity: v.id, hass: this.hass });
        return;
      }
      if (name === 'chip') {
        const p = (this._R && this._R.rows[Number(el.dataset.i)]) || null;
        if (p && ((p.act && p.act !== 'more') || tapOf(p))) runAct(this, p, el.dataset.ent);
        return;
      }
      return super.onAction(name, el, ev);
    }
    get styles() {
      return `
        /* Grunnstørrelse = HA-kortets 14 px; kortet er container → prosaen clamp(22px, 7,4cqi, 34px) / 1,55 (MySmartHome) */
        :host{display:flow-root;font-size:var(--ha-font-size-m, 14px);container-type:inline-size}
        ${M.PROSA_CSS}
        ${M.APPLIANCE_CSS || ''}
        .pick{vertical-align:baseline}
      `;
    }
  }
  M.define('msh-prosa-card', Prosa, 'MSH Hjem · prosa', 'Setninger med live verdier i bobler (vær, strømpris, effekt, lys …) og handling per boble.');
})();
