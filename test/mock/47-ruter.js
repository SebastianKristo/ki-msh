// Testdata for Ruter (#ruter): Entur-stopp med flere avganger + Entur SX-linjesensorer.
window.mockExtend(({ add, E }) => {
  const hm = (m) => { const d = new Date(Date.now() + m * 60000); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  add('sensor.entur_bislett', 3, { friendly_name: 'Entur Bislett', unit_of_measurement: 'min', route: '17 Grefsen st.', due_at: hm(3), due_in: 3, delay: 0, real_time: true, next_route: '18 Rikshospitalet', next_due_at: hm(7), next_due_in: 7, next_real_time: true, 'departure_#3': 'ca. ' + hm(13) + ' 17 Rikshospitalet', transport_mode: 'tram', stop_id: 'NSR:StopPlace:6488', icon: 'mdi:tram' }, { platform: 'entur_public_transport' });
  add('sensor.entur_holbergs_plass', 1, { friendly_name: 'Entur Holbergs plass', unit_of_measurement: 'min', route: '45 Voksen skog', due_at: hm(1), real_time: true, next_route: '46 Ullernåsen', next_due_at: hm(9), next_real_time: false, transport_mode: 'bus', stop_id: 'NSR:StopPlace:6531' }, { platform: 'entur' });
  add('sensor.ruter_avvik_summary', 2, { friendly_name: 'Ruter avvik' }, { platform: 'entur_sx', device: 'sx1' });
  add('sensor.ruter_avvik_rut_line_17', 'Normal service', { friendly_name: 'Linje 17' }, { platform: 'entur_sx', device: 'sx1' });
  add('sensor.ruter_avvik_rut_line_19', 'Endret holdeplass ved Homansbyen', { status: 'planned', description: 'Holdeplassen flyttes 50 m mot Bislett på grunn av gravearbeid.', valid_from: new Date(Date.now() + 86400000 * 2).toISOString(), valid_to: new Date(Date.now() + 86400000 * 9).toISOString() }, { platform: 'entur_sx', device: 'sx1' });
  add('sensor.ruter_avvik_rut_line_45', 'Forsinkelser i Ullevålsveien', { status: 'open', description: 'Forsinkelser på opptil 10 min på grunn av kø.', valid_from: new Date(Date.now() - 3600000).toISOString() }, { platform: 'entur_sx', device: 'sx1' });
  ['sensor.ruter_avvik_summary', 'sensor.ruter_avvik_rut_line_17', 'sensor.ruter_avvik_rut_line_19', 'sensor.ruter_avvik_rut_line_45'].forEach((id) => { E[id].device_id = 'sx1'; });
});
