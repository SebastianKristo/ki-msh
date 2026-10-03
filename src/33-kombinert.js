/* KI MSH · Fiks 36.1–36.4 · kombinerte rom («Stue + Kjøkken»): flere HA-områder vises som ÉTT romkort på Hjem og åpner
 * ÉN felles Rom-popup (#<id>, msh-rom-card med rooms: [..]).
 * Config (ki-store, Hjem-configen = msh-hjem-faner-card, card_id ki-home-faner – «Tilpass Hjem» → Kort → «Kombiner rom»):
 *   combined_rooms: [{ id: 'stue-kjokken', name: 'Stue + Kjøkken', icon: 'mdi:sofa', color: 'var(--orange)',
 *                      rooms: ['stue', 'kjokken'], primary: 'stue' | 'avg', hide_members: true, layout: 'merge' | 'group',
 *                      start_tab?: '<fane-id>' | 'last' }]
 * Én kilde: listen over. Rom-kortets egen editor og msh-hjem-card-/faner-editoren skriver til den (M.combinedSave), og
 * strategien leser den (popup + romkort). Autokonfig per rom som før (entiteter.md) → union; overrides/exclude/include
 * gjelder per kombinert rom (ki-store rooms.<id>, som et vanlig rom).
 * Validering (M.combinedNorm): områder som ikke finnes (slettet i HA) fjernes; færre enn 2 rom igjen → kombinasjonen
 * oppløses (dissolved → melding i Tilpass). Et rom kan bare være i én kombinasjon (første vinner).
 *   M.combinedRaw()                 → rålisten (live faner-kort › ki-store › strategiens home.cards.faner)
 *   M.combinedNorm(hass, raw)       → { list, dissolved }
 *   M.combinedList(hass, cfg?)      → gyldige kombinasjoner (cfg = faner-config når kalleren har den)
 *   M.combinedGet(hass, id, cfg?)   → kombinasjonen med id (eller null)
 *   M.combinedOfArea(hass, area)    → kombinasjonen et område er med i
 *   M.combinedOfCard(hass, cfg)     → kombinasjonen et msh-rom-card viser (ki-store-listen › cfg.rooms)
 *   M.combinedApply(hass, cfg, t, base) → romlisten for en Hjem-fane: kombinert rom inn på første medlems plass,
 *                                          medlemmene ut når hide_members (de beholder sin lagrede plass i layout)
 *   M.combinedKeepOrder(order, old, hidden, cid) → lagret rekkefølge der skjulte medlemmer beholder plassen sin
 *   M.combinedSave(hass, list)      → skriv listen (samme lagring som «Tilpass Hjem», MSH.saveCardConfig)
 *   M.combinedField(kind)           → editorfelt (type html) for getConfigElement: kind 'hjem' | 'rom'
 */
