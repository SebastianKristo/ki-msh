/* msh-rom-card · Rom-popup (#<area_id>), alt under klima-toppkortet. Kilde: Rom v4.dc.html.
 * Seksjoner (rekkefølge/synlighet i config): rullegardin, scener, lys, enheter, klima, media, sensorer.
 * Autokonfig: sensor.<rom>_oversikt (KI Rom) → ellers HA-registre (område direkte / via enhet).
 * Tellertekster: sensor.<rom>_lys|_media|_brytere|_sensorer|_effekt (attributes.tekst) → ellers beregnet.
 * Overstyring: overrides {termostat, fuktighet}, exclude [ids], include {gardiner, scener, lys, enheter,
 * klima, media, sensorer}, light_types {<object_id>: dim|ct|color|onoff}, looks {<domene>: {<object_id>: {…}}}
 * (universal-rad, M.universal: mode, size, icon, main_text, sub_text, alt_text, symbol, background_color, text_color,
 * badge_condition/badge_color, bar_value/bar_color/bar_invert_colors, state_rule_1..3_*; legacy name/label/bg/cell/icon_color).
 * Enheter (16.5): universal small-rad (som Sensorer), hele raden = dom.toggle, hold = more-info. Hvitevare-profiler (PROF)
 * etter navn; looks.<dom>.<obj>.{profile, profile_color, active_text, run_threshold_w, profile_anim, animation}. Aktiv =
 * på og effekt > terskel (eller status-sensor) → profilfarge + rist/spinn/puls; appliance_animation Full/Rolig/Av.
 * Klima (16.8): klima_heat_w.<obj> (std 100 W) → rosa «varmer»-kort; vifter (liste «vifter», include.vifter) under
 * klimakortene med −/+; klima_order ['cards','fans'] + klima_hidden. Topplinjen = sum W.
 * Scener: KI Rom-lysscener (button.*, fra sensor med integrasjon ki_lys + ki_type oversikt, attributes.scener)
 * først, så rommets scene- og script-entiteter. include.scenes (alias include.scener), exclude, order.scenes [ids].
 * Lys (Fiks 41): felles lys-rad M.renderLightRow (08-light-row.js – Rom v4 «lights» 1:1, samme som Lys-popupen), 10 px
 * mellom radene. lights.<object_id> {brightness_min/max, hide_temperature_slider, hide_color_controls}. Eldre nøkler
 * (slider_height, color_control, hide_color_presets, color_presets, size, label_layout, show_…, slider_color_mode, bar-,
 * håndtak-, ikon- og pilfarger) godtas og ignoreres. Objekt-id som nøkkel fordi entity_id har punktum.
 */
