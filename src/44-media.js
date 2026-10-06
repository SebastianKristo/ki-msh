/* msh-media-hero-card + msh-media-card · Media-popup (#media). Kilde: Media v4.dc.html.
 * Hero (eget kort, først): sveipbar karusell med «nå spilles» per spiller i valgt fane (omslag fra
 * entity_picture, eq-/nivåstolper, marquee-tittel, av/på) + prikker.
 * Hovedkort: faner (TV/Musikk, langt trykk + dra = omorganiser → config.tab_order), oppsett-knapp,
 * apper/kilder/snarveier, transport (musikk) eller fjernkontroll (TV), volum (slider eller knapper).
 * Autokonfig: alle media_player.* (exclude/include.spillere), sortert/gruppert per område, TV vs musikk
 * fra device_class → plattform → navn/app-attributter. Aktiv spiller = den som spiller (sist endret),
 * ellers første. Begge kortene deler valgt fane/spiller per popup (hash) via en liten buss.
 * Ved hver åpning (#media) settes fanen til config.default_tab (tv | musikk | last = sist brukt) og
 * første spiller i fanen vises. Valgt fane/spiller er UI-tilstand (setUI/uiPersist → localStorage
 * ki:<card_id>:ui) og lagres aldri i Lovelace; bare tab_order (omorganisering) er config.
 * Hero kan ligge innebygd i hovedkortets shadow DOM (config.embedded: true, config fra hovedkortet).
 * Fjernkontroll (TV): sveip på styreflaten (config.remote_swipe, std på) og hold-handlinger på Tilbake/Hjem/Meny
 * (players.<obj>.back_hold_action / home_hold_action / menu_hold_action, HA action-format).
 * Fiks 19.4: players.<obj>.remote_style = 'kompakt' (std) | 'sirkel' (styrekors 260 px, fem runde knapper, volumlinje).
 * (Nøkkelen heter remote_style fordi players.<obj>.remote allerede er remote.*-entiteten.)
 * Fiks 47 G: fanelinja har fanestil/visning i config.tabs { style, mode, start } (start speiles i start_tab, MSH.startTab);
 * «Tilpass media» = felles Tilpass-ark med ikonfaner Faner · TV · Musikk og Nullstill per aktiv fane (Media v4 cfgOpen).
 */
