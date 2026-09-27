/* msh-navbar-card · Navbar. Kilde: Hjem v2.dc.html (<nav>, «Mer»-meny, «Tilpass navbar», navbar-badges) + glass-drag.js.
 * Eget kort UTENFOR alle popups (egen seksjon i grid). Navbaren eies av kortinstansen og finnes KUN i dashbordet kortet
 * ligger i: portal-elementet er et barn av selve kortet (slottes inn i kortets shadow DOM), så det følger kortet inn og
 * ut av dashbordet. Har en forelder transform/containment (position: fixed ville blitt relativ til den), legges portalen
 * i document.body i stedet – fortsatt eid av kortet og fjernet straks kortet kobles fra eller brukeren navigerer til et
 * annet dashbord / en annen HA-side (location.pathname sjekkes mot dashbordets url_path). Ingen globale observere.
 * Plasseres mot dashbordflaten – aldri vinduet:
 *   mobil  = bunn (8 px over bunnen / safe area), sentrert i dashbordflaten, bredde min(flate − 28, 392), høyde 68
 *   bred   = vertikal rail ytterst til venstre i dashbordflaten (til høyre for HA-sidebaren), zoom opptil 1,8×
 * Knapper åpner Bubble Card-popups via hash. Åpen popup (location.hash = knappens hash) markeres med en prikk under
 * ikonet (standard: #232323, liquid glass: rosa + mørk glass-pille som følger valgt fane).
 * Merker (røde prikker) med vilkår: entitet + operator (Over/Under/Er/Er ikke) + verdi.
 * Config (alt redigeres i «Tilpass navbar» = kortets egen editor = HA GUI-editor):
 *   bar: [id…]  more: [id…]  hidden: [id…]
 *   buttons: { id: { icon, label, hash, custom, action, service, entity } }   (overstyring av innebygde + egne knapper)
 *   badges:  { id: [{ entity, op: '>'|'<'|'='|'!=', value, text }] }
 *   show_names, menu_names, shrink, width (kompakt|std|full), style (white|glass), layout (auto|mobil|stor),
 *   reserve_space, toasts, admin_tools
 */
