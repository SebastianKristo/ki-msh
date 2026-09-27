/* msh-las-card · Dørlås-popup #dorlas (fiks 16.7). Visuelt språk: Sikkerhet v3.dc.html (popup #282828, kort #3a3a3a,
 * indre flater #2f2f2f) + Hjem v3 lås-arket (ikon-sirkel med ring, pille-knapp).
 * Seksjoner (ett kort i popupen): [segment når flere låser] → hero (lås-ikon i sirkel grønn/oransje/rød, status 32 px,
 * «Låst av Rune · 12:39», stor pille «Lås opp» rosa gradient / «Lås» grå) → batteri og siste kontakt → automatikk
 * (bare det som finnes) → siste 10 hendelser (logbook/get_events når popupen åpnes).
 * Opplåsing krever bekreftelse: hold pillen i 1 s (ring rundt ikonet) eller PIN (tastatur portalt ut av popupen via
 * MSH.overlay) når låsen har code_format (confirm: auto | hold | pin).
 * Autokonfig: alle lock.* (exclude/include.laser), batteri = battery_level-attributt eller batterisensor på samme enhet,
 * auto-lås = number/input_number (+ switch) på samme enhet med «auto lock / autolås / relock» i navnet, «Lås når alle
 * drar» / «Lås om natten» = automation/input_boolean/switch med lås + borte/natt i navnet. Ingen gjettede ID-er –
 * finnes ingenting, skjules raden. Overstyring per lås: locks_cfg.<objekt>.{name, battery, auto_lock, auto_lock_switch},
 * globalt: overrides.away_lock / overrides.night_lock.
 * MSH.lockUnlock(card, id, { name, toast }) – felles opplåsing (PIN når låsen krever kode), brukes også av Hjem-flisen.
 */