(function () {
  const M = window.MSH;
  if (!M || M.combinedNorm) return;
  const esc = M.esc;
  const get = (o, p) => String(p).split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  const FANER = () => (M.CARD_IDS && M.CARD_IDS.faner) || 'ki-home-faner';

  // «Stue + Kjøkken» → stue-kjokken
  M.combinedSlug = (n) => String(n || '').toLowerCase().replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'a').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'kombinert';
  const areaName = (hass, id) => (hass && hass.areas && hass.areas[id] && hass.areas[id].name) || id;

  /* ------------------------------------------------------------ kilde */
  M.combinedRaw = function () {
    try {
      const live = M.liveOf && M.liveOf('msh-hjem-faner-card');
      if (live && live.config && live.config.combined_rooms !== undefined) return live.config.combined_rooms || [];
    } catch (e) { /* */ }
    const st = M.store && (M.store.eff ? M.store.eff('cards.' + FANER()) : M.store.get('cards.' + FANER()));
    if (st && Object.prototype.hasOwnProperty.call(st, 'combined_rooms')) return st.combined_rooms || [];
    const sc = M.strategyConfig && get(M.strategyConfig, 'home.cards.faner.combined_rooms');
    return Array.isArray(sc) ? sc : [];
  };

  /* ------------------------------------------------------------ validering */
  const NC = new WeakMap();
  M.combinedNorm = function (hass, raw) {
    raw = Array.isArray(raw) ? raw : [];
    const A = (hass && hass.areas) || null;
    const key = A && typeof raw === 'object' ? JSON.stringify(raw) : null;
    if (A && key) { const c = NC.get(A); if (c && c.key === key) return c.res; }
    const list = [], dissolved = [], used = new Set(), ids = new Set(Object.keys(A || {}));
    raw.forEach((e, i) => {
      if (!e || typeof e !== 'object') return;
      const want = (Array.isArray(e.rooms) ? e.rooms : []).map(String);
      const missing = A ? want.filter((r) => !A[r]) : [];
      const rooms = [...new Set(want)].filter((r) => (!A || A[r]) && !used.has(r));
      const name = String(e.name || '').trim() || rooms.map((r) => areaName(hass, r)).join(' + ') || 'Kombinert rom';
      let id = M.combinedSlug(e.id || name);
      if (rooms.length < 2) { dissolved.push({ index: i, id, name, rooms, missing }); return; }
      let n = 2;
      const base = id;
      while (ids.has(id) || list.some((x) => x.id === id)) id = base + '-' + n++;
      rooms.forEach((r) => used.add(r));
      const primary = e.primary === 'avg' ? 'avg' : rooms.includes(e.primary) ? e.primary : rooms[0];
      const fr = A && A[primary === 'avg' ? rooms[0] : primary];
      const F = fr && fr.floor_id && hass.floors ? hass.floors[fr.floor_id] : null;
      const icon = e.icon || (fr && fr.icon) || 'mdi:vector-combine';
      list.push({ ...e, id, name, icon, color: e.color || (M.romColor ? M.romColor(rooms[0], hass) : 'var(--orange)'), rooms, primary, hide_members: e.hide_members !== false, layout: e.layout === 'group' ? 'group' : 'merge', floor: fr ? fr.floor_id || null : null, floorName: F ? F.name : null, level: F ? F.level : null, missing, index: i });
    });
    const res = { list, dissolved };
    if (A && key) NC.set(A, { key, res });
    return res;
  };
  M.combinedList = (hass, cfg) => M.combinedNorm(hass, cfg && cfg.combined_rooms !== undefined ? cfg.combined_rooms || [] : M.combinedRaw()).list;
  M.combinedGet = (hass, id, cfg) => (id ? M.combinedList(hass, cfg).find((x) => x.id === id) || null : null);
  M.combinedOfArea = (hass, area, cfg) => M.combinedList(hass, cfg).find((x) => x.rooms.includes(area)) || null;
  // Rom-kortet: ki-store-listen (area = kombinasjonens id) › kortets egen rooms-liste (YAML uten strategi)
  M.combinedOfCard = function (hass, cfg) {
    cfg = cfg || {};
    const id = cfg.area || cfg.combined;
    const hit = id ? M.combinedGet(hass, id) : null;
    if (hit) return hit;
    if (!Array.isArray(cfg.rooms) || cfg.rooms.length < 2) return null;
    const n = M.combinedNorm(hass, [{ id: id || cfg.rooms.join('-'), name: cfg.name, icon: cfg.icon, color: cfg.color, rooms: cfg.rooms, primary: cfg.primary, layout: cfg.layout, hide_members: cfg.hide_members }]);
    const r = n.list[0] || null;
    if (r && id) r.id = id;
    return r;
  };
  // Romnavn for et medlem (taggene i popupen)
  M.combinedRoomName = areaName;

  /* ------------------------------------------------------------ Hjem: romlisten per fane */
  // base = områdeobjekter (M.areas-form) fanen viser før rekkefølgen brukes. t = fanen (kind floor|andre|hjem|custom, hc).
  M.combinedApply = function (hass, cfg, t, base) {
    const L = M.combinedList(hass, cfg);
    if (!L.length || !t) return base;
    let out = base.slice();
    const fill = get(cfg || {}, `tabs.${t.id}.auto_fill`) !== false;
    L.forEach((cb) => {
      const at = out.findIndex((a) => cb.rooms.includes(a.id));
      const own = out.findIndex((a) => a.id === cb.id);
      const hcHas = !!(t.hc && Array.isArray(t.hc.cards) && t.hc.cards.includes('rom:' + cb.id));
      let belongs;
      if ((t.kind === 'floor' || t.kind === 'andre') && fill) belongs = t.kind === 'floor' ? cb.floor === t.floor : !cb.floor;
      else belongs = at >= 0 || hcHas;
      if (t.kind === 'floor' || t.kind === 'andre') belongs = belongs || (at >= 0 && !fill);
      if (cb.hide_members) out = out.filter((a) => !cb.rooms.includes(a.id));
      if (!belongs || own >= 0) return;
      const v = { id: cb.id, name: cb.name, icon: cb.icon, picture: null, floor: cb.floor, floorName: cb.floorName, level: cb.level, combined: true, rooms: cb.rooms.slice() };
      // plassen: der første medlem stod (før medlemmene ble tatt ut), ellers sist
      const firstIdx = base.findIndex((a) => cb.rooms.includes(a.id));
      let pos = out.length;
      if (firstIdx >= 0) { const before = base.slice(0, firstIdx).filter((a) => out.includes(a)); pos = before.length ? out.indexOf(before[before.length - 1]) + 1 : 0; }
      out.splice(pos, 0, v);
    });
    return out;
  };
  // Medlemmer som er skjult på Hjem (hide_members)
  M.combinedHidden = (hass, cfg) => new Set(M.combinedList(hass, cfg).filter((x) => x.hide_members).flatMap((x) => x.rooms));
  // Lagret rekkefølge etter en flytting: skjulte medlemmer beholder plassen sin (etter samme forgjenger som før), så de
  // kommer tilbake på gammel plass ved oppdeling. Medlemmer som ikke stod i den gamle rekkefølgen legges rett før
  // kombinasjonen (som står der første medlem stod).
  M.combinedKeepOrder = function (hass, cfg, order, old) {
    const hid = M.combinedHidden(hass, cfg);
    if (!hid.size) return order;
    const out = order.filter((x) => !hid.has(x));
    (old || []).forEach((id, i) => {
      if (!hid.has(id) || out.includes(id)) return;
      let j = i - 1;
      while (j >= 0 && !out.includes(old[j])) j--;
      out.splice(j >= 0 ? out.indexOf(old[j]) + 1 : 0, 0, id);
    });
    M.combinedList(hass, cfg).filter((x) => x.hide_members).forEach((cb) => {
      const ci = out.indexOf(cb.id);
      if (ci < 0) return;
      cb.rooms.filter((r) => !out.includes(r)).forEach((r) => { out.splice(out.indexOf(cb.id), 0, r); });
    });
    return out;
  };

  /* ------------------------------------------------------------ romdata for romkortet (summert) */
  const baseRomData = M.romData;
  if (baseRomData) {
    M.romData = function (card, area, cfg) {
      const hass = card && card.hass;
      const cb = hass && area && !(hass.areas && hass.areas[area]) ? M.combinedGet(hass, area) : null;
      if (!cb) return baseRomData(card, area, cfg);
      cfg = cfg || {};
      const look = cfg.look || {};
      const RS = (M.roomCfgs && M.roomCfgs[cb.id]) || (M.store && (M.store.eff ? M.store.eff('rooms.' + cb.id) : M.store.get('rooms.' + cb.id))) || {};
      const mc = { icon_color_mode: cfg.icon_color_mode || RS.icon_color_mode, icon_tap: cfg.icon_tap || RS.icon_tap, icon_color_default: cfg.icon_color_default, icon_tap_default: cfg.icon_tap_default };
      const R = cb.rooms.map((a) => baseRomData(card, a, mc)).filter(Boolean);
      if (!R.length) return null;
      const pr = cb.primary === 'avg' ? null : R.find((r) => r.id === cb.primary) || R[0];
      const avg = (k) => { const v = R.map((r) => r[k]).filter((x) => x != null && !isNaN(x)); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
      const th = (pr && pr.thermo ? pr : R.find((r) => r.thermo)) || null;
      const ws = R.map((r) => r.watt).filter((x) => x != null);
      const uniq = (k) => [...new Set(R.flatMap((r) => r[k] || []))];
      const lights = uniq('lights'), media = uniq('media'), doors = uniq('doors');
      const temp = pr ? (pr.temp != null ? pr.temp : avg('temp')) : avg('temp');
      const hum = pr ? (pr.hum != null ? pr.hum : avg('hum')) : avg('hum');
      const p0 = pr || R[0];
      return {
        ...p0, id: cb.id, name: look.name || cb.name, icon: look.icon || cb.icon, col: M.color(look.col || look.color || cb.color, M.romColor ? M.romColor(cb.rooms[0], hass) : 'var(--orange)'),
        temp, hum, tempId: pr ? pr.tempId : null, humId: pr ? pr.humId : null,
        thermo: th ? th.thermo : null, set: th ? th.set : null, step: th ? th.step : 0.5, heating: R.some((r) => r.heating),
        lights, lightsOn: R.reduce((a, r) => a + (r.lightsOn || 0), 0), media, mediaOn: R.reduce((a, r) => a + (r.mediaOn || 0), 0),
        doors, doorOpen: R.some((r) => r.doorOpen), wattId: null, watt: ws.length ? ws.reduce((a, b) => a + b, 0) : null,
        floor: cb.floor, floorName: cb.floorName, level: cb.level, outdoor: R.every((r) => r.outdoor),
        hash: cfg.hash || '#' + cb.id, ent: (th && th.thermo) || (pr && pr.tempId) || lights[0] || null, combined: true, rooms: cb.rooms.slice(),
      };
    };
  }

  /* ------------------------------------------------------------ lagring */
  const fanerCfg = () => {
    const live = M.liveOf && M.liveOf('msh-hjem-faner-card');
    if (live && live._yamlConfig && M.effectiveConfig) return { cfg: M.effectiveConfig(live._yamlConfig, live, { shared: true }), live };
    const y = { type: 'custom:msh-hjem-faner-card', card_id: FANER() };
    return { cfg: M.effectiveConfig ? M.effectiveConfig(y, null, { shared: true }) : y, live: null };
  };
  // Lagre hele listen (ingen rebuild, strategien oppdaterer popupene live)
  M.combinedSave = function (hass, list) {
    const { cfg, live } = fanerCfg();
    const clean = (list || []).map((e) => { const { floor, floorName, level, missing, index, ...rest } = e || {}; return rest; });
    const nc = { ...cfg };
    if (clean.length) nc.combined_rooms = clean; else delete nc.combined_rooms;
    if (!nc.card_id) nc.card_id = FANER();
    if (!nc.type) nc.type = 'custom:msh-hjem-faner-card';
    return M.saveCardConfig(hass || M.lastHass, cfg, nc, { toasts: false, card: live || undefined });
  };
  M.combinedStrip = (list) => (list || []).map((e) => { const { floor, floorName, level, missing, index, ...rest } = e || {}; return rest; });

  /* ------------------------------------------------------------ GUI-editor (getConfigElement) */
  // kind 'hjem': hele listen (msh-hjem-faner-card skriver til egen config via ed._set, msh-hjem-card via M.combinedSave).
  // kind 'rom': kombinasjonen kortet viser (rooms, primær, layout). Endringer speiles: ki-store-listen er sannheten.
  const chip = (on, a, extra, label, key) => `<button class="msh-cbc${on ? ' on' : ''}" data-a="fn" data-k="${key}" data-op="${a}" ${extra} data-haptic="selection" aria-pressed="${on}">${esc(label)}</button>`;
  const FIELD_CSS = `<style>.msh-cbx{display:flex;flex-direction:column;gap:10px}.msh-cbr{display:flex;flex-direction:column;gap:8px;padding:12px;border-radius:16px;background:var(--ki-surface, #3a3a3a)}.msh-cbh{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:600}.msh-cbh span{flex:1;min-width:0}.msh-cbl{font-size:12px;color:var(--ki-text-mid, #979797)}.msh-cbw{display:flex;flex-wrap:wrap;gap:6px}.msh-cbc{height:32px;padding:0 12px;border-radius:16px;font-size:12px;font-weight:500;background:var(--ki-surface-3, #2f2f2f);color:var(--ki-text-2, #afafaf)}.msh-cbc.on{background:var(--pink, #f285c9);color:var(--ki-on-accent, #2a1720)}.msh-cbc[disabled]{opacity:.4}.msh-cbd{height:32px;padding:0 12px;border-radius:16px;font-size:12px;font-weight:500;background:rgb(242 128 115 / 0.2);color:var(--ki-red-text, rgb(242 128 115))}</style>`;
  M.combinedField = function (kind) {
    const listOf = (hh, cc) => (kind === 'hjem' && cc && cc.combined_rooms !== undefined ? cc.combined_rooms || [] : M.combinedRaw()).map((e) => ({ ...e }));
    const write = (ed, list) => {
      const hh = ed._hass;
      list = M.combinedStrip(list);
      if (kind === 'hjem' && ed._config && ('combined_rooms' in ed._config || /hjem-faner/.test(String(ed._config.type || '')))) return ed._set('combined_rooms', list.length ? list : undefined);
      M.combinedSave(hh, list);
      if (kind === 'rom') {
        const cb = list.find((x) => M.combinedSlug(x.id || x.name) === (ed._config && ed._config.area));
        if (cb) { ed._config = { ...ed._config, rooms: cb.rooms, primary: cb.primary, layout: cb.layout }; }
      }
      setTimeout(() => ed._render && ed._render(), 0);
    };
    const one = (hh, e, i, key, all) => {
      const areas = M.areas(hh), rooms = Array.isArray(e.rooms) ? e.rooms : [];
      const taken = {}; all.forEach((x, j) => { if (j !== i) (x.rooms || []).forEach((r) => { taken[r] = x.name || r; }); });
      const prim = e.primary || rooms[0];
      return `<div class="msh-cbr" data-key="cb-${i}"><div class="msh-cbh">${M.icon(e.icon || 'mdi:vector-combine', 20, `color:${M.color(e.color, 'var(--orange, #f2b573)')}`)}<span>${esc(e.name || rooms.map((r) => areaName(hh, r)).join(' + ') || 'Nytt kombinert rom')}</span>${kind === 'hjem' ? `<button class="msh-cbd" data-a="fn" data-k="${key}" data-op="del" data-i="${i}">Del opp</button>` : ''}</div>
        <span class="msh-cbl">Rom (minst 2)</span><div class="msh-cbw">${areas.map((a) => chip(rooms.includes(a.id), 'room', `data-i="${i}" data-v="${esc(a.id)}"${taken[a.id] ? ' disabled' : ''}`, a.name + (taken[a.id] ? ' · I ' + taken[a.id] : ''), key)).join('')}</div>
        <span class="msh-cbl">Primærrom (klima-toppkortet)</span><div class="msh-cbw">${rooms.map((r) => chip(prim === r, 'prim', `data-i="${i}" data-v="${esc(r)}"`, areaName(hh, r), key)).join('')}${chip(prim === 'avg', 'prim', `data-i="${i}" data-v="avg"`, 'Snitt av alle', key)}</div>
        <span class="msh-cbl">Seksjonene i popupen</span><div class="msh-cbw">${chip(e.layout !== 'group', 'lay', `data-i="${i}" data-v="merge"`, 'Slå sammen', key)}${chip(e.layout === 'group', 'lay', `data-i="${i}" data-v="group"`, 'Grupper per rom', key)}</div>
        ${kind === 'hjem' ? `<div class="msh-cbw">${chip(e.hide_members !== false, 'hide', `data-i="${i}"`, 'Skjul enkeltrommene på Hjem', key)}</div>` : ''}</div>`;
    };
    return {
      type: 'html',
      html: (hh, cc, key) => {
        if (!hh) return '';
        const all = listOf(hh, cc);
        if (kind === 'rom') {
          const cb = M.combinedOfCard(hh, cc);
          const i = cb ? all.findIndex((x) => M.combinedSlug(x.id || x.name) === cb.id) : -1;
          if (i < 0) return cb ? `${FIELD_CSS}<div class="msh-cbx"><span class="msh-cbl">Kombinert rom fra kortets YAML (rooms: ${esc(cb.rooms.join(', '))}). Lag kombinasjonen i «Tilpass Hjem» → Kort → «Kombiner rom» for å redigere den her.</span></div>` : '';
          return `${FIELD_CSS}<div class="msh-cbx">${one(hh, all[i], i, key, all)}<span class="msh-cbl">Samme valg som «Tilpass Hjem» → Kort → «Kombiner rom».</span></div>`;
        }
        const D = M.combinedNorm(hh, all).dissolved.filter((d) => d.missing.length || (all[d.index] && (all[d.index].rooms || []).length >= 2));
        return `${FIELD_CSS}<div class="msh-cbx">${D.map((d) => `<span class="msh-cbl" style="color:var(--ki-orange-text, var(--orange, #f2b573))">«${esc(d.name)}» er oppløst – færre enn 2 rom igjen${d.missing.length ? ' (' + esc(d.missing.join(', ')) + ' finnes ikke)' : ''}.</span>`).join('')}
          ${all.map((e, i) => one(hh, e, i, key, all)).join('')}
          <button class="msh-cbc" data-a="fn" data-k="${key}" data-op="add" data-haptic="light">+ Nytt kombinert rom</button></div>`;
      },
      click: (d, ed) => {
        const hh = ed._hass, all = listOf(hh, ed._config), i = Number(d.i), e = all[i];
        M.haptic(d.op === 'del' ? 'warning' : 'selection');
        if (d.op === 'add') { const free = M.areas(hh).map((a) => a.id).filter((r) => !all.some((x) => (x.rooms || []).includes(r))).slice(0, 2); all.push({ id: M.combinedSlug(free.map((r) => areaName(hh, r)).join(' + ')), name: free.map((r) => areaName(hh, r)).join(' + '), rooms: free, hide_members: true, layout: 'merge' }); return write(ed, all); }
        if (!e) return;
        if (d.op === 'del') { all.splice(i, 1); return write(ed, all); }
        if (d.op === 'room') { const r = e.rooms || []; e.rooms = r.includes(d.v) ? r.filter((x) => x !== d.v) : [...r, d.v]; if (e.primary && e.primary !== 'avg' && !e.rooms.includes(e.primary)) delete e.primary; }
        if (d.op === 'prim') e.primary = d.v;
        if (d.op === 'lay') e.layout = d.v === 'group' ? 'group' : 'merge';
        if (d.op === 'hide') e.hide_members = e.hide_members === false;
        if (!e.id) e.id = M.combinedSlug(e.name || (e.rooms || []).join(' + '));
        return write(ed, all);
      },
    };
  };

  // Hjem-kortene tegnes på nytt når listen endres (ki-store)
  if (M.store && M.store.subscribe) {
    let sig = null;
    M.store.subscribe(() => {
      let s = '';
      try { s = JSON.stringify(M.combinedRaw()); } catch (e) { /* */ }
      if (s === sig) return;
      const first = sig === null;
      sig = s;
      if (first) return;
      if (M.liveCards) M.liveCards.forEach((set) => set.forEach((el) => { if (el.isConnected && /^msh-(romkort|hjem-faner|rom|rom-klima)-card$/.test(el.localName) && el.update) el.update(); }));
    });
  }
})();
