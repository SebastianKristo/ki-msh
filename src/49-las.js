/* msh-las-card · Dørlås-popup #dorlas (Fiks 32.1, erstatter 16.7). Fasit: «Dørlås v2.dc.html». ÉTT kort i popupen.
 * Rekkefølge: låsvelger + tannhjul (MSH.sik.picker) → toppkort (MSH.sik.hero: navn + chip, tilstand 44/300, «Låst av X · 21:04»,
 * badge 56 px som snurrer mens låsen jobber, opplåsingsspor 64 px: Dra / Hold / Trykk) → statusfliser (Dør, Batteri, Autolås)
 * → Automatikk (MSH.sik.auto, sammenleggbar med hovedbryter) → Historikk-tidslinje (MSH.sik.history, logbook/get_events
 * bare når popupen er åpen). «Tilpass dørlås» (MSH.sik.sheet): Låser · Seksjoner · Historikk – alt i config, og de samme
 * valgene finnes i GUI-editoren (schema).
 * Autokonfig (ingen gjettede ID-er, «–»/«Velg entitet» når noe mangler): alle lock.* (exclude/include.laser), dørsensor =
 * binary_sensor door/opening på samme enhet eller i samme område, batteri = battery_level eller batterisensor på enheten,
 * automatikk = bryterne fra KI Varslinger og sikkerhet (MSH.finnBrytere, enhetsnavn Autolås / Fastkjørt lås / Lås når alle
 * drar / Nattlås), ellers låsens egen auto-lås-bryter og automasjoner med lås + borte/natt i navnet. overrides.{auto_lock,
 * away_lock, night_lock, jam_alert} overstyrer, locks_cfg.<objekt>.{name, hidden, door, battery, auto_lock} per lås.
 * MSH.lockUnlock(card, id, { name, toast }) – felles opplåsing (PIN når låsen krever kode), brukes også av Hjem-flisen og
 * Ringeklokke. MSH.lasAuto(hass, cfg) → { locks, vis, away, night }.
 * Den gamle dørlås-popupen (16.7-oppsett, importerte popups med gamle lås-kort, gamle hasher #las/#lock …) migreres til
 * dette ene kortet: MSH.POPUP_ALIAS / POPUP_SUPERSEDE / POPUP_MIGRATE (samme metode som 28.14/30.1).
 */
