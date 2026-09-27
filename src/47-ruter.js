/* msh-ruter-card · popup #ruter. Kilde: Ruter v2.dc.html
 * Avvikskort (entur_sx, sammenleggbart) + «Avganger» med ett kort per stopp (entur_public_transport / entur).
 * Designet har ikke eget toppkort (hero) – avvikskortet er første seksjon i dette kortet.
 * Attributter leses defensivt: route, due_at, due_in, delay, real_time, next_route, next_due_at, next_due_in,
 * next_real_time, transport_mode, stop_id, departure_#N («ca. 21:30 5 Vestli»), evt. departures-liste.
 */
(function () {
  const M = window.MSH, esc = M.esc, C = M.C;
  // Transportmiddel → [ikon, linjefarge] (Ruters linjefarger, ikke temafarger).
  const MODE = { metro: ['subway', 'oklch(0.66 0.16 45)'], tram: ['tram', 'oklch(0.62 0.13 245)'], bus: ['directions_bus', 'oklch(0.6 0.17 25)'], coach: ['directions_bus', 'oklch(0.6 0.17 25)'], rail: ['train', 'oklch(0.55 0.12 260)'], water: ['directions_boat', 'oklch(0.6 0.1 220)'], air: ['flight', 'oklch(0.55 0.12 260)'] };
  const modeOf = (k) => MODE[String(k || '').toLowerCase()] || null;
  const PLAT = ['entur_public_transport', 'entur'];
  const NORMAL = /^(normal( service)?|ok|ingen( avvik)?|none|0|unknown|unavailable|)$/i;

  const hmToMin = (s) => {
    const m = /(\d{1,2})[:.](\d{2})/.exec(String(s || ''));
    if (!m) return null;
    const now = new Date(), t = new Date(now);
    t.setHours(Number(m[1]), Number(m[2]), 0, 0);
    let d = (t - now) / 60000;
    if (d < -720) d += 1440;
    if (d > 720) d -= 1440;
    return Math.round(d);
  };
  const isoToMin = (s) => { const t = new Date(s).getTime(); return isNaN(t) ? null : Math.round((t - Date.now()) / 60000); };
  const splitRoute = (r) => {
    const s = String(r || '').trim();
    const i = s.indexOf(' ');
    return i > 0 ? { line: s.slice(0, i), dest: s.slice(i + 1) } : { line: s, dest: '' };
  };

  // Avganger fra én stoppsensor.
  M.enturDepartures = function (st) {
    if (!st) return [];
    const A = st.attributes || {}, out = [];
    const push = (route, min, at, rt, mode) => {
      if (!route) return;
      const r = splitRoute(route);
      out.push({ line: r.line, dest: r.dest, min, at: at || null, rt: rt === true || rt === 'true' || rt === 'True', mode: mode || null });
    };
    if (A.route) {
      let m = hmToMin(A.due_at);
      if (m == null && M.isNum(A.due_in)) m = Number(A.due_in);
      if (m == null && M.isNum(st.state)) m = Number(st.state);
      push(A.route, m, A.due_at, A.real_time, A.transport_mode);
    }
    if (A.next_route) {
      let m = hmToMin(A.next_due_at);
      if (m == null && M.isNum(A.next_due_in)) m = Number(A.next_due_in);
      push(A.next_route, m, A.next_due_at, A.next_real_time, A.next_transport_mode);
    }
    Object.keys(A).map((k) => /^departure_#(\d+)$/.exec(k)).filter(Boolean).sort((a, b) => a[1] - b[1]).forEach((k) => {
      const v = String(A[k[0]] || ''), ca = /^ca\.?\s*/i.test(v), s = v.replace(/^ca\.?\s*/i, '');
      const m = /^(\d{1,2}[:.]\d{2})\s+(.*)$/.exec(s);
      if (m) push(m[2], hmToMin(m[1]), m[1], !ca);
    });
    // Alternativt format: departures: [{ line/route, destination, due_in/expected/aimed, realtime, transport_mode }]
    const L = Array.isArray(A.departures) ? A.departures : [];
    L.forEach((d) => {
      if (!d || typeof d !== 'object') return;
      const line = d.line || d.public_code || d.route_short || '', dest = d.destination || d.front_text || d.front_display || '';
      const min = M.isNum(d.due_in) ? Number(d.due_in) : d.expected ? isoToMin(d.expected) : d.aimed ? isoToMin(d.aimed) : hmToMin(d.due_at);
      out.push({ line: String(line), dest: String(dest), min, at: d.due_at || null, rt: !!(d.realtime || d.real_time), mode: d.transport_mode || null });
    });
    const dm = A.transport_mode || null;
    return out.filter((d) => d.min == null || d.min >= -1).map((d) => ({ ...d, mode: d.mode || dm }));
  };

  // Avvik fra entur_sx-sensorer (linjesensorer og/eller meldingslister).
  function sxItems(hass, id, depModes) {
    const st = hass.states[id];
    if (!st) return [];
    const A = st.attributes || {}, items = [];
    const stat = (s) => { s = String(s || '').toLowerCase(); return /open|active|aktiv|ongoing|pågår/.test(s) ? 'open' : /plan/.test(s) ? 'planned' : /closed|expired|avsluttet/.test(s) ? 'closed' : ''; };
    const lineOf = (v) => String(v || '').replace(/^.*:Line:/i, '');
    const baseLine = lineOf(A.public_code || A.line || A.line_ref || A.line_id || A.line_name || (/line_([a-z0-9]+)$/i.exec(id) || [])[1] || '');
    const kindOf = (line, m) => (m && modeOf(m) ? String(m).toLowerCase() : depModes[line] || 'bus');
    const listKey = ['meldinger', 'messages', 'deviations', 'situations', 'items', 'alerts'].find((k) => Array.isArray(A[k]));
    if (listKey) {
      A[listKey].forEach((x, i) => {
        if (!x || typeof x !== 'object') return;
        const line = lineOf(x.public_code || x.line || x.line_ref || baseLine);
        const s = stat(x.status || x.progress) || 'open';
        if (s === 'closed') return;
        items.push({ key: `${id}#${i}`, ent: id, line, kind: kindOf(line, x.transport_mode), sum: x.summary || x.title || x.text || x.header || '–', st: s, desc: x.description || x.advice || '', from: x.valid_from || x.start_time || x.validity_start || '', to: x.valid_to || x.end_time || x.validity_end || '' });
      });
      return items;
    }
    const sum = A.summary || A.title || st.state;
    let s = stat(A.status || A.progress);
    if (!s && !NORMAL.test(String(sum).trim()) && !M.isNum(st.state)) s = 'open';
    items.push({ key: id, ent: id, line: baseLine, kind: kindOf(baseLine, A.transport_mode), sum: String(sum), st: s, desc: A.description || A.advice || '', from: A.valid_from || A.start_time || A.validity_start || '', to: A.valid_to || A.end_time || A.validity_end || '', isLine: true });
    return items;
  }

  const stopCfg = (cfg, id) => (cfg.stops && cfg.stops[id.split('.').slice(1).join('.')]) || {};
  const stopName = (hass, id, cfg) => stopCfg(cfg || {}, id).name || String(M.name(hass, id)).replace(/^entur\s+/i, '');

  // Autokonfig for Ruter.
  M.ruterAuto = function (hass, cfg) {
    cfg = cfg || {};
    if (!hass) return { stops: [], autoStops: [], allStops: [], sum: null, autoSum: null, lines: [], lineAuto: [] };
    const autoStops = [...new Set(PLAT.flatMap((p) => M.byPlatform(hass, p, 'sensor')))].filter((id) => M.usable(hass, id));
    const allStops = [...new Set([...autoStops, ...((cfg.include && cfg.include.stopp) || [])])];
    let stops = M.applyLists(cfg, 'stopp', autoStops).filter((id) => hass.states[id]);
    const ord = Array.isArray(cfg.stop_order) ? cfg.stop_order : [];
    stops = stops.map((id, i) => [id, ord.indexOf(id) < 0 ? 1000 + i : ord.indexOf(id)]).sort((a, b) => a[1] - b[1]).map((x) => x[0]);
    const sx = M.byPlatform(hass, 'entur_sx').filter((id) => /^(sensor|binary_sensor)\./.test(id));
    const isLine = (id) => { const A = hass.states[id].attributes; return /line/i.test(id.split('.')[1]) || A.line != null || A.line_ref != null || A.line_id != null || A.public_code != null; };
    const autoSum = sx.find((id) => /_summary$/.test(id)) || sx.find((id) => !isLine(id)) || null;
    const sum = M.pick(cfg, 'avvik', autoSum);
    let lineAuto = sx.filter((id) => id !== sum && isLine(id));
    const dev = sum && M.regEntry(hass, sum) && M.regEntry(hass, sum).device_id;
    if (dev) { const same = lineAuto.filter((id) => (M.regEntry(hass, id) || {}).device_id === dev); if (same.length) lineAuto = same; }
    const lines = M.applyLists(cfg, 'linjer', lineAuto).filter((id) => hass.states[id]);
    return { stops, autoStops, allStops, sum, autoSum, lines, lineAuto };
  };

  class Ruter extends M.Card {
    static get cardName() { return 'Ruter'; }
    static get defaults() { return { show_disruptions: true, hide_zero: false, planned: true, walk: true, realtime: true, sort: 'liste' }; }
    static get schema() {
      return (h, c) => {
        let a;
        try { a = M.ruterAuto(h, c); } catch (e) { a = M.ruterAuto(null); }
        return [
          { type: 'lists', label: 'Stopp og avvikslinjer', lists: () => [
            { key: 'stopp', label: 'Stopp (entur_public_transport)', ids: a.autoStops, domains: ['sensor'] },
            { key: 'linjer', label: 'Avvikslinjer (entur_sx)', ids: a.lineAuto, domains: ['sensor', 'binary_sensor'] },
          ] },
          { type: 'order', name: 'stop_order', hiddenName: 'exclude', label: 'Rekkefølge på stopp', options: a.allStops.map((id) => [id, stopName(h, id, c)]) },
          { type: 'section', label: 'Stopp · navn, ikon, gangtid og linjer', icon: 'mdi:map-marker-outline', id: 'stops', fields: a.stops.length ? a.stops.map((id) => {
            const obj = id.split('.').slice(1).join('.'), deps = M.enturDepartures(h.states[id]);
            const avail = [...new Set(deps.map((d) => d.line))];
            const mm = modeOf((deps[0] || {}).mode);
            return { type: 'section', label: stopName(h, id, c), fields: [
              { type: 'info', label: id },
              { type: 'text', name: `stops.${obj}.name`, label: 'Navn', auto: () => String(M.name(h, id)).replace(/^entur\s+/i, '') },
              { type: 'icon', name: `stops.${obj}.icon`, label: 'Ikon', auto: () => M.iconName(mm ? mm[0] : (h.states[id].attributes.icon || 'directions_bus')) },
              { type: 'text', name: `stops.${obj}.walk`, label: 'Gangtid / tekst', placeholder: '4 min gange' },
              { type: 'text', name: `stops.${obj}.lines`, label: 'Linjer (line_whitelist) · tomt = alle', placeholder: avail.length ? 'Tilgjengelig: ' + avail.join(', ') : 'f.eks. 5, 19' },
              { type: 'number', name: `stops.${obj}.count`, label: 'Antall avganger', min: 1, max: 10, placeholder: '2' },
            ] };
          }) : [{ type: 'info', label: 'Autokonfig fant ingen stopp' }] },
          { type: 'overrides', label: 'Avvik (Entur SX)', fields: [{ name: 'avvik', label: 'Oppsummeringssensor', domain: ['sensor', 'binary_sensor'], platform: 'entur_sx', auto: () => a.autoSum }] },
          { type: 'section', label: 'Visning', icon: 'mdi:eye-outline', id: 'view', fields: [
            { type: 'boolean', name: 'show_disruptions', label: 'Vis avvikskort · øverst i popupen', default: true },
            { type: 'boolean', name: 'hide_zero', label: 'Skjul når ingen avvik', default: false },
            { type: 'boolean', name: 'planned', label: 'Ta med planlagte avvik', default: true },
            { type: 'boolean', name: 'walk', label: 'Vis gangtid · teksten ved hvert stopp', default: true },
            { type: 'boolean', name: 'realtime', label: 'Vis sanntidsmerke', default: true },
            { type: 'select', name: 'sort', label: 'Sortering', options: [['liste', 'Min rekkefølge'], ['tid', 'Neste avgang']], default: 'liste' },
          ] },
          { type: 'gap' },
        ];
      };
    }
    get cardSize() { return 6; }
    onOpen() { clearInterval(this._tick); this._tick = setInterval(() => this.update(), 30000); }
    onClose() { clearInterval(this._tick); this._tick = 0; }
    _badge(line, kind, big, icon) {
      const m = modeOf(kind) || MODE.bus;
      return `<span class="badge" style="height:${big ? 28 : 26}px;border-radius:${String(kind).toLowerCase() === 'bus' || !modeOf(kind) ? 7 : 13}px;background:${m[1]}">${icon ? M.icon(m[0], 15) : ''}${esc(line)}</span>`;
    }
    render() {
      const c = this.config, h = this.hass, a = M.ruterAuto(h, c), ui = this.ui;
      a.stops.forEach((id) => this.s(id));
      if (a.sum) this.s(a.sum);
      a.lines.forEach((id) => this.s(id));
      // stopp + avganger
      const depModes = {};
      let stops = a.stops.map((id) => {
        const st = this.s(id), sc = stopCfg(c, id), wl = String(sc.lines || '').split(/[\s,;]+/).filter(Boolean), n = Math.max(1, Math.min(10, Number(sc.count) || 2));
        const all = M.enturDepartures(st);
        all.forEach((d) => { if (d.mode && !depModes[d.line]) depModes[d.line] = String(d.mode).toLowerCase(); });
        const D = all.filter((d) => !wl.length || wl.includes(d.line)).slice(0, n);
        const mm = modeOf((all[0] || {}).mode);
        const icon = sc.icon || (mm ? mm[0] : st.attributes.icon || 'directions_bus');
        return { id, name: stopName(h, id, c), icon, walk: c.walk !== false ? sc.walk || '' : '', D, min: D[0] && D[0].min != null ? D[0].min : 9999 };
      });
      if (c.sort === 'tid') stops = [...stops].sort((x, y) => x.min - y.min);
      // avvik
      const sumSt = a.sum ? this.s(a.sum) : null;
      let items = [];
      if (sumSt) items = items.concat(sxItems(h, a.sum, depModes).filter((x) => !x.isLine || x.st));
      a.lines.forEach((id) => { items = items.concat(sxItems(h, id, depModes)); });
      const lineCount = a.lines.length;
      const active = items.filter((x) => x.st === 'open'), planned = items.filter((x) => x.st === 'planned');
      let cnt = active.length + (c.planned !== false ? planned.length : 0);
      if (!items.length && sumSt && M.isNum(sumSt.state)) cnt = Number(sumSt.state);
      const shownItems = items.filter((x) => x.st === 'open' || (c.planned !== false && x.st === 'planned'));
      const sumName = sumSt ? M.name(h, a.sum) : '';
      let dis = '';
      if (c.show_disruptions !== false && !(c.hide_zero && !cnt && a.sum)) {
        if (!a.sum && !lineCount) {
          dis = `<section class="dis"><button class="dh" data-act="customize" data-section="overrides">
            <span class="diw" style="background:var(--gray300, #404040);color:var(--gray700, #979797)">${M.icon('mdi:help-circle-outline', 24)}</span>
            <span class="grow col" style="gap:2px"><span class="dt">Avvik</span><span class="ds ell">Fant ingen avvikssensor (entur_sx) – trykk for å velge</span></span>
          </button></section>`;
        } else {
          const open = !!ui.disOpen && shownItems.length > 0;
          dis = `<section class="dis" style="background:${cnt ? M.alpha(C.orange, 0.12) : 'var(--gray200, #3a3a3a)'};box-shadow:${cnt ? `inset 0 0 0 1px ${M.alpha(C.orange, 0.35)}` : 'none'}">
            <button class="dh" data-act="dis" ${a.sum ? `data-ent="${esc(a.sum)}"` : ''} data-haptic="selection">
              <span class="diw" style="background:${cnt ? M.alpha(C.orange, 0.25) : M.alpha(C.green, 0.2)};color:${cnt ? C.orange : C.green}">${M.icon(cnt ? 'warning' : 'check_circle', 24)}</span>
              <span class="grow col" style="gap:2px"><span class="dt">${cnt ? `${cnt} avvik på dine linjer` : 'Ingen avvik'}</span><span class="ds ell">${esc(cnt ? `${active.length} aktive${c.planned !== false ? ` · ${planned.length} planlagte` : ''}${sumName ? ' · ' + sumName : ''}` : lineCount ? `Alle ${lineCount} linjer går som normalt` : sumName ? `${sumName} · alt går som normalt` : 'Alt går som normalt')}</span></span>
              ${shownItems.length ? M.icon('expand_more', 22, `color:var(--gray800, #afafaf);transition:transform .2s;transform:${open ? 'rotate(180deg)' : 'none'}`) : ''}
            </button>
            ${open ? `<div class="dl">${shownItems.map((x) => {
              const xo = ui.xOpen === x.key, act = x.st === 'open';
              return `<button class="dx" data-act="dx" data-k="${esc(x.key)}" data-ent="${esc(x.ent)}" data-key="${esc(x.key)}" data-haptic="selection">
                <span class="row" style="gap:10px;width:100%">${this._badge(x.line, x.kind, true, true)}<span class="grow ell" style="font-size:13px;font-weight:500">${esc(x.sum)}</span><span class="stc" style="background:${act ? M.alpha(C.red, 0.2) : M.alpha(C.blue, 0.2)};color:${act ? C.red : C.blue}">${act ? 'Aktiv' : 'Planlagt'}</span></span>
                ${xo ? `${x.desc ? `<span class="dd">${esc(x.desc)}</span>` : ''}${x.from || x.to ? `<span class="dw">${esc(`Fra: ${fmtWhen(x.from)}${x.to ? ` · Til: ${fmtWhen(x.to)}` : ''}`)}</span>` : ''}` : ''}
              </button>`;
            }).join('')}</div>` : ''}
          </section>`;
        }
      }
      const hdr = `<div class="hdr"><span class="cap">Avganger</span><button class="ed press" data-act="customize" data-section="stops" title="Rediger">${M.icon('tune', 18)}Rediger</button></div>`;
      const body = stops.length ? stops.map((s) => `
        <div class="stop" data-key="${esc(s.id)}" data-ent="${esc(s.id)}">
          <div class="sh"><span class="sn">${M.icon(s.icon, 20, 'color:var(--gray800, #afafaf)')}<span class="ell">${esc(s.name)}</span></span><span class="sw">${esc(s.walk)}</span></div>
          ${s.D.map((d, i) => `<div class="dep" data-key="d${i}">${this._badge(d.line, d.mode || 'bus')}<span class="dest grow ell">${esc(d.dest)}</span>${c.realtime !== false && d.rt ? M.icon('sensors', 14, `color:${C.green}`) : ''}<span class="tm num" style="color:${d.min != null && d.min <= 2 ? C.orange : 'var(--white, #fafafa)'}">${esc(d.min == null ? d.at || '–' : d.min <= 1 ? 'Nå' : d.min >= 60 && d.at ? String(d.at).replace('.', ':') : `${d.min} min`)}</span></div>`).join('')}
          ${s.D.length ? '' : '<span class="none">Ingen avganger for valgte linjer</span>'}
        </div>`).join('') : this._empty();
      return `<div class="wrap">${dis}${hdr}${body}</div>`;
    }
    // Tom-tilstand (ingen entur-stopp): popupen vises alltid, med «Legg til stopp» via felles entitetssøk
    _empty() {
      const pk = M.entityPicker ? M.entityPicker.html({ key: 'pk-addstop', mode: 'add', domains: 'sensor', placeholder: 'Legg til stopp', attrs: 'data-addstop="1"' }) : '';
      return `<div class="nostop" data-key="nostop">
        <span class="nsi">${M.icon('mdi:bus-stop', 26)}</span>
        <span class="nst">Ingen stoppesteder funnet</span>
        <span class="nss">Fant ingen stopp fra Entur-integrasjonen (entur_public_transport). Legg til en avgangssensor, eller installer Entur-integrasjonen.</span>
        ${pk ? `<div class="nsp">${pk}</div>` : `<button class="pick press" data-act="customize" data-section="stops">${M.icon('mdi:plus', 18)}Legg til stopp</button>`}
      </div>`;
    }
    afterRender() {
      const pk = this.shadowRoot && this.shadowRoot.querySelector('msh-entity-picker[data-addstop]');
      if (!pk) return;
      if (this.hass && pk.hass !== this.hass) pk.hass = this.hass;
      if (pk.__ruter) return;
      pk.__ruter = true;
      pk.addEventListener('value-changed', (e) => { e.stopPropagation(); this._addStop(e.detail && e.detail.value); });
    }
    // Legg til stopp: include.stopp (+ fjern fra exclude) og legg sist i rekkefølgen – lagres i kortets config (ki-store)
    async _addStop(id) {
      if (!id) return;
      const old = this._rawConfig || this.config, inc = { ...(old.include || {}) };
      inc.stopp = [...new Set([...(inc.stopp || []), id])];
      const n = { ...old, include: inc, exclude: (old.exclude || []).filter((x) => x !== id) };
      if (Array.isArray(old.stop_order)) n.stop_order = [...old.stop_order.filter((x) => x !== id), id];
      this.setConfig(n);
      try { const r = await M.saveCardConfig(this.hass, old, n, { card: this }); if (r && r.config) this.setConfig(r.config); } catch (e) { console.warn('[ki-msh] Ruter', e); }
    }
    onAction(name, el, ev) {
      if (name === 'dis') return this.setUI({ disOpen: !this.ui.disOpen });
      if (name === 'dx') return this.setUI({ xOpen: this.ui.xOpen === el.dataset.k ? null : el.dataset.k });
      return super.onAction(name, el, ev);
    }
    get styles() {
      return `
        .wrap{display:flex;flex-direction:column;gap:var(--msh-gap, 14px)}
        .dis{display:flex;flex-direction:column;gap:10px;padding:10px 12px 10px 10px;border-radius:30px;background:var(--gray200,#3a3a3a)}
        .dh{display:flex;align-items:center;gap:12px;width:100%;text-align:left}
        .diw{width:52px;height:52px;border-radius:26px;flex:none;display:grid;place-items:center}
        .dt{font-size:15px;font-weight:600}
        .ds{font-size:12px;color:var(--gray800,#afafaf)}
        .dl{display:flex;flex-direction:column;gap:6px}
        .dx{display:flex;flex-direction:column;gap:8px;padding:12px;border-radius:18px;background:rgba(0,0,0,0.18);text-align:left;width:100%}
        .stc{flex:none;font-size:11px;font-weight:600;padding:4px 9px;border-radius:10px}
        .dd{font-size:13px;color:var(--gray900,#c7c7c7);line-height:1.45;text-wrap:pretty}
        .dw{font-size:11px;color:var(--gray700,#979797)}
        .badge{display:inline-flex;align-items:center;justify-content:center;gap:3px;min-width:30px;padding:0 8px;font-size:13px;font-weight:700;color:#fff;flex:none;white-space:nowrap}
        .hdr{display:flex;align-items:center;gap:10px;padding:4px 4px 0}
        .cap{flex:1;font-size:12px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;color:var(--gray600,#7f7f7f)}
        .ed{height:36px;padding:0 12px 0 10px;border-radius:18px;background:var(--gray200,#3a3a3a);display:flex;align-items:center;gap:6px;font-size:13px;color:var(--gray900,#c7c7c7)}
        .stop{display:flex;flex-direction:column;gap:10px;padding:14px 16px;border-radius:24px;background:var(--gray200,#3a3a3a)}
        .sh{display:flex;align-items:center;justify-content:space-between;gap:10px}
        .sn{display:flex;align-items:center;gap:8px;font-size:15px;font-weight:600;min-width:0}
        .sw{font-size:12px;color:var(--gray600,#7f7f7f);white-space:nowrap}
        .dep{display:flex;align-items:center;gap:10px}
        .dest{font-size:14px}
        .tm{font-size:14px;font-weight:600;white-space:nowrap;min-width:48px;text-align:right}
        .none{font-size:12px;color:var(--gray600,#7f7f7f)}
        .nostop{display:flex;flex-direction:column;align-items:center;gap:8px;padding:22px 16px 16px;border-radius:24px;background:var(--gray200,#3a3a3a);text-align:center}
        .nsi{width:52px;height:52px;border-radius:26px;display:grid;place-items:center;background:var(--gray300,#404040);color:var(--gray800,#afafaf)}
        .nst{font-size:15px;font-weight:600}
        .nss{font-size:12px;color:var(--gray700,#979797);line-height:1.45;max-width:320px;text-wrap:pretty}
        .nsp{align-self:stretch;margin-top:6px;text-align:left}
      `;
    }
  }
  function fmtWhen(v) {
    if (!v) return '';
    const t = new Date(v);
    if (isNaN(t.getTime())) return String(v);
    const now = new Date(), hm = `${M.pad(t.getHours())}:${M.pad(t.getMinutes())}`;
    if (t.toDateString() === now.toDateString()) return `I dag kl. ${hm}`;
    const d = t.toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' });
    return `${d.charAt(0).toUpperCase() + d.slice(1)} kl. ${hm}`;
  }
  M.define('msh-ruter-card', Ruter, 'MSH Ruter', 'Avvik (Entur SX) og avganger per stopp (Entur). #ruter');
})();
