// KI Rom-attributter i andre formater: tall og entity_id-streng; tom scene-liste (→ HA-område som reserve).
window.mockExtend(({ add, areas }) => {
  add('sensor.bad_fukt', 64, { unit_of_measurement: '%', device_class: 'humidity', friendly_name: 'Bad fukt' }, { area: 'bad' });
  add('sensor.bad_aqara_temperatur', 23.0, { unit_of_measurement: '°C', device_class: 'temperature', friendly_name: 'Bad Aqara' }, { area: 'bad' });
  add('scene.bad_morgen', 'unknown', { friendly_name: 'Bad Morgen' }, { area: 'bad' });
  add('script.bad_vifte_boost', 'off', { friendly_name: 'Bad Vifte boost', icon: 'mdi:fan-plus' }, { area: 'bad' });
  add('sensor.bad_oversikt', 3, { integrasjon: 'ki_rom', area_id: 'bad', temperatur: 22.5, fuktighet: 'sensor.bad_fukt', scener: [], skript: [], lys: [] }, { platform: 'ki_rom' });
});
