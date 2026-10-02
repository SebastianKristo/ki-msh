/* KI MSH · felles lys-rad for Rom → Lys (31-rom.js) og Lys-popupen (43-lys.js).
 * Bruker mysmart-light-control (norsk kopi, src/vendor/mysmart-light-control-no.js) i «msh»-modus, så alle lys får
 * nøyaktig samme rad: navn 15/500 #e1e1e1 til venstre, verdi 13 #979797 til høyre («45 %» / «Av» / «På»), 8 px ned til
 * sporet, spor 40 px (slider_height 32–56) radius 14, håndtak 4 × 28 inni sporet, alltid 32 px chevron-kolonne til høyre.
 * Farger: av = spor #545454 uten fyll, håndtak #979797 helt til venstre. På = lampens farge (19.2, M.lampColor): farge-
 * modus → rgb_color, color_temp → Kelvin-tone, ellers temagul; overrides.<id>.color / lights.<id>.color går foran. Fyll =
 * fargen under en 22→50 %-maske (mørke farger 30→60 %), overgang 300 ms. Aldri romfarge/adaptiv/localStorage.
 * Av/på-lys: samme spor, trykk veksler. Dra = lysstyrke (touch-action pan-y + stopPropagation), én haptic ved slipp.
 *   M.lightType(state)                          → 'color' | 'ct' | 'dim' | 'onoff' (fra supported_color_modes)
 *   M.lightRowCfg(id, { name, type, user, height }) → config til mysmart-light-control
 *       user = lights.<objekt-id> (brightness_min/max, color_control, hide_*, color_presets, live_update)
 *   M.lightRowHeight(cfg)                       → slider_height (32–56, std 40)
 *   M.mountLightRows(card, cfgOf(id, wrap))     → monter/oppdater i plassholdere [data-lc] (gjenbrukes per entity)
 *   M.lightRowsHass(card, hass)                 → gi nye hass til monterte rader
 *   M.LIGHT_ROW_CSS                             → CSS for plassholderne (.lsl; høyden fra --lr-h på en forelder)
 */
