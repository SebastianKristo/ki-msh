/* msh-sovn-card · Søvn-popup #sovn (Fiks 60.3). Fasit: «design/Søvn.dc.html». ÉTT kort i popupen – Bubble Card eier
 * headeren (ikon bedtime, «Søvn», lukk).
 * Rekkefølge (som designet): ring 200 × 200 (én bue per person, lilla når personen sover) med kjerne (måne/sol, «1 / 3»,
 * «sover») · overskrift («Alle er våkne» / «Alle sover» / «Cybele og Rune sover») · neste vekking («Neste vekking 06:30 ·
 * om 9 t 4 min» / «Ingen vekking satt») → faner Søvn · Vekking (hold 400 ms + dra = MSH.tabRow, tab_order, start_tab) →
 *   Søvn: én rad per person (ikon, navn + «Vindu åpent»-chip, undertekst, bryter) · «Siste 24 timer» (hvem sov når, fra
 *         historikken til sover-entiteten, hentes når popupen åpnes, mellomlagres 5 min)
 *   Vekking: ett kort per person: tid (−/+ 15 min), bryter, ukedager M T O T F L S, undertekst.
 * Autokonfig per person (person.*), ingen gjettede ID-er – «–» når noe mangler:
 *   sover   input_boolean / binary_sensor / switch med personens navn + sover|sleep|asleep (bryteren virker bare på
 *           input_boolean / switch)
 *   vindu   binary_sensor (device_class window) i et område med personens navn (f.eks. «Cybele soverom»)
 *   søvn i natt  søvnvarighet fra Person-oppsettet (MSH.personAuto)
 *   vekking input_datetime (med tid) med personens navn + vekking|alarm|wake (ikke helg), ellers mobilens neste alarm
 *           (sensor.*next_alarm, bare visning); på/av: input_boolean / switch med navn + vekking|alarm + aktiv|på|enabled;
 *           ukedager: input_boolean per dag (man/tir/ons/tor/fre/lor/son | mon … sun); vekkelys: lys i personens område.
 * Config: people_cfg.<person>.{ asleep, window, alarm, alarm_on, light } overstyrer ('none' = ingen),
 *   exclude [person.x] / include.personer, tab_order, start_tab.
 */
