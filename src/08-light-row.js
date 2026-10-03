/* KI MSH · felles lysslider `msh-light-slider` (Fiks 39 – «ki-light-slider») for Rom → Lys (31-rom.js) og Lys-popupen
 * (43-lys.js, også gruppe-radene). Erstatter mysmart-light-control i begge kortene (vendor-filen ligger igjen, ubrukt).
 * Spesifikasjonen (fiks39) overstyrer lyspillene i Rom v4 / Lys v5:
 *   Rad (dimbart lys): topplinje navn 15/500 (--ki-text) + verdi 12 (--ki-text-2, «0%», «100%», tabular-nums), 8 px ned
 *   til baren. Bar 52 px (slider_height), radius 14, full bredde. Spor = lysfargen 35 % over --ki-surface-3 (#3a3a3a i
 *   mørk), fyll = lysfargen i full opasitet (rgb/hs → farge, fargetemp → Kelvin-farge, kun dimbar = varmhvit #ffc896).
 *   Håndtak 4 × (bar + 22) px radius 2, lysfargen × 0,6, 11 px over/under baren, 6 px luft mot fyll og spor.
 *   Chevron (mdi:chevron-down 20 px, 44 × 44) bare for lys med farge/fargetemperatur → farge-/temperaturvelger under raden.
 *   Rad (kun av/på): pille 52 px r14 med samme spor; bryterknapp (bar − 8) px r10, 55 % bredde, lysere tone, mdi:power 18;
 *   av = knappen til venstre + prikk 6 px i lysfargen til høyre; på = fyll i lysfargen, knappen glir til høyre.
 * Interaksjon: dra hvor som helst = lysstyrke 1–100 % (0 = av), trykk = av/på. touch-action pan-y + stopPropagation på
 *   pointerdown/touchstart/touchmove (fallgruve 2). Lokalt live mens man drar; light.turn_on {brightness_pct} throttlet
 *   150 ms + ved slipp. Haptic selection ved start, light ved 0/100 % (M.haptic: maks én per 40 ms). Ekstern endring:
 *   fyll og håndtak animeres 250 ms. Lyst tema: spor/fyll fra lysfargen, tekst med --ki-*-tokens.
 *
 *   M.lightType(state)                          → 'color' | 'ct' | 'dim' | 'onoff' (fra supported_color_modes)
 *   M.lightRowCfg(id, { name, type, user, height, color, kelvin }) → config til msh-light-slider
 *       color = fast farge (Lys «Farge på lys»: Én farge / Temperatur), kelvin = «45% · 2700 K» (Lys show_kelvin)
 *       user = lights.<objekt-id> (brightness_min/max, color_control, hide_*, color_presets)
 *   M.lightRowHeight(cfg)                       → barhøyde (32–80, std 52; size compact 44 / large 60)
 *   M.sliderColor(state, override, preview)     → lysfargen (css) for slideren
 *   M.mountLightRows(card, cfgOf(id, wrap))     → monter/oppdater i plassholdere [data-lc] (gjenbrukes per nøkkel)
 *   M.lightRowsHass(card, hass)                 → gi nye hass til monterte rader
 *   M.LIGHT_ROW_CSS                             → CSS for plassholderne (.lsl; høyden fra --lr-h på en forelder)
 * Gruppe (Lys 36.8): config { entities: [...], dim_ids, name, icon, suffix: ' · 3 lys' } – slideren styrer alle.
 */
