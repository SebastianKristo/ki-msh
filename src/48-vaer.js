/* msh-vaer-card (+ innebygd msh-vaer-hero-card) · popup #vaer. Fasit: Vær v5.dc.html for stil «scene» (Fiks 26.24/26.25 + 27:
 * fx()/fxBase()/@keyframes portet 1:1, Neste timer som kolonnekort, døgnvarsel, fliser, steder med søk og dra-og-slipp);
 * stil «klassisk» = Vær v4 (spesifisert i Fiks 10), ellers Vær v3.dc.html.
 * Rekkefølge (standard, endres i «Tilpass været»): Toppkort (karusell: Været nå med heroFx · Andre varsler · Pollen, prikker)
 * · Farevarsler (utvidbare, skjult uten varsler) · Time for time · Dagskort (utvidbare, én åpen) · Detaljkort (2×N) · Månefase
 * · stedsvelger + «Tilpass Vær» (sticky nederst etter siste seksjon, 28.1).
 * Config (28.1): style (scene | klassisk) · places [{ id, name }] · exclude [id] · order [id] (Fiks 42: alle weather.* er steder automatisk) · sections { alerts, hours, days, tiles: true/false }
 *   · tile_order [...] · section_order [hero, alerts, hours, days, tiles, moon] (Klassisk) · hidden_sections [] · hidden_tiles []
 *   · hours (24) · days (7) · show_extras · show_pollen · show_graph (valgfri temperaturgraf etter timene)
 *   Gamle nøkler (stil, hide, sections som liste, tiles) leses som alias og migreres (normCfg).
 *   · hero_fx (true = bakgrunnsanimasjon i toppkortet, Fiks 17.30).
 *   Lagres i kortets config (MSH.saveCardConfig) fra «Tilpass været» og er de samme feltene som i GUI-editoren.
 * Prognose: weather/subscribe_forecast (hourly + daily) KUN mens popupen er åpen; faller tilbake til weather.get_forecasts.
 * Toppkortet er innebygd som seksjonen «hero» (egen plassering i rekkefølgen, MSH.HEROES).
 */
