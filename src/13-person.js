/* msh-person-hero-card + msh-person-card · Person-popup (#person-<id>). Kilde: Person.dc.html.
 * Person: config.person, ellers fra popupens hash #person-<slug> → person.<slug> (eller person med samme navn-slug).
 * Hero (eget kort, først): bilde fra entity_picture (ellers initial), sone-glorie/-merke, «Hjemme · <sted>», «siden hh:mm».
 * Hovedkort: nøkkeltall (skritt, reist, søvnscore) · søvn i natt · mobil · soner i dag.
 * Autokonfig: person.attributes.source/device_trackers → device_tracker → enhet (hass.entities/hass.devices) →
 * batteri, batteristatus/lading, tilkobling, SSID, skritt, distanse, fokus, geokodet sted (mobile_app-sensorer).
 * Søvn: sensorer med personens/enhetens navn + sleep/søvn i entity_id (varighet, score, start, stadier).
 * Historikk (sone-logg i dag, søvn 7 d) kun når popupen åpnes, cache 5 min.
 */
(function () {
  const M = window.MSH, esc = M.esc, C = M.C;
  const GRAY = 'var(--gray600,#7f7f7f)';
  const AV_COLS = [C.orange, C.pink, C.blue, C.green, C.purple, C.yellow];

  /* ------------------------------------------------------------ oppslag */
  M.personId = M.personId || function (card) {
    const c = card.config || {}, h = card.hass;
    if (c.person) return c.person;
    let hash = M.popupHash(card);
    if (!hash && /^#person-/.test(location.hash)) hash = location.hash;
    const m = /^#person-(.+)$/.exec(hash || '');
    if (!m || !h) return null;
    const slug = decodeURIComponent(m[1]);
    if (h.states['person.' + slug]) return 'person.' + slug;
    const f = M.all(h, 'person').find((id) => M.slug(M.name(h, id)) === M.slug(slug));
    return f || 'person.' + M.slug(slug);
  };

  const zoneKind = (name) => {
    const n = M.slug(name);
    if (/jobb|work|kontor|office/.test(n)) return ['work', C.blue];
    if (/skole|school|ntnu|uni|studie|barnehage/.test(n)) return ['school', C.orange];
    if (/hytte|cabin|cottage|landsted/.test(n)) return ['cottage', C.orange];
    return ['location_on', C.blue];
  };
  const zoneOf = (h, state) => Object.keys(h.states).find((id) => id.startsWith('zone.') && (h.states[id].attributes.friendly_name === state || id === 'zone.' + M.slug(state))) || null;
  const homeName = (h) => (h.config && h.config.location_name) || (h.states['zone.home'] && h.states['zone.home'].attributes.friendly_name) || 'Hjem';
  // Sone for en tilstand: [etikett, ikon, farge, sonenavn]
  M.zoneInfo = M.zoneInfo || function (h, state) {
    if (state == null || state === 'unavailable' || state === 'unknown') return ['Ukjent', 'help', GRAY, ''];
    if (state === 'home') return ['Hjemme', 'home', C.green, homeName(h)];
    if (state === 'not_home') return ['Borte', 'logout', C.purple, ''];
    const z = zoneOf(h, state), [ic, col] = zoneKind(state);
    const zi = z && h.states[z].attributes.icon;
    return [state, zi || ic, col, state];
  };
  const locality = (s) => {
    if (!s || M.unavailable(s)) return '';
    const a = s.attributes || {};
    return a.Locality || a.locality || a.City || a.city || a['Sub Locality'] || String(s.state).split(',').map((x) => x.trim()).filter(Boolean).slice(-3, -2)[0] || String(s.state).split(',')[0] || '';
  };
  const hm = (t) => { const d = new Date(t); return isNaN(d) ? '–' : M.pad(d.getHours()) + ':' + M.pad(d.getMinutes()); };
  const sinceTxt = (iso) => {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return d >= today ? hm(d) : d.toLocaleDateString('nb-NO', { weekday: 'short', day: 'numeric', month: 'short' }) + ' ' + hm(d);
  };
  const mins = (s) => {
    if (!s || !M.isNum(s.state)) return null;
    const v = Number(s.state), u = String(s.attributes.unit_of_measurement || '').toLowerCase();
    if (u === 'h' || u === 't' || u.startsWith('hour') || u.startsWith('time')) return v * 60;
    if (u === 's' || u.startsWith('sec') || u.startsWith('sek')) return v / 60;
    if (u === 'min' || u.startsWith('minut')) return v;
    if (u === 'd') return v * 1440;
    return v <= 24 ? v * 60 : v;
  };

  // Autokonfig av personens enhet og søvnsensorer.
  M.personAuto = M.personAuto || function (h, pid) {
    const out = { dev: null, tracker: null };
    const p = h && h.states[pid];
    if (!p) return out;
    const A = p.attributes || {};
    const trackers = [...new Set([].concat(A.source || [], A.device_trackers || []))];
    const E = h.entities || {}, D = h.devices || {};
    for (const t of trackers) {
      const e = E[t];
      if (e && e.device_id) { if (!out.dev || e.platform === 'mobile_app') { out.dev = e.device_id; out.tracker = t; } if (e.platform === 'mobile_app') break; }
      else if (!out.tracker && h.states[t]) out.tracker = t;
    }
    const ents = out.dev ? Object.keys(E).filter((id) => E[id].device_id === out.dev && h.states[id] && !E[id].disabled_by) : [];
    const find = (fn) => ents.find((id) => fn(id, h.states[id].attributes || {})) || null;
    out.battery = find((id, a) => id.startsWith('sensor.') && a.device_class === 'battery');
    out.battery_state = find((id) => id.startsWith('sensor.') && /battery_state|batteristatus|charger_type/.test(id));
    out.charging = find((id) => id.startsWith('binary_sensor.') && /charging|lader/.test(id));
    out.connection = find((id) => id.startsWith('sensor.') && /connection_type|network_type|tilkobling/.test(id));
    out.ssid = find((id) => id.startsWith('sensor.') && /_ssid$|wifi_connection|wi_fi_connection/.test(id));
    out.steps = find((id) => id.startsWith('sensor.') && /steps|skritt/.test(id));
    out.distance = find((id) => id.startsWith('sensor.') && /distance|distanse/.test(id));
    out.focus = find((id) => /focus|fokus|do_not_disturb/.test(id));
    out.location = find((id) => id.startsWith('sensor.') && /geocoded_location/.test(id));
    // søvn: sensorer med personens/enhetens navn i entity_id (én person i huset → alle sensorer)
    const dv = out.dev && D[out.dev];
    const keys = [pid.split('.')[1], M.slug(M.name(h, pid)), dv ? M.slug(dv.name_by_user || dv.name || '') : ''].filter((k) => k && k.length > 2);
    const sensors = Object.keys(h.states).filter((id) => id.startsWith('sensor.'));
    let pool = sensors.filter((id) => keys.some((k) => id.includes(k)));
    const persons = M.all(h, 'person').length;
    const sfind = (re, not) => { const hit = (arr) => arr.find((id) => re.test(id) && !(not && not.test(id))); return hit(pool) || (persons <= 1 ? hit(sensors) : null) || null; };
    const STG = /deep|light_sleep|lett|dyp|rem|awake|vaken|score/;
    out.sleep_score = sfind(/(sleep|sovn)_?score|sovnscore|sleep_quality/);
    out.sleep_duration = sfind(/total_sleep|sleep_duration|sleep_time|time_asleep|sovn_?varighet|sovn_?tid|_sleep$|_sovn$/, STG);
    out.sleep_start = sfind(/bedtime|sleep_start|sleep_onset|leggetid|sovn_?start|went_to_bed/);
    out.sleep_awake = sfind(/(awake|vaken)(_time|_duration|_tid)?$|time_awake/);
    out.sleep_light = sfind(/light_sleep|lett_?sovn|sovn_?lett/);
    out.sleep_deep = sfind(/deep_sleep|dyp_?sovn|sovn_?dyp/);
    out.sleep_rem = sfind(/rem_sleep|sovn_?rem|_rem(_duration|_tid)?$/);
    return out;
  };
  const FIELDS = [['battery', 'Batteri', 'sensor', 'battery'], ['battery_state', 'Batteristatus / lader', 'sensor'], ['charging', 'Lader (binær)', 'binary_sensor'], ['connection', 'Tilkoblingstype', 'sensor'], ['ssid', 'Wi-Fi (SSID)', 'sensor'], ['steps', 'Skritt', 'sensor'], ['distance', 'Distanse', 'sensor'], ['focus', 'Fokus', ['binary_sensor', 'sensor']], ['location', 'Geokodet sted', 'sensor'],
    ['sleep_duration', 'Søvn · varighet', 'sensor'], ['sleep_score', 'Søvn · score', 'sensor'], ['sleep_start', 'Søvn · leggetid (tidsstempel)', 'sensor'], ['sleep_awake', 'Søvn · våken', 'sensor'], ['sleep_light', 'Søvn · lett', 'sensor'], ['sleep_deep', 'Søvn · dyp', 'sensor'], ['sleep_rem', 'Søvn · REM', 'sensor']];
  const PERSON_FIELD = { type: 'entity', name: 'person', domain: 'person', label: 'Person', help: 'Tomt = fra popupens hash (#person-sebastian → person.sebastian)' };

  /* ------------------------------------------------------------ hero */
  class PersonHero extends M.Card {
    static get cardName() { return 'Person · toppkort'; }
    static get defaults() { return { show_picture: true }; }
    static get schema() {
      return [PERSON_FIELD,
        { type: 'text', name: 'name', label: 'Navn', auto: (h, c) => c.person && M.name(h, c.person) },
        { type: 'color', name: 'color', label: 'Avatarfarge (uten bilde)' },
        { type: 'boolean', name: 'show_picture', label: 'Vis bilde (entity_picture)', default: true },
        { type: 'overrides', label: 'Bytt sensor', fields: [{ name: 'location', label: 'Geokodet sted', domain: 'sensor', auto: (h, c) => c.person && M.personAuto(h, c.person).location }] },
      ];
    }
    get cardSize() { return 4; }
    render() {
      const c = this.config, h = this.hass, pid = M.personId(this), p = this.s(pid);
      const name = c.name || (p ? M.name(h, pid) : '–');
      const [zl, zi, zc] = M.zoneInfo(h, p && p.state);
      const auto = pid ? M.personAuto(h, pid) : {};
      const loc = this.s(M.pick(c, 'location', auto.location));
      const place = p ? (p.state === 'home' ? (locality(loc) || homeName(h)) : locality(loc) || (p.state !== 'not_home' && !M.unavailable(p) ? '' : '')) : '';
      const persons = M.all(h, 'person'), idx = Math.max(0, persons.indexOf(pid));
      const bg = M.color(c.color, AV_COLS[idx % AV_COLS.length]);
      const pic = c.show_picture !== false && p && p.attributes.entity_picture ? p.attributes.entity_picture : '';
      const away = p && p.state === 'not_home';
      const since = p && !M.unavailable(p) ? `${zl} siden ${sinceTxt(p.last_changed)}` : '';
      return `<section class="hero">
        <div class="av press" ${p ? `data-act="more" data-id="${esc(pid)}" data-ent="${esc(pid)}"` : 'data-act="customize"'} title="${esc(name)}">
          <div class="halo" style="box-shadow:0 0 0 2px ${M.alpha(zc, 0.55)},0 0 40px ${M.alpha(zc, 0.25)}"></div>
          <div class="img" style="background:${pic ? `center/cover no-repeat url('${esc(pic)}'), ${bg}` : bg};opacity:${away ? 0.75 : 1}">${pic ? '' : esc(p ? (name.trim()[0] || '?').toUpperCase() : '?')}</div>
          <span class="zb" style="color:${zc}">${M.icon(zi, 18)}</span>
        </div>
        <div class="txt">
          <div class="nm">${esc(name)}</div>
          <div class="zl"><span class="zd" style="background:${zc};box-shadow:0 0 10px ${zc}"></span>${esc(p ? zl + (place ? ' · ' + place : '') : 'Fant ingen person')}</div>
          ${since ? `<div class="since">${esc(since)}</div>` : ''}
          ${p ? '' : `<button class="pick press" data-act="customize">${M.icon('mdi:plus', 18)}Velg person</button>`}
        </div>
      </section>`;
    }
    get styles() {
      return `
        .hero{display:flex;flex-direction:column;align-items:center;gap:14px;padding:8px 0 0}
        .av{position:relative;width:132px;height:132px;flex:none}
        .halo{position:absolute;inset:-8px;border-radius:50%;transition:box-shadow .4s}
        .img{position:relative;width:132px;height:132px;border-radius:66px;display:grid;place-items:center;font-size:48px;font-weight:600;color:var(--white,#fafafa);overflow:hidden}
        .zb{position:absolute;right:0;bottom:4px;width:38px;height:38px;border-radius:19px;display:grid;place-items:center;background:var(--gray300,#404040);box-shadow:0 0 0 3px #282828}
        .txt{display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center}
        .nm{font-size:26px;font-weight:500;letter-spacing:-0.015em}
        .zl{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:500;color:var(--gray900,#c7c7c7)}
        .zd{width:8px;height:8px;border-radius:4px;flex:none}
        .since{font-size:13px;color:var(--gray600,#7f7f7f)}
        .pick{margin-top:6px}
      `;
    }
  }
  M.define('msh-person-hero-card', PersonHero, 'MSH Person · toppkort', 'Avatar (entity_picture), sone-glorie, sted og «siden». Første kort i #person-<id>.');

  /* ------------------------------------------------------------ hovedkort */
  const STAGES = [['awake', 'Våken', 'var(--gray600,#7f7f7f)', 35], ['light', 'Lett', C.blue, 60], ['deep', 'Dyp', C.purple, 100], ['rem', 'REM', C.purple, 80]];
  const SECS = [['stats', 'Nøkkeltall'], ['sleep', 'Søvn i natt'], ['mobil', 'Mobil'], ['zones', 'Soner i dag']];
  const ZCACHE = new Map();

  class Person extends M.Card {
    static get cardName() { return 'Person'; }
    static get defaults() { return {}; }
    static get schema() {
      return [PERSON_FIELD,
        { type: 'order', name: 'sections', hiddenName: 'hidden_sections', label: 'Seksjoner', options: SECS },
        { type: 'overrides', label: 'Bytt sensorer (mobil og søvn)', fields: FIELDS.map(([name, label, domain, dc]) => ({ name, label, domain, device_class: dc, auto: (h, c) => c.person && M.personAuto(h, c.person)[name] })) },
        { type: 'gap' },
      ];
    }
    get cardSize() { return 12; }
    _ents() {
      const pid = M.personId(this), a = pid ? M.personAuto(this.hass, pid) : {};
      const e = { pid, dev: a.dev, tracker: a.tracker };
      FIELDS.forEach(([f]) => { e[f] = M.pick(this.config, f, a[f]); });
      return e;
    }
    onOpen() { this._load(); }
    async _load() {
      const h = this.hass, e = this._ents();
      if (!e.pid || !h.states[e.pid]) return;
      if (e.sleep_duration) {
        const r = await M.history(h, [e.sleep_duration], 24 * 7);
        this._week = r[e.sleep_duration] || [];
      }
      const ck = e.pid, c0 = ZCACHE.get(ck);
      if (c0 && Date.now() - c0.t < 300000) this._zlog = c0.d;
      else if (h.callWS) {
        try {
          const now = new Date(), start = new Date(now); start.setHours(0, 0, 0, 0);
          const r = await h.callWS({ type: 'history/history_during_period', start_time: start.toISOString(), end_time: now.toISOString(), entity_ids: [e.pid], minimal_response: true, no_attributes: true, significant_changes_only: false });
          const pts = ((r && r[e.pid]) || []).map((p) => ({ s: p.s != null ? p.s : p.state, t: p.lu != null ? p.lu * 1000 : p.lc != null ? p.lc * 1000 : new Date(p.last_changed || p.last_updated).getTime() }));
          this._zlog = pts;
          ZCACHE.set(ck, { t: Date.now(), d: pts });
        } catch (x) { this._zlog = []; }
      }
      this.update();
    }
    _zoneLog(h, pid) {
      const pts = (this._zlog || []).slice();
      const cur = h.states[pid];
      if (cur && (!pts.length || pts[pts.length - 1].s !== cur.state)) pts.push({ s: cur.state, t: new Date(cur.last_changed).getTime() });
      const log = [];
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1].s, b = pts[i].s;
        if (a === b || M.unavailable({ state: b })) continue;
        const [, , cb, nb] = M.zoneInfo(h, b), [, , ca, na] = M.zoneInfo(h, a);
        if (b === 'home') log.push(['Kom hjem', homeName(h), pts[i].t, C.green]);
        else if (b === 'not_home') log.push([a === 'home' ? 'Forlot hjemmet' : 'Forlot ' + (na || a), a === 'home' ? homeName(h) : na, pts[i].t, a === 'home' ? C.purple : ca]);
        else {
          const nx = pts.slice(i + 1).find((q) => q.s !== b), dm = Math.round(((nx ? nx.t : Date.now()) - pts[i].t) / 60000);
          const dur = dm >= 60 ? `${Math.floor(dm / 60)} t ${dm % 60} min` : `${dm} min`;
          log.push(['Ankom ' + nb, nx ? `Var der ${dur}` : `Der nå · ${dur}`, pts[i].t, cb]);
        }
      }
      return log.reverse().slice(0, 8);
    }
    render() {
      const c = this.config, h = this.hass, e = this._ents(), p = this.s(e.pid);
      if (!p) return M.emptyState(e.pid ? `Fant ikke ${e.pid}` : 'Fant ingen person (person.*)', null);
      const keys = SECS.map((x) => x[0]);
      let order = Array.isArray(c.sections) ? c.sections.filter((k) => keys.includes(k)) : [];
      keys.forEach((k) => { if (!order.includes(k)) order.push(k); });
      const hid = new Set(c.hidden_sections || []);
      const out = order.filter((k) => !hid.has(k)).map((k) => this['_' + k](h, e, p)).join('');
      return `<div class="wrap">${out}</div>`;
    }
    _title(t, right) { return `<div class="sh"><div class="st">${esc(t)}</div>${right != null ? `<div class="sr num">${esc(right)}</div>` : ''}</div>`; }
    _stats(h, e) {
      const st = this.n(e.steps), ds = this.s(e.distance), sc = this.n(e.sleep_score);
      let dist = '–';
      if (ds && M.isNum(ds.state)) { const v = Number(ds.state), u = String(ds.attributes.unit_of_measurement || 'm'); const km = u === 'km' ? v : u === 'mi' ? v * 1.609 : v / 1000; dist = `${M.nf(km, km < 10 ? 1 : 0)} km`; }
      const tiles = [['directions_walk', st != null ? M.nf(st, 0) : '–', 'skritt', C.green, e.steps], ['mdi:map-marker-distance', dist, 'reist i dag', C.blue, e.distance], ['bedtime', sc != null ? M.nf(sc, 0) : '–', 'søvnscore', C.purple, e.sleep_score]];
      return `<section class="stats">${tiles.map(([ic, v, l, col, id]) => `<div class="tile" ${id ? `data-ent="${esc(id)}"` : ''}>${M.icon(ic, 20, `color:${col}`)}<div class="tv"><span class="v num">${esc(v)}</span><span class="l">${esc(l)}</span></div></div>`).join('')}</section>`;
    }
    _sleep(h, e) {
      const dur = mins(this.s(e.sleep_duration)), sc = this.n(e.sleep_score), s0 = this.s(e.sleep_start);
      const t0 = s0 && !M.unavailable(s0) ? new Date(s0.state).getTime() : NaN;
      const win = !isNaN(t0) ? `${hm(t0)}–${dur != null ? hm(t0 + dur * 60000) : '–'}` : '';
      const stage = { awake: mins(this.s(e.sleep_awake)), light: mins(this.s(e.sleep_light)), deep: mins(this.s(e.sleep_deep)), rem: mins(this.s(e.sleep_rem)) };
      const hasSt = Object.values(stage).some((v) => v != null && v > 0);
      const good = sc != null && sc >= 80, col = good ? C.green : C.orange;
      const chip = sc != null ? `<div class="sc" style="background:${M.alpha(col, 0.16)};color:${col}">${sc >= 80 ? 'God natt' : sc >= 70 ? 'Grei natt' : 'Urolig natt'}</div>` : '';
      const blocks = hasSt
        ? STAGES.filter(([k]) => stage[k] > 0).map(([k, , col2, ht]) => `<span style="flex:${stage[k].toFixed(1)};background:${col2};opacity:${k === 'awake' ? 0.5 : 1};height:${ht}%"></span>`).join('')
        : '<span style="flex:1;background:var(--gray200,#3a3a3a);height:100%"></span>';
      const legend = STAGES.map(([k, l, col2]) => `<span class="lg"><span class="ld" style="background:${col2}"></span>${l}<span class="lv num">${stage[k] != null ? M.nf(stage[k], 0) + ' min' : '–'}</span></span>`).join('');
      // 7 netter fra historikk (siste verdi per døgn), i natt uthevet
      const days = [];
      const s = this.s(e.sleep_duration), unit = s ? s.attributes.unit_of_measurement : '';
      for (let i = 6; i >= 0; i--) {
        const d0 = new Date(); d0.setHours(0, 0, 0, 0); d0.setDate(d0.getDate() - i);
        const d1 = d0.getTime() + 86400000;
        const pts = (this._week || []).filter((q) => q.t >= d0.getTime() && q.t < d1);
        const v = pts.length ? mins({ state: String(pts[pts.length - 1].v), attributes: { unit_of_measurement: unit } }) : i === 0 ? dur : null;
        days.push({ v, d: i === 0 ? 'i n' : d0.toLocaleDateString('nb-NO', { weekday: 'short' }).slice(0, 2) });
      }
      const wmax = Math.max(1, ...days.map((x) => x.v || 0));
      const week = days.map((x, i) => `<div class="wd"><div class="wb" style="height:${x.v ? Math.max(4, (x.v / wmax) * 100) : 4}%;background:${x.v ? (i === 6 ? C.purple : M.alpha(C.purple, 0.35)) : 'var(--gray200,#3a3a3a)'}"></div><span>${esc(x.d)}</span></div>`).join('');
      const hh = dur != null ? Math.floor(dur / 60) : null, mm = dur != null ? Math.round(dur % 60) : null;
      return `<section class="sleep" ${e.sleep_duration ? `data-ent="${esc(e.sleep_duration)}"` : ''}>
        ${this._title('Søvn i natt', win)}
        <div class="sb"><div class="big num">${hh != null ? hh : '–'}<span class="u"> t </span>${mm != null ? mm : '–'}<span class="u"> min</span></div>${chip}</div>
        <div class="blocks">${blocks}</div>
        <div class="legend">${legend}</div>
        <div class="week">${week}</div>
        ${!e.sleep_duration && !e.sleep_score ? `<button class="pick press" data-act="customize" data-section="overrides">${M.icon('mdi:plus', 18)}Velg søvnsensor</button>` : ''}
      </section>`;
    }
    _mobil(h, e, p) {
      if (!e.dev && !e.battery && !e.connection) return `<section class="mob">${this._title('Mobil')}${M.emptyState('Fant ingen mobil for ' + M.name(h, e.pid), 'overrides')}</section>`;
      const dev = e.dev && h.devices && h.devices[e.dev];
      const model = (dev && (dev.model || dev.name_by_user || dev.name)) || (e.tracker ? M.name(h, e.tracker) : 'Mobil');
      const bat = this.n(e.battery), bs = this.s(e.battery_state), ch = this.s(e.charging), cn = this.s(e.connection), fo = this.s(e.focus), tr = this.s(e.tracker);
      const charging = (ch && ch.state === 'on') || (bs && /^(charging|full|lader|fulladet|ac|usb|wireless)$/i.test(String(bs.state).trim()));
      const cs = cn ? String(cn.state) : '', wifi = /wi-?fi|wlan/i.test(cs), cell = /cellular|mobile|mobil|lte|5g|4g/i.test(cs);
      const net = cn && !M.unavailable(cn) ? (wifi ? 'Wi-Fi' : cell ? 'Mobildata' : cs) : '';
      const [zl] = M.zoneInfo(h, p.state);
      const sub = [charging ? 'Lader' : '', net, zl].filter(Boolean).join(' · ');
      const barCol = bat != null && bat < 20 ? C.red : charging ? C.green : 'var(--white,#fafafa)';
      const chips = [];
      if (bs || ch) chips.push([charging ? 'battery_charging_full' : 'battery_5_bar', charging ? 'Lader' : 'På batteri', e.charging || e.battery_state]);
      if (net) chips.push([wifi ? 'wifi' : 'signal_cellular_alt', net, e.connection]);
      if (fo && !M.unavailable(fo)) { const on = fo.state === 'on' || (fo.state !== 'off' && !/^off$/i.test(fo.state) && e.focus.startsWith('sensor.')); chips.push(['do_not_disturb_on', on ? 'Fokus på' : 'Fokus av', e.focus]); }
      if (tr) chips.push(['location_on', !M.unavailable(tr) && (tr.attributes.source_type === 'gps' || tr.attributes.latitude != null) ? 'Posisjon deles' : 'Posisjon av', e.tracker]);
      return `<section class="mob">
        ${this._title('Mobil')}
        <div class="phone" ${e.battery ? `data-ent="${esc(e.battery)}"` : ''}>
          <span class="pi">${M.icon('smartphone', 22)}</span>
          <div class="pc">
            <div class="pr"><span class="pm ell">${esc(model)}</span><span class="pb num">${bat != null ? M.nf(bat, 0) + ' %' : '–'}</span></div>
            <div class="bar"><div style="width:${bat != null ? M.clamp(bat, 0, 100) : 0}%;background:${barCol}"></div></div>
            <span class="ps">${esc(sub || '–')}</span>
          </div>
        </div>
        ${chips.length ? `<div class="chips">${chips.map(([ic, l, id]) => `<span class="chip" ${id ? `data-ent="${esc(id)}"` : ''}>${M.icon(ic, 16, 'color:var(--gray600,#7f7f7f)')}${esc(l)}</span>`).join('')}</div>` : ''}
      </section>`;
    }
    _zones(h, e) {
      const log = this._zoneLog(h, e.pid);
      const rows = log.map(([t, sub, time, col], i) => `<div class="zr" data-key="z${i}">
          <div class="zc"><span class="zdot" style="background:${col}"></span><span class="zline" style="background:${i < log.length - 1 ? 'rgba(255,255,255,0.1)' : 'transparent'}"></span></div>
          <div class="zt"><div class="zx"><div class="z1">${esc(t)}</div>${sub ? `<div class="z2">${esc(sub)}</div>` : ''}</div><div class="z3 num">${esc(hm(time))}</div></div>
        </div>`).join('');
      return `<section class="zones">${this._title('Soner i dag')}<div class="zl">${rows || `<div class="none">${this._zlog == null ? '–' : 'Ingen soneendringer i dag'}</div>`}</div></section>`;
    }
    get styles() {
      return `
        .wrap{display:flex;flex-direction:column;gap:var(--msh-gap,22px)}
        section{display:flex;flex-direction:column;gap:8px}
        .sh{display:flex;justify-content:space-between;align-items:baseline;padding:0 4px}
        .st{font-size:12px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;color:var(--gray600,#7f7f7f)}
        .sr{font-size:12px;color:var(--gray500,#696969)}
        .stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
        .tile{display:flex;flex-direction:column;gap:6px;padding:12px 14px;border-radius:18px;background:var(--gray200,#3a3a3a);min-width:0}
        .tv{display:flex;flex-direction:column;gap:1px;min-width:0}
        .tv .v{font-size:17px;font-weight:500;white-space:nowrap}
        .tv .l{font-size:11px;color:var(--gray600,#7f7f7f);white-space:nowrap}
        .sleep{gap:12px}
        .sb{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;padding:0 4px}
        .big{font-size:44px;font-weight:300;letter-spacing:-0.04em;line-height:1;white-space:nowrap}
        .big .u{font-size:15px;color:var(--gray600,#7f7f7f);letter-spacing:0}
        .sc{font-size:12px;font-weight:600;padding:5px 10px;border-radius:10px;white-space:nowrap}
        .blocks{display:flex;height:40px;border-radius:12px;overflow:hidden;gap:2px;align-items:flex-end}
        .blocks span{border-radius:4px;min-width:3px}
        .legend{display:flex;gap:14px;flex-wrap:wrap;padding:0 4px}
        .lg{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--gray700,#979797);white-space:nowrap}
        .ld{width:8px;height:8px;border-radius:4px}
        .lv{color:var(--gray500,#696969)}
        .week{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;height:64px;align-items:end;padding-top:6px}
        .wd{display:flex;flex-direction:column;align-items:center;gap:5px;height:100%;justify-content:flex-end}
        .wb{width:100%;max-width:26px;border-radius:6px}
        .wd span{font-size:10px;color:var(--gray500,#696969)}
        .sleep .pick{align-self:flex-start}
        .phone{display:flex;align-items:center;gap:14px;padding:14px 16px;border-radius:22px;background:var(--gray200,#3a3a3a)}
        .pi{width:40px;height:40px;border-radius:20px;background:var(--gray300,#404040);display:grid;place-items:center;flex:none}
        .pc{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px}
        .pr{display:flex;justify-content:space-between;gap:10px}
        .pm{font-size:14px;font-weight:500}
        .pb{font-size:13px;font-weight:500;flex:none}
        .bar{height:5px;border-radius:3px;background:var(--gray300,#404040);overflow:hidden}
        .bar>div{height:100%;border-radius:3px;transition:width .4s}
        .ps{font-size:12px;color:var(--gray600,#7f7f7f)}
        .chips{display:flex;gap:6px;flex-wrap:wrap}
        .chip{height:30px;padding:0 11px 0 8px;border-radius:15px;display:flex;align-items:center;gap:6px;font-size:12px;font-weight:500;background:var(--gray200,#3a3a3a);color:var(--gray800,#afafaf);white-space:nowrap}
        .zl{display:flex;flex-direction:column;padding-left:4px}
        .zr{display:flex;gap:14px;align-items:stretch}
        .zc{display:flex;flex-direction:column;align-items:center;width:10px;flex:none}
        .zdot{width:9px;height:9px;border-radius:5px;margin-top:5px;flex:none}
        .zline{flex:1;width:1px;margin-top:4px}
        .zt{flex:1;display:flex;justify-content:space-between;gap:12px;padding-bottom:14px;min-width:0}
        .zx{display:flex;flex-direction:column;gap:2px;min-width:0}
        .z1{font-size:14px}
        .z2,.z3{font-size:12px;color:var(--gray600,#7f7f7f)}
        .z3{flex:none}
        .none{padding:6px 0 4px;font-size:13px;color:var(--gray500,#696969)}
      `;
    }
  }
  M.define('msh-person-card', Person, 'MSH Person', 'Skritt, distanse, søvn, mobil (batteri/lading/nett) og soner i dag for én person. Legg msh-person-hero-card først.');
})();
