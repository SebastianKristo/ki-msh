/* KI MSH · Sir Sweeps (#rolf, msh-stovsuger-card) – fiks 24.9, etter «Sir Sweeps v3» (prompt-teksten; designfilen finnes ikke).
 * Étt kort i Bubble-popupen #rolf (mal A). Bubble eier headeren (navn, ikon, lukk) og beholder sub_button med
 * støvsugerens state + batteri (M.POPUP_LOOK/M.POPUP_FORCE['#rolf'] under). Erstatter den importerte #rolf-popupen
 * (ki-robot-card + button-card-grid + ki-tabs-card + paper-buttons-row): «Erstattet av Sir Sweeps» (MSH.POPUP_SUPERSEDE).
 *
 * Innhold i rekkefølge: toppkort 200 px (status-pille, batteri 44 px, animert robot på gulvet – rute ved rengjøring,
 *   hjem ved retur, lyn i dokken ved lading) · varsel «Vanntanken er tom» (rød, bare når tank = on, med «Tøm») ·
 *   faner (Renhold · Kontroll · Info · Kart, MSH.iconTabs, Liquid Glass-drag) + tannhjul (→ «Tilpass») ·
 *   Renhold: romgrid (plass 1–2 store 2×2, 3–5 nederst; farge per rom, trykk velger, Velg alle/Fjern alle, sum m² og
 *     estimert tid) → stor grønn «Støvsug alt/valgte rom», pause/fortsett + hjem når aktiv · Soner (vannrette chips,
 *     touch-action pan-x + stopPropagation).
 *   Kontroll: fremdrift %/min igjen, play/pause, «Returner hjem», «Tøm støvsuger», segmenter for vifte/moppmodus/-intensitet.
 *   Info: vasket totalt (m², ÷ 7140 = fotballbaner) / tid brukt (dager + timer) · vedlikehold (timer igjen per del,
 *     oransje + «Nullstill» ≤ 30 t → button.*_nullstill_* / *_reset_*).
 *   Kart: image.*-entiteten (3:4) + romforklaring (trykk velger rom).
 * «Tilpass» (msh-editor, samme skjema som GUI-editoren, MSH.draftEditor/Ferdig): Rom · Faner · Entiteter · Avansert.
 *
 * Standard-entitetene (DEF_ENT/DEF_ROOMS/DEF_ZONES) er brukerens faktiske oppsett fra dagens #rolf-YAML – brukt i
 * getStubConfig og i autokonfig når de finnes i HA (samme unntak som 17.9). Ellers autofunn via støvsugerens prefiks
 * (vacuum.<obj> → sensor.<obj>_battery …), rom fra input_boolean.<obj>_* eller robotens segmenter (attributtet rooms),
 * soner fra script.*_zone_*. Alt kan overstyres i «Entiteter»; mangler noe vises «–» + «Velg entitet». Ingen mock-data.
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
  const TABL = Object.fromEntries(TABS.map((t) => [t[0], t]));
  const PARTS = {
    renhold: [['rom', 'Romgrid'], ['start', 'Start-knapp'], ['soner', 'Soner']],
    kontroll: [['fremdrift', 'Fremdrift'], ['knapper', 'Knapper'], ['vifte', 'Vifte'], ['mopp', 'Moppmodus'], ['intensitet', 'Moppintensitet']],
    info: [['totalt', 'Vasket totalt'], ['vedlikehold', 'Vedlikehold']],
    kart: [['kart', 'Kart'], ['forklaring', 'Romforklaring']],
  };
  const PAL = [C.blue, C.green, C.orange, C.purple, C.yellow, C.pink, C.red, C.lime, C.lightBlue];
  const FOTBALL = 7140; // m² per fotballbane
  const LOW_H = 30; // vedlikehold: oransje + «Nullstill» ≤ 30 t

  // Brukerens oppsett (dagens #rolf-YAML) – standard i getStubConfig og i autokonfig når de finnes (unntak som 17.9)
  const DEF_ENT = {
    vacuum: 'vacuum.sir_sweeps_a_lot', battery: 'sensor.sir_sweeps_a_lot_battery', charging: 'binary_sensor.sir_sweeps_a_lot_charging',
    tank: 'binary_sensor.sir_sweeps_a_lot_water_shortage', map: 'image.sir_sweeps_a_lot_hjemme_andre_etasje',
    all: 'sensor.rolf_all', start: 'script.start_sir_sweeps_a_lot_room_select', pause: 'script.stovsuger_pause', resume: 'script.stovsuger_start',
    home: 'script.stovsuger_retuner_hjem', empty: 'script.rolf_empty', fan_script: 'script.cycle_vacuum_fan_speed', mop: 'input_select.vacuum_fan_speed',
    area: 'sensor.sir_sweeps_a_lot_total_cleaning_area', time: 'sensor.sir_sweeps_a_lot_total_cleaning_time',
    main_brush: 'sensor.sir_sweeps_a_lot_main_brush_time_left', side_brush: 'sensor.sir_sweeps_a_lot_side_brush_time_left',
    filter: 'sensor.sir_sweeps_a_lot_filter_time_left', sensor: 'sensor.sir_sweeps_a_lot_sensor_time_left',
  };
  const DEF_ROOMS = [['sebsatian_soverom', 'Soverom', 'mdi:bed-double-outline'], ['pappa_soverom', 'Pappa', 'mdi:bed-outline'], ['mamma_soverom', 'Mamma', 'mdi:bed-queen-outline'], ['pappa_kontor', 'Kontor', 'mdi:desk'], ['trappegang', 'Trapp', 'mdi:stairs']];
  const DEF_ZONES = [['rolf_zone_stuebord', 'Spisebord lite'], ['rolf_zone_stuebord_mye', 'Spisebord mye'], ['rolf_zone_stue_uten_spisebord', 'Stue uten spisebord'], ['rolf_zone_teppe', 'Teppe stue'], ['rolf_zone_kjokkenbord', 'Kjøkkenbord']];
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
    ['mop', 'Moppmodus', ['input_select', 'select'], 'Vifte og mopp', (o) => [`select.${o}_mop_mode`]],
    ['mop_intensity', 'Moppintensitet', ['select', 'input_select'], 'Vifte og mopp', (o) => [`select.${o}_mop_intensity`]],
    ['area', 'Vasket totalt (m²)', ['sensor'], 'Info og vedlikehold', (o) => [`sensor.${o}_total_cleaning_area`]],
    ['time', 'Tid brukt totalt', ['sensor'], 'Info og vedlikehold', (o) => [`sensor.${o}_total_cleaning_time`]],
    ...PARTS_V.map(([k, l]) => [k, l + ' (timer igjen)', ['sensor'], 'Info og vedlikehold', (o) => [`sensor.${o}_${k}_time_left`]]),
    ...PARTS_V.map(([k, l, , rx]) => ['reset_' + k, 'Nullstill ' + l.toLowerCase(), ['button'], 'Info og vedlikehold', (o, h) => resetAuto(h, o, rx)]),
  ];
  const ENTK = Object.fromEntries(ENT.map((e) => [e[0], e]));
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
    return (f(o, h) || []).find((id) => has(h, id)) || null;
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
    const push = (id, name) => { if (id == null || id === '') return; if (!out.some((x) => String(x.id) === String(id))) out.push({ id, name: String(name || 'Rom ' + id) }); };
    const walk = (v) => {
      if (Array.isArray(v)) v.forEach((x) => { if (x && typeof x === 'object') push(x.id != null ? x.id : x.segment_id, x.name || x.room_name); });
      else if (v && typeof v === 'object') Object.keys(v).forEach((k) => { const x = v[k]; if (Array.isArray(x)) walk(x); else if (typeof x === 'string') push(k, x); else if (x && typeof x === 'object' && (x.name || x.id != null)) push(x.id != null ? x.id : k, x.name); });
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
      segsOf(h.states[vac]).forEach((s) => { const k = 'seg_' + M.slug(String(s.id)); if (!out.has(k)) out.set(k, { key: k, segment: s.id, name: s.name, icon: 'mdi:floor-plan' }); });
    }
    Object.keys(cfg).forEach((k) => { const r = cfg[k]; if (!r || typeof r !== 'object' || out.has(k) || !(r.manual || r.entity || r.segment != null)) return; out.set(k, { key: k, entity: r.entity || null, segment: r.segment != null && r.segment !== '' ? r.segment : null, name: r.name || k, icon: 'mdi:floor-plan', manual: true }); });
    let i = 0;
    const L = [...out.values()].map((r) => { const x = cfg[r.key] || {}; const col = x.color || PAL[i % PAL.length]; i++; return { ...r, name: x.name || r.name, icon: x.icon || r.icon, color: col, hidden: !!x.hidden, m2: num(x.m2) }; });
    return orderBy(L, c.room_order);
  }
  function zonesOf(h, c) {
    const cfg = c.zones || {}, out = new Map(), D = DEF_ZONES.map((z) => z[0]);
    if (h) {
      const ids = Object.keys(h.states).filter((id) => /^script\.[a-z0-9_]*zone_[a-z0-9_]+$/.test(id));
      const di = (id) => { const i = D.indexOf(id.slice(7)); return i < 0 ? 99 : i; };
      ids.sort((a, b) => di(a) - di(b) || a.localeCompare(b)).forEach((id) => { const k = id.slice(7), d = DEF_ZONES.find((z) => z[0] === k); out.set(k, { key: k, entity: id, name: d ? d[1] : M.name(h, id) }); });
    }
    Object.keys(cfg).forEach((k) => { const z = cfg[k]; if (z && z.entity && !out.has(k)) out.set(k, { key: k, entity: z.entity, name: z.name || k, manual: true }); });
    return orderBy([...out.values()].map((z) => { const x = cfg[z.key] || {}; return { ...z, name: x.name || z.name, hidden: !!x.hidden }; }), c.zone_order);
  }
  const tabOrder = (c) => { const k = TABS.map((t) => t[0]); const o = (Array.isArray(c.tab_order) ? c.tab_order : []).filter((x) => k.includes(x)); k.forEach((x) => { if (!o.includes(x)) o.push(x); }); return o; };
  const tabHidden = (c) => new Set(Array.isArray(c.tab_hidden) ? c.tab_hidden : []);
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
  const STATUS = { cleaning: 'Rengjør', returning: 'På vei hjem', paused: 'Pauset', docked: 'I dokken', idle: 'Klar', error: 'Feil', unavailable: 'Utilgjengelig', unknown: '–' };
  const ACTIVE = ['cleaning', 'paused', 'returning'];

  /* ------------------------------------------------------------ robot-scenen (toppkortet) */
  const ROUTE = 'M92 150 H214 V126 H92 V102 H214 V78 H92 V54 H214 V32 H92';
  const HOME = 'M180 80 C150 96 110 120 92 162';
  const DOCK = [92, 168];
  function scene(mode, charging, animOff) {
    const floor = `<defs><pattern id="pl" width="40" height="12" patternUnits="userSpaceOnUse"><rect width="40" height="12" fill="#4a3f36"/><path d="M0 11.5H40M22 0V12" stroke="#3d332b" stroke-width="1"/></pattern>
        <radialGradient id="rg" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#cfd4da"/></radialGradient></defs>
      <rect x="72" y="14" width="160" height="176" rx="14" fill="url(#pl)"/>
      <ellipse cx="170" cy="120" rx="34" ry="22" fill="#5f5a6e" opacity=".55"/>
      <rect x="72" y="14" width="160" height="176" rx="14" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="2"/>
      <g class="dock"><rect x="${DOCK[0] - 12}" y="${DOCK[1] - 6}" width="24" height="20" rx="5" fill="#2a3038"/><rect x="${DOCK[0] - 7}" y="${DOCK[1] - 2}" width="14" height="3.5" rx="1.75" class="dl ${charging ? 'on' : ''}"/></g>`;
    const bot = (inner) => `<g class="bot ${mode}">${inner}<circle r="11" fill="url(#rg)"/><circle r="11" fill="none" stroke="#b8bec6" stroke-width=".8"/><path d="M6.5 -8.5 A11 11 0 0 1 6.5 8.5" fill="none" stroke="#2a3038" stroke-width="2.4"/><circle cx="-2" r="3.4" fill="#2a3038"/><circle cx="-2" r="1.4" class="led"/>${mode === 'error' ? '<circle r="15" class="err"/>' : ''}</g>`;
    let trail = '', robot = '';
    if (mode === 'cleaning' && !animOff) {
      trail = `<path class="trail" d="${ROUTE}" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100"><animate attributeName="stroke-dashoffset" from="100" to="0" dur="36s" repeatCount="indefinite"/></path>`;
      robot = bot(`<animateMotion dur="36s" repeatCount="indefinite" rotate="auto" path="${ROUTE}"/>`);
    } else if (mode === 'cleaning' || mode === 'paused') {
      trail = `<path class="trail" d="${ROUTE}" pathLength="100" stroke-dasharray="100" stroke-dashoffset="52"/>`;
      robot = `<g transform="translate(214 90) rotate(90)">${bot('')}</g>`;
    } else if (mode === 'returning' && !animOff) {
      trail = `<path class="homep" d="${HOME}"/>`;
      robot = bot(`<animateMotion dur="5s" repeatCount="indefinite" rotate="auto" path="${HOME}"/>`);
    } else if (mode === 'returning') {
      trail = `<path class="homep" d="${HOME}"/>`;
      robot = `<g transform="translate(130 112)">${bot('')}</g>`;
    } else {
      robot = `<g transform="translate(${DOCK[0]} ${DOCK[1] - 14}) rotate(-90)">${bot('')}</g>`;
    }
    const bolt = charging ? `<g class="bolt" transform="translate(${DOCK[0] + 20} ${DOCK[1] - 30})"><circle r="10" fill="rgba(102,209,158,.22)"/><path d="M1.5 -7 L-4.5 1 H-0.5 L-1.5 7 L4.5 -1 H0.5 Z" fill="${C.green}"/></g>` : '';
    return `<svg class="scene" viewBox="60 0 184 200" preserveAspectRatio="xMaxYMid meet" aria-hidden="true">${floor}${trail}${robot}${bolt}</svg>`;
  }

  /* ------------------------------------------------------------ editor (Tilpass + GUI-editoren) */
  const cid = (ed) => ((ed && ed._config && ed._config.card_id) || '_');
  const EXP = new Map(), ADD = new Set();
  const hdl = (list) => `<span data-edrag="${list}" aria-label="Dra for å flytte" style="width:32px;height:40px;display:grid;place-items:center;color:#979797;flex:none;touch-action:none;cursor:grab">${M.icon('mdi:drag-vertical', 22)}</span>`;
  const eyeB = (key, op, t, v, hidden, label) => `<button class="ib" data-a="fn" data-k="${key}" data-op="${op}" data-t="${esc(t || '')}" data-v="${esc(v)}" aria-pressed="${!hidden}" aria-label="${hidden ? 'Vis' : 'Skjul'} ${esc(label)}" style="width:40px;height:40px;border-radius:20px;display:grid;place-items:center;flex:none;color:${hidden ? '#696969' : '#fafafa'}">${M.icon(hidden ? 'mdi:eye-off-outline' : 'mdi:eye-outline', 20)}</button>`;
  const ROW = 'border-radius:26px;background:#404040;display:flex;align-items:center;gap:6px;padding:6px 6px 6px 4px;min-height:56px';
  const INP = 'min-width:0;height:36px;border-radius:18px;background:#2f2f2f;padding:0 12px;font-size:13px;color:#fafafa';
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
          <button data-a="fn" data-k="${key}" data-op="col" data-v="${esc(r.key)}" aria-label="Bytt farge for ${esc(r.name)}" style="width:36px;height:36px;border-radius:18px;display:grid;place-items:center;flex:none;background:#2f2f2f"><i style="width:16px;height:16px;border-radius:8px;background:${esc(r.color)}"></i></button>
          <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px"><input class="inp" data-name="rooms.${esc(r.key)}.name" value="${esc(r.name)}" aria-label="Navn på rom ${i + 1}" autocapitalize="off" spellcheck="false" style="${INP}"><span style="font-size:11px;color:#979797;padding-left:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${i < 2 ? 'Stor · ' : ''}${esc(r.entity || (r.segment != null ? 'Segment ' + r.segment : r.key))}</span></span>
          <input class="inp" type="number" inputmode="decimal" data-name="rooms.${esc(r.key)}.m2" data-num="1" value="${r.m2 != null ? r.m2 : ''}" placeholder="m²" aria-label="Areal i m²" style="${INP};width:62px;padding:0 8px;text-align:center">
          ${r.manual ? `<button class="ib" data-a="fn" data-k="${key}" data-op="rdel" data-v="${esc(r.key)}" aria-label="Fjern ${esc(r.name)}" style="width:36px;height:40px;display:grid;place-items:center;flex:none;color:#979797">${M.icon('mdi:delete-outline', 20)}</button>` : ''}
          ${eyeB(key, 'reye', '', r.key, r.hidden, r.name)}</div>`).join('');
      const form = add ? `<div style="display:flex;flex-direction:column;gap:6px;padding:10px;border-radius:24px;background:#404040">
          <input class="inp" data-radd="name" placeholder="Navn (f.eks. Stue)" autocapitalize="off" spellcheck="false" style="${INP}">
          <input class="inp" data-radd="src" placeholder="input_boolean.… eller segment-ID (tall)" autocapitalize="off" spellcheck="false" style="${INP}">
          <button class="btn" style="height:44px" data-a="fn" data-k="${key}" data-op="radd" data-v="">${M.icon('mdi:check', 18)}Legg til</button></div>` : '';
      return box(`${L.length ? rows : small(vac ? 'Fant ingen rom fra roboten (segmenter) eller input_boolean.' + objOf(vac) + '_*.' : 'Velg støvsuger under Entiteter.')}${form}
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
    // Soner: dra-rekkefølge (zone_order), navn, vis/skjul
    const soner = { type: 'html', html: (hh, cc, key, ed) => {
      installEd(ed);
      const L = zonesOf(hh, cc);
      return box(L.length ? L.map((z) => `<div class="ordrow vzone" data-edk="${esc(z.key)}" data-elist="zone" data-key="vz-${esc(z.key)}" style="${ROW};${z.hidden ? 'opacity:.5' : ''}">${hdl('zone')}
          <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px"><input class="inp" data-name="zones.${esc(z.key)}.name" value="${esc(z.name)}" aria-label="Navn på sone" autocapitalize="off" spellcheck="false" style="${INP}"><span style="font-size:11px;color:#979797;padding-left:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(z.entity)}</span></span>
          ${eyeB(key, 'zeye', '', z.key, z.hidden, z.name)}</div>`).join('') : small('Fant ingen sone-skript (script.*_zone_*).'));
    }, click: (dd, ed) => {
      if (dd.op === 'zeye') { const z = ((ed._config || {}).zones || {})[dd.v] || {}; M.haptic('selection'); return ed._set('zones.' + dd.v + '.hidden', z.hidden ? undefined : true); }
    } };
    // Faner: forhåndsvisning + piller med dra, ikon, navn, «N deler», pil (innhold) og øye
    const faner = { type: 'html', html: (hh, cc, key, ed) => {
      installEd(ed);
      const hid = tabHidden(cc), open = EXP.get(cid(ed)), V = visTabs(cc), st = cc.startTab && V.includes(cc.startTab) ? cc.startTab : V[0], names = cc.tab_labels === 'name';
      const prev = `<div style="display:flex;gap:2px;padding:4px;border-radius:24px;background:#282828;overflow:hidden" aria-label="Forhåndsvisning">${V.map((k) => { const [, l, ic] = TABL[k], on = k === st; return `<span style="flex:${on || names ? '1 1 auto' : '0 0 40px'};height:36px;border-radius:18px;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:0 10px;font-size:12px;white-space:nowrap;${on ? `background:${C.accent};color:#2a1720;font-weight:500` : 'color:#afafaf'}">${names ? '' : M.icon(ic, 18)}${on || names ? esc(l) : ''}</span>`; }).join('')}<span style="width:36px;height:36px;border-radius:18px;display:grid;place-items:center;background:#3a3a3a;flex:none">${M.icon('mdi:cog', 18)}</span></div>`;
      return box(prev + tabOrder(cc).map((k) => {
        const [, label, icon] = TABL[k], P = PARTS[k], ph = partHidden(cc, k), isO = open === k;
        const row = `<div class="ordrow vtab" data-edk="${k}" data-elist="tab" data-key="vt-${k}" style="height:56px;border-radius:28px;background:#404040;display:flex;align-items:center;gap:8px;padding:0 6px 0 4px;${hid.has(k) ? 'opacity:.5' : ''}">${hdl('tab')}
          <span style="width:36px;height:36px;border-radius:18px;display:grid;place-items:center;background:#2f2f2f;flex:none">${M.icon(icon, 20)}</span>
          <span style="flex:1;min-width:0;display:flex;flex-direction:column"><span style="font-size:14px;font-weight:500">${esc(label)}</span><span style="font-size:11px;color:#979797">${P.length - ph.size} av ${P.length} deler</span></span>
          <button class="ib" data-a="fn" data-k="${key}" data-op="exp" data-v="${k}" aria-expanded="${isO}" aria-label="Innhold i ${esc(label)}" style="width:40px;height:40px;border-radius:20px;display:grid;place-items:center;flex:none">${M.icon(isO ? 'mdi:chevron-up' : 'mdi:chevron-down', 22)}</button>
          ${eyeB(key, 'eye', '', k, hid.has(k), label)}</div>`;
        const parts = isO ? P.map(([p, pl]) => `<div class="vpart" data-key="vp-${k}-${p}" style="height:48px;border-radius:24px;margin-left:28px;background:#2f2f2f;display:flex;align-items:center;gap:8px;padding:0 6px 0 16px;${ph.has(p) ? 'opacity:.5' : ''}"><span style="flex:1;font-size:13px">${esc(pl)}</span>${eyeB(key, 'peye', k, p, ph.has(p), pl)}</div>`).join('') : '';
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
          { type: 'section', id: 'faner', label: 'Faner', icon: 'mdi:tab', fields: [faner] },
          { type: 'select', name: 'tab_labels', label: 'Stil', options: [['icon', 'Symboler'], ['name', 'Navn']], default: 'icon', help: 'Symboler: bare ikon, den aktive fanen viser også navnet. Navn: bare tekst.' },
          { type: 'select', name: 'startTab', label: 'Startfane', options: TABS.map((t) => [t[0], t[1]]), default: 'renhold' },
        ] },
        { key: 'entiteter', label: 'Entiteter', icon: 'mdi:link-variant', focus: ['entiteter', ...groups.map((g) => 'ent-' + M.slug(g))], fields: entFields },
        { key: 'avansert', label: 'Avansert', icon: 'mdi:cog-outline', focus: ['avansert', 'spacing'], fields: [
          { type: 'section', id: 'avansert', label: 'Avansert', icon: 'mdi:cog-outline', fields: [
            { type: 'boolean', name: 'confirm_start', label: 'Bekreft før start (trykk to ganger)', default: false },
            { type: 'boolean', name: 'auto_empty', label: 'Tøm automatisk når roboten er tilbake i dokken', default: false },
          ] },
          M.spacingSchema(),
          { type: 'button', label: 'Tilbakestill til standard', icon: 'mdi:restore', run: (hh, cc, ed) => { M.haptic('warning'); const id = (cc && cc.card_id) || M.uid(); EXP.delete(id); ADD.delete(id); ed._config = { type: cc.type || 'custom:' + TAG, ...Stovsuger.getStubConfig(), card_id: id }; ed._set('card_id', id); } },
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
    onOpen() { this.update(); this._tick(); }
    onClose() { clearInterval(this._timer); this._timer = 0; this._ui = { ...this._ui, armed: 0 }; }
    disconnectedCallback() { super.disconnectedCallback(); clearInterval(this._timer); this._timer = 0; }
    // Fremdriften teller mens roboten jobber og popupen er åpen (ingen polling ellers, fallgruve 8)
    _tick() { clearInterval(this._timer); this._timer = setInterval(() => { if (!this.isConnected || !this.isOpen) { clearInterval(this._timer); this._timer = 0; return; } const s = this._E && this._hass && this._hass.states[this._E.vacuum]; if (s && s.state === 'cleaning') this.update(); }, 15000); }
    get tab() { const V = visTabs(this.config); const t = this.ui.tab || this.config.startTab; return V.includes(t) ? t : V[0]; }
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
      const rate = areaMin && areaTot ? areaMin / areaTot : 1.2; // min per m²: robotens egen snittfart, ellers 1,2
      const pick = sel.length ? sel : vis, m2 = pick.reduce((s, r) => s + (r.m2 || 0), 0);
      return { h, c, E, vs, state, bat, charging, tank: !!(tank && tank.state === 'on'), rooms: vis, sel, m2: m2 || null, est: m2 ? Math.round(m2 * rate) : null, active: ACTIVE.includes(state) };
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
        case 'empty': return E.empty ? this._run(h, E.empty) : this.customize('ent-rengjoring');
        case 'zone': return this._run(h, d.id);
        case 'fan': return M.call(h, 'vacuum', 'set_fan_speed', { entity_id: E.vacuum, fan_speed: d.v });
        case 'fanscript': return this._run(h, E.fan_script);
        case 'opt': return M.call(h, d.id.split('.')[0], 'select_option', { entity_id: d.id, option: d.v });
        case 'reset': return M.call(h, 'button', 'press', { entity_id: d.id });
        default: return super.onAction(name, el, ev);
      }
    }

    /* ---------------------------------------------------------- tegning */
    render() {
      const m = this._model(), c = m.c, t = this.tab;
      const V = visTabs(c), names = c.tab_labels === 'name';
      const tabs = `<div class="tabs ${names ? 'names' : 'itabs'}" role="tablist" data-glass-drag="x">${V.map((k) => {
        const [, label, icon] = TABL[k];
        return names ? `<button class="ntab ${k === t ? 'on' : ''}" role="tab" aria-selected="${k === t}" data-act="tab" data-v="${k}" data-haptic="selection">${esc(label)}</button>`
          : M.iconTabs.btn({ label, icon }, k === t, `data-act="tab" data-v="${k}" data-haptic="selection"`, k === t ? 'on' : '');
      }).join('')}</div>`;
      let body;
      try { body = this['_t_' + t](m); } catch (e) { body = this._failHTML(e); }
      return `<div class="wrap">${this._hero(m)}${m.tank ? this._tank(m) : ''}<div class="top">${tabs}<button class="gear press" data-act="customize" aria-label="Tilpass">${M.icon('mdi:cog', 22)}</button></div><div class="pane" data-key="pane-${t}">${body}</div></div>`;
    }
    _parts(t) { const hid = partHidden(this.config, t); return PARTS[t].map((p) => p[0]).filter((p) => !hid.has(p)); }
    _missing(text, section) { return `<div class="miss"><span class="mdash">–</span><span>·</span><button class="pick press" data-act="customize" data-section="${esc(section || 'ent-robot_og_status')}">${M.icon('mdi:plus', 18)}Velg entitet</button>${text ? `<span class="mt">${esc(text)}</span>` : ''}</div>`; }
    _hero(m) {
      const mode = !m.vs ? 'none' : m.state === 'error' ? 'error' : ['cleaning', 'paused', 'returning'].includes(m.state) ? m.state : 'docked';
      const label = !m.vs ? '–' : m.state === 'docked' && m.charging ? 'Lader' : STATUS[m.state] || m.vs.state;
      const name = this.config.name || (m.vs ? M.name(this.hass, m.E.vacuum) : 'Støvsuger');
      const sub = !m.vs ? 'Velg støvsuger' : m.state === 'error' && m.vs.attributes.error ? String(m.vs.attributes.error) : m.vs.attributes.fan_speed ? 'Vifte ' + m.vs.attributes.fan_speed : '';
      const tone = mode === 'cleaning' ? C.green : mode === 'returning' || mode === 'paused' ? C.orange : mode === 'error' ? C.red : m.charging ? C.green : 'var(--gray800,#afafaf)';
      const animOff = M.animOff ? M.animOff() : false;
      return `<div class="hero ${mode}" data-key="hero">
        ${scene(mode === 'none' ? 'docked' : mode, m.charging && mode === 'docked', animOff)}
        <div class="hl">
          <span class="spill" style="--tc:${tone}" ${m.E.vacuum ? `data-ent="${esc(m.E.vacuum)}"` : ''}><i></i>${esc(label)}</span>
          <div class="bat" ${m.E.battery || m.E.vacuum ? `data-ent="${esc(m.E.battery || m.E.vacuum)}"` : ''}><span class="bv num">${m.bat != null ? m.bat : '–'}</span><span class="bu">%</span>${m.charging ? M.icon('mdi:lightning-bolt', 20, `color:${C.green}`) : ''}</div>
          <span class="hn">${esc(name)}${sub ? ` · <span>${esc(sub)}</span>` : ''}</span>
          ${!m.vs ? `<button class="pick press" data-act="customize" data-section="ent-robot_og_status">${M.icon('mdi:plus', 18)}Velg entitet</button>` : ''}
        </div></div>`;
    }
    _tank(m) {
      return `<div class="tank" role="alert" ${m.E.tank ? `data-ent="${esc(m.E.tank)}"` : ''}><span class="ti">${M.icon('mdi:water-off-outline', 28)}</span><span class="tt"><b>Vanntanken er tom</b><span>Fyll på før neste mopping.</span></span>
        <button class="tb press" data-act="empty" aria-label="Tøm støvsuger">${M.icon('mdi:delete-empty', 20)}Tøm</button></div>`;
    }
    // Aktive knapper (pause/fortsett + hjem) – brukt i Renhold når roboten jobber
    _activeBtns(m) {
      const run = m.state === 'cleaning';
      return `<div class="actrow"><button class="ab press ${run ? 'pz' : 'go'}" data-act="${run ? 'pause' : 'resume'}">${M.icon(run ? 'mdi:pause' : 'mdi:play', 24)}${run ? 'Pause' : 'Fortsett'}</button>
        <button class="ab press hm" data-act="home">${M.icon('mdi:home-import-outline', 24)}Hjem</button></div>`;
    }

    /* ---------------------------------------------------------- Renhold */
    _t_renhold(m) {
      const P = this._parts('renhold'), c = m.c, out = [];
      if (!m.vs) out.push(this._missing('Fant ingen vacuum.*-entitet'));
      if (P.includes('rom')) {
        if (!m.rooms.length) out.push(`<div class="miss"><span>Ingen rom</span><span>·</span><button class="pick press" data-act="customize" data-section="rom-liste">${M.icon('mdi:plus', 18)}Legg til rom</button></div>`);
        else {
          const all = m.sel.length === m.rooms.length;
          const tiles = m.rooms.map((r, i) => {
            const on = this._isSel(r), big = i < 2 && m.rooms.length > 1;
            return `<button class="rt press ${big ? 'big' : ''} ${on ? 'on' : ''}" style="--rc:${esc(r.color)}" data-act="room" data-k="${esc(r.key)}" ${r.entity ? `data-ent="${esc(r.entity)}"` : ''} role="checkbox" aria-checked="${on}" data-haptic="selection">
              <span class="ri">${M.icon(r.icon, big ? 26 : 20)}</span><span class="rn">${esc(r.name)}</span>${r.m2 ? `<span class="rm num">${M.nf(r.m2)} m²</span>` : ''}<span class="rc">${on ? M.icon('mdi:check', 16) : ''}</span></button>`;
          }).join('');
          const n = m.sel.length;
          out.push(`<div class="sh"><span class="st">${esc(c.floor || 'Rom')}</span><button class="lnk press" data-act="selall">${all ? 'Fjern alle' : 'Velg alle'}</button></div>
            <div class="rgrid">${tiles}</div>
            <div class="sum"><span>${n ? `${n} rom valgt` : 'Ingen valgt – hele etasjen'}</span><span class="num">${m.m2 ? M.nf(m.m2) + ' m²' : '– m²'}</span><span class="num">${m.est ? 'ca. ' + m.est + ' min' : '– min'}</span></div>`);
        }
      }
      if (P.includes('start')) {
        if (m.active) out.push(this._activeBtns(m));
        else {
          const as = this.s(m.E.all);
          const allLbl = as ? String(as.state) === 'False' || as.state === 'off' : !m.sel.length || m.sel.length === m.rooms.length;
          const lbl = this.ui.armed ? 'Trykk igjen for å starte' : allLbl ? 'Støvsug alt' : 'Støvsug valgte rom';
          out.push(`<button class="gobtn press ${this.ui.armed ? 'armed' : ''}" data-act="start" ${m.vs ? '' : 'disabled'} data-haptic="medium">${M.icon('mdi:robot-vacuum', 26)}<span>${esc(lbl)}</span></button>`);
        }
      }
      if (P.includes('soner')) {
        const Z = zonesOf(this.hass, c).filter((z) => !z.hidden);
        if (Z.length) out.push(`<div class="sh"><span class="st">Soner</span><span class="meta">${Z.length}</span></div><div class="zones" data-gd-skip>${Z.map((z) => `<button class="zc press" data-act="zone" data-id="${esc(z.entity)}" data-ent="${esc(z.entity)}">${M.icon('mdi:selection-marker', 18)}${esc(z.name)}</button>`).join('')}</div>`);
      }
      return out.join('');
    }

    /* ---------------------------------------------------------- Kontroll */
    _seg(title, icon, opts, cur, act, id) {
      if (!opts || !opts.length) return '';
      return `<div class="segc"><div class="sgh">${M.icon(icon, 18)}<span>${esc(title)}</span><span class="meta">${esc(cur != null ? cur : '–')}</span></div>
        <div class="seg" role="radiogroup" data-glass-drag="x">${opts.map((o) => `<button class="sg ${String(o) === String(cur) ? 'on' : ''}" role="radio" aria-checked="${String(o) === String(cur)}" data-act="${act}" data-v="${esc(o)}" ${id ? `data-id="${esc(id)}"` : ''} data-haptic="selection">${esc(o)}</button>`).join('')}</div></div>`;
    }
    _t_kontroll(m) {
      const P = this._parts('kontroll'), out = [], h = this.hass;
      if (!m.vs) return this._missing('Fant ingen vacuum.*-entitet');
      if (P.includes('fremdrift')) {
        const p = this._progress(m), run = m.state === 'cleaning';
        out.push(`<div class="card prog"><div class="pgt"><span class="pv num">${p.pct != null ? p.pct : '–'}<small>%</small></span><span class="pl"><b>${esc(STATUS[m.state] || m.state)}</b><span>${p.left != null ? `${p.exact ? '' : 'ca. '}${p.left} min igjen` : m.active ? '– min igjen' : 'Ikke i gang'}</span></span>
          <button class="pp press ${run ? '' : 'go'}" data-act="${run ? 'pause' : m.active ? 'resume' : 'start'}" aria-label="${run ? 'Pause' : 'Start'}">${M.icon(run ? 'mdi:pause' : 'mdi:play', 30)}</button></div>
          <div class="bar"><i style="width:${p.pct || 0}%"></i></div></div>`);
      }
      if (P.includes('knapper')) {
        const es = m.E.empty && h.states[m.E.empty];
        out.push(`<div class="cbtns"><button class="cb press" data-act="home">${M.icon('mdi:home-import-outline', 22)}<span>Returner hjem</span></button>
          <button class="cb press" data-act="empty" ${es ? `data-ent="${esc(m.E.empty)}"` : ''}>${M.icon('mdi:delete-empty-outline', 22)}<span>Tøm støvsuger</span>${es ? '' : '<i>– · Velg entitet</i>'}</button></div>`);
      }
      if (P.includes('vifte')) {
        const a = m.vs.attributes, L = a.fan_speed_list;
        if (Array.isArray(L) && L.length) out.push(this._seg('Vifte', 'mdi:fan', L, a.fan_speed, 'fan'));
        else if (m.E.fan_script && h.states[m.E.fan_script]) out.push(`<button class="row press" data-act="fanscript" data-ent="${esc(m.E.fan_script)}">${M.icon('mdi:fan', 22)}<span class="grow"><b>Vifte</b><span>${esc(a.fan_speed || '–')} · trykk for å bytte</span></span>${M.icon('mdi:swap-horizontal', 20)}</button>`);
        else out.push(`<div class="segc"><div class="sgh">${M.icon('mdi:fan', 18)}<span>Vifte</span><span class="meta">${esc(a.fan_speed || '–')}</span></div></div>`);
      }
      [['mopp', 'mop', 'Moppmodus', 'mdi:water'], ['intensitet', 'mop_intensity', 'Moppintensitet', 'mdi:water-percent']].forEach(([p, k, title, icon]) => {
        if (!P.includes(p)) return;
        const s = this.s(m.E[k]);
        if (s) out.push(this._seg(title, icon, s.attributes.options, s.state, 'opt', m.E[k]));
        else if (m.E[k]) out.push(`<div class="segc"><div class="sgh">${M.icon(icon, 18)}<span>${esc(title)}</span><span class="meta">–</span></div></div>`);
      });
      return out.join('');
    }

    /* ---------------------------------------------------------- Info */
    _t_info(m) {
      const P = this._parts('info'), out = [], h = this.hass;
      if (P.includes('totalt')) {
        const as = this.s(m.E.area), a = as && M.isNum(as.state) ? Number(as.state) : null;
        const mins = minutesOf(this.s(m.E.time));
        out.push(`<div class="stats"><div class="stat" ${m.E.area ? `data-ent="${esc(m.E.area)}"` : ''}>${M.icon('mdi:texture-box', 22, `color:${C.blue}`)}<span class="sl">Vasket totalt</span><b class="num">${a != null ? M.nf(a) + ' m²' : '–'}</b><span class="ss">${a != null ? '≈ ' + M.nf(a / FOTBALL, 1) + ' fotballbaner' : m.E.area ? '' : 'Velg entitet'}</span></div>
          <div class="stat" ${m.E.time ? `data-ent="${esc(m.E.time)}"` : ''}>${M.icon('mdi:timer-outline', 22, `color:${C.purple}`)}<span class="sl">Tid brukt</span><b class="num">${esc(dagerTimer(mins))}</b><span class="ss">${mins != null ? 'til sammen' : m.E.time ? '' : 'Velg entitet'}</span></div></div>`);
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
    _t_kart(m) {
      const P = this._parts('kart'), out = [];
      if (P.includes('kart')) {
        const s = this.s(m.E.map), pic = s && s.attributes.entity_picture;
        const src = pic ? (this.hass.hassUrl ? this.hass.hassUrl(pic) : pic) : '';
        out.push(src ? `<div class="map" data-ent="${esc(m.E.map)}"><img src="${esc(src)}" alt="${esc(M.name(this.hass, m.E.map))}" loading="lazy"></div>` : this._missing(m.E.map ? 'Kartet er ikke tilgjengelig' : 'Fant ikke noe kart (image.*)'));
      }
      if (P.includes('forklaring') && m.rooms.length) out.push(`<div class="legend">${m.rooms.map((r) => { const on = this._isSel(r); return `<button class="lg press ${on ? 'on' : ''}" style="--rc:${esc(r.color)}" data-act="maproom" data-k="${esc(r.key)}" role="checkbox" aria-checked="${on}" data-haptic="selection"><i></i>${esc(r.name)}</button>`; }).join('')}</div>`);
      return out.join('');
    }

    afterRender() {
      const R = this.shadowRoot;
      if (M.glassDrag) R.querySelectorAll('.tabs,.seg').forEach((s) => M.glassDrag(s, { axis: 'x' }));
      // Sone-chips: vannrett scroll skal aldri lukke/dra popupen (fallgruve 2)
      const z = R.querySelector('.zones');
      if (z && !z.__vz) { z.__vz = true; const stop = (e) => e.stopPropagation(); ['touchstart', 'touchmove', 'pointerdown', 'pointermove'].forEach((t) => z.addEventListener(t, stop, { passive: true })); }
    }
    get styles() {
      return `
        :host{display:block;width:100%}
        .wrap{display:flex;flex-direction:column;gap:var(--msh-gap,8px)}
        .pane{display:flex;flex-direction:column;gap:var(--msh-gap,8px);min-width:0}
        .hero{position:relative;height:200px;border-radius:28px;overflow:hidden;background:linear-gradient(160deg,#3a3a3a 0%,#333036 100%);box-shadow:${C.edge}}
        .scene{position:absolute;right:0;top:0;height:100%;width:62%;max-width:420px}
        .trail{fill:none;stroke:rgba(255,255,255,.16);stroke-width:20;stroke-linecap:round;stroke-linejoin:round}
        .homep{fill:none;stroke:rgba(242,181,115,.55);stroke-width:2;stroke-dasharray:4 5}
        .led{fill:${C.blue}}
        .bot.cleaning .led{fill:${C.green}}
        .bot.returning .led,.bot.paused .led{fill:${C.orange}}
        .err{fill:none;stroke:${C.red};stroke-width:2.5;animation:vblink 1s steps(2) infinite}
        .dl{fill:#545454}.dl.on{fill:${C.green};animation:vpulse 1.6s ease-in-out infinite}
        .bolt{animation:vpulse 1.6s ease-in-out infinite}
        @keyframes vpulse{0%,100%{opacity:1}50%{opacity:.35}}
        @keyframes vblink{0%{opacity:1}100%{opacity:0}}
        @media (prefers-reduced-motion: reduce){.dl.on,.bolt,.err{animation:none}}
        .hl{position:relative;z-index:1;display:flex;flex-direction:column;align-items:flex-start;gap:6px;padding:18px;height:100%;max-width:60%}
        .spill{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 12px;border-radius:14px;background:color-mix(in srgb, var(--tc) 18%, transparent);color:var(--tc);font-size:13px;font-weight:600;white-space:nowrap}
        .spill i{width:8px;height:8px;border-radius:4px;background:var(--tc)}
        .bat{display:flex;align-items:baseline;gap:2px;margin-top:auto}
        .bv{font-size:44px;font-weight:300;line-height:1}
        .bu{font-size:20px;color:var(--gray700,#979797);margin-right:4px}
        .hn{font-size:13px;color:var(--gray800,#afafaf);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
        .hn span{color:var(--gray700,#979797)}
        .tank{display:flex;align-items:center;gap:12px;padding:6px 8px 6px 6px;border-radius:32px;background:${C.red};color:#2c1411}
        .ti{width:56px;height:56px;border-radius:28px;display:grid;place-items:center;background:rgba(0,0,0,.1);flex:none;animation:vdrip 1.4s ease-in-out infinite}
        @keyframes vdrip{0%,100%{transform:translateY(0)}50%{transform:translateY(2px)}}
        .tt{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}.tt b{font-size:15px;font-weight:600}.tt span{font-size:12px;opacity:.8}
        .tb{height:40px;padding:0 14px;border-radius:20px;background:rgba(0,0,0,.12);display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:600;flex:none}
        .top{display:flex;align-items:center;gap:8px;min-width:0}
        .tabs{flex:1;min-width:0;display:flex;gap:2px;padding:4px;border-radius:24px;background:var(--gray200,#3a3a3a);position:relative;touch-action:pan-y;overflow:hidden;${M.tabSurface ? M.tabSurface('var(--gray200,#3a3a3a)') : ''}}
        .tabs .itab{color:var(--gray800,#afafaf);background:transparent}
        .tabs .itab.on,.tabs .ntab.on{background:${C.accent};color:#2a1720;font-weight:500}
        ${M.iconTabs.css('.tabs.itabs')}
        .ntab{flex:1 1 0;min-width:0;height:40px;padding:0 8px;border-radius:20px;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--gray800,#afafaf)}
        .gear{width:48px;height:48px;border-radius:24px;display:grid;place-items:center;background:var(--gray200,#3a3a3a);flex:none;box-shadow:${C.edge}}
        .sh{display:flex;align-items:center;gap:8px;min-height:40px;padding:0 4px}
        .st{flex:1;font-size:18px;font-weight:500}
        .meta{font-size:13px;color:var(--gray700,#979797);margin-left:auto}
        .lnk{height:32px;padding:0 12px;border-radius:16px;background:var(--gray200,#3a3a3a);font-size:13px;color:var(--gray900,#c7c7c7)}
        .rgrid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));grid-auto-rows:72px;gap:8px}
        .rt{grid-column:span 2;position:relative;display:flex;flex-direction:column;align-items:flex-start;justify-content:flex-end;gap:2px;padding:10px 12px;border-radius:22px;background:var(--gray200,#3a3a3a);text-align:left;min-width:0;overflow:hidden;box-shadow:${C.edge}}
        .rt.big{grid-column:span 3;grid-row:span 2;border-radius:28px;padding:14px 16px}
        .rt .ri{position:absolute;top:10px;left:10px;width:34px;height:34px;border-radius:17px;display:grid;place-items:center;background:color-mix(in srgb, var(--rc) 22%, transparent);color:var(--rc)}
        .rt.big .ri{top:14px;left:14px;width:48px;height:48px;border-radius:24px}
        .rt:not(.big) .ri{position:static;width:26px;height:26px;border-radius:13px;margin-bottom:auto}
        .rn{font-size:14px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
        .rt.big .rn{font-size:17px}
        .rm{font-size:11px;color:var(--gray700,#979797)}
        .rc{position:absolute;top:10px;right:10px;width:22px;height:22px;border-radius:11px;display:grid;place-items:center;box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.25)}
        .rt.on{background:var(--rc);color:#232323}
        .rt.on .ri{background:rgba(0,0,0,.12);color:#232323}
        .rt.on .rm{color:rgba(0,0,0,.6)}
        .rt.on .rc{background:#232323;color:#fafafa;box-shadow:none}
        .sum{display:flex;gap:12px;padding:0 6px;font-size:13px;color:var(--gray800,#afafaf)}
        .sum span:first-child{flex:1}
        .gobtn{display:flex;align-items:center;justify-content:center;gap:10px;height:64px;border-radius:32px;background:${C.green};color:#12291d;font-size:17px;font-weight:600}
        .gobtn.armed{background:${C.orange};color:#2d1f0c}
        .gobtn[disabled]{opacity:.4}
        .actrow{display:grid;grid-template-columns:1fr 1fr;gap:8px}
        .ab{display:flex;align-items:center;justify-content:center;gap:8px;height:64px;border-radius:32px;background:var(--gray200,#3a3a3a);font-size:16px;font-weight:600}
        .ab.pz{background:${C.orange};color:#2d1f0c}.ab.go{background:${C.green};color:#12291d}
        .zones{display:flex;gap:8px;overflow-x:auto;touch-action:pan-x;overscroll-behavior-x:contain;scrollbar-width:none;padding-bottom:2px}
        .zones::-webkit-scrollbar{display:none}
        .zc{flex:none;height:44px;padding:0 16px 0 12px;border-radius:22px;background:var(--gray200,#3a3a3a);display:inline-flex;align-items:center;gap:8px;font-size:13px;white-space:nowrap}
        .miss{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:8px;padding:22px 16px;border-radius:24px;background:var(--gray200,#3a3a3a);color:var(--gray700,#979797);font-size:14px}
        .miss .mdash{font-size:22px;color:var(--white,#fafafa)}
        .miss .mt{flex-basis:100%;text-align:center;font-size:12px}
        .pick{height:36px;padding:0 14px 0 10px;border-radius:18px;background:var(--gray300,#404040);display:inline-flex;align-items:center;gap:6px;font-size:13px;color:var(--white,#fafafa)}
        .card{border-radius:24px;background:var(--gray200,#3a3a3a);box-shadow:${C.edge}}
        .prog{padding:16px;display:flex;flex-direction:column;gap:14px}
        .pgt{display:flex;align-items:center;gap:14px}
        .pv{font-size:44px;font-weight:300;line-height:1}.pv small{font-size:20px;color:var(--gray700,#979797)}
        .pl{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}.pl b{font-size:15px;font-weight:500}.pl span{font-size:13px;color:var(--gray700,#979797)}
        .pp{width:64px;height:64px;border-radius:32px;display:grid;place-items:center;background:${C.orange};color:#2d1f0c;flex:none}
        .pp.go{background:${C.green};color:#12291d}
        .bar{height:8px;border-radius:4px;background:var(--gray300,#404040);overflow:hidden}
        .bar i{display:block;height:100%;border-radius:4px;background:${C.green};transition:width .6s}
        .cbtns{display:grid;grid-template-columns:1fr 1fr;gap:8px}
        .cb{display:flex;flex-direction:column;align-items:flex-start;justify-content:space-between;gap:10px;min-height:96px;padding:14px;border-radius:24px;background:var(--gray200,#3a3a3a);text-align:left;font-size:14px;font-weight:500;box-shadow:${C.edge}}
        .cb i{font-style:normal;font-size:11px;color:var(--gray700,#979797);font-weight:400}
        .segc{display:flex;flex-direction:column;gap:6px;padding:12px;border-radius:24px;background:var(--gray200,#3a3a3a)}
        .sgh{display:flex;align-items:center;gap:8px;padding:0 4px;font-size:14px;font-weight:500}
        .seg{display:flex;gap:2px;padding:4px;border-radius:22px;background:var(--gray100,#282828);position:relative;touch-action:pan-y;overflow:hidden;${M.tabSurface ? M.tabSurface('var(--gray100,#282828)') : ''}}
        .seg .sg{flex:1 1 0;min-width:0;height:36px;border-radius:18px;font-size:12px;color:var(--gray800,#afafaf);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 6px;text-transform:capitalize}
        .seg .sg.on{background:${C.accent};color:#2a1720;font-weight:500}
        .row{display:flex;align-items:center;gap:12px;min-height:64px;padding:8px 16px;border-radius:24px;background:var(--gray200,#3a3a3a);text-align:left}
        .grow{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}.grow b{font-size:14px;font-weight:500}.grow>span{font-size:12px;color:var(--gray700,#979797)}
        .stats{display:grid;grid-template-columns:1fr 1fr;gap:8px}
        .stat{display:flex;flex-direction:column;gap:4px;padding:16px;border-radius:24px;background:var(--gray200,#3a3a3a);min-width:0;box-shadow:${C.edge}}
        .stat .sl{font-size:12px;color:var(--gray700,#979797);margin-top:6px}.stat b{font-size:20px;font-weight:500}.stat .ss{font-size:12px;color:var(--gray800,#afafaf)}
        .vlist{padding:4px}
        .vrow{display:flex;align-items:center;gap:12px;min-height:64px;padding:8px 12px;border-radius:20px}
        .vrow+.vrow{box-shadow:inset 0 1px 0 rgba(255,255,255,.05)}
        .vi{width:40px;height:40px;border-radius:20px;display:grid;place-items:center;background:var(--gray300,#404040);flex:none}
        .vb{display:block;height:4px;border-radius:2px;background:var(--gray300,#404040);overflow:hidden;margin-top:4px}.vb i{display:block;height:100%;background:${C.green}}
        .vrow.low .vi{background:color-mix(in srgb, ${C.orange} 22%, transparent);color:${C.orange}}
        .vrow.low .grow .num{color:${C.orange}}.vrow.low .vb i{background:${C.orange}}
        .rs{height:36px;padding:0 14px;border-radius:18px;background:${C.orange};color:#2d1f0c;font-size:13px;font-weight:600;flex:none}
        .map{border-radius:24px;overflow:hidden;background:var(--gray200,#3a3a3a);aspect-ratio:3/4;display:grid;place-items:center}
        .map img{width:100%;height:100%;object-fit:contain;display:block}
        .legend{display:flex;flex-wrap:wrap;gap:6px}
        .legend .lg{height:36px;padding:0 14px 0 10px;border-radius:18px;background:var(--gray200,#3a3a3a);display:inline-flex;align-items:center;gap:8px;font-size:13px}
        .legend .lg i{width:12px;height:12px;border-radius:6px;background:var(--rc)}
        .legend .lg.on{background:var(--rc);color:#232323}.legend .lg.on i{background:#232323}
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
  M.stovsuger = { entsOf, roomsOf, zonesOf, minutesOf, hoursOf, dagerTimer, segsOf, DEF_ENT };
  M.define(TAG, Stovsuger, 'MSH Sir Sweeps', 'Støvsuger-popup (#rolf): animert robot, rom, soner, kontroll, vedlikehold og kart.');
})();
