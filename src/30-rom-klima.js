/* msh-rom-klima-card · Rom-popup, klima-toppkort (alltid først). Kilde: Rom v4.dc.html hasHero/heroCard.
 * Temperatur/fukt fra KI Rom (_oversikt) → ellers første sensor med device_class i rommet.
 * Chip fra første climate.* i rommet. Historikk 24 t når popupen åpnes (cache 5 min).
 */
(function () {
  const M = window.MSH, esc = M.esc, C = M.C;

  // Felles oppslag for et rom (brukes også av msh-rom-card via MSH.room).
  M.roomArea = function (card) {
    const c = card.config || {};
    if (c.area) return c.area;
    const h = M.popupHash(card);
    return h ? h.replace(/^#/, '') : null;
  };
  // KI Rom-attributter kan være tall (verdi), entity_id-streng eller liste (strenger / {entity}).
  // Returnerer { id, v }: id = første entitet med numerisk state, ellers v = tallet fra attributtet.
  M.attrEnt = function (hass, raw) {
    if (raw == null || raw === '') return { id: null, v: null };
    if (typeof raw === 'number') return { id: null, v: raw };
    if (typeof raw === 'string') {
      if (/^[a-z_]+\.[a-z0-9_]+$/.test(raw)) return { id: raw, v: M.num(hass, raw) };
      return M.isNum(raw) ? { id: null, v: Number(raw) } : { id: null, v: null };
    }
    if (Array.isArray(raw)) {
      const ids = M.ids(raw);
      const hit = ids.find((id) => M.num(hass, id) != null) || ids.find((id) => hass.states[id]) || null;
      if (hit) return { id: hit, v: M.num(hass, hit) };
      const n = raw.find((x) => typeof x === 'number');
      return { id: null, v: n != null ? n : null };
    }
    if (typeof raw === 'object' && raw.entity) return M.attrEnt(hass, raw.entity);
    return { id: null, v: null };
  };
  const firstNum = (hass, ids) => ids.find((id) => M.num(hass, id) != null) || ids[0] || null;
  M.roomAuto = function (hass, area) {
    let ov = M.kiRom(hass, area, 'oversikt');
    if (!ov && hass && hass.areas && hass.areas[area]) { const g = hass.states[`sensor.${M.slug(hass.areas[area].name)}_oversikt`]; if (g && g.attributes.integrasjon === 'ki_rom') ov = g; }
    const A = (ov && ov.attributes) || {};
    const t = M.attrEnt(hass, A.temperatur), h = M.attrEnt(hass, A.fuktighet);
    let temp = t.id || (t.v == null ? firstNum(hass, M.byClass(hass, 'sensor', 'temperature', area)) : null);
    let hum = h.id || (h.v == null ? firstNum(hass, M.byClass(hass, 'sensor', 'humidity', area)) : null);
    // Ingen sensor i rommet → husets sensorer (strategi-config fallback_temperature / fallback_humidity)
    const FB = M.FALLBACK || {};
    let tempFallback = false, humFallback = false;
    if (!temp && t.v == null) { const f = FB.temperature || 'sensor.hus_temperature'; if (hass.states[f]) { temp = f; tempFallback = true; } }
    if (!hum && h.v == null) { const f = FB.humidity || 'sensor.hus_fuktighet'; if (hass.states[f]) { hum = f; humFallback = true; } }
    const climates = A.klima ? M.ids(A.klima).filter((id) => id.startsWith('climate.')) : [];
    const areaClim = M.all(hass, 'climate', (s, id) => M.areaOf(hass, id) === area);
    const thermo = climates[0] || areaClim[0] || null;
    const lights = A.lys ? M.ids(A.lys) : M.all(hass, 'light', (s, id) => M.areaOf(hass, id) === area);
    return { ov, A, temp, hum, tempFallback, humFallback, tempVal: t.id ? null : t.v, humVal: h.id ? null : h.v, thermo, climates: [...new Set([...climates, ...areaClim])], lights };
  };
  // Romkonfig publisert av msh-rom-card («Tilpass rom»), så toppkort/romkort bruker samme overstyringer.
  M.roomCfgs = M.roomCfgs || {};
  M.setRoomCfg = function (area, cfg) {
    if (!area) return;
    const prev = JSON.stringify(M.roomCfgs[area] || null);
    M.roomCfgs[area] = cfg;
    if (prev !== JSON.stringify(cfg)) window.dispatchEvent(new CustomEvent('msh-room-config', { detail: { area } }));
  };
  // Klima-oppslag for et rom med overstyring. Nøkler: overrides.temperature|humidity|climate
  // (eldre: temperatur|fuktighet|termostat), include.climate: [ekstra termostater].
  M.roomClimate = function (hass, area, cfg) {
    const a = area ? M.roomAuto(hass, area) : { climates: [] };
    const rc = (area && (M.roomCfgs[area] || (M.store && M.store.eff('rooms.' + area)))) || {};
    const o = { ...((rc && rc.overrides) || {}), ...((cfg && cfg.overrides) || {}) };
    const tId = o.temperature || o.temperatur || a.temp || null, hId = o.humidity || o.fuktighet || a.hum || null;
    const clim = o.climate || o.termostat || a.thermo || null;
    const inc = [...(((rc.include || {}).climate) || []), ...((((cfg || {}).include || {}).climate) || [])];
    return {
      area, auto: a,
      temp: { id: tId, v: tId ? M.num(hass, tId) : a.tempVal },
      hum: { id: hId, v: hId ? M.num(hass, hId) : a.humVal },
      climate: clim,
      climates: [...new Set([clim, ...inc].filter(Boolean))],
      lights: a.lights || [],
    };
  };

  class RomKlima extends M.Card {
    static get cardName() { return 'Rom · klima-toppkort'; }
    // 20.14: standard temperatur-graf er rød (Rom v4 graphLook t: C.red) for alle rom – ikke romfargen
    static get defaults() { return { graph_t: 'var(--red, #f28073)', graph_h: 'var(--blue, #73b9f2)', graph_fill: 0.2, graph_width: 2 }; }
    static get schema() {
      return [
        { type: 'area', name: 'area', label: 'Rom (område)', help: 'Tomt = hentes fra popupens hash (#stue → stue)' },
        { type: 'text', name: 'name', label: 'Navn', auto: (h, c) => M.areaName(h, c.area) },
        { type: 'section', id: 'klima', label: 'Klima', icon: 'mdi:thermostat', open: true, fields: [
          { type: 'info', label: 'Tomt = Automatisk. Samme valg som «Tilpass rom» → Klima (verdiene der gjelder når feltene her er tomme).' },
          { type: 'entity', name: 'overrides.climate', label: 'Termostat', domain: 'climate', area: (h, c) => c.area, auto: (h, c) => (c.area ? M.roomClimate(h, c.area, {}).climate : null) },
          { type: 'entity', name: 'overrides.temperature', label: 'Temperatursensor', domain: 'sensor', device_class: 'temperature', area: (h, c) => c.area, auto: (h, c) => (c.area ? M.roomClimate(h, c.area, {}).temp.id : null) },
          { type: 'entity', name: 'overrides.humidity', label: 'Fuktsensor', domain: 'sensor', device_class: 'humidity', area: (h, c) => c.area, auto: (h, c) => (c.area ? M.roomClimate(h, c.area, {}).hum.id : null) },
        ] },
        { type: 'boolean', name: 'header_icon', label: 'Rommets ikon i popup-headeren', default: true },
        { type: 'section', label: 'Graf', icon: 'mdi:chart-line', fields: [
          { type: 'color', name: 'graph_t', label: 'Linje · temperatur', auto: () => 'var(--red, #f28073)', help: 'Tomt = rød (standard)' },
          { type: 'color', name: 'graph_h', label: 'Linje · fukt' },
          { type: 'select', name: 'graph_fill', label: 'Fyll', options: [[0, 'Av'], [0.2, 'Svak'], [0.4, 'Sterk']], default: 0.2 },
          { type: 'select', name: 'graph_width', label: 'Linje', options: [[1.5, 'Tynn'], [2, 'Normal'], [3, 'Tykk']], default: 2 },
        ] },
      ];
    }
    get cardSize() { return 4; }
    constructor() {
      super();
      this._onRoomCfg = (ev) => { if (ev.detail && ev.detail.area === M.roomArea(this)) this.update(); };
    }
    connectedCallback() { super.connectedCallback(); window.addEventListener('msh-room-config', this._onRoomCfg); }
    disconnectedCallback() { super.disconnectedCallback(); window.removeEventListener('msh-room-config', this._onRoomCfg); }
    onOpen() { this._loadHist(); this._headerIcon(); }
    async _loadHist() {
      const e = this._ents();
      const key = (e.temp || '') + '|' + (e.hum || '');
      // byttet sensor → tøm cachen for den gamle og hent ny historikk
      if (this._histKey && this._histKey !== key) { this._histKey.split('|').filter(Boolean).forEach((id) => M.historyForget(id)); this._hist = null; }
      this._histKey = key;
      if (!e.temp && !e.hum) { this._hist = null; this.update(); return; }
      const h = await M.history(this.hass, [e.temp, e.hum].filter(Boolean), 24);
      if (this._histKey !== key) return;
      this._hist = { t: e.temp ? M.sample(h[e.temp], 25) : [], h: e.hum ? M.sample(h[e.hum], 25) : [] };
      this.update();
    }
    _ents() {
      const area = M.roomArea(this), rc = M.roomClimate(this.hass, area, this.config);
      return { area, temp: rc.temp.id, hum: rc.hum.id, tVal: rc.temp.v, hVal: rc.hum.v, thermo: rc.climate, lights: rc.lights || [] };
    }
    // Popup-headerens ikon = rommets ikon (HA-område → KI Rom «ikon»).
    _headerIcon() {
      if (this.config.header_icon === false) return;
      const area = M.roomArea(this); if (!area) return;
      const au = M.roomAuto(this.hass, area);
      const icon = (this.hass.areas && this.hass.areas[area] && this.hass.areas[area].icon) || (au.A && au.A.ikon) || null;
      const cont = M.popupContainer(this), root = cont && cont.getRootNode && cont.getRootNode();
      const hi = root && root.querySelector && (root.querySelector('.bubble-header-container .bubble-icon') || root.querySelector('.bubble-header-container ha-icon'));
      if (icon && hi && hi.getAttribute('icon') !== icon) { hi.setAttribute('icon', icon); hi.icon = icon; }
    }
    render() {
      const c = this.config, e = this._ents(), ui = this.ui;
      const name = c.name || (e.area ? M.areaName(this.hass, e.area) : '–');
      if (e.temp) this.s(e.temp);
      if (e.hum) this.s(e.hum);
      const tNow = e.tVal, hNow = e.hVal, th = this.s(e.thermo);
      if (this.isOpen && this._histKey != null && this._histKey !== (e.temp || '') + '|' + (e.hum || '')) setTimeout(() => this._loadHist(), 0);
      const on = e.lights.filter((id) => { const s = this.s(id); return s && s.state === 'on'; }).length;
      const set = th && th.attributes.temperature != null ? Number(th.attributes.temperature) : null;
      const heating = !!th && (th.attributes.hvac_action === 'heating' || (th.attributes.hvac_action == null && th.state === 'heat' && tNow != null && set != null && tNow < set));
      // Termostat-chip når rommet har climate.* (blå «✓ Holder 21,0°», rød ved oppvarming); lys-chip kun uten termostat.
      let hc, chipIcon, chipText;
      if (th) {
        hc = heating ? C.red : C.blue;
        chipIcon = heating ? 'mdi:fire' : 'mdi:check';
        chipText = heating ? `Varmer til ${M.nf(set, 1)}°` : set != null ? `Holder ${M.nf(set, 1)}°` : (th.state === 'off' ? 'Termostat av' : M.fmtState(this.hass, e.thermo));
      } else {
        hc = on > 0 ? C.yellow : C.blue;
        chipIcon = on > 0 ? 'mdi:lightbulb' : 'mdi:check';
        chipText = on > 0 ? `${on} lys på` : 'Alt er rolig';
      }
      // serier: historikk (25 punkter) + live siste punkt; flat graf når data mangler
      const hist = this._hist || { t: [], h: [] };
      const ser0 = { t: hist.t.length ? hist.t.slice() : (tNow != null ? Array(25).fill(tNow) : []), h: hist.h.length ? hist.h.slice() : (hNow != null ? Array(25).fill(hNow) : []) };
      if (tNow != null && ser0.t.length) ser0.t[24] = tNow;
      if (hNow != null && ser0.h.length) ser0.h[24] = hNow;
      const isT = (ui.tab || 't') === 't' || !ser0.h.length && ser0.t.length;
      const ser = isT ? ser0.t : ser0.h;
      const gc = M.color(isT ? c.graph_t : c.graph_h, isT ? C.red : C.blue); // 20.14: tomt = rød
      const sel = ui.sel != null ? ui.sel : 24;
      let pts = '0,60 300,60', lo = 0, hi = 1, mn = null, mx = null;
      if (ser.length) {
        mn = Math.min(...ser); mx = Math.max(...ser);
        lo = Math.floor(mn - (isT ? 0.3 : 2)); hi = Math.ceil(mx + (isT ? 0.3 : 2));
        if (hi === lo) hi = lo + 1;
        const X = (i) => ((i / 24) * 300).toFixed(1), Y = (v) => (92 - ((v - lo) / (hi - lo)) * 72).toFixed(1);
        pts = ser.map((v, i) => `${X(i)},${Y(v)}`).join(' ');
      }
      const tv = ser0.t.length ? ser0.t[sel] : tNow, hv = ser0.h.length ? ser0.h[sel] : hNow;
      const range = isT ? (mn != null ? `${M.nf(Math.min(...ser0.t), 1)}–${M.nf(Math.max(...ser0.t), 1)}°` : '–') : (ser0.h.length ? `${M.nf(Math.min(...ser0.h), 0)}–${M.nf(Math.max(...ser0.h), 0)} %` : '–');
      const when = sel === 24 ? (ser.length ? `Nå · ${range} siste døgn` : 'nå') : `−${24 - sel} t`;
      const fill = Number(c.graph_fill != null ? c.graph_fill : 0.2), w = Number(c.graph_width || 2);
      return `
        <section class="hero" data-ent="${esc(e.temp || e.thermo || '')}">
          <div class="graph">
            <svg viewBox="0 0 300 100" preserveAspectRatio="none">
              <polyline points="0,100 ${pts} 300,100" style="fill:${M.alpha(gc, fill)};stroke:none"></polyline>
              <polyline points="${pts}" fill="none" style="stroke:${gc};stroke-width:${w}" stroke-linejoin="round" vector-effect="non-scaling-stroke"></polyline>
            </svg>
            <div class="cursor" style="left:${(sel / 24) * 100}%;border-left:1px dashed ${M.alpha(gc, 0.6)}"></div>
            <div class="scrub"></div>
          </div>
          <button class="gear press" data-act="customize" title="Tilpass">${M.icon('settings', 22, 'color:var(--ki-text, #fafafa)')}</button>
          <div class="top">
            <span class="nm ell">${esc(name)}</span>
            <span class="chip" style="background:${M.alpha(hc, 0.18)};color:${M.theme.accentText(hc)}">${M.icon(chipIcon, 14)}${esc(chipText)}</span>
          </div>
          <div class="vals">
            <div class="line">
              <button class="t" data-act="tab" data-t="t" style="color:${isT ? 'var(--ki-text, #fafafa)' : 'var(--ki-text-3, #7f7f7f)'}"><span class="big num">${tv != null ? M.nf(tv, Math.round(tv * 10) % 10 === 0 ? 0 : 1) : '–'}</span><span class="deg">°</span></button>
              <button class="h" data-act="tab" data-t="h" data-haptic="selection" style="background:${isT ? 'transparent' : M.alpha(C.blue, 0.2)};color:${isT ? 'var(--ki-text-2, #afafaf)' : 'var(--ki-text, #fafafa)'}"><span class="hv num">${hv != null ? M.nf(hv, 0) : '–'}</span><span class="pc">%</span></button>
            </div>
            <span class="when">${esc(when)}</span>
          </div>
        </section>`;
    }
    onAction(name, el, ev) {
      if (name === 'tab') return this.setUI({ tab: el.dataset.t, sel: null });
      // Tannhjulet åpner hele rom-tilpasningen (msh-rom-card) når den finnes, ellers kortets egen.
      if (name === 'customize' && M.roomCustomize && M.roomCustomize(M.roomArea(this), el.dataset.section)) return;
      return super.onAction(name, el, ev);
    }
    afterRender() {
      const sc = this.shadowRoot.querySelector('.scrub');
      if (!sc || sc.__b) return;
      sc.__b = true;
      M.guardDrag(sc, 'none');
      const pos = (e) => { const r = sc.getBoundingClientRect(); return M.clamp(Math.round(((e.clientX - r.left) / r.width) * 24), 0, 24); };
      let down = false;
      sc.addEventListener('pointerdown', (e) => { down = true; this._busy = false; try { sc.setPointerCapture(e.pointerId); } catch (x) { /* */ } const p = pos(e); if (p !== this.ui.sel) { M.haptic('selection'); this.setUI({ sel: p }); } });
      sc.addEventListener('pointermove', (e) => { if (!down && e.pointerType !== 'mouse') return; const p = pos(e); if (p !== this.ui.sel) { if (down) M.haptic('selection'); this.setUI({ sel: p }); } });
      const end = () => { down = false; this.setUI({ sel: null }); };
      sc.addEventListener('pointerup', end);
      sc.addEventListener('pointercancel', end);
      sc.addEventListener('pointerleave', end);
    }
    get styles() {
      return `
        .hero{position:relative;height:184px;border-radius:28px;overflow:hidden;background:var(--ki-surface, var(--gray200,#3a3a3a));box-shadow:inset 0 0 0 1px rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.05*var(--ki-wa-k,1)),var(--ki-wa-max,1)));width:100%}
        .graph{position:absolute;left:0;right:0;bottom:0;height:84px}
        .graph svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
        .cursor{position:absolute;top:0;bottom:0;pointer-events:none}
        .scrub{position:absolute;inset:0;touch-action:none;cursor:crosshair}
        .gear{position:absolute;right:16px;top:16px;width:44px;height:44px;border-radius:22px;background:rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.1*var(--ki-wa-k,1)),var(--ki-wa-max,1)));display:grid;place-items:center}
        .gear:active{transform:scale(.92)}
        .top{position:absolute;left:18px;top:18px;right:120px;display:flex;align-items:center;gap:8px}
        .nm{font-size:13px;color:var(--ki-text-2, var(--gray800,#afafaf))}
        .chip{height:26px;padding:0 10px 0 8px;border-radius:13px;display:flex;align-items:center;gap:5px;font-size:11px;font-weight:600;white-space:nowrap;flex:none}
        .vals{position:absolute;left:18px;top:54px;display:flex;flex-direction:column;gap:2px}
        .line{display:flex;align-items:baseline;gap:8px;white-space:nowrap}
        .t{display:flex;align-items:flex-start;transition:color .25s}
        .big{font-size:44px;font-weight:300;letter-spacing:-0.04em;line-height:1}
        .deg{font-size:24px;font-weight:300}
        .h{display:flex;align-items:baseline;gap:1px;height:26px;padding:0 9px;border-radius:13px;transition:background .25s,color .25s}
        .hv{font-size:17px;font-weight:400}
        .pc{font-size:12px;color:var(--ki-text-mid, var(--gray700,#979797))}
        .when{font-size:12px;color:var(--ki-text-3, var(--gray600,#7f7f7f));white-space:nowrap}
      `;
    }
  }
  M.define('msh-rom-klima-card', RomKlima, 'MSH Rom · klima-toppkort', 'Temperatur, fukt, termostat-chip og 24 t-graf med scrubbing. Alltid første kort i rom-popupen.');
})();
