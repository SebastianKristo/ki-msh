// Mer info-ark for appen (HAs «hass-more-info»): ett ark per entitet i KI MSH-stil, for alle entitetstyper.
// Lytter på hass-more-info (fra MSH.moreInfo og langt trykk), leser window.__H og oppdateres ved hver ny hass (ki-hass).
// Arket starter under statuslinjen (safe area + 50 px, som Bubble-popupene); trykk på bakgrunnen over arket lukker det.
// Oppdateringer patches inn i DOM-en (morph) i stedet for å bygge alt på nytt, så slidere, buer og farger glir mellom verdiene.
(function () {
  const C = { yellow: '#f2d26f', orange: '#f2b573', red: '#f28073', pink: '#f285c9', blue: '#73b9f2', green: '#66d19e', purple: '#ad99e6', lime: '#b8e674' };
  const PK = 'linear-gradient(145deg,#f285c9 -10%,#f5cdc6 100%)';
  const DARK = '#232323'; // ki-hex-ok: tekst/ikon på aksentflate er alltid mørk
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const nf = (v, d) => (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d).replace('.', ',');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const isNum = (v) => v !== '' && v != null && !isNaN(parseFloat(v)) && isFinite(v);
  const cap = (n) => n.charAt(0).toUpperCase() + n.slice(1);
  const ST = { on: 'På', off: 'Av', locked: 'Låst', unlocked: 'Ulåst', locking: 'Låser …', unlocking: 'Låser opp …', jammed: 'Fastlåst', open: 'Åpen', opening: 'Åpner …', closed: 'Lukket', closing: 'Lukker …', playing: 'Spiller', paused: 'Pauset', idle: 'Inaktiv', standby: 'Hvilemodus', buffering: 'Laster …', home: 'Hjemme', not_home: 'Borte', heat: 'Varme', cool: 'Kjøling', auto: 'Auto', heat_cool: 'Auto', dry: 'Avfukting', fan_only: 'Vifte', disarmed: 'Avslått', armed_away: 'Borte', armed_home: 'Hjemme', armed_night: 'Natt', armed_vacation: 'Ferie', armed_custom_bypass: 'Egendefinert', triggered: 'Utløst', arming: 'Slår på …', disarming: 'Slår av …', pending: 'Venter', cleaning: 'Rengjør', docked: 'Ladestasjon', returning: 'På vei hjem', error: 'Feil', mowing: 'Klipper', active: 'Aktiv', unavailable: 'Utilgjengelig', unknown: 'Ukjent', partlycloudy: 'Delvis skyet', cloudy: 'Skyet', sunny: 'Sol', 'clear-night': 'Klar natt', rainy: 'Regn', pouring: 'Kraftig regn', snowy: 'Snø', 'snowy-rainy': 'Sludd', fog: 'Tåke', windy: 'Vind', lightning: 'Torden', 'lightning-rainy': 'Torden og regn', hail: 'Hagl', recording: 'Tar opp', streaming: 'Strømmer', above_horizon: 'Over horisonten', below_horizon: 'Under horisonten', eco: 'Øko', performance: 'Ytelse', electric: 'Elektrisk', gas: 'Gass', heat_pump: 'Varmepumpe', high_demand: 'Høyt forbruk', problem: 'Problem', ok: 'OK' };
  const BIN = { door: ['Åpen', 'Lukket'], window: ['Åpent', 'Lukket'], garage_door: ['Åpen', 'Lukket'], opening: ['Åpen', 'Lukket'], motion: ['Bevegelse', 'Ingen bevegelse'], occupancy: ['Til stede', 'Ingen'], presence: ['Hjemme', 'Borte'], moisture: ['Vått', 'Tørt'], smoke: ['Røyk!', 'OK'], gas: ['Gass!', 'OK'], battery: ['Lavt', 'Normalt'], battery_charging: ['Lader', 'Lader ikke'], plug: ['Koblet til', 'Frakoblet'], problem: ['Problem', 'OK'], connectivity: ['Tilkoblet', 'Frakoblet'], lock: ['Ulåst', 'Låst'], light: ['Lys', 'Mørkt'], vibration: ['Vibrasjon', 'Rolig'], running: ['Kjører', 'Stopp'], safety: ['Utrygt', 'Trygt'], sound: ['Lyd', 'Stille'], tamper: ['Sabotasje', 'OK'], update: ['Oppdatering', 'Oppdatert'], heat: ['Varmt', 'Normalt'], cold: ['Kaldt', 'Normalt'] };
  const HVAC = { off: 'Av', heat: 'Varme', cool: 'Kjøling', auto: 'Auto', heat_cool: 'Varme/kjøling', dry: 'Avfukting', fan_only: 'Vifte' };
  const HVAC_IC = { off: 'mdi:power', heat: 'mdi:fire', cool: 'mdi:snowflake', auto: 'mdi:thermostat-auto', heat_cool: 'mdi:sun-snowflake-variant', dry: 'mdi:water-percent', fan_only: 'mdi:fan' };
  const HVAC_COL = { heat: C.orange, cool: C.blue, auto: C.green, heat_cool: C.purple, dry: C.yellow, fan_only: C.blue };
  const ACT = { heating: ['Varmer', 'mdi:fire', C.red], cooling: ['Kjøler', 'mdi:snowflake', C.blue], idle: ['Holder', 'mdi:check', null], drying: ['Avfukter', 'mdi:water-percent', C.yellow], fan: ['Vifte', 'mdi:fan', C.blue], off: ['Av', 'mdi:power', null], preheating: ['Forvarmer', 'mdi:fire', C.orange], defrosting: ['Avriser', 'mdi:snowflake-melt', C.blue] };
  const PRESET = { none: 'Ingen', eco: 'Øko', away: 'Borte', boost: 'Boost', comfort: 'Komfort', home: 'Hjemme', sleep: 'Natt', activity: 'Aktivitet', auto: 'Auto', smart: 'Smart', normal: 'Normal', low: 'Lav', medium: 'Middels', high: 'Høy', on: 'På', off: 'Av', diffuse: 'Spredt', focus: 'Fokus', top: 'Topp', middle: 'Midt', vertical: 'Vertikal', horizontal: 'Horisontal', both: 'Begge', breeze: 'Bris', natural: 'Naturlig' };
  const DICON = { light: 'mdi:lightbulb', switch: 'mdi:toggle-switch-variant', input_boolean: 'mdi:toggle-switch-variant', fan: 'mdi:fan', cover: 'mdi:window-shutter', climate: 'mdi:thermostat', water_heater: 'mdi:water-boiler', humidifier: 'mdi:air-humidifier', lock: 'mdi:lock', media_player: 'mdi:cast', alarm_control_panel: 'mdi:shield-home', sensor: 'mdi:eye', binary_sensor: 'mdi:checkbox-blank-circle-outline', person: 'mdi:account', device_tracker: 'mdi:map-marker', zone: 'mdi:map-marker-radius', camera: 'mdi:cctv', image: 'mdi:image', weather: 'mdi:weather-partly-cloudy', scene: 'mdi:palette', script: 'mdi:script-text-outline', automation: 'mdi:robot-outline', vacuum: 'mdi:robot-vacuum', lawn_mower: 'mdi:robot-mower', valve: 'mdi:valve', todo: 'mdi:format-list-checks', calendar: 'mdi:calendar', input_select: 'mdi:form-dropdown', select: 'mdi:form-dropdown', number: 'mdi:ray-vertex', input_number: 'mdi:ray-vertex', input_text: 'mdi:form-textbox', text: 'mdi:form-textbox', input_datetime: 'mdi:calendar-clock', datetime: 'mdi:calendar-clock', date: 'mdi:calendar', time: 'mdi:clock-outline', button: 'mdi:gesture-tap-button', input_button: 'mdi:gesture-tap-button', counter: 'mdi:counter', timer: 'mdi:timer-outline', update: 'mdi:package-up', siren: 'mdi:bullhorn', remote: 'mdi:remote', event: 'mdi:bell-ring-outline', sun: 'mdi:white-balance-sunny', group: 'mdi:google-circles-communities', plant: 'mdi:flower', tts: 'mdi:speaker-message', notify: 'mdi:message-text', conversation: 'mdi:forum-outline', siren_tone: 'mdi:bullhorn' };
  const DCLASS = { temperature: 'mdi:thermometer', humidity: 'mdi:water-percent', power: 'mdi:flash', energy: 'mdi:lightning-bolt', illuminance: 'mdi:brightness-5', battery: 'mdi:battery', door: 'mdi:door', window: 'mdi:window-closed-variant', motion: 'mdi:motion-sensor', occupancy: 'mdi:home-account', moisture: 'mdi:water-alert', smoke: 'mdi:smoke-detector', gas: 'mdi:meter-gas', ph: 'mdi:ph', garage: 'mdi:garage', garage_door: 'mdi:garage', voltage: 'mdi:sine-wave', current: 'mdi:current-ac', pressure: 'mdi:gauge', co2: 'mdi:molecule-co2', carbon_dioxide: 'mdi:molecule-co2', pm25: 'mdi:blur', timestamp: 'mdi:clock-outline', monetary: 'mdi:cash', speed: 'mdi:speedometer', distance: 'mdi:map-marker-distance', plug: 'mdi:power-plug', connectivity: 'mdi:wifi', blind: 'mdi:blinds', curtain: 'mdi:curtains', shutter: 'mdi:window-shutter', awning: 'mdi:awning-outline', gate: 'mdi:gate', shade: 'mdi:roller-shade', water: 'mdi:water', wind_speed: 'mdi:weather-windy' };
  const ON_STATES = ['on', 'open', 'opening', 'closing', 'playing', 'buffering', 'unlocked', 'unlocking', 'heat', 'cool', 'auto', 'heat_cool', 'dry', 'fan_only', 'cleaning', 'mowing', 'home', 'armed_away', 'armed_home', 'armed_night', 'armed_vacation', 'armed_custom_bypass', 'triggered', 'active', 'eco', 'performance', 'electric', 'gas', 'heat_pump', 'high_demand', 'above_horizon'];
  const ON = (s) => ON_STATES.includes(s.state);
  const COLOR = { light: C.yellow, switch: C.green, input_boolean: C.green, fan: C.blue, cover: C.pink, climate: C.orange, water_heater: C.orange, humidifier: C.blue, lock: C.green, media_player: C.pink, alarm_control_panel: C.red, vacuum: C.green, lawn_mower: C.lime, valve: C.blue, person: C.green, device_tracker: C.green, sensor: C.blue, binary_sensor: C.yellow, automation: C.purple, script: C.purple, timer: C.orange, siren: C.red, remote: C.blue, sun: C.yellow, update: C.orange, group: C.green, calendar: C.purple, counter: C.blue };
  const DOM = (id) => id.split('.')[0];
  const CT_MIN = 2000, CT_MAX = 6500;
  const kRgb = (k) => { // fargetemperatur → visningsfarge (varm → nøytral → kald)
    const t = clamp((k - CT_MIN) / (CT_MAX - CT_MIN), 0, 1), A = [255, 166, 82], B = [255, 244, 229], D = [205, 222, 255];
    const m = (x, y, u) => x.map((v, i) => Math.round(v + (y[i] - v) * u));
    return t < 0.6 ? m(A, B, t / 0.6) : m(B, D, (t - 0.6) / 0.4);
  };
  const hsRgb = (h, s) => { s /= 100; const f = (n) => { const k = (n + h / 60) % 6; return Math.round(255 * (1 - s * Math.max(0, Math.min(k, 4 - k, 1)))); }; return [f(5), f(3), f(1)]; };
  const rgbHs = ([r, g, b]) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0; if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h = Math.round(h * 60); if (h < 0) h += 360; return [h, mx ? Math.round((d / mx) * 100) : 0]; };
  const rgbS = (a) => `rgb(${a.join(',')})`;
  const hhmm = (d) => d.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
  const dt = (v) => { const d = new Date(v); return isNaN(d) ? String(v) : d.toLocaleString('nb-NO', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); };
  const agoT = (t) => { const m = Math.round((Date.now() - new Date(t).getTime()) / 60000); const a = Math.abs(m), f = a < 1 ? 'nå nettopp' : a < 60 ? `${a} min` : a < 1440 ? `${Math.round(a / 60)} t` : `${Math.round(a / 1440)} d`; return a < 1 ? f : m >= 0 ? f + ' siden' : 'om ' + f; };
  const hm = (min) => { min = Math.round(min); const h = Math.floor(min / 60), m = min % 60; return h ? `${h} t${m ? ' ' + m + ' min' : ''}` : `${m} min`; };
  const dur = (sec) => { sec = Math.max(0, Math.round(sec)); const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0'); };
  const parseDur = (v) => { if (v == null) return 0; if (typeof v === 'number') return v; const p = String(v).split(':').map(Number); return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p.length === 2 ? p[0] * 60 + p[1] : Number(v) || 0; };
  const J = (o) => esc(JSON.stringify(o));
  const F = (s, bit) => ((s.attributes.supported_features || 0) & bit) !== 0;

  // Tokens med mørk fallback (lys modus kommer fra temamodulen på <html>)
  const TX = 'var(--ki-text, #fafafa)', TX1 = 'var(--ki-text-1, #e1e1e1)', TX2 = 'var(--ki-text-2, #afafaf)', TXM = 'var(--ki-text-mid, #979797)', TX3 = 'var(--ki-text-3, #7f7f7f)';
  const SURF = 'var(--ki-surface, #3a3a3a)', SURF2 = 'var(--ki-surface-2, #404040)', SURF3 = 'var(--ki-surface-3, #2f2f2f)', POP = 'var(--ki-popup, #282828)', CTRL = 'var(--ki-ctrl, #545454)', LINE = 'var(--ki-line, rgba(255,255,255,.06))';

  const CSS = `
  :host{position:fixed;inset:0;z-index:2147483000;pointer-events:none;font-family:'Space Grotesk',system-ui,sans-serif;color:${TX};-webkit-tap-highlight-color:transparent;--top:calc(env(safe-area-inset-top, 0px) + 50px);--spring:cubic-bezier(.22,1.2,.36,1);--ease:cubic-bezier(.22,1,.36,1)}
  :host([open]){pointer-events:auto}
  *{box-sizing:border-box}
  button{all:unset;box-sizing:border-box;cursor:pointer;font-family:inherit;-webkit-user-select:none;user-select:none;position:relative;overflow:hidden}
  input{font-family:inherit}
  .bd{position:absolute;inset:0;background:rgb(0 0 0/.5);opacity:0;transition:opacity .35s var(--ease)}
  :host([open]) .bd{opacity:1}
  .sh{position:absolute;left:0;right:0;bottom:0;top:var(--top);display:flex;flex-direction:column;background:${POP};border-radius:28px 28px 0 0;box-shadow:inset 0 1px 0 rgb(255 255 255/.06),0 -12px 40px rgb(0 0 0/.45);will-change:transform;transform:translate3d(0,105%,0);transition:transform .5s var(--ease);overflow:hidden}
  :host([open]) .sh{transform:translate3d(0,var(--dy,0px),0)}
  .sh.drag{transition:none}
  @media (min-width:700px){.sh{left:50%;right:auto;width:560px;margin-left:-280px;bottom:24px;border-radius:32px}}
  .glowbg{position:absolute;left:-20%;right:-20%;top:-140px;height:420px;pointer-events:none;opacity:var(--go,0);background:radial-gradient(closest-side,var(--gc,transparent),transparent);transition:opacity .6s var(--ease),background .6s;filter:saturate(1.1)}
  .grab{flex:none;padding:9px 0 3px;display:flex;justify-content:center;touch-action:none;cursor:grab;position:relative}
  .grab i{display:block;width:40px;height:5px;border-radius:3px;background:${CTRL}}
  .hd{flex:none;display:flex;align-items:center;gap:12px;padding:6px 16px 14px 18px;touch-action:none;position:relative}
  .ic{width:48px;height:48px;border-radius:24px;flex:none;display:grid;place-items:center;transition:background .35s,color .35s,box-shadow .35s;--mdc-icon-size:24px}
  .ic.on{box-shadow:0 0 22px -2px var(--icc,transparent)}
  .tt{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
  .tt b{font-size:19px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .tt span{font-size:13px;color:${TXM};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .x{width:44px;height:44px;border-radius:22px;background:${SURF};display:grid;place-items:center;flex:none;--mdc-icon-size:22px;transition:transform .15s,background .2s}
  .seg{flex:none;position:relative;margin:0 16px;display:flex;padding:4px;border-radius:26px;background:${SURF3};box-shadow:inset 0 0 0 1px ${LINE}}
  .seg .ind{position:absolute;top:4px;bottom:4px;left:4px;width:calc((100% - 8px)/3);border-radius:20px;background:${PK};transform:translateX(calc(var(--si,0)*100%));transition:transform .4s var(--spring)}
  .seg button{flex:1;height:40px;border-radius:20px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:500;color:${TX2};transition:color .25s;z-index:1}
  .seg button.on{color:var(--ki-on-accent, #2a1720)}
  .bdy{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding:20px 16px calc(40px + env(safe-area-inset-bottom, 0px));display:flex;flex-direction:column;gap:14px}
  .bdy::-webkit-scrollbar{display:none}
  .bdy>*{flex-shrink:0}
  .bdy.in>*{animation:mi-in .5s var(--ease) both}
  .bdy.in>*:nth-child(2){animation-delay:.04s}.bdy.in>*:nth-child(3){animation-delay:.08s}.bdy.in>*:nth-child(4){animation-delay:.12s}.bdy.in>*:nth-child(5){animation-delay:.16s}.bdy.in>*:nth-child(6){animation-delay:.2s}.bdy.in>*:nth-child(n+7){animation-delay:.24s}
  @keyframes mi-in{from{opacity:0;transform:translateY(14px) scale(.98)}to{opacity:1;transform:none}}
  @media (prefers-reduced-motion:reduce){.sh,.seg .ind{transition:none}.bdy.in>*{animation:none}.spin,.pulse,.pulse::after,.ring-pulse,.blink,.eq i{animation:none!important}}
  .val{text-align:center;font-size:56px;font-weight:300;letter-spacing:-.04em;line-height:1;font-variant-numeric:tabular-nums;transition:color .3s}
  .val small{font-size:20px;color:${TX2};letter-spacing:0;margin-left:4px}
  .val.m{font-size:36px}
  .sub{text-align:center;font-size:14px;color:${TXM};margin-top:-6px;display:flex;align-items:center;justify-content:center;gap:6px;--mdc-icon-size:16px}
  .card{border-radius:28px;background:${SURF};padding:16px 18px;position:relative}
  .card h4{margin:0 0 12px;font-size:13px;font-weight:500;color:${TX2};display:flex;justify-content:space-between;gap:8px}
  .card h4 span{color:${TXM};font-weight:400}
  .hero{display:flex;flex-direction:column;align-items:center;gap:14px;padding:6px 0}
  .lbl{font-size:13px;color:${TX2};margin:4px 4px -4px;display:flex;justify-content:space-between}
  .lbl span{color:${TXM}}
  /* Slidere */
  .sl{position:relative;touch-action:none;cursor:pointer;overflow:hidden;background:${SURF};box-shadow:inset 0 0 0 1px ${LINE};-webkit-user-select:none;user-select:none}
  .sl .fill{position:absolute;left:0;bottom:0;transition:height .45s var(--ease),width .45s var(--ease),background .4s,opacity .3s}
  .sl.drag .fill,.sl.drag .kn{transition:none}
  .sl.v{width:128px;height:min(360px,44vh);border-radius:40px;align-self:center;transition:transform .2s var(--spring)}
  .sl.v.drag{transform:scale(1.03)}
  .sl.v .fill{right:0}
  .sl.v .fill::after{content:'';position:absolute;left:50%;top:12px;width:40px;height:5px;margin-left:-20px;border-radius:3px;background:rgb(0 0 0/.28)}
  .sl.v .ico{position:absolute;left:0;right:0;bottom:20px;display:grid;place-items:center;--mdc-icon-size:30px;transition:color .3s;pointer-events:none}
  .sl.h{height:56px;border-radius:28px;width:100%}
  .sl.h .fill{top:0}
  .sl.h .fill::after{content:'';position:absolute;right:12px;top:50%;width:4px;height:22px;margin-top:-11px;border-radius:2px;background:rgb(0 0 0/.25)}
  .sl.h .ico{position:absolute;left:16px;top:0;bottom:0;display:flex;align-items:center;gap:10px;font-size:15px;font-weight:500;--mdc-icon-size:22px;pointer-events:none;transition:color .3s;white-space:nowrap}
  .sl.h .vv{position:absolute;right:18px;top:0;bottom:0;display:flex;align-items:center;font-size:15px;font-weight:500;pointer-events:none;font-variant-numeric:tabular-nums}
  .sl.g{height:56px;border-radius:28px;width:100%}
  .sl.g .kn{position:absolute;top:6px;width:44px;height:44px;margin-left:-22px;border-radius:22px;box-shadow:0 0 0 3px #fff,0 4px 12px rgb(0 0 0/.35);transition:left .45s var(--ease),background .3s}
  .sl.g.drag .kn{transform:scale(1.08)}
  .sl.g .end{position:absolute;top:0;bottom:0;display:flex;align-items:center;font-size:12px;font-weight:500;color:rgb(0 0 0/.55);pointer-events:none}
  .glow{position:relative;align-self:center;display:grid;place-items:center}
  .glow::before{content:'';position:absolute;inset:-40px;border-radius:50%;background:radial-gradient(closest-side,var(--gc,transparent),transparent);opacity:var(--go,0);transition:opacity .5s,background .5s;pointer-events:none}
  /* Fargehjul */
  .wheel{position:relative;width:min(260px,70vw);aspect-ratio:1;border-radius:50%;align-self:center;touch-action:none;cursor:crosshair;background:radial-gradient(circle closest-side,#fff,rgb(255 255 255/0) 100%),conic-gradient(from 90deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00);box-shadow:0 0 0 6px ${SURF},0 10px 40px rgb(0 0 0/.35)}
  .wheel .kn{position:absolute;width:40px;height:40px;margin:-20px 0 0 -20px;border-radius:50%;box-shadow:0 0 0 4px #fff,0 4px 14px rgb(0 0 0/.45);transition:left .4s var(--ease),top .4s var(--ease),background .3s,transform .2s var(--spring)}
  .wheel.drag .kn{transition:transform .2s var(--spring);transform:scale(1.2)}
  /* Termostat-skive */
  .dial{position:relative;width:min(280px,76vw);aspect-ratio:1;align-self:center;touch-action:none}
  .dial svg{width:100%;height:100%;display:block;overflow:visible}
  .dial .arc{transition:stroke .4s}
  .dial .mid{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;pointer-events:none}
  .dial .mid .val{font-size:58px}
  .dial .mid .sub{margin:0}
  /* Knapper */
  .row{display:flex;justify-content:center;gap:12px;flex-wrap:wrap;align-items:center}
  .cb{width:60px;height:60px;border-radius:30px;background:${SURF};display:grid;place-items:center;--mdc-icon-size:26px;transition:background .25s,color .25s,transform .18s var(--spring)}
  .cb.pri{background:${TX};color:${POP};width:76px;height:76px;border-radius:38px;--mdc-icon-size:36px}
  .cb.sm{width:48px;height:48px;border-radius:24px;--mdc-icon-size:22px}
  .cb.on{background:${PK};color:var(--ki-on-accent, #2a1720)}
  .cb:active,.chip:active,.act:active,.big:active,.x:active,.btn:active,.opt:active,.tg:active{transform:scale(.93)}
  .cb:disabled,.cb[disabled]{opacity:.35;pointer-events:none}
  .chips{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
  .chips.sc{flex-wrap:nowrap;justify-content:flex-start;overflow-x:auto;margin:0 -16px;padding:2px 16px;scrollbar-width:none}
  .chips.sc::-webkit-scrollbar{display:none}
  .chip{white-space:nowrap;height:44px;padding:0 18px;border-radius:22px;background:${SURF};display:flex;align-items:center;gap:8px;font-size:14px;font-weight:500;color:${TX1};--mdc-icon-size:18px;transition:background .3s,color .3s,transform .18s var(--spring);flex:none}
  .chip.on{background:${PK};color:var(--ki-on-accent, #2a1720)}
  .sw{width:46px;height:46px;border-radius:23px;box-shadow:inset 0 0 0 2px rgb(255 255 255/.14);transition:box-shadow .25s,transform .2s var(--spring);flex:none}
  .sw.on{box-shadow:0 0 0 3px ${POP},0 0 0 5px ${TX};transform:scale(1.06)}
  .big{align-self:center;width:168px;height:168px;border-radius:84px;display:grid;place-items:center;--mdc-icon-size:60px;transition:background .45s,color .45s,transform .2s var(--spring),box-shadow .45s;overflow:visible}
  .big.lit{box-shadow:0 0 60px -6px var(--bc,transparent)}
  .big img{width:100%;height:100%;object-fit:cover;border-radius:inherit}
  .pulse{position:relative}
  .pulse::after{content:'';position:absolute;inset:0;border-radius:inherit;box-shadow:0 0 0 0 var(--bc,currentColor);animation:mi-pulse 1.8s ease-out infinite}
  @keyframes mi-pulse{0%{box-shadow:0 0 0 0 var(--bc)}100%{box-shadow:0 0 0 28px transparent}}
  .spin{animation:mi-spin var(--spd,1.2s) linear infinite}
  @keyframes mi-spin{to{transform:rotate(360deg)}}
  .tg{position:relative;align-self:center;width:132px;height:290px;border-radius:40px;background:${SURF};box-shadow:inset 0 0 0 1px ${LINE};transition:background .35s,box-shadow .45s}
  .tg.on{box-shadow:0 0 50px -10px var(--bc,transparent)}
  .tg .kn{position:absolute;left:8px;right:8px;top:8px;height:120px;border-radius:32px;background:var(--ki-knob, #fafafa);display:grid;place-items:center;color:${DARK};--mdc-icon-size:34px;transform:translateY(154px);transition:transform .5s var(--spring);box-shadow:0 6px 18px rgb(0 0 0/.3)}
  .tg.on .kn{transform:none}
  .acts{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .acts.three{grid-template-columns:1fr 1fr 1fr}
  .act{height:64px;border-radius:32px;background:${SURF};display:flex;align-items:center;gap:10px;padding:0 14px 0 8px;font-size:15px;font-weight:500;transition:background .3s,color .3s,transform .18s var(--spring);white-space:nowrap}
  .act .ai{width:48px;height:48px;border-radius:24px;background:${SURF3};display:grid;place-items:center;--mdc-icon-size:22px;flex:none;transition:background .3s}
  .act.on{background:${PK};color:var(--ki-on-accent, #2a1720)}.act.on .ai{background:rgb(255 255 255/.35)}
  .acts.three .act{flex-direction:column;justify-content:center;height:88px;padding:8px;gap:4px;font-size:13px;border-radius:28px}
  .btn{height:52px;border-radius:26px;background:${PK};color:var(--ki-on-accent, #2a1720);display:flex;align-items:center;justify-content:center;gap:8px;font-size:15px;font-weight:600;padding:0 22px;--mdc-icon-size:20px;transition:transform .18s var(--spring),opacity .2s}
  .btn.ghost{background:${SURF};color:${TX}}
  .btn[disabled]{opacity:.4;pointer-events:none}
  .rip{position:absolute;border-radius:50%;pointer-events:none;background:currentColor;opacity:.25;transform:scale(0);animation:mi-rip .55s var(--ease) forwards}
  @keyframes mi-rip{to{transform:scale(1);opacity:0}}
  /* Lister, tekst, verdier */
  .kv{display:flex;flex-direction:column}
  .kv>div{display:flex;justify-content:space-between;align-items:center;gap:14px;padding:12px 2px;border-top:1px solid ${LINE};font-size:14px;min-height:46px}
  .kv>div:first-child{border-top:0}
  .kv span{color:${TXM};flex:none}
  .kv b{font-weight:500;text-align:right}
  .kv code{font:12px ui-monospace,Menlo,monospace;text-align:right;overflow-wrap:anywhere;color:${TX1}}
  .opt{display:flex;align-items:center;gap:12px;width:100%;min-height:52px;padding:0 16px;border-radius:18px;font-size:15px;transition:background .25s,transform .18s var(--spring)}
  .opt+.opt{margin-top:4px}
  .opt .ck{width:24px;height:24px;border-radius:12px;box-shadow:inset 0 0 0 2px ${CTRL};display:grid;place-items:center;--mdc-icon-size:16px;color:transparent;transition:background .25s,color .25s,box-shadow .25s;flex:none}
  .opt.on{background:${SURF2}}
  .opt.on .ck{background:${C.pink};box-shadow:none;color:${DARK}}
  .opt.done span{text-decoration:line-through;color:${TXM}}
  .note{font-size:13px;color:${TXM};text-align:center;line-height:1.45}
  .inp{display:flex;gap:8px;align-items:center}
  .inp input{flex:1;min-width:0;height:52px;border-radius:26px;border:0;outline:0;background:${SURF};color:${TX};padding:0 20px;font-size:16px;box-shadow:inset 0 0 0 1px ${LINE};transition:box-shadow .2s}
  .inp input:focus{box-shadow:inset 0 0 0 2px ${C.pink}}
  .inp input::-webkit-calendar-picker-indicator{filter:invert(.7)}
  .ph{min-height:170px;border-radius:28px;background:repeating-linear-gradient(135deg,${SURF3} 0 10px,${SURF} 10px 20px);display:grid;place-items:center;font:11px ui-monospace,Menlo,monospace;color:${TXM};overflow:hidden;position:relative}
  .ph img{width:100%;height:100%;object-fit:cover;display:block;position:absolute;inset:0}
  .cam{aspect-ratio:16/9;min-height:0}
  .live{position:absolute;left:12px;top:12px;padding:4px 10px;border-radius:12px;background:rgb(0 0 0/.55);color:#fff;font:600 11px 'Space Grotesk',system-ui,sans-serif;display:flex;align-items:center;gap:6px;letter-spacing:.04em}
  .live i{width:8px;height:8px;border-radius:4px;background:${C.red};animation:mi-blink 1.4s ease-in-out infinite}
  @keyframes mi-blink{50%{opacity:.25}}
  .blink{animation:mi-blink 1.6s ease-in-out infinite}
  .map{height:220px;border-radius:28px;overflow:hidden;background:${SURF3};position:relative;z-index:0}
  /* Graf */
  .chart{height:160px;position:relative;touch-action:pan-y;cursor:crosshair}
  .chart svg{width:100%;height:100%;display:block;overflow:visible}
  .chart .cur{position:absolute;top:0;bottom:0;width:0;border-left:1.5px dashed ${TX2};opacity:0;transition:opacity .2s;pointer-events:none}
  .chart .tip{position:absolute;top:-6px;transform:translate(-50%,-100%);padding:5px 10px;border-radius:12px;background:var(--ki-pill-bg, #fafafa);color:var(--ki-pill-fg, #232323);font-size:12px;font-weight:600;white-space:nowrap;opacity:0;transition:opacity .2s;pointer-events:none}
  .chart.scr .cur,.chart.scr .tip{opacity:1}
  .chart .dot{position:absolute;width:12px;height:12px;margin:-6px 0 0 -6px;border-radius:6px;background:var(--lc);box-shadow:0 0 0 3px ${SURF};opacity:0;transition:opacity .2s;pointer-events:none}
  .chart.scr .dot{opacity:1}
  .ax{display:flex;justify-content:space-between;font-size:11px;color:${TX3};margin-top:8px;white-space:nowrap}
  .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:14px}
  .stats div{border-radius:18px;background:${SURF3};padding:10px 12px;display:flex;flex-direction:column;gap:2px}
  .stats span{font-size:11px;color:${TXM}}.stats b{font-size:16px;font-weight:500;font-variant-numeric:tabular-nums}
  .tl{display:flex;height:30px;border-radius:15px;overflow:hidden;gap:2px;background:${SURF3}}
  .tl span{display:block;height:100%;min-width:2px;transition:flex .5s var(--ease)}
  .log>div{display:flex;align-items:center;gap:12px;padding:10px 2px;border-top:1px solid ${LINE};font-size:14px}
  .log>div:first-child{border-top:0}
  .log i{width:10px;height:10px;border-radius:5px;flex:none}
  .log span{flex:1}.log em{font-style:normal;color:${TXM};font-size:13px}
  /* Media */
  .art{position:relative;aspect-ratio:1;width:min(250px,64vw);align-self:center;border-radius:32px;background:repeating-linear-gradient(135deg,${SURF3} 0 10px,${SURF} 10px 20px);display:grid;place-items:center;--mdc-icon-size:64px;color:${TX3};box-shadow:0 20px 50px -12px rgb(0 0 0/.6);transition:transform .5s var(--spring)}
  .art.pz{transform:scale(.9)}
  .art img{width:100%;height:100%;object-fit:cover;border-radius:inherit}
  .mt{text-align:center;display:flex;flex-direction:column;gap:4px}.mt b{font-size:21px;font-weight:500}.mt span{font-size:14px;color:${TXM}}
  .prog{display:flex;flex-direction:column;gap:6px}
  .prog .bar{position:relative;height:8px;border-radius:4px;background:${SURF};touch-action:none;cursor:pointer}
  .prog .bar i{position:absolute;left:0;top:0;bottom:0;border-radius:4px;background:${TX};transition:width 1s linear}
  .prog .t{display:flex;justify-content:space-between;font-size:12px;color:${TXM};font-variant-numeric:tabular-nums}
  .eq{display:inline-flex;gap:2px;align-items:flex-end;height:14px}
  .eq i{width:3px;background:currentColor;border-radius:1px;animation:mi-eq .9s ease-in-out infinite}
  .eq i:nth-child(2){animation-delay:-.3s}.eq i:nth-child(3){animation-delay:-.6s}
  @keyframes mi-eq{0%,100%{height:4px}50%{height:14px}}
  /* Ring (timer, batteri) */
  .ring{position:relative;width:220px;height:220px;align-self:center}
  .ring svg{width:100%;height:100%;transform:rotate(-90deg)}
  .ring circle{fill:none;stroke-linecap:round;transition:stroke-dashoffset 1s linear,stroke .4s}
  .ring .mid{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:0 30px;text-align:center}
  .ring .val.m{font-size:28px}
  .ring-pulse{animation:mi-breath 2.4s ease-in-out infinite}
  @keyframes mi-breath{50%{transform:scale(1.04)}}
  /* Tastatur */
  .pad{display:grid;grid-template-columns:repeat(3,72px);gap:12px;justify-content:center}
  .pad button{height:72px;border-radius:36px;background:${SURF};display:grid;place-items:center;font-size:26px;font-weight:400;--mdc-icon-size:24px;transition:background .2s,transform .15s var(--spring)}
  .pad button:active{transform:scale(.9);background:${SURF2}}
  .dots{display:flex;gap:12px;justify-content:center;height:14px}
  .dots i{width:14px;height:14px;border-radius:7px;box-shadow:inset 0 0 0 2px ${CTRL};transition:background .2s,transform .2s var(--spring)}
  .dots i.f{background:${TX};box-shadow:none;transform:scale(1.1)}
  .fc{display:flex;gap:8px;overflow-x:auto;margin:0 -18px;padding:0 18px;scrollbar-width:none}
  .fc::-webkit-scrollbar{display:none}
  .fc>div{flex:none;width:62px;border-radius:20px;background:${SURF3};padding:10px 4px;display:flex;flex-direction:column;align-items:center;gap:6px;font-size:12px;color:${TXM};--mdc-icon-size:24px}
  .fc b{font-size:15px;font-weight:500;color:${TX}}
  .sunarc{height:130px;position:relative}
  .sunarc svg{width:100%;height:100%;overflow:visible}
  .bat{display:flex;align-items:center;gap:10px;font-size:14px;color:${TX2};--mdc-icon-size:20px;justify-content:center}
  .bat .b{width:120px;height:8px;border-radius:4px;background:${SURF};overflow:hidden}
  .bat .b i{display:block;height:100%;border-radius:4px;transition:width .6s var(--ease)}
  `;

  const CSS2 = `
  .hd .gear{width:44px;height:44px;border-radius:22px;background:var(--ki-surface,#3a3a3a);display:grid;place-items:center;--mdc-icon-size:21px;flex:none;transition:background .2s,transform .2s cubic-bezier(.34,1.45,.64,1)}
  .hd .gear.on{background:linear-gradient(145deg,#f285c9 -10%,#f5cdc6 100%);color:#2a1720}
  .hd .gear:active{transform:scale(.92)}
  .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(0,1fr));gap:8px}
  .stat{border-radius:22px;background:var(--ki-surface,#3a3a3a);padding:12px 12px 11px;display:flex;flex-direction:column;gap:4px;min-width:0}
  .stat span{font-size:11.5px;color:var(--ki-text-mid,#979797);display:flex;align-items:center;gap:5px;--mdc-icon-size:14px;white-space:nowrap}
  .stat b{font-size:20px;font-weight:500;letter-spacing:-.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .stat b small{font-size:12px;color:var(--ki-text-2,#afafaf);font-weight:400;margin-left:2px}
  .rels{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
  .rel{display:flex;align-items:center;gap:10px;padding:10px 12px 10px 10px;border-radius:22px;background:var(--ki-surface,#3a3a3a);text-align:left;min-width:0;transition:transform .2s cubic-bezier(.34,1.45,.64,1),background .15s}
  .rel:active{transform:scale(.96);background:var(--ki-surface-2,#404040)}
  .rel .ri{width:36px;height:36px;border-radius:18px;flex:none;display:grid;place-items:center;--mdc-icon-size:19px;background:color-mix(in srgb,var(--rc,#73b9f2) 22%,transparent);color:var(--rc,#73b9f2)}
  .rel .rt{display:flex;flex-direction:column;gap:1px;min-width:0}
  .rel .rt b{font-size:15px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .rel .rt i{font-style:normal;font-size:11.5px;color:var(--ki-text-mid,#979797);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .mhero{position:relative;border-radius:30px;overflow:hidden;padding:18px;display:flex;gap:16px;align-items:center;background:var(--ki-surface,#3a3a3a)}
  .mhero .bgimg{position:absolute;inset:-30px;background:center/cover;filter:blur(30px) saturate(1.6) brightness(.55);transform:scale(1.2);opacity:.9}
  .mhero>*{position:relative}
  .mhero .cov{width:112px;height:112px;border-radius:22px;flex:none;overflow:hidden;background:var(--ki-surface-2,#404040);display:grid;place-items:center;--mdc-icon-size:44px;color:var(--ki-text-2,#afafaf);box-shadow:0 14px 30px rgb(0 0 0/.35);transition:transform .5s cubic-bezier(.34,1.3,.64,1)}
  .mhero .cov.pz{transform:scale(.9)}
  .mhero .cov img{width:100%;height:100%;object-fit:cover}
  .mhero .mi2{display:flex;flex-direction:column;gap:4px;min-width:0}
  .mhero .mi2 b{font-size:20px;font-weight:600;line-height:1.2;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .mhero .mi2 span{font-size:13.5px;color:var(--ki-text-2,#c7c7c7);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .mhero .mi2 em{font-style:normal;font-size:11.5px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--pink,#f285c9)}
  .vsteps{display:flex;gap:6px}
  .grpm{display:flex;flex-wrap:wrap;gap:6px}
  .setf{display:flex;flex-direction:column;gap:6px}
  .setf>span{font-size:13px;color:var(--ki-text-mid,#979797);padding:0 8px}
  .setf input{height:52px;border:0;outline:none;border-radius:26px;background:var(--ki-surface,#3a3a3a);color:var(--ki-text,#fafafa);font:15px inherit;font-family:inherit;padding:0 20px;width:100%;box-sizing:border-box}
  .setf input:focus{box-shadow:inset 0 0 0 1.5px var(--pink,#f285c9)}
  .setf input.mono{font-family:ui-monospace,Menlo,monospace;font-size:13.5px}
  .icrow{display:flex;gap:8px;align-items:center}
  .icprev{width:52px;height:52px;border-radius:26px;flex:none;display:grid;place-items:center;background:var(--ki-surface,#3a3a3a);--mdc-icon-size:24px}
  .icsug{display:flex;gap:6px;flex-wrap:wrap}
  .icsug button{width:44px;height:44px;border-radius:22px;background:var(--ki-surface,#3a3a3a);display:grid;place-items:center;--mdc-icon-size:21px}
  .icsug button.on{background:linear-gradient(145deg,#f285c9 -10%,#f5cdc6 100%);color:#2a1720}
  .setrow{display:flex;align-items:center;gap:12px;min-height:58px;padding:6px 16px;border-top:1px solid rgb(255 255 255/.06)}
  .setrow:first-child{border-top:0}
  .setrow b{flex:1;font-size:15px;font-weight:500}.setrow i{display:block;font-style:normal;font-size:12px;color:var(--ki-text-mid,#979797);font-weight:400}
  .sw2{width:50px;height:30px;border-radius:15px;background:var(--ki-ctrl,#545454);position:relative;flex:none;transition:background .2s}
  .sw2::after{content:'';position:absolute;top:3px;left:3px;width:24px;height:24px;border-radius:12px;background:#fff;transition:left .28s cubic-bezier(.34,1.45,.64,1);box-shadow:0 1px 4px rgb(0 0 0/.3)}
  .sw2.on{background:var(--pink,#f285c9)}.sw2.on::after{left:23px}
  .savebar{display:flex;gap:8px;margin-top:6px}
  .savebar .btn{flex:1}
  .glowbg,.glow::before,.glow::after{display:none!important}
  .glow{filter:none!important;box-shadow:none!important;background:none!important}
  .big.lit,.ic.on,.hd .ic{box-shadow:none!important;filter:none!important}
  .dial path.arc[filter],.dial path[filter]{display:none!important}
  .sl .fill,.cb.pri{box-shadow:none!important}
  `;
  /* ---------- morph: oppdater eksisterende DOM mot ny HTML (beholder elementer → CSS-overganger virker) ---------- */
  function morph(from, to) {
    const a = Array.from(from.childNodes), b = Array.from(to.childNodes);
    for (let i = 0; i < b.length; i++) {
      const n = b[i], o = a[i];
      if (!o) { from.appendChild(n); continue; }
      const key = (x) => (x.nodeType === 1 ? x.getAttribute('data-k') : null);
      if (o.nodeType !== n.nodeType || o.nodeName !== n.nodeName || key(o) !== key(n)) { from.replaceChild(n, o); continue; }
      if (o.nodeType === 3 || o.nodeType === 8) { if (o.nodeValue !== n.nodeValue) o.nodeValue = n.nodeValue; continue; }
      if (o.nodeType !== 1) continue;
      if (o.hasAttribute('data-keep')) continue;
      if (o.classList.contains('rip')) { from.replaceChild(n, o); continue; }
      for (const at of Array.from(o.attributes)) if (!n.hasAttribute(at.name)) o.removeAttribute(at.name);
      for (const at of Array.from(n.attributes)) if (o.getAttribute(at.name) !== at.value) o.setAttribute(at.name, at.value);
      if (o.localName === 'input') { if (o !== o.getRootNode().activeElement && o.value !== (n.getAttribute('value') || '')) o.value = n.getAttribute('value') || ''; continue; }
      if (o.localName === 'ha-icon') continue;
      morph(o, n);
    }
    for (let i = from.childNodes.length - 1; i >= b.length; i--) { const c = from.childNodes[i]; if (!(c.classList && c.classList.contains('rip'))) from.removeChild(c); }
  }

  class KiMoreInfo {
    constructor() {
      this.host = document.createElement('div'); this.host.className = 'ki-more-info';
      this.shadowRoot = this.host.attachShadow({ mode: 'open' });
      this.shadowRoot.innerHTML = `<style>${CSS}</style><style>${CSS2}</style><div id="root"></div>`;
      this.root = this.shadowRoot.getElementById('root');
      const lf = document.querySelector('link[href*="leaflet.css"]');
      if (lf) this.shadowRoot.insertBefore(lf.cloneNode(), this.root);
      this.tab = 'ctl'; this.eid = null; this.hist = {}; this.ui = {};
      this.delegate();
    }
    setAttribute(k, v) { this.host.setAttribute(k, v); } removeAttribute(k) { this.host.removeAttribute(k); } hasAttribute(k) { return this.host.hasAttribute(k); } get style() { return this.host.style; }
    get hass() { return window.__H; }
    get s() { const h = this.hass; return h && this.eid && h.states[this.eid]; }
    open(id) {
      if (!this.hass || !this.hass.states[id]) return;
      clearTimeout(this._gone);
      const same = this.eid === id && this.hasAttribute('open');
      this.eid = id; if (!same) { this.tab = 'ctl'; this.ui = {}; }
      this.style.setProperty('--dy', '0px');
      this._sig = null; this.render(true);
      requestAnimationFrame(() => requestAnimationFrame(() => this.setAttribute('open', '')));
      this.loadHist(id); this.startTick(); this.loadExtra();
    }
    close() {
      this.removeAttribute('open'); this.style.setProperty('--dy', '0px'); this._drag = null; this.stopTick();
      clearTimeout(this._gone); this._gone = setTimeout(() => { if (!this.hasAttribute('open')) { this.root.innerHTML = ''; this._map = null; } }, 520);
    }
    haptic(t) { try { window.dispatchEvent(new CustomEvent('haptic', { detail: t || 'light' })); } catch (e) { /* */ } }
    call(d, s, data) { const h = this.hass; if (h) return h.callService(d, s, { entity_id: this.eid, ...(data || {}) }); }
    async loadHist(id) {
      const h = this.hass; if (!h || this.hist[id]) return;
      try {
        const r = await h.callWS({ type: 'history/history_during_period', entity_ids: [id], start_time: new Date(Date.now() - 86400000).toISOString(), minimal_response: true, no_attributes: true, significant_changes_only: false });
        this.hist[id] = { at: Date.now(), d: (r && r[id]) || [] };
        if (this.eid === id) this.update();
      } catch (e) { this.hist[id] = { at: Date.now(), d: [] }; }
    }
    async loadExtra() {
      const s = this.s; if (!s) return; const d = DOM(s.entity_id), h = this.hass, id = s.entity_id;
      if (d === 'todo' && h.callWS) {
        try { const r = await h.callWS({ type: 'todo/item/list', entity_id: id }); this.ui.todo = (r && r.items) || []; this.update(); } catch (e) { this.ui.todo = []; }
      }
      if (d === 'weather' && h.connection && h.connection.subscribeMessage) {
        try {
          if (this._unsubFc) { this._unsubFc(); this._unsubFc = null; }
          const un = await h.connection.subscribeMessage((m) => { if (this.eid !== id) return; this.ui.fc = (m && m.forecast) || []; this.update(); }, { type: 'weather/subscribe_forecast', forecast_type: 'hourly', entity_id: id });
          this._unsubFc = typeof un === 'function' ? un : null;
        } catch (e) { /* */ }
      }
    }
    startTick() { this.stopTick(); this._tick = setInterval(() => this.onTick(), 1000); }
    stopTick() { clearInterval(this._tick); this._tick = null; if (this._unsubFc) { try { this._unsubFc(); } catch (e) { /* */ } this._unsubFc = null; } }
    onTick() {
      const s = this.s; if (!s || !this.hasAttribute('open')) return;
      const d = DOM(s.entity_id);
      if (d === 'timer' || d === 'media_player') this.update(true);
      if (d === 'camera' && this.tab === 'ctl') { const im = this.root.querySelector('img[data-cam]'); if (im && ++this._camN % 3 === 0) im.src = im.dataset.cam + (im.dataset.cam.includes('?') ? '&' : '?') + 't=' + Date.now(); }
    }
    area(id) { const h = this.hass, e = h.entities && h.entities[id]; let a = e && e.area_id; if (!a && e && e.device_id && h.devices && h.devices[e.device_id]) a = h.devices[e.device_id].area_id; a = a && h.areas && h.areas[a]; return a ? a.name : ''; }
    icon(s) {
      const d = DOM(s.entity_id), a = s.attributes;
      if (a.icon) return a.icon;
      if (d === 'lock') return { unlocked: 'mdi:lock-open-variant', jammed: 'mdi:lock-alert', open: 'mdi:lock-open-variant' }[s.state] || 'mdi:lock';
      if (d === 'cover') { const dc = a.device_class; if (dc === 'garage') return s.state === 'closed' ? 'mdi:garage' : 'mdi:garage-open'; if (dc === 'gate') return s.state === 'closed' ? 'mdi:gate' : 'mdi:gate-open'; if (dc === 'door') return s.state === 'closed' ? 'mdi:door-closed' : 'mdi:door-open'; if (dc === 'blind' || dc === 'curtain') return s.state === 'closed' ? 'mdi:blinds' : 'mdi:blinds-open'; return s.state === 'closed' ? 'mdi:window-shutter' : 'mdi:window-shutter-open'; }
      if (d === 'binary_sensor') { const dc = a.device_class, on = s.state === 'on'; const M = { door: ['mdi:door-open', 'mdi:door-closed'], window: ['mdi:window-open-variant', 'mdi:window-closed-variant'], motion: ['mdi:motion-sensor', 'mdi:motion-sensor-off'], occupancy: ['mdi:home-account', 'mdi:home-outline'], moisture: ['mdi:water-alert', 'mdi:water-off'], smoke: ['mdi:smoke-detector-alert', 'mdi:smoke-detector'], connectivity: ['mdi:check-network-outline', 'mdi:close-network-outline'], battery: ['mdi:battery-alert', 'mdi:battery'], plug: ['mdi:power-plug', 'mdi:power-plug-off'], garage_door: ['mdi:garage-open', 'mdi:garage'], presence: ['mdi:home', 'mdi:home-outline'], problem: ['mdi:alert-circle', 'mdi:check-circle'] }[dc]; if (M) return on ? M[0] : M[1]; return on ? 'mdi:checkbox-marked-circle' : 'mdi:checkbox-blank-circle-outline'; }
      if (d === 'sensor' && a.device_class === 'battery' && isNum(s.state)) { const v = Math.round(parseFloat(s.state) / 10) * 10; return v >= 100 ? 'mdi:battery' : v <= 0 ? 'mdi:battery-outline' : 'mdi:battery-' + v; }
      if (d === 'media_player') return { tv: 'mdi:television', speaker: 'mdi:speaker', receiver: 'mdi:audio-video' }[a.device_class] || (s.state === 'playing' ? 'mdi:cast-connected' : 'mdi:cast');
      if (d === 'weather') return { sunny: 'mdi:weather-sunny', 'clear-night': 'mdi:weather-night', cloudy: 'mdi:weather-cloudy', partlycloudy: 'mdi:weather-partly-cloudy', rainy: 'mdi:weather-rainy', pouring: 'mdi:weather-pouring', snowy: 'mdi:weather-snowy', fog: 'mdi:weather-fog', windy: 'mdi:weather-windy', lightning: 'mdi:weather-lightning', 'lightning-rainy': 'mdi:weather-lightning-rainy', hail: 'mdi:weather-hail', 'snowy-rainy': 'mdi:weather-snowy-rainy' }[s.state] || 'mdi:weather-partly-cloudy';
      if (d === 'sun') return s.state === 'above_horizon' ? 'mdi:white-balance-sunny' : 'mdi:weather-night';
      if (d === 'person' || d === 'device_tracker') return s.state === 'home' ? 'mdi:home-account' : a.source_type === 'router' ? 'mdi:lan-connect' : 'mdi:account';
      return DCLASS[a.device_class] || DICON[d] || 'mdi:information-outline';
    }
    stateTxt(s) {
      const d = DOM(s.entity_id), a = s.attributes;
      if (s.state === 'unknown' && ['scene', 'script', 'button', 'input_button', 'event'].includes(d)) return 'Klar';
      if (s.state === 'unavailable' || s.state === 'unknown') return ST[s.state];
      if (d === 'binary_sensor') { const b = BIN[a.device_class]; return b ? (s.state === 'on' ? b[0] : b[1]) : ST[s.state] || s.state; }
      if (d === 'light' && s.state === 'on' && a.brightness != null) return Math.round(a.brightness / 2.55) + ' %';
      if (d === 'fan' && s.state === 'on' && a.percentage != null) return a.percentage + ' %';
      if (d === 'cover' && a.current_position != null) return s.state === 'closed' ? 'Lukket' : a.current_position + ' % åpen';
      if (d === 'climate') return (HVAC[s.state] || s.state) + (a.current_temperature != null ? ' · ' + nf(a.current_temperature, 1) + '°' : '');
      if (d === 'water_heater') return (ST[s.state] || cap(s.state)) + (a.current_temperature != null ? ' · ' + nf(a.current_temperature, 0) + '°' : '');
      if (d === 'humidifier') return (ST[s.state] || s.state) + (a.humidity != null ? ' · mål ' + a.humidity + ' %' : '');
      if (d === 'media_player' && a.media_title && (s.state === 'playing' || s.state === 'paused')) return (ST[s.state]) + ' · ' + a.media_title;
      if (d === 'button' || d === 'input_button' || d === 'scene' || d === 'event') return isNaN(new Date(s.state)) ? ST[s.state] || s.state : 'Sist ' + agoT(s.state);
      if (d === 'sensor' && a.device_class === 'timestamp') return isNaN(new Date(s.state)) ? s.state : agoT(s.state);
      if (d === 'update') return s.state === 'on' ? 'Ny versjon ' + (a.latest_version || '') : 'Oppdatert';
      if (d === 'timer') return { active: 'Kjører', paused: 'Pauset', idle: 'Inaktiv' }[s.state] || s.state;
      if (d === 'person' || d === 'device_tracker') return ST[s.state] || s.state;
      if (isNum(s.state)) return s.state.replace('.', ',') + (a.unit_of_measurement ? ' ' + a.unit_of_measurement : '');
      return ST[s.state] || s.state;
    }
    accent(s) {
      const d = DOM(s.entity_id), a = s.attributes;
      if (d === 'light' && s.state === 'on') { if (a.rgb_color) return rgbS(a.rgb_color); if (a.hs_color) return rgbS(hsRgb(a.hs_color[0], a.hs_color[1])); if (a.color_temp_kelvin) return rgbS(kRgb(a.color_temp_kelvin)); return C.yellow; }
      if (d === 'climate') return HVAC_COL[s.state] || C.orange;
      if (d === 'lock') return s.state === 'locked' ? C.green : s.state === 'jammed' ? C.red : C.orange;
      if (d === 'alarm_control_panel') return s.state === 'disarmed' ? C.green : C.red;
      if (d === 'binary_sensor' && ['smoke', 'gas', 'moisture', 'problem', 'safety', 'tamper'].includes(a.device_class)) return C.red;
      return COLOR[d] || C.pink;
    }

    /* ---------- byggeklosser ---------- */
    // Slider: vertikal (v) / horisontal (h) med fyll, eller gradient (g) med knott. Verdien skrives live til [data-out=key].
    sl(o) {
      const { k, v = 0, min = 0, max = 100, step = 1, dir = 'v', col = C.yellow, icon, fmt = 'pct', u = '', label = '', live = 0, track, off } = o;
      const p = clamp((v - min) / (max - min || 1), 0, 1);
      const da = `data-sl="${k}" data-min="${min}" data-max="${max}" data-step="${step}" data-v="${v}" data-fmt="${fmt}" data-u="${esc(u)}" data-live="${live}"`;
      if (dir === 'g') return `<div class="sl g" ${da} style="background:${track}"><span class="kn" style="left:calc(22px + ${p} * (100% - 44px));background:${o.knob || '#fff'}"></span>${o.ends ? `<span class="end" style="left:16px">${o.ends[0]}</span><span class="end" style="right:16px">${o.ends[1]}</span>` : ''}</div>`;
      if (dir === 'h') return `<div class="sl h" ${da}><div class="fill" style="width:calc(56px + ${p} * (100% - 56px));background:${col};opacity:${off ? 0 : 1}"></div><span class="ico" style="color:${p > 0.4 && !off ? DARK : TX}">${icon ? `<ha-icon icon="${icon}"></ha-icon>` : ''}${esc(label)}</span><span class="vv" data-out="${k}" style="color:${p > 0.9 && !off ? DARK : TX}">${esc(this.fmt(v, fmt, u))}</span></div>`;
      return `<div class="sl v" ${da}><div class="fill" style="height:calc(60px + ${p} * (100% - 60px));background:${col};opacity:${off ? 0 : 1}"></div><span class="ico" style="color:${!off ? DARK : TX2}">${icon ? `<ha-icon icon="${icon}"></ha-icon>` : ''}</span></div>`;
    }
    fmt(v, f, u) { if (f === 'pct') return Math.round(v) + ' %'; if (f === 'deg') return nf(v, 1) + '°'; if (f === 'k') return Math.round(v) + ' K'; if (f === 'vol') return Math.round(v) + ' %'; const st = String(v).includes('.') ? String(v).split('.')[1].length : 0; return nf(Number(v), Math.min(3, st)) + (u ? ' ' + u : ''); }
    chips(list, cur, act, extra) { return `<div class="chips${list.length > 4 ? ' sc' : ''}">${list.map(([v, l, ic]) => `<button class="chip ${String(cur) === String(v) ? 'on' : ''}" data-a="${act}" data-v="${esc(v)}"${extra || ''}>${ic ? `<ha-icon icon="${ic}"></ha-icon>` : ''}${esc(l)}</button>`).join('')}</div>`; }
    svc(dom, sv, data, label, icon, cls) { return `<button class="${cls || 'act'}" data-a="svc" data-d="${dom}" data-s="${sv}" data-p="${J(data || {})}">${cls === 'cb' || (cls || '').startsWith('cb ') ? `<ha-icon icon="${icon}"></ha-icon>` : `<span class="ai"><ha-icon icon="${icon}"></ha-icon></span>${esc(label)}`}</button>`; }
    big(s, opts) {
      const on = opts && opts.on != null ? opts.on : ON(s), col = (opts && opts.col) || this.accent(s);
      return `<${opts && opts.act ? `button data-a="${opts.act}"` : 'div'} class="big${on ? ' lit' : ''}${opts && opts.pulse && on ? ' pulse' : ''}" style="background:${on ? col : SURF};color:${on ? DARK : TX};--bc:${col}">${opts && opts.img ? `<img src="${esc(opts.img)}" alt="">` : `<ha-icon icon="${(opts && opts.icon) || this.icon(s)}"${opts && opts.spin && on ? ` class="spin" style="--spd:${opts.spin}"` : ''}></ha-icon>`}</${opts && opts.act ? 'button' : 'div'}>`;
    }
    toggle(s, col) { const on = s.state === 'on'; return `<button class="tg${on ? ' on' : ''}" data-a="toggle" style="${on ? `background:${col};` : ''}--bc:${col}" aria-label="Av/på"><span class="kn"><ha-icon icon="${this.icon(s)}"></ha-icon></span></button>`; }
    kv(rows) { return `<div class="card kv">${rows.filter(Boolean).map(([k, v]) => `<div><span>${esc(k)}</span><b>${v}</b></div>`).join('')}</div>`; }
    battery(lvl) { if (lvl == null) return ''; const c = lvl < 20 ? C.red : lvl < 40 ? C.orange : C.green; return `<div class="bat"><ha-icon icon="mdi:battery${lvl >= 95 ? '' : lvl < 10 ? '-outline' : '-' + Math.round(lvl / 10) * 10}"></ha-icon><span class="b"><i style="width:${lvl}%;background:${c}"></i></span>${lvl} %</div>`; }
    ring(pct, col, inner, cls) { const r = 96, c = 2 * Math.PI * r; return `<div class="ring ${cls || ''}"><svg viewBox="0 0 220 220"><circle cx="110" cy="110" r="${r}" stroke="${SURF}" stroke-width="14"></circle><circle cx="110" cy="110" r="${r}" stroke="${col}" stroke-width="14" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - clamp(pct, 0, 1))).toFixed(1)}"></circle></svg><div class="mid">${inner}</div></div>`; }

    /* ---------- kontroll per domene ---------- */
    ctl(s) {
      const d = DOM(s.entity_id), a = s.attributes, on = ON(s), un = s.state === 'unavailable';
      if (un) return `${this.big(s, { on: false })}<div class="val m">Utilgjengelig</div><div class="note">Enheten svarer ikke. Sist endret ${agoT(s.last_changed)}.</div>`;
      const fn = this['c_' + d];
      if (fn) return fn.call(this, s, a, on, d);
      if (isNum(s.state)) return this.c_sensor(s, a);
      return `${this.big(s)}<div class="val m">${esc(this.stateTxt(s))}</div><div class="sub">Endret ${agoT(s.last_changed)}</div>`;
    }
    c_light(s, a) {
      const isOn = s.state === 'on', b = isOn ? Math.max(1, Math.round((a.brightness != null ? a.brightness : 255) / 2.55)) : 0;
      const modes = a.supported_color_modes || [];
      const dim = modes.some((m) => m !== 'onoff') || a.brightness != null;
      const col = modes.some((m) => ['rgb', 'rgbw', 'rgbww', 'hs', 'xy'].includes(m)), ct = modes.includes('color_temp') || col;
      const acc = this.accent(s);
      const view = this.ui.lv || (a.color_mode && ['rgb', 'rgbw', 'rgbww', 'hs', 'xy'].includes(a.color_mode) ? 'col' : 'bri');
      let html = `<div class="val">${isOn ? (dim ? b : 'På') : 'Av'}${isOn && dim ? '<small>%</small>' : ''}</div><div class="sub">${isOn ? (a.color_temp_kelvin && a.color_mode === 'color_temp' ? `<ha-icon icon="mdi:thermometer"></ha-icon>${a.color_temp_kelvin} K` : a.effect && a.effect !== 'none' ? `<ha-icon icon="mdi:auto-fix"></ha-icon>${esc(a.effect)}` : 'Dra for lysstyrke') : 'Trykk eller dra for å slå på'}</div>`;
      if (!dim) return html + `<div class="glow" style="--gc:${acc};--go:${isOn ? 0.55 : 0}">${this.toggle(s, acc)}</div>`;
      const tabs = [['bri', 'Lysstyrke', 'mdi:brightness-6']].concat(ct ? [['ct', 'Hvit', 'mdi:thermometer']] : []).concat(col ? [['col', 'Farge', 'mdi:palette']] : []);
      const v = tabs.some((t) => t[0] === view) ? view : 'bri';
      if (v === 'bri') html += `<div class="glow" style="--gc:${acc};--go:${isOn ? 0.25 + b / 200 : 0}">${this.sl({ k: 'bri', v: b, min: 0, max: 100, col: acc, icon: 'mdi:lightbulb', live: 1, off: !isOn })}</div>`;
      if (v === 'ct') {
        const mn = a.min_color_temp_kelvin || CT_MIN, mx = a.max_color_temp_kelvin || CT_MAX, k = a.color_temp_kelvin || Math.round((mn + mx) / 2);
        html += `<div class="glow" style="--gc:${rgbS(kRgb(k))};--go:${isOn ? 0.5 : 0};width:100%;padding:30px 0 10px"><div class="val m" data-out="ct">${k} K</div></div>${this.sl({ k: 'ct', v: k, min: mn, max: mx, step: 50, dir: 'g', fmt: 'k', track: `linear-gradient(90deg,${rgbS(kRgb(mn))},${rgbS(kRgb((mn + mx) / 2))},${rgbS(kRgb(mx))})`, knob: rgbS(kRgb(k)), ends: ['Varm', 'Kald'] })}
          ${this.sl({ k: 'bri', v: b, dir: 'h', col: acc, icon: 'mdi:brightness-6', label: 'Lysstyrke', live: 1, off: !isOn })}
          <div class="chips">${[2200, 2700, 3500, 4500, 6000].filter((x) => x >= mn - 100 && x <= mx + 100).map((x) => `<button class="sw ${Math.abs(k - x) < 120 && a.color_mode === 'color_temp' ? 'on' : ''}" data-a="ct" data-v="${x}" style="background:${rgbS(kRgb(x))}" aria-label="${x} K"></button>`).join('')}</div>`;
      }
      if (v === 'col') {
        const hs = a.hs_color || (a.rgb_color ? rgbHs(a.rgb_color) : [0, 0]);
        const R = 50, ang = (hs[0] * Math.PI) / 180, rr = (hs[1] / 100) * R;
        const kc = rgbS(hsRgb(hs[0], hs[1]));
        html += `<div class="glow" style="--gc:${kc};--go:${isOn ? 0.45 : 0}"><div class="wheel" data-wheel="1"><span class="kn" style="left:${(50 + Math.cos(ang) * rr).toFixed(2)}%;top:${(50 + Math.sin(ang) * rr).toFixed(2)}%;background:${kc}"></span></div></div>
          ${this.sl({ k: 'bri', v: b, dir: 'h', col: acc, icon: 'mdi:brightness-6', label: 'Lysstyrke', live: 1, off: !isOn })}
          <div class="chips">${[[0, 85], [25, 80], [45, 90], [130, 60], [195, 60], [230, 70], [280, 55], [325, 55]].map(([h, sat]) => `<button class="sw ${Math.abs(hs[0] - h) < 6 && Math.abs(hs[1] - sat) < 8 ? 'on' : ''}" data-a="hs" data-v="${h},${sat}" style="background:${rgbS(hsRgb(h, sat))}" aria-label="Farge"></button>`).join('')}</div>`;
      }
      html += `<div class="row">${tabs.length > 1 ? tabs.map(([k, l, ic]) => `<button class="cb sm${v === k ? ' on' : ''}" data-a="lv" data-v="${k}" aria-label="${l}"><ha-icon icon="${ic}"></ha-icon></button>`).join('') : ''}<button class="cb" data-a="toggle" style="${isOn ? `background:${acc};color:${DARK};box-shadow:0 0 24px -4px ${acc}` : ''}" aria-label="Av/på"><ha-icon icon="mdi:power"></ha-icon></button></div>`;
      if (a.effect_list && a.effect_list.length) html += `<div class="lbl">Effekter<span>${a.effect_list.length}</span></div>${this.chips(a.effect_list.map((e) => [e, e === 'none' ? 'Ingen' : e, 'mdi:auto-fix']), a.effect || 'none', 'effect')}`;
      return html;
    }
    c_fan(s, a) {
      const isOn = s.state === 'on', p = isOn ? (a.percentage != null ? a.percentage : 100) : 0, st = a.percentage_step || 1;
      const hasSpeed = a.percentage != null || F(s, 1);
      let html = `<div class="val">${isOn ? (hasSpeed ? p : 'På') : 'Av'}${isOn && hasSpeed ? '<small>%</small>' : ''}</div><div class="sub">${isOn ? `<ha-icon icon="mdi:fan" class="spin" style="--spd:${(1.6 - p / 80).toFixed(2)}s"></ha-icon>${a.preset_mode ? esc(PRESET[a.preset_mode] || a.preset_mode) : 'Går'}` : 'Stoppet'}</div>`;
      html += hasSpeed ? `<div class="glow" style="--gc:${C.blue};--go:${isOn ? 0.2 + p / 300 : 0}">${this.sl({ k: 'fan', v: p, step: Math.max(1, Math.round(st)), col: C.blue, icon: 'mdi:fan', off: !isOn })}</div>` : `<div class="glow" style="--gc:${C.blue};--go:${isOn ? 0.4 : 0}">${this.toggle(s, C.blue)}</div>`;
      const btn = (act, ic, onx, lab, data) => `<button class="cb${onx ? ' on' : ''}" data-a="${act}" ${data || ''} aria-label="${lab}"><ha-icon icon="${ic}"></ha-icon></button>`;
      html += `<div class="row">${hasSpeed ? btn('fanstep', 'mdi:minus', false, 'Saktere', 'data-v="-1"') : ''}${btn('toggle', 'mdi:power', isOn, 'Av/på')}${hasSpeed ? btn('fanstep', 'mdi:plus', false, 'Raskere', 'data-v="1"') : ''}</div>`;
      const ex = [];
      if (a.oscillating != null || F(s, 2)) ex.push(`<button class="act${a.oscillating ? ' on' : ''}" data-a="svc" data-d="fan" data-s="oscillate" data-p="${J({ oscillating: !a.oscillating })}"><span class="ai"><ha-icon icon="mdi:arrow-oscillating"></ha-icon></span>Sving</button>`);
      if (a.direction != null || F(s, 4)) ex.push(`<button class="act" data-a="svc" data-d="fan" data-s="set_direction" data-p="${J({ direction: a.direction === 'forward' ? 'reverse' : 'forward' })}"><span class="ai"><ha-icon icon="${a.direction === 'reverse' ? 'mdi:rotate-left' : 'mdi:rotate-right'}"></ha-icon></span>${a.direction === 'reverse' ? 'Revers' : 'Forover'}</button>`);
      if (ex.length) html += `<div class="acts">${ex.join('')}</div>`;
      if (a.preset_modes && a.preset_modes.length) html += `<div class="lbl">Modus</div>${this.chips(a.preset_modes.map((m) => [m, PRESET[m] || cap(m)]), a.preset_mode, 'svcv', ' data-d="fan" data-s="set_preset_mode" data-f="preset_mode"')}`;
      return html;
    }
    c_cover(s, a) {
      const dc = a.device_class, pos = a.current_position, hasPos = pos != null || F(s, 4), p = pos != null ? pos : s.state === 'open' ? 100 : 0;
      const moving = s.state === 'opening' || s.state === 'closing';
      let html = `<div class="val">${hasPos ? p + '<small>%</small>' : esc(ST[s.state] || s.state)}</div><div class="sub">${moving ? `<ha-icon icon="${s.state === 'opening' ? 'mdi:arrow-up' : 'mdi:arrow-down'}" class="pulse"></ha-icon>${ST[s.state]}` : s.state === 'closed' ? 'Lukket' : hasPos ? 'Åpen' : 'Endret ' + agoT(s.last_changed)}</div>`;
      html += hasPos ? this.sl({ k: 'pos', v: p, col: C.pink, icon: this.icon(s) }) : this.big(s, { col: C.pink, act: 'toggle' });
      html += `<div class="row">${this.svc('cover', 'open_cover', {}, '', 'mdi:arrow-up', 'cb')}${F(s, 8) || !a.supported_features ? this.svc('cover', 'stop_cover', {}, '', 'mdi:stop', 'cb')  : ''}${this.svc('cover', 'close_cover', {}, '', 'mdi:arrow-down', 'cb')}</div>`;
      if (a.current_tilt_position != null || F(s, 128)) {
        const t = a.current_tilt_position || 0;
        html += `<div class="lbl">Vinkel<span data-out="tilt">${t} %</span></div>${this.sl({ k: 'tilt', v: t, dir: 'h', col: C.pink, icon: 'mdi:angle-acute', label: 'Lameller' })}<div class="row">${this.svc('cover', 'open_cover_tilt', {}, '', 'mdi:arrow-top-right', 'cb sm')}${this.svc('cover', 'stop_cover_tilt', {}, '', 'mdi:stop', 'cb sm')}${this.svc('cover', 'close_cover_tilt', {}, '', 'mdi:arrow-bottom-left', 'cb sm')}</div>`;
      }
      if (hasPos) html += `<div class="chips">${[0, 25, 50, 75, 100].map((x) => `<button class="chip ${p === x ? 'on' : ''}" data-a="svc" data-d="cover" data-s="set_cover_position" data-p="${J({ position: x })}">${x === 0 ? 'Lukket' : x === 100 ? 'Åpen' : x + ' %'}</button>`).join('')}</div>`;
      return html;
    }
    dial(s, t, mn, mx, col, sub) {
      const A0 = 135, SW = 270, R = 118, cx = 140, cy = 140;
      const pt = (deg) => { const r = (deg * Math.PI) / 180; return [cx + R * Math.cos(r), cy + R * Math.sin(r)]; };
      const arc = (a0, a1) => { const [x0, y0] = pt(a0), [x1, y1] = pt(a1); return `M${x0.toFixed(1)} ${y0.toFixed(1)} A${R} ${R} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`; };
      const f = t == null ? 0 : clamp((t - mn) / (mx - mn), 0, 1), ang = A0 + SW * f, [kx, ky] = pt(ang);
      const cur = s.attributes.current_temperature, cf = cur != null ? clamp((cur - mn) / (mx - mn), 0, 1) : null;
      const [ox, oy] = cf != null ? pt(A0 + SW * cf) : [0, 0];
      const ticks = Array.from({ length: 28 }, (_, i) => { const dd = A0 + (SW * i) / 27, r1 = R - 22, r2 = R - (i % 3 ? 26 : 30), rd = (dd * Math.PI) / 180; return `<line x1="${(cx + r1 * Math.cos(rd)).toFixed(1)}" y1="${(cy + r1 * Math.sin(rd)).toFixed(1)}" x2="${(cx + r2 * Math.cos(rd)).toFixed(1)}" y2="${(cy + r2 * Math.sin(rd)).toFixed(1)}" stroke="${CTRL}" stroke-width="2" stroke-linecap="round"></line>`; }).join('');
      return `<div class="dial" data-dial="1" data-min="${mn}" data-max="${mx}" data-step="${s.attributes.target_temp_step || 0.5}" data-v="${t == null ? '' : t}"><svg viewBox="0 0 280 280">
        <defs><filter id="gl" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="7"></feGaussianBlur></filter></defs>
        ${ticks}<path d="${arc(A0, A0 + SW)}" stroke="${SURF}" stroke-width="22" fill="none" stroke-linecap="round"></path>
        ${t != null ? `<path class="arc" d="${arc(A0, Math.max(A0 + 0.5, ang))}" stroke="${col}" stroke-width="22" fill="none" stroke-linecap="round" opacity=".35" filter="url(#gl)"></path><path class="arc" d="${arc(A0, Math.max(A0 + 0.5, ang))}" stroke="${col}" stroke-width="22" fill="none" stroke-linecap="round"></path>` : ''}
        ${cf != null ? `<circle cx="${ox.toFixed(1)}" cy="${oy.toFixed(1)}" r="4" fill="${TX}"></circle>` : ''}
        ${t != null ? `<circle cx="${kx.toFixed(1)}" cy="${ky.toFixed(1)}" r="15" fill="#fff" stroke="${col}" stroke-width="4"></circle>` : ''}
      </svg><div class="mid"><div class="sub">${sub || ''}</div><div class="val" data-out="dial">${t != null ? nf(t, (s.attributes.target_temp_step || 0.5) < 1 ? 1 : 0) : '–'}<small>°</small></div><div class="sub">${cur != null ? 'Nå ' + nf(cur, 1) + '°' : ''}${s.attributes.current_humidity != null ? ' · ' + s.attributes.current_humidity + ' %' : ''}</div></div></div>`;
    }
    c_climate(s, a) {
      const mn = a.min_temp != null ? a.min_temp : 7, mx = a.max_temp != null ? a.max_temp : 35, col = s.state === 'off' ? CTRL : HVAC_COL[s.state] || C.orange;
      const ac = ACT[a.hvac_action] || [HVAC[s.state] || s.state, HVAC_IC[s.state] || 'mdi:thermostat', null];
      const sub = `<span style="display:flex;align-items:center;gap:6px;color:${ac[2] || TXM}"><ha-icon icon="${ac[1]}"${a.hvac_action === 'heating' || a.hvac_action === 'cooling' ? ' class="blink"' : ''}></ha-icon>${ac[0]}</span>`;
      let html = '';
      const dual = a.target_temp_low != null && a.target_temp_high != null && a.temperature == null;
      if (dual) {
        html += `<div class="hero">${this.ring(0, col, `<div class="sub">${sub}</div><div class="val">${a.current_temperature != null ? nf(a.current_temperature, 1) : '–'}<small>°</small></div>`)}</div>
          <div class="acts">${[['target_temp_low', 'Varme fra', C.orange], ['target_temp_high', 'Kjøling fra', C.blue]].map(([k, l, c]) => `<div class="card" style="display:flex;flex-direction:column;align-items:center;gap:8px;padding:14px"><span style="font-size:13px;color:${c}">${l}</span><span class="val m">${nf(a[k], 1)}°</span><div class="row"><button class="cb sm" data-a="temp2" data-f="${k}" data-v="-1"><ha-icon icon="mdi:minus"></ha-icon></button><button class="cb sm" data-a="temp2" data-f="${k}" data-v="1"><ha-icon icon="mdi:plus"></ha-icon></button></div></div>`).join('')}</div>`;
      } else {
        html += `<div class="glow" style="--gc:${col};--go:${s.state === 'off' ? 0 : 0.28}">${this.dial(s, a.temperature, mn, mx, col, sub)}</div>
          <div class="row"><button class="cb" data-a="temp" data-v="-1" aria-label="Ned"><ha-icon icon="mdi:minus"></ha-icon></button><button class="cb" data-a="temp" data-v="1" aria-label="Opp"><ha-icon icon="mdi:plus"></ha-icon></button></div>`;
      }
      const modes = a.hvac_modes || ['off', 'heat'];
      html += `<div class="acts${modes.length === 3 ? ' three' : ''}">${modes.map((m) => `<button class="act${s.state === m ? ' on' : ''}" data-a="svcv" data-d="climate" data-s="set_hvac_mode" data-f="hvac_mode" data-v="${m}"><span class="ai"><ha-icon icon="${HVAC_IC[m] || 'mdi:thermostat'}"></ha-icon></span>${HVAC[m] || m}</button>`).join('')}</div>`;
      if (a.preset_modes && a.preset_modes.length) html += `<div class="lbl">Forhåndsvalg</div>${this.chips(a.preset_modes.map((m) => [m, PRESET[m] || cap(m)]), a.preset_mode, 'svcv', ' data-d="climate" data-s="set_preset_mode" data-f="preset_mode"')}`;
      if (a.fan_modes && a.fan_modes.length) html += `<div class="lbl">Vifte</div>${this.chips(a.fan_modes.map((m) => [m, PRESET[m] || cap(m), 'mdi:fan']), a.fan_mode, 'svcv', ' data-d="climate" data-s="set_fan_mode" data-f="fan_mode"')}`;
      if (a.swing_modes && a.swing_modes.length) html += `<div class="lbl">Luftretning</div>${this.chips(a.swing_modes.map((m) => [m, PRESET[m] || cap(m), 'mdi:arrow-oscillating']), a.swing_mode, 'svcv', ' data-d="climate" data-s="set_swing_mode" data-f="swing_mode"')}`;
      if (a.target_humidity != null) html += `<div class="lbl">Ønsket fukt</div>${this.sl({ k: 'chum', v: a.target_humidity, min: a.min_humidity || 30, max: a.max_humidity || 99, dir: 'h', col: C.blue, icon: 'mdi:water-percent', label: 'Fukt' })}`;
      const diff = a.temperature != null && a.current_temperature != null ? a.temperature - a.current_temperature : null;
      html = this.stats([['mdi:thermometer', 'Nå', a.current_temperature != null ? nf(a.current_temperature, 1) : '–', '°'], a.current_humidity != null ? ['mdi:water-percent', 'Fukt', a.current_humidity, '%'] : null, ['mdi:target', 'Mål', a.temperature != null ? nf(a.temperature, 1) : a.target_temp_low != null ? nf(a.target_temp_low, 0) + '–' + nf(a.target_temp_high, 0) : '–', '°'], diff != null ? ['mdi:swap-vertical', s.state === 'off' ? 'Av' : Math.abs(diff) < 0.3 ? 'Holder' : diff > 0 ? 'Opp' : 'Ned', (diff > 0 ? '+' : '') + nf(diff, 1), '°'] : null]) + html;
      html += this.relHtml(this.related(s, ['temperature', 'humidity', 'carbon_dioxide', 'power', 'energy', 'battery', 'window', 'door']), 'Sensorer i rommet');
      return html;
    }
    c_water_heater(s, a) {
      const mn = a.min_temp != null ? a.min_temp : 30, mx = a.max_temp != null ? a.max_temp : 90, col = s.state === 'off' ? CTRL : C.orange;
      let html = `<div class="glow" style="--gc:${col};--go:${s.state === 'off' ? 0 : 0.25}">${this.dial(s, a.temperature, mn, mx, col, `<span style="color:${TXM}">${esc(ST[a.operation_mode || s.state] || cap(a.operation_mode || s.state))}</span>`)}</div><div class="row"><button class="cb" data-a="temp" data-v="-1"><ha-icon icon="mdi:minus"></ha-icon></button><button class="cb" data-a="temp" data-v="1"><ha-icon icon="mdi:plus"></ha-icon></button></div>`;
      if (a.operation_list) html += `<div class="lbl">Driftsmodus</div>${this.chips(a.operation_list.map((m) => [m, ST[m] || cap(m), m === 'off' ? 'mdi:power' : 'mdi:water-boiler']), a.operation_mode || s.state, 'svcv', ' data-d="water_heater" data-s="set_operation_mode" data-f="operation_mode"')}`;
      if (a.away_mode != null) html += `<div class="acts"><button class="act${a.away_mode === 'on' ? ' on' : ''}" data-a="svc" data-d="water_heater" data-s="set_away_mode" data-p="${J({ away_mode: a.away_mode !== 'on' })}"><span class="ai"><ha-icon icon="mdi:airplane"></ha-icon></span>Borte</button></div>`;
      return html;
    }
    c_humidifier(s, a) {
      const isOn = s.state === 'on', h = a.humidity != null ? a.humidity : 50;
      let html = `<div class="val">${h}<small>%</small></div><div class="sub">${a.current_humidity != null ? 'Nå ' + a.current_humidity + ' % · ' : ''}${isOn ? (a.action === 'drying' ? 'Avfukter' : a.action === 'humidifying' ? 'Fukter' : 'På') : 'Av'}</div>`;
      html += `<div class="glow" style="--gc:${C.blue};--go:${isOn ? 0.35 : 0}">${this.sl({ k: 'hum', v: h, min: a.min_humidity || 0, max: a.max_humidity || 100, col: C.blue, icon: 'mdi:water-percent', off: !isOn })}</div>`;
      html += `<div class="row"><button class="cb${isOn ? ' on' : ''}" data-a="toggle"><ha-icon icon="mdi:power"></ha-icon></button></div>`;
      if (a.available_modes) html += `<div class="lbl">Modus</div>${this.chips(a.available_modes.map((m) => [m, PRESET[m] || cap(m)]), a.mode, 'svcv', ' data-d="humidifier" data-s="set_mode" data-f="mode"')}`;
      return html;
    }
    c_switch(s, a) {
      const col = this.accent(s);
      return `<div class="val m">${s.state === 'on' ? 'På' : 'Av'}</div><div class="glow" style="--gc:${col};--go:${s.state === 'on' ? 0.35 : 0}">${this.toggle(s, col)}</div>${a.current_power_w != null ? `<div class="sub"><ha-icon icon="mdi:flash"></ha-icon>${a.current_power_w} W</div>` : ''}<div class="sub">Endret ${agoT(s.last_changed)}</div>`;
    }
    c_input_boolean(s, a) { return this.c_switch(s, a); }
    c_group(s, a) {
      const ids = a.entity_id || [], h = this.hass;
      return `${['on', 'off'].includes(s.state) ? this.c_switch(s, a) : this.big(s) + `<div class="val m">${esc(this.stateTxt(s))}</div>`}${ids.length ? `<div class="card"><h4>Medlemmer<span>${ids.length}</span></h4>${ids.map((id) => { const x = h.states[id]; return x ? `<button class="opt${ON(x) ? ' on' : ''}" data-a="goto" data-v="${esc(id)}"><span class="ck"><ha-icon icon="mdi:check"></ha-icon></span><span style="flex:1">${esc(x.attributes.friendly_name || id)}</span><em style="font-style:normal;color:${TXM};font-size:13px">${esc(this.stateTxt(x))}</em></button>` : ''; }).join('')}</div>` : ''}`;
    }
    c_automation(s, a) {
      const col = C.purple;
      return `<div class="val m">${s.state === 'on' ? 'Aktivert' : 'Deaktivert'}</div><div class="glow" style="--gc:${col};--go:${s.state === 'on' ? 0.35 : 0}">${this.toggle(s, col)}</div>
        <button class="btn" data-a="svc" data-d="automation" data-s="trigger" data-p="${J({ skip_condition: true })}"><ha-icon icon="mdi:play"></ha-icon>Kjør handlingene nå</button>
        ${this.kv([['Sist utløst', a.last_triggered ? esc(agoT(a.last_triggered)) : 'Aldri'], a.mode ? ['Modus', esc(a.mode)] : null, a.current ? ['Kjører nå', esc(a.current)] : null])}`;
    }
    c_script(s, a) {
      const run = s.state === 'on';
      return `${this.big(s, { on: run, col: C.purple, act: run ? 'svcoff' : 'run', pulse: true })}<div class="val m">${run ? 'Kjører …' : 'Klar'}</div><div class="note">${run ? 'Trykk for å stoppe skriptet' : 'Trykk for å kjøre skriptet'}</div>
        ${this.kv([['Sist kjørt', a.last_triggered ? esc(agoT(a.last_triggered)) : 'Aldri'], a.mode ? ['Modus', esc(a.mode)] : null])}`;
    }
    c_scene(s) {
      return `<button class="big" data-a="run" style="background:${PK};color:var(--ki-on-accent, #2a1720)"><ha-icon icon="${this.icon(s)}"></ha-icon></button><div class="val m">Aktiver scene</div><div class="note">${isNaN(new Date(s.state)) ? '' : 'Sist aktivert ' + agoT(s.state)}</div>`;
    }
    c_button(s, a, on, d) {
      return `<button class="big" data-a="press" style="background:${SURF};color:${TX}"><ha-icon icon="${this.icon(s)}"></ha-icon></button><div class="val m">Trykk</div><div class="note">${isNaN(new Date(s.state)) ? 'Aldri trykket' : 'Sist trykket ' + agoT(s.state)}</div>`;
    }
    c_input_button(s, a, on, d) { return this.c_button(s, a, on, d); }
    c_lock(s, a) {
      const lk = s.state === 'locked', busy = s.state === 'locking' || s.state === 'unlocking', col = this.accent(s);
      return `<div class="glow" style="--gc:${col};--go:.35">${this.big(s, { on: true, col, act: 'lock', pulse: busy })}</div><div class="val m">${ST[s.state] || s.state}</div><div class="note">${s.state === 'jammed' ? 'Låsen sitter fast – sjekk døra' : busy ? 'Vent litt …' : 'Trykk for å ' + (lk ? 'låse opp' : 'låse')}</div>
        <div class="acts">${this.svc('lock', 'lock', {}, 'Lås', 'mdi:lock')}${this.svc('lock', 'unlock', {}, 'Lås opp', 'mdi:lock-open-variant')}</div>${F(s, 1) ? `<button class="btn ghost" data-a="svc" data-d="lock" data-s="open" data-p="{}"><ha-icon icon="mdi:door-open"></ha-icon>Åpne døra</button>` : ''}
        ${a.changed_by ? this.kv([['Endret av', esc(a.changed_by)]]) : ''}`;
    }
    mediaPos(a, s) { if (a.media_duration == null || a.media_position == null) return null; let p = a.media_position; if (s.state === 'playing' && a.media_position_updated_at) p += (Date.now() - new Date(a.media_position_updated_at).getTime()) / 1000; return clamp(p, 0, a.media_duration); }
    c_media_player(s, a) {
      const pl = s.state === 'playing', off = s.state === 'off' || s.state === 'standby', vol = Math.round((a.volume_level || 0) * 100), src = a.source_list || [];
      const pic = a.entity_picture_local || a.entity_picture;
      const pos = this.mediaPos(a, s);
      let html = `<div class="mhero">${pic ? `<span class="bgimg" style="background-image:url('${esc(pic)}')"></span>` : ''}<span class="cov${pl ? '' : ' pz'}">${pic ? `<img src="${esc(pic)}" alt="">` : `<ha-icon icon="${this.icon(s)}"></ha-icon>`}</span><span class="mi2"><em>${pl ? '<span class="eq" style="margin-right:6px"><i></i><i></i><i></i></span>' : ''}${esc(off ? 'Av' : a.app_name || ST[s.state] || s.state)}</em><b data-noi18n>${esc(a.media_title || (off ? 'Ingenting spilles' : a.source || 'Klar'))}</b><span data-noi18n>${esc([a.media_artist || a.media_series_title, a.media_album_name || (a.media_season ? 'S' + a.media_season + ' E' + (a.media_episode || '') : '')].filter(Boolean).join(' · '))}</span></span></div>`;
      if (pos != null) html += `<div class="prog"><div class="bar" data-seek="${a.media_duration}"><i style="width:${((pos / a.media_duration) * 100).toFixed(2)}%"></i></div><div class="t"><span>${dur(pos)}</span><span>−${dur(a.media_duration - pos)}</span></div></div>`;
      html += `<div class="row">${a.shuffle != null ? `<button class="cb sm${a.shuffle ? ' on' : ''}" data-a="svc" data-d="media_player" data-s="shuffle_set" data-p="${J({ shuffle: !a.shuffle })}"><ha-icon icon="mdi:shuffle-variant"></ha-icon></button>` : ''}${this.svc('media_player', 'media_previous_track', {}, '', 'mdi:skip-previous', 'cb')}<button class="cb pri" data-a="svc" data-d="media_player" data-s="media_play_pause" data-p="{}"><ha-icon icon="${pl ? 'mdi:pause' : 'mdi:play'}"></ha-icon></button>${this.svc('media_player', 'media_next_track', {}, '', 'mdi:skip-next', 'cb')}${a.repeat != null ? `<button class="cb sm${a.repeat !== 'off' ? ' on' : ''}" data-a="svc" data-d="media_player" data-s="repeat_set" data-p="${J({ repeat: a.repeat === 'off' ? 'all' : a.repeat === 'all' ? 'one' : 'off' })}"><ha-icon icon="${a.repeat === 'one' ? 'mdi:repeat-once' : 'mdi:repeat'}"></ha-icon></button>` : ''}</div>`;
      html += `<div class="row" style="flex-wrap:nowrap;gap:8px"><button class="cb sm" data-a="svc" data-d="media_player" data-s="volume_mute" data-p="${J({ is_volume_muted: !a.is_volume_muted })}"><ha-icon icon="${a.is_volume_muted ? 'mdi:volume-off' : vol < 35 ? 'mdi:volume-low' : 'mdi:volume-high'}"></ha-icon></button><div style="flex:1">${this.sl({ k: 'vol', v: a.is_volume_muted ? 0 : vol, dir: 'h', col: C.pink, icon: 'mdi:volume-high', label: 'Volum', fmt: 'vol', live: 1 })}</div></div>`;
      html += `<div class="vsteps">${[['-', 'mdi:volume-minus', 'volume_down'], ['+', 'mdi:volume-plus', 'volume_up']].map(([k, ic, sv]) => `<button class="chip" style="flex:1;justify-content:center" data-a="svc" data-d="media_player" data-s="${sv}" data-p="{}"><ha-icon icon="${ic}"></ha-icon>${k === '-' ? 'Lavere' : 'Høyere'}</button>`).join('')}<button class="chip" style="flex:1;justify-content:center" data-a="browse"><ha-icon icon="mdi:play-box-multiple-outline"></ha-icon>Bla i media</button></div>`;
      if (a.group_members && a.group_members.length > 1) html += `<div class="lbl">Spiller i gruppe<span>${a.group_members.length}</span></div><div class="grpm">${a.group_members.map((m) => `<button class="chip${m === s.entity_id ? ' on' : ''}" data-a="goto" data-v="${esc(m)}"><ha-icon icon="mdi:speaker"></ha-icon><span data-noi18n>${esc((this.hass.states[m] && this.hass.states[m].attributes.friendly_name) || m)}</span></button>`).join('')}</div>`;
      if (src.length) html += `<div class="lbl">Kilde</div>${this.chips(src.map((x) => [x, x, 'mdi:import']), a.source, 'svcv', ' data-d="media_player" data-s="select_source" data-f="source"')}`;
      if (a.sound_mode_list && a.sound_mode_list.length) html += `<div class="lbl">Lydmodus</div>${this.chips(a.sound_mode_list.map((x) => [x, x, 'mdi:equalizer']), a.sound_mode, 'svcv', ' data-d="media_player" data-s="select_sound_mode" data-f="sound_mode"')}`;
      html += this.relHtml(this.related(s, ['power', 'energy', 'sound_pressure', 'signal_strength']), 'Sensorer');
      html += `<div class="row"><button class="chip" data-a="svc" data-d="media_player" data-s="${off ? 'turn_on' : 'turn_off'}" data-p="{}"><ha-icon icon="mdi:power"></ha-icon>${off ? 'Slå på' : 'Slå av'}</button></div>`;
      return html;
    }
    c_alarm_control_panel(s, a) {
      const armed = s.state !== 'disarmed', alert = s.state === 'triggered', busy = s.state === 'arming' || s.state === 'pending' || s.state === 'disarming';
      const f = a.supported_features;
      const A = [['alarm_arm_home', 'Hjemme', 'mdi:home-lock', 'armed_home', 1], ['alarm_arm_away', 'Borte', 'mdi:shield-lock', 'armed_away', 2], ['alarm_arm_night', 'Natt', 'mdi:weather-night', 'armed_night', 4], ['alarm_arm_vacation', 'Ferie', 'mdi:airplane-takeoff', 'armed_vacation', 32], ['alarm_arm_custom_bypass', 'Egendef.', 'mdi:shield-edit', 'armed_custom_bypass', 16]].filter((x) => f == null ? x[4] <= 4 : f & x[4]);
      const code = this.ui.code || '', needCode = a.code_format;
      let html = `<div class="glow" style="--gc:${armed ? C.red : C.green};--go:${alert ? 0.6 : 0.3}">${this.big(s, { on: true, col: armed ? C.red : C.green, icon: alert ? 'mdi:bell-ring' : armed ? 'mdi:shield-lock' : 'mdi:shield-off-outline', pulse: alert || busy })}</div><div class="val m">${ST[s.state] || s.state}</div>`;
      if (needCode) html += `<div class="dots">${Array.from({ length: Math.max(4, code.length) }, (_, i) => `<i class="${i < code.length ? 'f' : ''}"></i>`).join('')}</div><div class="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 'c', 0, 'b'].map((k) => `<button data-a="key" data-v="${k}">${k === 'c' ? '<ha-icon icon="mdi:close"></ha-icon>' : k === 'b' ? '<ha-icon icon="mdi:backspace-outline"></ha-icon>' : k}</button>`).join('')}</div>`;
      html += `<div class="acts">${armed ? `<button class="act" data-a="alarm" data-s="alarm_disarm" style="grid-column:1/-1"><span class="ai"><ha-icon icon="mdi:shield-off-outline"></ha-icon></span>Slå av alarmen</button>` : A.map(([sv, l, ic, stt]) => `<button class="act ${s.state === stt ? 'on' : ''}" data-a="alarm" data-s="${sv}"><span class="ai"><ha-icon icon="${ic}"></ha-icon></span>${l}</button>`).join('')}</div>`;
      return html;
    }
    c_vacuum(s, a) {
      const cl = s.state === 'cleaning', col = cl ? C.green : s.state === 'error' ? C.red : SURF, b = a.battery_level;
      let html = b != null ? `<div class="hero">${this.ring(b / 100, b < 20 ? C.red : C.green, `<ha-icon icon="mdi:robot-vacuum" class="${cl ? 'ring-pulse' : ''}" style="--mdc-icon-size:56px;color:${cl ? C.green : TX}"></ha-icon><div class="val m" style="margin-top:6px">${ST[s.state] || s.state}</div><div class="sub" style="margin:0">Batteri ${b} %</div>`)}</div>` : `${this.big(s, { on: cl, col: C.green, pulse: cl })}<div class="val m">${ST[s.state] || s.state}</div>`;
      if (a.status) html += `<div class="sub">${esc(a.status)}</div>`;
      html += `<div class="acts">${cl ? this.svc('vacuum', 'pause', {}, 'Pause', 'mdi:pause') : this.svc('vacuum', 'start', {}, 'Start', 'mdi:play')}${this.svc('vacuum', 'return_to_base', {}, 'Til lading', 'mdi:home-import-outline')}${this.svc('vacuum', 'stop', {}, 'Stopp', 'mdi:stop')}${this.svc('vacuum', 'locate', {}, 'Finn', 'mdi:map-marker-radius')}${this.svc('vacuum', 'clean_spot', {}, 'Punkt', 'mdi:target')}</div>`;
      if (a.fan_speed_list && a.fan_speed_list.length) html += `<div class="lbl">Sugekraft</div>${this.chips(a.fan_speed_list.map((x) => [x, PRESET[String(x).toLowerCase()] || cap(String(x)), 'mdi:fan']), a.fan_speed, 'svcv', ' data-d="vacuum" data-s="set_fan_speed" data-f="fan_speed"')}`;
      return html;
    }
    c_lawn_mower(s, a) {
      const m = s.state === 'mowing';
      return `${this.big(s, { on: m, col: C.lime, pulse: m })}<div class="val m">${ST[s.state] || s.state}</div>${this.battery(a.battery_level)}<div class="acts three">${this.svc('lawn_mower', 'start_mowing', {}, 'Klipp', 'mdi:play')}${this.svc('lawn_mower', 'pause', {}, 'Pause', 'mdi:pause')}${this.svc('lawn_mower', 'dock', {}, 'Lad', 'mdi:home-import-outline')}</div>`;
    }
    c_valve(s, a) {
      const op = s.state === 'open' || s.state === 'opening';
      if (a.current_position != null) return `<div class="val">${a.current_position}<small>%</small></div><div class="sub">${ST[s.state] || s.state}</div>${this.sl({ k: 'vpos', v: a.current_position, col: C.blue, icon: 'mdi:valve' })}<div class="row">${this.svc('valve', 'open_valve', {}, '', 'mdi:valve-open', 'cb')}${this.svc('valve', 'stop_valve', {}, '', 'mdi:stop', 'cb')}${this.svc('valve', 'close_valve', {}, '', 'mdi:valve-closed', 'cb')}</div>`;
      return `<div class="val m">${op ? 'Åpen' : 'Lukket'}</div><div class="glow" style="--gc:${C.blue};--go:${op ? 0.4 : 0}"><button class="tg${op ? ' on' : ''}" data-a="valve" style="${op ? `background:${C.blue};` : ''}--bc:${C.blue}"><span class="kn"><ha-icon icon="mdi:valve"></ha-icon></span></button></div><div class="sub">Endret ${agoT(s.last_changed)}</div>`;
    }
    c_siren(s, a) {
      const on = s.state === 'on';
      let html = `<div class="glow" style="--gc:${C.red};--go:${on ? 0.6 : 0}">${this.big(s, { on, col: C.red, act: 'toggle', pulse: true })}</div><div class="val m">${on ? 'Hyler!' : 'Stille'}</div>`;
      const tones = a.available_tones ? (Array.isArray(a.available_tones) ? a.available_tones : Object.keys(a.available_tones)) : [];
      if (tones.length) html += `<div class="lbl">Tone</div>${this.chips(tones.map((t) => [t, cap(String(t))]), '', 'svcv', ' data-d="siren" data-s="turn_on" data-f="tone"')}`;
      return html;
    }
    c_remote(s, a) {
      const on = s.state === 'on';
      let html = `${this.big(s, { on, col: C.blue, act: 'toggle' })}<div class="val m">${on ? 'På' : 'Av'}</div>`;
      if (a.current_activity) html += `<div class="sub">${esc(a.current_activity)}</div>`;
      if (a.activity_list && a.activity_list.length) html += `<div class="lbl">Aktivitet</div>${this.chips(a.activity_list.map((x) => [x, x]), a.current_activity, 'svcv', ' data-d="remote" data-s="turn_on" data-f="activity"')}`;
      return html;
    }
    c_camera(s, a) {
      const src = a.entity_picture;
      return `<div class="ph cam" data-keep>${src ? `<img data-cam="${esc(src)}" src="${esc(src)}" alt="">` : 'kamerastrøm'}${s.state === 'streaming' || s.state === 'recording' || src ? `<span class="live"><i></i>LIVE</span>` : ''}</div><div class="sub">${esc(ST[s.state] || s.state)}${a.motion_detection ? ' · bevegelse på' : ''}</div>
        <div class="acts">${a.motion_detection != null ? this.svc('camera', a.motion_detection ? 'disable_motion_detection' : 'enable_motion_detection', {}, a.motion_detection ? 'Bevegelse av' : 'Bevegelse på', 'mdi:motion-sensor') : ''}${this.svc('camera', s.state === 'off' ? 'turn_on' : 'turn_off', {}, s.state === 'off' ? 'Slå på' : 'Slå av', 'mdi:power')}</div>`;
    }
    c_image(s, a) { return `<div class="ph" style="aspect-ratio:1">${a.entity_picture ? `<img src="${esc(a.entity_picture)}" style="object-fit:contain" alt="">` : 'bilde'}</div><div class="sub">Oppdatert ${agoT(s.state)}</div>`; }
    mapBox(lat, lon, rad) { return lat != null && lon != null ? `<div class="map" data-keep data-map="${lat},${lon},${rad || 0}"></div>` : ''; }
    c_person(s, a) {
      const hm = s.state === 'home', col = hm ? C.green : C.blue;
      return `<div class="glow" style="--gc:${col};--go:.3">${this.big(s, { on: true, col, img: a.entity_picture })}</div><div class="val m">${esc(ST[s.state] || s.state)}</div><div class="sub">Endret ${agoT(s.last_changed)}</div>${this.mapBox(a.latitude, a.longitude, a.gps_accuracy)}
        ${this.kv([a.source ? ['Kilde', `<code>${esc(a.source)}</code>`] : null, a.gps_accuracy != null ? ['Nøyaktighet', a.gps_accuracy + ' m'] : null, a.battery_level != null ? ['Batteri', a.battery_level + ' %'] : null])}`;
    }
    c_device_tracker(s, a) { return this.c_person(s, a); }
    c_zone(s, a) {
      return `${this.big(s, { on: Number(s.state) > 0, col: C.green })}<div class="val m">${Number(s.state) || 0} ${Number(s.state) === 1 ? 'person' : 'personer'}</div>${this.mapBox(a.latitude, a.longitude, a.radius)}${this.kv([['Radius', (a.radius || 0) + ' m'], a.persons && a.persons.length ? ['Her nå', esc(a.persons.map((p) => (this.hass.states[p] && this.hass.states[p].attributes.friendly_name) || p).join(', '))] : null])}`;
    }
    c_sun(s, a) {
      const up = s.state === 'above_horizon', el = a.elevation || 0, x = clamp(50 + (a.azimuth != null ? (a.azimuth - 180) / 1.8 : 0), 4, 96), y = clamp(100 - el * 1.4, 8, 118);
      return `<div class="card"><div class="sunarc"><svg viewBox="0 0 100 120" preserveAspectRatio="none"><path d="M0 100 Q50 -20 100 100" stroke="${CTRL}" stroke-width="1" stroke-dasharray="2 2" fill="none" vector-effect="non-scaling-stroke"></path><line x1="0" y1="100" x2="100" y2="100" stroke="${CTRL}" vector-effect="non-scaling-stroke"></line></svg><span style="position:absolute;left:${x}%;top:${(y / 120) * 100}%;width:28px;height:28px;margin:-14px;border-radius:14px;background:${up ? C.yellow : C.blue};box-shadow:0 0 24px ${up ? C.yellow : C.blue}"></span></div></div>
        <div class="val m">${up ? 'Over horisonten' : 'Under horisonten'}</div><div class="sub">Høyde ${nf(el, 1)}°${a.azimuth != null ? ' · asimut ' + nf(a.azimuth, 0) + '°' : ''}</div>
        ${this.kv([a.next_rising ? ['Soloppgang', esc(dt(a.next_rising))] : null, a.next_setting ? ['Solnedgang', esc(dt(a.next_setting))] : null, a.next_noon ? ['Middag', esc(dt(a.next_noon))] : null, a.next_dawn ? ['Gry', esc(dt(a.next_dawn))] : null, a.next_dusk ? ['Skumring', esc(dt(a.next_dusk))] : null])}`;
    }
    c_weather(s, a) {
      const fc = this.ui.fc || a.forecast || [];
      const ic = (c) => this.icon({ entity_id: 'weather.x', state: c, attributes: {} });
      return `<div class="glow" style="--gc:${C.blue};--go:.25"><ha-icon icon="${this.icon(s)}" style="--mdc-icon-size:84px;color:${s.state === 'sunny' ? C.yellow : TX}"></ha-icon></div><div class="val">${a.temperature != null ? nf(a.temperature, 0) : '–'}<small>${esc(a.temperature_unit || '°')}</small></div><div class="sub">${esc(ST[s.state] || s.state)}${a.apparent_temperature != null ? ' · føles som ' + nf(a.apparent_temperature, 0) + '°' : ''}</div>
        ${fc.length ? `<div class="card"><h4>Neste timer</h4><div class="fc">${fc.slice(0, 24).map((f) => `<div><span>${hhmm(new Date(f.datetime))}</span><ha-icon icon="${ic(f.condition)}"></ha-icon><b>${nf(f.temperature, 0)}°</b>${f.precipitation ? `<span style="color:${C.blue}">${nf(f.precipitation, 1)}</span>` : '<span>&nbsp;</span>'}</div>`).join('')}</div></div>` : ''}
        ${this.kv([['Fukt', a.humidity != null ? a.humidity + ' %' : '–'], ['Vind', a.wind_speed != null ? nf(a.wind_speed, 1) + ' ' + esc(a.wind_speed_unit || 'm/s') : '–'], a.wind_gust_speed != null ? ['Vindkast', nf(a.wind_gust_speed, 1) + ' ' + esc(a.wind_speed_unit || 'm/s')] : null, ['Lufttrykk', a.pressure != null ? a.pressure + ' ' + esc(a.pressure_unit || 'hPa') : '–'], a.uv_index != null ? ['UV', nf(a.uv_index, 1)] : null, a.cloud_coverage != null ? ['Skydekke', a.cloud_coverage + ' %'] : null, a.visibility != null ? ['Sikt', a.visibility + ' ' + esc(a.visibility_unit || 'km')] : null])}`;
    }
    c_todo(s) {
      const items = this.ui.todo;
      const L = items == null ? '<div class="note">Henter liste …</div>' : items.length ? items.map((it) => `<button class="opt${it.status === 'completed' ? ' on done' : ''}" data-a="todo" data-v="${esc(it.uid)}"><span class="ck"><ha-icon icon="mdi:check"></ha-icon></span><span style="flex:1;text-align:left">${esc(it.summary)}</span></button>`).join('') : '<div class="note">Ingen oppgaver</div>';
      return `<div class="val">${Number(s.state) || 0}</div><div class="sub">ugjort</div><div class="inp"><input data-in="todo" placeholder="Legg til …" value=""><button class="cb sm on" data-a="todoadd" aria-label="Legg til"><ha-icon icon="mdi:plus"></ha-icon></button></div><div class="card" style="padding:8px">${L}</div>`;
    }
    c_calendar(s, a) {
      const on = s.state === 'on';
      return `${this.big(s, { on, col: C.purple })}<div class="val m">${on ? 'Pågår nå' : a.message ? 'Neste' : 'Ingen hendelser'}</div>${a.message ? this.kv([['Hendelse', esc(a.message)], a.start_time ? ['Start', esc(dt(a.start_time))] : null, a.end_time ? ['Slutt', esc(dt(a.end_time))] : null, a.location ? ['Sted', esc(a.location)] : null, a.description ? ['Beskrivelse', esc(a.description)] : null]) : ''}<button class="btn ghost" data-a="hash" data-v="#kalender"><ha-icon icon="mdi:calendar-month"></ha-icon>Åpne kalenderen</button>`;
    }
    c_sensor(s, a) {
      if (a.device_class === 'timestamp' && !isNaN(new Date(s.state))) return `${this.big(s, { on: false })}<div class="val m">${esc(agoT(s.state))}</div><div class="sub">${esc(dt(s.state))}</div>`;
      if (!isNum(s.state)) return `${this.big(s, { on: false })}<div class="val m">${esc(ST[s.state] || s.state)}</div><div class="sub">Oppdatert ${agoT(s.last_updated || s.last_changed)}</div>${a.options ? `<div class="chips">${a.options.map((o) => `<span class="chip ${o === s.state ? 'on' : ''}">${esc(o)}</span>`).join('')}</div>` : ''}`;
      const v = parseFloat(s.state), u = a.unit_of_measurement || '';
      const lvl = a.device_class === 'battery' || (u === '%' && /batteri|battery/i.test(a.friendly_name || ''));
      return `${lvl ? `<div class="hero">${this.ring(v / 100, v < 20 ? C.red : v < 40 ? C.orange : C.green, `<ha-icon icon="${this.icon(s)}" style="--mdc-icon-size:40px"></ha-icon><div class="val m">${esc(s.state.replace('.', ','))}<small>%</small></div>`)}</div>` : `<div class="val">${esc(s.state.replace('.', ','))}${u ? `<small>${esc(u)}</small>` : ''}</div>`}<div class="sub">Oppdatert ${agoT(s.last_updated || s.last_changed)}</div>${this.chart(s)}`;
    }
    c_binary_sensor(s, a) {
      const on = s.state === 'on', col = this.accent(s);
      const pul = on && ['motion', 'occupancy', 'smoke', 'gas', 'moisture', 'sound', 'vibration', 'problem', 'tamper', 'safety'].includes(a.device_class);
      return `<div class="glow" style="--gc:${col};--go:${on ? 0.45 : 0}">${this.big(s, { on, col, pulse: pul })}</div><div class="val m">${esc(this.stateTxt(s))}</div><div class="sub">${on ? 'Siden' : 'Endret'} ${agoT(s.last_changed)}</div>${this.timeline(s)}`;
    }
    c_number(s, a, on, d) {
      const v = parseFloat(s.state), mn = a.min != null ? a.min : 0, mx = a.max != null ? a.max : 100, st = a.step || 1, u = a.unit_of_measurement || '';
      const box = a.mode === 'box' || (mx - mn) / st > 1000;
      return `<div class="val" data-out="num">${isNaN(v) ? '–' : esc(this.fmt(v, 'num', ''))}${u ? `<small>${esc(u)}</small>` : ''}</div><div class="sub">${nf(mn, 0)} – ${nf(mx, 0)}${u ? ' ' + esc(u) : ''}</div>
        ${box ? '' : this.sl({ k: 'num', v: isNaN(v) ? mn : v, min: mn, max: mx, step: st, dir: 'h', col: C.blue, icon: this.icon(s), label: '', fmt: 'num', u })}
        <div class="row"><button class="cb" data-a="numstep" data-v="-1"><ha-icon icon="mdi:minus"></ha-icon></button>${box ? `<div class="inp" style="width:140px"><input data-in="num" type="number" inputmode="decimal" step="${st}" min="${mn}" max="${mx}" value="${isNaN(v) ? '' : v}" style="text-align:center"></div>` : ''}<button class="cb" data-a="numstep" data-v="1"><ha-icon icon="mdi:plus"></ha-icon></button></div>`;
    }
    c_input_number(s, a, on, d) { return this.c_number(s, a, on, d); }
    c_select(s, a) { return `<div class="val m">${esc(s.state)}</div><div class="card" style="padding:8px">${(a.options || []).map((o) => `<button class="opt${s.state === o ? ' on' : ''}" data-a="select" data-v="${esc(o)}"><span class="ck"><ha-icon icon="mdi:check"></ha-icon></span><span style="flex:1;text-align:left">${esc(o)}</span></button>`).join('')}</div>`; }
    c_input_select(s, a) { return this.c_select(s, a); }
    c_text(s, a) {
      return `<div class="val m" style="overflow-wrap:anywhere">${a.mode === 'password' ? '••••••' : esc(s.state) || '–'}</div><div class="inp"><input data-in="text" ${a.mode === 'password' ? 'type="password"' : ''} ${a.max ? `maxlength="${a.max}"` : ''} value="${esc(s.state)}"><button class="cb sm on" data-a="textset" aria-label="Lagre"><ha-icon icon="mdi:check"></ha-icon></button></div>${a.max ? `<div class="note">Maks ${a.max} tegn</div>` : ''}`;
    }
    c_input_text(s, a) { return this.c_text(s, a); }
    c_input_datetime(s, a, on, d) {
      const hd = a.has_date !== false && d !== 'time', ht = a.has_time !== false && d !== 'date';
      const v = String(s.state || '');
      let dv = '', tv = '';
      if (d === 'datetime') { const x = new Date(v); if (!isNaN(x)) { const p = (n) => String(n).padStart(2, '0'); dv = `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`; tv = `${p(x.getHours())}:${p(x.getMinutes())}`; } } else { const m = v.match(/(\d{4}-\d{2}-\d{2})?[ T]?(\d{2}:\d{2})?/); dv = (m && m[1]) || ''; tv = (m && m[2]) || (/^\d{2}:\d{2}/.test(v) ? v.slice(0, 5) : ''); }
      return `${this.big(s, { on: false })}<div class="val m">${esc(d === 'time' || (!hd && ht) ? tv || v : hd && ht ? dt(d === 'datetime' ? v : v.replace(' ', 'T')) : dv || v)}</div>
        <div class="inp">${hd ? `<input data-in="date" type="date" value="${dv}">` : ''}${ht ? `<input data-in="time" type="time" value="${tv}">` : ''}<button class="cb sm on" data-a="dtset" aria-label="Lagre"><ha-icon icon="mdi:check"></ha-icon></button></div>`;
    }
    c_datetime(s, a, on, d) { return this.c_input_datetime(s, a, on, d); }
    c_date(s, a, on, d) { return this.c_input_datetime(s, a, on, d); }
    c_time(s, a, on, d) { return this.c_input_datetime(s, a, on, d); }
    c_counter(s, a) {
      return `<div class="glow" style="--gc:${C.blue};--go:.25;padding:20px 0"><div class="val" style="font-size:88px">${esc(s.state)}</div></div><div class="sub">${a.minimum != null ? 'Min ' + a.minimum : ''}${a.maximum != null ? ' · maks ' + a.maximum : ''}${a.step ? ' · steg ' + a.step : ''}</div>
        <div class="row">${this.svc('counter', 'decrement', {}, '', 'mdi:minus', 'cb')}${this.svc('counter', 'reset', {}, '', 'mdi:restore', 'cb sm')}${this.svc('counter', 'increment', {}, '', 'mdi:plus', 'cb')}</div>`;
    }
    c_timer(s, a) {
      const total = parseDur(a.duration), act = s.state === 'active';
      let rem = parseDur(a.remaining);
      if (act && a.finishes_at) rem = (new Date(a.finishes_at).getTime() - Date.now()) / 1000;
      if (s.state === 'idle') rem = total;
      const p = total ? rem / total : 0;
      return `<div class="hero">${this.ring(p, act ? C.orange : s.state === 'paused' ? C.yellow : CTRL, `<div class="val" style="font-size:48px">${dur(rem)}</div><div class="sub" style="margin:0">${esc(this.stateTxt(s))}${total ? ' · av ' + dur(total) : ''}</div>`, act ? 'ring-pulse' : '')}</div>
        <div class="row">${act ? this.svc('timer', 'pause', {}, '', 'mdi:pause', 'cb pri') : this.svc('timer', 'start', {}, '', 'mdi:play', 'cb pri')}${this.svc('timer', 'cancel', {}, '', 'mdi:stop', 'cb')}${this.svc('timer', 'finish', {}, '', 'mdi:flag-checkered', 'cb')}</div>`;
    }
    c_update(s, a) {
      const nw = s.state === 'on', ip = a.in_progress, pct = typeof ip === 'number' ? ip : a.update_percentage;
      return `${a.entity_picture ? `<div class="big" style="background:${SURF};width:120px;height:120px"><img src="${esc(a.entity_picture)}" alt="" style="object-fit:contain;padding:18px"></div>` : this.big(s, { on: nw, col: C.orange, pulse: !!ip })}<div class="val m">${ip ? 'Installerer …' : nw ? 'Ny versjon' : 'Oppdatert'}</div>
        ${ip ? `<div class="prog"><div class="bar"><i style="width:${pct != null ? pct : 30}%;background:${C.orange}"></i></div></div>` : ''}
        ${this.kv([['Installert', esc(a.installed_version || '–')], ['Nyeste', esc(a.latest_version || '–')], a.title ? ['Produkt', esc(a.title)] : null])}
        ${a.release_summary ? `<div class="card" style="font-size:14px;line-height:1.5;color:${TX1}">${esc(a.release_summary)}</div>` : ''}
        ${a.release_url ? `<button class="btn ghost" data-a="url" data-v="${esc(a.release_url)}"><ha-icon icon="mdi:open-in-new"></ha-icon>Endringslogg</button>` : ''}
        ${nw && !ip ? `<div class="acts"><button class="act" data-a="svc" data-d="update" data-s="skip" data-p="{}"><span class="ai"><ha-icon icon="mdi:debug-step-over"></ha-icon></span>Hopp over</button><button class="act on" data-a="svc" data-d="update" data-s="install" data-p="{}"><span class="ai"><ha-icon icon="mdi:download"></ha-icon></span>Installer</button></div>` : ''}`;
    }
    c_event(s, a) {
      const t = new Date(s.state);
      return `${this.big(s, { on: !isNaN(t) && Date.now() - t < 60000, col: C.yellow, pulse: true })}<div class="val m">${esc(a.event_type ? cap(String(a.event_type).replace(/_/g, ' ')) : 'Ingen hendelse')}</div><div class="sub">${isNaN(t) ? '' : esc(agoT(t)) + ' · ' + esc(dt(t))}</div>${a.event_types ? `<div class="chips">${a.event_types.map((e) => `<span class="chip ${e === a.event_type ? 'on' : ''}">${esc(e)}</span>`).join('')}</div>` : ''}`;
    }
    c_plant(s, a) {
      const rows = [['moisture', 'Fukt', '%'], ['temperature', 'Temperatur', '°'], ['conductivity', 'Næring', 'µS/cm'], ['brightness', 'Lys', 'lx'], ['battery', 'Batteri', '%']].filter(([k]) => a[k] != null);
      return `${this.big(s, { on: s.state === 'ok', col: C.green })}<div class="val m">${esc(ST[s.state] || s.state)}</div>${a.problem && a.problem !== 'none' ? `<div class="sub" style="color:${C.red}">${esc(a.problem)}</div>` : ''}${this.kv(rows.map(([k, l, u]) => [l, esc(a[k]) + ' ' + u]))}`;
    }
    c_tts(s) { return `${this.big(s, { on: false })}<div class="val m">Tekst til tale</div><div class="sub">Sist brukt ${isNaN(new Date(s.state)) ? '–' : agoT(s.state)}</div>`; }

    /* ---------- historikk ---------- */
    histPts(s) { const H = this.hist[s.entity_id]; if (!H) return null; return H.d.map((x) => ({ s: x.s != null ? x.s : x.state, t: (x.lu != null ? x.lu * 1000 : new Date(x.last_updated || x.last_changed).getTime()) })); }
    chart(s) {
      const H = this.histPts(s);
      if (!H) return `<div class="card"><h4>Siste 24 timer</h4><div class="note">Henter historikk …</div></div>`;
      const pts = H.map((x) => ({ t: x.t, v: parseFloat(x.s) })).filter((x) => !isNaN(x.v));
      pts.push({ t: Date.now(), v: parseFloat(s.state) });
      if (pts.length < 2) return `<div class="card"><h4>Siste 24 timer</h4><div class="note">Ingen historikk ennå</div></div>`;
      const t0 = Date.now() - 86400000, t1 = Date.now();
      const vs = pts.map((x) => x.v), mn = Math.min(...vs), mx = Math.max(...vs), avg = vs.reduce((x, y) => x + y, 0) / vs.length;
      const lo = mn - (mx - mn) * 0.15 - 0.01, hi = mx + (mx - mn) * 0.15 + 0.01;
      const X = (t) => clamp(((t - t0) / (t1 - t0)) * 300, 0, 300), Y = (v) => 100 - ((v - lo) / (hi - lo)) * 100;
      const line = pts.map((p) => `${X(p.t).toFixed(1)},${Y(p.v).toFixed(1)}`).join(' ');
      const u = s.attributes.unit_of_measurement || '', dg = Math.abs(mx) < 10 ? 1 : 0;
      this._chart = { pts, t0, t1, lo, hi, u, dg };
      const col = { temperature: C.red, humidity: C.blue, power: C.yellow, energy: C.yellow, battery: C.green, illuminance: C.yellow, co2: C.purple, carbon_dioxide: C.purple, monetary: C.green }[s.attributes.device_class] || C.blue;
      return `<div class="card"><h4>Siste 24 timer<span>${nf(mn, dg)}–${nf(mx, dg)} ${esc(u)}</span></h4>
        <div class="chart" data-chart="1" style="--lc:${col}"><svg viewBox="0 0 300 100" preserveAspectRatio="none"><defs><linearGradient id="cg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity=".35"></stop><stop offset="1" stop-color="${col}" stop-opacity="0"></stop></linearGradient></defs><polyline points="${X(pts[0].t).toFixed(1)},100 ${line} 300,100" fill="url(#cg)"></polyline><polyline points="${line}" fill="none" stroke="${col}" stroke-width="2.2" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"></polyline></svg><span class="cur"></span><span class="dot"></span><span class="tip"></span></div>
        <div class="ax"><span>−24 t</span><span>−18 t</span><span>−12 t</span><span>−6 t</span><span>Nå</span></div>
        <div class="stats"><div><span>Min</span><b>${nf(mn, dg)}</b></div><div><span>Snitt</span><b>${nf(avg, dg)}</b></div><div><span>Maks</span><b>${nf(mx, dg)}</b></div></div></div>`;
    }
    timeline(s) {
      const H = this.histPts(s);
      if (!H) return `<div class="card"><h4>Siste 24 timer</h4><div class="note">Henter historikk …</div></div>`;
      const t0 = Date.now() - 86400000, now = Date.now();
      const ev = H.filter((x) => x.s != null).map((x) => ({ s: x.s, t: Math.max(t0, x.t) }));
      if (!ev.length || ev[ev.length - 1].s !== s.state) ev.push({ s: s.state, t: Math.max(t0, new Date(s.last_changed).getTime()) });
      if (ev[0].t > t0) ev.unshift({ s: null, t: t0 });
      const col = this.accent(s), on = (st) => ON_STATES.includes(st);
      const segs = ev.map((e, i) => ({ s: e.s, w: ((i < ev.length - 1 ? ev[i + 1].t : now) - e.t) / 60000 })).filter((x) => x.w > 0);
      const bn = BIN[s.attributes.device_class];
      const name = (st) => (st == null ? 'Ukjent' : DOM(s.entity_id) === 'binary_sensor' && bn ? (st === 'on' ? bn[0] : bn[1]) : HVAC[st] && DOM(s.entity_id) === 'climate' ? HVAC[st] : ST[st] || cap(String(st)));
      const changes = ev.filter((e) => e.s != null).slice(-8).reverse();
      const onMin = segs.filter((x) => on(x.s)).reduce((q, x) => q + x.w, 0);
      const onSt = (segs.find((g) => on(g.s)) || {}).s;
      return `<div class="card"><h4>Siste 24 timer<span>${onSt ? esc(name(onSt)) + ' ' + hm(onMin) : ''}</span></h4>
        <div class="tl">${segs.map((x) => `<span style="flex:${x.w.toFixed(1)};background:${x.s == null ? 'transparent' : on(x.s) ? col : CTRL}" title="${esc(name(x.s))}"></span>`).join('')}</div><div class="ax"><span>−24 t</span><span>−12 t</span><span>Nå</span></div>
        ${changes.length ? `<div class="log" style="margin-top:10px">${changes.map((e) => `<div><i style="background:${on(e.s) ? col : CTRL}"></i><span>${esc(name(e.s))}</span><em>${e.t <= t0 ? 'før' : hhmm(new Date(e.t))}</em></div>`).join('')}</div>` : ''}</div>`;
    }
    histTab(s) {
      const a = s.attributes;
      if (isNum(s.state) && DOM(s.entity_id) !== 'counter') return this.chart(s);
      return `${this.timeline(s)}${this.kv([['Nå', esc(this.stateTxt(s))], ['Endret', esc(agoT(s.last_changed))], ['Oppdatert', esc(agoT(s.last_updated || s.last_changed))], a.last_triggered ? ['Sist utløst', esc(agoT(a.last_triggered))] : null])}`;
    }
    // Innstillinger for entiteten (navn, entitets-ID, ikon, område, synlig/aktivert) – samme felt som HAs entitetsinnstillinger
    setTab(s) {
      const h = this.hass, id = s.entity_id, e = (h.entities && h.entities[id]) || {}, u = this.ui.set || (this.ui.set = { name: e.name || '', eid: id, icon: e.icon || '', area: e.area_id || null, hidden: !!e.hidden_by, disabled: !!e.disabled_by });
      const def = this.icon({ ...s, attributes: { ...s.attributes, icon: undefined } });
      const SUG = [...new Set([def, ...({ light: ['mdi:lightbulb', 'mdi:ceiling-light', 'mdi:floor-lamp', 'mdi:lamp', 'mdi:led-strip-variant', 'mdi:wall-sconce'], climate: ['mdi:thermostat', 'mdi:radiator', 'mdi:heat-pump', 'mdi:air-conditioner', 'mdi:heating-coil', 'mdi:fireplace'], media_player: ['mdi:television', 'mdi:speaker', 'mdi:cast', 'mdi:soundbar', 'mdi:music', 'mdi:apple'], sensor: ['mdi:thermometer', 'mdi:water-percent', 'mdi:flash', 'mdi:gauge', 'mdi:molecule-co2', 'mdi:weather-windy'], switch: ['mdi:power-socket-eu', 'mdi:toggle-switch-variant', 'mdi:fan', 'mdi:coffee-maker', 'mdi:washing-machine', 'mdi:water-boiler'] }[DOM(id)] || ['mdi:star', 'mdi:home', 'mdi:shape', 'mdi:circle-outline', 'mdi:flash', 'mdi:bell'])])].slice(0, 7);
      const areas = Object.values(h.areas || {});
      const unique = !!(e.unique_id || e.entity_id || (h.entities && h.entities[id]));
      if (!unique) return `<div class="card"><div class="note">Denne entiteten er laget i YAML og har ingen unik ID, så navn og ikon kan bare endres i konfigurasjonen.</div></div>`;
      return `<label class="setf"><span>Navn</span><input data-in="sname" value="${esc(u.name)}" placeholder="${esc(s.attributes.friendly_name || '')}" autocomplete="off"></label>
        <label class="setf"><span>Entitets-ID</span><input class="mono" data-in="seid" value="${esc(u.eid)}" autocapitalize="off" spellcheck="false" autocomplete="off"></label>
        <div class="setf"><span>Ikon</span><div class="icrow"><span class="icprev"><ha-icon icon="${esc(u.icon || def)}"></ha-icon></span><input data-in="sicon" value="${esc(u.icon)}" placeholder="${esc(def)}" autocapitalize="off" spellcheck="false" style="flex:1"></div>
          <div class="icsug">${SUG.map((ic) => `<button class="${(u.icon || def) === ic ? 'on' : ''}" data-a="sic" data-v="${ic}" aria-label="${ic}"><ha-icon icon="${ic}"></ha-icon></button>`).join('')}</div></div>
        ${areas.length ? `<div class="lbl">Område</div>${this.chips([['', 'Følg enheten'], ...areas.map((x) => [x.area_id, x.name])], u.area || '', 'sarea')}` : ''}
        <div class="card" style="padding:0"><div class="setrow"><b>Synlig<i>Vises i lister og på dashbord</i></b><button class="sw2${u.hidden ? '' : ' on'}" data-a="stg" data-v="hidden" aria-label="Synlig"></button></div><div class="setrow"><b>Aktivert<i>Av = HA slutter å oppdatere entiteten</i></b><button class="sw2${u.disabled ? '' : ' on'}" data-a="stg" data-v="disabled" aria-label="Aktivert"></button></div></div>
        ${this.ui.setErr ? `<div class="note" style="color:${C.red}">${esc(this.ui.setErr)}</div>` : ''}
        <div class="savebar"><button class="btn ghost" data-a="sreset">Tilbakestill</button><button class="btn" data-a="ssave" style="background:linear-gradient(145deg,#f285c9 -10%,#f5cdc6 100%);color:#2a1720">${this.ui.saving ? 'Lagrer …' : 'Lagre'}</button></div>`;
    }
    async saveSet() {
      const h = this.hass, s = this.s, u = this.ui.set; if (!s || !u) return;
      const e = (h.entities && h.entities[s.entity_id]) || {};
      const nid = String(u.eid || '').trim();
      if (nid !== s.entity_id && !/^[a-z_]+\.[a-z0-9_]+$/.test(nid)) { this.ui.setErr = 'Entitets-ID må være på formen domene.navn, med små bokstaver, tall og _'; return this.update(); }
      if (nid !== s.entity_id && DOM(nid) !== DOM(s.entity_id)) { this.ui.setErr = 'Domenet (' + DOM(s.entity_id) + '.) kan ikke endres'; return this.update(); }
      if (nid !== s.entity_id && h.states[nid]) { this.ui.setErr = nid + ' finnes allerede'; return this.update(); }
      const p = { entity_id: s.entity_id, name: u.name.trim() || null, icon: u.icon.trim() || null, area_id: u.area || null, hidden_by: u.hidden ? 'user' : null, disabled_by: u.disabled ? 'user' : null };
      if (nid !== s.entity_id) p.new_entity_id = nid;
      this.ui.saving = true; this.ui.setErr = ''; this.update();
      try {
        await h.callWS({ type: 'config/entity_registry/update', ...p });
        this.haptic('success'); this.ui.saving = false;
        if (window.kiNote) window.kiNote('Lagret');
        if (p.new_entity_id) { const nidv = p.new_entity_id; this.ui.set = null; setTimeout(() => { if (this.hass.states[nidv]) { this.eid = nidv; this.tab = 'set'; this.render(true); } }, 350); }
        else { this.ui.set = null; this.update(); }
      } catch (er) { this.ui.saving = false; this.ui.setErr = (er && (er.message || er.code)) || 'Kunne ikke lagre'; this.update(); }
    }
    // Sensorer som hører til: samme enhet først, så samme område (temperatur/fukt for klima, effekt/lydnivå for media)
    related(s, classes) {
      const h = this.hass, id = s.entity_id, E = h.entities || {}, me = E[id] || {}, dev = me.device_id;
      const ar = me.area_id || (dev && h.devices && h.devices[dev] && h.devices[dev].area_id);
      const areaOf = (x) => { const e = E[x] || {}; return e.area_id || (e.device_id && h.devices && h.devices[e.device_id] && h.devices[e.device_id].area_id); };
      const ok = (x) => x !== id && /^(sensor|binary_sensor)\./.test(x) && h.states[x] && h.states[x].state !== 'unavailable';
      const same = Object.keys(h.states).filter((x) => ok(x) && dev && (E[x] || {}).device_id === dev);
      const near = ar ? Object.keys(h.states).filter((x) => ok(x) && !same.includes(x) && areaOf(x) === ar && (!classes || classes.includes(h.states[x].attributes.device_class))) : [];
      return [...same, ...near].slice(0, 8);
    }
    relHtml(ids, title) {
      if (!ids.length) return '';
      const h = this.hass, col = { temperature: C.orange, humidity: C.blue, power: C.yellow, energy: C.yellow, battery: C.green, illuminance: C.yellow, carbon_dioxide: C.green, signal_strength: C.purple, motion: C.pink, door: C.pink, window: C.blue };
      return `<div class="lbl">${title || 'Sensorer'}<span>${ids.length}</span></div><div class="rels">${ids.map((x) => { const st = h.states[x], dc = st.attributes.device_class; return `<button class="rel" data-a="goto" data-v="${esc(x)}" style="--rc:${col[dc] || C.blue}"><span class="ri"><ha-icon icon="${this.icon(st)}"></ha-icon></span><span class="rt"><b data-noi18n>${esc(this.stateTxt(st))}</b><i data-noi18n>${esc(String(st.attributes.friendly_name || x).replace(String(this.s.attributes.friendly_name || '') + ' ', ''))}</i></span></button>`; }).join('')}</div>`;
    }
    stats(rows) { return `<div class="stats">${rows.filter(Boolean).map(([ic, l, v, u]) => `<div class="stat"><span><ha-icon icon="${ic}"></ha-icon>${esc(l)}</span><b>${v}${u ? `<small>${esc(u)}</small>` : ''}</b></div>`).join('')}</div>`; }
    detTab(s) {
      const a = s.attributes, h = this.hass, e = h.entities && h.entities[s.entity_id], dv = e && e.device_id && h.devices && h.devices[e.device_id];
      const skip = ['friendly_name', 'entity_picture', 'supported_features', 'icon', 'entity_picture_local'];
      const val = (v) => (Array.isArray(v) ? v.slice(0, 8).join(', ') + (v.length > 8 ? ' …' : '') : typeof v === 'object' && v ? JSON.stringify(v).slice(0, 100) : String(v));
      return `<div class="card kv">${[['Entitet', `<code>${esc(s.entity_id)}</code>`], ['Område', esc(this.area(s.entity_id) || '–')], dv ? ['Enhet', esc(dv.name_by_user || dv.name || '–')] : null, dv && dv.manufacturer ? ['Produsent', esc([dv.manufacturer, dv.model].filter(Boolean).join(' '))] : null, e && e.platform ? ['Integrasjon', esc(e.platform)] : null, ['Endret', esc(dt(s.last_changed))], ['Oppdatert', esc(dt(s.last_updated || s.last_changed))]].filter(Boolean).map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('')}</div>
        <div class="lbl">Attributter<span>${Object.keys(a).filter((k) => !skip.includes(k)).length}</span></div>
        <div class="card kv">${Object.keys(a).filter((k) => !skip.includes(k)).map((k) => `<div><span>${esc(k)}</span><code>${esc(val(a[k]))}</code></div>`).join('') || '<div><span>Ingen</span></div>'}</div>
        <button class="btn ghost" data-a="copy"><ha-icon icon="mdi:content-copy"></ha-icon>Kopier entitets-ID</button>`;
    }

    /* ---------- render + morph ---------- */
    html(s) {
      const d = DOM(s.entity_id), on = ON(s), acc = this.accent(s);
      const ar = this.area(s.entity_id);
      const body = this.tab === 'hist' ? this.histTab(s) : this.tab === 'det' ? this.detTab(s) : this.tab === 'set' ? this.setTab(s) : this.ctl(s);
      const ti = { ctl: 0, hist: 1, det: 2 }[this.tab]; const tiv = ti == null ? -1 : ti;
      return `<div class="bd" data-a="close"></div>
        <div class="sh" part="sheet"><div class="glowbg" style="--gc:${acc};--go:${on && this.tab === 'ctl' && d !== 'media_player' ? 0.16 : 0}"></div><div class="grab"><i></i></div>
          <div class="hd"><span class="ic${on ? ' on' : ''}" style="background:${on ? acc : SURF};color:${on ? DARK : TX};--icc:${acc}"><ha-icon icon="${this.icon(s)}"></ha-icon></span>
            <span class="tt"><b data-noi18n>${esc(cap(String(s.attributes.friendly_name || s.entity_id)))}</b><span>${esc([ar, this.stateTxt(s)].filter(Boolean).join(' · '))}</span></span>
            <button class="gear" data-a="tab" data-v="set" aria-label="Innstillinger"><ha-icon icon="mdi:cog-outline"></ha-icon></button><button class="x" data-a="close" aria-label="Lukk"><ha-icon icon="mdi:close"></ha-icon></button></div>
          <div class="seg" style="--si:${tiv < 0 ? 0 : tiv};${tiv < 0 ? '--seg-off:1' : ''}"><span class="ind"></span>${[['ctl', 'Kontroll'], ['hist', 'Historikk'], ['det', 'Detaljer']].map(([k, l]) => `<button class="${this.tab === k ? 'on' : ''}" data-a="tab" data-v="${k}">${l}</button>`).join('')}</div>${tiv < 0 ? '<style>.seg .ind{opacity:0}</style>' : ''}
          <div class="bdy" data-k="${this.tab}">${body}</div></div>`;
    }
    render(fresh) {
      const s = this.s;
      if (!s) { this.root.innerHTML = ''; return; }
      this.root.innerHTML = this.html(s);
      this._sig = s.state + JSON.stringify(s.attributes) + this.tab;
      const b = this.root.querySelector('.bdy');
      if (fresh && b) { b.classList.add('in'); setTimeout(() => b.classList.remove('in'), 900); }
      this.after();
    }
    update(force) {
      const s = this.s; if (!s || !this.root.firstElementChild) return this.render(true);
      if (this._sliding || this._drag) { this._pending = true; return; }
      const b0 = this.root.querySelector('.bdy'), top = b0 ? b0.scrollTop : 0, tab0 = b0 && b0.dataset.k;
      const t = document.createElement('template'); t.innerHTML = this.html(s);
      morph(this.root, t.content);
      const b = this.root.querySelector('.bdy');
      if (b && tab0 === this.tab) b.scrollTop = top;
      else if (b) { b.classList.add('in'); setTimeout(() => b.classList.remove('in'), 900); }
      this.after();
    }
    after() {
      // Kart (Leaflet finnes i demoen) – opprettes én gang per kartboks
      const m = this.root.querySelector('[data-map]');
      if (m && window.L && !m._map) {
        const [lat, lon, rad] = m.dataset.map.split(',').map(Number);
        try {
          const map = window.L.map(m, { zoomControl: false, attributionControl: false, dragging: true, scrollWheelZoom: false }).setView([lat, lon], 14);
          window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(map);
          window.L.circleMarker([lat, lon], { radius: 9, color: '#fff', weight: 3, fillColor: C.pink, fillOpacity: 1 }).addTo(map);
          if (rad) window.L.circle([lat, lon], { radius: rad, color: C.pink, weight: 1, fillOpacity: 0.12 }).addTo(map);
          m._map = map; setTimeout(() => map.invalidateSize(), 450);
          ['pointerdown', 'touchstart'].forEach((ev) => m.addEventListener(ev, (e) => e.stopPropagation(), { passive: true }));
        } catch (e) { /* */ }
      } else if (m && !window.L && !m.textContent) m.innerHTML = `<div class="ph" style="height:100%;border-radius:0">${esc(m.dataset.map)}</div>`;
    }
    refresh() {
      if (!this.hasAttribute('open')) return;
      const s = this.s; if (!s) return;
      const sig = s.state + JSON.stringify(s.attributes) + this.tab;
      if (sig === this._sig) return;
      this._sig = sig;
      clearTimeout(this._rt); this._rt = setTimeout(() => this.update(), 40);
    }

    /* ---------- hendelser (delegert, overlever morph) ---------- */
    delegate() {
      const R = this.shadowRoot;
      const find = (e, sel) => { for (const n of e.composedPath()) { if (n === R) break; if (n.matches && n.matches(sel)) return n; } return null; };
      R.addEventListener('click', (e) => { const el = find(e, '[data-a]'); if (el) { e.stopPropagation(); this.act(el); } });
      // Innstillinger-feltene: skriv til utkastet uten å tegne arket på nytt (ikonforhåndsvisningen oppdateres direkte)
      R.addEventListener('input', (e) => { const i = find(e, 'input[data-in]'); if (!i || !this.ui.set) return; const k = { sname: 'name', seid: 'eid', sicon: 'icon' }[i.dataset.in]; if (!k) return; this.ui.set[k] = i.value; if (k === 'icon') { const p = R.querySelector('.icprev ha-icon'); if (p && /^mdi:[a-z0-9-]+$/.test(i.value)) p.setAttribute('icon', i.value); } });
      R.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const i = find(e, 'input[data-in]'); if (i) { const b = { todo: 'todoadd', text: 'textset', date: 'dtset', time: 'dtset', num: 'numset', sname: 'ssave', seid: 'ssave', sicon: 'ssave' }[i.dataset.in]; if (b) this.act({ dataset: { a: b } }); } } });
      R.addEventListener('pointerdown', (e) => {
        const sl = find(e, '[data-sl]'); if (sl) return this.dragSl(sl, e);
        const dl = find(e, '[data-dial]'); if (dl) return this.dragDial(dl, e);
        const wh = find(e, '[data-wheel]'); if (wh) return this.dragWheel(wh, e);
        const sk = find(e, '[data-seek]'); if (sk) return this.dragSeek(sk, e);
        const ch = find(e, '[data-chart]'); if (ch) return this.scrub(ch, e);
        const g = find(e, '.grab,.hd'); if (g && !find(e, '[data-a]')) return this.dragSheet(g, e);
        const b = find(e, 'button'); if (b) this.ripple(b, e);
      });
    }
    ripple(b, e) {
      if (b.classList.contains('sw') || b.closest('.seg')) return;
      const r = b.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2.2, sp = document.createElement('span');
      sp.className = 'rip'; sp.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
      b.appendChild(sp); setTimeout(() => sp.remove(), 600);
    }
    act(el) {
      const x = el.dataset, s = this.s; if (!s) return;
      const d = DOM(s.entity_id), a = s.attributes;
      if (x.a !== 'tab') this.haptic(x.a === 'close' ? 'light' : 'selection');
      const val = () => this.root.querySelector(`input[data-in="${x.a === 'todoadd' ? 'todo' : x.a === 'textset' ? 'text' : 'num'}"]`);
      switch (x.a) {
        case 'close': return this.close();
        case 'tab': this.tab = x.v; this.haptic('selection'); this._sig = null; return this.update();
        case 'lv': this.ui.lv = x.v; return this.update();
        case 'toggle': return this.call(['light', 'fan', 'switch', 'input_boolean', 'automation', 'humidifier', 'siren', 'remote', 'group', 'cover'].includes(d) ? (d === 'group' ? 'homeassistant' : d) : 'homeassistant', 'toggle');
        case 'svc': return this.call(x.d || d, x.s, x.p ? JSON.parse(x.p) : {});
        case 'svcv': return this.call(x.d || d, x.s, { [x.f]: x.v });
        case 'svcoff': return this.call(d, 'turn_off');
        case 'run': el.animate && el.animate([{ transform: 'scale(1)' }, { transform: 'scale(.9)' }, { transform: 'scale(1.06)' }, { transform: 'scale(1)' }], { duration: 520, easing: 'cubic-bezier(.22,1.2,.36,1)' }); this.haptic('success'); return d === 'script' ? this.call('script', 'turn_on') : this.call('scene', 'turn_on');
        case 'press': el.animate && el.animate([{ transform: 'scale(1)' }, { transform: 'scale(.9)' }, { transform: 'scale(1)' }], { duration: 380 }); return this.call(d, 'press');
        case 'ct': return this.call('light', 'turn_on', { color_temp_kelvin: Number(x.v) });
        case 'hs': return this.call('light', 'turn_on', { hs_color: x.v.split(',').map(Number) });
        case 'effect': return this.call('light', 'turn_on', { effect: x.v });
        case 'fanstep': { const st = a.percentage_step || 10; const p = clamp((s.state === 'on' ? a.percentage || 0 : 0) + Number(x.v) * st, 0, 100); return this.call('fan', p ? 'set_percentage' : 'turn_off', p ? { percentage: Math.round(p) } : {}); }
        case 'temp': { const st = a.target_temp_step || (d === 'water_heater' ? 1 : 0.5); const t = clamp(Math.round(((a.temperature != null ? a.temperature : 20) + Number(x.v) * st) * 10) / 10, a.min_temp != null ? a.min_temp : 5, a.max_temp != null ? a.max_temp : 90); return this.call(d, 'set_temperature', { temperature: t }); }
        case 'temp2': { const st = a.target_temp_step || 0.5, o = { target_temp_low: a.target_temp_low, target_temp_high: a.target_temp_high }; o[x.f] = Math.round((o[x.f] + Number(x.v) * st) * 10) / 10; return this.call('climate', 'set_temperature', o); }
        case 'lock': return this.call('lock', s.state === 'locked' ? 'unlock' : 'lock', a.code_format && this.ui.code ? { code: this.ui.code } : {});
        case 'valve': return this.call('valve', s.state === 'open' ? 'close_valve' : 'open_valve');
        case 'select': return this.call(d, 'select_option', { option: x.v });
        case 'numstep': { const st = a.step || 1, v = clamp((parseFloat(s.state) || 0) + Number(x.v) * st, a.min != null ? a.min : -Infinity, a.max != null ? a.max : Infinity); return this.call(d, 'set_value', { value: Math.round(v / st) * st }); }
        case 'numset': { const i = val(); if (i && i.value !== '') return this.call(d, 'set_value', { value: Number(i.value) }); return; }
        case 'textset': { const i = val(); if (i) { this.haptic('success'); return this.call(d, 'set_value', { value: i.value }); } return; }
        case 'dtset': {
          const dd = this.root.querySelector('input[data-in="date"]'), tt = this.root.querySelector('input[data-in="time"]');
          const dv = dd && dd.value, tv = tt && tt.value;
          this.haptic('success');
          if (d === 'input_datetime') return this.call('input_datetime', 'set_datetime', dv && tv ? { datetime: `${dv} ${tv}:00` } : dv ? { date: dv } : { time: tv + ':00' });
          if (d === 'date') return this.call('date', 'set_value', { date: dv });
          if (d === 'time') return this.call('time', 'set_value', { time: tv + ':00' });
          return this.call('datetime', 'set_value', { datetime: new Date(`${dv}T${tv || '00:00'}`).toISOString() });
        }
        case 'key': { let c = this.ui.code || ''; c = x.v === 'b' ? c.slice(0, -1) : x.v === 'c' ? '' : (c + x.v).slice(0, 12); this.ui.code = c; return this.update(); }
        case 'alarm': { const data = a.code_format ? { code: this.ui.code || '' } : {}; this.ui.code = ''; this.haptic(x.s === 'alarm_disarm' ? 'success' : 'heavy'); return this.call('alarm_control_panel', x.s, data); }
        case 'todo': { const it = (this.ui.todo || []).find((t) => t.uid === x.v); if (!it) return; it.status = it.status === 'completed' ? 'needs_action' : 'completed'; this.update(); return this.call('todo', 'update_item', { item: it.uid, status: it.status }); }
        case 'todoadd': { const i = val(); const v = i && i.value.trim(); if (!v) return; i.value = ''; this.ui.todo = (this.ui.todo || []).concat([{ uid: 'n' + Date.now(), summary: v, status: 'needs_action' }]); this.update(); return this.call('todo', 'add_item', { item: v }); }
        case 'goto': return this.open(x.v);
        case 'hash': this.close(); setTimeout(() => { location.hash = x.v; }, 200); return;
        case 'url': try { window.open(x.v, '_blank'); } catch (e) { /* */ } return;
        case 'sic': this.ui.set.icon = x.v; return this.update();
        case 'sarea': this.ui.set.area = x.v || null; return this.update();
        case 'stg': this.ui.set[x.v] = !this.ui.set[x.v]; return this.update();
        case 'sreset': this.ui.set = null; this.ui.setErr = ''; return this.update();
        case 'ssave': return this.saveSet();
        case 'browse': this.close(); setTimeout(() => { if (window.MSH && window.MSH.ha) window.MSH.ha.open('media', { player: s.entity_id }); }, 250); return;
        case 'copy': try { navigator.clipboard.writeText(s.entity_id); } catch (e) { /* */ } if (window.kiNote) window.kiNote('Kopiert: ' + s.entity_id); return;
      }
    }
    // Generisk slider: relativ dra for de store vertikale (som iOS), absolutt for horisontale. Live-kall under dra for lys/volum.
    dragSl(el, e) {
      e.stopPropagation();
      const x = el.dataset, min = +x.min, max = +x.max, step = +x.step || 1, v = el.classList.contains('v'), g = el.classList.contains('g');
      const r = el.getBoundingClientRect(), k = x.sl, s = this.s; if (!s) return;
      const span = max - min || 1, v0 = +x.v;
      const snap = (val) => clamp(Math.round((val - min) / step) * step + min, min, max);
      const abs = (ev) => { const p = v ? 1 - (ev.clientY - r.top) / r.height : g ? (ev.clientX - r.left - 22) / (r.width - 44) : (ev.clientX - r.left) / r.width; return snap(min + clamp(p, 0, 1) * span); };
      const sy = e.clientY;
      const rel = (ev) => snap(v0 + ((sy - ev.clientY) / r.height) * span);
      let cur = v ? v0 : abs(e), moved = false, lastLive = 0;
      this._sliding = true; el.classList.add('drag');
      try { el.setPointerCapture(e.pointerId); } catch (_) { /* */ }
      const show = (val) => {
        const p = (val - min) / span, fill = el.querySelector('.fill'), kn = el.querySelector('.kn');
        if (fill) { if (v) fill.style.height = `calc(60px + ${p} * (100% - 60px))`; else fill.style.width = `calc(56px + ${p} * (100% - 56px))`; fill.style.opacity = 1; }
        if (kn) { kn.style.left = `calc(22px + ${p} * (100% - 44px))`; if (k === 'ct') kn.style.background = rgbS(kRgb(val)); }
        const ico = el.querySelector('.ico'); if (ico) ico.style.color = v || p > 0.4 ? DARK : TX;
        const txt = this.fmt(val, x.fmt, x.u);
        this.root.querySelectorAll(`[data-out="${k}"]`).forEach((o) => { o.textContent = txt; if (o.classList.contains('vv')) o.style.color = p > 0.9 ? DARK : TX; });
        if (k === 'bri' || k === 'fan' || k === 'pos' || k === 'hum' || k === 'vpos') { const big = this.root.querySelector('.bdy > .val'); if (big) big.innerHTML = k === 'bri' || k === 'fan' ? (val ? `${Math.round(val)}<small>%</small>` : 'Av') : `${Math.round(val)}<small>%</small>`; }
        if (k === 'num') { const big = this.root.querySelector('.bdy > .val'); if (big) big.firstChild.nodeValue = this.fmt(val, 'num', ''); }
      };
      show(cur);
      const mv = (ev) => { const n = v ? rel(ev) : abs(ev); if (Math.abs(ev.clientY - sy) > 3 || !v) moved = true; if (n !== cur) { cur = n; show(n); if (Math.round(n) % 10 === 0) this.haptic('selection'); if (+x.live && Date.now() - lastLive > 350) { lastLive = Date.now(); this.commit(k, n, s); } } };
      const up = (ev) => {
        el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up);
        el.classList.remove('drag');
        if (v && !moved && ev.type === 'pointerup') { cur = abs(ev); show(cur); } // trykk uten dra = hopp dit
        this.commit(k, cur, s); this.haptic('light');
        setTimeout(() => { this._sliding = false; this._sig = null; this.refresh(); }, 300);
      };
      el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    }
    commit(k, v, s) {
      const d = DOM(s.entity_id);
      if (k === 'bri') return this.call('light', v ? 'turn_on' : 'turn_off', v ? { brightness_pct: Math.round(v) } : {});
      if (k === 'ct') return this.call('light', 'turn_on', { color_temp_kelvin: Math.round(v) });
      if (k === 'fan') return this.call('fan', v ? 'set_percentage' : 'turn_off', v ? { percentage: Math.round(v) } : {});
      if (k === 'pos') return this.call('cover', 'set_cover_position', { position: Math.round(v) });
      if (k === 'tilt') return this.call('cover', 'set_cover_tilt_position', { tilt_position: Math.round(v) });
      if (k === 'vol') return this.call('media_player', 'volume_set', { volume_level: Math.round(v) / 100 });
      if (k === 'hum') return this.call('humidifier', 'set_humidity', { humidity: Math.round(v) });
      if (k === 'chum') return this.call('climate', 'set_humidity', { humidity: Math.round(v) });
      if (k === 'vpos') return this.call('valve', 'set_valve_position', { position: Math.round(v) });
      if (k === 'num') return this.call(d, 'set_value', { value: v });
    }
    dragDial(el, e) {
      const s = this.s; if (!s) return;
      const svg = el.querySelector('svg'), r = svg.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const dx0 = e.clientX - cx, dy0 = e.clientY - cy, dist = Math.hypot(dx0, dy0) / (r.width / 2);
      if (dist < 0.62 || dist > 1.15) return; // bare ringen, midten scroller
      e.stopPropagation(); e.preventDefault();
      const min = +el.dataset.min, max = +el.dataset.max, step = +el.dataset.step || 0.5;
      this._sliding = true; try { el.setPointerCapture(e.pointerId); } catch (_) { /* */ }
      let cur = null;
      const calc = (ev) => { let ang = (Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180) / Math.PI; ang = (ang + 360) % 360; let rel = ang - 135; if (rel < 0) rel += 360; if (rel > 270) rel = rel > 315 ? 0 : 270; return clamp(Math.round((min + (rel / 270) * (max - min)) / step) * step, min, max); };
      const show = (t) => { if (t === cur) return; cur = t; this.haptic('selection'); const s2 = { ...s, attributes: { ...s.attributes, temperature: t } }; const col = HVAC_COL[s.state] || C.orange; const tmp = document.createElement('template'); tmp.innerHTML = this.dial(s2, t, min, max, s.state === 'off' ? CTRL : col, el.querySelector('.mid .sub').innerHTML); morph(el, tmp.content.firstElementChild); };
      show(calc(e));
      const mv = (ev) => show(calc(ev));
      const up = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); if (cur != null) this.call(DOM(s.entity_id), 'set_temperature', { temperature: cur }); setTimeout(() => { this._sliding = false; this._sig = null; this.refresh(); }, 300); };
      el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    }
    dragWheel(el, e) {
      e.stopPropagation(); e.preventDefault();
      const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, R = r.width / 2, kn = el.querySelector('.kn');
      this._sliding = true; el.classList.add('drag'); try { el.setPointerCapture(e.pointerId); } catch (_) { /* */ }
      let hs = null, last = 0;
      const calc = (ev) => { const dx = ev.clientX - cx, dy = ev.clientY - cy; const h = Math.round(((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360), sat = Math.round(clamp(Math.hypot(dx, dy) / R, 0, 1) * 100); return [h, sat]; };
      const show = (v) => { hs = v; const a = (v[0] * Math.PI) / 180, rr = (v[1] / 100) * 50; kn.style.left = 50 + Math.cos(a) * rr + '%'; kn.style.top = 50 + Math.sin(a) * rr + '%'; const c = rgbS(hsRgb(v[0], v[1])); kn.style.background = c; const gl = el.parentNode; if (gl && gl.classList.contains('glow')) gl.style.setProperty('--gc', c); if (Date.now() - last > 400) { last = Date.now(); this.call('light', 'turn_on', { hs_color: v }); } };
      show(calc(e));
      const mv = (ev) => show(calc(ev));
      const up = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); el.classList.remove('drag'); if (hs) this.call('light', 'turn_on', { hs_color: hs }); this.haptic('light'); setTimeout(() => { this._sliding = false; this._sig = null; this.refresh(); }, 300); };
      el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    }
    dragSeek(el, e) {
      e.stopPropagation();
      const r = el.getBoundingClientRect(), D = +el.dataset.seek, i = el.querySelector('i');
      this._sliding = true; try { el.setPointerCapture(e.pointerId); } catch (_) { /* */ }
      let p = 0;
      const show = (ev) => { p = clamp((ev.clientX - r.left) / r.width, 0, 1); i.style.transition = 'none'; i.style.width = p * 100 + '%'; };
      show(e);
      const up = () => { el.removeEventListener('pointermove', show); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); i.style.transition = ''; this.call('media_player', 'media_seek', { seek_position: Math.round(p * D) }); setTimeout(() => { this._sliding = false; this._sig = null; this.refresh(); }, 300); };
      el.addEventListener('pointermove', show); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    }
    scrub(el, e) {
      const c = this._chart; if (!c) return;
      const r = el.getBoundingClientRect(), cur = el.querySelector('.cur'), tip = el.querySelector('.tip'), dot = el.querySelector('.dot');
      let lastI = -1;
      const show = (ev) => {
        const t = c.t0 + clamp((ev.clientX - r.left) / r.width, 0, 1) * (c.t1 - c.t0);
        let i = 0; while (i < c.pts.length - 1 && c.pts[i + 1].t <= t) i++;
        const p = c.pts[i], x = clamp(((p.t - c.t0) / (c.t1 - c.t0)) * r.width, 0, r.width), y = (1 - (p.v - c.lo) / (c.hi - c.lo)) * r.height;
        cur.style.left = x + 'px'; dot.style.left = x + 'px'; dot.style.top = y + 'px'; tip.style.left = clamp(x, 40, r.width - 40) + 'px';
        tip.textContent = `${nf(p.v, c.dg)} ${c.u} · ${hhmm(new Date(Math.max(p.t, c.t0)))}`;
        if (i !== lastI) { lastI = i; this.haptic('selection'); }
      };
      el.classList.add('scr'); show(e);
      const end = () => { el.classList.remove('scr'); el.removeEventListener('pointermove', show); el.removeEventListener('pointerup', end); el.removeEventListener('pointercancel', end); el.removeEventListener('pointerleave', end); };
      el.addEventListener('pointermove', show); el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); el.addEventListener('pointerleave', end);
    }
    // Dra arket ned for å lukke (håndtak og header)
    dragSheet(g, e) {
      const sh = this.root.querySelector('.sh'); if (!sh) return;
      this._drag = { y: e.clientY, dy: 0, t: Date.now() }; sh.classList.add('drag');
      try { g.setPointerCapture(e.pointerId); } catch (_) { /* */ }
      const mv = (ev) => { if (!this._drag) return; const dy = ev.clientY - this._drag.y; this._drag.dy = dy > 0 ? dy : -Math.sqrt(-dy) * 2; this.style.setProperty('--dy', this._drag.dy + 'px'); };
      const end = () => {
        g.removeEventListener('pointermove', mv); g.removeEventListener('pointerup', end); g.removeEventListener('pointercancel', end);
        if (!this._drag) return; const { dy, t } = this._drag; this._drag = null; sh.classList.remove('drag');
        const fast = dy > 40 && dy / Math.max(1, Date.now() - t) > 0.5;
        if (dy > 110 || fast) { this.haptic('light'); this.close(); } else { this.style.setProperty('--dy', '0px'); if (this._pending) { this._pending = false; this.update(); } }
      };
      g.addEventListener('pointermove', mv); g.addEventListener('pointerup', end); g.addEventListener('pointercancel', end);
    }
  }
  const mi = new KiMoreInfo();
  mi._camN = 0;
  window.__kiMore = mi;
  const mount = () => document.body.appendChild(mi.host);
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
  window.addEventListener('hass-more-info', (e) => { const id = e.detail && e.detail.entityId; if (id) mi.open(id); else mi.close(); });
  window.addEventListener('ki-hass', () => mi.refresh());
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && mi.hasAttribute('open')) mi.close(); });
})();
