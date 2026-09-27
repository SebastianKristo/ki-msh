// Testdata for msh-kamera-card (kun test): UniFi-lignende kameraer på enheter (modell), hendelses-
// entiteter (binary_sensor/event) på samme enhet, flomlys + sirene, og ett Frigate-kamera.
window.mockExtend(({ add, S, E, D }) => {
  const ago = (min) => new Date(Date.now() - min * 60000).toISOString();
  D.dev_ring = { id: 'dev_ring', area_id: 'gang', name: 'Ringeklokke', model: 'G4 Doorbell Pro' };
  D.dev_ver = { id: 'dev_ver', area_id: 'hage', name: 'Veranda', model: 'G3 Flex' };
  D.dev_gar = { id: 'dev_gar', area_id: null, name: 'Garasje', model: 'G5 Turret Ultra' };
  D.dev_fr = { id: 'dev_fr', area_id: null, name: 'Innkjørsel', model: 'Frigate' };
  Object.assign(S['camera.inngang'].attributes, { access_token: 'tok1', friendly_name: 'Inngang High resolution channel' });
  S['camera.inngang'].state = 'recording';
  Object.assign(E['camera.inngang'], { device_id: 'dev_ring', platform: 'unifiprotect' });
  add('camera.veranda', 'streaming', { access_token: 'tok2', friendly_name: 'Veranda' }, { platform: 'unifiprotect', device: 'dev_ver', area: 'stue' });
  add('camera.garasje', 'idle', { access_token: 'tok3', friendly_name: 'Garasje' }, { platform: 'unifiprotect', device: 'dev_gar' });
  add('camera.innkjorsel', 'recording', { access_token: 'tok4', friendly_name: 'Innkjørsel' }, { platform: 'frigate', device: 'dev_fr' });
  add('camera.pakke', 'unavailable', { friendly_name: 'Pakke' }, { platform: 'unifiprotect', device: 'dev_ring' });
  add('binary_sensor.inngang_person', 'off', { device_class: 'occupancy', friendly_name: 'Inngang person' }, { platform: 'unifiprotect', device: 'dev_ring' });
  S['binary_sensor.inngang_person'].last_changed = ago(48);
  add('binary_sensor.inngang_bevegelse', 'on', { device_class: 'motion', friendly_name: 'Inngang bevegelse' }, { platform: 'unifiprotect', device: 'dev_ring' });
  add('event.inngang_ringeklokke', ago(130), { event_type: 'ring', device_class: 'doorbell', friendly_name: 'Ringeklokke' }, { platform: 'unifiprotect', device: 'dev_ring' });
  add('binary_sensor.garasje_kjoretoy', 'off', { friendly_name: 'Garasje kjøretøy' }, { platform: 'unifiprotect', device: 'dev_gar' });
  S['binary_sensor.garasje_kjoretoy'].last_changed = ago(75);
  add('light.veranda_flomlys', 'off', { friendly_name: 'Veranda flomlys' }, { platform: 'unifiprotect', device: 'dev_ver' });
  add('siren.garasje_sirene', 'off', { friendly_name: 'Garasje sirene' }, { platform: 'unifiprotect', device: 'dev_gar' });
  // Autokonfig per enhet: medium-kanal (skjules), personvern/siste bevegelse på samme enhet,
  // og et Frigate-kamera med samme navn som Garasje (legges under frigate[]).
  add('camera.inngang_medium_resolution_channel', 'recording', { access_token: 'tok5', friendly_name: 'Inngang Medium resolution channel' }, { platform: 'unifiprotect', device: 'dev_ring' });
  add('switch.inngang_privacy_mode', 'off', { friendly_name: 'Inngang Privacy mode' }, { platform: 'unifiprotect', device: 'dev_ring' });
  add('sensor.inngang_last_motion_detected', ago(12), { device_class: 'timestamp', friendly_name: 'Inngang siste bevegelse' }, { platform: 'unifiprotect', device: 'dev_ring' });
  D.dev_fr2 = { id: 'dev_fr2', area_id: null, name: 'garasje', model: 'Frigate' };
  add('camera.garasje_frigate', 'recording', { access_token: 'tok6', friendly_name: 'Garasje (Frigate)' }, { platform: 'frigate', device: 'dev_fr2' });
});
