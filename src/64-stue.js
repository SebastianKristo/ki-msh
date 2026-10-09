/* msh-stue-card · Stue-dashbord v2 for nettbrett (1366×1024 liggende) – Fiks 58 B. Kilde: prompt «Hurtigpanel og Stue»
 * (designfilen «Stue dashboard v2.dc.html» finnes ikke i repoet – bygget etter prompt-teksten). Samme funksjoner som det
 * gamle stue-dashbordet, utseendet følger hoveddashbordet. ETT kort som tegner hele visningen (panel-visning).
 * Rekkefølge: hvit navbar til venstre (fast, mot dashbordflaten) · header (klokke · vær · statuspiller · avatarer · prosa
 * med chip-lenker) → fanepille (Hjem/Media/Enheter/Lys, felles MSH.tabBar: glass-valg + hold 400 ms og dra = flytt,
 * tab_order i config) + «Tilpass» (Hjem) → nattmodus-kort (Hjem, når nattmodus er på) → scener (Hjem) → kortene i masonry
 * (Plex · Termostat · Spiller nå · Markise · Gardiner · Lys).
 * 2b · Tilpass (dra og slipp): redigeringsfelt med øye-chips, overlegg per kort, dra = flytt (spøkelse følger pekeren,
 *   målkolonne fra x, plass fra midtpunktene), masonry (grid-auto-rows 8 px, row dense, span = ceil(høyde/8), ResizeObserver),
 *   kolonner ≥1080 → 3, ≥700 → 2, ellers 1. Lagres i config `layout: { cols: [[…],[…],[…]], hidden: [] }` (config er
 *   sannheten – ikke localStorage). Nedtrekkspanelet er av i redigeringsmodus.
 *   Lys: `lights: [ids]` i config (utvalg + rekkefølge, «+ Legg til lys»-velgeren; mangler → lysene i området).
 *   Markise/gardiner: utvidbare kort (0/25/50/75/100 %), gardiner med en slider per del (snittet styrer alle).
 * Fanefiltrering: Hjem viser alt; Media/Enheter/Lys bare sine kort i én kolonne (Media og Enheter maks 720 px).
 * Nedtrekkspanel: felles M.hurtig (11-hurtigpanel.js, variant 'nettbrett') – bare i Hjem-fanen, gestlogikken ett sted.
 * Autokonfig (ingen hardkodede ID-er): område (config.area, ellers området som heter Stue/Living room) → lys, gardiner/
 *   markise (cover.*), termostater (climate.*), mediespillere og scener i området. Nattmodus = input_boolean (nattmodus/
 *   night_mode), «på siden» = dens last_changed. Plex = sensor med «recently_added» (upcoming-media-format, attributtet data).
 *   Overstyring: overrides.{night, plex, weather, power, price}, exclude / include.{lys, gardiner, termostater, spillere, scener}.
 * Scener/skript er engangshandlinger (prosjektregel): aldri aktiv-tilstand – bare brytere (input_boolean) vises rosa.
 * Strategien: `stue: true` (eller { area, path, title }) i strategi-YAML / ki-store stue.enabled gir en egen visning /stue
 *   med dette kortet + de samme Bubble-popupene (dock-lenkene virker). Se 04-strategy.js.
 */
