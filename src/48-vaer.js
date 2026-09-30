/* msh-vaer-card (+ innebygd msh-vaer-hero-card) · popup #vaer. Fasit: Vær v4 (spesifisert i Fiks 10), ellers Vær v3.dc.html.
 * Rekkefølge (standard, endres i «Tilpass været»): Toppkort (karusell: Været nå med heroFx · Andre varsler · Pollen, prikker)
 * · Farevarsler (utvidbare, skjult uten varsler) · Time for time · Dagskort (utvidbare, én åpen) · Detaljkort (2×N) · Månefase
 * · knappen «Tilpass været» (alltid nederst).
 * Config: sections [hero, alerts, hours, days, tiles, moon] · hidden_sections [] · tiles [sky, wind, gust, sun, hum, uv, press, rain]
 *   · hidden_tiles [] · hours (24) · days (7) · show_extras · show_pollen · show_graph (valgfri temperaturgraf etter timene)
 *   · hero_fx (true = bakgrunnsanimasjon i toppkortet, Fiks 17.30).
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
  // 26.24: fasen tegnes INNI sirkelen (clip-path: circle(50%)) – belyst del = halvsirkel + terminator-ellipse (rx = r·|cos 2πp|),
  // myk kant (gaussisk uskarphet) og skygge som gradient; voksende = lys til høyre, avtakende speilet (lys til venstre).
  let moonSeq = 0;
  const moonDisc = (p, size) => {
    const a = 2 * Math.PI * p, cs = Math.cos(a), rx = Math.abs(50 * cs).toFixed(2), wax = p < 0.5, id = 'mf' + (++moonSeq % 1000);
    const d = wax ? `M50,0 A50,50 0 0 1 50,100 A${rx},50 0 0 ${cs > 0 ? 0 : 1} 50,0Z` : `M50,0 A50,50 0 0 0 50,100 A${rx},50 0 0 ${cs > 0 ? 1 : 0} 50,0Z`;
    return `<svg class="moon" data-phase="${p}" data-wax="${wax ? 1 : 0}" viewBox="0 0 100 100" style="width:${size}px;height:${size}px;clip-path:circle(50%)" aria-hidden="true"><defs><radialGradient id="${id}d" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="#2c2e36"/><stop offset="1" stop-color="#15161b"/></radialGradient><radialGradient id="${id}l" cx="${wax ? 62 : 38}%" cy="38%" r="70%"><stop offset="0" stop-color="#fffaea"/><stop offset=".65" stop-color="#e9e3d2"/><stop offset="1" stop-color="#c9c1ab"/></radialGradient><filter id="${id}b" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="2.2"/></filter></defs><circle cx="50" cy="50" r="50" fill="url(#${id}d)"/><path class="lit" d="${d}" fill="url(#${id}l)" filter="url(#${id}b)"/></svg>`;
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
    // HAs hui-card setter element.preview (editor-forhåndsvisning, bool) uten try/catch – må ha setter (fiks 16.13)
    set preview(v) { this._haPreview = v; }
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
      const fxOn = c.hero_fx !== false; // 17.30 B: «Bakgrunnsanimasjon» av → ingen partikler/bevegelige lag
      const slides = [];
      slides.push(`<div class="sl now" data-key="s0" data-fxk="${cond ? cond.key : ''}" ${a.weather ? `data-ent="${esc(a.weather)}"` : ''}>
        <div class="fx" data-key="fx-${cond && fxOn ? cond.key : 'none'}">${cond && fxOn ? heroFx(cond.key) : ''}</div>
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
        ${M.dotsHTML(slides.length, cur)}
      </section>`;
    }
    showSlide(i) { const S = this._car; if (S) S.go(i); }
    // Felles karusell (MSH.snapCarousel, 17.12/17.17/17.30 A): aktiv prikk leses alltid fra faktisk scrollLeft og settes
    // rett i DOM-en (ingen tegning under sveip). Åpning av popupen (hash) og første bredde > 0 → side 1; ny bredde
    // (rotasjon) → samme side. Ingen scroll-behavior: smooth på containeren – bare i scrollTo ved trykk på prikk.
    afterRender() {
      const car = this.shadowRoot.querySelector('.car');
      if (!car) return;
      guardSwipe(car, 'pan-x');
      this._car = M.snapCarousel(car, {
        dots: () => this.shadowRoot.querySelector('.hero > .msh-dots'),
        index: () => 0,
        onIndex: (i) => this.setUI({ hero: i }, true),
        haptic: 'selection',
        reset: true,
      });
    }
    get styles() {
      return `${KEYFRAMES}
        .hero{display:flex;flex-direction:column;align-items:center;gap:10px}
        .car{width:100%;display:flex;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;scroll-padding:0;overflow-anchor:none;border-radius:28px;overscroll-behavior-x:contain;touch-action:pan-x}
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
    { type: 'boolean', name: 'hero_fx', label: 'Bakgrunnsanimasjon', help: 'Regn, snø, sol og vind i toppkortet', default: true },
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

  /* ================================================================ Fiks 26.24/26.25 · stil «scene» (Vær v5) */
  // HA-state → [norsk, ikon, bakgrunnsgradient, korttone]. Ukjent → cloudy. Natt + sunny/partlycloudy → natt-scene.
  const SC = {
    'clear-night': ['Klart', 'bedtime', 'linear-gradient(180deg,#0b1026 0%,#1b2347 55%,#2b3259 100%)', 'rgba(30,36,64,.55)'],
    cloudy: ['Skyet', 'cloud', 'linear-gradient(180deg,#465160 0%,#667180 60%,#7a8490 100%)', 'rgba(40,48,58,.55)'],
    fog: ['Tåke', 'foggy', 'linear-gradient(180deg,#59616a 0%,#838a91 60%,#959ba0 100%)', 'rgba(56,62,70,.55)'],
    hail: ['Hagl', 'mdi:weather-hail', 'linear-gradient(180deg,#212833 0%,#374150 60%,#475160 100%)', 'rgba(30,36,46,.55)'],
    lightning: ['Lyn', 'thunderstorm', 'linear-gradient(180deg,#171a28 0%,#2b2f44 60%,#3a3e56 100%)', 'rgba(28,30,44,.55)'],
    'lightning-rainy': ['Tordenbyger', 'thunderstorm', 'linear-gradient(180deg,#151924 0%,#28303f 60%,#374152 100%)', 'rgba(26,30,40,.55)'],
    partlycloudy: ['Delvis skyet', 'partly_cloudy_day', 'linear-gradient(180deg,#3a7cc1 0%,#66a3da 55%,#98c3e8 100%)', 'rgba(36,66,104,.45)'],
    'partlycloudy-night': ['Delvis skyet', 'partly_cloudy_night', 'linear-gradient(180deg,#0e1430 0%,#222b4f 60%,#323b60 100%)', 'rgba(30,36,64,.55)'],
    pouring: ['Kraftig regn', 'mdi:weather-pouring', 'linear-gradient(180deg,#1d2631 0%,#333f4d 60%,#434f5d 100%)', 'rgba(30,38,48,.55)'],
    rainy: ['Regn', 'rainy', 'linear-gradient(180deg,#2c3846 0%,#475566 60%,#586575 100%)', 'rgba(40,48,58,.55)'],
    snowy: ['Snø', 'weather_snowy', 'linear-gradient(180deg,#7d8b9b 0%,#a6b2bf 60%,#c3ccd5 100%)', 'rgba(62,74,88,.5)'],
    'snowy-rainy': ['Sludd', 'weather_mix', 'linear-gradient(180deg,#525e6b 0%,#788490 60%,#8c97a2 100%)', 'rgba(48,56,66,.55)'],
    sunny: ['Sol', 'clear_day', 'linear-gradient(180deg,#2c82d3 0%,#55a3e4 55%,#8ac2ee 100%)', 'rgba(28,66,116,.4)'],
    windy: ['Vind', 'air', 'linear-gradient(180deg,#4a6883 0%,#6c88a1 60%,#839db3 100%)', 'rgba(40,56,72,.5)'],
    'windy-variant': ['Vind og skyer', 'mdi:weather-windy-variant', 'linear-gradient(180deg,#475360 0%,#65727f 60%,#78848f 100%)', 'rgba(40,48,58,.55)'],
    exceptional: ['Ekstremvær', 'mdi:alert-octagon', 'linear-gradient(180deg,#281115 0%,#471c21 60%,#5a2427 100%)', 'rgba(50,24,28,.55)'],
  };
  M.VAER_SCENES = Object.keys(SC).filter((k) => k !== 'partlycloudy-night'); // alle 15 HA-værtilstandene
  const sceneOf = (state, night) => {
    let k = SC[state] ? state : 'cloudy';
    if (night && k === 'sunny') k = 'clear-night';
    if (night && k === 'partlycloudy') k = 'partlycloudy-night';
    const s = SC[k];
    return { key: k, label: s[0], icon: s[1], bg: s[2], card: s[3], color: k === 'sunny' || k === 'partlycloudy' ? SUNY : k === 'exceptional' ? C.red : 'var(--white, #fafafa)' };
  };
  // Partikler/lag per scene (fasit fx() i Vær v5): stjerner, måne, sol, skyer, tåke, regn, styrtregn, sprut, snø (3 lag),
  // hagl, lyn, vind og rød glød. Alt er absolutt plassert i scenelaget (dekker hele popupen) og pauses med .still.
  const sceneFx = (k) => {
    const P = [], add = (cls, s) => P.push(`<i class="${cls}" style="${s}"></i>`), R = (i, m = 100, o = 13) => (i * 37 + o) % m;
    const has = (...a) => a.includes(k);
    const stars = (n) => { for (let i = 0; i < n; i++) add('st', `left:${(i * 53 + 7) % 100}%;top:${(i * 29 + 3) % 58}%;width:${i % 4 ? 2 : 3}px;height:${i % 4 ? 2 : 3}px;animation-duration:${2 + (i % 5)}s;animation-delay:${-(i % 7)}s`); };
    const clouds = (n, a, dark, fast) => { for (let i = 0; i < n; i++) add('cl', `left:${-20 + R(i, 90, 5)}%;top:${-30 + (i % 4) * 46}px;width:${260 + (i % 3) * 90}px;height:${90 + (i % 2) * 30}px;background:${dark ? `rgba(20,24,32,${a})` : `rgba(255,255,255,${a})`};animation-duration:${(fast ? 9 : 26) + (i % 3) * (fast ? 3 : 8)}s;animation-delay:${-i * 4}s`); };
    const rain = (n, slant, dur, len, a) => { for (let i = 0; i < n; i++) add('rn', `left:${R(i, 110, 3) - 5}%;height:${len + (i % 3) * 6}px;opacity:${a};--sl:${slant}deg;--dx:${Math.round(-Math.tan(slant * Math.PI / 180) * 900)}px;animation-duration:${(dur + (i % 5) * 0.08).toFixed(2)}s;animation-delay:${(-((i * 0.137) % 1.3)).toFixed(2)}s`); };
    const splash = (n) => { for (let i = 0; i < n; i++) add('sp', `left:${R(i, 96, 11)}%;bottom:${4 + (i % 6) * 12}px;animation-delay:${(-(i * 0.19) % 1).toFixed(2)}s`); };
    const snow = (n) => { [[2, 14, 0.55], [4, 10, 0.75], [6, 7, 0.95]].forEach(([sz, dur, a], l) => { for (let i = 0; i < n; i++) add('sn', `left:${R(i + l * 7, 100, 17 + l * 5)}%;width:${sz}px;height:${sz}px;opacity:${a};animation-duration:${(dur + (i % 4) * 1.1).toFixed(1)}s;animation-delay:${(-((i * 1.7 + l) % dur)).toFixed(1)}s`); }); };
    const hail = (n) => { for (let i = 0; i < n; i++) add('hl', `left:${R(i, 100, 29)}%;animation-duration:${(0.55 + (i % 4) * 0.07).toFixed(2)}s;animation-delay:${(-((i * 0.11) % 0.7)).toFixed(2)}s`); };
    const fog = () => [8, 26, 44, 62, 80].forEach((y, i) => add('fg', `top:${y}%;animation-duration:${14 + i * 4}s;animation-delay:${-i * 3}s`));
    const wind = (n) => { for (let i = 0; i < n; i++) add('wd', `top:${6 + (i * 13) % 88}%;width:${90 + (i % 3) * 60}px;animation-duration:${(1.4 + (i % 4) * 0.35).toFixed(2)}s;animation-delay:${(-i * 0.45).toFixed(2)}s`); };
    const bolt = () => { add('fl', ''); P.push('<svg class="bolt" viewBox="0 0 60 160" aria-hidden="true"><path d="M34 0 L12 78 L30 78 L18 160 L52 60 L32 60 L46 0Z"/></svg>'); };
    if (has('clear-night', 'partlycloudy-night')) stars(k === 'clear-night' ? 46 : 26);
    if (k === 'clear-night') add('mo', '');
    if (has('sunny', 'partlycloudy')) { add('sg', ''); add('sr', ''); }
    if (k === 'exceptional') add('rg', '');
    if (has('cloudy', 'fog', 'windy-variant')) clouds(5, 0.16);
    if (has('partlycloudy', 'partlycloudy-night')) clouds(3, 0.28);
    if (has('hail', 'lightning', 'lightning-rainy', 'exceptional', 'pouring')) clouds(5, 0.45, true);
    if (has('rainy', 'snowy-rainy', 'snowy')) clouds(4, 0.12);
    if (k === 'windy') clouds(3, 0.14, false, true);
    if (k === 'fog') fog();
    if (has('rainy', 'lightning-rainy', 'pouring')) rain(k === 'pouring' ? 42 : 34, 8, 0.75, 18, 0.7);
    if (k === 'pouring') rain(46, 18, 0.5, 30, 0.55);
    if (has('rainy', 'pouring', 'lightning-rainy')) splash(k === 'pouring' ? 18 : 12);
    if (k === 'snowy-rainy') { snow(12); rain(16, 6, 0.9, 14, 0.5); }
    if (k === 'snowy') snow(22);
    if (k === 'hail') hail(30);
    if (has('lightning', 'lightning-rainy', 'exceptional')) bolt();
    if (has('windy', 'windy-variant', 'exceptional')) wind(k === 'exceptional' ? 9 : 7);
    return P.join('');
  };
  const SCENE_CSS = `
    :host{position:absolute;inset:0;z-index:-1;display:block;pointer-events:none;overflow:hidden;border-radius:inherit;contain:paint}
    .sc{position:absolute;inset:0;overflow:hidden;border-radius:inherit;transition:background .6s}
    .sc i,.sc svg{position:absolute;display:block;pointer-events:none}
    .st{border-radius:50%;background:#fff;animation:vs-tw 3s ease-in-out infinite}
    .mo{right:12%;top:max(70px,9%);width:64px;height:64px;border-radius:50%;background:radial-gradient(circle at 36% 34%,#fffbea,#ebe5d4 58%,#cfc7b0);box-shadow:0 0 50px rgba(255,248,220,.35)}
    .sg{right:-90px;top:-90px;width:360px;height:360px;border-radius:50%;background:radial-gradient(circle,rgba(255,236,160,.75),rgba(255,214,110,.25) 35%,transparent 66%);animation:vs-glow 6s ease-in-out infinite}
    .sr{right:-200px;top:-200px;width:580px;height:580px;border-radius:50%;background:repeating-conic-gradient(from 0deg,rgba(255,240,190,.16) 0deg 6deg,transparent 6deg 20deg);-webkit-mask:radial-gradient(circle,#000 18%,transparent 62%);mask:radial-gradient(circle,#000 18%,transparent 62%);animation:vs-spin 80s linear infinite}
    .rg{inset:-10%;background:radial-gradient(ellipse at 50% 20%,rgba(242,80,70,.55),transparent 60%);animation:vs-pulse 2.6s ease-in-out infinite}
    .cl{border-radius:999px;filter:blur(16px);animation:vs-drift 26s ease-in-out infinite alternate}
    .fg{left:-40%;width:180%;height:64px;border-radius:32px;background:linear-gradient(90deg,transparent,rgba(230,232,235,.22),rgba(230,232,235,.3),transparent);filter:blur(10px);animation:vs-fog 16s ease-in-out infinite alternate}
    .rn{top:-40px;width:1.6px;border-radius:1px;background:linear-gradient(transparent,rgba(210,228,255,.95));transform:rotate(var(--sl));animation:vs-rain .8s linear infinite}
    .sp{width:12px;height:4px;border-radius:50%;border:1px solid rgba(210,228,255,.55);opacity:0;animation:vs-splash .9s ease-out infinite}
    .sn{top:-12px;border-radius:50%;background:#fff;animation:vs-snow 10s linear infinite}
    .hl{top:-10px;width:5px;height:5px;border-radius:50%;background:#eef4fa;box-shadow:0 0 2px rgba(255,255,255,.8);animation:vs-hail .6s linear infinite}
    .wd{left:0;height:2px;border-radius:1px;background:linear-gradient(90deg,transparent,rgba(230,238,248,.55),transparent);animation:vs-wind 1.6s linear infinite}
    .fl{inset:0;background:rgba(255,255,240,.55);opacity:0;animation:vs-flash 6s linear infinite}
    .bolt{left:58%;top:6%;width:44px;height:120px;opacity:0;fill:rgba(255,252,220,.95);filter:drop-shadow(0 0 10px rgba(255,250,200,.9));animation:vs-flash 6s linear infinite}
    .still *{animation:none !important}
    .still .rn,.still .sn,.still .hl,.still .sp,.still .wd,.still .fl,.still .bolt{display:none !important}
    @media (prefers-reduced-motion: reduce){.sc *{animation:none !important}.rn,.sn,.hl,.sp,.wd,.fl,.bolt{display:none !important}}
    @keyframes vs-tw{0%,100%{opacity:.25}50%{opacity:.95}}
    @keyframes vs-glow{0%,100%{opacity:.85;transform:scale(1)}50%{opacity:1;transform:scale(1.08)}}
    @keyframes vs-spin{to{transform:rotate(360deg)}}
    @keyframes vs-pulse{0%,100%{opacity:.45}50%{opacity:1}}
    @keyframes vs-drift{0%{transform:translateX(-6%)}100%{transform:translateX(8%)}}
    @keyframes vs-fog{0%{transform:translateX(-12%)}100%{transform:translateX(12%)}}
    @keyframes vs-rain{0%{transform:translate(0,0) rotate(var(--sl))}100%{transform:translate(var(--dx),110vh) rotate(var(--sl))}}
    @keyframes vs-splash{0%{opacity:0;transform:scale(.2)}20%{opacity:1}100%{opacity:0;transform:scale(1.4)}}
    @keyframes vs-snow{0%{transform:translate(0,0)}50%{transform:translate(18px,55vh)}100%{transform:translate(-10px,110vh)}}
    @keyframes vs-hail{0%{transform:translate(0,0)}100%{transform:translate(-30px,110vh)}}
    @keyframes vs-wind{0%{transform:translateX(-120%);opacity:0}20%{opacity:.8}100%{transform:translateX(120vw);opacity:0}}
    @keyframes vs-flash{0%,82%,100%{opacity:0}83%,86%{opacity:1}84.5%{opacity:.15}88%{opacity:0}}
  `;
  // Faste kontroller i bunnen av popupen: stedsvelger (glass, nede til venstre, meny åpner oppover) og tune (nede til høyre)
  const CTL_CSS = `
    :host{position:absolute;left:0;right:0;bottom:0;height:0;z-index:6;pointer-events:none;display:block;font-family:${M.FONT};color:#fafafa;-webkit-font-smoothing:antialiased;-webkit-tap-highlight-color:transparent}
    *,*::before,*::after{box-sizing:border-box}
    button{font:inherit;color:inherit;border:0;background:none;padding:0;margin:0;cursor:pointer;-webkit-tap-highlight-color:transparent}
    .b{position:absolute;bottom:calc(16px + env(safe-area-inset-bottom, 0px));pointer-events:auto;height:44px;border-radius:22px;background:rgba(28,30,36,.72);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);box-shadow:inset 0 0 0 1px rgba(255,255,255,.1),0 6px 18px rgba(0,0,0,.25);display:flex;align-items:center;gap:6px;padding:0 12px 0 12px;font-size:14px;font-weight:500;transition:transform .15s cubic-bezier(.34,1.5,.64,1)}
    .b:active{transform:scale(.95)}
    .pl{left:16px;max-width:calc(100% - 100px)}
    .pn{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .tn{right:16px;width:44px;padding:0;justify-content:center}
    .mbg{position:absolute;left:0;right:0;bottom:0;height:100vh;pointer-events:auto}
    .mn{position:absolute;left:16px;bottom:calc(68px + env(safe-area-inset-bottom, 0px));pointer-events:auto;min-width:200px;max-width:calc(100% - 32px);max-height:50vh;overflow:auto;border-radius:20px;background:rgba(28,30,36,.88);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);box-shadow:inset 0 0 0 1px rgba(255,255,255,.1),0 10px 30px rgba(0,0,0,.35);padding:6px;display:flex;flex-direction:column;gap:2px;transform-origin:bottom left;animation:vc-in .18s ease-out}
    .mi{height:44px;border-radius:14px;display:flex;align-items:center;gap:8px;padding:0 12px;text-align:left;font-size:14px;white-space:nowrap}
    .mi.on{background:rgba(255,255,255,.14)}
    @keyframes vc-in{from{opacity:0;transform:translateY(6px) scale(.97)}to{opacity:1;transform:none}}
    @media (prefers-reduced-motion: reduce){.mn{animation:none}}
  `;
  // Scenelaget: eget element med shadow root, lagt i Bubble-popupen (.bubble-pop-up, transform → absolutt = hele popupen,
  // også bak headeren; fallgruve 1). Uten popup (forhåndsvisning) ligger det bak innholdet i kortet.
  const mkLayer = (cls) => { const el = document.createElement('div'); el.className = cls; el.attachShadow({ mode: 'open' }); return el; };
  // Glatte kurver (Catmull-Rom → kubisk Bézier, smooth() i Vær v5)
  const smooth = (P) => {
    if (!P.length) return '';
    if (P.length < 3) return P.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
    let d = `M${P[0][0].toFixed(1)},${P[0][1].toFixed(1)}`;
    for (let i = 0; i < P.length - 1; i++) {
      const p0 = P[i - 1] || P[i], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] || p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    return d;
  };
  M.vaerSmooth = smooth;
  // Steder (26.25): places: [{ name, entity }] – tom → Hjem (værentiteten fra autokonfig/overrides)
  const placesOf = (h, c) => {
    const L = (Array.isArray(c.places) ? c.places : []).filter((p) => p && p.entity).map((p) => ({ name: p.name || (h && h.states[p.entity] ? M.name(h, p.entity) : p.entity), entity: p.entity }));
    if (L.length) return L;
    const ent = M.vaerAuto(h, c).weather;
    return [{ name: (h && h.config && h.config.location_name) || 'Hjem', entity: ent, auto: true }];
  };
  M.vaerPlaces = placesOf;
  const STIL = [['klassisk', 'Klassisk'], ['scene', 'Scene']];
  const HIDE = [['alerts', 'Farevarsel', 'warning'], ['hours', 'Neste timer', 'schedule'], ['days', 'Døgnvarsel', 'calendar_month'], ['tiles', 'Fliser', 'grid_view']];
  const stilOf = (c) => (c && c.stil === 'klassisk' ? 'klassisk' : 'scene'); // standard scene (26.24)
  const hiddenOf = (c) => new Set([...(Array.isArray(c.hidden_sections) ? c.hidden_sections : []), ...(Array.isArray(c.hide) ? c.hide : [])]);
  M.vaerStilOf = stilOf;

  // GUI-editoren (getConfigElement): Steder – liste med fjern + «Legg til sted» (navn + weather.*-velger)
  const placesGui = (h, c, key) => {
    const L = Array.isArray(c.places) ? c.places.filter((p) => p && p.entity) : [], all = M.all(h, 'weather');
    return `<div class="f" data-key="vp-${key}"><label>Steder</label>
      ${L.length ? L.map((p, i) => `<div class="line" data-key="vp-${i}-${esc(p.entity)}" style="gap:8px"><span style="flex:1;min-width:0;font-size:13px">${esc(p.name || p.entity)} <span class="small">${esc(p.entity)}</span></span><button class="chip" data-a="fn" data-k="${key}" data-op="rm" data-i="${i}" aria-label="Fjern ${esc(p.name || p.entity)}">Fjern</button></div>`).join('') : '<div class="small">Bare Hjem (værmeldingen fra autokonfig) – legg til flere steder under.</div>'}
      <div class="line" style="gap:8px;flex-wrap:wrap"><input class="in" data-vp="name" placeholder="Navn (f.eks. Hytta)" style="flex:1 1 120px;min-width:0;height:40px;padding:0 12px;border-radius:12px;background:var(--gray100,#2f2f2f)">
        <select data-vp="ent" style="flex:1 1 140px;min-width:0;height:40px;padding:0 10px;border-radius:12px;background:var(--gray100,#2f2f2f)">${all.map((id) => `<option value="${esc(id)}">${esc(M.name(h, id))} · ${esc(id)}</option>`).join('')}</select>
        <button class="chip on" data-a="fn" data-k="${key}" data-op="add" ${all.length ? '' : 'disabled'}>Legg til sted</button></div></div>`;
  };
  const placesClick = (d, ed) => {
    const c = ed._config || {}, L = (Array.isArray(c.places) ? c.places : []).filter((p) => p && p.entity);
    if (d.op === 'rm') { L.splice(Number(d.i), 1); M.haptic('selection'); return ed._set('places', L.length ? L : undefined); }
    if (d.op === 'add') {
      const R = ed.shadowRoot || ed, ent = (R.querySelector('[data-vp="ent"]') || {}).value, nm = ((R.querySelector('[data-vp="name"]') || {}).value || '').trim();
      if (!ent) return undefined;
      M.haptic('success');
      return ed._set('places', [...L, { name: nm || M.name(ed._hass || ed.hass, ent), entity: ent }]);
    }
    return undefined;
  };

  class Vaer extends Forecast(M.Card) {
    static get cardName() { return 'Vær'; }
    static get defaults() { return { hours: 24, days: 7, show_graph: false, show_extras: true, show_pollen: true }; }
    static get schema() {
      return () => [
        // 26.24/26.25: samme valg som «Tilpass Vær» (Stil · Steder · Seksjoner · Fliser) – config er sannheten
        { type: 'select', name: 'stil', label: 'Stil', default: 'scene', options: STIL, help: 'Scene = fullskjerms værscene bak hele popupen · Klassisk = Vær v4' },
        { type: 'html', html: (hh, cc, key) => placesGui(hh, cc, key), click: (d, ed) => placesClick(d, ed) },
        ...HIDE.map(([k, l]) => ({ type: 'boolean', label: l, get: (hh, cc) => !hiddenOf(cc).has(k), set: (v, hh, cc, ed) => { const s = new Set(Array.isArray(cc.hide) ? cc.hide : []); if (v) s.delete(k); else s.add(k); const hs = (cc.hidden_sections || []).filter((x) => x !== k || !v); if (ed && ed._set) { if (hs.length !== (cc.hidden_sections || []).length) ed._config = { ...ed._config, hidden_sections: hs.length ? hs : undefined }; ed._set('hide', HIDE.map((x) => x[0]).filter((x) => s.has(x))); } } })),
        { type: 'order', name: 'tile_order', hiddenName: 'hidden_tiles', label: 'Fliser (rekkefølge – eller hold inne en flis og dra)', options: [...TILES.map((t) => [t[0], t[1]]), ['moon', 'Månefase (Scene)']] },
        { type: 'button', label: 'Tilbakestill rekkefølge', icon: 'mdi:restore', run: (hh, cc, ed) => { if (ed && ed._set) { ed._config = { ...ed._config, tiles: undefined }; ed._set('tile_order', undefined); } } },
        { type: 'overrides', label: 'Bytt entiteter', fields: FIELDS },
        { type: 'order', name: 'sections', hiddenName: 'hidden_sections', label: 'Seksjoner (Klassisk)', options: SECS.map((s) => [s[0], s[1]]) },
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
    static get uiPersist() { return ['place', 'seg']; }
    // Valgt sted (stedsvelgeren) overstyrer værentiteten – config er uendret (bare UI-tilstand i localStorage)
    get config() {
      const c = super.config, p = this._place(c);
      return p && !p.auto && p.entity ? { ...c, overrides: { ...(c.overrides || {}), weather: p.entity } } : c;
    }
    _place(c) {
      const L = placesOf(this._hass, c || super.config);
      return L[M.clamp(Number(this.ui.place) || 0, 0, L.length - 1)] || null;
    }
    // Bubble-popupen kortet ligger i (på tvers av shadow roots)
    _popEl() {
      let n = this;
      for (let i = 0; n && i < 60; i++) { if (n.classList && n.classList.contains('bubble-pop-up')) return n; n = n.parentNode || n.host; }
      return null;
    }
    onOpen() {
      super.onOpen();
      if (!this._config.embedded && M.isPopupOpen(this) && M.popupHash(this)) M.haptic('light'); // én haptic ved åpning (26.24)
      this._pause(false);
    }
    onClose() { super.onClose(); this._pause(true); this._ctlMenu = false; this._drawCtl(); }
    _pause(p) { const sc = this._layer && this._layer.shadowRoot.querySelector('.sc'); if (sc) sc.classList.toggle('paused', !!p); }
    disconnectedCallback() {
      super.disconnectedCallback();
      this._pause(true);
      // Kortet er tatt ut (popup lukket / ombygd): ta lagene ut av popupen hvis ingen ny instans bruker dem
      setTimeout(() => { if (this.isConnected) return; [this._layer, this._ctl].forEach((el) => { if (el && el.parentNode) el.remove(); }); if (this._popRef && this._popRef.getAttribute('data-ki-vaer-owner') === this._uid) this._popRef.removeAttribute('data-ki-vaer'); }, 0);
    }
    // Bunnluft: stedsvelgeren og tune-knappen ligger fast i bunnen (navbaren er skjult mens #vaer er åpen) → 80 px
    _applySpacing() {
      super._applySpacing();
      if (this._config.embedded || !M.popupContainer(this)) return;
      this.style.paddingBottom = 'calc(80px + env(safe-area-inset-bottom, 0px))';
    }
    // Scenelag (bak hele popupen, også bak headeren) + faste kontroller (stedsvelger · tune) i popup-laget
    _mountLayers() {
      const pop = this._popEl(), scene = stilOf(this._rawConfig) === 'scene', R = this.shadowRoot;
      this._uid = this._uid || M.uid();
      this._popRef = pop;
      if (pop) {
        pop.querySelectorAll(':scope > .msh-vaer-scene, :scope > .msh-vaer-ctl').forEach((el) => { if (el !== this._layer && el !== this._ctl) el.remove(); }); // gammel instans
        pop.setAttribute('data-ki-vaer', scene ? 'scene' : 'klassisk');
        pop.setAttribute('data-ki-vaer-owner', this._uid);
      }
      this.toggleAttribute('data-scene', scene);
      if (!this._ctl) {
        this._ctl = mkLayer('msh-vaer-ctl');
        this._ctl.shadowRoot.addEventListener('click', (e) => this._ctlClick(e));
        ['pointerdown', 'touchstart'].forEach((t) => this._ctl.addEventListener(t, (e) => e.stopPropagation(), { passive: true }));
      }
      const cp = pop || R.querySelector('.ctl-slot');
      if (cp && this._ctl.parentNode !== cp) cp.appendChild(this._ctl);
      this._ctl.style.cssText = pop ? '' : 'position:sticky;bottom:0;display:block;height:0;z-index:6';
      this._drawCtl();
      if (scene) {
        if (!this._layer) this._layer = mkLayer('msh-vaer-scene');
        const lp = pop || R.querySelector('.scn-slot');
        if (lp && this._layer.parentNode !== lp) lp.insertBefore(this._layer, lp.firstChild);
        const sc = this._sc || sceneOf(null, false), fxOn = this.config.hero_fx !== false && !(M.animOff && M.animOff());
        const k = sc.key + '|' + (fxOn ? 1 : 0);
        if (this._layer._k !== k) {
          this._layer._k = k;
          this._layer.shadowRoot.innerHTML = `<style>${SCENE_CSS}</style><div class="sc${fxOn ? '' : ' still'}" data-scene="${sc.key}" style="background:${sc.bg}">${sceneFx(sc.key)}</div>`;
        }
        this._pause(!!pop && !this.isOpen);
        this.style.setProperty('--vaer-card', sc.card);
      } else if (this._layer) { this._layer.remove(); this._layer = null; this.style.removeProperty('--vaer-card'); }
    }
    _drawCtl() {
      const el = this._ctl;
      if (!el) return;
      const L = placesOf(this._hass, super.config), cur = this._place(), i0 = L.indexOf(cur);
      const html = `<style>${CTL_CSS}</style>
        ${this._ctlMenu ? `<div class="mbg" data-a="close"></div><div class="mn" role="menu">${L.map((p, i) => `<button class="mi${i === i0 ? ' on' : ''}" role="menuitemradio" aria-checked="${i === i0}" data-a="pick" data-i="${i}">${M.icon(i === i0 ? 'mdi:map-marker' : 'mdi:map-marker-outline', 18)}<span>${esc(p.name)}</span></button>`).join('')}</div>` : ''}
        <button class="b pl" data-a="place" aria-haspopup="menu" aria-expanded="${!!this._ctlMenu}" aria-label="Velg sted">${M.icon('mdi:map-marker', 18)}<span class="pn">${esc(cur ? cur.name : 'Hjem')}</span>${M.icon(this._ctlMenu ? 'mdi:chevron-down' : 'mdi:chevron-up', 18)}</button>
        <button class="b tn" data-a="tune" aria-label="Tilpass Vær">${M.icon('mdi:tune', 20)}</button>`;
      if (el._h !== html) { el._h = html; el.shadowRoot.innerHTML = html; }
    }
    _ctlClick(e) {
      const b = e.target.closest && e.target.closest('[data-a]');
      if (!b) return;
      e.stopPropagation();
      const a = b.dataset.a;
      if (a === 'tune') { M.haptic('light'); this._ctlMenu = false; this._drawCtl(); return this.customize(); }
      if (a === 'place') { M.haptic('selection'); this._ctlMenu = !this._ctlMenu; return this._drawCtl(); }
      if (a === 'close') { this._ctlMenu = false; return this._drawCtl(); }
      if (a === 'pick') {
        M.haptic('selection');
        this._ctlMenu = false;
        this._fc = null;
        this.setUI({ place: Number(b.dataset.i) || 0 });
        this._drawCtl();
        if (this.isOpen) setTimeout(() => this._subscribe(), 0);
      }
      return undefined;
    }
    // Scrub på alle grafer: touch-action none, setPointerCapture, stopPropagation, stiplet markør + verdi (26.24)
    _bindScrubs() {
      this.shadowRoot.querySelectorAll('[data-scrub]').forEach((el) => {
        if (el.__scr) return;
        el.__scr = true;
        M.guardDrag(el, 'none');
        const pos = (e) => { const n = Number(el.dataset.n) || 1, r = el.getBoundingClientRect(); return M.clamp(Math.round(((e.clientX - r.left) / Math.max(1, r.width)) * (n - 1)), 0, Math.max(0, n - 1)); };
        let down = null;
        el.addEventListener('pointerdown', (e) => {
          if (e.button) return;
          e.stopPropagation();
          down = { x: e.clientX, moved: false, id: e.pointerId };
          try { el.setPointerCapture(e.pointerId); } catch (x) { /* */ }
          M.haptic('selection');
          this.setUI({ scr: { k: el.dataset.scrub, i: pos(e) } });
        });
        el.addEventListener('pointermove', (e) => {
          if (!down && e.pointerType !== 'mouse') return;
          if (down) { e.stopPropagation(); if (Math.abs(e.clientX - down.x) > 4) down.moved = true; }
          const i = pos(e), s = this.ui.scr;
          if (!s || s.k !== el.dataset.scrub || s.i !== i) this.setUI({ scr: { k: el.dataset.scrub, i } });
        });
        const end = (e) => {
          const wasDrag = down && down.moved;
          down = null;
          if (this.ui.scr) this.setUI({ scr: null }); // slipp → visningen går tilbake
          if (wasDrag && e && e.type === 'pointerup') { this._swallow = true; setTimeout(() => { this._swallow = false; }, 350); } // dagrad: ingen utfolding etter dra
        };
        ['pointerup', 'pointercancel'].forEach((t) => el.addEventListener(t, end));
        el.addEventListener('pointerleave', (e) => { if (!down && e.pointerType === 'mouse') end(e); });
      });
    }
    // Fliser: hold ~420 ms → løft (scale 1.05 + skygge), dra for å bytte plass, slipp lagrer tile_order (26.25)
    _bindTiles() {
      const box = this.shadowRoot.querySelector('[data-tiles]');
      if (!box || box.__td) return;
      box.__td = true;
      let st = null;
      const R = this.shadowRoot;
      const cancel = () => { if (st && st.timer) clearTimeout(st.timer); };
      box.addEventListener('pointerdown', (e) => {
        const it = e.target.closest && e.target.closest('.tw');
        if (!it || e.button || (e.target.closest && e.target.closest('[data-scrub],button'))) return;
        st = { it, k: it.dataset.tile, x0: e.clientX, y0: e.clientY, id: e.pointerId, on: false, over: null };
        st.timer = setTimeout(() => {
          if (!st) return;
          st.on = true; st.timer = null;
          this._busy = true;
          this._cancelHold();
          it.classList.add('lift');
          box.classList.add('tdrag');
          it.style.touchAction = 'none';
          try { it.setPointerCapture(st.id); } catch (x) { /* */ }
          M.haptic('medium');
        }, 420);
      });
      box.addEventListener('pointermove', (e) => {
        if (!st || e.pointerId !== st.id) return;
        const dx = e.clientX - st.x0, dy = e.clientY - st.y0;
        if (!st.on) { if (Math.abs(dx) + Math.abs(dy) > 8) { cancel(); st = null; } return; }
        e.stopPropagation(); e.preventDefault();
        st.it.style.transform = `translate(${dx}px, ${dy}px) scale(1.05)`;
        st.it.style.pointerEvents = 'none';
        const hit = R.elementFromPoint ? R.elementFromPoint(e.clientX, e.clientY) : null;
        st.it.style.pointerEvents = '';
        const ov = hit && hit.closest ? hit.closest('.tw') : null, ok = ov && ov !== st.it && box.contains(ov) ? ov : null;
        if (ok !== st.over) { if (st.over) st.over.classList.remove('over'); st.over = ok; if (ok) { ok.classList.add('over'); M.haptic('selection'); } }
      });
      const end = (e) => {
        if (!st || (e && e.pointerId !== st.id)) return;
        cancel();
        const s = st;
        st = null;
        if (!s.on) return;
        this._busy = false;
        this._swallow = true; setTimeout(() => { this._swallow = false; }, 400); // klikket etter slipp ignoreres
        s.it.classList.remove('lift'); s.it.style.transform = ''; s.it.style.touchAction = '';
        box.classList.remove('tdrag');
        if (s.over) s.over.classList.remove('over');
        if (!s.over) { M.haptic('light'); return this.update(); }
        const all = [...box.querySelectorAll('.tw')].map((x) => x.dataset.tile), to = s.over.dataset.tile;
        const o = all.filter((x) => x !== s.k), j = o.indexOf(to);
        o.splice(all.indexOf(s.k) < all.indexOf(to) ? j + 1 : j, 0, s.k);
        const full = orderOf(stilOf(this._rawConfig) === 'scene' ? [...TK, 'moon'] : TK, [...o, ...orderOf([...TK, 'moon'], this._rawConfig.tile_order || this._rawConfig.tiles).filter((x) => !o.includes(x))]);
        M.haptic('success');
        return this._saveCfg({ tile_order: full });
      };
      box.addEventListener('pointerup', end);
      box.addEventListener('pointercancel', (e) => { if (st && !st.on) { cancel(); st = null; } else end(e); });
      box.addEventListener('touchmove', (e) => { if (e.target.closest && e.target.closest('.tw')) e.stopPropagation(); if (st && st.on && e.cancelable) e.preventDefault(); }, { passive: false });
      // Fallgruve 2: hold-og-dra på flisene skal aldri nå Bubble (swipe-to-close) – pointerdown/touchstart/touchmove stoppes her
      box.addEventListener('pointerdown', (e) => { if (e.target.closest && e.target.closest('.tw')) e.stopPropagation(); });
      box.addEventListener('touchstart', (e) => { if (e.target.closest && e.target.closest('.tw')) e.stopPropagation(); }, { passive: true });
      box.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    async _saveCfg(patch) {
      const old = this._rawConfig || {}, n = { ...old, ...patch };
      Object.keys(patch).forEach((k) => { if (patch[k] === undefined) delete n[k]; });
      this.setConfig(n);
      const mine = this._rawConfig;
      try { const r = await M.saveCardConfig(this.hass, old, n, { card: this }); if (r && r.config && this._rawConfig === mine) this.setConfig(r.config); } catch (e) { console.warn('[ki-msh] Vær', e); } // endret imens → behold
    }
    // Toppkortet monteres i seksjonen «hero» (egen plassering i rekkefølgen), ikke i basens faste plass øverst.
    _mountHero(tag) {
      const slot = this.shadowRoot.querySelector('.vh-slot');
      if (!customElements.get(tag)) return;
      if (!this._heroEl) { this._heroEl = document.createElement(tag); this._heroEl._host = this; }
      if (!slot) { if (this._heroEl.parentNode) this._heroEl.remove(); return; }
      const raw = this._rawConfig || {}, pl = this._place(), pe = pl && !pl.auto ? pl.entity : null;
      if (this._heroSrc !== raw || this._heroPl !== pe) {
        this._heroSrc = raw; this._heroPl = pe;
        const { type, card_id, hero, sections, hidden_sections, tiles, hidden_tiles, tile_order, hide, places, stil, ...rest } = raw;
        if (pe) rest.overrides = { ...(rest.overrides || {}), weather: pe }; // valgt sted (stedsvelgeren)
        this._heroEl.setConfig({ type: 'custom:' + tag, ...rest, ...(hero || {}), embedded: true, card_id: card_id ? card_id + '_hero' : undefined });
      }
      if (this._heroEl.parentNode !== slot) slot.appendChild(this._heroEl);
      if (this._heroEl.hass !== this._hass) this._heroEl.hass = this._hass;
    }
    setPreview(k) { this._preview = k && WX[k] ? k : null; if (this._heroEl) { this._heroEl.update(); if (this._preview) this._heroEl.showSlide(0); } }
    customize(focus, opts) {
      if (!focus || focus === 'sections' || focus === 'tiles' || focus === 'layout' || focus === 'stil') return openSheet(this);
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
      // Temperaturgraf (valgfri, etter timene) med scrub – glatt kurve (26.24)
      if (c.show_graph) {
        const G = H.slice(0, 25).map((f) => ({ t: new Date(f.datetime).getTime(), v: num(f.temperature) })).filter((p) => p.v != null);
        const sc0 = ui.scr && ui.scr.k === 'kg' ? ui.scr.i : null, sel = sc0 != null ? Math.min(sc0, G.length - 1) : 0;
        let P = [[0, 60], [300, 60]];
        if (G.length > 1) {
          const mn = Math.min(...G.map((p) => p.v)) - 0.5, mx = Math.max(...G.map((p) => p.v)) + 0.5;
          P = G.map((p, i) => [(i / (G.length - 1)) * 300, 92 - ((p.v - mn) / (mx - mn)) * 72]);
        }
        const d = smooth(P), cur = G[sel];
        sec.hours += `<section class="gr">
          <div class="gh"><span class="row" style="gap:6px;font-size:12px;color:var(--gray700,#979797)">${M.icon('thermometer', 16)}Temperatur · neste 24 t</span><span class="num" style="font-size:14px;font-weight:500">${cur ? `${f1(cur.v)}° · ${sel ? 'kl ' + hm(cur.t) : 'nå'}` : '–'}</span></div>
          <div class="gw"><svg viewBox="0 0 300 100" preserveAspectRatio="none"><path d="${d} L300,100 L0,100Z" style="fill:${M.alpha(SUNY, 0.18)};stroke:none"></path><path class="sm" d="${d}" fill="none" style="stroke:${SUNY};stroke-width:2" stroke-linejoin="round" vector-effect="non-scaling-stroke"></path></svg>
            ${G.length > 1 && sc0 != null ? `<div class="gc" style="left:${(sel / (G.length - 1)) * 100}%"></div>` : ''}<div class="scrub" data-scrub="kg" data-n="${G.length}"></div></div>
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
        rain: (() => {
          const R = H.length ? R24 : Array(24).fill(0), sr = ui.scr && ui.scr.k === 'rn' ? Math.min(ui.scr.i, R.length - 1) : null;
          const P = R.map((v, i) => [(i / Math.max(1, R.length - 1)) * 100, 40 - (v / rMax) * 36]), d = smooth(P);
          const tt = sr != null && H[sr] ? `kl ${M.pad(new Date(H[sr].datetime).getHours())} · ${f1(R[sr])} ${pu}` : 'Neste 24 timer';
          return `<section class="tl"><span class="th">${M.icon('water_drop', 16, `color:${C.blue}`)}Nedbør</span><span class="tvv">${rain24 != null ? f1(rain24) : '–'}<small> ${esc(pu)}</small></span>
          <div class="rb"><svg viewBox="0 0 100 40" preserveAspectRatio="none"><path d="${d} L100,40 L0,40Z" style="fill:${M.alpha(C.blue, 0.35)}"></path><path class="sm" d="${d}" fill="none" style="stroke:${RAIN};stroke-width:2" vector-effect="non-scaling-stroke"></path></svg>${sr != null ? `<span class="gc" style="left:${P[sr][0]}%"></span>` : ''}<span class="scrub" data-scrub="rn" data-n="${R.length}"></span></div><span class="ts num">${esc(tt)}</span></section>`;
        })(),
        moon: `<section class="tl mnt" ${a.moon ? `data-ent="${esc(a.moon)}"` : ''}><span class="th">${M.icon('bedtime', 16)}Månefase</span>${moon.none ? '<svg class="moon" style="width:64px;height:64px"><circle cx="32" cy="32" r="32" fill="#404040"/></svg>' : moonDisc(moon.p, 64)}<span class="ts" style="margin-top:auto">${esc(moon.name)}</span></section>`,
      };
      const scene = stilOf(c) === 'scene';
      const tord = orderOf(scene ? [...TK, 'moon'] : TK, c.tile_order || c.tiles), thid = new Set(c.hidden_tiles || []);
      const tl = tord.filter((k) => !thid.has(k));
      // Fliser: hold inne ~420 ms og dra for å bytte plass (26.25) – lagres i tile_order
      sec.tiles = tl.length ? `<div class="tiles" data-tiles>${tl.map((k) => `<div class="tw" data-key="t-${k}" data-tile="${k}">${T[k]}</div>`).join('')}</div>` : '';
      sec.moon = `<section class="mn" ${a.moon ? `data-ent="${esc(a.moon)}"` : ''}>${moon.none ? '<svg class="moon" style="width:56px;height:56px"><circle cx="28" cy="28" r="28" fill="#404040"/></svg>' : moonDisc(moon.p, 56)}<span class="col" style="gap:2px"><span style="font-size:11px;color:var(--gray700,#979797)">Månefase</span><span style="font-size:16px;font-weight:500">${esc(moon.name)}</span></span></section>`;
      const hid = hiddenOf(c);
      const empty = !st ? M.emptyState(a.weather ? `Fant ikke ${a.weather}` : 'Fant ingen weather.*', 'overrides') : '';
      if (scene) return this._scene({ c, h, a, st, A, sunSt, sun, H, Dl, loaded, wu, pu, sec, hid, empty });
      const order = orderOf(SK, c.sections);
      const blocks = order.filter((k) => !hid.has(k) && sec[k]).map((k) => `<div class="blk" data-key="b-${k}" data-sec="${k}">${sec[k]}</div>`);
      // Stedsvelger + «Tilpass Vær» (tune) ligger fast i bunnen av popupen (portalet, 26.25) – ingen knapp nederst i innholdet
      return `<div class="wrap klassisk">${empty}${blocks.join('')}<div class="ctl-slot" data-nomorph></div></div>`;
    }
    /* ---------------------------------------------------------- stil «scene» (26.24/26.25, Vær v5) */
    _scene(x) {
      const { c, h, a, st, A, sunSt, sun, H, Dl, loaded, wu, pu, sec, hid, empty } = x, ui = this.ui, raw = this._rawConfig || {};
      const night = sunSt ? sunSt.state === 'below_horizon' : isNight(Date.now(), null);
      const sc = sceneOf(st ? st.state : null, night);
      this._sc = sc;
      const pl = this._place();
      const placeName = (pl && !pl.auto && pl.name) || c.name || (h.config && h.config.location_name) || (st ? M.name(h, a.weather) : '–');
      const today = todayOf(Dl) || Dl[0] || null, temp = st ? num(A.temperature) : null;
      const hi = today ? num(today.temperature) : null, lo = today ? num(today.templow) : null;
      // H/L som ÉN ferdig streng (white-space: nowrap) – aldri flere tekstnoder i en flex-kolonne (26.24)
      const hl = `H ${hi != null ? Math.round(hi) + '°' : '–'} · L ${lo != null ? Math.round(lo) + '°' : '–'}`;
      const S = {};
      S.now = `<section class="snw" ${a.weather ? `data-ent="${esc(a.weather)}"` : ''}><span class="spl ell">${esc(placeName)}</span>
        <span class="stp num">${temp != null ? Math.round(temp) : '–'}°</span>
        <span class="scd">${M.icon(sc.icon, 22, `color:${sc.color}`)}<span class="ell">${esc(st ? sc.label : '–')}</span></span>
        <span class="shl num">${esc(hl)}</span></section>`;
      if (sec.alerts) S.alerts = sec.alerts;
      // Neste timer: segment Temperatur · Nedbør · Vind (Liquid Glass-drag) + glatt graf med scrub og boble
      const seg = ['temp', 'rain', 'wind'].includes(ui.seg) ? ui.seg : 'temp';
      const G = H.slice(0, Math.max(12, Math.min(48, Number(raw.hours) || 24)));
      const val = (f) => (seg === 'temp' ? num(f.temperature) : seg === 'rain' ? num(f.precipitation) || 0 : num(f.wind_speed));
      const V = G.map(val), ok = V.filter((v) => v != null);
      const col = seg === 'temp' ? SUNY : seg === 'rain' ? RAIN : 'var(--light-blue, #c8ddfa)';
      let gHtml = `<div class="gph ph">${esc(!st ? 'Ingen værmelding' : loaded || !this.isOpen ? 'Ingen timeprognose' : 'Henter prognose …')}</div>`;
      if (ok.length > 1) {
        const gust = seg === 'wind' ? G.map((f) => num(f.wind_gust_speed)) : [];
        const all = [...ok, ...gust.filter((v) => v != null)];
        let mn = Math.min(...all), mx = Math.max(...all);
        if (seg !== 'temp') mn = 0;
        if (mx - mn < 1) mx = mn + 1;
        const X = (i) => (i / (G.length - 1)) * 300, Y = (v) => 100 - ((v - mn) / (mx - mn)) * 78 - 8;
        let last = ok[0];
        const P = V.map((v, i) => { if (v != null) last = v; return [X(i), Y(v != null ? v : last)]; }), d = smooth(P);
        const gP = gust.length && gust.some((v) => v != null) ? gust.map((v, i) => [X(i), Y(v != null ? v : 0)]) : null;
        const si = ui.scr && ui.scr.k === 'hg' ? Math.min(ui.scr.i, G.length - 1) : null;
        const txt = (i) => {
          const f = G[i], v = V[i];
          if (seg === 'temp') return v != null ? `${f1(v)}°` : '–';
          if (seg === 'rain') return `${f1(v)} ${pu}${num(f.precipitation_probability) != null ? ` · ${Math.round(f.precipitation_probability)} %` : ''}`;
          return `${v != null ? f1(v) : '–'} ${wu}${num(f.wind_gust_speed) != null ? ` · kast ${f1(f.wind_gust_speed)}` : ''}`;
        };
        const bub = si != null ? `<div class="gb num" style="left:clamp(56px, ${(si / (G.length - 1)) * 100}%, calc(100% - 56px))">${M.pad(new Date(G[si].datetime).getHours())} · ${esc(txt(si))}</div>` : '';
        const ticks = [0, 6, 12, 18].filter((i) => i < G.length).map((i) => `<span style="left:${(i / (G.length - 1)) * 100}%">${i ? M.pad(new Date(G[i].datetime).getHours()) : 'Nå'}</span>`).join('');
        gHtml = `<div class="gph" data-seg="${seg}"><svg viewBox="0 0 300 100" preserveAspectRatio="none"><defs><linearGradient id="vgf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:${col};stop-opacity:.45"/><stop offset="1" style="stop-color:${col};stop-opacity:0"/></linearGradient></defs>
          <path d="${d} L300,100 L0,100Z" fill="url(#vgf)"></path>${gP ? `<path class="sm" d="${smooth(gP)}" fill="none" style="stroke:${col};stroke-width:1.5;stroke-dasharray:4 4;opacity:.7" vector-effect="non-scaling-stroke"></path>` : ''}<path class="sm" d="${d}" fill="none" style="stroke:${col};stroke-width:2.5" stroke-linecap="round" vector-effect="non-scaling-stroke"></path></svg>
          ${si != null ? `<div class="gc" style="left:${(si / (G.length - 1)) * 100}%"><i style="top:${P[si][1]}%;background:${col}"></i></div>` : ''}${bub}
          <div class="scrub" data-scrub="hg" data-n="${G.length}"></div><div class="gt">${ticks}</div></div>`;
      }
      const strip = G.length ? `<div class="hst noscroll">${G.map((f, i) => {
        const t = new Date(f.datetime).getTime(), cd = sceneOf(f.condition, f.is_daytime != null ? !f.is_daytime : isNight(t, sun)), v = V[i];
        const lab = seg === 'temp' ? (v != null ? `${Math.round(v)}°` : '–') : seg === 'rain' ? (v != null ? f1(v) : '–') : (v != null ? f1(v) : '–');
        return `<span class="hs" data-key="hs${i}"><span class="hst-t">${i ? M.pad(new Date(t).getHours()) : 'Nå'}</span>${M.icon(cd.icon, 22, `color:${cd.color}`)}<span class="hst-v num">${lab}</span></span>`;
      }).join('')}</div>` : '';
      S.hours = `<section class="g gcard"><div class="ghd"><span class="gl">${M.icon('schedule', 16)}Neste timer</span></div>
        <div class="seg" role="tablist" data-glass-drag="x">${[['temp', 'Temperatur'], ['rain', 'Nedbør'], ['wind', 'Vind']].map(([k, l]) => `<button class="sg${seg === k ? ' on' : ''}" role="tab" aria-selected="${seg === k}" ${seg === k ? 'data-active="1"' : ''} data-act="seg" data-k="${k}" data-haptic="off" data-key="sg-${k}">${l}</button>`).join('')}</div>
        ${gHtml}${strip}</section>`;
      // Døgnvarsel (10 døgn): trykk folder ut dagen på stedet (én åpen, pil roteres); dra over spennet = klokkeslett + verdi
      const nD = Math.max(1, Math.min(10, Number(raw.days) || 10)), days = Dl.slice(0, nD);
      const HA = (this._fc && this._fc.hourly) || [];
      if (days.length) {
        const lows = days.map((f) => num(f.templow) != null ? num(f.templow) : num(f.temperature)).filter((v) => v != null), highs = days.map((f) => num(f.temperature)).filter((v) => v != null);
        const gmn = Math.min(...lows, ...highs), gmx = Math.max(...lows, ...highs), span = Math.max(1, gmx - gmn), pos = (v) => ((v - gmn) / span) * 100;
        const today0 = new Date().toDateString();
        S.days = `<section class="g gcard"><div class="ghd"><span class="gl">${M.icon('calendar_month', 16)}${days.length}-døgnsvarsel</span></div><div class="dl">${days.map((f, i) => {
          const t = new Date(f.datetime), key = 'd' + t.toDateString(), open = ui.dayOpen === key, isToday = t.toDateString() === today0;
          const cd = sceneOf(f.condition, false), hiD = num(f.temperature), loD = num(f.templow) != null ? num(f.templow) : hiD, pp = num(f.precipitation_probability);
          const dH = HA.filter((y) => new Date(y.datetime).toDateString() === t.toDateString());
          const sd = ui.scr && ui.scr.k === 'd' + i ? dH[Math.min(ui.scr.i, dH.length - 1)] : null;
          const nowM = isToday && temp != null && hiD != null ? `<i class="dnow" style="left:${M.clamp(pos(temp), 0, 100).toFixed(1)}%"></i>` : '';
          const bar = sd ? `<span class="dsv num">${M.pad(new Date(sd.datetime).getHours())}:00 · ${num(sd.temperature) != null ? f1(sd.temperature) + '°' : '–'}</span>`
            : `<span class="dtrk"><span class="dfill" style="left:${loD != null ? pos(loD).toFixed(1) : 0}%;width:${hiD != null && loD != null ? Math.max(4, pos(hiD) - pos(loD)).toFixed(1) : 0}%;background-size:${(10000 / Math.max(4, (hiD != null && loD != null ? pos(hiD) - pos(loD) : 100))).toFixed(0)}% 100%;background-position:${loD != null && hiD != null && pos(hiD) - pos(loD) < 100 ? (pos(loD) / Math.max(0.01, 100 - (pos(hiD) - pos(loD))) * 100).toFixed(0) : 0}% 0"></span>${nowM}</span>`;
          let det = '';
          if (open) {
            const nm = isToday ? 'I dag' : cap(t.toLocaleDateString('nb-NO', { weekday: 'long' }));
            const pr = num(f.precipitation), ws = num(f.wind_speed);
            const sent = `${nm}: ${cd.label.toLowerCase()}${pr != null ? `, ${f1(pr)} ${pu} nedbør` : ''}. Fra ${loD != null ? Math.round(loD) + '°' : '–'} om natta til ${hiD != null ? Math.round(hiD) + '°' : '–'} på ettermiddagen${ws != null ? `, vind ${f1(ws)} ${wu}` : ''}.`;
            const h3 = dH.filter((y) => new Date(y.datetime).getHours() % 3 === 0);
            const shift = sun ? Math.round((new Date(t).setHours(12, 0, 0, 0) - new Date().setHours(12, 0, 0, 0)) / 86400000) * 86400000 : 0;
            const uvD = num(f.uv_index), huD = num(f.humidity);
            const cells = [['water_drop', 'Nedbør', pr != null ? `${f1(pr)} ${pu}${pp != null ? ` · ${Math.round(pp)} %` : ''}` : '–'], ['air', 'Vind', ws != null ? `${f1(ws)} ${wu}${f.wind_bearing != null ? ' ' + compass(f.wind_bearing) : ''}` : '–'], ['light_mode', 'UV', uvD != null ? `${f1(uvD)} · ${uvOf(uvD)[0].toLowerCase()}` : '–'],
              ['humidity_percentage', 'Fukt', huD != null ? `${Math.round(huD)} %` : '–'], ['mdi:weather-sunset-up', 'Sol opp', sun ? hm(sun.rise + shift) : '–'], ['mdi:weather-sunset-down', 'Sol ned', sun ? hm(sun.set + shift) : '–']];
            det = `<div class="dx" data-key="dx-${esc(key)}"><p class="dsen">${esc(sent)}</p>
              ${h3.length ? `<div class="d3 noscroll">${h3.map((y, j) => { const cy = sceneOf(y.condition, y.is_daytime != null ? !y.is_daytime : isNight(new Date(y.datetime).getTime(), sun)), py = num(y.precipitation_probability); return `<span class="hs" data-key="d3-${j}"><span class="hst-t">${M.pad(new Date(y.datetime).getHours())}</span>${M.icon(cy.icon, 22, `color:${cy.color}`)}<span class="hst-v num">${num(y.temperature) != null ? Math.round(y.temperature) + '°' : '–'}</span><span class="hst-p num">${py != null ? Math.round(py) + ' %' : num(y.precipitation) ? f1(y.precipitation) + ' ' + esc(pu) : ''}</span></span>`; }).join('')}</div>` : ''}
              <div class="dgr">${cells.map(([ic, l, v]) => `<span class="dc">${M.icon(ic, 18)}<span class="col" style="min-width:0"><span class="dcl">${l}</span><span class="dcv ell">${esc(v)}</span></span></span>`).join('')}</div></div>`;
          }
          return `<div class="dw${open ? ' open' : ''}" data-key="${esc(key)}"><button class="dr" data-act="day" data-k="${esc(key)}" data-haptic="light" aria-expanded="${open}">
            <span class="dn">${esc(isToday ? 'I dag' : cap(wd(t)))}</span><span class="di">${M.icon(cd.icon, 24, `color:${cd.color}`)}${pp != null && pp >= 20 ? `<small class="num">${Math.round(pp)} %</small>` : ''}</span>
            <span class="dlo2 num">${loD != null ? Math.round(loD) + '°' : '–'}</span><span class="dbar" ${dH.length > 1 ? `data-scrub="d${i}" data-n="${dH.length}"` : ''}>${bar}</span><span class="dhi2 num">${hiD != null ? Math.round(hiD) + '°' : '–'}</span>
            <span class="chev">${M.icon('expand_more', 20, `transition:transform .25s;transform:${open ? 'rotate(180deg)' : 'none'}`)}</span></button>${det}</div>`;
        }).join('')}</div></section>`;
      } else S.days = `<section class="g gcard"><div class="gph ph">${esc(!st ? 'Ingen værmelding' : loaded || !this.isOpen ? 'Ingen dagsprognose' : 'Henter prognose …')}</div></section>`;
      if (sec.tiles) S.tiles = sec.tiles;
      const blocks = ['now', 'alerts', 'hours', 'days', 'tiles'].filter((k) => S[k] && !hid.has(k)).map((k) => `<div class="blk" data-key="b-${k}" data-sec="${k}">${S[k]}</div>`);
      return `<div class="wrap scene" data-scene="${sc.key}"><div class="scn-slot" data-nomorph></div>${empty}${blocks.join('')}<div class="ctl-slot" data-nomorph></div></div>`;
    }
    onAction(name, el, ev) {
      if (name === 'alert') { if (ev.composedPath().some((n) => n.tagName === 'A')) return; return this.setUI({ alertOpen: this.ui.alertOpen === el.dataset.k ? null : el.dataset.k }); }
      if (name === 'day') return this.setUI({ dayOpen: this.ui.dayOpen === el.dataset.k ? null : el.dataset.k });
      if (name === 'seg') { if (this.ui.seg !== el.dataset.k) M.haptic('selection'); return this.setUI({ seg: el.dataset.k, scr: null }); }
      if (name === 'winddir') return this.setUI({ windDeg: !this.ui.windDeg });
      return super.onAction(name, el, ev);
    }
    afterRender() {
      guardSwipe(this.shadowRoot.querySelector('.hrs'), 'pan-x');
      this.shadowRoot.querySelectorAll('.hst,.d3').forEach((el) => guardSwipe(el, 'pan-x'));
      const seg = this.shadowRoot.querySelector('.seg');
      if (seg && M.glassDrag) M.glassDrag(seg, { axis: 'x' }); // Liquid Glass-drag (26.24): pan-y + stopPropagation, haptic ved bytte
      this._bindScrubs();
      this._bindTiles();
      this._mountLayers();
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
        .rb{position:relative;flex:1;min-height:28px;margin-top:4px}
        .rb svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
        .rb .gc{border-left-color:${M.alpha(C.blue, 0.8)}}
        .tiles{position:relative}
        .tw{position:relative;touch-action:pan-y;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;transition:transform .2s cubic-bezier(.2,.8,.2,1)}
        .tw.lift{z-index:5;transition:none;box-shadow:0 14px 30px rgba(0,0,0,.45);border-radius:28px}
        .tw.over>.tl{box-shadow:inset 0 0 0 2px var(--pink,#f285c9)}
        .tdrag .tw:not(.lift){transform:scale(.98)}
        .mnt .moon{margin:6px 0 0}
        .ctl-slot{display:block;height:0}
        /* ---- stil «scene» (26.24/26.25): scenen ligger i popup-laget; kortene er halvtransparente glass */
        :host([data-scene]){--vaer-t2:rgba(255,255,255,.72);--vaer-t3:rgba(255,255,255,.55);--gray600:rgba(255,255,255,.6);--gray700:rgba(255,255,255,.72);--gray800:rgba(255,255,255,.8);--gray900:rgba(255,255,255,.9)} /* lesbar tekst over scenen */
        .scene{position:relative;gap:12px;color:#fff}
        .scn-slot{position:absolute;inset:0;z-index:0;pointer-events:none;border-radius:28px;overflow:hidden}
        .scene>.blk{position:relative;z-index:1}
        .g,.scene .tl,.scene .day{background:var(--vaer-card,rgba(40,48,58,.55));-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);box-shadow:inset 0 0 0 1px rgba(255,255,255,.08)}
        .g{border-radius:28px}
        .gcard{display:flex;flex-direction:column;gap:12px;padding:16px}
        .scene .th,.scene .tvv small{color:var(--vaer-t2)}
        .scene .ts{color:rgba(255,255,255,.85)}
        .scene .bar{background:rgba(255,255,255,.2)}
        .scene .mk{box-shadow:0 0 0 2px rgba(0,0,0,.25)}
        .scene .wd{background:rgba(255,255,255,.14)}
        .snw{display:flex;flex-direction:column;align-items:center;text-align:center;gap:2px;padding:18px 0 22px;text-shadow:0 1px 8px rgba(0,0,0,.25)}
        .spl{font-size:17px;font-weight:500;max-width:100%}
        .stp{font-size:92px;font-weight:200;letter-spacing:-0.04em;line-height:1;padding-left:.22em}
        .scd{display:flex;align-items:center;gap:6px;font-size:17px;font-weight:500;max-width:100%}
        .shl{font-size:16px;color:rgba(255,255,255,.85);white-space:nowrap}
        .ghd{display:flex;align-items:center;justify-content:space-between;gap:8px}
        .gl{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--vaer-t2);text-transform:uppercase;letter-spacing:.04em}
        .seg{display:flex;gap:2px;padding:4px;border-radius:22px;background:rgba(0,0,0,.22);position:relative;touch-action:pan-y}
        .sg{flex:1;min-width:0;height:34px;border-radius:17px;font-size:13px;font-weight:500;color:rgba(255,255,255,.78);transition:background .2s,color .2s;white-space:nowrap}
        .sg.on{background:rgba(255,255,255,.92);color:#1c1e24}
        .seg .gd-lens{position:absolute;z-index:3;pointer-events:none}
        .gph{position:relative;height:120px;margin:4px 0 14px}
        .gph.ph{height:auto;min-height:60px;display:grid;place-items:center;font-size:13px;color:var(--vaer-t2);margin:0}
        .gph svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
        .gph .gc{position:absolute;top:0;bottom:0;border-left:1px dashed rgba(255,255,255,.7);pointer-events:none}
        .gph .gc i{position:absolute;left:-5px;width:10px;height:10px;margin-top:-5px;border-radius:5px;box-shadow:0 0 0 2px #fff}
        .gb{position:absolute;top:-6px;transform:translate(-50%,-100%);padding:4px 10px;border-radius:12px;background:rgba(20,22,28,.78);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);font-size:12px;font-weight:600;white-space:nowrap;pointer-events:none}
        .gt{position:absolute;left:0;right:0;bottom:-16px;height:14px;pointer-events:none}
        .gt span{position:absolute;transform:translateX(-50%);font-size:11px;color:var(--vaer-t3)}
        .gt span:first-child{transform:none}
        .hst,.d3{display:flex;gap:4px;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;overscroll-behavior-x:contain;margin:0 -4px}
        .hs{flex:none;width:48px;display:flex;flex-direction:column;align-items:center;gap:6px;padding:6px 0;border-radius:16px}
        .hst-t{font-size:12px;color:var(--vaer-t2)}
        .hst-v{font-size:14px;font-weight:500}
        .hst-p{font-size:11px;color:var(--light-blue,#c8ddfa);min-height:13px}
        .dl{display:flex;flex-direction:column}
        .dw{border-top:1px solid rgba(255,255,255,.1)}
        .dw:first-child{border-top:0}
        .dr{display:grid;grid-template-columns:52px 44px 36px minmax(0,1fr) 36px 22px;align-items:center;gap:6px;width:100%;min-height:50px;text-align:left}
        .dn{font-size:15px;font-weight:500}
        .di{display:flex;flex-direction:column;align-items:center;line-height:1}
        .di small{font-size:10px;color:var(--light-blue,#c8ddfa);margin-top:2px}
        .dlo2{font-size:15px;color:var(--vaer-t2);text-align:right}
        .dhi2{font-size:15px;font-weight:500}
        .dbar{position:relative;height:28px;display:flex;align-items:center}
        .dtrk{position:relative;display:block;width:100%;height:5px;border-radius:3px;background:rgba(0,0,0,.25)}
        .dfill{position:absolute;top:0;bottom:0;border-radius:3px;background-image:linear-gradient(90deg,#73b9f2,#66d19e 35%,#f2d26f 65%,#f28073)}
        .dnow{position:absolute;top:-2px;width:9px;height:9px;margin-left:-4.5px;border-radius:5px;background:#fff;box-shadow:0 0 0 2px rgba(0,0,0,.3)}
        .dsv{width:100%;text-align:center;font-size:13px;font-weight:600;white-space:nowrap}
        .dr .chev{display:grid;place-items:center;color:var(--vaer-t2)}
        .dx{display:flex;flex-direction:column;gap:12px;padding:4px 0 14px}
        .dsen{margin:0;font-size:14px;line-height:1.45;color:rgba(255,255,255,.9);text-wrap:pretty}
        .dgr{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
        .dc{display:flex;align-items:center;gap:8px;min-width:0;padding:10px;border-radius:16px;background:rgba(0,0,0,.18);color:var(--vaer-t2)}
        .dcl{font-size:11px;color:var(--vaer-t3)}
        .dcv{font-size:13px;font-weight:500;color:#fff}
        .scene .tiles{gap:10px}
        .scene .tl{border-radius:28px}
        .mn{display:flex;align-items:center;gap:16px;padding:16px 18px;border-radius:28px;background:var(--gray200,#3a3a3a)}
        .moon{position:relative;flex:none;border-radius:50%;overflow:hidden;display:block}
      `;
    }
  }
  M.define('msh-vaer-card', Vaer, 'MSH Vær', 'Toppkort, farevarsler, time for time, dagskort, detaljkort og månefase med «Tilpass været». Prognose abonneres kun mens #vaer er åpen.');


  /* ------------------------------------------------------------ popup-utseende #vaer (26.24/26.25 · kun Bubble Card)
   * Stilen «scene»: scenen dekker HELE popupen, også bak Bubble-headeren – ingen grå kant/ramme og ingen mørk topplinje.
   * Blokken under legges i popupens styles av strategien (04-strategy.js kjører M.POPUP_FORCE etter overstyringer) og av
   * M.buildPopups. Den er inaktiv til kortet setter data-ki-vaer="scene" på .bubble-pop-up (kortets stil), så byttet
   * Klassisk ⇄ Scene skjer live uten ny generering; Klassisk beholder mal A (bg_opacity 98 osv.) uendret. */
  const VS = '/* ki-vaer:start (fiks 26.25 · værscene bak hele popupen, aktiv når kortets stil er scene) */', VE = '/* ki-vaer:end */';
  const VAER_BLOCK = `${VS}
.bubble-pop-up[data-ki-vaer="scene"]{background:transparent!important;--bubble-pop-up-background-color:transparent;--bubble-pop-up-main-background-color:transparent;box-shadow:none!important;border:none!important;overflow:hidden}
.bubble-pop-up[data-ki-vaer="scene"] .bubble-pop-up-background{background:none!important;display:none!important}
.bubble-pop-up[data-ki-vaer="scene"] #header-container,.bubble-pop-up[data-ki-vaer="scene"] #header-container > div > div,.bubble-pop-up[data-ki-vaer="scene"] .bubble-header-container,.bubble-pop-up[data-ki-vaer="scene"] .bubble-header{background:transparent!important;box-shadow:none!important;border:none!important}
.bubble-pop-up[data-ki-vaer="scene"] .bubble-name{color:#fff!important;text-shadow:0 1px 6px rgba(0,0,0,.3)}
.bubble-pop-up[data-ki-vaer="scene"] .bubble-close-button{background-color:rgba(28,30,36,.55)!important;-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);color:#fff!important}
.bubble-pop-up[data-ki-vaer="scene"] > .bubble-pop-up-container{background:transparent!important}
${VE}`;
  const vaerStyles = (prev) => {
    let s0 = typeof prev === 'string' ? prev : '';
    for (let i = s0.indexOf(VS); i >= 0; i = s0.indexOf(VS)) { const j = s0.indexOf(VE, i); s0 = s0.slice(0, i) + (j >= 0 ? s0.slice(j + VE.length) : ''); }
    return (s0.trim() ? s0.trim() + '\n' : '') + VAER_BLOCK;
  };
  M.vaerPopupStyles = vaerStyles;
  M.POPUP_FORCE = M.POPUP_FORCE || {};
  M.POPUP_FORCE['#vaer'] = (cfg) => {
    if (!cfg || typeof cfg !== 'object' || !Array.isArray(cfg.cards) || !cfg.cards.some((c) => c && String(c.type || '').replace(/^custom:/, '') === 'msh-vaer-card')) return null;
    return { ...cfg, styles: vaerStyles(cfg.styles) };
  };
  // Tilpass Hjem → Popups → Vær: samme stil-verdi som «Tilpass Vær» og GUI-editoren (kortets config via ki-store)
  const liveVaer = () => { const out = []; (M.liveCards || new Map()).forEach((set) => set.forEach((el) => { if (el && el.localName === 'msh-vaer-card' && el.isConnected !== undefined) out.push(el); })); return out; };
  M.vaerStil = () => { const el = liveVaer()[0]; if (el) return stilOf(el._rawConfig); const s0 = M.store && M.store.eff ? M.store.eff('cards.pop-vaer') : null; return stilOf(s0 || {}); };
  M.setVaerStil = async (v) => {
    v = v === 'klassisk' ? 'klassisk' : 'scene';
    const els = liveVaer(), el = els.find((x) => x.isConnected) || els[0];
    M.haptic('selection');
    if (el && el._rawConfig) return el._saveCfg({ stil: v });
    if (M.store) return M.store.set('cards.pop-vaer', { ...(M.store.get('cards.pop-vaer') || {}), stil: v }, { immediate: true });
    return undefined;
  };

  // Segment «Klassisk · Scene» med miniatyr (Tilpass Hjem → Popups → Vær). act = data-a-verdien i vertsarket.
  M.vaerStilHTML = function (act) {
    const cur = M.vaerStil ? M.vaerStil() : 'scene', PINK = 'linear-gradient(145deg, rgb(242 133 201) -10%, rgb(245 205 198) 100%)';
    const prev = (k) => (k === 'scene'
      ? '<span style="display:block;height:34px;border-radius:10px;background:linear-gradient(180deg,#2c3846,#586575);position:relative;overflow:hidden"><i style="position:absolute;left:25%;top:4px;width:1.5px;height:10px;background:rgba(210,228,255,.9);transform:rotate(10deg)"></i><i style="position:absolute;left:60%;top:12px;width:1.5px;height:10px;background:rgba(210,228,255,.9);transform:rotate(10deg)"></i><b style="position:absolute;left:5px;right:5px;bottom:5px;height:9px;border-radius:4px;background:rgba(40,48,58,.6)"></b></span>'
      : '<span style="display:grid;grid-template-columns:1fr 1fr;gap:3px;height:34px;padding:4px;border-radius:10px;background:#282828"><b style="grid-column:span 2;border-radius:4px;background:#3a3a3a"></b><b style="border-radius:4px;background:#3a3a3a"></b><b style="border-radius:4px;background:#3a3a3a"></b></span>');
    return `<div class="msh-vsm" data-key="vsm" style="display:flex;flex-direction:column;gap:6px">
      <div style="font-size:13px;color:var(--gray700,#979797);padding:0 4px">Vær · stil</div>
      <div role="radiogroup" data-glass-drag="x" style="display:flex;gap:4px;padding:4px;border-radius:24px;background:var(--gray100,#2f2f2f)">${STIL.map(([k, l]) => { const on = k === cur; return `<button role="radio" aria-checked="${on}" ${on ? 'data-active="1"' : ''} data-a="${act}" data-v="${k}" style="flex:1;min-width:0;display:flex;flex-direction:column;gap:5px;padding:6px;border:0;border-radius:20px;font:inherit;font-size:13px;font-weight:600;cursor:pointer;background:${on ? PINK : 'transparent'};color:${on ? '#2f2f2f' : 'var(--gray800,#afafaf)'}">${prev(k)}<span>${l}</span></button>`; }).join('')}</div>
      <div style="font-size:12px;color:var(--gray600,#7f7f7f);padding:0 4px">${cur === 'scene' ? 'Værscene bak hele popupen (regn, snø, lyn, stjerner, sol og tåke)' : 'Vær v4 med toppkort og vanlige kort'} · samme valg som i «Tilpass Vær»</div></div>`;
  };

  /* ================================================================ «Tilpass Vær» (26.25 · ark portalet ut av popupen, MSH.overlay) */
  // Stil (Klassisk · Scene) · Steder (liste, fjern, «Legg til sted» med navn + weather.*-velger) · Seksjoner av/på
  // (Farevarsel, Neste timer, Døgnvarsel, Fliser) + Animasjoner · Fliser: «Tilbakestill rekkefølge».
  // Utkastflyten (MSH.draftEditor): endringer vises straks i kortet, lagres i kortets config ved Ferdig (rosa pille øverst
  // til høyre). Utenfor/Esc forkaster. Samme felter som GUI-editoren (stil, places, hide, tile_order, hero_fx).
  const miniPrev = (k) => (k === 'scene'
    ? '<span class="mp sc"><i></i><i></i><i></i><b></b><b></b></span>'
    : '<span class="mp kl"><b></b><b></b><b class="s"></b><b class="s"></b></span>');
  function openSheet(card) {
    if (card._sheet && card._sheet.ov && !card._sheet.ov.closed) return card._sheet;
    let ov = null;
    const ctl = M.draftEditor(card, {
      saveOpts: { scope: 'shared' },
      banner: () => ov && ov.body,
      alive: () => !ov || ov.host.isConnected,
      close: () => ov && ov.close(),
      onBusy: (b) => { st.busy = b; draw(); },
      onReload: () => draw(),
    });
    const st = { busy: false, name: '', ent: '' };
    const apply = (patch, hap) => {
      if (st.busy) return;
      const next = { ...ctl.draft, ...patch };
      Object.keys(patch).forEach((k) => { if (patch[k] === undefined || (Array.isArray(patch[k]) && !patch[k].length)) delete next[k]; });
      ctl.set(next);
      if (hap) M.haptic(hap);
      draw();
    };
    const sw = (a, k, on, label) => `<button class="tsw${on ? ' on' : ''}" data-a="${a}" data-k="${k}" role="switch" aria-checked="${on}" aria-label="${esc(label)}"></button>`;
    const draw = () => {
      if (!ov) return;
      const sh = ov.root.querySelector('.sh'), top = sh ? sh.scrollTop : 0;
      const D = ctl.draft, h = card.hass, stil = stilOf(D), hid = hiddenOf(D), fxOn = D.hero_fx !== false;
      const L = (Array.isArray(D.places) ? D.places : []).filter((p) => p && p.entity), all = M.all(h, 'weather');
      const auto = M.vaerAuto(h, { ...D, overrides: { ...(D.overrides || {}) } }).weather;
      const hasSel = !!customElements.get('ha-selector');
      if (!st.ent || !all.includes(st.ent)) st.ent = all.find((id) => !L.some((p) => p.entity === id)) || all[0] || '';
      box.innerHTML = `<div class="hd"><span class="tt">Tilpass Vær</span><button class="ok" data-a="done" ${st.busy ? 'disabled aria-busy="true"' : ''}>${st.busy ? 'Lagrer …' : 'Ferdig'}</button></div>
        <span class="cap">Stil</span>
        <div class="stl" role="radiogroup">${STIL.map(([k, l]) => `<button class="sto${stil === k ? ' on' : ''}" role="radio" aria-checked="${stil === k}" data-a="stil" data-k="${k}">${miniPrev(k)}<span class="sl">${l}</span><span class="ss">${k === 'scene' ? 'Værscene bak hele popupen' : 'Vær v4 med toppkort'}</span></button>`).join('')}</div>
        <span class="cap">Steder</span>
        <div class="rows">${(L.length ? L : [{ name: (h && h.config && h.config.location_name) || 'Hjem', entity: auto, auto: true }]).map((p, i) => `<div class="r" data-key="pl-${i}">
          <span class="ri">${M.icon('mdi:map-marker-outline', 20)}</span><span class="col grow" style="gap:2px;min-width:0"><span class="rl ell">${esc(p.name || p.entity || '–')}</span><span class="rs ell">${esc(p.auto ? `Automatisk · ${p.entity || 'fant ingen weather.*'}` : p.entity)}</span></span>
          ${p.auto ? '' : `<button class="x" data-a="rm" data-k="${i}" aria-label="Fjern ${esc(p.name || p.entity)}">${M.icon('mdi:close', 18)}</button>`}</div>`).join('')}</div>
        <div class="add">
          <span class="rs" style="padding:0 4px">Legg til sted</span>
          <input class="in" data-in="name" placeholder="Navn (f.eks. Hytta)" value="${esc(st.name)}" autocomplete="off">
          ${hasSel ? '<ha-selector class="hsel"></ha-selector>' : `<div class="chips">${all.length ? all.map((id) => `<button class="chip${st.ent === id ? ' on' : ''}" data-a="ent" data-k="${esc(id)}" aria-pressed="${st.ent === id}">${esc(M.name(h, id))}</button>`).join('') : '<span class="rs">Fant ingen weather.*-entiteter</span>'}</div>`}
          <button class="nb addb" data-a="add" ${st.ent ? '' : 'disabled'}>${M.icon('mdi:plus', 18)}Legg til sted</button></div>
        <span class="cap">Seksjoner</span>
        <div class="rows">${HIDE.map(([k, l, ic]) => `<div class="r" data-key="sec-${k}"><span class="ri">${M.icon(ic, 20)}</span><span class="rl ell">${l}</span>${sw('sec', k, !hid.has(k), l)}</div>`).join('')}
          <div class="r"><span class="ri">${M.icon('mdi:weather-snowy-rainy', 20)}</span><span class="col grow" style="gap:2px;min-width:0"><span class="rl ell">Animasjoner</span><span class="rs ell">Regn, snø, lyn, sol og vind</span></span>${sw('fx', 'fx', fxOn, 'Animasjoner')}</div></div>
        <span class="cap">Fliser</span>
        <div class="r tr"><span class="ri">${M.icon('grid_view', 20)}</span><span class="col grow" style="gap:2px;min-width:0"><span class="rl">Rekkefølge</span><span class="rs">Hold inne en flis i popupen og dra</span></span><button class="nb" data-a="treset" ${D.tile_order || D.tiles ? '' : 'disabled'}>Tilbakestill rekkefølge</button></div>
        <button class="more" data-a="more">${M.icon('mdi:cog-outline', 18)}Entiteter og prognose</button>`;
      const inp = box.querySelector('[data-in="name"]');
      if (inp) inp.addEventListener('input', () => { st.name = inp.value; });
      const hs = box.querySelector('ha-selector');
      if (hs) {
        hs.hass = h; hs.selector = { entity: { domain: 'weather' } }; hs.value = st.ent; hs.label = 'Værmelding (weather.*)';
        hs.addEventListener('value-changed', (e) => { st.ent = (e.detail && e.detail.value) || ''; const b = box.querySelector('[data-a="add"]'); if (b) b.disabled = !st.ent; });
      }
      if (sh) sh.scrollTop = top;
    };
    ov = M.overlay({ html: '', css: SHEET_CSS, maxWidth: 440, onClose: () => { ctl.dispose(); card._sheet = null; } });
    const box = document.createElement('div');
    box.className = 'vaer-sheet';
    Object.defineProperty(box, '_config', { get: () => ctl.draft });
    ov.body.appendChild(box);
    ov.root.addEventListener('click', (e) => {
      const el = e.target.closest && e.target.closest('[data-a]');
      if (!el || el.disabled) return;
      const a = el.dataset.a, k = el.dataset.k, D = ctl.draft;
      const L = (Array.isArray(D.places) ? D.places : []).filter((p) => p && p.entity);
      switch (a) {
        case 'done': return ctl.done();
        case 'stil': return stilOf(D) === k ? undefined : apply({ stil: k }, 'selection');
        case 'rm': { L.splice(Number(k), 1); return apply({ places: L }, 'selection'); }
        case 'ent': st.ent = k; M.haptic('selection'); return draw();
        case 'add': {
          if (!st.ent) return undefined;
          const nm = (st.name || '').trim() || M.name(card.hass, st.ent);
          st.name = '';
          return apply({ places: [...L.filter((p) => p.entity !== st.ent || p.name !== nm), { name: nm, entity: st.ent }] }, 'success');
        }
        case 'sec': {
          const s = new Set(Array.isArray(D.hide) ? D.hide : []), was = hiddenOf(D).has(k);
          if (was) s.delete(k); else s.add(k);
          const hs = (D.hidden_sections || []).filter((x) => !(was && x === k));
          return apply({ hide: HIDE.map((x) => x[0]).filter((x) => s.has(x)), hidden_sections: hs }, 'selection');
        }
        case 'fx': return apply({ hero_fx: D.hero_fx === false }, 'selection');
        case 'treset': return apply({ tile_order: undefined, tiles: undefined }, 'warning');
        case 'more': return Promise.resolve(ctl.done()).then((r) => { if (ctl.closed) M.Card.prototype.customize.call(card, 'overrides'); return r; });
        default: return undefined;
      }
    });
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
    .fxr{height:64px;padding-right:12px}
    .rs{font-size:12px;color:var(--ki-g-t2,var(--gray700,#979797))}
    .tsw{position:relative;width:46px;height:28px;border-radius:14px;background:#545454;flex:none;transition:background .2s}
    .tsw::after{content:'';position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:11px;background:#fafafa;transition:transform .2s cubic-bezier(.34,1.4,.64,1)}
    .tsw.on{background:${PINKG}}
    .tsw.on::after{transform:translateX(18px)}
    .grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px;padding:10px;border-radius:24px;background:var(--ki-g-seg,rgba(0,0,0,0.18))}
    .g{display:flex;align-items:center;gap:8px;height:48px;padding:0 4px 0 12px;border-radius:16px;background:var(--ki-g-row,var(--gray200,#3a3a3a));cursor:grab;touch-action:none;user-select:none;-webkit-user-select:none;min-width:0;transition:opacity .2s,box-shadow .15s}
    .g.off>:not(.eye){opacity:.5}
    .g .eye{width:30px;height:30px}
    .gl{flex:1;min-width:0;font-size:13px;font-weight:500}
    .drag{position:relative;z-index:5;opacity:.9;transition:none !important;cursor:grabbing}
    .r.over{box-shadow:inset 0 3px 0 rgb(242 133 201)}
    .g.over{box-shadow:inset 0 0 0 2px rgb(242 133 201)}
    .note{font-size:12px;color:var(--gray600,#7f7f7f);padding:4px 6px 0}
    .hd{flex-wrap:nowrap}
    .hd .tt{flex:1;min-width:0}
    .stl{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .sto{display:flex;flex-direction:column;align-items:flex-start;gap:4px;padding:10px;border-radius:22px;background:var(--ki-g-row,var(--gray200,#3a3a3a));box-shadow:inset 0 0 0 2px transparent;transition:box-shadow .2s;text-align:left}
    .sto.on{box-shadow:inset 0 0 0 2px rgb(242 133 201)}
    .sto:active{transform:scale(.97)}
    .sl{font-size:15px;font-weight:600;padding:2px 4px 0}
    .ss{font-size:11px;color:var(--ki-g-t2,var(--gray700,#979797));padding:0 4px}
    .mp{position:relative;display:block;width:100%;height:64px;border-radius:14px;overflow:hidden}
    .mp.kl{background:#282828;display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:6px}
    .mp.kl b{display:block;border-radius:6px;background:#3a3a3a;grid-column:span 2}
    .mp.kl b.s{grid-column:span 1}
    .mp.sc{background:linear-gradient(180deg,#2c3846,#586575);padding:6px;display:flex;flex-direction:column;gap:4px;justify-content:flex-end}
    .mp.sc i{position:absolute;top:4px;width:1.5px;height:12px;background:rgba(210,228,255,.9);transform:rotate(10deg)}
    .mp.sc i:nth-child(1){left:22%}.mp.sc i:nth-child(2){left:52%;top:14px}.mp.sc i:nth-child(3){left:78%}
    .mp.sc b{display:block;height:14px;border-radius:6px;background:rgba(40,48,58,.6);box-shadow:inset 0 0 0 1px rgba(255,255,255,.12)}
    .x{width:36px;height:36px;border-radius:18px;flex:none;display:grid;place-items:center;color:var(--gray800,#afafaf)}
    .add{display:flex;flex-direction:column;gap:8px;padding:10px;border-radius:24px;background:var(--ki-g-seg,rgba(0,0,0,0.18))}
    .in{height:44px;padding:0 14px;border-radius:14px;background:var(--ki-g-row,var(--gray200,#3a3a3a));font-size:14px}
    .addb{display:flex;align-items:center;justify-content:center;gap:6px}
    .nb:disabled{opacity:.4}
    .r.tr{height:auto;min-height:64px;padding:8px 8px 8px 10px;flex-wrap:wrap}
    .hsel{display:block}
    .more{display:flex;align-items:center;justify-content:center;gap:8px;height:44px;margin-top:6px;border-radius:22px;background:var(--ki-g-row,var(--gray200,#3a3a3a));font-size:14px;font-weight:500;color:var(--gray900,#c7c7c7)}
  `;
})();
