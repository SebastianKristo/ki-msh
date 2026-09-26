// Testdata for Hjem-faner og romkort: batterier, apparater (oppvask/vask), garasjeport, støvsuger, TV, fukt på bad, rom uten etasje.
window.mockExtend(({ add, areas, D, E }) => {
  areas.garasje = { area_id: 'garasje', name: 'Garasje', icon: 'mdi:garage', floor_id: null, picture: null };
  // Batterier (device_class battery, typisk entity_category diagnostic)
  D.dev_dorlas = { id: 'dev_dorlas', name: 'Dørlås inngang', area_id: 'gang' };
  D.dev_bevegelse = { id: 'dev_bevegelse', name: 'Bevegelse stue', area_id: 'stue' };
  D.dev_vindu = { id: 'dev_vindu', name: 'Vindu soverom', area_id: 'soverom' };
  D.dev_roykvarsler = { id: 'dev_roykvarsler', name: 'Røykvarsler gang', area_id: 'gang' };
  if (E['lock.inngangsdor']) E['lock.inngangsdor'].device_id = 'dev_dorlas';
  if (E['binary_sensor.stue_bevegelse']) E['binary_sensor.stue_bevegelse'].device_id = 'dev_bevegelse';
  add('sensor.dorlas_batteri', 78, { unit_of_measurement: '%', device_class: 'battery', friendly_name: 'Dørlås batteri' }, { device: 'dev_dorlas', category: 'diagnostic' });
  add('sensor.bevegelse_stue_batteri', 12, { unit_of_measurement: '%', device_class: 'battery', friendly_name: 'Bevegelse stue batteri' }, { device: 'dev_bevegelse', category: 'diagnostic' });
  add('sensor.vindu_soverom_batteri', 8, { unit_of_measurement: '%', device_class: 'battery', friendly_name: 'Vindu soverom batteri' }, { device: 'dev_vindu', category: 'diagnostic' });
  add('binary_sensor.vindu_soverom', 'off', { device_class: 'window', friendly_name: 'Vindu soverom' }, { device: 'dev_vindu' });
  add('sensor.roykvarsler_gang_batteri', 91, { unit_of_measurement: '%', device_class: 'battery', friendly_name: 'Røykvarsler gang batteri' }, { device: 'dev_roykvarsler', category: 'diagnostic' });
  add('binary_sensor.fjernkontroll_batteri_lavt', 'on', { device_class: 'battery', friendly_name: 'Fjernkontroll TV batteri' }, { area: 'stue', category: 'diagnostic' });
  // Apparater
  add('sensor.oppvaskmaskin_status', 'Kjører', { friendly_name: 'Oppvaskmaskin status' }, { area: 'kjokken' });
  add('sensor.oppvaskmaskin_gjenstaende_tid', 42, { unit_of_measurement: 'min', friendly_name: 'Oppvaskmaskin gjenstående tid' }, { area: 'kjokken' });
  add('sensor.oppvaskmaskin_program', 'Eco 50°', { friendly_name: 'Oppvaskmaskin program' }, { area: 'kjokken' });
  add('sensor.vaskemaskin_status', 'Ferdig', { friendly_name: 'Vaskemaskin status' }, { area: 'bad' });
  add('sensor.vaskemaskin_program', 'Bomull 40°', { friendly_name: 'Vaskemaskin program' }, { area: 'bad' });
  // Garasjeport, støvsuger, TV
  add('cover.garasjeport', 'closed', { device_class: 'garage', friendly_name: 'Garasjeport', supported_features: 3 }, { area: 'garasje' });
  add('sensor.garasje_temperatur', 9.2, { unit_of_measurement: '°C', device_class: 'temperature' }, { area: 'garasje' });
  add('vacuum.sir_sweeps', 'cleaning', { friendly_name: 'Sir Sweeps', battery_level: 62 }, { area: 'stue' });
  // Fukt på bad (gir «!»-varsel) og dør åpen i gang
  add('sensor.bad_fuktighet', 72, { unit_of_measurement: '%', device_class: 'humidity' }, { area: 'bad' });
  add('sensor.bad_temperatur', 23.6, { unit_of_measurement: '°C', device_class: 'temperature' }, { area: 'bad' });
  add('binary_sensor.gang_ytterdor', 'on', { device_class: 'door', friendly_name: 'Ytterdør' }, { area: 'gang' });
});
