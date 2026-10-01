/* msh-lys-card · Lys-popup (#lys). Kilde: Lys v4.dc.html + fiks3 (punkt 1–3, 5).
 * Rad under Bubble-headeren: fane-pillen (Utelys · én per etasje · Lys på; scroller vannrett, langt trykk + dra =
 * omorganiser via MSH.tabReorder → tab_order) og til høyre tannhjulet (44 × 44, samme glass-flate og ring som pillen).
 * Tannhjulet åpner «Tilpass lys»: eget bunnark (MSH.overlay → document.body; solid, frosted med Liquid Glass-tema) med navigasjonsrad Avbryt · tittel ·
 * Ferdig, Visning (Mellomrom/Kolonner/Størrelse/Slider-høyde, live bak arket), Innhold (Faner · Scener · Rom og lys ·
 * Utelys som undersider med «‹ Tilpass») og «Tilbakestill til standard». Ingen omfangsvelger – én felles config.
 * Utkastflyten er den felles MSH.draftEditor (fiks 15.13): utkastet vises live, ingen autolagring; Ferdig lagrer én gang
 * (MSH.saveCardConfig, scope 'shared', venter på svar, deaktivert mens det lagres), Avbryt/utenfor/Esc forkaster.
 * Endret et annet sted mens arket er åpent → banner «Last inn». getConfigElement() bruker samme nøkler (static schema).
 * Config-nøkler (arket ⇄ GUI-editoren):
 *   Visning:  gap (8 Tett / 12 Standard / 18 Luftig, også mellom lys-radene når tile_gap mangler), tile_gap, columns (1|2),
 *             size (compact|standard → slider 32|40 px), slider_height (32–56, std 40; overstyrer size), pad_top, pad_bottom
 *             Eldre tile_height (56|64|72) → slider 40|48|56 når size/slider_height mangler.
 *   Faner:    tab_order, hidden_tabs (minst én fane vises), tab_names.<fane>, start_tab, floor_tabs.<floor_id>
 *   Scener:   scene_source (auto|ki|egne|begge), scene_order, hidden_scenes, include.scener_lys
 *   Rom/lys:  room_order.<floor_id|_>, hidden_rooms, light_order.<area|_>, exclude, include.lys, light_types.<objekt-id>,
 *             lights.<objekt-id> {name, icon, brightness_min/max, color_control, hide_*, color_presets}
 *   Utelys:   outdoor {mode, on, off, latest, morning, offset, lux_on, lux_off, kveld, morgen}
 *             (eldre rotnøkler mode/on/off/… leses fortsatt; arket flytter dem inn i outdoor ved Ferdig),
 *             overrides.{lux, automatikk, modus, kveld_bryter, morgen_bryter}, include.utelys, order.utelys, exclude
 *             (eldre config.lamps [{name, entity, icon}] vinner når satt) · toasts.
 *             Utelamper kan være light/switch/input_boolean (+ group/script); av/på for ikke-lys går via homeassistant.*.
 *             Lagt til = include.utelys, fjernet autolampe = exclude (samme nøkler som GUI-editoren). outdoor.include /
 *             outdoor.exclude (prompt-formen) leses også, og flyttes til include.utelys / exclude når arket lagres.
 *             «Tilpass lys» → Utelys: «Finner du ikke lampen?» søker i hass.states (MSH.entitySearch: navn, entity_id,
 *             område, æøå-normalisert, maks 8 treff, debounce 150 ms) med «Legg til» / «Lagt til».
 * Lys: felles lys-rad (08-light-row.js, samme som Rom → Lys) per lys, gjenbrukt per entity i data-nomorph-plassholdere.
 *   19.2: fyll og «Lys på»-sirkelen i lampens egen farge (MSH.lampColor: rgb_color / Kelvin-tone / temagul);
 *   overrides.<entity>.color eller lights.<objekt-id>.color går foran.
 * Utelys-fanen: Utelys-kortet først (status, av/på, tidslinje for neste 24 t fra «nå» med natt fra sun.sun og periode med
 * lys på, Tennes/Slukkes-fliser), så lampene, Styring og Sola.
 * Autokonfig: alle light.* gruppert per etasje/område (M.areaOf + hass.areas/hass.floors, pluss KI Rom `lys`).
 * Utelys = lys i utendørs etasje/område (Ute, Hage, Terrasse …) eller med «ute» i navnet.
 * Scener: KI Rom-lysscenene (button.*_lys_*) for rommene i etasjen, gruppert per scene; ellers egne (lysnivåer +
 * scene.* i etasjen). Scener er engangshandlinger – aldri aktiv-tilstand.
 * Totaler fra sensor.hele_huset_lys (KI Rom) når den finnes. Rot og ha-card er transparente – Bubble Card tegner flaten.
 */
