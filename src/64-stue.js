/* msh-stue-card · Stue-dashbord v2 for nettbrett (1366×1024 liggende) – Fiks 58 B. Kilde: prompt «Hurtigpanel og Stue»
 * (designfilen «Stue dashboard v2.dc.html» finnes ikke i repoet – bygget etter prompt-teksten). Samme funksjoner som det
 * gamle stue-dashbordet, utseendet følger hoveddashbordet. ETT kort som tegner hele visningen (panel-visning).
 * Rekkefølge: header (klokke · vær · statuspiller · avatarer · prosa med chip-lenker) → fanepille (Hjem/Media/Enheter/Lys,
 * felles MSH.tabBar: glass-valg + hold 400 ms og dra = flytt, tab_order i config) → nattmodus-kort (Hjem, når nattmodus er
 * på) → scener (Hjem) → tre kolonner (Media og klima · Enheter · Lys) → hvit dock (lenker til popupene).
 * Fanefiltrering: Hjem viser alt; Media/Enheter/Lys bare sin kolonne (Media og Enheter maks 720 px).
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
  const DOCK = [['#rolf', 'mdi:robot-vacuum', 'Støvsuger'], ['#strom', 'mdi:power-plug', 'Strøm'], ['#media', 'mdi:music-note', 'Media'], ['#tesla', 'mdi:car-electric', 'Bil'], ['#server', 'mdi:server', 'Server'], ['#klima', 'mdi:thermostat', 'Klima'], ['#settings', 'mdi:dots-horizontal', 'Mer']];
  const COND = { 'clear-night': 'Klart', cloudy: 'Skyet', fog: 'Tåke', hail: 'Hagl', lightning: 'Torden', 'lightning-rainy': 'Torden', partlycloudy: 'Delvis skyet', pouring: 'Styrtregn', rainy: 'Regn', snowy: 'Snø', 'snowy-rainy': 'Sludd', sunny: 'Sol', windy: 'Vind', 'windy-variant': 'Vind', exceptional: 'Ekstremvær' };
  const get = (o, p) => String(p).split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  const hhmm = (t) => { const d = new Date(t); return isNaN(d) ? '' : `${M.pad(d.getHours())}:${M.pad(d.getMinutes())}`; };

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
    if (!h) return { area: null, lights: [], covers: [], climates: [], players: [], scenes: [], night: null, plex: null };
    const L = (k, list) => M.applyLists(cfg, k, list).filter((id) => h.states[id]);
    const night = M.pick(cfg, 'night', M.all(h, 'input_boolean', (s, id) => /nattmodus|natt_?modus|night_?mode/.test(id) || /nattmodus|night mode/i.test(String(s.attributes.friendly_name || '')))[0] || null);
    const plex = M.pick(cfg, 'plex', M.all(h, 'sensor', (s, id) => /recently_added|nylig_lagt/.test(id) && Array.isArray(s.attributes.data))[0] || null);
    const scenes = L('scener', [...inArea(h, area, 'scene'), ...inArea(h, area, 'script'), ...inArea(h, area, 'input_boolean', (s, id) => id !== night)]);
    return {
      area, night, plex, scenes,
      lights: L('lys', inArea(h, area, 'light', (s) => !Array.isArray(s.attributes.entity_id))),
      covers: L('gardiner', inArea(h, area, 'cover')),
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
    .sd{min-height:100vh;box-sizing:border-box;padding:28px 32px 0;display:flex;flex-direction:column;gap:22px;background:${C.dash};color:${C.text}}
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
    .tr .tip{font-size:13px;color:${C.text3}}
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
    .sc{height:116px;border-radius:32px;background:var(--sd-card);display:flex;flex-direction:column;justify-content:space-between;padding:16px 18px;text-align:left}
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
    /* gardiner/markise */
    .cv{display:flex;flex-direction:column;gap:10px}
    .cv .ch2{display:flex;align-items:center;gap:10px;font-size:15px;font-weight:600}
    .cv .ch2 span{flex:1}
    .cv .row{display:flex;align-items:center;gap:10px}
    .csl{position:relative;flex:1;height:56px;border-radius:28px;background:var(--sd-in);overflow:hidden;touch-action:none}
    .csl .f{position:absolute;left:0;top:0;bottom:0;background:${PINK};border-radius:28px;min-width:56px;pointer-events:none}
    .csl .k{position:absolute;top:8px;width:40px;height:40px;border-radius:20px;background:var(--ki-knob, #fff);transform:translateX(-48px);pointer-events:none;box-shadow:0 1px 6px rgb(0 0 0/0.35)}
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
    .lb2{height:44px;padding:0 16px;border-radius:22px;background:var(--sd-card);font-size:14px;font-weight:600;white-space:nowrap}
    /* dock */
    .dk{position:sticky;bottom:16px;align-self:center;margin-top:auto;z-index:5;height:80px;border-radius:40px;background:#fafafa;color:#232323;display:flex;align-items:center;gap:6px;padding:0 12px;box-shadow:0 12px 30px rgb(0 0 0/0.35);margin:8px 0 16px}/* ki-hex-ok: hvit dock (designet) */
    .dk button{width:60px;height:60px;border-radius:30px;display:grid;place-items:center}
    .dk button:active{background:rgb(0 0 0/0.08)}
    .spacer{height:4px}
  `;

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
        { type: 'section', id: 'dock', label: 'Dock', icon: 'mdi:dock-bottom', fields: [
          { type: 'order', name: 'dock_order', hiddenName: 'dock_hidden', label: 'Knapper (rekkefølge · skjul)', options: DOCK.map(([h, , l]) => [h.slice(1), l + ' (' + h + ')']) },
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
          canOpen: () => this.tab === 'hjem',
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
    _covers() {
      const h = this.hass, L = this.A.covers;
      if (!L.length) return '';
      return `<div class="card cv" data-key="cv">${L.map((id) => {
        const s = this.s(id), a = s.attributes || {}, p = this._cp && this._cp.id === id ? this._cp.v : a.current_position != null ? a.current_position : s.state === 'open' ? 100 : 0;
        const icon = /markise|awning/.test(id) || a.device_class === 'awning' ? 'mdi:awning-outline' : 'mdi:curtains';
        return `<div class="ch2">${M.icon(icon, 20)}<span class="ell">${esc(M.name(h, id, true))}</span><span class="num" style="flex:none">${Math.round(p)} %</span></div>
          <div class="row"><div class="csl${p < 22 ? ' lo' : ''}" data-cv="${esc(id)}" role="slider" aria-label="${esc(M.name(h, id))}" aria-valuenow="${Math.round(p)}"><span class="f" style="width:${M.clamp(p, 0, 100)}%"></span><span class="k" style="left:${M.clamp(p, 0, 100)}%;margin-left:${p < 22 ? 56 : 0}px"></span><span class="v num">${Math.round(p)} %</span></div>
          <button class="ib press" data-act="cover" data-s="open_cover" data-id="${esc(id)}" aria-label="Opp">${M.icon('mdi:arrow-up', 22)}</button><button class="ib press" data-act="cover" data-s="close_cover" data-id="${esc(id)}" aria-label="Ned">${M.icon('mdi:arrow-down', 22)}</button></div>`;
      }).join('')}</div>`;
    }
    _lights(wide) {
      const h = this.hass, L = this.A.lights;
      if (!L.length) return `<div class="empty">Fant ingen lys i stua<br><button class="pick press" data-act="customize" data-section="lists">Velg entitet</button></div>`;
      return `<div class="lg${wide ? ' wide' : ''}" data-key="lg">${L.map((id) => {
        const s = this.s(id), on = s.state === 'on', b = this._lb && this._lb.id === id ? this._lb.v : on ? Math.max(1, Math.round((s.attributes.brightness != null ? s.attributes.brightness : 255) / 2.55)) : 0;
        return `<button class="lt${on || (this._lb && this._lb.id === id) ? ' on' : ''}" data-lt="${esc(id)}" data-ent="${esc(id)}" data-key="lt-${esc(id)}" aria-pressed="${on}"><span class="lf" style="width:${on ? b : 0}%"></span><span class="li">${M.icon(on ? 'mdi:lightbulb-on' : 'mdi:lightbulb-outline', 24)}</span><span class="lx"><span class="ln ell">${esc(M.name(h, id, true))}</span><span class="lv num">${M.unavailable(s) ? 'Utilgjengelig' : on ? b + ' %' : 'Av'}</span></span></button>`;
      }).join('')}</div>`;
    }
    _dock() {
      const c = this.config, keys = (M.mshOrder || ((k) => k))(DOCK.map((d) => d[0].slice(1)), c.dock_order, c.dock_hidden || []);
      return `<nav class="dk" data-key="dk">${keys.map((k) => { const d = DOCK.find((x) => x[0] === '#' + k); return d ? `<button data-act="popup" data-hash="${d[0]}" aria-label="${esc(d[2])}" title="${esc(d[2])}">${M.icon(d[1], 26)}</button>` : ''; }).join('')}</nav>`;
    }
    render() {
      const h = this.hass, tab = this.tab, A = this.A;
      this._loadEvents();
      const vis = this._tabs(), items = vis.map((k) => { const t = TABS.find((x) => x[0] === k); return { key: k, label: t[1], icon: t[2] }; });
      const bar = M.tabBar ? M.tabBar.html(items, tab, { variant: 'pop', mode: 'tekst', gear: false, keyPrefix: 'st-' }) : '';
      const on = A.lights.filter((id) => this.s(id).state === 'on').length;
      const colMedia = `<div class="col${tab === 'media' ? ' narrow' : ''}" data-key="c-media"><div class="ttl"><span>Media og klima</span></div>${this._plex()}${this._thermo()}</div>`;
      const colDev = `<div class="col${tab === 'enheter' ? ' narrow' : ''}" data-key="c-dev"><div class="ttl"><span>Enheter</span></div>${this._player()}${this._covers()}</div>`;
      const colLys = `<div class="col" data-key="c-lys"><div class="ttl"><span class="ell">Lys · ${on} av ${A.lights.length} på</span>${A.lights.length ? `<button class="lb2 press" data-act="lightsall" data-on="${on ? 0 : 1}" data-haptic="medium">${on ? 'Slå av alle' : 'Slå på alle'}</button>` : ''}</div>${this._lights(tab === 'lys')}</div>`;
      const cols = tab === 'hjem' ? colMedia + colDev + colLys : tab === 'media' ? colMedia : tab === 'enheter' ? colDev : colLys;
      return `<div class="sd" data-key="sd">${this._header()}
        <div class="tr" data-key="tr">${bar}${tab === 'hjem' ? '<span class="tip">Dra ned fra toppen for hurtigpanel</span>' : ''}</div>
        ${tab === 'hjem' ? this._night() + this._scenes() : ''}
        <div class="cols${tab === 'hjem' ? '' : ' one'}" data-key="cols-${tab}">${cols}</div>
        ${this._dock()}</div>`;
    }
    afterRender() {
      const R = this.shadowRoot;
      if (this._hp) this._hp._hintSoon(); // hint-streken bare i Hjem-fanen
      if (M.tabBar) M.tabBar.bind(this, R.querySelector('.mtb'), {
        active: () => this.tab,
        order: () => this._tabs(),
        onSelect: (k) => { this.setUI({ tab: k }); if (M.startTab && M.startTab.remember) M.startTab.remember(this.config.card_id, k); },
        save: (full, keys) => M.mshPatchConfig(this, { tab_order: keys }),
      });
      // Lysfliser: trykk = av/på, sideveis dra = lysstyrke (1–100). Vertikalt slipper (pan-y), fallgruve 2.
      R.querySelectorAll('[data-lt]').forEach((el) => {
        if (el.__b) return;
        el.__b = true;
        const id = () => el.dataset.lt;
        // Egen retningslås (mus og touch likt): > 8 px vannrett = dra lysstyrke, ellers slipp/trykk
        let g = null;
        const val = (e) => { const r = el.getBoundingClientRect(); return Math.round(M.clamp((e.clientX - r.left) / r.width, 0.01, 1) * 100); };
        el.addEventListener('pointerdown', (e) => { if (e.button) return; g = { x: e.clientX, y: e.clientY, id: e.pointerId, drag: false }; });
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
          el.classList.add('on');
          const f = el.querySelector('.lf'), lv = el.querySelector('.lv');
          if (f) f.style.width = v + '%';
          if (lv) lv.textContent = v + ' %';
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
      // Gardiner/markise: dra-bar slider (touch-action none + stopPropagation), posisjon ved slipp
      R.querySelectorAll('[data-cv]').forEach((el) => {
        if (el.__b) return;
        el.__b = true;
        if (M.guardDrag) M.guardDrag(el);
        let on = false;
        const val = (e) => { const r = el.getBoundingClientRect(); return Math.round(M.clamp((e.clientX - r.left) / r.width, 0, 1) * 100); };
        const paint = (v) => { this._cp = { id: el.dataset.cv, v }; const f = el.querySelector('.f'), k = el.querySelector('.k'), t = el.querySelector('.v'); if (f) f.style.width = v + '%'; if (k) { k.style.left = v + '%'; k.style.marginLeft = (v < 22 ? 56 : 0) + 'px'; } if (t) t.textContent = v + ' %'; el.classList.toggle('lo', v < 22); };
        el.addEventListener('pointerdown', (e) => { on = true; this._busy = true; try { el.setPointerCapture(e.pointerId); } catch (x) { /* */ } paint(val(e)); M.haptic('selection'); });
        el.addEventListener('pointermove', (e) => { if (on) paint(val(e)); });
        const end = () => { if (!on) return; on = false; this._busy = false; const C0 = this._cp; if (C0) M.call(this.hass, 'cover', 'set_cover_position', { entity_id: C0.id, position: C0.v }); M.haptic('light'); setTimeout(() => { this._cp = null; this.update(); }, 600); };
        el.addEventListener('pointerup', end);
        el.addEventListener('pointercancel', end);
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
          const L = M.all(h, 'light', (s) => s.state === 'on' && !Array.isArray(s.attributes.entity_id));
          if (!L.length) return M.toast('Alle lys er allerede av');
          return M.call(h, 'light', 'turn_off', { entity_id: L }).then(() => M.toast(`${L.length} lys slått av`));
        }
        case 'nightoff': return this.A.night && M.call(h, 'input_boolean', 'turn_off', { entity_id: this.A.night }).then(() => M.toast('Nattmodus av'));
        case 'lightsall': { const L = this.A.lights; return M.call(h, 'light', d.on === '1' ? 'turn_on' : 'turn_off', { entity_id: L }); }
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
      }
      return super.onAction(name, el, e);
    }
  }
  M.define('msh-stue-card', Stue, 'MSH Stue (nettbrett)', 'Stue-dashbord v2 for nettbrett: header med prosa, faner, nattmodus, scener, media, klima, enheter, lys, dock og nedtrekkspanel.');
})();
