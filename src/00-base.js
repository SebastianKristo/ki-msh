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
  // Fiks 19.14: ingen grå tap-highlight (Android/iOS) på noe i dashbordet – egenskapen arves, så den settes også på
  // dokumentroten (dekker HA-/Bubble-elementer rundt kortene, som ellers får nettleserens grå standardflate ved trykk).
  if (!document.getElementById('msh-tap-css')) {
    const st = document.createElement('style');
    st.id = 'msh-tap-css';
    st.textContent = 'html{-webkit-tap-highlight-color:transparent}';
    (document.head || document.documentElement).appendChild(st);
  }
  MSH.FONT = "'Space Grotesk', var(--ha-font-family-body, system-ui), sans-serif";

  /* ------------------------------------------------------------ farger */
  const THEME = [['red', '#f28073', 'Rød'], ['orange', '#f2b573', 'Oransje'], ['yellow', '#f2d26f', 'Gul'], ['lime', '#b8e674', 'Lime'], ['green', '#66d19e', 'Grønn'], ['blue', '#73b9f2', 'Blå'], ['light-blue', '#c8ddfa', 'Lyseblå'], ['purple', '#ad99e6', 'Lilla'], ['pink', '#f285c9', 'Rosa'], ['brown', '#8c794d', 'Brun'],
    ['gray000', '#232323', 'Grå 000'], /* ki-hex-ok: temapalett (fargevelgere) */ ['gray100', '#2f2f2f', 'Grå 100'], ['gray200', '#3a3a3a', 'Grå 200'], ['gray300', '#404040', 'Grå 300'], ['gray400', '#545454', 'Grå 400'], ['gray500', '#696969', 'Grå 500'], ['gray600', '#7f7f7f', 'Grå 600'], ['gray700', '#979797', 'Grå 700'], ['gray800', '#afafaf', 'Grå 800'], ['gray900', '#c7c7c7', 'Grå 900'], ['gray1000', '#e1e1e1', 'Grå 1000'], ['white', '#fafafa', 'Hvit']];
  const HAC = [['primary', '#03a9f4', 'Primær'], ['accent', '#ff9800', 'Aksent'], ['red', '#f44336'], ['pink', '#e91e63'], ['purple', '#926bc7'], ['deep-purple', '#6e41ab'], ['indigo', '#3f51b5'], ['blue', '#2196f3'], ['light-blue', '#03a9f4'], ['cyan', '#00bcd4'], ['teal', '#009688'], ['green', '#4caf50'], ['light-green', '#8bc34a'], ['lime', '#cddc39'], ['yellow', '#ffeb3b'], ['amber', '#ffc107'], ['orange', '#ff9800'], ['deep-orange', '#ff5722'], ['brown', '#795548'], ['light-grey', '#bdbdbd'], ['grey', '#9e9e9e'], ['dark-grey', '#606060'], ['blue-grey', '#607d8b'], ['black', '#000000'], ['white', '#ffffff']]; // ki-hex-ok: HA-palett
  MSH.THEME_COLORS = THEME;
  MSH.HA_COLORS = HAC;
  // C.red → 'var(--red, #f28073)' osv. Bruk alltid disse i stedet for rå hex.
  const C = {};
  THEME.forEach(([k, hex]) => { C[k.replace(/-(\w)/g, (_, c) => c.toUpperCase())] = `var(--${k}, ${hex})`; });
  C.pink = 'var(--pink, #f285c9)';
  C.accent = 'linear-gradient(145deg, rgb(242 133 201) -10%, rgb(245 205 198) 100%)';
  // Fiks 34: nivåene følger temaet (tokens fra 00-a-theme.js; mørk = fallback = samme som før)
  C.dash = 'var(--ki-bg, var(--gray000, #232323))';
  C.popup = 'var(--ki-popup, #282828)';
  C.card = 'var(--ki-surface, var(--gray200, #3a3a3a))';
  C.inner = 'var(--ki-surface-2, var(--gray300, #404040))';
  C.ctrl = 'var(--ki-ctrl, var(--gray400, #545454))';
  C.text = 'var(--ki-text, #fafafa)';
  C.text2 = 'var(--ki-text-2, #afafaf)';
  C.text3 = 'var(--ki-text-3, #7f7f7f)';
  C.onAccent = 'var(--ki-on-accent, #3a3a3a)';
  C.edge = 'inset 0 0 0 1px rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.05*var(--ki-wa-k,1)),var(--ki-wa-max,1)))';
  MSH.C = C;
  // Fiks 26 (brukerens valg): «Ferdig» i ALLE Tilpass-ark = rosa pille øverst til høyre i headeren (tittel 22/600 til
  // venstre), og brytere er rosa overalt. Én kilde for målene/fargen.
  MSH.DONE_PILL = `height:40px;padding:0 18px;border-radius:20px;border:0;background:${C.accent};color:var(--ki-on-accent, #2f2f2f);font-size:14px;font-weight:600;display:inline-flex;align-items:center;justify-content:center;gap:6px;white-space:nowrap;cursor:pointer;`;
  MSH.SWITCH_ON = C.pink;
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
    if (MSH.hapticOff()) return; // Fiks 18.5: av på denne enheten → verken haptic-event eller vibrate
    const now = Date.now();
    if (now - lastHaptic < 40) return;
    lastHaptic = now;
    try { window.dispatchEvent(new CustomEvent('haptic', { detail: type, bubbles: true, composed: true })); } catch (e) { /* */ }
    try { navigator.vibrate && navigator.vibrate(HP[type]); } catch (e) { /* */ }
  };

  /* ------------------------------------------------------------ enhet (Fiks 18.5 / 18.6) */
  // Modell: navigator.userAgentData (høy entropi, async – mellomlagres i localStorage ki-device-model) ellers UA.
  let devModel = '';
  try { devModel = localStorage.getItem('ki-device-model') || ''; } catch (e) { /* */ }
  try {
    const uad = navigator.userAgentData;
    if (uad && uad.getHighEntropyValues) {
      uad.getHighEntropyValues(['model']).then((v) => {
        const m = v && String(v.model || '').trim();
        if (!m || m === devModel) return;
        devModel = m;
        try { localStorage.setItem('ki-device-model', m); } catch (e) { /* */ }
        window.dispatchEvent(new CustomEvent('ki-device-info'));
      }).catch(() => {});
    }
  } catch (e) { /* */ }
  // { model, os, label } – label «Pixel 9 Pro · Android», «iPhone · iOS», ellers «Ukjent enhet»
  MSH.deviceInfo = function () {
    const ua = navigator.userAgent || '';
    const ipad = /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    const os = ipad ? 'iPadOS' : /iPhone|iPod/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Macintosh|Mac OS X/.test(ua) ? 'macOS' : /Linux|CrOS/.test(ua) ? 'Linux' : '';
    let model = devModel;
    if (!model && os === 'Android') {
      const m = ua.match(/Android[^;)]*;\s*([^;)]+?)(?:\s+Build\/[^;)]*)?\s*(?:;|\))/);
      if (m && m[1] && m[1].length > 1 && !/^(wv|K|Mobile)$/i.test(m[1])) model = m[1].trim();
    }
    if (!model && os === 'iOS') model = 'iPhone';
    if (!model && ipad) model = 'iPad';
    return { model, os, label: model ? model + (os ? ' · ' + os : '') : os || 'Ukjent enhet' };
  };
  // browser_mod-ID (samme form som MSH.store.deviceId) eller null når browser_mod ikke finnes
  MSH.bmId = function () {
    try {
      const bm = localStorage.getItem('browser_mod-browser-id');
      return bm ? String(bm).replace(/^"|"$/g, '').replace(/[^\w-]/g, '_') : null;
    } catch (e) { return null; }
  };

  /* ------------------------------------------------------------ enhetsklasse + profiler (Fiks 19.13) */
  // Enhetsklasser: [id, navn, forhåndsvisningsbredde]. Oppdages automatisk (UA / userAgentData.model), kan overstyres
  // med localStorage ki-device-class. Pixel Fold: lukket/åpen etter containerbredden (< 600 px = lukket), live.
  MSH.DEVICE_CLASSES = [['iphone', 'iPhone', 393], ['ipad', 'iPad', 820], ['oneplus', 'OnePlus', 412], ['fold_closed', 'Pixel Fold (lukket)', 412], ['fold_open', 'Pixel Fold (åpen)', 840], ['pc', 'PC', 1280], ['annen', 'Annen', 412]];
  MSH.deviceClassName = (k) => { const d = MSH.DEVICE_CLASSES.find((x) => x[0] === k); return d ? d[1] : k === '*' ? 'Alle enheter' : String(k || ''); };
  MSH.deviceClassWidth = (k) => { const d = MSH.DEVICE_CLASSES.find((x) => x[0] === k); return d ? d[2] : 412; };
  MSH.deviceClassAuto = function (w) {
    const ua = navigator.userAgent || '', d = MSH.deviceInfo(), s = d.model + ' ' + ua;
    if (d.os === 'iOS') return 'iphone';
    if (d.os === 'iPadOS') return 'ipad';
    if (/OnePlus|\bCPH2\d{3}\b|\bPJ[A-Z]\d{3}\b|\bPJ[A-Z0-9]{4}\b/i.test(s)) return 'oneplus';
    if (/Pixel\s*(\d+\s*)?(Pro\s*)?Fold/i.test(s)) { const W = w != null ? w : MSH.dashRect ? MSH.dashRect().width : window.innerWidth; return W < 600 ? 'fold_closed' : 'fold_open'; }
    if (d.os === 'Android') return 'annen';
    if (/Windows|macOS|Linux/.test(d.os) && !(navigator.maxTouchPoints > 0)) return 'pc';
    return 'annen';
  };
  let devCls = null;
  MSH.deviceClassOverride = function (v) {
    if (v !== undefined) {
      try { if (v && MSH.DEVICE_CLASSES.some((x) => x[0] === v)) localStorage.setItem('ki-device-class', v); else localStorage.removeItem('ki-device-class'); } catch (e) { /* */ }
      devCls = null; MSH.deviceClass();
      window.dispatchEvent(new CustomEvent('ki-device-class')); window.dispatchEvent(new CustomEvent('ki-nav-bottom'));
    }
    let o = null; try { o = localStorage.getItem('ki-device-class'); } catch (e) { /* */ }
    return o && MSH.DEVICE_CLASSES.some((x) => x[0] === o) ? o : null;
  };
  MSH.deviceClass = function () { if (!devCls) devCls = MSH.deviceClassOverride() || MSH.deviceClassAuto(); return devCls; };
  // Bretting/rotasjon: ny klasse → ki-device-class (+ ki-nav-bottom) uten reload
  if (!window.__kiDevClsWatch) {
    window.__kiDevClsWatch = true;
    const re = () => {
      const n = MSH.deviceClassOverride() || MSH.deviceClassAuto();
      if (n === devCls) return;
      const had = devCls != null;
      devCls = n;
      if (had) { window.dispatchEvent(new CustomEvent('ki-device-class')); window.dispatchEvent(new CustomEvent('ki-nav-bottom')); }
    };
    try { if (window.ResizeObserver) new ResizeObserver(re).observe(document.documentElement); } catch (e) { /* */ }
    window.addEventListener('resize', re);
    window.addEventListener('ki-device-info', re);
  }
  // Denne HA-brukeren (hass.user.id, mellomlagret i localStorage ki-user-id for første visning)
  let uid = null;
  MSH.userId = function () {
    const u = MSH.lastHass && MSH.lastHass.user && MSH.lastHass.user.id;
    if (u && u !== uid) { uid = u; try { localStorage.setItem('ki-user-id', u); } catch (e) { /* */ } }
    if (!uid) { try { uid = localStorage.getItem('ki-user-id') || null; } catch (e) { /* */ } }
    return uid;
  };
  // Profiler per bruker × enhetsklasse i ki-store: <root> = { '<bruker>/<klasse>', '<bruker>/*', '*/<klasse>', '*/*' }.
  // Oppslag: ① bruker + enhet ② bruker ③ enhet ④ standard – felt for felt (det mest spesifikke vinner, null = arvet).
  // Brukes av header_profiles (Tilpass header), nav_profiles (haptic_off, bottom – 18.5/18.6) og doorbell_mode (19.18).
  MSH.profileKey = (user, cls) => (user || '*') + '/' + (cls || '*');
  MSH.profileSel = (sel) => ({ user: (sel && sel.user) || MSH.userId() || '*', cls: (sel && sel.cls) || MSH.deviceClass() });
  MSH.profileChain = function (sel) {
    const s = MSH.profileSel(sel), out = [];
    [[s.user, s.cls], [s.user, '*'], ['*', s.cls], ['*', '*']].forEach(([u, c]) => { const k = MSH.profileKey(u, c); if (!out.includes(k)) out.push(k); });
    return out;
  };
  MSH.profileRaw = function (root, key) { const R = MSH.store && MSH.store.get(root); const v = R && typeof R === 'object' ? R[key] : null; return v && typeof v === 'object' ? v : null; };
  MSH.profileHas = (root, key) => { const v = MSH.profileRaw(root, key); return !!v && Object.keys(v).length > 0; };
  // Sammenslått profil for sel (standard: denne brukeren + denne enheten). skip = nivå som hoppes over (arv uten nivået)
  MSH.profileGet = function (root, sel, skip) {
    const out = {};
    MSH.profileChain(sel).reverse().forEach((k) => {
      if (k === skip) return;
      const v = MSH.profileRaw(root, k);
      if (v) Object.keys(v).forEach((f) => { if (v[f] === null || v[f] === undefined) return; out[f] = v[f]; });
    });
    return out;
  };
  // Skriv felt til ett nivå (key = '<bruker>/<klasse>', standard denne brukeren + enheten). patch null = slett nivået
  // («Tilbakestill til arvet»); felt = undefined fjernes. Lagres straks (per enhet, ikke med i Ferdig/Avbryt).
  MSH.profileSet = function (root, patch, key, opts) {
    if (!MSH.store) return Promise.resolve({ ok: false });
    key = key || MSH.profileKey(MSH.userId(), MSH.deviceClass());
    let v;
    if (patch == null) v = undefined;
    else {
      v = { ...(MSH.profileRaw(root, key) || {}) };
      Object.keys(patch).forEach((f) => { if (patch[f] === undefined) delete v[f]; else v[f] = patch[f]; });
      if (!Object.keys(v).length) v = undefined;
    }
    const all = { ...(MSH.store.get(root) || {}) };
    if (v === undefined) delete all[key]; else all[key] = v;
    const commit = !opts || opts.commit !== false;
    return MSH.store.set(root, Object.keys(all).length ? all : undefined, { now: commit, immediate: commit });
  };

  // Fiks 18.5/18.6 → 19.13: haptic av og navbarens avstand fra bunnen ligger i nav_profiles (bruker × enhetsklasse).
  // Eldre lagring (localStorage ki-haptic-off / haptic / ki-nav-bottom og ki-store haptic_off_devices /
  // nav_bottom_devices.<browser_id>) flyttes inn i nav_profiles['<bruker>/<klasse>'] én gang og slettes.
  const NAVP = 'nav_profiles';
  let navMig = false, navLive = null;
  const migrateNav = function () {
    if (navMig || !MSH.store || !MSH.store.loaded || !MSH.userId()) return;
    navMig = true;
    const id = MSH.bmId(), patch = {}, key = MSH.profileKey(MSH.userId(), MSH.deviceClass()), cur = MSH.profileRaw(NAVP, key) || {};
    let ls = {};
    try { ls = { off: localStorage.getItem('ki-haptic-off') === '1' || localStorage.getItem('haptic') === 'off', bot: localStorage.getItem('ki-nav-bottom') }; } catch (e) { /* */ }
    const L = MSH.store.get('haptic_off_devices'), nb = MSH.store.get('nav_bottom_devices');
    if ((ls.off || (id && Array.isArray(L) && L.includes(id))) && cur.haptic_off == null) patch.haptic_off = true;
    let b = ls.bot != null && ls.bot !== '' && !isNaN(Number(ls.bot)) ? Number(ls.bot) : null;
    if (b == null && id && nb && nb[id] != null && !isNaN(Number(nb[id]))) b = Number(nb[id]);
    if (b != null && cur.bottom == null) patch.bottom = Math.max(0, Math.min(48, Math.round(b)));
    try { ['ki-haptic-off', 'haptic', 'ki-nav-bottom'].forEach((k) => localStorage.removeItem(k)); } catch (e) { /* */ }
    const oldL = id && Array.isArray(L) && L.includes(id), oldB = id && nb && nb[id] != null;
    if (!Object.keys(patch).length && !oldL && !oldB) return;
    if (Object.keys(patch).length) MSH.profileSet(NAVP, patch, key);
    if (oldL) { const r = L.filter((x) => x !== id); MSH.store.set('haptic_off_devices', r.length ? r : undefined, { now: true, immediate: true }); }
    if (oldB) { const r = { ...nb }; delete r[id]; MSH.store.set('nav_bottom_devices', Object.keys(r).length ? r : undefined, { now: true, immediate: true }); }
  };
  MSH.migrateNavProfiles = migrateNav;
  // Denne enhetens nav-profil (sammenslått)
  MSH.navProfile = () => { migrateNav(); return MSH.profileGet(NAVP); };
  MSH.hapticOff = function () {
    const off = !!MSH.navProfile().haptic_off;
    window.__kiHapticOff = off;
    return off;
  };
  // Lagres straks (ikke med i Tilpass-arkets Ferdig/Avbryt)
  MSH.setHapticOff = function (off) {
    const key = MSH.profileKey(MSH.userId(), MSH.deviceClass());
    const inh = !!MSH.profileGet(NAVP, null, key).haptic_off; // arvet verdi uten dette nivået
    MSH.profileSet(NAVP, { haptic_off: off ? (inh ? undefined : true) : (inh ? false : undefined) }, key);
    return MSH.hapticOff();
  };
  // Bubble Cards / HAs egne haptic-eventer: stoppes tidlig (capture på window) når haptic er av på denne enheten
  if (!window.__kiHapticGuard) {
    window.__kiHapticGuard = true;
    window.addEventListener('haptic', (e) => { if (MSH.hapticOff()) { e.stopImmediatePropagation(); e.stopPropagation(); } }, true);
  }
  MSH.hapticOff();

  // Fiks 18.6 · navbarens avstand fra bunnen: standard per enhet, egen verdi i nav_profiles.bottom
  MSH.navBottomDefault = function () {
    const ua = navigator.userAgent || '', d = MSH.deviceInfo(), s = d.model + ' ' + ua;
    if (d.os === 'iOS') return 0;
    if (d.os === 'iPadOS') return 12;
    if (/OnePlus|\bCPH2\d{3}\b|\bPJ[A-Z]\d{3}\b|\bPJ[A-Z0-9]{4}\b/i.test(s)) return 20;
    if (d.os === 'Android') return 16; // Pixel 9 Pro / Pixel 9 Pro Fold lukket / annen Android
    return 8;
  };
  // Egen verdi på denne enheten (px) eller null. Under dra: live-verdien (ikke lagret ennå)
  MSH.navBottomOwn = function () {
    let v = navLive ? navLive.v : MSH.navProfile().bottom;
    v = v == null || v === '' || isNaN(Number(v)) ? null : Number(v);
    return v == null ? null : Math.max(0, Math.min(48, Math.round(v)));
  };
  MSH.navBottom = () => { const v = MSH.navBottomOwn(); return v == null ? MSH.navBottomDefault() : v; };
  // v = px eller null (Standard). save=false: bare live (under dra); save=true: lagres straks
  MSH.setNavBottom = function (v, save) {
    const n = v == null || v === '' ? null : Math.max(0, Math.min(48, Math.round(Number(v))));
    if (save === false) navLive = { v: n };
    else { navLive = null; MSH.profileSet(NAVP, { bottom: n == null ? undefined : n }); }
    window.dispatchEvent(new CustomEvent('ki-nav-bottom'));
    return n;
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
    // Bare ekte entiteter: aldri interne plassholdere (__tilpass …) eller ID-er som ikke finnes i hass.states
    const h = MSH.lastHass;
    if (!entityId || String(entityId).startsWith('__') || !/^[a-z_]+\.[^\s]+$/.test(entityId) || (h && h.states && !h.states[entityId])) {
      if (entityId) console.warn('[ki-msh] more-info ignorert for', entityId);
      return;
    }
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
  // Lukk åpen Bubble Card-popup uten å navigere (Fiks 4 · 1): fjern hashen med replaceState + location-changed,
  // så Bubble Card lukker. Aldri history.back() – den kan navigere ut av dashbordet.
  MSH.closePopup = function () {
    if (!location.hash) return;
    history.replaceState(null, '', location.pathname + location.search);
    window.dispatchEvent(new Event('location-changed'));
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
  // Fiks 18.4/18.7: Fold-oppsettet (designets isFold) = telefon-innholdet i én kolonne i full bredde + vertikal navbar
  // til venstre. Containerbredde ≥ 1000 px, eller berøringsenhet med bredde ≥ 600 px (Fold åpen, iPad, PC). Erstatter
  // den brede griden (isWide er fjernet, fiks 19.11). w = containerens bredde, ikke vinduets.
  MSH.isFold = function (w) {
    const W = w != null ? w : MSH.dashRect().width;
    const touch = (navigator.maxTouchPoints || 0) > 0 || /iPad/.test(navigator.userAgent);
    return W >= 1000 || (touch && W >= 600);
  };
  // Vertikal navbar (rail): bredde (10 + 60 + 10) og avstand til dashbordkanten. Innholdet får padding-left = w + 2 × gap.
  MSH.RAIL = { w: 80, gap: 20 };
  MSH.railPad = () => MSH.RAIL.w + 2 * MSH.RAIL.gap;

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
      if (MSH.theme) MSH.theme.tag(r); // Fiks 34: data-ki-theme på overlay-roten (ark/toast)
    }
    return r.shadowRoot.querySelector('.slot');
  };
  // Liquid Glass-tema (Fiks 6): ÉN kilde for alle Tilpass-ark – ki-store → theme.liquid_glass (per bruker, felles config,
  // synkes mellom enhetene). Ikke satt → bakoverkompatibelt: navbar-stilen «glass» (msh-navbar-card speiler den til
  // <html data-ki-glass="1|0">; uten navbar leses ki-store cards.ki-navbar.style). Standard: av. Ikke localStorage.
  // Bytte (MSH.setGlassTheme / navbar-stil) sender 'ki-glass-change' → åpne ark bytter straks (MSH.overlay).
  MSH.glassOn = function () {
    try { const t = MSH.store && MSH.store.get && MSH.store.get('theme.liquid_glass'); if (t === true || t === false) return t; } catch (e) { /* */ }
    const d = document.documentElement.dataset.kiGlass;
    if (d === '1' || d === '0') return d === '1';
    try { const c = MSH.store && MSH.store.card && MSH.store.card('ki-navbar'); return !!(c && c.style === 'glass'); } catch (e) { return false; }
  };
  let glassLast = null;
  MSH.glassNotify = function () {
    const g = MSH.glassOn();
    if (g === glassLast) return;
    glassLast = g;
    window.dispatchEvent(new CustomEvent('ki-glass-change', { detail: { glass: g } }));
  };
  MSH.setGlassTheme = function (on) {
    const r = MSH.store ? MSH.store.set('theme.liquid_glass', !!on) : null;
    MSH.glassNotify();
    return r;
  };
  // Felles tilpass-ark (Fiks 6). Alle «Tilpass …»-ark (MSH.overlay, MSH.openEditor, Lys, Klima, Hjem, navbar, header,
  // kamera, vær, ruter …) får flaten herfra – ingen ark hardkoder blur.
  //   MSH.sheetStyle(glass?) / MSH.scrimStyle(glass?) → CSS-deklarasjoner for arket / bakteppet (glass = MSH.glassOn())
  //   MSH.sheetVars(glass?) → CSS-variabler som arver inn i arkets innhold (også egne editorer i shadow roots):
  //     --ki-sheet-bg / --ki-sheet-blur (sticky nav/footer/håndtak), --ki-sheet-grp / --ki-sheet-grp-sh (grupper),
  //     --ki-sheet-in (indre flate), --ki-sheet-seg (segmentspor), --ki-sheet-line (skillelinje)
  //   Standard: bakteppe rgba(0,0,0,.5) uten blur; ark #282828 radius 28 28 0 0, grupper #3a3a3a r24, indre #404040.
  //   Liquid Glass: bakteppe rgba(0,0,0,.62) uten blur (Fiks 20.8); ark rgba(34,34,37,.72) + blur(22px) saturate(190%) brightness(1.1),
  //   radius 32 32 0 0 (som «Tilpass klima» i Klima v3).
  const SH_BLUR = 'blur(22px) saturate(190%) brightness(1.1)';
  const SH = {
    solid: {
      scrim: 'background:rgb(0 0 0/max(var(--ki-ka-min,0),calc(0.5*var(--ki-ka-k,1))));backdrop-filter:none;-webkit-backdrop-filter:none;',
      sheet: 'background:var(--ki-popup, var(--gray050,#282828));backdrop-filter:none;-webkit-backdrop-filter:none;border-radius:28px 28px 0 0;box-shadow:inset 0 1px 0 rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.06*var(--ki-wa-k,1)),var(--ki-wa-max,1))),0 -12px 40px rgb(0 0 0/max(var(--ki-ka-min,0),calc(0.5*var(--ki-ka-k,1))));color:var(--ki-text, #fafafa);',
      vars: '--ki-sheet-bg:var(--ki-popup, var(--gray050,#282828));--ki-sheet-blur:none;--ki-sheet-grp:var(--ki-surface, var(--gray200,#3a3a3a));--ki-sheet-grp-sh:none;--ki-sheet-in:var(--ki-surface-2, var(--gray300,#404040));--ki-sheet-seg:var(--ki-popup, var(--gray050,#282828));--ki-sheet-line:rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.06*var(--ki-wa-k,1)),var(--ki-wa-max,1)));--ki-sheet-grab:var(--ki-ctrl, var(--gray400,#545454));',
    },
    glass: {
      // Fiks 20.8: ingen backdrop-filter på bakteppet – blur over hele skjermen bak et ark som scroller hakker på mobil
      scrim: 'background:rgb(0 0 0/max(var(--ki-ka-min,0),calc(0.62*var(--ki-ka-k,1))));backdrop-filter:none;-webkit-backdrop-filter:none;',
      sheet: `background:var(--ki-glass, rgba(34,34,37,0.72));backdrop-filter:${SH_BLUR};-webkit-backdrop-filter:${SH_BLUR};border-radius:32px 32px 0 0;box-shadow:inset 0 0 0 0.5px rgb(255 255 255/0.18),inset 0 1px 0 rgb(255 255 255/0.25),0 -12px 40px rgb(0 0 0/max(var(--ki-ka-min,0),calc(0.5*var(--ki-ka-k,1))));color:var(--ki-text, #fafafa);`,
      vars: `--ki-sheet-bg:var(--ki-glass, rgba(34,34,37,0.72));--ki-sheet-blur:${SH_BLUR};--ki-sheet-grp:rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.06*var(--ki-wa-k,1)),var(--ki-wa-max,1)));--ki-sheet-grp-sh:inset 0 0 0 0.5px rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.08*var(--ki-wa-k,1)),var(--ki-wa-max,1)));--ki-sheet-in:rgb(0 0 0/max(var(--ki-ka-min,0),calc(0.25*var(--ki-ka-k,1))));--ki-sheet-seg:rgb(0 0 0/max(var(--ki-ka-min,0),calc(0.25*var(--ki-ka-k,1))));--ki-sheet-line:rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.1*var(--ki-wa-k,1)),var(--ki-wa-max,1)));--ki-sheet-grab:rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.3*var(--ki-wa-k,1)),var(--ki-wa-max,1)));`,
    },
  };
  const shOf = (glass) => SH[(glass == null ? MSH.glassOn() : glass) ? 'glass' : 'solid'];
  MSH.sheetStyle = (glass) => shOf(glass).sheet;
  MSH.scrimStyle = (glass) => shOf(glass).scrim;
  MSH.sheetVars = (glass) => shOf(glass).vars;
  // Felles glassflater (Fiks 3 · 7c) → CSS-deklarasjoner (uten selektor), f.eks. `.box{${MSH.glassSurface('menu')}}`.
  //   menu    = «Mer»-meny/nedtrekk: rgba(40,40,44,.38), blur 22 saturate 190 % brightness 1.1, overlegg + kant, skygge
  //   sheet   = Tilpass-ark: rgba(34,34,37,.72) + samme blur/overlegg/kant
  //   row     = rader/grupper inni et glassark: rgba(255,255,255,.06) + inset .5px rgba(255,255,255,.08)
  //   segment = spor i segmentvelgere: rgba(0,0,0,.25) (aktiv = glassboble, se MSH.GLASS_BUBBLE)
  // Overlegget (lys gradient) legges som ekstra bakgrunnslag, så flaten trenger ingen egne pseudo-elementer.
  // Uten backdrop-filter-støtte: menu/sheet → #2f2f2f, row → #3a3a3a (se MSH.glassFallback).
  const GL_BLUR = 'blur(22px) saturate(190%) brightness(1.1)';
  const GL_SHEEN = 'linear-gradient(180deg,rgb(255 255 255/0.14),rgb(255 255 255/0.02) 45%,rgb(255 255 255/0.06))';
  const GL_EDGE = 'inset 0 0 0 0.5px rgb(255 255 255/0.18),inset 0 1px 0 rgb(255 255 255/0.25)';
  MSH.glassSurface = function (level) {
    switch (level) {
      case 'menu': return `background:${GL_SHEEN},var(--ki-glass, rgba(40,40,44,0.38));backdrop-filter:${GL_BLUR};-webkit-backdrop-filter:${GL_BLUR};box-shadow:${GL_EDGE},0 18px 40px rgb(0 0 0/max(var(--ki-ka-min,0),calc(0.45*var(--ki-ka-k,1))));color:var(--ki-text, #fafafa);`;
      case 'sheet': return MSH.sheetStyle(true).replace(/border-radius:[^;]*;/, ''); // = glassarket i MSH.sheetStyle
      case 'row': return 'background:rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.06*var(--ki-wa-k,1)),var(--ki-wa-max,1)));box-shadow:inset 0 0 0 0.5px rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.08*var(--ki-wa-k,1)),var(--ki-wa-max,1)));';
      case 'segment': return 'background:rgb(0 0 0/max(var(--ki-ka-min,0),calc(0.25*var(--ki-ka-k,1))));';
      default: return '';
    }
  };
  // @supports-reserve (legg etter regelen som bruker glassSurface): sel = selektor, level som over.
  MSH.glassFallback = (sel, level) => `@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){${sel}{background:${level === 'row' ? 'var(--ki-surface, #3a3a3a)' : 'var(--ki-surface-3, #2f2f2f)'};backdrop-filter:none;-webkit-backdrop-filter:none}}`;
  // Aktiv glassboble (segmentvelgere, dra-linsen)
  MSH.GLASS_BUBBLE = 'background:linear-gradient(180deg,rgb(255 255 255/0.32),rgb(255 255 255/0.1));box-shadow:inset 0 1px 0 rgb(255 255 255/0.65),inset 0 -1px 1px rgb(255 255 255/0.18),inset 0 0 0 0.5px rgb(255 255 255/0.4);color:var(--ki-text, #fafafa);';
  // CSS-variabler som arver inn i alle shadow roots under et glassark (felles editor, egne editorer):
  // --ki-g-row/--ki-g-ring (rader/grupper), --ki-g-seg (segmentspor), --ki-g-in (felt), --ki-g-on/--ki-g-on-c/--ki-g-on-sh
  // (aktivt segment), --ki-g-t2 (sekundærtekst). Uten glass er de udefinert → editorene faller tilbake til standardfargene.
  MSH.GLASS_VARS = '--ki-glass-on:1;--ki-g-row:rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.06*var(--ki-wa-k,1)),var(--ki-wa-max,1)));--ki-g-ring:inset 0 0 0 0.5px rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.08*var(--ki-wa-k,1)),var(--ki-wa-max,1)));--ki-g-seg:rgb(0 0 0/max(var(--ki-ka-min,0),calc(0.25*var(--ki-ka-k,1))));--ki-g-in:rgb(0 0 0/max(var(--ki-ka-min,0),calc(0.25*var(--ki-ka-k,1))));'
    + '--ki-g-on:linear-gradient(180deg,rgb(255 255 255/0.32),rgb(255 255 255/0.1));--ki-g-on-c:var(--ki-text, #fafafa);--ki-g-on-sh:inset 0 1px 0 rgb(255 255 255/0.65),inset 0 -1px 1px rgb(255 255 255/0.18),inset 0 0 0 0.5px rgb(255 255 255/0.4);--ki-g-t2:var(--ki-text-2, rgba(255,255,255,0.62));';
  // Liquid glass ved TRYKK (Fiks 4 · 3, fasit glass-drag.js · tapMorph). Én felles hjelper for alle fanerader og
  // segmentvelgere:
  //   MSH.glassTap(row, { items, active, enabled, host, axis })   – kobler raden på (idempotent, kall gjerne etter hver render)
  //     items()  → knappene (standard: button/[data-glass-item] i raden)
  //     active() → aktiv knapp (standard: [aria-selected="true"] / [data-active] / .on / .on-pk, ellers knappen med bakgrunn)
  //     enabled()→ false = ingen animasjon (f.eks. bare i glassmodus)
  //     host     → containeren linsen legges i (standard: raden)
  //   MSH.glassMorph(host, fromEl, toEl, { axis }) – spill animasjonen direkte (rader uten click, f.eks. Basseng).
  // Aktiv knapp bør merkes eksplisitt med aria-selected="true" (eller data-active) når raden rendres.
  // Én global click-lytter (capture, window) finner rad og knapp via composedPath – FØR kortet bytter state, så
  // linsen starter som den rosa pillen på den gamle aktive fanen og morfer til den nye (MSH.glassMorph, Fiks 17.19:
  // 300 ms, pillene skjult under morfen). Ingen animasjon: allerede aktiv fane, rett etter glass-dra/fane-dra
  // (MSH.glassDragEnd()), MSH.animOff() (Liquid Glass-animasjon av i «Tilpass Hjem» → Faner, prefers-reduced-motion).
  // Ingen haptic her – kortets egen haptic('selection') ved fanebytte er den eneste.
  const LENS_CSS = { position: 'absolute', left: '0', top: '0', zIndex: '3', pointerEvents: 'none', borderRadius: '999px', background: 'linear-gradient(180deg, rgb(255 255 255/0.32), rgb(255 255 255/0.1))', boxShadow: 'inset 0 1px 0 rgb(255 255 255/0.65), inset 0 -1px 1px rgb(255 255 255/0.18), inset 0 0 0 0.5px rgb(255 255 255/0.4), 0 10px 24px rgb(0 0 0/max(var(--ki-ka-min,0),calc(0.35*var(--ki-ka-k,1))))', backdropFilter: 'blur(4px) saturate(220%) brightness(1.15)', WebkitBackdropFilter: 'blur(4px) saturate(220%) brightness(1.15)', opacity: '0' };
  MSH.GLASS_LENS = LENS_CSS;
  let gdEndT = 0;
  MSH.glassDragEnd = () => { gdEndT = Date.now(); }; // kalles av glass-dra og fane-dra ved slipp
  const reduced = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  // Fiks 16.10: linsen følger sporet (anchor) HVER frame – endres layouten under animasjonen (innhold med annen høyde,
  // scroll, hero som vokser), flyttes linsen med CSS `translate` (virker sammen med transform-animasjonen), så den
  // aldri lander på et gammelt mål. Virker både for position:absolute (offsetParent) og position:fixed (viewport).
  //   const f = MSH.lensFollow(lens, sporet); f.reset() – nytt utgangspunkt (etter ny plassering); f.stop()
  MSH.lensFollow = function (l, anchor) {
    const fixed = l.style.position === 'fixed';
    const pos = () => {
      if (!anchor || !anchor.isConnected) return null;
      const a = anchor.getBoundingClientRect();
      if (fixed) return { x: a.left, y: a.top };
      const op = l.offsetParent;
      if (!op) return null;
      const o = op.getBoundingClientRect(), k = op.offsetWidth ? o.width / op.offsetWidth : 1;
      return { x: (a.left - o.left) / k + op.scrollLeft, y: (a.top - o.top) / k + op.scrollTop };
    };
    const st = { base: pos(), raf: 0 };
    const tick = () => {
      if (!l.isConnected) { st.raf = 0; return; }
      const p = pos();
      if (p && st.base) { const v = `${(p.x - st.base.x).toFixed(2)}px ${(p.y - st.base.y).toFixed(2)}px`; if (l.style.translate !== v) l.style.translate = v; }
      st.raf = requestAnimationFrame(tick);
    };
    st.raf = requestAnimationFrame(tick);
    return { reset() { st.base = pos(); l.style.translate = ''; }, stop() { cancelAnimationFrame(st.raf); st.raf = 0; } };
  };
  // Fiks 17.18: Liquid Glass-ANIMASJONEN (linse ved dra og trykk) kan slås av for hele dashbordet. Én kilde: ki-store
  // ui.glass_anim (true|false, per bruker, standard på), speilet i localStorage ki:glass_anim (cache før ki-store er lastet).
  // Leses i pointerdown og før hver trykk-animasjon (ikke bare ved lasting) → virker straks uten reload. Påvirker ikke
  // Liquid Glass-temaet / navbar-utseendet – bare animasjonen.
  //   MSH.glassAnimOn() · MSH.setGlassAnim(on) · MSH.animOff() (= av eller prefers-reduced-motion → ingen linse)
  const GA_LS = 'ki:glass_anim';
  MSH.glassAnimOn = function () {
    const S = MSH.store;
    let v;
    try { v = S && S.get ? S.get('ui.glass_anim') : undefined; } catch (e) { v = undefined; }
    if (v === true || v === false || (S && S.loaded)) {
      const on = v !== false;
      try { if (localStorage.getItem(GA_LS) !== (on ? '1' : '0')) localStorage.setItem(GA_LS, on ? '1' : '0'); } catch (e) { /* */ }
      return on;
    }
    try { return localStorage.getItem(GA_LS) !== '0'; } catch (e) { return true; }
  };
  MSH.setGlassAnim = function (on) {
    try { localStorage.setItem(GA_LS, on ? '1' : '0'); } catch (e) { /* */ }
    const r = MSH.store && MSH.store.set ? MSH.store.set('ui.glass_anim', !!on, { now: true }) : null; // lagres straks, også mens Tilpass Hjem har utkast
    if (!on) Array.from(LENSES.keys()).forEach((c) => MSH.glassKill(c)); // pågående linser forsvinner med én gang
    return r;
  };
  MSH.animOff = () => reduced() || !MSH.glassAnimOn();

  // Fiks 17.19 (fasit glass-drag.js, ny versjon): linsen ER den rosa pillen mens den beveger seg – ingen egen tidsbruk.
  //   · fyllet til det aktive elementet leses (getComputedStyle → backgroundImage/backgroundColor), linsen tegnes som
  //     glass-gradient + fyllet, og den ekte pillen skjules med data-gd-hide (transparent, ingen skygge, ingen overgang)
  //   · linsen ligger i containeren bak knappenes innhold (z-index −1, containeren får isolation via data-gd-on), så
  //     teksten alltid er lesbar; position:absolute (aldri fixed – fallgruve 1), overlever morph (__mshKeep)
  //   · maks én linse per container (Map); ny drag/nytt trykk avbryter og rydder den forrige (MSH.glassKill)
  //   · finish(): dobbel rAF (+ setTimeout 200 som reserve) → ekte pille vises (uten overgang), linsen tones ut på 120 ms
  // data-gd-hide-regelen legges i roten til elementet (document.head / adoptedStyleSheets i shadow roots), og morph
  // fjerner aldri data-gd-hide/data-gd-on (patchAttrs). En vakt hver frame holder pillene skjult også om kortet tegner
  // nye noder under animasjonen (opt.active → gjeldende aktive knapp).
  //   const s = MSH.glassLens(c, { from, active }); s.hide(el); s.place(x, y, w, h) (klient-rect); s.finish(); MSH.glassKill(c)
  const GD_CSS = '[data-gd-hide]{background:transparent !important;box-shadow:none !important;transition:none !important}[data-gd-on]{isolation:isolate}';
  let gdSheet = null;
  const gdCss = (el) => {
    const r = el && el.getRootNode ? el.getRootNode() : document;
    if (!r || (r.__gdCss && (r.__gdCss === true || r.__gdCss.isConnected))) return;
    if (!r.host) {
      const s = document.createElement('style'); s.id = 'msh-gd-hide'; s.textContent = GD_CSS;
      (document.head || document.documentElement).appendChild(s); document.__gdCss = s; return;
    }
    try { if (!gdSheet) { gdSheet = new CSSStyleSheet(); gdSheet.replaceSync(GD_CSS); } if (!r.adoptedStyleSheets.includes(gdSheet)) r.adoptedStyleSheets = [...r.adoptedStyleSheets, gdSheet]; r.__gdCss = true; } catch (e) { const s = document.createElement('style'); s.textContent = GD_CSS; s.__mshKeep = true; r.appendChild(s); r.__gdCss = s; }
  };
  MSH.glassHideCss = GD_CSS; // for kort som vil ha regelen i egne static styles
  const fillOf = (el) => {
    if (!el || el.nodeType !== 1) return '';
    if (el.__gdFill != null && el.hasAttribute('data-gd-hide')) return el.__gdFill;
    const cs = getComputedStyle(el), out = [];
    if (cs.backgroundImage && cs.backgroundImage !== 'none') out.push(cs.backgroundImage);
    if (!/^(transparent|rgba\(\d+,\s*\d+,\s*\d+,\s*0\))$/.test(cs.backgroundColor)) out.push(cs.backgroundColor);
    return out.join(', ');
  };
  const GD_GRAD = 'linear-gradient(180deg, rgb(255 255 255/0.32), rgb(255 255 255/0.1))';
  const LENSES = new Map();
  const unhide = (el) => {
    if (!el.hasAttribute('data-gd-hide')) return;
    const t = el.style.transition;
    el.style.transition = 'none'; // ekte pille på plass straks, uten kortets egen bakgrunnsovergang
    el.removeAttribute('data-gd-hide');
    void getComputedStyle(el).backgroundColor;
    requestAnimationFrame(() => { if (el.style.transition === 'none') el.style.transition = t; });
  };
  MSH.glassKill = function (c, only) {
    const s = LENSES.get(c);
    if (!s || (only && s !== only)) return;
    LENSES.delete(c);
    s.dead = true;
    cancelAnimationFrame(s.raf);
    s.timers.forEach(clearTimeout);
    if (s.an) { s.an.onfinish = null; try { s.an.cancel(); } catch (e) { /* */ } }
    if (s.fw) s.fw.stop();
    s.hidden.forEach(unhide);
    s.hidden.clear();
    s.l.remove();
    c.__mshKeepN = Math.max(0, (c.__mshKeepN || 1) - 1);
    c.removeAttribute('data-gd-on');
  };
  MSH.glassLens = function (c, opt = {}) {
    MSH.glassKill(c);
    gdCss(c);
    const from = opt.from || null, fill = fillOf(from);
    const l = document.createElement('span');
    l.className = 'gd-lens';
    l.setAttribute('aria-hidden', 'true');
    l.__mshKeep = true;
    Object.assign(l.style, LENS_CSS, { zIndex: '-1', opacity: '1', transition: 'width .12s, height .12s', boxShadow: 'inset 0 1px 0 rgb(255 255 255/0.65), inset 0 -1px 1px rgb(255 255 255/0.18), inset 0 0 0 0.5px rgb(255 255 255/0.4)' });
    if (fill) l.style.background = `${GD_GRAD}, ${fill}`;
    if (from) { const br = getComputedStyle(from).borderRadius; if (br && br !== '0px') l.style.borderRadius = br; }
    c.appendChild(l);
    c.__mshKeepN = (c.__mshKeepN || 0) + 1;
    c.setAttribute('data-gd-on', '');
    const s = { c, l, from, hidden: new Set(), active: opt.active || null, an: null, fw: null, timers: [], raf: 0, dead: false, fin: false };
    s.hide = (el) => {
      if (!el || el.nodeType !== 1 || s.dead) return;
      if (!el.hasAttribute('data-gd-hide')) { el.__gdFill = fillOf(el); gdCss(el); el.setAttribute('data-gd-hide', ''); }
      s.hidden.add(el);
    };
    s.place = (x, y, w, h) => {
      if (s.dead) return;
      if (!l.isConnected) c.appendChild(l);
      const op = l.offsetParent || c, r = op.getBoundingClientRect(), k = op.offsetWidth ? r.width / op.offsetWidth : 1;
      Object.assign(l.style, { left: (x - r.left) / k - op.clientLeft + op.scrollLeft + 'px', top: (y - r.top) / k - op.clientTop + op.scrollTop + 'px', width: w / k + 'px', height: h / k + 'px' });
      if (s.fw) s.fw.reset();
    };
    // Glid linsen til el (ferske mål, f.eks. aktiv fane som ble bredere ved valg: ikon → ikon + navn) og fullfør etterpå.
    // Er linsen allerede der (±1 px) → finish() straks.
    s.glideTo = (el, ms = 180) => {
      if (s.dead || s.fin) return;
      const r = el && el.nodeType === 1 && el.isConnected ? el.getBoundingClientRect() : null;
      const cur = l.getBoundingClientRect();
      if (!r || !r.width || (Math.abs(r.left - cur.left) <= 1 && Math.abs(r.width - cur.width) <= 1 && Math.abs(r.top - cur.top) <= 1 && Math.abs(r.height - cur.height) <= 1)) { s.finish(); return; }
      const e = `${ms}ms cubic-bezier(.3,.8,.3,1)`;
      l.style.transition = `left ${e}, top ${e}, width ${e}, height ${e}`;
      s.place(r.left, r.top, r.width, r.height);
      s.timers.push(setTimeout(() => s.finish(), ms));
    };
    s.finish = () => {
      if (s.fin || s.dead) return;
      s.fin = true;
      let done = false;
      const go = () => {
        if (done || s.dead) return;
        done = true;
        cancelAnimationFrame(s.raf); s.raf = 0;
        if (s.an) { try { s.an.commitStyles(); } catch (e) { /* */ } s.an.onfinish = null; try { s.an.cancel(); } catch (e) { /* */ } s.an = null; }
        l.style.transition = 'opacity .12s';
        // Fiks 24.2: linsen får nøyaktig målene til den ekte aktive fanen (etter fanebyttet) før den tones ut → ingen hopp
        let t = null;
        try { t = s.active && s.active(); } catch (e) { t = null; }
        if (!(t && t.nodeType === 1 && t.isConnected)) t = s.target && s.target.isConnected ? s.target : null;
        if (t && c.isConnected) { const r = t.getBoundingClientRect(); if (r.width && r.height) s.place(r.left, r.top, r.width, r.height); }
        s.hidden.forEach(unhide); s.hidden.clear();
        l.style.opacity = '0';
        s.timers.push(setTimeout(() => MSH.glassKill(c, s), 140));
      };
      requestAnimationFrame(() => requestAnimationFrame(go));
      s.timers.push(setTimeout(go, 200)); // reserve: pillen blir aldri liggende skjult
    };
    const guard = () => {
      if (s.dead) return;
      if (!c.isConnected) { MSH.glassKill(c, s); return; }
      if (!c.hasAttribute('data-gd-on')) c.setAttribute('data-gd-on', '');
      if (!l.isConnected) c.appendChild(l);
      s.hidden.forEach((el) => { if (el.isConnected && !el.hasAttribute('data-gd-hide')) el.setAttribute('data-gd-hide', ''); });
      if (s.active && !s.fin) { try { const a = s.active(); if (a && a.nodeType === 1 && !s.hidden.has(a)) s.hide(a); } catch (e) { /* */ } }
      s.raf = requestAnimationFrame(guard);
    };
    s.raf = requestAnimationFrame(guard);
    LENSES.set(c, s);
    return s;
  };
  // Trykk: WAAPI-morf fra → til på 300 ms (cubic-bezier(.3,.8,.3,1), lett strekk midtveis), fill: forwards. Både fra- og
  // til-knappen er skjult under morfen, så rosa bare finnes i linsen. Til slutt vises den ekte pillen og linsen fjernes.
  // Fiks 24.2 (fasit glass-drag.js tapMorph): startfanen (from) måles FØR klikket og linsen legges der; målfanen måles
  // først i neste rAF, ETTER at fanebyttet er rendret (ikon → ikon + navn gjør den bredere), og linsen animeres dit.
  // Viser opt.active() fortsatt den gamle fanen, ventes maks 3 frames til. Ny animasjon i mellomtiden (glassKill →
  // s.dead) avbryter. Animasjonsobjektet lages straks (står på startfanen) og får keyframes når målet er målt.
  MSH.glassMorph = function (host, from, to, opt = {}) {
    if (!host || !from || !to || from === to || !host.isConnected || !to.animate) return null;
    if (MSH.animOff()) { MSH.glassKill(host); return null; }
    const s = MSH.glassLens(host, { from, active: opt.active });
    const l = s.l;
    s.hide(from); s.hide(to);
    // klient-rect → lokale koordinater i linsens containing block (skala fra Bubble-transform + scroll)
    const loc = (el) => { const op = l.offsetParent || host, orr = op.getBoundingClientRect(), k = op.offsetWidth ? orr.width / op.offsetWidth : 1, r = el.getBoundingClientRect(); return { x: (r.left - orr.left) / k - op.clientLeft + op.scrollLeft, y: (r.top - orr.top) / k - op.clientTop + op.scrollTop, w: r.width / k, h: r.height / k }; };
    const A = loc(from);
    const f = (x, y, w, h, t) => ({ left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px', transform: t });
    Object.assign(l.style, { transition: 'none', ...f(A.x, A.y, A.w, A.h, '') });
    const an = l.animate([f(A.x, A.y, A.w, A.h, 'scale(1)'), f(A.x, A.y, A.w, A.h, 'scale(1)')], { duration: 300, easing: 'cubic-bezier(.3,.8,.3,1)', fill: 'forwards' });
    an.pause();
    s.an = an;
    an.oncancel = () => s.finish(); // Fiks 20.18: avbrutt (fanen byttes midt i, siden skjult) → linsen fjernes alltid
    const act = () => { try { const a = opt.active && opt.active(); return a && a.nodeType === 1 && a.isConnected ? a : null; } catch (e) { return null; } };
    let tries = 0;
    const go = () => {
      if (s.dead || s.fin) return;
      const a = act();
      if (a === from && from.isConnected && tries++ < 3) { requestAnimationFrame(go); return; } // fanebyttet er ikke tegnet ennå
      const T = a && a !== from ? a : (to.isConnected ? to : a);
      if (!T || !host.isConnected) { s.finish(); return; }
      s.target = T;
      s.hide(T);
      const B = loc(T);
      const ax = opt.axis || (Math.abs(B.x + B.w / 2 - A.x - A.w / 2) >= Math.abs(B.y + B.h / 2 - A.y - A.h / 2) ? 'x' : 'y');
      const cx = (A.x + A.w / 2 + B.x + B.w / 2) / 2, cy = (A.y + A.h / 2 + B.y + B.h / 2) / 2;
      const W = ax === 'x' ? Math.max(A.w, B.w) * 1.15 : (A.w + B.w) / 2, H = ax === 'y' ? Math.max(A.h, B.h) * 1.15 : (A.h + B.h) / 2;
      try {
        an.effect.setKeyframes([
          { offset: 0, ...f(A.x, A.y, A.w, A.h, 'scale(1)') },
          { offset: 0.5, ...f(cx - W / 2, cy - H / 2, W, H, ax === 'x' ? 'scale(1.02, 0.94)' : 'scale(0.94, 1.02)') },
          { offset: 1, ...f(B.x, B.y, B.w, B.h, 'scale(1)') },
        ]);
      } catch (e) { s.finish(); return; }
      s.fw = MSH.lensFollow(l, T); // rammene er regnet fra start – følg målet hvis raden scroller / layouten flytter seg
      an.onfinish = () => s.finish();
      an.play();
      // Fiks 20.18: onfinish som aldri kommer → sikkerhets-timeout fjerner linsen alltid
      s.timers.push(setTimeout(() => s.finish(), 400));
    };
    requestAnimationFrame(go);
    s.timers.push(setTimeout(() => { if (!s.target) s.finish(); }, 250)); // rAF kommer aldri (skjult side) → rydd
    return an;
  };
  const hasBg = (el) => { const cs = getComputedStyle(el); return (cs.backgroundImage && cs.backgroundImage !== 'none') || !/^(transparent|rgba\(\d+,\s*\d+,\s*\d+,\s*0\))$/.test(cs.backgroundColor); };
  const gtItems = (row) => {
    const o = row.__gt || {};
    const its = o.items ? Array.from(o.items() || []) : Array.from(row.querySelectorAll('button,[data-glass-item]'));
    return its.filter((b) => b && b.isConnected && b.getClientRects().length);
  };
  const gtActive = (row, its) => {
    const o = row.__gt || {};
    if (o.active) { const a = o.active(); if (a && a.nodeType === 1) return a; if (a != null) return its.find((b) => (b.dataset.tabId || b.dataset.key || b.dataset.id || b.dataset.t || b.dataset.v) === a) || null; }
    const ex = its.find((b) => b.getAttribute('aria-selected') === 'true' || (b.hasAttribute('data-active') && b.getAttribute('data-active') !== 'false'));
    if (ex) return ex;
    const cl = its.find((b) => b.classList.contains('on') || b.classList.contains('on-pk'));
    if (cl) return cl;
    const bg = its.filter(hasBg); // fasit: aktiv knapp er den som har bakgrunn
    return bg.length === 1 ? bg[0] : null;
  };
  MSH.glassTap = function (row, opt = {}) {
    if (!row) return;
    row.__gt = { ...(row.__gt || {}), ...opt };
    if (!row.hasAttribute('data-glass-tap')) row.setAttribute('data-glass-tap', '');
  };
  MSH.glassActive = (row, its) => gtActive(row, its || gtItems(row)); // aktiv knapp i en rad (glassDrag, Fiks 17.19)
  if (!window.__mshGlassTap) {
    window.__mshGlassTap = true;
    window.addEventListener('click', (e) => {
      if (e.button || Date.now() - gdEndT < 450) return; // glass-dra har allerede vist bevegelsen
      const path = e.composedPath ? e.composedPath() : [];
      const ri = path.findIndex((n) => n && n.nodeType === 1 && (n.__gt || (n.hasAttribute && n.hasAttribute('data-glass-tap'))));
      if (ri < 1) return;
      const row = path[ri], o = row.__gt || {};
      if (o.enabled && !o.enabled()) return;
      const its = gtItems(row), to = path.slice(0, ri).reverse().find((n) => its.includes(n));
      if (!to || to.disabled || to.getAttribute('aria-disabled') === 'true') return;
      const from = gtActive(row, its);
      if (!from || from === to) return;
      MSH.glassMorph(o.host || row, from, to, { axis: o.axis, active: () => gtActive(row, gtItems(row)) });
    }, true);
  }

  let glassSub = null;
  // Fiks 26.16: antall åpne ark. >0 → <html data-ki-sheet> + window-event 'ki-sheet' { open } – navbaren (msh-navbar-card)
  // setter da pointer-events: none på navbar, mini-spiller og «Mer»-meny, og gir dem tilbake uten hopp når siste ark lukkes.
  let sheetN = 0;
  MSH.sheetCount = function (d) {
    const was = sheetN > 0;
    sheetN = Math.max(0, sheetN + (d || 0));
    const on = sheetN > 0;
    if (on !== was) {
      document.documentElement.toggleAttribute('data-ki-sheet', on);
      window.dispatchEvent(new CustomEvent('ki-sheet', { detail: { open: on } }));
    }
    return sheetN;
  };
  MSH.sheetOpen = () => sheetN > 0;
  MSH.portals = () => [...MSH.overlayRoot().querySelectorAll('.msh-portal')];
  // Ark/overlegg i ki-overlay-root. Flaten kommer fra MSH.sheetStyle/scrimStyle/sheetVars (Fiks 6) og følger Liquid
  // Glass-temaet live (glass: true/false tvinger). sheet = grep-håndtak (sticky, alltid synlig), tall = høyt ark
  // (max-height 100 % − 24 px − safe-area-top, «Tilpass …»-editorene), footer = arket har egen sticky bunnlinje
  // (ingen bunnpadding; bunnlinjen tar safe-area selv). Padding styres med --ki-sh-pt / --ki-sh-px / --ki-sh-pb.
  // 28.8/28.11 · tilpass: true = «Tilpass …»-ark med popupens geometri: toppkant 50 px (= margin_top_mobile/desktop),
  // forankret i bunnen av dashbordflaten (dekker navbaren og «Spilles nå»), FAST høyde calc(100% − 50px) i alle faner,
  // bredde = den åpne Bubble-popupen (width_desktop, sentrert likt) på PC (≥ 768 px), ellers 540 px sentrert i innholdsflaten;
  // full bredde på mobil. Radius 28 28 0 0, håndtak 40×5 (#545454) øverst, bunnpadding 16 px + safe-area.
  // Inn: translateY(100%) → 0 på 280 ms cubic-bezier(.2,.8,.2,1). Dra ned på håndtaket lukker (> 90 px eller raskt sveip).
  MSH.TILPASS_TOP = 50;
  MSH.overlay = function ({ html = '', css = '', sheet = true, maxWidth = 420, onClose, center = false, glass, guard = 0, bgHaptic = true, tall = false, footer = false, tilpass = false } = {}) {
    const tp = !!tilpass && !center;
    if (tp) sheet = true;
    const host = document.createElement('div');
    host.className = 'msh-portal';
    const gl = glass != null ? !!glass : MSH.glassOn();
    if (gl) { host.classList.add('glass'); host.setAttribute('data-glass', ''); }
    if (!glassSub && MSH.store && MSH.store.subscribe) glassSub = MSH.store.subscribe((d, p) => { if (!p || /^(theme|cards\.ki-navbar)(\.|$)/.test(p)) MSH.glassNotify(); });
    // Fiks 18.4: med vertikal navbar (Fold-oppsettet) ligger ARKET på innholdsflaten til høyre for railen (--ki-rail-x).
    // Fiks 26.16: bakteppet dekker HELE dashbordflaten, også navbaren/railen (ikke HA-sidebaren). Lag i ki-overlay-root:
    // innhold < navbar (z 24) < Bubble-popups < ark-bakteppe (42) < ark (43) < toast (60). Mens et ark er åpent får
    // navbaren, mini-spilleren og «Mer»-menyen pointer-events: none (MSH.sheetCount → html[data-ki-sheet] + 'ki-sheet').
    const railX = () => (MSH.railOn && MSH.railPad ? MSH.railPad() : 0);
    const R = MSH.dashRect(), rx = railX();
    Object.assign(host.style, { position: 'fixed', left: R.left + 'px', top: '0', width: R.width + 'px', height: '100%', pointerEvents: 'auto', zIndex: '42' });
    host.style.setProperty('--ki-rail-x', rx + 'px');
    const sr = host.attachShadow({ mode: 'open' });
    // Fiks 20.8 · jevn scrolling: arket er eget lag (translate3d), egen scroll-container (overscroll-behavior: contain,
    // -webkit-overflow-scrolling: touch, touch-action: pan-y, contain: layout paint) – scrollen kjedes aldri til dashbordet.
    const mh = center ? '90%' : tall ? 'calc(100% - 24px - env(safe-area-inset-top, 0px))' : 'min(88vh, calc(100% - 24px - env(safe-area-inset-top, 0px)))';
    sr.innerHTML = `<style>${MSH.BASE_CSS}
      :host{${MSH.sheetVars(false)}--ki-grab-h:25px}
      .bg{position:absolute;inset:0;z-index:0;${MSH.scrimStyle(false)}opacity:0;transition:opacity .2s}
      .sh{position:absolute;z-index:1;left:var(--ki-rail-x,0px);right:0;${center ? 'top:50%;transform:translate3d(0,-40%,0) scale(.96);' : 'bottom:0;transform:translate3d(0,30px,0);'}max-width:${Math.min(maxWidth, center ? 440 : 420)}px;margin:0 auto;box-sizing:border-box;max-height:${mh};overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y;contain:layout paint;
        --ki-sh-pt:12px;--ki-sh-px:18px;--ki-sh-pb:calc(16px + env(safe-area-inset-bottom, 0px));padding:var(--ki-sh-pt) var(--ki-sh-px) var(--ki-sh-pb);
        ${MSH.sheetStyle(false)}${center ? 'border-radius:32px;' : ''}opacity:0;transition:transform .3s cubic-bezier(.34,1.3,.64,1),opacity .2s;font-family:${MSH.FONT}}
      .sh.ft{--ki-sh-pb:0px}
      /* 28.8/28.11: Tilpass-ark – popupens toppkant og høyde, bunnforankret, glir inn nedenfra */
      .sh.tp{top:var(--ki-tp-top,50px);bottom:0;left:var(--ki-tp-l,var(--ki-rail-x,0px));right:auto;width:var(--ki-tp-w,100%);max-width:none;height:calc(100% - var(--ki-tp-top,50px));max-height:none;margin:0;
        border-radius:28px 28px 0 0;opacity:1;transform:translate3d(0,100%,0);transition:transform 280ms cubic-bezier(.2,.8,.2,1);--ki-sh-pb:calc(16px + env(safe-area-inset-bottom, 0px))}
      :host(.on) .sh.tp{opacity:1;transform:translate3d(0,var(--ki-tp-dy,0px),0)}
      :host(.tpdrag) .sh.tp{transition:none}
      :host(.tpout) .sh.tp{transition:transform 240ms cubic-bezier(.4,0,.7,.2)}
      .sh.tp>.gz{cursor:grab;touch-action:none}
      /* Fiks 21.7: arkets innhold er en ett-kolonners grid som starter øverst – ingen rad kan krympe (flex-shrink),
         alt vokser, og bare arket (.sh) scroller. Egne ark-CSS kan overstyre .body (ikonvelger, header …). */
      .sh>*{flex-shrink:0}
      .body{display:grid;grid-template-columns:minmax(0,1fr);align-content:start}
      .body>*{min-width:0;flex-shrink:0}
      :host(.on) .bg{opacity:1} :host(.on) .sh{opacity:1;transform:${center ? 'translate3d(0,-50%,0) scale(1)' : 'translate3d(0,0,0)'}}
      .gz{position:sticky;top:calc(-1 * var(--ki-sh-pt));z-index:6;box-sizing:border-box;height:var(--ki-grab-h);margin:calc(-1 * var(--ki-sh-pt)) calc(-1 * var(--ki-sh-px)) 0;padding:10px 0;background:var(--ki-sheet-bg);-webkit-backdrop-filter:var(--ki-sheet-blur);backdrop-filter:var(--ki-sheet-blur)}
      .grab{width:40px;height:5px;border-radius:3px;background:var(--ki-sheet-grab);margin:0 auto}
</style><style data-gl${gl ? '' : ' media="not all"'}>:host{${MSH.GLASS_VARS}${MSH.sheetVars(true)}}
      .bg{${MSH.scrimStyle(true)}}
      .sh{${MSH.sheetStyle(true)}${center ? 'border-radius:32px;' : ''}}
      .sh.tp{border-radius:28px 28px 0 0}
      ${MSH.glassFallback('.sh', 'sheet')}</style><style>${css}</style><div class="bg"></div><div class="sh${footer ? ' ft' : ''}${tp ? ' tp' : ''}" part="sheet">${sheet && !center ? '<div class="gz"><div class="grab"></div></div>' : ''}<div class="body">${html}</div></div>`;
    const stop = (e) => e.stopPropagation();
    ['pointerdown', 'touchstart', 'touchmove', 'wheel'].forEach((t) => sr.querySelector('.sh').addEventListener(t, stop, { passive: true }));
    // Bubble Card lukker popupen ved klikk utenfor (lytter på window) – overlegget er ikke «utenfor».
    ['click', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend'].forEach((t) => host.addEventListener(t, stop, { passive: true }));
    const close = () => {
      if (api.closed) return;
      api.closed = true;
      if (tp) host.classList.add('tpout');
      host.classList.remove('on');
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('hashchange', onHash);
      if (glass == null) window.removeEventListener('ki-glass-change', onGlass);
      setTimeout(() => host.remove(), 250);
      off();
      MSH.sheetCount(-1);
      onClose && onClose();
      api.onClosed && api.onClosed();
    };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    const hash0 = location.hash;
    const onHash = () => { if (location.hash !== hash0) close(); };
    // guard (ms): bakteppet tar ikke imot trykk rett etter åpning, så trykket som åpnet (touch → click) ikke lukker igjen.
    const bgEl = sr.querySelector('.bg'), t0 = Date.now();
    if (guard > 0) { bgEl.style.pointerEvents = 'none'; setTimeout(() => { bgEl.style.pointerEvents = ''; }, guard); }
    bgEl.addEventListener('click', () => { if (guard > 0 && Date.now() - t0 < guard) return; if (bgHaptic) MSH.haptic('light'); close(); });
    window.addEventListener('keydown', onKey);
    window.addEventListener('hashchange', onHash);
    // Liquid Glass-temaet (eller navbar-stilen) byttes mens arket er åpent → glass av/på live, uten reload
    const onGlass = () => {
      const g = MSH.glassOn();
      host.classList.toggle('glass', g); host.toggleAttribute('data-glass', g);
      const st = sr.querySelector('style[data-gl]'); if (g) st.removeAttribute('media'); else st.setAttribute('media', 'not all');
      sr.querySelectorAll('.body *').forEach((el) => { if (el._glassSync) el._glassSync(); });
    };
    if (glass == null) window.addEventListener('ki-glass-change', onGlass);
    MSH.overlayRoot().appendChild(host);
    // følg dashbordflaten (vindu endres, HA-sidebaren åpnes/lukkes)
    const place = () => { const D = MSH.dashRect(), x = railX(); host.style.left = D.left + 'px'; host.style.width = D.width + 'px'; host.style.setProperty('--ki-rail-x', x + 'px'); if (tp) tpPlace(D, x); };
    // 28.11: Tilpass-arkets bredde/venstrekant = popupens (åpen Bubble-popup) på PC, ellers 540 px sentrert; mobil = full bredde
    function tpPlace(D, x) {
      const cw = Math.max(0, D.width - x);
      let l = x, w = cw;
      if (window.innerWidth >= 768) {
        const pop = openPopupEl(), pr = pop && pop.getBoundingClientRect();
        if (pr && pr.width > 0 && pr.width <= D.width + 1) { l = Math.max(0, pr.left - D.left); w = Math.min(pr.width, D.width - l); } else { w = Math.min(MSH.TILPASS_W || 540, cw); l = x + (cw - w) / 2; }
      }
      host.style.setProperty('--ki-tp-top', (MSH.TILPASS_TOP != null ? MSH.TILPASS_TOP : 50) + 'px');
      host.style.setProperty('--ki-tp-l', Math.round(l) + 'px');
      host.style.setProperty('--ki-tp-w', Math.round(w) + 'px');
      host.dataset.tpSheet = '1'; // data-tp-sheet (ikke data-tilpass – det er navbarens «Tilpass»-menyark, 24.5)
    }
    if (tp) place();
    window.addEventListener('resize', place);
    const ro = window.ResizeObserver ? new ResizeObserver(place) : null;
    if (ro) { const ha = document.querySelector('home-assistant'); const main = ha && MSH.deep(ha.shadowRoot, 'ha-drawer'); ro.observe(main || document.body); }
    const off = () => { window.removeEventListener('resize', place); ro && ro.disconnect(); };
    // 28.11: dra ned på håndtaket lukker arket (fjær tilbake ved kort drag). Pointer capture på håndtaket.
    if (tp) {
      const gz = sr.querySelector('.sh.tp>.gz');
      let g = null;
      if (gz) {
        gz.addEventListener('pointerdown', (e) => { if (e.button) return; g = { id: e.pointerId, y0: e.clientY, t0: e.timeStamp, dy: 0 }; try { gz.setPointerCapture(e.pointerId); } catch (x) { /* */ } host.classList.add('tpdrag'); e.stopPropagation(); });
        gz.addEventListener('pointermove', (e) => { if (!g || e.pointerId !== g.id) return; g.dy = Math.max(0, e.clientY - g.y0); host.style.setProperty('--ki-tp-dy', g.dy + 'px'); e.stopPropagation(); if (e.cancelable) e.preventDefault(); });
        const up = (e) => {
          if (!g || e.pointerId !== g.id) return;
          const v = g.dy / Math.max(1, e.timeStamp - g.t0), shut = g.dy > 90 || (g.dy > 24 && v > 0.6);
          g = null; host.classList.remove('tpdrag');
          if (shut) { MSH.haptic('light'); close(); } else host.style.setProperty('--ki-tp-dy', '0px');
        };
        gz.addEventListener('pointerup', up); gz.addEventListener('pointercancel', up);
        ['touchstart', 'touchmove'].forEach((t) => gz.addEventListener(t, (e) => e.stopPropagation(), { passive: true }));
      }
    }
    requestAnimationFrame(() => host.classList.add('on'));
    MSH.sheetCount(1);
    const api = { host, root: sr, body: sr.querySelector('.body'), close };
    return api;
  };

  // 28.9 · Felles toast-pille – ÉN hjelper for alle kort og ark (aldri ha-toast/hass-notification, aldri rå <div>).
  //   MSH.toast(text, { icon, type, enabled, duration })
  //   type: 'ok' (mdi:check) · 'busy' (spinner, «Lagrer …») · 'error' (mdi:alert-circle i var(--red), samme lyse pille);
  //         utelatt → utledes av teksten (Lagret/Lastet inn → ok, Lagrer … → busy, Feil/Kunne ikke/Fikk ikke → error).
  //   icon: eget ikon (alle prefiks, M.icon) eller false (ingen). enabled: false → ingen toast (toasts: false i config;
  //         kallerens haptic beholdes). duration: ms (standard 1,8 s, feil 3 s, «Lagrer …» står til den erstattes, maks 20 s).
  //   Pille 40 px, padding 0 16 (med ikon 0 16 0 12), r20, #e1e1e1 / #232323 13/500, skygge 0 10 30 rgba(0,0,0,.4), gap 6.
  //   Plassering (31.6 – øverst, som før 28.9): top calc(16px + safe-area-inset-top), sentrert i dashbordflaten (ikke i
  //   vinduet, ikke over HA-sidebaren). Mens et ark eller en Bubble-popup er åpen: 12 px under arkets/popupens toppkant
  //   (under håndtaket), over innholdet. Ville pillen da dekke tittelteksten eller knappene i arkets tittelrad (Avbryt/
  //   Ferdig/status), flyttes den rett under tittelraden (+8 px) – aldri oppå tittel eller Ferdig.
  //   I ki-overlay-root (portalet ut av popupen), z 60 over ark (42/43) og navbar, pointer-events: none.
  //   Inn (ovenfra): opacity 0→1 + translateY(-8px)→0 + scale(.96)→1 på 180 ms cubic-bezier(.2,.8,.2,1); ut tilsvarende 160 ms.
  //   Ny toast erstatter den som vises (samme element, ikke stablet), og timeren starter på nytt.
  MSH.TOAST = { ms: 1800, errMs: 3000, busyMs: 20000, ease: 'cubic-bezier(.2,.8,.2,1)', top: 16, sheetTop: 12, dy: -8 };
  const toastType = (text) => (/^\s*lagrer\b/i.test(text) ? 'busy' : /^\s*(lagret|lastet inn)\b/i.test(text) ? 'ok' : /^\s*(feil|kunne ikke|fikk ikke)\b/i.test(text) ? 'error' : '');
  // Hindringer i arkets tittelrad (tekstens faktiske bredde via Range, knapper/status) – dyp søk i arkets shadow-trær
  const toastObstacles = (root) => {
    const out = [];
    const walk = (r, d) => {
      if (!r || d > 4 || !r.querySelectorAll) return;
      r.querySelectorAll('.ttl, [data-sheet-head]').forEach((row) => {
        const rr = row.getBoundingClientRect();
        if (!rr.height) return;
        const parts = [];
        row.querySelectorAll('.tt, h1, h2, .title').forEach((tt) => { try { const rg = document.createRange(); rg.selectNodeContents(tt); const b = rg.getBoundingClientRect(); if (b.width) parts.push(b); } catch (e) { /* */ } });
        row.querySelectorAll('button, .stat.on, [data-a="save"], .done').forEach((x) => { const b = x.getBoundingClientRect(); if (b.width && b.height && getComputedStyle(x).visibility !== 'hidden') parts.push(b); });
        out.push({ row: rr, parts });
      });
      r.querySelectorAll('*').forEach((e) => { if (e.shadowRoot) walk(e.shadowRoot, d + 1); });
    };
    walk(root, 0);
    return out;
  };
  // Hva toasten skal festes til: øverste åpne ark (ki-overlay-root) → åpen Bubble-popup → dashbordflaten.
  // → { cx, top (px fra vinduets topp) | null, kind: 'sheet' | 'popup' | 'dash', w }
  MSH.toastAnchor = function (w) {
    const P = MSH.portals().filter((h) => h.isConnected && h.classList.contains('on') && h.shadowRoot);
    for (let k = P.length - 1; k >= 0; k--) {
      const sr = P[k].shadowRoot, sh = sr.querySelector('.sh');
      if (!sh) continue;
      const r = sh.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const cx = r.left + r.width / 2, tw = Math.max(0, w || 0), H = 40;
      let top = Math.max(0, r.top) + MSH.TOAST.sheetTop;
      const box = { l: cx - tw / 2, r: cx + tw / 2, t: top, b: top + H };
      const hit = (b) => b.left < box.r && b.right > box.l && b.top < box.b && b.bottom > box.t;
      toastObstacles(sr).forEach((o) => { if (o.parts.some(hit)) top = Math.max(top, o.row.bottom + 8); });
      return { cx, top, kind: 'sheet', w: r.width };
    }
    let pop = null; try { pop = openPopupEl(); } catch (e) { pop = null; }
    if (pop) {
      const c = pop.querySelector && (pop.querySelector('.bubble-pop-up-container') || pop);
      const r = (c || pop).getBoundingClientRect(), r0 = pop.getBoundingClientRect();
      if (r0.width && r0.height) return { cx: r0.left + r0.width / 2, top: Math.max(0, Math.min(r0.top, r.top)) + MSH.TOAST.sheetTop, kind: 'popup', w: r0.width };
    }
    return null;
  };
  MSH.toast = function (text, opts) {
    const o = opts || {};
    if (o.enabled === false) return null;
    const T = MSH.TOAST, type = o.type || toastType(String(text || ''));
    const root = MSH.overlayRoot();
    let t = root.querySelector('#msh-toast');
    const fresh = !t || t.__out;
    if (!t) {
      t = document.createElement('div');
      t.id = 'msh-toast';
      t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite');
      root.appendChild(t);
    }
    clearTimeout(t.__hide); clearTimeout(t.__rm); t.__out = false;
    // innhold (ikon + tekst) – byttes på stedet
    const ic = o.icon === false ? '' : o.icon ? MSH.icon(o.icon, 18) : type === 'ok' ? MSH.icon('mdi:check', 18) : type === 'error' ? MSH.icon('mdi:alert-circle', 18, 'color:var(--ki-red-text, var(--red,#f28073))') : type === 'busy' ? '<span class="msh-toast-spin" aria-hidden="true"></span>' : '';
    t.innerHTML = `${ic ? `<span class="msh-toast-ic" style="display:inline-flex;flex:none;width:18px;height:18px;align-items:center;justify-content:center;--mdc-icon-size:18px">${ic}</span>` : ''}<span class="msh-toast-tx" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0"></span>`;
    t.querySelector('.msh-toast-tx').textContent = text == null ? '' : String(text);
    t.dataset.type = type || '';
    const sp = t.querySelector('.msh-toast-spin');
    if (sp) {
      Object.assign(sp.style, { display: 'block', width: '14px', height: '14px', borderRadius: '50%', border: '2px solid color-mix(in srgb, var(--ki-pill-fg, #232323) 22%, transparent)', borderTopColor: 'var(--ki-pill-fg, var(--gray000,#232323))', boxSizing: 'border-box' });
      if (sp.animate) sp.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], { duration: 800, iterations: Infinity });
    }
    const R = MSH.dashRect(), rx = MSH.railOn && MSH.railPad ? MSH.railPad() : 0;
    Object.assign(t.style, {
      position: 'fixed', bottom: 'auto', zIndex: '60', pointerEvents: 'none', boxSizing: 'border-box',
      display: 'flex', alignItems: 'center', gap: '6px', height: '40px', padding: ic ? '0 16px 0 12px' : '0 16px', borderRadius: '20px', maxWidth: `${Math.max(120, R.width - rx - 32)}px`,
      whiteSpace: 'nowrap', background: 'var(--ki-pill-bg, var(--gray1000, #e1e1e1))', color: 'var(--ki-pill-fg, var(--gray000, #232323))', font: `500 13px ${MSH.FONT}`, letterSpacing: '0',
      boxShadow: '0 10px 30px rgb(0 0 0/max(var(--ki-ka-min,0),calc(0.4*var(--ki-ka-k,1))))', transformOrigin: '50% 0', willChange: 'transform, opacity',
    });
    // plassering: øverst i dashbordflaten, eller 12 px under toppkanten til åpent ark/popup (bredden måles først)
    const A = MSH.toastAnchor(t.offsetWidth);
    const cx = A ? A.cx : R.left + rx + (R.width - rx) / 2;
    if (A && A.w) t.style.maxWidth = `${Math.max(120, Math.min(A.w, R.width) - 32)}px`;
    t.style.left = cx + 'px';
    t.style.top = A ? `${Math.round(A.top)}px` : `calc(${Math.max(0, Math.round(R.top))}px + ${T.top}px + env(safe-area-inset-top, 0px))`;
    t.dataset.anchor = A ? A.kind : 'dash';
    const IN = `opacity 180ms ${T.ease}, transform 180ms ${T.ease}`;
    if (fresh) {
      t.style.transition = 'none'; t.style.opacity = '0'; t.style.transform = `translateX(-50%) translateY(${T.dy}px) scale(.96)`;
      void t.offsetWidth; // start fra inn-tilstanden
    }
    t.style.transition = IN; t.style.opacity = '1'; t.style.transform = 'translateX(-50%) translateY(0) scale(1)';
    const ms = o.duration != null ? o.duration : type === 'error' ? T.errMs : type === 'busy' ? T.busyMs : T.ms;
    t.__hide = setTimeout(() => MSH.toastHide(t), ms);
    return t;
  };
  MSH.toastHide = function (t) {
    t = t || MSH.overlayRoot().querySelector('#msh-toast');
    if (!t || t.__out) return;
    clearTimeout(t.__hide);
    t.__out = true;
    t.style.transition = `opacity 160ms ${MSH.TOAST.ease}, transform 160ms ${MSH.TOAST.ease}`;
    t.style.opacity = '0'; t.style.transform = `translateX(-50%) translateY(${MSH.TOAST.dy}px) scale(.96)`;
    t.__rm = setTimeout(() => { if (t.__out) t.remove(); }, 180);
  };

  /* ------------------------------------------------------------ karusell-prikker (Fiks 17.12/17.17/17.30) */
  // Felles for ALLE sveip-karuseller (Hjem-romkort/flis-stabler, Rom → Klima/Media, Media-hero, Vær).
  // Prikkene er knapper like store som prikken (10 px, aktiv 12 px, gap 8 px – Hjem v3 «hasDots»); treffflaten
  // (32 px høy) ligger i ::before (inset −11px −4px), så den ikke påvirker avstanden (18.3). Størrelse/farge via --dot-*.
  // Trykk → go(i) (mykt, «auto» ved prefers-reduced-motion), haptic light, stopPropagation (åpner ikke kortet
  // under), trykk på aktiv prikk gjør ingenting, ←/→ når raden har fokus. Aktiv prikk settes rett i DOM-en
  // (MSH.setDots) – ALDRI re-render av kortet mens man sveiper (17.17).
  MSH.reducedMotion = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  MSH.dotsHTML = (n, i, cls = '') => (n > 1
    ? `<div class="dots msh-dots ${cls}" role="group" aria-label="Sider" tabindex="0">${Array.from({ length: n }, (_, k) => `<button type="button" class="msh-dot${k === i ? ' on' : ''}" data-i="${k}" tabindex="-1" aria-label="Side ${k + 1} av ${n}"${k === i ? ' aria-current="true"' : ''}></button>`).join('')}</div>`
    : '');
  MSH.setDots = function (el, i) {
    if (!el) return;
    el.querySelectorAll('.msh-dot').forEach((d, k) => { d.classList.toggle('on', k === i); if (k === i) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current'); });
  };
  // go(i) flytter karusellen (idempotent binding – samme element bindes én gang, go byttes ved hver kall).
  MSH.bindDots = function (el, go) {
    if (!el) return;
    el.__mshGo = go;
    if (el.__mshDots) return;
    el.__mshDots = true;
    const cur = () => { const a = [...el.querySelectorAll('.msh-dot')]; return { n: a.length, i: Math.max(0, a.findIndex((d) => d.classList.contains('on'))) }; };
    const to = (i) => { const c = cur(); i = MSH.clamp(i, 0, c.n - 1); if (i === c.i) return; MSH.haptic('light'); MSH.setDots(el, i); el.__mshGo(i); };
    const stop = (e) => e.stopPropagation();
    el.addEventListener('pointerdown', stop);
    el.addEventListener('touchstart', stop, { passive: true });
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const d = e.target.closest && e.target.closest('.msh-dot');
      if (d) to(Number(d.dataset.i));
    });
    el.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault(); e.stopPropagation();
      to(cur().i + (e.key === 'ArrowRight' ? 1 : -1));
    });
  };
  // Native scroll-snap-karusell (scroller med én slide per clientWidth). o: { dots(): prikkraden, index(): ønsket
  // side ved første bredde/åpning, onIndex(i): ny side (lagre stille, ikke tegn på nytt), haptic, reset: sett
  // tilbake til index() når en popup åpnes (hashchange) }. Aktiv side leses alltid fra faktisk scrollLeft.
  MSH.snapCarousel = function (sc, o = {}) {
    if (!sc) return null;
    // Inline-stil settes ved hvert kall (morph fjerner attributter som ikke står i malen).
    sc.style.overflowAnchor = 'none';
    sc.style.scrollBehavior = 'auto';
    if (sc.__mshCar) { sc.__mshCar.o = o; MSH.bindDots(o.dots && o.dots(), sc.__mshCar.go); return sc.__mshCar; }
    const S = (sc.__mshCar = { o, i: -1, w: 0, raf: 0 });
    const W = () => sc.clientWidth || 0, n = () => sc.children.length;
    const set = (i, quiet) => {
      if (i === S.i) return;
      S.i = i;
      MSH.setDots(S.o.dots && S.o.dots(), i);
      if (!quiet && S.o.haptic) MSH.haptic(S.o.haptic);
      if (S.o.onIndex) S.o.onIndex(i);
    };
    S.jump = (i) => { const w = W(); i = MSH.clamp(i || 0, 0, Math.max(0, n() - 1)); if (w) sc.scrollLeft = i * w; set(i, true); };
    S.go = (i) => { const w = W(); if (!w) return; sc.scrollTo({ left: MSH.clamp(i, 0, n() - 1) * w, behavior: MSH.reducedMotion() ? 'auto' : 'smooth' }); };
    sc.addEventListener('scroll', () => {
      if (S.raf) return;
      S.raf = requestAnimationFrame(() => { S.raf = 0; const w = W(); if (w) set(MSH.clamp(Math.round(sc.scrollLeft / w), 0, n() - 1)); });
    }, { passive: true });
    // Første bredde > 0 (popupen vist / animert inn) → start-siden; ny bredde (rotasjon, Fold) → hold samme side.
    if (window.ResizeObserver) new ResizeObserver(() => { const w = W(); if (!w) { S.w = 0; return; } if (w === S.w) return; const first = !S.w; S.w = w; S.jump(first && S.o.index ? S.o.index() : S.i); }).observe(sc);
    if (o.reset) {
      const onHash = () => {
        if (!sc.isConnected) return window.removeEventListener('hashchange', onHash);
        const back = () => S.jump(S.o.index ? S.o.index() : 0);
        back(); requestAnimationFrame(back); setTimeout(back, 400); // også etter Bubble Cards inn-animasjon
      };
      window.addEventListener('hashchange', onHash);
    }
    MSH.bindDots(o.dots && o.dots(), S.go);
    S.jump(o.index ? o.index() : 0);
    return S;
  };

  /* ------------------------------------------------------------ HA-conditions (Fiks 20.4) */
  // MSH.condParse(tekst|objekt) → { value, error }: YAML (MSH.yaml / HAs window.jsyaml) eller ferdig objekt. Tom = ingen betingelse.
  // MSH.condEval(hass, cond, o) → true/false (null = ugyldig/ukjent → regelen hoppes over). Støtter HA-typene state (attribute,
  // liste av tilstander, for), numeric_state (above/below, attribute, entitet som grense), time (after/before/weekday),
  // sun (after/before sunrise|sunset + offset), zone, template (render_template-abonnement, ikke polling) og and/or/not.
  // o: { dep(id) – registrer entiteten som avhengighet, onChange() – malresultatet er endret (tegn på nytt) }.
  MSH.condParse = function (src) {
    if (src == null || src === '') return { value: null };
    if (typeof src === 'object') return { value: src };
    const t = String(src);
    if (!t.trim()) return { value: null };
    try {
      const Y = MSH.yaml || window.jsyaml;
      if (!Y) return { error: 'YAML-parser mangler' };
      const v = Y.parse ? Y.parse(t) : Y.load(t);
      if (v == null || (typeof v !== 'object' && !(typeof v === 'string' && /\{\{/.test(v)))) return { error: 'Forventet en HA-condition (condition: state …)' };
      return { value: v };
    } catch (e) { return { error: (e && e.message ? e.message : String(e)) + (e && e.line ? ` (linje ${e.line})` : '') }; }
  };
  const TPL = (MSH.__condTpl = MSH.__condTpl || new Map());
  const tplTrue = (r) => (typeof r === 'boolean' ? r : typeof r === 'number' ? r !== 0 : /^(true|yes|on|enable|1)$/i.test(String(r == null ? '' : r).trim()) || (MSH.isNum(r) && Number(r) !== 0));
  // Én abonnent per mal (delt mellom kortene); ubrukt i 5 min → avsluttes.
  MSH.condTemplate = function (hass, template, onChange) {
    const conn = hass && hass.connection;
    if (!conn || !conn.subscribeMessage) return null;
    let e = TPL.get(template);
    if (e && e.conn !== conn) { try { e.unsub && e.unsub.then((u) => u && u()); } catch (x) { /* */ } TPL.delete(template); e = null; }
    if (!e) {
      e = { conn, val: undefined, err: null, cbs: new Set(), used: Date.now() };
      TPL.set(template, e);
      e.unsub = conn.subscribeMessage((m) => {
        const nv = m && 'result' in m ? tplTrue(m.result) : e.val, ne = m && m.error ? String(m.error) : null;
        if (nv === e.val && ne === e.err) return;
        e.val = nv; e.err = ne;
        e.cbs.forEach((f) => { try { f(); } catch (x) { /* */ } });
      }, { type: 'render_template', template, report_errors: true }).catch((x) => { e.err = (x && x.message) || 'Malfeil'; e.val = false; e.cbs.forEach((f) => { try { f(); } catch (y) { /* */ } }); return null; });
      if (!MSH.__condSweep) MSH.__condSweep = setInterval(() => {
        const now = Date.now();
        TPL.forEach((x, k) => { if (now - x.used > 300000) { try { x.unsub && x.unsub.then((u) => u && u()); } catch (y) { /* */ } TPL.delete(k); } });
      }, 60000);
    }
    e.used = Date.now();
    if (onChange) e.cbs.add(onChange);
    return e;
  };
  const durMs = (d) => {
    if (d == null) return 0;
    if (typeof d === 'number') return d * 1000;
    if (typeof d === 'object') return (((d.days || 0) * 24 + (d.hours || 0)) * 60 + (d.minutes || 0)) * 60000 + (d.seconds || 0) * 1000 + (d.milliseconds || 0);
    const s = String(d).trim(), neg = s[0] === '-', p = s.replace(/^[-+]/, '').split(':').map(Number);
    const ms = p.length === 1 ? p[0] * 1000 : ((p[0] || 0) * 3600 + (p[1] || 0) * 60 + (p[2] || 0)) * 1000;
    return neg ? -ms : ms;
  };
  const WD = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  MSH.condEval = function (hass, cond, o = {}) {
    if (!hass || !hass.states) return null;
    const dep = o.dep || (() => {});
    const st = (id) => { if (!id) return null; dep(id); return hass.states[id] || null; };
    const ids = (x) => (Array.isArray(x) ? x : x == null ? [] : String(x).split(',').map((s) => s.trim())).filter(Boolean);
    const ev = (c) => {
      if (c == null) return null;
      if (Array.isArray(c)) { const r = c.map(ev); return r.includes(null) ? null : r.every(Boolean); } // liste = and
      if (typeof c === 'string') return /\{\{|\{%/.test(c) ? ev({ condition: 'template', value_template: c }) : null;
      if (typeof c !== 'object') return null;
      if (c.enabled === false) return true;
      const type = c.condition || (c.and ? 'and' : c.or ? 'or' : c.not ? 'not' : null);
      const sub = () => { const L = c.conditions || c[type]; return Array.isArray(L) ? L : L ? [L] : []; };
      switch (type) {
        case 'and': { const r = sub().map(ev); return r.includes(null) ? null : r.every(Boolean); }
        case 'or': { const r = sub().map(ev); return r.some((x) => x === true) ? true : r.includes(null) ? null : false; }
        case 'not': { const r = sub().map(ev); return r.includes(null) ? null : !r.some(Boolean); }
        case 'state': {
          const E = ids(c.entity_id);
          if (!E.length || c.state === undefined) return null;
          const want = (Array.isArray(c.state) ? c.state : [c.state]).map((x) => (typeof x === 'boolean' ? (x ? 'on' : 'off') : String(x)));
          const forMs = durMs(c.for);
          const one = (id) => {
            const s = st(id);
            if (!s) return false;
            const v = c.attribute ? s.attributes[c.attribute] : s.state;
            const hit = want.some((w) => String(v) === w || (typeof v === 'boolean' && w === (v ? 'on' : 'off')));
            return hit && (!forMs || Date.now() - Date.parse(s.last_changed) >= forMs);
          };
          return c.match === 'any' ? E.some(one) : E.every(one);
        }
        case 'numeric_state': {
          const E = ids(c.entity_id);
          if (!E.length || (c.above == null && c.below == null)) return null;
          const lim = (x) => { if (x == null) return null; if (MSH.isNum(x)) return Number(x); const s = st(String(x)); return s && MSH.isNum(s.state) ? Number(s.state) : NaN; };
          const a = lim(c.above), b = lim(c.below);
          return E.every((id) => {
            const s = st(id);
            if (!s) return false;
            const raw = c.attribute ? s.attributes[c.attribute] : s.state;
            if (!MSH.isNum(raw)) return false;
            const v = Number(raw);
            return (a == null || v > a) && (b == null || v < b);
          });
        }
        case 'time': {
          const now = new Date();
          const tod = (x) => {
            if (x == null) return null;
            const s = String(x), e = hass.states[s];
            if (e) { dep(s); const a = e.attributes || {}; if (a.hour != null) return a.hour * 3600 + (a.minute || 0) * 60 + (a.second || 0); const d = new Date(e.state); if (!isNaN(d)) return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds(); const m = /^(\d+):(\d+)/.exec(e.state); return m ? m[1] * 3600 + m[2] * 60 : null; }
            const p = s.split(':').map(Number);
            return p.some(isNaN) ? null : (p[0] || 0) * 3600 + (p[1] || 0) * 60 + (p[2] || 0);
          };
          const t = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds(), a = tod(c.after), b = tod(c.before);
          let ok = true;
          if (a != null && b != null) ok = a <= b ? t >= a && t < b : t >= a || t < b;
          else if (a != null) ok = t >= a;
          else if (b != null) ok = t < b;
          if (c.weekday) ok = ok && ids(c.weekday).map((x) => x.toLowerCase().slice(0, 3)).includes(WD[now.getDay()]);
          return ok;
        }
        case 'sun': {
          const s = st('sun.sun');
          if (!s) return null;
          const now = Date.now(), day = 86400000, today = (iso) => { let x = Date.parse(iso); if (isNaN(x)) return null; const d0 = new Date(); d0.setHours(0, 0, 0, 0); while (x >= d0.getTime() + day) x -= day; return x; };
          const ev2 = { sunrise: today(s.attributes.next_rising), sunset: today(s.attributes.next_setting) };
          let ok = true;
          if (c.after) { const x = ev2[c.after]; if (x == null) return null; ok = ok && now > x + durMs(c.after_offset); }
          if (c.before) { const x = ev2[c.before]; if (x == null) return null; ok = ok && now < x + durMs(c.before_offset); }
          return ok;
        }
        case 'zone': {
          const E = ids(c.entity_id), Z = ids(c.zone);
          if (!E.length || !Z.length) return null;
          return E.every((id) => {
            const s = st(id);
            if (!s) return false;
            return Z.some((zid) => {
              const z = st(zid);
              if (!z) return false;
              const a = s.attributes || {}, za = z.attributes || {};
              if (a.latitude != null && za.latitude != null && za.radius != null) {
                const R = 6371000, r = Math.PI / 180, dLa = (za.latitude - a.latitude) * r, dLo = (za.longitude - a.longitude) * r;
                const h = Math.sin(dLa / 2) ** 2 + Math.cos(a.latitude * r) * Math.cos(za.latitude * r) * Math.sin(dLo / 2) ** 2;
                return 2 * R * Math.asin(Math.sqrt(h)) <= za.radius + (a.gps_accuracy || 0);
              }
              return s.state === (zid === 'zone.home' ? 'home' : za.friendly_name || zid.split('.')[1]);
            });
          });
        }
        case 'template': {
          const tp = c.value_template;
          if (!tp) return null;
          const e = MSH.condTemplate(hass, String(tp), o.onChange);
          if (!e) return null;
          if (o.errors && e.err) o.errors.push(e.err);
          return e.val === undefined ? false : e.err ? null : e.val;
        }
        default: return null; // device/trigger o.l. støttes ikke her
      }
    };
    try { return ev(cond); } catch (e) { return null; }
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
    if (!custom) for (let i = aa.length - 1; i >= 0; i--) { const n = aa[i].name; if (!b.hasAttribute(n) && n !== 'data-gd-hide' && n !== 'data-gd-on') a.removeAttribute(n); } // glass-linsen (Fiks 17.19) eier disse
    for (let i = 0; i < ba.length; i++) { const { name, value } = ba[i]; if (a.getAttribute(name) !== value) a.setAttribute(name, value); }
    if (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT') {
      if (a !== (a.getRootNode() && a.getRootNode().activeElement)) {
        if (b.hasAttribute('value') && a.value !== b.getAttribute('value')) a.value = b.getAttribute('value');
        if (a.type === 'checkbox' || a.type === 'radio') a.checked = b.hasAttribute('checked');
      }
    }
  }
  // Noder med __mshKeep (glasslinsen under en trykk-animasjon) er usynlige for morph og blir liggende.
  function patchKeep(a, b) {
    const an = Array.from(a.childNodes).filter((n) => !n.__mshKeep), bn = Array.from(b.childNodes), cur = an.slice();
    for (let i = 0; i < bn.length; i++) {
      const nb = bn[i], na = cur[i];
      if (!na) { const n = document.importNode(nb, true); a.appendChild(n); cur.push(n); continue; }
      if (sameNode(na, nb)) { patchNode(na, nb); continue; }
      const key = nb.nodeType === 1 && nb.getAttribute('data-key');
      let j = -1;
      if (key != null) j = cur.findIndex((c, x) => x > i && c.nodeType === 1 && c.getAttribute('data-key') === key && c.tagName === nb.tagName);
      if (j > i) { const f = cur[j]; a.insertBefore(f, na); cur.splice(j, 1); cur.splice(i, 0, f); patchNode(f, nb); } else { const n = document.importNode(nb, true); a.replaceChild(n, na); cur[i] = n; }
    }
    while (cur.length > bn.length) a.removeChild(cur.pop());
    return an;
  }
  function patchChildren(a, b) {
    if (a.__mshKeepN > 0) return patchKeep(a, b);
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
    if (hass) MSH.store.load(hass);
    try { MSH.syncLivePopups && MSH.syncLivePopups(newCfg, hass); } catch (e) { /* */ }
    // Denne enheten (bare Kamera/Person): lagre bare feltene som avviker fra felles oppsett (YAML + felles ki-store) under devices.<id>
    if ((opts.scope || MSH.store.scope) === 'device' && MSH.isPerDevice(newCfg, opts.card, key)) {
      const card = opts.card, yaml = card && card._yamlConfig;
      const base = yaml ? MSH.effectiveConfig(yaml, card, { shared: true }) : (MSH.store.get(key) || {});
      const rec = {}, same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
      Object.keys(rest).forEach((k) => { if (!same(rest[k], base[k])) rec[k] = rest[k]; });
      Object.keys(base).forEach((k) => { if (!(k in newCfg) && k !== 'type' && k !== 'card_id' && base[k] != null) rec[k] = null; });
      const dk = MSH.store.devKey(key);
      const res = await MSH.store.set(dk, Object.keys(rec).length ? rec : undefined, { immediate: opts.immediate, confirm: opts.confirm, src: opts.src });
      return { ...res, store: true, key: dk, config: newCfg };
    }
    Object.keys(oldCfg || {}).forEach((k) => { if (!(k in newCfg) && k !== 'type' && k !== 'card_id') rest[k] = null; }); // fjernet → null
    const prev = MSH.store.get(key) || {};
    Object.keys(prev).forEach((k) => { if (!(k in newCfg) && !(k in rest) && k !== 'type' && k !== 'card_id') rest[k] = null; }); // fjernet siden forrige lagring
    const res = await MSH.store.set(key, { ...prev, ...rest }, { immediate: opts.immediate, confirm: opts.confirm, src: opts.src });
    return { ...res, store: true, key, config: newCfg };
  };
  // Oppsett per enhet finnes bare for Kamera og Person (static perDevice = true, eller card_id med kamera/person)
  MSH.PER_DEVICE_CARDS = ['msh-kamera-card', 'msh-person-card'];
  MSH.isPerDevice = function (cfg, card, key) {
    const tag = (card && card.localName) || String((cfg && cfg.type) || '').replace('custom:', '');
    const cls = (card && card.constructor) || (tag && customElements.get(tag));
    if ((cls && cls.perDevice) || MSH.PER_DEVICE_CARDS.includes(tag)) return true;
    return !!(key && MSH.store && MSH.store.perDeviceKey && MSH.store.perDeviceKey(key) && !tag);
  };
  // YAML-config + felles ki-store + denne enhetens oppsett (bare Kamera/Person) (null = fjernet). opts.shared = uten enhetslaget (GUI-editoren).
  MSH.effectiveConfig = function (yaml, card, opts) {
    const key = yaml && MSH.store ? MSH.storeKey(yaml, card) : null;
    if (!key) return yaml;
    const st = MSH.store.get(key), dv = (opts && opts.shared) || !MSH.isPerDevice(yaml, card, key) ? null : MSH.store.get(MSH.store.devKey(key));
    if (!st && !dv) return yaml;
    const out = { ...yaml };
    [st, dv].forEach((o) => { if (o && typeof o === 'object') Object.keys(o).forEach((k) => { if (o[k] === null) delete out[k]; else out[k] = o[k]; }); });
    out.type = yaml.type; if (yaml.card_id) out.card_id = yaml.card_id;
    return out;
  };
  MSH.flushSaves = function () { [...PENDING.keys()].forEach((id) => { const p = PENDING.get(id); clearTimeout(p.timer); doSave(id); }); };

  // UI-tilstand (valgt fane, kamera, akkordeoner …) lagres i localStorage ki:<card_id>:ui – aldri i Lovelace.
  MSH.uiLoad = function (cardId) { try { return JSON.parse(localStorage.getItem('ki:' + cardId + ':ui') || 'null') || {}; } catch (e) { return {}; } };
  MSH.uiStore = function (cardId, ui) { try { localStorage.setItem('ki:' + cardId + ':ui', JSON.stringify(ui)); } catch (e) { /* */ } };

  /* ------------------------------------------------------------ grunnstil */
  MSH.BASE_CSS = `
    ${MSH.theme ? MSH.theme.CSS : ''}
    :host{display:block;width:100%;box-sizing:border-box;font-family:${MSH.FONT};color:var(--ki-text, var(--white,#fafafa));-webkit-font-smoothing:antialiased;-webkit-tap-highlight-color:transparent;--ha-ripple-color:transparent;--ha-ripple-pressed-opacity:0;--ha-ripple-hover-opacity:0;--mdc-ripple-color:transparent}
    *,*::before,*::after{box-sizing:border-box}
    ha-card{background:none;box-shadow:none;border:none;border-radius:0;padding:0;overflow:visible;color:inherit;font-family:inherit}
    /* Fiks 19.14: trykk-feedback er bare skalering – ingen grå tap-highlight, ripple eller :active-bakgrunn på kort/fliser */
    ha-card:active,ha-card:focus,ha-card:focus-visible{background:none}
    a,[role=button],[data-act],[data-ent],[tabindex],.press{-webkit-tap-highlight-color:transparent}
    button,input,select,textarea{font:inherit;color:inherit;border:0;background:none;padding:0;margin:0;cursor:pointer;-webkit-tap-highlight-color:transparent}
    input,textarea{cursor:text;outline:none}
    input::placeholder{color:var(--ki-text-lo, var(--gray500,#696969))}
    .num{font-variant-numeric:tabular-nums}
    .press{transition:transform .15s cubic-bezier(.34,1.5,.64,1)}
    .press:active{transform:scale(.96)}
    .row{display:flex;align-items:center}
    .col{display:flex;flex-direction:column}
    .grow{flex:1;min-width:0}
    .ell{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .card{border-radius:24px;background:var(--ki-surface, var(--gray200,#3a3a3a));box-shadow:inset 0 0 0 1px rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.05*var(--ki-wa-k,1)),var(--ki-wa-max,1)))}
    .muted{color:var(--ki-text-mid, var(--gray700,#979797))}
    .dim{color:var(--ki-text-3, var(--gray600,#7f7f7f))}
    .noscroll::-webkit-scrollbar{display:none} .noscroll{scrollbar-width:none}
    .empty{display:flex;flex-direction:column;align-items:center;gap:10px;padding:22px 16px;border-radius:24px;background:var(--ki-surface, var(--gray200,#3a3a3a));color:var(--ki-text-mid, var(--gray700,#979797));font-size:13px;text-align:center}
    .pick{height:36px;padding:0 14px;border-radius:18px;background:var(--ki-surface-2, var(--gray300,#404040));color:var(--ki-text, var(--white,#fafafa));font-size:13px;font-weight:500;display:inline-flex;align-items:center;gap:6px}
    .dots.msh-dots{display:flex;gap:8px;height:14px;align-items:center;justify-content:center;outline:none;border-radius:16px}
    .msh-dots:focus-visible{box-shadow:0 0 0 2px var(--ki-text-3, var(--gray600,#7f7f7f))}
    .msh-dot{flex:none;position:relative;width:var(--dot-w,10px);height:var(--dot-h,var(--dot-w,10px));border-radius:var(--dot-r,6px);background:var(--dot-bg,var(--ki-text-3, var(--gray400,#545454)));cursor:pointer;-webkit-tap-highlight-color:transparent;transition:background .2s,width .2s,height .2s}
    .msh-dot.on{width:var(--dot-on-w,12px);height:var(--dot-on-h,var(--dot-on-w,12px));background:var(--dot-on-bg,var(--ki-text, var(--gray600,#7f7f7f)))}
    .msh-dot::before{content:'';position:absolute;inset:-11px -4px} /* 18.3: treffflate utenfor layouten, naboene møtes i gap-midten */
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
      else {
        this._yamlConfig = config;
        // Et tilpass-ark med utkast er åpent for dette kortet: vis fortsatt utkastet (ny config overskriver det ikke –
        // arket får vite om endringen og viser «Endret et annet sted – Last inn»). Fiks 15.13.
        const dc = this._rawConfig && MSH.draftOf(this);
        if (dc) { if (dc.previewing) { config = { ...dc.draft }; } else { try { config = MSH.effectiveConfig(config, this); } catch (e) { console.error(this.localName, e); } } dc.check(); }
        else { try { config = MSH.effectiveConfig(config, this); } catch (e) { console.error(this.localName, e); } }
      }
      this._rawConfig = config;
      this._config = { ...this.constructor.defaults, ...config };
      // ikke full re-render ved config-endring – morph bevarer scroll, fokus og innebygde elementer
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
      if (MSH.theme) MSH.theme.update(h); // Fiks 34: lys/mørk fra hass.themes.darkMode
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
          if (path && String(path).startsWith('devices.')) path = String(path).split('.').slice(2).join('.'); // enhetslaget
          if (!key || (path && path !== key && !String(path).startsWith(key + '.') && !key.startsWith(path + '.'))) return;
          if (MSH.draftFor(key)) return; // utkast åpent: arket bestemmer (egen lagring ignoreres, annen kilde → banner)
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
      // Bubble Card tar innholdet ut av DOM-en når popupen lukkes – neste åpning skal gi onOpen igjen
      if (this._open && MSH.startTab) MSH.startTab.closed(this); // Fiks 36.5: husk fanen («Sist brukte»)
      this._open = false;
      this._safeCall('onClose');
    }
    // onOpen/onClose vernet: en feil her skal ikke stoppe åpningen (fiks 15.1)
    _safeCall(fn) { try { if (this[fn]) this[fn](); } catch (e) { console.error(this.localName, e); } }
    _checkOpen() {
      if (!this._hass || !this.isConnected) return;
      const open = MSH.isPopupOpen(this);
      if (open && MSH.theme && !(this._themePop && this._themePop.isConnected)) this._themePop = MSH.theme.adopt(this); // Fiks 34: popup-roten får data-ki-theme
      if (open && !this._open) { this._open = true; if (MSH.startTab) MSH.startTab.apply(this); /* Fiks 36.5: startfanen */ this._safeCall('onOpen'); if (!this._config.embedded) { requestAnimationFrame(() => this._applySpacing()); setTimeout(() => this._applySpacing(), 400); } }
      else if (!open && this._open) { if (MSH.startTab) MSH.startTab.closed(this); this._open = false; this._safeCall('onClose'); }
    }
    get isOpen() { return !!this._open; }
    _schedule(force) {
      if (force) this._force = true;
      if (this._raf) return;
      this._raf = requestAnimationFrame(() => { this._raf = 0; this._render(); });
    }
    update() { this._schedule(true); }
    static get uiPersist() { return []; }
    // quiet: bare lagre tilstanden (f.eks. aktiv karusell-side, 17.17) – ingen ny tegning.
    setUI(p, quiet) {
      this._ui = { ...this._ui, ...p };
      const keys = this.constructor.uiPersist || [], id = this._rawConfig && this._rawConfig.card_id;
      if (id && keys.some((k) => k in p)) { const o = {}; keys.forEach((k) => { if (this._ui[k] !== undefined) o[k] = this._ui[k]; }); MSH.uiStore(id, o); }
      if (MSH.startTab) MSH.startTab.onUI(this, p); // Fiks 36.5: fanebytte huskes for «Sist brukte»
      if (!quiet) this._schedule(true);
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
      if (this._busy && !this._force) { this._skipped = true; return; } // drag/sveip pågår – tegnes når den slipper
      // Native velger (09-pickers) har fokus: ikke tegn på nytt før den slippes (_ventTegn-regelen, fiks-4 4.5)
      if (this._pickerFocus || (MSH.pickerBusy && MSH.pickerBusy(this.shadowRoot))) { this._force = true; return; }
      this._force = false;
      this._deps = new Set();
      // Fiks 15.1: ALT i tegningen (render, styles, morph, hero, afterRender) er vernet – en feil gir et synlig
      // feilkort («Klima-kortet feilet: …») i stedet for tom flate, og logges med console.error(<tag>, e).
      let body, css = '';
      try { body = this.render(); } catch (e) { body = this._failHTML(e); }
      try { css = this.styles || ''; } catch (e) { body = this._failHTML(e) + body; }
      const gap = this._config.gap != null ? Number(this._config.gap) : null;
      const heroTag = MSH.HEROES[this.localName];
      const slot = heroTag ? '<div class="msh-hero-slot" data-nomorph></div>' : '';
      const html = `<style>${MSH.BASE_CSS}.msh-hero-slot{display:block;margin-bottom:var(--msh-gap, 8px)}.msh-hero-slot:empty{display:none}.msh-fail{color:var(--ki-red-text, var(--red,#f28073));text-align:left;align-items:flex-start}${css}</style><ha-card>${slot}${body}</ha-card>`;
      try {
        this.shadowRoot.querySelectorAll('ha-card > .msh-fail[data-post]').forEach((x) => x.remove()); // feilkort fra forrige runde
        if (!this._firstRender) { this.shadowRoot.innerHTML = html; this._firstRender = true; if (MSH.bindSteppers) MSH.bindSteppers(this.shadowRoot, this); } else MSH.morph(this.shadowRoot, html);
      } catch (e) { console.error(this.localName, e); this.shadowRoot.innerHTML = html; this._firstRender = true; }
      if (gap != null) this.style.setProperty('--msh-gap', gap + 'px');
      try { if (heroTag) this._mountHero(heroTag); } catch (e) { this._showFail(e); }
      try { if (this.afterRender) this.afterRender(); } catch (e) { this._showFail(e); }
      try {
        if (!this._spacedOnce && !this._config.embedded && MSH.popupContainer(this)) { this._spacedOnce = true; requestAnimationFrame(() => this._applySpacing()); }
        this._guardScrollers();
      } catch (e) { console.error(this.localName, e); }
    }
    // Synlig feilkort: «<Kortnavn>-kortet feilet: <melding>» (aldri tom popup)
    _failHTML(e) {
      console.error(this.localName, e);
      const name = this.constructor.cardName || this.localName;
      return `<div class="empty msh-fail" role="alert">${MSH.icon('mdi:alert-circle-outline', 22)}<span>${MSH.esc(name)}-kortet feilet: ${MSH.esc((e && e.message) || String(e))}</span></div>`;
    }
    // Feil etter at innholdet er tegnet (hero, afterRender): legg feilkortet øverst i kortet (fjernes ved neste morph)
    _showFail(e) {
      const card = this.shadowRoot.querySelector('ha-card');
      if (!card) { this.shadowRoot.innerHTML = `<style>${MSH.BASE_CSS}</style><ha-card>${this._failHTML(e)}</ha-card>`; return; }
      const old = card.querySelector(':scope > .msh-fail[data-post]');
      const t = document.createElement('template');
      t.innerHTML = this._failHTML(e);
      const el = t.content.firstElementChild;
      el.setAttribute('data-post', '');
      if (old) old.replaceWith(el); else card.prepend(el);
    }
    // Toppkort (hero) bygget inn som første seksjon i hovedkortet – ett kort per popup.
    _mountHero(tag) {
      const slot = this.shadowRoot.querySelector('.msh-hero-slot');
      if (!slot) return;
      if (!customElements.get(tag)) {
        // Toppkortet skal aldri forsvinne stille: vis plassholder til elementet er registrert
        if (!slot.firstChild) slot.innerHTML = `<div class="empty">${MSH.icon('mdi:timer-sand', 22)}<span>Toppkortet (${MSH.esc(tag)}) lastes …</span></div>`;
        if (!this._heroWait) { this._heroWait = true; customElements.whenDefined(tag).then(() => { this._heroWait = false; slot.innerHTML = ''; this.update(); }); }
        return;
      }
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
    // pad_bottom = luft i bunnen OVER navbaren (MSH.popupBottomPad), gap = popupens kort-gap.
    // Popupen selv har --vertical-stack-card-gap: 0. Aldri margin-bottom (kollapser i Bubble-scrollcontaineren).
    _applySpacing() {
      if (this._config.embedded) return;
      const cont = MSH.popupContainer(this);
      if (!cont) return;
      const c = this._config, D = this.constructor.spacingDefaults || MSH.SPACING;
      const gap = c.gap != null ? Number(c.gap) : D.gap, top = c.pad_top != null ? Number(c.pad_top) : D.pad_top, bot = c.pad_bottom != null ? Number(c.pad_bottom) : D.pad_bottom;
      const grids = [cont, ...cont.querySelectorAll('.bubble-cards-container')];
      grids.forEach((g) => { g.style.setProperty('--bubble-pop-up-gap', gap + 'px'); g.style.gap = gap + 'px'; g.style.rowGap = gap + 'px'; });
      const cards = [...cont.querySelectorAll('*')].filter((e) => /^msh-.*-card$/.test(e.localName));
      if (!cards.length || (cards[0] !== this && cards[cards.length - 1] !== this)) return;
      const first = cards[0], last = cards[cards.length - 1];
      if (last === this) { this.style.paddingBottom = MSH.popupBottomPad(bot); this.style.marginBottom = ''; }
      if (first === this) {
        this.style.marginTop = '';
        // Headeren i DENNE popupen (ikke første popup i samme rot – da havner kortet utenfor synsfeltet)
        const pop = cont.closest ? cont.closest('.bubble-pop-up') : null, root = cont.getRootNode && cont.getRootNode();
        const hdr = (pop && pop.querySelector('.bubble-header-container')) || (root && root.querySelector && root.querySelector('.bubble-header-container'));
        const fr = this.getBoundingClientRect(), hr = hdr && hdr.getBoundingClientRect();
        // 26.18: popupens felles header-mellomrom (--ki-popup-header-gap, MSH.applyHeaderGap i 02-popups.js) legges til pad_top én gang
        const hg = parseFloat(getComputedStyle(cont).getPropertyValue('--ki-popup-header-gap')) || 0;
        const mt = hr && hr.height ? top + hg - (fr.top - hr.bottom) : null;
        if (fr.height && mt != null && Math.abs(mt) < 240) this.style.marginTop = mt + 'px';
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
    // own = bare elementer i kortets egen shadow root (ikke inni innebygde kort, som har egne lyttere)
    _el(e, sel, own) {
      const path = e.composedPath ? e.composedPath() : [];
      for (const n of path) { if (n === this.shadowRoot) break; if (n.matches && n.matches(sel) && (!own || n.getRootNode() === this.shadowRoot)) return n; }
      return null;
    }
    _onClick(e) {
      if (this._swallow) { this._swallow = false; e.stopPropagation(); e.preventDefault(); return; }
      const el = this._el(e, '[data-act]');
      if (!el || el.disabled) return;
      // Tannhjul i et innebygd toppkort: klikket bobler også til vertskortet, som ville åpnet det samme arket én gang
      // til (to «Tilpass rom»-ark oppå hverandre → Ferdig viste det gamle under). Fiks 15.13.
      if (el.dataset.act === 'customize') { if (e.__mshCustomize) return; e.__mshCustomize = true; }
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
      // Hold → more-info: bare egne elementer. Innebygde kort (header/prosa i Hjem) håndterer sitt eget hold,
      // og interne plassholdere (data-ent="__tilpass") skal aldri nå HA (fiks 15.4).
      const el = this._el(e, '[data-ent]', true);
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
      }, this.holdMs || 520); // kort kan sette egen holdetid (Innstillinger: 500 ms, fiks 29.2)
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
  // Standard mellomrom for funksjons-popups (Rom har egne: pad_top −10, pad_bottom 150)
  MSH.SPACING = { gap: 8, pad_top: 20, pad_bottom: 24 };
  // Luft i bunnen av alle popups: navbarens faktiske høyde + avstand fra bunnen + safe area + ekstra luft.
  // --ki-nav-h / --ki-nav-bottom settes av msh-navbar-card (0 når navbaren er skjult eller vises som rail).
  MSH.popupBottomPad = (extra) => `calc(var(--ki-nav-h, 68px) + var(--ki-nav-bottom, 8px) + var(--ki-mini-h, 0px) + env(safe-area-inset-bottom, 0px) + ${extra != null ? Number(extra) + 'px' : 'var(--ki-pop-extra, 24px)'})`;
  // Felles «Mellomrom»-seksjon for funksjons-popupenes editor (samme UI som i Rom)
  MSH.spacingSchema = (D) => {
    D = { ...MSH.SPACING, ...(D || {}) };
    return { type: 'section', id: 'spacing', label: 'Mellomrom', icon: 'mdi:arrow-expand-vertical', meta: (hh, cc) => `${cc.pad_bottom != null ? cc.pad_bottom : D.pad_bottom} px i bunnen`, fields: [
      { type: 'range', name: 'gap', label: 'Mellom seksjonene', icon: 'mdi:arrow-split-horizontal', min: 0, max: 24, default: D.gap, presets: [[4, 'Tett 4'], [8, 'Standard 8'], [18, 'Luftig 18']] },
      { type: 'range', name: 'pad_top', label: 'Fra popup-headeren til første kort', icon: 'mdi:format-vertical-align-top', min: -20, max: 60, default: D.pad_top, presets: [[-20, 'Inntil −20'], [6, 'Tett 6'], [20, 'Standard 20'], [44, 'Luftig 44']] },
      { type: 'range', name: 'pad_bottom', label: 'Luft i bunnen (over navbaren)', icon: 'mdi:format-vertical-align-bottom', min: 0, max: 300, default: D.pad_bottom, presets: [[0, 'Ingen 0'], [24, 'Standard 24'], [60, 'Litt 60'], [150, 'Stor 150']] },
    ] };
  };

  // Hovedkort → innebygd toppkort. Ett kort per Bubble-popup; toppkortet er første seksjon.
  MSH.HEROES = {
    'msh-rom-card': 'msh-rom-klima-card',
    'msh-basseng-card': 'msh-basseng-hero-card',
    'msh-klima-card': 'msh-klima-hero-card',
    'msh-media-card': 'msh-media-hero-card',
    'msh-sikkerhet-card': 'msh-sikkerhet-hero-card',
    'msh-vaer-card': 'msh-vaer-hero-card',
    'msh-person-card': 'msh-person-hero-card',
  };

  /* ------------------------------------------------------------ utkast-editor (fiks 15.13) */
  // Én felles flyt for ALLE «Tilpass …»-ark (msh-editor via MSH.openEditor – Rom, navbar, header, Kamera og alle kort –
  // og egne ark: Lys, Klima, Vær …). «Tilpass Hjem» skriver mange nøkler og bruker MSH.store.transaction (samme regler).
  //   Åpne:   draft = structuredClone(config). Kortet viser utkastet live (setConfig({...draft, __eff: 1})).
  //   Endre:  bare draft + forhåndsvisning. INGEN autolagring.
  //   Ferdig: ctl.done() → await save(draft) ÉN gang (MSH.saveCardConfig, confirm: ki-store cacher/varsler først når HA
  //           har svart) → lukk, toast «Lagret», haptic success. Feil → arket står med utkastet, feilmelding + failure.
  //           Mens lagringen pågår er Ferdig deaktivert (onBusy) og nye trykk ignoreres. Uendret utkast → bare lukk.
  //   Avbryt: ctl.cancel() → utkastet forkastes, kortet settes tilbake til lagret config. Lukking via bakteppe/Esc = Avbryt.
  //   Innkommende config (ki-store fra annen enhet/GUI-editoren, eller setConfig fra HA) overskriver ALDRI utkastet:
  //           egen lagring kjennes igjen (src-merke) og ignoreres; endring fra en annen kilde → banner «Endret et annet
  //           sted – Last inn» (ctl.reload()). Er utkastet uendret, tas endringen inn stille.
  //   Mens arket er åpent følger kortet utkastet: MshCard-abonnementet på ki-store og setConfig fra HA hopper over
  //   nøkkelen (MSH.drafts), så lagring → ekko → setConfig ikke kan nullstille visningen.
  // MSH.draftEditor(card, { key, config, saved, current, prepare, save, saveOpts, live, banner, close, alive, onBusy,
  //   onError, onReload, toast }) → ctl { draft, saved, busy, dirty, external, closed, set(next), preview(), done(), cancel(),
  //   reload(), dispose() }. Ett ark per nøkkel: MSH.draftFor(key|kort) gir et åpent ark (openEditor gjenbruker det).
  MSH.drafts = MSH.drafts || new Map();
  // Et ark som er fjernet fra DOM uten å lukkes (alive() = false) regnes som Avbryt, så kortet ikke blir låst
  MSH.draftFor = (k) => { const c = k != null && MSH.drafts.get(k); if (c && !c.closed && c.alive && !c.alive()) c.dispose(); return c && !c.closed ? c : null; };
  MSH.draftOf = function (card) {
    if (!MSH.drafts.size || !card) return null;
    for (const [k, c] of MSH.drafts) if (c.card === card && MSH.draftFor(k)) return c;
    let k = null; try { k = card._yamlConfig && MSH.store ? MSH.storeKey(card._yamlConfig, card) : null; } catch (e) { /* */ }
    return (k && MSH.draftFor(k)) || null;
  };
  const dclone = (v) => { if (v == null) return v; try { return structuredClone(v); } catch (e) { return JSON.parse(JSON.stringify(v)); } };
  // Ferdig-knappen i et ark: deaktivert + spinner mens lagringen pågår (editorer uten egen _setBusy)
  MSH.draftBusy = function (ed, busy) {
    if (!ed) return;
    if (ed._setBusy) return ed._setBusy(busy);
    const r = ed.shadowRoot || ed;
    r.querySelectorAll && r.querySelectorAll('[data-a="save"],[data-a="done"]').forEach((b) => { b.disabled = !!busy; b.toggleAttribute('aria-busy', !!busy); b.style.opacity = busy ? '0.6' : ''; });
  };
  const BANNER_CSS = 'display:flex;align-items:center;gap:10px;margin:0 0 12px;padding:8px 8px 8px 16px;border-radius:22px;background:rgb(242 181 115 / calc(0.16 * var(--ki-tone-k, 1)));color:var(--ki-orange-text, var(--orange,#f2b573));font-size:13px;font-weight:500;line-height:1.3;';
  const BANNER_BTN = 'flex:none;height:32px;padding:0 14px;border-radius:16px;border:0;background:var(--orange,#f2b573);color:var(--ki-on-accent, #232323);font:inherit;font-weight:600;cursor:pointer;';
  // Banner «Endret et annet sted – Last inn» øverst i et ark (host = arkets innhold; before = element det legges foran)
  MSH.draftBanner = function (host, onReload, before) {
    if (!host) return null;
    const el = document.createElement('div');
    el.className = 'msh-draft-banner';
    el.setAttribute('role', 'status');
    el.style.cssText = BANNER_CSS;
    el.innerHTML = `${MSH.icon('mdi:sync-alert', 20)}<span style="flex:1;min-width:0">Endret et annet sted</span><button type="button" style="${BANNER_BTN}">Last inn</button>`;
    el.querySelector('button').addEventListener('click', (e) => { e.stopPropagation(); MSH.haptic('light'); onReload && onReload(); });
    host.insertBefore(el, before || host.firstChild);
    return el;
  };
  MSH.draftEditor = function (card, o = {}) {
    const S = MSH.store;
    const key = o.key !== undefined ? o.key : (S ? MSH.storeKey(card._yamlConfig || card._rawConfig || card.config, card) : null);
    const reg = key || card;
    const J = (v) => JSON.stringify(v === undefined ? null : v);
    const src = 'draft:' + MSH.uid();
    const current = o.current || (() => (card._yamlConfig && S ? MSH.effectiveConfig(card._yamlConfig, card, { shared: S.scope === 'shared' }) : (card._rawConfig || card.config || {})));
    const prep = o.prepare || ((d) => d);
    let saved = dclone(o.saved || card._rawConfig || card.config || {});
    let draft = dclone(o.config || saved);
    let base = J(current());
    let busy = false, external = false, finished = false, bannerEl = null;
    const canPreview = () => !finished && (o.live ? o.live() : true);
    const liveId = () => (draft && draft.card_id) || (saved && saved.card_id) || (card._rawConfig && card._rawConfig.card_id);
    const others = (fn) => { const id = liveId(), set = id && MSH.liveCards.get(id); if (set) [...set].forEach((c) => { if (c !== card && c.isConnected) fn(c); }); };
    const preview = () => {
      if (!canPreview()) return;
      const d = draft;
      try { card.setConfig({ ...d, __eff: 1 }); } catch (e) { console.error('[ki-msh] utkast', e); }
      others((c) => c.setConfig({ ...d, __eff: 1 }));
    };
    // Kortet (og andre instanser) tilbake til lagret config – etter Ferdig er det den nye
    const restore = (ok) => {
      const re = (c) => { try { if (ok && !S) c.setConfig({ ...saved, __eff: 1 }); else if (c._yamlConfig) c.setConfig(c._yamlConfig); else c.setConfig({ ...saved, __eff: 1 }); } catch (e) { /* */ } };
      re(card); others(re);
    };
    const dirty = () => J(prep(dclone(draft))) !== J(saved);
    const showBanner = (on) => {
      if (!on) { if (bannerEl) bannerEl.remove(); bannerEl = null; return; }
      const host = typeof o.banner === 'function' ? o.banner() : o.banner;
      if (!host || (bannerEl && bannerEl.isConnected)) return;
      bannerEl = MSH.draftBanner(host, () => ctl.reload());
    };
    const setBusy = (b) => { busy = b; if (o.onBusy) try { o.onBusy(b); } catch (e) { /* */ } };
    // Innkommende config: egen lagring er allerede filtrert bort (src), så en forskjell her kommer fra en annen kilde
    const check = () => {
      if (finished || busy) return;
      let now; try { now = J(current()); } catch (e) { return; }
      if (now === base) return;
      if (!dirty()) { base = now; Promise.resolve().then(() => ctl.reload(true)); return; } // ingen egne endringer: ta inn stille
      if (!external) { external = true; showBanner(true); if (o.onExternal) o.onExternal(true); }
    };
    const inKey = (path) => {
      if (!path) return true;
      let p = String(path);
      if (p.startsWith('devices.')) p = p.split('.').slice(2).join('.');
      return !!p && (p === key || p.startsWith(key + '.') || key.startsWith(p + '.'));
    };
    const off = S && key ? S.subscribe((d, path, from) => { if (from !== src && inKey(path)) check(); }) : null;
    const finish = (ok) => {
      if (finished) return;
      finished = true;
      if (off) off();
      if (MSH.drafts.get(reg) === ctl) MSH.drafts.delete(reg);
      showBanner(false);
      restore(ok);
      if (o.close) try { o.close(); } catch (e) { /* */ }
      if (o.onFinish) try { o.onFinish(ok); } catch (e) { /* */ }
    };
    const ctl = {
      card, key, src, alive: o.alive || null,
      get draft() { return draft; },
      get saved() { return saved; },
      get busy() { return busy; },
      get dirty() { return dirty(); },
      get external() { return external; },
      get closed() { return finished; },
      get previewing() { return canPreview(); },
      set(next) { if (finished || busy || !next) return; draft = next; preview(); },
      preview,
      check,
      // «Last inn» (og bytte av omfang for Kamera/Person): utkastet = lagret config nå
      reload(silent) {
        if (finished || busy) return;
        saved = dclone(current()); draft = dclone(saved); base = J(saved);
        external = false; showBanner(false);
        preview();
        if (o.onReload) try { o.onReload(draft); } catch (e) { console.error('[ki-msh] utkast', e); }
        if (!silent) MSH.toast('Lastet inn');
      },
      async done() {
        if (finished) return { ok: true };
        if (busy) return null; // dobbelttrykk: lagringen pågår allerede
        const next = prep(dclone(draft));
        if (J(next) === J(saved)) { finish(true); return { ok: true, unchanged: true }; }
        setBusy(true);
        let r;
        try {
          r = await (o.save ? o.save(next, saved, ctl)
            : MSH.saveCardConfig(card.hass, saved, next, { card, immediate: true, confirm: true, src, ...(key ? { key } : {}), ...(o.saveOpts || {}) }));
        } catch (e) { r = { ok: false, error: (e && e.message) || String(e) }; }
        setBusy(false);
        if (finished) return r;
        if (!r || r.ok === false) {
          const msg = 'Kunne ikke lagre' + (r && r.error ? ' – ' + r.error : '');
          MSH.haptic('failure');
          if (o.onError) try { o.onError(msg); } catch (e) { /* */ }
          MSH.toast(msg);
          return r || { ok: false };
        }
        saved = dclone((r && r.config) || next);
        MSH.haptic('success');
        if (o.toast !== false && next.toasts !== false) MSH.toast('Lagret');
        finish(true);
        return r;
      },
      cancel() { finish(false); },
      dispose() { finish(false); },
    };
    const prev = MSH.drafts.get(reg);
    if (prev && prev !== ctl && !prev.closed) prev.dispose();
    MSH.drafts.set(reg, ctl);
    return ctl;
  };

  // Kortets egen editor (samme skjema som GUI-editoren) i et høyt ark; Avbryt/Ferdig ligger i den sticky headeren (Fiks 26).
  // Utkastflyten over (MSH.draftEditor): endringer vises live i alle instanser av kortet, men lagres først ved Ferdig.
  // Er arket for samme kort/nøkkel allerede åpent, gis det åpne tilbake (aldri to ark oppå hverandre).
  MSH.openEditor = function (card, { cardClass, focus, areaCtx, tag, title } = {}) {
    if (!customElements.get(tag || 'msh-editor')) return null;
    const key = MSH.store ? MSH.storeKey(card._yamlConfig || card._rawConfig || card.config, card) : null;
    const open = MSH.draftFor(key || card);
    if (open && open.ui && !open.ui.overlay.closed) return open.ui;
    // Høyt ark med sticky bunnlinje (Avbryt/Ferdig) og alltid synlig håndtak (Fiks 11)
    const ov = MSH.overlay({ html: '', maxWidth: 420, tall: true, tilpass: true }); // Fiks 26: Ferdig/Avbryt i headeren · 28.11: popupens høyde
    const ed = document.createElement(tag || 'msh-editor');
    ed.cardClass = cardClass || card.constructor;
    ed.inline = true;
    ed.focusSection = focus || null;
    if (areaCtx) ed.areaCtx = areaCtx;
    if (title) ed.title = title;
    ed.hass = card.hass;
    if (MSH.store && card.hass) MSH.store.refresh(card.hass);
    // Oppsett per enhet (bare Kamera/Person): «Denne enheten · Alle enheter» øverst (standard: denne enheten).
    // Alle andre kort har én felles config – ingen omfangsvelger.
    const perDev = !!(key && MSH.isPerDevice(card._yamlConfig || card._rawConfig || card.config, card, key));
    if (MSH.store) MSH.store.scope = perDev ? 'device' : 'shared';
    const own = () => key && MSH.store.hasOwn(key);
    // Status i arket: «Lagrer …» mens Ferdig lagrer, «Kunne ikke lagre – …» ved feil. Oppdateres direkte (ingen ny
    // tegning av arket); editorer uten _setStatus faller tilbake til morph (aldri innerHTML).
    const status = (t, kind) => { ed.status = t; ed.statusKind = kind || ''; if (ed._setStatus) ed._setStatus(t, kind || ''); else if (ed._render) ed._render(); };
    // Felles oppsett endres mens enheten har eget: ikke vis utkastet live her (enhetens oppsett gjelder)
    const live = () => !(MSH.store && MSH.store.scope === 'shared' && own());
    const ctl = MSH.draftEditor(card, {
      key, live,
      alive: () => ov.host.isConnected,
      banner: () => ov.body,
      close: () => ov.close(),
      // 28.9: «Lagrer …» som felles toast-pille (spinner) – erstattes av «Lagret» / «Kunne ikke lagre» (samme pille)
      onBusy: (b) => { if (b) { status('Lagrer …'); MSH.toast('Lagrer …', { type: 'busy', enabled: !(ctl.draft && ctl.draft.toasts === false) }); } else { if (ed.status === 'Lagrer …') status(''); setTimeout(() => { const t = MSH.overlayRoot().querySelector('#msh-toast'); if (t && t.dataset.type === 'busy') MSH.toastHide(t); }, 0); } MSH.draftBusy(ed, b); },
      onError: (msg) => status(msg, 'err'),
      onReload: (d) => { status(''); ed.setConfig(d); },
    });
    ctl.ui = { overlay: ov, editor: ed, draft: ctl };
    if (perDev && customElements.get('msh-scope-bar')) {
      const bar = document.createElement('msh-scope-bar');
      bar.hass = card.hass; bar.storeKey = key;
      bar.addEventListener('scope-change', () => ctl.reload(true));
      ov.body.appendChild(bar);
    }
    ed.setConfig(ctl.draft);
    // UI-tilstand for editoren (åpne seksjoner) – per kort, ikke i config
    const uiKey = (ctl.draft && ctl.draft.card_id) || (card._yamlConfig && card._yamlConfig.card_id) || null;
    if (uiKey) ed.uiKey = uiKey;
    ed.addEventListener('msh-change', (ev) => ctl.set(ev.detail.config)); // bare utkast + forhåndsvisning
    ed.addEventListener('msh-save', (ev) => { if (ev.detail && ev.detail.config) ctl.set(ev.detail.config); ctl.done(); });
    ed.addEventListener('msh-cancel', () => ctl.cancel());
    ov.onClosed = () => { ctl.dispose(); if (MSH.store) MSH.store.scope = 'shared'; };
    ov.body.appendChild(ed);
    return ctl.ui;
  };

  // Registrer kort + oppføring i kortvelgeren.
  // Popup-kort som får felles «Mellomrom» (gap, pad_top, pad_bottom over navbaren) i editoren, hvis de ikke har egen
  MSH.POPUP_CARDS = ['msh-rom-card', 'msh-person-card', 'msh-vaer-card', 'msh-lys-card', 'msh-klima-card', 'msh-media-card', 'msh-basseng-card', 'msh-vanning-card', 'msh-sikkerhet-card', 'msh-kamera-card', 'msh-ruter-card', 'msh-gjoremal-card', 'msh-settings-card'];
  const withSpacing = (cls) => {
    let p = cls, desc = null;
    while (p && !desc) { desc = Object.getOwnPropertyDescriptor(p, 'schema'); p = Object.getPrototypeOf(p); }
    if (!desc || !desc.get) return;
    const orig = desc.get;
    // 19.20: Mellomrom kan ligge i en fane (type 'tabs', f.eks. «Tilpass rom» → Oppsett)
    const has = (arr) => (arr || []).some((f) => f && ((f.type === 'section' && (f.id === 'spacing' || f.label === 'Mellomrom')) || (f.type === 'tabs' && (f.tabs || []).some((t) => t && has(t.fields)))));
    const add = (arr, self) => (has(arr) ? arr : [...(arr || []), MSH.spacingSchema(self.spacingDefaults)]);
    Object.defineProperty(cls, 'schema', { configurable: true, get() { const b = orig.call(this); return typeof b === 'function' ? (h, c) => add(b(h, c), this) : add(b, this); } });
  };
  // Fiks 16.13: HAs hui-card (_loadElement) setter element.hass/.layout/.preview/.editMode UTEN try/catch. Har kortet bare
  // en getter for en av dem, kaster tildelingen («Cannot set property layout … which has only a getter»), Bubble logger bare
  // «Failed to create card element» (console.warn) og popupen blir tom uten feilkort. Vakt: legg til en setter og logg.
  const HA_PROPS = ['hass', 'layout', 'preview', 'editMode', 'isPanel'];
  const guardHaProps = (tag, cls) => HA_PROPS.forEach((k) => {
    for (let p = cls.prototype; p && p !== HTMLElement.prototype; p = Object.getPrototypeOf(p)) {
      const d = Object.getOwnPropertyDescriptor(p, k);
      if (!d) continue;
      if (d.get && !d.set) {
        console.error(tag, `«${k}» har bare getter, men HA/Bubble setter den – setter lagt til (fiks 16.13)`);
        Object.defineProperty(cls.prototype, k, { configurable: true, get: d.get, set(v) { this['_ha_' + k] = v; } });
      }
      break;
    }
  });
  MSH.define = function (tag, cls, name, description) {
    if (customElements.get(tag)) return;
    guardHaProps(tag, cls);
    if (MSH.POPUP_CARDS.includes(tag)) withSpacing(cls);
    customElements.define(tag, cls);
    window.customCards = window.customCards || [];
    if (!window.customCards.find((c) => c.type === tag)) window.customCards.push({ type: tag, name: name || tag, description: description || '', preview: false, documentationURL: 'https://github.com/SebastianKristo/ki-msh' });
  };

  // Felles tom-tilstand: «–» + «Velg entitet» (åpner overstyring).
  MSH.emptyState = (text, section) => `<div class="empty">${MSH.icon('mdi:help-circle-outline', 22)}<span>${MSH.esc(text || 'Fant ingen entiteter')}</span><button class="pick press" data-act="customize" ${section ? `data-section="${MSH.esc(section)}"` : ''}>${MSH.icon('mdi:plus', 18)}Velg entitet</button></div>`;
})();
