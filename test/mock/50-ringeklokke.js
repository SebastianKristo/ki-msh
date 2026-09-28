// Testdata for Ringeklokke (#ringeklokke, msh-ringeklokke-card, fiks 19.17–19.19): UniFi Protect G6 Entry på enheten
// dev_ring (fra 45-kamera-mocken, område gang): ringe-utløser, høy/pakke-kamera, høyttaler, ringevolum, siste ringing,
// deteksjoner (pakke + snakker på) og event-entiteter i dag. Låsen lock.inngangsdor ligger i samme område (gang).
window.mockExtend(({ add, S, E, D }) => {
  const ago = (min) => new Date(Date.now() - min * 60000).toISOString();
  const up = { platform: 'unifiprotect', device: 'dev_ring' };
  if (D.dev_ring) D.dev_ring.model = 'G6 Entry';
  add('binary_sensor.inngang_doorbell', 'off', { friendly_name: 'Inngang Doorbell' }, up);
  add('camera.inngang_package_camera', 'recording', { access_token: 'tok7', friendly_name: 'Inngang Package camera' }, up);
  add('media_player.inngang_speaker', 'idle', { friendly_name: 'Inngang Speaker', volume_level: 0.8 }, up);
  add('number.inngang_doorbell_ring_volume', 80, { min: 0, max: 100, step: 1, unit_of_measurement: '%', friendly_name: 'Inngang Doorbell ring volume' }, { ...up, category: 'config' });
  add('sensor.inngang_last_doorbell_ring', ago(1), { device_class: 'timestamp', friendly_name: 'Inngang Last doorbell ring' }, up);
  add('binary_sensor.inngang_package_detected', 'on', { friendly_name: 'Inngang Package detected' }, up);
  add('binary_sensor.inngang_speaking_detected', 'on', { friendly_name: 'Inngang Speaking detected' }, up);
  add('binary_sensor.inngang_glass_break_detected', 'off', { friendly_name: 'Inngang Glass break detected' }, up);
  add('event.inngang_package', ago(35), { event_type: 'package', friendly_name: 'Inngang Package' }, up);
  add('event.inngang_vehicle', ago(95), { event_type: 'vehicle', friendly_name: 'Inngang Vehicle' }, up);
  add('tts.google_translate_nb_no', 'unknown', { friendly_name: 'Google Translate nb' });
  if (S['event.inngang_ringeklokke']) S['event.inngang_ringeklokke'].state = ago(1);
});
