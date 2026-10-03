/* msh-varmepumpe-card · Varmepumpe-popup #varmepumpe (fiks 26.20 / 31.2 – promptets «ki-varmepumpe-card»).
 * Fiks 31.2: bygget på nytt 1:1 etter «design/Varmepumpe v3.dc.html» (struktur, mål, tekster, animasjoner og keyframes
 * fade/spin/flow/flowv/rise portert direkte). Funksjons-popup (Mal A), ÉTT kort, Bubble eier headeren.
 * Rekkefølge (v3): toppkort 176 px (gradient 165°, skap 62×128 #e9e4de med vifte (spin), Hz-merke #f0a36b og tank som fylles,
 *   rør med flyt (flow/flowv), 5 ribber, varme som stiger (rise), «Varmepumpe» + chip, kW 40/300 og «Ute … · … kr») ·
 *   3 KPI-kort (#3d3d3d r22: Ute, Kompressor, Varmtvann) · hurtigknapper (72 px r22, rosa når aktiv, ellers kontur #4a4a4a;
 *   Boost, Vifte, Pumpe (skjult som standard), Eco, Alarm, Wi-Fi – knapper uten entitet vises ikke) · fanelinje (#3a3a3a r26,
 *   faner 44 px, Info · Varme · Varmtvann · Luft, hold 400 ms + dra = MSH.tabRow) + tannhjul 52 px · faneinnhold (fade .3s) ·
 *   «Diagnostikk» (52 px r26 + rutenett 2 kolonner).
 *   Info (26.20): prosa med piller, rader (energi, kostnad, tur/retur/rom/elkolbe), graf tur/retur 7 døgn og akkordeonene
 *   Kostnad · Systemdrift · Strøm i samme stil som Diagnostikk.
 * Autokonfig (NIBE S/F-serien, integrasjonene nibe_heatpump / myuplink): enheten(e) i hass.devices med produsent «NIBE» (eller
 *   entiteter fra de to plattformene). Roller matches på parameter-ID-suffikset (_40013 …) først, deretter på navn. Ingen
 *   hardkodede entitets-ID-er og aldri mock: mangler en rolle → «–» + «Velg entitet». Luft-fanen skjules uten BT20/BT21.
 * Animasjoner (stopper når entiteten er av): vifta i toppkortet snurrer i takt med viftehastigheten (raskt ved Boost/økt
 *   ventilasjon), rør/varme bare når kompressoren går, puls på kW, pust på kompressor-ikonet, dupp på varmtvann ved lading,
 *   snurr på Vifte-knappen, vibrering på Pumpe, rist på Alarm og blink på Wi-Fi av. Av med `anim: false` / reduced-motion.
 * «Tilpass varmepumpe» (tannhjulet) = arket fra v3 (MSH.overlay tilpass: true + MSH.draftEditor, Ferdig = rosa pille):
 *   fast forhåndsvisning + fanene Knapper · Faner · Entiteter · Visning; scrollområdet under. Samme config i GUI-editoren.
 * Config: name, device (enhets-id, tomt = automatisk), buttons / buttons_hidden (standard ['pump']) / button_names,
 *   button_style: icon_text|icon, tabs / tabs_hidden / tab_names, tab_style: name|icon|icon_name (Tekst/Ikon/Begge, standard
 *   name), start_tab, overrides: { <rolle>: entity_id }, kpi, sentence, diag, anim, gap/pad_top/pad_bottom.
 */
