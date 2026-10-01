/* msh-ringeklokke-card · Ringeklokke-popup #ringeklokke (fiks 19.17–19.19, UniFi Protect G6 Entry). Mal A, ett kort.
 * Seksjoner: video (300 px, r28: live-strøm, LIVE, Kamera · Pakkekamera, lyd, tannhjul, «Det ringer på», deteksjons-chips)
 * → tre handlinger (Ta bilde · Lås opp (hold) · Avvis) → svar via høyttaleren (piller) → «Tidligere i dag».
 * Toveis tale støttes ikke fra HA – ingen «Snakk»-knapp.
 * Autokonfig (fallgruve 4): ringe-utløser = binary_sensor.*_doorbell (evt. event.* ringeklokke/doorbell) med platform
 * unifiprotect → samme enhet: kameraer (høy/middels/lav oppløsning, pakkekamera), media_player (høyttaler),
 * number *_ring_volume, sensor *_last_doorbell_ring, binary_sensor-deteksjoner og event.*; lås = lock.* i samme område.
 * «(ingen)» = 'none' skjuler funksjonen. Config: { ring_entity, camera, package_camera, lock, speaker, hold_ms, mute_min,
 *   snapshot, haptic, package_first, show_replies, show_history, detections: [], replies: [{ icon, text, media? }],
 *   doorbell: { mode, trigger, cooldown_s, card_duration_min, auto_close_min } (standard for enheter uten eget valg), tts }.
 * Fiks 20.1: varselet følger aldri sensorens tilstand (binary_sensor er bare på ~1 s) – det starter på overgangen
 *   (trigger 'on' = off→on, 'event' = ny last_changed/event_type på event.*) og varer valgt tid (MSH.doorbellCfg, per
 *   bruker × enhet i doorbell_profiles, ellers config.doorbell). mode: card · popup · both (popup + kortet på Hjem når
 *   den lukkes) · off. cooldown_s: ny ringing innenfor tiden gir ikke nytt varsel, men nullstiller tid/tidslinje.
 *   card_duration_min (0 = til avvist), auto_close_min (0 = aldri). Starttid lagres i sessionStorage (ki:ring-alert).
 *   Eldre auto_open: false → mode 'off' (når ikke valgt på nytt etter 20.1); eldre auto_close_min på rotnivå leses som fallback.
 * Ringing (MSH.ringTick, kalles fra Hjem-kortet og dette kortet ved hver hass-oppdatering): off→on / ny event →
 *   MSH.ringNow(): haptic heavy (bryteren «Vibrer»), og etter «Når det ringer» (MSH.doorbellMode, per bruker × enhet i
 *   ki-store doorbell_profiles via MSH.profileGet/profileSet, fiks 19.13): card = kort øverst i Hjem-fanen
 *   (msh-ring-banner, montert av msh-hjem-card), popup = åpner #ringeklokke (navbar/mini-spiller skjules av navbaren),
 *   off = ingenting. Hendelsen 'ki-doorbell' varsler Hjem/faner.
 * Kaldstart fra varsel (19.19): MSH.ringColdStart() – står #ringeklokke i URL-en når dashbordet lastes, dyttes Bubble Card
 *   (location-changed) til popupen er åpen, uansett modus. Lenke for varsler: MSH.ringLink(hass).
 */
