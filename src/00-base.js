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
  // Prosjektstandard: 8 px mellom kortene i Bubble Card-popups. Lav prioritet – temaet
  // (bubble-pop-up-gap i My SmartHome v3) eller Bubble-stilen vinner hvis de setter noe.
  if (!document.getElementById('msh-root-vars')) {
    const st = document.createElement('style');
    st.id = 'msh-root-vars';
    st.textContent = ':root{--bubble-pop-up-gap:8px}';
    (document.head || document.documentElement).appendChild(st);
  }
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
  MSH.historyForget = function (id) { [...HCACHE.keys()].forEach((k) => { if (k.startsWith(id + '|')) HCACHE.delete(k); }); };
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
  // Bubble Card-popupens innholdscontainer (for mellomrom/padding og kant-til-kant-rader).
  MSH.popupContainer = function (el) {
    let n = el;
    for (let i = 0; n && i < 60; i++) {
      if (n.classList && n.classList.contains('bubble-pop-up-container')) return n;
      n = n.parentNode || n.host;
    }
    return null;
  };
  MSH.popupPad = function (el) {
    const c = MSH.popupContainer(el);
    return c ? parseFloat(getComputedStyle(c).paddingLeft) || 0 : 0;
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
  // Én felles overlay-rot direkte i document.body (z-index 9000, over HA-toolbaren og Bubble-popupene).
  // Ark, menyer, tastatur og toasts rendres i dens shadow root – aldri inni kortet eller Bubble-popupen.
  MSH.overlayRoot = function () {
    let r = document.querySelector('body > ki-overlay-root');
    if (!r) {
      r = document.createElement('ki-overlay-root');
      Object.assign(r.style, { position: 'fixed', inset: '0', zIndex: '9000', pointerEvents: 'none', display: 'block' });
      r.attachShadow({ mode: 'open' }).innerHTML = '<style>:host{all:initial}.slot>*{pointer-events:auto}</style><div class="slot"></div>';
      document.body.appendChild(r);
    }
    return r.shadowRoot.querySelector('.slot');
  };
  MSH.portals = () => [...MSH.overlayRoot().querySelectorAll('.msh-portal')];
  MSH.overlay = function ({ html = '', css = '', sheet = true, maxWidth = 420, onClose, center = false } = {}) {
    const host = document.createElement('div');
    host.className = 'msh-portal';
    const R = MSH.dashRect();
    Object.assign(host.style, { position: 'fixed', left: R.left + 'px', top: '0', width: R.width + 'px', height: '100%', pointerEvents: 'auto' });
    const sr = host.attachShadow({ mode: 'open' });
    sr.innerHTML = `<style>${MSH.BASE_CSS}
      .bg{position:absolute;inset:0;background:rgba(0,0,0,0.55);opacity:0;transition:opacity .2s}
      .sh{position:absolute;left:0;right:0;${center ? 'top:50%;transform:translateY(-40%) scale(.96);border-radius:32px;' : 'bottom:0;transform:translateY(30px);border-radius:32px 32px 0 0;'}max-width:${Math.min(maxWidth, 440)}px;margin:0 auto;box-sizing:border-box;max-height:${center ? '90%' : '88%'};overflow:auto;overscroll-behavior:contain;
        padding:12px 18px calc(28px + env(safe-area-inset-bottom));background:var(--gray100,#2f2f2f);box-shadow:0 -20px 50px rgba(0,0,0,0.5);opacity:0;transition:transform .3s cubic-bezier(.34,1.3,.64,1),opacity .2s;color:#fafafa;font-family:${MSH.FONT}}
      :host(.on) .bg{opacity:1} :host(.on) .sh{opacity:1;transform:${center ? 'translateY(-50%) scale(1)' : 'translateY(0)'}}
      .grab{width:40px;height:5px;border-radius:3px;background:var(--gray400,#545454);margin:0 auto 12px}
      ${css}</style><div class="bg"></div><div class="sh" part="sheet">${sheet && !center ? '<div class="grab"></div>' : ''}<div class="body">${html}</div></div>`;
    const stop = (e) => e.stopPropagation();
    ['pointerdown', 'touchstart', 'touchmove', 'wheel'].forEach((t) => sr.querySelector('.sh').addEventListener(t, stop, { passive: true }));
    // Bubble Card lukker popupen ved klikk utenfor (lytter på window) – overlegget er ikke «utenfor».
    ['click', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend'].forEach((t) => host.addEventListener(t, stop, { passive: true }));
    const close = () => {
      if (api.closed) return;
      api.closed = true;
      host.classList.remove('on');
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('hashchange', onHash);
      setTimeout(() => host.remove(), 250);
      off();
      onClose && onClose();
      api.onClosed && api.onClosed();
    };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    const hash0 = location.hash;
    const onHash = () => { if (location.hash !== hash0) close(); };
    sr.querySelector('.bg').addEventListener('click', () => { MSH.haptic('light'); close(); });
    window.addEventListener('keydown', onKey);
    window.addEventListener('hashchange', onHash);
    MSH.overlayRoot().appendChild(host);
    // følg dashbordflaten (vindu endres, HA-sidebaren åpnes/lukkes)
    const place = () => { const D = MSH.dashRect(); host.style.left = D.left + 'px'; host.style.width = D.width + 'px'; };
    window.addEventListener('resize', place);
    const ro = window.ResizeObserver ? new ResizeObserver(place) : null;
    if (ro) { const ha = document.querySelector('home-assistant'); const main = ha && MSH.deep(ha.shadowRoot, 'ha-drawer'); ro.observe(main || document.body); }
    const off = () => { window.removeEventListener('resize', place); ro && ro.disconnect(); };
    requestAnimationFrame(() => host.classList.add('on'));
    const api = { host, root: sr, body: sr.querySelector('.body'), close };
    return api;
  };

  // Bekreftelsesmelding: 44 px pill, #e1e1e1 / #232323, top 106 px, sentrert i dashbordflaten, 2,2 s.
  MSH.toast = function (text, opts) {
    if (opts && opts.enabled === false) return;
    const R = MSH.dashRect();
    const old = MSH.overlayRoot().querySelector('#msh-toast');
    if (old) old.remove();
    const t = document.createElement('div');
    t.id = 'msh-toast';
    t.textContent = text;
    Object.assign(t.style, {
      position: 'fixed', top: '106px', left: R.left + R.width / 2 + 'px', transform: 'translate(-50%,-12px)', zIndex: '10', height: '44px', padding: '0 22px', borderRadius: '22px',
      display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', background: 'var(--gray1000, #e1e1e1)', color: 'var(--gray000, #232323)', font: `500 14px ${MSH.FONT}`,
      boxShadow: '0 12px 30px rgba(0,0,0,0.45)', opacity: '0', transition: 'opacity .2s, transform .3s cubic-bezier(.34,1.4,.64,1)', pointerEvents: 'none',
    });
    MSH.overlayRoot().appendChild(t);
    requestAnimationFrame(() => { t.style.opacity = '1'; t.style.transform = 'translate(-50%,0)'; });
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 250); }, 2200);
  };

  /* ------------------------------------------------------------ drag-vern */
  // Alle drag-elementer: touch-action + stopPropagation så Bubble Card ikke lukker/scroller popupen.
  MSH.guardDrag = function (el, axis = 'both') {
    if (!el || el.__mshGuard) return;
    el.__mshGuard = true;
    el.__mshTA = axis === 'x' ? 'pan-y' : axis === 'y' ? 'pan-x' : 'none';
    el.style.touchAction = el.__mshTA;
    const stop = (e) => e.stopPropagation();
    el.addEventListener('pointerdown', stop);
    el.addEventListener('touchstart', stop, { passive: true });
    el.addEventListener('touchmove', stop, { passive: true });
  };
  // Enkel drag-hjelper: onMove(frac 0..1, e), onEnd(frac). Horisontal som standard.
  MSH.drag = function (el, { axis = 'x', onStart, onMove, onEnd } = {}) {
    MSH.guardDrag(el, 'none');
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
    if (a.__mshTA && a.style.touchAction !== a.__mshTA) a.style.touchAction = a.__mshTA; // behold drag-vern
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
  // Fersk lovelace/config → finn kortet via card_id (også inni Bubble-popupens cards) → endre kun det
  // kortet → lovelace/config/save. YAML-modus → «Rediger i YAML», lagres kun i localStorage.
  // Lagring skal bare lagre: debounce 600 ms, og etter HAs rebuild (lovelace_updated) gjenopprettes
  // sti, hash (Bubble-popup), scroll og UI-tilstand – aldri navigate('/') eller reload.
  MSH.cacheGet = function (cardId) { try { return JSON.parse(localStorage.getItem('msh-card-' + cardId) || 'null'); } catch (e) { return null; } };
  MSH.cacheSet = function (cardId, cfg) { try { localStorage.setItem('msh-card-' + cardId, JSON.stringify(cfg)); } catch (e) { /* */ } };

  // Levende kortinstanser per card_id (en rebuild lager nye instanser; editoren oppdaterer alle).
  MSH.liveCards = MSH.liveCards || new Map();
  MSH.applyLive = function (cardId, cfg) {
    const set = cardId && MSH.liveCards.get(cardId);
    if (set) [...set].forEach((c) => { if (c.isConnected && c._rawConfig !== cfg) c.setConfig(MSH.store ? { ...cfg, __eff: 1 } : cfg); });
  };

  // Tilstand som skal overleve en rebuild
  function openPopupEl() {
    let hit = null;
    const walk = (r, d) => { if (hit || d > 14 || !r || !r.querySelectorAll) return; r.querySelectorAll('*').forEach((e) => { if (hit) return; if (e.classList && e.classList.contains('bubble-pop-up') && e.classList.contains('is-popup-opened')) hit = e; else if (e.shadowRoot) walk(e.shadowRoot, d + 1); }); };
    walk(document, 0);
    return hit;
  }
  function scrollerOf(pop) {
    if (!pop) return null;
    const c = pop.querySelector('.bubble-pop-up-container');
    return c && c.scrollHeight > c.clientHeight ? c : pop;
  }
  MSH.saveSnapshot = function () {
    const pop = openPopupEl(), sc = scrollerOf(pop);
    return { path: location.pathname + location.search, hash: location.hash, scroll: sc ? sc.scrollTop : 0, editor: MSH.portals().length > 0, until: Date.now() + 3000 };
  };
  let restoreTimer = null;
  MSH.restoreAfterSave = function () {
    const f = window.__kiSaving;
    if (!f) return;
    if (Date.now() > f.until) { window.__kiSaving = null; clearInterval(restoreTimer); restoreTimer = null; return; }
    if (location.pathname + location.search !== f.path || location.hash !== f.hash) {
      history.replaceState(history.state, '', f.path + f.hash);
      window.dispatchEvent(new Event('location-changed'));
      window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: true } }));
    }
    const sc = scrollerOf(openPopupEl());
    if (sc && f.scroll && Math.abs(sc.scrollTop - f.scroll) > 2) sc.scrollTop = f.scroll;
  };
  ['location-changed', 'hashchange', 'popstate', 'll-rebuild'].forEach((t) => window.addEventListener(t, () => { if (window.__kiSaving) setTimeout(MSH.restoreAfterSave, 0); }));
  function armRestore(snap) {
    window.__kiSaving = snap;
    clearInterval(restoreTimer);
    restoreTimer = setInterval(MSH.restoreAfterSave, 80);
  }

  const PENDING = new Map();
  async function doSave(id) {
    const p = PENDING.get(id);
    if (!p) return;
    PENDING.delete(id);
    const { hass, orig, mutate } = p;
    const newCfg = p.cfg;
    const done = (r) => { p.resolvers.forEach((fn) => fn(r)); return r; };
    const quiet = p.toasts === false;
    const urlPath = (hass && hass.panelUrl && hass.panelUrl !== 'lovelace') ? hass.panelUrl : null;
    let lc;
    try { lc = await hass.callWS({ type: 'lovelace/config', url_path: urlPath, force: true }); } catch (e) { MSH.toast('Rediger i YAML'); return done({ ok: false, yaml: true, config: newCfg }); }
    if (!lc || lc.strategy) { MSH.toast('Rediger i YAML'); return done({ ok: false, yaml: true, config: newCfg }); }
    let hit = false;
    const oldJson = JSON.stringify(orig);
    const visit = (c) => {
      if (hit || !c || typeof c !== 'object' || Array.isArray(c) || c.type !== orig.type) return null;
      if ((newCfg.card_id && c.card_id === newCfg.card_id) || (orig.card_id && c.card_id === orig.card_id) || (!c.card_id && JSON.stringify(c) === oldJson)) { hit = true; return newCfg; }
      return null;
    };
    const walk = (o) => {
      if (Array.isArray(o)) { for (let i = 0; i < o.length; i++) { const r = visit(o[i]); if (r) o[i] = r; else walk(o[i]); } return; }
      if (o && typeof o === 'object') for (const k of Object.keys(o)) { const r = visit(o[k]); if (r) o[k] = r; else walk(o[k]); }
    };
    walk(lc);
    if (!hit) { MSH.toast('Fant ikke kortet – lagret lokalt'); return done({ ok: false, config: newCfg }); }
    try { if (mutate) mutate(lc, newCfg); } catch (e) { console.warn('[ki-msh] mutate', e); }
    try { if (MSH.syncPopups) MSH.syncPopups(lc, newCfg, hass); } catch (e) { console.warn('[ki-msh] syncPopups', e); }
    armRestore(MSH.saveSnapshot());
    try {
      await hass.callWS({ type: 'lovelace/config/save', url_path: urlPath, config: lc });
      MSH.haptic('success');
      if (!quiet) MSH.toast('Lagret');
      return done({ ok: true, config: newCfg });
    } catch (e) {
      MSH.toast('Rediger i YAML');
      return done({ ok: false, yaml: true, config: newCfg });
    }
  }
  // saveCardConfig(hass, gammelConfig, nyConfig, { immediate, mutate(lovelaceConfig), toasts })
  MSH.saveLovelaceCardConfig = function (hass, oldCfg, newCfg, opts) {
    opts = opts || {};
    if (!newCfg.card_id) newCfg = { ...newCfg, card_id: (oldCfg && oldCfg.card_id) || MSH.uid() };
    MSH.cacheSet(newCfg.card_id, newCfg);
    MSH.applyLive(newCfg.card_id, newCfg); // lokalt først – brukeren ser endringen med én gang
    const id = newCfg.card_id;
    let p = PENDING.get(id);
    if (!p) { p = { orig: oldCfg || {}, resolvers: [] }; PENDING.set(id, p); }
    p.cfg = newCfg; p.hass = hass; p.toasts = opts.toasts != null ? opts.toasts : newCfg.toasts;
    if (opts.mutate) p.mutate = opts.mutate;
    clearTimeout(p.timer);
    return new Promise((res) => { p.resolvers.push(res); p.timer = setTimeout(() => doSave(id), opts.immediate ? 0 : 600); });
  };
  // Editor-lagring: til ki-store (frontend/set_user_data) – ingen Lovelace-rebuild, ingen navigering.
  // opts.lovelace = true skriver i stedet til Lovelace-configen (brukes bare når brukeren ber om det).
  // Nøkkel i ki-store for et kort: rom-kort lagres per område (rooms.<area_id>), andre per card_id (cards.<id>).
  MSH.storeKey = function (cfg, card) {
    const cls = (card && card.constructor) || (cfg && customElements.get(String(cfg.type || '').replace('custom:', '')));
    if (cls && cls.storeKey) { const k = cls.storeKey(cfg || {}, card); if (k) return k; }
    return cfg && cfg.card_id ? 'cards.' + cfg.card_id : null;
  };
  MSH.saveCardConfig = async function (hass, oldCfg, newCfg, opts) {
    opts = opts || {};
    if (opts.lovelace || !MSH.store) return MSH.saveLovelaceCardConfig(hass, oldCfg, newCfg, opts);
    if (!newCfg.card_id) newCfg = { ...newCfg, card_id: (oldCfg && oldCfg.card_id) || MSH.uid() };
    const key = opts.key || MSH.storeKey(newCfg, opts.card);
    const { type, card_id, ...rest } = newCfg;
    Object.keys(oldCfg || {}).forEach((k) => { if (!(k in newCfg) && k !== 'type' && k !== 'card_id') rest[k] = null; }); // fjernet → null
    if (hass) MSH.store.load(hass);
    try { MSH.syncLivePopups && MSH.syncLivePopups(newCfg, hass); } catch (e) { /* */ }
    const res = await MSH.store.set(key, { ...(MSH.store.get(key) || {}), ...rest }, { immediate: opts.immediate });
    return { ...res, store: true, key, config: newCfg };
  };
  // YAML-config + ki-store (null = fjernet)
  MSH.effectiveConfig = function (yaml, card) {
    const key = yaml && MSH.store ? MSH.storeKey(yaml, card) : null;
    const st = key ? MSH.store.get(key) : null;
    if (!st) return yaml;
    const out = { ...yaml };
    Object.keys(st).forEach((k) => { if (st[k] === null) delete out[k]; else out[k] = st[k]; });
    out.type = yaml.type; if (yaml.card_id) out.card_id = yaml.card_id;
    return out;
  };
  MSH.flushSaves = function () { [...PENDING.keys()].forEach((id) => { const p = PENDING.get(id); clearTimeout(p.timer); doSave(id); }); };

  // UI-tilstand (valgt fane, kamera, akkordeoner …) lagres i localStorage ki:<card_id>:ui – aldri i Lovelace.
  MSH.uiLoad = function (cardId) { try { return JSON.parse(localStorage.getItem('ki:' + cardId + ':ui') || 'null') || {}; } catch (e) { return {}; } };
  MSH.uiStore = function (cardId, ui) { try { localStorage.setItem('ki:' + cardId + ':ui', JSON.stringify(ui)); } catch (e) { /* */ } };

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
      this.shadowRoot.addEventListener('pointerdown', (e) => this._onDown(e), true); // capture: virker også under guardDrag
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
      const prevId = this._rawConfig && this._rawConfig.card_id;
      if (config.__eff) { const { __eff, ...c } = config; config = c; } // live-utkast fra editoren
      else { this._yamlConfig = config; config = MSH.effectiveConfig(config, this); }
      this._rawConfig = config;
      this._config = { ...this.constructor.defaults, ...config };
      this._firstRender = false;
      const keys = this.constructor.uiPersist || [];
      if (config.card_id && keys.length && prevId !== config.card_id) {
        const saved = MSH.uiLoad(config.card_id), pick = {};
        keys.forEach((k) => { if (saved[k] !== undefined) pick[k] = saved[k]; });
        this._ui = { ...this._ui, ...pick };
      }
      if (this.isConnected) this._register(prevId);
      this._schedule(true);
    }
    get config() { return this._config || {}; }
    set hass(h) {
      const old = this._hass;
      this._hass = h;
      MSH.lastHass = h;
      if (!old || this._changed(old, h)) this._schedule();
      if (!old) { this._checkOpen(); if (MSH.store && !MSH.store.loaded) MSH.store.load(h); }
      if (this._heroEl) this._heroEl.hass = h;
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
      this._register();
      if (MSH.store && !this._storeOff) {
        this._storeOff = MSH.store.subscribe((d, path) => {
          const key = this._yamlConfig && MSH.storeKey(this._yamlConfig, this);
          if (!key || (path && path !== key && !String(path).startsWith(key + '.') && !key.startsWith(path + '.'))) return;
          const eff = MSH.effectiveConfig(this._yamlConfig, this);
          if (JSON.stringify(eff) !== JSON.stringify(this._rawConfig)) this.setConfig(this._yamlConfig);
        });
      }
      if (window.__kiSaving) setTimeout(MSH.restoreAfterSave, 0);
      window.addEventListener('hashchange', this._onHash);
      window.addEventListener('location-changed', this._onHash);
      this._schedule(true);
      setTimeout(() => this._checkOpen(), 0);
    }
    disconnectedCallback() {
      if (this._storeOff) { this._storeOff(); this._storeOff = null; }
      const id = this._rawConfig && this._rawConfig.card_id;
      if (id && MSH.liveCards.get(id)) MSH.liveCards.get(id).delete(this);
      window.removeEventListener('hashchange', this._onHash);
      window.removeEventListener('location-changed', this._onHash);
      this.onClose && this.onClose();
    }
    _checkOpen() {
      if (!this._hass || !this.isConnected) return;
      const open = MSH.isPopupOpen(this);
      if (open && !this._open) { this._open = true; this.onOpen && this.onOpen(); if (!this._config.embedded) { requestAnimationFrame(() => this._applySpacing()); setTimeout(() => this._applySpacing(), 400); } }
      else if (!open && this._open) { this._open = false; this.onClose && this.onClose(); }
    }
    get isOpen() { return !!this._open; }
    _schedule(force) {
      if (force) this._force = true;
      if (this._raf) return;
      this._raf = requestAnimationFrame(() => { this._raf = 0; this._render(); });
    }
    update() { this._schedule(true); }
    static get uiPersist() { return []; }
    setUI(p) {
      this._ui = { ...this._ui, ...p };
      const keys = this.constructor.uiPersist || [], id = this._rawConfig && this._rawConfig.card_id;
      if (id && keys.some((k) => k in p)) { const o = {}; keys.forEach((k) => { if (this._ui[k] !== undefined) o[k] = this._ui[k]; }); MSH.uiStore(id, o); }
      this._schedule(true);
    }
    _register(prevId) {
      const id = this._rawConfig && this._rawConfig.card_id;
      if (prevId && prevId === id && MSH.liveCards.get(id) && MSH.liveCards.get(id).has(this)) return;
      if (prevId && MSH.liveCards.get(prevId)) MSH.liveCards.get(prevId).delete(this);
      if (!id) return;
      if (!MSH.liveCards.has(id)) MSH.liveCards.set(id, new Set());
      MSH.liveCards.get(id).add(this);
    }
    get ui() { return this._ui; }
    _render() {
      if (!this._config || !this._hass) return;
      if (this._busy && !this._force) return; // drag pågår
      this._force = false;
      this._deps = new Set();
      let body;
      try { body = this.render(); } catch (e) { console.error('[ki-msh]', this.localName, e); body = `<div class="empty">Feil i kortet: ${MSH.esc(e.message)}</div>`; }
      const gap = this._config.gap != null ? Number(this._config.gap) : null;
      const heroTag = MSH.HEROES[this.localName];
      const slot = heroTag ? '<div class="msh-hero-slot" data-nomorph></div>' : '';
      const html = `<style>${MSH.BASE_CSS}.msh-hero-slot{display:block;margin-bottom:var(--msh-gap, 8px)}.msh-hero-slot:empty{display:none}${this.styles || ''}</style><ha-card>${slot}${body}</ha-card>`;
      if (!this._firstRender) { this.shadowRoot.innerHTML = html; this._firstRender = true; } else MSH.morph(this.shadowRoot, html);
      if (gap != null) this.style.setProperty('--msh-gap', gap + 'px');
      if (heroTag) this._mountHero(heroTag);
      this.afterRender && this.afterRender();
      if (!this._spacedOnce && !this._config.embedded && MSH.popupContainer(this)) { this._spacedOnce = true; requestAnimationFrame(() => this._applySpacing()); }
      this._guardScrollers();
    }
    // Toppkort (hero) bygget inn som første seksjon i hovedkortet – ett kort per popup.
    _mountHero(tag) {
      const slot = this.shadowRoot.querySelector('.msh-hero-slot');
      if (!slot || !customElements.get(tag)) return;
      if (!this._heroEl) { this._heroEl = document.createElement(tag); this._heroEl._host = this; }
      const raw = this._rawConfig || {};
      if (this._heroSrc !== raw) {
        this._heroSrc = raw;
        const { type, card_id, hero, ...rest } = raw;
        this._heroEl.setConfig({ type: 'custom:' + tag, ...rest, ...(hero || {}), embedded: true, card_id: card_id ? card_id + '_hero' : undefined });
      }
      if (this._heroEl.parentNode !== slot) slot.appendChild(this._heroEl);
      if (this._heroEl.hass !== this._hass) this._heroEl.hass = this._hass;
    }
    // Mellomrom i Bubble-popupen: pad_top = avstand fra popup-headeren til kortet (negativ = inntil),
    // pad_bottom = luft i bunnen, gap = popupens kort-gap. Popupen selv har --vertical-stack-card-gap: 0.
    _applySpacing() {
      if (this._config.embedded) return;
      const cont = MSH.popupContainer(this);
      if (!cont) return;
      const c = this._config, D = this.constructor.spacingDefaults || { gap: 8, pad_top: 20, pad_bottom: 40 };
      const gap = c.gap != null ? Number(c.gap) : D.gap, top = c.pad_top != null ? Number(c.pad_top) : D.pad_top, bot = c.pad_bottom != null ? Number(c.pad_bottom) : D.pad_bottom;
      const grids = [cont, ...cont.querySelectorAll('.bubble-cards-container')];
      grids.forEach((g) => { g.style.setProperty('--bubble-pop-up-gap', gap + 'px'); g.style.gap = gap + 'px'; g.style.rowGap = gap + 'px'; });
      const cards = [...cont.querySelectorAll('*')].filter((e) => /^msh-.*-card$/.test(e.localName));
      if (!cards.length || (cards[0] !== this && cards[cards.length - 1] !== this)) return;
      const first = cards[0], last = cards[cards.length - 1];
      if (last === this) { this.style.paddingBottom = bot + 'px'; }
      if (first === this) {
        this.style.marginTop = '';
        const root = cont.getRootNode && cont.getRootNode();
        const hdr = root && root.querySelector && root.querySelector('.bubble-header-container');
        const fr = this.getBoundingClientRect();
        if (hdr && fr.height) this.style.marginTop = (top - (fr.top - hdr.getBoundingClientRect().bottom)) + 'px';
      }
    }
    // Vannrett scrollbare lister (karuseller, chip-rader): stopp sveip mot Bubble Cards swipe-to-close.
    _guardScrollers() {
      const stop = (e) => e.stopPropagation();
      this.shadowRoot.querySelectorAll('*').forEach((el) => {
        if (el.__mshSc !== undefined) return;
        const ox = getComputedStyle(el).overflowX;
        el.__mshSc = ox === 'auto' || ox === 'scroll';
        if (!el.__mshSc) return;
        el.addEventListener('touchstart', stop, { passive: true });
        el.addEventListener('touchmove', stop, { passive: true });
        el.addEventListener('pointerdown', stop);
      });
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
    customize(focus, opts) {
      if (this._config && this._config.embedded && this._host) return this._host.customize(focus, opts);
      return MSH.openEditor(this, { cardClass: this.constructor, focus, ...(opts || {}) });
    }
    getCardSize() { return this.cardSize || 3; }
    getGridOptions() { return { columns: 'full' }; }
    getLayoutOptions() { return { grid_columns: 'full' }; }
  }
  MSH.Card = MshCard;
  // Hovedkort → innebygd toppkort. Ett kort per Bubble-popup; toppkortet er første seksjon.
  MSH.HEROES = {
    'msh-rom-card': 'msh-rom-klima-card',
    'msh-basseng-card': 'msh-basseng-hero-card',
    'msh-vanning-card': 'msh-vanning-hero-card',
    'msh-klima-card': 'msh-klima-hero-card',
    'msh-media-card': 'msh-media-hero-card',
    'msh-sikkerhet-card': 'msh-sikkerhet-hero-card',
    'msh-vaer-card': 'msh-vaer-hero-card',
    'msh-person-card': 'msh-person-hero-card',
  };

  // Kortets egen editor (samme skjema som GUI-editoren). Endringer vises live i alle instanser av
  // kortet og lagres automatisk (debounce 600 ms; slidere når man slipper). «Ferdig» lukker,
  // «Avbryt» tilbakestiller til configen fra da editoren ble åpnet. Popupen blir stående åpen.
  MSH.openEditor = function (card, { cardClass, focus, areaCtx, tag, title } = {}) {
    if (!customElements.get(tag || 'msh-editor')) return null;
    const ov = MSH.overlay({ html: '', maxWidth: 520 });
    const ed = document.createElement(tag || 'msh-editor');
    ed.cardClass = cardClass || card.constructor;
    ed.inline = true;
    ed.focusSection = focus || null;
    if (areaCtx) ed.areaCtx = areaCtx;
    if (title) ed.title = title;
    ed.hass = card.hass;
    if (MSH.store && card.hass) MSH.store.refresh(card.hass);
    const orig = card._rawConfig || card.config;
    let cur = orig, dirty = false, seq = 0;
    ed.setConfig(orig);
    const status = (t, kind) => { ed.status = t; ed.statusKind = kind || ''; if (ed._render) ed._render(); };
    // Autolagring (600 ms) – stille; status i arket: «Lagrer …» → «Lagret» / «Kunne ikke lagre»
    const save = async (immediate) => {
      const my = ++seq;
      status('Lagrer …');
      const r = await MSH.saveCardConfig(card.hass, orig, cur, { immediate, card });
      if (my !== seq) return r;
      if (r && r.ok === false) { status('Kunne ikke lagre' + (r.error ? ' – ' + r.error : ''), 'err'); MSH.haptic('failure'); }
      else status('Lagret', 'ok');
      return r;
    };
    ed.addEventListener('msh-change', (ev) => {
      cur = ev.detail.config;
      if (cur.card_id) MSH.applyLive(cur.card_id, cur);
      if (card._rawConfig !== cur) card.setConfig({ ...cur, __eff: 1 });
      if (ev.detail.commit !== false) { dirty = true; save(false); }
    });
    // Lagre/Ferdig: samler ventende endringer, lagrer én gang og venter på svar
    ed.addEventListener('msh-save', async (ev) => {
      cur = (ev.detail && ev.detail.config) || cur;
      if (!dirty && cur === orig) { ov.close(); return; }
      const r = await save(true);
      if (r && r.ok === false) return; // endringen beholdes i skjemaet
      MSH.haptic('success');
      if (cur.toasts !== false) MSH.toast('Lagret');
      dirty = false;
      ov.close();
    });
    ed.addEventListener('msh-cancel', () => {
      if (cur !== orig) { card.setConfig({ ...orig, __eff: 1 }); if (orig.card_id) MSH.applyLive(orig.card_id, orig); if (dirty) MSH.saveCardConfig(card.hass, cur, orig, { immediate: true, card }); }
      dirty = false;
      ov.close();
    });
    ov.onClosed = () => { if (dirty && MSH.store) MSH.store.flush(); };
    ov.body.appendChild(ed);
    return { overlay: ov, editor: ed };
  };

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