(function () {
  const M = window.MSH, esc = M.esc, C = M.C;
  const PINK = C.accent, INK = '#3a3a3a', Y = C.yellow, G = C.green;
  // Fanerad-flate: standard transparent + ring, glass kun med Liquid Glass-temaet (05-tab-reorder.js, Fiks 15.2)
  const TRS = M.tabSurface ? M.tabSurface('transparent', 'inset 0 0 0 1px rgba(255,255,255,0.12)') : 'background:transparent;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.12);';
  const OUT_RX = /(^|[_\s.])(ute\w*|utendors\w*|utvendig\w*|hage\w*|terrasse\w*|veranda\w*|fasade\w*|inngang\w*|garasje\w*|carport|balkong\w*|uteplass\w*|outdoor\w*|outside|garden|patio|porch|yard)($|[_\s.])/;
  const OUT_FLOOR_RX = /(ute|utendors|utvendig|outdoor|outside|garden|hage|yard)/;
  const OUT_DOMS = ['light', 'switch', 'input_boolean', 'group', 'script'];
  const DEF = { mode: 'auto', kveld: true, morgen: true, morning: '06:00', offset: -15, lux_on: 40, lux_off: 120, latest: '' };
  // Utelys-innstillinger: config.outdoor.<nøkkel>, eldre rotnøkler som reserve
  const OUT_KEYS = ['mode', 'on', 'off', 'latest', 'morning', 'offset', 'lux_on', 'lux_off', 'kveld', 'morgen'];
  const outCfg = (c) => {
    c = c || {};
    const o = { ...DEF }, n = (c.outdoor && typeof c.outdoor === 'object') ? c.outdoor : {};
    OUT_KEYS.forEach((k) => { if (c[k] != null && c[k] !== '') o[k] = c[k]; if (n[k] != null && n[k] !== '') o[k] = n[k]; });
    return o;
  };
  // 22.10 · Utelys «Døgnring»: entiteter [overrides-nøkkel, etikett, domene, auto-suffiks] (auto: ^dom.(…_)?suffiks$)
  const UT_ENTS = [
    ['automatikk', 'Automatikk', 'switch', null], ['kveld_bryter', 'Kveld', 'switch', null], ['morgen_bryter', 'Morgen', 'switch', null],
    ['neste_paa', 'Neste tenning', 'sensor', 'ki_utelys_neste_paa'], ['neste_av', 'Neste slukking', 'sensor', 'ki_utelys_neste_av'], ['utelys_status', 'Status', 'sensor', 'ki_utelys_status'],
    ['terskel_paa', 'Tenn under (lx)', 'number', 'ki_utelys_terskel_paa'], ['terskel_av', 'Slukk over (lx)', 'number', 'ki_utelys_terskel_av'], ['minst_morke', 'Minste mørketid (min)', 'number', 'ki_utelys_minst_morke'],
    ['sun_dawn', 'Grålysning', 'sensor', 'sun_next_dawn'], ['sun_rising', 'Soloppgang', 'sensor', 'sun_next_rising'], ['sun_noon', 'Midt på dagen', 'sensor', 'sun_next_noon'],
    ['sun_setting', 'Solnedgang', 'sensor', 'sun_next_setting'], ['sun_dusk', 'Skumring', 'sensor', 'sun_next_dusk'], ['sun_elevation', 'Solhøyde', 'sensor', 'sun_solar_elevation'], ['sun_stiger', 'Sola stiger', 'binary_sensor', 'sun_solar_rising'],
  ];
  const UT_DOMS = { switch: ['switch', 'input_boolean'], sensor: ['sensor'], number: ['number', 'input_number'], binary_sensor: ['binary_sensor'] };
  const UT_SECS = [['auto', 'Automatikk'], ['lamps', 'Lamper'], ['sun', 'Sola'], ['settings', 'Innstillinger']];
  const PRESETS = [['max', 'Maks', 'light_mode', 100], ['kveld', 'Kveld', 'weekend', 45], ['dim', 'Dempet', 'brightness_4', 20], ['natt', 'Natt', 'bedtime', 5], ['av', 'Alt av', 'dark_mode', 0]];
  const hay = (hass, id) => M.slug(id + ' ' + ((hass.states[id] && hass.states[id].attributes.friendly_name) || ''));
  const mins = (t) => { const m = /^(\d{1,2}):(\d\d)/.exec(String(t || '')); return m ? +m[1] * 60 + +m[2] : null; };
  const fmt = (m) => (m == null ? '–' : `${M.pad(Math.floor(((m % 1440) + 1440) % 1440 / 60))}:${M.pad(((m % 60) + 60) % 60)}`);
  const hm = (iso) => { if (!iso) return null; const d = new Date(iso); return isNaN(d) ? null : d.getHours() * 60 + d.getMinutes(); };
  const pctOf = (s) => (!s || s.state !== 'on' ? 0 : s.attributes.brightness != null ? Math.max(1, Math.round((s.attributes.brightness / 255) * 100)) : 100);
  const obj = (id) => String(id || '').split('.').slice(1).join('.');
  const cap = (n) => String(n || '').charAt(0).toUpperCase() + String(n || '').slice(1);
  // Lystype fra supported_color_modes: farge (hs/rgb/xy) → temperatur → dimbar → kun av/på (felles: 08-light-row.js)
  const lightType = (s) => (M.lightType ? M.lightType(s) : 'dim');
  const LT_NAMES = [['', 'Auto'], ['dim', 'Dimbar'], ['ct', 'Dimbar + temperatur'], ['color', 'Dimbar + farge'], ['onoff', 'Kun av/på']];
  const ltName = (k) => (LT_NAMES.find((x) => x[0] === k) || [])[1] || '';
  // Innstillinger per lys (lights.<objekt-id>, eldre: lights.<entity_id>) og valgt lystype (light_types.<objekt-id>)
  const lcfg = (c, id) => { const L = (c && c.lights) || {}; return { ...(L[id] || {}), ...(L[obj(id)] || {}) }; };
  const ltype = (c, id, s) => ((c && c.light_types) || {})[obj(id)] || lightType(s);
  const dimmable = (s, c, id) => { if (c && id) return ltype(c, id, s) !== 'onoff'; const m = (s && s.attributes.supported_color_modes) || []; return m.length ? m.some((x) => x !== 'onoff') : s && s.attributes.brightness != null; };
  // Sorter etter lagret rekkefølge (ukjente beholder autorekkefølgen, bakerst)
  const byOrder = (list, ord, key = (x) => x) => {
    if (!Array.isArray(ord) || !ord.length) return list;
    const ix = (x) => { const i = ord.indexOf(key(x)); return i < 0 ? 1e6 : i; };
    return list.map((x, i) => [x, i]).sort((a, b) => ix(a[0]) - ix(b[0]) || a[1] - b[1]).map((x) => x[0]);
  };
  const num = (v, d) => (v != null && v !== '' && !isNaN(Number(v)) ? Number(v) : d);
  const gapOf = (c) => num(c && c.gap, 12);
  const rowGapOf = (c) => num(c && c.tile_gap, gapOf(c));
  const sizeOf = (c) => (c && (c.size === 'compact' || c.size === 'standard') ? c.size : M.lightRowHeight && M.lightRowHeight(c) <= 32 ? 'compact' : 'standard');
  const LC = [['', 'Auto'], ['spectrum', 'Spekter'], ['presets', 'Forhåndsvalg'], ['both', 'Begge']];


  /* ------------------------------------------------------------ autokonfig */
  M.lysAuto = function (hass, cfg) {
    cfg = cfg || {};
    const out = { floors: [], floorsHA: [], outAuto: [], all: [], allAuto: [], lamps: [], lampsAll: [], aOf: {} };
    if (!hass) return out;
    const all0 = M.all(hass, 'light');
    const inc = (((cfg.include || {}).lys) || []).filter((id) => /^light\./.test(id));
    const pool = [...new Set([...all0, ...inc])];
    const ex = new Set(cfg.exclude || []), ord = cfg.order || {};
    const areas = M.areas(hass);
    const aOf = {};
    pool.forEach((id) => { aOf[id] = M.areaOf(hass, id); });
    // KI Rom: lys-attributt per rom (for lys uten område i registeret)
    areas.forEach((a) => { const ov = M.kiRom(hass, a.id, 'oversikt'); if (ov && Array.isArray(ov.attributes.lys)) M.ids(ov.attributes.lys).forEach((id) => { if (pool.includes(id) && !aOf[id]) aOf[id] = a.id; }); });
    const isOutArea = (a) => a && ((a.floorName && OUT_FLOOR_RX.test(M.slug(a.floorName))) || (a.floor && OUT_FLOOR_RX.test(a.floor)) || OUT_RX.test(M.slug(a.name)) || OUT_RX.test(a.id));
    const areaMap = Object.fromEntries(areas.map((a) => [a.id, a]));
    out.outAuto = all0.filter((id) => isOutArea(areaMap[aOf[id]]) || (!aOf[id] && OUT_RX.test(hay(hass, id))));
    out.all = M.applyLists(cfg, 'lys', all0);
    out.allAuto = all0;
    // Utelys: config.lamps (eldre) vinner, ellers auto + include.utelys − exclude, sortert etter order.utelys
    if (Array.isArray(cfg.lamps) && cfg.lamps.length) {
      out.lamps = cfg.lamps.filter((l) => l && l.entity).map((l) => ({ id: l.entity, name: l.name || M.name(hass, l.entity), icon: l.icon || null }));
      out.lampsAll = out.lamps.map((l) => l.id);
      out.legacyLamps = true;
    } else {
      const oc = cfg.outdoor && typeof cfg.outdoor === 'object' ? cfg.outdoor : {};
      const oInc = Array.isArray(oc.include) ? oc.include : [], oEx = new Set(Array.isArray(oc.exclude) ? oc.exclude : []);
      out.lampsAll = byOrder([...new Set([...out.outAuto, ...(((cfg.include || {}).utelys) || []), ...oInc])], ord.utelys);
      out.lamps = out.lampsAll.filter((id) => !ex.has(id) && !oEx.has(id)).map((id) => { const u = lcfg(cfg, id); return { id, name: u.name || M.name(hass, id), icon: u.icon || null }; });
    }
    const outSet = new Set(out.lampsAll.concat(out.outAuto));
    // Etasjer → rom → lys (utendørs etasjer er dekket av Utelys-fanen). all = alle (for editoren), ids = synlige.
    const byArea = {};
    pool.filter((id) => !outSet.has(id)).forEach((id) => { const a = aOf[id] || '_'; (byArea[a] = byArea[a] || []).push(id); });
    const room = (area, name, icon) => { const all = byOrder(byArea[area || '_'], ((cfg.light_order || {})[area || '_'])); return { area, name, icon, all, ids: all.filter((id) => !ex.has(id)) }; };
    const sortRooms = (rooms, fid) => byOrder(rooms, (cfg.room_order || {})[fid || '_'], (r) => r.area || '_');
    const ft = cfg.floor_tabs || {};
    const floors = M.floors(hass).filter((f) => !OUT_FLOOR_RX.test(M.slug(f.name)) && !OUT_FLOOR_RX.test(f.floor_id));
    floors.forEach((f) => {
      const rooms = areas.filter((a) => a.floor === f.floor_id && byArea[a.id]).map((a) => room(a.id, a.name, a.icon));
      out.floorsHA.push({ id: f.floor_id, name: f.name, icon: f.icon, has: rooms.length > 0 });
      const show = ft[f.floor_id] != null ? ft[f.floor_id] !== false : rooms.length > 0;
      if (show) out.floors.push({ key: 'f:' + f.floor_id, id: f.floor_id, name: f.name, icon: f.icon, rooms: sortRooms(rooms, f.floor_id) });
    });
    const rest = areas.filter((a) => (!a.floor || !floors.find((f) => f.floor_id === a.floor)) && byArea[a.id] && !isOutArea(a)).map((a) => room(a.id, a.name, a.icon));
    if (byArea._) rest.push(room(null, 'Uten rom', 'mdi:home-outline'));
    if (rest.length) out.floors.push({ key: 'f:_', id: null, name: out.floors.length ? 'Andre' : 'Inne', icon: null, rooms: sortRooms(rest, null) });
    out.aOf = aOf;
    // Sensorer / brytere
    const sun = M.all(hass, 'sun')[0] || null;
    out.sun = sun;
    const outAreas = areas.filter(isOutArea).map((a) => a.id);
    out.autoLux = M.all(hass, 'sensor', (s, id) => s.attributes.device_class === 'illuminance' && (outAreas.includes(M.areaOf(hass, id)) || OUT_RX.test(hay(hass, id))))[0] || null;
    out.lux = M.pick(cfg, 'lux', out.autoLux);
    // 22.10: KI Utelys (switch.ki_utelys_*) går foran eldre input_boolean-hjelpere
    const kiU = (dom, suf) => M.all(hass, dom, (s, id) => new RegExp(`^${dom}\\.(.*_)?${suf}(_\\d+)?$`).test(id))[0] || null;
    out.autoAuto = kiU('switch', 'ki_utelys_auto') || M.all(hass, 'input_boolean', (s, id) => /utelys/.test(hay(hass, id)) && /(auto|automatikk)/.test(hay(hass, id)))[0] || null;
    out.auto = M.pick(cfg, 'automatikk', out.autoAuto);
    out.autoModus = M.all(hass, 'input_select', (s, id) => /utelys/.test(hay(hass, id)))[0] || null;
    out.modus = M.pick(cfg, 'modus', out.autoModus);
    out.autoKveld = kiU('switch', 'ki_utelys_kveld') || M.all(hass, 'input_boolean', (s, id) => /utelys/.test(hay(hass, id)) && /kveld/.test(hay(hass, id)))[0] || null;
    out.kveld = M.pick(cfg, 'kveld_bryter', out.autoKveld);
    out.autoMorgen = kiU('switch', 'ki_utelys_morgen') || M.all(hass, 'input_boolean', (s, id) => /utelys/.test(hay(hass, id)) && /morgen/.test(hay(hass, id)))[0] || null;
    out.morgen = M.pick(cfg, 'morgen_bryter', out.autoMorgen);
    // Øvrige KI Utelys- og sol-entiteter (UT_ENTS): U.<nøkkel> = overrides.<nøkkel> || auto, UA = auto
    out.U = { automatikk: out.auto, kveld_bryter: out.kveld, morgen_bryter: out.morgen };
    out.UA = { automatikk: out.autoAuto, kveld_bryter: out.autoKveld, morgen_bryter: out.autoMorgen };
    UT_ENTS.forEach(([k, , dom, suf]) => { if (!suf) return; out.UA[k] = kiU(dom, suf); out.U[k] = M.pick(cfg, k, out.UA[k]); });
    out.total = M.kiRomId(hass, null, 'lys');
    return out;
  };
  // Faner: [nøkkel, visningsnavn, standardnavn]
  const tabDefs = (A, c) => {
    const nm = (c && c.tab_names) || {};
    return [['out', 'Utelys'], ...A.floors.map((f) => [f.key, f.name]), ['on', 'Lys på']].map(([k, l]) => [k, nm[k] || l, l]);
  };
  // Scener for en etasje: KI Rom-lysscenene (button.*_lys_*) i etasjens rom, gruppert per scene (ett trykk = alle rom),
  // og/eller egne (lysnivåer + scene.* i etasjen). include.scener_lys legges alltid til. Sortert etter scene_order.
  M.lysScenes = function (h, c, F) {
    c = c || {};
    if (!h || !F) return [];
    const src = c.scene_source || 'auto', ki = [], own = [];
    if (src !== 'egne' && M.roomLightScenes) {
      const grp = {};
      F.rooms.forEach((r) => {
        if (!r.area) return;
        const ls = M.roomLightScenes(h, r.area);
        ls.ids.forEach((id) => {
          const m = ls.meta[id] || {}, mm = /_lys_(.+)$/.exec(obj(id)), k = 'ki:' + (mm ? mm[1] : M.slug(m.navn || id));
          if (!grp[k]) { grp[k] = { key: k, label: cap(m.navn || M.name(h, id)), icon: m.ikon || 'mdi:palette', ids: [], ki: true }; ki.push(grp[k]); }
          grp[k].ids.push(id);
        });
      });
    }
    if (src === 'egne' || src === 'begge' || (src === 'auto' && !ki.length)) {
      PRESETS.forEach(([k, l, ic, lvl]) => own.push({ key: 'p:' + k, label: l, icon: ic, level: lvl }));
      M.all(h, 'scene', (s, id) => F.rooms.some((r) => r.area && M.areaOf(h, id) === r.area)).forEach((id) => own.push({ key: id, label: M.name(h, id), icon: (h.states[id].attributes.icon) || 'palette', ids: [id] }));
    }
    const list = [...ki, ...own];
    (((c.include || {}).scener_lys) || []).forEach((id) => { if (!list.some((x) => x.key === id)) list.push({ key: id, label: M.name(h, id), icon: (h.states[id] && h.states[id].attributes.icon) || 'palette', ids: [id] }); });
    return byOrder(list, c.scene_order, (x) => x.key);
  };


  class Lys extends M.Card {
    static get cardName() { return 'Lys'; }
    static get defaults() { return {}; }
    // Mellomrom i Bubble-popupen (MSH.Card._applySpacing): tett inntil headeren, luft over navbaren
    static get spacingDefaults() { return { gap: 12, pad_top: -10, pad_bottom: 150 }; }
    static get schema() {
      return (h, c) => {
        c = c || {};
        const a = M.lysAuto(h, c);
        const tabs = tabDefs(a, c);
        const nmOf = (id, room) => lcfg(c, id).name || cap(M.name(h, id, room));
        // Ett lys: navn, ikon, lystype + funksjon (utseendet er felles for alle rader, se Visning)
        const light = (id, room) => {
          const p = 'lights.' + obj(id), st = h && h.states[id], T = lightType(st), u = lcfg(c, id);
          return { type: 'section', label: nmOf(id, room), icon: u.icon || 'mdi:lightbulb', meta: () => ltName(ltype(c, id, st)) + (st ? '' : ' · finnes ikke'), fields: [
            { type: 'text', name: p + '.name', label: 'Navn', placeholder: cap(M.name(h, id, room)) },
            { type: 'icon', name: p + '.icon', label: 'Ikon', auto: () => (st && st.attributes.icon) || 'mdi:lightbulb' },
            { type: 'select', name: 'light_types.' + obj(id), label: 'Lystype', options: LT_NAMES, help: 'Auto: ' + ltName(T) + '. Farge/temperatur vises bare for lys som støtter det.' },
            { type: 'section', label: 'Slider (avansert)', icon: 'mdi:tune-variant', fields: [
              { type: 'number', name: p + '.brightness_min', label: 'Minste lysstyrke (%)', min: 0, max: 100, placeholder: '0' },
              { type: 'number', name: p + '.brightness_max', label: 'Største lysstyrke (%)', min: 0, max: 100, placeholder: '100' },
              { type: 'select', name: p + '.color_control', label: 'Fargekontroll (utvidet)', options: LC },
              { type: 'boolean', name: p + '.hide_temperature_slider', label: 'Skjul temperaturslider', default: false },
              { type: 'boolean', name: p + '.hide_color_controls', label: 'Skjul fargespekter', default: false },
              { type: 'boolean', name: p + '.hide_color_presets', label: 'Skjul fargeforhåndsvalg', default: false },
              { type: 'text', name: p + '.color_presets', label: 'Fargeforhåndsvalg', placeholder: '#ffb74c, #ff8a65, rgb(129, 212, 250)', help: 'Kommaseparert liste' },
            ] },
          ] };
        };
        // Scener: union over alle etasjer (nøkler er felles: ki:<scene>, p:<nivå>, scene.*)
        const scOpts = sceneOpts(h, c, a).map((s) => [s.key, `${s.label}${s.ki ? ' · KI Rom' : s.level != null ? ` · lysnivå ${s.level} %` : ''}`]);
        const nLights = a.floors.reduce((n, F) => n + F.rooms.reduce((m, r) => m + r.ids.length, 0), 0);
        const O = (k) => 'outdoor.' + k;
        const out = [
          { type: 'section', id: 'look', label: 'Visning', icon: 'mdi:view-dashboard-outline', meta: (hh, cc) => `${gapOf(cc)} px · ${Number(cc.columns) === 2 ? 2 : 1} kolonne${Number(cc.columns) === 2 ? 'r' : ''} · ${sizeOf(cc) === 'compact' ? 'Kompakt' : 'Standard'}`, fields: [
            { type: 'select', name: 'columns', label: 'Kolonner', options: [[1, '1'], [2, '2']], default: 1 },
            { type: 'select', name: 'size', label: 'Størrelse', options: [['standard', 'Standard (40 px)'], ['compact', 'Kompakt (32 px)']], default: 'standard' },
            { type: 'range', name: 'slider_height', label: 'Slider-høyde', icon: 'mdi:arrow-expand-vertical', min: 32, max: 56, default: 40, presets: [[32, 'Kompakt 32'], [40, 'Standard 40'], [48, 'Stor 48'], [56, 'Ekstra stor 56']], help: 'Gjelder alle lys-radene (overstyrer Størrelse)' },
            { type: 'boolean', name: 'toasts', label: 'Bekreftelsesmeldinger', default: true },
          ] },
          { type: 'section', id: 'spacing', label: 'Mellomrom', icon: 'mdi:arrow-expand-vertical', meta: (hh, cc) => `${gapOf(cc)} px mellom`, fields: [
            { type: 'range', name: 'gap', label: 'Mellom seksjonene', icon: 'mdi:arrow-split-horizontal', min: 0, max: 48, default: 12, presets: [[8, 'Tett 8'], [12, 'Standard 12'], [18, 'Luftig 18']] },
            { type: 'range', name: 'tile_gap', label: 'Mellom lys-radene', icon: 'mdi:view-grid-outline', min: 0, max: 24, default: 12, presets: [[8, 'Tett 8'], [12, 'Standard 12'], [18, 'Luftig 18']], help: 'Tomt = som «Mellom seksjonene»' },
            { type: 'range', name: 'pad_top', label: 'Fra popup-headeren til første kort', icon: 'mdi:format-vertical-align-top', min: -20, max: 120, default: -10, presets: [[-20, 'Inntil −20'], [-10, 'Standard −10'], [6, 'Tett 6'], [20, 'Luftig 20']] },
            { type: 'range', name: 'pad_bottom', label: 'Luft i bunnen (over navbaren)', icon: 'mdi:format-vertical-align-bottom', min: 0, max: 300, default: 150, presets: [[40, 'Liten 40'], [150, 'Standard 150'], [220, 'Stor 220']] },
          ] },
          { type: 'section', id: 'tabs', label: 'Faner', icon: 'mdi:tab', meta: () => `${tabs.filter(([k]) => !(c.hidden_tabs || []).includes(k)).length} av ${tabs.length} vises`, fields: [
            { type: 'info', label: 'Standard: Utelys · én fane per etasje · Lys på. Piler = rekkefølge, øye = skjul (minst én fane vises). Du kan også holde inne en fane i popupen og dra den.' },
            { type: 'order', name: 'tab_order', hiddenName: 'hidden_tabs', label: 'Rekkefølge og synlighet', options: tabs.map(([k, l]) => [k, l]) },
            { type: 'select', name: 'start_tab', label: 'Startfane', options: [['', 'Første'], ...tabs.map(([k, l]) => [k, l])] },
            { type: 'section', label: 'Navn på fanene', icon: 'mdi:rename-outline', fields: tabs.map(([k, , d]) => ({ type: 'text', name: 'tab_names.' + k, label: d, placeholder: d })) },
            ...(a.floorsHA.length ? [{ type: 'section', label: 'Fane per etasje', icon: 'mdi:home-floor-1', fields: a.floorsHA.map((f) => ({ type: 'boolean', name: 'floor_tabs.' + f.id, label: f.name, default: f.has, help: f.has ? '' : 'Fant ingen lys i etasjen' })) }] : []),
          ] },
          { type: 'section', id: 'scenes', label: 'Scener', icon: 'mdi:palette', meta: () => `${scOpts.filter(([k]) => !(c.hidden_scenes || []).includes(k)).length} av ${scOpts.length} vises`, fields: [
            { type: 'info', label: 'Scener er engangshandlinger og vises aldri som aktive. KI Rom-scenene (button.*_lys_*) trykkes for alle rom i etasjen.' },
            { type: 'select', name: 'scene_source', label: 'Kilde', options: [['auto', 'Auto'], ['ki', 'KI Rom'], ['egne', 'Egne'], ['begge', 'Begge']], default: 'auto', help: 'Auto: KI Rom-scenene når etasjen har dem, ellers egne (lysnivåer + scene.* i etasjen)' },
            ...(scOpts.length ? [{ type: 'order', name: 'scene_order', hiddenName: 'hidden_scenes', label: 'Rekkefølge og synlighet', options: scOpts }] : [{ type: 'info', label: 'Fant ingen scener' }]),
            { type: 'entities', name: 'include.scener_lys', label: 'Egne scener', domains: ['scene', 'script', 'button'], addLabel: '+ Legg til scene' },
          ] },
          { type: 'section', id: 'rooms', label: 'Rom og lys', icon: 'mdi:lightbulb-group', meta: () => `${nLights} lys`, fields: [
            { type: 'info', label: 'Per rom: rekkefølge og skjul (hidden_rooms). Per lys: navn, ikon og lystype. Lagres under lights.<objekt-id> og light_types.<objekt-id>.' },
            ...a.floors.map((F) => ({ type: 'section', label: F.name, icon: F.icon || 'mdi:home-floor-1', meta: () => `${F.rooms.length} rom`, fields: [
              { type: 'order', name: 'room_order.' + (F.id || '_'), hiddenName: 'hidden_rooms', label: 'Rom (rekkefølge og synlighet)', options: F.rooms.map((r) => [r.area || '_', r.name]) },
              ...F.rooms.map((r) => ({ type: 'section', label: r.name, icon: r.icon || 'mdi:texture-box', meta: () => `${r.ids.length} av ${r.all.length} vises`, fields: [
                { type: 'order', name: 'light_order.' + (r.area || '_'), hiddenName: 'exclude', label: 'Lys (rekkefølge og synlighet)', options: r.all.map((id) => [id, nmOf(id, r.name)]) },
                ...r.all.map((id) => light(id, r.name)),
              ] })),
            ] })),
            { type: 'entities', name: 'include.lys', label: 'Lagt til', domains: ['light'], addLabel: '+ Legg til lys' },
          ] },
          { type: 'section', id: 'utelys', label: 'Utelys', icon: 'mdi:outdoor-lamp', meta: () => `${a.lamps.length} lamper`, fields: [
            { type: 'section', label: 'Visning', icon: 'mdi:clock-time-four-outline', fields: [
              { type: 'select', name: O('ring_start'), label: 'Døgnringen', options: [[0, '00 øverst'], [12, '12 øverst']], default: 0 },
              { type: 'order', name: O('sections'), hiddenName: O('hidden_sections'), label: 'Seksjoner under toppkortet (rekkefølge og synlighet)', options: UT_SECS },
            ] },
            { type: 'section', label: 'Entiteter', icon: 'mdi:link-variant', meta: () => 'KI Utelys + sol', fields: [
              { type: 'info', label: 'Autokonfig fra KI Utelys (switch/sensor/number.ki_utelys_*) og Sun (sensor.sun_next_*). Tomt = auto.' },
              ...UT_ENTS.map(([k, l, dom]) => ({ type: 'entity', name: 'overrides.' + k, label: l, domain: UT_DOMS[dom], auto: () => a.UA[k] })),
              { type: 'entity', name: 'overrides.lux', label: 'Lysnivåsensor (ute)', domain: 'sensor', device_class: 'illuminance', auto: () => a.autoLux },
              { type: 'entity', name: 'overrides.modus', label: 'Modusvelger (eldre)', domain: ['input_select', 'select'], auto: () => a.autoModus },
            ] },
            { type: 'section', label: 'Reserve uten KI Utelys', icon: 'mdi:clock-outline', meta: () => 'tider og terskler', fields: [
              { type: 'select', name: O('mode'), label: 'Styring', options: [['auto', 'Auto'], ['tid', 'Tidsplan'], ['manuell', 'Manuelt']], default: outCfg(c).mode },
              { type: 'text', name: O('on'), label: 'Tennes (HH:MM)', help: 'Tomt = solnedgang + forskyvning', auto: () => fmtSun(h, c, 'on') },
              { type: 'text', name: O('off'), label: 'Slukkes (HH:MM)', help: 'Tomt = soloppgang', auto: () => fmtSun(h, c, 'off') },
              { type: 'text', name: O('latest'), label: 'Slukk senest (HH:MM)' },
              { type: 'text', name: O('morning'), label: 'Morgen fra (HH:MM)', placeholder: '06:00' },
              { type: 'number', name: O('offset'), label: 'Forskyvning skumring (min)', step: 5, placeholder: '-15' },
              { type: 'number', name: O('lux_on'), label: 'Tenn under (lx)', step: 5, placeholder: '40' },
              { type: 'number', name: O('lux_off'), label: 'Slukk over (lx)', step: 5, placeholder: '120' },
              { type: 'boolean', name: O('kveld'), label: 'Kveld · tenn i skumringen', default: outCfg(c).kveld !== false },
              { type: 'boolean', name: O('morgen'), label: 'Morgen · tenn før det lysner', default: outCfg(c).morgen !== false },
            ] },
            ...(a.legacyLamps ? [
              { type: 'info', label: `Utelampene er satt som liste (lamps: ${a.lamps.length}). Gjør om for å velge lamper med entitetsvelgeren.` },
              { type: 'button', label: 'Bruk entitetsvelgeren', icon: 'mdi:swap-horizontal', run: (hh, cc, ed) => convertLamps(cc, a, ed) },
            ] : [
              ...(a.lampsAll.length ? [{ type: 'order', name: 'order.utelys', hiddenName: 'exclude', label: 'Lamper (rekkefølge og synlighet)', options: a.lampsAll.map((id) => [id, nmOf(id)]) }] : [{ type: 'info', label: 'Fant ingen utelamper automatisk' }]),
              { type: 'entities', name: 'include.utelys', label: 'Lagt til', domains: OUT_DOMS, multiple: true, addLabel: '+ Legg til lampe', help: 'Lys, brytere og hjelpere (input_boolean) som ikke ble funnet automatisk' },
              ...a.lampsAll.map((id) => light(id)),
            ]),
          ] },
          { type: 'button', label: 'Tilbakestill til standard', icon: 'mdi:restore', run: (hh, cc, ed) => {
            if (!window.confirm('Tilbakestille alle innstillinger for Lys til standard?')) return;
            ed._config = { type: cc.type };
            ed._set('card_id', cc.card_id);
          } },
        ];
        return out;
      };
    }
    get cardSize() { return 10; }
    get cfg() { return { ...DEF, ...this.config, ...outCfg(this.config) }; }
    // Tannhjulet / «Velg entitet»: eget «Tilpass lys»-ark (ikke den generiske editoren)
    customize(focus) { return openSheet(this, focus); }

    /* ---------------- tider */
    _times(A) {
      const c = this.cfg, sun = this.s(A.sun), at = (sun && sun.attributes) || {};
      const set = hm(at.next_setting), rise = hm(at.next_rising), dusk = hm(at.next_dusk);
      const on = mins(c.on) != null ? mins(c.on) : set != null ? set + Number(c.offset || 0) : null;
      const off = mins(c.off) != null ? mins(c.off) : rise;
      return { set, rise, dusk, on, off };
    }

    render() {
      const c = this.cfg, A = M.lysAuto(this.hass, this.config), ui = this.ui;
      this._A = A;
      const defs = tabDefs(A, c), names = Object.fromEntries(defs.map(([k, l]) => [k, l]));
      const tabs = M.mshOrder(defs.map((d) => d[0]), c.tab_order, c.hidden_tabs);
      const tab = tabs.includes(ui.tab) ? ui.tab : tabs.includes(c.start_tab) ? c.start_tab : tabs[0];
      const body = tab === 'out' ? this._out(A) : tab === 'on' ? this._on(A) : this._floor(A, A.floors.find((f) => f.key === tab));
      const vars = `--msh-gap:${gapOf(this.config)}px;--lt-gap:${rowGapOf(this.config)}px;--lt-cols:${Number(c.columns) === 2 ? 2 : 1};--lr-h:${M.lightRowHeight(this.config)}px`;
      // Én rad: fane-pillen (fyller bredden, scroller) + tannhjulet som egen knapp med samme glass-flate og ring
      return `<div class="wrap" style="${vars}">
        <div class="trow"><div class="tbox"><div class="tabs msh-tr" data-gd-skip>${tabs.map((k) => `<button class="tab${k === tab ? ' on' : ''}" role="tab" aria-selected="${k === tab}" data-act="tab" data-key="${esc(k)}" data-haptic="selection" style="background:${k === tab ? PINK : 'transparent'};color:${k === tab ? INK : 'var(--gray800,#afafaf)'}">${esc(names[k])}</button>`).join('')}</div></div>
          <button class="gear" data-act="customize" data-haptic="light" aria-label="Tilpass lys">${M.icon('mdi:cog', 22)}</button></div>
        ${body || ''}
      </div>`;
    }

    /* ---------------- lys: felles lys-rad (08-light-row.js) per lys (plassholder data-nomorph, fylles i _mountLights) */
    _light(id, name) {
      return `<div class="lsl" data-key="lc-${esc(id)}" data-lc="${esc(id)}" data-name="${esc(name || '')}" data-nomorph></div>`;
    }
    _lightCfg(id, name) {
      const c = this.config, s = this.hass.states[id];
      return M.lightRowCfg(id, { name: name || lcfg(c, id).name || cap(M.name(this.hass, id)), type: ltype(c, id, s), user: lcfg(c, id), height: M.lightRowHeight(c) });
    }
    _mountLights() { M.mountLightRows(this, (id, wrap) => this._lightCfg(id, wrap.dataset.name)); }
    set hass(h) {
      super.hass = h;
      M.lightRowsHass(this, h);
    }
    get hass() { return super.hass; }

    /* ---------------- Utelys */
    // Plan for neste 24 t fra «nå»: tenn/slukk som tidspunkt (ms). Tennes = fast tid (outdoor.on) eller solnedgang +
    // forskyvning; slukkes = fast tid (outdoor.off) eller soloppgang, men aldri senere enn «slukk senest».
    _plan(A, lit, mode) {
      const o = outCfg(this.config), now = Date.now(), D = 864e5;
      const sun = this.s(A.sun), at = (sun && sun.attributes) || {};
      const iso = (v) => { const t = v ? Date.parse(v) : NaN; return isNaN(t) ? null : t; };
      const set = iso(at.next_setting), rise = iso(at.next_rising);
      const clock = (hhmm, t) => { const m = mins(hhmm); if (m == null) return null; const d = new Date(t); d.setHours(Math.floor(m / 60), m % 60, 0, 0); let x = d.getTime(); while (x <= t) x += D; return x; };
      const sunAfter = (base, t) => { if (base == null) return null; let x = base; while (x <= t) x += D; while (x - D > t) x -= D; return x; };
      const offs = Number(o.offset || 0) * 6e4;
      const onAfter = (t) => (mins(o.on) != null ? clock(o.on, t) : set != null ? sunAfter(set + offs, t) : null);
      let latestHit = false;
      const offAfter = (t) => {
        let x = mins(o.off) != null ? clock(o.off, t) : rise != null ? sunAfter(rise, t) : null;
        const l = o.latest ? clock(o.latest, t) : null;
        latestHit = l != null && (x == null || l < x);
        if (latestHit) x = l;
        return x;
      };
      const p = { now, D, set, rise, o, pills: [], nights: [], on: null, off: null, first: lit ? 'off' : 'on', latest: false };
      if (mode !== 'manuell') {
        if (lit) {
          p.off = offAfter(now); p.latest = latestHit;
          p.on = p.off != null ? onAfter(p.off) : onAfter(now);
          const off2 = p.on != null ? offAfter(p.on) : null;
          if (p.off != null) p.pills.push([now, p.off]);
          if (p.on != null && off2 != null) p.pills.push([p.on, off2]);
        } else {
          p.on = onAfter(now);
          p.off = p.on != null ? offAfter(p.on) : offAfter(now); p.latest = latestHit;
          if (p.on != null && p.off != null) p.pills.push([p.on, p.off]);
        }
      } else if (lit) p.pills.push([now, now + D]);
      // Natt (solnedgang → soloppgang) i vinduet
      if (set != null && rise != null) {
        if (rise < set) p.nights.push([now, rise]);
        for (let s1 = set; s1 < now + D; s1 += D) p.nights.push([s1, sunAfter(rise, s1)]);
      }
      return p;
    }
    // 22.10 · Utelys «Døgnring»: alle tider/tilstander for fanen. KI Utelys-sensorene (neste_paa/neste_av) går foran;
    // uten dem brukes planen fra sun.sun + outdoor-reserven (_plan). Sol: sensor.sun_next_* → sun.sun-attributter.
    _ut(A) {
      const U = A.U || {}, L = A.lamps, now = Date.now(), D = 864e5;
      const onN = L.filter((l) => M.isOn(this.s(l.id))).length, lit = onN > 0;
      const as = this.s(U.automatikk), autoOn = as ? M.isOn(as) : this._mode(A) !== 'manuell';
      const iso = (v) => { const t = v ? Date.parse(v) : NaN; return isNaN(t) ? null : t; };
      const ts = (id) => { const s = this.s(id); return s && !M.unavailable(s) ? iso(s.state) : null; };
      const p = this._plan(A, lit, 'auto');
      const on = ts(U.neste_paa) != null ? ts(U.neste_paa) : p.on, off = ts(U.neste_av) != null ? ts(U.neste_av) : p.off;
      const sun = this.s(A.sun), sa = (sun && sun.attributes) || {};
      const sunT = (k, attr) => (ts(U[k]) != null ? ts(U[k]) : iso(sa[attr]));
      const S = { dawn: sunT('sun_dawn', 'next_dawn'), rising: sunT('sun_rising', 'next_rising'), noon: sunT('sun_noon', 'next_noon'), setting: sunT('sun_setting', 'next_setting'), dusk: sunT('sun_dusk', 'next_dusk') };
      const ev = this.n(U.sun_elevation), elev = ev != null ? ev : sa.elevation != null ? Number(sa.elevation) : null;
      const rs = this.s(U.sun_stiger), rising = rs ? M.isOn(rs) : sa.rising != null ? !!sa.rising : S.noon != null && S.setting != null ? S.noon < S.setting : null;
      const sunUp = elev != null ? elev > 0 : sun ? sun.state === 'above_horizon' : null;
      // Neste hendelse: den første av tennes/slukkes som ligger fram i tid
      const fut = (t) => (t != null && t > now - 6e4 ? t : null);
      const next = fut(on) != null && (fut(off) == null || on < off) ? 'on' : fut(off) != null ? 'off' : null;
      return { U, L, now, D, onN, lit, autoOn, on, off, S, elev, rising, sunUp, next, as };
    }
    // HH:MM og «i dag / i morgen / ukedag» (nb-NO)
    _hm(t) { if (t == null) return '–'; const d = new Date(t); return `${M.pad(d.getHours())}:${M.pad(d.getMinutes())}`; }
    _day(t) {
      if (t == null) return '';
      const d = new Date(t), a = new Date(); a.setHours(0, 0, 0, 0);
      const n = Math.round((new Date(d).setHours(0, 0, 0, 0) - a.getTime()) / 864e5);
      return n === 0 ? 'i dag' : n === 1 ? 'i morgen' : n === -1 ? 'i går' : d.toLocaleDateString('nb-NO', { weekday: 'long' });
    }
    // 24-timers ringen (SVG 188 px). 00 øverst (outdoor.ring_start 12 → 12 øverst), med klokka.
    _ring(u) {
      const oc = (this.config.outdoor && typeof this.config.outdoor === 'object') ? this.config.outdoor : {};
      const rot = Number(oc.ring_start) === 12 ? 180 : 0, W = 188, c = W / 2, R = 80, SW = 14;
      const tod = (t) => { const d = new Date(t); return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60; };
      const ang = (t) => ((tod(t) / 1440) * 360 + rot) * Math.PI / 180;
      const pt = (a, r) => [c + r * Math.sin(a), c - r * Math.cos(a)];
      const arc = (t1, t2, r) => {
        if (t1 == null || t2 == null) return null;
        const a1 = ang(t1), a2 = ang(t2); let sw = a2 - a1; while (sw < 0) sw += 2 * Math.PI; while (sw >= 2 * Math.PI) sw -= 2 * Math.PI;
        if (sw < 0.01) return null;
        const [x1, y1] = pt(a1, r), [x2, y2] = pt(a2, r);
        return `M${x1.toFixed(2)} ${y1.toFixed(2)}A${r} ${r} 0 ${sw > Math.PI ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
      };
      const night = arc(u.S.setting, u.S.rising, R), lamp = arc(u.on, u.off, R);
      const hours = [0, 6, 12, 18].map((hh) => { const a = ((hh * 60) / 1440 * 360 + rot) * Math.PI / 180, [x, y] = pt(a, R - 21); return `<text x="${x.toFixed(1)}" y="${(y + 3.5).toFixed(1)}" class="rh">${M.pad(hh)}</text>`; }).join('');
      const mark = (t, up) => { if (t == null) return ''; const [x, y] = pt(ang(t), R); return `<g class="rm" data-key="rm-${up ? 'u' : 'd'}"><circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="9"/><text x="${x.toFixed(2)}" y="${(y + 4).toFixed(2)}">${up ? '↑' : '↓'}</text></g>`; };
      const [nx, ny] = pt(ang(u.now), R);
      return `<svg class="ring" viewBox="0 0 ${W} ${W}" width="${W}" height="${W}" aria-hidden="true">
        <circle cx="${c}" cy="${c}" r="${R}" fill="none" stroke="var(--gray400,#545454)" stroke-width="${SW}"/>
        ${night ? `<path class="rn" d="${night}" fill="none" stroke="#262626" stroke-width="${SW}"/>` : ''}
        ${lamp ? `<path class="rl${u.autoOn ? '' : ' off'}" d="${lamp}" fill="none" stroke="${u.autoOn ? Y : 'var(--gray600,#7f7f7f)'}" stroke-width="${SW - 6}" stroke-linecap="round"/>` : ''}
        ${hours}${mark(u.S.rising, true)}${mark(u.S.setting, false)}
        <circle class="rnow" cx="${nx.toFixed(2)}" cy="${ny.toFixed(2)}" r="6" fill="${u.sunUp ? Y : '#fafafa'}" stroke="#282828" stroke-width="2.5"/>
      </svg>`;
    }
    _outCard(A, u) {
      const L = u.L, dur = (ms) => { const m = Math.max(0, Math.round(ms / 6e4)); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} t ${m % 60} min`; };
      const status = !L.length ? 'Ingen lamper' : u.next === 'on' ? `Tennes om ${dur(u.on - u.now)}` : u.next === 'off' ? `Slukkes om ${dur(u.off - u.now)}` : u.lit ? 'Lyser nå' : 'Mangler tider';
      const tile = (k) => {
        const t = k === 'on' ? u.on : u.off, nx = u.next === k;
        return `<div class="evt${nx ? ' nx' : ''}" data-key="ev-${k}"><span class="evl">${M.icon(k === 'on' ? 'mdi:lightbulb-on-outline' : 'mdi:lightbulb-off-outline', 16)}${k === 'on' ? 'Tennes' : 'Slukkes'}</span>
          <span class="evv num">${this._hm(t)}</span><span class="evs">${esc(t == null ? 'Mangler tid' : this._day(t))}</span></div>`;
      };
      return `<section class="uc${u.lit ? ' lit' : ''}" data-key="uc">
        <div class="uct"><span class="t13" style="color:var(--gray800,#afafaf)">Utelys</span><span class="chip${u.lit ? ' on' : ''}">${L.length ? `${u.onN} av ${L.length}` : 'ingen lamper'}</span><span class="grow"></span><span class="t12 ust ell">${esc(status)}</span></div>
        <div class="ucb">
          <div class="rw">${this._ring(u)}
            <button class="rc${u.lit ? ' on' : ''}" data-act="outall" data-haptic="success" aria-label="${u.lit ? 'Slå av utelys' : 'Slå på utelys'}" ${L.length ? '' : 'disabled'}>
              ${M.icon(u.lit ? 'mdi:lightbulb-on' : 'mdi:lightbulb-outline', 24)}<span class="rcv">${u.lit ? 'På' : 'Av'}</span><span class="rcs">${esc(u.lit ? (u.off != null ? `slukkes ${this._hm(u.off)}` : '') : (u.on != null ? `tennes ${this._hm(u.on)}` : ''))}</span></button></div>
          <div class="ev">${tile('on')}${tile('off')}</div>
        </div>
      </section>`;
    }
    _utAuto(A, u) {
      const st = this.s(u.U.utelys_status), sv = st && !M.unavailable(st) && String(st.state).trim() && st.state !== 'unknown' ? String(st.state) : null;
      const txt = sv || (!u.autoOn ? 'Av – utelyset styres manuelt' : u.lit ? 'Utelyset er på' : u.next === 'on' ? 'Venter på mørket' : 'Styrer utelyset');
      const c = this.cfg;
      const sw = (on) => `<span class="sw" style="background:${on ? G : '#4a4a4d'}"><span style="left:${on ? 26 : 4}px;background:${on ? '#2a2a2c' : '#d8d6d1'}"></span></span>`;
      const fl = (k, ic, l, sub, ent) => { const on = ent ? M.isOn(this.s(ent)) : c[k] !== false; return `<button class="af${on ? ' on' : ''}" data-act="auto" data-k="${k}" data-id="${esc(ent || '')}" data-key="af-${k}" data-haptic="success" aria-pressed="${on}"><span class="afi">${M.icon(ic, 20)}</span><span class="col" style="gap:2px;min-width:0;text-align:left"><span class="t14">${l}</span><span class="t12 ell" style="color:var(--gray700,#979797)">${esc(sub)}</span></span></button>`; };
      return `<section class="st" data-key="ut-auto">
        <button class="ar" data-act="utauto" data-key="ut-ar" data-haptic="success">${M.icon('mdi:robot-outline', 22, 'color:var(--gray900,#c7c7c7);width:26px')}<span class="grow col" style="gap:2px;text-align:left;min-width:0"><span class="t15">Automatikk</span><span class="t12" style="color:var(--gray700,#979797)">${esc(txt)}</span></span>${sw(u.autoOn)}</button>
        <div class="afs${u.autoOn ? '' : ' dim0'}">${fl('kveld', 'mdi:weather-sunset-down', 'Kveld', 'Tenn i skumringen', A.kveld)}${fl('morgen', 'mdi:weather-sunset-up', 'Morgen', 'Før det lysner', A.morgen)}</div>
      </section>`;
    }
    // Lamper: 2 kolonner, 64 px piller. Trykk = av/på, dra sidelengs = dimming, hold = more-info (data-ent)
    _utLamps(A) {
      const L = A.lamps;
      if (!L.length) return M.emptyState('Fant ingen utelamper', 'utelys');
      return `<section class="lps" data-key="ut-lamps">${L.map((l) => {
        const s = this.s(l.id), on = M.isOn(s), dim = String(l.id).startsWith('light.') && s && dimmable(s, this.config, l.id);
        const pct = on ? (dim ? pctOf(s) : 100) : 0, ov = (this.config.overrides || {})[l.id];
        const lc = on && M.lampColor ? M.lampColor(s, (ov && typeof ov === 'object' && ov.color) || lcfg(this.config, l.id).color) : { css: Y, lum: 0.7 };
        const ic = l.icon || (s && s.attributes.icon) || (on ? 'mdi:lightbulb-on' : 'mdi:lightbulb-outline');
        const val = !s ? 'Finnes ikke' : M.unavailable(s) ? 'Utilgjengelig' : on ? (dim ? `${pct} %` : 'På') : 'Av';
        return `<div class="lp${on ? ' on' : ''}" data-lp="${esc(l.id)}" data-ent="${esc(l.id)}" data-dim="${dim ? 1 : 0}" data-pct="${pct}" data-key="lp-${esc(l.id)}" role="button" aria-label="${esc(l.name)}">
          <span class="lpf" style="width:${pct}%;${on ? `background-color:${lc.css};-webkit-mask-image:${M.lampMask(lc.lum)};mask-image:${M.lampMask(lc.lum)}` : ''}"></span>
          <span class="lpi" style="${on ? `background:${lc.css};color:#282828` : ''}">${M.icon(ic, 20)}</span>
          <span class="col lpt"><span class="t14 ell">${esc(l.name)}</span><span class="t12 lpv">${esc(val)}</span></span></div>`;
      }).join('')}</section>`;
    }
    _utSun(u) {
      const E = [['dawn', 'Grålysning', 'mdi:weather-sunset'], ['rising', 'Soloppgang', 'mdi:weather-sunset-up'], ['noon', 'Midt på dagen', 'mdi:white-balance-sunny'], ['setting', 'Solnedgang', 'mdi:weather-sunset-down'], ['dusk', 'Skumring', 'mdi:weather-night']];
      const fut = E.filter(([k]) => u.S[k] != null && u.S[k] > u.now).sort((a, b) => u.S[a[0]] - u.S[b[0]])[0];
      const el = u.elev != null ? `Solhøyde ${u.elev < 0 ? '−' : ''}${M.nf(Math.abs(u.elev), 1)}°` : 'Solhøyde –';
      const dir = u.rising == null ? '' : u.rising ? ' · stiger' : ' · synker';
      return `<section class="sol" data-key="ut-sun">
        <div class="row" style="gap:10px;padding:0 4px"><span class="grow t15">Sola</span><span class="t12" style="color:var(--gray700,#979797)">${esc(el + dir)}</span>${u.rising == null ? '' : M.icon(u.rising ? 'mdi:arrow-top-right' : 'mdi:arrow-bottom-right', 16, `color:${u.rising ? Y : 'var(--gray700,#979797)'}`)}</div>
        <div class="sr noscroll">${E.map(([k, l, ic]) => `<div class="stl${fut && fut[0] === k ? ' nx' : ''}" data-key="sun-${k}">${M.icon(ic, 18)}<span class="t12 stn">${l}</span><span class="evv num" style="font-size:20px">${this._hm(u.S[k])}</span><span class="t11" style="color:var(--gray700,#979797)">${esc(this._day(u.S[k]))}</span></div>`).join('')}</div>
      </section>`;
    }
    _utSettings(u) {
      const open = !!(this.ui.fold || {}).utset, U = u.U;
      const v = (id) => { const n = this.n(id); return n == null ? '–' : M.nf(n, 0); };
      const meta = `${v(U.terskel_paa)} / ${v(U.terskel_av)} lx · ${v(U.minst_morke)} min`;
      const row = (id, l, unit) => (id ? M.stepperHTML(this.hass, id, { label: l, step: 5, unit, key: 'stp-' + id }) : `<div class="msh-stp-row"><span class="msh-stp-l"><span class="msh-stp-ln">${esc(l)}</span><span class="msh-stp-ls">Velg entitet i Tilpass</span></span><span class="t13" style="color:var(--gray700,#979797)">–</span></div>`);
      return `<section class="fd" data-key="fold-utset">
        <button class="fh" data-act="fold" data-k="utset">${M.icon('mdi:tune-variant', 22)}<span class="grow t15">Innstillinger</span><span class="t12" style="color:var(--gray700,#979797);white-space:nowrap">${esc(meta)}</span>${M.icon('expand_more', 22, `color:var(--gray700,#979797);transform:${open ? 'rotate(180deg)' : 'none'};transition:transform .25s`)}</button>
        ${open ? `<div class="fb ufb">${row(U.terskel_paa, 'Tenn under', 'lx')}${row(U.terskel_av, 'Slukk over', 'lx')}${row(U.minst_morke, 'Minste mørketid', 'min')}</div>` : ''}
      </section>`;
    }
    _out(A) {
      const u = this._ut(A), oc = (this.config.outdoor && typeof this.config.outdoor === 'object') ? this.config.outdoor : {};
      const keys = M.mshOrder(UT_SECS.map((x) => x[0]), oc.sections, oc.hidden_sections);
      const part = { auto: () => this._utAuto(A, u), lamps: () => this._utLamps(A), sun: () => this._utSun(u), settings: () => this._utSettings(u) };
      return `<div class="ut">${this._outCard(A, u)}${keys.map((k) => part[k]()).join('')}</div>`;
    }
    _mode(A) {
      const ms = this.s(A.modus);
      if (ms) { const v = M.slug(ms.state); return /man/.test(v) ? 'manuell' : /(tid|plan|sched)/.test(v) ? 'tid' : 'auto'; }
      const ab = this.s(A.auto);
      const m = this.cfg.mode || 'auto';
      if (ab && ab.state === 'off') return 'manuell';
      if (ab && ab.state === 'on' && m === 'manuell') return 'auto';
      return m;
    }
    _fold(k, icon, title, meta, rows) {
      const open = !!(this.ui.fold || {})[k];
      return `<section class="fd" data-key="fold-${k}">
        <button class="fh" data-act="fold" data-k="${k}">${M.icon(icon, 22)}<span class="grow t15">${esc(title)}</span><span class="t12" style="color:var(--gray700,#979797);white-space:nowrap">${esc(meta)}</span>${M.icon('expand_more', 22, `color:var(--gray700,#979797);transform:${open ? 'rotate(180deg)' : 'none'};transition:transform .25s`)}</button>
        ${open ? `<div class="fb">${rows ? rows.map(([a, b], i) => `<div class="frr${i ? ' bt' : ''}"><span class="grow t13">${esc(a)}</span><span class="fv num">${esc(b)}</span></div>`).join('') : M.emptyState('Fant ingen sol-entitet (sun.sun)', null).replace('class="empty"', 'class="empty in"')}</div>` : ''}
      </section>`;
    }
    /* ---------------- Etasje */
    _floor(A, F) {
      if (!F) return M.emptyState('Fant ingen lys', 'rooms');
      const c = this.config, hid = new Set(c.hidden_rooms || []), hidSc = new Set(c.hidden_scenes || []);
      // Scener: engangshandlinger – samme hvile-utseende alltid, bare trykk-animasjon + haptic
      const scenes = M.lysScenes(this.hass, c, F).filter((x) => !hidSc.has(x.key));
      let out = scenes.length ? `<section class="sc noscroll">${scenes.map((x) => `<button class="scb" data-act="scene" data-k="${esc(x.key)}" data-key="sc-${esc(x.key)}" data-haptic="success"><span class="scbb">${M.icon(x.icon || 'palette', 24)}</span><span class="scl ell">${esc(x.label)}</span></button>`).join('')}</section>` : '';
      const rooms = F.rooms.filter((r) => r.ids.length && !hid.has(r.area || '_'));
      out += rooms.map((r) => {
        const n = r.ids.filter((id) => { const s = this.s(id); return s && s.state === 'on'; }).length;
        return `<section class="col" style="gap:8px" data-key="r-${esc(r.area || '_')}">
          <div class="rh">${M.icon(r.icon || 'mdi:texture-box', 18, 'color:#fafafa')}<span class="grow t15 ell" style="color:#fafafa">${esc(r.name)}</span><span class="t12" style="color:var(--gray700,#979797);white-space:nowrap">${n ? `${n} på` : 'alle av'}</span>
            <button class="all press" data-act="room" data-area="${esc(r.area || '')}" data-on="${n ? 1 : 0}" data-haptic="success" style="background:${n ? C.ctrl : M.alpha(Y, 0.18)};color:${n ? '#fafafa' : Y}">${n ? 'Av' : 'På'}</button></div>
          <div class="lbox">${r.ids.map((id) => this._light(id, lcfg(c, id).name || cap(M.name(this.hass, id, r.name)), r.area)).join('')}</div></section>`;
      }).join('');
      if (!rooms.length) out += M.emptyState('Alle rom i etasjen er skjult', 'rooms');
      return out;
    }

    /* ---------------- Lys på */
    _onList(A) {
      const tot = this.s(A.total), ex = new Set(this.config.exclude || []);
      let ids = null;
      if (tot && Array.isArray(tot.attributes.aktiv_liste)) ids = M.ids(tot.attributes.aktiv_liste).filter((id) => !ex.has(id) && this.s(id) && this.s(id).state === 'on');
      const comp = A.all.concat(A.lamps.map((l) => l.id)).filter((id, i, a) => a.indexOf(id) === i && this.s(id) && this.s(id).state === 'on');
      if (!ids) ids = comp; else comp.forEach((id) => { if (!ids.includes(id)) ids.push(id); });
      return { ids, tot };
    }
    _on(A) {
      const { ids, tot } = this._onList(A);
      // effekt: sensor med device_class power på samme enhet som lyset
      let w = 0, hasW = false;
      ids.forEach((id) => {
        const e = M.regEntry(this.hass, id), dev = e && e.device_id;
        if (!dev) return;
        const p = M.all(this.hass, 'sensor', (s, sid) => s.attributes.device_class === 'power' && (M.regEntry(this.hass, sid) || {}).device_id === dev)[0];
        const v = p ? this.n(p) : null;
        if (v != null) { w += v; hasW = true; }
      });
      const cnt = A.all.concat(A.lamps.map((l) => l.id)).filter((x, i, a) => a.indexOf(x) === i).length;
      const total = tot && tot.attributes.totalt != null && Number(tot.attributes.totalt) >= ids.length ? tot.attributes.totalt : Math.max(cnt, ids.length);
      return `<section class="sum"><span class="col grow"><span class="big num">${ids.length}</span><span class="t12 dim">${hasW ? `lys på · ca. ${M.nf(w, 0)} W` : `lys på · av ${total}`}</span></span>
          <button class="offall press" data-act="alloff" data-haptic="success" ${ids.length ? '' : 'disabled style="opacity:.5"'}>${M.icon('dark_mode', 20)}Slå av alle</button></section>
        <section class="col" style="gap:8px">
          ${ids.map((id) => { const s = this.s(id), a = A.aOf[id] || M.areaOf(this.hass, id), ov = (this.config.overrides || {})[id], lc = M.lampColor ? M.lampColor(s, (ov && typeof ov === 'object' && ov.color) || lcfg(this.config, id).color) : { css: Y }; return `<button class="onr press" data-act="off" data-id="${esc(id)}" data-ent="${esc(id)}" data-key="${esc(id)}" data-haptic="success"><span class="oni" style="background:${lc.css}">${M.icon('lightbulb', 20)}</span><span class="grow col"><span class="t14 ell">${esc(M.name(this.hass, id))}</span><span class="t11 dim ell">${esc(`${a ? M.areaName(this.hass, a) : 'Uten rom'} · ${dimmable(s) ? pctOf(s) + ' %' : 'På'}`)}</span></span>${M.icon('power_settings_new', 20, 'color:var(--gray600,#7f7f7f)')}</button>`; }).join('')}
          ${ids.length ? '' : '<div class="none">Alle lys er av</div>'}
        </section>`;
    }

    /* ---------------- handlinger */
    // Utelys-innstillinger lagres i config.outdoor (eldre rotnøkkel med samme navn fjernes)
    _patchOutdoor(p) {
      const c = this.config, o = { ...((c.outdoor && typeof c.outdoor === 'object') ? c.outdoor : {}), ...p }, patch = { outdoor: o };
      Object.keys(p).forEach((k) => { if (k in c) patch[k] = undefined; });
      return M.mshPatchConfig(this, patch);
    }
    onAction(name, el, ev) {
      const d = el.dataset, h = this.hass, A = this._A || M.lysAuto(h, this.config);
      const toast = (t) => { if (this.config.toasts !== false) M.toast(t); };
      switch (name) {
        case 'tab': return this.setUI({ tab: d.key });
        case 'fold': return this.setUI({ fold: { ...(this.ui.fold || {}), [d.k]: !(this.ui.fold || {})[d.k] } });
        case 'outall': {
          const ids = A.lamps.map((l) => l.id), lit = ids.some((id) => { const s = this.s(id); return s && s.state === 'on'; });
          if (!ids.length) return;
          toast(lit ? 'Utelys slått av' : 'Utelys slått på');
          return M.call(h, ids.every((id) => id.startsWith('light.')) ? 'light' : 'homeassistant', lit ? 'turn_off' : 'turn_on', { entity_id: ids });
        }
        case 'mode': {
          const v = d.v, ms = this.s(A.modus);
          if (ms) { const opts = ms.attributes.options || []; const o = opts.find((x) => (v === 'manuell' ? /man/ : v === 'tid' ? /(tid|plan|sched)/ : /auto/).test(M.slug(x))); if (o) return M.call(h, ms.entity_id.split('.')[0], 'select_option', { entity_id: ms.entity_id, option: o }); }
          if (A.auto) M.call(h, 'input_boolean', v === 'manuell' ? 'turn_off' : 'turn_on', { entity_id: A.auto });
          return this._patchOutdoor({ mode: v });
        }
        case 'utauto': {
          // Automatikk: KI Utelys-bryteren (switch.ki_utelys_auto), ellers eldre modus (outdoor.mode)
          const id = (A.U || {}).automatikk;
          if (id) return M.toggle(h, id);
          return this._patchOutdoor({ mode: this._mode(A) === 'manuell' ? 'auto' : 'manuell' });
        }
        case 'lamp': {
          const id = d.lp, s = this.s(id);
          if (!s) return;
          return M.call(h, id.startsWith('light.') ? 'light' : 'homeassistant', M.isOn(s) ? 'turn_off' : 'turn_on', { entity_id: id });
        }
        case 'auto': if (d.id) return M.toggle(h, d.id); return this._patchOutdoor({ [d.k]: !this.cfg[d.k] });
        case 'scene': {
          // Engangshandling: lysnivå (egne) eller trykk på KI Rom-knappene / scene.* / script.* – ingen varig markering
          const F = A.floors.find((f) => f.key === this._curTab());
          const it = F && M.lysScenes(h, this.config, F).find((x) => x.key === d.k);
          if (!it) return;
          toast(`${F.name}: ${it.label}`);
          if (it.level != null) {
            const ids = F.rooms.flatMap((r) => r.ids);
            if (!ids.length) return;
            if (!it.level) return M.call(h, 'light', 'turn_off', { entity_id: ids });
            const dim = ids.filter((id) => dimmable(this.s(id), this.config, id)), plain = ids.filter((id) => !dimmable(this.s(id), this.config, id));
            if (dim.length) M.call(h, 'light', 'turn_on', { entity_id: dim, brightness_pct: it.level });
            if (plain.length) M.call(h, 'light', 'turn_on', { entity_id: plain });
            return;
          }
          (it.ids || []).forEach((id) => { const dom = id.split('.')[0]; M.call(h, dom, dom === 'button' || dom === 'input_button' ? 'press' : 'turn_on', { entity_id: id }); });
          return;
        }
        case 'room': {
          const F = A.floors.find((f) => f.rooms.some((r) => (r.area || '') === d.area && f.key === this._curTab()));
          const r = F && F.rooms.find((x) => (x.area || '') === d.area);
          if (!r) return;
          return M.call(h, 'light', d.on === '1' ? 'turn_off' : 'turn_on', { entity_id: r.ids });
        }
        case 'alloff': { const { ids } = this._onList(A); if (!ids.length) return; toast('Alle lys slått av'); return M.call(h, 'light', 'turn_off', { entity_id: ids }); }
        case 'off': return M.call(h, 'light', 'turn_off', { entity_id: d.id });
        default: return super.onAction(name, el, ev);
      }
    }
    _curTab() {
      const c = this.cfg, A = this._A;
      const tabs = M.mshOrder(tabDefs(A, c).map((x) => x[0]), c.tab_order, c.hidden_tabs);
      return tabs.includes(this.ui.tab) ? this.ui.tab : tabs.includes(c.start_tab) ? c.start_tab : tabs[0];
    }

    /* ---------------- faner (felles MSH.tabReorder) og lys-slidere */
    afterRender() {
      const row = this.shadowRoot.querySelector('.tabs');
      M.tabReorder(row, {
        card: this, glass: true,
        items: () => Array.from(row.querySelectorAll('.tab')),
        active: () => this._curTab(),
        onSelect: (k) => this.setUI({ tab: k }),
        onReorder: (keys) => { const hid = this.config.hidden_tabs || []; M.mshPatchConfig(this, { tab_order: keys.concat(hid.filter((k) => !keys.includes(k))) }); },
      });
      M.mshTabDrag(this, this.shadowRoot.querySelector('.seg'), { glass: true, onSelect: (k) => { const b = this.shadowRoot.querySelector(`.seg [data-key="${k}"]`); if (b) this.onAction('mode', b); } });
      const sr = this.shadowRoot.querySelector('.sr');
      if (sr && !sr.__b) { sr.__b = true; const st = (e) => e.stopPropagation(); sr.addEventListener('touchstart', st, { passive: true }); sr.addEventListener('touchmove', st, { passive: true }); }
      const sc = this.shadowRoot.querySelector('.sc');
      if (sc && !sc.__b) { sc.__b = true; const st = (e) => e.stopPropagation(); sc.addEventListener('touchstart', st, { passive: true }); sc.addEventListener('touchmove', st, { passive: true }); }
      this._mountLights();
      this._bindLamps();
      if (M.bindSteppers) M.bindSteppers(this.shadowRoot, this);
    }
    // 22.10: døgnringen oppdateres hvert minutt, bare mens popupen er åpen (onOpen/onClose fra MSH.Card)
    onOpen() {
      clearInterval(this._utT);
      this._utT = setInterval(() => { if (this._curTab() === 'out') this._schedule(true); }, 60000);
    }
    onClose() { clearInterval(this._utT); this._utT = null; }
    // Utelampe-pillene: trykk = av/på, dra sidelengs = dimming (pan-y + stopPropagation, fallgruve 2), hold = more-info
    _bindLamps() {
      const R = this.shadowRoot;
      if (!R || R.__utLp) return;
      R.__utLp = true;
      let g = null;
      const stop = (e) => { if (e.target.closest && e.target.closest('.lp')) e.stopPropagation(); };
      R.addEventListener('touchstart', stop, { passive: true });
      R.addEventListener('touchmove', stop, { passive: true });
      R.addEventListener('pointerdown', (e) => {
        const el = e.target.closest && e.target.closest('.lp');
        if (!el || e.button) return;
        e.stopPropagation();
        const r = el.getBoundingClientRect();
        g = { el, x: e.clientX, y: e.clientY, t: Date.now(), w: r.width, p0: Number(el.dataset.pct) || 0, drag: false, pct: null, id: e.pointerId };
      });
      R.addEventListener('pointermove', (e) => {
        if (!g) return;
        const dx = e.clientX - g.x, dy = e.clientY - g.y;
        if (!g.drag) {
          if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { g = null; return; }
          if (Math.abs(dx) < 8 || g.el.dataset.dim !== '1') return;
          g.drag = true;
          try { g.el.setPointerCapture(g.id); } catch (x) { /* */ }
          g.el.classList.add('drag');
        }
        e.stopPropagation();
        const p = Math.max(0, Math.min(100, Math.round(g.p0 + (dx / g.w) * 100)));
        if (p !== g.pct) {
          if (g.pct != null && Math.round(p / 10) !== Math.round(g.pct / 10)) M.haptic('selection');
          g.pct = p;
          const f = g.el.querySelector('.lpf'), v = g.el.querySelector('.lpv');
          if (f) { f.style.width = p + '%'; if (!f.style.backgroundColor) f.style.backgroundColor = Y; }
          if (v) v.textContent = p ? `${p} %` : 'Av';
        }
      });
      const end = (e) => {
        if (!g) return;
        const G0 = g; g = null;
        G0.el.classList.remove('drag');
        const id = G0.el.dataset.lp;
        if (G0.drag) {
          if (e.type !== 'pointerup' || G0.pct == null) return this._schedule(true);
          M.haptic('selection');
          this._swallow = true; setTimeout(() => { this._swallow = false; }, 400);
          return G0.pct ? M.call(this.hass, 'light', 'turn_on', { entity_id: id, brightness_pct: G0.pct }) : M.call(this.hass, 'light', 'turn_off', { entity_id: id });
        }
        // Trykk (ikke hold – hold åpner more-info etter 520 ms i MSH.Card)
        if (e.type === 'pointerup' && Date.now() - G0.t < 500) { M.haptic('success'); this.onAction('lamp', G0.el, e); }
      };
      R.addEventListener('pointerup', end);
      R.addEventListener('pointercancel', end);
    }

    get styles() {
      return `
        :host,ha-card{background:none!important;box-shadow:none!important;border:none!important}
        .wrap{display:flex;flex-direction:column;gap:var(--msh-gap,12px);background:none}
        .t15{font-size:15px;font-weight:500} .t14{font-size:14px;font-weight:500} .t13{font-size:13px} .t12{font-size:12px} .t11{font-size:11px}
        .dim{color:var(--gray600,#7f7f7f)}
        .bt{border-top:1px solid rgba(255,255,255,0.06)}
        ${M.TAB_ROW_CSS || ''}
        ${M.LIGHT_ROW_CSS || ''}
        /* fane-rad: pillen fyller bredden (scroller), tannhjulet er egen knapp med samme flate og ring.
           Standard: transparent + ring. Glassflate (blur + glasskant) bare med Liquid Glass-temaet (MSH.tabSurface, Fiks 15.2);
           glass-dra/trykk-linsen (MSH.tabReorder glass + glassTap) er alltid på. */
        .trow{display:flex;align-items:center;gap:8px;min-width:0}
        .tbox{flex:1;min-width:0;padding:4px;border-radius:22px;${TRS}overflow:hidden}
        .tabs{gap:2px;border-radius:18px;overflow-x:auto;scrollbar-width:none}
        .tabs::-webkit-scrollbar{display:none}
        .tab{height:36px;padding:0 14px;border-radius:18px;font-size:13px;font-weight:500;transition:background .2s}
        .gear{width:44px;height:44px;border-radius:22px;flex:none;display:grid;place-items:center;${TRS}color:var(--white,#fafafa);transition:transform .15s cubic-bezier(.34,1.5,.64,1)}
        .gear:active{transform:scale(.92)}
        /* lys-rader (felles rad, 12 px mellom) */
        .lbox{display:grid;grid-template-columns:repeat(var(--lt-cols,1),minmax(0,1fr));gap:var(--lt-gap,12px);padding:14px 12px 14px 16px;border-radius:28px;background:var(--gray200,#3a3a3a)}
        /* Utelys-kortet */
        .uc{display:flex;flex-direction:column;gap:14px;padding:18px;border-radius:28px;background:var(--gray200,#3a3a3a);box-shadow:inset 0 0 0 1px rgba(255,255,255,0.05);transition:background .4s}
        .uc.lit{background:linear-gradient(160deg, ${M.alpha(Y, 0.12)}, var(--gray200,#3a3a3a) 55%)}
        .uct{display:flex;align-items:flex-start;gap:14px}
        .chip{height:22px;padding:0 9px;border-radius:11px;display:inline-flex;align-items:center;font-size:12px;font-weight:600;background:rgba(255,255,255,0.08);color:var(--gray800,#afafaf);font-variant-numeric:tabular-nums}
        .chip.on{background:${M.alpha(Y, 0.18)};color:${Y}}
        .us{font-size:44px;font-weight:300;letter-spacing:-0.03em;line-height:1.1}
        .ob{width:68px;height:68px;border-radius:34px;flex:none;display:grid;place-items:center;background:var(--gray400,#545454);color:var(--gray900,#c7c7c7);transition:background .3s,box-shadow .3s,transform .15s}
        .ob.on{background:${Y};color:#282828;box-shadow:0 0 30px ${M.alpha(Y, 0.5)}}
        .ob:active{transform:scale(.94)}
        .ob:disabled{opacity:.5}
        .tlw{display:flex;flex-direction:column;gap:6px}
        .tl{position:relative;height:14px;border-radius:7px;background:var(--gray400,#545454);overflow:hidden}
        .nt{position:absolute;top:0;bottom:0;background:rgba(0,0,0,0.3)}
        .pl{position:absolute;top:0;bottom:0;border-radius:7px}
        .tlh{position:relative;height:14px;font-size:11px;line-height:14px;color:var(--gray600,#7f7f7f);font-variant-numeric:tabular-nums}
        .tlh>span{position:absolute;top:0;transform:translateX(-50%)}
        .tlh>.tln{left:0;transform:none}
        .ev{display:grid;grid-template-columns:1fr 1fr;gap:8px}
        .evt{display:flex;flex-direction:column;gap:4px;padding:12px 14px;border-radius:20px;background:var(--gray300,#404040);min-width:0}
        .evt.nx{background:${M.alpha(Y, 0.14)};box-shadow:inset 0 0 0 1.5px ${M.alpha(Y, 0.5)}}
        .evl{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:500;color:var(--gray800,#afafaf)}
        .evt.nx .evl{color:${Y}}
        .evv{font-size:24px;font-weight:400;letter-spacing:-0.01em;line-height:1.15}
        .evs{font-size:12px;color:var(--gray700,#979797);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        /* 22.10 · Utelys «Døgnring» */
        .ut{display:flex;flex-direction:column;gap:8px}
        .uc{border-radius:30px;padding:16px}
        .uc.lit{box-shadow:inset 0 0 0 1px ${M.alpha(Y, 0.35)}}
        .uct{align-items:center;gap:8px;min-width:0}
        .ust{color:var(--gray800,#afafaf);max-width:50%;text-align:right}
        .ucb{display:flex;align-items:center;gap:10px;min-width:0}
        .rw{position:relative;width:188px;height:188px;flex:none}
        .ring{display:block}
        .ring .rh{font-size:10px;fill:var(--gray600,#7f7f7f);text-anchor:middle;font-variant-numeric:tabular-nums}
        .ring .rm circle{fill:#3a3a3a;stroke:rgba(255,255,255,0.18);stroke-width:1}
        .ring .rm text{font-size:11px;fill:${Y};text-anchor:middle;font-weight:700}
        .rc{position:absolute;left:50%;top:50%;width:112px;height:112px;margin:-56px 0 0 -56px;border-radius:56px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;color:var(--gray800,#afafaf);transition:transform .15s,background .3s}
        .rc.on{color:${Y};background:${M.alpha(Y, 0.08)}}
        .rc:active{transform:scale(.94)}
        .rc:disabled{opacity:.5}
        .rcv{font-size:34px;font-weight:300;letter-spacing:-0.03em;line-height:1.05;color:var(--white,#fafafa)}
        .rcs{font-size:11px;color:var(--gray700,#979797);font-variant-numeric:tabular-nums;white-space:nowrap}
        .ucb .ev{flex:1;min-width:0;display:flex;flex-direction:column;gap:8px}
        .ucb .evv{font-size:22px}
        .afs{display:grid;grid-template-columns:1fr 1fr;gap:8px;transition:opacity .2s}
        .afs.dim0{opacity:.45}
        .af{display:flex;align-items:center;gap:10px;min-height:60px;padding:8px 12px;border-radius:20px;background:var(--gray300,#404040);min-width:0;transition:transform .15s}
        .af:active{transform:scale(.96)}
        .afi{width:36px;height:36px;border-radius:18px;flex:none;display:grid;place-items:center;background:var(--gray400,#545454);color:var(--gray900,#c7c7c7)}
        .af.on .afi{background:${Y};color:#282828}
        .lps{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
        .lp{position:relative;display:flex;align-items:center;gap:10px;height:64px;padding:0 12px 0 8px;border-radius:32px;background:var(--gray200,#3a3a3a);overflow:hidden;touch-action:pan-y;user-select:none;-webkit-user-select:none;cursor:pointer;min-width:0}
        .lpf{position:absolute;left:0;top:0;bottom:0;transition:width .3s ease,background-color .3s ease;pointer-events:none}
        .lp.drag .lpf{transition:none}
        .lpi{position:relative;width:48px;height:48px;border-radius:24px;flex:none;display:grid;place-items:center;background:var(--gray400,#545454);color:var(--gray900,#c7c7c7);transition:background .3s}
        .lpt{position:relative;min-width:0;gap:1px}
        .lpv{color:var(--gray800,#afafaf);font-variant-numeric:tabular-nums}
        .sol{display:flex;flex-direction:column;gap:10px;padding:16px 12px;border-radius:28px;background:var(--gray200,#3a3a3a)}
        .sr{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;touch-action:pan-x pan-y}
        .sr::-webkit-scrollbar{display:none}
        .stl{flex:none;min-width:96px;display:flex;flex-direction:column;gap:3px;padding:10px 12px;border-radius:18px;background:var(--gray300,#404040);color:var(--gray800,#afafaf)}
        .stl.nx{background:${M.alpha(Y, 0.14)};box-shadow:inset 0 0 0 1.5px ${M.alpha(Y, 0.5)};color:${Y}}
        .stn{white-space:nowrap}
        .ufb{padding:0 6px 10px}
        .ufb .msh-stp-row{padding-left:12px}
        ${M.STEPPER_CSS || ''}
        /* Styring / Sola */
        .st{display:flex;flex-direction:column;gap:12px;padding:16px;border-radius:28px;background:var(--gray200,#3a3a3a)}
        .seg{display:flex;gap:2px;padding:3px;border-radius:19px;background:#282828;user-select:none;-webkit-user-select:none}
        .seg button{height:32px;padding:0 12px;border-radius:16px;font-size:12px;font-weight:500;white-space:nowrap}
        .ar{display:flex;align-items:center;gap:12px;min-height:60px;width:100%}
        .sw{position:relative;width:52px;height:30px;border-radius:15px;flex:none;transition:background .2s}
        .sw span{position:absolute;top:4px;width:22px;height:22px;border-radius:11px;transition:left .2s}
        .fd{display:flex;flex-direction:column;border-radius:28px;background:var(--gray200,#3a3a3a);overflow:hidden}
        .fh{display:flex;align-items:center;gap:12px;height:58px;padding:0 18px;text-align:left;width:100%}
        .fb{display:flex;flex-direction:column;padding:0 18px 10px}
        .frr{display:flex;align-items:center;gap:10px;padding:9px 0}
        .fv{font-size:12px;font-weight:600;padding:6px 11px;border-radius:12px;background:var(--gray400,#545454)}
        /* etasje */
        .sc{display:flex;gap:12px;overflow-x:auto;padding:2px 4px}
        .scb{flex:none;display:flex;flex-direction:column;align-items:center;gap:6px;width:62px}
        .scbb{width:58px;height:58px;border-radius:29px;display:grid;place-items:center;background:var(--gray200,#3a3a3a);color:var(--gray800,#afafaf);transition:transform .15s cubic-bezier(.34,1.5,.64,1)}
        .scb:active .scbb{transform:scale(.9)}
        .scl{font-size:11px;font-weight:500;color:var(--gray600,#7f7f7f);max-width:62px}
        .rh{display:flex;align-items:center;gap:10px;padding:4px 6px 0}
        .all{height:30px;padding:0 12px;border-radius:15px;font-size:12px;font-weight:600;flex:none}
        /* Lys på */
        .sum{display:flex;align-items:center;gap:14px;padding:16px 18px;border-radius:28px;background:var(--gray200,#3a3a3a)}
        .big{font-size:34px;font-weight:300;letter-spacing:-0.03em;line-height:1}
        .offall{height:48px;padding:0 20px;border-radius:24px;background:#fafafa;color:#282828;font-size:14px;font-weight:600;display:flex;align-items:center;gap:6px}
        .onr{display:flex;align-items:center;gap:12px;height:60px;padding:0 16px 0 6px;border-radius:30px;background:var(--gray200,#3a3a3a);text-align:left;width:100%}
        .oni{width:48px;height:48px;border-radius:24px;flex:none;display:grid;place-items:center;background:${Y};color:#282828;transition:background-color .3s ease}
        .none{padding:30px;text-align:center;font-size:13px;color:var(--gray500,#696969)}
        .empty.in{background:transparent;padding:10px 0 0}
      `;
    }
  }

  /* ------------------------------------------------------------ «Tilpass lys»-arket */
  // Scener: union over alle etasjer (nøkler er felles: ki:<scene>, p:<nivå>, scene.*), sortert etter scene_order
  function sceneOpts(h, c, a) {
    const list = [];
    a.floors.forEach((F) => M.lysScenes(h, { ...c, scene_order: null }, F).forEach((s) => { if (!list.some((x) => x.key === s.key)) list.push(s); }));
    return byOrder(list, c.scene_order, (x) => x.key);
  }
  const PAGE_OF = { tabs: 'tabs', scenes: 'scenes', rooms: 'rooms', utelys: 'out', out: 'out', look: 'main', spacing: 'main' };
  const TITLES = { main: 'Tilpass lys', tabs: 'Faner', scenes: 'Scener', rooms: 'Rom og lys', out: 'Utelys' };
  const clone = (o) => JSON.parse(JSON.stringify(o || {}));
  // Sett/fjern en verdi på en punktum-sti i utkastet (tomme objekter ryddes bort)
  const setPath = (o, path, v) => {
    const ks = path.split('.'), last = ks.pop(), stack = [];
    let t = o;
    ks.forEach((k) => { if (!t[k] || typeof t[k] !== 'object' || Array.isArray(t[k])) t[k] = {}; stack.push([t, k]); t = t[k]; });
    if (v === undefined || v === null || v === '') delete t[last]; else t[last] = v;
    for (let i = stack.length - 1; i >= 0; i--) { const [p, k] = stack[i]; if (p[k] && typeof p[k] === 'object' && !Array.isArray(p[k]) && !Object.keys(p[k]).length) delete p[k]; }
  };
  const getPath = (o, path) => path.split('.').reduce((t, k) => (t && typeof t === 'object' ? t[k] : undefined), o);
  const toggleIn = (arr, k, on) => { const s = new Set(arr || []); if (on) s.add(k); else s.delete(k); return [...s]; };
  // Flytt eldre utelys-rotnøkler inn i outdoor (ved Ferdig)
  const migrateOutdoor = (d) => {
    const o = { ...((d.outdoor && typeof d.outdoor === 'object') ? d.outdoor : {}) };
    OUT_KEYS.forEach((k) => { if (k in d) { if (o[k] == null && d[k] != null && d[k] !== '') o[k] = d[k]; delete d[k]; } });
    // outdoor.include / outdoor.exclude → include.utelys / exclude (nøklene arket og GUI-editoren bruker)
    if (Array.isArray(o.include)) { if (o.include.length) d.include = { ...(d.include || {}), utelys: [...new Set([...(((d.include || {}).utelys) || []), ...o.include])] }; delete o.include; }
    if (Array.isArray(o.exclude)) { if (o.exclude.length) d.exclude = [...new Set([...(d.exclude || []), ...o.exclude])]; delete o.exclude; }
    if (Object.keys(o).length) d.outdoor = o; else delete d.outdoor;
    return d;
  };

  function openSheet(card, focus) {
    if (card._sheet && !card._sheet.ov.closed) return card._sheet;
    const orig = card._rawConfig || card.config;
    const st = { page: PAGE_OF[focus] || 'main', busy: false, adding: false, q: '' };
    let ov = null;
    // Felles utkast (MSH.draftEditor): st.draft er utkastet, «Last inn» bytter det ut
    const ctl = M.draftEditor(card, {
      config: migrateOutdoor(clone(orig)), saved: orig,
      prepare: (d) => migrateOutdoor(clone(d)),
      saveOpts: { scope: 'shared' },
      banner: () => ov && ov.body,
      alive: () => !ov || ov.host.isConnected,
      close: () => ov && ov.close(),
      onBusy: (b) => { st.busy = b; draw(); },
      onReload: () => draw(),
    });
    Object.defineProperty(st, 'draft', { get: () => ctl.draft, set: (v) => ctl.set(v) });
    const preview = () => ctl.preview();
    const upd = (fn, hap) => { fn(st.draft); preview(); if (hap) M.haptic(hap); draw(); };
    const hass = () => card.hass;

    // ---------- byggeklosser
    const nav = () => {
      const main = st.page === 'main';
      return `<div class="nav${main ? ' main' : ''}">${main ? '<button class="nb" data-a="cancel">Avbryt</button>' : `<button class="nb" data-a="page" data-p="main">${M.icon('mdi:chevron-left', 22)}Tilpass</button>`}
        <span class="nt">${esc(TITLES[st.page] || '')}</span>
        ${main ? `<button class="nd press" data-a="done" ${st.busy ? 'disabled' : ''}>${st.busy ? 'Lagrer …' : 'Ferdig'}</button>` : '<span></span>'}</div>`;
    };
    const seg = (label, key, opts, cur) => `<div class="r"><span class="rl">${esc(label)}</span><div class="seg">${opts.map(([v, l]) => `<button class="${String(v) === String(cur) ? 'on' : ''}" data-a="seg" data-k="${key}" data-v="${esc(v)}">${esc(l)}</button>`).join('')}</div></div>`;
    const navRow = (p, icon, col, label, val) => `<button class="r nr press" data-a="page" data-p="${p}"><span class="ic" style="background:${col}">${M.icon(icon, 18)}</span><span class="rl">${esc(label)}</span><span class="rv">${esc(val)}</span>${M.icon('mdi:chevron-right', 20, 'color:var(--gray600,#7f7f7f)')}</button>`;
    const eyeRow = (label, sub, act, key, hidden, extra) => `<div class="r${hidden ? ' off' : ''}${extra ? ' ' + extra : ''}"><span class="rl col"><span class="ell">${esc(label)}</span>${sub ? `<span class="rs ell">${esc(sub)}</span>` : ''}</span>
      <button class="eye" data-a="${act}" data-k="${esc(key)}" aria-label="${hidden ? 'Vis' : 'Skjul'} ${esc(label)}">${M.icon(hidden ? 'mdi:eye-off-outline' : 'mdi:eye-outline', 22)}</button></div>`;
    // Tider/tall i Utelys: stepper med systemets velger (09-pickers, lokal modus → 'change' med data-f/data-t)
    const stp = (label, path, kind, ph, o) => M.stepperHTML(hass(), null, { label, kind, key: 'stp-' + path, value: getPath(st.draft, path), placeholder: ph != null ? ph : '', attrs: `data-f="${esc(path)}" data-t="${kind}"`, ...(o || {}) });
    const sw = (label, sub, path, on) => `<button class="r" data-a="sw" data-k="${esc(path)}" data-v="${on ? 0 : 1}"><span class="rl col"><span>${esc(label)}</span>${sub ? `<span class="rs">${esc(sub)}</span>` : ''}</span><span class="sw${on ? ' on' : ''}"><span></span></span></button>`;

    // ---------- sider
    const pageMain = (A) => {
      const d = st.draft, tabs = tabDefs(A, d), hidT = new Set(d.hidden_tabs || []);
      const sc = sceneOpts(hass(), d, A), hidS = new Set(d.hidden_scenes || []);
      const rooms = A.floors.reduce((n, F) => n + F.rooms.length, 0), hidR = new Set(d.hidden_rooms || []);
      const roomsVis = A.floors.reduce((n, F) => n + F.rooms.filter((r) => !hidR.has(r.area || '_')).length, 0);
      const H = M.lightRowHeight(d), gap = gapOf(d);
      return `<div class="grp">
          ${seg('Mellomrom', 'gap', [[8, 'Tett'], [12, 'Standard'], [18, 'Luftig']], gap)}
          ${seg('Kolonner', 'columns', [[1, '1'], [2, '2']], Number(d.columns) === 2 ? 2 : 1)}
          ${seg('Størrelse', 'size', [['compact', 'Kompakt'], ['standard', 'Standard']], d.slider_height != null && d.slider_height !== '' && ![32, 40].includes(H) ? '' : sizeOf(d))}
          <div class="r"><span class="rl">Slider-høyde</span><input class="rg" type="range" min="32" max="56" step="2" value="${H}" data-f="slider_height" data-t="range"><span class="rv hv num">${H} px</span></div>
        </div>
        <span class="cap">Innhold</span>
        <div class="grp">
          ${navRow('tabs', 'mdi:tab', 'var(--pink,#f285c9)', 'Faner', `${tabs.filter(([k]) => !hidT.has(k)).length} av ${tabs.length}`)}
          ${navRow('scenes', 'mdi:palette', 'var(--purple,#ad99e6)', 'Scener', sc.length ? `${sc.filter((s) => !hidS.has(s.key)).length} av ${sc.length}` : 'Ingen')}
          ${navRow('rooms', 'mdi:lightbulb-group', 'var(--yellow,#f2d26f)', 'Rom og lys', `${roomsVis} av ${rooms} rom`)}
          ${navRow('out', 'mdi:outdoor-lamp', 'var(--orange,#f2b573)', 'Utelys', `${A.lamps.length} ${A.lamps.length === 1 ? 'lampe' : 'lamper'}`)}
        </div>
        <div class="grp" style="margin-top:16px"><button class="r rst" data-a="reset">Tilbakestill til standard</button></div>
        ${st.reset ? '<p class="note">Tilbakestilt i utkastet – trykk Ferdig for å lagre, Avbryt for å angre.</p>' : ''}`;
    };
    const pageTabs = (A) => {
      const d = st.draft, defs = tabDefs(A, d), hid = new Set(d.hidden_tabs || []);
      const keys = M.mshOrder(defs.map((x) => x[0]), d.tab_order, []);
      const name = Object.fromEntries(defs.map(([k, l]) => [k, l]));
      return `<div class="grp">${keys.map((k) => eyeRow(name[k], k === 'out' ? 'Utelys og tidslinje' : k === 'on' ? 'Alle lys som er på' : 'Etasje', 'tab', k, hid.has(k))).join('')}</div>
        <p class="note">Minst én fane må vises. Flytt faner med langt trykk i fane-raden og dra.</p>`;
    };
    const pageScenes = (A) => {
      const d = st.draft, sc = sceneOpts(hass(), d, A), hid = new Set(d.hidden_scenes || []);
      if (!sc.length) return '<div class="grp"><div class="r"><span class="rl rs">Fant ingen scener</span></div></div>';
      return `<div class="grp">${sc.map((s) => eyeRow(s.label, s.ki ? 'KI Rom' : s.level != null ? `Lysnivå ${s.level} %` : s.key, 'scene', s.key, hid.has(s.key))).join('')}</div>
        <p class="note">Scener er engangshandlinger og vises aldri som aktive.</p>`;
    };
    const pageRooms = (A) => {
      const d = st.draft, hidR = new Set(d.hidden_rooms || []), ex = new Set(d.exclude || []), h = hass();
      if (!A.floors.length) return '<div class="grp"><div class="r"><span class="rl rs">Fant ingen lys</span></div></div>';
      return A.floors.map((F) => `<span class="cap">${esc(F.name)}</span><div class="grp">${F.rooms.map((r) => {
        const rk = r.area || '_', rh = hidR.has(rk);
        return eyeRow(r.name, `${r.ids.length} av ${r.all.length} lys`, 'room', rk, rh) + (rh ? '' : r.all.map((id) => eyeRow(lcfg(d, id).name || cap(M.name(h, id, r.name)), id, 'light', id, ex.has(id), 'sub')).join(''));
      }).join('')}</div>`).join('');
    };
    const pageOut = (A) => {
      const d = st.draft, o = outCfg(d), h = hass(), sun = A.sun && h.states[A.sun], at = (sun && sun.attributes) || {};
      const sOn = hm(at.next_setting), sOff = hm(at.next_rising);
      // Entitet-feltene: felles søkevelger (msh-entity-picker, MSH.entitySearch) filtrert på riktig domene
      // 22.10: alle KI Utelys- og sol-entitetene (samme nøkler som GUI-editoren: overrides.<nøkkel>)
      const ents = [...UT_ENTS.map(([k, l, dom]) => ['overrides.' + k, l, A.UA[k], UT_DOMS[dom].join(',')]), ['overrides.lux', 'Lysnivåsensor', A.autoLux, 'sensor', 'illuminance'], ['overrides.modus', 'Modusvelger (eldre)', A.autoModus, 'input_select,select']];
      const oc = (d.outdoor && typeof d.outdoor === 'object') ? d.outdoor : {}, hidS = new Set(oc.hidden_sections || []);
      const secs = M.mshOrder(UT_SECS.map((x) => x[0]), oc.sections, []), secName = Object.fromEntries(UT_SECS);
      const pick = (o) => M.entityPicker.html(o);
      const lamps = sheetLamps(d, A, h);
      return `<span class="cap">Visning</span><div class="grp">
          ${seg('Døgnringen', 'outdoor.ring_start', [[0, '00 øverst'], [12, '12 øverst']], Number(oc.ring_start) === 12 ? 12 : 0)}
          ${secs.map((k, i) => `<div class="r${hidS.has(k) ? ' off' : ''}"><span class="rl">${esc(secName[k])}</span>${i ? `<button class="eye" data-a="usup" data-k="${k}" aria-label="Flytt opp ${esc(secName[k])}">${M.icon('mdi:arrow-up', 20)}</button>` : ''}<button class="eye" data-a="usec" data-k="${k}" aria-label="${hidS.has(k) ? 'Vis' : 'Skjul'} ${esc(secName[k])}">${M.icon(hidS.has(k) ? 'mdi:eye-off-outline' : 'mdi:eye-outline', 22)}</button></div>`).join('')}
        </div>
        <p class="note">Toppkortet med døgnringen vises alltid først. Pil = flytt opp, øye = skjul.</p>
        <span class="cap">Reserve uten KI Utelys</span><div class="grp">
          ${seg('Styring', 'outdoor.mode', [['auto', 'Auto'], ['tid', 'Tidsplan'], ['manuell', 'Manuelt']], o.mode)}
          ${stp('Tennes', 'outdoor.on', 'time', sOn != null ? fmt(sOn + Number(o.offset || 0)) : '')}
          ${stp('Slukkes', 'outdoor.off', 'time', sOff != null ? fmt(sOff) : '')}
          ${stp('Slukk senest', 'outdoor.latest', 'time')}
          ${stp('Morgen fra', 'outdoor.morning', 'time', DEF.morning)}
          ${stp('Forskyvning skumring', 'outdoor.offset', 'number', DEF.offset, { unit: 'min', step: 5, min: -180, max: 180, empty: 'Standard' })}
          ${stp('Tenn under', 'outdoor.lux_on', 'number', DEF.lux_on, { unit: 'lx', step: 5, min: 0, max: 1000, empty: 'Standard' })}
          ${stp('Slukk over', 'outdoor.lux_off', 'number', DEF.lux_off, { unit: 'lx', step: 5, min: 0, max: 1000, empty: 'Standard' })}
          ${sw('Kveld', 'Tenn i skumringen', 'outdoor.kveld', o.kveld !== false)}
          ${sw('Morgen', 'Tenn før det lysner', 'outdoor.morgen', o.morgen !== false)}
        </div>
        <p class="note">Tomt «Tennes» = solnedgang + forskyvning${sOn != null ? ` (i dag ${fmt(sOn + Number(o.offset || 0))})` : ''}. Tomt «Slukkes» = soloppgang${sOff != null ? ` (${fmt(sOff)})` : ''}.</p>
        <span class="cap">Entiteter</span><div class="grp">
          ${ents.map(([p, l, auto, doms, dc]) => `<div class="r fp"><span class="rl">${esc(l)}</span>${pick({ key: 'pk-' + p, value: getPath(d, p) || '', auto: auto || '', autoMode: true, domains: doms, deviceClass: dc || '', attrs: `data-f="${p}" data-t="entity"` })}</div>`).join('')}
        </div>
        <span class="cap">Lamper</span><div class="grp">
          ${lamps.map((l, i) => `<div class="lp" data-key="lp-${i}"><span class="lpi">${M.icon(l.icon || (h.states[l.id] && h.states[l.id].attributes.icon) || 'mdi:lightbulb', 20)}</span>
            <div class="lpf"><div class="lpr"><input autocapitalize="off" autocorrect="off" spellcheck="false" inputmode="text" class="in" data-lamp="${i}" data-lf="name" value="${esc(l.name || '')}" placeholder="${esc(l.id ? M.name(h, l.id) : 'Navn')}" aria-label="Navn"><input autocapitalize="off" autocorrect="off" spellcheck="false" inputmode="text" class="in" data-lamp="${i}" data-lf="icon" value="${esc(l.icon || '')}" placeholder="mdi:lightbulb" aria-label="Ikon"></div>
              ${pick({ key: 'pk-lp-' + i + '-' + l.id, value: l.id || '', domains: OUT_DOMS, placeholder: 'Velg lampe …', attrs: `data-lamp="${i}" data-lf="entity"` })}
              ${l.id && !h.states[l.id] ? '<span class="rs" style="color:var(--red,#f28073)">Finnes ikke</span>' : ''}</div>
            ${i ? `<button class="eye" data-a="lup" data-i="${i}" aria-label="Flytt opp ${esc(l.name || l.id)}">${M.icon('mdi:arrow-up', 18)}</button>` : ''}<button class="del" data-a="ldel" data-i="${i}" aria-label="Slett ${esc(l.name || l.id)}">${M.icon('mdi:trash-can-outline', 18)}</button></div>`).join('') || '<div class="r"><span class="rl rs">Ingen utelamper</span></div>'}
          ${st.adding ? `<div class="lp"><span class="lpi">${M.icon('mdi:lightbulb-outline', 20)}</span><div class="lpf">${pick({ key: 'pk-lp-new', mode: 'add', domains: OUT_DOMS, placeholder: 'Velg lampe …', attrs: 'data-new="1"' })}</div><button class="del" data-a="addx" aria-label="Avbryt">${M.icon('mdi:close', 18)}</button></div>` : ''}
        </div>
        ${findCard(A)}
        <button class="add press" data-a="add">${M.icon('mdi:plus', 20)}Legg til lampe</button>`;
    };
    // «Finner du ikke lampen?»: søk i light/switch/input_boolean (+ group/script), maks 8 treff, «Legg til» / «Lagt til»
    const hitsHTML = (A) => {
      const q = st.q.trim(), h = hass();
      if (!q || !h) return '';
      const have = new Set(sheetLamps(st.draft, A || M.lysAuto(h, st.draft)).map((l) => l.id));
      const hits = M.entitySearch(h, q, { domains: OUT_DOMS }).slice(0, 8);
      if (!hits.length) return `<div class="fnone">Ingen treff på «${esc(q)}»</div>`;
      return `<div class="fl">${hits.map((x) => {
        const s = h.states[x.id], on = have.has(x.id), an = x.area && h.areas && h.areas[x.area] ? h.areas[x.area].name : '';
        return `<div class="fh${on ? ' added' : ''}" data-key="fh-${esc(x.id)}"><span class="fhi">${M.icon((s && s.attributes.icon) || M.domainIcon(x.id, s), 18)}</span><span class="fhn"><b class="ell">${esc(x.name)}</b><i class="ell">${esc(x.id)}${an ? ' · ' + esc(an) : ''}</i></span>${on ? '<span class="fhp done">Lagt til</span>' : `<button class="fhp" data-a="qadd" data-k="${esc(x.id)}">Legg til</button>`}</div>`;
      }).join('')}</div>`;
    };
    const findCard = (A) => `<div class="fnd" data-key="fnd"><span class="fndt">Finner du ikke lampen?</span><span class="fnds">Søk fram et hvilket som helst lys, bryter eller hjelper og legg det til som utelampe.</span>
      <div class="fsr">${M.icon('mdi:magnify', 20)}<input class="fsq" data-q="1" value="${esc(st.q)}" placeholder="Søk navn eller entity_id" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="search" aria-label="Søk etter lampe"><button class="fsx" data-a="qx" aria-label="Tøm søket" ${st.q ? '' : 'hidden'}>${M.icon('mdi:close', 18)}</button></div>
      <div class="fhits" data-hits>${hitsHTML(A)}</div></div>`;
    const PAGES = { main: pageMain, tabs: pageTabs, scenes: pageScenes, rooms: pageRooms, out: pageOut };
    const draw = () => {
      if (!ov) return;
      const A = M.lysAuto(hass(), st.draft);
      const sh = ov.root.querySelector('.sh'), top = sh ? sh.scrollTop : 0;
      box.innerHTML = nav() + `<div class="pg">${(PAGES[st.page] || pageMain)(A)}</div>`;
      if (sh && st.keepScroll) sh.scrollTop = top;
      st.keepScroll = true;
    };
    const go = (p) => { st.page = p; st.keepScroll = false; st.adding = false; M.haptic('light'); draw(); const sh = ov.root.querySelector('.sh'); if (sh) sh.scrollTop = 0; };

    // ---------- lagring
    // Ferdig: én lagring (dobbelttrykk ignoreres mens den pågår); feil → arket står med utkastet
    const done = () => ctl.done();

    ov = M.overlay({ html: '', css: (M.STEPPER_CSS || '') + SHEET_CSS + FIND_CSS, maxWidth: 520, tilpass: true, onClose: () => { ctl.dispose(); card._sheet = null; } });
    const R = ov.root;
    if (M.bindSteppers) M.bindSteppers(R, card); // −/+ og native velgere i Utelys (lokal modus → 'change' under)
    // Arkets innhold i én fast beholder; _config = utkastet (samme config som GUI-editoren, sjekkes i test/checklist.mjs)
    const box = document.createElement('div');
    box.className = 'lys-sheet';
    Object.defineProperty(box, '_config', { get: () => st.draft });
    ov.body.appendChild(box);
    R.addEventListener('click', (e) => {
      const el = e.target.closest && e.target.closest('[data-a]');
      if (!el || el.disabled) return;
      const a = el.dataset.a, k = el.dataset.k;
      switch (a) {
        case 'cancel': M.haptic('light'); return ov.close();
        case 'done': return done();
        case 'page': return go(el.dataset.p);
        case 'seg': {
          let v = el.dataset.v;
          if (k === 'gap' || k === 'columns' || k === 'outdoor.ring_start') v = Number(v);
          return upd((d) => {
            if (k === 'size') { d.size = v; delete d.slider_height; delete d.tile_height; } else setPath(d, k, v);
          }, 'selection');
        }
        case 'sw': return upd((d) => setPath(d, k, el.dataset.v === '1'), 'selection');
        case 'tab': {
          const A = M.lysAuto(hass(), st.draft), all = tabDefs(A, st.draft).map((x) => x[0]), hid = new Set(st.draft.hidden_tabs || []);
          const hide = !hid.has(k);
          if (hide && all.filter((x) => !hid.has(x)).length <= 1) { M.haptic('failure'); M.toast('Minst én fane må vises'); return; }
          return upd((d) => { d.hidden_tabs = toggleIn(d.hidden_tabs, k, hide); if (!d.hidden_tabs.length) delete d.hidden_tabs; }, 'selection');
        }
        case 'scene': return upd((d) => { d.hidden_scenes = toggleIn(d.hidden_scenes, k, !(d.hidden_scenes || []).includes(k)); if (!d.hidden_scenes.length) delete d.hidden_scenes; }, 'selection');
        case 'room': return upd((d) => { d.hidden_rooms = toggleIn(d.hidden_rooms, k, !(d.hidden_rooms || []).includes(k)); if (!d.hidden_rooms.length) delete d.hidden_rooms; }, 'selection');
        case 'light': return upd((d) => { d.exclude = toggleIn(d.exclude, k, !(d.exclude || []).includes(k)); if (!d.exclude.length) delete d.exclude; }, 'selection');
        case 'usec': return upd((d) => { const o = { ...(d.outdoor || {}) }; o.hidden_sections = toggleIn(o.hidden_sections, k, !(o.hidden_sections || []).includes(k)); if (!o.hidden_sections.length) delete o.hidden_sections; d.outdoor = o; }, 'selection');
        case 'usup': return upd((d) => { const o = { ...(d.outdoor || {}) }, a = M.mshOrder(UT_SECS.map((x) => x[0]), o.sections, []), i = a.indexOf(k); if (i > 0) { a.splice(i, 1); a.splice(i - 1, 0, k); } o.sections = a; d.outdoor = o; }, 'selection');
        case 'lup': {
          const A = M.lysAuto(hass(), st.draft), i = Number(el.dataset.i);
          return upd((d) => {
            if (Array.isArray(d.lamps) && d.lamps.length) { const L = d.lamps.slice(); if (i > 0) L.splice(i - 1, 0, L.splice(i, 1)[0]); d.lamps = L; return; }
            const ids = A.lampsAll.slice(), vis = A.lamps.map((l) => l.id), id = vis[i], prev = vis[i - 1];
            if (!id || !prev) return;
            ids.splice(ids.indexOf(id), 1); ids.splice(ids.indexOf(prev), 0, id);
            d.order = { ...(d.order || {}), utelys: ids };
          }, 'selection');
        }
        case 'ldel': { const A = M.lysAuto(hass(), st.draft); return upd((d) => lampOp(d, A, 'del', Number(el.dataset.i)), 'medium'); }
        case 'add': st.adding = true; M.haptic('light'); draw(); { const i = R.querySelector('msh-entity-picker[data-new]'); if (i && i.open) i.open(); } return;
        case 'addx': st.adding = false; M.haptic('light'); return draw();
        case 'qx': { st.q = ''; M.haptic('light'); draw(); const i = R.querySelector('.fsq'); if (i) i.focus(); return; }
        case 'qadd': { const A = M.lysAuto(hass(), st.draft); return upd((d) => lampOp(d, A, 'add', -1, k), 'light'); }
        case 'reset': st.reset = true; return upd((d) => { Object.keys(d).forEach((x) => { if (x !== 'type' && x !== 'card_id') delete d[x]; }); }, 'warning');
        default: return undefined;
      }
    });
    // Slider-høyde: live mens man drar (uten ny tegning av arket), lagres i utkastet ved slipp
    R.addEventListener('input', (e) => {
      const i = e.target;
      if (!i || i.dataset.t !== 'range') return;
      const v = Number(i.value), lab = R.querySelector('.hv');
      if (lab) lab.textContent = `${v} px`;
      clearTimeout(st.rt); st.rt = setTimeout(() => { st.draft.slider_height = v; preview(); }, 40);
    });
    // Søkefeltet: debounce 150 ms, oppdaterer bare trefflisten (fokus og markør står)
    R.addEventListener('input', (e) => {
      const i = e.target;
      if (!i || !i.dataset || !i.dataset.q) return;
      st.q = i.value;
      const x = R.querySelector('.fsx'); if (x) x.hidden = !st.q;
      clearTimeout(st.qt); st.qt = setTimeout(() => { const b = R.querySelector('[data-hits]'); if (b) b.innerHTML = hitsHTML(); }, 150);
    });
    R.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target && e.target.dataset && e.target.dataset.q) { e.preventDefault(); const b = R.querySelector('.fh .fhp[data-a="qadd"]'); if (b) b.click(); } });
    // Trefflisten: vannrett/loddrett scroll skal ikke nå popupen under
    ['touchstart', 'touchmove', 'wheel'].forEach((t) => R.addEventListener(t, (e) => { if (e.composedPath().some((n) => n.classList && n.classList.contains('fhits'))) e.stopPropagation(); }, { passive: true }));
    // Entitetsvelgerne (msh-entity-picker): entitet-feltene, lampens entity_id og «Legg til lampe»
    R.addEventListener('value-changed', (e) => {
      const i = e.composedPath()[0];
      if (!i || !i.dataset || i.tagName !== 'MSH-ENTITY-PICKER') return;
      e.stopPropagation();
      const v = String((e.detail && e.detail.value) || '').trim(), A = M.lysAuto(hass(), st.draft);
      if (i.dataset.f) return upd((d) => setPath(d, i.dataset.f, v || undefined), 'light');
      if (i.dataset.lamp != null) { if (!v) return; return upd((d) => lampOp(d, A, 'entity', Number(i.dataset.lamp), v), 'light'); }
      if (i.dataset.new) { if (!v) return; st.adding = false; return upd((d) => lampOp(d, A, 'add', -1, v), 'success'); }
      return undefined;
    });
    R.addEventListener('change', (e) => {
      const i = e.target;
      if (!i || !i.dataset || i.dataset.q) return;
      const A = M.lysAuto(hass(), st.draft);
      if (i.dataset.t === 'range') return upd((d) => { d.slider_height = Number(i.value); }, 'selection');
      if (i.dataset.f) {
        const t = i.dataset.t, raw = String(i.value || '').trim();
        const v = raw === '' ? undefined : t === 'number' ? Number(raw) : raw;
        if (t === 'number' && raw !== '' && isNaN(v)) return;
        if (t === 'entity' && raw && !hass().states[raw]) { M.haptic('failure'); M.toast('Finner ikke ' + raw); return; }
        return upd((d) => setPath(d, i.dataset.f, v), 'light');
      }
      if (i.dataset.lamp != null) {
        const raw = String(i.value || '').trim();
        if (i.dataset.lf === 'entity' && raw && (!OUT_DOMS.includes(raw.split('.')[0]) || !hass().states[raw])) { M.haptic('failure'); M.toast('Velg et lys eller en bryter'); return; }
        return upd((d) => lampOp(d, A, i.dataset.lf, Number(i.dataset.lamp), raw), 'light');
      }
      if (i.dataset.new) {
        const raw = String(i.value || '').trim();
        if (!OUT_DOMS.includes(raw.split('.')[0]) || !hass().states[raw]) { M.haptic('failure'); M.toast('Velg et lys eller en bryter'); return; }
        st.adding = false;
        return upd((d) => lampOp(d, A, 'add', -1, raw), 'success');
      }
      return undefined;
    });
    card._sheet = { ov, st };
    draw();
    return card._sheet;
  }
  // Utelampene slik arket viser dem: eldre lamps-liste når den er satt, ellers auto + include.utelys − exclude
  function sheetLamps(d, A) {
    if (Array.isArray(d.lamps) && d.lamps.length) return d.lamps.map((l) => ({ id: (l && l.entity) || '', name: (l && l.name) || '', icon: (l && l.icon) || '' }));
    return A.lamps.map((l) => { const u = lcfg(d, l.id); return { id: l.id, name: u.name || '', icon: u.icon || '' }; });
  }
  // Endre utelampene i utkastet med de eksisterende nøklene (include.utelys, exclude, order.utelys, lights.<objekt-id>)
  function lampOp(d, A, op, i, v) {
    if (Array.isArray(d.lamps) && d.lamps.length) {
      const L = d.lamps.map((l) => ({ ...l }));
      if (op === 'del') L.splice(i, 1);
      else if (op === 'add') { if (!L.some((l) => l.entity === v)) L.push({ name: '', entity: v, icon: '' }); }
      else if (L[i]) { const k = op === 'entity' ? 'entity' : op; if (v) L[i][k] = v; else if (k !== 'entity') delete L[i][k]; }
      d.lamps = L.filter((l) => l.entity || op !== 'del');
      if (!d.lamps.length) delete d.lamps;
      return;
    }
    const cur = sheetLamps(d, A), l = cur[i], auto = A.outAuto || [];
    const inc = () => { d.include = d.include || {}; d.include.utelys = d.include.utelys || []; return d.include.utelys; };
    const tidy = () => {
      if (d.include && Array.isArray(d.include.utelys) && !d.include.utelys.length) delete d.include.utelys;
      if (d.include && !Object.keys(d.include).length) delete d.include;
      if (Array.isArray(d.exclude) && !d.exclude.length) delete d.exclude;
    };
    const addId = (id) => {
      d.exclude = (d.exclude || []).filter((x) => x !== id);
      if (!auto.includes(id) && !inc().includes(id)) inc().push(id);
    };
    const removeId = (id) => {
      const I = (d.include && d.include.utelys) || [];
      if (I.includes(id)) d.include.utelys = I.filter((x) => x !== id);
      if (auto.includes(id)) d.exclude = [...new Set([...(d.exclude || []), id])];
    };
    if (op === 'add') { addId(v); tidy(); return; }
    if (!l) return;
    if (op === 'del') { removeId(l.id); tidy(); return; }
    if (op === 'name' || op === 'icon') { setPath(d, `lights.${obj(l.id)}.${op}`, v || undefined); return; }
    if (op === 'entity' && v && v !== l.id) {
      removeId(l.id); addId(v);
      const L = d.lights || {}, old = L[obj(l.id)];
      if (old) { d.lights = { ...L, [obj(v)]: { ...(L[obj(v)] || {}), ...old } }; delete d.lights[obj(l.id)]; }
      if (d.order && Array.isArray(d.order.utelys)) d.order.utelys = d.order.utelys.map((x) => (x === l.id ? v : x));
      tidy();
    }
  }
  // Bunnark (Fiks 6): flaten kommer fra MSH.overlay (MSH.sheetStyle/sheetVars) – solid #282828 som standard, frosted glass
  // bare med Liquid Glass-temaet (byttes live). Grupper = --ki-sheet-grp (#3a3a3a / glassrad), segmentspor = --ki-sheet-seg,
  // aktivt segment = rosa (glassboble med temaet). Ingen hardkodet blur her.
  const SHEET_CSS = `
    .sh{--ki-sh-pt:8px;--ki-sh-px:16px}
    .nav{position:sticky;top:calc(var(--ki-grab-h, 0px) - var(--ki-sh-pt, 0px) - 1px);z-index:3;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px;min-height:52px;margin:0 -16px 6px;padding:4px 16px;background:var(--ki-sheet-bg,#282828);-webkit-backdrop-filter:var(--ki-sheet-blur,none);backdrop-filter:var(--ki-sheet-blur,none)}
    .nb{justify-self:start;display:inline-flex;align-items:center;height:36px;padding:0 4px;font-size:15px;font-weight:500;color:var(--gray900,#c7c7c7)}
    .nt{font-size:16px;font-weight:600;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .nd{justify-self:end;${M.DONE_PILL}} /* Fiks 26: lik Ferdig-pille i alle Tilpass-ark */ /* Fiks 26 (brukerens valg): hovedsiden får samme header som de andre Tilpass-arkene – tittel 22/600 til venstre, knappene til høyre */
    .nav.main{display:flex}
    .nav.main .nt{order:-1;flex:1;min-width:0;text-align:left;font-size:22px;letter-spacing:-0.01em}
    .nav.main .nb{flex:none;height:40px;padding:0 14px;border-radius:20px;background:var(--ki-sheet-grp,#3a3a3a);font-size:14px}
    .nd:disabled{opacity:.6}
    .pg{display:flex;flex-direction:column}
    .cap{display:block;font-size:12px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;color:var(--gray600,#7f7f7f);padding:16px 8px 8px}
    .grp{background:var(--ki-sheet-grp,#3a3a3a);box-shadow:var(--ki-sheet-grp-sh,none);border-radius:24px;overflow:hidden}
    .grp>*+*{border-top:1px solid rgba(255,255,255,0.06)}
    .r{display:flex;align-items:center;gap:12px;min-height:56px;padding:6px 10px 6px 16px;width:100%;text-align:left;box-sizing:border-box}
    .r.sub{min-height:48px;padding-left:34px}
    .r.sub .rl{font-size:14px}
    .r.off>:not(.eye){opacity:.45}
    .rl{flex:1;min-width:0;font-size:15px;font-weight:500;color:var(--white,#fafafa)}
    .rs{font-size:12px;font-weight:400;color:var(--ki-g-t2,var(--gray700,#979797))}
    .rv{font-size:13px;color:var(--ki-g-t2,var(--gray700,#979797));white-space:nowrap}
    .hv{width:48px;text-align:right}
    .nr{padding-right:12px}
    .ic{width:32px;height:32px;border-radius:16px;display:grid;place-items:center;flex:none;color:#282828}
    .seg{display:flex;gap:2px;padding:3px;border-radius:17px;background:var(--ki-sheet-seg,#282828);flex:none}
    .seg button{height:30px;padding:0 11px;border-radius:15px;font-size:12px;font-weight:500;color:var(--ki-g-t2,var(--gray800,#afafaf));white-space:nowrap;transition:background .2s}
    .seg button.on{background:${PINK};color:${INK}}
    :host(.glass) .seg button.on{${M.GLASS_BUBBLE}}
    .eye{width:44px;height:44px;border-radius:22px;display:grid;place-items:center;flex:none;color:var(--gray900,#c7c7c7)}
    .eye:active,.del:active{transform:scale(.92)}
    .rst{justify-content:center;color:var(--red,#f28073);font-size:15px;font-weight:500}
    .note{margin:0;padding:10px 10px 0;font-size:12px;line-height:1.45;color:var(--gray700,#979797)}
    .fr{cursor:text}
    .in{height:36px;border-radius:12px;padding:0 10px;background:var(--ki-g-in,#282828);color:#fafafa;font-size:14px;font-weight:500;color-scheme:dark;min-width:0;box-sizing:border-box}
    .fr .in{width:108px;flex:none;text-align:center}
    .fr .in.nm{width:84px}
    .fr .in.ent{width:46%;text-align:left}
    .rg{width:120px;accent-color:#f285c9}
    .sw{position:relative;width:52px;height:30px;border-radius:15px;flex:none;background:#4a4a4d;transition:background .2s}
    .sw span{position:absolute;top:4px;left:4px;width:22px;height:22px;border-radius:11px;background:#d8d6d1;transition:left .2s}
    .sw.on{background:${M.SWITCH_ON}} .sw.on span{left:26px;background:#2a2a2c} /* Fiks 26: rosa */
    .lp{display:flex;align-items:flex-start;gap:10px;padding:10px 10px 10px 14px}
    .lpi{width:36px;height:36px;border-radius:18px;display:grid;place-items:center;flex:none;background:var(--gray400,#545454);color:var(--gray1000,#e1e1e1)}
    .lpf{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px}
    .lpf .in{width:100%}
    .lpr{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(0,1fr);gap:6px}
    .del{width:36px;height:36px;border-radius:18px;flex:none;display:grid;place-items:center;background:${M.alpha(C.red, 0.2)};color:${C.red}}
    .add{margin-top:10px;height:48px;border-radius:24px;display:flex;align-items:center;justify-content:center;gap:6px;font-size:14px;font-weight:500;box-shadow:inset 0 0 0 1.5px rgba(255,255,255,0.18);width:100%}
  `;
  // Utelys: entitetsvelgere i raden + «Finner du ikke lampen?» (kort #3a3a3a r24, søkepille 44 #282828, treffliste #282828 r18)
  const FIND_CSS = `
    .r.fp{flex-direction:column;align-items:stretch;gap:6px;padding:10px 12px 12px 16px}
    .fnd{margin-top:10px;display:flex;flex-direction:column;gap:6px;padding:12px;border-radius:24px;background:var(--gray200,#3a3a3a)}
    .fndt{font-size:14px;font-weight:500;padding:2px 4px 0}
    .fnds{font-size:12px;line-height:1.4;color:var(--gray700,#979797);padding:0 4px 4px}
    .fsr{display:flex;align-items:center;gap:8px;height:44px;padding:0 6px 0 14px;border-radius:22px;background:#282828;color:var(--gray700,#979797)}
    .fsq{flex:1;min-width:0;height:44px;border:0;background:none;outline:none;color:#fafafa;font:inherit;font-size:14px;-webkit-user-select:text;user-select:text}
    .fsq::placeholder{color:var(--gray600,#7f7f7f)}
    .fsx{width:32px;height:32px;border-radius:16px;display:grid;place-items:center;flex:none;color:var(--gray800,#afafaf);background:rgba(255,255,255,0.08)}
    .fsx[hidden]{display:none}
    .fhits:empty{display:none}
    .fl{display:flex;flex-direction:column;gap:2px;padding:6px;border-radius:18px;background:#282828;max-height:336px;overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y}
    .fh{display:flex;align-items:center;gap:10px;min-height:50px;padding:4px 6px}
    .fh.added{opacity:.55}
    .fhi{width:34px;height:34px;border-radius:17px;display:grid;place-items:center;flex:none;background:var(--gray300,#404040);color:var(--gray1000,#e1e1e1)}
    .fhn{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
    .fhn b{font-size:14px;font-weight:500}
    .fhn i{font-style:normal;font-size:11px;color:var(--gray600,#7f7f7f)}
    .fhp{flex:none;height:30px;padding:0 12px;border-radius:15px;display:inline-flex;align-items:center;font-size:12px;font-weight:600;background:rgb(242 210 111 / 0.18);color:var(--yellow,#f2d26f)}
    .fhp:active{transform:scale(.95)}
    .fhp.done{background:rgba(255,255,255,0.08);color:var(--gray800,#afafaf);pointer-events:none}
    .fnone{padding:12px 8px;font-size:13px;color:var(--gray700,#979797);border-radius:18px;background:#282828}
    .ell{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  `;
  // Eldre config.lamps [{name, entity, icon}] → include.utelys + order.utelys + lights.<objekt-id>.{name, icon};
  // auto-lamper som ikke var med, skjules (exclude). Etterpå brukes entitetsvelgeren i «Tilpass lys».
  function convertLamps(c, a, ed) {
    const ids = [], L = { ...(c.lights || {}) };
    (c.lamps || []).forEach((l) => {
      if (!l || !l.entity || ids.includes(l.entity)) return;
      ids.push(l.entity);
      const k = obj(l.entity), o = { ...(L[k] || {}) };
      if (l.name) o.name = l.name;
      if (l.icon) o.icon = l.icon;
      if (Object.keys(o).length) L[k] = o;
    });
    const auto = (a.outAuto || []), ex = [...new Set([...(c.exclude || []).filter((id) => !ids.includes(id)), ...auto.filter((id) => !ids.includes(id))])];
    const next = { ...c, include: { ...(c.include || {}), utelys: ids.filter((id) => !auto.includes(id)) }, order: { ...(c.order || {}), utelys: ids } };
    if (Object.keys(L).length) next.lights = L;
    if (ex.length) next.exclude = ex; else delete next.exclude;
    ed._config = next;
    ed._set('lamps', undefined);
  }
  function fmtSun(h, c, which) {
    const A = M.lysAuto(h, c || {}), s = A.sun && h.states[A.sun], at = (s && s.attributes) || {};
    const m = which === 'on' ? hm(at.next_setting) : hm(at.next_rising);
    return m == null ? null : fmt(which === 'on' ? m + Number(outCfg(c).offset) : m);
  }
  M.define('msh-lys-card', Lys, 'MSH Lys', 'Utelys med tidslinje og styring, lys per etasje og rom med felles lys-rad, og oversikt over lys som er på.');
})();