(function () {
  const M = window.MSH, esc = M.esc, C = M.C;
  const VERSION = window.KI_MSH_VERSION || '?';
  if (!M.__vaerLogged) { M.__vaerLogged = true; setTimeout(console.info, 0, '%c ki-weather-card %c msh-vaer-card ' + VERSION + ' ', 'background:#73b9f2;color:#10202c;font-weight:600;border-radius:4px 0 0 4px;padding:2px 4px', 'background:#3a3a3a;color:#fafafa;border-radius:0 4px 4px 0;padding:2px 4px'); } // ki-hex-ok: konsollmerke
  M.VAER_VERSION = VERSION;
  // Fiks 34/35 · tema: gjennomsiktig hvit/svart (regel 3/4), aksent som tekst/ikon (pkt. 6), tone-bakgrunn (pkt. 5); mørk = uendret
  const WA = (a) => (M.theme ? M.theme.whiteA(a) : `rgba(255,255,255,${a})`), BA = (a) => (M.theme ? M.theme.blackA(a) : `rgba(0,0,0,${a})`); // ki-hex-ok: reserve uten MSH.theme
  const AT = (c) => { const r = M.theme && M.theme.accentText ? M.theme.accentText(c) : c; return /^color-mix/.test(r) ? c : r; }; // ukjente farger beholdes
  const TONE = (c, a) => (M.theme && M.theme.tone ? M.theme.tone(c, undefined, a).bg : M.alpha(c, a));
  const SUNY = C.yellow, CLOUD = 'var(--ki-text-1, var(--gray900, #c7c7c7))', MOON = 'var(--ki-text-mid, var(--gray700, #979797))', RAIN = C.blue;
  // intern nøkkel → [Material-ikon, etikett, farge]
  const WX = { sun: ['clear_day', 'Sol', SUNY], moon: ['bedtime', 'Klarvær', MOON], part: ['partly_cloudy_day', 'Delvis skyet', SUNY], partn: ['partly_cloudy_night', 'Delvis skyet', MOON], cloud: ['cloud', 'Overskyet', CLOUD], rain: ['rainy', 'Regn', RAIN], sleet: ['weather_mix', 'Sludd', C.lightBlue], snow: ['weather_snowy', 'Snø', 'var(--ki-text, var(--white, #fafafa))'], fog: ['foggy', 'Tåke', CLOUD], thunder: ['thunderstorm', 'Torden', SUNY], wind: ['air', 'Kraftig vind', RAIN] };
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
  const wxIcon = (icon, size, color, extra = '') => M.icon(icon, size, `color:${AT(color)};animation:${WXANIM[icon] || 'none'};${extra}`);
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
    return `<svg class="moon" data-phase="${p}" data-wax="${wax ? 1 : 0}" viewBox="0 0 100 100" style="width:${size}px;height:${size}px;clip-path:circle(50%)" aria-hidden="true"><defs><radialGradient id="${id}d" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="#2c2e36"/><stop offset="1" stop-color="#15161b"/></radialGradient><radialGradient id="${id}l" cx="${wax ? 62 : 38}%" cy="38%" r="70%"><stop offset="0" stop-color="#fffaea"/><stop offset=".65" stop-color="#e9e3d2"/><stop offset="1" stop-color="#c9c1ab"/></radialGradient><filter id="${id}b" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="2.2"/></filter></defs><circle cx="50" cy="50" r="50" fill="url(#${id}d)"/><path class="lit" d="${d}" fill="url(#${id}l)" filter="url(#${id}b)"/></svg>`; // ki-hex-ok: måneillustrasjon
  };
  const uvOf = (v) => (v == null ? ['–', 'var(--ki-text-3, var(--gray600, #7f7f7f))'] : v < 1 ? ['Svært lav', C.green] : v < 3 ? ['Lav', C.green] : v < 6 ? ['Moderat', C.yellow] : v < 8 ? ['Høy', C.orange] : v < 11 ? ['Svært høy', C.red] : ['Ekstrem', C.purple]);
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
    if (k === 'thunder') P.push(['b', 'inset:0;background:rgba(255,255,240,0.5);animation:wx-bolt 4.5s linear infinite']); // ki-hex-ok: værscene/illustrasjon (mørk øy)
    if (k === 'sun') {
      P.push(['sr', `right:-60px;top:-60px;width:300px;height:300px;border-radius:150px;background:radial-gradient(circle, ${M.alpha(SUNY, 0.28)}, transparent 65%);animation:wx-ray 5s ease-in-out infinite`]);
      P.push(['sb', `right:-150px;top:-150px;width:480px;height:480px;border-radius:240px;background:repeating-conic-gradient(from 0deg, ${M.alpha(SUNY, 0.1)} 0deg 6deg, transparent 6deg 22deg);-webkit-mask:radial-gradient(circle, #000 20%, transparent 62%);mask:radial-gradient(circle, #000 20%, transparent 62%);animation:wx-rays 60s linear infinite`]);
    }
    if (k === 'part' || k === 'cloud' || k === 'partn') [[-10, 20, 220], [40, 90, 260]].forEach(([x, y, w], i) => P.push(['c', `left:${x}%;top:${y}px;width:${w}px;height:70px;border-radius:35px;background:rgba(255,255,255,${k === 'cloud' ? 0.07 : 0.05});filter:blur(10px);animation:wx-drift ${8 + i * 3}s ease-in-out infinite`])); // ki-hex-ok: værscene/illustrasjon (mørk øy)
    if (k === 'wind') for (let i = 0; i < 7; i++) P.push(['w', `left:0;top:${20 + i * 24}px;width:${90 + (i % 3) * 40}px;height:2px;border-radius:1px;background:linear-gradient(90deg, transparent, rgba(220,230,245,0.45), transparent);animation:wx-wind ${(1.4 + (i % 4) * 0.3).toFixed(1)}s linear ${(-i * 0.4).toFixed(1)}s infinite`]);
    return P.map(([t, s]) => `<span data-fx="${t}" style="position:absolute;${s}"></span>`).join('');
  };
  /* Fiks 56 G · horisontale scroll-lister (timestripen, døgnets 3-timersrad, karusellen): vertikal scroll skal virke uansett
   * hvor sveipet starter. touch-action: pan-x pan-y (nettleseren eier begge retninger), overflow-x: auto, overscroll-behavior-x:
   * contain, ingen preventDefault. Retningslås: første touchmove over 8 px bestemmer retningen – vertikal (|dy| > |dx|) slipper
   * gesten helt (ingen stopPropagation, popupen scroller/lukkes som normalt); horisontal tar den (stopPropagation på resten av
   * touchmove, så Bubble Cards swipe-to-close ikke ser den). Erstatter guardSwipe (pan-x + stopPropagation på alt). */
  const LOCK = 8;
  const hScroll = (el) => {
    if (!el) return;
    el.__mshTA = 'pan-x pan-y'; // bevares av MSH.morph
    if (el.style.touchAction !== el.__mshTA) el.style.touchAction = el.__mshTA;
    if (el.__mshHS) return;
    el.__mshHS = true;
    el.style.overscrollBehaviorX = 'contain';
    let s = null;
    el.addEventListener('touchstart', (e) => { const t = e.touches && e.touches[0]; s = t && e.touches.length === 1 ? { x: t.clientX, y: t.clientY, d: null } : null; }, { passive: true });
    el.addEventListener('touchmove', (e) => {
      const t = e.touches && e.touches[0];
      if (!s || !t) return;
      if (!s.d) {
        const dx = t.clientX - s.x, dy = t.clientY - s.y;
        if (Math.abs(dx) <= LOCK && Math.abs(dy) <= LOCK) return;
        s.d = Math.abs(dy) > Math.abs(dx) ? 'v' : 'h';
        el._lock = s.d; // (test/diagnose)
      }
      if (s.d === 'h') e.stopPropagation();
    }, { passive: true });
    const end = () => { s = null; };
    el.addEventListener('touchend', end, { passive: true });
    el.addEventListener('touchcancel', end, { passive: true });
  };
  M.vaerHScroll = hScroll;

  /* ------------------------------------------------------------ felles prognose-mixin */
  const Forecast = (Base) => class extends Base {
    _types(st) {
      const sf = st ? num(st.attributes.supported_features) : null;
      const t = [];
      if (sf == null || sf & 2) t.push('hourly');
      if (sf == null || sf & 1) t.push('daily');
      return t;
    }
    // Fiks 55 A4: værmeldingen abonneres først når Bubble-popupen har satt seg (MSH.whenPopupSettled via basekortet) –
    // ingen tegning/oppslag under åpne-animasjonen; forrige værmelding (this._fc) står i DOM-en så lenge
    static get settleOnOpen() { return true; }
    onOpen() { if (!this._settling) this._subscribe(); }
    onSettled() { if (this.isOpen) this._subscribe(); }
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
  const PL = [['Ingen', 'var(--ki-text-3, var(--gray600, #7f7f7f))'], ['Beskjeden', C.green], ['Moderat', C.yellow], ['Kraftig', C.orange], ['Ekstrem', C.red]];
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
      const col = cond ? cond.color : 'var(--ki-text-3, var(--gray600, #7f7f7f))';
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
          <div class="exg">${X.map(([ic, lab, co, al], i) => `<div class="ext" data-key="x${i}" aria-label="${al}">${M.icon(ic, 30, `color:${AT(co)};animation:${i === 2 ? WXANIM.bedtime : i === 3 ? 'wx-spin 24s linear infinite' : 'none'}`)}<span>${esc(lab)}</span></div>`).join('')}</div></div>`);
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
          <div class="pg">${shown.map((p, i) => { const L = p.lv == null ? ['–', 'var(--ki-text-3, var(--gray600, #7f7f7f))'] : PL[p.lv]; return `<div class="pt" ${p.id ? `data-ent="${esc(p.id)}"` : ''} data-key="p${i}-${esc(p.id || p.name)}">${M.icon(p.icon, 20, `color:${AT(L[1])}`)}<span class="col" style="min-width:0"><span class="pn ell">${esc(p.name)}</span><span style="font-size:10px;color:var(--ki-text-2, ${L[1]})">${L[0]}</span></span></div>`; }).join('')}</div></div>`);
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
      hScroll(car); // 56 G: pan-x pan-y + retningslås (vertikalt sveip på karusellen scroller popupen)
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
        .car{width:100%;display:flex;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;scroll-padding:0;overflow-anchor:none;border-radius:28px;overscroll-behavior-x:contain;touch-action:pan-x pan-y}
        .sl{flex:none;width:100%;scroll-snap-align:start;scroll-snap-stop:always;min-height:190px;border-radius:28px;background:var(--ki-surface, var(--gray200,#3a3a3a));display:flex;flex-direction:column}
        .now{position:relative;padding:22px 24px;justify-content:space-between;overflow:hidden}
        .fx{position:absolute;inset:0;overflow:hidden;border-radius:28px;pointer-events:none}
        .pl{position:relative;z-index:1;font-size:14px;color:var(--ki-text-1, var(--gray900,#c7c7c7));display:flex;align-items:center;gap:8px}
        .pvt{font-size:11px;font-weight:600;padding:2px 8px;border-radius:8px;background:${WA(0.12)};color:var(--ki-text, var(--white,#fafafa))}
        .tv{position:relative;z-index:1;display:flex;align-items:flex-end;gap:6px}
        .big{font-size:64px;font-weight:300;letter-spacing:-0.04em;line-height:1}
        .fl{font-size:15px;color:var(--ki-text-2, var(--gray800,#afafaf));padding-bottom:6px;white-space:nowrap}
        .meta{position:relative;z-index:1;display:flex;gap:14px;font-size:14px;color:var(--ki-text-1, var(--gray900,#c7c7c7));white-space:nowrap}
        .hi{position:absolute;right:20px;top:50%;transform:translateY(-50%);line-height:0;pointer-events:none}
        .ex,.po{padding:20px 16px 16px}
        .ex{gap:14px}
        .po{gap:12px}
        .exg{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
        .ext{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;height:112px;border-radius:22px;background:var(--ki-surface-2, var(--gray100,#2f2f2f));min-width:0}
        .ext span{font-size:12px;color:var(--ki-text-1, var(--gray900,#c7c7c7));text-align:center;line-height:1.25;padding:0 4px}
        .ph{display:flex;justify-content:space-between;align-items:baseline;gap:8px;padding:0 8px}
        .src{font-size:11px;color:var(--ki-text-3, var(--gray600,#7f7f7f))}
        .lnk{color:var(--ki-text-2, var(--gray800,#afafaf));text-decoration:underline}
        .pg{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
        .pt{display:flex;align-items:center;gap:8px;height:53px;padding:0 10px;border-radius:18px;background:var(--ki-surface-2, var(--gray100,#2f2f2f));min-width:0}
        .pn{font-size:12px;font-weight:500}
      `;
    }
  }
  M.define('msh-vaer-hero-card', VaerHero, 'MSH Vær · toppkort', 'Været nå med værbakgrunn, sol/måne/UV og pollen i en sveipbar karusell. Innebygd i msh-vaer-card.');

  /* ================================================================ hovedkort */
  const SECS = [['hero', 'Toppkort', 'mdi:view-carousel-outline'], ['alerts', 'Farevarsler', 'warning'], ['hours', 'Time for time', 'schedule'], ['days', 'Dagskort', 'calendar_month'], ['tiles', 'Detaljkort', 'grid_view'], ['moon', 'Månefase', 'bedtime']];
  const TILES = [['sky', 'Skydekke', 'cloud'], ['wind', 'Vind', 'air'], ['gust', 'Vindkast', 'storm'], ['sun', 'Sol opp og ned', 'wb_twilight'], ['hum', 'Fukt', 'humidity_percentage'], ['uv', 'UV-indeks', 'light_mode'], ['press', 'Trykk', 'compress'], ['rain', 'Nedbør', 'water_drop']];
  const SK = SECS.map((s) => s[0]), TK = TILES.map((t) => t[0]);
  // 27.0: flisene i Scene (Vær v5): Vind · Soloppgang · Månefase · UV · Føles som · Nedbør · Sikt · Luftfuktighet · Lufttrykk
  const STK = ['wind', 'sun', 'moon', 'uv', 'feels', 'rain', 'vis', 'hum', 'press'];
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
  const LV = { 1: ['Grønt', C.green], 2: ['Gult', C.yellow], 3: ['Oransje', C.orange], 4: ['Rødt', C.red], 5: ['Svart', 'var(--white, #fafafa)'] }; // ki-hex-ok: farevarselnivå (flate)
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

  /* ================================================================ Fiks 26.24/26.25 + 27 · stil «scene» (fasit Vær v5.dc.html) */
  // 27.0/27.3: tabellen C i Vær v5 (renderVals) 1:1 – HA-state → [etikett, ikon, bakgrunn (3 stopp), kortfarge (var(--card))].
  // Natt: sunny → clear-night; partlycloudy → «partlycloudy-night» (nattens bakgrunn/kort + stjerner og skyer). Ukjent → cloudy.
  const SC = {
    'clear-night': ['Klart', 'mdi:weather-night', ['#0b1224', '#141f3a', '#22305a'], 'rgba(12,18,36,.5)'],
    cloudy: ['Skyet', 'mdi:weather-cloudy', ['#4a525e', '#59626f', '#687280'], 'rgba(40,46,56,.38)'],
    fog: ['Tåke', 'mdi:weather-fog', ['#5d646c', '#6e757d', '#7f868e'], 'rgba(46,50,56,.38)'],
    hail: ['Hagl', 'mdi:weather-hail', ['#2c3340', '#3a4252', '#4b5466'], 'rgba(26,30,40,.45)'],
    lightning: ['Lyn', 'mdi:weather-lightning', ['#1a1d28', '#262a38', '#343a4c'], 'rgba(18,20,30,.5)'],
    'lightning-rainy': ['Tordenbyger', 'mdi:weather-lightning-rainy', ['#1f2330', '#2b3040', '#3a3f52'], 'rgba(20,22,32,.48)'],
    partlycloudy: ['Delvis skyet', 'mdi:weather-partly-cloudy', ['#3d6e9c', '#5889b5', '#7ea6c9'], 'rgba(26,52,84,.34)'],
    'partlycloudy-night': ['Delvis skyet', 'mdi:weather-night-partly-cloudy', ['#0b1224', '#141f3a', '#22305a'], 'rgba(12,18,36,.5)'],
    pouring: ['Kraftig regn', 'mdi:weather-pouring', ['#262d38', '#323b48', '#3e4858'], 'rgba(22,26,34,.48)'],
    rainy: ['Regn', 'mdi:weather-rainy', ['#323a46', '#3f4957', '#4a5565'], 'rgba(30,36,46,.42)'],
    snowy: ['Snø', 'mdi:weather-snowy', ['#56627a', '#6c7892', '#8591aa'], 'rgba(40,48,66,.36)'],
    'snowy-rainy': ['Sludd', 'mdi:weather-snowy-rainy', ['#46505f', '#566172', '#677285'], 'rgba(36,42,54,.4)'],
    sunny: ['Sol', 'mdi:weather-sunny', ['#2f6fb0', '#4d8fcc', '#79b1de'], 'rgba(20,50,90,.32)'],
    windy: ['Vind', 'mdi:weather-windy', ['#4f6a86', '#6583a0', '#7e9bb6'], 'rgba(34,48,64,.36)'],
    'windy-variant': ['Vind og skyer', 'mdi:weather-windy-variant', ['#4a5563', '#5a6574', '#6b7686'], 'rgba(38,44,54,.4)'],
    exceptional: ['Ekstremvær', 'mdi:alert', ['#2a1c20', '#3a2429', '#4a2d33'], 'rgba(30,18,22,.5)'],
  };
  M.VAER_SCENES = Object.keys(SC).filter((k) => k !== 'partlycloudy-night'); // alle 15 HA-værtilstandene
  const YEL = 'rgb(242 210 111)', ICO = '#e6ebf1', BLUE = 'rgb(115 185 242)';
  const vgrad = (a) => `linear-gradient(180deg,${a[0]} 0%,${a[1]} 40%,${a[2]} 100%)`; // grad() i Vær v5
  const sceneOf = (state, night) => {
    let k = SC[state] ? state : 'cloudy';
    if (night && k === 'sunny') k = 'clear-night';
    if (night && k === 'partlycloudy') k = 'partlycloudy-night';
    const s = SC[k];
    // ikonfarge som cond.iconStyle / ic() i Vær v5: sol (og delvis skyet) gul, ekstremvær rød, ellers #e6ebf1
    return { key: k, label: s[0], icon: s[1], bg: vgrad(s[2]), card: s[3], color: k === 'sunny' || k === 'partlycloudy' ? YEL : k === 'exceptional' ? 'rgb(242 128 115)' : ICO };
  };
  // Liten ikonfarge (timer/dager): bare «sunny» er gul (ic() i Vær v5)
  const icoCol = (k) => (k === 'sunny' ? YEL : ICO);

  /* ---- 27.3 · fx()/fxBase() fra Vær v5 portet 1:1 (samme frø, antall, hastighet, delay, blur, opasitet og easing).
   * React-stilobjektene er skrevet om til CSS-tekst; tall uten enhet = px (som React). Bare full = true (Scene) brukes.
   * Klassen «a» = bevegelige partikler (fall/streak/blink/plask/støv): skjules ved prefers-reduced-motion og «Animasjoner av». */
  const sp_ = (s, cls, inner = '', tag = 'span') => `<${tag}${cls ? ` class="${cls}"` : ''} style="position:absolute;${s}">${inner}</${tag}>`;
  const fxBase = (kind) => {
    let seed = 11; const r = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    const k = 1, sp = 3.2, out = [];
    const cloud = (n, dark, op, top = 30) => { for (let i = 0; i < n; i++) { const w = 260 + r() * 220, d = 90 + r() * 90;
      out.push(sp_(`top:${r() * top - 10}%;left:0;width:${w}px;height:${w * 0.42}px;border-radius:50%;filter:blur(24px);background:radial-gradient(closest-side, ${dark ? 'rgba(22,25,34,' : 'rgba(210,218,230,'}${op}), transparent);animation:drift ${d}s linear ${-r() * d}s infinite`, 'cl')); } };
    const rain = (n, heavy) => [[0.25, 12, 1, 1.6], [0.4, 18, 1.2, 1.25], [0.6, 26, 1.5, 1]].forEach(([op, len, wd, dur], L) => {
      for (let i = 0; i < n * (L + 1) * k; i++) { const dd = dur * sp * (heavy ? 0.8 : 1) * (0.85 + r() * 0.3);
        out.push(sp_(`left:${r() * 110 - 5}%;width:${wd}px;height:${len * (heavy ? 1.3 : 1)}px;border-radius:${wd}px;background:linear-gradient(transparent, rgba(215,228,242,${op}));transform:rotate(${heavy ? 16 : 8}deg);animation:fall ${dd.toFixed(2)}s linear ${(-r() * dd).toFixed(2)}s infinite`, 'a rn')); } });
    const splashes = (n) => { for (let i = 0; i < n * k; i++) { const d = 1.4 + r() * 1.2;
      out.push(sp_(`bottom:${r() * 90}%;left:${r() * 100}%;width:10px;height:3px;border-radius:50%;border:1px solid rgba(215,228,242,.45);box-sizing:content-box;animation:splash ${d}s ease-out ${-r() * d}s infinite`, 'a sp')); } };
    const bolt = (id, x, w, dur, delay) => {
      const pts = [[50, 0]]; let cx = 50;
      for (let y = 8; y <= 100; y += 6 + r() * 6) { cx += (r() - 0.5) * 18; pts.push([cx, y]); }
      const fmt2 = (P) => P.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' L');
      const main = 'M' + fmt2(pts);
      const bi = 3 + Math.floor(r() * 3), b0 = pts[bi]; let bx = b0[0];
      const br = 'M' + fmt2([b0, ...[1, 2, 3, 4].map((j) => [bx += (r() < 0.5 ? -1 : 1) * (4 + r() * 6), b0[1] + j * 7])]);
      const a = `animation:bolt ${dur}s linear ${delay}s infinite;stroke-dasharray:1;stroke-dashoffset:1`;
      out.push(`<svg class="a bo" data-bolt="${id}" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" style="position:absolute;left:${x};top:0;width:${w}px;height:420px;overflow:visible;filter:drop-shadow(0 0 4px #c9d2ff) drop-shadow(0 0 14px rgba(160,175,255,.8))"><path d="${main}" pathLength="1" fill="none" stroke="#f4f6ff" stroke-width="2.2" stroke-linejoin="round" vector-effect="non-scaling-stroke" style="${a}"></path><path d="${br}" pathLength="1" fill="none" stroke="#e6eaff" stroke-width="1.2" stroke-linejoin="round" vector-effect="non-scaling-stroke" style="${a}"></path></svg>`);
      out.push(sp_(`inset:0;background:radial-gradient(ellipse 70% 45% at ${x} 0%, rgba(215,222,255,.75), rgba(170,180,255,.18) 60%, transparent);mix-blend-mode:screen;animation:flash ${dur}s linear ${delay}s infinite`, 'a fl'));
    };
    if (kind === 'Regn') { cloud(4, false, 0.2); rain(12, false); splashes(8); }
    if (kind === 'Torden') { cloud(6, true, 0.75); rain(18, true); bolt(1, '62%', 110, 9, 1.2); bolt(2, '18%', 90, 13, 5.5); }
    if (kind === 'Sol') {
      const sx = '82%', sy = 90;
      for (let i = 0; i < 6; i++) out.push(sp_(`left:${sx};top:${sy}px;width:900px;height:${26 + r() * 40}px;margin-top:-20px;transform-origin:0 50%;rotate:${100 + i * 16 + r() * 6}deg;background:linear-gradient(90deg, rgba(255,244,205,.35), rgba(255,244,205,0) 80%);filter:blur(8px);animation:beam ${14 + r() * 8}s ease-in-out ${-r() * 10}s infinite`, 'bm')); // ki-hex-ok: værscene/illustrasjon (mørk øy)
      out.push(sp_(`left:${sx};top:${sy}px;width:260px;height:260px;margin:-130px 0 0 -130px;border-radius:50%;background:radial-gradient(closest-side, #fffdf2 0%, rgba(255,241,190,.9) 16%, rgba(255,214,120,.35) 42%, transparent);animation:bloom 8s ease-in-out infinite`, 'sun')); // ki-hex-ok: værscene/illustrasjon (mørk øy)
      [[0.28, 38, 0.5], [0.5, 18, 0.35], [0.72, 64, 0.22]].forEach(([t, s, o], i) => out.push(sp_(`left:calc(${sx} - ${t * 300}px);top:${sy + t * 360}px;width:${s}px;height:${s}px;margin-left:${-s / 2}px;border-radius:50%;background:radial-gradient(closest-side, rgba(255,236,190,${o}), rgba(170,210,255,${o / 2}) 70%, transparent);animation:flare ${6 + i * 2}s ease-in-out ${-i}s infinite`, 'lf'))); // ki-hex-ok: værscene/illustrasjon (mørk øy)
      for (let i = 0; i < 14 * k; i++) { const d = 7 + r() * 6; out.push(sp_(`left:${r() * 100}%;top:${r() * 40}%;width:3px;height:3px;border-radius:50%;background:rgba(255,248,220,.9);filter:blur(.5px);animation:mote ${d}s ease-in-out ${-r() * d}s infinite`, 'a mt')); } // ki-hex-ok: værscene/illustrasjon (mørk øy)
      cloud(2, false, 0.28, 20);
    }
    if (kind === 'Skyet') { cloud(7, false, 0.4); cloud(3, true, 0.3); }
    if (kind === 'Snø') { cloud(3, false, 0.28);
      [[0.45, 1.5, 3, 22, 1], [0.75, 3, 5, 15, 0], [0.95, 5, 8, 10, 0]].forEach(([op, s0, s1, dur, blur], L) => {
        for (let i = 0; i < [40, 26, 10][L] * k; i++) { const s = s0 + r() * (s1 - s0), d = dur * sp * (0.8 + r() * 0.4), sw = 3 + r() * 3;
          let flake;
          if (L === 2 && r() < 0.6) { const fs = 12 + r() * 6; flake = M.icon('mdi:snowflake', fs.toFixed(1), `display:block;color:rgba(255,255,255,${op});animation:sway ${sw}s ease-in-out ${-r() * sw}s infinite;filter:drop-shadow(0 0 3px rgba(255,255,255,.5))`); } // ki-hex-ok: værscene/illustrasjon (mørk øy)
          else flake = `<span style="display:block;width:${s}px;height:${s}px;border-radius:50%;background:radial-gradient(circle, rgba(255,255,255,${op}) 40%, rgba(255,255,255,0));filter:${blur ? 'blur(1px)' : 'none'};animation:sway ${sw}s ease-in-out ${-r() * sw}s infinite"></span>`; // ki-hex-ok: værscene/illustrasjon (mørk øy)
          out.push(sp_(`left:${r() * 100}%;animation:fall ${d.toFixed(1)}s linear ${(-r() * d).toFixed(1)}s infinite`, 'a sn', flake)); } }); }
    if (kind === 'Natt') {
      for (let i = 0; i < 70 * k; i++) { const s = r() < 0.15 ? 2.5 : 1.5;
        out.push(sp_(`left:${r() * 100}%;top:${r() * 45}%;width:${s}px;height:${s}px;border-radius:50%;background:#fff;animation:twinkle ${3 + r() * 5}s ease-in-out ${-r() * 5}s infinite`, 'st')); }
      out.push(sp_('right:-60px;top:-60px;width:220px;height:220px;border-radius:50%;background:radial-gradient(closest-side, rgba(200,215,255,.28), transparent)', 'gl'));
      cloud(1, false, 0.12);
    }
    return out.join('');
  };
  const FX_HA = { 'clear-night': ['Natt'], 'partlycloudy-night': ['Natt'], cloudy: ['Skyet'], fog: ['Skyet'], hail: [], lightning: [], 'lightning-rainy': ['Torden'], partlycloudy: ['Sol'], pouring: ['Regn'], rainy: ['Regn'], snowy: ['Snø'], 'snowy-rainy': ['Snø'], sunny: ['Sol'], windy: [], 'windy-variant': ['Skyet'], exceptional: [] };
  const sceneFx = (kind) => {
    const out = (FX_HA[kind] || [kind]).map((b) => fxBase(b));
    let seed = 23; const r = () => (seed = (seed * 9301 + 49297) % 233280) / 233280, k = 1;
    const clouds = (n, col, op) => { for (let i = 0; i < n; i++) { const w = 280 + r() * 200, d = 70 + r() * 60; out.push(sp_(`pointer-events:none;top:${r() * 30 - 10}%;left:0;width:${w}px;height:${w * 0.42}px;border-radius:50%;filter:blur(24px);background:radial-gradient(closest-side, rgba(${col},${op}), transparent);animation:drift ${d}s linear ${-r() * d}s infinite`, 'cl')); } };
    const streaks = (n) => { for (let i = 0; i < n * k; i++) { const d = 1.1 + r() * 1.4, w = 60 + r() * 110; out.push(sp_(`pointer-events:none;left:0;top:${5 + r() * 90}%;width:${w}px;height:1.5px;border-radius:1px;background:linear-gradient(90deg, transparent, rgba(235,240,248,.55), transparent);animation:streak ${d.toFixed(2)}s linear ${(-r() * d).toFixed(2)}s infinite`, 'a wd')); } };
    const drops = (n, len, op, dur, rot) => { for (let i = 0; i < n * k; i++) { const dd = dur * 3.2 * (0.85 + r() * 0.3); out.push(sp_(`pointer-events:none;left:${r() * 110 - 5}%;width:1.4px;height:${len}px;border-radius:1px;background:linear-gradient(transparent, rgba(215,228,242,${op}));transform:rotate(${rot}deg);animation:fall ${dd.toFixed(2)}s linear ${(-r() * dd).toFixed(2)}s infinite`, 'a rn')); } };
    const pellets = (n) => { for (let i = 0; i < n * k; i++) { const s = 3 + r() * 3, dd = 2.2 * (0.8 + r() * 0.4); out.push(sp_(`pointer-events:none;left:${r() * 100}%;width:${s}px;height:${s}px;border-radius:50%;background:radial-gradient(circle at 35% 35%, #fff, rgba(210,225,240,.85));box-shadow:0 0 3px rgba(255,255,255,.6);animation:fall ${dd.toFixed(2)}s cubic-bezier(.5,0,1,1) ${(-r() * dd).toFixed(2)}s infinite`, 'a hl')); } }; // ki-hex-ok: værscene/illustrasjon (mørk øy)
    const fog = () => { for (let i = 0; i < 5; i++) { const d = 26 + r() * 20; out.push(sp_(`pointer-events:none;left:-20%;width:140%;top:${18 + i * 16}%;height:140px;background:linear-gradient(180deg, transparent, rgba(222,228,236,.34), transparent);filter:blur(16px);animation:fogmove ${d.toFixed(1)}s ease-in-out ${(-r() * d).toFixed(1)}s infinite`, 'fg')); } };
    const bolt = (x, dur, delay) => {
      out.push(`<svg class="a bo" viewBox="0 0 40 120" aria-hidden="true" style="position:absolute;pointer-events:none;left:${x};top:0;width:70px;height:300px;overflow:visible;filter:drop-shadow(0 0 6px #c9d2ff)"><path d="M22 0 L12 48 L22 50 L8 120 L30 44 L20 42 L28 0 Z" fill="#eef1ff" style="animation:flash ${dur}s linear ${delay}s infinite;opacity:0"></path></svg>`);
      out.push(sp_(`pointer-events:none;inset:0;background:radial-gradient(ellipse 70% 45% at ${x} 0%, rgba(215,222,255,.7), transparent 70%);mix-blend-mode:screen;opacity:0;animation:flash ${dur}s linear ${delay}s infinite`, 'a fl'));
    };
    if (kind === 'fog') fog();
    if (kind === 'hail') { clouds(6, '26,30,40', 0.7); pellets(40); }
    if (kind === 'lightning') { clouds(7, '22,25,34', 0.8); bolt('64%', 8, 1); bolt('22%', 11, 4.5); }
    if (kind === 'partlycloudy' || kind === 'partlycloudy-night') clouds(4, '225,232,242', kind === 'partlycloudy' ? 0.55 : 0.3);
    if (kind === 'pouring') { clouds(5, '22,25,34', 0.7); drops(34, 34, 0.7, 0.7, 14); }
    if (kind === 'snowy-rainy') drops(14, 20, 0.5, 1, 8);
    if (kind === 'windy') { clouds(3, '210,218,230', 0.25); streaks(26); }
    if (kind === 'windy-variant') streaks(22);
    if (kind === 'exceptional') { out.push(sp_('pointer-events:none;inset:0;background:radial-gradient(ellipse 90% 60% at 50% 0%, rgba(242,128,115,.45), transparent 70%);animation:glowx 3s ease-in-out infinite', 'ex')); clouds(6, '30,20,24', 0.7); streaks(18); bolt('70%', 9, 2); }
    return out.join('');
  };
  // @keyframes fra Vær v5 (<helmet>) 1:1 – i scenelagets og kortets shadow root (keyframes virker i shadow DOM)
  const V5_KF = `
    @keyframes fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
    @keyframes fall{from{top:-60px}to{top:100%}}
    @keyframes fogmove{0%,100%{transform:translateX(-10%)}50%{transform:translateX(10%)}}
    @keyframes streak{from{transform:translateX(-160px);opacity:0}15%{opacity:1}85%{opacity:1}to{transform:translateX(520px);opacity:0}}
    @keyframes glowx{0%,100%{opacity:.35}50%{opacity:.85}}
    @keyframes sway{0%,100%{transform:translateX(-14px) rotate(-20deg)}50%{transform:translateX(14px) rotate(20deg)}}
    @keyframes drift{from{transform:translateX(-60%)}to{transform:translateX(160%)}}
    @keyframes flash{0%,100%{opacity:0}0.6%{opacity:.8}1.2%{opacity:.15}2%{opacity:1}4.5%{opacity:0}}
    @keyframes bolt{0%,100%{opacity:0;stroke-dashoffset:1}0.6%{opacity:1;stroke-dashoffset:0}1.2%{opacity:.3}2%{opacity:1}3.5%{opacity:.6}5%{opacity:0;stroke-dashoffset:0}}
    @keyframes twinkle{0%,100%{opacity:.15}50%{opacity:.9}}
    @keyframes beam{0%,100%{transform:rotate(-4deg);opacity:.5}50%{transform:rotate(4deg);opacity:.9}}
    @keyframes bloom{0%,100%{transform:scale(1);opacity:.85}50%{transform:scale(1.06);opacity:1}}
    @keyframes flare{0%,100%{opacity:.15}50%{opacity:.45}}
    @keyframes mote{0%{transform:translate(0,0);opacity:0}20%{opacity:.8}100%{transform:translate(40px,-60px);opacity:0}}
    @keyframes splash{0%,80%{transform:scaleX(.2);opacity:0}85%{opacity:.6}100%{transform:scaleX(1.4);opacity:0}}
  `;
  const SCENE_CSS = `
    :host{position:absolute;inset:0;z-index:-1;display:block;pointer-events:none;overflow:hidden;border-radius:inherit;contain:paint}
    .sc{position:absolute;inset:0;overflow:hidden;border-radius:inherit;pointer-events:none;transition:background .6s}
    .sc svg{display:block}
    .paused *{animation-play-state:paused !important}
    .still *{animation:none !important}
    .still .a{display:none !important}
    @media (prefers-reduced-motion: reduce){.sc *{animation:none !important}.sc .a{display:none !important}}
    ${V5_KF}
  `;
  // 27.0 · faste kontroller (Vær v5 pickWrap/gearWrap): stedsvelger nede til venstre (meny åpner oppover) + tune nede til høyre
  const PINK160 = 'linear-gradient(160deg,#f28ac9,#f6c9c4)', INK = 'rgba(70,58,64,.95)';
  // ikonfarge i stedsmenyen/arket (temafølgende; i Scene nullstilt av øya → #e6ebf1 / gul)
  const icoColT = (k) => (k === 'sunny' ? `var(--ki-yellow-text, ${YEL})` : `var(--ki-text-1, ${ICO})`);
  const CTL_CSS = `
    :host{position:absolute;left:0;right:0;bottom:0;height:0;z-index:6;pointer-events:none;display:block;font-family:${M.FONT};color:var(--ki-text, #fafafa);-webkit-font-smoothing:antialiased;-webkit-tap-highlight-color:transparent}
    *,*::before,*::after{box-sizing:border-box}
    button{font:inherit;color:inherit;border:0;background:none;padding:0;margin:0;cursor:pointer;-webkit-tap-highlight-color:transparent}
    .b{position:absolute;bottom:var(--ctl-b, calc(16px + env(safe-area-inset-bottom, 0px)));pointer-events:auto;height:48px;border-radius:24px;background:var(--ki-glass, rgba(28,30,36,.72));-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);border:1px solid ${WA(0.12)};box-shadow:0 6px 24px ${BA(0.35)};display:flex;align-items:center;gap:8px;padding:0 14px;font-size:15px;font-weight:500;transition:transform .15s cubic-bezier(.34,1.5,.64,1),background .2s}
    .b:hover{background:var(--ki-surface, rgba(28,30,36,.88))}
    .b:active{transform:scale(.92)}
    .pl{left:var(--ctl-x, 16px);max-width:calc(100% - 100px)}
    .pn{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .cv{opacity:.8;transition:transform .2s}
    .cv.up{transform:rotate(180deg)}
    .tn{right:var(--ctl-x, 16px);width:48px;padding:0;justify-content:center}
    .mbg{position:absolute;left:0;right:0;bottom:0;height:100vh;pointer-events:auto}
    .mn{position:absolute;left:var(--ctl-x, 16px);bottom:calc(var(--ctl-b, calc(16px + env(safe-area-inset-bottom, 0px))) + 56px);pointer-events:auto;width:270px;max-width:calc(100% - 32px);max-height:60vh;overflow:auto;border-radius:22px;background:var(--ki-surface, rgba(36,38,44,.92));-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px);border:1px solid ${WA(0.08)};box-shadow:0 12px 40px ${BA(0.45)};padding:6px;display:flex;flex-direction:column;gap:2px;animation:fade .2s ease}
    .mi{display:flex;align-items:center;gap:10px;min-height:52px;padding:0 14px 0 12px;border-radius:16px;text-align:left;color:var(--ki-text, #fafafa)}
    .mi.on{background:${PINK160};color:${INK}}
    .mc{flex:1;min-width:0;display:flex;flex-direction:column;align-items:flex-start;line-height:1.2}
    .mnm{font-size:15px;font-weight:500;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .mid{font-size:10px;color:var(--ki-text-mid, #a8a8a8);font-family:ui-monospace,monospace;overflow:hidden;text-overflow:ellipsis;max-width:100%;white-space:nowrap}
    .mi.on .mid{color:var(--ki-on-accent, rgba(70,58,64,.75))}
    .mt{font-size:17px;font-weight:500;font-variant-numeric:tabular-nums}
    @keyframes fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
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
  /* ------------------------------------------------------------ Steder (Fiks 42 · Del B) */
  // Alle weather.*-entiteter er steder automatisk – ingen oppsett, ingen hardkodede ID-er. Config overstyrer:
  //   exclude: [id]            «Fjern» (søppelbøtte) – legges ikke til igjen automatisk (felles med pollen-/varsellistene)
  //   places:  [{ id, name }]  «Legg til sted» / omdøping – vises alltid (også om det er et duplikat eller står i exclude)
  //   order:   [id]            rekkefølge (hold + dra / ↑↓) – steder som ikke står der (nye auto-steder) legges sist
  // Navn: områdenavnet hvis entiteten (eller enheten) har et område, ellers friendly_name uten «Forecast »-prefiks.
  // Duplikater: *_hourly / *_timer når grunn-ID-en finnes, og entiteter fra samme config entry (eller enhet) med samme
  // latitude/longitude → én (den daglige) beholdes. Utilgjengelige (unavailable / borte) skjules og kommer tilbake av seg selv.
  // Standardsted (uten valgt fane) = overrides.weather («Bytt entiteter») → weather.home / weather.forecast_home → første.
  // Gamle configer (places: [{ name, entity }] = hele listen i rekkefølge) migreres i normCfg → places [{ id, name }] + order.
  const HOURLY = /_(hourly|timer)$/;
  const HOME_RE = /(^weather\.|_)(home|hjem|forecast_home)$/;
  const placeId = (p) => (typeof p === 'string' ? p : p && typeof p === 'object' ? p.id || p.entity || p.entity_id || null : null);
  const cfgPlaces = (c) => (Array.isArray(c && c.places) ? c.places : []).map((p) => ({ id: placeId(p), name: p && typeof p === 'object' && p.name ? String(p.name) : '' })).filter((p, i, a) => p.id && a.findIndex((q) => q.id === p.id) === i);
  const idList = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x) : []);
  const wxName = (h, id) => {
    const ar = h && M.areaOf(h, id), A = ar && h.areas && h.areas[ar];
    if (A && A.name) return A.name;
    const s = h && h.states[id], fn = s && s.attributes && s.attributes.friendly_name;
    return fn ? String(fn).replace(/^forecast\s+/i, '') || String(fn) : id ? id.split('.')[1].replace(/_/g, ' ') : '–';
  };
  M.vaerPlaceName = wxName;
  // Auto-stedene (dedupet, inkl. utilgjengelige) i ID-rekkefølge: [{ id, ...gruppenøkler }]
  const wxAutoIds = (h) => {
    if (!h) return [];
    const ids = M.all(h, 'weather').sort((a, b) => (HOURLY.test(a) - HOURLY.test(b)) || a.localeCompare(b)); // daglig først
    const ceOf = (id) => { const e = M.regEntry(h, id) || {}, d = e.device_id && h.devices && h.devices[e.device_id]; return e.config_entry_id || (d && Array.isArray(d.config_entries) && d.config_entries[0]) || e.device_id || null; };
    const locOf = (id) => { const a = h.states[id].attributes || {}; return M.isNum(a.latitude) && M.isNum(a.longitude) ? `${Number(a.latitude).toFixed(4)},${Number(a.longitude).toFixed(4)}` : null; };
    const kept = [];
    ids.forEach((id) => {
      const base = id.replace(HOURLY, ''), ce = ceOf(id), loc = locOf(id);
      if (kept.some((k) => k.base === base || (ce && loc && k.ce === ce && k.loc === loc))) return;
      kept.push({ id, base, ce, loc });
    });
    return kept.map((k) => k.id).sort();
  };
  const wxDown = (h, id) => { const s = h && h.states[id]; return !s || s.state === 'unavailable'; };
  // Stedslisten: [{ id, entity, name, src: 'auto'|'cfg', renamed, down }]. opts.all = også utilgjengelige (editorene).
  const placesOf = (h, c, opts) => {
    c = c || {};
    const all = !!(opts && opts.all), ex = new Set(idList(c.exclude)), P = cfgPlaces(c), pids = new Set(P.map((p) => p.id));
    const nm = new Map(P.map((p) => [p.id, p.name]));
    const mk = (id, src) => ({ id, entity: id, name: nm.get(id) || wxName(h, id), src, renamed: !!nm.get(id), down: wxDown(h, id), auto: false });
    // grunnrekkefølge (uten order): auto-stedene etter entitetens/områdets navn (omdøping flytter ikke stedet), så steder
    // som bare finnes i places (f.eks. et timesduplikat lagt til med vilje) i places-rekkefølge
    const aIds = wxAutoIds(h), aSet = new Set(aIds);
    const autoL = aIds.filter((id) => pids.has(id) || !ex.has(id)).map((id) => mk(id, pids.has(id) ? 'cfg' : 'auto')).sort((a, b) => wxName(h, a.id).localeCompare(wxName(h, b.id), 'nb'));
    let seq = [...autoL, ...P.filter((p) => !aSet.has(p.id)).map((p) => mk(p.id, 'cfg'))];
    const hm = seq.find((p) => HOME_RE.test(p.id));
    if (hm) seq = [hm, ...seq.filter((p) => p !== hm)];
    const ord = idList(c.order), L = [...ord.map((id) => seq.find((p) => p.id === id)).filter(Boolean), ...seq.filter((p) => !ord.includes(p.id))];
    return all ? L : L.filter((p) => !p.down);
  };
  M.vaerPlaces = placesOf;
  M.vaerAutoPlaces = wxAutoIds;
  // Standardstedet (første fane når ingen er valgt)
  const defPlace = (L, c) => { const ov = c && c.overrides && c.overrides.weather; return (ov && L.find((p) => p.id === ov)) || L.find((p) => HOME_RE.test(p.id)) || L[0] || null; };
  // Valgt sted: ui.place = entitets-ID (nytt) eller indeks (gammelt) → sted; finnes det ikke (lenger) → standardstedet
  const pickPlace = (L, c, sel) => (typeof sel === 'string' ? L.find((p) => p.id === sel) : typeof sel === 'number' && isFinite(sel) && L.length ? L[M.clamp(sel, 0, L.length - 1)] : null) || defPlace(L, c);
  M.vaerPlace = (h, c, sel) => pickPlace(placesOf(h, c), c, sel);
  // Endringer (felles for «Tilpass Vær» og GUI-editoren) → patch med nøklene places / exclude / order (undefined = slett)
  const nz = (a) => (a && a.length ? a : undefined);
  const placeOps = {
    remove: (c, id) => ({ exclude: [...new Set([...idList(c.exclude), id])], places: nz(cfgPlaces(c).filter((p) => p.id !== id).map((p) => (p.name ? { id: p.id, name: p.name } : { id: p.id }))), order: nz(idList(c.order).filter((x) => x !== id)) }),
    add: (c, id, name) => {
      const P = cfgPlaces(c), i = P.findIndex((p) => p.id === id), it = name && String(name).trim() ? { id, name: String(name).trim() } : { id };
      const N = P.map((p) => (p.name ? { id: p.id, name: p.name } : { id: p.id }));
      if (i >= 0) N[i] = it; else N.push(it);
      return { places: N, exclude: nz(idList(c.exclude).filter((x) => x !== id)) };
    },
    replace: (c, old, id, name) => {
      if (!old || old === id) return placeOps.add(c, id, name);
      const r = placeOps.remove(c, old), c2 = { ...c, ...r }, a = placeOps.add(c2, id, name);
      const ord = idList(c.order);
      return { ...r, ...a, order: ord.length ? nz([...new Set(ord.map((x) => (x === old ? id : x)))]) : undefined };
    },
    reorder: (c, ids) => ({ order: nz([...new Set(ids)]) }),
  };
  M.vaerPlaceOps = placeOps;
  /* ------------------------------------------------------------ Fiks 56 H · «Føles som» og «Sikt» – kilder i prioritert rekkefølge */
  // Enheter → °C og km/t (utregning), tilbake til værentitetens temperaturenhet for visning
  const toC = (v, u) => (/F/i.test(String(u || '')) ? ((v - 32) * 5) / 9 : v);
  const fromC = (v, u) => (/F/i.test(String(u || '')) ? (v * 9) / 5 + 32 : v);
  const toKmh = (v, u) => { const s = String(u || 'km/h').toLowerCase(); return /m\/s/.test(s) ? v * 3.6 : /mph/.test(s) ? v * 1.609344 : /kn|kt/.test(s) ? v * 1.852 : /ft\/s/.test(s) ? v * 1.09728 : v; };
  // Utregnet «føles som» (°C inn/ut): vindavkjøling (Environment Canada/NWS) under 10 °C og vind over 4,8 km/t; heat index
  // (Rothfusz, NWS) over 27 °C; ellers selve temperaturen. → { v, kind: 'chill' | 'heat' | 'temp' }
  M.vaerFeelsCalc = function (tC, rh, vKmh) {
    if (tC == null || isNaN(tC)) return null;
    if (tC < 10 && vKmh != null && vKmh > 4.8) { const p = Math.pow(vKmh, 0.16); return { v: 13.12 + 0.6215 * tC - 11.37 * p + 0.3965 * tC * p, kind: 'chill' }; }
    if (tC > 27 && rh != null && !isNaN(rh)) {
      const T = (tC * 9) / 5 + 32, R = rh;
      const hi = -42.379 + 2.04901523 * T + 10.14333127 * R - 0.22475541 * T * R - 0.00683783 * T * T - 0.05481717 * R * R + 0.00122874 * T * T * R + 0.00085282 * T * R * R - 0.00000199 * T * T * R * R;
      return { v: ((hi - 32) * 5) / 9, kind: 'heat' };
    }
    return { v: tC, kind: 'temp' };
  };
  const nameHit = (hh, id, rx) => rx.test(id) || rx.test(String((hh.states[id].attributes || {}).friendly_name || '').toLowerCase());
  // Autofunnet sensor: helst samme område/integrasjon som værentiteten
  const rankNear = (hh, wx, ids) => {
    if (!wx || ids.length < 2) return ids;
    const we = M.regEntry(hh, wx) || {}, wa = M.areaOf ? M.areaOf(hh, wx) : null;
    const sc = (id) => { const e = M.regEntry(hh, id) || {}; return (we.platform && e.platform === we.platform ? 2 : 0) + (wa && M.areaOf && M.areaOf(hh, id) === wa ? 1 : 0); };
    return [...ids].sort((a, b) => sc(b) - sc(a));
  };
  const FEELS_RX = /feels|apparent|f(ø|o)les|fuehlt|ressenti|windchill|wind_chill|heat_?index/i, VIS_RX = /visib|(^|[._\s])sikt($|[._\s])/i; // «sikt» som eget ord (ikke «oversikt»)
  M.vaerFeelsAuto = (hh, wx) => (hh ? rankNear(hh, wx, M.all(hh, 'sensor', (s, id) => (s.attributes || {}).device_class === 'temperature' && nameHit(hh, id, FEELS_RX)))[0] || null : null);
  M.vaerVisAuto = (hh, wx) => (hh ? rankNear(hh, wx, M.all(hh, 'sensor', (s, id) => nameHit(hh, id, VIS_RX) && !/_(min|max)$/.test(id) && M.isNum(s.state)))[0] || null : null);
  // → { v (i værentitetens temperaturenhet), src: 'cfg'|'attr'|'auto'|'calc', ent, kind } | null
  M.vaerFeels = function (hh, c, wx) {
    c = c || {};
    const st = wx && hh && hh.states[wx], A = (st && st.attributes) || {}, tu = A.temperature_unit || '°C';
    const fromEnt = (id, src) => { const s = id && hh && hh.states[id]; if (!s || !M.isNum(s.state)) return null; const u = s.attributes.unit_of_measurement; return { v: u && !/F/i.test(u) === !/F/i.test(tu) ? Number(s.state) : fromC(toC(Number(s.state), u), tu), src, ent: id }; };
    const r1 = fromEnt(c.feels_like_entity, 'cfg'); if (r1) return r1;
    if (num(A.apparent_temperature) != null) return { v: num(A.apparent_temperature), src: 'attr', ent: wx };
    const r3 = fromEnt(M.vaerFeelsAuto(hh, wx), 'auto'); if (r3) return r3;
    if (c.compute_feels === false || !st) return null;
    const t = num(A.temperature); if (t == null) return null;
    const ws = num(A.wind_speed), r = M.vaerFeelsCalc(toC(t, tu), num(A.humidity), ws != null ? toKmh(ws, A.wind_speed_unit || 'km/h') : null);
    return r ? { v: fromC(r.v, tu), src: 'calc', ent: wx, kind: r.kind } : null;
  };
  const kmOf = (v, u) => { const s = String(u || 'km').toLowerCase(); return s === 'm' ? v / 1000 : /mi/.test(s) ? v * 1.609344 : /ft/.test(s) ? v * 0.0003048 : v; };
  // → { km, src, ent } | null
  M.vaerVis = function (hh, c, wx) {
    c = c || {};
    const st = wx && hh && hh.states[wx], A = (st && st.attributes) || {};
    const fromEnt = (id, src) => { const s = id && hh && hh.states[id]; if (!s || !M.isNum(s.state)) return null; const u = s.attributes.unit_of_measurement || (Number(s.state) > 100 ? 'm' : 'km'); return { km: kmOf(Number(s.state), u), src, ent: id }; };
    const r1 = fromEnt(c.visibility_entity, 'cfg'); if (r1) return r1;
    if (num(A.visibility) != null) return { km: kmOf(num(A.visibility), A.visibility_unit || 'km'), src: 'attr', ent: wx };
    return fromEnt(M.vaerVisAuto(hh, wx), 'auto');
  };
  const visTxt = (km) => (km > 20 ? 'Svært god' : km >= 10 ? 'God' : km >= 4 ? 'Moderat' : km >= 1 ? 'Dårlig' : 'Tåke');
  const visNum = (km) => (km < 10 ? M.nf(Math.round(km * 10) / 10, 1) : String(Math.round(km)));

  /* ------------------------------------------------------------ Fiks 56 K · månen (SunCalc-algoritmen, V. Agafonkin, BSD) */
  // Belysning (andel lys) og måneoppgang beregnes lokalt når det ikke finnes egne sensorer. Breddegrad/lengdegrad fra HA.
  const RAD = Math.PI / 180, DAYMS = 864e5, OBL = RAD * 23.4397;
  const toDays = (d) => d.valueOf() / DAYMS - 0.5 + 2440588 - 2451545;
  const raOf = (l, b) => Math.atan2(Math.sin(l) * Math.cos(OBL) - Math.tan(b) * Math.sin(OBL), Math.cos(l));
  const decOf = (l, b) => Math.asin(Math.sin(b) * Math.cos(OBL) + Math.cos(b) * Math.sin(OBL) * Math.sin(l));
  const sunCo = (d) => { const Ma = RAD * (357.5291 + 0.98560028 * d), L = Ma + RAD * (1.9148 * Math.sin(Ma) + 0.02 * Math.sin(2 * Ma) + 0.0003 * Math.sin(3 * Ma)) + RAD * 102.9372 + Math.PI; return { dec: decOf(L, 0), ra: raOf(L, 0) }; };
  const moonCo = (d) => { const L = RAD * (218.316 + 13.176396 * d), Ma = RAD * (134.963 + 13.064993 * d), F = RAD * (93.272 + 13.22935 * d), l = L + RAD * 6.289 * Math.sin(Ma), b = RAD * 5.128 * Math.sin(F); return { ra: raOf(l, b), dec: decOf(l, b), dist: 385001 - 20905 * Math.cos(Ma) }; };
  const moonAlt = (date, lat, lng) => {
    const d = toDays(date), c = moonCo(d), H = RAD * (280.16 + 360.9856235 * d) - RAD * -lng - c.ra, phi = RAD * lat;
    const h = Math.asin(Math.sin(phi) * Math.sin(c.dec) + Math.cos(phi) * Math.cos(c.dec) * Math.cos(H));
    return h + (RAD * 0.017) / Math.tan(h + (RAD * 10.26) / (h + RAD * 5.1));
  };
  M.vaerMoonIllum = function (date) {
    const d = toDays(date || new Date()), s = sunCo(d), m = moonCo(d), sd = 149598000;
    const phi = Math.acos(Math.sin(s.dec) * Math.sin(m.dec) + Math.cos(s.dec) * Math.cos(m.dec) * Math.cos(s.ra - m.ra));
    const inc = Math.atan2(sd * Math.sin(phi), m.dist - sd * Math.cos(phi));
    const ang = Math.atan2(Math.cos(s.dec) * Math.sin(s.ra - m.ra), Math.sin(s.dec) * Math.cos(m.dec) - Math.cos(s.dec) * Math.sin(m.dec) * Math.cos(s.ra - m.ra));
    return { fraction: (1 + Math.cos(inc)) / 2, phase: 0.5 + (0.5 * inc * (ang < 0 ? -1 : 1)) / Math.PI };
  };
  // Måneoppgang/-nedgang for døgnet som inneholder date (lokal tid) → { rise, set } (ms) – mangler hvis den ikke står opp
  M.vaerMoonTimes = function (date, lat, lng) {
    const t = new Date(date); t.setHours(0, 0, 0, 0);
    const at = (h) => new Date(t.getTime() + h * 3600000), hc = 0.133 * RAD;
    let h0 = moonAlt(t, lat, lng) - hc, rise = null, set = null;
    for (let i = 1; i <= 24; i += 2) {
      const h1 = moonAlt(at(i), lat, lng) - hc, h2 = moonAlt(at(i + 1), lat, lng) - hc;
      const a = (h0 + h2) / 2 - h1, b = (h2 - h0) / 2, xe = -b / (2 * a), ye = (a * xe + b) * xe + h1, D = b * b - 4 * a * h1;
      let roots = 0, x1 = 0, x2 = 0;
      if (D >= 0) { const dx = Math.sqrt(D) / (Math.abs(a) * 2); x1 = xe - dx; x2 = xe + dx; if (Math.abs(x1) <= 1) roots++; if (Math.abs(x2) <= 1) roots++; if (x1 < -1) x1 = x2; }
      if (roots === 1) { if (h0 < 0) rise = i + x1; else set = i + x1; } else if (roots === 2) { rise = i + (ye < 0 ? x2 : x1); set = i + (ye < 0 ? x1 : x2); }
      if (rise != null && set != null) break;
      h0 = h2;
    }
    return { rise: rise != null ? at(rise).getTime() : null, set: set != null ? at(set).getTime() : null };
  };
  // Neste måneoppgang (i dag hvis den ikke har vært, ellers i morgen/overmorgen)
  const nextMoonrise = (lat, lng, now) => {
    for (let k = 0; k < 3; k++) { const r = M.vaerMoonTimes(now + k * DAYMS, lat, lng).rise; if (r != null && r >= now - 60000) return r; }
    return null;
  };
  // HAs posisjon (config) → værentitetens latitude/longitude → zone.home
  const latLon = (hh, A) => {
    const z = hh && hh.states && hh.states['zone.home'] && hh.states['zone.home'].attributes;
    for (const o of [hh && hh.config, A, z]) if (o && M.isNum(o.latitude) && M.isNum(o.longitude)) return [Number(o.latitude), Number(o.longitude)];
    return null;
  };

  /* ------------------------------------------------------------ Fiks 56 K · solkurven (Soloppgang-flisen) */
  // Dagens soltider ut fra sun.sun: { rise, set, next, post } – post = etter solnedgang (tittel «Solnedgang», ↑ neste soloppgang)
  const sunDay = (sun, now) => {
    if (!sun) return null;
    const { r, s } = sun, t0 = new Date(now); t0.setHours(0, 0, 0, 0);
    const day0 = t0.getTime(), day1 = day0 + DAYMS;
    if (s < r) return { rise: r - DAYMS, set: s, next: r, post: false }; // sola er oppe
    if (r < day1) return { rise: r, set: s, next: r, post: false }; // før soloppgang i dag
    return { rise: r - DAYMS, set: s - DAYMS, next: r, post: true }; // etter solnedgang
  };
  // Kurve over døgnet (x 0–140 = 00–24) i en 44 px høy flate: dag over horisonten (y 30), natt stiplet under
  const SUN_W = 140, SUN_H = 44, HZ = 30;
  const sunCurve = (sd, now) => {
    const t0 = new Date(now); t0.setHours(0, 0, 0, 0);
    const xOf = (t) => ((t - t0.getTime()) / DAYMS) * SUN_W;
    const len = Math.max(0, Math.min(DAYMS, sd.set - sd.rise)), noon = sd.rise + len / 2;
    const c0 = Math.cos((Math.PI * len) / DAYMS);
    const yAt = (t) => { const f = Math.cos((2 * Math.PI * (t - noon)) / DAYMS); return f >= c0 ? HZ - ((f - c0) / Math.max(1e-6, 1 - c0)) * (HZ - 4) : HZ + ((c0 - f) / Math.max(1e-6, 1 + c0)) * (SUN_H - 2 - HZ); };
    const P = [];
    for (let i = 0; i <= 48; i++) { const t = t0.getTime() + (i / 48) * DAYMS; P.push([xOf(t), yAt(t)]); }
    const rx = xOf(sd.rise), sx = xOf(sd.set);
    const day = P.filter((p) => p[0] > rx && p[0] < sx);
    const dayPts = [[rx, HZ], ...day, [sx, HZ]];
    const pre = [...P.filter((p) => p[0] < rx), [rx, HZ]], post = [[sx, HZ], ...P.filter((p) => p[0] > sx)];
    return { dayD: smooth(dayPts), fillD: `${smooth(dayPts)} L${sx.toFixed(1)},${HZ} L${rx.toFixed(1)},${HZ} Z`, preD: pre.length > 1 ? smooth(pre) : '', postD: post.length > 1 ? smooth(post) : '', dot: [xOf(now), yAt(now)], up: yAt(now) <= HZ };
  };
  const durTxt = (ms) => { const m = Math.round(ms / 60000); return `${Math.floor(m / 60)} t ${m % 60} min`; };

  /* ------------------------------------------------------------ Fiks 56 L · fylte værikoner (som Material Symbols FILL 1 i Vær v5) */
  // HAs MDI har bare kontur-varianter av weather-* (MDI 7). Ikonene settes derfor sammen av fylte MDI-former (cloud,
  // white-balance-sunny, moon-waning-crescent, lightning-bolt) + dråper/flak – samme tegning i timestripen og døgnlisten.
  const P_CLOUD = 'M6.5 20Q4.22 20 2.61 18.43 1 16.85 1 14.58 1 12.63 2.17 11.1 3.35 9.57 5.25 9.15 5.88 6.85 7.75 5.43 9.63 4 12 4 14.93 4 16.96 6.04 19 8.07 19 11 20.73 11.2 21.86 12.5 23 13.78 23 15.5 23 17.38 21.69 18.69 20.38 20 18.5 20Z';
  const P_SUN = 'M3.55 19.09L4.96 20.5L6.76 18.71L5.34 17.29M12 6C8.69 6 6 8.69 6 12S8.69 18 12 18 18 15.31 18 12C18 8.68 15.31 6 12 6M20 13H23V11H20M17.24 18.71L19.04 20.5L20.45 19.09L18.66 17.29M20.45 5L19.04 3.6L17.24 5.39L18.66 6.81M13 1H11V4H13M6.76 5.39L4.96 3.6L3.55 5L5.34 6.81L6.76 5.39M1 13H4V11H1M13 20H11V23H13';
  const P_MOON = 'M2 12A10 10 0 0 0 15 21.54A10 10 0 0 1 15 2.46A10 10 0 0 0 2 12Z';
  const P_BOLT = 'M11 15H6L13 1V9H18L11 23V15Z';
  const P_WIND = 'M4,10A1,1 0 0,1 3,9A1,1 0 0,1 4,8H12A2,2 0 0,0 14,6A2,2 0 0,0 12,4C11.45,4 10.95,4.22 10.59,4.59C10.2,5 9.56,5 9.17,4.59C8.78,4.2 8.78,3.56 9.17,3.17C9.9,2.45 10.9,2 12,2A4,4 0 0,1 16,6A4,4 0 0,1 12,10H4M19,12A1,1 0 0,0 20,11A1,1 0 0,0 19,10C18.72,10 18.47,10.11 18.29,10.29C17.9,10.68 17.27,10.68 16.88,10.29C16.5,9.9 16.5,9.27 16.88,8.88C17.42,8.34 18.17,8 19,8A3,3 0 0,1 22,11A3,3 0 0,1 19,14H5A1,1 0 0,1 4,13A1,1 0 0,1 5,12H19M18,18H4A1,1 0 0,1 3,17A1,1 0 0,1 4,16H18A3,3 0 0,1 21,19A3,3 0 0,1 18,22C17.17,22 16.42,21.66 15.88,21.12C15.5,20.73 15.5,20.1 15.88,19.71C16.27,19.32 16.9,19.32 17.29,19.71C17.47,19.89 17.72,20 18,20A1,1 0 0,0 19,19A1,1 0 0,0 18,18Z';
  const P_ALERT = 'M13 14H11V9H13M13 18H11V16H13M1 21H23L12 2L1 21Z';
  const cl = (tx, ty, k) => `<path d="${P_CLOUD}" transform="translate(${tx} ${ty}) scale(${k})"/>`;
  const drops = (xs, y0, y1) => `<path d="${xs.map((x) => `M${x} ${y0}L${(x - (y1 - y0) * 0.3).toFixed(2)} ${y1}`).join('')}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>`;
  const dots = (P, r) => P.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('');
  const WX_SVG = {
    sunny: (y) => `<path d="${P_SUN}" fill="${y}"/>`,
    'clear-night': () => `<path d="${P_MOON}" transform="translate(3 0)"/>`,
    cloudy: () => `<path d="${P_CLOUD}" transform="translate(0 -1)"/>`,
    fog: () => `${cl(1.5, -2.6, 0.875)}<rect x="3" y="17" width="18" height="2" rx="1"/><rect x="5" y="20.6" width="14" height="2" rx="1"/>`,
    rainy: () => `${cl(1.5, -2.6, 0.875)}${drops([8.6, 12.6, 16.6], 17.6, 21.6)}`,
    pouring: () => `${cl(1.5, -2.8, 0.875)}${drops([6.8, 10.4, 14, 17.6], 17.4, 22.6)}`,
    snowy: () => `${cl(1.5, -2.6, 0.875)}${dots([[7.6, 19.4], [12, 21.6], [16.4, 19.4]], 1.45)}`,
    'snowy-rainy': () => `${cl(1.5, -2.6, 0.875)}${drops([8.6, 15.6], 17.6, 21.6)}${dots([[12.2, 20.8]], 1.45)}`,
    hail: () => `${cl(1.5, -2.6, 0.875)}${dots([[7.4, 19.6], [12, 21.8], [16.6, 19.6], [9.7, 22.6], [14.3, 22.6]], 1.25)}`,
    lightning: () => `${cl(1.5, -3.2, 0.82)}<path d="${P_BOLT}" transform="translate(6.6 9.4) scale(.6)"/>`,
    'lightning-rainy': () => `${cl(1.5, -3.2, 0.82)}<path d="${P_BOLT}" transform="translate(5.2 9.6) scale(.58)"/>${drops([15.4, 19], 15.4, 20.2)}`,
    partlycloudy: (y) => `<path d="${P_SUN}" fill="${y}" transform="translate(0 0) scale(.62)"/>${cl(5.4, 5.2, 0.8)}`,
    'partlycloudy-night': () => `<path d="${P_MOON}" transform="translate(1.6 .4) scale(.62)" opacity=".9"/>${cl(5.4, 5.2, 0.8)}`,
    windy: () => `<path d="${P_WIND}"/>`,
    'windy-variant': () => `${cl(4.6, -1.8, 0.62)}<path d="${P_WIND}" transform="translate(0 4.6) scale(.82)"/>`,
    exceptional: () => `<path d="${P_ALERT}"/>`,
  };
  // Fylt værikon: sol gul (rgb(242 210 111)), resten hvite (#e6ebf1, ic() i Vær v5)
  const wxSvg = (key, size, col) => `<svg class="wxi" data-wx="${key}" viewBox="0 0 24 24" width="${size}" height="${size}" fill="currentColor" aria-hidden="true" style="display:block;flex:none;width:${size}px;height:${size}px;color:${col || (key === 'sunny' ? YEL : ICO)}">${(WX_SVG[key] || WX_SVG.cloudy)(YEL)}</svg>`;
  M.vaerWxSvg = wxSvg;

  /* ------------------------------------------------------------ Fiks 56 G/L · kortflaten og tekst ut fra luminans */
  const rgbOf = (s) => { const m = /rgba?\(([^)]+)\)/.exec(String(s)); if (m) { const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; } const h = /^#([0-9a-f]{6})$/i.exec(String(s).trim()); return h ? [parseInt(h[1].slice(0, 2), 16), parseInt(h[1].slice(2, 4), 16), parseInt(h[1].slice(4, 6), 16), 1] : null; };
  const lin = (u) => { u /= 255; return u <= 0.04045 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4); };
  const relLum = (p) => 0.2126 * lin(p[0]) + 0.7152 * lin(p[1]) + 0.0722 * lin(p[2]);
  const contrast = (a, b) => { const x = relLum(a), y = relLum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const hexOf = (p) => '#' + p.slice(0, 3).map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('');
  // Kortfargen (rgba) lagt over den midterste værbakgrunnsfargen (C.bg[1]) → dekkende farge (Android uten blur, 56 L)
  const cardOver = (card, bg) => { const c = rgbOf(card), b = rgbOf(bg); if (!c || !b) return null; const a = c[3]; return [0, 1, 2].map((i) => c[i] * a + b[i] * (1 - a)); };
  M.vaerCardOver = (k) => { const s = SC[k] || SC.cloudy; const p = cardOver(s[3], s[2][1]); return p ? hexOf(p) : null; };
  // Tekstfarger på værflaten (56 G, samme luminansregel som 56 E): mørk flate (L ≤ 0,179 – der hvit og svart gir lik kontrast)
  // → lys tekst (#fff / rgba(255,255,255,.7)); lys flate → mørk tekst. Nedbørsprosenten (blå) løftes mot hvitt til ≥ 4,5:1.
  const BLUE_P = [115, 185, 242];
  const surfInk = (surf) => {
    const dark = relLum(surf) <= 0.179;
    let b = BLUE_P;
    if (dark) { for (let k = 0; k <= 20 && contrast(b, surf) < 4.5; k++) b = BLUE_P.map((x) => x + (255 - x) * (k / 20)); }
    else { for (let k = 0; k <= 20 && contrast(b, surf) < 4.5; k++) b = BLUE_P.map((x) => x * (1 - k / 25)); }
    // sekundærtekst: rgba(255,255,255,.7) (mørk) / rgba(0,0,0,.66) (lys), alfa økes til ≥ 3:1 mot flaten (sol-/delvis skyet-kortene er lysest)
    let a2 = dark ? 0.7 : 0.66;
    const t2c = (a) => (dark ? [0, 1, 2].map((i) => 255 * a + surf[i] * (1 - a)) : [0, 1, 2].map((i) => surf[i] * (1 - a)));
    while (a2 < 0.92 && contrast(t2c(a2), surf) < 3) a2 = Math.round((a2 + 0.02) * 100) / 100;
    return { lum: dark ? 'dark' : 'light', t1: dark ? '#ffffff' : '#141414', t2: dark ? `rgba(255,255,255,${a2})` : `rgba(0,0,0,${a2})`, blue: `rgb(${b.map((x) => Math.round(x)).join(' ')})` }; // ki-hex-ok: værflate (mørk øy)
  };
  M.vaerSurfInk = (k) => { const s = SC[k] || SC.cloudy; return surfInk(cardOver(s[3], s[2][1]) || [56, 64, 77]); };
  M.vaerContrast = (a, b) => { const x = rgbOf(a), y = rgbOf(b); return x && y ? contrast(x, y) : null; };

  const STIL = [['klassisk', 'Klassisk'], ['scene', 'Scene']];
  const HIDE = [['alerts', 'Farevarsel', 'warning'], ['hours', 'Neste timer', 'schedule'], ['days', 'Døgnvarsel', 'mdi:view-week'], ['tiles', 'Fliser', 'grid_view']];
  // 28.1 · config: style ('scene' | 'klassisk') · places · sections { alerts, hours, days, tiles: true/false } · tile_order.
  // Gamle nøkler leses fortsatt (alias) og migreres i normCfg: stil → style, hide / hidden_sections (bryterne) → sections,
  // sections som liste (Klassisk-rekkefølgen) → section_order, tiles → tile_order. Ny nøkkel vinner alltid over gammel.
  const SW = HIDE.map((x) => x[0]);
  const secMap = (c) => (c && c.sections && typeof c.sections === 'object' && !Array.isArray(c.sections) ? c.sections : {});
  const stilOf = (c) => { const v = c ? (c.style !== undefined ? c.style : c.stil) : null; return v === 'klassisk' ? 'klassisk' : 'scene'; }; // standard scene (26.24)
  // Fiks 56 I · view: 'fullscreen' (standard) | 'sheet' (Ark = oppsettet før 56). hide_navbar (standard av) gjelder Fullskjerm;
  // Ark skjuler navbaren som før (Fiks 28.4 / 55 A1).
  const viewOf = (c) => (c && (c.view === 'sheet' || c.view === 'ark') ? 'sheet' : 'fullscreen');
  const hideNavOf = (c) => viewOf(c) === 'sheet' || !!(c && c.hide_navbar === true);
  M.vaerViewOf = viewOf;
  M.vaerHideNavOf = hideNavOf;
  const hiddenOf = (c) => {
    const out = new Set([...(Array.isArray(c.hidden_sections) ? c.hidden_sections : []), ...(Array.isArray(c.hide) ? c.hide : [])]), S = secMap(c);
    Object.keys(S).forEach((k) => { if (S[k] === false) out.add(k); }); // true = på (bryteren fjerner samtidig nøkkelen fra hidden_sections)
    return out;
  };
  const secOrderOf = (c) => (Array.isArray(c.section_order) ? c.section_order : Array.isArray(c.sections) ? c.sections : null);
  const normCfg = (c) => {
    if (!c || typeof c !== 'object') return c;
    const hs0 = Array.isArray(c.hidden_sections) ? c.hidden_sections : [];
    const oldPl = Array.isArray(c.places) && c.places.some((p) => typeof p === 'string' || (p && typeof p === 'object' && !p.id && (p.entity || p.entity_id)));
    if (!oldPl && c.stil === undefined && c.hide === undefined && !Array.isArray(c.sections) && c.tiles === undefined && !hs0.some((k) => SW.includes(k))) return c;
    const n = { ...c }, old = hiddenOf({ hide: c.hide, hidden_sections: hs0 }), S = { ...secMap(c) };
    // Fiks 42: places [{ name, entity }] (hele listen, i rekkefølge) → places [{ id, name }] + order (hvis order mangler)
    if (oldPl) {
      const P = cfgPlaces(c);
      if (P.length) n.places = P.map((p) => (p.name ? { id: p.id, name: p.name } : { id: p.id })); else delete n.places;
      if (!Array.isArray(n.order) && P.length) n.order = P.map((p) => p.id);
    }
    if (n.style === undefined && n.stil !== undefined) n.style = stilOf({ stil: n.stil });
    delete n.stil;
    if (Array.isArray(n.sections)) { if (!Array.isArray(n.section_order)) n.section_order = n.sections; delete n.sections; }
    SW.forEach((k) => { if (S[k] === undefined && old.has(k)) S[k] = false; });
    if (Object.keys(S).length) n.sections = S;
    delete n.hide;
    const hs = hs0.filter((k) => !SW.includes(k));
    if (hs.length) n.hidden_sections = hs; else delete n.hidden_sections;
    if (n.tiles !== undefined) { if (n.tile_order === undefined && Array.isArray(n.tiles)) n.tile_order = n.tiles; delete n.tiles; }
    return n;
  };
  M.vaerNormCfg = normCfg;
  // Bryter per seksjon → { sections, hidden_sections } (av = false i sections; på = true og fjernet fra hidden_sections/hide)
  const secPatch = (c, k, on) => {
    const S = { ...secMap(c) }, all = [...(Array.isArray(c.hidden_sections) ? c.hidden_sections : []), ...(Array.isArray(c.hide) ? c.hide : [])];
    all.forEach((x) => { if (SW.includes(x) && S[x] === undefined) S[x] = false; }); // gamle skjulte brytere flyttes inn i sections
    S[k] = !!on;
    const hs = all.filter((x, i) => all.indexOf(x) === i && !SW.includes(x));
    return { sections: S, hidden_sections: hs.length ? hs : undefined };
  };
  M.vaerStilOf = stilOf;

  // GUI-editoren (getConfigElement): Steder – samme liste og valg som «Tilpass Vær» (Fiks 42): alle weather.* automatisk,
  // én rad per sted (navn = omdøping → places, ↑/↓ → order, Fjern → exclude, ha-selector {entity: {domain: 'weather'}} =
  // bytt entitet) + «Legg til sted» (ha-selector → places, fjernes fra exclude) + fjernede steder kan vises igjen.
  // Uten ha-selector (test/eldre HA): navn + <select> over alle weather.* + «Legg til sted».
  const edPatch = (ed, patch) => {
    const ks = Object.keys(patch), last = ks.pop(), c = { ...(ed._config || {}) };
    ks.forEach((k) => { if (patch[k] === undefined) delete c[k]; else c[k] = patch[k]; });
    ed._config = c;
    return ed._set(last, patch[last]);
  };
  const placesGui = (h, c, key, ed) => {
    const L = placesOf(h, c, { all: true }), all = M.all(h, 'weather'), hasSel = !!customElements.get('ha-selector');
    const sel = esc(JSON.stringify({ entity: { domain: 'weather' } }));
    if (ed && ed.shadowRoot && !ed.__vpAdd) {
      ed.__vpAdd = true;
      // «Legg til sted» (data-vpadd) og bytt entitet per rad (data-vpe = gammel ID)
      ed.shadowRoot.addEventListener('value-changed', (e) => {
        const t = e.target;
        if (!t || !t.dataset || (t.dataset.vpadd == null && t.dataset.vpe == null)) return;
        e.stopPropagation();
        const v = e.detail && e.detail.value, cc = ed._config || {};
        if (!v || typeof v !== 'string') return;
        if (t.dataset.vpadd != null) { M.haptic('success'); edPatch(ed, placeOps.add(cc, v, '')); return; }
        const old = t.dataset.vpe, P = cfgPlaces(cc).find((p) => p.id === old);
        if (v === old) return;
        M.haptic('selection');
        edPatch(ed, placeOps.replace(cc, old, v, P && P.name));
      });
      // Omdøping (data-vpn = ID): tomt navn = entitetens/områdets navn
      ed.shadowRoot.addEventListener('change', (e) => {
        const t = e.target;
        if (!t || !t.dataset || t.dataset.vpn == null) return;
        e.stopPropagation();
        const cc = ed._config || {}, id = t.dataset.vpn, nm = String(t.value || '').trim(), P = cfgPlaces(cc).find((p) => p.id === id);
        if ((P ? P.name : '') === nm) return;
        edPatch(ed, placeOps.add(cc, id, nm));
      });
    }
    if (ed && ed.shadowRoot) queueMicrotask(() => ed.shadowRoot.querySelectorAll('ha-selector[data-vpe],ha-selector[data-vpadd]').forEach((s0) => { const v = s0.dataset.vpe || ''; if (s0.value !== v) s0.value = v; }));
    const btn = (op, i, label, ic, dis, extra) => `<button class="chip" data-a="fn" data-k="${key}" data-op="${op}" data-i="${i}" ${extra || ''} aria-label="${esc(label)}" ${dis ? 'disabled' : ''}>${ic ? M.icon(ic, 18) : esc(label)}</button>`;
    const rows = L.length ? L.map((p, i) => `<div class="col" data-key="vp-${esc(p.id)}" style="gap:6px;padding:8px 0;border-top:${i ? '1px solid ' + WA(0.06) : '0'}">
        <div class="line" style="gap:6px"><input class="inp" data-vpn="${esc(p.id)}" value="${esc(p.renamed ? p.name : '')}" placeholder="${esc(wxName(h, p.id))}" aria-label="Navn på ${esc(p.name)}" style="flex:1;min-width:0">
          ${btn('up', i, 'Flytt opp', 'mdi:arrow-up', i === 0)}${btn('down', i, 'Flytt ned', 'mdi:arrow-down', i === L.length - 1)}${btn('rm', i, `Fjern ${p.name}`, 'mdi:delete-outline', false, `data-id="${esc(p.id)}"`)}</div>
        ${hasSel ? `<ha-selector data-vpe="${esc(p.id)}" data-nomorph data-selector="${sel}" data-label="Værmelding (weather.*)" data-helper="${p.down ? 'Utilgjengelig nå – vises igjen når den er tilgjengelig' : p.src === 'auto' ? 'Automatisk' : ''}"></ha-selector>` : `<span class="small">${esc(p.id)}${p.src === 'auto' ? ' · automatisk' : ''}${p.down ? ' · utilgjengelig' : ''}</span>`}</div>`).join('')
      : '<div class="small">Fant ingen weather.*-entiteter – legg til et sted under.</div>';
    const exL = idList(c.exclude).filter((id) => /^weather\./.test(id) && h && h.states[id] && !L.some((p) => p.id === id));
    const exH = exL.length ? `<div class="line" style="gap:6px;flex-wrap:wrap;padding:6px 0"><span class="small">Fjernet:</span>${exL.map((id) => `<button class="chip" data-a="fn" data-k="${key}" data-op="restore" data-id="${esc(id)}" aria-label="Vis ${esc(wxName(h, id))} igjen">${M.icon('mdi:restore', 16)} ${esc(wxName(h, id))}</button>`).join('')}</div>` : '';
    const add = hasSel
      ? `<ha-selector data-vpadd data-nomorph data-selector="${sel}" data-label="Legg til sted (søk etter weather.*)" data-helper="Alle weather.* vises automatisk – her legger du til igjen et fjernet sted eller gir det navn"></ha-selector>`
      : `<div class="line" style="gap:8px;flex-wrap:wrap"><input class="in" data-vp="name" placeholder="Navn (f.eks. Hytta)" style="flex:1 1 120px;min-width:0;height:40px;padding:0 12px;border-radius:12px;background:var(--ki-surface-3, var(--gray100,#2f2f2f))">
        <select data-vp="ent" style="flex:1 1 140px;min-width:0;height:40px;padding:0 10px;border-radius:12px;background:var(--ki-surface-3, var(--gray100,#2f2f2f))">${all.map((id) => `<option value="${esc(id)}">${esc(wxName(h, id))} · ${esc(id)}</option>`).join('')}</select>
        <button class="chip on" data-a="fn" data-k="${key}" data-op="add" ${all.length ? '' : 'disabled'}>Legg til sted</button></div>`;
    return `<div class="f" data-key="vp-${key}"><label>Steder · alle weather.* automatisk</label>${rows}${exH}${add}</div>`;
  };
  const placesClick = (d, ed) => {
    const c = ed._config || {}, h = ed._hass || ed.hass, L = placesOf(h, c, { all: true }), i = Number(d.i);
    if (d.op === 'rm') { const id = d.id || (L[i] && L[i].id); if (!id) return undefined; M.haptic('selection'); return edPatch(ed, placeOps.remove(c, id)); }
    if (d.op === 'restore') { if (!d.id) return undefined; M.haptic('success'); return edPatch(ed, { exclude: nz(idList(c.exclude).filter((x) => x !== d.id)) }); }
    if (d.op === 'up' || d.op === 'down') {
      const j = d.op === 'up' ? i - 1 : i + 1;
      if (j < 0 || j >= L.length) return undefined;
      const ids = L.map((p) => p.id); [ids[i], ids[j]] = [ids[j], ids[i]];
      M.haptic('selection');
      return edPatch(ed, placeOps.reorder(c, ids));
    }
    if (d.op === 'add') {
      const R = ed.shadowRoot || ed, ent = (R.querySelector('[data-vp="ent"]') || {}).value, nm = ((R.querySelector('[data-vp="name"]') || {}).value || '').trim();
      if (!ent) return undefined;
      M.haptic('success');
      return edPatch(ed, placeOps.add(c, ent, nm));
    }
    return undefined;
  };

  class Vaer extends Forecast(M.Card) {
    static get cardName() { return 'Vær'; }
    static get defaults() { return { hours: 24, days: 7, show_graph: false, show_extras: true, show_pollen: true }; }
    static get schema() {
      return () => [
        // 26.24/26.25: samme valg som «Tilpass Vær» (Stil · Steder · Seksjoner · Fliser) – config er sannheten
        { type: 'select', name: 'style', label: 'Stil', default: 'scene', options: STIL, help: 'Scene = fullskjerms værscene bak hele popupen · Klassisk = Vær v4' },
        { type: 'html', html: (hh, cc, key, ed) => placesGui(hh, cc, key, ed), click: (d, ed) => placesClick(d, ed) },
        ...HIDE.map(([k, l]) => ({ type: 'boolean', label: l, get: (hh, cc) => !hiddenOf(cc).has(k), set: (v, hh, cc, ed) => { if (!ed || !ed._set) return; const p = secPatch(ed._config || cc, k, v); ed._config = { ...ed._config, hidden_sections: p.hidden_sections, hide: undefined }; ed._set('sections', p.sections); } })),
        { type: 'order', name: 'tile_order', hiddenName: 'hidden_tiles', label: 'Fliser (rekkefølge – eller hold inne en flis og dra)', options: [...TILES.map((t) => [t[0], t[1]]), ['moon', 'Månefase (Scene)'], ['feels', 'Føles som (Scene)'], ['vis', 'Sikt (Scene)']] },
        { type: 'button', label: 'Tilbakestill rekkefølge', icon: 'mdi:restore', run: (hh, cc, ed) => { if (ed && ed._set) { ed._config = { ...ed._config, tiles: undefined }; ed._set('tile_order', undefined); M.haptic('medium'); } } },
        { type: 'overrides', label: 'Bytt entiteter', fields: FIELDS },
        // 56 I · Visning (samme nøkler som Tilpass Hjem → Popups → Vær)
        { type: 'section', label: 'Visning', icon: 'mdi:fullscreen', id: 'display', fields: [
          { type: 'select', name: 'view', label: 'Visning', default: 'fullscreen', options: [['fullscreen', 'Fullskjerm'], ['sheet', 'Ark']], help: 'Fullskjerm = værbakgrunnen dekker hele dashbordflaten · Ark = popup med margin og runde hjørner' },
          { type: 'boolean', name: 'hide_navbar', label: 'Skjul navbar i fullskjerm', default: false, help: 'Av = navbar og Now Playing vises over været (Ark skjuler alltid navbaren)' },
        ] },
        // 56 H · «Føles som» og «Sikt»: egne sensorer (ellers apparent_temperature/visibility → autofunnet sensor → utregning)
        { type: 'section', label: 'Føles som og sikt', icon: 'mdi:thermometer', id: 'sensors', fields: [
          { type: 'entity', name: 'feels_like_entity', label: 'Føles som-entitet', domain: 'sensor', auto: (hh, cc) => M.vaerFeelsAuto(hh, M.vaerAuto(hh, cc).weather) },
          { type: 'entity', name: 'visibility_entity', label: 'Sikt-entitet', domain: 'sensor', auto: (hh, cc) => M.vaerVisAuto(hh, M.vaerAuto(hh, cc).weather) },
          { type: 'boolean', name: 'compute_feels', label: 'Beregn føles som når sensor mangler', default: true, help: 'Vindavkjøling under 10 °C, heat index over 27 °C – merkes «beregnet»' },
        ] },
        { type: 'order', name: 'section_order', hiddenName: 'hidden_sections', label: 'Rekkefølge seksjoner (Klassisk)', options: SECS.map((s) => [s[0], s[1]]) },
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
    // 28.1: gamle nøkler (stil, hide, sections-liste, tiles) migreres til style/sections/section_order/tile_order – både i kortet
    // og i GUI-editoren (getConfigElement); neste lagring skriver de nye nøklene.
    static getConfigElement() {
      const e = super.getConfigElement(), sc = e.setConfig.bind(e);
      e.setConfig = (c) => { sc(c); const n = normCfg(e._config); if (n && n !== e._config) { e._config = n; if (e._render) e._render(); } };
      return e;
    }
    setConfig(config) {
      super.setConfig(config);
      const n = normCfg(this._rawConfig);
      if (n !== this._rawConfig) { this._rawConfig = n; this._config = { ...this.constructor.defaults, ...n }; }
    }
    // Valgt sted (stedsvelgeren) overstyrer værentiteten – config er uendret (bare UI-tilstand i localStorage)
    get config() {
      const c = super.config, p = this._place(c);
      return p && p.entity ? { ...c, overrides: { ...(c.overrides || {}), weather: p.entity } } : c;
    }
    // Fiks 42: ui.place = entitets-ID (indeks fra eldre versjoner leses fortsatt); borte/utilgjengelig → standardstedet
    _place(c) {
      c = c || super.config;
      return pickPlace(placesOf(this._hass, c), c, this.ui.place);
    }
    // Bubble-popupen kortet ligger i (på tvers av shadow roots)
    _popEl() {
      let n = this;
      for (let i = 0; n && i < 60; i++) { if (n.classList && n.classList.contains('bubble-pop-up')) return n; n = n.parentNode || n.host; }
      return null;
    }
    // Fiks 55 A4: registeret (som værmeldingen i Forecast) først når popupen har satt seg
    onSettled() { super.onSettled(); if (this.isOpen) this._regSub(); }
    onOpen() {
      super.onOpen();
      if (!this._settling) this._regSub();
      // én haptic ved åpning (26.24) – Fiks 52: bare når trykket som åpnet ikke allerede ga en (navbar/«Mer»/header), ellers to
      if (!this._config.embedded && M.isPopupOpen(this) && M.popupHash(this) && !(M.hapticAge && M.hapticAge() < 1500)) M.haptic('light');
      this._pause(false);
    }
    // Fiks 42: nye/fjernede weather.* dukker opp mens popupen er åpen (entity_registry_updated); ellers ved neste åpning
    _regSub() {
      const con = this.hass && this.hass.connection;
      if (this._regOff || !con || typeof con.subscribeEvents !== 'function') return;
      const tok = {};
      this._regOff = tok;
      const p = Promise.resolve().then(() => con.subscribeEvents((ev) => this._regEvent(ev), 'entity_registry_updated')).catch(() => null);
      tok.off = () => p.then((u) => { if (typeof u === 'function') try { u(); } catch (e) { /* */ } });
    }
    _regUnsub() { if (this._regOff) { this._regOff.off(); this._regOff = null; } clearTimeout(this._regT); }
    _regEvent(ev) {
      const id = ev && ev.data && ev.data.entity_id;
      if (id && !String(id).startsWith('weather.')) return;
      clearTimeout(this._regT);
      // registeret/hass.states oppdateres like etter hendelsen → tegn stedslisten på nytt litt senere (og én gang straks)
      const go = () => { this.update(); this._drawCtl(); if (this._sheet && this._sheet.draw) this._sheet.draw(); };
      go();
      this._regT = setTimeout(go, 400);
    }
    onClose() { super.onClose(); this._regUnsub(); this._pause(true); this._ctlMenu = false; this._drawCtl(); this._tileMode(false); }
    _pause(p) { const sc = this._layer && this._layer.shadowRoot.querySelector('.sc'); if (sc) sc.classList.toggle('paused', !!p); }
    disconnectedCallback() {
      super.disconnectedCallback();
      if (this._rsFull) { window.removeEventListener('resize', this._rsFull); this._rsFull = null; }
      this._regUnsub();
      this._pause(true);
      this._tileMode(false);
      // Kortet er tatt ut (popup lukket / ombygd): ta lagene ut av popupen hvis ingen ny instans bruker dem
      setTimeout(() => { if (this.isConnected) return; [this._layer, this._ctl].forEach((el) => { if (el && el.parentNode) el.remove(); }); if (this._popRef && this._popRef.getAttribute('data-ki-vaer-owner') === this._uid) this._popRef.removeAttribute('data-ki-vaer'); }, 0);
    }
    // Bunnluft. Fiks 56 I: Fullskjerm med navbar (standard) → navbar + Now Playing + safe-area + 16 px (MSH.popupBottomPad(16)),
    // og stedsvelgeren/«Tilpass Vær» (sticky nederst, 28.1) står over navbaren. Ark (28.4) / «Skjul navbar i fullskjerm» → 16 px.
    _applySpacing() {
      super._applySpacing();
      if (this._config.embedded || !M.popupContainer(this)) return;
      const nav = !hideNavOf(this._rawConfig || {}), base = nav && M.popupBottomPad ? M.popupBottomPad(16) : 'calc(16px + env(safe-area-inset-bottom, 0px))';
      this.style.paddingBottom = base;
      // sticky regnes fra innsiden av Bubble-containerens padding → trekk den fra, så knappene står 16 px over bunnen/navbaren
      const C = M.popupContainer(this), pb = C ? parseFloat(getComputedStyle(C).paddingBottom) || 0 : 0;
      this.style.setProperty('--vaer-ctl-b', `calc(${base} - ${pb}px)`);
    }
    // Fiks 56 I · fullskjerm: popupen dekker dashbordflaten (dashbord-containeren, aldri HA-sidebaren) – målt her og lagt
    // som --ki-vaer-top/left/w/h på .bubble-pop-up (stilene i VAER_BLOCK, aktive med data-ki-vaer-full)
    _fitFull(pop) {
      pop = pop || this._popEl();
      if (!pop) return;
      const D = M.rectOf && M.dashEl ? M.rectOf(M.dashEl(this)) : M.dashRect ? M.dashRect() : null;
      if (!D) return;
      const set = (k, v) => { if (pop.style.getPropertyValue(k) !== v) pop.style.setProperty(k, v); };
      set('--ki-vaer-top', Math.round(D.top) + 'px'); set('--ki-vaer-left', Math.round(D.left) + 'px');
      set('--ki-vaer-w', Math.round(D.width) + 'px'); set('--ki-vaer-h', Math.round(D.height) + 'px');
      const dh = Math.round(D.height) + 'px';
      if (this.style.getPropertyValue('--vaer-dh') !== dh) this.style.setProperty('--vaer-dh', dh);
    }
    // Scenelag (bak hele popupen, også bak headeren) + faste kontroller (stedsvelger · tune) i popup-laget
    _mountLayers() {
      const pop = this._popEl(), scene = stilOf(this._rawConfig) === 'scene', R = this.shadowRoot;
      this._uid = this._uid || M.uid();
      this._popRef = pop;
      if (pop) {
        pop.querySelectorAll(':scope > .msh-vaer-scene, :scope > .msh-vaer-ctl').forEach((el) => { if (el !== this._layer && el !== this._ctl) el.remove(); }); // gammel instans
        pop.setAttribute('data-ki-vaer', scene ? 'scene' : 'klassisk');
        // 28.3: værstilen legges også inn av kortet selv (Bubble-roten), så headeren er transparent over scenen og ingen mørk
        // topplinje (headerens egen bakgrunn, scroll-skygge) vises selv om popupens styles ikke er generert av strategien
        const rn = pop.getRootNode && pop.getRootNode(), host = rn && rn !== document ? rn : document.head;
        if (host && !host.querySelector('style[data-ki-vaer-skin]')) { const stl = document.createElement('style'); stl.setAttribute('data-ki-vaer-skin', ''); stl.textContent = VAER_BLOCK; host.appendChild(stl); }
        pop.setAttribute('data-ki-vaer-owner', this._uid);
        // 56 I: Fullskjerm (standard) / Ark – live via attributtet, uten ny generering av popupen
        const full = viewOf(this._rawConfig) === 'fullscreen' && !this._config.embedded;
        pop.toggleAttribute('data-ki-vaer-full', full);
        const hn = hideNavOf(this._rawConfig || {});
        pop.toggleAttribute('data-ki-vaer-nonav', hn);
        if (this._navHide !== hn && location.hash === '#vaer') setTimeout(syncNav, 0); // første montering / valget endret mens popupen er åpen
        this._navHide = hn;
        if (full) {
          this._fitFull(pop);
          if (!this._rsFull) { this._rsFull = () => { cancelAnimationFrame(this._rsRaf); this._rsRaf = requestAnimationFrame(() => this._fitFull()); }; window.addEventListener('resize', this._rsFull); }
        }
      }
      this.toggleAttribute('data-scene', scene);
      if (!this._ctl) {
        this._ctl = mkLayer('msh-vaer-ctl');
        this._ctl.shadowRoot.addEventListener('click', (e) => this._ctlClick(e));
        ['pointerdown', 'touchstart'].forEach((t) => this._ctl.addEventListener(t, (e) => e.stopPropagation(), { passive: true }));
      }
      // 28.1: stedsvelger + «Tilpass Vær» ligger nederst i innholdet, etter siste seksjon («Data fra …»), og følger med som
      // sticky (Vær v5 pickWrap/gearWrap) – aldri i headeren, uavhengig av hvilket element i Bubble som scroller.
      const cp = R.querySelector('.ctl-slot');
      if (cp && this._ctl.parentNode !== cp) cp.appendChild(this._ctl);
      this._ctl.style.cssText = 'position:absolute;left:0;right:0;bottom:0;height:48px;--ctl-b:0px;--ctl-x:0px';
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
        // 56 L: ÉN flate – var(--card) + blur(18px) rett over værbakgrunnen. Android (ki-android, uten blur): dekkende variant =
        // --card blandet over den midterste bakgrunnsfargen (C.bg[1]), samme opplevde mørkhet
        const andr = !!(M.perf && M.perf.android);
        this.toggleAttribute('data-and', andr);
        this.style.setProperty('--vaer-card', andr ? (M.vaerCardOver(sc.key) || sc.card) : sc.card);
        if (pop) { const top = rgbOf((SC[sc.key] || SC.cloudy)[2][0]); pop.setAttribute('data-ki-vaer-lum', top && relLum(top) > 0.179 ? 'light' : 'dark'); }
      } else if (this._layer) { this._layer.remove(); this._layer = null; this.style.removeProperty('--vaer-card'); }
    }
    _drawCtl() {
      const el = this._ctl;
      if (!el) return;
      const L = placesOf(this._hass, super.config), cur = this._place(), i0 = cur ? L.findIndex((p) => p.id === cur.id) : -1;
      const h = this._hass, night = (() => { const ss = h && M.vaerAuto(h, super.config).sun; const so = ss && h.states[ss]; return so ? so.state === 'below_horizon' : isNight(Date.now(), null); })();
      // 27.0: designets stedsmeny (Vær v5 ents): værikon, navn 15/500 + entitets-ID (mono 10 px), temperatur nå; valgt = rosa
      const item = (p, i) => {
        const on = i === i0, so = p.entity && h ? h.states[p.entity] : null, cd = sceneOf(so ? so.state : null, night), t = so ? num(so.attributes.temperature) : null;
        return `<button class="mi${on ? ' on' : ''}" role="menuitemradio" aria-checked="${on}" data-a="pick" data-i="${i}">${M.icon(cd.icon, 22, `color:${on ? INK : icoColT(cd.key)}`)}<span class="mc"><span class="mnm">${esc(p.name)}</span><span class="mid">${esc(p.entity || '–')}</span></span><span class="mt">${t != null ? Math.round(t) : '–'}°</span></button>`;
      };
      const html = `<style>${CTL_CSS}</style>
        ${this._ctlMenu ? `<div class="mbg" data-a="close"></div><div class="mn" role="menu">${L.map(item).join('')}</div>` : ''}
        <button class="b pl" data-a="place" aria-haspopup="menu" aria-expanded="${!!this._ctlMenu}" aria-label="Bytt sted" title="Bytt sted">${M.icon('mdi:map-marker', 20)}<span class="pn">${esc(cur ? cur.name : 'Hjem')}</span><span class="cv${this._ctlMenu ? ' up' : ''}">${M.icon('mdi:chevron-up', 18)}</span></button>
        <button class="b tn" data-a="tune" aria-label="Tilpass Vær" title="Tilpass Vær">${M.icon('mdi:tune', 22)}</button>`;
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
        const L = placesOf(this._hass, super.config), p = L[Number(b.dataset.i) || 0];
        this.setUI({ place: p ? p.id : undefined });
        this._drawCtl();
        if (this.isOpen) setTimeout(() => this._subscribe(), 0);
      }
      return undefined;
    }
    // Scrub på alle grafer (26.24) – Fiks 56 G: retningslås i stedet for touch-action none. touch-action: pan-y (nettleseren
    // eier vertikal scroll), pointerdown registrerer bare startpunktet (berøring); første bevegelse over 8 px bestemmer:
    // vertikal → gesten slippes (ingen preventDefault/stopPropagation – popupen scroller, nettleseren sender pointercancel);
    // horisontal → scrub tar over (setPointerCapture + stopPropagation på pointer-/touchmove, så Bubble ikke lukker/scroller).
    // Mus/penn: scrub straks ved trykk (som før). Stiplet markør + verdi; slipp → visningen går tilbake.
    _bindScrubs() {
      this.shadowRoot.querySelectorAll('[data-scrub]').forEach((el) => {
        el.__mshTA = 'pan-y'; // bevares av MSH.morph
        if (el.style.touchAction !== 'pan-y') el.style.touchAction = 'pan-y';
        if (el.__scr) return;
        el.__scr = true;
        // data-mode="col" (27.1/27.2): n like kolonner – indeks = floor(f·n) (Vær v5 round(f·n − .5)); ellers punkt: round(f·(n−1))
        const pos = (e) => { const n = Number(el.dataset.n) || 1, r = el.getBoundingClientRect(), f = (e.clientX - r.left) / Math.max(1, r.width); return M.clamp(el.dataset.mode === 'col' ? Math.floor(f * n) : Math.round(f * (n - 1)), 0, Math.max(0, n - 1)); };
        let down = null;
        const take = (e) => {
          down.on = true;
          try { el.setPointerCapture(down.id); } catch (x) { /* */ }
          M.haptic('selection');
          this.setUI({ scr: { k: el.dataset.scrub, i: pos(e) } });
        };
        el.addEventListener('pointerdown', (e) => {
          if (e.button) return;
          down = { x: e.clientX, y: e.clientY, moved: false, id: e.pointerId, on: false, touch: e.pointerType === 'touch' };
          if (!down.touch) { e.stopPropagation(); take(e); } // mus/penn: ingen scroll-konflikt
        });
        el.addEventListener('pointermove', (e) => {
          if (!down && e.pointerType !== 'mouse') return;
          if (down && e.pointerId !== down.id) return;
          if (down && !down.on) { // berøring: retningslås ved 8 px
            const dx = e.clientX - down.x, dy = e.clientY - down.y;
            if (Math.abs(dx) <= LOCK && Math.abs(dy) <= LOCK) return;
            if (Math.abs(dy) > Math.abs(dx)) { el._lock = 'v'; down = null; return; } // vertikal: slipp
            el._lock = 'h';
            take(e);
          }
          if (down) { e.stopPropagation(); if (Math.abs(e.clientX - down.x) > 4) down.moved = true; }
          const i = pos(e), s0 = this.ui.scr;
          if (!s0 || s0.k !== el.dataset.scrub || s0.i !== i) this.setUI({ scr: { k: el.dataset.scrub, i } });
        });
        // touchmove: bare stopPropagation når scrubben har tatt gesten (horisontal) – vertikal går videre til Bubble/siden
        el.addEventListener('touchmove', (e) => { if (down && down.on) e.stopPropagation(); }, { passive: true });
        const end = (e) => {
          const wasDrag = down && down.on && down.moved;
          down = null;
          if (this.ui.scr) this.setUI({ scr: null }); // slipp → visningen går tilbake
          if (wasDrag && e && e.type === 'pointerup') { this._swallow = true; setTimeout(() => { this._swallow = false; }, 350); } // dagrad: ingen utfolding etter dra
        };
        ['pointerup', 'pointercancel'].forEach((t) => el.addEventListener(t, end));
        el.addEventListener('pointerleave', (e) => { if (!down && e.pointerType === 'mouse') end(e); });
      });
    }
    // 28.2 · Fliser: hold 400 ms → flyttemodus: flisen løftes (scale 1.04 + skygge, haptic medium) og de andre vugger lett.
    // Dra → flisene bytter plass live (FLIP 200 ms, haptic selection), slipp → haptic light + ny tile_order lagres. Flyttemodus
    // varer til Esc / trykk utenfor flisene (i flyttemodus løftes en flis straks). Kort trykk (< 400 ms) = vanlig trykk.
    // Fallgruve 2: i flyttemodus/løftet flis touch-action none + stopPropagation → popupen lukkes/scroller ikke (56 G: ellers ikke).
    _bindTiles() {
      const box = this.shadowRoot.querySelector('[data-tiles]');
      if (!box || box.__td) return;
      box.__td = true;
      let st = null;
      const kids = () => [...box.querySelectorAll(':scope > .tw')];
      const cancel = () => { if (st && st.timer) clearTimeout(st.timer); };
      const natural = (el) => { const p = el.style.transform; el.style.transform = 'none'; const r = el.getBoundingClientRect(); el.style.transform = p; return r; };
      const place = (x, y) => { const r = natural(st.it); st.it.style.transform = `translate(${(x - st.ox - r.left).toFixed(1)}px, ${(y - st.oy - r.top).toFixed(1)}px) scale(1.04)`; };
      const lift = () => {
        if (!st) return;
        st.on = true; st.timer = null;
        st.start = kids().map((x) => x.dataset.tile).join();
        this._busy = true;
        this._cancelHold();
        if (!this._tmode) this._tileMode(true);
        const r = st.it.getBoundingClientRect();
        st.ox = st.x0 - r.left; st.oy = st.y0 - r.top;
        st.it.classList.add('lift');
        box.classList.add('tdrag');
        try { st.it.setPointerCapture(st.id); } catch (x) { /* */ }
        place(st.x0, st.y0);
        M.haptic('medium');
      };
      box.addEventListener('pointerdown', (e) => {
        const it = e.target.closest && e.target.closest('.tw');
        if (!it || e.button || st) return;
        e.stopPropagation();
        if (!this._tmode && e.target.closest && e.target.closest('[data-scrub],button')) return;
        st = { it, k: it.dataset.tile, x0: e.clientX, y0: e.clientY, id: e.pointerId, on: false, moved: false };
        if (this._tmode) { if (e.cancelable) e.preventDefault(); lift(); } else st.timer = setTimeout(lift, 400);
      });
      box.addEventListener('pointermove', (e) => {
        if (!st || e.pointerId !== st.id) return;
        if (!st.on) { if (Math.abs(e.clientX - st.x0) + Math.abs(e.clientY - st.y0) > 8) { cancel(); st = null; } return; }
        e.stopPropagation(); if (e.cancelable) e.preventDefault();
        st.moved = true;
        place(e.clientX, e.clientY);
        const K = kids(), over = K.find((c) => { if (c === st.it) return false; const r = c.getBoundingClientRect(); return e.clientX > r.left && e.clientX < r.right && e.clientY > r.top && e.clientY < r.bottom; });
        if (!over) return;
        // FLIP: mål før/etter flyttingen og la de andre flisene gli 200 ms til ny plass
        const before = new Map(K.filter((c) => c !== st.it).map((c) => [c, c.getBoundingClientRect()]));
        if (K.indexOf(st.it) < K.indexOf(over)) over.after(st.it); else over.before(st.it);
        before.forEach((r0, c) => {
          const r1 = c.getBoundingClientRect(), dx = r0.left - r1.left, dy = r0.top - r1.top;
          if (!dx && !dy) return;
          c.style.transition = 'none'; c.style.transform = `translate(${dx}px, ${dy}px)`;
          void c.offsetWidth;
          c.style.transition = 'transform .2s cubic-bezier(.2,.8,.2,1)'; c.style.transform = '';
        });
        place(e.clientX, e.clientY);
        M.haptic('selection');
      });
      const end = (e) => {
        if (!st || (e && e.pointerId !== st.id)) return;
        cancel();
        const s = st;
        st = null;
        if (!s.on) return;
        this._busy = false;
        this._swallow = true; setTimeout(() => { this._swallow = false; }, 400); // klikket etter slipp ignoreres
        const it = s.it;
        it.style.transition = 'transform .2s cubic-bezier(.2,.8,.2,1)'; it.style.transform = '';
        setTimeout(() => { it.classList.remove('lift'); it.style.transition = ''; }, 210);
        box.classList.remove('tdrag');
        M.haptic('light');
        const o = kids().map((x) => x.dataset.tile), raw = this._rawConfig || {}, ALLK = [...new Set([...TK, ...STK])];
        if (o.join() === s.start) return this._skipped ? this.update() : undefined;
        const full = orderOf(ALLK, [...o, ...orderOf(ALLK, raw.tile_order || raw.tiles).filter((x) => !o.includes(x))]);
        return this._saveCfg({ tile_order: full, tiles: undefined });
      };
      box.addEventListener('pointerup', end);
      box.addEventListener('pointercancel', (e) => { if (st && !st.on) { cancel(); st = null; } else end(e); });
      box.addEventListener('lostpointercapture', (e) => { if (st && st.on && e.pointerId === st.id) end(e); });
      // 56 G: vertikalt sveip på flisene scroller popupen som normalt – touchmove stoppes bare mens en flis er løftet (dra)
      box.addEventListener('touchmove', (e) => { if (st && st.on) { e.stopPropagation(); if (e.cancelable) e.preventDefault(); } }, { passive: false });
      box.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    // Flyttemodus av/på: vugging (klassen tmode, også i render), Esc og trykk utenfor flisene avslutter
    _tileMode(on) {
      on = !!on;
      if (!!this._tmode === on) return;
      this._tmode = on;
      const box = this.shadowRoot.querySelector('[data-tiles]');
      if (box) box.classList.toggle('tmode', on);
      if (on) {
        this._tmKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); M.haptic('light'); this._tileMode(false); } };
        this._tmDown = (e) => {
          if (e.composedPath().some((n) => n.classList && n.classList.contains('tw') && n.getRootNode() === this.shadowRoot)) return;
          this._tileMode(false);
          if (e.composedPath().includes(this)) { this._swallow = true; setTimeout(() => { this._swallow = false; }, 400); } // trykket avslutter bare flyttemodus
        };
        document.addEventListener('keydown', this._tmKey, true);
        document.addEventListener('pointerdown', this._tmDown, true);
      } else {
        document.removeEventListener('keydown', this._tmKey, true);
        document.removeEventListener('pointerdown', this._tmDown, true);
        this._schedule();
      }
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
      const raw = this._rawConfig || {}, pl = this._place(), pe = pl ? pl.entity : null;
      if (this._heroSrc !== raw || this._heroPl !== pe) {
        this._heroSrc = raw; this._heroPl = pe;
        const { type, card_id, hero, sections, section_order, hidden_sections, tiles, hidden_tiles, tile_order, hide, places, order, stil, style, ...rest } = raw;
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
      M.all(h, 'weather').forEach((id) => this._deps.add(id)); // Fiks 42: utilgjengelig ↔ tilgjengelig endrer stedslisten
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
          <div class="ah"><span class="row" style="gap:6px;font-size:13px;color:var(--ki-text-mid, var(--gray700,#979797))">${M.icon('warning', 16)}Farevarsler · ${sum}</span>
            <span class="row">${AL.map((x, i) => `<span class="ac" data-key="ac${i}" style="background:${LV[x.lv][1]};margin-left:${i ? -7 : 0}px;z-index:${10 - i}">${M.icon(x.icon, 15)}</span>`).join('')}</span></div>
          ${AL.map((x) => {
            const col = LV[x.lv][1], open = ui.alertOpen === x.key;
            return `<button class="al${open ? ' open' : ''}" data-act="alert" data-k="${esc(x.key)}" data-key="${esc(x.key)}" data-ent="${esc(x.ent)}" data-haptic="selection" aria-expanded="${open}" style="background:${TONE(col, 0.12)};box-shadow:inset 0 0 0 1px ${M.alpha(col, 0.35)}">
              <span class="row" style="align-items:flex-start;gap:12px;width:100%">
                <span class="aiw" style="background:${col}">${M.icon(x.icon, 22)}</span>
                <span class="grow col" style="gap:3px;text-align:left">
                  <span class="row" style="gap:6px;flex-wrap:wrap"><span class="lb" style="background:${TONE(col, 0.22)};color:var(--ki-text, ${col})">${LV[x.lv][0]} nivå</span><span style="font-size:11px;color:${x.future ? 'var(--ki-text-mid, var(--gray700, #979797))' : 'var(--ki-text, var(--white, #fafafa))'}">${esc(x.status)}</span></span>
                  <span style="font-size:14px;font-weight:600;line-height:1.3">${esc(x.title)}</span>
                  <span style="font-size:12px;color:var(--ki-text-mid, var(--gray700,#979797))">${esc([whenTxt(x.from), whenTxt(x.to)].filter(Boolean).join(' – ') || '–')}</span>
                </span>
                <span class="chev">${M.icon('expand_more', 22, `color:var(--ki-text-mid, var(--gray700, #979797));transition:transform .2s;transform:${open ? 'rotate(180deg)' : 'none'}`)}</span>
              </span>
              ${open ? `<span class="ax">
                ${x.text ? `<span style="font-size:13px;color:var(--ki-text-1, var(--gray1000,#e1e1e1));line-height:1.45;text-wrap:pretty">${esc(x.text)}</span>` : ''}
                ${x.blocks.map((b) => `<span class="col" style="gap:3px"><span style="font-size:11px;color:var(--ki-text-3, var(--gray600,#7f7f7f))">${esc(b[0])}</span><span style="font-size:13px;color:var(--ki-text-1, var(--gray900,#c7c7c7));line-height:1.45;text-wrap:pretty">${esc(b[1])}</span></span>`).join('')}
                <span class="row" style="justify-content:space-between;gap:10px;font-size:11px;color:var(--ki-text-3, var(--gray600,#7f7f7f))"><span class="ell">${esc(x.src)}</span>${x.url ? `<a class="map" href="${esc(x.url)}" target="_blank" rel="noopener">Åpne kart${M.icon('open_in_new', 14)}</a>` : ''}</span>
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
          <div class="gh"><span class="row" style="gap:6px;font-size:12px;color:var(--ki-text-mid, var(--gray700,#979797))">${M.icon('thermometer', 16)}Temperatur · neste 24 t</span><span class="num" style="font-size:14px;font-weight:500">${cur ? `${f1(cur.v)}° · ${sel ? 'kl ' + hm(cur.t) : 'nå'}` : '–'}</span></div>
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
            <span class="grow col" style="gap:4px;text-align:left"><span style="font-size:14px;color:var(--ki-text-1, var(--gray900,#c7c7c7))">${esc(cap(t.toLocaleDateString('nb-NO', { weekday: 'long' })))}</span>
              <span class="row" style="align-items:baseline;gap:8px"><span class="dhi num">${num(f.temperature) != null ? f1(f.temperature) : '–'}°</span><span class="dlo num">${f.templow != null ? f1(f.templow) + '°' : ''}</span></span>
              <span class="row" style="gap:12px;font-size:13px;color:var(--ki-text-1, var(--gray900,#c7c7c7))"><span>${esc(cd.label)}</span><span>${num(f.precipitation) != null ? `${f1(f.precipitation)} ${esc(pu)}` : ''}</span></span></span>
            ${wxIcon(cd.icon, 64, cd.color)}
          </span>
          ${open ? `<span class="dm">${more.map(([l, v]) => `<span class="col" style="gap:2px;text-align:left;min-width:0"><span style="font-size:11px;color:var(--ki-text-3, var(--gray600,#7f7f7f))">${l}</span><span class="ell" style="font-size:14px;font-weight:500">${esc(v)}</span></span>`).join('')}</span>` : ''}
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
        wind: `<section class="tl"><button class="wd" data-act="winddir" data-haptic="selection" aria-label="Vindretning ${esc(compass(A.wind_bearing) || '–')}"><span class="arr" style="transform:rotate(${bear != null ? (bear + 180) % 360 : 0}deg);opacity:${bear != null ? 1 : 0.3}">${M.icon('navigation', 20, `color:${AT(C.blue)}`)}</span></button>
          <span class="th">${M.icon('air', 16)}Vind</span><span class="tvv">${ws != null ? f1(ws) : '–'}</span><span class="ts" style="margin-top:auto">${esc(wu)}${bear != null || A.wind_bearing ? ' · ' + (ui.windDeg && bear != null ? Math.round(bear) + '°' : compass(A.wind_bearing)) : ''}</span></section>`,
        gust: `<section class="tl" style="background:${TONE(C.purple, 0.16)};box-shadow:inset 0 0 0 1px ${M.alpha(C.purple, 0.35)}"><span class="th" style="color:var(--ki-text-1, var(--gray900,#c7c7c7))">${M.icon('storm', 16, `color:${AT(C.purple)}`)}Vindkast</span><span class="tvv">${gust != null ? f1(gust) : '–'}</span><span class="ts" style="margin-top:auto">${esc(wu)}${gust != null && ws != null ? ` · ${f1(Math.max(0, gust - ws))} over snitt` : ''}</span></section>`,
        sun: `<section class="tl"><span class="th">${M.icon('wb_twilight', 16)}Sol opp og ned</span>
          <span class="row" style="justify-content:space-between;gap:6px"><span class="tvm num">↑ ${sun ? hm(sun.rise) : '–'}</span><span class="tvm num">↓ ${sun ? hm(sun.set) : '–'}</span></span>
          <div class="bar sun" style="margin-top:auto">${sunBar}${mk(dpos(Date.now()))}</div>
          <span class="ts" style="font-size:11px;color:var(--ki-text-3, var(--gray600,#7f7f7f))">${dayLen != null ? `Dagslengde ${Math.floor(dayLen / 60)} t ${Math.round(dayLen % 60)} min` : 'Dagslengde –'}${sun && sun.elev != null ? ` · ${M.nf(sun.elev, 0)}°` : ''}</span></section>`,
        hum: `<section class="tl" style="position:relative;overflow:hidden"><span style="position:absolute;left:0;right:0;bottom:0;height:${hum != null ? M.clamp(hum, 0, 100) : 0}%;background:linear-gradient(180deg, ${M.alpha(C.blue, 0.22)}, ${M.alpha(C.blue, 0.08)})"></span>
          <span class="th" style="position:relative;color:var(--ki-text-1, var(--gray900,#c7c7c7))">${M.icon('humidity_percentage', 16, `color:${AT(C.blue)}`)}Fukt</span><span class="tvv" style="position:relative">${hum != null ? Math.round(hum) + '<small> %</small>' : '–'}</span><span class="ts" style="position:relative;margin-top:auto">Duggpunkt ${dew != null ? f1(dew) + tu : '–'}</span></section>`,
        uv: `<section class="tl"><span class="th">${M.icon('light_mode', 16, `color:${AT(SUNY)}`)}UV-indeks</span><span class="tvv">${uv != null ? f1(uv) : '–'}</span><span style="font-size:12px;font-weight:600;color:${AT(uvL[1])}">${uvL[0]}</span>
          <div class="bar uvs" style="margin-top:auto">${mk(uvPos)}</div></section>`,
        press: `<section class="tl"><span class="th">${M.icon('compress', 16)}Trykk</span><span class="tvv">${pr != null ? Math.round(pr) : '–'}<small> ${esc(prU)}</small></span>
          <span class="ts row" style="gap:4px">${M.icon(trend[1], 16)}${trend[0]}</span><div class="bar prs" style="margin-top:auto">${mk(prPos)}</div></section>`,
        rain: (() => {
          const R = H.length ? R24 : Array(24).fill(0), sr = ui.scr && ui.scr.k === 'rn' ? Math.min(ui.scr.i, R.length - 1) : null;
          const P = R.map((v, i) => [(i / Math.max(1, R.length - 1)) * 100, 40 - (v / rMax) * 36]), d = smooth(P);
          const tt = sr != null && H[sr] ? `kl ${M.pad(new Date(H[sr].datetime).getHours())} · ${f1(R[sr])} ${pu}` : 'Neste 24 timer';
          return `<section class="tl"><span class="th">${M.icon('water_drop', 16, `color:${AT(C.blue)}`)}Nedbør</span><span class="tvv">${rain24 != null ? f1(rain24) : '–'}<small> ${esc(pu)}</small></span>
          <div class="rb"><svg viewBox="0 0 100 40" preserveAspectRatio="none"><path d="${d} L100,40 L0,40Z" style="fill:${M.alpha(C.blue, 0.35)}"></path><path class="sm" d="${d}" fill="none" style="stroke:${RAIN};stroke-width:2" vector-effect="non-scaling-stroke"></path></svg>${sr != null ? `<span class="gc" style="left:${P[sr][0]}%"></span>` : ''}<span class="scrub" data-scrub="rn" data-n="${R.length}"></span></div><span class="ts num">${esc(tt)}</span></section>`;
        })(),
        moon: `<section class="tl mnt" ${a.moon ? `data-ent="${esc(a.moon)}"` : ''}><span class="th">${M.icon('bedtime', 16)}Månefase</span>${moon.none ? '<svg class="moon" style="width:64px;height:64px"><circle cx="32" cy="32" r="32" style="fill:var(--ki-surface-2, #404040)"/></svg>' : moonDisc(moon.p, 64)}<span class="ts" style="margin-top:auto">${esc(moon.name)}</span></section>`,
      };
      const scene = stilOf(c) === 'scene';
      const tord = orderOf(scene ? [...TK, 'moon'] : TK, c.tile_order || c.tiles), thid = new Set(c.hidden_tiles || []);
      const tl = tord.filter((k) => !thid.has(k));
      // Fliser: hold inne ~420 ms og dra for å bytte plass (26.25) – lagres i tile_order
      sec.tiles = tl.length ? `<div class="tiles${this._tmode ? ' tmode' : ''}" data-tiles>${tl.map((k) => `<div class="tw" data-key="t-${k}" data-tile="${k}">${T[k]}</div>`).join('')}</div>` : '';
      sec.moon = `<section class="mn" ${a.moon ? `data-ent="${esc(a.moon)}"` : ''}>${moon.none ? '<svg class="moon" style="width:56px;height:56px"><circle cx="28" cy="28" r="28" style="fill:var(--ki-surface-2, #404040)"/></svg>' : moonDisc(moon.p, 56)}<span class="col" style="gap:2px"><span style="font-size:11px;color:var(--ki-text-mid, var(--gray700,#979797))">Månefase</span><span style="font-size:16px;font-weight:500">${esc(moon.name)}</span></span></section>`;
      const hid = hiddenOf(c);
      const empty = !st ? M.emptyState(a.weather ? `Fant ikke ${a.weather}` : 'Fant ingen weather.*', 'overrides') : '';
      if (scene) return this._scene({ c, h, a, st, A, sunSt, sun, H, Dl, loaded, wu, pu, sec, hid, empty, X: { ws, gust, bear, hum, dew, uv, pr, prU, trend, rain24, moon } });
      const order = orderOf(SK, secOrderOf(c));
      const blocks = order.filter((k) => !hid.has(k) && sec[k]).map((k) => `<div class="blk" data-key="b-${k}" data-sec="${k}">${sec[k]}</div>`);
      // Stedsvelger + «Tilpass Vær» (tune) ligger fast i bunnen av popupen (portalet, 26.25) – ingen knapp nederst i innholdet
      return `<div class="wrap klassisk">${empty}${blocks.join('')}<div class="ctl-slot" data-nomorph></div></div>`;
    }
    /* ---------------------------------------------------------- stil «scene» (26.24/26.25 + 27, fasit Vær v5.dc.html) */
    // Rekkefølge som designet: Nå · Farevarsel · Neste timer · Døgnvarsel · Fliser · «Data fra …». Kortene er var(--card)
    // (kortfargen per tilstand) + blur(18px), radius 24. Animasjonene ligger i scenelaget bak hele popupen (_mountLayers).
    _scene(x) {
      const { c, h, a, st, A, sunSt, sun, H, Dl, loaded, wu, pu, hid, empty, X } = x, ui = this.ui, raw = this._rawConfig || {};
      const night = sunSt ? sunSt.state === 'below_horizon' : isNight(Date.now(), null);
      const sc = sceneOf(st ? st.state : null, night);
      this._sc = sc;
      const pl = this._place();
      // Fiks 42: stedets navn; «Stedsnavn» (name) i Toppkort gjelder standardstedet når det ikke er omdøpt i Steder
      const dp = defPlace(placesOf(h, super.config), super.config), isDef = !!(pl && dp && pl.id === dp.id);
      const placeName = (pl && (pl.renamed || !isDef || !c.name) && pl.name) || c.name || (h.config && h.config.location_name) || (st ? M.name(h, a.weather) : '–');
      const today = todayOf(Dl) || Dl[0] || null, temp = st ? num(A.temperature) : null;
      const hi = today ? num(today.temperature) : null, lo = today ? num(today.templow) : null;
      const ph = (what) => esc(!st ? 'Ingen værmelding' : loaded || !this.isOpen ? `Ingen ${what}` : 'Henter prognose …');
      // tall som String(n).replace('.', ',') i Vær v5: 0,6 · 3 · 1016 (én desimal, ingen «,0»)
      const nf = (v) => { if (v == null || isNaN(v)) return '–'; const r1 = Math.round(Number(v) * 10) / 10; return M.nf(r1, r1 % 1 ? 1 : 0); };
      const ws1 = nf;
      const S = {};
      // ---- Nå (sted i versaler · 96 px temperatur · tilstand · H/L som ÉN streng, 26.24)
      S.now = `<section class="snw" ${a.weather ? `data-ent="${esc(a.weather)}"` : ''}><span class="sloc">${M.icon('mdi:map-marker', 14)}<span class="ell">${esc(String(placeName).toUpperCase())}</span></span>
        <span class="stp num">${temp != null ? Math.round(temp) : '–'}°</span>
        <span class="scd">${esc(st ? sc.label : '–')}</span>
        <span class="shl num">${esc(`H ${hi != null ? Math.round(hi) + '°' : '–'} · L ${lo != null ? Math.round(lo) + '°' : '–'}`)}</span></section>`;
      // ---- Farevarsel (designets kort: gul sirkel, tittel 15/500, tid 12 px, chevron; åpen = tekst + kilde)
      const AL = a.alerts.flatMap((id) => parseAlerts(h, id)).sort((p, q) => (p.future - q.future) || (q.lv - p.lv));
      const dlong = (t) => new Date(t).toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' });
      if (AL.length) {
        S.alerts = AL.map((al) => {
          const open = ui.alertOpen === al.key, col = LV[al.lv][1];
          const when = al.future ? `Fra ${hm(al.from)} ${dlong(al.from)}` : `Pågår${!isNaN(al.to) ? ` · til ${hm(al.to)} ${dlong(al.to)}` : ''}`;
          const src = String(al.src || '').split(' · ')[0];
          return `<button class="g sal${open ? ' open' : ''}" data-act="alert" data-k="${esc(al.key)}" data-key="${esc(al.key)}" data-ent="${esc(al.ent)}" data-haptic="light" aria-expanded="${open}">
            <span class="salh"><span class="saic" style="background:${col}">${M.icon(al.icon, 18)}</span><span class="salt"><span class="salti">${esc(al.title)}</span><span class="sals">${esc(when)}</span></span><span class="chev">${M.icon('mdi:chevron-down', 22, `color:#a8a8a8;transition:transform .25s;transform:${open ? 'rotate(180deg)' : 'none'}`)}</span></span>
            ${open ? `<span class="salx">${al.text ? `<span class="tx">${esc(al.text)}</span>` : ''}${al.blocks.map((bk) => `<span class="tx"><b>${esc(bk[0])}:</b> ${esc(bk[1])}</span>`).join('')}
              <span class="salsrc"><span>${esc(/met/i.test(src) ? 'MET NORGE' : src.toUpperCase())}</span>${al.url ? `<a class="map" href="${esc(al.url)}" target="_blank" rel="noopener">Åpne kart${M.icon('mdi:open-in-new', 14)}</a>` : ''}</span></span>` : ''}
          </button>`;
        }).join('');
      }
      // ---- Neste timer (27.1): kolonnekort, rund ikon-pillvelger (Liquid Glass), metric endrer verdiene i kolonnene
      const metric = ['temp', 'rain', 'wind'].includes(ui.seg) ? ui.seg : 'temp';
      const MT = { temp: ['mdi:thermometer', `Temperatur (${A.temperature_unit || '°C'})`, 'Temperatur'], rain: ['mdi:water', 'Nedbør · mengde og sannsynlighet', 'Nedbør'], wind: ['mdi:weather-windy', `Vind (${wu}) · kast`, 'Vind'] };
      const G = H.slice(0, Math.max(12, Math.min(48, Number(raw.hours) || 24))), n = G.length, cw = 56;
      const tlab = (f, i) => (i ? M.pad(new Date(f.datetime).getHours()) : 'Nå');
      const cols = G.map((f, i) => {
        const t = new Date(f.datetime).getTime(), cd = sceneOf(f.condition, f.is_daytime != null ? !f.is_daytime : isNight(t, sun));
        const pp = num(f.precipitation_probability), mm = num(f.precipitation), T = num(f.temperature);
        let body;
        // 31.3: fast kolonnehøyde (152 px) i alle fanene – Temperatur: ikon, % og grader i en flex:1-boks (space-evenly)
        if (metric === 'temp') body = `<span class="htb"><span class="hic">${wxSvg(cd.key, 26)}</span><span class="hp num">${pp ? Math.round(pp) + '%' : ''}</span><span class="hv num">${T != null ? Math.round(T) : '–'}°</span></span>`;
        else if (metric === 'rain') body = `<span class="rbx"><i class="l1"></i><i class="l2"></i><i class="rf" style="height:${mm ? Math.max(6, Math.min(100, (mm / 1.5) * 100)).toFixed(0) + '%' : '0'}"></i></span><span class="hmm">${mm ? nf(mm) : '0'} ${esc(pu)}</span><span class="hpr">${M.icon('mdi:water', 14, `color:${BLUE}`)}${pp != null ? Math.round(pp) + '%' : '–'}</span>`;
        else body = `<span class="hw"><span class="hwv">${ws1(num(f.wind_speed))}</span><span class="hwg">kast ${ws1(num(f.wind_gust_speed))}</span></span>`; // 31.3: ingen 58 px-spacer – grafen ligger absolutt nederst
        return `<div class="hc" data-key="hc${i}"><span class="ht${i ? '' : ' now'}">${tlab(f, i)}</span>${body}</div>`;
      }).join('');
      let chart = '';
      if (metric === 'wind' && n > 1) {
        let lw = null;
        const WS = G.map((f) => { const v = num(f.wind_speed); if (v != null) lw = v; return lw != null ? lw : 0; }), GS = G.map((f) => num(f.wind_gust_speed));
        const WX = Math.max(1, ...WS, ...GS.filter((v) => v != null)) * 1.1, wy = (v) => 56 - ((v || 0) / WX) * 50;
        const ext = (arr) => [[0, wy(arr[0])], ...arr.map((v, i) => [i * cw + cw / 2, wy(v)]), [n * cw, wy(arr[n - 1])]];
        const gOk = GS.some((v) => v != null), si = ui.scr && ui.scr.k === 'wh' ? M.clamp(ui.scr.i, 0, n - 1) : null;
        const fx = si != null ? ((si + 0.5) / n) * 100 : 0, fs = si != null ? G[si] : null;
        chart = `<svg class="wch" viewBox="0 0 ${n * cw} 58" preserveAspectRatio="none" aria-hidden="true">${gOk ? `<path class="sm" d="${smooth(ext(GS.map((v, i) => (v != null ? v : WS[i]))))} L${n * cw},58 L0,58 Z" fill="rgba(95,201,196,.22)"></path>` : ''}<path class="sm" d="${smooth(ext(WS))}" fill="none" stroke="rgb(95 201 196)" stroke-width="2.5" stroke-linecap="round" vector-effect="non-scaling-stroke"></path></svg>
          <span class="wsc" data-scrub="wh" data-n="${n}" data-mode="col"></span>
          ${fs ? `<span class="wmk" style="left:${fx.toFixed(2)}%"></span><span class="wtip gb" style="left:clamp(0px, calc(${fx.toFixed(2)}% - 70px), calc(100% - 140px))">${tlab(fs, si)} · ${ws1(num(fs.wind_speed))} ${esc(wu)} · kast ${ws1(num(fs.wind_gust_speed))}</span>` : ''}`;
      }
      S.hours = `<section class="g hcard" data-metric="${metric}"><div class="hhd"><span class="hti"><span class="htt">Neste timer</span><span class="hsub">${esc(MT[metric][1])}</span></span>
        <span class="mpill" role="tablist" data-glass-drag="x">${['temp', 'rain', 'wind'].map((k) => `<button class="mb sg${metric === k ? ' on' : ''}" role="tab" aria-selected="${metric === k}" aria-label="${MT[k][2]}" title="${MT[k][2]}" ${metric === k ? 'data-active="1"' : ''} data-act="seg" data-k="${k}" data-haptic="off" data-key="mb-${k}">${M.icon(MT[k][0], 18)}</button>`).join('')}</span></div>
        ${n ? `<div class="hsc noscroll"><div class="hin"><div class="hrow">${cols}</div>${chart}</div></div>` : `<div class="hph">${ph('timeprognose')}</div>`}</section>`;
      // ---- Døgnvarsel (27.2): én åpen dag, stav skalert mot ukens min/maks; Nedbør/Vind-velgeren gir egne rader (Vær v5)
      const nD = Math.max(1, Math.min(10, Number(raw.days) || 10)), days = Dl.slice(0, nD);
      const HA = (this._fc && this._fc.hourly) || [], today0 = new Date().toDateString();
      const dname = (t) => (t.toDateString() === today0 ? 'I dag' : cap(wd(t)));
      const blocks8 = (t) => { const ds = t.toDateString(), B = [[], [], [], [], [], [], [], []]; HA.forEach((y) => { const d = new Date(y.datetime); if (d.toDateString() === ds) B[Math.floor(d.getHours() / 3)].push(y); }); return B; };
      if (!days.length) S.days = `<section class="g dcard"><div class="hph" style="padding:14px 0">${ph('dagsprognose')}</div></section>`;
      else if (metric === 'rain') {
        const curB = Math.floor(new Date().getHours() / 3);
        S.days = `<section class="g dcard" data-metric="rain">${days.map((f, i) => {
          const t = new Date(f.datetime), B = blocks8(t), isT = t.toDateString() === today0;
          const seg = B.map((L) => (L.length ? L.reduce((s0, y) => s0 + (num(y.precipitation) || 0), 0) : 0));
          const segP = B.map((L) => { const v = L.map((y) => num(y.precipitation_probability)).filter((q) => q != null); return v.length ? Math.round(Math.max(...v)) : null; });
          const mm = num(f.precipitation), p = num(f.precipitation_probability);
          const k = ui.scr && ui.scr.k === 'rd' + i ? M.clamp(ui.scr.i, 0, 7) : -1, on = k >= 0;
          const mmTxt = on ? `${M.pad(k * 3)}: ${seg[k] ? nf(seg[k]) : '0'} ${pu}` : `${nf(mm)} ${pu}`, pTxt = on ? (segP[k] != null ? segP[k] + '%' : '–') : (p != null ? Math.round(p) + '%' : '–');
          return `<div class="rrow" data-key="rd${i}"><span class="dn">${esc(dname(t))}</span>
            <span class="rsg" data-scrub="rd${i}" data-n="8" data-mode="col">${seg.map((v, j) => `<span class="rs${j >= 2 && j < 6 ? ' d' : ''}${(on ? j === k : isT && j === curB) ? ' o' : ''}${on && j === k ? ' k' : ''}"><i style="height:${v ? Math.min(100, (v / 0.6) * 25 + 10).toFixed(0) + '%' : '0'}"></i></span>`).join('')}</span>
            <span class="rmm num" style="width:${on ? 96 : 52}px;color:${(on ? seg[k] : mm) ? '#fafafa' : '#6a6a6a'}">${esc(mmTxt)}</span><span class="rpp num" style="color:${(on ? seg[k] : p) ? BLUE : '#6a6a6a'}">${pTxt}</span></div>`; // ki-hex-ok: værscene/illustrasjon (mørk øy)
        }).join('')}</section>`;
      } else if (metric === 'wind') {
        const rows = days.map((f) => { const B = blocks8(new Date(f.datetime)), dw = num(f.wind_speed), dg = num(f.wind_gust_speed);
          const s0 = B.map((L) => { const v = L.map((y) => num(y.wind_speed)).filter((q) => q != null); return v.length ? v.reduce((p, q) => p + q, 0) / v.length : dw; });
          const g0 = B.map((L, j) => { const v = L.map((y) => num(y.wind_gust_speed)).filter((q) => q != null); return v.length ? Math.max(...v) : dg != null ? dg : s0[j]; });
          return { f, s: s0, g: g0, ok: s0.some((v) => v != null) }; });
        const Vm = Math.max(9, ...rows.flatMap((r) => [...r.s, ...r.g]).filter((v) => v != null)) * 1.05;
        const sy = (v) => 28 - ((v || 0) / Vm) * 24, sx = (j) => (j / 7) * 100;
        S.days = `<section class="g dcard" data-metric="wind">${rows.map((r, i) => {
          const t = new Date(r.f.datetime), k = ui.scr && ui.scr.k === 'wd' + i ? M.clamp(ui.scr.i, 0, 7) : null;
          const sv = r.s.map((v) => v || 0), gv = r.g.map((v, j) => (v != null ? v : sv[j]));
          const loW = r.ok ? Math.round(Math.min(...r.s.filter((v) => v != null))) : null, hiW = r.ok ? Math.round(Math.max(...gv)) : null;
          const txt = k == null ? `${loW != null ? `${loW}–${hiW}` : '–'} <span>${esc(wu)}</span>` : `${M.pad(k * 3)}: ${ws1(r.s[k])} <span>/${ws1(r.g[k])}</span>`;
          return `<div class="rrow" data-key="wd${i}"><span class="dn">${esc(dname(t))}</span>
            <span class="wdc" data-scrub="wd${i}" data-n="8"><svg viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><rect x="33" y="0" width="34" height="30" fill="rgba(255,255,255,.04)"></rect>${r.ok ? `<path class="sm" d="${smooth(gv.map((v, j) => [sx(j), sy(v)]))} L100,30 L0,30 Z" fill="rgba(95,201,196,.22)"></path><path class="sm" d="${smooth(sv.map((v, j) => [sx(j), sy(v)]))}" fill="none" stroke="rgb(95 201 196)" stroke-width="2" stroke-linecap="round" vector-effect="non-scaling-stroke"></path>` : ''}</svg><!-- ki-hex-ok: værscene (mørk øy) -->
            ${k != null ? `<span class="wdm" style="left:${sx(k).toFixed(1)}%"></span>` : ''}</span><span class="wdt num">${txt}</span></div>`;
        }).join('')}</section>`;
      } else {
        const lows = days.map((f) => (num(f.templow) != null ? num(f.templow) : num(f.temperature))), highs = days.map((f) => num(f.temperature));
        const allT = [...lows, ...highs].filter((v) => v != null), wmin = allT.length ? Math.min(...allT) : 0, wmax = allT.length ? Math.max(...allT) : 1;
        const pos = (v) => M.clamp(((v - wmin) / Math.max(1, wmax - wmin)) * 100, 0, 100);
        const tcol = (v) => (v < 10 ? '#6fd0d0' : v < 15 ? '#8fd6a8' : v < 20 ? '#c9d97a' : '#f2c94c');
        S.days = `<section class="g dcard"><div class="dl">${days.map((f, i) => {
          const t = new Date(f.datetime), key = 'd' + t.toDateString(), open = ui.dayOpen === key, isT = t.toDateString() === today0;
          const cd = sceneOf(f.condition, false), hiD = highs[i], loD = lows[i], pp = num(f.precipitation_probability);
          const bar = hiD != null && loD != null ? `<span class="dbar" style="left:${pos(loD).toFixed(1)}%;right:${(100 - pos(hiD)).toFixed(1)}%;background:linear-gradient(90deg,${tcol(loD)},${tcol(hiD)})"></span>` : '';
          const dot = isT && temp != null ? `<span class="ddot" style="left:calc(${pos(temp).toFixed(1)}% - 5px)"></span>` : '';
          let det = '';
          if (open) {
            const nm = isT ? 'I dag' : cap(t.toLocaleDateString('nb-NO', { weekday: 'long' })), pr = num(f.precipitation), ws = num(f.wind_speed);
            const sent = `${nm}: ${cd.label.toLowerCase()}${pr ? `, ${f1(pr)} ${pu} nedbør` : ''}. Fra ${loD != null ? Math.round(loD) + '°' : '–'} om natta til ${hiD != null ? Math.round(hiD) + '°' : '–'} på ettermiddagen${ws != null ? `, vind ${f1(ws)} ${wu}` : ''}.`;
            const dH = HA.filter((y) => new Date(y.datetime).toDateString() === t.toDateString());
            const h3 = [0, 3, 6, 9, 12, 15, 18, 21].map((hh) => dH.find((y) => new Date(y.datetime).getHours() === hh)).filter(Boolean);
            const shift = sun ? Math.round((new Date(t).setHours(12, 0, 0, 0) - new Date().setHours(12, 0, 0, 0)) / 86400000) * 86400000 : 0;
            const uvD = num(f.uv_index), huD = num(f.humidity);
            const cells = [['mdi:water', 'Nedbør', pr != null ? `${nf(pr)} ${pu}` : '–'], ['mdi:weather-windy', 'Vind', ws != null ? `${nf(ws)} ${wu}` : '–'], ['mdi:weather-sunny', 'UV', uvD != null ? `${Math.round(uvD)} ${uvOf(uvD)[0].toLowerCase()}` : '–'],
              ['mdi:water-percent', 'Fukt', huD != null ? `${Math.round(huD)} %` : '–'], ['mdi:weather-sunset', 'Sol opp', sun ? hm(sun.rise + shift) : '–'], ['mdi:weather-night', 'Sol ned', sun ? hm(sun.set + shift) : '–']];
            det = `<div class="dx" data-key="dx-${esc(key)}"><p class="dsen">${esc(sent)}</p>
              ${h3.length ? `<div class="d3 noscroll">${h3.map((y, j) => { const cy = sceneOf(y.condition, y.is_daytime != null ? !y.is_daytime : isNight(new Date(y.datetime).getTime(), sun)), py = num(y.precipitation_probability); return `<span class="hs" data-key="d3-${j}"><span class="dht">${M.pad(new Date(y.datetime).getHours())}</span>${wxSvg(cy.key, 20)}<span class="dhv num">${num(y.temperature) != null ? Math.round(y.temperature) + '°' : '–'}</span><span class="dhp num">${py ? Math.round(py) + '%' : ''}</span></span>`; }).join('')}</div>` : ''}
              <div class="dgr">${cells.map(([ic, l, v]) => `<span class="dc"><span class="dcl">${M.icon(ic, 14)}${l}</span><span class="dcv">${esc(v)}</span></span>`).join('')}</div></div>`;
          }
          return `<div class="dw${open ? ' open' : ''}" data-key="${esc(key)}"><button class="dr" data-act="day" data-k="${esc(key)}" data-haptic="light" aria-expanded="${open}">
            <span class="dn">${esc(dname(t))}</span><span class="di">${wxSvg(cd.key, 22)}<span class="dp num">${pp ? Math.round(pp) + '%' : ''}</span></span>
            <span class="dlo num">${loD != null ? Math.round(loD) + '°' : '–'}</span><span class="dtr">${bar}${dot}</span><span class="dhi num">${hiD != null ? Math.round(hiD) + '°' : '–'}</span>
            <span class="chev">${M.icon('mdi:chevron-down', 18, `color:#8a8a8a;transition:transform .2s;transform:${open ? 'rotate(180deg)' : 'none'}`)}</span></button>${det}</div>`;
        }).join('')}</div></section>`;
      }
      // ---- Fliser (Vær v5): Vind (kompass) · Soloppgang (bue) · Månefase · UV · Føles som · Nedbør · Sikt · Luftfuktighet · Lufttrykk
      const DIRN = ['nord', 'nordøst', 'øst', 'sørøst', 'sør', 'sørvest', 'vest', 'nordvest'];
      const dirOf = (b) => (b == null ? null : DIRN[Math.round((((b % 360) + 360) % 360) / 45) % 8]);
      const now = Date.now();
      // 56 K · felles bunnlinje (Vind / Soloppgang / Måne): primær til venstre (500), sekundær til høyre (#a8a8a8), festet nederst
      const brow = (l, r) => `<span class="tbr"><b>${esc(l)}</b><span>${esc(r)}</span></span>`;
      // 56 K · Vind: kompass 96 px – tynn ring + svak glød, 36 streker (N/Ø/S/V lengre og lysere), N/Ø/S/V 9 px, rosa nål etter
      // wind_bearing (peker dit vinden blåser), mørk glass-sirkel i midten med verdi 17 px / enhet 11 px
      const ticks = Array.from({ length: 36 }, (_, i) => `<span class="tk2${i % 9 ? '' : ' c'}" style="transform:rotate(${i * 10}deg)"></span>`).join('');
      const card4 = [['N', 0], ['Ø', 90], ['S', 180], ['V', 270]].map(([l, d]) => `<span class="cmpl${l === 'N' ? ' n' : ''}" style="left:${(48 + 33 * Math.sin(d * RAD)).toFixed(1)}px;top:${(48 - 33 * Math.cos(d * RAD)).toFixed(1)}px">${l}</span>`).join('');
      const tile = (icon, l, v, u, k, sub, scale, extra) => `<div class="g tl2 tg"><span class="th2">${M.icon(icon, 15)}${esc(l)}</span><span class="tv2"><span class="tvb">${v}</span><span class="tvu">${v === '–' ? '' : esc(u || '')}</span></span><span class="tk">${esc(k || '')}</span>${scale || ''}${extra || ''}<span class="tsb">${esc(sub || '')}</span></div>`;
      const track = (g, mark) => `<span class="ttr" style="background:${g}">${mark}</span>`;
      const dotMk = (p) => (p == null ? '' : `<span class="tdot" style="left:calc(${p.toFixed(1)}% - 5px)"></span>`);
      const today24 = H.filter((f) => new Date(f.datetime).toDateString() === today0).map((f) => num(f.uv_index)).filter((v) => v != null);
      const uvMax = today24.length ? Math.max(...today24) : null;
      // 56 H · Føles som: config → apparent_temperature → autofunnet sensor → utregning («beregnet»)
      [raw.feels_like_entity, raw.visibility_entity, M.vaerFeelsAuto(h, a.weather), M.vaerVisAuto(h, a.weather)].forEach((id) => { if (id) this.s(id); }); // live (bare disse entitetene)
      const FL = M.vaerFeels(h, raw, a.weather), app = FL ? FL.v : null;
      const feelsK = app == null || temp == null ? '' : Math.abs(app - temp) <= 1 ? 'Omtrent som faktisk' : app < temp ? 'Kaldere enn faktisk pga. vind' : 'Varmere pga. fukt';
      const r6 = H.slice(0, 6).map((f) => num(f.precipitation) || 0).reduce((p, q) => p + q, 0);
      // 56 H · Sikt: config → visibility (+ visibility_unit) → autofunnet sensor → «–» + «Velg entitet»
      const VS0 = M.vaerVis(h, raw, a.weather), vkm = VS0 ? VS0.km : null;
      // 56 K · Soloppgang: gul dagkurve med gradient ned mot horisonten, stiplet natt, sola som prikk etter klokkeslettet
      const SD = sunDay(sun, now), CV = SD ? sunCurve(SD, now) : null;
      const sunSvg = CV ? `<div class="scv"><svg viewBox="0 0 ${SUN_W} ${SUN_H}" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="vsg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgb(242 210 111)" stop-opacity=".35"/><stop offset="1" stop-color="rgb(242 210 111)" stop-opacity="0"/></linearGradient></defs>
          <line x1="0" y1="${HZ}" x2="${SUN_W}" y2="${HZ}" stroke="rgba(255,255,255,.18)" stroke-width="1" vector-effect="non-scaling-stroke"/>
          <path class="sfill" d="${CV.fillD}" fill="url(#vsg)" stroke="none"/>
          ${CV.preD ? `<path class="snight" d="${CV.preD}" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="1.5" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"/>` : ''}${CV.postD ? `<path class="snight" d="${CV.postD}" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="1.5" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"/>` : ''}
          <path class="sday" d="${CV.dayD}" fill="none" stroke="rgb(242 210 111)" stroke-width="2" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>
          <span class="sdot${CV.up ? '' : ' dn'}" style="left:${((CV.dot[0] / SUN_W) * 100).toFixed(2)}%;top:${CV.dot[1].toFixed(1)}px"><i></i><b></b></span></div>`
        : `<div class="scv"><svg viewBox="0 0 ${SUN_W} ${SUN_H}" preserveAspectRatio="none" aria-hidden="true"><line x1="0" y1="${HZ}" x2="${SUN_W}" y2="${HZ}" stroke="rgba(255,255,255,.18)" stroke-width="1" vector-effect="non-scaling-stroke"/></svg></div>`;
      // 56 K · Måne: fase og tittel fra sensor.moon_phase; belysning og måneoppgang beregnet (SunCalc) fra HAs posisjon
      const LL = latLon(h, A), mIll = M.vaerMoonIllum(new Date(now)), mRise = LL ? nextMoonrise(LL[0], LL[1], now) : null;
      const T2 = {
        wind: `<div class="g tl2 twd"><span class="th2">${M.icon('mdi:weather-windy', 15)}Vind</span><div class="cmp"><span class="cmpr"></span>${ticks}${card4}<div class="ndl" style="transform:rotate(${X.bear != null ? (X.bear + 180) % 360 : 0}deg);opacity:${X.bear != null ? 1 : 0.3}"><b></b><i></i></div><span class="cmpc"><span class="cmpv">${ws1(X.ws)}</span><span class="cmpu">${esc(wu)}</span></span></div>
          ${brow(dirOf(X.bear) ? `Fra ${dirOf(X.bear)}` : 'Retning –', `Kast ${ws1(X.gust)}`)}</div>`,
        sun: `<div class="g tl2 tsn" data-phase="${SD ? (SD.post ? 'post' : 'day') : 'none'}"><span class="th2">${M.icon(SD && SD.post ? 'mdi:weather-sunset-down' : 'mdi:weather-sunset-up', 15)}${SD && SD.post ? 'Solnedgang' : 'Soloppgang'}</span><span class="sbig num">${SD ? hm(SD.post ? SD.set : SD.rise) : '–'}</span>
          ${sunSvg}${brow(SD ? (SD.post ? `↑ ${hm(SD.next)}` : `↓ ${hm(SD.set)}`) : '↓ –', SD ? durTxt(SD.set - SD.rise) : '–')}</div>`,
        moon: `<div class="g tl2 mnt" ${a.moon ? `data-ent="${esc(a.moon)}"` : ''}><span class="th2">${M.icon('mdi:weather-night', 15)}${esc(X.moon.name)}</span>${X.moon.none ? '<svg class="moon" style="width:84px;height:84px;align-self:center"><circle cx="42" cy="42" r="42" fill="#404040"/></svg>' : moonDisc(X.moon.p, 84)}${brow(mRise != null ? `↑ ${hm(mRise)}` : '↑ –', mIll ? `${Math.round(mIll.fraction * 100)} % lys` : '–')}</div>`, // ki-hex-ok: værscene/illustrasjon (mørk øy)
        uv: tile('mdi:weather-sunny', 'UV-indeks', X.uv != null ? String(Math.round(X.uv)) : '–', '', X.uv != null ? uvOf(X.uv)[0] : '', uvMax != null ? `${uvOf(uvMax)[0]} resten av dagen.` : '', track('linear-gradient(90deg,#6fd29a,#f2c94c,#f0a36b,#f07070,#c97ae0)', dotMk(X.uv != null ? M.clamp(X.uv / 11, 0, 1) * 100 : null))),
        feels: `<div class="g tl2 tg tfl" data-src="${FL ? FL.src : 'none'}" ${FL && FL.ent ? `data-ent="${esc(FL.ent)}"` : ''}><span class="th2">${M.icon('mdi:thermometer', 15)}Føles som</span><span class="tv2"><span class="tvb">${app != null ? Math.round(app) : '–'}</span><span class="tvd">${app != null ? '°' : ''}</span></span><span class="tk">${esc(feelsK)}</span>
          ${FL && FL.src === 'calc' ? '<span class="tcalc">beregnet</span>' : ''}${!FL ? '<button class="tpick press" data-act="customize" data-section="sensors" data-haptic="light">Velg entitet</button>' : ''}</div>`,
        rain: tile('mdi:water', 'Nedbør', H.length ? nf(r6) : '–', pu, 'neste 6 t', X.rain24 != null ? `${nf(X.rain24)} ${pu} ventet neste døgn.` : ''),
        vis: `<div class="g tl2 tg tvs" data-src="${VS0 ? VS0.src : 'none'}" ${VS0 && VS0.ent ? `data-ent="${esc(VS0.ent)}"` : ''}><span class="th2">${M.icon('mdi:eye', 15)}Sikt</span><span class="tv2"><span class="tvb">${vkm != null ? visNum(vkm) : '–'}</span><span class="tvu">${vkm != null ? 'km' : ''}</span></span>
          ${vkm != null ? `<span class="tk">${visTxt(vkm)}</span>${track('linear-gradient(90deg,rgba(255,255,255,.12),rgba(255,255,255,.5))', dotMk(M.clamp(vkm / 20, 0, 1) * 100))}<span class="tsc"><span>0</span><span>10</span><span>20+ km</span></span>` : '<button class="tpick press" data-act="customize" data-section="sensors" data-haptic="light">Velg entitet</button>'}</div>`,
        hum: tile('mdi:water-percent', 'Luftfuktighet', X.hum != null ? String(Math.round(X.hum)) : '–', '%', '', X.dew != null ? `Duggpunkt ${Math.round(X.dew)}° nå.` : ''),
        press: tile('mdi:arrow-collapse-vertical', 'Lufttrykk', X.pr != null ? String(Math.round(X.pr)) : '–', X.prU, X.pr != null ? X.trend[0] : '', 'Lavt ← → Høyt', track('linear-gradient(90deg,#4b4b4b,#8a8a8a,#4b4b4b)', X.pr != null ? `<span style="position:absolute;top:-3px;left:calc(${(M.clamp((X.pr - 960) / 100, 0, 1) * 100).toFixed(1)}% - 2px);width:4px;height:12px;border-radius:2px;background:#fafafa"></span>` : '')), // ki-hex-ok: værscene/illustrasjon (mørk øy)
      };
      const tord = orderOf(STK, raw.tile_order || raw.tiles), thid = new Set(raw.hidden_tiles || []), tl = tord.filter((k) => !thid.has(k));
      if (tl.length) S.tiles = `<div class="tiles stiles${this._tmode ? ' tmode' : ''}" data-tiles>${tl.map((k) => `<div class="tw" data-key="t-${k}" data-tile="${k}">${T2[k]}</div>`).join('')}</div>`;
      const plat = (M.regEntry(h, a.weather) || {}).platform || '', attr = String(A.attribution || '');
      const src = plat === 'met' || /met\.no|yr\b|norwegian meteorological/i.test(attr) ? 'Yr / MET Norge' : attr;
      const blocks = ['now', 'alerts', 'hours', 'days', 'tiles'].filter((k) => S[k] && !hid.has(k)).map((k) => `<div class="blk" data-key="b-${k}" data-sec="${k}">${S[k]}</div>`);
      // 56 G: tekst ut fra kortflaten (lys modus): mørk værflate → lys tekst, lys flate → mørk; nedbørsblå ≥ 4,5:1 mot flaten
      const ink = M.theme && M.theme.mode && M.theme.mode() === 'light' ? M.vaerSurfInk(sc.key) : null;
      const inkA = ink ? ` data-lum="${ink.lum}" style="--vt1:${ink.t1};--vt2:${ink.t2};--vblue:${ink.blue}"` : '';
      const full = viewOf(raw) === 'fullscreen' && !c.embedded && !!M.popupContainer(this);
      return `<div class="wrap scene${full ? ' full' : ''}" data-ki-island data-scene="${sc.key}"${inkA}><div class="scn-slot" data-nomorph></div>${empty}${blocks.join('')}${st && src ? `<span class="attr">Data fra ${esc(src)}</span>` : ''}<div class="ctl-slot" data-nomorph></div></div>`;
    }
    onAction(name, el, ev) {
      if (name === 'alert') { if (ev.composedPath().some((n) => n.tagName === 'A')) return; return this.setUI({ alertOpen: this.ui.alertOpen === el.dataset.k ? null : el.dataset.k }); }
      if (name === 'day') return this.setUI({ dayOpen: this.ui.dayOpen === el.dataset.k ? null : el.dataset.k });
      if (name === 'seg') { if (this.ui.seg !== el.dataset.k) M.haptic('selection'); return this.setUI({ seg: el.dataset.k, scr: null }); }
      if (name === 'winddir') return this.setUI({ windDeg: !this.ui.windDeg });
      return super.onAction(name, el, ev);
    }
    afterRender() {
      // 56 G: timestripen (Klassisk/Scene) og døgnets 3-timersrad – pan-x pan-y + retningslås, ingen stopPropagation på vertikalt
      this.shadowRoot.querySelectorAll('.hrs,.hsc,.d3').forEach((el) => hScroll(el));
      const seg = this.shadowRoot.querySelector('.mpill');
      if (seg && M.glassDrag) M.glassDrag(seg, { axis: 'x', touchAction: 'pan-y' }); // Liquid Glass-drag (26.24/27.1): pan-y + stopPropagation, haptic ved bytte
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
        .ac{width:28px;height:28px;border-radius:14px;display:grid;place-items:center;color:var(--ki-on-accent, #282828);box-shadow:0 0 0 2px var(--ki-popup, #282828);position:relative}
        .al{display:flex;flex-direction:column;padding:14px 16px;border-radius:24px;width:100%;text-align:left}
        .aiw{width:42px;height:42px;border-radius:21px;flex:none;display:grid;place-items:center;color:var(--ki-on-accent, #282828)}
        .chev{flex:none;line-height:0}
        .lb{font-size:11px;font-weight:600;padding:2px 8px;border-radius:8px}
        .ax{display:flex;flex-direction:column;gap:10px;width:100%;padding-top:12px;margin-top:12px;border-top:1px solid ${WA(0.06)};text-align:left}
        .map{display:flex;align-items:center;gap:4px;color:var(--ki-text-2, var(--gray800,#afafaf));text-decoration:none;white-space:nowrap}
        .hrs{width:100%;display:flex;gap:8px;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;scroll-snap-type:x proximity;overscroll-behavior-x:contain;margin:0;padding:0;border-radius:24px}
        .hb{flex:none;width:92px;height:172px;border-radius:24px;background:var(--ki-surface, var(--gray200,#3a3a3a));display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:14px 0;scroll-snap-align:start}
        .hb.first .ht{color:var(--ki-text, var(--white,#fafafa));font-weight:600}
        .hb.ph,.day.ph{width:100%;height:auto;min-height:72px;justify-content:center;font-size:13px;color:var(--ki-text-mid, var(--gray700,#979797))}
        .ht{font-size:13px;color:var(--ki-text-2, var(--gray800,#afafaf))}
        .htv{font-size:24px;font-weight:300;letter-spacing:-0.02em}
        .hx{display:flex;flex-direction:column;align-items:center;gap:1px;font-size:11px;color:var(--ki-text-mid, var(--gray700,#979797))}
        .hx .hr{color:${AT(RAIN)}}
        .gr{border-radius:28px;background:var(--ki-surface, var(--gray200,#3a3a3a));padding:16px 0 0;overflow:hidden}
        .gh{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0 16px 8px}
        .gw{position:relative;height:100px}
        .gw svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
        .gc{position:absolute;top:0;bottom:0;border-left:1px dashed ${M.alpha(SUNY, 0.6)};pointer-events:none}
        .scrub{position:absolute;inset:0;touch-action:pan-y;cursor:crosshair}
        .day{display:flex;flex-direction:column;padding:18px 24px;border-radius:28px;background:var(--ki-surface, var(--gray200,#3a3a3a));width:100%}
        .dhi{font-size:40px;font-weight:300;letter-spacing:-0.03em;line-height:1}
        .dlo{font-size:15px;color:var(--ki-text-3, var(--gray600,#7f7f7f))}
        .dm{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;width:100%;padding-top:14px;margin-top:14px;border-top:1px solid ${WA(0.06)}}
        .tiles{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px}
        .tw{min-width:0}
        .tl{position:relative;display:flex;flex-direction:column;gap:6px;height:164px;padding:16px;border-radius:28px;background:var(--ki-surface, var(--gray200,#3a3a3a));overflow:hidden}
        .th{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--ki-text-mid, var(--gray700,#979797));padding-right:36px}
        .tvv{font-size:40px;font-weight:300;letter-spacing:-0.03em;line-height:1;white-space:nowrap}
        .tvv small{font-size:14px;color:var(--ki-text-mid, var(--gray700,#979797));letter-spacing:0}
        .tvm{font-size:20px;font-weight:400;letter-spacing:-0.02em}
        .ts{font-size:12px;color:var(--ki-text-1, var(--gray900,#c7c7c7))}
        .bar{position:relative;height:6px;border-radius:3px;background:var(--ki-surface-3, var(--gray300,#404040));margin-top:auto;flex:none}
        .bar>span:not(.mk){position:absolute;left:0;top:0;bottom:0;border-radius:3px;background:var(--ki-text-2, var(--gray900,#c7c7c7))}
        .bar.sun>.sb{background:linear-gradient(90deg, ${M.alpha(SUNY, 0.55)}, ${SUNY}, ${M.alpha(SUNY, 0.55)})}
        .bar.uvs{background:linear-gradient(90deg, ${C.green} 0 18%, ${C.yellow} 18% 45%, ${C.orange} 45% 64%, ${C.red} 64% 91%, ${C.purple} 91%)}
        .bar.prs{background:linear-gradient(90deg, ${M.alpha(C.blue, 0.35)}, var(--ki-ctrl, var(--gray400,#545454)) 50%, ${M.alpha(SUNY, 0.4)})}
        .mk{position:absolute;top:-4px;width:4px;height:14px;margin-left:-2px;border-radius:2px;background:var(--ki-text, var(--white,#fafafa));box-shadow:0 0 0 2px var(--ki-surface, var(--gray200,#3a3a3a))}
        .wd{position:absolute;top:10px;right:10px;width:36px;height:36px;border-radius:18px;background:var(--ki-surface-2, var(--gray300,#404040));display:grid;place-items:center}
        .wd:active{transform:scale(.92)}
        .arr{line-height:0;transition:transform .4s;display:inline-flex}
        .rb{position:relative;flex:1;min-height:28px;margin-top:4px}
        .rb svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
        .rb .gc{border-left-color:${M.alpha(C.blue, 0.8)}}
        .tiles{position:relative}
        .tw{position:relative;touch-action:pan-y;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;transition:transform .2s cubic-bezier(.2,.8,.2,1)}
        .tw.lift{z-index:5;transition:none}
        .tw.lift>*{box-shadow:0 18px 40px ${BA(0.45)}}
        .tmode .tw{touch-action:none;cursor:grab}
        .tmode .tw.lift{cursor:grabbing}
        .tmode .tw:not(.lift)>*{animation:vwig .32s ease-in-out infinite alternate;transform-origin:50% 50%}
        .tmode .tw:nth-child(2n):not(.lift)>*{animation-delay:-.16s;animation-direction:alternate-reverse}
        @keyframes vwig{from{transform:rotate(-.9deg)}to{transform:rotate(.9deg)}}
        @media (prefers-reduced-motion: reduce){.tmode .tw:not(.lift)>*{animation:none}}
        .mnt .moon{margin:6px 0 0}
        .ctl-slot{display:block;position:sticky;bottom:var(--vaer-ctl-b, calc(16px + env(safe-area-inset-bottom, 0px)));z-index:6;height:48px;margin-top:-4px;flex:none;pointer-events:none}
        /* ---- stil «scene» (26.24/26.25 + 27, Vær v5): scenen ligger i popup-laget; kortene er var(--card) + blur(18px) */
        :host([data-scene]){--vaer-t2:rgba(255,255,255,.72);--vaer-t3:rgba(255,255,255,.55);--gray600:rgba(255,255,255,.6);--gray700:rgba(255,255,255,.72);--gray800:rgba(255,255,255,.8);--gray900:rgba(255,255,255,.9)} /* ki-hex-ok: værscene (mørk øy) */
        .scene{position:relative;gap:10px;color:#fafafa} /* ki-hex-ok: værscene (mørk øy) */
        .scn-slot{position:absolute;inset:0;z-index:0;pointer-events:none;border-radius:28px;overflow:hidden}
        .scene>.blk{position:relative;z-index:1;gap:10px}
        .scene .g{background:var(--vaer-card,rgba(30,36,46,.42));-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px);border-radius:24px;color:#fafafa} /* ki-hex-ok: værscene (mørk øy) */
        .scene .snw{display:flex;flex-direction:column;align-items:center;gap:2px;padding:12px 0 22px;text-align:center}
        /* 56 I · fullskjerm: innholdet padding 0 16px på telefon, sentrert maks 720 px på nettbrett/PC (bakgrunnen fyller bredden);
           heroen ~30 % av dashbordhøyden, sentrert */
        .scene.full{width:100%;max-width:752px;margin:0 auto;padding:0 16px;box-sizing:border-box}
        .scene.full>.blk[data-sec="now"] .snw{min-height:calc(var(--vaer-dh, 100vh) * .3);justify-content:center;box-sizing:border-box}
        /* 56 L · Android (ki-android): dekkende kortflate, ingen blur */
        :host([data-and]) .scene .g{-webkit-backdrop-filter:none;backdrop-filter:none}
        /* 56 G · lys modus: tekst ut fra kortflatens luminans (data-lum, --vt1/--vt2/--vblue satt i _scene) */
        .scene[data-lum],.scene[data-lum] .g,.scene[data-lum] .ht.now,.scene[data-lum] .stp{color:var(--vt1)}
        .scene[data-lum] .hp,.scene[data-lum] .dp,.scene[data-lum] .dhp{color:var(--vblue)}
        .scene[data-lum] .th2,.scene[data-lum] .tvu,.scene[data-lum] .hsub,.scene[data-lum] .ht:not(.now),.scene[data-lum] .sals,.scene[data-lum] .hmm,.scene[data-lum] .hwg,.scene[data-lum] .dht,.scene[data-lum] .dcl,.scene[data-lum] .dlo,.scene[data-lum] .tbr span,.scene[data-lum] .cmpu,.scene[data-lum] .tsc,.scene[data-lum] .wdt span,.scene[data-lum] .tcalc,.scene[data-lum=light] .attr,.scene[data-lum=light] .sloc,.scene[data-lum=light] .scd,.scene[data-lum=light] .shl,.scene[data-lum=light] .tsb,.scene[data-lum=light] .dsen{color:var(--vt2)}
        .scene .sloc{display:flex;align-items:center;justify-content:center;gap:4px;font-size:12px;font-weight:600;letter-spacing:.08em;color:#e6ebf1;max-width:100%}
        .scene .stp{font-size:96px;font-weight:300;letter-spacing:-0.04em;line-height:1;padding-left:18px}
        .scene .scd{font-size:19px;font-weight:500;color:#e6ebf1}
        .scene .shl{font-size:15px;color:#d3dae3;white-space:nowrap;display:block}
        .scene .sal{display:flex;flex-direction:column;gap:8px;padding:14px 16px;text-align:left;width:100%}
        .scene .salh{display:flex;align-items:center;gap:10px;width:100%}
        .scene .saic{width:32px;height:32px;border-radius:50%;color:#2b2208;display:flex;align-items:center;justify-content:center;flex:none}
        .scene .salt{flex:1;min-width:0;display:flex;flex-direction:column}
        .scene .salti{font-size:15px;font-weight:500}
        .scene .sals{font-size:12px;color:#a8a8a8}
        .scene .sal .chev{line-height:0;flex:none}
        .scene .salx{display:flex;flex-direction:column;gap:8px;padding-top:10px;border-top:1px solid rgba(255,255,255,.07);animation:fade .3s ease} /* ki-hex-ok: værscene (mørk øy) */
        .scene .salx .tx{font-size:14px;line-height:1.5;color:#e1e1e1;text-wrap:pretty} /* ki-hex-ok: værscene (mørk øy) */
        .scene .salx .tx b{font-weight:500}
        .scene .salsrc{display:flex;justify-content:space-between;gap:10px;font-size:11px;color:#8a8a8a;letter-spacing:.04em}
        .scene .salsrc .map{color:#afafaf;letter-spacing:0} /* ki-hex-ok: værscene (mørk øy) */
        .scene .hcard{padding:14px 0 12px;display:flex;flex-direction:column;gap:12px}
        .scene .hhd{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 16px}
        .scene .hti{display:flex;flex-direction:column;min-width:0}
        .scene .htt{font-size:15px;font-weight:500;height:20px;line-height:20px}
        .scene .hsub{font-size:12px;color:#a8a8a8;height:16px;line-height:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis} /* 31.3: undertittelen brytes aldri (samme høyde i alle fanene) */
        .scene .mpill{display:flex;gap:2px;padding:2px;border-radius:999px;background:#303030;touch-action:pan-y;user-select:none;-webkit-user-select:none;position:relative;flex:none}
        .scene .mb{width:40px;height:32px;border-radius:999px;display:flex;align-items:center;justify-content:center;background:transparent;color:#bdbdbd;transition:background .3s,color .3s}
        .scene .mb.on{background:${PINK160};color:${INK}}
        .scene .mpill .gd-lens{position:absolute;z-index:3;pointer-events:none}
        /* 31.3 · «Neste timer»: fast høyde i px (ingen prosent/auto, ingen line-height fra fontmetrikk) – lik i alle tre fanene,
           på iOS WebKit og Chrome; ingen høydeanimasjon ved fanebytte */
        .scene .hsc{overflow-x:auto;overflow-y:hidden;scrollbar-width:none;padding:0 8px;overscroll-behavior-x:contain;height:152px;box-sizing:content-box;transition:none}
        .scene .hsc::-webkit-scrollbar,.scene .d3::-webkit-scrollbar{display:none}
        .scene .hin{position:relative;width:max-content;height:152px}
        .scene .hrow{display:flex;height:152px;align-items:flex-start}
        .scene .hc{flex:none;width:56px;height:152px;min-height:152px;max-height:152px;box-sizing:border-box;overflow:hidden;display:flex;flex-direction:column;align-items:center;gap:6px;line-height:16px}
        .scene .ht{flex:none;font-size:13px;font-weight:400;color:#a8a8a8;height:16px;line-height:16px}
        .scene .htb{flex:1 1 0;min-height:0;display:flex;flex-direction:column;align-items:center;justify-content:space-evenly}
        .scene .hic{display:block;width:26px;height:26px;line-height:0}
        .scene .ht.now{font-weight:600;color:#fafafa} /* ki-hex-ok: værscene (mørk øy) */
        .scene .hp{font-size:12px;font-weight:500;color:${BLUE};height:14px;line-height:14px}
        .scene .hv{font-size:17px;font-weight:500;height:20px;line-height:20px}
        .scene .rbx{flex:none;position:relative;width:36px;height:72px;border-radius:10px;background:#303030;overflow:hidden;margin-top:4px}
        .scene .rbx i{position:absolute;left:0;right:0}
        .scene .rbx .l1,.scene .rbx .l2{border-top:1px dashed #4a4a4a}
        .scene .rbx .l1{top:33%}.scene .rbx .l2{top:66%}
        .scene .rbx .rf{bottom:0;background:${BLUE};border-radius:6px 6px 0 0}
        .scene .hmm{flex:none;font-size:12px;color:#a8a8a8;font-variant-numeric:tabular-nums;height:14px;line-height:14px}
        .scene .hpr{flex:none;display:flex;align-items:center;gap:1px;font-size:14px;font-weight:500;font-variant-numeric:tabular-nums;height:18px;line-height:18px}
        .scene .hw{flex:none;display:flex;flex-direction:column;align-items:center;margin-top:6px}
        .scene .hwv{font-size:19px;font-weight:500;height:21px;line-height:21px;font-variant-numeric:tabular-nums}
        .scene .hwg{font-size:11px;color:#a8a8a8;height:13px;line-height:13px}
        .scene .wch{position:absolute;left:0;right:0;bottom:0;width:100%;height:58px;display:block}
        .scene .wsc{position:absolute;left:0;right:0;bottom:0;height:58px;touch-action:pan-y;cursor:crosshair}
        .scene .wmk{position:absolute;bottom:0;height:58px;width:0;border-left:1.5px dashed rgba(255,255,255,.7);pointer-events:none} /* ki-hex-ok: værscene (mørk øy) */
        .scene .wtip{position:absolute;bottom:62px;width:140px;text-align:center;padding:4px 8px;border-radius:10px;background:rgba(20,22,28,.85);font-size:12px;font-weight:500;white-space:nowrap;pointer-events:none;box-sizing:border-box}
        .scene .hph{padding:0 16px 4px;font-size:13px;color:#a8a8a8}
        .scene .dcard{padding:4px 16px}
        .scene .dl{display:flex;flex-direction:column}
        .scene .dw{display:flex;flex-direction:column;border-top:1px solid rgba(255,255,255,.07)} /* ki-hex-ok: værscene (mørk øy) */
        .scene .dw:first-child{border-top:none}
        .scene .dr{display:flex;align-items:center;gap:8px;min-height:52px;width:100%;text-align:left;cursor:pointer}
        .scene .dn{width:44px;flex:none;font-size:15px;font-weight:500}
        .scene .di{width:40px;flex:none;display:flex;flex-direction:column;align-items:center}
        .scene .dp{font-size:11px;font-weight:500;color:${BLUE};line-height:1.2}
        .scene .dlo{width:30px;flex:none;text-align:right;font-size:15px;color:#a8a8a8}
        .scene .dtr{flex:1;position:relative;height:6px;border-radius:3px;background:rgba(0,0,0,.35);margin:0 4px;min-width:0} /* 56 L: skinnen som i designet */
        .scene .dbar{position:absolute;top:0;bottom:0;border-radius:3px}
        .scene .ddot{position:absolute;top:-2px;width:10px;height:10px;border-radius:50%;background:#fafafa;box-shadow:0 0 0 2px #3d3d3d} /* ki-hex-ok: værscene (mørk øy) */
        .scene .dhi{width:30px;flex:none;text-align:right;font-size:15px;font-weight:500;letter-spacing:0;line-height:normal}
        .scene .dr .chev{width:18px;flex:none;display:grid;place-items:center;line-height:0}
        .scene .dx{display:flex;flex-direction:column;gap:12px;padding:4px 0 16px;animation:vxh .3s ease;overflow:hidden}
        .scene .dsen{margin:0;font-size:15px;line-height:1.5;color:#e6ebf1;text-wrap:pretty;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
        .scene .d3{display:flex;gap:4px;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;margin:0 -4px;padding:0 4px;overscroll-behavior-x:contain}
        .scene .d3 .hs{flex:1 0 52px;padding:10px 0;border-radius:16px;background:rgba(0,0,0,.18);display:flex;flex-direction:column;align-items:center;gap:6px} /* ki-hex-ok: værscene (mørk øy) */
        .scene .dht{font-size:12px;color:#a8a8a8}
        .scene .dhv{font-size:15px;font-weight:500}
        .scene .dhp{font-size:11px;font-weight:500;color:${BLUE};min-height:13px}
        .scene .dgr{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
        .scene .dc{padding:10px 12px;border-radius:16px;background:rgba(0,0,0,.18);display:flex;flex-direction:column;gap:3px;min-width:0} /* ki-hex-ok: værscene (mørk øy) */
        .scene .dcl{display:flex;align-items:center;gap:5px;font-size:11px;color:#a8a8a8;white-space:nowrap}
        .scene .dcv{font-size:16px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .scene .rrow{display:flex;align-items:center;gap:10px;min-height:52px;border-top:1px solid rgba(255,255,255,.07)} /* ki-hex-ok: værscene (mørk øy) */
        .scene .rrow:first-child{border-top:none}
        .scene .rsg{flex:1;display:flex;gap:3px;height:26px;align-items:stretch;min-width:0;touch-action:pan-y;cursor:crosshair}
        .scene .rs{flex:1;position:relative;border-radius:3px;overflow:hidden;background:#353535;transition:transform .12s}
        .scene .rs.d{background:#4a4a4a}
        .scene .rs.o{outline:1.5px solid #fafafa} /* ki-hex-ok: værscene (mørk øy) */
        .scene .rs.k{transform:scaleY(1.12)}
        .scene .rs i{position:absolute;left:0;right:0;bottom:0;background:${BLUE}}
        .scene .rmm{flex:none;text-align:right;font-size:15px;font-weight:500;white-space:nowrap;transition:width .15s}
        .scene .rpp{width:40px;flex:none;text-align:right;font-size:15px;font-weight:500}
        .scene .wdc{position:relative;flex:1;min-width:0;height:30px;touch-action:pan-y;cursor:crosshair}
        .scene .wdc svg{width:100%;height:30px;display:block;border-radius:6px;background:#333}
        .scene .wdm{position:absolute;top:0;bottom:0;width:0;border-left:1.5px dashed rgba(255,255,255,.7);pointer-events:none} /* ki-hex-ok: værscene (mørk øy) */
        .scene .wdt{width:88px;flex:none;text-align:right;font-size:15px;font-weight:500;white-space:nowrap}
        .scene .wdt span{font-weight:400;color:#a8a8a8}
        /* 56 J · flisgriden: alle rader minst 148 px og like høye (1fr = høyeste rads innhold) – ingen flis bestemmer høyden
           alene; vokser innholdet (Sikt med skala, kompasset 96 px fra 56 K) vokser hele griden likt */
        .scene .stiles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-rows:minmax(148px,1fr);gap:8px;align-items:stretch}
        .scene .tw{display:flex;flex-direction:column;min-height:0}
        .scene .tw.lift{border-radius:24px}
        .scene .tw.over>.tl2{box-shadow:inset 0 0 0 2px var(--pink,#f285c9)}
        .scene .tl2{flex:1;padding:14px 16px;border-radius:24px;display:flex;flex-direction:column;gap:8px;min-width:0;box-sizing:border-box}
        .scene .tl2.tg{gap:6px}
        .scene .th2{display:flex;align-items:center;gap:6px;font-size:12px;color:#a8a8a8;min-width:0;line-height:15px}
        .scene .tv2{display:flex;align-items:baseline;gap:4px}
        .scene .tvb{font-size:32px;font-weight:300;line-height:1.1}
        .scene .tvd{font-size:32px;font-weight:300;line-height:1.1;margin-left:-4px}
        .scene .tvu{font-size:13px;color:#a8a8a8}
        .scene .tk{font-size:13px;font-weight:500}
        .scene .tk:empty{display:none}
        .scene .ttr{position:relative;height:6px;border-radius:3px;margin-top:4px;flex:none}
        .scene .tdot{position:absolute;top:-2px;width:10px;height:10px;border-radius:50%;background:#fafafa;box-shadow:0 0 0 2px #3d3d3d} /* ki-hex-ok: værscene (mørk øy) */
        .scene .tsc{display:flex;justify-content:space-between;font-size:10px;color:#a8a8a8;line-height:12px;margin-top:-2px}
        .scene .tsb{margin-top:auto;font-size:12px;color:#d6d6d6;line-height:1.4;text-wrap:pretty}
        .scene .tsb:empty{display:none}
        .scene .tcalc{margin-top:auto;font-size:11px;color:var(--ki-text-3, #a8a8a8);line-height:14px}
        .scene .tpick{margin-top:auto;align-self:flex-start;height:32px;padding:0 14px;border-radius:16px;font-size:13px;font-weight:500;background:rgba(255,255,255,.14);color:#fafafa} /* ki-hex-ok: værscene (mørk øy) */
        /* 56 K · felles bunnlinje (Vind/Soloppgang/Måne) */
        .scene .tbr{display:flex;justify-content:space-between;align-items:baseline;gap:6px;margin-top:auto;font-size:12px;line-height:16px;white-space:nowrap;min-width:0}
        .scene .tbr b{font-weight:500;overflow:hidden;text-overflow:ellipsis}
        .scene .tbr span{color:#a8a8a8;flex:none}
        /* 56 K · Vind: kompass 96 px (J: 84 px – K er siste del) */
        .scene .cmp{position:relative;width:96px;height:96px;align-self:center;flex:none;border-radius:50%;box-shadow:inset 0 0 0 1px rgba(255,255,255,.1);background:radial-gradient(circle, rgba(255,255,255,.06) 0%, rgba(255,255,255,0) 70%)}
        .scene .cmpr{position:absolute;inset:0;border-radius:50%;pointer-events:none}
        .scene .cmp .tk2{position:absolute;left:47.5px;top:3px;width:1px;height:5px;border-radius:.5px;background:rgba(255,255,255,.22);transform-origin:.5px 45px}
        .scene .cmp .tk2.c{height:9px;background:rgba(255,255,255,.55)}
        .scene .cmpl{position:absolute;transform:translate(-50%,-50%);font-size:9px;line-height:9px;font-weight:500;color:#8a8a8a}
        .scene .cmpl.n{color:#fff;font-weight:700}
        .scene .ndl{position:absolute;inset:6px;transition:transform .4s}
        .scene .ndl b{position:absolute;left:50%;top:0;transform:translateX(-50%);width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-bottom:10px solid rgb(242 133 201)}
        .scene .ndl i{position:absolute;left:50%;top:8px;bottom:4px;width:2px;transform:translateX(-50%);background:rgb(242 133 201);border-radius:1px}
        .scene .cmpc{position:absolute;inset:25px;border-radius:50%;background:rgba(20,22,28,.55);box-shadow:0 2px 8px rgba(0,0,0,.35),inset 0 0 0 1px rgba(255,255,255,.06);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);display:flex;flex-direction:column;align-items:center;justify-content:center}
        .scene .cmpv{font-size:17px;font-weight:500;line-height:1}
        .scene .cmpu{font-size:11px;color:#a8a8a8;line-height:13px}
        .scene .sbig{font-size:28px;font-weight:300;line-height:1}
        /* 56 J/K · solkurven 44 px, kant til kant i flisen */
        .scene .scv{position:relative;height:44px;margin:0 -16px;flex:none}
        .scene .scv svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible;display:block}
        .scene .sdot{position:absolute;width:0;height:0}
        .scene .sdot i{position:absolute;left:-9px;top:-9px;width:18px;height:18px;border-radius:50%;background:rgb(242 210 111);opacity:.18}
        .scene .sdot b{position:absolute;left:-4.5px;top:-4.5px;width:9px;height:9px;border-radius:50%;background:rgb(242 210 111)}
        .scene .sdot.dn b{opacity:.55}
        .scene .mnt .moon{align-self:center;flex:none;box-shadow:0 0 18px rgba(220,225,235,.18)}
        .scene .attr{font-size:11px;color:#8a8a8a;text-align:center;padding-top:6px}
        @keyframes vxh{from{opacity:0;max-height:0;transform:translateY(6px)}to{opacity:1;max-height:640px;transform:none}}
        @media (prefers-reduced-motion: reduce){.scene .dx,.scene .salx{animation:none}}
        ${V5_KF}
        .mn{display:flex;align-items:center;gap:16px;padding:16px 18px;border-radius:28px;background:var(--ki-surface, var(--gray200,#3a3a3a))}
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
.bubble-pop-up[data-ki-vaer="scene"] .bubble-name{color:#fff!important;text-shadow:0 1px 6px rgba(0,0,0,.3)} /* ki-hex-ok: headeren over værscenen (mørk øy) */
.bubble-pop-up[data-ki-vaer="scene"] .bubble-close-button{background-color:rgba(28,30,36,.55)!important;-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);color:#fff!important}
.bubble-pop-up[data-ki-vaer="scene"] > .bubble-pop-up-container{background:transparent!important}
.bubble-pop-up[data-ki-vaer="scene"] > .bubble-header-container::after{display:none!important}
.bubble-pop-up[data-ki-vaer="scene"][data-ki-theme=light]{--bubble-pop-up-background-color:transparent!important;--bubble-pop-up-main-background-color:transparent!important}
.bubble-pop-up[data-ki-vaer="scene"][data-ki-theme=light] #header-container > div > div{background:transparent!important}
.bubble-pop-up[data-ki-vaer="scene"][data-ki-theme=light] .bubble-name{color:#fff!important}
.bubble-pop-up[data-ki-vaer="scene"][data-ki-theme=light] #header-container .bubble-close-button{background-color:rgba(28,30,36,.55)!important;color:#fff!important}
.bubble-pop-up[data-ki-vaer="scene"][data-ki-theme=light] .bubble-close-button svg{fill:#fff!important}
.bubble-pop-up[data-ki-vaer] > .bubble-pop-up-container{-webkit-mask-image:linear-gradient(to bottom,transparent 0px,black 24px)!important;mask-image:linear-gradient(to bottom,transparent 0px,black 24px)!important}
.bubble-pop-up[data-ki-vaer="scene"][data-ki-vaer-lum="light"] .bubble-name{color:#141414!important;text-shadow:none} /* ki-hex-ok: 56 I – lys himmel → mørk headertekst */
.bubble-pop-up[data-ki-vaer="scene"][data-ki-vaer-lum="light"] .bubble-close-button{background-color:rgba(255,255,255,.55)!important;color:#141414!important} /* ki-hex-ok */
.bubble-pop-up[data-ki-vaer="scene"][data-ki-vaer-lum="light"] .bubble-close-button svg{fill:#141414!important} /* ki-hex-ok */
.bubble-pop-up[data-ki-vaer-full]:not(.editor){top:var(--ki-vaer-top,0px)!important;bottom:0!important;height:auto!important;max-height:none!important;min-height:0!important;inset-inline-start:var(--ki-vaer-left,0px)!important;left:var(--ki-vaer-left,0px)!important;right:auto!important;width:var(--ki-vaer-w,100%)!important;min-width:0!important;max-width:none!important;margin:0!important;border-radius:0!important;--bubble-pop-up-border-radius:0px;--bubble-pop-up-content-border-radius:0px}
.bubble-pop-up[data-ki-vaer-full] .bubble-pop-up-background{border-radius:0!important}
.bubble-pop-up[data-ki-vaer-full] > .bubble-header-container{padding-top:max(0px, calc(env(safe-area-inset-top, 0px) - var(--ki-vaer-top, 0px)))!important;background:transparent!important;box-shadow:none!important;position:relative;z-index:3}
.bubble-pop-up[data-ki-vaer-full] > .bubble-pop-up-container{padding-left:0!important;padding-right:0!important;border-radius:0!important}
${VE}`;
  const vaerStyles = (prev) => {
    let s0 = typeof prev === 'string' ? prev : '';
    for (let i = s0.indexOf(VS); i >= 0; i = s0.indexOf(VS)) { const j = s0.indexOf(VE, i); s0 = s0.slice(0, i) + (j >= 0 ? s0.slice(j + VE.length) : ''); }
    return (s0.trim() ? s0.trim() + '\n' : '') + VAER_BLOCK;
  };
  M.vaerPopupStyles = vaerStyles;
  M.POPUP_FORCE = M.POPUP_FORCE || {};
  // Fiks 56 I · Bubble-oppsettet for #vaer (unntak fra mal A, bare Vær): Fullskjerm (standard) → margin_top 0, width_desktop =
  // hele dashbordflaten (Bubble sentrerer på --bubble-pop-up-content-inline-start: «100%» alene ville lagt popupen halvveis over
  // HA-sidebaren – derfor calc(100% − sidebaren), som #kart), bg_opacity 100, bg_blur 0. Radius 0 / høyde = dashbordflaten /
  // max-height none ligger i styles (VAER_BLOCK, data-ki-vaer-full – live uten ny generering). Ark → mal A uendret.
  const FULL = { margin_top_mobile: '0px', margin_top_desktop: '0px', width_desktop: 'calc(100% - var(--bubble-pop-up-content-inline-start, 0px))', bg_opacity: '100', bg_blur: '0' };
  M.VAER_FULL = FULL;
  const cardCfgOf = (cfg) => {
    const card = (cfg && Array.isArray(cfg.cards) ? cfg.cards : []).find((c) => c && String(c.type || '').replace(/^custom:/, '') === 'msh-vaer-card') || {};
    const id = card.card_id || 'pop-vaer', st = M.store && M.store.eff ? M.store.eff('cards.' + id) : null;
    return { ...card, ...(st && typeof st === 'object' ? st : {}) };
  };
  M.POPUP_FORCE['#vaer'] = (cfg) => {
    if (!cfg || typeof cfg !== 'object' || !Array.isArray(cfg.cards) || !cfg.cards.some((c) => c && String(c.type || '').replace(/^custom:/, '') === 'msh-vaer-card')) return null;
    const out = { ...cfg, styles: vaerStyles(cfg.styles) };
    return viewOf(cardCfgOf(cfg)) === 'fullscreen' ? { ...out, ...FULL } : out;
  };
  // Tilpass Hjem → Popups → Vær: samme stil-verdi som «Tilpass Vær» og GUI-editoren (kortets config via ki-store)
  const liveVaer = () => { const out = []; (M.liveCards || new Map()).forEach((set) => set.forEach((el) => { if (el && el.localName === 'msh-vaer-card' && el.isConnected !== undefined) out.push(el); })); return out; };
  const vaerCfg = () => { const el = liveVaer().find((x) => x.isConnected) || liveVaer()[0]; if (el && el._rawConfig) return el._rawConfig; const s0 = M.store && M.store.eff ? M.store.eff('cards.pop-vaer') : null; return s0 || {}; };
  M.vaerStil = () => stilOf(vaerCfg());
  M.vaerView = () => viewOf(vaerCfg());
  // 56 I: skal navbaren skjules mens #vaer er åpen? Ark → ja (28.4); Fullskjerm → bare med «Skjul navbar i fullskjerm»
  // (10-navbar.js _syncVaer spør her)
  M.vaerHidesNav = () => hideNavOf(vaerCfg());
  const syncNav = () => (M.liveCards || new Map()).forEach((set) => set.forEach((el) => { if (el && el.localName === 'msh-navbar-card' && typeof el._syncVaer === 'function') { try { el._syncVaer(); } catch (e) { /* */ } } }));
  // v: 'klassisk' | 'scene' (stil) · 'view:fullscreen' | 'view:sheet' · 'nav:on' | 'nav:off' (Skjul navbar i fullskjerm)
  M.setVaerStil = async (v) => {
    let patch;
    if (/^view:/.test(String(v))) patch = { view: String(v).slice(5) === 'sheet' ? 'sheet' : 'fullscreen' };
    else if (/^nav:/.test(String(v))) patch = { hide_navbar: String(v).slice(4) === 'on' };
    else patch = { style: v === 'klassisk' ? 'klassisk' : 'scene', stil: undefined };
    const els = liveVaer(), el = els.find((x) => x.isConnected) || els[0];
    M.haptic('selection');
    let r;
    if (el && el._rawConfig) r = await el._saveCfg(patch);
    else if (M.store) { const { stil, ...o } = M.store.get('cards.pop-vaer') || {}; const n = { ...o, ...patch }; Object.keys(n).forEach((k) => { if (n[k] === undefined) delete n[k]; }); r = await M.store.set('cards.pop-vaer', n, { immediate: true }); }
    if ('view' in patch || 'hide_navbar' in patch) { liveVaer().forEach((x) => { if (x.isConnected && x._mountLayers) { x._mountLayers(); x._applySpacing(); x.update(); } }); syncNav(); }
    return r;
  };

  // Segment «Klassisk · Scene» med miniatyr (Tilpass Hjem → Popups → Vær). act = data-a-verdien i vertsarket.
  M.vaerStilHTML = function (act) {
    const cur = M.vaerStil ? M.vaerStil() : 'scene', PINK = 'linear-gradient(145deg, rgb(242 133 201) -10%, rgb(245 205 198) 100%)';
    const prev = (k) => (k === 'scene'
      ? '<span style="display:block;height:34px;border-radius:10px;background:linear-gradient(180deg,#2c3846,#586575);position:relative;overflow:hidden"><i style="position:absolute;left:25%;top:4px;width:1.5px;height:10px;background:rgba(210,228,255,.9);transform:rotate(10deg)"></i><i style="position:absolute;left:60%;top:12px;width:1.5px;height:10px;background:rgba(210,228,255,.9);transform:rotate(10deg)"></i><b style="position:absolute;left:5px;right:5px;bottom:5px;height:9px;border-radius:4px;background:rgba(40,48,58,.6)"></b></span>'
      : '<span style="display:grid;grid-template-columns:1fr 1fr;gap:3px;height:34px;padding:4px;border-radius:10px;background:var(--ki-popup, #282828)"><b style="grid-column:span 2;border-radius:4px;background:var(--ki-surface, #3a3a3a)"></b><b style="border-radius:4px;background:var(--ki-surface, #3a3a3a)"></b><b style="border-radius:4px;background:var(--ki-surface, #3a3a3a)"></b></span>');
    return `<div class="msh-vsm" data-key="vsm" style="display:flex;flex-direction:column;gap:6px">
      <div style="font-size:13px;color:var(--ki-text-mid, var(--gray700,#979797));padding:0 4px">Vær · stil</div>
      <div role="radiogroup" data-glass-drag="x" style="display:flex;gap:4px;padding:4px;border-radius:24px;background:var(--ki-surface-3, var(--gray100,#2f2f2f))">${STIL.map(([k, l]) => { const on = k === cur; return `<button role="radio" aria-checked="${on}" ${on ? 'data-active="1"' : ''} data-a="${act}" data-v="${k}" style="flex:1;min-width:0;display:flex;flex-direction:column;gap:5px;padding:6px;border:0;border-radius:20px;font:inherit;font-size:13px;font-weight:600;cursor:pointer;background:${on ? PINK : 'transparent'};color:${on ? 'var(--ki-on-accent, #2f2f2f)' : 'var(--ki-text-2, var(--gray800,#afafaf))'}">${prev(k)}<span>${l}</span></button>`; }).join('')}</div>
      <div style="font-size:12px;color:var(--ki-text-3, var(--gray600,#7f7f7f));padding:0 4px">${cur === 'scene' ? 'Værscene bak hele popupen (regn, snø, lyn, stjerner, sol og tåke)' : 'Vær v4 med toppkort og vanlige kort'} · samme valg som i «Tilpass Vær»</div>
      ${vaerViewHTML(act, PINK)}</div>`;
  };
  // 56 I · «Visning: Fullskjerm / Ark» (standard Fullskjerm) + «Skjul navbar i fullskjerm» (standard av) – samme config-nøkler
  // (view, hide_navbar) som GUI-editoren og kortets Tilpass
  const vaerViewHTML = (act, PINK) => {
    const c = vaerCfg(), v = viewOf(c), hn = c.hide_navbar === true;
    const seg = [['fullscreen', 'Fullskjerm', 'mdi:fullscreen'], ['sheet', 'Ark', 'mdi:card-outline']].map(([k, l, ic]) => { const on = k === v; return `<button role="radio" aria-checked="${on}" ${on ? 'data-active="1"' : ''} data-a="${act}" data-v="view:${k}" style="flex:1;min-width:0;height:40px;display:flex;align-items:center;justify-content:center;gap:6px;border:0;border-radius:20px;font:inherit;font-size:13px;font-weight:600;cursor:pointer;background:${on ? PINK : 'transparent'};color:${on ? 'var(--ki-on-accent, #2f2f2f)' : 'var(--ki-text-2, var(--gray800,#afafaf))'}">${M.icon(ic, 18)}${l}</button>`; }).join('');
    return `<div style="font-size:13px;color:var(--ki-text-mid, var(--gray700,#979797));padding:6px 4px 0">Vær · visning</div>
      <div role="radiogroup" data-vaer-view data-glass-drag="x" style="display:flex;gap:4px;padding:4px;border-radius:24px;background:var(--ki-surface-3, var(--gray100,#2f2f2f))">${seg}</div>
      <button data-a="${act}" data-v="nav:${hn ? 'off' : 'on'}" data-vaer-nav role="switch" aria-checked="${hn}" ${v === 'sheet' ? 'disabled aria-disabled="true"' : ''} style="display:flex;align-items:center;gap:12px;min-height:52px;padding:0 14px;border:0;border-radius:20px;font:inherit;font-size:14px;cursor:pointer;text-align:left;background:var(--ki-surface, var(--gray200,#3a3a3a));color:var(--ki-text, #fafafa);opacity:${v === 'sheet' ? 0.5 : 1}"><span style="flex:1;min-width:0">Skjul navbar i fullskjerm<span style="display:block;font-size:12px;color:var(--ki-text-3, var(--gray600,#7f7f7f))">${v === 'sheet' ? 'Ark skjuler navbaren som før' : 'Av = navbar og Now Playing vises over været'}</span></span><span style="position:relative;width:50px;height:30px;border-radius:15px;flex:none;background:${hn ? PINK : 'var(--ki-ctrl, #545454)'}"><i style="position:absolute;top:3px;left:${hn ? 23 : 3}px;width:24px;height:24px;border-radius:12px;background:var(--ki-knob, #fafafa)"></i></span></button>`;
  };

  /* ================================================================ «Tilpass Vær» (26.25 · ark portalet ut av popupen, MSH.overlay) */
  // Stil (Klassisk · Scene) · Steder (liste, fjern, «Legg til sted» med navn + weather.*-velger) · Seksjoner av/på
  // (Farevarsel, Neste timer, Døgnvarsel, Fliser) + Animasjoner · Fliser: «Tilbakestill rekkefølge».
  // Utkastflyten (MSH.draftEditor): endringer vises straks i kortet, lagres i kortets config ved Ferdig (rosa pille øverst
  // til høyre). Utenfor/Esc forkaster. Samme felter som GUI-editoren (stil, places, hide, tile_order, hero_fx).
  // Fiks 27 (27.4/27.8, fasit Vær v5 tp/places): header (ikon · «Tilpass Vær» · Ferdig) · Stil-segment · «Steder · hold og
  // dra for rekkefølge» (håndtak, live omorganisering, slett, trykk = bytt entitet) · «Legg til sted» (navn + søk i alle
  // weather.* på navn og ID, treff med ikon/navn/ID/temp, allerede lagt til dimmet) · Seksjoner (brytere) · Fliser.
  // Seksjonene har flex: none (ingenting klippes) – bare arket scroller.
  const STIL_IC = { klassisk: 'mdi:view-agenda', scene: 'mdi:image-filter-hdr' };
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
    const st = { busy: false, adding: false, edit: null, name: '', named: false, ent: '', q: '', drag: null };
    const hass = () => card.hass || card._hass;
    // Fiks 42: stedslisten = alle weather.* (auto) + places, uten exclude, i order-rekkefølge (også utilgjengelige, dimmet)
    const listOf = (D) => placesOf(hass(), D, { all: true });
    const apply = (patch, hap) => {
      if (st.busy) return;
      const next = { ...ctl.draft, ...patch };
      Object.keys(patch).forEach((k) => { if (patch[k] === undefined || (Array.isArray(patch[k]) && !patch[k].length)) delete next[k]; });
      ctl.set(next);
      if (hap) M.haptic(hap);
      draw();
    };
    // Valgt sted (stedsvelgeren) følger med når listen endres: lagres som entitets-ID (fjernet → standardstedet)
    const setPlaces = (patch, hap) => {
      const cur = card._place && card._place();
      apply(patch, hap);
      const L = placesOf(hass(), ctl.draft);
      card.setUI({ place: cur && L.some((p) => p.id === cur.id) ? cur.id : undefined });
      if (card._drawCtl) card._drawCtl();
    };
    const sw = (a, k, on, label) => `<button class="tsw${on ? ' on' : ''}" data-a="${a}" data-k="${k}" role="switch" aria-checked="${on}" aria-label="${esc(label)}"><i></i></button>`;
    const fname = (id) => wxName(hass(), id); // Fiks 42: områdenavn / friendly_name uten «Forecast »
    const fraw = (id) => { const s0 = hass() && hass().states[id]; return (s0 && s0.attributes.friendly_name) || id; };
    const candsHTML = () => {
      const h = hass(), L = listOf(ctl.draft), used = new Set(L.filter((p, i) => i !== st.edit).map((p) => p.entity)), q = st.q.toLowerCase().trim(); // fjernede (exclude) kan legges til igjen
      const all = M.all(h, 'weather').filter((id) => !q || id.toLowerCase().includes(q.replace(/ /g, '_')) || fname(id).toLowerCase().includes(q) || fraw(id).toLowerCase().includes(q));
      if (!all.length) return '<span class="none">Ingen treff</span>';
      return all.map((id) => {
        const s0 = h.states[id], cd = sceneOf(s0 && s0.state, false), t = s0 ? num(s0.attributes.temperature) : null, u = used.has(id);
        return `<button class="cd${st.ent === id ? ' on' : ''}${u ? ' used' : ''}" data-a="cand" data-k="${esc(id)}" ${u ? 'disabled aria-disabled="true"' : ''} aria-pressed="${st.ent === id}">${M.icon(cd.icon, 18, `color:${icoColT(cd.key)}`)}<span class="cdc"><span class="cdn ell">${esc(fname(id))}</span><span class="cdi ell">${esc(id)}${u ? ' · lagt til' : ''}</span></span><span class="cdt">${t != null ? Math.round(t) + '°' : '–'}</span></button>`;
      }).join('');
    };
    const addOk = () => !!(st.ent && st.name.trim());
    const refreshAdd = () => {
      const c = box.querySelector('.cands'); if (c) c.innerHTML = candsHTML();
      const b = box.querySelector('[data-a="add"]'); if (b) { b.disabled = !addOk(); b.classList.toggle('on', addOk()); }
    };
    const draw = () => {
      if (!ov) return;
      const sh = ov.root.querySelector('.sh'), top = sh ? sh.scrollTop : 0;
      const D = ctl.draft, stil = stilOf(D), hid = hiddenOf(D), fxOn = D.hero_fx !== false, L = listOf(D);
      box.innerHTML = `<div class="hd"><span class="hic">${M.icon('mdi:weather-partly-cloudy', 24)}</span><span class="tt">Tilpass Vær</span><button class="ok" data-a="done" ${st.busy ? 'disabled aria-busy="true"' : ''}>${st.busy ? 'Lagrer …' : 'Ferdig'}</button></div>
        <span class="cap">Stil</span>
        <div class="stl" role="radiogroup" data-glass-drag="x">${STIL.map(([k, l]) => `<button class="sto${stil === k ? ' on' : ''}" role="radio" aria-checked="${stil === k}" ${stil === k ? 'data-active="1"' : ''} data-a="stil" data-k="${k}">${M.icon(STIL_IC[k], 18)}${l}</button>`).join('')}</div>
        <span class="cap">Steder · hold og dra for rekkefølge</span>
        <div class="plist" data-plist>${L.map((p, i) => `<div class="pr${p.down ? ' down' : ''}" data-prow data-i="${i}" data-key="pl-${esc(p.entity)}">
            <span class="hdl" data-drag="${i}" aria-label="Dra for å endre rekkefølge">${M.icon('mdi:drag', 22)}</span>
            <button class="pe" data-a="edit" data-k="${i}" aria-label="Bytt entitet for ${esc(p.name || p.entity)}">${M.icon('mdi:map-marker', 20, 'color:var(--ki-text-2, #afafaf)')}<span class="col grow" style="min-width:0;line-height:1.25"><span class="rl ell">${esc(p.name || fname(p.entity))}</span><span class="rs ell">${esc(p.entity + (p.down ? ' · utilgjengelig' : p.src === 'auto' ? ' · automatisk' : ''))}</span></span></button>
            ${L.length > 1 ? `<button class="x" data-a="rm" data-k="${i}" aria-label="Fjern ${esc(p.name || p.entity)}">${M.icon('mdi:delete', 20)}</button>` : ''}</div>`).join('')}
          <button class="padd" data-a="openadd" aria-expanded="${st.adding}">${M.icon('mdi:map-marker-plus', 20)}<span>${st.edit != null ? 'Bytt entitet' : 'Legg til sted'}</span></button>
          ${st.adding ? `<div class="add">
            <input class="in" data-in="name" placeholder="Navn, f.eks. Hytta" value="${esc(st.name)}" autocomplete="off">
            <span class="lab">Vær-entitet</span>
            <div class="sr">${M.icon('mdi:magnify', 18, 'color:var(--ki-text-3, #7f7f7f)')}<input data-in="q" placeholder="Søk etter sted eller weather.* …" value="${esc(st.q)}" autocomplete="off" autocapitalize="off" spellcheck="false"></div>
            <div class="cands">${candsHTML()}</div>
            <button class="addb${addOk() ? ' on' : ''}" data-a="add" ${addOk() ? '' : 'disabled'}>${M.icon(st.edit != null ? 'mdi:check' : 'mdi:plus', 18)}${st.edit != null ? 'Lagre' : 'Legg til'}</button></div>` : ''}</div>
        <span class="cap">Seksjoner</span>
        <div class="rows">${HIDE.map(([k, l, ic]) => `<div class="r" data-key="sec-${k}">${M.icon(ic, 20, 'color:var(--ki-text-2, #afafaf)')}<span class="rl ell">${l}</span>${sw('sec', k, !hid.has(k), l)}</div>`).join('')}
          <div class="r">${M.icon('mdi:weather-snowy-rainy', 20, 'color:var(--ki-text-2, #afafaf)')}<span class="col grow" style="min-width:0"><span class="rl ell">Animasjoner</span><span class="rs2 ell">Regn, snø, lyn, sol og vind i Scene</span></span>${sw('fx', 'fx', fxOn, 'Animasjoner')}</div></div>
        <span class="cap">Fliser</span>
        <div class="tbox"><span class="tnote">Hold inne en flis og dra for å endre rekkefølgen.</span><button class="nb" data-a="treset" ${D.tile_order || D.tiles ? '' : 'disabled'}>${M.icon('mdi:restart', 18)}Tilbakestill rekkefølge</button></div>
        <button class="more" data-a="sensors">${M.icon('mdi:thermometer', 18)}Føles som og sikt</button>
        <button class="more" data-a="more">${M.icon('mdi:cog-outline', 18)}Entiteter og prognose</button>`;
      const seg = box.querySelector('.stl');
      if (seg && M.glassDrag) M.glassDrag(seg, { axis: 'x', touchAction: 'pan-y' });
      if (sh) sh.scrollTop = top;
    };
    ov = M.overlay({ html: '', css: SHEET_CSS, maxWidth: 440, tilpass: true, onClose: () => { ctl.dispose(); card._sheet = null; } });
    const box = document.createElement('div');
    box.className = 'vaer-sheet';
    Object.defineProperty(box, '_config', { get: () => ctl.draft });
    ov.body.appendChild(box);
    box.addEventListener('input', (e) => {
      const k = e.target.dataset && e.target.dataset.in;
      if (k === 'name') { st.name = e.target.value; st.named = !!st.name.trim(); refreshAdd(); }
      if (k === 'q') { st.q = e.target.value; refreshAdd(); }
    });
    // 27.8 · dra og slipp: håndtak (touch-action: none, stopPropagation – fallgruve 2), live omorganisering, haptic
    box.addEventListener('pointerdown', (e) => {
      const hd = e.target.closest && e.target.closest('[data-drag]');
      if (!hd || e.button || st.busy) return;
      e.preventDefault(); e.stopPropagation();
      const row = hd.closest('[data-prow]'), list = row.parentElement, id = e.pointerId;
      st.drag = row; row.classList.add('drag'); list.classList.add('dragging');
      M.haptic('medium');
      const mv = (ev) => {
        if (ev.pointerId !== id) return;
        ev.preventDefault(); ev.stopPropagation();
        const rs = [...list.querySelectorAll('[data-prow]')];
        let to = rs.findIndex((x) => { const b = x.getBoundingClientRect(); return ev.clientY < b.top + b.height / 2; });
        if (to < 0) to = rs.length - 1;
        const from = rs.indexOf(row);
        if (to === from) return;
        if (to > from) rs[to].after(row); else rs[to].before(row);
        M.haptic('selection');
      };
      const tm = (ev) => { if (ev.cancelable) ev.preventDefault(); ev.stopPropagation(); };
      const up = (ev) => {
        if (ev.pointerId !== id) return;
        window.removeEventListener('pointermove', mv, true); window.removeEventListener('pointerup', up, true); window.removeEventListener('pointercancel', up, true); window.removeEventListener('touchmove', tm, true);
        row.classList.remove('drag'); list.classList.remove('dragging'); st.drag = null;
        const L = listOf(ctl.draft), ord = [...list.querySelectorAll('[data-prow]')].map((x) => Number(x.dataset.i));
        if (ord.every((v, i) => v === i)) { M.haptic('light'); return draw(); }
        return setPlaces(placeOps.reorder(ctl.draft, ord.map((i) => L[i].id)), 'light');
      };
      window.addEventListener('pointermove', mv, true); window.addEventListener('pointerup', up, true); window.addEventListener('pointercancel', up, true);
      window.addEventListener('touchmove', tm, { capture: true, passive: false });
    });
    ov.root.addEventListener('click', (e) => {
      const el = e.target.closest && e.target.closest('[data-a]');
      if (!el || el.disabled) return;
      const a = el.dataset.a, k = el.dataset.k, D = ctl.draft, L = listOf(D);
      switch (a) {
        case 'done': return ctl.done();
        case 'stil': return stilOf(D) === k ? undefined : apply({ style: k, stil: undefined }, 'selection');
        case 'rm': { const p = L[Number(k)]; if (L.length < 2 || !p) return undefined; st.adding = false; st.edit = null; return setPlaces(placeOps.remove(D, p.id), 'medium'); } // → exclude
        case 'openadd': { st.adding = !st.adding || st.edit != null; st.edit = null; st.name = ''; st.named = false; st.ent = ''; st.q = ''; M.haptic('light'); draw(); const i = st.adding && box.querySelector('[data-in="name"]'); if (i) i.focus({ preventScroll: true }); return undefined; }
        case 'edit': { const p = L[Number(k)]; if (!p) return undefined; st.adding = true; st.edit = Number(k); st.name = p.name || ''; st.named = true; st.ent = p.entity; st.q = ''; M.haptic('light'); return draw(); }
        case 'cand': {
          st.ent = k; M.haptic('selection');
          if (!st.named || !st.name.trim()) { st.name = fname(k); const i = box.querySelector('[data-in="name"]'); if (i) i.value = st.name; } // navnet fylles med friendly_name (kan endres)
          return refreshAdd();
        }
        case 'add': {
          if (!addOk()) return undefined;
          const old = st.edit != null && L[st.edit] ? L[st.edit] : null, nm = st.name.trim();
          // navnet lagres bare når det avviker fra entitetens/områdets navn (ellers følger det HA)
          const name = nm && nm !== wxName(hass(), st.ent) ? nm : '';
          const patch = old ? placeOps.replace(D, old.id, st.ent, name) : placeOps.add(D, st.ent, name);
          st.adding = false; st.edit = null; st.name = ''; st.named = false; st.ent = ''; st.q = '';
          return setPlaces(patch, 'success');
        }
        case 'sec': {
          const was = hiddenOf(D).has(k); // 28.1: bryteren lagres i sections { k: true/false }
          return apply({ ...secPatch(D, k, was), hide: undefined }, 'selection');
        }
        case 'fx': return apply({ hero_fx: D.hero_fx === false }, 'selection');
        case 'treset': return apply({ tile_order: undefined, tiles: undefined }, 'medium');
        case 'more': return Promise.resolve(ctl.done()).then((r) => { if (ctl.closed) M.Card.prototype.customize.call(card, 'overrides'); return r; });
        case 'sensors': return Promise.resolve(ctl.done()).then((r) => { if (ctl.closed) M.Card.prototype.customize.call(card, 'sensors'); return r; }); // 56 H
        default: return undefined;
      }
    });
    card._sheet = { ov, st, box, draw: () => { if (!st.drag) draw(); } };
    draw();
    return card._sheet;
  }
  const PINKG = 'linear-gradient(145deg, rgb(242 133 201) -10%, rgb(245 205 198) 100%)';
  const SHEET_CSS = `
    .vaer-sheet{display:grid;grid-template-columns:minmax(0,1fr);align-content:start;gap:10px;padding-top:2px}
    .vaer-sheet>*{flex:none;min-width:0}
    .hd{display:flex;align-items:center;gap:12px;padding:4px 4px 6px}
    .hic{width:44px;height:44px;border-radius:22px;background:var(--ki-pill-bg, #e1e1e1);color:var(--ki-pill-fg, #2f2f2f);display:grid;place-items:center;flex:none}
    .tt{flex:1;min-width:0;font-size:20px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .ok{height:44px;padding:0 20px;border-radius:22px;background:${PINKG};color:var(--ki-on-accent, #3a3a3a);font-size:15px;font-weight:600;flex:none}
    .ok:active,.nb:active,.more:active,.x:active,.addb:active{transform:scale(.95)}
    .cap{font-size:12px;color:var(--ki-text-mid, #979797);padding:8px 6px 0}
    .stl{display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:4px;border-radius:24px;background:var(--ki-surface-3, #3a3a3a);position:relative;touch-action:pan-y}
    .sto{height:44px;border-radius:20px;display:flex;align-items:center;justify-content:center;gap:6px;font-size:14px;font-weight:500;background:transparent;color:var(--ki-text, #fafafa);transition:background .2s,color .2s}
    .sto.on{background:${PINKG};color:var(--ki-on-accent, #3a3a3a)}
    .stl .gd-lens{position:absolute;z-index:3;pointer-events:none}
    .plist{flex:none;display:flex;flex-direction:column;border-radius:24px;background:var(--ki-surface, #3a3a3a);overflow:hidden}
    .pr{display:flex;align-items:center;gap:12px;min-height:60px;padding:0 8px 0 16px;border-bottom:1px solid ${WA(0.05)};position:relative;background:transparent;transition:transform .15s,background .15s,box-shadow .15s}
    .pr.drag{z-index:2;background:var(--ki-surface-2, #404040);border-radius:18px;box-shadow:0 8px 24px ${BA(0.4)};transform:scale(1.02)}
    .hdl{width:32px;height:48px;margin-left:-10px;flex:none;display:grid;place-items:center;touch-action:none;cursor:grab;color:var(--ki-text-3, #7f7f7f);user-select:none;-webkit-user-select:none}
    .dragging .hdl{cursor:grabbing}
    .pr.down .pe{opacity:.5}
    .pe{flex:1;min-width:0;display:flex;align-items:center;gap:12px;min-height:56px;text-align:left}
    .rl{font-size:15px}
    .rs{font-size:11px;color:var(--ki-text-mid, #979797);font-family:ui-monospace,monospace}
    .rs2{font-size:12px;color:var(--ki-text-mid, #979797)}
    .x{width:44px;height:44px;border-radius:22px;display:grid;place-items:center;color:var(--ki-text-2, #afafaf);flex:none}
    .padd{display:flex;align-items:center;gap:12px;min-height:56px;padding:0 16px;text-align:left;color:var(--ki-pink-text, rgb(242 133 201));font-size:15px;font-weight:500}
    .add{display:flex;flex-direction:column;gap:8px;padding:12px;margin:0 8px 8px;border-radius:20px;background:var(--ki-surface-2, #404040);animation:vsf .2s ease}
    .in{height:48px;border-radius:16px;border:0;outline:0;background:var(--ki-surface, #2f2f2f);color:var(--ki-text, #fafafa);font:inherit;font-size:15px;padding:0 14px}
    .lab{font-size:12px;color:var(--ki-text-mid, #979797);padding:2px 4px 0}
    .sr{display:flex;align-items:center;gap:8px;height:44px;padding:0 12px;border-radius:14px;background:var(--ki-surface, #2f2f2f)}
    .sr input{flex:1;min-width:0;height:100%;border:0;outline:0;background:transparent;color:var(--ki-text, #fafafa);font:inherit;font-size:14px;padding:0}
    .cands{display:flex;flex-direction:column;gap:2px;max-height:200px;overflow-y:auto;overscroll-behavior:contain}
    .cd{display:flex;align-items:center;gap:10px;min-height:48px;padding:0 14px;border-radius:16px;text-align:left;color:var(--ki-text-1, #e1e1e1);background:transparent;flex:none}
    .cd.on{background:var(--ki-ctrl, #545454)}
    .cd.used{opacity:.4;cursor:default}
    .cdc{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
    .cdn{font-size:13px}
    .cdi{font-size:11px;color:var(--ki-text-mid, #979797);font-family:ui-monospace,monospace}
    .cdt{font-size:13px;color:var(--ki-text-1, #c7c7c7);flex:none}
    .none{padding:10px;font-size:12px;color:var(--ki-text-3, #7f7f7f)}
    .addb{height:48px;border-radius:24px;font-size:15px;font-weight:500;display:flex;align-items:center;justify-content:center;gap:8px;background:var(--ki-surface, #404040);color:var(--ki-text-3, #7f7f7f)}
    .addb.on{background:${PINKG};color:var(--ki-on-accent, #3a3a3a)}
    .rows{flex:none;display:flex;flex-direction:column;border-radius:24px;background:var(--ki-surface, #3a3a3a);overflow:hidden}
    .r{display:flex;align-items:center;gap:12px;min-height:56px;padding:0 16px;border-top:1px solid ${WA(0.05)}}
    .r>.rl{flex:1;min-width:0}
    .tsw{position:relative;width:50px;height:30px;border-radius:15px;flex:none;background:var(--ki-ctrl, #545454);transition:background .2s}
    .tsw i{position:absolute;top:3px;left:3px;width:24px;height:24px;border-radius:12px;background:var(--ki-knob, #fafafa);box-shadow:0 1px 3px ${BA(0.3)};transition:left .2s}
    .tsw.on{background:${PINKG}}
    .tsw.on i{left:23px}
    .tbox{flex:none;display:flex;flex-direction:column;gap:6px;padding:14px 16px;border-radius:24px;background:var(--ki-surface, #3a3a3a)}
    .tnote{font-size:14px;color:var(--ki-text-1, #c7c7c7);line-height:1.4;text-wrap:pretty}
    .nb{height:44px;border-radius:22px;background:var(--ki-surface-2, #404040);font-size:14px;font-weight:500;display:flex;align-items:center;justify-content:center;gap:8px}
    .nb:disabled{opacity:.5}
    .more{display:flex;align-items:center;justify-content:center;gap:8px;height:44px;margin-top:2px;border-radius:22px;background:var(--ki-surface, #3a3a3a);font-size:14px;font-weight:500;color:var(--ki-text-1, #c7c7c7)}
    @keyframes vsf{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
    @media (prefers-reduced-motion: reduce){.add{animation:none}}
  `;
})();
