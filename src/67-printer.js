/* msh-printer-card · 3D-printer-popup #3d-printer (Fiks 60.3). Fasit: «design/3D-printer.dc.html». ÉTT kort i popupen –
 * Bubble Card eier headeren (ikon print, «3D-printer», lukk). #3d (den importerte) er alias (M.HASH_ALIAS).
 * Rekkefølge (som designet): status (prikk + Av / Varmer opp / Skriver ut / Pause / Ferdig / Klar) · overskrift (filnavn /
 * «Printeren er av» …) · undertekst («Lag 120 av 240 · ca. 30 min igjen») · fremdrift (under utskrift / pause / ferdig) →
 * kamera (200 px, «Live») → kontroller Pause · Fortsett · Stopp · Lys · Strøm → «Skriv ut siste jobb» (når printeren er
 * klar og det finnes en startknapp) → faner Enkel · Avansert (hold 400 ms + dra = MSH.tabRow, tab_order, start_tab) →
 * temperaturer Dyse · Plate · Kammer (verdi / mål + stolpe) → Avansert: hastighet, delkjølevifte, kammervifte, Z-offset,
 * lagtykkelse → «Filament · CFS» (spor med farge, navn, igjen og stolpe).
 * Autokonfig: printerenheten (produsent/modell Creality, Bambu, Prusa, Elegoo, Anycubic, Klipper/Moonraker, OctoPrint …
 * eller entiteter fra de integrasjonene) og entitetene på den; strømbryter også fra en smartplugg med printerens navn.
 * Ingen gjettede ID-er – «–» når noe mangler. Config: overrides.<felt> (entitet, 'none' = ingen), device (enhets-id),
 * exclude [slot-entitet], tab_order, start_tab.
 */