(function () {
  const M = window.MSH, esc = M.esc, C = M.C;
  const PINK = 'linear-gradient(145deg, rgb(242 133 201) -10%, rgb(245 205 198) 100%)';
  const GREEN = C.green, ORANGE = C.orange, RED = C.red;
  const AUTO_RX = /auto.?re?lock|autol[aå]s|auto.?l[aå]s|relock/i;
  const LOCK_RX = /l[aå]s|lock/i;
  const AWAY_RX = /borte|away|alle.?dra|leav|ingen.?hjemme|nobody/i;
  const NIGHT_RX = /natt|night|kveld|bedtime|leggetid/i;
  const HOLD_MS = 1000;
  const hm = (t) => { const d = new Date(t); return `${M.pad(d.getHours())}:${M.pad(d.getMinutes())}`; };
  const when = (t) => {
    if (!t || isNaN(t)) return '–';
    const d = new Date(t), now = new Date();
    if (d.toDateString() === now.toDateString()) return hm(t);
    if (d.toDateString() === new Date(now.getTime() - 86400000).toDateString()) return 'i går ' + hm(t);
    return d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' }) + ' ' + hm(t);
  };
  const STATUS = { locked: 'Låst', unlocked: 'Ulåst', locking: 'Låser …', unlocking: 'Låser opp …', jammed: 'Satt fast', open: 'Åpen', opening: 'Åpner …' };
  const VERB = { locked: 'Låst', unlocked: 'Låst opp', open: 'Åpnet', jammed: 'Satt fast' };
  const colorOf = (v) => (v === 'jammed' ? RED : v === 'locked' || v === 'locking' ? GREEN : /^(unlocked|unlocking|open|opening)$/.test(v) ? ORANGE : 'var(--gray600, #7f7f7f)');
  const txt = (hass, id) => id + ' ' + String((hass.states[id] && hass.states[id].attributes.friendly_name) || '');
  const devEnts = (hass, id) => {
    const e = hass.entities && hass.entities[id];
    if (!e || !e.device_id) return [];
    return Object.keys(hass.entities).filter((x) => x !== id && hass.entities[x].device_id === e.device_id && hass.states[x]);
  };
  const real = (hass, id) => (id && hass.states[id] ? id : null);

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
    const name = o.name || (st && st.attributes.friendly_name) || obj.replace(/_/g, ' ');
    return { id, obj, st, name, bat, batId, autoNum, autoSw, code: !!(st && st.attributes.code_format) };
  }
  // «Lås når alle drar» / «Lås om natten»: overstyring eller entitet med lås + borte/natt i navnet
  function findRule(hass, cfg, key, rx) {
    const ov = cfg.overrides && cfg.overrides[key];
    if (ov) return real(hass, ov);
    return Object.keys(hass.states).filter((id) => /^(automation|input_boolean|switch)\./.test(id) && LOCK_RX.test(txt(hass, id)) && rx.test(txt(hass, id)) && !AUTO_RX.test(txt(hass, id))).sort()[0] || null;
  }
  M.lasAuto = function (hass, cfg) {
    cfg = cfg || {};
    if (!hass) return { locks: [], away: null, night: null };
    const locks = M.applyLists(cfg, 'laser', M.all(hass, 'lock')).filter((id) => hass.states[id]);
    return { locks, away: findRule(hass, cfg, 'away_lock', AWAY_RX), night: findRule(hass, cfg, 'night_lock', NIGHT_RX) };
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
    .ok{width:100%;height:52px;border-radius:26px;background:${PINK};color:#2f2f2f;font-size:15px;font-weight:600}
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
    const call = (code) => hass.callService('lock', 'unlock', code ? { entity_id: id, code } : { entity_id: id }).then(() => { M.haptic('success'); toast(`${nm} låst opp`); return true; });
    if (st.attributes.code_format || o.pin) {
      return M.lockPad({ title: `Lås opp ${nm.toLowerCase() === 'dørlås' ? 'døren' : nm}`, len: codeLen(st.attributes.code_format, o.codeLength), submit: (code) => call(code).catch(() => { M.haptic('failure'); return false; }) });
    }
    return call().catch((e) => { M.haptic('failure'); M.toast('Feil: ' + (e && e.message ? e.message : e)); return false; });
  };

  /* ------------------------------------------------------------ kort */
  const SEC = [['battery', 'Batteri og tilkobling'], ['auto', 'Automatikk'], ['log', 'Siste hendelser']];
  class Las extends M.Card {
    static get cardName() { return 'Dørlås'; }
    static get defaults() { return { confirm: 'auto', toasts: true }; }
    static get uiPersist() { return ['sel']; }
    static getStubConfig() { return { card_id: M.uid(), ...this.defaults }; }
    static get schema() {
      return (h, c) => {
        const A = h ? M.lasAuto(h, c) : { locks: [] };
        return [
          { type: 'lists', label: 'Låser', lists: (hh) => [{ key: 'laser', label: 'Låser (flere = segment øverst)', ids: M.all(hh, 'lock'), domains: ['lock'] }] },
          ...A.locks.map((id) => {
            const x = lockInfo(h, c, id), P = `locks_cfg.${x.obj}`;
            return { type: 'section', id: 'lock-' + x.obj, label: 'Lås · ' + x.name, icon: 'mdi:lock', fields: [
              { type: 'text', name: P + '.name', label: 'Navn', placeholder: (x.st && x.st.attributes.friendly_name) || x.obj },
              { type: 'entity', name: P + '.battery', label: 'Batterisensor', domain: 'sensor', device_class: 'battery', auto: () => (x.batId || (x.bat != null ? id + ' (battery_level)' : null)) },
              { type: 'entity', name: P + '.auto_lock', label: 'Auto-lås etter (minutter)', domains: ['number', 'input_number'], auto: () => x.autoNum },
              { type: 'entity', name: P + '.auto_lock_switch', label: 'Auto-lås av/på', domains: ['switch', 'input_boolean'], auto: () => x.autoSw },
            ] };
          }),
          { type: 'overrides', label: 'Automatikk', fields: [
            { name: 'away_lock', label: 'Lås når alle drar', domains: ['automation', 'input_boolean', 'switch'], auto: (hh, cc) => findRule(hh, { ...cc, overrides: {} }, 'away_lock', AWAY_RX) },
            { name: 'night_lock', label: 'Lås om natten', domains: ['automation', 'input_boolean', 'switch'], auto: (hh, cc) => findRule(hh, { ...cc, overrides: {} }, 'night_lock', NIGHT_RX) },
          ] },
          { type: 'section', id: 'confirm', label: 'Opplåsing', icon: 'mdi:lock-open-check-outline', fields: [
            { type: 'select', name: 'confirm', label: 'Bekreftelse', options: [['auto', 'Automatisk – PIN når låsen krever kode, ellers hold'], ['hold', 'Hold i 1 sekund'], ['pin', 'PIN-kode']], default: 'auto' },
            { type: 'select', name: 'code_length', label: 'PIN-lengde', options: [['auto', 'Fra låsen (code_format)'], [4, '4 siffer'], [6, '6 siffer']], default: 'auto' },
            { type: 'info', label: 'Koden sendes med lock.unlock og lagres ikke i dashbordet.' },
          ] },
          { type: 'order', name: 'sections', hiddenName: 'hidden_sections', label: 'Rekkefølge på seksjoner (toppkortet er alltid først)', options: SEC },
          { type: 'section', id: 'view', label: 'Visning', icon: 'mdi:eye-outline', fields: [{ type: 'boolean', name: 'toasts', label: 'Bekreftelsesmeldinger (toast)', default: true }] },
        ];
      };
    }
    get cardSize() { return 8; }
    customize(focus, opts) { return super.customize(focus, { title: 'Tilpass dørlås', ...(opts || {}) }); }
    onOpen() { this._loadLog(); }
    onClose() { this._stopHold(); }
    _toast(t) { if (this.config.toasts !== false) M.toast(t); }
    _cur(A) { const L = A.locks; if (!L.length) return null; const i = L.indexOf(this.ui.sel); return L[i >= 0 ? i : 0]; }
    // Hvem gjorde siste endring: changed_by-attributtet, ellers person fra logbook (context_user_id)
    _who(e) {
      if (!e) return '';
      if (e.user) { const p = M.all(this.hass, 'person').find((id) => this.hass.states[id].attributes.user_id === e.user); if (p) return M.name(this.hass, p); if (this.hass.user && this.hass.user.id === e.user) return this.hass.user.name || 'Deg'; }
      if (e.ctxEnt && this.hass.states[e.ctxEnt]) return M.name(this.hass, e.ctxEnt);
      return e.ctxName || '';
    }
    async _loadLog() {
      const A = M.lasAuto(this.hass, this.config);
      if (!A.locks.length || !this.hass || !this.hass.callWS) return;
      try {
        const r = await this.hass.callWS({ type: 'logbook/get_events', start_time: new Date(Date.now() - 7 * 86400000).toISOString(), end_time: new Date().toISOString(), entity_ids: A.locks });
        this._log = (Array.isArray(r) ? r : []).filter((e) => e && e.entity_id && e.state != null && e.when != null)
          .map((e) => ({ id: e.entity_id, state: String(e.state), t: typeof e.when === 'number' ? e.when * 1000 : new Date(e.when).getTime(), user: e.context_user_id || null, ctxEnt: e.context_entity_id || null, ctxName: e.context_name || e.context_entity_id_name || null }));
        this._logT = Date.now();
      } catch (e) { this._log = []; this._logT = 0; }
      this.update();
    }
    _events(id, st) {
      const raw = (this._log || []).filter((e) => e.id === id);
      if (this._log && st && st.last_changed) { const t = new Date(st.last_changed).getTime(); if (t > (this._logT || 0) - 1000) raw.push({ id, state: st.state, t }); }
      const seen = new Set(), out = [];
      raw.sort((a, b) => b.t - a.t).forEach((e) => {
        if (!VERB[e.state]) return;
        const k = `${e.state}|${Math.round(e.t / 2000)}`;
        if (seen.has(k)) return;
        seen.add(k);
        out.push(e);
      });
      return out.slice(0, 10);
    }
    _mode(x) { const c = this.config.confirm || 'auto'; return c === 'pin' || (c === 'auto' && x.code) ? 'pin' : 'hold'; }
    render() {
      const c = this.config, hass = this.hass, A = M.lasAuto(hass, c);
      A.locks.forEach((id) => this.s(id));
      if (!A.locks.length) return `<div class="wrap">${this._hero(null)}${M.emptyState('Fant ingen dørlås (lock.*)', 'entities')}</div>`;
      const id = this._cur(A), x = lockInfo(hass, c, id);
      [x.batId, x.autoNum, x.autoSw, A.away, A.night].forEach((e) => e && this.s(e));
      const seg = A.locks.length > 1 ? `<div class="seg" role="tablist" data-glass-drag="x">${A.locks.map((l) => { const on = l === id, y = lockInfo(hass, c, l), v = y.st ? y.st.state : ''; return `<button class="sg ${on ? 'on' : ''}" role="tab" aria-selected="${on}" ${on ? 'data-active="1"' : ''} data-act="pick" data-id="${esc(l)}" data-haptic="selection" data-key="sg-${esc(l)}"><span class="sd" style="background:${colorOf(v)}"></span>${esc(y.name)}</button>`; }).join('')}</div>` : '';
      const sec = {};
      const col = (p) => (p < 15 ? RED : p < 30 ? ORANGE : GREEN);
      const contact = x.st ? x.st.last_reported || x.st.last_updated : null;
      sec.battery = `<section class="sec"><div class="cap">Batteri og tilkobling</div><div class="box">
          <div class="row" ${x.batId ? `data-ent="${esc(x.batId)}"` : ''}>${M.icon(x.bat == null ? 'mdi:battery-unknown' : x.bat < 15 ? 'mdi:battery-alert-variant-outline' : 'mdi:battery-high', 20, `color:${x.bat == null ? 'var(--gray700,#979797)' : col(x.bat)}`)}<span class="rl">Batteri</span>
            ${x.bat != null ? `<span class="bb"><span style="width:${M.clamp(x.bat, 0, 100)}%;background:${col(x.bat)}"></span></span>` : ''}<span class="rv num" style="${x.bat != null ? `color:${col(x.bat)}` : ''}">${x.bat != null ? x.bat + ' %' : '–'}</span></div>
          <div class="row">${M.icon(x.st && M.unavailable(x.st) ? 'mdi:lan-disconnect' : 'mdi:access-point', 20, 'color:var(--gray700,#979797)')}<span class="rl">Siste kontakt</span><span class="rv">${x.st && M.unavailable(x.st) ? 'Utilgjengelig' : contact ? esc(M.relTime(contact)) : '–'}</span></div>
        </div></section>`;
      const rows = [];
      if (x.autoNum || x.autoSw) {
        const ns = x.autoNum ? hass.states[x.autoNum] : null, nv = ns && M.isNum(ns.state) ? Number(ns.state) : null;
        const u = ns ? String(ns.attributes.unit_of_measurement || 'min') : 'min', mins = nv == null ? null : /^s/.test(u) ? Math.round(nv / 60 * 10) / 10 : /^h|^t/.test(u) ? nv * 60 : nv;
        const on = x.autoSw ? M.isOn(hass.states[x.autoSw]) : nv != null && nv > 0;
        rows.push(`<div class="row" data-key="ar-auto">${M.icon('mdi:lock-clock', 20, 'color:var(--gray700,#979797)')}<span class="rl">Lås automatisk${mins != null ? ` etter ${M.nf(mins, mins % 1 ? 1 : 0)} min` : ''}</span>
          ${x.autoNum ? `<span class="stp"><button data-act="num" data-d="-1" data-haptic="selection" title="Kortere">${M.icon('mdi:minus', 18)}</button><button data-act="num" data-d="1" data-haptic="selection" title="Lengre">${M.icon('mdi:plus', 18)}</button></span>` : ''}
          ${x.autoSw ? `<button class="tg ${on ? 'on' : ''}" data-act="sw" data-id="${esc(x.autoSw)}" data-haptic="selection" role="switch" aria-checked="${on}"><span></span></button>` : ''}</div>`);
      }
      [[A.away, 'Lås når alle drar', 'mdi:home-export-outline'], [A.night, 'Lås om natten', 'mdi:weather-night']].forEach(([e, l, icn]) => {
        if (!e) return;
        const on = M.isOn(hass.states[e]);
        rows.push(`<div class="row" data-key="ar-${esc(e)}" data-ent="${esc(e)}">${M.icon(icn, 20, 'color:var(--gray700,#979797)')}<span class="rl">${esc(l)}</span><button class="tg ${on ? 'on' : ''}" data-act="sw" data-id="${esc(e)}" data-haptic="selection" role="switch" aria-checked="${on}"><span></span></button></div>`);
      });
      sec.auto = rows.length ? `<section class="sec"><div class="cap">Automatikk</div><div class="box">${rows.join('')}</div></section>` : '';
      const ev = this._events(id, x.st);
      sec.log = `<section class="sec"><div class="cap">Siste hendelser</div><div class="log">${ev.length ? ev.map((e, i) => {
          const cl = e.state === 'locked' ? GREEN : e.state === 'jammed' ? RED : ORANGE, who = this._who(e);
          return `<div class="ev" data-key="ev-${i}"><div class="evl"><span class="evd" style="background:${cl}"></span><span class="evline" style="background:${i < ev.length - 1 ? 'rgba(255,255,255,0.1)' : 'transparent'}"></span></div>
            <div class="evb"><div class="col" style="gap:2px"><div style="font-size:14px">${esc(VERB[e.state])}</div><div class="evw">${esc(who || x.name)}</div></div><div class="evw num">${esc(when(e.t))}</div></div></div>`;
        }).join('') : `<div class="evw" style="padding:0 0 4px">${this._log ? 'Ingen hendelser siste uke' : 'Henter …'}</div>`}</div></section>`;
      const keys = SEC.map((s) => s[0]);
      let order = Array.isArray(c.sections) ? c.sections.filter((k) => keys.includes(k)) : [];
      keys.forEach((k) => { if (!order.includes(k)) order.push(k); });
      const hid = new Set(c.hidden_sections || []);
      return `<div class="wrap">${seg}${this._hero(x)}${order.filter((k) => !hid.has(k)).map((k) => sec[k] || '').join('')}</div>`;
    }
    // Toppkortet (alltid synlig; mangler lås → «–» og «Velg entitet»)
    _hero(x) {
      const v = x && x.st ? x.st.state : '', un = !x || !x.st || M.unavailable(x.st), col = un ? 'var(--gray600, #7f7f7f)' : colorOf(v);
      const locked = v === 'locked' || v === 'locking';
      const status = un ? '–' : STATUS[v] || v;
      let sub = x ? (un ? 'Utilgjengelig' : '') : 'Ingen lås valgt';
      if (x && !un) {
        const last = this._events(x.id, x.st)[0];
        const by = x.st.attributes.changed_by ? String(x.st.attributes.changed_by) : last && last.state === v ? this._who(last) : '';
        sub = [VERB[v] ? `${VERB[v]}${by ? ' av ' + by : ''}` : x.name, when(new Date(x.st.last_changed).getTime())].join(' · ');
      }
      const mode = x ? this._mode(x) : 'hold', holding = !!this._lh;
      const btn = !x || un ? `<button class="pill gray" disabled>–</button>`
        : locked ? `<button class="pill pink" data-act="main" data-id="${esc(x.id)}" data-haptic="light">${M.icon(mode === 'pin' ? 'mdi:dialpad' : 'mdi:lock-open-variant', 22)}Lås opp</button>`
          : `<button class="pill gray" data-act="main" data-id="${esc(x.id)}" data-haptic="success">${M.icon('mdi:lock', 22)}Lås</button>`;
      const hint = !x || un ? '' : locked ? (mode === 'pin' ? 'Krever PIN-kode' : holding ? 'Hold …' : 'Hold inne i 1 sekund for å låse opp') : v === 'jammed' ? 'Låsen har satt seg fast – prøv å låse igjen' : 'Trykk for å låse';
      return `<section class="hero" data-key="hero">
        <button class="gear" data-act="customize" title="Tilpass dørlås">${M.icon('mdi:cog', 22)}</button>
        <div class="orb ${holding ? 'holding' : ''}" ${x && x.st ? `data-ent="${esc(x.id)}"` : ''} style="--lc:${col}">
          <svg class="ring" viewBox="0 0 108 108" aria-hidden="true"><circle cx="54" cy="54" r="51" pathLength="100"></circle></svg>
          ${M.icon(un ? 'mdi:lock-question' : v === 'jammed' ? 'mdi:lock-alert' : locked ? 'mdi:lock' : 'mdi:lock-open-variant', 40, `color:${col}`)}</div>
        <div class="st">${esc(status)}</div>
        <div class="by">${esc(sub)}</div>
        ${btn}
        <div class="hint">${esc(hint)}</div>
      </section>`;
    }
    onAction(name, el, ev) {
      const d = el.dataset, hass = this.hass;
      if (name === 'pick') { if (d.id && d.id !== this.ui.sel) this.setUI({ sel: d.id }); return; }
      if (name === 'main') {
        const x = lockInfo(hass, this.config, d.id), v = x.st ? x.st.state : '';
        if (v === 'locked' || v === 'locking') {
          if (this._mode(x) === 'pin') return M.lockUnlock(this, x.id, { name: x.name, pin: true, codeLength: this.config.code_length, toast: (t) => this._toast(t) });
          return this._toast('Hold inne i 1 sekund for å låse opp');
        }
        return M.call(hass, 'lock', 'lock', { entity_id: x.id }).then(() => this._toast(`${x.name} låst`)).catch(() => {});
      }
      if (name === 'sw') {
        const id = d.id, dom = id.split('.')[0], on = M.isOn(hass.states[id]);
        if (dom === 'automation') return M.call(hass, 'automation', on ? 'turn_off' : 'turn_on', { entity_id: id });
        return M.call(hass, dom, on ? 'turn_off' : 'turn_on', { entity_id: id });
      }
      if (name === 'num') {
        const A = M.lasAuto(hass, this.config), x = lockInfo(hass, this.config, this._cur(A));
        const ns = x.autoNum && hass.states[x.autoNum];
        if (!ns) return;
        const a = ns.attributes, step = Number(a.step) || 1, cur = M.isNum(ns.state) ? Number(ns.state) : Number(a.min) || 0;
        const nv = M.clamp(cur + Number(d.d) * step, a.min != null ? Number(a.min) : -Infinity, a.max != null ? Number(a.max) : Infinity);
        return M.call(hass, x.autoNum.split('.')[0], 'set_value', { entity_id: x.autoNum, value: nv });
      }
      return super.onAction(name, el, ev);
    }
    afterRender() {
      const seg = this.shadowRoot.querySelector('.seg');
      if (seg && M.glassDrag) M.glassDrag(seg, { axis: 'x' });
      const b = this.shadowRoot.querySelector('.pill.pink');
      if (b && !b.__h) {
        b.__h = true;
        M.guardDrag(b, 'none');
        b.addEventListener('pointerdown', (e) => { if (e.button) return; this._startHold(b.dataset.id, e); });
        b.addEventListener('pointermove', (e) => { if (this._lh && Math.hypot(e.clientX - this._lh.x, e.clientY - this._lh.y) > 12) this._stopHold(); });
        ['pointerup', 'pointerleave', 'pointercancel'].forEach((t) => b.addEventListener(t, () => this._stopHold()));
        b.addEventListener('contextmenu', (e) => e.preventDefault());
      }
    }
    // Hold 1 s på «Lås opp» (ring rundt ikonet fylles 0 → 100 %) → lås opp. Slipper man før, skjer ingenting.
    _startHold(id, e) {
      const x = lockInfo(this.hass, this.config, id);
      if (!x.st || x.st.state !== 'locked' || this._mode(x) === 'pin') return;
      this._stopHold(true);
      const h = (this._lh = { id, x: e.clientX, y: e.clientY });
      const orb = this.shadowRoot.querySelector('.orb');
      if (orb) { void orb.offsetWidth; orb.classList.add('holding'); }
      const ht = this.shadowRoot.querySelector('.hint');
      if (ht) ht.textContent = 'Hold …';
      h.t = setTimeout(() => {
        if (this._lh !== h) return;
        this._lh = null;
        this._swallow = true;
        setTimeout(() => { this._swallow = false; }, 600);
        M.lockUnlock(this, id, { name: x.name, toast: (t) => this._toast(t) });
        this.update();
      }, HOLD_MS);
    }
    _stopHold(quiet) {
      const h = this._lh;
      if (!h) return;
      clearTimeout(h.t);
      this._lh = null;
      const orb = this.shadowRoot.querySelector('.orb');
      if (orb) orb.classList.remove('holding');
      if (!quiet) this.update();
    }
    get styles() {
      return `
        .wrap{display:flex;flex-direction:column;gap:var(--msh-gap, 22px)}
        .seg{display:flex;gap:2px;padding:4px;border-radius:26px;position:relative;touch-action:pan-y;background:var(--gray100,#2f2f2f);overflow-x:auto;scrollbar-width:none}
        .seg::-webkit-scrollbar{display:none}
        .sg{flex:1 0 auto;height:40px;padding:0 16px;border-radius:20px;display:flex;align-items:center;justify-content:center;gap:8px;font-size:14px;font-weight:500;white-space:nowrap;color:var(--gray800,#afafaf);background:transparent;transition:background .25s,color .25s}
        .sg.on{background:${C.accent};color:var(--gray100,#2f2f2f)}
        .sd{width:8px;height:8px;border-radius:4px;flex:none}
        .hero{position:relative;display:flex;flex-direction:column;align-items:center;gap:6px;padding:26px 18px 20px;border-radius:28px;background:var(--gray200,#3a3a3a);box-shadow:inset 0 0 0 1px rgba(255,255,255,0.05)}
        .gear{position:absolute;top:16px;right:16px;width:44px;height:44px;border-radius:22px;display:grid;place-items:center;background:rgba(255,255,255,0.1);color:var(--gray1000,#e1e1e1)}
        .orb{position:relative;width:108px;height:108px;border-radius:54px;display:grid;place-items:center;margin-bottom:8px;background:color-mix(in srgb, var(--lc) 18%, transparent);box-shadow:0 12px 30px color-mix(in srgb, var(--lc) 22%, transparent);transition:background .4s,box-shadow .4s;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
        .ring{position:absolute;inset:0;width:100%;height:100%;transform:rotate(-90deg);pointer-events:none}
        .ring circle{fill:none;stroke:var(--lc);stroke-width:3;stroke-linecap:round;stroke-dasharray:100;stroke-dashoffset:100;opacity:0;transition:opacity .15s}
        .orb.holding .ring circle{opacity:1;stroke:${ORANGE};stroke-dashoffset:0;transition:stroke-dashoffset ${HOLD_MS}ms linear,opacity .15s}
        .st{font-size:32px;font-weight:500;letter-spacing:-0.02em;line-height:1.15}
        .by{font-size:13px;color:var(--gray700,#979797);text-align:center}
        .pill{margin-top:14px;width:100%;max-width:320px;height:60px;border-radius:30px;display:flex;align-items:center;justify-content:center;gap:10px;font-size:17px;font-weight:600;touch-action:manipulation;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;transition:transform .15s,opacity .2s}
        .pill:active{transform:scale(.98)}
        .pill.pink{background:${PINK};color:#2f2f2f;touch-action:none}
        .pill.gray{background:var(--gray400,#545454);color:var(--white,#fafafa)}
        .pill:disabled{opacity:.45}
        .hint{min-height:16px;font-size:12px;color:var(--gray600,#7f7f7f);text-align:center}
        .sec{display:flex;flex-direction:column;gap:8px}
        .cap{font-size:12px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;color:var(--gray600,#7f7f7f);padding:0 4px}
        .box{display:flex;flex-direction:column;padding:4px 16px;border-radius:24px;background:var(--gray200,#3a3a3a)}
        .row{display:flex;align-items:center;gap:12px;min-height:54px}
        .row + .row{border-top:1px solid rgba(255,255,255,0.05)}
        .rl{flex:1;min-width:0;font-size:14px}
        .rv{font-size:14px;color:var(--gray800,#afafaf);white-space:nowrap}
        .bb{width:56px;height:8px;border-radius:4px;background:var(--gray100,#2f2f2f);overflow:hidden;flex:none}
        .bb span{display:block;height:100%;border-radius:4px}
        .stp{display:flex;gap:6px;flex:none}
        .stp button{width:34px;height:34px;border-radius:17px;display:grid;place-items:center;background:var(--gray300,#404040)}
        .stp button:active{background:#4a4a4a}
        .tg{position:relative;width:48px;height:28px;border-radius:14px;background:var(--gray400,#545454);flex:none;transition:background .2s}
        .tg span{position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:11px;background:var(--white,#fafafa);transition:transform .2s cubic-bezier(.34,1.4,.64,1)}
        .tg.on{background:${GREEN}}
        .tg.on span{transform:translateX(20px)}
        .log{display:flex;flex-direction:column;padding-left:4px}
        .ev{display:flex;gap:14px;align-items:stretch}
        .evl{display:flex;flex-direction:column;align-items:center;width:10px;flex:none}
        .evd{width:9px;height:9px;border-radius:5px;margin-top:5px;flex:none}
        .evline{flex:1;width:1px;margin-top:4px}
        .evb{flex:1;display:flex;justify-content:space-between;gap:12px;padding-bottom:14px}
        .evw{font-size:12px;color:var(--gray600,#7f7f7f)}
      `;
    }
  }
  if (M.POPUP_CARDS && !M.POPUP_CARDS.includes('msh-las-card')) M.POPUP_CARDS.push('msh-las-card'); // «Mellomrom» i editoren
  M.define('msh-las-card', Las, 'MSH Dørlås', 'Dørlås-popup (#dorlas): status, lås/lås opp med hold eller PIN, batteri, automatikk og siste hendelser.');
})();
