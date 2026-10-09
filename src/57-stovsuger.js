/* KI MSH · Sir Sweeps (#rolf, msh-stovsuger-card) – fiks 24.9, etter «Sir Sweeps v3» (prompt-teksten; designfilen finnes ikke).
 * Étt kort i Bubble-popupen #rolf (mal A). Bubble eier headeren (navn, ikon, lukk) og beholder sub_button med
 * støvsugerens state + batteri (M.POPUP_LOOK/M.POPUP_FORCE['#rolf'] under). Erstatter den importerte #rolf-popupen
 * (ki-robot-card + button-card-grid + ki-tabs-card + paper-buttons-row): «Erstattet av Sir Sweeps» (MSH.POPUP_SUPERSEDE).
 *
 * Innhold i rekkefølge (fiks 26.11): toppkort 200 px (navn 15 px, status-chip med ikon, batteri 44 px + «batteri» +
 *   tynn grønn stolpe; kartflis til høyre med tregulv, lilla sone og animert robot – rute ved rengjøring, hjem ved retur,
 *   lyn i dokken ved lading) · varsel «Vanntanken er tom» (rød, bare når tank = on, med «Tøm») ·
 *   faner (Renhold · Kontroll · Info · Kart, tekst og like brede i full bredde som standard, Liquid Glass-drag) + tannhjul ·
 *   Renhold: ETT romkort (etasje + «Velg alle», fargetonede fliser 2 + 3 (1fr 2fr 1fr), «Alle rom · m² · ca min» – tall
 *     bare når areal/tid finnes) → grønn «Støvsug alt / Støvsug N rom»-pill, pause/fortsett + hjem når aktiv · Soner
 *     (vannrette piller 52 px, touch-action pan-x + stopPropagation).
 *   47 H/L1: «Støvsug alt»-pillen 1:1 (mørk grønn sirkel rgba(16,36,26,.86), egen ring + prikk i pillefargen, 16/600 +
 *     «m² · ca min»), også under kjøring (pause/hjem inni). 47 L3: «Soner» rett under (autofunn, Tilpass → Entiteter).
 *   Kontroll (47 I/L2): ÉTT kontrollkort (tittel + 40 px tall, play/pause 64, stripe 10, «Returner hjem»/«Tøm støvsuger»
 *     52 px) + fliser for vifte (stor) og moppmodus/-intensitet (piller): trykk = neste valg, hold 500 ms = more-info.
 *   Info (47 J): prosa «<navn> har vasket [m²] … [fotballbaner] … [X dager og Y timer] …» · vedlikehold (timer igjen per del,
 *     oransje + «Nullstill» ≤ 30 t → button.*_nullstill_* / *_reset_*).
 *   Kart: image.*-entiteten (3:4) med pan/pinch/dobbelttrykk/hjul-zoom 1–4× (Pointer Events, fiks 26.12) + «Tilbakestill
 *     visning», rom-lag fra kartets attributter (trykk uten drag velger) + romforklaring.
 * «Tilpass» (msh-editor, samme skjema som GUI-editoren, MSH.draftEditor/Ferdig): Rom · Faner · Entiteter · Avansert.
 *
 * Standard-entitetene (DEF_ENT/DEF_ROOMS) er brukerens faktiske oppsett fra dagens #rolf-YAML – brukt i
 * getStubConfig og i autokonfig når de finnes i HA (samme unntak som 17.9). Ellers autofunn via støvsugerens prefiks
 * (vacuum.<obj> → sensor.<obj>_battery …), rom fra input_boolean.<obj>_* eller robotens segmenter (attributtet rooms),
 * soner fra script.*_zone_* (47 L3: også *_sone_* og robotens navneprefiks), moppvalg fra select.* på robotens enhet
 * (47 L2). Alt kan overstyres i «Entiteter»; mangler noe vises «–» + «Velg entitet». Ingen mock-data.
 *
 * Config:
 *   name · floor (etasje) · entities: { vacuum, battery, charging, tank, map, progress, all, start, pause, resume, home,
 *     empty, fan_script, mop, mop_intensity, area, time, main_brush, side_brush, filter, sensor, reset_<del> }
 *   rooms: { <nøkkel>: { name, color, hidden, m2, icon, entity?, segment?, manual? } } · room_order: [nøkkel …]
 *   zones: { <script-objekt-id>: { name, hidden } } · zone_order: [nøkkel …]
 *   tab_order · tab_hidden · startTab · tab_labels (icon|name) · section_hidden: { <fane>: [del …] }
 *   confirm_start · auto_empty · gap · pad_top · pad_bottom
 */