(function () {
  const M = window.MSH, esc = M.esc, C = M.C;
  const HASH = '#3d-printer';
  const AMBER = C.orange, GREEN = C.green, RED = C.red, BLUE = C.blue;
  const TV = (k, n) => (M.tabH ? M.tabH.v(k, n) : n + 'px');
  const TABS = [['simple', 'Enkel'], ['adv', 'Avansert']];
  const tabOrder = (c) => (M.edOrder ? M.edOrder(TABS.map((t) => t[0]), c.tab_order) : TABS.map((t) => t[0]));
  const tone = (col, a) => `color-mix(in srgb, ${col} ${Math.round(a * 100)}%, transparent)`;
  const PRN = /creality|bambu|prusa|elegoo|anycubic|voron|klipper|moonraker|octoprint|flashforge|qidi|snapmaker|3d.?print/i;
  const PLAT = ['creality', 'ha_creality_ws', 'creality_k', 'bambu_lab', 'octoprint', 'moonraker', 'prusalink', 'elegoo_printer', 'elegoo_cc', 'anycubic_cloud', 'flashforge'];
  const lc = (h, id) => (id + ' ' + String((h.states[id] && h.states[id].attributes.friendly_name) || '')).toLowerCase();

  // Printerenheten: { dev, name, ids: [...] }
  function printerDev(h, c) {
    const E = h.entities || {}, D = h.devices || {};
    let dev = c && c.device && D[c.device] ? c.device : null;
    if (!dev) dev = Object.keys(D).find((d) => PRN.test(`${D[d].manufacturer || ''} ${D[d].model || ''} ${D[d].name || ''}`) && Object.keys(E).some((id) => E[id].device_id === d && h.states[id])) || null;
    if (!dev) { const id = Object.keys(E).find((x) => PLAT.includes(E[x].platform) && E[x].device_id && h.states[x]); dev = id ? E[id].device_id : null; }
    if (!dev) return null;
    const Dv = D[dev] || {};
    return { dev, name: Dv.name_by_user || Dv.name || '3D-printer', model: Dv.model || '', ids: Object.keys(E).filter((id) => E[id].device_id === dev && h.states[id] && !E[id].disabled_by) };
  }
  M.printerHas = (h) => !!(h && printerDev(h, {}));
  const FIELDS = [
    ['status', 'Status', ['sensor'], null, /print_status|printer_state|print_state|current_stage|job_state|state|status/, /error|wifi|cfs|ams|camera|door/],
    ['progress', 'Fremdrift (%)', ['sensor'], null, /progress|fremdrift|percent/],
    ['file', 'Filnavn', ['sensor'], null, /file|filename|job_name|print_name|task_name|gcode/],
    ['left', 'Tid igjen', ['sensor'], null, /time_left|remaining|left|gjenst|finish|eta/],
    ['layer', 'Lag nå', ['sensor'], null, /current_layer|^.*_layer$|layer_now/, /total|height/],
    ['layers', 'Lag totalt', ['sensor'], null, /total_layer|layers_total|total_layers/],
    ['nozzle', 'Dyse', ['sensor'], ['temperature'], /nozzle|hotend|extruder|dyse/, /target|mål/],
    ['nozzle_t', 'Dyse · mål', ['sensor', 'number'], null, /(nozzle|hotend|extruder|dyse).*(target|mål)|(target|mål).*(nozzle|hotend|extruder|dyse)/],
    ['bed', 'Plate', ['sensor'], ['temperature'], /bed|plate|heatbed/, /target|mål/],
    ['bed_t', 'Plate · mål', ['sensor', 'number'], null, /(bed|plate).*(target|mål)|(target|mål).*(bed|plate)/],
    ['chamber', 'Kammer', ['sensor'], ['temperature'], /chamber|kammer|enclosure|box_temp/, /target|cfs|ams/],
    ['camera', 'Kamera', ['camera'], null, /./],
    ['light', 'Lys', ['light', 'switch'], null, /light|lys|led|lamp/],
    ['power', 'Strøm', ['switch'], null, /power|str[øo]m|plug|outlet|stikk/],
    ['pause', 'Pause', ['button'], null, /pause/],
    ['resume', 'Fortsett', ['button'], null, /resume|fortsett|continue/],
    ['stop', 'Stopp', ['button'], null, /stop|cancel|avbryt|abort/],
    ['start', 'Skriv ut siste jobb', ['button', 'script'], null, /print_last|reprint|start|restart|skriv_ut/],
    ['speed', 'Hastighet', ['sensor', 'number', 'select'], null, /speed|hastighet/],
    ['fan', 'Delkjølevifte', ['sensor', 'fan', 'number'], null, /model_fan|part_fan|cooling_fan|delkj|^fan\.|_fan$/, /chamber|aux|box|case|kammer/],
    ['fan_ch', 'Kammervifte', ['sensor', 'fan', 'number'], null, /chamber_fan|aux_fan|box_fan|case_fan|kammervifte/],
    ['zoff', 'Z-offset', ['sensor', 'number'], null, /z_?offset/],
    ['lh', 'Lagtykkelse', ['sensor', 'number'], null, /layer_height|lagtykkelse/],
    ['cfs_temp', 'CFS · temperatur', ['sensor'], null, /(cfs|ams|box).*(temp)/],
    ['cfs_hum', 'CFS · fukt', ['sensor'], null, /(cfs|ams|box).*(humid|fukt)/],
  ];
  M.printerAuto = function (h, c) {
    const P = printerDev(h, c || {}), out = { P };
    if (!P) return out;
    const L = P.ids, key = M.slug(P.name);
    FIELDS.forEach(([k, , doms, dc, rx, not]) => {
      out[k] = L.filter((id) => doms.includes(id.split('.')[0]) && (!dc || dc.includes((h.states[id].attributes || {}).device_class)) && rx.test(id.split('.')[1]) && !(not && not.test(id.split('.')[1]))).sort((a, b) => a.length - b.length)[0] || null;
    });
    if (!out.camera) out.camera = M.all(h, 'camera', (s, id) => key && id.includes(key))[0] || null;
    // smartplugg med printerens navn (egen enhet)
    if (!out.power) out.power = M.all(h, 'switch', (s, id) => !L.includes(id) && ((key && id.includes(key)) || /3d.?print|printer/.test(lc(h, id))))[0] || null;
    out.slots = L.filter((id) => id.indexOf('sensor.') === 0 && /(cfs|ams|tray|slot|spool|filament)/.test(id) && !/temp|humid|fukt|status/.test(id)).sort();
    return out;
  };
  const ov = (h, c, A, k) => { const o = (c.overrides || {})[k]; if (o === 'none') return null; return o && h.states[o] ? o : A[k] || null; };
  const stOf = (h, id) => (id && h.states[id]) || null;
  const numOf = (h, id) => { const s = stOf(h, id); return s && M.isNum(s.state) ? Number(s.state) : null; };
  // Status → 'off' | 'heating' | 'printing' | 'paused' | 'done' | 'idle' | 'error'
  function jobOf(h, E) {
    const pw = stOf(h, E.power);
    if (pw && pw.state === 'off') return 'off';
    const s = stOf(h, E.status), v = String(s ? s.state : '').toLowerCase();
    if (!s || M.unavailable(s) || /^off|offline|disconnect/.test(v)) return pw && pw.state === 'on' ? 'idle' : s ? 'off' : 'idle';
    if (/paus/.test(v)) return 'paused';
    if (/heat|preheat|varm|warm/.test(v)) return 'heating';
    if (/print|running|busy|skriver|working/.test(v)) return 'printing';
    if (/complete|finish|done|ferdig|success/.test(v)) return 'done';
    if (/error|fail|feil|stopped_err/.test(v)) return 'error';
    return 'idle';
  }
  const tempOf = (h, id) => numOf(h, id);
  const leftMin = (h, id) => {
    const s = stOf(h, id); if (!s || M.unavailable(s)) return null;
    if (M.isNum(s.state)) { const v = Number(s.state), u = String(s.attributes.unit_of_measurement || '').toLowerCase(); return u === 's' || u.startsWith('sec') ? v / 60 : u === 'h' ? v * 60 : v; }
    const t = Date.parse(s.state); return isNaN(t) ? null : Math.max(0, (t - Date.now()) / 60000);
  };
  const fmtVal = (h, id) => { const s = stOf(h, id); if (!s || M.unavailable(s)) return '–'; const u = s.attributes.unit_of_measurement || ''; return M.isNum(s.state) ? `${M.nf(Number(s.state), Math.abs(Number(s.state)) < 1 && Number(s.state) !== 0 ? 2 : 0)}${u ? (u === '%' ? ' %' : ' ' + u) : ''}`.replace('-', '−') : s.state; };

  class Printer extends M.Card {
    static get cardName() { return '3D-printer'; }
    static get defaults() { return {}; }
    static get uiPersist() { return ['tab']; }
    static getStubConfig() { return { card_id: M.uid() }; }
    static get startTabSpec() { return { tabs: (card) => tabOrder(card.config) }; }
    static get schema() {
      return (h, c) => {
        const A = h ? M.printerAuto(h, c || {}) : {};
        return [
          ...(M.startTab ? [M.startTab.field({ items: (hh, cc) => tabOrder(cc || {}).map((k) => ({ key: k, label: TABS.find((t) => t[0] === k)[1] })) })] : []),
          { type: 'info', label: A.P ? `Printer: ${A.P.name}${A.P.model ? ' · ' + A.P.model : ''}` : 'Fant ingen 3D-printer (Creality, Bambu, Prusa, Klipper/Moonraker, OctoPrint …)' },
          { type: 'overrides', id: 'ents', label: 'Entiteter', fields: FIELDS.map(([name, label, doms]) => ({ name, label, domains: doms, auto: () => A[name] || null })) },
          { type: 'lists', label: 'Filament', lists: (hh, cc) => [{ key: 'slots', label: 'Spor (CFS / AMS)', ids: (M.printerAuto(hh, cc || {}).slots || []), domains: ['sensor'] }] },
        ];
      };
    }
    get cardSize() { return 10; }
    get tab() { const V = tabOrder(this.config), t = this.ui.tab || this.config.start_tab; return V.includes(t) ? t : V[0]; }
    onOpen() { clearInterval(this._tick); this._tick = setInterval(() => { this._camT = Date.now(); this.update(); }, 10000); }
    onClose() { clearInterval(this._tick); this._tick = 0; }
    disconnectedCallback() { super.disconnectedCallback(); clearInterval(this._tick); this._tick = 0; }
    _ents() {
      const h = this.hass, c = this.config, A = M.printerAuto(h, c), E = { P: A.P };
      FIELDS.forEach(([k]) => { E[k] = ov(h, c, A, k); if (E[k]) this.s(E[k]); });
      E.slots = M.applyLists(c, 'slots', A.slots || []).filter((id) => h.states[id]);
      E.slots.forEach((id) => this.s(id));
      return E;
    }
    render() {
      const h = this.hass, c = this.config, E = this._ents();
      const job = jobOf(h, E), on = job !== 'off', p = job === 'printing', paused = job === 'paused';
      const ST = { off: ['Av', 'var(--ki-text-mid, #8e8d89)'], heating: ['Varmer opp', AMBER], printing: ['Skriver ut', GREEN], paused: ['Pause', AMBER], done: ['Ferdig', GREEN], idle: ['Klar', BLUE], error: ['Feil', RED] }[job];
      const prog = numOf(h, E.progress), file = stOf(h, E.file), fname = file && !M.unavailable(file) && file.state ? file.state : null;
      const lay = numOf(h, E.layer), lays = numOf(h, E.layers), left = leftMin(h, E.left);
      const headline = !E.P ? '3D-printer' : !on ? 'Printeren er av' : (p || paused) ? fname || 'Skriver ut' : job === 'heating' ? 'Varmer dyse og plate' : job === 'done' ? 'Utskriften er ferdig' : job === 'error' ? 'Printeren melder feil' : 'Klar til utskrift';
      const subline = !E.P ? 'Fant ingen 3D-printer' : p ? [lay != null && lays ? `Lag ${M.nf(lay)} av ${M.nf(lays)}` : null, left != null ? `ca. ${Math.round(left)} min igjen` : null].filter(Boolean).join(' · ') || 'Skriver ut' : paused ? 'Satt på pause' : !on ? 'Slå på for å varme opp og se kamera' : E.P.model || E.P.name;
      const showProg = (p || paused || job === 'done') && prog != null;
      const t = this.tab;
      const head = `<section class="hd" data-key="hd"><div class="st"><span class="dot" style="background:${ST[1]};${on ? `box-shadow:0 0 10px ${ST[1]}` : ''}"></span>${ST[0]}</div><div class="hl" data-noi18n>${esc(headline)}</div><div class="sub">${esc(subline)}</div>
        ${showProg ? `<div class="pg"><div class="pt"><div style="width:${M.clamp(prog, 0, 100)}%;background:${paused ? AMBER : GREEN}"></div></div><span class="num">${M.nf(prog)} %</span></div>` : ''}</section>`;
      if (!E.P && !E.status) return `<div class="wrap">${head}${M.emptyState('Fant ingen 3D-printer', 'ents')}</div>`;
      // kamera
      const cam = stOf(h, E.camera), pic = cam && on && !M.unavailable(cam) && cam.attributes.entity_picture ? cam.attributes.entity_picture + (cam.attributes.entity_picture.indexOf('?') >= 0 ? '&' : '?') + 't=' + Math.floor((this._camT || Date.now()) / 10000) : null;
      const lightOn = !!(E.light && stOf(h, E.light) && stOf(h, E.light).state === 'on');
      const camH = `<section class="cam${on ? (lightOn ? ' lit' : '') : ' off'}" data-key="cam" data-ki-island ${E.camera ? `data-ent="${esc(E.camera)}"` : ''}>${pic ? `<img src="${esc(pic)}" alt="" draggable="false">` : `${M.icon(on ? 'mdi:video' : 'mdi:video-off', 32)}<span class="cl">${on ? (E.camera ? 'Kamerastrøm' : 'Ingen kamera') : 'Kamera er av'}</span>`}${on && E.camera ? '<span class="live">Live</span>' : ''}</section>`;
      const ctrl = (act, icon, label, col, dis, act2) => `<button class="ctl${act2 ? ' on' : ''}" ${dis ? 'aria-disabled="true"' : `data-act="${act}" data-haptic="medium"`} style="${act2 ? `background:${tone(col, 0.18)};box-shadow:inset 0 0 0 1px ${tone(col, 0.45)};` : ''}"><span style="color:${dis ? 'var(--ki-text-lo, #48474a)' : col}">${M.icon(icon, 24)}</span><span class="cn">${label}</span></button>`;
      const ctl = `<section class="ctls" data-key="ctls">
        ${ctrl('pause', 'mdi:pause', 'Pause', AMBER, !(p && E.pause))}
        ${ctrl('resume', 'mdi:play', 'Fortsett', GREEN, !(paused && E.resume))}
        ${ctrl('stop', 'mdi:stop', 'Stopp', RED, !((p || paused || job === 'heating') && E.stop))}
        ${ctrl('light', 'mdi:lightbulb', kiT('Lys', 'Light'), AMBER, !(on && E.light), lightOn)}
        ${ctrl('power', 'mdi:power', 'Strøm', on ? GREEN : 'var(--ki-text, #f2f1ee)', !E.power, on && !!E.power)}</section>`;
      const start = on && (job === 'idle' || job === 'done') && E.start ? `<button class="go press" data-act="start" data-haptic="success" data-key="go">${M.icon('mdi:printer-3d', 22)}<span>Skriv ut siste jobb${fname ? ' · <span data-noi18n>' + esc(fname) + '</span>' : ''}</span></button>` : '';
      const tabs = `<div class="tabs" role="tablist" data-glass-drag="x"${M.tabH && M.tabH.style(c) ? ` style="${M.tabH.style(c)}"` : ''}>${tabOrder(c).map((k) => `<button class="tb ${k === t ? 'on' : ''}" role="tab" aria-selected="${k === t}" data-act="tab" data-v="${k}" data-haptic="selection">${esc(TABS.find((x) => x[0] === k)[1])}</button>`).join('')}</div>`;
      const temp = (icon, label, id, tid, max, col) => {
        const v = on ? tempOf(h, id) : null, tg = on ? numOf(h, tid) : null;
        return `<div class="tc"${id ? ` data-ent="${esc(id)}"` : ''}><span class="tk"><span style="color:${col}">${M.icon(icon, 15)}</span>${label}</span><span class="tv num">${v != null ? Math.round(v) + '°' : '–'}<span>${tg ? ` / ${Math.round(tg)}°` : ''}</span></span><div class="tt"><div style="width:${v != null ? M.clamp(v / max * 100, 0, 100) : 0}%;background:${col}"></div></div></div>`;
      };
      const temps = `<section class="temps" data-key="temps">${temp('mdi:fire', kiT('Dyse', 'Nozzle'), E.nozzle, E.nozzle_t, 300, RED)}${temp('mdi:square-outline', kiT('Plate', 'Bed'), E.bed, E.bed_t, 110, AMBER)}${temp('mdi:home-outline', kiT('Kammer', 'Chamber'), E.chamber, null, 60, BLUE)}</section>`;
      const adv = t === 'adv' ? `<section class="adv" data-key="adv">${[['mdi:speedometer', 'Hastighet', E.speed], ['mdi:fan', 'Delkjølevifte', E.fan], ['mdi:weather-windy', 'Kammervifte', E.fan_ch], ['mdi:arrow-collapse-vertical', 'Z-offset', E.zoff], ['mdi:layers-outline', 'Lagtykkelse', E.lh]].map(([i, k, id], n) => `<div class="ar${n ? ' bt' : ''}"${id ? ` data-ent="${esc(id)}"` : ''}><span class="ai">${M.icon(i, 18)}</span><span class="ak">${k}</span><span class="av num">${fmtVal(h, id)}</span></div>`).join('')}</section>` : '';
      const ct = numOf(h, E.cfs_temp), chm = numOf(h, E.cfs_hum);
      const meta = on && (ct != null || chm != null) ? [ct != null ? `${M.nf(ct)} °C` : null, chm != null ? `${M.nf(chm)} % RF` : null].filter(Boolean).join(' · ') : '–';
      const slots = E.slots.map((id, i) => this._slot(id, i)).join('');
      const cfs = E.slots.length ? `<section class="cfs" data-key="cfs"><div class="ch"><div class="cap">Filament · CFS</div><div class="cap2">${esc(meta)}</div></div>${slots}</section>` : '';
      return `<div class="wrap">${head}${camH}${ctl}${start}${tabs}${temps}${adv}${cfs}</div>`;
    }
    _slot(id, i) {
      const h = this.hass, s = h.states[id], a = s.attributes || {};
      const pct = M.isNum(s.state) ? Number(s.state) : M.isNum(a.remain) ? Number(a.remain) : M.isNum(a.percent) ? Number(a.percent) : null;
      const col = a.color_hex || a.color || a.colour || a.hex || null;
      const name = [a.type || a.material || a.filament_type, a.color_name || a.name].filter(Boolean).join(' ') || M.name(h, id);
      const g = M.isNum(a.weight) ? Number(a.weight) : M.isNum(a.remaining_weight) ? Number(a.remaining_weight) : null;
      const act = !!(a.active || a.in_use || a.selected);
      const left = pct != null ? `${M.nf(pct)} %${g != null ? ` · ca. ${M.nf(g)} g` : ''}` : s.state;
      const sw = col && /^#?[0-9a-f]{6}/i.test(col) ? (col[0] === '#' ? col.slice(0, 7) : '#' + col.slice(0, 6)) : col;
      return `<div class="sl${act ? ' on' : ''}" data-key="sl-${esc(id)}" data-ent="${esc(id)}"><span class="sw" style="background:${sw ? esc(sw) : 'var(--ki-surface-2, #3a3a3a)'}">${i + 1}</span>
        <div class="si"><div class="sr"><span class="sn" data-noi18n>${esc(name)}</span><span class="sp num">${esc(left)}</span></div><div class="sb"><div style="width:${pct != null ? M.clamp(pct, 0, 100) : 0}%;background:${pct != null && pct < 15 ? AMBER : 'var(--ki-text-1, #c9c7c2)'}"></div></div></div></div>`; // ki-hex-ok: filamentfargen fra printeren
    }
    onAction(name, el, ev) {
      const d = el.dataset, h = this.hass;
      if (name === 'tab') return this.setUI({ tab: d.v });
      const E = this._ents();
      const press = (id) => { if (!id) return; const dom = id.split('.')[0]; M.call(h, dom, dom === 'script' ? 'turn_on' : 'press', { entity_id: id }); };
      if (name === 'pause') return press(E.pause);
      if (name === 'resume') return press(E.resume);
      if (name === 'stop') return press(E.stop);
      if (name === 'start') return press(E.start);
      if (name === 'light') { if (E.light) M.toggle(h, E.light); return undefined; }
      if (name === 'power') { if (E.power) M.toggle(h, E.power); return undefined; }
      return super.onAction(name, el, ev);
    }
    afterRender() {
      const R = this.shadowRoot;
      if (M.tabRow) M.tabRow(this, R.querySelector('.tabs[role="tablist"]'), { active: () => this.tab, order: () => tabOrder(this.config), field: 'tab_order' });
    }
    get styles() {
      return `${M.V4_POP_CSS || ''}
        .wrap{gap:20px}
        .hd{gap:10px}
        .pg{display:flex;align-items:center;gap:10px;padding-top:4px;font-size:13px;font-weight:500}
        .pt{flex:1;height:8px;border-radius:4px;background:var(--ki-surface-3, #303030);overflow:hidden}
        .pt div{height:100%;border-radius:4px;transition:width 1s}
        .cam{position:relative;height:200px;border-radius:24px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;background:#303030;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.05);overflow:hidden;color:#48474a;transition:background .3s} /* ki-hex-ok: kameraflaten (fast i begge moduser) */
        .cam.lit{background:#26262a} /* ki-hex-ok */
        .cam.off{background:#18181a} /* ki-hex-ok */
        .cam img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
        .cl{font-size:12px;color:#6d6c69} /* ki-hex-ok */
        .live{position:absolute;left:12px;top:12px;font-size:11px;font-weight:600;padding:3px 8px;border-radius:8px;background:${RED};color:#fff} /* ki-hex-ok */
        .ctls{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}
        .ctl{height:74px;border-radius:20px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;background:var(--ki-surface, #303030);min-width:0}
        .ctl[aria-disabled="true"]{opacity:.6;cursor:default;color:var(--ki-text-lo, #48474a)}
        .ctl:not([aria-disabled="true"]):active{transform:scale(.96)}
        .cn{font-size:11px;font-weight:500;white-space:nowrap}
        .go{height:56px;border-radius:28px;background:${AMBER};color:var(--ki-on-accent, #1a1408);font-size:15px;font-weight:600;display:flex;align-items:center;justify-content:center;gap:8px;padding:0 16px;min-width:0}
        .go>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .tabs{display:grid;grid-template-columns:1fr 1fr;gap:2px;padding:4px;border-radius:calc(${TV('th', 40)} / 2 + 4px);background:var(--ki-surface-3, #303030);position:relative;touch-action:pan-y}
        .tb{min-width:0;height:${TV('th', 40)};padding:0 ${TV('tp', 8)};border-radius:16px;font-size:${TV('tf', 13)};font-weight:500;white-space:nowrap;color:var(--ki-text-2, #a9a7a2)}
        .tb.on{background:${C.accent};color:var(--ki-on-accent, #2a1720)}
        .temps{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
        .tc{display:flex;flex-direction:column;gap:6px;padding:12px 14px;border-radius:18px;background:var(--ki-surface, #303030);min-width:0}
        .tk{display:flex;align-items:center;gap:5px;font-size:11px;color:var(--ki-text-mid, #8e8d89)}
        .tv{font-size:20px;font-weight:500;white-space:nowrap}
        .tv span{font-size:11px;color:var(--ki-text-lo, #6d6c69);font-weight:400}
        .tt{height:3px;border-radius:2px;background:var(--ki-surface-3, #3c3c3c);overflow:hidden}
        .tt div{height:100%;transition:width 1s}
        .adv{display:flex;flex-direction:column}
        .ar{display:flex;align-items:center;gap:10px;padding:11px 4px}
        .ar.bt{border-top:1px solid var(--ki-line, rgba(255,255,255,0.05))}
        .ai{width:24px;color:var(--ki-text-mid, #8e8d89);display:grid;place-items:center}
        .ak{flex:1;font-size:14px}
        .av{font-size:13px;color:var(--ki-text-1, #c9c7c2)}
        .cfs{display:flex;flex-direction:column;gap:2px}
        .ch{display:flex;justify-content:space-between;padding:0 4px 8px}
        .cap{font-size:12px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;color:var(--ki-text-mid, #8e8d89)}
        .cap2{font-size:12px;color:var(--ki-text-lo, #6d6c69)}
        .sl{display:flex;align-items:center;gap:12px;padding:10px;border-radius:16px}
        .sl.on{background:var(--ki-surface, #303030);box-shadow:inset 0 0 0 1px var(--ki-line, rgba(255,255,255,0.08))}
        .sl .sw{width:34px;height:34px;border-radius:10px;flex:none;display:grid;place-items:center;font-size:13px;font-weight:600;color:#1a1a1c;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.15)} /* ki-hex-ok: tall på filamentfargen */
        .si{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px}
        .sr{display:flex;justify-content:space-between;gap:10px}
        .sn{font-size:14px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .sp{font-size:12px;color:var(--ki-text-mid, #8e8d89);white-space:nowrap}
        .sb{height:4px;border-radius:2px;background:var(--ki-surface-3, #3c3c3c);overflow:hidden}
        .sb div{height:100%}
      `;
    }
  }

  M.FUNCTION_POPUPS.push([HASH, '3D-printer', 'mdi:printer-3d', 'msh-printer-card']);
  M.popupNeeds[HASH] = (h) => M.printerHas(h);
  M.HASH_ALIAS['#3d'] = HASH; // den importerte #3d åpner denne
  M.POPUP_SUPERSEDE = M.POPUP_SUPERSEDE || {};
  M.POPUP_SUPERSEDE[HASH] = { name: '3D-printer', test: (cfg) => /printer|creality|bambu|3d/i.test(JSON.stringify(cfg || {})) };
  if (M.POPUP_CARDS && !M.POPUP_CARDS.includes('msh-printer-card')) M.POPUP_CARDS.push('msh-printer-card');
  M.define('msh-printer-card', Printer, 'MSH 3D-printer', '3D-printer-popup (#3d-printer): status, kamera, kontroller, temperaturer og filament (CFS/AMS).');
})();
