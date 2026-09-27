// Testdata for fiks 16.5/16.8 (Rom → Enheter/Klima), kun test: soverom får en aktiv oppvaskmaskin (1800 W), en
// vaskemaskin som hviler (9 W), en ståvifte med hastighet (percentage/percentage_step) og en panelovn som varmer (800 W).
window.mockExtend(({ add }) => {
  const P = { unit_of_measurement: 'W', device_class: 'power' };
  add('switch.soverom_oppvaskmaskin', 'on', { friendly_name: 'Oppvaskmaskin' }, { area: 'soverom' });
  add('sensor.soverom_oppvaskmaskin_power', 1800, { ...P, friendly_name: 'Oppvaskmaskin effekt' }, { area: 'soverom' });
  add('switch.soverom_vaskemaskin', 'on', { friendly_name: 'Vaskemaskin' }, { area: 'soverom' });
  add('sensor.soverom_vaskemaskin_power', 9, { ...P, friendly_name: 'Vaskemaskin effekt' }, { area: 'soverom' });
  add('fan.soverom_stavifte', 'on', { friendly_name: 'Ståvifte', percentage: 50, percentage_step: 25, supported_features: 1 }, { area: 'soverom' });
  add('climate.soverom_ovn', 'heat', { friendly_name: 'Panelovn', temperature: 22, current_temperature: 21, current_humidity: 82, hvac_action: 'heating', hvac_modes: ['off', 'heat'], min_temp: 5, max_temp: 30, target_temp_step: 0.5 }, { area: 'soverom' });
  add('sensor.soverom_ovn_power', 800, { ...P, friendly_name: 'Panelovn effekt' }, { area: 'soverom' });
});