(function () {
  const M = window.MSH, esc = M.esc, C = M.C;
  const PINK = C.accent;
  // 17.6: farger for på-enheter når flere er på (rosa → blå → lilla → oransje → grønn, så på nytt)
  const MULTI = ['linear-gradient(135deg, #f294c8, #f5cfd0)', 'var(--blue, rgb(115 185 242))', 'var(--purple, rgb(174 150 230))', 'var(--orange, rgb(242 181 115))', 'var(--green, rgb(102 209 158))'];
  // Fiks 34 (Del A) · tokens fra ki-theme (00-a-theme.js, definert bare i lys modus) med dagens mørke farge som fallback –
  // mørk modus er uendret. Grå TEKST følger regel 5 (MSH.theme.grayText); #7f7f7f-tekst bruker --ki-text-mid i lys (≥ 4,5:1).
  const G = { g200: 'var(--ki-surface, var(--gray200, #3a3a3a))', g300: 'var(--ki-surface-2, var(--gray300, #404040))', g400: 'var(--ki-ctrl, var(--gray400, #545454))', g500: 'var(--ki-text-lo, var(--gray500, #696969))', g600: 'var(--ki-text-mid, var(--gray600, #7f7f7f))', g700: 'var(--ki-text-mid, var(--gray700, #979797))', g800: 'var(--ki-text-2, var(--gray800, #afafaf))', g900: 'var(--ki-text-1, var(--gray900, #c7c7c7))', w: 'var(--ki-text, var(--white, #fafafa))' };
  const TH = M.theme || null;
  // Regel 4 · gjennomsiktig hvit (flate/kant) → svart i lys modus; mørk uendret
  const wa = (a) => (TH && TH.whiteA ? TH.whiteA(a) : `rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(${a}*var(--ki-wa-k,1)),var(--ki-wa-max,1)))`);
  const ON_ACC = 'var(--ki-on-accent, var(--gray000, #232323))';
  // 38: tekst/ikon på aksentflater i Enheter (Rom v4 devices: #1f1f1f)
  const DEV_ON_ACC = 'var(--ki-on-accent, #1f1f1f)';
  // Del 44 (Rom v4 sensors): tekst/ikon på aktiv sensor-pille (grønn eller annen aksent) – alltid mørk, aldri arvet/opacity
  const SENS_FG = 'var(--ki-on-accent, #1c2a22)';
  // 38: første egne tilstandsregel (1..3) som treffer → { bg } (samme regel som M.universal), ellers null
  const ruleHit = (o, st) => {
    for (let i = 1; i <= 3; i++) {
      const p = 'state_rule_' + i + '_', v = o[p + 'value'];
      const hit = v != null && String(v).trim() !== '' ? !!st && (Array.isArray(v) ? v.map(String) : String(v).split('|').map((x) => x.trim())).includes(String(st.state))
        : o[p + 'condition'] != null ? (M.uTruthy ? M.uTruthy(o[p + 'condition'], st) : !!o[p + 'condition']) : false;
      if (hit) return { bg: o[p + 'background_color'] };
    }
    return null;
  };

  // Seksjoner (design-rekkefølge; toppkortet er eget kort: msh-rom-klima-card)
  const SECS = [['curtain', 'Rullegardin', 'blinds'], ['scenes', 'Scener', 'auto_awesome'], ['lys', 'Lys', 'floor_lamp'], ['dev', 'Enheter', 'radio'], ['klima', 'Klima', 'thermostat'], ['media', 'Media', 'speaker'], ['sens', 'Sensorer', 'directions_walk']];
  // Lister (config.include-nøkler) → domener for «legg til»-søk
  const LISTS = [['gardiner', 'Rullegardin', ['cover']], ['scener', 'Scener', ['scene', 'script']], ['lys', 'Lys', ['light']], ['enheter', 'Enheter', ['switch', 'fan', 'input_boolean']], ['klima', 'Klima', ['climate']], ['vifter', 'Vifter', ['fan', 'switch', 'input_boolean']], ['media', 'Media', ['media_player']], ['sensorer', 'Sensorer', ['binary_sensor', 'sensor']]];
  // «Åpen ved start» (sammenleggbare seksjoner, i designets rekkefølge). curtain = Gardiner (utvidet liste når
  // rommet har flere gardiner, ui.cvOpen); de andre = akkordeonene (ui.acc). Toppkortet og Scener er alltid synlige.
  // Config per rom: sections_open.<id> (true/false) + sections_mode 'single'|'multi' (std multi). Leser også
  // prompt-/YAML-formen sections.<navn>.open_on_start når sections er et objekt (ellers er sections rekkefølgen).
  // Global standard: ki-store room_defaults.open_on_start [ids] («Tilpass Hjem» → Popups). Rom-config overstyrer.
  // Uten noe valgt: alle lukket, unntatt Lys når rommet har lys. Ingenting av dette lagres i localStorage.
  const FOLD = [['lys', 'Lys'], ['curtain', 'Gardiner'], ['klima', 'Klima'], ['dev', 'Enheter'], ['sens', 'Sensorer'], ['media', 'Medier']];
  const FOLD_ALIAS = { lys: 'lys', curtain: 'curtain', gardiner: 'curtain', rullegardin: 'curtain', klima: 'klima', dev: 'dev', enheter: 'dev', sens: 'sens', sensorer: 'sens', media: 'media', medier: 'media' };
  M.ROOM_FOLD = FOLD;
  M.roomOpenDefaults = function () {
    const g = M.store && M.store.get ? M.store.get('room_defaults') : null;
    const l = g && Array.isArray(g.open_on_start) ? g.open_on_start : null;
    return l ? l.map((k) => FOLD_ALIAS[k]).filter(Boolean) : null;
  };
  // Startverdi for én seksjon (uten single-modus). hasLys = rommet har lys.
  const openDefault = (c, k, hasLys) => {
    const own = c.sections_open && typeof c.sections_open === 'object' ? c.sections_open : {};
    if (own[k] != null) return !!own[k];
    const obj = c.sections && typeof c.sections === 'object' && !Array.isArray(c.sections) ? c.sections : null;
    if (obj) { const a = Object.keys(obj).find((x) => FOLD_ALIAS[x] === k && obj[x] && obj[x].open_on_start != null); if (a) return !!obj[a].open_on_start; }
    const g = M.roomOpenDefaults();
    return g ? g.includes(k) : k === 'lys' && !!hasLys;
  };
  const LT_NAMES = [['', 'Auto'], ['dim', 'Dimbar'], ['ct', 'Dimbar + temperatur'], ['color', 'Dimbar + farge'], ['onoff', 'Kun av/på']];

  // Apparatprofiler (fra designet): navn → ikon, farge, verb, terskel (W), animasjon
  const PROF = [
    [/br(ø|o)drister|toaster/, 'breakfast_dining', 'red', 'Rister', 10, 'rist', 'Brødrister'],
    [/kaffe/, 'coffee_maker', 'orange', 'Trakter kaffe', 10, 'puls', 'Kaffetrakter'],
    [/vannkoker|kettle/, 'emoji_food_beverage', 'blue', 'Koker vann', 10, 'rist', 'Vannkoker'],
    [/kj(ø|o)leskap|fridge/, 'kitchen', 'blue', 'Kjøler', 30, 'puls', 'Kjøleskap'],
    [/fryse/, 'severe_cold', 'blue', 'Fryser', 30, 'puls', 'Fryseskap'],
    [/t(ø|o)rketrommel|dryer/, 'dry_cleaning', 'purple', 'Tørker', 10, 'spinn', 'Tørketrommel'],
    [/vaskemaskin|washer/, 'local_laundry_service', 'blue', 'Vasker', 10, 'spinn', 'Vaskemaskin'],
    [/oppvask|dishwasher/, 'dishwasher_gen', 'green', 'Vasker opp', 10, 'puls', 'Oppvaskmaskin'],
    [/mikro/, 'microwave', 'orange', 'Varmer', 10, 'puls', 'Mikrobølgeovn'],
    [/platetopp|induksjon|cooktop/, 'mdi:pot-steam', 'red', 'Koker', 10, 'puls', 'Platetopp'],
    [/komfyr|stekeovn|ovn\b|oven/, 'mdi:stove', 'orange', 'Steker', 10, 'puls', 'Komfyr'],
    [/h(å|a)ndkle|towel/, 'heat', 'orange', 'Varmer håndklær', 10, 'puls', 'Håndklevarmer'],
    [/varmtvann|bereder|\bvvb\b/, 'shower', 'orange', 'Varmer vann', 50, 'puls', 'Varmtvannsbereder'],
  ];
  const profRow = (p) => ({ icon: p[1], col: C[p[2]], verb: p[3], thr: p[4], anim: p[5], name: p[6] });
  const profOf = (txt) => { const n = String(txt || '').toLowerCase(); const p = PROF.find((x) => x[0].test(n)); return p ? profRow(p) : null; };
  // Profil per enhet (16.5): looks.<id>.profile ('' = etter navn, 'none' = ingen, ellers profilnavnet) + egne felt
  // profile_color / active_text / run_threshold_w / profile_anim ('rist'|'spinn'|'puls'|'none').
  const profFor = (txt, lk) => {
    const k = lk && lk.profile;
    let P = k === 'none' ? null : k ? (PROF.find((x) => x[6] === k) ? profRow(PROF.find((x) => x[6] === k)) : null) : profOf(txt);
    if (!P && (lk && (lk.profile_color || lk.active_text))) P = { icon: null, col: null, verb: 'På', thr: 10, anim: 'puls' };
    if (!P) return null;
    return { ...P, col: lk && lk.profile_color ? M.color(lk.profile_color) : P.col, verb: (lk && lk.active_text) || P.verb, anim: lk && lk.profile_anim ? lk.profile_anim : P.anim };
  };
  const PROF_OPTS = [['', 'Auto (etter navn)'], ['none', 'Ingen'], ...PROF.map((p) => [p[6], p[6]])];
  const ANIM_KIND = [['', 'Auto (profil)'], ['rist', 'Rist'], ['spinn', 'Spinn'], ['puls', 'Puls'], ['none', 'Ingen']];
  // Vifter (16.8): fan.* + switch/input_boolean med «vifte»/«fan» i navnet
  const FAN_RX = /vifte|\bfan\b/;
  const fanLike = (hass, id) => id.startsWith('fan.') || FAN_RX.test((obj(id).replace(/_/g, ' ') + ' ' + ((hass.states[id] && hass.states[id].attributes.friendly_name) || '')).toLowerCase());
  const ANIM_LV = [['full', 'Full'], ['calm', 'Rolig'], ['off', 'Av']];
  const ANIM = { spinn: '1.6s linear', rist: '.5s ease-in-out', puls: '1.4s ease-in-out' };
  const DEV_ICON = [[/\btv\b|fjernsyn/, 'tv'], [/server|rack|nas\b/, 'dns'], [/stikk|plugg|outlet/, 'outlet'], [/\bpc\b|data|computer/, 'desktop_windows'], [/skjerm|monitor/, 'monitor'], [/piano/, 'piano'], [/peis/, 'fireplace'], [/lader|charger/, 'mdi:battery-charging'], [/luftrens|avfukt/, 'air'], [/varmekabel|gulvvarme/, 'heat'], [/julelys/, 'star']];
  const SCENE_ICON = [[/maks|max|full/, 'light_mode'], [/komfort|kos|hygge/, 'weekend'], [/middag|spise|mat/, 'restaurant'], [/\btv\b|film|kino/, 'tv'], [/demp|dim/, 'brightness_4'], [/alt av|\bav\b|natt|sov/, 'dark_mode'], [/morgen|våkn/, 'wb_twilight'], [/les/, 'library_books'], [/fest|party/, 'music_note']];
  // Binærsensorer: [på-tekst, av-tekst]; aktive (grønne) = på
  const BS = { motion: ['Bevegelse', 'Stille'], occupancy: ['Noen her', 'Stille'], presence: ['Noen her', 'Stille'], door: ['Åpen', 'Lukket'], garage_door: ['Åpen', 'Lukket'], window: ['Åpent', 'Lukket'], opening: ['Åpen', 'Lukket'], moisture: ['Vått', 'Tørt'], smoke: ['Røyk', 'OK'], gas: ['Gass', 'OK'], carbon_monoxide: ['CO', 'OK'], vibration: ['Vibrerer', 'Stille'], sound: ['Lyd', 'Stille'], light: ['Lys', 'Mørkt'], lock: ['Ulåst', 'Låst'], problem: ['Problem', 'OK'], safety: ['Usikker', 'Trygg'], tamper: ['Tukling', 'OK'], cold: ['Kaldt', 'Normal'], heat: ['Varmt', 'Normal'], running: ['Kjører', 'Stoppet'], battery: ['Lavt', 'OK'], connectivity: ['Tilkoblet', 'Frakoblet'], plug: ['Tilkoblet', 'Frakoblet'], power: ['Strøm', 'Ingen strøm'] };
  const CALM = ['connectivity', 'plug', 'power', 'running'];
  const SENS_ICON = { motion: 'directions_walk', occupancy: 'sensor_occupied', presence: 'sensor_occupied', door: 'door_front', garage_door: 'garage', window: 'window', opening: 'door_front', moisture: 'water_damage', smoke: 'detector_smoke', gas: 'mdi:gas-cylinder', carbon_monoxide: 'co2', illuminance: 'light_mode', humidity: 'humidity_percentage', temperature: 'thermometer', vibration: 'mdi:vibrate', sound: 'graphic_eq', lock: 'lock', battery: 'battery_full', carbon_dioxide: 'co2', power: 'bolt' };

  // 33.6 · padT (Rom v4.dc.html): lagret verdi −4 = 0 px fra Bubble-headeren til toppkortet (vist verdi = lagret + 4).
  // Standard −4 (0 px); forvalg Standard 0 · Litt 10 · Luftig 24 · Ekstra 48. Brukerens egen pad_top overstyrer.
  const PAD_T_OFF = 4;
  const SPACING = { gap: 8, pad_top: -4, pad_bottom: 150 };
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const obj = (id) => String(id).split('.').slice(1).join('.');

  /* ---------------------------------------------------------------- autokonfig */
  // Strøm-sensor for en enhet: samme HA-enhet (device_id) → ellers sensor i rommet som starter med objekt-id-en.
  M.powerOf = M.powerOf || function (hass, id, area) {
    const E = (hass && hass.entities) || {}, e = E[id];
    const isP = (sid) => { const s = hass.states[sid]; return s && sid.startsWith('sensor.') && s.attributes.device_class === 'power'; };
    if (e && e.device_id) { const hit = Object.keys(E).find((k) => k !== id && E[k].device_id === e.device_id && isP(k)); if (hit) return hit; }
    const o = obj(id);
    return Object.keys(hass.states).find((k) => isP(k) && obj(k).startsWith(o + '_') && (!area || M.areaOf(hass, k) === area || M.areaOf(hass, k) === null)) || null;
  };
  // Alle lister for et rom. auto = det autokonfig fant; lists = etter exclude/include/overrides.
  M.roomLists = M.roomLists || function (hass, area, cfg) {
    cfg = cfg || {};
    const out = { area, ov: null, auto: {}, lists: {}, eff: {}, cls: {}, sceneMeta: {} };
    if (!hass || !area) { LISTS.forEach(([k]) => { out.auto[k] = []; out.lists[k] = []; }); return out; }
    // Fiks 36.3 · kombinert rom (area = kombinasjonens id): autokonfig per rom som før → union i rommenes rekkefølge.
    // roomOf[entitet] = rommet den kom fra (romtagg / grupper per rom). overrides/exclude/include gjelder kombinasjonen.
    const CB = !(hass.areas && hass.areas[area]) && M.combinedOfCard ? M.combinedOfCard(hass, { ...cfg, area }) : null;
    if (CB) {
      out.roomOf = {}; out.combined = CB;
      CB.rooms.forEach((r) => {
        const L = M.roomLists(hass, r, {});
        LISTS.forEach(([k]) => { const t = out.auto[k] || (out.auto[k] = []); (L.auto[k] || []).forEach((id) => { if (!t.includes(id)) t.push(id); if (!out.roomOf[id]) out.roomOf[id] = r; }); });
        Object.keys(L.sceneMeta || {}).forEach((k) => { if (!out.sceneMeta[k]) out.sceneMeta[k] = L.sceneMeta[k]; });
        Object.keys(L.eff || {}).forEach((k) => { if (!out.eff[k]) out.eff[k] = L.eff[k]; });
        Object.keys(L.cls || {}).forEach((k) => { if (!out.cls[k]) out.cls[k] = L.cls[k]; });
      });
    }
    if (!CB) {
    const ov = M.kiRom(hass, area, 'oversikt'), A = (ov && ov.attributes) || {};
    out.ov = ov;
    const has = (...ks) => !!ov && ks.some((k) => Array.isArray(A[k]));
    const reg = (d, f) => M.all(hass, d, (s, id) => M.areaOf(hass, id) === area && (!f || f(s, id)));
    const objs = (arr) => (Array.isArray(arr) ? arr : []).map((x) => (typeof x === 'string' ? { entity: x } : x || {})).filter((x) => x.entity);
    const a = out.auto;
    a.gardiner = has('gardiner') ? M.ids(A.gardiner) : reg('cover');
    // Scener: KI Rom-lysscenene (button.*) først, så rommets egne scene.* / script.* (unntatt de som
    // allerede er med – samme entitet eller samme navn som en lysscene).
    const ls = M.roomLightScenes(hass, area);
    out.sceneMeta = ls.meta;
    const kiSc = has('scener', 'skript') ? [...M.ids(A.scener), ...M.ids(A.skript)].filter((id) => /^(scene|script)\./.test(id) && hass.states[id]) : [];
    const own = (kiSc.length ? kiSc : reg(['scene', 'script'])).sort((x, y) => (x.startsWith('scene.') ? 0 : 1) - (y.startsWith('scene.') ? 0 : 1));
    const norm = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9æøå]/g, '');
    const areaNm = M.areaName(hass, area);
    const used = new Set(ls.ids.map((id) => norm(ls.meta[id].navn)));
    a.scener = [...ls.ids, ...own.filter((id) => !ls.ids.includes(id) && !used.has(norm(M.name(hass, id, areaNm))))];
    a.lys = has('lys') ? M.ids(A.lys) : reg('light');
    // Vifter (16.8) vises i Klima-seksjonen, ikke i Enheter
    const effOf = (x) => { if (x.effekt) out.eff[x.entity] = typeof x.effekt === 'string' ? x.effekt : M.ids([x.effekt])[0]; };
    if (has('brytere', 'vifter')) {
      const d = objs(A.brytere), v = objs(A.vifter);
      a.enheter = d.map((x) => x.entity).filter((id) => !id.startsWith('fan.'));
      a.vifter = [...v.map((x) => x.entity), ...d.map((x) => x.entity).filter((id) => id.startsWith('fan.'))];
      [...d, ...v].forEach(effOf);
    } else {
      a.vifter = [...reg('fan'), ...reg(['switch', 'input_boolean'], (st, id) => fanLike(hass, id))];
      a.enheter = reg('switch').filter((id) => !a.vifter.includes(id));
    }
    if (has('klima')) { const k = objs(A.klima); a.klima = k.map((x) => x.entity); k.forEach((x) => { if (x.effekt) out.eff[x.entity] = x.effekt; }); } else a.klima = reg('climate');
    a.media = has('media') ? M.ids(A.media) : reg('media_player');
    if (has('sensorer', 'lysniva')) {
      const s = objs(A.sensorer);
      a.sensorer = s.map((x) => x.entity);
      s.forEach((x) => { if (x.klasse) out.cls[x.entity] = x.klasse; });
      M.ids(A.lysniva).forEach((id) => { if (!a.sensorer.includes(id)) { a.sensorer.push(id); out.cls[id] = 'illuminance'; } });
    } else a.sensorer = [...reg('binary_sensor'), ...reg('sensor', (s) => s.attributes.device_class === 'illuminance')];
    }
    LISTS.forEach(([k]) => { out.lists[k] = M.applyLists(cfg, k, out.auto[k] || []); });
    // Scener: include.scenes (alias for include.scener) + order.scenes (sortering fra «Tilpass rom»)
    (((cfg.include || {}).scenes) || []).forEach((id) => { if (!out.lists.scener.includes(id) && !((cfg.exclude || []).includes(id))) out.lists.scener.push(id); });
    const so = (cfg.order && Array.isArray(cfg.order.scenes)) ? cfg.order.scenes : null;
    if (so) { const ix = (id) => { const i = so.indexOf(id); return i < 0 ? 1e6 : i; }; const base = out.lists.scener.slice(); out.lists.scener.sort((x, y) => ix(x) - ix(y) || base.indexOf(x) - base.indexOf(y)); }
    const th = cfg.overrides && (cfg.overrides.climate || cfg.overrides.termostat);
    if (th) out.lists.klima = [th, ...out.lists.klima.filter((x) => x !== th)];
    (((cfg.include || {}).climate) || []).forEach((id) => { if (!out.lists.klima.includes(id)) out.lists.klima.push(id); });
    [...out.lists.enheter, ...out.lists.vifter, ...out.lists.klima].forEach((id) => { if (!out.eff[id] && !id.startsWith('climate.')) { const p = M.powerOf(hass, id, area); if (p) out.eff[id] = p; } });
    // Termostater (16.8): bare sensor.<objekt-id>_power/_effekt eller strømsensor på samme HA-enhet (ikke prefiks-treff,
    // «stue_» ville truffet alle strømsensorene i stua)
    out.lists.klima.forEach((id) => {
      if (out.eff[id]) return;
      const E = hass.entities || {}, e = E[id];
      const hit = ['_power', '_effekt'].map((x) => 'sensor.' + obj(id) + x).find((k) => hass.states[k])
        || (e && e.device_id ? Object.keys(E).find((k) => k !== id && E[k].device_id === e.device_id && k.startsWith('sensor.') && hass.states[k] && hass.states[k].attributes.device_class === 'power') : null);
      if (hit) out.eff[id] = hit;
    });
    // 19.21: overstyrt effektsensor per enhet (effAuto = det autokonfig fant, for summen)
    out.effAuto = { ...out.eff };
    [...out.lists.enheter, ...out.lists.vifter].forEach((id) => { const o = M.roomDevOv(cfg, id); if (o.power === 'none') delete out.eff[id]; else if (o.power) out.eff[id] = o.power; });
    return out;
  };
  // KI Rom-lysscener for et rom (button.*). Kilde: sensor med integrasjon ki_lys + ki_type oversikt og
  // area_id = rommet (eller area_ids inneholder rommet) → attributes.scener [{id, navn, ikon, rekkefolge, entity}]
  // (allerede sortert). Fallback: alle button.* med ki_type scene og area_id = rommet.
  // → { ids: [button.…], meta: {id: {navn, ikon}} }. Knapper som ikke finnes i hass.states hoppes over.
  const LYS_ORDER = ['maks', 'komfort', 'middag', 'tv', 'mindre', 'natt', 'av'];
  M.roomLightScenes = M.roomLightScenes || function (hass, area) {
    const out = { ids: [], meta: {} };
    if (!hass || !area) return out;
    const S = hass.states;
    let ov = null, ovZone = null;
    for (const id in S) {
      if (!id.startsWith('sensor.')) continue;
      const a = S[id].attributes || {};
      if (a.integrasjon !== 'ki_lys' || a.ki_type !== 'oversikt') continue;
      if (a.area_id === area) { ov = S[id]; break; }
      if (!ovZone && Array.isArray(a.area_ids) && a.area_ids.includes(area)) ovZone = S[id];
    }
    ov = ov || ovZone;
    const areaNm = M.areaName(hass, area);
    const strip = (t) => { const r = new RegExp('^' + String(areaNm).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s+', 'i'); return String(t || '').replace(r, '') || t; };
    if (ov && Array.isArray(ov.attributes.scener) && ov.attributes.scener.length) {
      ov.attributes.scener.forEach((sc) => {
        const id = sc && (sc.entity || (sc.id && ov.attributes.slug ? `button.${ov.attributes.slug}_lys_${sc.id}` : null));
        if (!id || !S[id] || out.meta[id]) return;
        out.ids.push(id);
        out.meta[id] = { navn: sc.navn || strip(S[id].attributes.friendly_name) || sc.id, ikon: sc.ikon || S[id].attributes.icon || null, ki: true };
      });
      return out;
    }
    const btn = Object.keys(S).filter((id) => { const a = id.startsWith('button.') && S[id].attributes; return a && a.ki_type === 'scene' && (a.area_id === area); });
    const rank = (id) => { const i = LYS_ORDER.indexOf(S[id].attributes.scene); return i < 0 ? 99 : i; };
    btn.sort((x, y) => rank(x) - rank(y) || x.localeCompare(y));
    btn.forEach((id) => { out.ids.push(id); out.meta[id] = { navn: strip(S[id].attributes.friendly_name) || S[id].attributes.scene || id, ikon: S[id].attributes.icon || null, ki: true }; });
    return out;
  };
  // Lystype fra supported_color_modes – samme som den felles lys-raden (08-light-row.js)
  const autoLightType = (s) => M.lightType(s);
  // Tekst-mal: {state} {w} {name} eller [[[ return … ]]] (som i designets «Utseende på kort»)
  const tpl = (v, ctx) => {
    if (v == null || String(v).trim() === '') return null;
    const t = String(v).trim();
    if (t.indexOf('[[[') === 0 && t.slice(-3) === ']]]') {
      try { const r = new Function('state', 'entity', 'w', 'name', t.slice(3, -3))(ctx.state, ctx.entity, ctx.w, ctx.name); return r == null ? null : String(r); } catch (e) { return '⚠ feil i kode'; }
    }
    return t.replace(/\{(\w+)\}/g, (m, k) => (ctx[k] != null ? ctx[k] : m));
  };
  // 19.21: på/av og tekst for en enhet med overstyring (overrides.<id>: power, threshold_w, on_text, off_text).
  // null = ingen overstyring (flisen bruker standardlogikken). w = watt fra valgt/auto sensor (null = ingen).
  // På = bryteren er på og (uten effektsensor, eller effekt over terskelen, standard 5 W).
  const devOv = (hass, cfg, id, w, nm) => {
    const O = M.roomDevOv(cfg, id);
    if (!['power', 'threshold_w', 'on_text', 'off_text'].some((k) => O[k] != null && O[k] !== '')) return null;
    const s = hass && hass.states[id], thr = O.threshold_w != null && O.threshold_w !== '' ? Number(O.threshold_w) : 5;
    const on = M.isOn(s) && (w == null || w > thr);
    const ctx = { state: on ? 'på' : 'av', on, w: w != null ? M.nf(w) : 0, name: nm, entity: s };
    const own = on ? O.on_text : O.off_text;
    return { on, w, thr, own: own != null && own !== '', text: tpl(own || (on ? (w != null ? 'På · {w} W' : 'På') : 'Av'), ctx) };
  };
  // 19.16: TV-regel (som mini-spilleren 19.15): device_class tv, valgt som TV i Media (players.<obj>.type), eller
  // remote.* på samme HA-enhet. Media-configen: live msh-media-card, ellers ki-store cards.pop-media.
  M.mediaCardCfg = M.mediaCardCfg || function () {
    const c = M.liveOf && M.liveOf('msh-media-card');
    return (c && c.config) || (M.store && (M.store.eff ? M.store.eff('cards.pop-media') : M.store.get('cards.pop-media'))) || {};
  };
  M.isTvPlayer = M.isTvPlayer || function (hass, id) {
    const s = hass && hass.states[id];
    if (!s) return false;
    const pc = ((M.mediaCardCfg().players) || {})[obj(id)] || {};
    if (pc.type === 'tv') return true;
    if (pc.type === 'musikk') return false;
    if (s.attributes.device_class === 'tv') return true;
    const e = M.regEntry(hass, id), dev = e && e.device_id;
    return !!dev && Object.keys(hass.states).some((x) => x.startsWith('remote.') && (M.regEntry(hass, x) || {}).device_id === dev);
  };
  // Ett volumtrinn med samme tjeneste som «Volum styres av» i Media (19.4): knapp-entitetene når players.<obj>.volume
  // = buttons (button/input_button.press, script/switch/…turn_on), ellers media_player.volume_up/down.
  M.tvVolStep = M.tvVolStep || function (hass, id, dir) {
    const pc = ((M.mediaCardCfg().players) || {})[obj(id)] || {}, ent = pc.volume === 'buttons' ? pc[dir > 0 ? 'volume_up' : 'volume_down'] : null;
    if (ent) {
      const d = ent.split('.')[0];
      const svc = d === 'button' || d === 'input_button' ? 'press' : ['script', 'scene', 'switch', 'light', 'input_boolean'].includes(d) ? 'turn_on' : null;
      return svc ? M.call(hass, d, svc, { entity_id: ent }) : M.call(hass, 'homeassistant', 'turn_on', { entity_id: ent });
    }
    return M.call(hass, 'media_player', dir > 0 ? 'volume_up' : 'volume_down', { entity_id: id });
  };
  // 19.21: effektsensor per enhet. overrides.<domene>.<objekt-id> (editor-stien) eller overrides['<entity_id>'] (YAML):
  // { power: 'sensor.x' | 'none', threshold_w, on_text, off_text }. Tomt = automatisk.
  M.roomDevOv = M.roomDevOv || function (cfg, id) {
    const ov = (cfg && cfg.overrides) || {}, d = id.split('.')[0];
    const a = ov[id] && typeof ov[id] === 'object' ? ov[id] : {}, b = ov[d] && typeof ov[d] === 'object' ? ov[d][obj(id)] : null;
    return { ...a, ...(b && typeof b === 'object' ? b : {}) };
  };
  // Korreksjon av romsummen (KI Rom sensor.<rom>_effekt) når enheter har egen effektsensor: Σ (valgt − automatisk).
  M.roomPowerDelta = M.roomPowerDelta || function (hass, area, cfg) {
    if (!hass || !area || !cfg || !cfg.overrides || !Object.values(cfg.overrides).some((v) => v && typeof v === 'object')) return 0;
    const L = M.roomLists(hass, area, cfg), n = (x) => { const s = x && hass.states[x]; const v = s ? parseFloat(s.state) : NaN; return isNaN(v) ? 0 : v; };
    let d = 0;
    [...L.lists.enheter, ...L.lists.vifter].forEach((id) => { const o = M.roomDevOv(cfg, id); if (o.power) d += (o.power === 'none' ? 0 : n(o.power)) - n(L.effAuto[id]); });
    return d;
  };
  // Åpne rom-tilpasningen fra andre kort (f.eks. tannhjulet i klima-toppkortet): M.roomCustomize('stue')
  M.roomCustomize = M.roomCustomize || function (area, section) {
    const detail = { area, section, handled: false };
    window.dispatchEvent(new CustomEvent('msh-rom-customize', { detail }));
    return detail.handled;
  };

  /* ---------------------------------------------------------------- skjema (felles editor) */
  // Standard for alle romkort («Tilpass Hjem» → Kort, lagret i msh-hjem-faner-card) – vises som valgt når rommet ikke har egen verdi.
  const hjemDef = (k, d) => {
    const f = M.liveOf && M.liveOf('msh-hjem-faner-card');
    const c = (f && f.config) || (M.store && M.CARD_IDS && (M.store.eff ? M.store.eff('cards.' + M.CARD_IDS.faner) : M.store.get('cards.' + M.CARD_IDS.faner))) || {};
    return c[k] || d;
  };
  function buildSchema(area0) {
    return (h, c) => {
      c = c || {};
      const area = c.area || area0;
      const L = h && area ? M.roomLists(h, area, c) : null;
      const CBs = L && L.combined; // 36.4: kombinert rom → rom, primær og layout (samme som «Tilpass Hjem» → Kombiner rom)
      const out = [
        ...(CBs && M.combinedField ? [{ type: 'section', id: 'kombinert', label: 'Kombinert rom', icon: 'mdi:vector-combine', open: true, meta: () => CBs.rooms.map((r) => M.areaName(h, r)).join(' · '), fields: [M.combinedField('rom')] }] : []),
        { type: 'section', id: 'spacing', label: 'Mellomrom', icon: 'mdi:arrow-expand-vertical', meta: (hh, cc) => `${cc.gap != null ? cc.gap : 8} px mellom`, fields: [
          { type: 'range', name: 'gap', label: 'Mellom seksjonene', icon: 'mdi:arrow-split-horizontal', min: 0, max: 24, default: 8, presets: [[4, 'Tett 4'], [8, 'Standard 8'], [18, 'Luftig 18']] },
          { type: 'range', name: 'pad_top', label: 'Fra popup-headeren til første kort', icon: 'mdi:format-vertical-align-top', min: -20, max: 116, default: SPACING.pad_top, offset: PAD_T_OFF, presets: [[-4, 'Standard 0'], [6, 'Litt 10'], [20, 'Luftig 24'], [44, 'Ekstra 48']] },
          { type: 'range', name: 'pad_bottom', label: 'Luft i bunnen', icon: 'mdi:format-vertical-align-bottom', min: 0, max: 300, default: SPACING.pad_bottom, presets: [[0, 'Ingen 0'], [60, 'Litt 60'], [150, 'Standard 150'], [300, 'Maks 300']] },
        ] },
        { type: 'section', id: 'look', label: 'Utseende', icon: 'mdi:palette', meta: (hh, cc) => (cc.look && cc.look.col ? '' : 'Standardfarge'), fields: [
          { type: 'color', name: 'look.col', label: 'Romfarge', help: 'Brukes i romkortet og ikon-sirkelen i popup-headeren' },
          { type: 'select', name: 'icon_color_mode', label: 'Ikonfarge på romkortet (Hjem)', options: M.ICON_MODES || [], default: hjemDef('icon_color_mode', 'lights'), help: 'Ikke valgt = standard fra «Tilpass Hjem» → Kort' },
          { type: 'icon', name: 'look.icon', label: 'Rom-ikon', auto: (hh, cc) => { const ar = cc.area || area0; return ar && hh && hh.areas && hh.areas[ar] ? hh.areas[ar].icon : null; } },
        ] },
        { type: 'section', id: 'actions', label: 'Handlinger', icon: 'mdi:gesture-tap', meta: (hh, cc) => ((M.ICON_TAPS || []).find((o) => o[0] === (cc.icon_tap || hjemDef('icon_tap', 'toggle_lights'))) || [])[1] || '', fields: [
          { type: 'select', name: 'icon_tap', label: 'Trykk på ikonet (romkortet på Hjem)', options: M.ICON_TAPS || [], default: hjemDef('icon_tap', 'toggle_lights'), help: 'Termostat-knappene påvirkes ikke. Ikke valgt = standard fra «Tilpass Hjem» → Kort' },
        ] },
        ...(area0 ? [] : [{ type: 'area', name: 'area', label: 'Rom (område)', help: 'Tomt = hentes fra popupens hash (#stue → stue)' }]),
        { type: 'section', id: 'klima', label: 'Klima', icon: 'mdi:thermostat', meta: (hh, cc) => { const ar = cc.area || area0; const rc = ar && hh ? M.roomClimate(hh, ar, cc) : null; return rc && rc.climate ? M.name(hh, rc.climate) : 'Automatisk'; }, fields: [
          { type: 'entity', name: 'overrides.climate', label: 'Termostat', domain: 'climate', area: (hh, cc) => cc.area || area0, auto: (hh, cc) => { const ar = cc.area || area0; return ar ? M.roomAuto(hh, ar).thermo : null; } },
          { type: 'entity', name: 'overrides.temperature', label: 'Temperatursensor', domain: 'sensor', device_class: 'temperature', area: (hh, cc) => cc.area || area0, auto: (hh, cc) => { const ar = cc.area || area0; if (!ar) return null; const a = M.roomAuto(hh, ar); return a.temp ? a.temp + (a.tempFallback ? ' (hus)' : '') : (a.tempVal != null ? `KI Rom · ${M.nf(a.tempVal, 1)}°` : null); } },
          { type: 'entity', name: 'overrides.humidity', label: 'Fuktsensor', domain: 'sensor', device_class: 'humidity', area: (hh, cc) => cc.area || area0, auto: (hh, cc) => { const ar = cc.area || area0; if (!ar) return null; const a = M.roomAuto(hh, ar); return a.hum ? a.hum + (a.humFallback ? ' (hus)' : '') : (a.humVal != null ? `KI Rom · ${M.nf(a.humVal, 0)} %` : null); } },
          { type: 'entities', name: 'include.climate', label: 'Ekstra termostater', domain: 'climate', addLabel: '+ Legg til termostat', area: (hh, cc) => cc.area || area0 },
          // 16.8: «varmer»-terskel per termostat (effekt over denne = rosa kort), og vifter under klimakortene
          ...(L ? L.lists.klima.map((id) => ({ type: 'number', name: 'klima_heat_w.' + obj(id), label: `${cap(M.name(h, id, M.areaName(h, area)))} · varmer over (W)`, min: 0, max: 5000, placeholder: '100', help: 'Rosa «varmer»-kort når hvac_action er heating eller effekten er over dette' })) : []),
          { type: 'entities', name: 'include.vifter', label: 'Ekstra vifter', domains: ['fan', 'switch', 'input_boolean'], addLabel: '+ Legg til vifte', area: (hh, cc) => cc.area || area0, help: 'Auto: fan.* i rommet + brytere med «vifte»/«fan» i navnet. Skjul under «Entiteter per seksjon» → Vifter' },
          { type: 'color', name: 'graph_t', label: 'Toppkort · graf temperatur', auto: () => 'var(--red, #f28073)', help: 'Tomt = rød (standard)' },
          { type: 'color', name: 'graph_h', label: 'Toppkort · graf fukt', auto: () => 'var(--blue, #73b9f2)' },
          { type: 'select', name: 'graph_fill', label: 'Toppkort · fyll', options: [[0, 'Av'], [0.2, 'Svak'], [0.4, 'Sterk']], default: 0.2 },
          { type: 'select', name: 'graph_width', label: 'Toppkort · linje', options: [[1.5, 'Tynn'], [2, 'Normal'], [3, 'Tykk']], default: 2 },
          { type: 'boolean', name: 'header_icon', label: 'Rommets ikon i popup-headeren', default: true },
          { type: 'color', name: 'klima_bg', label: 'Klima-kort · bakgrunn', auto: () => '#2a2a2a' },
          { type: 'color', name: 'klima_ring', label: 'Klima-kort · knappfarge', auto: () => 'rgb(255 255 255 / 0.22)' },
          { type: 'select', name: 'klima_btn', label: 'Klima-kort · knapp', options: [['outline', 'Kontur'], ['fill', 'Fylt']], default: 'outline' },
          { type: 'boolean', name: 'klima_mode', label: 'Farg etter modus', help: 'Rød ved oppvarming, blå ved kjøling' },
        ] },
        { type: 'order', name: 'sections', hiddenName: 'hidden_sections', label: 'Seksjoner', options: SECS.map((s) => [s[0], s[1]]),
          // «Åpen ved start» per sammenleggbar seksjon (bryter i raden) + «Én seksjon åpen om gangen» nederst
          openName: 'sections_open', openKeys: FOLD.map((x) => x[0]), openDefault: (cc, k) => openDefault(cc || {}, k, !!(L && L.lists.lys.length)),
          after: [{ type: 'boolean', name: 'sections_mode', label: 'Én seksjon åpen om gangen', on: 'single', off: 'multi', help: 'Åpner du én seksjon, lukkes de andre. Skjulte seksjoner ignorerer «Åpen ved start».' }] },
        { type: 'order', name: 'klima_order', hiddenName: 'klima_hidden', label: 'Klima-seksjonen', options: [['cards', 'Klimakort'], ['fans', 'Vifter']] },
      ];
      if (L) {
        // Scener: KI Rom-lysscenene først, så rommets scene.*/script.*. Skjul = exclude, sortering = order.scenes,
        // legg til = include.scenes.
        const all = [...new Set([...(L.auto.scener || []), ...(((c.include || {}).scener) || []), ...(((c.include || {}).scenes) || [])])];
        const nmSc = (id) => { const m = L.sceneMeta[id]; return (m && m.navn) || cap(M.name(h, id, M.areaName(h, area))); };
        out.push({ type: 'section', id: 'scenes', label: 'Scener', icon: 'mdi:palette', meta: () => `${L.lists.scener.length} av ${all.length} vises`, fields: [
          { type: 'info', label: 'KI Rom-lysscenene (knapper) først, deretter rommets egne scener og skript. Øye = skjul, piler = rekkefølge.' },
          ...(all.length ? [{ type: 'order', flat: true, name: 'order.scenes', hiddenName: 'exclude', label: 'Rekkefølge og synlighet', options: all.map((id) => [id, `${nmSc(id)}${L.sceneMeta[id] ? ' · KI Rom' : id.startsWith('script.') ? ' · skript' : ' · scene'}`]) }] : [{ type: 'info', label: 'Fant ingen scener i rommet' }]),
          { type: 'entities', name: 'include.scenes', label: 'Lagt til', domains: ['button', 'scene', 'script'], addLabel: '+ Legg til scene', area: () => area },
        ] });
      }
      if (L && L.lists.lys.length) {
        // Felles lys-rad (08-light-row.js, Fiks 41): samme utseende for alle lys (Rom v4) – bare type og funksjon per lys
        out.push({ type: 'section', id: 'lys', label: 'Lys', icon: 'mdi:lightbulb', meta: () => `${L.lists.lys.length} lys`, fields: [
          { type: 'info', label: 'Per lys (lagres under lights.<objekt-id>, f.eks. lights.stue_tak). Tomt = auto. «Kun av/på» tvinger en dimbar lampe til bryter. Temperatur/farge (pil til høyre) vises bare for lys som støtter det.' },
          ...L.lists.lys.map((id) => {
            const p = 'lights.' + obj(id), st = h.states[id];
            return { type: 'section', label: cap(M.name(h, id, M.areaName(h, area))), icon: 'mdi:lightbulb', meta: () => (LT_NAMES.find((x) => x[0] === (((c.light_types || {})[obj(id)]) || autoLightType(st))) || [])[1] || '', fields: [
              { type: 'select', name: 'light_types.' + obj(id), label: 'Type', help: 'Auto: ' + (LT_NAMES.find((x) => x[0] === autoLightType(st)) || [])[1], options: LT_NAMES },
              { type: 'number', name: p + '.brightness_min', label: 'Minste lysstyrke (%)', min: 0, max: 100, placeholder: '0' },
              { type: 'number', name: p + '.brightness_max', label: 'Største lysstyrke (%)', min: 0, max: 100, placeholder: '100' },
              { type: 'boolean', name: p + '.hide_temperature_slider', label: 'Skjul temperatur (pil)', default: false },
              { type: 'boolean', name: p + '.hide_color_controls', label: 'Skjul farge (pil)', default: false },
            ] };
          }),
        ] });
      }
      if (L) {
        const items = [...L.lists.enheter.map((id) => [id, 'Enhet']), ...L.lists.sensorer.map((id) => [id, 'Sensor'])];
        if (items.length) {
          out.push({ type: 'section', id: 'looks', label: 'Utseende på kort', icon: 'mdi:palette', fields: [
            { type: 'info', label: 'Rad-stil som universal_sensor. Tomt felt = standard. Bruk {state}, {w} og {name}, eller kode: [[[ return state === \'på\' ? \'var(--green)\' : null ]]]. Sensorer: regel 1 er som standard «aktiv» (bevegelse/åpen/fukt) → grønn bakgrunn og mørk tekst.' },
            ...items.map(([id, kind]) => {
              const p = 'looks.' + id, nm0 = cap(M.name(h, id, M.areaName(h, area)));
              return { type: 'section', label: `${nm0} · ${kind}`, icon: M.domainIcon(id, h.states[id]), fields: [
                ...(kind === 'Enhet' ? devPowerFields(h, area, id, nm0, L) : []),
                ...(M.universalSchema ? M.universalSchema(p, { kind: 'sensor', placeholders: { sub_text: nm0, main_text: kind === 'Enhet' ? 'På · {w} W / Av' : '{state}', rule1: kind === 'Sensor' && h.states[id] && id.startsWith('binary_sensor.') ? 'Auto: aktiv (on)' : kind === 'Enhet' ? 'Auto: på → grønn (profil: aktiv → profilfarge)' : '' } }) : []),
                // Hvitevare-profil (16.5): Auto = etter navnet (PROF-tabellen), egne verdier overstyrer
                ...(kind === 'Enhet' ? [
                  { type: 'select', name: p + '.profile', label: 'Hvitevare-profil', options: PROF_OPTS, help: 'Auto: ' + ((profOf(nm0 + ' ' + obj(id)) || {}).name || 'ingen') },
                  { type: 'color', name: p + '.profile_color', label: 'Profilfarge', help: 'Bakgrunn når aktiv, ikonfarge ellers' },
                  { type: 'text', name: p + '.active_text', label: 'Aktiv tekst', placeholder: (profOf(nm0 + ' ' + obj(id)) || {}).verb || 'Vasker' },
                  { type: 'number', name: p + '.run_threshold_w', label: 'Aktiv over (W)', min: 0, max: 3000, placeholder: String((profOf(nm0 + ' ' + obj(id)) || {}).thr || 'Auto') },
                  { type: 'select', name: p + '.profile_anim', label: 'Ikon-animasjon', options: ANIM_KIND },
                  { type: 'select', name: p + '.animation', label: 'Animasjonsnivå', options: ANIM_LV, help: 'Tomt = som «Hvitevarer» under' },
                ] : []),
              ] };
            }),
          ] });
        }
      }
      out.push({ type: 'section', id: 'appliances', label: 'Hvitevarer', icon: 'mdi:washing-machine', meta: (hh, cc) => (ANIM_LV.find((x) => x[0] === (cc.appliance_animation || 'full')) || [])[1], fields: [
        { type: 'select', name: 'appliance_animation', label: 'Animasjon', options: ANIM_LV, default: 'full', help: 'Rist/spinn/puls på ikonet når enheten er aktiv. Rolig = halv fart. Av = stillestående ikon' },
        { type: 'number', name: 'run_threshold_w', label: 'Kjører over (W)', min: 0, max: 3000, placeholder: 'Auto', help: 'Uten status-sensor: effekt over dette = kjører' },
      ] });
      // 26.21: av som standard – Tilpass åpnes via tannhjulet i klima-toppkortet (vises alltid). Bare true viser knappen.
      out.push({ type: 'boolean', name: 'customize_button', label: 'Vis «Tilpass rommet»-knapp nederst', default: false });
      return tabsOf(out, h, c, area);
    };
  }
  // 19.21: effektsensor, terskel og på/av-tekst per enhet → overrides.<domene>.<objekt-id> (= overrides['<entity_id>']
  // som sti i editoren). Tomt felt = automatisk. Forhåndsvisningen bruker utkastet og dagens verdier.
  const getP = (o, p) => String(p).split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  function devPowerFields(h, area, id, nm0, L) {
    const po = 'overrides.' + id, thrN = po + '.threshold_w';
    const thrOf = (cc) => { const v = getP(cc, thrN); return v != null && v !== '' && !isNaN(Number(v)) ? Number(v) : 5; };
    return [
      { type: 'entity', name: po + '.power', label: 'Effektsensor', domain: 'sensor', prefer_class: 'power', area: () => area,
        none_label: 'Ingen effektsensor (bare av/på fra bryteren)', auto: () => (L.effAuto && L.effAuto[id]) || null,
        help: `Automatisk: ${(L.effAuto && L.effAuto[id]) || 'sensor.' + obj(id) + '_effekt (fant ingen)'}. Strømsensorer i rommet vises først.` },
      { type: 'html', html: (hh, cc, key, ed) => {
        if (!ed._inline) return ed._field({ type: 'number', name: thrN, label: 'Terskel for «på» (W)', min: 0, max: 5000, placeholder: '5', help: 'Over terskelen = på, under = av/standby' }, key + '_n');
        const cur = thrOf(cc);
        return `<div class="f"><div class="line"><span style="flex:1;font-size:13px">Terskel for «på»</span>
          <button class="ib" data-a="fn" data-k="${key}" data-d="-1" title="Lavere" ${cur <= 0 ? 'disabled style="opacity:.3"' : ''}>${M.icon('mdi:minus', 20)}</button><span class="rv" style="min-width:56px;text-align:center">${M.nf(cur)} W</span><button class="ib" data-a="fn" data-k="${key}" data-d="1" title="Høyere">${M.icon('mdi:plus', 20)}</button></div>
          <span class="help">Over terskelen = på, under = av/standby (standard 5 W). Med «Ingen effektsensor» brukes bryterens tilstand.</span></div>`;
      }, click: (d, ed) => {
        const cur = thrOf(ed._config), dir = Number(d.d), st = (dir > 0 ? cur : cur - 1) < 10 ? 1 : (dir > 0 ? cur : cur - 1) < 100 ? 5 : 50;
        M.haptic('light');
        ed._set(thrN, M.clamp(Math.round((cur + dir * st) / st) * st, 0, 5000));
      } },
      { type: 'text', name: po + '.on_text', label: 'Tekst når på', placeholder: 'På · {w} W', help: 'Tokens: {w} (watt), {name}, {state} – eller [[[ return … ]]]' },
      { type: 'text', name: po + '.off_text', label: 'Tekst når av', placeholder: 'Av' },
      { type: 'html', html: (hh, cc) => {
        const Lc = M.roomLists(hh, area, cc), e = Lc.eff[id], ps = e && hh.states[e], wv = ps ? parseFloat(ps.state) : NaN;
        const w = M.roomDevOv(cc, id).power === 'none' || isNaN(wv) ? null : wv;
        const D = devOv(hh, cc, id, w, nm0), on = D ? D.on : M.isOn(hh.states[id]);
        const txt = D ? D.text : on ? (w != null ? `På · ${M.nf(w)} W` : 'På') : 'Av';
        return `<div class="f"><label>Forhåndsvisning nå</label><div style="font-size:14px;font-weight:500">${esc(on ? `${nm0} · ${txt}` : txt)}</div></div>`;
      } },
    ];
  }
  // 19.20: «Tilpass rom» i fire faner (Oppsett · Entiteter · Klima · Kort). Entiteter har undersegment (Lys · Enheter ·
  // Sensorer · Andre) med antall = autokonfig + lagt til. Seksjonene i en fane vises flatt (01-editor: type 'tabs').
  const TAB_OF = { kombinert: 'oppsett', area: 'oppsett', spacing: 'oppsett', sections: 'oppsett', customize_button: 'oppsett', klima: 'klima', klima_order: 'klima', look: 'kort', actions: 'kort', looks: 'kort', appliances: 'kort' };
  function tabsOf(out, h, c, area) {
    const of = (t) => out.filter((f) => TAB_OF[f.id || f.name] === t), byId = (id) => out.find((f) => f.id === id);
    const A = h && area ? M.roomLists(h, area, {}).auto : null;
    const all = (k) => (A ? [...new Set([...(A[k] || []), ...(((c.include || {})[k]) || [])])] : []);
    const lists = (keys, label) => ({ type: 'lists', label,
      meta: (hh, cc) => { const ex = new Set(cc.exclude || []), ids = keys.flatMap(all); return ids.length ? `${ids.filter((x) => !ex.has(x)).length} av ${ids.length} vises` : ''; },
      lists: (hh, cc) => { const ar = (cc && cc.area) || area; if (!ar) return []; const AA = M.roomLists(hh, ar, {}).auto; return LISTS.filter(([k]) => keys.includes(k)).map(([key, lb, domains]) => ({ key, label: lb, ids: AA[key], domains })); } });
    const none = { type: 'info', label: 'Velg rom under Oppsett (eller åpne tilpasningen fra popupen) for å skjule/legge til entiteter.' };
    const lys = byId('lys'), scenes = byId('scenes');
    const ent = area ? [{ type: 'tabs', id: 'rom-ent', sub: true, tabs: [
      { key: 'lys', label: 'Lys', count: all('lys').length, focus: ['lys', 'entities'], fields: [lists(['lys'], 'Lys · synlighet'), ...(lys ? [{ ...lys, label: 'Lys · type og funksjon' }] : [])] },
      { key: 'dev', label: 'Enheter', count: all('enheter').length, fields: [lists(['enheter'], 'Enheter · synlighet'), { type: 'info', label: 'Effektsensor, terskel og tekst per enhet: fanen Kort → Utseende på kort → enheten.' }] },
      { key: 'sens', label: 'Sensorer', count: all('sensorer').length, fields: [lists(['sensorer'], 'Sensorer · synlighet')] },
      { key: 'andre', label: 'Andre', count: all('gardiner').length + all('media').length + all('scener').length, focus: ['scenes'], fields: [...(scenes ? [scenes] : []), lists(['scener', 'gardiner', 'media'], 'Scener, rullegardin og media · synlighet')] },
    ] }] : [none];
    return [{ type: 'tabs', id: 'rom', tabs: [
      { key: 'oppsett', label: 'Oppsett', icon: 'mdi:tune-variant', focus: ['spacing', 'sections'], fields: of('oppsett') },
      { key: 'ent', label: 'Entiteter', icon: 'mdi:format-list-bulleted', focus: ['entities', 'lys', 'scenes'], fields: ent },
      { key: 'klima', label: 'Klima', icon: 'mdi:thermostat', focus: ['klima'], fields: [...of('klima'), ...(area ? [lists(['klima', 'vifter'], 'Termostater og vifter · synlighet')] : [])] },
      { key: 'kort', label: 'Kort', icon: 'mdi:palette', focus: ['look', 'actions', 'looks', 'appliances'], fields: of('kort') },
    ] }];
  }

  /* ---------------------------------------------------------------- kortet */
  class Rom extends M.Card {
    static get cardName() { return 'Rom'; }
    static get defaults() { return {}; }
    // 26.21: stub-config har «Tilpass rommet»-knappen nederst av (tannhjulet i toppkortet åpner Tilpass)
    static getStubConfig() { return { ...super.getStubConfig(), customize_button: false }; }
    // Mellomrom-standard (MSH._applySpacing): bare rom uten lagret verdi får disse.
    static get spacingDefaults() { return SPACING; }
    // 33.6: pad_top lagres som designets padT (−4 = inntil headeren, 0 px) → faktisk avstand = pad_top + 4 px.
    _applySpacing() {
      const c = this._config;
      if (!c || c.embedded) return super._applySpacing();
      const top = c.pad_top != null && c.pad_top !== '' && !isNaN(Number(c.pad_top)) ? Number(c.pad_top) : SPACING.pad_top;
      this._config = { ...c, pad_top: top + PAD_T_OFF };
      try { super._applySpacing(); } finally { this._config = c; }
    }
    static get schema() { return buildSchema(null); }
    // «Tilpass rom» lagres per område i ki-store: rooms.<area_id> (uavhengig av card_id)
    static storeKey(cfg, card) { const a = (cfg && cfg.area) || (card && card.isConnected && M.roomArea(card)); return a ? 'rooms.' + a : null; }
    get cardSize() { return 8; }
    constructor() {
      super();
      this._pend = {};
      this._kpend = {};
      this._onRC = (e) => { const d = e.detail || {}; if (!d.handled && d.area && this.isConnected && d.area === M.roomArea(this)) { d.handled = true; this.customize(d.section); } };
    }
    connectedCallback() {
      super.connectedCallback();
      window.addEventListener('msh-rom-customize', this._onRC);
      // rommet kan komme fra popupens hash → les rooms.<area> nå som kortet er koblet til
      if (this._yamlConfig && !this._yamlConfig.area) this.setConfig(this._yamlConfig);
    }
    disconnectedCallback() { super.disconnectedCallback(); window.removeEventListener('msh-rom-customize', this._onRC); }

    // Egen tilpasning: samme editor/skjema som GUI-editoren, men med rommet fra popupens hash kjent.
    customize(focus) {
      const area = M.roomArea(this);
      const cb = area && M.combinedOfCard ? M.combinedOfCard(this.hass, { ...this.config, area }) : null;
      return M.openEditor(this, { cardClass: { schema: buildSchema(area), cardName: cb ? cb.name : area ? M.areaName(this.hass, area) : 'Rom' }, focus, areaCtx: area });
    }

    /* ------------ hjelpere */
    _nm(id) { const r = this._L && this._L.roomOf && this._L.roomOf[id]; return cap(M.name(this.hass, id, r ? M.areaName(this.hass, r) : this._areaName)); }
    // 36.3 · romtagg («Kjøkken») per entitet i et kombinert rom med > 1 rom. «Grupper per rom» (layout group) bruker
    // underoverskrifter i listene i stedet – force = alltid tagg (karuseller, scener, gardiner)
    _tag(id, force) {
      const cb = this._cb;
      if (!cb || cb.rooms.length < 2 || (!force && cb.layout === 'group')) return '';
      const r = this._L.roomOf && this._L.roomOf[id];
      return r ? `<span class="rtag">${esc(M.areaName(this.hass, r))}</span>` : '';
    }
    _grp(ids, htmlOf) {
      const cb = this._cb;
      if (!cb || cb.layout !== 'group' || cb.rooms.length < 2) return ids.map(htmlOf).join('');
      const RO = this._L.roomOf || {}, rest = ids.filter((id) => !cb.rooms.includes(RO[id]));
      return cb.rooms.map((r) => { const L = ids.filter((id) => RO[id] === r); return L.length ? `<div class="rgh" data-key="rgh-${esc(r)}">${esc(M.areaName(this.hass, r))}</div>${L.map(htmlOf).join('')}` : ''; }).join('') + (rest.length ? `<div class="rgh" data-key="rgh--">Lagt til</div>${rest.map(htmlOf).join('')}` : '');
    }
    _look(id) { const [d, o] = [id.split('.')[0], obj(id)]; const L = this.config.looks; return (L && L[d] && L[d][o]) || {}; }
    _tekst(kind, changed) {
      if (changed) return null;
      const id = M.kiRomId(this.hass, this._area, kind);
      const s = this.s(id);
      return s && s.attributes.tekst ? String(s.attributes.tekst) : null;
    }
    // Verdi under drag / rett etter kommando (optimistisk) → ellers faktisk
    _v(kind, id, real, keep) {
      const d = this._drag;
      if (d && d.kind === kind && d.id === id) return d.v;
      const k = kind + '|' + id, p = this._pend[k];
      if (p) {
        if (Math.abs(p.v - real) <= 1 || (Date.now() - p.t > (keep || 4000))) delete this._pend[k];
        else return p.v;
      }
      return real;
    }
    _dragging(kind, id) { const d = this._drag; return !!(d && d.kind === kind && d.id === id); }
    _chev(open, size = 24, col) { return M.icon('expand_more', size, `transform:rotate(${open ? 180 : 0}deg);transition:transform .2s;${col ? 'color:' + col : ''}`); }
    _head(k, icon, title, sum) {
      const open = !!(this.ui.acc || {})[k];
      return `<button class="acc" data-act="acc" data-k="${k}">${M.icon(icon, 24)}<span class="acct">${esc(title)}</span><span class="accs">${esc(sum || '')}</span>${this._chev(open)}</button>`;
    }
    // Seksjonenes utgangspunkt fra config. Settes ved hver åpning (onOpen) og når innstillingen endres.
    _startAcc(order, L) {
      const c = this.config, hasLys = !!(L && L.lists.lys.length), st = {};
      const fold = order.filter((k) => FOLD_ALIAS[k]);
      fold.forEach((k) => { st[k] = openDefault(c, k, hasLys); });
      if (c.sections_mode === 'single') { let seen = false; fold.forEach((k) => { if (st[k] && seen) st[k] = false; if (st[k]) seen = true; }); }
      const sig = JSON.stringify(st);
      if (this._accSig === sig && this._ui.acc) return;
      this._accSig = sig;
      const { curtain, ...acc } = st;
      this._ui = { ...this._ui, acc, cvOpen: !!curtain };
    }
    _listChanged(key) { const a = this._L.auto[key] || [], l = this._L.lists[key] || []; return a.length !== l.length || a.some((x, i) => x !== l[i]); }

    render() {
      if (M.stationArtBind && this.shadowRoot) M.stationArtBind(this.shadowRoot, () => this.update()); // 51 A: feilet bilde → logo / ikon
      const c = this.config;
      const area = M.roomArea(this);
      this._area = area;
      if (!area || !(this.hass.areas && this.hass.areas[area]) && !M.kiRom(this.hass, area, 'oversikt') && !(M.combinedOfCard && M.combinedOfCard(this.hass, c))) { // 36.3: kombinert rom
        return `<div class="rom">${M.emptyState(area ? `Fant ikke rommet «${area}» – velg område` : 'Velg rom (område) for kortet', 'entities')}</div>`;
      }
      this._areaName = M.areaName(this.hass, area);
      const L = (this._L = M.roomLists(this.hass, area, c));
      this._cb = L.combined || null; // 36.3: kombinert rom
      if (this._cb) this._areaName = this._cb.name;
      if (L.ov) this.s(L.ov.entity_id);
      const keys = SECS.map((s) => s[0]);
      const order = (Array.isArray(c.sections) ? c.sections.filter((k) => keys.includes(k)) : []);
      keys.forEach((k) => { if (!order.includes(k)) order.push(k); });
      const hid = new Set(c.hidden_sections || []);
      this._startAcc(order.filter((k) => !hid.has(k)), L);
      const R = { curtain: () => this._curtain(), scenes: () => this._scenes(), lys: () => this._lights(), dev: () => this._devices(), klima: () => this._klima(), media: () => this._media(), sens: () => this._sensors() };
      const secs = order.filter((k) => !hid.has(k)).map((k) => R[k]()).filter(Boolean).join('');
      const any = LISTS.some(([k]) => L.lists[k].length);
      const body = secs || (any ? '' : M.emptyState(`Fant ingen entiteter i ${this._areaName}`, 'entities'));
      // 26.21: knappen nederst bare med `customize_button: true` (eller ki-room-card-navnet `show_edit_button: true`)
      const tune = c.customize_button === true || c.show_edit_button === true ? `<button class="tune press" data-act="customize">${M.icon('tune', 18)}Tilpass rommet</button>` : '';
      return `<div class="rom">${body}${tune}</div>`;
    }

    /* ------------ rullegardin */
    _cvPos(id) {
      const s = this.s(id);
      if (!s) return 0;
      const p = s.attributes.current_position;
      const real = p != null ? Math.round(Number(p)) : s.state === 'open' || s.state === 'opening' ? 100 : 0;
      return this._v('cover', id, real, s.state === 'opening' || s.state === 'closing' ? 60000 : 8000);
    }
    _cvSlider(id, v) {
      return `<div class="cvs ${this._dragging('cover', id) ? 'drag' : ''}" data-slide="cover" data-id="${esc(id)}" data-ent="${esc(id)}"><span class="cvt"></span><span class="cvf" style="width:${v}%"></span><span class="knob" style="left:calc(${v}% - 11px)"></span></div>`;
    }
    _curtain() {
      const ids = this._L.lists.gardiner;
      if (!ids.length) return '';
      const multi = ids.length > 1, open = multi && !!this.ui.cvOpen;
      const v0 = this._cvPos(ids[0]);
      const rest = open ? ids.slice(1).map((id) => { const v = this._cvPos(id); return `<div class="cvr2" data-key="cv-${esc(id)}"><span class="cvn2">${esc(this._nm(id))}${this._tag(id, true)}</span>${this._cvSlider(id, v)}<span class="cvp2 num">${v}%</span></div>`; }).join('') : '';
      // 35.6: forvalg-knappen som matcher ALLE gardinene er aktiv (rosa + --ki-on-accent)
      const all = open ? ids.map((id) => this._cvPos(id)) : [];
      return `<section class="cvbox" data-key="sec-curtain">
        <div class="cvr"><span class="cvn">${esc(this._nm(ids[0]))}${this._tag(ids[0], true)}</span>${this._cvSlider(ids[0], v0)}<span class="cvp num">${v0}%</span>${multi ? `<button class="cvx" data-act="cvx" data-haptic="selection">${this._chev(open)}</button>` : ''}</div>
        ${open ? `<div class="cvo"><div class="cvpre">${[0, 25, 50, 75, 100].map((v) => { const on = all.length && all.every((x) => x === v); return `<button class="pre press ${on ? 'on' : ''}" data-act="cvall" data-v="${v}" aria-pressed="${on ? 'true' : 'false'}">${v}%</button>`; }).join('')}</div>${rest}</div>` : ''}
      </section>`;
    }

    /* ------------ scener (engangshandlinger – ingen aktiv-tilstand) */
    // KI Rom-lysscener (button.* → button.press) først, så scene.*/script.* (turn_on).
    _scenes() {
      const ids = this._L.lists.scener;
      if (!ids.length) return '';
      const meta = this._L.sceneMeta || {};
      return `<section class="scn noscroll" data-hs="1" data-key="sec-scenes">${ids.map((id) => {
        const s = this.s(id), m = meta[id], lk = this._look(id);
        const nm = (m && m.navn) || this._nm(id);
        const auto = (SCENE_ICON.find((x) => x[0].test(nm.toLowerCase())) || [])[1];
        const icon = lk.icon || (m && m.ikon) || (s && s.attributes.icon) || auto || (id.startsWith('script.') ? 'mdi:script-text' : 'mdi:palette');
        return `<button class="sc" data-act="scene" data-id="${esc(id)}" data-ent="${esc(id)}" data-haptic="light" data-key="sc-${esc(id)}">${M.icon(icon, 26)}<span class="scl ell">${esc(lk.name || nm)}</span>${this._tag(id, true) ? `<span class="stg ell">${esc(M.areaName(this.hass, this._L.roomOf[id]))}</span>` : ''}</button>`;
      }).join('')}</section>`;
    }

    /* ------------ lys: felles lys-rad (08-light-row.js, Fiks 41 – Rom v4 «lights», samme som Lys-popupen) */
    // Innstillinger per lys: config.lights.<object_id> (objekt-id-en – entity_id har punktum som ellers
    // ville blitt en ekstra nivå i editorens dotted names). lights.<entity_id> godtas også (YAML).
    _lightRow(id) {
      const c = this.config, L = c.lights || {};
      const u = { ...(L[id] || {}), ...(L[obj(id)] || {}) };
      const T = ((c.light_types || {})[obj(id)]) || undefined;
      return M.renderLightRow(this, { id, name: this._nm(id), type: T, user: u });
    }
    _lights() {
      const ids = this._L.lists.lys;
      if (!ids.length) return '';
      const open = !!(this.ui.acc || {}).lys;
      let on = 0;
      const H = {};
      ids.forEach((id) => {
        const s = this.s(id), isOn = !!s && s.state === 'on';
        if (isOn) on++;
        if (!open) return;
        const row = this._lightRow(id), tg = this._tag(id);
        H[id] = tg ? `<div class="lw" data-key="lw-${esc(id)}"><div class="ltg">${tg}</div>${row}</div>` : row; // 36.3: romtagg over raden
      });
      const rows = open ? this._grp(ids, (id) => H[id]) : '';
      const sum = this._tekst('lys', this._listChanged('lys')) || `${on} på · ${ids.length - on} av`;
      // 36.3 · «Alle lys» (kombinert rom): rosa bryter ved siden av akkordeon-hodet, styrer lysene i alle rommene
      const head = this._head('lys', 'floor_lamp', 'Lys', sum);
      const hd = this._cb ? `<div class="acw">${head}<button class="alls" data-act="alllights" data-haptic="medium" role="switch" aria-checked="${on > 0}" aria-label="Alle lys" title="Alle lys"><span class="alt">Alle</span><span class="asw${on > 0 ? ' on' : ''}"></span></button></div>` : head;
      return `<section class="box" data-key="sec-lys">${hd}${open ? `<div class="bd"><div class="lts">${rows}</div></div>` : ''}</section>`;
    }

    /* ------------ enheter (brytere/vifter med effekt) – aktiv enhet har ingen glød */
    _w(id) {
      const e = this._L.eff[id], po = M.roomDevOv(this.config, id).power;
      if (po === 'none') return null; // 19.21: «Ingen effektsensor» → bare av/på fra bryteren
      if (e) { const v = this.n(e); if (v != null) return v; }
      if (po) return null;
      const k = M.kiRom(this.hass, (this._L && this._L.roomOf && this._L.roomOf[id]) || this._area, 'effekt');
      const kil = k && k.attributes.kilder;
      if (kil) {
        this.s(k.entity_id);
        if (Array.isArray(kil)) { const f = kil.find((x) => x && (x.entity === id || x.entity_id === id)); if (f) { const v = Number(f.w != null ? f.w : f.effekt != null ? f.effekt : f.value); if (!isNaN(v)) return v; } } else if (kil[id] != null && !isNaN(Number(kil[id]))) return Number(kil[id]);
      }
      return null;
    }
    _devices() {
      const ids = this._L.lists.enheter;
      if (!ids.length) return '';
      const open = !!(this.ui.acc || {}).dev;
      let on = 0, W = 0, hasW = false;
      // 17.6: når flere enheter er på får hver sin farge i listerekkefølge (bare på-rader teller, av hoppes over).
      // Hvitevare-profiler og egen farge/regel i «Tilpass rom» beholder sin farge (og tar ingen plass i rekkefølgen).
      const multi = ids.filter((id) => { const s = this.s(id); return M.isOn(s) && !M.unavailable(s); }).length >= 2;
      let ci = 0;
      const DH = {};
      ids.forEach((id) => { DH[id] = ((id) => {
        const s = this.s(id), w = this._w(id), unav = M.unavailable(s);
        const DV = devOv(this.hass, this.config, id, w, this._nm(id)), isOn = DV ? DV.on : M.isOn(s);
        if (isOn) on++;
        if (w != null) { W += w; hasW = true; }
        if (!open) return '';
        const nm = this._nm(id), lk0 = this._look(id);
        // 16.5: universal small-rad som Sensorer (ingen toggle-kolonne). Hele raden er knappen (dom.toggle), hold → more-info.
        // Hvitevare-profil (PROF, etter navn/objekt-id, overstyrbar i looks) → ikon/farge/aktiv tekst/terskel/animasjon.
        const aT = M.applianceType ? M.applianceType(id, s, this.hass) : null, AP = aT && aT !== 'fan' ? M.APPLIANCES[aT] : null;
        const P = profFor(nm + ' ' + obj(id), lk0) || (AP && !lk0.profile ? { icon: AP.icon, col: AP.color, verb: AP.verb, thr: 5, anim: 'puls' } : null);
        const thr = lk0.run_threshold_w != null && lk0.run_threshold_w !== '' ? Number(lk0.run_threshold_w) : this.config.run_threshold_w != null ? Number(this.config.run_threshold_w) : P ? P.thr : 10;
        // Status-sensor for samme enhet (06-appliance-icons) vinner over effekt; ellers aktiv = på og effekt > terskel
        const aS = P && aT ? M.applianceStatus(this.hass, id, { card: this, type: aT, power: this._L.eff[id], run_threshold_w: thr }) : null;
        const act = !!P && isOn && !unav && (aS && (aS.source === 'status' || aS.source === 'running') ? !!aS.running : w != null && w > thr);
        const icon0 = (s && s.attributes.icon) || (this.hass.entities && this.hass.entities[id] && this.hass.entities[id].icon) || (DEV_ICON.find((x) => x[0].test(nm.toLowerCase())) || [])[1] || 'power';
        const Wt = w != null ? `${M.nf(w)} W` : '';
        const status = unav ? 'Utilgjengelig' : DV && DV.own ? DV.text : act ? (Wt ? `${P.verb} · ${Wt}` : P.verb) : isOn ? (P ? (w > 0 ? `Hviler · ${Wt}` : w != null ? 'På · 0 W' : 'På') : (Wt ? `På · ${Wt}` : 'På')) : 'Av';
        const ctx = { state: isOn ? 'på' : 'av', on: isOn, w: w != null ? M.nf(w) : 0, name: nm, entity: s }, lk = M.universalLook(lk0, ctx);
        const ownRule = Object.keys(lk0).some((k) => /^state_rule_1_(value|condition)$/.test(k) && lk0[k] != null && lk0[k] !== '');
        // Animasjon: rist .5 s · spinn 1,6 s lineær · puls 1,4 s. Nivå fra looks.animation / appliance_animation (Rolig = halv fart, Av = ingen)
        const lvl = lk.animation || this.config.appliance_animation || 'full';
        const kindA = P && ANIM[P.anim] ? P.anim : null;
        const anim = act && kindA && lvl !== 'off' ? `animation:${kindA} ${lvl === 'calm' ? ANIM[kindA].replace(/^[\d.]+/, (x) => String(Number(x) * 2)) : ANIM[kindA]} infinite` : '';
        const icon = lk.icon || (P && P.icon) || icon0;
        const ownBg = !!(lk.background_color || lk.bg);
        const mc = multi && isOn && !unav && !P && !ownRule && !ownBg ? MULTI[ci++ % MULTI.length] : null;
        // 20.15: av (eller hvitevare som hviler under terskelen) → pille --ki-surface-3, ikon-sirkel --ki-surface, ikon --ki-text-1
        const off = !unav && !ownRule && !ownBg && !(P ? act : isOn);
        // 38: aksentflate (på-farge, hvitevare aktiv, egen regel som treffer med farge, egen bakgrunn fra «Utseende på kort»)
        // → mørk tekst/ikon (--ki-on-accent), ikon-sirkel rgba(0,0,0,.12) uten kant
        const hitR = ownRule ? ruleHit(lk, s) : null;
        const acc = !unav && (ownRule ? (hitR ? !!hitR.bg : ownBg) : (P ? act : isOn) || ownBg);
        return M.universal({
          // Tilstandsregel 1 (som sensorene): på → grønn; hvitevare aktiv → profilfargen. Hvitevare på men hviler = vanlig rad.
          state_rule_1_condition: ownRule ? undefined : P ? act : isOn && !unav, state_rule_1_background_color: P ? P.col : mc || 'var(--green)', state_rule_1_text_color: DEV_ON_ACC,
          ...lk, mode: lk.mode || 'sensor', size: lk.size || 'small', entity: id, st: s, key: 'd-' + id,
          act: unav ? null : lk.mode && lk.mode !== 'sensor' ? undefined : 'dtoggle', id, haptic: 'success',
          cls: `msh-inner d-row${act ? ' u-act' : ''}${unav ? ' d-unav' : ''}${mc ? ' d-on' : ''}${off ? ' d-off' : ''}${acc ? ' d-acc' : ''}`,
          icon_html: M.icon(icon, 30, anim ? anim + ';' : ''),
          main_text: lk.main_text || lk.label || (lk.mode === 'bar' ? null : status),
          sub_text: lk.sub_text || lk.name || nm, alt_text: lk.alt_text != null ? lk.alt_text : '', ...(this._tag(id) && !lk.alt_text ? { sub_html: esc(lk.sub_text || lk.name || nm) + this._tag(id) } : {}),
          background_color: lk.background_color || lk.bg || (off ? 'var(--ki-surface-3, var(--gray100, #2f2f2f))' : undefined), text_color: lk.text_color || (off ? 'var(--ki-text, var(--white, #fafafa))' : acc ? DEV_ON_ACC : undefined),
          circle_color: lk.cell || (acc ? 'rgb(0 0 0 / 0.12)' : off ? 'var(--ki-surface, var(--gray200, #3a3a3a))' : undefined),
          icon_color: lk.icon_color || (off ? 'var(--ki-text-1, var(--gray1000, #e1e1e1))' : P && !act && P.col ? P.col : undefined) });
      })(id); });
      const rows = open ? this._grp(ids, (id) => DH[id]) : '';
      // 19.21: egen effektsensor på en enhet → summen regnes fra sensorene (KI Rom-teksten kjenner ikke overstyringen)
      const pOv = ids.some((id) => M.roomDevOv(this.config, id).power);
      const sum = this._tekst('effekt', this._listChanged('enheter') || pOv) || (hasW ? `${M.nf(W)} W` : null) || this._tekst('brytere', this._listChanged('enheter')) || `${on} på - ${ids.length - on} av`;
      return `<section class="box" data-key="sec-dev">${this._head('dev', 'radio', 'Enheter', sum)}${open ? `<div class="bd"><div class="lst">${rows}</div></div>` : ''}</section>`;
    }

    /* ------------ klima (termostater, +/−) */
    _klima() {
      const ids = this._L.lists.klima, fans = this._L.lists.vifter || [];
      if (!ids.length && !fans.length) return '';
      const c = this.config, open = !!(this.ui.acc || {}).klima;
      const first = ids.length ? this.s(ids[0]) : null, fa = (first && first.attributes) || {};
      const heat0 = fa.hvac_action === 'heating';
      const set0 = ids.length ? this._kv(ids[0]) : null;
      // 16.8: topplinjen viser summen av effekt (termostater + vifter med strømsensor), ellers som før
      let W = 0, hasW = false;
      [...ids, ...fans].forEach((id) => { const w = this._w(id); if (w != null) { W += w; hasW = true; } });
      let sum = hasW ? `${M.nf(W)} W` : heat0 ? 'Varmer' : set0 != null ? `${M.nf(set0, 1)}°` : first ? (first.state === 'off' ? 'Av' : '') : ids.length ? '–' : '';
      if (!hasW && ids.length > 1) sum = `${sum ? sum + ' · ' : ''}+${ids.length - 1}`;
      if (!ids.length && !hasW) { const n = fans.filter((id) => M.isOn(this.s(id))).length; sum = `${n} på - ${fans.length - n} av`; }
      let body = '';
      if (open) {
        const bg = M.color(c.klima_bg, M.INNER_ROW ? M.INNER_ROW.bg : 'var(--ki-surface-3, var(--gray100, #2f2f2f))'), fill = c.klima_btn === 'fill';
        // 17.3 (Rom v4 climCards → ctl): ikke-varmer-stepperen er gjennomsiktig med lys kant (klimaLook.ring, standard .22) –
        // ingen fylling/gradient/skygge (grå fylling fra 16.1/17.1 gjelder bare romkortene på Hjem). «Fylt» (klima_btn: fill)
        // gir background: ring uten kant. Varmer-tilstanden styres av .kc.heat (uendret fra 16.8).
        const ring = M.color(c.klima_ring, wa(0.22));
        const ctl = `box-shadow:${fill ? 'none' : `inset 0 0 0 1px ${ring}`};background:${fill ? ring : 'transparent'};color:${fill && c.klima_ring ? C.popup : G.w}`;
        const rc = M.roomClimate(this.hass, this._area, c);
        if (rc.hum.id) this.s(rc.hum.id);
        if (rc.temp.id) this.s(rc.temp.id);
        const roomHum = rc.hum.v, roomT = rc.temp.v;
        const idx = Math.min(this.ui.kIdx || 0, Math.max(0, ids.length - 1));
        const HW = c.klima_heat_w || {};
        const cards = ids.map((id) => {
          const s = this.s(id), a = (s && s.attributes) || {};
          const t = a.current_temperature != null ? Number(a.current_temperature) : roomT;
          const h = a.current_humidity != null ? Number(a.current_humidity) : roomHum;
          const sp = this._kv(id), w = this._w(id);
          const act = a.hvac_action;
          let sub = !s ? 'Finnes ikke' : M.unavailable(s) ? 'Utilgjengelig' : s.state === 'off' || act === 'off' ? 'Av' : act === 'heating' ? 'Varmer' : act === 'cooling' ? 'Kjøler' : act === 'idle' ? 'Holder' : ({ heat: 'Varme', cool: 'Kjøling', auto: 'Auto', heat_cool: 'Auto', dry: 'Tørk', fan_only: 'Vifte' }[s.state] || s.state);
          // Varmer (16.8): hvac_action heating eller effekt > terskel (klima_heat_w.<objekt-id>, standard 100 W)
          const thr = HW[obj(id)] != null && HW[obj(id)] !== '' ? Number(HW[obj(id)]) : 100;
          const heat = !!s && !M.unavailable(s) && (act === 'heating' || (w != null && w > thr));
          // 17.3: ikke varmer → bare effekten («0 W») under navnet; varmer som før («Varmer · 214 W»)
          if (w != null) sub = heat || !s || M.unavailable(s) ? `${sub} · ${M.nf(w)} W` : `${M.nf(w)} W`;
          const mc = !heat && c.klima_mode && sp != null && t != null ? (sp > t + 0.2 ? C.red : sp < t - 0.2 ? C.blue : null) : null;
          const cbg = mc ? `linear-gradient(135deg, ${M.alpha(mc, 0.24)}, ${bg} 72%)` : bg;
          const dec = sp != null && Number.isInteger(sp) ? 0 : 1;
          return `<div class="kc${heat ? ' heat' : ''}" data-key="k-${esc(id)}" data-ent="${esc(id)}" style="background:${cbg}"><span class="kpk"></span>
            <div class="kt"><span class="kn ell">${esc(this._nm(id))}${this._tag(id, true)}</span><span class="ks ell">${esc(sub)}</span></div>
            <div class="kb"><span class="kv num">${t != null ? M.nf(t, 0) : '–'}°</span><span class="kh">${h != null ? M.nf(h, 0) : '–'}%</span></div>
            <div class="kctl" style="${heat ? '' : ctl}"><button class="kbtn" data-act="kset" data-d="1" data-id="${esc(id)}" data-haptic="selection" ${sp == null ? 'disabled' : ''}>${M.icon('expand_less', 24)}</button><span class="kset num">${sp != null ? M.nf(sp, dec) : '–'}°</span><button class="kbtn" data-act="kset" data-d="-1" data-id="${esc(id)}" data-haptic="selection" ${sp == null ? 'disabled' : ''}>${M.icon('expand_more', 24)}</button></div>
          </div>`;
        }).join('');
        const parts = {
          cards: ids.length ? `<div class="cw"><div class="car noscroll" data-car="kIdx">${cards}</div>${this._dots(ids.length, idx)}</div>` : '',
          fans: fans.length ? `<div class="bd"><div class="lst">${fans.map((id) => this._fanRow(id)).join('')}</div></div>` : '',
        };
        const ord = (Array.isArray(c.klima_order) ? c.klima_order.filter((k) => parts[k] != null) : []);
        ['cards', 'fans'].forEach((k) => { if (!ord.includes(k)) ord.push(k); });
        const hidK = new Set(c.klima_hidden || []);
        body = ord.filter((k) => !hidK.has(k)).map((k) => parts[k]).join('');
      }
      return `<section class="box" data-key="sec-klima">${this._head('klima', 'thermostat', 'Klima', sum)}${body}</section>`;
    }
    /* ------------ vifter (16.8): universal small-rad, mdi:fan roterer etter hastighet, −/+ til høyre */
    _fanInfo(id) {
      const s = this.s(id), a = (s && s.attributes) || {}, fan = id.startsWith('fan.');
      const isOn = M.isOn(s), unav = M.unavailable(s);
      const speed = fan && (a.percentage != null || a.percentage_step != null || (Number(a.supported_features) & 1) === 1);
      const step = Number(a.percentage_step) || (a.speed_count ? 100 / Number(a.speed_count) : 1);
      const n = Math.max(1, Math.round(100 / step));
      const pct = isOn ? this._v('fan', id, a.percentage != null ? Math.round(Number(a.percentage)) : 100, 6000) : 0;
      return { s, isOn, unav, speed, step, n, pct, lvl: Math.max(1, Math.round(pct / step)) };
    }
    _fanRow(id) {
      const F = this._fanInfo(id), nm = this._nm(id), lk0 = this._look(id);
      const status = F.unav ? 'Utilgjengelig' : !F.isOn ? 'Av' : !F.speed ? 'På' : F.n <= 10 ? `På · ${Math.min(F.lvl, F.n)} av ${F.n}` : `${M.nf(F.pct)} %`;
      // Rotasjon: 1,2 s ved lav → 0,5 s ved høy hastighet (uten hastighet: 0,8 s). Rolig = halv fart, Av = stille.
      const lvlA = this.config.appliance_animation || 'full';
      let dur = F.speed ? 1.2 - 0.7 * Math.max(0, Math.min(1, (F.pct - F.step) / Math.max(1, 100 - F.step))) : 0.8;
      if (lvlA === 'calm') dur *= 2;
      const anim = F.isOn && !F.unav && lvlA !== 'off' ? `animation:spinn ${dur.toFixed(2)}s linear infinite;` : '';
      const lk = M.universalLook(lk0, { state: F.isOn ? 'på' : 'av', on: F.isOn, w: 0, name: nm, entity: F.s });
      const btn = (d, ic, dis) => `<button class="fbtn msh-inner-c" data-act="fanstep" data-d="${d}" data-id="${esc(id)}" data-haptic="selection" ${dis ? 'disabled' : ''} aria-label="${d > 0 ? 'Øk' : 'Senk'} hastighet">${M.icon(ic, 22)}</button>`;
      const side = F.speed && !F.unav ? btn(-1, 'mdi:minus', !F.isOn) + btn(1, 'mdi:plus', F.isOn && F.pct >= 100) : '';
      return M.universal({
        state_rule_1_condition: F.isOn && !F.unav, state_rule_1_background_color: 'var(--blue, rgb(115 185 242))', state_rule_1_text_color: 'var(--ki-on-accent, var(--gray000))',
        ...lk, mode: 'sensor', size: 'small', entity: id, st: F.s, key: 'f-' + id,
        act: F.unav ? null : 'dtoggle', id, haptic: 'success', cls: `msh-inner fan${F.isOn ? ' on' : ''}${F.unav ? ' d-unav' : ''}`,
        icon_html: M.icon(lk.icon || (F.isOn ? 'mdi:fan' : 'mdi:fan-off'), 30, anim),
        main_text: lk.main_text || lk.sub_text || nm, sub_text: status, alt_text: '', side_html: side, ...(this._tag(id, true) ? { sub_html: esc(status) + this._tag(id, true) } : {}),
        background_color: lk.background_color, icon_color: lk.icon_color });
    }
    _fanStep(id, d) {
      const F = this._fanInfo(id), h = this.hass;
      if (!F.s || !F.speed) return;
      // − ved laveste slår av, + fra av slår på laveste; ellers set_percentage ± percentage_step
      if (!F.isOn) { if (d < 0) return; this._pend['fan|' + id] = { v: Math.round(F.step), t: Date.now() }; this.update(); return M.call(h, 'fan', 'turn_on', { entity_id: id, percentage: Math.round(F.step) }).catch(() => {}); }
      const v = Math.round(M.clamp(Math.round(F.pct / F.step) * F.step + d * F.step, 0, 100));
      if (v <= 0) return M.call(h, 'fan', 'turn_off', { entity_id: id }).catch(() => {});
      this._pend['fan|' + id] = { v, t: Date.now() };
      this.update();
      return M.call(h, 'fan', 'set_percentage', { entity_id: id, percentage: v }).catch(() => {});
    }
    _kv(id) {
      const s = this.s(id);
      const real = s && s.attributes.temperature != null ? Number(s.attributes.temperature) : null;
      const p = this._kpend[id];
      if (p && Date.now() - p.t < 5000 && p.v !== real) return p.v;
      if (p && !p.timer) delete this._kpend[id];
      return real;
    }
    _dots(n, idx) {
      // Fiks 50 D: prikk-raden tegnes bare ved 2+ kort – ett kort gir ingen rad og ingen reservert høyde.
      return n > 1 ? M.dotsHTML(n, idx) : ''; // felles trykkbare prikker (17.12)
    }

    /* ------------ media */
    _media() {
      const ids0 = this._L.lists.media;
      if (!ids0.length) return '';
      const open = !!(this.ui.acc || {}).media;
      let playing = 0;
      // 17.4: spillere som spiller vises først (stabil rekkefølge ellers)
      const isPl = (id) => { const s = this.s(id); return !!s && s.state === 'playing'; };
      const ids = [...ids0.filter(isPl), ...ids0.filter((id) => !isPl(id))];
      let anyPk = false;
      const cards = ids.map((id) => {
        const s = this.s(id), a = (s && s.attributes) || {};
        const pl = !!s && s.state === 'playing';
        if (pl) playing++;
        if (!open) return '';
        const off = !s || ['off', 'standby', 'unavailable', 'unknown'].includes(s.state);
        // 17.4: rosa spiller-kort når det spilles (pause beholder det så lenge media_title finnes); av/idle = 16.6
        const pk = pl || (!!s && s.state === 'paused' && !!a.media_title);
        if (pk) anyPk = true;
        const title = a.media_title ? (a.media_artist ? `${a.media_title} · ${a.media_artist}` : a.media_title) : '';
        const stTxt = pk ? (a.media_title ? (a.media_artist ? `${a.media_artist} – ${a.media_title}` : a.media_title) : 'Spiller')
          : !s ? 'Finnes ikke' : M.unavailable(s) ? 'Utilgjengelig' : pl ? (title || 'Spiller') : s.state === 'paused' ? (title ? `Pauset · ${title}` : 'Pauset') : off ? 'Av' : 'Klar';
        const vol = this._v('vol', id, Math.round((a.volume_level || 0) * 100));
        // 19.16: TV (M.isTvPlayer: device_class tv / valgt som TV i Media / remote.* på samme enhet) → TV-variant:
        // enhetsnavn på første linje, kanal/tittel + program, logo i avrundet firkant (contain), TV-kontroller og volum − / +.
        const tv = M.isTvPlayer(this.hass, id), sf = Number(a.supported_features) || 0;
        const icon = tv || a.device_class === 'tv' || /tv/i.test(id) ? 'tv' : 'speaker';
        // 20.17: albumbilde 54 px inni kortet (object-fit cover); uten bilde mørk sirkel med album-ikon 24 px (TV: tv-ikon)
        // 51 A: felles M.stationArt – entity_picture (hassUrl), ellers kanallogo fra Media-kortets station_logos + innebygd
        // tabell (ikke TV); cover / contain på mørk flate; feilet bilde → logo / ikon (M.stationArtBind i render)
        const SA = pk && M.stationArt ? M.stationArt(this.hass, s, undefined, { noLogo: tv }) : { url: pk && a.entity_picture ? a.entity_picture : '', kind: pk && a.entity_picture ? 'picture' : 'none' };
        const pic = SA.url ? (M.stationArtImg ? M.stationArtImg(SA) : `<img src="${esc(SA.url)}" alt="">`) : M.icon(tv ? 'tv' : 'album', 24);
        const hp = (x) => (pk ? 'light' : x);
        const nmTv = tv ? (((M.mediaCardCfg().players || {})[obj(id)] || {}).name || a.friendly_name || this._nm(id)) : this._nm(id);
        const stTv = tv && pk ? (a.media_title || a.media_channel || a.app_name || 'Spiller') : stTxt, sub2 = tv && pk && a.media_series_title && a.media_series_title !== stTv ? a.media_series_title : '';
        const hasLvl = a.volume_level != null && !isNaN(Number(a.volume_level));
        const slider = !tv; // musikk uendret (slider); TV: alltid − / + (prosent bare når volume_level finnes)
        const volRow = slider
          ? `<div class="mv"><span class="mvl">Volum</span><div class="vs ${this._dragging('vol', id) ? 'drag' : ''}" data-slide="vol" data-id="${esc(id)}"><span class="cvt"></span><span class="cvf" style="width:${vol}%"></span><span class="knob" style="left:calc(${vol}% - 11px)"></span></div><span class="mvp num">${vol}%</span></div>`
          : `<div class="mv"><span class="mvl">Volum</span><div class="tvv"><button class="tvb" data-tvvol="-1" data-id="${esc(id)}" title="Volum ned" aria-label="Volum ned">${M.icon('mdi:minus', 20)}</button><span class="tvl">${M.icon(a.is_volume_muted ? 'mdi:volume-off' : 'mdi:volume-low', 18)}${hasLvl ? `<span class="num">${Math.round(Number(a.volume_level) * 100)} %</span>` : ''}</span><button class="tvb" data-tvvol="1" data-id="${esc(id)}" title="Volum opp" aria-label="Volum opp">${M.icon('mdi:plus', 20)}</button></div></div>`;
        const ch = tv && (sf & 16 || sf & 32); // PREVIOUS_TRACK / NEXT_TRACK → kanal − / +
        const ctl = tv ? `
              <button class="mb press" data-act="mpower" data-id="${esc(id)}" data-haptic="${hp('medium')}" title="Av/på">${M.icon('power_settings_new', 22)}</button>
              ${ch ? `<button class="mb press" data-act="mcmd" data-cmd="media_previous_track" data-id="${esc(id)}" title="Forrige kanal" ${pk ? 'data-haptic="light"' : ''}>${M.icon('mdi:chevron-down', 24)}</button>` : ''}
              <button class="mb press" data-act="tvseek" data-d="-10" data-id="${esc(id)}" title="10 s tilbake" ${pk ? 'data-haptic="light"' : ''}>${M.icon('mdi:rewind-10', 24)}</button>
              <button class="mp press msh-inner-c" data-act="mcmd" data-cmd="media_play_pause" data-id="${esc(id)}" data-haptic="${hp('success')}">${M.icon(pl ? 'pause' : 'play_arrow', 28)}</button>
              <button class="mb press" data-act="tvseek" data-d="30" data-id="${esc(id)}" title="30 s fram" ${pk ? 'data-haptic="light"' : ''}>${M.icon('mdi:fast-forward-30', 24)}</button>
              ${ch ? `<button class="mb press" data-act="mcmd" data-cmd="media_next_track" data-id="${esc(id)}" title="Neste kanal" ${pk ? 'data-haptic="light"' : ''}>${M.icon('mdi:chevron-up', 24)}</button>` : ''}
              <button class="mb mo" data-act="more" data-id="${esc(id)}" ${pk ? 'data-haptic="light"' : ''}>${M.icon('mdi:dots-horizontal', 24)}</button>` : `
              <button class="mb press" data-act="mpower" data-id="${esc(id)}" data-haptic="${hp('medium')}">${M.icon('power_settings_new', 22)}</button>
              <button class="mb press" data-act="mcmd" data-cmd="media_previous_track" data-id="${esc(id)}" ${pk ? 'data-haptic="light"' : ''}>${M.icon('skip_previous', 24)}</button>
              <button class="mp press msh-inner-c" data-act="mcmd" data-cmd="media_play_pause" data-id="${esc(id)}" data-haptic="${hp('success')}">${M.icon(pl ? 'pause' : 'play_arrow', 28)}</button>
              <button class="mb press" data-act="mcmd" data-cmd="media_next_track" data-id="${esc(id)}" ${pk ? 'data-haptic="light"' : ''}>${M.icon('skip_next', 24)}</button>
              <button class="mb mo" data-act="more" data-id="${esc(id)}" ${pk ? 'data-haptic="light"' : ''}>${M.icon('mdi:dots-horizontal', 24)}</button>`;
        const logo = tv && pk && SA.kind === 'picture';
        return `<div class="mc${tv ? ' tvc' : ''}" data-key="m-${esc(id)}">
          <div class="mt msh-inner${pk ? ' pk' : ''}${logo ? ' lg' : ''}" data-ent="${esc(id)}"><span class="mpk"></span><span class="mh"><span class="mn ell">${esc(nmTv)}${this._tag(id, true)}</span><span class="ms ell">${esc(stTv)}</span>${sub2 ? `<span class="ms2 ell">${esc(sub2)}</span>` : ''}</span>
            <span class="art${logo ? ' logo' : ''}${SA.url && !logo ? ' img' : ''}" data-sa-kind="${SA.kind}">${pic}</span>
            <div class="mctl${tv && ch ? ' m7' : ''}">${ctl}
            </div></div>
          ${volRow}
        </div>`;
      }).join('');
      const sum = this._tekst('media', this._listChanged('media')) || `${playing} spiller - ${ids.length - playing} av`;
      const idx = Math.min(this.ui.mIdx || 0, ids.length - 1);
      return `<section class="box" data-key="sec-media">${this._head('media', 'speaker', 'Media', sum)}${open ? `<div class="cw mcw"><div class="car noscroll${anyPk ? ' pkc' : ''}" data-car="mIdx">${cards}</div>${this._dots(ids.length, idx)}</div>` : ''}</section>`;
    }

    /* ------------ sensorer */
    _sensors() {
      const ids = this._L.lists.sensorer;
      if (!ids.length) return '';
      const open = !!(this.ui.acc || {}).sens;
      let act = 0;
      const SH = {};
      ids.forEach((id) => { SH[id] = ((id) => {
        const s = this.s(id), a = (s && s.attributes) || {};
        const cls = this._L.cls[id] || a.device_class || '';
        const bin = id.startsWith('binary_sensor.');
        const hot = bin && !!s && s.state === 'on' && !CALM.includes(cls);
        if (hot) act++;
        if (!open) return '';
        const nm = this._nm(id);
        const state = !s ? 'Finnes ikke' : M.unavailable(s) ? 'Utilgjengelig' : bin ? ((BS[cls] || ['På', 'Av'])[s.state === 'on' ? 0 : 1]) : M.fmtState(this.hass, id);
        const icon0 = a.icon || SENS_ICON[cls] || M.domainIcon(id, s);
        // Universal-rad (07-universal.js). Standard regel 1: aktiv (bevegelse/åpen/fukt …) → grønn bakgrunn, mørk tekst.
        const ctx = { state, name: nm, w: 0, entity: s }, lk0 = this._look(id), lk = M.universalLook(lk0, ctx);
        const ownRule = Object.keys(lk0).some((k) => /^state_rule_1_(value|condition)$/.test(k) && lk0[k] != null && lk0[k] !== '');
        const num = !!s && !bin && M.isNum(s.state), u = num ? String(a.unit_of_measurement || '') : '';
        const dflt = num ? { main_text: M.nf(Number(s.state), Number(s.state) % 1 ? 1 : 0), symbol: u === '°C' || u === '°F' ? '°' : u === '%' ? '%' : u ? ' ' + u : '' } : { main_text: M.isLux && M.isLux(s) && M.unavailable(s) ? '–' : state }; // 17.5: utilgjengelig lux → «–»
        // 17.5: lux-sensor → oransje rad med sol-ikon og «6.3 lx» (egen farge/ikon i «Tilpass rom» vinner)
        const lux = !bin && M.luxOpts && (!lk.mode || lk.mode === 'sensor') && (lk.size || 'small') === 'small' ? M.luxOpts(s) || {} : {};
        // Del 44: egen regel med bakgrunn men uten tekstfarge → mørk tekst (tekst på aksentflate er alltid mørk)
        [1, 2, 3].forEach((i) => { const k = 'state_rule_' + i + '_'; if (lk[k + 'background_color'] && !lk[k + 'text_color']) lk[k + 'text_color'] = SENS_FG; });
        const uo = {
          state_rule_1_condition: ownRule ? undefined : hot, state_rule_1_background_color: 'var(--green, #66d19e)', state_rule_1_text_color: SENS_FG,
          text_color: lux.text_color, ...lk, mode: lk.mode || 'sensor', size: lk.size || 'small', entity: id, st: s, key: 's-' + id, icon: lk.icon || lux.icon || icon0,
          cls: 'msh-inner' + (lux.cls ? ' ' + lux.cls : ''), // 16.6: felles «indre rad-flate» (M.INNER_ROW)
          main_text: lk.main_text || lk.label || (lk.mode === 'bar' ? null : lux.main_text || dflt.main_text), symbol: lk.symbol != null && lk.symbol !== '' ? lk.symbol : lk.main_text || lk.label || lk.mode === 'bar' ? null : lux.symbol || dflt.symbol,
          sub_text: lk.sub_text || lk.name || nm, alt_text: lk.alt_text != null ? lk.alt_text : bin && s && !M.unavailable(s) ? M.relTime(s.last_changed) : '',
          background_color: lk.background_color || lk.bg || lux.background_color, circle_color: lk.cell || lux.circle_color, icon_color: lk.icon_color || lux.icon_color,
          ...(this._tag(id) ? { sub_html: esc([lk.sub_text || lk.name || nm, lk.alt_text != null ? lk.alt_text : bin && s && !M.unavailable(s) ? M.relTime(s.last_changed) : ''].filter(Boolean).join(' · ')) + this._tag(id), alt_text: '' } : {}) };
        // Del 44: aksent-pille (regel med mørk tekst, eller lux-raden) → s-acc: ikon-sirkel hvit .35, undertekst/chip i mørk tone
        const R = M.uRule ? M.uRule(uo, s) : null;
        if ((R && R.bg && R.fg === SENS_FG) || (!R && lux.cls && !lk.background_color && !lk.bg && !lk.text_color)) uo.cls += ' s-acc';
        return M.universal(uo);
      })(id); });
      const rows = open ? this._grp(ids, (id) => SH[id]) : '';
      const sum = this._tekst('sensorer', this._listChanged('sensorer')) || `${act} aktiv - ${ids.length - act} stille`;
      return `<section class="box" data-key="sec-sens">${this._head('sens', 'directions_walk', 'Sensorer', sum)}${open ? `<div class="bd"><div class="lst">${rows}</div></div>` : ''}</section>`;
    }

    /* ------------ handlinger */
    onAction(name, el, ev) {
      const d = el.dataset, h = this.hass;
      // sections_mode: single → åpner man én, lukkes de andre (også gardin-listen)
      const single = this.config.sections_mode === 'single';
      if (name === 'acc') { const on = !(this.ui.acc || {})[d.k]; const acc = single && on ? {} : { ...(this.ui.acc || {}) }; acc[d.k] = on; return this.setUI(single && on ? { acc, cvOpen: false } : { acc }); }
      if (name === 'cvx') { const on = !this.ui.cvOpen; return this.setUI(single && on ? { cvOpen: true, acc: {} } : { cvOpen: on }); }
      if (name === 'scene') return M.toggle(h, d.id).catch(() => {});
      // 36.3 · «Alle lys» i et kombinert rom: av når noe er på, ellers på – lysene i alle rommene (etter exclude/include)
      if (name === 'alllights') { const ids = this._L ? this._L.lists.lys : []; if (!ids.length) return; const on = ids.some((id) => M.isOn(this.s(id))); M.toast(`Alle lys ${on ? 'av' : 'på'}`); return M.call(h, 'light', on ? 'turn_off' : 'turn_on', { entity_id: ids }).catch(() => {}); } // button.press / scene.turn_on / script.turn_on (haptic via data-haptic)
      if (name === 'cvall') { const v = Number(d.v); (this._L ? this._L.lists.gardiner : []).forEach((id) => this._commit('cover', id, v)); return; }
      if (name === 'kset') return this._kstep(d.id, Number(d.d));
      // 16.5/16.8: hele raden er knappen – switch/fan/input_boolean.toggle (andre domener: felles toggle)
      if (name === 'dtoggle') { const dom = d.id.split('.')[0]; return (['switch', 'fan', 'input_boolean', 'light'].includes(dom) ? M.call(h, dom, 'toggle', { entity_id: d.id }) : M.toggle(h, d.id)).catch(() => {}); }
      if (name === 'fanstep') { if (ev) ev.stopPropagation(); return this._fanStep(d.id, Number(d.d)); }
      if (name === 'mcmd') return M.call(h, 'media_player', d.cmd, { entity_id: d.id });
      if (name === 'tvseek') return this._tvSeek(d.id, Number(d.d));
      if (name === 'mpower') { const s = h.states[d.id]; const off = !s || ['off', 'standby'].includes(s.state); return M.call(h, 'media_player', off ? 'turn_on' : 'turn_off', { entity_id: d.id }); }
      return super.onAction(name, el, ev);
    }
    // 19.16: ⟲10 / 30⟳ for TV: media_seek når spilleren støtter SEEK og har posisjon, ellers fjernkontrollen (remote.* på
    // samme enhet: Apple TV skip_backward/skip_forward, Android/Google TV MEDIA_REWIND/MEDIA_FAST_FORWARD).
    _tvSeek(id, sec) {
      const h = this.hass, s = h.states[id], a = (s && s.attributes) || {};
      if ((Number(a.supported_features) & 2) && a.media_position != null) {
        const upd = a.media_position_updated_at ? Date.parse(a.media_position_updated_at) : NaN;
        const pos = Number(a.media_position) + (s.state === 'playing' && !isNaN(upd) ? (Date.now() - upd) / 1000 : 0);
        return M.call(h, 'media_player', 'media_seek', { entity_id: id, seek_position: Math.max(0, Math.round(pos + sec)) }).catch(() => {});
      }
      const dev = (M.regEntry(h, id) || {}).device_id;
      const rem = dev ? Object.keys(h.states).find((x) => x.startsWith('remote.') && (M.regEntry(h, x) || {}).device_id === dev) : null;
      if (!rem) return M.toast('TV-en støtter ikke spoling');
      const apple = ((M.regEntry(h, rem) || {}).platform || '') === 'apple_tv';
      return M.call(h, 'remote', 'send_command', { entity_id: rem, command: apple ? (sec < 0 ? 'skip_backward' : 'skip_forward') : (sec < 0 ? 'MEDIA_REWIND' : 'MEDIA_FAST_FORWARD') }).catch(() => {});
    }
    // 19.16: volum − / + for TV: ett trinn per trykk (M.tvVolStep = «Volum styres av» i Media), hold gjentar hvert
    // 250 ms etter 400 ms. Haptic light per trinn. stopPropagation → Bubble Card / rad-hold får ikke trykket.
    _bindTvVol(el) {
      let t1 = null, t2 = null;
      const stop = () => { clearTimeout(t1); clearInterval(t2); t1 = t2 = null; };
      const step = () => { M.haptic('light'); M.tvVolStep(this.hass, el.dataset.id, Number(el.dataset.tvvol)).catch(() => {}); };
      el.style.touchAction = 'manipulation';
      el.addEventListener('pointerdown', (e) => {
        e.stopPropagation(); this._cancelHold();
        if (e.button) return;
        stop(); step();
        t1 = setTimeout(() => { t2 = setInterval(step, 250); }, 400);
      });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach((t) => el.addEventListener(t, stop));
      el.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
      el.addEventListener('touchmove', (e) => e.stopPropagation(), { passive: true });
      el.addEventListener('click', (e) => e.stopPropagation());
    }
    _kstep(id, dir) {
      const s = this.hass.states[id];
      if (!s) return;
      const a = s.attributes, step = Number(a.target_temp_step) || 0.5;
      const cur = this._kv(id);
      if (cur == null) return;
      const v = M.clamp(Math.round((cur + dir * step) / step) * step, a.min_temp != null ? Number(a.min_temp) : 7, a.max_temp != null ? Number(a.max_temp) : 35);
      const p = this._kpend[id] = { ...(this._kpend[id] || {}), v, t: Date.now() };
      clearTimeout(p.timer);
      p.timer = setTimeout(() => { p.timer = null; p.t = Date.now(); M.call(this.hass, 'climate', 'set_temperature', { entity_id: id, temperature: v }).catch(() => {}); }, 650);
      this.update();
    }
    _commit(kind, id, v) {
      const h = this.hass, s = h.states[id], a = (s && s.attributes) || {};
      this._pend[kind + '|' + id] = { v, t: Date.now() };
      if (kind === 'cover') {
        if ((Number(a.supported_features) & 4) || a.current_position != null) M.call(h, 'cover', 'set_cover_position', { entity_id: id, position: v }).catch(() => {});
        else M.call(h, 'cover', v >= 50 ? 'open_cover' : 'close_cover', { entity_id: id }).catch(() => {});
      } else if (kind === 'vol') M.call(h, 'media_player', 'volume_set', { entity_id: id, volume_level: v / 100 }).catch(() => {});
      this.update();
    }
    _tap(kind, id, v) {
      const h = this.hass;
      if (kind === 'cover') { M.haptic('success'); const cur = this._cvPos(id); this._commit('cover', id, cur > 0 ? 0 : 100); return; }
    }

    /* ------------ drag/sveip (touch-action + stopPropagation → Bubble Card lukker ikke popupen) */
    _guard(el, ta) {
      if (ta) el.style.touchAction = ta;
      el.addEventListener('pointerdown', (e) => { this._onDown(e); e.stopPropagation(); });
      el.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
      el.addEventListener('touchmove', (e) => e.stopPropagation(), { passive: true });
    }
    _bindSlide(el) {
      this._guard(el, 'none');
      let st = null;
      const frac = (e) => { const r = el.getBoundingClientRect(); return M.clamp((e.clientX - r.left) / (r.width || 1), 0, 1); };
      el.addEventListener('pointerdown', (e) => {
        if (e.button) return;
        try { el.setPointerCapture(e.pointerId); } catch (x) { /* */ }
        st = { x: e.clientX, t: Date.now(), moved: false, step: null };
      });
      el.addEventListener('pointermove', (e) => {
        if (!st) return;
        if (!st.moved && Math.abs(e.clientX - st.x) > 5) { st.moved = true; this._cancelHold(); }
        if (!st.moved) return;
        e.preventDefault();
        const f = frac(e), step = Math.round(f * 20);
        if (step !== st.step) { st.step = step; M.haptic('selection'); }
        this._drag = { kind: el.dataset.slide, id: el.dataset.id, v: Math.round(f * 100) };
        // 17.4: volum sendes throttlet (~150 ms) under drag, endelig verdi ved slipp
        if (el.dataset.slide === 'vol' && Date.now() - (st.sent || 0) > 150) { st.sent = Date.now(); M.call(this.hass, 'media_player', 'volume_set', { entity_id: el.dataset.id, volume_level: this._drag.v / 100 }).catch(() => {}); }
        this.update();
      });
      el.addEventListener('pointerup', (e) => {
        if (!st) return;
        const s0 = st; st = null;
        const kind = el.dataset.slide, id = el.dataset.id, v = Math.round(frac(e) * 100);
        this._drag = null;
        if (s0.moved) this._commit(kind, id, v);
        else if (Date.now() - s0.t < 450) this._tap(kind, id, v);
        else this.update();
      });
      el.addEventListener('pointercancel', () => { st = null; this._drag = null; this.update(); });
    }
    setConfig(c) {
      super.setConfig(c);
      this._spaced = false;
      if (this._area) M.setRoomCfg(this._area, this._roomCfg());
      this._applySpacing();
    }
    _roomCfg() { const c = this.config; return { overrides: c.overrides || {}, include: c.include || {}, gap: c.gap, pad_top: c.pad_top, pad_bottom: c.pad_bottom, icon_color_mode: c.icon_color_mode, icon_tap: c.icon_tap }; }
    // Hver åpning via hash starter fra «Åpen ved start» – det som var åpent sist huskes ikke.
    onOpen() { this._ui.acc = null; this._accSig = null; this._schedule(true); if (M.store) M.store.refresh(this.hass); this._applySpacing(); setTimeout(() => this._applySpacing(), 350); }
    afterRender() {
      const R = this.shadowRoot;
      const area = M.roomArea(this);
      if (area && (this._pubArea !== area || this._pubCfg !== this._rawConfig)) { this._pubArea = area; this._pubCfg = this._rawConfig; M.setRoomCfg(area, this._roomCfg()); }
      if (!this._spaced && M.popupContainer(this)) { this._spaced = true; requestAnimationFrame(() => this._applySpacing()); }
      R.querySelectorAll('[data-slide]').forEach((el) => { if (el.__b) return; el.__b = true; this._bindSlide(el); });
      R.querySelectorAll('[data-hs]').forEach((el) => { if (el.__b) return; el.__b = true; this._guard(el, 'pan-x pan-y'); }); // Fiks 56 G: vertikalt sveip fra scenene scroller popupen
      R.querySelectorAll('[data-tvvol]').forEach((el) => { if (el.__b) return; el.__b = true; this._bindTvVol(el); });
      // Vifte −/+ (16.8): egen handling – ikke radens toggle/hold, og ikke Bubble Cards sveip
      R.querySelectorAll('.fbtn').forEach((el) => { if (el.__b) return; el.__b = true; el.addEventListener('pointerdown', (e) => { e.stopPropagation(); this._cancelHold(); }); el.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true }); });
      // Felles karusell (17.12/17.17): prikkene oppdateres i DOM-en, siden lagres stille – ingen tegning under sveip.
      R.querySelectorAll('[data-car]').forEach((el) => {
        const k = el.dataset.car, d = el.nextElementSibling;
        M.snapCarousel(el, { dots: () => (d && d.classList.contains('msh-dots') ? d : null), index: () => this.ui[k] || 0, onIndex: (i) => this.setUI({ [k]: i }, true), haptic: 'selection' });
        if (el.__b) return;
        el.__b = true;
        this._guard(el, 'pan-x pan-y');
      });
    }

    get styles() {
      return `
        .rom{display:flex;flex-direction:column;gap:var(--msh-gap, 8px)}
        .ell{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .unav{opacity:.5}
        /* rullegardin */
        .cvbox{border-radius:33px;background:${G.g200}}
        /* 35.5 / 35.7 regel 7: navnet kuttes aldri – fast kolonne 112 px, to linjer ved behov («Gardiner / Venstre») */
        .cvr{display:flex;align-items:center;gap:14px;min-height:66px;padding:8px 14px 8px 22px;box-sizing:border-box}
        .cvn,.cvn2{flex:0 0 112px;width:112px;min-width:0;line-height:1.2;overflow-wrap:anywhere;word-break:normal;text-wrap:balance;white-space:normal;hyphens:manual}
        .cvn{font-size:15px;font-weight:500}
        .cvp{font-size:15px;min-width:40px;text-align:right}
        .cvs,.vs{position:relative;flex:1;min-width:0;height:28px;display:flex;align-items:center;touch-action:none;cursor:pointer;user-select:none}
        .vs{height:24px}
        .cvt{position:absolute;left:0;right:0;height:8px;border-radius:4px;background:var(--ki-surface-3, var(--ki-popup, #282828))}
        .cvf{position:absolute;left:0;height:8px;border-radius:4px;background:${PINK};transition:width .3s}
        .knob{position:absolute;width:22px;height:22px;border-radius:11px;background:var(--ki-knob, var(--white, #fafafa));box-shadow:0 2px 6px ${TH && TH.blackA ? TH.blackA(0.4) : 'rgb(0 0 0 / 0.4)'};transition:left .3s}
        .drag .cvf,.drag .knob{transition:none}
        .cvx{width:36px;height:36px;display:grid;place-items:center;flex:none}
        .cvo{display:flex;flex-direction:column;gap:14px;padding:4px 12px 16px}
        .cvpre{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}
        .pre{height:40px;border-radius:20px;background:var(--ki-surface-2, #2a2a2a);color:var(--ki-text, #fafafa);font-size:14px;transition:background .2s,color .2s}
        .pre.on{background:${PINK};color:var(--ki-on-accent, #2a1720)}
        .pre:active{transform:scale(.95)}
        .cvr2{display:flex;align-items:center;gap:14px;padding:0 6px 0 10px}
        .cvn2{font-size:14px;font-weight:500}
        .cvp2{font-size:14px;min-width:40px;text-align:right}
        /* scener */
        .scn{display:flex;gap:8px;width:100%;overflow-x:auto;overflow-y:hidden;margin:0;padding:0;border-radius:0;scroll-padding-left:0;scroll-snap-type:x proximity;overscroll-behavior-x:contain;touch-action:pan-x pan-y;scrollbar-width:none}
        .scn::-webkit-scrollbar{display:none}
        .sc{flex:none;scroll-snap-align:start;width:100px;height:100px;border-radius:26px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:${G.g200};color:${G.w};transition:transform .2s;padding:0 8px}
        .sc:active{transform:scale(.95)}
        .scl{font-size:14px;font-weight:400;max-width:100%}
        /* 36.3 · kombinert rom: romtagg, underoverskrift per rom, «Alle lys»-bryter */
        .rtag{display:inline-block;vertical-align:middle;margin-left:6px;padding:1px 7px;border-radius:8px;font-size:11px;font-weight:500;line-height:16px;white-space:nowrap;background:color-mix(in srgb, currentColor 12%, transparent);opacity:.85}
        .cvn .rtag,.cvn2 .rtag{display:table;margin:3px 0 0}
        .stg{font-size:11px;line-height:14px;padding:1px 7px;border-radius:8px;max-width:100%;margin-top:-6px;background:color-mix(in srgb, currentColor 12%, transparent);color:${G.g800}}
        .rgh{font-size:12px;font-weight:600;letter-spacing:.02em;color:${G.g700};padding:6px 10px 0}
        .lw{display:flex;flex-direction:column;gap:4px}
        .ltg{padding:0 2px;line-height:1}
        .ltg .rtag{margin-left:0;color:${G.g800}}
        .acw{display:flex;align-items:center}
        .acw>.acc{flex:1;min-width:0;padding-right:8px}
        .alls{flex:none;display:flex;align-items:center;gap:8px;height:66px;padding:0 20px 0 6px;font-size:12px;color:${G.g700}}
        .asw{position:relative;width:44px;height:26px;border-radius:13px;background:${G.g400};transition:background .2s}
        .asw::after{content:'';position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:10px;background:var(--ki-knob, var(--white, #fafafa));transition:left .2s}
        .asw.on{background:${PINK}}
        .asw.on::after{left:21px}
        /* akkordeon */
        .box{border-radius:32px;background:${G.g200};overflow:hidden}
        .acc{width:100%;height:66px;padding:0 20px 0 24px;display:flex;align-items:center;gap:16px;text-align:left}
        .acct{flex:1;font-size:16px;font-weight:500}
        .accs{font-size:13px;color:${G.g700};white-space:nowrap}
        .bd{padding:0 8px 8px}
        .box>.bd,.box>.cw,.cvo{animation:accin .22s cubic-bezier(.3,.9,.3,1)}
        @keyframes accin{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
        @media (prefers-reduced-motion:reduce){.box>.bd,.box>.cw,.cvo{animation:none}}
        /* lys (Fiks 41 · Rom v4 lights): kolonne med 10 px mellom radene, padding 0 8 6 inni .bd (0 8 8) */
        .lts{display:flex;flex-direction:column;gap:10px;padding:0 8px 6px}
        ${M.LIGHT_ROW_CSS || ''}
        /* enheter / sensorer */
        .lst{display:flex;flex-direction:column;gap:8px}
        .pill{display:flex;align-items:center;gap:14px;height:66px;padding:0 16px 0 5px;border-radius:33px;text-align:left;width:100%;box-shadow:none;transition:background .25s,transform .2s}
        .dv:active{transform:scale(.98)}
        .sn{cursor:pointer}
        .iw{width:56px;height:56px;border-radius:28px;flex:none;display:grid;place-items:center;transition:background .25s}
        .pt{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
        .pn{font-size:15px;font-weight:500}
        .ps{font-size:12px}
        @keyframes rist{0%,100%{transform:translate(0,0) rotate(0)}20%{transform:translate(-1px,-1px) rotate(-7deg)}40%{transform:translate(1px,0) rotate(6deg)}60%{transform:translate(-1px,1px) rotate(-5deg)}80%{transform:translate(1px,-1px) rotate(4deg)}}
        @keyframes puls{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}
        @keyframes spinn{to{transform:rotate(360deg)}}
        ${M.APPLIANCE_CSS || ''}
        ${M.UNIVERSAL_CSS || ''}
        ${M.INNER_ROW_CSS || ''}
        /* enheter (16.5) / vifter (16.8) */
        .u-act .u-l{font-weight:600}
        .d-unav{opacity:.55}
        /* 38 (Rom v4 devices): navn øverst 15/500, status under 12 – alle enhetsrader (sensor-/small-varianten) */
        .u-small.u-m-sensor.d-row .u-n{grid-area:l;align-self:end;padding-top:0;font-size:15px;font-weight:500;opacity:1;color:var(--u-fg)}
        .u-small.u-m-sensor.d-row .u-l{grid-area:n;align-self:start;padding-top:2px;font-size:12px;font-weight:400;line-height:1.3;opacity:1;color:${G.g700}}
        /* 38: aksentflate – undertekst 12/600 rgba(31,31,31,.8), ikon-sirkel rgba(0,0,0,.12) uten kant, mørkt ikon */
        .u-small.u-m-sensor.d-row.d-acc .u-l{font-weight:600;color:var(--u-fg);opacity:.8}
        .u.d-acc.d-acc{box-shadow:none}
        .d-acc .u-i{border:none;box-shadow:none}
        /* Del 44 (Rom v4 sensors → pill/iconWrap/subStyle/stateStyle): aktiv sensor på aksentflate – mørk tittel/ikon,
           ikon-sirkel hvit .35 uten kant, undertekst mørk .78, status-chip mørk .14 – ingen opacity, ingen arvet farge */
        .u.s-acc.s-acc{box-shadow:none}
        .u.s-acc .u-i{background:rgb(255 255 255 / 0.35);border:none;box-shadow:none;color:${SENS_FG}}
        .u.s-acc .u-l,.u.s-acc.u-lux .u-n{color:${SENS_FG};opacity:1}
        .u.s-acc .u-n,.u.s-acc .u-alt,.u.s-acc .u-sym,.u-small.u-lux.s-acc .u-l{color:color-mix(in srgb, ${SENS_FG} 78%, transparent);opacity:1}
        .u.s-acc .rtag{background:color-mix(in srgb, ${SENS_FG} 14%, transparent);color:${SENS_FG};font-weight:600;opacity:1}
        /* 17.6: flere enheter på – fargerekkefølge */
        .u.d-on.d-on{box-shadow:none;transition:background .3s,transform .2s}
        .d-unav .u-l,.d-unav .u-i{opacity:1}
        /* 20.15: av – pille --ki-surface-3, tekst --ki-text, undertekst --ki-text-mid 12/400, ikon-sirkel --ki-surface med svak kant, 250 ms */
        .u.d-off{transition:background .25s,transform .2s}
        .d-off .u-i{border:none;box-shadow:inset 0 0 0 1px ${wa(0.06)}}
        .d-off .u-n{opacity:1}
        .fbtn{width:48px;height:48px;border-radius:50%;display:grid;place-items:center;color:var(--ki-text-1, var(--gray1000, #e1e1e1));flex:none;transition:transform .15s,background .25s}
        .fbtn:active{transform:scale(.92)}
        .fbtn[disabled]{opacity:.35}
        .fan.on .fbtn{background:rgb(0 0 0 / 0.12);border-color:transparent;color:${ON_ACC}}
        @media (prefers-reduced-motion:reduce){.u ha-icon{animation:none !important}}
        /* karuseller (klima/media) */
        /* Fiks 50 D (Rom v4 ac.klima/climSw): 8 px mellom alle elementer, 8 px side-/bunnpadding – kort → 8 → prikker (12) → 8 → neste rad */
        .cw{display:flex;flex-direction:column;align-items:center;gap:8px;padding:0 8px 8px}
        .car{width:100%;display:flex;overflow-x:auto;scroll-snap-type:x mandatory;border-radius:26px;overscroll-behavior-x:contain}
        .cw>.dots.msh-dots{height:12px;gap:6px} /* prikkene: felles .msh-dots (18.3) – 10 px, aktiv 12 px, gap 6 */
        /* klima */
        .kc{position:relative;flex:none;width:100%;height:155px;scroll-snap-align:start;border-radius:26px;overflow:hidden;transition:background .4s,border-radius .3s}
        /* 16.8: rosa «varmer»-lag (opasitet → 300 ms overgang), mørk tekst */
        .kpk{position:absolute;inset:0;border-radius:inherit;background:linear-gradient(135deg, #f294c8, #f5cfd0);opacity:0;transition:opacity .3s;pointer-events:none}
        .kc.heat{border-radius:28px}
        .kc.heat .kpk{opacity:1}
        .kt{position:absolute;left:20px;top:18px;right:84px;display:flex;flex-direction:column;gap:2px}
        .kn{font-size:15px;font-weight:500;color:${G.g800};transition:color .3s}
        .ks{font-size:13px;color:${G.g600};transition:color .3s}
        .kb{position:absolute;left:20px;bottom:18px;display:flex;align-items:baseline;gap:4px;white-space:nowrap}
        .kv{font-size:44px;font-weight:300;letter-spacing:-0.04em;line-height:1;transition:color .3s,font-size .3s}
        .kh{font-size:13px;color:${G.g700};transition:color .3s}
        .kc.heat .kn{font-size:15px;font-weight:500;color:#2a1720}
        .kc.heat .ks{color:rgba(42,23,32,0.6)}
        .kc.heat .kv{font-size:56px;color:#2a1720}
        .kc.heat .kh{font-size:14px;color:rgba(42,23,32,0.6)}
        .kctl{position:absolute;right:10px;top:10px;bottom:10px;width:64px;border-radius:32px;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:6px 0;transition:background .3s,box-shadow .3s,color .3s}
        .kc.heat .kctl{background:rgb(255 255 255 / 0.18);box-shadow:inset 0 0 0 1px rgba(42,23,32,0.45);color:#1f1f1f}
        /* 16.1: trykk = #4a4a4a på pilen (~120 ms) */
        .kbtn{width:64px;height:44px;display:grid;place-items:center;color:inherit;transition:transform .15s,background .12s ease-out}
        .kbtn:active{transform:scale(.9);background:var(--ki-ctrl, #4a4a4a);transition:transform .15s,background 0s}
        .kc.heat .kbtn:active{background:rgb(255 255 255 / 0.3)}
        .kbtn[disabled]{opacity:.35}
        .kset{font-size:17px;font-weight:500}
        /* media */
        .mc{display:flex;flex-direction:column;flex:none;width:100%;scroll-snap-align:start}
        /* 16.6: spiller-flaten = «indre rad-flate» (M.INNER_ROW_CSS: .msh-inner / .msh-inner-c), som sensor-radene */
        .mt{position:relative;padding:20px 20px 16px;border-radius:26px}
        .mh{display:flex;flex-direction:column;gap:6px;padding-right:64px}
        .mn{font-size:12px;color:${G.g800}}
        .ms{font-size:17px;font-weight:500}
        .art{position:absolute;right:8px;top:8px;width:60px;height:60px;border-radius:30px;display:grid;place-items:center}
        .mctl{display:flex;align-items:center;justify-content:space-between;margin-top:28px}
        .mb{width:44px;height:44px;display:grid;place-items:center}
        .mp{width:64px;height:64px;border-radius:32px;display:grid;place-items:center}
        .vs .cvt{background:${G.g200};box-shadow:inset 0 0 0 1px ${wa(0.05)}} /* 18.9: samme spor som Media (kortfarge) */
        .mp:active{transform:scale(.94)}
        .mv{display:flex;align-items:center;gap:16px;padding:16px 12px 6px 20px}
        .mvl{font-size:14px;font-weight:500}
        /* 17.4: rosa spiller-kort (PINK, radius 28, padding 20, ingen kant). Rosa lag med opasitet → 300 ms overgang
           mellom av- og spiller-tilstand. Albumbildet (64) stikker 6 px ut øverst til høyre (.pkc gir plass i karusellen). */
        .mpk{position:absolute;inset:0;border-radius:inherit;background:${PINK};opacity:0;transition:opacity .3s;pointer-events:none}
        .mt,.mt .mn,.mt .ms,.mt .art,.mt .mb,.mt .mp{transition:color .3s,background .3s,border-radius .3s,font-size .3s,transform .15s}
        .mt>*:not(.mpk){position:relative}
        .mt>.art{position:absolute}
        .mt.pk{border-radius:28px;padding:20px;box-shadow:none;color:#2a1720}
        .mt.pk .mpk{opacity:1}
        .mt.pk .mh{padding-right:70px}
        .mt.pk .mn{font-size:15px;color:rgba(42,23,32,0.6)}
        .mt.pk .ms{font-size:18px;font-weight:500;color:#2a1720}
        .mt.pk .art{right:-6px;top:-6px;width:64px;height:64px;border-radius:32px;overflow:hidden;background:rgba(42,23,32,0.12);box-shadow:none;color:#2a1720}
        .art img{width:100%;height:100%;object-fit:cover;display:block}
        .mt.pk .mctl{margin-top:24px}
        .mt.pk .mb{width:48px;height:48px;border-radius:24px;background:rgba(42,23,32,0.08);color:#2a1720}
        .mt.pk .mb.mo{background:none}
        .mt.pk .mp{background:rgba(42,23,32,0.08);box-shadow:none;border:none;color:#2a1720}
        .mt.pk .art{border:none}
        .mt .press:active{transform:scale(.92)}
        .car.pkc{padding-top:6px}
        .car.pkc .mc{padding-right:6px;box-sizing:border-box}
        .mv .mvl{font-size:15px}
        .vs .cvt,.vs .cvf{height:6px;border-radius:3px}
        .mcw .dots{--dot-bg:${G.g400};--dot-on-bg:${G.g700}} /* 17.4: aktiv gray700; inaktiv gray400 (spesifisert gray200 er usynlig på seksjonsflaten) */
        .mvp{font-size:14px;min-width:36px;text-align:right}
        /* 19.16: TV – volum − / + (pille 40 px gray000 / lys: --ki-surface, runde knapper 34 px), logo i avrundet firkant (72, r18, contain) */
        .tvv{flex:1;min-width:0;height:40px;border-radius:20px;background:var(--ki-surface, var(--gray000, #232323));display:flex;align-items:center;justify-content:space-between;padding:0 3px}
        .tvb{width:34px;height:34px;border-radius:17px;display:grid;place-items:center;background:${wa(0.08)};color:${G.w};touch-action:manipulation;transition:transform .12s}
        .tvb:active{transform:scale(.9)}
        .tvl{display:flex;align-items:center;gap:6px;font-size:14px;color:${G.w}}
        .ms2{font-size:13px;color:${G.g800}}
        .mt.pk .ms2{color:rgba(42,23,32,0.6)}
        .mt.pk.lg .mh{padding-right:78px}
        .mt.pk .art.logo{right:-6px;top:-6px;width:72px;height:72px;border-radius:18px;padding:8px;box-sizing:border-box;overflow:hidden;background:rgb(255 255 255 / 0.9);box-shadow:none;border:none}
        .art.logo img{object-fit:contain}
        .mctl.m7 .mb{width:38px;height:38px}
        .mt.pk .mctl.m7 .mb{width:40px;height:40px;border-radius:20px}
        .mctl.m7 .mp{width:56px;height:56px;border-radius:28px}
        /* 20.17 (retter 17.4): kompakt spiller-kort ~140 px, albumbildet (54) helt inni kortet 8 px fra hjørnet – aldri ned i
           kontrollraden; teksten har padding-right 62 så den ikke går under bildet. Av = #2a2a2a (lys: --ki-surface-2). */
        .mt,.mt.pk{position:relative;overflow:hidden;border-radius:26px;padding:18px 16px 14px 20px;min-height:0;transition:background .3s}
        .mt.msh-inner{background:var(--ki-surface-2, #2a2a2a)}
        .mh,.mt.pk .mh,.mt.pk.lg .mh{gap:4px;padding-right:62px}
        .mn,.mt.pk .mn{font-size:13px;color:${G.g800}}
        .mt.pk .mn{color:rgba(42,23,32,0.7)}
        .ms,.mt.pk .ms{font-size:16px;font-weight:500;line-height:1.3}
        .art,.mt.pk .art,.mt.pk .art.logo{position:absolute;right:8px;top:8px;width:54px;height:54px;border-radius:27px;overflow:hidden;display:grid;place-items:center;border:none;box-shadow:none;background:var(--ki-surface-3, var(--gray000, #232323));color:${G.g800};--mdc-icon-size:24px}
        .mt.pk .art{background:rgba(42,23,32,0.85);color:rgb(250 250 250)}
        .mt.pk .art.img{background:rgba(42,23,32,0.12)}
        .mt.pk .art.logo{border-radius:14px;padding:6px;box-sizing:border-box;background:rgb(255 255 255 / 0.9)}
        .mctl,.mt.pk .mctl{margin-top:18px;justify-content:space-between}
        .mctl:not(.m7) .mb{width:42px;height:42px;border-radius:21px;background:${G.g200};color:${G.w}}
        .mt.pk .mctl:not(.m7) .mb{background:rgba(42,23,32,0.08);color:#2a1720}
        .mctl:not(.m7) .mb.mo,.mt.pk .mctl:not(.m7) .mb.mo{background:none}
        .mctl .mp,.mt.pk .mctl .mp,.mctl.m7 .mp{width:56px;height:56px;border-radius:28px}
        .car.pkc{padding-top:0}
        .car.pkc .mc{padding-right:0}
        /* tilpass */
        .tune{align-self:center;height:36px;padding:0 14px;border-radius:18px;display:flex;align-items:center;gap:6px;font-size:13px;font-weight:500;color:${G.g700}}
      `;
    }
  }
  M.define('msh-rom-card', Rom, 'MSH Rom', 'Rom-popupen: rullegardin, scener, lys, enheter, klima, media og sensorer – autokonfig fra KI Rom / HA-områder.');
})();
