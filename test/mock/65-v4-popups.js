// Testdata for Planter (#planter), Søvn (#sovn) og 3D-printer (#3d-printer) – Fiks 60.3.
// Planter: KI Planter-plantene fra 21-prosa (Arekapalme, Palmelilje) får jordfukt, mål, intervall, sist vannet, lys/temp/
// næring og «vannet»-knapp (samme prefiks); Monstera er plant.* på egen enhet med jordfukt-sensor.
// Søvn: input_boolean.<p>_sover fra 20-hjem + vekking (input_datetime med tid, på/av, ukedager) for Sebastian, vekking for
// Cybele, mobilens neste alarm for Rune. Historikk for sover-bryterne (siste 24 t).
// 3D-printer: Creality K2-enhet som skriver ut (status, fremdrift, fil, lag, tid igjen, temperaturer, kamera, lys,
// knapper, vifter, Z-offset, CFS med fire spor) + smartplugg.
window.mockExtend(({ add, S, D }) => {
  const iso = (ms) => new Date(ms).toISOString(), now = Date.now(), DAY = 86400000;
  // ---- Planter
  const pl = (b, o) => {
    add(`sensor.${b}_jordfukt`, o.moist, { unit_of_measurement: '%', device_class: 'moisture', friendly_name: `${o.name} jordfukt` });
    add(`number.${b}_min_jordfukt`, o.lo, { min: 0, max: 100, step: 1, unit_of_measurement: '%', friendly_name: `${o.name} min jordfukt` });
    add(`number.${b}_maks_jordfukt`, o.hi, { min: 0, max: 100, step: 1, unit_of_measurement: '%', friendly_name: `${o.name} maks jordfukt` });
    add(`number.${b}_intervall`, o.every, { min: 1, max: 60, step: 1, unit_of_measurement: 'd', friendly_name: `${o.name} intervall` });
    add(`sensor.${b}_sist_vannet`, iso(now - o.days * DAY), { device_class: 'timestamp', friendly_name: `${o.name} sist vannet` });
    add(`sensor.${b}_lys`, o.lux, { unit_of_measurement: 'lx', device_class: 'illuminance', friendly_name: `${o.name} lys` });
    add(`sensor.${b}_temperatur`, o.temp, { unit_of_measurement: '°C', device_class: 'temperature', friendly_name: `${o.name} temperatur` });
    add(`sensor.${b}_naering`, o.ec, { unit_of_measurement: 'µS/cm', device_class: 'conductivity', friendly_name: `${o.name} næring` });
    add(`button.${b}_vannet`, 'unknown', { friendly_name: `${o.name} vannet` });
  };
  pl('arekapalme', { name: 'Arekapalme', moist: 41, lo: 35, hi: 60, every: 7, days: 4, lux: 2400, temp: 21.4, ec: 640 });
  pl('palmelilje', { name: 'Palmelilje', moist: 53, lo: 20, hi: 45, every: 16, days: 16, lux: 3100, temp: 22.1, ec: 410 });
  if (S['binary_sensor.arekapalme_trenger_vann']) Object.assign(S['binary_sensor.arekapalme_trenger_vann'].attributes, { latin: 'Dypsis lutescens' });
  if (S['binary_sensor.palmelilje_trenger_vann']) Object.assign(S['binary_sensor.palmelilje_trenger_vann'].attributes, { latin: 'Yucca elephantipes' });
  D.dev_monstera = { id: 'dev_monstera', name: 'Monstera', manufacturer: 'Xiaomi', model: 'Mi Flora' };
  add('plant.monstera', 'problem', { friendly_name: 'Monstera', species: 'Monstera deliciosa', min_moisture: 30, max_moisture: 55 }, { platform: 'plant', device: 'dev_monstera' });
  add('sensor.monstera_moisture', 22, { unit_of_measurement: '%', device_class: 'moisture', friendly_name: 'Monstera moisture' }, { platform: 'xiaomi_ble', device: 'dev_monstera' });
  add('sensor.monstera_illuminance', 1800, { unit_of_measurement: 'lx', device_class: 'illuminance', friendly_name: 'Monstera illuminance' }, { platform: 'xiaomi_ble', device: 'dev_monstera' });
  add('sensor.monstera_temperature', 21.0, { unit_of_measurement: '°C', device_class: 'temperature', friendly_name: 'Monstera temperature' }, { platform: 'xiaomi_ble', device: 'dev_monstera' });
  add('sensor.monstera_conductivity', 520, { unit_of_measurement: 'µS/cm', device_class: 'conductivity', friendly_name: 'Monstera conductivity' }, { platform: 'xiaomi_ble', device: 'dev_monstera' });
  // sun.sun for dagslys (11,8 t)
  if (!S['sun.sun']) add('sun.sun', 'above_horizon', { next_rising: iso(now + 10 * 3600000), next_setting: iso(now + (10 + 11.8) * 3600000), friendly_name: 'Sun' });
  // ---- Søvn
  add('input_datetime.sebastian_vekking', '07:15:00', { has_date: false, has_time: true, hour: 7, minute: 15, second: 0, friendly_name: 'Sebastian vekking' });
  add('input_boolean.sebastian_vekking_aktiv', 'on', { friendly_name: 'Sebastian vekking aktiv' });
  ['man', 'tir', 'ons', 'tor', 'fre', 'lor', 'son'].forEach((d, i) => add(`input_boolean.sebastian_vekking_${d}`, i < 5 ? 'on' : 'off', { friendly_name: `Sebastian vekking ${d}` }));
  add('input_datetime.cybele_vekking', '06:30:00', { has_date: false, has_time: true, hour: 6, minute: 30, second: 0, friendly_name: 'Cybele vekking' });
  D.dev_rune_mobil = { id: 'dev_rune_mobil', name: 'Rune iPhone', manufacturer: 'Apple', model: 'iPhone' };
  add('device_tracker.rune_iphone', 'not_home', { friendly_name: 'Rune iPhone' }, { platform: 'mobile_app', device: 'dev_rune_mobil' });
  add('sensor.rune_iphone_next_alarm', iso(new Date().setHours(31, 0, 0, 0)), { device_class: 'timestamp', friendly_name: 'Rune iPhone Next alarm' }, { platform: 'mobile_app', device: 'dev_rune_mobil' });
  if (S['person.rune']) S['person.rune'].attributes.source = 'device_tracker.rune_iphone';
  // ---- 3D-printer (Creality K2)
  D.dev_k2 = { id: 'dev_k2', name: 'Creality K2', manufacturer: 'Creality', model: 'K2 Plus' };
  const k = (id, st, a) => add(id, st, a, { platform: 'ha_creality_ws', device: 'dev_k2' });
  k('sensor.creality_k2_print_status', 'printing', { friendly_name: 'Creality K2 Print status' });
  k('sensor.creality_k2_print_progress', 62, { unit_of_measurement: '%', friendly_name: 'Creality K2 Print progress' });
  k('sensor.creality_k2_print_file', 'benchy_pla.gcode', { friendly_name: 'Creality K2 Print file' });
  k('sensor.creality_k2_current_layer', 149, { friendly_name: 'Creality K2 Current layer' });
  k('sensor.creality_k2_total_layers', 240, { friendly_name: 'Creality K2 Total layers' });
  k('sensor.creality_k2_print_time_left', 23, { unit_of_measurement: 'min', device_class: 'duration', friendly_name: 'Creality K2 Print time left' });
  k('sensor.creality_k2_nozzle_temperature', 219.6, { unit_of_measurement: '°C', device_class: 'temperature', friendly_name: 'Creality K2 Nozzle temperature' });
  k('sensor.creality_k2_nozzle_target', 220, { unit_of_measurement: '°C', friendly_name: 'Creality K2 Nozzle target' });
  k('sensor.creality_k2_bed_temperature', 59.8, { unit_of_measurement: '°C', device_class: 'temperature', friendly_name: 'Creality K2 Bed temperature' });
  k('sensor.creality_k2_bed_target', 60, { unit_of_measurement: '°C', friendly_name: 'Creality K2 Bed target' });
  k('sensor.creality_k2_chamber_temperature', 37.5, { unit_of_measurement: '°C', device_class: 'temperature', friendly_name: 'Creality K2 Chamber temperature' });
  k('camera.creality_k2', 'streaming', { friendly_name: 'Creality K2 Camera' });
  k('light.creality_k2_light', 'off', { friendly_name: 'Creality K2 Light', supported_color_modes: ['onoff'] });
  k('button.creality_k2_pause', 'unknown', { friendly_name: 'Creality K2 Pause' });
  k('button.creality_k2_resume', 'unknown', { friendly_name: 'Creality K2 Resume' });
  k('button.creality_k2_stop', 'unknown', { friendly_name: 'Creality K2 Stop' });
  k('sensor.creality_k2_print_speed', 100, { unit_of_measurement: '%', friendly_name: 'Creality K2 Print speed' });
  k('sensor.creality_k2_model_fan', 80, { unit_of_measurement: '%', friendly_name: 'Creality K2 Model fan' });
  k('sensor.creality_k2_chamber_fan', 30, { unit_of_measurement: '%', friendly_name: 'Creality K2 Chamber fan' });
  k('sensor.creality_k2_z_offset', -0.04, { unit_of_measurement: 'mm', friendly_name: 'Creality K2 Z offset' });
  k('sensor.creality_k2_layer_height', 0.2, { unit_of_measurement: 'mm', friendly_name: 'Creality K2 Layer height' });
  k('sensor.creality_k2_cfs_temperature', 24, { unit_of_measurement: '°C', device_class: 'temperature', friendly_name: 'Creality K2 CFS temperature' });
  k('sensor.creality_k2_cfs_humidity', 31, { unit_of_measurement: '%', device_class: 'humidity', friendly_name: 'Creality K2 CFS humidity' });
  [['PLA', 'Hvit', '#ecebe6', 78, true], ['PLA', 'Svart', '#2b2b2e', 41], ['PETG', 'Oransje', '#e8823a', 63], ['PLA Silk', 'Gull', '#d9b45a', 12]].forEach(([type, col, hex, pct, act], i) => // ki-hex-ok: filamentfarger (test)
    k(`sensor.creality_k2_cfs_slot_${i + 1}`, pct, { unit_of_measurement: '%', type, color_name: col, color_hex: hex, weight: pct * 10, active: !!act, friendly_name: `Creality K2 CFS slot ${i + 1}` }));
  D.dev_k2_plug = { id: 'dev_k2_plug', name: '3D-printer plugg', manufacturer: 'Shelly' };
  add('switch.3d_printer_plugg', 'on', { friendly_name: '3D-printer plugg' }, { platform: 'shelly', device: 'dev_k2_plug' });
});
(function () {
  const orig = window.mockHass;
  window.mockHass = function () {
    const h = orig();
    const ws = h.callWS;
    h.callWS = (m) => {
      const ids = Array.isArray(m.entity_ids) ? m.entity_ids : [];
      if (m.type === 'history/history_during_period' && ids.length && ids.every((id) => /_sover$/.test(id))) {
        window.__calls.push(['ws', m.type, m]);
        const t0 = Date.now() / 1000 - 86400, out = {};
        ids.forEach((id, i) => { out[id] = [{ s: 'off', lu: t0 }, { s: 'on', lu: t0 + (2 + i * 0.4) * 3600 }, { s: 'off', lu: t0 + (9.5 + i * 0.6) * 3600 }]; });
        return Promise.resolve(out);
      }
      return ws(m);
    };
    return h;
  };
})();