(function () {
  const M = window.MSH;
  if (!M || customElements.get('msh-ringeklokke-card')) return;
  const esc = M.esc, C = M.C;
  const HASH = '#ringeklokke', CID = 'pop-ringeklokke';
  const PINK = C.accent, PINKC = 'rgb(242 133 201)', GREEN = C.green, RED = C.red;
  // [nøkkel, etikett, ikon, regex mot objekt-id]
  const DET = [
    ['person', 'Person', 'mdi:account', /person|people|face/],
    ['package', 'Pakke', 'mdi:package-variant-closed', /package|pakke/],
    ['vehicle', 'Kjøretøy', 'mdi:car', /vehicle|kjoretoy|kjøretøy/],
    ['animal', 'Dyr', 'mdi:paw', /animal|(^|_)pet(_|$)|(^|_)dyr(_|$)/],
    ['speaking', 'Snakker', 'mdi:account-voice', /speaking|snakk/],
    ['baby', 'Babygråt', 'mdi:baby-face-outline', /baby/],
    ['glass', 'Glassknus', 'mdi:glass-fragile', /glass/],
    ['smoke', 'Røyk/CO', 'mdi:smoke-detector-alert', /smoke|co_alarm|carbon_monoxide|royk|røyk/],
  ];
  const DET_KEYS = DET.map((d) => d[0]), RED_KEYS = new Set(['glass', 'smoke']);
  const REPLIES = [{ icon: 'mdi:run-fast', text: 'Kommer!' }, { icon: 'mdi:package-down', text: 'Legg pakken ved døren' }, { icon: 'mdi:timer-sand', text: 'Vent litt' }, { icon: 'mdi:home-export-outline', text: 'Ikke hjemme' }];
  const DEF = { hold_ms: 1000, mute_min: 5, snapshot: true, haptic: true, package_first: true, show_replies: true, show_history: true };
  const MODES = [['card', 'Kort', 'Et kort øverst på Hjem'], ['popup', 'Popup', 'Åpner ringeklokke-popupen (skjuler navbar og mini-spiller)'], ['both', 'Begge', 'Åpner popupen – kortet ligger på Hjem når den lukkes'], ['off', 'Av', 'Ingen automatikk – lenken fra varselet virker fortsatt']];
  // Fiks 20.1: «Visning»-feltene for ringingen (samme i Tilpass ringeklokke, Tilpass Hjem → Popups og GUI-editoren)
  const DB_DEF = { mode: 'card', trigger: 'on', cooldown_s: 30, card_duration_min: 2, auto_close_min: 2 };
  const DB_OPTS = {
    mode: MODES,
    trigger: [['on', 'Sensor går på', 'Overgang av → på på ringe-utløseren (binary_sensor.*_doorbell)'], ['event', 'Ny hendelse', 'Ny hendelse på event.*-entiteten (last_changed / event_type)']],
    cooldown_s: [[0, 'Ikke'], [10, '10 s'], [30, '30 s'], [60, '1 min']],
    card_duration_min: [[0.5, '30 s'], [1, '1 min'], [2, '2 min'], [5, '5 min'], [0, 'Til avvist']],
    auto_close_min: [[0.5, '30 s'], [1, '1 min'], [2, '2 min'], [5, '5 min'], [0, 'Aldri']],
  };
  const AUTO_RX = /auto.?(re)?lock|autol[aå]s|auto.?l[aå]s|relock/i;
  const hm = (t) => { const d = new Date(t); return `${M.pad(d.getHours())}:${M.pad(d.getMinutes())}`; };
  const reps = (c) => (Array.isArray(c && c.replies) ? c.replies.filter((r) => r && typeof r === 'object') : REPLIES);
  const detsOf = (c) => (Array.isArray(c && c.detections) ? c.detections.filter((k) => DET_KEYS.includes(k)) : DET_KEYS);

  /* ------------------------------------------------------------ autokonfig */
  const regOf = (h, id) => (h && h.entities && h.entities[id]) || null;
  const devOf = (h, id) => (regOf(h, id) || {}).device_id || null;
  const onDev = (h, dev) => (dev ? Object.keys(h.entities || {}).filter((x) => h.entities[x].device_id === dev && h.states[x]) : []);
  const real = (h, id) => (id && id !== 'none' && h.states[id] ? id : null);
  const isUp = (h, id) => { const e = regOf(h, id); return !!e && e.platform === 'unifiprotect'; };
  // Ringe-utløseren: binary_sensor.*_doorbell (UniFi Protect), ellers event.* med doorbell/ringeklokke
  M.ringFind = function (h) {
    if (!h || !h.states) return null;
    const ids = Object.keys(h.states).sort();
    return ids.find((id) => /^binary_sensor\.\w+_doorbell$/.test(id) && isUp(h, id))
      || ids.find((id) => /^event\./.test(id) && isUp(h, id) && (h.states[id].attributes.device_class === 'doorbell' || /_(doorbell|ringeklokke)$/.test(id)))
      || null;
  };
  M.ringAuto = function (h, c) {
    c = c || {};
    const out = { ring: null, dev: null, area: null, camera: null, cams: [], pkg: null, lock: null, speaker: null, volume: null, last: null, det: {}, events: [], face: null };
    if (!h || !h.states) return out;
    const ring = c.ring_entity === 'none' ? null : real(h, c.ring_entity) || M.ringFind(h);
    out.ring = ring;
    const dev = ring ? devOf(h, ring) : null, D = onDev(h, dev), dv = dev && h.devices && h.devices[dev];
    out.dev = dev;
    out.area = (ring && M.areaOf(h, ring)) || (dv && dv.area_id) || null;
    // Kanal fra entity_id og navn (UniFi: «… High resolution channel»); tilgjengelige før utilgjengelige
    const cams = D.filter((x) => x.startsWith('camera.')), hay = (x) => (x + ' ' + String(h.states[x].attributes.friendly_name || '')).toLowerCase();
    const isPkg = (x) => /package|pakke/.test(hay(x)), un = (x) => (M.unavailable(h.states[x]) ? 10 : 0);
    const rank = (x) => un(x) + (/high.?res/.test(hay(x)) ? 0 : /medium.?res/.test(hay(x)) ? 2 : /low.?res/.test(hay(x)) ? 3 : 1);
    out.cams = cams.filter((x) => !isPkg(x)).sort((a, b) => rank(a) - rank(b));
    out.camera = c.camera === 'none' ? null : real(h, c.camera) || out.cams[0] || null;
    out.pkg = c.package_camera === 'none' ? null : real(h, c.package_camera) || cams.filter(isPkg).sort((a, b) => un(a) - un(b) || (/package_camera/.test(b) ? 1 : 0) - (/package_camera/.test(a) ? 1 : 0))[0] || null;
    out.lock = c.lock === 'none' ? null : real(h, c.lock) || (out.area ? M.all(h, 'lock').find((l) => M.areaOf(h, l) === out.area) : null) || null;
    out.speaker = c.speaker === 'none' ? null : real(h, c.speaker) || D.find((x) => x.startsWith('media_player.')) || null;
    out.volume = D.find((x) => /^(number|input_number)\./.test(x) && /ring_volume|ringe.?volum/.test(x)) || null;
    out.last = D.find((x) => x.startsWith('sensor.') && /last_(doorbell_)?ring|siste_ring/.test(x)) || null;
    DET.forEach(([k, , , rx]) => { const id = D.find((x) => x.startsWith('binary_sensor.') && x !== ring && !/_doorbell$/.test(x) && rx.test(x.split('.')[1])); if (id) out.det[k] = id; });
    out.events = D.filter((x) => x.startsWith('event.'));
    const sm = out.events.map((x) => h.states[x]).find((s) => /smart/.test(s.entity_id) && /face/i.test(String(s.attributes.event_type || '')));
    if (sm) { const a = sm.attributes; out.face = a.name || a.face_name || (a.metadata && a.metadata.name) || null; }
    return out;
  };
  const areaLabel = (h, A) => (A.area ? M.areaName(h, A.area) : 'Inngang');
  const camImg = (h, id) => {
    const s = h && id && h.states[id];
    if (!s) return '';
    const a = s.attributes;
    let u = a.access_token ? `/api/camera_proxy/${id}?token=${encodeURIComponent(a.access_token)}` : a.entity_picture || '';
    if (!u) return '';
    u += (u.includes('?') ? '&' : '?') + '_t=' + Math.floor(Date.now() / 10000);
    return u[0] === '/' && h.hassUrl ? h.hassUrl(u) : u;
  };
  const tsOf = (s) => { if (!s) return 0; const t = new Date(s.state).getTime(); return isNaN(t) ? 0 : t; };
  // Siste ringing: sensor.*_last_doorbell_ring → event-tilstanden → binary_sensor sist på → ringetilstanden
  const lastRingT = (h, A) => {
    const R = M.ring || {};
    const cands = [A.last && tsOf(h.states[A.last]), A.ring && A.ring.startsWith('event.') && tsOf(h.states[A.ring]), A.ring && A.ring.startsWith('binary_sensor.') && h.states[A.ring] && h.states[A.ring].state === 'on' && new Date(h.states[A.ring].last_changed).getTime(), R.t];
    return Math.max(0, ...cands.filter((x) => x && !isNaN(x)));
  };
  const agoTxt = (t) => {
    if (!t) return '';
    const s = Math.max(0, Math.round((Date.now() - t) / 1000));
    if (s < 5) return 'nå';
    if (s < 60) return `for ${s} s siden`;
    if (s < 3600) return `for ${Math.round(s / 60)} min siden`;
    return new Date(t).toDateString() === new Date().toDateString() ? `kl. ${hm(t)}` : new Date(t).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' }) + ' ' + hm(t);
  };
  // Aktive deteksjoner (bare de som skal vises), med ansiktsnavn i stedet for «Person»
  const chipsOf = (h, A, c) => detsOf(c).filter((k) => A.det[k] && M.isOn(h.states[A.det[k]])).map((k) => {
    const d = DET.find((x) => x[0] === k);
    return { k, label: k === 'person' && A.face ? A.face : d[1], icon: d[2], red: RED_KEYS.has(k) };
  });
  const chipHTML = (x) => `<span class="dc ${x.red ? 'red' : ''}" data-key="dc-${x.k}">${M.icon(x.icon, 14)}${esc(x.label)}</span>`;

  /* ------------------------------------------------------------ «Når det ringer» (per bruker × enhet) */
  const MODE_ROOT = 'doorbell_profiles', MODE_LS = 'ki:doorbell-mode';
  const dbOk = (k, v) => v != null && v !== '' && DB_OPTS[k].some((o) => String(o[0]) === String(v));
  const dbNum = (k, v) => (typeof DB_DEF[k] === 'number' ? Number(v) : String(v));
  // Effektive valg: profil (bruker × enhet) → localStorage (eldre, bare mode) → config.doorbell → eldre rotfelt → standard
  M.doorbellCfg = function (c) {
    c = c || cfgNow();
    const cd = c.doorbell && typeof c.doorbell === 'object' ? c.doorbell : {};
    let P = {};
    try { if (M.profileGet && M.store) P = M.profileGet(MODE_ROOT) || {}; } catch (e) { P = {}; }
    let ls = null;
    try { ls = localStorage.getItem(MODE_LS); } catch (e) { /* */ }
    // Migrering (20.1): auto_open: false → 'off', med mindre modus er valgt på nytt etter 20.1 (profilen har v)
    const legacyOff = c.auto_open === false && !P.v && !cd.mode;
    const out = {};
    Object.keys(DB_DEF).forEach((k) => {
      const cands = k === 'mode' ? (legacyOff ? ['off'] : [P.mode, ls, cd.mode]) : [P[k], cd[k], k === 'auto_close_min' ? c.auto_close_min : undefined];
      const v = cands.find((x) => dbOk(k, x));
      out[k] = v === undefined ? DB_DEF[k] : dbNum(k, v);
    });
    return out;
  };
  M.doorbellMode = (c) => M.doorbellCfg(c).mode;
  M.setDoorbell = function (k, v) {
    if (!(k in DB_DEF) || !dbOk(k, v)) return;
    v = dbNum(k, v);
    if (k === 'mode') try { localStorage.setItem(MODE_LS, v); } catch (e) { /* */ }
    if (M.profileSet && M.store) M.profileSet(MODE_ROOT, { [k]: v, v: 20 });
    else if (M.store && M.store.deviceId) M.store.set('devices.' + M.store.deviceId + '.doorbell_' + k, v, { now: true, immediate: true });
    M.haptic('selection');
    if (R.t && !R.dismissed && M.ringActive()) { setUntil(M.doorbellCfg(), R.t); ssSave(); }
    emit();
  };
  M.setDoorbellMode = (v) => M.setDoorbell('mode', v);
  // Segmenter + undertekst (Tilpass ringeklokke → Visning, Tilpass Hjem → Popups, GUI-editoren). act = data-a-verdien,
  // data-f = feltet, data-v = verdien → MSH.setDoorbell(f, v).
  M.doorbellModeHTML = function (act, attr) {
    const D = M.doorbellCfg(), who = M.deviceClassName && M.deviceClass ? M.deviceClassName(M.deviceClass()) : 'denne enheten';
    const cap = (t) => `<div style="font-size:13px;color:var(--gray700,#979797);padding:0 4px">${t}</div>`;
    const sub = (t, key) => `<div data-key="${key}" style="font-size:12px;color:var(--gray600,#7f7f7f);padding:0 4px">${esc(t)}</div>`;
    const seg = (k) => `<div role="tablist" data-f="${k}" style="display:flex;gap:2px;padding:4px;border-radius:24px;background:var(--gray100,#2f2f2f)">${DB_OPTS[k].map(([v, l]) => { const on = String(v) === String(D[k]); return `<button role="tab" aria-selected="${on}" data-a="${act}" ${attr || ''} data-f="${k}" data-v="${v}" style="flex:1;min-width:0;height:38px;padding:0 4px;border:0;border-radius:19px;font:inherit;font-size:13px;font-weight:500;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:${on ? PINK : 'transparent'};color:${on ? '#2f2f2f' : 'var(--gray800,#afafaf)'}">${esc(l)}</button>`; }).join('')}</div>`;
    const grp = (k, label, extra) => `<div class="msh-dbf" data-key="dbf-${k}" style="display:flex;flex-direction:column;gap:6px">${cap(esc(label))}${seg(k)}${extra || ''}</div>`;
    const card = D.mode === 'card' || D.mode === 'both', pop = D.mode === 'popup' || D.mode === 'both';
    return `<div class="msh-dbm" data-key="dbm" style="display:flex;flex-direction:column;gap:12px">
      ${grp('mode', `Når det ringer · ${who}`, sub(`${(MODES.find((m) => m[0] === D.mode) || MODES[0])[2]} · gjelder deg på denne enheten`, 'dbm-sub'))}
      ${grp('trigger', 'Utløses når', sub((DB_OPTS.trigger.find((t) => t[0] === D.trigger) || DB_OPTS.trigger[0])[2] + ' · entiteten velges i Enhet → Ringe-utløser', 'dbt-sub'))}
      ${grp('cooldown_s', 'Ignorer ny ringing i', sub('Ny ringing innenfor tiden gir ikke nytt varsel, men nullstiller tiden', 'dbc-sub'))}
      ${card ? grp('card_duration_min', 'Kortet på Hjem vises i') : ''}
      ${pop ? grp('auto_close_min', 'Popupen lukkes etter', sub('Uten aktivitet – trykk eller scroll i popupen nullstiller', 'dba-sub')) : ''}</div>`;
  };

  /* ------------------------------------------------------------ ringetilstand */
  const R = (M.ring = M.ring || { t: 0, until: 0, dismissed: false, unlocked: false, last: {}, n: 0, states: null });
  const cards = new Set();
  function cfgNow() {
    for (const c of cards) if (c.isConnected && c._config) return c.config;
    const s = M.store && M.store.eff ? M.store.eff('cards.' + CID) : null;
    return { ...DEF, ...(s || {}) };
  }
  M.ringCfg = cfgNow;
  function emit() { try { window.dispatchEvent(new CustomEvent('ki-doorbell', { detail: { t: R.t, n: R.n, active: M.ringActive() } })); } catch (e) { /* */ } }
  M.ringActive = () => !!R.t && !R.dismissed && Date.now() < R.until;
  const hasCard = (m) => m === 'card' || m === 'both';
  // Rosa prikk på Hjem-fanen mens ringe-kortet vises (til det er avvist)
  M.ringDot = () => M.ringActive() && hasCard(M.doorbellMode());
  // Varigheten (20.1): kortet (Kort/Begge/Av) = card_duration_min, bare popup = auto_close_min; 0 = til avvist
  function setUntil(db, t0) {
    const mins = db.mode === 'popup' ? db.auto_close_min : db.card_duration_min;
    R.until = mins > 0 ? t0 + mins * 60000 : Infinity;
    clearTimeout(R.timer);
    if (isFinite(R.until)) R.timer = setTimeout(emit, Math.max(0, R.until - Date.now()) + 50);
  }
  // Starttidspunktet i sessionStorage, så reload/fanebytte midt i varselet fortsetter nedtellingen
  const SS = 'ki:ring-alert';
  function ssSave() {
    try {
      if (R.t && !R.dismissed && Date.now() < R.until) sessionStorage.setItem(SS, JSON.stringify({ t: R.t, until: isFinite(R.until) ? R.until : null, n: R.n, shake: R.shakeFrom || 0 }));
      else sessionStorage.removeItem(SS);
    } catch (e) { /* */ }
  }
  if (!R.t) try {
    const s = JSON.parse(sessionStorage.getItem(SS) || 'null'), until = s && (s.until == null ? Infinity : Number(s.until));
    if (s && s.t && Date.now() < until) {
      R.t = Number(s.t); R.until = until; R.dismissed = false; R.n = Math.max(R.n, Number(s.n) || 1); R.shakeFrom = Number(s.shake) || 0;
      if (isFinite(until)) R.timer = setTimeout(emit, until - Date.now() + 50);
    } else if (s) sessionStorage.removeItem(SS);
  } catch (e) { /* */ }
  M.ringNow = function (force) {
    const c = cfgNow(), db = M.doorbellCfg(c), mode = db.mode, now = Date.now();
    // «Ignorer ny ringing i»: ingen ny haptic/scroll/popup, men «X s siden» og tidslinjen nullstilles
    if (!force && R.t && db.cooldown_s > 0 && now - R.t < db.cooldown_s * 1000) {
      R.t = now;
      if (!R.dismissed) setUntil(db, now);
      ssSave(); emit();
      return false;
    }
    R.t = now; R.dismissed = false; R.unlocked = false; R.n++; R.shakeFrom = 0;
    setUntil(db, now);
    if (c.haptic !== false) M.haptic('heavy');
    if ((mode === 'popup' || mode === 'both') && location.hash !== HASH) { R.autoOpened = true; M.openPopup(HASH); }
    ssSave(); emit();
    return true;
  };
  M.ringSimulate = () => M.ringNow(true); // «Simuler ringing» (test og designets «…»-meny)
  M.ringDismiss = function () { R.dismissed = true; clearTimeout(R.timer); ssSave(); emit(); };
  M.ringTick = function (h) {
    if (!h || !h.states || h.states === R.states) return;
    R.states = h.states;
    muteRestore(h);
    const c = cfgNow(), A = M.ringAuto(h, c), db = M.doorbellCfg(c);
    // Utløser (20.1): 'on' = binary_sensor off → on, 'event' = ny hendelse på event.* (faller tilbake til den andre typen)
    const all = [A.ring, ...A.events.filter((e) => e !== A.ring && /ring|doorbell/.test(e))].filter(Boolean);
    const bin = all.filter((id) => id.startsWith('binary_sensor.')), evs = all.filter((id) => id.startsWith('event.'));
    const trig = new Set(db.trigger === 'event' ? (evs.length ? evs : bin) : (bin.length ? bin : evs));
    let hit = false;
    all.forEach((id) => {
      const s = h.states[id];
      if (!s) return;
      const bs = id.startsWith('binary_sensor.');
      if (!bs && M.unavailable(s)) return; // utilgjengelig → tilbake er ingen ny hendelse
      const prev = R.last[id], v = bs ? s.state : `${s.state}|${s.last_changed || ''}|${s.attributes.event_type || ''}`;
      R.last[id] = v;
      if (prev === undefined || !trig.has(id)) return; // første verdi (innlasting) er ikke en ringing
      if (bs) { if (v === 'on' && prev !== 'on') hit = true; } else if (v !== prev) hit = true;
    });
    if (hit && !(R.t && Date.now() - R.t < 1500 && !R.dismissed)) M.ringNow(); // binary + event samtidig = én ringing
  };

  /* ------------------------------------------------------------ handlinger (felles for popup og Hjem-kortet) */
  const autoLockTxt = (h, lock) => {
    const D = onDev(h, devOf(h, lock)), txt = (x) => x + ' ' + String(h.states[x].attributes.friendly_name || '');
    const sw = D.find((x) => /^(switch|input_boolean)\./.test(x) && AUTO_RX.test(txt(x)));
    if (sw && !M.isOn(h.states[sw])) return null;
    const n = D.find((x) => /^(number|input_number)\./.test(x) && AUTO_RX.test(txt(x)));
    const s = n && h.states[n];
    if (!s || !M.isNum(s.state) || Number(s.state) <= 0) return sw ? 'litt' : null;
    const u = String(s.attributes.unit_of_measurement || 's');
    return `${M.nf(Number(s.state))} ${/^m/.test(u) ? 'min' : /^h|^t/.test(u) ? 't' : 's'}`;
  };
  M.ringUnlock = function (card, A) {
    const h = card.hass || M.lastHass;
    if (!h || !A.lock) return;
    const al = autoLockTxt(h, A.lock);
    const tt = (t) => M.toast(al ? `${t} · låses igjen om ${al}` : t);
    const r = M.lockUnlock ? M.lockUnlock(card, A.lock, { toast: tt }) : M.call(h, 'lock', 'unlock', { entity_id: A.lock }).then(() => { M.haptic('success'); tt('Låst opp'); });
    R.unlocked = true;
    emit();
    return r;
  };
  M.ringSpeak = function (h, A, c, r) {
    if (!h || !A.speaker || !r) return;
    const text = typeof r === 'string' ? r : String(r.text || '');
    let p;
    if (r.media) p = M.call(h, 'media_player', 'play_media', { entity_id: A.speaker, media_content_id: r.media, media_content_type: r.media_type || 'music' });
    else {
      const tts = real(h, c.tts) || M.all(h, 'tts')[0];
      if (!tts) { M.haptic('failure'); M.toast('Fant ingen TTS-tjeneste (tts.*)'); return; }
      p = M.call(h, 'tts', 'speak', { entity_id: tts, media_player_entity_id: A.speaker, message: text });
    }
    return p.then(() => { M.haptic('success'); M.toast('Spilt av: ' + text); }).catch(() => {});
  };
  // Egen tekst: lite ark (portalt ut av popupen, fallgruve 1)
  M.ringCustom = function (h, A, c) {
    const ov = M.overlay({ center: true, maxWidth: 380, css: `.w{display:flex;flex-direction:column;gap:12px}.t{font-size:18px;font-weight:600}.in{height:48px;border-radius:24px;border:0;padding:0 18px;background:var(--gray300,#404040);color:#fafafa;font:inherit;font-size:15px;outline:none}.r{display:flex;gap:8px}.b{flex:1;height:46px;border-radius:23px;border:0;font:inherit;font-weight:600;cursor:pointer;background:var(--gray300,#404040);color:#fafafa}.b.p{background:${PINK};color:#2f2f2f}`,
      html: `<form class="w"><span class="t">Si noe i høyttaleren</span><input class="in" name="t" placeholder="Egen tekst …" autocomplete="off" enterkeyhint="send"><div class="r"><button type="button" class="b" data-x>Avbryt</button><button class="b p">Spill av</button></div></form>` });
    const f = ov.body.querySelector('form'), inp = f.querySelector('input');
    setTimeout(() => inp.focus(), 60);
    f.querySelector('[data-x]').addEventListener('click', () => { M.haptic('light'); ov.close(); });
    f.addEventListener('submit', (e) => { e.preventDefault(); const t = inp.value.trim(); if (!t) return; ov.close(); M.ringSpeak(h, A, c, { text: t }); });
    return ov;
  };
  // Avvis: demp ringelyden i mute_min minutter (number.*_doorbell_ring_volume = 0), gjenopprettes etterpå
  const MUTE_LS = 'ki:ring-mute';
  const muteGet = () => { try { return JSON.parse(localStorage.getItem(MUTE_LS) || 'null'); } catch (e) { return null; } };
  const muteSet = (v) => { try { if (v) localStorage.setItem(MUTE_LS, JSON.stringify(v)); else localStorage.removeItem(MUTE_LS); } catch (e) { /* */ } };
  let muteT = 0;
  function muteRestore(h) {
    const m = muteGet();
    if (!m || !h) return;
    clearTimeout(muteT);
    const left = m.until - Date.now();
    if (left > 0) { muteT = setTimeout(() => muteRestore(M.lastHass || h), Math.min(left + 200, 2 ** 31 - 1)); return; }
    muteSet(null);
    const d = String(m.id).split('.')[0];
    if (h.states[m.id]) M.call(h, d, 'set_value', { entity_id: m.id, value: m.v }).catch(() => {});
  }
  M.ringMute = function (h, A, c) {
    const min = c.mute_min != null && c.mute_min !== '' ? Number(c.mute_min) : 5;
    const s = A.volume && h && h.states[A.volume];
    if (!s || !min) return;
    const old = muteGet(), cur = Number(s.state);
    const v = old && old.id === A.volume ? old.v : cur;
    if (!(v > 0)) return;
    muteSet({ id: A.volume, v, until: Date.now() + min * 60000 });
    M.call(h, A.volume.split('.')[0], 'set_value', { entity_id: A.volume, value: 0 }).catch(() => {});
    muteRestore(h);
  };
  M.ringAvvis = function (h, A, c) { M.ringDismiss(); M.ringMute(h, A, c); };

  /* ------------------------------------------------------------ lenke + kaldstart (19.19) */
  M.ringLink = function (h) {
    h = h || M.lastHass;
    const pu = h && h.panelUrl;
    const p = M.strategyIsDashboard && pu ? `/${pu}/hjem` : location.pathname;
    return String(p).replace(/\/$/, '') + HASH;
  };
  const deepFind = (root, fn, d = 0, out = []) => {
    if (!root || d > 14 || !root.querySelectorAll) return out;
    root.querySelectorAll('*').forEach((e) => { if (fn(e)) out.push(e); if (e.shadowRoot) deepFind(e.shadowRoot, fn, d + 1, out); });
    return out;
  };
  const popupOf = () => deepFind(document, (e) => e.localName === 'bubble-card' && ((e.config && e.config.hash) || (e._config && e._config.hash)) === HASH)[0] || null;
  const popOpen = (bc) => { const p = deepFind(bc.shadowRoot || bc, (e) => e.classList && e.classList.contains('bubble-pop-up'))[0] || (bc.querySelector && bc.querySelector('.bubble-pop-up')); return p ? p.classList.contains('is-popup-opened') : null; };
  M.ringColdStart = function () {
    if (M.__ringCold) return;
    M.__ringCold = true;
    if (location.hash !== HASH) return;
    const t0 = Date.now();
    let n = 0;
    const tick = () => {
      if (location.hash !== HASH || Date.now() - t0 > 20000 || n > 8) return;
      const bc = popupOf();
      if (bc) {
        const o = popOpen(bc);
        if (o === true) return;
        n++;
        window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: true } }));
        if (o === null && n > 2) return; // ingen popup-DOM å sjekke mot (ikke Bubble Card) – gi opp etter noen forsøk
      }
      setTimeout(tick, bc ? 700 : 350);
    };
    setTimeout(tick, 250);
  };
  // Popup: lukket auto-åpnet popup = avvist. Begge: kortet på Hjem blir liggende (klokken rister på nytt).
  const onLeave = () => {
    if (location.hash === HASH || !R.autoOpened) return;
    R.autoOpened = false;
    const m = M.doorbellMode();
    if (m === 'popup' && M.ringActive()) M.ringDismiss();
    else if (m === 'both' && M.ringActive()) { R.shakeFrom = Date.now(); ssSave(); emit(); }
  };
  // MSH.closePopup / Bubble Card lukker med replaceState + location-changed (ingen hashchange)
  ['hashchange', 'location-changed', 'popstate'].forEach((ev) => window.addEventListener(ev, () => setTimeout(onLeave, 0)));

  /* ------------------------------------------------------------ hold for å låse opp (felles) */
  // el: knappen, fill: fyll-elementet (transform scaleX/scaleY 0 → 1), ms: hold-tid, done(): låser opp
  function bindHold(el, getMs, done) {
    if (!el || el.__hold) return;
    el.__hold = true;
    M.guardDrag(el, 'none');
    let T = null, x0 = 0, y0 = 0;
    const fill = () => el.querySelector('.fill');
    const stop = () => { if (!T) return; clearTimeout(T); T = null; el.classList.remove('holding'); const f = fill(); if (f) { f.style.transition = 'transform .2s'; f.style.transform = ''; } };
    el.addEventListener('pointerdown', (e) => {
      const ms = getMs();
      if (e.button || !ms || el.disabled) return;
      e.stopPropagation();
      x0 = e.clientX; y0 = e.clientY;
      el.classList.add('holding');
      M.haptic('light');
      const f = fill();
      if (f) { f.style.transition = 'none'; f.style.transform = ''; void f.offsetWidth; f.style.transition = `transform ${ms}ms linear`; f.style.transform = el.dataset.axis === 'x' ? 'scaleX(1)' : 'scaleY(1)'; }
      T = setTimeout(() => { T = null; el.classList.remove('holding'); el.__swallow = Date.now(); done(); const ff = fill(); if (ff) { ff.style.transition = 'transform .3s'; ff.style.transform = ''; } }, ms);
    });
    el.addEventListener('pointermove', (e) => { if (T && Math.hypot(e.clientX - x0, e.clientY - y0) > 14) stop(); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((t) => el.addEventListener(t, stop));
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  const holdMs = (c) => (c.hold_ms != null && c.hold_ms !== '' ? Number(c.hold_ms) : 1000);
  const holdLabel = (ms) => (ms ? `Hold ${M.nf(ms / 1000, ms % 1000 ? 1 : 0)} s` : 'Trykk');

  /* ============================================================ popup-kortet */
  class Ringeklokke extends M.Card {
    static get cardName() { return 'Ringeklokke'; }
    static get defaults() { return { ...DEF }; }
    static getStubConfig() { return { card_id: M.uid(), ...DEF, replies: REPLIES.map((r) => ({ ...r })) }; }
    static get schema() {
      return (h, c) => {
        c = c || {};
        const A = h ? M.ringAuto(h, c) : { cams: [] };
        const nm = (id) => (id && h && h.states[id] ? `${M.name(h, id)} (${id})` : id || '');
        const ent = (name, label, domain, auto) => ({ type: 'entity', name, label, domain, auto: () => auto || null });
        const use = (name, label) => ({ type: 'boolean', label, get: (hh, cc) => cc[name] !== 'none', set: (v, hh, cc, ed) => ed._set(name, v ? undefined : 'none') });
        return [
          { type: 'section', id: 'enhet', label: 'Enhet', icon: 'mdi:doorbell-video', open: true, fields: [
            ent('ring_entity', 'Ringe-utløser (binary_sensor.*_doorbell / event.*)', ['binary_sensor', 'event'], A.ring),
            ent('camera', 'Kamera', 'camera', A.camera),
            use('package_camera', 'Pakkekamera (av = (ingen))'),
            ...(c.package_camera === 'none' ? [] : [ent('package_camera', 'Pakkekamera', 'camera', A.pkg)]),
            use('lock', 'Lås opp-knapp (av = (ingen))'),
            ...(c.lock === 'none' ? [] : [ent('lock', 'Lås som låses opp', 'lock', A.lock)]),
            use('speaker', 'Svar via høyttaler (av = (ingen))'),
            ...(c.speaker === 'none' ? [] : [ent('speaker', 'Høyttaler for svar', 'media_player', A.speaker)]),
            ent('tts', 'TTS-tjeneste', 'tts', h ? M.all(h, 'tts')[0] : null),
            { type: 'html', html: (hh) => `<div class="f"><label>Lenke for varsler</label><div class="line" style="gap:8px"><code style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px">${esc(M.ringLink(hh))}</code><button class="btn" data-a="fn" data-k="__K__" style="flex:none">Kopier</button></div><span class="help">Lim inn i varsel-automasjonen (iOS data.url, Android data.clickAction).${A.ring ? ' Ringeklokke: ' + esc(nm(A.ring)) : ''}</span></div>`, click: () => copyLink() },
          ] },
          { type: 'section', id: 'handlinger', label: 'Handlinger', icon: 'mdi:gesture-tap-hold', fields: [
            { type: 'select', name: 'hold_ms', label: 'Hold-tid for Lås opp', options: [[500, '0,5 s'], [1000, '1 s'], [2000, '2 s'], [0, 'Trykk']], default: 1000 },
            { type: 'select', name: 'mute_min', label: '«Avvis» demper ringelyden i', options: [[0, 'Ikke'], [5, '5 min'], [15, '15 min'], [60, '1 t']], default: 5 },
            { type: 'boolean', name: 'snapshot', label: 'Ta bilde', default: true },
            { type: 'boolean', name: 'haptic', label: 'Vibrer når det ringer', default: true },
            { type: 'boolean', name: 'package_first', label: 'Vis pakkekamera først (når pakke er oppdaget)', default: true },
          ] },
          { type: 'section', id: 'svar', label: 'Svar', icon: 'mdi:message-reply-text-outline', fields: [{ type: 'html', html: (hh, cc, key, ed) => repliesGUI(cc, key, ed), click: (d, ed) => repliesClick(d, ed) }] },
          { type: 'section', id: 'visning', label: 'Visning', icon: 'mdi:eye-outline', fields: [
            { type: 'html', html: (hh, cc, key) => `<div class="f">${M.doorbellModeHTML('fn', `data-k="${key}"`)}</div>`, click: (d, ed) => { M.setDoorbell(d.f || 'mode', d.v); ed._render(); } },
            { type: 'html', html: (hh, cc, key) => { const on = new Set(detsOf(cc)); return `<div class="f"><label>Deteksjoner som vises</label><div class="chips">${DET.map(([k, l]) => `<button class="chip ${on.has(k) ? 'on' : ''}" aria-pressed="${on.has(k)}" data-a="fn" data-k="${key}" data-v="${k}">${esc(l)}</button>`).join('')}</div></div>`; }, click: (d, ed) => { const s = new Set(detsOf(ed._config)); if (s.has(d.v)) s.delete(d.v); else s.add(d.v); M.haptic('selection'); ed._set('detections', DET_KEYS.filter((k) => s.has(k))); } },
            { type: 'boolean', name: 'show_replies', label: 'Svar via høyttaleren', default: true },
            { type: 'boolean', name: 'show_history', label: 'Tidligere i dag', default: true },
          ] },
        ].map((s) => ({ ...s, fields: s.fields.map((f) => (f.type === 'html' && f.click && /__K__/.test(String(f.html)) ? { ...f, html: (hh, cc, key, ed) => f.html(hh, cc, key, ed).replace(/__K__/g, key) } : f)) }));
      };
    }
    get cardSize() { return 10; }
    constructor() { super(); this._act = () => this._touch(); }
    connectedCallback() {
      super.connectedCallback();
      cards.add(this);
      M.ringColdStart();
      if (!this._onRing) { this._onRing = () => this.update(); window.addEventListener('ki-doorbell', this._onRing); }
      this.shadowRoot.addEventListener('pointerdown', this._act, true);
    }
    disconnectedCallback() {
      super.disconnectedCallback();
      cards.delete(this);
      if (this._onRing) { window.removeEventListener('ki-doorbell', this._onRing); this._onRing = null; }
      this.shadowRoot.removeEventListener('pointerdown', this._act, true);
    }
    set hass(h) { super.hass = h; M.ringTick(h); }
    get hass() { return super.hass; }
    customize(focus) { return openSheet(this, focus); }
    onOpen() { this._touch(); this._tk = setInterval(() => this._tickText(), 1000); this.update(); }
    onClose() {
      clearTimeout(this._ac); clearInterval(this._tk); this._tk = 0;
      this.shadowRoot.querySelectorAll('.strm').forEach((b) => { b.textContent = ''; }); // strømmen stoppes når popupen lukkes
    }
    // Aktivitet i popupen → auto-lukk-tiden starter på nytt
    _touch() {
      clearTimeout(this._ac);
      const db = M.doorbellCfg(this.config), mins = db.mode === 'popup' || db.mode === 'both' ? db.auto_close_min : 0; // 20.1: bare ved Popup/Begge
      if (!this.isOpen || !(mins > 0)) return;
      this._ac = setTimeout(() => { if (location.hash === HASH && !(M.drafts && [...M.drafts.values()].some((d) => d.card === this && !d.closed))) M.closePopup(); }, mins * 60000);
    }
    _tickText() {
      const el = this.shadowRoot.querySelector('[data-ago]');
      if (!el || !this.hass) return;
      const A = M.ringAuto(this.hass, this.config), t = lastRingT(this.hass, A), txt = this._subTxt(A, t);
      if (el.textContent !== txt) el.textContent = txt;
    }
    _subTxt(A, t) { return `${areaLabel(this.hass, A)} · ${t ? 'ringte ' + agoTxt(t) : 'ingen ringing i dag'}`; }
    render() {
      const c = this.config, h = this.hass, A = M.ringAuto(h, c);
      [A.ring, A.camera, A.pkg, A.lock, A.speaker, A.last, A.volume, ...Object.values(A.det), ...A.events].forEach((id) => id && this.s(id));
      const pkgOn = A.det.package && M.isOn(h.states[A.det.package]);
      let cam = this.ui.cam || (c.package_first !== false && pkgOn && A.pkg ? 'pkg' : 'main');
      if (cam === 'pkg' && !A.pkg) cam = 'main';
      if (cam === 'main' && !A.camera && A.pkg) cam = 'pkg';
      const camId = (this._camId = cam === 'pkg' ? A.pkg : A.camera), sound = !!this.ui.sound, active = M.ringActive();
      const t = lastRingT(h, A), chips = chipsOf(h, A, c);
      const media = camId ? (customElements.get('ha-camera-stream') ? `<div class="strm" data-nomorph data-cam="${esc(camId)}" data-key="strm-${esc(camId)}"></div>` : camImg(h, camId) ? `<img class="im" src="${esc(camImg(h, camId))}" alt="" draggable="false" data-key="img-${esc(camId)}">` : '') : '';
      const seg = A.pkg && A.camera ? `<div class="seg" role="tablist">${[['main', 'Kamera'], ['pkg', 'Pakkekamera']].map(([k, l]) => `<button class="sg ${k === cam ? 'on' : ''}" role="tab" aria-selected="${k === cam}" data-act="cam" data-v="${k}" data-haptic="selection">${esc(l)}</button>`).join('')}</div>` : '<span></span>';
      const vid = `<section class="vid" data-key="vid">
        <div class="ph">${M.icon(A.ring ? 'mdi:doorbell-video' : 'mdi:help-circle-outline', 44)}</div>${media}
        <div class="top"><span class="live">${camId && h.states[camId] && !M.unavailable(h.states[camId]) ? '<i></i>LIVE' : '–'}</span>${seg}<span class="grow"></span>
          ${camId ? `<button class="rb" data-act="sound" data-haptic="selection" aria-pressed="${sound}" title="${sound ? 'Lyd av' : 'Lyd på'}">${M.icon(sound ? 'mdi:volume-high' : 'mdi:volume-off', 20)}</button>` : ''}
          <button class="rb" data-act="customize" data-haptic="light" title="Tilpass ringeklokke">${M.icon('mdi:cog', 20)}</button></div>
        <div class="bot"><div class="tt">${esc(active ? 'Det ringer på' : A.ring ? 'Ringeklokke' : '–')}</div><div class="st" data-ago>${esc(A.ring ? this._subTxt(A, t) : 'Fant ingen ringeklokke (UniFi Protect)')}</div>
          ${chips.length ? `<div class="dcs">${chips.map(chipHTML).join('')}</div>` : ''}</div>
      </section>`;
      if (!A.ring) return `<div class="wrap">${vid}${M.emptyState('Fant ingen ringeklokke – velg ringe-utløser (binary_sensor.*_doorbell)', 'enhet')}</div>`;
      // Handlinger: Ta bilde · Lås opp · Avvis (skjulte deler plassen)
      const ms = holdMs(c), lk = A.lock && h.states[A.lock], unl = lk && /^(unlocked|open|unlocking|opening)$/.test(lk.state);
      const acts = [];
      if (c.snapshot !== false && camId) acts.push(`<button class="ac" data-act="snap" data-haptic="light" data-key="ac-snap">${M.icon('mdi:camera-iris', 26)}<span>Ta bilde</span></button>`);
      if (A.lock) acts.push(`<button class="ac un ${unl ? 'done' : ''}" data-act="unlock" data-haptic="off" data-key="ac-un" ${lk ? '' : 'disabled'}><span class="fill"></span>${M.icon(unl ? 'mdi:lock-open-check' : 'mdi:lock-open-variant', 26)}<span>${unl ? 'Låst opp' : 'Lås opp'}</span><i>${unl ? esc(M.name(h, A.lock)) : esc(holdLabel(ms))}</i></button>`);
      acts.push(`<button class="ac" data-act="dismiss" data-haptic="light" data-key="ac-x">${M.icon('mdi:bell-off-outline', 26)}<span>Avvis</span></button>`);
      const grid = `<section class="acts" style="grid-template-columns:repeat(${acts.length},minmax(0,1fr))" data-key="acts">${acts.join('')}</section>`;
      const reply = A.speaker && c.show_replies !== false ? `<section class="sec" data-key="svar"><div class="cap">Svar via høyttaleren</div><div class="rps noscroll">${reps(c).map((r, i) => `<button class="rp" data-act="reply" data-i="${i}" data-haptic="light">${r.icon ? M.icon(r.icon, 18) : ''}${esc(r.text)}</button>`).join('')}<button class="rp own" data-act="custom" data-haptic="light">${M.icon('mdi:plus', 18)}Egen tekst</button></div></section>` : '';
      const hist = c.show_history !== false ? this._history(h, A, camId || A.camera) : '';
      return `<div class="wrap">${vid}${grid}${reply}${hist}</div>`;
    }
    // Tidligere i dag: tre siste hendelser fra event.* (ringeklokke, pakke, kjøretøy, smart detection)
    _history(h, A, cam) {
      const today = new Date().toDateString();
      const ev = A.events.map((id) => ({ id, s: h.states[id], t: tsOf(h.states[id]) })).filter((e) => e.t && new Date(e.t).toDateString() === today).sort((a, b) => b.t - a.t).slice(0, 3);
      const dn = A.dev && h.devices && h.devices[A.dev] && h.devices[A.dev].name;
      const ET = { ring: 'Ringeklokke', doorbell: 'Ringeklokke', package: 'Pakke', vehicle: 'Kjøretøy', person: 'Person', animal: 'Dyr', face: 'Ansikt', smart_detection: 'Smart deteksjon' };
      const pre = [dn, A.area && M.areaName(h, A.area), (A.ring || '').split('.')[1].split('_')[0]].filter(Boolean).map((x) => String(x).toLowerCase());
      const lab = (e) => {
        const et = String(e.s.attributes.event_type || '').toLowerCase();
        if (ET[et]) return ET[et] + (et === 'face' && e.s.attributes.name ? ' · ' + e.s.attributes.name : '');
        let n = String(e.s.attributes.friendly_name || e.id.split('.')[1]);
        pre.forEach((x) => { if (n.toLowerCase().startsWith(x + ' ')) n = n.slice(x.length + 1); });
        return n.charAt(0).toUpperCase() + n.slice(1);
      };
      const rows = ev.map((e) => {
        const src = e.s.attributes.entity_picture ? (h.hassUrl ? h.hassUrl(e.s.attributes.entity_picture) : e.s.attributes.entity_picture) : camImg(h, cam);
        return `<button class="hr" data-act="more" data-id="${esc(e.id)}" data-key="hr-${esc(e.id)}"><span class="hi">${src ? `<img src="${esc(src)}" alt="" draggable="false">` : M.icon('mdi:image-off-outline', 20)}</span><span class="col grow" style="gap:2px;min-width:0"><span class="ell" style="font-size:14px">${esc(lab(e))}</span><span class="dim" style="font-size:12px">${esc(hm(e.t))}</span></span>${M.icon('mdi:chevron-right', 20, 'color:var(--gray600,#7f7f7f)')}</button>`;
      }).join('');
      return `<section class="sec" data-key="hist"><div class="cap">Tidligere i dag</div><div class="hbox">${rows || '<div class="dim" style="font-size:13px;padding:14px 4px">Ingen hendelser i dag</div>'}</div></section>`;
    }
    onAction(name, el, ev) {
      const d = el.dataset, h = this.hass, c = this.config, A = M.ringAuto(h, c);
      this._touch();
      if (name === 'cam') { if (d.v !== this.ui.cam) this.setUI({ cam: d.v }); return; }
      if (name === 'sound') { this.setUI({ sound: !this.ui.sound }); return; }
      if (name === 'snap') {
        const cam = this._camId || A.camera || A.pkg;
        if (!cam) return;
        const n = new Date(), f = `${n.getFullYear()}${M.pad(n.getMonth() + 1)}${M.pad(n.getDate())}_${M.pad(n.getHours())}${M.pad(n.getMinutes())}${M.pad(n.getSeconds())}`;
        return M.call(h, 'camera', 'snapshot', { entity_id: cam, filename: `/media/ringeklokke/${f}.jpg` }).then(() => { M.haptic('success'); M.toast('Bilde lagret i Media → ringeklokke'); }).catch(() => {});
      }
      if (name === 'unlock') {
        if (el.__swallow && Date.now() - el.__swallow < 700) return;
        const lk = A.lock && h.states[A.lock];
        if (lk && /^(unlocked|open)$/.test(lk.state)) return M.call(h, 'lock', 'lock', { entity_id: A.lock }).then(() => { M.haptic('success'); M.toast('Låst'); }).catch(() => {});
        if (holdMs(c)) { M.haptic('warning'); return M.toast('Hold inne for å låse opp'); }
        return M.ringUnlock(this, A);
      }
      if (name === 'dismiss') { M.ringAvvis(h, A, c); M.closePopup(); return; }
      if (name === 'reply') return M.ringSpeak(h, A, c, reps(c)[Number(d.i)]);
      if (name === 'custom') return M.ringCustom(h, A, c);
      return super.onAction(name, el, ev);
    }
    afterRender() {
      const root = this.shadowRoot, h = this.hass;
      root.querySelectorAll('.strm').forEach((box) => {
        const id = box.dataset.cam, st = h && h.states[id];
        if (!st) return;
        let el = box.firstElementChild;
        if (!el) {
          if (!this.isOpen) return;
          el = document.createElement('ha-camera-stream');
          el.controls = false; el.allowExoPlayer = true;
          el.fitMode = 'cover'; el.setAttribute('fit-mode', 'cover');
          box.appendChild(el);
        }
        el.muted = !this.ui.sound;
        el.hass = h;
        if (el.stateObj !== st) el.stateObj = st;
      });
      const rp = root.querySelector('.rps');
      if (rp && !rp.__b) { rp.__b = true; const stop = (e) => e.stopPropagation(); rp.addEventListener('touchstart', stop, { passive: true }); rp.addEventListener('touchmove', stop, { passive: true }); rp.addEventListener('pointerdown', stop); }
      const un = root.querySelector('.ac.un:not(.done)');
      if (un) bindHold(un, () => { const lk = h && h.states[M.ringAuto(h, this.config).lock]; return lk && /^(unlocked|open)$/.test(lk.state) ? 0 : holdMs(this.config); }, () => { this._touch(); M.ringUnlock(this, M.ringAuto(this.hass, this.config)); });
    }
    get styles() {
      return `
        .wrap{display:flex;flex-direction:column;gap:var(--msh-gap, 14px)}
        button{touch-action:manipulation}
        .vid{position:relative;height:300px;border-radius:28px;overflow:hidden;background:#1d1d1d;box-shadow:${C.edge}}
        .vid .ph{position:absolute;inset:0;display:grid;place-items:center;color:var(--gray500,#696969)}
        .strm,.im{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
        .strm>*{width:100%;height:100%;display:block;--video-max-height:300px}
        .top{position:absolute;left:12px;right:12px;top:12px;display:flex;align-items:center;gap:8px;z-index:2}
        .live{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;border-radius:14px;background:rgba(0,0,0,0.45);font-size:12px;font-weight:600;letter-spacing:.06em;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
        .live i{width:7px;height:7px;border-radius:4px;background:${RED}}
        .seg{display:flex;gap:2px;padding:3px;border-radius:18px;background:rgba(0,0,0,0.45);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
        .sg{height:28px;padding:0 12px;border-radius:14px;font-size:12px;font-weight:500;color:#e1e1e1;white-space:nowrap}
        .sg.on{background:#fafafa;color:#232323}
        .rb{width:40px;height:40px;border-radius:20px;display:grid;place-items:center;background:rgba(0,0,0,0.45);color:#fafafa;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);flex:none}
        .bot{position:absolute;left:0;right:0;bottom:0;padding:40px 18px 16px;background:linear-gradient(180deg,transparent,rgba(0,0,0,0.75));z-index:2;display:flex;flex-direction:column;gap:2px}
        .bot .tt{font-size:22px;font-weight:600;letter-spacing:-0.01em}
        .bot .st{font-size:13px;color:#d0d0d0}
        .dcs{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
        .dc{display:inline-flex;align-items:center;gap:4px;height:26px;padding:0 10px 0 8px;border-radius:13px;background:rgba(255,255,255,0.18);font-size:12px;font-weight:500;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
        .dc.red{background:rgb(242 128 115 / .85);color:#2f2f2f}
        .acts{display:grid;gap:8px}
        .ac{position:relative;overflow:hidden;height:96px;border-radius:24px;background:var(--gray200,#3a3a3a);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;font-size:14px;font-weight:500;box-shadow:${C.edge};transition:transform .12s}
        .ac:active{transform:scale(.97)}
        .ac>*{position:relative;z-index:1}
        .ac i{font-style:normal;font-size:11px;opacity:.7;margin-top:-4px}
        .ac.un{background:${PINK};color:#2f2f2f;touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
        .ac.un .fill{position:absolute;inset:0;z-index:0;background:${GREEN};transform:scaleY(0);transform-origin:bottom}
        .ac.un.done{background:var(--gray300,#404040);color:${GREEN}}
        .sec{display:flex;flex-direction:column;gap:8px}
        .cap{font-size:12px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;color:var(--gray600,#7f7f7f);padding:0 4px}
        .rps{display:flex;gap:8px;overflow-x:auto;touch-action:pan-x;margin:0 -2px;padding:0 2px}
        .rp{flex:none;display:inline-flex;align-items:center;gap:6px;height:44px;padding:0 16px 0 12px;border-radius:22px;background:var(--gray200,#3a3a3a);font-size:14px;font-weight:500;white-space:nowrap;box-shadow:${C.edge}}
        .rp:active{transform:scale(.96)}
        .rp.own{background:var(--gray300,#404040);color:var(--gray900,#c7c7c7)}
        .hbox{display:flex;flex-direction:column;padding:4px 10px;border-radius:24px;background:var(--gray200,#3a3a3a)}
        .hr{display:flex;align-items:center;gap:12px;min-height:64px;text-align:left;width:100%}
        .hr + .hr{border-top:1px solid rgba(255,255,255,0.05)}
        .hi{width:64px;height:44px;border-radius:12px;overflow:hidden;flex:none;display:grid;place-items:center;background:var(--gray300,#404040);color:var(--gray600,#7f7f7f)}
        .hi img{width:100%;height:100%;object-fit:cover;display:block}
      `;
    }
  }
  M.POPUP_CARDS = M.POPUP_CARDS || [];
  if (!M.POPUP_CARDS.includes('msh-ringeklokke-card')) M.POPUP_CARDS.push('msh-ringeklokke-card'); // «Mellomrom» i editoren
  M.define('msh-ringeklokke-card', Ringeklokke, 'MSH Ringeklokke', 'Ringeklokke-popup (#ringeklokke): live-video, deteksjoner, Ta bilde / Lås opp (hold) / Avvis, svar via høyttaleren og siste hendelser.');

  function copyLink() {
    const t = location.origin + M.ringLink();
    const ok = () => { M.haptic('success'); M.toast('Lenken er kopiert'); };
    try { if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(t).then(ok, () => fallback()); } catch (e) { /* */ }
    return fallback();
    function fallback() { const ta = document.createElement('textarea'); ta.value = t; ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); ok(); } catch (e) { M.toast(t); } ta.remove(); }
  }
  M.ringCopyLink = copyLink;

  /* ------------------------------------------------------------ GUI-editoren: svar-listen */
  function repliesGUI(c, key, ed) {
    if (ed && ed.shadowRoot && !ed.__rp) {
      ed.__rp = true;
      ed.shadowRoot.addEventListener('change', (e) => { const t = e.target; if (!t || !t.dataset || t.dataset.rp == null) return; const L = reps(ed._config).map((r) => ({ ...r })); const i = Number(t.dataset.rp); if (!L[i]) return; L[i].text = t.value; ed._set('replies', L); });
    }
    const L = reps(c);
    return `<div class="f"><label>Svar-tekster (samme rekkefølge som i popupen – «+ Egen tekst» er alltid sist)</label>${L.map((r, i) => `<div class="line" style="gap:6px;margin-bottom:6px" data-key="rp-${i}"><input class="inp" style="flex:1;min-width:0" data-rp="${i}" value="${esc(r.text || '')}" placeholder="Svar-tekst">
      <button class="ib" data-a="fn" data-k="${key}" data-op="mv" data-i="${i}" data-d="-1" title="Opp" ${i ? '' : 'disabled'}>${M.icon('mdi:chevron-up', 18)}</button><button class="ib" data-a="fn" data-k="${key}" data-op="mv" data-i="${i}" data-d="1" title="Ned" ${i < L.length - 1 ? '' : 'disabled'}>${M.icon('mdi:chevron-down', 18)}</button><button class="ib" data-a="fn" data-k="${key}" data-op="rm" data-i="${i}" title="Slett">${M.icon('mdi:delete-outline', 18)}</button></div>`).join('')}
      <button class="btn" data-a="fn" data-k="${key}" data-op="add">${M.icon('mdi:plus', 18)}Legg til svar</button></div>`;
  }
  function repliesClick(d, ed) {
    const L = reps(ed._config).map((r) => ({ ...r })), i = Number(d.i);
    if (d.op === 'add') L.push({ icon: 'mdi:message-text-outline', text: 'Nytt svar' });
    else if (d.op === 'rm') L.splice(i, 1);
    else if (d.op === 'mv') { const j = i + Number(d.d); if (j < 0 || j >= L.length) return; [L[i], L[j]] = [L[j], L[i]]; } else return;
    M.haptic('selection');
    ed._set('replies', L);
  }

  /* ============================================================ «Tilpass ringeklokke» (ark med fire faner) */
  // Samme ark-stil som Ruter/Klima/Vær (MSH.overlay). Utkast (MSH.draftEditor): endringer vises straks i popupen,
  // lagres først ved Ferdig (haptic success). «Når det ringer» er per bruker × enhet og lagres straks.
  const TABS = [['enhet', 'Enhet', 'mdi:doorbell-video'], ['handlinger', 'Handlinger', 'mdi:gesture-tap-hold'], ['svar', 'Svar', 'mdi:message-reply-text-outline'], ['visning', 'Visning', 'mdi:eye-outline']];
  function openSheet(card, focus) {
    if (card._sheet && card._sheet.ov && !card._sheet.ov.closed) return card._sheet;
    let ov = null;
    const st = { tab: TABS.some((t) => t[0] === focus) ? focus : 'enhet', busy: false };
    const ctl = M.draftEditor(card, {
      saveOpts: { scope: 'shared' },
      banner: () => ov && ov.body,
      alive: () => !ov || ov.host.isConnected,
      close: () => ov && ov.close(),
      onBusy: (b) => { st.busy = b; draw(); },
      onReload: () => draw(),
    });
    const D = () => ctl.draft || {};
    // 20.1: auto_open fjernes – false blir doorbell.mode 'off' (lagres ved Ferdig)
    if (D().auto_open !== undefined) { const n = { ...D() }; if (n.auto_open === false) n.doorbell = { ...(n.doorbell || {}), mode: (n.doorbell && n.doorbell.mode) || 'off' }; delete n.auto_open; ctl.set(n); }
    const apply = (patch, hap) => {
      if (st.busy) return;
      const next = { ...D() };
      Object.keys(patch).forEach((k) => { if (patch[k] === undefined) delete next[k]; else next[k] = patch[k]; });
      ctl.set(next);
      if (hap) M.haptic(hap);
      draw();
    };
    const sw = (k, label, sub, def = true) => { const on = D()[k] != null ? D()[k] !== false : def; return `<div class="r"><span class="col grow" style="gap:2px;min-width:0"><span class="rl">${esc(label)}</span>${sub ? `<span class="rs">${esc(sub)}</span>` : ''}</span><button class="tsw ${on ? 'on' : ''}" data-a="sw" data-k="${k}" data-d="${def ? 1 : 0}" role="switch" aria-checked="${on}" aria-label="${esc(label)}"></button></div>`; };
    const segRow = (k, label, opts, def) => { const cur = D()[k] != null && D()[k] !== '' ? Number(D()[k]) : def; return `<div class="fl"><span class="cap">${esc(label)}</span><div class="seg">${opts.map(([v, l]) => `<button class="${v === cur ? 'on' : ''}" aria-selected="${v === cur}" data-a="num" data-k="${k}" data-v="${v}">${esc(l)}</button>`).join('')}</div></div>`; };
    const pick = (k, label, domains, autoId, sub) => {
      const h = card.hass, v = D()[k] || '', ids = Object.keys(h.states).filter((id) => domains.includes(id.split('.')[0])).sort((a, b) => M.name(h, a).localeCompare(M.name(h, b), 'nb'));
      const A = M.ringAuto(h, {}), devIds = new Set(onDev(h, A.dev));
      const ord = [...ids.filter((x) => devIds.has(x)), ...ids.filter((x) => !devIds.has(x))];
      const opt = (val, l) => `<option value="${esc(val)}" ${val === v ? 'selected' : ''}>${esc(l)}</option>`;
      return `<div class="fl"><span class="cap">${esc(label)}</span><select class="sel" data-in="ent" data-k="${k}" aria-label="${esc(label)}">${opt('', `Automatisk (${autoId ? M.name(h, autoId) : 'fant ingen'})`)}${opt('none', '(ingen)')}${ord.map((id) => opt(id, `${M.name(h, id)} · ${id}`)).join('')}${v && v !== 'none' && !ids.includes(v) ? opt(v, v) : ''}</select>${sub ? `<span class="rs" style="padding:0 6px">${esc(sub)}</span>` : ''}</div>`;
    };
    const tabHTML = () => {
      const h = card.hass, A = M.ringAuto(h, D());
      if (st.tab === 'enhet') {
        return `${pick('ring_entity', 'Ringe-utløser', ['binary_sensor', 'event'], M.ringFind(h), '«(ingen)» slår av ringe-varselet')}
          ${pick('camera', 'Kamera (høy / middels / lav oppløsning)', ['camera'], M.ringAuto(h, { ...D(), camera: '' }).camera)}
          ${pick('package_camera', 'Pakkekamera', ['camera'], M.ringAuto(h, { ...D(), package_camera: '' }).pkg, '«(ingen)» skjuler Kamera · Pakkekamera-segmentet')}
          ${pick('lock', 'Lås som låses opp', ['lock'], M.ringAuto(h, { ...D(), lock: '' }).lock, 'Standard: låsen i samme område som ringeklokken · «(ingen)» skjuler Lås opp')}
          ${pick('speaker', 'Høyttaler for svar', ['media_player'], M.ringAuto(h, { ...D(), speaker: '' }).speaker, '«(ingen)» skjuler svar-raden')}
          <div class="fl"><span class="cap">Lenke for varsler</span><div class="r"><code class="lk grow ell">${esc(M.ringLink(h))}</code><button class="nb" data-a="copy">${M.icon('mdi:content-copy', 16)}Kopier</button></div><span class="rs" style="padding:0 6px">Trykk på varselet åpner dashbordet med popupen (iOS data.url, Android data.clickAction).</span></div>`;
      }
      if (st.tab === 'handlinger') {
        return `${segRow('hold_ms', 'Hold-tid for Lås opp', [[500, '0,5 s'], [1000, '1 s'], [2000, '2 s'], [0, 'Trykk']], 1000)}
          ${segRow('mute_min', '«Avvis» demper ringelyden i', [[0, 'Ikke'], [5, '5 min'], [15, '15 min'], [60, '1 t']], 5)}
          <div class="rows">${sw('snapshot', 'Ta bilde', 'Lagres i /media/ringeklokke')}${sw('haptic', 'Vibrer når det ringer', 'Gjelder også når «Når det ringer» er Av')}${sw('package_first', 'Vis pakkekamera først', 'Når pakke er oppdaget')}</div>
          ${A.volume ? '' : '<span class="rs" style="padding:0 6px">Fant ikke ringevolum (number.*_doorbell_ring_volume) – Avvis lukker bare popupen.</span>'}`;
      }
      if (st.tab === 'svar') {
        const L = reps(D());
        return `<div class="rows">${L.map((r, i) => `<div class="r rp" data-key="rp-${i}"><span class="ri">${M.icon(r.icon || 'mdi:message-text-outline', 20)}</span><input class="in grow" data-in="rp" data-i="${i}" value="${esc(r.text || '')}" placeholder="Svar-tekst" aria-label="Svar ${i + 1}">
            <span class="ud"><button data-a="rpmv" data-i="${i}" data-d="-1" aria-label="Flytt opp" ${i ? '' : 'disabled'}>${M.icon('expand_less', 20)}</button><button data-a="rpmv" data-i="${i}" data-d="1" aria-label="Flytt ned" ${i < L.length - 1 ? '' : 'disabled'}>${M.icon('expand_more', 20)}</button></span>
            <button class="eye" data-a="rprm" data-i="${i}" aria-label="Slett">${M.icon('mdi:delete-outline', 20)}</button></div>`).join('')}
            <div class="r dim"><span class="ri">${M.icon('mdi:plus', 20)}</span><span class="rl">Egen tekst</span><span class="rs">alltid sist</span></div></div>
          <button class="more" data-a="rpadd">${M.icon('mdi:plus', 18)}Legg til svar</button>
          ${A.speaker ? '' : '<span class="rs" style="padding:0 6px">Ingen høyttaler valgt – svar-raden vises ikke.</span>'}`;
      }
      const on = new Set(detsOf(D()));
      return `${M.doorbellModeHTML('mode')}
        <div class="fl"><span class="cap">Deteksjoner som vises</span><div class="chips">${DET.map(([k, l, icn]) => `<button class="chip ${on.has(k) ? 'on' : ''}" data-a="det" data-k="${k}" aria-pressed="${on.has(k)}">${M.icon(icn, 16)}${esc(l)}</button>`).join('')}</div></div>
        <div class="rows">${sw('show_replies', 'Svar via høyttaleren')}${sw('show_history', 'Tidligere i dag')}</div>`;
    };
    const draw = () => {
      if (!ov) return;
      const sh = ov.root.querySelector('.sh'), top = sh ? sh.scrollTop : 0;
      box.innerHTML = `<div class="hd"><span class="col grow" style="gap:2px;min-width:0"><span class="tt">Tilpass ringeklokke</span><span class="st">Endringer vises straks · lagres ved Ferdig</span></span>
          <button class="nb" data-a="cancel">Avbryt</button><button class="nb" data-a="reset">Tilbakestill</button><button class="ok" data-a="done" ${st.busy ? 'disabled aria-busy' : ''}>${st.busy ? 'Lagrer …' : 'Ferdig'}</button></div>
        <div class="tabs" role="tablist" data-glass-drag="x">${TABS.map(([k, l, icn]) => `<button class="tab ${k === st.tab ? 'on' : ''}" role="tab" aria-selected="${k === st.tab}" data-a="tab" data-k="${k}">${M.icon(icn, 18)}<span>${esc(l)}</span></button>`).join('')}</div>
        <div class="pane" data-tab="${st.tab}">${tabHTML()}</div>`;
      if (sh) sh.scrollTop = top;
    };
    ov = M.overlay({ html: '', css: SHEET_CSS, maxWidth: 440, tall: true, tilpass: true, onClose: () => { ctl.dispose(); card._sheet = null; } });
    const box = document.createElement('div');
    box.className = 'rk-sheet';
    Object.defineProperty(box, '_config', { get: () => ctl.draft });
    ov.body.appendChild(box);
    ov.root.addEventListener('click', (e) => {
      const el = e.target.closest && e.target.closest('[data-a]');
      if (!el || el.disabled) return;
      const a = el.dataset.a, k = el.dataset.k;
      switch (a) {
        case 'done': M.haptic('success'); return ctl.done();
        case 'cancel': M.haptic('light'); return ctl.cancel();
        case 'reset': { const keep = { type: D().type, card_id: D().card_id }; Object.keys(keep).forEach((x) => keep[x] === undefined && delete keep[x]); ctl.set(keep); M.haptic('warning'); return draw(); }
        case 'tab': if (k !== st.tab) { st.tab = k; M.haptic('light'); draw(); } return undefined;
        case 'sw': { const def = el.dataset.d === '1', cur = D()[k] != null ? D()[k] !== false : def; return apply({ [k]: !cur === def ? undefined : !cur }, 'selection'); }
        case 'num': return apply({ [k]: Number(el.dataset.v) }, 'selection');
        case 'det': { const s = new Set(detsOf(D())); if (s.has(k)) s.delete(k); else s.add(k); return apply({ detections: DET_KEYS.filter((x) => s.has(x)) }, 'selection'); }
        case 'mode': M.setDoorbell(el.dataset.f || 'mode', el.dataset.v); return draw();
        case 'copy': return copyLink();
        case 'rpadd': return apply({ replies: [...reps(D()), { icon: 'mdi:message-text-outline', text: 'Nytt svar' }] }, 'selection');
        case 'rprm': { const L = reps(D()).slice(); L.splice(Number(el.dataset.i), 1); return apply({ replies: L }, 'selection'); }
        case 'rpmv': { const L = reps(D()).slice(), i = Number(el.dataset.i), j = i + Number(el.dataset.d); if (j < 0 || j >= L.length) return undefined; [L[i], L[j]] = [L[j], L[i]]; return apply({ replies: L }, 'selection'); }
        default: return undefined;
      }
    });
    ov.root.addEventListener('change', (e) => {
      const t = e.target;
      if (!t || !t.dataset) return;
      if (t.dataset.in === 'ent') return apply({ [t.dataset.k]: t.value || undefined }, 'selection');
      if (t.dataset.in === 'rp') { const L = reps(D()).map((r) => ({ ...r })), i = Number(t.dataset.i); if (!L[i]) return; L[i].text = t.value; apply({ replies: L }); }
    });
    const tabs = () => ov.root.querySelector('.tabs');
    if (M.glassDrag) setTimeout(() => { const t = tabs(); if (t) M.glassDrag(t, { axis: 'x' }); }, 0);
    card._sheet = { ov, st, box };
    draw();
    return card._sheet;
  }
  const SHEET_CSS = `
    .rk-sheet{display:grid;grid-template-columns:minmax(0,1fr);align-content:start;gap:10px;padding-top:4px}
    .hd{display:flex;align-items:center;flex-wrap:wrap;gap:8px;padding:0 4px 4px}
    .hd>.col{flex:1 1 170px}
    .tt{font-size:22px;font-weight:600;white-space:nowrap}
    .st,.rs{font-size:12px;color:var(--ki-g-t2,var(--gray700,#979797))}
    .nb{height:40px;padding:0 14px;border-radius:20px;background:var(--ki-g-row,var(--gray300,#404040));font-size:14px;font-weight:500;flex:none;display:inline-flex;align-items:center;gap:6px}
    .ok{height:40px;padding:0 18px;border-radius:20px;background:${PINK};color:#5a3a48;font-size:14px;font-weight:600;flex:none}
    .nb:active,.ok:active,.chip:active,.more:active,.tab:active{transform:scale(.96)}
    .tabs{position:relative;display:flex;gap:2px;padding:4px;border-radius:26px;background:var(--ki-g-seg,var(--gray200,#3a3a3a));touch-action:pan-y}
    .tab{flex:1;min-width:0;height:44px;border-radius:22px;display:flex;align-items:center;justify-content:center;gap:6px;font-size:13px;font-weight:500;color:var(--gray800,#afafaf);transition:background .2s,color .2s}
    .tab span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .tab.on{background:${PINK};color:#2f2f2f}
    .pane{display:flex;flex-direction:column;gap:12px;padding-top:4px}
    .fl{display:flex;flex-direction:column;gap:6px}
    .cap{font-size:13px;color:var(--ki-g-t2,var(--gray700,#979797));padding:0 6px}
    .sel{height:48px;border-radius:24px;border:0;padding:0 16px;background:var(--ki-g-row,var(--gray200,#3a3a3a));color:#fafafa;font:inherit;font-size:14px;width:100%;min-width:0;outline:none}
    .seg{display:flex;gap:2px;padding:4px;border-radius:24px;background:var(--ki-g-seg,var(--gray100,#2f2f2f))}
    .seg button{flex:1;height:38px;border-radius:19px;font-size:13px;font-weight:500;color:var(--gray800,#afafaf)}
    .seg button.on{background:${PINK};color:#2f2f2f}
    .rows{display:flex;flex-direction:column;gap:8px}
    .r{display:flex;align-items:center;gap:10px;min-height:56px;padding:0 12px 0 16px;border-radius:28px;background:var(--ki-g-row,var(--gray200,#3a3a3a))}
    .r.dim{opacity:.55}
    .r.rp{padding-left:10px}
    .rl{font-size:15px;font-weight:500}
    .ri{width:24px;flex:none;display:grid;place-items:center;color:var(--gray900,#c7c7c7)}
    .in{height:40px;border-radius:20px;border:0;padding:0 12px;background:var(--ki-g-seg,#282828);color:#fafafa;font:inherit;font-size:14px;min-width:0;outline:none}
    .ud{display:flex;flex:none;border-radius:18px;background:var(--ki-g-seg,#282828);padding:2px}
    .ud button{width:32px;height:32px;border-radius:16px;display:grid;place-items:center;color:var(--white,#fafafa)}
    .ud button:disabled{opacity:.2;pointer-events:none}
    .eye{width:36px;height:36px;border-radius:18px;flex:none;display:grid;place-items:center;color:var(--gray800,#afafaf)}
    .tsw{position:relative;width:46px;height:28px;border-radius:14px;background:#545454;flex:none;transition:background .2s}
    .tsw::after{content:'';position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:11px;background:#fafafa;transition:transform .2s cubic-bezier(.34,1.4,.64,1)}
    .tsw.on{background:${PINK}}
    .tsw.on::after{transform:translateX(18px)}
    .chips{display:flex;gap:6px;flex-wrap:wrap}
    .chip{display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 12px 0 10px;border-radius:18px;background:var(--ki-g-row,var(--gray200,#3a3a3a));font-size:13px;font-weight:500;color:var(--gray800,#afafaf)}
    .chip.on{background:var(--gray1000,#e1e1e1);color:#282828}
    .lk{font-size:13px;color:var(--gray900,#c7c7c7)}
    .more{display:flex;align-items:center;justify-content:center;gap:8px;height:44px;border-radius:22px;background:var(--ki-g-row,var(--gray200,#3a3a3a));font-size:14px;font-weight:500;color:var(--gray900,#c7c7c7)}
  `;

  /* ============================================================ ringe-kortet på Hjem (19.18) */
  // Ikke et Lovelace-kort: msh-hjem-card monterer det øverst i Hjem-fanen (under fanelinjen) mens det ringer.
  class RingBanner extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._open = false;
      this.shadowRoot.addEventListener('click', (e) => this._click(e));
    }
    set hass(h) { this._hass = h; this._draw(); }
    get hass() { return this._hass || M.lastHass; }
    connectedCallback() {
      this._draw(); clearInterval(this._iv); this._iv = setInterval(() => this._draw(), 1000);
      if (!this._onRing) { this._onRing = () => this._draw(); window.addEventListener('ki-doorbell', this._onRing); } // ny tid / ristende klokke straks
    }
    disconnectedCallback() { clearInterval(this._iv); this._iv = 0; if (this._onRing) { window.removeEventListener('ki-doorbell', this._onRing); this._onRing = null; } }
    _click(e) {
      const el = e.composedPath().find((n) => n.dataset && n.dataset.a);
      if (!el) return;
      e.stopPropagation();
      const h = this.hass, c = cfgNow(), A = M.ringAuto(h, c), a = el.dataset.a;
      if (a === 'open') { M.haptic('light'); return M.openPopup(HASH); }
      if (a === 'x') { M.haptic('light'); return M.ringAvvis(h, A, c); }
      if (a === 'svar') { M.haptic('selection'); this._open = !this._open; return this._draw(); }
      if (a === 'reply') return M.ringSpeak(h, A, c, reps(c)[Number(el.dataset.i)]);
      if (a === 'custom') { M.haptic('light'); return M.ringCustom(h, A, c); }
      if (a === 'unlock') {
        if (el.__swallow && Date.now() - el.__swallow < 700) return;
        if (R.unlocked) return;
        if (holdMs(c)) { M.haptic('warning'); return M.toast('Hold inne for å låse opp'); }
        M.ringUnlock(this, A); return this._draw();
      }
    }
    _draw() {
      const h = this.hass;
      if (!h || !this.isConnected) return;
      const c = cfgNow(), A = M.ringAuto(h, c), now = Date.now(), el = Math.max(0, now - R.t);
      const chips = chipsOf(h, A, c), cam = A.camera || A.pkg, fin = isFinite(R.until), total = fin ? R.until - R.t : 0;
      const lk = A.lock && h.states[A.lock], unl = R.unlocked || (lk && /^(unlocked|open)$/.test(lk.state)), ms = holdMs(c);
      const img = cam && !customElements.get('hui-image') ? camImg(h, cam) : '';
      const html = `<style>${BANNER_CSS}</style><div class="rc" data-key="rc-${R.n}">
        <div class="r1">
          <button class="th" data-a="open" aria-label="Åpne ringeklokke"><span class="thm" data-nomorph></span>${img ? `<img src="${esc(img)}" alt="">` : ''}<span class="live"><i></i>LIVE</span><span class="ex">${M.icon('mdi:arrow-expand', 14)}</span></button>
          <div class="tx"><div class="when ${el < 8000 || (R.shakeFrom && now - R.shakeFrom < 8000) ? 'shk' : ''}">${M.icon('mdi:bell-ring', 16)}<span>${esc(el < 5000 ? 'Nå' : agoTxt(R.t).replace(/^for /, ''))}</span></div>
            <div class="ttl ell">Det ringer på · ${esc(areaLabel(h, A))}</div>
            ${chips.length ? `<div class="dcs">${chips.map(chipHTML).join('')}</div>` : ''}</div>
          <button class="x" data-a="x" aria-label="Avvis">${M.icon('mdi:close', 20)}</button>
        </div>
        ${A.lock || (A.speaker && c.show_replies !== false) ? `<div class="r2">
          ${A.lock ? `<button class="hold ${unl ? 'done' : ''}" data-a="unlock" data-axis="x"><span class="fill"></span><span class="lb">${unl ? `${M.icon('mdi:lock-open-check', 18)}Låst opp` : `${M.icon('mdi:lock-open-variant', 18)}${ms ? 'Hold for å låse opp' : 'Trykk for å låse opp'}`}</span></button>` : ''}
          ${A.speaker && c.show_replies !== false ? `<button class="sv ${this._open ? 'on' : ''}" data-a="svar" aria-expanded="${this._open}">Svar ${M.icon(this._open ? 'mdi:chevron-up' : 'mdi:chevron-down', 18)}</button>` : ''}
        </div>` : ''}
        ${this._open && A.speaker ? `<div class="rps">${reps(c).map((r, i) => `<button class="rp" data-a="reply" data-i="${i}">${esc(r.text)}</button>`).join('')}<button class="rp own" data-a="custom">${M.icon('mdi:plus', 16)}Egen tekst</button></div>` : ''}
        ${fin ? `<div class="tl"><span style="animation-duration:${total}ms;animation-delay:-${Math.min(el, total)}ms"></span></div>` : ''}
      </div>`;
      if (!this._did) { this.shadowRoot.innerHTML = html; this._did = true; } else M.morph(this.shadowRoot, html);
      // Live-miniatyr (hui-image, camera_view auto) – samme som kamera-flisene
      const slot = this.shadowRoot.querySelector('.thm');
      if (slot && cam && customElements.get('hui-image')) {
        let im = slot.firstElementChild;
        if (!im || im.cameraImage !== cam) { slot.textContent = ''; im = document.createElement('hui-image'); im.cameraImage = cam; im.cameraView = 'auto'; im.fitMode = 'cover'; im.setAttribute('fit-mode', 'cover'); slot.appendChild(im); }
        im.hass = h;
      }
      const hb = this.shadowRoot.querySelector('.hold:not(.done)');
      if (hb) bindHold(hb, () => (R.unlocked ? 0 : holdMs(cfgNow())), () => { M.ringUnlock(this, M.ringAuto(this.hass, cfgNow())); this._draw(); });
      const rp = this.shadowRoot.querySelector('.rps');
      if (rp && !rp.__b) { rp.__b = true; const stop = (e) => e.stopPropagation(); rp.addEventListener('touchstart', stop, { passive: true }); rp.addEventListener('touchmove', stop, { passive: true }); rp.addEventListener('pointerdown', stop); }
    }
  }
  const BANNER_CSS = `
    :host{display:block}
    *{box-sizing:border-box}
    button{font:inherit;color:inherit;border:0;background:none;padding:0;margin:0;cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
    ha-icon{--mdc-icon-size:inherit;display:inline-flex}
    .ell{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .rc{position:relative;overflow:hidden;display:flex;flex-direction:column;gap:12px;padding:14px;border-radius:30px;background:var(--gray100,#2f2f2f);color:var(--white,#fafafa);font-family:${M.FONT};box-shadow:inset 0 0 0 1.5px rgb(242 133 201 / .55),0 0 26px rgb(242 133 201 / .16);animation:rkIn .35s cubic-bezier(.34,1.4,.64,1)}
    .r1{display:flex;align-items:flex-start;gap:12px}
    .th{position:relative;width:88px;height:66px;border-radius:18px;overflow:hidden;flex:none;background:#1d1d1d}
    .thm,.th img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
    .thm>*{width:100%;height:100%;display:block}
    .live{position:absolute;left:6px;top:6px;display:inline-flex;align-items:center;gap:4px;height:18px;padding:0 6px;border-radius:9px;background:rgba(0,0,0,0.55);font-size:9px;font-weight:700;letter-spacing:.06em}
    .live i{width:5px;height:5px;border-radius:3px;background:${RED}}
    .ex{position:absolute;right:5px;bottom:5px;width:20px;height:20px;border-radius:10px;display:grid;place-items:center;background:rgba(0,0,0,0.55);font-size:14px}
    .tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px;padding-top:2px}
    .when{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:600;color:${PINKC};font-size:13px}
    .when ha-icon{font-size:16px}
    .when.shk ha-icon{animation:rkShake .9s ease-in-out infinite;transform-origin:50% 10%}
    .ttl{font-size:16px;font-weight:500}
    .dcs{display:flex;flex-wrap:wrap;gap:5px;margin-top:3px}
    .dc{display:inline-flex;align-items:center;gap:4px;height:24px;padding:0 9px 0 7px;border-radius:12px;background:var(--gray300,#404040);font-size:12px;font-weight:500;--mdc-icon-size:14px}
    .dc.red{background:rgb(242 128 115 / .85);color:#2f2f2f}
    .x{width:36px;height:36px;border-radius:18px;display:grid;place-items:center;background:var(--gray300,#404040);flex:none;font-size:20px}
    .r2{display:flex;gap:8px}
    .hold{position:relative;overflow:hidden;flex:1;height:48px;border-radius:24px;background:${PINK};color:#2f2f2f;font-size:14px;font-weight:600;touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
    .hold .fill{position:absolute;inset:0;background:${GREEN};transform:scaleX(0);transform-origin:left}
    .hold .lb{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:6px;font-size:14px}
    .hold .lb ha-icon{font-size:18px}
    .hold.done{background:var(--gray300,#404040);color:${GREEN}}
    .sv{flex:none;height:48px;padding:0 14px 0 18px;border-radius:24px;background:var(--gray300,#404040);font-size:14px;font-weight:500;display:inline-flex;align-items:center;gap:2px}
    .sv ha-icon{font-size:18px}
    .sv.on{background:var(--gray400,#545454)}
    .rps{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;touch-action:pan-x}
    .rps::-webkit-scrollbar{display:none}
    .rp{flex:none;height:38px;padding:0 14px;border-radius:19px;background:var(--gray300,#404040);font-size:13px;font-weight:500;white-space:nowrap;display:inline-flex;align-items:center;gap:4px}
    .rp.own{color:var(--gray900,#c7c7c7)}
    .rp:active,.sv:active,.x:active{transform:scale(.96)}
    .tl{position:absolute;left:0;right:0;bottom:0;height:3px;background:rgb(242 133 201 / .15)}
    .tl span{display:block;height:100%;background:${PINKC};transform-origin:left;animation:rkTl linear forwards}
    @keyframes rkTl{from{transform:scaleX(1)}to{transform:scaleX(0)}}
    @keyframes rkShake{0%,100%{transform:rotate(0)}15%{transform:rotate(14deg)}30%{transform:rotate(-12deg)}45%{transform:rotate(9deg)}60%{transform:rotate(-6deg)}75%{transform:rotate(3deg)}}
    @keyframes rkIn{from{opacity:0;transform:translateY(-8px) scale(.98)}}
    @media (prefers-reduced-motion: reduce){.rc,.when.shk ha-icon{animation:none}}
  `;
  if (!customElements.get('msh-ring-banner')) customElements.define('msh-ring-banner', RingBanner);

  /* ------------------------------------------------------------ Hjem-integrasjon (kalles fra 25-hjem.js) */
  M.ringShowCard = () => M.ringActive() && hasCard(M.doorbellMode());
  // Monter/fjern ringe-kortet: i fanekortets ring-slot (under fanelinjen, bare på Hjem-fanen), ellers i Hjem-kortets egen slot
  M.ringHjem = function (hj) {
    const on = M.ringShowCard(), f = hj._kids && hj._kids.faner, fvis = (hj._vis || []).includes('faner') && f && f.isConnected;
    if (!on) {
      if (hj._ring && hj._ring.parentNode) hj._ring.remove();
      if (hj._ringMo) { hj._ringMo.disconnect(); hj._ringMo = null; }
      return;
    }
    if (!hj._ring) hj._ring = document.createElement('msh-ring-banner');
    if (hj._ring.hass !== hj.hass) hj._ring.hass = hj.hass;
    let host;
    if (fvis) {
      host = f.shadowRoot && f.shadowRoot.querySelector('[data-ring-slot]');
      if (!hj._ringMo && f.shadowRoot && window.MutationObserver) { hj._ringMo = new MutationObserver(() => M.ringHjem(hj)); hj._ringMo.observe(f.shadowRoot, { childList: true, subtree: true }); }
    } else host = hj.shadowRoot && hj.shadowRoot.querySelector('[data-slot="ring"]');
    if (host && hj._ring.parentNode !== host) host.appendChild(hj._ring);
    else if (!host && hj._ring.parentNode) hj._ring.remove();
  };
  M.ringHjemBind = function (hj) {
    M.ringColdStart();
    if (hj.__ringL) return;
    let lastN = R.n;
    hj.__ringL = () => {
      if (!hj.isConnected) { window.removeEventListener('ki-doorbell', hj.__ringL); hj.__ringL = null; return; }
      const f = hj._kids && hj._kids.faner;
      if (f && f.update) f.update(); // rosa prikk på Hjem-fanen
      hj.update();
      if (R.n !== lastN) {
        lastN = R.n;
        if (M.ringShowCard()) { // nytt kort: scroll til toppen (smooth)
          try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { /* */ }
          let n = hj; for (let i = 0; n && i < 40; i++) { if (n.scrollTop > 0 && n.scrollTo) { n.scrollTo({ top: 0, behavior: 'smooth' }); break; } n = n.parentNode || n.host; }
        }
      }
    };
    window.addEventListener('ki-doorbell', hj.__ringL);
  };
})();