(function () {
  const M = window.MSH, esc = M.esc, C = M.C;
  const PINK = C.accent;

  // Innebygde knapper (id = popup-hash uten #). Ikon/navn fra designets CAT.
  const CAT = { vanning: ['sprinkler', 'Sprinkler'], media: ['music_note', 'Musikk'], klima: ['thermostat', 'Klima'], basseng: ['pool', 'Basseng'], ruter: ['tram', 'Ruter'], gjoremal: ['checklist', 'Gjøremål'] };
  const DEF = { bar: ['vanning', 'media', 'klima', 'basseng', 'ruter'], more: ['gjoremal'] };
  // Popups i prosjektet (mål for egne knapper)
  const POPS = [['sikkerhet', 'shield', 'Sikkerhet'], ['kamera', 'videocam', 'Kamera'], ['lys', 'lightbulb', 'Lys'], ['klima', 'thermostat', 'Klima'], ['vaer', 'partly_cloudy_day', 'Vær'], ['gjoremal', 'checklist', 'Gjøremål'], ['vanning', 'sprinkler', 'Vanning'], ['media', 'music_note', 'Media'], ['basseng', 'pool', 'Basseng'], ['ruter', 'tram', 'Ruter']];
  const ACTS = [['', 'block', 'Ingen'], ['lock_toggle', 'key', 'Veksle dørlås'], ['lock', 'lock', 'Lås dør'], ['unlock', 'lock_open', 'Lås opp'], ['alarm_toggle', 'shield', 'Veksle alarm'], ['alarm_on', 'shield', 'Armer alarm'], ['alarm_off', 'remove_moderator', 'Slå av alarm'], ['lights_on', 'lightbulb', 'Alle lys på'], ['lights_off', 'light_off', 'Alle lys av'], ['garage_toggle', 'garage', 'Veksle garasjeport'], ['tv_toggle', 'tv', 'Veksle TV'], ['vac_toggle', 'robot_2', 'Pause/start støvsuger'], ['service', 'terminal', 'Egendefinert tjeneste']];
  const ACT_DOM = { lock_toggle: 'lock', lock: 'lock', unlock: 'lock', alarm_toggle: 'alarm_control_panel', alarm_on: 'alarm_control_panel', alarm_off: 'alarm_control_panel', garage_toggle: 'cover', tv_toggle: 'media_player', vac_toggle: 'vacuum' };
  const OPS = [['>', 'Over'], ['<', 'Under'], ['=', 'Er'], ['!=', 'Er ikke']];
  const ICON_SUG = ['star', 'bolt', 'power', 'electrical_services', 'sprinkler', 'water_drop', 'music_note', 'speaker', 'electric_car', 'directions_car', 'view_week', 'dns', 'settings', 'tune', 'home', 'lightbulb', 'thermostat', 'bedtime', 'movie', 'garage', 'door_front', 'wb_sunny', 'favorite'];

  /* ------------------------------------------------------------ felles hjelpere */
  // Dashbord-elementet (samme oppslag som MSH.dashRect). Utenfor HA (test): øverste forelder under <body>.
  M.dashEl = M.dashEl || function (from) {
    const ha = document.querySelector('home-assistant');
    if (ha && ha.shadowRoot) {
      const panel = M.deep(ha.shadowRoot, 'ha-panel-lovelace');
      const root = panel && panel.shadowRoot && panel.shadowRoot.querySelector('hui-root');
      const el = (root && root.shadowRoot && (root.shadowRoot.querySelector('#view') || root.shadowRoot.querySelector('hui-view-container'))) || panel;
      if (el) return el;
    }
    let n = from, top = null;
    for (let i = 0; n && i < 80; i++) {
      if (n === document.body || n === document.documentElement) break;
      if (n.nodeType === 1) top = n;
      n = n.parentNode || n.host;
    }
    return top;
  };
  M.rectOf = M.rectOf || function (el) {
    if (!el) return M.dashRect();
    const r = el.getBoundingClientRect();
    if (!r.width) return M.dashRect();
    const left = Math.max(0, r.left), top = Math.max(0, r.top), right = Math.min(r.right, window.innerWidth);
    return { left, top, width: Math.max(280, right - left), height: window.innerHeight - top, right };
  };

  // Liquid glass-drag (glass-drag.js, men koblet direkte på elementet – fungerer i shadow DOM).
  // Dra langs en knapperad → glasslinse følger fingeren, slipp = trykk på knappen under. Drag-vern mot Bubble Card.
  M.glassDrag = M.glassDrag || function (c, opt = {}) {
    if (!c || c.__gd) return;
    c.__gd = true;
    let st = null, suppress = false;
    const on = () => !opt.enabled || opt.enabled();
    const axisOf = () => opt.axis || (getComputedStyle(c).flexDirection === 'column' ? 'y' : 'x');
    const itemsOf = () => Array.from(c.querySelectorAll('button')).filter((b) => b.getClientRects().length && !b.closest('[data-gd-skip]'));
    const pick = (items, x, y) => { let best = null, bd = 1e9; items.forEach((b) => { const r = b.getBoundingClientRect(), cx = Math.max(r.left, Math.min(r.right, x)), cy = Math.max(r.top, Math.min(r.bottom, y)), d = Math.hypot(x - cx, y - cy); if (d < bd) { bd = d; best = b; } }); return best; };
    const lensEl = () => {
      const l = document.createElement('span');
      Object.assign(l.style, { position: 'fixed', zIndex: '9998', pointerEvents: 'none', borderRadius: '999px', background: 'linear-gradient(180deg, rgba(255,255,255,0.32), rgba(255,255,255,0.1))', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.65), inset 0 -1px 1px rgba(255,255,255,0.18), inset 0 0 0 0.5px rgba(255,255,255,0.4), 0 10px 24px rgba(0,0,0,0.35)', backdropFilter: 'blur(4px) saturate(220%) brightness(1.15)', WebkitBackdropFilter: 'blur(4px) saturate(220%) brightness(1.15)', opacity: '0', transform: 'scale(.8)', transition: 'left .16s cubic-bezier(.34,1.5,.64,1), top .16s cubic-bezier(.34,1.5,.64,1), width .2s, height .2s, opacity .15s, transform .3s cubic-bezier(.34,1.8,.64,1)' });
      document.body.appendChild(l);
      requestAnimationFrame(() => { l.style.opacity = '1'; l.style.transform = 'scale(1.1)'; });
      return l;
    };
    const place = (x, y) => {
      const hit = pick(st.items, x, y);
      if (!hit) return;
      if (hit !== st.hit) { st.hit = hit; M.haptic('selection'); }
      const r = hit.getBoundingClientRect(), cr = c.getBoundingClientRect(), w = r.width, h = r.height;
      let L = st.ax === 'x' ? x - w / 2 : r.left, T = st.ax === 'y' ? y - h / 2 : r.top;
      L = Math.max(cr.left + 2, Math.min(cr.right - w - 2, L)); T = Math.max(cr.top + 2, Math.min(cr.bottom - h - 2, T));
      Object.assign(st.lens.style, { left: L + 'px', top: T + 'px', width: w + 'px', height: h + 'px', borderRadius: Math.min(w, h) / 2 + 'px' });
    };
    const stop = (e) => e.stopPropagation();
    c.addEventListener('touchstart', stop, { passive: true });
    c.addEventListener('touchmove', stop, { passive: true });
    c.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      if (e.button || !on()) return;
      if (e.target.closest && e.target.closest('input,select,textarea,[data-gd-skip]')) return;
      st = { sx: e.clientX, sy: e.clientY, ax: axisOf(), on: false, id: e.pointerId };
    });
    c.addEventListener('pointermove', (e) => {
      if (!st || e.pointerId !== st.id) return;
      const dx = e.clientX - st.sx, dy = e.clientY - st.sy;
      if (!st.on) {
        const along = st.ax === 'x' ? Math.abs(dx) : Math.abs(dy), across = st.ax === 'x' ? Math.abs(dy) : Math.abs(dx);
        if (across > 12 && across > along) { st = null; return; }
        if (along < 8) return;
        st.on = true; st.items = itemsOf(); st.lens = lensEl();
        try { c.setPointerCapture(e.pointerId); } catch (x) { /* */ }
      }
      e.preventDefault();
      place(e.clientX, e.clientY);
    });
    const end = (e) => {
      if (!st) return;
      const s0 = st; st = null;
      if (!s0.on) return;
      e.stopPropagation();
      const l = s0.lens; l.style.opacity = '0'; l.style.transform = 'scale(.9)'; setTimeout(() => l.remove(), 220);
      suppress = true; setTimeout(() => { suppress = false; }, 350);
      if (s0.hit && e.type === 'pointerup') s0.hit.click();
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.addEventListener('click', (e) => { if (suppress && e.isTrusted) { e.stopPropagation(); e.preventDefault(); suppress = false; } }, true);
  };

  // Normalisert navbar-config (samme i kortet og editoren).
  function norm(c) {
    c = c || {};
    const B = c.buttons || {};
    const ok = (id) => !!CAT[id] || !!(B[id] && B[id].custom);
    const bar = (Array.isArray(c.bar) ? c.bar : DEF.bar).filter(ok);
    const more = (Array.isArray(c.more) ? c.more : DEF.more).filter((id) => ok(id) && !bar.includes(id));
    Object.keys(CAT).concat(Object.keys(B).filter((id) => B[id] && B[id].custom)).forEach((id) => { if (!bar.includes(id) && !more.includes(id)) more.push(id); });
    const hidden = new Set(Array.isArray(c.hidden) ? c.hidden : []);
    return { B, bar, more, hidden, badges: c.badges || {} };
  }
  const catOf = (N, id) => { const b = N.B[id] || {}, d = CAT[id] || ['star', id]; return [b.icon || d[0], b.label || d[1]]; };
  const hashOf = (N, id) => { const b = N.B[id] || {}; let h = b.hash != null && b.hash !== '' ? b.hash : b.custom ? '' : '#' + id; h = String(h || '').trim(); return h && h[0] !== '#' ? '#' + h : h; };
  const ruleHit = (x, st) => {
    if (!x || !x.entity || !st) return false;
    const s = String(st.state), op = x.op || '=';
    if (op === '>' || op === '<') {
      const v = parseFloat(s), t = parseFloat(String(x.value ?? '').replace(',', '.'));
      if (isNaN(v) || isNaN(t)) return false;
      return op === '>' ? v > t : v < t;
    }
    const vals = String(x.value ?? '').split(/[,|]/).map((v) => v.trim().toLowerCase()).filter(Boolean);
    const n = parseFloat(s), m = vals.some((v) => v === s.toLowerCase() || (!isNaN(n) && !isNaN(parseFloat(v.replace(',', '.'))) && n === parseFloat(v.replace(',', '.'))));
    return op === '!=' ? !m : m;
  };

  /* ------------------------------------------------------------ CSS */
  const NAV_CSS = `
    nav.nb{position:fixed;z-index:24;display:flex;box-sizing:border-box;overflow:hidden;isolation:isolate;border-radius:40px;touch-action:none;user-select:none;-webkit-user-select:none;font-family:${M.FONT};transition:transform .55s cubic-bezier(.34,1.56,.64,1)}
    nav.nb.row{flex-direction:row;justify-content:space-between;padding:9px 14px;transform-origin:bottom center;bottom:max(8px, calc(env(safe-area-inset-bottom, 0px) - 10px))}
    nav.nb.rail{flex-direction:column;justify-content:flex-start;padding:10px;transform-origin:left center}
    nav.nb.white{background:var(--gray1000,#e1e1e1);color:var(--gray000,#232323);backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px);box-shadow:0 10px 30px rgba(0,0,0,0.35)}
    nav.nb.glass{background:rgba(40,40,44,0.38);color:#fafafa;backdrop-filter:blur(22px) saturate(190%) brightness(1.1);-webkit-backdrop-filter:blur(22px) saturate(190%) brightness(1.1);box-shadow:0 18px 40px rgba(0,0,0,0.45),0 2px 6px rgba(0,0,0,0.25)}
    nav.nb.inline{position:relative;left:auto!important;top:auto!important;bottom:auto!important;transform:none!important;margin:0 auto}
    nav.nb.inline.row{width:100%!important;max-width:392px}
    nav.nb .gl1{position:absolute;inset:0;border-radius:inherit;background:linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0.02) 45%,rgba(255,255,255,0.06));pointer-events:none}
    nav.nb .sheen{position:absolute;inset:0;border-radius:inherit;pointer-events:none;opacity:0;transition:opacity .3s;background:radial-gradient(120px 60px at var(--lx,50%) 0%,rgba(255,255,255,0.28),transparent 70%)}
    nav.nb .gl2{position:absolute;inset:0;border-radius:inherit;box-shadow:inset 0 1px 0 rgba(255,255,255,0.35),inset 0 -1px 0 rgba(255,255,255,0.08),inset 0 0 0 0.5px rgba(255,255,255,0.18);pointer-events:none}
    nav.nb .ind{position:absolute;border-radius:999px;pointer-events:none;transition:left .5s cubic-bezier(.34,1.4,.64,1),top .5s cubic-bezier(.34,1.4,.64,1),transform .45s cubic-bezier(.34,1.8,.64,1),opacity .25s}
    nav.nb.glass .ind{background:rgba(18,18,20,0.62);box-shadow:inset 0 2px 6px rgba(0,0,0,0.45),inset 0 -1px 0 rgba(255,255,255,0.06),inset 0 0 0 0.5px rgba(255,255,255,0.05);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
    nav.nb.white .ind{display:none}
    nav.nb .it{position:relative;z-index:1;min-width:0;border-radius:22px;display:flex;flex-direction:column;align-items:center;justify-content:center;transition:transform .35s cubic-bezier(.34,1.8,.64,1),color .25s}
    nav.nb .it:active{transform:scale(.84)}
    nav.nb.row .it{flex:1 1 0}
    nav.nb.rail .it{flex:none}
    nav.nb.glass .it ha-icon{filter:drop-shadow(0 1px 2px rgba(0,0,0,0.3))}
    nav.nb .nm{white-space:nowrap;line-height:1.15}
    nav.nb .od{position:absolute;left:calc(50% - 2.5px);bottom:4px;width:5px;height:5px;border-radius:3px;background:var(--gray000,#232323);pointer-events:none;z-index:2;transform:scale(0);transition:transform .3s cubic-bezier(.34,1.8,.64,1)}
    nav.nb.glass .od{background:${C.pink}}
    nav.nb .it.open .od{transform:scale(1)}
    nav.nb .dot{position:absolute;left:calc(50% + 5px);top:calc(50% - 16px);width:11px;height:11px;border-radius:6px;background:var(--red,#f28073);pointer-events:none;z-index:2}
  `;
  const PORTAL_CSS = `
    :host{position:fixed;left:0;top:0;width:0;height:0;z-index:6;color:#fafafa;font-family:${M.FONT};-webkit-font-smoothing:antialiased;-webkit-tap-highlight-color:transparent}
    *,*::before,*::after{box-sizing:border-box}
    button{font:inherit;color:inherit;border:0;background:none;padding:0;margin:0;cursor:pointer;-webkit-tap-highlight-color:transparent}
    ${NAV_CSS}
    .mbg{position:fixed;inset:0;z-index:25}
    .mpos{position:fixed;z-index:26}
    .mbox{min-width:176px;max-height:calc(100vh - 120px);overflow-y:auto;scrollbar-width:none;padding:8px;border-radius:18px;background:var(--gray1000,#e1e1e1);color:var(--gray000,#232323);box-shadow:0 18px 40px rgba(0,0,0,0.45);display:flex;flex-direction:column;touch-action:none;animation:mshMenu .22s ease-out}
    .mbox::-webkit-scrollbar{display:none}
    .mbox.ic{min-width:0;padding:6px;border-radius:26px}
    .mi{position:relative;height:50px;padding:0 14px 0 12px;border-radius:12px;display:flex;align-items:center;gap:14px;font-size:14px;font-weight:500;white-space:nowrap;flex:none}
    .mbox.ic .mi{width:50px;padding:0;border-radius:25px;justify-content:center}
    .mi:hover{background:rgba(0,0,0,0.05)}
    .mi .mdot{width:8px;height:8px;border-radius:4px;background:var(--red,#f28073);margin-left:auto}
    .mbox.ic .mi .mdot{position:absolute;right:9px;top:9px;margin:0}
    .sep{flex:none;align-self:stretch;min-width:24px;height:1.5px;border-radius:1px;background:rgba(0,0,0,0.16);margin:8px 10px}
    @keyframes mshMenu{from{opacity:0;transform:translateY(6px) scale(.96)}}
  `;

  /* ------------------------------------------------------------ kortet */
  class Navbar extends M.Card {
    static get cardName() { return 'Navbar'; }
    static get defaults() { return { show_names: false, menu_names: true, shrink: true, width: 'std', style: 'white', layout: 'auto', reserve_space: true, toasts: true, admin_tools: true }; }
    static get schema() {
      return [
        { type: 'navbar' },
        { type: 'section', label: 'Plassering og oppførsel', icon: 'mdi:dock-left', fields: [
          { type: 'select', name: 'layout', label: 'Oppsett', options: [['auto', 'Auto'], ['mobil', 'Bunn (mobil)'], ['stor', 'Rail (bred)']], default: 'auto', help: 'Auto måler dashbordflaten (ikke vinduet): bred ≥ 1000 px (iPad ≥ 700 px) = vertikal rail til venstre.' },
          { type: 'boolean', name: 'reserve_space', label: 'Gi innholdet plass (padding i bunnen / til venstre)', default: true },
          { type: 'boolean', name: 'toasts', label: 'Bekreftelsesmeldinger', default: true },
          { type: 'boolean', name: 'admin_tools', label: 'Vis «Tilpass» i Mer-menyen', default: true },
        ] },
      ];
    }
    static getConfigElement() { const e = document.createElement('msh-navbar-editor'); e.cardClass = this; return e; }
    get cardSize() { return 1; }
    set editMode(v) { this._edit = !!v; this._schedule(true); }
    set preview(v) { this._prev = !!v; this._schedule(true); }
    get _inline() { return !!(this._edit || this._prev || this.hasAttribute('preview')); }

    connectedCallback() {
      super.connectedCallback();
      this._onHashNav = () => { this.setUI({ menu: false }); this._schedule(true); };
      this._onResize = () => this._schedule(true);
      this._onScroll = () => {
        const y = window.scrollY, d = y - (this._lastY || 0);
        if (Math.abs(d) > 6) { const c = d > 0 && y > 60; if (c !== !!this.ui.compact) this.setUI({ compact: c }); this._lastY = y; }
      };
      window.addEventListener('hashchange', this._onHashNav);
      window.addEventListener('location-changed', this._onHashNav);
      window.addEventListener('popstate', this._onHashNav);
      window.addEventListener('resize', this._onResize);
      window.addEventListener('scroll', this._onScroll, { passive: true });
    }
    disconnectedCallback() {
      super.disconnectedCallback();
      window.removeEventListener('hashchange', this._onHashNav);
      window.removeEventListener('location-changed', this._onHashNav);
      window.removeEventListener('popstate', this._onHashNav);
      window.removeEventListener('resize', this._onResize);
      window.removeEventListener('scroll', this._onScroll);
      if (this._ro) { this._ro.disconnect(); this._ro = null; this._roEl = null; }
      this._hidePortal();
      this._dEl = null;
    }

    // Fjern portalen og gi dashbordet tilbake paddingen (kort frakoblet / annet dashbord / annen HA-side).
    _hidePortal() {
      if (this._portal) { this._portal.remove(); this._portal = null; }
      this._reserve(null);
      if (this.ui.menu) this._ui = { ...this._ui, menu: false };
    }

    // Dashbordets url_path (første path-segment), låst første gang kortet er koblet til i dashbordet sitt.
    _pathOk() {
      const path = location.pathname || '/';
      if (!this._dashPath) {
        const pu = this._hass && this._hass.panelUrl;
        const seg = pu && (path === '/' + pu || path.indexOf('/' + pu + '/') === 0) ? pu : path.split('/')[1] || '';
        this._dashPath = '/' + seg;
      }
      const d = this._dashPath;
      return d === '/' || path === d || path.indexOf(d + '/') === 0;
    }
    // Vises kun når kortet er koblet til, synlig og brukeren står i kortets dashbord.
    _active() {
      return this.isConnected && this._pathOk() && this.getClientRects().length > 0;
    }

    // Dashbord-elementet kortet faktisk ligger i (host-kjeden opp fra kortet, aldri et globalt oppslag):
    // hui-root #view / hui-view-container → ha-panel-lovelace; utenfor HA (test): øverste forelder under <body>.
    _findDash() {
      let n = this.parentNode || this.host, top = null, panel = null;
      for (let i = 0; n && i < 120; i++) {
        if (n === document.body || n === document.documentElement) break;
        if (n.nodeType === 1) {
          if (n.id === 'view' || n.tagName === 'HUI-VIEW-CONTAINER') return n;
          if (n.tagName === 'HA-PANEL-LOVELACE') { panel = n; break; }
          top = n;
        }
        n = n.parentNode || n.host;
      }
      return panel || top;
    }
    _dash() {
      if (!this._dEl || !this._dEl.isConnected) { this._reserve(null); this._dEl = this._findDash(); }
      const el = this._dEl;
      if (el && window.ResizeObserver && this._roEl !== el) {
        if (this._ro) this._ro.disconnect();
        this._ro = new ResizeObserver(() => this._schedule(true));
        this._ro.observe(el);
        this._roEl = el;
      }
      return M.rectOf(el);
    }
    // Kan position: fixed ligge inni kortet? Nei hvis en forelder (flat tree) lager ny containing block.
    _fixedSafe() {
      const chain = [];
      const hc = this.shadowRoot && this.shadowRoot.querySelector('ha-card');
      if (hc) chain.push(hc);
      let n = this;
      for (let i = 0; n && i < 120; i++) {
        if (n.nodeType === 1) chain.push(n);
        if (n === document.body) break;
        n = n.assignedSlot || n.parentNode || n.host;
      }
      for (const el of chain) {
        const cs = getComputedStyle(el);
        if ((cs.transform && cs.transform !== 'none') || (cs.perspective && cs.perspective !== 'none') || (cs.filter && cs.filter !== 'none')) return false;
        const bf = cs.backdropFilter || cs.webkitBackdropFilter;
        if (bf && bf !== 'none') return false;
        if (/paint|layout|strict|content/.test(cs.contain || '')) return false;
        if (/transform|filter|perspective/.test(cs.willChange || '')) return false;
        if (cs.containerType && cs.containerType !== 'normal') return false;
        if (cs.contentVisibility && cs.contentVisibility !== 'visible') return false;
      }
      return true;
    }
    _wide(w) {
      const p = this.config.layout || 'auto';
      if (p === 'mobil') return false;
      if (p === 'stor') return true;
      const ipad = /iPad/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      return w >= 1000 || (ipad && w >= 700);
    }
    _zoom(w) {
      const vh = window.innerHeight || 900;
      return w >= 1500 ? Math.max(1, Math.min(1.8, w / 1480, vh / 820)) : Math.max(1, Math.min(1.4, w / 1024, vh / 760));
    }
    _badge(N, id) {
      const R = N.badges[id];
      if (!Array.isArray(R) || !R.length) return null;
      const hit = R.find((x) => ruleHit(x, this.s(x.entity)));
      return hit ? (hit.text || catOf(N, id)[1]) : null;
    }

    // HTML for selve navbaren (portal eller inline forhåndsvisning).
    _navHtml(N, geo, inline) {
      const c = this.config, glass = c.style === 'glass', rail = geo.rail;
      const barIds = N.bar.filter((id) => !N.hidden.has(id));
      const moreIds = N.more.filter((id) => !N.hidden.has(id));
      const items = barIds.map((id) => { const [icon, label] = catOf(N, id); return { id, icon, label, hash: hashOf(N, id), badge: this._badge(N, id) }; });
      items.push({ id: '__more', icon: 'more_horiz', label: 'Mer', hash: '', badge: null });
      const h = location.hash;
      let act = h ? items.findIndex((it) => it.hash && it.hash === h) : -1;
      if (act < 0 && h && moreIds.some((id) => hashOf(N, id) === h)) act = items.length - 1;
      const open = act; // knappen hvis popup er åpen (prikk under ikonet)
      if (act < 0 && this.ui.menu) act = items.length - 1;
      // strekk-animasjon når aktiv flytter seg
      if (act !== this._lastAct) {
        const dist = this._lastAct != null && this._lastAct >= 0 && act >= 0 ? Math.abs(act - this._lastAct) : 0;
        this._lastAct = act;
        if (dist) { this._dist = dist; this._moving = true; clearTimeout(this._mt); this._mt = setTimeout(() => { this._moving = false; this._schedule(true); }, 260); }
      }
      const W = c.width || 'std', SZ = rail ? 60 : W === 'kompakt' ? 44 : W === 'full' ? 56 : 50, GAP = W === 'full' ? 14 : W === 'kompakt' ? 4 : 10, PAD = 10;
      const names = !!c.show_names || glass, itemH = names ? SZ + (glass ? 16 : 10) : SZ, N_ = items.length;
      const compact = !rail && !inline && !!this.ui.compact && c.shrink !== false;
      let style;
      if (inline) style = rail ? `gap:${GAP}px` : '';
      else if (rail) style = `left:${geo.left + 20}px;top:${geo.top + geo.height / 2}px;gap:${GAP}px;transform:translateY(-50%) scale(${geo.zoom.toFixed(3)})`;
      else style = `left:${geo.left + geo.width / 2}px;width:${Math.round(Math.min(geo.width - 28, 392))}px;transform:translateX(-50%) scale(${compact ? 0.8 : 1}) translateY(${compact ? 8 : 0}px)`;
      const mv = this._moving && act >= 0, d = Math.min(this._dist || 0, 4);
      const indT = mv ? `scaleX(${1 + d * 0.12}) scaleY(${1 - d * 0.04})` : 'scale(1)';
      const ind = rail
        ? `top:${PAD + Math.max(0, act) * (itemH + GAP)}px;left:${PAD}px;width:${SZ}px;height:${itemH}px`
        : `top:5px;bottom:5px;left:calc(14px + ${Math.max(0, act)} * ((100% - 28px) / ${N_}) - 6px);width:calc((100% - 28px) / ${N_} + 12px)`;
      const btns = items.map((it, i) => {
        const on = i === act;
        const col = glass ? (on ? C.pink : '#fafafa') : 'var(--gray000,#232323)';
        return `<button class="it${i === open ? ' open' : ''}" data-key="${esc(it.id)}" data-act="go" data-id="${esc(it.id)}" data-haptic="${it.id === '__more' ? 'light' : 'selection'}" title="${esc(it.label + (it.badge ? ' · ' + it.badge : ''))}" aria-label="${esc(it.label)}" style="width:${rail ? SZ + 'px' : 'auto'};height:${itemH}px;gap:${glass ? 3 : 1}px;color:${col};font-weight:${glass ? 600 : 500}">
          ${M.icon(it.icon, rail ? 28 : 27)}
          ${names ? `<span class="nm" style="font-size:${glass ? 13 : 9}px;font-weight:${glass ? 600 : 500};letter-spacing:${glass ? '-0.01em' : '0'}">${esc(it.label)}</span>` : ''}
          <span class="od"></span>
          ${it.badge ? '<span class="dot"></span>' : ''}
        </button>`;
      }).join('');
      return `<nav class="nb ${rail ? 'rail' : 'row'} ${glass ? 'glass' : 'white'} ${inline ? 'inline' : ''}" data-nav style="${style}">
        ${glass ? '<span class="gl1"></span><span class="sheen"></span><span class="gl2"></span>' : ''}
        <span class="ind" style="${ind};opacity:${act >= 0 ? 1 : 0};transform:${indT}"></span>
        ${btns}
      </nav>`;
    }

    _menuHtml(N, geo) {
      const c = this.config, ic = c.menu_names === false, at = this.ui.menuAt || {};
      const moreIds = N.more.filter((id) => !N.hidden.has(id));
      const item = (id, icon, label, color, act, badge) => `<button class="mi" data-act="${act}" data-id="${esc(id)}" title="${esc(label)}" style="color:${color}">${M.icon(icon, 22, `color:${color}`)}${ic ? '' : `<span>${esc(label)}</span>`}${badge ? '<span class="mdot"></span>' : ''}</button>`;
      const tools = [];
      if (c.admin_tools !== false) {
        tools.push(item('__edit', 'tune', 'Tilpass navbar', 'var(--gray600,#7f7f7f)', 'mtool', null));
        if (this.hass && this.hass.user && this.hass.user.is_admin) tools.push(item('__home', 'dashboard_customize', 'Tilpass Hjem', 'var(--gray600,#7f7f7f)', 'mtool', null));
      }
      const list = moreIds.map((id) => { const [icon, label] = catOf(N, id); return item(id, icon, label, 'var(--gray000,#232323)', 'go', this._badge(N, id)); }).join('');
      let pos;
      if (geo.rail) pos = `left:${Math.round(at.right != null ? at.right + 8 : geo.left + 106)}px;bottom:${Math.round(at.bottom != null ? window.innerHeight - at.bottom : 40)}px;transform:scale(1.15);transform-origin:left bottom`;
      else if (ic) pos = `left:${Math.round(at.cx || geo.left + geo.width / 2)}px;bottom:${Math.round(window.innerHeight - (at.top || window.innerHeight - 90) + 14)}px;transform:translateX(-50%)`;
      else pos = `right:${Math.round(Math.max(12, window.innerWidth - (at.right || geo.left + geo.width / 2 + 198) - 6))}px;bottom:${Math.round(window.innerHeight - (at.top || window.innerHeight - 90) + 14)}px`;
      return `<div class="mbg" data-act="mclose" data-haptic="off"></div>
        <div class="mpos" style="${pos}"><div class="mbox ${ic ? 'ic' : ''}" data-menu>
          ${list}${list && tools.length ? '<div class="sep"></div>' : ''}${tools.join('')}
        </div></div>`;
    }

    render() {
      const c = this.config, N = norm(c);
      this.s('zone.__msh_navbar'); // fast avhengighet: rendres kun når badge-entiteter endres
      const R = this._dash(), rail = this._wide(R.width);
      const geo = { left: R.left, top: R.top, width: R.width, height: R.height, rail, zoom: rail ? this._zoom(R.width) : 1 };
      if (this._inline) {
        if (this._portal) { this._portal.remove(); this._portal = null; }
        this._reserve(null);
        const n = N.bar.filter((id) => !N.hidden.has(id)).length;
        return `<div class="pv"><div class="pvh">${M.icon('mdi:dock-bottom', 18)}<span>Navbar · ${n} knapper + Mer · ${rail ? 'rail til venstre' : 'bunn'} (flytende utenfor redigering)</span></div>${this._navHtml(N, { ...geo, rail: false }, true)}</div>`;
      }
      if (!this._active()) { this._hidePortal(); return ''; }
      this._renderPortal(N, geo);
      return '<slot name="nav"></slot>';
    }

    _renderPortal(N, geo) {
      if (!this._portal) {
        const p = document.createElement('div');
        p.className = 'msh-navbar-portal';
        p.attachShadow({ mode: 'open' });
        p.slot = 'nav';
        const sr = p.shadowRoot;
        sr.addEventListener('click', (e) => {
          const path = e.composedPath();
          let el = null;
          for (const n of path) { if (n === sr) break; if (n.matches && n.matches('[data-act]')) { el = n; break; } }
          if (!el) return;
          e.stopPropagation(); // ikke la kortets egen klikk-lytter (portalen er slottet inn i kortet) håndtere det én gang til
          const h = el.getAttribute('data-haptic');
          if (h !== 'off') M.haptic(h || 'light');
          this.onAction(el.dataset.act, el, e);
        });
        this._portal = p;
        this._pFirst = true;
      }
      // Helst inni kortet (følger dashbordet); document.body kun når en forelder ødelegger position: fixed.
      const parent = this._fixedSafe() ? this : document.body;
      if (this._portal.parentNode !== parent) parent.appendChild(this._portal);
      const html = `<style>${PORTAL_CSS}</style>${this._navHtml(N, geo, false)}${this.ui.menu ? this._menuHtml(N, geo) : ''}`;
      if (this._pFirst) { this._portal.shadowRoot.innerHTML = html; this._pFirst = false; } else M.morph(this._portal.shadowRoot, html);
      const nav = this._portal.shadowRoot.querySelector('[data-nav]');
      const glassOn = () => this.config.style === 'glass';
      if (nav && !nav.__b) {
        nav.__b = true;
        M.glassDrag(nav, { enabled: glassOn });
        nav.addEventListener('pointermove', (e) => {
          if (!glassOn() || e.pointerType === 'touch') return;
          const r = nav.getBoundingClientRect(), sh = nav.querySelector('.sheen');
          if (sh) { sh.style.setProperty('--lx', ((e.clientX - r.left) / r.width) * 100 + '%'); sh.style.opacity = '1'; }
        });
        nav.addEventListener('pointerleave', () => { const sh = nav.querySelector('.sheen'); if (sh) sh.style.opacity = '0'; });
      }
      const mb = this._portal.shadowRoot.querySelector('[data-menu]');
      if (mb && !mb.__b) { mb.__b = true; M.glassDrag(mb, { enabled: glassOn }); }
      // plass til innholdet (designet: padding-bottom 120 på mobil, padding-left 108–120 på bred)
      requestAnimationFrame(() => {
        if (!nav || !nav.isConnected) return;
        const r = nav.getBoundingClientRect();
        if (geo.rail) this._reserve({ left: Math.round(r.right - geo.left + 16) });
        else this._reserve({ bottom: Math.round(geo.top + geo.height - r.top + 16) });
      });
    }

    // Legg padding på dashbordelementet så navbaren ikke dekker innhold. null = gjenopprett.
    _reserve(v) {
      const el = this._dEl;
      if (!el || !el.style) return;
      if (!el.__mshPad) el.__mshPad = { bottom: el.style.paddingBottom, left: el.style.paddingLeft };
      const o = el.__mshPad;
      if (!v || this.config.reserve_space === false) {
        el.style.paddingBottom = o.bottom; el.style.paddingLeft = o.left;
        if (!v) delete el.__mshPad;
        return;
      }
      const b = v.bottom != null ? `calc(${v.bottom}px + env(safe-area-inset-bottom, 0px))` : o.bottom;
      const l = v.left != null ? v.left + 'px' : o.left;
      if (el.style.paddingBottom !== b) el.style.paddingBottom = b;
      if (el.style.paddingLeft !== l) el.style.paddingLeft = l;
    }

    onAction(name, el, ev) {
      const N = norm(this.config);
      if (name === 'go') {
        const id = el.dataset.id;
        if (id === '__more') {
          if (this._inline) return;
          const r = el.getBoundingClientRect(), nav = el.closest('nav'), nr = nav ? nav.getBoundingClientRect() : r;
          return this.setUI({ menu: !this.ui.menu, compact: false, menuAt: { cx: r.left + r.width / 2, right: this._wide(this._dash().width) ? nr.right : r.right, top: r.top, bottom: nr.bottom } });
        }
        this.setUI({ menu: false, compact: false });
        const b = N.B[id] || {};
        if (b.custom && b.action) this._run(b);
        const h = hashOf(N, id);
        if (h) M.openPopup(h);
        return;
      }
      if (name === 'mclose') return this.setUI({ menu: false });
      if (name === 'mtool') {
        this.setUI({ menu: false });
        if (el.dataset.id === '__edit') return this.customize();
        if (el.dataset.id === '__home') return M.navigate(location.pathname + '?edit=1');
        return;
      }
      return super.onAction(name, el, ev);
    }

    // Handlinger for egne knapper (autokonfig: første lås/alarm/garasjeport/TV/støvsuger).
    _run(b) {
      const h = this.hass, a = b.action || '', toast = (t) => { if (this.config.toasts !== false) M.toast(t); };
      const first = (dom, f) => (b.entity && String(b.entity).indexOf(dom + '.') === 0 ? b.entity : M.all(h, dom, f)[0] || null);
      if (a.indexOf('lock') === 0 || a === 'unlock') {
        const id = first('lock'); if (!id) return toast('Fant ingen dørlås');
        const locked = (h.states[id] || {}).state === 'locked';
        const svc = a === 'lock' ? 'lock' : a === 'unlock' ? 'unlock' : locked ? 'unlock' : 'lock';
        return M.call(h, 'lock', svc, { entity_id: id }).then(() => toast(svc === 'lock' ? 'Dørlås låst' : 'Dørlås låst opp'));
      }
      if (a.indexOf('alarm') === 0) {
        const id = first('alarm_control_panel'); if (!id) return toast('Fant ingen alarm');
        const s = h.states[id], armed = s && s.state !== 'disarmed';
        const arm = a === 'alarm_on' || (a === 'alarm_toggle' && !armed);
        if (s && s.attributes.code_format && (!arm || s.attributes.code_arm_required !== false)) return M.moreInfo(this, id);
        return M.call(h, 'alarm_control_panel', arm ? 'alarm_arm_away' : 'alarm_disarm', { entity_id: id }).then(() => toast(arm ? 'Alarm armert' : 'Alarm slått av'));
      }
      if (a === 'lights_on' || a === 'lights_off') return M.call(h, 'light', a === 'lights_on' ? 'turn_on' : 'turn_off', { entity_id: 'all' }).then(() => toast(a === 'lights_on' ? 'Alle lys på' : 'Alle lys av'));
      if (a.indexOf('light:') === 0) return M.call(h, 'light', 'toggle', { area_id: a.slice(6) }).then(() => toast('Lys ' + M.areaName(h, a.slice(6))));
      if (a === 'garage_toggle') { const id = first('cover', (s) => s.attributes.device_class === 'garage'); if (!id) return toast('Fant ingen garasjeport'); const op = (h.states[id] || {}).state === 'open'; return M.call(h, 'cover', 'toggle', { entity_id: id }).then(() => toast(op ? 'Garasjeporten lukkes' : 'Garasjeporten åpnes')); }
      if (a === 'tv_toggle') { const id = first('media_player', (s) => s.attributes.device_class === 'tv'); if (!id) return toast('Fant ingen TV'); const on = (h.states[id] || {}).state !== 'off'; return M.call(h, 'media_player', 'toggle', { entity_id: id }).then(() => toast(on ? 'TV slått av' : 'TV slått på')); }
      if (a === 'vac_toggle') { const id = first('vacuum'); if (!id) return toast('Fant ingen støvsuger'); const run = (h.states[id] || {}).state === 'cleaning'; return M.call(h, 'vacuum', run ? 'pause' : 'start', { entity_id: id }).then(() => toast(run ? 'Støvsuger pauset' : 'Støvsuger starter')); }
      if (a === 'service' && b.service) {
        const s = String(b.service).trim();
        if (h.states[s]) return M.toggle(h, s).then(() => toast(M.name(h, s)));
        const [d, sv] = s.split('.');
        if (d && sv) return M.call(h, d, sv, b.data || {}).then(() => toast(b.label || s));
      }
      return null;
    }

    customize(focus) {
      return M.openEditor(this, { cardClass: this.constructor, focus, tag: 'msh-navbar-editor' });
    }

    get styles() {
      return `${NAV_CSS}
        :host{min-height:0}
        .pv{display:flex;flex-direction:column;gap:10px;padding:12px;border-radius:24px;background:var(--gray100,#2f2f2f);box-shadow:inset 0 0 0 1px rgba(255,255,255,0.05)}
        .pvh{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--gray700,#979797)}
      `;
    }
  }
  M.define('msh-navbar-card', Navbar, 'MSH Navbar', 'Flytende navbar utenfor popups: bunn på mobil, rail til venstre på bred skjerm. Åpner popups via hash, merker med vilkår, «Mer»-meny og liquid glass.');

  /* ------------------------------------------------------------ editor («Tilpass navbar») */
  const Base = customElements.get('msh-editor');
  if (!Base || customElements.get('msh-navbar-editor')) return;
  const ED_CSS = `
    .nbx{display:grid;grid-template-columns:minmax(0,1fr);gap:8px}
    .nbx .gt{font-size:13px;color:#979797;padding:6px 6px 0}
    .nrow{display:flex;align-items:center;gap:6px;height:56px;padding:0 6px 0 16px;border-radius:28px;background:#3a3a3a;min-width:0}
    .nrow .lb{flex:1;min-width:0;font-size:15px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .b36{width:36px;height:36px;border-radius:18px;flex:none;display:grid;place-items:center}
    .ud{display:flex;flex:none;border-radius:18px;background:#232323;padding:2px}
    .ud button{width:32px;height:32px;border-radius:16px;display:grid;place-items:center;color:#fafafa}
    .ud button.off{opacity:.2;pointer-events:none}
    .ned{display:flex;flex-direction:column;gap:14px;padding:14px;border-radius:22px;background:#3a3a3a}
    .fl{display:flex;flex-direction:column;gap:6px}
    .cap{font-size:12px;color:#979797}
    .i44{height:44px;border-radius:14px;padding:0 14px;background:#232323;color:#fafafa;font-size:15px;width:100%;min-width:0}
    .icp{width:44px;height:44px;border-radius:22px;flex:none;display:grid;place-items:center;background:#232323}
    .ln{display:flex;gap:8px;align-items:center}
    .sug{display:flex;gap:6px;flex-wrap:wrap;max-height:124px;overflow-y:auto;scrollbar-width:none}
    .chp{height:32px;padding:0 8px;border-radius:16px;flex:none;display:flex;align-items:center;gap:6px;font-size:13px;font-weight:500;white-space:nowrap;background:#545454;color:#fafafa}
    .chp.on{background:${PINK};color:#2f2f2f}
    .bdg{display:flex;flex-direction:column;gap:8px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.08)}
    .bh{display:flex;align-items:center;gap:8px}
    .bh .t{flex:1;font-size:13px;font-weight:500}
    .st{flex:none;font-size:11px;font-weight:600;padding:4px 9px;border-radius:10px;background:#232323;color:#7f7f7f;white-space:nowrap}
    .st.red{background:${M.alpha(C.red, 0.2)};color:${C.red}}
    .st.amb{background:${M.alpha(C.orange, 0.2)};color:${C.orange}}
    .rule{display:flex;flex-direction:column;gap:8px;padding:10px;border-radius:18px;background:#2f2f2f}
    .r1{display:flex;align-items:center;gap:6px}
    .epk{flex:1;min-width:0;height:38px;border-radius:12px;background:#232323;display:flex;align-items:center;gap:8px;padding:0 10px}
    .epk .v{flex:1;min-width:0;display:flex;flex-direction:column}
    .epk .v b{font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .epk .v i{font-style:normal;font-size:10px;color:#7f7f7f;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .d34{width:34px;height:34px;border-radius:17px;flex:none;display:grid;place-items:center;background:${M.alpha(C.red, 0.2)};color:${C.red}}
    .seg{display:flex;gap:2px;padding:3px;border-radius:15px;background:#232323;flex:none}
    .seg button{height:28px;padding:0 10px;border-radius:12px;font-size:12px;font-weight:500;white-space:nowrap;color:#afafaf}
    .seg button.on{background:${PINK};color:#2f2f2f}
    .i34{flex:1;min-width:0;height:34px;border-radius:10px;padding:0 10px;background:#232323;color:#fafafa;font-size:13px;text-align:center}
    .i36{height:36px;border-radius:10px;padding:0 10px;background:#232323;color:#fafafa;font-size:13px;width:100%}
    .rule .inp{height:36px;border-radius:10px;background:#232323;font-size:12px}
    .hint{font-size:11px;color:#7f7f7f;line-height:1.4}
    .hint b{color:#c7c7c7;font-weight:600}
    .ol{height:44px;border-radius:22px;display:flex;align-items:center;justify-content:center;gap:6px;font-size:14px;font-weight:500;box-shadow:inset 0 0 0 1.5px rgba(255,255,255,0.18)}
    .s44{height:44px;width:100%;border-radius:14px;padding:0 12px;background:#232323;color:#fafafa;font-size:14px;color-scheme:dark;cursor:pointer}
    .dlb{height:44px;border-radius:22px;background:${M.alpha(C.red, 0.2)};color:${C.red};display:flex;align-items:center;justify-content:center;gap:6px;font-size:14px;font-weight:500}
    .rsb{height:44px;border-radius:22px;background:#232323;display:flex;align-items:center;justify-content:center;gap:6px;font-size:14px;font-weight:500}
    .add{height:54px;border-radius:27px;box-shadow:inset 0 0 0 1.5px rgba(255,255,255,0.18);display:flex;align-items:center;justify-content:center;gap:8px;font-size:15px;font-weight:500}
    .tg{height:54px;padding:0 14px 0 16px;border-radius:27px;background:#3a3a3a;display:flex;align-items:center;justify-content:space-between;font-size:15px;font-weight:500;width:100%}
    .trk{position:relative;width:50px;height:30px;border-radius:15px;flex:none;background:#545454;transition:background .2s}
    .trk.on{background:${C.green}}
    .knb{position:absolute;top:3px;left:3px;width:24px;height:24px;border-radius:12px;background:#c7c7c7;transition:left .2s}
    .trk.on .knb{left:23px;background:#2f2f2f}
    .wseg{display:flex;gap:2px;padding:4px;border-radius:24px;background:#3a3a3a}
    .wseg button{flex:1;height:40px;border-radius:20px;font-size:14px;font-weight:500;color:#afafaf}
    .wseg button.on{background:${PINK};color:#2f2f2f}
    .profs{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .prof{display:flex;flex-direction:column;align-items:center;gap:14px;padding:16px;border-radius:26px;background:#3a3a3a;min-width:0}
    .prof.on{box-shadow:inset 0 0 0 2px ${C.pink}}
    .pvw{display:flex;gap:10px;padding:12px 14px;border-radius:24px;max-width:100%;overflow:hidden}
    .pvw.white{background:#e1e1e1;color:#232323}
    .pvw.glass{background:linear-gradient(180deg,rgba(255,255,255,0.18),rgba(255,255,255,0.06));color:#fafafa;box-shadow:inset 0 1px 0 rgba(255,255,255,0.35),inset 0 0 0 0.5px rgba(255,255,255,0.2)}
    .pft{display:flex;align-items:center;justify-content:space-between;width:100%;gap:6px}
    .pft .x{display:flex;flex-direction:column;gap:2px;text-align:left;min-width:0}
    .pft .x b{font-size:15px;font-weight:600} .pft .x i{font-style:normal;font-size:12px;color:#979797}
  `;

  class NavEditor extends Base {
    _field(f, key) {
      if (f.type === 'navbar') return this._navbar();
      return super._field(f, key);
    }
    _render() {
      super._render();
      if (!this.shadowRoot) return;
      this.shadowRoot.querySelectorAll('.seg,.wseg').forEach((s) => M.glassDrag(s, { axis: 'x' }));
    }
    _patch(obj) {
      const keys = Object.keys(obj);
      if (!keys.length) return;
      let c = { ...(this._config || {}) };
      keys.slice(0, -1).forEach((k) => { if (obj[k] === undefined) delete c[k]; else c[k] = obj[k]; });
      this._config = c;
      const last = keys[keys.length - 1];
      this._set(last, obj[last]);
    }
    _btn(id, patch) {
      const B = { ...((this._config || {}).buttons || {}) };
      const n = { ...(B[id] || {}), ...patch };
      Object.keys(n).forEach((k) => { if (n[k] == null || n[k] === '') delete n[k]; });
      if (Object.keys(n).length) B[id] = n; else delete B[id];
      this._set('buttons', Object.keys(B).length ? B : undefined);
    }
    _rules(id, list) {
      const all = { ...((this._config || {}).badges || {}) };
      if (list && list.length) all[id] = list; else delete all[id];
      this._set('badges', Object.keys(all).length ? all : undefined);
    }
    _navbar() {
      const h = this._hass, c = this._config || {}, N = norm(c), sel = this._nbSel || null;
      const row = (key, id, i, list) => {
        const [icon, label] = catOf(N, id), hid = N.hidden.has(id), open = sel === id, b = N.B[id] || {}, isC = !!b.custom;
        const R = Array.isArray(N.badges[id]) ? N.badges[id] : [];
        let html = `<div class="nrow" data-key="r_${esc(id)}" style="opacity:${hid ? 0.55 : 1}">
          ${M.icon(icon, 22)}
          <span class="lb">${esc(label)}${R.length ? `<span style="display:inline-block;width:7px;height:7px;border-radius:4px;background:${C.red};margin-left:6px;vertical-align:middle"></span>` : ''}</span>
          <button class="b36" data-a="nbsel" data-id="${esc(id)}" title="Rediger">${M.icon('edit', 20, `color:${open ? C.pink : '#afafaf'}`)}</button>
          <div class="ud"><button class="${i > 0 ? '' : 'off'}" data-a="nbmv" data-k="${key}" data-i="${i}" data-d="-1" title="Flytt opp">${M.icon('expand_less', 20)}</button><button class="${i < list.length - 1 ? '' : 'off'}" data-a="nbmv" data-k="${key}" data-i="${i}" data-d="1" title="Flytt ned">${M.icon('expand_more', 20)}</button></div>
          <button class="b36" data-a="nbhide" data-id="${esc(id)}" title="Vis / skjul">${M.icon(hid ? 'visibility_off' : 'visibility', 20, `color:${hid ? '#696969' : '#afafaf'}`)}</button>
          <button class="b36" data-a="nbswap" data-id="${esc(id)}" data-k="${key}" title="${key === 'bar' ? 'Flytt til menyen' : 'Legg i navbaren'}">${M.icon(key === 'bar' ? 'do_not_disturb_on' : 'add_circle', 22, `color:${key === 'bar' ? C.red : C.green}`)}</button>
        </div>`;
        if (!open) return html;
        const base = CAT[id] || ['star', 'Ny knapp'];
        const curIcon = b.icon || base[0];
        const sug = [...new Set([base[0], ...ICON_SUG])];
        const anyOn = R.some((x) => ruleHit(x, h.states[x.entity]));
        const rules = R.map((x, ri) => {
          const s = h.states[x.entity], hit = ruleHit(x, s), op = x.op || '=', num = op === '>' || op === '<';
          const unit = s && s.attributes.unit_of_measurement ? s.attributes.unit_of_measurement : '';
          return `<div class="rule" data-key="ru_${esc(id)}_${ri}">
            <div class="r1">
              <div class="epk">${M.icon(x.entity ? M.domainIcon(x.entity, s) : 'sensors', 18, 'color:#afafaf')}<span class="v"><b>${esc(x.entity ? (s ? s.attributes.friendly_name || x.entity : x.entity) : 'Ikke valgt')}</b><i>${esc(x.entity ? x.entity + (s ? '' : ' · finnes ikke') : 'Velg entitet under')}</i></span></div>
              <span class="st ${hit ? 'amb' : ''}">${hit ? 'Slår til nå' : 'Ikke nå'}</span>
              <button class="d34" data-a="nbrdel" data-id="${esc(id)}" data-i="${ri}" title="Fjern">${M.icon('delete', 18)}</button>
            </div>
            ${this._search({ type: 'entity' }, `nbq_${id}_${ri}`, 'nbent', `${id}|${ri}`, x.entity ? 'Bytt entitet …' : 'Søk entitet …')}
            <div class="r1"><div class="seg">${OPS.map(([o, l]) => `<button class="${op === o ? 'on' : ''}" data-a="nbrop" data-id="${esc(id)}" data-i="${ri}" data-v="${esc(o)}">${l}</button>`).join('')}</div>
              <input class="i34" data-nbf="rval" data-id="${esc(id)}" data-i="${ri}" value="${esc(x.value ?? '')}" placeholder="${num ? '0' : 'on, open'}">${unit && num ? `<span style="font-size:12px;color:#979797;flex:none">${esc(unit)}</span>` : ''}</div>
            <span class="hint">${num ? 'Tallverdi – prikken vises når entiteten er over/under.' : 'Skill flere tilstander med komma – én av dem holder (||).'} Nå: <b>${esc(s ? M.fmtState(h, x.entity) + (num ? '' : ` (${s.state})`) : '–')}</b></span>
            <input class="i36" data-nbf="rtext" data-id="${esc(id)}" data-i="${ri}" value="${esc(x.text || '')}" placeholder="Tekst i varselet">
          </div>`;
        }).join('');
        const tgt = [['', 'Ingen'], ...POPS.map(([k, , l]) => ['#' + k, l]), ...M.areas(h).map((a) => ['#' + a.id, a.name]), ...M.all(h, 'person').map((p) => ['#person-' + p.split('.')[1], 'Person · ' + M.name(h, p)])];
        const curH = hashOf(N, id);
        if (curH && !tgt.some((t) => t[0] === curH)) tgt.push([curH, curH]);
        const acts = [...ACTS.map(([k, , l]) => [k, l]), ...M.areas(h).map((a) => ['light:' + a.id, 'Lys ' + a.name])];
        html += `<div class="ned" data-key="e_${esc(id)}">
          <div class="fl"><span class="cap">Navn</span><input class="i44" data-nbf="label" data-id="${esc(id)}" value="${esc(b.label || (isC ? '' : ''))}" placeholder="${esc(isC ? 'Navn på knappen' : base[1])}"></div>
          <div class="fl"><span class="cap">Ikon · mdi:, phu:, hue: …</span>
            <div class="ln"><span class="icp">${M.icon(curIcon, 22)}</span><input class="i44" data-nbf="icon" data-id="${esc(id)}" value="${esc(b.icon || '')}" placeholder="${esc(base[0])}" style="flex:1"></div>
            <div class="sug">${sug.map((ic) => `<button class="chp ${curIcon === ic ? 'on' : ''}" data-a="nbicon" data-id="${esc(id)}" data-v="${esc(ic)}" title="${esc(ic)}">${M.icon(ic, 16)}</button>`).join('')}</div></div>
          <div class="bdg">
            <div class="bh">${M.icon('circle', 18, `color:${C.red}`)}<span class="t">Badge · varselprikk</span><span class="st ${R.length && anyOn ? 'red' : ''}">${!R.length ? 'Ingen vilkår' : anyOn ? 'Vises nå' : 'Skjult nå'}</span></div>
            ${rules}
            <button class="ol" data-a="nbradd" data-id="${esc(id)}">${M.icon('add', 20)}Legg til vilkår</button>
            <span class="hint">Prikken vises når minst ett vilkår slår til.</span>
          </div>
          ${isC ? `<div class="fl"><span class="cap">Når du trykker · handling</span><select class="s44" data-nbf="action" data-id="${esc(id)}">${acts.map(([k, l]) => `<option value="${esc(k)}" ${String(b.action || '') === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
            ${b.action === 'service' ? `<input class="i44" data-nbf="service" data-id="${esc(id)}" value="${esc(b.service || '')}" placeholder="Tjeneste eller entitet, f.eks. script.godnatt">` : ''}
            ${ACT_DOM[b.action] ? `<span class="cap">Entitet · ${b.entity ? esc(M.name(h, b.entity)) + ' (' + esc(b.entity) + ')' : 'auto: ' + esc(M.all(h, ACT_DOM[b.action])[0] || 'fant ingen')}</span>${this._search({ type: 'entity', domain: ACT_DOM[b.action] }, 'nbbe_' + id, 'nbbent', id, b.entity ? 'Bytt …' : 'Velg ' + ACT_DOM[b.action] + ' …')}${b.entity ? `<button class="rsb" data-a="nbbclr" data-id="${esc(id)}">${M.icon('restart_alt', 18)}Bruk auto</button>` : ''}` : ''}</div>` : ''}
          <div class="fl"><span class="cap">${isC ? 'Og åpne popup' : 'Åpner popup'}</span><select class="s44" data-nbf="hash" data-id="${esc(id)}">${tgt.map(([k, l]) => `<option value="${esc(k)}" ${curH === k ? 'selected' : ''}>${esc(l)}${k ? ' · ' + esc(k) : ''}</option>`).join('')}</select></div>
          ${isC ? `<button class="dlb" data-a="nbdel" data-id="${esc(id)}">${M.icon('delete', 18)}Slett knappen</button>` : `<button class="rsb" data-a="nbreset" data-id="${esc(id)}">${M.icon('restart_alt', 18)}Tilbakestill til ${esc(base[1])}</button>`}
        </div>`;
        return html;
      };
      const group = (key, title) => `<span class="gt">${title}</span>${N[key].map((id, i, l) => row(key, id, i, l)).join('') || '<span class="hint" style="padding:0 6px">Ingen knapper</span>'}`;
      const tog = (label, name, on) => `<button class="tg" data-a="nbtog" data-k="${name}" data-v="${on ? 0 : 1}">${esc(label)}<span class="trk ${on ? 'on' : ''}"><span class="knb"></span></span></button>`;
      const W = c.width || 'std', style = c.style || 'white';
      const pvIcons = N.bar.filter((id) => !N.hidden.has(id)).map((id) => catOf(N, id)[0]).concat(['more_horiz']);
      return `<style>${ED_CSS}</style><div class="nbx">
        ${group('bar', 'I navbaren')}
        ${group('more', 'Bak de tre prikkene')}
        <span class="gt">Ny knapp</span>
        <button class="add" data-a="nbadd">${M.icon('add', 22)}Legg til knapp</button>
        <span class="gt">Visning</span>
        ${tog('Vis navn', 'show_names', !!c.show_names)}
        ${tog('Vis navn i menyen', 'menu_names', c.menu_names !== false)}
        ${tog('Krymp ved scrolling', 'shrink', c.shrink !== false)}
        <span class="gt">Bredde</span>
        <div class="wseg">${[['kompakt', 'Kompakt'], ['std', 'Standard'], ['full', 'Full']].map(([k, l]) => `<button class="${W === k ? 'on' : ''}" data-a="nbw" data-v="${k}">${l}</button>`).join('')}</div>
        <span class="gt">Stil</span>
        <div class="profs">${[['white', 'Standard', 'Hvit navbar'], ['glass', 'Liquid glass', 'Glass-navbar med linse']].map(([k, l, sub]) => `<button class="prof ${style === k ? 'on' : ''}" data-a="nbstyle" data-v="${k}">
          <span class="pvw ${k}">${pvIcons.slice(0, 5).map((ic) => M.icon(ic, 18)).join('')}</span>
          <span class="pft"><span class="x"><b>${l}</b><i>${sub}</i></span>${M.icon('check_circle', 24, `color:${C.pink};opacity:${style === k ? 1 : 0}`)}</span></button>`).join('')}</div>
      </div>`;
    }
    _click(e) {
      const b = e.composedPath().find((n) => n.dataset && n.dataset.a);
      if (!b || b.dataset.a.indexOf('nb') !== 0) return super._click(e);
      const d = b.dataset, c = this._config || {}, N = norm(c);
      M.haptic(d.a === 'nbmv' ? 'selection' : 'light');
      const lists = () => ({ bar: [...N.bar], more: [...N.more] });
      const rulesOf = (id) => (Array.isArray(N.badges[id]) ? N.badges[id].map((x) => ({ ...x })) : []);
      switch (d.a) {
        case 'nbsel': this._nbSel = this._nbSel === d.id ? null : d.id; return this._render();
        case 'nbmv': { const L = lists()[d.k], i = Number(d.i), j = i + Number(d.d); if (j < 0 || j >= L.length) return; [L[i], L[j]] = [L[j], L[i]]; return this._set(d.k, L); }
        case 'nbhide': { const hs = new Set(N.hidden); hs.has(d.id) ? hs.delete(d.id) : hs.add(d.id); return this._set('hidden', hs.size ? [...hs] : undefined); }
        case 'nbswap': { const L = lists(), o = d.k === 'bar' ? 'more' : 'bar'; L[d.k] = L[d.k].filter((x) => x !== d.id); L[o].push(d.id); return this._patch({ [d.k]: L[d.k], [o]: L[o] }); }
        case 'nbadd': { const id = 'egen_' + Date.now().toString(36); const B = { ...(c.buttons || {}), [id]: { custom: true, icon: 'mdi:star', label: 'Ny knapp' } }; this._nbSel = id; return this._patch({ more: [...N.more, id], buttons: B }); }
        case 'nbdel': { const B = { ...(c.buttons || {}) }; delete B[d.id]; const bd = { ...(c.badges || {}) }; delete bd[d.id]; this._nbSel = null;
          return this._patch({ bar: N.bar.filter((x) => x !== d.id), more: N.more.filter((x) => x !== d.id), hidden: [...N.hidden].filter((x) => x !== d.id).length ? [...N.hidden].filter((x) => x !== d.id) : undefined, badges: Object.keys(bd).length ? bd : undefined, buttons: Object.keys(B).length ? B : undefined }); }
        case 'nbreset': { const B = { ...(c.buttons || {}) }; delete B[d.id]; return this._set('buttons', Object.keys(B).length ? B : undefined); }
        case 'nbicon': return this._btn(d.id, { icon: d.v });
        case 'nbradd': return this._rules(d.id, [...rulesOf(d.id), { entity: '', op: '=', value: '', text: '' }]);
        case 'nbrdel': { const R = rulesOf(d.id); R.splice(Number(d.i), 1); return this._rules(d.id, R); }
        case 'nbrop': { const R = rulesOf(d.id); if (!R[d.i]) return; R[d.i].op = d.v; return this._rules(d.id, R); }
        case 'nbent': { const [id, i] = String(d.name).split('|'); const R = rulesOf(id); if (!R[i]) return; R[i].entity = d.v; this._menu = null; this._q = {}; return this._rules(id, R); }
        case 'nbbent': this._menu = null; this._q = {}; return this._btn(d.name, { entity: d.v });
        case 'nbbclr': return this._btn(d.id, { entity: undefined });
        case 'nbtog': return this._set(d.k, d.v === '1');
        case 'nbw': return this._set('width', d.v);
        case 'nbstyle': return this._set('style', d.v);
        default:
      }
      return undefined;
    }
    _change(e) {
      const t = e.target;
      if (t.dataset && t.dataset.search && t.dataset.act === 'nbbent') {
        const v = t.value.trim();
        if (/^[a-z_]+\.[a-z0-9_]+$/.test(v)) { this._q = {}; this._menu = null; this._btn(t.dataset.name, { entity: v }); }
        return;
      }
      if (t.dataset && t.dataset.search && t.dataset.act === 'nbent') {
        const v = t.value.trim();
        if (/^[a-z_]+\.[a-z0-9_]+$/.test(v)) {
          const [id, i] = String(t.dataset.name).split('|');
          const R = (norm(this._config).badges[id] || []).map((x) => ({ ...x }));
          if (R[i]) { R[i].entity = v; this._q = {}; this._menu = null; this._rules(id, R); }
        }
        return;
      }
      if (t.dataset && t.dataset.nbf) {
        const f = t.dataset.nbf, id = t.dataset.id, v = t.value;
        if (f === 'rval' || f === 'rtext') {
          const R = (norm(this._config).badges[id] || []).map((x) => ({ ...x }));
          const i = Number(t.dataset.i);
          if (!R[i]) return;
          if (f === 'rval') R[i].value = v.trim(); else R[i].text = v;
          return this._rules(id, R);
        }
        if (f === 'hash') {
          const isC = !!(norm(this._config).B[id] || {}).custom;
          return this._btn(id, { hash: !isC && v === '#' + id ? undefined : (v || (isC ? undefined : '')) });
        }
        if (f === 'icon') return this._btn(id, { icon: v.trim() || undefined });
        if (f === 'label') return this._btn(id, { label: v.trim() || undefined });
        if (f === 'action') return this._btn(id, { action: v || undefined });
        if (f === 'service') return this._btn(id, { service: v.trim() || undefined });
        return;
      }
      return super._change(e);
    }
  }
  customElements.define('msh-navbar-editor', NavEditor);
})();
