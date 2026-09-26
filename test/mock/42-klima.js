// Testdata for Klima-popupen (kun test).
window.mockExtend(({ add }) => {
  add('climate.bad_gulvvarme', 'heat', { temperature: 22, current_temperature: 22.1, hvac_modes: ['off', 'heat', 'auto'], hvac_action: 'idle', preset_modes: ['none', 'eco', 'comfort'], preset_mode: 'comfort', min_temp: 5, max_temp: 35, target_temp_step: 0.5, friendly_name: 'Bad gulvvarme' }, { area: 'bad' });
  add('climate.kjokken_panelovn', 'off', { temperature: 19, current_temperature: 22.0, hvac_modes: ['off', 'heat'], hvac_action: 'off', min_temp: 5, max_temp: 30, friendly_name: 'Kjøkken panelovn' }, { area: 'kjokken' });
  add('climate.trapp', 'heat', { temperature: 19, current_temperature: 23.0, hvac_modes: ['off', 'heat'], hvac_action: 'heating', friendly_name: 'Trappegang' });
  add('input_boolean.bortemodus', 'on', { friendly_name: 'Bortemodus' });
  add('input_boolean.sommermodus', 'off', { friendly_name: 'Sommermodus' });
  add('input_boolean.hjemkomst', 'off', { friendly_name: 'Hjemkomst' });
  add('input_boolean.leggetid_sebastian', 'off', { friendly_name: 'Sebastian' }, { area: 'soverom' });
  add('input_boolean.leggetid_cybele', 'on', { friendly_name: 'Cybele' });
  add('water_heater.bereder', 'eco', { current_temperature: 64, temperature: 70, operation_list: ['off', 'eco', 'performance'], operation_mode: 'eco', friendly_name: 'Bereder' });
  add('switch.bereder_prisstyring', 'on', { friendly_name: 'VVB prisstyring' });
  add('switch.bereder_legionellasikring', 'on', { friendly_name: 'Legionellasikring' });
  add('sensor.bereder_legionella', 0.4, { unit_of_measurement: 'd', friendly_name: 'Legionella siden sist' });
  add('switch.bad_handklevarmer', 'on', { friendly_name: 'Håndklevarmer' }, { area: 'bad' });
  add('sensor.handklevarmer_effekt', 45, { unit_of_measurement: 'W', device_class: 'power', friendly_name: 'Håndklevarmer effekt' }, { area: 'bad' });
  add('number.effektgrense', 5.5, { unit_of_measurement: 'kWh', min: 1, max: 20, step: 0.1, friendly_name: 'Effektgrense' });
  add('number.klima_reserve', 0.3, { unit_of_measurement: 'kWh', friendly_name: 'Reserve mot neste trinn' });
  add('sensor.strom_denne_time', 0.31, { unit_of_measurement: 'kWh', device_class: 'energy', friendly_name: 'Forbruk denne time' });
  add('input_datetime.klima_dag_start', '06:30:00', { has_date: false, has_time: true, friendly_name: 'Dag starter' });
  add('input_number.klima_komfortvekt', 60, { friendly_name: 'Komfortvekt' });
  add('input_boolean.klima_motor', 'on', { friendly_name: 'Motoren styrer ovnene' });
  add('automation.klima_varsel_effekt', 'on', { friendly_name: 'Varsel ved effektgrense' });
  add('sensor.ki_sparer_varme', 15, { unit_of_measurement: 'kr', friendly_name: 'Sparing varmestyring' });
  add('sensor.ki_sparer_bereder', 13, { unit_of_measurement: 'kr', friendly_name: 'Sparing bereder' });
});
