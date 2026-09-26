/* msh-vaer-hero-card + msh-vaer-card · popup #vaer. Kilde: Vær v3.dc.html
 * Hero (eget kort, først): karusell «Været nå» / «Andre varsler» (sol, måne, UV) / «Pollen i dag» + prikker.
 * Hovedkort: farevarsler, time for time, (valgfri temperaturgraf med scrub), dagskort, detaljkort (8 fliser), månefase,
 * «Tilpass været». Rekkefølge/synlighet for seksjoner og fliser lagres i config (sections / tiles).
 * Prognose: hass.connection.subscribeMessage({ type: 'weather/subscribe_forecast' }) – KUN mens popupen er åpen.
 */
(function () {
  const M = window.MSH, esc = M.esc, C = M.C;
  const SUNY = C.yellow, CLOUD = 'var(--gray900, #c7c7c7)', MOON = 'var(--gray700, #979797)', RAIN = C.blue;
  // intern nøkkel → [Material-ikon, etikett, farge]
  const WX = { sun: ['clear_day', 'Sol', SUNY], moon: ['bedtime', 'Klarvær', MOON], part: ['partly_cloudy_day', 'Delvis skyet', SUNY], partn: ['partly_cloudy_night', 'Delvis skyet', MOON], cloud: ['cloud', 'Overskyet', CLOUD], rain: ['rainy', 'Regn', RAIN], sleet: ['weather_mix', 'Sludd', C.lightBlue], snow: ['weather_snowy', 'Snø', 'var(--white, #fafafa)'], fog: ['foggy', 'Tåke', CLOUD], thunder: ['thunderstorm', 'Torden', SUNY], wind: ['air', 'Kraftig vind', RAIN] };
  // HA-condition → [nøkkel, norsk etikett]
  const COND = { sunny: ['sun', 'Sol'], 'clear-night': ['moon', 'Klarvær'], partlycloudy: ['part', 'Delvis skyet'], cloudy: ['cloud', 'Overskyet'], rainy: ['rain', 'Regn'], pouring: ['rain', 'Kraftig regn'], snowy: ['snow', 'Snø'], 'snowy-rainy': ['sleet', 'Sludd'], hail: ['sleet', 'Hagl'], fog: ['fog', 'Tåke'], lightning: ['thunder', 'Torden'], 'lightning-rainy': ['thunder', 'Torden og regn'], windy: ['wind', 'Kraftig vind'], 'windy-variant': ['wind', 'Vind og skyer'], exceptional: ['cloud', 'Ekstremvær'] };
  const WXANIM = { clear_day: 'wx-spin 24s linear infinite, wx-glow 4s ease-in-out infinite', partly_cloudy_day: 'wx-drift 5s ease-in-out infinite', partly_cloudy_night: 'wx-drift 6s ease-in-out infinite', cloud: 'wx-drift 6s ease-in-out infinite', rainy: 'wx-bob 1.1s ease-in-out infinite', weather_mix: 'wx-sway 2.6s ease-in-out infinite', weather_snowy: 'wx-sway 3.4s ease-in-out infinite', foggy: 'wx-fade 4s ease-in-out infinite', thunderstorm: 'wx-flash 3.2s linear infinite', air: 'wx-drift 1.6s ease-in-out infinite', bedtime: 'wx-bob 5s ease-in-out infinite' };
  const KEYFRAMES = `
    @keyframes wx-spin{to{transform:rotate(360deg)}}
    @keyframes wx-glow{0%,100%{filter:drop-shadow(0 0 14px rgb(242 210 111 / .3))}50%{filter:drop-shadow(0 0 32px rgb(242 210 111 / .65))}}
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
    @keyframes wx-wind{0%{transform:translateX(-120%);opacity:0}20%{opacity:.7}100%{transform:translateX(320%);opacity:0}}
    @media (prefers-reduced-motion: reduce){ha-icon,.fx span{animation:none !important}}
  `;
  const f1 = (v) => M.nf(v, 1);
  const num = (v) => (v == null || v === '' || isNaN(Number(v)) ? null : Number(v));
  const hm = (t) => { const d = new Date(t); return `${M.pad(d.getHours())}:${M.pad(d.getMinutes())}`; };
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const wxIcon = (icon, size, color, extra = '') => M.icon(icon, size, `color:${color};animation:${WXANIM[icon] || 'none'};${extra}`);
  const compass = (b) => {
    if (b == null) return '';
    if (!M.isNum(b)) return String(b).replace(/W/g, 'V').replace(/E/g, 'Ø');
    return ['N', 'NØ', 'Ø', 'SØ', 'S', 'SV', 'V', 'NV'][Math.round(((Number(b) % 360) + 360) % 360 / 45) % 8];
  };

  /* ------------------------------------------------------------ prognose-abonnement (delt, refcount) */
  const SUBS = M.__wxSubs || (M.__wxSubs = new Map());
  M.wxForecast = M.wxForecast || function (hass, entity, type, cb) {
    const key = entity + '|' + type;
    let s = SUBS.get(key);
    if (!s) {
      s = { cbs: new Set(), data: null, unsub: null, dead: false };
      SUBS.set(key, s);
      try {
        const p = hass.connection.subscribeMessage((ev) => { s.data = (ev && ev.forecast) || []; s.cbs.forEach((f) => f(s.data)); }, { type: 'weather/subscribe_forecast', entity_id: entity, forecast_type: type });
        Promise.resolve(p).then((u) => { if (s.dead) { try { u(); } catch (e) { /* */ } } else s.unsub = u; }).catch(() => { s.data = s.data || []; s.cbs.forEach((f) => f(s.data)); });
      } catch (e) { s.data = []; }
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

  /* ------------------------------------------------------------ autokonfig */
  const ALERT_PLAT = ['met_alerts', 'metalerts', 'norway_alerts', 'met_warnings', 'varsom', 'meteoalarm'];
  M.vaerAuto = function (hass, cfg) {
    cfg = cfg || {};
    if (!hass) return { weather: null, sun: null, moon: null, pollen: [], pollenAuto: [], alerts: [], alertAuto: [] };
    const weather = M.pick(cfg, 'weather', M.all(hass, 'weather')[0] || null);
    const sun = M.pick(cfg, 'sol', M.all(hass, 'sun')[0] || null);
    const moon = M.pick(cfg, 'mane', M.byPlatform(hass, 'moon', 'sensor')[0] || M.all(hass, 'sensor', (s) => s.attributes.device_class === 'enum' && Array.isArray(s.attributes.options) && s.attributes.options.includes('full_moon'))[0] || null);
    const pollenAuto = M.all(hass, 'sensor', (s, id) => { const p = (M.regEntry(hass, id) || {}).platform || ''; return (/pollen/.test(id) || /pollen|naaf/.test(p)) && !/tomorrow|i_morgen|imorgen/.test(id); });
    const alertAuto = M.all(hass, ['sensor', 'binary_sensor'], (s, id) => ALERT_PLAT.includes((M.regEntry(hass, id) || {}).platform) || /farevarsel|met_?alert|norway_alert|varsom|meteoalarm/.test(id));
    return { weather, sun, moon, pollenAuto, pollen: M.applyLists(cfg, 'pollen', pollenAuto).filter((id) => hass.states[id]), alertAuto, alerts: M.applyLists(cfg, 'varsler', alertAuto).filter((id) => hass.states[id]) };
  };
  const condOf = (c, night) => { const k = (COND[c] || ['cloud', c ? String(c) : '–']); let key = k[0]; if (night && key === 'part') key = 'partn'; if (night && key === 'sun') key = 'moon'; return { key, label: k[1], icon: WX[key][0], color: WX[key][2] }; };
  // Soltider: i dag (tilnærmet ut fra next_rising / next_setting).
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
    const p = ((((Date.now() - Date.UTC(2000, 0, 6, 18, 14)) / 86400000) / 29.530588853) % 1 + 1) % 1;
    const i = p < 0.0339 || p > 0.9661 ? 0 : p < 0.216 ? 1 : p < 0.284 ? 2 : p < 0.466 ? 3 : p < 0.534 ? 4 : p < 0.716 ? 5 : p < 0.784 ? 6 : 7;
    return { name: MOON_N[i][1], p, computed: true };
  };
  const moonDisc = (p, size) => {
    const k = (1 - Math.cos(2 * Math.PI * p)) / 2, dark = (1 - k) * 100, wax = p < 0.5;
    return `<div class="moon" style="width:${size}px;height:${size}px"><div style="position:absolute;top:0;bottom:0;${wax ? 'left:0' : 'right:0'};width:${dark.toFixed(1)}%;background:#16161a;box-shadow:${wax ? '6px' : '-6px'} 0 14px rgba(0,0,0,0.5)"></div></div>`;
  };
  const uvOf = (v) => (v == null ? ['–', 'var(--gray600, #7f7f7f)'] : v < 1 ? ['Svært lav', C.green] : v < 3 ? ['Lav', C.green] : v < 6 ? ['Moderat', C.yellow] : v < 8 ? ['Høy', C.orange] : v < 11 ? ['Svært høy', C.red] : ['Ekstrem', C.purple]);
  const heroFx = (k) => {
    const P = [], rnd = (i) => (i * 37) % 100;
    const drops = (n, col, dur) => { for (let i = 0; i < n; i++) P.push(`left:${rnd(i)}%;top:0;width:2px;height:16px;border-radius:1px;background:${col};animation:wx-rain ${(dur + (i % 5) * 0.12).toFixed(2)}s linear ${(-((i * 0.17) % 1.2)).toFixed(2)}s infinite`); };
    const flakes = (n, dur) => { for (let i = 0; i < n; i++) { const sz = 4 + (i % 3) * 2; P.push(`left:${rnd(i)}%;top:0;width:${sz}px;height:${sz}px;border-radius:${sz / 2}px;background:rgba(250,250,250,0.85);animation:wx-snow ${(dur + (i % 4) * 0.9).toFixed(2)}s linear ${(-((i * 0.6) % 5)).toFixed(2)}s infinite`); } };
    const rain = M.alpha(C.blue, 0.55);
    if (k === 'rain' || k === 'thunder') drops(26, rain, 0.7);
    if (k === 'sleet') { drops(14, M.alpha(C.blue, 0.5), 0.8); flakes(12, 3.4); }
    if (k === 'snow') flakes(28, 4.2);
    if (k === 'fog') [18, 62, 108, 150].forEach((y, i) => P.push(`left:-30%;top:${y}px;width:160%;height:36px;border-radius:18px;background:linear-gradient(90deg, transparent, rgba(220,220,220,0.16), rgba(220,220,220,0.22), transparent);filter:blur(6px);animation:wx-fog ${7 + i * 1.5}s ease-in-out ${-i * 2}s infinite alternate`));
    if (k === 'thunder') P.push('inset:0;background:rgba(255,255,240,0.5);animation:wx-bolt 4.5s linear infinite');
    if (k === 'sun') P.push(`right:-60px;top:-60px;width:300px;height:300px;border-radius:150px;background:radial-gradient(circle, ${M.alpha(C.yellow, 0.28)}, transparent 65%);animation:wx-ray 5s ease-in-out infinite`);
    if (k === 'part' || k === 'cloud' || k === 'partn') [[-10, 20, 220], [40, 90, 260]].forEach(([x, y, w], i) => P.push(`left:${x}%;top:${y}px;width:${w}px;height:70px;border-radius:35px;background:rgba(255,255,255,${k === 'cloud' ? 0.07 : 0.05});filter:blur(10px);animation:wx-drift ${8 + i * 3}s ease-in-out infinite`));
    if (k === 'wind') for (let i = 0; i < 7; i++) P.push(`left:0;top:${20 + i * 24}px;width:${90 + (i % 3) * 40}px;height:2px;border-radius:1px;background:linear-gradient(90deg, transparent, rgba(220,230,245,0.45), transparent);animation:wx-wind ${(1.4 + (i % 4) * 0.3).toFixed(1)}s linear ${(-i * 0.4).toFixed(1)}s infinite`);
    return P.map((s) => `<span style="position:absolute;${s}"></span>`).join('');
  };
  // Horisontal sveip (karusell/timeliste): la nettleseren scrolle, men stopp Bubble Cards swipe-to-close.
  const guardSwipe = (el) => {
    if (!el || el.__mshSwipe) return;
    el.__mshSwipe = true;
    el.style.touchAction = 'pan-x pan-y';
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
    if (!st) return 0;
    const s = String(st.state).toLowerCase();
    if (M.isNum(s)) return M.clamp(Math.round(Number(s)), 0, 4);
    return /ekstrem|extreme|very.?high/.test(s) ? 4 : /kraftig|severe|high|høy/.test(s) ? 3 : /moderat|moderate|middels|medium/.test(s) ? 2 : /beskjeden|low|lav|lite/.test(s) ? 1 : 0;
  };
  const PL = [['Ingen', 'var(--gray600, #7f7f7f)'], ['Beskjeden', C.green], ['Moderat', C.yellow], ['Kraftig', C.orange], ['Ekstrem', C.red]];
  const POLLEN = [[/hassel|hazel/, 'Hassel', 'nature'], [/(^|_)or(_|$)|alder|older/, 'Or', 'forest'], [/salix|selje|willow|vier/, 'Salix', 'spa'], [/bjork|bjørk|birch/, 'Bjørk', 'park'], [/gress|grass/, 'Gress', 'grass'], [/burot|mugwort|artemisia/, 'Burot', 'eco']];

  /* ================================================================ hero */
  class VaerHero extends Forecast(M.Card) {
    static get cardName() { return 'Vær · toppkort'; }
    static get defaults() { return { show_extras: true, show_pollen: true }; }
    static get schema() {
      return (h, c) => [
        { type: 'text', name: 'name', label: 'Stedsnavn', auto: (hh) => (hh.config && hh.config.location_name) || null, placeholder: 'Fra HA / værentiteten' },
        { type: 'overrides', label: 'Bytt entiteter', fields: [
          { name: 'weather', label: 'Værmelding', domain: 'weather', auto: (hh) => M.all(hh, 'weather')[0] || null },
          { name: 'sol', label: 'Sol', domain: 'sun', auto: (hh) => M.all(hh, 'sun')[0] || null },
          { name: 'mane', label: 'Månefase', domain: 'sensor', auto: (hh, cc) => M.vaerAuto(hh, { ...cc, overrides: {} }).moon },
        ] },
        { type: 'lists', label: 'Pollen', lists: (hh, cc) => [{ key: 'pollen', label: 'Pollensensorer', ids: M.vaerAuto(hh, cc).pollenAuto, domains: ['sensor'] }] },
        { type: 'section', label: 'Visning', icon: 'mdi:eye-outline', id: 'view', fields: [
          { type: 'boolean', name: 'show_extras', label: 'Side 2 · Andre varsler (sol, måne, UV)', default: true },
          { type: 'boolean', name: 'show_pollen', label: 'Side 3 · Pollen i dag', default: true },
        ] },
      ];
    }
    get cardSize() { return 4; }
    render() {
      const c = this.config, h = this.hass, a = M.vaerAuto(h, c);
      this._checkEnt(a.weather);
      const st = this.s(a.weather), A = (st && st.attributes) || {};
      const sunSt = this.s(a.sun), sun = sunTimes(sunSt), moon = moonOf(this.s(a.moon));
      a.pollen.forEach((id) => this.s(id));
      const night = sunSt ? sunSt.state === 'below_horizon' : isNight(Date.now(), null);
      const cond = st ? condOf(st.state, night) : null;
      const H = this.hourly, today = todayOf(this.daily);
      const place = c.name || (h.config && h.config.location_name) || (st ? M.name(h, a.weather) : '–');
      const temp = st ? num(A.temperature) : null;
      const feels = today && num(today.temperature) != null ? `H ${Math.round(today.temperature)}° · L ${today.templow != null ? Math.round(today.templow) + '°' : '–'}` : num(A.apparent_temperature) != null ? `Føles ${f1(A.apparent_temperature)}°` : '';
      const wu = A.wind_speed_unit || 'm/s', pu = A.precipitation_unit || 'mm';
      const wind = num(A.wind_speed) != null ? `${f1(A.wind_speed)} ${wu} ${compass(A.wind_bearing)}`.trim() : '';
      const rain = H[0] && num(H[0].precipitation) != null ? `${f1(H[0].precipitation)} ${pu}` : '';
      const uv = num(A.uv_index) != null ? num(A.uv_index) : H[0] && num(H[0].uv_index) != null ? num(H[0].uv_index) : null;
      const col = cond ? cond.color : 'var(--gray600, #7f7f7f)';
      const glow = !cond || cond.key === 'sun' ? '' : `filter:drop-shadow(0 0 20px ${/gray|white/.test(col) ? 'rgba(255,255,255,0.15)' : M.alpha(col, 0.3)})`;
      const slides = [];
      slides.push(`<div class="sl now" data-key="s0" ${a.weather ? `data-ent="${esc(a.weather)}"` : ''}>
        <div class="fx">${cond ? heroFx(cond.key) : ''}</div>
        <span class="pl">Været nå · ${esc(place)}</span>
        <span class="tv"><span class="big num">${temp != null ? f1(temp) : '–'}°</span>${feels ? `<span class="fl">${esc(feels)}</span>` : ''}</span>
        <span class="meta">${st ? `<span>${esc(cond.label)}</span>${wind ? `<span>${esc(wind)}</span>` : ''}${rain ? `<span>${esc(rain)}</span>` : ''}` : `<button class="pick press" data-act="customize" data-section="overrides">${M.icon('mdi:plus', 18)}Velg entitet</button>`}</span>
        <span class="hi">${wxIcon(cond ? cond.icon : 'cloud', 120, col, glow)}</span>
      </div>`);
      if (c.show_extras !== false) {
        const uvL = uvOf(uv);
        const X = [['mdi:weather-sunset-up', sun ? hm(sun.rise) : '–', C.orange, 'wb_twilight'], ['mdi:weather-sunset-down', sun ? hm(sun.set) : '–', C.pink, 'wb_twilight'], ['bedtime', moon.name, MOON, 'bedtime'], ['light_mode', uv != null ? `UV ${uvL[0].toLowerCase()} (${f1(uv)})` : 'UV –', SUNY, 'clear_day']];
        slides.push(`<div class="sl ex" data-key="s1"><span class="pl" style="padding:0 8px">Andre varsler</span>
          <div class="exg">${X.map(([ic, lab, co, an]) => `<div class="ext">${M.icon(ic, 30, `color:${co};animation:${WXANIM[an] || 'none'}`)}<span>${esc(lab)}</span></div>`).join('')}</div></div>`);
      }
      if (c.show_pollen !== false) {
        const src = a.pollen.length ? (h.states[a.pollen[0]].attributes.attribution || '') : '';
        const P = a.pollen.slice(0, 6).map((id) => {
          const ps = h.states[id], lv = pollenLevel(ps), key = (id + ' ' + (ps.attributes.friendly_name || '')).toLowerCase();
          const hit = POLLEN.find((p) => p[0].test(key));
          return { id, name: hit ? hit[1] : M.name(h, id).replace(/pollen/i, '').trim() || M.name(h, id), icon: hit ? hit[2] : 'grass', lv };
        });
        slides.push(`<div class="sl po" data-key="s2"><span class="ph"><span class="pl">Pollen i dag</span><span class="src ell">${esc(String(src).slice(0, 24))}</span></span>
          ${P.length ? `<div class="pg">${P.map((p) => `<div class="pt" data-ent="${esc(p.id)}" data-key="${esc(p.id)}">${M.icon(p.icon, 20, `color:${PL[p.lv][1]}`)}<span class="col" style="min-width:0"><span class="pn ell">${esc(p.name)}</span><span style="font-size:10px;color:${PL[p.lv][1]}">${PL[p.lv][0]}</span></span></div>`).join('')}</div>`
            : `<div class="pe">${M.icon('mdi:flower-pollen-outline', 22, 'color:var(--gray700, #979797)')}<span>Fant ingen pollensensorer</span><button class="pick press" data-act="customize" data-section="entities">${M.icon('mdi:plus', 18)}Velg entitet</button></div>`}</div>`);
      }
      const cur = Math.min(this.ui.hero || 0, slides.length - 1);
      return `<section class="hero">
        <div class="car noscroll">${slides.join('')}</div>
        ${slides.length > 1 ? `<div class="dots">${slides.map((_, i) => `<button class="dt" data-act="slide" data-i="${i}" data-haptic="selection" style="width:${i === cur ? 12 : 10}px;height:${i === cur ? 12 : 10}px;background:${i === cur ? 'var(--gray600, #7f7f7f)' : 'var(--gray400, #545454)'}"></button>`).join('')}</div>` : ''}
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
    afterRender() {
      const car = this.shadowRoot.querySelector('.car');
      if (!car || car.__b) return;
      car.__b = true;
      guardSwipe(car);
      car.addEventListener('scroll', () => {
        const n = Math.round(car.scrollLeft / Math.max(1, car.clientWidth));
        if (n !== (this.ui.hero || 0)) { M.haptic('selection'); this.setUI({ hero: n }); }
      }, { passive: true });
    }
    get styles() {
      return `${KEYFRAMES}
        .hero{display:flex;flex-direction:column;align-items:center;gap:10px}
        .car{width:100%;display:flex;overflow-x:auto;scroll-snap-type:x mandatory;border-radius:28px;overscroll-behavior-x:contain}
        .sl{flex:none;width:100%;scroll-snap-align:start;min-height:190px;border-radius:28px;background:var(--gray200,#3a3a3a);display:flex;flex-direction:column}
        .now{position:relative;padding:22px 24px;justify-content:space-between}
        .fx{position:absolute;inset:0;overflow:hidden;border-radius:28px;pointer-events:none}
        .pl{position:relative;z-index:1;font-size:14px;color:var(--gray900,#c7c7c7)}
        .tv{position:relative;z-index:1;display:flex;align-items:flex-end;gap:6px}
        .big{font-size:64px;font-weight:300;letter-spacing:-0.04em;line-height:1}
        .fl{font-size:15px;color:var(--gray800,#afafaf);padding-bottom:6px;white-space:nowrap}
        .meta{position:relative;z-index:1;display:flex;gap:14px;font-size:14px;color:var(--gray900,#c7c7c7);white-space:nowrap}
        .hi{position:absolute;right:20px;top:50%;transform:translateY(-50%);line-height:0;pointer-events:none}
        .ex,.po{padding:20px 16px 16px}
        .ex{gap:14px}
        .po{gap:12px}
        .exg{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
        .ext{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;height:112px;border-radius:22px;background:var(--gray300,#404040);min-width:0}
        .ext span{font-size:12px;color:var(--gray900,#c7c7c7);text-align:center;line-height:1.25;padding:0 4px}
        .ph{display:flex;justify-content:space-between;align-items:baseline;gap:8px;padding:0 8px}
        .src{font-size:11px;color:var(--gray600,#7f7f7f)}
        .pg{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
        .pt{display:flex;align-items:center;gap:8px;height:53px;padding:0 10px;border-radius:18px;background:var(--gray300,#404040);min-width:0}
        .pn{font-size:12px;font-weight:500}
        .pe{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;font-size:13px;color:var(--gray700,#979797)}
        .dots{display:flex;gap:8px;height:14px;align-items:center}
        .dt{border-radius:6px;transition:background .2s}
      `;
    }
  }
  M.define('msh-vaer-hero-card', VaerHero, 'MSH Vær · toppkort', 'Været nå med animasjon, sol/måne/UV og pollen i en sveipbar karusell. Først i #vaer.');

  /* ================================================================ hovedkort */
  const SECS = [['alerts', 'Farevarsler'], ['hours', 'Time for time'], ['graph', 'Temperaturgraf'], ['days', 'Dagskort'], ['tiles', 'Detaljkort'], ['moon', 'Månefase'], ['edit', 'Tilpass-knapp']];
  const TILES = [['sky', 'Skydekke'], ['wind', 'Vind'], ['gust', 'Vindkast'], ['sun', 'Sol opp og ned'], ['hum', 'Fukt'], ['uv', 'UV-indeks'], ['press', 'Trykk'], ['rain', 'Nedbør']];
  const LV = { 1: ['Grønt', C.green], 2: ['Gult', C.yellow], 3: ['Oransje', C.orange], 4: ['Rødt', C.red], 5: ['Svart', 'var(--white, #fafafa)'] };
  const ATYPE = [[/snøskred|avalanche/, 'ac_unit'], [/skogbrann|forest.?fire|brann/, 'local_fire_department'], [/stormflo|storm.?surge|kyst|coast/, 'waves'], [/jord|landslide|skred/, 'mdi:landslide'], [/flom|flood/, 'flood'], [/ising|ice|polar/, 'severe_cold'], [/torden|lightning|thunder/, 'thunderstorm'], [/snø|snow|blowing/, 'weather_snowy'], [/regn|rain/, 'rainy'], [/vind|wind|gale|storm/, 'air']];
  const whenTxt = (t) => {
    if (!t || isNaN(t)) return '';
    const d = new Date(t), now = new Date();
    if (d.toDateString() === now.toDateString()) return 'i dag ' + hm(t);
    return d.toLocaleDateString('nb-NO', { weekday: 'short' }).replace('.', '') + ' ' + hm(t);
  };
  // Farevarsler fra met_alerts / norway_alerts o.l. – leses defensivt.
  function parseAlerts(hass, id) {
    const st = hass.states[id];
    if (!st || M.unavailable(st)) return [];
    const A = st.attributes || {}, plat = (M.regEntry(hass, id) || {}).platform || '';
    const list = Array.isArray(A.alerts) ? A.alerts : Array.isArray(A.warnings) ? A.warnings : (A.title || A.awareness_level || A.event || A.level != null) ? [A] : [];
    return list.map((x, i) => {
      if (!x || typeof x !== 'object') return null;
      const lvRaw = x.awareness_level != null ? x.awareness_level : x.level != null ? x.level : x.color || x.level_color || x.severity;
      let lv = parseInt(lvRaw, 10);
      if (isNaN(lv)) { const s = String(lvRaw || '').toLowerCase(); lv = /red|rød|extreme/.test(s) ? 4 : /orange|severe/.test(s) ? 3 : /yellow|gul|moderate/.test(s) ? 2 : /green|grønn|minor/.test(s) ? 1 : 0; }
      const txt = [x.event, x.awareness_type, x.title, x.event_awareness_name, x.headline].filter(Boolean).join(' ').toLowerCase();
      const ty = ATYPE.find((t) => t[0].test(txt));
      const from = new Date(x.starttime || x.start || x.onset || x.effective || x.valid_from || '').getTime();
      const to = new Date(x.endtime || x.end || x.expires || x.valid_to || '').getTime();
      const blocks = [['Råd', x.instruction || x.advice], ['Konsekvenser', x.consequences], ['Område', x.area || x.area_desc || x.municipality || x.county]].filter((b) => b[1]).map(([l, v]) => [l, Array.isArray(v) ? v.join(', ') : String(v)]);
      const src = /nve|varsom/.test(plat + ' ' + (x.source || '')) ? 'NVE · Varsom' : /met/.test(plat + ' ' + (x.source || '')) || plat === 'norway_alerts' ? 'Met.no' : (x.source || plat || 'Varsel');
      return { key: `${id}#${i}`, ent: id, lv: M.clamp(lv, 0, 5), icon: ty ? ty[1] : 'warning', title: x.title || x.headline || x.event_awareness_name || x.event || M.name(hass, id), from, to, status: !isNaN(from) && from > Date.now() ? 'Ventet' : 'Pågår', text: x.description || '', blocks, src: `${src} · ${id}`, url: x.map_url || x.web || x.url || (Array.isArray(x.resources) && x.resources[0] && (x.resources[0].uri || x.resources[0].url)) || '' };
    }).filter((x) => x && x.lv > 1);
  }

  class Vaer extends Forecast(M.Card) {
    static get cardName() { return 'Vær'; }
    static get defaults() { return { hours: 12, days: 7, show_graph: false }; }
    static get schema() {
      return () => [
        { type: 'overrides', label: 'Bytt entiteter', fields: [
          { name: 'weather', label: 'Værmelding', domain: 'weather', auto: (hh) => M.all(hh, 'weather')[0] || null },
          { name: 'sol', label: 'Sol', domain: 'sun', auto: (hh) => M.all(hh, 'sun')[0] || null },
          { name: 'mane', label: 'Månefase', domain: 'sensor', auto: (hh, cc) => M.vaerAuto(hh, { ...cc, overrides: {} }).moon },
        ] },
        { type: 'order', name: 'sections', hiddenName: 'hidden_sections', label: 'Seksjoner', options: SECS },
        { type: 'order', name: 'tiles', hiddenName: 'hidden_tiles', label: 'Detaljkort', options: TILES },
        { type: 'section', label: 'Prognose', icon: 'mdi:calendar-clock', id: 'forecast', fields: [
          { type: 'number', name: 'hours', label: 'Timer i «Time for time»', min: 3, max: 48, placeholder: '12' },
          { type: 'number', name: 'days', label: 'Antall dagskort', min: 1, max: 10, placeholder: '7' },
          { type: 'boolean', name: 'show_graph', label: 'Temperaturgraf med scrub (neste 24 t)', default: false },
        ] },
        { type: 'lists', label: 'Farevarsler', lists: (hh, cc) => [{ key: 'varsler', label: 'Varselsensorer (Met.no / NVE)', ids: M.vaerAuto(hh, cc).alertAuto, domains: ['sensor', 'binary_sensor'] }] },
        { type: 'gap' },
      ];
    }
    get cardSize() { return 12; }
    render() {
      const c = this.config, h = this.hass, a = M.vaerAuto(h, c), ui = this.ui;
      this._checkEnt(a.weather);
      const st = this.s(a.weather), A = (st && st.attributes) || {};
      const sunSt = this.s(a.sun), sun = sunTimes(sunSt), moon = moonOf(this.s(a.moon));
      a.alerts.forEach((id) => this.s(id));
      const H = this.hourly, Dl = this.daily, loaded = !!this._fc;
      const wu = A.wind_speed_unit || 'm/s', pu = A.precipitation_unit || 'mm', tu = '°';
      const sec = {};
      // Farevarsler
      const AL = a.alerts.flatMap((id) => parseAlerts(h, id)).sort((x, y) => y.lv - x.lv);
      if (AL.length) {
        sec.alerts = `<section class="sec">
          <div class="ah"><span class="row" style="gap:6px;font-size:13px;color:var(--gray700,#979797)">${M.icon('warning', 16)}Farevarsler · ${AL.filter((x) => x.status === 'Pågår').length} pågår · ${AL.filter((x) => x.status === 'Ventet').length} ventet</span>
            <span class="row">${AL.map((x, i) => `<span class="ac" style="background:${LV[x.lv][1]};margin-left:${i ? -7 : 0}px;z-index:${10 - i}">${M.icon(x.icon, 15)}</span>`).join('')}</span></div>
          ${AL.map((x) => {
            const col = LV[x.lv][1], open = ui.alertOpen === x.key;
            return `<button class="al" data-act="alert" data-k="${esc(x.key)}" data-key="${esc(x.key)}" data-ent="${esc(x.ent)}" data-haptic="selection" style="background:${M.alpha(col, 0.12)};box-shadow:inset 0 0 0 1px ${M.alpha(col, 0.35)}">
              <span class="row" style="align-items:flex-start;gap:12px;width:100%">
                <span class="aiw" style="background:${col}">${M.icon(x.icon, 22)}</span>
                <span class="grow col" style="gap:3px;text-align:left">
                  <span class="row" style="gap:6px;flex-wrap:wrap"><span class="lb" style="background:${M.alpha(col, 0.22)};color:${col}">${LV[x.lv][0]} nivå</span><span style="font-size:11px;color:${x.status === 'Pågår' ? 'var(--white, #fafafa)' : 'var(--gray700, #979797)'}">${x.status}</span></span>
                  <span style="font-size:14px;font-weight:600;line-height:1.3">${esc(x.title)}</span>
                  <span style="font-size:12px;color:var(--gray700,#979797)">${esc([whenTxt(x.from), whenTxt(x.to)].filter(Boolean).join(' – '))}</span>
                </span>
                ${M.icon('expand_more', 22, `color:var(--gray700, #979797);transition:transform .2s;transform:${open ? 'rotate(180deg)' : 'none'}`)}
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
      // Time for time
      const nH = Math.max(3, Math.min(48, Number(c.hours) || 12));
      const hrs = H.slice(0, nH);
      sec.hours = `<div class="hrs noscroll">${hrs.length ? hrs.map((f, i) => {
        const t = new Date(f.datetime).getTime(), cd = condOf(f.condition, f.is_daytime != null ? !f.is_daytime : isNight(t, sun));
        return `<div class="hb ${i ? '' : 'first'}" data-key="h${i}"><span class="ht">${i ? `${M.pad(new Date(t).getHours())}:00` : 'Nå'}</span>${wxIcon(cd.icon, 30, cd.color)}<span class="htv num">${f1(f.temperature)}°</span>
          <span class="hx"><span>${num(f.wind_speed) != null ? `${f1(f.wind_speed)} ${esc(wu)}` : '–'}</span><span>${num(f.precipitation) != null ? `${f1(f.precipitation)} ${esc(pu)}` : '–'}</span></span></div>`;
      }).join('') : `<div class="hb ph">${esc(!st ? 'Ingen værmelding' : loaded || !this.isOpen ? 'Ingen timeprognose' : 'Henter prognose …')}</div>`}</div>`;
      // Temperaturgraf (valgfri) med scrub
      if (c.show_graph) {
        const G = H.slice(0, 25).map((f) => ({ t: new Date(f.datetime).getTime(), v: num(f.temperature) })).filter((p) => p.v != null);
        const sel = ui.gsel != null ? Math.min(ui.gsel, G.length - 1) : 0;
        let pts = '0,60 300,60';
        if (G.length > 1) {
          const mn = Math.min(...G.map((p) => p.v)) - 0.5, mx = Math.max(...G.map((p) => p.v)) + 0.5;
          pts = G.map((p, i) => `${((i / (G.length - 1)) * 300).toFixed(1)},${(92 - ((p.v - mn) / (mx - mn)) * 72).toFixed(1)}`).join(' ');
        }
        const cur = G[sel];
        sec.graph = `<section class="gr">
          <div class="gh"><span class="row" style="gap:6px;font-size:12px;color:var(--gray700,#979797)">${M.icon('thermometer', 16)}Temperatur · neste 24 t</span><span class="num" style="font-size:14px;font-weight:500">${cur ? `${f1(cur.v)}° · ${sel ? 'kl ' + hm(cur.t) : 'nå'}` : '–'}</span></div>
          <div class="gw"><svg viewBox="0 0 300 100" preserveAspectRatio="none"><polyline points="0,100 ${pts} 300,100" style="fill:${M.alpha(SUNY, 0.18)};stroke:none"></polyline><polyline points="${pts}" fill="none" style="stroke:${SUNY};stroke-width:2" stroke-linejoin="round" vector-effect="non-scaling-stroke"></polyline></svg>
            ${G.length > 1 ? `<div class="gc" style="left:${(sel / (G.length - 1)) * 100}%"></div>` : ''}<div class="scrub"></div></div>
        </section>`;
      }
      // Dagskort
      const nD = Math.max(1, Math.min(10, Number(c.days) || 7));
      const days = (todayOf(Dl) ? Dl.slice(1) : Dl).slice(0, nD);
      sec.days = days.length ? days.map((f, i) => {
        const t = new Date(f.datetime), cd = condOf(f.condition, false), key = 'd' + t.toDateString(), open = ui.dayOpen === key;
        return `<button class="day" data-act="day" data-k="${esc(key)}" data-key="${esc(key)}" data-haptic="selection">
          <span class="row" style="width:100%">
            <span class="grow col" style="gap:4px;text-align:left"><span style="font-size:14px;color:var(--gray900,#c7c7c7)">${esc(cap(t.toLocaleDateString('nb-NO', { weekday: 'long' })))}</span>
              <span class="row" style="align-items:baseline;gap:8px"><span class="dhi num">${f1(f.temperature)}°</span><span class="dlo num">${f.templow != null ? f1(f.templow) + '°' : ''}</span></span>
              <span class="row" style="gap:12px;font-size:13px;color:var(--gray900,#c7c7c7)"><span>${esc(cd.label)}</span><span>${num(f.precipitation) != null ? `${f1(f.precipitation)} ${esc(pu)}` : ''}</span></span></span>
            ${wxIcon(cd.icon, 64, cd.color)}
          </span>
          ${open ? `<span class="dm">${[['Vind', num(f.wind_speed) != null ? `${f1(f.wind_speed)} ${wu}` : '–'], ['Lavest', f.templow != null ? `${f1(f.templow)}°` : '–'], ['Nedbør', num(f.precipitation) != null ? `${f1(f.precipitation)} ${pu}` : '–']].map(([l, v]) => `<span class="col" style="gap:2px;text-align:left"><span style="font-size:11px;color:var(--gray600,#7f7f7f)">${l}</span><span style="font-size:14px;font-weight:500">${esc(v)}</span></span>`).join('')}</span>` : ''}
        </button>`;
      }).join('') : `<div class="day ph">${esc(!st ? 'Ingen værmelding' : loaded || !this.isOpen ? 'Ingen dagsprognose' : 'Henter prognose …')}</div>`;
      // Detaljkort
      const cc = num(A.cloud_coverage) != null ? num(A.cloud_coverage) : H[0] ? num(H[0].cloud_coverage) : null;
      const ccL = cc == null ? '–' : cc < 12.5 ? 'Klarvær' : cc < 37.5 ? 'Lettskyet' : cc < 62.5 ? 'Delvis skyet' : cc < 87.5 ? 'Skyet' : 'Overskyet';
      const ws = num(A.wind_speed), gust = num(A.wind_gust_speed) != null ? num(A.wind_gust_speed) : H[0] ? num(H[0].wind_gust_speed) : null, bear = num(A.wind_bearing);
      const hum = num(A.humidity), temp = num(A.temperature);
      let dew = num(A.dew_point);
      if (dew == null && hum && temp != null) { const g = (17.27 * temp) / (237.7 + temp) + Math.log(hum / 100); dew = (237.7 * g) / (17.27 - g); }
      const uv = num(A.uv_index) != null ? num(A.uv_index) : H[0] ? num(H[0].uv_index) : null, uvL = uvOf(uv);
      const pr = num(A.pressure), prU = A.pressure_unit || 'hPa';
      const rain24 = H.length ? H.slice(0, 24).reduce((s, f) => s + (num(f.precipitation) || 0), 0) : null;
      const frac = sun ? M.clamp((Date.now() - sun.rise) / (sun.set - sun.rise), 0, 1) : 0.5, ang = Math.PI * (1 - frac), sunUp = sun ? sun.up : false;
      const prDeg = pr != null ? (M.clamp(pr, 960, 1060) - 960) / 100 * 270 : 0;
      const mask = 'radial-gradient(farthest-side, transparent calc(100% - 8px), #000 calc(100% - 7px))';
      const T = {
        sky: `<section class="tl box" style="min-height:150px"><span class="th">${M.icon('cloud', 16)}Skydekke</span><span class="tvv">${cc != null ? Math.round(cc) + ' %' : '–'}</span><span class="ts">${ccL}</span><div class="bar"><span style="width:${cc || 0}%"></span></div></section>`,
        wind: `<section class="tl circ" style="background:var(--gray200,#3a3a3a);box-shadow:inset 0 0 0 10px #2a2a2a"><span class="arr" style="transform:rotate(${bear != null ? (bear + 180) % 360 : 0}deg);opacity:${bear != null ? 1 : 0.3}">${M.icon('navigation', 22, `color:${C.blue}`)}</span><span class="th" style="gap:0">Vind</span><span class="tvv" style="font-size:34px">${ws != null ? f1(ws) : '–'}</span><span class="ts">${esc(wu)}${bear != null || A.wind_bearing ? ' · ' + compass(A.wind_bearing) : ''}</span></section>`,
        gust: `<section class="tl circ" style="background:${M.alpha(C.purple, 0.16)};box-shadow:inset 0 0 0 1px ${M.alpha(C.purple, 0.35)}"><span class="th" style="color:var(--gray900,#c7c7c7)">${M.icon('storm', 16, `color:${C.purple}`)}Vindkast</span><span class="tvv" style="font-size:36px">${gust != null ? f1(gust) : '–'}</span><span class="ts">${esc(wu)}</span></section>`,
        sun: `<section class="tl box" style="gap:8px"><span class="th">${M.icon('wb_twilight', 16)}Sol opp og ned</span>
          <div class="arc"><span class="ell0"></span><span class="sd" style="left:calc(${(50 + Math.cos(ang) * 46).toFixed(2)}% - 9px);top:${(6 + 50 - Math.sin(ang) * 50 - 9).toFixed(1)}px;opacity:${sun && !sunUp ? 0.35 : 1}"></span><span class="base"></span></div>
          <span class="row ts" style="justify-content:space-between"><span>↑ ${sun ? hm(sun.rise) : '–'}</span><span>↓ ${sun ? hm(sun.set) : '–'}</span></span>
          <span style="font-size:11px;color:var(--gray600,#7f7f7f)">Solhøyde ${sun && sun.elev != null ? M.nf(sun.elev, 0) + '°' : '–'}</span></section>`,
        hum: `<section class="tl box" style="position:relative;overflow:hidden;gap:6px;min-height:150px"><span style="position:absolute;left:0;right:0;bottom:0;height:${hum != null ? M.clamp(hum, 0, 100) : 0}%;background:linear-gradient(180deg, ${M.alpha(C.blue, 0.22)}, ${M.alpha(C.blue, 0.08)})"></span>
          <span class="th" style="position:relative;color:var(--gray900,#c7c7c7)">${M.icon('humidity_percentage', 16, `color:${C.blue}`)}Fukt</span><span class="tvv" style="position:relative">${hum != null ? Math.round(hum) + ' %' : '–'}</span><span class="ts" style="position:relative;margin-top:auto">Duggpunkt ${dew != null ? f1(dew) + tu : '–'}</span></section>`,
        uv: `<section class="tl circ" style="border-radius:36%;background:var(--gray200,#3a3a3a);box-shadow:inset 0 0 0 1px rgba(255,255,255,0.06);gap:4px"><span class="th">${M.icon('light_mode', 16, `color:${SUNY}`)}UV-indeks</span><span class="tvv">${uv != null ? f1(uv) : '–'}</span><span style="font-size:12px;font-weight:600;color:${uvL[1]}">${uvL[0]}</span></section>`,
        press: `<section class="tl circ" style="position:relative;background:var(--gray200,#3a3a3a)"><span style="position:absolute;inset:6px;border-radius:50%;background:conic-gradient(from 225deg, ${C.blue} 0 ${prDeg.toFixed(1)}deg, var(--gray300, #404040) ${prDeg.toFixed(1)}deg 270deg, transparent 270deg);-webkit-mask:${mask};mask:${mask};pointer-events:none"></span>
          <span class="th">${M.icon('compress', 16)}Trykk</span><span class="tvv" style="font-size:32px">${pr != null ? Math.round(pr) : '–'}</span><span class="ts">${esc(prU)}</span></section>`,
        rain: `<section class="tl box" style="gap:6px"><span class="th">${M.icon('water_drop', 16, `color:${C.blue}`)}Nedbør</span><span class="tvv">${rain24 != null ? f1(rain24) : '–'}<span style="font-size:14px;color:var(--gray700,#979797)"> ${esc(pu)}</span></span><span class="ts" style="margin-top:auto">Neste 24 timer</span></section>`,
      };
      const tk = TILES.map((t) => t[0]);
      let tord = Array.isArray(c.tiles) ? c.tiles.filter((k) => tk.includes(k)) : [];
      tk.forEach((k) => { if (!tord.includes(k)) tord.push(k); });
      const thid = new Set(c.hidden_tiles || []);
      sec.tiles = `<div class="tiles" ${a.weather ? `data-ent="${esc(a.weather)}"` : ''}>${tord.filter((k) => !thid.has(k)).map((k) => `<div class="tw" data-key="t-${k}">${T[k]}</div>`).join('')}</div>`;
      sec.moon = `<section class="mn" ${a.moon ? `data-ent="${esc(a.moon)}"` : ''}>${moonDisc(moon.p, 56)}<span class="col" style="gap:2px"><span style="font-size:11px;color:var(--gray700,#979797)">Månefase</span><span style="font-size:16px;font-weight:500">${esc(moon.name)}</span></span></section>`;
      sec.edit = `<button class="own press" data-act="customize" data-section="sections">${M.icon('tune', 20)}Tilpass været</button>`;
      const keys = SECS.map((s) => s[0]);
      let order = Array.isArray(c.sections) ? c.sections.filter((k) => keys.includes(k)) : [];
      keys.forEach((k) => { if (!order.includes(k)) order.push(k); });
      const hid = new Set(c.hidden_sections || []);
      const empty = !st ? M.emptyState(a.weather ? `Fant ikke ${a.weather}` : 'Fant ingen weather.*', 'overrides') : '';
      return `<div class="wrap">${empty}${order.filter((k) => !hid.has(k) && sec[k]).map((k) => `<div class="blk" data-key="b-${k}">${sec[k]}</div>`).join('')}</div>`;
    }
    onAction(name, el, ev) {
      if (name === 'alert') { if (ev.composedPath().some((n) => n.tagName === 'A')) return; return this.setUI({ alertOpen: this.ui.alertOpen === el.dataset.k ? null : el.dataset.k }); }
      if (name === 'day') return this.setUI({ dayOpen: this.ui.dayOpen === el.dataset.k ? null : el.dataset.k });
      return super.onAction(name, el, ev);
    }
    afterRender() {
      guardSwipe(this.shadowRoot.querySelector('.hrs'));
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
        .sec{gap:8px}
        .ah{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0 6px}
        .ac{width:28px;height:28px;border-radius:14px;display:grid;place-items:center;color:#282828;box-shadow:0 0 0 2px #282828;position:relative}
        .al{display:flex;flex-direction:column;padding:14px 16px;border-radius:24px;width:100%;text-align:left}
        .aiw{width:42px;height:42px;border-radius:21px;flex:none;display:grid;place-items:center;color:#282828}
        .lb{font-size:11px;font-weight:600;padding:2px 8px;border-radius:8px}
        .ax{display:flex;flex-direction:column;gap:10px;width:100%;padding-top:12px;margin-top:12px;border-top:1px solid rgba(255,255,255,0.06);text-align:left}
        .map{display:flex;align-items:center;gap:4px;color:var(--gray800,#afafaf);text-decoration:none;white-space:nowrap}
        .hrs{display:flex;gap:8px;overflow-x:auto;overscroll-behavior-x:contain}
        .hb{flex:none;width:92px;height:172px;border-radius:24px;background:var(--gray200,#3a3a3a);display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:14px 0}
        .hb.first{background:var(--gray300,#404040);box-shadow:inset 0 0 0 1px rgba(255,255,255,0.08)}
        .hb.ph,.day.ph{width:100%;height:auto;min-height:72px;justify-content:center;font-size:13px;color:var(--gray700,#979797)}
        .ht{font-size:13px;color:var(--gray800,#afafaf)}
        .htv{font-size:24px;font-weight:300;letter-spacing:-0.02em}
        .hx{display:flex;flex-direction:column;align-items:center;gap:1px;font-size:11px;color:var(--gray700,#979797)}
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
        .tl{display:flex;flex-direction:column}
        .box{gap:8px;padding:16px;border-radius:28px;background:var(--gray200,#3a3a3a);height:100%}
        .circ{position:relative;align-items:center;justify-content:center;gap:2px;aspect-ratio:1;border-radius:50%}
        .th{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--gray700,#979797)}
        .circ .th{gap:4px}
        .tvv{font-size:40px;font-weight:300;letter-spacing:-0.03em;line-height:1}
        .ts{font-size:12px;color:var(--gray900,#c7c7c7)}
        .bar{position:relative;height:6px;border-radius:3px;background:var(--gray300,#404040);margin-top:auto}
        .bar span{position:absolute;left:0;top:0;bottom:0;border-radius:3px;background:var(--gray900,#c7c7c7)}
        .arr{position:absolute;top:12px;left:50%;margin-left:-11px;line-height:0;transition:transform .4s}
        .arc{position:relative;height:56px;overflow:hidden}
        .ell0{position:absolute;left:4px;right:4px;top:6px;height:100px;border-radius:50%;border:1.5px dashed var(--gray400,#545454)}
        .sd{position:absolute;width:18px;height:18px;border-radius:9px;background:${SUNY};box-shadow:0 0 16px ${M.alpha(SUNY, 0.6)}}
        .base{position:absolute;left:0;right:0;bottom:0;height:1px;background:var(--gray400,#545454)}
        .mn{display:flex;align-items:center;gap:16px;padding:16px 18px;border-radius:28px;background:var(--gray200,#3a3a3a)}
        .moon{position:relative;flex:none;border-radius:50%;background:#e9e4d6;overflow:hidden;box-shadow:0 0 30px rgba(233,228,214,0.18)}
        .own{width:100%;height:52px;border-radius:26px;background:var(--gray200,#3a3a3a);display:flex;align-items:center;justify-content:center;gap:8px;font-size:15px;font-weight:500}
        .own:active{transform:scale(0.98)}
      `;
    }
  }
  M.define('msh-vaer-card', Vaer, 'MSH Vær', 'Farevarsler, time for time, dagskort, detaljkort og månefase. Prognose abonneres kun mens #vaer er åpen.');
})();
