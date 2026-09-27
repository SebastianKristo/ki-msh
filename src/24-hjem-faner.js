/* msh-hjem-faner-card · Hjem: fanerad + romkort. Kilde: Hjem v2.dc.html (floorTabs/glassTabs, karusell, liste, aktuelt,
 * batterier, snarvei-fliser, sveip-slides, rom-merker, custEditVals/editVals/lookEd, layoutVals/isWide/curZoom).
 * Faner = Hjem + etasjer fra hass.floors (+ «Andre rom» + egne faner) + Aktuelt (+ Batterier når noe er lavt).
 * Rom = alle HA-områder (M.areas), nye rom dukker opp automatisk. Romkortene rendres med M.romkortHTML fra 32-romkort.js
 * (slås opp ved render-tid – filen lastes etter denne).
 * Fanerad (felles MSH.tabReorder, 05-tab-reorder.js): scroller vannrett, aktiv fane scrolles inn. Dra sideveis = scroll
 * (eller liquid glass-valg når alle faner får plass); hold inne 400 ms + dra = flytt fanen (config.tab_order) – mus og touch.
 */
(function () {
  const M = window.MSH, esc = M.esc, C = M.C;
  const get = (o, p) => String(p).split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  const TAB_H = { lav: 32, std: 38, mid: 44, hoy: 50, ekstra: 56 };
  const OUT_RX = /(^|_)(ute|utendors|utvendig|outdoor|outside|hage|garden|yard|terrasse|uteomrade)(_|$)/;
  const VIEWS = [['karusell', 'Karusell'], ['liste', 'Kortliste'], ['batterier', 'Batterier']];
  const SLOTS = [['off', 'Av'], ['L-top', 'Venstre · over rom'], ['L-bottom', 'Venstre · under rom'], ['R-top', 'Høyre · over rom'], ['R-bottom', 'Høyre · under rom']];
  const KINDS = { lock: ['key', 'Dørlås'], garage: ['garage', 'Garasjeport'], alarm: ['shield', 'Alarm'], cam: ['videocam', 'Kamera'], ruter: ['tram', 'Ruter'], todo: ['handyman', 'Gjøremål'], dish: ['dishwasher_gen', 'Oppvaskmaskin'], vacr: ['robot_2', 'Støvsuger'], tv: ['tv', 'TV'], wash: ['local_laundry_service', 'Vaskemaskin'], dry: ['dry_cleaning', 'Tørketrommel'], jul: ['park', 'Jul'] };
  const KIND_ORDER = Object.keys(KINDS);
  const TILE_DEF = { hjem: { lock: 'L-top', garage: 'L-top', alarm: 'L-bottom', cam: 'R-bottom', ruter: 'R-bottom', todo: 'R-bottom' }, aktuelt: { dish: 'L-top', vacr: 'L-top', tv: 'R-top', wash: 'R-top', dry: 'R-top' } };
  const STACK_DEF = { hjem: { cam: true, ruter: true } };
  const APPL = { dish: [/oppvask|dish.?wash/i, 'dishwasher_gen', 'Oppvaskmaskin', 180], wash: [/vaskemaskin|washing.?machine|washer/i, 'local_laundry_service', 'Vaskemaskin', 120], dry: [/t[øo]rketrommel|tumble|dryer/i, 'dry_cleaning', 'Tørketrommel', 90] };
  const SLIDES = { cal: ['calendar_month', 'Kalender'], vaer: ['partly_cloudy_day', 'Vær'], strom: ['bolt', 'Strøm'], trash: ['delete', 'Søppel'] };
  const TCOL = { gronn: C.green, gul: C.yellow, oransje: C.orange, rod: C.red, bla: C.blue };
  const TSW = [['ingen', 'Grå'], ['gronn', 'Grønn'], ['gul', 'Gul'], ['oransje', 'Oransje'], ['rod', 'Rød'], ['bla', 'Blå'], ['rosa', 'Rosa']];
  const WX = { 'clear-night': 'Klart', cloudy: 'Skyet', exceptional: 'Ekstremvær', fog: 'Tåke', hail: 'Hagl', lightning: 'Torden', 'lightning-rainy': 'Torden og regn', partlycloudy: 'Delvis skyet', pouring: 'Kraftig regn', rainy: 'Regn', snowy: 'Snø', 'snowy-rainy': 'Sludd', sunny: 'Sol', windy: 'Vind', 'windy-variant': 'Vind og skyer' };
  const pad2 = (n) => String(n).padStart(2, '0');
  const regOk = (hass, id) => { const e = M.regEntry(hass, id); return !e || !(e.hidden || e.hidden_by || e.disabled_by); };

  /* ------------------------------------------------------------ adaptiv layout */
  // Mål dashbordflaten (ikke vinduet). Mobil = én kolonne (maks 420 px), bred = to kolonner, ≥1500 px = tre; zoom opptil 1,8×.
  M.hjemLayout = M.hjemLayout || function (mode, vw) {
    const w = vw || M.dashRect().width, vh = window.innerHeight || 900;
    const ipad = /iPad/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const wide = mode === 'stor' ? true : mode === 'mobil' ? false : w >= 1000 || (ipad && w >= 700);
    const pc = wide && w >= 1500;
    const zoom = !wide ? 1 : pc ? M.clamp(Math.min(w / 1480, vh / 820), 1, 1.8) : M.clamp(Math.min(w / 1024, vh / 760), 1, 1.4);
    return { wide, pc, cols: pc ? 3 : wide ? 2 : 1, zoom: Math.round(zoom * 100) / 100, vw: w };
  };

  /* ------------------------------------------------------------ swipe (karusell / flis-stabler) */
  // Horisontal sveip med touch-action: pan-y + stopPropagation (Bubble Card lukker/scroller ikke). Klikk etter drag svelges.
  // Ingen haptic ved sveip/snap – bare trykk (åpne romkort) gir haptic.
  M.hjemSwiper = M.hjemSwiper || function (card, vp, onIndex) {
    if (vp.__sw) return;
    vp.__sw = true;
    M.guardDrag(vp, 'x');
    const track = () => vp.firstElementChild;
    const n = () => Number(vp.dataset.n) || 1, idx = () => Number(vp.dataset.i) || 0;
    let st = null, wheel = 0, wt = 0;
    vp.addEventListener('pointerdown', (e) => { if (card._onDown) card._onDown(e); if (e.button || n() < 2) return; st = { x: e.clientX, y: e.clientY, t: Date.now(), w: vp.clientWidth || 1, lock: null, dx: 0, id: e.pointerId }; });
    vp.addEventListener('pointermove', (e) => {
      if (!st) return;
      const mx = e.clientX - st.x, my = e.clientY - st.y;
      if (!st.lock) {
        if (Math.abs(mx) > 6 && Math.abs(mx) > Math.abs(my)) { st.lock = 'x'; card._busy = true; try { vp.setPointerCapture(st.id); } catch (x) { /* */ } } else if (Math.abs(my) > 8) { st = null; return; } else return;
      }
      e.preventDefault();
      st.dx = mx;
      const i = idx(), edge = (i === 0 && mx > 0) || (i === n() - 1 && mx < 0);
      const tr = track();
      tr.style.transition = 'none';
      tr.style.transform = `translateX(${-i * st.w + (edge ? mx * 0.35 : mx)}px)`;
    });
    const end = (e) => {
      if (!st) return;
      const s0 = st; st = null;
      if (s0.lock !== 'x') return;
      card._busy = false;
      card._swallow = true;
      setTimeout(() => { card._swallow = false; }, 350);
      const v = s0.dx / Math.max(1, Date.now() - s0.t);
      let i = idx();
      if (e.type === 'pointerup') { if (s0.dx < -s0.w * 0.2 || v < -0.45) i++; else if (s0.dx > s0.w * 0.2 || v > 0.45) i--; }
      i = M.clamp(i, 0, n() - 1);
      const tr = track();
      tr.style.transition = '';
      tr.style.transform = `translateX(${-i * 100}%)`;
      onIndex(i); // ingen haptic ved sveip – kun trykk på et romkort gir haptic

    };
    vp.addEventListener('pointerup', end);
    vp.addEventListener('pointercancel', end);
    vp.addEventListener('wheel', (e) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || n() < 2) return;
      e.preventDefault();
      wheel += e.deltaX;
      const now = Date.now();
      if (Math.abs(wheel) > 40 && now - wt > 450) { wt = now; const i = M.clamp(idx() + (wheel > 0 ? 1 : -1), 0, n() - 1); wheel = 0; if (i !== idx()) onIndex(i); }
    }, { passive: false });
  };

  /* ------------------------------------------------------------ oppslag */
  const outdoorFloor = (f) => [M.slug(f.name), M.slug(f.floor_id)].some((x) => OUT_RX.test(x)) ? 1 : 0;
  const customTabs = (c) => String(c.custom_tabs || '').split(',').map((x) => x.trim()).filter(Boolean).map((l) => ({ id: 'c_' + M.slug(l), label: l, view: 'liste', kind: 'custom' }));
  function autoTabs(hass, c) {
    const areas = M.areas(hass), T = [{ id: 'hjem', label: 'Hjem', view: 'karusell', kind: 'hjem' }];
    const floors = M.floors(hass).slice().sort((a, b) => outdoorFloor(a) - outdoorFloor(b) || (a.level ?? 0) - (b.level ?? 0));
    const RES = ['hjem', 'aktuelt', 'batterier', 'uten_etasje'];
    floors.forEach((f) => { if (areas.some((a) => a.floor === f.floor_id)) T.push({ id: RES.includes(f.floor_id) || f.floor_id.startsWith('c_') ? 'f_' + f.floor_id : f.floor_id, label: f.name, view: 'liste', kind: 'floor', floor: f.floor_id }); });
    if (floors.length && areas.some((a) => !a.floor)) T.push({ id: 'uten_etasje', label: 'Andre rom', view: 'liste', kind: 'andre' });
    customTabs(c).forEach((t) => { if (!T.some((x) => x.id === t.id)) T.push(t); });
    T.push({ id: 'aktuelt', label: 'Aktuelt', view: 'liste', kind: 'aktuelt' });
    T.push({ id: 'batterier', label: 'Batterier', view: 'batterier', kind: 'batterier' });
    return T;
  }
  function allTabs(hass, c) {
    const A = autoTabs(hass, c), ord = Array.isArray(c.tab_order) ? c.tab_order : [];
    const out = [...ord.map((id) => A.find((t) => t.id === id)).filter(Boolean), ...A.filter((t) => !ord.includes(t.id))];
    return out.map((t) => ({ ...t, autoLabel: t.label, defView: t.view, label: get(c, 'tab_labels.' + t.id) || t.label, view: t.kind === 'batterier' ? 'batterier' : get(c, 'tab_views.' + t.id) || t.view, hidden: (c.tab_hidden || []).includes(t.id) }));
  }
  // Rom som hører til fanen (før skjuling): etasjens rom + rom hentet fra andre etasjer.
  function floorRank(hass) {
    const fl = M.floors(hass).slice().sort((a, b) => outdoorFloor(a) - outdoorFloor(b) || (a.level ?? 0) - (b.level ?? 0)), rk = {};
    fl.forEach((f, i) => { rk[f.floor_id] = i; });
    return rk;
  }
  function baseRooms(hass, c, t) {
    const rk = floorRank(hass);
    const areas = M.areas(hass).slice().sort((a, b) => (a.floor ? rk[a.floor] ?? 50 : 99) - (b.floor ? rk[b.floor] ?? 50 : 99) || a.name.localeCompare(b.name, 'nb'));
    let base = t.kind === 'floor' ? areas.filter((a) => a.floor === t.floor) : t.kind === 'andre' ? areas.filter((a) => !a.floor) : t.kind === 'custom' ? [] : areas;
    const add = Object.values(get(c, `layout.${t.id}.add`) || {}).filter(Boolean);
    add.forEach((id) => { const a = areas.find((x) => x.id === id); if (a && !base.includes(a)) base = [...base, a]; });
    // Hjem: rom med klimadata først (som favorittene i designet), deretter resten
    if (t.kind === 'hjem' && M.roomAuto) { const has = (a) => { const au = M.roomAuto(hass, a.id); return au.temp || au.thermo ? 0 : 1; }; base = base.map((a, i) => [a, has(a), i]).sort((x, y) => x[1] - y[1] || x[2] - y[2]).map((x) => x[0]); }
    const ord = get(c, `layout.${t.id}.order`) || [];
    return [...ord.map((id) => base.find((a) => a.id === id)).filter(Boolean), ...base.filter((a) => !ord.includes(a.id))];
  }
  // Apparater (oppvask/vask/tørk): status, gjenstående tid, program, effekt, bryter – kun det som finnes.
  function applFind(hass, kind, ov) {
    const [rx] = APPL[kind];
    const other = Object.keys(APPL).filter((k) => k !== kind).map((k) => APPL[k][0]);
    const txt = (id) => id + ' ' + ((hass.states[id].attributes || {}).friendly_name || '');
    const ids = Object.keys(hass.states).filter((id) => /^(sensor|binary_sensor|switch|select|button)\./.test(id) && regOk(hass, id) && rx.test(txt(id)) && !(kind !== 'dish' && other.some((o, i) => o.test(txt(id)) && !rx.test(id))));
    if (!ids.length && !ov) return null;
    const st = (id) => hass.states[id], num = (id) => M.isNum(st(id).state);
    const isRem = (id) => /gjenst|remain|time.?left|rest.?tid|finish|end.?time|slutt|ferdig.?kl|done.?at/i.test(id) && id.startsWith('sensor.');
    const isProg = (id) => /program|prog|cycle|syklus/i.test(id) && !num(id) && /^(sensor|select)\./.test(id);
    const cand = ids.filter((id) => !isRem(id) && !isProg(id));
    const status = ov || cand.find((id) => id.startsWith('sensor.') && /status|state|tilstand|operation|drift|job|run/i.test(id) && !num(id))
      || cand.find((id) => id.startsWith('sensor.') && !num(id) && st(id).attributes.device_class !== 'timestamp')
      || cand.find((id) => id.startsWith('binary_sensor.')) || cand.find((id) => id.startsWith('switch.')) || null;
    if (!status) return null;
    return {
      status, remain: ids.find(isRem) || null, prog: ids.find(isProg) || null,
      power: ids.find((id) => id.startsWith('sensor.') && st(id).attributes.device_class === 'power') || null,
      sw: ids.find((id) => id.startsWith('switch.')) || null, area: M.areaOf(hass, status) || (ids.map((id) => M.areaOf(hass, id)).find(Boolean) || null),
    };
  }
  function tileEnts(hass, c) {
    const o = c.overrides || {}, first = (a) => a[0] || null;
    const tvs = M.all(hass, 'media_player', (s) => s.attributes.device_class === 'tv');
    return {
      lock: o.lock || first(M.all(hass, 'lock')),
      garage: o.garage || first(M.all(hass, 'cover', (s) => ['garage', 'gate'].includes(s.attributes.device_class))),
      alarm: o.alarm || first(M.all(hass, 'alarm_control_panel')),
      cam: o.cam || first(M.all(hass, 'camera')),
      ruter: o.ruter || first([...M.byPlatform(hass, 'entur_public_transport', 'sensor'), ...M.byPlatform(hass, 'entur', 'sensor')]),
      ruterSx: first(M.byPlatform(hass, 'entur_sx')),
      todo: o.todo || first(M.all(hass, 'todo')), todos: M.all(hass, 'todo'),
      tv: o.tv || (() => { const L = tvs.length ? tvs : M.all(hass, 'media_player', (s, id) => /(^|[_\s.-])tv($|[_\s-])/i.test(id + ' ' + (s.attributes.friendly_name || ''))); return L.find((id) => !['off', 'standby', 'unavailable', 'unknown'].includes(hass.states[id].state)) || first(L); })(),
      vacr: o.vacr || first(M.all(hass, 'vacuum')),
      dish: applFind(hass, 'dish', o.dish), wash: applFind(hass, 'wash', o.wash), dry: applFind(hass, 'dry', o.dry),
      weather: o.weather || first(M.all(hass, 'weather')), price: o.price || M.hjemPriceId(hass), watt: o.watt || M.kiRomId(hass, null, 'effekt'),
      calendar: o.calendar || first(M.all(hass, 'calendar')),
      trash: o.trash || c.trash_sensor || first(Object.keys(hass.states).filter((id) => id.startsWith('sensor.') && /s(ø|o)ppel|avfall|renovasjon|trash|waste|garbage/i.test(id) && M.isNum(hass.states[id].state)).sort()),
    };
  }
  const availKinds = (E, c) => [...KIND_ORDER.filter((k) => k === 'jul' || E[k]), ...Object.keys(c.links || {}).filter((k) => c.links[k] && c.links[k].title).sort()];
  const kindLabel = (k, c) => (KINDS[k] ? KINDS[k][1] : ((c.links || {})[k] || {}).title || 'Snarvei');
  const tileSlot = (c, t, k) => get(c, `tiles.${t.id}.${k}.slot`) || (TILE_DEF[t.kind] || {})[k] || 'off';
  const seasonOk = (c, t, k) => {
    const f = get(c, `tiles.${t.id}.${k}.fra`) ?? (k === 'jul' ? '11-01' : ''), tl = get(c, `tiles.${t.id}.${k}.til`) ?? (k === 'jul' ? '03-01' : '');
    if (!/^\d\d-\d\d$/.test(f) || !/^\d\d-\d\d$/.test(tl)) return true;
    const d = new Date(), md = pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
    return f <= tl ? md >= f && md < tl : md >= f || md < tl;
  };
  const fakeCard = (hass, c) => ({ hass, config: c, s: (id) => (id && hass && hass.states[id]) || null, n: (id) => M.num(hass, id) });
  // Rom-overstyring fra rooms.<id>: temperature|humidity|climate (nye) eller temperatur|fuktighet|termostat (gamle);
  // farge fra rooms.<id>.color (eller col). Kun satte nøkler sendes videre (M.roomClimate slår sammen med rom-popupens config).
  const roomCfgOf = (c, area) => {
    const rc = get(c, 'rooms.' + area) || {}, ov = {};
    const t = rc.temperature || rc.temperatur, h = rc.humidity || rc.fuktighet, k = rc.climate || rc.termostat;
    if (t) ov.temperature = t;
    if (h) ov.humidity = h;
    if (k) ov.climate = k;
    return { overrides: ov, look: { icon: rc.icon, color: rc.color || rc.col } };
  };

  /* ------------------------------------------------------------ kort */
  class HjemFaner extends M.Card {
    static get cardName() { return 'Hjem · faner og romkort'; }
    static get defaults() { return { toasts: true, zoom: true }; }
    static get schema() {
      return (hass, c) => {
        if (!hass) return [];
        const fc = fakeCard(hass, c), T = allTabs(hass, c), areas = M.areas(hass), E = tileEnts(hass, c), avail = availKinds(E, c);
        const romData = (id) => (M.romData ? M.romData(fc, id, roomCfgOf(c, id)) : null);
        const fields = [
          { type: 'order', name: 'tab_order', hiddenName: 'tab_hidden', label: 'Faner · rekkefølge og synlighet', options: T.map((t) => [t.id, t.label]) },
          { type: 'section', id: 'faner', label: 'Faner', icon: 'mdi:tab', fields: [
            { type: 'info', label: 'Dra sideveis over fanene for å bytte. Hold inne en fane og dra for å flytte den. Etasjer fra HA dukker opp automatisk.' },
            ...T.map((t) => ({ type: 'text', name: `tab_labels.${t.id}`, label: `Navn · ${t.autoLabel}`, placeholder: t.autoLabel })),
            ...T.filter((t) => t.kind !== 'batterier').map((t) => ({ type: 'select', name: `tab_views.${t.id}`, label: `Visning · ${t.label}`, options: VIEWS, default: t.defView })),
            { type: 'text', name: 'custom_tabs', label: 'Egne faner', placeholder: 'Favoritter, Barn', help: 'Kommaseparert. Legg rom på fanen under «Rom og snarveier».' },
            { type: 'text', name: 'default_tab', label: 'Startfane', placeholder: T[0] ? T[0].id : 'hjem', help: 'Id: ' + T.map((t) => t.id).join(', ') },
            { type: 'select', name: 'tab_height', label: 'Høyde', options: [['std', 'Standard'], ['lav', 'Lav'], ['mid', 'Middels'], ['hoy', 'Høy'], ['ekstra', 'Ekstra'], ['custom', 'Egendefinert']], default: 'std' },
            ...(c.tab_height === 'custom' ? [{ type: 'number', name: 'tab_height_px', label: 'Høyde (px)', min: 24, max: 80, placeholder: '38' }] : []),
            { type: 'select', name: 'tab_width', label: 'Bredde per fane', options: [['std', 'Standard'], ['kompakt', 'Kompakt'], ['full', 'Full'], ['custom', 'Egendefinert']], default: 'std' },
            ...(c.tab_width === 'custom' ? [{ type: 'number', name: 'tab_width_px', label: 'Bredde (px)', min: 48, max: 200, placeholder: '88' }] : []),
          ] },
          { type: 'section', id: 'batterier', label: 'Batterier', icon: 'mdi:battery-alert', fields: [
            { type: 'number', name: 'battery.limit', label: 'Grense for lavt batteri (%)', min: 5, max: 60, step: 5, placeholder: '20' },
            { type: 'select', name: 'battery.show', label: 'Liste', options: [['lav', 'Bare lave'], ['alle', 'Alle']], default: 'lav' },
            { type: 'boolean', name: 'battery.always', label: 'Vis fanen alltid', help: 'Ignorer betingelsen' },
            { type: 'entity', name: 'battery.cond', label: 'Vis fanen når denne er på', domain: 'binary_sensor', help: 'Tom = vises når et batteri (device_class battery) er under grensen' },
          ] },
        ];
        T.filter((t) => t.view !== 'batterier').forEach((t) => {
          const base = baseRooms(hass, c, t), f = [];
          f.push({ type: 'order', name: `layout.${t.id}.order`, hiddenName: `layout.${t.id}.hidden`, label: t.kind === 'aktuelt' ? 'Rom (vises når lys er på eller media spiller)' : 'Rom på fanen', options: base.map((a) => [a.id, a.name + (t.kind === 'floor' && a.floor !== t.floor && a.floorName ? ' · ' + a.floorName : '')]) });
          if (['floor', 'custom', 'andre'].includes(t.kind)) {
            const add = get(c, `layout.${t.id}.add`) || {}, keys = Object.keys(add).sort(), nx = 'a' + pad2(keys.reduce((m, k) => Math.max(m, parseInt(k.slice(1), 10) || 0), 0) + 1);
            [...keys, nx].forEach((k, i) => f.push({ type: 'area', name: `layout.${t.id}.add.${k}`, label: i === keys.length ? 'Hent rom fra en annen etasje' : 'Hentet rom', help: i === keys.length ? 'Velg et område – det legges til fanen' : '' }));
          }
          base.forEach((a) => f.push({ type: 'select', name: `layout.${t.id}.side.${a.id}`, label: `Kolonne · ${a.name}`, options: [['L', 'Venstre'], ['R', 'Høyre']], help: get(c, `layout.${t.id}.side.${a.id}`) ? '' : 'Auto' }));
          if (t.view === 'karusell') Object.keys(SLIDES).forEach((s) => ['L', 'R'].forEach((sd) => f.push({ type: 'boolean', name: `slides.${t.id}.${sd}.${s}`, label: `Sveip-kort · ${sd === 'L' ? 'venstre' : 'høyre'} karusell · ${SLIDES[s][1]}` })));
          avail.forEach((k) => {
            const on = tileSlot(c, t, k) !== 'off';
            f.push({ type: 'select', name: `tiles.${t.id}.${k}.slot`, label: `Snarvei · ${kindLabel(k, c)}`, options: SLOTS, default: (TILE_DEF[t.kind] || {})[k] || 'off' });
            if (on) {
              f.push({ type: 'boolean', name: `tiles.${t.id}.${k}.stack`, label: `${kindLabel(k, c)} · sveip sammen med andre i samme plass`, default: !!(STACK_DEF[t.kind] || {})[k] });
              f.push({ type: 'text', name: `tiles.${t.id}.${k}.fra`, label: `${kindLabel(k, c)} · vis fra (MM-DD)`, placeholder: k === 'jul' ? '11-01' : 'tomt = alltid' });
              f.push({ type: 'text', name: `tiles.${t.id}.${k}.til`, label: `${kindLabel(k, c)} · vis til (MM-DD)`, placeholder: k === 'jul' ? '03-01' : 'tomt = alltid' });
            }
          });
          SLOTS.slice(1).forEach(([sl, lab]) => {
            if (avail.filter((k) => tileSlot(c, t, k) === sl).length > 1) f.push({ type: 'boolean', name: `swipe.${t.id}.${sl}`, label: `Sveip alle snarveier · ${lab}`, default: t.kind === 'hjem' && sl === 'L-top' });
          });
          const en = avail.filter((k) => tileSlot(c, t, k) !== 'off');
          if (en.length > 1) f.push({ type: 'order', name: `tile_order.${t.id}`, hiddenName: `tile_hidden.${t.id}`, label: 'Snarveier · rekkefølge', options: en.map((k) => [k, kindLabel(k, c)]) });
          fields.push({ type: 'section', id: 'tab-' + t.id, label: `Rom og snarveier · ${t.label}`, icon: 'mdi:view-grid-outline', fields: f });
        });
        // Snarveier: handlinger ved trykk
        const tapF = [];
        KIND_ORDER.filter((k) => avail.includes(k)).forEach((k) => {
          const L = KINDS[k][1], ic = get(c, `tap.${k}.icon`) || 'auto';
          tapF.push({ type: 'hash', name: `tap.${k}.card_hash`, label: `${L} · trykk på kortet åpner popup`, placeholder: 'Standard' });
          tapF.push({ type: 'select', name: `tap.${k}.icon`, label: `${L} · trykk på ikonet`, options: [['auto', 'Standard'], ['popup', 'Åpne popup'], ['more', 'Mer info'], ['script', 'Kjør script'], ['none', 'Ingen']], default: 'auto' });
          if (ic === 'popup') tapF.push({ type: 'hash', name: `tap.${k}.icon_hash`, label: `${L} · popup for ikonet`, placeholder: '#sikkerhet' });
          if (ic === 'script') tapF.push({ type: 'entity', name: `tap.${k}.script`, label: `${L} · script`, domain: 'script' });
        });
        fields.push({ type: 'section', id: 'tap', label: 'Snarveier · handlinger', icon: 'mdi:gesture-tap', fields: tapF });
        fields.push({ type: 'overrides', label: 'Bytt entiteter for snarveier og sveip-kort', fields: [
          ['lock', 'Dørlås', 'lock'], ['garage', 'Garasjeport', 'cover'], ['alarm', 'Alarm', 'alarm_control_panel'], ['cam', 'Kamera', 'camera'], ['ruter', 'Ruter (avganger)', 'sensor'], ['todo', 'Gjøremål', 'todo'], ['tv', 'TV', 'media_player'], ['vacr', 'Støvsuger', 'vacuum'],
          ['dish', 'Oppvaskmaskin (status)', null], ['wash', 'Vaskemaskin (status)', null], ['dry', 'Tørketrommel (status)', null], ['weather', 'Vær', 'weather'], ['price', 'Strømpris', 'sensor'], ['watt', 'Effekt (hele huset)', 'sensor'], ['calendar', 'Kalender', 'calendar'], ['trash', 'Søppel (dager til tømming)', 'sensor'],
        ].map(([name, label, domain]) => ({ name, label, domain: domain || undefined, auto: (h, cc) => { const e = tileEnts(h, { ...cc, overrides: {} })[name]; return e && typeof e === 'object' ? e.status : e; } })) });
        // Egne snarveier (lenker)
        const links = c.links || {}, lk = Object.keys(links).sort(), lnx = 'l' + pad2(lk.reduce((m, k) => Math.max(m, parseInt(k.slice(1), 10) || 0), 0) + 1);
        const linkF = [];
        [...lk, lnx].forEach((k, i) => {
          const p = `links.${k}`, has = !!(links[k] && links[k].title);
          linkF.push({ type: 'text', name: p + '.title', label: i === lk.length ? 'Ny snarvei · tittel' : `Snarvei ${i + 1} · tittel`, placeholder: 'Tittel', help: i === lk.length ? 'Skriv en tittel, og velg plass på fanen under «Rom og snarveier»' : '' });
          if (!has) return;
          linkF.push({ type: 'text', name: p + '.sub', label: 'Undertekst', placeholder: 'F.eks. {sensor.nordpool_kwh} nå' });
          linkF.push({ type: 'icon', name: p + '.icon', label: 'Ikon', placeholder: 'mdi:star' });
          linkF.push({ type: 'select', name: p + '.color', label: 'Farge', options: TSW, default: 'ingen' });
          linkF.push({ type: 'hash', name: p + '.hash', label: 'Trykk på kortet åpner popup', placeholder: '#strom' });
          linkF.push({ type: 'entity', name: p + '.entity', label: 'Entitet (ikon-trykk / mer info)' });
          linkF.push({ type: 'select', name: p + '.act', label: 'Trykk på ikonet', options: [['toggle', 'Veksle entitet'], ['popup', 'Åpne popup'], ['more', 'Mer info'], ['none', 'Ingen']], default: 'toggle' });
        });
        fields.push({ type: 'section', id: 'links', label: 'Egne snarveier', icon: 'mdi:link-variant', fields: linkF });
        fields.push({ type: 'section', id: 'soppel', label: 'Sveip-kort · søppel', icon: 'mdi:delete', fields: [
          { type: 'hash', name: 'trash_hash', label: 'Popup', placeholder: '#soppel' },
          { type: 'entity', name: 'trash_type_sensor', label: 'Type avfall (valgfri)', domain: 'sensor' },
        ] });
        areas.forEach((a) => {
          const r = romData(a.id), P = `rooms.${a.id}`, au = M.roomAuto ? M.roomAuto(hass, a.id) : {};
          fields.push({ type: 'section', id: 'rom-' + a.id, label: `Rom · ${a.name}`, icon: 'mdi:texture-box', fields: [
            { type: 'icon', name: P + '.icon', label: 'Ikon', auto: () => (r ? r.icon : a.icon || '') },
            { type: 'color', name: P + '.color', label: 'Farge (ikon når lys er på)', auto: () => (M.romColor ? M.romColor(a.id, hass) : '') },
            { type: 'select', name: P + '.size', label: 'Størrelse i kortliste', options: [['S', 'Liten'], ['M', 'Medium'], ['L', 'Stor']], default: r && (r.temp != null || r.thermo) ? 'M' : 'S' },
            { type: 'boolean', name: P + '.klima', label: 'Klima-knapp (+/−)', help: r && r.thermo ? 'Termostat: ' + r.thermo + ' · kun på medium/store kort og karusell' : 'Ingen termostat i rommet', default: !!(r && r.thermo) },
            { type: 'entity', name: P + '.temperature', label: 'Temperatur', domain: 'sensor', device_class: 'temperature', auto: () => get(c, P + '.temperatur') || au.temp || null },
            { type: 'entity', name: P + '.humidity', label: 'Luftfuktighet', domain: 'sensor', device_class: 'humidity', auto: () => get(c, P + '.fuktighet') || au.hum || null },
            { type: 'entity', name: P + '.climate', label: 'Termostat', domain: 'climate', auto: () => get(c, P + '.termostat') || au.thermo || null },
            ...(M.romBadgeFields ? M.romBadgeFields(hass, c, P + '.badges_own', P + '.badges', r) : []),
          ] });
        });
        fields.push({ type: 'section', id: 'utseende', label: 'Layout', icon: 'mdi:page-layout-body', fields: [
          { type: 'select', name: 'layout_mode', label: 'Layout', options: [['auto', 'Auto (mål dashbordet)'], ['mobil', 'Mobil'], ['stor', 'Stor skjerm']], default: 'auto' },
          { type: 'boolean', name: 'zoom', label: 'Skaler opp på store skjermer (opptil 1,8×)', default: true },
          { type: 'boolean', name: 'toasts', label: 'Bekreftelsesmeldinger (f.eks. «Dørlås låst opp»)', default: true },
        ] });
        return fields;
      };
    }
    get cardSize() { return 8; }
    roomCfg(area) { return roomCfgOf(this.config, area); }
    connectedCallback() {
      super.connectedCallback();
      if (!this._ro && window.ResizeObserver) {
        this._ro = new ResizeObserver(() => { const L = this._calcLayout(), o = this._L; if (!o || o.wide !== L.wide || o.zoom !== L.zoom || o.pc !== L.pc) this.update(); });
        this._ro.observe(this);
      }
    }
    disconnectedCallback() {
      super.disconnectedCallback();
      if (this._ro) { this._ro.disconnect(); this._ro = null; }
      if (this._tick) { clearInterval(this._tick); this._tick = null; }
      if (this._tabRO) { this._tabRO.disconnect(); this._tabRO = null; }
    }
    _toast(msg) { if (this.config.toasts !== false) M.toast(msg); }
    _calcLayout() {
      const c = this.config;
      const ha = !!document.querySelector('home-assistant');
      const vw = ha ? M.dashRect().width : ((this.parentElement && this.parentElement.getBoundingClientRect().width) || M.dashRect().width);
      const L = M.hjemLayout(c.layout_mode || 'auto', vw);
      if (c.zoom === false || this.mshEmbedded) L.zoom = 1; // i msh-hjem-card zoomer containeren hele griden
      if (this.mshEmbedded && this.mshEmbedded.wide != null) { L.wide = this.mshEmbedded.wide; L.pc = !!this.mshEmbedded.pc; }
      return L;
    }

    /* ---------- faner */
    _batteries() {
      const hass = this.hass, c = this.config, lim = Number(get(c, 'battery.limit')) || 20, out = [];
      let dev = null;
      const devEnts = () => { if (dev) return dev; dev = {}; Object.values(hass.entities || {}).forEach((e) => { if (e.device_id) (dev[e.device_id] = dev[e.device_id] || []).push(e.entity_id); }); return dev; };
      Object.keys(hass.states).forEach((id) => {
        if (!/^(sensor|binary_sensor)\./.test(id)) return;
        const s0 = hass.states[id];
        if (s0.attributes.device_class !== 'battery' || !regOk(hass, id)) return;
        const s = this.s(id), bin = id.startsWith('binary_sensor.');
        const pct = bin ? null : M.isNum(s.state) ? Number(s.state) : undefined;
        if (pct === undefined) return;
        const e = M.regEntry(hass, id), d = e && e.device_id && hass.devices ? hass.devices[e.device_id] : null;
        const name = (d && (d.name_by_user || d.name)) || String(s.attributes.friendly_name || id).replace(/\s*(battery|batteri)(\s*level|nivå)?$/i, '') || id;
        const area = M.areaOf(hass, id) || (d && d.area_id);
        const sib = d ? (devEnts()[e.device_id] || []).find((x) => x !== id && hass.states[x] && hass.states[x].attributes.device_class !== 'battery') : null;
        out.push({ id, name, room: area ? M.areaName(hass, area) : '', pct, bin, low: bin ? s.state === 'on' : pct < lim, icon: sib ? M.domainIcon(sib, hass.states[sib]) : bin ? 'mdi:battery-alert' : 'mdi:battery' });
      });
      return { list: out, lim };
    }
    _tabsV(B) {
      const c = this.config, T = allTabs(this.hass, c);
      const cond = get(c, 'battery.cond');
      const batOn = !!get(c, 'battery.always') || (cond ? M.isOn(this.s(cond)) : B.list.some((b) => b.low));
      const v = T.filter((t) => !t.hidden && (t.view !== 'batterier' || batOn));
      return v.length ? v : T.slice(0, 1);
    }
    _curTab(TV) {
      let id = this.ui.tab;
      if (id == null && this.config.card_id) { try { id = localStorage.getItem('msh-hjem-tab-' + this.config.card_id); } catch (e) { id = null; } }
      return TV.find((t) => t.id === id) || TV.find((t) => t.id === this.config.default_tab) || TV[0];
    }
    _pickTab(i) {
      const t = (this._TV || [])[i];
      if (!t) return;
      if (this.config.card_id) { try { localStorage.setItem('msh-hjem-tab-' + this.config.card_id, t.id); } catch (e) { /* */ } }
      this.setUI({ tab: t.id });
    }
    async _reorderTabs(from, to) {
      const TV = this._TV || [], all = allTabs(this.hass, this.config).map((t) => t.id), vis = TV.map((t) => t.id);
      const nv = vis.slice(); const [m] = nv.splice(from, 1); nv.splice(to, 0, m);
      return this._saveTabOrder(nv);
    }
    // Ny rekkefølge for de synlige fanene → full tab_order (skjulte beholder plassen sin)
    async _saveTabOrder(nv) {
      const all = allTabs(this.hass, this.config).map((t) => t.id), vis = (this._TV || []).map((t) => t.id);
      let k = 0;
      const order = all.map((id) => (vis.includes(id) ? nv[k++] : id));
      await this._saveCfg({ tab_order: order });
    }
    async _saveCfg(patch) {
      const old = this._rawConfig || this.config, nc = { ...old, ...patch };
      if (!nc.card_id) nc.card_id = old.card_id || M.uid();
      this.setConfig(nc);
      try { const r = await M.saveCardConfig(this.hass, old, nc); if (r && r.config) { this._rawConfig = r.config; } } catch (e) { /* */ }
    }
    // Fanerad: flex-rad som scroller vannrett (scroll-snap proximity), fanene krymper aldri og kuttes aldri.
    // Linsen (.ind) posisjoneres etter målt fane (afterRender) – bredden følger fanen.
    _tabsHTML(TV, cur) {
      const c = this.config, idx = Math.max(0, TV.indexOf(cur));
      const h = c.tab_height === 'custom' ? Number(c.tab_height_px) || 38 : TAB_H[c.tab_height || 'std'] || 38;
      const w = c.tab_width || 'std';
      const tw = w === 'custom' ? `width:${Number(c.tab_width_px) || 88}px;` : '';
      const pad = w === 'custom' ? '0 6px' : w === 'kompakt' ? '0 12px' : '0 18px';
      const P = (this._tabPos || {})[(TV[idx] || {}).id];
      const ind = P ? `left:${P[0]}px;width:${P[1]}px` : 'left:0;width:0;opacity:0';
      return `<div class="tabs ${w === 'full' ? 'full' : ''}"><div class="tg msh-tr" data-tabs="1" data-gd-skip>
        <span class="ind" style="${ind}"></span>
        ${TV.map((t, i) => `<button class="tab ${i === idx ? 'on' : ''}" data-act="tab" data-i="${i}" data-id="${esc(t.id)}" data-haptic="selection" data-key="tab-${esc(t.id)}" style="height:${h}px;padding:${pad};${tw}">${esc(t.label)}</button>`).join('')}
      </div></div>`;
    }

    /* ---------- snarvei-fliser */
    _tileModel(kind, E) {
      const hass = this.hass, c = this.config, s = (id) => this.s(id);
      const T = (o) => ({ kind, icon: (KINDS[kind] || [])[0], ...o });
      switch (kind) {
        case 'lock': {
          const id = E.lock, st = s(id); if (!id) return null;
          const L = !!st && st.state === 'locked', jam = !!st && st.state === 'jammed';
          return T({ ent: id, icon: L || !st ? 'key' : 'lock_open', title: !st ? '–' : jam ? 'Feil' : L ? 'Låst' : st.state === 'locking' ? 'Låser' : st.state === 'unlocking' ? 'Låser opp' : 'Ulåst', sub: 'Dørlås', tone: !st || L ? null : jam ? C.red : C.green, solid: !!st && !L && !jam, cardHash: '#sikkerhet',
            ic: () => { M.toggle(hass, id); this._toast(L ? 'Dørlås låst opp' : 'Dørlås låst'); } });
        }
        case 'alarm': {
          const id = E.alarm, st = s(id); if (!id) return null;
          const v = st ? st.state : '', armed = /^armed/.test(v), trig = v === 'triggered', busy = /arming|pending/.test(v);
          return T({ ent: id, title: trig ? 'Utløst' : armed ? 'Armert' : busy ? 'Armerer' : st ? 'Av' : '–', sub: 'Alarm', tone: trig ? C.red : armed ? 'pink' : busy ? C.orange : null, solid: trig, cardHash: '#sikkerhet',
            ic: () => { if (v === 'disarmed' && st && !st.attributes.code_arm_required) { M.call(hass, 'alarm_control_panel', 'alarm_arm_away', { entity_id: id }); this._toast('Alarm armert'); } else M.openPopup('#sikkerhet'); } });
        }
        case 'cam': {
          const id = E.cam; if (!id) return null;
          const area = M.areaOf(hass, id), cams = M.all(hass, 'camera');
          const mot = M.all(hass, 'binary_sensor', (x, i) => ['motion', 'occupancy'].includes(x.attributes.device_class) && area && M.areaOf(hass, i) === area);
          const on = mot.some((m) => M.isOn(s(m)));
          return T({ ent: id, title: 'Kamera', sub: on ? 'Bevegelse nå' : mot.length ? 'Ingen bevegelse' : `${cams.length} ${cams.length === 1 ? 'kamera' : 'kameraer'}`, tone: on ? C.blue : null, cardHash: '#kamera' });
        }
        case 'ruter': {
          const id = E.ruter, st = s(id); if (!id) return null;
          const sx = E.ruterSx ? s(E.ruterSx) : null, nAv = sx ? (M.isNum(sx.state) ? Number(sx.state) : (sx.attributes.meldinger || []).length) : 0;
          const route = st ? String(st.attributes.route || st.attributes.line || '').split(' ')[0] : '';
          const dep = st && M.isNum(st.state) ? `${route ? 'Linje ' + route + ' ' : ''}om ${Math.round(Number(st.state))} min` : '–';
          return T({ ent: id, title: 'Ruter', sub: dep + (nAv ? ` · ${nAv} avvik` : ''), tone: null, cardHash: '#ruter' });
        }
        case 'todo': {
          if (!E.todo) return null;
          const n = E.todos.reduce((t, id) => t + (this.n(id) || 0), 0);
          return T({ ent: E.todo, title: `${n} gjøremål`, sub: E.todos.length > 1 ? `${E.todos.length} lister` : M.name(hass, E.todo), cardHash: '#gjoremal' });
        }
        case 'garage': {
          const id = E.garage, st = s(id); if (!id) return null;
          const v = st ? st.state : '', open = v === 'open', mv = v === 'opening' || v === 'closing';
          return T({ ent: id, title: !st ? '–' : open ? 'Åpen' : v === 'opening' ? 'Åpner' : v === 'closing' ? 'Lukker' : 'Lukket', sub: 'Garasjeport', tone: open || mv ? C.orange : null,
            ic: () => { M.call(hass, 'cover', 'toggle', { entity_id: id }); this._toast(open || v === 'opening' ? 'Garasjeporten lukkes' : 'Garasjeporten åpnes'); } });
        }
        case 'tv': {
          const id = E.tv, st = s(id); if (!id) return null;
          const on = !!st && !['off', 'standby', 'unavailable', 'unknown'].includes(st.state);
          const sub = st ? [st.attributes.app_name, st.attributes.media_title].filter(Boolean).join(' · ') || (on ? 'På' : 'Av') : '–';
          return T({ ent: id, title: M.name(hass, id), sub, tone: on ? C.blue : null, hide: !on, cardHash: '#media',
            ic: () => { M.call(hass, 'media_player', 'toggle', { entity_id: id }); this._toast(on ? 'TV slått av' : 'TV slått på'); } });
        }
        case 'vacr': {
          const id = E.vacr, st = s(id); if (!id) return null;
          const v = st ? st.state : '', bat = st && st.attributes.battery_level != null ? ` · ${st.attributes.battery_level} %` : '';
          const run = v === 'cleaning';
          const sub = run ? `Rengjør${bat}` : v === 'paused' ? 'Pauset' : v === 'returning' ? 'Kjører hjem' : v === 'error' ? 'Feil' : v === 'idle' ? 'Klar' : v === 'docked' ? 'I laderen' : '–';
          return T({ ent: id, title: M.name(hass, id), sub, tone: run ? C.green : v === 'paused' || v === 'returning' ? C.orange : v === 'error' ? C.red : null, hide: v === 'docked',
            ic: () => { M.call(hass, 'vacuum', run ? 'pause' : 'start', { entity_id: id }); this._toast(run ? 'Støvsuger pauset' : 'Støvsuger starter'); } });
        }
        case 'dish': case 'wash': case 'dry': {
          const A = this._appl(kind, E[kind]); if (!A) return null;
          const left = A.secs != null ? `${Math.ceil(A.secs / 60)} min igjen` : '';
          const sub = A.mode === 'run' ? [left, A.prog].filter(Boolean).join(' · ') || 'Kjører' : A.mode === 'done' ? 'Ferdig · klar til å tømmes' : A.mode === 'paused' ? ['Pauset', left].filter(Boolean).join(' · ') : 'Av';
          return T({ ent: A.ent, title: A.name, sub, tone: A.mode === 'run' ? C.blue : A.mode === 'done' ? C.green : A.mode === 'paused' ? C.orange : null, solid: A.mode === 'done', hide: A.mode === 'idle', cardHash: A.area ? '#' + A.area : null,
            ic: () => this._applAct(A) });
        }
        case 'jul': {
          const now = new Date(); let tg = new Date(now.getFullYear(), 11, 24);
          if (now > new Date(now.getFullYear(), 11, 27)) tg = new Date(now.getFullYear() + 1, 11, 24);
          const d = Math.ceil((tg - now) / 864e5);
          return T({ title: d > 0 ? `${d} ${d === 1 ? 'dag' : 'dager'} til jul` : 'God jul!', sub: 'Julelys og automasjon', tone: C.green });
        }
        default: {
          const L = (c.links || {})[kind];
          if (!L || !L.title) return null;
          const fill = (t) => String(t || '').replace(/\{([a-z_]+\.[a-z0-9_]+)\}/g, (m, id) => (hass.states[id] ? (this.s(id), M.fmtState(hass, id)) : m));
          const col = L.color && L.color !== 'ingen' ? (L.color === 'rosa' ? 'pink' : TCOL[L.color]) : null;
          return { kind, icon: L.icon || 'mdi:star', title: fill(L.title), sub: fill(L.sub), tone: col, ent: L.entity || null, cardHash: L.hash || null,
            ic: () => { const a = L.act || 'toggle'; if (a === 'none') return; if (a === 'popup' && L.hash) return M.openPopup(L.hash); if (a === 'more' || !L.entity) return L.entity ? M.moreInfo(this, L.entity) : L.hash && M.openPopup(L.hash); M.toggle(hass, L.entity); this._toast(`${fill(L.title)} ${M.isOn(this.s(L.entity)) ? 'av' : 'på'}`); } };
        }
      }
    }
    _appl(kind, info) {
      if (!info) return null;
      const st = this.s(info.status), pw = this.n(info.power), rem = info.remain ? this.s(info.remain) : null, prog = info.prog ? this.s(info.prog) : null;
      const raw = String(st ? st.state : '').toLowerCase();
      let mode = 'idle';
      if (!st || raw === 'unavailable' || raw === 'unknown') mode = 'idle';
      else if (/pause/.test(raw)) mode = 'paused';
      else if (/finish|done|ferdig|complete|slutt|klar til|t(ø|o)m|empty|end$/.test(raw)) mode = 'done';
      else if (/^(off|idle|standby|ready|klar|av|inactive|none|stopped|stoppet|0|false|disconnected)$/.test(raw)) mode = 'idle';
      else if (/^(switch|binary_sensor)\./.test(info.status)) mode = raw === 'on' ? 'run' : 'idle';
      else mode = 'run';
      if (mode === 'idle' && pw != null && pw > 5) mode = 'run';
      let secs = null;
      if (rem && !M.unavailable(rem)) {
        if (rem.attributes.device_class === 'timestamp' || /\d{4}-\d\d-\d\dT/.test(rem.state)) { const t = Date.parse(rem.state); if (!isNaN(t)) secs = Math.max(0, (t - Date.now()) / 1000); } else if (M.isNum(rem.state)) {
          const v = Number(rem.state), u = String(rem.attributes.unit_of_measurement || 'min').toLowerCase();
          const mins = u.startsWith('h') || u === 't' ? v * 60 : u.startsWith('s') ? v / 60 : v;
          const since = mode === 'run' ? Math.max(0, (Date.now() - Date.parse(rem.last_updated || rem.last_changed || Date.now())) / 1000) : 0;
          secs = Math.max(0, mins * 60 - Math.min(since, 59));
        }
      }
      if (mode === 'done') secs = 0;
      const [, icon, name, nominal] = APPL[kind];
      return { kind, mode, secs, prog: prog && !M.unavailable(prog) ? prog.state : '', name, icon, ent: info.status, sw: info.sw, area: info.area, nominal };
    }
    _applAct(A) {
      if (A.sw) { const on = M.isOn(this.s(A.sw)); M.toggle(this.hass, A.sw); this._toast(`${A.name} ${on ? 'pauset' : 'fortsetter'}`); return; }
      M.moreInfo(this, A.ent);
    }
    _tilesAt(t, side, pos, E) {
      const c = this.config, slot = side + '-' + pos, hid = get(c, `tile_hidden.${t.id}`) || [], ord = get(c, `tile_order.${t.id}`) || [];
      const kinds = availKinds(E, c).filter((k) => tileSlot(c, t, k) === slot && !hid.includes(k) && seasonOk(c, t, k) && !(APPL[k] && t.kind === 'aktuelt'));
      kinds.sort((a, b) => { const ia = ord.indexOf(a), ib = ord.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
      const raw = kinds.map((k) => ({ k, m: this._tileModel(k, E) })).filter((x) => x.m && !x.m.hide);
      const all = get(c, `swipe.${t.id}.${slot}`) ?? (t.kind === 'hjem' && slot === 'L-top');
      const stack = (k) => get(c, `tiles.${t.id}.${k}.stack`) ?? !!(STACK_DEF[t.kind] || {})[k];
      const stR = raw.filter((x) => all || stack(x.k)), useS = stR.length > 1;
      const flat = (useS ? raw.filter((x) => !stR.includes(x)) : raw).map((x) => this._tileHTML(x.m, `ti-${x.k}`)).join('');
      if (!useS) return flat;
      const key = `${t.id}-${slot}`, n = stR.length, i = M.clamp(get(this.ui, 'sw.' + key) || 0, 0, n - 1);
      return flat + `<div class="swc" data-key="tsw-${esc(key)}"><div class="tsw" data-sw="${esc(key)}" data-n="${n}" data-i="${i}"><div class="track" style="transform:translateX(-${i * 100}%)">${stR.map((x) => `<div class="slot">${this._tileHTML(x.m, 'ts-' + x.k)}</div>`).join('')}</div></div>${!all ? this._dots(n, i) : ''}</div>`;
    }
    _tileHTML(t, key) {
      let st = '', iw = '', ic = '', sb = '';
      if (t.solid && t.tone) { st = `background:${t.tone};color:var(--gray100,#2f2f2f);box-shadow:none`; iw = 'background:rgba(0,0,0,0.1);color:var(--gray100,#2f2f2f)'; sb = 'color:rgba(31,42,36,0.75)'; } else if (t.tone === 'pink') { st = `background:${C.accent};color:var(--gray100,#2f2f2f);box-shadow:none`; iw = 'background:rgba(42,23,32,0.1);color:var(--gray100,#2f2f2f)'; sb = 'color:rgba(42,23,32,0.7)'; } else if (t.tone) { st = `background:${M.alpha(t.tone, 0.14)};box-shadow:inset 0 0 0 1px ${M.alpha(t.tone, 0.4)}`; iw = `background:${M.alpha(t.tone, 0.2)};color:${t.tone}`; }
      return `<div class="tile" data-act="tile" data-k="${esc(t.kind)}" data-w="card" ${t.ent ? `data-ent="${esc(t.ent)}"` : ''} data-key="${esc(key)}" style="${st}">
        <button class="tic" data-act="tile" data-k="${esc(t.kind)}" data-w="ic" style="${iw}">${M.icon(t.icon, 24)}</button>
        <div class="tx"><span class="tt ell">${esc(t.title)}</span><span class="ts" style="${sb}">${esc(t.sub || '')}</span></div></div>`;
    }
    _runTile(kind, w) {
      const c = this.config, t = this._tileModel(kind, this._E || tileEnts(this.hass, c));
      if (!t) return;
      const tp = get(c, 'tap.' + kind) || {};
      if (w === 'card') { const h = tp.card_hash || t.cardHash; if (h) return M.openPopup(h); if (t.ent) return M.moreInfo(this, t.ent); return; }
      const mode = tp.icon || 'auto';
      if (mode === 'none') return;
      if (mode === 'popup') return M.openPopup(tp.icon_hash || tp.card_hash || t.cardHash);
      if (mode === 'more') return t.ent && M.moreInfo(this, t.ent);
      if (mode === 'script') { if (tp.script) { M.call(this.hass, 'script', 'turn_on', { entity_id: tp.script }); this._toast('Kjørte ' + M.name(this.hass, tp.script)); } return; }
      if (t.ic) return t.ic();
      if (tp.card_hash || t.cardHash) return M.openPopup(tp.card_hash || t.cardHash);
      if (t.ent) M.moreInfo(this, t.ent);
    }
    _dots(n, i) { return n > 1 ? `<div class="dots">${Array.from({ length: n }, (_, k) => `<span class="${k === i ? 'on' : ''}"></span>`).join('')}</div>` : ''; }

    /* ---------- sveip-slides */
    _slide(id, E) {
      const hass = this.hass, c = this.config, s = (x) => this.s(x);
      if (id === 'vaer') {
        const w = s(E.weather), a = w ? w.attributes : {};
        return { top: w ? a.friendly_name || 'Vær' : 'Vær', title: w && a.temperature != null ? `${M.nf(a.temperature, 1)}°` : '–', line1: w ? WX[w.state] || w.state : '–', line2: w ? [a.humidity != null ? `Fukt ${M.nf(a.humidity, 0)} %` : '', a.wind_speed != null ? `vind ${M.nf(a.wind_speed, 0)} ${a.wind_speed_unit || 'm/s'}` : ''].filter(Boolean).join(' · ') : '', hash: '#vaer' };
      }
      if (id === 'strom') {
        this.n(E.price);
        const p = M.priceNow ? M.priceNow(this.hass, E.price) : this.n(E.price), W = this.n(E.watt);
        let cheap = '';
        if (E.price && M.priceSeries) {
          const h0 = new Date().getHours(), vals = M.priceSeries(this.hass, E.price).slice(0, 24).map((v, h) => [v, h]).filter(([v, h]) => v != null && h >= h0);
          if (vals.length) { const m = vals.reduce((a, b) => (b[0] < a[0] ? b : a)); cheap = `Billigst kl. ${pad2(m[1])} · ${M.nf(m[0], 2)} kr`; }
        }
        return { top: 'Strøm nå', title: p != null ? `${M.nf(p, 2)} kr` : '–', line1: W != null ? `${M.nf(W, 0)} W` : '–', line2: cheap, hash: '#strom' };
      }
      if (id === 'cal') {
        const k = s(E.calendar), a = k ? k.attributes : {}, st = a.start_time ? new Date(String(a.start_time).replace(' ', 'T')) : null, en = a.end_time ? new Date(String(a.end_time).replace(' ', 'T')) : null;
        const tm = (d) => `${d.getHours()}:${pad2(d.getMinutes())}`;
        return { top: st ? st.toLocaleDateString('nb-NO', { weekday: 'long' }) : 'Kalender', title: st ? st.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' }) : '–', line1: st ? (a.all_day ? 'Hele dagen' : tm(st) + (en ? ' · ' + tm(en) : '')) : 'Ingen hendelser', line2: a.message || '', ent: E.calendar };
      }
      const d = this.n(E.trash), ty = c.trash_type_sensor ? s(c.trash_type_sensor) : null, ts = E.trash ? s(E.trash) : null;
      const type = ty ? ty.state : ts ? ts.attributes.type || ts.attributes.avfallstype || ts.attributes.friendly_name : '';
      return { top: 'Søppel', title: d == null ? '–' : d <= 0 ? 'I dag' : d === 1 ? 'I morgen' : `Om ${M.nf(d, 0)} dager`, line1: type || '–', line2: '', hash: c.trash_hash || '#soppel' };
    }
    _slideHTML(id, E) {
      const x = this._slide(id, E);
      return `<div class="rk sl" data-act="slide" data-s="${id}" data-key="sl-${id}" ${x.ent ? `data-ent="${esc(x.ent)}"` : ''}>
        <span class="sl-top ell">${esc(x.top)}</span><span class="sl-ti ell">${esc(x.title)}</span><span style="flex:1"></span><span class="sl-bar"></span>
        <span class="sl-l1 num">${esc(x.line1)}</span><span class="sl-l2 ell">${esc(x.line2)}</span></div>`;
    }

    /* ---------- rom */
    _rooms(t) {
      const c = this.config, hid = get(c, `layout.${t.id}.hidden`) || [];
      const list = baseRooms(this.hass, c, t).filter((a) => !hid.includes(a.id)).map((a) => M.romData(this, a.id, this.roomCfg(a.id))).filter(Boolean);
      return t.kind === 'aktuelt' ? list.filter((r) => r.lightsOn > 0 || r.mediaOn > 0) : list;
    }
    _size(r) { return get(this.config, `rooms.${r.id}.size`) || (r.temp != null || r.thermo ? 'M' : 'S'); }
    _klima(r) { return (get(this.config, `rooms.${r.id}.klima`) ?? true) && !!r.thermo && r.set != null; }
    _sides(t, rooms, car) {
      const c = this.config, L = [], R = [];
      let hl = 0, hr = 0;
      rooms.forEach((r, i) => {
        const h = car ? 1 : ({ S: 66, M: this._klima(r) ? 210 : 140, L: 246 })[this._size(r)] + 8;
        let sd = get(c, `layout.${t.id}.side.${r.id}`);
        if (!sd) sd = car || t.kind === 'aktuelt' ? (i % 2 ? 'R' : 'L') : hl <= hr ? 'L' : 'R';
        if (sd === 'R') { R.push(r); hr += h; } else { L.push(r); hl += h; }
      });
      return { L, R };
    }
    _roomHTML(r, variant) {
      const rc = get(this.config, 'rooms.' + r.id) || {};
      const alert = M.romAlert ? M.romAlert(this, r, rc.badges_own, rc.badges) : '';
      return M.romkortHTML(r, { variant, klima: this._klima(r), alert, key: `rk-${variant}-${r.id}` });
    }
    _carousel(t, side, rooms, E) {
      const sl = get(this.config, `slides.${t.id}.${side}`) || {}, slides = Object.keys(SLIDES).filter((k) => sl[k]);
      const items = [...rooms.map((r) => this._roomHTML(r, 'karusell')), ...slides.map((k) => this._slideHTML(k, E))];
      if (!items.length) return '';
      const key = `${t.id}-car-${side}`, n = items.length, i = M.clamp(get(this.ui, 'sw.' + key) || 0, 0, n - 1);
      return `<div class="carw" data-key="car-${esc(key)}"><div class="car" data-sw="${esc(key)}" data-n="${n}" data-i="${i}"><div class="track" style="transform:translateX(-${i * 100}%)">${items.map((h) => `<div class="slot">${h}</div>`).join('')}</div></div>${this._dots(n, i)}</div>`;
    }
    _applCards(E) {
      const cards = ['dish', 'wash', 'dry'].map((k) => this._appl(k, E[k])).filter((A) => A && A.mode !== 'idle');
      const now = Date.now();
      this._applT = cards.filter((A) => A.mode === 'run' && A.secs != null).map((A) => ({ kind: A.kind, end: now + A.secs * 1000, nominal: A.nominal }));
      this._ticking = this._applT.length > 0;
      if (!cards.length) return '';
      const hms = (s) => `${Math.floor(s / 3600)}:${pad2(Math.floor((s % 3600) / 60))}:${pad2(Math.floor(s % 60))}`;
      return `<div class="apg">${cards.map((A) => {
        const p = A.mode === 'done' ? 100 : A.secs != null ? M.clamp((1 - A.secs / 60 / A.nominal) * 100, 2, 100) : 100;
        const time = A.mode === 'done' ? 'Ferdig' : A.secs != null ? hms(A.secs) : A.mode === 'paused' ? 'Pauset' : 'Kjører';
        const col = A.mode === 'done' ? C.green : A.mode === 'paused' ? 'var(--gray800,#afafaf)' : 'var(--white,#fafafa)';
        const bar = A.mode === 'done' ? C.green : A.mode === 'paused' ? 'var(--gray700,#979797)' : 'var(--white,#fafafa)';
        return `<div class="ap" data-key="ap-${A.kind}" data-ent="${esc(A.ent)}">
          <div class="ap-h"><span class="ap-n ell">${esc(A.name)}</span><button class="ap-b" data-act="appl" data-k="${A.kind}" title="${A.mode === 'done' ? 'Tøm' : A.mode === 'run' ? 'Pause' : 'Fortsett'}">${M.icon(A.icon, 20)}</button></div>
          <span style="flex:1"></span><span class="ap-t num" style="color:${col}">${time}</span>
          <span class="ap-s ell">${esc(A.mode === 'done' ? 'Klar til å tømmes' : (A.mode === 'paused' ? 'Pauset · ' : '') + (A.prog || ''))}</span>
          <div class="ap-bar"><span style="width:${p.toFixed(1)}%;background:${bar};${A.secs == null && A.mode !== 'done' ? 'opacity:.35' : ''}"></span></div></div>`;
      }).join('')}</div>`;
    }
    _batView(B) {
      const c = this.config, show = get(c, 'battery.show') || 'lav', lim = B.lim;
      const low = B.list.filter((b) => b.low).length;
      const list = B.list.filter((b) => show !== 'lav' || b.low).sort((a, b) => (a.pct ?? -1) - (b.pct ?? -1));
      const head = low ? `${low} ${low === 1 ? 'batteri' : 'batterier'} under ${lim} %` : `Alle batterier over ${lim} %`;
      const meta = `${show === 'lav' ? 'Viser lave' : 'Viser alle ' + B.list.length} · auto fra device_class battery`;
      if (!B.list.length) return M.emptyState('Fant ingen batterisensorer (device_class battery)', 'batterier');
      return `<div class="bv"><div class="bh"><span class="bh-t">${esc(head)}</span><span class="bh-m">${esc(meta)}</span></div>
        <section class="bl">${list.length ? list.map((b, i) => {
          const col = b.bin ? C.red : b.pct < 15 ? C.red : b.pct < 30 ? C.orange : C.green, warn = b.bin || b.pct < 30;
          return `<div class="br" data-key="b-${esc(b.id)}" data-ent="${esc(b.id)}" data-act="more" data-id="${esc(b.id)}" style="${i ? '' : 'border-top:0'}">
            ${M.icon(b.icon, 22, `width:26px;color:${warn ? col : 'var(--gray800,#afafaf)'}`)}
            <span class="bn"><span class="bnn ell">${esc(b.name)}</span><span class="bnr ell">${esc([b.room, b.id].filter(Boolean).join(' · '))}</span></span>
            <span class="bb"><span style="width:${b.bin ? 100 : M.clamp(b.pct, 0, 100)}%;background:${col}"></span></span>
            <span class="bp num" style="color:${warn ? col : 'var(--white,#fafafa)'}">${b.bin ? 'Lavt' : M.nf(b.pct, 0) + ' %'}</span></div>`;
        }).join('') : `<div class="br" style="border-top:0;color:var(--gray700,#979797);font-size:13px">Ingen batterier under ${lim} %</div>`}</section></div>`;
    }

    /* ---------- render */
    render() {
      const c = this.config, hass = this.hass;
      if (!M.romkortHTML || !M.romData) return '<div class="empty">Romkort-modulen mangler</div>';
      const L = (this._L = this._calcLayout());
      this._ticking = false;
      const wrap = (inner) => `<div class="hf ${L.wide ? 'wide' : ''}" style="${L.zoom !== 1 ? `zoom:${L.zoom}` : ''}">${inner}</div>`;
      if (!M.areas(hass).length) return wrap(M.emptyState('Fant ingen rom (områder) i Home Assistant', 'faner'));
      const B = this._batteries(), E = (this._E = tileEnts(hass, c));
      const TV = (this._TV = this._tabsV(B)), cur = this._curTab(TV);
      this._cur = cur;
      let view = '';
      if (cur.view === 'batterier') view = this._batView(B);
      else {
        const rooms = this._rooms(cur), car = cur.view === 'karusell', S = this._sides(cur, rooms, car);
        const col = (side) => {
          const top = this._tilesAt(cur, side, 'top', E), bot = this._tilesAt(cur, side, 'bottom', E);
          const mid = car ? this._carousel(cur, side, S[side], E) : S[side].map((r) => this._roomHTML(r, this._size(r))).join('');
          return `<div class="col">${top}${mid}${bot}</div>`;
        };
        const appl = cur.kind === 'aktuelt' ? this._applCards(E) : '';
        const cols = col('L') + col('R');
        const empty = !rooms.length && !/class="(tile|slot|rk)/.test(cols);
        view = appl + (empty ? (cur.kind === 'aktuelt' ? (appl ? '' : '<div class="none">Ingenting skjer akkurat nå – ingen lys på, ingenting spiller.</div>') : M.emptyState('Ingen rom på denne fanen', 'tab-' + cur.id)) : `<div class="cols">${cols}</div>`);
      }
      return wrap(`<section class="sec">${this._tabsHTML(TV, cur)}${view}</section>`);
    }
    onAction(name, el, ev) {
      const d = el.dataset;
      if (name === 'tab') return this._pickTab(Number(d.i));
      if (name === 'tile') return this._runTile(d.k, d.w);
      if (name === 'appl') { const A = this._appl(d.k, (this._E || {})[d.k]); if (A) this._applAct(A); return; }
      if (name === 'slide') { const x = this._slide(d.s, this._E || tileEnts(this.hass, this.config)); if (x.hash) return M.openPopup(x.hash); if (x.ent) return M.moreInfo(this, x.ent); return; }
      if (M.romkortAction && M.romkortAction(this, name, el)) return;
      return super.onAction(name, el, ev);
    }
    afterRender() {
      const root = this.shadowRoot;
      root.querySelectorAll('[data-sw]').forEach((vp) => M.hjemSwiper(this, vp, (i) => this.setUI({ sw: { ...(this.ui.sw || {}), [vp.dataset.sw]: i } })));
      this._bindTabs();
      this._placeTabs();
      // nedtelling for apparater (kun når Aktuelt vises og noe kjører)
      if (this._ticking && !this._tick) this._tick = setInterval(() => this._tickAppl(), 1000);
      else if (!this._ticking && this._tick) { clearInterval(this._tick); this._tick = null; }
    }
    _tickAppl() {
      if (!this.isConnected || !this._applT) return;
      const now = Date.now();
      this._applT.forEach((a) => {
        const el = this.shadowRoot.querySelector(`[data-key="ap-${a.kind}"]`);
        if (!el) return;
        const secs = Math.max(0, (a.end - now) / 1000), t = el.querySelector('.ap-t'), b = el.querySelector('.ap-bar span');
        if (t) t.textContent = `${Math.floor(secs / 3600)}:${pad2(Math.floor((secs % 3600) / 60))}:${pad2(Math.floor(secs % 60))}`;
        if (b) b.style.width = M.clamp((1 - secs / 60 / a.nominal) * 100, 2, 100).toFixed(1) + '%';
      });
    }
    // Linse (.ind) på aktiv fane. Scroll av aktiv fane inn i synlig område (row.scrollTo smooth) og kant-fade: MSH.tabReorder.
    _placeTabs() {
      const row = this.shadowRoot.querySelector('.tg');
      if (!row) return;
      const T = row.__tabReorder, busy = T && T.st && T.st.phase !== 'hold';
      const on = row.querySelector('.tab.on'), ind = row.querySelector('.ind');
      if (on && ind && !busy) {
        const L = on.offsetLeft, W = on.offsetWidth;
        (this._tabPos = this._tabPos || {})[on.dataset.id] = [L, W];
        const first = ind.style.opacity === '0';
        if (first) ind.style.transition = 'none';
        ind.style.left = L + 'px'; ind.style.width = W + 'px'; ind.style.opacity = '';
        if (first) { void ind.offsetWidth; ind.style.transition = ''; }
      }
    }
    // Fanelinjen: felles MSH.tabReorder. Vanlig sveip scroller raden (touch: native; mus: dra-scroll). Får fanene
    // plass, er sideveis dra = liquid glass-linse (.ind følger fingeren). Flytt fane KUN etter langt trykk (400 ms)
    // eller i redigeringsmodus (this.editMode / window.__kiEditMode).
    _bindTabs() {
      const row = this.shadowRoot.querySelector('.tg');
      if (!row) return;
      const items = () => [...row.querySelectorAll('.tab')];
      M.tabReorder(row, {
        card: this, glass: true, holdMs: 400,
        items, idOf: (b) => b.dataset.id,
        isEdit: () => !!(this.editMode || window.__kiEditMode),
        onReorder: (ids) => this._saveTabOrder(ids),
        onSelect: (id) => { const i = (this._TV || []).findIndex((t) => t.id === id); if (i >= 0) this._pickTab(i); },
        onGlassMove: (b, x) => {
          row.classList.add('drag');
          const ind = row.querySelector('.ind');
          if (ind) {
            const rr = row.getBoundingClientRect(), W = b.offsetWidth, cx = x - rr.left + row.scrollLeft;
            ind.style.width = W + 'px';
            ind.style.left = M.clamp(cx - W / 2, 0, Math.max(0, row.scrollWidth - W)) + 'px';
          }
          items().forEach((t) => t.classList.toggle('near', t === b));
        },
        onGlassEnd: (b) => { row.classList.remove('drag'); items().forEach((t) => t.classList.remove('near')); if (!b) this.update(); },
      });
    }
    get styles() {
      return `${M.romkortCSS || ''}
        .hf{display:block;width:100%}
        .hf:not(.wide){max-width:420px;margin:0 auto}
        .sec{display:flex;flex-direction:column;gap:12px}
        .tabs{position:relative;padding:4px;border-radius:24px;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.14);align-self:flex-start;max-width:100%;min-width:0;box-sizing:border-box;overflow:hidden;user-select:none;-webkit-user-select:none;cursor:pointer}
        .tabs.full{align-self:stretch}
        ${M.TAB_ROW_CSS || ''}
        .tg{position:relative;border-radius:999px}
        .ind{position:absolute;top:0;bottom:0;border-radius:999px;pointer-events:none;background:${C.accent};transition:left .5s cubic-bezier(.34,1.4,.64,1),width .35s cubic-bezier(.34,1.2,.64,1),transform .45s cubic-bezier(.34,1.8,.64,1),background .35s,opacity .2s}
        .tab{position:relative;z-index:1;flex:0 0 auto;min-width:max-content;scroll-snap-align:start;display:grid;place-items:center;font-size:13px;font-weight:500;white-space:nowrap;color:var(--gray800,#afafaf);transition:color .25s,transform .25s cubic-bezier(.34,1.6,.64,1),background .2s;border-radius:999px}
        .tabs.full .tab{flex:1 0 auto}
        .tab.on{color:var(--gray100,#2f2f2f)}
        .tg.drag .ind{background:linear-gradient(180deg, rgba(255,255,255,0.3), rgba(255,255,255,0.1));box-shadow:inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -1px 1px rgba(255,255,255,0.15), inset 0 0 0 0.5px rgba(255,255,255,0.35), 0 8px 20px rgba(0,0,0,0.35);backdrop-filter:blur(6px) saturate(200%);-webkit-backdrop-filter:blur(6px) saturate(200%);transform:scale(1.12,1.1);transition:transform .25s cubic-bezier(.34,1.8,.64,1),background .2s,width .2s}
        .tg.drag .tab{color:var(--gray800,#afafaf)}
        .tg.drag .tab.near{color:#fff}
        .tg.tr-drag .ind{opacity:0}
        .tg.tr-drag .tab{color:var(--gray800,#afafaf)}
        .tg.tr-drag>.tab.tr-lift{color:#fff !important;background:rgba(255,255,255,0.14);box-shadow:0 8px 20px rgba(0,0,0,0.35)}
        .cols{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px;align-items:start}
        .col{display:flex;flex-direction:column;gap:8px;min-width:0}
        .carw,.swc{display:flex;flex-direction:column;gap:10px;align-items:center;width:100%;min-width:0}
        .car{box-sizing:content-box;width:100%;overflow:hidden;padding-top:10px;margin-top:-10px;touch-action:pan-y}
        .tsw{width:100%;overflow:hidden;border-radius:36px;touch-action:pan-y}
        .track{display:flex;width:100%;transition:transform .45s cubic-bezier(.34,1.2,.64,1);will-change:transform}
        .slot{flex:none;width:100%;min-width:0}
        .dots{display:flex;gap:8px;height:14px;align-items:center}
        .dots span{width:10px;height:10px;border-radius:6px;background:var(--gray400,#545454);transition:background .2s,width .2s,height .2s}
        .dots span.on{width:12px;height:12px;background:var(--gray600,#7f7f7f)}
        .tile{display:flex;align-items:center;gap:12px;height:72px;padding:0 14px 0 6px;border-radius:36px;width:100%;box-sizing:border-box;background:var(--gray100,#2f2f2f);box-shadow:inset 0 0 0 1px rgba(255,255,255,0.04);color:var(--white,#fafafa);cursor:pointer;transition:background .25s;user-select:none;-webkit-user-select:none}
        .tic{width:60px;height:60px;border-radius:30px;flex:none;display:grid;place-items:center;background:var(--gray200,#3a3a3a);color:var(--white,#fafafa);cursor:pointer;transition:transform .2s}
        .tic:active{transform:scale(.9)}
        .tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;text-align:left}
        .tt{font-size:15px;font-weight:500}
        .ts{font-size:12px;color:var(--gray600,#7f7f7f);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .sl{flex:none;width:100%;height:220px;padding:18px;display:flex;flex-direction:column}
        .sl-top{font-size:15px;color:var(--gray800,#afafaf)}
        .sl-ti{font-size:30px;font-weight:300;letter-spacing:-0.01em;line-height:1.15;text-transform:uppercase}
        .sl-bar{width:16px;height:1.5px;background:var(--gray800,#afafaf);margin-bottom:12px;flex:none}
        .sl-l1{font-size:14px;font-weight:500;white-space:nowrap}
        .sl-l2{font-size:13px;color:var(--gray800,#afafaf);padding-top:4px}
        .apg{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px}
        .ap{position:relative;height:150px;border-radius:26px;background:var(--gray100,#2f2f2f);overflow:hidden;display:flex;flex-direction:column;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.04)}
        .ap-h{display:flex;align-items:flex-start;gap:8px;padding:14px 12px 0 16px}
        .ap-n{flex:1;min-width:0;font-size:13px;color:var(--gray900,#c7c7c7);padding-top:4px}
        .ap-b{width:40px;height:40px;border-radius:20px;flex:none;display:grid;place-items:center;background:var(--gray200,#3a3a3a);transition:transform .2s}
        .ap-b:active{transform:scale(.9)}
        .ap-t{font-size:34px;font-weight:300;letter-spacing:-0.02em;line-height:1;padding:0 16px}
        .ap-s{font-size:11px;color:var(--gray700,#979797);padding:2px 16px 10px}
        .ap-bar{position:relative;height:26px;background:repeating-linear-gradient(135deg, #5c5c5c 0 2px, transparent 2px 7px);flex:none}
        .ap-bar span{position:absolute;left:0;top:0;bottom:0;transition:width 1s linear}
        .bv{display:flex;flex-direction:column}
        .bh{display:flex;justify-content:space-between;align-items:baseline;gap:10px;padding:0 4px 8px}
        .bh-t{font-size:15px;font-weight:500;white-space:nowrap;flex:none}
        .bh-m{font-size:12px;color:var(--gray500,#696969);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
        .bl{display:flex;flex-direction:column;padding:4px 16px;border-radius:24px;background:var(--gray100,#2f2f2f)}
        .br{display:flex;align-items:center;gap:12px;min-height:58px;border-top:1px solid rgba(255,255,255,0.05);cursor:pointer}
        .bn{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
        .bnn{font-size:14px;font-weight:500}
        .bnr{font-size:11px;color:var(--gray600,#7f7f7f)}
        .bb{width:56px;height:8px;border-radius:4px;background:var(--gray200,#3a3a3a);overflow:hidden;flex:none}
        .bb span{display:block;height:100%;border-radius:4px}
        .bp{font-size:14px;font-weight:600;min-width:44px;text-align:right}
        .none{padding:22px 16px;border-radius:24px;background:var(--gray100,#2f2f2f);color:var(--gray700,#979797);font-size:13px;text-align:center}
      `;
    }
  }
  M.define('msh-hjem-faner-card', HjemFaner, 'MSH Hjem · faner og romkort', 'Fanerad (Hjem, etasjer, Aktuelt, Batterier) med sveipbare romkort, kortliste, snarveier, apparater og rom-varsler.');
})();
