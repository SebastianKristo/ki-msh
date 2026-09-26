// Testdata for smoke-testen (kun test – kortene selv bruker aldri eksempeldata).
// window.mockHass() gir et hass-lignende objekt med områder, etasjer, register og states.
(function () {
  const now = new Date().toISOString();
  const S = {}, E = {}, D = {};
  const add = (id, state, attributes = {}, reg = {}) => {
    S[id] = { entity_id: id, state: String(state), attributes: { friendly_name: attributes.friendly_name || id.split('.')[1].replace(/_/g, ' '), ...attributes }, last_changed: now, last_updated: now, context: {} };
    E[id] = { entity_id: id, platform: reg.platform || 'demo', area_id: reg.area || null, device_id: reg.device || null, hidden: false, entity_category: reg.category || null, icon: null, name: null };
  };
  const areas = {
    stue: { area_id: 'stue', name: 'Stue', icon: 'mdi:sofa', floor_id: 'forste', picture: null },
    kjokken: { area_id: 'kjokken', name: 'Kjøkken', icon: 'mdi:countertop', floor_id: 'forste', picture: null },
    gang: { area_id: 'gang', name: 'Gang', icon: 'mdi:door', floor_id: 'forste', picture: null },
    soverom: { area_id: 'soverom', name: 'Soverom', icon: 'mdi:bed', floor_id: 'andre', picture: null },
    bad: { area_id: 'bad', name: 'Bad', icon: 'mdi:shower', floor_id: 'andre', picture: null },
    basseng: { area_id: 'basseng', name: 'Basseng', icon: 'mdi:pool', floor_id: 'ute', picture: null },
    hage: { area_id: 'hage', name: 'Hage', icon: 'mdi:flower', floor_id: 'ute', picture: null },
  };
  const floors = { forste: { floor_id: 'forste', name: '1. etg', level: 1, icon: null }, andre: { floor_id: 'andre', name: '2. etg', level: 2, icon: null }, ute: { floor_id: 'ute', name: 'Ute', level: 0, icon: null } };
  // Stue
  add('sensor.stue_temperatur', 21.4, { unit_of_measurement: '°C', device_class: 'temperature' }, { area: 'stue' });
  add('sensor.stue_fuktighet', 41, { unit_of_measurement: '%', device_class: 'humidity' }, { area: 'stue' });
  add('climate.stue', 'heat', { temperature: 21, current_temperature: 21.4, hvac_modes: ['off', 'heat', 'auto'], min_temp: 5, max_temp: 30, target_temp_step: 0.5, hvac_action: 'heating', friendly_name: 'Stue termostat' }, { area: 'stue' });
  add('light.stue_tak', 'on', { brightness: 180, supported_color_modes: ['brightness'], color_mode: 'brightness', friendly_name: 'Stue tak' }, { area: 'stue' });
  add('light.stue_lampe', 'off', { supported_color_modes: ['color_temp'], friendly_name: 'Stue lampe' }, { area: 'stue' });
  add('light.stue_led', 'on', { brightness: 90, supported_color_modes: ['rgb'], rgb_color: [255, 160, 90], friendly_name: 'Stue LED' }, { area: 'stue' });
  add('media_player.stue_tv', 'playing', { media_title: 'Dune: Part Two', media_artist: '', app_name: 'Netflix', volume_level: 0.32, source_list: ['TV', 'HDMI 1'], source: 'TV', friendly_name: 'Stue TV', supported_features: 152461 }, { area: 'stue' });
  add('media_player.stue_sonos', 'paused', { media_title: 'Blue in Green', media_artist: 'Miles Davis', volume_level: 0.2, friendly_name: 'Stue Sonos', supported_features: 152461 }, { area: 'stue' });
  add('cover.stue_gardin', 'open', { current_position: 80, friendly_name: 'Stue gardin', supported_features: 15 }, { area: 'stue' });
  add('switch.stue_peis', 'off', { friendly_name: 'Peis' }, { area: 'stue' });
  add('sensor.stue_peis_effekt', 0, { unit_of_measurement: 'W', device_class: 'power' }, { area: 'stue' });
  add('fan.stue_vifte', 'on', { percentage: 40, friendly_name: 'Stue vifte' }, { area: 'stue' });
  add('binary_sensor.stue_bevegelse', 'on', { device_class: 'motion', friendly_name: 'Bevegelse stue' }, { area: 'stue' });
  add('binary_sensor.stue_vindu', 'off', { device_class: 'window', friendly_name: 'Vindu stue' }, { area: 'stue' });
  add('scene.stue_komfort', 'unknown', { friendly_name: 'Komfort' }, { area: 'stue' });
  add('scene.stue_tv_kveld', 'unknown', { friendly_name: 'TV-kveld' }, { area: 'stue' });
  add('script.stue_maks_lys', 'off', { friendly_name: 'Maks lys' }, { area: 'stue' });
  add('sensor.stue_lysstyrke', 120, { unit_of_measurement: 'lx', device_class: 'illuminance' }, { area: 'stue' });
  // Kjøkken
  add('sensor.kjokken_temperatur', 22.1, { unit_of_measurement: '°C', device_class: 'temperature' }, { area: 'kjokken' });
  add('light.kjokken_spot', 'on', { brightness: 255, supported_color_modes: ['brightness'], friendly_name: 'Kjøkken spot' }, { area: 'kjokken' });
  add('switch.oppvaskmaskin', 'on', { friendly_name: 'Oppvaskmaskin' }, { area: 'kjokken' });
  add('sensor.oppvaskmaskin_effekt', 1850, { unit_of_measurement: 'W', device_class: 'power' }, { area: 'kjokken' });
  // Gang
  add('lock.inngangsdor', 'locked', { friendly_name: 'Inngangsdør' }, { area: 'gang' });
  add('binary_sensor.inngangsdor', 'off', { device_class: 'door', friendly_name: 'Inngangsdør' }, { area: 'gang' });
  add('camera.inngang', 'idle', { friendly_name: 'Inngang', entity_picture: '' }, { area: 'gang' });
  // Soverom
  add('sensor.soverom_temperatur', 18.2, { unit_of_measurement: '°C', device_class: 'temperature' }, { area: 'soverom' });
  add('sensor.soverom_fuktighet', 48, { unit_of_measurement: '%', device_class: 'humidity' }, { area: 'soverom' });
  add('climate.soverom', 'heat', { temperature: 18, current_temperature: 18.2, hvac_modes: ['off', 'heat'], min_temp: 5, max_temp: 30, friendly_name: 'Soverom panelovn' }, { area: 'soverom' });
  add('light.soverom_tak', 'off', { friendly_name: 'Soverom tak', supported_color_modes: ['brightness'] }, { area: 'soverom' });
  // Basseng
  add('sensor.basseng_temperatur', 27.5, { unit_of_measurement: '°C', device_class: 'temperature', friendly_name: 'Basseng temperatur' }, { area: 'basseng' });
  add('sensor.basseng_ph', 7.3, { device_class: 'ph', friendly_name: 'Basseng pH' }, { area: 'basseng' });
  add('sensor.basseng_klor', 1.4, { unit_of_measurement: 'mg/L', friendly_name: 'Basseng klor' }, { area: 'basseng' });
  add('switch.basseng_pumpe', 'on', { friendly_name: 'Basseng pumpe' }, { area: 'basseng' });
  add('switch.basseng_varmepumpe', 'off', { friendly_name: 'Basseng varmepumpe' }, { area: 'basseng' });
  add('sensor.basseng_pumpe_effekt', 620, { unit_of_measurement: 'W', device_class: 'power' }, { area: 'basseng' });
  // Hage / vanning
  add('valve.hage_sone_1', 'closed', { friendly_name: 'Plen foran' }, { area: 'hage' });
  add('valve.hage_sone_2', 'open', { friendly_name: 'Bed bak' }, { area: 'hage' });
  add('switch.vanning_drypp', 'off', { friendly_name: 'Vanning drypp' }, { area: 'hage' });
  add('sensor.hage_jordfuktighet', 32, { unit_of_measurement: '%', device_class: 'moisture' }, { area: 'hage' });
  // Hjem
  add('person.sebastian', 'home', { friendly_name: 'Sebastian', entity_picture: '' });
  add('person.cybele', 'not_home', { friendly_name: 'Cybele', entity_picture: '' });
  add('weather.home', 'partlycloudy', { temperature: 12.4, humidity: 71, wind_speed: 4.2, wind_bearing: 220, pressure: 1012, friendly_name: 'Hjem', temperature_unit: '°C', wind_speed_unit: 'm/s', supported_features: 3 }, { platform: 'met' });
  add('sensor.hele_huset_effekt', 2470, { unit_of_measurement: 'W', device_class: 'power', tekst: '2470 W', integrasjon: 'ki_rom' }, { platform: 'ki_rom' });
  add('sensor.hele_huset_lys', 3, { tekst: '3 på - 2 av', aktiv_liste: ['light.stue_tak', 'light.stue_led', 'light.kjokken_spot'], totalt: 5 }, { platform: 'ki_rom' });
  add('alarm_control_panel.hjem', 'disarmed', { code_format: 'number', friendly_name: 'Alarm', supported_features: 3 });
  add('todo.handleliste', 2, { friendly_name: 'Handleliste', supported_features: 15 });
  add('todo.store_oppgaver', 4, { friendly_name: 'Store oppgaver', supported_features: 15 });
  add('sensor.nordpool_kwh', 1.23, { unit_of_measurement: 'NOK/kWh', friendly_name: 'Strømpris', today: Array.from({ length: 24 }, (_, i) => 0.8 + Math.sin(i / 3) * 0.4), tomorrow: [] }, { platform: 'nordpool' });
  add('sensor.soppel_dager', 2, { unit_of_measurement: 'd', friendly_name: 'Søppel' });
  add('sensor.entur_stoppested', 4, { friendly_name: 'Majorstuen', unit_of_measurement: 'min', route: '5 Vestli', due_at: '21:14', delay: 0, next_route: '4 Bergkrystallen', next_due_at: '21:20', stop_id: 'NSR:StopPlace:58381', real_time: true, transport_mode: 'metro' }, { platform: 'entur_public_transport' });
  add('sensor.entur_avvik', 1, { friendly_name: 'Avvik', meldinger: [{ summary: 'Redusert frekvens linje 5', description: 'Arbeid i tunnelen' }] }, { platform: 'entur_sx' });
  // KI Rom-oversikt for stue
  add('sensor.stue_oversikt', 14, {
    integrasjon: 'ki_rom', area_id: 'stue', ikon: 'mdi:sofa', etasje: '1. etg', etasje_niva: 1,
    lys: ['light.stue_tak', 'light.stue_lampe', 'light.stue_led'], media: ['media_player.stue_tv', 'media_player.stue_sonos'],
    brytere: [{ entity: 'switch.stue_peis', effekt: 'sensor.stue_peis_effekt' }], vifter: [{ entity: 'fan.stue_vifte', effekt: null }], klima: [{ entity: 'climate.stue', effekt: null }],
    gardiner: ['cover.stue_gardin'], sensorer: [{ entity: 'binary_sensor.stue_bevegelse', klasse: 'motion' }, { entity: 'binary_sensor.stue_vindu', klasse: 'window' }],
    skript: ['script.stue_maks_lys'], scener: ['scene.stue_komfort', 'scene.stue_tv_kveld'], temperatur: ['sensor.stue_temperatur'], fuktighet: ['sensor.stue_fuktighet'], lysniva: ['sensor.stue_lysstyrke'], effekt: ['sensor.stue_peis_effekt'],
  }, { platform: 'ki_rom' });
  add('sensor.stue_lys', 2, { tekst: '2 på - 1 av', totalt: 3, aktiv_liste: ['light.stue_tak', 'light.stue_led'] }, { platform: 'ki_rom' });
  add('sensor.stue_media', 1, { tekst: '1 spiller - 1 av' }, { platform: 'ki_rom' });
  add('sensor.stue_brytere', 0, { tekst: '0 på - 1 av' }, { platform: 'ki_rom' });
  add('sensor.stue_sensorer', 1, { tekst: '1 aktiv - 1 stille' }, { platform: 'ki_rom' });
  add('sensor.stue_effekt', 412, { tekst: '412 W', unit_of_measurement: 'W', device_class: 'power' }, { platform: 'ki_rom' });
  // Diagnostikk som skal filtreres bort
  add('light.stue_status_led', 'on', { friendly_name: 'Status-LED' }, { area: 'stue', category: 'diagnostic' });

  // Utvidelser: test/mock/*.js kaller window.mockExtend(({ add, areas, floors }) => { … })
  window.mockExtend = (fn) => fn({ add, areas, floors, S, E, D });

  const calls = [];
  window.__calls = calls;
  window.mockHass = function () {
    const hist = (id) => { const s = S[id]; const v = parseFloat(s && s.state); if (isNaN(v)) return []; const t0 = Date.now() / 1000 - 86400; return Array.from({ length: 49 }, (_, i) => ({ s: String((v + Math.sin(i / 5) * (v * 0.05)).toFixed(1)), lu: t0 + i * 1800 })); };
    return {
      states: S, entities: E, devices: D, areas, floors,
      user: { id: 'u1', name: 'Sebastian', is_admin: true }, language: 'nb', locale: { language: 'nb', number_format: 'language', time_format: '24' },
      themes: { darkMode: true }, panelUrl: 'lovelace',
      callService: (d, s, data) => { calls.push([d, s, data]); return Promise.resolve(); },
      callWS: (m) => {
        calls.push(['ws', m.type, m]);
        if (m.type === 'history/history_during_period') { const r = {}; (m.entity_ids || []).forEach((id) => { r[id] = hist(id); }); return Promise.resolve(r); }
        if (m.type === 'todo/item/list') return Promise.resolve({ items: [{ uid: '1', summary: 'Kjøp melk', status: 'needs_action' }, { uid: '2', summary: 'Bytt filter', status: 'completed' }] });
        if (m.type === 'lovelace/config') return Promise.reject(new Error('yaml'));
        if (m.type === 'weather/subscribe_forecast') return Promise.resolve(() => {});
        return Promise.resolve({});
      },
      connection: { subscribeMessage: (cb, m) => { if (m.type === 'weather/subscribe_forecast') setTimeout(() => cb({ type: m.forecast_type, forecast: Array.from({ length: 24 }, (_, i) => ({ datetime: new Date(Date.now() + i * 3600000).toISOString(), temperature: 10 + Math.sin(i / 4) * 4, condition: i % 5 ? 'partlycloudy' : 'rainy', precipitation: i % 5 ? 0 : 1.2, wind_speed: 4 })) }), 10); if (m.type === 'todo/item/subscribe') setTimeout(() => cb({ items: [{ uid: '1', summary: 'Kjøp melk', status: 'needs_action' }, { uid: '2', summary: 'Bytt filter', status: 'completed' }] }), 10); return Promise.resolve(() => {}); } },
      formatEntityState: (s) => { const u = s.attributes.unit_of_measurement; return s.state + (u ? ' ' + u : ''); },
      hassUrl: (p) => p,
    };
  };
})();