(function () {
  const M = window.MSH;
  if (!M || M.lightRowCfg) return;
  const esc = M.esc;
  const COLOR = ['hs', 'rgb', 'rgbw', 'rgbww', 'xy'];

  M.lightType = function (s) {
    const m = (s && s.attributes.supported_color_modes) || [];
    if (m.some((x) => COLOR.includes(x))) return 'color';
    if (m.includes('color_temp')) return 'ct';
    if (m.some((x) => x !== 'onoff') || (!m.length && s && s.attributes.brightness != null)) return 'dim';
    return 'onoff';
  };
  // Slider-høyde: slider_height (32–56), ellers eldre tile_height (56 → 40, 64 → 48, 72 → 56) / size: compact → 32
  M.lightRowHeight = function (c) {
    c = c || {};
    const v = Number(c.slider_height);
    if (c.slider_height != null && c.slider_height !== '' && !isNaN(v)) return Math.max(32, Math.min(56, Math.round(v)));
    if (c.size === 'compact') return 32;
    const th = Number(c.tile_height);
    if (!c.size && th >= 56) return Math.max(32, Math.min(56, 40 + (th - 56)));
    return 40;
  };
  // 19.2 · Lampens egen farge når den er på (Lys v4 → LC(k)/KEL()): farge-modus → rgb_color, color_temp → Kelvin-tone
  // (≤2400 oransje · ≤3000 gul · ≤4200 krem · ellers kald hvit), ellers temagul. override (config) går foran, preview
  // (rgb-streng mens man drar i farge/temperatur) går foran lampen. → { css, lum } (lum 0–1, relativ luminans)
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
  // Fyll (maske over lampefargen): 22 % → 50 %, mørke/mettede farger (lum < 0,35) løftes til 30 % → 60 %
  M.lampMask = (lum) => (lum < 0.35 ? 'linear-gradient(90deg, rgb(0 0 0 / .3), rgb(0 0 0 / .6))' : 'linear-gradient(90deg, rgb(0 0 0 / .22), rgb(0 0 0 / .5))');

  const B = (v) => (v === true || v === 'true' ? true : v === false || v === 'false' ? false : undefined);
  M.lightRowCfg = function (id, { name, type, user, height, color } = {}) {
    const u = user || {};
    const T = type || 'dim';
    const out = {
      entity: id, msh: true, msh_type: T, msh_height: height || 40, size: 'large', show_name: true, show_icon: false, show_brightness: true,
      live_update: false, adaptive_slider_color: false, card_background: 'transparent', show_expand_toggle: true,
      // lystype styrer ekstra-kontrollene (chevron): bare lys som faktisk har farge/temperatur
      force_toggle_mode: T === 'onoff',
      hide_temperature_slider: !(T === 'ct' || T === 'color'),
      hide_color_controls: T !== 'color',
      hide_color_presets: T !== 'color',
      color_control: 'both',
    };
    if (name) out.name = name;
    if (color) out.msh_color = color;
    Object.keys(u).forEach((k) => {
      let v = u[k];
      if (v == null || v === '') return;
      if (k === 'color') { if (!out.msh_color) out.msh_color = String(v); return; }
      if (k === 'brightness_min' || k === 'brightness_max') { v = Number(v); if (!isNaN(v)) out[k] = v; return; }
      if (k === 'color_control' && ['spectrum', 'presets', 'both'].includes(v)) { out[k] = v; return; }
      if (k === 'live_update' || k === 'hide_temperature_slider' || k === 'hide_color_controls' || k === 'hide_color_presets') {
        v = B(v);
        // «skjul» kan bare skjule – aldri vise farge/temperatur for et lys som ikke har det
        if (v === true || (v === false && k === 'live_update')) out[k] = v;
        return;
      }
      if (k === 'color_presets') {
        const a = (Array.isArray(v) ? v : String(v).split(/,(?![^(]*\))/)).map((x) => String(x).trim()).filter(Boolean);
        if (a.length) out[k] = a;
      }
    });
    return out;
  };

  // Egen farge i kortets config: overrides: { 'light.x': { color } } (går foran lampens farge)
  const ov = (card, id) => { const o = card && card.config && card.config.overrides; const v = o && o[id]; return v && typeof v === 'object' && v.color ? String(v.color) : null; };
  // Reserverad (lys uten mysmart-light-control / finnes ikke): samme mål som den ekte raden
  const fallback = (card, id, name) => {
    const h = card.hass, s = h && h.states[id], on = s && s.state === 'on';
    const p = on && s.attributes.brightness != null ? Math.max(1, Math.round((s.attributes.brightness / 255) * 100)) : null;
    const lc = on ? M.lampColor(s, ov(card, id)) : null;
    const val = !s ? 'Finnes ikke' : M.unavailable && M.unavailable(s) ? 'Utilgjengelig' : on ? (p != null ? `${p} %` : 'På') : 'Av';
    return `<div class="lrf"><div class="lrf-hd"><span class="lrf-n">${esc(name || (s ? M.name(h, id) : id))}</span><span class="lrf-v">${esc(val)}</span></div>
      <div class="lrf-t"><span class="lrf-f" style="width:${on ? (p != null ? p : 100) : 0}%${on ? `;background-color:${lc.css};-webkit-mask-image:${M.lampMask(lc.lum)};mask-image:${M.lampMask(lc.lum)}` : ''}"></span></div></div>`;
  };

  // Utelamper kan være switch/input_boolean/group/script: raden kaller light.turn_on/off → send via homeassistant.*
  const proxies = new WeakMap();
  const hassFor = (id, h) => {
    if (!h || String(id).startsWith('light.')) return h;
    let p = proxies.get(h);
    if (!p) { p = Object.create(h); p.callService = (d, s, data, ...r) => h.callService(d === 'light' ? 'homeassistant' : d, s, data, ...r); proxies.set(h, p); }
    return p;
  };
  M.mountLightRows = function (card, cfgOf) {
    const R = card.shadowRoot, h = card.hass;
    if (!R || !h) return;
    const map = (card._lc = card._lc || new Map());
    const ok = !!customElements.get('mysmart-light-control');
    R.querySelectorAll('[data-lc]').forEach((wrap) => {
      const id = wrap.dataset.lc;
      if (!wrap.__lcGuard) {
        wrap.__lcGuard = true;
        // Drag-vern mot Bubble Cards swipe-to-close; én haptic «light» ved slipp (ikke per trinn)
        const stop = (e) => e.stopPropagation();
        wrap.addEventListener('pointerdown', (e) => {
          stop(e);
          if (e.button) return;
          const done = (ev) => {
            window.removeEventListener('pointerup', done, true);
            window.removeEventListener('pointercancel', done, true);
            if (ev.type === 'pointerup') M.haptic('light');
          };
          window.addEventListener('pointerup', done, true);
          window.addEventListener('pointercancel', done, true);
        });
        wrap.addEventListener('touchstart', stop, { passive: true });
        wrap.addEventListener('touchmove', stop, { passive: true });
      }
      const s = h.states[id];
      if (!ok || !s) { const html = fallback(card, id, wrap.dataset.name); if (wrap.__fb !== html) { wrap.innerHTML = html; wrap.__fb = html; } return; }
      wrap.__fb = null;
      let rec = map.get(id);
      if (!rec) { rec = { el: document.createElement('mysmart-light-control'), json: '' }; map.set(id, rec); }
      const cfg = cfgOf(id, wrap), oc = ov(card, id);
      if (oc && !cfg.msh_color) cfg.msh_color = oc;
      const json = JSON.stringify(cfg);
      if (rec.json !== json) { try { rec.el.setConfig(cfg); rec.json = json; } catch (e) { console.warn('[ki-msh] lys', id, e); } }
      const hh = hassFor(id, h);
      if (rec.el.hass !== hh) rec.el.hass = hh;
      if (rec.el.parentNode !== wrap) { wrap.textContent = ''; wrap.appendChild(rec.el); }
    });
  };
  M.lightRowsHass = function (card, h) {
    if (card._lc) card._lc.forEach((rec, id) => { const hh = hassFor(id, h); if (rec.el.isConnected && rec.el.hass !== hh) rec.el.hass = hh; });
  };
  M.LIGHT_ROW_CSS = `
    .lsl{display:block;min-width:0;min-height:calc(var(--lr-h,40px) + 28px)}
    .lsl mysmart-light-control{--gray1000:var(--ki-text-1, #e1e1e1);--gray700:var(--ki-text-mid, #979797);--gray400:var(--ki-surface-3, #545454);display:block;--ha-card-background:transparent;--ha-card-box-shadow:none;--ha-card-border-width:0;--primary-text-color:var(--ki-text-1, var(--gray1000,#e1e1e1));--secondary-text-color:var(--ki-text-mid, var(--gray700,#979797))}
    .lrf{display:grid;grid-template-columns:minmax(0,1fr) 32px;column-gap:8px;row-gap:8px}
    .lrf-hd{grid-column:1;display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding:0 2px;min-width:0}
    .lrf-n{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:15px;font-weight:500;line-height:20px;color:var(--ki-text-1, var(--gray1000,#e1e1e1))}
    .lrf-v{flex:none;font-size:13px;line-height:20px;color:var(--ki-text-mid, var(--gray700,#979797))}
    .lrf-t{grid-column:1;position:relative;height:var(--lr-h,40px);border-radius:14px;background:var(--ki-ctrl, var(--gray400,#545454));overflow:hidden}
    .lrf-f{position:absolute;left:0;top:0;bottom:0;background-color:transparent;transition:background-color .3s ease}
  `;
})();
