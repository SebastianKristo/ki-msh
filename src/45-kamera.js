/* msh-kamera-card · Kamera-popup (#kamera) og eget kamera-dashbord. Kilde: Kamera v2.dc.html (ingen hero).
 * Profiler (config.profile): 'popup' (inni Bubble pop-up: ingen egen header, Bubble-headeren brukes) og
 * 'dashboard' (egen header med visning-meny ▾, tittel og antall, fill_screen/fill_breakpoint og valgfri
 * flytende «Tilbake»-pille via back_path). Standard: popup når kortet ligger i en Bubble pop-up, ellers dashboard.
 * Kameraliste: config.cameras som liste [{ name, icon, plain, frigate[], privacy, motion, last_motion, logbook[] }]
 * (ki-kamera-card-skjemaet), ellers autokonfig: alle camera.* gruppert per enhet (plain = high resolution
 * channel, medium/low-kanaler skjules, Frigate-kamera med samme navn/område legges under frigate[],
 * privacy/motion/last_motion fra samme enhet). Per-kamera-overstyring i objektform: cameras.<object_id>.
 * Rekkefølge/synlighet: config.order / config.hidden. Visning: layout (eller grid_layout: mosaikk,
 * hovedkamera, rutenett, liste, masonry, oversikt, fokus, 2x2, 3kol).
 * Utseende: cam_gap (mellomrom mellom kameraene, 0–24, std 6), show_name, show_badge, text_size (xs/s/m/l).
 *   Mellomrom leses cam_gap → gap → luft (YAML «gap»/«luft» fra ki-kamera-card virker fortsatt; gap vinner
 *   over luft). Editorene skriver cam_gap, så popupens egne Mellomrom (pad_top/pad_bottom, og popupens
 *   kort-gap i MSH._applySpacing) aldri blandes med kamerafliser.
 * Stillbilder: /api/camera_proxy/<id>?token=<access_token>, oppdateres hvert N. sekund KUN mens popupen er
 * åpen (onOpen/onClose). Fullskjerm = portalert overlegg (M.overlay) med ha-camera-stream når den finnes.
 * Hendelser: binary_sensor/event-entiteter på kameraets enhet + logbook/motion/last_motion. Frigate-modus:
 * frigate/events/get (WS) for dagens hendelser.
 * «Tilpass kameraer» = msh-kamera-editor (åpnes via MSH.openEditor, samme lagring som alle editorer);
 * GUI-editoren (getConfigElement) bruker samme config-skjema via msh-editor.
 */
