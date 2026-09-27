/* msh-strompris-card · Hjem, «Strømpriser» (spesifikasjon punkt 14): header-rad med tittel + I dag / I morgen utenfor
 * kortflaten; kortflate med verdirad (Spot nå / valgt time · Norgespris), legende, trinnlinje-graf i øre/kWh (teal, oransje
 * over terskel, fylt område, stiplet Norgespris-linje, valgt time med bånd + prikk) og x-akse. Scrub på grafen velger time.
 * Autokonfig (entiteter.md «Strøm»): pris-sensor M.priceSensor (nordpool / tibber / energi_data_service – samme sensor som
 * prosa-boblen «Strømmen koster …»), config `entity` / overrides.price overstyrer. Timespriser fra today/tomorrow (24 tall
 * eller 96 kvarter → timesnitt), ellers raw_today/raw_tomorrow ({start, value}). Norgespris: sensor.*norgespris* (kr/kWh)
 * eller config `norgespris` (0,50). Kortet vises alltid: mangler data → «–» og tom graf (bare rutenettet).
 */
(function () {
  const M = window.MSH, esc = M.esc;
  const HOUR = 3600000;
  const hh = (h) => String(h).padStart(2, '0');
  const nf2 = (v) => (v == null || isNaN(v) ? '–' : M.nf(v, 2));

  /* ------------------------------------------------------------ felles pris-oppslag (prosa, faner-slide, romvarsler, dette kortet) */
  const PER_KWH = /\/\s*kwh/i;
  M.priceScale = M.priceScale || function (st) {
    const a = (st && st.attributes) || {};
    return a.price_in_cents === true || /øre|öre|\bore\b|cent/i.test(String(a.unit_of_measurement || '')) ? 0.01 : 1;
  };
  const hasSeries = (a) => ['raw_today', 'today', 'prices_today'].some((k) => Array.isArray(a[k]) && a[k].length);
  // En pris-sensor: enhet «…/kWh» (NOK/kWh, kr/kWh, øre/kWh), eller uten enhet men med timesprislister.
  // Kostnad (kr/NOK uten /kWh, device_class monetary), energi (kWh) og effekt (W) velges aldri.
  M.isPriceSensor = M.isPriceSensor || function (hass, id) {
    const s = hass && id && hass.states[id];
    if (!s || !/^(sensor|input_number)\./.test(id)) return false;
    const a = s.attributes || {}, u = String(a.unit_of_measurement || ''), dc = a.device_class;
    if (dc === 'energy' || dc === 'power' || dc === 'energy_storage') return false;
    if (PER_KWH.test(u)) return true;
    if (dc === 'monetary' || u) return false;
    return hasSeries(a);
  };
  // Samme sensor for prosa-boblen og strømpriskortet: overrides.price → plattform nordpool → tibber → energi_data_service
  // (sensorer med timespriser først) → første sensor med enhet …/kWh.
  M.priceSensor = M.priceSensor || function (hass, cfg) {
    const o = (cfg && cfg.overrides) || {};
    if (o.price) return o.price;
    if (!hass || !hass.states) return null;
    const rank = (id) => { const a = hass.states[id].attributes || {}; return (hasSeries(a) ? 0 : 2) + (M.isNum(hass.states[id].state) ? 0 : 1); };
    const best = (ids) => ids.filter((id) => M.isPriceSensor(hass, id)).sort((x, y) => rank(x) - rank(y) || (x < y ? -1 : 1))[0] || null;
    for (const p of ['nordpool', 'tibber', 'energi_data_service']) { const hit = best(M.byPlatform(hass, p, 'sensor')); if (hit) return hit; }
    return best(Object.keys(hass.states).filter((id) => id.startsWith('sensor.')));
  };
  // Nåpris i kr/kWh (state × skala).
  M.priceNow = M.priceNow || function (hass, id) {
    const s = hass && id && hass.states[id];
    if (!s || !M.isNum(s.state)) return null;
    return Number(s.state) * M.priceScale(s);
  };
  // 48 timer (i dag 0–23, i morgen 24–47) i kr/kWh. Tåler raw_today/raw_tomorrow ({start,end,value}), today/tomorrow
  // (tall-lister – også 96 kvarter – eller objektlister) og prices_today/prices_tomorrow. Kvarterpriser → timesnitt.
  M.priceSeries = M.priceSeries || function (hass, id) {
    const s = hass && id && hass.states[id];
    const out = Array(48).fill(null);
    if (!s) return out;
    const a = s.attributes || {}, k = M.priceScale(s);
    const d0 = new Date(); d0.setHours(0, 0, 0, 0);
    const sum = Array.from({ length: 48 }, () => [0, 0]);
    const put = (t, v) => {
      if (v == null || v === '' || isNaN(Number(v)) || isNaN(t)) return;
      const d = new Date(t), day = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - d0) / 86400000);
      if (day < 0 || day > 1) return;
      const i = day * 24 + d.getHours();
      sum[i][0] += Number(v) * k; sum[i][1]++;
    };
    [['raw_today', 'today', 'prices_today', 0], ['raw_tomorrow', 'tomorrow', 'prices_tomorrow', 1]].forEach(([rk, tk, pk, day]) => {
      const list = [a[tk], a[rk], a[pk]].find((x) => Array.isArray(x) && x.length);
      if (!list) return;
      if (list[0] != null && typeof list[0] === 'object') {
        list.forEach((p) => { if (!p) return; const st = p.start || p.startsAt || p.time || p.hour; const v = p.value !== undefined ? p.value : p.price !== undefined ? p.price : p.total; put(new Date(st).getTime(), v); });
      } else {
        const base = d0.getTime() + day * 86400000, step = HOUR * (24 / list.length);
        list.forEach((v, i) => put(base + i * step + 1, v));
      }
    });
    sum.forEach(([t, n], i) => { if (n) out[i] = t / n; });
    return out;
  };


  // Norgespris-sensor: config norgespris_entity → første sensor.*norgespris* med tallverdi og enhet …/kWh (eller uten enhet).
  M.norgesprisSensor = M.norgesprisSensor || function (hass, cfg) {
    if (cfg && cfg.norgespris_entity) return cfg.norgespris_entity;
    if (!hass || !hass.states) return null;
    return Object.keys(hass.states).filter((id) => {
      if (!/^sensor\..*norgespris/i.test(id)) return false;
      const s = hass.states[id], u = String((s.attributes || {}).unit_of_measurement || '');
      return M.isNum(s.state) && (!u || PER_KWH.test(u));
    }).sort()[0] || null;
  };

  /* ------------------------------------------------------------ kort */
  const TEAL = 'oklch(0.78 0.13 175)', ORANGE = 'oklch(0.74 0.17 55)', PINK = 'oklch(0.78 0.13 350)';
  const VW = 480, VH = 150, PT = 6, PB = 6; // viewBox + innrykk topp/bunn for rutenettet
  const num = (v) => (v === '' || v == null || isNaN(Number(v)) ? null : Number(v));
  // «Pen» y-skala med 5 verdier (4 steg) som dekker lo..hi.
  const scale = (lo, hi) => {
    if (!(hi > lo)) hi = lo + 100;
    const raw = (hi - lo) / 4, p = Math.pow(10, Math.floor(Math.log10(raw)));
    for (const m of [1, 2, 2.5, 3, 4, 5, 6, 8, 10, 20]) {
      const st = m * p, y0 = Math.floor(lo / st) * st;
      if (y0 + 4 * st >= hi - 1e-9) return { y0, st };
    }
    return { y0: lo, st: raw };
  };

  class Strompris extends M.Card {
    static get cardName() { return 'Hjem · strømpriser'; }
    static get defaults() { return { show_norgespris: true }; }
    static get schema() {
      return [
        { type: 'section', id: 'kort', label: 'Strømpriser', icon: 'mdi:flash', open: true, fields: [
          { type: 'entity', name: 'entity', label: 'Pris-sensor (spot, today/tomorrow eller raw_today/raw_tomorrow)', domain: 'sensor', auto: (h) => M.priceSensor(h, {}) },
          { type: 'entity', name: 'norgespris_entity', label: 'Norgespris-sensor (kr/kWh)', domain: 'sensor', auto: (h) => M.norgesprisSensor(h, {}) },
          { type: 'number', name: 'norgespris', label: 'Norgespris uten sensor (kr/kWh)', step: 0.01, placeholder: '0.50' },
          { type: 'number', name: 'threshold', label: 'Oransje linje over (kr/kWh)', step: 0.05, placeholder: 'Norgespris', help: 'Tomt = Norgespris' },
          { type: 'boolean', name: 'show_norgespris', label: 'Vis Norgespris', default: true },
        ] },
      ];
    }
    get cardSize() { return 5; }
    _priceId() {
      const c = this.config;
      return c.entity ? c.entity : M.priceSensor(this.hass, c);
    }
    _norgespris() {
      const c = this.config, id = M.norgesprisSensor(this.hass, c), st = this.s(id);
      if (st && M.isNum(st.state)) return { v: Number(st.state) * M.priceScale(st), id };
      const v = num(c.norgespris);
      return { v: v != null ? v : 0.5, id: null };
    }
    render() {
      const c = this.config, hass = this.hass, ui = this.ui;
      const id = this._priceId(), st = this.s(id);
      const all = st ? M.priceSeries(hass, id) : Array(48).fill(null);
      const hasT = all.slice(0, 24).some((v) => v != null), hasM = all.slice(24).some((v) => v != null);
      const isToday = !(ui.day === 'tomorrow' && hasM);
      const ser = isToday ? all.slice(0, 24) : all.slice(24);
      const has = isToday ? hasT : hasM;
      const nowH = new Date().getHours();
      const np = this._norgespris(), showNp = c.show_norgespris !== false;
      const thr = num(c.threshold) != null ? num(c.threshold) : np.v;
      const scrub = ui.sel != null && has;
      const sel = scrub ? ui.sel : isToday && has ? nowH : null;

      // Verdirad (kr/kWh)
      let label, val;
      if (scrub) { label = `Spot ${isToday ? 'i dag' : 'i morgen'} kl. ${hh(sel)}`; val = ser[sel]; }
      else if (isToday) { label = 'Spot nå'; val = M.priceNow(hass, id); if (val == null) val = ser[nowH]; }
      else { const v = ser.filter((x) => x != null); label = 'Spot snitt i morgen'; val = v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; }

      // Graf (øre/kWh)
      const ore = ser.map((v) => (v == null ? null : v * 100)), vals = ore.filter((v) => v != null);
      const npO = np.v * 100, thrO = thr * 100;
      const lo = Math.min(0, ...vals), hi = vals.length ? Math.max(...vals, showNp ? npO : 0) * 1.05 : 100;
      const { y0, st: step } = scale(lo, hi), span = 4 * step;
      const Y = (v) => PT + (1 - (v - y0) / span) * (VH - PT - PB);
      const X = (h) => (h * VW) / 24;
      const f1 = (n) => Math.round(n * 10) / 10;
      const ticks = [0, 1, 2, 3, 4].map((i) => y0 + i * step);
      const base = f1(Y(Math.max(y0, Math.min(0, y0 + span))));
      let line = '', fill = '', runStart = null;
      ore.forEach((v, h) => {
        if (v == null) { if (runStart != null) fill += `V${base}Z`; runStart = null; return; }
        const y = f1(Y(v));
        if (runStart == null) { runStart = h; line += `M${f1(X(h))} ${y}`; fill += `M${f1(X(h))} ${base}V${y}`; } else { line += `V${y}`; fill += `V${y}`; }
        line += `H${f1(X(h + 1))}`; fill += `H${f1(X(h + 1))}`;
      });
      if (runStart != null) fill += `V${base}Z`;
      const tOff = M.clamp(Y(thrO) / VH, 0, 1).toFixed(4);
      const grid = ticks.map((v) => `<line x1="0" x2="${VW}" y1="${f1(Y(v))}" y2="${f1(Y(v))}" class="gl"/>`).join('');
      const gid = 'sp' + (this._gid || (this._gid = Math.random().toString(36).slice(2, 8)));
      const svg = `<svg viewBox="0 0 ${VW} ${VH}" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="${gid}s" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${VH}"><stop offset="0" stop-color="${ORANGE}"/><stop offset="${tOff}" stop-color="${ORANGE}"/><stop offset="${tOff}" stop-color="${TEAL}"/><stop offset="1" stop-color="${TEAL}"/></linearGradient>
          <linearGradient id="${gid}f" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${VH}"><stop offset="0" stop-color="${ORANGE}" stop-opacity="0.28"/><stop offset="${tOff}" stop-color="${ORANGE}" stop-opacity="0.12"/><stop offset="${tOff}" stop-color="${TEAL}" stop-opacity="0.14"/><stop offset="1" stop-color="${TEAL}" stop-opacity="0"/></linearGradient>
        </defs>
        ${grid}
        ${has ? `<path class="fill" d="${fill}" fill="url(#${gid}f)"/>
        <path class="spot" d="${line}" stroke="url(#${gid}s)"/>
        ${showNp ? `<line class="np" x1="0" x2="${VW}" y1="${f1(Y(npO))}" y2="${f1(Y(npO))}"/>` : ''}` : ''}
      </svg>`;
      let marker = '';
      if (sel != null && ore[sel] != null) {
        const col = ore[sel] > thrO ? ORANGE : TEAL, top = (Y(ore[sel]) / VH) * 100, left = ((sel + 0.5) / 24) * 100;
        marker = `<span class="band" style="left:${((sel / 24) * 100).toFixed(3)}%"></span>
          <span class="halo" style="left:${left.toFixed(3)}%;top:${top.toFixed(2)}%;background:color-mix(in oklch, ${col} 30%, transparent)"></span>
          <span class="dot" style="left:${left.toFixed(3)}%;top:${top.toFixed(2)}%;background:${col}"></span>`;
      }
      const yax = ticks.map((v) => `<span style="top:${((Y(v) / VH) * 100).toFixed(2)}%">${M.nf(v, step % 1 ? 1 : 0)}</span>`).join('');
      const xax = [0, 4, 8, 12, 16, 20, 24].map((h) => `<span style="left:${((h / 24) * 100).toFixed(3)}%">${hh(h)}</span>`).join('');
      const seg = [['today', 'I dag', true], ['tomorrow', 'I morgen', hasM]];
      return `<div class="sp">
        <div class="hdr">
          <span class="ttl ell">Strømpriser</span>
          <div class="seg" role="tablist">${seg.map(([k, l, ok]) => {
            const on = (k === 'today') === isToday;
            return `<button class="sg ${on ? 'on' : ''}" role="tab" aria-selected="${on}" data-act="day" data-d="${k}" ${ok ? '' : 'disabled title="Kommer ca. 13:00"'}>${l}</button>`;
          }).join('')}</div>
        </div>
        <div class="srf">
          <div class="vr">
            <div class="vc" ${id ? `data-ent="${esc(id)}"` : ''}>
              <span class="lb">${esc(label)}</span>
              <span class="v num">${nf2(val)}<small> kr/kWh</small></span>
            </div>
            ${showNp ? `<div class="vc r" ${np.id ? `data-ent="${esc(np.id)}"` : ''}>
              <span class="lb">Norgespris</span>
              <span class="v num np">${nf2(np.v)}<small> kr/kWh</small></span>
            </div>` : ''}
          </div>
          <div class="lg"><span class="li"><i style="background:${TEAL}"></i>Nord Pool spot</span>${showNp ? `<span class="li"><i style="background:${PINK}"></i>Norgespris</span>` : ''}<span class="unit">øre/kWh</span></div>
          <div class="gr">
            <div class="ya num">${yax}</div>
            <div class="plot" role="img" aria-label="Spotpris per time ${isToday ? 'i dag' : 'i morgen'} i øre/kWh">${svg}${marker}
              ${st ? '' : `<button class="pick" data-act="customize" data-section="kort">${M.icon('mdi:plus', 18)}Velg entitet</button>`}</div>
          </div>
          <div class="xa num">${xax}</div>
        </div>
      </div>`;
    }
    onAction(name, el, ev) {
      if (name === 'day') { if (el.disabled) return; return this.setUI({ day: el.dataset.d, sel: null }); }
      return super.onAction(name, el, ev);
    }
    afterRender() {
      const p = this.shadowRoot.querySelector('.plot');
      if (!p || p.__sc) return;
      p.__sc = true;
      M.guardDrag(p, 'x'); // touch-action: pan-y + stopPropagation (Bubble Card swipe-to-close)
      let down = false;
      const pick = (e) => {
        const r = p.getBoundingClientRect();
        if (!r.width || !p.querySelector('path.spot')) return;
        const h = M.clamp(Math.floor(((e.clientX - r.left) / r.width) * 24), 0, 23);
        if (h !== this.ui.sel) { M.haptic('selection'); this.setUI({ sel: h }); }
      };
      const reset = () => { down = false; if (this.ui.sel != null) this.setUI({ sel: null }); };
      p.addEventListener('pointerdown', (e) => {
        if (e.button || (e.target.closest && e.target.closest('button'))) return;
        down = true;
        try { p.setPointerCapture(e.pointerId); } catch (x) { /* */ }
        pick(e);
      });
      p.addEventListener('pointermove', (e) => { if (down || e.pointerType === 'mouse') pick(e); });
      p.addEventListener('pointerup', reset);
      p.addEventListener('pointercancel', reset);
      p.addEventListener('pointerleave', reset);
    }
    get styles() {
      return `
        .sp{display:flex;flex-direction:column;gap:12px}
        .hdr{display:flex;align-items:center;justify-content:space-between;gap:10px;min-width:0}
        .ttl{min-width:0;font-size:18px;font-weight:500}
        .seg{display:flex;gap:2px;padding:4px;border-radius:24px;background:#303030;flex:none}
        .sg{height:30px;padding:0 20px;border-radius:15px;font-size:14px;font-weight:400;white-space:nowrap;color:#c9c7c2;background:transparent;transition:background .25s,color .25s,opacity .25s}
        .sg.on{background:linear-gradient(135deg, oklch(0.84 0.1 350), oklch(0.92 0.04 20));color:#5a3a48}
        .sg:disabled{opacity:.4;cursor:default}
        .srf{display:flex;flex-direction:column;gap:12px;padding:18px 16px;border-radius:28px;background:#303030}
        .vr{display:flex;justify-content:space-between;align-items:flex-end;gap:12px}
        .vc{display:flex;flex-direction:column;gap:4px;min-width:0}
        .vc.r{align-items:flex-end;text-align:right}
        .lb{font-size:12px;color:#8e8d89;white-space:nowrap}
        .v{font-size:28px;font-weight:300;letter-spacing:-0.025em;line-height:1.05;white-space:nowrap}
        .v small{font-size:13px;letter-spacing:0;color:#8e8d89}
        .v.np{color:${PINK}}
        .lg{display:flex;align-items:center;gap:14px;padding-left:26px;font-size:11px;color:#8e8d89;white-space:nowrap}
        .li{display:inline-flex;align-items:center;gap:6px}
        .li i{display:block;width:14px;height:2.5px;border-radius:2px}
        .unit{margin-left:auto;color:#6d6c69}
        .gr{display:flex;gap:6px;height:150px}
        .ya{position:relative;flex:none;width:20px;font-size:9px;color:#6d6c69}
        .ya span{position:absolute;right:0;transform:translateY(-50%);line-height:1;white-space:nowrap}
        .plot{position:relative;flex:1;min-width:0;height:150px;cursor:crosshair;touch-action:pan-y;user-select:none;-webkit-user-select:none}
        .plot svg{position:absolute;inset:0;width:100%;height:100%;display:block;overflow:visible}
        .plot svg *{vector-effect:non-scaling-stroke}
        .gl{stroke:rgba(255,255,255,0.07);stroke-width:1}
        .spot{fill:none;stroke-width:2.5;stroke-linejoin:round;stroke-linecap:round}
        .np{stroke:${PINK};stroke-width:2;stroke-dasharray:5 4}
        .band{position:absolute;top:0;bottom:0;width:calc(100% / 24);border-radius:4px;background:rgba(255,255,255,0.12);pointer-events:none;transition:left .15s}
        .halo,.dot{position:absolute;border-radius:50%;transform:translate(-50%,-50%);pointer-events:none;transition:left .15s,top .15s,background .15s}
        .halo{width:34px;height:34px}
        .dot{width:14px;height:14px;box-shadow:0 0 0 3px #303030}
        .pick{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%)}
        .xa{position:relative;height:11px;margin-left:26px;font-size:9px;color:#6d6c69}
        .xa span{position:absolute;top:0;transform:translateX(-50%);line-height:11px}
        .xa span:first-child{transform:none}
        .xa span:last-child{transform:translateX(-100%)}
      `;
    }
  }
  M.define('msh-strompris-card', Strompris, 'MSH Hjem · strømpriser', 'Spotpris nå og per time i dag / i morgen som trinnlinje i øre/kWh, med Norgespris og terskel. Dra på grafen for å se en time.');
})();
