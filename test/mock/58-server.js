// Testdata for Server (#server, msh-server-card, fiks 24.10): et realistisk homelab – UniFi Network (UDM Pro, PoE-switch,
// to aksesspunkt der det ene er frakoblet, to WLAN med QR-kode, klienter med blokker-bryter), Proxmox VE (node, VM-er,
// LXC-containere, lagring) og Unraid (array, disker, Docker og VM). Config entries (config_entries/get) + enhetsregister.
// Diagnostikk/konfig-entiteter har entity_category som i HA, så de ikke dukker opp i andre kort. Bare test – aldri i kortet.
window.mockExtend(({ add, D }) => {
  const ago = (min) => new Date(Date.now() - min * 60000).toISOString();
  const dev = (id, name, model, manufacturer, ce) => { D[id] = { id, name, name_by_user: null, model, manufacturer, config_entries: [ce], area_id: null }; };
  const U = (id, st, at, d, cat) => add(id, st, at, { platform: 'unifi', device: d, category: cat || null });
  const P = (id, st, at, d, cat) => add(id, st, at, { platform: 'proxmoxve', device: d, category: cat || null });
  const R = (id, st, at, d, cat) => add(id, st, at, { platform: 'unraid', device: d, category: cat || null });
  const pct = { unit_of_measurement: '%', state_class: 'measurement' };
  const tmp = { unit_of_measurement: '°C', device_class: 'temperature', state_class: 'measurement' };
  const rate = { unit_of_measurement: 'Mbit/s', device_class: 'data_rate', state_class: 'measurement' };
  const W = { unit_of_measurement: 'W', device_class: 'power', state_class: 'measurement' };

  /* UniFi Network */
  dev('dev_udm', 'UDM Pro', 'UniFi Dream Machine Pro', 'Ubiquiti Networks', 'ce_unifi');
  U('device_tracker.udm_pro', 'home', { friendly_name: 'UDM Pro', mac: '74:ac:b9:00:00:01', ip: '192.168.1.1', source_type: 'router' }, 'dev_udm');
  U('sensor.udm_pro_cpu_utilization', 18, { ...pct, friendly_name: 'UDM Pro CPU utilization' }, 'dev_udm', 'diagnostic');
  U('sensor.udm_pro_memory_utilization', 54, { ...pct, friendly_name: 'UDM Pro Memory utilization' }, 'dev_udm', 'diagnostic');
  U('sensor.udm_pro_temperature', 52, { ...tmp, friendly_name: 'UDM Pro Temperature' }, 'dev_udm', 'diagnostic');
  U('sensor.udm_pro_uptime', ago(60 * 24 * 12 + 190), { device_class: 'timestamp', friendly_name: 'UDM Pro Uptime' }, 'dev_udm', 'diagnostic');
  U('sensor.udm_pro_state', 'connected', { friendly_name: 'UDM Pro State', device_class: 'enum' }, 'dev_udm', 'diagnostic');
  U('sensor.udm_pro_cloudflare_wan_latency', 9, { unit_of_measurement: 'ms', friendly_name: 'UDM Pro Cloudflare WAN latency' }, 'dev_udm', 'diagnostic');
  U('sensor.udm_pro_google_wan_latency', 12, { unit_of_measurement: 'ms', friendly_name: 'UDM Pro Google WAN latency' }, 'dev_udm', 'diagnostic');
  U('sensor.udm_pro_wan_rx', 38.2, { ...rate, friendly_name: 'UDM Pro WAN RX' }, 'dev_udm', 'diagnostic');
  U('sensor.udm_pro_wan_tx', 4.1, { ...rate, friendly_name: 'UDM Pro WAN TX' }, 'dev_udm', 'diagnostic');
  U('button.udm_pro_restart', 'unknown', { friendly_name: 'UDM Pro Restart', device_class: 'restart' }, 'dev_udm', 'config');
  U('update.udm_pro', 'off', { friendly_name: 'UDM Pro', installed_version: '4.1.13', latest_version: '4.1.13' }, 'dev_udm', 'config');

  dev('dev_usw', 'Switch Kontor', 'USW Lite 8 PoE', 'Ubiquiti Networks', 'ce_unifi');
  U('device_tracker.switch_kontor', 'home', { friendly_name: 'Switch Kontor', mac: '74:ac:b9:00:00:02', ip: '192.168.1.2' }, 'dev_usw');
  U('sensor.switch_kontor_cpu_utilization', 9, { ...pct, friendly_name: 'Switch Kontor CPU utilization' }, 'dev_usw', 'diagnostic');
  U('sensor.switch_kontor_memory_utilization', 41, { ...pct, friendly_name: 'Switch Kontor Memory utilization' }, 'dev_usw', 'diagnostic');
  U('sensor.switch_kontor_uptime', ago(60 * 24 * 30), { device_class: 'timestamp', friendly_name: 'Switch Kontor Uptime' }, 'dev_usw', 'diagnostic');
  U('sensor.switch_kontor_clients', 3, { friendly_name: 'Switch Kontor Clients' }, 'dev_usw', 'diagnostic');
  U('sensor.switch_kontor_ac_power_consumption', 24, { ...W, friendly_name: 'Switch Kontor AC power consumption' }, 'dev_usw', 'diagnostic');
  U('button.switch_kontor_restart', 'unknown', { friendly_name: 'Switch Kontor Restart' }, 'dev_usw', 'config');
  U('light.switch_kontor_led', 'on', { friendly_name: 'Switch Kontor LED', supported_color_modes: ['onoff'] }, 'dev_usw', 'config');
  [[1, 'on', 4.2], [2, 'on', 5.8], [3, 'off', 0], [4, 'on', 2.1]].forEach(([n, s, w]) => {
    U(`switch.switch_kontor_port_${n}_poe`, s, { friendly_name: `Switch Kontor Port ${n} PoE` }, 'dev_usw', 'config');
    U(`sensor.switch_kontor_port_${n}_poe_power`, w, { ...W, friendly_name: `Switch Kontor Port ${n} PoE Power` }, 'dev_usw', 'diagnostic');
  });

  dev('dev_ap1', 'AP Stue', 'U6 Lite', 'Ubiquiti Networks', 'ce_unifi');
  U('device_tracker.ap_stue', 'home', { friendly_name: 'AP Stue', mac: '74:ac:b9:00:00:03', ip: '192.168.1.3' }, 'dev_ap1');
  U('sensor.ap_stue_cpu_utilization', 12, { ...pct, friendly_name: 'AP Stue CPU utilization' }, 'dev_ap1', 'diagnostic');
  U('sensor.ap_stue_memory_utilization', 63, { ...pct, friendly_name: 'AP Stue Memory utilization' }, 'dev_ap1', 'diagnostic');
  U('sensor.ap_stue_uptime', ago(60 * 24 * 4), { device_class: 'timestamp', friendly_name: 'AP Stue Uptime' }, 'dev_ap1', 'diagnostic');
  U('sensor.ap_stue_clients', 11, { friendly_name: 'AP Stue Clients' }, 'dev_ap1', 'diagnostic');
  U('sensor.ap_stue_rx', 12.4, { ...rate, friendly_name: 'AP Stue RX' }, 'dev_ap1', 'diagnostic');
  U('sensor.ap_stue_tx', 3.2, { ...rate, friendly_name: 'AP Stue TX' }, 'dev_ap1', 'diagnostic');
  U('sensor.ap_stue_2_4ghz_clients', 4, { friendly_name: 'AP Stue 2,4 GHz klienter' }, 'dev_ap1', 'diagnostic');
  U('sensor.ap_stue_5ghz_clients', 7, { friendly_name: 'AP Stue 5 GHz klienter' }, 'dev_ap1', 'diagnostic');
  U('button.ap_stue_restart', 'unknown', { friendly_name: 'AP Stue Restart' }, 'dev_ap1', 'config');
  U('light.ap_stue_led', 'on', { friendly_name: 'AP Stue LED', supported_color_modes: ['onoff'] }, 'dev_ap1', 'config');

  dev('dev_ap2', 'AP Loft', 'U6 Pro', 'Ubiquiti Networks', 'ce_unifi');
  U('device_tracker.ap_loft', 'not_home', { friendly_name: 'AP Loft', mac: '74:ac:b9:00:00:04' }, 'dev_ap2');
  S_last('device_tracker.ap_loft', 42);
  U('sensor.ap_loft_cpu_utilization', 'unavailable', { ...pct, friendly_name: 'AP Loft CPU utilization' }, 'dev_ap2', 'diagnostic');
  U('sensor.ap_loft_memory_utilization', 'unavailable', { ...pct, friendly_name: 'AP Loft Memory utilization' }, 'dev_ap2', 'diagnostic');
  U('sensor.ap_loft_state', 'disconnected', { friendly_name: 'AP Loft State', device_class: 'enum' }, 'dev_ap2', 'diagnostic');
  U('sensor.ap_loft_clients', 0, { friendly_name: 'AP Loft Clients' }, 'dev_ap2', 'diagnostic');
  U('button.ap_loft_restart', 'unknown', { friendly_name: 'AP Loft Restart' }, 'dev_ap2', 'config');
  U('light.ap_loft_led', 'off', { friendly_name: 'AP Loft LED', supported_color_modes: ['onoff'] }, 'dev_ap2', 'config');

  dev('dev_wl1', 'Hjemme', 'UniFi WLAN', 'Ubiquiti Networks', 'ce_unifi');
  U('switch.hjemme', 'on', { friendly_name: 'Hjemme' }, 'dev_wl1', 'config');
  U('image.hjemme_qr_code', '2026-09-01T10:00:00+00:00', { friendly_name: 'Hjemme QR Code' }, 'dev_wl1', 'diagnostic');
  U('sensor.hjemme_clients', 11, { friendly_name: 'Hjemme clients' }, 'dev_wl1', 'diagnostic');
  dev('dev_wl2', 'Gjest', 'UniFi WLAN', 'Ubiquiti Networks', 'ce_unifi');
  U('switch.gjest', 'off', { friendly_name: 'Gjest' }, 'dev_wl2', 'config');
  U('image.gjest_qr_code', '2026-09-01T10:00:00+00:00', { friendly_name: 'Gjest QR Code' }, 'dev_wl2', 'diagnostic');
  U('sensor.gjest_clients', 0, { friendly_name: 'Gjest clients' }, 'dev_wl2', 'diagnostic');

  [['dev_c1', 'iPhone Sebastian', 'iphone_sebastian', { ap_mac: '74:ac:b9:00:00:03', essid: 'Hjemme', ip: '192.168.1.51', is_wired: false }, 'home'],
    ['dev_c2', 'Apple TV Stue', 'apple_tv_stue', { ap_mac: '74:ac:b9:00:00:03', essid: 'Hjemme', ip: '192.168.1.52', is_wired: false }, 'home'],
    ['dev_c3', 'Nettbrett barn', 'nettbrett_barn', { ap_mac: '74:ac:b9:00:00:03', essid: 'Hjemme', ip: '192.168.1.53', is_wired: false }, 'home'],
    ['dev_c4', 'Tower', 'tower_nic', { sw_mac: '74:ac:b9:00:00:02', ip: '192.168.1.20', is_wired: true }, 'home']].forEach(([d, n, o, at, st]) => {
    dev(d, n, null, null, 'ce_unifi');
    U('device_tracker.' + o, st, { friendly_name: n, ...at, source_type: 'router' }, d);
    if (d !== 'dev_c4') U('switch.' + o, d === 'dev_c3' ? 'off' : 'on', { friendly_name: n }, d, 'config');
  });

  /* Proxmox VE */
  dev('dev_pve', 'pve', 'Proxmox VE Node', 'Proxmox', 'ce_pve');
  P('binary_sensor.pve_status', 'on', { friendly_name: 'pve Status', device_class: 'running' }, 'dev_pve');
  P('sensor.pve_cpu_usage', 23, { ...pct, friendly_name: 'pve CPU usage' }, 'dev_pve');
  P('sensor.pve_memory_usage', 58, { ...pct, friendly_name: 'pve Memory usage' }, 'dev_pve');
  P('sensor.pve_disk_usage', 47, { ...pct, friendly_name: 'pve Disk usage' }, 'dev_pve');
  P('sensor.pve_cpu_temperature', 48, { ...tmp, friendly_name: 'pve CPU temperature' }, 'dev_pve', 'diagnostic');
  P('sensor.pve_uptime', ago(60 * 24 * 21), { device_class: 'timestamp', friendly_name: 'pve Uptime' }, 'dev_pve', 'diagnostic');
  [['dev_vm100', 'Home Assistant', 'QEMU virtual machine', 'haos', 'on', 6], ['dev_vm101', 'Windows 11', 'QEMU virtual machine', 'windows_11', 'off', 0],
    ['dev_ct102', 'AdGuard', 'LXC container', 'adguard', 'on', 2], ['dev_ct103', 'Nginx Proxy', 'LXC container', 'nginx_proxy', 'on', 1]].forEach(([d, n, model, o, st, cpu]) => {
    dev(d, n, model, 'Proxmox', 'ce_pve');
    P(`binary_sensor.${o}_status`, st, { friendly_name: `${n} Status`, device_class: 'running' }, d);
    P(`sensor.${o}_cpu_usage`, cpu, { ...pct, friendly_name: `${n} CPU usage` }, d);
    P(`sensor.${o}_memory_usage`, st === 'on' ? 37 : 0, { ...pct, friendly_name: `${n} Memory usage` }, d);
    ['start', 'stop', 'shutdown', 'reboot'].forEach((b) => P(`button.${o}_${b}`, 'unknown', { friendly_name: `${n} ${b}` }, d, 'config'));
  });
  dev('dev_st1', 'local-lvm', 'Storage', 'Proxmox', 'ce_pve');
  P('sensor.local_lvm_usage', 63, { ...pct, friendly_name: 'local-lvm Usage' }, 'dev_st1');

  /* Unraid */
  dev('dev_tower', 'Tower', 'Unraid 7.0.1', 'Lime Technology', 'ce_unraid');
  R('sensor.tower_cpu_usage', 31, { ...pct, friendly_name: 'Tower CPU usage' }, 'dev_tower');
  R('sensor.tower_ram_usage', 61, { ...pct, friendly_name: 'Tower RAM usage' }, 'dev_tower');
  R('sensor.tower_cpu_temperature', 64, { ...tmp, friendly_name: 'Tower CPU temperature' }, 'dev_tower', 'diagnostic');
  R('sensor.tower_uptime', ago(60 * 24 * 9), { device_class: 'timestamp', friendly_name: 'Tower Uptime' }, 'dev_tower', 'diagnostic');
  R('sensor.tower_array_usage', 78, { ...pct, friendly_name: 'Tower Array usage' }, 'dev_tower');
  R('sensor.tower_array_state', 'Started', { friendly_name: 'Tower Array state' }, 'dev_tower');
  R('sensor.tower_ups_power', 118, { ...W, friendly_name: 'Tower UPS power' }, 'dev_tower', 'diagnostic');
  [['disk1', 71, 34], ['disk2', 64, 33], ['disk3', 93, 38], ['cache', 42, 41]].forEach(([k, u, t]) => {
    R(`sensor.tower_${k}_usage`, u, { ...pct, friendly_name: `Tower ${k} usage` }, 'dev_tower');
    R(`sensor.tower_${k}_temperature`, t, { ...tmp, friendly_name: `Tower ${k} temperature` }, 'dev_tower', 'diagnostic');
  });
  R('sensor.tower_parity_temperature', 35, { ...tmp, friendly_name: 'Tower parity temperature' }, 'dev_tower', 'diagnostic');
  R('switch.tower_array', 'on', { friendly_name: 'Tower Array' }, 'dev_tower', 'config');
  [['docker_plex', 'Plex', 'on'], ['docker_sonarr', 'Sonarr', 'on'], ['docker_radarr', 'Radarr', 'off'], ['docker_nextcloud', 'Nextcloud', 'on'], ['vm_windows_11', 'Windows 11', 'off']].forEach(([o, n, s]) => {
    R('switch.tower_' + o, s, { friendly_name: 'Tower ' + n }, 'dev_tower');
    if (o.startsWith('docker')) R(`button.tower_${o}_restart`, 'unknown', { friendly_name: `Tower ${n} restart` }, 'dev_tower', 'config');
  });
  R('binary_sensor.tower_docker_sonarr_update', 'on', { friendly_name: 'Tower Sonarr update', device_class: 'update' }, 'dev_tower', 'diagnostic');

  function S_last(id, min) { window.__svLast = window.__svLast || {}; window.__svLast[id] = ago(min); }
});
(function () {
  const prev = window.mockHass;
  const ENTRIES = [
    { entry_id: 'ce_unifi', domain: 'unifi', title: 'UniFi Network', state: 'loaded', source: 'user' },
    { entry_id: 'ce_pve', domain: 'proxmoxve', title: 'pve.lan', state: 'loaded', source: 'user' },
    { entry_id: 'ce_unraid', domain: 'unraid', title: 'Tower', state: 'loaded', source: 'user' },
  ];
  window.mockHass = function () {
    const h = prev();
    Object.entries(window.__svLast || {}).forEach(([id, t]) => { if (h.states[id]) h.states[id] = { ...h.states[id], last_changed: t }; });
    const ws = h.callWS;
    h.callWS = (m) => {
      if (m && m.type === 'config_entries/get' && (!m.domain || ENTRIES.some((e) => e.domain === m.domain))) {
        if (window.__svNoEntries) return Promise.reject(new Error('Unauthorized'));
        return Promise.resolve(ENTRIES.filter((e) => !m.domain || e.domain === m.domain));
      }
      return ws(m);
    };
    return h;
  };
})();