(function () {
  const M = window.MSH, esc = M.esc, S = M.sik;
  const { G, O, R, GR, PK } = S.COL;
  const AUTO_RX = /auto.?(re)?lock|autol[aå]s|auto.?l[aå]s|relock/i;
  const LOCK_RX = /l[aå]s|lock/i;
  const AWAY_RX = /borte|away|alle.?dra|leav|ingen.?hjemme|nobody/i;
  const NIGHT_RX = /natt|night|kveld|bedtime|leggetid/i;
  const GARAGE_RX = /garasje|garage|\bport\b/;
  const HOLD_MS = 900, ARM = 0.92;
  const txt = (hass, id) => id + ' ' + String((hass.states[id] && hass.states[id].attributes.friendly_name) || '');
  const devEnts = (hass, id) => {
    const e = hass.entities && hass.entities[id];
    if (!e || !e.device_id) return [];
    return Object.keys(hass.entities).filter((x) => x !== id && hass.entities[x].device_id === e.device_id && hass.states[x]);
  };
  const real = (hass, id) => (id && id !== 'none' && hass.states[id] ? id : null);
  const DOOR_DC = ['door', 'opening'];
  const norm = (s) => M.slug(s).replace(/_/g, ' ');

  // Dørsensor for en lås: samme enhet → samme område (best navnetreff først)
  function doorAuto(hass, id) {
    const st = hass.states[id], dev = devEnts(hass, id).filter((x) => x.startsWith('binary_sensor.') && DOOR_DC.includes(hass.states[x].attributes.device_class));
    if (dev.length) return dev[0];
    const area = M.areaOf(hass, id);
    if (!area) return null;
    const L = M.all(hass, 'binary_sensor', (s, x) => DOOR_DC.includes(s.attributes.device_class) && M.areaOf(hass, x) === area);
    const ln = norm((st && st.attributes.friendly_name) || id.split('.')[1]);
    const sc = (x) => { const n = norm(M.name(hass, x)); return n === ln ? 0 : n.includes(ln) || ln.includes(n) ? 1 : ln.split(' ').some((w) => w.length > 2 && n.includes(w)) ? 2 : 3; };
    return L.sort((a, b) => sc(a) - sc(b) || a.localeCompare(b))[0] || null;
  }
  // Autokonfig for én lås (overstyring i locks_cfg.<objekt>)
  function lockInfo(hass, cfg, id) {
    const st = hass.states[id] || null, obj = id.split('.')[1], o = ((cfg.locks_cfg || {})[obj]) || {};
    const dev = devEnts(hass, id);
    const batId = real(hass, o.battery) || dev.find((x) => x.startsWith('sensor.') && hass.states[x].attributes.device_class === 'battery') || null;
    let bat = null;
    if (batId && M.isNum(hass.states[batId].state)) bat = Math.round(Number(hass.states[batId].state));
    else if (st && M.isNum(st.attributes.battery_level)) bat = Math.round(Number(st.attributes.battery_level));
    const autoNum = real(hass, o.auto_lock) || dev.find((x) => /^(number|input_number)\./.test(x) && AUTO_RX.test(txt(hass, x))) || null;
    const autoSw = real(hass, o.auto_lock_switch) || dev.find((x) => /^(switch|input_boolean)\./.test(x) && AUTO_RX.test(txt(hass, x))) || null;
    const dAuto = doorAuto(hass, id), door = o.door === 'none' ? null : real(hass, o.door) || dAuto;
    const name = o.name || (st && st.attributes.friendly_name) || obj.replace(/_/g, ' ');
    return { id, obj, st, name, bat, batId, autoNum, autoSw, door, doorAuto: dAuto, doorOwn: real(hass, o.door), hidden: !!o.hidden, code: !!(st && st.attributes.code_format) };
  }
  // «Lås når alle drar» / «Nattlås» uten KI Varslinger: automation/input_boolean/switch med lås + borte/natt i navnet
  function findRule(hass, rx) {
    return Object.keys(hass.states).filter((id) => /^(automation|input_boolean|switch)\./.test(id) && LOCK_RX.test(txt(hass, id)) && rx.test(txt(hass, id)) && !AUTO_RX.test(txt(hass, id)) && !GARAGE_RX.test(txt(hass, id).toLowerCase())).sort()[0] || null;
  }
  // Automatikk-radene (32.1): KI Varslinger og sikkerhet (finnBrytere) → reserve. ov = overrides
  const AUTO_DEFS = [
    { k: 'auto', ov: 'auto_lock', rx: /autol[aå]s|auto.?lock|relock/, not: GARAGE_RX },
    { k: 'away', ov: 'away_lock', rx: /(l[aå]s|lock).*(alle.?dr|borte|away|leav)|(alle.?dr|borte|away|leav).*(l[aå]s|lock)/, not: GARAGE_RX, fb: (h) => findRule(h, AWAY_RX) },
    { k: 'night', ov: 'night_lock', rx: /nattl[aå]s|natt|night/, not: GARAGE_RX, fb: (h) => findRule(h, NIGHT_RX) },
    { k: 'jam', ov: 'jam_alert', rx: /fastkj|jam/, not: GARAGE_RX },
  ];
  M.lasAutos = function (hass, cfg) {
    const ov = (cfg && cfg.overrides) || {}, o2 = {};
    AUTO_DEFS.forEach((d) => { if (ov[d.ov]) o2[d.k] = ov[d.ov]; });
    return S.autoFind(hass, AUTO_DEFS, o2);
  };
  M.lasAuto = function (hass, cfg) {
    cfg = cfg || {};
    if (!hass) return { locks: [], vis: [], away: null, night: null };
    const locks = M.applyLists(cfg, 'laser', M.all(hass, 'lock')).filter((id) => hass.states[id]);
    const vis = locks.filter((id) => !((cfg.locks_cfg || {})[id.split('.')[1]] || {}).hidden);
    const au = M.lasAutos(hass, cfg);
    return { locks, vis: vis.length ? vis : locks.slice(0, 1), away: au.away, night: au.night };
  };

  /* ------------------------------------------------------------ PIN-tastatur (portalt ut av popupen, fallgruve 1) */
  const PAD_CSS = `
    .bg{background:rgba(10,10,12,0.6);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
    .sh{left:16px;right:16px;padding:22px 20px 20px;border-radius:34px;background:var(--gray200,#3a3a3a);box-shadow:0 20px 50px rgba(0,0,0,0.55);scrollbar-width:none}
    .sh::-webkit-scrollbar{display:none}
    .pad{position:relative;display:flex;flex-direction:column;align-items:center;gap:16px}
    .x{position:absolute;top:-8px;right:-6px;width:40px;height:40px;border-radius:20px;background:var(--gray300,#404040);display:grid;place-items:center;color:var(--gray900,#c7c7c7)}
    .hd{display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center}
    .iw{width:56px;height:56px;border-radius:28px;display:grid;place-items:center;background:rgba(242,181,115,0.2);color:var(--orange,#f2b573)}
    .tt{font-size:20px;font-weight:600}
    .msg{font-size:13px;color:var(--gray700,#979797)}
    .msg.err{color:var(--red,#f28073);font-weight:600}
    .dots{display:flex;gap:16px;height:16px;align-items:center}
    .dots.err{animation:msh-shake .36s cubic-bezier(.36,.07,.19,.97)}
    .dot{width:14px;height:14px;border-radius:7px;box-shadow:inset 0 0 0 1.5px var(--gray600,#7f7f7f);transition:background .12s}
    .dot.on{background:var(--white,#fafafa);box-shadow:none}
    .dots.err .dot{background:var(--red,#f28073);box-shadow:none}
    .keys{display:grid;grid-template-columns:repeat(3,68px);gap:10px 20px}
    .k{width:68px;height:68px;border-radius:34px;display:grid;place-items:center;background:var(--gray300,#404040);color:var(--white,#fafafa);font-size:30px;font-weight:400;font-variant-numeric:tabular-nums;transition:transform .1s,background .1s;touch-action:manipulation}
    .k:active{transform:scale(0.92);background:var(--gray400,#545454)}
    .k.ic{background:transparent;color:var(--gray800,#afafaf)}
    .ok{width:100%;height:52px;border-radius:26px;background:${PK};color:#2f2f2f;font-size:15px;font-weight:600}
    .ok:disabled{opacity:.4}
    button{font:inherit;color:inherit;border:0;background:none;padding:0;cursor:pointer;-webkit-tap-highlight-color:transparent}
    @keyframes msh-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(6px)}40%{transform:translateX(-6px)}60%{transform:translateX(4px)}80%{transform:translateX(-3px)}}
  `;
  // Kodelengde fra code_format (^\d{4}$ → 4); ukjent → fri lengde med «Lås opp»-knapp
  const codeLen = (fmt, cfgLen) => { if (cfgLen && cfgLen !== 'auto') return Number(cfgLen) || 0; const m = /\{(\d+)\}/.exec(String(fmt || '')); return m ? Number(m[1]) : 0; };
  M.lockPad = function ({ title, sub, len = 0, submit }) {
    const P = { entry: '', err: false, busy: false };
    let ov = null;
    const onKey = (e) => { if (/^[0-9]$/.test(e.key)) { M.haptic('selection'); press(e.key); } else if (e.key === 'Backspace') { M.haptic('selection'); P.entry = P.entry.slice(0, -1); draw(); } else if (e.key === 'Enter') go(); };
    const draw = () => {
      if (!ov || ov.closed) return;
      const n = len || Math.max(4, P.entry.length);
      M.morph(ov.body, `<div class="pad">
        <button class="x" data-k="close" title="Lukk">${M.icon('close', 22)}</button>
        <div class="hd"><span class="iw">${M.icon('mdi:lock-open-variant', 28)}</span><span class="tt">${esc(title || 'Lås opp')}</span>
          <span class="msg ${P.err ? 'err' : ''}">${P.err ? 'Feil kode – prøv igjen' : esc(sub || (len ? `Skriv inn ${len}-sifret kode` : 'Skriv inn koden'))}</span></div>
        <div class="dots ${P.err ? 'err' : ''}">${Array.from({ length: n }, (_, i) => `<span class="dot ${i < P.entry.length ? 'on' : ''}"></span>`).join('')}</div>
        <div class="keys">${['1', '2', '3', '4', '5', '6', '7', '8', '9', 'close', '0', 'backspace'].map((k) => { const ic = k === 'close' || k === 'backspace'; return `<button class="k ${ic ? 'ic' : ''}" data-k="${k}" title="${k === 'close' ? 'Avbryt' : k === 'backspace' ? 'Slett' : k}">${ic ? M.icon(k, 26) : k}</button>`; }).join('')}</div>
        ${len ? '' : `<button class="ok" data-k="ok" ${P.entry ? '' : 'disabled'}>Lås opp</button>`}
      </div>`);
    };
    const go = async () => {
      if (P.busy || !P.entry) return;
      P.busy = true;
      const ok = await Promise.resolve(submit(P.entry)).catch(() => false);
      P.busy = false;
      if (ok) { if (ov) ov.close(); return; }
      P.err = true; draw();
      setTimeout(() => { P.err = false; P.entry = ''; draw(); }, 900);
    };
    const press = (d) => {
      if (P.err || P.busy) return;
      P.entry = (P.entry + d).slice(0, len || 12);
      draw();
      if (len && P.entry.length === len) setTimeout(go, 120);
    };
    ov = M.overlay({ center: true, maxWidth: 360, css: PAD_CSS, html: '', onClose: () => window.removeEventListener('keydown', onKey) });
    window.addEventListener('keydown', onKey);
    ov.root.addEventListener('click', (e) => {
      const b = e.composedPath().find((n) => n.dataset && n.dataset.k);
      if (!b) return;
      const k = b.dataset.k;
      if (k === 'close') { M.haptic('light'); return ov.close(); }
      M.haptic('selection');
      if (k === 'backspace') { if (!P.err) { P.entry = P.entry.slice(0, -1); draw(); } return; }
      if (k === 'ok') return go();
      press(k);
    });
    draw();
    return ov;
  };
  // Felles opplåsing: PIN-tastatur når låsen har code_format (eller force pin), ellers rett på.
  M.lockUnlock = function (card, id, o = {}) {
    const hass = (card && card.hass) || M.lastHass, st = hass && hass.states[id];
    if (!st) return null;
    const nm = o.name || st.attributes.friendly_name || 'Dørlås', toast = o.toast || ((t) => M.toast(t));
    const call = (code) => hass.callService('lock', 'unlock', code ? { entity_id: id, code } : { entity_id: id }).then(() => { if (o.onSent) o.onSent(); else M.haptic('success'); toast(`${nm} låst opp`); return true; });
    if (st.attributes.code_format || o.pin) {
      return M.lockPad({ title: `Lås opp ${nm.toLowerCase() === 'dørlås' ? 'døren' : nm}`, len: codeLen(st.attributes.code_format, o.codeLength), submit: (code) => call(code).catch(() => { M.haptic('failure'); return false; }) });
    }
    return call().catch((e) => { M.haptic('failure'); M.toast('Feil: ' + (e && e.message ? e.message : e)); return false; });
  };

  /* ------------------------------------------------------------ kortet */
  const VERB = { locked: 'Låst', unlocked: 'Låst opp', open: 'Åpnet', jammed: 'Fastkjørt' };
  const KIND = { locked: 'lock', unlocked: 'unlock', open: 'unlock', jammed: 'jam' };
  const EVT = { lock: ['Låst', G], unlock: ['Låst opp', O], door: ['Døra åpnet', '#979797'], jam: ['Fastkjørt', R] };
  const FIL = [['alle', 'Alle', 'mdi:format-list-bulleted', () => true], ['lock', 'Låst', 'mdi:lock', (e) => e.kind === 'lock'], ['unlock', 'Opplåst', 'mdi:lock-open-variant', (e) => e.kind === 'unlock'], ['jam', 'Varsler', 'mdi:alert', (e) => e.kind === 'jam']];
  const UNLOCK = [['dra', 'Dra'], ['hold', 'Hold'], ['trykk', 'Trykk']];
  const UNL_NOTE = { dra: 'Dra knotten helt til høyre for å låse opp. Hindrer opplåsing ved et uhell.', hold: 'Hold inne i 0,9 s. Sporet fylles mens du holder.', trykk: 'Ett trykk låser opp. Raskest, men uten bekreftelse.' };
  const COUNTS = [4, 6, 10, 20];
  const MINS = [1, 2, 5, 10];
  const on = (c, k) => c[k] !== false;

  class Las extends M.Card {
    static get cardName() { return 'Dørlås'; }
    static get defaults() { return { unlock: 'dra', hist_count: 6, toasts: true }; }
    static get uiPersist() { return ['sel', 'amOpen', 'amMem']; }
    static getStubConfig() { return { card_id: M.uid(), ...this.defaults }; }
    static get schema() {
      return (h, c) => {
        const A = h ? M.lasAuto(h, c) : { locks: [] };
        const au = h ? M.lasAutos(h, { ...c, overrides: {} }) : {};
        return [
          { type: 'lists', label: 'Låser', lists: (hh) => [{ key: 'laser', label: 'Låser (flere = velger øverst)', ids: M.all(hh, 'lock'), domains: ['lock'] }] },
          ...A.locks.map((id) => {
            const x = lockInfo(h, c, id), P = `locks_cfg.${x.obj}`;
            return { type: 'section', id: 'lock-' + x.obj, label: 'Lås · ' + x.name, icon: 'mdi:lock', fields: [
              { type: 'text', name: P + '.name', label: 'Navn', placeholder: (x.st && x.st.attributes.friendly_name) || x.obj },
              { type: 'boolean', name: P + '.hidden', label: 'Skjul i velgeren', default: false },
              { type: 'entity', name: P + '.door', label: 'Dørsensor', domains: ['binary_sensor'], auto: () => x.doorAuto },
              { type: 'entity', name: P + '.battery', label: 'Batterisensor', domain: 'sensor', device_class: 'battery', auto: () => (x.batId || (x.bat != null ? id + ' (battery_level)' : null)) },
              { type: 'entity', name: P + '.auto_lock', label: 'Autolås-tid (minutter)', domains: ['number', 'input_number'], auto: () => x.autoNum },
            ] };
          }),
          { type: 'section', id: 'secs', label: 'Seksjoner', icon: 'mdi:view-grid-outline', fields: [
            { type: 'boolean', name: 'show_status', label: 'Status · dør, batteri, autolås', default: true },
            { type: 'boolean', name: 'show_auto', label: 'Automatikk', default: true },
            { type: 'boolean', name: 'show_hist', label: 'Historikk', default: true },
            { type: 'select', name: 'unlock', label: 'Opplåsing', options: UNLOCK, default: 'dra' },
            { type: 'info', label: 'Dra: knotten dras helt til høyre · Hold: 0,9 s · Trykk: ett trykk. Krever låsen kode (code_format), vises PIN-tastaturet etterpå.' },
            { type: 'select', name: 'code_length', label: 'PIN-lengde', options: [['auto', 'Fra låsen (code_format)'], [4, '4 siffer'], [6, '6 siffer']], default: 'auto' },
          ] },
          { type: 'section', id: 'hist', label: 'Historikk', icon: 'mdi:history', fields: [
            { type: 'select', name: 'hist_count', label: 'Antall hendelser', options: COUNTS.map((n) => [n, String(n)]), default: 6 },
            { type: 'boolean', name: 'hist_all', label: 'Alle låser (ellers bare valgt lås)', default: true },
            { type: 'boolean', name: 'hist_door', label: 'Dør åpnet/lukket (fra dørsensoren)', default: true },
            { type: 'boolean', name: 'hist_who', label: 'Hvem (navn og bilde når det er kjent)', default: true },
            { type: 'boolean', name: 'hist_method', label: 'Metode (kode, app, nøkkel, autolås …)', default: true },
          ] },
          { type: 'overrides', id: 'autos', label: 'Automatikk', fields: [
            { name: 'auto_lock', label: 'Autolås', domains: ['switch', 'input_boolean', 'automation'], auto: () => au.auto },
            { name: 'away_lock', label: 'Lås når alle drar', domains: ['automation', 'input_boolean', 'switch'], auto: () => au.away },
            { name: 'night_lock', label: 'Nattlås', domains: ['automation', 'input_boolean', 'switch'], auto: () => au.night },
            { name: 'jam_alert', label: 'Varsle ved fastkjørt lås', domains: ['switch', 'input_boolean', 'automation'], auto: () => au.jam },
          ] },
          { type: 'section', id: 'view', label: 'Visning', icon: 'mdi:eye-outline', fields: [{ type: 'boolean', name: 'toasts', label: 'Bekreftelsesmeldinger (toast)', default: true }] },
        ];
      };
    }
    get cardSize() { return 8; }
    customize(focus) { return openSheet(this, focus); }
    onOpen() {
      // Åpnet fra en Dørlås-flis på Hjem: vis den låsen
      if (M.lasPick) { const id = M.lasPick; M.lasPick = null; if (M.lasAuto(this.hass, this.config).vis.includes(id) && id !== this.ui.sel) this.setUI({ sel: id }); }
      this._loadLog();
      clearInterval(this._tick);
      this._tick = setInterval(() => { if (this._countdown && !this._busy) this.update(); }, 1000); // «Låses om 1:58» – bare mens popupen er åpen
    }
    onClose() { clearInterval(this._tick); this._tick = 0; this._endDrag(true); }
    disconnectedCallback() { super.disconnectedCallback(); clearInterval(this._tick); this._tick = 0; }
    _toast(t) { if (this.config.toasts !== false) M.toast(t); }
    _cur(A) { const L = A.vis; if (!L.length) return null; const i = L.indexOf(this.ui.sel); return L[i >= 0 ? i : 0]; }
    // Logbook for låsene + dørsensorene (alle synlige, så filtrene ikke henter på nytt). Bare når popupen er åpen (fallgruve 8).
    async _loadLog() {
      const h = this.hass, A = M.lasAuto(h, this.config);
      if (!A.vis.length || !h || !h.callWS) return;
      const doors = A.vis.map((id) => lockInfo(h, this.config, id).door).filter(Boolean);
      const [L, AH] = await Promise.all([S.logbook(h, [...A.vis, ...doors], 7), S.attrHistory(h, A.vis, 7)]);
      this._log = L; this._ah = AH; this._logT = Date.now();
      this.update();
    }
    // Ventende handling (optimistisk, 27.6): vises straks, success når låsen svarer, tilbakerulling etter 10 s
    _setPend(id, want) {
      this._pend = this._pend || {};
      const old = this._pend[id];
      if (old) clearTimeout(old.tm);
      const p = { want, t: Date.now() };
      p.tm = setTimeout(() => {
        if (!this._pend || this._pend[id] !== p) return;
        delete this._pend[id];
        M.haptic('warning');
        M.toast(`Fikk ikke svar fra ${M.name(this.hass, id)} – rullet tilbake`);
        this.update();
      }, S.SYNC_MS);
      this._pend[id] = p;
      this.update();
    }
    _busyOf(x) {
      const v = x.st ? x.st.state : '', p = this._pend && this._pend[x.id];
      if (p) {
        if (v === p.want) { clearTimeout(p.tm); delete this._pend[x.id]; M.haptic('success'); this._toast(`${x.name} ${p.want === 'locked' ? 'låst' : 'låst opp'}`); }
        else if (v === 'jammed') { clearTimeout(p.tm); delete this._pend[x.id]; M.haptic('failure'); }
        else return p.want === 'locked' ? 'locking' : 'unlocking';
      }
      return v === 'locking' || v === 'unlocking' ? v : null;
    }
    _person(e, attrs) {
      if (e.user) { const p = S.person(this.hass, e.user); if (p) return p; }
      const cb = attrs && attrs.changed_by;
      return cb ? S.person(this.hass, cb) : null;
    }
    // Hendelser for historikken (nyeste først)
    _events(A, x) {
      const c = this.config, h = this.hass, L = this._log;
      if (!L) return null;
      const ids = on(c, 'hist_all') ? A.vis : [x.id];
      const doorOf = new Map();
      if (on(c, 'hist_door')) ids.forEach((id) => { const d = lockInfo(h, c, id).door; if (d) doorOf.set(d, id); });
      const out = [], last = {};
      const raw = L.slice();
      // Live-endringer etter hentingen (state-objektet er nyere enn logbook-svaret)
      ids.forEach((id) => { const st = h.states[id]; if (st && st.last_changed) { const t = new Date(st.last_changed).getTime(); if (t > (this._logT || 0) - 1000 && !raw.some((e) => e.id === id && e.state === st.state && Math.abs(e.t - t) < 5000)) raw.unshift({ id, state: st.state, t, user: (st.context && st.context.user_id) || null, live: true }); } });
      raw.sort((p, q) => q.t - p.t).forEach((e) => {
        let kind = null, lock = e.id;
        if (ids.includes(e.id)) kind = KIND[e.state];
        else if (doorOf.has(e.id) && e.state === 'on') { kind = 'door'; lock = doorOf.get(e.id); }
        if (!kind) return;
        const k = `${e.id}|${kind}|${Math.round(e.t / 2000)}`;
        if (last[k]) return;
        last[k] = 1;
        out.push({ ...e, kind, lock });
      });
      return out;
    }
    render() {
      const c = this.config, hass = this.hass, A = M.lasAuto(hass, c);
      A.locks.forEach((id) => this.s(id));
      if (!A.locks.length) return `<div class="sk-wrap">${S.picker({ items: [], gear: 'Tilpass dørlås' })}${this._hero(null)}${M.emptyState('Fant ingen dørlås (lock.*)', 'lock')}</div>`;
      const id = this._cur(A), x = lockInfo(hass, c, id);
      [x.batId, x.autoNum, x.autoSw, x.door].forEach((e) => e && this.s(e));
      const items = A.vis.map((l) => { const y = lockInfo(hass, c, l), v = y.st ? y.st.state : '', b = this._busyOf(y), lk = v === 'locked'; return { id: l, name: y.name, icon: lk ? 'mdi:lock' : v === 'jammed' ? 'mdi:lock-alert' : 'mdi:lock-open-variant', state: b === 'unlocking' ? 'Låser opp …' : b === 'locking' ? 'Låser …' : !y.st || M.unavailable(y.st) ? '–' : lk ? 'Låst' : v === 'jammed' ? 'Fastkjørt' : 'Ulåst', col: b ? GR : lk ? G : v === 'jammed' ? R : O }; });
      const au = this._autos(x);
      this._countdown = false;
      const sec = [S.picker({ items, sel: id, gear: 'Tilpass dørlås', mode: this._pickMode })];
      sec.push(this._hero(x, au));
      if (on(c, 'show_status')) sec.push(this._tiles(x, au));
      if (on(c, 'show_auto')) sec.push(this._auto(x, au));
      if (on(c, 'show_hist')) sec.push(this._hist(A, x));
      return `<div class="sk-wrap">${sec.join('')}</div>`;
    }
    // Automatikk for valgt lås: KI Varslinger/overstyring → låsens egen auto-lås-bryter
    _autos(x) {
      const h = this.hass, F = M.lasAutos(h, this.config);
      const ids = { auto: F.auto || x.autoSw, away: F.away, night: F.night, jam: F.jam };
      Object.values(ids).forEach((e) => e && this.s(e));
      const numId = x.autoNum || (ids.auto ? S.minsOn(h, ids.auto, AUTO_RX) : null);
      if (numId) this.s(numId);
      const all = Object.values(ids).filter(Boolean), mOn = S.masterOn(this, all);
      return { ids, all, mOn, numId, mins: S.minsOf(h, numId), autoOn: !!ids.auto && mOn && S.isOn(this, ids.auto) };
    }
    _hero(x, au) {
      if (!x) return S.hero({ name: 'Dørlås', state: '–', sub: 'Velg entitet', col: GR, right: S.badge('mdi:lock-question', GR), bottom: this._track(null) });
      const v = x.st ? x.st.state : '', un = !x.st || M.unavailable(x.st), busy = un ? null : this._busyOf(x), lk = v === 'locked', jam = v === 'jammed';
      const col = un || busy ? GR : lk ? G : jam ? R : O;
      const door = x.door && this.hass.states[x.door], dOpen = door && door.state === 'on';
      const chip = un ? { text: 'Utilgjengelig', icon: 'mdi:lan-disconnect' } : busy ? { text: 'Jobber', icon: 'mdi:sync' } : jam ? { text: 'Fastkjørt', icon: 'mdi:alert' } : lk ? { text: 'Sikret', icon: 'mdi:shield-check' } : { text: dOpen ? 'Døra står åpen' : 'Døra er lukket', icon: 'mdi:door' };
      const state = un ? '–' : busy === 'unlocking' ? 'Låser opp …' : busy === 'locking' ? 'Låser …' : lk ? 'Låst' : jam ? 'Fastkjørt' : 'Ulåst';
      let sub = un ? 'Utilgjengelig' : 'Venter på låsen';
      if (!un && !busy) {
        const t = new Date(x.st.last_changed).getTime();
        const cb = x.st.attributes.changed_by ? String(x.st.attributes.changed_by) : '';
        let by = cb ? ((S.person(this.hass, cb) || {}).name || cb) : '';
        if (!by && this._log) {
          const e = this._log.find((y) => y.id === x.id && y.state === v);
          if (e) { const p = this._person(e, S.attrsAt(this._ah, e)); by = p ? p.name : S.method(this.hass, e, S.attrsAt(this._ah, e), 'lock').label; }
        }
        sub = `${VERB[v] || state}${by ? ' av ' + by : ''} · ${S.when(t)}`;
      }
      const badge = S.badge(un ? 'mdi:lock-question' : busy ? 'mdi:loading' : lk ? 'mdi:lock' : jam ? 'mdi:lock-alert' : 'mdi:lock-open-variant', col, !!busy, x.st ? x.id : null);
      return S.hero({ name: x.name, chip: { ...chip, col }, col, state, sub, right: badge, bottom: this._track(x, { busy, lk, un, col }) });
    }
    // Opplåsingssporet (64 px): Dra / Hold / Trykk. Ulåst → ett trykk låser. touch-action:none + stopPropagation (fallgruve 2).
    _track(x, s) {
      const mode = UNLOCK.some((u) => u[0] === this.config.unlock) ? this.config.unlock : 'dra';
      if (!x || !s || s.un) return `<div class="lk-track off" data-key="lk-track" style="--f:0"><span class="lk-fill"></span><span class="lk-label plain">–</span><span class="lk-knob" style="background:#545454">${M.icon('mdi:lock-question', 26)}</span></div>`;
      const { busy, lk } = s, f = lk && !busy ? 0 : 1;
      const text = busy ? (busy === 'unlocking' ? 'Låser opp …' : 'Låser …') : lk ? (mode === 'dra' ? 'Dra for å låse opp' : mode === 'hold' ? 'Hold for å låse opp' : 'Trykk for å låse opp') : 'Trykk for å låse';
      const shimmer = lk && !busy;
      return `<div class="lk-track ${mode} ${lk ? 'locked' : 'open'} ${busy ? 'busy' : ''}" data-key="lk-track" data-id="${esc(x.id)}" data-mode="${mode}" role="button" aria-label="${esc(text)}" style="--f:${f};--fillc:${shimmer ? S.a(O, 0.22) : S.a(s.col, 0.18)}">
        <span class="lk-fill"></span><span class="lk-label ${shimmer ? 'shim' : 'plain'}">${esc(text)}</span>
        <span class="lk-knob ${shimmer && mode === 'dra' ? 'nudge' : ''}" style="background:${busy ? '#545454' : lk ? G : O}">${M.icon(busy ? 'mdi:loading' : lk ? 'mdi:lock' : 'mdi:lock-open-variant', 26, busy ? 'animation:sk-spin 1s linear infinite' : '')}</span></div>`;
    }
    _tiles(x, au) {
      const h = this.hass, door = x.door && h.states[x.door], dOpen = door && door.state === 'on';
      const bat = x.bat, lk = x.st && x.st.state === 'locked';
      let aVal = '–', aLab = 'Autolås', aCol = GR;
      if (au.ids.auto) {
        if (!au.autoOn) aVal = 'Av';
        else if (lk || !x.st || M.unavailable(x.st)) aVal = au.mins != null ? `${M.nf(au.mins)} min` : 'På';
        else if (au.mins != null) {
          const t0 = Math.max(new Date(x.st.last_changed).getTime(), door && !dOpen ? new Date(door.last_changed).getTime() : 0);
          aVal = S.mmss(au.mins * 60 - (Date.now() - t0) / 1000); aLab = 'Låses om'; aCol = O; this._countdown = true;
        } else aVal = 'På';
      }
      return S.tiles([
        { icon: dOpen ? 'mdi:door-open' : 'mdi:door', val: door && !M.unavailable(door) ? (dOpen ? 'Åpen' : 'Lukket') : '–', label: 'Dør', col: dOpen ? O : GR, ent: x.door },
        { icon: bat == null ? 'mdi:battery-unknown' : bat < 50 ? 'mdi:battery-30' : 'mdi:battery-70', val: bat == null ? '–' : bat + ' %', label: 'Batteri', col: bat == null ? GR : bat < 30 ? R : bat < 50 ? O : GR, ent: x.batId },
        { icon: 'mdi:timer-outline', val: aVal, label: aLab, col: aCol, ent: au.numId || au.ids.auto },
      ]);
    }
    _auto(x, au) {
      const mOn = au.mOn, row = (k) => au.ids[k] ? S.rowOn(this, au.ids[k], mOn) : false, n = au.all.length;
      const nOn = au.all.filter((id) => S.isOn(this, id)).length;
      const sub = !n ? 'Ingen automatikk funnet' : !mOn ? 'Av · ingen automatikk kjører' : `${nOn} av ${n} på${au.autoOn && au.mins != null ? ` · autolås ${M.nf(au.mins)} min` : ''}`;
      const aOn = row('auto');
      const rows = [
        { k: 'auto', icon: 'mdi:lock-clock', label: 'Autolås', sub: aOn ? (au.mins != null ? `Låser ${M.nf(au.mins)} min etter at døra lukkes` : 'Låser etter at døra lukkes') : 'Av', ent: au.ids.auto, on: aOn, mins: aOn && au.numId ? { opts: MINS, cur: au.mins } : null },
        { k: 'away', icon: 'mdi:walk', label: 'Lås når alle drar', sub: 'Når siste person forlater hjemmet', ent: au.ids.away, on: row('away') },
        { k: 'night', icon: 'mdi:weather-night', label: 'Nattlås', sub: 'Låser kl. 23:00 hvis ulåst', ent: au.ids.night, on: row('night') },
        { k: 'jam', icon: 'mdi:bell-alert', label: 'Varsle ved fastkjørt lås', sub: 'Push med bilde fra inngangskamera', ent: au.ids.jam, on: row('jam') },
      ];
      return S.auto({ open: !!this.ui.amOpen, master: mOn, sub, rows });
    }
    _hist(A, x) {
      const c = this.config, h = this.hass, evs = this._events(A, x);
      if (!evs) return S.history({ sum: '', days: [], empty: 'Henter …' });
      const fk = FIL.some((f) => f[0] === this.ui.hf) ? this.ui.hf : 'alle', fx = FIL.find((f) => f[0] === fk)[3];
      const cnt = COUNTS.includes(Number(c.hist_count)) ? Number(c.hist_count) : 6;
      const list = evs.filter(fx), hn = this.ui.hn && this.ui.hnF === fk ? this.ui.hn : cnt, shown = list.slice(0, hn);
      const multi = on(c, 'hist_all') && A.vis.length > 1, who = on(c, 'hist_who'), meth = on(c, 'hist_method');
      const days = S.groupDays(shown, (e) => {
        const [title, col] = EVT[e.kind], attrs = S.attrsAt(this._ah, e);
        const p = who && e.kind !== 'door' ? this._person(e, attrs) : null;
        const m = e.kind === 'door' ? { icon: S.METHOD.sensor[0], label: S.METHOD.sensor[1] } : S.method(h, e, attrs, 'lock');
        const lbl = p ? (meth ? `${p.name} · ${m.label}` : p.name) : m.label;
        return { key: `ev-${e.id}-${e.t}`, type: e.kind, time: S.hm(e.t), title, col, kind: e.kind === 'door' ? 'ring' : e.kind === 'jam' ? 'warn' : 'dot', who: p, method: meth || p ? { icon: m.icon, label: lbl } : null, extra: multi ? '· ' + lockInfo(h, c, e.lock).name : '' };
      });
      const filters = FIL.map(([k, label, icon, fn]) => ({ k, label, icon, n: evs.filter(fn).length, warn: k === 'jam' }));
      const nToday = evs.filter((e) => e.kind === 'unlock' && S.isToday(e.t)).length;
      const more = list.length > cnt ? { label: hn < list.length ? `Vis ${list.length - hn} til` : 'Vis færre', up: hn >= list.length } : null;
      return S.history({ sum: `${nToday} opplåsing${nToday === 1 ? '' : 'er'} i dag`, filters, fsel: fk, days, more, empty: 'Ingen hendelser i dette filteret' });
    }
    onAction(name, el, ev) {
      const d = el.dataset, h = this.hass, c = this.config;
      if (name === 'pick') { if (d.id && d.id !== this.ui.sel) { this._endDrag(true); this.setUI({ sel: d.id }); } return undefined; }
      if (name === 'am-open') return this.setUI({ amOpen: !this.ui.amOpen });
      const x = () => lockInfo(h, c, this._cur(M.lasAuto(h, c)));
      if (name === 'am-master') { if (ev) ev.stopPropagation(); const au = this._autos(x()); return S.master(this, au.all); }
      if (name === 'am-row') {
        const au = this._autos(x()), id = au.ids[d.k];
        if (!id) return M.openEditor(this, { cardClass: this.constructor, focus: 'autos' });
        return S.flip(this, id);
      }
      if (name === 'am-min') { const au = this._autos(x()); return au.numId ? S.setMins(h, au.numId, Number(d.v)) : undefined; }
      if (name === 'h-filter') return this.setUI({ hf: d.k, hn: 0, hnF: d.k });
      if (name === 'h-more') {
        const A = M.lasAuto(h, c), evs = this._events(A, x()) || [], fk = this.ui.hf || 'alle', fx = (FIL.find((f) => f[0] === fk) || FIL[0])[3], n = evs.filter(fx).length;
        const cnt = COUNTS.includes(Number(c.hist_count)) ? Number(c.hist_count) : 6, hn = this.ui.hn && this.ui.hnF === fk ? this.ui.hn : cnt;
        return this.setUI({ hn: hn < n ? n : cnt, hnF: fk });
      }
      return super.onAction(name, el, ev);
    }
    _lock(id) {
      const y = lockInfo(this.hass, this.config, id);
      M.haptic('medium');
      this._setPend(id, 'locked');
      M.call(this.hass, 'lock', 'lock', { entity_id: id }).catch(() => { if (this._pend && this._pend[id]) { clearTimeout(this._pend[id].tm); delete this._pend[id]; this.update(); } });
      return y;
    }
    _unlock(id) {
      const y = lockInfo(this.hass, this.config, id);
      M.haptic('medium');
      if (y.code) return M.lockUnlock(this, id, { name: y.name, codeLength: this.config.code_length, toast: (t) => this._toast(t), onSent: () => this._setPend(id, 'unlocked') });
      this._setPend(id, 'unlocked');
      return this.hass.callService('lock', 'unlock', { entity_id: id }).catch((e) => { if (this._pend && this._pend[id]) { clearTimeout(this._pend[id].tm); delete this._pend[id]; } M.haptic('failure'); M.toast('Feil: ' + (e && e.message ? e.message : e)); this.update(); });
    }
    afterRender() {
      const sr = this.shadowRoot;
      // 1–2 låser: kuttes et navn ved denne bredden → scroll-modus (aldri kuttede navn, tannhjulet alltid synlig)
      const w = Math.round(this.getBoundingClientRect().width);
      if (w && this._pickW !== w) { this._pickW = w; if (this._pickMode && this._pickMode !== 'eq') { this._pickMode = 'eq'; this.update(); return; } }
      if (this._pickMode !== 'many' && !S.pickerFits(sr)) { this._pickMode = this._pickMode === 'fit' ? 'many' : 'fit'; this.update(); }
      const tr = sr.querySelector('.lk-track');
      if (tr && !tr.__b) this._bindTrack(tr);
      const hf = sr.querySelector('.sk-hf');
      if (hf && M.glassDrag && !hf.__g) { hf.__g = 1; }
    }
    _bindTrack(tr) {
      tr.__b = true;
      const stop = (e) => e.stopPropagation();
      ['touchstart', 'touchmove', 'touchend'].forEach((t) => tr.addEventListener(t, stop, { passive: true }));
      tr.addEventListener('contextmenu', (e) => e.preventDefault());
      const st = () => { const id = tr.dataset.id, s = id && this.hass.states[id]; return { id, mode: tr.dataset.mode, lk: tr.classList.contains('locked'), busy: tr.classList.contains('busy') || !s || M.unavailable(s) }; };
      tr.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        if (e.button) return;
        const s = st();
        if (s.busy || !s.lk || s.mode === 'trykk') return;
        this._endDrag(true);
        try { tr.setPointerCapture(e.pointerId); } catch (x) { /* */ }
        const g = { tr, id: s.id, mode: s.mode, sx: e.clientX, w: Math.max(1, tr.getBoundingClientRect().width - 64), f: 0, armed: false };
        this._drag = g; this._busy = true;
        tr.classList.add('drag');
        M.haptic('selection');
        if (s.mode === 'hold') {
          tr.classList.add('holding');
          const t0 = Date.now();
          g.iv = setInterval(() => { const v = Math.min(1, (Date.now() - t0) / HOLD_MS); this._setF(g, v); if (v >= 1) { this._endDrag(false); this._swallowT = Date.now(); this._unlock(g.id); } }, 30);
        }
      });
      tr.addEventListener('pointermove', (e) => {
        const g = this._drag;
        if (!g || g.tr !== tr || g.mode !== 'dra') return;
        e.stopPropagation();
        const v = M.clamp((e.clientX - g.sx) / g.w, 0, 1);
        if (v >= ARM && !g.armed) M.haptic('medium');
        this._setF(g, v);
      });
      const up = (e) => {
        const g = this._drag;
        if (!g || g.tr !== tr) return;
        e.stopPropagation();
        const done = g.mode === 'dra' && g.f >= ARM;
        if (g.mode === 'dra' && g.f > 0.04) this._swallowT = Date.now();
        this._endDrag(!done);
        if (done) this._unlock(g.id);
      };
      tr.addEventListener('pointerup', up);
      tr.addEventListener('pointercancel', up);
      tr.addEventListener('lostpointercapture', up);
      tr.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this._swallowT && Date.now() - this._swallowT < 500) return;
        const s = st();
        if (s.busy) return;
        if (!s.lk) return this._lock(s.id);
        if (s.mode === 'trykk') return this._unlock(s.id);
        if (s.mode === 'dra') { tr.classList.remove('hint'); void tr.offsetWidth; tr.classList.add('hint'); }
        return undefined;
      });
    }
    _setF(g, v) {
      g.f = v;
      g.tr.style.setProperty('--f', String(v));
      const arm = v >= ARM;
      if (arm !== g.armed) { g.armed = arm; g.tr.classList.toggle('arm', arm); }
    }
    // Avslutt drag/hold. reset: knotten glir tilbake (ingen opplåsing)
    _endDrag(reset) {
      const g = this._drag;
      if (!g) return;
      this._drag = null;
      clearInterval(g.iv);
      g.tr.classList.remove('drag', 'holding', 'arm');
      if (reset) g.tr.style.setProperty('--f', '0');
      this._busy = false;
      this.update();
    }
    get styles() {
      return `${S.CSS}
        .lk-track{position:relative;height:64px;border-radius:32px;overflow:hidden;background:var(--gray100,#2f2f2f);box-shadow:inset 0 0 0 1px rgba(255,255,255,0.05);touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;cursor:pointer}
        .lk-track.locked.dra:not(.busy){cursor:grab}
        .lk-track.busy,.lk-track.off{cursor:default}
        .lk-fill{position:absolute;left:0;top:0;bottom:0;width:calc(64px + (100% - 64px) * var(--f));border-radius:32px;background:var(--fillc,transparent);transition:width .35s cubic-bezier(.2,.8,.2,1),background .3s}
        .lk-label{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:500;pointer-events:none}
        .lk-track.locked .lk-label{padding-left:48px}
        .lk-track.open .lk-label{padding-right:48px}
        .lk-label.plain{color:var(--gray1000,#e1e1e1)}
        .lk-label.shim{color:transparent;background-image:linear-gradient(90deg,#7f7f7f 0%,#7f7f7f 40%,#fafafa 50%,#7f7f7f 60%,#7f7f7f 100%);background-size:260px 100%;-webkit-background-clip:text;background-clip:text;animation:lk-shimmer 2.4s linear infinite}
        .lk-track.drag .lk-label{opacity:max(0, calc(1 - var(--f) * 1.6))}
        .lk-knob{position:absolute;top:4px;left:calc(4px + (100% - 64px) * var(--f));width:56px;height:56px;border-radius:28px;display:grid;place-items:center;color:#232323;box-shadow:0 6px 16px rgba(0,0,0,0.35);transition:left .35s cubic-bezier(.2,.8,.2,1),background .2s;pointer-events:none}
        .lk-knob.nudge{animation:lk-nudge 3.2s ease-in-out 1s infinite}
        .lk-track.drag .lk-knob{animation:none}
        .lk-track.drag:not(.holding) .lk-fill,.lk-track.drag:not(.holding) .lk-knob{transition:background .2s}
        .lk-track.holding .lk-fill,.lk-track.holding .lk-knob{transition:none}
        .lk-track.arm .lk-knob{background:${O} !important}
        .lk-track.hint .lk-knob{animation:lk-nudge .9s ease-in-out}
        @keyframes lk-nudge{0%,70%,100%{transform:translateX(0)}80%{transform:translateX(6px)}90%{transform:translateX(0)}95%{transform:translateX(3px)}}
        @keyframes lk-shimmer{0%{background-position:-160px 0}100%{background-position:260px 0}}
        @media (prefers-reduced-motion: reduce){.lk-knob.nudge,.lk-label.shim{animation:none}}
      `;
    }
  }

  /* ------------------------------------------------------------ «Tilpass dørlås» (Låser · Seksjoner · Historikk) */
  function openSheet(card, focus) {
    const TABS = [['locks', 'Låser'], ['secs', 'Seksjoner'], ['hist', 'Historikk']];
    return S.sheet(card, {
      title: 'Tilpass dørlås', tabs: TABS, tab: TABS.some((t) => t[0] === focus) ? focus : 'locks',
      body(tab, _d, api) {
        const h = card.hass, D = api.D;
        if (tab === 'locks') {
          const A = M.lasAuto(h, D()), nVis = A.locks.filter((id) => !lockInfo(h, D(), id).hidden).length;
          return `${A.locks.map((id) => {
            const x = lockInfo(h, D(), id), vis = !x.hidden;
            return `<section class="sk-sec" data-key="lk-${esc(x.obj)}"><div class="sk-lhd">${M.icon('mdi:lock', 22, 'color:#afafaf')}<input class="sk-in" data-in="name" data-obj="${esc(x.obj)}" value="${esc(x.name)}" aria-label="Navn"></input>
              ${S.shSw(vis, `data-a="vis" data-obj="${esc(x.obj)}" title="Vis / skjul" aria-label="Vis i velgeren" ${vis && nVis < 2 ? 'aria-disabled="true"' : ''}`)}</div>
              ${S.shEnt(api, { k: 'lock:' + x.obj, icon: 'mdi:lock', label: 'Lås', id, own: (D().include && (D().include.laser || []).includes(id)) ? id : '', auto: id, domains: 'lock' })}
              ${S.shEnt(api, { k: 'door:' + x.obj, icon: 'mdi:door', label: 'Dørsensor', id: x.door, own: x.doorOwn, auto: x.doorAuto, domains: 'binary_sensor', deviceClass: 'door,opening', noneLabel: 'Ingen dørsensor' })}</section>`;
          }).join('') || `<section class="sk-sec"><span class="sk-note">Fant ingen lås (lock.*).</span></section>`}
            <span class="sk-note">Låsene finnes selv fra <code>lock.*</code> og dørsensoren i samme område. Skjulte låser vises ikke i velgeren.</span>`;
        }
        if (tab === 'secs') {
          const u = UNLOCK.some((x) => x[0] === D().unlock) ? D().unlock : 'dra';
          return `${S.shSec('Seksjoner', [['show_status', 'mdi:view-grid-outline', 'Status · dør, batteri, autolås'], ['show_auto', 'mdi:tune', 'Automatikk'], ['show_hist', 'mdi:history', 'Historikk']].map(([k, icon, label]) => S.shRow({ icon, label, on: on(D(), k), attrs: `data-a="bool" data-k="${k}"` })).join(''), 'rows')}
            ${S.shSec('Opplåsing', `${S.shSeg(UNLOCK, u, (v) => `data-a="unl" data-v="${v}"`)}<span class="sk-note">${esc(UNL_NOTE[u])}</span>`)}`;
        }
        const n = COUNTS.includes(Number(D().hist_count)) ? Number(D().hist_count) : 6;
        return `${S.shSec('Antall hendelser', S.shSeg(COUNTS.map((x) => [x, String(x)]), n, (v) => `data-a="cnt" data-v="${v}"`))}
          ${S.shSec('Vis i historikken', [['hist_all', 'mdi:lock', 'Alle låser', 'Ellers bare valgt lås'], ['hist_door', 'mdi:door-open', 'Dør åpnet/lukket', 'Fra dørsensoren'], ['hist_who', 'mdi:account', 'Hvem', 'Navn og bilde når det er kjent'], ['hist_method', 'mdi:dialpad', 'Metode', 'Kode, app, nøkkel, autolås …']].map(([k, icon, label, sub]) => S.shRow({ icon, label, sub, on: on(D(), k), attrs: `data-a="bool" data-k="${k}"` })).join(''), 'rows')}`;
      },
      click(a, el, api) {
        const D = api.D(), h = card.hass;
        if (a === 'bool') { const k = el.dataset.k; return api.path(k, on(D, k) ? false : undefined, 'selection'); }
        if (a === 'unl') return api.path('unlock', el.dataset.v === 'dra' ? undefined : el.dataset.v, 'selection');
        if (a === 'cnt') return api.path('hist_count', Number(el.dataset.v), 'selection');
        if (a === 'vis') {
          const obj = el.dataset.obj, A = M.lasAuto(h, D), x = lockInfo(h, D, 'lock.' + obj);
          const nVis = A.locks.filter((id) => !lockInfo(h, D, id).hidden).length;
          if (!x.hidden && nVis < 2) { M.haptic('warning'); M.toast('Minst én lås må være synlig'); return undefined; }
          return api.path(`locks_cfg.${obj}.hidden`, x.hidden ? undefined : true, 'selection');
        }
        return undefined;
      },
      change(t, api) {
        if (t.dataset.in === 'name') { const obj = t.dataset.obj, st = card.hass.states['lock.' + obj], v = t.value.trim(); api.path(`locks_cfg.${obj}.name`, !v || (st && v === st.attributes.friendly_name) ? undefined : v); }
      },
      pick(t, v, api) {
        const [kind, obj] = String(t.dataset.pk).split(':'), D = api.D();
        if (kind === 'door') return api.path(`locks_cfg.${obj}.door`, v || undefined, 'selection');
        if (kind === 'lock') {
          const old = 'lock.' + obj;
          if (!v || v === 'none' || v === old) return undefined;
          const ex = [...new Set([...(D.exclude || []).filter((x) => x !== v), old])];
          const inc = [...new Set([...((D.include || {}).laser || []).filter((x) => x !== old), v])];
          return api.set({ exclude: ex, 'include.laser': inc }, 'selection');
        }
        return undefined;
      },
    });
  }

  if (M.POPUP_CARDS && !M.POPUP_CARDS.includes('msh-las-card')) M.POPUP_CARDS.push('msh-las-card'); // «Mellomrom» i editoren
  M.define('msh-las-card', Las, 'MSH Dørlås', 'Dørlås-popup (#dorlas): låsvelger, toppkort med dra/hold/trykk for å låse opp, status, automatikk og historikk.');

  /* ------------------------------------------------------------ én dørlås-popup (32.1 · samme metode som 28.14/30.1) */
  // Gamle/importerte dørlås-popuper (#dorlas med andre kort, eller gamle hasher) erstattes av den genererte #dorlas med ÉTT
  // msh-las-card. Lenker til de gamle hashene åpner #dorlas.
  const HASH = '#dorlas', OLD = ['#las', '#lock', '#laas', '#dorlaas', '#doerlas', '#doorlock'];
  const tagOf = (c) => String((c && c.type) || '').replace('custom:', '');
  const deepCards = (cards) => { const out = []; const w = (L) => (L || []).forEach((c) => { if (!c || typeof c !== 'object') return; out.push(c); if (Array.isArray(c.cards)) w(c.cards); if (c.card) w([c.card]); }); w(cards); return out; };
  const lockish = (c) => /lock|las|l[aå]s|dorlas|keymaster/i.test(tagOf(c)) || /"lock\.[a-z0-9_]+"/.test(JSON.stringify(c));
  // Gammel popup = kortene er ikke nøyaktig ÉTT msh-las-card, og minst ett av dem handler om lås
  M.lasLegacyTest = (cfg) => { if (!cfg || typeof cfg !== 'object' || !Array.isArray(cfg.cards)) return false; const one = cfg.cards.length === 1 && tagOf(cfg.cards[0]) === 'msh-las-card'; return !one && deepCards(cfg.cards).some((c) => tagOf(c) !== 'msh-las-card' && lockish(c)); };
  M.lasMigratePopup = function (cfg, want) {
    if (!M.lasLegacyTest(cfg)) return null;
    const own = deepCards(cfg.cards).find((c) => tagOf(c) === 'msh-las-card');
    const w = want && typeof want === 'object' ? want : { type: 'custom:msh-las-card' };
    return { ...cfg, cards: [{ ...w, ...(own || {}), type: 'custom:msh-las-card', card_id: (own && own.card_id) || w.card_id || 'pop-dorlas' }] };
  };
  M.POPUP_SUPERSEDE = M.POPUP_SUPERSEDE || {};
  M.POPUP_SUPERSEDE[HASH] = { name: 'Dørlås', test: (cfg) => M.lasLegacyTest(cfg) };
  M.POPUP_MIGRATE = M.POPUP_MIGRATE || {};
  M.POPUP_MIGRATE[HASH] = (cfg, gen) => M.lasMigratePopup(cfg, gen && Array.isArray(gen.cards) ? gen.cards[0] : null);
  M.POPUP_ALIAS = M.POPUP_ALIAS || {};
  OLD.forEach((h) => { M.POPUP_ALIAS[h] = { to: HASH, tag: 'msh-las-card', test: (cfg) => deepCards(cfg && cfg.cards).some(lockish) }; });
  M.POPUP_LEGACY_CARD = M.POPUP_LEGACY_CARD || {};
  if (!M.POPUP_LEGACY_CARD[HASH]) M.POPUP_LEGACY_CARD[HASH] = () => null;
  if (!window.__mshLasHash) {
    window.__mshLasHash = true;
    const hasPopup = (hash) => {
      const Rp = M.popupReport;
      if (Rp && Array.isArray(Rp.entries) && Rp.entries.length) return Rp.entries.some((x) => x.hash === hash && !x.hidden);
      let found = false;
      const w = (r, d) => { if (found || !r || d > 14 || !r.querySelectorAll) return; r.querySelectorAll('bubble-card').forEach((b) => { const c = b.config || b._config; if (c && c.hash === hash) found = true; }); if (!found) r.querySelectorAll('*').forEach((x) => { if (x.shadowRoot) w(x.shadowRoot, d + 1); }); };
      w(document, 0);
      return found;
    };
    window.addEventListener('hashchange', () => {
      const h = location.hash;
      if (!OLD.includes(h) || hasPopup(h) || !hasPopup(HASH)) return;
      try { history.replaceState(history.state, '', location.pathname + location.search + HASH); window.dispatchEvent(new HashChangeEvent('hashchange')); window.dispatchEvent(new CustomEvent('location-changed')); } catch (x) { /* */ }
    });
  }
})();
