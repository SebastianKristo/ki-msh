/*! KI MSH 1.0.0 – My SmartHome-dashbord for Home Assistant · https://github.com/SebastianKristo/ki-msh */

/* ---- 00-base.js ---- */
try {
/* KI MSH · felles hjelpere (window.MSH)
 * Alle kort i ki-msh bruker disse: ikoner, haptic, farger, fonter, autokonfig,
 * historikk, portal/overlegg, toast, config-lagring, basekortklasse og DOM-patching.
 */
(function () {
  if (window.MSH && window.MSH.__v) return;
  const MSH = (window.MSH = window.MSH || {});
  MSH.__v = '1.0.0';

  /* ------------------------------------------------------------ fonter */
  // @font-face virker ikke i shadow DOM → last Space Grotesk én gang på dokumentnivå.
  MSH.loadFonts = function () {
    if (document.getElementById('msh-fonts')) return;
    const l = document.createElement('link');
    l.id = 'msh-fonts';
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600&display=swap';
    (document.head || document.documentElement).appendChild(l);
  };
  MSH.loadFonts();
  MSH.FONT = "'Space Grotesk', var(--ha-font-family-body, system-ui), sans-serif";

  /* ------------------------------------------------------------ farger */
  const THEME = [['red', '#f28073', 'Rød'], ['orange', '#f2b573', 'Oransje'], ['yellow', '#f2d26f', 'Gul'], ['lime', '#b8e674', 'Lime'], ['green', '#66d19e', 'Grønn'], ['blue', '#73b9f2', 'Blå'], ['light-blue', '#c8ddfa', 'Lyseblå'], ['purple', '#ad99e6', 'Lilla'], ['pink', '#f285c9', 'Rosa'], ['brown', '#8c794d', 'Brun'],
    ['gray000', '#232323', 'Grå 000'], ['gray100', '#2f2f2f', 'Grå 100'], ['gray200', '#3a3a3a', 'Grå 200'], ['gray300', '#404040', 'Grå 300'], ['gray400', '#545454', 'Grå 400'], ['gray500', '#696969', 'Grå 500'], ['gray600', '#7f7f7f', 'Grå 600'], ['gray700', '#979797', 'Grå 700'], ['gray800', '#afafaf', 'Grå 800'], ['gray900', '#c7c7c7', 'Grå 900'], ['gray1000', '#e1e1e1', 'Grå 1000'], ['white', '#fafafa', 'Hvit']];
  const HAC = [['primary', '#03a9f4', 'Primær'], ['accent', '#ff9800', 'Aksent'], ['red', '#f44336'], ['pink', '#e91e63'], ['purple', '#926bc7'], ['deep-purple', '#6e41ab'], ['indigo', '#3f51b5'], ['blue', '#2196f3'], ['light-blue', '#03a9f4'], ['cyan', '#00bcd4'], ['teal', '#009688'], ['green', '#4caf50'], ['light-green', '#8bc34a'], ['lime', '#cddc39'], ['yellow', '#ffeb3b'], ['amber', '#ffc107'], ['orange', '#ff9800'], ['deep-orange', '#ff5722'], ['brown', '#795548'], ['light-grey', '#bdbdbd'], ['grey', '#9e9e9e'], ['dark-grey', '#606060'], ['blue-grey', '#607d8b'], ['black', '#000000'], ['white', '#ffffff']];
  MSH.THEME_COLORS = THEME;
  MSH.HA_COLORS = HAC;
  // C.red → 'var(--red, #f28073)' osv. Bruk alltid disse i stedet for rå hex.
  const C = {};
  THEME.forEach(([k, hex]) => { C[k.replace(/-(\w)/g, (_, c) => c.toUpperCase())] = `var(--${k}, ${hex})`; });
  C.pink = 'var(--pink, #f285c9)';
  C.accent = 'linear-gradient(145deg, rgb(242 133 201) -10%, rgb(245 205 198) 100%)';
  C.dash = 'var(--gray000, #232323)';
  C.popup = '#282828';
  C.card = 'var(--gray200, #3a3a3a)';
  C.inner = 'var(--gray300, #404040)';
  C.ctrl = 'var(--gray400, #545454)';
  C.edge = 'inset 0 0 0 1px rgba(255,255,255,0.05)';
  MSH.C = C;
  // Løs opp 'var(--x, #hex)' til faktisk farge (for canvas/SVG-beregning).
  MSH.resolveColor = function (v) {
    const m = /^var\((--[\w-]+)\s*(?:,\s*([^)]+))?\)$/.exec(String(v || '').trim());
    if (!m) return v;
    const r = getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim();
    return r || (m[2] || '').trim() || v;
  };
  // Normaliser en konfigurert farge: 'red' → var(--red, #f28073); 'var(--red)' → med fallback; hex beholdes.
  MSH.color = function (v, fallback) {
    if (v == null || v === '') return fallback;
    const s = String(v).trim();
    const t = THEME.find((x) => x[0] === s);
    if (t) return `var(--${t[0]}, ${t[1]})`;
    const m = /^var\(--([\w-]+)\)$/.exec(s);
    if (m) {
      const th = THEME.find((x) => x[0] === m[1]);
      if (th) return `var(--${th[0]}, ${th[1]})`;
      const ha = HAC.find((x) => x[0] + '-color' === m[1]);
      if (ha) return `var(--${m[1]}, ${ha[1]})`;
    }
    return s;
  };
  // Alfa på en farge: fungerer for var(), hex og rgb() via color-mix.
  MSH.alpha = (c, a) => `color-mix(in srgb, ${c} ${Math.round(a * 100)}%, transparent)`;

  /* ------------------------------------------------------------ tekst/tall */
  MSH.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  MSH.nf = (n, d = 0) => (n == null || isNaN(n) ? '–' : Number(n).toLocaleString('nb-NO', { minimumFractionDigits: d, maximumFractionDigits: d }));
  MSH.slug = (n) => String(n || '').toLowerCase().replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'a').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  MSH.uid = () => 'msh_' + Math.random().toString(36).slice(2, 10);
  MSH.pad = (n) => String(n).padStart(2, '0');
  MSH.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  MSH.relTime = function (iso) {
    if (!iso) return '–';
    const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return 'nå';
    if (s < 3600) return `${Math.round(s / 60)} min siden`;
    if (s < 86400) return `${Math.round(s / 3600)} t siden`;
    return `${Math.round(s / 86400)} d siden`;
  };

  /* ------------------------------------------------------------ ikoner */
  // Material Symbols-navn fra designfilene → mdi:. Ukjente navn prøves som mdi:<navn-med-bindestrek>.
  const MS = {
    add: 'plus', add_circle: 'plus-circle', add_link: 'link-plus', add_location_alt: 'map-marker-plus', apps: 'apps', arrow_downward: 'arrow-down', arrow_upward: 'arrow-up', arrow_drop_down: 'menu-down', arrow_forward: 'arrow-right', arrow_back: 'arrow-left',
    auto_awesome: 'creation', battery_5_bar: 'battery-70', battery_alert: 'battery-alert', battery_charging_full: 'battery-charging', bed: 'bed', bolt: 'lightning-bolt', calendar_month: 'calendar-month', cast: 'cast', check: 'check', check_circle: 'check-circle',
    chevron_left: 'chevron-left', chevron_right: 'chevron-right', circle: 'circle', close: 'close', cloud: 'weather-cloudy', colorize: 'eyedropper', compress: 'arrow-collapse-vertical', dark_mode: 'weather-night', delete: 'delete', dialpad: 'dialpad',
    directions_walk: 'walk', directions_run: 'run', directions_bus: 'bus', directions_car: 'car', directions_boat: 'ferry', drag_indicator: 'drag', edit: 'pencil', expand_less: 'chevron-up', expand_more: 'chevron-down', floor_lamp: 'floor-lamp', history: 'history', home: 'home',
    humidity_percentage: 'water-percent', keyboard_arrow_down: 'chevron-down', keyboard_arrow_left: 'chevron-left', keyboard_arrow_right: 'chevron-right', keyboard_arrow_up: 'chevron-up', light_mode: 'white-balance-sunny', lightbulb: 'lightbulb', list: 'format-list-bulleted',
    lock_clock: 'lock-clock', more_horiz: 'dots-horizontal', navigation: 'navigation', open_in_full: 'arrow-expand', open_in_new: 'open-in-new', palette: 'palette', partly_cloudy_day: 'weather-partly-cloudy', partly_cloudy_night: 'weather-night-partly-cloudy', person: 'account',
    pill: 'pill', play_arrow: 'play', play_circle: 'play-circle', pool: 'pool', power_settings_new: 'power', radio: 'radio', remove: 'minus', remove_circle: 'minus-circle', repeat: 'repeat', restart_alt: 'restart', search: 'magnify', sensors: 'access-point',
    settings: 'cog', shield: 'shield', shuffle: 'shuffle', skip_next: 'skip-next', skip_previous: 'skip-previous', smart_toy: 'robot', smartphone: 'cellphone', speaker: 'speaker', sprinkler: 'sprinkler', stop: 'stop', storm: 'weather-lightning-rainy', summarize: 'text-box-outline',
    swap_horiz: 'swap-horizontal', terminal: 'console', thermostat: 'thermostat', tram: 'tram', tune: 'tune', tv: 'television', verified_user: 'shield-check', videocam: 'video', visibility: 'eye', visibility_off: 'eye-off', warning: 'alert', water_drop: 'water', wb_twilight: 'weather-sunset',
    lock: 'lock', lock_open: 'lock-open-variant', power: 'power-plug', heat: 'fire', window: 'window-closed-variant', bedtime: 'weather-night', garage: 'garage', weekend: 'sofa', sensor_occupied: 'motion-sensor', door_front: 'door', door_open: 'door-open', park: 'pine-tree',
    dry_cleaning: 'tumble-dryer', sun: 'white-balance-sunny', roofing: 'home-roof', heat_pump: 'heat-pump', grass: 'grass', subway: 'subway-variant', bus: 'bus', rain: 'weather-rainy', music_note: 'music-note', local_laundry_service: 'washing-machine', thermometer: 'thermometer',
    alarm: 'alarm', today: 'calendar-today', star: 'star', robot_2: 'robot-vacuum', school: 'school', pause: 'pause', key: 'key', events: 'calendar', dns: 'dns', dishwasher_gen: 'dishwasher', computer: 'desktop-tower-monitor', air: 'weather-windy', work: 'briefcase', wb_sunny: 'weather-sunny',
    water_pump: 'water-pump', water_heater: 'water-boiler', time: 'clock-outline', schedule: 'clock-outline', savings: 'piggy-bank', room: 'map-marker', rainy: 'weather-rainy', presence: 'account-check', local_fire_department: 'fire', kitchen: 'fridge', help: 'help-circle', handyman: 'tools',
    eco: 'leaf', desktop_windows: 'monitor', checklist: 'format-list-checks', bathtub: 'bathtub', backspace: 'backspace-outline', wind: 'weather-windy', weather_snowy: 'weather-snowy', water: 'water', volunteer_activism: 'hand-heart', view_week: 'view-week', view_agenda: 'view-agenda',
    vertical_align_top: 'format-vertical-align-top', vertical_align_bottom: 'format-vertical-align-bottom', timer: 'timer-outline', thunderstorm: 'weather-lightning', stairs: 'stairs', spa: 'spa', shower: 'shower', settings_power: 'power-settings', restaurant: 'silverware-fork-knife', receipt_long: 'receipt',
    potted_plant: 'flower', movie: 'movie', mode_fan: 'fan', menu: 'menu', luggage: 'bag-suitcase', location_on: 'map-marker', local_gas_station: 'gas-station', lights_on: 'lightbulb-group', light_off: 'lightbulb-off', grid_view: 'view-grid', fog: 'weather-fog', flight: 'airplane',
    event_repeat: 'calendar-sync', ecg_heart: 'heart-pulse', curtains: 'curtains', cottage: 'home-variant', clear_day: 'weather-sunny', brightness_4: 'brightness-4', autorenew: 'autorenew', apartment: 'office-building', agriculture: 'tractor', ac_unit: 'snowflake', yard: 'flower-tulip',
    winter: 'snowflake', weather_mix: 'weather-snowy-rainy', water_damage: 'water-alert', wash: 'washing-machine', volume_up: 'volume-high', volume_down: 'volume-medium', volume_off: 'volume-off', train: 'train', thermostat_auto: 'thermostat-auto', stethoscope: 'stethoscope', smart_display: 'monitor-dashboard',
    sleet: 'weather-hail', single_bed: 'bed-single', severe_cold: 'snowflake-alert', sailing: 'sail-boat', rule: 'format-list-checks', remove_moderator: 'shield-off', radio_button_checked: 'radiobox-marked', queue_music: 'playlist-music', query_stats: 'chart-timeline-variant', printer: 'printer',
    package_2: 'package-variant', outlet: 'power-socket-eu', notifications: 'bell', no_sound: 'volume-off', mouse: 'mouse', monitor: 'monitor', location_city: 'city', label: 'label', king_bed: 'bed-king', groups: 'account-group', graphic_eq: 'equalizer', forest: 'forest', foggy: 'weather-fog', flood: 'home-flood',
    fitness_center: 'dumbbell', event_note: 'calendar-text', electric_car: 'car-electric', done: 'check', do_not_disturb_on: 'minus-circle', deck: 'deck', dashboard: 'view-dashboard', countertops: 'countertop', coffee_maker: 'coffee-maker', cleaning_services: 'broom', chair: 'chair-rolling',
    alarm_on: 'alarm-check', alarm_off: 'alarm-off', airplay: 'airplay', album: 'album', wifi: 'wifi', waving_hand: 'hand-wave', waves: 'waves', warehouse: 'warehouse', wall_lamp: 'wall-sconce', toys: 'toy-brick', touch_app: 'gesture-tap', toggle_on: 'toggle-switch', trending_up: 'trending-up',
    sync: 'sync', switch: 'toggle-switch', sunny: 'weather-sunny', sticky_note: 'note', stop_circle: 'stop-circle', ssid_chart: 'chart-line', sports_esports: 'gamepad-variant', space_dashboard: 'view-dashboard-variant', solar_power: 'solar-power', signal_cellular_alt: 'signal-cellular-3',
    shopping_cart: 'cart', shield_lock: 'shield-lock', settings_remote: 'remote', sensor_window: 'window-open-variant', psychology: 'head-cog', price_change: 'currency-usd', play_pause: 'play-pause', piano: 'piano', photo_camera: 'camera', notifications_active: 'bell-ring', notification_important: 'bell-alert',
    motion_play: 'motion-play', microwave: 'microwave', meeting_room: 'door', local_hospital: 'hospital-box', living: 'sofa-single', live_tv: 'television-play', library_books: 'bookshelf', inventory_2: 'archive', hourglass_top: 'timer-sand', home_pin: 'home-map-marker', glyph: 'shape',
    functions: 'function-variant', fullscreen: 'fullscreen', forum: 'forum', flashlight_on: 'flashlight', fireplace: 'fireplace', favorite: 'heart', emoji_food_beverage: 'coffee', electrical_services: 'power-plug', electric_meter: 'meter-electric', door_sliding: 'door-sliding', dining: 'silverware',
    device_thermostat: 'thermometer', detector_smoke: 'smoke-detector', data_thresholding: 'chart-bar', dashboard_customize: 'view-dashboard-edit', crop_square: 'crop-square', crop_portrait: 'crop-portrait', crop_16_9: 'crop-landscape', crib: 'baby-carriage', coronavirus: 'virus', co2: 'molecule-co2',
    child_care: 'baby-face', checkroom: 'hanger', campaign: 'bullhorn', cabin: 'home-variant', build: 'wrench', breakfast_dining: 'bread-slice', border_all: 'border-all', blinds: 'blinds', battery_full: 'battery', bar_chart: 'chart-bar', balcony: 'balcony', balance: 'scale-balance', back_hand: 'hand-back-right',
    avg_pace: 'speedometer', appletv: 'apple', animation: 'animation', account_circle: 'account-circle', sensor_door: 'door', mode_night: 'weather-night', nightlight: 'weather-night', light: 'lightbulb', lamp: 'lamp', videocam_off: 'video-off', security: 'security', vpn_key: 'key',
    thermostat_carbon: 'thermostat', water_full: 'water', opacity: 'water-opacity', grain: 'grain', device_hub: 'hub', router: 'router-wireless', hub: 'hub', info: 'information-outline', error: 'alert-circle', block: 'cancel', link: 'link', unlink: 'link-off', person_add: 'account-plus',
    humidity_high: 'water-percent', humidity_low: 'water-percent', umbrella: 'umbrella', thunder: 'weather-lightning', snow: 'weather-snowy', cloudy: 'weather-cloudy', moon: 'weather-night', directions_bike: 'bike', local_shipping: 'truck', recycling: 'recycle', mode_heat: 'fire', mode_cool: 'snowflake',
    speed: 'speedometer', filter_alt: 'filter', science: 'flask', bubble_chart: 'chart-bubble', compost: 'compost', delete_sweep: 'delete-sweep', nature: 'tree', pets: 'paw', lightbulb_circle: 'lightbulb-on', emergency_home: 'home-alert', gpp_maybe: 'shield-alert', gpp_good: 'shield-check',
  };
  MSH.MS_MAP = MS;
  MSH.iconName = function (name) {
    if (!name) return 'mdi:help-circle-outline';
    const n = String(name).trim();
    if (n.indexOf(':') > 0) return n; // mdi:, hass:, phu:, hue:, fapro:, si: …
    return 'mdi:' + (MS[n] || n.replace(/_/g, '-'));
  };
  // Ikon med fast størrelse som aldri påvirker layouten rundt.
  MSH.icon = function (name, size = 24, style = '') {
    const s = Number(size) || 24;
    return `<ha-icon icon="${MSH.esc(MSH.iconName(name))}" style="--mdc-icon-size:${s}px;width:${s}px;height:${s}px;flex:none;display:inline-flex;align-items:center;justify-content:center;line-height:0;${style}"></ha-icon>`;
  };
  MSH.renderIcon = MSH.icon;
  MSH.domainIcon = function (id, st) {
    if (st && st.attributes && st.attributes.icon) return st.attributes.icon;
    const d = String(id || '').split('.')[0], dc = st && st.attributes && st.attributes.device_class, on = st && ['on', 'open', 'playing', 'unlocked', 'home'].includes(st.state);
    const DC = { temperature: 'thermometer', humidity: 'water-percent', power: 'flash', energy: 'lightning-bolt', illuminance: 'brightness-5', door: on ? 'door-open' : 'door-closed', window: on ? 'window-open-variant' : 'window-closed-variant', motion: on ? 'motion-sensor' : 'motion-sensor-off', occupancy: 'home-account', presence: 'home-account', moisture: 'water-alert', smoke: 'smoke-detector', opening: on ? 'door-open' : 'door-closed', garage_door: 'garage', battery: 'battery', vibration: 'vibrate', ph: 'ph', carbon_dioxide: 'molecule-co2' };
    if (dc && DC[dc]) return 'mdi:' + DC[dc];
    const D = { light: on ? 'lightbulb' : 'lightbulb-outline', switch: on ? 'toggle-switch' : 'toggle-switch-off-outline', fan: 'fan', climate: 'thermostat', media_player: 'speaker', cover: 'blinds', lock: on ? 'lock-open-variant' : 'lock', camera: 'video', sensor: 'eye', binary_sensor: 'checkbox-blank-circle-outline', person: 'account', script: 'script-text', scene: 'palette', button: 'gesture-tap-button', weather: 'weather-partly-cloudy', todo: 'format-list-checks', vacuum: 'robot-vacuum', valve: 'valve', alarm_control_panel: 'shield-home', input_boolean: 'toggle-switch', water_heater: 'water-boiler', humidifier: 'air-humidifier', number: 'ray-vertex', select: 'format-list-bulleted' };
    return 'mdi:' + (D[d] || 'help-circle-outline');
  };

  /* ------------------------------------------------------------ haptic */
  // HA-eventet 'haptic' (companion-appen) + navigator.vibrate som fallback. Maks én per 40 ms.
  const HP = { light: 8, selection: 5, medium: 16, heavy: 30, success: [10, 60, 16], warning: [18, 80, 18], failure: [26, 50, 26, 50, 26] };
  let lastHaptic = 0;
  MSH.haptic = function (type) {
    type = HP[type] ? type : 'light';
    try { if (localStorage.getItem('haptic') === 'off') return; } catch (e) { /* */ }
    const now = Date.now();
    if (now - lastHaptic < 40) return;
    lastHaptic = now;
    try { window.dispatchEvent(new CustomEvent('haptic', { detail: type, bubbles: true, composed: true })); } catch (e) { /* */ }
    try { navigator.vibrate && navigator.vibrate(HP[type]); } catch (e) { /* */ }
  };

  /* ------------------------------------------------------------ hass-hjelpere */
  MSH.st = (hass, id) => (hass && id && hass.states[id]) || null;
  MSH.isNum = (v) => v !== null && v !== '' && !isNaN(Number(v));
  MSH.num = function (hass, id) {
    const s = MSH.st(hass, id);
    if (!s || !MSH.isNum(s.state)) return null;
    return Number(s.state);
  };
  MSH.attr = (hass, id, a) => { const s = MSH.st(hass, id); return s ? s.attributes[a] : undefined; };
  MSH.name = function (hass, id, strip) {
    const s = MSH.st(hass, id);
    let n = (s && s.attributes.friendly_name) || (id ? id.split('.')[1].replace(/_/g, ' ') : '–');
    if (strip) { const r = new RegExp('^' + String(strip).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s+', 'i'); n = n.replace(r, '') || n; }
    return n;
  };
  MSH.unavailable = (s) => !s || s.state === 'unavailable' || s.state === 'unknown';
  MSH.isOn = function (s) {
    if (!s) return false;
    return ['on', 'open', 'opening', 'playing', 'heat', 'cool', 'heat_cool', 'auto', 'dry', 'fan_only', 'unlocked', 'home', 'cleaning', 'armed_away', 'armed_home', 'armed_night', 'triggered'].includes(s.state);
  };
  MSH.fmtState = function (hass, id) {
    const s = MSH.st(hass, id);
    if (!s) return '–';
    if (hass.formatEntityState) { try { return hass.formatEntityState(s); } catch (e) { /* */ } }
    const u = s.attributes.unit_of_measurement;
    return MSH.isNum(s.state) ? MSH.nf(Number(s.state), Number(s.state) % 1 ? 1 : 0) + (u ? ' ' + u : '') : s.state;
  };
  MSH.call = function (hass, domain, service, data) {
    if (!hass) return Promise.resolve();
    return hass.callService(domain, service, data || {}).catch((e) => { MSH.toast('Feil: ' + (e && e.message ? e.message : e)); throw e; });
  };
  MSH.toggle = function (hass, id) {
    const d = id.split('.')[0];
    if (d === 'script') return MSH.call(hass, 'script', 'turn_on', { entity_id: id });
    if (d === 'scene') return MSH.call(hass, 'scene', 'turn_on', { entity_id: id });
    if (d === 'button' || d === 'input_button') return MSH.call(hass, d, 'press', { entity_id: id });
    if (d === 'lock') { const s = MSH.st(hass, id); return MSH.call(hass, 'lock', s && s.state === 'locked' ? 'unlock' : 'lock', { entity_id: id }); }
    if (d === 'cover') return MSH.call(hass, 'cover', 'toggle', { entity_id: id });
    if (d === 'valve') return MSH.call(hass, 'valve', 'toggle', { entity_id: id });
    if (d === 'media_player') return MSH.call(hass, 'media_player', 'media_play_pause', { entity_id: id });
    return MSH.call(hass, 'homeassistant', 'toggle', { entity_id: id });
  };
  // Åpne HAs egen more-info (den ligger på rot-nivå, så transform i popupen påvirker den ikke).
  MSH.moreInfo = function (el, entityId) {
    if (!entityId) return;
    const ev = new CustomEvent('hass-more-info', { detail: { entityId }, bubbles: true, composed: true });
    (el || document.querySelector('home-assistant') || window).dispatchEvent(ev);
  };
  MSH.navigate = function (path) {
    if (!path) return;
    if (path[0] === '#') { location.hash = path; return; }
    history.pushState(null, '', path);
    window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: false } }));
  };
  // Åpne en Bubble Card-popup via hash.
  MSH.openPopup = function (hash) {
    if (!hash) return;
    let h = String(hash).trim();
    if (h[0] !== '#') h = '#' + h;
    location.hash = h;
  };

  /* ------------------------------------------------------------ autokonfig */
  // Entitetsregister-oppslag med samme regler som KI Rom: hopp over skjulte/deaktiverte,
  // config/diagnostic og grupper.
  MSH.regEntry = (hass, id) => (hass && hass.entities && hass.entities[id]) || null;
  MSH.areaOf = function (hass, id) {
    const e = MSH.regEntry(hass, id);
    if (!e) return null;
    if (e.area_id) return e.area_id;
    const d = e.device_id && hass.devices && hass.devices[e.device_id];
    return (d && d.area_id) || null;
  };
  MSH.usable = function (hass, id) {
    const s = hass.states[id];
    if (!s) return false;
    const e = MSH.regEntry(hass, id);
    if (e && (e.hidden || e.hidden_by || e.disabled_by || e.entity_category)) return false;
    if (Array.isArray(s.attributes.entity_id) && !id.startsWith('media_player.')) return false; // grupper
    return true;
  };
  MSH.all = function (hass, domain, filter) {
    if (!hass) return [];
    const doms = Array.isArray(domain) ? domain : [domain];
    return Object.keys(hass.states).filter((id) => doms.includes(id.split('.')[0]) && MSH.usable(hass, id) && (!filter || filter(hass.states[id], id))).sort();
  };
  MSH.byClass = (hass, domain, dc, area) => MSH.all(hass, domain, (s, id) => s.attributes.device_class === dc && (!area || MSH.areaOf(hass, id) === area));
  MSH.byPlatform = (hass, platform, domain) => Object.keys((hass && hass.entities) || {}).filter((id) => hass.entities[id].platform === platform && (!domain || id.startsWith(domain + '.')) && hass.states[id]).sort();
  MSH.areaEntities = function (hass, area, domain) {
    return MSH.all(hass, domain || Object.keys(hass.states).map((i) => i.split('.')[0]).filter((v, i, a) => a.indexOf(v) === i), (s, id) => MSH.areaOf(hass, id) === area);
  };
  MSH.areas = function (hass) {
    const A = (hass && hass.areas) || {}, F = (hass && hass.floors) || {};
    return Object.values(A).map((a) => {
      const f = a.floor_id && F[a.floor_id];
      return { id: a.area_id, name: a.name, icon: a.icon || null, picture: a.picture || null, floor: a.floor_id || null, floorName: f ? f.name : null, level: f ? f.level : null };
    }).sort((x, y) => (x.level ?? 99) - (y.level ?? 99) || x.name.localeCompare(y.name, 'nb'));
  };
  MSH.floors = (hass) => Object.values((hass && hass.floors) || {}).sort((a, b) => (a.level ?? 0) - (b.level ?? 0));
  MSH.areaName = (hass, id) => (hass && hass.areas && hass.areas[id] && hass.areas[id].name) || id || '–';
  // Finn område ut fra navn/slug (f.eks. «Basseng», «pool», «Hage»).
  MSH.findArea = function (hass, ...names) {
    const A = Object.values((hass && hass.areas) || {});
    for (const n of names) {
      const s = MSH.slug(n);
      const a = A.find((x) => x.area_id === s || MSH.slug(x.name) === s) || A.find((x) => MSH.slug(x.name).includes(s) || x.area_id.includes(s));
      if (a) return a.area_id;
    }
    return null;
  };
  // KI Rom-sensor for et område: sensor.<rom>_oversikt (attributes.integrasjon === 'ki_rom').
  MSH.kiRom = function (hass, area, kind = 'oversikt') {
    if (!hass) return null;
    const aid = area || 'hele_huset';
    let ov = null;
    for (const id in hass.states) {
      if (!id.startsWith('sensor.') || !id.endsWith('_oversikt')) continue;
      const a = hass.states[id].attributes;
      if (a.integrasjon === 'ki_rom' && a.area_id === aid) { ov = id; break; }
    }
    if (!ov && hass.states[`sensor.${aid}_oversikt`]) ov = `sensor.${aid}_oversikt`;
    if (!ov) {
      const guess = `sensor.${aid}_${kind}`;
      return hass.states[guess] ? hass.states[guess] : null;
    }
    if (kind === 'oversikt') return hass.states[ov];
    return hass.states[ov.replace(/_oversikt$/, '_' + kind)] || null;
  };
  MSH.kiRomId = function (hass, area, kind) { const s = MSH.kiRom(hass, area, kind); return s ? s.entity_id : null; };
  // Liste fra KI Rom-attributt (strenger eller {entity: …}).
  MSH.ids = (list) => (Array.isArray(list) ? list.map((x) => (typeof x === 'string' ? x : x && x.entity)).filter(Boolean) : []);
  // Overstyring: overrides vinner alltid.
  MSH.pick = function (config, field, auto) {
    const o = config && config.overrides && config.overrides[field];
    return o || auto || null;
  };
  // Autoliste → fjern exclude, legg til include[key].
  MSH.applyLists = function (config, key, list) {
    const ex = new Set((config && config.exclude) || []);
    const inc = (config && config.include && config.include[key]) || [];
    const out = (list || []).filter((id) => !ex.has(id));
    inc.forEach((id) => { if (!out.includes(id) && !ex.has(id)) out.push(id); });
    return out;
  };

  /* ------------------------------------------------------------ historikk */
  // Kun når popupen åpnes, minimal_response + no_attributes, cache 5 min per entitet.
  const HCACHE = new Map();
  MSH.history = async function (hass, ids, hours = 24) {
    ids = (ids || []).filter((id) => id && hass && hass.states[id]);
    const now = Date.now(), out = {}, need = [];
    ids.forEach((id) => {
      const c = HCACHE.get(id + '|' + hours);
      if (c && now - c.t < 300000) out[id] = c.d; else need.push(id);
    });
    if (need.length && hass && hass.callWS) {
      try {
        const r = await hass.callWS({
          type: 'history/history_during_period',
          start_time: new Date(now - hours * 3600000).toISOString(),
          end_time: new Date(now).toISOString(),
          entity_ids: need, minimal_response: true, no_attributes: true, significant_changes_only: false,
        });
        need.forEach((id) => {
          const arr = (r && r[id]) || [];
          const d = arr.map((p) => ({ t: (p.lu != null ? p.lu * 1000 : new Date(p.last_changed || p.last_updated).getTime()), v: parseFloat(p.s != null ? p.s : p.state) })).filter((p) => !isNaN(p.v));
          HCACHE.set(id + '|' + hours, { t: now, d });
          out[id] = d;
        });
      } catch (e) { need.forEach((id) => { out[id] = []; }); }
    }
    // siste punkt fra live hass
    ids.forEach((id) => {
      const v = MSH.num(hass, id);
      if (v != null) out[id] = (out[id] || []).concat([{ t: now, v }]);
    });
    return out;
  };
  // Samplet serie (n punkter jevnt over perioden, trinnvis).
  MSH.sample = function (pts, n = 48, hours = 24) {
    if (!pts || !pts.length) return [];
    const end = Date.now(), start = end - hours * 3600000, out = [];
    let j = 0, cur = pts[0].v;
    for (let i = 0; i < n; i++) {
      const t = start + (i / (n - 1)) * (end - start);
      while (j < pts.length && pts[j].t <= t) { cur = pts[j].v; j++; }
      out.push(cur);
    }
    return out;
  };
  // SVG-polyline for en serie i viewBox 0..w × 0..h.
  MSH.linePoints = function (vals, w = 300, h = 100, pad = 10) {
    if (!vals || !vals.length) return { line: `0,${h / 2} ${w},${h / 2}`, area: `0,${h} 0,${h / 2} ${w},${h / 2} ${w},${h}`, min: null, max: null, y: () => h / 2 };
    const mn = Math.min(...vals), mx = Math.max(...vals), span = mx - mn || 1;
    const y = (v) => h - pad - ((v - mn) / span) * (h - pad * 2);
    const pts = vals.map((v, i) => `${((i / Math.max(1, vals.length - 1)) * w).toFixed(1)},${y(v).toFixed(1)}`);
    return { line: pts.join(' '), area: `0,${h} ${pts.join(' ')} ${w},${h}`, min: mn, max: mx, y };
  };

  /* ------------------------------------------------------------ popup/hash */
  // Finn Bubble Card-popupen kortet ligger i (på tvers av shadow roots).
  MSH.popupHash = function (el) {
    let n = el;
    for (let i = 0; n && i < 60; i++) {
      if (n.tagName === 'BUBBLE-CARD' && n.config && n.config.card_type === 'pop-up') return n.config.hash || null;
      if (n.tagName === 'BUBBLE-CARD' && n._config && n._config.card_type === 'pop-up') return n._config.hash || null;
      n = n.parentNode || n.host;
    }
    return null;
  };
  MSH.isPopupOpen = function (el) {
    const h = MSH.popupHash(el);
    return !h || location.hash === h;
  };

  /* ------------------------------------------------------------ dashbordflate */
  function deep(root, sel, depth = 0) {
    if (!root || depth > 12) return null;
    const hit = root.querySelector && root.querySelector(sel);
    if (hit) return hit;
    const all = root.querySelectorAll ? root.querySelectorAll('*') : [];
    for (const el of all) {
      if (el.shadowRoot) { const r = deep(el.shadowRoot, sel, depth + 1); if (r) return r; }
    }
    return null;
  }
  MSH.deep = deep;
  let dashEl = null;
  // Rektangelet til dashbordflaten (aldri HA-sidebaren).
  MSH.dashRect = function () {
    if (!dashEl || !dashEl.isConnected) {
      const ha = document.querySelector('home-assistant');
      const panel = ha && deep(ha.shadowRoot, 'ha-panel-lovelace');
      const root = panel && panel.shadowRoot && panel.shadowRoot.querySelector('hui-root');
      dashEl = (root && root.shadowRoot && (root.shadowRoot.querySelector('#view') || root.shadowRoot.querySelector('hui-view-container'))) || panel || null;
    }
    if (dashEl) {
      const r = dashEl.getBoundingClientRect();
      if (r.width > 0) return { left: r.left, top: Math.max(0, r.top), width: r.width, height: window.innerHeight - Math.max(0, r.top), right: r.right };
    }
    return { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight, right: window.innerWidth };
  };

  /* ------------------------------------------------------------ portal/overlegg */
  // Overlegg (ark, tastatur, tilpasning) portales til document.body og plasseres mot dashbordflaten,
  // fordi Bubble Card bruker transform på popupen (position: fixed blir ellers relativt til popupen).
  MSH.overlay = function ({ html = '', css = '', sheet = true, maxWidth = 420, onClose, center = false } = {}) {
    const host = document.createElement('div');
    host.className = 'msh-portal';
    const R = MSH.dashRect();
    Object.assign(host.style, { position: 'fixed', left: R.left + 'px', top: '0', width: R.width + 'px', height: '100%', zIndex: '9', pointerEvents: 'auto' });
    const sr = host.attachShadow({ mode: 'open' });
    sr.innerHTML = `<style>${MSH.BASE_CSS}
      .bg{position:absolute;inset:0;background:rgba(0,0,0,0.55);opacity:0;transition:opacity .2s}
      .sh{position:absolute;left:0;right:0;${center ? 'top:50%;transform:translateY(-40%) scale(.96);border-radius:32px;' : 'bottom:0;transform:translateY(30px);border-radius:32px 32px 0 0;'}max-width:${maxWidth}px;margin:0 auto;box-sizing:border-box;max-height:${center ? '90%' : '88%'};overflow:auto;overscroll-behavior:contain;
        padding:12px 18px calc(28px + env(safe-area-inset-bottom));background:var(--gray100,#2f2f2f);box-shadow:0 -20px 50px rgba(0,0,0,0.5);opacity:0;transition:transform .3s cubic-bezier(.34,1.3,.64,1),opacity .2s;color:#fafafa;font-family:${MSH.FONT}}
      :host(.on) .bg{opacity:1} :host(.on) .sh{opacity:1;transform:${center ? 'translateY(-50%) scale(1)' : 'translateY(0)'}}
      .grab{width:40px;height:5px;border-radius:3px;background:var(--gray400,#545454);margin:0 auto 12px}
      ${css}</style><div class="bg"></div><div class="sh" part="sheet">${sheet && !center ? '<div class="grab"></div>' : ''}<div class="body">${html}</div></div>`;
    const stop = (e) => e.stopPropagation();
    ['pointerdown', 'touchstart', 'touchmove', 'wheel'].forEach((t) => sr.querySelector('.sh').addEventListener(t, stop, { passive: true }));
    const close = () => {
      host.classList.remove('on');
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('hashchange', onHash);
      setTimeout(() => host.remove(), 250);
      onClose && onClose();
    };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    const hash0 = location.hash;
    const onHash = () => { if (location.hash !== hash0) close(); };
    sr.querySelector('.bg').addEventListener('click', () => { MSH.haptic('light'); close(); });
    window.addEventListener('keydown', onKey);
    window.addEventListener('hashchange', onHash);
    document.body.appendChild(host);
    requestAnimationFrame(() => host.classList.add('on'));
    return { host, root: sr, body: sr.querySelector('.body'), close };
  };

  // Bekreftelsesmelding: 44 px pill, #e1e1e1 / #232323, top 106 px, sentrert i dashbordflaten, 2,2 s.
  MSH.toast = function (text, opts) {
    if (opts && opts.enabled === false) return;
    const R = MSH.dashRect();
    const old = document.getElementById('msh-toast');
    if (old) old.remove();
    const t = document.createElement('div');
    t.id = 'msh-toast';
    t.textContent = text;
    Object.assign(t.style, {
      position: 'fixed', top: '106px', left: R.left + R.width / 2 + 'px', transform: 'translate(-50%,-12px)', zIndex: '10', height: '44px', padding: '0 22px', borderRadius: '22px',
      display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', background: 'var(--gray1000, #e1e1e1)', color: 'var(--gray000, #232323)', font: `500 14px ${MSH.FONT}`,
      boxShadow: '0 12px 30px rgba(0,0,0,0.45)', opacity: '0', transition: 'opacity .2s, transform .3s cubic-bezier(.34,1.4,.64,1)', pointerEvents: 'none',
    });
    document.body.appendChild(t);
    requestAnimationFrame(() => { t.style.opacity = '1'; t.style.transform = 'translate(-50%,0)'; });
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 250); }, 2200);
  };

  /* ------------------------------------------------------------ drag-vern */
  // Alle drag-elementer: touch-action + stopPropagation så Bubble Card ikke lukker/scroller popupen.
  MSH.guardDrag = function (el, axis = 'both') {
    if (!el || el.__mshGuard) return;
    el.__mshGuard = true;
    el.style.touchAction = axis === 'x' ? 'pan-y' : axis === 'y' ? 'pan-x' : 'none';
    const stop = (e) => e.stopPropagation();
    el.addEventListener('pointerdown', stop);
    el.addEventListener('touchstart', stop, { passive: true });
    el.addEventListener('touchmove', stop, { passive: true });
  };
  // Enkel drag-hjelper: onMove(frac 0..1, e), onEnd(frac). Horisontal som standard.
  MSH.drag = function (el, { axis = 'x', onStart, onMove, onEnd } = {}) {
    MSH.guardDrag(el, axis === 'x' ? 'none' : 'none');
    let on = false, lastStep = null;
    const frac = (e) => {
      const r = el.getBoundingClientRect();
      return axis === 'x' ? MSH.clamp((e.clientX - r.left) / r.width, 0, 1) : MSH.clamp(1 - (e.clientY - r.top) / r.height, 0, 1);
    };
    el.addEventListener('pointerdown', (e) => {
      if (e.button) return;
      on = true;
      try { el.setPointerCapture(e.pointerId); } catch (x) { /* */ }
      onStart && onStart(frac(e), e);
      onMove && onMove(frac(e), e);
    });
    el.addEventListener('pointermove', (e) => {
      if (!on) return;
      e.preventDefault();
      const f = frac(e), step = Math.round(f * 20);
      if (step !== lastStep) { lastStep = step; MSH.haptic('selection'); }
      onMove && onMove(f, e);
    });
    const end = (e) => { if (!on) return; on = false; onEnd && onEnd(frac(e), e); };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  };

  /* ------------------------------------------------------------ DOM-patching */
  // Minimal morph: oppdaterer eksisterende DOM mot ny HTML uten å gjenskape uendrede noder
  // (bevarer ha-icon, input-fokus, scroll og pågående animasjoner). data-key gir stabil identitet.
  function sameNode(a, b) {
    if (a.nodeType !== b.nodeType) return false;
    if (a.nodeType !== 1) return true;
    if (a.tagName !== b.tagName) return false;
    const ka = a.getAttribute('data-key'), kb = b.getAttribute('data-key');
    return ka === kb;
  }
  function patchAttrs(a, b) {
    const ba = b.attributes, aa = a.attributes;
    const custom = a.tagName.indexOf('-') > 0; // egne elementer kan sette attributter selv – ikke fjern dem
    if (!custom) for (let i = aa.length - 1; i >= 0; i--) { const n = aa[i].name; if (!b.hasAttribute(n)) a.removeAttribute(n); }
    for (let i = 0; i < ba.length; i++) { const { name, value } = ba[i]; if (a.getAttribute(name) !== value) a.setAttribute(name, value); }
    if (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT') {
      if (a !== (a.getRootNode() && a.getRootNode().activeElement)) {
        if (b.hasAttribute('value') && a.value !== b.getAttribute('value')) a.value = b.getAttribute('value');
        if (a.type === 'checkbox' || a.type === 'radio') a.checked = b.hasAttribute('checked');
      }
    }
  }
  function patchChildren(a, b) {
    const an = Array.from(a.childNodes), bn = Array.from(b.childNodes);
    let i = 0;
    for (; i < bn.length; i++) {
      const nb = bn[i], na = a.childNodes[i];
      if (!na) { a.appendChild(document.importNode(nb, true)); continue; }
      if (sameNode(na, nb)) { patchNode(na, nb); continue; }
      // prøv å finne en keyed match lenger frem
      const key = nb.nodeType === 1 && nb.getAttribute('data-key');
      let found = null;
      if (key != null) for (let j = i + 1; j < a.childNodes.length; j++) { const c = a.childNodes[j]; if (c.nodeType === 1 && c.getAttribute('data-key') === key && c.tagName === nb.tagName) { found = c; break; } }
      if (found) { a.insertBefore(found, na); patchNode(found, nb); } else a.replaceChild(document.importNode(nb, true), na);
    }
    while (a.childNodes.length > bn.length) a.removeChild(a.lastChild);
    return an;
  }
  function patchNode(a, b) {
    if (a.nodeType === 3 || a.nodeType === 8) { if (a.nodeValue !== b.nodeValue) a.nodeValue = b.nodeValue; return; }
    patchAttrs(a, b);
    if (a.hasAttribute('data-nomorph')) return;
    if (a.tagName === 'STYLE') { if (a.textContent !== b.textContent) a.textContent = b.textContent; return; }
    patchChildren(a, b);
  }
  MSH.morph = function (target, html) {
    const tpl = document.createElement('template');
    tpl.innerHTML = html;
    patchChildren(target, tpl.content);
  };

  /* ------------------------------------------------------------ config-lagring */
  // Fersk lovelace/config → finn kortet via card_id → endre kun det kortet → lovelace/config/save.
  // YAML-modus → melding «Rediger i YAML», lagres kun i localStorage.
  MSH.cacheGet = function (cardId) { try { return JSON.parse(localStorage.getItem('msh-card-' + cardId) || 'null'); } catch (e) { return null; } };
  MSH.cacheSet = function (cardId, cfg) { try { localStorage.setItem('msh-card-' + cardId, JSON.stringify(cfg)); } catch (e) { /* */ } };
  MSH.saveCardConfig = async function (hass, oldCfg, newCfg) {
    if (!newCfg.card_id) newCfg = { ...newCfg, card_id: oldCfg.card_id || MSH.uid() };
    MSH.cacheSet(newCfg.card_id, newCfg);
    const urlPath = (hass && hass.panelUrl && hass.panelUrl !== 'lovelace') ? hass.panelUrl : null;
    let lc;
    try {
      lc = await hass.callWS({ type: 'lovelace/config', url_path: urlPath, force: true });
    } catch (e) {
      MSH.toast('Rediger i YAML');
      return { ok: false, yaml: true, config: newCfg };
    }
    if (!lc || lc.strategy) { MSH.toast('Rediger i YAML'); return { ok: false, yaml: true, config: newCfg }; }
    let hit = false;
    const oldJson = JSON.stringify(oldCfg);
    const walk = (o) => {
      if (Array.isArray(o)) { for (let i = 0; i < o.length; i++) { const r = visit(o[i]); if (r) o[i] = r; else walk(o[i]); } return; }
      if (o && typeof o === 'object') for (const k of Object.keys(o)) { const r = visit(o[k]); if (r) o[k] = r; else walk(o[k]); }
    };
    const visit = (c) => {
      if (hit || !c || typeof c !== 'object' || Array.isArray(c) || c.type !== oldCfg.type) return null;
      if ((oldCfg.card_id && c.card_id === oldCfg.card_id) || (!oldCfg.card_id && JSON.stringify(c) === oldJson)) { hit = true; return newCfg; }
      return null;
    };
    walk(lc);
    if (!hit) { MSH.toast('Fant ikke kortet – lagret lokalt'); return { ok: false, config: newCfg }; }
    try {
      await hass.callWS({ type: 'lovelace/config/save', url_path: urlPath, config: lc });
      MSH.toast('Lagret');
      return { ok: true, config: newCfg };
    } catch (e) {
      MSH.toast('Rediger i YAML');
      return { ok: false, yaml: true, config: newCfg };
    }
  };

  /* ------------------------------------------------------------ grunnstil */
  MSH.BASE_CSS = `
    :host{display:block;width:100%;box-sizing:border-box;font-family:${MSH.FONT};color:var(--white,#fafafa);-webkit-font-smoothing:antialiased;-webkit-tap-highlight-color:transparent}
    *,*::before,*::after{box-sizing:border-box}
    ha-card{background:none;box-shadow:none;border:none;border-radius:0;padding:0;overflow:visible;color:inherit;font-family:inherit}
    button,input,select,textarea{font:inherit;color:inherit;border:0;background:none;padding:0;margin:0;cursor:pointer;-webkit-tap-highlight-color:transparent}
    input,textarea{cursor:text;outline:none}
    input::placeholder{color:var(--gray500,#696969)}
    .num{font-variant-numeric:tabular-nums}
    .press{transition:transform .15s cubic-bezier(.34,1.5,.64,1)}
    .press:active{transform:scale(.96)}
    .row{display:flex;align-items:center}
    .col{display:flex;flex-direction:column}
    .grow{flex:1;min-width:0}
    .ell{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .card{border-radius:24px;background:var(--gray200,#3a3a3a);box-shadow:inset 0 0 0 1px rgba(255,255,255,0.05)}
    .muted{color:var(--gray700,#979797)}
    .dim{color:var(--gray600,#7f7f7f)}
    .noscroll::-webkit-scrollbar{display:none} .noscroll{scrollbar-width:none}
    .empty{display:flex;flex-direction:column;align-items:center;gap:10px;padding:22px 16px;border-radius:24px;background:var(--gray200,#3a3a3a);color:var(--gray700,#979797);font-size:13px;text-align:center}
    .pick{height:36px;padding:0 14px;border-radius:18px;background:var(--gray300,#404040);color:var(--white,#fafafa);font-size:13px;font-weight:500;display:inline-flex;align-items:center;gap:6px}
  `;

  /* ------------------------------------------------------------ basekort */
  // Alle ki-msh-kort arver denne. Underklassen implementerer:
  //   static get tag / cardName / description / defaults / schema
  //   render() → HTML-streng (bruk this.s(id) for å lese state – registrerer avhengighet)
  //   onAction(name, el, ev)  – for elementer med data-act="…"
  //   styles (getter) – kortets CSS
  //   afterRender() – valgfritt, for å koble drag osv. (kalles etter hver morph)
  //   onOpen() – valgfritt, kalles når popupen kortet ligger i åpnes (hent historikk her)
  class MshCard extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._deps = new Set();
      this._ui = {};
      this._raf = 0;
      this.shadowRoot.addEventListener('click', (e) => this._onClick(e));
      this.shadowRoot.addEventListener('pointerdown', (e) => this._onDown(e));
      this.shadowRoot.addEventListener('pointerup', () => this._cancelHold());
      this.shadowRoot.addEventListener('pointercancel', () => this._cancelHold());
      this.shadowRoot.addEventListener('pointermove', (e) => { if (this._hold && (Math.abs(e.clientX - this._hx) > 8 || Math.abs(e.clientY - this._hy) > 8)) this._cancelHold(); });
      this.shadowRoot.addEventListener('contextmenu', (e) => { if (e.target.closest && e.target.closest('[data-ent]')) e.preventDefault(); });
      this.shadowRoot.addEventListener('change', (e) => this._onInput(e, 'change'));
      this.shadowRoot.addEventListener('input', (e) => this._onInput(e, 'input'));
      this.shadowRoot.addEventListener('submit', (e) => { e.preventDefault(); const f = e.target.closest('[data-act]'); if (f) this.onAction(f.dataset.act, f, e); });
      this._onHash = () => this._checkOpen();
    }
    static get defaults() { return {}; }
    static get schema() { return []; }
    static getStubConfig() { return { card_id: MSH.uid(), ...this.defaults }; }
    static getConfigElement() { const e = document.createElement('msh-editor'); e.cardClass = this; return e; }
    setConfig(config) {
      if (!config) throw new Error('Mangler config');
      this._rawConfig = config;
      this._config = { ...this.constructor.defaults, ...config };
      this._firstRender = false;
      this._schedule(true);
    }
    get config() { return this._config || {}; }
    set hass(h) {
      const old = this._hass;
      this._hass = h;
      if (!old || this._changed(old, h)) this._schedule();
      if (!old) this._checkOpen();
    }
    get hass() { return this._hass; }
    _changed(o, n) {
      if (o.areas !== n.areas || o.entities !== n.entities || o.devices !== n.devices) return true;
      if (Object.keys(o.states).length !== Object.keys(n.states).length) return true;
      if (this._deps.size === 0) return o.states !== n.states;
      for (const id of this._deps) if (o.states[id] !== n.states[id]) return true;
      return false;
    }
    // Les state og registrer som avhengighet.
    s(id) { if (!id) return null; this._deps.add(id); return (this._hass && this._hass.states[id]) || null; }
    n(id) { const s = this.s(id); return s && MSH.isNum(s.state) ? Number(s.state) : null; }
    connectedCallback() {
      window.addEventListener('hashchange', this._onHash);
      window.addEventListener('location-changed', this._onHash);
      this._schedule(true);
      setTimeout(() => this._checkOpen(), 0);
    }
    disconnectedCallback() {
      window.removeEventListener('hashchange', this._onHash);
      window.removeEventListener('location-changed', this._onHash);
      this.onClose && this.onClose();
    }
    _checkOpen() {
      if (!this._hass || !this.isConnected) return;
      const open = MSH.isPopupOpen(this);
      if (open && !this._open) { this._open = true; this.onOpen && this.onOpen(); }
      else if (!open && this._open) { this._open = false; this.onClose && this.onClose(); }
    }
    get isOpen() { return !!this._open; }
    _schedule(force) {
      if (force) this._force = true;
      if (this._raf) return;
      this._raf = requestAnimationFrame(() => { this._raf = 0; this._render(); });
    }
    update() { this._schedule(true); }
    setUI(p) { this._ui = { ...this._ui, ...p }; this._schedule(true); }
    get ui() { return this._ui; }
    _render() {
      if (!this._config || !this._hass) return;
      if (this._busy && !this._force) return; // drag pågår
      this._force = false;
      this._deps = new Set();
      let body;
      try { body = this.render(); } catch (e) { console.error('[ki-msh]', this.localName, e); body = `<div class="empty">Feil i kortet: ${MSH.esc(e.message)}</div>`; }
      const gap = this._config.gap != null ? Number(this._config.gap) : null;
      const html = `<style>${MSH.BASE_CSS}${this.styles || ''}</style><ha-card>${body}</ha-card>`;
      if (!this._firstRender) { this.shadowRoot.innerHTML = html; this._firstRender = true; } else MSH.morph(this.shadowRoot, html);
      if (gap != null) this.style.setProperty('--msh-gap', gap + 'px');
      this.afterRender && this.afterRender();
    }
    _el(e, sel) {
      const path = e.composedPath ? e.composedPath() : [];
      for (const n of path) { if (n === this.shadowRoot) break; if (n.matches && n.matches(sel)) return n; }
      return null;
    }
    _onClick(e) {
      if (this._swallow) { this._swallow = false; e.stopPropagation(); e.preventDefault(); return; }
      const el = this._el(e, '[data-act]');
      if (!el || el.disabled) return;
      const h = el.getAttribute('data-haptic');
      if (h !== 'off') MSH.haptic(h || 'light');
      this.onAction(el.dataset.act, el, e);
    }
    _onInput(e, kind) {
      const el = this._el(e, '[data-input]');
      if (!el) return;
      if (kind === 'change' && (el.type === 'checkbox' || el.type === 'radio')) MSH.haptic('success');
      this.onInput && this.onInput(el.dataset.input, el, e, kind);
    }
    _onDown(e) {
      if (e.button) return;
      const el = this._el(e, '[data-ent]');
      if (!el) return;
      this._hx = e.clientX; this._hy = e.clientY;
      this._cancelHold();
      this._hold = setTimeout(() => {
        this._hold = null;
        this._swallow = true;
        setTimeout(() => { this._swallow = false; }, 600);
        MSH.haptic('medium');
        if (this.onHold && this.onHold(el.dataset.ent, el) !== undefined) return;
        MSH.moreInfo(this, el.dataset.ent);
      }, 520);
    }
    _cancelHold() { if (this._hold) { clearTimeout(this._hold); this._hold = null; } }
    onAction(name, el, e) {
      const d = el.dataset;
      // Felles handlinger
      if (name === 'toggle' && d.id) return MSH.toggle(this._hass, d.id);
      if (name === 'more' && d.id) return MSH.moreInfo(this, d.id);
      if (name === 'popup' && d.hash) return MSH.openPopup(d.hash);
      if (name === 'nav' && d.path) return MSH.navigate(d.path);
      if (name === 'customize') return this.customize(d.section);
    }
    // Kortets egen tilpasning: samme editor som GUI-editoren, lagres til kortets config.
    customize(focus) {
      const Ed = customElements.get('msh-editor');
      if (!Ed) return;
      const ov = MSH.overlay({ html: '', maxWidth: 520 });
      const ed = document.createElement('msh-editor');
      ed.cardClass = this.constructor;
      ed.inline = true;
      ed.focusSection = focus || null;
      ed.hass = this._hass;
      ed.setConfig(this._rawConfig || this._config);
      ed.addEventListener('msh-save', async (ev) => {
        const res = await MSH.saveCardConfig(this._hass, this._rawConfig || this._config, ev.detail.config);
        this.setConfig(res.config);
        ov.close();
      });
      ed.addEventListener('msh-cancel', () => ov.close());
      ov.body.appendChild(ed);
    }
    getCardSize() { return this.cardSize || 3; }
    getGridOptions() { return { columns: 'full' }; }
    getLayoutOptions() { return { grid_columns: 'full' }; }
  }
  MSH.Card = MshCard;

  // Registrer kort + oppføring i kortvelgeren.
  MSH.define = function (tag, cls, name, description) {
    if (customElements.get(tag)) return;
    customElements.define(tag, cls);
    window.customCards = window.customCards || [];
    if (!window.customCards.find((c) => c.type === tag)) window.customCards.push({ type: tag, name: name || tag, description: description || '', preview: false, documentationURL: 'https://github.com/SebastianKristo/ki-msh' });
  };

  // Felles tom-tilstand: «–» + «Velg entitet» (åpner overstyring).
  MSH.emptyState = (text, section) => `<div class="empty">${MSH.icon('mdi:help-circle-outline', 22)}<span>${MSH.esc(text || 'Fant ingen entiteter')}</span><button class="pick press" data-act="customize" ${section ? `data-section="${MSH.esc(section)}"` : ''}>${MSH.icon('mdi:plus', 18)}Velg entitet</button></div>`;
})();

} catch (e) { console.error('[ki-msh] 00-base.js', e); }

