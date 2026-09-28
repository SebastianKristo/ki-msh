// Testdata for Utelys «Døgnring» (22.10): KI Utelys- og Sun-entiteter (kun test).
window.mockExtend(({ add }) => {
  const d = new Date();
  const at = (h, m) => { const x = new Date(d); x.setHours(h, m, 0, 0); if (x < d) x.setDate(x.getDate() + 1); return x.toISOString(); };
  add('switch.ki_utelys_auto', 'on', { friendly_name: 'KI Utelys automatikk' });
  add('switch.ki_utelys_kveld', 'on', { friendly_name: 'KI Utelys kveld' });
  add('switch.ki_utelys_morgen', 'off', { friendly_name: 'KI Utelys morgen' });
  add('sensor.ki_utelys_neste_paa', at(19, 34), { device_class: 'timestamp', friendly_name: 'KI Utelys neste på' });
  add('sensor.ki_utelys_neste_av', at(6, 56), { device_class: 'timestamp', friendly_name: 'KI Utelys neste av' });
  add('sensor.ki_utelys_status', 'unknown', { friendly_name: 'KI Utelys status' });
  add('number.ki_utelys_terskel_paa', 40, { min: 0, max: 500, step: 5, unit_of_measurement: 'lx', friendly_name: 'Tenn under' });
  add('number.ki_utelys_terskel_av', 120, { min: 0, max: 1000, step: 5, unit_of_measurement: 'lx', friendly_name: 'Slukk over' });
  add('number.ki_utelys_minst_morke', 20, { min: 0, max: 120, step: 5, unit_of_measurement: 'min', friendly_name: 'Minste mørketid' });
  add('sensor.sun_next_dawn', at(6, 21), { device_class: 'timestamp' });
  add('sensor.sun_next_rising', at(7, 11), { device_class: 'timestamp' });
  add('sensor.sun_next_noon', at(13, 7), { device_class: 'timestamp' });
  add('sensor.sun_next_setting', at(19, 4), { device_class: 'timestamp' });
  add('sensor.sun_next_dusk', at(19, 41), { device_class: 'timestamp' });
  add('sensor.sun_solar_elevation', -12.4, { unit_of_measurement: '°' });
  add('binary_sensor.sun_solar_rising', 'off', {});
  add('light.utelys_garasje', 'off', { supported_color_modes: ['onoff'], friendly_name: 'Utelys garasje' });
});
