// Testdata for Server (#server, msh-server-card, fiks 24.10 + 26 + 35: Protect, flere switcher, HA/Supervisor, update.*): et realistisk homelab – UniFi Network (UDM Pro, PoE-switch,
// to aksesspunkt der det ene er frakoblet, to WLAN med QR-kode, klienter med blokker-bryter), Proxmox VE (node, VM-er,
// LXC-containere, lagring) og Unraid (array, disker, Docker og VM). Config entries (config_entries/get) + enhetsregister.
// Diagnostikk/konfig-entiteter har entity_category som i HA, så de ikke dukker opp i andre kort. Bare test – aldri i kortet.
window.mockExtend(({ add, D, S }) => {
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

  /* Fiks 26: switch-porter (port av/på, strømsyklus, trafikk, hastighet), PoE-budsjett */
  U('sensor.switch_kontor_ac_power_budget', 52, { ...W, friendly_name: 'Switch Kontor AC power budget' }, 'dev_usw', 'diagnostic');
  [[1, 'on', 1000], [2, 'on', 1000], [3, 'off', 0], [4, 'on', 100], [5, 'on', 1000]].forEach(([n, s, sp]) => {
    U(`switch.switch_kontor_port_${n}`, s, { friendly_name: `Switch Kontor Port ${n}` }, 'dev_usw', 'config');
    U(`sensor.switch_kontor_port_${n}_link_speed`, sp, { unit_of_measurement: 'Mbit/s', friendly_name: `Switch Kontor Port ${n} link speed` }, 'dev_usw', 'diagnostic');
    U(`sensor.switch_kontor_port_${n}_rx`, s === 'on' ? 12.5 * n : 0, { ...rate, friendly_name: `Switch Kontor Port ${n} RX` }, 'dev_usw', 'diagnostic');
    U(`sensor.switch_kontor_port_${n}_tx`, s === 'on' ? 2.1 * n : 0, { ...rate, friendly_name: `Switch Kontor Port ${n} TX` }, 'dev_usw', 'diagnostic');
  });
  [1, 2, 3, 4].forEach((n) => U(`button.switch_kontor_port_${n}_power_cycle`, 'unknown', { friendly_name: `Switch Kontor Port ${n} Power cycle` }, 'dev_usw', 'config'));
  U('sensor.ap_stue_channel', 36, { friendly_name: 'AP Stue channel' }, 'dev_ap1', 'diagnostic');

  /* UniFi Protect (kameraer + ringeklokke) */
  const PR = (id, st, at, d, cat) => add(id, st, at, { platform: 'unifiprotect', device: d, category: cat || null });
  const modes = { options: ['always', 'detections', 'never'] };
  [['dev_cam1', 'Innkjørsel', 'G4 Bullet', 'innkjorsel', 'recording', 'always'], ['dev_cam2', 'Hage', 'G5 Flex', 'hage', 'unavailable', 'always'], ['dev_cam3', 'Ringeklokke', 'G4 Doorbell Pro', 'ringeklokke', 'idle', 'never']].forEach(([d, n, m, o, st, md]) => {
    dev(d, n, m, 'Ubiquiti Inc.', 'ce_protect');
    PR(`camera.${o}_high`, st, { friendly_name: `${n} High` }, d);
    PR(`select.${o}_recording_mode`, md, { ...modes, friendly_name: `${n} Recording mode` }, d, 'config');
    PR(`binary_sensor.${o}_motion`, 'off', { friendly_name: `${n} Motion`, device_class: 'motion' }, d);
    PR(`sensor.${o}_bitrate`, 2.4, { unit_of_measurement: 'Mbit/s', friendly_name: `${n} bitrate` }, d, 'diagnostic');
    PR(`button.${o}_restart`, 'unknown', { friendly_name: `${n} Restart` }, d, 'config');
  });
  add('binary_sensor.ringeklokke_doorbell', 'off', { friendly_name: 'Ringeklokke Doorbell', device_class: 'occupancy' }, { platform: 'unifiprotect', device: 'dev_cam3' });

  /* Proxmox: ytelse, systeminfo, lagring brukt/total, disker, node-knapper */
  P('sensor.pve_load_average', 1.2, { friendly_name: 'pve Load average' }, 'dev_pve');
  P('sensor.pve_swap_usage', 12, { ...pct, friendly_name: 'pve Swap usage' }, 'dev_pve');
  P('sensor.pve_io_wait', 3, { ...pct, friendly_name: 'pve IO wait' }, 'dev_pve');
  P('sensor.pve_power', 96, { ...W, friendly_name: 'pve Power' }, 'dev_pve');
  P('sensor.pve_version', '8.2.4', { friendly_name: 'pve Version' }, 'dev_pve', 'diagnostic');
  P('sensor.pve_kernel', '6.8.12-1-pve', { friendly_name: 'pve Kernel' }, 'dev_pve', 'diagnostic');
  P('sensor.pve_updates', 7, { friendly_name: 'pve Updates' }, 'dev_pve', 'diagnostic');
  P('button.pve_reboot', 'unknown', { friendly_name: 'pve Reboot' }, 'dev_pve', 'config');
  P('button.pve_shutdown', 'unknown', { friendly_name: 'pve Shutdown' }, 'dev_pve', 'config');
  P('sensor.local_lvm_used', 301, { unit_of_measurement: 'GB', friendly_name: 'local-lvm Used' }, 'dev_st1');
  P('sensor.local_lvm_total', 476, { unit_of_measurement: 'GB', friendly_name: 'local-lvm Total' }, 'dev_st1');
  dev('dev_st2', 'tank', 'Storage', 'Proxmox', 'ce_pve');
  P('sensor.tank_zfs_usage', 91, { ...pct, friendly_name: 'tank Usage' }, 'dev_st2');
  dev('dev_pvedisk', 'pve disker', 'Disk', 'Proxmox', 'ce_pve');
  [['nvme0', 41], ['sda', 35], ['sdb', 52]].forEach(([k, t]) => {
    P(`sensor.pve_${k}_temperature`, t, { ...tmp, friendly_name: `${k} temperature` }, 'dev_pvedisk', 'diagnostic');
    P(`sensor.pve_${k}_health`, 'PASSED', { friendly_name: `${k} health` }, 'dev_pvedisk', 'diagnostic');
  });

  /* Unraid: array-kontroller, paritet, mover, spinn ned, disk-status, docker.img */
  R('sensor.tower_array_used', 14.2, { unit_of_measurement: 'TB', friendly_name: 'Tower Array used' }, 'dev_tower');
  R('sensor.tower_array_total', 18, { unit_of_measurement: 'TB', friendly_name: 'Tower Array total' }, 'dev_tower');
  R('sensor.tower_docker_img_usage', 38, { ...pct, friendly_name: 'Tower docker.img usage' }, 'dev_tower');
  R('sensor.tower_load_average', 2.4, { friendly_name: 'Tower Load' }, 'dev_tower');
  R('sensor.tower_ups_load', 34, { ...pct, friendly_name: 'Tower UPS load' }, 'dev_tower', 'diagnostic');
  R('sensor.tower_network_rx', 42, { ...rate, friendly_name: 'Tower Network RX' }, 'dev_tower', 'diagnostic');
  R('sensor.tower_version', '7.0.1', { friendly_name: 'Tower Version' }, 'dev_tower', 'diagnostic');
  R('button.tower_parity_check', 'unknown', { friendly_name: 'Tower Parity check' }, 'dev_tower', 'config');
  R('button.tower_spin_down', 'unknown', { friendly_name: 'Tower Spin down' }, 'dev_tower', 'config');
  R('button.tower_mover', 'unknown', { friendly_name: 'Tower Mover' }, 'dev_tower', 'config');
  R('button.tower_reboot', 'unknown', { friendly_name: 'Tower Reboot' }, 'dev_tower', 'config');
  [['disk1', 'on'], ['disk2', 'off'], ['disk3', 'on'], ['parity', 'on']].forEach(([k, s]) => {
    R(`binary_sensor.tower_${k}_spinning`, s, { friendly_name: `Tower ${k} spinning` }, 'dev_tower', 'diagnostic');
    R(`switch.tower_${k}_spin`, s, { friendly_name: `Tower ${k} spin` }, 'dev_tower', 'config');
    R(`binary_sensor.tower_${k}_smart`, 'off', { friendly_name: `Tower ${k} SMART`, device_class: 'problem' }, 'dev_tower', 'diagnostic');
  });
  R('sensor.tower_docker_plex_cpu', 4, { ...pct, friendly_name: 'Tower Plex CPU' }, 'dev_tower', 'diagnostic');
  R('sensor.tower_docker_plex_memory', 22, { ...pct, friendly_name: 'Tower Plex memory' }, 'dev_tower', 'diagnostic');
  R('button.tower_docker_sonarr_update', 'unknown', { friendly_name: 'Tower Sonarr update' }, 'dev_tower', 'config');

  /* Fiks 35: egne portnavn (UniFi navngir port-entitetene etter portnavnet i kontrolleren) */
  [[1, 'AP Stue'], [4, 'Kamera Inngang']].forEach(([n, nm]) => { S[`switch.switch_kontor_port_${n}_poe`].attributes.friendly_name = `Switch Kontor ${nm} PoE`; });
  /* Fiks 35: flere switcher – Switch Stue (2,5 G, PoE, deaktivert port) og Switch Garasje (frakoblet) */
  dev('dev_usw2', 'Switch Stue', 'USW Pro 8 PoE', 'Ubiquiti Networks', 'ce_unifi');
  U('device_tracker.switch_stue', 'home', { friendly_name: 'Switch Stue', mac: '74:ac:b9:00:00:05', ip: '192.168.1.5' }, 'dev_usw2');
  U('sensor.switch_stue_uptime', ago(60 * 24 * 41 + 540), { device_class: 'timestamp', friendly_name: 'Switch Stue Uptime' }, 'dev_usw2', 'diagnostic');
  U('sensor.switch_stue_temperature', 44, { ...tmp, friendly_name: 'Switch Stue Temperature' }, 'dev_usw2', 'diagnostic');
  U('sensor.switch_stue_ac_power_budget', 64, { ...W, friendly_name: 'Switch Stue AC power budget' }, 'dev_usw2', 'diagnostic');
  U('button.switch_stue_restart', 'unknown', { friendly_name: 'Switch Stue Restart' }, 'dev_usw2', 'config');
  U('update.switch_stue', 'on', { friendly_name: 'Switch Stue', installed_version: '7.1.24', latest_version: '7.1.26' }, 'dev_usw2', 'config');
  [[1, 2500, 'on', 'Apple TV'], [2, 1000, 'on', ''], [3, 1000, 'on', ''], [4, 100, 'on', 'Hue Bridge'], [5, 0, 'on', ''], [6, 1000, 'on', ''], [7, 0, 'on', ''], [8, 0, 'off', '']].forEach(([n, sp, en, nm]) => {
    U(`switch.switch_stue_port_${n}`, en, { friendly_name: `Switch Stue ${nm || 'Port ' + n}` }, 'dev_usw2', 'config');
    U(`sensor.switch_stue_port_${n}_link_speed`, sp, { unit_of_measurement: 'Mbit/s', friendly_name: `Switch Stue Port ${n} link speed` }, 'dev_usw2', 'diagnostic');
  });
  [[1, 'on', 6.5], [4, 'on', 2.5]].forEach(([n, s2, w]) => {
    U(`switch.switch_stue_port_${n}_poe`, s2, { friendly_name: `Switch Stue ${n === 1 ? 'Apple TV' : 'Hue Bridge'} PoE` }, 'dev_usw2', 'config');
    U(`sensor.switch_stue_port_${n}_poe_power`, w, { ...W, friendly_name: `Switch Stue Port ${n} PoE Power` }, 'dev_usw2', 'diagnostic');
  });
  dev('dev_usw3', 'Switch Garasje', 'USW Flex Mini 5', 'Ubiquiti Networks', 'ce_unifi');
  U('device_tracker.switch_garasje', 'not_home', { friendly_name: 'Switch Garasje', mac: '74:ac:b9:00:00:06' }, 'dev_usw3');
  U('sensor.switch_garasje_state', 'disconnected', { friendly_name: 'Switch Garasje State', device_class: 'enum' }, 'dev_usw3', 'diagnostic');
  U('button.switch_garasje_restart', 'unknown', { friendly_name: 'Switch Garasje Restart' }, 'dev_usw3', 'config');
  [1, 2, 3, 4, 5].forEach((n) => U(`sensor.switch_garasje_port_${n}_link_speed`, 'unavailable', { unit_of_measurement: 'Mbit/s', friendly_name: `Switch Garasje Port ${n} link speed` }, 'dev_usw3', 'diagnostic'));

  /* Fiks 35: Home Assistant (hassio-integrasjonen: Core/OS/Supervisor/Host + tillegg), systemmonitor og uptime */
  const HA = (id, st, at, d, cat) => add(id, st, at, { platform: 'hassio', device: d, category: cat || null });
  const hdev = (id, name, model, manufacturer, slug) => { D[id] = { id, name, name_by_user: null, model, manufacturer, config_entries: ['ce_hassio'], area_id: null, identifiers: [['hassio', slug]] }; };
  hdev('dev_ha_core', 'Home Assistant Core', 'Home Assistant Core', 'Home Assistant', 'core');
  HA('update.home_assistant_core_update', 'on', { friendly_name: 'Home Assistant Core Update', title: 'Home Assistant Core', installed_version: '2026.9.3', latest_version: '2026.10.0', in_progress: false }, 'dev_ha_core', 'config');
  HA('sensor.home_assistant_core_cpu_percent', 9, { ...pct, friendly_name: 'Home Assistant Core CPU-prosent' }, 'dev_ha_core');
  HA('sensor.home_assistant_core_memory_percent', 44, { ...pct, friendly_name: 'Home Assistant Core Minneprosent' }, 'dev_ha_core');
  hdev('dev_ha_os', 'Home Assistant Operating System', 'Home Assistant Operating System', 'Home Assistant', 'OS');
  HA('update.home_assistant_operating_system_update', 'off', { friendly_name: 'Home Assistant Operating System Update', title: 'Home Assistant Operating System', installed_version: '16.2', latest_version: '16.2', in_progress: false }, 'dev_ha_os', 'config');
  HA('sensor.home_assistant_operating_system_version', '16.2', { friendly_name: 'Home Assistant Operating System Version' }, 'dev_ha_os', 'diagnostic');
  hdev('dev_ha_sup', 'Home Assistant Supervisor', 'Home Assistant Supervisor', 'Home Assistant', 'supervisor');
  HA('update.home_assistant_supervisor_update', 'off', { friendly_name: 'Home Assistant Supervisor Update', title: 'Home Assistant Supervisor', installed_version: '2026.09.1', latest_version: '2026.09.1', in_progress: false }, 'dev_ha_sup', 'config');
  hdev('dev_ha_host', 'Home Assistant Host', 'Home Assistant Host', 'Home Assistant', 'host');
  HA('sensor.home_assistant_host_disk_used', 38.2, { unit_of_measurement: 'GB', friendly_name: 'Home Assistant Host Disk used' }, 'dev_ha_host');
  HA('sensor.home_assistant_host_disk_total', 100, { unit_of_measurement: 'GB', friendly_name: 'Home Assistant Host Disk total' }, 'dev_ha_host');
  window.__svAddons = [['core_mosquitto', 'Mosquitto broker', 'mosquitto_broker', true, 1.2, 3, '6.4.1', null], ['a0d7b954_esphome', 'ESPHome', 'esphome', true, 0.4, 4, '2026.9.1', '2026.9.2'],
    ['a0d7b954_nodered', 'Node-RED', 'node_red', true, 3, 9, '19.0.1', '19.0.2'], ['a0d7b954_vscode', 'Studio Code Server', 'studio_code_server', false, 0, 0, '5.17.0', null], ['core_samba', 'Samba share', 'samba_share', true, 0.1, 1, '12.3.2', null]];
  window.__svAddons.forEach(([slug, name, o, run, cpu, mem, ver, nv]) => {
    hdev('dev_ad_' + o, name, 'Home Assistant Add-on', slug.startsWith('core_') ? 'Official add-ons' : 'Home Assistant Community Add-ons', slug);
    HA(`binary_sensor.${o}_running`, run ? 'on' : 'off', { friendly_name: `${name} Running`, device_class: 'running' }, 'dev_ad_' + o);
    HA(`sensor.${o}_cpu_percent`, cpu, { ...pct, friendly_name: `${name} CPU-prosent` }, 'dev_ad_' + o);
    HA(`sensor.${o}_memory_percent`, mem, { ...pct, friendly_name: `${name} Minneprosent` }, 'dev_ad_' + o);
    HA(`sensor.${o}_version`, ver, { friendly_name: `${name} Version` }, 'dev_ad_' + o, 'diagnostic');
    HA(`update.${o}_update`, nv ? 'on' : 'off', { friendly_name: `${name} Update`, title: name, installed_version: ver, latest_version: nv || ver, in_progress: false }, 'dev_ad_' + o, 'config');
  });
  add('sensor.system_monitor_processor_use', 9, { ...pct, friendly_name: 'System Monitor Prosessorbruk' }, { platform: 'systemmonitor' });
  add('sensor.system_monitor_memory_usage', 44, { ...pct, friendly_name: 'System Monitor Minnebruk' }, { platform: 'systemmonitor' });
  add('sensor.system_monitor_disk_usage', 38.2, { ...pct, friendly_name: 'System Monitor Diskbruk /' }, { platform: 'systemmonitor' });
  add('sensor.uptime', ago(60 * 24 * 14 + 360), { device_class: 'timestamp', friendly_name: 'Oppetid' }, { platform: 'uptime' });

  function S_last(id, min) { window.__svLast = window.__svLast || {}; window.__svLast[id] = ago(min); }
});
(function () {
  const prev = window.mockHass;
  const ENTRIES = [
    { entry_id: 'ce_unifi', domain: 'unifi', title: 'UniFi Network', state: 'loaded', source: 'user' },
    { entry_id: 'ce_pve', domain: 'proxmoxve', title: 'pve.lan', state: 'loaded', source: 'user' },
    { entry_id: 'ce_unraid', domain: 'unraid', title: 'Tower', state: 'loaded', source: 'user' },
    { entry_id: 'ce_protect', domain: 'unifiprotect', title: 'UniFi Protect', state: 'loaded', source: 'user' },
    { entry_id: 'ce_unifi2', domain: 'unifi', title: 'UniFi Hytta', state: 'loaded', source: 'user' },
    { entry_id: 'ce_hassio', domain: 'hassio', title: 'Supervisor', state: 'loaded', source: 'system' },
  ];
  window.mockHass = function () {
    const h = prev();
    Object.entries(window.__svLast || {}).forEach(([id, t]) => { if (h.states[id]) h.states[id] = { ...h.states[id], last_changed: t }; });
    h.services = { ...(h.services || {}), homeassistant: { restart: {}, check_config: {}, toggle: {} }, hassio: { addon_start: {}, addon_stop: {}, addon_restart: {}, backup_full: {}, backup_partial: {}, host_reboot: {} }, update: { install: {} }, button: { press: {} } };
    const ws = h.callWS;
    h.callWS = (m) => {
      if (m && m.type === 'config_entries/get' && (!m.domain || ENTRIES.some((e) => e.domain === m.domain))) {
        if (window.__svNoEntries) return Promise.reject(new Error('Unauthorized'));
        return Promise.resolve(ENTRIES.filter((e) => !m.domain || e.domain === m.domain));
      }
      // Supervisor (WS supervisor/api) – window.__svNoSup = true simulerer HA uten Supervisor
      if (m && m.type === 'supervisor/api') {
        window.__calls.push(['ws', m.type, m]);
        if (window.__svNoSup) return Promise.reject(new Error('Unknown command'));
        const A = window.__svAddons || [], ep = m.endpoint || '';
        window.__svOpts = window.__svOpts || {};
        if (ep === '/addons') return Promise.resolve({ addons: A.map(([slug, name, , run, , , ver, nv]) => ({ slug, name, state: run ? 'started' : 'stopped', version: ver, version_latest: nv || ver, update_available: !!nv, icon: false })) });
        if (ep === '/core/info') return Promise.resolve({ version: '2026.9.3', version_latest: '2026.10.0', machine: 'generic-x86-64' });
        if (ep === '/os/info') return Promise.resolve({ version: '16.2', version_latest: '16.2', board: 'generic-x86-64' });
        if (ep === '/host/info') return Promise.resolve({ hostname: 'homeassistant', disk_total: 100, disk_used: 38.2, disk_free: 61.8 });
        const mm = /^\/addons\/([^/]+)\/(info|stats|options)$/.exec(ep), a = mm && A.find((x) => x[0] === mm[1]);
        if (a && mm[2] === 'info') return Promise.resolve({ slug: a[0], name: a[1], version: a[6], state: a[3] ? 'started' : 'stopped', boot: 'auto', watchdog: a[0] !== 'core_samba', auto_update: false, ingress: a[0] !== 'core_mosquitto', ingress_panel: a[0] === 'a0d7b954_nodered', ...(window.__svOpts[a[0]] || {}) });
        if (a && mm[2] === 'stats') return Promise.resolve({ cpu_percent: a[4], memory_usage: a[5] * 41e6, memory_limit: 4.1e9, memory_percent: a[5], network_rx: 12.4e6, network_tx: 3.1e6, blk_read: 0, blk_write: 0 });
        if (a && mm[2] === 'options') { window.__svOpts[a[0]] = { ...(window.__svOpts[a[0]] || {}), ...(m.data || {}) }; return Promise.resolve({}); }
        return Promise.reject(new Error('Not found'));
      }
      return ws(m);
    };
    return h;
  };
})();
