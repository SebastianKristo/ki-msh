/* msh-lys-card · Lys-popup (#lys). Kilde: Lys v4.dc.html.
 * Faner: Utelys · én per etasje (hass.floors) · Lys på. Raden scroller vannrett; langt trykk + dra = omorganiser
 * (MSH.tabReorder, 05-tab-reorder.js → config.tab_order via ki-store) – virker med mus og touch.
 * Lys: mysmart-light-control per lys (gjenbrukt per entity, i data-nomorph-plassholdere). Innstillinger per lys under
 * lights.<object_id> {size, label_layout, show_icon/name/brightness, brightness_min/max, slider_color_mode,
 * color_control, force_toggle_mode, hide_*, farger, color_presets} – i kortets egen editor og GUI-editoren.
 * Autokonfig: alle light.* gruppert per etasje/område (M.areaOf + hass.areas/hass.floors, pluss KI Rom `lys`).
 * Utelys = lys i utendørs etasje/område (Ute, Hage, Terrasse …) eller med «ute» i navnet; config.lamps overstyrer.
 * Totaler fra sensor.hele_huset_lys (KI Rom) når den finnes. Sol fra sun.*. Slidere med drag-vern.
 */
(function () {
  const M = window.MSH, esc = M.esc, C = M.C;
  const PINK = C.accent, INK = '#3a3a3a', Y = C.yellow, G = C.green;
  const OUT_RX = /(^|[_\s.])(ute\w*|utendors\w*|utvendig\w*|hage\w*|terrasse\w*|veranda\w*|fasade\w*|inngang\w*|garasje\w*|carport|balkong\w*|uteplass\w*|outdoor\w*|outside|garden|patio|porch|yard)($|[_\s.])/;
  const OUT_FLOOR_RX = /(ute|utendors|utvendig|outdoor|outside|garden|hage|yard)/;
  const DEF = { mode: 'auto', kveld: true, morgen: true, morning: '06:00', offset: -15, lux_on: 40, lux_off: 120, latest: '' };
  const PRESETS = [['max', 'Maks', 'light_mode', 100], ['kveld', 'Kveld', 'weekend', 45], ['dim', 'Dempet', 'brightness_4', 20], ['natt', 'Natt', 'bedtime', 5], ['av', 'Alt av', 'dark_mode', 0]];
  const hay = (hass, id) => M.slug(id + ' ' + ((hass.states[id] && hass.states[id].attributes.friendly_name) || ''));
  const mins = (t) => { const m = /^(\d{1,2}):(\d\d)/.exec(String(t || '')); return m ? +m[1] * 60 + +m[2] : null; };
  const fmt = (m) => (m == null ? '–' : `${M.pad(Math.floor(((m % 1440) + 1440) % 1440 / 60))}:${M.pad(((m % 60) + 60) % 60)}`);
  const hm = (iso) => { if (!iso) return null; const d = new Date(iso); return isNaN(d) ? null : d.getHours() * 60 + d.getMinutes(); };
  const P = (m) => ((((m - 720) % 1440) + 1440) % 1440) / 1440 * 100;
  const pctOf = (s) => (!s || s.state !== 'on' ? 0 : s.attributes.brightness != null ? Math.max(1, Math.round((s.attributes.brightness / 255) * 100)) : 100);
  const dimmable = (s) => { const m = (s && s.attributes.supported_color_modes) || []; return m.length ? m.some((x) => x !== 'onoff') : s && s.attributes.brightness != null; };
  const obj = (id) => String(id || '').split('.').slice(1).join('.');
  const cap = (n) => String(n || '').charAt(0).toUpperCase() + String(n || '').slice(1);
  // Lystype fra supported_color_modes: farge (hs/rgb/xy) → temperatur → dimbar → kun av/på
  const lightType = (s) => {
    const m = (s && s.attributes.supported_color_modes) || [];
    if (m.some((x) => ['hs', 'rgb', 'rgbw', 'rgbww', 'xy'].includes(x))) return 'color';
    if (m.includes('color_temp')) return 'ct';
    if (m.some((x) => x !== 'onoff') || (!m.length && s && s.attributes.brightness != null)) return 'dim';
    return 'onoff';
  };
  const LS = [['', 'Auto'], ['small', 'Liten'], ['medium', 'Middels'], ['large', 'Stor'], ['xlarge', 'Ekstra stor'], ['jumbo', 'Jumbo']];
  const LL = [['', 'Auto'], ['title_outside_icon_inside', 'Tittel over, ikon i slideren'], ['icon_title_outside', 'Ikon og tittel over']];
  const LM = [['', 'Auto (etter type)'], ['custom', 'Egne farger'], ['custom_temperature', 'Fast fargetemperatur'], ['light_temperature', 'Lysets temperatur'], ['light_rgb', 'Lysets farge']];
  const LC = [['', 'Auto'], ['spectrum', 'Spekter'], ['presets', 'Forhåndsvalg'], ['both', 'Begge']];

  /* ------------------------------------------------------------ autokonfig */
  M.lysAuto = function (hass, cfg) {
    cfg = cfg || {};
    const out = { floors: [], outAuto: [], all: [] };
    if (!hass) return out;
    const all0 = M.all(hass, 'light');
    const areas = M.areas(hass);
    const aOf = {};
    all0.forEach((id) => { aOf[id] = M.areaOf(hass, id); });
    // KI Rom: lys-attributt per rom (for lys uten område i registeret)
    areas.forEach((a) => { const ov = M.kiRom(hass, a.id, 'oversikt'); if (ov && Array.isArray(ov.attributes.lys)) M.ids(ov.attributes.lys).forEach((id) => { if (all0.includes(id) && !aOf[id]) aOf[id] = a.id; }); });
    const isOutArea = (a) => a && ((a.floorName && OUT_FLOOR_RX.test(M.slug(a.floorName))) || (a.floor && OUT_FLOOR_RX.test(a.floor)) || OUT_RX.test(M.slug(a.name)) || OUT_RX.test(a.id));
    const areaMap = Object.fromEntries(areas.map((a) => [a.id, a]));
    out.outAuto = all0.filter((id) => isOutArea(areaMap[aOf[id]]) || (!aOf[id] && OUT_RX.test(hay(hass, id))));
    out.all = M.applyLists(cfg, 'lys', all0);
    out.allAuto = all0;
    // Utelys: config.lamps vinner, ellers auto (+include.utelys, −exclude)
    if (Array.isArray(cfg.lamps) && cfg.lamps.length) out.lamps = cfg.lamps.filter((l) => l && l.entity).map((l) => ({ id: l.entity, name: l.name || M.name(hass, l.entity), icon: l.icon || null }));
    else out.lamps = M.applyLists(cfg, 'utelys', out.outAuto).map((id) => ({ id, name: M.name(hass, id), icon: null }));
    const outSet = new Set(out.lamps.map((l) => l.id).concat(out.outAuto));
    // Etasjer → rom → lys (utendørs etasjer er dekket av Utelys-fanen)
    const inside = out.all.filter((id) => !outSet.has(id));
    const byArea = {};
    inside.forEach((id) => { const a = aOf[id] || '_'; (byArea[a] = byArea[a] || []).push(id); });
    const floors = M.floors(hass).filter((f) => !OUT_FLOOR_RX.test(M.slug(f.name)) && !OUT_FLOOR_RX.test(f.floor_id));
    floors.forEach((f) => {
      const rooms = areas.filter((a) => a.floor === f.floor_id && byArea[a.id]).map((a) => ({ area: a.id, name: a.name, icon: a.icon, ids: byArea[a.id] }));
      if (rooms.length) out.floors.push({ key: 'f:' + f.floor_id, id: f.floor_id, name: f.name, icon: f.icon, rooms });
    });
    const rest = areas.filter((a) => (!a.floor || !floors.find((f) => f.floor_id === a.floor)) && byArea[a.id] && !isOutArea(a)).map((a) => ({ area: a.id, name: a.name, icon: a.icon, ids: byArea[a.id] }));
    if (byArea._) rest.push({ area: null, name: 'Uten rom', icon: 'mdi:home-outline', ids: byArea._ });
    if (rest.length) out.floors.push({ key: 'f:_', id: null, name: out.floors.length ? 'Andre' : 'Inne', icon: null, rooms: rest });
    out.aOf = aOf;
    // Sensorer / brytere
    const sun = M.all(hass, 'sun')[0] || null;
    out.sun = sun;
    const outAreas = areas.filter(isOutArea).map((a) => a.id);
    out.autoLux = M.all(hass, 'sensor', (s, id) => s.attributes.device_class === 'illuminance' && (outAreas.includes(M.areaOf(hass, id)) || OUT_RX.test(hay(hass, id))))[0] || null;
    out.lux = M.pick(cfg, 'lux', out.autoLux);
    out.autoAuto = M.all(hass, 'input_boolean', (s, id) => /utelys/.test(hay(hass, id)) && /(auto|automatikk)/.test(hay(hass, id)))[0] || null;
    out.auto = M.pick(cfg, 'automatikk', out.autoAuto);
    out.autoModus = M.all(hass, 'input_select', (s, id) => /utelys/.test(hay(hass, id)))[0] || null;
    out.modus = M.pick(cfg, 'modus', out.autoModus);
    out.autoKveld = M.all(hass, 'input_boolean', (s, id) => /utelys/.test(hay(hass, id)) && /kveld/.test(hay(hass, id)))[0] || null;
    out.kveld = M.pick(cfg, 'kveld_bryter', out.autoKveld);
    out.autoMorgen = M.all(hass, 'input_boolean', (s, id) => /utelys/.test(hay(hass, id)) && /morgen/.test(hay(hass, id)))[0] || null;
    out.morgen = M.pick(cfg, 'morgen_bryter', out.autoMorgen);
    out.total = M.kiRomId(hass, null, 'lys');
    return out;
  };

  class Lys extends M.Card {
    static get cardName() { return 'Lys'; }
    static get defaults() { return {}; }
    static get schema() {
      return (h, c) => {
        const a = M.lysAuto(h, c || {});
        const tabs = [['out', 'Utelys'], ...a.floors.map((f) => [f.key, f.name]), ['on', 'Lys på']];
        return [
          { type: 'lists', label: 'Entiteter', lists: () => [
            { key: 'lys', label: 'Lys (etasjer)', ids: a.allAuto, domains: ['light'] },
            { key: 'utelys', label: 'Utelys (når «Utelamper» ikke er satt)', ids: a.outAuto, domains: ['light'] },
          ] },
          { type: 'overrides', label: 'Bytt sensor/brytere', fields: [
            { name: 'lux', label: 'Lysnivåsensor (ute)', domain: 'sensor', device_class: 'illuminance', auto: () => a.autoLux },
            { name: 'automatikk', label: 'Automatikk-bryter', domain: 'input_boolean', auto: () => a.autoAuto },
            { name: 'modus', label: 'Modusvelger (Auto/Tidsplan/Manuelt)', domain: 'input_select', auto: () => a.autoModus },
            { name: 'kveld_bryter', label: 'Kveld-bryter', domain: 'input_boolean', auto: () => a.autoKveld },
            { name: 'morgen_bryter', label: 'Morgen-bryter', domain: 'input_boolean', auto: () => a.autoMorgen },
          ] },
          { type: 'order', name: 'tab_order', hiddenName: 'hidden_tabs', label: 'Faner (rekkefølge og synlighet)', options: tabs },
          { type: 'select', name: 'start_tab', label: 'Startfane', options: tabs },
          { type: 'section', label: 'Utelys · tider', id: 'utelys', icon: 'mdi:clock-outline', fields: [
            { type: 'select', name: 'mode', label: 'Styring', options: [['auto', 'Auto'], ['tid', 'Tidsplan'], ['manuell', 'Manuelt']], default: 'auto' },
            { type: 'text', name: 'on', label: 'Tennes (HH:MM)', help: 'Tomt = solnedgang + forskyvning', auto: () => fmtSun(h, c, 'on') },
            { type: 'text', name: 'off', label: 'Slukkes (HH:MM)', help: 'Tomt = soloppgang', auto: () => fmtSun(h, c, 'off') },
            { type: 'text', name: 'latest', label: 'Slukk senest (HH:MM)' },
            { type: 'text', name: 'morning', label: 'Morgen fra (HH:MM)', placeholder: '06:00' },
            { type: 'number', name: 'offset', label: 'Forskyvning skumring (min)', step: 5, placeholder: '-15' },
            { type: 'number', name: 'lux_on', label: 'Tenn under (lx)', step: 5, placeholder: '40' },
            { type: 'number', name: 'lux_off', label: 'Slukk over (lx)', step: 5, placeholder: '120' },
            { type: 'boolean', name: 'kveld', label: 'Kveld · tenn i skumringen', default: true },
            { type: 'boolean', name: 'morgen', label: 'Morgen · tenn før det lysner', default: true },
          ] },
          { type: 'section', label: 'Lys · slidere', id: 'lys', icon: 'mdi:lightbulb', meta: () => `${lightIds(a).length} lys`, fields: [
            { type: 'info', label: 'Per lys (lagres under lights.<objekt-id>, f.eks. lights.stue_tak). Tomt = auto: farge-/temperatur-/dimbar slider etter lystype, romfargen som fyll.' },
            ...lightIds(a).map((id) => {
              const p = 'lights.' + obj(id), st = h && h.states[id];
              return { type: 'section', label: cap(M.name(h, id)), icon: 'mdi:lightbulb', meta: () => ({ color: 'Farge', ct: 'Temperatur', dim: 'Dimbar', onoff: 'Av/på' })[lightType(st)], fields: [
                { type: 'select', name: p + '.size', label: 'Størrelse', options: LS, help: 'Auto: Middels' },
                { type: 'select', name: p + '.label_layout', label: 'Tittel og ikon', options: LL },
                { type: 'boolean', name: p + '.show_name', label: 'Vis navn', default: true },
                { type: 'boolean', name: p + '.show_icon', label: 'Vis ikon', default: false },
                { type: 'boolean', name: p + '.show_brightness', label: 'Vis lysstyrke (%)', default: true },
                { type: 'boolean', name: p + '.force_toggle_mode', label: 'Kun av/på (bryter)', default: lightType(st) === 'onoff' },
                { type: 'number', name: p + '.brightness_min', label: 'Minste lysstyrke (%)', min: 0, max: 100, placeholder: '0' },
                { type: 'number', name: p + '.brightness_max', label: 'Største lysstyrke (%)', min: 0, max: 100, placeholder: '100' },
                { type: 'select', name: p + '.slider_color_mode', label: 'Sliderfarge', options: LM },
                { type: 'select', name: p + '.color_control', label: 'Fargekontroll (utvidet)', options: LC },
                { type: 'boolean', name: p + '.hide_temperature_slider', label: 'Skjul temperaturslider', default: false },
                { type: 'boolean', name: p + '.hide_color_controls', label: 'Skjul fargespekter', default: false },
                { type: 'boolean', name: p + '.hide_color_presets', label: 'Skjul fargeforhåndsvalg', default: false },
                { type: 'color', name: p + '.bar_foreground', label: 'Slider · fylt del', help: 'Tomt = romfargen' },
                { type: 'color', name: p + '.bar_background', label: 'Slider · bakgrunn', auto: () => 'var(--gray300, #404040)' },
                { type: 'color', name: p + '.handle_color', label: 'Håndtak', auto: () => 'var(--gray1000, #e1e1e1)' },
                { type: 'color', name: p + '.icon_color', label: 'Ikonfarge', auto: () => 'var(--gray1000, #e1e1e1)' },
                { type: 'color', name: p + '.chevron_color', label: 'Pil (utvid)' },
                { type: 'text', name: p + '.color_presets', label: 'Fargeforhåndsvalg', placeholder: '#ffb74c, #ff8a65, rgb(129, 212, 250)', help: 'Kommaseparert liste' },
              ] };
            }),
          ] },
          { type: 'gap' },
          { type: 'boolean', name: 'toasts', label: 'Bekreftelsesmeldinger', default: true },
        ];
      };
    }
    get cardSize() { return 10; }
    get cfg() { return { ...DEF, ...this.config }; }

    /* ---------------- tider */
    _times(A) {
      const c = this.cfg, sun = this.s(A.sun), at = (sun && sun.attributes) || {};
      const set = hm(at.next_setting), rise = hm(at.next_rising), dusk = hm(at.next_dusk);
      const on = mins(c.on) != null ? mins(c.on) : set != null ? set + Number(c.offset || 0) : null;
      const off = mins(c.off) != null ? mins(c.off) : rise;
      return { set, rise, dusk, on, off };
    }

    render() {
      const c = this.cfg, A = M.lysAuto(this.hass, this.config), ui = this.ui;
      this._A = A;
      const keys = ['out', ...A.floors.map((f) => f.key), 'on'];
      const names = Object.fromEntries([['out', 'Utelys'], ...A.floors.map((f) => [f.key, f.name]), ['on', 'Lys på']]);
      const tabs = M.mshOrder(keys, c.tab_order, c.hidden_tabs);
      const tab = tabs.includes(ui.tab) ? ui.tab : tabs.includes(c.start_tab) ? c.start_tab : tabs[0];
      const body = tab === 'out' ? this._out(A) : tab === 'on' ? this._on(A) : this._floor(A, A.floors.find((f) => f.key === tab));
      return `<div class="wrap">
        <div class="tw"><div class="tbox"><div class="tabs msh-tr" data-gd-skip>${tabs.map((k) => `<button class="tab${k === tab ? ' on' : ''}" data-act="tab" data-key="${esc(k)}" data-haptic="selection" style="background:${k === tab ? PINK : 'transparent'};color:${k === tab ? INK : 'var(--gray800,#afafaf)'}">${esc(names[k])}</button>`).join('')}</div></div></div>
        ${body || ''}
      </div>`;
    }

    /* ---------------- lys: mysmart-light-control per lys (plassholder data-nomorph, fylles i _mountLights) */
    _light(id, name, area) {
      const s = this.s(id);
      if (!s) return this._tile(id, false, name);
      return `<div class="lsl" data-key="lc-${esc(id)}" data-lc="${esc(id)}" data-name="${esc(name || '')}" data-area="${esc(area || '')}" data-nomorph></div>`;
    }
    _lightCfg(id, name, area) {
      const h = this.hass, c = this.config, L = c.lights || {}, s = h.states[id];
      const u = { ...(L[id] || {}), ...(L[obj(id)] || {}) };
      const T = lightType(s);
      const romfarge = area && M.romColor ? M.romColor(area, h) : Y;
      const mode = T === 'color' ? { slider_color_mode: 'light_rgb', color_control: 'both' } : T === 'ct' ? { slider_color_mode: 'light_temperature' } : T === 'dim' ? { slider_color_mode: 'custom' } : { force_toggle_mode: true };
      const out = { entity: id, size: 'medium', label_layout: 'title_outside_icon_inside', show_brightness: true, live_update: false,
        slider_color_mode: mode.slider_color_mode, card_background: 'transparent', bar_background: 'var(--gray300, #404040)', bar_foreground: romfarge,
        handle_color: 'var(--gray1000, #e1e1e1)', icon_color: 'var(--gray1000, #e1e1e1)', ...mode };
      if (name) out.name = name;
      if (!out.slider_color_mode) delete out.slider_color_mode;
      const B = (v) => (v === true || v === 'true' ? true : v === false || v === 'false' ? false : undefined);
      Object.keys(u).forEach((k) => {
        let v = u[k];
        if (v == null || v === '') return;
        if (['show_icon', 'show_name', 'show_brightness', 'hide_temperature_slider', 'hide_color_controls', 'hide_color_presets', 'force_toggle_mode', 'live_update', 'show_icon_on_small_sizes', 'show_expand_toggle'].includes(k)) v = B(v);
        else if (k === 'brightness_min' || k === 'brightness_max') v = Number(v);
        else if (k === 'color_presets') v = (Array.isArray(v) ? v : String(v).split(/,(?![^(]*\))/)).map((x) => String(x).trim()).filter(Boolean);
        else if (['bar_foreground', 'bar_background', 'handle_color', 'icon_color', 'chevron_color', 'card_background', 'popup_number_color'].includes(k)) v = M.color(v, undefined);
        if (v === undefined || (typeof v === 'number' && isNaN(v)) || (Array.isArray(v) && !v.length)) return;
        out[k] = v;
      });
      if (out.show_icon === true && out.show_icon_on_small_sizes == null) out.show_icon_on_small_sizes = true; // medium skjuler ellers ikonet
      if (out.force_toggle_mode === false && T === 'onoff') delete out.force_toggle_mode;
      return out;
    }
    // Monter/oppdater lys-elementene: gjenbrukes per entity, setConfig bare ved endret config, hass ved hver endring.
    _mountLights() {
      const R = this.shadowRoot, h = this.hass;
      if (!R || !h) return;
      const map = (this._lc = this._lc || new Map());
      const ok = !!customElements.get('mysmart-light-control');
      R.querySelectorAll('[data-lc]').forEach((wrap) => {
        const id = wrap.dataset.lc;
        if (!wrap.__lcGuard) {
          wrap.__lcGuard = true;
          // Drag-vern mot Bubble Cards swipe-to-close; haptic «light» ved slipp / trykk på ikon (ikke per trinn)
          const stop = (e) => e.stopPropagation();
          wrap.addEventListener('pointerdown', (e) => {
            stop(e);
            if (e.button) return;
            const up = () => { window.removeEventListener('pointerup', up, true); window.removeEventListener('pointercancel', cancel, true); M.haptic('light'); };
            const cancel = () => { window.removeEventListener('pointerup', up, true); window.removeEventListener('pointercancel', cancel, true); };
            window.addEventListener('pointerup', up, true);
            window.addEventListener('pointercancel', cancel, true);
          });
          wrap.addEventListener('touchstart', stop, { passive: true });
          wrap.addEventListener('touchmove', stop, { passive: true });
        }
        if (!ok) { if (!wrap.firstChild) wrap.innerHTML = this._tile(id, false, wrap.dataset.name); return; }
        let rec = map.get(id);
        if (!rec) { rec = { el: document.createElement('mysmart-light-control'), json: '' }; map.set(id, rec); }
        const cfg = this._lightCfg(id, wrap.dataset.name, wrap.dataset.area), json = JSON.stringify(cfg);
        if (rec.json !== json) { try { rec.el.setConfig(cfg); rec.json = json; } catch (e) { console.warn('[ki-msh] lys', id, e); } }
        if (rec.el.hass !== h) rec.el.hass = h;
        if (rec.el.parentNode !== wrap) { wrap.textContent = ''; wrap.appendChild(rec.el); }
      });
    }
    set hass(h) {
      super.hass = h;
      if (this._lc) this._lc.forEach((rec) => { if (rec.el.isConnected && rec.el.hass !== h) rec.el.hass = h; });
    }
    get hass() { return super.hass; }

    /* ---------------- reserveflis (lys som ikke finnes / uten light-control) */
    _tile(id, big, name, icon) {
      const s = this.s(id), p = pctOf(s), on = s && s.state === 'on', un = M.unavailable(s);
      const val = !s ? 'Finnes ikke' : un ? 'Utilgjengelig' : on ? (dimmable(s) ? `${p} %` : 'På') : 'Av';
      return `<div class="lt ${big ? 'big' : ''}" data-dim="${esc(id)}" data-key="${esc(id)}" data-can="${dimmable(s) ? 1 : 0}" role="button" tabindex="0">
        <span class="lf" style="width:${on && dimmable(s) ? p : on ? 100 : 0}%"></span>
        <span class="li" style="background:${on ? Y : C.ctrl};color:${on ? '#282828' : 'var(--gray500,#696969)'}">${M.icon(icon || (s && s.attributes.icon) || 'lightbulb', big ? 22 : 18)}</span>
        <span class="lx"><span class="ln ell">${esc(name || M.name(this.hass, id))}</span><span class="lv" style="color:${on ? 'var(--gray900,#c7c7c7)' : 'var(--gray500,#696969)'}">${esc(val)}</span></span>
      </div>`;
    }

    /* ---------------- Utelys */
    _out(A) {
      const c = this.cfg, T = this._times(A), L = A.lamps;
      const onN = L.filter((l) => { const s = this.s(l.id); return s && s.state === 'on'; }).length, lit = onN > 0;
      const now = new Date(), nowM = now.getHours() * 60 + now.getMinutes();
      const left = T.off != null ? (T.off - nowM + 1440) % 1440 : null;
      const dur = left != null ? `${Math.floor(left / 60)} t ${left % 60} min` : '';
      const mode = this._mode(A);
      let spanL = 0, spanW = 0;
      if (T.on != null && T.off != null) { spanL = P(T.on); spanW = ((P(T.off) - P(T.on)) + 100) % 100; }
      const marks = [[T.set, 'wb_twilight', 'var(--gray700,#979797)', 15], [T.on, 'light', Y, 0], [T.off, 'light_off', Y, 0], [T.rise, 'wb_sunny', 'var(--gray700,#979797)', 15]].filter((m) => m[0] != null);
      let out = `<section class="oc" style="background:${lit ? `linear-gradient(160deg, ${M.alpha(Y, 0.16)}, var(--gray200,#3a3a3a) 60%)` : 'var(--gray200,#3a3a3a)'};box-shadow:${lit ? `inset 0 0 0 1px ${M.alpha(Y, 0.3)}` : 'none'}">
        <div class="row" style="align-items:flex-start;gap:14px">
          <div class="grow col" style="gap:4px">
            <span class="t13" style="color:var(--gray800,#afafaf)">Utelys · ${L.length ? `${onN} av ${L.length} på` : 'ingen lamper'}</span>
            <span class="ol">${lit ? 'På' : L.length ? 'Av' : '–'}</span>
            <span class="t13" style="color:var(--gray900,#c7c7c7)">${esc(lit ? (T.off != null ? `Slukkes ${fmt(T.off)} · om ${dur}` : 'Lyser nå') : T.on != null ? `Tennes ${fmt(T.on)} i skumringen` : 'Tennes i skumringen')}</span>
          </div>
          <button class="ob" data-act="outall" data-haptic="success" title="Av/på" ${L.length ? '' : 'disabled'} style="background:${lit ? Y : C.ctrl};color:${lit ? '#282828' : 'var(--gray800,#afafaf)'};box-shadow:${lit ? `0 0 34px ${M.alpha(Y, 0.45)}` : 'none'}">${M.icon(lit ? 'light' : 'light_off', 32)}</button>
        </div>
        <div class="col" style="gap:6px">
          <div class="tl">
            ${spanW ? `<span class="dk" style="left:${spanL}%;width:${spanW}%;background:${mode === 'manuell' ? '#545457' : `linear-gradient(90deg, ${M.alpha(Y, 0.55)}, ${M.alpha(Y, 0.3)})`}"></span>` : ''}
            ${[T.set, T.rise].filter((x) => x != null).map((m) => `<span class="tk" style="left:${P(m)}%"></span>`).join('')}
            <span class="nw" style="left:calc(${P(nowM)}% - 2px)"></span>
          </div>
          <div class="mk">${marks.map(([m, ic, col, top]) => `<span style="left:${P(m)}%;top:${top}px;color:${col}">${M.icon(ic, 14)}${fmt(m)}</span>`).join('')}</div>
        </div>
      </section>`;
      out += L.length ? `<section class="lbox" data-key="lb-out">${L.map((l) => this._light(l.id, l.name, (A.aOf || {})[l.id] || M.areaOf(this.hass, l.id))).join('')}</section>` : M.emptyState('Fant ingen utelamper', 'entities');
      // Styring
      const lx = A.lux ? M.name(this.hass, A.lux) : 'lysnivåsensoren';
      const info = mode === 'auto' ? `Tennes når ${lx} er under ${c.lux_on} lx, og slukkes over ${c.lux_off} lx.` : mode === 'tid' ? `Tennes ${fmt(T.on)} (skumring ${Number(c.offset) >= 0 ? '+' : '−'}${Math.abs(Number(c.offset || 0))} min) og slukkes ${fmt(T.off)}${c.latest ? `, senest ${c.latest}` : ''}.` : 'Automatikken er av. Utelyset styres bare fra knappene over.';
      const autos = mode === 'manuell' ? [] : [['kveld', 'wb_twilight', 'Kveld', 'Tenn i skumringen', A.kveld], ['morgen', 'wb_sunny', 'Morgen', `Tenn før det lysner, fra ${c.morning || '–'}`, A.morgen]];
      out += `<section class="st">
        <div class="row" style="gap:10px"><span class="grow t15">Styring</span><div class="seg">${[['auto', 'Auto'], ['tid', 'Tidsplan'], ['manuell', 'Manuelt']].map(([k, l]) => `<button data-act="mode" data-key="${k}" data-v="${k}" data-haptic="selection" style="background:${mode === k ? PINK : 'transparent'};color:${mode === k ? INK : 'var(--gray800,#afafaf)'}">${l}</button>`).join('')}</div></div>
        <span class="t12" style="color:var(--gray700,#979797);line-height:1.45;text-wrap:pretty">${esc(info)}</span>
        ${autos.length ? `<div class="col">${autos.map(([k, ic, l, sub, ent], i) => { const on = ent ? M.isOn(this.s(ent)) : !!c[k]; return `<button class="ar${i ? ' bt' : ''}" data-act="auto" data-k="${k}" data-id="${esc(ent || '')}" data-key="${k}" data-haptic="success">${M.icon(ic, 22, 'color:var(--gray900,#c7c7c7);width:26px')}<span class="grow col" style="gap:2px;text-align:left"><span class="t14">${l}</span><span class="t12" style="color:var(--gray700,#979797)">${esc(sub)}</span></span><span class="sw" style="background:${on ? G : '#4a4a4d'}"><span style="left:${on ? 26 : 4}px;background:${on ? '#2a2a2c' : '#d8d6d1'}"></span></span></button>`; }).join('')}</div>` : ''}
      </section>`;
      // Sola
      const dl = T.set != null && T.rise != null ? (T.set - T.rise + 1440) % 1440 : null;
      out += this._fold('sol', 'light_mode', 'Sola', T.rise != null ? `↑ ${fmt(T.rise)} ↓ ${fmt(T.set)}` : 'ingen sol-entitet', A.sun ? [['Soloppgang', fmt(T.rise)], ['Solnedgang', fmt(T.set)], ['Borgerlig skumring', fmt(T.dusk)], ['Dagslengde', dl != null ? `${Math.floor(dl / 60)} t ${dl % 60} min` : '–']] : null);
      out += this._settings(A);
      return out;
    }
    _mode(A) {
      const ms = this.s(A.modus);
      if (ms) { const v = M.slug(ms.state); return /man/.test(v) ? 'manuell' : /(tid|plan|sched)/.test(v) ? 'tid' : 'auto'; }
      const ab = this.s(A.auto);
      const m = this.cfg.mode || 'auto';
      if (ab && ab.state === 'off') return 'manuell';
      if (ab && ab.state === 'on' && m === 'manuell') return 'auto';
      return m;
    }
    _fold(k, icon, title, meta, rows) {
      const open = !!(this.ui.fold || {})[k];
      return `<section class="fd" data-key="fold-${k}">
        <button class="fh" data-act="fold" data-k="${k}">${M.icon(icon, 22)}<span class="grow t15">${esc(title)}</span><span class="t12" style="color:var(--gray700,#979797);white-space:nowrap">${esc(meta)}</span>${M.icon('expand_more', 22, `color:var(--gray700,#979797);transform:${open ? 'rotate(180deg)' : 'none'};transition:transform .25s`)}</button>
        ${open ? `<div class="fb">${rows ? rows.map(([a, b], i) => `<div class="frr${i ? ' bt' : ''}"><span class="grow t13">${esc(a)}</span><span class="fv num">${esc(b)}</span></div>`).join('') : M.emptyState('Fant ingen sol-entitet (sun.sun)', null).replace('class="empty"', 'class="empty in"')}</div>` : ''}
      </section>`;
    }
    _settings(A) {
      const open = !!(this.ui.fold || {}).cf, c = this.cfg, T = this._times(A);
      const f = (k, hint, key, type, w, step, ph) => `<label class="cfr"><span class="grow col" style="gap:1px"><span class="t13">${esc(k)}</span><span class="t11 dim">${esc(hint)}</span></span><input class="ci num" data-input="cfg" data-k="${key}" data-t="${type}" type="${type}" value="${esc(this.config[key] != null ? this.config[key] : type === 'time' && /^\d\d:\d\d$/.test(String(ph)) ? ph : '')}" placeholder="${esc(ph != null ? ph : '')}" ${step ? `step="${step}"` : ''} style="width:${w}px"></label>`;
      const lamps = Array.isArray(this.config.lamps) ? this.config.lamps : A.lamps.map((l) => ({ name: l.name, entity: l.id, icon: '' }));
      return `<section class="fd" data-key="fold-cf">
        <button class="fh" data-act="fold" data-k="cf">${M.icon('tune', 22)}<span class="grow t15">Innstillinger</span><span class="t12" style="color:var(--gray700,#979797);white-space:nowrap">tider og entiteter</span>${M.icon('expand_more', 22, `color:var(--gray700,#979797);transform:${open ? 'rotate(180deg)' : 'none'};transition:transform .25s`)}</button>
        ${open ? `<div class="col" style="gap:14px;padding:0 14px 16px">
          <div class="col">${[f('Tennes', 'Tidsplan · tomt = skumring', 'on', 'time', 104, 0, fmt(T.set != null ? T.set + Number(c.offset || 0) : null)), f('Slukkes', 'Tidsplan · tomt = soloppgang', 'off', 'time', 104, 0, fmt(T.rise)), f('Slukk senest', 'Uansett modus', 'latest', 'time', 104), f('Morgen fra', 'Morgenlys', 'morning', 'time', 104, 0, DEF.morning), f('Forskyvning skumring', 'minutter', 'offset', 'number', 80, 5, DEF.offset), f('Tenn under', 'lux', 'lux_on', 'number', 80, 5, DEF.lux_on), f('Slukk over', 'lux', 'lux_off', 'number', 80, 5, DEF.lux_off)].join('')}</div>
          <span class="cap">Entiteter</span>
          ${[['Lysnivåsensor', 'lux', 'sensor.…', A.autoLux], ['Automatikk-bryter', 'automatikk', 'input_boolean.…', A.autoAuto]].map(([k, key, ph, auto]) => `<label class="col" style="gap:4px"><span class="t12" style="color:var(--gray700,#979797);padding-left:4px">${esc(k)}</span><input class="ce" data-input="ov" data-k="${key}" value="${esc((this.config.overrides || {})[key] || '')}" placeholder="${esc(auto ? 'Auto: ' + auto : ph)}"></label>`).join('')}
          <span class="cap">Utelamper</span>
          ${lamps.map((l, i) => `<div class="lc" data-key="lamp-${i}">
            <div class="row" style="gap:6px">${M.icon(l.icon || 'lightbulb', 20, 'color:var(--gray900,#c7c7c7);width:26px')}<input class="cn" data-input="lamp" data-i="${i}" data-f="name" value="${esc(l.name || '')}" placeholder="Navn"><button class="del" data-act="ldel" data-i="${i}" title="Fjern">${M.icon('delete', 18)}</button></div>
            <div class="lg"><input class="cs" data-input="lamp" data-i="${i}" data-f="entity" value="${esc(l.entity || '')}" placeholder="light.…"><input class="cs" data-input="lamp" data-i="${i}" data-f="icon" value="${esc(l.icon || '')}" placeholder="Ikon (mdi:…)" style="color:var(--gray800,#afafaf)"></div>
          </div>`).join('')}
          <div class="row" style="gap:6px"><button class="add press" data-act="ladd">${M.icon('add', 20)}Legg til lampe</button><button class="rst press" data-act="lreset">Tilbakestill</button></div>
        </div>` : ''}
      </section>`;
    }

    /* ---------------- Etasje */
    _floor(A, F) {
      if (!F) return M.emptyState('Fant ingen lys', 'entities');
      const scenes = M.all(this.hass, 'scene', (s, id) => F.rooms.some((r) => r.area && M.areaOf(this.hass, id) === r.area));
      let out = `<section class="sc noscroll">${PRESETS.map(([k, l, ic]) => `<button class="scb" data-act="preset" data-k="${k}" data-key="${k}" data-haptic="success"><span class="scbb">${M.icon(ic, 24)}</span><span class="scl">${l}</span></button>`).join('')}
        ${scenes.map((id) => `<button class="scb" data-act="toggle" data-id="${esc(id)}" data-ent="${esc(id)}" data-key="${esc(id)}" data-haptic="success"><span class="scbb">${M.icon((this.s(id) || {}).attributes && this.s(id).attributes.icon || 'palette', 24)}</span><span class="scl ell">${esc(M.name(this.hass, id))}</span></button>`).join('')}</section>`;
      out += F.rooms.map((r) => {
        const n = r.ids.filter((id) => { const s = this.s(id); return s && s.state === 'on'; }).length;
        return `<section class="col" style="gap:8px" data-key="r-${esc(r.area || '_')}">
          <div class="rh">${M.icon(r.icon || 'mdi:texture-box', 18, 'color:var(--gray700,#979797)')}<span class="grow t15 ell">${esc(r.name)}</span><span class="t12 dim" style="white-space:nowrap">${n ? `${n} på` : 'alle av'}</span>
            <button class="all press" data-act="room" data-area="${esc(r.area || '')}" data-on="${n ? 1 : 0}" data-haptic="success" style="background:${n ? C.ctrl : M.alpha(Y, 0.18)};color:${n ? 'var(--gray800,#afafaf)' : Y}">${n ? 'Av' : 'På'}</button></div>
          <div class="lbox">${r.ids.map((id) => this._light(id, cap(M.name(this.hass, id, r.name)), r.area)).join('')}</div></section>`;
      }).join('');
      return out;
    }

    /* ---------------- Lys på */
    _onList(A) {
      const tot = this.s(A.total), ex = new Set(this.config.exclude || []);
      let ids = null;
      if (tot && Array.isArray(tot.attributes.aktiv_liste)) ids = M.ids(tot.attributes.aktiv_liste).filter((id) => !ex.has(id) && this.s(id) && this.s(id).state === 'on');
      const comp = A.all.concat(A.lamps.map((l) => l.id)).filter((id, i, a) => a.indexOf(id) === i && this.s(id) && this.s(id).state === 'on');
      if (!ids) ids = comp; else comp.forEach((id) => { if (!ids.includes(id)) ids.push(id); });
      return { ids, tot };
    }
    _on(A) {
      const { ids, tot } = this._onList(A);
      // effekt: sensor med device_class power på samme enhet som lyset
      let w = 0, hasW = false;
      ids.forEach((id) => {
        const e = M.regEntry(this.hass, id), dev = e && e.device_id;
        if (!dev) return;
        const p = M.all(this.hass, 'sensor', (s, sid) => s.attributes.device_class === 'power' && (M.regEntry(this.hass, sid) || {}).device_id === dev)[0];
        const v = p ? this.n(p) : null;
        if (v != null) { w += v; hasW = true; }
      });
      const cnt = A.all.concat(A.lamps.map((l) => l.id)).filter((x, i, a) => a.indexOf(x) === i).length;
      const total = tot && tot.attributes.totalt != null && Number(tot.attributes.totalt) >= ids.length ? tot.attributes.totalt : Math.max(cnt, ids.length);
      return `<section class="sum"><span class="col grow"><span class="big num">${ids.length}</span><span class="t12 dim">${hasW ? `lys på · ca. ${M.nf(w, 0)} W` : `lys på · av ${total}`}</span></span>
          <button class="offall press" data-act="alloff" data-haptic="success" ${ids.length ? '' : 'disabled style="opacity:.5"'}>${M.icon('dark_mode', 20)}Slå av alle</button></section>
        <section class="col" style="gap:8px">
          ${ids.map((id) => { const s = this.s(id), a = A.aOf[id] || M.areaOf(this.hass, id); return `<button class="onr press" data-act="off" data-id="${esc(id)}" data-ent="${esc(id)}" data-key="${esc(id)}" data-haptic="success"><span class="oni">${M.icon('lightbulb', 20)}</span><span class="grow col"><span class="t14 ell">${esc(M.name(this.hass, id))}</span><span class="t11 dim ell">${esc(`${a ? M.areaName(this.hass, a) : 'Uten rom'} · ${dimmable(s) ? pctOf(s) + ' %' : 'På'}`)}</span></span>${M.icon('power_settings_new', 20, 'color:var(--gray600,#7f7f7f)')}</button>`; }).join('')}
          ${ids.length ? '' : '<div class="none">Alle lys er av</div>'}
        </section>`;
    }

    /* ---------------- handlinger */
    onAction(name, el, ev) {
      const d = el.dataset, h = this.hass, A = this._A || M.lysAuto(h, this.config);
      const toast = (t) => { if (this.config.toasts !== false) M.toast(t); };
      switch (name) {
        case 'tab': return this.setUI({ tab: d.key });
        case 'fold': return this.setUI({ fold: { ...(this.ui.fold || {}), [d.k]: !(this.ui.fold || {})[d.k] } });
        case 'outall': {
          const ids = A.lamps.map((l) => l.id), lit = ids.some((id) => { const s = this.s(id); return s && s.state === 'on'; });
          if (!ids.length) return;
          toast(lit ? 'Utelys slått av' : 'Utelys slått på');
          return M.call(h, 'light', lit ? 'turn_off' : 'turn_on', { entity_id: ids });
        }
        case 'mode': {
          const v = d.v, ms = this.s(A.modus);
          if (ms) { const opts = ms.attributes.options || []; const o = opts.find((x) => (v === 'manuell' ? /man/ : v === 'tid' ? /(tid|plan|sched)/ : /auto/).test(M.slug(x))); if (o) return M.call(h, ms.entity_id.split('.')[0], 'select_option', { entity_id: ms.entity_id, option: o }); }
          if (A.auto) M.call(h, 'input_boolean', v === 'manuell' ? 'turn_off' : 'turn_on', { entity_id: A.auto });
          return M.mshPatchConfig(this, { mode: v });
        }
        case 'auto': if (d.id) return M.toggle(h, d.id); return M.mshPatchConfig(this, { [d.k]: !this.cfg[d.k] });
        case 'preset': {
          const F = A.floors.find((f) => f.key === (this.ui.tab || '')) || A.floors.find((f) => f.key === this._curTab());
          if (!F) return;
          const ids = F.rooms.flatMap((r) => r.ids), lvl = (PRESETS.find((p) => p[0] === d.k) || [])[3];
          toast(`${F.name}: ${(PRESETS.find((p) => p[0] === d.k) || [])[1]}`);
          if (!lvl) return M.call(h, 'light', 'turn_off', { entity_id: ids });
          const dim = ids.filter((id) => dimmable(this.s(id))), plain = ids.filter((id) => !dimmable(this.s(id)));
          if (dim.length) M.call(h, 'light', 'turn_on', { entity_id: dim, brightness_pct: lvl });
          if (plain.length) M.call(h, 'light', 'turn_on', { entity_id: plain });
          return;
        }
        case 'room': {
          const F = A.floors.find((f) => f.rooms.some((r) => (r.area || '') === d.area && f.key === this._curTab()));
          const r = F && F.rooms.find((x) => (x.area || '') === d.area);
          if (!r) return;
          return M.call(h, 'light', d.on === '1' ? 'turn_off' : 'turn_on', { entity_id: r.ids });
        }
        case 'alloff': { const { ids } = this._onList(A); if (!ids.length) return; toast('Alle lys slått av'); return M.call(h, 'light', 'turn_off', { entity_id: ids }); }
        case 'off': return M.call(h, 'light', 'turn_off', { entity_id: d.id });
        case 'ldel': { const L = this._lamps(A); L.splice(Number(d.i), 1); return M.mshPatchConfig(this, { lamps: L }); }
        case 'ladd': { const L = this._lamps(A); L.push({ name: 'Ny lampe', entity: '', icon: '' }); return M.mshPatchConfig(this, { lamps: L }); }
        case 'lreset': { const p = { lamps: undefined, on: undefined, off: undefined, latest: undefined, morning: undefined, offset: undefined, lux_on: undefined, lux_off: undefined, mode: undefined }; const ov = { ...(this.config.overrides || {}) }; delete ov.lux; delete ov.automatikk; p.overrides = Object.keys(ov).length ? ov : undefined; return M.mshPatchConfig(this, p); }
        default: return super.onAction(name, el, ev);
      }
    }
    _curTab() {
      const c = this.cfg, A = this._A;
      const tabs = M.mshOrder(['out', ...A.floors.map((f) => f.key), 'on'], c.tab_order, c.hidden_tabs);
      return tabs.includes(this.ui.tab) ? this.ui.tab : tabs.includes(c.start_tab) ? c.start_tab : tabs[0];
    }
    _lamps(A) { return Array.isArray(this.config.lamps) ? this.config.lamps.map((l) => ({ ...l })) : A.lamps.map((l) => ({ name: l.name, entity: l.id, icon: '' })); }
    onInput(name, el, ev, kind) {
      if (kind !== 'change') return;
      const d = el.dataset, v = el.value.trim();
      if (name === 'cfg') return M.mshPatchConfig(this, { [d.k]: v === '' ? undefined : d.t === 'number' ? Number(v) : v });
      if (name === 'ov') { const ov = { ...(this.config.overrides || {}) }; if (v) ov[d.k] = v; else delete ov[d.k]; return M.mshPatchConfig(this, { overrides: Object.keys(ov).length ? ov : undefined }); }
      if (name === 'lamp') { const L = this._lamps(this._A); if (!L[d.i]) return; L[d.i][d.f] = v; return M.mshPatchConfig(this, { lamps: L }); }
    }

    /* ---------------- faner (felles MSH.tabReorder) og lys-slidere */
    afterRender() {
      const row = this.shadowRoot.querySelector('.tabs');
      M.tabReorder(row, {
        card: this, glass: true,
        items: () => Array.from(row.querySelectorAll('.tab')),
        active: () => this._curTab(),
        onSelect: (k) => this.setUI({ tab: k }),
        onReorder: (keys) => { const hid = this.config.hidden_tabs || []; M.mshPatchConfig(this, { tab_order: keys.concat(hid.filter((k) => !keys.includes(k))) }); },
      });
      M.mshTabDrag(this, this.shadowRoot.querySelector('.seg'), { glass: true, onSelect: (k) => { const b = this.shadowRoot.querySelector(`.seg [data-key="${k}"]`); if (b) this.onAction('mode', b); } });
      const sc = this.shadowRoot.querySelector('.sc');
      if (sc && !sc.__b) { sc.__b = true; const st = (e) => e.stopPropagation(); sc.addEventListener('touchstart', st, { passive: true }); sc.addEventListener('touchmove', st, { passive: true }); }
      this._mountLights();
    }

    get styles() {
      return `
        .wrap{display:flex;flex-direction:column;gap:var(--msh-gap,8px)}
        .t15{font-size:15px;font-weight:500} .t14{font-size:14px;font-weight:500} .t13{font-size:13px} .t12{font-size:12px} .t11{font-size:11px}
        .dim{color:var(--gray600,#7f7f7f)}
        .bt{border-top:1px solid rgba(255,255,255,0.06)}
        ${M.TAB_ROW_CSS || ''}
        .tw{display:flex;justify-content:center;min-width:0}
        .tbox{padding:4px;border-radius:23px;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.12);max-width:100%;min-width:0;overflow:hidden}
        .tabs{gap:2px;border-radius:19px}
        .tab{height:38px;padding:0 14px;border-radius:19px;font-size:13px;font-weight:500;transition:background .2s}
        .lbox{display:flex;flex-direction:column;gap:10px;padding:14px 12px;border-radius:28px;background:var(--gray200,#3a3a3a)}
        .lsl{display:block;min-height:40px}
        .lsl mysmart-light-control{display:block;--ha-card-background:transparent;--ha-card-box-shadow:none;--ha-card-border-width:0}
        .lbox>.lt{background:var(--gray300,#404040)}
        .g2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
        .oc{display:flex;flex-direction:column;gap:18px;padding:18px;border-radius:30px;transition:background .4s}
        .ol{font-size:48px;font-weight:300;letter-spacing:-0.03em;line-height:1}
        .ob{width:76px;height:76px;border-radius:38px;flex:none;display:grid;place-items:center;transition:all .3s}
        .ob:active{transform:scale(.94)}
        .tl{position:relative;height:40px;border-radius:14px;background:var(--gray400,#545454);overflow:hidden}
        .dk{position:absolute;top:0;bottom:0;border-radius:10px}
        .tk{position:absolute;top:8px;bottom:8px;width:1px;background:rgba(255,255,255,0.25)}
        .nw{position:absolute;top:4px;bottom:4px;width:4px;border-radius:2px;background:#fafafa;box-shadow:0 0 0 2px var(--gray200,#3a3a3a)}
        .mk{position:relative;height:30px}
        .mk>span{position:absolute;transform:translateX(-50%);display:flex;align-items:center;gap:3px;font-size:11px;font-weight:500;white-space:nowrap;font-variant-numeric:tabular-nums}
        .mk>span:first-child{transform:translateX(-20%)} .mk>span:last-child{transform:translateX(-80%)}
        .lt{position:relative;overflow:hidden;display:flex;align-items:center;gap:8px;height:56px;padding:0 12px 0 6px;border-radius:28px;background:var(--gray200,#3a3a3a);cursor:pointer;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;min-width:0;outline:none}
        .lt.big{gap:10px;height:72px;padding:0 14px 0 6px;border-radius:36px}
        .lf{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg, ${M.alpha(Y, 0.18)}, ${M.alpha(Y, 0.42)});transition:width .35s cubic-bezier(.34,1.2,.64,1);pointer-events:none}
        .li{position:relative;width:44px;height:44px;border-radius:22px;flex:none;display:grid;place-items:center;transition:background .25s}
        .lt.big .li{width:60px;height:60px;border-radius:30px}
        .lx{position:relative;flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
        .ln{font-size:13px;font-weight:500} .lt.big .ln{font-size:14px}
        .lv{font-size:11px} .lt.big .lv{font-size:12px}
        .st{display:flex;flex-direction:column;gap:12px;padding:16px;border-radius:28px;background:var(--gray200,#3a3a3a)}
        .seg{display:flex;gap:2px;padding:3px;border-radius:19px;background:#282828;user-select:none;-webkit-user-select:none}
        .seg button{height:32px;padding:0 12px;border-radius:16px;font-size:12px;font-weight:500;white-space:nowrap}
        .ar{display:flex;align-items:center;gap:12px;min-height:60px;width:100%}
        .sw{position:relative;width:52px;height:30px;border-radius:15px;flex:none;transition:background .2s}
        .sw span{position:absolute;top:4px;width:22px;height:22px;border-radius:11px;transition:left .2s}
        .fd{display:flex;flex-direction:column;border-radius:28px;background:var(--gray200,#3a3a3a);overflow:hidden}
        .fh{display:flex;align-items:center;gap:12px;height:58px;padding:0 18px;text-align:left;width:100%}
        .fb{display:flex;flex-direction:column;padding:0 18px 10px}
        .frr{display:flex;align-items:center;gap:10px;padding:9px 0}
        .fv{font-size:12px;font-weight:600;padding:6px 11px;border-radius:12px;background:var(--gray400,#545454)}
        .cfr{display:flex;align-items:center;gap:10px;padding:10px 4px}
        .cfr+.cfr{border-top:1px solid rgba(255,255,255,0.05)}
        .ci{height:38px;border-radius:12px;padding:0 10px;background:#282828;color:#fafafa;font-size:14px;font-weight:500;text-align:center;color-scheme:dark;flex:none}
        .cap{font-size:12px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;color:var(--gray600,#7f7f7f);padding:0 4px}
        .ce{height:42px;border-radius:14px;padding:0 12px;background:#282828;color:#fafafa;font-size:13px;width:100%}
        .lc{display:flex;flex-direction:column;gap:6px;padding:10px;border-radius:18px;background:#282828}
        .cn{flex:1;min-width:0;height:36px;border-radius:10px;padding:0 10px;background:var(--gray300,#404040);font-size:14px;font-weight:500}
        .del{width:32px;height:32px;border-radius:16px;flex:none;display:grid;place-items:center;background:${M.alpha(C.red, 0.2)};color:${C.red}}
        .lg{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr);gap:6px}
        .cs{height:34px;border-radius:10px;padding:0 10px;background:var(--gray300,#404040);font-size:12px;min-width:0}
        .add{flex:1;height:44px;border-radius:22px;display:flex;align-items:center;justify-content:center;gap:6px;font-size:14px;font-weight:500;box-shadow:inset 0 0 0 1.5px rgba(255,255,255,0.18)}
        .rst{height:44px;padding:0 14px;border-radius:22px;font-size:13px;color:var(--gray800,#afafaf);background:var(--gray400,#545454)}
        .sc{display:flex;gap:12px;overflow-x:auto;padding:2px 4px}
        .scb{flex:none;display:flex;flex-direction:column;align-items:center;gap:6px;width:62px}
        .scbb{width:58px;height:58px;border-radius:29px;display:grid;place-items:center;background:var(--gray200,#3a3a3a);color:var(--gray800,#afafaf);transition:transform .15s cubic-bezier(.34,1.5,.64,1)}
        .scb:active .scbb{transform:scale(.9)}
        .scl{font-size:11px;font-weight:500;color:var(--gray600,#7f7f7f);max-width:62px}
        .rh{display:flex;align-items:center;gap:10px;padding:4px 6px 0}
        .all{height:30px;padding:0 12px;border-radius:15px;font-size:12px;font-weight:600;flex:none}
        .sum{display:flex;align-items:center;gap:14px;padding:16px 18px;border-radius:28px;background:var(--gray200,#3a3a3a)}
        .big{font-size:34px;font-weight:300;letter-spacing:-0.03em;line-height:1}
        .offall{height:48px;padding:0 20px;border-radius:24px;background:#fafafa;color:#282828;font-size:14px;font-weight:600;display:flex;align-items:center;gap:6px}
        .onr{display:flex;align-items:center;gap:12px;height:60px;padding:0 16px 0 6px;border-radius:30px;background:var(--gray200,#3a3a3a);text-align:left;width:100%}
        .oni{width:48px;height:48px;border-radius:24px;flex:none;display:grid;place-items:center;background:${Y};color:#282828}
        .none{padding:30px;text-align:center;font-size:13px;color:var(--gray500,#696969)}
        .empty.in{background:transparent;padding:10px 0 0}
      `;
    }
  }
  // Alle lys kortet viser (etasjer + utelys) – for innstillinger per lys i editoren
  function lightIds(a) { return [...new Set([...(a.lamps || []).map((l) => l.id), ...(a.all || [])])]; }
  function fmtSun(h, c, which) {
    const A = M.lysAuto(h, c || {}), s = A.sun && h.states[A.sun], at = (s && s.attributes) || {};
    const m = which === 'on' ? hm(at.next_setting) : hm(at.next_rising);
    return m == null ? null : fmt(which === 'on' ? m + Number((c && c.offset) != null ? c.offset : DEF.offset) : m);
  }
  M.define('msh-lys-card', Lys, 'MSH Lys', 'Utelys med tidslinje og styring, lys per etasje og rom med dimmere, og oversikt over lys som er på.');
})();
