/* KI MSH · «Tilpass Hjem»-arket. Kilde: Hjem v2.dc.html («Tilpass»: ce.* / edit.* / custEditVals / editVals / lookEd /
 * DEF_TILES / DEF_TABS / TAB_H / SLIDE_L / DEF_PROSE / SRC / ACTS).
 *   MSH.openHomeEditor({ focus })  – åpnes via hendelsesbussen (ki-open-editor, editor:'home') i 03-editors.js.
 * Arket rendres i ki-overlay-root (MSH.overlay, document.body, z-index 9000) – aldri inni kort eller popup.
 * Fanene: Kort · Faner · Popups · Tekst.
 *   Kort/Faner → msh-hjem-faner-card-config (layout.<fane>.{order,side,hidden,add}, rooms.<id>.*, tiles.<fane>.<kind>.*,
 *                tile_order/tile_hidden, swipe, slides, tab_*, custom_tabs, links, tap, battery)
 *   Tekst      → msh-prosa-card-config (prose[] med ent / ent_override / cent via felles MSH.entityPicker,
 *                «Ved trykk» = prose[].tap i HA-format via <msh-tap-picker> (Fiks 15.6), prose_font_size, prose_line_height)
 *   Kort       → også msh-hjem-card-config (show_todo, hidden) – «Kort på Hjem» med øye per kort
 *   Popups     → 28-popup-editor.js (MSH.popupsPanel): alle popups (Rom · Funksjoner · Egne) med YAML-editor. Skriver
 *                ki-store popups.<hash uten #> = { hidden, name, icon, color }, custom_popups[] og popup_overrides{}
 *                (strategien oppdaterer popupene i dashbordet straks, uten omlasting)
 * Utkast (fiks 15.13): arket åpner et ki-store-utkast (MSH.store.transaction). Endringer (MSH.saveCardConfig /
 * store.set fra alle fanene, også 28-popup-editor) vises live i kortene – de abonnerer på ki-store – men sendes ikke til
 * HA. Ferdig = ÉN frontend/set_user_data (tx.commit; deaktivert mens det lagres) → lukk, «Lagret», haptic success; feil →
 * arket står med utkastet. Avbryt/utenfor/Esc = tx.rollback (alt tilbake). Endret på en annen enhet mens arket er åpent
 * → banner «Endret et annet sted – Last inn» (tx.reload). Egne kort-utkast (MSH.draftEditor) er ikke brukt her fordi
 * arket skriver mange nøkler (tre kort + popups + custom_popups + popup_overrides + room_defaults).
 */
