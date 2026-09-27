/* msh-prosa-card · Hjem-visningen, prosa-kortet. Kilde: Hjem v2.dc.html (prose, DEF_PROSE, SRC/ACTS/TOK/OPS,
 * runAct, custEditVals → «Tekst»-fanen). Live verdier i chips, handling per chip, betingelser («Når»).
 * Autokonfig: weather.* (første), sensor.hele_huset_effekt / _lys (KI Rom), strømpris (plattform nordpool/tibber),
 * person.*, lock.*, alarm_control_panel.*, calendar.*, todo.*, søppel-sensor. Standardprosaen bygges bare av
 * det som faktisk finnes.
 * Config: prose[] = { id, pre, src, fmt ({v} = verdien), post, icon, color, act, link, cop/csrc/cval (betingelse),
 *   ent (entitet for src 'custom', påkrevd), ent_override (overstyr entiteten til en fast kilde, tom = automatisk),
 *   cent (entitet for betingelsen, tom = samme som boblen), hidden, svc/target/data },
 *   prose_font_size (valgfri overstyring i em av kortets 14 px, 1,4–2,8; tom = automatisk clamp(22px, 7,4cqi, 34px)
 *   med kortet som container – MySmartHome), prose_line_height (ganger tekststørrelsen, 1,3–2,0, standard 1,55),
 *   overrides.<kilde> (alle setninger), price_high/price_mid, alarm_hash, toasts.
 * Utseende (Fiks 15.3 · MySmartHome, overstyrer Fiks 13): hvit tekst #fafafa, piller 1,6em høye av 0,8em pilletekst,
 * #fafafa/#2f2f2f/600, pris-prikk med glød. Teksten flyter naturlig (ingen &nbsp;/text-wrap), kun tegnsetting rett
 * etter en pille limes til pillen. Tall: «15.2°» (vær, som HA-tilstanden), «2395W», «1,16 kr»; lys-pillen ✨.
 */
