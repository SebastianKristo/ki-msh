/* msh-garasje-card · Garasje-popup #garasje (Fiks 32.2). Fasit: «Garasjeport.dc.html». ÉTT kort i popupen.
 * Autogenereres når det finnes cover.* med device_class: garage (én eller to porter).
 * Rekkefølge: portvelger + tannhjul (MSH.sik.picker – én port: bare tannhjulet, høyrestilt) → toppkort (MSH.sik.hero: navn +
 * chip Sikret / Lukkes om N min / I bevegelse (blinkende ikon), tilstand 44/300, portillustrasjon 118 × 104 i CSS der porten
 * har høyden 100 − current_position %, gult lys ovenfra når garasjelyset er på, Åpne · Stopp · Lukk) → statusfliser (Lys,
 * Bevegelse, Lukket i / Åpen i) → Automatikk (MSH.sik.auto: Autolukk 5/10/15/30 min, Lukk når alle drar, Åpne når Tesla
 * kommer, Varsle hvis åpen etter 22:00) → Historikk (MSH.sik.history: Åpnet med «Åpen i X», Lukket, Åpen etter 22:00).
 * «Åpne krever» (Tilpass → Sikkerhet): Ett trykk / To trykk (første trykk gjør Åpne oransje i 3 s) / Kun hjemme.
 * Autokonfig: lys = light.* og bevegelse = binary_sensor motion/occupancy i portens område; doors_cfg.<objekt>.{name, light,
 * motion} overstyrer ('none' = ingen). Automatikk fra KI Varslinger og sikkerhet (MSH.finnBrytere), overrides.{auto_close,
 * away_close, arrive_open, night_alert}. Ingen gjettede ID-er – «–» når noe mangler.
 */
