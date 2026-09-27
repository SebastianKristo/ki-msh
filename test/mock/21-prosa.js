// Fiks 17.9 · testdata for prosa-seksjonene (brukerens standard-config) og KI Planter (platform ki_planter).
window.mockExtend(({ add, D }) => {
  add('sensor.dashboard_index', 'ok', { friendly_name: 'Dashboard-indeks', weather: 'Delvis skyet og 12', current: { icon: 'mdi:weather-partly-cloudy' } });
  add('input_select.vaskemaskin_status', 'Vasker', { friendly_name: 'Vaskemaskin status', options: ['Av', 'Vasker', 'Ferdig'] });
  add('sensor.vaskemaskin_power', 1180, { friendly_name: 'Vaskemaskin effekt', unit_of_measurement: 'W', device_class: 'power' });
  add('sensor.norgespris_total_strompris_norgespris', 1.16, { friendly_name: 'Norgespris total', unit_of_measurement: 'kr/kWh' });
  add('input_boolean.ki_cybele_pa_vei_hjem_fra_jobb', 'on', { friendly_name: 'Cybele på vei hjem' });
  add('sensor.cybele_reisetid_fra_job', 18, { friendly_name: 'Cybele reisetid', unit_of_measurement: 'min' });
  add('binary_sensor.vis_bursdagskort', 'off', { friendly_name: 'Vis bursdagskort' });
  add('input_boolean.ki_ringeklokke_varsel_aktiv', 'off', { friendly_name: 'Ringeklokke varsel' });
  // KI Planter v1.4.0 – ett sted («Hjemme») med to planter som trenger vann
  if (D) D.dev_planter_hjemme = { id: 'dev_planter_hjemme', name: 'Hjemme planter', area_id: null };
  const kp = { platform: 'ki_planter', device: 'dev_planter_hjemme' };
  add('sensor.hjemme_planter_trenger_vann', 2, { friendly_name: 'Hjemme planter Trenger vann', unit_of_measurement: 'stk', integrasjon: 'ki_planter', type: 'sted', sted: 'Hjemme', planter: ['Arekapalme', 'Palmelilje', 'Monstera'], trenger_vann: ['Arekapalme', 'Palmelilje'], trenger_vann_tekst: 'Arekapalme og Palmelilje', testvisning: false }, kp);
  add('button.hjemme_planter_alle_vannet', 'unknown', { friendly_name: 'Hjemme planter Alle vannet' }, kp);
  add('switch.hjemme_planter_testvisning', 'off', { friendly_name: 'Hjemme planter Testvisning' }, kp);
  add('binary_sensor.arekapalme_trenger_vann', 'on', { friendly_name: 'Arekapalme trenger vann', integrasjon: 'ki_planter', type: 'plante', navn: 'Arekapalme', ikon: 'mdi:palm-tree', sted: 'Hjemme' }, { platform: 'ki_planter' });
  add('binary_sensor.palmelilje_trenger_vann', 'on', { friendly_name: 'Palmelilje trenger vann', integrasjon: 'ki_planter', type: 'plante', navn: 'Palmelilje', ikon: 'mdi:flower', sted: 'Hjemme' }, { platform: 'ki_planter' });
});
