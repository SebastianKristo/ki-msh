/* msh-planter-card · Planter-popup #planter (Fiks 60.3). Fasit: «design/Planter.dc.html». ÉTT kort i popupen – Bubble Card
 * eier headeren (ikon potted_plant, «Planter», lukk), så designets egen header tegnes ikke.
 * Rekkefølge (som designet): status (prikk + «N trenger vann» / «Alt i orden») · overskrift («Vann i dag» / «Neste vanning
 * i morgen» / «Neste vanning om N dager») · undertekst («Vekstsesong · 11,8 t dagslys · 3 planter») → faner Enkel · Avansert
 * (hold 400 ms + dra = MSH.tabRow, tab_order, start_tab) → ett kort per plante: ikon-sirkel (grønn / gul når den trenger
 * vann), navn + latinsk navn, forfall («Trenger vann» / «Fuktig 72 %» / «Om 3 dager») + «Vannet for 4 d siden», jordfukt
 * med målbånd (lo–hi) og stolpe, Avansert: Lys · Temp · Næring, knapp «Merk som vannet» (blå når planten trenger vann).
 * Autokonfig (ingen gjettede ID-er – «–» når noe mangler):
 *   1. KI Planter: binary_sensor.<plante>_trenger_vann (attributes integrasjon: ki_planter, type: plante, navn, ikon, sted)
 *   2. plant.* (HAs plant-integrasjon / «Plant Monitor»)
 *   3. enheter med en jordfukt-sensor (device_class moisture) som ikke allerede er med (f.eks. Mi Flora)
 *   Søsken-entiteter fra samme enhet (entitetsregisteret), ellers samme prefiks: jordfukt (moisture), lys (illuminance),
 *   temperatur, næring (conductivity / ec), sist vannet (timestamp / input_datetime), intervall (dager), min/maks jordfukt,
 *   knappen «vannet» (button / input_button; ellers input_datetime → nå).
 * Config: plants_cfg.<nøkkel>.{ name, latin, moisture, lux, temp, ec, last, every, lo, hi, needs, water } overstyrer
 *   (entitet / tall), exclude [nøkkel] fjerner en plante, include.planter [entity_id] legger til, tab_order, start_tab.
 */