(function () {
  const M = window.MSH;
  if (!M || customElements.get('msh-stovsuger-card')) return;
  const esc = M.esc, C = M.C;
  const HASH = '#rolf', TAG = 'msh-stovsuger-card';
  const TABS = [['renhold', 'Renhold', 'mdi:broom'], ['kontroll', 'Kontroll', 'mdi:tune-vertical'], ['info', 'Info', 'mdi:information-outline'], ['kart', 'Kart', 'mdi:map-outline']];
  const TV = (k, n) => (M.tabH ? M.tabH.v(k, n) : n + 'px'); // 33.4: fanehøyde-variabler (05-tab-bar.js)
  const TABL = Object.fromEntries(TABS.map((t) => [t[0], t]));
  const PARTS = {
    renhold: [['rom', 'Romgrid'], ['start', 'Start-knapp'], ['soner', 'Soner']],
    kontroll: [['fremdrift', 'Fremdrift'], ['knapper', 'Knapper'], ['vifte', 'Vifte'], ['mopp', 'Moppmodus'], ['intensitet', 'Moppintensitet']],
    info: [['totalt', 'Vasket totalt (tekst)'], ['vedlikehold', 'Vedlikehold']],
    kart: [['kart', 'Kart'], ['forklaring', 'Romforklaring']],
  };
  const PAL = [C.blue, C.green, C.orange, C.purple, C.yellow, C.pink, C.red, C.lime, C.lightBlue];
  const FOTBALL = 7140; // m² per fotballbane
  const LOW_H = 30; // vedlikehold: oransje + «Nullstill» ≤ 30 t
  // 47 H/L1/I: designets faste farger på aksentflater (mørk tekst på grønn/oransje/lys pille, mørk grønn ikon-sirkel)
  const ON_ACC = '#282828'; // ki-hex-ok: tekst/ikon på aksentflate (alltid mørk)
  const SW_CELL = 'rgba(16,36,26,0.86)'; // ki-hex-ok: ikon-sirkelen i «Støvsug alt» (fasit L1)
  const LIGHT_PILL = '#e1e1e1'; // ki-hex-ok: «Tøm støvsuger»-pillen (lys flate med mørk tekst i begge moduser)
  const GREEN = 'var(--green, #66d19e)', ORANGE = 'var(--orange, #f2b573)', RED = 'var(--red, #f28073)';

  // Brukerens oppsett (dagens #rolf-YAML) – standard i getStubConfig og i autokonfig når de finnes (unntak som 17.9)
  const DEF_ENT = {
    vacuum: 'vacuum.sir_sweeps_a_lot', battery: 'sensor.sir_sweeps_a_lot_battery', charging: 'binary_sensor.sir_sweeps_a_lot_charging',
    tank: 'binary_sensor.sir_sweeps_a_lot_water_shortage', map: 'image.sir_sweeps_a_lot_hjemme_andre_etasje',
    all: 'sensor.rolf_all', start: 'script.start_sir_sweeps_a_lot_room_select', pause: 'script.stovsuger_pause', resume: 'script.stovsuger_start',
    home: 'script.stovsuger_retuner_hjem', empty: 'script.rolf_empty', fan_script: 'script.cycle_vacuum_fan_speed', // 47 L2: mop/mop_intensity autofinnes (select.* på robotens enhet)
    area: 'sensor.sir_sweeps_a_lot_total_cleaning_area', time: 'sensor.sir_sweeps_a_lot_total_cleaning_time',
    main_brush: 'sensor.sir_sweeps_a_lot_main_brush_time_left', side_brush: 'sensor.sir_sweeps_a_lot_side_brush_time_left',
    filter: 'sensor.sir_sweeps_a_lot_filter_time_left', sensor: 'sensor.sir_sweeps_a_lot_sensor_time_left',
  };
  const DEF_ROOMS = [['sebsatian_soverom', 'Soverom', 'mdi:bed-double-outline'], ['pappa_soverom', 'Pappa', 'mdi:bed-outline'], ['mamma_soverom', 'Mamma', 'mdi:bed-queen-outline'], ['pappa_kontor', 'Kontor', 'mdi:desk'], ['trappegang', 'Trapp', 'mdi:stairs']];
  const PARTS_V = [['main_brush', 'Hovedbørste', 'mdi:brush', /main_brush|hovedb/], ['side_brush', 'Sidebørste', 'mdi:broom', /side_brush|sideb/], ['filter', 'Filter', 'mdi:air-filter', /filter/], ['sensor', 'Sensorer', 'mdi:eye-outline', /sensor/]];
  // Entitetsfelt i «Entiteter»: [nøkkel, etikett, domener, gruppe, prefiks-autofunn (obj → id-kandidater)]
  const ENT = [
    ['vacuum', 'Støvsuger', ['vacuum'], 'Robot og status', null],
    ['battery', 'Batteri', ['sensor'], 'Robot og status', (o) => [`sensor.${o}_battery`]],
    ['charging', 'Lader', ['binary_sensor'], 'Robot og status', (o) => [`binary_sensor.${o}_charging`]],
    ['tank', 'Vanntank tom (varsel)', ['binary_sensor'], 'Robot og status', (o) => [`binary_sensor.${o}_water_shortage`, `binary_sensor.${o}_water_box_attached`]],
    ['progress', 'Fremdrift (%)', ['sensor'], 'Robot og status', (o) => [`sensor.${o}_cleaning_progress`, `sensor.${o}_progress`]],
    ['map', 'Kart (bilde)', ['image', 'camera'], 'Robot og status', (o, h) => Object.keys(h.states).filter((id) => id.startsWith(`image.${o}_`)).sort()],
    ['all', 'Alle rom valgt (sensor)', ['sensor', 'binary_sensor', 'input_boolean'], 'Rengjøring', null],
    ['start', 'Start valgte rom', ['script'], 'Rengjøring', null],
    ['pause', 'Pause', ['script'], 'Rengjøring', null],
    ['resume', 'Fortsett', ['script'], 'Rengjøring', null],
    ['home', 'Returner hjem', ['script'], 'Rengjøring', null],
    ['empty', 'Tøm støvsuger', ['script', 'button'], 'Rengjøring', (o) => [`button.${o}_empty`, `button.${o}_start_empty`]],
    ['fan_script', 'Vifte (bytt-skript)', ['script'], 'Vifte og mopp', null],
    ['mop', 'Mopp modus', ['select', 'input_select'], 'Vifte og mopp', (o, h, v) => mopSel(h, v, 'mode').concat([`select.${o}_mop_mode`])],
    ['mop_intensity', 'Mopp intensitet', ['select', 'input_select'], 'Vifte og mopp', (o, h, v) => mopSel(h, v, 'int').concat([`select.${o}_mop_intensity`, `select.${o}_water_box_mode`])],
    ['area', 'Vasket totalt (m²)', ['sensor'], 'Info og vedlikehold', (o) => [`sensor.${o}_total_cleaning_area`]],
    ['time', 'Tid brukt totalt', ['sensor'], 'Info og vedlikehold', (o) => [`sensor.${o}_total_cleaning_time`]],
    ...PARTS_V.map(([k, l]) => [k, l + ' (timer igjen)', ['sensor'], 'Info og vedlikehold', (o) => [`sensor.${o}_${k}_time_left`]]),
    ...PARTS_V.map(([k, l, , rx]) => ['reset_' + k, 'Nullstill ' + l.toLowerCase(), ['button'], 'Info og vedlikehold', (o, h) => resetAuto(h, o, rx)]),
  ];
  const ENTK = Object.fromEntries(ENT.map((e) => [e[0], e]));
  // 47 L2: moppmodus/-intensitet = select.* på SAMME enhet (device_id) som støvsugeren (eller med robotens prefiks),
  // navn med «mop»/«mopp»/«water»/«vann». Modus: «mode/modus»; intensitet: «intens/water/vann/flow/scrub».
  const MOPRX = /mop|mopp|water|vann|scrub/, INTRX = /intens|water|vann|flow|scrub|humid/, MODERX = /mode|modus|route|rute/;
  function mopSel(h, vac, kind) {
    if (!h || !vac) return [];
    const E = h.entities || {}, dev = E[vac] && E[vac].device_id, o = objOf(vac);
    const txt = (id) => (id + ' ' + ((h.states[id] && h.states[id].attributes.friendly_name) || '') + ' ' + ((E[id] && (E[id].original_name || E[id].name)) || '')).toLowerCase();
    const pool = Object.keys(h.states).filter((id) => /^(select|input_select)\./.test(id) && ((dev && E[id] && E[id].device_id === dev) || (o && id.startsWith('select.' + o + '_'))) && MOPRX.test(txt(id)));
    if (kind === 'int') return pool.filter((id) => INTRX.test(txt(id)) && !/mop_mode|moppmodus|mopp modus|mop mode/.test(txt(id)));
    return pool.filter((id) => MODERX.test(txt(id)) && !/intens/.test(txt(id))).concat(pool.filter((id) => !INTRX.test(txt(id))));
  }
  function resetAuto(h, o, rx) {
    const B = Object.keys(h.states).filter((id) => id.startsWith('button.') && /nullstill|reset/.test(id) && rx.test(id));
    return B.filter((id) => o && id.includes(o)).concat(B.filter((id) => !o || !id.includes(o)));
  }

  /* ------------------------------------------------------------ oppsett: entiteter, rom, soner, faner */
  const has = (h, id) => !!(h && id && h.states[id]);
  const vacOf = (h, c) => { const o = (c.entities || {}).vacuum; if (o) return o; if (has(h, DEF_ENT.vacuum)) return DEF_ENT.vacuum; return (h ? M.all(h, 'vacuum')[0] : null) || null; };
  const objOf = (id) => (id ? String(id).split('.')[1] || '' : '');
  // Automatisk verdi for et felt: brukerens standard når den finnes i HA, ellers prefiks-autofunn fra støvsugeren
  function autoEnt(h, c, k) {
    if (!h) return null;
    if (k === 'vacuum') return has(h, DEF_ENT.vacuum) ? DEF_ENT.vacuum : M.all(h, 'vacuum')[0] || null;
    const vac = vacOf(h, c);
    if (vac === DEF_ENT.vacuum && has(h, DEF_ENT[k])) return DEF_ENT[k]; // brukerens oppsett gjelder bare for brukerens støvsuger
    const f = ENTK[k] && ENTK[k][4], o = objOf(vac);
    if (!f || !o) return null;
    return (f(o, h, vac) || []).find((id) => has(h, id)) || null;
  }
  function entsOf(h, c) {
    const o = c.entities || {}, R = {};
    ENT.forEach(([k]) => { const v = o[k]; R[k] = v === 'none' ? null : v || autoEnt(h, c, k); });
    return R;
  }
  const num = (v) => (v == null || v === '' || isNaN(Number(v)) ? null : Number(v));
  // Robotens egne segmenter: attributtet rooms/segments ({kart: [{id,name}]}, [{id,name}] eller {id: navn})
  function segsOf(st) {
    const a = (st && st.attributes) || {}, out = [];
    const push = (id, name, x) => { if (id == null || id === '') return; if (!out.some((o) => String(o.id) === String(id))) out.push({ id, name: String(name || 'Rom ' + id), attrs: x && typeof x === 'object' ? x : null }); };
    const walk = (v) => {
      if (Array.isArray(v)) v.forEach((x) => { if (x && typeof x === 'object') push(x.id != null ? x.id : x.segment_id, x.name || x.room_name, x); });
      else if (v && typeof v === 'object') Object.keys(v).forEach((k) => { const x = v[k]; if (Array.isArray(x)) walk(x); else if (typeof x === 'string') push(k, x); else if (x && typeof x === 'object' && (x.name || x.id != null)) push(x.id != null ? x.id : k, x.name, x); });
    };
    walk(a.rooms || a.segments || null);
    return out;
  }
  const stripName = (h, id, vac) => { let n = M.name(h, id); const vn = vac ? M.name(h, vac) : ''; if (vn && n.toLowerCase().startsWith(vn.toLowerCase())) n = n.slice(vn.length).trim(); return n ? n[0].toUpperCase() + n.slice(1) : id; };
  const orderBy = (list, order) => { const o = Array.isArray(order) ? order : []; const r = (x, i) => { const j = o.indexOf(x.key); return j < 0 ? 1000 + i : j; }; return list.map((x, i) => [x, r(x, i)]).sort((a, b) => a[1] - b[1]).map((x) => x[0]); };
  // Alle rom (også skjulte), sortert etter room_order
  function roomsOf(h, c, vac) {
    const cfg = c.rooms || {}, out = new Map(), o = objOf(vac);
    if (h && o) {
      const pre = 'input_boolean.' + o + '_', D = DEF_ROOMS.map((r) => r[0]);
      const ib = Object.keys(h.states).filter((id) => id.startsWith(pre));
      const di = (id) => { const i = D.indexOf(id.slice(pre.length)); return i < 0 ? 99 : i; };
      ib.sort((a, b) => di(a) - di(b) || a.localeCompare(b)).forEach((id) => {
        const k = id.slice(pre.length), d = DEF_ROOMS.find((r) => r[0] === k);
        out.set(k, { key: k, entity: id, name: d ? d[1] : stripName(h, id, vac), icon: d ? d[2] : 'mdi:floor-plan' });
      });
      segsOf(h.states[vac]).forEach((s) => { const k = 'seg_' + M.slug(String(s.id)); if (!out.has(k)) out.set(k, { key: k, segment: s.id, name: s.name, icon: 'mdi:floor-plan', attrs: s.attrs }); });
    }
    Object.keys(cfg).forEach((k) => { const r = cfg[k]; if (!r || typeof r !== 'object' || out.has(k) || !(r.manual || r.entity || r.segment != null)) return; out.set(k, { key: k, entity: r.entity || null, segment: r.segment != null && r.segment !== '' ? r.segment : null, name: r.name || k, icon: 'mdi:floor-plan', manual: true }); });
    let i = 0;
    // Fiks 26.11: areal og tid fra rom-attributtene (rom-entiteten eller robotens segment); config.m2 overstyrer arealet
    const L = [...out.values()].map((r) => {
      const x = cfg[r.key] || {}; const col = x.color || PAL[i % PAL.length]; i++;
      const at = (r.entity && h && h.states[r.entity] ? h.states[r.entity].attributes : r.attrs) || {};
      const pickA = (keys) => { for (const k of keys) { const v = num(at[k]); if (v != null && v > 0) return v; } return null; };
      return { ...r, name: x.name || r.name, icon: x.icon || r.icon, color: col, hidden: !!x.hidden, m2: num(x.m2) || pickA(['m2', 'area', 'areal', 'size']), min: pickA(['minutes', 'time', 'duration', 'tid', 'estimated_time']) };
    });
    return orderBy(L, c.room_order);
  }
  // 47 L3: sone-skript autofinnes: script.*_zone_* / *_sone_* (zone/zones/sone/soner som eget ord i ID-en), og skript
  // med robotens/kortets navneprefiks (script.<prefiks>_…) der friendly_name nevner sone. Navn = friendly_name (uten
  // prefiksordet, f.eks. «Rolf Spisebord lite» → «Spisebord lite»). Overstyres i Tilpass → Entiteter → «Soner (skript)».
  const ZTOK = /(^|_)(zone|zones|sone|soner)(_|$)/;
  function zonePrefixes(h, c, vac) {
    const P = new Set([objOf(vac), vac && h && h.states[vac] ? M.slug(M.name(h, vac)) : '', c && c.name ? M.slug(c.name) : '']);
    return [...P].filter(Boolean);
  }
  function zoneName(h, id, names) {
    const o = id.slice(7), st = h && h.states[id], fn = String((st && st.attributes.friendly_name) || '').trim();
    const mt = /^(.*?)_?(?:zone|zones|sone|soner)(?:_|$)/.exec(o), pre = mt && mt[1] ? mt[1].split('_').filter(Boolean) : [];
    let n = fn || o.replace(/_/g, ' ');
    // robotens/kortets navn foran («Sir Sweeps a lot sone hjørne» → «Hjørne»)
    (names || []).filter(Boolean).sort((a, b) => b.length - a.length).some((x) => { if (n.toLowerCase().startsWith(x.toLowerCase() + ' ')) { n = n.slice(x.length).trim(); return true; } return false; });
    const w = n.split(/\s+/);
    while (w.length > 1 && pre.length && M.slug(w[0]) === pre[0]) { w.shift(); pre.shift(); }
    while (w.length > 1 && /^(zone|zones|sone|soner)$/i.test(w[0])) w.shift();
    n = w.join(' ').replace(/^[-–·:\s]+/, '');
    return n ? n[0].toUpperCase() + n.slice(1) : o;
  }
  function zoneAuto(h, c, vac) {
    if (!h) return [];
    const P = zonePrefixes(h, c, vac), pre = (o) => P.some((p) => o.startsWith(p + '_'));
    const ids = Object.keys(h.states).filter((id) => {
      if (!id.startsWith('script.')) return false;
      const o = id.slice(7);
      if (ZTOK.test(o)) return true;
      return pre(o) && /\b(zone|zones|sone|soner)\b/i.test(String(h.states[id].attributes.friendly_name || ''));
    });
    return ids.map((id, i) => [id, pre(id.slice(7)) ? 0 : 1, i]).sort((a, b) => a[1] - b[1] || a[2] - b[2]).map((x) => x[0]);
  }
  function zonesOf(h, c) {
    const cfg = c.zones || {}, out = new Map(), vac = vacOf(h, c), nm = [vac && h && h.states[vac] ? M.name(h, vac) : '', c.name || ''];
    zoneAuto(h, c, vac).forEach((id) => { const k = id.slice(7); out.set(k, { key: k, entity: id, name: zoneName(h, id, nm) }); });
    Object.keys(cfg).forEach((k) => { const z = cfg[k]; if (z && z.entity && !out.has(k)) out.set(k, { key: k, entity: z.entity, name: z.name || (h && h.states[z.entity] ? zoneName(h, z.entity, nm) : k), manual: true }); });
    return orderBy([...out.values()].map((z) => { const x = cfg[z.key] || {}; return { ...z, name: x.name || z.name, hidden: !!x.hidden, icon: x.icon || zoneIcon(x.name || z.name) }; }), c.zone_order);
  }
  // Designets ikoner: table_restaurant (standard) · texture (teppe) · countertops (kjøkkenbenk)
  const zoneIcon = (n) => (/teppe|rug|carpet/i.test(n) ? 'mdi:texture' : /kjøkken|kjokken|kitchen|benk|counter/i.test(n) ? 'mdi:countertop-outline' : 'mdi:table-furniture');
  const tabOrder = (c) => { const k = TABS.map((t) => t[0]); const o = (Array.isArray(c.tab_order) ? c.tab_order : []).filter((x) => k.includes(x)); k.forEach((x) => { if (!o.includes(x)) o.push(x); }); return o; };
  const tabHidden = (c) => new Set(Array.isArray(c.tab_hidden) ? c.tab_hidden : []);
  const LEG_ST = (c) => c.startTab; // 36.5: gammel nøkkel for startfanen
  const visTabs = (c) => { const hid = tabHidden(c); const o = tabOrder(c).filter((k) => !hid.has(k)); return o.length ? o : ['renhold']; };
  const partHidden = (c, t) => new Set(((c.section_hidden || {})[t]) || []);

  /* ------------------------------------------------------------ tolkning av verdier */
  const hoursOf = (st) => { if (!st || M.unavailable(st)) return null; const v = Number(st.state); if (isNaN(v)) return null; const u = String(st.attributes.unit_of_measurement || 'h').toLowerCase(); return u === 's' ? v / 3600 : u === 'min' ? v / 60 : u === 'd' ? v * 24 : v; };
  // «HH:MM» / «H:MM:SS» / tall med enhet → minutter
  function minutesOf(st) {
    if (!st || M.unavailable(st)) return null;
    const s = String(st.state).trim(), m = /^(\d+):(\d{1,2})(?::(\d{1,2}))?$/.exec(s);
    if (m) return Number(m[1]) * 60 + Number(m[2]) + (m[3] ? Number(m[3]) / 60 : 0);
    const v = Number(s); if (isNaN(v)) return null;
    const u = String(st.attributes.unit_of_measurement || 'min').toLowerCase();
    return u === 's' ? v / 60 : u === 'h' ? v * 60 : u === 'd' ? v * 1440 : v;
  }
  const dagerTimer = (min) => { if (min == null) return '–'; const t = Math.floor(min / 60), d = Math.floor(t / 24), r = t % 24; return d ? `${d} ${d === 1 ? 'dag' : 'dager'} ${r} ${r === 1 ? 'time' : 'timer'}` : `${t} ${t === 1 ? 'time' : 'timer'}`; };
  // 47 J: «X dager og Y timer» («Y timer» under ett døgn)
  const dagerOgTimer = (min) => { if (min == null) return '–'; const t = Math.floor(min / 60), d = Math.floor(t / 24), r = t % 24, T = (x) => `${x} ${x === 1 ? 'time' : 'timer'}`; return d ? `${d} ${d === 1 ? 'dag' : 'dager'} og ${T(r)}` : T(t); };
  const STATUS = { cleaning: 'Rengjør', returning: 'På vei hjem', paused: 'Pauset', docked: 'I dokken', idle: 'Klar', error: 'Feil', unavailable: 'Utilgjengelig', unknown: '–' };
  const ACTIVE = ['cleaning', 'paused', 'returning'];
  // 47 L2: valg fra robot/select → norsk (ukjente: første bokstav stor, «_» → mellomrom)
  const NB = { off: 'Av', on: 'På', quiet: 'Stille', silent: 'Stille', gentle: 'Mild', mild: 'Mild', low: 'Lav', balanced: 'Standard', standard: 'Standard', normal: 'Normal', medium: 'Middels', moderate: 'Middels', middle: 'Middels',
    strong: 'Sterk', high: 'Høy', intense: 'Intens', turbo: 'Turbo', max: 'Maks', max_plus: 'Maks+', maxplus: 'Maks+', deep: 'Dyp', deep_plus: 'Dyp+', deepplus: 'Dyp+', fast: 'Rask', custom: 'Egendefinert', auto: 'Auto', smart_mode: 'Smart', smart: 'Smart',
    vac_followed_by_mop: 'Støvsug, så mopp', vacuum_and_mop: 'Støvsug og mopp', mop: 'Mopp', mop_only: 'Bare mopp', vacuum: 'Støvsug', slight: 'Litt', extreme: 'Ekstrem', none: 'Ingen' };
  const nbOpt = (v) => { if (v == null || v === '') return '–'; const k = String(v).toLowerCase().replace(/[\s-]+/g, '_'); if (NB[k]) return NB[k]; const s = String(v).replace(/_/g, ' '); return s[0].toUpperCase() + s.slice(1); };

  // Fiks 34/35 · tema: gjennomsiktig hvit/svart (regel 3/4) og aksent som tekst/ikon (pkt. 6); mørk = uendret
  const WA = (a) => (M.theme ? M.theme.whiteA(a) : `rgba(255,255,255,${a})`), BA = (a) => (M.theme ? M.theme.blackA(a) : `rgba(0,0,0,${a})`); // ki-hex-ok: reserve uten MSH.theme
  const AT = (c) => { const r = M.theme && M.theme.accentText ? M.theme.accentText(c) : c; return /^color-mix/.test(r) ? c : r; }; // ukjente farger (lime, egne) beholdes
  /* ------------------------------------------------------------ robot-scenen (toppkortet) */
  // Fiks 26.11: gulvet fyller hele kartflaten (viewBox 60 0 184 200), dokken nede til venstre, sonen som lilla ellipse
  const ROUTE = 'M84 158 H228 V132 H84 V106 H228 V80 H84 V54 H228 V28 H84';
  const HOME = 'M196 92 C166 112 112 142 84 168';
  const DOCK = [84, 184];
  function scene(mode, charging, animOff) {
    const floor = `<defs><pattern id="pl" width="44" height="12" patternUnits="userSpaceOnUse"><rect width="44" height="12" fill="#5a4636"/><path d="M0 11.5H44M26 0V12" stroke="#4a3a2d" stroke-width="1"/><path d="M0 5H18" stroke="#63503f" stroke-width=".6" opacity=".6"/></pattern>
        <radialGradient id="rg" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#cfd4da"/></radialGradient></defs><!-- ki-hex-ok: robot-illustrasjon (mørk øy) -->
      <rect x="60" y="0" width="184" height="200" fill="url(#pl)"/>
      <ellipse class="zone" cx="176" cy="92" rx="40" ry="26"/>
      <g class="dock"><rect x="${DOCK[0] - 12}" y="${DOCK[1] - 6}" width="24" height="20" rx="5" fill="#2a3038"/><rect x="${DOCK[0] - 7}" y="${DOCK[1] - 2}" width="14" height="3.5" rx="1.75" class="dl ${charging ? 'on' : ''}"/></g>`;
    const bot = (inner) => `<g class="bot ${mode}">${inner}<circle r="11" fill="url(#rg)"/><circle r="11" fill="none" stroke="#b8bec6" stroke-width=".8"/><path d="M6.5 -8.5 A11 11 0 0 1 6.5 8.5" fill="none" stroke="#2a3038" stroke-width="2.4"/><circle cx="-2" r="3.4" fill="#2a3038"/><circle cx="-2" r="1.4" class="led"/>${mode === 'error' ? '<circle r="15" class="err"/>' : ''}</g>`;
    let trail = '', robot = '';
    if (mode === 'cleaning' && !animOff) {
      trail = `<path class="trail" d="${ROUTE}" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100"><animate attributeName="stroke-dashoffset" from="100" to="0" dur="36s" repeatCount="indefinite"/></path>`;
      robot = bot(`<animateMotion dur="36s" repeatCount="indefinite" rotate="auto" path="${ROUTE}"/>`);
    } else if (mode === 'cleaning' || mode === 'paused') {
      trail = `<path class="trail" d="${ROUTE}" pathLength="100" stroke-dasharray="100" stroke-dashoffset="52"/>`;
      robot = `<g transform="translate(228 93) rotate(90)">${bot('')}</g>`;
    } else if (mode === 'returning' && !animOff) {
      trail = `<path class="homep" d="${HOME}"/>`;
      robot = bot(`<animateMotion dur="5s" repeatCount="indefinite" rotate="auto" path="${HOME}"/>`);
    } else if (mode === 'returning') {
      trail = `<path class="homep" d="${HOME}"/>`;
      robot = `<g transform="translate(130 126)">${bot('')}</g>`;
    } else {
      robot = `<g transform="translate(${DOCK[0]} ${DOCK[1] - 14}) rotate(-90)">${bot('')}</g>`;
    }
    const bolt = charging ? `<g class="bolt" transform="translate(${DOCK[0] + 22} ${DOCK[1] - 28})"><circle r="10" fill="rgba(102,209,158,.22)"/><path d="M1.5 -7 L-4.5 1 H-0.5 L-1.5 7 L4.5 -1 H0.5 Z" fill="${C.green}"/></g>` : '';
    return `<svg class="scene" viewBox="60 0 184 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${floor}${trail}${robot}${bolt}</svg>`;
  }

  // Fiks 26.12: rom i kartbildet (Xiaomi Cloud Map Extractor-formatet: attributes.rooms {id: {x0,y0,x1,y1}} +
  // calibration_points [{vacuum:{x,y}, map:{x,y}} ×3]) → rektangler i bildets piksler, koblet til rommene (segment/navn).
  function mapRooms(st, rooms) {
    const a = (st && st.attributes) || {}, cp = a.calibration_points, R = a.rooms;
    if (!Array.isArray(cp) || cp.length < 3 || !R || typeof R !== 'object') return [];
    const P = cp.slice(0, 3).map((p) => p && p.vacuum && p.map ? [Number(p.vacuum.x), Number(p.vacuum.y), Number(p.map.x), Number(p.map.y)] : null);
    if (P.some((p) => !p || p.some((v) => isNaN(v)))) return [];
    const det = (m) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
    const A = P.map((p) => [p[0], p[1], 1]), D = det(A);
    if (!D) return [];
    const solve = (col) => [0, 1, 2].map((i) => det(A.map((row, r) => row.map((v, j) => (j === i ? P[r][col] : v)))) / D);
    const fx = solve(2), fy = solve(3), tr = (x, y) => [fx[0] * x + fx[1] * y + fx[2], fy[0] * x + fy[1] * y + fy[2]];
    const list = Array.isArray(R) ? R.map((r) => [r && (r.id != null ? r.id : r.number), r]) : Object.keys(R).map((k) => [k, R[k]]);
    const out = [];
    list.forEach(([id, r]) => {
      if (!r || [r.x0, r.y0, r.x1, r.y1].some((v) => isNaN(Number(v)))) return;
      const nm = String(r.name || '').toLowerCase();
      const room = rooms.find((x) => x.segment != null && String(x.segment) === String(id)) || (nm && rooms.find((x) => x.name.toLowerCase() === nm));
      if (!room) return;
      const a0 = tr(Number(r.x0), Number(r.y0)), a1 = tr(Number(r.x1), Number(r.y1));
      out.push({ room, x: Math.min(a0[0], a1[0]), y: Math.min(a0[1], a1[1]), w: Math.abs(a1[0] - a0[0]), h: Math.abs(a1[1] - a0[1]) });
    });
    return out;
  }
  const MAPWH = new Map(); // bildestørrelse per kart-URL (for rom-lag i bildets piksler)

  /* ------------------------------------------------------------ editor (Tilpass + GUI-editoren) */
  const cid = (ed) => ((ed && ed._config && ed._config.card_id) || '_');
  const EXP = new Map(), ADD = new Set(), ADDZ = new Set();
  const hdl = (list) => `<span data-edrag="${list}" aria-label="Dra for å flytte" style="width:32px;height:40px;display:grid;place-items:center;color:var(--ki-text-mid, #979797);flex:none;touch-action:none;cursor:grab">${M.icon('mdi:drag-vertical', 22)}</span>`;
  const eyeB = (key, op, t, v, hidden, label) => `<button class="ib" data-a="fn" data-k="${key}" data-op="${op}" data-t="${esc(t || '')}" data-v="${esc(v)}" aria-pressed="${!hidden}" aria-label="${hidden ? 'Vis' : 'Skjul'} ${esc(label)}" style="width:40px;height:40px;border-radius:20px;display:grid;place-items:center;flex:none;color:${hidden ? 'var(--ki-text-lo, #696969)' : 'var(--ki-text, #fafafa)'}">${M.icon(hidden ? 'mdi:eye-off-outline' : 'mdi:eye-outline', 20)}</button>`;
  const ROW = 'border-radius:26px;background:var(--ki-surface-2, #404040);display:flex;align-items:center;gap:6px;padding:6px 6px 6px 4px;min-height:56px';
  const INP = 'min-width:0;height:36px;border-radius:18px;background:var(--ki-surface, #2f2f2f);padding:0 12px;font-size:13px;color:var(--ki-text, #fafafa)';
  // Dra-håndtak (touch-action none + stopPropagation, fallgruve 2) for faner, rom og soner. Én gang per editor.
  function installEd(ed) {
    if (!ed || ed.__vacInst || !ed.shadowRoot) return;
    ed.__vacInst = true;
    const R = ed.shadowRoot;
    let d = null;
    const stop = (e) => { if (e.target.closest && e.target.closest('[data-edrag]')) e.stopPropagation(); };
    R.addEventListener('touchstart', stop, { passive: true });
    R.addEventListener('touchmove', (e) => { if (d || (e.target.closest && e.target.closest('[data-edrag]'))) { e.stopPropagation(); if (d && e.cancelable) e.preventDefault(); } }, { passive: false });
    R.addEventListener('pointerdown', (e) => {
      const hd = e.target.closest && e.target.closest('[data-edrag]');
      if (!hd || e.button) return;
      const item = hd.closest('[data-edk]');
      if (!item) return;
      e.stopPropagation(); e.preventDefault();
      if (hd.dataset.edrag === 'tab' && EXP.get(cid(ed))) { EXP.delete(cid(ed)); R.querySelectorAll('.vpart').forEach((x) => x.remove()); }
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
      e.stopPropagation();
      const D = d; d = null;
      D.item.style.transform = ''; D.item.style.zIndex = ''; D.item.style.boxShadow = '';
      if (D.over) D.over.style.outline = '';
      if (!D.over || e.type === 'pointercancel') { ed._render(); return; }
      const c = ed._config || {}, h = ed._hass;
      const arr = D.list === 'tab' ? tabOrder(c) : D.list === 'room' ? roomsOf(h, c, vacOf(h, c)).map((r) => r.key) : zonesOf(h, c).map((z) => z.key);
      const to = D.over.dataset.edk, i = arr.indexOf(D.k), j0 = arr.indexOf(to);
      const o = arr.filter((x) => x !== D.k), j = o.indexOf(to);
      o.splice(i <= j0 ? j + 1 : j, 0, D.k);
      M.haptic('success');
      ed._set(D.list === 'tab' ? 'tab_order' : D.list === 'room' ? 'room_order' : 'zone_order', o);
    };
    R.addEventListener('pointerup', end);
    R.addEventListener('pointercancel', end);
  }
  const box = (inner, gap = 8) => `<div class="f" style="gap:${gap}px;padding:0;background:none;box-shadow:none">${inner}</div>`;
  const small = (t) => `<span class="help" style="padding:0 6px">${esc(t)}</span>`;

  function editorSchema(h, c) {
    c = c || {};
    // Rom: dra-rekkefølge (room_order), farge (trykk = neste), navn, m², vis/skjul · «Legg til rom»
    const rom = { type: 'html', html: (hh, cc, key, ed) => {
      installEd(ed);
      const vac = vacOf(hh, cc), L = roomsOf(hh, cc, vac), add = ADD.has(cid(ed));
      const rows = L.map((r, i) => `<div class="ordrow vroom" data-edk="${esc(r.key)}" data-elist="room" data-key="vr-${esc(r.key)}" style="${ROW};${r.hidden ? 'opacity:.5' : ''}">${hdl('room')}
          <button data-a="fn" data-k="${key}" data-op="col" data-v="${esc(r.key)}" aria-label="Bytt farge for ${esc(r.name)}" style="width:36px;height:36px;border-radius:18px;display:grid;place-items:center;flex:none;background:var(--ki-surface, #2f2f2f)"><i style="width:16px;height:16px;border-radius:8px;background:${esc(r.color)}"></i></button>
          <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px"><input class="inp" data-name="rooms.${esc(r.key)}.name" value="${esc(r.name)}" aria-label="Navn på rom ${i + 1}" autocapitalize="off" spellcheck="false" style="${INP}"><span style="font-size:11px;color:var(--ki-text-mid, #979797);padding-left:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${i < 2 ? 'Stor · ' : ''}${esc(r.entity || (r.segment != null ? 'Segment ' + r.segment : r.key))}</span></span>
          <input class="inp" type="number" inputmode="decimal" data-name="rooms.${esc(r.key)}.m2" data-num="1" value="${r.m2 != null ? r.m2 : ''}" placeholder="m²" aria-label="Areal i m²" style="${INP};width:62px;padding:0 8px;text-align:center">
          ${r.manual ? `<button class="ib" data-a="fn" data-k="${key}" data-op="rdel" data-v="${esc(r.key)}" aria-label="Fjern ${esc(r.name)}" style="width:36px;height:40px;display:grid;place-items:center;flex:none;color:var(--ki-text-mid, #979797)">${M.icon('mdi:delete-outline', 20)}</button>` : ''}
          ${eyeB(key, 'reye', '', r.key, r.hidden, r.name)}</div>`).join('');
      const form = add ? `<div style="display:flex;flex-direction:column;gap:6px;padding:10px;border-radius:24px;background:var(--ki-surface-2, #404040)">
          <input class="inp" data-radd="name" placeholder="Navn (f.eks. Stue)" autocapitalize="off" spellcheck="false" style="${INP}">
          <input class="inp" data-radd="src" placeholder="input_boolean.… eller segment-ID (tall)" autocapitalize="off" spellcheck="false" style="${INP}">
          <button class="btn" style="height:44px" data-a="fn" data-k="${key}" data-op="radd" data-v="">${M.icon('mdi:check', 18)}Legg til</button></div>` : '';
      return box(`${L.length ? rows : small(vac ? kiT('Fant ingen rom fra roboten (segmenter) eller ', 'Found no rooms from the robot (segments) or ') + 'input_boolean.' + objOf(vac) + '_*.' : 'Velg støvsuger under Entiteter.')}${form}
        <button class="btn" style="height:48px" data-a="fn" data-k="${key}" data-op="raddopen" data-v="">${M.icon(add ? 'mdi:close' : 'mdi:plus', 20)}${add ? 'Lukk' : 'Legg til rom'}</button>
        ${small('Dra i håndtaket for rekkefølge: plass 1–2 er store, 3–5 ligger nederst. Farge-prikken bytter farge, øyet skjuler rommet.')}`);
    }, click: (dd, ed) => {
      const cc = ed._config || {}, hh = ed._hass, id = cid(ed);
      if (dd.op === 'raddopen') { M.haptic('selection'); if (ADD.has(id)) ADD.delete(id); else ADD.add(id); return ed._render(); }
      if (dd.op === 'col') { const r = roomsOf(hh, cc, vacOf(hh, cc)).find((x) => x.key === dd.v); const i = PAL.indexOf(r && r.color); M.haptic('selection'); return ed._set('rooms.' + dd.v + '.color', PAL[(i + 1) % PAL.length]); }
      if (dd.op === 'reye') { const r = (cc.rooms || {})[dd.v] || {}; M.haptic('selection'); return ed._set('rooms.' + dd.v + '.hidden', r.hidden ? undefined : true); }
      if (dd.op === 'rdel') { const R = { ...(cc.rooms || {}) }; delete R[dd.v]; M.haptic('warning'); return ed._set('rooms', Object.keys(R).length ? R : undefined); }
      if (dd.op === 'radd') {
        const q = (n) => { const el = ed.shadowRoot.querySelector(`[data-radd="${n}"]`); return el ? el.value.trim() : ''; };
        const name = q('name'), src = q('src');
        if (!name || !src) { M.haptic('warning'); M.toast('Skriv navn og entitet eller segment-ID'); return; }
        const isEnt = /^[a-z_]+\.[a-z0-9_]+$/.test(src);
        if (!isEnt && !/^\d+$/.test(src)) { M.haptic('warning'); M.toast('Bruk input_boolean.… eller et tall'); return; }
        let k = 'r_' + (M.slug(name) || 'rom'); while ((cc.rooms || {})[k]) k += '_2';
        ADD.delete(id); M.haptic('success');
        return ed._set('rooms.' + k, { name, manual: true, ...(isEnt ? { entity: src } : { segment: Number(src) }) });
      }
    } };
    // Soner: dra-rekkefølge (zone_order), navn, vis/skjul · 47 L3: «Legg til sone» (script.*) og fjern egne
    const soner = { type: 'html', html: (hh, cc, key, ed) => {
      installEd(ed);
      const L = zonesOf(hh, cc), add = ADDZ.has(cid(ed));
      const used = new Set(L.map((z) => z.entity)), sug = hh ? Object.keys(hh.states).filter((id) => id.startsWith('script.') && !used.has(id)).sort() : [];
      const rows = L.map((z) => `<div class="ordrow vzone" data-edk="${esc(z.key)}" data-elist="zone" data-key="vz-${esc(z.key)}" style="${ROW};${z.hidden ? 'opacity:.5' : ''}">${hdl('zone')}
          <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px"><input class="inp" data-name="zones.${esc(z.key)}.name" value="${esc(z.name)}" aria-label="Navn på sone" autocapitalize="off" spellcheck="false" style="${INP}"><span style="font-size:11px;color:var(--ki-text-mid, #979797);padding-left:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(z.entity)}</span></span>
          ${z.manual ? `<button class="ib" data-a="fn" data-k="${key}" data-op="zdel" data-v="${esc(z.key)}" aria-label="Fjern ${esc(z.name)}" style="width:36px;height:40px;display:grid;place-items:center;flex:none;color:var(--ki-text-mid, #979797)">${M.icon('mdi:delete-outline', 20)}</button>` : ''}
          ${eyeB(key, 'zeye', '', z.key, z.hidden, z.name)}</div>`).join('');
      const form = add ? `<div style="display:flex;flex-direction:column;gap:6px;padding:10px;border-radius:24px;background:var(--ki-surface-2, #404040)">
          <input class="inp" data-zadd="id" list="vz-sug" placeholder="script.…" autocapitalize="off" spellcheck="false" style="${INP}"><datalist id="vz-sug">${sug.map((id) => `<option value="${esc(id)}">${esc(M.name(hh, id))}</option>`).join('')}</datalist>
          <input class="inp" data-zadd="name" placeholder="Navn (valgfritt – ellers skriptets navn)" autocapitalize="off" spellcheck="false" style="${INP}">
          <button class="btn" style="height:44px" data-a="fn" data-k="${key}" data-op="zadd" data-v="">${M.icon('mdi:check', 18)}Legg til</button></div>` : '';
      return box(`${L.length ? rows : small('Fant ingen sone-skript (script.*_zone_* / *_sone_*).')}${form}
        <button class="btn" style="height:48px" data-a="fn" data-k="${key}" data-op="zaddopen" data-v="">${M.icon(add ? 'mdi:close' : 'mdi:plus', 20)}${add ? 'Lukk' : 'Legg til sone'}</button>
        ${small('Sonene vises som piller under «Støvsug alt». Trykk kjører skriptet (script.turn_on). Øyet skjuler.')}`);
    }, click: (dd, ed) => {
      const cc = ed._config || {}, id = cid(ed);
      if (dd.op === 'zeye') { const z = (cc.zones || {})[dd.v] || {}; M.haptic('selection'); return ed._set('zones.' + dd.v + '.hidden', z.hidden ? undefined : true); }
      if (dd.op === 'zaddopen') { M.haptic('selection'); if (ADDZ.has(id)) ADDZ.delete(id); else ADDZ.add(id); return ed._render(); }
      if (dd.op === 'zdel') { const Z = { ...(cc.zones || {}) }; delete Z[dd.v]; M.haptic('warning'); return ed._set('zones', Object.keys(Z).length ? Z : undefined); }
      if (dd.op === 'zadd') {
        const q = (n) => { const el = ed.shadowRoot.querySelector(`[data-zadd="${n}"]`); return el ? el.value.trim() : ''; };
        const sid = q('id'), name = q('name');
        if (!/^script\.[a-z0-9_]+$/.test(sid)) { M.haptic('warning'); M.toast('Bruk et skript: script.…'); return; }
        ADDZ.delete(id); M.haptic('success');
        return ed._set('zones.' + sid.slice(7), { entity: sid, manual: true, ...(name ? { name } : {}) });
      }
    } };
    // Faner: forhåndsvisning + piller med dra, ikon, navn, «N deler», pil (innhold) og øye
    const faner = { type: 'html', html: (hh, cc, key, ed) => {
      installEd(ed);
      const hid = tabHidden(cc), open = EXP.get(cid(ed)), V = visTabs(cc), st = (M.startTab ? M.startTab.pillKey(cc, V, LEG_ST) : null) || V[0], names = cc.tab_labels !== 'icon'; // 36.5: forhåndsvisningen viser startfanen
      const prev = `<div style="display:flex;gap:2px;padding:4px;border-radius:24px;background:var(--ki-surface-3, #282828);overflow:hidden" aria-label="Forhåndsvisning">${V.map((k) => { const [, l, ic] = TABL[k], on = k === st; return `<span style="flex:${on || names ? '1 1 auto' : '0 0 40px'};height:36px;border-radius:18px;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:0 10px;font-size:12px;white-space:nowrap;${on ? `background:${C.accent};color:var(--ki-on-accent, #2a1720);font-weight:500` : 'color:var(--ki-text-2, #afafaf)'}">${names ? '' : M.icon(ic, 18)}${on || names ? esc(l) : ''}</span>`; }).join('')}<span style="width:36px;height:36px;border-radius:18px;display:grid;place-items:center;background:var(--ki-surface, #3a3a3a);flex:none">${M.icon('mdi:cog', 18)}</span></div>`;
      return box(prev + tabOrder(cc).map((k) => {
        const [, label, icon] = TABL[k], P = PARTS[k], ph = partHidden(cc, k), isO = open === k;
        const row = `<div class="ordrow vtab" data-edk="${k}" data-elist="tab" data-key="vt-${k}" style="height:56px;border-radius:28px;background:var(--ki-surface-2, #404040);display:flex;align-items:center;gap:8px;padding:0 6px 0 4px;${hid.has(k) ? 'opacity:.5' : ''}">${hdl('tab')}
          <span style="width:36px;height:36px;border-radius:18px;display:grid;place-items:center;background:var(--ki-surface, #2f2f2f);flex:none">${M.icon(icon, 20)}</span>
          <span style="flex:1;min-width:0;display:flex;flex-direction:column"><span style="font-size:14px;font-weight:500">${esc(label)}</span><span style="font-size:11px;color:var(--ki-text-mid, #979797)">${P.length - ph.size} av ${P.length} deler</span></span>${M.startTab ? M.startTab.pill(cc, k, V, LEG_ST) : ''}
          <button class="ib" data-a="fn" data-k="${key}" data-op="exp" data-v="${k}" aria-expanded="${isO}" aria-label="Innhold i ${esc(label)}" style="width:40px;height:40px;border-radius:20px;display:grid;place-items:center;flex:none">${M.icon(isO ? 'mdi:chevron-up' : 'mdi:chevron-down', 22)}</button>
          ${eyeB(key, 'eye', '', k, hid.has(k), label)}</div>`;
        const parts = isO ? P.map(([p, pl]) => `<div class="vpart" data-key="vp-${k}-${p}" style="height:48px;border-radius:24px;margin-left:28px;background:var(--ki-surface-3, #2f2f2f);display:flex;align-items:center;gap:8px;padding:0 6px 0 16px;${ph.has(p) ? 'opacity:.5' : ''}"><span style="flex:1;font-size:13px">${esc(pl)}</span>${eyeB(key, 'peye', k, p, ph.has(p), pl)}</div>`).join('') : '';
        return row + parts;
      }).join('') + small('Dra i håndtaket for rekkefølge. Pilen viser innholdet i fanen, øyet skjuler. Minst én fane må være synlig.'));
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
    const groups = [...new Set(ENT.map((e) => e[3]))];
    const entFields = groups.map((g) => ({ type: 'section', id: 'ent-' + M.slug(g), label: g, icon: 'mdi:link-variant', fields: ENT.filter((e) => e[3] === g).map(([k, label, dom]) => ({
      type: 'entity', name: 'entities.' + k, label, domain: dom, auto: (hh, cc) => autoEnt(hh, cc || {}, k),
    })) }));
    return [
      { type: 'tabs', id: 'stovsuger', tabs: [
        { key: 'rom', label: 'Rom', icon: 'mdi:floor-plan', focus: ['rom', 'rom-liste', 'soner'], fields: [
          { type: 'section', id: 'rom', label: 'Robot', icon: 'mdi:robot-vacuum', fields: [
            { type: 'text', name: 'name', label: 'Navn', auto: (hh, cc) => { const v = vacOf(hh, cc || {}); return v && hh && hh.states[v] ? M.name(hh, v) : 'Støvsuger'; } },
            { type: 'text', name: 'floor', label: 'Etasje', placeholder: 'f.eks. 2. etasje' },
          ] },
          { type: 'section', id: 'rom-liste', label: 'Rom', icon: 'mdi:floor-plan', fields: [rom] },
          { type: 'section', id: 'soner', label: 'Soner', icon: 'mdi:selection-drag', fields: [soner] },
        ] },
        { key: 'faner', label: 'Faner', icon: 'mdi:tab', focus: ['faner'], fields: [
          ...(M.startTab ? [M.startTab.field({ legacy: LEG_ST, clear: ['startTab'], items: (hh, cc) => visTabs(cc || {}).map((k) => ({ key: k, label: TABL[k][1], icon: TABL[k][2] })) })] : []), // 36.5: Startfane øverst
          { type: 'section', id: 'faner', label: 'Faner', icon: 'mdi:tab', fields: [faner] },
          { type: 'select', name: 'tab_labels', label: 'Stil', options: [['name', 'Tekst'], ['icon', 'Symboler']], default: 'name', help: 'Tekst (standard): like brede tekstfaner i full bredde. Symboler: bare ikon, den aktive fanen viser også navnet.' },
          ...(M.tabH ? [M.tabH.field({ items: (hh, cc) => visTabs(cc || {}).map((k) => ({ key: k, label: TABL[k][1], icon: TABL[k][2] })), mode: (cc) => (cc.tab_labels === 'icon' ? 'aktiv' : 'tekst'), native: 40, gear: true })] : []), // 33.4: fanehøyde
        ] },
        { key: 'entiteter', label: 'Entiteter', icon: 'mdi:link-variant', focus: ['entiteter', 'ent-soner', ...groups.map((g) => 'ent-' + M.slug(g))], fields: [...entFields, { type: 'section', id: 'ent-soner', label: 'Soner (skript)', icon: 'mdi:selection-drag', fields: [soner] }] },
        { key: 'avansert', label: 'Avansert', icon: 'mdi:cog-outline', focus: ['avansert', 'spacing'], fields: [
          { type: 'section', id: 'avansert', label: 'Avansert', icon: 'mdi:cog-outline', fields: [
            { type: 'boolean', name: 'confirm_start', label: 'Bekreft før start (trykk to ganger)', default: false },
            { type: 'boolean', name: 'auto_empty', label: 'Tøm automatisk når roboten er tilbake i dokken', default: false },
          ] },
          M.spacingSchema(),
          { type: 'button', label: 'Tilbakestill til standard', icon: 'mdi:restore', run: (hh, cc, ed) => { M.haptic('warning'); const id = (cc && cc.card_id) || M.uid(); EXP.delete(id); ADD.delete(id); ADDZ.delete(id); ed._config = { type: cc.type || 'custom:' + TAG, ...Stovsuger.getStubConfig(), card_id: id }; ed._set('card_id', id); } },
        ] },
      ] },
    ];
  }

  /* ============================================================ kortet */
  const AE = new Map(); // auto-tøm: siste tilstand per støvsuger (én gang per retur, også med flere kort)
  class Stovsuger extends M.Card {
    static get cardName() { return 'Sir Sweeps'; }
    static getStubConfig() { return { card_id: M.uid(), name: 'Sir Sweeps', entities: { ...DEF_ENT } }; }
    static get schema() { return editorSchema; }
    static get uiPersist() { return ['tab']; }
    get cardSize() { return 12; }
    set hass(h) { this._autoEmpty(h); super.hass = h; }
    get hass() { return super.hass; }
    _autoEmpty(h) {
      if (!h) return;
      const c = this.config, E = entsOf(h, c), st = E.vacuum && h.states[E.vacuum];
      if (!st) return;
      const prev = AE.get(E.vacuum); AE.set(E.vacuum, st.state);
      if (c.auto_empty && prev && ACTIVE.includes(prev) && st.state === 'docked' && E.empty && h.states[E.empty]) this._run(h, E.empty);
    }
    // Fiks 55 A4: ingen tegning under åpne-animasjonen (DOM-en fra forrige åpning står); én tegning når popupen har satt seg
    static get settleOnOpen() { return true; }
    onOpen() { this.update(); if (!this._settling) this._tick(); }
    onSettled() { this._tick(); }
    onClose() { clearInterval(this._timer); this._timer = 0; this._ui = { ...this._ui, armed: 0, emptying: 0 }; }
    get holdMs() { return 500; } // 47 L2: hold 500 ms → more-info (valgliste for select.*)
    disconnectedCallback() { super.disconnectedCallback(); clearInterval(this._timer); this._timer = 0; }
    // Fremdriften teller mens roboten jobber og popupen er åpen (ingen polling ellers, fallgruve 8)
    _tick() { clearInterval(this._timer); this._timer = setInterval(() => { if (!this.isConnected || !this.isOpen) { clearInterval(this._timer); this._timer = 0; return; } const s = this._E && this._hass && this._hass.states[this._E.vacuum]; if (s && s.state === 'cleaning') this.update(); }, 15000); }
    get tab() { const V = visTabs(this.config); const t = this.ui.tab || this.config.startTab; return V.includes(t) ? t : V[0]; }
    // 36.5: startfane ved åpning (MSH.startTab via basekortet)
    static get startTabSpec() { return { tabs: (card) => visTabs(card.config), legacy: LEG_ST }; }
    _run(h, id, data) { if (!id) return; const d = id.split('.')[0]; if (d === 'script') return M.call(h, 'script', 'turn_on', { entity_id: id, ...(data || {}) }); if (d === 'button') return M.call(h, 'button', 'press', { entity_id: id }); return M.toggle(h, id); }

    /* ---------------------------------------------------------- data */
    _model() {
      const h = this.hass, c = this.config, E = entsOf(h, c); this._E = E;
      const vs = this.s(E.vacuum), state = vs ? vs.state : 'unknown';
      const bs = this.s(E.battery), bat = bs && M.isNum(bs.state) ? Math.round(Number(bs.state)) : vs && M.isNum(vs.attributes.battery_level) ? Math.round(Number(vs.attributes.battery_level)) : null;
      const cs = this.s(E.charging), charging = cs ? cs.state === 'on' : state === 'docked' && bat != null && bat < 100;
      const tank = this.s(E.tank);
      const rooms = roomsOf(h, c, E.vacuum), vis = rooms.filter((r) => !r.hidden);
      const sel = vis.filter((r) => this._isSel(r));
      const areaMin = minutesOf(this.s(E.time)), areaTot = num(this.s(E.area) && this.s(E.area).state);
      const rate = areaMin && areaTot ? areaMin / areaTot : null; // min per m²: robotens egen snittfart (ingen gjettet standard)
      // Fiks 26.11: sum for valgte rom (ellers alle); mangler areal/tid for et rom skjules tallet – aldri «– m²»
      const pick = sel.length ? sel : vis, m2 = pick.length && pick.every((r) => r.m2) ? pick.reduce((s, r) => s + r.m2, 0) : null;
      const est = pick.length && pick.every((r) => r.min) ? Math.round(pick.reduce((s, r) => s + r.min, 0)) : m2 && rate ? Math.round(m2 * rate) : null;
      return { h, c, E, vs, state, bat, charging, tank: !!(tank && tank.state === 'on'), rooms: vis, sel, m2, est, active: ACTIVE.includes(state) };
    }
    _isSel(r) { if (r.entity) { const s = this.s(r.entity); return !!(s && M.isOn(s)); } return !!(this.ui.sel || {})[r.key]; }
    _progress(m) {
      const ps = this.s(m.E.progress);
      if (ps && M.isNum(ps.state)) return { pct: M.clamp(Math.round(Number(ps.state)), 0, 100), exact: true, left: m.est && m.state === 'cleaning' ? Math.max(0, Math.round(m.est * (1 - Number(ps.state) / 100))) : null };
      const a = m.vs && m.vs.attributes, ap = a && (a.cleaning_progress != null ? a.cleaning_progress : a.progress);
      if (M.isNum(ap)) return { pct: M.clamp(Math.round(Number(ap)), 0, 100), exact: true, left: null };
      if (m.state !== 'cleaning' || !m.est) return { pct: null, left: null };
      const el = (Date.now() - new Date(m.vs.last_changed).getTime()) / 60000;
      return { pct: M.clamp(Math.round((el / m.est) * 100), 0, 99), exact: false, left: Math.max(0, Math.round(m.est - el)) };
    }

    /* ---------------------------------------------------------- handlinger */
    onAction(name, el, ev) {
      const d = el.dataset, h = this.hass, E = this._E || entsOf(h, this.config);
      switch (name) {
        case 'tab': return this.setUI({ tab: d.v, armed: 0 });
        case 'room': case 'maproom': {
          const r = roomsOf(h, this.config, E.vacuum).find((x) => x.key === d.k);
          if (!r) return;
          if (r.entity) return M.call(h, r.entity.split('.')[0] === 'input_boolean' ? 'input_boolean' : 'homeassistant', 'toggle', { entity_id: r.entity });
          return this.setUI({ sel: { ...(this.ui.sel || {}), [r.key]: !(this.ui.sel || {})[r.key] } });
        }
        case 'selall': {
          const m = this._model(), all = m.sel.length < m.rooms.length;
          const S = { ...(this.ui.sel || {}) };
          m.rooms.forEach((r) => { if (r.entity) { if (this._isSel(r) !== all) M.call(h, 'input_boolean', all ? 'turn_on' : 'turn_off', { entity_id: r.entity }); } else S[r.key] = all; });
          return this.setUI({ sel: S });
        }
        case 'start': {
          if (this.config.confirm_start && !this.ui.armed) { this.setUI({ armed: Date.now() }); clearTimeout(this._armT); this._armT = setTimeout(() => this.setUI({ armed: 0 }), 3500); return; }
          this.setUI({ armed: 0 });
          const m = this._model(), segSel = m.sel.filter((r) => r.segment != null);
          if (segSel.length && segSel.length === m.sel.length) return M.call(h, 'vacuum', 'send_command', { entity_id: E.vacuum, command: 'app_segment_clean', params: segSel.map((r) => (M.isNum(r.segment) ? Number(r.segment) : r.segment)) });
          if (E.start && h.states[E.start]) return this._run(h, E.start);
          return M.call(h, 'vacuum', 'start', { entity_id: E.vacuum });
        }
        case 'pause': return E.pause && h.states[E.pause] ? this._run(h, E.pause) : M.call(h, 'vacuum', 'pause', { entity_id: E.vacuum });
        case 'resume': return E.resume && h.states[E.resume] ? this._run(h, E.resume) : M.call(h, 'vacuum', 'start', { entity_id: E.vacuum });
        case 'home': return E.home && h.states[E.home] ? this._run(h, E.home) : M.call(h, 'vacuum', 'return_to_base', { entity_id: E.vacuum });
        case 'empty': {
          if (!E.empty || !h.states[E.empty]) return this.customize('ent-rengjoring'); // 47 I: mangler «Tøm» → entitetsvalget
          this.setUI({ emptying: Date.now() }); clearTimeout(this._empT); this._empT = setTimeout(() => this.setUI({ emptying: 0 }), 2400);
          return this._run(h, E.empty);
        }
        case 'fannext': { // 47 L2: trykk = neste viftehastighet
          this._tapAnim(el);
          const m = this._model(), f = this._fan(m);
          if (f.kind === 'list') { const i = f.opts.indexOf(f.cur); return M.call(h, 'vacuum', 'set_fan_speed', { entity_id: E.vacuum, fan_speed: f.opts[(i + 1) % f.opts.length] }); }
          if (f.kind === 'script') return this._run(h, E.fan_script);
          if (f.kind === 'miss') return this.customize('ent-vifte_og_mopp');
          return;
        }
        case 'optnext': { // 47 L2: trykk = neste moppvalg (select.select_option)
          this._tapAnim(el);
          const o = this._opt(E[d.k]);
          if (o.miss) return this.customize('ent-vifte_og_mopp');
          const i = o.opts.indexOf(o.cur);
          return M.call(h, o.id.split('.')[0], 'select_option', { entity_id: o.id, option: o.opts[(i + 1) % o.opts.length] });
        }
        case 'zone': return this._run(h, d.id);
        case 'reset': return M.call(h, 'button', 'press', { entity_id: d.id });
        case 'mapreset': return this._mapReset(true);
        default: return super.onAction(name, el, ev);
      }
    }

    /* ---------------------------------------------------------- tegning */
    render() {
      const m = this._model(), c = m.c, t = this.tab;
      // Fiks 26.11: tekstfaner som standard, like brede i full bredde (grid); den rosa boblen er den aktive fanen selv
      const V = visTabs(c), names = c.tab_labels !== 'icon';
      const tabs = `<div class="tabs ${names ? 'names' : 'itabs'}" role="tablist" data-glass-drag="x">${V.map((k) => {
        const [, label, icon] = TABL[k];
        return names ? `<button class="ntab ${k === t ? 'on' : ''}" role="tab" aria-selected="${k === t}" aria-label="${esc(label)}" data-act="tab" data-v="${k}" data-haptic="selection">${esc(label)}</button>`
          : M.iconTabs.btn({ label, icon }, k === t, `data-act="tab" data-v="${k}" data-haptic="selection"`, k === t ? 'on' : '');
      }).join('')}</div>`;
      let body;
      try { body = this['_t_' + t](m); } catch (e) { body = this._failHTML(e); }
      return `<div class="wrap">${this._hero(m)}${m.tank ? this._tank(m) : ''}<div class="top"${M.tabH && M.tabH.style(c) ? ` style="${M.tabH.style(c)}"` : ''}>${tabs}<button class="gear press" data-act="customize" aria-label="Tilpass">${M.icon('mdi:cog', 22)}</button></div><div class="pane" data-key="pane-${t}">${body}</div></div>`;
    }
    _parts(t) { const hid = partHidden(this.config, t); return PARTS[t].map((p) => p[0]).filter((p) => !hid.has(p)); }
    _missing(text, section) { return `<div class="miss"><span class="mdash">–</span><span>·</span><button class="pick press" data-act="customize" data-section="${esc(section || 'ent-robot_og_status')}">${M.icon('mdi:plus', 18)}Velg entitet</button>${text ? `<span class="mt">${esc(text)}</span>` : ''}</div>`; }
    // Fiks 26.11: mørk flate med svak radial glød · navn 15 px + status-chip med ikon · batteri 44 px, «batteri» og tynn
    // grønn stolpe · kartet til høyre (kortets høyde − 12 px) med tregulv, sonen som lilla ellipse og roboten ved dokken.
    _hero(m) {
      const mode = !m.vs ? 'none' : m.state === 'error' ? 'error' : ['cleaning', 'paused', 'returning'].includes(m.state) ? m.state : 'docked';
      const [label, ic] = !m.vs ? ['–', 'mdi:help-circle-outline'] : m.state === 'docked' ? (m.charging ? ['Lader i dokken', 'mdi:battery-charging'] : ['I dokken', 'mdi:home-outline'])
        : m.state === 'cleaning' ? ['Rengjør', 'mdi:broom'] : m.state === 'returning' ? ['På vei hjem', 'mdi:home-import-outline'] : m.state === 'paused' ? ['Pauset', 'mdi:pause']
          : m.state === 'error' ? [m.vs.attributes.error ? 'Feil · ' + m.vs.attributes.error : 'Feil', 'mdi:alert-circle-outline'] : [STATUS[m.state] || m.vs.state, 'mdi:robot-vacuum'];
      const name = this.config.name || (m.vs ? M.name(this.hass, m.E.vacuum) : 'Støvsuger');
      const tone = mode === 'cleaning' ? C.green : mode === 'returning' || mode === 'paused' ? C.orange : mode === 'error' ? C.red : m.charging ? C.green : 'var(--ki-text-1, var(--gray900,#c7c7c7))';
      const animOff = M.animOff ? M.animOff() : false;
      return `<div class="hero ${mode}" data-key="hero">
        <div class="scw" data-ki-island>${scene(mode === 'none' ? 'docked' : mode, m.charging && mode === 'docked', animOff)}</div>
        <div class="hl">
          <span class="hn">${esc(name)}</span>
          <span class="spill" style="--tc:${tone};--tcx:${/--ki-/.test(tone) ? tone : AT(tone)}" ${m.E.vacuum ? `data-ent="${esc(m.E.vacuum)}"` : ''}>${M.icon(ic, 16)}<span>${esc(label)}</span></span>
          ${!m.vs ? `<button class="pick press" data-act="customize" data-section="ent-robot_og_status">${M.icon('mdi:plus', 18)}Velg entitet</button>` : ''}
          <div class="batw" ${m.E.battery || m.E.vacuum ? `data-ent="${esc(m.E.battery || m.E.vacuum)}"` : ''}>
            <div class="bat"><span class="bv num">${m.bat != null ? m.bat : '–'}</span><span class="bu">%</span></div>
            <span class="bl">batteri</span>
            <span class="bbar"><i style="width:${m.bat != null ? M.clamp(m.bat, 0, 100) : 0}%"></i></span>
          </div>
        </div></div>`;
    }
    _tank(m) {
      return `<div class="tank" role="alert" ${m.E.tank ? `data-ent="${esc(m.E.tank)}"` : ''}><span class="ti">${M.icon('mdi:water-off-outline', 28)}</span><span class="tt"><b>Vanntanken er tom</b><span>Fyll på før neste mopping.</span></span>
        <button class="tb press" data-act="empty" aria-label="Tøm støvsuger">${M.icon('mdi:delete-empty', 20)}Tøm</button></div>`;
    }
    /* ---------------------------------------------------------- Renhold */
    // Fiks 26.11: rommene i ETT kort (etasjenavn + «Velg alle» som tekstknapp), fargetonede fliser i 2 + 3-rutenett
    // (1fr 2fr 1fr), sum nederst · grønn «Støvsug alt»-pill med to linjer · Soner som vannrett rad med piller.
    _roomRows(n) {
      // Plass i et 4-kolonners rutenett: rad 1 = 2 store (2+2), deretter rader med 3 (1+2+1); rest fyller raden
      if (n <= 1) return [4];
      const spans = [2, 2];
      let left = n - 2;
      while (left > 0) { if (left >= 3) { spans.push(1, 2, 1); left -= 3; } else if (left === 2) { spans.push(2, 2); left = 0; } else { spans.push(4); left = 0; } }
      return spans;
    }
    _sumText(m) { const p = []; if (m.m2) p.push(M.nf(m.m2) + ' m²'); if (m.est) p.push('ca ' + m.est + ' min'); return p; }
    _what(m) { return m.sel.length && m.sel.length < m.rooms.length ? m.sel.map((r) => r.name).join(', ') : 'Alle rom'; }
    // 47 H/L1 · «Støvsug alt»-pillen (Sir Sweeps v3: big.wrap / big.cell / big.robot / big.dot). De bærende fargene står
    // inline (ingen arv, ingen ha-icon, ingen opacity/filter) så ingen tema-/Bubble-variabel kan farge dem om.
    _bigPill(m, allLbl, n, sum) {
      const cleaning = m.state === 'cleaning', paused = m.state === 'paused', returning = m.state === 'returning', armed = !!this.ui.armed && !m.active;
      const col = paused || armed ? ORANGE : GREEN;
      const p = cleaning || paused ? this._progress(m) : null;
      const label = cleaning ? 'Støvsuger' : paused ? 'Pauset' : returning ? 'Returnerer' : armed ? 'Trykk igjen for å starte' : allLbl || !n ? 'Støvsug alt' : 'Støvsug valgte rom';
      const sub = cleaning || paused ? [this._what(m), p && p.left != null ? p.left + ' min igjen' : ''].filter(Boolean).join(' · ') : returning ? 'På vei til dokken' : sum.join(' · ');
      const ctl = cleaning || paused;
      const act = ctl ? '' : `data-act="start" data-haptic="medium"`;
      return `<div class="sw ${cleaning ? 'run' : ''} ${paused ? 'pz' : ''} ${armed ? 'armed' : ''}" data-key="sw" style="background:${col};color:${ON_ACC}">
        <button class="gobtn swb ${armed ? 'armed' : ''}" ${act} ${m.vs ? '' : 'disabled'} aria-label="${esc(label)}">
          <span class="sw-cell" style="background:${SW_CELL}"><span class="sw-ring" style="border-color:${col}"><span class="sw-dot" style="background:${col}"></span></span></span>
          <span class="sw-tx"><span class="sw-t">${esc(label)}</span>${sub ? `<span class="sw-s num">${esc(sub)}</span>` : ''}</span>
        </button>${ctl ? `<span class="sw-ctl"><button class="sw-cb press" data-act="${cleaning ? 'pause' : 'resume'}" data-haptic="medium" aria-label="${cleaning ? 'Pause' : 'Fortsett'}">${M.icon(cleaning ? 'mdi:pause' : 'mdi:play', 22)}</button><button class="sw-cb press" data-act="home" data-haptic="medium" aria-label="Returner hjem">${M.icon('mdi:home', 22)}</button></span>` : ''}</div>`;
    }
    _allLbl(m) { const as = this.s(m.E.all); return as ? String(as.state) === 'False' || as.state === 'off' : !m.sel.length || m.sel.length === m.rooms.length; }
    _t_renhold(m) {
      const P = this._parts('renhold'), c = m.c, out = [];
      if (!m.vs) out.push(this._missing('Fant ingen vacuum.*-entitet'));
      const allLbl = this._allLbl(m), n = m.sel.length, sum = this._sumText(m);
      if (P.includes('rom')) {
        if (!m.rooms.length) out.push(`<div class="miss"><span>Ingen rom</span><span>·</span><button class="pick press" data-act="customize" data-section="rom-liste">${M.icon('mdi:plus', 18)}Legg til rom</button></div>`);
        else {
          const all = m.sel.length === m.rooms.length, spans = this._roomRows(m.rooms.length);
          const tiles = m.rooms.map((r, i) => {
            const on = this._isSel(r), big = i < 2 && m.rooms.length > 1;
            return `<button class="rt press ${big ? 'big' : ''} ${on ? 'on' : ''}" style="--rc:${esc(r.color)};--rcx:${esc(AT(r.color))};grid-column:span ${spans[i]}" data-act="room" data-k="${esc(r.key)}" ${r.entity ? `data-ent="${esc(r.entity)}"` : ''} role="checkbox" aria-checked="${on}" data-haptic="selection">
              <span class="ri">${M.icon(r.icon, 18)}</span><span class="rtx"><span class="rn">${esc(r.name)}</span>${r.m2 ? `<span class="rm num">${M.nf(r.m2)} m²</span>` : ''}</span></button>`;
          }).join('');
          const lead = allLbl || !n ? 'Alle rom' : `${n} rom`;
          out.push(`<div class="rcard"><div class="rch"><span class="rct">${esc(c.floor || 'Rom')}</span><button class="lnk press" data-act="selall">${all ? 'Fjern alle' : 'Velg alle'}</button></div>
            <div class="rgrid">${tiles}</div>
            <div class="sum num">${esc([lead, ...sum].join(' · '))}</div></div>`);
        }
      }
      if (P.includes('start')) out.push(this._bigPill(m, allLbl, n, sum));
      if (P.includes('soner')) {
        const Z = zonesOf(this.hass, c).filter((z) => !z.hidden);
        // 47 L3: «Soner» rett under «Støvsug alt» – engangshandlinger (aldri aktiv-tilstand), vannrett rad (pan-x)
        if (Z.length) out.push(`<div class="zsec"><span class="zh">Soner</span><div class="zones" data-gd-skip>${Z.map((z) => `<button class="zc press" data-act="zone" data-id="${esc(z.entity)}" data-ent="${esc(z.entity)}" data-haptic="medium">${M.icon(z.icon, 22)}<span>${esc(z.name)}</span></button>`).join('')}<span class="zend"></span></div></div>`);
      }
      return out.join('');
    }

    /* ---------------------------------------------------------- Kontroll */
    // 47 L2: verdier fra HA → norsk (aldri «True/False»)
    _opt(id) {
      const st = this.s(id), d = id ? String(id).split('.')[0] : '';
      if (!st) return { miss: true };
      // Feil kobling: binær/bryter-entitet, ingen valgliste eller boolsk tilstand → «–» + «Velg entitet»
      const opts = st.attributes && Array.isArray(st.attributes.options) ? st.attributes.options : null;
      if (!['select', 'input_select'].includes(d) || !opts || !opts.length || /^(true|false)$/i.test(String(st.state))) return { miss: true, wrong: true };
      return { id, opts, cur: M.unavailable(st) ? null : st.state };
    }
    _fan(m) {
      const a = m.vs ? m.vs.attributes : {}, L = Array.isArray(a.fan_speed_list) ? a.fan_speed_list.filter((x) => x != null && x !== '') : [];
      const cur = a.fan_speed != null && !/^(true|false)$/i.test(String(a.fan_speed)) ? a.fan_speed : null;
      if (L.length) return { opts: L, cur, kind: 'list' };
      if (m.E.fan_script && this.s(m.E.fan_script)) return { opts: [], cur, kind: 'script' };
      return { opts: [], cur, kind: cur != null ? 'ro' : 'miss' };
    }
    _t_kontroll(m) {
      const P = this._parts('kontroll'), out = [], h = this.hass;
      if (!m.vs) return this._missing('Fant ingen vacuum.*-entitet');
      const cleaning = m.state === 'cleaning', paused = m.state === 'paused', returning = m.state === 'returning';
      // 47 I: ÉTT kontrollkort (Sir Sweeps v3 · ctl.*): tittel + stort tall, play/pause 64, stripe 10, to piller 52
      const top = P.includes('fremdrift'), btns = P.includes('knapper');
      if (top || btns) {
        let inner = '';
        if (top) {
          const p = cleaning || paused ? this._progress(m) : null;
          const title = cleaning || paused ? this._what(m) : returning ? 'Returnerer' : 'I dokken';
          const big = p ? (p.pct != null ? p.pct : '–') : m.bat != null ? m.bat : '–';
          const unit = p ? `% ferdig${p.left != null ? ` · ${p.left} min igjen` : ''}` : '% batteri';
          const w = p ? p.pct || 0 : m.bat != null ? M.clamp(m.bat, 0, 100) : 0;
          const ent = p ? (m.E.progress && this.s(m.E.progress) ? m.E.progress : m.E.vacuum) : m.E.battery && this.s(m.E.battery) ? m.E.battery : m.E.vacuum;
          inner += `<div class="ctl-top"><div class="ctl-l" data-ent="${esc(ent)}"><span class="ctl-t">${esc(title)}</span><span class="ctl-v"><span class="ctl-n num">${big}</span><span class="ctl-u">${esc(unit)}</span></span></div>
            <button class="ctl-pp" data-act="${cleaning ? 'pause' : paused || returning ? 'resume' : 'start'}" data-haptic="medium" aria-label="${cleaning ? 'Pause' : 'Start'}" style="background:${cleaning ? RED : GREEN};color:${ON_ACC}">${M.icon(cleaning ? 'mdi:pause' : 'mdi:play', 30)}</button></div>
            <div class="ctl-bar"><i class="${cleaning ? 'run' : paused ? 'pz' : ''}" style="width:${w}%"></i></div>`;
        }
        if (btns) {
          const es = m.E.empty && h.states[m.E.empty], emp = !!this.ui.emptying;
          inner += `<div class="ctl-btns"><button class="ctl-b hm" data-act="home" data-haptic="medium" style="background:${ORANGE};color:${ON_ACC}">${M.icon('mdi:home', 22)}<span>Returner hjem</span></button>
            <button class="ctl-b em ${es ? '' : 'off'} ${emp ? 'emptying' : ''}" data-act="empty" data-haptic="medium" ${es ? `data-ent="${esc(m.E.empty)}"` : 'aria-label="Tøm støvsuger – velg entitet"'} style="background:${LIGHT_PILL};color:${ON_ACC}">${M.icon('mdi:delete', 22)}<span>${emp ? 'Tømmer…' : 'Tøm støvsuger'}</span></button></div>`;
        }
        out.push(`<div class="ctl" data-key="ctl">${inner}</div>`);
      }
      // 47 L2: fliser for vifte og mopp – stor flis til venstre (2 rader) + to piller; trykk = neste valg, hold = more-info
      const fanOn = P.includes('vifte'), mopOn = P.includes('mopp'), intOn = P.includes('intensitet');
      if (fanOn || mopOn || intOn) {
        const pick = '<span class="kpick">Velg entitet</span>';
        let g = '';
        if (fanOn) {
          const f = this._fan(m), miss = f.kind === 'miss', i = Math.max(0, f.opts.indexOf(f.cur));
          const spin = cleaning && !(M.animOff && M.animOff()) ? `animation:vspin ${Math.max(0.5, 1.6 - Math.min(i, 3) * 0.35).toFixed(2)}s linear infinite` : '';
          g += `<button class="kfan tp ${miss ? 'miss' : ''} ${fanOn && (mopOn || intOn) ? '' : 'solo'}" data-act="fannext" ${miss ? '' : `data-ent="${esc(m.E.vacuum)}"`} data-haptic="selection" aria-label="Viftehastighet: ${esc(miss ? 'velg entitet' : nbOpt(f.cur))}">
            <span class="kl">Viftehastighet</span><span class="kic">${M.icon('mdi:fan', 22, spin)}</span><span class="kv">${esc(f.cur != null ? nbOpt(f.cur) : '–')}</span>${miss ? pick : ''}</button>`;
        }
        [['mopp', 'mop', 'Mopp modus', 'mdi:broom'], ['intensitet', 'mop_intensity', 'Mopp intensitet', 'mdi:tune-variant']].forEach(([p, k, label, icon]) => {
          if (!P.includes(p)) return;
          const o = this._opt(m.E[k]), miss = !!o.miss;
          g += `<button class="kpill tp ${miss ? 'miss' : ''}" data-act="optnext" data-k="${k}" ${miss ? '' : `data-ent="${esc(o.id)}"`} data-haptic="selection" aria-label="${esc(label)}: ${esc(miss ? 'velg entitet' : nbOpt(o.cur))}">
            <span class="kic">${M.icon(icon, 22)}</span><span class="ktx"><span class="kv2">${esc(!miss && o.cur != null ? nbOpt(o.cur) : '–')}</span><span class="kl2">${esc(label)}${miss ? ' · Velg entitet' : ''}</span></span></button>`;
        });
        out.push(`<div class="kset ${fanOn && (mopOn || intOn) ? '' : 'one'}">${g}</div>`);
      }
      return out.join('');
    }
    // Trykk-animasjon (scale .97) på flisene – også ved raske trykk der :active ikke rekker å vises
    _tapAnim(el) { try { if (el && el.animate && !(M.animOff && M.animOff())) el.animate([{ transform: 'scale(1)' }, { transform: 'scale(.97)' }, { transform: 'scale(1)' }], { duration: 220, easing: 'ease-out' }); } catch (e) { /* */ } }

    /* ---------------------------------------------------------- Info */
    _t_info(m) {
      const P = this._parts('info'), out = [], h = this.hass;
      if (P.includes('totalt')) {
        // 47 J: prosa (som prosa-kortet på Hjem) i stedet for to statistikkort – rett på popup-flaten
        const as = this.s(m.E.area), a = as && M.isNum(as.state) ? Number(as.state) : null;
        const mins = minutesOf(this.s(m.E.time));
        const name = this.config.name || (m.vs ? M.name(h, m.E.vacuum) : 'Støvsugeren');
        const chip = (txt, ent) => `<span class="pchip num"${ent ? ` data-ent="${esc(ent)}"` : ''}>${esc(txt)}</span>`;
        const fb = a != null ? (a / FOTBALL).toFixed(1).replace('.', ',') : null;
        out.push(`<p class="prose" data-key="prose">${esc(name)} har vasket ${chip(a != null ? Math.round(a) + ' m²' : '–', as ? m.E.area : null)} som tilsvarer ca <span class="nw">${chip(fb != null ? fb + (fb === '1,0' ? ' fotballbane' : ' fotballbaner') : '–', as ? m.E.area : null)},</span> det har han brukt mer enn ${chip(dagerOgTimer(mins), this.s(m.E.time) ? m.E.time : null)} på til sammen.</p>`);
        if (a == null || mins == null) out.push(`<div class="ppick"><button class="pick press" data-act="customize" data-section="ent-info_og_vedlikehold">${M.icon('mdi:plus', 18)}Velg entitet</button></div>`);
      }
      if (P.includes('vedlikehold')) {
        const rows = PARTS_V.map(([k, label, icon]) => {
          const id = m.E[k], hrs = hoursOf(this.s(id)), low = hrs != null && hrs <= LOW_H, rb = m.E['reset_' + k];
          const pct = hrs != null ? M.clamp(hrs / 300, 0, 1) * 100 : 0;
          return `<div class="vrow ${low ? 'low' : ''}" ${id ? `data-ent="${esc(id)}"` : ''}><span class="vi">${M.icon(icon, 20)}</span><span class="grow"><b>${esc(label)}</b><span class="num">${hrs != null ? Math.round(hrs) + ' timer igjen' : '–'}</span><span class="vb"><i style="width:${pct.toFixed(1)}%"></i></span></span>
            ${low && rb && h.states[rb] ? `<button class="rs press" data-act="reset" data-id="${esc(rb)}">Nullstill</button>` : ''}</div>`;
        }).join('');
        out.push(`<div class="sh"><span class="st">Vedlikehold</span></div><div class="card vlist">${rows}</div>`);
      }
      return out.join('');
    }

    /* ---------------------------------------------------------- Kart */
    // Fiks 26.12: kartflaten kan panoreres (én finger/mus), pinch-zoomes (to fingre), dobbelttrykkes (zoom inn /
    // tilbakestill) og hjul-zoomes (PC), 1–4×. Transformen ligger i this._mv og tegnes inn i markupen, så hass-
    // oppdateringer (morph) aldri nullstiller den. Rom i kartet (rom-lag fra kartets attributter) velges med trykk uten drag.
    _t_kart(m) {
      const P = this._parts('kart'), out = [];
      if (P.includes('kart')) {
        const s = this.s(m.E.map), pic = s && s.attributes.entity_picture;
        const src = pic ? (this.hass.hassUrl && !/^(https?:|data:|blob:)/.test(pic) ? this.hass.hassUrl(pic) : pic) : '';
        if (!src) out.push(this._missing(m.E.map ? 'Kartet er ikke tilgjengelig' : 'Fant ikke noe kart (image.*)'));
        else {
          const ov = mapRooms(s, m.rooms), wh = ov.length ? this._mapWH(src) : null;
          const T = this._mv || { s: 1, x: 0, y: 0 }, zoomed = T.s > 1.01 || Math.abs(T.x) > 0.5 || Math.abs(T.y) > 0.5;
          const alt = esc(M.name(this.hass, m.E.map));
          const inner = wh ? `<svg class="mimg" viewBox="0 0 ${wh[0]} ${wh[1]}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${alt}"><image href="${esc(src)}" width="${wh[0]}" height="${wh[1]}"/>${ov.map((o) => `<rect class="mr ${this._isSel(o.room) ? 'on' : ''}" data-mroom data-k="${esc(o.room.key)}" x="${o.x.toFixed(1)}" y="${o.y.toFixed(1)}" width="${o.w.toFixed(1)}" height="${o.h.toFixed(1)}" rx="3" style="--rc:${esc(o.room.color)}"><title>${esc(o.room.name)}</title></rect>`).join('')}</svg>`
            : `<img src="${esc(src)}" alt="${alt}" draggable="false">`;
          out.push(`<div class="map" data-ki-island data-key="map" data-ent-map="${esc(m.E.map)}"><div class="mapin" style="transform:translate(${T.x}px, ${T.y}px) scale(${T.s})">${inner}</div>
            <button class="mreset press ${zoomed ? '' : 'hid'}" data-act="mapreset" aria-label="Tilbakestill visning" title="Tilbakestill visning" data-haptic="medium">${M.icon('mdi:fit-to-screen', 22)}</button></div>`);
        }
      }
      if (P.includes('forklaring') && m.rooms.length) out.push(`<div class="legend">${m.rooms.map((r) => { const on = this._isSel(r); return `<button class="lg press ${on ? 'on' : ''}" style="--rc:${esc(r.color)}" data-act="maproom" data-k="${esc(r.key)}" role="checkbox" aria-checked="${on}" data-haptic="selection"><i></i>${esc(r.name)}</button>`; }).join('')}</div>`);
      return out.join('');
    }
    // Bildestørrelsen trengs for rom-laget (bildets piksler). Lastes én gang per URL; tegner på nytt når den er kjent.
    _mapWH(src) {
      if (MAPWH.has(src)) return MAPWH.get(src);
      MAPWH.set(src, null);
      try { const im = new Image(); im.onload = () => { if (im.naturalWidth) { MAPWH.set(src, [im.naturalWidth, im.naturalHeight]); if (this.isConnected) this.update(); } }; im.src = src; } catch (e) { /* */ }
      return null;
    }
    _mapReset(anim) {
      this._mv = { s: 1, x: 0, y: 0 };
      const map = this.shadowRoot.querySelector('.map'), inn = map && map.querySelector('.mapin');
      if (inn) { if (anim && !(M.animOff && M.animOff())) { inn.style.transition = 'transform .25s cubic-bezier(.3,.8,.3,1)'; setTimeout(() => { inn.style.transition = ''; }, 280); } inn.style.transform = 'translate(0px, 0px) scale(1)'; }
      const rb = map && map.querySelector('.mreset'); if (rb) rb.classList.add('hid');
    }
    // Gester på kartflaten (Pointer Events). Idempotent per element; elementet overlever morph (data-key="map").
    _mapInit(map) {
      if (!map || map.__mv) return;
      map.__mv = true;
      const P = new Map();
      let g = null, dragged = false, down0 = null, lastTap = null, tapT = 0, raf = 0;
      const T = () => this._mv || (this._mv = { s: 1, x: 0, y: 0 });
      const box = () => { const r = map.getBoundingClientRect(), k = map.offsetWidth ? r.width / map.offsetWidth : 1; return { r, k, W: map.offsetWidth, H: map.offsetHeight }; };
      const loc = (e, b) => ({ x: (e.clientX - b.r.left) / b.k, y: (e.clientY - b.r.top) / b.k });
      const clampT = (t, b) => { t.s = M.clamp(t.s, 1, 4); t.x = M.clamp(t.x, b.W - b.W * t.s, 0); t.y = M.clamp(t.y, b.H - b.H * t.s, 0); return t; };
      const apply = () => {
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = 0;
          const t = T(), inn = map.querySelector('.mapin');
          if (inn) inn.style.transform = `translate(${t.x}px, ${t.y}px) scale(${t.s})`;
          const rb = map.querySelector('.mreset'); if (rb) rb.classList.toggle('hid', !(t.s > 1.01 || Math.abs(t.x) > 0.5 || Math.abs(t.y) > 0.5));
        });
      };
      const zoomAt = (p, s2, b) => { const t = T(); s2 = M.clamp(s2, 1, 4); t.x = p.x - ((p.x - t.x) * s2) / t.s; t.y = p.y - ((p.y - t.y) * s2) / t.s; t.s = s2; clampT(t, b); apply(); };
      const begin = () => {
        const b = box(), pts = [...P.values()], t = T();
        if (pts.length >= 2) { const a = loc(pts[0], b), c = loc(pts[1], b); dragged = true; g = { pinch: true, d0: Math.hypot(a.x - c.x, a.y - c.y) || 1, m0: { x: (a.x + c.x) / 2, y: (a.y + c.y) / 2 }, t0: { ...t }, b }; }
        else if (pts.length === 1) g = { p0: loc(pts[0], b), t0: { ...t }, b };
        else g = null;
      };
      const stop = (e) => e.stopPropagation();
      map.addEventListener('touchstart', stop, { passive: true });
      map.addEventListener('touchmove', (e) => { e.stopPropagation(); if (e.cancelable) e.preventDefault(); }, { passive: false });
      map.addEventListener('pointerdown', (e) => {
        if (e.target.closest && e.target.closest('.mreset')) return; // knappen får vanlig klikk
        e.stopPropagation();
        if (e.pointerType === 'mouse' && e.button) return;
        try { map.setPointerCapture(e.pointerId); } catch (x) { /* */ }
        if (!P.size) { dragged = false; down0 = { x: e.clientX, y: e.clientY }; }
        P.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
        begin();
      });
      map.addEventListener('pointermove', (e) => {
        if (!P.has(e.pointerId)) return;
        e.stopPropagation(); if (e.cancelable) e.preventDefault();
        P.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
        if (!g) return;
        const t = T(), b = g.b;
        if (g.pinch) {
          const pts = [...P.values()], a = loc(pts[0], b), c = loc(pts[1], b), d = Math.hypot(a.x - c.x, a.y - c.y), mm = { x: (a.x + c.x) / 2, y: (a.y + c.y) / 2 };
          const cx = (g.m0.x - g.t0.x) / g.t0.s, cy = (g.m0.y - g.t0.y) / g.t0.s; // kartpunktet under midtpunktet ved start
          t.s = M.clamp(g.t0.s * (d / g.d0), 1, 4); t.x = mm.x - cx * t.s; t.y = mm.y - cy * t.s;
        } else {
          if (!dragged && Math.hypot(e.clientX - down0.x, e.clientY - down0.y) >= 6) dragged = true;
          if (!dragged) return;
          const p = loc(e, b); t.x = g.t0.x + (p.x - g.p0.x); t.y = g.t0.y + (p.y - g.p0.y); t.s = g.t0.s;
        }
        clampT(t, b); apply();
      });
      const end = (e) => {
        if (!P.has(e.pointerId)) return;
        e.stopPropagation();
        P.delete(e.pointerId);
        if (P.size) { begin(); return; }
        g = null;
        if (e.type === 'pointerup' && !dragged) tap(e);
      };
      map.addEventListener('pointerup', end);
      map.addEventListener('pointercancel', end);
      map.addEventListener('lostpointercapture', (e) => { if (P.has(e.pointerId)) { P.delete(e.pointerId); if (P.size) begin(); else g = null; } });
      const tap = (e) => {
        const now = Date.now();
        if (lastTap && now - lastTap.t < 320 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30) {
          clearTimeout(tapT); lastTap = null;
          const b = box();
          if (T().s > 1.01) this._mapReset(true); else zoomAt(loc(e, b), 2, b);
          M.haptic('medium');
          return;
        }
        lastTap = { t: now, x: e.clientX, y: e.clientY };
        const R = this.shadowRoot, el = R.elementFromPoint ? R.elementFromPoint(e.clientX, e.clientY) : null, hit = el && el.closest ? el.closest('[data-mroom]') : null;
        if (!hit) return;
        const k = hit.dataset.k;
        clearTimeout(tapT);
        tapT = setTimeout(() => { if (!this.isConnected) return; M.haptic('selection'); this.onAction('maproom', { dataset: { k } }); }, 260); // venter på et mulig dobbelttrykk
      };
      map.addEventListener('wheel', (e) => { e.preventDefault(); e.stopPropagation(); const b = box(); zoomAt(loc(e, b), T().s * Math.exp(-e.deltaY * 0.0025), b); }, { passive: false });
      map.addEventListener('dblclick', (e) => { e.preventDefault(); e.stopPropagation(); });
    }

    afterRender() {
      const R = this.shadowRoot;
      // Fiks 28.13: fanelinjen – hold 400 ms + dra = omorganiser (tab_order), sideveis dra = Liquid Glass-valg
      if (M.tabRow) M.tabRow(this, R.querySelector('.top>.tabs'), { active: () => this.tab, order: () => tabOrder(this.config), field: 'tab_order' });
      // Sone-chips: vannrett scroll skal aldri lukke/dra popupen (fallgruve 2)
      const z = R.querySelector('.zones');
      this._mapInit(R.querySelector('.map'));
      if (z && !z.__vz) { z.__vz = true; const stop = (e) => e.stopPropagation(); ['touchstart', 'touchmove', 'pointerdown', 'pointermove'].forEach((t) => z.addEventListener(t, stop, { passive: true })); }
    }
    get styles() {
      return `
        :host{display:block;width:100%}
        .wrap{display:flex;flex-direction:column;gap:var(--msh-gap,8px)}
        .pane{display:flex;flex-direction:column;gap:var(--msh-gap,8px);min-width:0}
        .hero{position:relative;height:200px;border-radius:28px;overflow:hidden;background:radial-gradient(120% 90% at 18% 0%,rgba(255,255,255,.07) 0%,rgba(255,255,255,0) 60%),var(--ki-surface, #333333);box-shadow:${C.edge}} /* ki-hex-ok: lysrefleks (hvit i begge moduser) */
        .scw{position:absolute;right:6px;top:6px;bottom:6px;width:min(50%,173px);border-radius:22px;overflow:hidden;box-shadow:inset 0 0 0 1px rgba(255,255,255,.06)} /* ki-hex-ok: robot-scene/kartbilde (mørk øy) */
        .scene{display:block;width:100%;height:100%}
        .zone{fill:${C.purple};fill-opacity:.32;stroke:${C.purple};stroke-opacity:.7;stroke-width:1.2;stroke-dasharray:4 3}
        .trail{fill:none;stroke:rgba(255,255,255,.16);stroke-width:20;stroke-linecap:round;stroke-linejoin:round} /* ki-hex-ok: robot-scene/kartbilde (mørk øy) */
        .homep{fill:none;stroke:rgba(242,181,115,.55);stroke-width:2;stroke-dasharray:4 5}
        .led{fill:${C.blue}}
        .bot.cleaning .led{fill:${C.green}}
        .bot.returning .led,.bot.paused .led{fill:${C.orange}}
        .err{fill:none;stroke:${C.red};stroke-width:2.5;animation:vblink 1s steps(2) infinite}
        .dl{fill:#545454}.dl.on{fill:${C.green};animation:vpulse 1.6s ease-in-out infinite} /* ki-hex-ok: robot-scene/kartbilde (mørk øy) */
        .bolt{animation:vpulse 1.6s ease-in-out infinite}
        @keyframes vpulse{0%,100%{opacity:1}50%{opacity:.35}}
        @keyframes vblink{0%{opacity:1}100%{opacity:0}}
        @media (prefers-reduced-motion: reduce){.dl.on,.bolt,.err{animation:none}}
        .hl{position:relative;z-index:1;display:flex;flex-direction:column;align-items:flex-start;gap:8px;padding:18px 10px 18px 18px;height:100%;width:calc(100% - min(50%,173px) - 6px);box-sizing:border-box;min-width:0}
        .hn{font-size:15px;color:var(--ki-text-2, var(--gray800,#afafaf));white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
        .spill{display:inline-flex;align-items:center;gap:5px;height:28px;padding:0 11px 0 8px;border-radius:14px;background:color-mix(in srgb, var(--tc) calc(16% * var(--ki-tone-k, 1)), ${WA(0.06)});color:var(--tcx, var(--tc));font-size:13px;font-weight:500;white-space:nowrap;max-width:100%;overflow:hidden}
        .spill span{overflow:hidden;text-overflow:ellipsis}
        .batw{margin-top:auto;display:flex;flex-direction:column;gap:4px;width:100%}
        .bat{display:flex;align-items:baseline;gap:2px}
        .bv{font-size:44px;font-weight:300;line-height:1}
        .bu{font-size:20px;color:var(--ki-text-mid, var(--gray700,#979797))}
        .bl{font-size:13px;color:var(--ki-text-mid, var(--gray700,#979797))}
        .bbar{display:block;width:100%;max-width:120px;height:4px;border-radius:2px;background:${WA(0.1)};overflow:hidden;margin-top:2px}
        .bbar i{display:block;height:100%;border-radius:2px;background:${C.green}}
        .tank{display:flex;align-items:center;gap:12px;padding:6px 8px 6px 6px;border-radius:32px;background:${C.red};color:#2c1411}
        .ti{width:56px;height:56px;border-radius:28px;display:grid;place-items:center;background:${BA(0.1)};flex:none;animation:vdrip 1.4s ease-in-out infinite}
        @keyframes vdrip{0%,100%{transform:translateY(0)}50%{transform:translateY(2px)}}
        .tt{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}.tt b{font-size:15px;font-weight:600}.tt span{font-size:12px;opacity:.8}
        .tb{height:40px;padding:0 14px;border-radius:20px;background:${BA(0.12)};display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:600;flex:none}
        .top{display:flex;align-items:center;gap:8px;min-width:0}
        .tabs{flex:1;min-width:0;display:flex;gap:2px;padding:4px;height:calc(${TV('th', 40)} + 8px);box-sizing:border-box;border-radius:calc(${TV('th', 40)} / 2 + 4px);background:var(--ki-surface-3, var(--gray200,#3a3a3a));position:relative;touch-action:pan-y;overflow:hidden;${M.tabSurface ? M.tabSurface('var(--ki-surface-3, var(--gray200,#3a3a3a))') : ''}}
        .tabs.names{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr)}
        .tabs .itab{color:var(--ki-text-2, var(--gray800,#afafaf));background:transparent}
        .tabs .itab.on,.tabs .ntab.on{background:${C.accent};color:var(--ki-on-accent, #2a1720);font-weight:500}
        ${M.iconTabs.css('.tabs.itabs')}
        /* 33.4: fanehøyde (MSH.tabH) – pille H (40), sporet og tannhjulet H + 8 */
        .tabs.itabs>.itab{height:${TV('th', 40)};border-radius:calc(${TV('th', 40)} / 2)}
        .tabs.itabs>.itab ha-icon{--mdc-icon-size:${TV('ti', 20)} !important;width:${TV('ti', 20)} !important;height:${TV('ti', 20)} !important}
        .ntab{min-width:0;width:100%;height:${TV('th', 40)};padding:0 ${TV('tp', 6)};border-radius:calc(${TV('th', 40)} / 2);font-size:${TV('tf', 14)};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--ki-text-2, var(--gray800,#afafaf))}
        .gear{width:calc(${TV('th', 40)} + 8px);height:calc(${TV('th', 40)} + 8px);border-radius:calc(${TV('th', 40)} / 2 + 4px);display:grid;place-items:center;background:var(--ki-surface, var(--gray200,#3a3a3a));flex:none;box-shadow:${C.edge}}
        .sh{display:flex;align-items:center;gap:8px;min-height:40px;padding:0 4px}
        .st{flex:1;font-size:18px;font-weight:500}
        .meta{font-size:13px;color:var(--ki-text-mid, var(--gray700,#979797));margin-left:auto}
        .lnk{height:32px;padding:0 4px;background:none;font-size:14px;font-weight:500;color:var(--ki-text, var(--white,#fafafa))}
        .rcard{display:flex;flex-direction:column;gap:12px;padding:14px 14px 16px;border-radius:28px;background:var(--ki-surface, var(--gray200,#3a3a3a));box-shadow:${C.edge}}
        .rch{display:flex;align-items:center;gap:8px;padding:0 4px;min-height:32px}
        .rct{flex:1;min-width:0;font-size:15px;color:var(--ki-text-2, var(--gray800,#afafaf));white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .rgrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));grid-auto-rows:minmax(84px,auto);gap:8px}
        .rt{position:relative;display:flex;flex-direction:column;align-items:flex-start;justify-content:space-between;padding:12px;border-radius:20px;text-align:left;min-width:0;overflow:hidden;
          background:color-mix(in srgb, var(--rc) 25%, var(--ki-surface, #3a3a3a));box-shadow:inset 0 0 0 1px color-mix(in srgb, var(--rc) 35%, transparent);transition:background .2s,box-shadow .2s}
        .rt.big{min-height:104px}
        .rt .ri{display:grid;place-items:center;color:var(--rcx, var(--rc));height:18px}
        .rtx{display:flex;flex-direction:column;gap:2px;min-width:0;max-width:100%}
        .rn{font-size:16px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
        .rm{font-size:12px;color:var(--ki-text-2, var(--gray800,#afafaf))}
        .rt.on{background:color-mix(in srgb, var(--rc) 55%, var(--ki-surface, #3a3a3a));box-shadow:inset 0 0 0 2px var(--ki-text, #fafafa)}
        .rt.on .ri{color:var(--ki-text, #fafafa)}
        .rt.on .rm{color:var(--ki-text-1, var(--gray900,#c7c7c7))}
        .sum{padding:0 4px;font-size:13px;color:var(--ki-text-2, var(--gray800,#afafaf))}
        /* 47 H/L1 · «Støvsug alt» (big.wrap/cell/robot/dot): pille 64 (padding 6, radius 32, gap 14), sirkel 52 mørk grønn,
           ring 30 (3 px) + prikk 9 i pillefargen, tittel 16/600, undertekst 12 · .75. Fargene står inline (se _bigPill). */
        .sw{display:flex;align-items:center;gap:14px;min-height:64px;padding:6px;border-radius:32px;transition:background .2s;box-sizing:border-box}
        .swb{flex:1;min-width:0;display:flex;align-items:center;gap:14px;text-align:left;color:inherit;background:none;padding:0;border-radius:26px}
        .swb[disabled]{opacity:.4;cursor:default}
        .sw-cell{width:52px;height:52px;flex:none;border-radius:26px;display:grid;place-items:center;box-shadow:inset 0 0 0 1px rgb(0 0 0 / .08);opacity:1;filter:none;mix-blend-mode:normal;transition:background .2s}
        .sw-ring{width:30px;height:30px;border-radius:50%;border:3px solid;box-sizing:border-box;display:flex;align-items:center;justify-content:center;opacity:1;filter:none}
        .sw-dot{width:9px;height:9px;border-radius:50%;flex:none;opacity:1;transition:transform .3s}
        .sw.run .sw-ring{animation:vspin 1.2s linear infinite}
        .sw.run .sw-dot{transform:translateX(5px)} /* prikken går i bane når ringen roterer */
        @keyframes vspin{to{transform:rotate(360deg)}}
        .sw-tx{display:flex;flex-direction:column;min-width:0}
        .sw-t{font-size:16px;font-weight:600;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .sw-s{font-size:12px;opacity:.75;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .sw-ctl{display:flex;gap:6px;margin-right:6px;flex:none}
        .sw-cb{width:44px;height:44px;border-radius:22px;background:rgb(0 0 0 / .1);display:grid;place-items:center;color:inherit}
        .sw ha-icon,.ctl-pp ha-icon,.ctl-b ha-icon{--icon-primary-color:currentColor;color:inherit}
        /* 47 L3 · Soner: overskrift 13 #979797, piller 60 (radius 30, padding 0 22 0 18), ikon 22 + navn 16/500 */
        .zsec{display:flex;flex-direction:column;gap:8px;min-width:0}
        .zh{padding:0 6px;font-size:13px;color:var(--ki-text-mid, var(--gray700,#979797))}
        .zones{display:flex;gap:8px;overflow-x:auto;touch-action:pan-x;overscroll-behavior-x:contain;scrollbar-width:none;padding-bottom:2px}
        .zones::-webkit-scrollbar{display:none}
        .zc{flex:none;height:60px;padding:0 22px 0 18px;border-radius:30px;background:var(--ki-surface, var(--gray200,#3a3a3a));color:var(--ki-text, #fafafa);display:inline-flex;align-items:center;gap:10px;font-size:16px;font-weight:500;white-space:nowrap}
        .zend{flex:none;width:1px}
        /* 47 I · Kontroll: ÉTT kort (radius 28, padding 18, gap 14) */
        .ctl{display:flex;flex-direction:column;gap:14px;padding:18px;border-radius:28px;background:var(--ki-surface, var(--gray200,#3a3a3a))}
        .ctl-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
        .ctl-l{display:flex;flex-direction:column;gap:2px;min-width:0}
        .ctl-t{font-size:13px;color:var(--ki-text-2, var(--gray800,#afafaf));white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .ctl-v{display:flex;align-items:baseline;gap:4px;min-width:0}
        .ctl-n{font-size:40px;font-weight:300;line-height:1.1}
        .ctl-u{font-size:13px;color:var(--ki-text-2, var(--gray800,#afafaf));white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .ctl-pp{width:64px;height:64px;flex:none;border-radius:32px;display:grid;place-items:center;transition:background .2s,transform .12s}
        .ctl-pp:active{transform:scale(.94)}
        .ctl-bar{height:10px;border-radius:5px;background:var(--ki-surface-3, #282828);overflow:hidden}
        .ctl-bar i{display:block;height:100%;border-radius:5px;background:${GREEN};transition:width .4s}
        .ctl-bar i.run{background:repeating-linear-gradient(135deg,${GREEN} 0 8px,#8ee0b2 8px 14px);background-size:28px 100%;animation:vsweep .8s linear infinite} /* ki-hex-ok: designets stripe (lys grønn) */
        .ctl-bar i.pz{background:${ORANGE}}
        @keyframes vsweep{from{background-position:0 0}to{background-position:28px 0}}
        .ctl-btns{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
        .ctl-b{height:52px;border-radius:26px;display:flex;align-items:center;justify-content:center;gap:8px;font-size:14px;font-weight:600;min-width:0;white-space:nowrap;transition:transform .12s}
        .ctl-b span{overflow:hidden;text-overflow:ellipsis}
        .ctl-b:active{transform:scale(.97)}
        .ctl-b.off{opacity:.5}
        .ctl-b.emptying ha-icon{animation:vempty .6s ease-in-out infinite}
        @keyframes vempty{0%,100%{transform:rotate(0)}25%{transform:rotate(-14deg)}75%{transform:rotate(14deg)}}
        /* 47 L2 · vifte/mopp: stor flis (2 rader, min 124) + to piller (min 58, radius 29) */
        .kset{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px}
        .kset.one{grid-template-columns:minmax(0,1fr)}
        .tp{transition:transform .12s;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
        .tp:active{transform:scale(.97)}
        .kfan{grid-row:1 / 3;position:relative;min-height:124px;border-radius:24px;background:var(--ki-surface, var(--gray200,#3a3a3a));text-align:left;padding:14px 14px 12px;display:flex;flex-direction:column;justify-content:space-between;min-width:0}
        .kfan.solo{grid-row:auto}
        .kl{font-size:12px;color:var(--ki-text-2, var(--gray800,#afafaf));padding-top:10px;padding-right:56px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .kic{width:50px;height:50px;border-radius:25px;flex:none;display:grid;place-items:center;background:var(--ki-surface-2, var(--gray300,#404040));color:var(--ki-text, #fafafa)}
        .kfan .kic{position:absolute;top:4px;right:4px}
        .kv{font-size:28px;font-weight:300;letter-spacing:-0.01em;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .kpill{display:flex;align-items:center;gap:12px;min-height:58px;padding:4px 14px 4px 4px;border-radius:29px;background:var(--ki-surface, var(--gray200,#3a3a3a));text-align:left;min-width:0}
        .ktx{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
        .kv2{font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .kl2{font-size:13px;color:var(--ki-text-2, var(--gray800,#afafaf));white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .tp.miss .kv,.tp.miss .kv2{color:var(--ki-text-3, var(--gray600,#7f7f7f))}
        .tp.miss .kic{opacity:.6}
        .kpick{position:absolute;left:14px;bottom:44px;font-size:12px;color:var(--ki-text-3, var(--gray600,#7f7f7f))}
        /* 47 J · Info: prosa 21/500, linjehøyde 1.95, chips 36 (radius 18, padding 0 14) – som prosa-kortet på Hjem */
        .prose{margin:0;padding:6px 6px 10px;font-size:21px;font-weight:500;line-height:1.95;letter-spacing:-0.01em;color:var(--ki-text, #fafafa);text-wrap:pretty}
        .pchip{display:inline-flex;align-items:center;height:36px;padding:0 14px;border-radius:18px;background:var(--ki-surface, #fafafa);color:var(--ki-text, #232323);box-shadow:var(--ki-pill-sh, none);font-weight:600;vertical-align:middle;white-space:nowrap;font-variant-numeric:tabular-nums;margin:3px 0}
        .prose .nw{white-space:nowrap}
        .ppick{display:flex;justify-content:flex-start;padding:0 6px}
        .miss{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:8px;padding:22px 16px;border-radius:24px;background:var(--ki-surface, var(--gray200,#3a3a3a));color:var(--ki-text-mid, var(--gray700,#979797));font-size:14px}
        .miss .mdash{font-size:22px;color:var(--ki-text, var(--white,#fafafa))}
        .miss .mt{flex-basis:100%;text-align:center;font-size:12px}
        .pick{height:36px;padding:0 14px 0 10px;border-radius:18px;background:var(--ki-surface-2, var(--gray300,#404040));display:inline-flex;align-items:center;gap:6px;font-size:13px;color:var(--ki-text, var(--white,#fafafa))}
        .grow{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}.grow b{font-size:14px;font-weight:500}.grow>span{font-size:12px;color:var(--ki-text-mid, var(--gray700,#979797))}
        .vlist{padding:4px}
        .vrow{display:flex;align-items:center;gap:12px;min-height:64px;padding:8px 12px;border-radius:20px}
        .vrow+.vrow{box-shadow:inset 0 1px 0 ${WA(0.05)}}
        .vi{width:40px;height:40px;border-radius:20px;display:grid;place-items:center;background:var(--ki-surface-2, var(--gray300,#404040));flex:none}
        .vb{display:block;height:4px;border-radius:2px;background:var(--ki-surface-3, var(--gray300,#404040));overflow:hidden;margin-top:4px}.vb i{display:block;height:100%;background:${C.green}}
        .vrow.low .vi{background:color-mix(in srgb, ${C.orange} calc(22% * var(--ki-tone-k, 1)), transparent);color:${AT(C.orange)}}
        .vrow.low .grow .num{color:${AT(C.orange)}}.vrow.low .vb i{background:${C.orange}}
        .rs{height:36px;padding:0 14px;border-radius:18px;background:${C.orange};color:#2d1f0c;font-size:13px;font-weight:600;flex:none}
        .map{position:relative;border-radius:24px;overflow:hidden;background:var(--gray200,#3a3a3a);aspect-ratio:3/4;touch-action:none;overscroll-behavior:contain;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;cursor:grab} /* ki-hex-ok: robot-scene/kartbilde (mørk øy) */
        .map:active{cursor:grabbing}
        .mapin{position:absolute;inset:0;transform-origin:0 0;will-change:transform;display:grid;place-items:center}
        .mapin img,.mapin .mimg{width:100%;height:100%;object-fit:contain;display:block;pointer-events:none;-webkit-user-drag:none}
        .mapin .mimg .mr{pointer-events:auto;fill:var(--rc);fill-opacity:.18;stroke:var(--rc);stroke-opacity:.6;stroke-width:1.5;vector-effect:non-scaling-stroke;cursor:pointer}
        .mapin .mimg .mr.on{fill-opacity:.45;stroke:#fafafa;stroke-opacity:1;stroke-width:2} /* ki-hex-ok: robot-scene/kartbilde (mørk øy) */
        .mreset{position:absolute;top:10px;right:10px;z-index:2;width:44px;height:44px;border-radius:22px;display:grid;place-items:center;background:rgba(40,40,40,.78);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);color:#fafafa;box-shadow:${C.edge};transition:opacity .2s,transform .2s} /* ki-hex-ok: robot-scene/kartbilde (mørk øy) */
        .mreset.hid{opacity:0;transform:scale(.8);pointer-events:none}
        .legend{display:flex;flex-wrap:wrap;gap:6px}
        .legend .lg{height:36px;padding:0 14px 0 10px;border-radius:18px;background:var(--ki-surface, var(--gray200,#3a3a3a));display:inline-flex;align-items:center;gap:8px;font-size:13px}
        .legend .lg i{width:12px;height:12px;border-radius:6px;background:var(--rc)}
        .legend .lg.on{background:var(--rc);color:var(--ki-on-accent, #232323)}.legend .lg.on i{background:var(--ki-on-accent, #232323)}
      `;
    }
  }

  /* ------------------------------------------------------------ popup-registrering (#rolf) */
  // Bubble-headerens sub_button: støvsugerens state + batteri (som dagens #rolf). vacuum.rolf når den finnes, ellers kortets.
  function subButton(card) {
    const h = M.lastHass || (document.querySelector('home-assistant') || {}).hass || null;
    const own = card && card.entities && card.entities.vacuum;
    const id = (has(h, 'vacuum.rolf') && 'vacuum.rolf') || own || (h ? vacOf(h, card || {}) : null) || DEF_ENT.vacuum;
    return { main: [{ show_background: false, entity: id, icon: 'mdi:none', state_content: ['state', 'battery_level'] }], bottom: [] };
  }
  const isOurs = (cfg) => cfg && Array.isArray(cfg.cards) && cfg.cards.find((c) => c && String(c.type || '').replace(/^custom:/, '') === TAG);
  M.POPUP_LOOK = M.POPUP_LOOK || {};
  Object.defineProperty(M.POPUP_LOOK, HASH, { configurable: true, enumerable: true, get: () => ({ sub_button: subButton(null) }) });
  M.POPUP_FORCE = M.POPUP_FORCE || {};
  M.POPUP_FORCE[HASH] = (cfg) => {
    const card = isOurs(cfg);
    if (!card) return null;
    const sb = cfg.sub_button, main = sb && (Array.isArray(sb) ? sb : sb.main);
    if (Array.isArray(main) && main.length) return null; // brukerens egen sub_button beholdes
    return { ...cfg, sub_button: subButton(card) };
  };
  M.popupNeeds = M.popupNeeds || {};
  M.popupNeeds[HASH] = (hass) => M.all(hass, 'vacuum').length > 0;
  // Den importerte #rolf-popupen (ki-robot-card …) erstattes av den genererte – til brukeren velger «Bruk egen»
  const legacy = (o, d = 0) => { if (!o || typeof o !== 'object' || d > 30) return false; if (Array.isArray(o)) return o.some((x) => legacy(x, d + 1)); if (o.type === 'custom:ki-robot-card' && (o.modell === 'stovsuger' || /^vacuum\./.test(String(o.entity || '')))) return true; return Object.keys(o).some((k) => o[k] && typeof o[k] === 'object' && legacy(o[k], d + 1)); };
  M.POPUP_SUPERSEDE = M.POPUP_SUPERSEDE || {};
  M.POPUP_SUPERSEDE[HASH] = { name: 'Sir Sweeps', test: (cfg) => legacy(cfg) };
  M.POPUP_CARDS = M.POPUP_CARDS || [];
  if (!M.POPUP_CARDS.includes(TAG)) M.POPUP_CARDS.push(TAG); // «Mellomrom» ligger i Avansert
  M.stovsuger = { entsOf, roomsOf, zonesOf, minutesOf, hoursOf, dagerTimer, dagerOgTimer, segsOf, nbOpt, mopSel, DEF_ENT };
  M.define(TAG, Stovsuger, 'MSH Sir Sweeps', 'Støvsuger-popup (#rolf): animert robot, rom, soner, kontroll, vedlikehold og kart.');
})();