(function () {
  const M = window.MSH, esc = M.esc, S = M.sik;
  const { G, O, R, Y, GR, PK } = S.COL;
  const HASH = '#garasje';
  const GAR_RX = /garasje|garage|\bport\b/;
  const MINS = [5, 10, 15, 30];
  const real = (hass, id) => (id && id !== 'none' && hass.states[id] ? id : null);
  const txt = (hass, id) => (id + ' ' + String((hass.states[id] && hass.states[id].attributes.friendly_name) || '')).toLowerCase();
  const on = (c, k) => c[k] !== false;
  const covers = (hass) => M.all(hass, 'cover', (s) => s.attributes.device_class === 'garage');
  M.garasjeHas = (hass) => covers(hass).length > 0;
  const findAuto = (rx) => (hass) => Object.keys(hass.states).filter((id) => /^(automation|input_boolean|switch)\./.test(id) && GAR_RX.test(txt(hass, id)) && rx.test(txt(hass, id))).sort()[0] || null;
  const DEFS = [
    { k: 'auto', ov: 'auto_close', rx: /autolukk|auto.?close|auto.?lukk/, fb: findAuto(/autolukk|auto.?close|auto.?lukk/) },
    { k: 'away', ov: 'away_close', rx: /(garasje|garage|port).*(alle.?dr|borte|away|leav)|(alle.?dr|borte|away|leav).*(garasje|garage|port)/, fb: findAuto(/alle.?dr|borte|away|leav/) },
    { k: 'arrive', ov: 'arrive_open', rx: /tesla|ankomst|arriv|(bil|car).*(kommer|hjem)/, fb: findAuto(/tesla|ankom|arriv|kommer/) },
    { k: 'night', ov: 'night_alert', rx: /(garasje|garage|port).*(22|natt|night|kveld|etter)|(22|natt|night|kveld).*(garasje|garage|port)|[aå]pen.?etter/, fb: findAuto(/22|natt|night|kveld|[aå]pen.?etter/) },
  ];
  M.garasjeAutos = function (hass, cfg) {
    const ov = (cfg && cfg.overrides) || {}, o2 = {};
    DEFS.forEach((d) => { if (ov[d.ov]) o2[d.k] = ov[d.ov]; });
    return S.autoFind(hass, DEFS, o2);
  };
  M.garasjeAuto = function (hass, cfg) {
    if (!hass) return { doors: [] };
    return { doors: M.applyLists(cfg || {}, 'porter', covers(hass)).filter((id) => hass.states[id]).slice(0, 2) };
  };
  // Autokonfig for én port
  function doorInfo(hass, cfg, id) {
    const st = hass.states[id] || null, obj = id.split('.')[1], o = ((cfg.doors_cfg || {})[obj]) || {}, area = M.areaOf(hass, id);
    const pref = (L) => L.sort((a, b) => (GAR_RX.test(txt(hass, b)) ? 1 : 0) - (GAR_RX.test(txt(hass, a)) ? 1 : 0) || a.localeCompare(b))[0] || null;
    const lightAuto = area ? pref(M.all(hass, 'light', (s, x) => M.areaOf(hass, x) === area)) : null;
    const motionAuto = area ? pref(M.all(hass, 'binary_sensor', (s, x) => ['motion', 'occupancy', 'presence'].includes(s.attributes.device_class) && M.areaOf(hass, x) === area)) : null;
    const light = o.light === 'none' ? null : real(hass, o.light) || lightAuto, motion = o.motion === 'none' ? null : real(hass, o.motion) || motionAuto;
    const cp = st && st.attributes.current_position, hasPos = cp != null && M.isNum(cp);
    const v = st ? st.state : '';
    const pos = hasPos ? M.clamp(Number(cp), 0, 100) : v === 'open' ? 100 : v === 'closed' ? 0 : null;
    return { id, obj, st, v, name: o.name || (st && st.attributes.friendly_name) || obj.replace(/_/g, ' '), light, lightAuto, lightOwn: real(hass, o.light), motion, motionAuto, motionOwn: real(hass, o.motion), hasPos, pos };
  }
  const someoneHome = (hass) => M.all(hass, 'person').some((p) => hass.states[p].state === 'home') || M.all(hass, 'device_tracker', (s, id) => /tesla|bil\b|car/.test(txt(hass, id))).some((d) => hass.states[d].state === 'home');
  const CONF = [['ingen', 'Ett trykk'], ['to', 'To trykk'], ['borte', 'Kun hjemme']];
  const CONF_NOTE = { ingen: 'Porten åpnes med ett trykk.', to: 'Første trykk gjør «Åpne» oransje, andre trykk innen 3 s åpner.', borte: 'Åpne er bare tilgjengelig når noen er hjemme eller Tesla er nær.' };

  class Garasje extends M.Card {
    static get cardName() { return 'Garasje'; }
    static get defaults() { return { open_confirm: 'ingen', toasts: true }; }
    static get uiPersist() { return ['sel', 'amOpen', 'amMem']; }
    static getStubConfig() { return { card_id: M.uid(), ...this.defaults }; }
    static get schema() {
      return (h, c) => {
        const A = h ? M.garasjeAuto(h, c) : { doors: [] }, au = h ? M.garasjeAutos(h, { ...c, overrides: {} }) : {};
        return [
          { type: 'lists', label: 'Porter', lists: (hh) => [{ key: 'porter', label: 'Garasjeporter (maks to)', ids: covers(hh), domains: ['cover'] }] },
          ...A.doors.map((id) => {
            const x = doorInfo(h, c, id), P = `doors_cfg.${x.obj}`;
            return { type: 'section', id: 'door-' + x.obj, label: 'Port · ' + x.name, icon: 'mdi:garage', fields: [
              { type: 'text', name: P + '.name', label: 'Navn', placeholder: (x.st && x.st.attributes.friendly_name) || x.obj },
              { type: 'entity', name: P + '.light', label: 'Lys', domains: ['light', 'switch'], auto: () => x.lightAuto },
              { type: 'entity', name: P + '.motion', label: 'Bevegelse', domains: ['binary_sensor'], auto: () => x.motionAuto },
            ] };
          }),
          { type: 'section', id: 'secs', label: 'Seksjoner', icon: 'mdi:view-grid-outline', fields: [
            { type: 'boolean', name: 'show_status', label: 'Status · lys, bevegelse, tid', default: true },
            { type: 'boolean', name: 'show_auto', label: 'Automatikk', default: true },
            { type: 'boolean', name: 'show_hist', label: 'Historikk', default: true },
          ] },
          { type: 'section', id: 'safe', label: 'Sikkerhet', icon: 'mdi:shield-lock-outline', fields: [
            { type: 'select', name: 'open_confirm', label: 'Åpne krever', options: CONF, default: 'ingen' },
            { type: 'info', label: 'To trykk: første trykk gjør «Åpne» oransje, andre trykk innen 3 s åpner. Kun hjemme: Åpne er bare tilgjengelig når noen er hjemme eller Tesla er nær.' },
          ] },
          { type: 'overrides', id: 'autos', label: 'Automatikk', fields: [
            { name: 'auto_close', label: 'Autolukk', domains: ['switch', 'input_boolean', 'automation'], auto: () => au.auto },
            { name: 'away_close', label: 'Lukk når alle drar', domains: ['automation', 'input_boolean', 'switch'], auto: () => au.away },
            { name: 'arrive_open', label: 'Åpne når Tesla kommer', domains: ['automation', 'input_boolean', 'switch'], auto: () => au.arrive },
            { name: 'night_alert', label: 'Varsle hvis åpen etter 22:00', domains: ['automation', 'input_boolean', 'switch'], auto: () => au.night },
          ] },
          { type: 'section', id: 'view', label: 'Visning', icon: 'mdi:eye-outline', fields: [{ type: 'boolean', name: 'toasts', label: 'Bekreftelsesmeldinger (toast)', default: true }] },
        ];
      };
    }
    get cardSize() { return 8; }
    customize(focus) { return openSheet(this, focus); }
    onOpen() {
      if (M.garasjePick) { const id = M.garasjePick; M.garasjePick = null; if (M.garasjeAuto(this.hass, this.config).doors.includes(id) && id !== this.ui.sel) this.setUI({ sel: id }); }
      this._loadLog();
      clearInterval(this._tick);
      this._tick = setInterval(() => this.update(), 30000); // «Åpen i 2 min» / «Lukkes om N min» – bare mens popupen er åpen
    }
    onClose() { clearInterval(this._tick); this._tick = 0; this._disarm(); }
    disconnectedCallback() { super.disconnectedCallback(); clearInterval(this._tick); this._tick = 0; }
    afterRender() {
      const w = Math.round(this.getBoundingClientRect().width);
      if (w && this._pickW !== w) { this._pickW = w; if (this._pickMode && this._pickMode !== 'eq') { this._pickMode = 'eq'; this.update(); return; } }
      if (this._pickMode !== 'many' && !S.pickerFits(this.shadowRoot)) { this._pickMode = this._pickMode === 'fit' ? 'many' : 'fit'; this.update(); }
    }
    _toast(t) { if (this.config.toasts !== false) M.toast(t); }
    _cur(A) { const L = A.doors; if (!L.length) return null; const i = L.indexOf(this.ui.sel); return L[i >= 0 ? i : 0]; }
    async _loadLog() {
      const h = this.hass, A = M.garasjeAuto(h, this.config);
      if (!A.doors.length || !h || !h.callWS) return;
      this._log = await S.logbook(h, A.doors, 3);
      this._logT = Date.now();
      this.update();
    }
    // Bevegelse: HA (opening/closing) eller ventende trykk (optimistisk, tilbakerulling etter 10 s). success når porten er ferdig.
    _mov(x) {
      const v = x.v, p = this._pend && this._pend[x.id];
      const ha = v === 'opening' ? 'up' : v === 'closing' ? 'down' : null;
      if (p) {
        const target = p.want === 'up' ? 'open' : 'closed';
        if (v === target && (p.moved || !x.hasPos || x.pos === (p.want === 'up' ? 100 : 0))) { clearTimeout(p.tm); delete this._pend[x.id]; M.haptic('success'); this._toast(`${x.name} ${p.want === 'up' ? 'åpnet' : 'lukket'}`); return null; }
        if (ha === p.want) { if (!p.moved) { p.moved = true; clearTimeout(p.tm); } return ha; }
        if (!p.moved) return p.want;
        delete this._pend[x.id];
      }
      return ha;
    }
    _status(x, mov) {
      if (!x.st || M.unavailable(x.st)) return 'un';
      if (x.hasPos) return x.pos <= 0 ? 'closed' : x.pos >= 100 ? 'open' : 'part';
      return x.v === 'closed' ? 'closed' : x.v === 'open' ? 'open' : mov === 'up' ? 'closed' : mov === 'down' ? 'open' : 'part';
    }
    _autos() {
      const h = this.hass, ids = M.garasjeAutos(h, this.config);
      Object.values(ids).forEach((e) => e && this.s(e));
      const numId = ids.auto ? S.minsOn(h, ids.auto, /lukk|close|min|tid|time/) : null;
      if (numId) this.s(numId);
      const all = Object.values(ids).filter(Boolean), mOn = S.masterOn(this, all);
      return { ids, all, mOn, numId, mins: S.minsOf(h, numId), autoOn: !!ids.auto && mOn && S.isOn(this, ids.auto) };
    }
    render() {
      const c = this.config, hass = this.hass, A = M.garasjeAuto(hass, c);
      A.doors.forEach((id) => this.s(id));
      if (!A.doors.length) return `<div class="sk-wrap">${S.picker({ items: [], gear: 'Tilpass garasje' })}${this._hero(null)}${M.emptyState('Fant ingen garasjeport (cover.* med device_class: garage)', 'doors')}</div>`;
      const id = this._cur(A), x = doorInfo(hass, c, id);
      [x.light, x.motion].forEach((e) => e && this.s(e));
      const items = A.doors.map((d) => { const y = doorInfo(hass, c, d), m = this._mov(y), s = this._status(y, m); const col = m || s === 'part' ? Y : s === 'closed' ? G : s === 'open' ? O : GR; return { id: d, name: y.name, icon: s === 'closed' ? 'mdi:garage' : 'mdi:garage-open', state: m === 'up' ? 'Åpner …' : m === 'down' ? 'Lukker …' : this._lbl(y, s), col }; });
      const au = this._autos();
      const sec = [S.picker({ items, sel: id, gear: 'Tilpass garasje', mode: this._pickMode }), this._hero(x, au)];
      if (on(c, 'show_status')) sec.push(this._tiles(x));
      if (on(c, 'show_auto')) sec.push(this._auto(au));
      if (on(c, 'show_hist')) sec.push(this._hist(A));
      return `<div class="sk-wrap">${sec.join('')}</div>`;
    }
    _lbl(x, s) { return s === 'un' ? '–' : s === 'closed' ? 'Lukket' : s === 'open' ? 'Åpen' : x.pos != null ? `Åpen ${Math.round(x.pos)} %` : 'Delvis åpen'; }
    _lastBy(x, state) {
      const e = this._log && this._log.find((y) => y.id === x.id && y.state === state);
      if (!e) return '';
      const p = e.user ? S.person(this.hass, e.user) : null;
      return p ? p.name : S.method(this.hass, e, null, 'garage').label;
    }
    _hero(x, au) {
      const door = (pos, lit, slow) => `<div class="gp-door" data-key="gp-door"><div class="gp-open"><span class="gp-light" style="background:radial-gradient(80% 60% at 50% 0%, ${lit ? 'rgb(242 210 111 / 0.45)' : 'rgb(255 255 255 / 0.06)'} 0%, transparent 70%)"></span><span class="gp-car"></span><span class="gp-panel ${slow || ''}" style="height:${pos}%"></span></div></div>`;
      if (!x) return S.hero({ name: 'Garasje', state: '–', sub: 'Velg entitet', col: GR, gap: 14, right: door(100, false), bottom: this._ctl(null) });
      const mov = this._mov(x), s = this._status(x, mov), col = s === 'un' ? GR : mov || s === 'part' ? Y : s === 'closed' ? G : O;
      const lit = !!(x.light && S.isOn(this, x.light));
      let chip;
      if (s === 'un') chip = { text: 'Utilgjengelig', icon: 'mdi:lan-disconnect' };
      else if (mov) chip = { text: 'I bevegelse', icon: 'mdi:sync', blink: true };
      else if (s === 'closed') chip = { text: 'Sikret', icon: 'mdi:shield-check' };
      else if (au.autoOn && au.mins != null) { const left = Math.max(0, Math.ceil(au.mins - (Date.now() - new Date(x.st.last_changed).getTime()) / 60000)); chip = { text: `Lukkes om ${left} min`, icon: 'mdi:timer-outline' }; }
      else chip = { text: 'Står åpen', icon: 'mdi:timer-outline' };
      const state = s === 'un' ? '–' : mov === 'up' ? 'Åpner …' : mov === 'down' ? 'Lukker …' : this._lbl(x, s);
      let sub;
      if (s === 'un') sub = 'Utilgjengelig';
      else if (mov) sub = x.hasPos ? `${Math.round(x.pos)} % åpen` : 'Venter på porten';
      else { const by = this._lastBy(x, x.v); sub = `${s === 'closed' ? 'Lukket' : 'Åpnet'}${by ? ' av ' + by : ''} · ${S.when(new Date(x.st.last_changed).getTime())}`; }
      // Porten: høyde 100 − current_position %. Uten posisjon og i bevegelse glir den mot målet (langsom overgang).
      const pos = x.hasPos ? x.pos : mov === 'up' ? 100 : mov === 'down' ? 0 : s === 'closed' ? 0 : s === 'open' ? 100 : 50;
      return S.hero({ name: x.name, chip: { ...chip, col }, col, state, sub, gap: 14, right: door(100 - pos, lit, !x.hasPos && mov ? 'slow' : ''), bottom: this._ctl(x, mov, s) });
    }
    // Åpne · Stopp · Lukk (56 px, Stopp 64 px rund – rød mens porten går). Aktiv retning rosa. «To trykk»: Åpne oransje i 3 s.
    _ctl(x, mov, s) {
      const conf = CONF.some((k) => k[0] === this.config.open_confirm) ? this.config.open_confirm : 'ingen';
      const un = !x || s === 'un', armed = !!(x && this._arm && this._arm.id === x.id);
      const away = conf === 'borte' && !someoneHome(this.hass);
      const oDis = un || (s === 'open' && !mov) || away, cDis = un || (s === 'closed' && !mov);
      const big = (act, bg, dis) => (act ? `background:${bg};color:#232323;box-shadow:none` : `background:#2f2f2f;color:${dis ? '#696969' : '#fafafa'};box-shadow:inset 0 0 0 1px rgba(255,255,255,0.06)`);
      return `<div class="gp-ctl" data-key="gp-ctl">
        <button class="gp-b" ${x ? 'data-act="g-open" data-haptic="off"' : ''} style="${big(mov === 'up' || armed, armed ? O : PK, oDis)}" ${oDis ? 'aria-disabled="true"' : ''} title="${away ? 'Bare når noen er hjemme' : 'Åpne'}">${M.icon('mdi:arrow-up', 22)}Åpne</button>
        <button class="gp-stop" ${x ? 'data-act="g-stop" data-haptic="off"' : ''} title="Stopp" aria-label="Stopp" style="background:${mov ? R : '#2f2f2f'};color:${mov ? '#232323' : '#696969'};box-shadow:${mov ? 'none' : 'inset 0 0 0 1px rgba(255,255,255,0.06)'}" ${mov ? '' : 'aria-disabled="true"'}>${M.icon('mdi:stop', 24)}</button>
        <button class="gp-b" ${x ? 'data-act="g-close" data-haptic="off"' : ''} style="${big(mov === 'down', PK, cDis)}" ${cDis ? 'aria-disabled="true"' : ''}>${M.icon('mdi:arrow-down', 22)}Lukk</button></div>
        ${armed ? '<span class="gp-conf">Trykk «Åpne» igjen for å bekrefte</span>' : away && !un ? '<span class="gp-conf">Åpne er bare tilgjengelig når noen er hjemme</span>' : ''}`;
    }
    _tiles(x) {
      const h = this.hass, L = x.light && h.states[x.light], lit = !!(L && S.isOn(this, x.light)), mo = x.motion && h.states[x.motion], mov = this._mov(x), s = this._status(x, mov);
      const since = x.st ? Date.now() - new Date(x.st.last_changed).getTime() : null;
      return S.tiles([
        { icon: 'mdi:lightbulb', val: L && !M.unavailable(L) ? (lit ? 'På' : 'Av') : '–', label: 'Lys', col: lit ? Y : GR, tint: lit ? Y : null, act: L ? 'g-light' : null, id: x.light, ent: x.light },
        { icon: 'mdi:motion-sensor', val: mo && !M.unavailable(mo) ? (mo.state === 'on' ? 'Bevegelse' : 'Ingen') : '–', label: 'Bevegelse', col: mo && mo.state === 'on' ? O : GR, ent: x.motion },
        { icon: 'mdi:clock-outline', val: since == null || s === 'un' ? '–' : S.durS(since), label: s === 'closed' ? 'Lukket i' : 'Åpen i', col: s === 'closed' || s === 'un' ? GR : O },
      ]);
    }
    _auto(au) {
      const mOn = au.mOn, row = (k) => (au.ids[k] ? S.rowOn(this, au.ids[k], mOn) : false), n = au.all.length;
      const nOn = au.all.filter((id) => S.isOn(this, id)).length;
      const sub = !n ? 'Ingen automatikk funnet' : !mOn ? 'Av · ingen automatikk kjører' : `${nOn} av ${n} på${au.autoOn && au.mins != null ? ` · autolukk ${M.nf(au.mins)} min` : ''}`;
      const aOn = row('auto');
      return S.auto({ open: !!this.ui.amOpen, master: mOn, sub, rows: [
        { k: 'auto', icon: 'mdi:timer-outline', label: 'Autolukk', sub: aOn ? (au.mins != null ? `Lukker etter ${M.nf(au.mins)} min åpen` : 'Lukker porten automatisk') : 'Av', ent: au.ids.auto, on: aOn, mins: aOn && au.numId ? { opts: MINS, cur: au.mins } : null },
        { k: 'away', icon: 'mdi:walk', label: 'Lukk når alle drar', sub: 'Når siste person forlater hjemmet', ent: au.ids.away, on: row('away') },
        { k: 'arrive', icon: 'mdi:car-electric', label: 'Åpne når Tesla kommer', sub: 'Innen 150 m fra hjemmet', ent: au.ids.arrive, on: row('arrive') },
        { k: 'night', icon: 'mdi:bell-alert', label: 'Varsle hvis åpen etter 22:00', sub: 'Push med knapp for å lukke', ent: au.ids.night, on: row('night') },
      ] });
    }
    // Hendelser (nyeste først): Åpnet (med «Åpen i X»), Lukket og «Åpen etter 22:00» (porten stod åpen over kl. 22)
    _events(A) {
      const L = this._log;
      if (!L) return null;
      const h = this.hass, out = [];
      A.doors.forEach((id) => {
        const raw = L.filter((e) => e.id === id && (e.state === 'open' || e.state === 'closed'));
        const st = h.states[id];
        if (st && st.last_changed) { const t = new Date(st.last_changed).getTime(); if ((st.state === 'open' || st.state === 'closed') && t > (this._logT || 0) - 1000 && !raw.some((e) => e.state === st.state && Math.abs(e.t - t) < 5000)) raw.unshift({ id, state: st.state, t, user: (st.context && st.context.user_id) || null }); }
        const asc = raw.slice().sort((p, q) => p.t - q.t).filter((e, i, arr) => !i || arr[i - 1].state !== e.state);
        asc.forEach((e, i) => {
          if (e.state === 'open') {
            const nx = asc.slice(i + 1).find((y) => y.state === 'closed'), end = nx ? nx.t : Date.now();
            out.push({ ...e, kind: 'open', dur: nx ? `Åpen i ${S.dur(end - e.t)}` : 'Står åpen' });
            const d = new Date(e.t); d.setHours(22, 0, 0, 0);
            for (let w = d.getTime(); w < end; w += 86400000) if (w > e.t) out.push({ id, state: 'warn', t: w, kind: 'warn', close: nx || null, dur: nx ? 'Stod åpen – lukket' : 'Står fortsatt åpen' });
          } else out.push({ ...e, kind: 'close' });
        });
      });
      return out.sort((p, q) => q.t - p.t);
    }
    _hist(A) {
      const h = this.hass, evs = this._events(A);
      if (!evs) return S.history({ days: [], empty: 'Henter …' });
      const two = evs.filter((e) => e.t >= new Date(new Date().setHours(0, 0, 0, 0) - 86400000).getTime()); // I dag og I går
      const multi = A.doors.length > 1, T = { open: ['Åpnet', O], close: ['Lukket', G], warn: ['Åpen etter 22:00', R] };
      const days = S.groupDays(two, (e) => {
        const [ttl, col] = T[e.kind], src = e.kind === 'warn' ? e.close : e, m = src ? S.method(h, src, null, 'garage') : null;
        const name = doorInfo(h, this.config, e.id).name;
        return { key: `ev-${e.id}-${e.kind}-${e.t}`, type: e.kind, time: S.hm(e.t), title: multi ? `${ttl} · ${name}` : ttl, col, kind: e.kind === 'warn' ? 'warn' : 'dot', method: m ? { icon: m.icon, label: m.label } : null, extra: e.dur || '' };
      });
      const n = evs.filter((e) => e.kind === 'open' && S.isToday(e.t)).length;
      return S.history({ sum: `${n} åpning${n === 1 ? '' : 'er'} i dag`, days, empty: 'Ingen hendelser i dag eller i går' });
    }
    _setPend(id, want) {
      this._pend = this._pend || {};
      const old = this._pend[id];
      if (old) clearTimeout(old.tm);
      const p = { want, moved: false };
      p.tm = setTimeout(() => { if (!this._pend || this._pend[id] !== p || p.moved) return; delete this._pend[id]; M.haptic('warning'); M.toast(`Fikk ikke svar fra ${M.name(this.hass, id)} – rullet tilbake`); this.update(); }, S.SYNC_MS);
      this._pend[id] = p;
      this.update();
    }
    _disarm() { if (this._arm) { clearTimeout(this._arm.tm); this._arm = null; } }
    onAction(name, el, ev) {
      const d = el.dataset, h = this.hass, c = this.config;
      if (name === 'pick') { if (d.id && d.id !== this.ui.sel) { this._disarm(); this.setUI({ sel: d.id }); } return undefined; }
      if (name === 'am-open') return this.setUI({ amOpen: !this.ui.amOpen });
      if (name === 'am-master') { if (ev) ev.stopPropagation(); return S.master(this, this._autos().all); }
      if (name === 'am-row') { const id = this._autos().ids[d.k]; if (!id) return M.openEditor(this, { cardClass: this.constructor, focus: 'autos' }); return S.flip(this, id); }
      if (name === 'am-min') { const au = this._autos(); return au.numId ? S.setMins(h, au.numId, Number(d.v)) : undefined; }
      if (name === 'g-light') { if (d.id) S.flip(this, d.id); return undefined; }
      const A = M.garasjeAuto(h, c), id = this._cur(A);
      if (!id) return super.onAction(name, el, ev);
      const x = doorInfo(h, c, id), mov = this._mov(x), s = this._status(x, mov);
      if (name === 'g-open') {
        if (s === 'un' || mov === 'up' || (s === 'open' && !mov)) return undefined;
        const conf = c.open_confirm || 'ingen';
        if (conf === 'borte' && !someoneHome(h)) { M.haptic('warning'); this._toast('Åpne er bare tilgjengelig når noen er hjemme'); return undefined; }
        if (conf === 'to' && !(this._arm && this._arm.id === id)) {
          M.haptic('medium');
          this._disarm();
          this._arm = { id, tm: setTimeout(() => { this._arm = null; this.update(); }, 3000) };
          return this.update();
        }
        this._disarm();
        M.haptic('medium');
        this._setPend(id, 'up');
        return M.call(h, 'cover', 'open_cover', { entity_id: id }).catch(() => { if (this._pend) delete this._pend[id]; this.update(); });
      }
      if (name === 'g-close') {
        if (s === 'un' || mov === 'down' || (s === 'closed' && !mov)) return undefined;
        this._disarm();
        M.haptic('medium');
        this._setPend(id, 'down');
        return M.call(h, 'cover', 'close_cover', { entity_id: id }).catch(() => { if (this._pend) delete this._pend[id]; this.update(); });
      }
      if (name === 'g-stop') {
        if (!mov) return undefined;
        M.haptic('heavy');
        if (this._pend && this._pend[id]) { clearTimeout(this._pend[id].tm); delete this._pend[id]; }
        this._stopped = { id, t: Date.now() };
        M.call(h, 'cover', 'stop_cover', { entity_id: id }).catch(() => {});
        return this.update();
      }
      return super.onAction(name, el, ev);
    }
    get styles() {
      return `${S.CSS}
        .gp-door{position:relative;width:118px;height:104px;flex:none;border-radius:16px 16px 6px 6px;background:#2f2f2f;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.06);padding:10px 10px 0;box-sizing:border-box}
        .gp-open{position:relative;width:100%;height:100%;border-radius:8px 8px 0 0;overflow:hidden;background:#1a1a1a}
        .gp-light{position:absolute;inset:0;transition:background .4s}
        .gp-car{position:absolute;left:14px;right:14px;bottom:6px;height:22px;border-radius:10px 10px 4px 4px;background:#2a2a2a;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.05)}
        .gp-panel{position:absolute;left:0;right:0;top:0;background:repeating-linear-gradient(180deg,#5a5a5a 0px,#5a5a5a 12px,#454545 12px,#454545 14px);box-shadow:0 2px 0 #2a2a2a,0 6px 14px rgba(0,0,0,0.4);transition:height .6s linear}
        .gp-panel.slow{transition:height 14s linear}
        .gp-ctl{position:relative;display:grid;grid-template-columns:minmax(0,1fr) 64px minmax(0,1fr);gap:8px}
        .gp-b{height:56px;border-radius:28px;display:flex;align-items:center;justify-content:center;gap:6px;font-size:15px;font-weight:600;transition:background .2s,color .2s}
        .gp-b[aria-disabled="true"],.gp-stop[aria-disabled="true"]{cursor:default}
        .gp-stop{height:56px;width:64px;border-radius:28px;display:grid;place-items:center;transition:background .2s}
        .gp-b:not([aria-disabled="true"]):active,.gp-stop:not([aria-disabled="true"]):active{transform:scale(.97)}
        .gp-conf{position:relative;font-size:12px;color:var(--gray700,#979797);text-align:center;margin-top:-8px}
      `;
    }
  }

  /* ------------------------------------------------------------ «Tilpass garasje» (Port(er) · Seksjoner · Sikkerhet) */
  function openSheet(card, focus) {
    const tabs = () => [['doors', M.garasjeAuto(card.hass, (card._sheet && card._sheet.api.D()) || card.config).doors.length > 1 ? 'Porter' : 'Port'], ['secs', 'Seksjoner'], ['safe', 'Sikkerhet']];
    return S.sheet(card, {
      title: 'Tilpass garasje', tabs, tab: ['doors', 'secs', 'safe'].includes(focus) ? focus : 'doors',
      body(tab, D, api) {
        const h = card.hass;
        if (tab === 'doors') {
          const A = M.garasjeAuto(h, D);
          return `${A.doors.map((id) => {
            const x = doorInfo(h, D, id);
            return `<section class="sk-sec" data-key="gd-${esc(x.obj)}"><div class="sk-lhd">${M.icon('mdi:garage', 22, 'color:#afafaf')}<input class="sk-in" data-in="name" data-obj="${esc(x.obj)}" value="${esc(x.name)}" aria-label="Navn"></input></div>
              ${S.shEnt(api, { k: 'door:' + x.obj, icon: 'mdi:garage', label: 'Port', id, own: ((D.include || {}).porter || []).includes(id) ? id : '', auto: id, domains: 'cover' })}
              ${S.shEnt(api, { k: 'light:' + x.obj, icon: 'mdi:lightbulb', label: 'Lys', id: x.light, own: x.lightOwn, auto: x.lightAuto, domains: 'light,switch', noneLabel: 'Ingen lys' })}
              ${S.shEnt(api, { k: 'motion:' + x.obj, icon: 'mdi:motion-sensor', label: 'Bevegelse', id: x.motion, own: x.motionOwn, auto: x.motionAuto, domains: 'binary_sensor', deviceClass: 'motion,occupancy,presence', noneLabel: 'Ingen bevegelsessensor' })}</section>`;
          }).join('') || `<section class="sk-sec"><span class="sk-note">Fant ingen garasjeport.</span></section>`}
            <span class="sk-note">Portene finnes selv fra <code>cover.*</code> med <code>device_class: garage</code>. Lys og bevegelse hentes fra samme område. Én eller to porter støttes.</span>`;
        }
        if (tab === 'secs') return S.shSec('Seksjoner', [['show_status', 'mdi:view-grid-outline', 'Status · lys, bevegelse, tid'], ['show_auto', 'mdi:tune', 'Automatikk'], ['show_hist', 'mdi:history', 'Historikk']].map(([k, icon, label]) => S.shRow({ icon, label, on: on(D, k), attrs: `data-a="bool" data-k="${k}"` })).join(''), 'rows');
        const cf = CONF.some((k) => k[0] === D.open_confirm) ? D.open_confirm : 'ingen';
        return S.shSec('Åpne krever', `${S.shSeg(CONF, cf, (v) => `data-a="conf" data-v="${v}"`)}<span class="sk-note">${esc(CONF_NOTE[cf])}</span>`);
      },
      click(a, el, api) {
        const D = api.D();
        if (a === 'bool') { const k = el.dataset.k; return api.path(k, on(D, k) ? false : undefined, 'selection'); }
        if (a === 'conf') return api.path('open_confirm', el.dataset.v === 'ingen' ? undefined : el.dataset.v, 'selection');
        return undefined;
      },
      change(t, api) {
        if (t.dataset.in === 'name') { const obj = t.dataset.obj, st = card.hass.states['cover.' + obj], v = t.value.trim(); api.path(`doors_cfg.${obj}.name`, !v || (st && v === st.attributes.friendly_name) ? undefined : v); }
      },
      pick(t, v, api) {
        const [kind, obj] = String(t.dataset.pk).split(':'), D = api.D();
        if (kind === 'light' || kind === 'motion') return api.path(`doors_cfg.${obj}.${kind}`, v || undefined, 'selection');
        if (kind === 'door') {
          const old = 'cover.' + obj;
          if (!v || v === 'none' || v === old) return undefined;
          return api.set({ exclude: [...new Set([...(D.exclude || []).filter((x) => x !== v), old])], 'include.porter': [...new Set([...((D.include || {}).porter || []).filter((x) => x !== old), v])] }, 'selection');
        }
        return undefined;
      },
    });
  }

  if (M.POPUP_CARDS && !M.POPUP_CARDS.includes('msh-garasje-card')) M.POPUP_CARDS.push('msh-garasje-card'); // «Mellomrom» i editoren
  M.define('msh-garasje-card', Garasje, 'MSH Garasje', 'Garasje-popup (#garasje): portvelger, toppkort med portillustrasjon og Åpne/Stopp/Lukk, status, automatikk og historikk.');
  M.GARASJE_HASH = HASH;
})();