/* ---- 01-editor.js ---- */
try {
/* KI MSH · felles editor (msh-editor)
 * Brukes både som HA GUI-editor (getConfigElement → config-changed) og som kortets egen
 * tilpasningsmeny (MshCard.customize → msh-save). Samme skjema, samme config – config er sannheten.
 *
 * Skjemafelt (cardClass.schema, evt. funksjon (hass, config) → array):
 *   { type:'text'|'number'|'boolean'|'select'|'icon'|'color'|'entity'|'entities'|'area'|'hash',
 *     name:'sti.til.felt', label, help, placeholder, options:[[verdi,etikett]], domain, device_class,
 *     auto:(hass,cfg)=>autoverdi (vises som placeholder), min, max, step }
 *   { type:'section', label, fields:[…], open:true }
 *   { type:'overrides', label, fields:[{ name, label, domain, device_class, auto }] } → config.overrides
 *   { type:'lists', label, lists:(hass,cfg)=>[{ key, label, ids, domains }] }    → config.exclude / config.include
 *   { type:'order', name:'sections', hiddenName:'hidden_sections', label, options:[[key,label]] }
 *   { type:'gap' } → config.gap (4 / 8 / 18)
 */
(function () {
  if (customElements.get('msh-editor')) return;
  const M = window.MSH, esc = M.esc;
  const get = (o, p) => String(p).split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  const set = (o, p, v) => {
    const ks = String(p).split('.'), out = { ...o };
    let cur = out;
    ks.forEach((k, i) => {
      if (i === ks.length - 1) { if (v === undefined || v === '' || v === null) delete cur[k]; else cur[k] = v; }
      else { cur[k] = { ...(cur[k] || {}) }; cur = cur[k]; }
    });
    return out;
  };
  const clean = (o) => {
    ['overrides', 'include'].forEach((k) => {
      if (o[k] && typeof o[k] === 'object') {
        Object.keys(o[k]).forEach((x) => { const v = o[k][x]; if (v == null || v === '' || (Array.isArray(v) && !v.length)) delete o[k][x]; });
        if (!Object.keys(o[k]).length) delete o[k];
      }
    });
    if (Array.isArray(o.exclude) && !o.exclude.length) delete o.exclude;
    return o;
  };

  const ED_CSS = `
    :host{display:block;font-family:${M.FONT};color:#fafafa;--ed-bg:#2f2f2f}
    *{box-sizing:border-box}
    button,input,select{font:inherit;color:inherit;border:0;background:none;padding:0;margin:0;cursor:pointer}
    input,select{cursor:text;outline:none}
    select{cursor:pointer}
    .wrap{display:flex;flex-direction:column;gap:10px;padding:${'4px 0'};background:transparent}
    :host(:not([inline])) .wrap{padding:12px;border-radius:24px;background:#282828}
    .ttl{font-size:18px;font-weight:500;padding:4px 4px 6px;display:flex;align-items:center;gap:10px}
    .sec{border-radius:20px;background:#3a3a3a;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.05);overflow:hidden}
    .sec>summary{list-style:none;display:flex;align-items:center;gap:10px;height:52px;padding:0 16px;font-size:14px;font-weight:500;cursor:pointer}
    .sec>summary::-webkit-details-marker{display:none}
    .sec>summary .chev{margin-left:auto;transition:transform .2s;color:#979797}
    .sec[open]>summary .chev{transform:rotate(180deg)}
    .sec .in{display:flex;flex-direction:column;gap:8px;padding:0 12px 12px}
    .f{display:flex;flex-direction:column;gap:6px;padding:10px 12px;border-radius:16px;background:#404040}
    .f label{font-size:12px;color:#afafaf}
    .f .help{font-size:11px;color:#7f7f7f}
    .inp{height:40px;padding:0 12px;border-radius:12px;background:#2f2f2f;font-size:14px;width:100%}
    .inp::placeholder{color:#7f7f7f}
    .line{display:flex;align-items:center;gap:8px}
    .sw{position:relative;width:46px;height:28px;border-radius:14px;background:#545454;flex:none;transition:background .2s}
    .sw::after{content:'';position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:11px;background:#fafafa;transition:transform .2s cubic-bezier(.34,1.4,.64,1)}
    .sw.on{background:var(--green,#66d19e)} .sw.on::after{transform:translateX(18px)}
    .chips{display:flex;flex-wrap:wrap;gap:6px}
    .chip{height:32px;padding:0 12px;border-radius:16px;background:#2f2f2f;font-size:12px;font-weight:500;color:#afafaf;display:inline-flex;align-items:center;gap:6px}
    .chip.on{background:#fafafa;color:#282828}
    .sws{display:flex;flex-wrap:wrap;gap:6px}
    .dot{width:26px;height:26px;border-radius:13px;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.12);flex:none}
    .dot.on{box-shadow:0 0 0 2px #282828,0 0 0 4px #fafafa}
    .ent{display:flex;align-items:center;gap:10px;min-height:44px;padding:4px 4px 4px 10px;border-radius:12px;background:#2f2f2f}
    .ent .nm{flex:1;min-width:0;display:flex;flex-direction:column}
    .ent .nm b{font-weight:500;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .ent .nm i{font-style:normal;font-size:11px;color:#7f7f7f;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .ent.off{opacity:.45}
    .ib{width:36px;height:36px;border-radius:18px;display:grid;place-items:center;color:#afafaf;flex:none}
    .ib:hover{background:#404040}
    .dd{position:relative}
    .menu{position:absolute;left:0;right:0;top:44px;z-index:5;max-height:260px;overflow:auto;border-radius:14px;background:#232323;box-shadow:0 12px 30px rgba(0,0,0,.5);padding:4px}
    .menu button{display:flex;width:100%;text-align:left;flex-direction:column;padding:8px 10px;border-radius:10px}
    .menu button:hover{background:#3a3a3a}
    .menu b{font-weight:500;font-size:13px} .menu i{font-style:normal;font-size:11px;color:#7f7f7f}
    .actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;position:sticky;bottom:0;padding-top:6px}
    .btn{height:52px;border-radius:26px;background:#3a3a3a;font-weight:500;font-size:14px;display:flex;align-items:center;justify-content:center;gap:8px}
    .btn.pri{background:linear-gradient(145deg, rgb(242 133 201) -10%, rgb(245 205 198) 100%);color:#2a1720}
    .small{font-size:12px;color:#979797}
    .ordrow{display:flex;align-items:center;gap:6px;height:44px;padding:0 4px 0 12px;border-radius:12px;background:#2f2f2f}
    ha-icon-picker{display:block}
  `;

  class MshEditor extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._open = {};
      this._q = {};
      this.shadowRoot.addEventListener('click', (e) => this._click(e));
      this.shadowRoot.addEventListener('input', (e) => this._input(e));
      this.shadowRoot.addEventListener('change', (e) => this._change(e));
      this.shadowRoot.addEventListener('focusin', (e) => { const t = e.target; if (t.dataset && t.dataset.search) { this._menu = t.dataset.search; this._render(); } });
      this.shadowRoot.addEventListener('toggle', (e) => { const d = e.target; if (d.dataset && d.dataset.sec != null) this._open[d.dataset.sec] = d.open; }, true);
      this.shadowRoot.addEventListener('value-changed', (e) => {
        const t = e.target;
        if (t.dataset && t.dataset.name) { e.stopPropagation(); this._set(t.dataset.name, e.detail.value || undefined); }
      });
    }
    set inline(v) { this._inline = v; if (v) this.setAttribute('inline', ''); }
    set hass(h) { const first = !this._hass; this._hass = h; if (first) this._render(); }
    get hass() { return this._hass; }
    setConfig(c) { this._config = { ...c }; this._render(); }
    get schema() {
      const cls = this.cardClass;
      let s = cls && cls.schema;
      if (typeof s === 'function') s = s(this._hass, this._config || {});
      return s || [];
    }
    _set(path, v) {
      let c = set(this._config || {}, path, v);
      if (!c.card_id) c.card_id = M.uid();
      c = clean(c);
      this._config = c;
      if (!this._inline) this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: c }, bubbles: true, composed: true }));
      this._render();
    }
    _render() {
      if (!this._config || !this._hass) return;
      const cls = this.cardClass || {};
      const body = this.schema.map((f, i) => this._field(f, 'r' + i)).join('');
      const html = `<style>${ED_CSS}</style><div class="wrap">
        ${this._inline ? `<div class="ttl">${M.icon('mdi:tune', 22)}${esc(cls.cardName ? 'Tilpass · ' + cls.cardName : 'Tilpass')}</div>` : ''}
        ${body || '<div class="small">Ingen innstillinger.</div>'}
        ${this._inline ? `<div class="actions"><button class="btn" data-a="cancel">Avbryt</button><button class="btn pri" data-a="save">${M.icon('mdi:check', 20)}Lagre</button></div>` : ''}
      </div>`;
      if (!this._did) { this.shadowRoot.innerHTML = html; this._did = true; } else M.morph(this.shadowRoot, html);
      this.shadowRoot.querySelectorAll('ha-icon-picker').forEach((p) => { p.hass = this._hass; const v = get(this._config, p.dataset.name) || ''; if (p.value !== v) p.value = v; });
      if (this.focusSection && !this._focused) {
        this._focused = true;
        const el = this.shadowRoot.querySelector(`[data-focus="${CSS.escape ? CSS.escape(this.focusSection) : this.focusSection}"]`);
        if (el) { el.open = true; el.scrollIntoView({ block: 'start' }); }
      }
    }
    _field(f, key) {
      const h = this._hass, c = this._config;
      const val = f.name ? get(c, f.name) : undefined;
      const auto = f.auto ? (() => { try { return f.auto(h, c); } catch (e) { return null; } })() : null;
      const lab = f.label ? `<label>${esc(f.label)}</label>` : '';
      const help = f.help ? `<span class="help">${esc(f.help)}</span>` : '';
      switch (f.type) {
        case 'section': {
          const open = this._open[key] != null ? this._open[key] : (f.open || (this.focusSection && f.id === this.focusSection));
          return `<details class="sec" data-sec="${key}" ${f.id ? `data-focus="${esc(f.id)}"` : ''} ${open ? 'open' : ''}><summary>${f.icon ? M.icon(f.icon, 20) : ''}${esc(f.label)}<span class="chev">${M.icon('mdi:chevron-down', 20)}</span></summary><div class="in">${(f.fields || []).map((x, j) => this._field(x, key + '_' + j)).join('')}</div></details>`;
        }
        case 'boolean': {
          const on = val != null ? !!val : !!f.default;
          return `<div class="f"><div class="line"><span style="flex:1;font-size:13px">${esc(f.label)}</span><button class="sw ${on ? 'on' : ''}" role="switch" data-a="bool" data-name="${esc(f.name)}" data-v="${on ? 0 : 1}"></button></div>${help}</div>`;
        }
        case 'select': {
          const cur = val != null ? String(val) : f.default != null ? String(f.default) : '';
          return `<div class="f">${lab}<div class="chips">${(f.options || []).map(([v, l]) => `<button class="chip ${String(v) === cur ? 'on' : ''}" data-a="sel" data-name="${esc(f.name)}" data-v="${esc(v)}" data-num="${typeof v === 'number' ? 1 : 0}">${esc(l)}</button>`).join('')}</div>${help}</div>`;
        }
        case 'gap': {
          const cur = c.gap != null ? Number(c.gap) : 8;
          return `<div class="f"><label>Mellomrom</label><div class="chips">${[[4, 'Tett'], [8, 'Standard'], [18, 'Luftig']].map(([v, l]) => `<button class="chip ${v === cur ? 'on' : ''}" data-a="sel" data-name="gap" data-v="${v}" data-num="1">${l} ${v}</button>`).join('')}</div></div>`;
        }
        case 'number':
          return `<div class="f">${lab}<input class="inp" type="number" data-name="${esc(f.name)}" data-num="1" value="${val != null ? esc(val) : ''}" placeholder="${esc(auto != null ? auto : f.placeholder || f.default || '')}" ${f.min != null ? `min="${f.min}"` : ''} ${f.max != null ? `max="${f.max}"` : ''} ${f.step != null ? `step="${f.step}"` : ''}>${help}</div>`;
        case 'text':
        case 'hash':
          return `<div class="f">${lab}<input class="inp" data-name="${esc(f.name)}" value="${val != null ? esc(val) : ''}" placeholder="${esc(auto != null ? auto : f.placeholder || '')}">${help}</div>`;
        case 'icon':
          if (customElements.get('ha-icon-picker')) return `<div class="f">${lab}<ha-icon-picker data-name="${esc(f.name)}" data-nomorph placeholder="${esc(auto || f.placeholder || '')}"></ha-icon-picker>${help}</div>`;
          return `<div class="f">${lab}<div class="line">${M.icon(val || auto || 'mdi:help', 22)}<input class="inp" data-name="${esc(f.name)}" value="${esc(val || '')}" placeholder="${esc(auto || 'mdi:… / phu:… / hue:…')}"></div>${help}</div>`;
        case 'color':
          return this._color(f, val, auto);
        case 'entity':
        case 'area':
          return this._entity(f, f.name, val, auto, key);
        case 'entities': {
          const list = Array.isArray(val) ? val : [];
          return `<div class="f">${lab}${list.map((id, i) => this._entRow(id, `<button class="ib" data-a="rmlist" data-name="${esc(f.name)}" data-i="${i}" title="Fjern">${M.icon('mdi:close', 18)}</button>`)).join('')}${this._search(f, key, 'addlist', f.name)}${help}</div>`;
        }
        case 'overrides':
          return `<details class="sec" data-sec="${key}" data-focus="overrides" ${this._open[key] || this.focusSection === 'overrides' ? 'open' : ''}><summary>${M.icon('mdi:swap-horizontal', 20)}${esc(f.label || 'Bytt entiteter')}<span class="chev">${M.icon('mdi:chevron-down', 20)}</span></summary><div class="in">${(f.fields || []).map((x, j) => {
            const a = x.auto ? (() => { try { return x.auto(h, c); } catch (e) { return null; } })() : null;
            return this._entity({ ...x, help: x.help || (a ? 'Auto: ' + a : 'Auto: fant ingen') }, 'overrides.' + x.name, get(c, 'overrides.' + x.name), a, key + '_' + j);
          }).join('')}</div></details>`;
        case 'lists':
          return this._lists(f, key);
        case 'order':
          return this._order(f);
        case 'info':
          return `<div class="small" style="padding:0 6px">${esc(f.label)}</div>`;
        default:
          return '';
      }
    }
    _entRow(id, tail, off) {
      const s = this._hass.states[id];
      return `<div class="ent ${off ? 'off' : ''}">${M.icon(M.domainIcon(id, s), 20, 'color:#afafaf')}<span class="nm"><b>${esc(s ? s.attributes.friendly_name || id : id)}</b><i>${esc(id)}${s ? '' : ' · finnes ikke'}</i></span>${tail || ''}</div>`;
    }
    _matches(f, q) {
      const h = this._hass, doms = f.domains || (f.domain ? [].concat(f.domain) : null);
      if (f.type === 'area') return Object.values(h.areas || {}).filter((a) => !q || (a.name + ' ' + a.area_id).toLowerCase().includes(q)).slice(0, 40).map((a) => ({ id: a.area_id, name: a.name }));
      const ql = (q || '').toLowerCase();
      return Object.keys(h.states).filter((id) => (!doms || doms.includes(id.split('.')[0])) && (!f.device_class || h.states[id].attributes.device_class === f.device_class || [].concat(f.device_class).includes(h.states[id].attributes.device_class)) && (!f.platform || (h.entities && h.entities[id] && h.entities[id].platform === f.platform)))
        .filter((id) => !ql || (id + ' ' + (h.states[id].attributes.friendly_name || '')).toLowerCase().includes(ql))
        .sort().slice(0, 40).map((id) => ({ id, name: h.states[id].attributes.friendly_name || id }));
    }
    _search(f, key, act, name, placeholder) {
      const q = this._q[key] || '';
      const open = this._menu === key;
      const items = open ? this._matches(f, q) : [];
      return `<div class="dd"><input class="inp" data-search="${key}" data-act="${act}" data-name="${esc(name)}" value="${esc(q)}" placeholder="${esc(placeholder || 'Søk eller skriv entity_id …')}" autocomplete="off">
        ${open ? `<div class="menu">${items.map((x) => `<button data-a="${act}" data-name="${esc(name)}" data-v="${esc(x.id)}" data-key="${esc(x.id)}"><b>${esc(x.name)}</b><i>${esc(x.id)}</i></button>`).join('') || '<div class="small" style="padding:8px">Ingen treff – trykk Enter for å bruke teksten</div>'}</div>` : ''}</div>`;
    }
    _entity(f, name, val, auto, key) {
      const lab = f.label ? `<label>${esc(f.label)}</label>` : '';
      const help = f.help ? `<span class="help">${esc(f.help)}</span>` : '';
      const cur = val ? (f.type === 'area' ? `<div class="ent">${M.icon('mdi:texture-box', 20, 'color:#afafaf')}<span class="nm"><b>${esc(M.areaName(this._hass, val))}</b><i>${esc(val)}</i></span><button class="ib" data-a="clear" data-name="${esc(name)}" title="Tilbake til auto">${M.icon('mdi:close', 18)}</button></div>`
        : this._entRow(val, `<button class="ib" data-a="clear" data-name="${esc(name)}" title="Tilbake til auto">${M.icon('mdi:close', 18)}</button>`)) : '';
      return `<div class="f">${lab}${cur}${this._search(f, key, 'setent', name, val ? 'Bytt …' : auto ? 'Auto: ' + auto : 'Velg entitet …')}${help}</div>`;
    }
    _color(f, val, auto) {
      const cur = val || '';
      const theme = M.THEME_COLORS.map(([k, hex, l]) => { const v = `var(--${k}, ${hex})`; return `<button class="dot ${cur === v || cur === `var(--${k})` ? 'on' : ''}" title="${esc(l)} · --${k}" style="background:${v}" data-a="sel" data-name="${esc(f.name)}" data-v="${esc(v)}"></button>`; }).join('');
      const ha = M.HA_COLORS.map(([k, hex, l]) => { const v = `var(--${k}-color, ${hex})`; return `<button class="dot ${cur === v ? 'on' : ''}" title="${esc(l || k)} · --${k}-color" style="background:${v}" data-a="sel" data-name="${esc(f.name)}" data-v="${esc(v)}"></button>`; }).join('');
      return `<div class="f"><label>${esc(f.label || 'Farge')}</label>
        <span class="help">Tema (My SmartHome v3)</span><div class="sws">${theme}</div>
        <span class="help">HA-farger</span><div class="sws">${ha}</div>
        <div class="line"><span class="dot" style="background:${esc(cur || auto || 'transparent')}"></span><input class="inp" data-name="${esc(f.name)}" value="${esc(cur)}" placeholder="${esc(auto || '#hex eller var(--navn)')}"><button class="ib" data-a="clear" data-name="${esc(f.name)}" title="Standard">${M.icon('mdi:restore', 18)}</button></div>
        ${f.help ? `<span class="help">${esc(f.help)}</span>` : ''}</div>`;
    }
    _lists(f, key) {
      const h = this._hass, c = this._config;
      let lists = [];
      try { lists = f.lists(h, c) || []; } catch (e) { lists = []; }
      const ex = new Set(c.exclude || []);
      return `<details class="sec" data-sec="${key}" data-focus="entities" ${this._open[key] || this.focusSection === 'entities' ? 'open' : ''}><summary>${M.icon('mdi:eye-outline', 20)}${esc(f.label || 'Entiteter')}<span class="chev">${M.icon('mdi:chevron-down', 20)}</span></summary><div class="in">
        ${lists.map((L, j) => {
          const inc = (c.include && c.include[L.key]) || [];
          const all = [...new Set([...(L.ids || []), ...inc])];
          return `<div class="f"><div class="line"><label style="flex:1">${esc(L.label)} · ${all.filter((i) => !ex.has(i)).length}/${all.length}</label>
            <button class="chip" data-a="showall" data-k="${esc(L.key)}" data-ids="${esc(all.join(','))}">Vis alle</button><button class="chip" data-a="hideall" data-ids="${esc(all.join(','))}">Skjul alle</button></div>
            ${all.map((id) => this._entRow(id, `${inc.includes(id) ? `<button class="ib" data-a="uninc" data-k="${esc(L.key)}" data-v="${esc(id)}" title="Fjern">${M.icon('mdi:close', 18)}</button>` : ''}<button class="ib" data-a="eye" data-v="${esc(id)}" title="${ex.has(id) ? 'Vis' : 'Skjul'}">${M.icon(ex.has(id) ? 'mdi:eye-off' : 'mdi:eye', 18)}</button>`, ex.has(id))).join('') || '<span class="small">Autokonfig fant ingen</span>'}
            ${this._search({ domains: L.domains, type: 'entity' }, key + '_' + j, 'include', L.key, 'Legg til … (søk eller skriv entity_id)')}</div>`;
        }).join('')}</div></details>`;
    }
    _order(f) {
      const c = this._config;
      const keys = f.options.map((o) => o[0]);
      let order = Array.isArray(get(c, f.name)) ? get(c, f.name).filter((k) => keys.includes(k)) : [];
      keys.forEach((k) => { if (!order.includes(k)) order.push(k); });
      const hid = new Set(get(c, f.hiddenName) || []);
      const lab = Object.fromEntries(f.options);
      return `<details class="sec" data-sec="ord_${esc(f.name)}" data-focus="sections" ${this._open['ord_' + f.name] || this.focusSection === 'sections' ? 'open' : ''}><summary>${M.icon('mdi:view-agenda-outline', 20)}${esc(f.label || 'Seksjoner')}<span class="chev">${M.icon('mdi:chevron-down', 20)}</span></summary><div class="in">
        ${order.map((k, i) => `<div class="ordrow ${hid.has(k) ? 'off' : ''}" style="${hid.has(k) ? 'opacity:.5' : ''}"><span style="flex:1;font-size:13px">${esc(lab[k])}</span>
          <button class="ib" data-a="mv" data-name="${esc(f.name)}" data-ord="${esc(order.join(','))}" data-i="${i}" data-d="-1" ${i ? '' : 'disabled style="opacity:.3"'}>${M.icon('mdi:chevron-up', 20)}</button>
          <button class="ib" data-a="mv" data-name="${esc(f.name)}" data-ord="${esc(order.join(','))}" data-i="${i}" data-d="1" ${i < order.length - 1 ? '' : 'disabled style="opacity:.3"'}>${M.icon('mdi:chevron-down', 20)}</button>
          <button class="ib" data-a="hid" data-name="${esc(f.hiddenName)}" data-v="${esc(k)}">${M.icon(hid.has(k) ? 'mdi:eye-off' : 'mdi:eye', 18)}</button></div>`).join('')}
        </div></details>`;
    }
    _click(e) {
      const b = e.composedPath().find((n) => n.dataset && n.dataset.a);
      if (!b) { if (!e.composedPath().some((n) => n.dataset && n.dataset.search)) { if (this._menu) { this._menu = null; this._render(); } } return; }
      const d = b.dataset, c = this._config;
      M.haptic('light');
      switch (d.a) {
        case 'bool': return this._set(d.name, d.v === '1');
        case 'sel': return this._set(d.name, d.num === '1' ? Number(d.v) : d.v);
        case 'clear': this._menu = null; return this._set(d.name, undefined);
        case 'setent': this._menu = null; this._q = {}; return this._set(d.name, d.v);
        case 'addlist': { this._menu = null; this._q = {}; const l = [...(get(c, d.name) || [])]; if (!l.includes(d.v)) l.push(d.v); return this._set(d.name, l); }
        case 'rmlist': { const l = [...(get(c, d.name) || [])]; l.splice(Number(d.i), 1); return this._set(d.name, l); }
        case 'include': { this._menu = null; this._q = {}; const l = [...((c.include || {})[d.name] || [])]; if (!l.includes(d.v)) l.push(d.v); const ex = (c.exclude || []).filter((x) => x !== d.v); this._config = { ...c, exclude: ex }; return this._set('include.' + d.name, l); }
        case 'uninc': { const l = ((c.include || {})[d.k] || []).filter((x) => x !== d.v); return this._set('include.' + d.k, l); }
        case 'eye': { const ex = new Set(c.exclude || []); ex.has(d.v) ? ex.delete(d.v) : ex.add(d.v); return this._set('exclude', [...ex]); }
        case 'showall': { const ids = new Set(d.ids.split(',')); return this._set('exclude', (c.exclude || []).filter((x) => !ids.has(x))); }
        case 'hideall': { const ex = new Set(c.exclude || []); d.ids.split(',').filter(Boolean).forEach((x) => ex.add(x)); return this._set('exclude', [...ex]); }
        case 'mv': { const o = d.ord.split(','), i = Number(d.i), j = i + Number(d.d); if (j < 0 || j >= o.length) return; [o[i], o[j]] = [o[j], o[i]]; M.haptic('selection'); return this._set(d.name, o); }
        case 'hid': { const hs = new Set(get(c, d.name) || []); hs.has(d.v) ? hs.delete(d.v) : hs.add(d.v); return this._set(d.name, [...hs]); }
        case 'save': return this.dispatchEvent(new CustomEvent('msh-save', { detail: { config: this._config } }));
        case 'cancel': return this.dispatchEvent(new CustomEvent('msh-cancel'));
        default:
      }
    }
    _input(e) {
      const t = e.target;
      if (t.dataset.search) { this._q[t.dataset.search] = t.value; this._menu = t.dataset.search; this._render(); }
    }
    _change(e) {
      const t = e.target;
      if (t.dataset.search) {
        const v = t.value.trim();
        if (/^[a-z_]+\.[a-z0-9_]+$/.test(v)) {
          const act = t.dataset.act, name = t.dataset.name;
          this._q = {}; this._menu = null;
          if (act === 'setent') return this._set(name, v);
          if (act === 'addlist') { const l = [...(get(this._config, name) || [])]; if (!l.includes(v)) l.push(v); return this._set(name, l); }
          if (act === 'include') { const l = [...((this._config.include || {})[name] || [])]; if (!l.includes(v)) l.push(v); return this._set('include.' + name, l); }
        }
        return;
      }
      if (!t.dataset.name) return;
      let v = t.value;
      if (t.dataset.num === '1') v = v === '' ? undefined : Number(v);
      this._set(t.dataset.name, v === '' ? undefined : v);
    }
  }
  customElements.define('msh-editor', MshEditor);
})();

} catch (e) { console.error('[ki-msh] 01-editor.js', e); }

