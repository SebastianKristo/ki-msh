// Testdata for Varmepumpe (#varmepumpe, msh-varmepumpe-card, fiks 26.20): en NIBE F730 CU 3x400V («Vaskerom NIBE») via myUplink,
// med entitets-ID-er som i HA (navn + parameter-ID-suffiks, f.eks. sensor.vaskerom_nibe_hot_water_top_bt7_40013), select/number/
// switch-entiteter, GP1-pumpe, varsler, tilkobling, fastvare og kostnadssensorer (template, utenfor enheten). Bare test – aldri i kortet.
window.mockExtend(({ add, D }) => {
  const DEV = 'dev_nibe_f730';
  D[DEV] = { id: DEV, name: 'Vaskerom NIBE', name_by_user: null, model: 'F730 CU 3x400V', manufacturer: 'NIBE', config_entries: ['ce_myuplink'], area_id: null, sw_version: '9689R4' };
  const N = (id, st, at, cat) => add(id, st, at, { platform: 'myuplink', device: DEV, category: cat || null });
  const T = { unit_of_measurement: '°C', device_class: 'temperature', state_class: 'measurement' };
  const P = 'vaskerom_nibe_';
  // temperaturer (BT-givere)
  [['current_outd_temp_bt1_40004', -3.2, 'Current outd temp (BT1)'], ['average_outdoor_temp_bt1_40067', -1.8, 'Average outdoor temp (BT1)'],
    ['hot_water_top_bt7_40013', 48.6, 'Hot water top (BT7)'], ['hot_water_charging_bt6_40014', 44.1, 'Hot water charging (BT6)'],
    ['supply_line_bt2_40008', 34.5, 'Supply line (BT2)'], ['return_line_bt3_40012', 29.8, 'Return line (BT3)'], ['room_temperature_bt50_40033', 21.3, 'Room temperature (BT50)'],
    ['exhaust_air_bt20_40025', 22.4, 'Exhaust air (BT20)'], ['extract_air_bt21_40026', 6.1, 'Extract air (BT21)'], ['calculated_supply_climate_system_1_43009', 35.2, 'Calculated supply climate system 1'],
    ['indoor_temperature_50225', 21.3, 'Indoor temperature'], ['indoor_setpoint_50233', 21.0, 'Indoor setpoint'], ['hot_water_temperature_50325', 47.9, 'Hot water temperature'],
  ].forEach(([o, v, n]) => N('sensor.' + P + o, v, { ...T, friendly_name: 'Vaskerom NIBE ' + n }));
  [['suction_gas_bt17_40022', -8.4, 'Suction gas (BT17)'], ['hot_gas_bt14_40018', 78.2, 'Hot gas (BT14)'], ['liquid_line_bt15_40019', 31.6, 'Liquid line (BT15)'],
    ['evaporator_bt16_40020', -6.9, 'Evaporator (BT16)'], ['condenser_bt12_40017', 36.4, 'Condenser (BT12)'], ['inverter_temperature_43140', 41.0, 'Inverter temperature'], ['oil_temperature_ep15_bt29_40146', 45.3, 'Oil temperature']]
    .forEach(([o, v, n]) => N('sensor.' + P + o, v, { ...T, friendly_name: 'Vaskerom NIBE ' + n }, 'diagnostic'));
  // kompressor, drift og strøm
  const Hz = { unit_of_measurement: 'Hz', device_class: 'frequency', state_class: 'measurement' };
  N('sensor.' + P + 'current_compressor_frequency_41778', 52, { ...Hz, friendly_name: 'Vaskerom NIBE Current compressor frequency' });
  N('sensor.' + P + 'min_compressor_frequency_43122', 20, { ...Hz, friendly_name: 'Vaskerom NIBE Allowed compr. freq. min' }, 'diagnostic');
  N('sensor.' + P + 'max_compressor_frequency_43123', 120, { ...Hz, friendly_name: 'Vaskerom NIBE Allowed compr. freq. max' }, 'diagnostic');
  N('sensor.' + P + 'status_50095', 'Varme', { friendly_name: 'Vaskerom NIBE Status', device_class: 'enum' });
  N('sensor.' + P + 'compressor_status_43427', 'Går', { friendly_name: 'Vaskerom NIBE Compressor status', device_class: 'enum' }, 'diagnostic');
  N('sensor.' + P + 'degree_minutes_40941', -312, { unit_of_measurement: 'DM', friendly_name: 'Vaskerom NIBE Degree minutes' });
  N('sensor.' + P + 'total_operating_time_compressor_43420', 18432, { unit_of_measurement: 'h', device_class: 'duration', friendly_name: 'Vaskerom NIBE Tot. op.time compr.' }, 'diagnostic');
  N('sensor.' + P + 'compressor_starts_43416', 9124, { state_class: 'total_increasing', friendly_name: 'Vaskerom NIBE Compressor starts' }, 'diagnostic');
  N('sensor.' + P + 'defrosting_time_43066', 1843, { unit_of_measurement: 'min', device_class: 'duration', friendly_name: 'Vaskerom NIBE Defrosting time' }, 'diagnostic');
  N('sensor.' + P + 'time_factor_add_heat_43081', 312.4, { unit_of_measurement: 'h', friendly_name: 'Vaskerom NIBE Time factor add heat' }, 'diagnostic');
  N('sensor.' + P + 'int_el_add_heat_49993', 0, { unit_of_measurement: 'kW', friendly_name: 'Vaskerom NIBE Int. el.add. heat' });
  const A = { unit_of_measurement: 'A', device_class: 'current', state_class: 'measurement' };
  [['current_be1_40083', 6.2, 'BE1'], ['current_be2_40081', 5.8, 'BE2'], ['current_be3_40079', 6.4, 'BE3']].forEach(([o, v, n]) => N('sensor.' + P + o, v, { ...A, friendly_name: 'Vaskerom NIBE Current (' + n + ')' }, 'diagnostic'));
  N('sensor.' + P + 'current_power', 1.24, { unit_of_measurement: 'kW', device_class: 'power', state_class: 'measurement', friendly_name: 'Vaskerom NIBE Effekt' });
  N('sensor.' + P + 'internal_addition_power', 0, { unit_of_measurement: 'kW', device_class: 'power', state_class: 'measurement', friendly_name: 'Vaskerom NIBE Internal addition power' });
  N('sensor.' + P + 'energy', 18234.6, { unit_of_measurement: 'kWh', device_class: 'energy', state_class: 'total_increasing', friendly_name: 'Vaskerom NIBE Energi' });
  // varmtvann
  N('sensor.' + P + 'hot_water_charge_set_value_43116', 50.0, { ...T, friendly_name: 'Vaskerom NIBE Charge set value' }, 'diagnostic');
  N('sensor.' + P + 'hot_water_amount_50345', 72, { unit_of_measurement: '%', friendly_name: 'Vaskerom NIBE Hot water amount' });
  N('sensor.' + P + 'hot_water_share_43239', 31, { unit_of_measurement: '%', friendly_name: 'Vaskerom NIBE Hot water share' }, 'diagnostic');
  N('sensor.' + P + 'operating_time_hot_water_43424', 5211, { unit_of_measurement: 'h', device_class: 'duration', friendly_name: 'Vaskerom NIBE Op. time hot water' }, 'diagnostic');
  N('sensor.' + P + 'hot_water_mode_43109', 'Normal', { friendly_name: 'Vaskerom NIBE Hot water mode' });
  N('sensor.' + P + 'next_periodic_increase', new Date(Date.now() + 3 * 86400000).toISOString(), { device_class: 'timestamp', friendly_name: 'Vaskerom NIBE Next periodic increase' });
  // luft
  N('sensor.' + P + 'fan_speed_50221', 60, { unit_of_measurement: '%', friendly_name: 'Vaskerom NIBE Fan speed' });
  N('sensor.' + P + 'air_flow_bs1_42782', 198, { unit_of_measurement: 'm³/h', friendly_name: 'Vaskerom NIBE Air flow (BS1)' });
  N('sensor.' + P + 'fan_mode_43108', 'Normal', { friendly_name: 'Vaskerom NIBE Fan mode' });
  N('sensor.' + P + 'gp1_speed_43437', 38, { unit_of_measurement: '%', friendly_name: 'Vaskerom NIBE GP1 speed' }, 'diagnostic');
  // styring
  N('select.' + P + 'operating_mode_47137', 'Auto', { options: ['Auto', 'Manual', 'Add. heat only'], friendly_name: 'Vaskerom NIBE Operating mode' }, 'config');
  N('select.' + P + 'smart_home_mode', 'Default', { options: ['Default', 'Away', 'Vacation'], friendly_name: 'Vaskerom NIBE Smart home mode' });
  N('select.' + P + 'hot_water_demand_47041', 'Medium', { options: ['Small', 'Medium', 'Large'], friendly_name: 'Vaskerom NIBE Hot water demand' }, 'config');
  N('select.' + P + 'temporary_lux_48132', 'Off', { options: ['Off', 'One-time increase', '3 hours', '6 hours', '12 hours'], friendly_name: 'Vaskerom NIBE Temporary lux' }, 'config');
  const NUMA = (min, max, step, unit) => ({ min, max, step, mode: 'box', ...(unit ? { unit_of_measurement: unit } : {}) });
  N('number.' + P + 'heating_curve_47007', 7, { ...NUMA(0, 15, 1), friendly_name: 'Vaskerom NIBE Heating curve' }, 'config');
  N('number.' + P + 'heating_offset_47011', -1, { ...NUMA(-10, 10, 1), friendly_name: 'Vaskerom NIBE Heating offset' }, 'config');
  N('number.' + P + 'target_temperature_room', 21, { ...NUMA(5, 30, 0.5, '°C'), friendly_name: 'Vaskerom NIBE Target temperature room' }, 'config');
  N('number.' + P + 'start_compressor_gm_47206', -60, { ...NUMA(-1000, -30, 10, 'DM'), friendly_name: 'Vaskerom NIBE Start compressor' }, 'config');
  N('number.' + P + 'stop_heating_47375', 17, { ...NUMA(-20, 40, 1, '°C'), friendly_name: 'Vaskerom NIBE Stop heating' }, 'config');
  N('switch.' + P + 'temporary_lux_50004', 'off', { friendly_name: 'Vaskerom NIBE Temporary lux' });
  N('switch.' + P + 'increased_ventilation_50005', 'off', { friendly_name: 'Vaskerom NIBE Increased ventilation' });
  N('switch.' + P + 'night_cooling_47537', 'off', { friendly_name: 'Vaskerom NIBE Night cooling' }, 'config');
  N('binary_sensor.' + P + 'pump_gp1_49995', 'on', { device_class: 'running', friendly_name: 'Vaskerom NIBE Pump: Heating medium (GP1)' });
  N('binary_sensor.' + P + 'tilkoblingstilstand', 'on', { device_class: 'connectivity', friendly_name: 'Vaskerom NIBE Tilkoblingstilstand' }, 'diagnostic');
  N('sensor.' + P + 'varsler', 0, { friendly_name: 'Vaskerom NIBE Varsler' });
  N('update.' + P + 'fastvare', 'off', { installed_version: '9689R4', latest_version: '9689R4', friendly_name: 'Vaskerom NIBE Fastvare' }, 'config');
  // kostnad (template-sensorer utenfor enheten)
  const kr = (o, v, n) => add('sensor.' + P + o, v, { unit_of_measurement: 'NOK', device_class: 'monetary', friendly_name: 'Vaskerom NIBE ' + n }, { platform: 'template' });
  kr('hourly_energy_cost', 1.12, 'Kostnad denne timen'); kr('daily_energy_cost', 14.82, 'Kostnad i dag'); kr('monthly_energy_cost', 412.5, 'Kostnad denne måneden'); kr('yearly_energy_cost', 6904, 'Kostnad i år');
});
