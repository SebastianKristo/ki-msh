/* msh-sikkerhet-hero-card + msh-sikkerhet-card · popup #sikkerhet. Kilde: Sikkerhet v3.dc.html
 * Hero: sensorring + modus i kjernen + overskrift. Hovedkort: modusvelger (hold inne, hjelpetekst show_hint),
 * rom (35.4 · variant 2a: statusstripe, aktive rom som kort, rolige som piller, Rom/Type), siste hendelser, «Tilpass oppsett».
 * Autokonfig: første alarm_control_panel.*, alle lock.* og binary_sensor med device_class
 * door/window/garage_door/opening/motion/occupancy. Tastaturet portales ut av popupen (M.overlay, sentrert).
 */
(function () {
  const M = window.MSH, esc = M.esc, C = M.C;
  const GRAY9 = 'var(--gray900, #c7c7c7)';
  /* Fiks 34/35 · tema (lys/mørk). Lokale variabler (--sk-*) bygd på ki-tokenene (00-a-theme.js / MSH.theme, definert bare i
   * lys modus) med dagens mørke verdier som fallback – mørk modus er uendret. Lys modus (hass.themes.darkMode === false →
   * host[data-ki-theme=light]) får lyse flater, mørknet aksent-TEKST (Del A pkt. 6), sterkere tone-bakgrunner (pkt. 5,
   * --ki-tone-k: 12 % → 18 %) og tekst på tone-flater mørknet litt til (≥ 4,5:1). Flater/fyll beholder aksenten. */
  const SK_THEME = `
    :host{--sk-surface:var(--ki-surface, #3a3a3a);--sk-surface-2:var(--ki-surface-2, #404040);--sk-surface-3:var(--ki-surface-3, #2f2f2f);--sk-popup:var(--ki-popup, #282828);
      --sk-text:var(--ki-text, #fafafa);--sk-text-2:var(--ki-text-2, #afafaf);--sk-mute:var(--ki-text-3, #7f7f7f);--sk-mid:var(--ki-text-mid, #979797);--sk-dim:var(--gray500, #696969);
      --sk-g9:var(--ki-text-1, #c7c7c7);--sk-g4:var(--ki-ctrl, #545454);--sk-ring-off:var(--ki-surface-2, #404040);--sk-line:var(--ki-line, rgba(255,255,255,0.06));--sk-line-2:var(--ki-line, rgba(255,255,255,0.1));
      --sk-on-acc:var(--ki-on-accent, #282828);--sk-tk:var(--ki-tone-k, 1);--sk-tone-tx:100%;--sk-shadow:var(--ki-card-sh, none);
      --sk-amber:var(--ki-amber-text, var(--orange, #f2b573));--sk-blue:var(--ki-blue-text, var(--blue, #73b9f2));--sk-green:var(--ki-green-text, var(--green, #66d19e));
      --sk-red:var(--ki-red-text, var(--red, #f28073));--sk-purple:var(--ki-purple-text, var(--purple, #ad99e6));--sk-pink:var(--ki-pink-text, var(--pink, #f285c9));color:var(--sk-text)}
    :host([data-ki-theme=light]){--sk-surface:var(--ki-surface, #ffffff);--sk-surface-2:var(--ki-surface-2, #ebebeb);--sk-surface-3:var(--ki-surface-3, #dedede);--sk-popup:var(--ki-popup, #f0f0f0);
      --sk-text:var(--ki-text, #1c1c1c);--sk-text-2:var(--ki-text-2, #565656);--sk-mute:#626262;--sk-mid:var(--ki-text-mid, #5c5c5c);--sk-dim:#666666;--sk-g9:var(--ki-text-1, #333333);--sk-g4:var(--ki-ctrl, #cfcfcf);--sk-ring-off:#d4d4d4;
      --sk-line:var(--ki-line, rgba(0,0,0,0.08));--sk-line-2:rgb(0 0 0 / 0.12);--sk-on-acc:var(--ki-on-accent, #2a1720);--sk-tk:var(--ki-tone-k, 1.5);--sk-tone-tx:76%;--sk-shadow:var(--ki-card-sh, 0 1px 3px rgba(0,0,0,0.06));
      --sk-amber:var(--ki-amber-text, rgb(168 98 24));--sk-blue:var(--ki-blue-text, rgb(30 108 178));--sk-green:var(--ki-green-text, rgb(18 128 78));
      --sk-red:var(--ki-red-text, rgb(186 58 44));--sk-purple:var(--ki-purple-text, rgb(104 76 186));--sk-pink:var(--ki-pink-text, rgb(176 48 128))}`;
  // Aksentfarge → tekst-/ikonvariant (mørknes i lys modus). Fyll/flater bruker originalen.
  const TXT = { [C.orange]: 'var(--sk-amber)', [C.blue]: 'var(--sk-blue)', [C.green]: 'var(--sk-green)', [C.red]: 'var(--sk-red)', [C.purple]: 'var(--sk-purple)', [C.pink]: 'var(--sk-pink)', [GRAY9]: 'var(--sk-g9)' };
  const tx = (col) => TXT[col] || col;
  // Tekst som ligger PÅ en tone-flate i samme farge: i lys modus litt mørkere enn tx() (ellers < 4,5:1); mørk = tx()
  const toneTx = (col) => `color-mix(in srgb, ${tx(col)} var(--sk-tone-tx, 100%), black)`;
  // Tone-bakgrunn: pct i mørk modus, × --ki-tone-k i lys (12 % → 18 %) – samme regel som MSH.theme.tone
  const tone = (col, pct) => `color-mix(in srgb, ${col} calc(${pct}% * var(--sk-tk, 1)), transparent)`;
  const isLight = (h) => !!(h && h.themes && h.themes.darkMode === false);
  const markTheme = (el, h) => { const v = isLight(h) ? 'light' : 'dark'; if (el && el.getAttribute('data-ki-theme') !== v) el.setAttribute('data-ki-theme', v); };
  // [nøkkel, etikett, ikon, farge, tjeneste, tilstander, supported_features-bit]
  const MODES = [
    ['av', 'Av', 'remove_moderator', GRAY9, 'alarm_disarm', ['disarmed'], 0],
    ['hjemme', 'Hjemme', 'home', C.green, 'alarm_arm_home', ['armed_home'], 1],
    ['borte', 'Borte', 'shield_lock', C.orange, 'alarm_arm_away', ['armed_away', 'armed_vacation'], 2],
    ['natt', 'Natt', 'bedtime', C.blue, 'alarm_arm_night', ['armed_night'], 4],
  ];
  const TYPES = [['door', 'Dør', 'door_front'], ['window', 'Vindu', 'window'], ['lock', 'Lås', 'lock'], ['motion', 'Bevegelse', 'directions_walk'], ['presence', 'Tilstede', 'person']];
  const DC_TYPE = { door: 'door', garage_door: 'door', opening: 'door', window: 'window', motion: 'motion', occupancy: 'presence', presence: 'presence' };
  const AUTO_DC = ['door', 'window', 'garage_door', 'opening', 'motion', 'occupancy'];
  const WHO = { door: 'Dørsensor', window: 'Vindussensor', lock: 'Lås', motion: 'Bevegelsessensor', presence: 'Tilstedesensor' };
  const WORDS = { door: ['dør', 'dører'], window: ['vindu', 'vinduer'], lock: ['lås', 'låser'] };
  const plural = (k, one, many) => `${k} ${k === 1 ? one : many}`;
  const hm = (t) => { const d = new Date(t); return `${M.pad(d.getHours())}:${M.pad(d.getMinutes())}`; };
  const when = (t) => {
    if (!t || isNaN(t)) return '–';
    const d = new Date(t), now = new Date();
    if (d.toDateString() === now.toDateString()) return hm(t);
    if (d.toDateString() === new Date(now.getTime() - 86400000).toDateString()) return 'i går ' + hm(t);
    return d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' }) + ' ' + hm(t);
  };
  const guessType = (id) => {
    const n = id.split('.')[1] || id;
    if (id.startsWith('lock.')) return 'lock';
    if (/vindu|window/.test(n)) return 'window';
    if (/bevegelse|motion/.test(n)) return 'motion';
    if (/tilstede|presence|occupancy/.test(n)) return 'presence';
    return 'door';
  };
  const stripRoom = (name, room) => {
    if (!room) return name;
    const r = String(room).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const out = String(name).replace(new RegExp('^' + r + '\\s+', 'i'), '').replace(new RegExp('\\s+' + r + '$', 'i'), '').trim();
    return out ? out.charAt(0).toUpperCase() + out.slice(1) : name;
  };

  // Modus ut fra alarmens tilstand.
  M.sikMode = function (st) {
    if (!st || M.unavailable(st)) return null;
    const s = st.state, m = MODES.find((x) => x[5].includes(s));
    if (m) return { key: m[0], label: m[1], icon: m[2], color: m[3], armed: m[0] !== 'av' };
    const X = { triggered: ['Utløst', 'mdi:alarm-light', C.red], arming: ['Aktiveres', 'mdi:shield-sync', C.orange], pending: ['Venter', 'mdi:timer-sand', C.orange], disarming: ['Slås av', 'mdi:shield-sync', GRAY9], armed_custom_bypass: ['Egendefinert', 'mdi:shield-star', C.purple] }[s];
    return X ? { key: s, label: X[0], icon: X[1], color: X[2], armed: s !== 'disarming' } : { key: s, label: s, icon: 'shield', color: GRAY9, armed: true };
  };

  /* Fiks 24.6 · status-entitet + tekst per tilstand. config: state_entity (alarm_control_panel/select/sensor/input_select,
   * tom = alarm-entiteten) og state_map: { <rå tilstand>: { mode: av|hjemme|borte|natt, text } }.
   * Felles hjelper MSH.alarmState(hass, cfg) → { mode, text, … } brukes av popupen (modusknapper, ring, overskrift) og
   * Hjem (alarm-flisen, varsel-chip). Ukjent tilstand → rå verdi, modus Av (aldri gjett «hjemme»). */
  const ST_DOMAINS = ['alarm_control_panel', 'select', 'sensor', 'input_select'];
  const ACP_STATES = ['disarmed', 'armed_home', 'armed_away', 'armed_night', 'armed_vacation', 'arming', 'pending', 'triggered'];
  const ST_DEF = {
    armed: ['borte', 'Armert borte'], partially_armed: ['hjemme', 'Delvis armert'], disarmed: ['av', 'Av'],
    armed_home: ['hjemme', 'Armert hjemme'], armed_away: ['borte', 'Armert borte'], armed_night: ['natt', 'Nattmodus'],
    armed_vacation: ['borte', 'Armert ferie'], armed_custom_bypass: ['hjemme', 'Egendefinert'], triggered: ['borte', 'Alarm utløst!'],
    arming: ['av', 'Aktiveres'], pending: ['borte', 'Venter'], disarming: ['av', 'Slås av'],
  };
  const modeLabel = (k) => (MODES.find((m) => m[0] === k) || [])[1] || k;
  // Effektiv mapping for én rå tilstand: brukerens valg over standard; tom tekst = modusnavn (eller standardteksten).
  const stMap = (cfg, raw) => {
    const u = ((cfg && cfg.state_map) || {})[raw] || {}, D = ST_DEF[raw];
    const um = MODES.some((m) => m[0] === u.mode) ? u.mode : null;
    const mode = um || (D ? D[0] : 'av');
    const text = u.text ? String(u.text) : um && (!D || um !== D[0]) ? modeLabel(um) : D ? D[1] : String(raw);
    return { mode, text, known: !!(D || um) };
  };
  M.sikStateEntity = (hass, cfg) => (cfg && cfg.state_entity) || M.pick(cfg, 'alarm', hass ? M.all(hass, 'alarm_control_panel')[0] || null : null);
  M.alarmState = function (hass, cfg, alarmId) {
    cfg = cfg || {};
    const alarm = alarmId || M.pick(cfg, 'alarm', hass ? M.all(hass, 'alarm_control_panel')[0] || null : null);
    const entity = cfg.state_entity || alarm, st = entity && hass ? hass.states[entity] || null : null;
    if (!st || M.unavailable(st)) return { mode: null, text: st ? 'Utilgjengelig' : '–', raw: st ? st.state : null, entity, alarm, st, known: false, armed: false, triggered: false, busy: false, color: GRAY9, icon: 'mdi:shield-off-outline' };
    const raw = String(st.state), m = stMap(cfg, raw), M0 = MODES.find((x) => x[0] === m.mode);
    const triggered = raw === 'triggered', busy = /^(arming|pending|disarming)$/.test(raw);
    return { mode: m.mode, text: m.text, raw, entity, alarm, st, known: m.known, armed: m.mode !== 'av' || triggered, triggered, busy,
      color: triggered ? C.red : M0[3], icon: triggered ? 'mdi:alarm-light' : busy ? 'mdi:shield-sync' : M0[2] };
  };
  // Samme form som M.sikMode (key/label/icon/color/armed) – for ring, kjerne og modusknapper.
  const sikModeOf = (hass, cfg) => {
    const A = M.alarmState(hass, cfg);
    return A.mode ? { key: A.mode, label: A.text, icon: A.icon, color: A.color, armed: A.armed, A } : null;
  };
  // Mulige rå tilstander for editoren: options (select/input_select), fast liste (alarm_control_panel), ellers nå + lagrede.
  const stStates = (hass, cfg) => {
    const id = M.sikStateEntity(hass, cfg), st = id && hass ? hass.states[id] : null, d = id ? id.split('.')[0] : '';
    const base = d === 'alarm_control_panel' ? ACP_STATES : st && Array.isArray(st.attributes.options) ? st.attributes.options.map(String) : [];
    const cur = st && !M.unavailable(st) ? [String(st.state)] : [];
    return [...new Set([...base, ...cur, ...Object.keys((cfg && cfg.state_map) || {})])].filter((s) => s && !s.includes('.'));
  };
  // Sett modus: alarm_control_panel (med kode) på alarm-entiteten; ellers select/input_select.select_option med første
  // rå tilstand som er mappet til modusen.
  M.sikSetMode = function (hass, cfg, k, code, alarmId) {
    const m = MODES.find((x) => x[0] === k), alarm = alarmId || M.pick(cfg, 'alarm', M.all(hass, 'alarm_control_panel')[0] || null);
    if (!m) return Promise.reject(new Error('Ukjent modus'));
    if (alarm && hass.states[alarm]) return hass.callService('alarm_control_panel', m[4], { entity_id: alarm, ...(code ? { code } : {}) });
    const se = cfg && cfg.state_entity, d = se ? se.split('.')[0] : '';
    if (se && (d === 'select' || d === 'input_select') && hass.states[se]) {
      const opt = stStates(hass, cfg).find((s) => stMap(cfg, s).mode === k && s !== 'triggered');
      if (opt == null) return Promise.reject(new Error(`Ingen tilstand er koblet til ${m[1].toLowerCase()}`));
      return hass.callService(d, 'select_option', { entity_id: se, option: opt });
    }
    return Promise.reject(new Error('Ingen alarm valgt'));
  };
  // Siste kjente config for sikkerhetskortet (Hjem-flisen bruker samme state_map). Endring → Hjem-kortene tegnes på nytt.
  let sikCfgKey = '';
  M.sikSetCfg = function (cfg) {
    M._sikCfg = cfg || {};
    const k = JSON.stringify([M._sikCfg.overrides || null, M._sikCfg.state_entity || null, M._sikCfg.state_map || null]);
    if (k === sikCfgKey) return;
    const first = !sikCfgKey;
    sikCfgKey = k;
    if (first && !cfg.state_entity && !cfg.state_map) return;
    try { (M.liveCards || new Map()).forEach((set) => set.forEach((el) => { if (el && /^msh-hjem/.test(el.localName) && el.update) el.update(); })); } catch (e) { /* */ }
  };
  M.sikCfg = function () {
    if (M._sikCfg) return M._sikCfg;
    try {
      const own = M.store && M.store.card && M.store.card('pop-sikkerhet');
      if (own) return own;
      const cards = (M.store && M.store.view && (M.store.view() || {}).cards) || {};
      return Object.values(cards).find((c) => c && (c.state_entity || c.state_map || c.unlock_sensor)) || {};
    } catch (e) { return {}; }
  };

  /* Fiks 24.7 · «Hvem låste opp» (ansiktsgjenkjenning): tilstand = navnet → person.* (friendly_name / objekt-ID),
   * overstyring i unlock_people: { '<tilstand>': 'person.x' }. Avatar = entity_picture, ellers forbokstav i personfarge. */
  const UNLOCK_RE = /ansikt|face|last_opp|unlocked_by/i;
  const P_COLS = [C.pink, C.green, C.blue, C.orange, C.purple, C.yellow];
  M.sikUnlockAuto = (hass) => (hass ? Object.keys(hass.states).filter((id) => /^(sensor|input_text)\./.test(id) && UNLOCK_RE.test(id)).sort()[0] || null : null);
  M.sikUnlockSensor = (hass, cfg) => (cfg && cfg.unlock_sensor) || M.sikUnlockAuto(hass);
  M.sikPerson = function (hass, cfg, name) {
    name = String(name || '').trim();
    const norm = (s) => String(s || '').trim().toLowerCase();
    // personfarge etter rekkefølgen i HA (opprettelse, ikke alfabetisk): 1. rosa, 2. grønn, 3. blå …
    const P = Object.keys(hass.states).filter((x) => x.startsWith('person.')), map = (cfg && cfg.unlock_people) || {};
    const ov = Object.keys(map).find((k) => norm(k) === norm(name));
    let id = ov && map[ov] && hass.states[map[ov]] ? map[ov] : null;
    if (!id) id = P.find((p) => norm(hass.states[p].attributes.friendly_name) === norm(name) || norm(p.split('.')[1]) === norm(name).replace(/\s+/g, '_')) || null;
    const st = id ? hass.states[id] : null;
    const nm = st ? st.attributes.friendly_name || name : name;
    return { id, name: nm, pic: st && st.attributes.entity_picture ? st.attributes.entity_picture : '', initial: (nm || '?').trim().charAt(0).toUpperCase(), color: id ? P_COLS[Math.max(0, P.indexOf(id)) % P_COLS.length] : 'var(--gray500, #696969)' };
  };
  const UCACHE = new Map(); // sensor → { t, d: [{ s, t }] } (5 min, fallgruve 8)

  function battery(hass, id, st) {
    if (st.attributes.battery_level != null && M.isNum(st.attributes.battery_level)) return Math.round(Number(st.attributes.battery_level));
    const e = M.regEntry(hass, id);
    if (!e || !e.device_id || !hass.entities) return null;
    const b = Object.keys(hass.entities).find((x) => x.startsWith('sensor.') && hass.entities[x].device_id === e.device_id && hass.states[x] && hass.states[x].attributes.device_class === 'battery');
    return b && M.isNum(hass.states[b].state) ? Math.round(Number(hass.states[b].state)) : null;
  }

  // Autokonfig for sikkerhet: alarm + sensorliste (med overstyrt navn/type/rom fra config.sensors.<domene>.<objekt>).
  M.sikAuto = function (hass, cfg) {
    cfg = cfg || {};
    if (!hass) return { alarm: null, sensors: [], auto: [] };
    const alarm = M.pick(cfg, 'alarm', M.all(hass, 'alarm_control_panel')[0] || null);
    const auto = [...M.all(hass, 'lock'), ...M.all(hass, 'binary_sensor', (s) => AUTO_DC.includes(s.attributes.device_class))];
    const ids = M.applyLists(cfg, 'sensorer', auto).filter((id) => hass.states[id]);
    const order = M.areas(hass).map((a) => a.id);
    const sensors = ids.map((id) => {
      const st = hass.states[id], d = id.split('.')[0], obj = id.slice(d.length + 1);
      const o = (cfg.sensors && cfg.sensors[d] && cfg.sensors[d][obj]) || {};
      const autoType = d === 'lock' ? 'lock' : DC_TYPE[st.attributes.device_class] || guessType(id);
      const area = M.areaOf(hass, id), areaName = area ? M.areaName(hass, area) : null;
      const autoRoom = areaName || 'Annet';
      const autoName = stripRoom(st.attributes.friendly_name || obj.replace(/_/g, ' '), areaName);
      const type = TYPES.some((t) => t[0] === o.type) ? o.type : autoType;
      const un = M.unavailable(st);
      const on = !un && (d === 'lock' ? !['locked', 'locking'].includes(st.state) : st.state === 'on');
      return { id, domain: d, obj, st, type, autoType, room: o.room || autoRoom, autoRoom, name: o.name || autoName, autoName, on, un, bat: d === 'lock' ? battery(hass, id, st) : null, area, ai: area ? order.indexOf(area) : 999 };
    });
    sensors.sort((a, b) => (a.room === 'Annet') - (b.room === 'Annet') || a.ai - b.ai || a.room.localeCompare(b.room, 'nb') || TYPES.findIndex((t) => t[0] === a.type) - TYPES.findIndex((t) => t[0] === b.type) || a.name.localeCompare(b.name, 'nb'));
    return { alarm, sensors, auto };
  };
  const isAlert = (x) => (x.type === 'door' || x.type === 'window' || x.type === 'lock') && x.on;
  const iconOf = (x) => ({ door: x.on ? 'door_open' : 'door_front', window: x.on ? 'sensor_window' : 'window', lock: x.on ? 'lock_open' : 'lock', motion: x.on ? 'directions_run' : 'directions_walk', presence: 'person' })[x.type] || 'sensors';
  const colorOf = (x) => (isAlert(x) ? C.orange : x.on ? C.blue : null);
  // 35.4 · rom-seksjonen (2a): typenavn, tilstandsord, gruppenavn/-ikon for Type-visningen, «x min siden»
  const TLAB = { door: 'Dør', window: 'Vindu', lock: 'Lås', motion: 'Bevegelse', presence: 'Tilstede' };
  const TICON = { door: 'door_front', window: 'window', lock: 'lock', motion: 'directions_walk', presence: 'person' };
  const GNAME = { door: 'Dører', window: 'Vinduer', lock: 'Låser', motion: 'Bevegelse', presence: 'Tilstede' };
  const stateOf = (x) => (x.un ? '–' : ({ door: x.on ? 'Åpen' : 'Lukket', window: x.on ? 'Åpent' : 'Lukket', lock: x.on ? 'Ulåst' : 'Låst', motion: x.on ? 'Bevegelse nå' : 'Stille', presence: x.on ? 'Tilstede' : 'Ingen' })[x.type] || (x.on ? 'På' : 'Av'));
  const ago = (m) => (m < 60 ? Math.round(m) + ' min' : m < 1440 ? Math.round(m / 60) + ' t' : Math.round(m / 1440) + ' d');
  const summary = (S) => {
    const alerts = S.filter(isAlert), motion = S.filter((x) => (x.type === 'motion' || x.type === 'presence') && x.on);
    const headline = alerts.length
      ? `${[...new Set(alerts.map((x) => x.type))].map((t) => plural(alerts.filter((x) => x.type === t).length, ...WORDS[t])).join(' og ')} ${alerts.every((x) => x.type === 'lock') ? 'er ulåst' : 'er åpen'}`
      : S.length ? 'Alt er lukket og låst' : 'Ingen sensorer';
    const subline = `${motion.length ? plural(motion.length, 'sensor', 'sensorer') + ' registrerer bevegelse' : 'Ingen bevegelse'} · ${Math.max(0, S.length - alerts.length - motion.length)} i ro`;
    return { alerts, motion, headline, subline };
  };

  // Felles skjemadeler (kortets egen tilpasning = HA GUI-editor).
  const alarmOverride = { type: 'overrides', label: 'Alarm', fields: [{ name: 'alarm', label: 'Alarmpanel', domain: 'alarm_control_panel', auto: (h) => M.all(h, 'alarm_control_panel')[0] || null }] };
  // 24.6 · «Status og tekst»: status-entitet + én rad per tilstand (rå tilstand · «nå» · segment Av/Hjemme/Borte/Natt · tekst)
  const statusSection = () => ({ type: 'section', label: 'Status og tekst', icon: 'mdi:list-status', id: 'status', meta: (h, c) => { const id = M.sikStateEntity(h, c); return id ? id.split('.')[0] : 'ingen'; }, fields: [
    { type: 'entity', name: 'state_entity', label: 'Status-entitet', domain: ST_DOMAINS, domains: ST_DOMAINS, auto: (h, c) => M.pick(c, 'alarm', M.all(h, 'alarm_control_panel')[0] || null), help: 'Tom = alarmpanelet. Velg f.eks. select.* hvis alarmen melder status der.' },
    { type: 'html', html: (h, c) => {
      const S = stStates(h, c), id = M.sikStateEntity(h, c), st = id && h ? h.states[id] : null, now = st ? String(st.state) : null;
      if (!S.length) return `<div class="small" style="padding:0 6px">${esc(id ? `Fant ingen tilstander for ${id}` : 'Velg status-entitet')}</div>`;
      return S.map((raw) => {
        const m = stMap(c, raw), u = ((c.state_map || {})[raw]) || {};
        return `<div class="f" data-key="st-${esc(raw)}" style="gap:8px">
          <div class="line" style="gap:8px"><code style="font:500 13px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--ki-text, #fafafa);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0">${esc(raw)}</code>${raw === now ? `<span style="flex:none;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;color:var(--ki-on-accent, #2f2f2f);background:${C.pink}">nå</span>` : ''}</div>
          <div class="chips sg">${MODES.map((x) => `<button class="chip ${x[0] === m.mode ? 'on' : ''}" aria-selected="${x[0] === m.mode}" data-a="sel" data-name="state_map.${esc(raw)}.mode" data-v="${x[0]}">${esc(x[1])}</button>`).join('')}</div>
          <input class="inp" autocapitalize="off" autocorrect="off" spellcheck="false" inputmode="text" aria-label="Tekst for ${esc(raw)}" data-name="state_map.${esc(raw)}.text" value="${esc(u.text || '')}" placeholder="${esc(u.text ? '' : m.text)}">
        </div>`;
      }).join('');
    } },
  ] });
  // 24.7 · «Hvem låste opp»: sensor + personkobling per navn (tom = auto på navn/objekt-ID)
  const unlockFields = (h, c) => {
    const sid = M.sikUnlockSensor(h, c), P = h ? M.all(h, 'person') : [];
    const names = new Set(Object.keys(c.unlock_people || {}));
    const st = sid && h ? h.states[sid] : null;
    if (st && !['unknown', 'unavailable', ''].includes(st.state)) names.add(st.state);
    ((UCACHE.get(sid) || {}).d || []).forEach((p) => names.add(p.s));
    return [
      { type: 'entity', name: 'unlock_sensor', label: 'Hvem låste opp', domains: ['sensor', 'input_text'], domain: ['sensor', 'input_text'], auto: (hh) => M.sikUnlockAuto(hh), help: 'Tilstand = navnet på personen (f.eks. ansiktsgjenkjenning på døra). Tom = autoforslag.' },
      ...[...names].filter((n) => n && !String(n).includes('.')).map((n) => {
        const auto = M.sikPerson(h, { ...c, unlock_people: {} }, n);
        return { type: 'select', name: `unlock_people.${n}`, label: `«${n}» er`, options: [['', auto.id ? `Auto · ${auto.name}` : 'Auto · ukjent'], ...P.map((p) => [p, h.states[p].attributes.friendly_name || p])], default: '' };
      }),
    ];
  };
  const sensorLists = { type: 'lists', label: 'Sensorer', lists: (h, c) => [{ key: 'sensorer', label: 'Sensorer og låser', ids: M.sikAuto(h, c).auto, domains: ['binary_sensor', 'lock'] }] };
  const sensorEdit = (h, c) => {
    let S = [];
    try { S = M.sikAuto(h, c).sensors; } catch (e) { S = []; }
    const rooms = [...new Set(S.map((x) => x.room))];
    return { type: 'section', label: 'Sensorer · navn, type og rom', icon: 'mdi:tag-edit-outline', id: 'sensor_names', fields: rooms.length ? rooms.map((room) => ({ type: 'section', label: `${room} · ${S.filter((x) => x.room === room).length}`, fields: S.filter((x) => x.room === room).flatMap((x) => {
      const b = `sensors.${x.domain}.${x.obj}`;
      return [
        { type: 'info', label: `${x.name} · ${x.id}` },
        { type: 'text', name: b + '.name', label: 'Navn', auto: () => x.autoName },
        { type: 'select', name: b + '.type', label: 'Type', options: TYPES.map((t) => [t[0], t[1]]), default: x.autoType },
        { type: 'text', name: b + '.room', label: 'Rom', auto: () => x.autoRoom },
      ];
    }) })) : [{ type: 'info', label: 'Autokonfig fant ingen sensorer' }] };
  };

  /* ================================================================ hero */
  class SikkerhetHero extends M.Card {
    static get cardName() { return 'Sikkerhet · sensorring'; }
    static get defaults() { return { show_ring: true }; }
    static get schema() {
      return (h, c) => [
        alarmOverride,
        sensorLists,
        sensorEdit(h, c),
        { type: 'section', label: 'Visning', icon: 'mdi:eye-outline', id: 'view', fields: [{ type: 'boolean', name: 'show_ring', label: 'Sensorring · stor ring med alle sensorer', default: true }] },
      ];
    }
    get cardSize() { return 6; }
    set hass(h) { const o = this._hass; super.hass = h; if (o && isLight(o) !== isLight(h)) this.update(); }
    get hass() { return super.hass; }
    render() {
      markTheme(this, this.hass);
      const c = this.config, a = M.sikAuto(this.hass, c), S = a.sensors;
      S.forEach((x) => this.s(x.id));
      const al = this.s(a.alarm), mode = sikModeOf(this.hass, c), armed = !!(mode && mode.armed), stE = mode ? mode.A.st : this.s(M.sikStateEntity(this.hass, c));
      if (c.state_entity) this.s(c.state_entity);
      const { headline, subline } = summary(S);
      const n = S.length;
      const bars = n ? S : Array.from({ length: 24 }, () => null);
      const ring = c.show_ring === false ? '' : bars.map((x, i) => {
        const col = x ? colorOf(x) : null, deg = (360 / Math.max(bars.length, 1)) * i;
        const bg = col || (armed ? M.alpha(mode.color, 0.55) : 'var(--sk-ring-off)');
        return `<div class="bar" data-key="${esc(x ? x.id : 'p' + i)}" title="${esc(x ? `${x.room} · ${x.name}` : '')}" style="transform:rotate(${deg.toFixed(2)}deg) translateY(-110px);background:${bg};box-shadow:${col ? `0 0 14px ${M.alpha(col, 0.7)}` : 'none'}"></div>`;
      }).join('');
      const since = stE && !M.unavailable(stE) ? `${armed ? 'Aktivert' : 'Avslått'} ${when(new Date(stE.last_changed).getTime())}` : stE ? 'Utilgjengelig' : c.state_entity ? `Fant ikke ${c.state_entity}` : a.alarm ? 'Fant ikke alarmen' : 'Ingen alarm valgt';
      const core = armed ? `background:radial-gradient(circle at 50% 35%, ${tone(mode.color, 16)}, var(--sk-surface) 70%)` : '';
      return `
        <section class="hero">
          <div class="ring ${c.show_ring === false ? 'noring' : ''}">
            ${ring}
            <button class="core" data-act="core" ${stE ? `data-ent="${esc(stE.entity_id)}"` : ''} style="${core}">
              ${M.icon(mode ? mode.icon : 'mdi:shield-off-outline', 30, `color:${mode ? tx(mode.color) : 'var(--sk-mute)'}`)}
              <div class="ml">${esc(mode ? mode.label : '–')}</div>
              <div class="ms">${esc(since)}</div>
            </button>
          </div>
          <div class="txt">
            <div class="hl">${esc(headline)}</div>
            <div class="sl">${esc(n ? subline : 'Legg til sensorer i tilpasning')}</div>
          </div>
        </section>`;
    }
    onAction(name, el, ev) {
      if (name === 'core') {
        const a = M.sikAuto(this.hass, this.config);
        const se = M.sikStateEntity(this.hass, this.config);
        return se && this.hass.states[se] ? M.moreInfo(this, se) : this.customize('overrides');
      }
      return super.onAction(name, el, ev);
    }
    get styles() {
      return `${SK_THEME}
        .hero{display:flex;flex-direction:column;align-items:center;gap:20px;padding:4px 0 2px}
        .ring{position:relative;width:260px;height:260px;flex:none}
        .ring.noring{width:172px;height:172px}
        .ring.noring .core{inset:0}
        .bar{position:absolute;left:calc(50% - 4px);top:calc(50% - 16px);width:8px;height:32px;border-radius:4px;transition:background .4s,box-shadow .4s}
        .core{position:absolute;inset:44px;border-radius:50%;background:var(--sk-surface);box-shadow:inset 0 0 0 1px var(--sk-line),var(--sk-shadow);color:var(--sk-text);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;transition:background .4s,transform .15s}
        .core:active{transform:scale(.97)}
        .ml{font-size:26px;font-weight:500;letter-spacing:-0.02em}
        .ms{font-size:12px;color:var(--sk-mute)}
        .txt{display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center}
        .hl{font-size:24px;font-weight:500;letter-spacing:-0.015em;text-wrap:balance}
        .sl{font-size:14px;color:var(--sk-mute)}
      `;
    }
  }
  M.define('msh-sikkerhet-hero-card', SikkerhetHero, 'MSH Sikkerhet · sensorring', 'Toppkort for #sikkerhet: sensorring, alarmmodus og status. Legges først i popupen.');

  /* ================================================================ hovedkort */
  const PAD_CSS = `${SK_THEME}
    :host([data-ki-theme=light]) .bg{background:rgb(0 0 0 / 0.2)}
    .bg{background:rgba(10,10,12,0.6);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
    .sh{left:16px;right:16px;padding:22px 20px 20px;border-radius:34px;background:var(--sk-surface);color:var(--sk-text);box-shadow:0 20px 50px ${M.theme && M.theme.blackA ? M.theme.blackA(0.55) : 'rgb(0 0 0 / 0.55)'};scrollbar-width:none}
    .sh::-webkit-scrollbar{display:none}
    .pad{position:relative;display:flex;flex-direction:column;align-items:center;gap:16px}
    .x{position:absolute;top:-8px;right:-6px;width:40px;height:40px;border-radius:20px;background:var(--sk-surface-2);display:grid;place-items:center;color:var(--sk-g9)}
    .hd{display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center}
    .iw{width:56px;height:56px;border-radius:28px;display:grid;place-items:center}
    .tt{font-size:20px;font-weight:600}
    .msg{font-size:13px;color:var(--sk-mid)}
    .msg.err{color:var(--sk-red);font-weight:600}
    .dots{display:flex;gap:16px;height:16px;align-items:center;transition:transform .2s}
    .dots.err{animation:msh-shake .36s cubic-bezier(.36,.07,.19,.97)}
    .dot{width:14px;height:14px;border-radius:7px;box-shadow:inset 0 0 0 1.5px var(--sk-mute);transition:background .12s}
    .dot.on{background:var(--sk-text);box-shadow:none}
    .dots.err .dot{background:var(--red,#f28073);box-shadow:none}
    .keys{display:grid;grid-template-columns:repeat(3,68px);gap:10px 20px}
    .k{width:68px;height:68px;border-radius:34px;display:grid;place-items:center;background:var(--sk-surface-2);color:var(--sk-text);font-size:30px;font-weight:400;font-variant-numeric:tabular-nums;transition:transform .1s,background .1s;touch-action:manipulation}
    .k:active{transform:scale(0.92);background:var(--sk-g4)}
    .k.ic{background:transparent;color:var(--sk-text-2)}
    .k.ic:active{background:var(--sk-g4)}
    button{font:inherit;color:inherit;border:0;background:none;padding:0;cursor:pointer;-webkit-tap-highlight-color:transparent}
    @keyframes msh-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(6px)}40%{transform:translateX(-6px)}60%{transform:translateX(4px)}80%{transform:translateX(-3px)}}
  `;

  class Sikkerhet extends M.Card {
    static get cardName() { return 'Sikkerhet'; }
    static get defaults() { return { code_for: 'alle', code_length: 4, show_hint: true, show_log: true, toasts: true }; }
    // 35.4: Rom/Type-bryteren i rom-seksjonen huskes per enhet (UI-tilstand, ikke config)
    static get uiPersist() { return ['rview']; }
    static get schema() {
      return (h, c) => [
        alarmOverride,
        statusSection(),
        { type: 'section', label: 'Kode', icon: 'mdi:dialpad', id: 'code', fields: [
          { type: 'select', name: 'code_for', label: 'Krev kode', options: [['alle', 'Alle endringer'], ['av', 'Bare for å slå av'], ['aldri', 'Aldri']], default: 'alle' },
          { type: 'select', name: 'code_length', label: 'Kodelengde', options: [[4, '4 siffer'], [6, '6 siffer']], default: 4 },
          { type: 'info', label: 'Koden du taster sendes med alarm_control_panel.alarm_disarm / alarm_arm_* – den lagres ikke i dashbordet.' },
        ] },
        sensorLists,
        sensorEdit(h, c),
        { type: 'section', label: 'Siste hendelser · hvem låste opp', icon: 'mdi:face-recognition', id: 'unlock', fields: unlockFields(h, c) },
        { type: 'order', name: 'sections', hiddenName: 'hidden_sections', label: 'Rekkefølge på seksjoner', options: [['modes', 'Modus'], ['rooms', 'Rom'], ['log', 'Siste hendelser'], ['edit', 'Tilpass-knapp']] },
        { type: 'section', label: 'Visning', icon: 'mdi:eye-outline', id: 'view', fields: [
          { type: 'boolean', name: 'show_hint', label: 'Hjelpetekst · «Hold inne for å bytte modus»', default: true, help: 'Vises alltid mens du holder inne en modus' },
          { type: 'boolean', name: 'show_log', label: 'Siste hendelser · logg nederst', default: true },
          { type: 'select', name: 'room_view', label: 'Rom-seksjonen viser først', options: [['rom', 'Rom'], ['type', 'Type']], default: 'rom' },
          { type: 'boolean', name: 'toasts', label: 'Bekreftelsesmeldinger (toast)', default: true },
        ] },
        { type: 'gap' },
      ];
    }
    get cardSize() { return 8; }
    setConfig(cfg) { super.setConfig(cfg); M.sikSetCfg(this.config); }
    onOpen() { this._loadLog(); }
    onClose() { if (this._ov) this._ov.close(); this._cancelHoldAnim(); }
    async _loadLog() {
      const a = M.sikAuto(this.hass, this.config);
      const ids = [...new Set([a.alarm, M.sikStateEntity(this.hass, this.config), ...a.sensors.map((x) => x.id)])].filter(Boolean);
      if (!this.hass || !this.hass.callWS) return;
      const us = M.sikUnlockSensor(this.hass, this.config), uP = us ? this._loadUnlock(us) : null;
      if (ids.length) {
        try {
          const r = await this.hass.callWS({ type: 'logbook/get_events', start_time: new Date(Date.now() - 86400000).toISOString(), end_time: new Date().toISOString(), entity_ids: ids });
          this._log = (Array.isArray(r) ? r : []).filter((e) => e && e.entity_id && e.state != null && e.when != null)
            .map((e) => ({ id: e.entity_id, state: String(e.state), t: typeof e.when === 'number' ? e.when * 1000 : new Date(e.when).getTime(), user: e.context_user_id || null }));
          this._logT = Date.now();
        } catch (e) { this._log = []; this._logT = 0; }
      }
      if (uP) await uP;
      this.update();
    }
    // 24.7 · historikk for «hvem låste opp» (siste 24 t, minimal_response/no_attributes, 5 min cache). Hver endring = én hendelse.
    async _loadUnlock(us) {
      const c0 = UCACHE.get(us), now = Date.now();
      if (c0 && now - c0.t < 300000) { this._ulog = c0.d; return; }
      const start = now - 86400000;
      try {
        const r = await this.hass.callWS({ type: 'history/history_during_period', start_time: new Date(start).toISOString(), end_time: new Date(now).toISOString(), entity_ids: [us], minimal_response: true, no_attributes: true, significant_changes_only: false });
        const pts = ((r && r[us]) || []).map((p) => ({ s: String(p.s != null ? p.s : p.state != null ? p.state : ''), t: p.lu != null ? p.lu * 1000 : p.lc != null ? p.lc * 1000 : new Date(p.last_changed || p.last_updated).getTime() }));
        // første punkt = tilstanden ved start (ingen endring); tom/unknown/unavailable ignoreres
        const d = pts.filter((p, i) => i > 0 && p.t > start + 2000 && p.s !== pts[i - 1].s && p.s.trim() && !['unknown', 'unavailable'].includes(p.s));
        UCACHE.set(us, { t: now, d });
        this._ulog = d;
      } catch (e) { this._ulog = []; }
    }
    _toast(t) { if (this.config.toasts !== false) M.toast(t); }
    _needCode(k, al) {
      const f = this.config.code_for || 'alle';
      if (!al || al.attributes.code_format == null || f === 'aldri') return false;
      if (f === 'av') return k === 'av';
      return k === 'av' || al.attributes.code_arm_required !== false || f === 'alle';
    }
    _supported(m, al) {
      if (!al || !m[6]) return !!al;
      const sf = al.attributes.supported_features;
      return sf == null || (Number(sf) & m[6]) !== 0;
    }
    // Én logglinje ut fra entitet + tilstand.
    _entry(a, S, id, state, t, user) {
      if (a.us && id === a.us) { // 24.7: «<navn> låste opp <sted>» med personens avatar
        if (!state || !String(state).trim() || ['unknown', 'unavailable'].includes(state)) return null;
        const p = M.sikPerson(this.hass, this.config, state);
        return { text: `${p.name} låste opp ${a.place}`, who: 'Ansiktsgjenkjenning', t, kind: 'person', person: p };
      }
      if (id === a.alarm && a.se && a.se !== a.alarm) return null; // status kommer fra state_entity (24.6)
      if (id === a.se || id === a.alarm) {
        if (['unavailable', 'unknown'].includes(state)) return null;
        const m = stMap(this.config, state), busy = ['arming', 'pending', 'disarming'].includes(state);
        const text = state === 'triggered' ? 'Alarm utløst' : busy ? `Alarm: ${m.text.toLowerCase()}` : m.mode === 'av' ? 'Alarm slått av' : `Alarm satt til ${m.text.toLowerCase()}`;
        const me = user && this.hass.user && user === this.hass.user.id;
        return { text, who: me ? 'Deg' : 'Alarmpanel', t, kind: state === 'triggered' ? 'alert' : 'mode' };
      }
      const x = S.find((y) => y.id === id);
      if (!x || ['unavailable', 'unknown'].includes(state)) return null;
      const place = x.room !== 'Annet' ? x.room : x.name;
      if (x.type === 'lock') {
        const T = { locked: ['låst', 'ok'], unlocked: ['låst opp', 'alert'], open: ['åpnet', 'alert'], jammed: ['har satt seg fast', 'alert'] }[state];
        return T ? { text: `${x.name === 'Lås' ? place : x.name} ${T[0]}`, who: WHO.lock, t, kind: T[1] } : null;
      }
      if (x.type === 'motion' || x.type === 'presence') return state === 'on' ? { text: x.type === 'motion' ? `Bevegelse i ${place.toLowerCase()}` : `Noen i ${place.toLowerCase()}`, who: WHO[x.type], t, kind: 'motion' } : null;
      return { text: `${place} ${state === 'on' ? 'åpnet' : 'lukket'}`, who: WHO[x.type] || 'Sensor', t, kind: state === 'on' ? 'alert' : 'ok' };
    }
    _events(a, S, al) {
      const h = this.hass, c = this.config, se = M.sikStateEntity(h, c), us = M.sikUnlockSensor(h, c);
      const place = (() => { // sted for «låste opp»: sensorens rom → første lås sitt rom → «døra»
        const ar = us && M.areaOf(h, us), lk = S.find((x) => x.type === 'lock' && x.room !== 'Annet');
        return (ar ? M.areaName(h, ar) : lk ? lk.room : 'døra').toLowerCase();
      })();
      a = { ...a, se, us, place };
      const raw = (this._log || []).slice();
      if (us) {
        (this._ulog || []).forEach((p) => raw.push({ id: us, state: p.s, t: p.t }));
        const ust = this.s(us), ut = ust && ust.last_changed ? new Date(ust.last_changed).getTime() : 0;
        if (ut > Date.now() - 86400000) raw.push({ id: us, state: ust.state, t: ut }); // ny opplåsing siden historikken ble hentet
      }
      // Live endringer etter at loggen ble hentet (logbook feilet → siste døgn fra state).
      const since = this._logT ? this._logT - 1000 : Date.now() - 86400000;
      if (this._log) [al, se && se !== a.alarm ? this.s(se) : null, ...S.map((x) => x.st)].forEach((st) => { const t = st && st.last_changed ? new Date(st.last_changed).getTime() : 0; if (t > since) raw.push({ id: st.entity_id, state: st.state, t }); });
      const seen = new Set(), out = [];
      raw.sort((x, y) => y.t - x.t).forEach((e) => {
        const k = `${e.id}|${e.state}|${Math.round(e.t / 2000)}`;
        if (seen.has(k)) return;
        seen.add(k);
        const en = this._entry(a, S, e.id, e.state, e.t, e.user);
        if (en) out.push(en);
      });
      return out.slice(0, 5);
    }
    set hass(h) { const o = this._hass; super.hass = h; if (o && isLight(o) !== isLight(h)) this.update(); }
    get hass() { return super.hass; }
    /* 35.4 · Rom-seksjonen (variant 2a, «Sikkerhet rom-varianter.dc.html»): statusstripe Åpne/Bevegelse/Rom rolig,
     * rom med aktivitet som store kort øverst, rolige rom som piller i 2 kolonner, trykk åpner sensorlista, Rom/Type-bryter.
     * Data: M.sikAuto (områder + binary_sensor/lock, overstyrt navn/type/rom). */
    _rooms(S) {
      const names = [...new Set(S.map((x) => x.room))];
      return names.map((name) => {
        const sensors = S.filter((x) => x.room === name);
        const nAl = sensors.filter(isAlert).length, nMv = sensors.filter((x) => x.on && !isAlert(x)).length, hot = !!(nAl || nMv);
        const sc = nAl ? C.orange : nMv ? C.blue : C.green;
        const top = sensors.find(isAlert) || sensors.find((x) => x.on) || sensors[0];
        const word = nAl ? (nAl === 1 ? '1 åpen' : nAl + ' åpne') : nMv ? 'Bevegelse' : 'Rolig';
        let headline = 'Rolig';
        if (nAl) headline = `${stateOf(top)} · ${TLAB[top.type].toLowerCase()}`;
        else if (nMv) { const t = top.st && top.st.last_changed ? new Date(top.st.last_changed).getTime() : NaN, m = (Date.now() - t) / 60000; headline = !isFinite(m) || m < 1 ? 'Bevegelse nå' : `Bevegelse · ${ago(m)} siden`; }
        return { name, sensors, nAl, nMv, hot, sc, top, word, headline };
      });
    }
    _roomsHTML(S) {
      if (!S.length) return `<section class="sec rms" data-section="rooms"><div class="rh"><div class="cap">Rom</div></div>${M.emptyState('Fant ingen dør-, vindus- eller bevegelsessensorer', 'entities')}</section>`;
      const view = this.ui.rview || this.config.room_view || 'rom', rooms = this._rooms(S);
      const totAl = rooms.reduce((n, r) => n + r.nAl, 0), totMv = rooms.reduce((n, r) => n + r.nMv, 0), calm = rooms.filter((r) => !r.hot);
      const seg = [['rom', 'Rom'], ['type', 'Type']].map(([k, l]) => `<button class="rsg ${view === k ? 'on' : ''}" data-act="rview" data-v="${k}" data-haptic="selection" aria-pressed="${view === k}">${l}</button>`).join('');
      const stat = (n, label, col) => `<div class="rst" style="${n && col ? `background:${tone(col, 12)}` : ''}"><span class="rsn" style="${n && col ? `color:${toneTx(col)}` : ''}">${n}</span><span class="rsl">${label}</span></div>`;
      const mid = (x) => { const col = colorOf(x); return `<span class="smid" style="${col ? `background:${col};color:var(--sk-on-acc)` : ''}">${M.icon(iconOf(x), 17)}</span>`; };
      let body = '';
      if (view === 'type') {
        const groups = ['door', 'window', 'lock', 'motion', 'presence'].map((t) => {
          const L = S.filter((x) => x.type === t);
          if (!L.length) return '';
          const multi = (x) => L.filter((y) => y.room === x.room).length > 1 || (x.room === 'Annet' && x.name !== TLAB[t]);
          const rows = L.map((x) => ({ x, col: colorOf(x) })).sort((p, q) => !!q.col - !!p.col);
          const act = rows.filter((r) => r.col).length, mv = t === 'motion' || t === 'presence', lk = t === 'lock';
          const sum = act ? `${act} av ${rows.length} ${mv ? 'aktiv' : lk ? 'ulåst' : 'åpen'}` : `Alle ${rows.length} ${mv ? 'stille' : lk ? 'låst' : 'lukket'}`;
          return `<div class="rgp" data-key="tg-${t}"><div class="rgh">${M.icon(TICON[t], 20, 'color:var(--sk-g9)')}<span class="rgn">${GNAME[t]}</span><span class="rsum" style="color:${act ? (mv ? 'var(--sk-blue)' : 'var(--sk-amber)') : 'var(--sk-mid)'}">${esc(sum)}</span></div>
            ${rows.map(({ x, col }) => `<button class="rgr" data-act="sens" data-ent="${esc(x.id)}" data-key="tr-${esc(x.id)}"><span class="rdot" style="${col ? `background:${col}` : ''}"></span><span class="rgrn">${esc(multi(x) ? `${x.room} · ${x.name}` : x.room)}</span><span class="rgs" style="${col ? `color:${tx(col)}` : ''}">${esc(stateOf(x))}</span></button>`).join('')}</div>`;
        }).join('');
        body = groups;
      } else {
        const open = rooms.find((r) => r.name === this.ui.ropen) || null;
        const att = rooms.filter((r) => r.hot).map((r) => `<button class="rac press" data-act="room" data-room="${esc(r.name)}" data-key="ra-${esc(r.name)}" style="background:${tone(r.sc, 12)};box-shadow:inset 0 0 0 1.5px ${M.alpha(r.sc, 0.4)}${open === r ? ',inset 0 0 0 2.5px var(--pink, #f285c9)' : ''}">
            <span class="raic" style="background:${r.sc}">${M.icon(iconOf(r.top), 22)}</span>
            <span class="rat"><span class="ran">${esc(r.name)}</span><span class="rsub" style="color:${toneTx(r.sc)}">${esc(r.headline)}</span></span>
            <span class="ram">${r.sensors.slice(0, 4).map(mid).join('')}</span>
          </button>`).join('');
        const pills = calm.length ? `<div class="rcalm">${calm.map((r) => `<button class="rpl press ${open === r ? 'on' : ''}" data-act="room" data-room="${esc(r.name)}" data-key="rp-${esc(r.name)}">
            <span class="rpic">${M.icon(iconOf(r.top), 18)}</span>
            <span class="rat"><span class="rpn">${esc(r.name)}</span><span class="rsub">${esc(r.word)}</span></span>
          </button>`).join('')}</div>` : '';
        const list = open ? `<div class="rol" data-key="rol-${esc(open.name)}"><div class="rolh"><span class="roln">${esc(open.name)}</span><button class="rolx" data-act="rclose" data-haptic="light" title="Lukk">${M.icon('close', 18)}</button></div>
            ${open.sensors.map((x) => { const col = colorOf(x); return `<button class="rolr" data-act="sens" data-ent="${esc(x.id)}" data-key="or-${esc(x.id)}">${mid(x)}<span class="rolt">${esc(x.name)}</span><span class="rols" style="${col ? `color:${tx(col)}` : ''}">${esc(stateOf(x) + (x.type === 'lock' && x.bat != null ? ` · ${x.bat} %` : ''))}</span></button>`; }).join('')}</div>` : '';
        body = att + pills + list;
      }
      return `<section class="sec rms" data-section="rooms">
        <div class="rh"><div class="cap">Rom</div><div class="rseg">${seg}</div></div>
        <div class="rstats">${stat(totAl, 'Åpne', C.orange)}${stat(totMv, 'Bevegelse', C.blue)}${stat(calm.length, 'Rom rolig', null)}</div>
        ${body}
      </section>`;
    }
    render() {
      markTheme(this, this.hass);
      const c = this.config, a = M.sikAuto(this.hass, c), S = a.sensors;
      S.forEach((x) => this.s(x.id));
      const al = this.s(a.alarm), mode = sikModeOf(this.hass, c);
      if (c.state_entity) this.s(c.state_entity);
      const selOnly = !al && !!mode && /^(select|input_select)\./.test(c.state_entity || ''); // 24.6: select uten alarmpanel
      const hold = this._mh;
      const hint = hold ? `Hold for å sette ${MODES.find((m) => m[0] === hold.k)[1].toLowerCase()}…` : selOnly ? `${mode.label} · hold inne for å bytte modus` : !al ? 'Ingen alarm valgt' : c.code_for === 'aldri' ? 'Hold inne for å bytte modus' : c.code_for === 'av' ? 'Hold inne for å bytte modus · kode for å slå av' : 'Hold inne for å bytte modus · krever kode';
      const codeNeeded = !!al && c.code_for !== 'aldri' && !(al && al.attributes.code_format == null);
      // 35.4: hjelpeteksten kan skjules (show_hint), men vises alltid mens man holder inne
      const hintOff = c.show_hint === false && !hold;

      const sec = {};
      sec.modes = `
        <section class="sec modes-s" data-section="modes">
          <div class="modes">${MODES.map((m) => {
            const act = mode && mode.key === m[0], holding = hold && hold.k === m[0], ok = selOnly || this._supported(m, al);
            return `<button class="mode ${act ? 'act' : ''} ${ok ? '' : 'dis'}" data-mode="${m[0]}" data-key="m-${m[0]}" style="background:${act ? tone(m[3], 18) : 'transparent'};box-shadow:${act ? `inset 0 0 0 1px ${M.alpha(m[3], 0.45)}` : 'none'};color:${act ? 'var(--sk-text)' : 'var(--sk-mid)'}">
              <div class="fill" style="width:${holding ? (hold.p * 100).toFixed(1) : 0}%;background:${tone(m[3], 28)}"></div>
              ${M.icon(m[2], 21, `position:relative;color:${act || holding ? tx(m[3]) : 'var(--sk-mid)'}`)}
              <span class="mlab">${m[1]}</span>
            </button>`;
          }).join('')}</div>
          <div class="hint ${hintOff ? 'off' : ''}">${codeNeeded ? M.icon('dialpad', 13) : ''}<span class="ht">${esc(hint)}</span></div>
          ${al || selOnly ? '' : M.emptyState(a.alarm ? `Fant ikke ${a.alarm}` : 'Fant ingen alarm_control_panel', 'overrides')}
        </section>`;
      sec.rooms = this._roomsHTML(S);
      if (c.show_log !== false) {
        const ev = this._events(a, S, al);
        sec.log = `
          <section class="sec" data-section="log">
            <div class="cap" style="padding:0 4px">Siste hendelser</div>
            <div class="log ${ev.some((e) => e.person) ? 'wide' : ''}">${ev.length ? ev.map((e, i) => {
              const col = e.kind === 'alert' ? C.orange : e.kind === 'motion' ? C.blue : e.kind === 'mode' ? 'var(--sk-text)' : C.green, p = e.person;
              const pic = p && p.pic ? (M.hjemPicUrl ? M.hjemPicUrl(this.hass, p.pic) : p.pic) : '';
              const dot = p ? `<span class="eva" title="${esc(p.id || p.name)}" style="background:${pic ? 'var(--sk-surface-2)' : p.color}">${pic ? `<img src="${esc(pic)}" alt="">` : esc(p.initial)}</span>` : `<span class="evd" style="background:${col}"></span>`;
              return `<div class="ev" data-key="ev-${i}"><div class="evl">${dot}<span class="evline" style="background:${i < ev.length - 1 ? 'var(--sk-line-2)' : 'transparent'}"></span></div>
                <div class="evb"><div class="col" style="gap:2px"><div style="font-size:14px">${esc(e.text)}</div><div class="evw">${esc(e.who)}</div></div><div class="evw num">${esc(when(e.t))}</div></div></div>`;
            }).join('') : `<div class="evw" style="padding:0 0 4px">${this._log ? 'Ingen hendelser siste døgn' : 'Henter …'}</div>`}</div>
          </section>`;
      }
      sec.edit = `<button class="own press" data-act="customize" data-section="edit">${M.icon('tune', 20)}Tilpass oppsett</button>`;
      const keys = ['modes', 'rooms', 'log', 'edit'];
      let order = Array.isArray(c.sections) ? c.sections.filter((k) => keys.includes(k)) : [];
      keys.forEach((k) => { if (!order.includes(k)) order.push(k); });
      const hid = new Set(c.hidden_sections || []);
      return `<div class="wrap">${order.filter((k) => !hid.has(k)).map((k) => sec[k] || '').join('')}</div>`;
    }
    onAction(name, el, ev) {
      const d = el.dataset;
      if (name === 'rview') return this.setUI({ rview: d.v === 'type' ? 'type' : 'rom', ropen: null });
      if (name === 'room') return this.setUI({ ropen: this.ui.ropen === d.room ? null : d.room });
      if (name === 'rclose') return this.setUI({ ropen: null });
      if (name === 'sens') return M.moreInfo(this, d.ent);
      return super.onAction(name, el, ev);
    }
    afterRender() {
      this.shadowRoot.querySelectorAll('.mode').forEach((b) => {
        if (b.__b) return;
        b.__b = true;
        M.guardDrag(b, 'none');
        b.addEventListener('pointerdown', (e) => { if (e.button) return; this._startHold(b.dataset.mode); });
        ['pointerup', 'pointerleave', 'pointercancel'].forEach((t) => b.addEventListener(t, () => this._cancelModeHold()));
        b.addEventListener('contextmenu', (e) => e.preventDefault());
      });
    }
    /* ---------- hold inne for å bytte modus (900 ms) */
    _startHold(k) {
      const a = M.sikAuto(this.hass, this.config), al = this.hass.states[a.alarm], mode = sikModeOf(this.hass, this.config), m = MODES.find((x) => x[0] === k);
      const se = this.config.state_entity, selOnly = !al && !!se && /^(select|input_select)\./.test(se) && !!this.hass.states[se];
      if (!al && !selOnly) { M.haptic('warning'); return this.customize('overrides'); }
      if (!m || (mode && mode.key === k)) return;
      if (al && !this._supported(m, al)) { M.haptic('failure'); return this._toast(`${m[1]} støttes ikke av alarmen`); }
      this._cancelHoldAnim();
      M.haptic('selection');
      const t0 = performance.now();
      this._mh = { k, p: 0 };
      const step = () => {
        if (!this._mh) return;
        const p = Math.min(1, (performance.now() - t0) / 900);
        this._mh.p = p;
        const b = this.shadowRoot.querySelector(`.mode[data-mode="${k}"]`);
        if (b) { b.querySelector('.fill').style.width = (p * 100).toFixed(1) + '%'; const ic = b.querySelector('ha-icon'); if (ic) ic.style.color = m[3]; }
        const ht = this.shadowRoot.querySelector('.ht'), hn = this.shadowRoot.querySelector('.hint');
        if (ht) ht.textContent = `Hold for å sette ${m[1].toLowerCase()}…`;
        if (hn) hn.classList.remove('off'); // 35.4: hjelpeteksten vises alltid midlertidig mens man holder inne
        if (p < 1) { this._rafH = requestAnimationFrame(step); return; }
        this._mh = null;
        this.update();
        if (this._needCode(k, al)) this._openPad(k);
        else this._apply(k);
      };
      this._rafH = requestAnimationFrame(step);
    }
    _cancelHoldAnim() { if (this._rafH) cancelAnimationFrame(this._rafH); this._rafH = 0; }
    _cancelModeHold() {
      if (!this._mh) return;
      this._cancelHoldAnim();
      this._mh = null;
      this.update();
    }
    async _apply(k, code) {
      const m = MODES.find((x) => x[0] === k);
      if (!m) return false;
      try {
        await M.sikSetMode(this.hass, this.config, k, code); // alarm_control_panel.* (med kode) – eller select_option (24.6)
        M.haptic('success');
        this._toast(k === 'av' ? 'Alarm slått av' : `Alarm satt til ${m[1].toLowerCase()}`);
        return true;
      } catch (e) {
        M.haptic('failure');
        if (!code) M.toast('Feil: ' + (e && e.message ? e.message : e));
        return false;
      }
    }
    /* ---------- tastatur (portalert overlegg, sentrert i dashbordflaten) */
    _openPad(k) {
      if (this._ov) this._ov.close();
      this._pad = { k, entry: '', err: false };
      const ov = M.overlay({ center: true, maxWidth: 360, css: PAD_CSS, html: '', onClose: () => { this._pad = null; this._ov = null; window.removeEventListener('keydown', onKey); } });
      this._ov = ov;
      markTheme(ov.host, this.hass);
      const onKey = (e) => {
        if (!this._pad) return;
        if (/^[0-9]$/.test(e.key)) { M.haptic('selection'); this._press(e.key); } else if (e.key === 'Backspace') { M.haptic('selection'); this._pad.entry = this._pad.entry.slice(0, -1); this._padRender(); }
      };
      window.addEventListener('keydown', onKey);
      ov.root.addEventListener('click', (e) => {
        const b = e.composedPath().find((n) => n.dataset && n.dataset.k);
        if (!b) return;
        const key = b.dataset.k;
        if (key === 'close') { M.haptic('light'); return ov.close(); }
        M.haptic('selection');
        if (key === 'backspace') { if (this._pad && !this._pad.err) { this._pad.entry = this._pad.entry.slice(0, -1); this._padRender(); } return; }
        this._press(key);
      });
      this._padRender();
    }
    _press(d) {
      const p = this._pad;
      if (!p || p.err || p.busy) return;
      const len = Number(this.config.code_length) || 4;
      p.entry = (p.entry + d).slice(0, len);
      this._padRender();
      if (p.entry.length === len) {
        p.busy = true;
        setTimeout(async () => {
          const ok = await this._apply(p.k, p.entry);
          p.busy = false;
          if (ok) { if (this._ov) this._ov.close(); return; }
          p.err = true;
          this._padRender();
          setTimeout(() => { if (this._pad === p) { p.err = false; p.entry = ''; this._padRender(); } }, 900);
        }, 120);
      }
    }
    _padRender() {
      const p = this._pad, ov = this._ov;
      if (!p || !ov) return;
      const m = MODES.find((x) => x[0] === p.k), len = Number(this.config.code_length) || 4;
      const html = `<div class="pad">
        <button class="x" data-k="close" title="Lukk">${M.icon('close', 22)}</button>
        <div class="hd">
          <span class="iw" style="background:${tone(m[3], 20)};color:${tx(m[3])}">${M.icon(m[2], 28)}</span>
          <span class="tt">${p.k === 'av' ? 'Slå av alarmen' : `Sett alarm til ${m[1].toLowerCase()}`}</span>
          <span class="msg ${p.err ? 'err' : ''}">${p.err ? 'Feil kode – prøv igjen' : `Skriv inn ${len}-sifret kode`}</span>
        </div>
        <div class="dots ${p.err ? 'err' : ''}">${Array.from({ length: len }, (_, i) => `<span class="dot ${i < p.entry.length ? 'on' : ''}"></span>`).join('')}</div>
        <div class="keys">${['1', '2', '3', '4', '5', '6', '7', '8', '9', 'close', '0', 'backspace'].map((k) => {
          const ic = k === 'close' || k === 'backspace';
          return `<button class="k ${ic ? 'ic' : ''}" data-k="${k}" title="${k === 'close' ? 'Avbryt' : k === 'backspace' ? 'Slett' : k}">${ic ? M.icon(k, 26) : k}</button>`;
        }).join('')}</div>
      </div>`;
      M.morph(ov.body, html);
    }
    get styles() {
      return `${SK_THEME}
        .wrap{display:flex;flex-direction:column;gap:var(--msh-gap, 22px)}
        .sec{display:flex;flex-direction:column;gap:8px}
        .modes{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;padding:5px;border-radius:22px;background:var(--sk-surface);box-shadow:var(--sk-shadow)}
        .mode{position:relative;overflow:hidden;height:64px;border-radius:17px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;touch-action:none;user-select:none;-webkit-user-select:none;transition:background .25s}
        .mode.dis{opacity:.35}
        .fill{position:absolute;left:0;top:0;bottom:0}
        .mlab{position:relative;font-size:12px;font-weight:500}
        .hint{display:flex;align-items:center;justify-content:center;gap:4px;font-size:11px;color:var(--sk-dim);text-align:center}
        .hint.off{display:none}
        .cap{font-size:12px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;color:var(--sk-mute);padding:0 4px}
        /* 35.4 · rom (variant 2a) */
        .rms{gap:10px}
        .rh{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0 4px}
        .rh .cap{padding:0}
        .rseg{display:flex;gap:2px;padding:3px;border-radius:20px;background:var(--sk-surface);box-shadow:var(--sk-shadow);flex:none}
        .rsg{height:32px;padding:0 16px;border-radius:16px;font-size:13px;font-weight:500;color:var(--sk-text-2);transition:background .2s,color .2s}
        .rsg.on{background:${C.accent};color:var(--sk-on-acc)}
        .rstats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
        .rst{padding:12px 14px;border-radius:20px;display:flex;flex-direction:column;gap:2px;background:var(--sk-surface);box-shadow:var(--sk-shadow);min-width:0}
        .rsn{font-size:28px;font-weight:300;line-height:1;color:var(--sk-text);font-variant-numeric:tabular-nums}
        .rsl{font-size:12px;color:var(--sk-text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .rac{width:100%;text-align:left;display:flex;align-items:center;gap:12px;min-height:72px;padding:0 14px 0 12px;border-radius:24px;transition:transform .12s}
        .rac:active{transform:scale(.98)}
        .raic{width:48px;height:48px;border-radius:24px;flex:none;display:grid;place-items:center;color:var(--sk-on-acc)}
        .rat{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;text-align:left}
        .ran{font-size:15px;font-weight:600;overflow-wrap:anywhere}
        .rsub{font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--sk-mid)}
        .ram{display:flex;gap:4px;flex:none}
        .smid{width:30px;height:30px;border-radius:15px;flex:none;display:grid;place-items:center;background:var(--sk-surface-3);color:var(--sk-mid)}
        .rcalm{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
        .rpl{min-height:56px;box-sizing:border-box;padding:8px 12px 8px 8px;border-radius:28px;display:flex;align-items:center;gap:10px;min-width:0;background:var(--sk-surface);box-shadow:inset 0 0 0 1px var(--sk-line),var(--sk-shadow);transition:background .2s,transform .12s}
        .rpl:active{transform:scale(.97)}
        .rpl.on{background:var(--sk-surface-2);box-shadow:inset 0 0 0 1.5px var(--pink, #f285c9)}
        .rpic{width:36px;height:36px;border-radius:18px;flex:none;display:grid;place-items:center;background:var(--sk-surface-3);color:var(--sk-text-2)}
        .rpn{font-size:13px;font-weight:600;line-height:1.15;overflow-wrap:anywhere}
        .rol,.rgp{display:flex;flex-direction:column;border-radius:24px;background:var(--sk-surface);box-shadow:var(--sk-shadow);overflow:hidden}
        .rolh{display:flex;align-items:center;gap:10px;padding:12px 10px 8px 16px}
        .roln{flex:1;min-width:0;font-size:15px;font-weight:600;overflow-wrap:anywhere}
        .rolx{width:32px;height:32px;border-radius:16px;flex:none;display:grid;place-items:center;background:var(--sk-surface-3);color:var(--sk-text-2)}
        .rolr{display:flex;align-items:center;gap:12px;min-height:52px;padding:0 16px;border-top:1px solid var(--sk-line);text-align:left;width:100%}
        .rolt{flex:1;min-width:0;font-size:13px;overflow-wrap:anywhere}
        .rols{font-size:13px;font-weight:500;color:var(--sk-mid);flex:none}
        .rgh{display:flex;align-items:center;gap:10px;padding:12px 14px 8px}
        .rgn{flex:1;font-size:14px;font-weight:600}
        .rsum{font-size:12px;font-weight:500;flex:none}
        .rgr{display:flex;align-items:center;gap:10px;min-height:44px;padding:0 14px;border-top:1px solid var(--sk-line);text-align:left;width:100%}
        .rdot{width:8px;height:8px;border-radius:4px;flex:none;background:var(--sk-g4)}
        .rgrn{flex:1;min-width:0;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .rgs{font-size:12px;font-weight:500;color:var(--sk-mid);flex:none}
        .log{display:flex;flex-direction:column;padding-left:4px}
        .ev{display:flex;gap:14px;align-items:stretch}
        .evl{display:flex;flex-direction:column;align-items:center;width:10px;flex:none}
        .evd{width:9px;height:9px;border-radius:5px;margin-top:5px;flex:none}
        .log.wide .evl{width:28px}
        .eva{width:28px;height:28px;border-radius:14px;flex:none;overflow:hidden;display:grid;place-items:center;box-shadow:0 0 0 2px var(--sk-popup);font-size:13px;font-weight:600;color:var(--sk-on-acc)}
        .eva img{width:100%;height:100%;object-fit:cover;display:block}
        .evline{flex:1;width:1px;margin-top:4px}
        .evb{flex:1;display:flex;justify-content:space-between;gap:12px;padding-bottom:14px}
        .evw{font-size:12px;color:var(--sk-mute)}
        .own{width:100%;height:52px;border-radius:26px;background:var(--sk-surface);box-shadow:var(--sk-shadow);display:flex;align-items:center;justify-content:center;gap:8px;font-size:15px;font-weight:500}
      `;
    }
  }
  M.define('msh-sikkerhet-card', Sikkerhet, 'MSH Sikkerhet', 'Alarmmodus (hold inne, kode via tastatur), rom og sensorer (status, rom/type) og siste hendelser. #sikkerhet');
})();
