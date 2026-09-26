// Testdata for Lys-popupen (kun test).
window.mockExtend(({ add }) => {
  const d = new Date();
  const at = (h, m, addDay) => { const x = new Date(d); x.setHours(h, m, 0, 0); if (addDay || x < d) x.setDate(x.getDate() + 1); return x.toISOString(); };
  add('sun.sun', 'below_horizon', { next_setting: at(19, 4), next_rising: at(7, 11), next_dusk: at(19, 41), friendly_name: 'Sol' });
  add('light.verandalampe', 'on', { brightness: 204, supported_color_modes: ['brightness'], friendly_name: 'Verandalampe' }, { area: 'hage' });
  add('light.utelys_inngang', 'on', { brightness: 153, supported_color_modes: ['brightness'], friendly_name: 'Utelys inngang', icon: 'mdi:wall-sconce' });
  add('light.gang_tak', 'on', { brightness: 51, supported_color_modes: ['brightness'], friendly_name: 'Gang tak' }, { area: 'gang' });
  add('light.gang_speil', 'off', { supported_color_modes: ['onoff'], friendly_name: 'Gang speil' }, { area: 'gang' });
  add('light.bad_tak', 'off', { supported_color_modes: ['brightness'], friendly_name: 'Bad tak' }, { area: 'bad' });
  add('light.soverom_nattbord', 'off', { supported_color_modes: ['color_temp'], friendly_name: 'Soverom nattbord' }, { area: 'soverom' });
  add('sensor.hage_lysniva', 35, { unit_of_measurement: 'lx', device_class: 'illuminance', friendly_name: 'Ute lysnivå' }, { area: 'hage' });
  add('input_boolean.utelys_automatikk', 'on', { friendly_name: 'Utelys automatikk' });
});
