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
 */
(function () {
  const M = window.MSH, esc = M.esc, C = M.C;
  const PINK = C.accent, PINKC = C.pink;

  /* ------------------------------------------------------------ autokonfig */
  const TV_PLAT = ['apple_tv', 'androidtv', 'androidtv_remote', 'webostv', 'samsungtv', 'braviatv', 'philips_js', 'roku', 'vizio', 'panasonic_viera', 'firetv', 'kodi', 'plex', 'jellyfin', 'emby', 'lg_thinq', 'hisense_tv', 'tizen'];
  const MUS_PLAT = ['sonos', 'squeezebox', 'slimproto', 'spotify', 'yamaha_musiccast', 'yamaha', 'denonavr', 'bluesound', 'linkplay', 'heos', 'bose', 'frontier_silicon', 'music_assistant', 'mass', 'forked_daapd', 'volumio', 'snapcast', 'openhome', 'arcam_fmj', 'onkyo', 'cambridge_audio', 'soundtouch', 'mpd', 'russound_rio', 'nad', 'marantz'];
  // Merkevarefarger/ikoner for kjente apper/kilder (stil, ikke data).
  const APPS = [[/netflix/i, '#e50914', 'movie'], [/youtube/i, '#ff0000', 'smart_display'], [/nrk/i, '#00b9f2', 'live_tv'], [/tv ?2/i, '#2b6ef2', 'tv'], [/telia/i, '#990ae3', 'smart_display'], [/plex/i, '#e5a00d', 'play_circle'],
    [/spotify/i, '#1db954', 'graphic_eq'], [/disney/i, '#113ccf', 'movie'], [/hbo|^max$/i, '#5822b4', 'movie'], [/viaplay/i, '#e3001b', 'movie'], [/prime|amazon/i, '#00a8e1', 'movie'], [/apple ?tv|tv\+/i, null, 'mdi:apple'],
    [/airplay/i, null, 'airplay'], [/hdmi/i, null, 'mdi:video-input-hdmi'], [/radio|tunein/i, null, 'radio'], [/phono|vinyl|turntable/i, null, 'album'], [/bluetooth/i, null, 'mdi:bluetooth'], [/^tv$|optical|arc|tv audio/i, null, 'tv'], [/aux|line/i, null, 'mdi:audio-input-rca']];
  const appStyle = (name) => { for (const [re, col, icon] of APPS) if (re.test(String(name || ''))) return { col, icon }; return { col: null, icon: null }; };
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
  M.mediaPlayers = function (hass, cfg, withHidden) {
    cfg = cfg || {};
    if (!hass) return { tv: [], musikk: [], all: [] };
    const aIdx = {};
    M.areas(hass).forEach((a, i) => { aIdx[a.id] = i; });
    const ids = M.applyLists(cfg, 'spillere', M.all(hass, 'media_player'));
    const out = ids.filter((id) => hass.states[id]).map((id) => {
      const s = hass.states[id], pc = pcfgOf(cfg, id), area = M.areaOf(hass, id);
      const kind = pc.type && pc.type !== 'auto' ? pc.type : autoKind(hass, id);
      return { id, obj: obj(id), kind, auto: autoKind(hass, id), area, areaName: area ? M.areaName(hass, area) : null, name: pc.name || s.attributes.friendly_name || obj(id), pc };
    }).filter((p) => (withHidden || p.kind !== 'skjul') && (!cfg.area || p.area === cfg.area));
    const ai = (p) => (p.area ? (aIdx[p.area] != null ? aIdx[p.area] : 98) : 99);
    out.sort((a, b) => ai(a) - ai(b) || a.name.localeCompare(b.name, 'nb'));
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
  };
  const tabOrder = (cfg) => {
    const k = TABS.map((t) => t[0]);
    const o = Array.isArray(cfg.tab_order) ? cfg.tab_order.filter((x) => k.includes(x)) : [];
    k.forEach((x) => { if (!o.includes(x)) o.push(x); });
    const hid = cfg.hidden_tabs || [], v = o.filter((x) => !hid.includes(x));
    return { all: o, vis: v.length ? v : o };
  };
  const remoteOf = (hass, p) => p.pc.remote || sameDevice(hass, p.id, 'remote')[0] || (hass.states['remote.' + p.obj] ? 'remote.' + p.obj : null);
  const REMOTE = {
    apple: { hw: 'Apple TV', holdLabel: 'Kontrollsenter', up: 'up', down: 'down', left: 'left', right: 'right', ok: 'select', back: 'menu', home: 'home', menu: 'top_menu', play: 'play_pause', hold: { command: 'home', hold_secs: 1 } },
    google: { hw: 'Google TV', holdLabel: 'Dashbord', up: 'DPAD_UP', down: 'DPAD_DOWN', left: 'DPAD_LEFT', right: 'DPAD_RIGHT', ok: 'DPAD_CENTER', back: 'BACK', home: 'HOME', menu: 'MENU', play: 'MEDIA_PLAY_PAUSE', hold: { command: 'KEYCODE_HOME', hold_secs: 1 } },
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

  /* ------------------------------------------------------------ volum-rad (Fiks 17.21 / 17.23) – felles hjelper
   * MSH.volumeRow – brukes av msh-media-card (TV og Musikk) og kan brukes av Rom → Media (17.4):
   *   html(o)          → HTML for raden. o: { key (unik, f.eks. entity_id), style: 'pille'|'trinn'|'knapper',
   *                      level: 0–100|null, approx (vis «≈»), muted, dis (nedtonet, «–»), alt: stilen bryteren bytter til|null }
   *   CSS              → stilene (legg i kortets styles)
   *   bind(root, ctl)  → delegerte lyttere på shadowRoot (én gang; ctl kan byttes ved hver tegning).
   *                      ctl(key) → { set(v, final), step(dir ±1), mute(), toggle(), stepDrag }
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
      const ic = volIcon(v, muted), icCol = muted ? `color:${C.red}` : '';
      const tog = o.alt ? `<button class="mvt" data-vact="toggle" title="Bytt volum-stil" aria-label="Bytt volum-stil">${M.icon(o.alt === 'trinn' ? 'mdi:equalizer' : 'mdi:dots-horizontal', 22)}</button>` : '';
      let body;
      if (o.style === 'knapper') {
        body = `<div class="mvp mvk ${dis ? 'dis' : ''}">
          <button data-vact="down" title="Volum ned" aria-label="Volum ned">${M.icon('mdi:volume-minus', 26)}</button>
          <button data-vact="mute" title="Demp" aria-label="Demp" style="${muted ? `color:${C.red}` : ''}">${M.icon('mdi:volume-off', 26)}</button>
          <button data-vact="up" title="Volum opp" aria-label="Volum opp">${M.icon('mdi:volume-plus', 26)}</button></div>`;
      } else if (o.style === 'trinn') {
        const lit = v == null ? 0 : Math.round((v / 100) * 16);
        const bars = Array.from({ length: 16 }, (_, i) => `<span class="${i < lit ? 'on' : ''}" style="height:${(28 + (i / 15) * 72).toFixed(1)}%"></span>`).join('');
        body = `<div class="mvp mvs ${dis ? 'dis' : ''}">
          <button class="mvb" data-vact="down" title="Volum ned" aria-label="Volum ned">${M.icon('mdi:minus', 22)}</button>
          <div class="mvbars" data-vdrag="bars" role="slider" aria-label="Volum" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${v == null ? '' : v}">${bars}</div>
          <button class="mvnum" data-vact="mute" title="Demp" aria-label="Demp">${M.icon(ic, 18, icCol)}<span class="num">${num}</span></button>
          <button class="mvb" data-vact="up" title="Volum opp" aria-label="Volum opp">${M.icon('mdi:plus', 22)}</button></div>`;
      } else {
        const inner = (dk) => `<div class="mvc ${dk ? 'dk' : ''}">${M.icon(ic, 22, dk ? '' : icCol)}<span>Volum</span><span class="mvn num">${v == null ? '–' : num + '%'}</span></div>`;
        body = `<div class="mvp mvl ${dis ? 'dis' : ''}" data-vdrag="pill" role="slider" aria-label="Volum" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${v == null ? '' : v}" style="--v:${v == null ? 0 : v}%">
          ${inner(false)}<div class="mvf">${inner(true)}</div></div>`;
      }
      return `<div class="mvr" data-key="mvr:${esc(key)}:${o.style}" data-vkey="${esc(key)}">${body}${tog}</div>`;
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
      let g = null, rep = null;
      const stopRep = () => { if (rep) { clearTimeout(rep.t); clearInterval(rep.i); rep = null; } };
      const fracOf = (el, x) => { const r = el.getBoundingClientRect(); return r.width ? M.clamp((x - r.left) / r.width, 0, 1) : 0; };
      root.addEventListener('pointerdown', (e) => {
        const row = inRow(e);
        if (!row || e.button) return;
        e.stopPropagation(); // Bubble Card skal ikke få gesten
        const key = row.dataset.vkey, c = root.__mvrCtl && root.__mvrCtl(key);
        if (!c) return;
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
        if (a === 'mute') { if (b.closest('.dis')) return; M.haptic('light'); return c.mute(); }
        // −/+ via tastatur (klikk uten peker): ett steg
        if ((a === 'up' || a === 'down') && e.detail === 0) { M.haptic('light'); c.step(a === 'up' ? 1 : -1); }
      });
    },
    CSS: `
      .mvr{display:flex;align-items:center;gap:8px;min-width:0}
      .mvp{position:relative;flex:1;min-width:0;height:56px;border-radius:28px;background:var(--gray200,#3a3a3a);box-shadow:inset 0 0 0 1px rgba(255,255,255,0.05);overflow:hidden;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
      .mvp.dis{opacity:.45}
      .mvl{touch-action:none;cursor:pointer}
      .mvc{position:absolute;inset:0;display:flex;align-items:center;gap:10px;padding:0 20px;font-size:15px;font-weight:500;color:var(--white,#fafafa);pointer-events:none}
      .mvc.dk{color:#2a1720}
      .mvn{margin-left:auto;font-variant-numeric:tabular-nums}
      .mvf{position:absolute;inset:0;background:${VOL_PINK};clip-path:inset(0 calc(100% - var(--v, 0%)) 0 0);pointer-events:none}
      .mvs{display:flex;align-items:center;gap:8px;padding:0 6px}
      .mvb{width:44px;height:44px;border-radius:22px;flex:none;display:grid;place-items:center;background:var(--gray100,#2f2f2f);color:var(--white,#fafafa);transition:transform .12s} /* 18.9: spor = kortfarge #3a3a3a, knapper/inaktive trinn #2f2f2f */
      .mvb:active{transform:scale(.9)}
      .mvbars{flex:1;min-width:0;height:30px;display:flex;align-items:flex-end;gap:3px;touch-action:none;cursor:pointer;padding:0 2px}
      .mvbars span{flex:1;min-width:2px;border-radius:2px;background:var(--gray100,#2f2f2f);transition:background .12s}
      .mvbars span.on{background:${C.pink}}
      .mvnum{flex:none;height:44px;min-width:56px;padding:0 4px;display:flex;align-items:center;justify-content:center;gap:3px;font-size:15px;font-weight:500;color:var(--white,#fafafa);font-variant-numeric:tabular-nums}
      .mvk{display:grid;grid-template-columns:repeat(3,minmax(0,1fr))}
      .mvk button{height:100%;display:grid;place-items:center;color:var(--white,#fafafa);transition:background .15s}
      .mvk button:active{background:rgba(255,255,255,0.08)}
      .mvt{width:44px;height:44px;border-radius:22px;flex:none;display:grid;place-items:center;background:var(--gray200,#3a3a3a);box-shadow:inset 0 0 0 1px rgba(255,255,255,0.12);color:var(--gray800,#afafaf);transition:transform .12s}
      .mvt:active{transform:scale(.9)}
    `,
  };
  const CARD_H = 248; // Fiks 17.24: fast høyde for alle kort i karusellen (config.card_height 200–320)
  // Faktisk TV-volum ved knapp-volum: players.<obj>.volume_sensor, ellers sensor.*_volume på samme enhet / sensor.<obj>_volume
  const volSensor = (hass, p) => {
    if (!hass) return null;
    const d = sameDevice(hass, p.id, 'sensor').find((x) => /_volume(_level)?$/.test(x));
    return d || (hass.states['sensor.' + p.obj + '_volume'] ? 'sensor.' + p.obj + '_volume' : null);
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
    const app = tv ? (a.app_name || a.source || '') : (a.media_channel || a.source || a.app_name || '');
    const st = appStyle(app);
    let title, artist;
    if (off) { title = s && s.state === 'unavailable' ? 'Utilgjengelig' : 'Av'; artist = p.name; }
    else if (tv) { title = a.media_title || app || (s.state === 'idle' ? 'Hjem' : '–'); artist = [a.media_series_title, a.media_channel, a.media_artist].filter(Boolean).join(' · ') || (a.media_title ? app : '') || p.name; }
    else {
      title = a.media_title ? (a.media_artist ? `${a.media_artist} – ${a.media_title}` : a.media_title) : (a.source || (s.state === 'idle' ? 'Klar' : '–'));
      artist = a.media_channel || a.media_album_name || a.source || p.name;
    }
    const pic0 = a.entity_picture_local || a.entity_picture || '';
    const pic = pic0 ? (pic0[0] === '/' && hass.hassUrl ? hass.hassUrl(pic0) : pic0) : '';
    const icon = p.pc.icon || a.icon || (tv ? 'tv' : a.device_class === 'receiver' ? 'speaker' : /radio/i.test(p.id + p.name) ? 'radio' : 'speaker');
    return {
      s, a, off, run, tv, app, title, artist, pic, icon,
      label: app ? `${p.name} · ${app}` : p.name,
      col: tv ? st.col : null,
      artIcon: tv ? (st.icon || 'apps') : (appStyle(a.source).icon || 'music_note'),
    };
  }

  // Fiks 17.22: editoren viser én fane om gangen (TV | Musikk). Valgt fane er UI-tilstand for editoren (ikke config).
  let ED_TAB = 'tv';
  const tabOf = (p) => (p.kind === 'skjul' ? p.auto : p.kind);
  // Fane-segment + rekkefølge-kort for valgt fane → config.order.<fane> = [id …], config.hidden = { id: true }
  const orderField = () => ({
    type: 'html',
    click: (d, ed) => { if (d.t && d.t !== ED_TAB) { ED_TAB = d.t; M.haptic('selection'); ed._render(); } },
    html: (h, c, key) => {
      const P = h ? M.mediaPlayers(h, c, true) : { tv: [], musikk: [] }, L = P[ED_TAB] || [];
      const hid = c.hidden && typeof c.hidden === 'object' ? c.hidden : {}, ids = L.map((p) => p.id), vis = L.filter((p) => !hid[p.id]).length;
      const seg = `<div class="chips sg" role="tablist" style="display:grid;grid-template-columns:1fr 1fr">${TABS.map(([k, l]) => `<button class="chip ${k === ED_TAB ? 'on' : ''}" style="justify-content:center" role="tab" aria-selected="${k === ED_TAB}" data-a="fn" data-k="${key}" data-t="${k}">${M.icon(k === 'tv' ? 'mdi:television' : 'mdi:music', 18)}${l}</button>`).join('')}</div>`;
      const row = (p, i) => {
        const off = !!hid[p.id], last = !off && vis <= 1, nh = { ...hid };
        if (off) delete nh[p.id]; else nh[p.id] = true;
        const num = `<span style="width:24px;height:24px;border-radius:12px;flex:none;display:grid;place-items:center;font-size:12px;font-weight:600;${i === 0 ? `background:${PINK};color:#2a1720` : 'background:#404040;color:#c7c7c7'}">${i + 1}</span>`;
        const ic = p.pc.icon || (p.kind === 'tv' ? 'mdi:television' : 'mdi:speaker');
        return `<div class="ent ${off ? 'off' : ''}" data-key="mo-${esc(p.id)}">${num}${M.icon(ic, 20, 'color:#afafaf')}<span class="nm"><b>${esc(p.name)}</b><i>${i === 0 ? 'Vises først · ' : ''}${esc(p.id)}</i></span>
          <button class="ib" data-a="mv" data-name="order.${ED_TAB}" data-ord="${esc(ids.join(','))}" data-i="${i}" data-d="-1" title="Flytt opp" ${i ? '' : 'disabled style="opacity:.3"'}>${M.icon('mdi:chevron-up', 20)}</button>
          <button class="ib" data-a="mv" data-name="order.${ED_TAB}" data-ord="${esc(ids.join(','))}" data-i="${i}" data-d="1" title="Flytt ned" ${i < L.length - 1 ? '' : 'disabled style="opacity:.3"'}>${M.icon('mdi:chevron-down', 20)}</button>
          <button class="ib" data-a="sel" data-name="hidden" data-json="1" data-v="${esc(JSON.stringify(Object.keys(nh).length ? nh : null))}" title="${off ? 'Vis' : last ? 'Minst én spiller må vises' : 'Skjul'}" ${last ? 'disabled style="opacity:.3"' : ''}>${M.icon(off ? 'mdi:eye-off' : 'mdi:eye', 18)}</button></div>`;
      };
      const tl = ED_TAB === 'tv' ? 'TV-er' : 'musikkspillere';
      return `<div class="f" style="background:transparent;padding:0">${seg}</div>
        <div class="sec" style="display:flex;flex-direction:column;gap:6px;padding:12px"><div class="line" style="padding:2px 4px 4px">${M.icon('mdi:sort', 20)}<span style="flex:1;font-size:14px;font-weight:500">Rekkefølge</span><span class="small">${L.length} ${tl}</span></div>
          ${L.length ? L.map(row).join('') : `<div class="small" style="padding:4px">Ingen ${tl} funnet</div>`}
          <div class="small" style="padding:2px 4px">Nr. 1 vises når fanen åpnes. Øye = vis/skjul i karusellen, piler = rekkefølge.</div></div>`;
    },
  });

  const baseSchema = (h, c, common) => {
    c = c || {};
    const P = h ? M.mediaPlayers(h, c, true).all : [], tab = ED_TAB;
    return [
      orderField(),
      ...P.filter((p) => tabOf(p) === tab).map((p) => {
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
            { type: 'text', name: b + '.hide_sources', label: 'Skjul apper (kommaseparert)', placeholder: 'f.eks. HDMI 1, Innstillinger' },
            { type: 'entity', name: b + '.volume_sensor', label: 'Volum-sensor (faktisk nivå)', domains: ['sensor'], auto: () => volSensor(h, p), help: 'Brukes i stedet for estimert nivå ved knapp-volum' },
            { type: 'entities', name: b + '.watch', label: 'Skjermtid i dag (sensor, første brukes i kortet)', domain: 'sensor' },
          );
        } else {
          const auto = autoShortcuts(h, p);
          fields.push(
            { type: 'entities', name: b + '.shortcuts', label: 'Snarveier (button/script/scene)', domains: ['button', 'input_button', 'script', 'scene'], help: `Tom = knapper på samme enhet (${auto.length} funnet)` },
            { type: 'text', name: b + '.chip_title', label: 'Tittel over snarveier', placeholder: 'Radio / Kilde' },
            { type: 'text', name: b + '.hide_sources', label: 'Skjul kilder (kommaseparert)', placeholder: 'f.eks. Bluetooth, USB' },
          );
        }
        return { type: 'section', id: 'p_' + p.obj, icon: tv ? 'mdi:television' : 'mdi:speaker', label: `${p.name} · ${p.kind === 'skjul' ? 'skjult' : tv ? 'TV' : 'Musikk'}${p.areaName ? ' · ' + p.areaName : ''}`, fields };
      }),
      { type: 'info', label: 'Felles for begge faner' },
      ...(common || []),
      { type: 'order', name: 'tab_order', hiddenName: 'hidden_tabs', label: 'Faner (rekkefølge / skjul)', options: TABS },
      { type: 'lists', label: 'Mediaspillere', lists: (hh) => [{ key: 'spillere', label: 'Mediaspillere', ids: M.all(hh, 'media_player'), domains: ['media_player'] }] },
      { type: 'area', name: 'area', label: 'Begrens til område', help: 'Tomt = alle media_player.* i huset, sortert per område' },
      { type: 'range', name: 'card_height', label: 'Kortets høyde (TV og Musikk)', min: 200, max: 320, step: 4, default: CARD_H, unit: 'px' },
      { type: 'select', name: 'vol_style', label: 'Volum-stil · Musikk', options: [['pille', 'Pille'], ['trinn', 'Trinn'], ['user', 'La brukeren bytte']], default: 'user' },
      { type: 'select', name: 'vol_style_tv', label: 'Volum-stil · TV', options: [['trinn', 'Trinn'], ['knapper', 'Knapper'], ['user', 'La brukeren bytte']], default: 'user' },
      { type: 'boolean', name: 'remote_swipe', label: 'Sveip på styreflaten', default: true, help: 'Dra på fjernkontrollens runde flate for Opp/Ned/Venstre/Høyre (én kommando per 34 px)' },
      { type: 'boolean', name: 'toasts', label: 'Bekreftelsesmeldinger', default: true },
    ];
  };

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
      const cfg = this.eff, R = M.mediaResolve(this.hass, cfg, this.key);
      this._R = R;
      R.P.all.forEach((p) => this.s(p.id));
      const hgt = M.clamp(Number(cfg.card_height) || CARD_H, 200, 320);
      if (!R.L.length) {
        const txt = R.P.all.length ? `Ingen ${R.tab === 'tv' ? 'TV-er' : 'musikkspillere'}` : 'Fant ingen mediaspillere';
        return `<div class="wrap"><div class="sw noscroll" style="--mh:${hgt}px"><section class="pc off" data-key="_none" style="background:linear-gradient(150deg, #343434, #2f2f2f)">
          <div class="top"><span class="pl">${M.icon('speaker', 16)}<span class="ell">–</span></span></div>
          <div class="mid"><div class="art" style="background:var(--gray300,#404040);color:var(--gray600,#7f7f7f)">${M.icon('music_note', 36)}</div>
            <div class="tt"><div class="ti">–</div><span class="ar ell">${esc(txt)}</span></div>
            <button class="pw press" data-act="customize" data-section="entities" title="Velg entitet">${M.icon('add', 20)}</button></div>
          <div class="bot"></div>
        </section></div><div class="dots"><span class="dot on"></span></div></div>`;
      }
      const cards = R.L.map((p) => this._card(p)).join('');
      const dots = R.L.map((p, j) => `<button class="dot ${j === R.i ? 'on' : ''}" data-act="dot" data-i="${j}" data-haptic="selection" data-key="${esc(p.id)}" title="${esc(p.name)}"></button>`).join('');
      return `<div class="wrap"><div class="sw noscroll" style="--mh:${hgt}px">${cards}</div><div class="dots">${dots}</div></div>`;
    }
    // Ett kort i karusellen: samme oppbygning for Musikk og TV (topplinje · omslag/app-flis + tittel + chips · fremdrift)
    _card(p) {
      const h = this.hass, I = info(this, p), a = I.a, s = I.s, tv = I.tv, V = volInfo(this, p);
      const col = tv ? (I.col || fallbackCol(p.id)) : (artColor(I.pic, () => this.update()) || fallbackCol(p.id));
      const bg = I.off ? 'linear-gradient(150deg, #343434, #2f2f2f)' : `linear-gradient(150deg, color-mix(in srgb, ${col} ${tv ? 20 : 22}%, #343434), #343434 55%, #2f2f2f)`;
      const eq = [0, 1, 2, 3].map((k) => `<span style="animation-duration:${(0.7 + (k % 3) * 0.18).toFixed(2)}s;animation-delay:${(k * 0.12).toFixed(2)}s"></span>`).join('');
      const src = I.off ? '' : tv ? I.app : (a.source || a.app_name || a.media_channel || '');
      const top = `<div class="top"><span class="pl">${M.icon(p.pc.icon || (tv ? 'tv' : I.icon), 16)}<span class="ell">${esc(p.name)}</span></span>${src ? `<span class="src ell">${esc(src)}</span>` : ''}${I.off ? '' : `<span class="eq">${eq}</span>`}
        <button class="pw press" data-act="power" data-id="${esc(p.id)}" title="Av/på">${M.icon('power_settings_new', 18)}</button></div>`;
      // Tittel + undertittel
      let title, sub, live = false;
      if (I.off) { title = I.title; sub = p.areaName || ''; }
      else if (tv) {
        title = a.media_title || I.app || (s.state === 'idle' ? 'Hjem' : '–');
        const se = a.media_season != null && a.media_season !== '' ? `Sesong ${a.media_season}${a.media_episode != null && a.media_episode !== '' ? ' · episode ' + a.media_episode : ''}` : (a.media_episode ? 'Episode ' + a.media_episode : '');
        live = a.media_content_type === 'channel';
        sub = [a.media_series_title, se, a.media_channel].filter(Boolean).join(' · ');
        if (live && !/direkte/i.test(sub)) sub = [sub || a.media_channel || I.app, 'direkte'].filter(Boolean).join(' · ');
        if (!sub && a.media_title) sub = I.app;
        live = live || /direkte/i.test(sub);
      } else {
        title = a.media_title || a.source || (s.state === 'idle' ? 'Klar' : '–');
        sub = a.media_title ? [a.media_artist, a.media_album_name || a.media_channel].filter(Boolean).join(' · ') : (a.media_channel || '');
      }
      // Omslag / app-flis
      const shadow = I.off ? '' : `box-shadow:0 10px 26px color-mix(in srgb, ${col} 38%, transparent);`;
      const tile = I.off ? 'background:var(--gray300,#404040);color:var(--gray600,#7f7f7f)' : tv ? `background:${col};color:#fff` : `background:linear-gradient(145deg, ${col}, color-mix(in srgb, ${col} 45%, #2f2f2f));color:#fff`;
      const pic = tv ? (a.app_icon ? (a.app_icon[0] === '/' && h.hassUrl ? h.hassUrl(a.app_icon) : a.app_icon) : I.pic) : I.pic;
      const art = `<div class="art" style="${tile};${shadow}">${pic ? `<img src="${esc(pic)}" alt="" data-key="img">` : M.icon(tv ? (appStyle(I.app).icon || 'tv') : I.artIcon, 36)}</div>`;
      // Chips (skjules når verdien mangler – aldri mock)
      const ch = [];
      const chip = (ic, txt, act, id) => (act ? `<button class="ch press" data-act="${act}" data-id="${esc(id)}" data-key="ch-${esc(txt)}">` : `<span class="ch" data-key="ch-${esc(txt)}">`) + `${M.icon(ic, 13)}<span class="ell">${esc(txt)}</span>` + (act ? '</button>' : '</span>');
      if (!I.off) {
        if (V.muted) ch.push(chip('mdi:volume-off', 'Dempet'));
        else if (V.level != null) ch.push(chip(volIcon(V.level, false), `${V.approx ? '≈' : ''}${V.level} %`));
        if (tv) {
          if (a.source && a.app_name && a.source !== a.app_name) ch.push(chip(appStyle(a.source).icon || 'mdi:video-input-hdmi', a.source));
          const w = (Array.isArray(p.pc.watch) ? p.pc.watch : []).filter(Boolean)[0];
          if (w) { this.s(w); const st = screenTime(h, w); if (st) ch.push(chip('mdi:timer-outline', st)); }
        } else {
          const gm = Array.isArray(a.group_members) ? a.group_members.filter((x) => x !== p.id) : [];
          if (gm.length) ch.push(chip('mdi:speaker-multiple', `+ ${M.name(h, gm[0])}${gm.length > 1 ? ' +' + (gm.length - 1) : ''}`, 'group', p.id));
          const sn = a.source || a.app_name, br = a.bitrate || a.media_bitrate;
          if (sn) ch.push(chip(appStyle(sn).icon || 'mdi:music-circle-outline', [sn, br ? `${br} kbps` : ''].filter(Boolean).join(' · ')));
        }
      }
      const mid = `<div class="mid">${art}<div class="tt"><div class="ti">${esc(title)}</div>${sub ? `<span class="ar ell">${esc(sub)}</span>` : ''}${ch.length ? `<div class="chs">${ch.join('')}</div>` : ''}</div></div>`;
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
          bot = `${bar(PINK)}<div class="tm"><span class="t0">${fmtT(P.pos)}</span><span class="nx ell">${Math.max(0, Math.ceil((P.dur - P.pos) / 60))} min igjen</span><span class="t1">${fmtT(P.dur)}</span></div>`;
        } else if (!tv && P) {
          const pl = nxt ? `Neste: ${nxt}` : '';
          bot = `${bar(PINK)}<div class="tm"><span class="t0">${fmtT(P.pos)}</span><span class="nx ell">${esc(pl)}</span><span class="t1">${fmtT(P.dur)}</span></div>`;
        } else if (!tv && (a.media_title || a.media_channel) && ['playing', 'paused', 'buffering'].includes(s.state)) {
          // Radio / direkte: neste snarvei i listen
          const sc = Array.isArray(p.pc.shortcuts) && p.pc.shortcuts.length ? p.pc.shortcuts : autoShortcuts(h, p);
          const hay = [a.media_title, a.media_artist, a.media_channel, a.media_album_name, a.source].filter(Boolean).join(' | ').toLowerCase();
          const nm = sc.map((id) => M.name(h, id, p.name)), cur = nm.findIndex((n) => n.length > 2 && hay.includes(n.toLowerCase()));
          const nx = cur >= 0 && nm.length > 1 ? nm[(cur + 1) % nm.length] : '';
          bot = `<div class="lrow">${liveTag}${nx ? `<span class="nx ell">Neste: ${esc(nx)}</span>` : ''}</div>`;
        }
      }
      return `<section class="pc ${I.off ? 'off' : ''} ${I.run ? 'run' : ''} ${tv ? 'tv' : 'mus'}" data-key="${esc(p.id)}" data-ent="${esc(p.id)}" style="background:${bg}">
        ${top}${mid}<div class="bot">${bot}</div></section>`;
    }
    onAction(name, el, ev) {
      if (name === 'power') {
        const s = this.hass.states[el.dataset.id];
        const off = !s || ['off', 'standby'].includes(s.state);
        return M.call(this.hass, 'media_player', off ? 'turn_on' : 'turn_off', { entity_id: el.dataset.id });
      }
      if (name === 'group') return M.moreInfo(this, el.dataset.id);
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
        /* Fiks 17.24: fast høyde for alle kort (TV og Musikk), innhold fordelt med space-between */
        .pc{flex:none;width:100%;height:var(--mh,${CARD_H}px);box-sizing:border-box;overflow:hidden;scroll-snap-align:start;display:flex;flex-direction:column;justify-content:space-between;gap:10px;padding:18px;border-radius:28px;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.05);min-width:0;transition:background .5s}
        .pc.off .mid,.pc.off .top .pl,.pc.off .top .src{opacity:.6}
        .top{display:flex;align-items:center;gap:8px;min-width:0;height:36px;flex:none}
        .pl{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 11px 0 9px;border-radius:14px;background:rgba(255,255,255,0.08);font-size:12px;font-weight:500;color:var(--white,#fafafa);min-width:0;max-width:55%;flex:none}
        .pl .ell{min-width:0}
        .src{font-size:12px;color:var(--gray700,#979797);min-width:0;flex:0 1 auto}
        .eq{display:flex;gap:2px;align-items:flex-end;height:10px;flex:none}
        .eq span{width:2px;height:10px;border-radius:1px;background:var(--gray700,#979797);transform-origin:bottom;transform:scaleY(.3)}
        .run .eq span{animation-name:eq;animation-timing-function:ease-in-out;animation-iteration-count:infinite}
        .pw{margin-left:auto;width:36px;height:36px;border-radius:18px;flex:none;display:grid;place-items:center;background:rgba(255,255,255,0.08);color:var(--white,#fafafa)}
        .off .pw{background:${M.alpha(C.red, 0.2)};color:${C.red}}
        .mid{display:flex;gap:14px;align-items:center;min-width:0}
        .art{width:84px;height:84px;flex:none;border-radius:18px;display:grid;place-items:center;overflow:hidden}
        .art img{width:100%;height:100%;object-fit:cover;display:block}
        .tt{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
        /* Fiks 17.22: tittel inntil 2 linjer uten rulling */
        .ti{font-size:19px;font-weight:600;line-height:1.22;letter-spacing:-0.01em;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}
        .ar{font-size:14px;color:var(--gray800,#afafaf)}
        .chs{display:flex;gap:4px;overflow:hidden;margin-top:5px;min-width:0}
        .ch{flex:0 1 auto;min-width:0;max-width:100%;height:22px;display:inline-flex;align-items:center;gap:4px;padding:0 8px;border-radius:11px;background:rgba(255,255,255,0.07);font-size:11px;color:var(--gray900,#c7c7c7);white-space:nowrap}
        .ch:first-child{flex:none}
        .ch .ell{min-width:0}
        .bot{display:flex;flex-direction:column;gap:7px;min-width:0;min-height:0}
        .bot:empty{display:none}
        .pg{padding:8px 0;margin:-8px 0}
        .pg.sk{cursor:pointer;touch-action:none}
        .pgt{height:4px;border-radius:2px;background:rgba(255,255,255,0.12);overflow:hidden}
        .pgf{height:100%;border-radius:2px}
        .tm{display:flex;align-items:center;gap:10px;font-size:11px;color:var(--gray700,#979797);font-variant-numeric:tabular-nums}
        .tm .nx{flex:1;min-width:0;text-align:center;color:var(--gray600,#7f7f7f)}
        .lrow{display:flex;align-items:center;gap:10px;font-size:12px;color:var(--gray700,#979797);min-width:0}
        .lrow .nx{flex:1;min-width:0}
        .lrow .end{flex:none;color:var(--gray600,#7f7f7f);font-variant-numeric:tabular-nums}
        .live{display:inline-flex;align-items:center;gap:5px;height:22px;padding:0 9px;border-radius:11px;background:${M.alpha(C.red, 0.16)};color:${C.red};font-size:11px;font-weight:600;letter-spacing:.06em;flex:none}
        .live i{width:6px;height:6px;border-radius:3px;background:currentColor;animation:mhlive 1.6s ease-in-out infinite}
        .dots{display:flex;justify-content:center;gap:6px;height:10px;align-items:center}
        .dot{width:6px;height:6px;border-radius:3px;background:var(--gray400,#545454);transition:all .25s;flex:none}
        .dot.on{width:18px;background:var(--white,#fafafa)}
      `;
    }
  }

  /* ============================================================ hovedkort */
  const KEYS = [['back', 'arrow_back', 'Tilbake'], ['home', 'home', 'Hjem'], ['menu', 'menu', 'Meny'], ['play', 'play_pause', 'Spill/pause']];
  const KEYL = { up: 'Opp', down: 'Ned', left: 'Venstre', right: 'Høyre', ok: 'OK', back: 'Tilbake', home: 'Hjem', menu: 'Meny', play: 'Spill/pause' };
  class MediaCard extends MediaBase {
    static get cardName() { return 'Media'; }
    static get defaults() { return { default_tab: 'tv' }; }
    // Valgt fane/spiller er ren UI-tilstand (localStorage), aldri Lovelace-config.
    static get uiPersist() { return ['tab', 'sel']; }
    static get schema() {
      return (h, c) => [
        ...baseSchema(h, c, [{ type: 'select', name: 'default_tab', label: 'Fane ved åpning', options: [['tv', 'TV'], ['musikk', 'Musikk'], ['last', 'Sist brukt']], default: 'tv', help: 'Velges hver gang popupen åpnes' }]), { type: 'gap' },
      ];
    }
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
    }
    // Oppsett åpnes på fanen som vises nå (Fiks 17.22)
    customize(focus, opts) {
      if (this._R && TABS.some((t) => t[0] === this._R.tab)) ED_TAB = this._R.tab;
      return super.customize(focus, opts);
    }
    _publish() {
      if (!this.isConnected) return;
      const b = bus(this.key);
      b.main = this;
      if (b.cfg !== this.config) { b.cfg = this.config; emit(this.key, this); }
    }
    onOpen() {
      // Hver åpning: fane = default_tab (tv | musikk | last = sist brukt fra UI-tilstanden), første spiller.
      const b = bus(this.key), cfg = this.config, T = tabOrder(cfg).vis, P = M.mediaPlayers(this.hass, cfg);
      const dt = cfg.default_tab || 'tv', ui = this.ui;
      let tab = dt === 'last' ? ui.tab : dt, sel = {};
      if (!T.includes(tab)) tab = dt === 'last' ? null : (T.find((t) => (P[t] || []).length) || T[0]);
      if (dt === 'last' && ui.sel && typeof ui.sel === 'object') sel = { ...ui.sel };
      if (tab && !sel[tab] && P[tab] && P[tab][0]) sel[tab] = P[tab][0].id;
      b.main = this; b.tab = tab; b.sel = sel;
      this.update();
      emit(this.key, this);
    }
    get toasts() { return this.config.toasts !== false; }
    render() {
      const cfg = this.config, R = M.mediaResolve(this.hass, cfg, this.key), h = this.hass;
      this._R = R;
      R.P.all.forEach((p) => this.s(p.id));
      const tabs = R.order.map((k) => `<button class="tab ${k === R.tab ? 'on' : ''}" role="tab" aria-selected="${k === R.tab}" data-act="tab" data-t="${k}" data-haptic="selection" data-key="${k}">${esc(TABS.find((t) => t[0] === k)[1])}</button>`).join('');
      // Fiks 16.10: rosa indikator = eget element med indeks-/prosentbasert posisjon (--i/--n, like brede faner) – aldri
      // piksler fra et gammelt mål, så den lander riktig selv om innholdet under endrer høyde eller popupen scroller.
      const ti = Math.max(0, R.order.indexOf(R.tab));
      const head = `<div class="tabs"><span></span><div class="seg msh-tr" data-gd-skip style="--n:${R.order.length || 1};--i:${ti}"><span class="ind ${R.order.includes(R.tab) ? '' : 'off'}" data-key="ind" aria-hidden="true"></span>${tabs}</div><button class="gear press" data-act="customize" title="Oppsett">${M.icon('settings', 22)}</button></div>`;
      if (!R.p) return `<div class="mc">${head}${M.emptyState(R.P.all.length ? 'Ingen spillere i denne fanen' : 'Fant ingen mediaspillere', 'entities')}</div>`;
      const p = R.p, I = info(this, p), a = I.a;
      if (this._pid !== p.id) this._pid = p.id;
      // Chips: apper (TV) / snarveier + kilder (musikk)
      const hide = String(p.pc.hide_sources || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
      const src = (Array.isArray(a.source_list) ? a.source_list : []).filter((x) => !hide.includes(String(x).toLowerCase()));
      const hay = [a.media_title, a.media_artist, a.media_channel, a.media_album_name, a.source].filter(Boolean).join(' | ').toLowerCase();
      let chips = [], title;
      const pl = platOf(h, p), RC = REMOTE[pl];
      if (I.tv) {
        chips = src.map((n) => { const st = appStyle(n); return { k: 'src', v: n, name: n, icon: st.icon || 'apps', col: st.col, act: !I.off && (n === a.source || n === a.app_name) }; });
        title = `Apper · ${RC.hw}`;
      } else {
        const sc = Array.isArray(p.pc.shortcuts) && p.pc.shortcuts.length ? p.pc.shortcuts : autoShortcuts(h, p);
        sc.forEach((id) => this.s(id));
        const scC = sc.map((id) => {
          const nm = M.name(h, id, p.name), st = this.hass.states[id], reg = M.regEntry(h, id);
          const ic = (st && st.attributes.icon) || (reg && reg.icon) || appStyle(nm).icon || 'radio';
          return { k: 'sc', v: id, name: nm, icon: ic, col: null, act: !I.off && nm.length > 2 && hay.includes(nm.toLowerCase()) };
        });
        const srcC = src.map((n) => ({ k: 'src', v: n, name: n, icon: appStyle(n).icon || 'mdi:import', col: null, act: !I.off && n === a.source }));
        chips = scC.concat(srcC);
        title = p.pc.chip_title || (scC.length && !srcC.length ? 'Radio' : 'Kilde');
      }
      const chipHtml = chips.map((c) => {
        const bg = c.act ? (c.col || PINK) : 'var(--gray200,#3a3a3a)';
        const fg = c.act ? (c.col ? '#fff' : 'var(--gray200,#3a3a3a)') : 'var(--white,#fafafa)';
        const ic = c.act ? (c.col ? '#fff' : 'var(--gray200,#3a3a3a)') : (c.col || 'var(--white,#fafafa)');
        return `<button class="chip press ${I.tv ? 'tv' : ''}" data-act="chip" data-k="${c.k}" data-v="${esc(c.v)}" data-n="${esc(c.name)}" data-key="${esc(c.k + ':' + c.v)}" style="background:${bg};color:${fg}">${M.icon(c.icon, 24, 'color:' + ic)}<span class="cn ell">${esc(c.name)}</span></button>`;
      }).join('');
      const chipsSec = `<div class="cs"><span class="ttl">${esc(title)}</span>
        ${chips.length ? `<div class="chips noscroll">${chipHtml}</div>` : `<div class="nochips">Ingen ${I.tv ? 'apper' : 'kilder eller snarveier'} funnet <button class="pick press" data-act="customize" data-section="p_${esc(p.obj)}">${M.icon('add', 18)}Legg til</button></div>`}</div>`;
      // Transport (musikk)
      const sf = Number(a.supported_features) || 0, has = (f) => !sf || (sf & f) === f;
      const rep = a.repeat && a.repeat !== 'off', shuf = !!a.shuffle;
      const transport = I.tv ? '' : `<div class="tr">
        <button class="rnd ${rep ? 'on' : ''}" data-act="repeat" data-haptic="selection" title="Gjenta" ${has(262144) ? '' : 'disabled'}>${M.icon(a.repeat === 'one' ? 'mdi:repeat-once' : 'repeat', 22)}</button>
        <button class="sk" data-act="prev" title="Forrige" ${has(16) ? '' : 'disabled'}>${M.icon('skip_previous', 34)}</button>
        <button class="play" data-act="play" data-haptic="medium" title="Spill/pause">${M.icon(I.run ? 'pause' : 'play_arrow', 36)}</button>
        <button class="sk" data-act="next" title="Neste" ${has(32) ? '' : 'disabled'}>${M.icon('skip_next', 34)}</button>
        <button class="rnd ${shuf ? 'on' : ''}" data-act="shuffle" data-haptic="selection" title="Tilfeldig" ${has(32768) ? '' : 'disabled'}>${M.icon('shuffle', 22)}</button>
      </div>`;
      // Fjernkontroll (TV)
      const swipe = cfg.remote_swipe !== false;
      const remote = !I.tv ? '' : `<div class="rm">
        <div class="dp ${swipe ? 'swipe' : ''}" ${swipe ? 'title="Trykk eller sveip"' : ''}>
          <button class="d du" data-act="rk" data-c="up" title="Opp">${M.icon('keyboard_arrow_up', 30)}</button>
          <button class="d dd" data-act="rk" data-c="down" title="Ned">${M.icon('keyboard_arrow_down', 30)}</button>
          <button class="d dl" data-act="rk" data-c="left" title="Venstre">${M.icon('keyboard_arrow_left', 30)}</button>
          <button class="d dr" data-act="rk" data-c="right" title="Høyre">${M.icon('keyboard_arrow_right', 30)}</button>
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
      const volume = M.volumeRow.html({ key: p.id, style: VP.style, alt: VP.alt, level: V.level, approx: V.approx, muted: V.muted, dis: V.dis || (V.noLevel && !V.btn && VP.style === 'pille') });
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
          const d = el.dataset;
          if (d.k === 'src') {
            mp('select_source', { source: d.v });
            if (p.kind === 'tv') dbg(`${REMOTE[platOf(h, p)].hw} · Åpner ${d.n}`);
            else dbg(`media_player.select_source → ${id} · source: ${d.v}`);
          } else {
            const [dm, sv] = svcFor(d.v);
            M.call(h, dm, sv, { entity_id: d.v });
            dbg(`${dm}.${sv} → ${d.v}`);
          }
          return;
        }
        case 'play': return mp('media_play_pause');
        case 'prev': return mp('media_previous_track');
        case 'next': return mp('media_next_track');
        case 'repeat': { const nx = { off: 'all', all: 'one', one: 'off' }[a.repeat || 'off'] || 'off'; return mp('repeat_set', { repeat: nx }); }
        case 'shuffle': return mp('shuffle_set', { shuffle: !a.shuffle });
        case 'rk': return this._remote(p, el.dataset.c, false);
        default:
      }
      return super.onAction(name, el, ev);
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
      const r = dp.getBoundingClientRect();
      this.style.setProperty('--msh-gx', (e.clientX - r.left - 26).toFixed(1) + 'px');
      this.style.setProperty('--msh-gy', (e.clientY - r.top - 26).toFixed(1) + 'px');
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
          const k = this._el(e, '.key[data-hold]');
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
        root.addEventListener('contextmenu', (e) => { if (this._el(e, '.key,.tab,.dp')) e.preventDefault(); });
        // Sveip på D-paden: < 10 px = trykk (knappene virker som før), deretter én kommando per 34 px i dominerende
        // retning, og startpunktet nullstilles (ett langt sveip = flere steg). Bubble Card skal ikke få gesten
        // (swipe-to-close/scroll): touch-action:none på flaten + stopPropagation/preventDefault.
        root.addEventListener('pointerdown', (e) => {
          const dp = this._el(e, '.dp.swipe');
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
            try { s.dp.setPointerCapture(e.pointerId); } catch (x) { /* */ }
          }
          const dx = e.clientX - s.x, dy = e.clientY - s.y;
          if (Math.max(Math.abs(dx), Math.abs(dy)) < SW_STEP) return;
          const c = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
          s.x = e.clientX; s.y = e.clientY;
          const p = this._R && this._R.p;
          if (!p) return;
          M.haptic('selection');
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
        const tstop = (e) => { if (swOn() && this._el(e, '.dp.swipe')) { e.stopPropagation(); if (e.type === 'touchmove' && e.cancelable) e.preventDefault(); } };
        // touchstart: bare stopPropagation – preventDefault her ville fjerne klikket på pilene/OK på touch.
        root.addEventListener('touchstart', tstop, { passive: true });
        root.addEventListener('touchmove', tstop, { passive: false });
      }
      // Faner: felles MSH.tabReorder – langt trykk + dra = omorganiser (lagres i config.tab_order via ki-store)
      const seg = root.querySelector('.seg');
      if (seg) M.tabReorder(seg, {
        card: this, glass: true, // Liquid Glass-drag (linse ved sideveis dra) alltid – uavhengig av temaet (Fiks 15.2)
        // Fiks 16.10: den rosa indikatoren ER glasslinsen – den følger fingeren (regnet fra sporets ferske mål hver frame),
        // snapper til nærmeste fane ved slipp og bytter først da. Ingen ekstra trykk-linse (glassTap) oppå den.
        glassTap: false,
        onGlassMove: (hit, x) => this._indDrag(seg, x),
        onGlassEnd: (hit) => this._indDrag(seg, null, hit),
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
          stepDrag: true, toggle,
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
        stepDrag: false, toggle,
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
        .tabs{display:grid;grid-template-columns:46px minmax(0,1fr) 46px;align-items:center;gap:8px}
        /* standard: transparent + ring; glassflate bare med Liquid Glass-temaet (MSH.tabSurface, Fiks 15.2) */
        .seg{gap:2px;padding:4px;border-radius:22px;${M.tabSurface ? M.tabSurface('transparent', 'inset 0 0 0 1px rgba(255,255,255,0.14)') : 'box-shadow:inset 0 0 0 1px rgba(255,255,255,0.14);'}justify-self:center}
        .tab{height:38px;padding:0 18px;border-radius:19px;font-size:13px;font-weight:500;color:var(--gray800,#afafaf);background:transparent}
        .tab.on{background:${PINK};color:var(--gray200,#3a3a3a)}
        /* Fiks 16.10: like brede faner + indikator med indeks-/prosentposisjon (--i/--n) – glir med transition, følger fingeren ved dra */
        .seg.msh-tr{position:relative;display:grid;grid-auto-flow:column;grid-auto-columns:1fr}
        .seg .tab{position:relative;z-index:1;transition:color .25s}
        .seg .tab.on{background:transparent}
        .seg .ind{position:absolute;z-index:0;top:4px;bottom:4px;left:calc(4px + (100% - 6px) * var(--i, 0) / var(--n, 1));width:calc((100% - 6px) / var(--n, 1) - 2px);border-radius:19px;background:${PINK};pointer-events:none;
          transition:left .34s cubic-bezier(.34,1.25,.64,1),box-shadow .2s,scale .2s cubic-bezier(.34,1.8,.64,1)}
        .seg .ind.off{opacity:0}
        .seg .ind.drag{transition:left .12s cubic-bezier(.34,1.5,.64,1),box-shadow .2s,scale .25s cubic-bezier(.34,1.8,.64,1);scale:1.1;box-shadow:inset 0 1px 0 rgba(255,255,255,0.65),inset 0 -1px 1px rgba(255,255,255,0.18),inset 0 0 0 0.5px rgba(255,255,255,0.4),0 10px 24px rgba(0,0,0,0.35)}
        .seg.tr-drag .ind{opacity:0}
        .mb{display:flex;flex-direction:column;gap:var(--msh-gap,14px);transition:min-height .3s cubic-bezier(.2,.8,.2,1)}
        .gear{width:46px;height:46px;border-radius:23px;background:var(--gray200,#3a3a3a);display:grid;place-items:center;color:var(--gray800,#afafaf)}
        .gear:active{transform:scale(.92)}
        .cs{display:flex;flex-direction:column;gap:8px;min-width:0}
        .ttl{font-size:12px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;color:var(--gray600,#7f7f7f);padding:0 4px}
        .chips{display:flex;gap:8px;overflow-x:auto;overscroll-behavior-x:contain}
        .chip{flex:none;width:88px;height:88px;border-radius:22px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:0 6px;transition:background .2s,transform .12s}
        .chip.tv{width:92px}
        .chip:active{transform:scale(.95)}
        .cn{font-size:11px;font-weight:600;max-width:100%}
        .nochips{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 10px 10px 16px;border-radius:22px;background:var(--gray200,#3a3a3a);font-size:13px;color:var(--gray700,#979797)}
        .tr{display:flex;align-items:center;justify-content:space-between;padding:6px 8px}
        .rnd{width:44px;height:44px;border-radius:22px;display:grid;place-items:center;color:var(--gray600,#7f7f7f);background:transparent;transition:background .2s,color .2s}
        .rnd.on{color:${PINKC};background:${M.alpha(PINKC, 0.14)}}
        .sk{width:52px;height:52px;display:grid;place-items:center;transition:transform .12s}
        .sk:active{transform:scale(.9)}
        .play{width:76px;height:76px;border-radius:38px;background:${PINK};color:var(--gray200,#3a3a3a);display:grid;place-items:center;box-shadow:0 8px 24px ${M.alpha(PINKC, 0.3)};transition:transform .12s}
        .play:active{transform:scale(.94)}
        button[disabled]{opacity:.35;cursor:default}
        .rm{display:flex;align-items:center;gap:14px}
        .dp{position:relative;width:188px;height:188px;flex:none;border-radius:94px;background:var(--gray200,#3a3a3a);box-shadow:inset 0 0 0 1px rgba(255,255,255,0.06);overflow:hidden;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
        .dp.swipe{touch-action:none}
        .glow{position:absolute;left:0;top:0;width:52px;height:52px;border-radius:26px;background:rgba(255,255,255,0.14);box-shadow:0 0 24px rgba(255,255,255,0.14);pointer-events:none;transform:translate(var(--msh-gx,68px),var(--msh-gy,68px));opacity:var(--msh-glow-o,0);transition:opacity .18s}
        .d{position:absolute;width:56px;height:56px;display:grid;place-items:center;color:var(--gray800,#afafaf)}
        .d:active{color:var(--white,#fafafa)}
        .du{left:66px;top:4px} .dd{left:66px;bottom:4px} .dl{top:66px;left:4px} .dr{top:66px;right:4px}
        .ok{position:absolute;left:59px;top:59px;width:70px;height:70px;border-radius:35px;background:var(--gray300,#404040);font-size:14px;font-weight:600;transition:transform .12s}
        .ok:active{transform:scale(.92)}
        .keys{flex:1;min-width:0;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px}
        .key{position:relative;height:56px;border-radius:20px;background:var(--gray200,#3a3a3a);display:grid;place-items:center;color:var(--gray800,#afafaf);-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;transition:transform .12s}
        .key:active{transform:scale(.93);color:var(--white,#fafafa)}
        .hb{position:absolute;bottom:6px;left:50%;width:14px;height:3px;margin-left:-7px;border-radius:2px;background:var(--gray400,#545454)}
        ${M.volumeRow.CSS}
      `;
    }
  }

  M.define('msh-media-hero-card', MediaHero, 'MSH Media · nå spilles', 'Sveipbar «nå spilles»-karusell med omslag for valgt fane. Første kort i Media-popupen.');
  M.define('msh-media-card', MediaCard, 'MSH Media', 'Faner (TV/Musikk), apper/kilder, transport eller fjernkontroll og volum for alle media_player.*');
})();