(function () {
  const M = window.MSH, esc = M.esc, C = M.C;
  const PINK = C.accent, PINKC = C.pink;
  // Del A pkt. 6: aksent brukt som tekst/ikon mørknes i lys modus (MSH.theme.accentText); flater beholder aksenten
  const AT = (c) => (M.theme && M.theme.accentText ? M.theme.accentText(c) : c);

  /* ------------------------------------------------------------ autokonfig */
  const TV_PLAT = ['apple_tv', 'androidtv', 'androidtv_remote', 'webostv', 'samsungtv', 'braviatv', 'philips_js', 'roku', 'vizio', 'panasonic_viera', 'firetv', 'kodi', 'plex', 'jellyfin', 'emby', 'lg_thinq', 'hisense_tv', 'tizen'];
  const MUS_PLAT = ['sonos', 'squeezebox', 'slimproto', 'spotify', 'yamaha_musiccast', 'yamaha', 'denonavr', 'bluesound', 'linkplay', 'heos', 'bose', 'frontier_silicon', 'music_assistant', 'mass', 'forked_daapd', 'volumio', 'snapcast', 'openhome', 'arcam_fmj', 'onkyo', 'cambridge_audio', 'soundtouch', 'mpd', 'russound_rio', 'nad', 'marantz'];
  // Merkevarefarger/ikoner for kjente apper/kilder (stil, ikke data).
  const APPS = [[/netflix/i, '#e50914', 'movie'], [/youtube/i, '#ff0000', 'smart_display'], [/nrk/i, '#00b9f2', 'live_tv'], [/tv ?2/i, '#2b6ef2', 'tv'], [/telia/i, '#990ae3', 'smart_display'], [/plex/i, '#e5a00d', 'play_circle'],
    [/spotify/i, '#1db954', 'graphic_eq'], [/disney/i, '#113ccf', 'movie'], [/hbo|^max$/i, '#5822b4', 'movie'], [/viaplay/i, '#e3001b', 'movie'], [/prime|amazon/i, '#00a8e1', 'movie'], [/apple ?tv|tv\+/i, null, 'mdi:apple'],
    [/airplay/i, null, 'airplay'], [/hdmi/i, null, 'mdi:video-input-hdmi'], [/radio|tunein/i, null, 'radio'], [/phono|vinyl|turntable/i, null, 'album'], [/bluetooth/i, null, 'mdi:bluetooth'], [/^cd\b|\bcd$/i, null, 'mdi:disc'], [/optical|optisk|coax/i, null, 'mdi:waveform'], [/usb/i, null, 'mdi:usb'], [/antenn|tuner|dvb/i, null, 'mdi:antenna'], [/^tv$|arc|tv audio/i, null, 'tv'], [/aux|line/i, null, 'mdi:audio-input-rca']];
  const appStyle = (name) => { for (const [re, col, icon] of APPS) if (re.test(String(name || ''))) return { col, icon }; return { col: null, icon: null }; };
  const TV = (k, n) => (M.tabH ? M.tabH.v(k, n) : n + 'px'); // 33.4: fanehøyde-variabler (05-tab-bar.js)
  const TABS = [['tv', 'TV'], ['musikk', 'Musikk']];
  const obj = (id) => String(id).split('.').slice(1).join('.');
  const pcfgOf = (cfg, id) => ((cfg && cfg.players) || {})[obj(id)] || {};
  const devOf = (hass, id) => { const e = M.regEntry(hass, id); return (e && e.device_id) || null; };
  const sameDevice = (hass, id, domains) => { const d = devOf(hass, id); return d ? M.all(hass, domains, (s, x) => x !== id && devOf(hass, x) === d) : []; };

  function autoKind(hass, id) {
    const s = hass.states[id], a = (s && s.attributes) || {}, e = M.regEntry(hass, id) || {};
    if (a.device_class === 'tv') return 'tv';
    if (a.device_class === 'speaker' || a.device_class === 'receiver') return 'musikk';
    if (TV_PLAT.includes(e.platform)) return 'tv';
    if (MUS_PLAT.includes(e.platform)) return 'musikk';
    const n = (id + ' ' + (a.friendly_name || '')).toLowerCase();
    if (/\btv\b|_tv\b|\btv_|television|fjernsyn|apple ?tv|shield|chromecast|telia/.test(n)) return 'tv';
    if (a.app_id || a.app_name) return 'tv';
    return 'musikk';
  }
  // 31.1: mellomlagret per (config-objekt, hass, withHidden) – editoren kaller dette for hver spiller/seksjon i én tegning,
  // så uten minne ble arbeidet O(spillere²) per tegning.
  // Minnet gjelder bare innenfor samme synkrone tegning (epoke = mikrooppgave), så endringer i hass.states på stedet ses alltid.
  const MP_MEMO = new WeakMap();
  let EPOCH = 0, epQ = false;
  const epoch = () => { if (!epQ) { epQ = true; queueMicrotask(() => { EPOCH++; epQ = false; }); } return EPOCH; };
  M.mediaPlayers = function (hass, cfg, withHidden) {
    cfg = cfg || {};
    if (!hass) return { tv: [], musikk: [], all: [] };
    const mm = MP_MEMO.get(cfg), wk = withHidden ? 1 : 0, ep = epoch();
    const same = mm && mm.h === hass && mm.e === ep;
    if (same && mm[wk]) return mm[wk];
    const res = mediaPlayers0(hass, cfg, withHidden);
    const slot = same ? mm : { h: hass, e: ep };
    slot[wk] = res; MP_MEMO.set(cfg, slot);
    return res;
  };
  function mediaPlayers0(hass, cfg, withHidden) {
    const aIdx = {};
    M.areas(hass).forEach((a, i) => { aIdx[a.id] = i; });
    const ids = M.applyLists(cfg, 'spillere', M.all(hass, 'media_player'));
    // 31.1: «Mediaspiller» per kilde (players.<obj>.entity) – kilden (obj = config-nøkkel) bruker en annen media_player.
    // En spiller som er valgt som mediaspiller for en annen kilde, vises ikke i tillegg som egen kilde.
    const entOf = (id) => { const e = pcfgOf(cfg, id).entity; return typeof e === 'string' && e !== id && /^media_player\./.test(e) && hass.states[e] ? e : null; };
    const used = new Set(ids.map(entOf).filter(Boolean));
    const out = ids.filter((id) => hass.states[id] && (entOf(id) || !used.has(id))).map((id) => {
      const pc = pcfgOf(cfg, id), eid = entOf(id) || id, s = hass.states[eid], area = M.areaOf(hass, eid);
      const kind = pc.type && pc.type !== 'auto' ? pc.type : autoKind(hass, eid);
      return { id: eid, obj: obj(id), slot: id, kind, auto: autoKind(hass, eid), area, areaName: area ? M.areaName(hass, area) : null, name: pc.name || s.attributes.friendly_name || obj(eid), pc };
    }).filter((p) => (withHidden || p.kind !== 'skjul') && (!cfg.area || p.area === cfg.area));
    const ai = (p) => (p.area ? (aIdx[p.area] != null ? aIdx[p.area] : 98) : 99);
    out.sort((a, b) => ai(a) - ai(b) || M.cmpNb(a.name, b.name));
    // Fiks 17.22: rekkefølge per fane (config.order.tv/musikk = [entity_id …]) og skjulte spillere (config.hidden[id] = true).
    // Skjulte tas ikke med i karusellen, men minst én spiller per fane er alltid synlig.
    const ord = cfg.order && typeof cfg.order === 'object' ? cfg.order : {}, hid = cfg.hidden && typeof cfg.hidden === 'object' ? cfg.hidden : {};
    const tabOf = (p) => (p.kind === 'skjul' ? p.auto : p.kind);
    const oi = (p) => { const o = Array.isArray(ord[tabOf(p)]) ? ord[tabOf(p)] : []; const i = o.indexOf(p.id); return i < 0 ? 1e4 : i; };
    const base = out.map((p, i) => [p, i]).sort((x, y) => oi(x[0]) - oi(y[0]) || x[1] - y[1]).map((x) => x[0]);
    base.forEach((p) => { p.hidden = !!hid[p.id]; });
    const pick = (k) => {
      const L = base.filter((p) => p.kind === k);
      if (withHidden) return L;
      const V = L.filter((p) => !p.hidden);
      return V.length || !L.length ? V : [L[0]];
    };
    const tv = pick('tv'), musikk = pick('musikk');
    return { tv, musikk, all: withHidden ? base : base.filter((p) => tv.includes(p) || musikk.includes(p)) };
  }
  // 36.5: startfane (felles MSH.startTab): start_tab, ellers tabs.start (47 G), ellers gamle default_tab (tv | musikk | last)
  const startLegacy = (c) => (c && ((c.tabs && typeof c.tabs === 'object' && c.tabs.start) || c.default_tab)) || undefined;
  const tabOrder = (cfg) => {
    const k = TABS.map((t) => t[0]);
    const o = Array.isArray(cfg.tab_order) ? cfg.tab_order.filter((x) => k.includes(x)) : [];
    k.forEach((x) => { if (!o.includes(x)) o.push(x); });
    const hid = cfg.hidden_tabs || [], v = o.filter((x) => !hid.includes(x));
    return { all: o, vis: v.length ? v : o };
  };

  /* Fiks 47 G · fanestil for fanelinja øverst i Media (Media v4 seg/tb 1:1). Config: tabs: { style, mode, start }
   *   style: kontur (std: spor med ring + glidende rosa indikator) | fylt | glass | strek («Understrek») | chips
   *   mode:  tekst (std) | ikon | aktiv («Ikon + aktiv»: bare aktiv fane viser navnet) | begge
   *   start: speiles i start_tab (felles MSH.startTab, som gjelder) – se startLegacy over.
   * Samme HTML/CSS i kortet og i forhåndsvisningen i «Tilpass media» → Faner (CSS med prefiks for editorens shadow root).
   * Lys modus: tokens + MSH.theme.whiteA/blackA; lysrefleks på glass = hvit i begge moduser (regel). */
  const TSTYLES = ['kontur', 'fylt', 'glass', 'strek', 'chips'], TMODES = ['tekst', 'ikon', 'aktiv', 'begge'];
  const TICON = { tv: 'tv', musikk: 'music_note' };
  const tabLook = (c) => { const t = c && c.tabs && typeof c.tabs === 'object' ? c.tabs : {}; return { style: TSTYLES.includes(t.style) ? t.style : 'kontur', mode: TMODES.includes(t.mode) ? t.mode : 'tekst' }; };
  const WA = (a) => M.theme.whiteA(a), BA = (a) => M.theme.blackA(a); // regel 4/3 (00-a-theme lastes før alle kort)
  // o: { preview (spans uten roller), style (inline variabler, MSH.tabH) }
  const tabBarHTML = (order, cur, cfg, o = {}) => {
    const L = tabLook(cfg), kon = L.style === 'kontur', pv = !!o.preview, ti = Math.max(0, order.indexOf(cur));
    const tab = (k) => {
      const on = k === cur, ic = L.mode !== 'tekst', lb = L.mode === 'tekst' || L.mode === 'begge' || (L.mode === 'aktiv' && on), name = (TABS.find((t) => t[0] === k) || [k, k])[1];
      const inner = `${ic ? M.icon(TICON[k] || 'tab', 20) : ''}${lb ? `<span class="tl">${esc(name)}</span>` : ''}`, cls = `tab${pv ? ' mtp-t' : ''}${on ? ' on' : ''}${lb ? '' : ' io'}`;
      return pv ? `<span class="${cls}" data-t="${k}" data-key="pt-${k}">${inner}</span>`
        : `<button class="${cls}" role="tab" aria-selected="${on}" aria-label="${esc(name)}" title="${esc(name)}" data-act="tab" data-t="${k}" data-haptic="selection" data-key="${k}">${inner}</button>`;
    };
    const ind = kon ? `<span class="ind ${order.includes(cur) ? '' : 'off'}" data-key="ind" aria-hidden="true"></span>` : '';
    const gear = pv ? `<span class="gear" data-key="gear">${M.icon('settings', 22)}</span>` : `<button class="gear press" data-act="customize" data-key="gear" title="Oppsett">${M.icon('settings', 22)}</button>`;
    return `<div class="tabs ts-${L.style} md-${L.mode}"${o.style ? ` style="${o.style}"` : ''}${pv ? ' data-key="mtp-row" aria-hidden="true"' : ''}>${kon ? '<span data-key="tsp"></span>' : ''}<div class="seg msh-tr ts-${L.style} md-${L.mode}" data-gd-skip data-key="seg" style="--n:${order.length || 1};--i:${ti}">${ind}${order.map(tab).join('')}</div>${gear}</div>`;
  };
  const tabBarCSS = (P = '') => {
    const ring = 'inset 0 0 0 1px ' + WA(0.14), none = 'background:none;box-shadow:none;-webkit-backdrop-filter:none;backdrop-filter:none';
    const fl = ['fylt', 'glass', 'strek'].map((s) => `${P}.seg.ts-${s}>.tab`).join(',');
    return `
    /* 33.4: fanehøyde (MSH.tabH) – pille H (38), sporet H + 8, tannhjul = sporets høyde */
    ${P}.tabs{--mg:calc(${TV('th', 38)} + 8px);display:grid;grid-template-columns:var(--mg) minmax(0,1fr) var(--mg);align-items:center;gap:8px}
    ${P}.tabs:not(.ts-kontur){grid-template-columns:minmax(0,1fr) var(--mg)}
    /* standard (Kontur): transparent + ring; glassflate bare med Liquid Glass-temaet (MSH.tabSurface, Fiks 15.2) */
    ${P}.seg{gap:2px;padding:4px;border-radius:calc(${TV('th', 38)} / 2 + 3px);${M.tabSurface ? M.tabSurface('transparent', ring) : `box-shadow:${ring};`}justify-self:center}
    ${P}.tab{display:flex;align-items:center;justify-content:center;gap:6px;white-space:nowrap;height:${TV('th', 38)};padding:0 ${TV('tp', 18)};border-radius:calc(${TV('th', 38)} / 2);font-size:${TV('tf', 13)};font-weight:500;color:var(--ki-text-2, var(--gray800,#afafaf));background:transparent}
    ${P}.tab.io{padding:0 12px}
    ${P}.tab ha-icon{flex:none}
    ${P}.tab.on{background:${PINK};color:var(--ki-on-accent, var(--gray200,#3a3a3a))}
    /* Fiks 16.10: like brede faner + indikator med indeks-/prosentposisjon (--i/--n) – glir med transition, følger fingeren ved dra */
    ${P}.seg.msh-tr{position:relative;display:grid;grid-auto-flow:column;grid-auto-columns:1fr}
    ${P}.seg .tab{position:relative;z-index:1;transition:color .25s,background .2s,box-shadow .2s}
    ${P}.seg.ts-kontur .tab.on{background:transparent}
    ${P}.seg .ind{position:absolute;z-index:0;top:4px;bottom:4px;left:calc(4px + (100% - 6px) * var(--i, 0) / var(--n, 1));width:calc((100% - 6px) / var(--n, 1) - 2px);border-radius:calc(${TV('th', 38)} / 2);background:${PINK};pointer-events:none;
      transition:left .34s cubic-bezier(.34,1.25,.64,1),box-shadow .2s,scale .2s cubic-bezier(.34,1.8,.64,1)}
    ${P}.seg .ind.off{opacity:0}
    ${P}.seg .ind.drag{transition:left .12s cubic-bezier(.34,1.5,.64,1),box-shadow .2s,scale .25s cubic-bezier(.34,1.8,.64,1);scale:1.1;box-shadow:inset 0 1px 0 ${WA(0.65)},inset 0 -1px 1px ${WA(0.18)},inset 0 0 0 0.5px ${WA(0.4)},0 10px 24px ${BA(0.35)}}
    ${P}.seg.tr-drag .ind{opacity:0}
    /* 47 G · Fylt / Glass / Understrek / Chips: faner uten indikator, aktiv flate på selve fanen */
    ${P}.seg.msh-tr.ts-fylt,${P}.seg.msh-tr.ts-glass,${P}.seg.msh-tr.ts-strek,${P}.seg.msh-tr.ts-chips{display:flex;min-width:0;justify-self:stretch}
    ${P}.seg.ts-fylt,${P}.seg.ts-glass{border-radius:26px}
    ${P}.seg.ts-fylt{background:var(--ki-surface, #3a3a3a);box-shadow:inset 0 0 0 1px ${WA(0.05)};-webkit-backdrop-filter:none;backdrop-filter:none}
    ${P}.seg.ts-glass{background:${WA(0.06)};-webkit-backdrop-filter:blur(20px) saturate(180%);backdrop-filter:blur(20px) saturate(180%);box-shadow:inset 0 1px 0 rgb(255 255 255 / 0.16),inset 0 0 0 0.5px rgb(255 255 255 / 0.12),0 8px 24px ${BA(0.25)}}
    ${P}.seg.ts-strek{gap:0;padding:0;border-radius:0;${none}}
    ${P}.seg.ts-chips{gap:8px;padding:0;border-radius:0;${none};overflow-x:auto;scrollbar-width:none}
    ${fl}{flex:1 1 0;min-width:0;height:${TV('th', 44)};padding:0 8px;border-radius:22px;font-size:14px}
    ${['fylt', 'glass', 'strek'].map((s) => `${P}.seg.ts-${s}.md-aktiv>.tab.on`).join(',')}{flex:2 1 0}
    ${P}.seg.ts-fylt>.tab.on{background:${PINK};color:var(--ki-on-accent, #3a3a3a)}
    ${P}.seg.ts-glass>.tab{color:var(--ki-text-1, #c7c7c7)}
    ${P}.seg.ts-glass>.tab.on{background:var(--ki-surface, linear-gradient(180deg, rgba(255,255,255,0.30), rgba(255,255,255,0.10)));color:var(--ki-text, #fafafa);box-shadow:inset 0 1px 0 rgb(255 255 255 / 0.55),inset 0 0 0 0.5px rgb(255 255 255 / 0.3),0 4px 12px ${BA(0.25)}}
    ${P}.seg.ts-strek>.tab{border-radius:0;font-size:15px;color:var(--ki-text-mid, #979797);box-shadow:inset 0 -1px 0 ${WA(0.1)}}
    ${P}.seg.ts-strek>.tab.on{background:transparent;color:var(--ki-text, #fafafa);box-shadow:inset 0 -3px 0 ${PINKC}}
    ${P}.seg.ts-chips>.tab{flex:none;height:${TV('th', 40)};min-width:44px;padding:0 16px;border-radius:20px;font-size:14px;background:var(--ki-surface, #3a3a3a);color:var(--ki-text-1, #e1e1e1)}
    ${P}.seg.ts-chips>.tab.io{padding:0 12px}
    ${P}.seg.ts-chips>.tab.on{background:${PINK};color:var(--ki-on-accent, #3a3a3a)}
    ${P}.gear{width:var(--mg,46px);height:var(--mg,46px);border-radius:calc(var(--mg,46px) / 2);background:var(--ki-surface, var(--gray200,#3a3a3a));display:grid;place-items:center;color:var(--ki-text-2, var(--gray800,#afafaf))}
    ${P}.tabs.ts-glass .gear{background:${WA(0.08)};-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px);box-shadow:inset 0 1px 0 rgb(255 255 255 / 0.16)}`;
  };
  const remoteOf = (hass, p) => p.pc.remote || sameDevice(hass, p.id, 'remote')[0] || (hass.states['remote.' + obj(p.id)] ? 'remote.' + obj(p.id) : null);
  const REMOTE = {
    apple: { hw: 'Apple TV', holdLabel: 'Kontrollsenter', up: 'up', down: 'down', left: 'left', right: 'right', ok: 'select', back: 'menu', home: 'home', menu: 'top_menu', play: 'play_pause', mic: 'voice', hold: { command: 'home', hold_secs: 1 } },
    google: { hw: 'Google TV', holdLabel: 'Dashbord', up: 'DPAD_UP', down: 'DPAD_DOWN', left: 'DPAD_LEFT', right: 'DPAD_RIGHT', ok: 'DPAD_CENTER', back: 'BACK', home: 'HOME', menu: 'MENU', play: 'MEDIA_PLAY_PAUSE', mic: 'SEARCH', hold: { command: 'KEYCODE_HOME', hold_secs: 1 } },
  };
  /* Hold-handlinger på Tilbake/Hjem/Meny (config <knapp>_hold_action, HA action-format, per TV under
   * players.<obj> eller felles på rotnivå). Hjem uten verdi = plattform-standard (Apple TV: `home` hold_secs 1 =
   * Kontrollsenter, Google TV: KEYCODE_HOME langt trykk = Dashbord); Tilbake/Meny uten verdi = ingen.
   * { action:'none' } = ingen. perform-action media_player.select_source / remote.send_command uten target =
   * «Åpne app» / «Send kommando» (kortet fyller inn spiller/remote). Alt annet = HA-handling. */
  const HOLD_KEYS = ['back', 'home', 'menu'];
  const HOLD_MS = 450;
  // Tastetrykk og tjenestekall vises ikke i UI (fiks 15.9) – bare haptic/trykk-animasjon; logges for feilsøking.
  const dbg = (msg) => { try { console.debug('[msh-media]', msg); } catch (e) { /* ignorer */ } };
  const SW_MIN = 10, SW_STEP = 34; // sveip: terskel før det er et sveip, px per kommando
  const actLabel = (h, a) => {
    const pa = a.perform_action || a.service, ent = a.entity || (a.target && [].concat(a.target.entity_id || [])[0]) || (a.data && [].concat(a.data.entity_id || [])[0]);
    if (a.action === 'navigate') return 'Gå til ' + (a.navigation_path || '–');
    if (a.action === 'url') return 'Åpne lenke';
    if (a.action === 'more-info') return ent ? M.name(h, ent) : 'Detaljer';
    if (a.action === 'toggle') return ent ? 'Slå av/på ' + M.name(h, ent) : 'Slå av/på';
    if (pa) { const sc = [ent, pa].find((x) => /^(script|scene)\.[a-z0-9_]+$/.test(x || '') && h.states[x]); return sc ? M.name(h, sc) : pa; }
    return 'HA-handling';
  };
  const holdOf = (cfg, p, c) => { const k = c + '_hold_action', v = p.pc[k] !== undefined ? p.pc[k] : (cfg || {})[k]; return v && typeof v === 'object' ? v : null; };
  // → { kind: 'std' | 'app' | 'cmd' | 'ha', a, label } eller null (ingen hold-handling)
  const holdPlan = (h, cfg, p, c) => {
    if (!HOLD_KEYS.includes(c)) return null;
    const a = holdOf(cfg, p, c);
    if (!a) return c === 'home' ? { kind: 'std', label: REMOTE[platOf(h, p)].holdLabel } : null;
    if (a.action === 'none' || !a.action) return null;
    const svc = a.action === 'perform-action' || a.action === 'call-service', pa = a.perform_action || a.service;
    const tgt = a.target && Object.keys(a.target).length, d = a.data || a.service_data || {};
    if (svc && pa === 'media_player.select_source' && !tgt) return { kind: 'app', a, label: d.source ? 'Åpne ' + d.source : 'Åpne app' };
    if (svc && pa === 'remote.send_command' && !tgt) return { kind: 'cmd', a, label: d.command ? 'Send ' + [].concat(d.command).join(', ') : 'Send kommando' };
    return { kind: 'ha', a, label: actLabel(h, a) };
  };
  // Utfør en HA-handling (tap_action-format) fra kortet. ent = standard-entitet for more-info/toggle.
  const runAction = (card, a, ent) => {
    const h = card.hass, e = a.entity || ent;
    switch (a.action) {
      case 'perform-action': case 'call-service': {
        const [dm, sv] = String(a.perform_action || a.service || '').split('.');
        if (!dm || !sv) return M.toast('Mangler tjeneste i hold-handlingen');
        return M.call(h, dm, sv, { ...(a.data || a.service_data || {}), ...(a.target || {}) });
      }
      case 'navigate': return M.navigate(a.navigation_path);
      case 'url': return a.url_path && window.open(a.url_path, '_blank');
      case 'more-info': return M.moreInfo(card, e);
      case 'toggle': return e && M.toggle(h, e);
      case 'fire-dom-event': return card.dispatchEvent(new CustomEvent('ll-custom', { detail: a, bubbles: true, composed: true }));
      default:
    }
  };
  const autoPlat = (hass, p) => {
    const rem = remoteOf(hass, p);
    const pf = [(M.regEntry(hass, rem) || {}).platform, (M.regEntry(hass, p.id) || {}).platform].join(' ');
    if (/apple_tv/.test(pf)) return 'apple';
    if (/android|cast|google/.test(pf)) return 'google';
    const n = (p.id + ' ' + p.name).toLowerCase();
    if (/google|android|shield|chromecast|telia|sony|bravia|philips|tcl|nvidia/.test(n)) return 'google';
    return 'apple';
  };
  const platOf = (hass, p) => (REMOTE[p.pc.platform] ? p.pc.platform : autoPlat(hass, p));
  const svcFor = (id) => {
    const d = String(id).split('.')[0];
    if (d === 'button' || d === 'input_button') return [d, 'press'];
    if (d === 'script' || d === 'scene' || d === 'switch' || d === 'light' || d === 'input_boolean') return [d, 'turn_on'];
    return ['homeassistant', 'turn_on'];
  };
  const autoShortcuts = (hass, p) => sameDevice(hass, p.id, ['button', 'input_button', 'script', 'scene']);

  /* ------------------------------------------------------------ Fiks 21.6: apper, innganger og snarveier per spiller
   * players.<obj>.apps    = [{ name, icon, color, source, app_id }]           (TV · Apper; tom config = autokonfig fra source_list)
   * players.<obj>.inputs  = [{ name, source, icon }]                           (TV · Innganger; auto = HDMI 1/2/3 · ARC/Antenne ∩ source_list)
   * players.<obj>.presets = [{ name, icon, type, target, content_type }]       (Musikk; type favorite | script | button | source)
   * Ingen hardkodede lister: chip-feltene i editoren kommer fra source_list / media_player/browse_media (Favoritter). */
  const INPUT_RE = /hdmi|antenn|antenna|^tv$|live ?tv|tuner|dvb|terrestrial|kabel-?tv|satellit|composite|component|^av\b|scart|^usb|optical|optisk|\b(e)?arc\b|displayport|^dp\b|^pc$|vga/i;
  const srcList = (hass, id) => {
    const a = ((hass && hass.states[id]) || {}).attributes || {};
    return [...new Set([].concat(Array.isArray(a.source_list) ? a.source_list : [], Array.isArray(a.app_list) ? a.app_list : []).map(String))];
  };
  const hideOf = (p) => String(p.pc.hide_sources || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
  const DEF_INPUTS = [['HDMI 1', /hdmi[ _-]?1\b/i], ['HDMI 2', /hdmi[ _-]?2\b/i], ['HDMI 3 · ARC', /hdmi[ _-]?3\b|\b(e)?arc\b/i], ['Antenne', /antenn|antenna|^tv$|live ?tv|tuner|dvb|terrestrial/i]];
  const appFrom = (n) => { const st = appStyle(n); return { name: n, icon: st.icon || 'apps', color: st.col || '', source: n }; };
  const inputFrom = (n, name) => ({ name: name || n, source: n, icon: name === 'Antenne' ? 'mdi:antenna' : appStyle(n).icon || 'mdi:video-input-hdmi' });
  const autoApps = (hass, p) => { const hide = hideOf(p); return srcList(hass, p.id).filter((n) => !INPUT_RE.test(n) && !hide.includes(n.toLowerCase())).map(appFrom); };
  const autoInputs = (hass, p) => {
    const L = srcList(hass, p.id), used = new Set();
    return DEF_INPUTS.map(([nm, re]) => { const s = L.find((x) => re.test(x) && !used.has(x)); if (!s) return null; used.add(s); return inputFrom(s, nm); }).filter(Boolean);
  };
  const scType = (id) => (/^(input_)?button\./.test(id) ? 'button' : 'script');
  const autoPresets = (hass, p) => {
    const sc = Array.isArray(p.pc.shortcuts) && p.pc.shortcuts.length ? p.pc.shortcuts : autoShortcuts(hass, p), hide = hideOf(p);
    return [...sc.map((id) => ({ name: M.name(hass, id, p.name), type: scType(id), target: id })),
      ...srcList(hass, p.id).filter((n) => !hide.includes(n.toLowerCase())).map((n) => ({ name: n, icon: appStyle(n).icon || 'mdi:import', type: 'source', target: n }))];
  };
  const LISTS = { apps: autoApps, inputs: autoInputs, presets: autoPresets };
  // Liste for spilleren: config (også tom liste = brukeren har fjernet alt) ellers autokonfig
  const listOf = (hass, p, kind) => (Array.isArray(p.pc[kind]) ? p.pc[kind].filter((x) => x && typeof x === 'object') : LISTS[kind](hass, p));
  // Media-nettleseren: Favoritter (Squeezebox/LMS, Music Assistant …) per spiller, mellomlagret 60 s. cb kalles når svaret kommer.
  /* 31.1 · ÅRSAK TIL FRYSEN: editoren sendte en NY tilbakekalling (lukking) per spiller ved hver tegning. Mens svarene
   * var underveis havnet alle disse i cbs-settene (Set dedupliserer ikke nye lukkinger), og hvert svar tegnet arket
   * like mange ganger som det var tegninger siden – og hver av de tegningene la til nye kall i de andre spillernes sett.
   * Med N spillere ≈ 2^N tegninger (målt: 4 spillere → 513 tegninger / 33 s; 10 spillere → hovedtråden låst > 5 min).
   * Nå: kalleren sender en STABIL tilbakekalling (én per editor), og editoren slår sammen tegninger (rAF). */
  const FAV = {};
  const favorites = (hass, id, cb) => {
    const f = FAV[id];
    if (f && (f.busy || Date.now() - f.t < 60000)) { if (f.busy && cb) f.cbs.add(cb); return f.list; }
    if (!hass || !hass.callWS) return f ? f.list || [] : [];
    const o = FAV[id] = { t: Date.now(), list: f ? f.list : null, busy: true, cbs: new Set(cb ? [cb] : []) };
    const ws = (x) => hass.callWS({ type: 'media_player/browse_media', entity_id: id, ...(x || {}) });
    const done = (list) => { o.list = list; o.busy = false; o.t = Date.now(); o.cbs.forEach((c) => { try { c(); } catch (e) { /* */ } }); o.cbs.clear(); };
    ws().then(async (root) => {
      const ch = (root && root.children) || [];
      const fav = ch.find((c) => /favou?rit/i.test(c.title || '') || /favou?rit/i.test(c.media_content_type || '') || /favou?rit/i.test(c.media_content_id || ''));
      const r = fav ? await ws({ media_content_id: fav.media_content_id, media_content_type: fav.media_content_type }) : null;
      done(((r && r.children) || []).filter((c) => c && c.can_play !== false && c.media_content_id).map((c) => ({ title: c.title || c.media_content_id, id: c.media_content_id, type: c.media_content_type || 'music' })));
    }).catch(() => done([]));
    return o.list;
  };
  M.mediaFavorites = favorites;

  /* ------------------------------------------------------------ volum-rad (Fiks 17.21 / 17.23) – felles hjelper
   * MSH.volumeRow – brukes av msh-media-card (TV og Musikk) og kan brukes av Rom → Media (17.4):
   *   html(o)          → HTML for raden. o: { key (unik, f.eks. entity_id), style: 'pille'|'trinn'|'knapper',
   *                      level: 0–100|null, approx (vis «≈»), muted, dis (nedtonet, «–»), alt: stilen bryteren bytter til|null }
   *   CSS              → stilene (legg i kortets styles)
   *   bind(root, ctl)  → delegerte lyttere på shadowRoot (én gang; ctl kan byttes ved hver tegning).
   *                      ctl(key) → { set(v, final), step(dir ±1), mute(), toggle(), stepDrag, toasts }
   *                      36.9: volumknappen (ikon + tall, data-vhold) – trykk demper aldri, hold 500 ms = mute() + toast;
   *                      dra mens dempet (raden data-muted="1") → mute() én gang (lyd på)
   *                      set: under drag throttlet 150 ms (final=false), endelig verdi ved slipp (final=true).
   *                      stepDrag: true = knapp-volum → drag gir step() per 4 % bevegelse (haptic light per steg).
   *   pref(kind, cfg)  → { style, alt } for 'musikk' (pille|trinn, ki-store media.vol_style) eller 'tv' (trinn|knapper,
   *                      media.vol_style_tv). cfg.vol_style / cfg.vol_style_tv låser stilen (ingen bryter); 'user'/tom = brukeren bytter.
   *   toggle(kind, cfg)→ bytt og lagre per bruker i ki-store (haptic selection).
   *   live(key, v)     → verdien mens man drar / rett etter slipp (1,5 s), ellers v.
   * −/+ : ett steg per trykk, hold = gjentar hver 180 ms. Drag: touch-action none + stopPropagation (fallgruve 2). */
  const VL = {}; // key → { v, t, drag }
  const VOL_PINK = 'linear-gradient(90deg, #f294c8, #f5cfd0)';
  const volIcon = (v, muted) => (muted || v === 0 ? 'mdi:volume-off' : v == null ? 'mdi:volume-medium' : v < 34 ? 'mdi:volume-low' : v < 67 ? 'mdi:volume-medium' : 'mdi:volume-high');
  const VSTYLES = { musikk: ['pille', 'trinn'], tv: ['trinn', 'knapper'] };
  M.volumeRow = {
    mark(key, v) { VL[key] = { v, t: Date.now(), drag: false }; },
    live(key, v) { const l = VL[key]; return l && (l.drag || Date.now() - l.t < 1500) ? l.v : v; },
    pref(kind, cfg) {
      const k = kind === 'tv' ? 'tv' : 'musikk', S = VSTYLES[k], ck = k === 'tv' ? 'vol_style_tv' : 'vol_style', fixed = (cfg || {})[ck];
      if (S.includes(fixed)) return { style: fixed, alt: null };
      const u = M.store && M.store.get ? M.store.get('media.' + ck) : null, style = S.includes(u) ? u : S[0];
      return { style, alt: S.find((x) => x !== style) };
    },
    toggle(kind, cfg) {
      const P = M.volumeRow.pref(kind, cfg), ck = kind === 'tv' ? 'vol_style_tv' : 'vol_style';
      if (!P.alt) return;
      M.haptic('selection');
      if (M.store && M.store.set) M.store.set('media.' + ck, P.alt);
    },
    html(o) {
      const key = String(o.key || ''), dis = !!o.dis, raw = o.level == null || dis ? null : Math.round(o.level);
      const v = M.volumeRow.live(key, raw), muted = !!o.muted && !dis, num = v == null ? '–' : (o.approx ? '≈' : '') + v;
      const ic = volIcon(v, muted), icCol = muted ? `color:${AT(C.red)}` : '';
      const tog = o.alt ? `<button class="mvt" data-vact="toggle" title="Bytt volum-stil" aria-label="Bytt volum-stil">${M.icon(o.alt === 'trinn' ? 'mdi:equalizer' : 'mdi:dots-horizontal', 22)}</button>` : '';
      let body;
      if (o.style === 'knapper') {
        body = `<div class="mvp mvk ${dis ? 'dis' : ''}">
          <button data-vact="down" title="Volum ned" aria-label="Volum ned">${M.icon('mdi:volume-minus', 26)}</button>
          <button data-vact="mute" title="Demp" aria-label="Demp" style="${muted ? `color:${AT(C.red)}` : ''}">${M.icon('mdi:volume-off', 26)}</button>
          <button data-vact="up" title="Volum opp" aria-label="Volum opp">${M.icon('mdi:volume-plus', 26)}</button></div>`;
      } else if (o.style === 'trinn') {
        const lit = v == null ? 0 : Math.round((v / 100) * 16);
        const bars = Array.from({ length: 16 }, (_, i) => `<span class="${i < lit ? 'on' : ''}" style="height:${(28 + (i / 15) * 72).toFixed(1)}%"></span>`).join('');
        body = `<div class="mvp mvs ${dis ? 'dis' : ''}">
          <button class="mvb" data-vact="down" title="Volum ned" aria-label="Volum ned">${M.icon('mdi:minus', 22)}</button>
          <div class="mvbars" data-vdrag="bars" role="slider" aria-label="Volum" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${v == null ? '' : v}">${bars}</div>
          <button class="mvnum" data-vact="mute" data-vhold="mute" title="Hold: demp" aria-label="${muted ? 'Volum (dempet) – hold for lyd på' : 'Volum – hold for å dempe'}">${M.icon(ic, 18, icCol)}<span class="num">${num}</span></button>
          <button class="mvb" data-vact="up" title="Volum opp" aria-label="Volum opp">${M.icon('mdi:plus', 22)}</button></div>`;
      } else {
        const inner = (dk) => `<div class="mvc ${dk ? 'dk' : ''}">${M.icon(ic, 22, dk ? '' : icCol)}<span>Volum</span><span class="mvn num">${v == null ? '–' : num + '%'}</span></div>`;
        body = `<div class="mvp mvl ${dis ? 'dis' : ''}" data-vdrag="pill" role="slider" aria-label="Volum" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${v == null ? '' : v}" style="--v:${v == null ? 0 : v}%">
          ${inner(false)}<div class="mvf">${inner(true)}</div></div>`;
      }
      return `<div class="mvr" data-key="mvr:${esc(key)}:${o.style}" data-vkey="${esc(key)}" data-muted="${muted ? 1 : 0}">${body}${tog}</div>`;
    },
    // Male direkte under drag (uten ny tegning)
    _paint(row, v, approx) {
      const p = row.querySelector('.mvl');
      if (p) { p.style.setProperty('--v', v + '%'); p.querySelectorAll('.mvn').forEach((n) => { n.textContent = (approx ? '≈' : '') + v + '%'; }); }
      const bars = row.querySelectorAll('.mvbars span'), lit = Math.round((v / 100) * 16);
      bars.forEach((b, i) => b.classList.toggle('on', i < lit));
      const n = row.querySelector('.mvnum .num');
      if (n) n.textContent = (approx ? '≈' : '') + v;
    },
    bind(root, ctl) {
      if (!root) return;
      root.__mvrCtl = ctl;
      if (root.__mvrB) return;
      root.__mvrB = true;
      const inRow = (e) => e.composedPath().find((n) => n.classList && n.classList.contains('mvr'));
      const find = (e, sel) => e.composedPath().find((n) => n.matches && n.matches(sel));
      let g = null, rep = null, hold = null, held = false;
      const stopRep = () => { if (rep) { clearTimeout(rep.t); clearInterval(rep.i); rep = null; } };
      const fracOf = (el, x) => { const r = el.getBoundingClientRect(); return r.width ? M.clamp((x - r.left) / r.width, 0, 1) : 0; };
      root.addEventListener('pointerdown', (e) => {
        const row = inRow(e);
        if (!row || e.button) return;
        e.stopPropagation(); // Bubble Card skal ikke få gesten
        const key = row.dataset.vkey, c = root.__mvrCtl && root.__mvrCtl(key);
        if (!c) return;
        // 36.9 (fasit volHoldDown/volHoldUp): volumknappen (ikon + tall) – trykk demper ALDRI, hold 500 ms = demp / lyd på
        // (haptic medium + toast 1,4 s); pointerup/-cancel/-leave og bevegelse > 8 px avbryter, klikket etter holdet svelges
        held = false;
        const hb = find(e, '[data-vhold]');
        if (hb) {
          if (hb.closest('.dis')) return;
          const x0 = e.clientX, y0 = e.clientY;
          const done = () => { clearTimeout(hold); root.removeEventListener('pointerup', done); root.removeEventListener('pointercancel', done); root.removeEventListener('pointermove', mv); hb.removeEventListener('pointerleave', done); };
          const mv = (ev) => { if (Math.hypot(ev.clientX - x0, ev.clientY - y0) > 8) done(); };
          root.addEventListener('pointerup', done); root.addEventListener('pointercancel', done); root.addEventListener('pointermove', mv); hb.addEventListener('pointerleave', done);
          clearTimeout(hold);
          hold = setTimeout(() => {
            done();
            held = true;
            M.haptic('medium');
            const was = row.dataset.muted === '1';
            c.mute();
            row.dataset.muted = was ? '0' : '1';
            if (M.toast && c.toasts !== false) M.toast(was ? 'Lyd på' : 'Dempet', { icon: was ? 'mdi:volume-high' : 'mdi:volume-off', duration: 1400 });
          }, 500);
          return;
        }
        const b = find(e, '[data-vact="up"],[data-vact="down"]');
        if (b) {
          if (b.closest('.dis')) return;
          const dir = b.dataset.vact === 'up' ? 1 : -1;
          stopRep(); M.haptic('light'); c.step(dir);
          rep = { t: setTimeout(() => { rep.i = setInterval(() => { M.haptic('light'); c.step(dir); }, 180); }, 400) };
          return;
        }
        const d = find(e, '[data-vdrag]');
        if (!d || d.closest('.dis')) return;
        e.preventDefault();
        try { d.setPointerCapture(e.pointerId); } catch (x) { /* */ }
        g = { id: e.pointerId, el: d, row, key, c, x0: e.clientX, sent: 0, v: null, rel: !!c.stepDrag };
        // 36.9: dra slideren mens dempet → slå av demping (én gang)
        if (row.dataset.muted === '1' && c.mute) { row.dataset.muted = '0'; c.mute(); }
        if (!g.rel) { g.v = Math.round(fracOf(d, e.clientX) * 100); VL[key] = { v: g.v, t: Date.now(), drag: true }; M.volumeRow._paint(row, g.v); c.set(g.v, false); g.sent = Date.now(); M.haptic('selection'); }
      });
      root.addEventListener('pointermove', (e) => {
        if (!g || e.pointerId !== g.id) return;
        e.stopPropagation(); if (e.cancelable) e.preventDefault();
        if (g.rel) {
          const w = g.el.getBoundingClientRect().width || 1, pct = ((e.clientX - g.x0) / w) * 100;
          if (Math.abs(pct) < 4) return;
          const n = Math.trunc(Math.abs(pct) / 4), dir = pct > 0 ? 1 : -1;
          g.x0 += dir * n * (w * 0.04);
          for (let i = 0; i < n; i++) { M.haptic('light'); g.c.step(dir); }
          return;
        }
        const v = Math.round(fracOf(g.el, e.clientX) * 100);
        if (v === g.v) return;
        if (Math.round(v / 5) !== Math.round(g.v / 5)) M.haptic('selection');
        g.v = v; VL[g.key] = { v, t: Date.now(), drag: true };
        M.volumeRow._paint(g.row, v);
        if (Date.now() - g.sent >= 150) { g.sent = Date.now(); g.c.set(v, false); }
      });
      const end = (e) => {
        stopRep();
        if (!g || (e && e.pointerId !== g.id)) return;
        const G = g; g = null;
        try { G.el.releasePointerCapture(e.pointerId); } catch (x) { /* */ }
        if (!G.rel && G.v != null) { VL[G.key] = { v: G.v, t: Date.now(), drag: false }; G.c.set(G.v, true); }
      };
      root.addEventListener('pointerup', end);
      root.addEventListener('pointercancel', end);
      root.addEventListener('pointerleave', stopRep);
      root.addEventListener('contextmenu', (e) => { if (inRow(e)) e.preventDefault(); });
      const tstop = (e) => { if (inRow(e)) e.stopPropagation(); };
      root.addEventListener('touchstart', tstop, { passive: true });
      root.addEventListener('touchmove', (e) => { if (inRow(e)) { e.stopPropagation(); if (g && e.cancelable) e.preventDefault(); } }, { passive: false });
      root.addEventListener('click', (e) => {
        const row = inRow(e);
        if (!row) return;
        const b = find(e, '[data-vact]');
        if (!b) return;
        e.stopPropagation();
        const c = root.__mvrCtl && root.__mvrCtl(row.dataset.vkey), a = b.dataset.vact;
        if (!c) return;
        if (a === 'toggle') return c.toggle();
        if (b.dataset.vhold) { if (held) { held = false; return undefined; } if (!b.closest('.dis')) M.haptic('light'); return undefined; } // 36.9: trykk demper aldri
        if (a === 'mute') { if (b.closest('.dis')) return; M.haptic('light'); return c.mute(); }
        // −/+ via tastatur (klikk uten peker): ett steg
        if ((a === 'up' || a === 'down') && e.detail === 0) { M.haptic('light'); c.step(a === 'up' ? 1 : -1); }
      });
    },
    CSS: `
      .mvr{display:flex;align-items:center;gap:8px;min-width:0}
      .mvp{position:relative;flex:1;min-width:0;height:56px;border-radius:28px;background:var(--ki-surface, var(--gray200,#3a3a3a));box-shadow:inset 0 0 0 1px rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.05*var(--ki-wa-k,1)),var(--ki-wa-max,1)));overflow:hidden;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
      .mvp.dis{opacity:.45}
      .mvl{touch-action:none;cursor:pointer}
      .mvc{position:absolute;inset:0;display:flex;align-items:center;gap:10px;padding:0 20px;font-size:15px;font-weight:500;color:var(--ki-text, var(--white,#fafafa));pointer-events:none}
      .mvc.dk{color:#2a1720}
      .mvn{margin-left:auto;font-variant-numeric:tabular-nums}
      .mvf{position:absolute;inset:0;background:${VOL_PINK};clip-path:inset(0 calc(100% - var(--v, 0%)) 0 0);pointer-events:none}
      .mvs{display:flex;align-items:center;gap:8px;padding:0 6px}
      .mvb{width:44px;height:44px;border-radius:22px;flex:none;display:grid;place-items:center;background:var(--ki-surface-3, var(--gray100,#2f2f2f));color:var(--ki-text, var(--white,#fafafa));transition:transform .12s} /* 18.9: spor = kortfarge (--ki-surface), knapper/inaktive trinn (--ki-surface-3) */
      .mvb:active{transform:scale(.9)}
      .mvbars{flex:1;min-width:0;height:30px;display:flex;align-items:flex-end;gap:3px;touch-action:none;cursor:pointer;padding:0 2px}
      .mvbars span{flex:1;min-width:2px;border-radius:2px;background:var(--ki-surface-3, var(--gray100,#2f2f2f));transition:background .12s}
      .mvbars span.on{background:${C.pink}}
      .mvnum{flex:none;height:44px;min-width:56px;padding:0 4px;display:flex;align-items:center;justify-content:center;gap:3px;touch-action:manipulation;-webkit-touch-callout:none;user-select:none;-webkit-user-select:none;font-size:15px;font-weight:500;color:var(--ki-text, var(--white,#fafafa));font-variant-numeric:tabular-nums}
      .mvk{display:grid;grid-template-columns:repeat(3,minmax(0,1fr))}
      .mvk button{height:100%;display:grid;place-items:center;color:var(--ki-text, var(--white,#fafafa));transition:background .15s}
      .mvk button:active{background:rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.08*var(--ki-wa-k,1)),var(--ki-wa-max,1)))}
      .mvt{width:44px;height:44px;border-radius:22px;flex:none;display:grid;place-items:center;background:var(--ki-surface, var(--gray200,#3a3a3a));box-shadow:inset 0 0 0 1px rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.12*var(--ki-wa-k,1)),var(--ki-wa-max,1)));color:var(--ki-text-2, var(--gray800,#afafaf));transition:transform .12s}
      .mvt:active{transform:scale(.9)}
    `,
  };
  const CARD_H = 256; // Fiks 17.24/19.5: fast høyde for alle kort i karusellen (config.card_height 200–320)
  // Faktisk TV-volum ved knapp-volum: players.<obj>.volume_sensor, ellers sensor.*_volume på samme enhet / sensor.<obj>_volume
  const volSensor = (hass, p) => {
    if (!hass) return null;
    const d = sameDevice(hass, p.id, 'sensor').find((x) => /_volume(_level)?$/.test(x));
    return d || (hass.states['sensor.' + obj(p.id) + '_volume'] ? 'sensor.' + obj(p.id) + '_volume' : null);
  };
  // Estimert TV-volum ved knapp-volum (±2 per kommando), per TV i localStorage (UI-tilstand, ikke config)
  const EST_KEY = 'ki:media:vol_est';
  const estLoad = () => { try { return JSON.parse(localStorage.getItem(EST_KEY) || '{}') || {}; } catch (e) { return {}; } };
  const estSave = (id, v) => { try { const o = estLoad(); o[id] = v; localStorage.setItem(EST_KEY, JSON.stringify(o)); } catch (e) { /* */ } };

  /* ------------------------------------------------------------ delt tilstand per popup */
  const BUS = M.__mediaBus || (M.__mediaBus = {});
  const bus = (k) => BUS[k] || (BUS[k] = { tab: null, sel: {}, cfg: null, subs: new Set() });
  const emit = (k, from) => bus(k).subs.forEach((c) => { if (c !== from) c.update(); });
  const lastCh = (hass, id) => { const s = hass.states[id]; return s ? Date.parse(s.last_changed) || 0 : 0; };
  M.mediaResolve = function (hass, cfg, key) {
    const P = M.mediaPlayers(hass, cfg), b = bus(key), T = tabOrder(cfg), order = T.vis;
    const playing = (p) => hass.states[p.id] && hass.states[p.id].state === 'playing';
    const recent = (L) => L.filter(playing).sort((x, y) => lastCh(hass, y.id) - lastCh(hass, x.id))[0] || null;
    let tab = b.tab && order.includes(b.tab) ? b.tab : null, active = null;
    if (!tab) {
      active = recent(P.all.filter((p) => order.includes(p.kind)));
      if (!active) for (const t of order) if (P[t].length) { active = P[t][0]; break; }
      tab = active ? active.kind : order[0];
    }
    const L = P[tab] || [];
    let i = b.sel[tab] ? L.findIndex((p) => p.id === b.sel[tab]) : -1;
    if (i < 0 && active) i = L.findIndex((p) => p.id === active.id);
    if (i < 0) { const r = recent(L); i = r ? L.indexOf(r) : 0; }
    i = Math.max(0, Math.min(i, L.length - 1));
    return { P, tab, L, i, p: L[i] || null, order, orderAll: T.all };
  };

  // «Nå spilles»-info for en spiller (felles for begge kort).
  function info(card, p) {
    const hass = card.hass, s = card.s(p.id), a = (s && s.attributes) || {};
    const off = !s || ['off', 'standby', 'unavailable', 'unknown'].includes(s.state);
    const run = !!s && s.state === 'playing';
    const tv = p.kind === 'tv';
    // Fiks 21.6: aktiv inngang (attributes.source) vises i TV-infoen – med navnet fra Innganger-listen
    const inO = tv && a.source && a.source !== a.app_name ? listOf(hass, p, 'inputs').find((x) => x.source === a.source) : null;
    const inp = inO ? inO.name || a.source : tv && a.source && a.source !== a.app_name && INPUT_RE.test(a.source) ? a.source : '';
    const app = tv ? (a.app_name || inp || a.source || '') : (a.media_channel || a.source || a.app_name || '');
    const st = appStyle(app);
    let title, artist;
    if (off) { title = s && s.state === 'unavailable' ? 'Utilgjengelig' : 'Av'; artist = p.name; }
    else if (tv) { title = a.media_title || app || (s.state === 'idle' ? 'Hjem' : '–'); artist = [a.media_series_title, a.media_channel, a.media_artist].filter(Boolean).join(' · ') || (a.media_title ? app : '') || p.name; }
    else {
      title = a.media_title ? (a.media_artist ? `${a.media_artist} – ${a.media_title}` : a.media_title) : (a.source || (s.state === 'idle' ? 'Klar' : '–'));
      artist = a.media_channel || a.media_album_name || a.source || p.name;
    }
    // Fiks 51 A: felles M.stationArt (06-station-art.js) – entity_picture, ellers kanallogo (station_logos i dette kortets
    // config går foran den innebygde tabellen). TV: bare bildet (app-ikon/logo som før).
    const art = M.stationArt ? M.stationArt(hass, s, card.eff || card.config || {}, { noLogo: tv }) : null;
    const pic0 = a.entity_picture_local || a.entity_picture || '';
    const pic = art ? art.url : pic0 ? (pic0[0] === '/' && hass.hassUrl ? hass.hassUrl(pic0) : pic0) : '';
    const radio = /radio/i.test(p.id + p.name) || !!a.media_channel || !!(art && art.kind === 'logo');
    const icon = p.pc.icon || a.icon || (tv ? 'tv' : a.device_class === 'receiver' ? 'speaker' : /radio/i.test(p.id + p.name) ? 'radio' : 'speaker');
    return {
      s, a, off, run, tv, app, inp, title, artist, pic, icon, art,
      // logo-aksent (NRK Klassisk lilla, P3 gul …) brukes i stedet for fargen hentet fra bildet
      accent: art && art.kind === 'logo' ? art.accent : null,
      label: [p.name, app, inp && inp !== app ? inp : ''].filter(Boolean).join(' · '),
      col: tv ? st.col : null,
      artIcon: tv ? (st.icon || 'apps') : (appStyle(a.source).icon || (radio ? 'mdi:radio' : 'music_note')),
    };
  }

  // Fiks 51 A: <img> for omslag/kanallogo – via M.stationArtImg (cover / contain på mørk flate + reserve-logo) når
  // URL-en kommer fra stationArt, ellers vanlig bilde (TV-app-ikon)
  const artImg = (I, url) => (url && I.art && I.art.url === url && M.stationArtImg ? M.stationArtImg(I.art, { key: 'img' }) : url ? `<img src="${esc(url)}" alt="" data-key="img">` : '');
  // Aksent fra art: logoens farge, ellers snittfarge fra bildet (artColor)
  const artCol = (I, url, done) => (url && I.art && I.art.url === url && I.art.kind === 'logo' ? I.art.accent || artColor(url, done) : artColor(url, done));

  // Fiks 17.22 → 47 G: «Tilpass media» viser én fane om gangen (Faner | TV | Musikk, ikonfaner der aktiv viser navnet –
  // Media v4 cfgTabs). Valgt fane er UI-tilstand for editoren (ikke config) og huskes mens siden er åpen (designets cfgTab).
  let ED_TAB = 'faner';
  const ED_TABS = [['faner', 'Faner', 'tab'], ['tv', 'TV', 'tv'], ['musikk', 'Musikk', 'music_note']];
  const sheetTabs = () => ({
    type: 'html',
    click: (d, ed) => { if (d.t && d.t !== ED_TAB && ED_TABS.some((t) => t[0] === d.t)) { ED_TAB = d.t; M.haptic('light'); ed._render(); } },
    html: (h, c, key) => `<style>.chips.sg.tabs.mmt{padding:4px;border-radius:24px;box-shadow:inset 0 0 0 1px ${WA(0.05)}}
      :host([inline]) .wrap>.chips.sg.tabs.mmt{box-shadow:inset 0 0 0 1px ${WA(0.05)},0 0 0 8px var(--ki-sheet-bg,#282828)}
      .chips.sg.tabs.mmt>.itab{font-size:14px;font-weight:500;transition:color .25s,background .2s}</style>
      <div class="chips sg tabs itabs mmt" role="tablist" data-key="mmt">${ED_TABS.map(([k, l, i]) => M.iconTabs.btn({ label: l, icon: i }, k === ED_TAB, `data-a="fn" data-k="${key}" data-t="${k}" data-key="mmt-${k}"`, `chip${k === ED_TAB ? ' on' : ''}`)).join('')}</div>`,
  });
  const tabOf = (p) => (p.kind === 'skjul' ? p.auto : p.kind);
  // Fane-segment + rekkefølge-kort for valgt fane → config.order.<fane> = [id …], config.hidden = { id: true }
  const orderField = () => ({
    type: 'html',
    html: (h, c, key) => {
      const P = h ? M.mediaPlayers(h, c, true) : { tv: [], musikk: [] }, L = P[ED_TAB] || [];
      const hid = c.hidden && typeof c.hidden === 'object' ? c.hidden : {}, ids = L.map((p) => p.id), vis = L.filter((p) => !hid[p.id]).length;
      const row = (p, i) => {
        const off = !!hid[p.id], last = !off && vis <= 1, nh = { ...hid };
        if (off) delete nh[p.id]; else nh[p.id] = true;
        const num = `<span style="width:24px;height:24px;border-radius:12px;flex:none;display:grid;place-items:center;font-size:12px;font-weight:600;${i === 0 ? `background:${PINK};color:#2a1720` : 'background:var(--ki-surface-2, #404040);color:#c7c7c7'}">${i + 1}</span>`;
        const ic = p.pc.icon || (p.kind === 'tv' ? 'mdi:television' : 'mdi:speaker');
        return `<div class="ent ${off ? 'off' : ''}" data-key="mo-${esc(p.id)}">${num}${M.icon(ic, 20, 'color:var(--ki-text-2, #afafaf)')}<span class="nm"><b>${esc(p.name)}</b><i>${i === 0 ? 'Vises først · ' : ''}${esc(p.id)}</i></span>
          <button class="ib" data-a="mv" data-name="order.${ED_TAB}" data-ord="${esc(ids.join(','))}" data-i="${i}" data-d="-1" title="Flytt opp" ${i ? '' : 'disabled style="opacity:.3"'}>${M.icon('mdi:chevron-up', 20)}</button>
          <button class="ib" data-a="mv" data-name="order.${ED_TAB}" data-ord="${esc(ids.join(','))}" data-i="${i}" data-d="1" title="Flytt ned" ${i < L.length - 1 ? '' : 'disabled style="opacity:.3"'}>${M.icon('mdi:chevron-down', 20)}</button>
          <button class="ib" data-a="sel" data-name="hidden" data-json="1" data-v="${esc(JSON.stringify(Object.keys(nh).length ? nh : null))}" title="${off ? 'Vis' : last ? 'Minst én spiller må vises' : 'Skjul'}" ${last ? 'disabled style="opacity:.3"' : ''}>${M.icon(off ? 'mdi:eye-off' : 'mdi:eye', 18)}</button></div>`;
      };
      const tl = ED_TAB === 'tv' ? 'TV-er' : 'musikkspillere';
      return `<div class="sec" data-key="mord-${ED_TAB}" style="display:flex;flex-direction:column;gap:6px;padding:12px"><div class="line" style="padding:2px 4px 4px">${M.icon('mdi:sort', 20)}<span style="flex:1;font-size:14px;font-weight:500">Rekkefølge</span><span class="small">${L.length} ${tl}</span></div>
          ${L.length ? L.map(row).join('') : `<div class="small" style="padding:4px">Ingen ${tl} funnet</div>`}
          <div class="small" style="padding:2px 4px">Nr. 1 vises når fanen åpnes. Øye = vis/skjul i karusellen, piler = rekkefølge.</div></div>
        <datalist id="mm-ic" data-key="mm-ic" data-nomorph></datalist>`;
    },
  });

  /* Fiks 21.6 · editor-blokk per spiller (Media v4 · Oppsett cfgSrc/cfgMus): lister med navn/ikon/farge/kilde/app-ID,
   * rekkefølge, slett, «Legg til …», «Tilbakestill» (= autokonfig) + chip-felt fra HA (✓ = med, + = ikke med).
   * Samme felt i kortets egen editor og GUI-editoren (schema) → lagres i players.<obj>.apps | inputs | presets. */
  const APPCOL = ['#e5a00d', '#00b9f2', '#990ae3', '#2b6ef2', '#ff0000', '#e50914', '#1db954', '#fafafa', '#404040']; // ki-hex-ok: lagrede appfarger (config) / fargepalett
  const PTYPES = [['favorite', 'Favoritt'], ['script', 'Script'], ['button', 'Button'], ['source', 'Input']];
  let ED_ROW = null; // åpen rad i editoren (UI-tilstand): '<obj>:<kind>:<i>'
  const edPlayer = (ed, obj) => (ed._hass ? M.mediaPlayers(ed._hass, ed._config || {}, true).all.find((x) => x.obj === obj) : null);
  const edPut = (ed, p, kind, list) => ed._set(`players.${p.obj}.${kind}`, list);
  const isAmp = (h, p) => { const a = ((h.states[p.id] || {}).attributes) || {}; return srcList(h, p.id).length > 0 && (a.device_class === 'receiver' || !(Number(a.supported_features) & 131072)); };
  const srcField = (p) => ({
    type: 'html',
    click: (d, ed) => {
      const P = edPlayer(ed, d.po), h = ed._hass;
      if (!P) return;
      const kind = d.kind, L = listOf(h, P, kind).map((x) => ({ ...x })), i = Number(d.i);
      M.haptic(d.op === 'chip' || d.op === 'type' || d.op === 'col' ? 'selection' : 'light');
      switch (d.op) {
        case 'open': ED_ROW = ED_ROW === `${P.obj}:${kind}:${i}` ? null : `${P.obj}:${kind}:${i}`; return ed._render();
        case 'up': case 'down': { const j = i + (d.op === 'up' ? -1 : 1); if (j < 0 || j >= L.length) return; [L[i], L[j]] = [L[j], L[i]]; ED_ROW = null; return edPut(ed, P, kind, L); }
        case 'del': L.splice(i, 1); ED_ROW = null; return edPut(ed, P, kind, L);
        case 'reset': ED_ROW = null; if (kind === 'presets' && P.pc.shortcuts) ed._set(`players.${P.obj}.shortcuts`, undefined); return ed._set(`players.${P.obj}.${kind}`, undefined);
        case 'add': {
          const n = { apps: { name: 'Ny app', icon: 'apps', color: '#404040', source: '', app_id: '' }, inputs: { name: 'Ny inngang', source: '', icon: 'mdi:video-input-hdmi' } }[kind] // ki-hex-ok: lagrede appfarger (config) / fargepalett
            || (d.ty === 'favorite' ? { name: 'Ny stasjon', icon: 'radio', type: 'favorite', target: '' } : d.ty === 'source' ? { name: 'Ny input', icon: 'mdi:import', type: 'source', target: '' } : { name: 'Ny snarvei', icon: 'mdi:gesture-tap-button', type: 'script', target: '' });
          L.push(n); ED_ROW = `${P.obj}:${kind}:${L.length - 1}`; return edPut(ed, P, kind, L);
        }
        case 'type': if (!L[i]) return; L[i].type = d.ty; if (d.ty !== 'favorite') delete L[i].content_type; return edPut(ed, P, kind, L);
        case 'col': if (!L[i]) return; L[i].color = d.c; return edPut(ed, P, kind, L);
        case 'fav': { // velg favoritt fra Media-nettleseren for en rad
          if (!L[i]) return; const nameDef = !L[i].name || /^Ny /.test(L[i].name);
          Object.assign(L[i], { type: 'favorite', target: d.v, content_type: d.ct || 'music' }); if (nameDef) L[i].name = d.n;
          return edPut(ed, P, kind, L);
        }
        case 'chip': { // chip-felt: legg til / fjern
          const t = d.ty, v = d.v, key = (x) => (kind === 'presets' ? x.type === t && x.target === v : x.source === v);
          const k = L.findIndex(key);
          if (k >= 0) { L.splice(k, 1); ED_ROW = null; return edPut(ed, P, kind, L); }
          if (kind === 'apps') L.push(appFrom(v));
          else if (kind === 'inputs') L.push(inputFrom(v));
          else if (t === 'favorite') L.push({ name: d.n || v, icon: 'radio', type: 'favorite', target: v, content_type: d.ct || 'music' });
          else L.push({ name: v, icon: appStyle(v).icon || 'mdi:import', type: 'source', target: v });
          return edPut(ed, P, kind, L);
        }
        default:
      }
    },
    html: (h, c, key, ed) => {
      if (!h) return '';
      const P = M.mediaPlayers(h, c, true).all.find((x) => x.obj === p.obj) || p, tv = P.kind === 'tv';
      // Tekstfelt (navn/kilde/app-ID/ikon/mål): egen change-lytter (editoren håndterer bare data-name)
      if (ed && ed.shadowRoot && !ed.__mm21) {
        ed.__mm21 = true;
        ed.shadowRoot.addEventListener('change', (e) => {
          const t = e.target, dd = t && t.dataset;
          if (!dd || !dd.mm) return;
          e.stopPropagation();
          const Q = edPlayer(ed, dd.po);
          if (!Q) return;
          const L = listOf(ed._hass, Q, dd.mm).map((x) => ({ ...x })), i = Number(dd.i);
          if (!L[i]) return;
          const v = String(t.value || '').trim();
          if (v) L[i][dd.f] = v; else delete L[i][dd.f];
          edPut(ed, Q, dd.mm, L);
        });
        // 31.1: ikonforslag lastes først når et ikonfelt får fokus (og ved skriving), høyst 40 treff i én felles datalist.
        // Lytterne legges til én gang per editor (ikke per tegning).
        const sug = (t) => {
          const dl = ed.shadowRoot.getElementById('mm-ic');
          if (!dl || !M.iconPicker || !M.iconPicker.search) return;
          const q = String(t.value || '').trim(), my = (ed.__icQ = q);
          clearTimeout(ed.__icT);
          ed.__icT = setTimeout(() => M.iconPicker.search(q.replace(/^mdi:/, ''), null).then((L) => {
            if (ed.__icQ !== my) return;
            dl.innerHTML = (L || []).slice(0, 40).map((x) => `<option value="${esc(x)}"></option>`).join('');
          }).catch(() => { /* ingen forslag */ }), q ? 120 : 0);
        };
        const isIc = (t) => t && t.dataset && t.dataset.mm && t.dataset.f === 'icon';
        ed.shadowRoot.addEventListener('focusin', (e) => { if (isIc(e.target)) sug(e.target); });
        ed.shadowRoot.addEventListener('input', (e) => { if (isIc(e.target)) sug(e.target); });
      }
      const btn = (op, kind, i, extra, inner, title, cls) => `<button class="${cls || 'ib'}" data-a="fn" data-k="${key}" data-po="${esc(P.obj)}" data-kind="${kind}" data-op="${op}" data-i="${i}" ${extra || ''} ${title ? `title="${esc(title)}" aria-label="${esc(title)}"` : ''}>${inner}</button>`;
      const inp = (kind, i, f, v, ph, st) => `<input class="inp" data-mm="${kind}" data-po="${esc(P.obj)}" data-i="${i}" data-f="${f}" value="${esc(v || '')}" placeholder="${esc(ph)}" ${f === 'icon' ? 'list="mm-ic" autocomplete="off"' : ''} autocapitalize="off" autocorrect="off" spellcheck="false" style="height:34px;font-size:13px;min-width:0;background:var(--ki-popup, #282828);${st || ''}">`;
      const lab = (t, x) => `<label style="display:flex;flex-direction:column;gap:3px;min-width:0"><span class="hl" style="font-size:11px;color:var(--ki-text-mid, #979797)">${esc(t)}</span>${x}</label>`;
      // Stabil tilbakekalling per editor + samlet tegning (rAF): ett svar → høyst én ny tegning (31.1)
      if (ed && !ed.__favCb) ed.__favCb = () => { if (ed.__favRaf) return; ed.__favRaf = requestAnimationFrame(() => { ed.__favRaf = 0; if (ed.isConnected && ed._render) ed._render(); }); };
      const favs = !tv ? favorites(h, P.id, ed && ed.__favCb) : null;
      const row = (kind, x, i, n) => {
        const open = ED_ROW === `${P.obj}:${kind}:${i}`;
        const ic = x.icon || (kind === 'apps' ? 'apps' : kind === 'inputs' ? 'mdi:video-input-hdmi' : x.type === 'source' ? 'mdi:import' : 'radio');
        const col = kind === 'apps' && x.color ? x.color : '#404040'; // ki-hex-ok: lagrede appfarger (config) / fargepalett
        // Lagrede farger (players.<obj>.apps[].color) er hex i config; standardgrå og hvit vises via tokens (Del A)
        const colV = col === '#404040' ? 'var(--ki-surface-2, #404040)' : col === '#fafafa' ? 'var(--ki-pill-bg, #fafafa)' : col; // ki-hex-ok: lagrede appfarger (config) / fargepalett
        const chip = btn('open', kind, i, `style="width:36px;height:36px;border-radius:12px;background:${esc(colV)};color:${colV.startsWith('var(--ki-pill') ? 'var(--ki-pill-fg, #282828)' : colV.startsWith('var(--ki-surface') ? 'var(--ki-text, #fff)' : '#fff'};${open ? 'box-shadow:0 0 0 2px var(--ki-text, #fafafa)' : ''}"`, M.icon(ic, 18), open ? 'Lukk' : 'Rediger', 'ib');
        const nm = kind === 'presets' && !x.name && x.target && x.type !== 'source' && x.type !== 'favorite' ? M.name(h, x.target, P.name) : x.name;
        const head = `<div class="line">${chip}${inp(kind, i, 'name', nm, 'Navn', 'flex:1;font-weight:500')}
          ${btn('up', kind, i, i ? '' : 'disabled style="opacity:.3"', M.icon('mdi:chevron-up', 20), 'Flytt opp')}
          ${btn('down', kind, i, i < n - 1 ? '' : 'disabled style="opacity:.3"', M.icon('mdi:chevron-down', 20), 'Flytt ned')}
          ${btn('del', kind, i, 'style="background:rgb(242 128 115 / 0.2);color:var(--ki-red-text, rgb(242 128 115))"', M.icon('mdi:delete-outline', 18), 'Fjern')}</div>`;
        let body = '';
        if (kind === 'presets') {
          const ty = x.type || 'script';
          // 35.8 · 1:1 med Media v4 cfgMus: [type-segment | mål] på én linje, ikonfeltet alltid synlig under
          const seg = `<div class="chips sg tsub" data-glass-drag="x" style="flex:none;flex-wrap:nowrap">${PTYPES.map(([v, l]) => btn('type', kind, i, `data-ty="${v}"`, esc(l), '', 'chip' + (v === ty ? ' on' : ''))).join('')}</div>`;
          const ph = ty === 'source' ? 'Navn på input, f.eks. Spotify' : ty === 'favorite' ? 'media_content_id fra Media-nettleseren' : `${ty}.…`;
          const svc = ty === 'source' ? `media_player.select_source → ${P.id}` : ty === 'favorite' ? `media_player.play_media → ${P.id}` : x.target ? `${svcFor(x.target).join('.')} → ${x.target}` : 'script.turn_on / button.press';
          body = `<div class="line pr-tg" style="gap:6px;flex-wrap:wrap">${seg}${inp(kind, i, 'target', x.target, ph, 'flex:1 1 140px')}</div><span class="hl" style="font-size:11px;color:var(--ki-text-mid, #979797)">${esc(svc)}</span>`;
          if (ty === 'favorite' && open && favs && favs.length) body += `<div class="chips">${favs.map((f) => btn('fav', kind, i, `data-v="${esc(f.id)}" data-ct="${esc(f.type)}" data-n="${esc(f.title)}"`, esc(f.title), '', 'chip' + (f.id === x.target ? ' on' : ''))).join('')}</div>`;
          body += inp(kind, i, 'icon', x.icon, 'Ikon (mdi:radio)', 'height:30px;font-size:12px;color:var(--ki-text-2, #afafaf)');
        } else if (open) {
          const F = kind === 'apps' ? [['Kilde', 'source', 'Navn på kilde i HA'], ['App-ID', 'app_id', 'no.nrk.nrktvapp'], ['Ikon', 'icon', 'mdi:netflix']] : [['Kilde i HA', 'source', 'f.eks. HDMI 1'], ['Ikon', 'icon', 'mdi:video-input-hdmi']];
          body = `<div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:6px">${F.map(([l, f, ph]) => lab(l, inp(kind, i, f, x[f], ph))).join('')}</div>`;
          if (kind === 'apps') body += `<div class="chips">${APPCOL.map((cc) => btn('col', kind, i, `data-c="${cc}" style="width:26px;height:26px;border-radius:13px;background:${cc};${x.color === cc ? 'box-shadow:0 0 0 2px var(--ki-surface, #3a3a3a),0 0 0 4px var(--ki-text, #fafafa)' : 'box-shadow:inset 0 0 0 1px rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.2*var(--ki-wa-k,1)),var(--ki-wa-max,1)))'}"`, '', 'Farge ' + cc, 'ib')).join('')}</div>`;
        } else if (x.source) body = `<span class="hl" style="font-size:11px;color:var(--ki-text-mid, #979797)">${esc('select_source · ' + x.source)}</span>`;
        return `<div class="f" data-key="r21-${esc(P.obj)}-${kind}-${i}" style="background:var(--ki-surface-3, #2f2f2f);gap:8px;padding:8px">${head}${body}</div>`;
      };
      const chipsF = (kind, t, label, items, sel) => `<div style="display:flex;flex-direction:column;gap:6px;padding-top:4px"><span class="hl" style="font-size:11px;color:var(--ki-text-mid, #979797)">${esc(label)}</span>
        ${items === null ? '<span class="small">Henter fra Home Assistant …</span>' : items.length ? `<div class="chips">${items.map((it) => { const on = sel(it); return btn('chip', kind, -1, `data-ty="${t}" data-v="${esc(it.v)}" data-n="${esc(it.n || it.v)}" ${it.ct ? `data-ct="${esc(it.ct)}"` : ''} aria-pressed="${on}"`, `${M.icon(on ? 'mdi:check' : 'mdi:plus', 16)}${esc(it.n || it.v)}`, '', 'chip' + (on ? ' on' : '')); }).join('')}</div>` : '<span class="small">Fant ingen i Home Assistant</span>'}</div>`;
      const block = (kind, title, count, addBtns, chipsHtml) => {
        const L = listOf(h, P, kind), auto = !Array.isArray(P.pc[kind]);
        return `<div class="sec" data-key="b21-${esc(P.obj)}-${kind}" style="display:flex;flex-direction:column;gap:8px;padding:12px;background:var(--ki-surface-2, #404040)">
          <div class="line"><span style="flex:1;font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--ki-text-2, #afafaf)">${esc(title)}</span><span class="small">${L.length}${auto ? ' · auto' : ''}</span></div>
          ${L.map((x, i) => row(kind, x, i, L.length)).join('') || `<span class="small">Ingen ${esc(count)}</span>`}
          <div class="line" style="flex-wrap:wrap">${addBtns}${btn('reset', kind, -1, 'style="height:44px;padding:0 14px;border-radius:22px;font-size:13px;color:var(--ki-text-2, #afafaf);background:var(--ki-surface-3, #2f2f2f);flex:none"', 'Tilbakestill', 'Tilbake til autokonfig', 'chip')}</div>
          ${chipsHtml}</div>`;
      };
      const addB = (kind, label, t) => btn('add', kind, -1, `${t ? `data-ty="${t}"` : ''} style="flex:1 1 auto;height:44px;border-radius:22px;background:transparent;box-shadow:inset 0 0 0 1.5px rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.18*var(--ki-wa-k,1)),var(--ki-wa-max,1)));justify-content:center;font-size:13px"`, `${M.icon('mdi:plus', 18)}${esc(label)}`, '', 'chip');
      const S = srcList(h, P.id);
      if (tv) {
        const A = listOf(h, P, 'apps'), I = listOf(h, P, 'inputs');
        const appItems = S.filter((n) => !INPUT_RE.test(n)).map((v) => ({ v })), inItems = [...S.filter((n) => INPUT_RE.test(n)), ...S.filter((n) => !INPUT_RE.test(n))].map((v) => ({ v }));
        return block('apps', 'Apper', 'apper', addB('apps', 'Legg til app'), chipsF('apps', 'app', 'Apper fra Home Assistant', appItems, (it) => A.some((x) => x.source === it.v)))
          + block('inputs', 'Innganger', 'innganger', addB('inputs', 'Legg til inngang'), chipsF('inputs', 'in', 'Innganger fra Home Assistant (source_list)', inItems, (it) => I.some((x) => x.source === it.v)));
      }
      const R = listOf(h, P, 'presets'), amp = isAmp(h, P);
      const favC = !amp || favs === null || (favs && favs.length) ? chipsF('presets', 'favorite', 'Stasjoner fra Home Assistant (Favoritter)', favs === undefined ? [] : favs && favs.map((f) => ({ v: f.id, n: f.title, ct: f.type })), (it) => R.some((x) => x.type === 'favorite' && x.target === it.v)) : '';
      const srcC = S.length ? chipsF('presets', 'source', amp ? 'Forsterker-innganger fra Home Assistant (source_list)' : 'Kilder fra Home Assistant (source_list)', S.map((v) => ({ v })), (it) => R.some((x) => x.type === 'source' && x.target === it.v)) : '';
      return block('presets', amp ? 'Forsterker-innganger og snarveier' : 'Radiostasjoner og snarveier', 'snarveier',
        (amp ? addB('presets', 'Forsterker-input', 'source') : addB('presets', 'Radiostasjon', 'favorite')) + addB('presets', 'Snarvei', 'script'),
        amp ? srcC + favC : favC + srcC);
    },
  });

  /* Fiks 51 A · «Kanallogoer» (Musikk-fanen i «Tilpass media» og GUI-editoren, samme skjema): egne treff for radiospillere
   * uten bilde → config.station_logos { '<kanalnavn>': '/local/…png' }. Går foran den innebygde tabellen (06-station-art.js);
   * mini-spilleren og Rom leser samme tabell (M.mediaCardCfg). Rader: navn + sti, «Legg til», fjern. */
  const slList = (c) => { const o = (c && c.station_logos) || {}; return Array.isArray(o) ? o.map((x) => [x.name || '', x.url || x.path || '']) : Object.keys(o).map((k) => [k, typeof o[k] === 'string' ? o[k] : (o[k] && (o[k].url || o[k].path)) || '']); };
  const slPut = (ed, L) => { const o = {}; L.forEach(([k, v]) => { if (k != null && String(k).trim() !== '' && !(k in o)) o[String(k).trim()] = v || ''; }); ed._set('station_logos', Object.keys(o).length ? o : undefined); };
  const slField = () => ({
    type: 'html',
    click: (d, ed) => {
      const L = slList(ed._config);
      if (d.op === 'sladd') {
        let n = 'Ny kanal', k = 2; const has = (x) => L.some((r) => r[0] === x);
        while (has(n)) n = 'Ny kanal ' + k++;
        L.push([n, '/local/ki/radio-logos/']); M.haptic('light'); return slPut(ed, L);
      }
      if (d.op === 'sldel') { L.splice(Number(d.i), 1); M.haptic('light'); return slPut(ed, L); }
      return undefined;
    },
    html: (h, c, key, ed) => {
      if (ed && ed.shadowRoot && !ed.__msl) {
        ed.__msl = true;
        ed.shadowRoot.addEventListener('change', (e) => {
          const t = e.target, dd = t && t.dataset;
          if (!dd || dd.sl == null) return;
          e.stopPropagation();
          const L = slList(ed._config), i = Number(dd.i);
          if (!L[i]) return;
          const v = String(t.value || '').trim();
          if (dd.sl === 'name') { if (!v || L.some((r, j) => j !== i && r[0] === v)) { t.value = L[i][0]; return; } L[i][0] = v; } else L[i][1] = v;
          slPut(ed, L);
        });
      }
      const L = slList(c);
      const inp = (i, f, v, ph, st) => `<input class="inp" data-sl="${f}" data-i="${i}" value="${esc(v || '')}" placeholder="${esc(ph)}" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="${f === 'name' ? 'Kanalnavn' : 'Sti til logo'}" style="height:34px;font-size:13px;min-width:0;background:var(--ki-popup, #282828);${st || ''}">`;
      const rows = L.map(([n, u], i) => `<div class="line" data-key="sl-${i}" style="gap:6px">${inp(i, 'name', n, 'Kanalnavn, f.eks. NRK P1', 'flex:1 1 40%')}${inp(i, 'url', u, '/local/ki/radio-logos/…png', 'flex:1 1 60%')}
          <button class="ib" data-a="fn" data-k="${key}" data-op="sldel" data-i="${i}" title="Fjern" aria-label="Fjern" style="background:rgb(242 128 115 / 0.2);color:var(--ki-red-text, rgb(242 128 115))">${M.icon('mdi:delete-outline', 18)}</button></div>`).join('');
      return `<div class="sec" data-key="msl" style="display:flex;flex-direction:column;gap:8px;padding:12px">
          <div class="line" style="padding:2px 4px 4px">${M.icon('mdi:radio', 20)}<span style="flex:1;font-size:14px;font-weight:500">Kanallogoer</span><span class="small">${L.length || 'Innebygd'}</span></div>
          ${rows || '<div class="small" style="padding:2px 4px">Ingen egne treff – innebygd tabell (NRK P1/P1+/P2/P3/mP3/Klassisk/Jazz, P4, Radio Vinyl) brukes</div>'}
          <button class="chip" data-a="fn" data-k="${key}" data-op="sladd" data-key="sladd" style="height:44px;border-radius:22px;background:transparent;box-shadow:inset 0 0 0 1.5px rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.18*var(--ki-wa-k,1)),var(--ki-wa-max,1)));justify-content:center;font-size:13px">${M.icon('mdi:plus', 18)}Legg til kanallogo</button>
          <div class="small" style="padding:2px 4px">Vises når en radio ikke sender bilde. Kanalnavnet sammenlignes med media_channel, media_title, media_artist, source og app_name (eksakt eller starten av navnet, store/små bokstaver, mellomrom, punktum og bindestrek likegyldig, «+» = «pluss»). Egne treff går foran den innebygde tabellen og gjelder også mini-spilleren og Rom.</div></div>`;
    },
  });

  /* 31.1 · «Mediaspiller» per kilde (Media v4 cfgSrc/cfgMus · mpOpts): native <select> over en rad (cast · entity_id · ▾).
   * Listen over media_player.* beregnes ÉN gang per editor (ed.__mpOpts) – ikke per spiller og tegning.
   * Lagres som players.<obj>.entity (tom = kildens egen spiller); editoren lagrer via data-name. */
  const mpOptsOf = (ed, h) => {
    if (ed && ed.__mpOpts && ed.__mpOptsH === (h && h.states ? Object.keys(h.states).length : 0)) return ed.__mpOpts;
    const L = M.all(h, 'media_player').map((id) => [id, M.name(h, id)]).sort((a, b) => M.cmpNb(a[1], b[1]));
    if (ed) { ed.__mpOpts = L; ed.__mpOptsH = Object.keys(h.states).length; }
    return L;
  };
  const mpField = (p) => ({
    type: 'html',
    html: (h, c, key, ed) => {
      if (!h) return '';
      const name = `players.${p.obj}.entity`, cur = ((((c || {}).players || {})[p.obj]) || {}).entity || '';
      const own = p.slot || p.id, shown = cur || own;
      const opts = mpOptsOf(ed, h);
      const o = [`<option value="" ${cur ? '' : 'selected'}>Standard · ${esc(M.name(h, own))} · ${esc(own)}</option>`,
        ...(cur && !opts.some((x) => x[0] === cur) ? [[cur, cur]] : []).concat(opts.filter((x) => x[0] !== own)).map(([id, n]) => `<option value="${esc(id)}" ${id === cur ? 'selected' : ''}>${esc(n)} · ${esc(id)}</option>`)].join('');
      return `<div class="f" data-key="mp-${esc(p.obj)}" style="gap:6px"><span class="hl" style="font-size:12px;color:var(--ki-text-mid, #979797)">Mediaspiller</span>
        <div style="position:relative;display:flex;align-items:center;gap:8px;height:44px;padding:0 12px;border-radius:14px;background:var(--ki-surface-3, #2f2f2f)">${M.icon('mdi:cast', 18, 'color:var(--ki-text-2, #afafaf)')}
          <span style="flex:1;min-width:0;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(shown)}</span>${M.icon('mdi:chevron-down', 20, 'color:var(--ki-text-mid, #979797)')}
          <select data-name="${esc(name)}" aria-label="Mediaspiller for ${esc(p.name)}" style="position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer;font-size:16px">${o}</select></div></div>`;
    },
  });
  // Seksjon per spiller tegnes bare når den er åpen (lazy) – lister, source_list, favoritter og velgere for lukkede
  // spillere bygges ikke. Feil i én spiller gir «Kunne ikke laste denne delen» i stedet for et halvt tegnet ark.
  const failSec = (p, e) => { try { console.error('[msh-media] editor', p && p.id, e); } catch (x) { /* */ } return { type: 'section', id: 'p_' + (p && p.obj), lazy: true, icon: 'mdi:alert-circle-outline', label: ((p && p.name) || '–') + ' · Kunne ikke laste denne delen', fields: [{ type: 'info', label: 'Kunne ikke laste denne delen' }] }; };
  // 47 G: [ikonfaner] + Faner (forhåndsvisning, Fanestil/Faner viser/Startfane, rekkefølge/høyde) | TV/Musikk («Rekkefølge»
  // øverst, så spillerne og de felles valgene som før). GUI-editoren (getConfigElement) bruker samme skjema + Nullstill nederst.
  const baseSchema = (h, c) => {
    c = c || {};
    if (!ED_TABS.some((t) => t[0] === ED_TAB)) ED_TAB = 'faner';
    if (ED_TAB === 'faner') return [sheetTabs(), ...fanerSchema(), guiReset()];
    let P = [];
    try { P = h ? M.mediaPlayers(h, c, true).all : []; } catch (e) { console.error('[msh-media] spillere', e); }
    const tab = ED_TAB;
    return [
      sheetTabs(),
      orderField(),
      ...P.filter((p) => tabOf(p) === tab).map((p) => { try { return playerSec(h, c, p); } catch (e) { return failSec(p, e); } }),
      ...(tab === 'musikk' ? [slField()] : []),
      ...commonSchema(),
      guiReset(),
    ];
  };
  // Nullstill gjelder aktiv fane (Media v4 cfgReset): Faner → standard fanedesign (tabs + startfane), TV/Musikk → rekkefølge
  // og skjulte spillere for den fanen. Arket: «Nullstill» i headeren (editorHead, haptic medium der); GUI: knapp nederst.
  function resetTab(hh, cc, ed) {
    cc = cc || {};
    const n = { ...cc };
    if (ED_TAB === 'faner') { delete n.tabs; delete n.start_tab; delete n.default_tab; }
    else {
      let L = [];
      try { L = hh ? (M.mediaPlayers(hh, cc, true)[ED_TAB] || []) : []; } catch (e) { L = []; }
      if (n.order && typeof n.order === 'object') { const o = { ...n.order }; delete o[ED_TAB]; if (Object.keys(o).length) n.order = o; else delete n.order; }
      if (n.hidden && typeof n.hidden === 'object') { const H = { ...n.hidden }; L.forEach((p) => delete H[p.id]); if (Object.keys(H).length) n.hidden = H; else delete n.hidden; }
    }
    ed._config = n;
    ed._set('card_id', n.card_id || M.uid());
  }
  const guiReset = () => ({ type: 'html', click: (d, ed) => { M.haptic('medium'); resetTab(ed._hass, ed._config, ed); },
    html: (h, c, key, ed) => (ed && ed._inline ? '' : `<button class="btn" data-a="fn" data-k="${key}" data-key="mreset" style="height:48px;border-radius:24px;background:var(--ki-surface, #3a3a3a);display:flex;align-items:center;justify-content:center;gap:8px;font-size:14px;font-weight:500">${M.icon('mdi:restore', 20)}Nullstill ${esc((ED_TABS.find((t) => t[0] === ED_TAB) || ['', ''])[1])}</button>`) });
  const playerSec = (h, c, p) => {
    {
        const b = `players.${p.obj}`, tv = p.kind === 'tv';
        const fields = [
          { type: 'select', name: b + '.type', label: 'Type', options: [['auto', 'Auto'], ['tv', 'TV'], ['musikk', 'Musikk'], ['skjul', 'Skjul']], default: 'auto', help: 'Auto: ' + (p.auto === 'tv' ? 'TV' : 'Musikk') },
          { type: 'text', name: b + '.name', label: 'Navn', auto: (hh) => M.name(hh, p.id) },
          { type: 'icon', name: b + '.icon', label: 'Ikon', placeholder: tv ? 'mdi:television' : 'mdi:speaker' },
        ];
        if (tv) {
          const pl = autoPlat(h, p), rem = remoteOf(h, { ...p, pc: {} });
          fields.push(
            { type: 'select', name: b + '.platform', label: 'Plattform', options: [['apple', 'Apple TV'], ['google', 'Google TV']], default: pl },
            // Fiks 19.4: forhåndsvalg for fjernkontrollen per TV (Kompakt = styrekors + 2×2 knapper, Sirkel = stort styrekors + fem runde knapper + volumlinje)
            { type: 'select', name: b + '.remote_style', label: 'Fjernkontroll', options: [['kompakt', 'Kompakt'], ['sirkel', 'Sirkel']], default: 'kompakt' },
            { type: 'entity', name: b + '.remote', label: 'Fjernkontroll (remote)', domain: 'remote', auto: () => rem, help: `${REMOTE[platOf(h, p)].hw} · ${rem || 'ingen remote funnet'}` },
            ...HOLD_KEYS.map((k) => {
              const hp = holdPlan(h, c, p, k), apps = ((h.states[p.id] || {}).attributes || {}).source_list;
              return { type: 'action', name: `${b}.${k}_hold_action`, label: 'Hold ' + KEYL[k], apps: Array.isArray(apps) ? apps : [],
                std: k === 'home' ? `Standard · ${REMOTE[platOf(h, p)].holdLabel}` : undefined,
                cmdPlaceholder: platOf(h, p) === 'apple' ? 'f.eks. top_menu, skip_forward' : 'f.eks. KEYCODE_SETTINGS, MENU',
                help: hp ? `Hold ${KEYL[k].toLowerCase()} (≥ ${HOLD_MS} ms): ${hp.label}` : `Hold ${KEYL[k].toLowerCase()}: ingen handling – vanlig trykk` };
            }),
            { type: 'select', name: b + '.volume', label: 'Volum styres av', options: [['media', 'Mediaspiller'], ['buttons', 'Knapper']], default: 'media' },
            { type: 'entity', name: b + '.volume_up', label: 'Volum opp', domains: ['button', 'script', 'switch', 'input_button'], help: 'Tom = media_player.volume_up' },
            { type: 'entity', name: b + '.volume_down', label: 'Volum ned', domains: ['button', 'script', 'switch', 'input_button'], help: 'Tom = media_player.volume_down' },
            { type: 'entity', name: b + '.volume_mute', label: 'Demp', domains: ['button', 'script', 'switch', 'input_button'], help: 'Tom = media_player.volume_mute' },
            srcField(p),
            { type: 'text', name: b + '.hide_sources', label: 'Skjul apper i autokonfig (kommaseparert)', placeholder: 'f.eks. Innstillinger' },
            { type: 'entity', name: b + '.volume_sensor', label: 'Volum-sensor (faktisk nivå)', domains: ['sensor'], auto: () => volSensor(h, p), help: 'Brukes i stedet for estimert nivå ved knapp-volum' },
            { type: 'entities', name: b + '.watch', label: 'Skjermtid i dag (sensor, første brukes i kortet)', domain: 'sensor' },
          );
        } else {
          // 35.8 · Musikk 1:1 med Media v4 cfgMus: Mediaspiller → Snarveier/stasjoner først, så resten
          fields.unshift(srcField(p));
          fields.push({ type: 'text', name: b + '.hide_sources', label: 'Skjul kilder (kommaseparert)', placeholder: 'f.eks. Bluetooth, USB' });
        }
        // Fiks 20.21: seertid-chip i Album-kortet (watch_time.<spiller>.i_dag / .maned)
        const wy = ((c.watch_time || {})[p.id]) || {};
        fields.push(
          { type: 'entity', name: `watch_time.${p.obj}.i_dag`, label: 'Seertid i dag (Album-kortet)', domains: ['sensor'], auto: () => wy.i_dag || '' },
          { type: 'entity', name: `watch_time.${p.obj}.maned`, label: 'Seertid denne måneden (Album-kortet)', domains: ['sensor'], auto: () => wy.maned || '' },
        );
        return { type: 'section', id: 'p_' + p.obj, lazy: true, icon: tv ? 'mdi:television' : 'mdi:speaker', label: `${p.name} · ${p.kind === 'skjul' ? 'skjult' : tv ? 'TV' : 'Musikk'}${p.areaName ? ' · ' + p.areaName : ''}`, meta: p.id, fields: [mpField(p), ...fields] };
    }
  };
  // 47 G · Tilpass media → Faner (Media v4 cfgIsFaner): tekst, forhåndsvisning (live, på --ki-bg) av fanelinja øverst med
  // samme HTML/CSS som kortet (tabBarHTML/tabBarCSS, aktiv = startfanen), og tre kort med segmenter (tabSegs/segBoxM/segOptM).
  const startOf = (c) => { const v = M.startTab ? M.startTab.value(c, startLegacy) : (c.start_tab || startLegacy(c)); return v === 'last' ? 'last' : v && TABS.some((t) => t[0] === v) ? v : tabOrder(c).vis[0]; };
  const tabPreview = () => ({
    type: 'html',
    html: (h, c) => {
      c = c || {};
      const T = tabOrder(c).vis, dt = (M.startTab ? M.startTab.pillKey(c, T, startLegacy) : null) || T[0]; // 36.5: startfanen (Sist brukte → første)
      return `<style>${tabBarCSS('.mtpv ')}</style><span class="hl" data-key="mtp-i" style="font-size:13px;color:var(--ki-text-mid, #979797);padding:2px 8px 0">Utseendet på fanelinja øverst i Media</span>
        <div class="mtpv" data-key="mtp" style="display:flex;flex-direction:column;gap:10px;padding:14px 12px 16px;border-radius:24px;background:var(--ki-bg, #232323);pointer-events:none">
          <span style="font-size:12px;color:var(--ki-text-3, #7f7f7f);padding:0 4px">Forhåndsvisning</span>
          ${tabBarHTML(T, dt, c, { preview: true, style: M.tabH && M.tabH.style(c) })}</div>`;
    },
  });
  const SEGS = [
    ['style', 'Fanestil', [['kontur', 'Kontur'], ['fylt', 'Fylt'], ['glass', 'Glass'], ['strek', 'Understrek'], ['chips', 'Chips']]],
    ['mode', 'Faner viser', [['tekst', 'Tekst'], ['ikon', 'Ikoner'], ['aktiv', 'Ikon + aktiv'], ['begge', 'Begge']]],
    ['start', 'Startfane', [...TABS, ['last', 'Sist brukte']]], // 47 G: «Sist brukte» = start_tab 'last' (felles MSH.startTab)
  ];
  const tabSegs = () => ({
    type: 'html',
    // Haptic selection ved valg (én per trykk). Startfane skrives til start_tab (felles MSH.startTab) + tabs.start; gamle default_tab fjernes.
    click: (d, ed) => {
      const c = ed._config || {}, g = d.g, v = d.v;
      if (!g || !v) return;
      M.haptic('selection');
      if (g === 'start') { const n = { ...c, tabs: { ...(c.tabs && typeof c.tabs === 'object' ? c.tabs : {}), start: v } }; delete n.default_tab; ed._config = n; return ed._set('start_tab', v); }
      return ed._set('tabs.' + g, v);
    },
    html: (h, c, key) => {
      c = c || {};
      const L = tabLook(c), cur = { style: L.style, mode: L.mode, start: startOf(c) };
      return SEGS.map(([g, title, opts]) => `<div class="mseg" data-key="mseg-${g}" style="display:flex;flex-direction:column;gap:8px;padding:12px;border-radius:24px;background:var(--ki-surface, #3a3a3a)">
          <span style="font-size:13px;font-weight:500;color:var(--ki-text-1, #c7c7c7);padding:0 4px">${esc(title)}</span>
          <div role="radiogroup" aria-label="${esc(title)}" style="display:grid;grid-template-columns:repeat(${Math.min(opts.length, 3)},minmax(0,1fr));gap:2px;padding:4px;border-radius:22px;background:var(--ki-surface-3, #2f2f2f)">${opts.map(([v, l]) => {
            const on = cur[g] === v;
            return `<button type="button" role="radio" aria-checked="${on}" class="mso${on ? ' on' : ''}" data-a="fn" data-k="${key}" data-g="${g}" data-v="${v}" data-key="mso-${g}-${v}" style="height:40px;min-width:0;border-radius:18px;font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 4px;transition:background .2s,color .2s;background:${on ? PINK : 'transparent'};color:${on ? 'var(--ki-on-accent, #3a3a3a)' : 'var(--ki-text-2, #afafaf)'}">${esc(l)}</button>`;
          }).join('')}</div></div>`).join('');
    },
  });
  const fanerSchema = () => [
    tabPreview(),
    tabSegs(),
    { type: 'order', name: 'tab_order', hiddenName: 'hidden_tabs', label: 'Faner (rekkefølge / skjul)', start: { legacy: startLegacy }, options: TABS },
    ...(M.tabH ? [M.tabH.field({ items: (hh, cc) => { const o = Array.isArray(cc.tab_order) ? cc.tab_order.filter((k) => TABS.some((t) => t[0] === k)) : []; TABS.forEach((t) => { if (!o.includes(t[0])) o.push(t[0]); }); return o.filter((k) => !(cc.hidden_tabs || []).includes(k)).map((k) => TABS.find((t) => t[0] === k)[1]); }, native: 38, gear: true, preview: false })] : []), // 33.4: fanehøyde
  ];
  const commonSchema = () => [
      { type: 'info', label: 'Felles for begge faner' },
      { type: 'lists', label: 'Mediaspillere', lists: (hh) => [{ key: 'spillere', label: 'Mediaspillere', ids: M.all(hh, 'media_player'), domains: ['media_player'] }] },
      { type: 'area', name: 'area', label: 'Begrens til område', help: 'Tomt = alle media_player.* i huset, sortert per område' },
      { type: 'select', name: 'now_playing.style', label: 'Spilles nå-kort', options: [['album', 'Album'], ['detailed', 'Detaljert']], default: 'album', help: 'Album: farget kort med bilde og seertid · Detaljert: kortet fra 19.5 med chips og fremdrift' },
      { type: 'range', name: 'card_height', label: 'Kortets høyde (Detaljert)', min: 200, max: 320, step: 4, default: CARD_H, unit: 'px' },
      { type: 'select', name: 'vol_style', label: 'Volum-stil · Musikk', options: [['pille', 'Pille'], ['trinn', 'Trinn'], ['user', 'La brukeren bytte']], default: 'user' },
      { type: 'select', name: 'vol_style_tv', label: 'Volum-stil · TV', options: [['trinn', 'Trinn'], ['knapper', 'Knapper'], ['user', 'La brukeren bytte']], default: 'user' },
      { type: 'boolean', name: 'remote_swipe', label: 'Sveip på styreflaten', default: true, help: 'Dra på fjernkontrollens runde flate for Opp/Ned/Venstre/Høyre (én kommando per 34 px)' },
      { type: 'boolean', name: 'toasts', label: 'Bekreftelsesmeldinger', default: true },
    ];

  class MediaBase extends M.Card {
    connectedCallback() {
      super.connectedCallback();
      this._bk = M.popupHash(this) || '_';
      bus(this._bk).subs.add(this);
      this._publish && this._publish();
    }
    disconnectedCallback() {
      super.disconnectedCallback();
      if (this._bk) bus(this._bk).subs.delete(this);
    }
    // Buss-nøkkel = popupens hash (finnes via host-kjeden, også når hero ligger inni hovedkortet).
    // Ble kortet koblet til før det lå i popupen, flyttes det til riktig buss ved første oppslag.
    get key() {
      if (!this._bk || this._bk === '_') {
        const h = M.popupHash(this);
        if (h && h !== this._bk) {
          if (this._bk) bus(this._bk).subs.delete(this);
          this._bk = h;
          if (this.isConnected) bus(h).subs.add(this);
        }
      }
      return this._bk || '_';
    }
    select(tab, id) {
      const b = bus(this.key);
      b.tab = tab;
      if (id) b.sel[tab] = id;
      // UI-tilstand (ikke config): huskes av hovedkortet i localStorage for «Sist brukt».
      const m = b.main && b.main.isConnected ? b.main : null;
      if (m) m.setUI({ tab: b.tab, sel: { ...b.sel } });
      emit(this.key);
    }
  }

  /* ============================================================ hero */
  // Fiks 17.22/17.24/17.25: felles hjelpere for musikk- og TV-kortet i karusellen.
  const OFF_ST = ['off', 'standby', 'unavailable', 'unknown'];
  const FALLBACK_COLS = [C.pink, C.blue, C.green, C.orange, C.purple];
  const fallbackCol = (id) => { let n = 0; for (const ch of String(id)) n = (n * 31 + ch.charCodeAt(0)) >>> 0; return FALLBACK_COLS[n % FALLBACK_COLS.length]; };
  // Gjennomsnittsfarge fra omslaget (canvas 16×16), mellomlagret per bilde. null = ikke klar / ikke mulig (reserve brukes).
  const ART = new Map();
  function artColor(url, done) {
    if (!url) return null;
    if (ART.has(url)) { const v = ART.get(url); return v === 'pending' ? null : v; }
    if (ART.size > 60) ART.delete(ART.keys().next().value);
    ART.set(url, 'pending');
    const img = new Image();
    if (!/^data:/.test(url)) img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const cv = document.createElement('canvas'); cv.width = cv.height = 16;
        const x = cv.getContext('2d'); x.drawImage(img, 0, 0, 16, 16);
        const d = x.getImageData(0, 0, 16, 16).data;
        let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 128) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
        if (!n) { ART.set(url, null); return done && done(); }
        r /= n; g /= n; b /= n;
        // Løft mørke/grå snitt litt, så tonen synes på mørk bakgrunn
        const mx = Math.max(r, g, b) || 1, k = mx < 150 ? 150 / mx : 1;
        ART.set(url, `rgb(${Math.round(Math.min(255, r * k))}, ${Math.round(Math.min(255, g * k))}, ${Math.round(Math.min(255, b * k))})`);
      } catch (e) { ART.set(url, null); }
      if (done) done();
    };
    img.onerror = () => { ART.set(url, null); if (done) done(); };
    img.src = url;
    return null;
  }
  const fmtT = (sec) => {
    sec = Math.max(0, Math.round(Number(sec) || 0));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
  };
  // Posisjon/varighet (media_position + tid siden media_position_updated_at mens den spiller)
  const posOf = (s) => {
    const a = (s && s.attributes) || {}, dur = Number(a.media_duration);
    if (!(dur > 0) || a.media_position == null || !isFinite(Number(a.media_position))) return null;
    let pos = Number(a.media_position);
    if (s.state === 'playing' && a.media_position_updated_at) { const t = Date.parse(a.media_position_updated_at); if (t) pos += (Date.now() - t) / 1000; }
    return { pos: M.clamp(pos, 0, dur), dur };
  };
  const clockOf = (v) => {
    if (v == null || v === '') return null;
    const d = typeof v === 'number' ? new Date(v < 1e12 ? v * 1000 : v) : new Date(v);
    return isNaN(d) ? (/^\d{1,2}:\d{2}/.test(String(v)) ? String(v).slice(0, 5) : null) : d.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
  };
  // Volum for en spiller (felles for kortet og volum-raden). Knapp-volum (TV): sensor / volume_level, ellers estimat (≈).
  function volInfo(card, p) {
    const h = card.hass, s = card.s(p.id), a = (s && s.attributes) || {}, off = !s || OFF_ST.includes(s.state);
    const btn = p.kind === 'tv' && p.pc.volume === 'buttons', sf = Number(a.supported_features) || 0;
    let level = null, approx = false, muted = !!a.is_volume_muted;
    if (a.volume_level != null && isFinite(Number(a.volume_level))) level = Math.round(Number(a.volume_level) * 100);
    else if (btn) {
      const sid = p.pc.volume_sensor || volSensor(h, p), ss = sid ? card.s(sid) : null, n = ss && M.isNum(ss.state) ? Number(ss.state) : null;
      if (n != null) level = Math.round(n <= 1 && !/%/.test((ss.attributes || {}).unit_of_measurement || '') ? n * 100 : n);
      else { const e = estLoad()[p.id]; if (e != null) { level = e; approx = true; } }
    }
    if (btn && p.pc.volume_mute && /^(switch|input_boolean)\./.test(p.pc.volume_mute)) { const ms = card.s(p.pc.volume_mute); if (ms) muted = ms.state === 'on'; }
    const can = btn || level != null || !sf || (sf & 1024) === 1024;
    return { level, approx, muted, btn, off, dis: off || !can, noLevel: level == null, sf };
  }
  const screenTime = (h, id) => {
    const s = h.states[id];
    if (!s || !M.isNum(s.state)) return null;
    const n = Number(s.state), u = String((s.attributes || {}).unit_of_measurement || '').toLowerCase();
    const min = u === 'h' ? n * 60 : u === 'min' ? n : u === 's' ? n / 60 : u === 'd' ? n * 1440 : null;
    if (min == null) return `${M.fmtState(h, id)} i dag`;
    const t = Math.floor(min / 60), m = Math.round(min % 60);
    return t ? `${t} t ${m} min i dag` : `${m} min i dag`;
  };
  /* ------------------------------------------------------------ Fiks 20.21: «Album»-kortet (now_playing.style) */
  // now_playing.style: 'album' (standard) | 'detailed' (19.5-kortet)
  const npStyle = (cfg) => (((cfg && cfg.now_playing) || {}).style === 'detailed' ? 'detailed' : 'album');
  // watch_time: { <media_player.id | obj>: { i_dag, maned } } – GUI-editoren skriver under obj (punktum i nøkkelen tåles ikke i stier)
  const wtOf = (cfg, p) => {
    const w = (cfg && cfg.watch_time) || {}, o = { ...(w[p.id] || {}), ...(w[p.obj] || {}) };
    return o.i_dag || o.maned ? o : null;
  };
  // Minutter fra en seertid-sensor: h/min/s/d/ms via unit_of_measurement, «t:mm(:ss)»-tekst, ellers timer (history_stats/duration)
  const wtMin = (st) => {
    if (!st) return null;
    const v = String(st.state), u = String((st.attributes || {}).unit_of_measurement || '').toLowerCase();
    if (/^\d+:\d{2}(:\d{2})?$/.test(v)) { const [hh, mm, ss] = v.split(':').map(Number); return hh * 60 + mm + (ss || 0) / 60; }
    if (!M.isNum(v)) return null;
    const n = Number(v);
    return u === 'min' ? n : u === 's' ? n / 60 : u === 'ms' ? n / 60000 : u === 'd' ? n * 1440 : n * 60;
  };
  const fmtHM = (min) => { const t = Math.max(0, Math.round(min)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
  // Farge → [r,g,b] (hex, rgb(), var(--x, #hex)); null når den ikke kan leses
  const rgbOf = (c) => {
    const x = String(c || ''), hx = x.match(/#([0-9a-f]{3}|[0-9a-f]{6})\b/i);
    if (/^\s*rgba?\(/i.test(x)) { const n = x.match(/[\d.]+/g); return n && n.length >= 3 ? n.slice(0, 3).map(Number) : null; }
    if (!hx) return null;
    const h = hx[1].length === 3 ? hx[1].replace(/./g, (d) => d + d) : hx[1];
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  };
  const relLum = (rgb) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]); };
  // Bakgrunnsfarge for Album-kortet: fargen blandet med #111 (68 % → ned) til kontrasten mot hvit tekst er ≥ 4.5:1
  const albumBg = (col) => {
    const rgb = rgbOf(col);
    if (!rgb) return `color-mix(in oklch, ${col} 55%, #111)`;
    for (let k = 0.68; k > 0.15; k -= 0.02) {
      const m = rgb.map((v) => v * k + 17 * (1 - k));
      if (1.05 / (relLum(m) + 0.05) >= 4.5) return `rgb(${m.map(Math.round).join(', ')})`;
    }
    return 'rgb(34, 34, 34)';
  };
  M.mediaAlbumBg = albumBg; // (test)
  const SEG_H = [8, 12, 16, 10, 14, 7, 12, 16, 9, 13, 6, 11, 15, 10]; // 14 segmenter, 6–16 px

  class MediaHero extends MediaBase {
    static get cardName() { return 'Media · nå spilles'; }
    static get schema() { return (h, c) => [{ type: 'info', label: 'Hero-kortet bruker innstillingene fra msh-media-card i samme popup. Felt satt her overstyrer dem.' }, ...baseSchema(h, c)]; }
    get cardSize() { return 4; }
    // Innebygd i msh-media-card (embedded: true): hovedkortet sender sin config via setConfig. card_id
    // tas bort så hero ikke registreres som hovedkortets live-instans (MSH.applyLive).
    setConfig(c) {
      if (c && c.embedded) { const { card_id, ...rest } = c; c = rest; }
      super.setConfig(c);
    }
    get embedded() { return !!(this._rawConfig && this._rawConfig.embedded); }
    get hostCard() { const r = this.getRootNode && this.getRootNode(); return r && r.host && r.host.localName === 'msh-media-card' ? r.host : null; }
    // Egen config (uten type/card_id) over hovedkortets config.
    get eff() {
      const own = { ...(this._rawConfig || {}) };
      delete own.type; delete own.card_id;
      if (this.embedded) return own;
      return { ...(bus(this.key).cfg || {}), ...own };
    }
    customize(focus, opts) {
      const hc = this.embedded && this.hostCard;
      return hc ? hc.customize(focus, opts) : super.customize(focus, opts);
    }
    render() {
      if (M.stationArtBind && this.shadowRoot) M.stationArtBind(this.shadowRoot, () => this.update()); // 51 A: feilet bilde → logo / ikon
      const cfg = this.eff, R = M.mediaResolve(this.hass, cfg, this.key);
      this._R = R;
      R.P.all.forEach((p) => this.s(p.id));
      const hgt = M.clamp(Number(cfg.card_height) || CARD_H, 200, 320);
      if (!R.L.length) {
        const txt = R.P.all.length ? `Ingen ${R.tab === 'tv' ? 'TV-er' : 'musikkspillere'}` : 'Fant ingen mediaspillere';
        return `<div class="wrap"><div class="sw noscroll" style="--mh:${hgt}px"><section data-ki-island class="pc off" data-key="_none" style="background:linear-gradient(150deg, #343434, var(--ki-surface-3, #2f2f2f))">
          <button class="pw press" data-act="customize" data-section="entities" title="Velg entitet">${M.icon('add', 20)}</button>
          <div class="mid"><div class="art" style="background:var(--ki-surface-2, var(--gray300,#404040));color:var(--ki-text-mid, var(--gray600,#7f7f7f))">${M.icon('music_note', 36)}</div>
            <div class="tt"><div class="dl">${M.icon('speaker', 15)}<b class="ell">–</b></div><div class="ti">–</div><span class="ar ell">${esc(txt)}</span></div></div>
          <div class="bot"></div>
        </section></div><div class="dots"><span class="dot on"></span></div></div>`;
      }
      const album = npStyle(cfg) === 'album';
      const cards = R.L.map((p) => (album ? this._album(p, cfg) : this._card(p))).join('');
      const dots = R.L.map((p, j) => `<button class="dot ${j === R.i ? 'on' : ''}" data-act="dot" data-i="${j}" data-haptic="selection" data-key="${esc(p.id)}" title="${esc(p.name)}"></button>`).join('');
      return `<div class="wrap"><div class="sw noscroll ${album ? 'alb' : ''}" style="--mh:${hgt}px">${cards}</div><div class="dots">${dots}</div></div>`;
    }
    // Fiks 20.21 · «Album»-kortet (standard): grid 1fr auto – venstre chip (+ eq), tittel, artist/serie/kanal og bunnrad
    // (14 fremdrift-segmenter + av/på og neste (musikk) / spill-pause (TV)); høyre bilde 104×104 + seertid-chip (watch_time).
    // Bakgrunn når den spiller: farge fra bildet (reserve: app-farge / aksent), mørknet til ≥ 4.5:1 mot hvit tekst.
    _album(p, cfg) {
      const h = this.hass, I = info(this, p), a = I.a, s = I.s, tv = I.tv, off = I.off;
      const aIc = a.app_icon ? (a.app_icon[0] === '/' && h.hassUrl ? h.hassUrl(a.app_icon) : a.app_icon) : '';
      const pic = off ? '' : tv ? (I.pic || aIc) : I.pic;
      const col = off ? null : (artCol(I, pic, () => this.update()) || (tv ? I.col : appStyle(I.app).col) || C.pink);
      const bg = off ? '' : `background-color:${albumBg(col)}`;
      let title, sub;
      if (off) { title = I.title; sub = p.name; }
      else {
        title = a.media_title || I.app || a.source || (s.state === 'idle' ? (tv ? 'Hjem' : 'Klar') : '–');
        sub = [a.media_artist, a.media_series_title, a.media_channel, I.app].find((x) => x && x !== title) || '';
      }
      const run = I.run && !off;
      const eq = run ? `<span class="al-eq" aria-hidden="true">${[0, 1, 2, 3, 4].map((k) => `<span style="animation-duration:${(0.62 + (k % 3) * 0.17).toFixed(2)}s;animation-delay:${(k * 0.11).toFixed(2)}s"></span>`).join('')}</span>` : '';
      const chip = `<span class="al-chip">${M.icon(p.pc.icon || (tv ? 'tv' : I.icon), 16)}<span class="ell">${esc(off ? p.name : I.label)}</span></span>`;
      // Fremdrift: 14 segmenter (direkte: uten fremdrift, av: ingen)
      const P = off ? null : posOf(s), n = P ? Math.round((P.pos / P.dur) * 14) : 0;
      const segs = off ? '<span class="al-seg"></span>' : `<span class="al-seg" ${P ? `title="${fmtT(P.pos)} / ${fmtT(P.dur)}"` : ''}>${SEG_H.map((sh, i) => `<i class="${i < n ? 'on' : ''}" style="height:${sh}px"></i>`).join('')}</span>`;
      const id = esc(p.id);
      const b2 = tv
        ? `<button class="al-b press" data-act="pp" data-id="${id}" title="Spill/pause" aria-label="Spill/pause">${M.icon(I.run ? 'pause' : 'play_arrow', 24)}</button>`
        : `<button class="al-b press" data-act="next" data-id="${id}" title="Neste" aria-label="Neste">${M.icon('skip_next', 24)}</button>`;
      const btns = `<button class="al-b press" data-act="power" data-id="${id}" title="Av/på" aria-label="Av/på">${M.icon('power_settings_new', 20)}</button>${b2}`;
      const art = `<div class="al-art ${pic && tv ? 'logo' : ''}" data-sa-kind="${pic && I.art && I.art.url === pic ? I.art.kind : pic ? 'app' : 'none'}">${pic ? artImg(I, pic) : M.icon(off ? (tv ? 'tv' : 'speaker') : tv ? (appStyle(I.app).icon || 'tv') : I.artIcon, 40)}</div>`;
      // Seertid-chip (alltid synlig når spilleren har watch_time): i dag (fet) · denne måneden, t:mm
      const W = wtOf(cfg, p);
      let wt = '';
      if (W) {
        const v = (eid) => { const m = eid ? wtMin(this.s(eid)) : null; return m == null ? '–' : fmtHM(m); };
        wt = `<span class="al-wt" title="Seertid i dag · denne måneden">${M.icon('mdi:timer-outline', 13)}<b>${v(W.i_dag)}</b><span>·</span><span>${v(W.maned)}</span></span>`;
      }
      return `<section data-ki-island class="pc al ${off ? 'off' : 'on'} ${run ? 'run' : ''} ${tv ? 'tv' : 'mus'}" data-key="${id}" data-ent="${id}" style="${bg}">
        <div class="al-l"><div class="al-top">${chip}${eq}</div><div class="al-ti ell">${esc(title)}</div>${sub ? `<div class="al-ar ell">${esc(sub)}</div>` : ''}
          <div class="al-bot">${segs}${btns}</div></div>
        <div class="al-r">${art}${wt}</div></section>`;
    }
    // Ett kort i karusellen (Fiks 19.5): samme oppbygning for Musikk og TV – ingen egen topprad. Plakat/omslag til venstre,
    // tekstkolonnen starter med enhetslinjen (ikon · navn · app/kilde · eq), av/på ligger absolutt øverst til høyre.
    // TV: plakat 84×118 + merke (LIVE/4K/HD), kicker bygd bare fra data som finnes, chips på én linje, fremdrift og kontrollrad.
    _card(p) {
      const h = this.hass, I = info(this, p), a = I.a, s = I.s, tv = I.tv, V = volInfo(this, p);
      const col = tv ? (I.col || fallbackCol(p.id)) : (artCol(I, I.pic, () => this.update()) || fallbackCol(p.id));
      const bg = I.off ? 'linear-gradient(150deg, #343434, var(--ki-surface-3, #2f2f2f))' : `linear-gradient(150deg, color-mix(in srgb, ${col} ${tv ? 20 : 22}%, #343434), #343434 55%, var(--ki-surface-3, #2f2f2f))`;
      const eq = [0, 1, 2, 3].map((k) => `<span style="animation-duration:${(0.7 + (k % 3) * 0.18).toFixed(2)}s;animation-delay:${(k * 0.12).toFixed(2)}s"></span>`).join('');
      const has0 = (v) => v != null && v !== '';
      const ct = String(a.media_content_type || '').toLowerCase();
      // Tittel, undertittel og kicker (app-delen av enhetslinjen)
      let title, sub, kick = '', live = false;
      if (I.off) { title = I.title; sub = p.areaName || ''; }
      else if (tv) {
        title = a.media_title || I.app || (s.state === 'idle' ? 'Hjem' : '–');
        live = ct === 'channel' || /direkte/i.test([a.media_series_title, a.media_channel].filter(Boolean).join(' '));
        const film = ct === 'movie' || ct === 'film';
        const yr = (String(a.media_year || a.year || a.media_release_date || a.release_date || '').match(/\b(19|20)\d{2}\b/) || [])[0];
        const ser = !live && !film && (has0(a.media_season) || ct === 'tvshow' || ct === 'episode') && has0(a.media_episode);
        if (live) kick = [I.app, 'direkte'].filter(Boolean).join(' · ');
        else if (ser) kick = ['Serie', has0(a.media_season) ? 'S' + a.media_season : '', 'E' + a.media_episode].filter(Boolean).join(' · ');
        else if (film) kick = 'Film' + (yr ? ' · ' + yr : '');
        else kick = I.app;
        sub = [a.media_series_title, a.media_channel, a.app_name].find((x) => x && x !== title) || '';
      } else {
        title = a.media_title || a.source || (s.state === 'idle' ? 'Klar' : '–');
        sub = a.media_title ? [a.media_artist, a.media_album_name || a.media_channel].filter(Boolean).join(' · ') : (a.media_channel || '');
        kick = a.media_channel || a.source || a.app_name || '';
      }
      // Enhetslinjen (første linje i tekstkolonnen) + av/på (absolutt øverst til høyre)
      const dl = `<div class="dl">${M.icon(p.pc.icon || (tv ? 'tv' : I.icon), 15)}<b class="ell">${esc(p.name)}</b>${kick ? `<span class="kk ell">· ${esc(kick)}</span>` : ''}${I.off ? '' : `<span class="eq">${eq}</span>`}</div>`;
      const pw = `<button class="pw press" data-act="power" data-id="${esc(p.id)}" title="Av/på">${M.icon('power_settings_new', 18)}</button>`;
      // Plakat (TV) / omslag (musikk)
      const pic = tv ? (I.pic || (a.app_icon ? (a.app_icon[0] === '/' && h.hassUrl ? h.hassUrl(a.app_icon) : a.app_icon) : '')) : I.pic;
      const sc = I.off ? null : tv ? (artCol(I, pic, () => this.update()) || col) : col;
      const shadow = sc ? `box-shadow:0 10px 26px color-mix(in srgb, ${sc} 38%, transparent);` : '';
      const tile = I.off ? 'background:var(--ki-surface-2, var(--gray300,#404040));color:var(--ki-text-mid, var(--gray600,#7f7f7f))' : tv ? `background:${col};color:#fff` : `background:linear-gradient(145deg, ${col}, color-mix(in srgb, ${col} 45%, var(--ki-surface-3, #2f2f2f)));color:#fff`;
      let badge = '';
      if (tv && !I.off) {
        const rs = [a.media_resolution, a.video_resolution, a.resolution, a.media_video_format, a.video_format, ct].filter(Boolean).join(' ');
        const rz = /2160|4k|uhd/i.test(rs) ? '4K' : /1080|720|\bhd\b|fhd/i.test(rs) ? 'HD' : '';
        badge = live ? '<span class="bdg rd">LIVE</span>' : rz ? `<span class="bdg">${rz}</span>` : '';
      }
      const art = `<div class="art" data-sa-kind="${pic && I.art && I.art.url === pic ? I.art.kind : pic ? 'app' : 'none'}" style="${tile};${shadow}">${pic ? artImg(I, pic) : M.icon(tv ? (appStyle(I.app).icon || 'tv') : I.artIcon, 36)}${badge}</div>`;
      // Chips (én linje, skjules når verdien mangler – aldri mock)
      const ch = [];
      const chip = (ic, txt, act, id) => (act ? `<button class="ch press" data-act="${act}" data-id="${esc(id)}" data-key="ch-${esc(txt)}">` : `<span class="ch" data-key="ch-${esc(txt)}">`) + `${M.icon(ic, 13)}<span class="ell">${esc(txt)}</span>` + (act ? '</button>' : '</span>');
      if (!I.off) {
        if (V.muted) ch.push(chip('mdi:volume-off', 'Dempet'));
        else if (V.level != null) ch.push(chip(volIcon(V.level, false), `${V.approx ? '≈' : ''}${V.level} %`));
        if (tv) {
          if (a.source && a.app_name && a.source !== a.app_name) ch.push(chip(appStyle(a.source).icon || 'mdi:video-input-hdmi', a.source));
          const au = a.audio_format || a.media_audio_format || a.audio_codec || a.sound_mode;
          if (au) ch.push(chip('mdi:surround-sound', String(au)));
          const w = (Array.isArray(p.pc.watch) ? p.pc.watch : []).filter(Boolean)[0];
          if (w) { this.s(w); const st = screenTime(h, w); if (st) ch.push(chip('mdi:timer-outline', st)); }
        } else {
          const gm = Array.isArray(a.group_members) ? a.group_members.filter((x) => x !== p.id) : [];
          if (gm.length) ch.push(chip('mdi:speaker-multiple', `+ ${M.name(h, gm[0])}${gm.length > 1 ? ' +' + (gm.length - 1) : ''}`, 'group', p.id));
          const sn = a.source || a.app_name, br = a.bitrate || a.media_bitrate;
          if (sn) ch.push(chip(appStyle(sn).icon || 'mdi:music-circle-outline', [sn, br ? `${br} kbps` : ''].filter(Boolean).join(' · ')));
        }
      }
      const mid = `<div class="mid">${art}<div class="tt">${dl}<div class="ti">${esc(title)}</div>${sub ? `<span class="ar ell">${esc(sub)}</span>` : ''}${ch.length ? `<div class="chs">${ch.join('')}</div>` : ''}</div></div>`;
      // Bunnen: fremdrift / DIREKTE
      const P = I.off ? null : posOf(s), seek = !!P && ((V.sf & 2) === 2);
      const bar = (fill) => `<div class="pg ${seek ? 'sk' : ''}" data-seek="${esc(p.id)}" data-dur="${P.dur}" data-key="pg"><div class="pgt"><div class="pgf" style="width:${((P.pos / P.dur) * 100).toFixed(2)}%;background:${fill}"></div></div></div>`;
      const liveTag = '<span class="live"><i></i>DIREKTE</span>';
      let bot = '';
      const nxt = a.media_next_title || a.next_title || a.next_program || '';
      if (!I.off) {
        if (tv && live) {
          const endT = clockOf(a.end_time || a.media_end_time || a.program_end), nxT = clockOf(a.next_start || a.next_start_time);
          bot = `${P ? bar(C.red) : ''}<div class="lrow">${liveTag}${nxt ? `<span class="nx ell">Neste: ${esc(nxt)}${nxT ? ' ' + esc(nxT) : ''}</span>` : '<span class="nx"></span>'}${endT ? `<span class="end">Slutter ${esc(endT)}</span>` : ''}</div>`;
        } else if (tv && P) {
          const left = Math.max(0, P.dur - P.pos), endT = s.state === 'playing' ? clockOf(Date.now() + left * 1000) : null;
          bot = `${bar(PINK)}<div class="tm"><span class="t0">${fmtT(P.pos)}</span><span class="nx ell">${Math.ceil(left / 60)} min igjen${endT ? ' · slutter ' + esc(endT) : ''}</span><span class="t1">${fmtT(P.dur)}</span></div>`;
        } else if (!tv && P) {
          const pl = nxt ? `Neste: ${nxt}` : '';
          bot = `${bar(PINK)}<div class="tm"><span class="t0">${fmtT(P.pos)}</span><span class="nx ell">${esc(pl)}</span><span class="t1">${fmtT(P.dur)}</span></div>`;
        } else if (!tv && (a.media_title || a.media_channel) && ['playing', 'paused', 'buffering'].includes(s.state)) {
          // Radio / direkte: neste snarvei i listen
          const sc2 = listOf(h, p, 'presets').filter((x) => x.type !== 'source');
          const hay = [a.media_title, a.media_artist, a.media_channel, a.media_album_name, a.source].filter(Boolean).join(' | ').toLowerCase();
          const nm = sc2.map((x) => x.name || (x.type === 'favorite' ? x.target : M.name(h, x.target, p.name)) || ''), cur = nm.findIndex((n) => n.length > 2 && hay.includes(n.toLowerCase()));
          const nx = cur >= 0 && nm.length > 1 ? nm[(cur + 1) % nm.length] : '';
          bot = `<div class="lrow">${liveTag}${nx ? `<span class="nx ell">Neste: ${esc(nx)}</span>` : ''}</div>`;
        }
      }
      // Kontrollrad (TV, bare når den er på): ⟲10 · play/pause · 30⟳ · neste. Ustøttede tjenester skjules (supported_features).
      let ctl = '';
      if (tv && !I.off) {
        const sf = V.sf, has = (f) => !sf || (sf & f) === f, id = esc(p.id), sk = !!P && has(2);
        const b = (act, ic, t, x) => `<button class="cb press" data-act="${act}" data-id="${id}" ${x || ''} title="${t}" aria-label="${t}">${M.icon(ic, 22)}</button>`;
        const pp = has(1) || has(16384);
        ctl = `<div class="ctl">${sk ? b('seek', 'mdi:rewind-10', 'Tilbake 10 s', 'data-d="-10"') : ''}${pp ? `<button class="cb pp press" data-act="pp" data-id="${id}" title="Spill/pause" aria-label="Spill/pause">${M.icon(I.run ? 'pause' : 'play_arrow', 26)}</button>` : ''}${sk ? b('seek', 'mdi:fast-forward-30', 'Frem 30 s', 'data-d="30"') : ''}${has(32) ? b('next', 'skip_next', 'Neste') : ''}</div>`;
        if (ctl === '<div class="ctl"></div>') ctl = '';
      }
      return `<section data-ki-island class="pc ${I.off ? 'off' : ''} ${I.run ? 'run' : ''} ${tv ? 'tv' : 'mus'}" data-key="${esc(p.id)}" data-ent="${esc(p.id)}" style="background:${bg}">
        ${pw}${mid}<div class="bot">${bot}</div>${ctl}</section>`;
    }
    onAction(name, el, ev) {
      if (name === 'power') {
        const s = this.hass.states[el.dataset.id];
        const off = !s || ['off', 'standby'].includes(s.state);
        return M.call(this.hass, 'media_player', off ? 'turn_on' : 'turn_off', { entity_id: el.dataset.id });
      }
      if (name === 'group') return M.moreInfo(this, el.dataset.id);
      // Kontrollraden i TV-kortet (Fiks 19.5): media_seek ± s, media_play_pause, media_next_track
      if (name === 'pp' || name === 'next') return M.call(this.hass, 'media_player', name === 'pp' ? 'media_play_pause' : 'media_next_track', { entity_id: el.dataset.id });
      if (name === 'seek') {
        const P = posOf(this.hass.states[el.dataset.id]);
        if (!P) return;
        return M.call(this.hass, 'media_player', 'media_seek', { entity_id: el.dataset.id, seek_position: Math.round(M.clamp(P.pos + Number(el.dataset.d || 0), 0, P.dur)) });
      }
      if (name === 'dot') {
        const sw = this.shadowRoot.querySelector('.sw'), i = Number(el.dataset.i);
        if (sw) sw.scrollTo({ left: i * sw.clientWidth, behavior: 'smooth' });
        if (this._R && this._R.L[i]) this.select(this._R.tab, this._R.L[i].id);
        return;
      }
      return super.onAction(name, el, ev);
    }
    onClose() { this._tickStop(); }
    disconnectedCallback() { super.disconnectedCallback(); this._tickStop(); }
    _tickStop() { if (this._tk) { clearInterval(this._tk); this._tk = null; } }
    afterRender() {
      const sw = this.shadowRoot.querySelector('.sw');
      if (!sw) return;
      if (!sw.__b) {
        sw.__b = true;
        // Horisontalt sveip (native scroll-snap): Bubble Card skal ikke få touch/peker-hendelsene.
        const stop = (e) => e.stopPropagation();
        sw.addEventListener('pointerdown', stop);
        sw.addEventListener('touchstart', stop, { passive: true });
        sw.addEventListener('touchmove', stop, { passive: true });
        sw.addEventListener('scroll', () => {
          this._scr = Date.now();
          clearTimeout(this._st);
          this._st = setTimeout(() => this._settle(sw), 140);
        }, { passive: true });
      }
      // Fiks 20.21: knappene i Album-kortet – trykket skal ikke gå videre (sveip/hold på kortet)
      sw.querySelectorAll('.al-b').forEach((bt) => {
        if (bt.__b) return;
        bt.__b = true;
        // (klikket må nå kortets egen lytter på shadowRoot; hold → more-info på kortet avbrytes)
        bt.addEventListener('pointerdown', (e) => { e.stopPropagation(); this._cancelHold(); });
        bt.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
      });
      const R = this._R;
      if (R && sw.clientWidth && Date.now() - (this._scr || 0) > 500) {
        const want = R.i * sw.clientWidth;
        if (Math.abs(sw.scrollLeft - want) > 2) sw.scrollLeft = want;
      }
      // Fremdrift: trykk/dra = media_seek (når støttet). M.drag gir touch-action none + stopPropagation.
      sw.querySelectorAll('.pg.sk').forEach((pg) => {
        if (pg.__b) return;
        pg.__b = true;
        const paint = (f) => { const x = pg.querySelector('.pgf'), t = pg.parentElement && pg.parentElement.querySelector('.t0'); if (x) x.style.width = (f * 100).toFixed(2) + '%'; if (t) t.textContent = fmtT(f * Number(pg.dataset.dur)); };
        M.drag(pg, {
          onStart: () => { this._seek = true; },
          onMove: (f) => paint(f),
          onEnd: (f) => {
            this._seek = false; paint(f);
            M.call(this.hass, 'media_player', 'media_seek', { entity_id: pg.dataset.seek, seek_position: Math.round(f * Number(pg.dataset.dur)) });
          },
        });
      });
      // Lokal telling hvert sekund mens noe med varighet spiller og popupen er åpen (ingen polling ellers)
      const need = !!R && R.L.some((p) => { const s = this.hass.states[p.id]; return s && s.state === 'playing' && posOf(s); });
      const open = this.isOpen || (M.isPopupOpen ? M.isPopupOpen(this) : true);
      if (need && open && !this._tk) this._tk = setInterval(() => { if (!this.isConnected) return this._tickStop(); if (!this._seek) this.update(); }, 1000);
      else if ((!need || !open) && this._tk) this._tickStop();
    }
    _settle(sw) {
      const R = this._R;
      if (!R || !R.L.length || !sw.clientWidth) return;
      const n = Math.max(0, Math.min(R.L.length - 1, Math.round(sw.scrollLeft / sw.clientWidth)));
      if (n !== R.i) { M.haptic('selection'); this.select(R.tab, R.L[n].id); }
    }
    get styles() {
      return `
        @keyframes eq{0%,100%{transform:scaleY(.3)}50%{transform:scaleY(1)}}
        @keyframes mhlive{0%,100%{opacity:1}50%{opacity:.35}}
        .wrap{display:flex;flex-direction:column;gap:8px}
        .sw{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;border-radius:28px;overscroll-behavior-x:contain}
        /* Fiks 17.24/19.5: fast høyde (256) for alle kort (TV og Musikk), innhold fordelt med space-between. Ingen topprad:
           enhetslinjen er første linje i tekstkolonnen, av/på ligger absolutt øverst til høyre. */
        .pc{position:relative;flex:none;width:100%;height:var(--mh,${CARD_H}px);box-sizing:border-box;overflow:hidden;scroll-snap-align:start;display:flex;flex-direction:column;justify-content:space-between;gap:10px;padding:16px;border-radius:28px;box-shadow:inset 0 0 0 1px rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.05*var(--ki-wa-k,1)),var(--ki-wa-max,1)));min-width:0;transition:background .5s;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
        .pc.off .mid{opacity:.6}
        .eq{display:flex;gap:2px;align-items:flex-end;height:10px;flex:none;margin-left:2px}
        .eq span{width:2px;height:10px;border-radius:1px;background:var(--ki-text-mid, var(--gray700,#979797));transform-origin:bottom;transform:scaleY(.3)}
        .run .eq span{animation-name:eq;animation-timing-function:ease-in-out;animation-iteration-count:infinite}
        .pw{position:absolute;top:16px;right:16px;z-index:1;width:36px;height:36px;border-radius:18px;display:grid;place-items:center;background:rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.08*var(--ki-wa-k,1)),var(--ki-wa-max,1)));color:var(--ki-text, var(--white,#fafafa))}
        .off .pw{background:${M.alpha(C.red, 0.2)};color:${C.red}}
        .mid{display:flex;gap:14px;align-items:stretch;min-width:0;height:118px;flex:none}
        .art{position:relative;width:118px;height:118px;flex:none;border-radius:20px;display:grid;place-items:center;overflow:hidden}
        .tv .art{width:84px;border-radius:16px}
        .art img{width:100%;height:100%;object-fit:cover;display:block}
        .bdg{position:absolute;left:6px;bottom:6px;height:18px;padding:0 6px;border-radius:6px;display:inline-flex;align-items:center;background:rgb(0 0 0/max(var(--ki-ka-min,0),calc(0.6*var(--ki-ka-k,1))));color:#fff;font-size:10px;font-weight:700;letter-spacing:.06em}
        .bdg.rd{background:${C.red};color:#2a1720}
        .tt{flex:1;min-width:0;height:118px;padding-right:40px;display:flex;flex-direction:column;gap:3px;overflow:hidden}
        .dl{display:flex;align-items:center;gap:5px;height:18px;flex:none;min-width:0;white-space:nowrap;overflow:hidden;font-size:13px;color:var(--ki-text-1, var(--gray1000,#e1e1e1))}
        .dl b{font-weight:500;flex:0 0 auto;min-width:0;max-width:62%}
        .dl .kk{flex:0 1 auto;min-width:0;font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:var(--ki-text-mid, var(--gray700,#979797))}
        /* Fiks 17.22: tittel inntil 2 linjer uten rulling */
        .ti{font-size:22px;font-weight:600;line-height:1.15;letter-spacing:-0.01em;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere;flex:none;margin-top:2px}
        .ar{font-size:14px;color:var(--ki-text-1, var(--gray900,#c7c7c7));flex:none}
        /* Én linje chips (19.5): de som ikke får plass brytes ned og skjules */
        .chs{display:flex;flex-wrap:wrap;gap:4px;max-height:22px;overflow:hidden;margin-top:auto;min-width:0;flex:none}
        .ch{flex:0 1 auto;min-width:0;max-width:100%;height:22px;display:inline-flex;align-items:center;gap:4px;padding:0 8px;border-radius:11px;background:rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.08*var(--ki-wa-k,1)),var(--ki-wa-max,1)));font-size:11px;color:var(--ki-text-1, var(--gray900,#c7c7c7));white-space:nowrap;box-sizing:border-box}
        .ch .ell{min-width:0}
        .ctl{display:flex;align-items:center;justify-content:center;gap:22px;flex:none}
        .cb{width:40px;height:40px;border-radius:20px;display:grid;place-items:center;background:rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.08*var(--ki-wa-k,1)),var(--ki-wa-max,1)));color:var(--ki-text, var(--white,#fafafa));flex:none;transition:transform .12s}
        .cb.pp{width:48px;height:48px;border-radius:24px;background:${PINK};color:#2a1720}
        .cb:active{transform:scale(.92)}
        .bot{display:flex;flex-direction:column;gap:7px;min-width:0;min-height:0}
        .bot:empty{display:none}
        .pg{padding:8px 0;margin:-8px 0}
        .pg.sk{cursor:pointer;touch-action:none}
        .pgt{height:4px;border-radius:2px;background:rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.12*var(--ki-wa-k,1)),var(--ki-wa-max,1)));overflow:hidden}
        .pgf{height:100%;border-radius:2px}
        .tm{display:flex;align-items:center;gap:10px;font-size:11px;color:var(--ki-text-mid, var(--gray700,#979797));font-variant-numeric:tabular-nums}
        .tm .nx{flex:1;min-width:0;text-align:center;color:var(--ki-text-mid, var(--gray600,#7f7f7f))}
        .lrow{display:flex;align-items:center;gap:10px;font-size:12px;color:var(--ki-text-mid, var(--gray700,#979797));min-width:0}
        .lrow .nx{flex:1;min-width:0}
        .lrow .end{flex:none;color:var(--ki-text-mid, var(--gray600,#7f7f7f));font-variant-numeric:tabular-nums}
        .live{display:inline-flex;align-items:center;gap:5px;height:22px;padding:0 9px;border-radius:11px;background:${M.alpha(C.red, 0.16)};color:${C.red};font-size:11px;font-weight:600;letter-spacing:.06em;flex:none}
        .live i{width:6px;height:6px;border-radius:3px;background:currentColor;animation:mhlive 1.6s ease-in-out infinite}
        /* Fiks 20.21 · Album-kortet */
        .pc.al{height:auto;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:16px;padding:16px 16px 16px 18px;background-color:var(--ki-surface, var(--gray200,#3a3a3a));transition:background-color .4s;color:var(--ki-text, #fafafa)}
        .pc.al.on{background-image:radial-gradient(120% 90% at 100% 0%, rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.16*var(--ki-wa-k,1)),var(--ki-wa-max,1))), transparent 55%), linear-gradient(160deg, rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.03*var(--ki-wa-k,1)),var(--ki-wa-max,1))), rgb(0 0 0/max(var(--ki-ka-min,0),calc(0.2*var(--ki-ka-k,1)))))}
        .al-l{display:flex;flex-direction:column;min-width:0}
        .al-top{display:flex;align-items:center;gap:10px;min-width:0;height:30px;flex:none}
        .al-chip{height:30px;min-width:0;flex:0 1 auto;display:inline-flex;align-items:center;gap:6px;padding:0 12px 0 10px;border-radius:15px;background:rgb(0 0 0/max(var(--ki-ka-min,0),calc(0.2*var(--ki-ka-k,1))));font-size:12px;white-space:nowrap;box-sizing:border-box;color:var(--ki-text, #fafafa)}
        .off .al-chip{background:#4a4a4a}
        .al-eq{display:flex;gap:3px;align-items:flex-end;height:22px;flex:none}
        .al-eq span{width:3px;height:22px;border-radius:1.5px;background:#fff;transform-origin:bottom;transform:scaleY(.35);animation:eq ease-in-out infinite}
        .al-ti{margin-top:12px;font-size:22px;font-weight:400;line-height:1.2;letter-spacing:-0.01em;color:var(--ki-text, #fafafa)}
        .al-ar{margin-top:2px;font-size:14px;color:var(--ki-text-2, rgba(255,255,255,0.78))}
        .off .al-ar{color:var(--ki-text-2, var(--gray800,#afafaf))}
        .al-bot{margin-top:auto;padding-top:14px;display:flex;align-items:center;gap:10px;min-width:0}
        .al-seg{flex:1;min-width:0;height:16px;display:flex;align-items:center;gap:3px}
        .al-seg i{flex:0 1 5px;min-width:2px;border-radius:3px;background:rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.28*var(--ki-wa-k,1)),var(--ki-wa-max,1)))}
        .al-seg i.on{background:rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.75*var(--ki-wa-k,1)),var(--ki-wa-max,1)))}
        .al-b{width:44px;height:44px;border-radius:22px;flex:none;display:grid;place-items:center;background:rgb(0 0 0/max(var(--ki-ka-min,0),calc(0.2*var(--ki-ka-k,1))));color:var(--ki-text, #fafafa);transition:transform .12s}
        .al-b:active{transform:scale(.92)}
        .off .al-b{background:#4a4a4a}
        .al-r{width:104px;display:flex;flex-direction:column;align-items:center;gap:10px}
        .al-art{position:relative;width:104px;height:104px;border-radius:20px;overflow:hidden;flex:none;display:grid;place-items:center;background:rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.12*var(--ki-wa-k,1)),var(--ki-wa-max,1)));color:var(--ki-text, #fafafa);box-shadow:0 14px 30px rgb(0 0 0/max(var(--ki-ka-min,0),calc(0.35*var(--ki-ka-k,1))))}
        .al-art::after{content:'';position:absolute;inset:0;border-radius:inherit;pointer-events:none;box-shadow:inset 0 0 0 1px rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.16*var(--ki-wa-k,1)),var(--ki-wa-max,1)));background:linear-gradient(125deg, rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.22*var(--ki-wa-k,1)),var(--ki-wa-max,1))), transparent 38%)}
        .al-art img{width:100%;height:100%;object-fit:cover;display:block}
        .al-art.logo{background:rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.9*var(--ki-wa-k,1)),var(--ki-wa-max,1)))}
        .al-art.logo img{object-fit:contain;padding:8px;box-sizing:border-box}
        .off .al-art{background:#4a4a4a;color:var(--ki-text-mid, var(--gray700,#979797));box-shadow:none}
        .off .al-art::after{background:none}
        .al-wt{flex:none;height:24px;display:inline-flex;align-items:center;gap:5px;padding:0 9px;border-radius:12px;background:rgb(0 0 0/max(var(--ki-ka-min,0),calc(0.22*var(--ki-ka-k,1))));font-size:12px;color:var(--ki-text, #fafafa);white-space:nowrap;font-variant-numeric:tabular-nums}
        .al-wt b{font-weight:700}
        .off .al-wt{background:#4a4a4a}
        .dots{display:flex;justify-content:center;gap:6px;height:10px;align-items:center}
        .dot{width:6px;height:6px;border-radius:3px;background:var(--ki-ctrl, var(--gray400,#545454));transition:all .25s;flex:none}
        .dot.on{width:18px;background:var(--ki-text, var(--white,#fafafa))}
      `;
    }
  }

  /* ============================================================ hovedkort */
  const KEYS = [['back', 'arrow_back', 'Tilbake'], ['home', 'home', 'Hjem'], ['menu', 'menu', 'Meny'], ['play', 'play_pause', 'Spill/pause']];
  const KEYL = { up: 'Opp', down: 'Ned', left: 'Venstre', right: 'Høyre', ok: 'OK', back: 'Tilbake', home: 'Hjem', menu: 'Meny', play: 'Spill/pause', mic: 'Mikrofon' };
  const HOME_HOLD_MS = 550; // Fiks 19.4: Sirkel – hold Hjem fyller knappen rosa over 550 ms
  // 35.8 · spole-presets (hold venstre/høyre pil). Apple TV: remote.send_command skip_backward/skip_forward – ett hopp
  // er appens eget intervall (tvOS-standard 10 s), så antall hopp = sekunder / APPLE_SKIP_S.
  const SEEK_HOLD_MS = 500, SEEK_MIN = [1, 2, 5, 10], APPLE_SKIP_S = 10;
  const SEEK_CSS = `:host{all:initial;position:fixed;inset:0;z-index:2;display:block;font-family:${M.FONT};-webkit-tap-highlight-color:transparent}
    .bg{position:absolute;inset:0;background:transparent}
    .m{position:absolute;display:flex;gap:4px;padding:5px;border-radius:24px;background:var(--ki-surface-2, #404040);color:var(--ki-text, #fafafa);
      box-shadow:inset 0 0 0 1px rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.08*var(--ki-wa-k,1)),var(--ki-wa-max,1))),0 12px 32px rgb(0 0 0/max(var(--ki-ka-min,0),calc(0.45*var(--ki-ka-k,1))));
      transform-origin:50% 100%;animation:skIn .18s cubic-bezier(.34,1.4,.64,1);touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}
    .m.below{transform-origin:50% 0}
    button{all:unset;box-sizing:border-box;height:40px;min-width:58px;padding:0 12px;border-radius:20px;display:grid;place-items:center;font-size:14px;font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap;cursor:pointer;color:inherit;-webkit-touch-callout:none}
    button:hover,button:focus-visible{background:rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.08*var(--ki-wa-k,1)),var(--ki-wa-max,1)))}
    button:active{background:${PINK};color:var(--ki-on-accent, #3a3a3a);transform:scale(.96)}
    @keyframes skIn{from{opacity:0;transform:scale(.86)}}
    @media (prefers-reduced-motion: reduce){.m{animation:none}}`;
  class MediaCard extends MediaBase {
    static get cardName() { return 'Media'; }
    static get defaults() { return {}; } // 36.5: startfane = start_tab (standard første fane i tab_order)
    // Valgt fane/spiller er ren UI-tilstand (localStorage), aldri Lovelace-config.
    static get uiPersist() { return ['tab', 'sel']; }
    static get schema() {
      return (h, c) => [...baseSchema(h, c), { type: 'gap' }]; // 47 G: Startfane = segmentet i Faner (start_tab)
    }
    // 47 G: «Tilpass media» som «Tilpass kalender» – tittel 24/600, «Nullstill» (aktiv fane) + rosa «Ferdig», ark top 52 /
    // maks 440 / radius 38 (felles MSH.overlay tilpass: true), bakteppe .5 + blur 4, portalt til ki-overlay-root.
    static get editorTitle() { return 'Tilpass media'; }
    static get editorHead() { return { reset: resetTab }; }
    get cardSize() { return 8; }
    setConfig(c) { super.setConfig(c); this._publish(); }
    // Volum-stil per bruker (ki-store media.vol_style / media.vol_style_tv): tegn på nytt når den endres (også fra andre enheter)
    connectedCallback() {
      super.connectedCallback();
      if (M.store && M.store.subscribe && !this._vsOff) this._vsOff = M.store.subscribe((d, path) => { if (!path || /^media(\.|$)/.test(String(path))) this.update(); });
    }
    disconnectedCallback() {
      super.disconnectedCallback();
      if (this._vsOff) { this._vsOff(); this._vsOff = null; }
      this._seekClose();
    }
    // 47 G: tannhjulet åpner på sist valgte fane i arket (start: Faner, Media v4 cfgTab). Fokus 'faner'/'tabs'/'start_tab' →
    // Faner; 'tv'/'musikk' → den fanen; annet fokus (f.eks. «Velg entitet») → fanen som vises nå (Fiks 17.22).
    customize(focus, opts) {
      if (focus === 'faner' || focus === 'tabs' || focus === 'start_tab') ED_TAB = 'faner';
      else if (TABS.some((t) => t[0] === focus)) ED_TAB = focus;
      else if (focus && this._R && TABS.some((t) => t[0] === this._R.tab)) ED_TAB = this._R.tab;
      return super.customize(focus, { ...(opts || {}), sheet: { css: `.sh.tp{box-shadow:0 -12px 40px ${BA(0.45)}}
        .bg{-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px)}` } });
    }
    _publish() {
      if (!this.isConnected) return;
      const b = bus(this.key);
      b.main = this;
      if (b.cfg !== this.config) { b.cfg = this.config; emit(this.key, this); }
    }
    // 36.5: startfanen via MSH.startTab (basekortet kaller apply før onOpen → __startTab); fanebytte/lukking huskes
    static get startTabSpec() { return { legacy: startLegacy, tabs: (card) => tabOrder(card.config).vis, get: (card) => bus(card.key).tab, set: (card, id) => { card.__startTab = id; } }; }
    onOpen() {
      // Hver åpning: fane = startfanen (start_tab | 'last' = sist brukte; gamle default_tab leses), første spiller.
      const b = bus(this.key), cfg = this.config, T = tabOrder(cfg).vis, P = M.mediaPlayers(this.hass, cfg);
      const dt = M.startTab ? M.startTab.value(cfg, startLegacy) : cfg.default_tab, ui = this.ui;
      let tab = this.__startTab || (dt === 'last' ? ui.tab : dt), sel = {};
      this.__startTab = null;
      if (!T.includes(tab)) tab = T.find((t) => (P[t] || []).length) || T[0];
      if (dt === 'last' && ui.sel && typeof ui.sel === 'object') sel = { ...ui.sel };
      if (tab && !sel[tab] && P[tab] && P[tab][0]) sel[tab] = P[tab][0].id;
      b.main = this; b.tab = tab; b.sel = sel;
      this.update();
      emit(this.key, this);
    }
    onClose() { if (super.onClose) super.onClose(); this._seekClose(); }
    get toasts() { return this.config.toasts !== false; }
    render() {
      const cfg = this.config, R = M.mediaResolve(this.hass, cfg, this.key), h = this.hass;
      this._R = R;
      R.P.all.forEach((p) => this.s(p.id));
      // Fiks 16.10: rosa indikator (Kontur) = eget element med indeks-/prosentbasert posisjon (--i/--n, like brede faner).
      // 47 G: fanestil/visning fra config.tabs (tabBarHTML, samme som forhåndsvisningen i «Tilpass media» → Faner).
      const head = tabBarHTML(R.order, R.tab, cfg, { style: M.tabH && M.tabH.style(cfg) });
      if (!R.p) return `<div class="mc">${head}${M.emptyState(R.P.all.length ? 'Ingen spillere i denne fanen' : 'Fant ingen mediaspillere', 'entities')}</div>`;
      const p = R.p, I = info(this, p), a = I.a;
      if (this._pid !== p.id) this._pid = p.id;
      // Chips (Fiks 21.6/23.4): TV = alltid apper (players.<obj>.apps; innganger via fjernkontrollen), Musikk = snarveier
      // (players.<obj>.presets) – config eller autokonfig. 23.4: ingen tittelrad/Apper|Innganger-bryter over chip-raden.
      const hay = [a.media_title, a.media_artist, a.media_channel, a.media_album_name, a.source].filter(Boolean).join(' | ').toLowerCase();
      let chips = [], mode = null;
      if (I.tv) {
        const apps = listOf(h, p, 'apps');
        mode = 'apps'; // 23.4: chipMode er alltid app
        chips = apps.map((x, i) => { const st = appStyle(x.source || x.name); return { k: 'app', v: i, name: x.name || x.source || '–', icon: x.icon || st.icon || 'apps', col: x.color || st.col, act: !I.off && !!(x.source || x.name) && [a.source, a.app_name].includes(x.source || x.name) }; });
      } else {
        const pr = listOf(h, p, 'presets');
        pr.forEach((x) => { if (x.type !== 'favorite' && x.type !== 'source' && x.target) this.s(x.target); });
        chips = pr.map((x, i) => {
          const nm = x.name || (x.type === 'source' || x.type === 'favorite' ? x.target : M.name(h, x.target, p.name)) || '–';
          const st = x.type !== 'source' && x.type !== 'favorite' && x.target ? h.states[x.target] : null, reg = st && M.regEntry(h, x.target);
          const ic = x.icon || (st && st.attributes.icon) || (reg && reg.icon) || appStyle(nm).icon || (x.type === 'source' ? 'mdi:import' : 'radio');
          const act = !I.off && (x.type === 'source' ? x.target === a.source : x.type === 'favorite' && x.target && x.target === a.media_content_id ? true : nm.length > 2 && hay.includes(nm.toLowerCase()));
          return { k: 'pr', v: i, name: nm, icon: ic, col: null, act };
        });
      }
      const chipHtml = chips.map((c) => {
        const bg = c.act ? (c.col || PINK) : 'var(--ki-surface, var(--gray200,#3a3a3a))';
        const fg = c.act ? (c.col ? '#fff' : 'var(--ki-on-accent, var(--gray200,#3a3a3a))') : 'var(--ki-text, var(--white,#fafafa))';
        const ic = c.act ? (c.col ? '#fff' : 'var(--ki-on-accent, var(--gray200,#3a3a3a))') : (c.col || 'var(--ki-text, var(--white,#fafafa))');
        return `<button class="chip press ${I.tv ? 'tv' : ''}" data-act="chip" data-k="${c.k}" data-v="${esc(c.v)}" data-n="${esc(c.name)}" data-key="${esc(c.k + ':' + c.v + ':' + c.name)}" style="background:${bg};color:${fg}">${M.icon(c.icon, 24, 'color:' + ic)}<span class="cn ell">${esc(c.name)}</span></button>`;
      }).join('');
      const none = I.tv ? 'apper' : 'kilder eller snarveier';
      const chipsSec = `<div class="cs">${chips.length ? `<div class="chips noscroll" data-key="chips:${mode || 'mus'}">${chipHtml}</div>` : `<div class="nochips">Ingen ${none} funnet <button class="pick press" data-act="customize" data-section="p_${esc(p.obj)}">${M.icon('add', 18)}Legg til</button></div>`}</div>`;
      // Transport (musikk)
      const sf = Number(a.supported_features) || 0, has = (f) => !sf || (sf & f) === f;
      const rep = a.repeat && a.repeat !== 'off', shuf = !!a.shuffle;
      const transport = I.tv ? '' : `<div class="tr">
        <button class="rnd ${rep ? 'on' : ''}" data-act="repeat" data-haptic="selection" title="Gjenta" ${has(262144) ? '' : 'disabled'}>${M.icon(a.repeat === 'one' ? 'mdi:repeat-once' : 'repeat', 22)}</button>
        <button class="sk" data-act="prev" data-seek="-1" ${has(16) ? '' : 'data-noskip'} title="Forrige · hold for å spole tilbake" ${has(16) || (sf & 2) ? '' : 'disabled'}>${M.icon('skip_previous', 34)}</button>
        <button class="play" data-act="play" data-haptic="medium" title="Spill/pause">${M.icon(I.run ? 'pause' : 'play_arrow', 36)}</button>
        <button class="sk" data-act="next" data-seek="1" ${has(32) ? '' : 'data-noskip'} title="Neste · hold for å spole frem" ${has(32) || (sf & 2) ? '' : 'disabled'}>${M.icon('skip_next', 34)}</button>
        <button class="rnd ${shuf ? 'on' : ''}" data-act="shuffle" data-haptic="selection" title="Tilfeldig" ${has(32768) ? '' : 'disabled'}>${M.icon('shuffle', 22)}</button>
      </div>`;
      // Fjernkontroll (TV)
      const swipe = cfg.remote_swipe !== false;
      let remote = !I.tv ? '' : `<div class="rm">
        <div class="dp ${swipe ? 'swipe' : ''}" ${swipe ? 'title="Trykk eller sveip"' : ''}>
          <button class="d du" data-act="rk" data-c="up" title="Opp">${M.icon('keyboard_arrow_up', 30)}</button>
          <button class="d dd" data-act="rk" data-c="down" title="Ned">${M.icon('keyboard_arrow_down', 30)}</button>
          <button class="d dl" data-act="rk" data-c="left" data-seek="-1" title="Venstre · hold for å spole tilbake">${M.icon('keyboard_arrow_left', 30)}</button>
          <button class="d dr" data-act="rk" data-c="right" data-seek="1" title="Høyre · hold for å spole frem">${M.icon('keyboard_arrow_right', 30)}</button>
          <button class="ok" data-act="rk" data-c="ok">OK</button>
          ${swipe ? '<span class="glow" aria-hidden="true"></span>' : ''}
        </div>
        <div class="keys">
          ${KEYS.map(([c, ic, l]) => {
            const hp = I.tv && holdPlan(h, cfg, p, c), t = hp ? `${l} · hold for ${hp.label}` : l;
            return `<button class="key ${hp ? 'hold' : ''}" data-act="rk" data-c="${c}" ${hp ? 'data-hold="1"' : ''} title="${esc(t)}" aria-label="${esc(t)}">${M.icon(ic, 24)}${hp ? '<span class="hb"></span>' : ''}</button>`;
          }).join('')}
        </div>
      </div>`;
      // Volum (Fiks 17.21/17.23): Musikk = Pille | Trinn, TV = Trinn | Knapper, bryter til høyre (MSH.volumeRow)
      const V = volInfo(this, p), VP = M.volumeRow.pref(I.tv ? 'tv' : 'musikk', cfg);
      let volume = M.volumeRow.html({ key: p.id, style: VP.style, alt: VP.alt, level: V.level, approx: V.approx, muted: V.muted, dis: V.dis || (V.noLevel && !V.btn && VP.style === 'pille') });
      // Fiks 19.4: Sirkel-fjernkontroll (players.<obj>.remote_style = 'sirkel') – erstatter styrekors/knapper og volum-raden
      if (I.tv && p.pc.remote_style === 'sirkel') {
        const hb = holdPlan(h, cfg, p, 'back'), hh = holdPlan(h, cfg, p, 'home');
        const rb = (cls, act, c, ic, t, x) => `<button class="rb ${cls}" data-act="${act}" ${c ? `data-c="${c}"` : ''} ${x || ''} title="${esc(t)}" aria-label="${esc(t)}">${M.icon(ic, 26)}</button>`;
        const vol = M.volumeRow.html({ key: p.id, style: 'knapper', alt: null, level: V.level, approx: V.approx, muted: V.muted, dis: V.dis }).split(`color:${AT(C.red)}`).join(`color:${AT(PINKC)}`);
        volume = '';
        remote = `<div class="rs">
          <div class="sp ${swipe ? 'swipe' : ''}">
            <button class="sa su" data-act="rk" data-c="up" title="Opp" aria-label="Opp">${M.icon('keyboard_arrow_up', 22)}</button>
            <button class="sa sd" data-act="rk" data-c="down" title="Ned" aria-label="Ned">${M.icon('keyboard_arrow_down', 22)}</button>
            <button class="sa sl" data-act="rk" data-c="left" data-seek="-1" title="Venstre · hold for å spole tilbake" aria-label="Venstre">${M.icon('keyboard_arrow_left', 22)}</button>
            <button class="sa sr" data-act="rk" data-c="right" data-seek="1" title="Høyre · hold for å spole frem" aria-label="Høyre">${M.icon('keyboard_arrow_right', 22)}</button>
            <button class="sok" data-act="rk" data-c="ok">OK</button>
            ${swipe ? '<span class="glow" aria-hidden="true"></span>' : ''}
          </div>
          <div class="r5">
            ${rb('pwr', 'rpower', '', 'power_settings_new', 'Av/på')}
            ${rb('bk', 'rk', 'back', 'arrow_back', hb ? `Tilbake · hold for ${hb.label}` : 'Tilbake', hb ? 'data-hold="1"' : '')}
            <button class="rb hh" data-act="rk" data-c="home" ${hh ? 'data-hh="1"' : ''} title="${esc(hh ? `Hjem · hold for ${hh.label}` : 'Hjem')}" aria-label="Hjem">${M.icon('home', 26)}${hh ? '<span class="hb"></span>' : ''}</button>
            ${rb('', 'rk', 'mic', 'mdi:microphone', 'Mikrofon')}
            ${rb('pp', 'rk', 'play', I.run ? 'pause' : 'play_arrow', 'Spill/pause')}
          </div>
          <div class="svol">${vol}</div>
        </div>`;
      }
      // Innholdsflaten under fanene: min-høyde = den høyeste av TV/Musikk (målt), så byttet ikke flytter layouten (Fiks 16.10)
      return `<div class="mc">${head}<div class="mb" style="${this._mbMin ? `min-height:${this._mbMin}px` : ''}">${chipsSec}${transport}${remote}${volume}</div></div>`;
    }
    onAction(name, el, ev) {
      const h = this.hass, R = this._R, p = R && R.p;
      if (name === 'tab') {
        // Liquid Glass: indikatoren strekker seg mens den glir (transform – ingen layout); posisjonen kommer fra --i
        const ind = this.shadowRoot.querySelector('.seg .ind');
        if (ind && ind.animate && !el.classList.contains('on') && !this._gDrag) ind.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.16, .9)', offset: 0.45 }, { transform: 'scale(1.05, 1.03)', offset: 0.75 }, { transform: 'scale(1)' }], { duration: 380, easing: 'cubic-bezier(.3,.9,.3,1)' });
        return this.select(el.dataset.t);
      }
      if (!p) return super.onAction(name, el, ev);
      const id = p.id, s = h.states[id], a = (s && s.attributes) || {};
      const mp = (svc, data) => M.call(h, 'media_player', svc, { entity_id: id, ...(data || {}) });
      switch (name) {
        case 'chip': {
          const d = el.dataset, i = Number(d.v);
          if (d.k === 'app') {
            // App: select_source med kilden; uten kilde → app-ID (remote.turn_on activity, ellers play_media app)
            const x = listOf(h, p, 'apps')[i];
            if (!x) return;
            const rem = remoteOf(h, p);
            if (x.source) mp('select_source', { source: x.source });
            else if (x.app_id && rem) M.call(h, 'remote', 'turn_on', { entity_id: rem, activity: x.app_id });
            else if (x.app_id) mp('play_media', { media_content_type: 'app', media_content_id: x.app_id });
            dbg(`${REMOTE[platOf(h, p)].hw} · Åpner ${x.name || x.source || x.app_id}`);
          } else if (d.k === 'in') {
            const x = listOf(h, p, 'inputs')[i];
            if (x && x.source) { mp('select_source', { source: x.source }); dbg(`media_player.select_source → ${id} · source: ${x.source}`); }
          } else if (d.k === 'pr') {
            const x = listOf(h, p, 'presets')[i];
            if (!x || !x.target) return;
            if (x.type === 'source') { mp('select_source', { source: x.target }); dbg(`media_player.select_source → ${id} · source: ${x.target}`); }
            else if (x.type === 'favorite') { mp('play_media', { media_content_id: x.target, media_content_type: x.content_type || 'music' }); dbg(`media_player.play_media → ${id} · ${x.target}`); }
            else { const [dm, sv] = svcFor(x.target); M.call(h, dm, sv, { entity_id: x.target }); dbg(`${dm}.${sv} → ${x.target}`); }
          }
          return;
        }
        case 'play': return mp('media_play_pause');
        // 35.8: pilene er aktive når spilleren kan spole (hold), selv om den ikke kan hoppe spor – da gjør et kort trykk ingenting
        case 'prev': return el.hasAttribute('data-noskip') ? undefined : mp('media_previous_track');
        case 'next': return el.hasAttribute('data-noskip') ? undefined : mp('media_next_track');
        case 'repeat': { const nx = { off: 'all', all: 'one', one: 'off' }[a.repeat || 'off'] || 'off'; return mp('repeat_set', { repeat: nx }); }
        case 'shuffle': return mp('shuffle_set', { shuffle: !a.shuffle });
        case 'rk': return this._remote(p, el.dataset.c, false);
        case 'rpower': return mp(!s || ['off', 'standby'].includes(s.state) ? 'turn_on' : 'turn_off');
        default:
      }
      return super.onAction(name, el, ev);
    }
    // 35.8 · spole-meny ved knappen (portalt til ki-overlay-root – Bubble-popupen har transform, fallgruve 1).
    _seekMenu(btn, dir) {
      this._seekClose();
      const p = this._R && this._R.p;
      if (!p || !btn) return;
      M.haptic('light');
      const host = document.createElement('div');
      host.className = 'msh-seek';
      host.setAttribute('data-ki-seek', dir < 0 ? 'back' : 'fwd');
      const sr = host.attachShadow({ mode: 'open' });
      sr.innerHTML = `<style>${SEEK_CSS}</style><div class="bg"></div><div class="m" role="menu" aria-label="${dir < 0 ? 'Spol tilbake' : 'Spol frem'}">${SEEK_MIN.map((m) => `<button role="menuitem" data-min="${m * dir}" aria-label="${dir < 0 ? 'Spol tilbake' : 'Spol frem'} ${m} min">${dir < 0 ? '−' : '+'}${m} min</button>`).join('')}</div>`;
      M.overlayRoot().appendChild(host);
      const menu = sr.querySelector('.m'), r = btn.getBoundingClientRect(), W = window.innerWidth;
      const mw = menu.offsetWidth || 280, mh = menu.offsetHeight || 50;
      const left = Math.max(8, Math.min(W - mw - 8, r.left + r.width / 2 - mw / 2));
      let top = r.top - mh - 10;
      if (top < 8) { top = r.bottom + 10; menu.classList.add('below'); }
      menu.style.left = left + 'px'; menu.style.top = top + 'px';
      const stop = (e) => e.stopPropagation();
      ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'touchmove'].forEach((t) => host.addEventListener(t, stop, { passive: true }));
      host.addEventListener('contextmenu', (e) => e.preventDefault());
      // Slippet etter holdet gir et klikk på bakteppet under fingeren – menyen «armeres» først 200 ms etter slipp
      const st = { armed: false };
      const arm = () => { window.removeEventListener('pointerup', arm, true); window.removeEventListener('touchend', arm, true); setTimeout(() => { st.armed = true; }, 200); };
      window.addEventListener('pointerup', arm, true); window.addEventListener('touchend', arm, true);
      host.addEventListener('click', (e) => {
        e.stopPropagation();
        const b = e.composedPath().find((n) => n.dataset && n.dataset.min != null);
        if (!b && !st.armed) return;
        if (b) this._seekBy(p, Number(b.dataset.min));
        this._seekClose();
      });
      const key = (e) => { if (e.key === 'Escape') this._seekClose(); };
      window.addEventListener('keydown', key, true);
      this._skMenu = { host, key, arm };
    }
    _seekClose() {
      const m = this._skMenu;
      if (!m) return;
      this._skMenu = null;
      window.removeEventListener('keydown', m.key, true);
      window.removeEventListener('pointerup', m.arm, true); window.removeEventListener('touchend', m.arm, true);
      m.host.remove();
    }
    // Relativ spoling: media_player.media_seek (posisjon ± min); Apple TV (plattform apple + remote.*): remote.send_command skip.
    _seekBy(p, min) {
      const h = this.hass, sec = Number(min) * 60;
      if (!h || !p || !sec) return;
      M.haptic('light');
      const lbl = `${sec < 0 ? '−' : '+'}${Math.abs(min)} min`;
      const rem = p.kind === 'tv' && platOf(h, p) === 'apple' ? remoteOf(h, p) : null;
      if (rem) {
        M.call(h, 'remote', 'send_command', { entity_id: rem, command: sec < 0 ? 'skip_backward' : 'skip_forward', num_repeats: Math.max(1, Math.round(Math.abs(sec) / APPLE_SKIP_S)), delay_secs: 0.1 });
        dbg(`Apple TV · ${lbl} · remote.send_command ${sec < 0 ? 'skip_backward' : 'skip_forward'}`);
      } else {
        const P = posOf(h.states[p.id]);
        if (!P) { M.haptic('failure'); if (this.toasts) M.toast('Spilleren oppgir ikke posisjon – kan ikke spole'); return; }
        M.call(h, 'media_player', 'media_seek', { entity_id: p.id, seek_position: Math.round(M.clamp(P.pos + sec, 0, P.dur)) });
        dbg(`media_player.media_seek → ${p.id} · ${lbl}`);
      }
      if (this.toasts) M.toast(`Spoler ${lbl}`);
    }
    // hold: plattform-standard for langt trykk (Hjem). swipe: kommandoen kom fra sveip på styreflaten.
    _remote(p, c, hold, swipe) {
      const h = this.hass, RC = REMOTE[platOf(h, p)], rem = remoteOf(h, p);
      const lbl = swipe ? `${KEYL[c]} · sveip` : hold ? `${RC.hw} · ${RC.holdLabel}` : `${RC.hw} · ${KEYL[c]}`;
      if (!rem) {
        if (c === 'play' && !hold) M.call(h, 'media_player', 'media_play_pause', { entity_id: p.id });
        dbg(`${lbl}${c === 'play' && !hold ? '' : ' · mangler remote.*'}`);
        return;
      }
      const data = { entity_id: rem, command: hold ? RC.hold.command : RC[c] };
      if (hold && RC.hold.hold_secs) data.hold_secs = RC.hold.hold_secs;
      M.call(h, 'remote', 'send_command', data);
      dbg(lbl);
    }
    // Langt trykk (≥ 450 ms) på Tilbake/Hjem/Meny: utfør knappens hold-handling.
    _holdRun(p, c) {
      const h = this.hass, hp = holdPlan(h, this.config, p, c), RC = REMOTE[platOf(h, p)];
      if (!hp) return false;
      M.haptic('medium');
      const d = hp.a ? hp.a.data || hp.a.service_data || {} : {};
      if (hp.kind === 'std') return this._remote(p, c, true), true;
      if (hp.kind === 'app') {
        if (d.source) M.call(h, 'media_player', 'select_source', { entity_id: p.id, source: d.source });
      } else if (hp.kind === 'cmd') {
        const rem = remoteOf(h, p);
        if (!rem || !d.command) { dbg(`${RC.hw} · ${hp.label} · ${rem ? 'mangler kommando' : 'mangler remote.*'}`); return true; }
        M.call(h, 'remote', 'send_command', { ...d, entity_id: rem });
      } else runAction(this, hp.a, p.id);
      dbg(`${RC.hw} · ${hp.label}`);
      return true;
    }
    // Styreflaten: glød-sirkel (52 px) følger fingeren. Posisjon via CSS-variabler på verten, så morph ikke nullstiller den.
    _glow(dp, e) {
      if (!dp || !e) { this.style.setProperty('--msh-glow-o', '0'); return; }
      const r = dp.getBoundingClientRect(), g = dp.querySelector('.glow'), o = g && g.offsetWidth ? g.offsetWidth / 2 : 26;
      this.style.setProperty('--msh-gx', (e.clientX - r.left - o).toFixed(1) + 'px');
      this.style.setProperty('--msh-gy', (e.clientY - r.top - o).toFixed(1) + 'px');
      this.style.setProperty('--msh-glow-o', '1');
    }
    afterRender() {
      const root = this.shadowRoot;
      // Innholdsflaten: mål naturlig høyde ved hver tegning og når innholdet endrer størrelse (Fiks 16.10)
      const mb = root.querySelector('.mb');
      if (mb && window.ResizeObserver) {
        if (!this._mbRO) this._mbRO = new ResizeObserver(() => this._mbMeasure());
        if (this._mbObs !== mb) { this._mbRO.disconnect(); this._mbRO.observe(mb); this._mbObs = mb; }
      }
      if (mb) requestAnimationFrame(() => this._mbMeasure());
      // Volum-raden: delegerte lyttere (MSH.volumeRow.bind), styres av _volCtl
      M.volumeRow.bind(root, (key) => this._volCtl(key));
      // Horisontal chip-liste: ikke la Bubble Card få sveipet
      const ch = root.querySelector('.chips');
      if (ch && !ch.__b) {
        ch.__b = true;
        const stop = (e) => e.stopPropagation();
        ch.addEventListener('touchstart', stop, { passive: true });
        ch.addEventListener('touchmove', stop, { passive: true });
        ch.addEventListener('pointerdown', stop);
      }
      // Hold-handlinger (Tilbake/Hjem/Meny) + sveip på styreflaten. Delegert på shadowRoot, så de overlever morph/fanebytte.
      if (!this.__hb) {
        this.__hb = true;
        const clear = () => { clearTimeout(this._ht); this._ht = null; };
        const swOn = () => this.config.remote_swipe !== false;
        root.addEventListener('pointerdown', (e) => {
          this._held = false;
          clear();
          const k = this._el(e, '.key[data-hold],.rb[data-hold]');
          if (!k || e.button) return;
          this._hx0 = e.clientX; this._hy0 = e.clientY;
          this._ht = setTimeout(() => { this._ht = null; const p = this._R && this._R.p; if (p && this._holdRun(p, k.dataset.c)) this._held = true; }, HOLD_MS);
        });
        root.addEventListener('pointermove', (e) => { if (this._ht && Math.hypot(e.clientX - this._hx0, e.clientY - this._hy0) > SW_MIN) clear(); });
        ['pointerup', 'pointercancel'].forEach((t) => root.addEventListener(t, clear));
        // Etter hold, og 60 ms etter et sveip: svelg klikket (ingen ekstra kommando/haptic ved slipp).
        root.addEventListener('click', (e) => {
          if (this._held || Date.now() - (this._swEnd || 0) < 60) { this._held = false; e.stopPropagation(); e.preventDefault(); }
        }, true);
        root.addEventListener('contextmenu', (e) => { if (this._el(e, '.key,.tab,.dp,.rs,[data-seek]')) e.preventDefault(); });
        // 35.8 · Spole-presets: hold venstre/høyre pil (500 ms) → meny −1/−2/−5/−10 min eller +1/+2/+5/+10 min (_seekMenu).
        // Flytter fingeren seg > 10 px før det, er det et sveip/trykk som før. Klikket ved slipp svelges (this._held).
        const skClear = () => { clearTimeout(this._skT); this._skT = null; };
        root.addEventListener('pointerdown', (e) => {
          const b = this._el(e, '[data-seek]');
          if (!b || b.disabled || (e.pointerType === 'mouse' && e.button)) return;
          e.stopPropagation();
          skClear();
          this._skXY = [e.clientX, e.clientY];
          this._skT = setTimeout(() => {
            this._skT = null;
            this._held = true;
            if (this._sw) { try { this._sw.dp.releasePointerCapture(this._sw.id); } catch (x) { /* */ } this._sw = null; this._glow(null); }
            this._seekMenu(b, Number(b.dataset.seek) < 0 ? -1 : 1);
          }, SEEK_HOLD_MS);
        });
        root.addEventListener('pointermove', (e) => { if (this._skT && this._skXY && Math.hypot(e.clientX - this._skXY[0], e.clientY - this._skXY[1]) > SW_MIN) skClear(); });
        ['pointerup', 'pointercancel'].forEach((t) => root.addEventListener(t, skClear));
        root.addEventListener('touchstart', (e) => { if (this._el(e, '[data-seek]')) e.stopPropagation(); }, { passive: true });
        // Sveip på D-paden: < 10 px = trykk (knappene virker som før), deretter én kommando per 34 px i dominerende
        // retning, og startpunktet nullstilles (ett langt sveip = flere steg). Bubble Card skal ikke få gesten
        // (swipe-to-close/scroll): touch-action:none på flaten + stopPropagation/preventDefault.
        root.addEventListener('pointerdown', (e) => {
          const dp = this._el(e, '.dp.swipe,.sp.swipe');
          if (!dp || !swOn() || (e.pointerType === 'mouse' && e.button)) return;
          e.stopPropagation(); e.preventDefault();
          this._sw = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, on: false, dp };
          this._glow(dp, e);
        });
        root.addEventListener('pointermove', (e) => {
          const s = this._sw;
          if (!s || e.pointerId !== s.id) return;
          e.stopPropagation(); e.preventDefault();
          this._glow(s.dp, e);
          if (!s.on) {
            if (Math.hypot(e.clientX - s.x0, e.clientY - s.y0) < SW_MIN) return;
            s.on = true;
            // Sirkel (19.4): ingen setPointerCapture – ellers når klikkene på pilene ikke frem
            if (!s.dp.classList.contains('sp')) try { s.dp.setPointerCapture(e.pointerId); } catch (x) { /* */ }
          }
          const dx = e.clientX - s.x, dy = e.clientY - s.y;
          if (Math.max(Math.abs(dx), Math.abs(dy)) < SW_STEP) return;
          const c = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
          s.x = e.clientX; s.y = e.clientY;
          const p = this._R && this._R.p;
          if (!p) return;
          M.haptic(s.dp.classList.contains('sp') ? 'light' : 'selection');
          this._remote(p, c, false, true);
        });
        const end = (e) => {
          const s = this._sw;
          if (!s || e.pointerId !== s.id) return;
          this._sw = null;
          if (s.on) { this._swEnd = Date.now(); e.stopPropagation(); }
          try { s.dp.releasePointerCapture(e.pointerId); } catch (x) { /* */ }
          this._glow(null);
        };
        root.addEventListener('pointerup', end);
        root.addEventListener('pointercancel', end);
        const tstop = (e) => { if (swOn() && this._el(e, '.dp.swipe,.sp.swipe')) { e.stopPropagation(); if (e.type === 'touchmove' && e.cancelable) e.preventDefault(); } };
        // touchstart: bare stopPropagation – preventDefault her ville fjerne klikket på pilene/OK på touch.
        root.addEventListener('touchstart', tstop, { passive: true });
        root.addEventListener('touchmove', tstop, { passive: false });
        // Sirkel (19.4): hold Hjem 550 ms – knappen fylles rosa (CSS .fill, lineær 550 ms); ferdig = plattform-/hold-handling,
        // haptic medium og klikket etterpå ignoreres. Slipp før = avbryt. touch-action none + pointer capture (i try).
        const hhStop = () => { clearTimeout(this._hhT); this._hhT = null; if (this._hhB) { this._hhB.classList.remove('fill'); this._hhB = null; } };
        root.addEventListener('pointerdown', (e) => {
          const b = this._el(e, '.rb.hh[data-hh]');
          if (!b || e.button) return;
          e.stopPropagation();
          hhStop();
          try { b.setPointerCapture(e.pointerId); } catch (x) { /* */ }
          this._hhB = b; b.classList.add('fill');
          this._hhT = setTimeout(() => { this._hhT = null; const p = this._R && this._R.p; if (p && this._holdRun(p, 'home')) this._held = true; hhStop(); }, HOME_HOLD_MS);
        });
        ['pointerup', 'pointercancel'].forEach((t) => root.addEventListener(t, hhStop));
        const hstop = (e) => { if (this._el(e, '.rb.hh')) e.stopPropagation(); };
        root.addEventListener('touchstart', hstop, { passive: true });
        root.addEventListener('touchmove', hstop, { passive: true });
      }
      // Faner: felles MSH.tabReorder – langt trykk + dra = omorganiser (lagres i config.tab_order via ki-store)
      const seg = root.querySelector('.seg');
      if (seg) M.tabReorder(seg, {
        card: this, glass: true, // Liquid Glass-drag (linse ved sideveis dra) alltid – uavhengig av temaet (Fiks 15.2)
        // Fiks 16.10: den rosa indikatoren ER glasslinsen – den følger fingeren (regnet fra sporets ferske mål hver frame),
        // snapper til nærmeste fane ved slipp og bytter først da. Ingen ekstra trykk-linse (glassTap) oppå den.
        glassTap: false,
        // 47 G: bare Kontur har indikatoren; de andre fanestilene bruker standardlinsen
        ...(seg.querySelector('.ind') ? { onGlassMove: (hit, x) => this._indDrag(seg, x), onGlassEnd: (hit) => this._indDrag(seg, null, hit) } : { onGlassMove: null, onGlassEnd: null }),
        onSelect: (k) => { const b = seg.querySelector(`.tab[data-t="${k}"]`); if (b && !b.classList.contains('on')) this.onAction('tab', b); },
        items: () => Array.from(seg.querySelectorAll('.tab')),
        idOf: (b) => b.dataset.t,
        active: () => this._R && this._R.tab,
        onReorder: (keys) => { const all = this._R ? this._R.orderAll : keys; this._save({ tab_order: [...keys, ...all.filter((x) => !keys.includes(x))] }); },
      });
    }
    // Indikatoren under glass-dra: brøkdel av sporet fra FERSKE mål (skala fra Bubble-transform tatt med), left i %.
    // x = null → slipp: tilbake til --i (satt til valgt fane straks, så den ikke glir tilbake før ny tegning).
    _indDrag(seg, x, hit) {
      const ind = seg.querySelector('.ind'), its = Array.from(seg.querySelectorAll('.tab')), n = its.length || 1;
      if (!ind) return;
      if (x == null) {
        this._gDrag = false;
        const i = hit ? its.indexOf(hit) : -1;
        if (i >= 0) seg.style.setProperty('--i', i);
        ind.classList.remove('drag');
        ind.style.left = '';
        return;
      }
      this._gDrag = true;
      const r = seg.getBoundingClientRect(), k = seg.offsetWidth ? r.width / seg.offsetWidth : 1;
      const W = seg.clientWidth - 8, g = 2, cw = (W - g * (n - 1)) / n;
      const f = Math.max(0, Math.min(n - 1, ((x - r.left) / k - seg.clientLeft - 4 - cw / 2) / (cw + g)));
      ind.classList.add('drag');
      ind.style.left = `calc(4px + (100% - 6px) * ${f.toFixed(4)} / var(--n))`;
    }
    // Mål innholdsflatens naturlige høyde per fane (uten min-høyde) → min-høyde = den høyeste (Fiks 16.10)
    _mbMeasure() {
      const mb = this.shadowRoot && this.shadowRoot.querySelector('.mb'), tab = this._R && this._R.tab;
      if (!mb || !tab || !mb.lastElementChild) return;
      const r = mb.getBoundingClientRect(), k = mb.offsetHeight ? r.height / mb.offsetHeight : 1;
      const nat = Math.round((mb.lastElementChild.getBoundingClientRect().bottom - r.top) / k);
      if (!nat) return;
      this._mbH = { ...(this._mbH || {}), [tab]: nat };
      const min = Math.max(...Object.values(this._mbH));
      if (min !== this._mbMin) { this._mbMin = min; mb.style.minHeight = min + 'px'; }
    }
    async _save(patch) {
      const old = this._rawConfig || this.config, n = { ...old, ...patch };
      this.setConfig(n);
      const r = await M.saveCardConfig(this.hass, old, n);
      if (r && r.config) this.setConfig(r.config);
    }
    // Volumkontroll for volum-raden. Mediaspiller: volume_set (±5 % / volume_step), demp = volume_mute.
    // Knapp-volum (TV, players.<obj>.volume = buttons): opp/ned/demp-entitetene (tom = media_player.volume_up/down/mute),
    // estimert nivå ±2 per kommando lagret per TV (localStorage), med mindre en sensor / volume_level gir faktisk nivå.
    _volCtl(key) {
      const R = this._R, p = R && R.p;
      if (!p || p.id !== key) return null;
      const h = this.hass, id = p.id, V = volInfo(this, p), a = ((h.states[id] || {}).attributes) || {};
      const mp = (svc, data) => M.call(h, 'media_player', svc, { entity_id: id, ...(data || {}) });
      const kind = p.kind === 'tv' ? 'tv' : 'musikk';
      const toggle = () => M.volumeRow.toggle(kind, this.config);
      if (V.btn) {
        const press = (k) => {
          const ent = p.pc['volume_' + k];
          if (ent) { const [dm, sv] = svcFor(ent); M.call(h, dm, sv, { entity_id: ent }); dbg(`${dm}.${sv} → ${ent}`); return; }
          if (k === 'mute') return mp('volume_mute', { is_volume_muted: !a.is_volume_muted });
          return mp(k === 'up' ? 'volume_up' : 'volume_down');
        };
        return {
          stepDrag: true, toggle, toasts: this.toasts,
          step: (dir) => {
            press(dir > 0 ? 'up' : 'down');
            const cur = volInfo(this, p);
            if (cur.noLevel || cur.approx) { const base = cur.level != null ? cur.level : (estLoad()[id] != null ? estLoad()[id] : null); if (base != null) { estSave(id, M.clamp(base + dir * 2, 0, 100)); this.update(); } }
          },
          mute: () => press('mute'),
          set: () => {},
        };
      }
      const st = Number(a.volume_step) > 0 ? Number(a.volume_step) * (Number(a.volume_step) <= 1 ? 100 : 1) : 5;
      return {
        stepDrag: false, toggle, toasts: this.toasts,
        set: (v) => mp('volume_set', { volume_level: Math.round(v) / 100 }),
        step: (dir) => {
          const cur = M.volumeRow.live(id, V.level);
          if (cur == null) return mp(dir > 0 ? 'volume_up' : 'volume_down');
          const nv = M.clamp(Math.round(cur + dir * st), 0, 100);
          const row = this.shadowRoot.querySelector('.mvr');
          if (row) M.volumeRow._paint(row, nv);
          M.volumeRow.mark(id, nv);
          mp('volume_set', { volume_level: nv / 100 });
        },
        mute: () => mp('volume_mute', { is_volume_muted: !a.is_volume_muted }),
      };
    }
    get styles() {
      return `
        .mc{display:flex;flex-direction:column;gap:var(--msh-gap,14px)}
        ${M.TAB_ROW_CSS || ''}
        ${tabBarCSS()}
        .mb{display:flex;flex-direction:column;gap:var(--msh-gap,14px);transition:min-height .3s cubic-bezier(.2,.8,.2,1)}
        .gear:active{transform:scale(.92)}
        [data-seek]{-webkit-touch-callout:none;user-select:none;-webkit-user-select:none}
        .sk[data-noskip]{opacity:.6}
        .cs{display:flex;flex-direction:column;gap:8px;min-width:0}
        .ttl{font-size:12px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;color:var(--ki-text-mid, var(--gray600,#7f7f7f));padding:0 4px}
        .chips{display:flex;gap:8px;overflow-x:auto;overscroll-behavior-x:contain}
        .chip{flex:none;width:88px;height:88px;border-radius:22px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:0 6px;transition:background .2s,transform .12s}
        .chip.tv{width:92px}
        .chip:active{transform:scale(.95)}
        .cn{font-size:11px;font-weight:600;max-width:100%}
        .nochips{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 10px 10px 16px;border-radius:22px;background:var(--ki-surface, var(--gray200,#3a3a3a));font-size:13px;color:var(--ki-text-mid, var(--gray700,#979797))}
        .tr{display:flex;align-items:center;justify-content:space-between;padding:6px 8px}
        .rnd{width:44px;height:44px;border-radius:22px;display:grid;place-items:center;color:var(--ki-text-mid, var(--gray600,#7f7f7f));background:transparent;transition:background .2s,color .2s}
        .rnd.on{color:${AT(PINKC)};background:${M.alpha(PINKC, 0.14)}}
        .sk{width:52px;height:52px;display:grid;place-items:center;transition:transform .12s}
        .sk:active{transform:scale(.9)}
        .play{width:76px;height:76px;border-radius:38px;background:${PINK};color:var(--ki-on-accent, var(--gray200,#3a3a3a));display:grid;place-items:center;box-shadow:0 8px 24px ${M.alpha(PINKC, 0.3)};transition:transform .12s}
        .play:active{transform:scale(.94)}
        button[disabled]{opacity:.35;cursor:default}
        .rm{display:flex;align-items:center;gap:14px}
        .dp{position:relative;width:188px;height:188px;flex:none;border-radius:94px;background:var(--ki-surface, var(--gray200,#3a3a3a));box-shadow:inset 0 0 0 1px rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.06*var(--ki-wa-k,1)),var(--ki-wa-max,1)));overflow:hidden;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
        .dp.swipe{touch-action:none}
        .glow{position:absolute;left:0;top:0;width:52px;height:52px;border-radius:26px;background:rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.14*var(--ki-wa-k,1)),var(--ki-wa-max,1)));box-shadow:0 0 24px rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.14*var(--ki-wa-k,1)),var(--ki-wa-max,1)));pointer-events:none;transform:translate(var(--msh-gx,68px),var(--msh-gy,68px));opacity:var(--msh-glow-o,0);transition:opacity .18s}
        .d{position:absolute;width:56px;height:56px;display:grid;place-items:center;color:var(--ki-text-2, var(--gray800,#afafaf))}
        .d:active{color:var(--ki-text, var(--white,#fafafa))}
        .du{left:66px;top:4px} .dd{left:66px;bottom:4px} .dl{top:66px;left:4px} .dr{top:66px;right:4px}
        .ok{position:absolute;left:59px;top:59px;width:70px;height:70px;border-radius:35px;background:var(--ki-surface-2, var(--gray300,#404040));font-size:14px;font-weight:600;transition:transform .12s}
        .ok:active{transform:scale(.92)}
        .keys{flex:1;min-width:0;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px}
        .key{position:relative;height:56px;border-radius:20px;background:var(--ki-surface, var(--gray200,#3a3a3a));display:grid;place-items:center;color:var(--ki-text-2, var(--gray800,#afafaf));-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;transition:transform .12s}
        .key:active{transform:scale(.93);color:var(--ki-text, var(--white,#fafafa))}
        .hb{position:absolute;bottom:6px;left:50%;width:14px;height:3px;margin-left:-7px;border-radius:2px;background:var(--ki-ctrl, var(--gray400,#545454))}
        /* Fiks 19.4: Sirkel-fjernkontroll – styrekors 260 px, fem runde knapper à 62 px, volumlinje 62 px */
        .rs{display:flex;flex-direction:column;align-items:center;gap:18px;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
        .sp{position:relative;width:260px;height:260px;flex:none;border-radius:50%;background:var(--ki-surface, var(--gray200,#3a3a3a));box-shadow:inset 0 0 0 1px rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.06*var(--ki-wa-k,1)),var(--ki-wa-max,1)));overflow:hidden;-webkit-touch-callout:none}
        .sp::before{content:'';position:absolute;inset:36px;border-radius:50%;box-shadow:inset 0 0 0 1.5px rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.08*var(--ki-wa-k,1)),var(--ki-wa-max,1)));pointer-events:none}
        .sp.swipe{touch-action:none}
        .sp .glow{width:28px;height:28px;border-radius:14px;background:rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.35*var(--ki-wa-k,1)),var(--ki-wa-max,1)));box-shadow:0 0 18px rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.3*var(--ki-wa-k,1)),var(--ki-wa-max,1)));z-index:2}
        .sa{position:absolute;width:60px;height:40px;display:grid;place-items:center;color:var(--ki-text-mid, var(--gray600,#7f7f7f))}
        .sa:active{color:var(--ki-text, var(--white,#fafafa))}
        .su{left:100px;top:2px} .sd{left:100px;bottom:2px}
        .sl,.sr{width:40px;height:60px;top:100px} .sl{left:2px} .sr{right:2px}
        .sok{position:absolute;left:88px;top:88px;width:84px;height:84px;border-radius:42px;background:var(--ki-surface-2, var(--gray300,#404040));color:var(--ki-text, var(--white,#fafafa));font-size:15px;font-weight:600;box-shadow:0 6px 18px rgb(0 0 0/max(var(--ki-ka-min,0),calc(0.35*var(--ki-ka-k,1)))),inset 0 1px 0 rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.06*var(--ki-wa-k,1)),var(--ki-wa-max,1)));transition:transform .12s}
        .sok:active{transform:scale(.93)}
        .r5{display:flex;justify-content:center;gap:12px;max-width:100%}
        .rb{position:relative;width:62px;flex:0 1 62px;min-width:0;aspect-ratio:1;border-radius:50%;display:grid;place-items:center;background:var(--ki-surface, var(--gray200,#3a3a3a));color:var(--ki-text-1, var(--gray1000,#e1e1e1));-webkit-touch-callout:none;transition:transform .12s}
        .rb:active{transform:scale(.93)}
        .rb.pwr{background:${VOL_PINK};color:#2a1720}
        .rb.pp{background:${PINK};color:#2a1720}
        .rb.hh{touch-action:none;transition:transform .12s,background .15s,box-shadow .15s}
        .rb.hh.fill{background:${M.alpha(PINKC, 0.45)};box-shadow:inset 0 0 0 2px ${PINKC};transition:transform .12s,background ${HOME_HOLD_MS}ms linear,box-shadow ${HOME_HOLD_MS}ms linear}
        .svol{width:100%}
        .svol .mvr{width:100%}
        .svol .mvp{height:62px;border-radius:31px}
        ${M.volumeRow.CSS}
      `;
    }
  }

  M.define('msh-media-hero-card', MediaHero, 'MSH Media · nå spilles', 'Sveipbar «nå spilles»-karusell med omslag for valgt fane. Første kort i Media-popupen.');
  M.define('msh-media-card', MediaCard, 'MSH Media', 'Faner (TV/Musikk), apper/kilder, transport eller fjernkontroll og volum for alle media_player.*');
})();