(function () {
  const M = window.MSH;
  if (!M || M.openHomeEditor) return;
  const esc = M.esc, C = M.C;
  const PINK = C.accent, PK = 'rgb(242 133 201)';
  const get = (o, p) => String(p).split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  const setIn = (o, p, v) => {
    const ks = String(p).split('.'), root = { ...(o || {}) };
    let cur = root;
    ks.forEach((k, i) => {
      if (i === ks.length - 1) { if (v === undefined || v === null || v === '') delete cur[k]; else cur[k] = v; }
      else { cur[k] = cur[k] && typeof cur[k] === 'object' && !Array.isArray(cur[k]) ? { ...cur[k] } : {}; cur = cur[k]; }
    });
    return root;
  };
  const pad2 = (n) => String(n).padStart(2, '0');
  const ic = (n, s, st) => M.icon(n, s || 20, st || '');
  // Blokkene i msh-hjem-card (samme nøkler som BLOCKS i 25-hjem.js)
  const BLOCKS = [['header', 'Header', 'mdi:account-group'], ['prosa', 'Prosa', 'mdi:text'], ['faner', 'Faner og romkort', 'mdi:tab'], ['soppel', 'Søppel', 'mdi:delete'], ['strom', 'Strømpris', 'mdi:lightning-bolt'], ['gjoremal', 'Gjøremål', 'mdi:format-list-checks']];

  /* ------------------------------------------------------------ samme regler som msh-hjem-faner-card (24-hjem-faner.js) */
  const TAB_H = { lav: 32, std: 38, mid: 44, hoy: 50, ekstra: 56 };
  const OUT_RX = /(^|_)(ute|utendors|utvendig|outdoor|outside|hage|garden|yard|terrasse|uteomrade)(_|$)/;
  const KINDS = { lock: ['key', 'Dørlås'], garage: ['garage', 'Garasjeport'], alarm: ['shield', 'Alarm'], cam: ['videocam', 'Kamera'], ruter: ['tram', 'Ruter'], todo: ['handyman', 'Gjøremål'], dish: ['dishwasher_gen', 'Oppvaskmaskin'], vacr: ['robot_2', 'Støvsuger'], tv: ['tv', 'TV'], wash: ['local_laundry_service', 'Vaskemaskin'], dry: ['dry_cleaning', 'Tørketrommel'], jul: ['park', 'Jul'] };
  const KIND_ORDER = Object.keys(KINDS);
  const TILE_DEF = { hjem: { lock: 'L-top', garage: 'L-top', alarm: 'L-bottom', cam: 'R-bottom', ruter: 'R-bottom', todo: 'R-bottom' }, aktuelt: {} };
  const DYN = ['dish', 'vacr', 'tv', 'wash', 'dry']; // Aktuelt: dynamisk etter tabs.aktuelt.types (fiks 15.10)
  const STACK_DEF = { hjem: { cam: true, ruter: true } };
  const SLIDE_L = { cal: ['calendar_month', 'Kalender'], vaer: ['partly_cloudy_day', 'Vær'], strom: ['bolt', 'Strøm'], trash: ['delete', 'Søppel'] };
  const VIEWS = [['karusell', 'Karusell'], ['liste', 'Kortliste'], ['batterier', 'Batterier']];
  // Fiks 17.10: sonene i «Snarveier» (fast rekkefølge) og typene i +-rutenettet
  const ZONES = [['L-top', 'Venstre · over rommene'], ['R-top', 'Høyre · over rommene'], ['L-bottom', 'Venstre · under rommene'], ['R-bottom', 'Høyre · under rommene']];
  const ZADD = [['link', 'mdi:link-variant', 'Snarvei'], ['lock', 'key', 'Dørlås'], ['alarm', 'shield', 'Alarm'], ['cam', 'videocam', 'Kamera'], ['todo', 'handyman', 'Gjøremål'], ['ruter', 'tram', 'Ruter'], ['garage', 'garage', 'Garasje'], ['tv', 'tv', 'TV'], ['vacr', 'robot_2', 'Støvsuger'], ['dish', 'dishwasher_gen', 'Oppvask'], ['wash', 'local_laundry_service', 'Vaskemaskin'], ['dry', 'dry_cleaning', 'Tørketrommel'], ['jul', 'park', 'Jul']];
  const TSW = [['ingen', '#545454', 'Grå'], ['gronn', C.green, 'Grønn'], ['gul', C.yellow, 'Gul'], ['oransje', C.orange, 'Oransje'], ['rod', C.red, 'Rød'], ['bla', C.blue, 'Blå'], ['rosa', C.pink, 'Rosa']];
  const SZ = { S: 'Liten', M: 'Medium', L: 'Stor' }, SZH = { S: 38, M: 72, L: 110 };
  const outdoorFloor = (f) => ([M.slug(f.name), M.slug(f.floor_id)].some((x) => OUT_RX.test(x)) ? 1 : 0);
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
    return out.map((t) => ({ ...t, autoLabel: t.label, defView: t.view, label: get(c, 'tab_labels.' + t.id) || t.label, view: t.kind === 'batterier' ? 'batterier' : get(c, 'tab_views.' + t.id) || t.view, hidden: (c.tab_hidden || []).includes(t.id), hc: t.kind === 'hjem' ? hjemHC(hass, c) : null }));
  }
  // Hjem: kuratert kortliste (M.hjemCards i 24-hjem-faner.js). null = autofyll (gammelt oppsett: alle rom).
  function hjemHC(hass, c) { if (!M.hjemCards || !hass) return null; const r = M.hjemCards(hass, c); return r.auto ? null : r; }
  function floorRank(hass) {
    const fl = M.floors(hass).slice().sort((a, b) => outdoorFloor(a) - outdoorFloor(b) || (a.level ?? 0) - (b.level ?? 0)), rk = {};
    fl.forEach((f, i) => { rk[f.floor_id] = i; });
    return rk;
  }
  function baseRooms(hass, c, t) {
    const rk = floorRank(hass);
    const areas = M.areas(hass).slice().sort((a, b) => (a.floor ? rk[a.floor] ?? 50 : 99) - (b.floor ? rk[b.floor] ?? 50 : 99) || a.name.localeCompare(b.name, 'nb'));
    const fill = get(c, `tabs.${t.id}.auto_fill`) !== false;
    let base = t.kind === 'floor' ? (fill ? areas.filter((a) => a.floor === t.floor) : []) : t.kind === 'andre' ? (fill ? areas.filter((a) => !a.floor) : []) : t.kind === 'custom' ? [] : t.hc ? t.hc.cards.filter((x) => /^rom:/.test(x)).map((x) => areas.find((a) => a.id === x.slice(4))).filter(Boolean) : areas;
    const add = Object.values(get(c, `layout.${t.id}.add`) || {}).filter(Boolean);
    add.forEach((id) => { const a = areas.find((x) => x.id === id); if (a && !base.includes(a)) base = [...base, a]; });
    if (t.kind === 'hjem' && !t.hc && M.roomAuto) { const has = (a) => { const au = M.roomAuto(hass, a.id); return au.temp || au.thermo ? 0 : 1; }; base = base.map((a, i) => [a, has(a), i]).sort((x, y) => x[1] - y[1] || x[2] - y[2]).map((x) => x[0]); }
    const ord = get(c, `layout.${t.id}.order`) || [];
    return [...ord.map((id) => base.find((a) => a.id === id)).filter(Boolean), ...base.filter((a) => !ord.includes(a.id))];
  }
  // Fiks 16.11: flis-oppslag (ekstra fliser av samme type, tile_cfg.<id>) deles med kortet via MSH.hjemTiles (24-hjem-faner.js)
  const HT = () => M.hjemTiles || null;
  const availKinds = (E, c) => (HT() ? HT().availKinds(E || {}, c) : [...KIND_ORDER.filter((k) => k === 'jul' || (E && E[k])), ...Object.keys(c.links || {}).filter((k) => c.links[k] && c.links[k].title).sort()]);
  const kindLabel = (k, c) => (HT() ? HT().kindLabel(k, c) : KINDS[k] ? KINDS[k][1] : ((c.links || {})[k] || {}).title || 'Snarvei');
  const kindIcon = (k, c) => (HT() ? HT().kindIcon(k, c) : KINDS[k] ? KINDS[k][0] : ((c.links || {})[k] || {}).icon || 'mdi:star');
  const defSlotOf = (c, tk, k) => (HT() ? HT().defSlot(c, tk, k) : (TILE_DEF[tk] || {})[k]);
  const tileSlot = (c, t, k) => {
    if (t.hc) {
      const sl = get(c, `tiles.${t.id}.${k}.slot`), set = !!sl && sl !== 'off';
      if (!t.hc.cards.includes(k) && !(set && !t.hc.exclude.includes(k))) return 'off';
      return set ? sl : defSlotOf(c, 'hjem', k) || 'R-top';
    }
    return get(c, `tiles.${t.id}.${k}.slot`) || defSlotOf(c, t.kind, k) || 'off';
  };
  const seasonOk = (c, t, k) => {
    const f = get(c, `tiles.${t.id}.${k}.fra`) ?? (k === 'jul' ? '11-01' : ''), tl = get(c, `tiles.${t.id}.${k}.til`) ?? (k === 'jul' ? '03-01' : '');
    if (!/^\d\d-\d\d$/.test(f) || !/^\d\d-\d\d$/.test(tl)) return true;
    const d = new Date(), md = pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
    return f <= tl ? md >= f && md < tl : md >= f || md < tl;
  };
  const roomCfgOf = (c, area) => {
    const rc = get(c, 'rooms.' + area) || {}, ov = {};
    const t = rc.temperature || rc.temperatur, h = rc.humidity || rc.fuktighet, k = rc.climate || rc.termostat;
    if (t) ov.temperature = t; if (h) ov.humidity = h; if (k) ov.climate = k;
    return { overrides: ov, look: { icon: rc.icon, color: rc.color || rc.col } };
  };
  const fakeCard = (hass, c) => ({ hass, config: c || {}, s: (id) => (id && hass && hass.states[id]) || null, n: (id) => M.num(hass, id) });

  /* ------------------------------------------------------------ prosa (samme lister som 21-hjem-prosa.js) */
  const TOK = ['vær', 'temp', 'pris', 'watt', 'lys', 'hendelser', 'hjemme', 'lås', 'alarm', 'søppel', 'gjøremål'];
  const SRC = [['none', 'Ingen boble'], ['text', 'Fast tekst'], ['weather', 'Vær'], ['temp', 'Ute-temp'], ['price', 'Strømpris'], ['watt', 'Effekt'], ['lights', 'Lys på'], ['events', 'Hendelser'], ['home', 'Hjemme'], ['lock', 'Dørlås'], ['alarm', 'Alarm'], ['trash', 'Søppel'], ['todo', 'Gjøremål'], ['custom', 'Egendefinert']];
  const ACTS = [['', 'Ingen'], ['more', 'Vis detaljer'], ['lock_toggle', 'Veksle dørlås'], ['lock', 'Lås dør'], ['unlock', 'Lås opp'], ['alarm_toggle', 'Veksle alarm'], ['alarm_on', 'Armer alarm'], ['alarm_off', 'Slå av alarm'], ['lights_on', 'Alle lys på'], ['lights_off', 'Alle lys av'], ['garage_toggle', 'Veksle garasjeport'], ['tv_toggle', 'Veksle TV'], ['vac_toggle', 'Pause/start støvsuger'], ['service', 'Egendefinert tjeneste']];
  const OPS = [['alltid', 'Alltid'], ['>', 'Over'], ['<', 'Under'], ['=', 'Er'], ['!=', 'Er ikke']];
  const PICONS = [['', 'Ingen'], ['dot', '● Prikk'], ['✨', '✨'], ['💡', '💡'], ['⏰', '⏰'], ['🌤️', '🌤️'], ['⚡', '⚡'], ['🔒', '🔒'], ['🚨', '🚨'], ['🗑️', '🗑️'], ['🏠', '🏠'], ['👋', '👋']];
  const PSW = [['hvit', C.white, 'Hvit'], ['auto', `conic-gradient(${C.green}, ${C.yellow}, ${C.red}, ${C.green})`, 'Auto etter verdi'], ['gronn', C.green, 'Grønn'], ['gul', C.yellow, 'Gul'], ['oransje', C.orange, 'Oransje'], ['rod', C.red, 'Rød'], ['bla', C.blue, 'Blå'], ['rosa', C.pink, 'Rosa']];
  const srcL = (id) => (SRC.find((x) => x[0] === id) || ['', id || ''])[1];
  const PFIXED = ['weather', 'temp', 'price', 'watt', 'lights', 'events', 'home', 'lock', 'alarm', 'trash', 'todo']; // kan overstyres (ent_override)

  /* ------------------------------------------------------------ ikon/farge (lookEd) */
  const ROOM_ICONS = [['mdi:sofa', 'sofa stue'], ['mdi:sofa-outline', 'stue'], ['mdi:chair-rolling', 'stol kontor'], ['mdi:countertop', 'kjøkken benk'], ['mdi:fridge', 'kjøleskap kjøkken'], ['mdi:silverware-fork-knife', 'spisestue kjøkken'], ['mdi:bed', 'seng soverom'], ['mdi:bed-king', 'seng soverom dobbelt'], ['mdi:bed-single', 'seng barnerom'], ['mdi:baby-carriage', 'baby barnerom'], ['mdi:human-child', 'barn'], ['mdi:toy-brick', 'leker barnerom'], ['mdi:bathtub', 'bad badekar'], ['mdi:shower', 'dusj bad'], ['mdi:toilet', 'toalett do wc'], ['mdi:desk', 'kontor pult'],
    ['mdi:desktop-classic', 'kontor pc data'], ['mdi:door', 'gang dør inngang'], ['mdi:door-sliding', 'skyvedør'], ['mdi:stairs', 'trapp'], ['mdi:balcony', 'balkong terrasse ute'], ['mdi:flower', 'hage blomst ute'], ['mdi:tree', 'hage tre'], ['mdi:grass', 'plen gress'], ['mdi:pool', 'basseng'], ['mdi:hot-tub', 'boblebad jacuzzi'], ['mdi:spa', 'spa sauna'], ['mdi:garage', 'garasje bil'], ['mdi:washing-machine', 'vask vaskerom'], ['mdi:hanger', 'garderobe klær'], ['mdi:television', 'tv stue'],
    ['mdi:theater', 'kino hjemmekino'], ['mdi:gamepad-variant', 'spill gaming'], ['mdi:dumbbell', 'trening gym'], ['mdi:warehouse', 'bod lager'], ['mdi:package-variant', 'bod boks'], ['mdi:home-roof', 'loft tak'], ['mdi:home-floor-b', 'kjeller'], ['mdi:home-variant', 'hytte hus'], ['mdi:home', 'hjem hus'], ['mdi:fireplace', 'peis'], ['mdi:paw', 'dyr hund katt'], ['mdi:music', 'musikk'], ['mdi:piano', 'piano musikk'], ['mdi:bookshelf', 'bibliotek bøker'], ['mdi:hammer-wrench', 'verksted verktøy'], ['mdi:lightning-bolt', 'strøm teknisk'], ['mdi:texture-box', 'rom område']];
  const COLS = ['var(--green)', 'var(--blue)', 'var(--orange)', 'var(--yellow)', 'var(--pink)', 'var(--red)', 'var(--purple)', 'var(--light-blue)', 'var(--gray1000)'];
  const ALLCOLS = () => [...M.THEME_COLORS.map(([k, hex, l]) => ['var(--' + k + ')', hex, l]), ...M.HA_COLORS.map(([k, hex, l]) => ['var(--' + k + '-color)', hex, 'HA · ' + (l || k)])];
  const toHex = (v) => { const r = M.resolveColor(M.color(v, v) || ''); if (/^#[0-9a-f]{6}$/i.test(r)) return r; const m = String(r).match(/rgba?\((\d+)[ ,]+(\d+)[ ,]+(\d+)/); return m ? '#' + [m[1], m[2], m[3]].map((x) => (+x).toString(16).padStart(2, '0')).join('') : '#ffffff'; };
  const sameCol = (a, b) => !!a && !!b && (a === b || M.color(a, a) === M.color(b, b));

  /* ------------------------------------------------------------ stil */
  const CSS = `
    /* Arket og bakteppet kommer fra MSH.overlay (MSH.sheetStyle/scrimStyle, Fiks 6): solid #282828 som standard,
       frosted glass bare med Liquid Glass-temaet. Her bare innholdspadding. */
    .sh{--ki-sh-pt:22px;--ki-sh-px:16px;--ki-sh-pb:40px;scrollbar-width:none}
    .sh::-webkit-scrollbar{display:none}
    .ed{display:grid;grid-template-columns:minmax(0,1fr);align-content:start;gap:14px;font-family:${M.FONT};-webkit-user-select:none;user-select:none}
    input,textarea{-webkit-user-select:text;user-select:text}
    .hd{display:flex;align-items:center;gap:8px;padding:0 4px}
    .hd .t{flex:1;font-size:22px;font-weight:600;letter-spacing:-0.01em} /* Fiks 26: lik header i alle Tilpass-ark */
    .hd .t{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap} .hd>button{flex:none;white-space:nowrap}
    @media (max-width:380px){.hd .t{font-size:20px} .hd .b40{padding:0 12px} .hd .done{padding:0 14px}} /* 360 px: «Ferdig» skal ikke kuttes */
    .b40{height:40px;padding:0 16px;border-radius:20px;background:var(--gray200,#3a3a3a);font-size:14px;font-weight:500}
    .done{height:40px;padding:0 18px;border-radius:20px;background:${PINK};color:#2f2f2f;font-size:14px;font-weight:600}
    .seg{display:flex;gap:2px;padding:4px;border-radius:24px;background:var(--gray200,#3a3a3a)}
    .seg>button{flex:1;height:40px;border-radius:20px;font-size:14px;font-weight:500;color:#afafaf;transition:background .2s,color .2s}
    .on-pk{background:${PINK} !important;color:#2f2f2f !important}
    ${M.iconTabs ? M.iconTabs.css('.seg.itabs') : ''}
    .ct{justify-self:start;touch-action:pan-y;overscroll-behavior-x:contain;padding:4px;border-radius:24px;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.14);max-width:100%;overflow-x:auto;scrollbar-width:none;cursor:pointer}
    .ct::-webkit-scrollbar{display:none}
    .ct .tg{position:relative;display:grid;width:max-content;min-width:max-content;grid-auto-columns:1fr}
    .ct .ind{position:absolute;top:0;bottom:0;border-radius:999px;pointer-events:none;background:${PINK};transition:left .5s cubic-bezier(.34,1.4,.64,1),transform .45s cubic-bezier(.34,1.8,.64,1),background .35s}
    .ct.drag .ind{background:linear-gradient(180deg,rgba(255,255,255,0.3),rgba(255,255,255,0.1));box-shadow:inset 0 1px 0 rgba(255,255,255,0.6),inset 0 -1px 1px rgba(255,255,255,0.15),inset 0 0 0 .5px rgba(255,255,255,0.35),0 8px 20px rgba(0,0,0,0.35);backdrop-filter:blur(6px) saturate(200%);-webkit-backdrop-filter:blur(6px) saturate(200%);transform:scale(1.12,1.1);transition:transform .25s cubic-bezier(.34,1.8,.64,1),background .2s}
    .ct .tb{position:relative;z-index:1;display:grid;place-items:center;padding:0 18px;min-width:0;overflow:hidden;text-overflow:ellipsis;font-size:13px;font-weight:500;white-space:nowrap;color:#afafaf;transition:color .25s}
    .ct .tb.on{color:#2f2f2f}
    .ct.drag .tb.on{color:#afafaf}
    .ct .tb.near{color:#fff !important}
    .ct .tb.dim{opacity:.4;text-decoration:line-through}
    .tgl{height:48px;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0 10px 0 16px;border-radius:24px;background:var(--gray200,#3a3a3a);font-size:14px;font-weight:500;width:100%;text-align:left}
    .trk{display:block;position:relative;width:44px;height:26px;border-radius:13px;flex:none;background:#545454;transition:background .2s}
    .trk::after{content:'';position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:10px;background:#c7c7c7;transition:left .2s,background .2s}
    .trk.on{background:${M.SWITCH_ON}} /* Fiks 26: rosa brytere */
    .trk.on::after{left:21px;background:#2f2f2f}
    .trk.big{width:52px;height:32px;border-radius:16px}
    .trk.big::after{width:26px;height:26px;border-radius:13px}
    .trk.big.on::after{left:23px}
    .trk.off{opacity:.4}
    .gr{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:12px;border-radius:26px;background:var(--gray000,#232323)}
    .gc{display:flex;flex-direction:column;gap:6px;min-width:0}
    .gct{font-size:11px;color:#7f7f7f;padding:0 4px 2px}
    .gh{display:flex;align-items:center;gap:6px;font-size:10px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#696969;padding:4px 4px 0;white-space:nowrap}
    .gh::before,.gh::after{content:'';flex:1;height:1px;background:rgba(255,255,255,0.08)}
    .gh.eh{display:none}
    .gr.dnd .gh.eh{display:flex}
    .gh.hov{color:${PK}}
    .gh.hov::before,.gh.hov::after{background:${PK}}
    .it{display:flex;flex-direction:column;box-sizing:border-box;width:100%;min-width:0;text-align:left;cursor:grab;touch-action:pan-y;transition:box-shadow .15s,opacity .15s}
    .it .l1{display:flex;align-items:center;gap:6px;width:100%;min-width:0}
    .it .nm{flex:1;min-width:0;font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .it .tsub{display:block;width:100%;min-width:0;padding-left:22px;box-sizing:border-box;font-size:11px;line-height:1.25;color:#979797;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .bdg{flex:none;display:flex;align-items:center;gap:2px;font-size:9px;font-weight:600;padding:2px 6px 2px 4px;border-radius:8px;background:#2a2a2a;color:#979797;white-space:nowrap}
    .bdg.sw{background:rgb(242 133 201 / 0.18);color:rgb(242 170 215)}
    .bdg.ss{background:var(--gray200,#3a3a3a);color:#979797}
    .tv{display:flex;align-items:baseline;gap:4px;padding-left:2px}
    .tv .b{font-weight:300;letter-spacing:-0.03em;line-height:1}
    .tv .s{font-size:10px;color:#7f7f7f}
    .it.src{opacity:.35}
    .it.hov-t{box-shadow:inset 0 3px 0 ${PK} !important}
    .it.hov-b{box-shadow:inset 0 -3px 0 ${PK} !important}
    .add{height:36px;border-radius:14px;display:grid;place-items:center;color:#7f7f7f;box-shadow:inset 0 0 0 1.5px rgba(255,255,255,0.18)}
    .add.on,.gc.hov>.add{color:${PK};box-shadow:inset 0 0 0 1.5px ${PK}}
    .ghost{position:fixed;left:0;top:0;z-index:20;pointer-events:none;opacity:.94;box-shadow:0 14px 34px rgba(0,0,0,0.55);transform-origin:center;will-change:transform}
    .pnl{display:flex;flex-direction:column;gap:12px;padding:14px 16px;border-radius:24px;background:var(--gray200,#3a3a3a)}
    .pnl.pk{gap:8px;padding:14px}
    .ln{display:flex;align-items:center;justify-content:space-between;gap:10px}
    .lb{font-size:13px;color:#afafaf}
    .lb2{display:flex;flex-direction:column;gap:1px}
    .sub{font-size:11px;color:#7f7f7f}
    .ph{display:flex;align-items:center;gap:10px;min-width:0}
    .ph .n{flex:1;min-width:0;font-size:16px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .red{height:36px;padding:0 12px 0 10px;border-radius:18px;flex:none;background:rgb(242 128 115 / 0.2);color:rgb(242 128 115);display:flex;align-items:center;gap:4px;font-size:13px;font-weight:500}
    .ud{display:flex;border-radius:18px;background:var(--gray100,#2f2f2f);padding:2px}
    .ud>button{width:32px;height:32px;border-radius:16px;display:grid;place-items:center}
    .b36{height:36px;padding:0 12px 0 10px;border-radius:18px;background:var(--gray100,#2f2f2f);display:flex;align-items:center;gap:4px;font-size:13px;font-weight:500;white-space:nowrap}
    .ss{display:flex;gap:2px;padding:3px;border-radius:18px;background:var(--gray100,#2f2f2f)}
    .ss>button{height:32px;padding:0 12px;border-radius:16px;font-size:13px;font-weight:500;white-space:nowrap;color:#afafaf}
    .ss.sm{border-radius:15px;background:var(--gray000,#232323)}
    .ss.sm>button{height:28px;padding:0 10px;border-radius:13px;font-size:12px}
    .sep{padding-top:10px;border-top:1px solid rgba(255,255,255,0.06);display:flex;flex-direction:column;gap:10px}
    .pv{width:44px;height:44px;border-radius:22px;flex:none;display:grid;place-items:center;color:#232323;box-shadow:0 0 0 1px rgba(255,255,255,0.08)}
    .ttl{font-size:13px;font-weight:500}
    .note{font-size:11px;color:#7f7f7f;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .std{height:28px;padding:0 10px;border-radius:14px;background:var(--gray000,#232323);font-size:11px;color:#afafaf;flex:none}
    .srch{display:flex;align-items:center;gap:8px;height:40px;padding:0 12px;border-radius:12px;background:var(--gray000,#232323)}
    .srch input{flex:1;min-width:0;height:100%;background:transparent;color:#fafafa;font-size:13px}
    .icg{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:6px}
    .icg>button{aspect-ratio:1;border-radius:12px;display:grid;place-items:center;background:var(--gray000,#232323);color:#c7c7c7}
    .useq{height:36px;border-radius:12px;background:var(--gray000,#232323);display:flex;align-items:center;justify-content:center;gap:6px;font-size:12px;color:#c7c7c7}
    .cols{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
    .cl{width:30px;height:30px;border-radius:15px;flex:none}
    .cl.on{box-shadow:0 0 0 3px #2f2f2f,0 0 0 5px #fafafa}
    .cw{position:relative;width:30px;height:30px;border-radius:15px;display:grid;place-items:center;cursor:pointer;overflow:hidden;color:#232323;flex:none}
    .cw input{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%;border:0;padding:0}
    .chs{display:flex;gap:6px;flex-wrap:wrap}
    .crr{display:flex;flex-direction:column;gap:8px;padding:10px;border-radius:18px;background:var(--gray100,#2f2f2f)}
    .crh{display:flex;align-items:center;gap:8px;min-height:32px}
    .crb{font-size:11px;font-weight:600;padding:3px 8px;border-radius:10px;background:rgba(255,255,255,0.08);color:#979797}
    .crb.on{background:rgb(115 217 140 / 0.18);color:#8fd9a8}
    .crib{width:32px;height:32px;border-radius:16px;display:grid;place-items:center;color:#afafaf;background:rgba(255,255,255,0.06)}
    .crc{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12.5px;line-height:1.45;border-radius:12px;padding:10px 12px;background:var(--gray000,#232323);color:#fafafa;border:0;resize:vertical;width:100%;box-sizing:border-box;white-space:pre}
    .cre{font-size:12px;color:var(--red,#f28073)}
    .crp{height:30px;font-size:12px}
    .b34{height:34px;padding:0 12px;border-radius:17px;background:var(--gray000,#232323);display:flex;align-items:center;gap:6px;font-size:12px;font-weight:500;color:#c7c7c7}
    .b34.on{color:${PK};box-shadow:inset 0 0 0 1px rgb(242 133 201 / 0.5)}
    .allc{display:grid;grid-template-columns:repeat(9,minmax(0,1fr));gap:6px}
    .allc>button{aspect-ratio:1;border-radius:50%}
    .allc>button.on{box-shadow:0 0 0 2px #2f2f2f,0 0 0 4px #fafafa}
    .hint{font-size:12px;color:#7f7f7f;padding:0 6px;line-height:1.4}
    .pkc{height:36px;padding:0 14px 0 10px;border-radius:18px;display:flex;align-items:center;gap:6px;background:#545454;font-size:13px;font-weight:500;white-space:nowrap}
    .pkt{font-size:13px;color:#afafaf}
    .pks{font-size:11px;color:#979797;padding-top:4px}
    .ac{display:flex;align-items:center;gap:12px;height:56px;padding:0 14px 0 16px;border-radius:28px;background:#2a2a2a;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.06);width:100%}
    .ac.open{background:var(--gray200,#3a3a3a)}
    .ac .at{flex:1;min-width:0;text-align:left;font-size:15px;font-weight:600}
    .ac .am{font-size:12px;color:#979797;white-space:nowrap}
    .ac .ch{transition:transform .25s}
    .ac.open .ch{transform:rotate(180deg)}
    .box{display:flex;flex-direction:column;gap:12px;padding:12px 14px;border-radius:24px;background:var(--gray200,#3a3a3a)}
    .box.t6{gap:6px;padding:12px}
    .c34{height:34px;padding:0 8px 0 10px;border-radius:17px;background:#545454;display:flex;align-items:center;gap:6px;font-size:13px;font-weight:500;white-space:nowrap}
    .o34{height:34px;padding:0 12px;border-radius:17px;font-size:13px;font-weight:500;white-space:nowrap;box-shadow:inset 0 0 0 1.5px rgba(255,255,255,0.18);color:#afafaf}
    .tr{display:flex;align-items:center;gap:4px;padding:0 8px 0 14px;border-radius:26px;background:var(--gray100,#2f2f2f)}
    .tr.open{background:#545454}
    .tr .tm{flex:1;min-width:0;height:52px;display:flex;align-items:center;gap:10px;text-align:left}
    .tr .tt{display:flex;flex-direction:column;gap:1px;min-width:0}
    .tr .tt b{font-size:14px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .tr .tt i{font-style:normal;font-size:11px;color:#979797;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .sq{width:32px;height:32px;border-radius:16px;flex:none;display:grid;place-items:center;background:var(--gray000,#232323);color:#fafafa}
    .sq.no{background:transparent;color:#545454;pointer-events:none}
    .sq.del{background:rgb(242 128 115 / 0.2);color:rgb(242 128 115)}
    .swg{height:46px;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0 8px 0 14px;border-radius:23px;background:var(--gray100,#2f2f2f);font-size:14px;font-weight:500;width:100%;text-align:left}
    .fld{display:flex;flex-direction:column;gap:6px;min-width:0}
    .fl{font-size:12px;color:#979797}
    .in{height:44px;border-radius:14px;padding:0 14px;background:var(--gray000,#232323);color:#fafafa;font-size:15px;min-width:0;width:100%}
    .in.s{height:36px;border-radius:10px;padding:0 10px;font-size:13px}
    .in.t{height:40px;font-size:15px;font-weight:500;padding:0 12px}
    select.in{padding:0 12px;font-size:14px;color-scheme:dark;appearance:auto}
    .g2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .ted{display:flex;flex-direction:column;gap:10px;padding:12px;margin:2px 0 6px;border-radius:22px;background:var(--gray100,#2f2f2f);box-shadow:inset 0 0 0 1px rgba(255,255,255,0.06)}
    .ted .tap{background:var(--gray200,#3a3a3a);gap:8px}
    /* fiks 17.10 · soner i «Snarveier» */
    .zn{display:flex;flex-direction:column;gap:6px;padding:10px;border-radius:22px;background:var(--gray100,#2f2f2f)}
    .zh{display:flex;align-items:center;gap:10px;min-height:40px;padding:0 0 0 2px}
    .zm{width:30px;height:30px;flex:none;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 4px 1fr;gap:2px}
    .zm i{border-radius:3px;background:#545454}
    .zm i.on{background:var(--pink,#f285c9)}
    .zm b{grid-column:1 / 3;border-radius:2px;background:#7f7f7f;margin:1px 3px}
    .zh .zt{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
    .zh .zt b{font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .zh .zt i{font-style:normal;font-size:11px;color:#979797}
    .zsw{height:28px;padding:0 10px;border-radius:14px;flex:none;display:flex;align-items:center;gap:4px;font-size:12px;font-weight:600;color:#afafaf;box-shadow:inset 0 0 0 1.5px rgba(255,255,255,0.18)}
    .zsw.on{background:rgb(102 209 158 / 0.18);color:rgb(102 209 158);box-shadow:inset 0 0 0 1.5px rgb(102 209 158 / 0.5)}
    .zad{width:36px;height:36px;border-radius:18px;flex:none;display:grid;place-items:center;background:var(--gray200,#3a3a3a);color:#fafafa;transition:transform .2s,background .2s}
    .zad.on{transform:rotate(45deg);background:var(--pink,#f285c9);color:#2f2f2f}
    .zgr{display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:6px}
    .zgr>button{height:64px;border-radius:16px;background:var(--gray200,#3a3a3a);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font-size:12px;font-weight:500;color:#e1e1e1}
    .zemp{font-size:12px;color:#7f7f7f;padding:6px 4px 4px}
    .zr{display:flex;align-items:center;gap:6px;padding:6px 6px 6px 6px;border-radius:26px;background:var(--gray200,#3a3a3a);touch-action:pan-y}
    .zr.open{box-shadow:inset 0 0 0 2px rgb(242 133 201)}
    .zr .zrm{flex:1;min-width:0;display:flex;align-items:center;gap:10px;text-align:left;height:40px}
    .zr .zc{width:40px;height:40px;border-radius:20px;flex:none;display:grid;place-items:center;color:#fafafa}
    .zr .tt{display:flex;flex-direction:column;gap:1px;min-width:0}
    .zr .tt b{font-size:14px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .zr .tt i{font-style:normal;font-size:11px;color:#979797;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .zud{display:flex;flex-direction:column;flex:none}
    .zud>button{width:28px;height:18px;display:grid;place-items:center;color:#c7c7c7}
    .zud>button.no{color:#545454;pointer-events:none}
    .zch{width:32px;height:32px;border-radius:16px;flex:none;display:grid;place-items:center;color:#979797;transition:transform .2s}
    .zr.open .zch{transform:rotate(180deg)}
    .zpg{display:grid;grid-template-columns:1fr 1fr;gap:6px}
    .zpg>button{height:36px;border-radius:12px;background:var(--gray000,#232323);font-size:13px;font-weight:500;color:#afafaf}
    .zpg>button.on{background:var(--pink,#f285c9);color:#2f2f2f}
    .zpg>span{grid-column:1 / 3;height:24px;border-radius:8px;border:1.5px dashed #545454;display:grid;place-items:center;font-size:11px;color:#7f7f7f}
    .zdel{height:44px;width:100%;border-radius:22px;display:flex;align-items:center;justify-content:center;gap:6px;background:rgb(242 128 115 / 0.16);color:rgb(242 128 115);font-size:14px;font-weight:500}
    .ach{display:flex;flex-wrap:wrap;gap:6px}
    .ach>button{height:32px;padding:0 12px;border-radius:16px;font-size:12px;font-weight:500;background:var(--gray000,#232323);color:#afafaf}
    .ach>button.on{background:var(--pink,#f285c9);color:#2f2f2f}
    .asec{display:flex;flex-direction:column;gap:10px;padding:12px;border-radius:18px;background:var(--gray200,#3a3a3a)}
    .trg{display:flex;flex-direction:column;gap:8px;padding:10px;border-radius:14px;background:var(--gray100,#2f2f2f)}
    .tap{display:flex;flex-direction:column;gap:12px;padding:12px;border-radius:18px;background:var(--gray100,#2f2f2f)}
    .tap .th{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:600}
    .chip{height:32px;padding:0 12px;border-radius:16px;flex:none;display:flex;align-items:center;gap:6px;font-size:13px;font-weight:500;white-space:nowrap;background:#545454;color:#fafafa}
    .tok{height:26px;padding:0 9px;border-radius:13px;background:#545454;font-size:11px;white-space:nowrap;color:#afafaf}
    .toks{display:flex;gap:4px;flex-wrap:wrap;max-height:88px;overflow-y:auto;scrollbar-width:none}
    .sw34{width:34px;height:34px;border-radius:17px;flex:none;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.2)}
    .sw34.on{box-shadow:0 0 0 2px #3a3a3a,0 0 0 4px #fafafa}
    .tabr{display:flex;flex-direction:column;gap:10px;padding:10px;border-radius:22px;background:var(--gray200,#3a3a3a);touch-action:pan-y}
    .tabr.hid{opacity:.55}
    .tabr .l{display:flex;align-items:center;gap:4px}
    .tabr .v{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
    .rs{margin-left:auto;height:32px;padding:0 4px 0 10px;border-radius:16px;display:flex;align-items:center;gap:2px;font-size:13px;color:#afafaf}
    .bat{display:flex;flex-direction:column;gap:12px;padding:12px;border-radius:16px;background:var(--gray000,#232323)}
    .bsr{display:flex;align-items:center;gap:8px;height:44px;padding:0 12px;border-radius:14px;background:var(--gray100,#2f2f2f)}
    .bsr input{flex:1;min-width:0;height:100%;background:transparent;color:#fafafa;font-size:13px}
    .bsg{display:flex;align-items:center;gap:10px;min-height:44px;padding:4px 8px;border-radius:12px;width:100%;text-align:left}
    input[type=range]{width:100%;accent-color:${PK};cursor:pointer}
    .big52{height:52px;border-radius:26px;display:flex;align-items:center;justify-content:center;gap:8px;font-size:15px;font-weight:500;box-shadow:inset 0 0 0 1.5px rgba(255,255,255,0.18);width:100%}
    .tset{display:flex;flex-direction:column;gap:10px;padding:12px 14px;border-radius:24px;background:var(--gray200,#3a3a3a)}
    .o36{height:36px;padding:0 14px;border-radius:18px;font-size:13px;font-weight:500;white-space:nowrap;background:#545454;color:#fafafa}
    .stp{display:flex;align-items:center;gap:2px;padding:3px;border-radius:18px;background:var(--gray000,#232323);flex:none}
    .stp>button{width:30px;height:30px;border-radius:15px;display:grid;place-items:center;color:#c7c7c7}
    .stp>span{min-width:48px;text-align:center;font-size:13px;font-weight:500;font-variant-numeric:tabular-nums}
    .pgs{display:flex;gap:6px;flex-wrap:wrap}
    .pg{height:40px;padding:0 16px 0 12px;border-radius:20px;display:flex;align-items:center;gap:6px;font-size:14px;font-weight:500;background:var(--gray200,#3a3a3a);color:#fafafa}
    .pg.on{background:#fafafa;color:#232323}
    .pl{display:flex;flex-direction:column;gap:6px}
    .pr{display:flex;align-items:center;gap:12px;min-height:60px;padding:8px 10px 8px 12px;border-radius:24px;background:var(--gray200,#3a3a3a);width:100%;text-align:left}
    .pr.hid{opacity:.55}
    .pr .pi{width:40px;height:40px;border-radius:20px;flex:none;display:grid;place-items:center;color:#232323}
    .pr .pn{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
    .pr .pn b{font-size:15px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .pr .pn i{font-style:normal;font-size:12px;color:#979797;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .pe{display:flex;flex-direction:column;gap:10px;padding:14px;border-radius:24px;background:var(--gray300,#404040)}
    .pe .in{background:#282828}
    .pv2{width:44px;height:44px;border-radius:22px;flex:none;display:grid;place-items:center;color:#232323}
    .prev{padding:14px 16px;border-radius:24px;background:var(--gray000,#232323);font-size:16px;line-height:1.95}
    .pc{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 11px;border-radius:14px;color:#232323;font-weight:600;font-size:15px;vertical-align:middle;white-space:nowrap;line-height:1}
    .pc ha-icon{color:#232323}
    .pd{width:8px;height:8px;border-radius:4px;flex:none}
    .pro{display:flex;align-items:center;gap:4px;padding:0 8px 0 16px;border-radius:26px;background:var(--gray200,#3a3a3a)}
    .pro.open{background:#545454}
    .pro.hid{opacity:.55}
    .tr.hid{opacity:.55}
    .pro .pm{flex:1;min-width:0;min-height:54px;display:flex;flex-direction:column;justify-content:center;gap:2px;text-align:left;padding:6px 0}
    .pro .pm b{font-size:14px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
    .pro .pm i{font-style:normal;font-size:11px;color:#979797;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
    .ped{display:flex;flex-direction:column;gap:16px;padding:14px;border-radius:22px;background:var(--gray200,#3a3a3a)}
    .svc{display:flex;flex-direction:column;gap:10px;padding:12px;border-radius:18px;background:var(--gray100,#2f2f2f)}
    .svc .sh2{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:500;letter-spacing:0.06em;text-transform:uppercase;color:#7f7f7f}
    .pink{height:42px;border-radius:21px;display:flex;align-items:center;justify-content:center;gap:6px;font-size:14px;font-weight:600;background:${PINK};color:#2f2f2f}
    .rule{display:flex;flex-direction:column;gap:8px;padding:10px;border-radius:18px;background:var(--gray100,#2f2f2f)}
    .rule .rh{display:flex;align-items:center;gap:6px}
    .rsel{position:relative;flex:1;min-width:0;height:38px;border-radius:12px;background:var(--gray000,#232323);display:flex;align-items:center;gap:8px;padding:0 10px}
    .rsel span{flex:1;font-size:13px;font-weight:500}
    .rsel select{position:absolute;inset:0;opacity:0;cursor:pointer;font-size:16px}
    .live{font-size:11px;font-weight:600;padding:4px 9px;border-radius:10px;background:var(--gray000,#232323);color:#7f7f7f;white-space:nowrap}
    .live.on{background:rgb(242 128 115 / 0.2);color:rgb(242 128 115)}
    .dz34{width:34px;height:34px;border-radius:17px;flex:none;display:grid;place-items:center;background:rgb(242 128 115 / 0.2);color:rgb(242 128 115)}
    .o44{height:44px;border-radius:22px;display:flex;align-items:center;justify-content:center;gap:6px;font-size:14px;font-weight:500;box-shadow:inset 0 0 0 1.5px rgba(255,255,255,0.18);width:100%}
    .dim{font-size:12px;color:#7f7f7f;padding:0 4px}
    .kd{font-size:12px;color:#7f7f7f;padding:0 6px}
  `;

  /* ------------------------------------------------------------ arket */
  let open = null;
  M.openHomeEditor = function ({ focus } = {}) {
    if (open && !open.closed) { open.focus(focus); return open; }
    open = new HomeEditor(focus);
    return open;
  };

  class HomeEditor {
    constructor(focus) {
      if (M.store) M.store.scope = 'shared'; // én felles config
      this.u = { sec: 'kort', ctx: null, sel: null, pick: null, acc: {}, icQ: '', allIc: false, allCol: false, popG: 'alle', popSel: null, proseSel: null };
      const lf = M.liveOf('msh-hjem-faner-card');
      if (lf && lf._cur) this.u.ctx = lf._cur.id;
      this.focus(focus, true);
      this.ov = M.overlay({ html: '', css: CSS, sheet: false, maxWidth: 440 });
      this.root = this.ov.root;
      this.body = this.ov.body;
      this.sheet = this.root.querySelector('.sh');
      this.ov.onClosed = () => this._closed();
      this._bind();
      this._storeOff = M.store ? M.store.subscribe((d, path) => {
        if (this._saving) return;
        if (!path || /^(cards|devices)(\.|$)/.test(path)) { this._F = null; this._P = null; this._H = null; this._S = null; }
        this._schedule();
      }) : null;
      // Utkast: start når ki-store er lastet (ellers ville første innlasting sett ut som «endret et annet sted»)
      if (M.store) Promise.resolve(this.hass && !M.store.loaded ? M.store.load(this.hass) : null).then(() => { if (!this.closed) this.tx = M.store.transaction({ onExternal: () => this._external() }); });
      this.render();
    }
    // Endret på en annen enhet mens utkastet er åpent: banner øverst i arket (overlever render)
    _external() {
      if (this.closed || (this._banner && this._banner.isConnected)) return;
      this._banner = M.draftBanner(this.sheet, () => {
        if (this._banner) this._banner.remove(); this._banner = null;
        if (this.tx) this.tx.reload();
        this._F = null; this._P = null; this._H = null; this._S = null;
        this.render();
      }, this.body);
    }
    // Ferdig: én lagring av hele utkastet; dobbelttrykk ignoreres mens den pågår
    async _done() {
      if (this._busy) return;
      if (!this.tx || !this.tx.active || !this.tx.dirty) { this.close(); return; }
      this._busy = true; this.render();
      let r;
      try { r = await this.tx.commit(); } catch (e) { r = { ok: false, error: e && e.message }; }
      this._busy = false;
      if (!r || r.ok === false) {
        const msg = 'Kunne ikke lagre' + (r && r.error ? ' – ' + r.error : '');
        M.haptic('failure'); M.toast(msg); this.render(); return;
      }
      M.haptic('success'); M.toast('Lagret');
      this.close();
    }
    get closed() { return !!(this.ov && this.ov.closed); }
    focus(f, silent) {
      if (!f) return;
      const s = String(f);
      if (s === 'faner' || s === 'tabs') this.u.sec = 'faner';
      else if (/^pop/.test(s)) this.u.sec = 'pop';
      else if (/^(tekst|prose|prosa)$/.test(s)) this.u.sec = 'tekst';
      else if (s === 'kort') this.u.sec = 'kort';
      else if (/^tab-/.test(s)) { this.u.sec = 'kort'; this.u.ctx = s.slice(4); }
      else if (/^rom-/.test(s)) { this.u.sec = 'kort'; this.u.sel = { t: 'room', id: s.slice(4) }; }
      else { this.u.sec = 'kort'; this.u.ctx = s; }
      if (!silent) this.render();
    }
    _closed() {
      if (this._storeOff) this._storeOff();
      if (this.tx && this.tx.active) this.tx.rollback(); // Avbryt / utenfor / Esc: utkastet forkastes
      if (open === this) open = null;
    }
    close() { this.ov.close(); }

    /* ---------- data */
    get fanerLive() { return M.liveOf('msh-hjem-faner-card'); }
    get prosaLive() { return M.liveOf('msh-prosa-card'); }
    get hass() {
      const a = this.fanerLive, b = this.prosaLive, hj = M.liveOf('msh-hjem-card');
      const ha = document.querySelector('home-assistant');
      return (a && a.hass) || (b && b.hass) || (hj && hj.hass) || M.lastHass || (ha && ha.hass) || null;
    }
    // Config sett fra valgt omfang: «Denne enheten» = enhet + felles + YAML, «Alle enheter» = felles + YAML
    _raw(tag, key) {
      const live = M.liveOf(tag), shared = !!(M.store && M.store.scope === 'shared');
      if (live && live._yamlConfig) return M.effectiveConfig(live._yamlConfig, live, { shared });
      if (live && live._rawConfig && !shared) return live._rawConfig;
      return M.effectiveConfig({ type: 'custom:' + tag, card_id: M.CARD_IDS[key] }, null, { shared });
    }
    // ki-store-nøklene arket skriver til (for «Eget oppsett» / «Bruk felles oppsett» / «Kopier til alle»)
    // popup-valg (felles config)
    _popCfg() { return (M.store && M.store.get('popups')) || {}; }
    F() { return this._F || this._raw('msh-hjem-faner-card', 'faner'); }
    P() { return this._P || this._raw('msh-prosa-card', 'prosa'); }
    H() { return this._H || this._raw('msh-hjem-card', 'home'); }
    // 24.4: søppelkortet på Hjem (msh-soppel-card, blokk-nøkkel «soppel», card_id M.CARD_IDS.soppel)
    S() { return this._S || this._raw('msh-soppel-card', 'soppel'); }
    // patch: { 'sti': verdi } (undefined/'' = fjern)
    _save(tag, key, patch) {
      const CK = { faner: '_F', prosa: '_P', home: '_H', soppel: '_S' }[key];
      const old = this._raw(tag, key), base = this[CK] || old;
      let nc = { ...base };
      Object.keys(patch).forEach((p) => { nc = setIn(nc, p, patch[p]); });
      if (!nc.card_id) nc.card_id = old.card_id || M.CARD_IDS[key];
      if (!nc.type) nc.type = old.type || 'custom:' + tag;
      this[CK] = nc;
      this._saving = true;
      try { M.saveCardConfig(this.hass, old, nc, { toasts: false, card: M.liveOf(tag) }); } catch (e) { console.error('[ki-msh] Tilpass Hjem', e); } finally { this._saving = false; }
      this._schedule();
    }
    saveF(patch) { this._save('msh-hjem-faner-card', 'faner', this._hjemLock(patch)); }
    // Første endring på Hjem-fanen låser oppsettet i tabs.hjem (kuratert liste eller autofyll for gamle oppsett), så
    // f.eks. en flytting (layout.hjem) aldri bytter modus av seg selv (fiks 15.10).
    _hjemLock(patch) {
      const c = this.F();
      if (get(c, 'tabs.hjem') || !M.hjemCards || !this.hass) return patch;
      if (!Object.keys(patch).some((p) => /^(layout|tiles|tile_order|tile_hidden|swipe|slides)\.hjem(\.|$)|^tabs\.hjem\./.test(p))) return patch;
      const hc = M.hjemCards(this.hass, c);
      return { 'tabs.hjem': hc.auto ? { auto_fill: true } : { auto_fill: false, cards: hc.cards, seen: hc.candidates }, ...patch };
    }
    // Ny tabs.hjem med gitte kort/exclude (resten beholdes).
    _hcObj(m, cards, exclude) {
      const H = get(m.c, 'tabs.hjem') || {}, o = { ...H, auto_fill: false, cards, seen: H.seen || m.t.hc.candidates };
      if (exclude && exclude.length) o.exclude = exclude; else delete o.exclude;
      return o;
    }
    saveP(patch) { this._save('msh-prosa-card', 'prosa', patch); }
    saveH(patch) { this._save('msh-hjem-card', 'home', patch); }
    saveS(patch) { this._save('msh-soppel-card', 'soppel', patch); }
    // Snarvei-entiteter (samme autokonfig som kortet): hentes fra en frakoblet faner-instans.
    _E(c) {
      const hass = this.hass, key = JSON.stringify([c.overrides || {}, c.trash_sensor || '']);
      if (this._eC && this._eC.h === hass && this._eC.k === key) return this._eC.E;
      let E = {};
      try {
        const Cls = customElements.get('msh-hjem-faner-card');
        if (Cls) {
          const p = this._probeF || (this._probeF = document.createElement('msh-hjem-faner-card'));
          p._rawConfig = c; p._config = { ...Cls.defaults, ...c }; p._hass = hass;
          p.render();
          E = p._E || {};
        }
      } catch (e) { /* */ }
      this._eC = { h: hass, k: key, E };
      return E;
    }
    // Prosa: rader (config eller standard) + synlige setninger, via en frakoblet prosa-instans.
    _prose() {
      const c = this.P(), hass = this.hass;
      try {
        const Cls = customElements.get('msh-prosa-card');
        if (!Cls) return null;
        const p = this._probeP || (this._probeP = document.createElement('msh-prosa-card'));
        p._evOnce = true;
        p._rawConfig = c; p._config = { ...Cls.defaults, ...c }; p._hass = hass;
        p.render();
        return p._R || null;
      } catch (e) { return null; }
    }
    _room(c, id) {
      const hass = this.hass, fc = fakeCard(hass, c), cfg = roomCfgOf(c, id);
      const r = M.romData ? M.romData(fc, id, cfg) : null;
      if (!r) return null;
      const base = M.romData(fc, id, { overrides: cfg.overrides });
      const rc = M.roomClimate ? M.roomClimate(hass, id, { overrides: cfg.overrides }) : null;
      const temp = rc && rc.temp.v != null ? rc.temp.v : r.temp, hum = rc && rc.hum.v != null ? rc.hum.v : r.hum;
      const rr = get(c, 'rooms.' + id) || {};
      const size = rr.size || (temp != null || r.thermo ? 'M' : 'S');
      const can = !!r.thermo && r.set != null;
      return { ...r, temp, hum, size, can, klima: can && (rr.klima ?? true), baseIcon: base ? base.icon : r.icon, baseCol: base ? base.col : r.col, fc };
    }
    _model() {
      const hass = this.hass, c = this.F();
      const T = allTabs(hass, c), KT = T.filter((t) => t.kind !== 'batterier');
      const t = KT.find((x) => x.id === this.u.ctx) || KT[0];
      if (!t) return { c, T, KT, t: null };
      const base = baseRooms(hass, c, t), hid = get(c, `layout.${t.id}.hidden`) || [];
      const vis = base.filter((a) => !hid.includes(a.id));
      const R = {};
      vis.forEach((a) => { R[a.id] = this._room(c, a.id); });
      const rooms = vis.map((a) => R[a.id]).filter(Boolean);
      const car = t.view === 'karusell', sides = {};
      let hl = 0, hr = 0;
      rooms.forEach((r, i) => {
        const h = car ? 1 : ({ S: 66, M: r.klima ? 210 : 140, L: 246 })[r.size] + 8;
        let sd = get(c, `layout.${t.id}.side.${r.id}`);
        if (!sd) sd = car || t.kind === 'aktuelt' ? (i % 2 ? 'R' : 'L') : hl <= hr ? 'L' : 'R';
        sides[r.id] = sd;
        if (sd === 'R') hr += h; else hl += h;
      });
      const E = this._E(c), avail = availKinds(E, c).filter((k) => !(t.kind === 'aktuelt' && DYN.includes(k))), hidT = get(c, `tile_hidden.${t.id}`) || [], ord = get(c, `tile_order.${t.id}`) || [];
      const en = avail.filter((k) => tileSlot(c, t, k) !== 'off' && !hidT.includes(k));
      const oi = (k) => { const i = ord.indexOf(k); return i < 0 ? 99 : i; };
      en.sort((a, b) => oi(a) - oi(b));
      const slotAll = (sl) => get(c, `swipe.${t.id}.${sl}`) ?? (t.kind === 'hjem' && sl === 'L-top');
      const stackOf = (k) => get(c, `tiles.${t.id}.${k}.stack`) ?? !!(STACK_DEF[t.kind] || {})[k];
      const stacked = (k) => { const sl = tileSlot(c, t, k); if (!slotAll(sl) && !stackOf(k)) return false; return en.filter((x) => tileSlot(c, t, x) === sl && (slotAll(sl) || stackOf(x))).length > 1; };
      return { c, T, KT, t, base, hid, vis, R, rooms, sides, car, E, avail, en, hidT, slotAll, stackOf, stacked, side: (s) => rooms.filter((r) => sides[r.id] === s), inSlot: (sl) => en.filter((k) => tileSlot(c, t, k) === sl) };
    }

    /* ---------- render */
    _schedule() { if (this._raf) return; this._raf = requestAnimationFrame(() => { this._raf = 0; this.render(); }); }
    render() {
      if (this.closed || this._drag) return;
      if (!this.hass) { this.body.innerHTML = '<div class="ed"><div class="hint">Venter på Home Assistant …</div></div>'; return; }
      const u = this.u;
      let inner = '';
      try {
        inner = u.sec === 'faner' ? this._faner() : u.sec === 'pop' ? this._pops() : u.sec === 'tekst' ? this._tekst() : this._kort();
      } catch (e) { console.error('[ki-msh] Tilpass Hjem', e); inner = `<div class="hint">Feil: ${esc(e.message)}</div>`; }
      const secs = [['kort', 'Kort', 'mdi:view-dashboard'], ['faner', 'Faner', 'mdi:tab'], ['pop', 'Popups', 'mdi:dock-window'], ['tekst', 'Tekst', 'mdi:text']];
      const html = `<div class="ed" data-key="ed">
        <div class="hd"><span class="t">Tilpass</span><button class="b40 press" data-a="cancel">Avbryt</button><button class="b40 press" data-a="reset">Nullstill</button><button class="done press" data-a="done" ${this._busy ? 'disabled aria-busy' : ''}>${this._busy ? 'Lagrer …' : 'Ferdig'}</button></div>
        ${M.openTilpassAlt ? `<button class="press" data-a="tall" data-key="tall" style="display:flex;align-items:center;gap:8px;justify-self:start;height:32px;padding:0 12px;border-radius:16px;background:var(--ki-sheet-in,#404040);color:#fafafa;font-size:13px;font-weight:500">${ic('mdi:tune', 16)}Tilpass alt ›</button>` : ''}
        <div class="seg itabs" role="tablist" data-key="secs">${secs.map(([id, l, ic]) => M.iconTabs.btn({ label: l, icon: ic }, u.sec === id, `data-a="sec" data-v="${id}" data-h="selection" data-key="sec-${id}"`, u.sec === id ? 'on-pk' : '')).join('')}</div>
        ${inner}
      </div>`;
      if (!this._first) { this.body.innerHTML = html; this._first = true; } else M.morph(this.body, html);
      this._after();
    }
    _after() {
      if (this.u.sec === 'pop' && M.popupsPanel) M.popupsPanel.after(this);
      const r = this.root;
      if (this.u.sec === 'tekst' && M.prosaPreviewScroll) M.prosaPreviewScroll(r); // 20.9: markert del synlig i forhåndsvisningen
      r.querySelectorAll('ha-icon-picker[data-in]').forEach((p) => { p.hass = this.hass; const v = p.getAttribute('data-val') || ''; if (p.value !== v) p.value = v; });
      r.querySelectorAll('msh-entity-picker').forEach((p) => { p.hass = this.hass; });
      const ct = r.querySelector('.ct');
      if (ct) { const on = ct.querySelector('.tb.on'); if (on && this._shownCt !== on.dataset.key && ct.scrollWidth > ct.clientWidth + 2) { this._shownCt = on.dataset.key; ct.scrollLeft = Math.max(0, on.offsetLeft - 24); } }
    }
    _sw(on, big, dis) { return `<span class="trk ${on ? 'on' : ''} ${big ? 'big' : ''} ${dis ? 'off' : ''}"></span>`; }

    /* ======================================================== Kort */
    _kort() {
      const m = this._model(), u = this.u, c = m.c;
      if (!m.t) return '<div class="hint">Fant ingen faner – legg til områder i Home Assistant.</div>';
      const t = m.t;
      this.u.ctx = t.id;
      const n = m.KT.length, idx = Math.max(0, m.KT.indexOf(t));
      const h = c.tab_height === 'custom' ? Number(c.tab_height_px) || 38 : TAB_H[c.tab_height || 'std'] || 38;
      const cols = c.tab_width === 'custom' ? `repeat(${n}, ${Number(c.tab_width_px) || 88}px)` : `repeat(${n}, minmax(0, 1fr))`;
      const pad = c.tab_width === 'custom' ? '0 6px' : c.tab_width === 'kompakt' ? '0 12px' : '0 18px';
      const strip = `<div class="ct" data-key="ct"><div class="tg" style="grid-template-columns:${cols}">
          <span class="ind" style="left:${(idx / n) * 100}%;width:${100 / n}%"></span>
          ${m.KT.map((x, i) => `<span class="tb ${i === idx ? 'on' : ''} ${x.hidden ? 'dim' : ''}" data-a="ctx" data-v="${esc(x.id)}" data-i="${i}" data-h="selection" data-key="ct-${esc(x.id)}" style="height:${h}px;padding:${pad}">${esc(x.label)}</span>`).join('')}
        </div></div>`;
      const tgl = `<button class="tgl" data-a="tabvis" data-h="selection">${t.hidden ? 'Fanen er skjult i fanelinjen' : 'Fanen vises i fanelinjen'}${this._sw(!t.hidden)}</button>`;
      // selektert element må finnes
      if (u.sel && u.sel.t === 'room' && !m.rooms.some((r) => r.id === u.sel.id)) u.sel = null;
      if (u.sel && u.sel.t === 'tile' && !m.en.includes(u.sel.id)) u.sel = null;
      const grid = `<div class="gr" data-key="gr-${esc(t.id)}">${['L', 'R'].map((sd) => this._col(m, sd)).join('')}</div>`;
      let panel = '';
      if (u.pick) panel = this._pickPanel(m);
      else if (u.sel && u.sel.t === 'room') panel = this._roomPanel(m, m.rooms.find((r) => r.id === u.sel.id));
      else if (u.sel && u.sel.t === 'tile' && !u.sel.z) panel = this._tilePanel(m, u.sel.id);
      if (M.hjemIsAkt ? M.hjemIsAkt(t) : t.kind === 'aktuelt') return strip + tgl + this._aktPanel(m) + this._accRomIkon(m) + this._blocks(); // 20.13: ingen rom-kolonner / «+ rom»
      const hint = `<span class="hint">Dra kort og snarveier for å flytte dem, også mellom kolonnene. Trykk for å endre, eller + for å ${t.hc ? 'legge til et rom eller en snarvei' : 'hente et rom fra en annen etasje'}.</span>`;
      const fillT = t.kind === 'floor' || t.kind === 'andre' ? `<button class="tgl" data-a="tabfill" data-h="selection">Autofyll fra HA-etasjen${this._sw(get(c, `tabs.${t.id}.auto_fill`) !== false)}</button>` : '';
      const hjem = t.kind === 'hjem' ? this._hcTools(m) : '';
      return strip + tgl + fillT + grid + panel + hint + hjem + (m.car ? this._accSwipe(m) : '') + this._accSnar(m) + this._accRomIkon(m) + (M.romkortPillPanel ? M.romkortPillPanel.html(this) : '') + this._blocks() + (t.kind === 'hjem' ? this._hcSuggest(m) : '');
    }
    /* ---------- Hjem: kuratert (fiks 15.10) */
    // «Legg til» (søk blant rom, snarveier og entiteter) + «Tilbakestill til forslag» (med bekreftelse).
    _hcTools(m) {
      const u = this.u, t = m.t, hass = this.hass, c = m.c;
      const info = t.hc ? `Hjem er kuratert · ${m.rooms.length} rom og ${m.en.length} snarveier. Fjernede kort kommer ikke tilbake av seg selv.` : 'Hjem fylles automatisk med alle rom (tidligere oppsett). «Tilbakestill til forslag» gir en kuratert forside.';
      let search = '';
      if (u.hcAdd) {
        const q = String(u.hcQ || '').trim(), nq = q.toLowerCase(), has = new Set(t.hc ? t.hc.cards : [...m.vis.map((a) => 'rom:' + a.id), ...m.en]);
        const rooms = M.areas(hass).filter((a) => !has.has('rom:' + a.id) && (!nq || (a.name + ' ' + a.id).toLowerCase().includes(nq))).slice(0, 8);
        const kinds = m.avail.filter((k) => !has.has(k) && (!nq || (kindLabel(k, c) + ' ' + k).toLowerCase().includes(nq)));
        const DOM = { lock: 'lock', alarm_control_panel: 'alarm', camera: 'cam', todo: 'todo', vacuum: 'vacr', media_player: 'tv', cover: 'garage' };
        const ents = q && M.entitySearch ? M.entitySearch(hass, q, { domains: Object.keys(DOM) }).slice(0, 6) : [];
        const row = (a, v, icn, col, title, sub) => `<button class="pkc press" data-a="hcadd" data-v="${esc(v)}" style="justify-content:flex-start">${ic(icn, 18, `color:${col}`)}<span style="display:flex;flex-direction:column;align-items:flex-start;min-width:0"><span>${esc(title)}</span>${sub ? `<span style="font-size:11px;color:#c7c7c7;font-weight:400">${esc(sub)}</span>` : ''}</span></button>`;
        search = `<div class="pnl pk" data-key="hcadd">
          <div class="srch">${ic('search', 18, 'color:#7f7f7f')}<input data-in="hcq" value="${esc(u.hcQ || '')}" placeholder="Søk blant rom og enheter …"></div>
          ${rooms.length ? `<span class="pks">Rom</span><div class="chs">${rooms.map((a) => { const r = this._room(c, a.id) || { icon: a.icon || 'mdi:texture-box', col: C.white }; return row(a, 'rom:' + a.id, r.icon, r.col, a.name, a.floorName || ''); }).join('')}</div>` : ''}
          ${kinds.length ? `<span class="pks">Snarveier og enheter</span><div class="chs">${kinds.map((k) => row(null, k, kindIcon(k, c), '#afafaf', kindLabel(k, c), '')).join('')}</div>` : ''}
          ${ents.length ? `<span class="pks">Entiteter</span><div class="chs">${ents.map((x) => row(null, 'ent:' + x.id, M.domainIcon ? M.domainIcon(x.id, hass.states[x.id]) : 'mdi:link', '#afafaf', x.name, x.id)).join('')}</div>` : ''}
          ${!rooms.length && !kinds.length && !ents.length ? '<span style="font-size:13px;color:#7f7f7f">Ingen treff</span>' : ''}
        </div>`;
      }
      return `<div class="box" data-key="hctools"><span style="display:flex;flex-direction:column;gap:2px"><span class="lb">Kort på Hjem-fanen</span><span class="sub">${esc(info)}</span></span>
          <div class="chs"><button class="o34 press ${u.hcAdd ? 'on-pk' : ''}" data-a="hcaddopen">${ic('add', 16)} Legg til</button>
          <button class="o34 press" data-a="hcreset" data-h="${u.hcConfirm ? 'warning' : 'light'}" style="${u.hcConfirm ? 'color:rgb(242 128 115);box-shadow:inset 0 0 0 1.5px rgb(242 128 115)' : ''}">${u.hcConfirm ? 'Trykk igjen for å tilbakestille' : 'Tilbakestill til forslag'}</button></div></div>${search}`;
    }
    // «Forslag»: nye rom og enheter i HA som ikke er på Hjem (og ikke fjernet før) – nederst i editoren.
    _hcSuggest(m) {
      const hc = m.t.hc, c = m.c, hass = this.hass;
      if (!hc || !hc.suggest.length) return '';
      const rows = hc.suggest.map((x) => {
        const room = /^rom:/.test(x), a = room ? M.areas(hass).find((y) => y.id === x.slice(4)) : null;
        const r = room ? this._room(c, x.slice(4)) : null;
        const icn = room ? (r ? r.icon : 'mdi:texture-box') : kindIcon(x, c), nm = room ? (a ? a.name : x.slice(4)) : kindLabel(x, c);
        return `<div class="tr" data-key="sg-${esc(x)}"><span class="tm">${ic(icn, 22, room && r ? `color:${r.col}` : '')}<span class="tt"><b>${esc(nm)}</b><i>${room ? 'Nytt rom' : 'Ny enhet'}</i></span></span>
          <button class="o34 press" data-a="hcadd" data-v="${esc(x)}">+ Legg til</button><button class="sq" data-a="hcno" data-v="${esc(x)}" title="Ikke foreslå igjen">${ic('close', 18)}</button></div>`;
      }).join('');
      return `<div class="box t6" data-key="hcsug"><span style="display:flex;justify-content:space-between;align-items:baseline;padding:2px 4px 4px"><span class="lb">Forslag</span><span style="font-size:12px;color:#979797">${hc.suggest.length} nye</span></span>${rows}</div>`;
    }
    // Aktuelt: dynamisk – velg hvilke typer som kan dukke opp (tabs.aktuelt.types), ikke enkeltkort.
    _aktPanel(m) {
      const on = M.aktTypes ? M.aktTypes(m.c) : [], T = (M.AKT_TYPES || []).filter(([k]) => k !== 'lights'); // 20.13: «Lys på i tomt rom» ga bare romkort
      return `<div class="box t6" data-key="aktnorom" style="flex-direction:row;align-items:center;gap:10px">${ic('mdi:information-outline', 20, 'color:#979797;flex:none')}<span class="sub" style="line-height:1.4">Aktuelt viser ikke rom, bare kort som er aktive nå.</span></div>
        <div class="box t6" data-key="akttypes"><span style="display:flex;flex-direction:column;gap:2px;padding:2px 4px 4px"><span class="lb">Vises når det er aktuelt</span><span class="sub">Kortene dukker opp av seg selv og forsvinner når de ikke lenger er aktuelle.</span></span>
          ${T.map(([k, l, icn]) => `<button class="tgl" data-a="akttype" data-v="${k}" data-h="selection" data-key="akt-${k}" style="background:var(--gray100,#2f2f2f)"><span style="display:flex;align-items:center;gap:10px">${ic(icn, 20, `color:${on.includes(k) ? '#fafafa' : '#696969'}`)}${esc(l)}</span>${this._sw(on.includes(k))}</button>`).join('')}</div>`;
    }
    // Kortene på Hjem (msh-hjem-card): øye per kort (cards skjules via hidden), gjøremål via show_todo.
    _blocks() {
      const H = this.H() || {}, hid = Array.isArray(H.hidden) ? H.hidden : [], todo = H.show_todo !== false;
      const on = (k) => (k === 'gjoremal' ? todo : !hid.includes(k));
      const n = BLOCKS.filter(([k]) => on(k)).length;
      const PAN = { soppel: () => this._trashPanel() }; // 24.4: oppsett-register for kortene på Hjem (nøkkel = blokk-nøkkelen)
      const rows = BLOCKS.map(([k, l, icn]) => { const ed = PAN[k] && this.u.blk === k;
        return `<div class="tr ${on(k) ? '' : 'hid'}" data-key="blk-${k}"><span class="tm" ${PAN[k] ? `data-a="blked" data-v="${k}" style="cursor:pointer"` : ''}>${ic(icn, 22, `color:${on(k) ? '#fafafa' : '#696969'}`)}<span class="tt"><b>${esc(l)}</b><i>${on(k) ? 'Vises' : 'Skjult'}${k === 'gjoremal' ? ' · show_todo' : ''}</i></span></span>
          ${PAN[k] ? `<button class="sq" data-a="blked" data-v="${k}" title="Oppsett" aria-expanded="${!!ed}">${ic(ed ? 'expand_less' : 'expand_more', 20, 'color:#979797')}</button>` : ''}
          <button class="sq" data-a="blkeye" data-v="${k}" data-h="selection" title="${on(k) ? 'Skjul' : 'Vis'}">${ic(on(k) ? 'visibility' : 'visibility_off', 18, `color:${on(k) ? '#fafafa' : '#696969'}`)}</button></div>${ed ? PAN[k]() : ''}`; }).join('');
      return `<div class="box t6" data-key="blocks"><span style="display:flex;justify-content:space-between;align-items:baseline;padding:2px 4px 4px"><span class="lb">Kort på Hjem</span><span style="font-size:12px;color:#979797">${n} av ${BLOCKS.length} vises</span></span>
          <button class="tgl" data-a="showtodo" data-h="selection" style="background:var(--gray100,#2f2f2f)">Vis gjøremål${this._sw(todo)}</button>
          ${rows}</div>`;
    }
    /* ---------- 24.4 · «Søppelkort på Hjem» (Hjem v3 · ce.popTrash / TRASH_ACTS / trashCfg). Lagres i søppelkortets
     * config (card_id M.CARD_IDS.soppel): tap_action, hold_action (20.2-formatet, M.hjemTrashAct), sensor, type_sensor –
     * samme felt som kortets GUI-editor (msh-soppel-card-schemaet). Autoforslag: entiteter med søppel/avfall/renovasjon/waste. */
    _trashPanel() {
      const c = this.S() || {}, hass = this.hass, st = (hass && hass.states) || {};
      const cur = (kind) => { const a = c[kind]; if (a && typeof a === 'object' && a.action) return M.tap ? M.tap.norm(a) : a; return kind === 'tap_action' && c.popup_hash ? { action: 'navigate', navigation_path: c.popup_hash } : null; };
      const modes = ['std', 'popup', 'hash', 'path', 'url', 'more', 'service', 'none'];
      const tp = (kind, lab, icn, std) => `<div class="tap" data-key="tr-tp-${kind}"><span class="th">${ic(icn, 20, 'color:#afafaf')}${esc(lab)}</span>
          ${M.tap ? M.tap.html({ key: 'tr-tpk-' + kind, value: cur(kind), modes, labels: { path: 'Naviger', service: 'Tjeneste' }, stdHint: std, attrs: `data-in="trtap" data-w="${kind}"` }) : ''}</div>`;
      const RE = /s(ø|o)ppel|avfall|renovasjon|waste|garbage|trash/i;
      const sugg = (doms, cur2) => Object.keys(st).filter((id) => doms.includes(id.split('.')[0]) && id !== cur2 && RE.test(id + ' ' + ((st[id].attributes || {}).friendly_name || ''))).sort().slice(0, 6);
      const chips = (f, doms) => { const L = sugg(doms, c[f]); return L.length ? `<div class="chs" data-key="tr-sg-${f}">${L.map((id) => `<button class="o34 press" data-a="trsug" data-f="${f}" data-v="${esc(id)}" title="${esc(id)}">${ic('mdi:auto-fix', 16)}${esc(M.name(hass, id))}</button>`).join('')}</div>` : ''; };
      const auto = hass && st['sensor.neste_tomming'] ? 'sensor.neste_tomming' : M.hjemTrashAuto ? M.hjemTrashAuto(hass) : '';
      const as = auto && st[auto];
      const pk = (f, doms, lab, a) => `<div class="fld"><span class="fl">${esc(lab)}</span>${M.entityPicker ? M.entityPicker.html({ key: 'tr-pk-' + f, value: c[f] || '', auto: a || '', autoMode: f === 'sensor', autoLabel: f === 'sensor' ? `Automatisk (${as ? as.attributes.friendly_name || auto : auto || 'fant ingen'})` : '', domains: doms, placeholder: f === 'sensor' ? 'Velg entitet' : 'Ingen (valgfri)', attrs: `data-in="trent" data-f="${f}"` }) : ''}${chips(f, doms)}</div>`;
      const noS = !c.sensor && !auto;
      return `<div class="ted" data-key="tr-ed">
          <span style="display:flex;flex-direction:column;gap:2px;padding:2px 4px"><span class="lb">Søppelkort på Hjem</span><span class="sub">Velg hva trykk og hold gjør, og hvilke sensorer kortet viser.${noS ? ' Uten sensor viser kortet «–» og «Velg entitet».' : ''}</span></span>
          ${tp('tap_action', 'Trykk', 'touch_app', 'Standard: åpner popupen #soppel')}
          ${tp('hold_action', 'Hold', 'mdi:gesture-tap-hold', 'Standard: more-info for sensoren')}
          ${pk('sensor', ['sensor'], 'Sensor · dager til tømming', auto)}
          ${pk('type_sensor', ['sensor', 'input_text', 'input_select'], 'Sensor · type avfall (valgfri)', '')}
        </div>`;
    }
    _col(m, sd) {
      const u = this.u, top = m.inSlot(sd + '-top'), bot = m.inSlot(sd + '-bottom'), rooms = m.side(sd);
      const hdr = (g, label, has) => `<span class="gh ${has ? '' : 'eh'}" data-drop="hdr:${sd}:${g}" data-key="gh-${sd}-${g}">${label}</span>`;
      return `<div class="gc" data-drop="col:${sd}" data-key="gc-${sd}"><span class="gct">${sd === 'L' ? 'Venstre' : 'Høyre'}</span>
        ${hdr('top', 'Over rom', top.length)}${top.map((k) => this._tileIt(m, k)).join('')}
        ${hdr('rom', 'Rom', rooms.length)}${rooms.map((r) => this._roomIt(m, r)).join('')}
        ${hdr('bottom', 'Under rom', bot.length)}${bot.map((k) => this._tileIt(m, k)).join('')}
        <button class="add ${u.pick === sd ? 'on' : ''}" data-a="pick" data-v="${sd}" data-key="add-${sd}" title="Legg til">${ic('mdi:plus', 20)}</button></div>`;
    }
    _roomIt(m, r) {
      const u = this.u, on = u.sel && u.sel.t === 'room' && u.sel.id === r.id, sz = r.size, kl = r.klima && sz !== 'S';
      const st = `height:${SZH[sz]}px;border-radius:${sz === 'S' ? 18 : 16}px;justify-content:${sz === 'S' ? 'center' : 'flex-start'};gap:4px;padding:${sz === 'S' ? '0 8px 0 10px' : '9px 8px 9px 10px'};background:var(--gray200,#3a3a3a);box-shadow:${on ? `inset 0 0 0 2px ${PK}` : 'none'}`;
      const bi = sz === 'S' ? 'crop_16_9' : sz === 'L' ? 'crop_portrait' : 'crop_square';
      const deg = (v) => (v == null ? '–' : M.nf(Math.round(v * 10) / 10, (Math.round(v * 10) / 10) % 1 ? 1 : 0));
      const big = sz !== 'S' ? `<span style="flex:1"></span><span class="tv"><span class="b num" style="font-size:${sz === 'L' ? 26 : 20}px">${r.temp != null ? deg(r.temp) + '°' : '–'}</span><span class="s num">${r.hum != null ? M.nf(r.hum, 0) + ' %' : ''}</span></span>` : '';
      return `<button class="it" data-drag="room" data-id="${esc(r.id)}" data-side="${m.sides[r.id]}" data-drop="room:${esc(r.id)}" data-a="selroom" data-v="${esc(r.id)}" data-key="r-${esc(r.id)}" style="${st}">
        <span class="l1">${ic(r.icon, 16, `color:${r.col}`)}<span class="nm">${esc(r.name)}</span><span class="bdg">${ic(bi, 12)}${SZ[sz]}${kl ? ' · klima' : ''}</span></span>${big}</button>`;
    }
    _tileIt(m, k) {
      const u = this.u, c = m.c, on = u.sel && u.sel.t === 'tile' && u.sel.id === k, st = m.stacked(k), so = seasonOk(c, m.t, k);
      const bg = st ? 'linear-gradient(90deg, rgb(242 133 201 / 0.08), var(--gray100,#2f2f2f) 60%)' : 'var(--gray100,#2f2f2f)';
      const sh = on ? `inset 0 0 0 2px ${PK}` : st ? 'inset 0 0 0 1px rgb(242 133 201 / 0.3)' : 'inset 0 0 0 1px rgba(255,255,255,0.12)';
      const badge = st ? `<span class="bdg sw">${ic('mdi:gesture-swipe-horizontal', 12)}Swipe</span>` : !so ? `<span class="bdg ss">${ic('mdi:calendar', 12)}Sesong</span>` : '';
      const sub = this._tileSub(m, k); // 17.11: undertekst (neste avgang, «Ingen bevegelse», «36 gjøremål» …)
      return `<button class="it" data-drag="tile" data-id="${esc(k)}" data-drop="tile:${esc(k)}" data-a="seltile" data-v="${esc(k)}" data-key="t-${esc(k)}" style="height:${sub ? 46 : 38}px;border-radius:${sub ? 23 : 19}px;justify-content:center;gap:${sub ? 1 : 6}px;padding:0 8px 0 10px;background:${bg};box-shadow:${sh}">
        <span class="l1">${ic(kindIcon(k, c), 16, 'color:#afafaf')}<span class="nm">${esc(kindLabel(k, c))}</span>${badge}</span>${sub ? `<span class="tsub">${esc(sub)}</span>` : ''}</button>`;
    }
    // Flis-modellen fra en frakoblet faner-instans (samme tekst som på Hjem). Tittel + undertekst i én linje når tittelen er en verdi.
    _tileModelOf(m, k) {
      const p = this._probeF, Cls = customElements.get('msh-hjem-faner-card');
      if (!p || !Cls || !p._tileModel) return null;
      try { p._config = { ...Cls.defaults, ...m.c }; p._hass = this.hass; return p._tileModel(k, m.E || {}); } catch (e) { return null; }
    }
    _tileSub(m, k) {
      const t = this._tileModelOf(m, k);
      if (!t) return '';
      const nm = kindLabel(k, m.c);
      if (t.type === 'ruter' || t.type === 'cam') return t.sub || '';
      if (t.type === 'todo') return t.title || '';
      return [t.title && t.title !== nm && t.title !== '–' ? t.title : '', t.sub && t.sub !== nm ? t.sub : ''].filter(Boolean).join(' · ');
    }
    _pickPanel(m) {
      const sd = this.u.pick, c = m.c, hass = this.hass, t = m.t;
      const inBase = m.base.map((a) => a.id);
      const hiddenIds = m.base.filter((a) => m.hid.includes(a.id)).map((a) => a.id);
      const other = ['floor', 'custom', 'andre'].includes(t.kind) || t.hc ? M.areas(hass).filter((a) => !inBase.includes(a.id)).map((a) => a.id) : [];
      const list = [...hiddenIds, ...other];
      const chipR = (id) => { const a = M.areas(hass).find((x) => x.id === id) || { name: id }, r = this._room(c, id) || { icon: a.icon, col: C.white };
        const nm = t.kind === 'floor' && a.floor !== t.floor && a.floorName ? `${a.name} · ${a.floorName}` : a.name;
        return `<button class="pkc press" data-a="addroom" data-v="${esc(id)}">${ic(r.icon, 18, `color:${r.col}`)}${esc(nm)}</button>`; };
      const offK = m.avail.filter((k) => !m.en.includes(k));
      return `<div class="pnl pk" data-key="pick">
        <span class="pkt">Legg rom i ${sd === 'L' ? 'venstre' : 'høyre'} kolonne · også fra andre etasjer</span>
        <div class="chs">${list.map(chipR).join('')}</div>
        ${list.length ? '' : '<span style="font-size:13px;color:#7f7f7f">Alle rom er allerede plassert på denne fanen</span>'}
        <span class="pks">Snarveier</span>
        <div class="chs">${offK.map((k) => `<button class="pkc press" data-a="addtile" data-v="${esc(k)}">${ic(kindIcon(k, c), 18, 'color:#afafaf')}${esc(kindLabel(k, c))}</button>`).join('')}
          <button class="pkc press" data-a="addlink">${ic('mdi:link-variant', 18, 'color:#afafaf')}Ny snarvei (lenke)</button></div>
      </div>`;
    }
    _roomPanel(m, r) {
      if (!r) return '';
      const sd = m.sides[r.id], ids = m.side(sd).map((x) => x.id), i = ids.indexOf(r.id), sz = r.size, can = r.can && sz !== 'S', kl = can && r.klima;
      const note = !r.thermo || r.set == null ? 'Ingen termostat i rommet' : sz === 'S' ? 'Kun på medium og store kort' : kl ? 'Vises på kortet' : 'Skjult';
      return `<div class="pnl" data-key="rp-${esc(r.id)}">
        <div class="ph">${ic(r.icon, 24, `color:${r.col}`)}<span class="n">${esc(r.name)}</span><button class="red press" data-a="rhide">${ic(m.t.hc ? 'mdi:close' : 'mdi:eye-off', 18)}${m.t.hc ? 'Fjern' : 'Skjul'}</button></div>
        <div class="ln"><span class="lb">Plassering</span><div style="display:flex;gap:6px"><div class="ud"><button data-a="rmove" data-v="-1" title="Flytt opp" ${i > 0 ? '' : 'style="opacity:.35"'}>${ic('expand_less', 20)}</button><button data-a="rmove" data-v="1" title="Flytt ned" ${i < ids.length - 1 ? '' : 'style="opacity:.35"'}>${ic('expand_more', 20)}</button></div><button class="b36 press" data-a="rswap">${ic('swap_horiz', 18)}Bytt side</button></div></div>
        <div class="ln"><span class="lb">Størrelse</span><div class="ss">${['S', 'M', 'L'].map((z) => `<button class="${sz === z ? 'on-pk' : ''}" data-a="rsize" data-v="${z}" data-h="selection">${SZ[z]}</button>`).join('')}</div></div>
        <div class="ln"><span class="lb2"><span class="lb">Klima-knapp</span><span class="sub">${note}</span></span><button data-a="rklima" data-h="selection" ${can ? '' : 'disabled'}>${this._sw(kl, true, !can)}</button></div>
        <div class="sep">${this._look(m, r)}</div>
        <div class="sep">${this._badges(m, r)}</div>
      </div>`;
    }
    _look(m, r) {
      const u = this.u, rr = get(m.c, 'rooms.' + r.id) || {}, has = !!(rr.icon || rr.color);
      const q0 = u.icQ || '', q = q0.toLowerCase().trim();
      const hits = q ? ROOM_ICONS.filter(([n, kw]) => n.includes(q) || kw.includes(q)) : ROOM_ICONS.slice(0, 16);
      const slug = q.indexOf(':') > 0 ? q.replace(/\s+/g, '') : q ? 'mdi:' + q.replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') : '';
      const col = r.col, custom = !!rr.color && !COLS.some((x) => sameCol(x, rr.color));
      const noteT = has ? 'Overstyrt · ' + (rr.icon ? rr.icon : 'standard ikon') + (rr.color ? ' · egen farge' : '') : 'Standard fra rommet · ' + r.name;
      const allIc = u.allIc ? (customElements.get('ha-icon-picker')
        ? `<ha-icon-picker data-in="icpick" data-val="${esc(rr.icon || '')}" data-nomorph data-key="icpick"></ha-icon-picker>`
        : `<input class="in s" data-in="iconraw" value="${esc(rr.icon || '')}" placeholder="mdi:… / phu:… / hue:…">`) : '';
      const allCol = u.allCol ? `<div class="allc">${ALLCOLS().map(([v, hex, l]) => `<button class="${sameCol(v, rr.color) ? 'on' : ''}" data-a="lookcol" data-v="${esc(v)}" title="${esc(l)}" style="background:${M.color(v, hex)}"></button>`).join('')}</div>` : '';
      return `<div class="ph" style="gap:10px"><span class="pv" style="background:${col}">${ic(r.icon, 22)}</span>
          <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:1px"><span class="ttl">Ikon og farge</span><span class="note">${esc(noteT)}</span></span>
          ${has ? '<button class="std" data-a="lookreset">Standard</button>' : ''}</div>
        <div class="srch">${ic('search', 18, 'color:#7f7f7f')}<input data-in="icq" value="${esc(q0)}" placeholder="Søk ikon – sofa, seng, bad, garasje …"></div>
        <div class="icg">${hits.slice(0, 24).map(([x]) => `<button data-a="lookicon" data-v="${esc(x)}" title="${esc(x)}" style="${x === r.icon ? `background:${col};color:#232323` : ''}">${ic(x, 18)}</button>`).join('')}</div>
        ${slug && !hits.some((x) => x[0] === slug) ? `<button class="useq" data-a="lookicon" data-v="${esc(slug)}">${ic(slug, 18)}Bruk «${esc(q0)}» som ikon</button>` : ''}
        <div class="cols">${COLS.map((x) => `<button class="cl ${sameCol(x, rr.color) || (!rr.color && sameCol(x, r.baseCol)) ? 'on' : ''}" data-a="lookcol" data-v="${esc(x)}" title="${esc(x)}" style="background:${M.color(x, x)}"></button>`).join('')}
          <label class="cw" title="Egen farge" style="background:${custom ? col : 'conic-gradient(rgb(242 128 115), rgb(242 210 111), rgb(102 209 158), rgb(115 185 242), rgb(173 153 230), rgb(242 133 201), rgb(242 128 115))'};${custom ? 'box-shadow:0 0 0 3px #2f2f2f,0 0 0 5px #fafafa' : ''}">${ic('colorize', 16)}<input type="color" data-in="lookhex" value="${toHex(col)}"></label></div>
        <div class="chs"><button class="b34 ${u.allIc ? 'on' : ''}" data-a="allic">${ic('apps', 16)}Alle ikoner · mdi, phu …</button><button class="b34 ${u.allCol ? 'on' : ''}" data-a="allcol">${ic('palette', 16)}Tema- og HA-farger</button></div>
        ${allIc}${allCol}`;
    }
    _badges(m, r) {
      const rr = get(m.c, 'rooms.' + r.id) || {}, own = !!rr.badges_own, R = rr.badges || {}, keys = Object.keys(R).sort();
      const rules = own ? keys.map((k) => [k, R[k]]).filter(([, x]) => x && x.type && x.type !== 'off') : (M.romBadgeDefaults ? M.romBadgeDefaults(r) : []).map((x, i) => ['d' + i, x]);
      const hit = (x) => { try { return M.romBadgeHit(r.fc, x, r); } catch (e) { return false; } };
      const NUMB = ['temp', 'hum', 'price', 'watt', 'lightsN', 'entNum'], ENT = ['entState', 'entNum', 'door', 'temp', 'hum', 'light', 'unlocked', 'ent', 'alarmOff'];
      const row = ([k, x]) => {
        const T = (M.BADGE_TYPES || []).find((b) => b[0] === x.type) || [x.type, x.type, 'rule', ''], on = hit(x), dis = own ? '' : 'disabled';
        const ops = x.type === 'entState' ? [['=', 'Er'], ['!=', 'Er ikke']] : [['>', 'Over'], ['<', 'Under'], ['=', 'Er']];
        return `<div class="rule" data-key="br-${esc(k)}"><div class="rh">
            <div class="rsel">${ic(T[2], 18, 'color:#afafaf')}<span>${esc(T[1])}</span>${ic('expand_more', 18, 'color:#979797')}<select data-in="btype" data-k="${esc(k)}" ${dis}>${(M.BADGE_TYPES || []).map((b) => `<option value="${b[0]}" ${b[0] === x.type ? 'selected' : ''}>${esc(b[1])}</option>`).join('')}</select></div>
            <span class="live ${on ? 'on' : ''}">${on ? 'Vises nå' : 'Skjult nå'}</span>
            ${own ? `<button class="dz34" data-a="bdel" data-k="${esc(k)}" title="Fjern">${ic('delete', 18)}</button>` : ''}</div>
          ${NUMB.includes(x.type) || x.type === 'entState' ? `<div style="display:flex;align-items:center;gap:6px"><div class="ss sm">${ops.map(([o, l]) => `<button class="${(x.op || (x.type === 'entState' ? '=' : '>')) === o ? 'on-pk' : ''}" data-a="bop" data-k="${esc(k)}" data-v="${esc(o)}" ${dis}>${l}</button>`).join('')}</div>
            <input class="in s" style="flex:1;text-align:center" data-in="bval" data-k="${esc(k)}" value="${esc(x.val ?? '')}" ${dis} placeholder="${x.type === 'entState' ? 'on, open' : '0'}"><span style="font-size:12px;color:#979797;flex:none">${esc(T[3] || '')}</span></div>` : ''}
          ${own && ENT.includes(x.type) ? `<input class="in s" data-in="bent" data-k="${esc(k)}" value="${esc(x.ent || '')}" placeholder="${['ent', 'entNum', 'entState'].includes(x.type) ? 'entity_id' : 'Kilde (tom = standard fra rommet)'}">` : ''}
          <input class="in s" data-in="btext" data-k="${esc(k)}" value="${esc(x.text || '')}" placeholder="Tekst i varselet" ${dis}></div>`;
      };
      return `<div class="ln"><span class="lb2"><span class="ttl">Varsler på rommet</span><span class="sub">${own ? `Egne vilkår · ${rules.length} stk` : `Standard · ${rules.length} stk`}</span></span>
          <button data-a="bown" data-h="selection">${this._sw(own)}</button></div>
        ${rules.map(row).join('')}
        ${own ? `<button class="o44 press" data-a="badd">${ic('add', 20)}Legg til vilkår</button>` : ''}
        <span class="sub" style="line-height:1.4">Første vilkår som slår til vises som varsel på rommet. Ingen vilkår = aldri varsel.</span>`;
    }
    _tilePanel(m, k, only) {
      const c = m.c, t = m.t, sl = tileSlot(c, t, k), [sd, pos] = sl.split('-'), grp = m.inSlot(sl), i = grp.indexOf(k), link = !KINDS[k];
      const P = `tiles.${t.id}.${k}`, st = m.stackOf(k), stk = m.stacked(k);
      const L = link ? (c.links || {})[k] || {} : null;
      const fra = get(c, P + '.fra') ?? (k === 'jul' ? '11-01' : ''), til = get(c, P + '.til') ?? (k === 'jul' ? '03-01' : '');
      const linkEd = link ? `
        <div class="fld"><span class="fl">Tittel</span><input class="in" data-in="ltitle" value="${esc(L.title || '')}" placeholder="Tittel"></div>
        <div class="fld"><span class="fl">Undertekst</span><input class="in" data-in="lsub" value="${esc(L.sub || '')}" placeholder="F.eks. {sensor.nordpool_kwh} nå"></div>
        <div class="fld"><span class="fl">Ikon · mdi:, phu:, hue: …</span>${M.iconPicker ? M.iconPicker.html({ key: 'lic-' + k, value: L.icon || '', placeholder: 'mdi:star', label: 'Ikon', attrs: 'data-in="licon" style="--msh-if-bg:var(--gray000,#232323)"' }) : `<div style="display:flex;gap:8px;align-items:center"><span class="pv2" style="background:var(--gray000,#232323);color:#fafafa">${ic(L.icon || 'mdi:star', 22)}</span><input class="in" style="flex:1" data-in="licon" value="${esc(L.icon || '')}" placeholder="mdi:star"></div>`}</div>
        <div class="fld"><span class="fl">Farge</span><div style="display:flex;gap:10px;flex-wrap:wrap;padding:2px">${TSW.map(([v, col, l]) => `<button class="sw34 ${(L.color || 'ingen') === v ? 'on' : ''}" data-a="lcolor" data-v="${v}" title="${l}" style="background:${col}"></button>`).join('')}</div></div>
        <div class="fld"><span class="fl">Trykk på kortet åpner popup</span>${M.popupPicker ? M.popupPicker.html({ key: 'lph-' + k, value: L.hash || '', label: 'Trykk på kortet åpner popup', attrs: 'data-in="lhash" style="--msh-if-bg:var(--gray000,#232323)"' }) : `<input class="in" data-in="lhash" value="${esc(L.hash || '')}" placeholder="#strom">`}</div>
        <div class="fld"><span class="fl">Entitet (ikon-trykk / mer info)</span><input class="in" data-in="lent" value="${esc(L.entity || '')}" placeholder="light.stue"></div>
        <div class="fld"><span class="fl">Trykk på ikonet</span><select class="in" data-in="lact">${[['toggle', 'Veksle entitet'], ['popup', 'Åpne popup'], ['more', 'Mer info'], ['none', 'Ingen']].map(([v, l]) => `<option value="${v}" ${(L.act || 'toggle') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>` : this._tileEdFields(m, k, 'p') + this._tileEdExtra(m, k, 'p');
      if (only) return linkEd; // 17.10: feltene i sone-editoren
      return `<div class="pnl" data-key="tp-${esc(k)}">
        <div class="ph">${ic(kindIcon(k, c), 24, 'color:#afafaf')}<span class="n">${esc(kindLabel(k, c))}</span><button class="red press" data-a="thide">${ic(t.hc ? 'mdi:close' : 'mdi:eye-off', 18)}${t.hc ? 'Fjern' : 'Skjul'}</button></div>
        <div class="ln"><span class="lb">Plassering</span><div style="display:flex;gap:6px"><div class="ud"><button data-a="tmove" data-v="-1" title="Flytt opp" ${i > 0 ? '' : 'style="opacity:.35"'}>${ic('expand_less', 20)}</button><button data-a="tmove" data-v="1" title="Flytt ned" ${i < grp.length - 1 ? '' : 'style="opacity:.35"'}>${ic('expand_more', 20)}</button></div><button class="b36 press" data-a="tswap">${ic('swap_horiz', 18)}Bytt side</button></div></div>
        <div class="ln"><span class="lb">Over eller under rommene</span><div class="ss">${[['top', 'Over'], ['bottom', 'Under']].map(([v, l]) => `<button class="${pos === v ? 'on-pk' : ''}" data-a="tpos" data-v="${v}" data-h="selection">${l}</button>`).join('')}</div></div>
        <div class="ln"><span class="lb2"><span class="lb">Swipe</span><span class="sub">${stk ? 'Sveipes sammen med andre i samme plass' : m.slotAll(sl) ? 'Alle i plassen sveipes' : 'Sveip sammen med andre i samme plass'}</span></span><button data-a="tstack" data-h="selection">${this._sw(st || m.slotAll(sl), true)}</button></div>
        <div class="fld"><span class="fl">Vis bare i perioden · MM-DD, tomt = alltid</span><div class="g2"><input class="in" data-in="tfra" value="${esc(fra)}" placeholder="Fra, f.eks. 11-01"><input class="in" data-in="ttil" value="${esc(til)}" placeholder="Til, f.eks. 03-01"></div></div>
        ${linkEd}
      </div>`;
    }
    /* ---------- fiks 16.11 · rad-editor for innebygde fliser: entitet, navn, ikon, undertekst og fire handlinger */
    // Felt for flis k (typen eller ekstra flis lock_2 …). Lagres i tile_cfg.<k> (se 24-hjem-faner.js).
    _tileEdFields(m, k, pre) {
      const H = HT(), c = m.c;
      const kd = H ? H.kindOf(c, k) : null;
      if (!H || !kd) return '';
      const cfg = H.tileCfg(c, k), dom = H.TILE_DOM[kd], K = KINDS[kd] || ['', ''];
      const au = m.E ? m.E[kd] : null, auto = au && typeof au === 'object' ? au.status : au;
      const as = auto && this.hass.states[auto];
      const pk = dom && M.entityPicker ? M.entityPicker.html({ key: `${pre}-ent-${k}`, value: cfg.entity || '', auto: k === kd ? auto || '' : auto || '', autoMode: true, autoLabel: `Automatisk (${as ? as.attributes.friendly_name || auto : auto || 'fant ingen'})`, domains: [].concat(dom), attrs: `data-in="teent" data-k="${esc(k)}"` }) : '';
      const icf = M.iconPicker ? M.iconPicker.html({ key: `${pre}-ic-${k}`, value: cfg.icon || '', placeholder: M.iconName(K[0]), label: 'Ikon', attrs: `data-in="teicon" data-k="${esc(k)}"` }) : `<input class="in" data-in="teiconraw" data-k="${esc(k)}" value="${esc(cfg.icon || '')}" placeholder="${esc(M.iconName(K[0]))}">`;
      const probe = this._probeF;
      // Standard = det kortet gjør uten egne handlinger for flisen (DEF_TAP / gammel tap.<type>)
      const std = (w) => {
        let a = null;
        if (probe && probe._tapFor) {
          const keep = probe._config;
          try {
            const c0 = { ...keep, ...c, tile_cfg: { ...(c.tile_cfg || {}), [k]: { ...cfg, tap_icon: undefined, tap_card: undefined, hold_icon: undefined, hold_card: undefined, tap_action: undefined, hold_action: undefined, icon_hold_action: undefined } } };
            probe._config = c0;
            const t = probe._tileModel(k, m.E || {});
            a = probe._tapFor(k, w, t);
          } catch (e) { a = null; } finally { probe._config = keep; }
        }
        return 'Standard: ' + H.tapLabel(a, w) + (w === 'hold_ic' && a && a.navigation_path === '#dorlas' ? ' (Dørlås-popupen; uten lås → more-info)' : ''); };
      const cur = (w) => cfg[H.TAP_KEYS[w]] || (w === 'hold_ic' ? cfg.icon_hold_action : w === 'hold_card' ? cfg.hold_action : cfg.tap_action) || null;
      const taps = H.TAP_FIELDS.map(([w, lab]) => `<div class="tap" data-key="${pre}-tp-${esc(k)}-${w}"><span class="th">${ic(w === 'ic' ? 'radio_button_checked' : w === 'card' ? 'touch_app' : w === 'hold_ic' ? 'mdi:gesture-tap-hold' : 'mdi:hand-back-right-outline', 20, 'color:#afafaf')}${esc(lab)}</span>
          ${M.tap ? M.tap.html({ key: `${pre}-tpk-${k}-${w}`, value: cur(w) || (w === 'card' && H.kindOf(c, k) === 'cam' && H.camTapShown ? H.camTapShown(c, k) : null), modes: H.TAP_MODES, labels: H.TAP_LABELS, stdHint: std(w), attrs: `data-in="tetap" data-k="${esc(k)}" data-w="${w}"` }) : ''}</div>`).join('');
      return `${dom ? `<div class="fld"><span class="fl">Entitet · ${esc([].concat(dom).join(', '))}</span>${pk}</div>` : ''}
        <div class="g2"><div class="fld"><span class="fl">Navn</span><input class="in" data-in="tename" data-k="${esc(k)}" value="${esc(cfg.name || '')}" placeholder="${esc(K[1])}"></div>
          <div class="fld"><span class="fl">Undertekst</span><input class="in" data-in="tesub" data-k="${esc(k)}" value="${esc(cfg.sub || '')}" placeholder="${esc(kd === 'lock' ? 'Dørlås / Inngang' : K[1])}"></div></div>
        <div class="fld"><span class="fl">Ikon · mdi:, phu:, hue: …</span>${icf}</div>
        ${taps}
        ${cfg.entity || cfg.name || cfg.icon || cfg.sub || H.TAP_FIELDS.some(([w]) => cur(w)) ? `<button class="o34 press" style="align-self:flex-start" data-a="tereset" data-k="${esc(k)}">${ic('mdi:restore', 16)} Standard for flisen</button>` : ''}`;
    }
    // «+ Legg til» → velg type → velg entitet («Automatisk» = autokonfig). Flere av samme type er lov (lock_2 …).
    _tileAdd(m) {
      const u = this.u, H = HT();
      if (!u.tadd || !H) return '';
      if (u.tadd === 'types') {
        const kinds = KIND_ORDER.filter((kd) => H.TILE_DOM[kd]);
        return `<div class="pnl pk" data-key="tadd"><span class="pkt">Velg type</span><div class="chs">${kinds.map((kd) => `<button class="pkc press" data-a="taddtype" data-v="${kd}">${ic(KINDS[kd][0], 18, 'color:#afafaf')}${esc(KINDS[kd][1])}</button>`).join('')}</div></div>`;
      }
      const kd = u.tadd, dom = H.TILE_DOM[kd], au = m.E ? m.E[kd] : null, auto = au && typeof au === 'object' ? au.status : au;
      return `<div class="pnl pk" data-key="tadd-${kd}"><span class="pkt">${ic(KINDS[kd][0], 18, 'color:#afafaf')} Ny ${esc(KINDS[kd][1].toLowerCase())} · velg entitet</span>
        ${M.entityPicker ? M.entityPicker.html({ key: 'tadd-pk-' + kd, value: '', auto: auto || '', autoMode: true, autoLabel: 'Automatisk', domains: [].concat(dom), attrs: `data-in="taddent" data-v="${kd}"` }) : ''}
        <button class="o34 press" style="align-self:flex-start" data-a="taddopen">Avbryt</button></div>`;
    }
    // Legg til en flis av typen kd med valgt entitet ('' = automatisk) på fanen
    _tileCreate(kd, ent, slot) {
      const u = this.u, m = this._model(), t = m.t, c = m.c, H = HT();
      if (!t || !H) return;
      const used = m.en.includes(kd) || !!H.tileCfg(c, kd).entity;
      const id = used ? M.hjemNewTileId(c, kd) : kd;
      const cur = H.tileCfg(c, id);
      const [zs, zp] = (slot || 'R-bottom').split('-');
      let c2 = setIn(c, 'tile_cfg.' + id, { ...cur, ...(id !== kd ? { kind: kd, side: zs, pos: zp } : {}), ...(ent ? { entity: ent } : {}) });
      this._F = c2;
      u.tadd = null; u.zadd = null; u.ted = id; u.sel = { t: 'tile', id, z: true };
      if (t.hc) return this._hcAdd(this._model(), id, slot);
      const m2 = this._model();
      return this._moveTile(m2, id, slot || H.defSlot(c2, t.kind, id) || 'R-bottom', null);
    }
    _teSet(k, f, v) { this.saveF({ [`tile_cfg.${k}.${f}`]: v === '' || v == null ? undefined : v }); }
    _acc(key, title, icon, meta) {
      const o = !!this.u.acc[key];
      return `<button class="ac ${o ? 'open' : ''}" data-a="acc" data-v="${key}" data-key="ac-${key}">${ic(icon, 20, 'color:#afafaf')}<span class="at">${esc(title)}</span><span class="am">${esc(meta)}</span>${ic('expand_more', 22, 'color:#979797')}</button>`;
    }
    _accSwipe(m) {
      const S = get(m.c, `slides.${m.t.id}`) || {}, n = ['L', 'R'].reduce((a, sd) => a + Object.keys(S[sd] || {}).filter((k) => S[sd][k]).length, 0);
      let body = '';
      if (this.u.acc.swipe) {
        body = `<div class="box" data-key="acb-swipe"><span style="display:flex;flex-direction:column;gap:2px"><span class="lb">Swipe-kort</span><span class="sub">Ekstra kort du sveiper til etter rommene</span></span>
          ${[['L', 'Venstre karusell'], ['R', 'Høyre karusell']].map(([sd, l]) => { const cur = Object.keys(SLIDE_L).filter((k) => (S[sd] || {})[k]);
            return `<div style="display:flex;flex-direction:column;gap:6px"><span style="font-size:12px;color:#979797">${l}</span><div class="chs">
              ${cur.map((k) => `<button class="c34 press" data-a="slide" data-s="${sd}" data-v="${k}" title="Fjern">${ic(SLIDE_L[k][0], 18)}${SLIDE_L[k][1]}${ic('close', 16, 'color:#979797')}</button>`).join('')}
              ${Object.keys(SLIDE_L).filter((k) => !cur.includes(k)).map((k) => `<button class="o34 press" data-a="slide" data-s="${sd}" data-v="${k}">+ ${SLIDE_L[k][1]}</button>`).join('')}</div>${this._carRules(m, sd)}</div>`; }).join('')}
          ${this._calRow(m)}</div>`;
      }
      return this._acc('swipe', 'Swipe-kort', 'mdi:gesture-swipe-horizontal', n + ' ekstra') + body;
    }
    // Fiks 20.4 · per karusell: «Vis prikker» + «Vis først når …» (regler: kort + HA-condition i YAML, hurtigvalg, live-merke, ↑, slett).
    // Config: carousel.<fane>.<L|R>.{ dots, first: [{ slide, condition }] } – betingelsen lagres som objekt (liste, som HAs condition-editor).
    _carRules(m, sd) {
      const t = m.t, P = `carousel.${t.id}.${sd}`, C0 = get(m.c, P) || {}, dots = C0.dots !== false, L = Array.isArray(C0.first) ? C0.first : [];
      const opts = M.hjemCar ? M.hjemCar.slides(m.c, t.id, sd) : [['rooms', 'Rommene']], pre = M.hjemCar ? M.hjemCar.presets(this.hass, m.c) : [];
      const txt = (this.u.crTxt = this.u.crTxt || {}), Y = M.yaml;
      const dump = (v) => { if (v == null || (Array.isArray(v) && !v.length)) return ''; if (typeof v === 'string') return v; try { return Y ? Y.dump(Array.isArray(v) && v.length === 1 ? v[0] : v).trimEnd() : JSON.stringify(v); } catch (e) { return ''; } };
      const rows = L.map((r, i) => {
        const k = `${t.id}-${sd}-${i}`, raw = txt[k] != null ? txt[k] : dump(r && r.condition), ok = M.condParse(raw);
        const res = ok.error || !ok.value ? null : M.condEval(this.hass, ok.value, { onChange: this._crCb || (this._crCb = () => this._schedule()) });
        const on = res === true, sl = (r && r.slide) || 'rooms';
        return `<div class="crr" data-key="crr-${esc(k)}">
          <div class="crh"><span class="fl">Regel ${i + 1}</span><span class="crb ${on ? 'on' : ''}">${on ? 'Slår til nå' : 'Nei nå'}</span><span style="flex:1"></span>
            ${i ? `<button class="crib" data-a="crup" data-s="${sd}" data-i="${i}" title="Flytt opp" aria-label="Flytt opp">${ic('arrow_upward', 18)}</button>` : ''}
            <button class="crib" data-a="crdel" data-s="${sd}" data-i="${i}" title="Slett" aria-label="Slett">${ic('mdi:delete-outline', 18)}</button></div>
          <div class="chs">${opts.map(([v, l]) => `<button class="${v === sl ? 'c34' : 'o34'} press" data-a="crslide" data-s="${sd}" data-i="${i}" data-v="${v}" data-h="selection" aria-pressed="${v === sl}">${esc(l)}</button>`).join('')}</div>
          <textarea class="crc" data-key="crc-${esc(k)}-${[...raw].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 7) >>> 0}" data-in="crcond" data-s="${sd}" data-i="${i}" rows="${Math.max(3, raw.split('\n').length)}" spellcheck="false" autocapitalize="off" autocorrect="off" placeholder="condition: state&#10;entity_id: calendar.familie&#10;state: &quot;on&quot;">${esc(raw)}</textarea>
          ${ok.error ? `<span class="cre">Ugyldig YAML: ${esc(ok.error)} – regelen hoppes over</span>` : ''}
          <div class="chs">${pre.map(([v, l]) => `<button class="o34 press crp" data-a="crpre" data-s="${sd}" data-i="${i}" data-v="${v}">${esc(l)}</button>`).join('')}</div></div>`;
      }).join('');
      return `<button class="tgl" data-a="cardots" data-s="${sd}" data-h="selection" role="switch" aria-checked="${dots}" data-key="cardots-${sd}" style="background:var(--gray100,#2f2f2f)">Vis prikker${this._sw(dots)}</button>
        <div class="fld" data-key="crl-${sd}"><span class="fl">Vis først når …</span>${rows}<button class="o34 press" style="align-self:flex-start" data-a="cradd" data-s="${sd}">+ Legg til regel</button></div>`;
    }
    // Fiks 17.10 · fire soner (Venstre/Høyre · over/under rommene) med mini-kart, Swipe-pille og +. Radene har bare ↑/↓ og
    // chevron; plassering og «Fjern kortet» ligger i editoren under raden. Config uendret (tiles.<fane>.<id>.slot, swipe.<fane>.<sone>).
    // Fiks 17.7 · Kalender-kortet: rad → rad-editor med Trykk, Hold, kalendere og «Hele dagen» (calendar.* i faner-configen)
    _calRow(m) {
      const c = m.c, K = c.calendar || {}, u = this.u, all = M.all(this.hass, 'calendar'), sel = (Array.isArray(K.entities) ? K.entities : []).filter((x) => all.includes(x));
      const norm = M.hjemCalNorm || ((x) => x), ta = norm(K.tap_action), ha = norm(K.hold_action);
      const lab = (a, std) => (!a ? std : M.tap ? M.tap.label(a, this.hass) : a.action);
      const row = `<div class="zr ${u.calEd ? 'open' : ''}" data-key="calrow" style="background:var(--gray100,#2f2f2f)"><button class="zrm" data-a="caled"><span class="zc" style="background:rgba(255,255,255,0.08)">${ic('calendar_month', 20)}</span><span class="tt"><b>Kalender</b><i>Trykk: ${esc(lab(ta, 'Standard'))} · Hold: ${esc(lab(ha, 'Ingen'))}</i></span></button><button class="zch" data-a="caled" title="Rediger">${ic('expand_more', 22)}</button></div>`;
      if (!u.calEd) return row;
      const modes = ['std', 'popup', 'hash', 'path', 'url', 'more', 'none'];
      const tp = (w, v, std) => `<div class="tap" data-key="cal-tp-${w}"><span class="th">${ic(w === 'tap' ? 'touch_app' : 'mdi:gesture-tap-hold', 20, 'color:#afafaf')}${w === 'tap' ? 'Trykk' : 'Hold'}</span>
          ${M.tap ? M.tap.html({ key: 'cal-tpk-' + w, value: v, modes, labels: { path: 'Navigate' }, stdHint: std, attrs: `data-in="caltap" data-w="${w}"` }) : ''}</div>`;
      return row + `<div class="ted" data-key="cal-ed">${tp('tap', ta, 'Standard: kalender-arket (detaljer)')}${tp('hold', ha, 'Standard: ingen')}
          <div class="fld"><span class="fl">Kalendere · ${sel.length ? sel.length + ' valgt' : 'alle'}</span><div class="ach">${all.map((id) => `<button class="${!sel.length || sel.includes(id) ? 'on' : ''}" data-a="calent" data-v="${esc(id)}" data-h="selection">${esc(M.name(this.hass, id))}</button>`).join('') || '<span class="sub">Fant ingen calendar.*</span>'}</div></div>
          <button class="tgl" data-a="calallday" data-h="selection" style="background:var(--gray200,#3a3a3a)">Ta med «Hele dagen»-hendelser${this._sw(K.all_day !== false)}</button></div>`;
    }
    _accSnar(m) {
      const t = m.t;
      let body = '';
      if (this.u.acc.snar) body = `<div class="box t6" data-key="acb-snar">${ZONES.map(([sl, l]) => this._zone(m, sl, l)).join('')}</div>`;
      return this._acc('snar', 'Snarveier · ' + t.label, 'bolt', m.en.length + ' stk') + body;
    }
    _zone(m, sl, label) {
      const u = this.u, list = m.inSlot(sl), n = list.length, open = u.zadd === sl, sw = !!m.slotAll(sl);
      const map = `<span class="zm" aria-hidden="true">${['L-top', 'R-top'].map((z) => `<i class="${z === sl ? 'on' : ''}"></i>`).join('')}<b></b>${['L-bottom', 'R-bottom'].map((z) => `<i class="${z === sl ? 'on' : ''}"></i>`).join('')}</span>`;
      let add = '';
      if (open && u.tadd && u.tadd !== 'types') add = this._tileAdd(m);
      else if (open) add = `<div class="zgr" data-key="zgr-${sl}">${ZADD.map(([v, icn, l]) => `<button class="press" data-a="zadd" data-z="${sl}" data-v="${v}">${ic(icn, 22, 'color:#afafaf')}${esc(l)}</button>`).join('')}</div>`;
      return `<div class="zn" data-key="zn-${sl}"><div class="zh">${map}<span class="zt"><b>${esc(label)}</b><i>${n ? `${n} kort` : 'Tom'}</i></span>
          ${n >= 2 ? `<button class="zsw ${sw ? 'on' : ''}" data-a="swall" data-v="${sl}" data-h="selection">${ic('mdi:gesture-swipe-horizontal', 14)}Swipe</button>` : ''}
          <button class="zad ${open ? 'on' : ''}" data-a="zaddopen" data-v="${sl}" title="Legg til">${ic('mdi:plus', 20)}</button></div>
        ${add}
        ${n ? list.map((k, i) => this._zoneRow(m, k, i, n)).join('') : open ? '' : '<span class="zemp">Tomt · trykk + for å legge til</span>'}</div>`;
    }
    _zoneRow(m, k, i, n) {
      const c = m.c, u = this.u, ed = u.ted === k, H = HT(), kd = H ? H.kindOf(c, k) : KINDS[k] ? k : null, L = kd ? null : (c.links || {})[k] || {};
      const col = L && L.color && L.color !== 'ingen' ? (TSW.find((x) => x[0] === L.color) || [])[1] : null;
      const sub = kd ? 'Live status' : L.sub || 'Snarvei';
      const row = `<div class="zr ${ed ? 'open' : ''}" data-key="zr-${esc(k)}"><button class="zrm" data-a="tedit" data-v="${esc(k)}"><span class="zc" style="background:${col || 'rgba(255,255,255,0.08)'};${col ? 'color:#2f2f2f' : ''}">${ic(kindIcon(k, c), 20)}</span><span class="tt"><b>${esc(kindLabel(k, c))}</b><i>${esc(sub)}</i></span></button>
          <span class="zud"><button class="${i > 0 ? '' : 'no'}" data-a="tmove" data-k="${esc(k)}" data-v="-1" title="Flytt opp">${ic('expand_less', 18)}</button><button class="${i < n - 1 ? '' : 'no'}" data-a="tmove" data-k="${esc(k)}" data-v="1" title="Flytt ned">${ic('expand_more', 18)}</button></span>
          <button class="zch" data-a="tedit" data-v="${esc(k)}" title="Rediger">${ic('expand_more', 22)}</button></div>`;
      if (!ed) return row;
      const cur = tileSlot(c, m.t, k), pb = (z, l) => `<button class="${cur === z ? 'on' : ''}" data-a="zmove" data-k="${esc(k)}" data-v="${z}" data-h="selection">${l}</button>`;
      const fields = kd ? this._tileEdFields(m, k, 'r') + this._tileEdExtra(m, k, 'r') : this._tilePanel(m, k, true);
      return row + `<div class="ted" data-key="ted-${esc(k)}">
          <div class="fld"><span class="fl">Plassering</span><div class="zpg">${pb('L-top', 'Venstre')}${pb('R-top', 'Høyre')}<span>Rommene</span>${pb('L-bottom', 'Venstre')}${pb('R-bottom', 'Høyre')}</div></div>
          ${fields}
          <button class="zdel press" data-a="thide" data-k="${esc(k)}" data-h="warning">${ic('delete', 18)}Fjern kortet</button></div>`;
    }
    /* ---------- 17.11 / 17.16 · ekstra felt i rad-editoren: Ruter (stopp, avvik, format) og Kamera (Aktiv-tilstand) */
    _tileEdExtra(m, k, pre) {
      const H = HT(), c = m.c, kd = H ? H.kindOf(c, k) : null;
      const stx = this._stxEd(m, k, pre); // 20.7
      if (kd === 'ruter') return this._ruterEd(m, k, pre) + stx;
      if (kd === 'cam') return stx + this._camEd(m, k, pre);
      return stx;
    }
    /* ---------- 20.7 · Tekst per tilstand (Hjem v3 · t.ed.stx): chip per tilstand (grønn = nå) + Tittel og Undertekst.
     * Lagres i tile_cfg.<k>.state_text.<tilstand>.{title,sub}; tomt felt = standard (plassholderen). */
    _stxEd(m, k, pre) {
      const H = HT(), c = m.c, kd = H ? H.kindOf(c, k) : null;
      if (!H || !H.STATE_TXT || !H.STATE_TXT[kd]) return '';
      const cfg = H.tileCfg(c, k), probe = this._probeF, K = esc(k);
      let t = null;
      if (probe && probe._tileModel) { const keep = probe._config; try { probe._config = { ...keep, ...c }; t = probe._tileModel(k, m.E || {}); } catch (e) { t = null; } finally { probe._config = keep; } }
      const au = m.E ? m.E[kd] : null, ent = (t && t.stEnt) || cfg.entity || (au && typeof au === 'object' ? au.status : au) || null;
      const now = t ? t.stState : null, so = ent && this.hass.states[ent], nm = cfg.name || (so && so.attributes.friendly_name);
      const ST = cfg.state_text || {};
      const rows = H.stStates(this.hass, kd, ent, cfg).map((v) => {
        const D = H.stDefault(kd, v, nm), o = ST[v] || {}, ov = !!(o.title || o.sub), on = v === now;
        return `<div class="stx" data-key="${pre}-stx-${K}-${esc(v)}" style="display:flex;flex-direction:column;gap:6px;padding:10px;border-radius:14px;background:var(--gray100,#2f2f2f)">
            <span style="display:flex;align-items:center;gap:8px"><span style="height:24px;padding:0 10px;border-radius:12px;display:inline-flex;align-items:center;font-size:12px;font-weight:500;${on ? 'background:var(--green,#8fd6a0);color:#232323' : 'background:rgba(255,255,255,0.08);color:#c7c7c7'}">${esc(v)}${on ? ' · nå' : ''}</span><span style="flex:1"></span>
              ${ov ? `<button class="o34 press" data-a="testd" data-k="${K}" data-v="${esc(v)}">${ic('mdi:restore', 16)} Standard</button>` : ''}</span>
            <div class="g2"><input class="in" data-in="tefield" data-k="${K}" data-f="state_text.${esc(v)}.title" value="${esc(o.title || '')}" placeholder="${esc(D.title || 'Tittel')}" aria-label="Tittel · ${esc(v)}"><input class="in" data-in="tefield" data-k="${K}" data-f="state_text.${esc(v)}.sub" value="${esc(o.sub || '')}" placeholder="${esc(D.sub || 'Undertekst')}" aria-label="Undertekst · ${esc(v)}"></div></div>`;
      }).join('');
      return `<div class="asec" data-key="${pre}-stxs-${K}"><span class="ttl">Tekst per tilstand</span>
          <span class="sub" style="line-height:1.4">${esc(ent || 'Ingen entitet')}${now ? ' · nå: ' + esc(now) : ''}</span>
          <span class="sub" style="line-height:1.4">Tittel · Undertekst. Tomt felt = standard. Tokens: {state} {default} {name} {attr:changed_by} {since} og [[[ return … ]]].</span>
          ${rows}</div>`;
    }
    _ruterEd(m, k, pre) {
      const cfg = HT().tileCfg(m.c, k), sxAuto = m.E ? m.E.ruterSx : null;
      const pk = M.entityPicker ? M.entityPicker.html({ key: `${pre}-rav-${k}`, value: cfg.avvik_entity || '', auto: sxAuto || '', autoMode: true, autoLabel: `Automatisk (${sxAuto || 'fant ingen'})`, domains: ['sensor'], attrs: `data-in="teextent" data-k="${esc(k)}" data-f="avvik_entity"` }) : '';
      const nx = cfg.show_next !== false;
      return `<div class="asec" data-key="${pre}-rut-${esc(k)}"><span class="ttl">Neste avgang</span>
          <div class="fld"><span class="fl">Avvik-sensor (valgfri)</span>${pk}</div>
          <button class="tgl" data-a="teflag" data-k="${esc(k)}" data-f="show_next" data-v="${nx ? 0 : 1}" data-h="selection" style="background:var(--gray100,#2f2f2f)">Vis neste etter («, deretter 7 min»)${this._sw(nx)}</button>
          <div class="fld"><span class="fl">Format · {route} {due_in} {delay} {next} {avvik}</span><input class="in" data-in="tefield" data-k="${esc(k)}" data-f="sub_format" value="${esc(cfg.sub_format || '')}" placeholder="Linje {route} om {due_in} min"></div></div>`;
    }
    _camEd(m, k, pre) {
      const cfg = HT().tileCfg(m.c, k), a = cfg.active || {}, CM = M.hjemCam, K = esc(k);
      if (!CM) return '';
      const own = CM.listOf(a.triggers), cam = cfg.entity || (m.E ? m.E.cam : null), auto = CM.camAuto(this.hass, cam);
      const seg = (f, opts, cur) => `<div class="ach">${opts.map(([v, l]) => `<button class="${cur === v ? 'on' : ''}" data-a="teact" data-k="${K}" data-f="${f}" data-v="${esc(v)}" data-h="selection">${esc(l)}</button>`).join('')}</div>`;
      const trig = own.map((t, i) => `<div class="trg" data-key="${pre}-trg-${K}-${i}">
          ${M.entityPicker ? M.entityPicker.html({ key: `${pre}-trge-${k}-${i}`, value: t.entity || '', domains: [], attrs: `data-in="teacttrig" data-k="${K}" data-i="${i}"` }) : `<input class="in" data-in="teacttf" data-k="${K}" data-i="${i}" data-f="entity" value="${esc(t.entity || '')}">`}
          <div class="ach">${CM.CAM_OPS.map(([v, l]) => `<button class="${(t.op || '=') === v ? 'on' : ''}" data-a="teacttop" data-k="${K}" data-i="${i}" data-v="${esc(v)}" data-h="selection">${esc(l)}</button>`).join('')}</div>
          <div class="g2"><input class="in" data-in="teacttf" data-k="${K}" data-i="${i}" data-f="value" value="${esc(t.value ?? '')}" placeholder="on"><input class="in" data-in="teacttf" data-k="${K}" data-i="${i}" data-f="attribute" value="${esc(t.attribute || '')}" placeholder="Attributt (valgfri)"></div>
          <button class="o34 press" style="align-self:flex-start" data-a="teacttdel" data-k="${K}" data-i="${i}">${ic('delete', 16)} Fjern utløser</button></div>`).join('');
      const ow = CM.listOf(a.only_when), hold = a.hold_min ?? 2, col = a.color || 'var(--blue)';
      const tm = (f, v, ph) => `<input class="in" type="time" data-in="teactf" data-k="${K}" data-f="${f}" value="${esc(v || '')}" placeholder="${ph}">`;
      const icf = M.iconPicker ? M.iconPicker.html({ key: `${pre}-aic-${k}`, value: a.icon || '', placeholder: M.iconName('videocam'), label: 'Ikon når aktiv', attrs: `data-in="teacticon" data-k="${K}"` }) : `<input class="in" data-in="teactf" data-k="${K}" data-f="icon" value="${esc(a.icon || '')}" placeholder="mdi:cctv">`;
      return `<div class="asec" data-key="${pre}-cam-${K}"><span class="ttl">Aktiv-tilstand</span>
          <span class="fl">Når · utløsere</span>${seg('mode', [['any', 'Hvilken som helst'], ['all', 'Alle']], a.mode || 'any')}
          ${own.length ? trig : `<span class="sub" style="line-height:1.4">Automatisk: ${esc(auto.length ? auto.join(', ') : 'fant ingen bevegelsessensor ved kameraet')}</span>`}
          <button class="o34 press" style="align-self:flex-start" data-a="teacttadd" data-k="${K}">${ic('add', 16)} Legg til utløser</button>
          <div class="fld"><span class="fl">Hold aktiv i <b class="ahold">${hold} min</b> etter at utløseren slutter</span><input type="range" min="0" max="30" step="1" data-in="teactnum" data-k="${K}" data-f="hold_min" value="${hold}"></div>
          <span class="fl">Bare når (valgfritt)</span><div class="ach">${CM.CAM_ONLY.map(([v, l]) => `<button class="${ow.includes(v) ? 'on' : ''}" data-a="teactow" data-k="${K}" data-v="${v}" data-h="selection">${esc(l)}</button>`).join('')}</div>
          ${ow.includes('night') ? `<div class="g2">${tm('night.from', get(a, 'night.from'), '22:00')}${tm('night.to', get(a, 'night.to'), '06:00')}</div>` : ''}
          ${ow.includes('entity') && M.entityPicker ? M.entityPicker.html({ key: `${pre}-aoe-${k}`, value: a.only_entity || '', domains: ['input_boolean', 'binary_sensor', 'switch'], attrs: `data-in="teactent" data-k="${K}" data-f="only_entity"` }) : ''}
          <div class="fld"><span class="fl">Stille-periode · ikke aktiver mellom</span><div class="g2">${tm('quiet.from', get(a, 'quiet.from'), '07:00')}${tm('quiet.to', get(a, 'quiet.to'), '16:00')}</div></div>
          <span class="fl">Hvordan · stil</span>${seg('style', CM.CAM_STYLES, a.style || 'tint')}
          <div class="fld"><span class="fl">Farge</span><div class="allc">${ALLCOLS().map(([v, hex, l]) => `<button class="${sameCol(v, col) ? 'on' : ''}" data-a="teact" data-k="${K}" data-f="color" data-v="${esc(v)}" title="${esc(l)}" style="background:${M.color(v, hex)}"></button>`).join('')}</div>
            <label class="b36" style="align-self:flex-start;cursor:pointer">${ic('colorize', 16)}Egen farge<input type="color" data-in="teactf" data-k="${K}" data-f="color" value="${toHex(col)}" style="width:28px;height:22px;border:0;padding:0;background:none"></label></div>
          <div class="fld"><span class="fl">Ikon når aktiv</span>${icf}</div>
          <button class="tgl" data-a="teactb" data-k="${K}" data-f="pulse" data-h="selection" style="background:var(--gray100,#2f2f2f)">Puls rundt ikonet${this._sw(!!a.pulse)}</button>
          <div class="fld"><span class="fl">Undertekst · {tid} {siden} {entitet} {sone}</span><input class="in" data-in="teactf" data-k="${K}" data-f="sub_active" value="${esc(a.sub_active || '')}" placeholder="Bevegelse nå"><input class="in" data-in="teactf" data-k="${K}" data-f="sub_after" value="${esc(a.sub_after || '')}" placeholder="Bevegelse for {siden} siden"></div>
          <span class="fl">Ved aktivering</span>${seg('on_activate', CM.CAM_ACT, a.on_activate || 'none')}</div>`;
    }
    _actSet(k, f, v) { this.saveF({ [`tile_cfg.${k}.active.${f}`]: v === '' || v == null ? undefined : v }); }
    _trigSet(k, fn) {
      const H = HT(), a = H.tileCfg(this.F(), k).active || {}, L = M.hjemCam.listOf(a.triggers).map((x) => ({ ...x }));
      fn(L);
      this.saveF({ [`tile_cfg.${k}.active.triggers`]: L.length ? L : undefined });
    }

    // Romkort · ikon: standard for alle rom (icon_color_mode / icon_tap i faner-configen). «Tilpass rom» vinner per rom.
    _accRomIkon(m) {
      const c = m.c, mode = c.icon_color_mode || 'lights', tap = c.icon_tap || 'toggle_lights';
      const seg = (k, opts, cur) => `<div class="ss" style="align-self:flex-start;flex-wrap:wrap">${opts.map(([v, l]) => `<button class="${cur === v ? 'on-pk' : ''}" data-a="rkdef" data-k="${k}" data-v="${v}" data-h="selection">${esc(l)}</button>`).join('')}</div>`;
      const body = this.u.acc.rkic ? `<div class="box" data-key="acb-rkic"><span style="display:flex;flex-direction:column;gap:2px"><span class="lb">Ikonfarge</span><span class="sub">Romfarge på ikon-sirkelen</span></span>${seg('icon_color_mode', M.ICON_MODES || [], mode)}
          <span style="display:flex;flex-direction:column;gap:2px"><span class="lb">Trykk på ikonet</span><span class="sub">Termostat-knappene påvirkes ikke</span></span>${seg('icon_tap', M.ICON_TAPS || [], tap)}
          <span class="sub" style="line-height:1.4">Standard for alle rom. Et rom kan overstyre i «Tilpass rom» → Utseende og Handlinger.</span></div>` : '';
      const lab = (L, v) => ((L || []).find((o) => o[0] === v) || [])[1] || '';
      return this._acc('rkic', 'Romkort · ikon', 'mdi:circle-slice-8', lab(M.ICON_MODES, mode)) + body;
    }

    /* ======================================================== Faner */
    _faner() {
      const hass = this.hass, c = this.F(), T = allTabs(hass, c), visN = T.filter((t) => !t.hidden).length;
      const rows = T.map((t, i) => {
        const custom = t.kind === 'custom';
        return `<div class="tabr ${t.hidden ? 'hid' : ''}" data-drag="tab" data-id="${esc(t.id)}" data-drop="tab:${esc(t.id)}" data-key="tr-${esc(t.id)}">
          <div class="l"><input class="in t" style="flex:1" data-in="tlabel" data-k="${esc(t.id)}" value="${esc(t.label)}" placeholder="${esc(t.autoLabel)}">
            <button class="sq ${i > 0 ? '' : 'no'}" data-a="tabmv" data-k="${esc(t.id)}" data-v="-1">${ic('expand_less', 18)}</button>
            <button class="sq ${i < T.length - 1 ? '' : 'no'}" data-a="tabmv" data-k="${esc(t.id)}" data-v="1">${ic('expand_more', 18)}</button>
            <button class="sq" data-a="tabeye" data-k="${esc(t.id)}" ${!t.hidden && visN <= 1 ? 'style="opacity:.4"' : ''}>${ic(t.hidden ? 'visibility_off' : 'visibility', 18, `color:${t.hidden ? '#696969' : '#fafafa'}`)}</button>
            ${custom ? `<button class="sq del" data-a="tabdel" data-k="${esc(t.id)}" title="Slett">${ic('delete', 18)}</button>` : ''}</div>
          <div class="v">${t.kind === 'batterier' ? '<span class="chip on-pk">Batterier</span>' : VIEWS.map(([v, l]) => `<button class="chip ${t.view === v ? 'on-pk' : ''}" data-a="tabview" data-k="${esc(t.id)}" data-v="${v}" data-h="selection">${l}</button>`).join('')}
            ${t.view !== 'batterier' ? `<button class="rs" data-a="tabcards" data-k="${esc(t.id)}">Rom og snarveier${ic('chevron_right', 18)}</button>` : ''}</div>
          ${t.kind === 'batterier' ? this._bat(c) : ''}
        </div>`;
      }).join('');
      const opt = (key, v, l, curV) => `<button class="o36 ${curV === v ? 'on-pk' : ''}" data-a="tabset" data-k="${key}" data-v="${v}" data-h="selection">${l}</button>`;
      const hC = c.tab_height || 'std', wC = c.tab_width || 'std';
      const custom = (key, pk, min, max, def) => { const v = Number(c[pk]) || def; return `<div style="display:flex;align-items:center;gap:8px;padding-top:4px"><input type="range" min="${min}" max="${max}" step="1" value="${v}" data-in="tabpx" data-k="${pk}" style="flex:1;min-width:0;touch-action:pan-y">
          <div class="stp"><button data-a="tabstep" data-k="${pk}" data-v="-1" data-min="${min}" data-max="${max}" data-def="${def}">${ic('remove', 18)}</button><span>${v} px</span><button data-a="tabstep" data-k="${pk}" data-v="1" data-min="${min}" data-max="${max}" data-def="${def}">${ic('add', 18)}</button></div></div>`; };
      // Fiks 17.18: én global bryter for Liquid Glass-animasjonen (ki-store ui.glass_anim, MSH.glassAnimOn) – øverst
      const ga = M.glassAnimOn ? M.glassAnimOn() : true;
      const gaRow = `<button class="tgl" style="height:auto;min-height:56px;padding:10px 10px 10px 16px" data-a="glassanim" data-h="selection" role="switch" aria-checked="${ga}" data-key="glassanim"><span style="display:flex;align-items:center;gap:12px;min-width:0">${ic('mdi:blur', 20, `color:${ga ? '#fafafa' : '#696969'}`)}<span style="display:flex;flex-direction:column;gap:2px;min-width:0"><span>Liquid Glass-animasjon</span><span style="font-size:12px;font-weight:400;color:#979797">Glass-linse når du drar eller trykker i faner og segmenter · hele dashbordet</span></span></span>${this._sw(ga)}</button>`;
      // Fiks 18.5: haptisk feedback per enhet (localStorage ki-haptic-off + ki-store haptic_off_devices) – lagres straks
      const hOn = M.hapticOff ? !M.hapticOff() : true;
      const hapRow = M.setHapticOff ? `<button class="tgl" style="height:auto;min-height:56px;padding:10px 10px 10px 16px" data-a="hapticdev" data-h="selection" role="switch" aria-checked="${hOn}" data-key="hapticdev"><span style="display:flex;align-items:center;gap:12px;min-width:0">${ic('mdi:vibrate', 20, `color:${hOn ? '#fafafa' : '#696969'}`)}<span style="display:flex;flex-direction:column;gap:2px;min-width:0"><span>Haptisk feedback</span><span style="font-size:12px;font-weight:400;color:#979797">Gjelder bare denne enheten</span><span style="font-size:12px;font-weight:400;color:#7f7f7f">Denne enheten: ${esc(M.deviceInfo().label)}</span></span></span>${this._sw(hOn)}</button>` : '';
      // Fiks 20.8: Fanestil (høyde/bredde, tabSet) øverst → Liquid Glass-animasjon → fanene → «+ Ny fane»
      return `<div class="tset"><span class="lb">Fanestil</span>
          <div class="fld"><span class="fl">Høyde</span><div class="chs">${[['std', 'Standard'], ['lav', 'Lav'], ['mid', 'Middels'], ['hoy', 'Høy'], ['ekstra', 'Ekstra'], ['custom', 'Egendefinert']].map(([v, l]) => opt('tab_height', v, l, hC)).join('')}</div>${hC === 'custom' ? custom('tab_height', 'tab_height_px', 24, 80, 38) : ''}</div>
          <div class="fld"><span class="fl">Bredde per fane</span><div class="chs">${[['std', 'Standard'], ['kompakt', 'Kompakt'], ['full', 'Full'], ['custom', 'Egendefinert']].map(([v, l]) => opt('tab_width', v, l, wC)).join('')}</div>${wC === 'custom' ? custom('tab_width', 'tab_width_px', 48, 200, 88) : ''}</div>
        </div>
        ${gaRow}${hapRow}${rows}
        <button class="big52 press" data-a="tabnew">${ic('add', 22)}Ny fane</button>
        <span class="hint">Dra fanene for å endre rekkefølgen. Etasjer fra Home Assistant dukker opp automatisk.</span>`;
    }
    _bat(c) {
      const hass = this.hass, lim = Number(get(c, 'battery.limit')) || 20, cond = get(c, 'battery.cond') || '', al = !!get(c, 'battery.always'), show = get(c, 'battery.show') || 'lav';
      let low = 0;
      Object.keys(hass.states).forEach((id) => {
        const s = hass.states[id];
        if (!/^(sensor|binary_sensor)\./.test(id) || s.attributes.device_class !== 'battery') return;
        if (id.startsWith('binary_sensor.') ? s.state === 'on' : M.isNum(s.state) && Number(s.state) < lim) low++;
      });
      const on = al || (cond ? M.isOn(hass.states[cond]) : low > 0);
      const q = cond.toLowerCase();
      const sug = M.all(hass, 'binary_sensor', (s, id) => (s.attributes.device_class === 'battery' || /batter/i.test(id)) && id !== cond && (!q || id.includes(q) || String(s.attributes.friendly_name || '').toLowerCase().includes(q) || q === 'binary_sensor.')).slice(0, 4);
      const state = al ? 'Vises alltid' : cond ? (on ? `Vises nå · ${cond} er på` : `Skjult · ${cond} er av`) : on ? `Vises nå · ${low} under ${lim} %` : `Skjult · ingen batterier under ${lim} %`;
      return `<div class="bat" data-key="bat">
        <div style="display:flex;align-items:center;gap:8px">${ic(on ? 'visibility' : 'visibility_off', 18, `color:${on ? C.green : '#7f7f7f'}`)}<span style="flex:1;font-size:13px;color:#afafaf">${esc(state)}</span></div>
        <div class="fld"><span class="fl">Vis fanen når denne er på</span><div class="bsr">${ic('search', 18, 'color:#7f7f7f')}<input data-in="bcond" value="${esc(cond)}" placeholder="Tom = når et batteri er under grensen"></div>
          <div style="display:flex;flex-direction:column;gap:2px">${sug.map((id) => `<button class="bsg" data-a="bcond" data-v="${esc(id)}">${ic('battery_alert', 18, 'color:#afafaf')}<span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:1px"><span style="font-size:13px;font-weight:500">${esc(M.name(hass, id))}</span><span style="font-size:11px;color:#7f7f7f;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(id)}</span></span></button>`).join('')}</div></div>
        <div class="fld"><div style="display:flex;justify-content:space-between"><span class="fl">Grense for lavt batteri</span><span class="num" style="font-size:13px;font-weight:500" data-lim>${lim} %</span></div><input type="range" min="5" max="60" step="5" value="${lim}" data-in="blimit"></div>
        <div style="display:flex;align-items:center;gap:12px"><span style="flex:1;font-size:14px;font-weight:500">Liste</span><div class="ss" style="background:var(--gray200,#3a3a3a);border-radius:17px">${[['lav', 'Bare lave'], ['alle', 'Alle']].map(([v, l]) => `<button class="${show === v ? 'on-pk' : ''}" style="height:30px;border-radius:14px;font-size:12px" data-a="bshow" data-v="${v}" data-h="selection">${l}</button>`).join('')}</div></div>
        <button style="display:flex;align-items:center;gap:12px;text-align:left;width:100%" data-a="balways" data-h="selection"><span style="flex:1;display:flex;flex-direction:column;gap:2px"><span style="font-size:14px;font-weight:500">Vis alltid</span><span style="font-size:12px;color:#979797">Ignorer betingelsen</span></span><span class="trk ${al ? 'on' : ''}" style="${al ? 'background:' + C.green : ''}"></span></button>
      </div>`;
    }

    /* ======================================================== Popups */
    _popList() {
      const hass = this.hass, c = this.F(), P = this._popCfg(), out = [];
      M.areas(hass).forEach((a) => {
        const rr = get(c, 'rooms.' + a.id) || {}, au = M.roomAuto ? M.roomAuto(hass, a.id) : {};
        out.push({ g: 'rom', key: a.id, hash: '#' + a.id, name: a.name, icon: rr.icon || a.icon || (au.A && au.A.ikon) || 'mdi:texture-box', color: rr.color || (M.romColor ? M.romColor(a.id, hass) : C.orange) });
      });
      (M.FUNCTION_POPUPS || []).forEach(([hash, name, icon]) => out.push({ g: 'fn', key: hash.slice(1), hash, name, icon, color: 'var(--gray1000)' }));
      M.all(hass, 'person').forEach((pid) => { const o = pid.split('.')[1]; out.push({ g: 'person', key: 'person-' + o, hash: '#person-' + o, name: M.name(hass, pid), icon: 'mdi:account', color: 'var(--gray1000)' }); });
      out.push({ g: 'fn', key: 'settings', hash: '#settings', name: 'Innstillinger', icon: 'mdi:cog', color: 'var(--gray1000)' });
      return out.map((p) => ({ ...p, ov: P[p.key] || {} }));
    }
    _pops() {
      if (M.popupsPanel) return M.popupsPanel.render(this); // 28-popup-editor.js (egne popups, YAML)
      const u = this.u, L = this._popList(), G = [['alle', 'mdi:layers-outline', 'Alle'], ['rom', 'mdi:texture-box', 'Rom'], ['fn', 'mdi:apps', 'Funksjoner'], ['person', 'mdi:account', 'Personer']];
      const list = L.filter((p) => u.popG === 'alle' || p.g === u.popG);
      return `<div style="display:flex;flex-direction:column;gap:12px" data-key="pops">
        <div class="pgs">${G.map(([id, icn, l]) => `<button class="pg ${u.popG === id ? 'on' : ''}" data-a="popg" data-v="${id}" data-h="selection">${ic(icn, 18)}${l}</button>`).join('')}</div>
        <div class="pl">${list.map((p) => this._popRow(p)).join('')}</div>
        <span class="hint">Skjul popups du ikke bruker, eller gi dem eget navn, ikon og ikonfarge. Tas i bruk ved neste innlasting.</span>
      </div>`;
    }
    _popRow(p) {
      const o = p.ov, hid = !!o.hidden, open = this.u.popSel === p.key;
      const icon = o.icon || p.icon, col = M.color(o.color || p.color, C.gray1000);
      const row = `<div class="pr ${hid ? 'hid' : ''}" data-key="pr-${esc(p.key)}"><button style="display:flex;align-items:center;gap:12px;flex:1;min-width:0;text-align:left" data-a="popsel" data-v="${esc(p.key)}">
          <span class="pi" style="background:${col}">${ic(icon, 22)}</span><span class="pn"><b>${esc(o.name || p.name)}</b><i>${esc(p.hash)}${o.name || o.icon || o.color ? ' · tilpasset' : ''}</i></span></button>
          <button data-a="pophide" data-v="${esc(p.key)}" data-h="selection" title="${hid ? 'Skjult' : 'Vises'}">${this._sw(!hid)}</button></div>`;
      if (!open) return row;
      const ed = `<div class="pe" data-key="pe-${esc(p.key)}">
        <div class="fld"><span class="fl">Navn</span><input class="in" data-in="popname" data-k="${esc(p.key)}" value="${esc(o.name || '')}" placeholder="${esc(p.name)}"></div>
        <div class="fld"><span class="fl">Ikon · mdi:, phu:, hue: …</span><div style="display:flex;gap:8px;align-items:center"><span class="pv2" style="background:${col}">${ic(icon, 22)}</span><input class="in" style="flex:1" data-in="popicon" data-k="${esc(p.key)}" value="${esc(o.icon || '')}" placeholder="${esc(p.icon)}"></div></div>
        <div class="fld"><span class="fl">Ikonfarge</span><div class="cols">${COLS.map((x) => `<button class="cl ${sameCol(x, o.color) ? 'on' : ''}" data-a="popcol" data-k="${esc(p.key)}" data-v="${esc(x)}" style="background:${M.color(x, x)}"></button>`).join('')}
          <label class="cw" title="Egen farge" style="background:conic-gradient(rgb(242 128 115), rgb(242 210 111), rgb(102 209 158), rgb(115 185 242), rgb(173 153 230), rgb(242 133 201), rgb(242 128 115))">${ic('colorize', 16)}<input type="color" data-in="popcolhex" data-k="${esc(p.key)}" value="${toHex(o.color || p.color)}"></label></div></div>
        ${o.name || o.icon || o.color ? `<button class="std" style="align-self:flex-start;height:32px;padding:0 12px" data-a="popreset" data-v="${esc(p.key)}">Standard</button>` : ''}
      </div>`;
      return row + ed;
    }
    _popSet(key, patch) {
      const cur = { ...(this._popCfg()[key] || {}), ...patch };
      Object.keys(cur).forEach((k) => { if (cur[k] === undefined || cur[k] === '' || cur[k] === null || cur[k] === false) delete cur[k]; });
      this._saving = true;
      try { if (this.hass) M.store.load(this.hass); M.store.set('popups.' + key, Object.keys(cur).length ? cur : undefined); } finally { this._saving = false; }
      this._schedule();
    }

    /* ======================================================== Tekst */
    _tekst() {
      const R = this._prose(), u = this.u, hass = this.hass;
      if (!R) return '<div class="hint">Prosa-kortet er ikke lastet.</div>';
      // Forhåndsvisning = samme rendering og CSS som prosa-kortet (M.prosaHTML / M.PROSA_CSS, 21-hjem-prosa.js)
      const PC0 = customElements.get('msh-prosa-card'), T0 = PC0 && PC0.textSize ? PC0.textSize(this.P() || {}) : { fs: null, lh: 1.55 };
      const pill = (v) => `<span class="chip" style="background:${v.bg}">${v.dot ? `<span class="dot" style="background:${v.dot};box-shadow:0 0 0.35em ${v.dot}"></span>` : ''}${v.emoji ? (v.emoji.indexOf(':') > 0 ? ic(v.emoji, 14) : `<span class="em">${esc(v.emoji)}</span>`) : ''}<span>${esc(v.chip)}</span></span>`;
      // Fiks 20.9: sticky live forhåndsvisning øverst (M.prosaPreviewHTML) – markerer åpen setning, oppdateres per tastetrykk
      const pzStyle = `font-size:${T0.fs != null ? T0.fs + 'em' : M.PROSA_AUTO_FS || 'clamp(22px, 7.4cqi, 34px)'};line-height:${T0.lh};padding:0`;
      const prev = M.prosaPreviewHTML ? M.prosaPreviewHTML(hass, this.P() || {}, { key: 'prev', sel: u.proseSel, act: 'pzsel', style: pzStyle })
        : `<div class="prev" data-key="prev" style="font-size:var(--ha-font-size-m, 14px);line-height:normal;container-type:inline-size"><style>${M.PROSA_CSS || ''}</style><div class="pz" style="${pzStyle}">${R.vis.length && M.prosaHTML ? M.prosaHTML(R.vis, pill) : '<span style="color:#7f7f7f">Ingen setninger vises nå</span>'}</div></div>`;
      const P = R.rows || [];
      const areas = M.areas(hass).slice(0, 8), persons = M.all(hass, 'person');
      const toks = [...TOK, ...areas.map((a) => a.id + '.temp'), ...persons.map((p) => p.split('.')[1] + '.hjemme')];
      const tokHTML = (field, i) => `<div class="toks">${toks.map((t) => `<button class="tok" data-a="ptok" data-i="${i}" data-f="${field}" data-v="{${esc(t)}}">+ {${esc(t)}}</button>`).join('')}</div>`;
      const rows = P.map((p, i) => {
        const op = p.cop || 'alltid', open = u.proseSel === i;
        const label = [R.fill(p.pre), (p.src || 'none') === 'none' ? '' : `[${p.src === 'text' ? R.fill(p.fmt) : p.src === 'custom' ? p.ent || 'state' : srcL(p.src)}]`, R.fill(p.post)].filter(Boolean).join(' ') || 'Tom setning';
        const sub = op === 'alltid' ? 'Vises alltid' : `Når ${srcL(p.csrc || p.src).toLowerCase()} ${(OPS.find((o) => o[0] === op) || ['', ''])[1].toLowerCase()} ${p.cval || '…'} · ${R.test(p) ? 'vises nå' : 'skjult nå'}`;
        const row = `<div class="pro ${open ? 'open' : ''} ${p.hidden ? 'hid' : ''}" data-key="pro-${i}"><button class="pm" data-a="psel" data-i="${i}"><b>${esc(label)}</b><i>${esc(sub)}</i></button>
          <button class="sq ${i > 0 ? '' : 'no'}" data-a="pmv" data-i="${i}" data-v="-1">${ic('expand_less', 18)}</button><button class="sq ${i < P.length - 1 ? '' : 'no'}" data-a="pmv" data-i="${i}" data-v="1">${ic('expand_more', 18)}</button>
          <button class="sq" data-a="peye" data-i="${i}">${ic(p.hidden ? 'visibility_off' : 'visibility', 18, `color:${p.hidden ? '#696969' : '#fafafa'}`)}</button>
          <button class="sq del" data-a="pdel" data-i="${i}" title="Slett">${ic('delete', 18)}</button></div>`;
        if (!open) return row;
        const cur = R.valOf(p), cs = p.csrc || p.src;
        const sv = R.valFor ? R.valFor(cs, p.cent || (cs === p.src ? (cs === 'custom' ? p.ent : p.ent_override) : '') || '') : cs === 'custom' ? R.getS(p.cent) : R.S[cs];
        // «Ved trykk» (Fiks 15.6): tap i HA-format via felles <msh-tap-picker> (09-tap-picker); uten tap = gammel link/act 'more'
        const tapV = M.prosaTapOf ? M.prosaTapOf(p) : null;
        const ed = `<div class="ped" data-key="ped-${i}">
          <div class="fld"><span class="fl">Tekst før</span><input class="in" data-in="pf" data-i="${i}" data-f="pre" value="${esc(p.pre || '')}" placeholder="F.eks. Strømmen koster">${tokHTML('pre', i)}</div>
          <div class="fld"><span class="fl">Verdi i boblen</span><select class="in" data-in="psrc" data-i="${i}">${SRC.map(([v, l]) => `<option value="${v}" ${(p.src || 'none') === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
</div>
          ${p.src === 'custom' || PFIXED.includes(p.src) ? `<div class="fld" data-key="pent-${i}"><span class="fl">Entitet${p.src === 'custom' ? ' · påkrevd' : ''}</span>
            ${p.src === 'custom'
              ? M.entityPicker.html({ key: 'pk-ent-' + i, value: p.ent || '', placeholder: 'Velg entitet …', attrs: `data-in="pent" data-i="${i}" data-f="ent"` })
              : M.entityPicker.html({ key: 'pk-ovr-' + i, value: p.ent_override || '', auto: R.autoOf ? R.autoOf(p.src) || '' : '', autoMode: true, attrs: `data-in="pent" data-i="${i}" data-f="ent_override"` })}
            ${cur ? `<span style="font-size:12px;color:#979797;padding:0 4px">Nå: <b style="font-weight:500;color:#fafafa">${esc(cur[0])}</b></span>` : `<span style="font-size:12px;color:#7f7f7f;padding:0 4px">${p.src === 'custom' && !p.ent ? 'Velg en entitet – {v} i boblen bruker den' : 'Fant ingen verdi – velg en entitet'}</span>`}</div>` : ''}
          ${(p.src || 'none') !== 'none' ? `<div class="fld"><span class="fl">${p.src === 'text' ? 'Tekst i boblen' : 'Visning i boblen · {v} er verdien'}</span><input class="in" data-in="pf" data-i="${i}" data-f="fmt" value="${esc(p.fmt || '')}"></div>` : ''}
          <div class="fld"><span class="fl">Tekst etter</span><input class="in" data-in="pf" data-i="${i}" data-f="post" value="${esc(p.post || '')}" placeholder="F.eks. i dag.">${tokHTML('post', i)}</div>
          <div class="fld"><span class="fl">Ikon i boblen</span><div class="chs" style="max-height:124px;overflow-y:auto;scrollbar-width:none">${PICONS.map(([v, l]) => `<button class="chip ${(p.icon || '') === v ? 'on-pk' : ''}" data-a="picon" data-i="${i}" data-v="${esc(v)}">${esc(l)}</button>`).join('')}</div>
            <input class="in" data-in="pf" data-i="${i}" data-f="icon" value="${esc(p.icon === 'dot' ? '' : p.icon || '')}" placeholder="Eller skriv inn en emoji / mdi:ikon"></div>
          <div class="fld"><span class="fl">Farge · Auto følger verdien (pris, lås, alarm …)</span><div style="display:flex;gap:10px;flex-wrap:wrap;padding:2px">${PSW.map(([v, col, l]) => `<button class="sw34 ${(p.color || 'hvit') === v ? 'on' : ''}" data-a="pcol" data-i="${i}" data-v="${v}" title="${l}" style="background:${col}"></button>`).join('')}</div></div>
          <div class="fld" data-key="ptap-${i}"><span class="fl">Ved trykk</span>${M.tap ? M.tap.html({ key: 'ptapk-' + i, value: tapV || { action: 'none' }, modes: M.PROSA_TAP_MODES, labels: { path: 'Sti' }, attrs: `data-in="ptap" data-i="${i}" style="--msh-tp-bg:#232323"` }) : ''}</div>
          <div class="fld"><span class="fl">Utfør også</span><select class="in" data-in="pact" data-i="${i}">${ACTS.filter(([v]) => v !== 'more' || p.act === 'more').map(([v, l]) => `<option value="${v}" ${(p.act || '') === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
            ${p.act === 'service' ? `<div class="svc"><span class="sh2">${ic('terminal', 16)}Utfør handling</span>
              <input class="in" data-in="pf" data-i="${i}" data-f="svc" value="${esc(p.svc || '')}" placeholder="domene.tjeneste, f.eks. light.turn_on">
              <span style="font-size:12px;color:#979797">Mål</span><input class="in" data-in="pf" data-i="${i}" data-f="target" value="${esc(p.target || '')}" placeholder="entity_id">
              <span style="font-size:12px;color:#979797">Data</span><input class="in" data-in="pf" data-i="${i}" data-f="data" value="${esc(typeof p.data === 'object' ? JSON.stringify(p.data) : p.data || '')}" placeholder='{"brightness_pct": 60}'>
              <button class="pink press" data-a="ptest" data-i="${i}">${ic('play_arrow', 18)}Test handling</button></div>` : ''}</div>
          <div class="fld"><span class="fl">Vises</span><div class="chs">${OPS.map(([v, l]) => `<button class="chip ${op === v ? 'on-pk' : ''}" data-a="pop" data-i="${i}" data-v="${esc(v)}">${l}</button>`).join('')}</div></div>
          ${op !== 'alltid' ? `<div class="fld"><span class="fl">Når</span><select class="in" data-in="pcsrc" data-i="${i}">${SRC.filter((x) => R.S[x[0]] || x[0] === 'custom').map(([v, l]) => `<option value="${v}" ${cs === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
</div>
            <div class="fld" data-key="pcent-${i}"><span class="fl">Entitet for betingelsen${cs === 'custom' ? ' · påkrevd' : ''}</span>
              ${M.entityPicker.html({ key: 'pk-cent-' + i, value: p.cent || '', auto: cs === 'custom' ? '' : (cs === p.src && p.ent_override) || (R.autoOf ? R.autoOf(cs) || '' : ''), autoMode: cs !== 'custom', autoLabel: cs === p.src ? 'Samme som boblen' : 'Automatisk', placeholder: 'Velg entitet …', attrs: `data-in="pent" data-i="${i}" data-f="cent"` })}</div>
            <div class="fld"><span class="fl">Verdi</span><input class="in" data-in="pf" data-i="${i}" data-f="cval" value="${esc(p.cval || '')}" placeholder="F.eks. 1,5 eller låst"><span style="font-size:11px;color:#7f7f7f">${sv ? `${esc(srcL(cs))} er nå ${esc(sv[0])} · setningen ${R.test(p) ? 'vises' : 'skjules'}` : ''}</span></div>` : ''}
        </div>`;
        return row + ed;
      }).join('');
      // Tekststørrelse / linjehøyde (em, som originalens content_style) – samme felt som prosa-kortets GUI-editor
      const PC = customElements.get('msh-prosa-card'), T = PC && PC.textSize ? PC.textSize(this.P() || {}) : { fs: null, lh: 1.55 };
      const nfE = (x) => M.nf(x, 2).replace(/0$/, '');
      const szHTML = (PC && PC.sizeFields ? PC.sizeFields : []).map((f) => {
        // Tekststørrelse uten verdi = Auto (tilpasses bredden); slideren står da på 2,15 em
        const k = f.name === 'prose_font_size' ? 'fs' : 'lh', val = T[k], auto = val == null, sv = auto ? 2.15 : val;
        const on = (v) => (v === '' ? auto : !auto && Math.abs(val - v) < 0.001);
        return `<div class="fld" data-key="psz-${k}"><div style="display:flex;justify-content:space-between;align-items:center"><span class="fl">${esc(f.label)}</span><span class="pszv-${k}" style="font-size:13px;font-weight:500;font-variant-numeric:tabular-nums">${auto ? 'Auto' : nfE(val) + ' em'}</span></div>
          <input type="range" min="${f.min}" max="${f.max}" step="${f.step}" value="${sv}" data-in="psz" data-f="${f.name}" data-k="${k}" style="width:100%;touch-action:pan-y">
          <div class="chs">${f.presets.map(([v, l]) => `<button class="o36 ${on(v) ? 'on-pk' : ''}" data-a="psize" data-f="${f.name}" data-v="${v}" data-h="selection">${esc(l)}</button>`).join('')}</div></div>`;
      }).join('');
      return `${prev}${szHTML}${this._pgHTML()}${rows}
        <button class="big52 press" data-a="padd">${ic('add', 22)}Ny setning</button>
        <span class="hint">Hver setning kan ha en boble med live verdi. Lag to setninger med motsatte betingelser for å bytte tekst eller farge etter tilstand.</span>`;
    }
    /* ---------- «Avstand til prosa» (fiks 16.2): header.prose_gap – samme verdi som «Tilpass header» → Størrelser.
     * Slider som fiks 11: tar bare over ved vannrett drag (> 6 px, mer vannrett enn loddrett), ellers scroller arket. */
    _pgHd() { return this._raw('msh-hjem-header-card', 'header'); }
    _pgHTML() {
      const G = M.HJEM_PROSE_GAP || { min: -20, max: 60, step: 2, def: 16 }, v = M.hjemProseGap ? M.hjemProseGap(this._pgHd()) : G.def;
      const fr = (v - G.min) / (G.max - G.min);
      if (!this._pgBound) this._pgBind();
      return `<div class="fld" data-key="pgap"><div style="display:flex;justify-content:space-between;align-items:center"><span class="fl">Avstand til prosa</span><span class="pgv" style="font-size:13px;font-weight:500;font-variant-numeric:tabular-nums">${v} px</span></div>
          <div class="pgsl" data-v="${v}" style="position:relative;height:32px;touch-action:pan-y;cursor:grab;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent"><div style="position:absolute;left:11px;right:11px;top:13px;height:6px;border-radius:3px;background:#545454;overflow:hidden"><div class="pgfi" style="position:absolute;left:0;top:0;bottom:0;width:${(fr * 100).toFixed(2)}%;background:#afafaf"></div></div><div class="pgth" style="position:absolute;top:5px;left:calc((100% - 22px) * ${fr.toFixed(4)});width:22px;height:22px;border-radius:11px;background:#fafafa;box-shadow:0 2px 6px rgba(0,0,0,.4);transition:transform .15s"></div>
            <input type="range" aria-label="Avstand til prosa" data-in="pgap" min="${G.min}" max="${G.max}" step="${G.step}" value="${v}" style="position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;pointer-events:none"></div>
          <div class="chs">${(M.HJEM_PROSE_GAP_PRESETS || []).map(([pv, l]) => `<button class="o36 ${pv === v ? 'on-pk' : ''}" data-a="pgap" data-v="${pv}" data-h="selection">${esc(l)}</button>`).join('')}</div>
          <span class="hint" style="padding:0 4px">Mellomrommet mellom headeren og prosaen. Minus trekker prosaen opp mot headeren.</span></div>`;
    }
    // Verdi → visning i arket + live i headeren/Hjem (utkast); commit = lagre (i «Tilpass Hjem»-utkastet, Ferdig lagrer)
    _pgSet(v, commit, silent) {
      const G = M.HJEM_PROSE_GAP || { min: -20, max: 60, step: 2, def: 16 };
      v = Math.max(G.min, Math.min(G.max, Math.round((Number(v) - G.min) / G.step) * G.step + G.min));
      if (!isFinite(v)) return;
      const r = this.root, fr = (v - G.min) / (G.max - G.min);
      const t = r && r.querySelector('.pgv'); if (t) t.textContent = v + ' px';
      const th = r && r.querySelector('.pgth'); if (th) th.style.left = `calc((100% - 22px) * ${fr.toFixed(4)})`;
      const fi = r && r.querySelector('.pgfi'); if (fi) fi.style.width = (fr * 100).toFixed(2) + '%';
      const sl = r && r.querySelector('.pgsl'); if (sl) sl.dataset.v = v;
      const lh = M.liveOf('msh-hjem-header-card');
      if (lh && lh._rawConfig && Number(lh._rawConfig.prose_gap) !== v) lh.setConfig({ ...lh._rawConfig, prose_gap: v, __eff: 1 });
      if (!commit) return;
      const old = this._pgHd();
      if (!silent && Number(old.prose_gap) === v) return;
      const nc = { ...old, prose_gap: v };
      if (!nc.card_id) nc.card_id = M.CARD_IDS.header;
      if (!nc.type) nc.type = 'custom:msh-hjem-header-card';
      this._saving = true;
      try { M.saveCardConfig(this.hass, old, nc, { toasts: false, card: lh }); } catch (e) { console.error('[ki-msh] Tilpass Hjem', e); } finally { this._saving = false; }
      this._schedule();
    }
    _pgBind() {
      this._pgBound = true;
      const sh = this.sheet;
      if (!sh) return;
      const end = (e) => {
        const g = this._pg;
        if (!g || e.pointerId !== g.id) return;
        this._pg = null;
        if (g.el.isConnected) { g.el.style.cursor = 'grab'; const th = g.el.querySelector('.pgth'); if (th) th.style.transform = ''; }
        if (g.taken) { e.stopPropagation(); M.haptic('selection'); this._pgSet(g.v, true); }
      };
      sh.addEventListener('pointerdown', (e) => {
        const el = e.composedPath().find((n) => n.classList && n.classList.contains('pgsl'));
        if (!el || e.button) return;
        const G = M.HJEM_PROSE_GAP || { min: -20, max: 60, step: 2 }, v0 = Number(el.dataset.v);
        this._pg = { el, id: e.pointerId, x0: e.clientX, y0: e.clientY, v0, v: v0, min: G.min, max: G.max, step: G.step, w: Math.max(40, el.getBoundingClientRect().width - 22), taken: false };
      }, true);
      sh.addEventListener('pointermove', (e) => {
        const g = this._pg;
        if (!g || e.pointerId !== g.id) return;
        const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
        if (!g.taken) {
          if (Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy)) {
            g.taken = true; g.x0 = e.clientX; // ingen hopp ved overtakelse
            try { g.el.setPointerCapture(e.pointerId); } catch (x) { /* */ }
            g.el.style.cursor = 'grabbing'; const th = g.el.querySelector('.pgth'); if (th) th.style.transform = 'scale(1.15)';
          } else if (Math.abs(dy) > 6) { this._pg = null; return; } // loddrett: arket scroller
          else return;
        }
        e.stopPropagation(); if (e.cancelable) e.preventDefault();
        const raw = g.v0 + ((e.clientX - g.x0) / g.w) * (g.max - g.min);
        const v = Math.max(g.min, Math.min(g.max, Math.round((raw - g.min) / g.step) * g.step + g.min));
        if (v !== g.v) { g.v = v; this._pgSet(v, false); }
      }, true);
      sh.addEventListener('pointerup', end, true);
      sh.addEventListener('pointercancel', (e) => { const g = this._pg; if (g && e.pointerId === g.id && !g.taken) { this._pg = null; return; } end(e); }, true);
      sh.addEventListener('touchmove', (e) => { if (this._pg && this._pg.taken) e.stopPropagation(); }, { passive: true, capture: true });
    }
    // Fiks 20.9: tegn bare forhåndsvisningen med utkastet (felt f i setning i = v) – lagring skjer på change som før
    _pzLive(i, f, v) {
      const pz = this.root.querySelector('[data-key="prev"] .pz');
      if (!pz || !M.prosaPreviewInner) return;
      const L = this._proseRows();
      if (!L[i]) return;
      const trim = String(v).trim();
      L[i][f] = f === 'icon' ? (trim || (L[i].icon === 'dot' ? 'dot' : '')) : v;
      pz.innerHTML = M.prosaPreviewInner(this.hass, { ...(this.P() || {}), prose: L }, { sel: i, act: 'pzsel' });
      M.prosaPreviewScroll(this.root);
    }
    _proseRows() { const R = this._prose(); return ((R && R.rows) || []).map((x) => JSON.parse(JSON.stringify(x || {}))); }
    _proseUp(i, f) { const L = this._proseRows(); if (!L[i]) return; L[i] = f(L[i]) || L[i]; Object.keys(L[i]).forEach((k) => { if (L[i][k] === undefined) delete L[i][k]; }); this.saveP({ prose: L }); }

    /* ======================================================== handlinger */
    _bind() {
      const r = this.root;
      r.addEventListener('click', (e) => this._click(e));
      r.addEventListener('change', (e) => this._input(e, 'change'));
      r.addEventListener('input', (e) => this._input(e, 'input'));
      r.addEventListener('value-changed', (e) => {
        const pe = e.composedPath().find((n) => n.dataset && n.dataset.in === 'pent');
        if (pe) { const v = (e.detail && e.detail.value) || undefined; return this._proseUp(Number(pe.dataset.i), (p) => ({ ...p, [pe.dataset.f]: v })); }
        // «Ved trykk»: lagre tap i HA-format, fjern de gamle nøklene (link, act: 'more')
        const pt = e.composedPath().find((n) => n.dataset && n.dataset.in === 'ptap');
        if (pt) { const v = (e.detail && e.detail.value) || { action: 'none' }; return this._proseUp(Number(pt.dataset.i), (p) => ({ ...p, tap: v, link: undefined, act: p.act === 'more' ? undefined : p.act })); }
      });
      // Fiks 16.11 · flis-editoren: entitet, ikon og handlinger (msh-entity-picker / msh-icon-field / msh-tap-picker)
      r.addEventListener('value-changed', (e) => {
        const el = e.composedPath().find((n) => n.dataset && /^(teent|teicon|tetap|taddent)$/.test(n.dataset.in || ''));
        if (!el) return;
        e.stopPropagation();
        const v = e.detail ? e.detail.value : null, d = el.dataset;
        if (d.in === 'taddent') return this._tileCreate(d.v, v || '', this.u.zadd || undefined);
        if (d.in === 'tetap') { const H = HT(), p = `tile_cfg.${d.k}.`; const pt = { [p + H.TAP_KEYS[d.w]]: v || undefined }; const al = { ic: 'tap_action', card: 'tap_action', hold_ic: 'icon_hold_action', hold_card: 'hold_action' }[d.w]; if (get(this.F(), p + al) != null && d.w !== 'ic' && d.w !== 'card') pt[p + al] = undefined; return this.saveF(pt); }
        return this._teSet(d.k, d.in === 'teent' ? 'entity' : 'icon', v || '');
      });
      // Fiks 17.8 · snarvei-raden: ikonvelger og popup-velger (msh-icon-field / msh-popup-field)
      r.addEventListener('value-changed', (e) => { const el = e.composedPath().find((n) => n.dataset && (n.dataset.in === 'licon' || n.dataset.in === 'lhash')); if (!el || !this.u.sel) return; e.stopPropagation(); const v = (e.detail && e.detail.value) || ''; this.saveF({ [`links.${this.u.sel.id}.${el.dataset.in === 'licon' ? 'icon' : 'hash'}`]: v || undefined }); });
      r.addEventListener('value-changed', (e) => { const el = e.composedPath().find((n) => n.dataset && n.dataset.in === 'icpick'); if (el && this.u.sel) { const v = e.detail && e.detail.value; this._roomSet(this.u.sel.id, { icon: v || undefined }); } });
      // 17.7 / 17.11 / 17.16: kalender-handlinger, Ruter-avvik og kameraets aktiv-tilstand
      r.addEventListener('value-changed', (e) => {
        const el = e.composedPath().find((n) => n.dataset && /^(teextent|teacttrig|teactent|teacticon|caltap)$/.test(n.dataset.in || ''));
        if (!el) return;
        e.stopPropagation();
        const v = e.detail ? e.detail.value : null, d = el.dataset;
        if (d.in === 'caltap') return this.saveF({ [`calendar.${d.w}_action`]: v || undefined });
        if (d.in === 'teextent') return this._teSet(d.k, d.f, v || '');
        if (d.in === 'teacttrig') return this._trigSet(d.k, (L) => { if (L[+d.i]) L[+d.i].entity = v || ''; });
        if (d.in === 'teactent') return this._actSet(d.k, d.f, v || undefined);
        if (d.in === 'teacticon') return this._actSet(d.k, 'icon', v || undefined);
      });
      // 24.4 · søppelkortet: handlinger (msh-tap-picker) og sensorer (msh-entity-picker)
      r.addEventListener('value-changed', (e) => {
        const el = e.composedPath().find((n) => n.dataset && /^(trtap|trent)$/.test(n.dataset.in || ''));
        if (!el) return;
        e.stopPropagation();
        const v = e.detail ? e.detail.value : null, d = el.dataset;
        if (d.in === 'trtap') return this.saveS(d.w === 'tap_action' ? { tap_action: v || undefined, popup_hash: undefined } : { hold_action: v || undefined });
        return this.saveS({ [d.f]: v || undefined });
      });
      r.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target && e.target.tagName === 'INPUT') e.target.blur(); });
      // .sh stopper pointerdown (MSH.overlay) → lytt i capture-fasen på selve arket.
      const sh = this.sheet;
      sh.addEventListener('pointerdown', (e) => this._pd(e), true);
      sh.addEventListener('pointermove', (e) => this._pm(e), true);
      sh.addEventListener('pointerup', (e) => this._pu(e), true);
      sh.addEventListener('pointercancel', (e) => this._pu(e, true), true);
      // Fiks 20.8: når et hold-dra er i gang, stopper touchmove nettleserens scroll (flisene har touch-action: pan-y)
      sh.addEventListener('touchmove', (e) => { const s = this._pdS; if (s && s.mode === 'drag' && e.cancelable) e.preventDefault(); }, { passive: false, capture: true });
      r.addEventListener('contextmenu', (e) => { if (this._drag || this._pdS) e.preventDefault(); });
    }
    _el(e, attr) { for (const n of e.composedPath()) { if (n === this.root) break; if (n.dataset && n.dataset[attr] != null) return n; } return null; }
    _click(e) {
      if (this._swallow) { this._swallow = false; e.preventDefault(); e.stopPropagation(); return; }
      const el = this._el(e, 'a');
      if (!el || el.disabled) return;
      const h = el.dataset.h;
      if (h !== 'off') M.haptic(h || 'light');
      try { this._act(el.dataset.a, el.dataset, el); } catch (x) { console.error('[ki-msh] Tilpass Hjem', x); }
    }
    _act(a, d) {
      const u = this.u;
      if (a === 'done') return this._done();
      if (a === 'cancel') return this.close();
      if (a === 'sec') { u.sec = d.v; u.sel = null; u.pick = null; return this.render(); }
      if (a === 'reset') return this._reset();
      if (a === 'tall') { const go = () => M.openTilpassAlt && M.openTilpassAlt(); if (this.tx && this.tx.active && this.tx.dirty) return this._done().then(() => { if (this.closed) go(); }); this.close(); return go(); } // 23.7: utkast lagres først
      if (a === 'acc') { u.acc = { ...u.acc, [d.v]: !u.acc[d.v] }; return this.render(); }
      if (a === 'showtodo' || a === 'blkeye') return this._actBlock(a, d);
      if (a === 'blked') { u.blk = u.blk === d.v ? null : d.v; return this.render(); } // 24.4
      if (a === 'trsug') return this.saveS({ [d.f]: d.v }); // 24.4: autoforslag
      if (a === 'rkpill' && M.romkortPillPanel) return M.romkortPillPanel.act(this, d); // 20.12 (32-romkort.js)
      if (a === 'rkdef') return this.saveF({ [d.k]: d.v === (d.k === 'icon_tap' ? 'toggle_lights' : 'lights') ? undefined : d.v });
      if (u.sec === 'kort') return this._actKort(a, d);
      if (u.sec === 'faner') return this._actFaner(a, d);
      if (u.sec === 'pop') return this._actPop(a, d);
      if (u.sec === 'tekst') return this._actTekst(a, d);
    }
    _reset() {
      const u = this.u, c = this.F();
      M.haptic('warning');
      if (u.sec === 'kort') {
        const id = u.ctx, p = {};
        ['layout', 'tiles', 'tile_order', 'tile_hidden', 'swipe', 'slides'].forEach((k) => { if (get(c, k + '.' + id) !== undefined) p[k + '.' + id] = undefined; });
        u.sel = null; u.pick = null;
        if (Object.keys(p).length) this.saveF(p); else this.render();
      } else if (u.sec === 'faner') {
        this.saveF({ tab_order: undefined, tab_hidden: undefined, tab_labels: undefined, tab_views: undefined, custom_tabs: undefined, tab_height: undefined, tab_height_px: undefined, tab_width: undefined, tab_width_px: undefined });
      } else if (u.sec === 'pop') {
        this._saving = true; try { M.store.set('popups', undefined); } finally { this._saving = false; }
        u.popSel = null; this.render();
      } else { u.proseSel = null; this.saveP({ prose: undefined, prose_font_size: undefined, prose_line_height: undefined, prose_offset: undefined }); this._pgSet(M.HJEM_PROSE_GAP ? M.HJEM_PROSE_GAP.def : 16, true, true); }
    }
    _actBlock(a, d) {
      const H = this.H() || {};
      if (a === 'showtodo' || d.v === 'gjoremal') return this.saveH({ show_todo: H.show_todo === false ? undefined : false });
      const hid = (Array.isArray(H.hidden) ? H.hidden : []).slice(), k = d.v;
      const nh = hid.includes(k) ? hid.filter((x) => x !== k) : [...hid, k];
      return this.saveH({ hidden: nh.length ? nh : undefined });
    }
    _roomSet(id, patch) { const p = {}; Object.keys(patch).forEach((k) => { p[`rooms.${id}.${k}`] = patch[k]; }); this.saveF(p); }
    // Frys dagens kolonnevalg (auto-balansering) så én flytting ikke omrokkerer resten.
    _moveRoom(m, id, side, rel) {
      const t = m.t, order = m.base.map((a) => a.id).filter((x) => x !== id);
      let at = order.length;
      if (rel && rel.before) at = order.indexOf(rel.before);
      else if (rel && rel.after) at = order.indexOf(rel.after) + 1;
      else if (rel && rel.first) { const f = order.find((x) => m.sides[x] === side && !m.hid.includes(x)); at = f ? order.indexOf(f) : order.length; }
      else { const ls = order.filter((x) => m.sides[x] === side && !m.hid.includes(x)).pop(); at = ls ? order.indexOf(ls) + 1 : order.length; }
      if (at < 0) at = order.length;
      order.splice(at, 0, id);
      const sides = { ...m.sides, [id]: side };
      const lay = { ...(get(m.c, 'layout.' + t.id) || {}), order, side: sides, hidden: m.hid.filter((x) => x !== id) };
      if (!lay.hidden.length) delete lay.hidden;
      this.saveF({ ['layout.' + t.id]: lay });
    }
    _moveTile(m, k, slot, rel) {
      const t = m.t, list = m.en.filter((x) => x !== k);
      let at;
      if (rel && rel.before) at = list.indexOf(rel.before);
      else if (rel && rel.after) at = list.indexOf(rel.after) + 1;
      else { const ls = list.filter((x) => tileSlot(m.c, t, x) === slot).pop(); at = ls ? list.indexOf(ls) + 1 : list.length; }
      if (at < 0) at = list.length;
      list.splice(at, 0, k);
      const hid = m.hidT.filter((x) => x !== k);
      this.saveF({ [`tiles.${t.id}.${k}.slot`]: slot, [`tile_order.${t.id}`]: list, [`tile_hidden.${t.id}`]: hid.length ? hid : undefined });
    }
    // Legg et rom ('rom:<id>'), en snarvei (kind) eller en entitet ('ent:<id>' → overrides.<kind>) på Hjem.
    _hcAdd(m, v, side) {
      const u = this.u, t = m.t, c = m.c;
      if (!t || t.kind !== 'hjem') return;
      let x = v, c2 = c;
      if (/^ent:/.test(v)) {
        const id = v.slice(4), dom = id.split('.')[0];
        const k = { lock: 'lock', alarm_control_panel: 'alarm', camera: 'cam', todo: 'todo', vacuum: 'vacr', media_player: 'tv', cover: 'garage' }[dom];
        if (!k) return;
        // Typen finnes allerede på Hjem med en annen entitet → ny flis av samme type (fiks 16.11)
        const onHjem = t.hc && t.hc.cards.includes(k), E0 = m.E && m.E[k], cur = (HT() && HT().tileCfg(c, k).entity) || (E0 && typeof E0 === 'object' ? E0.status : E0);
        if (onHjem && cur && cur !== id && M.hjemNewTileId) { x = M.hjemNewTileId(c2, k); c2 = setIn(c2, 'tile_cfg.' + x, { kind: k, entity: id }); }
        else { c2 = setIn(c2, 'overrides.' + k, id); x = k; }
      }
      const hc = t.hc || (M.hjemCards ? M.hjemCards(this.hass, c) : null);
      if (!hc) return;
      const cards = t.hc ? t.hc.cards.filter((y) => y !== x) : [...m.vis.map((a) => 'rom:' + a.id), ...m.en].filter((y) => y !== x);
      cards.push(x);
      const H = get(c, 'tabs.hjem') || {};
      c2 = setIn(c2, 'tabs.hjem', { ...H, auto_fill: false, cards, seen: H.seen || hc.candidates, exclude: (hc.exclude || []).filter((y) => y !== x) });
      if (!get(c2, 'tabs.hjem.exclude').length) c2 = setIn(c2, 'tabs.hjem.exclude', undefined);
      this._F = c2;
      u.pick = null; u.hcQ = '';
      const m2 = this._model();
      if (/^rom:/.test(x)) {
        const id = x.slice(4), sd = (side && side[0]) || (m2.side('L').length <= m2.side('R').length ? 'L' : 'R');
        u.sel = { t: 'room', id };
        return this._moveRoom(m2, id, sd, null);
      }
      if (!(u.sel && u.sel.z && u.sel.id === x)) u.sel = { t: 'tile', id: x };
      const def = { lock: 'L-top', garage: 'L-top', alarm: 'L-bottom', cam: 'R-bottom', ruter: 'R-bottom', todo: 'R-bottom' }[x] || 'R-top';
      return this._moveTile(m2, x, side ? (side.includes('-') ? side : side + '-' + def.split('-')[1]) : def, null);
    }
    _actKort(a, d) {
      const u = this.u, m = this._model(), t = m.t, c = m.c;
      if (!t) return;
      switch (a) {
        case 'ctx': u.ctx = d.v; u.sel = null; u.pick = null; return this.render();
        case 'tabvis': {
          const hid = (c.tab_hidden || []).slice(), vis = m.T.filter((x) => !x.hidden).length;
          if (!t.hidden && vis <= 1) { M.haptic('warning'); return; }
          M.haptic('selection');
          return this.saveF({ tab_hidden: t.hidden ? hid.filter((x) => x !== t.id) : [...hid, t.id] });
        }
        case 'pick': u.pick = u.pick === d.v ? null : d.v; u.sel = null; return this.render();
        case 'tabfill': return this.saveF({ [`tabs.${t.id}.auto_fill`]: get(c, `tabs.${t.id}.auto_fill`) === false });
        case 'akttype': {
          const cur = M.aktTypes ? M.aktTypes(c) : [], nx = cur.includes(d.v) ? cur.filter((x) => x !== d.v) : [...cur, d.v];
          const order = (M.AKT_TYPES || []).map((x) => x[0]);
          return this.saveF({ 'tabs.aktuelt': { ...(get(c, 'tabs.aktuelt') || {}), auto_fill: false, types: order.filter((x) => nx.includes(x)) } });
        }
        case 'hcaddopen': u.hcAdd = !u.hcAdd; u.hcQ = ''; u.pick = null; u.sel = null; return this.render();
        case 'hcreset': {
          if (!u.hcConfirm) { u.hcConfirm = true; clearTimeout(this._hcT); this._hcT = setTimeout(() => { u.hcConfirm = false; this.render(); }, 3500); return this.render(); }
          u.hcConfirm = false; clearTimeout(this._hcT); u.sel = null; u.pick = null; u.hcAdd = false;
          const hc = M.hjemCards(this.hass, { ...c, tabs: { ...(c.tabs || {}), hjem: { auto_fill: false } } });
          M.toast && M.toast('Hjem er tilbakestilt til forslag');
          return this.saveF({ 'tabs.hjem': { auto_fill: false, cards: hc.curated(), seen: hc.candidates }, 'layout.hjem': undefined, 'tiles.hjem': undefined, 'tile_order.hjem': undefined, 'tile_hidden.hjem': undefined });
        }
        case 'hcadd': return this._hcAdd(m, d.v);
        case 'hcno': { if (!t.hc) return; const ex = [...t.hc.exclude.filter((x) => x !== d.v), d.v]; return this.saveF({ 'tabs.hjem': this._hcObj(m, t.hc.cards, ex) }); }
        case 'selroom': u.sel = u.sel && u.sel.t === 'room' && u.sel.id === d.v ? null : { t: 'room', id: d.v }; u.pick = null; u.icQ = ''; return this.render();
        case 'seltile': u.sel = u.sel && u.sel.t === 'tile' && u.sel.id === d.v && !u.sel.z ? null : { t: 'tile', id: d.v }; u.pick = null; u.ted = null; return this.render();
        // 17.10: editoren under raden i sonen (u.sel.z = samme valg som layout-panelet bruker, men uten panelet øverst)
        case 'tedit': u.ted = u.ted === d.v ? null : d.v; u.tadd = null; u.sel = u.ted ? { t: 'tile', id: u.ted, z: true } : u.sel && u.sel.z ? null : u.sel; return this.render();
        case 'zaddopen': u.zadd = u.zadd === d.v ? null : d.v; u.tadd = null; return this.render();
        case 'zadd': {
          const z = d.z, v = d.v;
          if (v === 'link') {
            const lk = Object.keys(c.links || {}), nx = 'l' + pad2(lk.reduce((mx, x) => Math.max(mx, parseInt(x.slice(1), 10) || 0), 0) + 1);
            this._F = setIn(c, 'links.' + nx, { title: 'Ny snarvei', icon: 'mdi:star' });
            if (t.hc) this._F = setIn(this._F, 'tabs.hjem', this._hcObj(m, [...t.hc.cards, nx], t.hc.exclude));
            u.zadd = null; u.ted = nx; u.sel = { t: 'tile', id: nx, z: true };
            return this._moveTile(this._model(), nx, z, null);
          }
          if (v === 'jul') { u.zadd = null; u.ted = 'jul'; u.sel = { t: 'tile', id: 'jul', z: true }; if (t.hc) return this._hcAdd(m, 'jul', z); return this._moveTile(m, 'jul', z, null); }
          if (!(m.E && m.E[v])) { u.zadd = z; u.tadd = v; return this.render(); } // fant ingen entitet → velg først
          return this._tileCreate(v, '', z);
        }
        case 'zmove': { const k2 = d.k; return this._moveTile(m, k2, d.v, null); }
        case 'teact': return this._actSet(d.k, d.f, d.v);
        case 'teactb': { const H = HT(), a0 = H.tileCfg(c, d.k).active || {}; return this._actSet(d.k, d.f, a0[d.f] ? undefined : true); }
        case 'teactow': { const H = HT(), cur = M.hjemCam.listOf((H.tileCfg(c, d.k).active || {}).only_when); const nx = cur.includes(d.v) ? cur.filter((x) => x !== d.v) : [...cur, d.v]; return this._actSet(d.k, 'only_when', nx.length ? nx : undefined); }
        case 'teacttop': return this._trigSet(d.k, (L) => { if (L[+d.i]) L[+d.i].op = d.v; });
        case 'teacttdel': return this._trigSet(d.k, (L) => { L.splice(+d.i, 1); });
        case 'teacttadd': return this._trigSet(d.k, (L) => { L.push({ entity: '', op: '=', value: 'on' }); });
        case 'teflag': return this.saveF({ [`tile_cfg.${d.k}.${d.f}`]: d.v === '1' ? undefined : false });
        case 'testd': return this.saveF({ [`tile_cfg.${d.k}.state_text.${d.v}`]: undefined }); // 20.7
        case 'caled': u.calEd = !u.calEd; return this.render();
        case 'calent': { const all = M.all(this.hass, 'calendar'), sel = (get(c, 'calendar.entities') || []).filter((x) => all.includes(x)), cur = sel.length ? sel : all; const nx = cur.includes(d.v) ? cur.filter((x) => x !== d.v) : [...cur, d.v]; return this.saveF({ 'calendar.entities': nx.length && nx.length < all.length ? nx : undefined }); }
        case 'calallday': return this.saveF({ 'calendar.all_day': get(c, 'calendar.all_day') === false ? undefined : false });
        case 'taddopen': u.tadd = u.tadd ? null : 'types'; u.ted = null; return this.render();
        case 'taddtype': u.tadd = d.v; return this.render();
        case 'tereset': { const k2 = d.k, x = get(c, 'tile_cfg.' + k2) || {}; const keep = k2 !== (HT() && HT().kindOf(c, k2)) ? { kind: x.kind, side: x.side, pos: x.pos } : undefined; M.haptic('warning'); return this.saveF({ ['tile_cfg.' + k2]: keep }); }
        case 'addroom': {
          const id = d.v, side = u.pick || 'L';
          if (t.hc) return this._hcAdd(m, 'rom:' + id, side);
          if (!m.base.some((x) => x.id === id)) {
            const add = get(c, `layout.${t.id}.add`) || {}, keys = Object.keys(add);
            const nx = 'a' + pad2(keys.reduce((mx, k) => Math.max(mx, parseInt(k.slice(1), 10) || 0), 0) + 1);
            const c2 = setIn(c, `layout.${t.id}.add.${nx}`, id);
            this._F = c2;
            const m2 = this._model();
            u.pick = null; u.sel = { t: 'room', id };
            return this._moveRoom(m2, id, side, null);
          }
          u.pick = null; u.sel = { t: 'room', id };
          return this._moveRoom(m, id, side, null);
        }
        case 'addtile': { const side = u.pick || 'L'; if (t.hc) return this._hcAdd(m, d.v, side); u.pick = null; u.sel = { t: 'tile', id: d.v }; return this._moveTile(m, d.v, side + '-bottom', null); }
        case 'addlink': {
          const links = c.links || {}, lk = Object.keys(links);
          const nx = 'l' + pad2(lk.reduce((mx, k) => Math.max(mx, parseInt(k.slice(1), 10) || 0), 0) + 1);
          const side = u.pick || 'L';
          this._F = setIn(c, 'links.' + nx, { title: 'Ny snarvei', icon: 'mdi:star' });
          if (t.hc) this._F = setIn(this._F, 'tabs.hjem', this._hcObj(m, [...t.hc.cards, nx], t.hc.exclude));
          u.pick = null; u.sel = { t: 'tile', id: nx };
          return this._moveTile(this._model(), nx, side + '-bottom', null);
        }
        case 'slide': { const p = `slides.${t.id}.${d.s}.${d.v}`; return this.saveF({ [p]: get(c, p) ? undefined : true }); }
        // Fiks 20.4: «Vis prikker» og «Vis først når …»-regler per karusell
        case 'cardots': { const p = `carousel.${t.id}.${d.s}.dots`; return this.saveF({ [p]: get(c, p) === false ? undefined : false }); }
        case 'cradd': case 'crdel': case 'crup': case 'crslide': case 'crpre': {
          const p = `carousel.${t.id}.${d.s}.first`, L = (Array.isArray(get(c, p)) ? get(c, p) : []).map((x) => ({ ...x })), i = Number(d.i), txt = (u.crTxt = u.crTxt || {});
          Object.keys(txt).forEach((k) => { if (k.startsWith(`${t.id}-${d.s}-`)) delete txt[k]; }); // ugyldig tekst under arbeid følger ikke med når rekkefølgen endres
          if (a === 'cradd') L.push({ slide: 'rooms', condition: [] });
          else if (a === 'crdel') L.splice(i, 1);
          else if (a === 'crup' && i > 0) [L[i - 1], L[i]] = [L[i], L[i - 1]];
          else if (a === 'crslide' && L[i]) L[i].slide = d.v;
          else if (a === 'crpre' && L[i]) { const pr = (M.hjemCar ? M.hjemCar.presets(this.hass, c) : []).find((x) => x[0] === d.v); if (pr) L[i].condition = [pr[2]]; }
          return this.saveF({ [p]: L.length ? L : undefined });
        }
        case 'swall': { const p = `swipe.${t.id}.${d.v}`; return this.saveF({ [p]: !m.slotAll(d.v) }); }
        default:
      }
      // valgt rom
      if (u.sel && u.sel.t === 'room' && /^(r|look|b|allic|allcol)/.test(a)) {
        const id = u.sel.id, r = m.rooms.find((x) => x.id === id);
        if (!r) return;
        switch (a) {
          case 'rhide': {
            u.sel = null;
            if (t.hc) { const x = 'rom:' + id; return this.saveF({ 'tabs.hjem': this._hcObj(m, t.hc.cards.filter((y) => y !== x), [...t.hc.exclude.filter((y) => y !== x), x]) }); }
            const lay = { ...(get(c, 'layout.' + t.id) || {}), side: { ...m.sides }, hidden: [...m.hid, id] }; return this.saveF({ ['layout.' + t.id]: lay }); }
          case 'rmove': {
            const ids = m.side(m.sides[id]).map((x) => x.id), i = ids.indexOf(id), j = ids[i + Number(d.v)];
            if (!j) return;
            return this._moveRoom(m, id, m.sides[id], Number(d.v) < 0 ? { before: j } : { after: j });
          }
          case 'rswap': return this._moveRoom(m, id, m.sides[id] === 'L' ? 'R' : 'L', null);
          case 'rsize': return this._roomSet(id, { size: d.v });
          case 'rklima': if (!r.can || r.size === 'S') return; M.haptic('selection'); return this._roomSet(id, { klima: !r.klima });
          case 'lookicon': return this._roomSet(id, { icon: d.v === r.baseIcon ? undefined : d.v });
          case 'lookcol': return this._roomSet(id, { color: sameCol(d.v, r.baseCol) ? undefined : d.v });
          case 'lookreset': return this._roomSet(id, { icon: undefined, color: undefined });
          case 'allic': u.allIc = !u.allIc; return this.render();
          case 'allcol': u.allCol = !u.allCol; return this.render();
          case 'bown': {
            M.haptic('selection');
            const own = !get(c, `rooms.${id}.badges_own`);
            const p = { [`rooms.${id}.badges_own`]: own || undefined };
            if (own && !Object.keys(get(c, `rooms.${id}.badges`) || {}).length) {
              const b = {}; (M.romBadgeDefaults ? M.romBadgeDefaults(r) : []).forEach((x, i) => { b['v' + pad2(i + 1)] = { ...x }; });
              if (Object.keys(b).length) p[`rooms.${id}.badges`] = b;
            }
            return this.saveF(p);
          }
          case 'badd': {
            const B = get(c, `rooms.${id}.badges`) || {}, n = Object.keys(B).reduce((mx, k) => Math.max(mx, parseInt(k.replace(/\D/g, ''), 10) || 0), 0) + 1;
            return this.saveF({ [`rooms.${id}.badges.v${pad2(n)}`]: { type: 'temp', op: '>', val: 26, text: 'Varmt' } });
          }
          case 'bdel': return this.saveF({ [`rooms.${id}.badges.${d.k}`]: undefined });
          case 'bop': return this.saveF({ [`rooms.${id}.badges.${d.k}.op`]: d.v });
          default:
        }
        return;
      }
      // valgt snarvei (også fra listen i «Snarveier»)
      const k = d.k || (u.sel && u.sel.t === 'tile' ? u.sel.id : null);
      if (!k) return;
      const sl = tileSlot(c, t, k), [sd, pos] = sl.split('-');
      switch (a) {
        case 'thide': {
          if (u.sel && u.sel.id === k) u.sel = null;
          if (u.ted === k) u.ted = null;
          if (t.hc && HT() && HT().kindOf(c, k) && !KINDS[k]) return this.saveF({ 'tabs.hjem': this._hcObj(m, t.hc.cards.filter((y) => y !== k), t.hc.exclude.filter((y) => y !== k)), [`tiles.${t.id}.${k}`]: undefined, ['tile_cfg.' + k]: undefined });
          if (t.hc) return this.saveF({ 'tabs.hjem': this._hcObj(m, t.hc.cards.filter((y) => y !== k), [...t.hc.exclude.filter((y) => y !== k), k]), [`tiles.${t.id}.${k}.slot`]: undefined });
          const hid = m.hidT.filter((x) => x !== k);
          return this.saveF({ [`tiles.${t.id}.${k}.slot`]: 'off', [`tile_hidden.${t.id}`]: hid.length ? hid : undefined });
        }
        case 'tmove': {
          const grp = m.inSlot(sl), i = grp.indexOf(k), j = grp[i + Number(d.v)];
          if (!j) return;
          return this._moveTile(m, k, sl, Number(d.v) < 0 ? { before: j } : { after: j });
        }
        case 'tswap': return this._moveTile(m, k, (sd === 'L' ? 'R' : 'L') + '-' + pos, null);
        case 'tpos': return this._moveTile(m, k, sd + '-' + d.v, null);
        case 'tstack': {
          if (m.slotAll(sl)) return this.saveF({ [`swipe.${t.id}.${sl}`]: false, [`tiles.${t.id}.${k}.stack`]: false });
          return this.saveF({ [`tiles.${t.id}.${k}.stack`]: !m.stackOf(k) });
        }
        case 'lcolor': return this.saveF({ [`links.${k}.color`]: d.v === 'ingen' ? undefined : d.v });
        default:
      }
    }
    _actFaner(a, d) {
      const u = this.u, c = this.F(), T = allTabs(this.hass, c), ids = T.map((t) => t.id), t = T.find((x) => x.id === d.k);
      switch (a) {
        case 'tabmv': { const i = ids.indexOf(d.k), j = i + Number(d.v); if (j < 0 || j >= ids.length) return; const o = ids.slice(); [o[i], o[j]] = [o[j], o[i]]; M.haptic('selection'); return this.saveF({ tab_order: o }); }
        case 'tabeye': {
          if (!t) return;
          const hid = (c.tab_hidden || []).slice();
          if (!t.hidden && T.filter((x) => !x.hidden).length <= 1) { M.haptic('warning'); return; }
          return this.saveF({ tab_hidden: t.hidden ? hid.filter((x) => x !== t.id) : [...hid, t.id] });
        }
        case 'tabdel': {
          if (!t || t.kind !== 'custom') return;
          const list = String(c.custom_tabs || '').split(',').map((x) => x.trim()).filter((x) => x && 'c_' + M.slug(x) !== t.id);
          const p = { custom_tabs: list.join(', ') || undefined, ['tab_labels.' + t.id]: undefined, ['tab_views.' + t.id]: undefined, ['layout.' + t.id]: undefined, ['tiles.' + t.id]: undefined };
          if (Array.isArray(c.tab_order)) p.tab_order = c.tab_order.filter((x) => x !== t.id);
          if (Array.isArray(c.tab_hidden)) p.tab_hidden = c.tab_hidden.filter((x) => x !== t.id);
          return this.saveF(p);
        }
        case 'hapticdev': { this._saving = true; try { M.setHapticOff(!M.hapticOff()); } finally { this._saving = false; } return this.render(); } // Fiks 18.5: per enhet, lagres straks
        case 'glassanim': { if (M.setGlassAnim) { this._saving = true; try { M.setGlassAnim(!(M.glassAnimOn && M.glassAnimOn())); } finally { this._saving = false; } } return this.render(); } // ki-store ui.glass_anim (Fiks 17.18)
        case 'tabview': return this.saveF({ ['tab_views.' + d.k]: d.v });
        case 'tabcards': u.sec = 'kort'; u.ctx = d.k; u.sel = null; u.pick = null; return this.render();
        case 'tabnew': {
          const ex = String(c.custom_tabs || '').split(',').map((x) => x.trim()).filter(Boolean);
          let n = 1, name = 'Ny fane';
          while (ex.some((x) => M.slug(x) === M.slug(name)) || ids.includes('c_' + M.slug(name))) { n++; name = 'Ny fane ' + n; }
          return this.saveF({ custom_tabs: [...ex, name].join(', ') });
        }
        case 'tabset': {
          const p = { [d.k]: d.v === 'std' ? undefined : d.v };
          if (d.v === 'custom') { const pk = d.k + '_px'; if (!c[pk]) p[pk] = d.k === 'tab_height' ? TAB_H[c.tab_height || 'std'] || 38 : 88; }
          return this.saveF(p);
        }
        case 'tabstep': { const v = M.clamp((Number(c[d.k]) || Number(d.def)) + Number(d.v), Number(d.min), Number(d.max)); return this.saveF({ [d.k]: v }); }
        case 'bcond': return this.saveF({ 'battery.cond': d.v });
        case 'bshow': return this.saveF({ 'battery.show': d.v === 'lav' ? undefined : d.v });
        case 'balways': M.haptic('selection'); return this.saveF({ 'battery.always': get(c, 'battery.always') ? undefined : true });
        default:
      }
    }
    _actPop(a, d) {
      if (M.popupsPanel && M.popupsPanel.act(this, a, d)) return;
      const u = this.u;
      switch (a) {
        case 'popg': u.popG = d.v; return this.render();
        case 'popsel': u.popSel = u.popSel === d.v ? null : d.v; return this.render();
        case 'pophide': { M.haptic('selection'); const cur = (this._popCfg()[d.v] || {}); return this._popSet(d.v, { hidden: !cur.hidden }); }
        case 'popcol': return this._popSet(d.k, { color: d.v });
        case 'popreset': return this._popSet(d.v, { name: undefined, icon: undefined, color: undefined });
        default:
      }
    }
    _actTekst(a, d) {
      const u = this.u, i = Number(d.i);
      switch (a) {
        case 'psize': { const PCf = customElements.get('msh-prosa-card'), F = ((PCf && PCf.sizeFields) || []).find((f) => f.name === d.f), def = F && F.default != null ? F.default : null, v = d.v === '' ? undefined : Number(d.v); return this.saveP({ [d.f]: v === undefined || (def != null && Math.abs(v - def) < 0.001) ? undefined : v, prose_offset: undefined }); }
        case 'pgap': return this._pgSet(Number(d.v), true);
        case 'psel': u.proseSel = u.proseSel === i ? null : i; return this.render();
        case 'pzsel': { u.proseSel = i; this.render(); const el = this.root.querySelector(`[data-key="pro-${i}"]`); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); return; } // 20.9: boble i forhåndsvisningen
        case 'pmv': { const L = this._proseRows(), j = i + Number(d.v); if (j < 0 || j >= L.length) return; [L[i], L[j]] = [L[j], L[i]]; if (u.proseSel === i) u.proseSel = j; M.haptic('selection'); return this.saveP({ prose: L }); }
        case 'peye': return this._proseUp(i, (p) => ({ ...p, hidden: p.hidden ? undefined : true }));
        case 'pdel': { const L = this._proseRows(); L.splice(i, 1); if (u.proseSel === i) u.proseSel = null; return this.saveP({ prose: L }); }
        case 'padd': { const L = this._proseRows(); L.push({ id: 'p' + Date.now().toString(36), pre: 'Ny tekst', src: 'none', fmt: '{v}', post: '', icon: '', color: 'hvit', cop: 'alltid' }); u.proseSel = L.length - 1; return this.saveP({ prose: L }); }
        case 'ptok': return this._proseUp(i, (p) => ({ ...p, [d.f]: `${p[d.f] || ''} ${d.v}`.trim() }));
        case 'picon': return this._proseUp(i, (p) => ({ ...p, icon: d.v }));
        case 'pcol': return this._proseUp(i, (p) => ({ ...p, color: d.v }));
        case 'pop': return this._proseUp(i, (p) => { const R = this._prose(); return { ...p, cop: d.v, csrc: d.v === 'alltid' ? p.csrc : p.csrc || (R && R.S[p.src] ? p.src : 'price') }; });
        case 'ptest': {
          const p = this._proseRows()[i]; if (!p) return;
          const m = /^([a-z_]+)\.([a-z0-9_]+)$/.exec(String(p.svc || '').trim());
          if (!m) { M.toast('Ugyldig tjeneste: ' + (p.svc || '–')); return; }
          let data = {};
          if (p.data && typeof p.data === 'object') data = { ...p.data };
          else if (p.data) { try { data = JSON.parse(p.data); } catch (e) { String(p.data).split(/[\n,]/).forEach((l) => { const x = /^\s*([\w.]+)\s*[:=]\s*(.+?)\s*$/.exec(l); if (x) data[x[1]] = M.isNum(x[2]) ? Number(x[2]) : x[2]; }); } }
          if (p.target) data.entity_id = p.target;
          M.call(this.hass, m[1], m[2], data).then(() => M.toast('Kjørte ' + p.svc)).catch(() => {});
          return;
        }
        default:
      }
    }
    _input(e, kind) {
      const el = this._el(e, 'in');
      if (!el) return;
      const k = el.dataset.in, d = el.dataset, v = el.value, u = this.u;
      if (u.sec === 'pop' && M.popupsPanel && M.popupsPanel.input(this, el, kind)) return;
      if (k === 'rkpill' && M.romkortPillPanel && M.romkortPillPanel.input(this, el, kind)) return; // 20.12
      // live under skriving: kun søk og slidere
      if (kind === 'input') {
        if (k === 'icq') { u.icQ = v; return this._schedule(); }
        if (k === 'hcq') { u.hcQ = v; return this._schedule(); }
        if (k === 'teactnum') { const b = el.parentNode.querySelector('.ahold'); if (b) b.textContent = v + ' min'; return; }
        if (k === 'blimit') { const l = this.root.querySelector('[data-lim]'); if (l) l.textContent = v + ' %'; return; }
        if (k === 'tabpx') { const s = el.parentNode.querySelector('.stp span'); if (s) s.textContent = v + ' px'; return; }
        if (k === 'pgap') return this._pgSet(Number(v), false);
        if (k === 'pf') return this._pzLive(Number(d.i), d.f, v); // 20.9: forhåndsvisningen per tastetrykk
        if (k === 'psz') { const s = this.root.querySelector('.pszv-' + d.k); if (s) s.textContent = M.nf(Number(v), 2).replace(/0$/, '') + ' em'; const pz = this.root.querySelector('[data-key="prev"] .pz'); if (pz) { if (d.k === 'fs') pz.style.fontSize = Number(v) + 'em'; else pz.style.lineHeight = String(Number(v)); } const lp = this.prosaLive; if (lp && lp._rawConfig) lp.setConfig({ ...lp._rawConfig, [d.f]: Number(v), __eff: 1 }); return; }
        return;
      }
      if (el.type === 'color' || el.tagName === 'SELECT' || el.type === 'range') M.haptic('selection');
      const trim = String(v).trim();
      switch (k) {
        case 'icq': case 'hcq': return;
        case 'iconraw': if (u.sel) return this._roomSet(u.sel.id, { icon: trim || undefined }); return;
        case 'lookhex': if (u.sel) return this._roomSet(u.sel.id, { color: v }); return;
        case 'btype': case 'bval': case 'bent': case 'btext': {
          if (!u.sel) return;
          const f = { btype: 'type', bval: 'val', bent: 'ent', btext: 'text' }[k];
          return this.saveF({ [`rooms.${u.sel.id}.badges.${d.k}.${f}`]: trim || undefined });
        }
        case 'ltitle': case 'lsub': case 'licon': case 'lhash': case 'lent': case 'lact': {
          if (!u.sel) return;
          const f = { ltitle: 'title', lsub: 'sub', licon: 'icon', lhash: 'hash', lent: 'entity', lact: 'act' }[k];
          if (f === 'title' && !trim) return M.toast('Snarveien må ha en tittel');
          return this.saveF({ [`links.${u.sel.id}.${f}`]: trim || undefined });
        }
        case 'tcard': case 'ticon': case 'tihash': case 'tscript': {
          if (!u.sel) return;
          const f = { tcard: 'card_hash', ticon: 'icon', tihash: 'icon_hash', tscript: 'script' }[k];
          let val = trim;
          if ((f === 'card_hash' || f === 'icon_hash') && val && val[0] !== '#') val = '#' + val;
          if (f === 'icon' && val === 'auto') val = undefined;
          return this.saveF({ [`tap.${u.sel.id}.${f}`]: val || undefined });
        }
        case 'crcond': { // Fiks 20.4: YAML → objekt (liste); ugyldig → rød feilmelding, teksten beholdes, ingenting lagres
          const m = this._model(), p = `carousel.${m.t.id}.${d.s}.first`, L = (Array.isArray(get(m.c, p)) ? get(m.c, p) : []).map((x) => ({ ...x })), i = Number(d.i), key = `${m.t.id}-${d.s}-${i}`, txt = (u.crTxt = u.crTxt || {});
          if (!L[i]) return;
          const r = M.condParse(v);
          if (r.error) { txt[key] = v; return this._schedule(); }
          delete txt[key];
          L[i].condition = r.value == null ? [] : Array.isArray(r.value) ? r.value : [r.value];
          return this.saveF({ [p]: L });
        }
        case 'tefield': return this._teSet(d.k, d.f, trim);
        case 'teactf': return this._actSet(d.k, d.f, trim || undefined);
        case 'teactnum': return this._actSet(d.k, d.f, Number(v) === 2 ? undefined : Number(v));
        case 'teacttf': return this._trigSet(d.k, (L) => { if (L[+d.i]) L[+d.i][d.f] = trim || undefined; });
        case 'tename': case 'tesub': case 'teiconraw': return this._teSet(d.k, { tename: 'name', tesub: 'sub', teiconraw: 'icon' }[k], trim);
        case 'tfra': case 'ttil': {
          if (!u.sel) return;
          const m = this._model();
          return this.saveF({ [`tiles.${m.t.id}.${u.sel.id}.${k === 'tfra' ? 'fra' : 'til'}`]: trim });
        }
        case 'tlabel': {
          const c = this.F(), T = allTabs(this.hass, c), t = T.find((x) => x.id === d.k);
          if (!t) return;
          return this.saveF({ ['tab_labels.' + t.id]: trim && trim !== t.autoLabel ? trim : undefined });
        }
        case 'tabpx': return this.saveF({ [d.k]: Number(v) });
        case 'psz': return this.saveP({ [d.f]: Number(v), prose_offset: undefined });
        case 'pgap': return this._pgSet(Number(v), true);
        case 'bcond': return this.saveF({ 'battery.cond': trim || undefined });
        case 'blimit': return this.saveF({ 'battery.limit': Number(v) === 20 ? undefined : Number(v) });
        case 'popname': return this._popSet(d.k, { name: trim || undefined });
        case 'popicon': return this._popSet(d.k, { icon: trim || undefined });
        case 'popcolhex': return this._popSet(d.k, { color: v });
        case 'pf': return this._proseUp(Number(d.i), (p) => ({ ...p, [d.f]: d.f === 'icon' ? (trim || (p.icon === 'dot' ? 'dot' : '')) : v }));
        case 'psrc': return this._proseUp(Number(d.i), (p) => ({ ...p, src: v, fmt: v === 'text' ? (p.src === 'text' ? p.fmt : 'Tekst') : (p.src === 'text' || !p.fmt ? '{v}' : p.fmt) }));
        case 'pact': return this._proseUp(Number(d.i), (p) => ({ ...p, act: v || undefined }));
        case 'pcsrc': return this._proseUp(Number(d.i), (p) => ({ ...p, csrc: v }));
        default:
      }
    }

    /* ---------- dra og slipp (pointer events) */
    // Mus: dra etter 5 px. Touch: hold 300 ms for å dra; beveger man seg før det, ruller arket (touch-action: none på flisene).
    _pd(e) {
      if (e.button) return;
      const el = this._el(e, 'drag');
      const ct = !el && this._el(e, 'a') && e.composedPath().find((n) => n.classList && n.classList.contains('ct'));
      if (ct) return this._ctDown(e, ct);
      if (!el) return;
      const touch = e.pointerType !== 'mouse';
      const fromInput = !!e.composedPath().find((n) => n.tagName && /^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(n.tagName) && n !== el);
      const s = this._pdS = { el, type: el.dataset.drag, id: el.dataset.id, x: e.clientX, y: e.clientY, pid: e.pointerId, touch, mode: null, st0: this.sheet.scrollTop, fromInput };
      if (touch && !fromInput) s.timer = setTimeout(() => { if (this._pdS === s && !s.mode) this._startDrag(s, e); }, 300);
    }
    _pm(e) {
      if (this._ctS) return this._ctMove(e);
      const s = this._pdS;
      if (!s || e.pointerId !== s.pid) return;
      const dx = e.clientX - s.x, dy = e.clientY - s.y;
      if (!s.mode) {
        // Fiks 20.8: beveger fingeren seg før holdet, eier nettleseren scrollen (touch-action: pan-y på flisene/radene,
        // kompositor-scroll med moment) – ikke lenger scrollTop i JS per pointermove (hakket, særlig i Faner).
        if (s.touch) { if (Math.abs(dx) > 8 || Math.abs(dy) > 8) { clearTimeout(s.timer); this._pdS = null; } return; }
        else { if (s.fromInput) return; if (Math.abs(dx) > 5 || Math.abs(dy) > 5) this._startDrag(s, e); else return; }
      }
      if (s.mode === 'scroll') { e.preventDefault(); this.sheet.scrollTop = s.st0 - dy; return; }
      if (s.mode === 'drag') { e.preventDefault(); this._dragMove(s, e); }
    }
    _pu(e, cancel) {
      if (this._ctS) return this._ctUp(e, cancel);
      const s = this._pdS;
      if (!s || e.pointerId !== s.pid) return;
      clearTimeout(s.timer);
      this._pdS = null;
      if (s.mode === 'scroll') { this._swallow = true; setTimeout(() => { this._swallow = false; }, 300); return; }
      if (s.mode !== 'drag') return;
      this._swallow = true; setTimeout(() => { this._swallow = false; }, 300);
      this._endDrag(s, cancel ? null : this._target);
    }
    _startDrag(s, e) {
      s.mode = 'drag';
      this._drag = s;
      try { s.el.setPointerCapture(s.pid); } catch (x) { /* */ }
      M.haptic('medium');
      const r = s.el.getBoundingClientRect();
      s.ox = s.x - r.left; s.oy = s.y - r.top;
      const g = document.createElement('div');
      g.className = 'ghost';
      g.innerHTML = s.el.outerHTML;
      const inner = g.firstElementChild;
      inner.removeAttribute('data-drop'); inner.style.width = r.width + 'px'; inner.style.margin = '0';
      Object.assign(g.style, { width: r.width + 'px', borderRadius: getComputedStyle(s.el).borderRadius });
      this.root.appendChild(g);
      s.ghost = g;
      s.el.classList.add('src');
      const gr = this.root.querySelector('.gr');
      if (gr && s.type !== 'tab') gr.classList.add('dnd');
      this._dragMove(s, e);
    }
    _dragMove(s, e) {
      const x = e.clientX, y = e.clientY;
      s.ghost.style.transform = `translate(${x - s.ox}px, ${y - s.oy}px) scale(1.04)`;
      // auto-rull nær kantene
      const sr = this.sheet.getBoundingClientRect();
      if (y < sr.top + 60) this.sheet.scrollTop -= 10; else if (y > sr.bottom - 60) this.sheet.scrollTop += 10;
      const hit = this.root.elementFromPoint ? this.root.elementFromPoint(x, y) : null;
      let n = hit, tgt = null;
      while (n && n !== this.root) { if (n.dataset && n.dataset.drop && n !== s.el) { tgt = n; break; } n = n.parentNode || n.host; }
      if (tgt && s.type === 'tab' ? !/^tab:/.test(tgt.dataset.drop) : tgt && /^tab:/.test(tgt.dataset.drop)) tgt = null;
      let pos = null;
      if (tgt && /^(room|tile|tab|pop):/.test(tgt.dataset.drop)) { const rr = tgt.getBoundingClientRect(); pos = y > rr.top + rr.height / 2 ? 'b' : 't'; }
      const key = tgt ? tgt.dataset.drop + '|' + pos : null;
      if (key !== s.key) {
        this.root.querySelectorAll('.hov-t,.hov-b,.hov').forEach((z) => z.classList.remove('hov-t', 'hov-b', 'hov'));
        if (tgt) { if (pos) tgt.classList.add(pos === 'b' ? 'hov-b' : 'hov-t'); else tgt.classList.add('hov'); }
        if (s.key !== undefined && key) M.haptic('selection');
        s.key = key;
      }
      this._target = tgt ? { drop: tgt.dataset.drop, pos } : null;
    }
    _endDrag(s, target) {
      if (s.ghost) s.ghost.remove();
      s.el.classList.remove('src');
      this.root.querySelectorAll('.hov-t,.hov-b,.hov').forEach((z) => z.classList.remove('hov-t', 'hov-b', 'hov'));
      const gr = this.root.querySelector('.gr'); if (gr) gr.classList.remove('dnd');
      this._drag = null; this._target = null;
      if (!target) return this.render();
      M.haptic('selection');
      try { this._drop(s, target); } catch (x) { console.error('[ki-msh] Tilpass Hjem drop', x); this.render(); }
    }
    _drop(s, tg) {
      if (s.type === 'pop') return M.popupsPanel ? M.popupsPanel.drop(this, s, tg) : this.render();
      const [kind, a, b] = tg.drop.split(':'), after = tg.pos === 'b';
      if (s.type === 'tab') {
        if (kind !== 'tab' || a === s.id) return this.render();
        const c = this.F(), ids = allTabs(this.hass, c).map((t) => t.id).filter((x) => x !== s.id);
        let at = ids.indexOf(a); if (after) at++;
        ids.splice(at, 0, s.id);
        return this.saveF({ tab_order: ids });
      }
      const m = this._model();
      if (s.type === 'room') {
        if (kind === 'room') { if (a === s.id) return this.render(); return this._moveRoom(m, s.id, m.sides[a], after ? { after: a } : { before: a }); }
        if (kind === 'hdr') return this._moveRoom(m, s.id, a, b === 'bottom' ? null : { first: true });
        if (kind === 'tile') return this._moveRoom(m, s.id, tileSlot(m.c, m.t, a).split('-')[0], tileSlot(m.c, m.t, a).endsWith('top') ? { first: true } : null);
        if (kind === 'col') return this._moveRoom(m, s.id, a, null);
      }
      if (s.type === 'tile') {
        if (kind === 'tile') { if (a === s.id) return this.render(); return this._moveTile(m, s.id, tileSlot(m.c, m.t, a), after ? { after: a } : { before: a }); }
        if (kind === 'hdr') return this._moveTile(m, s.id, a + '-' + (b === 'bottom' ? 'bottom' : 'top'), null);
        if (kind === 'room') { const side = m.sides[a], list = m.side(side).map((r) => r.id), i = list.indexOf(a); return this._moveTile(m, s.id, side + '-' + (i < list.length / 2 && !after ? 'top' : 'bottom'), null); }
        if (kind === 'col') return this._moveTile(m, s.id, a + '-bottom', null);
      }
      return this.render();
    }
    // Fanevelgeren i «Kort»: trykk velger, dra sideveis = liquid glass-valg (som fanelinjen).
    // Fiks 20.3 (pending/scroll/drag): flyter raden over (scrollWidth > clientWidth) → > 6 px sideveis = scroll
    // (scrollLeft = start − dx, touch-action: pan-y), slipp velger ingenting; bare rader som passer får glass-drag.
    _ctDown(e, ct) {
      const grid = ct.querySelector('.tg'), items = [...ct.querySelectorAll('.tb')];
      this._ctS = { ct, grid, items, x: e.clientX, y: e.clientY, id: e.pointerId, n: items.length, mode: null, near: null, ovf: ct.scrollWidth > ct.clientWidth + 1, sl0: ct.scrollLeft };
    }
    _ctMove(e) {
      const s = this._ctS; if (!s || e.pointerId !== s.id) return;
      const dx = e.clientX - s.x;
      if (!s.mode) {
        if (Math.abs(dx) <= 6) return;
        if (Math.abs(e.clientY - s.y) > Math.abs(dx)) { this._ctS = null; return; } // loddrett: arket scroller
        s.mode = s.ovf ? 'scroll' : 'glass'; if (!s.ovf) s.ct.classList.add('drag'); try { s.ct.setPointerCapture(s.id); } catch (x) { /* */ }
      }
      e.preventDefault();
      if (s.mode === 'scroll') { s.ct.scrollLeft = s.sl0 - dx; return; }
      const r = s.grid.getBoundingClientRect(), f = (e.clientX - r.left) / Math.max(1, r.width), n = s.n;
      const pos = M.clamp(f, 0.5 / n, 1 - 0.5 / n), near = M.clamp(Math.floor(f * n), 0, n - 1);
      const ind = s.grid.querySelector('.ind'); if (ind) ind.style.left = `${(pos - 0.5 / n) * 100}%`;
      if (near !== s.near) { s.near = near; M.haptic('selection'); s.items.forEach((b, i) => b.classList.toggle('near', i === near)); }
    }
    _ctUp(e, cancel) {
      const s = this._ctS; if (!s || e.pointerId !== s.id) return;
      this._ctS = null;
      if (!s.mode) return;
      this._swallow = true; setTimeout(() => { this._swallow = false; }, 300);
      if (s.mode === 'scroll') return; // scroll velger aldri en fane
      s.ct.classList.remove('drag'); s.items.forEach((b) => b.classList.remove('near'));
      const it = s.items[s.near];
      if (!cancel && it) { this.u.ctx = it.dataset.v; this.u.sel = null; this.u.pick = null; }
      this.render();
    }
  }
})();
