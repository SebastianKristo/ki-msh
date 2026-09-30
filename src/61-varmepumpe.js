/* msh-varmepumpe-card · Varmepumpe-popup #varmepumpe (fiks 26.20 – promptets «ki-varmepumpe-card»).
 * Fasit «Varmepumpe v3.dc.html» finnes ikke i repoet: bygget etter prompt-teksten. Funksjons-popup (Mal A), ÉTT kort, Bubble eier headeren.
 * Rekkefølge: toppkort 176 px (animert pumpe med vifte, tank-fylling, rør med flyt, Hz-merke, kW og «Ute · kr i dag») · 3 KPI-kort
 *   (Ute, Kompressor, Varmtvann) · hurtigknapper (Boost, Ventilasjon, Pumpe, Eco, Alarm, Wi-Fi) · faner Info · Varme · Varmtvann · Luft
 *   + tannhjul (Tilpass varmepumpe) · fane-innhold · «Diagnostikk»-akkordeon nederst.
 *   Info: prosasetning med piller, rader (energi, kostnad i dag, tur/retur/rom/elkolbe), graf tur/retur 7 døgn og akkordeonene
 *   Kostnad · Systemdrift · Strøm (samme stil som Diagnostikk: #3d3d3d, radius 24).
 * Autokonfig (NIBE S/F-serien, integrasjonene nibe_heatpump / myuplink): enheten(e) i hass.devices med produsent «NIBE» (eller
 *   entiteter fra de to plattformene). Roller matches på parameter-ID-suffikset (_40013 …) først, deretter på navn. Ingen
 *   hardkodede entitets-ID-er og aldri mock: mangler en rolle → «–» + «Velg entitet». Luft-fanen skjules uten BT20/BT21.
 * Animasjoner (stopper når entiteten er av): puls på energi, pust/glød på kompressor, dupp på varmtvann ved lading, snurr på vifte
 *   og ventilasjon, vibrering på GP1, rist på alarm, blink på Wi-Fi av. Av med `anim: false` og prefers-reduced-motion.
 * Config (samme skjema i «Tilpass varmepumpe» og GUI-editoren, getConfigElement):
 *   name, device (enhets-id, tomt = automatisk), buttons / buttons_hidden, button_style: icon_text|icon, tabs / tabs_hidden,
 *   tab_style: icon_name|name|icon, start_tab, overrides: { <rolle>: entity_id }, kpi, diag, anim, gap/pad_top/pad_bottom.
 */
