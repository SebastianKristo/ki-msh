/* msh-vaer-card (+ innebygd msh-vaer-hero-card) · popup #vaer. Fasit: Vær v4 (spesifisert i Fiks 10), ellers Vær v3.dc.html.
 * Rekkefølge (standard, endres i «Tilpass været»): Toppkort (karusell: Været nå med heroFx · Andre varsler · Pollen, prikker)
 * · Farevarsler (utvidbare, skjult uten varsler) · Time for time · Dagskort (utvidbare, én åpen) · Detaljkort (2×N) · Månefase
 * · knappen «Tilpass været» (alltid nederst).
 * Config: sections [hero, alerts, hours, days, tiles, moon] · hidden_sections [] · tiles [sky, wind, gust, sun, hum, uv, press, rain]
 *   · hidden_tiles [] · hours (24) · days (7) · show_extras · show_pollen · show_graph (valgfri temperaturgraf etter timene).
 *   Lagres i kortets config (MSH.saveCardConfig) fra «Tilpass været» og er de samme feltene som i GUI-editoren.
 * Prognose: weather/subscribe_forecast (hourly + daily) KUN mens popupen er åpen; faller tilbake til weather.get_forecasts.
 * Toppkortet er innebygd som seksjonen «hero» (egen plassering i rekkefølgen, MSH.HEROES).
 */
