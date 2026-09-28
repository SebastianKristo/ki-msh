// Testdata for msh-media-hero-card / msh-media-card (kun test).
// Apple TV i stue (remote på samme enhet, apper i source_list), Google TV i soverom (av),
// Squeezebox-radio i kjøkken med forhåndsinnstillinger som button-entiteter på enheten,
// MusicCast-receiver i stue med innganger.
window.mockExtend(({ add, S, E, D }) => {
  const ago = (min) => new Date(Date.now() - min * 60000).toISOString();
  const cover = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 112 112"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2b4b6f"/><stop offset="1" stop-color="#0e1a28"/></linearGradient></defs><rect width="112" height="112" fill="url(#g)"/><circle cx="56" cy="56" r="30" fill="none" stroke="#9fc3e8" stroke-width="3"/><circle cx="56" cy="56" r="6" fill="#9fc3e8"/></svg>');
  D.dev_atv = { id: 'dev_atv', area_id: 'stue', name: 'Stue TV', model: 'Apple TV 4K' };
  D.dev_gtv = { id: 'dev_gtv', area_id: 'soverom', name: 'Soverom TV', model: 'Chromecast with Google TV' };
  D.dev_sq = { id: 'dev_sq', area_id: 'kjokken', name: 'Kjøkken radio', model: 'Squeezebox Radio' };
  // eksisterende stue_tv → Apple TV-enhet med apper
  Object.assign(S['media_player.stue_tv'].attributes, { source_list: ['Netflix', 'NRK TV', 'YouTube', 'TV 2 Play', 'Plex'], source: 'Netflix', app_name: 'Netflix', media_title: 'Wednesday', media_series_title: 'Sesong 2 · episode 3' });
  Object.assign(E['media_player.stue_tv'], { platform: 'apple_tv', device_id: 'dev_atv' });
  add('remote.stue_tv', 'on', { friendly_name: 'Stue TV' }, { platform: 'apple_tv', device: 'dev_atv' });
  add('media_player.soverom_tv', 'off', { friendly_name: 'Soverom TV', source_list: ['YouTube', 'NRK TV', 'Telia Play'], supported_features: 152461 }, { platform: 'androidtv_remote', device: 'dev_gtv' });
  add('remote.soverom_tv', 'off', { friendly_name: 'Soverom TV' }, { platform: 'androidtv_remote', device: 'dev_gtv' });
  add('media_player.kjokken_radio', 'playing', { friendly_name: 'Kjøkken radio', media_title: 'Almost Blue', media_artist: 'Chet Baker', media_channel: 'NRK Jazz', volume_level: 0.28, entity_picture: cover, repeat: 'off', shuffle: false, supported_features: 152461 + 262144 + 32768 }, { platform: 'squeezebox', device: 'dev_sq' });
  S['media_player.kjokken_radio'].last_changed = ago(5);
  ['NRK P1', 'NRK Jazz', 'NRK P3', 'P24-7 Mix'].forEach((n, i) => add(`button.kjokken_radio_preset_${i + 1}`, 'unknown', { friendly_name: 'Kjøkken radio ' + n }, { platform: 'squeezebox', device: 'dev_sq' }));
  add('media_player.rn602_stue', 'on', { friendly_name: 'RN602 stue', device_class: 'receiver', source_list: ['Spotify', 'AirPlay', 'Net Radio', 'TV', 'Phono'], source: 'Spotify', volume_level: 0.32, supported_features: 152461 }, { platform: 'yamaha_musiccast', area: 'stue' });
  // Fiks 17.22/17.24/17.25 (uten område, så rom-popupene ikke påvirkes): Spotify-spiller med varighet, gruppe og bitrate,
  // og en TV med direkte-kanal (EPG-attributter).
  add('media_player.spotify_jem', 'playing', { friendly_name: 'Spotify Jem', device_class: 'speaker', source: 'Spotify', media_title: "Choosin' Texas (Live from the Ryman Auditorium, Nashville)", media_artist: 'Ella Langley', media_album_name: 'Hungover', media_duration: 232, media_position: 84, media_position_updated_at: new Date().toISOString(), group_members: ['media_player.spotify_jem', 'media_player.kjokken_radio'], bitrate: 320, volume_level: 0.4, entity_picture: cover, supported_features: 152461 + 2 }, { platform: 'spotify' });
  add('media_player.prosjektor', 'playing', { friendly_name: 'Prosjektor', device_class: 'tv', app_name: 'NRK TV', source: 'HDMI 1', media_title: 'Dagsrevyen', media_channel: 'NRK1', media_content_type: 'channel', next_title: 'Sportsrevyen', next_start: '19:45', end_time: '19:45', volume_level: 0.24, audio_format: 'Dolby 5.1', supported_features: 152461 }, { platform: 'webostv' });
});