(function () {
  const M = window.MSH, esc = M.esc, C = M.C;
  const PINK = C.accent;
  const LAYOUTS = [['mosaic', 'Mosaikk', 'dashboard'], ['main', 'Hovedkamera', 'space_dashboard'], ['grid', 'Rutenett', 'grid_view'], ['list', 'Liste', 'view_agenda'], ['masonry', 'Masonry', 'view_quilt'], ['overview', 'Oversikt', 'view_compact'], ['focus', 'Fokus', 'fullscreen'], ['2x2', '2×2', 'border_all'], ['3col', '3 kolonner', 'view_week']];
  // ki-kamera-card: grid_layout → visning
  const GL = { mosaikk: 'mosaic', hovedkamera: 'main', rutenett: 'grid', liste: 'list', masonry: 'masonry', oversikt: 'overview', fokus: 'focus', '2x2': '2x2', '3kol': '3col' };
  const TEXT = { xs: 11, s: 12, m: 14, l: 16 };
  const TEXT_OPTS = [['xs', 'XS'], ['s', 'S'], ['m', 'M'], ['l', 'L']];
  const GAP_PRESETS = [[0, 'Ingen'], [4, 'Tett'], [6, 'Standard'], [12, 'Luftig']];
  const PROFILES = [['auto', 'Automatisk'], ['popup', 'Popup'], ['dashboard', 'Dashbord']];
  const obj = (id) => String(id).split('.').slice(1).join('.');
  const arr = (v) => (v == null || v === '' ? [] : [].concat(v)).filter(Boolean);
  const entryId = (e) => (e && (e.plain || e.entity || e.camera || arr(e.frigate)[0])) || null;
  // Per-kamera-config: listeform (ki-kamera-card) eller objektform (cameras.<object_id>)
  const ccfg = (cfg, id) => {
    const cs = cfg && cfg.cameras;
    if (Array.isArray(cs)) return cs.find((e) => entryId(e) === id) || {};
    return (cs || {})[obj(id)] || {};
  };
  const devOf = (hass, id) => { const e = M.regEntry(hass, id); return (e && e.device_id) || null; };
  const sameDevice = (hass, id, domains) => { const d = devOf(hass, id); return d ? M.all(hass, domains, (s, x) => x !== id && devOf(hass, x) === d) : []; };
  const strip = (n) => String(n || '').replace(/\s+(high|medium|low)(\s+resolution)?(\s+channel)?$/i, '').replace(/\s+(high|medium|low)\s+resolution(\s+channel)?(?=\s|$)/i, '').trim();
  const hhmm = (t) => { const d = new Date(t); if (isNaN(d)) return '–'; const today = new Date().toDateString() === d.toDateString(); return (today ? '' : `${d.getDate()}.${d.getMonth() + 1} `) + `${M.pad(d.getHours())}:${M.pad(d.getMinutes())}`; };
  const slug = (s) => String(s || '').toLowerCase().replace(/ø/g, 'o').replace(/æ/g, 'ae').replace(/å/g, 'a').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const isFrig = (hass, id) => { const e = M.regEntry(hass, id); return !!(e && e.platform === 'frigate'); };
  const isLowRes = (hass, id) => /(^|[\s_])(medium|low)[\s_]+resolution/i.test(id + ' ' + M.name(hass, id));

  // Innstillinger med standardverdier (leses likt i kortet, editoren og GUI-skjemaet)
  const layoutOf = (c) => { const l = c.layout || GL[String(c.grid_layout || '').toLowerCase()]; return LAYOUTS.find((x) => x[0] === l) ? l : 'main'; };
  const gapOf = (c) => { const v = [c.cam_gap, c.gap, c.luft].find((x) => x != null && x !== '' && !isNaN(parseFloat(x))); return v != null ? Math.max(0, Math.min(48, parseFloat(v))) : 6; };
  const textOf = (c) => { const t = c.text_size; if (t != null && !isNaN(Number(t))) return Number(t); return TEXT[String(t || 'm').toLowerCase()] || 14; };
  const textKey = (c) => { const t = String(c.text_size || 'm').toLowerCase(); return TEXT[t] ? t : (Object.keys(TEXT).find((k) => TEXT[k] === Number(c.text_size)) || 'm'); };
  const srcMode = (c) => { const s = String(c.mode || c.default_source || '').toLowerCase(); return s === 'frigate' ? 'frigate' : 'live'; };

  // Autokonfig per enhet
  const autoPrivacy = (hass, id) => sameDevice(hass, id, 'switch').find((x) => /privacy|privat/i.test(x + ' ' + M.name(hass, x))) || null;
  const autoMotion = (hass, id) => { const l = sameDevice(hass, id, 'binary_sensor'); return l.find((x) => hass.states[x].attributes.device_class === 'motion') || l.find((x) => /motion|bevegelse/i.test(x)) || null; };
  const autoLastMotion = (hass, id) => sameDevice(hass, id, 'sensor').find((x) => /last_motion|siste_bevegelse|motion_detected|last_detect/i.test(x) || (hass.states[x].attributes.device_class === 'timestamp' && /motion|bevegelse/i.test(x))) || null;
  // Frigate-kamera → vanlig kamera med samme navn (prefiks/første ord) eller eneste kamera i samme område.
  const matchPlain = (hass, fid, plain) => {
    const fo = slug(obj(fid)), fn = slug(strip(M.name(hass, fid))), ft = fo.split('_')[0];
    let best = null, score = 0;
    plain.forEach((p) => {
      const dv = devOf(hass, p), dn = dv && hass.devices && hass.devices[dv] ? slug(hass.devices[dv].name_by_user || hass.devices[dv].name) : '';
      const cands = [slug(obj(p)), slug(strip(M.name(hass, p))), dn].filter(Boolean);
      let s = 0;
      if (cands.some((c) => c === fo || c === fn)) s = 4;
      else if (cands.some((c) => c.startsWith(fo + '_') || fo.startsWith(c + '_'))) s = 3;
      else if (ft.length > 2 && cands.some((c) => c.split('_')[0] === ft)) s = 2;
      if (s > score) { score = s; best = p; }
    });
    if (best) return best;
    const a = M.areaOf(hass, fid);
    if (!a) return null;
    const same = plain.filter((p) => M.areaOf(hass, p) === a);
    return same.length === 1 ? same[0] : null;
  };
  const camName = (hass, cfg, id) => { const c = ccfg(cfg, id), e = M.regEntry(hass, id); return c.name || (e && e.name) || strip(M.name(hass, id)) || obj(id); };
  const camModel = (hass, id) => { const d = devOf(hass, id), dv = d && hass.devices && hass.devices[d]; return (dv && dv.model) || ''; };
  const camIcon = (hass, cfg, id) => {
    const c = ccfg(cfg, id), e = M.regEntry(hass, id), s = hass.states[id], a = M.areaOf(hass, id);
    return c.icon || (e && e.icon) || (s && s.attributes.icon) || (a && hass.areas[a] && hass.areas[a].icon) || 'videocam';
  };

  // Full kameraliste som objekter: { id, frigate[], privacy, motion, last_motion, logbook[] }
  M.cameraList = function (hass, cfg) {
    cfg = cfg || {};
    if (!hass) return [];
    const ex = new Set(cfg.exclude || []);
    const fill = (id, o) => ({
      id,
      frigate: arr(o.frigate),
      privacy: o.privacy || autoPrivacy(hass, id),
      motion: o.motion || autoMotion(hass, id),
      last_motion: o.last_motion || autoLastMotion(hass, id),
      logbook: arr(o.logbook),
    });
    if (Array.isArray(cfg.cameras) && cfg.cameras.length) {
      const seen = new Set();
      return cfg.cameras.map((e) => [entryId(e), e]).filter(([id]) => id && hass.states[id] && !ex.has(id) && !seen.has(id) && seen.add(id)).map(([id, e]) => fill(id, e));
    }
    let ids = M.applyLists(cfg, 'kameraer', M.all(hass, 'camera'));
    if (cfg.area) ids = ids.filter((id) => M.areaOf(hass, id) === cfg.area);
    ids = ids.filter((id) => hass.states[id]);
    const inc = new Set((cfg.include && cfg.include.kameraer) || []);
    // medium/low-kanaler skjules når enheten har en annen kanal
    const byDev = {};
    ids.forEach((id) => { const d = devOf(hass, id); if (d) (byDev[d] = byDev[d] || []).push(id); });
    ids = ids.filter((id) => inc.has(id) || !isLowRes(hass, id) || !(byDev[devOf(hass, id)] || []).some((x) => x !== id && !isLowRes(hass, x)));
    // Frigate-kamera → under vanlig kamera med samme navn/område
    const plain = ids.filter((id) => !isFrig(hass, id)), extra = {};
    ids = ids.filter((id) => {
      if (!isFrig(hass, id) || inc.has(id)) return true;
      const m = matchPlain(hass, id, plain);
      if (!m) return true;
      (extra[m] = extra[m] || []).push(id);
      return false;
    });
    // standardrekkefølge: per område (etasje/navn), deretter navn
    const aIdx = {};
    M.areas(hass).forEach((a, i) => { aIdx[a.id] = i; });
    const ai = (id) => { const a = M.areaOf(hass, id); return a ? (aIdx[a] != null ? aIdx[a] : 98) : 99; };
    ids.sort((a, b) => ai(a) - ai(b) || camName(hass, cfg, a).localeCompare(camName(hass, cfg, b), 'nb'));
    return ids.map((id) => { const o = ccfg(cfg, id); return fill(id, { ...o, frigate: [...arr(o.frigate), ...(extra[id] || [])] }); });
  };
  M.cameras = (hass, cfg) => M.cameraList(hass, cfg).map((c) => c.id);
  // Synlige kameraer i riktig rekkefølge (order/hidden)
  const ordered = (all, cfg) => {
    const ids = all.map((c) => c.id);
    const ord = (Array.isArray(cfg.order) ? cfg.order : []).filter((x) => ids.includes(x));
    ids.forEach((x) => { if (!ord.includes(x)) ord.push(x); });
    return ord;
  };
  const autoLight = (hass, id) => sameDevice(hass, id, 'light')[0] || sameDevice(hass, id, 'switch').find((x) => /flood|light|lys|spot|lamp/i.test(x)) || null;
  const autoSiren = (hass, id) => sameDevice(hass, id, 'siren')[0] || sameDevice(hass, id, 'switch').find((x) => /siren|sirene|alarm/i.test(x)) || null;
  const EVK = [[/person|people/, 'person', 'Person'], [/vehicle|car|bil\b|kjoretoy|kjøretøy/, 'directions_car', 'Bil'], [/animal|pet|dog|cat|dyr|hund|katt/, 'pets', 'Dyr'], [/package|pakke/, 'package_2', 'Pakke'], [/doorbell|ring/, 'notifications', 'Ringeklokke'], [/motion|occupancy|bevegelse/, 'directions_walk', 'Bevegelse'], [/sound|audio|lyd/, 'graphic_eq', 'Lyd']];
  const evKind = (id, s) => {
    const a = s.attributes || {}, hay = [a.device_class, a.event_type, id].filter(Boolean).join(' ').toLowerCase();
    for (const [re, icon, label] of EVK) if (re.test(hay)) return { icon, label };
    return null;
  };
  const FLABEL = { person: ['person', 'Person'], car: ['directions_car', 'Bil'], motorcycle: ['mdi:motorbike', 'Motorsykkel'], bicycle: ['directions_bike', 'Sykkel'], dog: ['pets', 'Hund'], cat: ['pets', 'Katt'], bird: ['mdi:bird', 'Fugl'], package: ['package_2', 'Pakke'], horse: ['pets', 'Hest'], bear: ['pets', 'Bjørn'] };
  const camImg = (hass, id, tick) => {
    const s = hass && hass.states[id];
    if (!s) return '';
    const a = s.attributes;
    let u;
    if (a.access_token) u = `/api/camera_proxy/${id}?token=${encodeURIComponent(a.access_token)}`;
    else if (a.entity_picture) u = a.entity_picture;
    else return '';
    u += (u.includes('?') ? '&' : '?') + '_t=' + (tick || 0);
    return u[0] === '/' && hass.hassUrl ? hass.hassUrl(u) : u;
  };

  class Kamera extends M.Card {
    static get cardName() { return 'Kamera'; }
    static get defaults() { return { refresh: 10 }; }
    // Ren UI-tilstand (Direkte/Frigate, valgt chip/kamera) – localStorage ki:<card_id>:ui, aldri Lovelace.
    static get uiPersist() { return ['mode', 'view']; }
    static get schema() {
      return (h, c) => {
        c = c || {};
        const all = h ? M.cameras(h, c) : [], isArr = Array.isArray(c.cameras) && c.cameras.length;
        return [
          { type: 'section', label: 'Profil', icon: 'mdi:monitor-dashboard', open: true, fields: [
            { type: 'select', name: 'profile', label: 'Profil', options: PROFILES, default: 'auto', help: 'Automatisk = popup inni Bubble pop-up, ellers dashbord' },
            { type: 'text', name: 'title', label: 'Tittel (dashbord)', placeholder: 'Kamera' },
            { type: 'text', name: 'back_path', label: '«Tilbake»-knapp (dashbord)', placeholder: '/dashboard-mysmarthome', help: 'Sti å navigere til. Tomt = ingen knapp' },
            { type: 'boolean', name: 'fill_screen', label: 'Fyll skjermen (flere kolonner på bred skjerm)', default: false },
            { type: 'number', name: 'fill_breakpoint', label: 'Bredde for flere kolonner (px)', min: 320, max: 3000, default: 700 },
          ] },
          { type: 'section', label: 'Visning', icon: 'mdi:view-dashboard', open: true, fields: [
            { type: 'select', name: 'layout', label: 'Oppsett', options: LAYOUTS.map(([k, l]) => [k, l]), default: layoutOf(c) },
            { type: 'select', name: 'mode', label: 'Startmodus', options: [['live', 'Direkte'], ['frigate', 'Frigate']], default: srcMode(c) },
            { type: 'select', name: 'view', label: 'Startvisning', options: [['alle', 'Alle'], ['events', 'Hendelser']], default: 'alle' },
            { type: 'number', name: 'refresh', label: 'Oppdater stillbilder (sekunder)', min: 2, max: 300, default: 10, help: 'Kun mens popupen er åpen' },
            { type: 'text', name: 'frigate_instance', label: 'Frigate-instans', placeholder: 'frigate' },
            { type: 'area', name: 'area', label: 'Begrens til område', help: 'Tomt = alle camera.*' },
            { type: 'boolean', name: 'toasts', label: 'Bekreftelsesmeldinger', default: true },
          ] },
          { type: 'section', label: 'Utseende', icon: 'mdi:palette-outline', open: true, fields: [
            { type: 'range', name: 'cam_gap', label: 'Mellomrom mellom kameraer', icon: 'mdi:arrow-expand-horizontal', min: 0, max: 24, default: gapOf(c), presets: GAP_PRESETS.map(([v, l]) => [v, `${l} ${v}`]), help: 'Leser også gap / luft fra YAML' },
            { type: 'boolean', name: 'show_name', label: 'Vis navn på kameraene', default: true },
            { type: 'boolean', name: 'show_badge', label: 'Vis «OPPTAK»-merke', default: true },
            { type: 'select', name: 'text_size', label: 'Tekststørrelse', options: TEXT_OPTS, default: textKey(c) },
          ] },
          { type: 'section', label: 'Hendelser', icon: 'mdi:motion-play-outline', fields: [
            { type: 'boolean', name: 'show_events', label: 'Vis «Hendelser»', default: true },
            { type: 'number', name: 'events_limit', label: 'Maks antall hendelser', min: 1, max: 100, default: 30 },
            { type: 'number', name: 'events_columns', label: 'Kolonner', min: 1, max: 4, default: 1 },
            { type: 'text', name: 'events_height', label: 'Maks høyde', placeholder: 'f.eks. 500px', help: 'Tomt = ingen grense' },
          ] },
          { type: 'order', name: 'order', hiddenName: 'hidden', label: 'Kameraer som vises', options: all.map((id) => [id, h ? camName(h, c, id) : id]) },
          ...(isArr ? [] : [{ type: 'lists', label: 'Kameraer (autokonfig)', lists: (hh) => [{ key: 'kameraer', label: 'Kameraer', ids: M.all(hh, 'camera'), domains: ['camera'] }] }]),
          ...all.map((id) => {
            const o = obj(id), i = isArr ? c.cameras.findIndex((e) => entryId(e) === id) : -1, b = isArr ? `cameras.${i}` : `cameras.${o}`;
            return { type: 'section', id: 'c_' + o, icon: 'mdi:cctv', label: camName(h, c, id), fields: [
              { type: 'text', name: b + '.name', label: 'Navn', auto: (hh) => strip(M.name(hh, id)) },
              { type: 'icon', name: b + '.icon', label: 'Ikon', placeholder: 'mdi:cctv' },
              { type: 'entity', name: b + '.light', label: 'Lys', domains: ['light', 'switch'], auto: (hh) => autoLight(hh, id) },
              { type: 'entity', name: b + '.siren', label: 'Sirene', domains: ['siren', 'switch'], auto: (hh) => autoSiren(hh, id) },
              { type: 'entity', name: b + '.talk', label: 'Snakk (script/button)', domains: ['script', 'button', 'input_button'] },
              { type: 'entity', name: b + '.privacy', label: 'Personvern-modus', domains: ['switch'], auto: (hh) => autoPrivacy(hh, id) },
              { type: 'entity', name: b + '.motion', label: 'Bevegelse', domains: ['binary_sensor'], auto: (hh) => autoMotion(hh, id) },
              { type: 'entity', name: b + '.last_motion', label: 'Siste bevegelse', domains: ['sensor'], auto: (hh) => autoLastMotion(hh, id) },
            ] };
          }),
          // Popupens Mellomrom (pad_top/pad_bottom over navbaren). Popupens kort-gap («gap») er utelatt her:
          // i kamerakortet er gap/luft mellomrommet mellom kameraene (ki-kamera-card), se cam_gap over.
          (() => { const sp = M.spacingSchema ? M.spacingSchema(Kamera.spacingDefaults) : null; return sp ? { ...sp, fields: sp.fields.filter((f) => f.name !== 'gap') } : { type: 'info', label: '' }; })(),
        ];
      };
    }
    get cardSize() { return 8; }
    get toasts() { return this.config.toasts !== false; }
    // popup / dashboard (auto: popup når kortet ligger i en Bubble pop-up)
    get profile() {
      const p = this.config.profile;
      if (p === 'popup' || p === 'dashboard') return p;
      return M.popupHash(this) || M.popupContainer(this) ? 'popup' : 'dashboard';
    }
    // «Tilpass kameraer»: eget ark (Profil · Visning · Utseende · Kameraer som vises). Per-kamera-felt
    // (lys/sirene/navn …) ligger i det felles skjemaet («Flere innstillinger»).
    customize(focus, opts) {
      if (this._config && this._config.embedded && this._host) return this._host.customize(focus, opts);
      if (focus === 'advanced' || !customElements.get('msh-kamera-editor')) return super.customize(focus === 'advanced' ? null : focus, opts);
      const r = M.openEditor(this, { cardClass: this.constructor, focus, tag: 'msh-kamera-editor', ...(opts || {}) });
      if (r) {
        r.editor.card = this;
        const sh = r.overlay && r.overlay.root && r.overlay.root.querySelector('.sh');
        if (sh) { sh.style.background = '#282828'; sh.style.padding = '16px 8px calc(24px + env(safe-area-inset-bottom))'; }
      }
      return r;
    }

    /* ---------------- åpen/lukket: stillbilde-oppdatering kun mens popupen er åpen */
    onOpen() {
      this._tick = Date.now();
      clearInterval(this._iv);
      const sec = Math.max(2, Number(this.config.refresh) || 10);
      this._iv = setInterval(() => {
        if (document.hidden) return;
        this._tick = Date.now();
        if (this._mode() === 'frigate' && ++this._fn % 6 === 0) this._loadFrigate();
        this.update();
      }, sec * 1000);
      this._fn = 0;
      if (this._mode() === 'frigate') this._loadFrigate();
      this.update();
    }
    onClose() {
      clearInterval(this._iv);
      this._iv = null;
      // Stopp strømmer/stillbilde-oppdatering i HA-elementene mens popupen er lukket.
      if (this.shadowRoot) this.shadowRoot.querySelectorAll('.strm').forEach((n) => n.replaceChildren());
      if (this._drop) { this._drop.close(); this._drop = null; }
    }
    disconnectedCallback() {
      super.disconnectedCallback();
      if (this._ro) { this._ro.disconnect(); this._ro = null; }
    }
    _mode() { return this.ui.mode || srcMode(this.config); }

    /* ---------------- bilder */
    _img(id) { return camImg(this.hass, id, this._tick); }
    // Direkte bilde/strøm via HAs egne elementer når de finnes (hui-image camera_view:auto i flisene,
    // ha-camera-stream i enkeltvisning); ellers stillbilde fra camera_proxy/entity_picture.
    _liveTag(id, kind) {
      const tag = kind === 'stream' ? 'ha-camera-stream' : 'hui-image';
      if (!customElements.get(tag)) return '';
      return `<div class="strm" data-nomorph data-cam="${esc(id)}" data-kind="${kind}" data-key="strm-${kind}-${esc(id)}"></div>`;
    }
    _media(id, kind) { return this._liveTag(id, kind) || this._imgTag(id, this._img(id)); }
    _imgTag(key, src, cls = 'im') {
      if (!src) return '';
      this._bad = this._bad || new Set();
      return `<img class="${cls} ${this._bad.has(key) ? 'bad' : ''}" data-bk="${esc(key)}" data-key="img-${esc(key)}" src="${esc(src)}" alt="" draggable="false">`;
    }
    _badge(s, solid, compact, cam) {
      const st = s ? s.state : 'unavailable', priv = cam && cam.privacy && M.isOn(this.s(cam.privacy));
      const B = priv ? ['PRIVAT', 'var(--gray700,#979797)'] : st === 'recording' ? ['OPPTAK', C.red] : st === 'streaming' ? ['DIREKTE', C.green] : M.unavailable(s) ? ['FRAKOBLET', 'var(--gray600,#7f7f7f)'] : null;
      if (!B) return '';
      if (compact) return `<span class="bdg cp" title="${B[0]}"><i style="background:${B[1]}"></i></span>`;
      return solid ? `<span class="bdg solid" style="background:${B[1]}"><i></i>${B[0]}</span>` : `<span class="bdg"><i style="background:${B[1]}"></i>${B[0]}</span>`;
    }

    /* ---------------- hendelser: entiteter på kameraets enhet + logbook/motion/last_motion */
    _events(cam) {
      const h = this.hass, id = cam.id, dev = devOf(h, id), since = Date.now() - 86400000;
      const ids = new Set([...arr(cam.logbook), ...arr(cam.motion)]);
      if (dev) Object.keys(h.entities || {}).forEach((x) => { if (h.entities[x].device_id === dev && /^(binary_sensor|event)\./.test(x) && M.usable(h, x)) ids.add(x); });
      const out = [];
      ids.forEach((x) => {
        const d = x.split('.')[0], s = this.s(x);
        if (!s || M.unavailable(s)) return;
        const k = evKind(x, s) || (ids.has(x) && arr(cam.logbook).includes(x) ? { icon: M.domainIcon(x, s), label: M.name(h, x) } : null);
        if (!k) return;
        const ts = d === 'event' ? Date.parse(s.state) : Date.parse(s.last_changed);
        if (!ts || ts < since) return;
        out.push({ ...k, id: x, cam: id, ts, now: d === 'binary_sensor' && s.state === 'on' });
      });
      // siste bevegelse (tidsstempel-sensor)
      const lm = cam.last_motion && this.s(cam.last_motion), lt = lm && !M.unavailable(lm) ? Date.parse(lm.state) : NaN;
      if (lt && lt >= since && !out.some((e) => Math.abs(e.ts - lt) < 60000)) out.push({ icon: 'directions_walk', label: 'Bevegelse', id: cam.last_motion, cam: id, ts: lt, now: false });
      return out.sort((a, b) => b.ts - a.ts);
    }

    /* ---------------- Frigate */
    _frigateCams() { const h = this.hass; return Object.keys(h.entities || {}).filter((id) => id.startsWith('camera.') && h.entities[id].platform === 'frigate' && h.states[id]); }
    async _loadFrigate() {
      const h = this.hass;
      if (!h || !this._frigateCams().length) { this._fr = { ok: false, none: true, list: [] }; return this.update(); }
      const start = new Date(); start.setHours(0, 0, 0, 0);
      try {
        let r = await h.callWS({ type: 'frigate/events/get', instance_id: this.config.frigate_instance || 'frigate', after: Math.floor(start.getTime() / 1000), limit: 50 });
        if (typeof r === 'string') r = JSON.parse(r);
        this._fr = { ok: Array.isArray(r), list: Array.isArray(r) ? r : [] };
      } catch (e) { this._fr = { ok: false, list: [] }; }
      this.update();
    }

    /* ---------------- render */
    render() {
      const h = this.hass, cfg = this.config, ui = this.ui;
      const all = M.cameraList(h, cfg);
      this._cams = new Map(all.map((c) => [c.id, c]));
      all.forEach((c) => this.s(c.id));
      const hid = new Set(cfg.hidden || []), vis = ordered(all, cfg).filter((x) => !hid.has(x));
      this._vis = vis;
      const dash = this.profile === 'dashboard', mode = this._mode(), showEv = cfg.show_events !== false;
      let view = ui.view || cfg.view || 'alle';
      if ((view !== 'alle' && view !== 'events' && !vis.includes(view)) || (view === 'events' && !showEv)) view = 'alle';
      const modes = [['live', 'Direkte', 'videocam'], ['frigate', 'Frigate', 'history']].map(([k, l, i]) => `<button class="md ${mode === k ? 'on' : ''}" data-act="mode" data-v="${k}" data-haptic="selection">${M.icon(i, 18)}${l}</button>`).join('');
      // Visning-meny (▾): i popup til høyre for Direkte/Frigate, i dashbord i headeren
      const top = `<div class="top"><div class="seg">${modes}</div>${dash ? '' : `<button class="tune ${this._drop ? 'on' : ''}" data-act="drop" title="Visning">${M.icon('tune', 22)}</button>`}</div>`;
      const head = dash ? `<div class="hd"><button class="hb ${this._drop ? 'on' : ''}" data-act="drop" title="Visning"><span class="hi">${M.icon(cfg.icon || 'videocam', 22)}</span>${M.icon('mdi:chevron-down', 18, 'color:var(--gray700,#979797)')}</button><span class="ht ell">${esc(cfg.title || 'Kamera')}</span><span class="hc">${vis.length} ${vis.length === 1 ? 'kamera' : 'kameraer'}</span></div>` : '';
      const back = dash && cfg.back_path ? `<button class="back" data-act="back" data-haptic="light">${M.icon('mdi:chevron-left', 22)}<span>Tilbake</span></button>` : '';
      const wrap = (inner) => `<div class="k ${dash ? 'dash' : 'pop'} ${back ? 'hasback' : ''}" style="--cg:${gapOf(cfg)}px;--tfs:${textOf(cfg)}px">${head}${top}${inner}</div>${back}`;
      if (!all.length) return wrap(M.emptyState('Fant ingen kameraer', 'entities'));
      if (mode === 'frigate') return wrap(this._frigate());
      const chip = (k, label, icon) => `<button class="ch ${view === k ? 'on' : ''}" data-act="view" data-v="${esc(k)}" data-haptic="selection" data-key="${esc(k)}">${M.icon(icon, 17)}<span>${esc(label)}</span></button>`;
      const chips = `<div class="chips noscroll">${chip('alle', 'Alle', 'grid_view')}${showEv ? chip('events', 'Hendelser', 'motion_play') : ''}${vis.map((id) => chip(id, camName(h, cfg, id), camIcon(h, cfg, id))).join('')}</div>`;
      let body = '';
      if (view === 'alle') body = this._grid(vis);
      else if (view === 'events') body = this._eventList(vis);
      else body = this._single(view);
      return wrap(chips + body);
    }
    _grid(vis) {
      const h = this.hass, cfg = this.config, L = layoutOf(cfg), wide = !!this._wide;
      let cols = L === 'list' || L === 'focus' ? 1 : L === 'overview' || L === '3col' ? 3 : 2;
      if (wide && L !== 'focus' && L !== '2x2') cols = cols === 1 ? 2 : cols === 2 ? 4 : 5; // fill_screen over breakpoint
      const k = wide ? 1.5 : 1, R = (v) => Math.round(v * 0.9 * k); // radhøyde ×0,9 (Kamera v2)
      const span = (i) => {
        if (L === 'mosaic') return i === 0 ? [1, 2] : i < 5 ? [1, 1] : [2, 1];
        if (L === 'main') return i === 0 ? [cols, 1] : [1, 1];
        if (L === 'masonry') return [1, i % 3 === 0 ? 2 : 1];
        return [1, 1];
      };
      const rowH = L === 'overview' || L === '3col' ? R(110) : L === 'list' || L === 'focus' ? R(220) : R(120);
      const list = L === '2x2' ? vis.slice(0, 4) : L === 'focus' ? vis.slice(0, 1) : vis;
      if (!list.length) return M.emptyState('Alle kameraer er skjult', 'sections');
      const showName = cfg.show_name !== false, showBadge = cfg.show_badge !== false;
      const tiles = list.map((id, i) => {
        const [cs, rs] = span(i), s = this.s(id), model = showName && (cs > 1 || cols === 1) ? camModel(h, id) : '';
        return `<div class="tile" data-act="view" data-v="${esc(id)}" data-ent="${esc(id)}" data-key="${esc(id)}" style="grid-column:span ${Math.min(cs, cols)};grid-row:span ${rs}">
          <span class="ph">${M.icon(camIcon(h, cfg, id), 26)}</span>${this._media(id, 'image')}
          <span class="shade"></span>${showBadge ? this._badge(s, false, cols > 2, this._cams.get(id)) : ''}
          <button class="full" data-act="full" data-v="${esc(id)}" title="Fullskjerm">${M.icon('mdi:arrow-expand', 16)}</button>
          ${showName ? `<span class="tn ell">${esc(camName(h, cfg, id))}</span>${model ? `<span class="tm ell">${esc(model)}</span>` : ''}` : ''}
        </div>`;
      }).join('');
      // «Hovedkamera»: første flis over hele bredden, resten to og to.
      const rows = L === 'main' ? `grid-template-rows:${R(210)}px;grid-auto-rows:${R(104)}px` : `grid-auto-rows:${rowH}px`;
      return `<div class="grid" data-l="${L}" style="grid-template-columns:repeat(${cols},minmax(0,1fr));${rows}">${tiles}</div>`;
    }
    _single(id) {
      const h = this.hass, cfg = this.config, s = this.s(id), cc = ccfg(cfg, id), cam = this._cams.get(id) || { id };
      const light = cc.light || autoLight(h, id), siren = cc.siren || autoSiren(h, id), talk = cc.talk || null, priv = cam.privacy || null;
      [light, siren, talk, priv].forEach((x) => x && this.s(x));
      const lOn = light && M.isOn(this.s(light)), sOn = siren && M.isOn(this.s(siren)), pOn = priv && M.isOn(this.s(priv));
      const acts = [['talk', 'mdi:microphone', 'Snakk', talk, null], ['light', 'flashlight_on', 'Lys', light, lOn ? C.yellow : null], ['siren', 'campaign', 'Sirene', siren, sOn ? C.red : null]];
      if (priv) acts.push(['privacy', pOn ? 'mdi:eye-off' : 'mdi:eye', 'Privat', priv, pOn ? C.pink : null]);
      acts.push(['snap', 'photo_camera', 'Bilde', !M.unavailable(s) ? id : null, null]);
      const ev = this._events(cam);
      return `<div class="one" data-ent="${esc(id)}" data-key="one-${esc(id)}">
          <span class="ph">${M.icon(camIcon(h, cfg, id), 40)}</span>${this._media(id, 'stream')}
          <span class="shade1"></span>${cfg.show_badge !== false ? this._badge(s, true, false, cam) : ''}
          <button class="full" data-act="full" data-v="${esc(id)}" title="Fullskjerm">${M.icon('mdi:arrow-expand', 16)}</button>
          ${cfg.show_name !== false ? `<span class="on1 ell">${esc(camName(h, cfg, id))}</span><span class="om">${esc(camModel(h, id))}</span>` : ''}
        </div>
        <div class="acts" style="grid-template-columns:repeat(${acts.length},minmax(0,1fr))">${acts.map(([k, ic, l, ent, col]) => `<button class="ac press" data-act="ca" data-k="${k}" data-v="${esc(ent || '')}" ${ent ? '' : 'disabled'} style="color:${ent ? 'var(--white,#fafafa)' : 'var(--gray500,#696969)'}">${M.icon(ic, 24, col ? 'color:' + col : '')}<span>${l}</span></button>`).join('')}</div>
        <span class="sec">Siste hendelser</span>
        ${ev.length ? ev.slice(0, this._evLimit()).map((e) => `<div class="er" data-ent="${esc(e.id)}" data-key="${esc(e.id)}"><span class="ei">${M.icon(e.icon, 22)}</span><span class="el ell">${esc(e.label)}</span><span class="et">${e.now ? 'nå' : hhmm(e.ts)}</span></div>`).join('') : '<div class="none">Ingen hendelser</div>'}`;
    }
    _evLimit() { const n = Number(this.config.events_limit); return n > 0 ? n : 30; }
    // Hendelsesliste: events_columns / events_height (dashbord-oppsett fra ki-kamera-card)
    _evWrap(rows) {
      const c = this.config, cols = Math.max(1, Math.min(4, Number(c.events_columns) || 1)), hgt = c.events_height != null && c.events_height !== '' ? (isNaN(Number(c.events_height)) ? String(c.events_height) : c.events_height + 'px') : '';
      return `<div class="evl" style="grid-template-columns:repeat(${this._wide || cols === 1 ? cols : Math.min(cols, 2)},minmax(0,1fr));${hgt ? `max-height:${esc(hgt)};overflow-y:auto;overscroll-behavior:contain` : ''}">${rows}</div>`;
    }
    _eventList(vis) {
      const h = this.hass, cfg = this.config;
      const seen = new Set();
      const ev = vis.flatMap((id) => this._events(this._cams.get(id) || { id })).filter((e) => !seen.has(e.id) && seen.add(e.id)).sort((a, b) => b.ts - a.ts).slice(0, this._evLimit());
      if (!ev.length) return '<div class="none">Ingen hendelser siste døgn</div>';
      return this._evWrap(ev.map((e) => `<button class="evr" data-act="view" data-v="${esc(e.cam)}" data-ent="${esc(e.id)}" data-key="${esc(e.id)}">
        <span class="th"><span class="ph">${M.icon(e.icon, 22)}</span>${this._imgTag('t:' + e.cam, this._img(e.cam))}</span>
        <span class="tx"><span class="t1">${esc(e.label)}</span><span class="t2 ell">${esc(camName(h, cfg, e.cam))} · ${e.now ? 'nå' : hhmm(e.ts)}</span></span>
        ${M.icon('play_circle', 22, 'color:var(--gray700,#979797)')}</button>`).join(''));
    }
    _frigate() {
      const h = this.hass, cfg = this.config, fr = this._fr || { ok: false, list: [] };
      const cams = this._frigateCams();
      if (!cams.length) return `<div class="empty">${M.icon('history', 22)}<span>Fant ingen Frigate-kameraer (integrasjonen «frigate»)</span></div>`;
      const L = fr.list || [], cnt = (lab) => L.filter((e) => e.label === lab).length;
      const stats = [[fr.ok ? L.length : '–', 'Hendelser i dag'], [fr.ok ? cnt('person') : '–', 'Personer'], [fr.ok ? cnt('car') : '–', 'Biler']];
      const inst = cfg.frigate_instance || 'frigate';
      // Frigate-kameranavn → vårt kamera (via cameras[].frigate) → visningsnavn
      const byCam = (c) => {
        const fid = cams.find((x) => obj(x) === c) || (h.states['camera.' + c] ? 'camera.' + c : null);
        const own = [...(this._cams || new Map()).values()].find((x) => x.id === fid || (fid && x.frigate.includes(fid)) || x.frigate.includes('camera.' + c));
        return own ? camName(h, cfg, own.id) : fid ? camName(h, cfg, fid) : String(c || '').replace(/_/g, ' ');
      };
      const rows = L.slice(0, this._evLimit()).map((e) => {
        const f = FLABEL[e.label] || ['sensors', e.label ? e.label[0].toUpperCase() + e.label.slice(1) : 'Hendelse'];
        const sc = e.top_score != null ? e.top_score : e.data && e.data.top_score != null ? e.data.top_score : e.score;
        const thumb = `/api/frigate/${encodeURIComponent(inst)}/notifications/${encodeURIComponent(e.id)}/thumbnail.jpg`;
        return `<div class="evr" data-key="${esc(e.id)}"><span class="th"><span class="ph">${M.icon(f[0], 22)}</span>${this._imgTag('f:' + e.id, h.hassUrl ? h.hassUrl(thumb) : thumb)}</span>
          <span class="tx"><span class="t1 fl">${M.icon(f[0], 18)}${esc(f[1])}</span><span class="t2 ell">${esc(byCam(e.camera))} · ${hhmm((e.start_time || 0) * 1000)}${sc != null ? ' · ' + Math.round(sc * 100) + ' %' : ''}</span></span></div>`;
      }).join('');
      return `<div class="fs">${stats.map(([v, l]) => `<div class="fst"><span class="fv num">${esc(v)}</span><span class="fl2">${esc(l)}</span></div>`).join('')}</div>
        ${rows ? this._evWrap(rows) : `<div class="none">${fr.ok ? 'Ingen hendelser i dag' : 'Henter hendelser fra Frigate …'}</div>`}`;
    }

    /* ---------------- handlinger */
    onAction(name, el, ev) {
      const d = el.dataset, h = this.hass;
      switch (name) {
        case 'mode':
          this.setUI({ mode: d.v });
          if (d.v === 'frigate') this._loadFrigate();
          return;
        case 'view': return this.setUI({ view: d.v });
        case 'full': return this._full(d.v);
        case 'drop': return this._openDrop(el);
        case 'back': return M.navigate(this.config.back_path);
        case 'ca': {
          const k = d.k, ent = d.v;
          if (!ent) return;
          if (k === 'snap') return this._snap(ent);
          if (k === 'talk') { const dm = ent.split('.')[0]; return M.call(h, dm, dm === 'script' ? 'turn_on' : 'press', { entity_id: ent }); }
          const lab = k === 'light' ? 'Lys' : k === 'privacy' ? 'Personvern' : 'Sirene';
          return M.toggle(h, ent).then(() => { if (this.toasts) M.toast(`${lab} ${M.isOn(h.states[ent]) ? 'av' : 'på'}`); });
        }
        default:
      }
      return super.onAction(name, el, ev);
    }
    async _save(patch) {
      const old = this._rawConfig || this.config, n = { ...old, ...patch };
      this.setConfig(n);
      const r = await M.saveCardConfig(this.hass, old, n, { card: this });
      if (r && r.config) this.setConfig(r.config);
    }
    async _snap(id) {
      const url = this._img(id);
      try {
        const r = await fetch(url, { credentials: 'same-origin' });
        if (!r.ok) throw new Error(r.status);
        const b = await r.blob(), a = document.createElement('a'), t = new Date();
        a.href = URL.createObjectURL(b);
        a.download = `${obj(id)}_${t.getFullYear()}${M.pad(t.getMonth() + 1)}${M.pad(t.getDate())}_${M.pad(t.getHours())}${M.pad(t.getMinutes())}${M.pad(t.getSeconds())}.jpg`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
        if (this.toasts) M.toast('Bilde lagret');
      } catch (e) { M.toast('Kunne ikke hente bilde'); }
    }
    // «Visning»-meny: portalert (aldri position:fixed i kortet), ankret under ▾-knappen
    // (popup: høyrejustert under tune-knappen, dashbord: venstrejustert under header-ikonet).
    _openDrop(btn) {
      if (this._drop) { this._drop.close(); return; }
      const R = M.dashRect(), r = btn.getBoundingClientRect(), L = layoutOf(this.config), dash = this.profile === 'dashboard';
      const top = r.bottom + 8, pos = dash ? `left:${Math.max(8, r.left - R.left)}px!important;right:auto!important` : `left:auto!important;right:${Math.max(8, R.left + R.width - r.right)}px!important`;
      const html = `<span class="dt">Visning</span>${LAYOUTS.map(([k, l, i]) => `<button class="di ${L === k ? 'on' : ''}" data-l="${k}">${M.icon(i, 20)}<span class="dl">${esc(l)}</span>${M.icon('check', 18, `color:${C.pink};opacity:${L === k ? 1 : 0}`)}</button>`).join('')}
        <div class="sep"></div><button class="di mu" data-l="_edit">${M.icon('tune', 20)}<span class="dl">Tilpass kameraer…</span></button>`;
      const css = `.bg{background:transparent!important}
        .sh{${pos};top:${top}px!important;bottom:auto!important;width:230px;max-width:230px!important;margin:0!important;padding:8px!important;border-radius:22px!important;background:var(--gray300,#404040)!important;box-shadow:0 18px 40px rgba(0,0,0,0.5)!important;transform:scale(.96)!important;transform-origin:${dash ? 'top left' : 'top right'};max-height:calc(100% - ${top + 16}px)!important}
        :host(.on) .sh{transform:none!important}
        .body{display:flex;flex-direction:column;gap:2px}
        .dt{font-size:12px;color:var(--gray700,#979797);padding:4px 10px 6px}
        .di{height:42px;padding:0 10px;border-radius:14px;display:flex;align-items:center;gap:12px;font-size:14px;font-weight:500;color:var(--white,#fafafa);background:transparent;width:100%}
        .di.on{background:rgba(255,255,255,0.08)} .dl{flex:1;text-align:left}
        .di.mu{height:44px;color:var(--gray800,#afafaf)}
        .sep{height:1px;background:rgba(255,255,255,0.1);margin:4px 8px}`;
      const ov = M.overlay({ html, css, sheet: false, onClose: () => { this._drop = null; this.update(); } });
      this._drop = ov;
      this.update();
      ov.root.addEventListener('click', (e) => {
        const b = e.target.closest && e.target.closest('[data-l]');
        if (!b) return;
        M.haptic('selection');
        const k = b.dataset.l;
        ov.close();
        if (k === '_edit') return this.customize();
        this.setUI({ view: 'alle' });
        if (k !== layoutOf(this.config)) this._save({ layout: k }); // visningsvalget er config
      });
    }
    // Fullskjerm/utvidet visning: portalert, ha-camera-stream når tilgjengelig, ellers stillbilde hvert 2. s.
    _full(id) {
      const h = this.hass, cfg = this.config, s = h.states[id];
      if (!s) return;
      const html = `<div class="fh"><span class="fn ell">${esc(camName(h, cfg, id))}</span><span class="fm">${esc(camModel(h, id))}</span><button class="x" data-x="close" title="Lukk">${M.icon('close', 22)}</button></div>
        <div class="fv"><span class="fph">${M.icon(camIcon(h, cfg, id), 40)}</span></div>
        <div class="fa"><button data-x="snap">${M.icon('photo_camera', 20)}Bilde</button><button data-x="more">${M.icon('open_in_new', 20)}Mer info</button></div>`;
      const css = `.sh{padding:14px!important;background:var(--gray000,#232323)!important}
        .fh{display:flex;align-items:center;gap:10px;padding:0 2px 12px}
        .fn{flex:1;min-width:0;font-size:18px;font-weight:600} .fm{font-size:12px;color:var(--gray700,#979797)}
        .x{width:44px;height:44px;border-radius:22px;background:var(--gray300,#404040);display:grid;place-items:center;flex:none}
        .fv{position:relative;width:100%;aspect-ratio:16/9;border-radius:22px;overflow:hidden;background:var(--gray200,#3a3a3a);display:grid;place-items:center}
        .fv img,.fv ha-camera-stream{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;display:block}
        .fph{color:var(--gray600,#7f7f7f)}
        .fa{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding-top:12px}
        .fa button{height:52px;border-radius:26px;background:var(--gray200,#3a3a3a);display:flex;align-items:center;justify-content:center;gap:8px;font-size:14px;font-weight:500}`;
      let t = null;
      const ov = M.overlay({ html, css, center: true, maxWidth: 1100, onClose: () => clearInterval(t) });
      const fv = ov.body.querySelector('.fv');
      if (customElements.get('ha-camera-stream')) {
        const st = document.createElement('ha-camera-stream');
        st.hass = h; st.stateObj = s; st.muted = true; st.controls = true; st.allowExoPlayer = true;
        fv.appendChild(st);
      } else {
        const img = document.createElement('img');
        img.alt = '';
        const load = () => { const u = this._img(id).replace(/_t=\d+/, '_t=' + Date.now()); if (u) img.src = u; };
        img.addEventListener('error', () => { img.style.opacity = '0'; });
        img.addEventListener('load', () => { img.style.opacity = '1'; });
        load();
        fv.appendChild(img);
        t = setInterval(() => { if (!document.hidden) load(); }, 2000);
      }
      ov.root.addEventListener('click', (e) => {
        const b = e.target.closest && e.target.closest('[data-x]');
        if (!b) return;
        M.haptic('light');
        if (b.dataset.x === 'close') ov.close();
        else if (b.dataset.x === 'snap') this._snap(id);
        else if (b.dataset.x === 'more') { ov.close(); M.moreInfo(this, id); }
      });
    }
    afterRender() {
      const root = this.shadowRoot, dash = this.profile === 'dashboard';
      // Popup: kant-til-kant med 12 px sidemarg (negativ margin mot Bubble-popupens padding).
      const inPop = !dash && !!M.popupContainer(this), side = inPop ? 12 - M.popupPad(this) : 0;
      if (this._side !== side) { this._side = side; this.style.setProperty('--kx', side + 'px'); }
      // Dashbord: «Tilbake»-pillen sentreres i dashbordflaten (ikke vinduet)
      if (dash && this.config.back_path) { const R = M.dashRect(), x = Math.round(R.left + R.width / 2) + 'px'; if (this._bx !== x) { this._bx = x; this.style.setProperty('--kbx', x); } }
      // fill_screen: flere kolonner når kortet er bredere enn fill_breakpoint
      if (this.config.fill_screen && !this._ro && window.ResizeObserver) {
        this._ro = new ResizeObserver(() => {
          const bp = Number(this.config.fill_breakpoint) || 700, w = this.getBoundingClientRect().width, wide = !!this.config.fill_screen && w >= bp;
          if (wide !== !!this._wide) { this._wide = wide; this.update(); }
        });
        this._ro.observe(this);
      } else if (!this.config.fill_screen && this._wide) { this._wide = false; this.update(); }
      // HA-elementer for direkte bilde/strøm (kun mens popupen er åpen)
      root.querySelectorAll('.strm').forEach((box) => {
        const id = box.dataset.cam, st = this.hass && this.hass.states[id];
        if (!st) return;
        let el = box.firstElementChild;
        if (!el) {
          if (!this.isOpen) return;
          if (box.dataset.kind === 'stream') {
            el = document.createElement('ha-camera-stream');
            el.muted = true; el.controls = false; el.allowExoPlayer = true;
          } else {
            el = document.createElement('hui-image');
            el.cameraImage = id; el.cameraView = 'auto';
          }
          el.fitMode = 'cover';
          el.setAttribute('fit-mode', 'cover');
          box.appendChild(el);
        }
        el.hass = this.hass;
        if (box.dataset.kind === 'stream' && el.stateObj !== st) el.stateObj = st;
      });
      // Horisontal chip-liste: stopp sveip mot Bubble Card
      const ch = root.querySelector('.chips');
      if (ch && !ch.__b) {
        ch.__b = true;
        const stop = (e) => e.stopPropagation();
        ch.addEventListener('touchstart', stop, { passive: true });
        ch.addEventListener('touchmove', stop, { passive: true });
        ch.addEventListener('pointerdown', stop);
      }
      // Bilder som feiler → vis plassholder (tilstand holdes i JS, ikke i DOM, så morph ikke nullstiller)
      root.querySelectorAll('img[data-bk]').forEach((img) => {
        if (img.__b) return;
        img.__b = true;
        this._bad = this._bad || new Set();
        img.addEventListener('error', () => { if (!this._bad.has(img.dataset.bk)) { this._bad.add(img.dataset.bk); this.update(); } });
        img.addEventListener('load', () => { if (this._bad.delete(img.dataset.bk)) this.update(); });
      });
    }
    get styles() {
      return `
        .k{position:relative;display:flex;flex-direction:column;gap:12px;margin:0 var(--kx,0px);min-width:0}
        .k.hasback{padding-bottom:calc(var(--cg,6px) + 80px + env(safe-area-inset-bottom))}
        .hd{display:flex;align-items:center;gap:10px;padding:0 6px 0 0;min-height:48px}
        .hb{display:flex;align-items:center;gap:2px;height:48px;padding:0 6px 0 4px;border-radius:24px;flex:none;transition:background .2s}
        .hb.on{background:rgba(255,255,255,0.08)}
        .hi{width:40px;height:40px;border-radius:20px;background:var(--gray1000,#e1e1e1);color:#282828;display:grid;place-items:center}
        .ht{flex:1;min-width:0;font-size:28px;font-weight:500}
        .hc{flex:none;font-size:14px;color:var(--gray700,#979797)}
        .top{position:relative;display:flex;gap:8px;align-items:center}
        .seg{flex:1;display:grid;grid-template-columns:1fr 1fr;gap:2px;padding:4px;border-radius:23px;background:var(--gray200,#3a3a3a)}
        .md{height:38px;border-radius:19px;display:flex;align-items:center;justify-content:center;gap:6px;font-size:14px;font-weight:500;background:transparent;color:var(--gray800,#afafaf);transition:background .2s,color .2s}
        .md.on{background:${PINK};color:var(--gray200,#3a3a3a)}
        .tune{width:46px;height:46px;border-radius:23px;background:var(--gray200,#3a3a3a);display:grid;place-items:center;flex:none;transition:background .2s}
        .tune.on{background:var(--gray300,#404040)}
        .chips{display:flex;gap:6px;overflow-x:auto;overscroll-behavior-x:contain;touch-action:pan-x;margin:0;padding:0;min-width:0}
        .ch{flex:none;height:38px;padding:0 14px 0 10px;border-radius:19px;display:flex;align-items:center;gap:6px;font-size:14px;font-weight:500;white-space:nowrap;background:var(--gray200,#3a3a3a);color:var(--gray800,#afafaf);transition:background .2s,color .2s}
        .ch.on{background:${PINK};color:var(--gray200,#3a3a3a)}
        .grid{display:grid;grid-auto-flow:dense;gap:var(--cg,6px)}
        .tile{position:relative;border-radius:20px;overflow:hidden;background:var(--gray200,#3a3a3a);cursor:pointer;min-width:0;-webkit-touch-callout:none}
        .ph{position:absolute;inset:0;display:grid;place-items:center;color:var(--gray500,#696969);pointer-events:none}
        img.im{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;pointer-events:none;-webkit-user-select:none;user-select:none}
        img.im.bad{visibility:hidden}
        .strm{position:absolute;inset:0;overflow:hidden;pointer-events:none}
        .strm>*{position:absolute;inset:0;width:100%;height:100%;display:block;--video-max-height:100%}
        .shade{position:absolute;inset:0;background:linear-gradient(180deg, rgba(0,0,0,0.25), transparent 30%, transparent 65%, rgba(0,0,0,0.55));pointer-events:none}
        .bdg{position:absolute;left:8px;top:8px;height:20px;padding:0 7px 0 6px;border-radius:10px;background:rgba(20,20,20,0.6);display:flex;align-items:center;gap:5px;font-size:10px;font-weight:600;line-height:1;letter-spacing:0.04em;text-transform:uppercase;pointer-events:none}
        .bdg i{width:6px;height:6px;border-radius:3px;flex:none}
        .bdg.cp{padding:0;width:20px;justify-content:center}
        .bdg.solid{left:14px;top:14px;height:28px;padding:0 12px 0 10px;border-radius:14px;font-size:12px;font-weight:700;letter-spacing:0}
        .bdg.solid i{width:8px;height:8px;border-radius:4px;background:#fff}
        .full{position:absolute;right:8px;top:8px;width:28px;height:28px;border-radius:14px;background:rgba(20,20,20,0.55);display:grid;place-items:center}
        .full:active{transform:scale(.92)}
        .tn{position:absolute;left:10px;bottom:8px;right:10px;font-size:var(--tfs,14px);line-height:calc(var(--tfs,14px) + 4px);font-weight:500;pointer-events:none;text-shadow:0 1px 3px rgba(0,0,0,0.5)}
        .tm{position:absolute;right:10px;bottom:8px;max-width:40%;font-size:11px;line-height:calc(var(--tfs,14px) + 4px);color:rgba(255,255,255,0.8);pointer-events:none}
        .tile:has(.tm) .tn{right:auto;max-width:calc(60% - 16px)}
        .one{position:relative;height:300px;border-radius:30px;overflow:hidden;background:var(--gray200,#3a3a3a)}
        .one .full{right:14px;top:14px}
        .shade1{position:absolute;inset:0;background:linear-gradient(180deg, transparent 60%, rgba(0,0,0,0.55));pointer-events:none}
        .on1{position:absolute;left:16px;bottom:14px;max-width:60%;font-size:18px;font-weight:600;pointer-events:none}
        .om{position:absolute;right:16px;bottom:14px;font-size:12px;color:rgba(255,255,255,0.7);pointer-events:none}
        .acts{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
        .ac{height:96px;border-radius:26px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;font-size:14px;font-weight:500;background:var(--gray200,#3a3a3a);min-width:0}
        .ac[disabled]{cursor:default}
        .ac[disabled]:active{transform:none}
        .sec{font-size:13px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;color:var(--gray700,#979797);padding:8px 8px 0}
        .er{display:flex;align-items:center;gap:12px;height:60px;padding:0 16px 0 8px;border-radius:30px;background:var(--gray200,#3a3a3a)}
        .ei{width:44px;height:44px;border-radius:22px;background:var(--gray300,#404040);display:grid;place-items:center;flex:none}
        .el{flex:1;min-width:0;font-size:15px;font-weight:500}
        .et{font-size:13px;color:var(--gray700,#979797);flex:none}
        .none{padding:30px 0;text-align:center;font-size:15px;color:var(--gray600,#7f7f7f)}
        .evl{display:grid;gap:8px;min-width:0}
        .evr{display:flex;align-items:center;gap:12px;height:72px;padding:0 16px 0 6px;border-radius:36px;background:var(--gray200,#3a3a3a);text-align:left;width:100%;min-width:0}
        .th{position:relative;width:88px;height:60px;border-radius:30px;overflow:hidden;flex:none;background:var(--gray300,#404040)}
        .tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
        .t1{font-size:15px;font-weight:500}
        .t1.fl{display:flex;align-items:center;gap:6px}
        .t2{font-size:12px;color:var(--gray700,#979797)}
        .fs{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
        .fst{display:flex;flex-direction:column;gap:2px;padding:14px;border-radius:24px;background:var(--gray200,#3a3a3a);min-width:0}
        .fv{font-size:24px;font-weight:300}
        .fl2{font-size:12px;color:var(--gray700,#979797)}
        .back{position:fixed;left:var(--kbx,50%);bottom:calc(20px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:4;height:56px;padding:0 24px 0 16px;border-radius:28px;background:var(--gray100,#2f2f2f);border:1px solid var(--gray400,#545454);display:flex;align-items:center;gap:6px;font-size:15px;font-weight:500;color:var(--white,#fafafa);box-shadow:0 12px 30px rgba(0,0,0,0.4);transition:transform .15s cubic-bezier(.34,1.5,.64,1)}
        .back:active{transform:translateX(-50%) scale(.96)}
      `;
    }
  }
  M.define('msh-kamera-card', Kamera, 'MSH Kamera', 'Kamera-popup eller eget kamera-dashbord: alle camera.* med mosaikk/rutenett/liste, enkeltkamera, hendelser og Frigate. Stillbilder oppdateres kun mens popupen er åpen.');

  /* ------------------------------------------------------------ «Tilpass kameraer» (Kamera v2 · ed) */
  // Åpnes via MSH.openEditor (tag 'msh-kamera-editor'): samme hendelser som msh-editor – msh-change
  // (live + autolagring; commit=false under slider-drag), msh-save («Ferdig» lagrer og venter), msh-cancel.
  // Seksjoner: Profil · Visning · Utseende · Kameraer som vises (+ Legg til kamera) · Nullstill/Ferdig.
  // «Oppsett per enhet»-linjen (msh-scope-bar fra openEditor) flyttes inn rett under headeren.
  const RESET_KEYS = ['layout', 'grid_layout', 'order', 'hidden', 'cam_gap', 'gap', 'luft', 'show_name', 'show_badge', 'text_size'];
  const ED_CSS = `
    :host{display:block;color:var(--white,#fafafa);font-family:${M.FONT}}
    .w{display:flex;flex-direction:column;gap:10px}
    .hd{display:flex;align-items:center;gap:12px;padding:0 4px}
    .hic{width:48px;height:48px;border-radius:24px;background:var(--gray200,#3a3a3a);display:grid;place-items:center;flex:none}
    .htx{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
    .htx b{font-size:18px;font-weight:500}
    .htx i{font-style:normal;font-size:13px;color:var(--gray700,#979797);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .x{width:48px;height:48px;border-radius:24px;background:var(--gray200,#3a3a3a);display:grid;place-items:center;flex:none}
    .scope:empty{display:none} .scope{padding:0 4px}
    .s{display:flex;flex-direction:column;gap:10px;padding:14px 12px;border-radius:28px;background:var(--gray200,#3a3a3a)}
    .st{display:flex;justify-content:space-between;align-items:baseline;gap:8px;padding:0 4px}
    .st>span:first-child{font-size:16px;font-weight:500}
    .sm{font-size:14px;color:var(--gray700,#979797);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
    .sg{display:flex;padding:4px;gap:4px;border-radius:22px;background:var(--gray300,#404040)}
    .sg button{flex:1;height:36px;border-radius:18px;font-size:14px;font-weight:500;color:var(--gray800,#afafaf);white-space:nowrap;transition:background .2s,color .2s}
    .sg button.on{background:${PINK};color:var(--gray200,#3a3a3a)}
    .lg{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
    .lg button{height:88px;border-radius:24px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;font-size:14px;font-weight:500;background:var(--gray300,#404040);color:var(--white,#fafafa);min-width:0}
    .lg button.on{background:${PINK};color:var(--gray200,#3a3a3a)}
    .rw{display:flex;flex-direction:column;gap:8px;min-height:44px;justify-content:center;padding:0 4px}
    .rl{display:flex;align-items:center;gap:12px;min-height:44px}
    .rl>ha-icon{color:var(--gray700,#979797)}
    .lb{flex:1;min-width:0;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .rv{font-size:14px;color:var(--gray700,#979797);font-variant-numeric:tabular-nums;flex:none}
    .sw{position:relative;width:44px;height:26px;border-radius:13px;background:var(--gray400,#545454);flex:none;transition:background .2s}
    .sw::after{content:'';position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:10px;background:#fafafa;box-shadow:0 1px 3px rgba(0,0,0,.3);transition:transform .2s cubic-bezier(.34,1.4,.64,1)}
    .sw.on{background:rgb(102 209 158)} .sw.on::after{transform:translateX(18px)}
    .ts{display:flex;gap:4px;padding:3px;border-radius:19px;background:var(--gray300,#404040);flex:none}
    .ts button{width:40px;height:32px;border-radius:16px;font-size:13px;font-weight:600;color:var(--gray800,#afafaf)}
    .ts button.on{background:${PINK};color:var(--gray200,#3a3a3a)}
    input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:28px;margin:0;background:transparent;touch-action:pan-y;cursor:pointer}
    input[type=range]::-webkit-slider-runnable-track{height:6px;border-radius:3px;background:var(--gray400,#545454)}
    input[type=range]::-moz-range-track{height:6px;border-radius:3px;background:var(--gray400,#545454)}
    input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:22px;height:22px;margin-top:-8px;border-radius:11px;background:#fafafa;box-shadow:0 2px 6px rgba(0,0,0,.4)}
    input[type=range]::-moz-range-thumb{width:22px;height:22px;border:0;border-radius:11px;background:#fafafa}
    .pills{display:flex;gap:6px;flex-wrap:wrap}
    .pill{height:30px;padding:0 12px;border-radius:15px;font-size:13px;font-weight:500;background:var(--gray400,#545454);color:var(--white,#fafafa)}
    .pill.on{background:${PINK};color:var(--gray200,#3a3a3a)}
    .cr{display:flex;align-items:center;gap:10px;padding:8px;border-radius:24px;background:#2c2c2c;transition:opacity .2s}
    .cr.off{opacity:.55}
    .cth{position:relative;width:76px;height:48px;border-radius:14px;overflow:hidden;flex:none;background:var(--gray300,#404040);display:grid;place-items:center;color:var(--gray500,#696969)}
    .cth img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
    .cn{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
    .cn b{font-size:15px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .cn i{font-style:normal;font-size:11px;color:var(--gray700,#979797);font-family:ui-monospace,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .cb{width:40px;height:40px;border-radius:20px;flex:none;display:grid;place-items:center;background:var(--gray300,#404040);color:var(--white,#fafafa)}
    .cb[disabled]{background:#2c2c2c;color:var(--gray400,#545454);pointer-events:none}
    .add{height:48px;border-radius:24px;display:flex;align-items:center;justify-content:center;gap:8px;font-size:14px;font-weight:500;background:var(--gray300,#404040)}
    .srch{height:42px;padding:0 14px;border-radius:14px;background:var(--gray300,#404040);font-size:14px;width:100%;outline:none;border:0;color:inherit;font-family:inherit}
    .res{display:flex;flex-direction:column;gap:2px;max-height:280px;overflow-y:auto;overscroll-behavior:contain}
    .rr{display:flex;align-items:center;gap:10px;min-height:48px;padding:4px 10px;border-radius:12px;text-align:left;width:100%}
    .rr:hover{background:rgba(255,255,255,0.06)}
    .note{font-size:12px;color:var(--gray600,#7f7f7f);padding:4px 6px 0}
    .more{height:44px;border-radius:22px;display:flex;align-items:center;justify-content:center;gap:8px;font-size:14px;color:var(--gray800,#afafaf)}
    .stat{font-size:12px;color:var(--gray700,#979797);text-align:center}.stat.ok{color:rgb(102 209 158)}.stat.err{color:var(--red,#f28073)}
    .act{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .act button{height:54px;border-radius:27px;background:var(--gray200,#3a3a3a);font-size:15px;color:var(--gray700,#979797)}
    .act button.pri{background:${PINK};color:var(--gray200,#3a3a3a);font-weight:600}
  `;
  class KameraEditor extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._q = null;
      const sr = this.shadowRoot;
      sr.addEventListener('click', (e) => this._click(e));
      sr.addEventListener('input', (e) => this._input(e));
      sr.addEventListener('change', (e) => { const t = e.target; if (t && t.dataset.k === 'cam_gap') { this._set({ cam_gap: Number(t.value) }); M.haptic('selection'); } });
      // Slider: ikke la Bubble Card / arket scrolle eller lukke mens man drar
      ['pointerdown', 'touchstart', 'touchmove'].forEach((t) => sr.addEventListener(t, (e) => { if (e.target && e.target.type === 'range') e.stopPropagation(); }, { passive: true }));
    }
    set inline(v) { this._inline = v; }
    set hass(h) { const first = !this._hass; this._hass = h; if (first) this._render(); }
    get hass() { return this._hass; }
    set card(c) { this._card = c; this._render(); }
    get card() { return this._card; }
    setConfig(c) { this._config = { ...(c || {}) }; this._render(); }
    _set(patch, commit = true) {
      const c = { ...this._config };
      Object.keys(patch).forEach((k) => { if (patch[k] === undefined) delete c[k]; else c[k] = patch[k]; });
      this._config = c;
      this.dispatchEvent(new CustomEvent('msh-change', { detail: { config: c, commit } }));
      this._render();
    }
    _list() {
      const h = this._hass, c = this._config, all = M.cameraList(h, c);
      return { all, ord: ordered(all, c), hid: new Set(c.hidden || []) };
    }
    _render() {
      const h = this._hass, c = this._config;
      if (!h || !c) return;
      const { ord, hid } = this._list(), L = layoutOf(c), g = gapOf(c), tk = textKey(c);
      const prof = c.profile === 'popup' || c.profile === 'dashboard' ? c.profile : 'auto';
      const eff = prof !== 'auto' ? prof : this._card ? this._card.profile : null;
      const u = (h.user && h.user.name) || '';
      const sub = M.store ? `For ${u ? u + ' · ' : ''}${M.store.scope === 'shared' ? 'alle enheter' : M.store.deviceName || 'denne enheten'}` : `For ${u || 'deg'} · følger brukeren`;
      const shown = ord.filter((x) => !hid.has(x)).length;
      const row = (icon, label, ctl) => `<div class="rw"><div class="rl">${M.icon(icon, 20)}<span class="lb">${esc(label)}</span>${ctl}</div></div>`;
      const sw = (k) => { const on = c[k] !== false; return `<button class="sw ${on ? 'on' : ''}" role="switch" aria-checked="${on}" data-a="tog" data-k="${k}"></button>`; };
      const add = this._q != null ? this._addList(ord) : `<button class="add" data-a="addopen">${M.icon('mdi:plus', 20)}Legg til kamera</button>`;
      const html = `<style>${M.BASE_CSS}${ED_CSS}</style><div class="w">
        <div class="hd"><span class="hic">${M.icon('tune', 24)}</span><span class="htx"><b>Tilpass kameraer</b><i>${esc(sub)}</i></span><button class="x" data-a="done" title="Lukk">${M.icon('close', 22)}</button></div>
        <div class="scope" data-nomorph></div>
        <div class="s"><div class="st"><span>Profil</span><span class="sm">${eff ? (eff === 'popup' ? 'Popup' : 'Dashbord') + (prof === 'auto' ? ' (auto)' : '') : ''}</span></div>
          <div class="sg">${PROFILES.map(([k, l]) => `<button class="${prof === k ? 'on' : ''}" data-a="prof" data-v="${k}">${l}</button>`).join('')}</div></div>
        <div class="s"><div class="st"><span>Visning</span><span class="sm">${esc((LAYOUTS.find((x) => x[0] === L) || [])[1] || '')}</span></div>
          <div class="lg">${LAYOUTS.map(([k, l, i]) => `<button class="${L === k ? 'on' : ''}" data-a="lay" data-v="${k}">${M.icon(i, 22)}<span>${esc(l)}</span></button>`).join('')}</div></div>
        <div class="s"><div class="st"><span>Utseende</span></div>
          <div class="rw"><div class="rl">${M.icon('mdi:arrow-expand-horizontal', 20)}<span class="lb">Mellomrom</span><span class="rv" data-rv>${g} px</span></div>
            <input type="range" min="0" max="24" step="1" value="${Math.min(24, g)}" data-k="cam_gap" aria-label="Mellomrom mellom kameraer">
            <div class="pills">${GAP_PRESETS.map(([v, l]) => `<button class="pill ${g === v ? 'on' : ''}" data-a="gap" data-v="${v}">${l}</button>`).join('')}</div></div>
          ${row('mdi:label-outline', 'Vis navn', sw('show_name'))}
          ${row('mdi:record-circle-outline', 'Vis «OPPTAK»-merke', sw('show_badge'))}
          ${row('mdi:format-size', 'Tekststørrelse', `<div class="ts">${TEXT_OPTS.map(([k, l]) => `<button class="${tk === k ? 'on' : ''}" data-a="txt" data-v="${k}">${l}</button>`).join('')}</div>`)}
        </div>
        <div class="s"><div class="st"><span>Kameraer som vises</span><span class="sm">${shown} av ${ord.length}</span></div>
          ${ord.map((id, i) => {
            const off = hid.has(id), src = camImg(h, id, this._t || (this._t = Date.now()));
            return `<div class="cr ${off ? 'off' : ''}" data-key="${esc(id)}"><span class="cth">${M.icon(camIcon(h, c, id), 20)}${src ? `<img src="${esc(src)}" alt="" onerror="this.remove()">` : ''}</span>
              <span class="cn"><b>${esc(camName(h, c, id))}</b><i>${esc(id)}</i></span>
              <button class="cb" data-a="eye" data-v="${esc(id)}" title="${off ? 'Vis' : 'Skjul'}">${M.icon(off ? 'visibility_off' : 'visibility', 22, off ? 'color:var(--gray500,#696969)' : '')}</button>
              <button class="cb" data-a="mv" data-i="${i}" data-d="-1" ${i > 0 ? '' : 'disabled'} title="Flytt opp">${M.icon('arrow_upward', 20)}</button>
              <button class="cb" data-a="mv" data-i="${i}" data-d="1" ${i < ord.length - 1 ? '' : 'disabled'} title="Flytt ned">${M.icon('arrow_downward', 20)}</button></div>`;
          }).join('') || '<span class="note">Fant ingen kameraer.</span>'}
          ${add}
        </div>
        <button class="more" data-a="adv">${M.icon('mdi:cog-outline', 20)}Flere innstillinger (lys, sirene, hendelser …)</button>
        ${this.status ? `<div class="stat ${this.statusKind || ''}">${esc(this.status)}</div>` : ''}
        <div class="act"><button data-a="reset">Nullstill</button><button class="pri" data-a="done">Ferdig</button></div>
      </div>`;
      if (!this._did) { this.shadowRoot.innerHTML = html; this._did = true; } else M.morph(this.shadowRoot, html);
      // «Denne enheten · Alle enheter» (fra openEditor) rett under headeren
      const slot = this.shadowRoot.querySelector('.scope'), bar = this.parentNode && this.parentNode.querySelector && this.parentNode.querySelector(':scope > msh-scope-bar');
      if (slot && bar && bar.parentNode !== slot) { bar.noWho = true; slot.appendChild(bar); if (bar._render) bar._render(); } // headeren viser allerede «For <bruker> · <enhet>»
    }
    // Legg til kamera: alle camera.* som ikke vises i lista (også skjulte kanaler/Frigate)
    _addList(ord) {
      const h = this._hass, q = slug(this._q || '');
      const ids = Object.keys(h.states).filter((id) => id.startsWith('camera.') && !ord.includes(id)).filter((id) => !q || slug(id + ' ' + M.name(h, id)).includes(q)).sort().slice(0, 50);
      return `<input class="srch" data-a="q" placeholder="Søk etter kamera …" value="${esc(this._q)}" autocomplete="off">
        <div class="res">${ids.map((id) => `<button class="rr" data-a="add" data-v="${esc(id)}">${M.icon(M.domainIcon(id, h.states[id]), 20, 'color:var(--gray700,#979797)')}<span class="cn"><b>${esc(strip(M.name(h, id)))}</b><i>${esc(id)}</i></span>${M.icon('mdi:plus', 20)}</button>`).join('') || '<span class="note">Ingen flere kameraer</span>'}</div>`;
    }
    _input(e) {
      const t = e.target;
      if (t.dataset.a === 'q') { this._q = t.value; this._render(); const i = this.shadowRoot.querySelector('.srch'); if (i && this.shadowRoot.activeElement !== i) i.focus(); return; }
      if (t.dataset.k === 'cam_gap') {
        // live under drag (ingen lagring før slipp)
        const v = Number(t.value), c = { ...this._config, cam_gap: v };
        this._config = c;
        const rv = this.shadowRoot.querySelector('[data-rv]');
        if (rv) rv.textContent = v + ' px';
        this.dispatchEvent(new CustomEvent('msh-change', { detail: { config: c, commit: false } }));
      }
    }
    _click(e) {
      const b = e.composedPath().find((n) => n.dataset && n.dataset.a);
      if (!b || b.disabled) return;
      const d = b.dataset, c = this._config;
      switch (d.a) {
        case 'q': return;
        case 'prof': M.haptic('selection'); return this._set({ profile: d.v === 'auto' ? undefined : d.v });
        case 'lay': M.haptic('selection'); return this._set({ layout: d.v, grid_layout: undefined });
        case 'gap': M.haptic('selection'); return this._set({ cam_gap: Number(d.v) });
        case 'tog': M.haptic('selection'); return this._set({ [d.k]: c[d.k] === false ? undefined : false });
        case 'txt': M.haptic('selection'); return this._set({ text_size: d.v === 'm' ? undefined : d.v });
        case 'eye': { M.haptic('selection'); const hs = new Set(c.hidden || []); hs.has(d.v) ? hs.delete(d.v) : hs.add(d.v); return this._set({ hidden: hs.size ? [...hs] : undefined }); }
        case 'mv': {
          const o = this._list().ord, i = Number(d.i), j = i + Number(d.d);
          if (j < 0 || j >= o.length) return;
          [o[i], o[j]] = [o[j], o[i]];
          M.haptic('selection');
          return this._set({ order: o });
        }
        case 'addopen': M.haptic('light'); this._q = ''; this._render(); { const i = this.shadowRoot.querySelector('.srch'); if (i) i.focus(); } return;
        case 'add': {
          M.haptic('selection');
          const id = d.v, p = { hidden: (c.hidden || []).filter((x) => x !== id) };
          if (!p.hidden.length) p.hidden = undefined;
          if (Array.isArray(c.cameras) && c.cameras.length) p.cameras = [...c.cameras, { plain: id }];
          else {
            const inc = { ...(c.include || {}) }; inc.kameraer = [...new Set([...(inc.kameraer || []), id])];
            p.include = inc;
            const ex = (c.exclude || []).filter((x) => x !== id);
            p.exclude = ex.length ? ex : undefined;
          }
          this._q = null;
          return this._set(p);
        }
        case 'reset': {
          M.haptic('medium');
          const p = {};
          RESET_KEYS.forEach((k) => { p[k] = undefined; });
          return this._set(p);
        }
        case 'adv': {
          M.haptic('light');
          const card = this._card;
          this.dispatchEvent(new CustomEvent('msh-save', { detail: { config: this._config } }));
          if (card) setTimeout(() => card.customize('advanced'), 320);
          return;
        }
        case 'done': return this.dispatchEvent(new CustomEvent('msh-save', { detail: { config: this._config } }));
        default:
      }
    }
  }
  if (!customElements.get('msh-kamera-editor')) customElements.define('msh-kamera-editor', KameraEditor);
})();