(function () {
  const M = window.MSH, esc = M.esc, C = M.C;
  const PINK = C.accent;
  const TOK = { 'vær': 'weather', temp: 'temp', pris: 'price', watt: 'watt', lys: 'lights', hendelser: 'events', hjemme: 'home', 'lås': 'lock', alarm: 'alarm', 'søppel': 'trash', 'gjøremål': 'todo' };
  const SRC = [['none', 'Ingen boble'], ['text', 'Fast tekst'], ['weather', 'Vær'], ['temp', 'Ute-temp'], ['price', 'Strømpris'], ['watt', 'Effekt'], ['lights', 'Lys på'], ['events', 'Hendelser'], ['home', 'Hjemme'], ['lock', 'Dørlås'], ['alarm', 'Alarm'], ['trash', 'Søppel'], ['todo', 'Gjøremål'], ['custom', 'Egendefinert']];
  const ACTS = [['', 'Ingen'], ['more', 'Vis detaljer'], ['lock_toggle', 'Veksle dørlås'], ['lock', 'Lås dør'], ['unlock', 'Lås opp'], ['alarm_toggle', 'Veksle alarm'], ['alarm_on', 'Armer alarm'], ['alarm_off', 'Slå av alarm'], ['lights_on', 'Alle lys på'], ['lights_off', 'Alle lys av'], ['garage_toggle', 'Veksle garasjeport'], ['tv_toggle', 'Veksle TV'], ['vac_toggle', 'Pause/start støvsuger'], ['service', 'Egendefinert tjeneste']];
  const OPS = [['alltid', 'Alltid'], ['>', 'Over'], ['<', 'Under'], ['=', 'Er'], ['!=', 'Er ikke']];
  const ICONS = [['', 'Ingen'], ['dot', '● Prikk'], ['✨', '✨'], ['💡', '💡'], ['⏰', '⏰'], ['🌤️', '🌤️'], ['⚡', '⚡'], ['🔒', '🔒'], ['🚨', '🚨'], ['🗑️', '🗑️'], ['🏠', '🏠'], ['👋', '👋']];
  const SIZE_FIELDS = [
    { type: 'range', name: 'prose_font_size', label: 'Tekststørrelse', icon: 'mdi:format-size', min: 1.4, max: 2.8, step: 0.05, unit: 'em', help: 'Auto = tilpasses kortets bredde (22–34 px, som MySmartHome) · ellers em av kortets 14 px', presets: [['', 'Auto'], [1.8, 'Liten 1,8'], [2.15, 'Middels 2,15'], [2.5, 'Stor 2,5']] },
    { type: 'range', name: 'prose_line_height', label: 'Linjehøyde', icon: 'mdi:format-line-spacing', min: 1.3, max: 2, step: 0.05, default: 1.55, unit: 'em', help: 'Ganger tekststørrelsen · standard 1,55 (≈ 46,6 px per linje)', presets: [[1.4, 'Tett 1,4'], [1.55, 'Standard 1,55'], [1.75, 'Luftig 1,75']] },
  ];
  function textSizeOf(c) {
    const n = (v, d, lo, hi) => { const x = Number(v); return v == null || v === '' || isNaN(x) ? d : M.clamp(x, lo, hi); };
    const [F, L] = SIZE_FIELDS;
    // fs = null → automatisk størrelse etter kortets bredde (PROSA_AUTO_FS)
    return { fs: n(c && c.prose_font_size, null, F.min, F.max), lh: n(c && c.prose_line_height, L.default, L.min, L.max) };
  }
  const PCOL = { hvit: '#fafafa', gronn: C.green, gul: C.yellow, oransje: C.orange, rod: C.red, bla: C.blue, rosa: C.pink };
  const PSW = [['hvit', 'var(--gray1000, #e1e1e1)', 'Hvit'], ['auto', `conic-gradient(${C.green}, ${C.yellow}, ${C.red}, ${C.green})`, 'Auto etter verdi'], ['gronn', C.green, 'Grønn'], ['gul', C.yellow, 'Gul'], ['oransje', C.orange, 'Oransje'], ['rod', C.red, 'Rød'], ['bla', C.blue, 'Blå'], ['rosa', C.pink, 'Rosa']];
  const LINKS = [['', 'Ingen'], ['lock', 'Dørlås (hurtig)'], ['#vaer', 'Vær'], ['#lys', 'Lys'], ['#sikkerhet', 'Sikkerhet'], ['#kamera', 'Kamera'], ['#klima', 'Klima'], ['#gjoremal', 'Gjøremål'], ['#soppel', 'Søppel'], ['#vanning', 'Vanning'], ['#media', 'Media'], ['#basseng', 'Basseng'], ['#ruter', 'Ruter'], ['#strom', 'Strøm']];
  const srcL = (id) => (SRC.find((x) => x[0] === id) || ['', id || ''])[1];
  // Faste kilder som kan pekes til en annen entitet (prose[].ent_override)
  const FIXED = ['weather', 'temp', 'price', 'watt', 'lights', 'events', 'home', 'lock', 'alarm', 'trash', 'todo'];
  const nb = (n, d) => M.nf(n, d);
  // Tallformat som MySmartHome (Fiks 15.3): vær/ute-temp med én desimal og punktum som HA-tilstanden («15.2°»),
  // effekt uten mellomrom/tusenskille («2395W»), pris med komma («1,16 kr», MSH.powerPrice.fmt).
  const deg = (v) => `${Number(v).toFixed(1)}°`;
  // Værtilstanden oversatt av HA selv (hass.formatEntityState → «Overskyet»); uoversatt (rå tilstand) → egen tabell.
  const condOf = (h, w) => {
    let t = '';
    if (h && h.formatEntityState) { try { t = String(h.formatEntityState(w) || ''); } catch (e) { t = ''; } }
    if (!t || t === w.state) t = M.hjemCond(w.state);
    return t.toLowerCase();
  };
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
    // Felles strømpris-kilde (MSH.powerPrice, 15-strompris-kilde.js): samme sensor som strømpriskortet og sliden.
    price: (h) => (M.powerPrice ? M.powerPrice(h).entity : null),
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
      S.weather = [`${condOf(h, w)}${t != null && M.isNum(t) ? ' og ' + deg(t) : ''}`, t != null ? Number(t) : null, null, E.weather];
    }
    const ts = E.temp && rd(E.temp);
    if (ts && M.isNum(ts.state)) S.temp = [deg(ts.state), Number(ts.state), null, E.temp];
    else if (w && M.isNum(w.attributes.temperature)) S.temp = [deg(w.attributes.temperature), Number(w.attributes.temperature), null, E.weather];
    const p = E.price && rd(E.price);
    if (p && M.isNum(p.state)) {
      // Pris som vises / enhet / SEK→kr fra power_price; egen entitet i boblen (overrides.price / ent_override) overstyrer bare sensoren
      const own = M.powerPrice && E.price !== AUTO.price(h) ? M.powerPriceCfg(null, { spot_entity: E.price, se_entity: E.price }) : null;
      const P = M.powerPrice ? M.powerPrice(h, own) : null, v = P ? P.now : Number(p.state);
      if (P && P.grid) rd(P.grid.entity);
      if (v != null) S.price = [P ? P.fmt(v) : `${nb(v, 2)} kr`, v, lvlP(v), E.price];
    }
    const wt = E.watt && rd(E.watt);
    if (wt && M.isNum(wt.state)) { const v = Number(wt.state); S.watt = [`${Math.round(v)}W`, v, v > 3000 ? C.red : v > 1500 ? C.yellow : C.green, E.watt]; }
    const ls = E.lights && rd(E.lights);
    if (ls && M.isNum(ls.state)) { const v = Number(ls.state); S.lights = [`${v} lys`, v, C.orange, E.lights]; }
    else {
      const all = M.all(h, 'light');
      if (all.length) { const v = all.filter((id) => { const s = rd(id); return s && s.state === 'on'; }).length; S.lights = [`${v} lys`, v, C.orange, null]; }
    }
    if (E.calendars.length) { const n = EV.n; S.events = [n == null ? '– hendelser' : n === 0 ? 'ingen hendelser' : `${n} ${n === 1 ? 'hendelse' : 'hendelser'}`, n, C.blue, E.calendars[0]]; }
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
    if (P && W && L) { row('p2', 'Strømmen koster', 'price', '', { icon: 'dot' }); row('p3', 'og vi bruker', 'watt', ''); row('p4', 'med', 'lights', 'på.', { icon: '✨', link: '#lys' }); }
    else if (P && W) { row('p2', 'Strømmen koster', 'price', '', { icon: 'dot' }); row('p3', 'og vi bruker', 'watt', '.'); }
    else if (P && L) { row('p2', 'Strømmen koster', 'price', '.', { icon: 'dot' }); row('p4', 'Vi har', 'lights', 'på.', { icon: '✨', link: '#lys' }); }
    else if (W && L) { row('p3', 'Vi bruker', 'watt', ''); row('p4', 'med', 'lights', 'på.', { icon: '✨', link: '#lys' }); }
    else if (P) row('p2', 'Strømmen koster', 'price', '.', { icon: 'dot' });
    else if (W) row('p3', 'Vi bruker', 'watt', '.');
    else if (L) row('p4', 'Det er', 'lights', 'på.', { icon: '✨', link: '#lys' });
    if (S.events) row('p5', 'Vi har', 'events', 'i dag.', { icon: '⏰', act: 'more' });
    return out;
  }

  // Beregn synlige setninger → [{ pre, post, chip, hasChip, dot, emoji, bg, i, row, id, tap }]
  function compute(h, c, rd) {
    const S = sources(h, c, rd), getS = getter(h, c, S, rd);
    const rows = Array.isArray(c.prose) ? c.prose : defaultProse(h, c);
    // Verdi for en kilde. Faste kilder kan pekes til en annen entitet (ent_override / cent); «Egendefinert» bruker ent.
    const valFor = (src, ov) => {
      if (src === 'custom') return getS(ov) || null;
      if (!ov) return S[src] || null;
      if (AUTO[src]) { const S2 = sources(h, { ...c, overrides: { ...(c.overrides || {}), [src]: ov } }, rd); if (S2[src]) return S2[src]; }
      return getS(ov) || null;
    };
    const valOf = (p) => valFor(p.src, p.src === 'custom' ? p.ent : p.ent_override);
    const fill = (str) => String(str || '').replace(/\{([^}]+)\}/g, (m, k) => { const v = getS(k); return v ? v[0] : '–'; });
    const test = (p) => {
      const op = p.cop || 'alltid';
      if (op === 'alltid') return true;
      // Betingelsens entitet: cent, ellers samme entitet som boblen når betingelsen gjelder samme kilde
      const ck = p.csrc || p.src, same = ck === p.src ? (ck === 'custom' ? p.ent : p.ent_override) : '';
      const sv = valFor(ck, p.cent || same || '');
      if (!sv) return true;
      const x = pnum(p.cval), num = !isNaN(x);
      if (op === '>') return num && sv[1] > x;
      if (op === '<') return num && sv[1] < x;
      const eq = num ? sv[1] === x : String(sv[0]).toLowerCase() === String(p.cval || '').trim().toLowerCase();
      return op === '=' ? eq : !eq;
    };
    const vis = rows.map((p, i) => ({ p, i })).filter(({ p }) => p && !p.hidden && test(p)).map(({ p, i }) => {
      const post = fill(p.post), sv = valOf(p);
      const bg = p.color === 'auto' ? (sv && sv[2]) || '#fafafa' : PCOL[p.color] || M.color(p.color, '#fafafa');
      return { i, row: p, pre: p.pre ? fill(p.pre) + ' ' : '', post: post ? (/^[.,!?:;]/.test(post) ? post : ' ' + post) + ' ' : ' ', hasChip: (p.src || 'none') !== 'none',
        chip: p.src === 'text' ? fill(p.fmt) : fill(String(p.fmt || '{v}').replace(/\{v\}/g, sv ? sv[0] : '–')),
        dot: p.icon === 'dot' ? (sv && sv[2]) || C.green : null, emoji: p.icon && p.icon !== 'dot' ? p.icon : '', bg, id: sv ? sv[3] : null, tap: !!(p.act || p.link) };
    });
    // Auto-entiteten for en fast kilde (uten overstyring) – vises som «Automatisk · …» i velgeren.
    const autoOf = (src) => (S[src] && S[src][3]) || (AUTO[src] ? ents(h, c)[src] : null) || null;
    return { S, getS, rows, vis, test, valOf, valFor, autoOf, fill };
  }

  const chipHTML = (v) => `${v.dot ? `<span class="dot" style="background:${v.dot};box-shadow:0 0 0.35em ${v.dot}"></span>` : ''}${v.emoji ? (v.emoji.indexOf(':') > 0 ? M.icon(v.emoji, 14) : `<span class="em">${esc(v.emoji)}</span>`) : ''}<span>${esc(v.chip)}</span>`;
  // Hele prosaen som én flytende tekst (MySmartHome): ord og piller skilles med vanlige mellomrom og brytes naturlig –
  // ingen &nbsp;-binding eller text-wrap: pretty/balance (Fiks 15.3). Eneste unntak: tegnsetting rett etter en pille
  // limes til pillen (nowrap-bit .pzg), så «.» aldri havner alene på neste linje.
  function prosaHTML(vis, pill) {
    const A = [];
    const words = (t) => String(t || '').trim().split(/\s+/).filter(Boolean).forEach((w) => A.push(esc(w)));
    vis.forEach((v) => {
      words(v.pre);
      let post = String(v.post || '').trim();
      if (v.hasChip) {
        const m = /^[.,!?:;…»)\]]+/.exec(post), pu = m ? m[0] : '';
        if (pu) post = post.slice(pu.length);
        A.push(pu ? `<span class="pzg">${pill(v)}${esc(pu)}</span>` : pill(v));
      }
      words(post);
    });
    return A.join(' ');
  }
  // Tidligere gruppedeling (Fiks 13) – ikke lenger nødvendig; beholdes som no-op for eldre kall.
  M.fitProsa = function () {};
  M.prosaHTML = prosaHTML;
  // Samme utseende i kortet, i GUI-editorens forhåndsvisning og i «Tilpass Hjem» → Tekst (00-base legger font på :host).
  M.PROSA_CSS = `
    .pz{margin:0;padding:4px 0 0 0;font-family:${M.FONT};font-weight:400;letter-spacing:-0.01em;overflow-wrap:break-word;color:var(--gray1000-white,#fafafa)}
    /* Pille: 1,6em høy av 0,8em tekst (≈ 0,82 × linjehøyden 1,55) – endrer ikke linjerytmen */
    .pz .chip{display:inline-flex;align-items:center;gap:8px;height:1.6em;margin:0;padding:0 .55em;border:0;border-radius:999px;box-shadow:none;background:#fafafa;color:#2f2f2f;font:inherit;font-size:.8em;font-weight:600;line-height:1;letter-spacing:0;white-space:nowrap;vertical-align:.08em;font-variant-numeric:tabular-nums;box-sizing:border-box;-webkit-tap-highlight-color:transparent;transition:transform .15s cubic-bezier(.34,1.5,.64,1),background .3s}
    .pz .chip.press:active{transform:scale(.96)}
    .pz .chip ha-icon{color:#2f2f2f;--mdc-icon-size:.9em !important;width:.9em !important;height:.9em !important}
    .pz .chip .em{font-size:.9em;line-height:1;flex:none}
    .pz .dot{width:.42em;height:.42em;border-radius:50%;flex:none;transition:background .3s}
    .pz .pzg{white-space:nowrap}
  `;
  // Standard: clamp(22px, 7,4cqi, 34px) – kortet (eller forhåndsvisningen) er container (container-type: inline-size)
  const AUTO_FS = 'clamp(22px, 7.4cqi, 34px)';
  M.PROSA_AUTO_FS = AUTO_FS;
  const textStyle = (c) => { const T = textSizeOf(c); return `font-size:${T.fs != null ? T.fs + 'em' : AUTO_FS};line-height:${T.lh}`; };
  const previewHTML = (h, c) => {
    const R = compute(h, c);
    return `<style>${M.PROSA_CSS}.xpz{padding:14px 16px;border-radius:24px;background:#232323;font-size:var(--ha-font-size-m, 14px);container-type:inline-size}</style><div class="xpz"><div class="pz" style="${textStyle(c)};padding:0">${R.vis.length ? prosaHTML(R.vis, (v) => `<span class="chip" style="background:${v.bg}">${chipHTML(v)}</span>`) : '<span style="color:#7f7f7f">Ingen setninger vises nå</span>'}</div></div>`;
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
    // Tekststørrelse i em av HA-kortets 14 px (standard 2,15 em ≈ 30 px = MySmartHome på mobil, skaleres med temaets
    // tekststørrelse) og linjehøyde som faktor av tekststørrelsen (standard 1,55). Delt med «Tilpass Hjem» → Tekst.
    static get sizeFields() { return SIZE_FIELDS; }
    static textSize(c) { return textSizeOf(c); }
    static getConfigElement() { return M.hjemEditorEl(this); }
    static get schema() {
      return (hass) => {
        const areas = hass ? M.areas(hass).slice(0, 8) : [];
        const persons = hass ? M.all(hass, 'person') : [];
        const toks = [...Object.keys(TOK).map((k) => [`+ {${k}}`, `{${k}}`]), ...areas.map((a) => [`+ {${a.id}.temp}`, `{${a.id}.temp}`]), ...persons.map((p) => { const o = p.split('.')[1]; return [`+ {${o}.hjemme}`, `{${o}.hjemme}`]; })];
        const links = [...LINKS, ...(hass ? M.areas(hass).map((a) => ['#' + a.id, a.name]) : [])];
        (M.popupOptions && hass ? M.popupOptions(hass) : []).forEach((o) => { if (!links.some((l) => l[0] === o[0])) links.push(o); }); // egne popups
        const cond = (r) => r.cop && r.cop !== 'alltid';
        return [
          { type: 'html', render: (h, c) => previewHTML(h, c) },
          ...Prosa.sizeFields,
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
              { type: 'entity', name: 'ent', label: 'Entitet', required: true, placeholder: 'Velg entitet …', help: 'Påkrevd for «Egendefinert». Kan også være {område}.temp o.l. i tekstfeltene.', rowWhen: (r) => r.src === 'custom' },
              { type: 'entity', name: 'ent_override', label: 'Entitet', help: 'Automatisk = kildens standard-entitet. Velg en annen sensor for å overstyre bare denne setningen.', rowWhen: (r) => FIXED.includes(r.src), auto: (r, h, c) => compute(h, c).autoOf(r.src) },
              { type: 'html', rowWhen: (r) => r.src && r.src !== 'none' && r.src !== 'text', render: (r, h, c) => { const R = compute(h, c), v = R.valOf(r); return `<span class="help" style="padding:0 6px">${v ? 'Nå: ' + esc(v[0]) : 'Fant ingen verdi – velg en entitet'}</span>`; } },
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
              { type: 'entity', name: 'cent', label: 'Entitet (betingelse)', help: 'For faste kilder: tom = samme entitet som kilden. Påkrevd for «Egendefinert».', rowWhen: (r) => cond(r), auto: (r, h, c) => { const R = compute(h, c), ck = r.csrc || r.src; return ck === 'custom' ? null : ck === r.src && r.ent_override ? r.ent_override : R.autoOf(ck); } },
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
      if (M.powerPriceWatch) M.powerPriceWatch(this); // power_price i ki-store endret → tegn på nytt
      const R = compute(this.hass, this.config, (id) => this.s(id));
      this._R = R;
      this._sheets && this._sheets.forEach((sh) => sh.update());
      const pzS = `style="${textStyle(this.config)}"`;
      if (!R.vis.length) {
        return `<div class="pz" ${pzS} data-ent="__tilpass"><span class="dim">–</span> <button class="pick press" data-act="customize" data-section="prose">${M.icon('mdi:plus', 18)}Legg til setning</button></div>`;
      }
      return `<div class="pz" ${pzS} data-ent="__tilpass">${prosaHTML(R.vis, (v) => `<button class="chip ${v.tap ? 'press' : ''}" data-key="c${v.i}" data-act="chip" data-i="${v.i}" ${v.id ? `data-ent="${esc(v.id)}"` : ''} ${v.tap ? '' : 'data-haptic="off"'} style="background:${v.bg};cursor:${v.tap ? 'pointer' : 'default'}">${chipHTML(v)}</button>`)}</div>`;
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
        /* Grunnstørrelse = HA-kortets 14 px; kortet er container → prosaen clamp(22px, 7,4cqi, 34px) / 1,55 (MySmartHome) */
        :host{display:flow-root;font-size:var(--ha-font-size-m, 14px);container-type:inline-size}
        ${M.PROSA_CSS}
        .pick{vertical-align:baseline}
      `;
    }
  }
  M.define('msh-prosa-card', Prosa, 'MSH Hjem · prosa', 'Setninger med live verdier i bobler (vær, strømpris, effekt, lys …) og handling per boble.');
})();
