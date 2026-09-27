/* msh-rom-card · Rom-popup (#<area_id>), alt under klima-toppkortet. Kilde: Rom v4.dc.html.
 * Seksjoner (rekkefølge/synlighet i config): rullegardin, scener, lys, enheter, klima, media, sensorer.
 * Autokonfig: sensor.<rom>_oversikt (KI Rom) → ellers HA-registre (område direkte / via enhet).
 * Tellertekster: sensor.<rom>_lys|_media|_brytere|_sensorer|_effekt (attributes.tekst) → ellers beregnet.
 * Overstyring: overrides {termostat, fuktighet}, exclude [ids], include {gardiner, scener, lys, enheter,
 * klima, media, sensorer}, light_types {<object_id>: dim|ct|color|onoff}, looks {<domene>: {<object_id>: {…}}}.
 * Scener: KI Rom-lysscener (button.*, fra sensor med integrasjon ki_lys + ki_type oversikt, attributes.scener)
 * først, så rommets scene- og script-entiteter. include.scenes (alias include.scener), exclude, order.scenes [ids].
 * Lys: mysmart-light-control per lys (gjenbrukt per entity). lights.<object_id> {size, label_layout, show_icon,
 * show_name, show_brightness, brightness_min/max, slider_color_mode, color_control, hide_temperature_slider,
 * hide_color_controls, hide_color_presets, bar_foreground, bar_background, handle_color, icon_color,
 * chevron_color, color_presets ("a, b" eller [..])}. Objekt-id som nøkkel fordi entity_id har punktum.
 */