/* ---- 30-rom-klima.js ---- */
try {
/* msh-rom-klima-card · Rom-popup, klima-toppkort (alltid først). Kilde: Rom v4.dc.html hasHero/heroCard.
 * Temperatur/fukt fra KI Rom (_oversikt) → ellers første sensor med device_class i rommet.
 * Chip fra første climate.* i rommet. Historikk 24 t når popupen åpnes (cache 5 min).
 */
(function () {
  const M = window.MSH, esc = M.esc, C = M.C;

  // Felles oppslag for et rom (brukes også av msh-rom-card via MSH.room).
  M.roomArea = function (card) {
    const c = card.config || {};
    if (c.area) return c.area;
    const h = M.popupHash(card);
    return h ? h.replace(/^#/, '') : null;
  };
  M.roomAuto = function (hass, area) {
    const ov = M.kiRom(hass, area, 'oversikt');
    const A = (ov && ov.attributes) || {};
    const first = (arr) => M.ids(arr)[0] || null;
    const temp = first(A.temperatur) || M.byClass(hass, 'sensor', 'temperature', area)[0] || null;
    const hum = first(A.fuktighet) || M.byClass(hass, 'sensor', 'humidity', area)[0] || null;
    const thermo = first(A.klima) || M.all(hass, 'climate', (s, id) => M.areaOf(hass, id) === area)[0] || null;
    const lights = A.lys ? M.ids(A.lys) : M.all(hass, 'light', (s, id) => M.areaOf(hass, id) === area);
    return { ov, A, temp, hum, thermo, lights };
  };

  class RomKlima extends M.Card {
    static get cardName() { return 'Rom · klima-toppkort'; }
    static get defaults() { return { graph_t: 'var(--orange, #f2b573)', graph_h: 'var(--blue, #73b9f2)', graph_fill: 0.2, graph_width: 2 }; }
    static get schema() {
      return [
        { type: 'area', name: 'area', label: 'Rom (område)', help: 'Tomt = hentes fra popupens hash (#stue → stue)' },
        { type: 'text', name: 'name', label: 'Navn', auto: (h, c) => M.areaName(h, c.area) },
        { type: 'overrides', label: 'Bytt sensor/termostat', fields: [
          { name: 'temperatur', label: 'Temperatur', domain: 'sensor', device_class: 'temperature', auto: (h, c) => c.area && M.roomAuto(h, c.area).temp },
          { name: 'fuktighet', label: 'Luftfuktighet', domain: 'sensor', device_class: 'humidity', auto: (h, c) => c.area && M.roomAuto(h, c.area).hum },
          { name: 'termostat', label: 'Termostat (chip)', domain: 'climate', auto: (h, c) => c.area && M.roomAuto(h, c.area).thermo },
        ] },
        { type: 'section', label: 'Graf', icon: 'mdi:chart-line', fields: [
          { type: 'color', name: 'graph_t', label: 'Linje · temperatur (romfarge)' },
          { type: 'color', name: 'graph_h', label: 'Linje · fukt' },
          { type: 'select', name: 'graph_fill', label: 'Fyll', options: [[0, 'Av'], [0.2, 'Svak'], [0.4, 'Sterk']], default: 0.2 },
          { type: 'select', name: 'graph_width', label: 'Linje', options: [[1.5, 'Tynn'], [2, 'Normal'], [3, 'Tykk']], default: 2 },
        ] },
      ];
    }
    get cardSize() { return 4; }
    onOpen() { this._loadHist(); }
    async _loadHist() {
      const e = this._ents();
      if (!e.temp && !e.hum) return;
      const h = await M.history(this.hass, [e.temp, e.hum].filter(Boolean), 24);
      this._hist = { t: e.temp ? M.sample(h[e.temp], 25) : [], h: e.hum ? M.sample(h[e.hum], 25) : [] };
      this.update();
    }
    _ents() {
      const area = M.roomArea(this), a = area ? M.roomAuto(this.hass, area) : {};
      return { area, temp: M.pick(this.config, 'temperatur', a.temp), hum: M.pick(this.config, 'fuktighet', a.hum), thermo: M.pick(this.config, 'termostat', a.thermo), lights: a.lights || [] };
    }
    render() {
      const c = this.config, e = this._ents(), ui = this.ui;
      const name = c.name || (e.area ? M.areaName(this.hass, e.area) : '–');
      const tNow = this.n(e.temp), hNow = this.n(e.hum), th = this.s(e.thermo);
      const on = e.lights.filter((id) => { const s = this.s(id); return s && s.state === 'on'; }).length;
      const set = th && th.attributes.temperature != null ? Number(th.attributes.temperature) : null;
      const heating = !!th && (th.attributes.hvac_action === 'heating' || (th.attributes.hvac_action == null && th.state === 'heat' && tNow != null && set != null && tNow < set));
      const hc = heating ? C.red : on > 0 ? C.yellow : C.blue;
      const chipIcon = heating ? 'mdi:fire' : on > 0 ? 'mdi:lightbulb' : 'mdi:check';
      const chipText = heating ? `Varmer til ${M.nf(set, 1)}°` : set != null ? `Holder ${M.nf(set, 1)}°` : on > 0 ? `${on} lys på` : 'Alt er rolig';
      // serier: historikk (25 punkter) + live siste punkt; flat graf når data mangler
      const hist = this._hist || { t: [], h: [] };
      const ser0 = { t: hist.t.length ? hist.t.slice() : (tNow != null ? Array(25).fill(tNow) : []), h: hist.h.length ? hist.h.slice() : (hNow != null ? Array(25).fill(hNow) : []) };
      if (tNow != null && ser0.t.length) ser0.t[24] = tNow;
      if (hNow != null && ser0.h.length) ser0.h[24] = hNow;
      const isT = (ui.tab || 't') === 't' || !ser0.h.length && ser0.t.length;
      const ser = isT ? ser0.t : ser0.h;
      const gc = M.color(isT ? c.graph_t : c.graph_h, isT ? C.orange : C.blue);
      const sel = ui.sel != null ? ui.sel : 24;
      let pts = '0,60 300,60', lo = 0, hi = 1, mn = null, mx = null;
      if (ser.length) {
        mn = Math.min(...ser); mx = Math.max(...ser);
        lo = Math.floor(mn - (isT ? 0.3 : 2)); hi = Math.ceil(mx + (isT ? 0.3 : 2));
        if (hi === lo) hi = lo + 1;
        const X = (i) => ((i / 24) * 300).toFixed(1), Y = (v) => (92 - ((v - lo) / (hi - lo)) * 72).toFixed(1);
        pts = ser.map((v, i) => `${X(i)},${Y(v)}`).join(' ');
      }
      const tv = ser0.t.length ? ser0.t[sel] : tNow, hv = ser0.h.length ? ser0.h[sel] : hNow;
      const range = isT ? (mn != null ? `${M.nf(Math.min(...ser0.t), 1)}–${M.nf(Math.max(...ser0.t), 1)}°` : '–') : (ser0.h.length ? `${M.nf(Math.min(...ser0.h), 0)}–${M.nf(Math.max(...ser0.h), 0)} %` : '–');
      const when = sel === 24 ? (ser.length ? `Nå · ${range} siste døgn` : 'nå') : `−${24 - sel} t`;
      const fill = Number(c.graph_fill != null ? c.graph_fill : 0.2), w = Number(c.graph_width || 2);
      return `
        <section class="hero" data-ent="${esc(e.temp || e.thermo || '')}">
          <div class="graph">
            <svg viewBox="0 0 300 100" preserveAspectRatio="none">
              <polyline points="0,100 ${pts} 300,100" style="fill:${M.alpha(gc, fill)};stroke:none"></polyline>
              <polyline points="${pts}" fill="none" style="stroke:${gc};stroke-width:${w}" stroke-linejoin="round" vector-effect="non-scaling-stroke"></polyline>
            </svg>
            <div class="cursor" style="left:${(sel / 24) * 100}%;border-left:1px dashed ${M.alpha(gc, 0.6)}"></div>
            <div class="scrub"></div>
          </div>
          <button class="gear press" data-act="customize" title="Tilpass">${M.icon('settings', 22, 'color:#fafafa')}</button>
          <div class="top">
            <span class="nm ell">${esc(name)}</span>
            <span class="chip" style="background:${M.alpha(hc, 0.18)};color:${hc}">${M.icon(chipIcon, 14)}${esc(chipText)}</span>
          </div>
          <div class="vals">
            <div class="line">
              <button class="t" data-act="tab" data-t="t" style="color:${isT ? '#fafafa' : '#7f7f7f'}"><span class="big num">${tv != null ? M.nf(tv, 1) : '–'}</span><span class="deg">°</span></button>
              <button class="h" data-act="tab" data-t="h" data-haptic="selection" style="background:${isT ? 'transparent' : M.alpha(C.blue, 0.2)};color:${isT ? '#afafaf' : '#fafafa'}"><span class="hv num">${hv != null ? M.nf(hv, 0) : '–'}</span><span class="pc">%</span></button>
            </div>
            <span class="when">${esc(when)}</span>
          </div>
        </section>`;
    }
    onAction(name, el, ev) {
      if (name === 'tab') return this.setUI({ tab: el.dataset.t, sel: null });
      return super.onAction(name, el, ev);
    }
    afterRender() {
      const sc = this.shadowRoot.querySelector('.scrub');
      if (!sc || sc.__b) return;
      sc.__b = true;
      M.guardDrag(sc, 'none');
      const pos = (e) => { const r = sc.getBoundingClientRect(); return M.clamp(Math.round(((e.clientX - r.left) / r.width) * 24), 0, 24); };
      let down = false;
      sc.addEventListener('pointerdown', (e) => { down = true; this._busy = false; try { sc.setPointerCapture(e.pointerId); } catch (x) { /* */ } const p = pos(e); if (p !== this.ui.sel) { M.haptic('selection'); this.setUI({ sel: p }); } });
      sc.addEventListener('pointermove', (e) => { if (!down && e.pointerType !== 'mouse') return; const p = pos(e); if (p !== this.ui.sel) { if (down) M.haptic('selection'); this.setUI({ sel: p }); } });
      const end = () => { down = false; this.setUI({ sel: null }); };
      sc.addEventListener('pointerup', end);
      sc.addEventListener('pointercancel', end);
      sc.addEventListener('pointerleave', end);
    }
    get styles() {
      return `
        .hero{position:relative;height:184px;border-radius:28px;overflow:hidden;background:var(--gray200,#3a3a3a);box-shadow:inset 0 0 0 1px rgba(255,255,255,0.05);width:100%}
        .graph{position:absolute;left:0;right:0;bottom:0;height:84px}
        .graph svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
        .cursor{position:absolute;top:0;bottom:0;pointer-events:none}
        .scrub{position:absolute;inset:0;touch-action:none;cursor:crosshair}
        .gear{position:absolute;right:16px;top:16px;width:44px;height:44px;border-radius:22px;background:rgba(255,255,255,0.1);display:grid;place-items:center}
        .gear:active{transform:scale(.92)}
        .top{position:absolute;left:18px;top:18px;right:120px;display:flex;align-items:center;gap:8px}
        .nm{font-size:13px;color:var(--gray800,#afafaf)}
        .chip{height:26px;padding:0 10px 0 8px;border-radius:13px;display:flex;align-items:center;gap:5px;font-size:11px;font-weight:600;white-space:nowrap;flex:none}
        .vals{position:absolute;left:18px;top:54px;display:flex;flex-direction:column;gap:2px}
        .line{display:flex;align-items:baseline;gap:8px;white-space:nowrap}
        .t{display:flex;align-items:flex-start;transition:color .25s}
        .big{font-size:44px;font-weight:300;letter-spacing:-0.04em;line-height:1}
        .deg{font-size:24px;font-weight:300}
        .h{display:flex;align-items:baseline;gap:1px;height:26px;padding:0 9px;border-radius:13px;transition:background .25s,color .25s}
        .hv{font-size:17px;font-weight:400}
        .pc{font-size:12px;color:var(--gray700,#979797)}
        .when{font-size:12px;color:var(--gray600,#7f7f7f);white-space:nowrap}
      `;
    }
  }
  M.define('msh-rom-klima-card', RomKlima, 'MSH Rom · klima-toppkort', 'Temperatur, fukt, termostat-chip og 24 t-graf med scrubbing. Alltid første kort i rom-popupen.');
})();

} catch (e) { console.error('[ki-msh] 30-rom-klima.js', e); }

console.info('%c KI MSH %c 1.0.0 ', 'background:#f285c9;color:#2a1720;font-weight:600;border-radius:4px 0 0 4px;padding:2px 4px', 'background:#3a3a3a;color:#fafafa;border-radius:0 4px 4px 0;padding:2px 4px');
