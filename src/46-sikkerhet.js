/* msh-sikkerhet-hero-card + msh-sikkerhet-card · popup #sikkerhet. Kilde: Sikkerhet v3.dc.html
 * Hero: sensorring + modus i kjernen + overskrift. Hovedkort: modusvelger (hold inne), «Krever oppmerksomhet»,
 * rom med sensorbrikker, siste hendelser, «Tilpass oppsett».
 * Autokonfig: første alarm_control_panel.*, alle lock.* og binary_sensor med device_class
 * door/window/garage_door/opening/motion/occupancy. Tastaturet portales ut av popupen (M.overlay, sentrert).
 */
(function () {
  const M = window.MSH, esc = M.esc, C = M.C;
  const GRAY9 = 'var(--gray900, #c7c7c7)';
  // [nøkkel, etikett, ikon, farge, tjeneste, tilstander, supported_features-bit]
  const MODES = [
    ['av', 'Av', 'remove_moderator', GRAY9, 'alarm_disarm', ['disarmed'], 0],
    ['hjemme', 'Hjemme', 'home', C.green, 'alarm_arm_home', ['armed_home'], 1],
    ['borte', 'Borte', 'shield_lock', C.orange, 'alarm_arm_away', ['armed_away', 'armed_vacation'], 2],
    ['natt', 'Natt', 'bedtime', C.blue, 'alarm_arm_night', ['armed_night'], 4],
  ];
  const TYPES = [['door', 'Dør', 'door_front'], ['window', 'Vindu', 'window'], ['lock', 'Lås', 'lock'], ['motion', 'Bevegelse', 'directions_walk'], ['presence', 'Tilstede', 'person']];
  const DC_TYPE = { door: 'door', garage_door: 'door', opening: 'door', window: 'window', motion: 'motion', occupancy: 'presence', presence: 'presence' };
  const AUTO_DC = ['door', 'window', 'garage_door', 'opening', 'motion', 'occupancy'];
  const WHO = { door: 'Dørsensor', window: 'Vindussensor', lock: 'Lås', motion: 'Bevegelsessensor', presence: 'Tilstedesensor' };
  const WORDS = { door: ['dør', 'dører'], window: ['vindu', 'vinduer'], lock: ['lås', 'låser'] };
  const plural = (k, one, many) => `${k} ${k === 1 ? one : many}`;
  const hm = (t) => { const d = new Date(t); return `${M.pad(d.getHours())}:${M.pad(d.getMinutes())}`; };
  const when = (t) => {
    if (!t || isNaN(t)) return '–';
    const d = new Date(t), now = new Date();
    if (d.toDateString() === now.toDateString()) return hm(t);
    if (d.toDateString() === new Date(now.getTime() - 86400000).toDateString()) return 'i går ' + hm(t);
    return d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' }) + ' ' + hm(t);
  };
  const guessType = (id) => {
    const n = id.split('.')[1] || id;
    if (id.startsWith('lock.')) return 'lock';
    if (/vindu|window/.test(n)) return 'window';
    if (/bevegelse|motion/.test(n)) return 'motion';
    if (/tilstede|presence|occupancy/.test(n)) return 'presence';
    return 'door';
  };
  const stripRoom = (name, room) => {
    if (!room) return name;
    const r = String(room).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const out = String(name).replace(new RegExp('^' + r + '\\s+', 'i'), '').replace(new RegExp('\\s+' + r + '$', 'i'), '').trim();
    return out ? out.charAt(0).toUpperCase() + out.slice(1) : name;
  };

  // Modus ut fra alarmens tilstand.
  M.sikMode = function (st) {
    if (!st || M.unavailable(st)) return null;
    const s = st.state, m = MODES.find((x) => x[5].includes(s));
    if (m) return { key: m[0], label: m[1], icon: m[2], color: m[3], armed: m[0] !== 'av' };
    const X = { triggered: ['Utløst', 'mdi:alarm-light', C.red], arming: ['Aktiveres', 'mdi:shield-sync', C.orange], pending: ['Venter', 'mdi:timer-sand', C.orange], disarming: ['Slås av', 'mdi:shield-sync', GRAY9], armed_custom_bypass: ['Egendefinert', 'mdi:shield-star', C.purple] }[s];
    return X ? { key: s, label: X[0], icon: X[1], color: X[2], armed: s !== 'disarming' } : { key: s, label: s, icon: 'shield', color: GRAY9, armed: true };
  };

  function battery(hass, id, st) {
    if (st.attributes.battery_level != null && M.isNum(st.attributes.battery_level)) return Math.round(Number(st.attributes.battery_level));
    const e = M.regEntry(hass, id);
    if (!e || !e.device_id || !hass.entities) return null;
    const b = Object.keys(hass.entities).find((x) => x.startsWith('sensor.') && hass.entities[x].device_id === e.device_id && hass.states[x] && hass.states[x].attributes.device_class === 'battery');
    return b && M.isNum(hass.states[b].state) ? Math.round(Number(hass.states[b].state)) : null;
  }

  // Autokonfig for sikkerhet: alarm + sensorliste (med overstyrt navn/type/rom fra config.sensors.<domene>.<objekt>).
  M.sikAuto = function (hass, cfg) {
    cfg = cfg || {};
    if (!hass) return { alarm: null, sensors: [], auto: [] };
    const alarm = M.pick(cfg, 'alarm', M.all(hass, 'alarm_control_panel')[0] || null);
    const auto = [...M.all(hass, 'lock'), ...M.all(hass, 'binary_sensor', (s) => AUTO_DC.includes(s.attributes.device_class))];
    const ids = M.applyLists(cfg, 'sensorer', auto).filter((id) => hass.states[id]);
    const order = M.areas(hass).map((a) => a.id);
    const sensors = ids.map((id) => {
      const st = hass.states[id], d = id.split('.')[0], obj = id.slice(d.length + 1);
      const o = (cfg.sensors && cfg.sensors[d] && cfg.sensors[d][obj]) || {};
      const autoType = d === 'lock' ? 'lock' : DC_TYPE[st.attributes.device_class] || guessType(id);
      const area = M.areaOf(hass, id), areaName = area ? M.areaName(hass, area) : null;
      const autoRoom = areaName || 'Annet';
      const autoName = stripRoom(st.attributes.friendly_name || obj.replace(/_/g, ' '), areaName);
      const type = TYPES.some((t) => t[0] === o.type) ? o.type : autoType;
      const un = M.unavailable(st);
      const on = !un && (d === 'lock' ? !['locked', 'locking'].includes(st.state) : st.state === 'on');
      return { id, domain: d, obj, st, type, autoType, room: o.room || autoRoom, autoRoom, name: o.name || autoName, autoName, on, un, bat: d === 'lock' ? battery(hass, id, st) : null, area, ai: area ? order.indexOf(area) : 999 };
    });
    sensors.sort((a, b) => (a.room === 'Annet') - (b.room === 'Annet') || a.ai - b.ai || a.room.localeCompare(b.room, 'nb') || TYPES.findIndex((t) => t[0] === a.type) - TYPES.findIndex((t) => t[0] === b.type) || a.name.localeCompare(b.name, 'nb'));
    return { alarm, sensors, auto };
  };
  const isAlert = (x) => (x.type === 'door' || x.type === 'window' || x.type === 'lock') && x.on;
  const iconOf = (x) => ({ door: x.on ? 'door_open' : 'door_front', window: x.on ? 'sensor_window' : 'window', lock: x.on ? 'lock_open' : 'lock', motion: x.on ? 'directions_run' : 'directions_walk', presence: 'person' })[x.type] || 'sensors';
  const colorOf = (x) => (isAlert(x) ? C.orange : x.on ? C.blue : null);
  const summary = (S) => {
    const alerts = S.filter(isAlert), motion = S.filter((x) => (x.type === 'motion' || x.type === 'presence') && x.on);
    const headline = alerts.length
      ? `${[...new Set(alerts.map((x) => x.type))].map((t) => plural(alerts.filter((x) => x.type === t).length, ...WORDS[t])).join(' og ')} ${alerts.every((x) => x.type === 'lock') ? 'er ulåst' : 'er åpen'}`
      : S.length ? 'Alt er lukket og låst' : 'Ingen sensorer';
    const subline = `${motion.length ? plural(motion.length, 'sensor', 'sensorer') + ' registrerer bevegelse' : 'Ingen bevegelse'} · ${Math.max(0, S.length - alerts.length - motion.length)} i ro`;
    return { alerts, motion, headline, subline };
  };

  // Felles skjemadeler (kortets egen tilpasning = HA GUI-editor).
  const alarmOverride = { type: 'overrides', label: 'Alarm', fields: [{ name: 'alarm', label: 'Alarmpanel', domain: 'alarm_control_panel', auto: (h) => M.all(h, 'alarm_control_panel')[0] || null }] };
  const sensorLists = { type: 'lists', label: 'Sensorer', lists: (h, c) => [{ key: 'sensorer', label: 'Sensorer og låser', ids: M.sikAuto(h, c).auto, domains: ['binary_sensor', 'lock'] }] };
  const sensorEdit = (h, c) => {
    let S = [];
    try { S = M.sikAuto(h, c).sensors; } catch (e) { S = []; }
    const rooms = [...new Set(S.map((x) => x.room))];
    return { type: 'section', label: 'Sensorer · navn, type og rom', icon: 'mdi:tag-edit-outline', id: 'sensor_names', fields: rooms.length ? rooms.map((room) => ({ type: 'section', label: `${room} · ${S.filter((x) => x.room === room).length}`, fields: S.filter((x) => x.room === room).flatMap((x) => {
      const b = `sensors.${x.domain}.${x.obj}`;
      return [
        { type: 'info', label: `${x.name} · ${x.id}` },
        { type: 'text', name: b + '.name', label: 'Navn', auto: () => x.autoName },
        { type: 'select', name: b + '.type', label: 'Type', options: TYPES.map((t) => [t[0], t[1]]), default: x.autoType },
        { type: 'text', name: b + '.room', label: 'Rom', auto: () => x.autoRoom },
      ];
    }) })) : [{ type: 'info', label: 'Autokonfig fant ingen sensorer' }] };
  };

  /* ================================================================ hero */
  class SikkerhetHero extends M.Card {
    static get cardName() { return 'Sikkerhet · sensorring'; }
    static get defaults() { return { show_ring: true }; }
    static get schema() {
      return (h, c) => [
        alarmOverride,
        sensorLists,
        sensorEdit(h, c),
        { type: 'section', label: 'Visning', icon: 'mdi:eye-outline', id: 'view', fields: [{ type: 'boolean', name: 'show_ring', label: 'Sensorring · stor ring med alle sensorer', default: true }] },
      ];
    }
    get cardSize() { return 6; }
    render() {
      const c = this.config, a = M.sikAuto(this.hass, c), S = a.sensors;
      S.forEach((x) => this.s(x.id));
      const al = this.s(a.alarm), mode = M.sikMode(al), armed = !!(mode && mode.armed);
      const { headline, subline } = summary(S);
      const n = S.length;
      const bars = n ? S : Array.from({ length: 24 }, () => null);
      const ring = c.show_ring === false ? '' : bars.map((x, i) => {
        const col = x ? colorOf(x) : null, deg = (360 / Math.max(bars.length, 1)) * i;
        const bg = col || (armed ? M.alpha(mode.color, 0.55) : 'var(--gray300, #404040)');
        return `<div class="bar" data-key="${esc(x ? x.id : 'p' + i)}" title="${esc(x ? `${x.room} · ${x.name}` : '')}" style="transform:rotate(${deg.toFixed(2)}deg) translateY(-110px);background:${bg};box-shadow:${col ? `0 0 14px ${M.alpha(col, 0.7)}` : 'none'}"></div>`;
      }).join('');
      const since = al && !M.unavailable(al) ? `${armed ? 'Aktivert' : 'Avslått'} ${when(new Date(al.last_changed).getTime())}` : al ? 'Utilgjengelig' : a.alarm ? 'Fant ikke alarmen' : 'Ingen alarm valgt';
      const core = armed ? `background:radial-gradient(circle at 50% 35%, ${M.alpha(mode.color, 0.16)}, var(--gray200, #3a3a3a) 70%)` : '';
      return `
        <section class="hero">
          <div class="ring ${c.show_ring === false ? 'noring' : ''}">
            ${ring}
            <button class="core" data-act="core" ${al ? `data-ent="${esc(a.alarm)}"` : ''} style="${core}">
              ${M.icon(mode ? mode.icon : 'mdi:shield-off-outline', 30, `color:${mode ? mode.color : 'var(--gray600, #7f7f7f)'}`)}
              <div class="ml">${esc(mode ? mode.label : '–')}</div>
              <div class="ms">${esc(since)}</div>
            </button>
          </div>
          <div class="txt">
            <div class="hl">${esc(headline)}</div>
            <div class="sl">${esc(n ? subline : 'Legg til sensorer i tilpasning')}</div>
          </div>
        </section>`;
    }
    onAction(name, el, ev) {
      if (name === 'core') {
        const a = M.sikAuto(this.hass, this.config);
        return a.alarm && this.hass.states[a.alarm] ? M.moreInfo(this, a.alarm) : this.customize('overrides');
      }
      return super.onAction(name, el, ev);
    }
    get styles() {
      return `
        .hero{display:flex;flex-direction:column;align-items:center;gap:20px;padding:4px 0 2px}
        .ring{position:relative;width:260px;height:260px;flex:none}
        .ring.noring{width:172px;height:172px}
        .ring.noring .core{inset:0}
        .bar{position:absolute;left:calc(50% - 4px);top:calc(50% - 16px);width:8px;height:32px;border-radius:4px;transition:background .4s,box-shadow .4s}
        .core{position:absolute;inset:44px;border-radius:50%;background:var(--gray200,#3a3a3a);box-shadow:inset 0 0 0 1px rgba(255,255,255,0.05);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;transition:background .4s,transform .15s}
        .core:active{transform:scale(.97)}
        .ml{font-size:26px;font-weight:500;letter-spacing:-0.02em}
        .ms{font-size:12px;color:var(--gray600,#7f7f7f)}
        .txt{display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center}
        .hl{font-size:24px;font-weight:500;letter-spacing:-0.015em;text-wrap:balance}
        .sl{font-size:14px;color:var(--gray600,#7f7f7f)}
      `;
    }
  }
  M.define('msh-sikkerhet-hero-card', SikkerhetHero, 'MSH Sikkerhet · sensorring', 'Toppkort for #sikkerhet: sensorring, alarmmodus og status. Legges først i popupen.');

  /* ================================================================ hovedkort */
  const PAD_CSS = `
    .bg{background:rgba(10,10,12,0.6);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
    .sh{left:16px;right:16px;padding:22px 20px 20px;border-radius:34px;background:var(--gray200,#3a3a3a);box-shadow:0 20px 50px rgba(0,0,0,0.55);scrollbar-width:none}
    .sh::-webkit-scrollbar{display:none}
    .pad{position:relative;display:flex;flex-direction:column;align-items:center;gap:16px}
    .x{position:absolute;top:-8px;right:-6px;width:40px;height:40px;border-radius:20px;background:var(--gray300,#404040);display:grid;place-items:center;color:var(--gray900,#c7c7c7)}
    .hd{display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center}
    .iw{width:56px;height:56px;border-radius:28px;display:grid;place-items:center}
    .tt{font-size:20px;font-weight:600}
    .msg{font-size:13px;color:var(--gray700,#979797)}
    .msg.err{color:var(--red,#f28073);font-weight:600}
    .dots{display:flex;gap:16px;height:16px;align-items:center;transition:transform .2s}
    .dots.err{animation:msh-shake .36s cubic-bezier(.36,.07,.19,.97)}
    .dot{width:14px;height:14px;border-radius:7px;box-shadow:inset 0 0 0 1.5px var(--gray600,#7f7f7f);transition:background .12s}
    .dot.on{background:var(--white,#fafafa);box-shadow:none}
    .dots.err .dot{background:var(--red,#f28073);box-shadow:none}
    .keys{display:grid;grid-template-columns:repeat(3,68px);gap:10px 20px}
    .k{width:68px;height:68px;border-radius:34px;display:grid;place-items:center;background:var(--gray300,#404040);color:var(--white,#fafafa);font-size:30px;font-weight:400;font-variant-numeric:tabular-nums;transition:transform .1s,background .1s;touch-action:manipulation}
    .k:active{transform:scale(0.92);background:var(--gray400,#545454)}
    .k.ic{background:transparent;color:var(--gray800,#afafaf)}
    .k.ic:active{background:var(--gray400,#545454)}
    button{font:inherit;color:inherit;border:0;background:none;padding:0;cursor:pointer;-webkit-tap-highlight-color:transparent}
    @keyframes msh-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(6px)}40%{transform:translateX(-6px)}60%{transform:translateX(4px)}80%{transform:translateX(-3px)}}
  `;

  class Sikkerhet extends M.Card {
    static get cardName() { return 'Sikkerhet'; }
    static get defaults() { return { code_for: 'alle', code_length: 4, show_alerts: true, show_log: true, toasts: true }; }
    static get schema() {
      return (h, c) => [
        alarmOverride,
        { type: 'section', label: 'Kode', icon: 'mdi:dialpad', id: 'code', fields: [
          { type: 'select', name: 'code_for', label: 'Krev kode', options: [['alle', 'Alle endringer'], ['av', 'Bare for å slå av'], ['aldri', 'Aldri']], default: 'alle' },
          { type: 'select', name: 'code_length', label: 'Kodelengde', options: [[4, '4 siffer'], [6, '6 siffer']], default: 4 },
          { type: 'info', label: 'Koden du taster sendes med alarm_control_panel.alarm_disarm / alarm_arm_* – den lagres ikke i dashbordet.' },
        ] },
        sensorLists,
        sensorEdit(h, c),
        { type: 'order', name: 'sections', hiddenName: 'hidden_sections', label: 'Rekkefølge på seksjoner', options: [['modes', 'Modus'], ['alerts', 'Krever oppmerksomhet'], ['rooms', 'Rom'], ['log', 'Siste hendelser'], ['edit', 'Tilpass-knapp']] },
        { type: 'section', label: 'Visning', icon: 'mdi:eye-outline', id: 'view', fields: [
          { type: 'boolean', name: 'show_alerts', label: 'Varsler · «Krever oppmerksomhet» øverst', default: true },
          { type: 'boolean', name: 'show_log', label: 'Siste hendelser · logg nederst', default: true },
          { type: 'select', name: 'sensor_view', label: 'Sensorer i rom', options: [['rows', 'Rader'], ['chips', 'Brikker']], default: 'rows' },
          { type: 'boolean', name: 'toasts', label: 'Bekreftelsesmeldinger (toast)', default: true },
        ] },
        { type: 'gap' },
      ];
    }
    get cardSize() { return 8; }
    onOpen() { this._loadLog(); }
    onClose() { if (this._ov) this._ov.close(); this._cancelHoldAnim(); }
    async _loadLog() {
      const a = M.sikAuto(this.hass, this.config);
      const ids = [a.alarm, ...a.sensors.map((x) => x.id)].filter(Boolean);
      if (!ids.length || !this.hass || !this.hass.callWS) return;
      try {
        const r = await this.hass.callWS({ type: 'logbook/get_events', start_time: new Date(Date.now() - 86400000).toISOString(), end_time: new Date().toISOString(), entity_ids: ids });
        this._log = (Array.isArray(r) ? r : []).filter((e) => e && e.entity_id && e.state != null && e.when != null)
          .map((e) => ({ id: e.entity_id, state: String(e.state), t: typeof e.when === 'number' ? e.when * 1000 : new Date(e.when).getTime(), user: e.context_user_id || null }));
        this._logT = Date.now();
      } catch (e) { this._log = []; this._logT = 0; }
      this.update();
    }
    _toast(t) { if (this.config.toasts !== false) M.toast(t); }
    _needCode(k, al) {
      const f = this.config.code_for || 'alle';
      if (!al || al.attributes.code_format == null || f === 'aldri') return false;
      if (f === 'av') return k === 'av';
      return k === 'av' || al.attributes.code_arm_required !== false || f === 'alle';
    }
    _supported(m, al) {
      if (!al || !m[6]) return !!al;
      const sf = al.attributes.supported_features;
      return sf == null || (Number(sf) & m[6]) !== 0;
    }
    // Én logglinje ut fra entitet + tilstand.
    _entry(a, S, id, state, t, user) {
      if (id === a.alarm) {
        const m = M.sikMode({ state }) || {};
        const text = state === 'disarmed' ? 'Alarm slått av' : state === 'triggered' ? 'Alarm utløst' : ['arming', 'pending', 'disarming'].includes(state) ? `Alarm ${m.label.toLowerCase()}` : `Alarm satt til ${m.label || state}`;
        const me = user && this.hass.user && user === this.hass.user.id;
        return { text, who: me ? 'Deg' : 'Alarmpanel', t, kind: state === 'triggered' ? 'alert' : 'mode' };
      }
      const x = S.find((y) => y.id === id);
      if (!x || ['unavailable', 'unknown'].includes(state)) return null;
      const place = x.room !== 'Annet' ? x.room : x.name;
      if (x.type === 'lock') {
        const T = { locked: ['låst', 'ok'], unlocked: ['låst opp', 'alert'], open: ['åpnet', 'alert'], jammed: ['har satt seg fast', 'alert'] }[state];
        return T ? { text: `${x.name === 'Lås' ? place : x.name} ${T[0]}`, who: WHO.lock, t, kind: T[1] } : null;
      }
      if (x.type === 'motion' || x.type === 'presence') return state === 'on' ? { text: x.type === 'motion' ? `Bevegelse i ${place.toLowerCase()}` : `Noen i ${place.toLowerCase()}`, who: WHO[x.type], t, kind: 'motion' } : null;
      return { text: `${place} ${state === 'on' ? 'åpnet' : 'lukket'}`, who: WHO[x.type] || 'Sensor', t, kind: state === 'on' ? 'alert' : 'ok' };
    }
    _events(a, S, al) {
      const raw = (this._log || []).slice();
      // Live endringer etter at loggen ble hentet (logbook feilet → siste døgn fra state).
      const since = this._logT ? this._logT - 1000 : Date.now() - 86400000;
      if (this._log) [al, ...S.map((x) => x.st)].forEach((st) => { const t = st && st.last_changed ? new Date(st.last_changed).getTime() : 0; if (t > since) raw.push({ id: st.entity_id, state: st.state, t }); });
      const seen = new Set(), out = [];
      raw.sort((x, y) => y.t - x.t).forEach((e) => {
        const k = `${e.id}|${e.state}|${Math.round(e.t / 2000)}`;
        if (seen.has(k)) return;
        seen.add(k);
        const en = this._entry(a, S, e.id, e.state, e.t, e.user);
        if (en) out.push(en);
      });
      return out.slice(0, 5);
    }
    render() {
      const c = this.config, a = M.sikAuto(this.hass, c), S = a.sensors;
      S.forEach((x) => this.s(x.id));
      const al = this.s(a.alarm), mode = M.sikMode(al);
      const dis = this.ui.dismiss || {};
      const { alerts } = summary(S);
      const shownAlerts = alerts.filter((x) => dis[x.id] !== x.st.last_changed);
      const hold = this._hold;
      const hint = hold ? `Hold for å sette ${MODES.find((m) => m[0] === hold.k)[1].toLowerCase()}…` : !al ? 'Ingen alarm valgt' : c.code_for === 'aldri' ? 'Hold inne for å bytte modus' : c.code_for === 'av' ? 'Hold inne for å bytte modus · kode for å slå av' : 'Hold inne for å bytte modus · krever kode';
      const codeNeeded = !!al && c.code_for !== 'aldri' && !(al && al.attributes.code_format == null);

      const sec = {};
      sec.modes = `
        <section class="sec modes-s">
          <div class="modes">${MODES.map((m) => {
            const act = mode && mode.key === m[0], holding = hold && hold.k === m[0], ok = this._supported(m, al);
            return `<button class="mode ${act ? 'act' : ''} ${ok ? '' : 'dis'}" data-mode="${m[0]}" data-key="m-${m[0]}" style="background:${act ? M.alpha(m[3], 0.18) : 'transparent'};box-shadow:${act ? `inset 0 0 0 1px ${M.alpha(m[3], 0.45)}` : 'none'};color:${act ? 'var(--white, #fafafa)' : 'var(--gray700, #979797)'}">
              <div class="fill" style="width:${holding ? (hold.p * 100).toFixed(1) : 0}%;background:${M.alpha(m[3], 0.28)}"></div>
              ${M.icon(m[2], 21, `position:relative;color:${act || holding ? m[3] : 'var(--gray700, #979797)'}`)}
              <span class="mlab">${m[1]}</span>
            </button>`;
          }).join('')}</div>
          <div class="hint">${codeNeeded ? M.icon('dialpad', 13) : ''}<span class="ht">${esc(hint)}</span></div>
          ${al ? '' : M.emptyState(a.alarm ? `Fant ikke ${a.alarm}` : 'Fant ingen alarm_control_panel', 'overrides')}
        </section>`;
      sec.alerts = c.show_alerts !== false && shownAlerts.length ? `
        <section class="sec">
          <div class="cap" style="color:${C.orange}">Krever oppmerksomhet</div>
          ${shownAlerts.map((x) => `
            <div class="alert" data-key="al-${esc(x.id)}" data-ent="${esc(x.id)}">
              ${M.icon(iconOf(x), 22, `color:${C.orange}`)}
              <div class="grow col" style="gap:2px"><div class="at">${esc(x.type === 'lock' ? `${x.name} er ulåst` : `${x.name} er ${x.type === 'window' ? 'åpent' : 'åpen'}`)}</div><div class="ar">${esc(x.room)}</div></div>
              <button class="fix press" data-act="fix" data-id="${esc(x.id)}" data-haptic="success" style="background:${C.orange}">${x.type === 'lock' ? 'Lås' : 'Merk lukket'}</button>
            </div>`).join('')}
        </section>` : '';
      const rooms = [...new Set(S.map((x) => x.room))];
      sec.rooms = `
        <section class="sec" style="gap:2px">
          <div class="rh"><div class="cap">Rom</div><div class="cnt">${S.length} ${S.length === 1 ? 'sensor' : 'sensorer'}</div></div>
          ${S.length ? rooms.map((room, i) => {
            const list = S.filter((x) => x.room === room), alr = list.some(isAlert), mv = list.some((x) => x.on && !isAlert(x));
            if (c.sensor_view !== 'chips') {
              // Universal-rader (07-universal.js): aktiv sensor → regel 1 med varselfarge som bakgrunn og mørk tekst
              return `<div class="room urm" data-key="r-${esc(room)}"><div class="rn"><span class="rd" style="background:${alr ? C.orange : mv ? C.blue : 'var(--gray400, #545454)'}"></span><span class="ell" style="font-size:14px;font-weight:500">${esc(room)}</span></div>
                <div class="ulst">${list.map((x) => {
                  const col = colorOf(x);
                  const val = x.un ? '–' : ({ door: x.on ? 'Åpen' : 'Lukket', window: x.on ? 'Åpent' : 'Lukket', lock: x.on ? 'Ulåst' : 'Låst', motion: x.on ? 'Bevegelse' : 'Stille', presence: x.on ? 'Noen her' : 'Stille' })[x.type] || (x.on ? 'På' : 'Av');
                  const alt = x.type === 'lock' && x.bat != null ? `${x.bat} %` : x.on && x.st && x.st.last_changed ? M.relTime(x.st.last_changed) : '';
                  return M.universal({ mode: 'sensor', size: 'small', entity: x.id, st: x.st, act: 'chip', key: 'u-' + x.id, icon: iconOf(x), main_text: val, sub_text: x.name, alt_text: alt,
                    state_rule_1_condition: !!col, state_rule_1_background_color: col, state_rule_1_text_color: 'var(--gray000)' });
                }).join('')}</div></div>`;
            }
            return `<div class="room" data-key="r-${esc(room)}" style="border-top:${i ? '1px solid rgba(255,255,255,0.05)' : 'none'}">
              <div class="rn"><span class="rd" style="background:${alr ? C.orange : mv ? C.blue : 'var(--gray400, #545454)'}"></span><span class="ell" style="font-size:14px;font-weight:500">${esc(room)}</span></div>
              <div class="chips">${list.map((x) => {
                const col = colorOf(x);
                const lab = x.un ? `${x.name} · –` : x.type === 'lock' && !x.on && x.bat != null ? `${x.name} · ${x.bat} %` : ({ door: x.on ? 'Åpen' : x.name, window: x.on ? 'Åpent' : x.name, lock: x.on ? `${x.name} ulåst` : x.name, motion: x.on ? 'Bevegelse nå' : x.name, presence: x.on ? 'Noen her' : x.name })[x.type] || x.name;
                return `<button class="chip press" data-act="chip" data-id="${esc(x.id)}" data-ent="${esc(x.id)}" data-key="${esc(x.id)}" style="background:${col ? M.alpha(col, 0.16) : 'var(--gray200, #3a3a3a)'};color:${col ? 'var(--white, #fafafa)' : 'var(--gray800, #afafaf)'};box-shadow:${col ? `inset 0 0 0 1px ${M.alpha(col, 0.4)}` : 'inset 0 0 0 1px rgba(255,255,255,0.04)'}">${M.icon(iconOf(x), 16, `color:${col || 'var(--gray600, #7f7f7f)'}`)}${esc(lab)}</button>`;
              }).join('')}</div>
            </div>`;
          }).join('') : M.emptyState('Fant ingen dør-, vindus- eller bevegelsessensorer', 'entities')}
        </section>`;
      if (c.show_log !== false) {
        const ev = this._events(a, S, al);
        sec.log = `
          <section class="sec">
            <div class="cap" style="padding:0 4px">Siste hendelser</div>
            <div class="log">${ev.length ? ev.map((e, i) => {
              const col = e.kind === 'alert' ? C.orange : e.kind === 'motion' ? C.blue : e.kind === 'mode' ? 'var(--white, #fafafa)' : C.green;
              return `<div class="ev" data-key="ev-${i}"><div class="evl"><span class="evd" style="background:${col}"></span><span class="evline" style="background:${i < ev.length - 1 ? 'rgba(255,255,255,0.1)' : 'transparent'}"></span></div>
                <div class="evb"><div class="col" style="gap:2px"><div style="font-size:14px">${esc(e.text)}</div><div class="evw">${esc(e.who)}</div></div><div class="evw num">${esc(when(e.t))}</div></div></div>`;
            }).join('') : `<div class="evw" style="padding:0 0 4px">${this._log ? 'Ingen hendelser siste døgn' : 'Henter …'}</div>`}</div>
          </section>`;
      }
      sec.edit = `<button class="own press" data-act="customize">${M.icon('tune', 20)}Tilpass oppsett</button>`;
      const keys = ['modes', 'alerts', 'rooms', 'log', 'edit'];
      let order = Array.isArray(c.sections) ? c.sections.filter((k) => keys.includes(k)) : [];
      keys.forEach((k) => { if (!order.includes(k)) order.push(k); });
      const hid = new Set(c.hidden_sections || []);
      return `<div class="wrap">${order.filter((k) => !hid.has(k)).map((k) => sec[k] || '').join('')}</div>`;
    }
    onAction(name, el, ev) {
      const d = el.dataset, h = this.hass;
      if (name === 'fix') {
        const a = M.sikAuto(h, this.config), x = a.sensors.find((y) => y.id === d.id);
        if (!x) return;
        if (x.type === 'lock') return M.call(h, 'lock', 'lock', { entity_id: x.id }).then(() => this._toast(`${x.name} låst`)).catch(() => {});
        return this.setUI({ dismiss: { ...(this.ui.dismiss || {}), [x.id]: x.st.last_changed } });
      }
      if (name === 'chip') {
        const a = M.sikAuto(h, this.config), x = a.sensors.find((y) => y.id === d.id);
        if (x && x.domain === 'lock' && !x.un) {
          const lock = x.st.state !== 'locked';
          return M.call(h, 'lock', lock ? 'lock' : 'unlock', { entity_id: x.id }).then(() => this._toast(`${x.name} ${lock ? 'låst' : 'låst opp'}`)).catch(() => {});
        }
        return M.moreInfo(this, d.id);
      }
      return super.onAction(name, el, ev);
    }
    afterRender() {
      this.shadowRoot.querySelectorAll('.mode').forEach((b) => {
        if (b.__b) return;
        b.__b = true;
        M.guardDrag(b, 'none');
        b.addEventListener('pointerdown', (e) => { if (e.button) return; this._startHold(b.dataset.mode); });
        ['pointerup', 'pointerleave', 'pointercancel'].forEach((t) => b.addEventListener(t, () => this._cancelHold()));
        b.addEventListener('contextmenu', (e) => e.preventDefault());
      });
    }
    /* ---------- hold inne for å bytte modus (900 ms) */
    _startHold(k) {
      const a = M.sikAuto(this.hass, this.config), al = this.hass.states[a.alarm], mode = M.sikMode(al), m = MODES.find((x) => x[0] === k);
      if (!al) { M.haptic('warning'); return this.customize('overrides'); }
      if (!m || (mode && mode.key === k)) return;
      if (!this._supported(m, al)) { M.haptic('failure'); return this._toast(`${m[1]} støttes ikke av alarmen`); }
      this._cancelHoldAnim();
      M.haptic('selection');
      const t0 = performance.now();
      this._hold = { k, p: 0 };
      const step = () => {
        if (!this._hold) return;
        const p = Math.min(1, (performance.now() - t0) / 900);
        this._hold.p = p;
        const b = this.shadowRoot.querySelector(`.mode[data-mode="${k}"]`);
        if (b) { b.querySelector('.fill').style.width = (p * 100).toFixed(1) + '%'; const ic = b.querySelector('ha-icon'); if (ic) ic.style.color = m[3]; }
        const ht = this.shadowRoot.querySelector('.ht');
        if (ht) ht.textContent = `Hold for å sette ${m[1].toLowerCase()}…`;
        if (p < 1) { this._rafH = requestAnimationFrame(step); return; }
        this._hold = null;
        this.update();
        if (this._needCode(k, al)) this._openPad(k);
        else this._apply(k);
      };
      this._rafH = requestAnimationFrame(step);
    }
    _cancelHoldAnim() { if (this._rafH) cancelAnimationFrame(this._rafH); this._rafH = 0; }
    _cancelHold() {
      if (!this._hold) return;
      this._cancelHoldAnim();
      this._hold = null;
      this.update();
    }
    async _apply(k, code) {
      const a = M.sikAuto(this.hass, this.config), m = MODES.find((x) => x[0] === k);
      if (!a.alarm || !m) return false;
      const data = { entity_id: a.alarm };
      if (code) data.code = code;
      try {
        await this.hass.callService('alarm_control_panel', m[4], data);
        M.haptic('success');
        this._toast(k === 'av' ? 'Alarm slått av' : `Alarm satt til ${m[1].toLowerCase()}`);
        return true;
      } catch (e) {
        M.haptic('failure');
        if (!code) M.toast('Feil: ' + (e && e.message ? e.message : e));
        return false;
      }
    }
    /* ---------- tastatur (portalert overlegg, sentrert i dashbordflaten) */
    _openPad(k) {
      if (this._ov) this._ov.close();
      this._pad = { k, entry: '', err: false };
      const ov = M.overlay({ center: true, maxWidth: 360, css: PAD_CSS, html: '', onClose: () => { this._pad = null; this._ov = null; window.removeEventListener('keydown', onKey); } });
      this._ov = ov;
      const onKey = (e) => {
        if (!this._pad) return;
        if (/^[0-9]$/.test(e.key)) { M.haptic('selection'); this._press(e.key); } else if (e.key === 'Backspace') { M.haptic('selection'); this._pad.entry = this._pad.entry.slice(0, -1); this._padRender(); }
      };
      window.addEventListener('keydown', onKey);
      ov.root.addEventListener('click', (e) => {
        const b = e.composedPath().find((n) => n.dataset && n.dataset.k);
        if (!b) return;
        const key = b.dataset.k;
        if (key === 'close') { M.haptic('light'); return ov.close(); }
        M.haptic('selection');
        if (key === 'backspace') { if (this._pad && !this._pad.err) { this._pad.entry = this._pad.entry.slice(0, -1); this._padRender(); } return; }
        this._press(key);
      });
      this._padRender();
    }
    _press(d) {
      const p = this._pad;
      if (!p || p.err || p.busy) return;
      const len = Number(this.config.code_length) || 4;
      p.entry = (p.entry + d).slice(0, len);
      this._padRender();
      if (p.entry.length === len) {
        p.busy = true;
        setTimeout(async () => {
          const ok = await this._apply(p.k, p.entry);
          p.busy = false;
          if (ok) { if (this._ov) this._ov.close(); return; }
          p.err = true;
          this._padRender();
          setTimeout(() => { if (this._pad === p) { p.err = false; p.entry = ''; this._padRender(); } }, 900);
        }, 120);
      }
    }
    _padRender() {
      const p = this._pad, ov = this._ov;
      if (!p || !ov) return;
      const m = MODES.find((x) => x[0] === p.k), len = Number(this.config.code_length) || 4;
      const html = `<div class="pad">
        <button class="x" data-k="close" title="Lukk">${M.icon('close', 22)}</button>
        <div class="hd">
          <span class="iw" style="background:${M.alpha(m[3], 0.2)};color:${m[3]}">${M.icon(m[2], 28)}</span>
          <span class="tt">${p.k === 'av' ? 'Slå av alarmen' : `Sett alarm til ${m[1].toLowerCase()}`}</span>
          <span class="msg ${p.err ? 'err' : ''}">${p.err ? 'Feil kode – prøv igjen' : `Skriv inn ${len}-sifret kode`}</span>
        </div>
        <div class="dots ${p.err ? 'err' : ''}">${Array.from({ length: len }, (_, i) => `<span class="dot ${i < p.entry.length ? 'on' : ''}"></span>`).join('')}</div>
        <div class="keys">${['1', '2', '3', '4', '5', '6', '7', '8', '9', 'close', '0', 'backspace'].map((k) => {
          const ic = k === 'close' || k === 'backspace';
          return `<button class="k ${ic ? 'ic' : ''}" data-k="${k}" title="${k === 'close' ? 'Avbryt' : k === 'backspace' ? 'Slett' : k}">${ic ? M.icon(k, 26) : k}</button>`;
        }).join('')}</div>
      </div>`;
      M.morph(ov.body, html);
    }
    get styles() {
      return `
        .wrap{display:flex;flex-direction:column;gap:var(--msh-gap, 22px)}
        .sec{display:flex;flex-direction:column;gap:8px}
        .modes{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;padding:5px;border-radius:22px;background:var(--gray200,#3a3a3a)}
        .mode{position:relative;overflow:hidden;height:64px;border-radius:17px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;touch-action:none;user-select:none;-webkit-user-select:none;transition:background .25s}
        .mode.dis{opacity:.35}
        .fill{position:absolute;left:0;top:0;bottom:0}
        .mlab{position:relative;font-size:12px;font-weight:500}
        .hint{display:flex;align-items:center;justify-content:center;gap:4px;font-size:11px;color:var(--gray500,#696969);text-align:center}
        .cap{font-size:12px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;color:var(--gray600,#7f7f7f);padding:0 4px}
        .alert{display:flex;align-items:center;gap:12px;padding:12px 12px 12px 14px;border-radius:20px;background:${M.alpha(C.orange, 0.12)};box-shadow:inset 0 0 0 1px ${M.alpha(C.orange, 0.35)}}
        .at{font-size:15px;font-weight:500}
        .ar{font-size:12px;color:var(--gray800,#afafaf)}
        .fix{height:36px;padding:0 14px;border-radius:18px;color:#282828;font-size:13px;font-weight:600;white-space:nowrap;flex:none}
        .rh{display:flex;justify-content:space-between;align-items:baseline;padding:0 0 8px}
        .cnt{font-size:12px;color:var(--gray500,#696969);white-space:nowrap;padding-right:4px}
        .room{display:flex;align-items:flex-start;gap:10px;padding:10px 4px}
        .rn{display:flex;align-items:center;gap:8px;flex:1;min-width:0;padding-top:7px}
        .rd{width:7px;height:7px;border-radius:4px;flex:none}
        .chips{flex:none;max-width:62%;display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end}
        .chip{height:32px;padding:0 11px 0 8px;border-radius:16px;display:flex;align-items:center;gap:6px;font-size:12px;font-weight:500;white-space:nowrap;transition:background .2s}
        .urm{flex-direction:column;align-items:stretch;gap:8px;padding:6px 0}
        .urm .rn{padding:0 4px}
        .ulst{display:flex;flex-direction:column;gap:8px}
        ${M.UNIVERSAL_CSS || ''}
        .log{display:flex;flex-direction:column;padding-left:4px}
        .ev{display:flex;gap:14px;align-items:stretch}
        .evl{display:flex;flex-direction:column;align-items:center;width:10px;flex:none}
        .evd{width:9px;height:9px;border-radius:5px;margin-top:5px;flex:none}
        .evline{flex:1;width:1px;margin-top:4px}
        .evb{flex:1;display:flex;justify-content:space-between;gap:12px;padding-bottom:14px}
        .evw{font-size:12px;color:var(--gray600,#7f7f7f)}
        .own{width:100%;height:52px;border-radius:26px;background:var(--gray200,#3a3a3a);display:flex;align-items:center;justify-content:center;gap:8px;font-size:15px;font-weight:500}
      `;
    }
  }
  M.define('msh-sikkerhet-card', Sikkerhet, 'MSH Sikkerhet', 'Alarmmodus (hold inne, kode via tastatur), varsler, sensorer per rom og siste hendelser. #sikkerhet');
})();
