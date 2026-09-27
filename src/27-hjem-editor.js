/* KI MSH · «Tilpass Hjem»-arket. Kilde: Hjem v2.dc.html («Tilpass»: ce.* / edit.* / custEditVals / editVals / lookEd /
 * DEF_TILES / DEF_TABS / TAB_H / SLIDE_L / DEF_PROSE / SRC / ACTS).
 *   MSH.openHomeEditor({ focus })  – åpnes via hendelsesbussen (ki-open-editor, editor:'home') i 03-editors.js.
 * Arket rendres i ki-overlay-root (MSH.overlay, document.body, z-index 9000) – aldri inni kort eller popup.
 * Fanene: Kort · Faner · Popups · Tekst.
 *   Kort/Faner → msh-hjem-faner-card-config (layout.<fane>.{order,side,hidden,add}, rooms.<id>.*, tiles.<fane>.<kind>.*,
 *                tile_order/tile_hidden, swipe, slides, tab_*, custom_tabs, links, tap, battery)
 *   Tekst      → msh-prosa-card-config (prose, prose_offset)
 *   Kort       → også msh-hjem-card-config (show_todo, hidden) – «Kort på Hjem» med øye per kort
 *   Popups     → ki-store popups.<hash uten #> = { hidden, name, icon, color } (leses av strategien ved neste generering)
 * Alt lagres live med MSH.saveCardConfig (ki-store, debounce, ingen navigering); kortene abonnerer på ki-store.
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
  const TILE_DEF = { hjem: { lock: 'L-top', garage: 'L-top', alarm: 'L-bottom', cam: 'R-bottom', ruter: 'R-bottom', todo: 'R-bottom' }, aktuelt: { dish: 'L-top', vacr: 'L-top', tv: 'R-top', wash: 'R-top', dry: 'R-top' } };
  const STACK_DEF = { hjem: { cam: true, ruter: true } };
  const SLIDE_L = { cal: ['calendar_month', 'Kalender'], vaer: ['partly_cloudy_day', 'Vær'], strom: ['bolt', 'Strøm'], trash: ['delete', 'Søppel'] };
  const VIEWS = [['karusell', 'Karusell'], ['liste', 'Kortliste'], ['batterier', 'Batterier']];
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
    return out.map((t) => ({ ...t, autoLabel: t.label, defView: t.view, label: get(c, 'tab_labels.' + t.id) || t.label, view: t.kind === 'batterier' ? 'batterier' : get(c, 'tab_views.' + t.id) || t.view, hidden: (c.tab_hidden || []).includes(t.id) }));
  }
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
    if (t.kind === 'hjem' && M.roomAuto) { const has = (a) => { const au = M.roomAuto(hass, a.id); return au.temp || au.thermo ? 0 : 1; }; base = base.map((a, i) => [a, has(a), i]).sort((x, y) => x[1] - y[1] || x[2] - y[2]).map((x) => x[0]); }
    const ord = get(c, `layout.${t.id}.order`) || [];
    return [...ord.map((id) => base.find((a) => a.id === id)).filter(Boolean), ...base.filter((a) => !ord.includes(a.id))];
  }
  const availKinds = (E, c) => [...KIND_ORDER.filter((k) => k === 'jul' || (E && E[k])), ...Object.keys(c.links || {}).filter((k) => c.links[k] && c.links[k].title).sort()];
  const kindLabel = (k, c) => (KINDS[k] ? KINDS[k][1] : ((c.links || {})[k] || {}).title || 'Snarvei');
  const kindIcon = (k, c) => (KINDS[k] ? KINDS[k][0] : ((c.links || {})[k] || {}).icon || 'mdi:star');
  const tileSlot = (c, t, k) => get(c, `tiles.${t.id}.${k}.slot`) || (TILE_DEF[t.kind] || {})[k] || 'off';
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
  const PICONS = [['', 'Ingen'], ['dot', '● Prikk'], ['💡', '💡'], ['⏰', '⏰'], ['🌤️', '🌤️'], ['⚡', '⚡'], ['🔒', '🔒'], ['🚨', '🚨'], ['🗑️', '🗑️'], ['🏠', '🏠'], ['👋', '👋']];
  const PSW = [['hvit', C.white, 'Hvit'], ['auto', `conic-gradient(${C.green}, ${C.yellow}, ${C.red}, ${C.green})`, 'Auto etter verdi'], ['gronn', C.green, 'Grønn'], ['gul', C.yellow, 'Gul'], ['oransje', C.orange, 'Oransje'], ['rod', C.red, 'Rød'], ['bla', C.blue, 'Blå'], ['rosa', C.pink, 'Rosa']];
  const LINKS = [['', 'Ingen'], ['lock', 'Dørlås (hurtig)'], ['#vaer', 'Vær'], ['#lys', 'Lys'], ['#sikkerhet', 'Sikkerhet'], ['#kamera', 'Kamera'], ['#klima', 'Klima'], ['#gjoremal', 'Gjøremål'], ['#soppel', 'Søppel'], ['#vanning', 'Vanning'], ['#media', 'Media'], ['#basseng', 'Basseng'], ['#ruter', 'Ruter'], ['#strom', 'Strøm']];
  const srcL = (id) => (SRC.find((x) => x[0] === id) || ['', id || ''])[1];

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
    .bg{background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}
    .sh{padding:22px 16px 40px;border-radius:38px 38px 0 0;max-height:calc(100% - 52px);scrollbar-width:none;background:var(--gray100,#2f2f2f);box-shadow:0 -20px 50px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)}
    .sh::-webkit-scrollbar{display:none}
    .ed{display:grid;grid-template-columns:minmax(0,1fr);align-content:start;gap:14px;font-family:${M.FONT};-webkit-user-select:none;user-select:none}
    input,textarea{-webkit-user-select:text;user-select:text}
    .hd{display:flex;align-items:center;gap:8px;padding:0 4px}
    .hd .t{flex:1;font-size:24px;font-weight:600;letter-spacing:-0.02em}
    .b40{height:40px;padding:0 16px;border-radius:20px;background:var(--gray200,#3a3a3a);font-size:14px;font-weight:500}
    .done{height:40px;padding:0 18px;border-radius:20px;background:${PINK};color:#2f2f2f;font-size:14px;font-weight:600}
    .seg{display:flex;gap:2px;padding:4px;border-radius:24px;background:var(--gray200,#3a3a3a)}
    .seg>button{flex:1;height:40px;border-radius:20px;font-size:14px;font-weight:500;color:#afafaf;transition:background .2s,color .2s}
    .on-pk{background:${PINK} !important;color:#2f2f2f !important}
    .ct{justify-self:start;touch-action:pan-y;padding:4px;border-radius:24px;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.14);max-width:100%;overflow-x:auto;scrollbar-width:none;cursor:pointer}
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
    .trk.on{background:rgb(102 209 158)}
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
    .it{display:flex;flex-direction:column;box-sizing:border-box;width:100%;min-width:0;text-align:left;cursor:grab;touch-action:none;transition:box-shadow .15s,opacity .15s}
    .it .l1{display:flex;align-items:center;gap:6px;width:100%;min-width:0}
    .it .nm{flex:1;min-width:0;font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
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
    .tap{display:flex;flex-direction:column;gap:12px;padding:12px;border-radius:18px;background:var(--gray100,#2f2f2f)}
    .tap .th{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:600}
    .chip{height:32px;padding:0 12px;border-radius:16px;flex:none;display:flex;align-items:center;gap:6px;font-size:13px;font-weight:500;white-space:nowrap;background:#545454;color:#fafafa}
    .tok{height:26px;padding:0 9px;border-radius:13px;background:#545454;font-size:11px;white-space:nowrap;color:#afafaf}
    .toks{display:flex;gap:4px;flex-wrap:wrap;max-height:88px;overflow-y:auto;scrollbar-width:none}
    .sw34{width:34px;height:34px;border-radius:17px;flex:none;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.2)}
    .sw34.on{box-shadow:0 0 0 2px #3a3a3a,0 0 0 4px #fafafa}
    .tabr{display:flex;flex-direction:column;gap:10px;padding:10px;border-radius:22px;background:var(--gray200,#3a3a3a);touch-action:none}
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
    .prev{padding:14px 16px;border-radius:24px;background:var(--gray000,#232323);font-size:16px;line-height:1.95;text-wrap:pretty}
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
        if (!path || /^cards(\.|$)/.test(path)) { this._F = null; this._P = null; this._H = null; }
        this._schedule();
      }) : null;
      if (M.store && this.hass) M.store.load(this.hass);
      this.render();
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
      if (M.flushSaves) M.flushSaves();
      if (M.store && M.store.flush) M.store.flush();
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
    _raw(tag, key) {
      const live = M.liveOf(tag);
      if (live && live._rawConfig) return live._rawConfig;
      return M.effectiveConfig({ type: 'custom:' + tag, card_id: M.CARD_IDS[key] });
    }
    F() { return this._F || this._raw('msh-hjem-faner-card', 'faner'); }
    P() { return this._P || this._raw('msh-prosa-card', 'prosa'); }
    H() { return this._H || this._raw('msh-hjem-card', 'home'); }
    // patch: { 'sti': verdi } (undefined/'' = fjern)
    _save(tag, key, patch) {
      const CK = { faner: '_F', prosa: '_P', home: '_H' }[key];
      const old = this._raw(tag, key), base = this[CK] || old;
      let nc = { ...base };
      Object.keys(patch).forEach((p) => { nc = setIn(nc, p, patch[p]); });
      if (!nc.card_id) nc.card_id = old.card_id || M.CARD_IDS[key];
      if (!nc.type) nc.type = old.type || 'custom:' + tag;
      this[CK] = nc;
      this._saving = true;
      try { M.saveCardConfig(this.hass, old, nc, { toasts: false }); } catch (e) { console.error('[ki-msh] Tilpass Hjem', e); } finally { this._saving = false; }
      this._schedule();
    }
    saveF(patch) { this._save('msh-hjem-faner-card', 'faner', patch); }
    saveP(patch) { this._save('msh-prosa-card', 'prosa', patch); }
    saveH(patch) { this._save('msh-hjem-card', 'home', patch); }
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
      const E = this._E(c), avail = availKinds(E, c), hidT = get(c, `tile_hidden.${t.id}`) || [], ord = get(c, `tile_order.${t.id}`) || [];
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
      const secs = [['kort', 'Kort'], ['faner', 'Faner'], ['pop', 'Popups'], ['tekst', 'Tekst']];
      const html = `<div class="ed" data-key="ed">
        <div class="hd"><span class="t">Tilpass</span><button class="b40 press" data-a="reset">Nullstill</button><button class="done press" data-a="done">Ferdig</button></div>
        <div class="seg" data-key="secs">${secs.map(([id, l]) => `<button class="${u.sec === id ? 'on-pk' : ''}" data-a="sec" data-v="${id}" data-h="selection" data-key="sec-${id}">${l}</button>`).join('')}</div>
        ${inner}
      </div>`;
      if (!this._first) { this.body.innerHTML = html; this._first = true; } else M.morph(this.body, html);
      this._after();
    }
    _after() {
      const r = this.root;
      r.querySelectorAll('ha-icon-picker[data-in]').forEach((p) => { p.hass = this.hass; const v = p.getAttribute('data-val') || ''; if (p.value !== v) p.value = v; });
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
      else if (u.sel && u.sel.t === 'tile') panel = this._tilePanel(m, u.sel.id);
      const hint = `<span class="hint">Dra kort og snarveier for å flytte dem, også mellom kolonnene. Trykk for å endre, eller + for å hente et rom fra en annen etasje.</span>`;
      return strip + tgl + grid + panel + hint + (m.car ? this._accSwipe(m) : '') + this._accSnar(m) + this._blocks();
    }
    // Kortene på Hjem (msh-hjem-card): øye per kort (cards skjules via hidden), gjøremål via show_todo.
    _blocks() {
      const H = this.H() || {}, hid = Array.isArray(H.hidden) ? H.hidden : [], todo = H.show_todo !== false;
      const on = (k) => (k === 'gjoremal' ? todo : !hid.includes(k));
      const n = BLOCKS.filter(([k]) => on(k)).length;
      const rows = BLOCKS.map(([k, l, icn]) => `<div class="tr ${on(k) ? '' : 'hid'}" data-key="blk-${k}"><span class="tm">${ic(icn, 22, `color:${on(k) ? '#fafafa' : '#696969'}`)}<span class="tt"><b>${esc(l)}</b><i>${on(k) ? 'Vises' : 'Skjult'}${k === 'gjoremal' ? ' · show_todo' : ''}</i></span></span>
          <button class="sq" data-a="blkeye" data-v="${k}" data-h="selection" title="${on(k) ? 'Skjul' : 'Vis'}">${ic(on(k) ? 'visibility' : 'visibility_off', 18, `color:${on(k) ? '#fafafa' : '#696969'}`)}</button></div>`).join('');
      return `<div class="box t6" data-key="blocks"><span style="display:flex;justify-content:space-between;align-items:baseline;padding:2px 4px 4px"><span class="lb">Kort på Hjem</span><span style="font-size:12px;color:#979797">${n} av ${BLOCKS.length} vises</span></span>
          <button class="tgl" data-a="showtodo" data-h="selection" style="background:var(--gray100,#2f2f2f)">Vis gjøremål${this._sw(todo)}</button>
          ${rows}</div>`;
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
      return `<button class="it" data-drag="tile" data-id="${esc(k)}" data-drop="tile:${esc(k)}" data-a="seltile" data-v="${esc(k)}" data-key="t-${esc(k)}" style="height:38px;border-radius:19px;justify-content:center;gap:6px;padding:0 8px 0 10px;background:${bg};box-shadow:${sh}">
        <span class="l1">${ic(kindIcon(k, c), 16, 'color:#afafaf')}<span class="nm">${esc(kindLabel(k, c))}</span>${badge}</span></button>`;
    }
    _pickPanel(m) {
      const sd = this.u.pick, c = m.c, hass = this.hass, t = m.t;
      const inBase = m.base.map((a) => a.id);
      const hiddenIds = m.base.filter((a) => m.hid.includes(a.id)).map((a) => a.id);
      const other = ['floor', 'custom', 'andre'].includes(t.kind) ? M.areas(hass).filter((a) => !inBase.includes(a.id)).map((a) => a.id) : [];
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
        <div class="ph">${ic(r.icon, 24, `color:${r.col}`)}<span class="n">${esc(r.name)}</span><button class="red press" data-a="rhide">${ic('mdi:eye-off', 18)}Skjul</button></div>
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
    _tilePanel(m, k) {
      const c = m.c, t = m.t, sl = tileSlot(c, t, k), [sd, pos] = sl.split('-'), grp = m.inSlot(sl), i = grp.indexOf(k), link = !KINDS[k];
      const P = `tiles.${t.id}.${k}`, st = m.stackOf(k), stk = m.stacked(k);
      const L = link ? (c.links || {})[k] || {} : null;
      const tp = get(c, 'tap.' + k) || {};
      const fra = get(c, P + '.fra') ?? (k === 'jul' ? '11-01' : ''), til = get(c, P + '.til') ?? (k === 'jul' ? '03-01' : '');
      const linkEd = link ? `
        <div class="fld"><span class="fl">Tittel</span><input class="in" data-in="ltitle" value="${esc(L.title || '')}" placeholder="Tittel"></div>
        <div class="fld"><span class="fl">Undertekst</span><input class="in" data-in="lsub" value="${esc(L.sub || '')}" placeholder="F.eks. {sensor.nordpool_kwh} nå"></div>
        <div class="fld"><span class="fl">Ikon · mdi:, phu:, hue: …</span><div style="display:flex;gap:8px;align-items:center"><span class="pv2" style="background:var(--gray000,#232323);color:#fafafa">${ic(L.icon || 'mdi:star', 22)}</span><input class="in" style="flex:1" data-in="licon" value="${esc(L.icon || '')}" placeholder="mdi:star"></div></div>
        <div class="fld"><span class="fl">Farge</span><div style="display:flex;gap:10px;flex-wrap:wrap;padding:2px">${TSW.map(([v, col, l]) => `<button class="sw34 ${(L.color || 'ingen') === v ? 'on' : ''}" data-a="lcolor" data-v="${v}" title="${l}" style="background:${col}"></button>`).join('')}</div></div>
        <div class="fld"><span class="fl">Trykk på kortet åpner popup</span><input class="in" data-in="lhash" value="${esc(L.hash || '')}" placeholder="#strom"></div>
        <div class="fld"><span class="fl">Entitet (ikon-trykk / mer info)</span><input class="in" data-in="lent" value="${esc(L.entity || '')}" placeholder="light.stue"></div>
        <div class="fld"><span class="fl">Trykk på ikonet</span><select class="in" data-in="lact">${[['toggle', 'Veksle entitet'], ['popup', 'Åpne popup'], ['more', 'Mer info'], ['none', 'Ingen']].map(([v, l]) => `<option value="${v}" ${(L.act || 'toggle') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>` : `
        <div class="tap"><span class="th">${ic('touch_app', 20, 'color:#afafaf')}Trykk på kortet</span>
          <div class="fld"><span class="fl">Åpne popup</span><input class="in" data-in="tcard" value="${esc(tp.card_hash || '')}" placeholder="Standard"></div></div>
        <div class="tap"><span class="th">${ic('radio_button_checked', 20, 'color:#afafaf')}Trykk på ikonet</span>
          <div class="fld"><span class="fl">Handling</span><select class="in" data-in="ticon">${[['auto', 'Standard'], ['popup', 'Åpne popup'], ['more', 'Mer info'], ['script', 'Kjør script'], ['none', 'Ingen']].map(([v, l]) => `<option value="${v}" ${(tp.icon || 'auto') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
          ${tp.icon === 'popup' ? `<div class="fld"><span class="fl">Popup for ikonet</span><input class="in" data-in="tihash" value="${esc(tp.icon_hash || '')}" placeholder="#sikkerhet"></div>` : ''}
          ${tp.icon === 'script' ? `<div class="fld"><span class="fl">Kjør script</span><select class="in" data-in="tscript"><option value="">Ingen</option>${M.all(this.hass, 'script').map((s) => `<option value="${esc(s)}" ${tp.script === s ? 'selected' : ''}>${esc(M.name(this.hass, s))}</option>`).join('')}</select></div>` : ''}</div>`;
      return `<div class="pnl" data-key="tp-${esc(k)}">
        <div class="ph">${ic(kindIcon(k, c), 24, 'color:#afafaf')}<span class="n">${esc(kindLabel(k, c))}</span><button class="red press" data-a="thide">${ic('mdi:eye-off', 18)}Skjul</button></div>
        <div class="ln"><span class="lb">Plassering</span><div style="display:flex;gap:6px"><div class="ud"><button data-a="tmove" data-v="-1" title="Flytt opp" ${i > 0 ? '' : 'style="opacity:.35"'}>${ic('expand_less', 20)}</button><button data-a="tmove" data-v="1" title="Flytt ned" ${i < grp.length - 1 ? '' : 'style="opacity:.35"'}>${ic('expand_more', 20)}</button></div><button class="b36 press" data-a="tswap">${ic('swap_horiz', 18)}Bytt side</button></div></div>
        <div class="ln"><span class="lb">Over eller under rommene</span><div class="ss">${[['top', 'Over'], ['bottom', 'Under']].map(([v, l]) => `<button class="${pos === v ? 'on-pk' : ''}" data-a="tpos" data-v="${v}" data-h="selection">${l}</button>`).join('')}</div></div>
        <div class="ln"><span class="lb2"><span class="lb">Swipe</span><span class="sub">${stk ? 'Sveipes sammen med andre i samme plass' : m.slotAll(sl) ? 'Alle i plassen sveipes' : 'Sveip sammen med andre i samme plass'}</span></span><button data-a="tstack" data-h="selection">${this._sw(st || m.slotAll(sl), true)}</button></div>
        <div class="fld"><span class="fl">Vis bare i perioden · MM-DD, tomt = alltid</span><div class="g2"><input class="in" data-in="tfra" value="${esc(fra)}" placeholder="Fra, f.eks. 11-01"><input class="in" data-in="ttil" value="${esc(til)}" placeholder="Til, f.eks. 03-01"></div></div>
        ${linkEd}
      </div>`;
    }
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
              ${Object.keys(SLIDE_L).filter((k) => !cur.includes(k)).map((k) => `<button class="o34 press" data-a="slide" data-s="${sd}" data-v="${k}">+ ${SLIDE_L[k][1]}</button>`).join('')}</div></div>`; }).join('')}</div>`;
      }
      return this._acc('swipe', 'Swipe-kort', 'mdi:gesture-swipe-horizontal', n + ' ekstra') + body;
    }
    _accSnar(m) {
      const c = m.c, t = m.t, gk = (k) => { const [sd, p] = tileSlot(c, t, k).split('-'); return (sd === 'L' ? 0 : 2) + (p === 'top' ? 0 : 1); };
      let body = '';
      if (this.u.acc.snar) {
        const list = [...m.en].sort((a, b) => gk(a) - gk(b));
        const groups = [['L-top', 'Venstre, over rommene'], ['L-bottom', 'Venstre, under rommene'], ['R-top', 'Høyre, over rommene'], ['R-bottom', 'Høyre, under rommene']].filter(([sl]) => m.inSlot(sl).length > 1);
        const add = [['garage', '+ Garasje'], ['tv', '+ TV'], ['vacr', '+ Støvsuger'], ['dish', '+ Oppvaskmaskin'], ['wash', '+ Vaskemaskin'], ['dry', '+ Tørketrommel'], ['lock', '+ Dørlås'], ['alarm', '+ Alarm'], ['cam', '+ Kamera'], ['ruter', '+ Ruter'], ['todo', '+ Gjøremål'], ['jul', '+ Jul']].filter(([k]) => m.avail.includes(k) && !m.en.includes(k));
        body = `<div class="box t6" data-key="acb-snar">
          ${list.map((k) => { const sl = tileSlot(c, t, k), [sd, p] = sl.split('-'), grp = m.inSlot(sl), gi = grp.indexOf(k), on = this.u.sel && this.u.sel.t === 'tile' && this.u.sel.id === k;
            return `<div class="tr ${on ? 'open' : ''}" data-key="tr-${esc(k)}"><button class="tm" data-a="seltile" data-v="${esc(k)}">${ic(kindIcon(k, c), 22)}<span class="tt"><b>${esc(kindLabel(k, c))}</b><i>${sd === 'L' ? 'Venstre' : 'Høyre'} · ${p === 'top' ? 'over rommene' : 'under rommene'}${KINDS[k] ? ' · live' : ''}</i></span></button>
              <button class="sq ${gi > 0 ? '' : 'no'}" data-a="tmove" data-k="${esc(k)}" data-v="-1">${ic('expand_less', 18)}</button><button class="sq ${gi < grp.length - 1 ? '' : 'no'}" data-a="tmove" data-k="${esc(k)}" data-v="1">${ic('expand_more', 18)}</button>
              <button class="sq" data-a="tswap" data-k="${esc(k)}" title="Bytt kolonne">${ic('swap_horiz', 18)}</button><button class="sq" data-a="tpos" data-k="${esc(k)}" data-v="${p === 'top' ? 'bottom' : 'top'}" title="Over eller under rommene">${ic(p === 'top' ? 'vertical_align_bottom' : 'vertical_align_top', 18)}</button>
              <button class="sq del" data-a="thide" data-k="${esc(k)}" title="Slett">${ic('delete', 18)}</button></div>`; }).join('')}
          ${groups.length ? `<span style="font-size:12px;color:#979797;padding:8px 4px 0">Swipe-kort · én snarvei om gangen, sveip for neste</span>${groups.map(([sl, l]) => `<button class="swg" data-a="swall" data-v="${sl}" data-h="selection">${l}${this._sw(!!m.slotAll(sl))}</button>`).join('')}` : ''}
          ${list.length ? '' : '<span class="dim">Ingen snarveier på denne fanen ennå.</span>'}
          <div class="chs" style="padding-top:4px">${add.map(([k, l]) => `<button class="o34 press" data-a="addtile" data-v="${k}">${l}</button>`).join('')}<button class="o34 press" data-a="addlink">+ Ny snarvei</button></div></div>`;
      }
      return this._acc('snar', 'Snarveier · ' + t.label, 'bolt', m.en.length + ' stk') + body;
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
      const custom = (key, pk, min, max, def) => { const v = Number(c[pk]) || def; return `<div style="display:flex;align-items:center;gap:8px;padding-top:4px"><input type="range" min="${min}" max="${max}" step="1" value="${v}" data-in="tabpx" data-k="${pk}" style="flex:1;min-width:0">
          <div class="stp"><button data-a="tabstep" data-k="${pk}" data-v="-1" data-min="${min}" data-max="${max}" data-def="${def}">${ic('remove', 18)}</button><span>${v} px</span><button data-a="tabstep" data-k="${pk}" data-v="1" data-min="${min}" data-max="${max}" data-def="${def}">${ic('add', 18)}</button></div></div>`; };
      return `${rows}
        <button class="big52 press" data-a="tabnew">${ic('add', 22)}Ny fane</button>
        <div class="tset"><span class="lb">Faner</span>
          <div class="fld"><span class="fl">Høyde</span><div class="chs">${[['std', 'Standard'], ['lav', 'Lav'], ['mid', 'Middels'], ['hoy', 'Høy'], ['ekstra', 'Ekstra'], ['custom', 'Egendefinert']].map(([v, l]) => opt('tab_height', v, l, hC)).join('')}</div>${hC === 'custom' ? custom('tab_height', 'tab_height_px', 24, 80, 38) : ''}</div>
          <div class="fld"><span class="fl">Bredde per fane</span><div class="chs">${[['std', 'Standard'], ['kompakt', 'Kompakt'], ['full', 'Full'], ['custom', 'Egendefinert']].map(([v, l]) => opt('tab_width', v, l, wC)).join('')}</div>${wC === 'custom' ? custom('tab_width', 'tab_width_px', 48, 200, 88) : ''}</div>
        </div>
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
      const hass = this.hass, c = this.F(), P = (M.store && M.store.get('popups')) || {}, out = [];
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
      const cur = { ...((M.store.get('popups') || {})[key] || {}), ...patch };
      Object.keys(cur).forEach((k) => { if (cur[k] === undefined || cur[k] === '' || cur[k] === null || cur[k] === false) delete cur[k]; });
      this._saving = true;
      try { if (this.hass) M.store.load(this.hass); M.store.set('popups.' + key, Object.keys(cur).length ? cur : undefined); } finally { this._saving = false; }
      this._schedule();
    }

    /* ======================================================== Tekst */
    _tekst() {
      const R = this._prose(), u = this.u, hass = this.hass;
      if (!R) return '<div class="hint">Prosa-kortet er ikke lastet.</div>';
      const prev = `<div class="prev" data-key="prev">${R.vis.map((v) => `<span>${esc(v.pre)}</span>${v.hasChip ? `<span class="pc" style="background:${v.bg}">${v.dot ? `<span class="pd" style="background:${v.dot}"></span>` : ''}${v.emoji ? (v.emoji.indexOf(':') > 0 ? ic(v.emoji, 16) : `<span>${esc(v.emoji)}</span>`) : ''}<span>${esc(v.chip)}</span></span>` : ''}<span>${esc(v.post)}</span>`).join('') || '<span style="color:#7f7f7f">Ingen setninger vises nå</span>'}</div>`;
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
        const sv = cs === 'custom' ? R.getS(p.cent) : R.S[cs];
        const links = [...LINKS, ...M.areas(hass).map((a) => ['#' + a.id, a.name])];
        const linkKnown = links.some((l) => l[0] === (p.link || ''));
        const ed = `<div class="ped" data-key="ped-${i}">
          <div class="fld"><span class="fl">Tekst før</span><input class="in" data-in="pf" data-i="${i}" data-f="pre" value="${esc(p.pre || '')}" placeholder="F.eks. Strømmen koster">${tokHTML('pre', i)}</div>
          <div class="fld"><span class="fl">Verdi i boblen</span><select class="in" data-in="psrc" data-i="${i}">${SRC.map(([v, l]) => `<option value="${v}" ${(p.src || 'none') === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
            ${p.src === 'custom' ? `<input class="in" data-in="pf" data-i="${i}" data-f="ent" value="${esc(p.ent || '')}" placeholder="State, f.eks. stue.temp eller sensor.vaskemaskin">` : ''}
            ${cur && p.src !== 'text' ? `<span style="font-size:11px;color:#7f7f7f">Nå: ${esc(cur[0])}</span>` : p.src && !['none', 'text'].includes(p.src) ? '<span style="font-size:11px;color:#7f7f7f">Fant ingen entitet for denne kilden</span>' : ''}</div>
          ${(p.src || 'none') !== 'none' ? `<div class="fld"><span class="fl">${p.src === 'text' ? 'Tekst i boblen' : 'Visning i boblen · {v} er verdien'}</span><input class="in" data-in="pf" data-i="${i}" data-f="fmt" value="${esc(p.fmt || '')}"></div>` : ''}
          <div class="fld"><span class="fl">Tekst etter</span><input class="in" data-in="pf" data-i="${i}" data-f="post" value="${esc(p.post || '')}" placeholder="F.eks. i dag.">${tokHTML('post', i)}</div>
          <div class="fld"><span class="fl">Ikon i boblen</span><div class="chs" style="max-height:124px;overflow-y:auto;scrollbar-width:none">${PICONS.map(([v, l]) => `<button class="chip ${(p.icon || '') === v ? 'on-pk' : ''}" data-a="picon" data-i="${i}" data-v="${esc(v)}">${esc(l)}</button>`).join('')}</div>
            <input class="in" data-in="pf" data-i="${i}" data-f="icon" value="${esc(p.icon === 'dot' ? '' : p.icon || '')}" placeholder="Eller skriv inn en emoji / mdi:ikon"></div>
          <div class="fld"><span class="fl">Farge · Auto følger verdien (pris, lås, alarm …)</span><div style="display:flex;gap:10px;flex-wrap:wrap;padding:2px">${PSW.map(([v, col, l]) => `<button class="sw34 ${(p.color || 'hvit') === v ? 'on' : ''}" data-a="pcol" data-i="${i}" data-v="${v}" title="${l}" style="background:${col}"></button>`).join('')}</div></div>
          <div class="fld"><span class="fl">Når du trykker · handling</span><select class="in" data-in="pact" data-i="${i}">${ACTS.map(([v, l]) => `<option value="${v}" ${(p.act || '') === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
            ${p.act === 'service' ? `<div class="svc"><span class="sh2">${ic('terminal', 16)}Utfør handling</span>
              <input class="in" data-in="pf" data-i="${i}" data-f="svc" value="${esc(p.svc || '')}" placeholder="domene.tjeneste, f.eks. light.turn_on">
              <span style="font-size:12px;color:#979797">Mål</span><input class="in" data-in="pf" data-i="${i}" data-f="target" value="${esc(p.target || '')}" placeholder="entity_id">
              <span style="font-size:12px;color:#979797">Data</span><input class="in" data-in="pf" data-i="${i}" data-f="data" value="${esc(typeof p.data === 'object' ? JSON.stringify(p.data) : p.data || '')}" placeholder='{"brightness_pct": 60}'>
              <button class="pink press" data-a="ptest" data-i="${i}">${ic('play_arrow', 18)}Test handling</button></div>` : ''}</div>
          <div class="fld"><span class="fl">Og åpne popup</span><select class="in" data-in="plink" data-i="${i}">${links.map(([v, l]) => `<option value="${esc(v)}" ${(p.link || '') === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}${linkKnown ? '' : `<option value="${esc(p.link)}" selected>${esc(p.link)}</option>`}</select></div>
          <div class="fld"><span class="fl">Vises</span><div class="chs">${OPS.map(([v, l]) => `<button class="chip ${op === v ? 'on-pk' : ''}" data-a="pop" data-i="${i}" data-v="${esc(v)}">${l}</button>`).join('')}</div></div>
          ${op !== 'alltid' ? `<div class="fld"><span class="fl">Når</span><select class="in" data-in="pcsrc" data-i="${i}">${SRC.filter((x) => R.S[x[0]] || x[0] === 'custom').map(([v, l]) => `<option value="${v}" ${cs === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
              ${p.csrc === 'custom' ? `<input class="in" data-in="pf" data-i="${i}" data-f="cent" value="${esc(p.cent || '')}" placeholder="State, f.eks. sensor.stue_temperatur">` : ''}</div>
            <div class="fld"><span class="fl">Verdi</span><input class="in" data-in="pf" data-i="${i}" data-f="cval" value="${esc(p.cval || '')}" placeholder="F.eks. 1,5 eller låst"><span style="font-size:11px;color:#7f7f7f">${sv ? `${esc(srcL(cs))} er nå ${esc(sv[0])} · setningen ${R.test(p) ? 'vises' : 'skjules'}` : ''}</span></div>` : ''}
        </div>`;
        return row + ed;
      }).join('');
      const pc = this.P() || {}, off = pc.prose_offset != null && pc.prose_offset !== '' ? Number(pc.prose_offset) : 18;
      const offHTML = `<div class="fld" data-key="poff"><div style="display:flex;justify-content:space-between;align-items:center"><span class="fl">Avstand over teksten</span><span class="poffv" style="font-size:13px;font-weight:500;font-variant-numeric:tabular-nums">${off} px</span></div>
          <input type="range" min="-20" max="60" step="1" value="${off}" data-in="poff" style="width:100%">
          <div class="chs">${[[0, 'Ingen 0'], [18, 'Standard 18'], [36, 'Luftig 36']].map(([v, l]) => `<button class="o36 ${off === v ? 'on-pk' : ''}" data-a="poffset" data-v="${v}" data-h="selection">${l}</button>`).join('')}</div></div>`;
      return `${offHTML}${prev}${rows}
        <button class="big52 press" data-a="padd">${ic('add', 22)}Ny setning</button>
        <span class="hint">Hver setning kan ha en boble med live verdi. Lag to setninger med motsatte betingelser for å bytte tekst eller farge etter tilstand.</span>`;
    }
    _proseRows() { const R = this._prose(); return ((R && R.rows) || []).map((x) => JSON.parse(JSON.stringify(x || {}))); }
    _proseUp(i, f) { const L = this._proseRows(); if (!L[i]) return; L[i] = f(L[i]) || L[i]; Object.keys(L[i]).forEach((k) => { if (L[i][k] === undefined) delete L[i][k]; }); this.saveP({ prose: L }); }

    /* ======================================================== handlinger */
    _bind() {
      const r = this.root;
      r.addEventListener('click', (e) => this._click(e));
      r.addEventListener('change', (e) => this._input(e, 'change'));
      r.addEventListener('input', (e) => this._input(e, 'input'));
      r.addEventListener('value-changed', (e) => { const el = e.composedPath().find((n) => n.dataset && n.dataset.in === 'icpick'); if (el && this.u.sel) { const v = e.detail && e.detail.value; this._roomSet(this.u.sel.id, { icon: v || undefined }); } });
      r.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target && e.target.tagName === 'INPUT') e.target.blur(); });
      // .sh stopper pointerdown (MSH.overlay) → lytt i capture-fasen på selve arket.
      const sh = this.sheet;
      sh.addEventListener('pointerdown', (e) => this._pd(e), true);
      sh.addEventListener('pointermove', (e) => this._pm(e), true);
      sh.addEventListener('pointerup', (e) => this._pu(e), true);
      sh.addEventListener('pointercancel', (e) => this._pu(e, true), true);
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
      if (a === 'done') return this.close();
      if (a === 'sec') { u.sec = d.v; u.sel = null; u.pick = null; return this.render(); }
      if (a === 'reset') return this._reset();
      if (a === 'acc') { u.acc = { ...u.acc, [d.v]: !u.acc[d.v] }; return this.render(); }
      if (a === 'showtodo' || a === 'blkeye') return this._actBlock(a, d);
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
      } else { u.proseSel = null; this.saveP({ prose: undefined }); }
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
        case 'selroom': u.sel = u.sel && u.sel.t === 'room' && u.sel.id === d.v ? null : { t: 'room', id: d.v }; u.pick = null; u.icQ = ''; return this.render();
        case 'seltile': u.sel = u.sel && u.sel.t === 'tile' && u.sel.id === d.v ? null : { t: 'tile', id: d.v }; u.pick = null; return this.render();
        case 'addroom': {
          const id = d.v, side = u.pick || 'L';
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
        case 'addtile': { const side = u.pick || 'L'; u.pick = null; u.sel = { t: 'tile', id: d.v }; return this._moveTile(m, d.v, side + '-bottom', null); }
        case 'addlink': {
          const links = c.links || {}, lk = Object.keys(links);
          const nx = 'l' + pad2(lk.reduce((mx, k) => Math.max(mx, parseInt(k.slice(1), 10) || 0), 0) + 1);
          const side = u.pick || 'L';
          this._F = setIn(c, 'links.' + nx, { title: 'Ny snarvei', icon: 'mdi:star' });
          u.pick = null; u.sel = { t: 'tile', id: nx };
          return this._moveTile(this._model(), nx, side + '-bottom', null);
        }
        case 'slide': { const p = `slides.${t.id}.${d.s}.${d.v}`; return this.saveF({ [p]: get(c, p) ? undefined : true }); }
        case 'swall': { const p = `swipe.${t.id}.${d.v}`; return this.saveF({ [p]: !m.slotAll(d.v) }); }
        default:
      }
      // valgt rom
      if (u.sel && u.sel.t === 'room' && /^(r|look|b|allic|allcol)/.test(a)) {
        const id = u.sel.id, r = m.rooms.find((x) => x.id === id);
        if (!r) return;
        switch (a) {
          case 'rhide': { u.sel = null; const lay = { ...(get(c, 'layout.' + t.id) || {}), side: { ...m.sides }, hidden: [...m.hid, id] }; return this.saveF({ ['layout.' + t.id]: lay }); }
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
      const u = this.u;
      switch (a) {
        case 'popg': u.popG = d.v; return this.render();
        case 'popsel': u.popSel = u.popSel === d.v ? null : d.v; return this.render();
        case 'pophide': { M.haptic('selection'); const cur = ((M.store.get('popups') || {})[d.v] || {}); return this._popSet(d.v, { hidden: !cur.hidden }); }
        case 'popcol': return this._popSet(d.k, { color: d.v });
        case 'popreset': return this._popSet(d.v, { name: undefined, icon: undefined, color: undefined });
        default:
      }
    }
    _actTekst(a, d) {
      const u = this.u, i = Number(d.i);
      switch (a) {
        case 'poffset': return this.saveP({ prose_offset: Number(d.v) === 18 ? undefined : Number(d.v) });
        case 'psel': u.proseSel = u.proseSel === i ? null : i; return this.render();
        case 'pmv': { const L = this._proseRows(), j = i + Number(d.v); if (j < 0 || j >= L.length) return; [L[i], L[j]] = [L[j], L[i]]; if (u.proseSel === i) u.proseSel = j; M.haptic('selection'); return this.saveP({ prose: L }); }
        case 'peye': return this._proseUp(i, (p) => ({ ...p, hidden: p.hidden ? undefined : true }));
        case 'pdel': { const L = this._proseRows(); L.splice(i, 1); if (u.proseSel === i) u.proseSel = null; return this.saveP({ prose: L }); }
        case 'padd': { const L = this._proseRows(); L.push({ id: 'p' + Date.now().toString(36), pre: 'Ny tekst', src: 'none', fmt: '{v}', post: '', icon: '', color: 'hvit', link: '', cop: 'alltid' }); u.proseSel = L.length - 1; return this.saveP({ prose: L }); }
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
      // live under skriving: kun søk og slidere
      if (kind === 'input') {
        if (k === 'icq') { u.icQ = v; return this._schedule(); }
        if (k === 'blimit') { const l = this.root.querySelector('[data-lim]'); if (l) l.textContent = v + ' %'; return; }
        if (k === 'tabpx') { const s = el.parentNode.querySelector('.stp span'); if (s) s.textContent = v + ' px'; return; }
        if (k === 'poff') { const s = this.root.querySelector('.poffv'); if (s) s.textContent = v + ' px'; const lp = this.prosaLive; if (lp && lp._rawConfig) lp.setConfig({ ...lp._rawConfig, prose_offset: Number(v), __eff: 1 }); return; }
        return;
      }
      if (el.type === 'color' || el.tagName === 'SELECT' || el.type === 'range') M.haptic('selection');
      const trim = String(v).trim();
      switch (k) {
        case 'icq': return;
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
        case 'poff': return this.saveP({ prose_offset: Number(v) });
        case 'bcond': return this.saveF({ 'battery.cond': trim || undefined });
        case 'blimit': return this.saveF({ 'battery.limit': Number(v) === 20 ? undefined : Number(v) });
        case 'popname': return this._popSet(d.k, { name: trim || undefined });
        case 'popicon': return this._popSet(d.k, { icon: trim || undefined });
        case 'popcolhex': return this._popSet(d.k, { color: v });
        case 'pf': return this._proseUp(Number(d.i), (p) => ({ ...p, [d.f]: d.f === 'icon' ? (trim || (p.icon === 'dot' ? 'dot' : '')) : v }));
        case 'psrc': return this._proseUp(Number(d.i), (p) => ({ ...p, src: v, fmt: v === 'text' ? (p.src === 'text' ? p.fmt : 'Tekst') : (p.src === 'text' || !p.fmt ? '{v}' : p.fmt) }));
        case 'pact': return this._proseUp(Number(d.i), (p) => ({ ...p, act: v || undefined }));
        case 'plink': return this._proseUp(Number(d.i), (p) => ({ ...p, link: v }));
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
        if (s.touch) { if (Math.abs(dx) > 8 || Math.abs(dy) > 8) { clearTimeout(s.timer); s.mode = 'scroll'; try { s.el.setPointerCapture(s.pid); } catch (x) { /* */ } } else return; }
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
      if (tgt && /^(room|tile|tab):/.test(tgt.dataset.drop)) { const rr = tgt.getBoundingClientRect(); pos = y > rr.top + rr.height / 2 ? 'b' : 't'; }
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
    _ctDown(e, ct) {
      const grid = ct.querySelector('.tg'), items = [...ct.querySelectorAll('.tb')];
      this._ctS = { ct, grid, items, x: e.clientX, id: e.pointerId, n: items.length, mode: null, near: null };
    }
    _ctMove(e) {
      const s = this._ctS; if (!s || e.pointerId !== s.id) return;
      const dx = e.clientX - s.x;
      if (!s.mode) { if (Math.abs(dx) < 6) return; s.mode = 'glass'; s.ct.classList.add('drag'); try { s.ct.setPointerCapture(s.id); } catch (x) { /* */ } }
      e.preventDefault();
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
      s.ct.classList.remove('drag'); s.items.forEach((b) => b.classList.remove('near'));
      const it = s.items[s.near];
      if (!cancel && it) { this.u.ctx = it.dataset.v; this.u.sel = null; this.u.pick = null; }
      this.render();
    }
  }
})();
