// Testdata for Hjem-containeren og strømpriskortet: pris-sensor med timespriser i dag/i morgen, kostnadssensorer som
// IKKE skal velges som pris (82,72 kr-feilen), og KI Rom-rom der temperatur/fuktighet er tall, entity_id-streng eller liste.
window.mockExtend(({ add, areas }) => {
  const d0 = new Date(); d0.setHours(0, 0, 0, 0);
  const SPOT = [62, 58, 55, 54, 56, 68, 118, 142, 138, 125, 110, 98, 92, 88, 90, 104, 128, 156, 188, 204, 176, 140, 112, 86].map((v) => v / 100);
  const TMR = [70, 66, 63, 61, 64, 74, 102, 121, 115, 104, 96, 90, 86, 84, 88, 97, 112, 131, 149, 158, 139, 118, 98, 80].map((v) => v / 100);
  const price = (sp) => Math.round((sp * 1.25 + 0.45 - Math.max(0, (sp - 0.75) * 0.9) * 1.25) * 1000) / 1000;
  const raw = (arr, day) => arr.map((v, h) => ({ start: new Date(d0.getTime() + (day * 24 + h) * 3600000).toISOString(), end: new Date(d0.getTime() + (day * 24 + h + 1) * 3600000).toISOString(), value: price(v) }));
  const now = price(SPOT[new Date().getHours()]);
  // Kostnad/energi fra samme plattformer – sorteres FØR pris-sensoren og skal aldri velges som pris
  add('sensor.nordpool_kostnad_i_dag', 82.72, { unit_of_measurement: 'NOK', device_class: 'monetary', friendly_name: 'Strømkostnad i dag' }, { platform: 'nordpool' });
  add('sensor.tibber_akkumulert_kostnad', 82.72, { unit_of_measurement: 'NOK', device_class: 'monetary', friendly_name: 'Akkumulert kostnad' }, { platform: 'tibber' });
  add('sensor.tibber_akkumulert_forbruk', 31.4, { unit_of_measurement: 'kWh', device_class: 'energy', friendly_name: 'Akkumulert forbruk' }, { platform: 'tibber' });
  // Pris-sensoren (erstatter den enkle i mock-hass.js): nåpris + raw_today/raw_tomorrow ({start,end,value}) og tall-lister
  add('sensor.nordpool_kwh', now, { unit_of_measurement: 'NOK/kWh', friendly_name: 'Strømpris', today: SPOT.map(price), tomorrow: TMR.map(price), raw_today: raw(SPOT, 0), raw_tomorrow: raw(TMR, 1), tomorrow_valid: true }, { platform: 'nordpool' });

  // KI Rom: temperatur som TALL (kontor) og som entity_id-STRENG + fukt som liste (vaskerom)
  areas.kontor = { area_id: 'kontor', name: 'Kontor', icon: 'mdi:desk', floor_id: 'andre', picture: null };
  areas.vaskerom = { area_id: 'vaskerom', name: 'Vaskerom', icon: 'mdi:washing-machine', floor_id: 'andre', picture: null };
  add('sensor.kontor_oversikt', 3, { integrasjon: 'ki_rom', area_id: 'kontor', ikon: 'mdi:desk', temperatur: 23, fuktighet: 41.6, lys: [] }, { platform: 'ki_rom' });
  add('sensor.vaskerom_temp', 19.4, { unit_of_measurement: '°C', device_class: 'temperature' }, { area: 'vaskerom' });
  add('sensor.vaskerom_fukt', 58, { unit_of_measurement: '%', device_class: 'humidity' }, { area: 'vaskerom' });
  add('sensor.vaskerom_oversikt', 2, { integrasjon: 'ki_rom', area_id: 'vaskerom', temperatur: 'sensor.vaskerom_temp', fuktighet: ['sensor.finnes_ikke', { entity: 'sensor.vaskerom_fukt' }] }, { platform: 'ki_rom' });
});