(function () {
  const M = window.MSH;
  if (!M || customElements.get('msh-varmepumpe-card')) return;
  const esc = M.esc, C = M.C;
  const HASH = '#varmepumpe';
  const PLATS = ['nibe_heatpump', 'myuplink'];
  const DEF = { tab_style: 'icon_name', button_style: 'icon_text', kpi: true, diag: true, anim: true };

  /* ------------------------------------------------------------ roller
   * [nøkkel, etikett, gruppe, domener, parameter-ID-er (suffiks), navn-regex, ikon, ikke-regex, device_class] */
  const S = ['sensor'], SW = ['switch'], SEL = ['select'], NUM = ['number'], BS = ['binary_sensor'];
  const ROLES = [
    // toppkort / KPI
    ['power', 'Effekt nå', 'top', S, [], /(^|_)(current_|actual_|total_)?power$|effekt( na)?$|power_consumption$/, 'mdi:flash', /addition|tilskudd|elkolbe|phase|fase|be\d/, 'power'],
    ['energy', 'Energi totalt', 'top', S, [], /energy|energi/, 'mdi:lightning-bolt', /cost|kostnad|pris|price/, 'energy'],
    ['freq', 'Kompressorfrekvens', 'top', S, ['41778', '43136'], /compressor_freq|compr.*freq|kompressorfrekvens/, 'mdi:sine-wave', /min|max|allowed|tillatt/],
    ['freq_min', 'Kompressor min.', 'top', S, ['43122'], /min.*compr.*freq|compr.*freq.*min/, 'mdi:arrow-collapse-down'],
    ['freq_max', 'Kompressor maks.', 'top', S, ['43123'], /max.*compr.*freq|compr.*freq.*max/, 'mdi:arrow-collapse-up'],
    ['status', 'Status', 'top', S, ['50095'], /(^|_)status$|driftsstatus|(^|_)priority$|prioritet/, 'mdi:information-outline', /compressor|kompressor/],
    ['inne', 'Inne', 'top', S, ['50225', '40033'], /indoor|inne_?temp|innetemp/, 'mdi:home-thermometer'],
    ['inne_mal', 'Børverdi inne', 'top', S, ['50233'], /(indoor|inne|room).*(setpoint|bor|target)/, 'mdi:target'],
    ['ute', 'Ute (BT1)', 'top', S, ['40004'], /bt1\b|(^|_)bt1_|outd|outdoor|utetemp/, 'mdi:thermometer', /avg|average|snitt|middel/],
    ['ute_snitt', 'Ute snitt', 'top', S, ['40067'], /(avg|average|snitt|middel).*(outd|ute)|(outd|ute).*(avg|average|snitt|middel)/, 'mdi:thermometer-lines'],
    ['vv', 'Varmtvann topp (BT7)', 'top', S, ['40013'], /bt7|hw_top|hot_water_top|varmtvann_topp/, 'mdi:water-boiler'],
    ['vv_ladetemp', 'Ladetemperatur', 'top', S, [], /hot_water_charging_temp|ladetemp/, 'mdi:thermometer-water'],
    // hurtigknapper
    ['boost', 'Midlertidig luksus (Boost)', 'btn', SW, ['50004'], /temporary_lux|midlertidig_luksus|more_hot_water|mer_varmtvann/, 'mdi:rocket-launch'],
    ['vent', 'Økt ventilasjon', 'btn', SW, ['50005'], /increased_vent|okt_ventilasjon|økt ventilasjon/, 'mdi:fan'],
    ['pump', 'GP1-pumpe', 'btn', BS, ['49995'], /gp1|pump/, 'mdi:pump'],
    ['smart', 'Smart Home-modus', 'btn', SEL, [], /smart_home|smarthus/, 'mdi:leaf'],
    ['alarm', 'Varsler / alarm', 'btn', ['sensor', 'binary_sensor'], [], /varsler|alarm|notification/, 'mdi:bell'],
    ['wifi', 'Tilkobling', 'btn', BS, [], /tilkoblingstilstand|tilkobling|connectivity|connection_state|connected/, 'mdi:wifi'],
    // info
    ['bt2', 'Tur (BT2)', 'info', S, ['40008'], /bt2\b|(^|_)bt2_|supply_line|turledning|tur_?temp/, 'mdi:arrow-right-bold'],
    ['beregnet', 'Beregnet turtemperatur', 'info', S, ['43009'], /calc.*supply|beregnet.*tur/, 'mdi:calculator-variant'],
    ['bt3', 'Retur (BT3)', 'info', S, ['40012'], /bt3\b|(^|_)bt3_|return_line|returledning|retur_?temp/, 'mdi:arrow-left-bold'],
    ['bt50', 'Rom (BT50)', 'info', S, ['40033'], /bt50|room_temp|romtemp/, 'mdi:sofa'],
    ['elkolbe', 'Elkolbe', 'info', S, ['49993'], /int.*el.*add|elkolbe|immersion/, 'mdi:heating-coil', /power|effekt/],
    // kostnad
    ['cost_hour', 'Kostnad denne timen', 'cost', S, [], /hourly_energy_cost|cost_hour|kostnad_time/, 'mdi:clock-outline'],
    ['cost_day', 'Kostnad i dag', 'cost', S, [], /daily_energy_cost|cost_today|kostnad_i_dag|kostnad_dag/, 'mdi:calendar-today'],
    ['cost_month', 'Kostnad denne måneden', 'cost', S, [], /monthly_energy_cost|kostnad_maned/, 'mdi:calendar-month'],
    ['cost_year', 'Kostnad i år', 'cost', S, [], /yearly_energy_cost|kostnad_ar/, 'mdi:calendar'],
    // systemdrift
    ['gm', 'Gradminutter', 'sys', S, ['40941'], /degree_min|gradminutt/, 'mdi:counter'],
    ['drift', 'Driftstid kompressor', 'sys', S, ['43420'], /tot.*op.*time.*compr|driftstid_kompressor/, 'mdi:timer-outline'],
    ['starter', 'Kompressorstarter', 'sys', S, ['43416'], /compressor_starts|kompressorstart/, 'mdi:restart'],
    ['avriming', 'Avrimingstid', 'sys', S, ['43066'], /defrost|avriming/, 'mdi:snowflake-melt'],
    ['tidsfaktor', 'Tidsfaktor tillegg', 'sys', S, ['43081'], /time_factor|tidsfaktor/, 'mdi:timer-sand'],
    ['komp_status', 'Kompressorstatus', 'sys', S, ['43427'], /compressor_(status|state)|kompressorstatus/, 'mdi:engine'],
    // strøm
    ['be1', 'Fase BE1', 'strom', S, ['40083'], /(^|_)be1(_|$)/, 'mdi:current-ac'],
    ['be2', 'Fase BE2', 'strom', S, ['40081'], /(^|_)be2(_|$)/, 'mdi:current-ac'],
    ['be3', 'Fase BE3', 'strom', S, ['40079'], /(^|_)be3(_|$)/, 'mdi:current-ac'],
    ['add_power', 'Elkolbe effekt', 'strom', S, [], /internal_addition_power|tilskudd.*effekt/, 'mdi:heating-coil'],
    // varme
    ['driftsstilling', 'Driftsstilling', 'varme', SEL, ['47137'], /op.*mode|driftsstilling|operating_mode/, 'mdi:cog-outline'],
    ['kurve', 'Varmekurve', 'varme', NUM, ['47007'], /heating_curve|varmekurve/, 'mdi:chart-bell-curve', /offset|forskyv/],
    ['forskyvning', 'Forskyvning', 'varme', NUM, ['47011'], /offset|forskyvning|parallel/, 'mdi:arrow-up-down'],
    ['onsket', 'Ønsket temperatur', 'varme', NUM, [], /target_temperature_room|onsket|ønsket|room_setpoint/, 'mdi:home-thermometer-outline'],
    ['start_gm', 'Start kompressor (GM)', 'varme', NUM, ['47206'], /start.*(compr|gm|dm)|start_gm/, 'mdi:play-circle-outline'],
    ['stopp', 'Stopp av varme', 'varme', NUM, ['47375'], /stop.*heat|stopp.*varme/, 'mdi:stop-circle-outline'],
    // varmtvann
    ['bt6', 'Lading (BT6)', 'vv', S, ['40014'], /bt6\b|(^|_)bt6_|hw_charg|hot_water_charg/, 'mdi:thermometer-water'],
    ['vv_temp', 'Varmtvann', 'vv', S, ['50325'], /(^|_)hot_water_temp(erature)?$|varmtvannstemp/, 'mdi:water-thermometer'],
    ['behov', 'Varmtvannsbehov', 'vv', SEL, ['47041'], /hot_water_demand|hw_demand|comfort_mode|varmtvannsbehov/, 'mdi:water-boiler'],
    ['boost_sel', 'Boost (select)', 'vv', SEL, ['48132'], /temporary_lux|boost|mer_varmtvann/, 'mdi:rocket-launch'],
    ['ladeverdi', 'Ladeverdi', 'vv', S, ['43116'], /charge.*(value|set)|ladeverdi/, 'mdi:target'],
    ['mengde', 'Mengde varmtvann', 'vv', S, ['50345'], /hot_water_amount|mengde/, 'mdi:cup-water'],
    ['andel', 'Andel varmtvann', 'vv', S, ['43239'], /share|andel/, 'mdi:chart-pie'],
    ['vv_tid', 'Driftstid varmtvann', 'vv', S, ['43424'], /op.*time.*(hot|hw)|driftstid.*varmtvann/, 'mdi:timer-outline'],
    ['vv_modus', 'Varmtvannsmodus', 'vv', S, ['43109'], /hot_water_mode|hw_mode|varmtvannsmodus/, 'mdi:water-sync'],
    ['legionella', 'Neste legionellaøkning', 'vv', S, [], /next_periodic_increase|periodisk|legionella/, 'mdi:bacteria-outline'],
    ['fastvare', 'Fastvare', 'vv', ['update'], [], /fastvare|firmware|./, 'mdi:update'],
    // luft
    ['bt20', 'Avtrekk (BT20)', 'luft', S, ['40025'], /bt20|exhaust_air|avtrekk/, 'mdi:home-import-outline'],
    ['bt21', 'Avkast (BT21)', 'luft', S, ['40026'], /bt21|extract_air|avkast/, 'mdi:home-export-outline'],
    ['vifte', 'Viftehastighet', 'luft', S, ['50221'], /fan_speed|viftehastighet/, 'mdi:fan'],
    ['bs1', 'Luftstrøm (BS1)', 'luft', S, ['42782'], /bs1|air_?flow|luftstrom|lufthastighet/, 'mdi:weather-windy'],
    ['viftemodus', 'Viftemodus', 'luft', S, ['43108'], /fan_mode|viftemodus/, 'mdi:fan-auto'],
    ['natt', 'Nattkjøling', 'luft', SW, ['47537'], /night_cool|nattkjol/, 'mdi:weather-night'],
    // diagnostikk
    ['sug', 'Sugegass', 'diag', S, ['40022'], /suction|sugegass/, 'mdi:thermometer-chevron-down'],
    ['het', 'Hetgass', 'diag', S, ['40018'], /hot_gas|hetgass/, 'mdi:thermometer-chevron-up'],
    ['vaeske', 'Væskeledning', 'diag', S, ['40019'], /liquid|vaeske|væske/, 'mdi:water-outline'],
    ['ford', 'Fordamper', 'diag', S, ['40020'], /evaporator|fordamper/, 'mdi:snowflake'],
    ['kond', 'Kondensator', 'diag', S, ['40017'], /condenser|kondensator/, 'mdi:radiator'],
    ['inv', 'Inverter', 'diag', S, ['43140'], /inverter/, 'mdi:chip'],
    ['olje', 'Olje', 'diag', S, ['40146'], /(^|_)oil|olje/, 'mdi:oil'],
    ['gp1', 'GP1 hastighet', 'diag', S, ['43437'], /gp1.*speed|pump_speed|gp1_hast/, 'mdi:pump'],
  ];
  const RK = Object.fromEntries(ROLES.map((r) => [r[0], r]));
  const GROUPS = [['top', 'Toppkort og KPI', 'mdi:view-dashboard-outline'], ['btn', 'Hurtigknapper', 'mdi:gesture-tap-button'], ['info', 'Info', 'mdi:information-outline'], ['cost', 'Kostnad', 'mdi:cash'],
    ['sys', 'Systemdrift', 'mdi:cog-outline'], ['strom', 'Strøm', 'mdi:flash'], ['varme', 'Varme', 'mdi:radiator'], ['vv', 'Varmtvann', 'mdi:water-boiler'], ['luft', 'Luft', 'mdi:weather-windy'], ['diag', 'Diagnostikk', 'mdi:stethoscope']];
  const BTNS = [['boost', 'Boost', 'mdi:rocket-launch'], ['vent', 'Ventilasjon', 'mdi:fan'], ['pump', 'Pumpe', 'mdi:pump'], ['eco', 'Eco', 'mdi:leaf'], ['alarm', 'Alarm', 'mdi:bell-outline'], ['wifi', 'Wi-Fi', 'mdi:wifi']];
  const BK = Object.fromEntries(BTNS.map((b) => [b[0], b]));
  const TABS = [['info', 'Info', 'mdi:information-outline'], ['varme', 'Varme', 'mdi:radiator'], ['vv', 'Varmtvann', 'mdi:water-boiler'], ['luft', 'Luft', 'mdi:weather-windy']];
  const TK = Object.fromEntries(TABS.map((t) => [t[0], t]));

  /* ------------------------------------------------------------ oppdagelse */
  const dom = (id) => id.slice(0, id.indexOf('.'));
  const obj = (id) => id.slice(id.indexOf('.') + 1);
  const norm = (s) => String(s || '').toLowerCase().replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'a');
  const isNibeDev = (d) => !!d && /nibe/i.test(`${d.manufacturer || ''}`);
  // NIBE-enheter: produsent «NIBE», eller enheter som har entiteter fra nibe_heatpump / myuplink
  function nibeDevices(hass) {
    const D = (hass && hass.devices) || {}, E = (hass && hass.entities) || {}, out = new Set();
    Object.keys(D).forEach((id) => { if (isNibeDev(D[id])) out.add(id); });
    Object.values(E).forEach((e) => { if (e && PLATS.includes(e.platform) && e.device_id && D[e.device_id]) out.add(e.device_id); });
    return [...out].filter((id) => Object.values(E).some((e) => e && e.device_id === id && hass.states[e.entity_id]));
  }
  let MEMO = null;
  function oppdag(hass, cfg) {
    cfg = cfg || {};
    const E = (hass && hass.entities) || {}, D = (hass && hass.devices) || {}, S0 = (hass && hass.states) || {};
    const n = Object.keys(S0).length, dv = cfg.device || '';
    if (MEMO && MEMO.E === E && MEMO.D === D && MEMO.n === n && MEMO.dv === dv) return MEMO.R;
    const devs = dv && D[dv] ? [dv] : nibeDevices(hass);
    const ds = new Set(devs);
    const ids = Object.keys(E).filter((id) => {
      const e = E[id];
      if (!e || e.disabled_by || !S0[id]) return false;
      return (e.device_id && ds.has(e.device_id)) || (!dv && PLATS.includes(e.platform));
    }).sort();
    const txt = (id) => norm(obj(id) + ' ' + ((S0[id] && S0[id].attributes.friendly_name) || ''));
    const R = { devs, ids, roles: {}, dev: devs[0] ? D[devs[0]] : null };
    // 1) parameter-ID-suffiks (_40013) – en entitet kan dekke flere roller (inne → BT50)
    const claimed = new Set();
    ROLES.forEach(([k, , , doms, pids]) => {
      for (const p of pids) {
        const re = new RegExp('(^|_)' + p + '($|_)');
        const hit = ids.find((id) => doms.includes(dom(id)) && re.test(obj(id)));
        if (hit) { R.roles[k] = hit; claimed.add(hit); break; }
      }
    });
    // 2) navn (entity_id + friendly_name), bare blant entiteter som ikke er tatt av et suffiks
    ROLES.forEach(([k, , , doms, , rx, , not, dc]) => {
      if (R.roles[k]) return;
      const hit = ids.find((id) => !claimed.has(id) && doms.includes(dom(id)) && rx.test(txt(id)) && !(not && not.test(txt(id))) && (!dc || (S0[id].attributes.device_class === dc)));
      if (hit) { R.roles[k] = hit; claimed.add(hit); }
    });
    // 3) utenfor enheten: utetemperatur («sensor.nibe_utetemperatur») og kostnad (sensor.*_cost / ki_energi) for varmepumpa
    const glob = (rx, test) => Object.keys(S0).filter((id) => dom(id) === 'sensor' && rx.test(norm(id)) && (!test || test(id))).sort()[0];
    if (!R.roles.ute && devs.length) R.roles.ute = glob(/nibe.*(ute|outdoor|outd)|(ute|outdoor).*nibe/, (id) => !/avg|snitt|average/.test(id));
    if (devs.length) {
      const hp = /(nibe|varmepumpe|heat_?pump)/;
      [['cost_hour', /hourly_energy_cost|cost_hour/], ['cost_day', /daily_energy_cost|cost_today|kostnad_i_dag/], ['cost_month', /monthly_energy_cost/], ['cost_year', /yearly_energy_cost/]].forEach(([k, rx]) => {
        if (!R.roles[k]) R.roles[k] = glob(rx, (id) => hp.test(norm(id)) || (E[id] && E[id].platform === 'ki_energi' && hp.test(norm((S0[id].attributes || {}).friendly_name))));
      });
    }
    Object.keys(R.roles).forEach((k) => { if (!R.roles[k]) delete R.roles[k]; });
    MEMO = { E, D, n, dv, R };
    return R;
  }
  const entOf = (hass, cfg, k) => ((cfg && cfg.overrides) || {})[k] || (hass ? oppdag(hass, cfg).roles[k] : null) || null;
  M.varmepumpeHas = (hass) => !!hass && nibeDevices(hass).length > 0;

  /* ------------------------------------------------------------ tall og tekst */
  const BAD = ['unavailable', 'unknown', '', 'none'];
  const okS = (s) => !!s && !BAD.includes(String(s.state).toLowerCase());
  const numS = (s) => { if (!okS(s)) return null; const t = String(s.state).trim().replace(',', '.'); const v = Number(t); return t === '' || isNaN(v) ? null : v; };
  const unitS = (s) => (s && s.attributes.unit_of_measurement) || '';
  const dec = (v, u) => (/°|c$/i.test(u) ? 1 : Math.abs(v) < 10 && v % 1 ? 1 : v % 1 && Math.abs(v) < 100 ? 1 : 0);
  function fmtS(s, d) {
    if (!okS(s)) return '–';
    const v = numS(s), u = unitS(s);
    if (v != null && (s.attributes.device_class === 'monetary' || /^(nok|kr)$/i.test(u))) return M.nf(v, 2) + ' kr';
    if (v == null) {
      if (s.entity_id && dom(s.entity_id) === 'binary_sensor') return s.state === 'on' ? 'På' : 'Av';
      if (s.attributes.device_class === 'timestamp') return tidTil(s.state);
      return String(s.state);
    }
    return M.nf(v, d != null ? d : dec(v, u)) + (u ? (u === '°C' ? '°' : ' ' + u) : '');
  }
  const tidTil = (iso) => {
    const t = Date.parse(iso); if (isNaN(t)) return String(iso);
    const d = Math.round((t - Date.now()) / 86400000);
    const dato = new Date(t).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' });
    return d <= 0 ? `i dag · ${dato}` : d === 1 ? `i morgen · ${dato}` : `om ${d} dager · ${dato}`;
  };
  const deg = (v) => (v == null ? '–' : M.nf(v, 1) + '°');
  const kW = (s) => { const v = numS(s); if (v == null) return null; return /^w$/i.test(unitS(s)) ? v / 1000 : v; };
  const on = (s) => !!s && ['on', 'true', 'home', 'connected', 'running'].includes(String(s.state).toLowerCase());
  // select-valg → norsk etikett
  const OPT_NB = [[/^auto(matic)?$/i, 'Auto'], [/^manu(al|ell)$/i, 'Manuell'], [/add.*heat.*only|kun.*tillegg|addition only/i, 'Kun tillegg'], [/^(default|normal|home|hjemme)$/i, 'Normal'], [/^(away|borte)$/i, 'Borte'],
    [/^(vacation|holiday|ferie)$/i, 'Ferie'], [/^(small|economy|eco|okonomi|økonomi|low)$/i, 'Økonomi'], [/^(medium|normal)$/i, 'Normal'], [/^(large|luxury|luksus|high)$/i, 'Luksus'], [/^(off|av)$/i, 'Av'], [/one.?time|engang/i, 'Engangsøkning']];
  const optNb = (o) => { const m = OPT_NB.find(([re]) => re.test(String(o).trim())); return m ? m[1] : String(o); };
  const isNormal = (o) => /^(default|normal|home|hjemme)$/i.test(String(o || '').trim());
  const isAway = (o) => /^(away|borte)$/i.test(String(o || '').trim());

  /* ------------------------------------------------------------ rekkefølge / synlighet */
  const orderOf = (list, keys) => { const o = (Array.isArray(list) ? list : []).filter((k) => keys.includes(k)); keys.forEach((k) => { if (!o.includes(k)) o.push(k); }); return o; };
  const btnOrder = (c) => orderOf(c.buttons, BTNS.map((b) => b[0]));
  const tabOrder = (c) => orderOf(c.tabs, TABS.map((t) => t[0]));
  const hasLuft = (hass, c) => !!(entOf(hass, c, 'bt20') || entOf(hass, c, 'bt21'));
  const visTabs = (hass, c) => tabOrder(c).filter((k) => !(c.tabs_hidden || []).includes(k) && (k !== 'luft' || !hass || hasLuft(hass, c)));
  const visBtns = (hass, c) => btnOrder(c).filter((k) => !(c.buttons_hidden || []).includes(k) && (k !== 'eco' || !hass || !!entOf(hass, c, 'smart')));

  /* ------------------------------------------------------------ editor (Tilpass varmepumpe) */
  // Dra for rekkefølge i arket: håndtak [data-vpdrag] i rader [data-vpk] med data-vpl = listenavn (buttons | tabs)
  function installEd(ed) {
    if (!ed || ed.__vpInst || !ed.shadowRoot) return;
    ed.__vpInst = true;
    const Rt = ed.shadowRoot;
    let d = null;
    const stop = (e) => { if (e.target.closest && e.target.closest('[data-vpdrag]')) e.stopPropagation(); };
    Rt.addEventListener('touchstart', stop, { passive: true });
    Rt.addEventListener('touchmove', stop, { passive: true });
    Rt.addEventListener('pointerdown', (e) => {
      const hd = e.target.closest && e.target.closest('[data-vpdrag]');
      if (!hd || e.button) return;
      const item = hd.closest('[data-vpk]');
      if (!item) return;
      e.stopPropagation(); e.preventDefault();
      d = { k: item.dataset.vpk, l: item.dataset.vpl, item, y0: e.clientY, id: e.pointerId, over: null };
      try { hd.setPointerCapture(e.pointerId); } catch (x) { /* */ }
      item.style.position = 'relative'; item.style.zIndex = '2'; item.style.boxShadow = '0 6px 18px rgba(0,0,0,.4)';
      M.haptic('medium');
    });
    Rt.addEventListener('pointermove', (e) => {
      if (!d || e.pointerId !== d.id) return;
      e.stopPropagation(); e.preventDefault();
      d.item.style.transform = `translateY(${e.clientY - d.y0}px)`;
      d.item.style.pointerEvents = 'none';
      const el = Rt.elementFromPoint ? Rt.elementFromPoint(e.clientX, e.clientY) : null;
      d.item.style.pointerEvents = '';
      const o = el && el.closest && el.closest('[data-vpk]');
      const hit = o && o !== d.item && o.dataset.vpl === d.l ? o : null;
      if (hit !== d.over) { if (d.over) d.over.style.outline = ''; d.over = hit; if (hit) { hit.style.outline = '2px solid rgba(242,133,201,.6)'; M.haptic('selection'); } }
    });
    const end = (e) => {
      if (!d || (e && e.pointerId !== d.id)) return;
      const Dd = d; d = null;
      Dd.item.style.transform = ''; Dd.item.style.zIndex = ''; Dd.item.style.boxShadow = '';
      if (Dd.over) Dd.over.style.outline = '';
      if (!Dd.over) return;
      const cc = ed._config || {}, arr = Dd.l === 'tabs' ? tabOrder(cc) : btnOrder(cc);
      const to = Dd.over.dataset.vpk, i = arr.indexOf(Dd.k), j0 = arr.indexOf(to);
      const o = arr.filter((x) => x !== Dd.k), j = o.indexOf(to);
      o.splice(i <= j0 ? j + 1 : j, 0, Dd.k);
      M.haptic('success');
      ed._set(Dd.l, o);
    };
    Rt.addEventListener('pointerup', end);
    Rt.addEventListener('pointercancel', end);
  }
  const autoOf = (h, c, k) => { if (!h) return null; try { return oppdag(h, c || {}).roles[k] || null; } catch (e) { return null; } };
  const dragRow = (list, k, label, icon, off, key, extra) => `<div data-vpk="${k}" data-vpl="${list}" style="height:52px;border-radius:26px;background:#2f2f2f;display:flex;align-items:center;gap:8px;padding:0 6px 0 4px;${off ? 'opacity:.5' : ''}">
      <span data-vpdrag="1" title="Dra for rekkefølge" style="touch-action:none;cursor:grab;display:inline-flex;color:#979797;padding:8px 6px">${M.icon('mdi:drag', 22)}</span>
      <span style="width:34px;height:34px;border-radius:17px;display:grid;place-items:center;background:#404040;flex:none">${M.icon(icon, 19)}</span>
      <span style="flex:1;min-width:0;display:flex;flex-direction:column"><span style="font-size:14px;font-weight:500">${esc(label)}</span>${extra ? `<span style="font-size:11px;color:#979797">${esc(extra)}</span>` : ''}</span>
      <button class="ib" data-a="fn" data-k="${key}" data-v="${k}" aria-label="${off ? 'Vis' : 'Skjul'} ${esc(label)}" aria-pressed="${!off}">${M.icon(off ? 'mdi:eye-off' : 'mdi:eye', 18)}</button></div>`;
  const PV_CSS = 'padding:14px 12px;border-radius:24px;background:#282828;display:flex;flex-direction:column;gap:10px';
  const PV_T = '<div style="font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#7f7f7f;margin:0 4px">Forhåndsvisning</div>';

  function editorSchema(h, c) {
    c = c || {};
    const R = h ? oppdag(h, c) : null;
    const D = (h && h.devices) || {};
    const devOpts = h ? Object.keys(D).filter((id) => isNibeDev(D[id]) || (R && R.devs.includes(id)) || Object.values(h.entities || {}).some((e) => e && e.device_id === id && PLATS.includes(e.platform)))
      .map((id) => [id, `${D[id].name_by_user || D[id].name || id}${D[id].model ? ' · ' + D[id].model : ''}`]) : [];
    // Knapper
    const btnPrev = { type: 'html', html: (hh, cc) => {
      const V = visBtns(hh, cc), ic = (cc.button_style || DEF.button_style) === 'icon';
      return `<div style="${PV_CSS}" aria-hidden="true">${PV_T}<div style="display:flex;gap:6px">${V.length ? V.map((k) => `<span style="flex:1 1 0;min-width:0;display:flex;flex-direction:column;align-items:center;gap:6px"><span style="width:44px;height:44px;border-radius:22px;background:#3a3a3a;display:grid;place-items:center">${M.icon(BK[k][2], 20)}</span>${ic ? '' : `<span style="font-size:11px;color:#afafaf;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%">${esc(BK[k][1])}</span>`}</span>`).join('') : '<span style="flex:1;text-align:center;font-size:12px;color:#979797">Ingen synlige knapper</span>'}</div></div>`;
    } };
    const btnList = { type: 'html', html: (hh, cc, key, ed) => {
      installEd(ed);
      const hid = new Set(cc.buttons_hidden || []);
      const src = { boost: 'boost', vent: 'vent', pump: 'pump', eco: 'smart', alarm: 'alarm', wifi: 'wifi' };
      return `<div class="f" style="gap:8px"><label>Knapper · dra for rekkefølge</label>${btnOrder(cc).map((k) => {
        const id = entOf(hh, cc, src[k]);
        return dragRow('buttons', k, BK[k][1], BK[k][2], hid.has(k), key, id ? (hh.states[id] ? M.name(hh, id) : id) : k === 'eco' ? 'Vises bare med Smart Home-modus' : '– · Velg entitet');
      }).join('')}<span class="help">Dra i håndtaket for rekkefølge. Øyet skjuler knappen.</span></div>`;
    }, click: (dd, ed) => { const s = new Set((ed._config || {}).buttons_hidden || []); if (s.has(dd.v)) s.delete(dd.v); else s.add(dd.v); M.haptic('selection'); ed._set('buttons_hidden', s.size ? [...s] : undefined); } };
    // Faner
    const tabPrev = { type: 'html', html: (hh, cc) => {
      const V = visTabs(hh, cc), st = cc.tab_style || DEF.tab_style, act = V.includes(cc.start_tab) ? cc.start_tab : V[0];
      const t = (k) => { const x = TK[k], o = k === act; return `<span style="flex:${st === 'icon' && !o ? '0 0 44px' : '1 1 0'};min-width:0;height:34px;border-radius:17px;display:inline-flex;align-items:center;justify-content:center;gap:6px;font-size:12px;${o ? `background:${C.accent};color:#2a1720;font-weight:600` : 'color:#afafaf'}">${st !== 'name' ? M.icon(x[2], 18) : ''}${st !== 'icon' || o ? `<span>${esc(x[1])}</span>` : ''}</span>`; };
      return `<div style="${PV_CSS}" aria-hidden="true">${PV_T}<div style="display:flex;align-items:center;gap:8px"><div style="flex:1;min-width:0;display:flex;gap:2px;padding:4px;border-radius:21px;background:#3a3a3a">${V.length ? V.map(t).join('') : '<span style="flex:1;text-align:center;font-size:12px;color:#979797;line-height:34px">Ingen synlige faner</span>'}</div><span style="width:42px;height:42px;border-radius:21px;background:#3a3a3a;display:grid;place-items:center;color:#afafaf;flex:none">${M.icon('mdi:cog', 20)}</span></div></div>`;
    } };
    const tabList = { type: 'html', html: (hh, cc, key, ed) => {
      installEd(ed);
      const hid = new Set(cc.tabs_hidden || []);
      return `<div class="f" style="gap:8px"><label>Faner · dra for rekkefølge</label>${tabOrder(cc).map((k) => dragRow('tabs', k, TK[k][1], TK[k][2], hid.has(k), key, k === 'luft' && hh && !hasLuft(hh, cc) ? 'Skjult automatisk – fant ikke BT20/BT21' : '')).join('')}<span class="help">Dra i håndtaket for rekkefølge. Øyet skjuler fanen. Minst én fane må være synlig.</span></div>`;
    }, click: (dd, ed) => {
      const s = new Set((ed._config || {}).tabs_hidden || []);
      if (!s.has(dd.v) && TABS.filter((t) => !s.has(t[0])).length <= 1) { M.haptic('warning'); M.toast('Minst én fane må være synlig'); return; }
      if (s.has(dd.v)) s.delete(dd.v); else s.add(dd.v);
      M.haptic('selection'); ed._set('tabs_hidden', s.size ? [...s] : undefined);
    } };
    const entSec = ([g, label, icon]) => ({ type: 'section', id: 'vp-' + g, label, icon,
      meta: (hh, cc) => { const L = ROLES.filter((r) => r[2] === g); return `${L.filter((r) => entOf(hh, cc, r[0])).length} av ${L.length} funnet`; },
      fields: ROLES.filter((r) => r[2] === g).map(([k, l, , doms, pids, , ic]) => ({ type: 'entity', name: 'overrides.' + k, label: l + (pids.length ? ` · ${pids[0]}` : ''), icon: ic, domain: doms, auto: (hh, cc) => autoOf(hh, cc, k), none_label: '– · Velg entitet' })) });
    const reset = { type: 'button', label: 'Tilbakestill til standard', icon: 'mdi:restore', run: (hh, cc, ed) => {
      M.haptic('warning');
      const id = (cc && cc.card_id) || M.uid();
      ed._config = { type: cc.type || 'custom:msh-varmepumpe-card', card_id: id };
      ed._set('card_id', id);
    } };
    const found = R ? R.devs.length : 0;
    return [
      ...(R && !found && !c.device ? [{ type: 'info', label: 'Fant ingen NIBE-enhet (integrasjonene nibe_heatpump eller myuplink). Velg entiteter under Entiteter.' }] : []),
      { type: 'tabs', id: 'varmepumpe', tabs: [
        { key: 'knapper', label: 'Knapper', icon: 'mdi:gesture-tap-button', focus: ['knapper', 'buttons'], fields: [
          { type: 'section', id: 'knapper', label: 'Hurtigknapper', icon: 'mdi:gesture-tap-button', fields: [
            btnPrev, btnList,
            { type: 'select', name: 'button_style', label: 'Knappene viser', options: [['icon_text', 'Ikon og tekst'], ['icon', 'Bare ikon']], default: DEF.button_style },
          ] },
        ] },
        { key: 'faner', label: 'Faner', icon: 'mdi:tab', focus: ['faner', 'tabs'], fields: [
          { type: 'section', id: 'faner', label: 'Faner', icon: 'mdi:tab', fields: [
            tabPrev, tabList,
            { type: 'select', name: 'tab_style', label: 'Fanene viser', options: [['icon_name', 'Ikon og navn'], ['name', 'Bare navn'], ['icon', 'Bare ikon']], default: DEF.tab_style },
            { type: 'select', name: 'start_tab', label: 'Startfane', options: [['', 'Sist brukt'], ...TABS.map((t) => [t[0], t[1]])], default: '' },
          ] },
        ] },
        { key: 'entiteter', label: 'Entiteter', icon: 'mdi:format-list-bulleted-type', focus: ['entiteter', 'entities', ...GROUPS.map((g) => 'vp-' + g[0])], fields: [
          { type: 'info', label: 'Alt er funnet automatisk fra NIBE-enheten (parameter-ID først, så navn). Velg en annen entitet bare der det automatiske valget er feil.' },
          { type: 'section', id: 'entiteter', label: 'Enhet', icon: 'mdi:heat-pump', fields: [
            { type: 'select', name: 'device', label: 'NIBE-enhet', options: [['', found ? `Automatisk · ${R.dev ? (R.dev.name_by_user || R.dev.name) : ''}` : 'Automatisk'], ...devOpts], default: '' },
          ] },
          ...GROUPS.map(entSec),
        ] },
        { key: 'visning', label: 'Visning', icon: 'mdi:eye-outline', focus: ['visning', 'spacing'], fields: [
          { type: 'section', id: 'visning', label: 'Visning', icon: 'mdi:eye-outline', fields: [
            { type: 'text', name: 'name', label: 'Navn i toppkortet', placeholder: R && R.dev ? (R.dev.name_by_user || R.dev.name) : 'Varmepumpe' },
            { type: 'boolean', name: 'kpi', label: 'KPI-kort (Ute, Kompressor, Varmtvann)', default: true },
            { type: 'boolean', name: 'diag', label: 'Diagnostikk nederst', default: true },
            { type: 'boolean', name: 'anim', label: 'Animasjoner', default: true, help: 'Pumpe, vifte, rør og knapper. Stopper uansett når entiteten er av.' },
          ] },
          M.spacingSchema(),
          reset,
        ] },
      ] },
    ];
  }

  /* ============================================================ kortet */
  class Varmepumpe extends M.Card {
    static get cardName() { return 'Varmepumpe'; }
    static get editorTitle() { return 'Tilpass varmepumpe'; }
    static get defaults() { return { ...DEF }; }
    static getStubConfig() { return { card_id: M.uid() }; }
    static get schema() { return editorSchema; }
    static get uiPersist() { return ['tab', 'acc']; }
    get cardSize() { return 12; }
    _e(k) { return entOf(this.hass, this.config, k); }
    _S(k) { return this.s(this._e(k)); }
    _N(k) { return numS(this._S(k)); }
    get tab() { const V = visTabs(this.hass, this.config), t = this.ui.tab || this.config.start_tab; return V.includes(t) ? t : V[0] || null; }
    onOpen() {
      const st = this.config.start_tab, V = visTabs(this.hass, this.config);
      if (st && V.includes(st) && this.ui.tab !== st) this.setUI({ tab: st });
      this._load();
    }
    // Historikk kun når popupen er åpen (fallgruve 8): 24 t for varmtvann/luft, 7 døgn for tur/retur
    async _load() {
      const h = this.hass;
      if (!h || !this.isOpen) return;
      const d24 = ['vv', 'bt6', 'bt20', 'bt21'].map((k) => this._e(k)).filter(Boolean);
      const d7 = ['bt2', 'bt3'].map((k) => this._e(k)).filter(Boolean);
      const key = d24.join() + '|' + d7.join();
      if (this._lk === key && Date.now() - (this._lt || 0) < 300000) return;
      this._lk = key; this._lt = Date.now();
      try {
        const [a, b] = await Promise.all([d24.length ? M.history(h, d24, 24) : {}, d7.length ? M.history(h, d7, 168) : {}]);
        this._h24 = a; this._h7 = b;
      } catch (e) { this._h24 = this._h24 || {}; this._h7 = this._h7 || {}; }
      this.update();
    }

    onAction(name, el, ev) {
      const d = el.dataset, h = this.hass;
      switch (name) {
        case 'tab': if (d.v) { this._scrub = null; this.setUI({ tab: d.v }); } return;
        case 'acc': { const a = { ...(this.ui.acc || {}) }; a[d.v] = !a[d.v]; return this.setUI({ acc: a }); }
        case 'btn': return this._btn(d.v);
        case 'opt': return d.id && d.o != null && M.call(h, 'select', 'select_option', { entity_id: d.id, option: d.o });
        case 'step': return this._step(d.id, Number(d.d));
        case 'boostvv': return this._boostVV();
        default: return super.onAction(name, el, ev);
      }
    }
    _btn(k) {
      const h = this.hass;
      const src = { boost: 'boost', vent: 'vent', pump: 'pump', eco: 'smart', alarm: 'alarm', wifi: 'wifi' }[k];
      const id = this._e(src);
      if (!id || !h.states[id]) return this.customize('vp-btn');
      if (k === 'boost' || k === 'vent') return M.toggle(h, id);
      if (k === 'eco') {
        const s = h.states[id], O = s.attributes.options || [];
        const next = isNormal(s.state) ? O.find(isAway) || O.find((o) => !isNormal(o)) : O.find(isNormal) || O[0];
        return next != null && M.call(h, 'select', 'select_option', { entity_id: id, option: next });
      }
      return M.moreInfo(this, id); // Pumpe, Alarm og Wi-Fi: bare visning
    }
    _boostVV() {
      const h = this.hass, sw = this._e('boost'), sel = this._e('boost_sel');
      if (sw && h.states[sw]) return M.toggle(h, sw);
      if (sel && h.states[sel]) {
        const s = h.states[sel], O = s.attributes.options || [];
        const off = O.find((o) => /^(off|av)$/i.test(o));
        const next = off != null && s.state !== off ? off : O.find((o) => o !== off) || O[0];
        return next != null && M.call(h, 'select', 'select_option', { entity_id: sel, option: next });
      }
      return this.customize('vp-btn');
    }
    _step(id, dir) {
      const h = this.hass, s = id && h.states[id];
      if (!s) return;
      const A = s.attributes, st = Number(A.step) || 1, cur = this._pend && this._pend[id] != null ? this._pend[id] : numS(s);
      if (cur == null) return;
      const mn = A.min != null ? Number(A.min) : -Infinity, mx = A.max != null ? Number(A.max) : Infinity;
      const v = Math.round(M.clamp(cur + dir * st, mn, mx) / st) * st;
      const val = Number(v.toFixed(3));
      if (val === cur) { M.haptic('warning'); return; }
      this._pend = { ...(this._pend || {}), [id]: val };
      clearTimeout(this._pt);
      this._pt = setTimeout(() => { const p = this._pend || {}; const x = p[id]; delete p[id]; if (x != null) M.call(this.hass, 'number', 'set_value', { entity_id: id, value: x }).catch(() => {}); }, 450);
      this.update();
    }

    /* ---------------------------------------------------------- tegning */
    render() {
      const h = this.hass, c = this.config;
      const R = oppdag(h, c);
      R.ids.forEach((id) => this._deps.add(id));
      Object.values(c.overrides || {}).forEach((id) => { if (id) this._deps.add(id); });
      Object.keys(R.roles).forEach((k) => this._deps.add(R.roles[k]));
      if (this._pend) Object.keys(this._pend).forEach((id) => { const s = h.states[id]; if (s && numS(s) === this._pend[id]) delete this._pend[id]; });
      const parts = [this._top(R)];
      if (c.kpi !== false) parts.push(this._kpi());
      const V = visBtns(h, c);
      if (V.length) parts.push(this._btns(V));
      const T = visTabs(h, c), tab = this.tab;
      parts.push(this._tabRow(T, tab));
      if (!tab) parts.push(`<div class="empty">${M.icon('mdi:eye-off', 22)}<span>Alle fanene er skjult</span><button class="pick press" data-act="customize" data-section="faner">${M.icon('mdi:cog', 18)}Tilpass</button></div>`);
      else parts.push(`<div class="pane" data-key="pane-${tab}">${this['_' + tab]()}</div>`);
      if (c.diag !== false) parts.push(this._acc('diag', 'Diagnostikk', 'mdi:stethoscope', ROLES.filter((r) => r[2] === 'diag').map((r) => r[0])));
      if (!R.devs.length && !Object.keys(c.overrides || {}).length) parts.splice(1, 0, `<div class="empty nf">${M.icon('mdi:heat-pump-outline', 26)}<b>Fant ingen NIBE-varmepumpe</b><span>Støtter NIBE S- og F-serien via integrasjonene NIBE Heat Pump eller myUplink. Legg til integrasjonen, så dukker den opp her automatisk.</span><button class="pick press" data-act="customize" data-section="entiteter">${M.icon('mdi:plus', 18)}Velg entitet</button></div>`);
      return `<div class="wrap ${c.anim === false ? 'noanim' : ''}">${parts.join('')}</div>`;
    }
    // Rad: ikon · navn · verdi (mangler → «–» + «Velg entitet»)
    _row(k, opt) {
      opt = opt || {};
      const r = RK[k], id = this._e(k), s = id ? this.s(id) : null;
      const label = opt.label || r[1];
      if (!id || !s) return `<div class="rw miss"><span class="ri">${M.icon(r[6], 20)}</span><span class="grow ell">${esc(label)}</span><span class="rv">–</span><button class="vs press" data-act="customize" data-section="vp-${r[2]}">Velg entitet</button></div>`;
      const v = opt.val != null ? opt.val : fmtS(s);
      return `<button class="rw" data-act="more" data-id="${esc(id)}" data-ent="${esc(id)}"><span class="ri ${opt.cls || ''}" ${opt.style ? `style="${opt.style}"` : ''}>${M.icon(opt.icon || r[6], 20)}</span><span class="grow col"><span class="ell">${esc(label)}</span>${opt.sub ? `<small class="ell">${esc(opt.sub)}</small>` : ''}</span><span class="rv num ${opt.vcls || ''}">${esc(v)}</span></button>`;
    }
    _running() { const f = this._N('freq'); if (f != null) return f > 0; const cs = this._S('komp_status'); return !!cs && /run|går|on|start/i.test(String(cs.state)); }
    _charging() {
      const t = [this._S('status'), this._S('vv_modus'), this._S('komp_status')].filter(okS).map((s) => String(s.state)).join(' ');
      return this._running() && /hot ?water|varmtvann|hw|lad|charg|dhw/i.test(t) || on(this._S('boost'));
    }
    _alarmOn() { const s = this._S('alarm'); if (!okS(s)) return false; if (dom(s.entity_id) === 'binary_sensor') return s.state === 'on'; const v = numS(s); return v != null ? v > 0 : !/^(0|ingen|none|ok|no alarm|off|false)$/i.test(String(s.state).trim()); }
    _wifiOff() { const s = this._S('wifi'); return !!s && (s.state === 'off' || !okS(s)); }
    _fanDur() { const v = this._N('vifte'); if (v == null) return this._running() ? 1.6 : 0; if (v <= 0) return 0; return Math.max(0.35, 2.4 - (Math.min(100, v) / 100) * 2); }
    _vvFill() {
      const m = this._S('mengde');
      if (okS(m) && /%/.test(unitS(m)) && numS(m) != null) return { f: M.clamp(numS(m) / 100, 0, 1), calc: false };
      const t = this._N('vv');
      return t == null ? null : { f: M.clamp((t - 20) / (55 - 20), 0, 1), calc: true };
    }

    _top(R) {
      const c = this.config, run = this._running(), fan = this._fanDur(), fill = this._vvFill(), charging = this._charging();
      const pw = kW(this._S('power')), freq = this._N('freq'), ute = this._N('ute'), kr = this._S('cost_day');
      const st = this._S('status'), cs = this._S('komp_status');
      const chip = okS(st) ? String(st.state) : run ? 'Kompressoren går' : cs || freq != null ? 'Hviler' : '–';
      const name = c.name || (R.dev ? (R.dev.name_by_user || R.dev.name) : 'Varmepumpe');
      const fy = fill ? 118 - fill.f * 84 : 118;
      const blades = [0, 90, 180, 270].map((a) => `<path d="M0 0 C 4 -6, 13 -8, 17 -2 C 12 0, 5 2, 0 0Z" transform="rotate(${a})" fill="#c7c7c7"/>`).join('');
      const pwId = this._e('power');
      return `<section class="top ${run ? 'run' : ''}" aria-label="Varmepumpe">
        <div class="tl"><span class="tn ell">${esc(name)}</span><span class="chip ${run ? 'on' : ''}">${M.icon(run ? 'mdi:heat-pump' : 'mdi:sleep', 14)}<span class="ell">${esc(chip)}</span></span></div>
        <div class="tv ${pw != null && pw > 0 ? 'puls' : ''}" ${pwId ? `data-act="more" data-id="${esc(pwId)}" data-ent="${esc(pwId)}"` : 'data-act="customize" data-section="vp-top"'}><span class="big num">${pw == null ? '–' : M.nf(pw, pw < 10 ? 2 : 1)}</span><span class="u">kW</span></div>
        <div class="ts">Ute ${esc(deg(ute))} · ${okS(kr) && numS(kr) != null ? esc(M.nf(numS(kr), 2)) + ' kr i dag' : '– kr i dag'}</div>
        <svg class="pumpe" viewBox="0 0 170 150" aria-hidden="true">
          <defs><clipPath id="vp-tank"><rect x="14" y="34" width="40" height="84" rx="16"/></clipPath>
            <linearGradient id="vp-vann" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f28073"/><stop offset="1" stop-color="#f2b573"/></linearGradient></defs>
          <g class="${charging ? 'dupp' : ''}"><rect x="14" y="34" width="40" height="84" rx="16" fill="#2f2f2f" stroke="#545454" stroke-width="2"/>
            ${fill ? `<rect clip-path="url(#vp-tank)" x="14" y="${fy.toFixed(1)}" width="40" height="${(118 - fy + 2).toFixed(1)}" fill="url(#vp-vann)" opacity=".85"/><path clip-path="url(#vp-tank)" class="${charging ? 'bolge' : ''}" d="M8 ${fy.toFixed(1)} q 6 -3 12 0 t 12 0 t 12 0 t 12 0 t 12 0" fill="none" stroke="#fafafa" stroke-opacity=".35" stroke-width="1.5"/>` : ''}
            <text x="34" y="30" text-anchor="middle" class="svt">${fill ? M.nf(fill.f * 100, 0) + ' %' : '–'}</text></g>
          <path d="M 54 60 H 84" class="ror varm ${run && c.anim !== false ? 'flow' : ''}"/>
          <path d="M 84 100 H 54" class="ror kald ${run && c.anim !== false ? 'flow' : ''}"/>
          <rect x="84" y="12" width="76" height="128" rx="16" fill="#4a4a4a" class="skap"/>
          <rect x="84" y="12" width="76" height="128" rx="16" fill="none" stroke="rgba(255,255,255,.08)"/>
          <circle cx="122" cy="54" r="27" fill="#2f2f2f" stroke="#545454" stroke-width="2"/>
          <g transform="translate(122 54)"><g class="vifte ${fan ? 'spin' : ''}" style="--vp-dur:${fan || 2}s">${blades}<circle r="4" fill="#7f7f7f"/></g></g>
          <rect x="96" y="96" width="52" height="4" rx="2" fill="#545454"/><rect x="96" y="106" width="52" height="4" rx="2" fill="#545454"/>
          <g class="hz"><rect x="102" y="116" width="40" height="18" rx="9" fill="${run ? 'var(--orange,#f2b573)' : '#545454'}"/><text x="122" y="129" text-anchor="middle" class="hzt ${run ? 'on' : ''}">${freq == null ? '– Hz' : M.nf(freq, 0) + ' Hz'}</text></g>
        </svg>
      </section>`;
    }
    _kpi() {
      const ute = this._S('ute'), snitt = this._N('ute_snitt');
      const f = this._N('freq'), mn = this._N('freq_min'), mx = this._N('freq_max'), run = this._running();
      const lo = mn != null ? mn : 0, hi = mx != null && mx > lo ? mx : 120;
      const pct = f == null ? 0 : M.clamp(((f - lo) / (hi - lo)) * 100, 0, 100);
      const vv = this._S('vv'), bt6 = this._N('bt6'), ch = this._charging();
      const card = (k, cls, icon, icls, label, val, sub, extra) => {
        const id = this._e(k);
        return `<button class="kp ${cls}" ${id ? `data-act="more" data-id="${esc(id)}" data-ent="${esc(id)}"` : `data-act="customize" data-section="vp-top"`}><span class="kh"><span class="ki ${icls}">${M.icon(icon, 18)}</span><span class="ell">${label}</span></span><span class="kv num">${val}</span>${extra || ''}<span class="ks ell">${sub}</span></button>`;
      };
      return `<div class="kpis">
        ${card('ute', '', 'mdi:thermometer', '', 'Ute', okS(ute) ? esc(deg(numS(ute))) : '–', snitt != null ? 'Snitt ' + esc(deg(snitt)) : this._e('ute') ? 'BT1' : 'Velg entitet')}
        ${card('freq', run ? 'glod' : '', 'mdi:sine-wave', run ? 'pust' : '', 'Kompressor', f == null ? '–' : `${M.nf(f, 0)}<small>Hz</small>`, run ? 'Går' : f == null ? 'Velg entitet' : 'Står', `<span class="bar"><i style="width:${pct.toFixed(0)}%"></i></span>`)}
        ${card('vv', '', 'mdi:water-boiler', ch ? 'dupp' : '', 'Varmtvann', okS(vv) ? esc(deg(numS(vv))) : '–', ch ? 'Lader' + (bt6 != null ? ' · ' + esc(deg(bt6)) : '') : bt6 != null ? 'BT6 ' + esc(deg(bt6)) : this._e('vv') ? 'BT7' : 'Velg entitet')}
      </div>`;
    }
    _btns(V) {
      const ic = (this.config.button_style || DEF.button_style) === 'icon';
      const b = (k) => {
        const [, label, icon0] = BK[k], src = { boost: 'boost', vent: 'vent', pump: 'pump', eco: 'smart', alarm: 'alarm', wifi: 'wifi' }[k];
        const id = this._e(src), s = id ? this.s(id) : null;
        let icon = icon0, cls = '', sub = '–', act = false;
        if (s) {
          if (k === 'boost') { act = on(s); cls = act ? 'on orange' : ''; sub = act ? 'På' : 'Av'; }
          if (k === 'vent') { act = on(s); cls = act ? 'on blue spin-i' : ''; sub = act ? 'På' : 'Av'; }
          if (k === 'pump') { act = on(s); cls = act ? 'on green vib' : ''; sub = act ? 'Går' : 'Står'; }
          if (k === 'eco') { act = okS(s) && !isNormal(s.state); cls = act ? 'on green' : ''; sub = okS(s) ? optNb(s.state) : '–'; }
          if (k === 'alarm') { act = this._alarmOn(); cls = act ? 'on red rist' : ''; icon = act ? 'mdi:bell-alert' : 'mdi:bell-outline'; sub = act ? (numS(s) != null ? M.nf(numS(s)) + ' varsel' : String(s.state)) : 'Ingen'; }
          if (k === 'wifi') { const off = this._wifiOff(); act = off; cls = off ? 'on red blink' : ''; icon = off ? 'mdi:wifi-off' : 'mdi:wifi'; sub = off ? 'Frakoblet' : 'Tilkoblet'; }
        }
        const attrs = s ? `data-act="btn" data-v="${k}" data-ent="${esc(id)}"` : `data-act="customize" data-section="vp-btn"`;
        return `<button class="qb press ${cls} ${s ? '' : 'miss'}" ${attrs} aria-label="${esc(label)}${s ? '' : ' – velg entitet'}" ${['boost', 'vent'].includes(k) && s ? `aria-pressed="${act}"` : ''}><span class="qi">${M.icon(icon, 22)}</span>${ic ? '' : `<span class="ql ell">${esc(label)}</span><span class="qs ell">${esc(s ? sub : 'Velg entitet')}</span>`}</button>`;
      };
      return `<div class="qbs ${ic ? 'ic' : ''}">${V.map(b).join('')}</div>`;
    }
    _tabRow(V, tab) {
      const st = this.config.tab_style || DEF.tab_style;
      const btn = (k) => {
        const [, label, icon] = TK[k], o = k === tab;
        if (st === 'icon') return M.iconTabs.btn({ label, icon }, o, `data-act="tab" data-v="${k}" data-haptic="selection"`, o ? 'on' : '');
        return `<button class="tb ${o ? 'on' : ''}" role="tab" aria-selected="${o}" data-act="tab" data-v="${k}" data-haptic="selection">${st !== 'name' ? M.icon(icon, 20) : ''}<span>${esc(label)}</span></button>`;
      };
      return `<div class="trow"><div class="tabs ${st === 'icon' ? 'itabs' : ''}" role="tablist" data-glass-drag="x">${V.map(btn).join('')}</div>
        <button class="gear press" data-act="customize" aria-label="Tilpass varmepumpe">${M.icon('mdi:cog', 22)}</button></div>`;
    }
    _acc(key, title, icon, keys) {
      const open = !!(this.ui.acc || {})[key], n = keys.filter((k) => this._e(k)).length;
      return `<section class="acc ${open ? 'open' : ''}" data-key="acc-${key}"><button class="ah" data-act="acc" data-v="${key}" aria-expanded="${open}"><span class="ai">${M.icon(icon, 20)}</span><span class="grow ell">${esc(title)}</span><span class="an">${n} av ${keys.length}</span>${M.icon('mdi:chevron-down', 22, 'color:#979797;transition:transform .2s;' + (open ? 'transform:rotate(180deg)' : ''))}</button>
        ${open ? `<div class="ab">${keys.map((k) => this._row(k)).join('')}</div>` : ''}</section>`;
    }
    // Graf: serier [{k, col, label}], timer, historikk. Scrub med pekeren (touch-action:none + stopPropagation).
    _graph(g, series, hours, hist) {
      const Wg = 300, Hg = 96, N = hours > 48 ? 84 : 48;
      const data = series.map((x) => ({ ...x, id: this._e(x.k) })).filter((x) => x.id);
      if (!data.length) return `<div class="gr none">${M.icon('mdi:chart-line', 20)}<span>Fant ingen sensorer til grafen</span><button class="vs press" data-act="customize" data-section="vp-${RK[series[0].k][2]}">Velg entitet</button></div>`;
      const S2 = data.map((x) => ({ ...x, v: hist ? M.sample((hist[x.id] || []), N, hours) : [] }));
      const all = S2.flatMap((x) => x.v);
      const mn = all.length ? Math.min(...all) : 0, mx = all.length ? Math.max(...all) : 1, sp = mx - mn || 1;
      const y = (v) => Hg - 8 - ((v - mn) / sp) * (Hg - 20);
      const pts = (arr) => arr.map((v, i) => `${((i / (N - 1)) * Wg).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
      const sc = this._scrub && this._scrub.g === g ? this._scrub.i : null;
      const lines = S2.map((x, j) => (x.v.length ? `${j === 0 ? `<polygon points="0,${Hg} ${pts(x.v)} ${Wg},${Hg}" fill="${x.col}" fill-opacity=".12"/>` : ''}<polyline points="${pts(x.v)}" fill="none" stroke="${x.col}" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>` : '')).join('')
        || `<line x1="0" y1="${Hg / 2}" x2="${Wg}" y2="${Hg / 2}" stroke="#545454" stroke-dasharray="4 4" vector-effect="non-scaling-stroke"/>`;
      const mk = sc != null && all.length ? `<line x1="${((sc / (N - 1)) * Wg).toFixed(1)}" x2="${((sc / (N - 1)) * Wg).toFixed(1)}" y1="0" y2="${Hg}" stroke="#fafafa" stroke-opacity=".6" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"/>` : '';
      const tlab = sc == null ? 'nå' : (() => { const t = hours - (sc / (N - 1)) * hours; return t < 0.5 ? 'nå' : hours > 48 ? `−${M.nf(t / 24, t < 24 ? 1 : 0)} d` : `−${M.nf(t, t < 10 ? 1 : 0)} t`; })();
      const leg = S2.map((x) => { const v = sc != null && x.v.length ? x.v[sc] : numS(this.s(x.id)); return `<span><i style="background:${x.col}"></i>${esc(x.label)} <b class="num">${v == null ? '–' : esc(deg(v))}</b></span>`; }).join('');
      const xl = hours > 48 ? ['−7 d', '−3,5 d', 'nå'] : ['−24 t', '−12 t', 'nå'];
      return `<div class="gr" data-g="${g}" data-n="${N}"><div class="gl">${leg}<span class="gt">${esc(tlab)}</span></div>
        <svg class="gs" viewBox="0 0 ${Wg} ${Hg}" preserveAspectRatio="none" aria-label="Graf siste ${hours > 48 ? '7 døgn' : '24 timer'}">${lines}${mk}</svg>
        <div class="gx"><span>${xl[0]}</span><span>${xl[1]}</span><span>${xl[2]}</span></div>${hist ? '' : '<div class="gw">Henter historikk …</div>'}</div>`;
    }
    _seg(k, label) {
      const id = this._e(k), s = id ? this.s(id) : null;
      if (!s) return `<div class="blk"><div class="bt">${esc(label)}</div>${this._row(k)}</div>`;
      const O = s.attributes.options || [];
      return `<div class="blk"><div class="bt">${esc(label)}</div><div class="seg" role="radiogroup" aria-label="${esc(label)}">${O.map((o) => `<button class="sg ${o === s.state ? 'on' : ''}" role="radio" aria-checked="${o === s.state}" data-act="opt" data-id="${esc(id)}" data-o="${esc(o)}" data-haptic="selection">${esc(optNb(o))}</button>`).join('') || `<span class="muted">${esc(s.state)}</span>`}</div></div>`;
    }
    _stepper(k, label, sub) {
      const r = RK[k], id = this._e(k), s = id ? this.s(id) : null;
      if (!s) return this._row(k, { label });
      const p = this._pend && this._pend[id], v = p != null ? p : numS(s), u = unitS(s);
      const A = s.attributes, mn = A.min != null ? Number(A.min) : null, mx = A.max != null ? Number(A.max) : null, st = Number(A.step) || 1;
      const d = st < 1 ? 1 : 0;
      return `<div class="rw stp" data-key="stp-${k}"><span class="ri">${M.icon(r[6], 20)}</span><button class="grow col tl" data-act="more" data-id="${esc(id)}" data-ent="${esc(id)}"><span class="ell">${esc(label)}</span>${sub ? `<small class="ell">${esc(sub)}</small>` : ''}</button>
        <button class="pm press" data-act="step" data-id="${esc(id)}" data-d="-1" aria-label="${esc(label)} ned" ${v != null && mn != null && v <= mn ? 'disabled' : ''}>${M.icon('mdi:minus', 20)}</button>
        <span class="sv num ${p != null ? 'pend' : ''}">${v == null ? '–' : M.nf(v, d) + (u ? (u === '°C' ? '°' : ' ' + u) : '')}</span>
        <button class="pm press" data-act="step" data-id="${esc(id)}" data-d="1" aria-label="${esc(label)} opp" ${v != null && mx != null && v >= mx ? 'disabled' : ''}>${M.icon('mdi:plus', 20)}</button></div>`;
    }

    /* ---------------------------------------------------------- faner */
    _info() {
      const f = this._N('freq'), inne = this._N('inne'), vv = this._N('vv'), run = this._running();
      const pill = (t, col) => `<span class="pl" style="--pc:${col}">${esc(t)}</span>`;
      const prosa = `<div class="card prosa">${run ? 'Varmepumpa går på ' : 'Varmepumpa hviler'}${run ? pill(f == null ? '– Hz' : M.nf(f, 0) + ' Hz', C.orange) : ''} og holder ${pill(inne == null ? '–' : deg(inne), C.green)} inne. Varmtvannet er ${pill(vv == null ? '–' : deg(vv), C.red)}${this._charging() ? ' og lades nå' : ''}.</div>`;
      const t2 = this._N('bt2'), t3 = this._N('bt3'), mal = this._N('beregnet'), ek = this._N('elkolbe');
      const rows = [
        this._row('energy'),
        this._row('cost_day'),
        this._row('bt2', { sub: mal != null ? 'Mål ' + deg(mal) : '' }),
        this._row('bt3', { sub: t2 != null && t3 != null ? 'ΔT ' + M.nf(t2 - t3, 1) + '°' : '' }),
        this._row('bt50'),
        this._row('elkolbe', { cls: ek != null && ek > 0 ? 'gul' : '', vcls: ek != null && ek > 0 ? 'gul' : '', sub: ek != null && ek > 0 ? 'Tilskudd er på' : '' }),
      ].join('');
      return `${prosa}<div class="card list">${rows}</div>
        <div class="card"><div class="ct">Tur og retur · 7 døgn</div>${this._graph('tr', [{ k: 'bt2', col: C.red, label: 'Tur' }, { k: 'bt3', col: C.blue, label: 'Retur' }], 168, this._h7)}</div>
        ${this._acc('cost', 'Kostnad', 'mdi:cash', ['cost_hour', 'cost_day', 'cost_month', 'cost_year'])}
        ${this._acc('sys', 'Systemdrift', 'mdi:cog-outline', ['gm', 'drift', 'starter', 'avriming', 'tidsfaktor', 'komp_status'])}
        ${this._acc('strom', 'Strøm', 'mdi:flash', ['be1', 'be2', 'be3', 'power', 'add_power'])}`;
    }
    _varme() {
      const mal = this._N('beregnet');
      return `<div class="card blks">${this._seg('driftsstilling', 'Driftsstilling')}${this._seg('smart', 'Smart Home-modus')}</div>
        <div class="card list">${this._stepper('kurve', 'Varmekurve')}${this._stepper('forskyvning', 'Forskyvning')}${this._stepper('onsket', 'Ønsket temperatur')}${this._stepper('start_gm', 'Start kompressor', 'Gradminutter')}${this._stepper('stopp', 'Stopp av varme', 'Ved utetemperatur over')}
          ${this._row('beregnet', { val: mal != null ? deg(mal) : undefined })}</div>`;
    }
    _vv() {
      const fill = this._vvFill(), sw = this._e('boost'), sel = this._e('boost_sel');
      const bs = sw ? this.s(sw) : sel ? this.s(sel) : null;
      const bOn = sw ? on(bs) : bs ? okS(bs) && !/^(off|av)$/i.test(bs.state) : false;
      const leg = this._S('legionella'), upd = this._S('fastvare');
      const V = [];
      if (this._alarmOn()) V.push(['red', 'mdi:bell-alert', 'Varsel fra varmepumpa', this._e('alarm')]);
      if (upd && upd.state === 'on') V.push(['orange', 'mdi:update', `Ny fastvare ${upd.attributes.latest_version || ''}`.trim(), upd.entity_id]);
      if (this._wifiOff()) V.push(['red', 'mdi:wifi-off', 'Varmepumpa er frakoblet', this._e('wifi')]);
      if (okS(leg) && Date.parse(leg.state) && Date.parse(leg.state) - Date.now() < 86400000 * 2) V.push(['blue', 'mdi:bacteria-outline', 'Legionellaøkning ' + tidTil(leg.state), leg.entity_id]);
      return `<div class="card"><div class="ct">Varmtvann · 24 t</div>${this._graph('vv', [{ k: 'vv', col: C.red, label: 'BT7' }, { k: 'bt6', col: C.orange, label: 'BT6' }], 24, this._h24)}</div>
        <div class="card fyll"><div class="fh"><span>Fyllingsgrad${fill && fill.calc ? ' (beregnet fra BT7)' : ''}</span><b class="num">${fill ? M.nf(fill.f * 100, 0) + ' %' : '–'}</b></div><span class="bar big"><i style="width:${fill ? (fill.f * 100).toFixed(0) : 0}%"></i></span></div>
        <div class="card blks">${this._seg('behov', 'Behov')}
          <button class="boost press ${bOn ? 'on' : ''}" data-act="boostvv" ${bs ? `data-ent="${esc(bs.entity_id)}"` : ''} aria-pressed="${bOn}">${M.icon('mdi:rocket-launch', 20)}<span>${bs ? (bOn ? 'Boost er på' + (sel && !sw ? ' · ' + optNb(bs.state) : '') : 'Boost varmtvann') : 'Boost – velg entitet'}</span></button></div>
        <div class="card list">${this._row('vv')}${this._row('bt6')}${this._row('vv_temp')}${this._row('ladeverdi')}${this._row('mengde')}${this._row('andel')}${this._row('vv_tid')}${this._row('vv_modus')}${this._row('legionella')}</div>
        ${V.length ? `<div class="varsel">${V.map(([col, ic, t, id]) => `<button class="vl ${col}" ${id ? `data-act="more" data-id="${esc(id)}"` : ''}>${M.icon(ic, 18)}<span class="ell">${esc(t)}</span></button>`).join('')}</div>` : ''}`;
    }
    _luft() {
      const fan = this._fanDur(), v = this._N('vifte');
      const sw = (k, label) => {
        const id = this._e(k), s = id ? this.s(id) : null;
        if (!s) return this._row(k, { label });
        const o = on(s);
        return `<div class="rw"><span class="ri ${k === 'vent' && o ? 'spin-i' : ''}">${M.icon(RK[k][6], 20)}</span><button class="grow col tl" data-act="more" data-id="${esc(id)}" data-ent="${esc(id)}"><span class="ell">${esc(label)}</span></button><button class="sw ${o ? 'on' : ''}" role="switch" aria-checked="${o}" aria-label="${esc(label)}" data-act="toggle" data-id="${esc(id)}"><i></i></button></div>`;
      };
      return `<div class="card"><div class="ct">Avtrekk og avkast · 24 t</div>${this._graph('luft', [{ k: 'bt20', col: C.orange, label: 'BT20' }, { k: 'bt21', col: C.blue, label: 'BT21' }], 24, this._h24)}</div>
        <div class="card list">${this._row('vifte', { cls: fan ? 'spin-i' : '', style: `--vp-dur:${fan || 2}s`, sub: v != null ? (v >= 70 ? 'Høy' : v >= 35 ? 'Normal' : v > 0 ? 'Lav' : 'Stopp') : '' })}${this._row('bs1')}${this._row('viftemodus')}
          ${sw('vent', 'Økt ventilasjon')}${sw('natt', 'Nattkjøling')}</div>`;
    }

    afterRender() {
      const Rt = this.shadowRoot;
      if (M.glassDrag) Rt.querySelectorAll('.tabs').forEach((s) => M.glassDrag(s, { axis: 'x' }));
      // −/+ og graf-scrub: ikke la Bubble Card lukke/scrolle popupen (fallgruve 2)
      Rt.querySelectorAll('.pm').forEach((b) => {
        if (b.__vp) return; b.__vp = true;
        const stop = (e) => e.stopPropagation();
        b.addEventListener('pointerdown', stop); b.addEventListener('touchstart', stop, { passive: true }); b.addEventListener('touchmove', stop, { passive: true });
      });
      Rt.querySelectorAll('.gr[data-g] .gs').forEach((svg) => {
        if (svg.__vp) return; svg.__vp = true;
        const gr = svg.closest('.gr');
        M.guardDrag(svg, 'none');
        const at = (e) => { const r = svg.getBoundingClientRect(), n = Number(gr.dataset.n) || 48; const f = M.clamp((e.clientX - r.left) / (r.width || 1), 0, 1); return Math.round(f * (n - 1)); };
        let act = false;
        svg.addEventListener('pointerdown', (e) => { e.stopPropagation(); act = true; try { svg.setPointerCapture(e.pointerId); } catch (x) { /* */ } this._scrub = { g: gr.dataset.g, i: at(e) }; M.haptic('selection'); this.update(); });
        svg.addEventListener('pointermove', (e) => { if (!act) return; e.stopPropagation(); const i = at(e); if (!this._scrub || this._scrub.i !== i) { this._scrub = { g: gr.dataset.g, i }; this.update(); } });
        const end = () => { if (!act) return; act = false; setTimeout(() => { if (!act) { this._scrub = null; this.update(); } }, 1600); };
        svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end);
      });
      if (this.isOpen && !this._h24 && !this._loading) { this._loading = true; Promise.resolve(this._load()).finally(() => { this._loading = false; }); }
    }
    get styles() {
      const a = (x, p) => M.alpha(x, p);
      return `
        :host{display:block;width:100%}
        .wrap{display:flex;flex-direction:column;gap:var(--msh-gap,8px);container-type:inline-size}
        .top{position:relative;height:176px;border-radius:28px;background:var(--gray200,#3a3a3a);box-shadow:${C.edge};overflow:hidden}
        .top .tl{position:absolute;left:18px;top:18px;right:190px;display:flex;flex-direction:column;align-items:flex-start;gap:8px;min-width:0}
        .tn{font-size:13px;color:var(--gray800,#afafaf);max-width:100%}
        .chip{height:26px;max-width:100%;padding:0 10px;border-radius:13px;display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:500;background:rgba(255,255,255,.08);color:var(--gray800,#afafaf)}
        .chip.on{background:${a(C.orange, 0.18)};color:${C.orange}}
        .tv{position:absolute;left:18px;top:92px;display:flex;align-items:baseline;gap:4px;cursor:pointer}
        .tv .big{font-size:44px;font-weight:300;line-height:1;letter-spacing:-.02em}
        .tv .u{font-size:20px;color:var(--gray700,#979797)}
        .ts{position:absolute;left:18px;bottom:16px;font-size:12px;color:var(--gray600,#7f7f7f)}
        .pumpe{position:absolute;right:10px;top:13px;width:170px;height:150px}
        .svt{font-size:10px;fill:#afafaf;font-family:inherit}
        .hzt{font-size:10px;font-weight:600;fill:#fafafa;font-family:inherit}.hzt.on{fill:#2a1a0a}
        .ror{fill:none;stroke-width:5;stroke-linecap:round}.ror.varm{stroke:${C.red}}.ror.kald{stroke:${C.blue}}
        .ror.flow{stroke-dasharray:6 7;animation:vp-flow 1s linear infinite}
        .top.run .skap{filter:drop-shadow(0 0 10px ${a(C.orange, 0.35)})}
        .vifte.spin{animation:vp-spin var(--vp-dur,1.6s) linear infinite}
        .dupp{animation:vp-dupp 2.4s ease-in-out infinite}
        .bolge{animation:vp-bolge 2s ease-in-out infinite}
        .puls .big{animation:vp-puls 2.6s ease-in-out infinite}
        .kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--msh-gap,8px)}
        .kp{min-width:0;border-radius:24px;background:var(--gray200,#3a3a3a);box-shadow:${C.edge};padding:14px 10px;display:flex;flex-direction:column;align-items:flex-start;gap:4px;text-align:left}
        .kp.glod{animation:vp-glod 3s ease-in-out infinite}
        .kh{display:flex;align-items:center;gap:4px;font-size:12px;color:var(--gray800,#afafaf);min-width:0;max-width:100%}
        .ki{display:inline-flex}.ki.pust{color:${C.orange};animation:vp-pust 2.4s ease-in-out infinite}.ki.dupp{color:${C.red}}
        .kv{font-size:24px;font-weight:400;line-height:1.1}.kv small{font-size:13px;color:var(--gray700,#979797);margin-left:2px}
        .ks{font-size:11px;color:var(--gray600,#7f7f7f);max-width:100%}
        .bar{display:block;width:100%;height:4px;border-radius:2px;background:var(--gray400,#545454);overflow:hidden;margin:2px 0}
        .bar i{display:block;height:100%;border-radius:2px;background:${C.orange};transition:width .4s}
        .bar.big{height:10px;border-radius:5px}.bar.big i{background:linear-gradient(90deg,${C.orange},${C.red})}
        .qbs{display:flex;gap:6px}
        .qb{flex:1 1 0;min-width:0;border-radius:24px;background:var(--gray200,#3a3a3a);box-shadow:${C.edge};padding:10px 4px;display:flex;flex-direction:column;align-items:center;gap:3px}
        .qbs.ic .qb{padding:8px 4px}
        .qi{width:44px;height:44px;border-radius:22px;display:grid;place-items:center;background:var(--gray300,#404040);transition:background .2s,color .2s}
        .ql{font-size:12px;max-width:100%}.qs{font-size:10px;color:var(--gray600,#7f7f7f);max-width:100%}
        .qb.miss{opacity:.55}
        .qb.on.orange .qi{background:${C.orange};color:#2a1a0a}.qb.on.blue .qi{background:${C.blue};color:#0f2233}
        .qb.on.green .qi{background:${C.green};color:#12291d}.qb.on.red .qi{background:${C.red};color:#2c1411}
        .qb.spin-i .qi ha-icon,.ri.spin-i ha-icon{animation:vp-spin var(--vp-dur,1.2s) linear infinite}
        .qb.vib .qi ha-icon{animation:vp-vib .18s linear infinite}
        .qb.rist .qi ha-icon{animation:vp-rist 1.1s ease-in-out infinite;transform-origin:50% 10%}
        .qb.blink .qi{animation:vp-blink 1.2s ease-in-out infinite}
        .trow{display:flex;align-items:center;gap:8px;min-width:0}
        .tabs{flex:1;min-width:0;display:flex;gap:2px;padding:4px;border-radius:24px;background:var(--gray200,#3a3a3a);position:relative;touch-action:pan-y;overflow:hidden}
        .tb{flex:1 1 0;min-width:0;height:40px;padding:0 6px;border-radius:20px;display:inline-flex;align-items:center;justify-content:center;gap:5px;font-size:13px;color:var(--gray800,#afafaf);white-space:nowrap;overflow:hidden}
        .tb span{overflow:hidden;text-overflow:ellipsis}
        .tabs .tb.on,.tabs .itab.on{background:${C.accent};color:#2a1720;font-weight:500}
        .tabs .itab{color:var(--gray800,#afafaf)}
        ${M.iconTabs.css('.tabs.itabs')}
        .gear{width:48px;height:48px;border-radius:24px;flex:none;display:grid;place-items:center;background:var(--gray200,#3a3a3a);box-shadow:${C.edge}}
        .pane{display:flex;flex-direction:column;gap:var(--msh-gap,8px)}
        .card{padding:14px 14px}
        .card.list{padding:6px 6px}
        .ct{font-size:12px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--gray600,#7f7f7f);margin:0 2px 10px}
        .prosa{font-size:17px;line-height:1.6;color:var(--gray900,#c7c7c7)}
        .pl{display:inline-flex;align-items:center;height:26px;padding:0 10px;margin:0 2px;border-radius:13px;font-size:14px;font-weight:500;background:${a('var(--pc)', 0.18)};color:var(--pc);vertical-align:1px}
        .rw{width:100%;min-height:52px;display:flex;align-items:center;gap:12px;padding:6px 10px;border-radius:18px;text-align:left}
        .rw+.rw{border-top:1px solid rgba(255,255,255,.06);border-radius:0}
        .rw .col small{font-size:11px;color:var(--gray600,#7f7f7f)}
        .ri{width:36px;height:36px;border-radius:18px;flex:none;display:grid;place-items:center;background:var(--gray300,#404040);color:var(--gray800,#afafaf)}
        .ri.gul{background:${a(C.yellow, 0.2)};color:${C.yellow}}
        .rv{font-size:15px;flex:none;max-width:45%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.rv.gul{color:${C.yellow}}
        .rw.miss .rv{color:var(--gray600,#7f7f7f)}
        .vs{height:30px;padding:0 12px;border-radius:15px;background:var(--gray300,#404040);font-size:12px;flex:none}
        .tl{text-align:left}
        .pm{width:40px;height:40px;border-radius:20px;flex:none;display:grid;place-items:center;background:var(--gray300,#404040);touch-action:manipulation}
        .pm[disabled]{opacity:.35;cursor:default}
        .sv{min-width:58px;text-align:center;font-size:16px;font-weight:500}.sv.pend{color:${C.pink}}
        .blks{display:flex;flex-direction:column;gap:12px}
        .bt{font-size:12px;color:var(--gray700,#979797);margin:0 4px 6px}
        .seg{display:flex;gap:2px;padding:4px;border-radius:22px;background:var(--gray300,#404040)}
        .sg{flex:1 1 0;min-width:0;height:36px;border-radius:18px;font-size:13px;color:var(--gray800,#afafaf);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 6px}
        .sg.on{background:${C.accent};color:#2a1720;font-weight:500}
        .boost{height:48px;border-radius:24px;background:var(--gray300,#404040);display:flex;align-items:center;justify-content:center;gap:8px;font-size:14px;font-weight:500}
        .boost.on{background:${C.orange};color:#2a1a0a}
        .fyll .fh{display:flex;justify-content:space-between;align-items:baseline;font-size:13px;color:var(--gray800,#afafaf);margin-bottom:10px}.fyll b{font-size:18px;color:#fafafa;font-weight:500}
        .gr{position:relative;display:flex;flex-direction:column;gap:6px}
        .gr.none{flex-direction:row;align-items:center;gap:10px;color:var(--gray700,#979797);font-size:13px}.gr.none span{flex:1}
        .gs{width:100%;height:96px;display:block;touch-action:none;cursor:crosshair}
        .gl{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:12px;color:var(--gray800,#afafaf);align-items:center}
        .gl i{display:inline-block;width:8px;height:8px;border-radius:4px;margin-right:5px}.gl b{color:#fafafa;font-weight:500}
        .gt{margin-left:auto;color:var(--gray600,#7f7f7f)}
        .gx{display:flex;justify-content:space-between;font-size:11px;color:var(--gray600,#7f7f7f)}
        .gw{position:absolute;right:0;bottom:18px;font-size:11px;color:var(--gray600,#7f7f7f)}
        .sw{position:relative;width:44px;height:26px;border-radius:13px;flex:none;background:var(--gray400,#545454);transition:background .2s}
        .sw i{position:absolute;left:3px;top:3px;width:20px;height:20px;border-radius:10px;background:#fafafa;transition:transform .2s cubic-bezier(.34,1.4,.64,1)}
        .sw.on{background:${C.pink}}.sw.on i{transform:translateX(18px)}
        .acc{border-radius:24px;background:#3d3d3d;box-shadow:${C.edge};overflow:hidden}
        .ah{width:100%;height:56px;display:flex;align-items:center;gap:12px;padding:0 14px 0 10px;text-align:left;font-size:15px;font-weight:500}
        .ai{width:36px;height:36px;border-radius:18px;display:grid;place-items:center;background:var(--gray300,#404040);color:var(--gray800,#afafaf);flex:none}
        .an{font-size:12px;color:var(--gray600,#7f7f7f);font-weight:400}
        .ab{padding:0 6px 6px}
        .ab .rw:first-child{border-top:1px solid rgba(255,255,255,.06);border-radius:0}
        .varsel{display:flex;flex-direction:column;gap:6px}
        .vl{height:44px;border-radius:22px;display:flex;align-items:center;gap:10px;padding:0 14px;font-size:13px;text-align:left}
        .vl.red{background:${a(C.red, 0.16)};color:${C.red}}.vl.orange{background:${a(C.orange, 0.16)};color:${C.orange}}.vl.blue{background:${a(C.blue, 0.16)};color:${C.blue}}
        .empty.nf b{color:#fafafa;font-size:15px;font-weight:500}
        @keyframes vp-spin{to{transform:rotate(360deg)}}
        @keyframes vp-flow{to{stroke-dashoffset:-26}}
        @keyframes vp-dupp{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
        @keyframes vp-bolge{0%,100%{transform:translateX(0)}50%{transform:translateX(-6px)}}
        @keyframes vp-puls{0%,100%{opacity:1}50%{opacity:.6}}
        @keyframes vp-pust{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.15);opacity:.75}}
        @keyframes vp-glod{0%,100%{box-shadow:${C.edge},0 0 0 0 ${a(C.orange, 0)}}50%{box-shadow:${C.edge},0 0 16px 1px ${a(C.orange, 0.28)}}}
        @keyframes vp-vib{0%,100%{transform:translateX(0)}25%{transform:translateX(-1px)}75%{transform:translateX(1px)}}
        @keyframes vp-rist{0%,55%,100%{transform:rotate(0)}10%{transform:rotate(-14deg)}20%{transform:rotate(12deg)}30%{transform:rotate(-9deg)}40%{transform:rotate(6deg)}}
        @keyframes vp-blink{50%{opacity:.35}}
        .ki.dupp{animation:vp-dupp 2.4s ease-in-out infinite}
        .noanim *,.noanim *::before{animation:none!important}
        @media (prefers-reduced-motion: reduce){.wrap *{animation:none!important}}
        @container (max-width:460px){.tabs:not(.itabs) .tb ha-icon{display:none!important}.tb{padding:0 2px}}
        @container (max-width:400px){.tb{font-size:12px}}
        @container (max-width:360px){.kh .ki{display:none!important}}
        @media (max-width:380px){.top .tl{right:150px}.pumpe{width:140px;height:124px;top:26px}.tv .big{font-size:38px}.ql{font-size:11px}.qi{width:40px;height:40px}}
      `;
    }
  }

  M.POPUP_CARDS = M.POPUP_CARDS || [];
  if (!M.POPUP_CARDS.includes('msh-varmepumpe-card')) M.POPUP_CARDS.push('msh-varmepumpe-card'); // «Mellomrom» ligger i Visning-fanen
  // Den gamle importerte #varmepumpe (gap-card, button-cards, grids, simple-tabs, mini-graph-card, ki-varmepumpe-card) erstattes
  // av ETT msh-varmepumpe-card – til brukeren velger «Bruk egen» (04-strategy). Ingen entiteter skrives inn i config.
  M.POPUP_SUPERSEDE = M.POPUP_SUPERSEDE || {};
  M.POPUP_SUPERSEDE[HASH] = { name: 'Varmepumpe', test: (cfg) => { const j = JSON.stringify(cfg || {}); return /custom:ki-varmepumpe-card/.test(j) || /nibe|_4001[34]\b|_40004\b/i.test(j); } };
  M.POPUP_EXTRA = M.POPUP_EXTRA || {};
  M.POPUP_EXTRA[HASH] = () => ({ card_id: 'varmepumpe' });
  // Vilkår (strategi/allPopups): en NIBE-enhet (produsent NIBE, eller nibe_heatpump/myuplink-entiteter)
  M.popupNeeds = M.popupNeeds || {};
  M.popupNeeds[HASH] = (hass) => M.varmepumpeHas(hass);
  M.varmepumpe = { oppdag, ROLES, nibeDevices };
  M.define('msh-varmepumpe-card', Varmepumpe, 'MSH Varmepumpe', 'Varmepumpe-popup (#varmepumpe): NIBE S/F-serien via nibe_heatpump / myUplink – animert pumpe, KPI, hurtigknapper, Info · Varme · Varmtvann · Luft og diagnostikk.');
})();