(function () {
  const M = window.MSH, esc = M.esc, C = M.C;
  const VERSION = window.KI_MSH_VERSION || '?';
  if (!M.__vaerLogged) { M.__vaerLogged = true; console.info('%c ki-weather-card %c msh-vaer-card ' + VERSION + ' ', 'background:#73b9f2;color:#10202c;font-weight:600;border-radius:4px 0 0 4px;padding:2px 4px', 'background:#3a3a3a;color:#fafafa;border-radius:0 4px 4px 0;padding:2px 4px'); }
  M.VAER_VERSION = VERSION;
  const SUNY = C.yellow, CLOUD = 'var(--gray900, #c7c7c7)', MOON = 'var(--gray700, #979797)', RAIN = C.blue;
  // intern nøkkel → [Material-ikon, etikett, farge]
  const WX = { sun: ['clear_day', 'Sol', SUNY], moon: ['bedtime', 'Klarvær', MOON], part: ['partly_cloudy_day', 'Delvis skyet', SUNY], partn: ['partly_cloudy_night', 'Delvis skyet', MOON], cloud: ['cloud', 'Overskyet', CLOUD], rain: ['rainy', 'Regn', RAIN], sleet: ['weather_mix', 'Sludd', C.lightBlue], snow: ['weather_snowy', 'Snø', 'var(--white, #fafafa)'], fog: ['foggy', 'Tåke', CLOUD], thunder: ['thunderstorm', 'Torden', SUNY], wind: ['air', 'Kraftig vind', RAIN] };
  // «Forhåndsvis vær» i «Tilpass været» (lagres ikke)
  const PREVIEW = ['sun', 'part', 'cloud', 'rain', 'sleet', 'snow', 'fog', 'thunder', 'wind'];
  // HA-condition → [nøkkel, norsk etikett]
  const COND = { sunny: ['sun', 'Sol'], 'clear-night': ['moon', 'Klarvær'], partlycloudy: ['part', 'Delvis skyet'], cloudy: ['cloud', 'Overskyet'], rainy: ['rain', 'Regn'], pouring: ['rain', 'Kraftig regn'], snowy: ['snow', 'Snø'], 'snowy-rainy': ['sleet', 'Sludd'], hail: ['sleet', 'Hagl'], fog: ['fog', 'Tåke'], lightning: ['thunder', 'Torden'], 'lightning-rainy': ['thunder', 'Torden og regn'], windy: ['wind', 'Kraftig vind'], 'windy-variant': ['wind', 'Vind og skyer'], exceptional: ['cloud', 'Ekstremvær'] };
  const WXANIM = { clear_day: 'wx-spin 24s linear infinite', partly_cloudy_day: 'wx-drift 5s ease-in-out infinite', partly_cloudy_night: 'wx-drift 6s ease-in-out infinite', cloud: 'wx-drift 6s ease-in-out infinite', rainy: 'wx-bob 1.1s ease-in-out infinite', weather_mix: 'wx-sway 2.6s ease-in-out infinite', weather_snowy: 'wx-sway 3.4s ease-in-out infinite', foggy: 'wx-fade 4s ease-in-out infinite', thunderstorm: 'wx-flash 3.2s linear infinite', air: 'wx-drift 1.6s ease-in-out infinite', bedtime: 'wx-bob 5s ease-in-out infinite' };
  // Ingen glød / drop-shadow (fiks-3 punkt 9) – bare bevegelse, og værbakgrunnen er klippet i toppkortet.
  const KEYFRAMES = `
    @keyframes wx-spin{to{transform:rotate(360deg)}}
    @keyframes wx-drift{0%,100%{transform:translateX(-4px)}50%{transform:translateX(4px)}}
    @keyframes wx-bob{0%,100%{transform:translateY(-1px)}50%{transform:translateY(3px)}}
    @keyframes wx-sway{0%,100%{transform:rotate(-9deg)}50%{transform:rotate(9deg)}}
    @keyframes wx-flash{0%,86%,100%{opacity:1}88%{opacity:.25}90%{opacity:1}92%{opacity:.35}94%{opacity:1}}
    @keyframes wx-fade{0%,100%{opacity:.5;transform:translateX(-5px)}50%{opacity:1;transform:translateX(5px)}}
    @keyframes wx-rain{0%{transform:translateY(-30px) rotate(12deg);opacity:0}10%{opacity:.85}100%{transform:translateY(260px) rotate(12deg);opacity:0}}
    @keyframes wx-snow{0%{transform:translate(0,-20px);opacity:0}10%{opacity:1}50%{transform:translate(14px,120px)}100%{transform:translate(-8px,260px);opacity:0}}
    @keyframes wx-fog{0%{transform:translateX(-25%)}100%{transform:translateX(25%)}}
    @keyframes wx-bolt{0%,84%,100%{opacity:0}85%,88%{opacity:.55}86%{opacity:.1}}
    @keyframes wx-ray{0%,100%{opacity:.35;transform:scale(1)}50%{opacity:.7;transform:scale(1.12)}}
    @keyframes wx-rays{to{transform:rotate(360deg)}}
    @keyframes wx-wind{0%{transform:translateX(-120%);opacity:0}20%{opacity:.7}100%{transform:translateX(320%);opacity:0}}
    @media (prefers-reduced-motion: reduce){ha-icon,.fx span{animation:none !important}}
  `;
  const f1 = (v) => M.nf(v, 1);
  const num = (v) => (v == null || v === '' || isNaN(Number(v)) ? null : Number(v));
  const hm = (t) => { const d = new Date(t); return `${M.pad(d.getHours())}:${M.pad(d.getMinutes())}`; };
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const wd = (t) => new Date(t).toLocaleDateString('nb-NO', { weekday: 'short' }).replace('.', '');
  const wxIcon = (icon, size, color, extra = '') => M.icon(icon, size, `color:${color};animation:${WXANIM[icon] || 'none'};${extra}`);
  const compass = (b) => {
    if (b == null || b === '') return '';
    if (!M.isNum(b)) return String(b).replace(/W/g, 'V').replace(/E/g, 'Ø');
    return ['N', 'NØ', 'Ø', 'SØ', 'S', 'SV', 'V', 'NV'][Math.round(((Number(b) % 360) + 360) % 360 / 45) % 8];
  };
  // Rekkefølge fra config + nye nøkler til slutt
  const orderOf = (all, cfg) => { const o = Array.isArray(cfg) ? cfg.filter((k, i) => all.includes(k) && cfg.indexOf(k) === i) : []; all.forEach((k) => { if (!o.includes(k)) o.push(k); }); return o; };

  /* ------------------------------------------------------------ prognose-abonnement (delt, refcount) */
  // weather/subscribe_forecast; feiler abonnementet → weather.get_forecasts (return_response) én gang.
  const SUBS = M.__wxSubs || (M.__wxSubs = new Map());
  const getForecasts = (hass, entity, type) => {
    if (!hass || !hass.callWS) return Promise.resolve([]);
    return hass.callWS({ type: 'call_service', domain: 'weather', service: 'get_forecasts', service_data: { type }, target: { entity_id: entity }, return_response: true })
      .then((r) => { const R = (r && (r.response || r)) || {}; return (R[entity] && R[entity].forecast) || []; }).catch(() => []);
  };
  M.wxForecast = function (hass, entity, type, cb) {
    const key = entity + '|' + type;
    let s = SUBS.get(key);
    if (!s) {
      s = { cbs: new Set(), data: null, unsub: null, dead: false };
      SUBS.set(key, s);
      const emit = (fc) => { s.data = Array.isArray(fc) ? fc : []; s.cbs.forEach((f) => f(s.data)); };
      const fallback = () => getForecasts(hass, entity, type).then((fc) => { if (!s.dead) emit(fc); });
      try {
        const p = hass.connection.subscribeMessage((ev) => emit((ev && ev.forecast) || []), { type: 'weather/subscribe_forecast', entity_id: entity, forecast_type: type });
        Promise.resolve(p).then((u) => { if (s.dead) { try { u(); } catch (e) { /* */ } } else s.unsub = u; }).catch(fallback);
      } catch (e) { fallback(); }
    }
    s.cbs.add(cb);
    if (s.data) setTimeout(() => cb(s.data), 0);
    return () => {
      s.cbs.delete(cb);
      if (s.cbs.size) return;
      s.dead = true;
      SUBS.delete(key);
      if (s.unsub) { try { const r = s.unsub(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* */ } }
    };
  };

  /* ------------------------------------------------------------ autokonfig (ingen mock – fallgruve 4) */
  const ALERT_PLAT = ['met_alerts', 'metalerts', 'norway_alerts', 'met_warnings', 'varsom', 'meteoalarm'];
  const homeWeather = (hass) => {
    const all = M.all(hass, 'weather');
    // Hjemsone først (met.no «Hjem» / weather.home / weather.forecast_home), ellers første
    return all.find((id) => /(^weather\.|_)(home|hjem|forecast_home)$/.test(id)) || all.find((id) => /home|hjem/.test(id)) || all[0] || null;
  };
  M.vaerAuto = function (hass, cfg) {
    cfg = cfg || {};
    if (!hass) return { weather: null, sun: null, moon: null, uv: null, pollen: [], pollenAuto: [], alerts: [], alertAuto: [] };
    const weather = M.pick(cfg, 'weather', homeWeather(hass));
    const sun = M.pick(cfg, 'sol', M.all(hass, 'sun')[0] || null);
    const moon = M.pick(cfg, 'mane', M.byPlatform(hass, 'moon', 'sensor')[0] || M.all(hass, 'sensor', (s) => s.attributes.device_class === 'enum' && Array.isArray(s.attributes.options) && s.attributes.options.includes('full_moon'))[0] || null);
    const uv = M.pick(cfg, 'uv', M.all(hass, 'sensor', (s, id) => /(^sensor\.|_)uv(_index|_indeks)?($|_)/.test(id) && !/tomorrow|i_morgen|max/.test(id) && M.isNum(s.state))[0] || null);
    const pollenAuto = M.all(hass, 'sensor', (s, id) => { const p = (M.regEntry(hass, id) || {}).platform || ''; return (/pollen/.test(id) || /pollen|naaf/.test(p)) && !/tomorrow|i_morgen|imorgen/.test(id); });
    const alertAuto = M.all(hass, ['sensor', 'binary_sensor'], (s, id) => ALERT_PLAT.includes((M.regEntry(hass, id) || {}).platform) || /farevarsel|met_?alert|norway_alert|varsom|meteoalarm/.test(id));
    return { weather, sun, moon, uv, pollenAuto, pollen: M.applyLists(cfg, 'pollen', pollenAuto).filter((id) => hass.states[id]), alertAuto, alerts: M.applyLists(cfg, 'varsler', alertAuto).filter((id) => hass.states[id]) };
  };
  const condOf = (c, night) => { const k = (COND[c] || ['cloud', c ? String(c) : '–']); let key = k[0]; if (night && key === 'part') key = 'partn'; if (night && key === 'sun') key = 'moon'; return { key, label: k[1], icon: WX[key][0], color: WX[key][2] }; };
  const condKey = (key) => ({ key, label: WX[key][1], icon: WX[key][0], color: WX[key][2] });
  // Soltider: sol oppe → i dag (next_rising − 1 døgn, next_setting); ellers neste opp/ned.
  const sunTimes = (st) => {
    if (!st) return null;
    const r = new Date(st.attributes.next_rising).getTime(), s = new Date(st.attributes.next_setting).getTime();
    if (isNaN(r) || isNaN(s)) return null;
    const up = st.state === 'above_horizon' || s < r;
    return { rise: s < r ? r - 86400000 : r, set: s, r, s, elev: num(st.attributes.elevation), up };
  };
  const isNight = (t, sun) => {
    if (!sun) { const h = new Date(t).getHours(); return h < 6 || h >= 21; }
    const D = 86400000, a = (((t - sun.s) % D) + D) % D, b = (((sun.r - sun.s) % D) + D) % D;
    return a < b;
  };
  const MOON_N = [['new_moon', 'Nymåne', 0], ['waxing_crescent', 'Voksende månesigd', 0.125], ['first_quarter', 'Første kvarter', 0.25], ['waxing_gibbous', 'Voksende måne', 0.375], ['full_moon', 'Fullmåne', 0.5], ['waning_gibbous', 'Minkende måne', 0.625], ['last_quarter', 'Siste kvarter', 0.75], ['waning_crescent', 'Minkende månesigd', 0.875]];
  const moonOf = (st) => {
    const m = st && MOON_N.find((x) => x[0] === st.state);
    if (m) return { name: m[1], p: m[2] };
    if (!st) return { name: '–', p: 0.25, none: true };
    return { name: String(st.state), p: 0.25 };
  };
  const moonDisc = (p, size) => {
    const k = (1 - Math.cos(2 * Math.PI * p)) / 2, dark = (1 - k) * 100, wax = p < 0.5;
    return `<div class="moon" style="width:${size}px;height:${size}px"><div style="position:absolute;top:0;bottom:0;${wax ? 'left:0' : 'right:0'};width:${dark.toFixed(1)}%;background:#16161a;box-shadow:${wax ? '6px' : '-6px'} 0 14px rgba(0,0,0,0.5)"></div></div>`;
  };
  const uvOf = (v) => (v == null ? ['–', 'var(--gray600, #7f7f7f)'] : v < 1 ? ['Svært lav', C.green] : v < 3 ? ['Lav', C.green] : v < 6 ? ['Moderat', C.yellow] : v < 8 ? ['Høy', C.orange] : v < 11 ? ['Svært høy', C.red] : ['Ekstrem', C.purple]);
  // Værbakgrunn i toppkortet (heroFx): regn, snø, sludd, tåkebånd, lyn-blink, solstråler, skyer, vindstriper.
  const heroFx = (k) => {
    const P = [], rnd = (i) => (i * 37) % 100;
    const drops = (n, col, dur) => { for (let i = 0; i < n; i++) P.push(['r', `left:${rnd(i)}%;top:0;width:2px;height:16px;border-radius:1px;background:${col};animation:wx-rain ${(dur + (i % 5) * 0.12).toFixed(2)}s linear ${(-((i * 0.17) % 1.2)).toFixed(2)}s infinite`]); };
    const flakes = (n, dur) => { for (let i = 0; i < n; i++) { const sz = 4 + (i % 3) * 2; P.push(['s', `left:${rnd(i)}%;top:0;width:${sz}px;height:${sz}px;border-radius:${sz / 2}px;background:rgba(250,250,250,0.85);animation:wx-snow ${(dur + (i % 4) * 0.9).toFixed(2)}s linear ${(-((i * 0.6) % 5)).toFixed(2)}s infinite`]); } };
    const rain = M.alpha(C.blue, 0.55);
    if (k === 'rain' || k === 'thunder') drops(26, rain, 0.7);
    if (k === 'sleet') { drops(14, M.alpha(C.blue, 0.5), 0.8); flakes(12, 3.4); }
    if (k === 'snow') flakes(28, 4.2);
    if (k === 'fog') [18, 62, 108, 150].forEach((y, i) => P.push(['f', `left:-30%;top:${y}px;width:160%;height:36px;border-radius:18px;background:linear-gradient(90deg, transparent, rgba(220,220,220,0.16), rgba(220,220,220,0.22), transparent);filter:blur(6px);animation:wx-fog ${7 + i * 1.5}s ease-in-out ${-i * 2}s infinite alternate`]));
    if (k === 'thunder') P.push(['b', 'inset:0;background:rgba(255,255,240,0.5);animation:wx-bolt 4.5s linear infinite']);
    if (k === 'sun') {
      P.push(['sr', `right:-60px;top:-60px;width:300px;height:300px;border-radius:150px;background:radial-gradient(circle, ${M.alpha(SUNY, 0.28)}, transparent 65%);animation:wx-ray 5s ease-in-out infinite`]);
      P.push(['sb', `right:-150px;top:-150px;width:480px;height:480px;border-radius:240px;background:repeating-conic-gradient(from 0deg, ${M.alpha(SUNY, 0.1)} 0deg 6deg, transparent 6deg 22deg);-webkit-mask:radial-gradient(circle, #000 20%, transparent 62%);mask:radial-gradient(circle, #000 20%, transparent 62%);animation:wx-rays 60s linear infinite`]);
    }
    if (k === 'part' || k === 'cloud' || k === 'partn') [[-10, 20, 220], [40, 90, 260]].forEach(([x, y, w], i) => P.push(['c', `left:${x}%;top:${y}px;width:${w}px;height:70px;border-radius:35px;background:rgba(255,255,255,${k === 'cloud' ? 0.07 : 0.05});filter:blur(10px);animation:wx-drift ${8 + i * 3}s ease-in-out infinite`]));
    if (k === 'wind') for (let i = 0; i < 7; i++) P.push(['w', `left:0;top:${20 + i * 24}px;width:${90 + (i % 3) * 40}px;height:2px;border-radius:1px;background:linear-gradient(90deg, transparent, rgba(220,230,245,0.45), transparent);animation:wx-wind ${(1.4 + (i % 4) * 0.3).toFixed(1)}s linear ${(-i * 0.4).toFixed(1)}s infinite`]);
    return P.map(([t, s]) => `<span data-fx="${t}" style="position:absolute;${s}"></span>`).join('');
  };
  // Horisontal sveip (karusell/timeliste): la nettleseren scrolle vannrett, men stopp Bubble Cards swipe-to-close.
  const guardSwipe = (el, ta = 'pan-x') => {
    if (!el || el.__mshSwipe) return;
    el.__mshSwipe = true;
    el.__mshTA = ta; // bevares av MSH.morph
    el.style.touchAction = el.__mshTA;
    const stop = (e) => e.stopPropagation();
    ['pointerdown', 'touchstart', 'touchmove'].forEach((t) => el.addEventListener(t, stop, { passive: true }));
  };

  /* ------------------------------------------------------------ felles prognose-mixin */
  const Forecast = (Base) => class extends Base {
    _types(st) {
      const sf = st ? num(st.attributes.supported_features) : null;
      const t = [];
      if (sf == null || sf & 2) t.push('hourly');
      if (sf == null || sf & 1) t.push('daily');
      return t;
    }
    onOpen() { this._subscribe(); }
    onClose() { this._unsubscribe(); }
    _subscribe() {
      const ent = M.vaerAuto(this.hass, this.config).weather, st = ent && this.hass.states[ent];
      this._unsubscribe();
      this._subEnt = ent;
      if (!st || !this.hass.connection || !this.hass.connection.subscribeMessage) return;
      this._uns = this._types(st).map((t) => M.wxForecast(this.hass, ent, t, (fc) => { if (this._subEnt !== ent) return; this._fc = { ...(this._fc || {}), [t]: Array.isArray(fc) ? fc : [] }; this.update(); }));
    }
    _unsubscribe() { (this._uns || []).forEach((u) => u()); this._uns = null; }
    _checkEnt(ent) {
      if (this.isOpen && ent !== this._subEnt && !this._resub) { this._resub = true; setTimeout(() => { this._resub = false; this._fc = null; this._subscribe(); }, 0); }
    }
    get hourly() { const now = Date.now() - 3600000; return ((this._fc && this._fc.hourly) || []).filter((f) => new Date(f.datetime).getTime() >= now); }
    get daily() { return (this._fc && this._fc.daily) || []; }
  };
  const todayOf = (daily) => { const d = daily[0]; return d && new Date(d.datetime).toDateString() === new Date().toDateString() ? d : null; };
  const pollenLevel = (st) => {
    if (!st || M.unavailable(st)) return null;
    const s = String(st.state).toLowerCase();
    if (M.isNum(s)) return M.clamp(Math.round(Number(s)), 0, 4);
    return /ekstrem|extreme|very.?high/.test(s) ? 4 : /kraftig|severe|high|høy/.test(s) ? 3 : /moderat|moderate|middels|medium/.test(s) ? 2 : /beskjeden|low|lav|lite/.test(s) ? 1 : 0;
  };
  const PL = [['Ingen', 'var(--gray600, #7f7f7f)'], ['Beskjeden', C.green], ['Moderat', C.yellow], ['Kraftig', C.orange], ['Ekstrem', C.red]];
  const POLLEN = [[/hassel|hazel/, 'Hassel', 'nature'], [/(^|_|\s)or($|_|\s)|alder|older/, 'Or', 'forest'], [/salix|selje|willow|vier/, 'Salix', 'spa'], [/bjork|bjørk|birch/, 'Bjørk', 'park'], [/gress|grass/, 'Gress', 'grass'], [/burot|mugwort|artemisia/, 'Burot', 'eco']];

  /* ================================================================ toppkort (hero) */
  class VaerHero extends Forecast(M.Card) {
    static get cardName() { return 'Vær · toppkort'; }
    static get defaults() { return { show_extras: true, show_pollen: true }; }
    static get schema() {
      return (h, c) => [
        { type: 'text', name: 'name', label: 'Stedsnavn', auto: (hh) => (hh.config && hh.config.location_name) || null, placeholder: 'Fra HA / værentiteten' },
        { type: 'overrides', label: 'Bytt entiteter', fields: FIELDS },
        { type: 'lists', label: 'Pollen', lists: (hh, cc) => [{ key: 'pollen', label: 'Pollensensorer', ids: M.vaerAuto(hh, cc).pollenAuto, domains: ['sensor'] }] },
        { type: 'section', label: 'Visning', icon: 'mdi:eye-outline', id: 'view', fields: VIEW_FIELDS },
      ];
    }
    get cardSize() { return 4; }
    get preview() { return (this._host && this._host._preview) || this._preview || null; }
    render() {
      const c = this.config, h = this.hass, a = M.vaerAuto(h, c);
      this._checkEnt(a.weather);
      const st = this.s(a.weather), A = (st && st.attributes) || {};
      const sunSt = this.s(a.sun), sun = sunTimes(sunSt), moon = moonOf(this.s(a.moon)), uvSt = this.s(a.uv);
      a.pollen.forEach((id) => this.s(id));
      const night = sunSt ? sunSt.state === 'below_horizon' : isNight(Date.now(), null);
      const pv = this.preview && WX[this.preview] ? this.preview : null;
      const cond = pv ? condKey(pv) : st ? condOf(st.state, night) : null;
      const H = this.hourly, today = todayOf(this.daily);
      const place = c.name || (h.config && h.config.location_name) || (st ? M.name(h, a.weather) : '–');
      const temp = st ? num(A.temperature) : null;
      const feels = num(A.apparent_temperature) != null ? `Føles som ${f1(A.apparent_temperature)}°` : today && num(today.temperature) != null ? `H ${Math.round(today.temperature)}° · L ${today.templow != null ? Math.round(today.templow) + '°' : '–'}` : 'Føles som –';
      const wu = A.wind_speed_unit || 'm/s', pu = A.precipitation_unit || 'mm';
      const wind = num(A.wind_speed) != null ? `${f1(A.wind_speed)} ${wu} ${compass(A.wind_bearing)}`.trim() : `– ${wu}`;
      const rain = H[0] && num(H[0].precipitation) != null ? `${f1(H[0].precipitation)} ${pu}` : `– ${pu}`;
      const uv = uvSt && M.isNum(uvSt.state) ? num(uvSt.state) : num(A.uv_index) != null ? num(A.uv_index) : H[0] && num(H[0].uv_index) != null ? num(H[0].uv_index) : null;
      const col = cond ? cond.color : 'var(--gray600, #7f7f7f)';
      const slides = [];
      slides.push(`<div class="sl now" data-key="s0" data-fxk="${cond ? cond.key : ''}" ${a.weather ? `data-ent="${esc(a.weather)}"` : ''}>
        <div class="fx" data-key="fx-${cond ? cond.key : 'none'}">${cond ? heroFx(cond.key) : ''}</div>
        <span class="pl">Været nå · ${esc(place)}${pv ? '<span class="pvt">Forhåndsvisning</span>' : ''}</span>
        <span class="tv"><span class="big num">${temp != null ? f1(temp) : '–'}°</span><span class="fl">${esc(feels)}</span></span>
        <span class="meta">${st || pv ? `<span>${esc(cond.label)}</span><span>${esc(wind)}</span><span>${esc(rain)}</span>` : `<button class="pick press" data-act="customize" data-section="overrides">${M.icon('mdi:plus', 18)}Velg entitet</button>`}</span>
        <span class="hi">${wxIcon(cond ? cond.icon : 'cloud', 120, col)}</span>
      </div>`);
      if (c.show_extras !== false) {
        const uvL = uvOf(uv);
        const X = [['mdi:weather-sunset-up', sun ? hm(sun.rise) : '–', C.orange, 'Soloppgang'], ['mdi:weather-sunset-down', sun ? hm(sun.set) : '–', C.pink, 'Solnedgang'], ['bedtime', moon.name, MOON, 'Månefase'], ['light_mode', uv != null ? `UV ${uvL[0].toLowerCase()} (${f1(uv)})` : 'UV –', SUNY, 'UV']];
        slides.push(`<div class="sl ex" data-key="s1"><span class="pl" style="padding:0 8px">Andre varsler</span>
          <div class="exg">${X.map(([ic, lab, co, al], i) => `<div class="ext" data-key="x${i}" aria-label="${al}">${M.icon(ic, 30, `color:${co};animation:${i === 2 ? WXANIM.bedtime : i === 3 ? 'wx-spin 24s linear infinite' : 'none'}`)}<span>${esc(lab)}</span></div>`).join('')}</div></div>`);
      }
      if (c.show_pollen !== false) {
        const src = a.pollen.length ? (h.states[a.pollen[0]].attributes.attribution || (/naaf/.test((M.regEntry(h, a.pollen[0]) || {}).platform || '') ? 'NAAF' : '')) : '';
        const found = a.pollen.map((id) => {
          const ps = h.states[id], key = (id + ' ' + (ps.attributes.friendly_name || '')).toLowerCase(), hit = POLLEN.find((p) => p[0].test(key));
          return { id, std: hit ? hit[1] : null, name: hit ? hit[1] : M.name(h, id).replace(/pollen/i, '').trim() || M.name(h, id), icon: hit ? hit[2] : 'grass', lv: pollenLevel(ps) };
        });
        // 3×2: standardartene (NAAF) i fast rekkefølge – mangler en sensor vises «–»; ekstra sensorer til slutt.
        const P = POLLEN.map(([, n, ic]) => found.find((f) => f.std === n) || { id: null, name: n, icon: ic, lv: null });
        found.filter((f) => !f.std).forEach((f) => P.push(f));
        const shown = found.length > 6 ? found.slice(0, 6) : P.slice(0, 6);
        slides.push(`<div class="sl po" data-key="s2"><span class="ph"><span class="pl">Pollen i dag</span>${found.length ? `<span class="src ell">${esc(String(src || '').slice(0, 24))}</span>` : `<button class="src lnk" data-act="customize" data-section="overrides" data-haptic="selection">Velg sensorer</button>`}</span>
          <div class="pg">${shown.map((p, i) => { const L = p.lv == null ? ['–', 'var(--gray600, #7f7f7f)'] : PL[p.lv]; return `<div class="pt" ${p.id ? `data-ent="${esc(p.id)}"` : ''} data-key="p${i}-${esc(p.id || p.name)}">${M.icon(p.icon, 20, `color:${L[1]}`)}<span class="col" style="min-width:0"><span class="pn ell">${esc(p.name)}</span><span style="font-size:10px;color:${L[1]}">${L[0]}</span></span></div>`; }).join('')}</div></div>`);
      }
      const cur = Math.min(this.ui.hero || 0, slides.length - 1);
      return `<section class="hero">
        <div class="car noscroll" data-key="car">${slides.join('')}</div>
        ${slides.length > 1 ? `<div class="dots">${slides.map((_, i) => `<button class="dt" data-act="slide" data-i="${i}" data-haptic="selection" aria-label="Side ${i + 1}" style="width:${i === cur ? 12 : 10}px;height:${i === cur ? 12 : 10}px;background:${i === cur ? 'var(--gray600, #7f7f7f)' : 'var(--gray400, #545454)'}"></button>`).join('')}</div>` : ''}
      </section>`;
    }
    onAction(name, el, ev) {
      if (name === 'slide') {
        const car = this.shadowRoot.querySelector('.car'), i = Number(el.dataset.i);
        if (car) car.scrollTo({ left: i * car.clientWidth, behavior: 'smooth' });
        return this.setUI({ hero: i });
      }
      return super.onAction(name, el, ev);
    }
    showSlide(i) { const car = this.shadowRoot && this.shadowRoot.querySelector('.car'); if (car) car.scrollTo({ left: i * car.clientWidth, behavior: 'smooth' }); }
    afterRender() {
      const car = this.shadowRoot.querySelector('.car');
      if (!car || car.__b) return;
      car.__b = true;
      guardSwipe(car, 'pan-x');
      car.addEventListener('scroll', () => {
        const n = Math.round(car.scrollLeft / Math.max(1, car.clientWidth));
        if (n !== (this.ui.hero || 0)) { M.haptic('selection'); this.setUI({ hero: n }); }
      }, { passive: true });
    }
    get styles() {
      return `${KEYFRAMES}
        .hero{display:flex;flex-direction:column;align-items:center;gap:10px}
        .car{width:100%;display:flex;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;border-radius:28px;overscroll-behavior-x:contain;touch-action:pan-x}
        .sl{flex:none;width:100%;scroll-snap-align:start;scroll-snap-stop:always;min-height:190px;border-radius:28px;background:var(--gray200,#3a3a3a);display:flex;flex-direction:column}
        .now{position:relative;padding:22px 24px;justify-content:space-between;overflow:hidden}
        .fx{position:absolute;inset:0;overflow:hidden;border-radius:28px;pointer-events:none}
        .pl{position:relative;z-index:1;font-size:14px;color:var(--gray900,#c7c7c7);display:flex;align-items:center;gap:8px}
        .pvt{font-size:11px;font-weight:600;padding:2px 8px;border-radius:8px;background:rgba(255,255,255,0.12);color:var(--white,#fafafa)}
        .tv{position:relative;z-index:1;display:flex;align-items:flex-end;gap:6px}
        .big{font-size:64px;font-weight:300;letter-spacing:-0.04em;line-height:1}
        .fl{font-size:15px;color:var(--gray800,#afafaf);padding-bottom:6px;white-space:nowrap}
        .meta{position:relative;z-index:1;display:flex;gap:14px;font-size:14px;color:var(--gray900,#c7c7c7);white-space:nowrap}
        .hi{position:absolute;right:20px;top:50%;transform:translateY(-50%);line-height:0;pointer-events:none}
        .ex,.po{padding:20px 16px 16px}
        .ex{gap:14px}
        .po{gap:12px}
        .exg{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
        .ext{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;height:112px;border-radius:22px;background:var(--gray100,#2f2f2f);min-width:0}
        .ext span{font-size:12px;color:var(--gray900,#c7c7c7);text-align:center;line-height:1.25;padding:0 4px}
        .ph{display:flex;justify-content:space-between;align-items:baseline;gap:8px;padding:0 8px}
        .src{font-size:11px;color:var(--gray600,#7f7f7f)}
        .lnk{color:var(--gray800,#afafaf);text-decoration:underline}
        .pg{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
        .pt{display:flex;align-items:center;gap:8px;height:53px;padding:0 10px;border-radius:18px;background:var(--gray100,#2f2f2f);min-width:0}
        .pn{font-size:12px;font-weight:500}
        .dots{display:flex;gap:8px;height:14px;align-items:center}
        .dt{border-radius:6px;transition:background .2s}
      `;
    }
  }
  M.define('msh-vaer-hero-card', VaerHero, 'MSH Vær · toppkort', 'Været nå med værbakgrunn, sol/måne/UV og pollen i en sveipbar karusell. Innebygd i msh-vaer-card.');

  /* ================================================================ hovedkort */
  const SECS = [['hero', 'Toppkort', 'mdi:view-carousel-outline'], ['alerts', 'Farevarsler', 'warning'], ['hours', 'Time for time', 'schedule'], ['days', 'Dagskort', 'calendar_month'], ['tiles', 'Detaljkort', 'grid_view'], ['moon', 'Månefase', 'bedtime']];
  const TILES = [['sky', 'Skydekke', 'cloud'], ['wind', 'Vind', 'air'], ['gust', 'Vindkast', 'storm'], ['sun', 'Sol opp og ned', 'wb_twilight'], ['hum', 'Fukt', 'humidity_percentage'], ['uv', 'UV-indeks', 'light_mode'], ['press', 'Trykk', 'compress'], ['rain', 'Nedbør', 'water_drop']];
  const SK = SECS.map((s) => s[0]), TK = TILES.map((t) => t[0]);
  const FIELDS = [
    { name: 'weather', label: 'Værmelding', domain: 'weather', auto: (hh) => homeWeather(hh) },
    { name: 'sol', label: 'Sol', domain: 'sun', auto: (hh) => M.all(hh, 'sun')[0] || null },
    { name: 'mane', label: 'Månefase', domain: 'sensor', auto: (hh, cc) => M.vaerAuto(hh, { ...cc, overrides: {} }).moon },
    { name: 'uv', label: 'UV-indeks (valgfri sensor)', domain: 'sensor', auto: (hh, cc) => M.vaerAuto(hh, { ...cc, overrides: {} }).uv },
  ];
  const VIEW_FIELDS = [
    { type: 'boolean', name: 'show_extras', label: 'Toppkort side 2 · Andre varsler (sol, måne, UV)', default: true },
    { type: 'boolean', name: 'show_pollen', label: 'Toppkort side 3 · Pollen i dag', default: true },
  ];
  const LV = { 1: ['Grønt', C.green], 2: ['Gult', C.yellow], 3: ['Oransje', C.orange], 4: ['Rødt', C.red], 5: ['Svart', 'var(--white, #fafafa)'] };
  const ATYPE = [[/snøskred|avalanche/, 'ac_unit'], [/skogbrann|forest.?fire|brann/, 'local_fire_department'], [/stormflo|storm.?surge|kyst|coast/, 'waves'], [/jord|landslide|skred/, 'mdi:landslide'], [/flom|flood/, 'flood'], [/ising|ice|polar/, 'severe_cold'], [/torden|lightning|thunder/, 'thunderstorm'], [/snø|snow|blowing/, 'weather_snowy'], [/regn|rain/, 'rainy'], [/vind|wind|gale|storm/, 'air']];
  const whenTxt = (t) => {
    if (!t || isNaN(t)) return '';
    return (new Date(t).toDateString() === new Date().toDateString() ? 'i dag ' : wd(t) + ' ') + hm(t);
  };
  // Farevarsler fra met_alerts / norway_alerts / meteoalarm / sensor.*_farevarsel – leses defensivt.
  function parseAlerts(hass, id) {
    const st = hass.states[id];
    if (!st || M.unavailable(st) || (id.startsWith('binary_sensor.') && st.state === 'off')) return [];
    const A = st.attributes || {}, plat = (M.regEntry(hass, id) || {}).platform || '';
    const list = Array.isArray(A.alerts) ? A.alerts : Array.isArray(A.warnings) ? A.warnings : (A.title || A.headline || A.awareness_level || A.event || A.level != null) ? [A] : [];
    return list.map((x, i) => {
      if (!x || typeof x !== 'object') return null;
      const lvRaw = x.awareness_level != null ? x.awareness_level : x.level != null ? x.level : x.color || x.level_color || x.severity;
      let lv = parseInt(lvRaw, 10);
      if (isNaN(lv)) { const s = String(lvRaw || '').toLowerCase(); lv = /red|rød|extreme/.test(s) ? 4 : /orange|severe/.test(s) ? 3 : /yellow|gul|moderate/.test(s) ? 2 : /green|grønn|minor/.test(s) ? 1 : 0; }
      const txt = [x.event, x.awareness_type, x.title, x.event_awareness_name, x.headline, id].filter(Boolean).join(' ').toLowerCase();
      const ty = ATYPE.find((t) => t[0].test(txt));
      const from = new Date(x.starttime || x.start || x.onset || x.effective || x.valid_from || '').getTime();
      const to = new Date(x.endtime || x.end || x.expires || x.valid_to || '').getTime();
      const blocks = [['Konsekvenser', x.consequences], ['Råd', x.instruction || x.advice], ['Område', x.area || x.area_desc || x.municipality || x.county]].filter((b) => b[1]).map(([l, v]) => [l, Array.isArray(v) ? v.join(', ') : String(v)]);
      const s0 = plat + ' ' + (x.source || '') + ' ' + id;
      const src = /nve|varsom/.test(s0) ? 'NVE · Varsom' : /meteoalarm/.test(s0) ? 'Meteoalarm' : /met/.test(s0) || plat === 'norway_alerts' ? 'Met.no' : (x.source || plat || 'Varsel');
      const future = !isNaN(from) && from > Date.now();
      return { key: `${id}#${i}`, ent: id, lv: M.clamp(lv, 0, 5), icon: ty ? ty[1] : 'warning', title: x.title || x.headline || x.event_awareness_name || x.event || M.name(hass, id), from, to, future,
        status: future ? `Fra ${new Date(from).toDateString() === new Date().toDateString() ? '' : wd(from) + ' '}kl ${hm(from)}` : 'Pågår', text: x.description || '', blocks, src: `${src} · ${id}`,
        url: x.map_url || x.web || x.url || (Array.isArray(x.resources) && x.resources[0] && (x.resources[0].uri || x.resources[0].url)) || '' };
    }).filter((x) => x && x.lv > 1);
  }

  class Vaer extends Forecast(M.Card) {
    static get cardName() { return 'Vær'; }
    static get defaults() { return { hours: 24, days: 7, show_graph: false, show_extras: true, show_pollen: true }; }
    static get schema() {
      return () => [
        { type: 'overrides', label: 'Bytt entiteter', fields: FIELDS },
        { type: 'order', name: 'sections', hiddenName: 'hidden_sections', label: 'Seksjoner', options: SECS.map((s) => [s[0], s[1]]) },
        { type: 'order', name: 'tiles', hiddenName: 'hidden_tiles', label: 'Detaljkort', options: TILES.map((t) => [t[0], t[1]]) },
        { type: 'section', label: 'Toppkort', icon: 'mdi:view-carousel-outline', id: 'view', fields: [{ type: 'text', name: 'name', label: 'Stedsnavn', auto: (hh) => (hh.config && hh.config.location_name) || null, placeholder: 'Fra HA / værentiteten' }, ...VIEW_FIELDS] },
        { type: 'section', label: 'Prognose', icon: 'mdi:calendar-clock', id: 'forecast', fields: [
          { type: 'number', name: 'hours', label: 'Timer i «Time for time»', min: 12, max: 48, placeholder: '24' },
          { type: 'number', name: 'days', label: 'Antall dagskort', min: 1, max: 10, placeholder: '7' },
          { type: 'boolean', name: 'show_graph', label: 'Temperaturgraf med scrub (etter Time for time)', default: false },
        ] },
        { type: 'lists', label: 'Farevarsler og pollen', lists: (hh, cc) => { const a = M.vaerAuto(hh, cc); return [{ key: 'varsler', label: 'Varselsensorer (Met.no / NVE / Meteoalarm)', ids: a.alertAuto, domains: ['sensor', 'binary_sensor'] }, { key: 'pollen', label: 'Pollensensorer', ids: a.pollenAuto, domains: ['sensor'] }]; } },
        { type: 'gap' },
      ];
    }
    get cardSize() { return 12; }
    // Toppkortet monteres i seksjonen «hero» (egen plassering i rekkefølgen), ikke i basens faste plass øverst.
    _mountHero(tag) {
      const slot = this.shadowRoot.querySelector('.vh-slot');
      if (!customElements.get(tag)) return;
      if (!this._heroEl) { this._heroEl = document.createElement(tag); this._heroEl._host = this; }
      if (!slot) { if (this._heroEl.parentNode) this._heroEl.remove(); return; }
      const raw = this._rawConfig || {};
      if (this._heroSrc !== raw) {
        this._heroSrc = raw;
        const { type, card_id, hero, sections, hidden_sections, tiles, hidden_tiles, ...rest } = raw;
        this._heroEl.setConfig({ type: 'custom:' + tag, ...rest, ...(hero || {}), embedded: true, card_id: card_id ? card_id + '_hero' : undefined });
      }
      if (this._heroEl.parentNode !== slot) slot.appendChild(this._heroEl);
      if (this._heroEl.hass !== this._hass) this._heroEl.hass = this._hass;
    }
    setPreview(k) { this._preview = k && WX[k] ? k : null; if (this._heroEl) { this._heroEl.update(); if (this._preview) this._heroEl.showSlide(0); } }
    customize(focus, opts) {
      if (!focus || focus === 'sections' || focus === 'tiles' || focus === 'layout') return openSheet(this);
      return super.customize(focus, opts);
    }
    render() {
      const c = this.config, h = this.hass, a = M.vaerAuto(h, c), ui = this.ui;
      this._checkEnt(a.weather);
      const st = this.s(a.weather), A = (st && st.attributes) || {};
      const sunSt = this.s(a.sun), sun = sunTimes(sunSt), moon = moonOf(this.s(a.moon)), uvSt = this.s(a.uv);
      a.alerts.forEach((id) => this.s(id));
      const H = this.hourly, Dl = this.daily, loaded = !!this._fc;
      const wu = A.wind_speed_unit || 'm/s', pu = A.precipitation_unit || 'mm', tu = '°';
      const sec = {};
      sec.hero = '<div class="msh-hero-slot vh-slot" data-nomorph></div>';
      // Farevarsler (skjult uten aktive varsler)
      const AL = a.alerts.flatMap((id) => parseAlerts(h, id)).sort((x, y) => (x.future - y.future) || (y.lv - x.lv));
      if (AL.length) {
        const nOn = AL.filter((x) => !x.future).length, nFut = AL.length - nOn;
        const sum = [nOn ? `${nOn} pågår` : '', nFut ? `${nFut} ventet` : ''].filter(Boolean).join(' · ');
        sec.alerts = `<section class="sec">
          <div class="ah"><span class="row" style="gap:6px;font-size:13px;color:var(--gray700,#979797)">${M.icon('warning', 16)}Farevarsler · ${sum}</span>
            <span class="row">${AL.map((x, i) => `<span class="ac" data-key="ac${i}" style="background:${LV[x.lv][1]};margin-left:${i ? -7 : 0}px;z-index:${10 - i}">${M.icon(x.icon, 15)}</span>`).join('')}</span></div>
          ${AL.map((x) => {
            const col = LV[x.lv][1], open = ui.alertOpen === x.key;
            return `<button class="al${open ? ' open' : ''}" data-act="alert" data-k="${esc(x.key)}" data-key="${esc(x.key)}" data-ent="${esc(x.ent)}" data-haptic="selection" aria-expanded="${open}" style="background:${M.alpha(col, 0.12)};box-shadow:inset 0 0 0 1px ${M.alpha(col, 0.35)}">
              <span class="row" style="align-items:flex-start;gap:12px;width:100%">
                <span class="aiw" style="background:${col}">${M.icon(x.icon, 22)}</span>
                <span class="grow col" style="gap:3px;text-align:left">
                  <span class="row" style="gap:6px;flex-wrap:wrap"><span class="lb" style="background:${M.alpha(col, 0.22)};color:${col}">${LV[x.lv][0]} nivå</span><span style="font-size:11px;color:${x.future ? 'var(--gray700, #979797)' : 'var(--white, #fafafa)'}">${esc(x.status)}</span></span>
                  <span style="font-size:14px;font-weight:600;line-height:1.3">${esc(x.title)}</span>
                  <span style="font-size:12px;color:var(--gray700,#979797)">${esc([whenTxt(x.from), whenTxt(x.to)].filter(Boolean).join(' – ') || '–')}</span>
                </span>
                <span class="chev">${M.icon('expand_more', 22, `color:var(--gray700, #979797);transition:transform .2s;transform:${open ? 'rotate(180deg)' : 'none'}`)}</span>
              </span>
              ${open ? `<span class="ax">
                ${x.text ? `<span style="font-size:13px;color:var(--gray1000,#e1e1e1);line-height:1.45;text-wrap:pretty">${esc(x.text)}</span>` : ''}
                ${x.blocks.map((b) => `<span class="col" style="gap:3px"><span style="font-size:11px;color:var(--gray600,#7f7f7f)">${esc(b[0])}</span><span style="font-size:13px;color:var(--gray900,#c7c7c7);line-height:1.45;text-wrap:pretty">${esc(b[1])}</span></span>`).join('')}
                <span class="row" style="justify-content:space-between;gap:10px;font-size:11px;color:var(--gray600,#7f7f7f)"><span class="ell">${esc(x.src)}</span>${x.url ? `<a class="map" href="${esc(x.url)}" target="_blank" rel="noopener">Åpne kart${M.icon('open_in_new', 14)}</a>` : ''}</span>
              </span>` : ''}
            </button>`;
          }).join('')}
        </section>`;
      }
      // Time for time (ingen bleed: listen holder seg innenfor kortets bredde)
      const nH = Math.max(12, Math.min(48, Number(c.hours) || 24));
      const hrs = H.slice(0, nH);
      sec.hours = `<div class="hrs noscroll">${hrs.length ? hrs.map((f, i) => {
        const t = new Date(f.datetime).getTime(), cd = condOf(f.condition, f.is_daytime != null ? !f.is_daytime : isNight(t, sun));
        return `<div class="hb ${i ? '' : 'first'}" data-key="h${i}"><span class="ht">${i ? `${M.pad(new Date(t).getHours())}:00` : 'Nå'}</span>${wxIcon(cd.icon, 30, cd.color)}<span class="htv num">${num(f.temperature) != null ? f1(f.temperature) : '–'}°</span>
          <span class="hx"><span>${num(f.wind_speed) != null ? `${f1(f.wind_speed)} ${esc(wu)}` : '–'}</span><span class="hr">${num(f.precipitation) != null ? `${f1(f.precipitation)} ${esc(pu)}` : '–'}</span></span></div>`;
      }).join('') : `<div class="hb ph">${esc(!st ? 'Ingen værmelding' : loaded || !this.isOpen ? 'Ingen timeprognose' : 'Henter prognose …')}</div>`}</div>`;
      // Temperaturgraf (valgfri, etter timene) med scrub
      if (c.show_graph) {
        const G = H.slice(0, 25).map((f) => ({ t: new Date(f.datetime).getTime(), v: num(f.temperature) })).filter((p) => p.v != null);
        const sel = ui.gsel != null ? Math.min(ui.gsel, G.length - 1) : 0;
        let pts = '0,60 300,60';
        if (G.length > 1) {
          const mn = Math.min(...G.map((p) => p.v)) - 0.5, mx = Math.max(...G.map((p) => p.v)) + 0.5;
          pts = G.map((p, i) => `${((i / (G.length - 1)) * 300).toFixed(1)},${(92 - ((p.v - mn) / (mx - mn)) * 72).toFixed(1)}`).join(' ');
        }
        const cur = G[sel];
        sec.hours += `<section class="gr">
          <div class="gh"><span class="row" style="gap:6px;font-size:12px;color:var(--gray700,#979797)">${M.icon('thermometer', 16)}Temperatur · neste 24 t</span><span class="num" style="font-size:14px;font-weight:500">${cur ? `${f1(cur.v)}° · ${sel ? 'kl ' + hm(cur.t) : 'nå'}` : '–'}</span></div>
          <div class="gw"><svg viewBox="0 0 300 100" preserveAspectRatio="none"><polyline points="0,100 ${pts} 300,100" style="fill:${M.alpha(SUNY, 0.18)};stroke:none"></polyline><polyline points="${pts}" fill="none" style="stroke:${SUNY};stroke-width:2" stroke-linejoin="round" vector-effect="non-scaling-stroke"></polyline></svg>
            ${G.length > 1 ? `<div class="gc" style="left:${(sel / (G.length - 1)) * 100}%"></div>` : ''}<div class="scrub"></div></div>
        </section>`;
      }
      // Dagskort (utvidbare, én åpen om gangen)
      const nD = Math.max(1, Math.min(10, Number(c.days) || 7));
      const days = (todayOf(Dl) ? Dl.slice(1) : Dl).slice(0, nD);
      sec.days = days.length ? days.map((f) => {
        const t = new Date(f.datetime), cd = condOf(f.condition, false), key = 'd' + t.toDateString(), open = ui.dayOpen === key;
        const uvD = num(f.uv_index), humD = num(f.humidity), pp = num(f.precipitation_probability);
        const more = [
          ['Vind', num(f.wind_speed) != null ? `${f1(f.wind_speed)} ${wu}${f.wind_bearing != null ? ' ' + compass(f.wind_bearing) : ''}` : '–'],
          ['UV / fukt', `${uvD != null ? 'UV ' + f1(uvD) : 'UV –'} · ${humD != null ? Math.round(humD) + ' %' : '–'}`],
          ['Nedbørssjanse', pp != null ? `${Math.round(pp)} %` : '–'],
        ];
        return `<button class="day${open ? ' open' : ''}" data-act="day" data-k="${esc(key)}" data-key="${esc(key)}" data-haptic="selection" aria-expanded="${open}">
          <span class="row" style="width:100%">
            <span class="grow col" style="gap:4px;text-align:left"><span style="font-size:14px;color:var(--gray900,#c7c7c7)">${esc(cap(t.toLocaleDateString('nb-NO', { weekday: 'long' })))}</span>
              <span class="row" style="align-items:baseline;gap:8px"><span class="dhi num">${num(f.temperature) != null ? f1(f.temperature) : '–'}°</span><span class="dlo num">${f.templow != null ? f1(f.templow) + '°' : ''}</span></span>
              <span class="row" style="gap:12px;font-size:13px;color:var(--gray900,#c7c7c7)"><span>${esc(cd.label)}</span><span>${num(f.precipitation) != null ? `${f1(f.precipitation)} ${esc(pu)}` : ''}</span></span></span>
            ${wxIcon(cd.icon, 64, cd.color)}
          </span>
          ${open ? `<span class="dm">${more.map(([l, v]) => `<span class="col" style="gap:2px;text-align:left;min-width:0"><span style="font-size:11px;color:var(--gray600,#7f7f7f)">${l}</span><span class="ell" style="font-size:14px;font-weight:500">${esc(v)}</span></span>`).join('')}</span>` : ''}
        </button>`;
      }).join('') : `<div class="day ph">${esc(!st ? 'Ingen værmelding' : loaded || !this.isOpen ? 'Ingen dagsprognose' : 'Henter prognose …')}</div>`;
      // Detaljkort (2×N, høyde 164, radius 28)
      const cc = num(A.cloud_coverage) != null ? num(A.cloud_coverage) : H[0] ? num(H[0].cloud_coverage) : null;
      const ccL = cc == null ? '–' : cc < 12.5 ? 'Klarvær' : cc < 37.5 ? 'Lettskyet' : cc < 62.5 ? 'Delvis skyet' : cc < 87.5 ? 'Skyet' : 'Overskyet';
      const ws = num(A.wind_speed), gust = num(A.wind_gust_speed) != null ? num(A.wind_gust_speed) : H[0] ? num(H[0].wind_gust_speed) : null, bear = num(A.wind_bearing);
      const hum = num(A.humidity), temp = num(A.temperature);
      let dew = num(A.dew_point);
      if (dew == null && hum && temp != null) { const g = (17.27 * temp) / (237.7 + temp) + Math.log(hum / 100); dew = (237.7 * g) / (17.27 - g); }
      const uv = uvSt && M.isNum(uvSt.state) ? num(uvSt.state) : num(A.uv_index) != null ? num(A.uv_index) : H[0] ? num(H[0].uv_index) : null, uvL = uvOf(uv);
      const pr = num(A.pressure), prU = A.pressure_unit || 'hPa';
      const pr3 = H.slice(1, 5).map((f) => num(f.pressure)).filter((v) => v != null).pop();
      const trend = pr == null || pr3 == null ? ['Trend –', 'mdi:minus'] : pr3 - pr > 1 ? ['Stigende', 'mdi:trending-up'] : pr - pr3 > 1 ? ['Synkende', 'mdi:trending-down'] : ['Stabilt', 'mdi:trending-neutral'];
      const R24 = H.slice(0, 24).map((f) => num(f.precipitation) || 0), rain24 = H.length ? R24.reduce((s, v) => s + v, 0) : null, rMax = Math.max(0.5, ...R24);
      const day0 = new Date(); day0.setHours(0, 0, 0, 0);
      const dpos = (t) => M.clamp((t - day0.getTime()) / 864000, 0, 100); // % av døgnet
      const sunBar = sun ? `<span class="sb" style="left:${dpos(sun.rise).toFixed(1)}%;width:${Math.max(0, dpos(sun.set) - dpos(sun.rise)).toFixed(1)}%"></span>` : '';
      const dayLen = sun ? Math.max(0, sun.set - sun.rise) / 60000 : null;
      const uvPos = uv != null ? M.clamp(uv / 11, 0, 1) * 100 : null, prPos = pr != null ? M.clamp((pr - 960) / 100, 0, 1) * 100 : null;
      const mk = (p) => (p == null ? '' : `<span class="mk" style="left:${p.toFixed(1)}%"></span>`);
      const T = {
        sky: `<section class="tl"><span class="th">${M.icon('cloud', 16)}Skydekke</span><span class="tvv">${cc != null ? Math.round(cc) + '<small> %</small>' : '–'}</span><span class="ts">${ccL}</span><div class="bar"><span style="width:${cc || 0}%"></span></div></section>`,
        wind: `<section class="tl"><button class="wd" data-act="winddir" data-haptic="selection" aria-label="Vindretning ${esc(compass(A.wind_bearing) || '–')}"><span class="arr" style="transform:rotate(${bear != null ? (bear + 180) % 360 : 0}deg);opacity:${bear != null ? 1 : 0.3}">${M.icon('navigation', 20, `color:${C.blue}`)}</span></button>
          <span class="th">${M.icon('air', 16)}Vind</span><span class="tvv">${ws != null ? f1(ws) : '–'}</span><span class="ts" style="margin-top:auto">${esc(wu)}${bear != null || A.wind_bearing ? ' · ' + (ui.windDeg && bear != null ? Math.round(bear) + '°' : compass(A.wind_bearing)) : ''}</span></section>`,
        gust: `<section class="tl" style="background:${M.alpha(C.purple, 0.16)};box-shadow:inset 0 0 0 1px ${M.alpha(C.purple, 0.35)}"><span class="th" style="color:var(--gray900,#c7c7c7)">${M.icon('storm', 16, `color:${C.purple}`)}Vindkast</span><span class="tvv">${gust != null ? f1(gust) : '–'}</span><span class="ts" style="margin-top:auto">${esc(wu)}${gust != null && ws != null ? ` · ${f1(Math.max(0, gust - ws))} over snitt` : ''}</span></section>`,
        sun: `<section class="tl"><span class="th">${M.icon('wb_twilight', 16)}Sol opp og ned</span>
          <span class="row" style="justify-content:space-between;gap:6px"><span class="tvm num">↑ ${sun ? hm(sun.rise) : '–'}</span><span class="tvm num">↓ ${sun ? hm(sun.set) : '–'}</span></span>
          <div class="bar sun" style="margin-top:auto">${sunBar}${mk(dpos(Date.now()))}</div>
          <span class="ts" style="font-size:11px;color:var(--gray600,#7f7f7f)">${dayLen != null ? `Dagslengde ${Math.floor(dayLen / 60)} t ${Math.round(dayLen % 60)} min` : 'Dagslengde –'}${sun && sun.elev != null ? ` · ${M.nf(sun.elev, 0)}°` : ''}</span></section>`,
        hum: `<section class="tl" style="position:relative;overflow:hidden"><span style="position:absolute;left:0;right:0;bottom:0;height:${hum != null ? M.clamp(hum, 0, 100) : 0}%;background:linear-gradient(180deg, ${M.alpha(C.blue, 0.22)}, ${M.alpha(C.blue, 0.08)})"></span>
          <span class="th" style="position:relative;color:var(--gray900,#c7c7c7)">${M.icon('humidity_percentage', 16, `color:${C.blue}`)}Fukt</span><span class="tvv" style="position:relative">${hum != null ? Math.round(hum) + '<small> %</small>' : '–'}</span><span class="ts" style="position:relative;margin-top:auto">Duggpunkt ${dew != null ? f1(dew) + tu : '–'}</span></section>`,
        uv: `<section class="tl"><span class="th">${M.icon('light_mode', 16, `color:${SUNY}`)}UV-indeks</span><span class="tvv">${uv != null ? f1(uv) : '–'}</span><span style="font-size:12px;font-weight:600;color:${uvL[1]}">${uvL[0]}</span>
          <div class="bar uvs" style="margin-top:auto">${mk(uvPos)}</div></section>`,
        press: `<section class="tl"><span class="th">${M.icon('compress', 16)}Trykk</span><span class="tvv">${pr != null ? Math.round(pr) : '–'}<small> ${esc(prU)}</small></span>
          <span class="ts row" style="gap:4px">${M.icon(trend[1], 16)}${trend[0]}</span><div class="bar prs" style="margin-top:auto">${mk(prPos)}</div></section>`,
        rain: `<section class="tl"><span class="th">${M.icon('water_drop', 16, `color:${C.blue}`)}Nedbør</span><span class="tvv">${rain24 != null ? f1(rain24) : '–'}<small> ${esc(pu)}</small></span>
          <div class="rb">${(H.length ? R24 : Array(24).fill(0)).map((v, i) => `<span style="height:${Math.max(2, (v / rMax) * 100).toFixed(0)}%;opacity:${v > 0 ? 1 : 0.35}" data-key="r${i}"></span>`).join('')}</div><span class="ts">Neste 24 timer</span></section>`,
      };
      const tord = orderOf(TK, c.tiles), thid = new Set(c.hidden_tiles || []);
      const tl = tord.filter((k) => !thid.has(k));
      sec.tiles = tl.length ? `<div class="tiles" ${a.weather ? `data-ent="${esc(a.weather)}"` : ''}>${tl.map((k) => `<div class="tw" data-key="t-${k}" data-tile="${k}">${T[k]}</div>`).join('')}</div>` : '';
      sec.moon = `<section class="mn" ${a.moon ? `data-ent="${esc(a.moon)}"` : ''}>${moon.none ? `<div class="moon" style="width:56px;height:56px;background:var(--gray300,#404040)"></div>` : moonDisc(moon.p, 56)}<span class="col" style="gap:2px"><span style="font-size:11px;color:var(--gray700,#979797)">Månefase</span><span style="font-size:16px;font-weight:500">${esc(moon.name)}</span></span></section>`;
      const order = orderOf(SK, c.sections), hid = new Set(c.hidden_sections || []);
      const empty = !st ? M.emptyState(a.weather ? `Fant ikke ${a.weather}` : 'Fant ingen weather.*', 'overrides') : '';
      const blocks = order.filter((k) => !hid.has(k) && sec[k]).map((k) => `<div class="blk" data-key="b-${k}" data-sec="${k}">${sec[k]}</div>`);
      // «Tilpass været» – alltid nederst
      return `<div class="wrap">${empty}${blocks.join('')}<button class="own press" data-key="own" data-act="customize" data-section="sections">${M.icon('tune', 20)}Tilpass været</button></div>`;
    }
    onAction(name, el, ev) {
      if (name === 'alert') { if (ev.composedPath().some((n) => n.tagName === 'A')) return; return this.setUI({ alertOpen: this.ui.alertOpen === el.dataset.k ? null : el.dataset.k }); }
      if (name === 'day') return this.setUI({ dayOpen: this.ui.dayOpen === el.dataset.k ? null : el.dataset.k });
      if (name === 'winddir') return this.setUI({ windDeg: !this.ui.windDeg });
      return super.onAction(name, el, ev);
    }
    afterRender() {
      guardSwipe(this.shadowRoot.querySelector('.hrs'), 'pan-x');
      const sc = this.shadowRoot.querySelector('.scrub');
      if (!sc || sc.__b) return;
      sc.__b = true;
      M.guardDrag(sc, 'none');
      const pos = (e) => { const n = Math.min(25, this.hourly.length); const r = sc.getBoundingClientRect(); return M.clamp(Math.round(((e.clientX - r.left) / r.width) * (n - 1)), 0, Math.max(0, n - 1)); };
      let down = false;
      sc.addEventListener('pointerdown', (e) => { down = true; try { sc.setPointerCapture(e.pointerId); } catch (x) { /* */ } const p = pos(e); if (p !== this.ui.gsel) { M.haptic('selection'); this.setUI({ gsel: p }); } });
      sc.addEventListener('pointermove', (e) => { if (!down && e.pointerType !== 'mouse') return; const p = pos(e); if (p !== this.ui.gsel) { if (down) M.haptic('selection'); this.setUI({ gsel: p }); } });
      const end = () => { down = false; this.setUI({ gsel: null }); };
      ['pointerup', 'pointercancel', 'pointerleave'].forEach((t) => sc.addEventListener(t, end));
    }
    get styles() {
      return `${KEYFRAMES}
        .wrap{display:flex;flex-direction:column;gap:var(--msh-gap, 12px)}
        .blk,.sec{display:flex;flex-direction:column;gap:12px}
        .vh-slot{display:block;margin:0}
        .sec{gap:8px}
        .ah{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0 6px}
        .ac{width:28px;height:28px;border-radius:14px;display:grid;place-items:center;color:#282828;box-shadow:0 0 0 2px #282828;position:relative}
        .al{display:flex;flex-direction:column;padding:14px 16px;border-radius:24px;width:100%;text-align:left}
        .aiw{width:42px;height:42px;border-radius:21px;flex:none;display:grid;place-items:center;color:#282828}
        .chev{flex:none;line-height:0}
        .lb{font-size:11px;font-weight:600;padding:2px 8px;border-radius:8px}
        .ax{display:flex;flex-direction:column;gap:10px;width:100%;padding-top:12px;margin-top:12px;border-top:1px solid rgba(255,255,255,0.06);text-align:left}
        .map{display:flex;align-items:center;gap:4px;color:var(--gray800,#afafaf);text-decoration:none;white-space:nowrap}
        .hrs{width:100%;display:flex;gap:8px;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;scroll-snap-type:x proximity;overscroll-behavior-x:contain;margin:0;padding:0;border-radius:24px}
        .hb{flex:none;width:92px;height:172px;border-radius:24px;background:var(--gray200,#3a3a3a);display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:14px 0;scroll-snap-align:start}
        .hb.first .ht{color:var(--white,#fafafa);font-weight:600}
        .hb.ph,.day.ph{width:100%;height:auto;min-height:72px;justify-content:center;font-size:13px;color:var(--gray700,#979797)}
        .ht{font-size:13px;color:var(--gray800,#afafaf)}
        .htv{font-size:24px;font-weight:300;letter-spacing:-0.02em}
        .hx{display:flex;flex-direction:column;align-items:center;gap:1px;font-size:11px;color:var(--gray700,#979797)}
        .hx .hr{color:${RAIN}}
        .gr{border-radius:28px;background:var(--gray200,#3a3a3a);padding:16px 0 0;overflow:hidden}
        .gh{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0 16px 8px}
        .gw{position:relative;height:100px}
        .gw svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
        .gc{position:absolute;top:0;bottom:0;border-left:1px dashed ${M.alpha(SUNY, 0.6)};pointer-events:none}
        .scrub{position:absolute;inset:0;touch-action:none;cursor:crosshair}
        .day{display:flex;flex-direction:column;padding:18px 24px;border-radius:28px;background:var(--gray200,#3a3a3a);width:100%}
        .dhi{font-size:40px;font-weight:300;letter-spacing:-0.03em;line-height:1}
        .dlo{font-size:15px;color:var(--gray600,#7f7f7f)}
        .dm{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;width:100%;padding-top:14px;margin-top:14px;border-top:1px solid rgba(255,255,255,0.06)}
        .tiles{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px}
        .tw{min-width:0}
        .tl{position:relative;display:flex;flex-direction:column;gap:6px;height:164px;padding:16px;border-radius:28px;background:var(--gray200,#3a3a3a);overflow:hidden}
        .th{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--gray700,#979797);padding-right:36px}
        .tvv{font-size:40px;font-weight:300;letter-spacing:-0.03em;line-height:1;white-space:nowrap}
        .tvv small{font-size:14px;color:var(--gray700,#979797);letter-spacing:0}
        .tvm{font-size:20px;font-weight:400;letter-spacing:-0.02em}
        .ts{font-size:12px;color:var(--gray900,#c7c7c7)}
        .bar{position:relative;height:6px;border-radius:3px;background:var(--gray300,#404040);margin-top:auto;flex:none}
        .bar>span:not(.mk){position:absolute;left:0;top:0;bottom:0;border-radius:3px;background:var(--gray900,#c7c7c7)}
        .bar.sun>.sb{background:linear-gradient(90deg, ${M.alpha(SUNY, 0.55)}, ${SUNY}, ${M.alpha(SUNY, 0.55)})}
        .bar.uvs{background:linear-gradient(90deg, ${C.green} 0 18%, ${C.yellow} 18% 45%, ${C.orange} 45% 64%, ${C.red} 64% 91%, ${C.purple} 91%)}
        .bar.prs{background:linear-gradient(90deg, ${M.alpha(C.blue, 0.35)}, var(--gray400,#545454) 50%, ${M.alpha(SUNY, 0.4)})}
        .mk{position:absolute;top:-4px;width:4px;height:14px;margin-left:-2px;border-radius:2px;background:var(--white,#fafafa);box-shadow:0 0 0 2px var(--gray200,#3a3a3a)}
        .wd{position:absolute;top:10px;right:10px;width:36px;height:36px;border-radius:18px;background:var(--gray300,#404040);display:grid;place-items:center}
        .wd:active{transform:scale(.92)}
        .arr{line-height:0;transition:transform .4s;display:inline-flex}
        .rb{flex:1;min-height:0;display:flex;align-items:flex-end;gap:2px;margin-top:4px}
        .rb span{flex:1;border-radius:2px;background:${RAIN};min-height:2px}
        .mn{display:flex;align-items:center;gap:16px;padding:16px 18px;border-radius:28px;background:var(--gray200,#3a3a3a)}
        .moon{position:relative;flex:none;border-radius:50%;background:#e9e4d6;overflow:hidden}
        .own{width:100%;height:52px;border-radius:26px;background:var(--gray200,#3a3a3a);display:flex;align-items:center;justify-content:center;gap:8px;font-size:15px;font-weight:500}
        .own:active{transform:scale(0.98)}
      `;
    }
  }
  M.define('msh-vaer-card', Vaer, 'MSH Vær', 'Toppkort, farevarsler, time for time, dagskort, detaljkort og månefase med «Tilpass været». Prognose abonneres kun mens #vaer er åpen.');

  /* ================================================================ «Tilpass været» (ark, portalet ut av popupen) */
  // Seksjoner: dra-håndtak, ikon, navn, opp/ned-piler og øye. Detaljkort: 2-kolonners rutenett, dra for å bytte, øye skjuler.
  // Endringer vises straks i kortet og lagres i kortets config (MSH.saveCardConfig). «Forhåndsvis vær» lagres ikke.
  // Arket bruker MSH.overlay sin felles ark-stil (solid som standard, frosted glass bare med Liquid Glass-tema).
  function openSheet(card) {
    if (card._sheet && card._sheet.ov && !card._sheet.ov.closed) return card._sheet;
    let cur = card._rawConfig || card.config;
    const st = { pv: card._preview || null, drag: null };
    const hass = () => card.hass;
    const sections = () => orderOf(SK, cur.sections), tiles = () => orderOf(TK, cur.tiles);
    const hidS = () => new Set(cur.hidden_sections || []), hidT = () => new Set(cur.hidden_tiles || []);
    const apply = (patch, hap) => {
      const old = cur, next = { ...cur, ...patch };
      Object.keys(patch).forEach((k) => { if (patch[k] === undefined || (Array.isArray(patch[k]) && !patch[k].length && k.startsWith('hidden_'))) delete next[k]; });
      cur = next;
      card.setConfig({ ...next, __eff: 1 });
      if (next.card_id) M.applyLive(next.card_id, next);
      if (hap) M.haptic(hap);
      draw();
      Promise.resolve(M.saveCardConfig(hass(), old, next, { card, scope: 'shared' })).then((r) => {
        if (r && r.config && r.config.card_id && r.config.card_id !== cur.card_id) { cur = { ...cur, card_id: r.config.card_id }; card.setConfig({ ...cur, __eff: 1 }); }
        if (r && r.ok === false) { M.haptic('failure'); M.toast('Kunne ikke lagre' + (r.error ? ' – ' + r.error : '')); }
      }).catch(() => {});
    };
    const eyeBtn = (a, k, hid, label, size) => `<button class="eye${hid ? ' off' : ''}" data-a="${a}" data-k="${k}" aria-pressed="${hid}" aria-label="${hid ? 'Vis' : 'Skjul'} ${esc(label)}">${M.icon(hid ? 'visibility_off' : 'visibility', size)}</button>`;
    const draw = () => {
      if (!ov || st.drag) return;
      const sh = ov.root.querySelector('.sh'), top = sh ? sh.scrollTop : 0;
      const so = sections(), hs = hidS(), to = tiles(), ht = hidT();
      const byS = Object.fromEntries(SECS.map((s) => [s[0], s])), byT = Object.fromEntries(TILES.map((t) => [t[0], t]));
      box.innerHTML = `<div class="hd"><span class="col grow" style="gap:2px;min-width:0"><span class="tt">Tilpass været</span><span class="st">Dra for å flytte · øyet skjuler</span></span>
          <button class="nb" data-a="reset">Nullstill</button><button class="ok" data-a="done">Ferdig</button></div>
        <span class="cap">Forhåndsvis vær</span>
        <div class="chips">${PREVIEW.map((k) => `<button class="chip${st.pv === k ? ' on' : ''}" data-a="pv" data-k="${k}" aria-pressed="${st.pv === k}">${M.icon(WX[k][0], 16, `color:${st.pv === k ? '#282828' : WX[k][2]}`)}${esc(WX[k][1])}</button>`).join('')}</div>
        <span class="cap">Seksjoner</span>
        <div class="rows" data-list="sec">${so.map((k, i) => { const s = byS[k], hid = hs.has(k); return `<div class="r${hid ? ' off' : ''}" data-dk="${k}" data-list="sec">
          <span class="hdl" data-drag="sec" data-k="${k}" aria-label="Dra for å flytte ${esc(s[1])}">${M.icon('drag_indicator', 20)}</span>
          <span class="ri">${M.icon(s[2], 20)}</span><span class="rl ell">${esc(s[1])}</span>
          <span class="ud"><button data-a="mv" data-k="${k}" data-d="-1" aria-label="Flytt ${esc(s[1])} opp" ${i === 0 ? 'disabled' : ''}>${M.icon('expand_less', 20)}</button><button data-a="mv" data-k="${k}" data-d="1" aria-label="Flytt ${esc(s[1])} ned" ${i === so.length - 1 ? 'disabled' : ''}>${M.icon('expand_more', 20)}</button></span>
          ${eyeBtn('eye', k, hid, s[1], 20)}</div>`; }).join('')}</div>
        <span class="cap">Detaljkort</span>
        <div class="grid" data-list="tile">${to.map((k) => { const t = byT[k], hid = ht.has(k); return `<div class="g${hid ? ' off' : ''}" data-dk="${k}" data-list="tile" data-drag="tile" data-k="${k}">
          ${M.icon(t[2], 18, 'color:var(--gray800,#afafaf)')}<span class="gl ell">${esc(t[1])}</span>${eyeBtn('teye', k, hid, t[1], 18)}</div>`; }).join('')}</div>
        <span class="note">Dra kortene for å bytte rekkefølge i rutenettet. På mobil kan du bruke pilene for seksjoner.</span>
        <button class="more" data-a="more">${M.icon('mdi:cog-outline', 18)}Entiteter og prognose</button>`;
      if (sh) sh.scrollTop = top;
    };
    const ov = M.overlay({ html: '', css: SHEET_CSS, maxWidth: 440, onClose: () => { card._sheet = null; if (card._preview) card.setPreview(null); } });
    const box = document.createElement('div');
    box.className = 'vaer-sheet';
    Object.defineProperty(box, '_config', { get: () => cur });
    ov.body.appendChild(box);
    ov.root.addEventListener('click', (e) => {
      const el = e.target.closest && e.target.closest('[data-a]');
      if (!el || el.disabled || st.dragged) return;
      const a = el.dataset.a, k = el.dataset.k;
      switch (a) {
        case 'done': M.haptic('success'); if (M.flushSaves) M.flushSaves(); return ov.close();
        case 'reset': return apply({ sections: undefined, hidden_sections: undefined, tiles: undefined, hidden_tiles: undefined }, 'warning');
        case 'pv': st.pv = st.pv === k ? null : k; card.setPreview(st.pv); M.haptic('selection'); return draw();
        case 'mv': { const o = sections(), i = o.indexOf(k), j = i + Number(el.dataset.d); if (i < 0 || j < 0 || j >= o.length) return; [o[i], o[j]] = [o[j], o[i]]; return apply({ sections: o }, 'selection'); }
        case 'eye': { const s = hidS(); if (s.has(k)) s.delete(k); else s.add(k); return apply({ hidden_sections: SK.filter((x) => s.has(x)) }, 'selection'); }
        case 'teye': { const s = hidT(); if (s.has(k)) s.delete(k); else s.add(k); return apply({ hidden_tiles: TK.filter((x) => s.has(x)) }, 'selection'); }
        case 'more': ov.close(); return M.Card.prototype.customize.call(card, 'overrides');
        default: return undefined;
      }
    });
    // Dra og slipp (pekerhendelser): touch-action none på håndtakene/flisene + stopPropagation (fallgruve 2).
    // Lytterne ligger på arkets innhold (MSH.overlay stopper pointerdown/touch på .sh før skyggeroten).
    const stop = (e) => e.stopPropagation();
    const root = ov.root;
    const itemAt = (x, y, list) => { const el = root.elementFromPoint ? root.elementFromPoint(x, y) : null; const it = el && el.closest && el.closest('[data-dk]'); return it && it.dataset.list === list ? it : null; };
    box.addEventListener('pointerdown', (e) => {
      const h = e.target.closest && e.target.closest('[data-drag]');
      if (!h || e.button || (e.target.closest('[data-a]'))) return;
      e.stopPropagation();
      const list = h.dataset.drag, item = h.closest('[data-dk]');
      st.drag = { list, k: h.dataset.k, item, x0: e.clientX, y0: e.clientY, over: null, moved: false, id: e.pointerId };
      try { h.setPointerCapture(e.pointerId); } catch (x) { /* */ }
      item.classList.add('drag');
      M.haptic('selection');
    });
    box.addEventListener('pointermove', (e) => {
      const d = st.drag;
      if (!d || e.pointerId !== d.id) return;
      e.stopPropagation(); e.preventDefault();
      const dx = e.clientX - d.x0, dy = e.clientY - d.y0;
      if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
      d.item.style.transform = `translate(${d.list === 'tile' ? dx : 0}px, ${dy}px)`;
      d.item.style.pointerEvents = 'none';
      const over = itemAt(e.clientX, e.clientY, d.list);
      d.item.style.pointerEvents = '';
      const ok = over && over !== d.item ? over : null;
      if (ok !== d.over) { if (d.over) d.over.classList.remove('over'); d.over = ok; if (ok) { ok.classList.add('over'); M.haptic('selection'); } }
    });
    const end = (e) => {
      const d = st.drag;
      if (!d || (e && e.pointerId !== d.id)) return;
      st.drag = null;
      d.item.classList.remove('drag'); d.item.style.transform = '';
      if (d.over) d.over.classList.remove('over');
      if (d.moved) { st.dragged = true; setTimeout(() => { st.dragged = false; }, 50); }
      if (!d.over) return draw();
      const arr = d.list === 'sec' ? sections() : tiles(), to = d.over.dataset.dk, i = arr.indexOf(d.k);
      const o = arr.filter((x) => x !== d.k), j = o.indexOf(to);
      o.splice(i <= arr.indexOf(to) ? j + 1 : j, 0, d.k); // dra nedover → etter målet, oppover → før
      apply(d.list === 'sec' ? { sections: o } : { tiles: o }, 'success');
    };
    box.addEventListener('pointerup', end);
    box.addEventListener('pointercancel', end);
    ['touchstart', 'touchmove'].forEach((t) => box.addEventListener(t, (e) => { if (e.target.closest && e.target.closest('[data-drag]')) stop(e); }, { passive: true }));
    card._sheet = { ov, st, box };
    draw();
    return card._sheet;
  }
  const PINKG = 'linear-gradient(145deg, rgb(242 133 201) -10%, rgb(245 205 198) 100%)';
  const SHEET_CSS = `
    .vaer-sheet{display:grid;grid-template-columns:minmax(0,1fr);align-content:start;gap:8px;padding-top:4px}
    .hd{display:flex;align-items:center;flex-wrap:wrap;gap:8px;padding:0 4px 6px}
    .hd>.col{flex:1 1 170px}
    .tt{font-size:22px;font-weight:600;white-space:nowrap}
    .st{font-size:12px;color:var(--ki-g-t2,var(--gray700,#979797))}
    .nb{height:40px;padding:0 14px;border-radius:20px;background:var(--ki-g-row,var(--gray300,#404040));font-size:14px;font-weight:500;flex:none}
    .ok{height:40px;padding:0 18px;border-radius:20px;background:${PINKG};color:#5a3a48;font-size:14px;font-weight:600;flex:none}
    .nb:active,.ok:active,.chip:active,.more:active{transform:scale(.96)}
    .cap{font-size:13px;color:var(--ki-g-t2,var(--gray700,#979797));padding:10px 6px 0}
    .chips{display:flex;gap:6px;flex-wrap:wrap}
    .chip{display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 12px 0 10px;border-radius:18px;background:var(--ki-g-row,var(--gray200,#3a3a3a));font-size:13px;font-weight:500;transition:background .2s,color .2s}
    .chip.on{background:var(--gray1000,#e1e1e1);color:#282828}
    .rows{display:flex;flex-direction:column;gap:8px}
    .r{display:flex;align-items:center;gap:8px;height:56px;padding:0 6px 0 10px;border-radius:28px;background:var(--ki-g-row,var(--gray200,#3a3a3a));transition:opacity .2s,box-shadow .15s}
    .r.off>:not(.eye){opacity:.5}
    .hdl{display:grid;place-items:center;width:28px;height:44px;color:var(--gray600,#7f7f7f);cursor:grab;touch-action:none;flex:none}
    .ri{width:24px;flex:none;display:grid;place-items:center;color:var(--gray900,#c7c7c7)}
    .rl{flex:1;min-width:0;font-size:15px;font-weight:500}
    .ud{display:flex;flex:none;border-radius:18px;background:var(--ki-g-seg,#282828);padding:2px}
    .ud button{width:32px;height:32px;border-radius:16px;display:grid;place-items:center;color:var(--white,#fafafa)}
    .ud button:disabled{opacity:.2;pointer-events:none}
    .eye{width:36px;height:36px;border-radius:18px;flex:none;display:grid;place-items:center;color:var(--gray800,#afafaf)}
    .eye.off{color:var(--gray500,#696969)}
    .grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px;padding:10px;border-radius:24px;background:var(--ki-g-seg,rgba(0,0,0,0.18))}
    .g{display:flex;align-items:center;gap:8px;height:48px;padding:0 4px 0 12px;border-radius:16px;background:var(--ki-g-row,var(--gray200,#3a3a3a));cursor:grab;touch-action:none;user-select:none;-webkit-user-select:none;min-width:0;transition:opacity .2s,box-shadow .15s}
    .g.off>:not(.eye){opacity:.5}
    .g .eye{width:30px;height:30px}
    .gl{flex:1;min-width:0;font-size:13px;font-weight:500}
    .drag{position:relative;z-index:5;opacity:.9;transition:none !important;cursor:grabbing}
    .r.over{box-shadow:inset 0 3px 0 rgb(242 133 201)}
    .g.over{box-shadow:inset 0 0 0 2px rgb(242 133 201)}
    .note{font-size:12px;color:var(--gray600,#7f7f7f);padding:4px 6px 0}
    .more{display:flex;align-items:center;justify-content:center;gap:8px;height:44px;margin-top:6px;border-radius:22px;background:var(--ki-g-row,var(--gray200,#3a3a3a));font-size:14px;font-weight:500;color:var(--gray900,#c7c7c7)}
  `;
})();