(function () {
  const M = window.MSH;
  if (!M || M.lightRowCfg) return;
  const esc = M.esc;
  const COLOR = ['hs', 'rgb', 'rgbw', 'rgbww', 'xy'];
  const TAG = 'msh-light-slider';

  M.lightType = function (s) {
    const m = (s && s.attributes.supported_color_modes) || [];
    if (m.some((x) => COLOR.includes(x))) return 'color';
    if (m.includes('color_temp')) return 'ct';
    if (m.some((x) => x !== 'onoff') || (!m.length && s && s.attributes.brightness != null)) return 'dim';
    return 'onoff';
  };
  // Barhøyde (Fiks 39: 52 px): slider_height (32–80) går foran, ellers size compact 44 / large 60, eldre tile_height
  // (56 → 52, 64 → 60, 72 → 68)
  M.lightRowHeight = function (c) {
    c = c || {};
    const v = Number(c.slider_height);
    if (c.slider_height != null && c.slider_height !== '' && !isNaN(v)) return Math.max(32, Math.min(80, Math.round(v)));
    if (c.size === 'compact') return 44;
    if (c.size === 'large') return 60;
    const th = Number(c.tile_height);
    if (!c.size && th >= 56) return Math.max(32, Math.min(80, 52 + (th - 56)));
    return 52;
  };
  // 19.2 · Lampens egen farge (Lys v4 → LC(k)/KEL()) – brukes fortsatt av «Lys på»-sirklene og fargeprikkene i arket.
  const KEL = [[2400, [242, 181, 115]], [3000, [242, 210, 111]], [4200, [242, 228, 185]], [Infinity, [222, 232, 245]]];
  const YEL = [242, 210, 111];
  const lumOf = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const rgbOf = (v) => {
    if (Array.isArray(v)) return v.length >= 3 ? v.slice(0, 3).map(Number) : null;
    const s = String(v || '');
    let m = /#([0-9a-f]{6}|[0-9a-f]{3})\b/i.exec(s);
    if (m) { let h = m[1]; if (h.length === 3) h = h.split('').map((x) => x + x).join(''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); }
    m = /rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(s);
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
  };
  const hsRgb = (hs) => {
    if (!Array.isArray(hs) || hs.length < 2) return null;
    const h = ((Number(hs[0]) % 360) + 360) % 360 / 60, s = Math.max(0, Math.min(100, Number(hs[1]) || 0)) / 100, x = s * (1 - Math.abs((h % 2) - 1));
    const [r, g, b] = h < 1 ? [s, x, 0] : h < 2 ? [x, s, 0] : h < 3 ? [0, s, x] : h < 4 ? [0, x, s] : h < 5 ? [x, 0, s] : [s, 0, x];
    return [r, g, b].map((v) => Math.round(255 * (v + 1 - s)));
  };
  M.lampColor = function (s, override, preview) {
    const out = (rgb, css) => ({ css: css || `rgb(${rgb.join(' ')})`, lum: rgb ? lumOf(rgb) : 0.5 });
    if (override) { const css = M.color(override); return out(rgbOf(css), css); }
    const pr = preview && rgbOf(preview);
    if (pr) return out(pr);
    const a = (s && s.attributes) || {}, mode = a.color_mode;
    if (COLOR.includes(mode)) { const c = rgbOf(a.rgb_color) || hsRgb(a.hs_color); if (c) return out(c); }
    if (mode === 'color_temp') {
      const k = Number(a.color_temp_kelvin) || (Number(a.color_temp) ? 1e6 / Number(a.color_temp) : 0);
      if (k > 0) return out(KEL.find(([t]) => k <= t)[1]);
    }
    return out(YEL, `var(--yellow, rgb(${YEL.join(' ')}))`);
  };
  // Fyll-maske (19.2) – brukes ikke lenger av lys-radene (Fiks 39: full opasitet), beholdt for eldre kall
  M.lampMask = (lum) => (lum < 0.35 ? 'linear-gradient(90deg, rgb(0 0 0 / .3), rgb(0 0 0 / .6))' : 'linear-gradient(90deg, rgb(0 0 0 / .22), rgb(0 0 0 / .5))');

  /* ------------------------------------------------------------ Fiks 39 · lysfargen */
  const WARM = [255, 200, 150]; // varmhvit #ffc896 – kun dimbare lys (og lys som er av uten kjent farge)
  // Kelvin → farge (Tanner Helland), mykt mot hvitt (30 %) så 2700 K ≈ varmhvit og 6500 K ≈ kald hvit
  const kelvinRgb = (k) => {
    const t = Math.max(1000, Math.min(40000, Number(k) || 2700)) / 100;
    const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
    const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
    const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
    return [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v)) * 0.7 + 255 * 0.3));
  };
  M.kelvinRgb = kelvinRgb;
  const css = (rgb) => `rgb(${rgb.join(' ')})`;
  const kOf = (a) => Number(a.color_temp_kelvin) || (Number(a.color_temp) ? 1e6 / Number(a.color_temp) : 0);
  const last = new Map(); // sist sette farge per lys (i minnet) – sporet beholder lysets farge når det er av
  M.sliderColor = function (s, override, preview) {
    if (preview) return preview;
    if (override) return M.color(override, override);
    const id = s && s.entity_id, a = (s && s.attributes) || {}, mode = a.color_mode;
    let c = null;
    if (s && s.state === 'on') {
      if (COLOR.includes(mode)) { const x = rgbOf(a.rgb_color) || hsRgb(a.hs_color); if (x) c = css(x); }
      if (!c && (mode === 'color_temp' || (!COLOR.includes(mode) && kOf(a) > 0))) { const k = kOf(a); if (k > 0) c = css(kelvinRgb(k)); }
      if (!c) c = css(WARM);
      if (id) last.set(id, c);
      return c;
    }
    return (id && last.get(id)) || css(WARM);
  };

  const pctOf = (s) => (!s || s.state !== 'on' ? 0 : s.attributes.brightness != null ? Math.max(1, Math.round((s.attributes.brightness / 255) * 100)) : 100);
  const B = (v) => (v === true || v === 'true' ? true : v === false || v === 'false' ? false : undefined);
  M.lightRowCfg = function (id, { name, type, user, height, color, kelvin } = {}) {
    const u = user || {};
    const out = { entity: id, type: type || 'dim', height: height || 52 };
    if (name) out.name = name;
    if (color) out.color = String(color);
    if (kelvin) out.kelvin = true;
    Object.keys(u).forEach((k) => {
      let v = u[k];
      if (v == null || v === '') return;
      if (k === 'color') { if (!out.color) out.color = String(v); return; }
      if (k === 'brightness_min' || k === 'brightness_max') { v = Number(v); if (!isNaN(v)) out[k] = M.clamp(Math.round(v), 0, 100); return; }
      if (k === 'color_control' && ['spectrum', 'presets', 'both'].includes(v)) { out[k] = v; return; }
      // «skjul» kan bare skjule – aldri vise farge/temperatur for et lys som ikke har det
      if (k === 'hide_temperature_slider' || k === 'hide_color_controls' || k === 'hide_color_presets') { if (B(v) === true) out[k] = true; return; }
      if (k === 'color_presets') {
        const a = (Array.isArray(v) ? v : String(v).split(/,(?![^(]*\))/)).map((x) => String(x).trim()).filter(Boolean);
        if (a.length) out[k] = a;
      }
    });
    return out;
  };

  /* ------------------------------------------------------------ msh-light-slider */
  const PRESETS = ['#ffc896', '#fff4e0', '#e8f0ff', '#ff4d4d', '#ff9a3c', '#ffd84d', '#5fd36b', '#3fd0d4', '#4d8dff', '#9d6bff', '#ff6bcb']; // ki-hex-ok fargepalett
  const HUES = [[15, 'Rød'], [45, 'Oransje'], [70, 'Gul'], [160, 'Grønn'], [195, 'Turkis'], [255, 'Blå'], [290, 'Lilla'], [340, 'Rosa'], [361, 'Rød']];
  const hueName = (h) => (HUES.find(([t]) => h < t) || HUES[0])[1];
  const hueOf = (a) => { if (Array.isArray(a.hs_color)) return Number(a.hs_color[0]) || 0; const c = rgbOf(a.rgb_color); if (!c) return 30; const [r, g, b] = c.map((v) => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (!d) return 0; let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; return h < 0 ? h + 360 : h; };
  const CSS = `
    :host{display:block;min-width:0;--lh:var(--lr-h,52px);-webkit-tap-highlight-color:transparent;font-family:${M.FONT}}
    .r{display:flex;flex-direction:column;min-width:0}
    .hd{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:8px;padding:0 2px;min-width:0}
    .n{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:var(--msh-nf,15px);font-weight:500;line-height:20px;color:var(--ki-text, #e1e1e1);display:flex;align-items:center;gap:6px}
    .n span{min-width:0;overflow:hidden;text-overflow:ellipsis}
    .v{flex:none;font-size:12px;line-height:20px;color:var(--ki-text-2, var(--gray800,#afafaf));font-variant-numeric:tabular-nums;white-space:nowrap}
    .ln{display:flex;align-items:center;gap:2px;min-width:0}
    .bar{position:relative;flex:1;min-width:0;height:var(--lh);border-radius:14px;touch-action:pan-y;cursor:pointer;outline:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;
      --base:var(--ki-surface-3, var(--gray200, #3a3a3a));--tr:color-mix(in srgb, var(--c) 35%, var(--base))}
    .bar:focus-visible{box-shadow:0 0 0 2px var(--ki-text-2, var(--gray800,#afafaf))}
    .fl,.tk,.hh{position:absolute;top:0;bottom:0}
    .fl{left:0;border-radius:14px 4px 4px 14px;background:var(--c);transition:width .25s ease,background-color .25s ease}
    .tk{right:0;border-radius:4px 14px 14px 4px;background:var(--tr);transition:left .25s ease,background-color .25s ease}
    .hh{top:-11px;bottom:-11px;width:4px;border-radius:2px;background:color-mix(in srgb, var(--c) 60%, black);transition:left .25s ease,background-color .25s ease;pointer-events:none}
    .p0 .fl{width:0!important}
    /* av/på-pille */
    .oo{background:var(--tr);overflow:hidden;transition:background-color .25s ease}
    .oo .ofl{position:absolute;inset:0;background:var(--c);opacity:0;transition:opacity .25s ease}
    .oo .kn{position:absolute;top:4px;bottom:4px;left:4px;width:calc(55% - 4px);border-radius:10px;display:flex;align-items:center;padding-left:12px;box-sizing:border-box;
      background:color-mix(in srgb, var(--c) 55%, var(--base));color:var(--ki-text, #fafafa);transition:left .25s cubic-bezier(.3,.9,.3,1),background-color .25s ease,color .25s ease}
    .oo .dot{position:absolute;top:50%;right:calc(22.5% - 3px);width:6px;height:6px;margin-top:-3px;border-radius:3px;background:var(--c);transition:opacity .2s ease}
    .oo.on .ofl{opacity:1}
    .oo.on .kn{left:calc(45%);background:color-mix(in srgb, var(--c) 65%, white);color:var(--ki-on-accent, #2a1720)}
    .oo.on .dot{opacity:0}
    .drag .fl,.drag .tk,.drag .hh,.drag .kn{transition:none}
    .cv{flex:none;width:44px;height:44px;margin-right:-8px;border:0;padding:0;background:none;display:grid;place-items:center;color:var(--ki-text-2, var(--gray800,#afafaf));cursor:pointer;border-radius:22px;font:inherit}
    .cv ha-icon{transition:transform .25s ease}
    .cv.open ha-icon{transform:rotate(180deg)}
    .dis{opacity:.5}
    .dis .bar,.dis .cv{pointer-events:none}
    /* farge-/temperaturvelger under raden */
    .x{display:flex;flex-direction:column;gap:14px;padding:16px 2px 4px;animation:xin .22s cubic-bezier(.3,.9,.3,1)}
    @keyframes xin{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
    .xl{display:flex;justify-content:space-between;font-size:12px;line-height:16px;margin-bottom:8px;color:var(--ki-text-2, var(--gray800,#afafaf))}
    .xs{position:relative;height:36px;border-radius:12px;touch-action:pan-y;cursor:pointer;-webkit-user-select:none;user-select:none}
    .xh{position:absolute;top:-6px;bottom:-6px;width:4px;margin-left:-2px;border-radius:2px;background:var(--ki-knob, #fff);box-shadow:0 0 0 1px rgb(0 0 0 / .25),0 1px 4px rgb(0 0 0 / .3);pointer-events:none}
    .pr{display:flex;flex-wrap:wrap;gap:10px}
    .pc{width:32px;height:32px;border-radius:16px;border:0;padding:0;cursor:pointer;box-shadow:inset 0 0 0 1px rgb(0 0 0 / .12);transition:transform .15s}
    .pc:active{transform:scale(.9)}
    @media (prefers-reduced-motion:reduce){.fl,.tk,.hh,.kn,.x{transition:none;animation:none}}
  `;
  const hue = 'linear-gradient(90deg,' + [0, 60, 120, 180, 240, 300, 360].map((h) => `hsl(${h} 100% 50%)`).join(',') + ')';

  class LightSlider extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._cfg = null; this._h = null; this._open = false; this._pend = null; this._drag = null; this._shape = ''; this._xprev = null;
      this._sentAt = 0; this._tm = null; this._lastSent = null;
    }
    setConfig(c) {
      if (!c || (!c.entity && !(Array.isArray(c.entities) && c.entities.length))) throw new Error('msh-light-slider: entity mangler');
      this._cfg = { ...c };
      this._upd();
    }
    get config() { return this._cfg; }
    set hass(h) { this._h = h; this._upd(); }
    get hass() { return this._h; }
    connectedCallback() { this._upd(); }
    disconnectedCallback() { if (this._tm) { clearTimeout(this._tm); this._tm = null; if (this._q != null) this._fire(this._q, this._qk); } }

    _ids() { const c = this._cfg; return Array.isArray(c.entities) && c.entities.length ? c.entities.slice() : [c.entity]; }
    _grp() { return Array.isArray(this._cfg.entities); }
    _st() {
      const c = this._cfg, h = this._h, ids = this._ids(), S = ids.map((id) => (h && h.states[id]) || null);
      const grp = this._grp(), have = S.filter(Boolean), onS = have.filter((s) => s.state === 'on');
      const missing = !have.length, unav = !missing && have.every((s) => M.unavailable(s));
      const type = c.type || (grp ? (have.some((s) => M.lightType(s) !== 'onoff') ? 'dim' : 'onoff') : M.lightType(S[0]));
      const onoff = type === 'onoff';
      let p = onoff ? (onS.length ? 100 : 0) : grp ? (onS.length ? Math.max(1, Math.round(S.reduce((t, s) => t + pctOf(s), 0) / ids.length)) : 0) : pctOf(S[0]);
      const now = Date.now();
      if (this._pend) { if (now - this._pend.t > 3000 || Math.abs(this._pend.p - p) <= 1) this._pend = null; else p = this._pend.p; }
      if (this._drag && this._drag.p != null) p = this._drag.p;
      if (this._xprev && now > this._xprev.until) this._xprev = null;
      const ref = onS[0] || S[0];
      const col = M.sliderColor(ref, c.color, this._xprev && this._xprev.css);
      const a = (ref && ref.attributes) || {}, modes = a.supported_color_modes || [];
      const hasCt = !grp && (type === 'ct' || (type === 'color' && modes.includes('color_temp'))) && !c.hide_temperature_slider;
      const hasHue = !grp && type === 'color' && !c.hide_color_controls && c.color_control !== 'presets';
      const hasPre = !grp && type === 'color' && !c.hide_color_presets && c.color_control !== 'spectrum';
      const chev = !grp && (type === 'ct' || type === 'color') && (hasCt || hasHue || hasPre);
      const K = onS.length ? Math.round(kOf((onS[0] || {}).attributes || {})) : 0;
      const name = c.name || (S[0] ? M.name(h, ids[0]) : ids[0]);
      const val = missing ? 'Finnes ikke' : unav ? 'Utilgjengelig' : (onoff ? (p ? 'På' : 'Av') : `${p}%${c.kelvin && p && K > 0 ? ` · ${K} K` : ''}`) + (c.suffix || '');
      return { ids, S, ref, grp, type, onoff, p, col, chev, hasCt, hasHue, hasPre, name, val, dis: missing || unav, on: onS.length > 0 };
    }
    _upd() {
      if (!this._cfg || !this.isConnected) return;
      const st = this._st();
      const shape = `${st.onoff ? 'o' : 'd'}${st.chev ? 'c' : ''}`;
      const R = this.shadowRoot;
      if (shape !== this._shape) {
        this._shape = shape;
        R.innerHTML = `<style>${CSS}</style><div class="r">
          <div class="hd"><span class="n"></span><span class="v"></span></div>
          <div class="ln"><div class="bar${st.onoff ? ' oo' : ''}" tabindex="0" role="${st.onoff ? 'switch' : 'slider'}" aria-valuemin="0" aria-valuemax="100">
            ${st.onoff ? `<span class="ofl"></span><span class="kn">${M.icon('mdi:power', 18)}</span><span class="dot"></span>` : '<span class="fl"></span><span class="tk"></span><span class="hh"></span>'}</div>
            ${st.chev ? `<button class="cv" type="button" aria-label="Farge og temperatur">${M.icon('mdi:chevron-down', 20)}</button>` : ''}</div>
          <div class="xw"></div></div>`;
        this._bind();
        this._nameKey = null;
      }
      const r = R.querySelector('.r'), bar = R.querySelector('.bar');
      r.classList.toggle('dis', st.dis);
      this.style.setProperty('--c', st.col);
      const c = this._cfg, nk = `${c.icon || ''}|${st.name}|${st.on}`;
      if (this._nameKey !== nk) {
        this._nameKey = nk;
        R.querySelector('.n').innerHTML = `${c.icon ? M.icon(c.icon, 18, `color:${st.on ? (c.icon_on || 'var(--ki-text, #e1e1e1)') : 'var(--ki-text-mid, var(--gray700,#979797))'}`) : ''}<span>${esc(st.name)}</span>`;
      }
      R.querySelector('.v').textContent = st.val;
      bar.setAttribute('aria-label', st.name);
      if (c.height) this.style.setProperty('--lh', `${Number(c.height)}px`); else this.style.removeProperty('--lh');
      if (st.onoff) {
        bar.classList.toggle('on', st.p > 0);
        bar.setAttribute('aria-checked', String(st.p > 0));
      } else {
        const f = st.p / 100;
        bar.classList.toggle('p0', st.p <= 0);
        R.querySelector('.fl').style.width = `max(0px, calc((100% - 4px) * ${f} - 6px))`;
        R.querySelector('.tk').style.left = `calc((100% - 4px) * ${f} + 10px)`;
        R.querySelector('.hh').style.left = `calc((100% - 4px) * ${f})`;
        bar.setAttribute('aria-valuenow', String(st.p));
        bar.setAttribute('aria-valuetext', st.val);
      }
      const cv = R.querySelector('.cv');
      if (cv) { cv.classList.toggle('open', this._open); cv.setAttribute('aria-expanded', String(this._open)); }
      this._drawX(st);
    }

    /* ---------- farge-/temperaturvelger (eksisterende valg: Temperatur · Farge · Forhåndsvalg) */
    _drawX(st) {
      const w = this.shadowRoot.querySelector('.xw');
      if (!w) return;
      if (!this._open || !st.chev) { if (w.firstChild) w.textContent = ''; return; }
      const a = (st.ref && st.ref.attributes) || {};
      const kmin = Number(a.min_color_temp_kelvin) || 2000, kmax = Number(a.max_color_temp_kelvin) || 6500;
      const xd = this._xd || {};
      const k = xd.kind === 'ct' ? xd.v : Math.round(kOf(a)) || Math.round((kmin + kmax) / 2);
      const hh = xd.kind === 'hue' ? xd.v : hueOf(a);
      const key = `${st.hasCt}|${st.hasHue}|${st.hasPre}|${kmin}|${kmax}|${(this._cfg.color_presets || []).join()}`;
      if (w.dataset.k !== key || !w.firstChild) {
        w.dataset.k = key;
        const pre = (this._cfg.color_presets && this._cfg.color_presets.length ? this._cfg.color_presets : PRESETS);
        w.innerHTML = `<div class="x">
          ${st.hasCt ? `<div><div class="xl"><span>Temperatur</span><span class="xv" data-v="ct"></span></div><div class="xs" data-s="ct" role="slider" aria-label="Temperatur" style="background:linear-gradient(90deg,${css(kelvinRgb(kmin))},${css(kelvinRgb((kmin + kmax) / 2))},${css(kelvinRgb(kmax))})"><span class="xh"></span></div></div>` : ''}
          ${st.hasHue ? `<div><div class="xl"><span>Farge</span><span class="xv" data-v="hue"></span></div><div class="xs" data-s="hue" role="slider" aria-label="Farge" style="background:${hue}"><span class="xh"></span></div></div>` : ''}
          ${st.hasPre ? `<div><div class="xl"><span>Forhåndsvalg</span></div><div class="pr">${pre.map((p) => { const rgb = rgbOf(M.color(p, p)); return `<button class="pc" type="button" data-pc="${esc(rgb ? rgb.join(',') : '')}" data-css="${esc(M.color(p, p))}" aria-label="Farge ${esc(p)}" style="background:${esc(M.color(p, p))}"></button>`; }).join('')}</div></div>` : ''}
        </div>`;
      }
      const ct = w.querySelector('[data-s="ct"] .xh'), hu = w.querySelector('[data-s="hue"] .xh');
      if (ct) { ct.style.left = `${M.clamp(((k - kmin) / Math.max(1, kmax - kmin)) * 100, 0, 100)}%`; w.querySelector('[data-v="ct"]').textContent = `${k} K`; }
      if (hu) { hu.style.left = `${M.clamp((hh / 360) * 100, 0, 100)}%`; w.querySelector('[data-v="hue"]').textContent = hueName(hh); }
      this._kr = [kmin, kmax];
    }

    /* ---------- interaksjon */
    _bind() {
      const R = this.shadowRoot, bar = R.querySelector('.bar'), stop = (e) => e.stopPropagation();
      // fallgruve 2: Bubble Cards swipe-to-close / scroll skal aldri se dragene
      ['touchstart', 'touchmove'].forEach((t) => R.addEventListener(t, stop, { passive: true }));
      R.addEventListener('pointerdown', stop);
      bar.addEventListener('pointerdown', (e) => this._down(e, bar, 'main'));
      bar.addEventListener('keydown', (e) => this._key(e));
      const cv = R.querySelector('.cv');
      if (cv) cv.addEventListener('click', (e) => { e.stopPropagation(); this._open = !this._open; M.haptic('selection'); this._upd(); });
      R.querySelector('.xw').addEventListener('pointerdown', (e) => { const s = e.target.closest && e.target.closest('.xs'); if (s) this._down(e, s, s.dataset.s); });
      R.querySelector('.xw').addEventListener('click', (e) => {
        const b = e.target.closest && e.target.closest('.pc');
        if (!b || !b.dataset.pc) return;
        e.stopPropagation();
        M.haptic('selection');
        this._xprev = { css: b.dataset.css, until: Date.now() + 2500 };
        this._svc({ rgb_color: b.dataset.pc.split(',').map(Number) });
        this._upd();
      });
    }
    _pos(d, x) { return M.clamp((x - d.left - (d.kind === 'main' ? 2 : 0)) / Math.max(1, d.w - (d.kind === 'main' ? 4 : 0)), 0, 1); }
    _down(e, el, kind) {
      e.stopPropagation();
      if (e.button || (this._drag && this._drag.id !== e.pointerId)) return;
      const st = this._st();
      if (st.dis) return;
      const r = el.getBoundingClientRect();
      const d = (this._drag = { id: e.pointerId, el, kind, x0: e.clientX, y0: e.clientY, left: r.left, w: r.width, moved: false, p: null, onoff: st.onoff, p0: st.p });
      const mv = (ev) => {
        if (ev.pointerId !== d.id) return;
        ev.stopPropagation();
        const dx = ev.clientX - d.x0, dy = ev.clientY - d.y0;
        if (!d.moved) {
          if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) return end(ev, true); // vertikal = scroll
          if (Math.abs(dx) < 6) return undefined;
          d.moved = true;
          try { el.setPointerCapture(d.id); } catch (x) { /* */ }
          this.shadowRoot.querySelector('.r').classList.add('drag');
          M.haptic('selection');
        }
        if (ev.cancelable) ev.preventDefault();
        this._move(d, ev.clientX);
        return undefined;
      };
      const end = (ev, abort) => {
        if (ev && ev.pointerId !== d.id) return;
        window.removeEventListener('pointermove', mv, true);
        window.removeEventListener('pointerup', up, true);
        window.removeEventListener('pointercancel', cn, true);
        const R = this.shadowRoot.querySelector('.r'); if (R) R.classList.remove('drag');
        if (this._drag === d) this._drag = null;
        if (d.moved) this._commit(d, true);
        else if (!abort && ev && ev.type === 'pointerup') this._tap(d, ev.clientX);
        this._upd();
      };
      const up = (ev) => end(ev, false), cn = (ev) => end(ev, !d.moved);
      window.addEventListener('pointermove', mv, true);
      window.addEventListener('pointerup', up, true);
      window.addEventListener('pointercancel', cn, true);
    }
    _move(d, x) {
      const f = this._pos(d, x);
      if (d.kind === 'main') {
        if (d.onoff) { const on = f > 0.5; if (on !== (d.p != null ? d.p > 0 : d.p0 > 0)) M.haptic('light'); d.p = on ? 100 : 0; this._upd(); return; }
        let p = Math.round(f * 100);
        const c = this._cfg, lo = Math.max(1, Number(c.brightness_min) || 1), hi = Math.max(lo, Number(c.brightness_max) || 100);
        if (p > 0) p = M.clamp(p, lo, hi);
        if (p !== d.p) {
          if ((p === 0 || p === 100) && d.p != null) M.haptic('light');
          d.p = p;
          this._upd();
          this._send(p, false);
        }
        return;
      }
      const [kmin, kmax] = this._kr || [2000, 6500];
      if (d.kind === 'ct') {
        const k = Math.round((kmin + f * (kmax - kmin)) / 50) * 50;
        if (k === d.p) return;
        d.p = k; this._xd = { kind: 'ct', v: k };
        this._xprev = { css: css(kelvinRgb(k)), until: Date.now() + 2500 };
      } else {
        const h = Math.round(f * 360);
        if (h === d.p) return;
        d.p = h; this._xd = { kind: 'hue', v: h };
        this._xprev = { css: css(hsRgb([h, 100])), until: Date.now() + 2500 };
      }
      this._upd();
      this._send(d.p, false, d.kind);
    }
    _commit(d) {
      if (d.kind === 'main' && d.onoff) { if (d.p != null && (d.p > 0) !== (d.p0 > 0)) { this._pend = { p: d.p, t: Date.now() }; this._call(d.p); } return; }
      if (d.p == null) return;
      if (d.kind === 'main') this._pend = { p: d.p, t: Date.now() };
      this._send(d.p, true, d.kind);
      if (d.kind !== 'main') setTimeout(() => { this._xd = null; }, 2500);
    }
    _tap(d, x) {
      if (d.kind !== 'main') { this._move(d, x); this._commit(d); return; }
      const st = this._st();
      M.haptic('light');
      if (st.p > 0) { this._pend = { p: 0, t: Date.now() }; this._call(0); return; }
      if (st.onoff) this._pend = { p: 100, t: Date.now() }; // dimbart: nivået kommer fra HA (forrige nivå)
      this._call(-1);
    }
    _key(e) {
      const st = this._st();
      if (st.dis) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this._call(st.p > 0 ? 0 : -1); return; }
      if (st.onoff) return;
      const dlt = { ArrowRight: 5, ArrowUp: 5, ArrowLeft: -5, ArrowDown: -5 }[e.key];
      if (!dlt) return;
      e.preventDefault();
      const p = M.clamp(st.p + dlt, 0, 100);
      this._pend = { p, t: Date.now() };
      this._send(p, true);
      this._upd();
    }
    // light.turn_on {brightness_pct} throttlet 150 ms mens man drar, alltid én gang ved slipp
    _send(v, final, kind = 'main') {
      const now = Date.now();
      this._q = v; this._qk = kind;
      const fire = () => { this._sentAt = Date.now(); const q = this._q, k = this._qk; this._q = null; if (this._lastSent && this._lastSent[0] === k && this._lastSent[1] === q) return; this._lastSent = [k, q]; this._fire(q, k); };
      if (final) { if (this._tm) { clearTimeout(this._tm); this._tm = null; } this._lastSent = null; fire(); return; }
      if (now - this._sentAt >= 150) { if (this._tm) { clearTimeout(this._tm); this._tm = null; } fire(); return; }
      if (!this._tm) this._tm = setTimeout(() => { this._tm = null; if (this._q != null) fire(); }, 150 - (now - this._sentAt));
    }
    _fire(v, kind) {
      if (kind === 'ct') return this._svc({ color_temp_kelvin: v });
      if (kind === 'hue') return this._svc({ hs_color: [v, 100] });
      return this._call(v);
    }
    _svc(data) {
      const ids = this._ids(), id = ids[0], dom = String(id).split('.')[0];
      if (dom !== 'light') return undefined;
      return M.call(this._h, 'light', 'turn_on', { entity_id: id, ...data });
    }
    // p: 0 = av, -1 = på (forrige nivå), 1–100 = lysstyrke. Utelamper (switch/input_boolean …) går via homeassistant.*
    _call(p) {
      const h = this._h, ids = this._ids(), grp = this._grp();
      if (!h || !ids.length) return undefined;
      const D = (id) => (String(id).startsWith('light.') ? 'light' : 'homeassistant');
      const by = (list, svc, extra) => {
        const L = list.filter((id) => D(id) === 'light'), O = list.filter((id) => D(id) !== 'light');
        if (L.length) M.call(h, 'light', svc, { entity_id: grp ? L : L[0], ...(extra || {}) });
        if (O.length) M.call(h, 'homeassistant', svc, { entity_id: grp ? O : O[0] });
      };
      if (!p) return by(ids, 'turn_off');
      const st = this._st();
      if (p < 0 || st.onoff) return by(ids, 'turn_on');
      if (!grp) return by(ids, 'turn_on', { brightness_pct: p });
      const dim = Array.isArray(this._cfg.dim_ids) ? ids.filter((id) => this._cfg.dim_ids.includes(id)) : ids.filter((id) => h.states[id] && M.lightType(h.states[id]) !== 'onoff');
      if (dim.length) M.call(h, 'light', 'turn_on', { entity_id: dim, brightness_pct: p });
      const plain = ids.filter((id) => !dim.includes(id));
      if (plain.length) by(plain, 'turn_on');
      return undefined;
    }
  }
  if (!customElements.get(TAG)) customElements.define(TAG, LightSlider);
  M.LightSlider = LightSlider;

  /* ------------------------------------------------------------ montering i kortene */
  // Egen farge i kortets config: overrides: { 'light.x': { color } } (går foran lampens farge)
  const ov = (card, id) => { const o = card && card.config && card.config.overrides; const v = o && o[id]; return v && typeof v === 'object' && v.color ? String(v.color) : null; };
  M.mountLightRows = function (card, cfgOf) {
    const R = card.shadowRoot, h = card.hass;
    if (!R || !h) return;
    const map = (card._lc = card._lc || new Map());
    R.querySelectorAll('[data-lc]').forEach((wrap) => {
      const id = wrap.dataset.lc;
      if (!wrap.__lcGuard) {
        wrap.__lcGuard = true;
        const stop = (e) => e.stopPropagation(); // fallgruve 2 (slideren stopper også selv)
        wrap.addEventListener('pointerdown', stop);
        wrap.addEventListener('touchstart', stop, { passive: true });
        wrap.addEventListener('touchmove', stop, { passive: true });
      }
      let rec = map.get(id);
      if (!rec) { rec = { el: document.createElement(TAG), json: '' }; map.set(id, rec); }
      const cfg = cfgOf(id, wrap), oc = ov(card, id);
      if (oc && !cfg.color) cfg.color = oc;
      const json = JSON.stringify(cfg);
      if (rec.el.parentNode !== wrap) { wrap.textContent = ''; wrap.appendChild(rec.el); }
      if (rec.json !== json) { try { rec.el.setConfig(cfg); rec.json = json; } catch (e) { console.warn('[ki-msh] lys', id, e); } }
      if (rec.el.hass !== h) rec.el.hass = h;
    });
  };
  M.lightRowsHass = function (card, h) {
    if (card._lc) card._lc.forEach((rec) => { if (rec.el.isConnected && rec.el.hass !== h) rec.el.hass = h; });
  };
  M.LIGHT_ROW_CSS = `
    .lsl{display:block;min-width:0;min-height:calc(var(--lr-h,52px) + 28px)}
    .lsl ${TAG}{display:block}
  `;
})();
