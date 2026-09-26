/* msh-strompris-card · Hjem, strømpriskortet. Kilde: strøm-dataene i Hjem v2.dc.html (SPOT/TMR, price(), priceHead,
 * priceBars, priceDays, strøm-sliden «Strøm nå · Billigst kl. …») + oppsettet i ki-strompris-card (ki-cards, «Strømpriser»):
 * nåpris, søyler per time for i dag / i morgen med dag-bytter, billigste time og scrub (dra for å se en time).
 * Autokonfig (entiteter.md «Strøm»): pris-sensor fra plattform nordpool / tibber / energi_data_service (M.priceSensor –
 * samme sensor som prosa-boblen «Strømmen koster …»), timespriser fra attributtene raw_today/raw_tomorrow ({start,end,value})
 * eller today/tomorrow (tall-lister). Effekt: sensor.hele_huset_effekt (KI Rom). Overstyr: overrides.price / overrides.watt.
 * Kortet vises alltid: mangler data → «–» og tomme søyler.
 */
(function () {
  const M = window.MSH, esc = M.esc, C = M.C;
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
      const list = [a[rk], a[pk], a[tk]].find((x) => Array.isArray(x) && x.length);
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

  /* ------------------------------------------------------------ kort */
  class Strompris extends M.Card {
    static get cardName() { return 'Hjem · strømpris'; }
    static get defaults() { return { title: 'Strømpris', popup_hash: '#strom', price_high: 1.5, price_mid: 1.1, show_watt: true }; }
    static get schema() {
      return [
        { type: 'section', id: 'kort', label: 'Kort', icon: 'mdi:flash', open: true, fields: [
          { type: 'text', name: 'title', label: 'Overskrift', placeholder: 'Strømpris' },
          { type: 'hash', name: 'popup_hash', label: 'Popup-hash (trykk på prisen)', placeholder: '#strom' },
          { type: 'select', name: 'day', label: 'Dag som vises først', options: [['today', 'I dag'], ['tomorrow', 'I morgen']], default: 'today' },
          { type: 'boolean', name: 'show_watt', label: 'Vis effekt nå (W)', default: true },
          { type: 'number', name: 'price_high', label: 'Rød søyle over (kr/kWh)', step: 0.1, placeholder: '1.5' },
          { type: 'number', name: 'price_mid', label: 'Gul søyle over (kr/kWh)', step: 0.1, placeholder: '1.1' },
        ] },
        { type: 'overrides', label: 'Bytt entiteter', fields: [
          { name: 'price', label: 'Strømpris (kr/kWh, med today/tomorrow eller raw_today/raw_tomorrow)', domain: 'sensor', auto: (h) => M.priceSensor(h, {}) },
          { name: 'watt', label: 'Effekt nå (W)', domain: 'sensor', device_class: 'power', auto: (h) => M.kiRomId(h, null, 'effekt') },
        ] },
      ];
    }
    get cardSize() { return 4; }
    _lvl(p) {
      const c = this.config;
      return p > (Number(c.price_high) || 1.5) ? C.red : p > (Number(c.price_mid) || 1.1) ? C.yellow : C.green;
    }
    render() {
      const c = this.config, hass = this.hass, ui = this.ui;
      const id = M.priceSensor(hass, c), st = this.s(id);
      const wattId = M.pick(c, 'watt', M.kiRomId(hass, null, 'effekt')), watt = c.show_watt !== false ? this.n(wattId) : null;
      const all = st ? M.priceSeries(hass, id) : Array(48).fill(null);
      const day = ui.day || (c.day === 'tomorrow' ? 'tomorrow' : 'today'), isToday = day === 'today';
      const ser = isToday ? all.slice(0, 24) : all.slice(24);
      const nowH = new Date().getHours();
      let pNow = M.priceNow(hass, id);
      if (pNow == null && all[nowH] != null) pNow = all[nowH];
      const has = ser.some((v) => v != null);
      const future = ser.map((p, h) => [p, h]).filter(([p, h]) => p != null && (!isToday || h >= nowH));
      const cheap = future.length ? future.reduce((m, x) => (x[0] < m[0] ? x : m)) : null;
      const maxP = Math.max(0.01, ...ser.filter((v) => v != null));
      const sel = ui.sel != null ? ui.sel : null;
      const cheapTxt = cheap ? `Billigst kl. ${hh(cheap[1])} · ${nf2(cheap[0])} kr` : '';
      let head;
      if (sel != null) head = { label: `${isToday ? 'I dag' : 'I morgen'} kl. ${hh(sel)}–${hh((sel + 1) % 24)}`, v: nf2(ser[sel]), meta: isToday && sel < nowH ? 'Tidligere i dag' : cheapTxt };
      else if (isToday) head = { label: 'Nå', v: nf2(pNow), meta: cheapTxt || (st ? '' : 'Fant ingen strømpris-sensor') };
      else head = { label: 'Snitt i morgen', v: has ? nf2(ser.filter((v) => v != null).reduce((x, y) => x + y, 0) / ser.filter((v) => v != null).length) : '–', meta: has ? cheapTxt : 'Kommer ca. kl. 13' };
      const bars = ser.map((p, h) => {
        const past = isToday && h < nowH, now = isToday && h === nowH, on = sel === h;
        if (p == null) return `<span class="b" data-key="b${h}"><i class="e"></i></span>`;
        const hgt = Math.max(4, (p / maxP) * 100);
        return `<span class="b" data-key="b${h}"><i style="height:${hgt.toFixed(1)}%;background:${on || (now && sel == null) ? 'var(--white,#fafafa)' : this._lvl(p)};opacity:${past && !on ? 0.3 : 1}"></i></span>`;
      }).join('');
      const seg = [['today', 'I dag'], ['tomorrow', 'I morgen']];
      const di = isToday ? 0 : 1;
      return `<section class="sp">
        <div class="top">
          <span class="ttl ell">${esc(c.title || 'Strømpris')}</span>
          ${watt != null ? `<span class="w num" data-ent="${esc(wattId)}">${M.nf(watt, 0)} W</span>` : ''}
          <div class="seg"><span class="ind" style="left:calc(3px + ${di} * (100% - 6px) / 2)"></span>${seg.map(([k, l], i) => `<button class="sg ${i === di ? 'on' : ''}" data-act="day" data-d="${k}" data-haptic="selection">${l}</button>`).join('')}</div>
        </div>
        <button class="hd" data-act="open" ${id ? `data-ent="${esc(id)}"` : ''}>
          <span class="lb">${esc(head.label)}</span>
          <span class="v num">${esc(head.v)}<small> kr/kWh</small></span>
          <span class="meta ell">${esc(head.meta || '')}</span>
        </button>
        ${st ? '' : `<button class="pick press" data-act="customize" data-section="overrides">${M.icon('mdi:plus', 18)}Velg entitet</button>`}
        <div class="bars" role="img" aria-label="Strømpris per time ${isToday ? 'i dag' : 'i morgen'}">${bars}
          ${sel != null ? `<span class="band" style="left:${(sel / 24) * 100}%"></span>` : ''}</div>
        <div class="xa num"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div>
      </section>`;
    }
    onAction(name, el, ev) {
      if (name === 'day') return this.setUI({ day: el.dataset.d, sel: null });
      if (name === 'open') { if (this._dragged) { this._dragged = false; return; } return M.openPopup(this.config.popup_hash || '#strom'); }
      return super.onAction(name, el, ev);
    }
    afterRender() {
      const b = this.shadowRoot.querySelector('.bars');
      if (!b || b.__b) return;
      b.__b = true;
      let t = null;
      M.drag(b, {
        axis: 'x',
        onStart: () => { clearTimeout(t); this._busy = false; },
        onMove: (f) => { const i = M.clamp(Math.floor(f * 24), 0, 23); if (i !== this.ui.sel) this.setUI({ sel: i }); },
        onEnd: () => { clearTimeout(t); t = setTimeout(() => this.setUI({ sel: null }), 2500); },
      });
    }
    get styles() {
      return `
        .sp{display:flex;flex-direction:column;gap:10px;padding:18px 18px 14px;border-radius:28px;background:var(--gray100,#2f2f2f);box-shadow:inset 0 0 0 1px rgba(255,255,255,0.04)}
        .top{display:flex;align-items:center;gap:10px;min-width:0}
        .ttl{flex:1;min-width:0;font-size:15px;font-weight:500}
        .w{font-size:13px;color:var(--gray600,#7f7f7f);white-space:nowrap}
        .seg{position:relative;display:grid;grid-template-columns:1fr 1fr;padding:3px;border-radius:12px;background:var(--gray000,#232323);flex:none}
        .ind{position:absolute;top:3px;bottom:3px;width:calc((100% - 6px) / 2);border-radius:9px;background:${C.accent};transition:left .45s cubic-bezier(.34,1.4,.64,1)}
        .sg{position:relative;z-index:1;height:30px;padding:0 12px;border-radius:9px;font-size:12px;font-weight:500;white-space:nowrap;color:var(--gray700,#979797);transition:color .25s}
        .sg.on{color:var(--gray100,#2f2f2f)}
        .hd{display:flex;flex-direction:column;align-items:flex-start;gap:3px;text-align:left;min-width:0}
        .lb{font-size:12px;color:var(--gray600,#7f7f7f);white-space:nowrap}
        .v{font-size:34px;font-weight:300;letter-spacing:-0.02em;line-height:1;white-space:nowrap}
        .v small{font-size:13px;letter-spacing:0;color:var(--gray600,#7f7f7f)}
        .meta{font-size:12px;color:var(--gray700,#979797);max-width:100%;min-height:15px}
        .pick{align-self:flex-start}
        .bars{position:relative;display:grid;grid-template-columns:repeat(24,minmax(0,1fr));gap:3px;align-items:end;height:96px;padding-top:6px;cursor:crosshair;touch-action:none}
        .b{display:flex;align-items:flex-end;height:100%;min-width:0}
        .b i{display:block;width:100%;border-radius:4px;transition:background .2s,height .3s}
        .b i.e{height:8%;background:var(--gray300,#404040)}
        .band{position:absolute;top:0;bottom:0;width:calc(100% / 24);border-radius:4px;background:rgba(255,255,255,0.08);pointer-events:none;transition:left .12s}
        .xa{display:flex;justify-content:space-between;font-size:10px;color:var(--gray500,#696969)}
      `;
    }
  }
  M.define('msh-strompris-card', Strompris, 'MSH Hjem · strømpris', 'Strømpris nå, søyler per time i dag / i morgen, billigste time og dra for å se en time. Trykk åpner #strom.');
})();
