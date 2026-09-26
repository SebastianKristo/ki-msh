// Testdata for Hjem-kortene (header, prosa, søppel, gjøremål).
window.mockExtend(({ add }) => {
  add('zone.jobb', 0, { friendly_name: 'Jobb', icon: 'mdi:briefcase', latitude: 59.9, longitude: 10.7, radius: 100 });
  add('zone.hytta', 0, { friendly_name: 'Hytta', icon: 'mdi:home-variant', latitude: 60.8, longitude: 10.6, radius: 200 });
  add('person.rune', 'Jobb', { friendly_name: 'Rune', entity_picture: '' });
  add('input_boolean.sebastian_sover', 'off', { friendly_name: 'Sebastian sover' });
  add('input_boolean.cybele_sover', 'on', { friendly_name: 'Cybele sover' });
  add('input_boolean.kiosk_mode', 'off', { friendly_name: 'Kiosk-modus' });
  add('calendar.familie', 'off', { friendly_name: 'Familie', message: 'Tannlege' });
  add('sensor.soppel_type', 'Restavfall', { friendly_name: 'Søppel type', types: ['Restavfall', 'Plastavfall'] });
});
