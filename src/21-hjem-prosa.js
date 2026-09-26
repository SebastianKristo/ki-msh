/* msh-prosa-card · Hjem-visningen, prosa-kortet. Kilde: Hjem v2.dc.html (prose, DEF_PROSE, SRC/ACTS/TOK/OPS,
 * runAct, custEditVals → «Tekst»-fanen). Live verdier i chips, handling per chip, betingelser («Når»).
 * Autokonfig: weather.* (første), sensor.hele_huset_effekt / _lys (KI Rom), strømpris (plattform nordpool/tibber),
 * person.*, lock.*, alarm_control_panel.*, calendar.*, todo.*, søppel-sensor. Standardprosaen bygges bare av
 * det som faktisk finnes.
 */
(function () {
  const M = window.MSH, esc = M.esc, C = M.C;
  const PINK = C.accent;
  const TOK = { 'vær': 'weather', temp: 'temp', pris: 'price', watt: 'watt', lys: 'lights', hendelser: 'events', hjemme: 'home', 'lås': 'lock', alarm: 'alarm', 'søppel': 'trash', 'gjøremål': 'todo' };
  const SRC = [['none', 'Ingen boble'], ['text', 'Fast tekst'], ['weather', 'Vær'], ['temp', 'Ute-temp'], ['price', 'Strømpris'], ['watt', 'Effekt'], ['lights', 'Lys på'], ['events', 'Hendelser'], ['home', 'Hjemme'], ['lock', 'Dørlås'], ['alarm', 'Alarm'], ['trash', 'Søppel'], ['todo', 'Gjøremål'], ['custom', 'Egendefinert']];
  const ACTS = [['', 'Ingen'], ['more', 'Vis detaljer'], ['lock_toggle', 'Veksle dørlås'], ['lock', 'Lås dør'], ['unlock', 'Lås opp'], ['alarm_toggle', 'Veksle alarm'], ['alarm_on', 'Armer alarm'], ['alarm_off', 'Slå av alarm'], ['lights_on', 'Alle lys på'], ['lights_off', 'Alle lys av'], ['garage_toggle', 'Veksle garasjeport'], ['tv_toggle', 'Veksle TV'], ['vac_toggle', 'Pause/start støvsuger'], ['service', 'Egendefinert tjeneste']];
  const OPS = [['alltid', 'Alltid'], ['>', 'Over'], ['<', 'Under'], ['=', 'Er'], ['!=', 'Er ikke']];
  const ICONS = [['', 'Ingen'], ['dot', '● Prikk'], ['💡', '💡'], ['⏰', '⏰'], ['🌤️', '🌤️'], ['⚡', '⚡'], ['🔒', '🔒'], ['🚨', '🚨'], ['🗑️', '🗑️'], ['🏠', '🏠'], ['👋', '👋']];
  const PCOL = { hvit: C.white, gronn: C.green, gul: C.yellow, oransje: C.orange, rod: C.red, bla: C.blue, rosa: C.pink };
  const PSW = [['hvit', C.white, 'Hvit'], ['auto', `conic-gradient(${C.green}, ${C.yellow}, ${C.red}, ${C.green})`, 'Auto etter verdi'], ['gronn', C.green, 'Grønn'], ['gul', C.yellow, 'Gul'], ['oransje', C.orange, 'Oransje'], ['rod', C.red, 'Rød'], ['bla', C.blue, 'Blå'], ['rosa', C.pink, 'Rosa']];
  const LINKS = [['', 'Ingen'], ['lock', 'Dørlås (hurtig)'], ['#vaer', 'Vær'], ['#lys', 'Lys'], ['#sikkerhet', 'Sikkerhet'], ['#kamera', 'Kamera'], ['#klima', 'Klima'], ['#gjoremal', 'Gjøremål'], ['#soppel', 'Søppel'], ['#vanning', 'Vanning'], ['#media', 'Media'], ['#basseng', 'Basseng'], ['#ruter', 'Ruter'], ['#strom', 'Strøm']];
  const srcL = (id) => (SRC.find((x) => x[0] === id) || ['', id || ''])[1];
  const nb = (n, d) => M.nf(n, d);
  const pnum = (v) => parseFloat(String(v == null ? '' : v).replace(',', '.'));

  // Kalenderhendelser i dag (hentes sjelden, deles mellom kort).
  const EV = { t: 0, n: null, busy: false, key: '' };
  function loadEvents(hass, ids, done) {
    const key = ids.join(',');
    if (!hass || !hass.callApi || !ids.length || EV.busy || (EV.key === key && Date.now() - EV.t < 15 * 60000)) return;
    EV.busy = true;
    const s = new Date(); s.setHours(0, 0, 0, 0);
    const e = new Date(s.getTime() + 86400000);
    Promise.all(ids.map((id) => hass.callApi('GET', `calendars/${id}?start=${encodeURIComponent(s.toISOString())}&end=${encodeURIComponent(e.toISOString())}`).catch(() => [])))
      .then((r) => { EV.n = r.reduce((t, l) => t + (Array.isArray(l) ? l.length : 0), 0); })
      .finally(() => { EV.busy = false; EV.t = Date.now(); EV.key = key; done && done(); });
  }

  // Autokonfig per kilde. Returnerer entitets-ID (eller liste) for hver kilde.
  const AUTO = {
    weather: (h) => M.all(h, 'weather')[0] || null,
    temp: () => null, // standard: temperaturen fra vær-entiteten
    price: (h) => M.byPlatform(h, 'nordpool', 'sensor')[0] || M.byPlatform(h, 'tibber', 'sensor').find((id) => /pris|price/.test(id) || /\/kWh/i.test(h.states[id].attributes.unit_of_measurement || '')) || null,
    watt: (h) => M.kiRomId(h, null, 'effekt') || null,
    lights: (h) => M.kiRomId(h, null, 'lys') || null,
    lock: (h) => M.all(h, 'lock')[0] || null,
    alarm: (h) => M.all(h, 'alarm_control_panel')[0] || null,
    trash: (h) => (M.hjemTrashAuto ? M.hjemTrashAuto(h) : null),
  };
  const ents = (h, c) => {
    const o = {};
    Object.keys(AUTO).forEach((k) => { o[k] = M.pick(c, k, AUTO[k](h)); });
    o.calendars = M.applyLists(c, 'kalendere', M.all(h, 'calendar'));
    o.todos = M.applyLists(c, 'lister', M.all(h, 'todo'));
    o.persons = M.all(h, 'person');
    return o;
  };
  M.hjemProseEnts = ents;

  // Kildeverdier: key → [tekst, tall, farge, entity_id]
  function sources(h, c, rd) {
    rd = rd || ((id) => h.states[id]);
    const E = ents(h, c), S = {};
    const lvlP = (p) => (p > (Number(c.price_high) || 1.5) ? C.red : p > (Number(c.price_mid) || 1.1) ? C.yellow : C.green);
    const w = E.weather && rd(E.weather);
    if (w && !M.unavailable(w)) {
      const t = w.attributes.temperature;
      S.weather = [`${M.hjemCond(w.state).toLowerCase()}${t != null ? ' og ' + nb(Number(t), 1) + '°' : ''}`, t != null ? Number(t) : null, null, E.weather];
    }
    const ts = E.temp && rd(E.temp);
    if (ts && M.isNum(ts.state)) S.temp = [`${nb(Number(ts.state), 1)}°`, Number(ts.state), null, E.temp];
    else if (w && w.attributes.temperature != null) S.temp = [`${nb(Number(w.attributes.temperature), 1)}°`, Number(w.attributes.temperature), null, E.weather];
    const p = E.price && rd(E.price);
    if (p && M.isNum(p.state)) { const v = Number(p.state); S.price = [`${nb(v, 2)} kr`, v, lvlP(v), E.price]; }
    const wt = E.watt && rd(E.watt);
    if (wt && M.isNum(wt.state)) { const v = Number(wt.state); S.watt = [`${nb(v, 0)} W`, v, v > 3000 ? C.red : v > 1500 ? C.yellow : C.green, E.watt]; }
    const ls = E.lights && rd(E.lights);
    if (ls && M.isNum(ls.state)) { const v = Number(ls.state); S.lights = [`${v} lys`, v, C.orange, E.lights]; }
    else {
      const all = M.all(h, 'light');
      if (all.length) { const v = all.filter((id) => { const s = rd(id); return s && s.state === 'on'; }).length; S.lights = [`${v} lys`, v, C.orange, null]; }
    }
    if (E.calendars.length) { const n = EV.n; S.events = [n == null ? '– hendelser' : `${n} ${n === 1 ? 'hendelse' : 'hendelser'}`, n, C.blue, E.calendars[0]]; }
    if (E.persons.length) { const n = E.persons.filter((id) => { const s = rd(id); return s && s.state === 'home'; }).length; S.home = [`${n} hjemme`, n, C.green, E.persons[0]]; }
    const lk = E.lock && rd(E.lock);
    if (lk) { const L = lk.state === 'locked'; S.lock = [L ? 'låst' : lk.state === 'jammed' ? 'fastlåst' : M.unavailable(lk) ? '–' : 'ulåst', L ? 1 : 0, L ? C.green : C.orange, E.lock]; }
    const al = E.alarm && rd(E.alarm);
    if (al) {
      const st = al.state, armed = /^armed/.test(st);
      const T = { disarmed: 'av', triggered: 'utløst', arming: 'armerer', pending: 'venter', disarming: 'slås av' };
      S.alarm = [armed ? 'armert' : T[st] || (M.unavailable(al) ? '–' : st), armed ? 1 : 0, armed ? C.pink : st === 'triggered' ? C.red : null, E.alarm];
    }
    const tr = E.trash && rd(E.trash);
    if (tr) { const d = M.hjemTrashDays(tr); S.trash = [d == null ? '–' : d === 0 ? 'i dag' : d === 1 ? 'i morgen' : `${d} dager`, d, d != null && d <= 1 ? C.orange : null, E.trash]; }
    if (E.todos.length) { const n = E.todos.reduce((t, id) => { const s = rd(id); return t + (s && M.isNum(s.state) ? Number(s.state) : 0); }, 0); S.todo = [`${n} gjøremål`, n, null, E.todos[0]]; }
    return S;
  }

  // {nøkkel}: kilde, TOK-alias, <område>.temp/.fukt/.lys, <person>.hjemme/.sover, eller entity_id.
  function getter(h, c, S, rd) {
    rd = rd || ((id) => h.states[id]);
    return (k) => {
      k = String(k || '').trim();
      if (S[k]) return S[k];
      if (TOK[k] && S[TOK[k]]) return S[TOK[k]];
      if (/^[a-z_]+\.[a-z0-9_]+$/.test(k) && h.states[k]) { const s = rd(k); return [M.fmtState(h, k), M.isNum(s.state) ? Number(s.state) : M.isOn(s) ? 1 : 0, null, k]; }
      const m = /^([a-z0-9_]+)\.(temp|fukt|lys|mål|hjemme|sover)$/.exec(k);
      if (!m) return null;
      const [, a, f] = m;
      if (h.states['person.' + a] && (f === 'hjemme' || f === 'sover')) {
        const P = M.hjemPersonInfo ? M.hjemPersonInfo(h, 'person.' + a, c, rd) : null;
        if (!P) return null;
        return f === 'hjemme' ? [P.home ? 'hjemme' : 'borte', P.home ? 1 : 0, P.home ? C.green : null, P.id] : [P.sleep ? 'sover' : 'våken', P.sleep ? 1 : 0, null, P.sleepId];
      }
      if (h.areas && h.areas[a]) {
        const R = M.roomAuto ? M.roomAuto(h, a) : { temp: M.byClass(h, 'sensor', 'temperature', a)[0], hum: M.byClass(h, 'sensor', 'humidity', a)[0], thermo: null, lights: M.all(h, 'light', (s, id) => M.areaOf(h, id) === a) };
        if (f === 'temp' && R.temp) { const v = M.num(h, R.temp); rd(R.temp); return v == null ? null : [`${nb(v, 1)}°`, v, null, R.temp]; }
        if (f === 'fukt' && R.hum) { const v = M.num(h, R.hum); rd(R.hum); return v == null ? null : [`${nb(v, 0)} %`, v, null, R.hum]; }
        if (f === 'lys') { const n = (R.lights || []).filter((id) => { const s = rd(id); return s && s.state === 'on'; }).length; return [n ? 'på' : 'av', n ? 1 : 0, n ? C.orange : null, (R.lights || [])[0]]; }
        if (f === 'mål' && R.thermo) { const s = rd(R.thermo); const v = s && s.attributes.temperature; return v == null ? null : [`${nb(Number(v), 1)}°`, Number(v), null, R.thermo]; }
      }
      return null;
    };
  }

  // Standardprosa: kun setninger for kilder som faktisk finnes.
  function defaultProse(h, c) {
    const S = sources(h, c);
    const out = [];
    const row = (id, pre, src, post, extra) => out.push({ id, pre, src, fmt: '{v}', post, icon: '', color: 'hvit', link: '', cop: 'alltid', ...(extra || {}) });
    if (S.weather) row('p1', 'Ute er det', 'weather', '.', { link: '#vaer' });
    const P = !!S.price, W = !!S.watt, L = !!S.lights;
    if (P && W && L) { row('p2', 'Strømmen koster', 'price', '', { icon: 'dot' }); row('p3', 'og vi bruker', 'watt', ''); row('p4', 'med', 'lights', 'på.', { icon: '💡', link: '#lys' }); }
    else if (P && W) { row('p2', 'Strømmen koster', 'price', '', { icon: 'dot' }); row('p3', 'og vi bruker', 'watt', '.'); }
    else if (P && L) { row('p2', 'Strømmen koster', 'price', '.', { icon: 'dot' }); row('p4', 'Vi har', 'lights', 'på.', { icon: '💡', link: '#lys' }); }
    else if (W && L) { row('p3', 'Vi bruker', 'watt', ''); row('p4', 'med', 'lights', 'på.', { icon: '💡', link: '#lys' }); }
    else if (P) row('p2', 'Strømmen koster', 'price', '.', { icon: 'dot' });
    else if (W) row('p3', 'Vi bruker', 'watt', '.');
    else if (L) row('p4', 'Det er', 'lights', 'på.', { icon: '💡', link: '#lys' });
    if (S.events) row('p5', 'Vi har', 'events', 'i dag.', { icon: '⏰', act: 'more' });
    return out;
  }

  // Beregn synlige setninger → [{ pre, post, chip, hasChip, dot, emoji, bg, i, row, id, tap }]
  function compute(h, c, rd) {
    const S = sources(h, c, rd), getS = getter(h, c, S, rd);
    const rows = Array.isArray(c.prose) ? c.prose : defaultProse(h, c);
    const valOf = (p) => (p.src === 'custom' ? getS(p.ent) || null : S[p.src] || null);
    const fill = (str) => String(str || '').replace(/\{([^}]+)\}/g, (m, k) => { const v = getS(k); return v ? v[0] : '–'; });
    const test = (p) => {
      const op = p.cop || 'alltid';
      if (op === 'alltid') return true;
      const ck = p.csrc || p.src, sv = ck === 'custom' ? getS(p.cent) : S[ck];
      if (!sv) return true;
      const x = pnum(p.cval), num = !isNaN(x);
      if (op === '>') return num && sv[1] > x;
      if (op === '<') return num && sv[1] < x;
      const eq = num ? sv[1] === x : String(sv[0]).toLowerCase() === String(p.cval || '').trim().toLowerCase();
      return op === '=' ? eq : !eq;
    };
    const vis = rows.map((p, i) => ({ p, i })).filter(({ p }) => p && !p.hidden && test(p)).map(({ p, i }) => {
      const post = fill(p.post), sv = valOf(p);
      const bg = p.color === 'auto' ? (sv && sv[2]) || C.white : PCOL[p.color] || M.color(p.color, C.white);
      return { i, row: p, pre: p.pre ? fill(p.pre) + ' ' : '', post: post ? (/^[.,!?:;]/.test(post) ? post : ' ' + post) + ' ' : ' ', hasChip: (p.src || 'none') !== 'none',
        chip: p.src === 'text' ? fill(p.fmt) : fill(String(p.fmt || '{v}').replace(/\{v\}/g, sv ? sv[0] : '–')),
        dot: p.icon === 'dot' ? (sv && sv[2]) || C.green : null, emoji: p.icon && p.icon !== 'dot' ? p.icon : '', bg, id: sv ? sv[3] : null, tap: !!(p.act || p.link) };
    });
    return { S, getS, rows, vis, test, valOf, fill };
  }

  const chipHTML = (v, cls) => `${v.dot ? `<span class="${cls.dot}" style="background:${v.dot}"></span>` : ''}${v.emoji ? (v.emoji.indexOf(':') > 0 ? M.icon(v.emoji, 18) : `<span>${esc(v.emoji)}</span>`) : ''}<span>${esc(v.chip)}</span>`;
  const previewHTML = (h, c) => {
    const R = compute(h, c);
    return `<div class="xprev">${R.vis.map((v) => `<span>${esc(v.pre)}</span>${v.hasChip ? `<span class="pc" style="background:${v.bg}">${chipHTML(v, { dot: 'pd' })}</span>` : ''}<span>${esc(v.post)}</span>`).join('') || '<span style="color:#7f7f7f">Ingen setninger vises nå</span>'}</div>`;
  };

  // Utfør handling for en setning (runAct i designet).
  function runAct(card, p, id) {
    const h = card.hass, E = ents(h, card.config), a = p.act || '';
    const t = (m) => M.hjemToast(card, m);
    const st = (x) => x && h.states[x];
    if (a === 'more') M.moreInfo(card, id || E.weather);
    if (a === 'lock_toggle' || a === 'lock' || a === 'unlock') {
      const l = st(E.lock);
      if (!l) t('Fant ingen dørlås');
      else {
        const lock = a === 'lock' ? true : a === 'unlock' ? false : l.state !== 'locked';
        if (!lock && l.attributes.code_format) M.moreInfo(card, E.lock);
        else M.call(h, 'lock', lock ? 'lock' : 'unlock', { entity_id: E.lock }).then(() => t(lock ? 'Dørlås låst' : 'Dørlås låst opp')).catch(() => {});
      }
    } else if (a.indexOf('alarm') === 0) {
      const al = st(E.alarm);
      if (!al) t('Fant ingen alarm');
      else {
        const armed = /^armed|triggered/.test(al.state), want = a === 'alarm_on' ? true : a === 'alarm_off' ? false : !armed;
        const needCode = al.attributes.code_format && (!want || al.attributes.code_arm_required !== false);
        if (needCode) M.openPopup(card.config.alarm_hash || '#sikkerhet');
        else M.call(h, 'alarm_control_panel', want ? 'alarm_arm_away' : 'alarm_disarm', { entity_id: E.alarm }).then(() => t(want ? 'Alarm armert' : 'Alarm slått av')).catch(() => {});
      }
    } else if (a === 'lights_on' || a === 'lights_off') {
      const on = a === 'lights_on';
      M.call(h, 'light', on ? 'turn_on' : 'turn_off', { entity_id: 'all' }).then(() => t(on ? 'Alle lys er på' : 'Alle lys er av')).catch(() => {});
    } else if (a === 'garage_toggle') {
      const g = M.pick(card.config, 'garage', M.all(h, 'cover', (s) => s.attributes.device_class === 'garage')[0]);
      if (!g) t('Fant ingen garasjeport'); else M.call(h, 'cover', 'toggle', { entity_id: g }).then(() => t(h.states[g].state === 'open' ? 'Garasjeporten lukkes' : 'Garasjeporten åpnes')).catch(() => {});
    } else if (a === 'tv_toggle') {
      const tv = M.pick(card.config, 'tv', M.all(h, 'media_player', (s) => s.attributes.device_class === 'tv')[0]);
      if (!tv) t('Fant ingen TV'); else M.call(h, 'media_player', 'toggle', { entity_id: tv }).then(() => t(M.isOn(h.states[tv]) || h.states[tv].state === 'on' ? 'TV slått av' : 'TV slått på')).catch(() => {});
    } else if (a === 'vac_toggle') {
      const v = M.pick(card.config, 'vacuum', M.all(h, 'vacuum')[0]);
      if (!v) t('Fant ingen støvsuger');
      else { const run = h.states[v].state === 'cleaning'; M.call(h, 'vacuum', run ? 'pause' : 'start', { entity_id: v }).then(() => t(run ? 'Støvsuger pauset' : 'Støvsuger starter')).catch(() => {}); }
    } else if (a === 'service') runService(card, p);
    if (p.link) {
      if (p.link === 'lock') M.hjemLockSheet(card, E.lock);
      else M.openPopup(p.link);
    }
  }
  function parseData(s) {
    if (!s) return {};
    if (typeof s === 'object') return s;
    try { return JSON.parse(s); } catch (e) { /* k: v-linjer */ }
    const o = {};
    String(s).split(/[\n,]/).forEach((l) => { const m = /^\s*([\w.]+)\s*[:=]\s*(.+?)\s*$/.exec(l); if (m) o[m[1]] = M.isNum(m[2]) ? Number(m[2]) : m[2].replace(/^['"]|['"]$/g, ''); });
    return o;
  }
  function runService(card, p, hass) {
    const h = hass || card.hass, svc = String(p.svc || '').trim();
    const m = /^([a-z_]+)\.([a-z0-9_]+)$/.exec(svc);
    if (!m) { M.toast('Ugyldig tjeneste: ' + (svc || '–')); return; }
    const data = parseData(p.data);
    if (p.target) data.entity_id = p.target;
    M.call(h, m[1], m[2], data).then(() => M.hjemToast(card, `Kjørte ${svc}`)).catch(() => {});
  }

  class Prosa extends M.Card {
    static get cardName() { return 'Hjem · prosa'; }
    static get defaults() { return { price_high: 1.5, price_mid: 1.1, alarm_hash: '#sikkerhet' }; }
    static getConfigElement() { return M.hjemEditorEl(this); }
    static get schema() {
      return (hass) => {
        const areas = hass ? M.areas(hass).slice(0, 8) : [];
        const persons = hass ? M.all(hass, 'person') : [];
        const toks = [...Object.keys(TOK).map((k) => [`+ {${k}}`, `{${k}}`]), ...areas.map((a) => [`+ {${a.id}.temp}`, `{${a.id}.temp}`]), ...persons.map((p) => { const o = p.split('.')[1]; return [`+ {${o}.hjemme}`, `{${o}.hjemme}`]; })];
        const links = [...LINKS, ...(hass ? M.areas(hass).map((a) => ['#' + a.id, a.name]) : [])];
        const cond = (r) => r.cop && r.cop !== 'alltid';
        return [
          { type: 'html', render: (h, c) => previewHTML(h, c) },
          { type: 'rows', name: 'prose', label: 'Setninger', hide: true, addLabel: 'Ny setning',
            help: 'Hver setning kan ha en boble med live verdi. Lag to setninger med motsatte betingelser for å bytte tekst eller farge etter tilstand.',
            defaults: (h, c) => defaultProse(h, c),
            newRow: () => ({ id: 'p' + Date.now().toString(36), pre: 'Ny tekst', src: 'none', fmt: '{v}', post: '', icon: '', color: 'hvit', link: '', cop: 'alltid' }),
            title: (p) => [p.pre, (p.src || 'none') === 'none' ? '' : `[${p.src === 'text' ? p.fmt || '' : p.src === 'custom' ? p.ent || 'state' : srcL(p.src)}]`, p.post].filter(Boolean).join(' ') || 'Tom setning',
            sub: (p, i, h, c) => { const op = p.cop || 'alltid'; if (op === 'alltid') return 'Vises alltid'; const R = compute(h, c); return `Når ${srcL(p.csrc || p.src).toLowerCase()} ${(OPS.find((o) => o[0] === op) || ['', ''])[1].toLowerCase()} ${p.cval || '…'} · ${R.test(p) ? 'vises nå' : 'skjult nå'}`; },
            fields: [
              { type: 'text', name: 'pre', label: 'Tekst før', placeholder: 'F.eks. Strømmen koster' },
              { type: 'tokens', target: 'pre', tokens: toks },
              { type: 'select', name: 'src', label: 'Verdi i boblen', options: SRC, default: 'none' },
              { type: 'entity', name: 'ent', label: 'Entitet (egendefinert)', rowWhen: (r) => r.src === 'custom' },
              { type: 'html', rowWhen: (r) => r.src && r.src !== 'none' && r.src !== 'text', render: (r, h, c) => { const R = compute(h, c), v = R.valOf(r); return `<span class="help" style="padding:0 6px">${v ? 'Nå: ' + esc(v[0]) : 'Fant ingen entitet for denne kilden – velg under «Bytt entiteter»'}</span>`; } },
              { type: 'text', name: 'fmt', label: 'Visning i boblen · {v} er verdien', rowWhen: (r) => r.src && r.src !== 'none' && r.src !== 'text', placeholder: '{v}' },
              { type: 'text', name: 'fmt', label: 'Tekst i boblen', rowWhen: (r) => r.src === 'text' },
              { type: 'text', name: 'post', label: 'Tekst etter', placeholder: 'F.eks. i dag.' },
              { type: 'tokens', target: 'post', tokens: toks },
              { type: 'select', name: 'icon', label: 'Ikon i boblen', options: ICONS, default: '' },
              { type: 'text', name: 'icon', label: 'Eller skriv inn en emoji / mdi:ikon' },
              { type: 'swatches', name: 'color', label: 'Farge · Auto følger verdien (pris, lås, alarm …)', options: PSW, default: 'hvit' },
              { type: 'select', name: 'act', label: 'Når du trykker · handling', options: ACTS, default: '' },
              { type: 'text', name: 'svc', label: 'Utfør handling · domene.tjeneste', placeholder: 'light.turn_on', rowWhen: (r) => r.act === 'service' },
              { type: 'entity', name: 'target', label: 'Mål', rowWhen: (r) => r.act === 'service' },
              { type: 'text', name: 'data', label: 'Data (JSON eller nøkkel: verdi)', placeholder: '{"brightness_pct": 60}', rowWhen: (r) => r.act === 'service' },
              { type: 'button', label: 'Test handling', icon: 'mdi:play', rowWhen: (r) => r.act === 'service', run: (r, h) => runService({ hass: h, config: {} }, r, h) },
              { type: 'select', name: 'link', label: 'Og åpne popup', options: links, default: '' },
              { type: 'text', name: 'link', label: 'Egen popup-hash', placeholder: '#popup' },
              { type: 'select', name: 'cop', label: 'Vises', options: OPS, default: 'alltid' },
              { type: 'select', name: 'csrc', label: 'Når', options: SRC.filter((x) => x[0] !== 'none' && x[0] !== 'text'), rowWhen: cond },
              { type: 'entity', name: 'cent', label: 'Entitet (betingelse)', rowWhen: (r) => cond(r) && r.csrc === 'custom' },
              { type: 'text', name: 'cval', label: 'Verdi', placeholder: 'F.eks. 1,5 eller låst', rowWhen: cond },
            ] },
          { type: 'overrides', label: 'Bytt entiteter (kilder)', fields: [
            { name: 'weather', label: 'Vær', domain: 'weather', auto: (h) => AUTO.weather(h) },
            { name: 'temp', label: 'Ute-temp (tom = fra vær)', domain: 'sensor', device_class: 'temperature', auto: () => null },
            { name: 'price', label: 'Strømpris', domain: 'sensor', auto: (h) => AUTO.price(h) },
            { name: 'watt', label: 'Effekt (hele huset)', domain: 'sensor', device_class: 'power', auto: (h) => AUTO.watt(h) },
            { name: 'lights', label: 'Lys på (hele huset)', domain: 'sensor', auto: (h) => AUTO.lights(h) },
            { name: 'lock', label: 'Dørlås', domain: 'lock', auto: (h) => AUTO.lock(h) },
            { name: 'alarm', label: 'Alarm', domain: 'alarm_control_panel', auto: (h) => AUTO.alarm(h) },
            { name: 'trash', label: 'Søppel (dager til tømming)', domain: 'sensor', auto: (h) => AUTO.trash(h) },
            { name: 'garage', label: 'Garasjeport', domain: 'cover', auto: (h) => M.all(h, 'cover', (s) => s.attributes.device_class === 'garage')[0] },
            { name: 'tv', label: 'TV', domain: 'media_player', auto: (h) => M.all(h, 'media_player', (s) => s.attributes.device_class === 'tv')[0] },
            { name: 'vacuum', label: 'Støvsuger', domain: 'vacuum', auto: (h) => M.all(h, 'vacuum')[0] },
          ] },
          { type: 'lists', label: 'Kalendere og gjøremålslister', lists: (h) => [{ key: 'kalendere', label: 'Kalendere (hendelser i dag)', ids: M.all(h, 'calendar'), domains: ['calendar'] }, { key: 'lister', label: 'Gjøremålslister', ids: M.all(h, 'todo'), domains: ['todo'] }] },
          { type: 'section', label: 'Farger og popups', icon: 'mdi:palette', fields: [
            { type: 'number', name: 'price_high', label: 'Strømpris rød over (kr)', step: 0.1, placeholder: '1.5' },
            { type: 'number', name: 'price_mid', label: 'Strømpris gul over (kr)', step: 0.1, placeholder: '1.1' },
            { type: 'hash', name: 'alarm_hash', label: 'Alarm-popup (når kode kreves)', placeholder: '#sikkerhet' },
            { type: 'boolean', name: 'toasts', label: 'Bekreftelsesmeldinger', default: true },
          ] },
        ];
      };
    }
    get cardSize() { return 2; }
    customize(focus) { return M.hjemCustomize(this, focus); }
    connectedCallback() { super.connectedCallback(); this._evT = setInterval(() => this._events(), 15 * 60000); }
    disconnectedCallback() { super.disconnectedCallback(); clearInterval(this._evT); }
    _events() { if (!this.hass) return; const E = ents(this.hass, this.config); loadEvents(this.hass, E.calendars, () => this.update()); }
    render() {
      if (!this._evOnce) { this._evOnce = true; setTimeout(() => this._events(), 0); }
      const R = compute(this.hass, this.config, (id) => this.s(id));
      this._R = R;
      this._sheets && this._sheets.forEach((sh) => sh.update());
      if (!R.vis.length) {
        return `<div class="pz" data-ent="__tilpass"><span class="dim">–</span> <button class="pick press" data-act="customize" data-section="prose">${M.icon('mdi:plus', 18)}Legg til setning</button></div>`;
      }
      return `<div class="pz" data-ent="__tilpass">${R.vis.map((v) => `<span>${esc(v.pre)}</span>${v.hasChip ? `<button class="chip ${v.tap ? 'press' : ''}" data-key="c${v.i}" data-act="chip" data-i="${v.i}" ${v.id ? `data-ent="${esc(v.id)}"` : ''} ${v.tap ? '' : 'data-haptic="off"'} style="background:${v.bg};cursor:${v.tap ? 'pointer' : 'default'}">${chipHTML(v, { dot: 'dot' })}</button>` : ''}<span>${esc(v.post)}</span>`).join('')}</div>`;
    }
    onHold(id) { if (id === '__tilpass') { this.customize('prose'); return true; } return undefined; }
    onAction(name, el, ev) {
      if (name === 'chip') {
        const p = (this._R && this._R.rows[Number(el.dataset.i)]) || null;
        if (p && (p.act || p.link)) runAct(this, p, el.dataset.ent);
        return;
      }
      return super.onAction(name, el, ev);
    }
    get styles() {
      return `
        .pz{font-size:19px;font-weight:400;line-height:1.95;letter-spacing:-0.01em;text-wrap:pretty;color:var(--white,#fafafa)}
        .chip{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 12px;border-radius:15px;color:#232323;font-weight:600;vertical-align:middle;white-space:nowrap;font-variant-numeric:tabular-nums;line-height:1;transition:transform .15s cubic-bezier(.34,1.5,.64,1),background .3s}
        .chip ha-icon{color:#232323}
        .dot{width:8px;height:8px;border-radius:4px;flex:none;transition:background .3s}
        .pick{vertical-align:middle}
      `;
    }
  }
  M.define('msh-prosa-card', Prosa, 'MSH Hjem · prosa', 'Setninger med live verdier i bobler (vær, strømpris, effekt, lys …) og handling per boble.');
})();