(function () {
  const M = window.MSH;
  if (!M || customElements.get('msh-stue-card')) return;
  const esc = M.esc, C = M.C;
  const PINK = C.accent, ON = 'var(--ki-on-accent, #2a1720)';
  const YEL = 'rgb(242 210 111)', GOLD = 'rgb(176 152 86)'; // lys på: gul fyll etter lysstyrke over mørkere gull (designet)
  const TABS = [['hjem', 'Hjem', 'mdi:home'], ['media', 'Media', 'mdi:play-circle-outline'], ['enheter', 'Enheter', 'mdi:devices'], ['lys', 'Lys', 'mdi:lightbulb-outline']];
  const DOCK = [['#rolf', 'mdi:robot-vacuum', 'Støvsuger'], ['#strom', 'mdi:power-plug', 'Strøm'], ['#media', 'mdi:music-note', 'Media'], ['#tesla', 'mdi:car-electric', 'Bil'], ['#server', 'mdi:server', 'Server'], ['#klima', 'mdi:thermostat', 'Klima']];
  // Kortene i masonry (2b) · standardoppsett og hvilke faner de hører til
  const CARDS = [['plex', 'Plex'], ['termo', 'Termostat'], ['spiller', 'Spiller nå'], ['markise', 'Markise'], ['gardiner', 'Gardiner'], ['lys', 'Lys']];
  const CARD_KEYS = CARDS.map((c) => c[0]);
  const DEF_COLS = [['plex', 'termo'], ['spiller', 'markise', 'gardiner'], ['lys']];
  const TAB_CARDS = { media: ['plex', 'termo'], enheter: ['spiller', 'markise', 'gardiner'], lys: ['lys'] };
  const CHIPS = [['scener', 'Scener'], ...CARDS];
  // Layout fra config: ukjente kort filtreres bort, manglende legges i kolonne 3
  M.stueLayout = function (cfg) {
    const L = cfg && cfg.layout && typeof cfg.layout === 'object' ? cfg.layout : {};
    const raw = Array.isArray(L.cols) && L.cols.length ? L.cols : DEF_COLS;
    const seen = new Set(), cols = [0, 1, 2].map((i) => (Array.isArray(raw[i]) ? raw[i] : []).filter((k) => CARD_KEYS.includes(k) && !seen.has(k) && seen.add(k)));
    CARD_KEYS.forEach((k) => { if (!seen.has(k)) cols[2].push(k); });
    return { cols, hidden: Array.isArray(L.hidden) ? L.hidden.filter((k) => CHIPS.some((c) => c[0] === k)) : [] };
  };
  const COND = { 'clear-night': 'Klart', cloudy: 'Skyet', fog: 'Tåke', hail: 'Hagl', lightning: 'Torden', 'lightning-rainy': 'Torden', partlycloudy: 'Delvis skyet', pouring: 'Styrtregn', rainy: 'Regn', snowy: 'Snø', 'snowy-rainy': 'Sludd', sunny: 'Sol', windy: 'Vind', 'windy-variant': 'Vind', exceptional: 'Ekstremvær' };
  const get = (o, p) => String(p).split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  const hhmm = (t) => { const d = new Date(t); return isNaN(d) ? '' : `${M.pad(d.getHours())}:${M.pad(d.getMinutes())}`; };

  /* ------------------------------------------------------------ 2b · forhåndsvalg per enhet («Tilpass alt» → Stue-tablet) */
  // localStorage['ki-device-preset'] = 'stue' → enheten åpner Stue-dashbordet (visningen /stue) ved oppstart.
  const PRESET = 'ki-device-preset';
  M.devicePreset = () => { try { return localStorage.getItem(PRESET) || ''; } catch (e) { return ''; } };
  M.setDevicePreset = function (v) {
    try { if (v) localStorage.setItem(PRESET, v); else localStorage.removeItem(PRESET); } catch (e) { /* */ }
    // Strategien lager visningen /stue når ki-store stue.enabled er satt (04-strategy.js, M.stueView)
    if (v === 'stue' && M.store && M.store.get && !(M.store.get('stue') || {}).enabled) M.store.set('stue.enabled', true);
  };
  // now = rett etter valget (alltid); ellers én gang per økt ved oppstart (sessionStorage), bare i ekte HA
  M.devicePresetGo = function (now) {
    if (M.devicePreset() !== 'stue') return false;
    const ha = document.querySelector('home-assistant');
    const seg = location.pathname.split('/').filter(Boolean);
    if (!ha || !seg.length) return false;
    const path = ((M.store && M.store.get && M.store.get('stue')) || {}).path || 'stue';
    if (seg[1] === path) return false;
    if (!now) { try { if (sessionStorage.getItem('ki-preset-go')) return false; sessionStorage.setItem('ki-preset-go', '1'); } catch (e) { /* */ } }
    const go = () => M.navigate('/' + seg[0] + '/' + path);
    const panel = M.deep(ha.shadowRoot, 'ha-panel-lovelace'), ll = panel && panel.lovelace;
    const views = (ll && ll.config && ll.config.views) || [];
    if (views.some((v) => v && v.path === path)) { go(); return true; }
    const root = panel && M.deep(panel.shadowRoot || panel, 'hui-root'); // visningen mangler ennå → be HA regenerere
    if (root) root.dispatchEvent(new CustomEvent('config-refresh', { bubbles: true, composed: true }));
    setTimeout(go, 1200);
    return true;
  };

  /* ------------------------------------------------------------ autokonfig */
  M.stueArea = function (hass, cfg) {
    if (cfg && cfg.area && hass && hass.areas && hass.areas[cfg.area]) return cfg.area;
    const A = M.areas(hass);
    const hit = A.find((a) => /^(stue|stua|living.?room|livingroom|stova|stuen)$/i.test(a.name) || /^(stue|stua|living_room|livingroom)$/.test(a.id));
    return (hit || A.find((a) => /stue|living/i.test(a.name)) || {}).id || null;
  };
  const inArea = (h, area, dom, f) => (area ? M.all(h, dom, (s, id) => M.areaOf(h, id) === area && (!f || f(s, id))) : []);
  M.stueAuto = function (hass, cfg) {
    cfg = cfg || {};
    const h = hass, area = M.stueArea(h, cfg);
    if (!h) return { area: null, lights: [], areaLights: [], covers: [], awnings: [], curtains: [], climates: [], players: [], scenes: [], night: null, plex: null };
    const L = (k, list) => M.applyLists(cfg, k, list).filter((id) => h.states[id]);
    const night = M.pick(cfg, 'night', M.all(h, 'input_boolean', (s, id) => /nattmodus|natt_?modus|night_?mode/.test(id) || /nattmodus|night mode/i.test(String(s.attributes.friendly_name || '')))[0] || null);
    const plex = M.pick(cfg, 'plex', M.all(h, 'sensor', (s, id) => /recently_added|nylig_lagt/.test(id) && Array.isArray(s.attributes.data))[0] || null);
    const scenes = L('scener', [...inArea(h, area, 'scene'), ...inArea(h, area, 'script'), ...inArea(h, area, 'input_boolean', (s, id) => id !== night)]);
    const covers = L('gardiner', inArea(h, area, 'cover'));
    const isAwn = (id) => h.states[id].attributes.device_class === 'awning' || /markise|awning/.test(id + ' ' + String(h.states[id].attributes.friendly_name || '').toLowerCase());
    // 2b · lysutvalget: config.lights (rekkefølge = visning) › lysene i området (uten lysgrupper)
    const areaLights = L('lys', inArea(h, area, 'light', (s) => !Array.isArray(s.attributes.entity_id)));
    const lights = Array.isArray(cfg.lights) && cfg.lights.length ? cfg.lights.filter((id) => h.states[id]) : areaLights;
    return {
      area, night, plex, scenes, lights, areaLights,
      covers, awnings: covers.filter(isAwn), curtains: covers.filter((id) => !isAwn(id)),
      climates: L('termostater', inArea(h, area, 'climate')),
      players: L('spillere', inArea(h, area, 'media_player')),
    };
  };
  // Plex «nylig lagt til» (upcoming-media-format): første element med tittel
  function plexItem(h, id) {
    const st = id && h.states[id], d = st && Array.isArray(st.attributes.data) ? st.attributes.data : [];
    const it = d.find((x) => x && x.title && !x.title_default);
    if (!it) return null;
    const safe = (u) => { u = String(u || '').trim(); if (!u) return null; if (/^https:\/\//i.test(u)) return u; if (u[0] === '/' && h.hassUrl) return h.hassUrl(u); return null; };
    return { title: it.title, ep: [it.number, it.episode].filter(Boolean).join(' · '), poster: safe(it.poster || it.fanart), kind: it.number || it.episode ? 'Serie' : 'Film', fresh: true };
  }

  /* ------------------------------------------------------------ CSS */
  const CSS = `
    :host{display:block;width:100%;--sd-card:var(--ki-surface, #383838);--sd-in:var(--ki-surface-3, #2c2c2c);--sd-ic:var(--ki-surface-2, #4a4a4a)}
    ha-card{background:none;box-shadow:none;border:0;border-radius:0;overflow:visible}
    .sd{min-height:100vh;box-sizing:border-box;padding:14px 20px 40px 126px;display:flex;flex-direction:column;gap:22px;background:${C.dash};color:${C.text}}
    .num{font-variant-numeric:tabular-nums}
    .ell{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
    button{font:inherit;color:inherit;border:0;background:none;padding:0;cursor:pointer}
    .press{transition:transform .12s ease}.press:active{transform:scale(.96)}
    /* header */
    .hdr{display:flex;flex-direction:column;gap:18px;touch-action:none}
    .hr1{display:flex;align-items:center;gap:22px;flex-wrap:wrap}
    .ck{font-size:80px;font-weight:300;line-height:.9;letter-spacing:-1.5px}
    .dd{display:flex;flex-direction:column;gap:4px}
    .dd .wd{font-size:20px;font-weight:500}.dd .dt{font-size:15px;color:${C.text2}}
    .sep{width:1px;height:64px;background:${M.theme.whiteA(0.12)}}
    .wx{display:flex;align-items:center;gap:12px;min-height:44px}
    .wx .wt{font-size:30px;font-weight:400}.wx .ws{font-size:14px;color:${C.text2}}
    .hsp{flex:1}
    .pills{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
    .pl{height:52px;border-radius:26px;background:var(--sd-card);display:inline-flex;align-items:center;gap:8px;padding:0 18px;font-size:15px;font-weight:500;white-space:nowrap}
    .avs{display:flex;align-items:center;padding-left:14px}
    .av{position:relative;width:56px;height:56px;border-radius:28px;margin-left:-14px;background:var(--sd-ic) center/cover no-repeat;box-shadow:0 0 0 3px ${C.dash};display:grid;place-items:center;font-size:20px;font-weight:600}
    .av .bd{position:absolute;right:-2px;bottom:-2px;width:18px;height:18px;border-radius:9px;box-shadow:0 0 0 3px ${C.dash}}
    .prose{font-size:26px;line-height:1.75;font-weight:400;color:${C.text2}}
    .ch{display:inline-flex;align-items:center;gap:6px;height:42px;padding:0 16px;border-radius:21px;background:var(--ki-pill-bg, #fafafa);color:var(--ki-pill-fg, #232323);font-size:22px;font-weight:600;vertical-align:middle;margin:0 2px;cursor:pointer;transition:transform .12s ease}
    .ch:active{transform:scale(.96)}
    /* faner */
    .tr{display:flex;align-items:center;gap:16px}
    .tr .mtb{flex:0 1 560px;min-width:0}
    .tr .tip{font-size:13px;color:${C.text3};flex:1;min-width:0}
    .tpb{height:48px;padding:0 18px;border-radius:24px;background:var(--sd-card);display:inline-flex;align-items:center;gap:8px;font-size:14px;font-weight:600;flex:none}
    /* masonry (2b) */
    .ms{display:grid;grid-template-columns:repeat(var(--n,3),minmax(0,1fr));grid-auto-rows:8px;grid-auto-flow:row dense;column-gap:22px;align-items:start}
    .ms.one{grid-template-columns:minmax(0,1fr)}
    .gc{position:relative;min-width:0;padding-bottom:22px;box-sizing:border-box}
    .gc.narrow{max-width:720px;width:100%;justify-self:center}
    .gc.ph{opacity:.5}
    .gi{display:flex;flex-direction:column;gap:14px}
    .editing .gi{pointer-events:none}
    .ov{position:absolute;inset:0 0 22px 0;border-radius:32px;box-shadow:inset 0 0 0 3px var(--pink, #f285c9);background:color-mix(in srgb, var(--pink, #f285c9) 6%, transparent);touch-action:none;cursor:grab;z-index:3;display:flex;align-items:flex-start;justify-content:space-between;padding:12px}
    .ov .gch{height:36px;padding:0 14px;border-radius:18px;background:${PINK};color:${ON};font-size:14px;font-weight:600;display:inline-flex;align-items:center;gap:6px;pointer-events:none}
    .ov .ghb{width:44px;height:44px;border-radius:22px;background:var(--sd-ic);display:grid;place-items:center}
    .ghost{position:fixed;z-index:50;pointer-events:none;transform:rotate(-2deg) scale(1.02);box-shadow:0 0 0 3px var(--pink, #f285c9),0 18px 40px rgb(0 0 0/0.4);border-radius:32px;opacity:.95;overflow:hidden}
    .eb{border-radius:32px;box-shadow:inset 0 0 0 2px var(--pink, #f285c9);background:var(--sd-card);padding:18px 20px;display:flex;flex-direction:column;gap:12px}
    .eb .et{display:flex;align-items:center;gap:10px}
    .eb .et b{font-size:18px;font-weight:600;flex:1}
    .eb .eh{font-size:14px;color:${C.text2}}
    .eb .ecs{display:flex;flex-wrap:wrap;gap:8px}
    .eb .ec{height:44px;padding:0 16px;border-radius:22px;background:var(--sd-ic);display:inline-flex;align-items:center;gap:8px;font-size:14px;font-weight:600}
    .eb .ec.off{background:var(--sd-in);color:${C.text3}}
    .eb .ebt{height:44px;padding:0 18px;border-radius:22px;background:var(--sd-ic);font-size:14px;font-weight:600}
    .eb .ebt.p{background:${PINK};color:${ON}}
    .eb .elg{display:flex;align-items:center;gap:14px;font-size:14px;font-weight:600}.eb .elg .seg{flex:0 1 320px}
    /* navbar til venstre (2b) */
    .nv{position:fixed;top:12px;bottom:12px;width:92px;border-radius:46px;background:#fafafa;color:#232323;display:flex;flex-direction:column;align-items:center;gap:4px;padding:12px 0;box-sizing:border-box;z-index:5;box-shadow:0 12px 30px rgb(0 0 0/0.35)}/* ki-hex-ok: hvit navbar (designet) */
    .nv button{width:min(68px, calc((100vh - 120px) / 8.2));height:min(68px, calc((100vh - 120px) / 8.2));min-width:44px;min-height:44px;border-radius:50%;display:grid;place-items:center;flex:none;--nvi:min(38px, calc((100vh - 120px) / 14))}
    .nv button ha-icon{--mdc-icon-size:var(--nvi)!important;width:var(--nvi)!important;height:var(--nvi)!important}
    .nv button:active{background:rgb(0 0 0/0.08)}
    .nv .sp{flex:1}
    .nv .tun{background:#ececec;width:min(76px, calc((100vh - 120px) / 7.4));height:min(76px, calc((100vh - 120px) / 7.4))}/* ki-hex-ok: designets lysegrå knapp */
    /* nattmodus */
    .nm{position:relative;overflow:hidden;border-radius:40px;padding:34px 36px;min-height:260px;background:linear-gradient(160deg, #1f1d40 0%, #2a2350 55%, #3a2a5c 100%);box-shadow:inset 0 0 0 1px rgba(160,150,230,0.18);color:#fafafa}/* ki-hex-ok: mørk øy (nattscene) */
    .nm .star{position:absolute;border-radius:50%;background:#fff}/* ki-hex-ok */
    .nm .cl{position:absolute;border-radius:50%;background:rgba(160,150,230,0.16);filter:blur(22px)}
    .nm .moon{position:absolute;right:56px;top:40px;width:84px;height:84px;border-radius:50%;background:radial-gradient(circle at 40% 40%, #fff6cf, #f3e2a0);box-shadow:0 0 40px rgba(243,226,160,0.45)}/* ki-hex-ok */
    .nm .moon::after{content:"";position:absolute;width:84px;height:84px;border-radius:50%;left:26px;top:-10px;background:#2a2350}/* ki-hex-ok */
    .nm .in{position:relative;display:flex;flex-direction:column;gap:10px}
    .nm .k{font-size:16px;font-weight:600;color:#c4bfe6}/* ki-hex-ok */
    .nm .gn{font-size:56px;font-weight:300;line-height:1}
    .nm .ps{font-size:16px;color:#c4bfe6}/* ki-hex-ok */
    .nm .chips{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}
    .nm .nc{height:36px;padding:0 14px;border-radius:18px;display:inline-flex;align-items:center;gap:6px;font-size:14px;font-weight:600}
    .nm .acts{display:flex;gap:10px;flex-wrap:wrap;margin-top:10px}
    .nm .nb{height:52px;padding:0 22px;border-radius:26px;background:rgba(255,255,255,0.12);font-size:15px;font-weight:600;display:inline-flex;align-items:center;gap:8px}/* ki-hex-ok: mørk øy */
    .nm .nb.off{background:#f5e6b0;color:#2a2350}/* ki-hex-ok: designets kremgule knapp */
    /* scener */
    .scn{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
    .sc{position:relative;height:132px;border-radius:40px;background:var(--sd-card);display:flex;flex-direction:column;justify-content:flex-end;gap:10px;padding:18px 20px;text-align:left}
    .sc::before{content:"";position:absolute;left:50%;top:10px;width:72px;height:6px;border-radius:3px;transform:translateX(-50%);background:${M.theme.whiteA(0.12)}}
    .sc.on::before{background:rgba(42,23,32,0.22)}/* ki-hex-ok: strek på rosa flate */
    .sc .si{width:44px;height:44px;border-radius:22px;background:var(--sd-ic);display:grid;place-items:center}
    .sc .sl{font-size:16px;font-weight:600}
    .sc.on{background:${PINK};color:${ON}}.sc.on .si{background:rgb(255 255 255/0.35)}
    /* kolonner */
    .cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:22px;align-items:start}
    .cols.one{grid-template-columns:1fr}
    .col{display:flex;flex-direction:column;gap:14px;min-width:0}
    .col.narrow{max-width:720px;width:100%;margin:0 auto}
    .ttl{font-size:18px;font-weight:600;padding:0 6px;display:flex;align-items:center;gap:10px}
    .ttl span{flex:1}
    .card{background:var(--sd-card);border-radius:32px;padding:20px;display:flex;flex-direction:column;gap:14px}
    .empty{padding:18px;border-radius:24px;background:var(--sd-in);font-size:14px;color:${C.text3};text-align:center}
    .pick{height:36px;padding:0 14px;border-radius:18px;background:var(--sd-ic);font-size:13px;font-weight:600;margin-top:8px}
    /* plex */
    .px{position:relative;height:360px;border-radius:32px;overflow:hidden;background:#2f2f2f center/cover no-repeat;display:flex;flex-direction:column;justify-content:flex-end;padding:20px;color:#fafafa}/* ki-hex-ok: bildeflate */
    .px::before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0) 35%,rgba(0,0,0,.75))}/* ki-hex-ok: tekst over bilde */
    .px>*{position:relative}
    .px .tags{position:absolute;left:18px;top:18px;display:flex;gap:6px}
    .px .tag{height:28px;padding:0 12px;border-radius:14px;background:rgba(0,0,0,.45);font-size:12px;font-weight:700;display:inline-flex;align-items:center;letter-spacing:.5px}/* ki-hex-ok: over bilde */
    .px .tag.new{background:${PINK};color:${ON}}
    .px .pk{font-size:13px;opacity:.75}.px .pt{font-size:22px;font-weight:600}
    .px .pb{position:absolute;right:18px;bottom:18px;width:56px;height:56px;border-radius:28px;background:#fafafa;color:#232323;display:grid;place-items:center}/* ki-hex-ok: hvit play-knapp */
    /* termostat */
    .th .tt{display:flex;align-items:center;gap:8px}
    .th .tt .nmx{flex:1;font-size:17px;font-weight:600;text-align:center}
    .ar{width:44px;height:44px;border-radius:22px;background:var(--sd-ic);display:grid;place-items:center;flex:none}
    .th .stt{display:flex;align-items:center;gap:8px;font-size:14px;color:${C.text2};justify-content:center}
    .dot{width:8px;height:8px;border-radius:4px;flex:none}
    .th .big{display:flex;align-items:baseline;justify-content:center;gap:14px}
    .th .cur{font-size:52px;font-weight:300}.th .hum{font-size:18px;color:${C.text2}}
    .chip{align-self:center;height:30px;padding:0 12px;border-radius:15px;font-size:12px;font-weight:600;display:inline-flex;align-items:center;gap:6px}
    .seg{display:flex;gap:4px;background:var(--sd-in);border-radius:24px;padding:4px}
    .seg button{flex:1;height:44px;border-radius:20px;font-size:14px;font-weight:600;color:${C.text2}}
    .seg button.on{background:${PINK};color:${ON}}
    .stp{display:flex;align-items:center;gap:14px}
    .stp .sb{width:56px;height:56px;border-radius:28px;background:var(--sd-ic);display:grid;place-items:center;flex:none}
    .stp .tv{flex:1;display:flex;flex-direction:column;align-items:center;gap:8px}
    .stp .tvv{font-size:28px;font-weight:500}
    .stp .gl{width:100%;height:6px;border-radius:3px;background:linear-gradient(90deg, var(--blue, #73b9f2), var(--yellow, #f2d26f), var(--red, #f28073));position:relative}
    .stp .gl i{position:absolute;top:-5px;width:16px;height:16px;border-radius:8px;background:var(--ki-knob, #fff);transform:translateX(-50%);box-shadow:0 1px 4px rgb(0 0 0/0.4)}
    /* spiller nå */
    .np .nh{display:flex;align-items:center;gap:14px}
    .np .art{width:84px;height:84px;border-radius:20px;background:var(--sd-ic) center/cover no-repeat;flex:none;display:grid;place-items:center}
    .np .nt{display:flex;flex-direction:column;gap:3px;flex:1;min-width:0}
    .np .n1{font-size:13px;color:${C.text3}}.np .n2{font-size:18px;font-weight:600}.np .n3{font-size:14px;color:${C.text2}}
    .np .ctl{display:flex;align-items:center;justify-content:center;gap:14px}
    .np .cb{width:52px;height:52px;border-radius:26px;background:var(--sd-ic);display:grid;place-items:center}
    .np .cb.pp{width:64px;height:64px;border-radius:32px;background:${PINK};color:${ON}}
    .np .bar{height:6px;border-radius:3px;background:var(--sd-in);overflow:hidden}.np .bar span{display:block;height:100%;background:${C.text}}
    .np .dots{display:flex;justify-content:center;gap:6px}
    .np .dots button{width:44px;height:44px;display:grid;place-items:center;margin:-10px 0}
    .np .dots i{width:8px;height:8px;border-radius:4px;background:${C.text3}}.np .dots button.on i{background:${C.text};width:22px}
    /* gardiner/markise (2b: utvidbare kort) */
    .cvr{display:flex;align-items:center;gap:12px}
    .cvr .cvi{width:48px;height:48px;border-radius:24px;background:var(--sd-ic);display:grid;place-items:center;flex:none}
    .cvr .cvn{font-size:16px;font-weight:600;flex:1}
    .cvr .cvp{font-size:15px;font-weight:600;text-align:right;flex:none}
    .cv>.csl{flex:none}
    .xp{width:44px;height:44px;border-radius:22px;background:var(--sd-ic);display:grid;place-items:center;flex:none;transition:transform .25s ease}
    .xp.open{transform:rotate(180deg)}
    .qb{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}
    .qb button{height:56px;border-radius:28px;background:var(--sd-in);font-size:15px;font-weight:600}
    .qb button.on{background:${PINK};color:${ON}}
    .prt{display:flex;flex-direction:column;gap:8px}
    .prt .pn2{font-size:13px;color:${C.text2};padding:0 6px}
    .cv{display:flex;flex-direction:column;gap:10px}
    .cv .ch2{display:flex;align-items:center;gap:10px;font-size:15px;font-weight:600}
    .cv .ch2 span{flex:1}
    .cv .row{display:flex;align-items:center;gap:10px}
    .csl{position:relative;flex:1;height:56px;border-radius:28px;background:var(--sd-in);overflow:hidden;touch-action:none}
    .csl .f{position:absolute;left:0;top:0;bottom:0;background:${PINK};border-radius:28px;min-width:56px;pointer-events:none}
    .csl .k{position:absolute;top:13px;width:30px;height:30px;border-radius:15px;background:var(--ki-knob, #fff);transform:translateX(-38px);pointer-events:none;box-shadow:0 1px 6px rgb(0 0 0/0.35)}
    .csl .v{position:absolute;left:18px;top:0;bottom:0;display:flex;align-items:center;font-size:15px;font-weight:600;color:${ON};pointer-events:none;mix-blend-mode:normal}
    .csl.lo .v{color:${C.text}}
    .ib{width:52px;height:52px;border-radius:26px;background:var(--sd-ic);display:grid;place-items:center;flex:none}
    /* lys */
    .lg{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .lg.wide{grid-template-columns:repeat(auto-fill,minmax(200px,1fr))}
    .lt{position:relative;height:80px;border-radius:40px;background:var(--sd-card);overflow:hidden;display:flex;align-items:center;gap:12px;padding:0 16px 0 12px;text-align:left;touch-action:pan-y;user-select:none;-webkit-user-select:none}
    .lt .lf{position:absolute;left:0;top:0;bottom:0;pointer-events:none}
    .lt .li{position:relative;width:52px;height:52px;border-radius:26px;background:var(--sd-ic);display:grid;place-items:center;flex:none}
    .lt .lx{position:relative;display:flex;flex-direction:column;min-width:0;gap:2px}
    .lt .ln{font-size:15px;font-weight:600}.lt .lv{font-size:13px;color:${C.text2}}
    .lt.on{background:${GOLD};color:#2a1f05}/* ki-hex-ok: tekst på gul flate */
    .lt.on .lf{background:${YEL}}
    .lt.on .li{background:rgb(255 255 255/0.35)}
    .lt.on .lv{color:#2a1f05;opacity:.75}/* ki-hex-ok */
    .lt.add{background:none;box-shadow:inset 0 0 0 2px ${M.theme.whiteA(0.22)};justify-content:center;gap:8px;font-size:15px;font-weight:600;color:${C.text2}}
    .lb2{height:44px;padding:0 16px;border-radius:22px;background:var(--sd-card);font-size:14px;font-weight:600;white-space:nowrap}
    .spacer{height:4px}
  `;

  const PICK_CSS = `.w{display:flex;flex-direction:column;gap:12px}.t{font-size:20px;font-weight:600}.s{font-size:13px;color:${C.text2}}
    .l{display:flex;flex-direction:column;gap:6px;max-height:min(60vh,520px);overflow-y:auto;overscroll-behavior:contain}
    .r{display:flex;align-items:center;gap:12px;min-height:56px;padding:6px 14px 6px 8px;border-radius:28px;background:var(--ki-surface, #3a3a3a);border:0;font:inherit;color:inherit;text-align:left;cursor:pointer}
    .r .i{width:44px;height:44px;border-radius:22px;background:var(--ki-surface-2, #4a4a4a);display:grid;place-items:center;flex:none}
    .r .x{display:flex;flex-direction:column;flex:1;min-width:0}.r b{font-size:15px;font-weight:600}.r i{font-style:normal;font-size:12px;color:${C.text3};overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .r .c{width:28px;height:28px;border-radius:14px;box-shadow:inset 0 0 0 2px ${M.theme.whiteA(0.22)};display:grid;place-items:center;flex:none}
    .r.on{background:${PINK};color:${ON}}.r.on i{color:${ON};opacity:.7}.r.on .c{background:${ON};color:var(--ki-knob, #fff);box-shadow:none}.r.on .i{background:rgb(255 255 255/0.35)}
    .g{font-size:13px;font-weight:600;color:${C.text3};padding:8px 6px 2px}
    .bt{display:flex;gap:8px}.bt button{flex:1;height:48px;border-radius:24px;border:0;font:inherit;font-size:15px;font-weight:600;cursor:pointer;background:var(--ki-surface-2, #4a4a4a);color:var(--ki-text, #fafafa)}.bt .p{background:${PINK};color:${ON}}`;

  /* ------------------------------------------------------------ kortet */
  class Stue extends M.Card {
    static get cardName() { return 'Stue'; }
    static get defaults() { return {}; }
    static getStubConfig() { return { card_id: M.uid() }; }
    static get schema() {
      return (hh) => [
        { type: 'info', label: 'Nettbrett-dashbord for stua (panel-visning). Alt autokonfigureres fra området; overstyr under.' },
        { type: 'area', name: 'area', label: 'Område', auto: (h, c) => M.stueArea(h, c) },
        { type: 'overrides', label: 'Bytt entiteter', fields: [
          { name: 'night', label: 'Nattmodus (bryter)', domain: 'input_boolean', auto: (h, c) => M.stueAuto(h, c).night },
          { name: 'plex', label: 'Plex · nylig lagt til (sensor)', domain: 'sensor', auto: (h, c) => M.stueAuto(h, c).plex },
          { name: 'weather', label: 'Vær', domain: 'weather', auto: (h) => (M.hurtigWx ? M.hurtigWx(h).id : null) },
          { name: 'power', label: 'Effekt (hele huset)', domain: 'sensor', device_class: 'power', auto: (h) => (M.kiRomId ? M.kiRomId(h, null, 'effekt') : null) },
        ] },
        { type: 'lists', label: 'Entiteter i stua', lists: (h, c) => { const A = M.stueAuto(h, { ...c, exclude: [], include: {} }), area = A.area;
          return [
            { key: 'scener', label: 'Scener', ids: A.scenes, domains: ['scene', 'script', 'input_boolean'] },
            { key: 'lys', label: 'Lys', ids: A.lights, domains: ['light'] },
            { key: 'gardiner', label: 'Markise og gardiner', ids: A.covers, domains: ['cover'] },
            { key: 'termostater', label: 'Termostater', ids: A.climates, domains: ['climate'] },
            { key: 'spillere', label: 'Mediespillere', ids: A.players, domains: ['media_player'] },
          ].map((x) => ({ ...x, area })); } },
        { type: 'section', id: 'faner', label: 'Faner', icon: 'mdi:tab', fields: [
          ...(M.startTab && M.startTab.field ? [M.startTab.field({ items: () => TABS.map(([key, label, icon]) => ({ key, label, icon })) })] : []),
          { type: 'order', name: 'tab_order', label: 'Rekkefølge (eller hold inne og dra i fanepillen)', options: TABS.map((t) => [t[0], t[1]]) },
        ] },
        { type: 'section', id: 'oppsett', label: 'Kort og oppsett', icon: 'mdi:view-dashboard-edit-outline', fields: [
          { type: 'info', label: 'Flytt kortene med «Tilpass» til høyre for fanene (dra og slipp). Her kan du vise/skjule kort og tilbakestille.' },
          { type: 'html', html: (h, c, key) => { const L = M.stueLayout(c), hid = new Set(L.hidden);
            return `<div style="display:flex;flex-wrap:wrap;gap:8px;padding:4px 0">${CHIPS.map(([k, l]) => `<button class="btn" style="height:44px;${hid.has(k) ? 'opacity:.55' : ''}" data-a="fn" data-k="${key}" data-v="${k}">${M.icon(hid.has(k) ? 'mdi:eye-off-outline' : 'mdi:eye-outline', 18)}${esc(l)}</button>`).join('')}<button class="btn" style="height:44px" data-a="fn" data-k="${key}" data-v="__reset">${M.icon('mdi:restore', 18)}Tilbakestill oppsett</button></div>`; },
            click: (d, ed) => { const c = ed._config || {}; if (d.v === '__reset') { M.haptic('medium'); return ed._set('layout', undefined); } const L = M.stueLayout(c), hid = new Set(L.hidden); hid.has(d.v) ? hid.delete(d.v) : hid.add(d.v); M.haptic('selection'); ed._set('layout', { cols: L.cols, hidden: [...hid] }); } },
          { type: 'entities', name: 'lights', label: 'Lys (utvalg og rekkefølge · tomt = lysene i området)', domain: 'light', domains: 'light', addLabel: 'Legg til lys' },
        ] },
        { type: 'section', id: 'nav', label: 'Navbar', icon: 'mdi:dock-left', fields: [
          { type: 'order', name: 'dock_order', hiddenName: 'dock_hidden', label: 'Snarveier (rekkefølge · skjul)', options: DOCK.map(([h, , l]) => [h.slice(1), l + ' (' + h + ')']) },
        ] },
        ...(M.hurtigSchema ? [M.hurtigSchema('hurtigpanel.', 'nettbrett')] : []),
      ];
    }
    get cardSize() { return 20; }
    get A() { if (!this._A || this._Ah !== this.hass || this._Ac !== this.config) { this._A = M.stueAuto(this.hass, this.config); this._Ah = this.hass; this._Ac = this.config; } return this._A; }
    get tab() {
      const vis = this._tabs();
      if (!this.ui.tab) { const st = M.startTab ? M.startTab.resolve(this.config, vis, { id: this.config.card_id }) : null; this._ui.tab = vis.includes(st) ? st : vis[0]; }
      return vis.includes(this.ui.tab) ? this.ui.tab : vis[0];
    }
    _tabs() { return (M.mshOrder || ((k, o) => k))(TABS.map((t) => t[0]), this.config.tab_order, []); }
    set hass(h) { super.hass = h; if (this._hp) this._hp.update(h); }
    get hass() { return super.hass; }
    connectedCallback() {
      super.connectedCallback();
      if (!this._hp && M.hurtig) {
        this._hp = M.hurtig.create(this, {
          variant: 'nettbrett',
          cfg: () => this.config.hurtigpanel || {},
          canOpen: () => this.tab === 'hjem' && !this.ui.edit && !this._drag,
          lights: () => this.A.lights, // 2b: «Alle lys i stua» i panelets lys-slider
          onEdit: (f) => this.customize(f || 'hurtigpanel'),
          props: () => ({ wheel: 70, ...(this.config.hurtigpanel || {}) }),
        });
      }
      clearInterval(this._clk);
      this._clk = setInterval(() => { const ck = this.shadowRoot.querySelector('.ck'); const d = new Date(), t = `${M.pad(d.getHours())}:${M.pad(d.getMinutes())}`; if (ck && ck.textContent !== t) this.update(); }, 15000);
    }
    disconnectedCallback() {
      super.disconnectedCallback();
      if (this._hp) { this._hp.destroy(); this._hp = null; }
      if (this._msRO) { this._msRO.disconnect(); this._msRO = null; this._msObs = null; }
      clearInterval(this._clk);
    }
    get styles() { return CSS + (M.tabBar ? M.tabBar.CSS : ''); }

    /* ---- seksjoner */
    _header() {
      const h = this.hass, c = this.config, d = new Date();
      const wid = M.pick(c, 'weather', M.hurtigWx ? M.hurtigWx(h).id : M.all(h, 'weather')[0]), ws = wid ? this.s(wid) : null;
      const temp = ws && M.isNum(ws.attributes.temperature) ? M.nf(Number(ws.attributes.temperature), 1) + '°' : '–';
      const place = (h.config && h.config.location_name) || '';
      const persons = M.all(h, 'person'), home = persons.filter((p) => this.s(p).state === 'home');
      const lock = M.hurtigEntity ? M.hurtigEntity(h, {}, 'lock') : M.all(h, 'lock')[0], ls = lock ? this.s(lock) : null;
      const alarm = M.all(h, 'alarm_control_panel')[0], AS = alarm && M.alarmState ? M.alarmState(h, {}, alarm) : null;
      if (alarm) this.s(alarm);
      const wd = d.toLocaleDateString('nb-NO', { weekday: 'long' }), dt = d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' });
      const pill = (icon, text, act, attrs, col) => `<button class="pl press" data-act="${act}" ${attrs || ''}>${M.icon(icon, 20, col ? `color:${col}` : '')}<span>${esc(text)}</span></button>`;
      const avs = persons.slice(0, 5).map((p) => {
        const s = this.s(p), pic = s.attributes.entity_picture, at = s.state === 'home';
        return `<button class="av press" data-act="popup" data-hash="#person-${esc(p.split('.')[1])}" title="${esc(M.name(h, p))}" style="${pic ? `background-image:url('${esc(M.hjemPicUrl ? M.hjemPicUrl(h, pic) : pic)}')` : ''}">${pic ? '' : esc(M.name(h, p).charAt(0))}<i class="bd" style="background:${at ? C.green : C.gray600}"></i></button>`;
      }).join('');
      return `<header class="hdr" data-key="hdr">
        <div class="hr1"><div class="ck num">${M.pad(d.getHours())}:${M.pad(d.getMinutes())}</div>
          <div class="dd"><span class="wd">${esc(wd.charAt(0).toUpperCase() + wd.slice(1))}</span><span class="dt">${esc(dt)}</span></div>
          <span class="sep"></span>
          <button class="wx press" data-act="popup" data-hash="#vaer">${M.icon(ws ? M.domainIcon(wid, ws) : 'mdi:weather-cloudy', 40, `color:${C.yellow}`)}<span class="dd"><span class="wt num">${temp}</span><span class="ws">${esc([ws ? COND[ws.state] || ws.state : '–', place].filter(Boolean).join(' · '))}</span></span></button>
          <span class="hsp"></span>
          <div class="pills">${pill('mdi:home-account', `${home.length} hjemme`, 'popup', 'data-hash="#kart"')}${ls ? pill(ls.state === 'locked' ? 'mdi:lock' : 'mdi:lock-open-variant', ls.state === 'locked' ? 'Låst' : 'Ulåst', 'popup', 'data-hash="#dorlas"', ls.state === 'locked' ? C.green : C.red) : ''}${AS ? pill(AS.armed ? 'mdi:shield-home' : 'mdi:shield-off-outline', AS.armed ? AS.text || 'Alarm på' : 'Alarm av', 'popup', 'data-hash="#sikkerhet"', AS.armed ? C.green : '') : ''}</div>
          <div class="avs">${avs}</div></div>
        ${this._prose()}</header>`;
    }
    _prose() {
      const h = this.hass, c = this.config, A = this.A;
      const wid = M.pick(c, 'weather', M.hurtigWx ? M.hurtigWx(h).id : null), ws = wid ? this.s(wid) : null;
      const ch = (txt, act, attrs, dot) => `<span class="ch" role="button" tabindex="0" data-act="${act}" ${attrs || ''}>${dot || ''}${esc(txt)}</span>`;
      const parts = [];
      if (ws) parts.push(`Ute er det ${ch(`${(COND[ws.state] || ws.state).toLowerCase()} og ${M.isNum(ws.attributes.temperature) ? M.nf(Number(ws.attributes.temperature), 1) : '–'}°`, 'popup', 'data-hash="#vaer"')}.`);
      const P = M.powerPrice ? (() => { try { return M.powerPrice(h, null, this); } catch (e) { return null; } })() : null;
      const pw = M.pick(c, 'power', M.kiRomId ? M.kiRomId(h, null, 'effekt') : null), pv = pw ? this.n(pw) : null;
      const on = A.lights.filter((id) => this.s(id).state === 'on').length;
      const s2 = [];
      if (P && P.now != null) s2.push(`Strømmen koster ${ch(P.fmt(P.now), 'popup', 'data-hash="#strom"', `<i class="dot" style="background:${P.now > 1.5 ? C.red : P.now > 0.8 ? C.orange : C.green}"></i>`)}`);
      if (pv != null) s2.push(`${s2.length ? 'og vi bruker' : 'Vi bruker'} ${ch(Math.round(pv) + ' W', 'popup', 'data-hash="#energi"')}`);
      if (A.lights.length) s2.push(`${s2.length ? 'med' : 'Det er'} ${ch(`${on} lys`, 'tab', 'data-v="lys"', M.icon('mdi:lightbulb-outline', 22))} på i stua`);
      if (s2.length) parts.push(s2.join(' ') + '.');
      if (this._ev != null) parts.push(`Vi har ${ch(`${this._ev} ${this._ev === 1 ? 'avtale' : 'avtaler'}`, 'popup', 'data-hash="#kalender"', M.icon('mdi:alarm', 22))} i dag.`);
      return parts.length ? `<div class="prose">${parts.join(' ')}</div>` : '';
    }
    _loadEvents() {
      const h = this.hass;
      if (!h || !h.callApi || this._evBusy || (this._evT && Date.now() - this._evT < 15 * 60000)) return;
      const ids = M.all(h, 'calendar');
      if (!ids.length) { this._evT = Date.now(); return; }
      this._evBusy = true;
      const s = new Date(); s.setHours(0, 0, 0, 0);
      const e = new Date(s.getTime() + 864e5);
      Promise.all(ids.map((id) => h.callApi('GET', `calendars/${id}?start=${encodeURIComponent(s.toISOString())}&end=${encodeURIComponent(e.toISOString())}`).catch(() => [])))
        .then((r) => { this._ev = r.reduce((t, l) => t + (Array.isArray(l) ? l.length : 0), 0); })
        .finally(() => { this._evBusy = false; this._evT = Date.now(); this.update(); });
    }
    _night() {
      const h = this.hass, id = this.A.night, st = id ? this.s(id) : null;
      if (!st || st.state !== 'on') return '';
      const lock = M.hurtigEntity ? M.hurtigEntity(h, {}, 'lock') : null, ls = lock ? this.s(lock) : null;
      const alarm = M.all(h, 'alarm_control_panel')[0], AS = alarm && M.alarmState ? M.alarmState(h, {}, alarm) : null;
      const lon = M.all(h, 'light', (s) => s.state === 'on' && !Array.isArray(s.attributes.entity_id)).length;
      const wake = M.all(h, ['input_datetime', 'sensor'], (s, x) => /vekking|wake|alarm_?time|vekkerklokke/.test(x) && (/\d\d:\d\d/.test(s.state)))[0];
      const ws = wake ? String(this.s(wake).state).match(/(\d\d:\d\d)/) : null;
      const stars = Array.from({ length: 18 }, (_, i) => { const r = (n) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1; return `<i class="star" style="left:${(r(1) * 96).toFixed(1)}%;top:${(r(2) * 80).toFixed(1)}%;width:${2 + Math.round(r(3))}px;height:${2 + Math.round(r(3))}px;opacity:${(0.3 + r(4) * 0.4).toFixed(2)}"></i>`; }).join('');
      const nc = (txt, col, icon) => `<span class="nc" style="background:${M.alpha(col, 0.18)};color:${col}">${M.icon(icon, 16)}${esc(txt)}</span>`;
      return `<section class="nm" data-ki-island data-key="nm">${stars}<i class="cl" style="left:8%;bottom:-40px;width:260px;height:120px"></i><i class="cl" style="right:22%;top:-30px;width:220px;height:100px"></i><i class="moon"></i>
        <div class="in"><span class="k">🌙 Nattmodus</span><span class="gn">God natt</span><span class="ps">på siden ${hhmm(st.last_changed)}${ws ? ' · vekking ' + ws[1] : ''}</span>
          <div class="chips">${ls ? (ls.state === 'locked' ? nc('Låst', C.green, 'mdi:lock') : nc('Ulåst', C.red, 'mdi:lock-open-variant')) : ''}${AS ? (AS.armed ? nc('Alarm på', C.green, 'mdi:shield-home') : nc('Alarm av', C.red, 'mdi:shield-off-outline')) : ''}${lon ? nc(`${lon} lys på`, C.yellow, 'mdi:lightbulb-on') : nc('Alt lys av', C.yellow, 'mdi:lightbulb-off-outline')}</div>
          <div class="acts"><button class="nb press" data-act="alloff">${M.icon('mdi:lightbulb-off-outline', 20)}Alt lys av</button><button class="nb press" data-act="popup" data-hash="#kamera">${M.icon('mdi:cctv', 20)}Kamera</button><button class="nb off press" data-act="nightoff" data-haptic="medium">${M.icon('mdi:weather-sunny', 20)}Slå av</button></div></div></section>`;
    }
    _scenes() {
      const h = this.hass, A = this.A;
      const tiles = A.scenes.map((id) => {
        const s = this.s(id), tog = id.startsWith('input_boolean.'), on = tog && s.state === 'on';
        return `<button class="sc press${on ? ' on' : ''}" data-act="scene" data-id="${esc(id)}" data-haptic="${tog ? 'medium' : 'success'}" data-key="sc-${esc(id)}"><span class="si">${M.icon(s.attributes.icon || M.domainIcon(id, s), 22)}</span><span class="sl ell">${esc(M.name(h, id, true))}</span></button>`;
      });
      if (A.night && !A.scenes.includes(A.night)) { const s = this.s(A.night), on = s.state === 'on'; tiles.push(`<button class="sc press${on ? ' on' : ''}" data-act="scene" data-id="${esc(A.night)}" data-haptic="medium" data-key="sc-night"><span class="si">${M.icon('mdi:weather-night', 22)}</span><span class="sl">Nattmodus</span></button>`); }
      tiles.push(`<button class="sc press" data-act="alloff" data-haptic="success" data-key="sc-alloff"><span class="si">${M.icon('mdi:lightbulb-off-outline', 22)}</span><span class="sl">Alt lys av</span></button>`);
      tiles.push(`<button class="sc press" data-act="popup" data-hash="#kamera" data-key="sc-cam"><span class="si">${M.icon('mdi:cctv', 22)}</span><span class="sl">Kamera</span></button>`);
      return `<section class="scn" data-key="scn">${tiles.join('')}</section>`;
    }
    _plex() {
      const h = this.hass, id = this.A.plex;
      if (id) this.s(id);
      const it = id ? plexItem(h, id) : null;
      if (!it) return `<div class="px" data-key="px"><div class="pk">Nylig lagt til i Plex</div><div class="pt">–</div><button class="pick press" data-act="customize" data-section="overrides" style="align-self:flex-start">Velg entitet</button></div>`;
      return `<div class="px" data-key="px" style="${it.poster ? `background-image:url('${esc(it.poster)}')` : ''}"><div class="tags">${it.fresh ? '<span class="tag new">NY</span>' : ''}<span class="tag">${esc(it.kind)}</span></div><span class="pk">Nylig lagt til i Plex</span><span class="pt ell">${esc(it.title)}${it.ep ? ' · ' + esc(it.ep) : ''}</span><button class="pb press" data-act="popup" data-hash="#media" aria-label="Spill av">${M.icon('mdi:play', 30)}</button></div>`;
    }
    _thermo() {
      const h = this.hass, L = this.A.climates;
      if (!L.length) return `<div class="card th"><div class="ttl"><span>Klima</span></div><div class="empty">Fant ingen termostat i stua<br><button class="pick press" data-act="customize" data-section="lists">Velg entitet</button></div></div>`;
      const i = M.clamp(this.ui.th || 0, 0, L.length - 1), id = L[i], s = this.s(id), a = s.attributes || {};
      const act = a.hvac_action, col = act === 'heating' ? C.orange : act === 'cooling' ? C.blue : C.gray600;
      const txt = M.unavailable(s) ? 'Utilgjengelig' : act === 'heating' ? 'Varmer' : act === 'cooling' ? 'Kjøler' : act === 'idle' ? 'Hviler' : s.state === 'off' ? 'Av' : 'På';
      const hum = a.current_humidity != null ? a.current_humidity : (() => { const x = M.byClass(h, 'sensor', 'humidity', this.A.area)[0]; return x ? this.n(x) : null; })();
      const tgt = this._tt != null ? this._tt : a.temperature;
      const modes = [['heat', 'Varme'], ['auto', 'Auto'], ['off', 'Av']].filter(([m]) => !a.hvac_modes || a.hvac_modes.includes(m) || (m === 'auto' && a.hvac_modes.includes('heat_cool')));
      const ki = M.all(h, ['switch', 'input_boolean'], (x, xid) => /ki_?energi/.test(xid) && /styr|control/.test(xid) && x.state === 'on').length > 0 || /ki_energi/.test(((M.regEntry(h, id) || {}).platform || ''));
      const pct = tgt != null ? M.clamp((tgt - 15) / 13 * 100, 0, 100) : 50;
      return `<div class="card th" data-key="th"><div class="tt">${L.length > 1 ? `<button class="ar press" data-act="th" data-d="-1" aria-label="Forrige termostat">${M.icon('mdi:chevron-left', 24)}</button>` : ''}<span class="nmx ell">${esc(M.name(h, id))}</span>${L.length > 1 ? `<button class="ar press" data-act="th" data-d="1" aria-label="Neste termostat">${M.icon('mdi:chevron-right', 24)}</button>` : ''}</div>
        <div class="stt"><i class="dot" style="background:${col}"></i>${esc(txt)}</div>
        <div class="big" data-ent="${esc(id)}"><span class="cur num">${a.current_temperature != null ? M.nf(a.current_temperature, 1) + '°' : '–'}</span><span class="hum num">${hum != null ? Math.round(hum) + ' %' : ''}</span></div>
        ${ki ? `<span class="chip" style="background:${M.theme ? M.theme.tone(C.green).bg : M.alpha(C.green, 0.15)};color:${M.theme ? M.theme.accentText(C.green) : C.green}">${M.icon('mdi:flash', 14)}KI Energi styrer</span>` : ''}
        ${modes.length ? `<div class="seg">${modes.map(([m, l]) => `<button class="${s.state === m || (m === 'auto' && s.state === 'heat_cool') ? 'on' : ''}" data-act="hvac" data-m="${m}" data-haptic="selection">${l}</button>`).join('')}</div>` : ''}
        <div class="stp"><button class="sb press" data-act="tt" data-d="-0.5" aria-label="Lavere">${M.icon('mdi:minus', 26)}</button><div class="tv"><span class="tvv num">${tgt != null ? M.nf(tgt, 1) + '°' : '–'}</span><span class="gl"><i style="left:${pct}%"></i></span></div><button class="sb press" data-act="tt" data-d="0.5" aria-label="Høyere">${M.icon('mdi:plus', 26)}</button></div></div>`;
    }
    _player() {
      const h = this.hass, L = this.A.players.length ? this.A.players : M.all(h, 'media_player', (s) => !M.unavailable(s)).slice(0, 4);
      if (!L.length) return `<div class="card np"><div class="empty">Fant ingen mediespiller i stua<br><button class="pick press" data-act="customize" data-section="lists">Velg entitet</button></div></div>`;
      const i = M.clamp(this.ui.np || 0, 0, L.length - 1), id = L[i], s = this.s(id), a = s.attributes || {};
      const off = s.state === 'off' || s.state === 'standby' || M.unavailable(s), play = s.state === 'playing';
      let pos = null;
      if (a.media_duration && a.media_position != null) { const p = a.media_position + (play && a.media_position_updated_at ? (Date.now() - new Date(a.media_position_updated_at).getTime()) / 1000 : 0); pos = M.clamp(p / a.media_duration * 100, 0, 100); }
      const art = a.entity_picture ? `background-image:url('${esc(M.hjemPicUrl ? M.hjemPicUrl(h, a.entity_picture) : a.entity_picture)}')` : '';
      return `<div class="card np" data-key="np"><div class="nh"><span class="art" style="${art}">${art ? '' : M.icon(M.isTvPlayer && M.isTvPlayer(h, id) ? 'mdi:television' : 'mdi:speaker', 34)}</span><div class="nt"><span class="n1 ell">${esc(M.name(h, id))}</span><span class="n2 ell">${esc(off ? 'Av' : a.media_title || a.app_name || (play ? 'Spiller' : 'Klar'))}</span><span class="n3 ell">${esc(a.media_artist || a.media_series_title || a.source || '')}</span></div><button class="ib press" data-act="mpower" data-id="${esc(id)}" aria-label="Av/på">${M.icon('mdi:power', 22, off ? '' : `color:${C.green}`)}</button></div>
        <div class="ctl"><button class="cb press" data-act="mp" data-s="media_previous_track" data-id="${esc(id)}" aria-label="Forrige">${M.icon('mdi:skip-previous', 26)}</button><button class="cb pp press" data-act="mp" data-s="media_play_pause" data-id="${esc(id)}" aria-label="${play ? 'Pause' : 'Spill av'}">${M.icon(play ? 'mdi:pause' : 'mdi:play', 30)}</button><button class="cb press" data-act="mp" data-s="media_next_track" data-id="${esc(id)}" aria-label="Neste">${M.icon('mdi:skip-next', 26)}</button></div>
        ${pos != null ? `<div class="bar"><span style="width:${pos.toFixed(1)}%"></span></div>` : ''}
        ${L.length > 1 ? `<div class="dots">${L.map((x, j) => `<button class="${j === i ? 'on' : ''}" data-act="np" data-i="${j}" data-haptic="selection" aria-label="${esc(M.name(h, x))}"><i></i></button>`).join('')}</div>` : ''}</div>`;
    }
    // 2b · markise/gardiner som utvidbare kort. kind: 'markise' | 'gardiner'. Hovedslideren viser snittet og setter alle.
    _cover(kind) {
      const h = this.hass, ids = kind === 'markise' ? this.A.awnings : this.A.curtains, name = kind === 'markise' ? 'Markise' : 'Gardiner';
      if (!ids.length) return `<div class="card cv"><div class="ttl"><span>${name}</span></div><div class="empty">Fant ingen ${kind === 'markise' ? 'markise' : 'gardiner'} i stua<br><button class="pick press" data-act="customize" data-section="lists">Velg entitet</button></div></div>`;
      // Deler: hver cover i lista, eller medlemmene i en cover-gruppe (attributtet entity_id)
      let parts = ids.flatMap((id) => { const m = this.s(id).attributes.entity_id; return Array.isArray(m) && m.length ? m.filter((x) => h.states[x]) : [id]; });
      parts = [...new Set(parts)];
      const pos = (id) => { if (this._cp && this._cp.id === id) return this._cp.v; const st = this.s(id), a = st.attributes || {}; return a.current_position != null ? Number(a.current_position) : st.state === 'open' ? 100 : 0; };
      const key = 'cv:' + kind, avg = this._cp && this._cp.id === key ? this._cp.v : Math.round(parts.reduce((t, x) => t + pos(x), 0) / parts.length);
      const open = !!(this.ui.cvx || {})[kind];
      const sl = (id, v, label) => `<div class="csl${v < 22 ? ' lo' : ''}" data-cv="${esc(id)}" data-parts="${esc(id === key ? parts.join(',') : id)}" role="slider" aria-label="${esc(label)}" aria-valuenow="${Math.round(v)}"><span class="f" style="width:${M.clamp(v, 0, 100)}%"></span><span class="k" style="left:${M.clamp(v, 0, 100)}%;margin-left:${v < 22 ? 46 : 0}px"></span>${id === key ? '' : `<span class="v num">${Math.round(v)} %</span>`}</div>`;
      const icon = kind === 'markise' ? 'mdi:awning-outline' : 'mdi:curtains';
      // Hovedraden: ikon · navn · prosent · pil, slideren under i full bredde (kolonnene er smale på nettbrett)
      return `<div class="card cv" data-key="cv-${kind}"><div class="cvr"><span class="cvi">${M.icon(icon, 24)}</span><span class="cvn ell">${esc(ids.length === 1 && kind === 'markise' ? M.name(h, ids[0], true) : name)}</span><span class="cvp num" data-cvp="${esc(key)}">${avg} %</span><button class="xp press${open ? ' open' : ''}" data-act="cvx" data-k="${kind}" aria-label="${open ? 'Skjul' : 'Vis mer'}" aria-expanded="${open}">${M.icon('mdi:chevron-down', 24)}</button></div>${sl(key, avg, name)}
        ${open ? `<div class="qb">${[0, 25, 50, 75, 100].map((v) => `<button class="press${avg === v ? ' on' : ''}" data-act="cvset" data-ids="${esc(parts.join(','))}" data-v="${v}" data-haptic="selection">${v} %</button>`).join('')}</div>
          ${kind === 'gardiner' && parts.length > 1 ? `<div class="prt">${parts.map((id) => `<span class="pn2">${esc(M.name(h, id, true))}</span><div class="cvr" style="gap:10px">${sl(id, pos(id), M.name(h, id))}<button class="ib press" data-act="cover" data-s="open_cover" data-id="${esc(id)}" aria-label="Opp">${M.icon('mdi:arrow-up', 22)}</button><button class="ib press" data-act="cover" data-s="close_cover" data-id="${esc(id)}" aria-label="Ned">${M.icon('mdi:arrow-down', 22)}</button></div>`).join('')}</div>` : ''}` : ''}</div>`;
    }
    _lights(wide) {
      const h = this.hass, L = this.A.lights;
      const add = `<button class="lt add press" data-act="addlight" data-key="lt-add">${M.icon('mdi:plus', 22)}Legg til lys</button>`;
      return `<div class="lg${wide ? ' wide' : ''}" data-key="lg">${L.map((id) => {
        const s = this.s(id), on = s.state === 'on', b = this._lb && this._lb.id === id ? this._lb.v : on ? Math.max(1, Math.round((s.attributes.brightness != null ? s.attributes.brightness : 255) / 2.55)) : 0;
        return `<button class="lt${on || (this._lb && this._lb.id === id) ? ' on' : ''}" data-lt="${esc(id)}" data-ent="${esc(id)}" data-key="lt-${esc(id)}" aria-pressed="${on}"><span class="lf" style="width:${on ? b : 0}%"></span><span class="li">${M.icon(on ? 'mdi:lightbulb-on' : 'mdi:lightbulb-outline', 24)}</span><span class="lx"><span class="ln ell">${esc(M.name(h, id, true))}</span><span class="lv num">${M.unavailable(s) ? 'Utilgjengelig' : on ? b + ' %' : 'Av'}</span></span></button>`;
      }).join('')}${add}</div>`;
    }
    _lysCard() {
      const A = this.A, on = A.lights.filter((id) => this.s(id).state === 'on').length;
      return `<div class="ttl"><span class="ell">Lys · ${on} av ${A.lights.length} på</span>${A.lights.length ? `<button class="lb2 press" data-act="lightsall" data-on="${on ? 0 : 1}" data-haptic="medium">${on ? 'Slå av alle' : 'Slå på alle'}</button>` : ''}</div>${this._lights(this.tab === 'lys')}`;
    }
    _nav() {
      const c = this.config, keys = (M.mshOrder || ((k) => k))(DOCK.map((d) => d[0].slice(1)), c.dock_order, c.dock_hidden || []);
      return `<nav class="nv" data-key="nv" aria-label="Snarveier">${keys.map((k) => { const d = DOCK.find((x) => x[0] === '#' + k); return d ? `<button data-act="popup" data-hash="${d[0]}" aria-label="${esc(d[2])}" title="${esc(d[2])}">${M.icon(d[1], 30)}</button>` : ''; }).join('')}<span class="sp"></span><button class="tun" data-act="popup" data-hash="#settings" aria-label="Innstillinger" title="Innstillinger">${M.icon('mdi:tune-variant', 30)}</button></nav>`;
    }
    // Innholdet til ett kort i masonry
    _cardBody(k) {
      switch (k) {
        case 'plex': return `<div class="ttl"><span>Media og klima</span></div>${this._plex()}`;
        case 'termo': return this._thermo();
        case 'spiller': return `<div class="ttl"><span>Enheter</span></div>${this._player()}`;
        case 'markise': return this._cover('markise');
        case 'gardiner': return this._cover('gardiner');
        case 'lys': return this._lysCard();
      }
      return '';
    }
    get lay() { return this._lay || M.stueLayout(this.config); }
    _ncols() { const w = this._msW || (this.getBoundingClientRect().width - 146); return w >= 1080 ? 3 : w >= 700 ? 2 : 1; }
    _masonry() {
      const tab = this.tab, L = this.lay, hid = new Set(L.hidden), edit = !!this.ui.edit && tab === 'hjem';
      const sp = this._spans || (this._spans = {}), name = (k) => (CARDS.find((c) => c[0] === k) || [k, k])[1];
      const cell = (k, col, i, cls) => `<div class="gc${cls || ''}" data-gc="${k}" data-key="gc-${k}" style="grid-column:${col + 1};grid-row:span ${sp[k] || 30};order:${col * 100 + i}"><div class="gi">${this._cardBody(k)}</div>${edit ? `<div class="ov" data-drag="${k}"><span class="gch">⠿ ${esc(name(k))}</span><button class="ghb press" data-act="ehide" data-k="${k}" aria-label="Skjul ${esc(name(k))}">${M.icon('mdi:eye-off-outline', 20)}</button></div>` : ''}</div>`;
      if (tab !== 'hjem') {
        const ks = L.cols.flat().filter((k) => (TAB_CARDS[tab] || []).includes(k));
        return `<div class="ms one" data-key="ms-${tab}">${ks.map((k, i) => cell(k, 0, i, tab === 'lys' ? '' : ' narrow')).join('')}</div>`;
      }
      const n = this._ncols();
      const cols = Array.from({ length: n }, () => []);
      L.cols.forEach((list, ci) => list.forEach((k) => { if (!hid.has(k)) cols[Math.min(ci, n - 1)].push(k); }));
      return `<div class="ms${edit ? ' editing' : ''}" data-key="ms-hjem" style="--n:${n}">${cols.map((list, ci) => list.map((k, i) => cell(k, ci, i, this._drag && this._drag.k === k ? ' ph' : '')).join('')).join('')}</div>`;
    }
    _editBar() {
      const hid = new Set(this.lay.hidden);
      return `<section class="eb" data-key="eb"><div class="et">${M.icon('mdi:view-dashboard-edit-outline', 22)}<b>Tilpass stua</b><button class="ebt press" data-act="ereset" data-haptic="medium">Tilbakestill</button><button class="ebt p press" data-act="edone" data-haptic="success">Ferdig</button></div>
        <span class="eh">Dra kortene for å flytte dem. Trykk på øyet for å vise eller skjule et kort.</span>
        <div class="ecs">${CHIPS.map(([k, l]) => `<button class="ec press${hid.has(k) ? ' off' : ''}" data-act="echip" data-k="${k}" data-haptic="selection" aria-pressed="${!hid.has(k)}">${M.icon(hid.has(k) ? 'mdi:eye-off-outline' : 'mdi:eye-outline', 18)}${esc(l)}</button>`).join('')}</div><div class="elg" data-noi18n><span>Språk · Language</span><div class="seg">${[['no', 'Norsk'], ['en', 'English']].map(([k, l]) => `<button class="${(M.i18n ? M.i18n.lang() : 'no') === k ? 'on' : ''}" data-act="lang" data-v="${k}" data-haptic="selection">${l}</button>`).join('')}</div></div></section>`;
    }
    render() {
      const tab = this.tab, edit = !!this.ui.edit && tab === 'hjem';
      this._loadEvents();
      const vis = this._tabs(), items = vis.map((k) => { const t = TABS.find((x) => x[0] === k); return { key: k, label: t[1], icon: t[2] }; });
      const bar = M.tabBar ? M.tabBar.html(items, tab, { variant: 'pop', mode: 'tekst', gear: false, keyPrefix: 'st-' }) : '';
      const hid = new Set(this.lay.hidden);
      return `${this._nav()}<div class="sd" data-key="sd">${this._header()}
        <div class="tr" data-key="tr">${bar}<span class="tip">${tab === 'hjem' && !edit ? 'Dra ned fra toppen for hurtigpanel' : ''}</span>${tab === 'hjem' && !edit ? `<button class="tpb press" data-act="edit" aria-label="Tilpass">${M.icon('mdi:view-dashboard-edit-outline', 20)}Tilpass</button>` : ''}</div>
        ${edit ? this._editBar() : ''}
        ${tab === 'hjem' ? this._night() + (hid.has('scener') && !edit ? '' : `<div class="${hid.has('scener') ? 'gc ph' : ''}" data-key="scw">${this._scenes()}</div>`) : ''}
        ${this._masonry()}</div>`;
    }
    afterRender() {
      const R = this.shadowRoot;
      if (this._hp) this._hp._hintSoon(); // hint-streken bare i Hjem-fanen
      // Navbaren står ytterst til venstre på dashbordflaten (aldri over HA-sidebaren)
      const nv = R.querySelector('.nv');
      if (nv) { const D = M.dashRect(); nv.style.left = (D.left + 14) + 'px'; }
      // Masonry: kolonnebredde → antall kolonner, kortenes høyde → span (8 px-rader)
      const ms = R.querySelector('.ms');
      if (ms && window.ResizeObserver) {
        if (!this._msRO) {
          this._msRO = new ResizeObserver((ents) => {
            let re = false;
            ents.forEach((en) => {
              const t = en.target;
              if (t.classList.contains('ms')) { const w = Math.round(t.getBoundingClientRect().width); if (w && w !== this._msW) { const n0 = this._ncols(); this._msW = w; if (this._ncols() !== n0) re = true; } return; }
              const gc = t.parentNode, k = gc && gc.dataset && gc.dataset.gc;
              if (!k) return;
              const span = Math.max(1, Math.ceil((t.offsetHeight + 22) / 8));
              if (this._spans[k] !== span) { this._spans[k] = span; gc.style.gridRow = 'span ' + span; }
            });
            if (re) this.update();
          });
        }
        if (this._msObs !== ms) { this._msObs = ms; this._msRO.observe(ms); }
        R.querySelectorAll('.gi').forEach((gi) => { if (!gi.__ro) { gi.__ro = true; this._msRO.observe(gi); } });
      }
      if (M.tabBar) M.tabBar.bind(this, R.querySelector('.mtb'), {
        active: () => this.tab,
        order: () => this._tabs(),
        onSelect: (k) => { this.setUI({ tab: k }); if (M.startTab && M.startTab.remember) M.startTab.remember(this.config.card_id, k); },
        save: (full, keys) => M.mshPatchConfig(this, { tab_order: keys }),
      });
      this._bindLights(R);
      this._bindCovers(R);
      this._bindDrag(R);
    }
    // Lysfliser: trykk = av/på, sideveis dra = lysstyrke (1–100). Vertikalt slipper (pan-y), fallgruve 2.
    _bindLights(R) {
      R.querySelectorAll('[data-lt]').forEach((el) => {
        if (el.__b) return;
        el.__b = true;
        const id = () => el.dataset.lt;
        let g = null;
        const val = (e) => { const r = el.getBoundingClientRect(); return Math.round(M.clamp((e.clientX - r.left) / r.width, 0.01, 1) * 100); };
        el.addEventListener('pointerdown', (e) => { if (e.button || this.ui.edit) return; g = { x: e.clientX, y: e.clientY, id: e.pointerId, drag: false }; });
        el.addEventListener('pointermove', (e) => {
          if (!g || e.pointerId !== g.id) return;
          const dx = e.clientX - g.x, dy = e.clientY - g.y;
          if (!g.drag) {
            if (Math.abs(dx) <= 8 && Math.abs(dy) <= 8) return;
            if (Math.abs(dy) > Math.abs(dx)) { g = null; return; }
            g.drag = true; this._busy = true; this._cancelHold();
            try { el.setPointerCapture(e.pointerId); } catch (x) { /* */ }
          }
          e.stopPropagation();
          const v = val(e);
          if (!this._lb || Math.abs(this._lb.v - v) >= 10) M.haptic('selection');
          this._lb = { id: id(), v };
          M.rs(el, () => { el.classList.add('on'); const f = el.querySelector('.lf'), lv = el.querySelector('.lv'); if (f) f.style.width = v + '%'; if (lv) lv.textContent = v + ' %'; });
        });
        const end = (e, cancel) => {
          if (!g || e.pointerId !== g.id) return;
          const was = g; g = null;
          if (was.drag) {
            this._busy = false; this._swallow = true; setTimeout(() => { this._swallow = false; }, 300);
            const L = this._lb; if (L && !cancel) M.call(this.hass, 'light', 'turn_on', { entity_id: L.id, brightness_pct: L.v });
            setTimeout(() => { this._lb = null; this.update(); }, 400);
          } else if (!cancel && !this._swallow) { M.haptic('light'); M.call(this.hass, 'light', 'toggle', { entity_id: id() }); this._swallow = true; setTimeout(() => { this._swallow = false; }, 300); }
        };
        el.addEventListener('pointerup', (e) => end(e));
        el.addEventListener('pointercancel', (e) => end(e, true));
      });
    }
    // Gardiner/markise: dra-bar slider (touch-action none + stopPropagation), posisjon ved slipp. data-parts = alle delene
    // hovedslideren styrer (snittet), eller én del.
    _bindCovers(R) {
      R.querySelectorAll('[data-cv]').forEach((el) => {
        if (el.__b) return;
        el.__b = true;
        if (M.guardDrag) M.guardDrag(el);
        let on = false;
        const val = (e) => { const r = el.getBoundingClientRect(); return Math.round(M.clamp((e.clientX - r.left) / r.width, 0, 1) * 100); };
        const paint = (v) => { this._cp = { id: el.dataset.cv, v }; M.rs(el, () => { const f = el.querySelector('.f'), k = el.querySelector('.k'), t = el.querySelector('.v'); if (f) f.style.width = v + '%'; if (k) { k.style.left = v + '%'; k.style.marginLeft = (v < 22 ? 46 : 0) + 'px'; } if (t) t.textContent = v + ' %'; el.classList.toggle('lo', v < 22); const cp = R.querySelector(`[data-cvp="${el.dataset.cv}"]`); if (cp) cp.textContent = v + ' %'; }); };
        el.addEventListener('pointerdown', (e) => { if (this.ui.edit) return; on = true; this._busy = true; try { el.setPointerCapture(e.pointerId); } catch (x) { /* */ } paint(val(e)); M.haptic('selection'); });
        el.addEventListener('pointermove', (e) => { if (on) paint(val(e)); });
        const end = () => {
          if (!on) return;
          on = false; this._busy = false;
          const C0 = this._cp, ids = String(el.dataset.parts || '').split(',').filter(Boolean);
          if (C0 && ids.length) M.call(this.hass, 'cover', 'set_cover_position', { entity_id: ids, position: C0.v });
          M.haptic('light');
          setTimeout(() => { this._cp = null; this.update(); }, 600);
        };
        el.addEventListener('pointerup', end);
        el.addEventListener('pointercancel', end);
      });
    }
    // 2b · dra og slipp i redigeringsmodus: spøkelse følger pekeren, målkolonne fra x, plass fra midtpunktene
    _bindDrag(R) {
      R.querySelectorAll('[data-drag]').forEach((ov) => {
        if (ov.__b) return;
        ov.__b = true;
        ov.addEventListener('pointerdown', (e) => {
          if (e.button || (e.target.closest && e.target.closest('button'))) return;
          e.stopPropagation(); e.preventDefault();
          const k = ov.dataset.drag, gc = ov.parentNode, r = gc.getBoundingClientRect();
          // Spøkelset ligger i ki-overlay-root (eget shadow root med kortets stiler) – kortets morph ville fjernet det
          const host = document.createElement('div');
          host.className = 'msh-ghost';
          host.attachShadow({ mode: 'open' }).innerHTML = `<style>${M.BASE_CSS || ''}${this.styles}</style>`;
          const gh = gc.cloneNode(true);
          gh.classList.add('ghost'); gh.classList.remove('ph'); gh.removeAttribute('data-key');
          Object.assign(gh.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: (r.height - 22) + 'px', gridRow: '', gridColumn: '' });
          host.shadowRoot.appendChild(gh);
          M.overlayRoot().appendChild(host);
          gh.__host = host;
          this._drag = { k, gh, dx: e.clientX - r.left, dy: e.clientY - r.top, id: e.pointerId };
          this._lay = M.stueLayout({ layout: this.lay });
          gc.classList.add('ph');
          try { ov.setPointerCapture(e.pointerId); } catch (x) { /* */ }
          M.haptic('medium');
        });
        ov.addEventListener('pointermove', (e) => {
          const D = this._drag;
          if (!D || e.pointerId !== D.id) return;
          e.stopPropagation();
          M.rs(D.gh, () => { D.gh.style.left = (e.clientX - D.dx) + 'px'; D.gh.style.top = (e.clientY - D.dy) + 'px'; });
          const ms = R.querySelector('.ms'), mr = ms.getBoundingClientRect(), n = this._ncols();
          const col = M.clamp(Math.floor((e.clientX - mr.left) / (mr.width / n)), 0, n - 1);
          const others = [...R.querySelectorAll('.ms .gc')].filter((x) => x.dataset.gc !== D.k && Number((x.style.gridColumn || '1').split('/')[0]) - 1 === col);
          let idx = others.length;
          for (let i = 0; i < others.length; i++) { const b = others[i].getBoundingClientRect(); if (e.clientY < b.top + b.height / 2) { idx = i; break; } }
          const L = this._lay, hid = new Set(L.hidden);
          // målkolonnen i layouten (kolonner over n slås sammen i den siste)
          const visCol = (ci) => Math.min(ci, n - 1);
          const cur = L.cols.findIndex((c) => c.includes(D.k)), curVis = visCol(cur);
          const targetCi = col === n - 1 && cur >= n - 1 ? cur : col;
          const list = L.cols[targetCi].filter((x) => x !== D.k);
          const visBefore = others.slice(0, idx).map((x) => x.dataset.gc);
          let at = 0;
          for (let i = 0; i < list.length; i++) if (visBefore.includes(list[i]) || hid.has(list[i])) at = i + 1;
          if (curVis === col && L.cols[cur].indexOf(D.k) === at && cur === targetCi) return;
          const next = L.cols.map((c) => c.filter((x) => x !== D.k));
          next[targetCi].splice(Math.min(at, next[targetCi].length), 0, D.k);
          if (JSON.stringify(next) === JSON.stringify(L.cols)) return;
          this._lay = { cols: next, hidden: L.hidden };
          M.haptic('light');
          this.update();
        });
        const end = (e) => {
          const D = this._drag;
          if (!D || e.pointerId !== D.id) return;
          this._drag = null;
          if (D.gh.__host && D.gh.__host.parentNode) D.gh.__host.parentNode.removeChild(D.gh.__host);
          this._swallow = true; setTimeout(() => { this._swallow = false; }, 300);
          this.update();
        };
        ov.addEventListener('pointerup', end);
        ov.addEventListener('pointercancel', end);
      });
    }
    // 2b · «+ Legg til lys»: alle lys (stua først), trykk = legg til/fjern, Tilbakestill / Ferdig → config.lights
    _lightPicker() {
      const h = this.hass, A = this.A, area = A.area;
      let sel = A.lights.slice();
      const all = M.all(h, 'light', (s) => !Array.isArray(s.attributes.entity_id));
      const inA = all.filter((id) => area && M.areaOf(h, id) === area), rest = all.filter((id) => !inA.includes(id));
      const row = (id) => { const on = sel.includes(id); return `<button class="r${on ? ' on' : ''}" data-a="tl" data-id="${esc(id)}" aria-pressed="${on}"><span class="i">${M.icon(M.domainIcon(id, h.states[id]), 22)}</span><span class="x"><b>${esc(M.name(h, id))}</b><i>${esc(id)}</i></span><span class="c">${on ? M.icon('mdi:check', 18) : ''}</span></button>`; };
      const body = () => `<div class="w"><span class="t">Lys i stua</span><span class="s">Trykk for å legge til eller fjerne. Rekkefølgen er den du velger i.</span>
        <div class="l">${inA.length ? `<span class="g">${esc(M.areaName(h, area))}</span>${inA.map(row).join('')}` : ''}${rest.length ? `<span class="g">Andre lys</span>${rest.map(row).join('')}` : ''}${all.length ? '' : '<span class="s">Fant ingen lys.</span>'}</div>
        <div class="bt"><button data-a="reset">Tilbakestill</button><button class="p" data-a="done">Ferdig</button></div></div>`;
      const ov = M.overlay({ center: true, maxWidth: 460, css: PICK_CSS, html: body() });
      if (!ov || !ov.root) return;
      ov.root.addEventListener('click', (e) => {
        const b = e.target.closest && e.target.closest('[data-a]');
        if (!b) return;
        if (b.dataset.a === 'tl') { const id = b.dataset.id, i = sel.indexOf(id); if (i >= 0) sel.splice(i, 1); else sel.push(id); M.haptic('selection'); ov.body.innerHTML = body(); return; }
        if (b.dataset.a === 'reset') { M.haptic('medium'); sel = A.areaLights.slice(); M.mshPatchConfig(this, { lights: undefined }); ov.close(); return; }
        if (b.dataset.a === 'done') { M.haptic('success'); M.mshPatchConfig(this, { lights: sel.length ? sel : undefined }); ov.close(); }
      });
    }
    onAction(name, el, e) {
      const d = el.dataset, h = this.hass;
      switch (name) {
        case 'tab': return this.setUI({ tab: d.v });
        case 'scene': {
          const id = d.id, dom = id.split('.')[0];
          if (dom === 'input_boolean') return M.call(h, 'input_boolean', 'toggle', { entity_id: id });
          return M.call(h, dom, 'turn_on', { entity_id: id }).then(() => M.toast(M.name(h, id, true) + ' kjørt'));
        }
        case 'alloff': {
          const L = this.A.lights.filter((id) => h.states[id] && h.states[id].state === 'on');
          if (!L.length) return M.toast('Alle lys er allerede av');
          return M.call(h, 'light', 'turn_off', { entity_id: L }).then(() => M.toast(`${L.length} lys slått av`));
        }
        case 'nightoff': return this.A.night && M.call(h, 'input_boolean', 'turn_off', { entity_id: this.A.night }).then(() => M.toast('Nattmodus av'));
        case 'lightsall': { const L = this.A.lights; return M.call(h, 'light', d.on === '1' ? 'turn_on' : 'turn_off', { entity_id: L }); }
        case 'addlight': return this._lightPicker();
        case 'th': { const n = this.A.climates.length; this._tt = null; return this.setUI({ th: ((this.ui.th || 0) + Number(d.d) + n) % n }); }
        case 'hvac': { const id = this.A.climates[M.clamp(this.ui.th || 0, 0, this.A.climates.length - 1)], a = h.states[id].attributes || {}; const m = d.m === 'auto' && a.hvac_modes && !a.hvac_modes.includes('auto') ? 'heat_cool' : d.m; return M.call(h, 'climate', 'set_hvac_mode', { entity_id: id, hvac_mode: m }); }
        case 'tt': {
          const id = this.A.climates[M.clamp(this.ui.th || 0, 0, this.A.climates.length - 1)], a = h.states[id].attributes || {};
          const cur = this._tt != null ? this._tt : Number(a.temperature != null ? a.temperature : 21);
          this._tt = M.clamp(Math.round((cur + Number(d.d)) * 2) / 2, Math.max(15, a.min_temp || 15), Math.min(28, a.max_temp || 28));
          this.update();
          clearTimeout(this._ttT);
          this._ttT = setTimeout(() => { const v = this._tt; M.call(h, 'climate', 'set_temperature', { entity_id: id, temperature: v }).finally(() => setTimeout(() => { this._tt = null; this.update(); }, 1500)); }, 700);
          return;
        }
        case 'np': return this.setUI({ np: Number(d.i) });
        case 'mp': return M.call(h, 'media_player', d.s, { entity_id: d.id });
        case 'mpower': return M.call(h, 'media_player', 'toggle', { entity_id: d.id });
        case 'cover': return M.call(h, 'cover', d.s, { entity_id: d.id });
        case 'cvx': return this.setUI({ cvx: { ...(this.ui.cvx || {}), [d.k]: !(this.ui.cvx || {})[d.k] } });
        case 'cvset': return M.call(h, 'cover', 'set_cover_position', { entity_id: String(d.ids).split(',').filter(Boolean), position: Number(d.v) });
        // 2b · Tilpass (redigeringsmodus) – utkast i this._lay, lagres i config.layout ved «Ferdig»
        case 'lang': if (M.i18n) M.i18n.set(d.v); return this.update(); // Fiks 59
        case 'edit': if (this._hp) this._hp.close(false); this._lay = M.stueLayout(this.config); return this.setUI({ edit: true });
        case 'edone': { const L = this._lay; this._lay = null; this.setUI({ edit: false }); if (L) M.mshPatchConfig(this, { layout: L }); return; }
        case 'ereset': this._lay = M.stueLayout({}); return this.update();
        case 'echip': case 'ehide': { const L = M.stueLayout({ layout: this.lay }), hid = new Set(L.hidden); if (name === 'ehide' || !hid.has(d.k)) hid.add(d.k); else hid.delete(d.k); this._lay = { cols: L.cols, hidden: [...hid] }; return this.update(); }
      }
      return super.onAction(name, el, e);
    }
  }
  M.define('msh-stue-card', Stue, 'MSH Stue (nettbrett)', 'Stue-dashbord v2 for nettbrett: header med prosa, faner, nattmodus, scener, media, klima, enheter, lys, dock og nedtrekkspanel.');
})();