(function () {
  const M = window.MSH;
  if (!M || customElements.get('msh-varmepumpe-card')) return;
  const esc = M.esc;
  const HASH = '#varmepumpe';
  const PLATS = ['nibe_heatpump', 'myuplink'];
  const DEF = { tab_style: 'name', button_style: 'icon_text', kpi: true, diag: true, anim: true, sentence: true };
  // v3-paletten
  const PINK = 'linear-gradient(160deg,#f28ac9,#f6c9c4)', INK = 'rgba(70,58,64,.95)', BLUE = '#7ab8f0', GREEN = '#6fd29a', ORANGE = '#f0a36b';
  const PINK_BTN = 'linear-gradient(145deg, rgb(242 133 201) -10%, rgb(245 205 198) 100%)';

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
  const kW = (s) => { const v = numS(s); if (v == null) return null; return /^w$/i.test(unitS(s)) ? v / 1000 : v; };
  const on = (s) => !!s && ['on', 'true', 'home', 'connected', 'running'].includes(String(s.state).toLowerCase());
  // select-valg → norsk etikett
  const OPT_NB = [[/^auto(matic)?$/i, 'Auto'], [/^manu(al|ell)$/i, 'Manuell'], [/add.*heat.*only|kun.*tillegg|addition only/i, 'Kun tillegg'], [/^(default|normal|home|hjemme)$/i, 'Normal'], [/^(away|borte)$/i, 'Borte'],
    [/^(vacation|holiday|ferie)$/i, 'Ferie'], [/^(small|economy|eco|okonomi|økonomi|low)$/i, 'Økonomi'], [/^(medium|normal)$/i, 'Normal'], [/^(large|luxury|luksus|high)$/i, 'Luksus'], [/^(off|av)$/i, 'Av'], [/one.?time|engang/i, 'Engangsøkning']];
  const optNb = (o) => { const m = OPT_NB.find(([re]) => re.test(String(o).trim())); return m ? m[1] : String(o); };
  const isNormal = (o) => /^(default|normal|home|hjemme)$/i.test(String(o || '').trim());
  const isAway = (o) => /^(away|borte)$/i.test(String(o || '').trim());


  /* ------------------------------------------------------------ knapper og faner (v3: QDEF / TDEF) */
  // [nøkkel, standardnavn, ikon, rolle]
  const BTNS = [['boost', 'Boost', 'mdi:water-boiler', 'boost'], ['vent', 'Vifte', 'mdi:fan', 'vent'], ['pump', 'Pumpe', 'mdi:pump', 'pump'],
    ['eco', 'Eco', 'mdi:leaf', 'smart'], ['alarm', 'Alarm', 'mdi:alert-circle', 'alarm'], ['wifi', 'Wi-Fi', 'mdi:wifi', 'wifi']];
  const BK = Object.fromEntries(BTNS.map((b) => [b[0], b]));
  const TABS = [['info', 'Info', 'mdi:information'], ['varme', 'Varme', 'mdi:heat-wave'], ['vv', 'Varmtvann', 'mdi:water-boiler'], ['luft', 'Luft', 'mdi:weather-windy']];
  const TK = Object.fromEntries(TABS.map((t) => [t[0], t]));
  const BTN_HIDE_DEF = ['pump'];
  const TAB_MODES = [['icon', 'Ikon'], ['name', 'Tekst'], ['icon_name', 'Begge']];
  const BTN_MODES = [['icon', 'Bare ikon'], ['icon_text', 'Ikon + tekst']];

  /* ------------------------------------------------------------ rekkefølge / synlighet */
  const orderOf = (list, keys) => { const o = (Array.isArray(list) ? list : []).filter((k) => keys.includes(k)); keys.forEach((k) => { if (!o.includes(k)) o.push(k); }); return o; };
  const btnOrder = (c) => orderOf(c.buttons, BTNS.map((b) => b[0]));
  const tabOrder = (c) => orderOf(c.tabs, TABS.map((t) => t[0]));
  const btnHidden = (c) => new Set(Array.isArray(c.buttons_hidden) ? c.buttons_hidden : BTN_HIDE_DEF);
  const tabHidden = (c) => new Set(Array.isArray(c.tabs_hidden) ? c.tabs_hidden : []);
  const btnName = (c, k) => ((c.button_names || {})[k] || '').trim() || BK[k][1];
  const tabName = (c, k) => ((c.tab_names || {})[k] || '').trim() || TK[k][1];
  const btnEnt = (hass, c, k) => entOf(hass, c, BK[k][3]) || (k === 'boost' ? entOf(hass, c, 'boost_sel') : null);
  const hasLuft = (hass, c) => !!(entOf(hass, c, 'bt20') || entOf(hass, c, 'bt21'));
  // 36.5: startfane (felles MSH.startTab) – start_tab | 'last'; gammel '' («Sist brukt») = 'last'
  const ST_LEG = (c) => (c && c.start_tab === '' ? 'last' : undefined);
  const visTabs = (hass, c) => { const H = tabHidden(c); return tabOrder(c).filter((k) => !H.has(k) && (k !== 'luft' || !hass || hasLuft(hass, c))); };
  // Knapper uten entitet vises ikke (v3: «Knapper uten entitet vises ikke»)
  const visBtns = (hass, c) => { const H = btnHidden(c); return btnOrder(c).filter((k) => !H.has(k) && (!hass || !!btnEnt(hass, c, k))); };
  // 33.4 · fanehøyde (05-tab-bar.js): variabler + felles editorfelt
  const TV = (k, n) => (M.tabH ? M.tabH.v(k, n) : n + 'px');
  const VTH = { items: (h, c) => (h ? visTabs(h, c) : (c.tabs || TABS.map((t) => t[0]))).map((k) => ({ key: k, label: tabName(c, k), icon: (TK[k] || [])[2] })), mode: (c) => ({ icon: 'ikon', name: 'tekst', icon_name: 'rad' })[tabStyle(c)] || 'tekst', native: 44, gear: true };
  const tabStyle = (c) => (['icon', 'name', 'icon_name'].includes(c.tab_style) ? c.tab_style : DEF.tab_style);
  const btnStyle = (c) => (c.button_style === 'icon' ? 'icon' : 'icon_text');

  /* ------------------------------------------------------------ tall */
  const fmtN = (v, d) => (v == null ? '–' : M.nf(v, d));
  const signed = (v) => (v == null ? '–' : v > 0 ? '+' + M.nf(v, v % 1 ? 1 : 0) : M.nf(v, v % 1 ? 1 : 0));
  // verdi + enhet hver for seg (rader med stort tall og liten enhet, som v3)
  function vu(s) {
    if (!okS(s)) return ['–', ''];
    const v = numS(s), u = unitS(s);
    if (v == null) {
      if (s.entity_id && dom(s.entity_id) === 'binary_sensor') return [s.state === 'on' ? 'På' : 'Av', ''];
      if (s.attributes.device_class === 'timestamp') return [omTid(s.state), ''];
      if (dom(s.entity_id) === 'update') return [s.state === 'on' ? 'Ny versjon' : (s.attributes.installed_version || 'Oppdatert'), ''];
      return [optNb(s.state), ''];
    }
    if (s.attributes.device_class === 'monetary' || /^(nok|kr)$/i.test(u)) return [M.nf(v, 2), 'kr'];
    if (u === '°C') return [M.nf(v, 1), '°'];
    return [M.nf(v, dec(v, u)), u];
  }
  const omTid = (iso) => { const t = Date.parse(iso); if (isNaN(t)) return String(iso); const d = (t - Date.now()) / 86400000; return d <= 0 ? 'i dag' : d < 1 ? `om ${Math.max(1, Math.round(d * 24))} t` : `om ${Math.round(d)} d`; };

  /* ------------------------------------------------------------ graf (v3: viewBox 300×70, y = 68 − (v−lo)/(hi−lo)·64) */
  const GN = 48;
  function gpaths(series, lo, hi) {
    const y = (v) => (68 - ((v - lo) / (hi - lo || 1)) * 64).toFixed(1);
    return series.map((arr) => (arr && arr.length > 1 ? arr.map((v, i) => `${i ? 'L' : 'M'}${((i / (arr.length - 1)) * 300).toFixed(1)},${y(v)}`).join(' ') : ''));
  }
  const area = (p) => (p ? p + ' L300,70 L0,70 Z' : '');

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
    customize(focus, opts) {
      if ((this._config && this._config.embedded && this._host) || focus === 'spacing') return super.customize(focus, opts);
      return openSheet(this, focus);
    }
    // 36.5: startfanen settes av MSH.startTab (basekortet) før onOpen
    static get startTabSpec() { return { tabs: (card) => visTabs(card.hass, card.config), legacy: ST_LEG }; }
    onOpen() {
      this._load();
    }
    // Historikk kun når popupen er åpen (fallgruve 8): 24 t for varmtvann/luft, 7 døgn for tur/retur. 5 min mellomlager.
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
        case 'tab': if (d.v) { this._scrub = null; this.setUI({ tab: d.v }); } return undefined;
        case 'acc': { const a = { ...(this.ui.acc || {}) }; a[d.v] = !a[d.v]; return this.setUI({ acc: a }); }
        case 'btn': return this._btn(d.v);
        case 'opt': return d.id && d.o != null && M.call(h, 'select', 'select_option', { entity_id: d.id, option: d.o });
        case 'step': return this._step(d.id, Number(d.d));
        case 'boostvv': return this._boostVV();
        default: return super.onAction(name, el, ev);
      }
    }
    _btn(k) {
      const h = this.hass, id = btnEnt(h, this.config, k);
      if (!id || !h.states[id]) return this.customize('entiteter');
      if (k === 'boost') return this._boostVV();
      if (k === 'vent') return M.toggle(h, id);
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
      return this.customize('entiteter');
    }
    _step(id, dir) {
      const h = this.hass, s = id && h.states[id];
      if (!s) return;
      const A = s.attributes, st = Number(A.step) || 1, cur = this._pend && this._pend[id] != null ? this._pend[id] : numS(s);
      if (cur == null) return;
      const mn = A.min != null ? Number(A.min) : -Infinity, mx = A.max != null ? Number(A.max) : Infinity;
      const val = Number((Math.round(M.clamp(cur + dir * st, mn, mx) / st) * st).toFixed(3));
      if (val === cur) { M.haptic('warning'); return; }
      this._pend = { ...(this._pend || {}), [id]: val };
      clearTimeout(this._pt);
      this._pt = setTimeout(() => { const p = this._pend || {}; const x = p[id]; delete p[id]; if (x != null) M.call(this.hass, 'number', 'set_value', { entity_id: id, value: x }).catch(() => {}); }, 450);
      this.update();
    }

    /* ---------------------------------------------------------- tilstand */
    _running() { const f = this._N('freq'); if (f != null) return f > 0; const cs = this._S('komp_status'); return !!cs && /run|går|on|start/i.test(String(cs.state)); }
    _charging() {
      const t = [this._S('status'), this._S('vv_modus'), this._S('komp_status')].filter(okS).map((s) => String(s.state)).join(' ');
      return (this._running() && /hot ?water|varmtvann|hw|lad|charg|dhw/i.test(t)) || on(this._S('boost'));
    }
    _alarmOn() { const s = this._S('alarm'); if (!okS(s)) return false; if (dom(s.entity_id) === 'binary_sensor') return s.state === 'on'; const v = numS(s); return v != null ? v > 0 : !/^(0|ingen|none|ok|no alarm|off|false)$/i.test(String(s.state).trim()); }
    _wifiOff() { const s = this._S('wifi'); return !!s && (s.state === 'off' || !okS(s)); }
    _boostOn() { const sw = this._S('boost'); if (sw) return on(sw); const sel = this._S('boost_sel'); return !!sel && okS(sel) && !/^(off|av)$/i.test(sel.state); }
    // v3: vifta snurrer 2,2 s (normal) / 0,5 s (Boost); i takt med viftehastigheten når den finnes. 0 = står.
    _fanDur() {
      if (this._boostOn() || on(this._S('vent'))) return 0.5;
      const v = this._N('vifte');
      if (v == null) return this._running() || this._e('freq') == null ? 2.2 : 0;
      if (v <= 0) return 0;
      return Number(Math.max(0.5, 2.2 * (58 / Math.max(10, Math.min(100, v)))).toFixed(2));
    }
    _vvFill() {
      const m = this._S('mengde');
      if (okS(m) && /%/.test(unitS(m)) && numS(m) != null) return { f: M.clamp(numS(m) / 100, 0, 1), calc: false };
      const t = this._N('vv');
      return t == null ? null : { f: M.clamp((t - 20) / (55 - 20), 0, 1), calc: true };
    }

    /* ---------------------------------------------------------- tegning */
    render() {
      const h = this.hass, c = this.config;
      const R = oppdag(h, c);
      R.ids.forEach((id) => this._deps.add(id));
      Object.values(c.overrides || {}).forEach((id) => { if (id) this._deps.add(id); });
      Object.keys(R.roles).forEach((k) => this._deps.add(R.roles[k]));
      if (this._pend) Object.keys(this._pend).forEach((id) => { const s = h.states[id]; if (s && numS(s) === this._pend[id]) delete this._pend[id]; });
      const parts = [this._top()];
      if (!R.devs.length && !Object.keys(c.overrides || {}).length) parts.push(`<div class="nf" data-key="nf">${M.icon('mdi:heat-pump-outline', 26)}<b>Fant ingen NIBE-varmepumpe</b><span>Støtter NIBE S- og F-serien via integrasjonene NIBE Heat Pump eller myUplink. Legg til integrasjonen, så dukker den opp her automatisk.</span><button class="vs press" data-act="customize" data-section="entiteter">Velg entitet</button></div>`);
      if (c.kpi !== false) parts.push(this._kpi());
      const V = visBtns(h, c);
      if (V.length) parts.push(this._btns(V));
      const T = visTabs(h, c), tab = this.tab;
      parts.push(this._tabRow(T, tab));
      if (!tab) parts.push(`<div class="nf" data-key="nf-tabs">${M.icon('mdi:eye-off', 22)}<b>Alle fanene er skjult</b><button class="vs press" data-act="customize" data-section="faner">Tilpass</button></div>`);
      else {
        let body = '';
        try { body = this['_' + tab](); } catch (e) { console.error('[ki-msh] varmepumpe', tab, e); body = '<div class="nf">Kunne ikke laste denne delen</div>'; }
        parts.push(`<div class="pane" data-key="pane-${tab}">${body}</div>`);
      }
      if (c.diag !== false) parts.push(this._acc('diag', 'Diagnostikk', 'mdi:stethoscope', ROLES.filter((r) => r[2] === 'diag').map((r) => r[0]), true));
      return `<div class="wrap ${c.anim === false ? 'noanim' : ''}">${parts.join('')}</div>`;
    }

    // Toppkort (v3: 176 px, gradient 165°, pumpe 170×150 nede til høyre)
    _top() {
      const c = this.config, anim = c.anim !== false, run = this._running(), fan = this._fanDur(), fill = this._vvFill(), ch = this._charging();
      const pw = kW(this._S('power')), freq = this._N('freq'), ute = this._N('ute'), kr = this._S('cost_day'), vv = this._N('vv'), tur = this._N('bt2');
      const pwId = this._e('power');
      const chip = ch ? ['mdi:water-boiler', 'Varmtvann'] : run ? ['mdi:heat-wave', 'Varme'] : freq != null || okS(this._S('status')) ? ['mdi:sleep', 'Hviler'] : ['mdi:heat-wave', '–'];
      const flow = anim && run;
      const fanA = anim && fan ? `spin ${fan}s linear infinite` : 'none';
      const pipe = (dir) => (flow ? `${dir} 1.2s linear infinite` : 'none');
      const heat = [0, 1, 2].map((i) => `<span class="hr" style="right:${10 + i * 13}px;animation:${flow ? `rise 2.4s ease-in ${i * 0.6}s infinite` : 'none'};${flow ? '' : 'opacity:0'}"></span>`).join('');
      const krTxt = okS(kr) && numS(kr) != null ? M.nf(numS(kr), 2) + ' kr' : '– kr';
      return `<section class="top" data-key="top" data-theme="dark" data-ki-island aria-label="Varmepumpe">
        <div class="unit" aria-hidden="true">
          <div class="cab">
            <div class="fanc"><span class="fan" style="animation:${fanA}">${M.icon('mdi:fan', 30)}</span></div>
            <span class="hz">${freq == null ? '– Hz' : esc(M.nf(freq, 0)) + ' Hz'}</span>
            <div class="tank"><div class="fill" style="height:${fill ? (fill.f * 100).toFixed(0) : 0}%"></div><span>${vv == null ? '–' : Math.round(vv) + '°'}</span></div>
          </div>
          <div class="ph" style="animation:${pipe('flow')}"></div><div class="phv" style="animation:${pipe('flowv')}"></div>
          <div class="pc" style="animation:${flow ? 'flow 1.2s linear infinite reverse' : 'none'}"></div><div class="pcv"></div>
          <div class="fins"><span></span><span></span><span></span><span></span><span></span></div>
          ${heat}
          <span class="sup">${tur == null ? '–' : Math.round(tur) + '°'}</span>
        </div>
        <div class="ttl"><span class="tn">${esc(c.name || 'Varmepumpe')}</span><span class="chip">${M.icon(chip[0], 14)}${esc(chip[1])}</span></div>
        <div class="tbt"><span class="kwr ${anim && pw != null && pw > 0 ? 'puls' : ''}" ${pwId ? `data-act="more" data-id="${esc(pwId)}" data-ent="${esc(pwId)}"` : 'data-act="customize" data-section="entiteter"'}><span class="kw num">${pw == null ? '–' : esc(M.nf(pw, 2))}</span><span class="kwu">kW</span></span>
          <span class="ts">Ute ${ute == null ? '–' : esc(M.nf(ute, 1)) + '°'} · ${esc(krTxt)}</span></div>
      </section>`;
    }
    // 3 KPI-kort (v3: #3d3d3d r22, ikon 15 i farge, verdi 24/300, enhet 12, undertekst 11)
    _kpi() {
      const run = this._running(), ch = this._charging(), anim = this.config.anim !== false;
      const ute = this._N('ute'), snitt = this._N('ute_snitt'), f = this._N('freq'), inne = this._N('inne'), vv = this._N('vv');
      const lad = this._N('bt6') != null ? this._N('bt6') : this._N('vv_ladetemp');
      const card = (k, icon, col, label, v, u, sub, icls) => {
        const id = this._e(k);
        return `<button class="kp" ${id ? `data-act="more" data-id="${esc(id)}" data-ent="${esc(id)}"` : 'data-act="customize" data-section="entiteter"'}>
          <span class="kl"><span class="ki ${anim ? icls || '' : ''}" style="color:${col}">${M.icon(icon, 15)}</span><span class="ell">${label}</span></span>
          <span class="kvr"><span class="kv num">${v}</span><span class="ku">${v === '–' ? '' : u}</span></span>
          <span class="ks ${id ? '' : 'pk'}">${id ? sub : 'Velg entitet'}</span></button>`;
      };
      return `<div class="kpis" data-key="kpis">
        ${card('ute', 'mdi:thermometer', '#d6d6d6', 'Ute', fmtN(ute, 1), '°', snitt != null ? `snitt ${M.nf(snitt, 1)}°` : 'BT1')}
        ${card('freq', 'mdi:sine-wave', ORANGE, 'Kompressor', fmtN(f, 0), 'Hz', inne != null ? `inne ${M.nf(inne, 1)}°` : run ? 'går' : 'står', run ? 'pust' : '')}
        ${card('vv', 'mdi:water-boiler', BLUE, 'Varmtvann', fmtN(vv, 1), '°', lad != null ? `lading ${M.nf(lad, 1)}°` : 'BT7', ch ? 'dupp' : '')}
      </div>`;
    }
    // Hurtigknapper (v3: 72 px r22; aktiv = rosa + skygge, ellers kontur 1,5 px #4a4a4a)
    _btns(V) {
      const c = this.config, lbl = btnStyle(c) !== 'icon', h = this.hass;
      const b = (k) => {
        const label = btnName(c, k), id = btnEnt(h, c, k), s = id ? this.s(id) : null;
        let icon = BK[k][2], act = false, cls = '';
        if (k === 'boost') act = this._boostOn();
        if (k === 'vent') { act = on(s); if (act) cls = 'spin-i'; }
        if (k === 'pump') { act = on(s); if (act) cls = 'vib'; }
        if (k === 'eco') act = okS(s) && !isNormal(s.state);
        if (k === 'alarm') { const a = this._alarmOn(); if (a) cls = 'red rist'; icon = a ? 'mdi:alert-circle' : 'mdi:alert-circle-outline'; }
        if (k === 'wifi') { const off = this._wifiOff(); act = !off; if (off) { cls = 'red blink'; icon = 'mdi:wifi-off'; } }
        return `<button class="qb press ${act ? 'on' : ''} ${cls}" data-act="btn" data-v="${k}" data-ent="${esc(id)}" title="${esc(label)}" aria-label="${esc(label)}" ${['boost', 'vent', 'eco'].includes(k) ? `aria-pressed="${act}"` : ''}>${M.icon(icon, 24)}${lbl ? `<span class="ql">${esc(label)}</span>` : ''}</button>`;
      };
      return `<div class="qbs" data-key="qbs" style="grid-template-columns:repeat(${Math.max(1, V.length)},minmax(0,1fr))">${V.map(b).join('')}</div>`;
    }
    // Fanelinje + tannhjul (v3: #3a3a3a r26, faner 44 px r22 13/500, tannhjul 52 px)
    _tabRow(V, tab) {
      const c = this.config, st = tabStyle(c);
      const btn = (k) => {
        const o = k === tab, label = tabName(c, k);
        return `<button class="tb ${o ? 'on' : ''}" role="tab" aria-selected="${o}" data-act="tab" data-v="${k}" data-haptic="selection" title="${esc(label)}" aria-label="${esc(label)}">${st !== 'name' ? M.icon(TK[k][2], 20) : ''}${st !== 'icon' ? `<span>${esc(label)}</span>` : ''}</button>`;
      };
      return `<div class="trow" data-key="trow"${M.tabH && M.tabH.style(c) ? ` style="${M.tabH.style(c)}"` : ''}><div class="tabs" role="tablist" data-glass-drag="x">${V.map(btn).join('')}</div>
        <button class="gear press" data-act="customize" title="Tilpass varmepumpe" aria-label="Tilpass varmepumpe">${M.icon('mdi:cog', 22)}</button></div>`;
    }
    // Rad (v3 ovRows): ikon · navn/undertekst · stort tall + enhet. Mangler → «–» + «Velg entitet».
    _row(k, o) {
      o = o || {};
      const r = RK[k], id = this._e(k), s = id ? this.s(id) : null, label = o.label || r[1];
      const ic = `<span class="ri" style="color:${o.col || 'var(--ki-text-1, #d6d6d6)'}">${M.icon(o.icon || r[6], 22)}</span>`;
      if (!s) return `<button class="rw miss" data-key="r-${k}" data-act="customize" data-section="entiteter">${ic}<span class="rc"><span class="rl">${esc(label)}</span><span class="rs pk">Velg entitet</span></span><span class="rvw"><span class="rv">–</span></span></button>`;
      const [v, u] = o.val != null ? [o.val, o.unit || ''] : vu(s);
      return `<button class="rw" data-key="r-${k}" data-act="more" data-id="${esc(id)}" data-ent="${esc(id)}">${ic}<span class="rc"><span class="rl">${esc(label)}</span>${o.sub ? `<span class="rs">${esc(o.sub)}</span>` : ''}</span><span class="rvw"><span class="rv num ${o.vcls || ''}">${esc(v)}</span>${u ? `<span class="ru">${esc(u)}</span>` : ''}</span></button>`;
    }
    // Liten rad (v3 dhwRows): ikon 22 #d6d6d6 · navn 15 · verdi 15 #d6d6d6
    _srow(k, label, icon) {
      const id = this._e(k), s = id ? this.s(id) : null;
      if (!s) return `<button class="sr miss" data-key="s-${k}" data-act="customize" data-section="entiteter">${M.icon(icon || RK[k][6], 22, 'color:var(--ki-text-1, #d6d6d6)')}<span class="sl">${esc(label || RK[k][1])}</span><span class="sv2"><span class="pk">Velg entitet</span> –</span></button>`;
      const [v, u] = vu(s);
      return `<button class="sr" data-key="s-${k}" data-act="more" data-id="${esc(id)}" data-ent="${esc(id)}">${M.icon(icon || RK[k][6], 22, 'color:var(--ki-text-1, #d6d6d6)')}<span class="sl">${esc(label || RK[k][1])}</span><span class="sv2 num">${esc(v)}${u ? (u === '°' ? '°C' : ' ' + esc(u)) : ''}</span></button>`;
    }
    // Akkordeon (stil som v3 «Diagnostikk»: knapp 52 px r26 #3d3d3d + flate #3d3d3d r24). grid = rutenett 2 kolonner.
    _acc(key, title, icon, keys, grid) {
      const open = !!(this.ui.acc || {})[key];
      const firstK = { diag: 'het', cost: 'cost_day', sys: 'komp_status', strom: 'power' }[key];
      const fs = firstK ? this._S(firstK) : null;
      const fv = fs && okS(fs) ? vu(fs) : null;
      const sub = fv ? `${{ diag: 'Hetgass', cost: 'I dag', sys: 'Kompressor', strom: 'Effekt' }[key]} ${fv[0]}${fv[1] === '°' ? '°' : fv[1] ? ' ' + fv[1] : ''}` : `${keys.filter((k) => this._e(k)).length} av ${keys.length}`;
      const head = `<button class="ah" data-act="acc" data-v="${key}" aria-expanded="${open}">${M.icon(icon, 20, 'color:var(--ki-text-1, #d6d6d6)')}<span class="at">${esc(title)}</span><span class="as">${esc(sub)}</span>${M.icon('mdi:chevron-down', 22, `color:var(--ki-text-mid, #a8a8a8);transition:transform .25s;${open ? 'transform:rotate(180deg)' : ''}`)}</button>`;
      if (!open) return `<div class="acc" data-key="acc-${key}">${head}</div>`;
      const body = grid
        ? `<div class="ab grid">${keys.map((k, i) => { const id = this._e(k), s = id ? this.s(id) : null, [v, u] = s ? vu(s) : ['–', '']; return `<button class="dr2${i > 1 ? ' bt' : ''}" ${id ? `data-act="more" data-id="${esc(id)}" data-ent="${esc(id)}"` : 'data-act="customize" data-section="entiteter"'}><span class="dl">${esc(RK[k][1])}</span><span class="dv num">${esc(v)}${u ? (u === '°' ? ' °C' : ' ' + esc(u)) : ''}</span></button>`; }).join('')}</div>`
        : `<div class="ab lst">${keys.map((k) => this._row(k)).join('')}</div>`;
      return `<div class="acc open" data-key="acc-${key}">${head}${body}</div>`;
    }
    // Graf (v3): serier [{k, col}], areal under første. Scrub: pekeren (touch-action:none + stopPropagation, fallgruve 2).
    _gdata(g, keys, hours, hist) {
      const S2 = keys.map((k) => { const id = this._e(k); return id && hist && hist[id] ? M.sample(hist[id], GN, hours) : []; });
      const all = S2.flat();
      let lo = all.length ? Math.min(...all) : 0, hi = all.length ? Math.max(...all) : 1;
      const pad = Math.max(0.5, (hi - lo) * 0.12); lo -= pad; hi += pad;
      const sc = this._scrub && this._scrub.g === g ? this._scrub.i : null;
      const at = (j) => (sc != null && S2[j].length ? S2[j][Math.min(S2[j].length - 1, sc)] : null);
      const tlab = sc == null ? null : (() => { const t = hours - (sc / (GN - 1)) * hours; return t < 0.5 ? 'nå' : hours > 48 ? `−${M.nf(t / 24, t < 24 ? 1 : 0)} d` : `−${M.nf(t, t < 10 ? 1 : 0)} t`; })();
      return { S2, lo, hi, sc, at, tlab, has: all.length > 0 };
    }
    _svg(g, D, cols, fill) {
      const P = gpaths(D.S2, D.lo, D.hi);
      const lines = P.map((p, j) => (p ? `<path d="${p}" fill="none" stroke="${cols[j]}" stroke-width="2" vector-effect="non-scaling-stroke"></path>` : '')).reverse().join('');
      const ar = P[0] ? `<path d="${area(P[0])}" fill="${fill}"></path>` : '';
      const flat = D.has ? '' : '<path d="M0,40 L300,40" fill="none" style="stroke:var(--ki-ctrl, #545454)" stroke-width="2" stroke-dasharray="4 4" vector-effect="non-scaling-stroke"></path>';
      const x = D.sc != null ? ((D.sc / (GN - 1)) * 300).toFixed(1) : null;
      const mk = x != null ? `<path d="M${x},0 L${x},70" style="stroke:var(--ki-text-2, #fafafa)" stroke-opacity=".6" stroke-dasharray="3 3" stroke-width="1" vector-effect="non-scaling-stroke"></path>` : '';
      return `<svg class="gs" data-g="${g}" data-n="${GN}" viewBox="0 0 300 70" preserveAspectRatio="none" aria-label="Graf">${ar}${lines}${flat}${mk}</svg>`;
    }
    _cv(v) { return v == null ? '–' : M.nf(v, 1); }

    /* ---------------------------------------------------------- faner */
    _info() {
      const c = this.config, f = this._N('freq'), inne = this._N('inne'), vv = this._N('vv'), run = this._running();
      const pill = (t) => `<span class="pl">${esc(t)}</span>`;
      const prosa = c.sentence === false ? '' : `<p class="prosa" data-key="prosa">${run ? `Kompressoren går på ${pill(f == null ? '– Hz' : M.nf(f, 0) + ' Hz')}` : 'Kompressoren står stille'} og holder inne på ${pill(inne == null ? '–' : M.nf(inne, 1) + '°')}. Varmtvannet er ${vv == null ? '–' : esc(M.nf(vv, 1)) + ' °C'}${this._charging() ? ' og lades nå' : ''}.</p>`;
      const pw = kW(this._S('power')), t2 = this._N('bt2'), t3 = this._N('bt3'), mal = this._N('beregnet'), ek = this._N('elkolbe');
      const rows = [
        this._row('energy', { icon: 'mdi:lightning-bolt', col: GREEN, sub: pw != null ? `Nå ${M.nf(pw, 2)} kW` : '' }),
        this._row('cost_day', { icon: 'mdi:cash', sub: 'Etter spotpris' }),
        this._row('bt2', { sub: mal != null ? `Mål ${M.nf(mal, 1)}°` : '' }),
        this._row('bt3', { sub: t2 != null && t3 != null ? `ΔT ${M.nf(t2 - t3, 1)}°` : '' }),
        this._row('bt50'),
        this._row('elkolbe', { col: ek != null && ek > 0 ? 'var(--yellow,#f2d573)' : '#d6d6d6', vcls: ek != null && ek > 0 ? 'gul' : '', sub: ek != null && ek > 0 ? 'Tilskudd er på' : '' }),
      ].join('');
      const D = this._gdata('tr', ['bt2', 'bt3'], 168, this._h7);
      const tv = D.sc != null ? D.at(0) : t2, rv = D.sc != null ? D.at(1) : t3;
      const graf = `<div class="gc" data-key="g-tr"><div class="gh"><span class="gt"><span class="gl">Tur (BT2)</span><span class="gvr"><span class="gv num">${this._cv(tv)}</span><span class="gu">°C</span></span></span><span class="gsub">${D.tlab || 'Siste 7 d'}</span></div>${this._svg('tr', D, ['#f0a36b', BLUE], 'rgba(240,163,107,.14)')}</div>
        <div class="leg"><span><i style="background:#f0a36b"></i>Tur BT2</span><span><i style="background:${BLUE}"></i>Retur BT3 ${this._cv(rv)}°</span>${this._h7 ? '' : '<span class="lr">Henter …</span>'}</div>`;
      return `${prosa}<div class="lst" data-key="info-rows">${rows}</div>${graf}
        ${this._acc('cost', 'Kostnad', 'mdi:cash', ['cost_hour', 'cost_day', 'cost_month', 'cost_year'])}
        ${this._acc('sys', 'Systemdrift', 'mdi:cog-outline', ['gm', 'drift', 'starter', 'avriming', 'tidsfaktor', 'komp_status'])}
        ${this._acc('strom', 'Strøm', 'mdi:flash', ['be1', 'be2', 'be3', 'power', 'add_power'])}`;
    }
    _seg(k, sub) {
      const id = this._e(k), s = id ? this.s(id) : null;
      if (!s) return `<div class="lst">${this._row(k)}</div>`;
      const O = s.attributes.options || [];
      return `<div class="seg" role="radiogroup" data-key="seg-${k}">${O.map((o) => `<button class="sg ${o === s.state ? 'on' : ''}" role="radio" aria-checked="${o === s.state}" data-act="opt" data-id="${esc(id)}" data-o="${esc(o)}" data-haptic="selection">${esc(optNb(o))}${sub && sub[optNb(o)] ? ' · ' + esc(sub[optNb(o)]) : ''}</button>`).join('') || `<span class="muted">${esc(s.state)}</span>`}</div>`;
    }
    _stepper(k, label, sub, show) {
      const id = this._e(k), s = id ? this.s(id) : null;
      const p = s && this._pend && this._pend[id], v = p != null ? p : s ? numS(s) : null;
      const A = (s && s.attributes) || {}, mn = A.min != null ? Number(A.min) : null, mx = A.max != null ? Number(A.max) : null;
      const btn = (d, ic) => `<button class="pm press" data-act="step" data-id="${esc(id || '')}" data-d="${d}" aria-label="${esc(label)} ${d < 0 ? 'ned' : 'opp'}" ${!s || (v != null && ((d < 0 && mn != null && v <= mn) || (d > 0 && mx != null && v >= mx))) ? 'disabled' : ''}>${M.icon(ic, 22)}</button>`;
      return `<div class="rw stp" data-key="stp-${k}"><button class="rc tl" ${s ? `data-act="more" data-id="${esc(id)}" data-ent="${esc(id)}"` : 'data-act="customize" data-section="entiteter"'}><span class="rl">${esc(label)}</span><span class="rs ${s ? '' : 'pk'}">${s ? esc(sub) : 'Velg entitet'}</span></button>
        ${btn(-1, 'mdi:minus')}<span class="sv num ${p != null ? 'pend' : ''}">${v == null ? '–' : esc(show(v))}</span>${btn(1, 'mdi:plus')}</div>`;
    }
    _varme() {
      const sm = this._S('smart'), smId = this._e('smart');
      const SMI = { Normal: 'mdi:home', Borte: 'mdi:walk', Ferie: 'mdi:airplane' };
      const smart = sm ? `<div class="chips" data-key="smart">${(sm.attributes.options || []).map((o) => { const l = optNb(o), a = o === sm.state; return `<button class="ch ${a ? 'on' : ''}" data-act="opt" data-id="${esc(smId)}" data-o="${esc(o)}" data-haptic="selection" aria-pressed="${a}">${M.icon(SMI[l] || 'mdi:circle-medium', 18)}${esc(l)}</button>`; }).join('')}</div>` : `<div class="lst">${this._row('smart')}</div>`;
      const kv = this._N('kurve'), fv = this._N('forskyvning'), mal = this._N('beregnet'), gm = this._N('start_gm');
      const deg1 = (v) => M.nf(v, 1) + '°';
      return `<span class="cap">Driftsstilling</span>${this._seg('driftsstilling')}
        <span class="cap">Smart Home-modus</span>${smart}
        <div class="caprow"><span>Varmekurve</span><span>${kv == null ? '–' : `kurve ${M.nf(kv, 0)}, ${fv == null ? '–' : M.nf(fv, 0)}`}</span></div>
        <div class="lst" data-key="curve">${this._stepper('kurve', 'Varmekurve', 'Brattere gir varmere tur ved kulde', (v) => M.nf(v, 0))}${this._stepper('forskyvning', 'Forskyvning', 'Hever eller senker hele kurven', signed)}${this._stepper('onsket', 'Ønsket', 'Innetemperatur', deg1)}${this._stepper('stopp', 'Stopp av varme', 'Ved utetemperatur', deg1)}</div>
        <span class="calc">Beregnet turtemperatur ${mal == null ? '–' : M.nf(mal, 1)} °C · start GM ${gm == null ? '–' : M.nf(gm, 0)}</span>`;
    }
    _vv() {
      const fill = this._vvFill(), sw = this._e('boost'), sel = this._e('boost_sel'), bOn = this._boostOn(), hasB = !!((sw && this.s(sw)) || (sel && this.s(sel)));
      const D = this._gdata('vv', ['vv', 'bt6'], 24, this._h24);
      const top = D.sc != null ? D.at(0) : this._N('vv'), b6 = D.sc != null ? D.at(1) : this._N('bt6');
      const leg = this._S('legionella'), upd = this._S('fastvare');
      const W = [];
      if (this._alarmOn()) W.push(['red', 'mdi:bell-alert', 'Varsel fra varmepumpa', this._e('alarm')]);
      if (upd && upd.state === 'on') W.push(['orange', 'mdi:update', `Ny fastvare ${upd.attributes.latest_version || ''}`.trim(), upd.entity_id]);
      if (this._wifiOff()) W.push(['red', 'mdi:wifi-off', 'Varmepumpa er frakoblet', this._e('wifi')]);
      if (okS(leg) && Date.parse(leg.state) && Date.parse(leg.state) - Date.now() < 86400000 * 2) W.push(['blue', 'mdi:virus', 'Legionellaheving ' + omTid(leg.state), leg.entity_id]);
      const extra = ['mengde', 'andel', 'vv_tid', 'vv_modus', 'fastvare'].filter((k) => this._e(k)).map((k) => this._srow(k)).join('');
      return `<div class="gc" data-key="g-vv"><div class="gh"><span class="gt"><span class="gl">Varmtvann topp (BT7)</span><span class="gvr"><span class="gv big num">${this._cv(top)}</span><span class="gu">°C</span></span></span><span class="gsub">${D.tlab || 'Siste 24 t'}</span></div>
          ${this._svg('vv', D, ['#f0a36b', BLUE], 'rgba(240,163,107,.14)')}<div class="fb"><div style="width:${fill ? (fill.f * 100).toFixed(0) : 0}%"></div></div></div>
        <div class="leg"><span><i style="background:#f0a36b"></i>Topp BT7</span><span><i style="background:${BLUE}"></i>Tilførsel BT6 ${this._cv(b6)}°</span><span class="lr">Fylt ${fill ? M.nf(fill.f * 100, 0) : '–'} %</span></div>
        <span class="cap">Varmtvannsbehov</span>${this._seg('behov')}
        <button class="boost press ${bOn ? 'on' : ''}" data-act="boostvv" ${hasB ? `data-ent="${esc(sw || sel)}"` : ''} aria-pressed="${bOn}">${M.icon(bOn ? 'mdi:stop' : 'mdi:lightning-bolt', 22)}${hasB ? (bOn ? 'Stopp varmtvann boost' : 'Varmtvann boost') : 'Varmtvann boost – velg entitet'}</button>
        <div class="lst sm" data-key="vv-rows">${this._srow('vv_temp', 'Varmtvann', 'mdi:water')}${this._srow('ladeverdi', 'Lading', 'mdi:lightning-bolt')}${this._srow('legionella', 'Neste legionellaheving', 'mdi:virus')}${extra}</div>
        ${W.length ? `<div class="varsel">${W.map(([col, ic, t, id]) => `<button class="vl ${col}" ${id ? `data-act="more" data-id="${esc(id)}"` : ''}>${M.icon(ic, 18)}<span class="ell">${esc(t)}</span></button>`).join('')}</div>` : ''}`;
    }
    _luft() {
      const D = this._gdata('luft', ['bt20', 'bt21'], 24, this._h24);
      const a = D.sc != null ? D.at(0) : this._N('bt20'), b = D.sc != null ? D.at(1) : this._N('bt21'), v = this._N('vifte');
      const col = (k, label, val, extra) => { const id = this._e(k); return `<button class="lc" ${id ? `data-act="more" data-id="${esc(id)}" data-ent="${esc(id)}"` : 'data-act="customize" data-section="entiteter"'}><span class="gl">${label}</span><span class="gvr"><span class="gv mid num">${this._cv(val)}</span><span class="gu">°C${extra || ''}</span></span></button>`; };
      const sw = (k, label) => {
        const id = this._e(k), s = id ? this.s(id) : null;
        if (!s) return this._row(k, { label });
        const o = on(s);
        return `<div class="rw" data-key="sw-${k}">${M.icon(RK[k][6], 22, 'color:var(--ki-text-1, #d6d6d6)')}<button class="rc tl" data-act="more" data-id="${esc(id)}" data-ent="${esc(id)}"><span class="rl">${esc(label)}</span><span class="rs">${o ? 'På' : 'Av'}</span></button><button class="sw ${o ? 'on' : ''}" role="switch" aria-checked="${o}" aria-label="${esc(label)}" data-act="toggle" data-id="${esc(id)}"><i></i></button></div>`;
      };
      const extra = ['bs1', 'viftemodus'].filter((k) => this._e(k)).map((k) => this._srow(k)).join('');
      const vid = this._e('vifte');
      return `<div class="gc" data-key="g-luft"><div class="two">${col('bt20', 'Avtrekk inn (BT20)', a)}${col('bt21', 'Avkast ut (BT21)', b, a != null && b != null ? ' · ' + signed(Number((b - a).toFixed(1))).replace('-', '−') + '°' : '')}</div>
          ${this._svg('luft', D, ['#f0a36b', BLUE], 'rgba(122,184,240,.12)')}</div>
        <div class="leg"><span><i style="background:#f0a36b"></i>Avtrekk</span><span><i style="background:${BLUE}"></i>Avkast</span><span class="lr">Siste 24 t</span></div>
        <button class="fanbox" data-key="fan" ${vid ? `data-act="more" data-id="${esc(vid)}" data-ent="${esc(vid)}"` : 'data-act="customize" data-section="entiteter"'}><span class="fbh"><span>Viftehastighet avtrekk</span><span class="fbv num">${v == null ? '–' : M.nf(v, 0)} %</span></span><span class="fbb"><span style="width:${v == null ? 0 : M.clamp(v, 0, 100)}%"></span></span></button>
        ${extra ? `<div class="lst sm">${extra}</div>` : ''}
        <div class="lst" data-key="air-sw">${sw('vent', 'Økt ventilasjon')}${sw('natt', 'Nattkjøling')}</div>`;
    }

    afterRender() {
      const Rt = this.shadowRoot;
      // Fiks 28.13: fanelinjen – hold 400 ms + dra = omorganiser (tabs), sideveis dra = Liquid Glass-valg
      if (M.tabRow) M.tabRow(this, Rt.querySelector('.trow>.tabs[role="tablist"]'), { active: () => this.tab, order: () => tabOrder(this.config), field: 'tabs' });
      // −/+ og graf-scrub: ikke la Bubble Card lukke/scrolle popupen (fallgruve 2)
      Rt.querySelectorAll('.pm').forEach((b) => {
        if (b.__vp) return; b.__vp = true;
        const stop = (e) => e.stopPropagation();
        b.addEventListener('pointerdown', stop); b.addEventListener('touchstart', stop, { passive: true }); b.addEventListener('touchmove', stop, { passive: true });
      });
      Rt.querySelectorAll('svg.gs[data-g]').forEach((svg) => {
        if (svg.__vp) return; svg.__vp = true;
        M.guardDrag(svg, 'none');
        const g = svg.dataset.g;
        const at = (e) => { const r = svg.getBoundingClientRect(); return Math.round(M.clamp((e.clientX - r.left) / (r.width || 1), 0, 1) * (GN - 1)); };
        let act = false;
        svg.addEventListener('pointerdown', (e) => { e.stopPropagation(); act = true; try { svg.setPointerCapture(e.pointerId); } catch (x) { /* */ } this._scrub = { g, i: at(e) }; M.haptic('selection'); this.update(); });
        svg.addEventListener('pointermove', (e) => { if (!act) return; e.stopPropagation(); const i = at(e); if (!this._scrub || this._scrub.i !== i) { this._scrub = { g, i }; this.update(); } });
        ['touchstart', 'touchmove'].forEach((t) => svg.addEventListener(t, (e) => e.stopPropagation(), { passive: true }));
        const end = () => { if (!act) return; act = false; setTimeout(() => { if (!act) { this._scrub = null; this.update(); } }, 1600); };
        svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end);
      });
      if (this.isOpen && !this._h24 && !this._loading) { this._loading = true; Promise.resolve(this._load()).finally(() => { this._loading = false; }); }
    }
    get styles() {
      return `
        :host{display:block;width:100%}
        .wrap{display:flex;flex-direction:column;gap:var(--msh-gap,10px);container-type:inline-size}
        .num{font-variant-numeric:tabular-nums}
        .ell{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .pk{color:var(--ki-pink-text, rgb(242 133 201))!important}
        /* v3 keyframes (portert direkte) */
        @keyframes fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes flow{from{background-position:0 0}to{background-position:24px 0}}
        @keyframes flowv{from{background-position:0 0}to{background-position:0 24px}}
        @keyframes rise{0%{opacity:0;transform:translateY(4px)}40%{opacity:.7}100%{opacity:0;transform:translateY(-14px)}}
        /* 26.20-animasjonene fra den gamle YAML-en */
        @keyframes vp-puls{0%,100%{opacity:1}50%{opacity:.6}}
        @keyframes vp-pust{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.18);opacity:.75}}
        @keyframes vp-dupp{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
        @keyframes vp-vib{0%,100%{transform:translateX(0)}25%{transform:translateX(-1px)}75%{transform:translateX(1px)}}
        @keyframes vp-rist{0%,55%,100%{transform:rotate(0)}10%{transform:rotate(-14deg)}20%{transform:rotate(12deg)}30%{transform:rotate(-9deg)}40%{transform:rotate(6deg)}}
        @keyframes vp-blink{50%{opacity:.35}}
        /* toppkort */
        .top{position:relative;height:176px;border-radius:28px;overflow:hidden;background:linear-gradient(165deg,#2a1d17 0%,#3a2418 55%,#5a3019 100%);flex:none}
        .unit{position:absolute;right:18px;bottom:0;width:170px;height:150px}
        .cab{position:absolute;left:0;bottom:0;width:62px;height:128px;border-radius:10px 10px 0 0;background:#e9e4de;box-shadow:0 6px 20px rgba(0,0,0,.35)} /* ki-hex-ok: mørk øy */
        .fanc{position:absolute;left:11px;top:12px;width:40px;height:40px;border-radius:50%;background:#2d2d2d;display:flex;align-items:center;justify-content:center}
        .fan{display:inline-flex;color:#e9e4de;line-height:0}
        .hz{position:absolute;left:14px;top:60px;width:34px;height:14px;border-radius:5px;background:#f0a36b;color:#2b1608;font-size:9px;font-weight:600;display:flex;align-items:center;justify-content:center;white-space:nowrap}
        .tank{position:absolute;left:8px;right:8px;bottom:10px;height:38px;border-radius:7px;overflow:hidden;background:#3a3a3a} /* ki-hex-ok: mørk øy */
        .tank .fill{position:absolute;left:0;right:0;bottom:0;background:linear-gradient(180deg,#f7b07c,#e3743f);transition:height .6s}
        .tank span{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:600;color:#fff}
        .ph{position:absolute;left:62px;right:16px;top:30px;height:3px;background:repeating-linear-gradient(90deg,#f08a5d 0 8px,transparent 8px 12px)}
        .phv{position:absolute;right:16px;top:30px;width:3px;height:26px;background:repeating-linear-gradient(180deg,#f08a5d 0 8px,transparent 8px 12px)}
        .pc{position:absolute;left:62px;right:2px;bottom:8px;height:3px;background:repeating-linear-gradient(90deg,#6aa9e8 0 8px,transparent 8px 12px)}
        .pcv{position:absolute;right:2px;bottom:8px;width:3px;height:18px;background:#6aa9e8}
        .fins{position:absolute;right:6px;bottom:18px;display:flex;gap:4px}
        .fins span{width:9px;height:62px;border-radius:4px;background:#e8805a}
        .hr{position:absolute;top:52px;width:3px;height:12px;border-radius:2px;border-left:2px solid #f5b58a;box-sizing:border-box}
        .sup{position:absolute;right:30px;top:4px;font-size:10px;color:#f5b58a}
        .ttl{position:absolute;left:18px;top:16px;display:flex;flex-direction:column;gap:6px;align-items:flex-start;max-width:calc(100% - 210px)}
        .tn{font-size:13px;color:#e0d4cc;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .chip{height:24px;padding:0 10px 0 8px;border-radius:12px;display:flex;align-items:center;gap:5px;font-size:12px;font-weight:500;background:rgba(240,138,93,.3);white-space:nowrap}
        .tbt{position:absolute;left:18px;bottom:16px;display:flex;flex-direction:column;gap:2px;max-width:calc(100% - 210px)}
        .kwr{display:flex;align-items:baseline;gap:4px;cursor:pointer}
        .kw{font-size:40px;font-weight:300;line-height:1}
        .kwu{font-size:14px;color:#e0d4cc}
        .kwr.puls .kw{animation:vp-puls 2.6s ease-in-out infinite}
        .ts{font-size:12px;color:#cdbfb5;white-space:nowrap}
        /* KPI */
        .kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
        .kp{background:var(--ki-surface, #3d3d3d);border-radius:22px;padding:12px 14px;display:flex;flex-direction:column;gap:6px;min-width:0;text-align:left}
        .kl{display:flex;align-items:center;gap:5px;font-size:12px;color:var(--ki-text-mid, #a8a8a8);min-width:0}
        .ki{display:inline-flex;flex:none}
        .ki.pust{animation:vp-pust 2.4s ease-in-out infinite}.ki.dupp{animation:vp-dupp 2.4s ease-in-out infinite}
        .kvr{display:flex;align-items:baseline;gap:2px}
        .kv{font-size:24px;font-weight:300}.ku{font-size:12px;color:var(--ki-text-mid, #a8a8a8)}
        .ks{font-size:11px;color:var(--ki-text-3, #8a8a8a);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        /* hurtigknapper */
        .qbs{display:grid;gap:8px}
        .qb{height:72px;min-width:0;border-radius:22px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;transition:background .3s,color .3s;background:transparent;color:#bdbdbd;box-shadow:inset 0 0 0 1.5px #4a4a4a}
        .qb.on{background:${PINK};color:${INK};box-shadow:0 4px 14px rgba(0,0,0,.25)}
        .qb.red{background:var(--red,#f28073);color:#2c1411;box-shadow:0 4px 14px rgba(0,0,0,.25)}
        .ql{font-size:11px;font-weight:500;max-width:100%;padding:0 4px;box-sizing:border-box;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .qb.spin-i ha-icon{animation:spin 1.2s linear infinite}
        .qb.vib ha-icon{animation:vp-vib .18s linear infinite}
        .qb.rist ha-icon{animation:vp-rist 1.1s ease-in-out infinite;transform-origin:50% 10%}
        .qb.blink{animation:vp-blink 1.2s ease-in-out infinite}
        /* fanelinje */
        .trow{display:flex;align-items:center;gap:8px;margin:2px 0;min-width:0}
        .tabs{flex:1;min-width:0;display:grid;grid-auto-flow:column;grid-auto-columns:minmax(max-content,1fr);gap:0;padding:4px;border-radius:calc(${TV('th', 44)} / 2 + 4px);overflow-x:auto;scrollbar-width:none;background:var(--ki-surface, #3a3a3a);box-shadow:inset 0 0 0 1px rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.05*var(--ki-wa-k,1)),var(--ki-wa-max,1)));position:relative;touch-action:pan-y}
        .tabs::-webkit-scrollbar{display:none}
        .tb{height:${TV('th', 44)};min-width:0;border-radius:calc(${TV('th', 44)} / 2);display:flex;align-items:center;justify-content:center;gap:6px;padding:0 ${TV('tp', 10)};font-size:${TV('tf', 13)};font-weight:500;white-space:nowrap;background:transparent;color:var(--ki-text-2, #afafaf);transition:background .35s,color .35s}
        .tb.on{background:${PINK};color:${INK}}
        .tb ha-icon{--mdc-icon-size:${TV('ti', 20)} !important;width:${TV('ti', 20)} !important;height:${TV('ti', 20)} !important}
        .gear{width:calc(${TV('th', 44)} + 8px);height:calc(${TV('th', 44)} + 8px);border-radius:calc(${TV('th', 44)} / 2 + 4px);flex:none;background:var(--ki-surface, #3a3a3a);box-shadow:inset 0 0 0 1px rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.05*var(--ki-wa-k,1)),var(--ki-wa-max,1)));display:grid;place-items:center}
        .gear:active{transform:scale(.94)}
        /* faneinnhold */
        .pane{display:flex;flex-direction:column;gap:10px;animation:fade .3s ease}
        .prosa{margin:6px 4px 2px;font-size:19px;line-height:1.75;text-wrap:pretty}
        .pl{background:var(--ki-pill-bg, #fafafa);color:var(--ki-pill-fg, #141414);border-radius:999px;padding:2px 10px;font-weight:500;white-space:nowrap}
        .lst{background:var(--ki-surface, #3d3d3d);border-radius:24px;padding:4px 16px}
        .rw{display:flex;align-items:center;gap:12px;min-height:58px;width:100%;text-align:left}
        .lst>.rw+.rw,.lst>.sr+.sr,.lst>.rw+.sr,.lst>.sr+.rw{border-top:1px solid rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.07*var(--ki-wa-k,1)),var(--ki-wa-max,1)))}
        .ri{display:inline-flex;flex:none}
        .rc{flex:1;min-width:0;display:flex;flex-direction:column;text-align:left}
        .rl{font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .rs{font-size:12px;color:var(--ki-text-mid, #a8a8a8);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .rvw{display:flex;align-items:baseline;gap:4px;flex:none;max-width:50%}
        .rv{font-size:24px;font-weight:300;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rv.gul{color:var(--ki-yellow-text, var(--yellow,#f2d573))}
        .ru{font-size:12px;color:var(--ki-text-mid, #a8a8a8)}
        .sr{display:flex;align-items:center;gap:12px;min-height:58px;width:100%;text-align:left}
        .sl{flex:1;min-width:0;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .sv2{font-size:15px;color:var(--ki-text-1, #d6d6d6);flex:none;max-width:55%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .cap{font-size:13px;color:var(--ki-text-mid, #a8a8a8);padding:6px 6px 0}
        .caprow{display:flex;justify-content:space-between;align-items:baseline;padding:10px 6px 0;font-size:13px;color:var(--ki-text-mid, #a8a8a8)}.caprow span+span{font-size:12px}
        .calc{font-size:12px;color:var(--ki-text-mid, #a8a8a8);padding:0 6px}
        .seg{display:flex;gap:2px;padding:2px;border-radius:999px;background:var(--ki-surface, #3d3d3d)}
        .sg{flex:1;min-width:0;height:38px;border-radius:999px;font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 6px;background:transparent;color:rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.72*var(--ki-wa-k,1)),var(--ki-wa-max,1)));transition:background .3s,color .3s}
        .sg.on{background:${PINK};color:${INK}}
        .chips{display:flex;gap:6px;flex-wrap:wrap}
        .ch{height:36px;padding:0 14px 0 10px;border-radius:999px;font-size:13px;font-weight:500;display:flex;align-items:center;gap:6px;background:var(--ki-surface, #3d3d3d);color:var(--ki-text, #fafafa);transition:background .3s,color .3s}
        .ch.on{background:${PINK};color:${INK}}
        .stp .pm{width:40px;height:40px;border-radius:50%;background:var(--ki-surface-2, #4b4b4b);display:flex;align-items:center;justify-content:center;flex:none;touch-action:manipulation}
        .stp .pm:active{background:#555}.stp .pm[disabled]{opacity:.35;cursor:default}
        .sv{min-width:44px;text-align:center;font-size:20px;font-weight:300;flex:none}.sv.pend{color:var(--ki-pink-text, rgb(242 133 201))}
        .tl{text-align:left}
        .gc{position:relative;border-radius:26px;overflow:hidden;background:var(--ki-surface, #3d3d3d);padding:14px 16px 0}
        .gh{display:flex;justify-content:space-between;align-items:flex-start}
        .gt{display:flex;flex-direction:column;gap:2px}
        .gl{font-size:13px;color:var(--ki-text-1, #d6d6d6)}
        .gvr{display:flex;align-items:baseline;gap:3px}
        .gv{font-size:34px;font-weight:300;line-height:1.1}.gv.big{font-size:40px}.gv.mid{font-size:34px}
        .gu{font-size:14px;color:var(--ki-text-mid, #a8a8a8)}.two .gu{font-size:13px}
        .gsub{font-size:12px;color:var(--ki-text-mid, #a8a8a8);padding-top:4px}
        .gs{display:block;width:calc(100% + 32px);margin:8px -16px 0;height:80px;touch-action:none;cursor:crosshair}
        .fb{position:absolute;left:0;right:0;bottom:0;height:6px;background:#2a2a2a}.fb div{height:100%;background:#f0a36b;transition:width .5s}
        .two{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
        .lc{display:flex;flex-direction:column;gap:2px;text-align:left;min-width:0}
        .leg{display:flex;gap:14px;padding:0 6px;font-size:12px;color:var(--ki-text-mid, #a8a8a8);flex-wrap:wrap}
        .leg span{display:flex;align-items:center;gap:6px}.leg i{width:10px;height:3px;border-radius:2px;display:inline-block}.leg .lr{margin-left:auto}
        .boost{height:56px;border-radius:28px;display:flex;align-items:center;justify-content:center;gap:8px;font-size:16px;font-weight:500;background:${BLUE};color:#10233a;transition:background .3s}
        .boost.on{background:var(--ki-surface, #3d3d3d);color:var(--ki-text, #fafafa)}
        .fanbox{background:var(--ki-surface, #3d3d3d);border-radius:24px;padding:14px 16px;display:flex;flex-direction:column;gap:10px;text-align:left;width:100%}
        .fbh{display:flex;justify-content:space-between;align-items:baseline;font-size:15px}.fbv{font-size:20px;font-weight:300}
        .fbb{display:block;height:8px;border-radius:4px;background:#2a2a2a;overflow:hidden}.fbb span{display:block;height:100%;background:${BLUE};transition:width .5s}
        .sw{position:relative;width:50px;height:28px;flex:none;border-radius:14px;background:#5a5a5a;transition:background .25s}
        .sw i{position:absolute;top:4px;left:4px;width:20px;height:20px;border-radius:50%;background:#2a2a2a;transition:left .25s}
        .sw.on{background:${GREEN}}.sw.on i{left:26px}
        /* akkordeoner (Diagnostikk-stil) */
        .acc{display:flex;flex-direction:column;gap:10px}
        .ah{height:52px;border-radius:26px;background:var(--ki-surface, #3d3d3d);display:flex;align-items:center;gap:10px;padding:0 16px;margin-top:4px;width:100%}
        .at{flex:1;text-align:left;font-size:15px}.as{font-size:12px;color:var(--ki-text-mid, #a8a8a8);white-space:nowrap}
        .ab{animation:fade .3s ease}
        .ab.grid{background:var(--ki-surface, #3d3d3d);border-radius:24px;padding:4px 16px 8px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:16px}
        .dr2{display:flex;justify-content:space-between;align-items:center;gap:8px;min-height:44px;font-size:14px;text-align:left;min-width:0}
        .dr2.bt{border-top:1px solid rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.07*var(--ki-wa-k,1)),var(--ki-wa-max,1)))}
        .dl{color:var(--ki-text-mid, #a8a8a8);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.dv{white-space:nowrap}
        .varsel{display:flex;flex-direction:column;gap:6px}
        .vl{height:44px;border-radius:22px;display:flex;align-items:center;gap:10px;padding:0 14px;font-size:13px;text-align:left}
        .vl.red{background:rgba(242,128,115,.16);color:var(--ki-red-text, var(--red,#f28073))}.vl.orange{background:rgba(240,163,107,.16);color:#f0a36b}.vl.blue{background:rgba(122,184,240,.16);color:${BLUE}}
        .nf{display:flex;flex-direction:column;align-items:flex-start;gap:6px;padding:14px 16px;border-radius:24px;background:var(--ki-surface, #3d3d3d);font-size:13px;color:var(--ki-text-mid, #a8a8a8)}.nf b{color:var(--ki-text, #fafafa);font-size:15px;font-weight:500}
        .vs{height:34px;padding:0 14px;border-radius:17px;background:var(--ki-surface-2, #4b4b4b);color:var(--ki-text, #fafafa);font-size:13px;margin-top:4px}
        .noanim *,.noanim *::before{animation:none!important}
        .noanim .hr{opacity:0}
        @media (prefers-reduced-motion: reduce){.wrap *{animation:none!important}}
        @container (max-width:360px){.kp{padding:12px 10px}.kv{font-size:21px}.ttl,.tbt{max-width:calc(100% - 196px)}.kw{font-size:34px}}
      `;
    }
  }

  /* ============================================================ «Tilpass varmepumpe» (v3-arket) */
  // MSH.overlay({ tilpass: true }) – 52 px fra toppen, maks 440 px (Fiks 40), til bunnen, dekker navbaren, samme høyde i alle faner (28.8/28.11).
  // Fast øverst: tittel + Ferdig (rosa pille), Forhåndsvisning, fanene Knapper · Faner · Entiteter · Visning. Under: eget
  // scrollområde (vanlig blokk, flex:1, min-height:0, overflow-y:auto, overscroll-behavior:contain – 30.2-mønsteret).
  // Utkast (MSH.draftEditor): endringer vises straks i kortet, lagres i kortets config ved Ferdig; utenfor/Esc forkaster.
  const FOCUS = { knapper: 'q', buttons: 'q', 'vp-btn': 'q', faner: 't', tabs: 't', entiteter: 'e', entities: 'e', overrides: 'e', visning: 'v' };
  const roleIdx = (k) => ROLES.findIndex((r) => r[0] === k);
  // Beste entitet for en rolle på en valgt enhet: parameter-ID → navn → første med riktig domene
  function bestOnDevice(hass, devId, k) {
    const r = ROLES[roleIdx(k)]; if (!r) return null;
    const [, , , doms, pids, rx, , not] = r;
    const E = hass.entities || {}, S0 = hass.states || {};
    const ids = Object.keys(E).filter((id) => E[id] && E[id].device_id === devId && S0[id] && doms.includes(dom(id))).sort();
    for (const p of pids) { const re = new RegExp('(^|_)' + p + '($|_)'); const hit = ids.find((id) => re.test(obj(id))); if (hit) return hit; }
    const txt = (id) => norm(obj(id) + ' ' + ((S0[id] && S0[id].attributes.friendly_name) || ''));
    return ids.find((id) => rx.test(txt(id)) && !(not && not.test(txt(id)))) || ids[0] || null;
  }
  function openSheet(card, focus) {
    if (card._sheet && card._sheet.ov && !card._sheet.ov.closed) { const t = FOCUS[focus] || (/^vp-/.test(focus || '') ? 'e' : null); if (t) { card._sheet.st.tab = t; card._sheet.draw(); } return card._sheet; }
    let ov = null;
    const st = { tab: FOCUS[focus] || (/^vp-/.test(focus || '') ? 'e' : 'q'), open: null, q: '', kind: 'alle', busy: false };
    const ctl = M.draftEditor(card, {
      saveOpts: { scope: 'shared' },
      banner: () => ov && ov.root.querySelector('.scr .in'),
      alive: () => !ov || ov.host.isConnected,
      close: () => ov && ov.close(),
      onBusy: (b) => { st.busy = b; draw(); },
      onReload: () => draw(),
    });
    const hass = () => card.hass || card._hass;
    const apply = (patch, hap) => {
      if (st.busy) return;
      const next = { ...ctl.draft, ...patch };
      Object.keys(patch).forEach((k) => { if (patch[k] === undefined) delete next[k]; });
      ctl.set(next);
      if (hap) M.haptic(hap);
      draw();
    };
    const sw = (a, k, onv, label) => `<button class="tsw${onv ? ' on' : ''}" data-a="${a}" data-k="${k}" role="switch" aria-checked="${onv}" aria-label="${esc(label)}"><span></span></button>`;
    const segBtn = (a, k, label, onv) => `<button class="sgb${onv ? ' on' : ''}" data-a="${a}" data-k="${k}" role="radio" aria-checked="${onv}">${esc(label)}</button>`;
    // Forhåndsvisning (v3 ed.pvQuick / pvTabs)
    const preview = (D) => {
      const h = hass(), V = visBtns(h, D), T = visTabs(h, D), tst = tabStyle(D), ic = btnStyle(D) === 'icon';
      const act = T.includes(card.tab) ? card.tab : T[0];
      return `<section class="pv"><span class="cap">Forhåndsvisning</span><div class="pvi">
        <div class="pvq" style="grid-template-columns:repeat(${Math.max(1, V.length)},minmax(0,1fr))">${V.map((k) => `<span class="pq">${M.icon(BK[k][2], 20)}${ic ? '' : `<span class="pql">${esc(btnName(D, k))}</span>`}</span>`).join('') || '<span class="pqn">Ingen knapper</span>'}</div>
        <div class="pvr"><div class="pvt">${T.map((k) => `<span class="pt${k === act ? ' on' : ''}">${tst !== 'name' ? M.icon(TK[k][2], 17) : ''}${tst !== 'icon' ? `<span class="ptl">${esc(tabName(D, k))}</span>` : ''}</span>`).join('')}</div><span class="pg">${M.icon('mdi:cog', 19)}</span></div>
      </div></section>`;
    };
    const listRows = (D, list) => {
      const isB = list === 'buttons', keys = isB ? btnOrder(D) : tabOrder(D), H = isB ? btnHidden(D) : tabHidden(D), h = hass();
      return keys.map((k, i) => {
        const hid = H.has(k), label = isB ? btnName(D, k) : tabName(D, k), def = isB ? BK[k][1] : TK[k][1];
        const miss = isB ? (h && !btnEnt(h, D, k) ? 'Mangler entitet – vises ikke' : '') : (k === 'luft' && h && !hasLuft(h, D) ? 'Skjult automatisk – fant ikke BT20/BT21' : '');
        return `<div class="dr${hid ? ' off' : ''}${i ? ' bt' : ''}" data-row="${k}" data-key="dr-${list}-${k}">
          <span class="hdl" data-drag="${list}" title="Dra for å flytte" aria-label="Dra for å flytte ${esc(label)}">${M.icon('mdi:drag', 22)}</span>
          <span class="dic">${M.icon(isB ? BK[k][2] : TK[k][2], 22)}</span>
          <span class="dcol"><input class="nm" data-in="${isB ? 'button_names' : 'tab_names'}" data-k="${k}" value="${esc(label)}" placeholder="${esc(def)}" aria-label="Navn på ${esc(def)}" autocomplete="off" spellcheck="false">${miss ? `<span class="dms">${esc(miss)}</span>` : ''}</span>${!isB && M.startTab ? M.startTab.pill(D, k, visTabs(h, D), ST_LEG) : ''}
          ${sw(isB ? 'bvis' : 'tvis', k, !hid, (hid ? 'Vis ' : 'Skjul ') + label)}</div>`;
      }).join('');
    };
    const hitsHTML = () => {
      const h = hass(), D = ctl.draft, k = st.open; if (!h || !k) return '';
      const r = ROLES[roleIdx(k)], doms = r[3], q = norm(st.q.trim()), Dv = h.devices || {}, E = h.entities || {}, S0 = h.states || {};
      const R0 = oppdag(h, D), cur = entOf(h, D, k);
      const match = (s) => !q || norm(s).includes(q) || norm(s).replace(/_/g, ' ').includes(q);
      const areaN = (d) => { const a = d && d.area_id && h.areas && h.areas[d.area_id]; return a ? a.name : ''; };
      const devName = (d) => (d && (d.name_by_user || d.name)) || '';
      const entsOf = (id) => Object.keys(E).filter((x) => E[x] && E[x].device_id === id && S0[x] && doms.includes(dom(x)));
      let devs = st.kind === 'ent' ? [] : (q ? Object.keys(Dv).filter((id) => match(devName(Dv[id]) + ' ' + areaN(Dv[id])) && entsOf(id).length) : R0.devs).slice(0, 30);
      let ents = st.kind === 'dev' ? [] : (q ? Object.keys(S0).filter((id) => doms.includes(dom(id)) && match(id + ' ' + ((S0[id].attributes || {}).friendly_name || '') + ' ' + devName(E[id] && Dv[E[id].device_id]))) : R0.ids.filter((id) => doms.includes(dom(id))));
      if (cur && !q && st.kind !== 'dev' && !ents.includes(cur)) ents = [cur, ...ents];
      const nEnt = ents.length; ents = ents.slice(0, 60);
      const item = (onv, icon, name, sub, mono, a, v) => `<button class="hit${onv ? ' on' : ''}" data-a="${a}" data-k="${esc(v)}">${`<span class="hic">${M.icon(icon, 18)}</span>`}<span class="hcol"><span class="hn">${esc(name)}</span><span class="hs${mono ? ' mono' : ''}">${esc(sub)}</span></span>${M.icon('mdi:check', 18, `color:${GREEN};opacity:${onv ? 1 : 0}`)}</button>`;
      const dh = devs.map((id) => { const d = Dv[id], es = entsOf(id), best = bestOnDevice(h, id, k); return item(es.includes(cur), isNibeDev(d) ? 'mdi:heat-pump' : 'mdi:devices', devName(d) || id, `${areaN(d) ? areaN(d) + ' · ' : ''}${es.length} entiteter · velger ${best ? M.name(h, best).toLowerCase() : '–'}`, false, 'pickdev', id); }).join('');
      const eh = ents.map((id) => { const d = E[id] && Dv[E[id].device_id]; return item(id === cur, M.domainIcon(id, S0[id]), `${(S0[id] && S0[id].attributes.friendly_name) || id}${d ? ' · ' + devName(d) : ''}`, id, true, 'pick', id); }).join('');
      const out = (devs.length ? `<span class="hh">Enheter · ${devs.length}</span>${dh}` : '') + (ents.length ? `<span class="hh">Entiteter · ${nEnt}</span>${eh}` : '');
      return out || '<span class="none">Ingen treff</span>';
    };
    const entRows = (D, keys) => {
      const h = hass();
      return keys.map((k, i) => {
        const r = ROLES[roleIdx(k)], ov0 = (D.overrides || {})[k], auto = h ? autoOf(h, { ...D, overrides: {} }, k) : null, id = ov0 || auto, open = st.open === k;
        const chip = ov0 ? ['o', 'Overstyrt'] : auto ? ['a', 'Auto'] : ['m', 'Mangler'];
        return `<div class="er${i ? ' bt' : ''}" data-key="er-${k}"><button class="eb" data-a="ent" data-k="${k}" aria-expanded="${open}"><span class="eic">${M.icon(r[6], 20)}</span>
          <span class="ecol"><span class="el"><span class="eln">${esc(r[1])}</span><span class="ech ${chip[0]}">${chip[1]}</span></span><span class="eid${id ? ' mono' : ' pkt'}">${esc(id || 'Velg entitet')}</span></span>
          <span class="eact">${open ? 'Lukk' : id ? 'Bytt' : 'Velg'}</span></button>
          ${open ? `<div class="eo"><div class="srow"><label class="sf">${M.icon('mdi:magnify', 20, 'color:var(--ki-text-mid, #979797)')}<input data-in="q" value="${esc(st.q)}" placeholder="Søk etter enhet eller entitet" autocomplete="off" autocapitalize="off" spellcheck="false"></label><button class="autob" data-a="auto" data-k="${k}">Auto</button></div>
            <div class="kinds" role="radiogroup">${[['alle', 'Alle'], ['dev', 'Enheter'], ['ent', 'Entiteter']].map(([kk, l]) => segBtn('kind', kk, l, st.kind === kk)).join('')}</div>
            <div class="hits">${hitsHTML()}</div></div>` : ''}</div>`;
      }).join('');
    };
    const content = (D) => {
      const sec = (title, inner, cls) => `<section class="sec${cls ? ' ' + cls : ''}"><span class="cap">${esc(title)}</span>${inner}</section>`;
      const safe = (fn) => { try { return fn(); } catch (e) { console.error('[ki-msh] Tilpass varmepumpe', e); return '<section class="sec"><span class="cap">Kunne ikke laste denne delen</span></section>'; } };
      if (st.tab === 'q') return safe(() => sec('Hurtigknapper · rekkefølge og navn', `<div class="dl" data-list="buttons">${listRows(D, 'buttons')}</div>`, 'lsec')
        + sec('Knappene viser', `<div class="sg2" role="radiogroup" data-glass-drag="x">${BTN_MODES.map(([k, l]) => segBtn('bmode', k, l, btnStyle(D) === k)).join('')}</div>`, 'pad')
        + '<span class="hint">Dra i håndtaket for å flytte, feltet gir nytt navn, bryteren skjuler. Knapper uten entitet vises ikke.</span>');
      if (st.tab === 't') return safe(() => (M.startTab ? sec('Startfane', M.startTab.editorHTML(D, visTabs(hass(), D).map((k) => ({ key: k, label: tabName(D, k), icon: TK[k][2] })), { legacy: ST_LEG, label: 'Åpne med' }), 'pad') : '') // 36.5: Startfane øverst
        + sec('Faner · rekkefølge og navn', `<div class="dl" data-list="tabs">${listRows(D, 'tabs')}</div>`, 'lsec')
        + sec('Fanene viser', `<div class="sg2" role="radiogroup" data-glass-drag="x">${TAB_MODES.map(([k, l]) => segBtn('tmode', k, l, tabStyle(D) === k)).join('')}</div>`, 'pad')
        + (M.tabH ? sec('Fanehøyde', M.tabH.editorHTML(D.tab_height, { ...VTH, cfg: D, label: 'Høyde' }), 'pad') : '') // 33.4: fanehøyde (felles felt)
        + '<span class="hint">Dra i håndtaket for å flytte. Minst én fane må være synlig. Faner uten data (f.eks. Luft uten BT20/BT21) skjules av seg selv.</span>');
      if (st.tab === 'e') {
        const first = ['power', 'energy', 'freq', 'status', 'ute', 'vv', 'boost', 'vent', 'pump', 'alarm', 'wifi', 'smart', 'cost_day'];
        const rest = GROUPS.map(([g, label]) => [label, ROLES.filter((r) => r[2] === g && !first.includes(r[0])).map((r) => r[0])]).filter(([, L]) => L.length);
        return safe(() => sec('Funnet på NIBE-enheten', `<div class="ents">${entRows(D, first)}</div>`, 'lsec') + rest.map(([label, L]) => sec(label, `<div class="ents">${entRows(D, L)}</div>`, 'lsec')).join('')
          + '<span class="hint">Kortet finner entitetene selv. Bytt bare når den som ble funnet er feil. Roller som mangler, vises med «–» og skjuler knappen sin.</span>');
      }
      const VIS = [['anim', 'Animasjoner', 'Vifte, rør og varme i toppkortet'], ['kpi', 'Nøkkeltall', 'Ute, kompressor og varmtvann'], ['sentence', 'Setning i Info', '«Kompressoren går på …»'], ['diag', 'Diagnostikk', 'Knappen nederst i popupen']];
      return safe(() => sec('Visning', `<div class="vis">${VIS.map(([k, l, s], i) => `<div class="vr${i ? ' bt' : ''}"><span class="vcol"><span class="vl1">${esc(l)}</span><span class="vl2">${esc(s)}</span></span>${sw('vis', k, D[k] !== false, l)}</div>`).join('')}</div>`, 'lsec')
        + `<button class="reset" data-a="reset">${M.icon('mdi:restart', 20)}Tilbakestill alt</button>`);
    };
    const draw = () => {
      if (!ov) return;
      const scr = box.querySelector('.scr'), top = scr ? scr.scrollTop : 0, D = ctl.draft;
      box.innerHTML = `<div class="fix">
          <div class="hd"><span class="tt">Tilpass varmepumpe</span><button class="ok" data-a="done" ${st.busy ? 'disabled aria-busy="true"' : ''}>${st.busy ? 'Lagrer …' : 'Ferdig'}</button></div>
          ${preview(D)}
          <div class="etabs" role="tablist" data-glass-drag="x">${[['q', 'Knapper'], ['t', 'Faner'], ['e', 'Entiteter'], ['v', 'Visning']].map(([k, l]) => `<button class="et${st.tab === k ? ' on' : ''}" role="tab" aria-selected="${st.tab === k}" data-a="etab" data-k="${k}">${l}</button>`).join('')}</div>
        </div>
        <div class="scr" data-tab="${st.tab}"><div class="in">${content(D)}</div></div>`;
      const n = box.querySelector('.scr');
      if (n && st.keep !== false) n.scrollTop = top;
      st.keep = true;
      const et = box.querySelector('.etabs');
      if (et && M.glassDrag) M.glassDrag(et, { axis: 'x', touchAction: 'pan-y' });
    };
    ov = M.overlay({ html: '', css: SHEET_CSS, maxWidth: 440, tilpass: true, onClose: () => { ctl.dispose(); card._sheet = null; } });
    const box = document.createElement('div');
    box.className = 'vps';
    Object.defineProperty(box, '_config', { get: () => ctl.draft });
    ov.body.appendChild(box);
    // 33.4: fanehøyde – slider live (utkast/forhåndsvisning bak arket), segment/slipp lagrer i utkastet og tegner på nytt
    if (M.startTab) M.startTab.bindEditor(box, { set: (v) => apply({ start_tab: v }) }); // 36.5 (haptic i hjelperen)
    if (M.tabH) M.tabH.bindEditor(box, { set: (v, commit) => { if (commit) return apply({ tab_height: v }); const next = { ...ctl.draft }; if (v == null) delete next.tab_height; else next.tab_height = v; ctl.set(next); } });
    // Scrollområdet: aldri kjede til popupen/dashbordet (fallgruve 2)
    ['touchstart', 'touchmove', 'pointerdown', 'wheel'].forEach((t) => box.addEventListener(t, (e) => { if (e.target.closest && e.target.closest('.scr')) e.stopPropagation(); }, { passive: true }));
    box.addEventListener('input', (e) => {
      if (e.target.dataset.in === 'q') { st.q = e.target.value; const hb = box.querySelector('.hits'); if (hb) hb.innerHTML = hitsHTML(); }
    });
    box.addEventListener('change', (e) => {
      const t = e.target, f = t.dataset && t.dataset.in;
      if (f !== 'button_names' && f !== 'tab_names') return;
      const k = t.dataset.k, def = f === 'button_names' ? BK[k][1] : TK[k][1], v = t.value.trim(), N = { ...(ctl.draft[f] || {}) };
      if (!v || v === def) delete N[k]; else N[k] = v;
      apply({ [f]: Object.keys(N).length ? N : undefined }, 'selection');
    });
    // Dra og slipp (v3: håndtak, touch-action none, stopPropagation – fallgruve 2), live omorganisering, haptic
    box.addEventListener('pointerdown', (e) => {
      const hd = e.target.closest && e.target.closest('[data-drag]');
      if (!hd || e.button || st.busy) return;
      e.preventDefault(); e.stopPropagation();
      const row = hd.closest('[data-row]'), list = row.parentElement, id = e.pointerId, which = hd.dataset.drag;
      row.classList.add('drag'); list.classList.add('dragging');
      M.haptic('medium');
      const mv = (ev) => {
        if (ev.pointerId !== id) return;
        ev.preventDefault(); ev.stopPropagation();
        const rs = [...list.querySelectorAll('[data-row]')];
        let to = rs.findIndex((x) => { const b = x.getBoundingClientRect(); return ev.clientY < b.top + b.height / 2; });
        if (to < 0) to = rs.length - 1;
        const from = rs.indexOf(row);
        if (to === from) return;
        if (to > from) rs[to].after(row); else rs[to].before(row);
        M.haptic('selection');
      };
      const tm = (ev) => { if (ev.cancelable) ev.preventDefault(); ev.stopPropagation(); };
      const up = (ev) => {
        if (ev.pointerId !== id) return;
        window.removeEventListener('pointermove', mv, true); window.removeEventListener('pointerup', up, true); window.removeEventListener('pointercancel', up, true); window.removeEventListener('touchmove', tm, true);
        row.classList.remove('drag'); list.classList.remove('dragging');
        const ord = [...list.querySelectorAll('[data-row]')].map((x) => x.dataset.row), D = ctl.draft;
        const was = which === 'buttons' ? btnOrder(D) : tabOrder(D);
        if (ord.join() === was.join()) { M.haptic('light'); return draw(); }
        return apply({ [which]: ord }, 'light');
      };
      window.addEventListener('pointermove', mv, true); window.addEventListener('pointerup', up, true); window.addEventListener('pointercancel', up, true);
      window.addEventListener('touchmove', tm, { capture: true, passive: false });
    });
    ov.root.addEventListener('click', (e) => {
      const el = e.target.closest && e.target.closest('[data-a]');
      if (!el || el.disabled) return;
      const a = el.dataset.a, k = el.dataset.k, D = ctl.draft, h = hass();
      switch (a) {
        case 'done': return ctl.done();
        case 'etab': if (st.tab !== k) { st.tab = k; st.open = null; st.keep = false; M.haptic('selection'); draw(); } return undefined;
        case 'bvis': { const H = btnHidden(D); if (H.has(k)) H.delete(k); else H.add(k); return apply({ buttons_hidden: btnOrder(D).filter((x) => H.has(x)) }, 'selection'); }
        case 'tvis': {
          const H = tabHidden(D);
          if (!H.has(k) && TABS.filter((t) => !H.has(t[0])).length <= 1) { M.haptic('warning'); M.toast('Minst én fane må være synlig'); return undefined; }
          if (H.has(k)) H.delete(k); else H.add(k);
          return apply({ tabs_hidden: H.size ? tabOrder(D).filter((x) => H.has(x)) : undefined }, 'selection');
        }
        case 'bmode': return apply({ button_style: k }, 'selection');
        case 'tmode': return apply({ tab_style: k }, 'selection');
        case 'ent': st.open = st.open === k ? null : k; st.q = ''; st.kind = 'alle'; M.haptic('light'); draw(); { const i = st.open && box.querySelector('[data-in="q"]'); if (i) i.focus({ preventScroll: true }); } return undefined;
        case 'kind': st.kind = k; M.haptic('selection'); { const hb = box.querySelector('.hits'); if (hb) hb.innerHTML = hitsHTML(); box.querySelectorAll('.kinds .sgb').forEach((b) => { const o = b.dataset.k === k; b.classList.toggle('on', o); b.setAttribute('aria-checked', o); }); } return undefined;
        case 'pick': case 'pickdev': {
          const r = st.open; if (!r) return undefined;
          const id = a === 'pickdev' ? bestOnDevice(h, k, r) : k;
          if (!id) { M.haptic('warning'); M.toast('Fant ingen passende entitet på enheten'); return undefined; }
          st.open = null; st.q = '';
          return apply({ overrides: { ...(D.overrides || {}), [r]: id } }, 'selection');
        }
        case 'auto': { const O = { ...(D.overrides || {}) }; delete O[k]; st.open = null; return apply({ overrides: Object.keys(O).length ? O : undefined }, 'light'); }
        case 'vis': return apply({ [k]: D[k] === false }, 'selection');
        case 'reset': { st.open = null; M.haptic('warning'); ctl.set({ type: D.type || 'custom:msh-varmepumpe-card', ...(D.card_id ? { card_id: D.card_id } : {}) }); return draw(); }
        default: return undefined;
      }
    });
    card._sheet = { ov, st, box, draw, ctl };
    draw();
    return card._sheet;
  }
  const SHEET_CSS = `
    .sh{--ki-sh-px:14px;--ki-sh-pt:10px}
    .sh.tp{display:flex;flex-direction:column;overflow:hidden;--ki-sh-pb:0px}
    .sh.tp>.gz{position:relative;top:0;flex:none}
    .body{flex:1;min-height:0;display:flex!important;flex-direction:column}
    .vps{flex:1;min-height:0;display:flex;flex-direction:column}
    .fix{flex:none;display:flex;flex-direction:column;gap:10px;padding:0 0 10px}
    .hd{display:flex;align-items:center;gap:8px;padding:2px 6px 4px}
    .tt{flex:1;min-width:0;font-size:22px;font-weight:600;letter-spacing:-0.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .ok{height:40px;padding:0 18px;border-radius:20px;background:${PINK_BTN};color:var(--ki-on-accent, #3a3a3a);font-size:14px;font-weight:600;flex:none}
    .ok:active,.reset:active,.autob:active{transform:scale(.95)}
    .cap{font-size:12px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;color:var(--ki-text-3, #7f7f7f)}
    .pv{display:flex;flex-direction:column;gap:8px;padding:12px;border-radius:24px;background:var(--ki-surface, #3a3a3a)}
    .pvi{padding:10px;border-radius:18px;background:#303030;display:flex;flex-direction:column;gap:8px}
    .pvq{display:grid;gap:6px}
    .pq{height:52px;border-radius:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:0 2px;min-width:0;color:#bdbdbd;box-shadow:inset 0 0 0 1.5px #4a4a4a}
    .pql{font-size:9px;font-weight:500;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .pqn{grid-column:1/-1;text-align:center;font-size:12px;color:var(--ki-text-3, #7f7f7f);line-height:52px}
    .pvr{display:flex;align-items:center;gap:6px}
    .pvt{flex:1;min-width:0;display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:2px;padding:3px;border-radius:22px;background:var(--ki-surface, #3a3a3a);box-shadow:inset 0 0 0 1px rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.05*var(--ki-wa-k,1)),var(--ki-wa-max,1)))}
    .pt{height:34px;min-width:0;border-radius:17px;display:flex;align-items:center;justify-content:center;gap:6px;padding:0 4px;font-size:11px;font-weight:500;white-space:nowrap;color:var(--ki-text-2, #afafaf)}
    .pt.on{background:${PINK};color:${INK}}
    .ptl{max-width:100%;overflow:hidden;text-overflow:ellipsis}
    .pg{width:40px;height:40px;border-radius:20px;flex:none;background:var(--ki-surface, #3a3a3a);display:grid;place-items:center}
    .etabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:2px;padding:4px;border-radius:24px;background:var(--ki-surface, #3a3a3a);box-shadow:inset 0 0 0 1px rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.05*var(--ki-wa-k,1)),var(--ki-wa-max,1)));position:relative;touch-action:pan-y}
    .et{height:40px;border-radius:20px;font-size:13px;font-weight:500;white-space:nowrap;background:transparent;color:var(--ki-text-2, #afafaf);transition:background .3s,color .3s}
    .et.on{background:${PINK};color:${INK}}
    .scr{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y;scrollbar-width:none;padding:0 0 calc(40px + env(safe-area-inset-bottom, 0px))}
    .scr::-webkit-scrollbar{display:none}
    .in{display:flex;flex-direction:column;gap:8px}
    .sec{flex:none;display:flex;flex-direction:column;border-radius:24px;background:var(--ki-surface, #3a3a3a)}
    .sec.lsec>.cap{padding:14px 16px 6px}
    .sec.pad{gap:8px;padding:14px}
    .dl{padding:0 12px 6px}
    .dr{display:flex;align-items:center;gap:10px;min-height:64px;padding:6px 4px;position:relative;transition:opacity .2s,transform .2s}
    .dr.bt{border-top:1px solid rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.06*var(--ki-wa-k,1)),var(--ki-wa-max,1)))}
    .dr.off{opacity:.5}
    .dr.drag{z-index:2;border-radius:18px;background:var(--ki-surface-2, #404040);box-shadow:0 10px 24px rgba(0,0,0,.45);transform:scale(1.02);border-top-color:transparent;opacity:1}
    .hdl{width:32px;height:48px;margin-left:-4px;flex:none;display:grid;place-items:center;touch-action:none;cursor:grab;color:var(--ki-text-3, #7f7f7f);user-select:none;-webkit-user-select:none}
    .dragging .hdl{cursor:grabbing}
    .dic{color:var(--ki-text-2, #afafaf);width:24px;flex:none;display:inline-flex}
    .dcol{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
    .nm{width:100%;box-sizing:border-box;height:40px;border-radius:12px;border:0;outline:none;padding:0 12px;background:var(--ki-popup, #282828);color:var(--ki-text, #fafafa);font:inherit;font-size:14px}
    .dms{font-size:11px;color:var(--ki-text-mid, #979797);padding:0 4px}
    .tsw{position:relative;width:50px;height:28px;flex:none;border-radius:14px;background:#5a5a5a;transition:background .25s}
    .tsw span{position:absolute;top:4px;left:4px;width:20px;height:20px;border-radius:50%;background:#2a2a2a;transition:left .25s}
    .tsw.on{background:${GREEN}}.tsw.on span{left:26px}
    .sg2,.kinds{display:flex;gap:2px;padding:3px;border-radius:20px;background:var(--ki-popup, #282828);position:relative;touch-action:pan-y}
    .kinds{border-radius:18px}
    .sgb{flex:1;height:36px;border-radius:17px;font-size:13px;font-weight:500;background:transparent;color:var(--ki-text-2, #afafaf)}
    .kinds .sgb{height:32px;border-radius:15px;font-size:12px}
    .sgb.on{background:${PINK};color:${INK}}
    .hint{font-size:12px;color:var(--ki-text-3, #7f7f7f);padding:2px 8px 0;line-height:1.45}
    .ents{padding:0 16px 4px}
    .er{display:flex;flex-direction:column}
    .er.bt{border-top:1px solid rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.06*var(--ki-wa-k,1)),var(--ki-wa-max,1)))}
    .eb{display:flex;align-items:center;gap:12px;min-height:60px;width:100%;text-align:left}
    .eic{width:40px;height:40px;flex:none;border-radius:20px;background:var(--ki-surface-2, #404040);display:grid;place-items:center}
    .ecol{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
    .el{display:flex;align-items:center;gap:6px;min-width:0}
    .eln{font-size:14px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .ech{height:18px;padding:0 7px;border-radius:9px;font-size:10px;font-weight:600;display:inline-flex;align-items:center;flex:none}
    .ech.a{background:rgba(111,210,154,.18);color:#6fd29a}.ech.o{background:rgba(242,138,201,.2);color:#f28ac9}.ech.m{background:rgba(240,179,107,.2);color:#f0b36b}
    .eid{font-size:11px;color:var(--ki-text-mid, #979797);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .eid.mono,.hs.mono{font-family:ui-monospace,monospace}
    .eid.pkt{color:var(--ki-pink-text, rgb(242 133 201))}
    .eact{font-size:13px;color:var(--ki-text-2, #afafaf);flex:none}
    .eo{display:flex;flex-direction:column;gap:8px;padding:0 0 12px}
    .srow{display:flex;gap:6px}
    .sf{flex:1;min-width:0;height:44px;border-radius:22px;background:var(--ki-popup, #282828);display:flex;align-items:center;gap:8px;padding:0 14px;box-sizing:border-box}
    .sf input{flex:1;min-width:0;height:100%;background:transparent;border:0;outline:none;color:var(--ki-text, #fafafa);font:inherit;font-size:14px}
    .autob{height:44px;padding:0 14px;border-radius:22px;background:var(--ki-surface-2, #404040);font-size:13px;color:var(--ki-text-2, #afafaf);flex:none}
    .hits{display:flex;flex-direction:column;gap:2px;max-height:300px;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:none;border-radius:18px;background:var(--ki-popup, #282828);padding:4px;touch-action:pan-y}
    .hh{padding:10px 10px 4px;font-size:11px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;color:var(--ki-text-3, #7f7f7f)}
    .hit{display:flex;align-items:center;gap:10px;min-height:52px;padding:4px 10px 4px 6px;border-radius:14px;width:100%;text-align:left;background:transparent;flex:none}
    .hit.on{background:var(--ki-surface, #3a3a3a)}
    .hic{width:36px;height:36px;flex:none;border-radius:18px;background:var(--ki-surface, #3a3a3a);display:grid;place-items:center}
    .hcol{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
    .hn{font-size:14px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .hs{font-size:11px;color:var(--ki-text-mid, #979797);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .none{padding:18px;text-align:center;font-size:13px;color:var(--ki-text-mid, #979797)}
    .vis{padding:0 16px 4px}
    .vr{display:flex;align-items:center;gap:12px;min-height:64px;padding:8px 0}
    .vr.bt{border-top:1px solid rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.06*var(--ki-wa-k,1)),var(--ki-wa-max,1)))}
    .vcol{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
    .vl1{font-size:15px;font-weight:500}.vl2{font-size:12px;color:var(--ki-text-mid, #979797)}
    .reset{height:48px;border-radius:24px;background:var(--ki-surface, #3a3a3a);font-size:14px;color:var(--ki-text-2, #afafaf);display:flex;align-items:center;justify-content:center;gap:8px;flex:none}
  `;

  /* ============================================================ GUI-editoren (getConfigElement) – samme config som arket */
  const autoOf = (h, c, k) => { if (!h) return null; try { return oppdag(h, c || {}).roles[k] || null; } catch (e) { return null; } };
  // Dra for rekkefølge i GUI-editoren: håndtak [data-vpdrag] i rader [data-vpk] med data-vpl = listenavn (buttons | tabs)
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
  const dragRow = (list, k, label, def, icon, off, key, extra, pill) => `<div data-vpk="${k}" data-vpl="${list}" style="min-height:56px;border-radius:24px;background:var(--ki-surface-3, #2f2f2f);display:flex;align-items:center;gap:8px;padding:6px 6px 6px 4px;${off ? 'opacity:.5' : ''}">
      <span data-vpdrag="1" title="Dra for rekkefølge" style="touch-action:none;cursor:grab;display:inline-flex;color:var(--ki-text-mid, #979797);padding:8px 6px">${M.icon('mdi:drag', 22)}</span>
      <span style="width:34px;height:34px;border-radius:17px;display:grid;place-items:center;background:var(--ki-surface-2, #404040);flex:none">${M.icon(icon, 19)}</span>
      <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px"><input class="inp" style="height:36px" data-name="${list === 'tabs' ? 'tab_names' : 'button_names'}.${k}" value="${esc(label === def ? '' : label)}" placeholder="${esc(def)}" aria-label="Navn på ${esc(def)}">${extra ? `<span style="font-size:11px;color:var(--ki-text-mid, #979797)">${esc(extra)}</span>` : ''}</span>
      ${pill || ''}<button class="ib" data-a="fn" data-k="${key}" data-v="${k}" aria-label="${off ? 'Vis' : 'Skjul'} ${esc(label)}" aria-pressed="${!off}">${M.icon(off ? 'mdi:eye-off' : 'mdi:eye', 18)}</button></div>`;
  const PV_CSS = 'padding:10px;border-radius:18px;background:#303030;display:flex;flex-direction:column;gap:8px';
  const PV_T = '<div style="font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--ki-text-3, #7f7f7f);margin:0 4px">Forhåndsvisning</div>';

  function editorSchema(h, c) {
    c = c || {};
    const R = h ? oppdag(h, c) : null;
    const D = (h && h.devices) || {};
    const devOpts = h ? Object.keys(D).filter((id) => isNibeDev(D[id]) || (R && R.devs.includes(id)) || Object.values(h.entities || {}).some((e) => e && e.device_id === id && PLATS.includes(e.platform)))
      .map((id) => [id, `${D[id].name_by_user || D[id].name || id}${D[id].model ? ' · ' + D[id].model : ''}`]) : [];
    const btnPrev = { type: 'html', html: (hh, cc) => {
      const V = visBtns(hh, cc), ic = btnStyle(cc) === 'icon';
      return `<div style="${PV_CSS}" aria-hidden="true">${PV_T}<div style="display:grid;grid-template-columns:repeat(${Math.max(1, V.length)},minmax(0,1fr));gap:6px">${V.length ? V.map((k) => `<span style="height:52px;border-radius:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;min-width:0;color:#bdbdbd;box-shadow:inset 0 0 0 1.5px #4a4a4a">${M.icon(BK[k][2], 20)}${ic ? '' : `<span style="font-size:9px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%">${esc(btnName(cc, k))}</span>`}</span>`).join('') : '<span style="text-align:center;font-size:12px;color:var(--ki-text-mid, #979797)">Ingen synlige knapper</span>'}</div></div>`;
    } };
    const btnList = { type: 'html', html: (hh, cc, key, ed) => {
      installEd(ed);
      const hid = btnHidden(cc);
      return `<div class="f" style="gap:8px"><label>Hurtigknapper · rekkefølge og navn</label>${btnOrder(cc).map((k) => {
        const id = hh ? btnEnt(hh, cc, k) : null;
        return dragRow('buttons', k, btnName(cc, k), BK[k][1], BK[k][2], hid.has(k), key, id ? (hh.states[id] ? M.name(hh, id) : id) : 'Mangler entitet – vises ikke');
      }).join('')}<span class="help">Dra i håndtaket for å flytte, feltet gir nytt navn, øyet skjuler. Knapper uten entitet vises ikke.</span></div>`;
    }, click: (dd, ed) => { const cc = ed._config || {}, s = btnHidden(cc); if (s.has(dd.v)) s.delete(dd.v); else s.add(dd.v); M.haptic('selection'); ed._set('buttons_hidden', btnOrder(cc).filter((x) => s.has(x))); } };
    const tabPrev = { type: 'html', html: (hh, cc) => {
      const V = visTabs(hh, cc), st = tabStyle(cc), act = (M.startTab ? M.startTab.pillKey(cc, V, ST_LEG) : null) || V[0];
      const t = (k) => { const o = k === act; return `<span style="min-width:0;height:34px;border-radius:17px;display:flex;align-items:center;justify-content:center;gap:6px;padding:0 4px;font-size:11px;font-weight:500;white-space:nowrap;${o ? `background:${PINK};color:${INK}` : 'color:var(--ki-text-2, #afafaf)'}">${st !== 'name' ? M.icon(TK[k][2], 17) : ''}${st !== 'icon' ? `<span style="overflow:hidden;text-overflow:ellipsis">${esc(tabName(cc, k))}</span>` : ''}</span>`; };
      return `<div style="${PV_CSS}" aria-hidden="true">${PV_T}<div style="display:flex;align-items:center;gap:6px"><div style="flex:1;min-width:0;display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:2px;padding:3px;border-radius:22px;background:var(--ki-surface, #3a3a3a)">${V.length ? V.map(t).join('') : '<span style="text-align:center;font-size:12px;color:var(--ki-text-mid, #979797);line-height:34px">Ingen synlige faner</span>'}</div><span style="width:40px;height:40px;border-radius:20px;background:var(--ki-surface, #3a3a3a);display:grid;place-items:center;flex:none">${M.icon('mdi:cog', 19)}</span></div></div>`;
    } };
    const tabList = { type: 'html', html: (hh, cc, key, ed) => {
      installEd(ed);
      const hid = tabHidden(cc);
      return `<div class="f" style="gap:8px"><label>Faner · rekkefølge og navn</label>${tabOrder(cc).map((k) => dragRow('tabs', k, tabName(cc, k), TK[k][1], TK[k][2], hid.has(k), key, k === 'luft' && hh && !hasLuft(hh, cc) ? 'Skjult automatisk – fant ikke BT20/BT21' : '', M.startTab ? M.startTab.pill(cc, k, visTabs(hh, cc), ST_LEG) : '')).join('')}<span class="help">Dra i håndtaket for å flytte. Minst én fane må være synlig.</span></div>`;
    }, click: (dd, ed) => {
      const cc = ed._config || {}, s = tabHidden(cc);
      if (!s.has(dd.v) && TABS.filter((t) => !s.has(t[0])).length <= 1) { M.haptic('warning'); M.toast('Minst én fane må være synlig'); return; }
      if (s.has(dd.v)) s.delete(dd.v); else s.add(dd.v);
      M.haptic('selection'); ed._set('tabs_hidden', s.size ? tabOrder(cc).filter((x) => s.has(x)) : undefined);
    } };
    const entSec = ([g, label, icon]) => ({ type: 'section', id: 'vp-' + g, label, icon,
      meta: (hh, cc) => { const L = ROLES.filter((r) => r[2] === g); return `${L.filter((r) => entOf(hh, cc, r[0])).length} av ${L.length} funnet`; },
      fields: ROLES.filter((r) => r[2] === g).map(([k, l, , doms, pids, , ic]) => ({ type: 'entity', name: 'overrides.' + k, label: l + (pids.length ? ` · ${pids[0]}` : ''), icon: ic, domain: doms, auto: (hh, cc) => autoOf(hh, { ...cc, overrides: {} }, k), none_label: '– · Velg entitet' })) });
    const reset = { type: 'button', label: 'Tilbakestill alt', icon: 'mdi:restart', run: (hh, cc, ed) => {
      M.haptic('warning');
      const id = (cc && cc.card_id) || M.uid();
      ed._config = { type: cc.type || 'custom:msh-varmepumpe-card', card_id: id };
      ed._set('card_id', id);
    } };
    const found = R ? R.devs.length : 0;
    return [
      ...(R && !found && !c.device ? [{ type: 'info', label: 'Fant ingen NIBE-enhet (integrasjonene nibe_heatpump eller myuplink). Velg entiteter under Entiteter.' }] : []),
      { type: 'tabs', id: 'varmepumpe', tabs: [
        { key: 'knapper', label: 'Knapper', icon: 'mdi:gesture-tap-button', focus: ['knapper', 'buttons', 'vp-btn'], fields: [
          { type: 'section', id: 'knapper', label: 'Hurtigknapper', icon: 'mdi:gesture-tap-button', fields: [
            btnPrev, btnList,
            { type: 'select', name: 'button_style', label: 'Knappene viser', options: BTN_MODES, default: DEF.button_style },
          ] },
        ] },
        { key: 'faner', label: 'Faner', icon: 'mdi:tab', focus: ['faner', 'tabs'], fields: [
          { type: 'section', id: 'faner', label: 'Faner', icon: 'mdi:tab', fields: [
            ...(M.startTab ? [M.startTab.field({ legacy: ST_LEG, items: (hh, cc) => visTabs(hh, cc || {}).map((k) => ({ key: k, label: tabName(cc || {}, k), icon: TK[k][2] })) })] : []), // 36.5: Startfane øverst
            tabPrev, tabList,
            { type: 'select', name: 'tab_style', label: 'Fanene viser', options: TAB_MODES, default: DEF.tab_style },
            ...(M.tabH ? [M.tabH.field(VTH)] : []), // 33.4: fanehøyde
          ] },
        ] },
        { key: 'entiteter', label: 'Entiteter', icon: 'mdi:format-list-bulleted-type', focus: ['entiteter', 'entities', 'overrides', ...GROUPS.map((g) => 'vp-' + g[0])], fields: [
          { type: 'info', label: 'Kortet finner entitetene selv (parameter-ID først, så navn). Bytt bare når den som ble funnet er feil.' },
          { type: 'section', id: 'entiteter', label: 'Funnet på NIBE-enheten', icon: 'mdi:heat-pump', fields: [
            { type: 'select', name: 'device', label: 'NIBE-enhet', options: [['', found ? `Automatisk · ${R.dev ? (R.dev.name_by_user || R.dev.name) : ''}` : 'Automatisk'], ...devOpts], default: '' },
          ] },
          ...GROUPS.map(entSec),
        ] },
        { key: 'visning', label: 'Visning', icon: 'mdi:eye-outline', focus: ['visning', 'spacing'], fields: [
          { type: 'section', id: 'visning', label: 'Visning', icon: 'mdi:eye-outline', fields: [
            { type: 'text', name: 'name', label: 'Navn i toppkortet', placeholder: 'Varmepumpe' },
            { type: 'boolean', name: 'anim', label: 'Animasjoner', default: true, help: 'Vifte, rør og varme i toppkortet' },
            { type: 'boolean', name: 'kpi', label: 'Nøkkeltall', default: true, help: 'Ute, kompressor og varmtvann' },
            { type: 'boolean', name: 'sentence', label: 'Setning i Info', default: true, help: '«Kompressoren går på …»' },
            { type: 'boolean', name: 'diag', label: 'Diagnostikk', default: true, help: 'Knappen nederst i popupen' },
          ] },
          M.spacingSchema(),
          reset,
        ] },
      ] },
    ];
  }

  M.POPUP_CARDS = M.POPUP_CARDS || [];
  if (!M.POPUP_CARDS.includes('msh-varmepumpe-card')) M.POPUP_CARDS.push('msh-varmepumpe-card'); // «Mellomrom» ligger i Visning-fanen (GUI)
  M.varmepumpe = { oppdag, ROLES, nibeDevices, openSheet };
  M.define('msh-varmepumpe-card', Varmepumpe, 'MSH Varmepumpe', 'Varmepumpe-popup (#varmepumpe): NIBE S/F-serien via nibe_heatpump / myUplink – animert pumpe, KPI, hurtigknapper, Info · Varme · Varmtvann · Luft og diagnostikk (v3).');

  /* ============================================================ én varmepumpe-popup (fiks 31.2 · samme metode som 30.1) */
  // Nøyaktig ÉN varmepumpe-popup: strategien lager #varmepumpe med ÉTT msh-varmepumpe-card (card_id varmepumpe, ingen
  // entiteter i config). #nibe (og #heatpump/#heat_pump/#varmepumpa) er alias: hashchange/location-changed dit →
  // history.replaceState til #varmepumpe. En importert/egen popup med de gamle kortene (gap-card, button-card, grid,
  // simple-tabs, expander-card, mini-graph-card, ki-varmepumpe-card) – på en av hashene – erstattes av den genererte
  // (MSH.POPUP_ALIAS flytter alias-hashen, MSH.POPUP_SUPERSEDE lar den genererte vinne til «Bruk egen», MSH.POPUP_MIGRATE
  // gjør en overstyrt popup om til ÉTT kort) og fjernes fra ki-store én gang (M.varmepumpeMigrateStore, logget).
  const OLD_HASH = ['#nibe', '#heatpump', '#heat_pump', '#varmepumpa'], ALL_HASH = [HASH, ...OLD_HASH];
  M.HASH_ALIAS = M.HASH_ALIAS || {};
  OLD_HASH.forEach((h) => { M.HASH_ALIAS[h] = HASH; });
  M.POPUP_CARD_ID = M.POPUP_CARD_ID || {};
  M.POPUP_CARD_ID[HASH] = 'varmepumpe';
  M.VARMEPUMPE_HASH = HASH;
  const tagOfC = (c) => String((c && c.type) || '').replace(/^custom:/, '');
  const cardsDeep = (cards) => { const out = []; const w = (L, d) => (Array.isArray(L) ? L : []).forEach((c) => { if (!c || typeof c !== 'object' || d > 12) return; out.push(c); if (Array.isArray(c.cards)) w(c.cards, d + 1); if (c.card) w([c.card], d + 1); if (Array.isArray(c.tabs)) w(c.tabs.map((t) => t && (t.card || t)), d + 1); }); w(cards, 0); return out; };
  const LEG_TAGS = ['ki-varmepumpe-card', 'ki-nibe-card', 'nibe-card'];
  const VP_RX = /varmepumpe|varmepumpa|heat.?pump|\bnibe|_nibe|nibe_|_4001[34]\b|_40004\b|_41778\b|_43136\b|_47137\b|_5000[45]\b/i;
  const jsonOf = (o) => { try { return JSON.stringify(o || {}); } catch (e) { return ''; } };
  const vpish = (cfg) => !!cfg && typeof cfg === 'object' && (VP_RX.test(`${cfg.name || ''} ${cfg.icon || ''}`) || VP_RX.test(jsonOf(cfg.cards)));
  const oneMain = (cfg) => Array.isArray(cfg && cfg.cards) && cfg.cards.length === 1 && tagOfC(cfg.cards[0]) === 'msh-varmepumpe-card';
  // Gammel popup = kortene er ikke nøyaktig ÉTT msh-varmepumpe-card, og de handler om varmepumpa (gamle kort eller NIBE-innhold)
  M.varmepumpeLegacyTest = (cfg) => {
    if (!cfg || typeof cfg !== 'object' || !Array.isArray(cfg.cards) || oneMain(cfg)) return false;
    const deep = cardsDeep(cfg.cards);
    return deep.some((c) => LEG_TAGS.includes(tagOfC(c))) || deep.filter((c) => tagOfC(c) === 'msh-varmepumpe-card').length > 0 || VP_RX.test(jsonOf(cfg.cards));
  };
  const hashN = (cfg) => { const s = String((cfg && cfg.hash) || '').trim(); return s ? s.replace(/^#?/, '#') : ''; };
  const isLegacyPop = (cfg) => { const h = hashN(cfg); return OLD_HASH.includes(h) ? vpish(cfg) : h === HASH && M.varmepumpeLegacyTest(cfg); };
  M.varmepumpeIsOldPopup = isLegacyPop;
  M.varmepumpeMigratePopup = function (cfg, want) {
    if (!M.varmepumpeLegacyTest(cfg)) return null;
    const own = cardsDeep(cfg.cards).find((c) => tagOfC(c) === 'msh-varmepumpe-card');
    const w = want && typeof want === 'object' ? want : { type: 'custom:msh-varmepumpe-card', card_id: 'varmepumpe' };
    return { ...cfg, cards: [{ ...w, ...(own || {}), type: 'custom:msh-varmepumpe-card', card_id: (own && own.card_id) || w.card_id || 'varmepumpe' }] };
  };
  M.POPUP_SUPERSEDE = M.POPUP_SUPERSEDE || {};
  M.POPUP_SUPERSEDE[HASH] = { name: 'Varmepumpe', test: (cfg) => M.varmepumpeLegacyTest(cfg) };
  M.POPUP_MIGRATE = M.POPUP_MIGRATE || {};
  M.POPUP_MIGRATE[HASH] = (cfg, gen) => M.varmepumpeMigratePopup(cfg, gen && Array.isArray(gen.cards) ? gen.cards[0] : null);
  M.POPUP_ALIAS = M.POPUP_ALIAS || {};
  OLD_HASH.forEach((h) => { M.POPUP_ALIAS[h] = { to: HASH, tag: 'msh-varmepumpe-card', test: (cfg) => vpish(cfg) }; });
  M.POPUP_EXTRA = M.POPUP_EXTRA || {};
  M.POPUP_EXTRA[HASH] = () => ({ card_id: 'varmepumpe' }); // ingen entiteter i config (26.20)
  M.POPUP_LEGACY_CARD = M.POPUP_LEGACY_CARD || {};
  if (!M.POPUP_LEGACY_CARD[HASH]) M.POPUP_LEGACY_CARD[HASH] = () => null;
  // Vilkår (strategi/allPopups): en NIBE-enhet (produsent NIBE, eller nibe_heatpump/myuplink-entiteter)
  M.popupNeeds = M.popupNeeds || {};
  M.popupNeeds[HASH] = (hass) => M.varmepumpeHas(hass);

  /* Engangsmigrering av ki-store (frontend/set_user_data). Kjøres av strategien ved generering; merket i ki-store
   * `migrations.varmepumpe31` (kjører aldri igjen) og logget i konsollen:
   *   1. custom_popups: gamle varmepumpe-popups (#nibe …, eller #varmepumpe med gamle kort) fjernes.
   *   2. popup_overrides: #nibe/nibe → varmepumpe; gamle kort i en overstyrt popup → ÉTT msh-varmepumpe-card.
   *   3. popups (Tilpass Hjem → Popups): nibe → varmepumpe.
   *   4. Lenker i alle kortconfiger (navbar, Hjem-kort, prosa-piller, varsler): '#nibe' → '#varmepumpe'.
   *   5. Admin: Lovelace-ressursen ki-varmepumpe-card.js fjernes (lovelace/resources/delete).
   * Service worker-/nettleser-cachen for den gamle filen tømmes ved hver oppstart (M.varmepumpeClearCache). */
  const MIG_KEY = 'migrations.varmepumpe31';
  const OLD_FILE_RX = /(^|\/)ki-varmepumpe-card\.js(\?|$)/;
  const cfgOf = (e) => { try { return M.customPopupConfig ? M.customPopupConfig(e).cfg : e; } catch (x) { return null; } };
  const swapHash = (o, d = 0) => {
    if (d > 14 || o == null) return { v: o, n: 0 };
    if (typeof o === 'string') { const t = o.trim(); return OLD_HASH.includes(t) ? { v: HASH, n: 1 } : { v: o, n: 0 }; }
    if (Array.isArray(o)) { let n = 0; const v = o.map((x) => { const r = swapHash(x, d + 1); n += r.n; return r.v; }); return n ? { v, n } : { v: o, n: 0 }; }
    if (typeof o === 'object') { let n = 0; const v = {}; Object.keys(o).forEach((k) => { const r = swapHash(o[k], d + 1); n += r.n; v[k] = r.v; }); return n ? { v, n } : { v: o, n: 0 }; }
    return { v: o, n: 0 };
  };
  M.varmepumpeMigrateStore = function (hass) {
    if (M._vpStoreMig || !M.store || !M.store.loaded || typeof M.store.get !== 'function') return false;
    M._vpStoreMig = true;
    if (M.store.get(MIG_KEY)) return false;
    const log = [];
    // 1 · custom_popups
    const CP = M.store.get('custom_popups');
    if (Array.isArray(CP)) {
      const keep = CP.filter((e) => { const cfg = cfgOf(e); if (!isLegacyPop(cfg)) return true; log.push('custom_popups ' + hashN(cfg) + ' fjernet'); return false; });
      if (keep.length !== CP.length) M.store.set('custom_popups', keep);
    }
    // 2 · popup_overrides
    const O = M.store.get('popup_overrides');
    if (O && typeof O === 'object') {
      const n = { ...O };
      let ch = false;
      Object.keys(O).forEach((k) => {
        const h = '#' + String(k).replace(/^#/, ''), ov = O[k];
        if (!ALL_HASH.includes(h)) return;
        let v = ov;
        if (ov && typeof ov === 'object') {
          const fx = ov.replace && ov.config ? M.varmepumpeMigratePopup(ov.config) : M.varmepumpeMigratePopup(ov);
          if (fx) { v = ov.replace && ov.config ? { ...ov, config: { ...fx, hash: HASH } } : fx; ch = true; log.push('popup_overrides ' + k + ': gamle kort → ÉTT msh-varmepumpe-card'); }
          else if (ov.replace && ov.config && OLD_HASH.includes(hashN(ov.config))) { v = { ...ov, config: { ...ov.config, hash: HASH } }; ch = true; }
        }
        if (h !== HASH) {
          const nk = String(k)[0] === '#' ? HASH : HASH.slice(1);
          delete n[k];
          if (!(nk in n) && !(HASH in n) && !(HASH.slice(1) in n)) { n[nk] = v; log.push('popup_overrides ' + k + ' → ' + nk); } else log.push('popup_overrides ' + k + ' fjernet (' + nk + ' finnes)');
          ch = true;
        } else n[k] = v;
      });
      if (ch) M.store.set('popup_overrides', n);
    }
    // 3 · popups.<key>
    const P = M.store.get('popups');
    if (P && typeof P === 'object') {
      const n = { ...P };
      let ch = false;
      OLD_HASH.forEach((h) => [h, h.slice(1)].forEach((k) => {
        if (!(k in n)) return;
        const tk = HASH.slice(1), v = { ...(n[k] || {}) };
        if (v.prefer === 'custom') delete v.prefer;
        if (!n[tk] && Object.keys(v).length) n[tk] = v;
        delete n[k]; ch = true; log.push('popups.' + k + ' → popups.' + tk);
      }));
      if (ch) M.store.set('popups', n);
    }
    // 4 · lenker i kortconfigene
    const CD = M.store.get('cards');
    if (CD && typeof CD === 'object') { const r = swapHash(CD); if (r.n) { M.store.set('cards', r.v); log.push(r.n + ' lenke(r) #nibe → #varmepumpe i kortconfigene'); } }
    M.store.set(MIG_KEY, { at: new Date().toISOString(), log }, { immediate: true });
    console.info('[ki-msh] Varmepumpe-migrering (fiks 31.2) kjørt én gang:', log.length ? log.join(' · ') : 'ingenting å endre');
    // 5 · gammel Lovelace-ressurs (bare admin)
    if (hass && hass.user && hass.user.is_admin && hass.callWS) {
      hass.callWS({ type: 'lovelace/resources' }).then((list) => Promise.all((Array.isArray(list) ? list : []).filter((r) => r && OLD_FILE_RX.test(String(r.url || '').split('#')[0])).map((r) => hass.callWS({ type: 'lovelace/resources/delete', resource_id: r.id }).then(() => console.info('[ki-msh] Varmepumpe: Lovelace-ressursen', r.url, 'er fjernet (gammelt kort)')))))
        .catch((e) => console.warn('[ki-msh] Varmepumpe: kunne ikke rydde Lovelace-ressursene (YAML-modus?)', e && (e.message || e.code)));
    }
    return true;
  };
  // Service worker-/Cache Storage: fjern den gamle filen (ki-varmepumpe-card.js) fra alle cacher
  M.varmepumpeClearCache = function () {
    try {
      if (!window.caches || !caches.keys) return Promise.resolve(0);
      return caches.keys().then((ks) => Promise.all(ks.map((k) => caches.open(k).then((c) => c.keys().then((reqs) => Promise.all(reqs.filter((r) => OLD_FILE_RX.test(new URL(r.url).pathname)).map((r) => c.delete(r))))))))
        .then((a) => { const n = a.flat().filter(Boolean).length; if (n) console.info('[ki-msh] Varmepumpe: ' + n + ' gamle filer fjernet fra service worker-cachen'); return n; })
        .catch(() => 0);
    } catch (e) { return Promise.resolve(0); }
  };
  // `type: custom:ki-varmepumpe-card` i gammel config → rendrer msh-varmepumpe-card (uten de gamle entitetene) + én advarsel
  M.varmepumpeDefineAlias = function () {
    const tag = 'ki-varmepumpe-card';
    if (customElements.get(tag)) return;
    let warned = false;
    class Alias extends HTMLElement {
      static getStubConfig() { return { card_id: 'varmepumpe' }; }
      setConfig(c) {
        this._cfg = { type: 'custom:msh-varmepumpe-card', card_id: (c && c.card_id) || 'varmepumpe' };
        if (!warned) { warned = true; console.warn(`[ki-msh] «custom:${tag}» er utgått – rendres som msh-varmepumpe-card. Bytt til «type: custom:msh-varmepumpe-card» i popupen ${HASH}.`); }
        if (this._inner) this._inner.setConfig(this._cfg); else if (this.isConnected) this._mount();
      }
      set hass(h) { this._hass = h; if (this._inner) this._inner.hass = h; }
      get hass() { return this._hass; }
      connectedCallback() { this.style.display = 'block'; this._mount(); }
      getCardSize() { return 12; }
      getGridOptions() { return { columns: 'full' }; }
      _mount() {
        if (!this._cfg || this._inner || !this.isConnected) return;
        const el = document.createElement('msh-varmepumpe-card');
        try { el.setConfig(this._cfg); } catch (e) { return; }
        if (this._hass) el.hass = this._hass;
        this._inner = el; this.appendChild(el);
      }
    }
    try { customElements.define(tag, Alias); } catch (e) { /* definert av en annen ressurs i mellomtiden */ }
  };
  if (!window.__mshVpHash) {
    window.__mshVpHash = true;
    setTimeout(() => M.varmepumpeDefineAlias(), 1500);
    setTimeout(() => M.varmepumpeClearCache(), 3000);
    // popupen finnes på hashen (strategiens rapport, ellers Bubble-kortene i DOM-en); own = en annen (ikke-varmepumpe) popup
    const popupAt = (hash, own) => {
      const Rp = M.popupReport;
      if (Rp && Array.isArray(Rp.entries) && Rp.entries.length) return Rp.entries.some((x) => x.hash === hash && !x.hidden && (!own || !vpish(x.config || {})));
      let found = false;
      const w = (r, d) => { if (found || !r || d > 14 || !r.querySelectorAll) return; r.querySelectorAll('bubble-card').forEach((b) => { const c = b.config || b._config; if (c && hashN(c) === hash && (!own || !vpish(c))) found = true; }); if (!found) r.querySelectorAll('*').forEach((x) => { if (x.shadowRoot) w(x.shadowRoot, d + 1); }); };
      w(document, 0);
      return found;
    };
    M.varmepumpeRedirect = function () {
      const h = location.hash;
      if (!OLD_HASH.includes(h) || popupAt(h, true) || !popupAt(HASH)) return false;
      try {
        const old = location.href;
        history.replaceState(history.state, '', location.pathname + location.search + HASH);
        window.dispatchEvent(new HashChangeEvent('hashchange', { oldURL: old, newURL: location.href }));
        window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: true } }));
        return true;
      } catch (x) { return false; }
    };
    // capture: før Bubble Card leser hashen
    ['hashchange', 'location-changed', 'popstate'].forEach((ev) => window.addEventListener(ev, () => M.varmepumpeRedirect(), true));
    setTimeout(() => M.varmepumpeRedirect(), 0);
  }
})();
