// Testdata for Fiks 50 (Server E/G): qBittorrent- og SpeedTest-integrasjonen. Lastes BARE av test/server50-check.mjs
// (ikke i test/mock – da ville qBittorrent-fanen dukket opp i de eldre servertestene). Bare test – aldri i kortet.
// Entitets-ID-ene er bevisst ikke «sensor.qbittorrent_*» for alt: autokonfigen skal finne dem via plattform +
// translation_key / unique_id-suffiks, ikke via navnet.
window.mockExtend(({ add, D, E, S }) => {
  const at = (iso) => (id) => { S[id].last_updated = iso; S[id].last_changed = iso; };
  const reg = (id, tk, uid) => { E[id].translation_key = tk; E[id].unique_id = uid; };
  D.dev_qbit = { id: 'dev_qbit', name: 'qBittorrent', name_by_user: null, model: null, manufacturer: 'QBittorrent', config_entries: ['ce_qbit'], area_id: null };
  const Q = (id, st, attr, tk, cat) => { add(id, st, attr, { platform: 'qbittorrent', device: 'dev_qbit', category: cat || null }); reg(id, tk, '01QBITENTRY-' + tk); };
  const kib = { unit_of_measurement: 'KiB/s', device_class: 'data_rate', state_class: 'measurement' };
  const tib = { unit_of_measurement: 'TiB', device_class: 'data_size', state_class: 'total_increasing' };
  // fart med egne navn (finnes via translation_key) – resten med HA-standardnavn
  Q('sensor.torrentserver_nedlasting', 8984, { ...kib, friendly_name: 'Torrentserver nedlasting' }, 'download_speed');
  Q('sensor.torrentserver_opplasting', 2344, { ...kib, friendly_name: 'Torrentserver opplasting' }, 'upload_speed');
  Q('sensor.qbittorrent_download_speed_limit', 0, { ...kib, friendly_name: 'qBittorrent Download speed limit' }, 'download_speed_limit', 'diagnostic');
  Q('sensor.qbittorrent_upload_speed_limit', 4883, { ...kib, friendly_name: 'qBittorrent Upload speed limit' }, 'upload_speed_limit', 'diagnostic');
  Q('sensor.qbittorrent_active_torrents', 6, { unit_of_measurement: 'torrents', friendly_name: 'qBittorrent Active torrents' }, 'active_torrents');
  Q('sensor.qbittorrent_inactive_torrents', 31, { unit_of_measurement: 'torrents', friendly_name: 'qBittorrent Inactive torrents' }, 'inactive_torrents');
  Q('sensor.qbittorrent_paused_torrents', 4, { unit_of_measurement: 'torrents', friendly_name: 'qBittorrent Paused torrents' }, 'paused_torrents');
  Q('sensor.qbittorrent_errored_torrents', 1, { unit_of_measurement: 'torrents', friendly_name: 'qBittorrent Errored torrents' }, 'errored_torrents');
  Q('sensor.qbittorrent_all_torrents', 42, { unit_of_measurement: 'torrents', friendly_name: 'qBittorrent All torrents' }, 'all_torrents');
  Q('sensor.qbittorrent_all_time_download', 4.384, { ...tib, friendly_name: 'qBittorrent All-time download' }, 'alltime_download');
  Q('sensor.qbittorrent_all_time_upload', 10.28, { ...tib, friendly_name: 'qBittorrent All-time upload' }, 'alltime_upload');
  Q('sensor.qbittorrent_global_ratio', 2.34, { friendly_name: 'qBittorrent Global ratio' }, 'global_ratio');
  Q('sensor.qbittorrent_connection_status', 'connected', { device_class: 'enum', options: ['connected', 'firewalled', 'disconnected'], friendly_name: 'qBittorrent Connection status' }, 'connection_status');
  Q('sensor.qbittorrent_status', 'downloading', { device_class: 'enum', friendly_name: 'qBittorrent Status' }, 'current_status');
  Q('switch.qbittorrent_alternative_speed', 'off', { friendly_name: 'qBittorrent Alternative speed' }, 'alternative_speed');

  /* SpeedTest (speedtestdotnet) */
  D.dev_st = { id: 'dev_st', name: 'SpeedTest', name_by_user: null, model: null, manufacturer: 'Ookla', config_entries: ['ce_st'], area_id: null };
  const ST = (id, st, attr, tk) => { add(id, st, attr, { platform: 'speedtestdotnet', device: 'dev_st' }); reg(id, tk, '01STENTRY_' + tk); };
  const mbit = { unit_of_measurement: 'Mbit/s', device_class: 'data_rate', state_class: 'measurement' };
  ST('sensor.speedtest_download', 912.4, { ...mbit, friendly_name: 'SpeedTest Download', server_name: 'Oslo', server_country: 'Norway' }, 'download');
  ST('sensor.speedtest_upload', 486.1, { ...mbit, friendly_name: 'SpeedTest Upload' }, 'upload');
  ST('sensor.speedtest_ping', 6, { unit_of_measurement: 'ms', device_class: 'duration', friendly_name: 'SpeedTest Ping' }, 'ping');
  const t = new Date(Date.now() - 60000).toISOString();
  ['sensor.speedtest_download', 'sensor.speedtest_upload', 'sensor.speedtest_ping'].forEach(at(t));
});
