/* KI MSH · felles lys-rad for Rom → Lys (31-rom.js) og Lys-popupen (43-lys.js).
 * Bruker mysmart-light-control (norsk kopi, src/vendor/mysmart-light-control-no.js) i «msh»-modus, så alle lys får
 * nøyaktig samme rad: navn 15/500 #e1e1e1 til venstre, verdi 13 #979797 til høyre («45 %» / «Av» / «På»), 8 px ned til
 * sporet, spor 40 px (slider_height 32–56) radius 14, håndtak 4 × 28 inni sporet, alltid 32 px chevron-kolonne til høyre.
 * Farger: av = spor #545454 uten fyll, håndtak #979797 helt til venstre. På = lampens farge bare når den støttes
 * (farge → rgb_color, bare temperatur → Kelvin-farge, ellers rgb(225 225 225 / .55)). Aldri romfarge/adaptiv/localStorage.
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
  const B = (v) => (v === true || v === 'true' ? true : v === false || v === 'false' ? false : undefined);
  M.lightRowCfg = function (id, { name, type, user, height } = {}) {
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
    Object.keys(u).forEach((k) => {
      let v = u[k];
      if (v == null || v === '') return;
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

  // Reserverad (lys uten mysmart-light-control / finnes ikke): samme mål som den ekte raden
  const fallback = (card, id, name) => {
    const h = card.hass, s = h && h.states[id], on = s && s.state === 'on';
    const p = on && s.attributes.brightness != null ? Math.max(1, Math.round((s.attributes.brightness / 255) * 100)) : null;
    const val = !s ? 'Finnes ikke' : M.unavailable && M.unavailable(s) ? 'Utilgjengelig' : on ? (p != null ? `${p} %` : 'På') : 'Av';
    return `<div class="lrf"><div class="lrf-hd"><span class="lrf-n">${esc(name || (s ? M.name(h, id) : id))}</span><span class="lrf-v">${esc(val)}</span></div>
      <div class="lrf-t"><span class="lrf-f" style="width:${on ? (p != null ? p : 100) : 0}%"></span></div></div>`;
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
      const cfg = cfgOf(id, wrap), json = JSON.stringify(cfg);
      if (rec.json !== json) { try { rec.el.setConfig(cfg); rec.json = json; } catch (e) { console.warn('[ki-msh] lys', id, e); } }
      if (rec.el.hass !== h) rec.el.hass = h;
      if (rec.el.parentNode !== wrap) { wrap.textContent = ''; wrap.appendChild(rec.el); }
    });
  };
  M.lightRowsHass = function (card, h) {
    if (card._lc) card._lc.forEach((rec) => { if (rec.el.isConnected && rec.el.hass !== h) rec.el.hass = h; });
  };
  M.LIGHT_ROW_CSS = `
    .lsl{display:block;min-width:0;min-height:calc(var(--lr-h,40px) + 28px)}
    .lsl mysmart-light-control{display:block;--ha-card-background:transparent;--ha-card-box-shadow:none;--ha-card-border-width:0;--primary-text-color:var(--gray1000,#e1e1e1);--secondary-text-color:var(--gray700,#979797)}
    .lrf{display:grid;grid-template-columns:minmax(0,1fr) 32px;column-gap:8px;row-gap:8px}
    .lrf-hd{grid-column:1;display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding:0 2px;min-width:0}
    .lrf-n{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:15px;font-weight:500;line-height:20px;color:var(--gray1000,#e1e1e1)}
    .lrf-v{flex:none;font-size:13px;line-height:20px;color:var(--gray700,#979797)}
    .lrf-t{grid-column:1;position:relative;height:var(--lr-h,40px);border-radius:14px;background:var(--gray400,#545454);overflow:hidden}
    .lrf-f{position:absolute;left:0;top:0;bottom:0;background:rgb(225 225 225 / .55)}
  `;
})();
