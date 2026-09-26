/* msh-media-hero-card + msh-media-card · Media-popup (#media). Kilde: Media v4.dc.html.
 * Hero (eget kort, først): sveipbar karusell med «nå spilles» per spiller i valgt fane (omslag fra
 * entity_picture, eq-/nivåstolper, marquee-tittel, av/på) + prikker.
 * Hovedkort: faner (TV/Musikk, langt trykk + dra = omorganiser, lagres i config), oppsett-knapp,
 * apper/kilder/snarveier, transport (musikk) eller fjernkontroll (TV), volum (slider eller knapper).
 * Autokonfig: alle media_player.* (exclude/include.spillere), sortert/gruppert per område, TV vs musikk
 * fra device_class → plattform → navn/app-attributter. Aktiv spiller = den som spiller (sist endret),
 * ellers første. Begge kortene deler valgt fane/spiller per popup (hash) via en liten buss.
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
    return { tv: out.filter((p) => p.kind === 'tv'), musikk: out.filter((p) => p.kind === 'musikk'), all: out };
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
    apple: { hw: 'Apple TV', holdLabel: 'Kontrollsenter', up: 'up', down: 'down', left: 'left', right: 'right', ok: 'select', back: 'menu', home: 'home', menu: 'top_menu', play: 'play_pause', hold: { command: 'home_hold' } },
    google: { hw: 'Google TV', holdLabel: 'Dashbord', up: 'DPAD_UP', down: 'DPAD_DOWN', left: 'DPAD_LEFT', right: 'DPAD_RIGHT', ok: 'DPAD_CENTER', back: 'BACK', home: 'HOME', menu: 'MENU', play: 'MEDIA_PLAY_PAUSE', hold: { command: 'HOME', hold_secs: 1 } },
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
    const app = a.app_name || a.source || '';
    const st = appStyle(app);
    let title, artist;
    if (off) { title = s && s.state === 'unavailable' ? 'Utilgjengelig' : 'Av'; artist = p.name; }
    else if (tv) { title = a.media_title || app || (s.state === 'idle' ? 'Hjem' : '–'); artist = [a.media_series_title, a.media_channel, a.media_artist].filter(Boolean).join(' · ') || (a.media_title ? app : '') || p.name; }
    else { title = a.media_title || a.source || (s.state === 'idle' ? 'Klar' : '–'); artist = [a.media_artist, a.media_channel || a.media_album_name].filter(Boolean).join(' · ') || a.source || p.name; }
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

  const baseSchema = (h, c) => {
    c = c || {};
    const P = h ? M.mediaPlayers(h, c, true).all : [];
    return [
      { type: 'order', name: 'tab_order', hiddenName: 'hidden_tabs', label: 'Faner (rekkefølge / skjul)', options: TABS },
      { type: 'lists', label: 'Mediaspillere', lists: (hh) => [{ key: 'spillere', label: 'Mediaspillere', ids: M.all(hh, 'media_player'), domains: ['media_player'] }] },
      { type: 'area', name: 'area', label: 'Begrens til område', help: 'Tomt = alle media_player.* i huset, sortert per område' },
      ...P.map((p) => {
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
            { type: 'entity', name: b + '.remote', label: 'Fjernkontroll (remote)', domain: 'remote', auto: () => rem, help: `Hold Hjem-knappen for ${REMOTE[platOf(h, p)].holdLabel.toLowerCase()} · ${rem || 'ingen remote funnet'}` },
            { type: 'select', name: b + '.volume', label: 'Volum styres av', options: [['media', 'Mediaspiller'], ['buttons', 'Knapper']], default: 'media' },
            { type: 'entity', name: b + '.volume_up', label: 'Volum opp', domains: ['button', 'script', 'switch', 'input_button'], help: 'Tom = media_player.volume_up' },
            { type: 'entity', name: b + '.volume_down', label: 'Volum ned', domains: ['button', 'script', 'switch', 'input_button'], help: 'Tom = media_player.volume_down' },
            { type: 'entity', name: b + '.volume_mute', label: 'Demp', domains: ['button', 'script', 'switch', 'input_button'], help: 'Tom = media_player.volume_mute' },
            { type: 'text', name: b + '.hide_sources', label: 'Skjul apper (kommaseparert)', placeholder: 'f.eks. HDMI 1, Innstillinger' },
            { type: 'entities', name: b + '.watch', label: 'Seertid (sensorer under omslaget)', domain: 'sensor' },
          );
        } else {
          const auto = autoShortcuts(h, p);
          fields.push(
            { type: 'entities', name: b + '.shortcuts', label: 'Snarveier (button/script/scene)', domains: ['button', 'input_button', 'script', 'scene'], help: `Tom = knapper på samme enhet (${auto.length} funnet)` },
            { type: 'text', name: b + '.chip_title', label: 'Tittel over snarveier', placeholder: 'Radio / Kilde' },
            { type: 'text', name: b + '.hide_sources', label: 'Skjul kilder (kommaseparert)', placeholder: 'f.eks. Bluetooth, USB' },
            { type: 'entities', name: b + '.watch', label: 'Statistikk (sensorer under omslaget)', domain: 'sensor' },
          );
        }
        return { type: 'section', id: 'p_' + p.obj, icon: tv ? 'mdi:television' : 'mdi:speaker', label: `${p.name} · ${p.kind === 'skjul' ? 'skjult' : tv ? 'TV' : 'Musikk'}${p.areaName ? ' · ' + p.areaName : ''}`, fields };
      }),
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
    get key() { return this._bk || M.popupHash(this) || '_'; }
    select(tab, id) {
      const b = bus(this.key);
      b.tab = tab;
      if (id) b.sel[tab] = id;
      emit(this.key);
    }
  }

  /* ============================================================ hero */
  const LV = [0.5, 0.7, 0.8, 0.9, 0.75, 0.6, 0.45, 0.3, 0.8, 0.95, 0.7, 0.55, 0.4, 0.3];
  class MediaHero extends MediaBase {
    static get cardName() { return 'Media · nå spilles'; }
    static get schema() { return (h, c) => [{ type: 'info', label: 'Hero-kortet bruker innstillingene fra msh-media-card i samme popup. Felt satt her overstyrer dem.' }, ...baseSchema(h, c)]; }
    get cardSize() { return 4; }
    // Egen config (uten type/card_id) over hovedkortets config.
    get eff() {
      const own = { ...(this._rawConfig || {}) };
      delete own.type; delete own.card_id;
      return { ...(bus(this.key).cfg || {}), ...own };
    }
    render() {
      const cfg = this.eff, R = M.mediaResolve(this.hass, cfg, this.key);
      this._R = R;
      R.P.all.forEach((p) => this.s(p.id));
      if (!R.L.length) {
        const txt = R.P.all.length ? `Ingen ${R.tab === 'tv' ? 'TV-er' : 'musikkspillere'}` : 'Fant ingen mediaspillere';
        return `<div class="wrap"><div class="sw noscroll"><section class="pc off" data-key="_none">
          <div class="l"><div class="hd">${M.icon('speaker', 16)}<span class="ell">–</span></div>
            <div class="tt"><div class="mqw"><span class="mq">–</span></div><span class="ar ell">${esc(txt)}</span></div>
            <div class="bt"><div class="lv">${LV.map((v) => `<span style="height:${v * 100}%"></span>`).join('')}</div><button class="pw press" data-act="customize" data-section="entities" title="Velg entitet">${M.icon('add', 20)}</button></div></div>
          <div class="r"><div class="art" style="background:var(--gray300,#404040);color:var(--gray600,#7f7f7f)">${M.icon('music_note', 44)}</div></div>
        </section></div><div class="dots"><span class="dot on"></span></div></div>`;
      }
      const cards = R.L.map((p) => this._card(p)).join('');
      const dots = R.L.map((p, j) => `<button class="dot ${j === R.i ? 'on' : ''}" data-act="dot" data-i="${j}" data-haptic="selection" data-key="${esc(p.id)}" title="${esc(p.name)}"></button>`).join('');
      return `<div class="wrap"><div class="sw noscroll">${cards}</div><div class="dots">${dots}</div></div>`;
    }
    _card(p) {
      const I = info(this, p);
      const eq = [0, 1, 2, 3].map((k) => `<span style="animation-duration:${(0.7 + (k % 3) * 0.18).toFixed(2)}s;animation-delay:${(k * 0.12).toFixed(2)}s"></span>`).join('');
      const lv = LV.map((v, k) => `<span style="height:${v * 100}%;animation-duration:${(0.8 + (k % 4) * 0.15).toFixed(2)}s;animation-delay:${(k * 0.07).toFixed(2)}s"></span>`).join('');
      const artStyle = I.off ? 'background:var(--gray300,#404040);color:var(--gray600,#7f7f7f)' : `background:${I.col || PINK};color:${I.col ? '#fff' : 'var(--gray200,#3a3a3a)'}`;
      const art = I.pic ? `<img src="${esc(I.pic)}" alt="" data-key="img">` : M.icon(I.artIcon, 44);
      const watch = (Array.isArray(p.pc.watch) ? p.pc.watch : []).filter(Boolean);
      const wt = watch.length ? `<div class="wt">${watch.map((id) => `<div class="wr" data-ent="${esc(id)}"><span class="wl ell">${esc(M.name(this.hass, id, p.name))}</span><span class="wv num">${esc(M.fmtState(this.hass, id))}</span></div>`).join('')}</div>` : '';
      watch.forEach((id) => this.s(id));
      const mq = I.run ? `${I.title}      ${I.title}      ` : I.title;
      return `<section class="pc ${I.off ? 'off' : ''} ${I.run ? 'run' : ''}" data-key="${esc(p.id)}" data-ent="${esc(p.id)}">
        <div class="l">
          <div class="hd">${M.icon(I.icon, 16)}<span class="ell">${esc(I.label)}</span><span class="eq">${eq}</span></div>
          <div class="tt"><div class="mqw"><span class="mq">${esc(mq)}</span></div><span class="ar ell">${esc(I.artist)}</span></div>
          <div class="bt"><div class="lv">${lv}</div><button class="pw press" data-act="power" data-id="${esc(p.id)}" title="Av/på">${M.icon('power_settings_new', 20)}</button></div>
        </div>
        <div class="r"><div class="art" style="${artStyle}">${art}</div>${wt}</div>
      </section>`;
    }
    onAction(name, el, ev) {
      if (name === 'power') {
        const s = this.hass.states[el.dataset.id];
        const off = !s || ['off', 'standby'].includes(s.state);
        return M.call(this.hass, 'media_player', off ? 'turn_on' : 'turn_off', { entity_id: el.dataset.id });
      }
      if (name === 'dot') {
        const sw = this.shadowRoot.querySelector('.sw'), i = Number(el.dataset.i);
        if (sw) sw.scrollTo({ left: i * sw.clientWidth, behavior: 'smooth' });
        if (this._R && this._R.L[i]) this.select(this._R.tab, this._R.L[i].id);
        return;
      }
      return super.onAction(name, el, ev);
    }
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
        @keyframes mq{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        .wrap{display:flex;flex-direction:column;gap:8px}
        .sw{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;border-radius:28px;overscroll-behavior-x:contain}
        .pc{flex:none;width:100%;scroll-snap-align:start;display:flex;gap:14px;padding:18px;border-radius:28px;background:radial-gradient(90% 120% at 20% 0%, #282828, var(--gray200,#3a3a3a) 70%);box-shadow:inset 0 0 0 1px rgba(255,255,255,0.04);transition:opacity .3s;min-width:0}
        .pc.off{opacity:.55}
        .l{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:space-between;gap:14px}
        .hd{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--gray700,#979797);white-space:nowrap;overflow:hidden}
        .hd .ell{min-width:0}
        .eq{display:flex;gap:2px;align-items:flex-end;height:10px;flex:none}
        .eq span{width:2px;height:10px;border-radius:1px;background:var(--gray700,#979797);transform-origin:bottom;transform:scaleY(.3)}
        .run .eq span,.run .lv span{animation-name:eq;animation-timing-function:ease-in-out;animation-iteration-count:infinite}
        .tt{display:flex;flex-direction:column;gap:4px;min-width:0}
        .mqw{overflow:hidden;white-space:nowrap;-webkit-mask-image:linear-gradient(90deg,transparent,#000 6%,#000 90%,transparent);mask-image:linear-gradient(90deg,transparent,#000 6%,#000 90%,transparent)}
        .mq{display:inline-block;font-size:22px;font-weight:500;letter-spacing:-0.01em;white-space:pre}
        .run .mq{animation:mq 14s linear infinite}
        .ar{font-size:13px;color:var(--gray700,#979797)}
        .bt{display:flex;align-items:center;gap:10px}
        .lv{flex:1;min-width:0;display:flex;gap:3px;align-items:center;height:22px}
        .lv span{flex:1;border-radius:2px;background:var(--gray500,#696969);transform-origin:center;transform:scaleY(.25)}
        .pw{width:40px;height:40px;border-radius:20px;flex:none;display:grid;place-items:center;background:var(--gray300,#404040);color:var(--white,#fafafa)}
        .off .pw{background:${M.alpha(C.red, 0.2)};color:${C.red}}
        .r{display:flex;flex-direction:column;align-items:center;gap:8px;flex:none}
        .art{width:112px;height:112px;flex:none;border-radius:20px;display:grid;place-items:center;overflow:hidden}
        .art img{width:100%;height:100%;object-fit:cover;display:block}
        .wt{width:112px;display:flex;flex-direction:column;gap:3px}
        .wr{display:flex;justify-content:space-between;align-items:baseline;gap:6px;white-space:nowrap}
        .wl{font-size:11px;color:var(--gray600,#7f7f7f);min-width:0}
        .wv{font-size:13px;font-weight:500}
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
    static get schema() { return (h, c) => [...baseSchema(h, c), { type: 'gap' }]; }
    get cardSize() { return 8; }
    setConfig(c) { super.setConfig(c); this._publish(); }
    _publish() {
      if (!this.isConnected) return;
      const b = bus(this.key);
      if (b.cfg !== this.config) { b.cfg = this.config; emit(this.key, this); }
    }
    onOpen() {
      // Ny åpning → vis aktiv spiller igjen.
      const b = bus(this.key);
      b.tab = null; b.sel = {};
      this._ui = { ...this._ui, act: '', lastKey: '' };
      emit(this.key);
    }
    get toasts() { return this.config.toasts !== false; }
    render() {
      const cfg = this.config, R = M.mediaResolve(this.hass, cfg, this.key), h = this.hass;
      this._R = R;
      R.P.all.forEach((p) => this.s(p.id));
      const tabs = R.order.map((k) => `<button class="tab ${k === R.tab ? 'on' : ''}" data-act="tab" data-t="${k}" data-haptic="selection" data-key="${k}">${esc(TABS.find((t) => t[0] === k)[1])}</button>`).join('');
      const head = `<div class="tabs"><span></span><div class="seg">${tabs}</div><button class="gear press" data-act="customize" title="Oppsett">${M.icon('settings', 22)}</button></div>`;
      if (!R.p) return `<div class="mc">${head}${M.emptyState(R.P.all.length ? 'Ingen spillere i denne fanen' : 'Fant ingen mediaspillere', 'entities')}</div>`;
      const p = R.p, I = info(this, p), a = I.a, ui = this.ui;
      if (this._pid !== p.id) { this._pid = p.id; ui.act = ''; ui.lastKey = ''; }
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
        ${chips.length ? `<div class="chips noscroll">${chipHtml}</div>` : `<div class="nochips">Ingen ${I.tv ? 'apper' : 'kilder eller snarveier'} funnet <button class="pick press" data-act="customize" data-section="p_${esc(p.obj)}">${M.icon('add', 18)}Legg til</button></div>`}
        ${!I.tv && ui.act ? `<span class="act ell">${esc(ui.act)}</span>` : ''}</div>`;
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
      const rem = I.tv ? remoteOf(h, p) : null;
      const remote = !I.tv ? '' : `<div class="rm">
        <div class="dp">
          <button class="d du" data-act="rk" data-c="up" title="Opp">${M.icon('keyboard_arrow_up', 30)}</button>
          <button class="d dd" data-act="rk" data-c="down" title="Ned">${M.icon('keyboard_arrow_down', 30)}</button>
          <button class="d dl" data-act="rk" data-c="left" title="Venstre">${M.icon('keyboard_arrow_left', 30)}</button>
          <button class="d dr" data-act="rk" data-c="right" title="Høyre">${M.icon('keyboard_arrow_right', 30)}</button>
          <button class="ok" data-act="rk" data-c="ok">OK</button>
        </div>
        <div class="keys">
          ${KEYS.map(([c, ic, l]) => `<button class="key ${c === 'home' ? 'hold' : ''}" data-act="rk" data-c="${c}" title="${esc(c === 'home' ? `${l} · hold for ${RC.holdLabel}` : l)}">${M.icon(ic, 24)}${c === 'home' ? '<span class="hb"></span>' : ''}</button>`).join('')}
          <div class="lk ell">${esc(ui.lastKey || `${RC.hw} · ${rem || 'mangler remote.* – velg i oppsett'}`)}</div>
        </div>
      </div>`;
      // Volum
      const useBtn = I.tv && p.pc.volume === 'buttons';
      let volume;
      if (useBtn) {
        const muted = !!a.is_volume_muted;
        volume = `<div class="vb">
          <button data-act="vb" data-k="down" title="Volum ned">${M.icon('volume_down', 26)}</button>
          <button data-act="vb" data-k="mute" title="Demp" style="color:${muted ? C.red : 'var(--white,#fafafa)'}">${M.icon('no_sound', 26)}</button>
          <button data-act="vb" data-k="up" title="Volum opp">${M.icon('volume_up', 26)}</button>
        </div>`;
      } else {
        const canVol = !I.off && a.volume_level != null;
        const live = this._dv != null && (this._vdrag || Date.now() - (this._vEnd || 0) < 1500) && this._dvId === p.id;
        const v = live ? this._dv : canVol ? Math.round(Number(a.volume_level) * 100) : 0;
        volume = `<div class="vol ${canVol ? '' : 'dis'}"><span class="vlab">Volum</span>
          <div class="vs" data-id="${esc(p.id)}"><div class="vt"></div><div class="vf" style="width:${v}%"></div><span class="vk" style="left:calc(${v}% - 12px)"></span></div>
          <span class="vv num">${canVol || live ? v + '%' : '–'}</span></div>`;
      }
      return `<div class="mc">${head}${chipsSec}${transport}${remote}${volume}</div>`;
    }
    onAction(name, el, ev) {
      const h = this.hass, R = this._R, p = R && R.p;
      if (name === 'tab') {
        if (Date.now() - (this._eat || 0) < 350) return;
        this._ui = { ...this._ui, act: '', lastKey: '' };
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
            if (p.kind === 'tv') this.setUI({ lastKey: `${REMOTE[platOf(h, p)].hw} · Åpner ${d.n}` });
            else this.setUI({ act: `media_player.select_source → ${id} · source: ${d.v}` });
          } else {
            const [dm, sv] = svcFor(d.v);
            M.call(h, dm, sv, { entity_id: d.v });
            this.setUI({ act: `${dm}.${sv} → ${d.v}` });
          }
          return;
        }
        case 'play': return mp('media_play_pause');
        case 'prev': return mp('media_previous_track');
        case 'next': return mp('media_next_track');
        case 'repeat': { const nx = { off: 'all', all: 'one', one: 'off' }[a.repeat || 'off'] || 'off'; return mp('repeat_set', { repeat: nx }); }
        case 'shuffle': return mp('shuffle_set', { shuffle: !a.shuffle });
        case 'rk': {
          if (this._held) { this._held = false; return; }
          return this._remote(p, el.dataset.c, false);
        }
        case 'vb': {
          const k = el.dataset.k, ent = p.pc['volume_' + k];
          if (ent) { const [dm, sv] = svcFor(ent); M.call(h, dm, sv, { entity_id: ent }); this.setUI({ lastKey: `${dm}.${sv} → ${ent}` }); return; }
          if (k === 'mute') return mp('volume_mute', { is_volume_muted: !a.is_volume_muted });
          return mp(k === 'up' ? 'volume_up' : 'volume_down');
        }
        default:
      }
      return super.onAction(name, el, ev);
    }
    _remote(p, c, hold) {
      const h = this.hass, RC = REMOTE[platOf(h, p)], rem = remoteOf(h, p);
      if (!rem) {
        if (c === 'play') M.call(h, 'media_player', 'media_play_pause', { entity_id: p.id });
        this.setUI({ lastKey: `${RC.hw} · ${KEYL[c]}${c === 'play' ? '' : ' · mangler remote.*'}` });
        return;
      }
      const data = { entity_id: rem, command: hold ? RC.hold.command : RC[c] };
      if (hold && RC.hold.hold_secs) data.hold_secs = RC.hold.hold_secs;
      M.call(h, 'remote', 'send_command', data);
      this.setUI({ lastKey: hold ? `${RC.hw} · ${RC.holdLabel}` : `${RC.hw} · ${KEYL[c]}` });
    }
    afterRender() {
      const root = this.shadowRoot;
      // Volum-slider (drag-vern: touch-action none + stopPropagation via M.drag)
      const vs = root.querySelector('.vs');
      if (vs && !vs.__b) {
        vs.__b = true;
        M.drag(vs, {
          onStart: () => { this._vdrag = true; this._dvId = vs.dataset.id; },
          onMove: (f) => { if (vs.closest('.dis')) return; this._dv = Math.round(f * 100); this._paintVol(this._dv); this._sendVol(vs.dataset.id, this._dv, false); },
          onEnd: () => { this._vdrag = false; this._vEnd = Date.now(); if (vs.closest('.dis') || this._dv == null) return; this._sendVol(vs.dataset.id, this._dv, true); },
        });
      }
      // Horisontal chip-liste: ikke la Bubble Card få sveipet
      const ch = root.querySelector('.chips');
      if (ch && !ch.__b) {
        ch.__b = true;
        const stop = (e) => e.stopPropagation();
        ch.addEventListener('touchstart', stop, { passive: true });
        ch.addEventListener('touchmove', stop, { passive: true });
        ch.addEventListener('pointerdown', stop);
      }
      // Hjem-knapp: hold for kontrollsenter/dashbord
      if (!this.__hb) {
        this.__hb = true;
        const clear = () => clearTimeout(this._ht);
        root.addEventListener('pointerdown', (e) => {
          const k = this._el(e, '.key.hold');
          if (!k) return;
          this._held = false;
          clear();
          this._ht = setTimeout(() => { const p = this._R && this._R.p; if (!p) return; this._held = true; k.setAttribute('data-haptic', 'off'); setTimeout(() => k.removeAttribute('data-haptic'), 700); M.haptic('medium'); this._remote(p, 'home', true); }, 550);
        });
        ['pointerup', 'pointercancel', 'pointerleave'].forEach((t) => root.addEventListener(t, clear));
        root.addEventListener('contextmenu', (e) => { if (this._el(e, '.key,.tab')) e.preventDefault(); });
      }
      // Faner: langt trykk + dra = omorganiser (lagres i config.tab_order)
      const seg = root.querySelector('.seg');
      if (seg && !seg.__b) {
        seg.__b = true;
        M.guardDrag(seg, 'x');
        seg.addEventListener('pointerdown', (e) => {
          const t = e.target.closest && e.target.closest('.tab');
          if (!t || e.button) return;
          clearTimeout(this._th);
          this._txy = [e.clientX, e.clientY];
          this._th = setTimeout(() => this._beginTab(seg, t, e.clientX), 380);
        });
        seg.addEventListener('pointermove', (e) => { if (this._txy && Math.hypot(e.clientX - this._txy[0], e.clientY - this._txy[1]) > 8) clearTimeout(this._th); });
        ['pointerup', 'pointercancel'].forEach((ty) => seg.addEventListener(ty, () => clearTimeout(this._th)));
      }
    }
    _beginTab(seg, el, x0) {
      const sib = [...seg.querySelectorAll('.tab')];
      if (sib.length < 2) return;
      const rects = sib.map((c) => c.getBoundingClientRect()), i = sib.indexOf(el), keys = sib.map((c) => c.dataset.t);
      M.haptic('medium');
      this._busy = true;
      el.classList.add('drag');
      sib.forEach((c) => { if (c !== el) c.classList.add('dim'); });
      const mv = (e) => { e.preventDefault(); e.stopPropagation(); el.style.transform = `translateX(${e.clientX - x0}px) scale(1.06)`; };
      const fin = (e) => {
        window.removeEventListener('pointermove', mv, true);
        window.removeEventListener('pointerup', fin, true);
        window.removeEventListener('pointercancel', fin, true);
        e.stopPropagation();
        el.style.transform = '';
        el.classList.remove('drag');
        sib.forEach((c) => c.classList.remove('dim'));
        this._busy = false;
        this._eat = Date.now();
        if (e.type === 'pointerup') {
          const r0 = rects[i], cx = r0.left + r0.width / 2 + (e.clientX - x0);
          let j = rects.findIndex((r) => cx >= r.left && cx <= r.right);
          if (j < 0) j = cx < rects[0].left ? 0 : rects.length - 1;
          const k = keys[i], a2 = keys.filter((x) => x !== k);
          a2.splice(j, 0, k);
          if (a2.join() !== keys.join()) {
            M.haptic('success');
            const all = this._R ? this._R.orderAll : a2;
            this._save({ tab_order: [...a2, ...all.filter((x) => !a2.includes(x))] });
          }
        }
        this.update();
      };
      window.addEventListener('pointermove', mv, { capture: true, passive: false });
      window.addEventListener('pointerup', fin, true);
      window.addEventListener('pointercancel', fin, true);
    }
    async _save(patch) {
      const old = this._rawConfig || this.config, n = { ...old, ...patch };
      this.setConfig(n);
      const r = await M.saveCardConfig(this.hass, old, n);
      if (r && r.config) this.setConfig(r.config);
    }
    _paintVol(v) {
      const r = this.shadowRoot, f = r.querySelector('.vs .vf'), k = r.querySelector('.vs .vk'), t = r.querySelector('.vv');
      if (f) f.style.width = v + '%';
      if (k) k.style.left = `calc(${v}% - 12px)`;
      if (t) t.textContent = v + '%';
    }
    _sendVol(id, v, final) {
      const now = Date.now();
      if (!final && now - (this._vt || 0) < 250) return;
      this._vt = now;
      M.call(this.hass, 'media_player', 'volume_set', { entity_id: id, volume_level: Math.round(v) / 100 });
    }
    get styles() {
      return `
        .mc{display:flex;flex-direction:column;gap:var(--msh-gap,14px)}
        .tabs{display:grid;grid-template-columns:46px 1fr 46px;align-items:center;gap:8px}
        .seg{display:flex;gap:2px;padding:4px;border-radius:22px;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.14);justify-self:center}
        .tab{height:38px;padding:0 18px;border-radius:19px;font-size:13px;font-weight:500;white-space:nowrap;color:var(--gray800,#afafaf);background:transparent;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;transition:opacity .2s}
        .tab.on{background:${PINK};color:var(--gray200,#3a3a3a)}
        .tab.drag{position:relative;z-index:5;box-shadow:0 8px 20px rgba(0,0,0,0.45),inset 0 0 0 1.5px ${PINKC};transition:none}
        .tab.dim{opacity:.65}
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
        .act{font-size:11px;color:var(--gray600,#7f7f7f);padding:0 4px}
        .tr{display:flex;align-items:center;justify-content:space-between;padding:6px 8px}
        .rnd{width:44px;height:44px;border-radius:22px;display:grid;place-items:center;color:var(--gray600,#7f7f7f);background:transparent;transition:background .2s,color .2s}
        .rnd.on{color:${PINKC};background:${M.alpha(PINKC, 0.14)}}
        .sk{width:52px;height:52px;display:grid;place-items:center;transition:transform .12s}
        .sk:active{transform:scale(.9)}
        .play{width:76px;height:76px;border-radius:38px;background:${PINK};color:var(--gray200,#3a3a3a);display:grid;place-items:center;box-shadow:0 8px 24px ${M.alpha(PINKC, 0.3)};transition:transform .12s}
        .play:active{transform:scale(.94)}
        button[disabled]{opacity:.35;cursor:default}
        .rm{display:flex;align-items:center;gap:14px}
        .dp{position:relative;width:188px;height:188px;flex:none;border-radius:94px;background:var(--gray200,#3a3a3a);box-shadow:inset 0 0 0 1px rgba(255,255,255,0.06)}
        .d{position:absolute;width:56px;height:56px;display:grid;place-items:center;color:var(--gray800,#afafaf)}
        .d:active{color:var(--white,#fafafa)}
        .du{left:66px;top:4px} .dd{left:66px;bottom:4px} .dl{top:66px;left:4px} .dr{top:66px;right:4px}
        .ok{position:absolute;left:59px;top:59px;width:70px;height:70px;border-radius:35px;background:var(--gray300,#404040);font-size:14px;font-weight:600;transition:transform .12s}
        .ok:active{transform:scale(.92)}
        .keys{flex:1;min-width:0;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px}
        .key{position:relative;height:56px;border-radius:20px;background:var(--gray200,#3a3a3a);display:grid;place-items:center;color:var(--gray800,#afafaf);-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;transition:transform .12s}
        .key:active{transform:scale(.93);color:var(--white,#fafafa)}
        .hb{position:absolute;bottom:6px;left:50%;width:14px;height:3px;margin-left:-7px;border-radius:2px;background:var(--gray400,#545454)}
        .lk{grid-column:1 / -1;font-size:11px;color:var(--gray600,#7f7f7f);text-align:center}
        .vol{display:flex;align-items:center;gap:14px;padding:6px 4px}
        .vol.dis{opacity:.45}
        .vlab{font-size:14px;color:var(--gray800,#afafaf);width:52px;flex:none}
        .vs{position:relative;flex:1;height:36px;cursor:pointer;touch-action:none}
        .vt{position:absolute;left:0;right:0;top:15px;height:6px;border-radius:3px;background:var(--gray300,#404040)}
        .vf{position:absolute;left:0;top:15px;height:6px;border-radius:3px;background:${PINK}}
        .vk{position:absolute;top:6px;width:24px;height:24px;border-radius:12px;background:var(--white,#fafafa);box-shadow:0 2px 8px rgba(0,0,0,0.4)}
        .vv{font-size:14px;color:var(--gray800,#afafaf);width:40px;text-align:right;flex:none}
        .vb{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));height:72px;border-radius:36px;background:var(--gray300,#404040);overflow:hidden}
        .vb button{height:100%;display:grid;place-items:center;color:var(--white,#fafafa);transition:background .15s}
        .vb button:active{background:rgba(255,255,255,0.08)}
      `;
    }
  }

  M.define('msh-media-hero-card', MediaHero, 'MSH Media · nå spilles', 'Sveipbar «nå spilles»-karusell med omslag for valgt fane. Første kort i Media-popupen.');
  M.define('msh-media-card', MediaCard, 'MSH Media', 'Faner (TV/Musikk), apper/kilder, transport eller fjernkontroll og volum for alle media_player.*');
})();
