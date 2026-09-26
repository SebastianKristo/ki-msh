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
  M.roomAuto = function (hass, area) {
    const ov = M.kiRom(hass, area, 'oversikt');
    const A = (ov && ov.attributes) || {};
    const first = (arr) => M.ids(arr)[0] || null;
    const temp = first(A.temperatur) || M.byClass(hass, 'sensor', 'temperature', area)[0] || null;
    const hum = first(A.fuktighet) || M.byClass(hass, 'sensor', 'humidity', area)[0] || null;
    const thermo = first(A.klima) || M.all(hass, 'climate', (s, id) => M.areaOf(hass, id) === area)[0] || null;
    const lights = A.lys ? M.ids(A.lys) : M.all(hass, 'light', (s, id) => M.areaOf(hass, id) === area);
    return { ov, A, temp, hum, thermo, lights };
  };

  class RomKlima extends M.Card {
    static get cardName() { return 'Rom · klima-toppkort'; }
    static get defaults() { return { graph_t: 'var(--orange, #f2b573)', graph_h: 'var(--blue, #73b9f2)', graph_fill: 0.2, graph_width: 2 }; }
    static get schema() {
      return [
        { type: 'area', name: 'area', label: 'Rom (område)', help: 'Tomt = hentes fra popupens hash (#stue → stue)' },
        { type: 'text', name: 'name', label: 'Navn', auto: (h, c) => M.areaName(h, c.area) },
        { type: 'overrides', label: 'Bytt sensor/termostat', fields: [
          { name: 'temperatur', label: 'Temperatur', domain: 'sensor', device_class: 'temperature', auto: (h, c) => c.area && M.roomAuto(h, c.area).temp },
          { name: 'fuktighet', label: 'Luftfuktighet', domain: 'sensor', device_class: 'humidity', auto: (h, c) => c.area && M.roomAuto(h, c.area).hum },
          { name: 'termostat', label: 'Termostat (chip)', domain: 'climate', auto: (h, c) => c.area && M.roomAuto(h, c.area).thermo },
        ] },
        { type: 'section', label: 'Graf', icon: 'mdi:chart-line', fields: [
          { type: 'color', name: 'graph_t', label: 'Linje · temperatur (romfarge)' },
          { type: 'color', name: 'graph_h', label: 'Linje · fukt' },
          { type: 'select', name: 'graph_fill', label: 'Fyll', options: [[0, 'Av'], [0.2, 'Svak'], [0.4, 'Sterk']], default: 0.2 },
          { type: 'select', name: 'graph_width', label: 'Linje', options: [[1.5, 'Tynn'], [2, 'Normal'], [3, 'Tykk']], default: 2 },
        ] },
      ];
    }
    get cardSize() { return 4; }
    onOpen() { this._loadHist(); }
    async _loadHist() {
      const e = this._ents();
      if (!e.temp && !e.hum) return;
      const h = await M.history(this.hass, [e.temp, e.hum].filter(Boolean), 24);
      this._hist = { t: e.temp ? M.sample(h[e.temp], 25) : [], h: e.hum ? M.sample(h[e.hum], 25) : [] };
      this.update();
    }
    _ents() {
      const area = M.roomArea(this), a = area ? M.roomAuto(this.hass, area) : {};
      return { area, temp: M.pick(this.config, 'temperatur', a.temp), hum: M.pick(this.config, 'fuktighet', a.hum), thermo: M.pick(this.config, 'termostat', a.thermo), lights: a.lights || [] };
    }
    render() {
      const c = this.config, e = this._ents(), ui = this.ui;
      const name = c.name || (e.area ? M.areaName(this.hass, e.area) : '–');
      const tNow = this.n(e.temp), hNow = this.n(e.hum), th = this.s(e.thermo);
      const on = e.lights.filter((id) => { const s = this.s(id); return s && s.state === 'on'; }).length;
      const set = th && th.attributes.temperature != null ? Number(th.attributes.temperature) : null;
      const heating = !!th && (th.attributes.hvac_action === 'heating' || (th.attributes.hvac_action == null && th.state === 'heat' && tNow != null && set != null && tNow < set));
      const hc = heating ? C.red : on > 0 ? C.yellow : C.blue;
      const chipIcon = heating ? 'mdi:fire' : on > 0 ? 'mdi:lightbulb' : 'mdi:check';
      const chipText = heating ? `Varmer til ${M.nf(set, 1)}°` : set != null ? `Holder ${M.nf(set, 1)}°` : on > 0 ? `${on} lys på` : 'Alt er rolig';
      // serier: historikk (25 punkter) + live siste punkt; flat graf når data mangler
      const hist = this._hist || { t: [], h: [] };
      const ser0 = { t: hist.t.length ? hist.t.slice() : (tNow != null ? Array(25).fill(tNow) : []), h: hist.h.length ? hist.h.slice() : (hNow != null ? Array(25).fill(hNow) : []) };
      if (tNow != null && ser0.t.length) ser0.t[24] = tNow;
      if (hNow != null && ser0.h.length) ser0.h[24] = hNow;
      const isT = (ui.tab || 't') === 't' || !ser0.h.length && ser0.t.length;
      const ser = isT ? ser0.t : ser0.h;
      const gc = M.color(isT ? c.graph_t : c.graph_h, isT ? C.orange : C.blue);
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
          <button class="gear press" data-act="customize" title="Tilpass">${M.icon('settings', 22, 'color:#fafafa')}</button>
          <div class="top">
            <span class="nm ell">${esc(name)}</span>
            <span class="chip" style="background:${M.alpha(hc, 0.18)};color:${hc}">${M.icon(chipIcon, 14)}${esc(chipText)}</span>
          </div>
          <div class="vals">
            <div class="line">
              <button class="t" data-act="tab" data-t="t" style="color:${isT ? '#fafafa' : '#7f7f7f'}"><span class="big num">${tv != null ? M.nf(tv, 1) : '–'}</span><span class="deg">°</span></button>
              <button class="h" data-act="tab" data-t="h" data-haptic="selection" style="background:${isT ? 'transparent' : M.alpha(C.blue, 0.2)};color:${isT ? '#afafaf' : '#fafafa'}"><span class="hv num">${hv != null ? M.nf(hv, 0) : '–'}</span><span class="pc">%</span></button>
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
        .hero{position:relative;height:184px;border-radius:28px;overflow:hidden;background:var(--gray200,#3a3a3a);box-shadow:inset 0 0 0 1px rgba(255,255,255,0.05);width:100%}
        .graph{position:absolute;left:0;right:0;bottom:0;height:84px}
        .graph svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
        .cursor{position:absolute;top:0;bottom:0;pointer-events:none}
        .scrub{position:absolute;inset:0;touch-action:none;cursor:crosshair}
        .gear{position:absolute;right:16px;top:16px;width:44px;height:44px;border-radius:22px;background:rgba(255,255,255,0.1);display:grid;place-items:center}
        .gear:active{transform:scale(.92)}
        .top{position:absolute;left:18px;top:18px;right:120px;display:flex;align-items:center;gap:8px}
        .nm{font-size:13px;color:var(--gray800,#afafaf)}
        .chip{height:26px;padding:0 10px 0 8px;border-radius:13px;display:flex;align-items:center;gap:5px;font-size:11px;font-weight:600;white-space:nowrap;flex:none}
        .vals{position:absolute;left:18px;top:54px;display:flex;flex-direction:column;gap:2px}
        .line{display:flex;align-items:baseline;gap:8px;white-space:nowrap}
        .t{display:flex;align-items:flex-start;transition:color .25s}
        .big{font-size:44px;font-weight:300;letter-spacing:-0.04em;line-height:1}
        .deg{font-size:24px;font-weight:300}
        .h{display:flex;align-items:baseline;gap:1px;height:26px;padding:0 9px;border-radius:13px;transition:background .25s,color .25s}
        .hv{font-size:17px;font-weight:400}
        .pc{font-size:12px;color:var(--gray700,#979797)}
        .when{font-size:12px;color:var(--gray600,#7f7f7f);white-space:nowrap}
      `;
    }
  }
  M.define('msh-rom-klima-card', RomKlima, 'MSH Rom · klima-toppkort', 'Temperatur, fukt, termostat-chip og 24 t-graf med scrubbing. Alltid første kort i rom-popupen.');
})();