(function () {
  const M = window.MSH, esc = M.esc, C = M.C;
  const HASH = '#sovn';
  const MOON = C.purple, SUN = C.orange, BLUE = C.blue;
  const TV = (k, n) => (M.tabH ? M.tabH.v(k, n) : n + 'px');
  const TABS = [['sleep', 'Søvn'], ['wake', 'Vekking']];
  const tabOrder = (c) => (M.edOrder ? M.edOrder(TABS.map((t) => t[0]), c.tab_order) : TABS.map((t) => t[0]));
  const tone = (col, a) => `color-mix(in srgb, ${col} ${Math.round(a * 100)}%, transparent)`;
  const real = (h, id) => (id && id !== 'none' && h.states[id] ? id : null);
  const pad = (n) => String(n).padStart(2, '0');
  const hm = (m) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
  const DAYS = ['M', 'T', 'O', 'T', 'F', 'L', 'S'];
  const DAY_RX = [/man|mon/, /tir|tue/, /ons|wed/, /tor|thu/, /fre|fri/, /lor|l[øo]r|sat/, /son|s[øo]n|sun/];

  const keysOf = (h, pid) => [pid.split('.')[1], M.slug(M.name(h, pid))].filter((k, i, a) => k && k.length > 1 && a.indexOf(k) === i);
  const mine = (keys, id) => keys.some((k) => id.split('.')[1].includes(k));
  // Autokonfig for én person
  M.sovnAuto = function (h, pid) {
    const keys = keysOf(h, pid), ids = Object.keys(h.states);
    const one = (doms, rx, not) => ids.filter((id) => doms.includes(id.split('.')[0]) && mine(keys, id) && rx.test(id) && !(not && not.test(id))).sort((a, b) => a.length - b.length)[0] || null;
    const out = {};
    out.asleep = one(['input_boolean', 'binary_sensor', 'switch'], /sover|sleep|asleep|sovn_?modus/, /score|quality|duration|varighet|_rem|deep|light_sleep/);
    out.alarm = ids.filter((id) => id.indexOf('input_datetime.') === 0 && mine(keys, id) && /vekking|alarm|wake/.test(id) && !/helg|weekend/.test(id) && (h.states[id].attributes || {}).has_time !== false).sort((a, b) => a.length - b.length)[0] || null;
    out.alarm_on = one(['input_boolean', 'switch'], /(vekking|alarm|wake).*(aktiv|_on$|_pa$|enabled|active)|(aktiv|enabled).*(vekking|alarm|wake)/);
    out.days = DAY_RX.map((rx) => ids.find((id) => id.indexOf('input_boolean.') === 0 && mine(keys, id) && /vekking|alarm|wake/.test(id) && rx.test(id.split('.')[1].replace(/.*(vekking|alarm|wake)_?/, ''))) || null);
    if (!out.days.some(Boolean)) out.days = null;
    const P = M.personAuto ? M.personAuto(h, pid) : {};
    out.duration = P.sleep_duration || null;
    const E = h.entities || {};
    out.phone_alarm = P.dev ? Object.keys(E).find((id) => E[id].device_id === P.dev && /next_alarm|neste_alarm/.test(id) && h.states[id]) || null : null;
    const areas = M.areas(h).filter((a) => keys.some((k) => M.slug(a.name).includes(k)));
    out.window = null; out.light = null;
    areas.some((a) => { out.window = M.all(h, 'binary_sensor', (s, id) => ['window', 'opening'].includes((s.attributes || {}).device_class) && M.areaOf(h, id) === a.id)[0] || null; return !!out.window; });
    areas.some((a) => { out.light = M.all(h, 'light', (s, id) => M.areaOf(h, id) === a.id)[0] || null; return !!out.light; });
    return out;
  };
  const autoPeople = (h) => M.all(h, 'person').filter((pid) => { const A = M.sovnAuto(h, pid); return A.asleep || A.alarm || A.phone_alarm; });
  function people(h, c) {
    const base = autoPeople(h);
    const L = M.applyLists(c, 'personer', base.length ? base : []).filter((id) => h.states[id]);
    return L.map((pid) => {
      const A = M.sovnAuto(h, pid), o = ((c.people_cfg || {})[pid.split('.')[1]]) || {}, ids = { ...A };
      ['asleep', 'window', 'alarm', 'alarm_on', 'light'].forEach((k) => { if (o[k] === 'none') ids[k] = null; else if (real(h, o[k])) ids[k] = o[k]; });
      return { pid, key: pid.split('.')[1], name: M.name(h, pid), ids, auto: A };
    });
  }
  const isOn = (h, id) => !!(id && h.states[id] && h.states[id].state === 'on');
  const minsOf = (s) => {
    if (!s || !M.isNum(s.state)) return null;
    const v = Number(s.state), u = String(s.attributes.unit_of_measurement || '').toLowerCase();
    if (u === 'h' || u === 't' || u.startsWith('hour') || u.startsWith('time')) return v * 60;
    if (u === 's' || u.startsWith('sec') || u.startsWith('sek')) return v / 60;
    return u === 'min' || u.startsWith('minut') ? v : v <= 24 ? v * 60 : v;
  };
  // Vekketid (minutter etter midnatt) · kan endres? · på?
  function alarmOf(h, p) {
    const a = p.ids.alarm && h.states[p.ids.alarm];
    if (a && !M.unavailable(a)) {
      const A = a.attributes || {}, m = A.hour != null ? Number(A.hour) * 60 + Number(A.minute || 0) : /^\d{1,2}:\d{2}/.test(a.state) ? Number(a.state.slice(0, 2)) * 60 + Number(a.state.slice(3, 5)) : /\d{2}:\d{2}/.test(a.state) ? (() => { const x = /(\d{2}):(\d{2})/.exec(a.state); return Number(x[1]) * 60 + Number(x[2]); })() : null;
      return { m, edit: m != null, on: p.ids.alarm_on ? isOn(h, p.ids.alarm_on) : m != null, src: 'ha' };
    }
    const ph = p.ids.phone_alarm && h.states[p.ids.phone_alarm];
    const t = ph && !M.unavailable(ph) ? Date.parse(ph.state) : NaN;
    if (!isNaN(t)) { const d = new Date(t); return { m: d.getHours() * 60 + d.getMinutes(), edit: false, on: true, src: 'phone', at: t }; }
    return { m: null, edit: false, on: false, src: null };
  }

  class Sovn extends M.Card {
    static get cardName() { return 'Søvn'; }
    static get defaults() { return {}; }
    static get uiPersist() { return ['tab']; }
    static getStubConfig() { return { card_id: M.uid() }; }
    static get startTabSpec() { return { tabs: (card) => tabOrder(card.config) }; }
    static get schema() {
      return (h, c) => {
        const L = h ? people(h, c || {}) : [];
        return [
          ...(M.startTab ? [M.startTab.field({ items: (hh, cc) => tabOrder(cc || {}).map((k) => ({ key: k, label: TABS.find((t) => t[0] === k)[1] })) })] : []),
          { type: 'lists', label: 'Personer', lists: (hh) => [{ key: 'personer', label: 'Personer', ids: autoPeople(hh), domains: ['person'] }] },
          ...L.map((p) => {
            const P = `people_cfg.${p.key}`, A = p.auto;
            const ent = (k, label, doms) => ({ type: 'entity', name: `${P}.${k}`, label, domains: doms, auto: () => A[k] });
            return { type: 'section', id: 'pp-' + p.key, label: 'Person · ' + p.name, icon: 'mdi:sleep', fields: [
              ent('asleep', 'Sover', ['input_boolean', 'binary_sensor', 'switch']), ent('window', 'Vindu', ['binary_sensor']),
              ent('alarm', 'Vekketid', ['input_datetime']), ent('alarm_on', 'Vekking på/av', ['input_boolean', 'switch']), ent('light', 'Vekkelys', ['light']),
            ] };
          }),
          { type: 'info', label: 'Personene finnes selv: en sover-bryter/-sensor eller vekking med personens navn (f.eks. input_boolean.cybele_sover, input_datetime.cybele_vekking). Vindu og vekkelys hentes fra et område med personens navn.' },
        ];
      };
    }
    get cardSize() { return 8; }
    get tab() { const V = tabOrder(this.config), t = this.ui.tab || this.config.start_tab; return V.includes(t) ? t : V[0]; }
    onOpen() { this._loadHist(); clearInterval(this._tick); this._tick = setInterval(() => this.update(), 60000); }
    onClose() { clearInterval(this._tick); this._tick = 0; }
    disconnectedCallback() { super.disconnectedCallback(); clearInterval(this._tick); this._tick = 0; }
    // Siste 24 t for sover-entitetene (minimal_response, no_attributes, mellomlagret 5 min)
    async _loadHist() {
      const h = this.hass;
      if (!h || !h.callWS) return;
      const ids = people(h, this.config).map((p) => p.ids.asleep).filter(Boolean);
      if (!ids.length) return;
      const now = Date.now(), k = ids.join(',');
      if (this._hist && this._hist.k === k && now - this._hist.t < 300000) return;
      try {
        const r = await h.callWS({ type: 'history/history_during_period', start_time: new Date(now - 86400000).toISOString(), end_time: new Date(now).toISOString(), entity_ids: ids, minimal_response: true, no_attributes: true, significant_changes_only: false });
        const d = {};
        ids.forEach((id) => { d[id] = ((r && r[id]) || []).map((x) => ({ t: x.lu != null ? x.lu * 1000 : Date.parse(x.last_changed || x.last_updated), s: x.s != null ? x.s : x.state })).filter((x) => !isNaN(x.t)); });
        this._hist = { k, t: now, d };
        this.update();
      } catch (e) { /* ingen historikk → tom tidslinje */ }
    }
    _segs(p) {
      const h = this.hass, id = p.ids.asleep, now = Date.now(), t0 = now - 86400000;
      const L = (this._hist && this._hist.d[id]) || [];
      const cur = h.states[id];
      const pts = L.concat(cur ? [{ t: Math.min(now, Date.parse(cur.last_changed) || now), s: cur.state }] : []).sort((a, b) => a.t - b.t);
      const out = [];
      pts.forEach((x, i) => { if (x.s !== 'on') return; const a = Math.max(t0, x.t), b = Math.min(now, i + 1 < pts.length ? pts[i + 1].t : now); if (b > a) out.push([(a - t0) / 86400000 * 100, (b - a) / 86400000 * 100]); });
      return out;
    }
    render() {
      const h = this.hass, c = this.config, L = people(h, c);
      L.forEach((p) => Object.values(p.ids).forEach((id) => { if (typeof id === 'string') this.s(id); else if (Array.isArray(id)) id.forEach((x) => x && this.s(x)); }));
      const n = L.length, sl = L.filter((p) => isOn(h, p.ids.asleep)), asleep = sl.length;
      const seg = n ? 360 / n : 360;
      const ring = L.map((p, i) => `<div class="rg" style="background:conic-gradient(from ${i * seg + 4}deg, ${isOn(h, p.ids.asleep) ? MOON : 'var(--ki-surface-3, #3c3c3c)'} 0 ${Math.max(4, seg - 8)}deg, transparent ${Math.max(4, seg - 8)}deg)"></div>`).join('');
      const nm = (new Date().getHours()) * 60 + new Date().getMinutes();
      const al = L.map((p) => alarmOf(h, p)).filter((a) => a.on && a.m != null).map((a) => a.m).sort((x, y) => ((x - nm + 1440) % 1440) - ((y - nm + 1440) % 1440));
      const next = al[0], until = next != null ? (next - nm + 1440) % 1440 : null;
      const headline = !n ? 'Ingen personer funnet' : asleep === 0 ? 'Alle er våkne' : asleep === n ? 'Alle sover' : kiT(`${listTxt(sl.map((p) => p.name))} sover`, `${listTxt(sl.map((p) => p.name), 'and')} ${asleep > 1 ? 'are' : 'is'} asleep`);
      const nextTxt = next != null ? `Neste vekking ${hm(next)} · om ${Math.floor(until / 60)} t ${until % 60} min` : 'Ingen vekking satt';
      const t = this.tab;
      const tabs = `<div class="tabs" role="tablist" data-glass-drag="x"${M.tabH && M.tabH.style(c) ? ` style="${M.tabH.style(c)}"` : ''}>${tabOrder(c).map((k) => `<button class="tb ${k === t ? 'on' : ''}" role="tab" aria-selected="${k === t}" data-act="tab" data-v="${k}" data-haptic="selection">${esc(TABS.find((x) => x[0] === k)[1])}</button>`).join('')}</div>`;
      const top = `<section class="top" data-key="top"><div class="ring">${ring}<div class="core"><span style="color:${asleep ? MOON : SUN}">${M.icon(asleep ? 'mdi:weather-night' : 'mdi:white-balance-sunny', 28)}</span>
          <div class="cnt num">${asleep}<span> / ${n}</span></div><div class="lb">sover</div></div></div>
        <div class="tt"><div class="hl">${esc(headline)}</div><div class="sub">${esc(nextTxt)}</div></div></section>`;
      if (!n) return `<div class="wrap">${top}${tabs}${M.emptyState('Fant ingen sover-bryter eller vekking for personene', 'personer')}</div>`;
      return `<div class="wrap">${top}${tabs}${t === 'wake' ? this._wake(L) : this._sleep(L)}</div>`;
    }
    _sleep(L) {
      const h = this.hass;
      const rows = L.map((p, i) => {
        const id = p.ids.asleep, s = id && h.states[id], on = isOn(h, id), col = on ? MOON : SUN, can = !!(id && /^(input_boolean|switch)\./.test(id));
        const win = isOn(h, p.ids.window);
        const since = s && !M.unavailable(s) ? new Date(s.last_changed) : null;
        const dur = minsOf(p.ids.duration && h.states[p.ids.duration]);
        const sub = !s ? 'Velg sover-entitet' : on ? `Sover${since ? ' · siden ' + hm(since.getHours() * 60 + since.getMinutes()) : ''}` : dur != null ? `Våken · sov ${Math.floor(dur / 60)} t ${Math.round(dur % 60)} min i natt` : `Våken${since ? ' · siden ' + hm(since.getHours() * 60 + since.getMinutes()) : ''}`;
        return `<button class="pr${i ? ' bt' : ''}" data-key="pr-${esc(p.key)}" ${can ? `data-act="asleep" data-id="${esc(id)}" data-haptic="selection"` : id ? `data-ent="${esc(id)}"` : `data-act="customize" data-section="pp-${esc(p.key)}"`}>
          <span class="pic" style="background:${tone(col, 0.18)};color:${col}">${M.icon(on ? 'mdi:weather-night' : 'mdi:white-balance-sunny', 20)}</span>
          <span class="pt"><span class="pn"><span data-noi18n>${esc(p.name)}</span>${win ? '<span class="chip">Vindu åpent</span>' : ''}</span><span class="ps">${esc(sub)}</span></span>
          ${can ? `<span class="sw${on ? ' on' : ''}"><i></i></span>` : ''}</button>`;
      }).join('');
      const t0 = Date.now() - 86400000;
      const labels = [0, 6, 12, 18, 24].map((k) => pad(new Date(t0 + k * 3600000).getHours()));
      const tl = L.map((p) => `<div class="tl" data-key="tl-${esc(p.key)}"><span class="tn" data-noi18n>${esc(p.name)}</span><div class="tb2">${p.ids.asleep ? this._segs(p).map(([a, w]) => `<span style="left:${a.toFixed(2)}%;width:${w.toFixed(2)}%"></span>`).join('') : ''}</div></div>`).join('');
      return `<section class="rows" data-key="rows">${rows}</section>
        <section class="hist" data-key="hist"><div class="hh"><div class="cap">Siste 24 timer</div><div class="cap2">hvem sov når</div></div>${tl}
        <div class="ax num">${labels.map((x) => `<span>${x}</span>`).join('')}</div></section>`;
    }
    _wake(L) {
      const h = this.hass;
      return `<section class="al" data-key="al">${L.map((p) => {
        const a = alarmOf(h, p), canOn = !!(p.ids.alarm_on && /^(input_boolean|switch)\./.test(p.ids.alarm_on));
        const sub = a.src === 'phone' ? 'Alarm på mobil' : p.ids.light ? `Vekkelys · ${M.name(h, p.ids.light)}` : a.src ? 'Vekking i Home Assistant' : 'Velg vekketid';
        const days = (p.ids.days || DAYS.map(() => null)).map((id, k) => { const on = id ? isOn(h, id) : null; return `<button class="dy${on ? ' on' : ''}${id ? '' : ' na'}" ${id ? `data-act="day" data-id="${esc(id)}" data-haptic="selection"` : 'disabled'} aria-pressed="${!!on}">${DAYS[k]}</button>`; }).join('');
        return `<div class="ac${a.on ? '' : ' off'}" data-key="ac-${esc(p.key)}"><div class="ar"><div class="aw"><span class="an" data-noi18n>${esc(p.name)}</span>
            <div class="at">${a.edit ? `<button class="rb press" data-act="alarm" data-k="${esc(p.key)}" data-d="-15" data-haptic="light" aria-label="−15 min">${M.icon('mdi:minus', 18)}</button>` : ''}<span class="tm num">${a.m != null ? hm(a.m) : '–'}</span>${a.edit ? `<button class="rb press" data-act="alarm" data-k="${esc(p.key)}" data-d="15" data-haptic="light" aria-label="+15 min">${M.icon('mdi:plus', 18)}</button>` : ''}</div></div>
            ${canOn ? `<button class="sw${a.on ? ' on' : ''}" data-act="alarm-on" data-id="${esc(p.ids.alarm_on)}" data-haptic="selection" role="switch" aria-checked="${a.on}"><i></i></button>` : ''}</div>
          <div class="dys">${days}</div><span class="as">${esc(sub)}</span></div>`;
      }).join('')}</section>`;
    }
    onAction(name, el, ev) {
      const d = el.dataset, h = this.hass;
      if (name === 'tab') return this.setUI({ tab: d.v });
      if (name === 'asleep' || name === 'alarm-on' || name === 'day') { M.toggle(h, d.id); return undefined; }
      if (name === 'alarm') {
        const p = people(h, this.config).find((x) => x.key === d.k), a = p && alarmOf(h, p);
        if (!a || !a.edit) return undefined;
        const m = (a.m + Number(d.d) + 1440) % 1440;
        M.call(h, 'input_datetime', 'set_datetime', { entity_id: p.ids.alarm, time: `${hm(m)}:00` });
        return undefined;
      }
      return super.onAction(name, el, ev);
    }
    afterRender() {
      const R = this.shadowRoot;
      if (M.tabRow) M.tabRow(this, R.querySelector('.tabs[role="tablist"]'), { active: () => this.tab, order: () => tabOrder(this.config), field: 'tab_order' });
    }
    get styles() {
      return `${M.V4_POP_CSS || ''}
        .tabs{display:grid;grid-template-columns:1fr 1fr;gap:2px;padding:4px;border-radius:calc(${TV('th', 40)} / 2 + 4px);background:var(--ki-surface-3, #303030);position:relative;touch-action:pan-y}
        .tb{min-width:0;height:${TV('th', 40)};padding:0 ${TV('tp', 8)};border-radius:16px;font-size:${TV('tf', 13)};font-weight:500;white-space:nowrap;color:var(--ki-text-2, #a9a7a2)}
        .tb.on{background:${C.accent};color:var(--ki-on-accent, #2a1720)}
        .top{display:flex;flex-direction:column;align-items:center;gap:18px}
        .ring{position:relative;width:200px;height:200px}
        .rg{position:absolute;inset:0;border-radius:50%;-webkit-mask:radial-gradient(circle, transparent 84px, #000 85px);mask:radial-gradient(circle, transparent 84px, #000 85px);transition:background .4s} /* ki-hex-ok: maske */
        .core{position:absolute;inset:26px;border-radius:50%;background:var(--ki-surface, #303030);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px}
        .cnt{font-size:30px;font-weight:500;letter-spacing:-0.03em}
        .cnt span{font-size:15px;color:var(--ki-text-mid, #8e8d89);font-weight:400}
        .lb{font-size:12px;color:var(--ki-text-mid, #8e8d89)}
        .tt{display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center}
        .rows{display:flex;flex-direction:column}
        .pr{display:flex;align-items:center;gap:12px;padding:12px 4px;width:100%;text-align:left}
        .pr.bt{border-top:1px solid var(--ki-line, rgba(255,255,255,0.05))}
        .pic{width:42px;height:42px;border-radius:21px;flex:none;display:grid;place-items:center;transition:background .3s}
        .pt{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
        .pn{font-size:15px;font-weight:500;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
        .chip{display:inline-flex;font-size:10px;font-weight:600;padding:2px 7px;border-radius:7px;background:${tone(BLUE, 0.18)};color:var(--ki-blue-text, ${BLUE})}
        .ps{font-size:12px;color:var(--ki-text-mid, #8e8d89)}
        .sw{position:relative;width:46px;height:28px;border-radius:14px;flex:none;background:var(--ki-ctrl, #3a3a3d);transition:background .2s;display:block}
        .sw.on{background:${MOON}}
        .sw i{position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:11px;background:var(--ki-knob, #f4f3ef);transition:left .2s}
        .sw.on i{left:21px}
        .hist{display:flex;flex-direction:column;gap:10px}
        .hh{display:flex;justify-content:space-between;padding:0 4px}
        .cap{font-size:12px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;color:var(--ki-text-mid, #8e8d89)}
        .cap2{font-size:12px;color:var(--ki-text-lo, #6d6c69)}
        .tl{display:flex;align-items:center;gap:10px}
        .tn{width:70px;flex:none;font-size:12px;color:var(--ki-text-2, #a9a7a2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .tb2{position:relative;flex:1;height:16px;border-radius:8px;background:var(--ki-surface, #303030);overflow:hidden}
        .tb2 span{position:absolute;top:0;bottom:0;border-radius:8px;background:${MOON}}
        .ax{display:flex;justify-content:space-between;padding-left:80px;font-size:10px;color:var(--ki-text-lo, #6d6c69)}
        .al{display:flex;flex-direction:column;gap:var(--msh-gap,8px)}
        .ac{display:flex;flex-direction:column;gap:12px;padding:16px;border-radius:24px;background:var(--ki-surface, #303030);transition:opacity .2s}
        .ac.off{opacity:.55}
        .ar{display:flex;align-items:center;gap:12px}
        .aw{flex:1;display:flex;flex-direction:column;gap:2px;min-width:0}
        .an{font-size:13px;color:var(--ki-text-mid, #8e8d89)}
        .at{display:flex;align-items:center;gap:6px}
        .rb{width:32px;height:32px;border-radius:16px;background:var(--ki-surface-2, #3a3a3a);display:grid;place-items:center}
        .tm{font-size:34px;font-weight:300;letter-spacing:-0.03em;min-width:96px;text-align:center}
        .dys{display:flex;gap:4px}
        .dy{flex:1;height:32px;border-radius:16px;font-size:12px;font-weight:600;background:var(--ki-surface-2, #3a3a3a);color:var(--ki-text-mid, #8e8d89)}
        .dy.on{background:color-mix(in srgb, ${MOON} 90%, transparent);color:var(--ki-on-accent, #252525)}
        .dy.na{opacity:.6;cursor:default}
        .as{font-size:12px;color:var(--ki-text-mid, #8e8d89)}
      `;
    }
  }
  const listTxt = (L, og = 'og') => (L.length <= 1 ? L.join('') : `${L.slice(0, -1).join(', ')} ${og} ${L[L.length - 1]}`);

  M.FUNCTION_POPUPS.push([HASH, 'Søvn', 'mdi:weather-night', 'msh-sovn-card']);
  M.popupNeeds[HASH] = (h) => autoPeople(h).length > 0;
  if (M.POPUP_CARDS && !M.POPUP_CARDS.includes('msh-sovn-card')) M.POPUP_CARDS.push('msh-sovn-card');
  M.define('msh-sovn-card', Sovn, 'MSH Søvn', 'Søvn-popup (#sovn): hvem sover, siste 24 timer og vekking per person.');
})();