(function () {
  const M = window.MSH, esc = M.esc, C = M.C;
  const PINK = C.accent;
  const G = { g200: 'var(--gray200, #3a3a3a)', g300: 'var(--gray300, #404040)', g400: 'var(--gray400, #545454)', g500: 'var(--gray500, #696969)', g600: 'var(--gray600, #7f7f7f)', g700: 'var(--gray700, #979797)', g800: 'var(--gray800, #afafaf)', g900: 'var(--gray900, #c7c7c7)', w: 'var(--white, #fafafa)' };

  // Seksjoner (design-rekkefølge; toppkortet er eget kort: msh-rom-klima-card)
  const SECS = [['curtain', 'Rullegardin', 'blinds'], ['scenes', 'Scener', 'auto_awesome'], ['lys', 'Lys', 'floor_lamp'], ['dev', 'Enheter', 'radio'], ['klima', 'Klima', 'thermostat'], ['media', 'Media', 'speaker'], ['sens', 'Sensorer', 'directions_walk']];
  // Lister (config.include-nøkler) → domener for «legg til»-søk
  const LISTS = [['gardiner', 'Rullegardin', ['cover']], ['scener', 'Scener', ['scene', 'script']], ['lys', 'Lys', ['light']], ['enheter', 'Enheter', ['switch', 'fan', 'input_boolean']], ['klima', 'Klima', ['climate']], ['media', 'Media', ['media_player']], ['sensorer', 'Sensorer', ['binary_sensor', 'sensor']]];
  const LT_NAMES = [['', 'Auto'], ['dim', 'Dimbar'], ['ct', 'Dimbar + temperatur'], ['color', 'Dimbar + farge'], ['onoff', 'Kun av/på']];

  // Apparatprofiler (fra designet): navn → ikon, farge, verb, terskel (W), animasjon
  const PROF = [
    [/br(ø|o)drister|toaster/, 'breakfast_dining', 'red', 'Rister', 10, 'rist'],
    [/kaffe/, 'coffee_maker', 'orange', 'Trakter kaffe', 10, 'puls'],
    [/vannkoker|kettle/, 'emoji_food_beverage', 'blue', 'Koker vann', 10, 'rist'],
    [/kj(ø|o)leskap|fridge/, 'kitchen', 'blue', 'Kjøler', 30, 'puls'],
    [/fryse/, 'severe_cold', 'blue', 'Fryser', 30, 'puls'],
    [/t(ø|o)rketrommel|dryer/, 'dry_cleaning', 'purple', 'Tørker', 10, 'spinn'],
    [/vaskemaskin|washer/, 'local_laundry_service', 'blue', 'Vasker', 10, 'spinn'],
    [/oppvask|dishwasher/, 'dishwasher_gen', 'green', 'Vasker opp', 10, 'puls'],
    [/mikro/, 'microwave', 'orange', 'Varmer', 10, 'puls'],
    [/platetopp|induksjon|cooktop/, 'mdi:pot-steam', 'red', 'Koker', 10, 'puls'],
    [/komfyr|stekeovn|ovn\b|oven/, 'mdi:stove', 'orange', 'Steker', 10, 'puls'],
    [/h(å|a)ndkle|towel/, 'heat', 'orange', 'Varmer håndklær', 10, 'puls'],
    [/varmtvann|bereder|\bvvb\b/, 'shower', 'orange', 'Varmer vann', 50, 'puls'],
  ];
  const profOf = (txt) => { const n = String(txt || '').toLowerCase(); const p = PROF.find((x) => x[0].test(n)); return p ? { icon: p[1], col: C[p[2]], verb: p[3], thr: p[4], anim: p[5] } : null; };
  const ANIM = { spinn: '1.6s linear', rist: '.5s ease-in-out', puls: '1.4s ease-in-out' };
  const DEV_ICON = [[/\btv\b|fjernsyn/, 'tv'], [/server|rack|nas\b/, 'dns'], [/stikk|plugg|outlet/, 'outlet'], [/\bpc\b|data|computer/, 'desktop_windows'], [/skjerm|monitor/, 'monitor'], [/piano/, 'piano'], [/peis/, 'fireplace'], [/lader|charger/, 'mdi:battery-charging'], [/luftrens|avfukt/, 'air'], [/varmekabel|gulvvarme/, 'heat'], [/julelys/, 'star']];
  const SCENE_ICON = [[/maks|max|full/, 'light_mode'], [/komfort|kos|hygge/, 'weekend'], [/middag|spise|mat/, 'restaurant'], [/\btv\b|film|kino/, 'tv'], [/demp|dim/, 'brightness_4'], [/alt av|\bav\b|natt|sov/, 'dark_mode'], [/morgen|våkn/, 'wb_twilight'], [/les/, 'library_books'], [/fest|party/, 'music_note']];
  // Binærsensorer: [på-tekst, av-tekst]; aktive (grønne) = på
  const BS = { motion: ['Bevegelse', 'Stille'], occupancy: ['Noen her', 'Stille'], presence: ['Noen her', 'Stille'], door: ['Åpen', 'Lukket'], garage_door: ['Åpen', 'Lukket'], window: ['Åpent', 'Lukket'], opening: ['Åpen', 'Lukket'], moisture: ['Vått', 'Tørt'], smoke: ['Røyk', 'OK'], gas: ['Gass', 'OK'], carbon_monoxide: ['CO', 'OK'], vibration: ['Vibrerer', 'Stille'], sound: ['Lyd', 'Stille'], light: ['Lys', 'Mørkt'], lock: ['Ulåst', 'Låst'], problem: ['Problem', 'OK'], safety: ['Usikker', 'Trygg'], tamper: ['Tukling', 'OK'], cold: ['Kaldt', 'Normal'], heat: ['Varmt', 'Normal'], running: ['Kjører', 'Stoppet'], battery: ['Lavt', 'OK'], connectivity: ['Tilkoblet', 'Frakoblet'], plug: ['Tilkoblet', 'Frakoblet'], power: ['Strøm', 'Ingen strøm'] };
  const CALM = ['connectivity', 'plug', 'power', 'running'];
  const SENS_ICON = { motion: 'directions_walk', occupancy: 'sensor_occupied', presence: 'sensor_occupied', door: 'door_front', garage_door: 'garage', window: 'window', opening: 'door_front', moisture: 'water_damage', smoke: 'detector_smoke', gas: 'mdi:gas-cylinder', carbon_monoxide: 'co2', illuminance: 'light_mode', humidity: 'humidity_percentage', temperature: 'thermometer', vibration: 'mdi:vibrate', sound: 'graphic_eq', lock: 'lock', battery: 'battery_full', carbon_dioxide: 'co2', power: 'bolt' };

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
    if (has('brytere', 'vifter')) {
      const d = [...objs(A.brytere), ...objs(A.vifter)];
      a.enheter = d.map((x) => x.entity);
      d.forEach((x) => { if (x.effekt) out.eff[x.entity] = typeof x.effekt === 'string' ? x.effekt : M.ids([x.effekt])[0]; });
    } else a.enheter = reg(['switch', 'fan']);
    if (has('klima')) { const k = objs(A.klima); a.klima = k.map((x) => x.entity); k.forEach((x) => { if (x.effekt) out.eff[x.entity] = x.effekt; }); } else a.klima = reg('climate');
    a.media = has('media') ? M.ids(A.media) : reg('media_player');
    if (has('sensorer', 'lysniva')) {
      const s = objs(A.sensorer);
      a.sensorer = s.map((x) => x.entity);
      s.forEach((x) => { if (x.klasse) out.cls[x.entity] = x.klasse; });
      M.ids(A.lysniva).forEach((id) => { if (!a.sensorer.includes(id)) { a.sensorer.push(id); out.cls[id] = 'illuminance'; } });
    } else a.sensorer = [...reg('binary_sensor'), ...reg('sensor', (s) => s.attributes.device_class === 'illuminance')];
    LISTS.forEach(([k]) => { out.lists[k] = M.applyLists(cfg, k, a[k]); });
    // Scener: include.scenes (alias for include.scener) + order.scenes (sortering fra «Tilpass rom»)
    (((cfg.include || {}).scenes) || []).forEach((id) => { if (!out.lists.scener.includes(id) && !((cfg.exclude || []).includes(id))) out.lists.scener.push(id); });
    const so = (cfg.order && Array.isArray(cfg.order.scenes)) ? cfg.order.scenes : null;
    if (so) { const ix = (id) => { const i = so.indexOf(id); return i < 0 ? 1e6 : i; }; const base = out.lists.scener.slice(); out.lists.scener.sort((x, y) => ix(x) - ix(y) || base.indexOf(x) - base.indexOf(y)); }
    const th = cfg.overrides && (cfg.overrides.climate || cfg.overrides.termostat);
    if (th) out.lists.klima = [th, ...out.lists.klima.filter((x) => x !== th)];
    (((cfg.include || {}).climate) || []).forEach((id) => { if (!out.lists.klima.includes(id)) out.lists.klima.push(id); });
    [...out.lists.enheter, ...out.lists.klima].forEach((id) => { if (!out.eff[id] && !id.startsWith('climate.')) { const p = M.powerOf(hass, id, area); if (p) out.eff[id] = p; } });
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
  const autoLightType = (s) => {
    const m = (s && s.attributes.supported_color_modes) || [];
    if (m.some((x) => ['hs', 'rgb', 'rgbw', 'rgbww', 'xy'].includes(x))) return 'color';
    if (m.includes('color_temp')) return 'ct';
    if (m.includes('brightness') || m.includes('white')) return 'dim';
    if (m.includes('onoff')) return 'onoff';
    return 'dim';
  };
  // Tekst-mal: {state} {w} {name} eller [[[ return … ]]] (som i designets «Utseende på kort»)
  const tpl = (v, ctx) => {
    if (v == null || String(v).trim() === '') return null;
    const t = String(v).trim();
    if (t.indexOf('[[[') === 0 && t.slice(-3) === ']]]') {
      try { const r = new Function('state', 'entity', 'w', 'name', t.slice(3, -3))(ctx.state, ctx.entity, ctx.w, ctx.name); return r == null ? null : String(r); } catch (e) { return '⚠ feil i kode'; }
    }
    return t.replace(/\{(\w+)\}/g, (m, k) => (ctx[k] != null ? ctx[k] : m));
  };
  // Åpne rom-tilpasningen fra andre kort (f.eks. tannhjulet i klima-toppkortet): M.roomCustomize('stue')
  M.roomCustomize = M.roomCustomize || function (area, section) {
    const detail = { area, section, handled: false };
    window.dispatchEvent(new CustomEvent('msh-rom-customize', { detail }));
    return detail.handled;
  };

  /* ---------------------------------------------------------------- skjema (felles editor) */
  function buildSchema(area0) {
    return (h, c) => {
      c = c || {};
      const area = c.area || area0;
      const L = h && area ? M.roomLists(h, area, c) : null;
      const out = [
        { type: 'section', id: 'spacing', label: 'Mellomrom', icon: 'mdi:arrow-expand-vertical', meta: (hh, cc) => `${cc.gap != null ? cc.gap : 8} px mellom`, fields: [
          { type: 'range', name: 'gap', label: 'Mellom seksjonene', icon: 'mdi:arrow-split-horizontal', min: 0, max: 48, default: 8, presets: [[4, 'Tett 4'], [8, 'Standard 8'], [18, 'Luftig 18']] },
          { type: 'range', name: 'pad_top', label: 'Fra popup-headeren til første kort', icon: 'mdi:format-vertical-align-top', min: -20, max: 120, default: 20, presets: [[-20, 'Inntil −20'], [6, 'Tett 6'], [20, 'Standard 20'], [44, 'Luftig 44']] },
          { type: 'range', name: 'pad_bottom', label: 'Luft i bunnen', icon: 'mdi:format-vertical-align-bottom', min: 0, max: 160, default: 40, presets: [[0, 'Ingen 0'], [40, 'Standard 40'], [96, 'Stor 96']] },
        ] },
        { type: 'section', id: 'look', label: 'Rom', icon: 'mdi:palette', meta: (hh, cc) => (cc.look && cc.look.col ? '' : 'Standardfarge'), fields: [
          { type: 'color', name: 'look.col', label: 'Romfarge', help: 'Brukes i toppkortets graf, romkortet og ikon-sirkelen i popup-headeren' },
          { type: 'icon', name: 'look.icon', label: 'Rom-ikon', auto: (hh, cc) => { const ar = cc.area || area0; return ar && hh && hh.areas && hh.areas[ar] ? hh.areas[ar].icon : null; } },
        ] },
        ...(area0 ? [] : [{ type: 'area', name: 'area', label: 'Rom (område)', help: 'Tomt = hentes fra popupens hash (#stue → stue)' }]),
        { type: 'section', id: 'klima', label: 'Klima', icon: 'mdi:thermostat', meta: (hh, cc) => { const ar = cc.area || area0; const rc = ar && hh ? M.roomClimate(hh, ar, cc) : null; return rc && rc.climate ? M.name(hh, rc.climate) : 'Automatisk'; }, fields: [
          { type: 'entity', name: 'overrides.climate', label: 'Termostat', domain: 'climate', area: (hh, cc) => cc.area || area0, auto: (hh, cc) => { const ar = cc.area || area0; return ar ? M.roomAuto(hh, ar).thermo : null; } },
          { type: 'entity', name: 'overrides.temperature', label: 'Temperatursensor', domain: 'sensor', device_class: 'temperature', area: (hh, cc) => cc.area || area0, auto: (hh, cc) => { const ar = cc.area || area0; if (!ar) return null; const a = M.roomAuto(hh, ar); return a.temp ? a.temp + (a.tempFallback ? ' (hus)' : '') : (a.tempVal != null ? `KI Rom · ${M.nf(a.tempVal, 1)}°` : null); } },
          { type: 'entity', name: 'overrides.humidity', label: 'Fuktsensor', domain: 'sensor', device_class: 'humidity', area: (hh, cc) => cc.area || area0, auto: (hh, cc) => { const ar = cc.area || area0; if (!ar) return null; const a = M.roomAuto(hh, ar); return a.hum ? a.hum + (a.humFallback ? ' (hus)' : '') : (a.humVal != null ? `KI Rom · ${M.nf(a.humVal, 0)} %` : null); } },
          { type: 'entities', name: 'include.climate', label: 'Ekstra termostater', domain: 'climate', addLabel: '+ Legg til termostat', area: (hh, cc) => cc.area || area0 },
          { type: 'color', name: 'graph_t', label: 'Toppkort · graf temperatur', help: 'Tomt = romfargen' },
          { type: 'color', name: 'graph_h', label: 'Toppkort · graf fukt', auto: () => 'var(--blue, #73b9f2)' },
          { type: 'select', name: 'graph_fill', label: 'Toppkort · fyll', options: [[0, 'Av'], [0.2, 'Svak'], [0.4, 'Sterk']], default: 0.2 },
          { type: 'select', name: 'graph_width', label: 'Toppkort · linje', options: [[1.5, 'Tynn'], [2, 'Normal'], [3, 'Tykk']], default: 2 },
          { type: 'boolean', name: 'header_icon', label: 'Rommets ikon i popup-headeren', default: true },
          { type: 'color', name: 'klima_bg', label: 'Klima-kort · bakgrunn', auto: () => '#2a2a2a' },
          { type: 'color', name: 'klima_ring', label: 'Klima-kort · knappfarge', auto: () => 'rgba(255,255,255,0.22)' },
          { type: 'select', name: 'klima_btn', label: 'Klima-kort · knapp', options: [['outline', 'Kontur'], ['fill', 'Fylt']], default: 'outline' },
          { type: 'boolean', name: 'klima_mode', label: 'Farg etter modus', help: 'Rød ved oppvarming, blå ved kjøling' },
        ] },
        { type: 'order', name: 'sections', hiddenName: 'hidden_sections', label: 'Seksjoner', options: SECS.map((s) => [s[0], s[1]]) },
      ];
      if (!area) out.push({ type: 'info', label: 'Velg rom over (eller åpne tilpasningen fra popupen) for å skjule/legge til entiteter og endre utseende per kort.' });
      out.push({ type: 'lists', label: 'Entiteter per seksjon', lists: (hh, cc) => { const ar = (cc && cc.area) || area0; if (!ar) return []; const A = M.roomLists(hh, ar, {}).auto; return LISTS.map(([key, label, domains]) => ({ key, label, ids: A[key], domains })); } });
      if (L) {
        // Scener: KI Rom-lysscenene først, så rommets scene.*/script.*. Skjul = exclude, sortering = order.scenes,
        // legg til = include.scenes.
        const all = [...new Set([...(L.auto.scener || []), ...(((c.include || {}).scener) || []), ...(((c.include || {}).scenes) || [])])];
        const nmSc = (id) => { const m = L.sceneMeta[id]; return (m && m.navn) || cap(M.name(h, id, M.areaName(h, area))); };
        out.push({ type: 'section', id: 'scenes', label: 'Scener', icon: 'mdi:palette', meta: () => `${L.lists.scener.length} av ${all.length} vises`, fields: [
          { type: 'info', label: 'KI Rom-lysscenene (knapper) først, deretter rommets egne scener og skript. Øye = skjul, piler = rekkefølge.' },
          ...(all.length ? [{ type: 'order', name: 'order.scenes', hiddenName: 'exclude', label: 'Rekkefølge og synlighet', options: all.map((id) => [id, `${nmSc(id)}${L.sceneMeta[id] ? ' · KI Rom' : id.startsWith('script.') ? ' · skript' : ' · scene'}`]) }] : [{ type: 'info', label: 'Fant ingen scener i rommet' }]),
          { type: 'entities', name: 'include.scenes', label: 'Lagt til', domains: ['button', 'scene', 'script'], addLabel: '+ Legg til scene', area: () => area },
        ] });
      }
      if (L && L.lists.lys.length) {
        const LS = [['', 'Auto'], ['small', 'Liten'], ['medium', 'Middels'], ['large', 'Stor'], ['xlarge', 'Ekstra stor'], ['jumbo', 'Jumbo']];
        const LL = [['', 'Auto'], ['title_outside_icon_inside', 'Tittel over, ikon i slideren'], ['icon_title_outside', 'Ikon og tittel over']];
        const LM = [['', 'Auto (etter type)'], ['custom', 'Egne farger'], ['custom_temperature', 'Fast fargetemperatur'], ['light_temperature', 'Lysets temperatur'], ['light_rgb', 'Lysets farge']];
        const LC = [['', 'Auto'], ['spectrum', 'Spekter'], ['presets', 'Forhåndsvalg'], ['both', 'Begge']];
        out.push({ type: 'section', id: 'lys', label: 'Lys', icon: 'mdi:lightbulb', meta: () => `${L.lists.lys.length} lys`, fields: [
          { type: 'info', label: 'Per lys (lagres under lights.<objekt-id>, f.eks. lights.stue_tak). Tomt = auto. «Kun av/på» tvinger en dimbar lampe til bryter.' },
          ...L.lists.lys.map((id) => {
            const p = 'lights.' + obj(id), st = h.states[id];
            return { type: 'section', label: cap(M.name(h, id, M.areaName(h, area))), icon: 'mdi:lightbulb', meta: () => (LT_NAMES.find((x) => x[0] === (((c.light_types || {})[obj(id)]) || autoLightType(st))) || [])[1] || '', fields: [
              { type: 'select', name: 'light_types.' + obj(id), label: 'Type', help: 'Auto: ' + (LT_NAMES.find((x) => x[0] === autoLightType(st)) || [])[1], options: LT_NAMES },
              { type: 'select', name: p + '.size', label: 'Størrelse', options: LS, help: 'Auto: Middels' },
              { type: 'select', name: p + '.label_layout', label: 'Tittel og ikon', options: LL },
              { type: 'boolean', name: p + '.show_name', label: 'Vis navn', default: true },
              { type: 'boolean', name: p + '.show_icon', label: 'Vis ikon', default: false },
              { type: 'boolean', name: p + '.show_brightness', label: 'Vis lysstyrke (%)', default: true },
              { type: 'number', name: p + '.brightness_min', label: 'Minste lysstyrke (%)', min: 0, max: 100, placeholder: '0' },
              { type: 'number', name: p + '.brightness_max', label: 'Største lysstyrke (%)', min: 0, max: 100, placeholder: '100' },
              { type: 'select', name: p + '.slider_color_mode', label: 'Sliderfarge', options: LM },
              { type: 'select', name: p + '.color_control', label: 'Fargekontroll (utvidet)', options: LC },
              { type: 'boolean', name: p + '.hide_temperature_slider', label: 'Skjul temperaturslider', default: false },
              { type: 'boolean', name: p + '.hide_color_controls', label: 'Skjul fargespekter', default: false },
              { type: 'boolean', name: p + '.hide_color_presets', label: 'Skjul fargeforhåndsvalg', default: false },
              { type: 'color', name: p + '.bar_foreground', label: 'Slider · fylt del', help: 'Tomt = romfargen' },
              { type: 'color', name: p + '.bar_background', label: 'Slider · bakgrunn', auto: () => 'var(--gray300, #404040)' },
              { type: 'color', name: p + '.handle_color', label: 'Håndtak', auto: () => 'var(--gray1000, #e1e1e1)' },
              { type: 'color', name: p + '.icon_color', label: 'Ikonfarge', auto: () => 'var(--gray1000, #e1e1e1)' },
              { type: 'color', name: p + '.chevron_color', label: 'Pil (utvid)' },
              { type: 'text', name: p + '.color_presets', label: 'Fargeforhåndsvalg', placeholder: '#ffb74c, #ff8a65, rgb(129, 212, 250)', help: 'Kommaseparert liste' },
            ] };
          }),
        ] });
      }
      if (L) {
        const items = [...L.lists.enheter.map((id) => [id, 'Enhet']), ...L.lists.sensorer.map((id) => [id, 'Sensor'])];
        if (items.length) {
          out.push({ type: 'section', id: 'looks', label: 'Utseende på kort', icon: 'mdi:palette', fields: [
            { type: 'info', label: 'Tomt felt = standard. Bruk {state}, {w} og {name}, eller kode: [[[ return state === \'på\' ? \'#7fd6a0\' : \'#404040\' ]]]' },
            ...items.map(([id, kind]) => {
              const p = 'looks.' + id;
              return { type: 'section', label: `${cap(M.name(h, id, M.areaName(h, area)))} · ${kind}`, icon: M.domainIcon(id, h.states[id]), fields: [
                { type: 'text', name: p + '.name', label: 'Navn', placeholder: cap(M.name(h, id, M.areaName(h, area))) },
                { type: 'text', name: p + '.label', label: 'Undertekst', placeholder: kind === 'Enhet' ? 'På · {w} W' : '{state}' },
                { type: 'icon', name: p + '.icon', label: 'Ikon' },
                { type: 'color', name: p + '.icon_color', label: 'Ikonfarge' },
                { type: 'color', name: p + '.bg', label: 'Bakgrunn' },
                { type: 'color', name: p + '.cell', label: 'Ikoncelle' },
              ] };
            }),
          ] });
        }
      }
      out.push({ type: 'boolean', name: 'customize_button', label: 'Vis «Tilpass rommet»-knapp nederst', default: true });
      return out;
    };
  }

  /* ---------------------------------------------------------------- kortet */
  class Rom extends M.Card {
    static get cardName() { return 'Rom'; }
    static get defaults() { return {}; }
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
      return M.openEditor(this, { cardClass: { schema: buildSchema(area), cardName: area ? M.areaName(this.hass, area) : 'Rom' }, focus, areaCtx: area });
    }

    /* ------------ hjelpere */
    _nm(id) { return cap(M.name(this.hass, id, this._areaName)); }
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
    _listChanged(key) { const a = this._L.auto[key] || [], l = this._L.lists[key] || []; return a.length !== l.length || a.some((x, i) => x !== l[i]); }

    render() {
      const c = this.config;
      const area = M.roomArea(this);
      this._area = area;
      if (!area || !(this.hass.areas && this.hass.areas[area]) && !M.kiRom(this.hass, area, 'oversikt')) {
        return `<div class="rom">${M.emptyState(area ? `Fant ikke rommet «${area}» – velg område` : 'Velg rom (område) for kortet', 'entities')}</div>`;
      }
      this._areaName = M.areaName(this.hass, area);
      const L = (this._L = M.roomLists(this.hass, area, c));
      if (L.ov) this.s(L.ov.entity_id);
      const keys = SECS.map((s) => s[0]);
      const order = (Array.isArray(c.sections) ? c.sections.filter((k) => keys.includes(k)) : []);
      keys.forEach((k) => { if (!order.includes(k)) order.push(k); });
      const hid = new Set(c.hidden_sections || []);
      const R = { curtain: () => this._curtain(), scenes: () => this._scenes(), lys: () => this._lights(), dev: () => this._devices(), klima: () => this._klima(), media: () => this._media(), sens: () => this._sensors() };
      const secs = order.filter((k) => !hid.has(k)).map((k) => R[k]()).filter(Boolean).join('');
      const any = LISTS.some(([k]) => L.lists[k].length);
      const body = secs || (any ? '' : M.emptyState(`Fant ingen entiteter i ${this._areaName}`, 'entities'));
      const tune = c.customize_button !== false ? `<button class="tune press" data-act="customize">${M.icon('tune', 18)}Tilpass rommet</button>` : '';
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
      const rest = open ? ids.slice(1).map((id) => { const v = this._cvPos(id); return `<div class="cvr2" data-key="cv-${esc(id)}"><span class="cvn2 ell">${esc(this._nm(id))}</span>${this._cvSlider(id, v)}<span class="cvp2 num">${v}%</span></div>`; }).join('') : '';
      return `<section class="cvbox" data-key="sec-curtain">
        <div class="cvr"><span class="cvn ell">${esc(this._nm(ids[0]))}</span>${this._cvSlider(ids[0], v0)}<span class="cvp num">${v0}%</span>${multi ? `<button class="cvx" data-act="cvx" data-haptic="selection">${this._chev(open)}</button>` : ''}</div>
        ${open ? `<div class="cvo"><div class="cvpre">${[0, 25, 50, 75, 100].map((v) => `<button class="pre press" data-act="cvall" data-v="${v}">${v}%</button>`).join('')}</div>${rest}</div>` : ''}
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
        return `<button class="sc" data-act="scene" data-id="${esc(id)}" data-ent="${esc(id)}" data-haptic="light" data-key="sc-${esc(id)}">${M.icon(icon, 26)}<span class="scl ell">${esc(lk.name || nm)}</span></button>`;
      }).join('')}</section>`;
    }

    /* ------------ lys (mysmart-light-control per lys, gjenbrukt per entity) */
    // Innstillinger per lys: config.lights.<object_id> (objekt-id-en – entity_id har punktum som ellers
    // ville blitt en ekstra nivå i editorens dotted names). lights.<entity_id> godtas også (YAML).
    _lightCfg(id) {
      const c = this.config, L = c.lights || {}, s = this.hass.states[id];
      const u = { ...(L[id] || {}), ...(L[obj(id)] || {}) };
      const T = ((c.light_types || {})[obj(id)]) || autoLightType(s);
      const romfarge = M.color((c.look && (c.look.col || c.look.color)) || null, M.romColor ? M.romColor(this._area, this.hass) : C.orange);
      const mode = T === 'color' ? { slider_color_mode: 'light_rgb', color_control: 'both' } : T === 'ct' ? { slider_color_mode: 'light_temperature' } : T === 'dim' ? { slider_color_mode: 'custom' } : { force_toggle_mode: true };
      const out = { entity: id, name: this._nm(id), size: 'medium', label_layout: 'title_outside_icon_inside', show_brightness: true, live_update: false,
        card_background: 'transparent', bar_background: 'var(--gray300, #404040)', bar_foreground: romfarge,
        handle_color: 'var(--gray1000, #e1e1e1)', icon_color: 'var(--gray1000, #e1e1e1)', ...mode };
      const B = (v) => v === true || v === 'true' ? true : v === false || v === 'false' ? false : undefined;
      Object.keys(u).forEach((k) => {
        let v = u[k];
        if (v == null || v === '') return;
        if (['show_icon', 'show_name', 'show_brightness', 'hide_temperature_slider', 'hide_color_controls', 'hide_color_presets', 'force_toggle_mode', 'live_update'].includes(k)) v = B(v);
        else if (k === 'brightness_min' || k === 'brightness_max') v = Number(v);
        else if (k === 'color_presets') v = (Array.isArray(v) ? v : String(v).split(/,(?![^(]*\))/)).map((x) => String(x).trim()).filter(Boolean);
        else if (['bar_foreground', 'bar_background', 'handle_color', 'icon_color', 'chevron_color', 'card_background'].includes(k)) v = M.color(v, undefined);
        if (v === undefined || (typeof v === 'number' && isNaN(v)) || (Array.isArray(v) && !v.length)) return;
        out[k] = v;
      });
      if (out.show_icon === true) out.show_icon_on_small_sizes = true; // medium skjuler ellers ikonet
      if (T === 'onoff' && u.force_toggle_mode == null) out.force_toggle_mode = true;
      return out;
    }
    _lights() {
      const ids = this._L.lists.lys;
      if (!ids.length) return '';
      const open = !!(this.ui.acc || {}).lys;
      let on = 0;
      const rows = ids.map((id) => {
        const s = this.s(id), isOn = !!s && s.state === 'on';
        if (isOn) on++;
        if (!open) return '';
        if (!s) return `<div class="lt unav" data-key="l-${esc(id)}"><div class="lth">${M.icon('lightbulb', 20)}<span class="ltn ell">${esc(this._nm(id))}</span><span class="ltp num">Finnes ikke</span></div></div>`;
        return `<div class="lc" data-key="l-${esc(id)}" data-lc="${esc(id)}" data-nomorph></div>`;
      }).join('');
      const sum = this._tekst('lys', this._listChanged('lys')) || `${on} på - ${ids.length - on} av`;
      return `<section class="box" data-key="sec-lys">${this._head('lys', 'floor_lamp', 'Lys', sum)}${open ? `<div class="bd"><div class="lts">${rows}</div></div>` : ''}</section>`;
    }
    // Monter/oppdater mysmart-light-control i plassholderne (data-nomorph → morph rører dem ikke).
    _mountLights() {
      const R = this.shadowRoot, h = this.hass;
      if (!R || !h) return;
      const map = (this._lc = this._lc || new Map());
      const ok = !!customElements.get('mysmart-light-control');
      R.querySelectorAll('[data-lc]').forEach((wrap) => {
        const id = wrap.dataset.lc;
        if (!wrap.__lcGuard) {
          wrap.__lcGuard = true;
          ['pointerdown', 'touchstart', 'touchmove'].forEach((t) => wrap.addEventListener(t, (e) => e.stopPropagation(), { passive: true }));
          wrap.addEventListener('pointerup', () => M.haptic('light'));
        }
        if (!ok) { if (!wrap.firstChild) wrap.innerHTML = `<div class="lth">${M.icon('lightbulb', 20)}<span class="ltn ell">${esc(this._nm(id))}</span></div>`; return; }
        let rec = map.get(id);
        if (!rec) { rec = { el: document.createElement('mysmart-light-control'), json: '' }; map.set(id, rec); }
        const cfg = this._lightCfg(id), json = JSON.stringify(cfg);
        if (rec.json !== json) { try { rec.el.setConfig(cfg); rec.json = json; } catch (e) { console.warn('[ki-msh] lys', id, e); } }
        if (rec.el.hass !== h) rec.el.hass = h;
        if (rec.el.parentNode !== wrap) { wrap.textContent = ''; wrap.appendChild(rec.el); }
      });
    }
    set hass(h) {
      super.hass = h;
      if (this._lc) this._lc.forEach((rec) => { if (rec.el.isConnected && rec.el.hass !== h) rec.el.hass = h; });
    }
    get hass() { return super.hass; }

    /* ------------ enheter (brytere/vifter med effekt) – aktiv enhet har ingen glød */
    _w(id) {
      const e = this._L.eff[id];
      if (e) { const v = this.n(e); if (v != null) return v; }
      const k = M.kiRom(this.hass, this._area, 'effekt');
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
      const rows = ids.map((id) => {
        const s = this.s(id), isOn = M.isOn(s), w = this._w(id), unav = M.unavailable(s);
        if (isOn) on++;
        if (w != null) { W += w; hasW = true; }
        if (!open) return '';
        const nm = this._nm(id), fan = id.startsWith('fan.');
        const P = profOf(nm + ' ' + obj(id));
        const pctF = fan && s && s.attributes.percentage != null ? ` · ${M.nf(s.attributes.percentage)} %` : '';
        const icon0 = (s && s.attributes.icon) || (this.hass.entities && this.hass.entities[id] && this.hass.entities[id].icon) || (DEV_ICON.find((x) => x[0].test(nm.toLowerCase())) || [])[1] || (fan ? 'mode_fan' : 'power');
        let st;
        if (P) {
          const act = isOn && (w == null || w > P.thr);
          st = { icon: P.icon, sub: unav ? 'Utilgjengelig' : act ? (w != null ? `${P.verb} · ${M.nf(w)} W` : P.verb) : isOn ? (w > 0 ? `Hviler · ${M.nf(w)} W` : w != null ? 'På · 0 W' : 'På') : 'Av',
            bg: act ? P.col : G.g300, col: act ? '#1f1f1f' : G.w, cell: act ? 'rgba(0,0,0,0.12)' : C.popup, icol: act ? '#1f1f1f' : P.col,
            anim: act ? `${P.anim} ${ANIM[P.anim]} infinite` : 'none', subCol: act ? 'rgba(31,31,31,0.8)' : G.g700, subW: act ? 600 : 400 };
        } else {
          st = { icon: icon0, sub: unav ? 'Utilgjengelig' : isOn ? (w != null ? `På · ${M.nf(w)} W` : 'På') + pctF : 'Av',
            bg: isOn ? PINK : G.g300, col: isOn ? G.g200 : G.w, cell: isOn ? 'rgba(42,23,32,0.12)' : C.popup, icol: isOn ? G.g200 : G.g800,
            anim: isOn && fan ? `spinn ${ANIM.spinn} infinite` : 'none', subCol: isOn ? 'rgba(42,23,32,0.75)' : G.g700, subW: 400 };
        }
        const lk = this._look(id), ctx = { state: isOn ? 'på' : 'av', on: isOn, w: w != null ? M.nf(w) : 0, name: nm, entity: s };
        const name = tpl(lk.name, ctx) || nm, sub = tpl(lk.label, ctx) || st.sub, icon = tpl(lk.icon, ctx) || st.icon;
        const bg = M.color(tpl(lk.bg, ctx), st.bg), cell = M.color(tpl(lk.cell, ctx), st.cell), icol = M.color(tpl(lk.icon_color, ctx), st.icol);
        return `<button class="pill dv ${unav ? 'unav' : ''}" data-act="toggle" data-id="${esc(id)}" data-ent="${esc(id)}" data-haptic="success" data-key="d-${esc(id)}" style="background:${bg};color:${st.col}">
          <span class="iw" style="background:${cell};color:${icol}">${M.icon(icon, 24, `animation:${st.anim}`)}</span>
          <span class="pt"><span class="pn ell">${esc(name)}</span><span class="ps ell" style="color:${st.subCol};font-weight:${st.subW}">${esc(sub)}</span></span></button>`;
      }).join('');
      const sum = this._tekst('effekt', this._listChanged('enheter')) || (hasW ? `${M.nf(W)} W` : null) || this._tekst('brytere', this._listChanged('enheter')) || `${on} på - ${ids.length - on} av`;
      return `<section class="box" data-key="sec-dev">${this._head('dev', 'radio', 'Enheter', sum)}${open ? `<div class="bd"><div class="lst">${rows}</div></div>` : ''}</section>`;
    }

    /* ------------ klima (termostater, +/−) */
    _klima() {
      const ids = this._L.lists.klima;
      if (!ids.length) return '';
      const c = this.config, open = !!(this.ui.acc || {}).klima;
      const first = this.s(ids[0]), fa = (first && first.attributes) || {};
      const heat0 = fa.hvac_action === 'heating';
      const set0 = this._kv(ids[0]);
      let sum = heat0 ? 'Varmer' : set0 != null ? `${M.nf(set0, 1)}°` : first ? (first.state === 'off' ? 'Av' : '') : '–';
      if (ids.length > 1) sum = `${sum ? sum + ' · ' : ''}+${ids.length - 1}`;
      let body = '';
      if (open) {
        const bg = M.color(c.klima_bg, '#2a2a2a'), ringDef = 'rgba(255,255,255,0.22)', ring = M.color(c.klima_ring, ringDef), fill = c.klima_btn === 'fill';
        const rc = M.roomClimate(this.hass, this._area, c);
        if (rc.hum.id) this.s(rc.hum.id);
        if (rc.temp.id) this.s(rc.temp.id);
        const roomHum = rc.hum.v, roomT = rc.temp.v;
        const idx = Math.min(this.ui.kIdx || 0, ids.length - 1);
        const cards = ids.map((id) => {
          const s = this.s(id), a = (s && s.attributes) || {};
          const t = a.current_temperature != null ? Number(a.current_temperature) : roomT;
          const h = a.current_humidity != null ? Number(a.current_humidity) : roomHum;
          const sp = this._kv(id), w = this._w(id);
          const act = a.hvac_action;
          let sub = !s ? 'Finnes ikke' : M.unavailable(s) ? 'Utilgjengelig' : s.state === 'off' || act === 'off' ? 'Av' : act === 'heating' ? 'Varmer' : act === 'cooling' ? 'Kjøler' : act === 'idle' ? 'Holder' : ({ heat: 'Varme', cool: 'Kjøling', auto: 'Auto', heat_cool: 'Auto', dry: 'Tørk', fan_only: 'Vifte' }[s.state] || s.state);
          if (w != null) sub += ` · ${M.nf(w)} W`;
          const mc = c.klima_mode && sp != null && t != null ? (sp > t + 0.2 ? C.red : sp < t - 0.2 ? C.blue : null) : null;
          const cbg = mc ? `linear-gradient(135deg, ${M.alpha(mc, 0.24)}, ${bg} 72%)` : bg;
          const ctl = `box-shadow:${fill ? 'none' : `inset 0 0 0 1px ${ring}`};background:${fill ? ring : 'transparent'};color:${fill && c.klima_ring ? C.popup : G.w}`;
          const dec = sp != null && Number.isInteger(sp) ? 0 : 1;
          return `<div class="kc" data-key="k-${esc(id)}" data-ent="${esc(id)}" style="background:${cbg}">
            <div class="kt"><span class="kn ell">${esc(this._nm(id))}</span><span class="ks ell">${esc(sub)}</span></div>
            <div class="kb"><span class="kv num">${t != null ? M.nf(t, 0) : '–'}°</span><span class="kh">${h != null ? M.nf(h, 0) : '–'}%</span></div>
            <div class="kctl" style="${ctl}"><button class="kbtn" data-act="kset" data-d="1" data-id="${esc(id)}" data-haptic="selection" ${sp == null ? 'disabled' : ''}>${M.icon('expand_less', 24)}</button><span class="kset num">${sp != null ? M.nf(sp, dec) : '–'}°</span><button class="kbtn" data-act="kset" data-d="-1" data-id="${esc(id)}" data-haptic="selection" ${sp == null ? 'disabled' : ''}>${M.icon('expand_more', 24)}</button></div>
          </div>`;
        }).join('');
        body = `<div class="cw"><div class="car noscroll" data-car="kIdx">${cards}</div>${this._dots(ids.length, idx)}</div>`;
      }
      return `<section class="box" data-key="sec-klima">${this._head('klima', 'thermostat', 'Klima', sum)}${body}</section>`;
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
      if (n < 2) return '<div class="dots"></div>';
      return `<div class="dots">${Array.from({ length: n }, (_, i) => `<span class="dot ${i === idx ? 'on' : ''}"></span>`).join('')}</div>`;
    }

    /* ------------ media */
    _media() {
      const ids = this._L.lists.media;
      if (!ids.length) return '';
      const open = !!(this.ui.acc || {}).media;
      let playing = 0;
      const cards = ids.map((id) => {
        const s = this.s(id), a = (s && s.attributes) || {};
        const pl = !!s && s.state === 'playing';
        if (pl) playing++;
        if (!open) return '';
        const off = !s || ['off', 'standby', 'unavailable', 'unknown'].includes(s.state);
        const title = a.media_title ? (a.media_artist ? `${a.media_title} · ${a.media_artist}` : a.media_title) : '';
        const stTxt = !s ? 'Finnes ikke' : M.unavailable(s) ? 'Utilgjengelig' : pl ? (title || 'Spiller') : s.state === 'paused' ? (title ? `Pauset · ${title}` : 'Pauset') : off ? 'Av' : 'Klar';
        const vol = this._v('vol', id, Math.round((a.volume_level || 0) * 100));
        const icon = a.device_class === 'tv' || /tv/i.test(id) ? 'tv' : 'speaker';
        return `<div class="mc" data-key="m-${esc(id)}">
          <div class="mt" data-ent="${esc(id)}"><span class="mh"><span class="mn ell">${esc(this._nm(id))}</span><span class="ms ell">${esc(stTxt)}</span></span>
            <span class="art">${M.icon(icon, 28)}</span>
            <div class="mctl">
              <button class="mb" data-act="mpower" data-id="${esc(id)}" data-haptic="medium">${M.icon('power_settings_new', 22)}</button>
              <button class="mb" data-act="mcmd" data-cmd="media_previous_track" data-id="${esc(id)}">${M.icon('skip_previous', 24)}</button>
              <button class="mp press" data-act="mcmd" data-cmd="media_play_pause" data-id="${esc(id)}" data-haptic="success">${M.icon(pl ? 'pause' : 'play_arrow', 32)}</button>
              <button class="mb" data-act="mcmd" data-cmd="media_next_track" data-id="${esc(id)}">${M.icon('skip_next', 24)}</button>
              <button class="mb" data-act="more" data-id="${esc(id)}">${M.icon('more_horiz', 24)}</button>
            </div></div>
          <div class="mv"><span class="mvl">Volum</span><div class="vs ${this._dragging('vol', id) ? 'drag' : ''}" data-slide="vol" data-id="${esc(id)}"><span class="cvt"></span><span class="cvf" style="width:${vol}%"></span><span class="knob" style="left:calc(${vol}% - 11px)"></span></div><span class="mvp num">${vol}%</span></div>
        </div>`;
      }).join('');
      const sum = this._tekst('media', this._listChanged('media')) || `${playing} spiller - ${ids.length - playing} av`;
      const idx = Math.min(this.ui.mIdx || 0, ids.length - 1);
      return `<section class="box" data-key="sec-media">${this._head('media', 'speaker', 'Media', sum)}${open ? `<div class="cw"><div class="car noscroll" data-car="mIdx">${cards}</div>${this._dots(ids.length, idx)}</div>` : ''}</section>`;
    }

    /* ------------ sensorer */
    _sensors() {
      const ids = this._L.lists.sensorer;
      if (!ids.length) return '';
      const open = !!(this.ui.acc || {}).sens;
      let act = 0;
      const rows = ids.map((id) => {
        const s = this.s(id), a = (s && s.attributes) || {};
        const cls = this._L.cls[id] || a.device_class || '';
        const bin = id.startsWith('binary_sensor.');
        const hot = bin && !!s && s.state === 'on' && !CALM.includes(cls);
        if (hot) act++;
        if (!open) return '';
        const nm = this._nm(id);
        const state = !s ? 'Finnes ikke' : M.unavailable(s) ? 'Utilgjengelig' : bin ? ((BS[cls] || ['På', 'Av'])[s.state === 'on' ? 0 : 1]) : M.fmtState(this.hass, id);
        const icon0 = a.icon || SENS_ICON[cls] || M.domainIcon(id, s);
        const lk = this._look(id), ctx = { state, name: nm, w: 0, entity: s };
        const name = tpl(lk.name, ctx) || nm, sub = tpl(lk.label, ctx) || state, icon = tpl(lk.icon, ctx) || icon0;
        const bg = M.color(tpl(lk.bg, ctx), hot ? C.green : G.g300), cell = M.color(tpl(lk.cell, ctx), hot ? 'rgba(0,0,0,0.1)' : C.popup), icol = M.color(tpl(lk.icon_color, ctx), hot ? 'currentColor' : G.g800);
        return `<div class="pill sn" data-act="more" data-id="${esc(id)}" data-key="s-${esc(id)}" style="background:${bg};color:${hot ? G.g200 : G.w}">
          <span class="iw" style="background:${cell};color:${icol}">${M.icon(icon, 24)}</span>
          <span class="pt"><span class="pn ell">${esc(name)}</span><span class="ps ell" style="color:${hot ? 'rgba(31,42,36,0.75)' : G.g700}">${esc(sub)}</span></span></div>`;
      }).join('');
      const sum = this._tekst('sensorer', this._listChanged('sensorer')) || `${act} aktiv - ${ids.length - act} stille`;
      return `<section class="box" data-key="sec-sens">${this._head('sens', 'directions_walk', 'Sensorer', sum)}${open ? `<div class="bd"><div class="lst">${rows}</div></div>` : ''}</section>`;
    }

    /* ------------ handlinger */
    onAction(name, el, ev) {
      const d = el.dataset, h = this.hass;
      if (name === 'acc') { const acc = { ...(this.ui.acc || {}) }; acc[d.k] = !acc[d.k]; return this.setUI({ acc }); }
      if (name === 'cvx') return this.setUI({ cvOpen: !this.ui.cvOpen });
      if (name === 'scene') return M.toggle(h, d.id).catch(() => {}); // button.press / scene.turn_on / script.turn_on (haptic via data-haptic)
      if (name === 'cvall') { const v = Number(d.v); (this._L ? this._L.lists.gardiner : []).forEach((id) => this._commit('cover', id, v)); return; }
      if (name === 'kset') return this._kstep(d.id, Number(d.d));
      if (name === 'mcmd') return M.call(h, 'media_player', d.cmd, { entity_id: d.id });
      if (name === 'mpower') { const s = h.states[d.id]; const off = !s || ['off', 'standby'].includes(s.state); return M.call(h, 'media_player', off ? 'turn_on' : 'turn_off', { entity_id: d.id }); }
      return super.onAction(name, el, ev);
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
    _roomCfg() { const c = this.config; return { overrides: c.overrides || {}, include: c.include || {}, gap: c.gap, pad_top: c.pad_top, pad_bottom: c.pad_bottom }; }
    onOpen() { if (M.store) M.store.refresh(this.hass); this._applySpacing(); setTimeout(() => this._applySpacing(), 350); }
    afterRender() {
      const R = this.shadowRoot;
      const area = M.roomArea(this);
      if (area && (this._pubArea !== area || this._pubCfg !== this._rawConfig)) { this._pubArea = area; this._pubCfg = this._rawConfig; M.setRoomCfg(area, this._roomCfg()); }
      if (!this._spaced && M.popupContainer(this)) { this._spaced = true; requestAnimationFrame(() => this._applySpacing()); }
      R.querySelectorAll('[data-slide]').forEach((el) => { if (el.__b) return; el.__b = true; this._bindSlide(el); });
      R.querySelectorAll('[data-hs]').forEach((el) => { if (el.__b) return; el.__b = true; this._guard(el, 'pan-x'); });
      this._mountLights();
      R.querySelectorAll('[data-car]').forEach((el) => {
        if (el.__b) return;
        el.__b = true;
        this._guard(el, 'pan-x pan-y');
        el.addEventListener('scroll', () => {
          const i = Math.round(el.scrollLeft / (el.clientWidth || 1)), k = el.dataset.car;
          if ((this.ui[k] || 0) !== i) { M.haptic('selection'); this.setUI({ [k]: i }); }
        }, { passive: true });
      });
    }

    get styles() {
      return `
        .rom{display:flex;flex-direction:column;gap:var(--msh-gap, 8px)}
        .ell{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .unav{opacity:.5}
        /* rullegardin */
        .cvbox{border-radius:33px;background:${G.g200}}
        .cvr{display:flex;align-items:center;gap:14px;height:66px;padding:0 14px 0 22px}
        .cvn{font-size:15px;font-weight:500;max-width:120px;flex:none}
        .cvp{font-size:15px;min-width:40px;text-align:right}
        .cvs,.vs{position:relative;flex:1;min-width:0;height:28px;display:flex;align-items:center;touch-action:none;cursor:pointer;user-select:none}
        .vs{height:24px}
        .cvt{position:absolute;left:0;right:0;height:8px;border-radius:4px;background:${C.popup}}
        .cvf{position:absolute;left:0;height:8px;border-radius:4px;background:${PINK};transition:width .3s}
        .knob{position:absolute;width:22px;height:22px;border-radius:11px;background:${G.w};box-shadow:0 2px 6px rgba(0,0,0,0.4);transition:left .3s}
        .drag .cvf,.drag .knob{transition:none}
        .cvx{width:36px;height:36px;display:grid;place-items:center;flex:none}
        .cvo{display:flex;flex-direction:column;gap:14px;padding:4px 12px 16px}
        .cvpre{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}
        .pre{height:40px;border-radius:20px;background:#2a2a2a;font-size:14px}
        .pre:active{transform:scale(.95)}
        .cvr2{display:flex;align-items:center;gap:14px;padding:0 6px 0 10px}
        .cvn2{font-size:14px;font-weight:500;max-width:100px;flex:none}
        .cvp2{font-size:14px;min-width:40px;text-align:right}
        /* scener */
        .scn{display:flex;gap:8px;width:100%;overflow-x:auto;overflow-y:hidden;margin:0;padding:0;border-radius:0;scroll-padding-left:0;scroll-snap-type:x proximity;overscroll-behavior-x:contain;touch-action:pan-x;scrollbar-width:none}
        .scn::-webkit-scrollbar{display:none}
        .sc{flex:none;scroll-snap-align:start;width:100px;height:100px;border-radius:26px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:${G.g200};color:${G.w};transition:transform .2s;padding:0 8px}
        .sc:active{transform:scale(.95)}
        .scl{font-size:14px;font-weight:400;max-width:100%}
        /* akkordeon */
        .box{border-radius:32px;background:${G.g200};overflow:hidden}
        .acc{width:100%;height:66px;padding:0 20px 0 24px;display:flex;align-items:center;gap:16px;text-align:left}
        .acct{flex:1;font-size:16px;font-weight:500}
        .accs{font-size:13px;color:${G.g700};white-space:nowrap}
        .bd{padding:0 8px 8px}
        /* lys (mysmart-light-control inni radens #3a3a3a-flate – ingen egen bakgrunn/padding) */
        .lts{display:flex;flex-direction:column;gap:10px;padding:0 8px 6px}
        .lt{display:flex;flex-direction:column;gap:8px}
        .lth{display:flex;align-items:center;gap:12px}
        .ltn{flex:1;min-width:0;font-size:14px;font-weight:500}
        .ltp{font-size:12px;color:${G.g700}}
        .lc{display:block;min-height:40px;background:none;padding:0}
        .lc mysmart-light-control{display:block;--ha-card-background:transparent;--ha-card-box-shadow:none;--ha-card-border-width:0}
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
        /* karuseller (klima/media) */
        .cw{display:flex;flex-direction:column;align-items:center;gap:10px;padding:0 8px 10px}
        .car{width:100%;display:flex;overflow-x:auto;scroll-snap-type:x mandatory;border-radius:26px;overscroll-behavior-x:contain}
        .dots{display:flex;gap:8px;height:14px;align-items:center}
        .dot{width:10px;height:10px;border-radius:6px;background:${G.g400};transition:background .2s}
        .dot.on{width:12px;height:12px;background:${G.g600}}
        /* klima */
        .kc{position:relative;flex:none;width:100%;height:155px;scroll-snap-align:start;border-radius:26px;transition:background .4s}
        .kt{position:absolute;left:20px;top:18px;right:84px;display:flex;flex-direction:column;gap:2px}
        .kn{font-size:14px;color:${G.g800}}
        .ks{font-size:13px;color:${G.g600}}
        .kb{position:absolute;left:20px;bottom:18px;display:flex;align-items:baseline;gap:4px;white-space:nowrap}
        .kv{font-size:44px;font-weight:300;letter-spacing:-0.04em;line-height:1}
        .kh{font-size:13px;color:${G.g700}}
        .kctl{position:absolute;right:10px;top:10px;bottom:10px;width:64px;border-radius:32px;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:6px 0}
        .kbtn{width:64px;height:44px;display:grid;place-items:center;color:inherit;transition:transform .15s}
        .kbtn:active{transform:scale(.9)}
        .kbtn[disabled]{opacity:.35}
        .kset{font-size:17px;font-weight:500}
        /* media */
        .mc{display:flex;flex-direction:column;flex:none;width:100%;scroll-snap-align:start}
        .mt{position:relative;padding:20px 20px 16px;border-radius:26px;background:#2a2a2a}
        .mh{display:flex;flex-direction:column;gap:6px;padding-right:64px}
        .mn{font-size:12px;color:${G.g800}}
        .ms{font-size:17px;font-weight:500}
        .art{position:absolute;right:8px;top:8px;width:60px;height:60px;border-radius:30px;background:${G.g300};display:grid;place-items:center}
        .mctl{display:flex;align-items:center;justify-content:space-between;margin-top:28px}
        .mb{width:44px;height:44px;display:grid;place-items:center}
        .mp{width:64px;height:64px;border-radius:32px;background:${G.g300};display:grid;place-items:center}
        .mp:active{transform:scale(.94)}
        .mv{display:flex;align-items:center;gap:16px;padding:16px 12px 6px 20px}
        .mvl{font-size:14px;font-weight:500}
        .mvp{font-size:14px;min-width:36px;text-align:right}
        /* tilpass */
        .tune{align-self:center;height:36px;padding:0 14px;border-radius:18px;display:flex;align-items:center;gap:6px;font-size:13px;font-weight:500;color:${G.g700}}
      `;
    }
  }
  M.define('msh-rom-card', Rom, 'MSH Rom', 'Rom-popupen: rullegardin, scener, lys, enheter, klima, media og sensorer – autokonfig fra KI Rom / HA-områder.');
})();
