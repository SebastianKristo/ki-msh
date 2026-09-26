// Testdata for msh-rom-card (kun test). Soverom uten KI Rom (HA-registre, strøm via enhet), tomt rom «bod».
window.mockExtend(({ add, areas, D }) => {
  areas.bod = { area_id: 'bod', name: 'Bod', icon: 'mdi:archive', floor_id: 'forste', picture: null };
  D.dev_soverom_lader = { id: 'dev_soverom_lader', area_id: 'soverom', name: 'Lader' };
  add('cover.soverom_seng_rullegardin', 'closed', { current_position: 0, friendly_name: 'Soverom seng rullegardin', supported_features: 15 }, { area: 'soverom' });
  add('cover.soverom_rullegardin', 'open', { current_position: 40, friendly_name: 'Soverom rullegardin', supported_features: 15 }, { area: 'soverom' });
  add('light.soverom_nattbord', 'on', { friendly_name: 'Soverom nattbord', supported_color_modes: ['onoff'], color_mode: 'onoff' }, { area: 'soverom' });
  add('switch.soverom_lader', 'on', { friendly_name: 'Lader' }, { device: 'dev_soverom_lader' });
  add('sensor.soverom_lader_power', 18, { unit_of_measurement: 'W', device_class: 'power', friendly_name: 'Lader effekt' }, { device: 'dev_soverom_lader' });
  add('binary_sensor.soverom_vindu', 'on', { device_class: 'window', friendly_name: 'Soverom vindu' }, { area: 'soverom' });
  add('scene.soverom_natt', 'unknown', { friendly_name: 'Soverom natt' }, { area: 'soverom' });
});
