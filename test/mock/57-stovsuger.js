// Testdata for Sir Sweeps (#rolf, msh-stovsuger-card, fiks 24.9): brukerens oppsett fra dagens #rolf-YAML
// (vacuum.sir_sweeps_a_lot + batteri/lader/vanntank/kart, rom som input_boolean, sone-skript, vedlikehold).
// Bare test – kortet har aldri mock-data.
(function () {
  window.mockExtend(({ add }) => {
    const o = 'sir_sweeps_a_lot';
    add('vacuum.' + o, 'docked', { friendly_name: 'Sir Sweeps a lot', battery_level: 87, fan_speed: 'balanced', fan_speed_list: ['quiet', 'balanced', 'turbo', 'max'] }, { platform: 'roborock', device: 'dev_sweeps' });
    add('sensor.' + o + '_battery', 87, { friendly_name: 'Sir Sweeps batteri', unit_of_measurement: '%', device_class: 'battery' }, { platform: 'roborock' });
    add('binary_sensor.' + o + '_charging', 'on', { friendly_name: 'Sir Sweeps lader', device_class: 'battery_charging' }, { platform: 'roborock' });
    add('binary_sensor.' + o + '_water_shortage', 'on', { friendly_name: 'Sir Sweeps vannmangel', device_class: 'problem' }, { platform: 'roborock' });
    add('image.' + o + '_hjemme_andre_etasje', '2026-09-30T08:00:00', { friendly_name: 'Hjemme andre etasje', entity_picture: '/api/image_proxy/image.sir_sweeps_a_lot_hjemme_andre_etasje?token=x' }, { platform: 'roborock' });
    [['sebsatian_soverom', 'on'], ['pappa_kontor', 'off'], ['pappa_soverom', 'on'], ['trappegang', 'off'], ['mamma_soverom', 'off']].forEach(([k, s]) => add('input_boolean.' + o + '_' + k, s, { friendly_name: 'Sir Sweeps ' + k.replace(/_/g, ' ') }));
    add('sensor.rolf_all', 'True', { friendly_name: 'Rolf alle' });
    ['start_sir_sweeps_a_lot_room_select', 'stovsuger_pause', 'stovsuger_start', 'stovsuger_retuner_hjem', 'rolf_empty', 'cycle_vacuum_fan_speed'].forEach((k) => add('script.' + k, 'off', { friendly_name: k }));
    [['stuebord', 'Spisebord lite'], ['stuebord_mye', 'Spisebord mye'], ['stue_uten_spisebord', 'Stue uten spisebord'], ['teppe', 'Teppe stue'], ['kjokkenbord', 'Kjøkkenbord']].forEach(([k, n]) => add('script.rolf_zone_' + k, 'off', { friendly_name: 'Rolf ' + n }));
    add('input_select.vacuum_fan_speed', 'Standard', { friendly_name: 'Moppmodus', options: ['Av', 'Lav', 'Standard', 'Høy'] });
    // 47 L2: moppvalg = select.* på robotens enhet (device_id) – ikke input_select-hjelperen over
    add('select.' + o + '_mop_mode', 'standard', { friendly_name: 'Sir Sweeps a lot Mop mode', options: ['standard', 'deep', 'deep_plus', 'custom'] }, { platform: 'roborock', device: 'dev_sweeps' });
    add('select.' + o + '_mop_intensity', 'moderate', { friendly_name: 'Sir Sweeps a lot Mop intensity', options: ['off', 'mild', 'moderate', 'intense'] }, { platform: 'roborock', device: 'dev_sweeps' });
    add('sensor.' + o + '_total_cleaning_area', 2531.4, { friendly_name: 'Totalt rengjort areal', unit_of_measurement: 'm²' }, { platform: 'roborock' });
    add('sensor.' + o + '_total_cleaning_time', '187:30', { friendly_name: 'Total rengjøringstid' }, { platform: 'roborock' });
    [['main_brush', 212], ['side_brush', 96], ['filter', 18], ['sensor', 4]].forEach(([k, v]) => add('sensor.' + o + '_' + k + '_time_left', v, { friendly_name: k, unit_of_measurement: 'h' }, { platform: 'roborock' }));
    add('button.' + o + '_nullstill_filter', 'unknown', { friendly_name: 'Nullstill filter' }, { platform: 'roborock' });
    add('button.' + o + '_nullstill_sensor', 'unknown', { friendly_name: 'Nullstill sensorer' }, { platform: 'roborock' });
  });
})();