(function () {
  const M = window.MSH, esc = M.esc, C = M.C;
  const HASH = '#planter';
  const GREEN = C.green, AMBER = C.orange, BLUE = C.blue;
  const TV = (k, n) => (M.tabH ? M.tabH.v(k, n) : n + 'px');
  const TABS = [['enkel', 'Enkel'], ['avansert', 'Avansert']];
  const tabOrder = (c) => (M.edOrder ? M.edOrder(TABS.map((t) => t[0]), c.tab_order) : TABS.map((t) => t[0]));
  const tone = (col, a) => `color-mix(in srgb, ${col} ${Math.round(a * 100)}%, transparent)`;
  const real = (h, id) => (id && id !== 'none' && h.states[id] ? id : null);
  const lc = (h, id) => (id + ' ' + String((h.states[id] && h.states[id].attributes.friendly_name) || '')).toLowerCase();
  const reg = (h, id) => (h.entities && h.entities[id]) || null;
  const devOf = (h, id) => { const r = reg(h, id); return r && r.device_id ? r.device_id : null; };
  const DAY = 86400000;
  const MM_RX = /_min(_|$)|_(max|maks)(_|$)|batter/; // min/maks-grenser og batteri (ikke «illuminance»)

  // Alle entiteter på samme enhet (registeret), ellers samme objekt-prefiks
  function siblings(h, id, base) {
    const dev = devOf(h, id);
    if (dev && h.entities) { const L = Object.keys(h.entities).filter((x) => h.entities[x].device_id === dev && h.states[x]); if (L.length > 1) return L; }
    return Object.keys(h.states).filter((x) => x.split('.')[1].indexOf(base) === 0);
  }
  const findIn = (h, L, doms, dc, rx, not) => L.find((x) => doms.includes(x.split('.')[0]) && (!not || !not.test(x)) && ((dc && dc.includes((h.states[x].attributes || {}).device_class)) || (rx && rx.test(lc(h, x))))) || null;

  // Alle planter: [{ key, src, name, icon, latin, ids { moisture, lux, temp, ec, last, every, lo, hi, needs, water }, plant }]
  M.planterAuto = function (h) {
    if (!h || !h.states) return [];
    const out = [], seenDev = new Set(), seen = new Set();
    const push = (key, src, name, icon, L, extra) => {
      if (seen.has(key)) return; seen.add(key);
      L.forEach((x) => { const d = devOf(h, x); if (d) seenDev.add(d); });
      const sens = (dc, rx, not) => findIn(h, L, ['sensor'], dc, rx, not);
      out.push({ key, src, name, icon, latin: null, plant: null, ...extra, ids: {
        moisture: sens(['moisture'], /jordfukt|soil|moist/, MM_RX),
        lux: sens(['illuminance'], /illumin|lux|\blys\b/, /_min(_|$)|_(max|maks)(_|$)|dli/),
        temp: sens(['temperature'], /temp/, MM_RX),
        ec: sens(['conductivity'], /conductiv|n[æa]ring|\bec\b|fertil/, MM_RX),
        last: findIn(h, L, ['sensor', 'input_datetime', 'datetime'], ['timestamp'], /sist.?vann|last.?water|vannet/) || null,
        every: findIn(h, L, ['number', 'input_number', 'sensor'], null, /intervall|interval|vann.?hver|dager|days/) || null,
        lo: findIn(h, L, ['number', 'input_number'], null, /min.*(fukt|moist)|(fukt|moist).*min/) || null,
        hi: findIn(h, L, ['number', 'input_number'], null, /(max|maks).*(fukt|moist)|(fukt|moist).*(max|maks)/) || null,
        needs: findIn(h, L, ['binary_sensor'], null, /trenger.?vann|needs?.?water|dry|t[øo]rr/) || null,
        water: findIn(h, L, ['button', 'input_button'], null, /vannet|watered|vann/, /alle/) || null,
      } });
    };
    // 1 · KI Planter
    Object.keys(h.states).filter((id) => id.indexOf('binary_sensor.') === 0).forEach((id) => {
      const a = h.states[id].attributes || {}, r = reg(h, id);
      if (!((a.integrasjon === 'ki_planter' || (r && r.platform === 'ki_planter')) && (a.type === 'plante' || /_trenger_vann$/.test(id)) && a.type !== 'sted')) return;
      const base = id.slice(14).replace(/_trenger_vann$/, '');
      push(id, 'ki_planter', a.navn || String(a.friendly_name || base).replace(/\s*trenger vann$/i, ''), a.ikon || null, siblings(h, id, base), { latin: a.latin || a.art || a.species || null });
    });
    // 2 · plant.*
    M.all(h, 'plant').forEach((id) => {
      const a = h.states[id].attributes || {}, base = id.slice(6);
      if (devOf(h, id) && seenDev.has(devOf(h, id))) return;
      push(id, 'plant', a.friendly_name || base, a.icon || null, siblings(h, id, base), { plant: id, latin: a.species || a.scientific_name || a.latin || null });
    });
    // 3 · enheter med jordfukt-sensor
    M.all(h, 'sensor', (s) => (s.attributes || {}).device_class === 'moisture').forEach((id) => {
      const dev = devOf(h, id);
      if (!dev || seenDev.has(dev)) return;
      const D = h.devices && h.devices[dev], nm = (D && (D.name_by_user || D.name)) || M.name(h, id);
      push(id, 'sensor', nm, null, siblings(h, id, id.slice(7)), {});
    });
    return out;
  };
  // Plantene etter config (exclude / include.planter / plants_cfg)
  function plants(h, c) {
    const A = M.planterAuto(h), ex = new Set(c.exclude || []);
    const L = A.filter((p) => !ex.has(p.key));
    ((c.include || {}).planter || []).forEach((id) => { if (!L.some((p) => p.key === id) && h.states[id]) { const B = M.planterAuto({ ...h, states: { [id]: h.states[id] } }); L.push(B[0] || { key: id, src: 'own', name: M.name(h, id), ids: { moisture: id.indexOf('sensor.') === 0 ? id : null } }); } });
    return L.map((p) => {
      const o = ((c.plants_cfg || {})[M.slug(p.key)]) || {}, ids = { ...p.ids };
      Object.keys(ids).forEach((k) => { if (o[k] === 'none') ids[k] = null; else if (typeof o[k] === 'string' && real(h, o[k])) ids[k] = o[k]; });
      return { ...p, cfgKey: M.slug(p.key), o, ids, name: o.name || p.name, latin: o.latin || p.latin };
    });
  }
  const num = (h, id) => (id && h.states[id] && M.isNum(h.states[id].state) ? Number(h.states[id].state) : null);
  const tsOf = (h, id) => {
    const s = id && h.states[id]; if (!s || M.unavailable(s)) return null;
    if (id.indexOf('input_datetime.') === 0 && s.attributes.timestamp != null) return Number(s.attributes.timestamp) * 1000;
    const t = Date.parse(s.state); return isNaN(t) ? null : t;
  };
  // Verdiene for én plante
  function info(h, p) {
    const pa = (p.plant && h.states[p.plant] && h.states[p.plant].attributes) || {};
    const moist = num(h, p.ids.moisture) ?? (M.isNum(pa.moisture) ? Number(pa.moisture) : null);
    const lo = M.isNum(p.o.lo) ? Number(p.o.lo) : num(h, p.ids.lo) ?? (M.isNum(pa.min_moisture) ? Number(pa.min_moisture) : null);
    const hi = M.isNum(p.o.hi) ? Number(p.o.hi) : num(h, p.ids.hi) ?? (M.isNum(pa.max_moisture) ? Number(pa.max_moisture) : null);
    const every = M.isNum(p.o.every) ? Number(p.o.every) : num(h, p.ids.every);
    const last = tsOf(h, p.ids.last);
    const days = last != null ? Math.max(0, Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(last).setHours(0, 0, 0, 0)) / DAY)) : null;
    const left = every != null && days != null ? Math.round(every - days) : null;
    const nS = p.ids.needs && h.states[p.ids.needs];
    const dry = moist != null && lo != null && moist < lo, wet = moist != null && hi != null && moist > hi;
    const need = (nS && nS.state === 'on') || dry || (left != null && left <= 0);
    const val = (id, attr, unit, d) => { const v = num(h, id) ?? (M.isNum(pa[attr]) ? Number(pa[attr]) : null); return v == null ? '–' : `${M.nf(v, d)} ${unit}`.replace(' °', '°'); };
    return { moist, lo, hi, every, last, days, left, need, dry, wet,
      lux: val(p.ids.lux, 'brightness', 'lx', 0), temp: val(p.ids.temp, 'temperature', '°', 1), ec: val(p.ids.ec, 'conductivity', 'µS', 0) };
  }
  // Dagslys (t) fra sun.sun: neste solnedgang − neste soloppgang (mod 24 t)
  function daylight(h) {
    const a = (h.states['sun.sun'] || {}).attributes || {}, r = Date.parse(a.next_rising), s = Date.parse(a.next_setting);
    if (isNaN(r) || isNaN(s)) return null;
    let d = (s - r) / 3600000; d = ((d % 24) + 24) % 24; return d;
  }

  class Planter extends M.Card {
    static get cardName() { return 'Planter'; }
    static get defaults() { return {}; }
    static get uiPersist() { return ['tab']; }
    static getStubConfig() { return { card_id: M.uid() }; }
    static get startTabSpec() { return { tabs: (card) => tabOrder(card.config) }; }
    static get schema() {
      return (h, c) => {
        const L = h ? plants(h, c || {}) : [];
        return [
          ...(M.startTab ? [M.startTab.field({ items: (hh, cc) => tabOrder(cc || {}).map((k) => ({ key: k, label: TABS.find((t) => t[0] === k)[1] })) })] : []),
          { type: 'lists', label: 'Planter', lists: (hh) => [{ key: 'planter', label: 'Planter (KI Planter, plant.* eller jordfukt-sensor)', ids: M.planterAuto(hh).map((p) => p.key), domains: ['binary_sensor', 'plant', 'sensor'] }] },
          ...L.map((p) => {
            const P = `plants_cfg.${p.cfgKey}`, A = p.ids;
            const ent = (k, label, doms) => ({ type: 'entity', name: `${P}.${k}`, label, domains: doms, auto: () => A[k] });
            return { type: 'section', id: 'pl-' + p.cfgKey, label: 'Plante · ' + p.name, icon: 'mdi:sprout', fields: [
              { type: 'text', name: `${P}.name`, label: 'Navn', placeholder: p.name },
              { type: 'text', name: `${P}.latin`, label: 'Latinsk navn', placeholder: p.latin || '' },
              ent('moisture', 'Jordfukt', ['sensor']), ent('needs', 'Trenger vann', ['binary_sensor']),
              ent('last', 'Sist vannet', ['sensor', 'input_datetime', 'datetime']), ent('water', 'Merk som vannet (knapp)', ['button', 'input_button', 'script']),
              { type: 'number', name: `${P}.every`, label: 'Vann hver (dager)', min: 1, max: 60, placeholder: A.every ? M.name(h, A.every) : '–' },
              { type: 'number', name: `${P}.lo`, label: 'Jordfukt min (%)', min: 0, max: 100 },
              { type: 'number', name: `${P}.hi`, label: 'Jordfukt maks (%)', min: 0, max: 100 },
              ent('lux', 'Lys', ['sensor']), ent('temp', 'Temperatur', ['sensor']), ent('ec', 'Næring', ['sensor']),
            ] };
          }),
          { type: 'info', label: 'Plantene finnes selv fra KI Planter (binary_sensor.<plante>_trenger_vann), plant.* og enheter med jordfukt-sensor. Måleverdiene hentes fra samme enhet.' },
        ];
      };
    }
    get cardSize() { return 8; }
    get tab() { const V = tabOrder(this.config), t = this.ui.tab || this.config.start_tab; return V.includes(t) ? t : V[0]; }
    render() {
      const h = this.hass, c = this.config;
      const L = plants(h, c);
      L.forEach((p) => { Object.values(p.ids).forEach((id) => id && this.s(id)); if (p.plant) this.s(p.plant); });
      this.s('sun.sun');
      const I = L.map((p) => info(h, p));
      const nNeed = I.filter((x) => x.need).length;
      const lefts = I.map((x) => x.left).filter((x) => x != null);
      const next = lefts.length ? Math.min(...lefts) : null;
      const col = nNeed ? AMBER : GREEN;
      const headline = !L.length ? 'Ingen planter funnet' : nNeed || (next != null && next <= 0) ? 'Vann i dag' : next === 1 ? 'Neste vanning i morgen' : next != null ? `Neste vanning om ${next} dager` : 'Alt i orden';
      const mo = new Date().getMonth(), dl = daylight(h);
      const sub = [mo >= 2 && mo <= 8 ? 'Vekstsesong' : 'Hvilesesong', dl != null ? `${M.nf(dl, 1)} t dagslys` : null, `${L.length} ${L.length === 1 ? 'plante' : 'planter'}`].filter(Boolean).join(' · ');
      const t = this.tab;
      const tabs = `<div class="tabs" role="tablist" data-glass-drag="x"${M.tabH && M.tabH.style(c) ? ` style="${M.tabH.style(c)}"` : ''}>${tabOrder(c).map((k) => `<button class="tb ${k === t ? 'on' : ''}" role="tab" aria-selected="${k === t}" data-act="tab" data-v="${k}" data-haptic="selection">${esc(TABS.find((x) => x[0] === k)[1])}</button>`).join('')}</div>`;
      const head = `<section class="hd" data-key="hd"><div class="st"><span class="dot" style="background:${col};box-shadow:0 0 10px ${col}"></span>${!L.length ? '–' : nNeed ? `${nNeed} trenger vann` : 'Alt i orden'}</div><div class="hl">${esc(headline)}</div><div class="sub">${esc(sub)}</div></section>`;
      const cards = L.length ? L.map((p, i) => this._plant(p, I[i], t === 'avansert')).join('') : M.emptyState('Fant ingen planter (KI Planter, plant.* eller jordfukt-sensor)', 'planter');
      return `<div class="wrap">${head}${tabs}<section class="list" data-key="list">${cards}</section></div>`;
    }
    _plant(p, x, adv) {
      const due = x.need ? 'Trenger vann' : x.wet ? `Fuktig ${M.nf(x.moist)} %` : x.left != null ? (x.left === 1 ? 'Om 1 dag' : `Om ${x.left} dager`) : '–';
      const dueCol = x.need ? `var(--ki-orange-text, ${AMBER})` : x.wet ? `var(--ki-blue-text, ${BLUE})` : 'var(--ki-text, #f2f1ee)';
      const last = x.days == null ? '' : x.days === 0 ? 'Vannet i dag' : `Vannet for ${x.days} d siden`;
      const ic = x.need ? AMBER : GREEN;
      const band = x.lo != null && x.hi != null ? `<span class="band" style="left:${M.clamp(x.lo, 0, 100)}%;width:${M.clamp(x.hi - x.lo, 0, 100)}%"></span>` : '';
      const bar = x.moist != null ? `<span class="bar" style="width:${M.clamp(x.moist, 0, 100)}%;background:${x.need ? AMBER : x.wet ? BLUE : GREEN}"></span>` : '';
      const range = x.lo != null && x.hi != null ? `${M.nf(x.lo)}–${M.nf(x.hi)} %` : '–';
      const canWater = !!(p.ids.water || (p.ids.last && /^(input_datetime|datetime)\./.test(p.ids.last)));
      const icon = p.icon && String(p.icon).indexOf(':') > 0 ? p.icon : 'mdi:sprout';
      return `<div class="pc" data-key="p-${esc(p.cfgKey)}">
        <div class="top"><span class="pi" style="background:${tone(ic, 0.16)};color:${ic}">${M.icon(icon, 24)}</span>
          <div class="nm"><span class="n" data-noi18n>${esc(p.name)}</span>${p.latin ? `<span class="lat" data-noi18n>${esc(p.latin)}</span>` : ''}</div>
          <div class="due"><span class="dv" style="color:${dueCol}">${esc(due)}</span>${last ? `<span class="dl">${esc(last)}</span>` : ''}</div></div>
        <div class="mo"><div class="ml"><span>Jordfukt</span><span class="num">${x.moist != null ? M.nf(x.moist) : '–'} % · mål ${range}</span></div>
          <div class="trk"${p.ids.moisture ? ` data-ent="${esc(p.ids.moisture)}"` : ''}>${band}${bar}</div></div>
        ${adv ? `<div class="mx">${[['mdi:white-balance-sunny', kiT('Lys', 'Light'), x.lux, p.ids.lux], ['mdi:thermometer', 'Temp', x.temp, p.ids.temp], ['mdi:flask-outline', 'Næring', x.ec, p.ids.ec]].map(([i, l, v, id]) => `<div class="mc"${id ? ` data-ent="${esc(id)}"` : ''}><span class="mk">${M.icon(i, 14)}${l}</span><span class="mv num">${esc(v)}</span></div>`).join('')}</div>` : ''}
        <button class="wb press${x.need ? ' need' : ''}" ${canWater ? `data-act="water" data-k="${esc(p.key)}" data-haptic="success"` : 'data-act="customize" data-section="pl-' + esc(p.cfgKey) + '" data-haptic="light"'}>${M.icon('mdi:water', 18)}${x.days === 0 ? 'Vannet i dag' : 'Merk som vannet'}</button>
      </div>`;
    }
    onAction(name, el, ev) {
      const d = el.dataset, h = this.hass;
      if (name === 'tab') return this.setUI({ tab: d.v });
      if (name === 'water') {
        const p = plants(h, this.config).find((x) => x.key === d.k);
        if (!p) return undefined;
        const w = p.ids.water, l = p.ids.last;
        if (w) { const dom = w.split('.')[0]; M.call(h, dom, dom === 'script' ? 'turn_on' : 'press', { entity_id: w }); }
        else if (l && /^(input_datetime|datetime)\./.test(l)) {
          const now = new Date(), pad = (n) => String(n).padStart(2, '0');
          const ds = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`, tm = `${pad(now.getHours())}:${pad(now.getMinutes())}:00`;
          if (l.indexOf('datetime.') === 0) M.call(h, 'datetime', 'set_value', { entity_id: l, datetime: `${ds} ${tm}` });
          else M.call(h, 'input_datetime', 'set_datetime', { entity_id: l, datetime: `${ds} ${tm}` });
        }
        M.toast(kiT(`${p.name} er merket som vannet`, `${p.name} marked as watered`));
        return undefined;
      }
      return super.onAction(name, el, ev);
    }
    afterRender() {
      const R = this.shadowRoot;
      if (M.tabRow) M.tabRow(this, R.querySelector('.tabs[role="tablist"]'), { active: () => this.tab, order: () => tabOrder(this.config), field: 'tab_order' });
    }
    get styles() {
      return `${PLANT_CSS}
        .tabs{display:grid;grid-template-columns:1fr 1fr;gap:2px;padding:4px;border-radius:calc(${TV('th', 40)} / 2 + 4px);background:var(--ki-surface-3, #303030);position:relative;touch-action:pan-y}
        .tb{min-width:0;height:${TV('th', 40)};padding:0 ${TV('tp', 8)};border-radius:16px;font-size:${TV('tf', 13)};font-weight:500;white-space:nowrap;color:var(--ki-text-2, #a9a7a2)}
        .tb.on{background:${C.accent};color:var(--ki-on-accent, #2a1720)}
        .list{display:flex;flex-direction:column;gap:var(--msh-gap,8px)}
        .pc{display:flex;flex-direction:column;gap:14px;padding:16px;border-radius:24px;background:var(--ki-surface, #303030)}
        .top{display:flex;align-items:center;gap:12px}
        .pi{width:44px;height:44px;border-radius:22px;flex:none;display:grid;place-items:center}
        .nm{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
        .n{font-size:15px;font-weight:500;overflow-wrap:anywhere}
        .lat{font-size:12px;color:var(--ki-text-mid, #8e8d89);font-style:italic}
        .due{display:flex;flex-direction:column;align-items:flex-end;gap:2px;flex:none}
        .dv{font-size:13px;font-weight:600;white-space:nowrap}
        .dl{font-size:11px;color:var(--ki-text-lo, #6d6c69);white-space:nowrap}
        .mo{display:flex;flex-direction:column;gap:6px}
        .ml{display:flex;justify-content:space-between;gap:8px;font-size:12px;color:var(--ki-text-mid, #8e8d89)}
        .trk{position:relative;height:8px;border-radius:4px;background:var(--ki-surface-3, #3c3c3c)}
        .band{position:absolute;top:0;bottom:0;border-radius:4px;background:${tone(GREEN, 0.18)}}
        .bar{position:absolute;top:0;bottom:0;left:0;border-radius:4px;transition:width .6s}
        .mx{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
        .mc{display:flex;flex-direction:column;gap:3px;padding:10px 12px;border-radius:14px;background:var(--ki-surface-2, #252525);min-width:0}
        .mk{display:flex;align-items:center;gap:4px;font-size:11px;color:var(--ki-text-mid, #8e8d89);white-space:nowrap}
        .mv{font-size:14px;font-weight:500;white-space:nowrap}
        .wb{height:44px;border-radius:22px;display:flex;align-items:center;justify-content:center;gap:6px;font-size:13px;font-weight:600;background:var(--ki-surface-2, #3a3a3a);color:var(--ki-text-1, #c9c7c2)}
        .wb.need{background:color-mix(in srgb, ${BLUE} 90%, transparent);color:var(--ki-on-accent, #252525)}
      `;
    }
  }
  // Felles for Planter / Søvn / 3D-printer: rot uten egen bakgrunn (popupens #282828), statuslinje, overskrift, undertekst
  const PLANT_CSS = `
    :host{display:block;width:100%}
    ha-card{background:none;box-shadow:none;border:none}
    .wrap{display:flex;flex-direction:column;gap:22px;color:var(--ki-text, #f2f1ee)}
    button{font:inherit;color:inherit;border:0;background:none;padding:0;cursor:pointer;-webkit-tap-highlight-color:transparent}
    .press:active{transform:scale(.97)}
    .num{font-variant-numeric:tabular-nums}
    .hd{display:flex;flex-direction:column;gap:6px;padding:0 4px}
    .st{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:500;color:var(--ki-text-1, #c9c7c2)}
    .dot{width:8px;height:8px;border-radius:4px;flex:none}
    .hl{font-size:24px;font-weight:500;letter-spacing:-0.015em}
    .sub{font-size:14px;color:var(--ki-text-mid, #8e8d89)}
  `;
  M.V4_POP_CSS = PLANT_CSS;

  M.FUNCTION_POPUPS.push([HASH, 'Planter', 'mdi:flower', 'msh-planter-card']);
  M.popupNeeds[HASH] = (h) => M.planterAuto(h).length > 0;
  // Den importerte #planter (custom:ki-planter-pro-card) erstattes av den genererte (som #kalender)
  M.POPUP_SUPERSEDE = M.POPUP_SUPERSEDE || {};
  M.POPUP_SUPERSEDE[HASH] = { name: 'Planter', test: (cfg) => JSON.stringify(cfg || {}).indexOf('ki-planter') >= 0 };
  if (M.POPUP_CARDS && !M.POPUP_CARDS.includes('msh-planter-card')) M.POPUP_CARDS.push('msh-planter-card');
  M.define('msh-planter-card', Planter, 'MSH Planter', 'Planter-popup (#planter): status, neste vanning, jordfukt med målbånd, lys/temp/næring og «Merk som vannet».');
})();
