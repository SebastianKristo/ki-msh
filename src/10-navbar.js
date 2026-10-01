/* msh-navbar-card · Navbar. Kilde: Hjem v2.dc.html (<nav>, «Mer»-meny, «Tilpass navbar», navbar-badges) + glass-drag.js.
 * Eget kort UTENFOR alle popups (egen seksjon i grid). Navbaren eies av kortinstansen og finnes KUN i dashbordet kortet
 * ligger i: portal-elementet er et barn av selve kortet (slottes inn i kortets shadow DOM), så det følger kortet inn og
 * ut av dashbordet. Har en forelder transform/containment (position: fixed ville blitt relativ til den), legges portalen
 * i document.body i stedet – fortsatt eid av kortet og fjernet straks kortet kobles fra eller brukeren navigerer til et
 * annet dashbord / en annen HA-side (location.pathname sjekkes mot dashbordets url_path). Ingen globale observere.
 * Plasseres mot dashbordflaten – aldri vinduet:
 *   mobil  = bunn (8 px over bunnen / safe area), sentrert i dashbordflaten, bredde min(flate − 28, 392), høyde 68
 *            (liquid glass: 64 – padding 4, kapsel 56 × én fane, radius 32/28, ikon 22, navn 11/600)
 *   bred   = vertikal rail ytterst til venstre i dashbordflaten (til høyre for HA-sidebaren), Fold-oppsettet (MSH.isFold), ingen zoom
 * Knapper åpner Bubble Card-popups via hash. Åpen popup (location.hash = knappens hash) markeres med en prikk under
 * ikonet (standard: #232323); liquid glass: ingen prikk, rosa ikon + mørk glass-kapsel som følger valgt fane.
 * Liquid glass speiles til <html data-ki-glass> (MSH.glassOn) → «Mer»-menyen og alle Tilpass-ark blir glass (MSH.glassSurface).
 * Merker (røde prikker) med vilkår: entitet + operator (Over/Under/Er/Er ikke) + verdi.
 * Config (alt redigeres i «Tilpass navbar» = kortets egen editor = HA GUI-editor):
 *   bar: [id…]  more: [id…]  hidden: [id…]
 *   buttons: { id: { icon, label, tap, custom, action, service, entity } }   (overstyring av innebygde + egne knapper)
 *     tap = «Handling» i HA-format (src/09-tap-picker.js): { action: navigate, navigation_path: '#tesla' } (popup eller
 *     egen hash) · { action: navigate, navigation_path: '/lovelace/x' } (dashbord-sti) · { action: url, url_path } ·
 *     { action: none } (egne knapper). Gammel nøkkel hash: '#x' leses fortsatt når tap mangler. Aktiv-prikk og
 *     toggle-lukk (MSH.closePopup) gjelder alle hasher, også egne. action = tjeneste/enhet for egne knapper (lås, alarm …).
 *     icon velges med felles ikonvelger (MSH.iconPicker, src/09-icon-picker.js).
 *   badges:  { id: [{ entity, op: '>'|'<'|'='|'!=', value, text }] }
 *   show_names, menu_names, shrink, width (kompakt|std|full), style (white|glass), layout (auto|mobil|stor),
 *   reserve_space, toasts, admin_tools
 *   mini: { on, cond: 'playing'|'always'|'entity', entity, state, hide_in_media, hide_in_popups, players: [], tv_vol: 'steps'|'slider' } – flytende
 *     mini-spiller over navbaren (Fiks 17.26), eget lag i portalen; skjules i #media, hold på play/pause = bare skjult til neste
 *     avspilling (sessionStorage, ingen pause – 19.7); TV: − / + i volum-pillen (19.15); players velges i MSH.entityMultiPicker (19.6)
 *   Hold 420 ms på et navbar-ikon og dra = ny rekkefølge i bar (19.9)
 */
(function () {
  const M = window.MSH, esc = M.esc, C = M.C;
  const PINK = C.accent;

  // Innebygde knapper (id = popup-hash uten #). Ikon/navn fra designets CAT.
  const CAT = { vanning: ['sprinkler', 'Sprinkler'], media: ['music_note', 'Musikk'], klima: ['thermostat', 'Klima'], basseng: ['pool', 'Basseng'], ruter: ['tram', 'Ruter'], gjoremal: ['checklist', 'Gjøremål'], kart: ['map', 'Kart'], energi: ['bolt', 'Energi'] }; // energi (21.1): i «Mer» til den flyttes // kart (20.22): skjult til den legges til i Tilpass navbar
  const DEF = { bar: ['vanning', 'media', 'klima', 'basseng', 'ruter'], more: ['gjoremal'] };
  // Popups i prosjektet (mål for egne knapper)
  const POPS = [['sikkerhet', 'shield', 'Sikkerhet'], ['kamera', 'videocam', 'Kamera'], ['lys', 'lightbulb', 'Lys'], ['klima', 'thermostat', 'Klima'], ['vaer', 'partly_cloudy_day', 'Vær'], ['gjoremal', 'checklist', 'Gjøremål'], ['vanning', 'sprinkler', 'Vanning'], ['media', 'music_note', 'Media'], ['basseng', 'pool', 'Basseng'], ['ruter', 'tram', 'Ruter'], ['kart', 'map', 'Kart'], ['energi', 'bolt', 'Energi']];
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
  // --ki-nav-h (navbarens høyde, 0 = skjult/rail) på dokumentet – popupene legger luft i bunnen etter den
  M.setNavVars = (h) => {
    const st = document.documentElement.style, v = Math.max(0, Number(h) || 0) + 'px';
    if (st.getPropertyValue('--ki-nav-h') !== v) st.setProperty('--ki-nav-h', v);
    if (!h && st.getPropertyValue('--ki-nav-bottom') !== '0px') st.setProperty('--ki-nav-bottom', '0px');
  };
  // Fiks 23.3 · Ledig flate: navbaren måler seg selv og skriver --ki-nav-occ-top/right/bottom/left (px; 0 der navbaren
  // ikke er, ellers størrelse + avstand til kanten + 8 px) på dashbord-containeren (+ :root som reserve), og sender
  // window-event 'ki-nav-rect' med {top,right,bottom,left}. CSS-variabler arves gjennom shadow DOM → kart, person-ark osv.
  // leser dem uten å måle selv. MSH.navOcc() = siste måling. (--ki-nav-bottom/--ki-nav-h beholder sin gamle betydning.)
  const OCC0 = { top: 0, right: 0, bottom: 0, left: 0 };
  let occLast = { ...OCC0 }, occEl = null;
  M.navOcc = () => ({ ...occLast });
  M.setNavOcc = (occ, el) => {
    const o = { ...OCC0, ...(occ || {}) };
    ['top', 'right', 'bottom', 'left'].forEach((k) => { o[k] = Math.max(0, Math.round(Number(o[k]) || 0)); });
    const targets = [document.documentElement];
    if (el && el.style && el !== document.documentElement) targets.push(el);
    if (occEl && occEl !== el && occEl.style) ['top', 'right', 'bottom', 'left'].forEach((k) => occEl.style.removeProperty('--ki-nav-occ-' + k));
    occEl = el || null;
    targets.forEach((t) => ['top', 'right', 'bottom', 'left'].forEach((k) => { const v = o[k] + 'px'; if (t.style.getPropertyValue('--ki-nav-occ-' + k) !== v) t.style.setProperty('--ki-nav-occ-' + k, v); }));
    const same = ['top', 'right', 'bottom', 'left'].every((k) => occLast[k] === o[k]);
    occLast = o;
    if (!same) window.dispatchEvent(new CustomEvent('ki-nav-rect', { detail: { ...o } }));
    return o;
  };
  // Opptatt flate fra navbarens (og evt. mini-spillerens) rektangel r mot dashbordrektangelet D
  M.navOccFrom = (r, D) => {
    if (!r || !r.width || !r.height || !D) return { ...OCC0 };
    const Db = D.top + D.height, Dr = D.left + D.width, o = { ...OCC0 };
    const dl = r.left - D.left, dr = Dr - r.right, dt = r.top - D.top, db = Db - r.bottom;
    if (r.height > r.width) { if (dl <= dr) o.left = r.right - D.left + 8; else o.right = Dr - r.left + 8; }
    else if (db <= dt) o.bottom = Db - r.top + 8;
    else o.top = r.bottom - D.top + 8;
    return o;
  };
  // Liquid glass-dra (Fiks 3 · 7b / 17.19, fasit glass-drag.js) koblet direkte på containeren – virker i shadow DOM og i HA:
  //  · composedPath (ikke closest på document) avgjør hva som er truffet
  //  · glass-sjekk fra config: opt.enabled() (navbaren: config.style === 'glass', editorene: glassarket), aldri localStorage
  //  · touch-action fra start: navbar/meny 'none' (CSS), horisontale segmenter 'pan-y' (opt.touchAction overstyrer);
  //    stopPropagation på pointerdown/touchstart/touchmove/pointermove så Bubble Card ikke scroller/lukker popupen
  //  · hold og dra (8 px langs aksen) → linsen ER den rosa pillen (MSH.glassLens, 00-base.js): den aktive pillen skjules,
  //    linsen følger fingeren 1:1 (ingen overgang på left/top, bare width/height 120 ms), haptic('selection') per ny
  //    knapp. Slipp → linsen settes på knappen, click(), ekte pille vises etter to frames og linsen tones ut (120 ms).
  //  · MSH.animOff() (Fiks 17.18, sjekkes i pointerdown) → ingen linse; slipp aktiverer knappen direkte.
  //  · pointerdown ignoreres mens en drag pågår (to fingre).
  //  · Fiks 20.3 (fasit Hjem v3 glassTabs, modus pending/scroll/drag): flyter raden over (scrollWidth > clientWidth,
  //    eller forelderen er scroll-containeren) → modus «pending» uten capture. > 6 px sideveis → «scroll»: capture og
  //    scrollLeft = start − dx (touch-action: pan-y, så JS eier den vannrette bevegelsen); slipp velger ingenting.
  //    Slipp uten bevegelse = vanlig trykk (click). pointercancel (loddrett scroll) velger aldri. Valgt knapp rulles
  //    inn i synsfeltet etter et trykk (scrollLeft, ikke scrollIntoView). Rader som passer: glass-drag som før.
  // opt: { axis: 'x'|'y', enabled: () => bool, touchAction, tap: false (ingen MSH.glassTap-animasjon ved trykk) }
  M.glassDrag = M.glassDrag || function (c, opt = {}) {
    if (!c || c.__gd) return;
    c.__gd = true;
    let st = null, suppress = false;
    const on = () => !opt.enabled || opt.enabled();
    const axisOf = () => opt.axis || (getComputedStyle(c).flexDirection === 'column' ? 'y' : 'x');
    // touch-action fra start (morph gjenoppretter __mshTA etter en ny render)
    const ta0 = opt.touchAction || (c.isConnected ? getComputedStyle(c).touchAction : '');
    if (opt.touchAction || !ta0 || ta0 === 'auto') { c.__mshTA = opt.touchAction || (axisOf() === 'x' ? 'pan-y' : 'none'); c.style.touchAction = c.__mshTA; }
    const pathIn = (e) => { const p = e.composedPath ? e.composedPath() : [e.target], i = p.indexOf(c); return i < 0 ? [] : p.slice(0, i); };
    const itemsOf = () => Array.from(c.querySelectorAll('button')).filter((b) => b.getClientRects().length && !b.closest('[data-gd-skip]'));
    const activeOf = () => (M.glassActive ? M.glassActive(c, itemsOf()) : null);
    const pick = (items, x, y) => { let best = null, bd = 1e9; items.forEach((b) => { const r = b.getBoundingClientRect(), cx = Math.max(r.left, Math.min(r.right, x)), cy = Math.max(r.top, Math.min(r.bottom, y)), d = Math.hypot(x - cx, y - cy); if (d < bd) { bd = d; best = b; } }); return best; };
    const place = (x, y, snap) => {
      const hit = pick(st.items, x, y);
      if (!hit) return;
      if (hit !== st.hit) { st.hit = hit; if (!snap) M.haptic('selection'); }
      if (!st.lens) return;
      const r = hit.getBoundingClientRect(), cr = c.getBoundingClientRect(), w = r.width, h = r.height;
      let L = st.ax === 'x' && !snap ? x - w / 2 : r.left, T = st.ax === 'y' && !snap ? y - h / 2 : r.top;
      L = Math.max(cr.left + 2, Math.min(cr.right - w - 2, L)); T = Math.max(cr.top + 2, Math.min(cr.bottom - h - 2, T));
      st.lens.place(L, T, w, h);
    };
    // scroll-containeren (raden selv, eller forelderen når raden ligger i en overflow-x-boks) – null når alt passer
    const scroller = () => { if (axisOf() !== 'x') return null; for (const n of [c, c.parentElement]) { if (n && n.scrollWidth > n.clientWidth + 1 && /(auto|scroll)/.test(getComputedStyle(n).overflowX)) return n; } return null; };
    const showActive = () => {
      const sc = scroller(), a = sc && activeOf();
      if (!a) return;
      const r = a.getBoundingClientRect(), sr = sc.getBoundingClientRect(), m = 24;
      if (r.left < sr.left + m) sc.scrollLeft += r.left - sr.left - m; else if (r.right > sr.right - m) sc.scrollLeft += r.right - sr.right + m;
    };
    if (!c.style.overscrollBehaviorX) c.style.overscrollBehaviorX = 'contain';
    const stop = (e) => e.stopPropagation();
    c.addEventListener('touchstart', stop, { passive: true });
    c.addEventListener('touchmove', (e) => { e.stopPropagation(); if (st && st.on && e.cancelable) e.preventDefault(); }, { passive: false });
    c.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      if (e.button || !on()) return;
      if (st && st.on) return; // to fingre: ignorer mens en drag pågår
      if (pathIn(e).some((n) => n.matches && n.matches('input,select,textarea,[data-gd-skip]'))) return;
      const sc = scroller();
      st = { sx: e.clientX, sy: e.clientY, ax: axisOf(), on: false, id: e.pointerId, off: !!(M.animOff && M.animOff()), mode: sc ? 'pending' : 'drag', sc, sl0: sc ? sc.scrollLeft : 0 };
    });
    c.addEventListener('pointermove', (e) => {
      if (!st || e.pointerId !== st.id) return;
      if (!on()) { if (st.lens && M.glassKill) M.glassKill(c, st.lens); st = null; return; } // f.eks. fane-omorganisering tok over
      const dx = e.clientX - st.sx, dy = e.clientY - st.sy;
      if (st.mode !== 'drag') { // Fiks 20.3: raden flyter over → scroll, aldri linse
        if (st.mode === 'pending') {
          if (Math.abs(dy) > 6 && Math.abs(dy) > Math.abs(dx)) { st = null; return; } // loddrett: siden scroller
          if (Math.abs(dx) <= 6) return;
          st.mode = 'scroll'; st.on = true; st.sc.style.scrollSnapType = 'none';
          try { c.setPointerCapture(e.pointerId); } catch (x) { /* */ }
        }
        e.stopPropagation(); e.preventDefault();
        st.sc.scrollLeft = st.sl0 - dx;
        return;
      }
      if (!st.on) {
        const along = st.ax === 'x' ? Math.abs(dx) : Math.abs(dy), across = st.ax === 'x' ? Math.abs(dy) : Math.abs(dx);
        if (across > 12 && across > along) { st = null; return; }
        if (along < 8) return;
        st.on = true; st.items = itemsOf(); st.hit = pick(st.items, st.sx, st.sy);
        if (!st.off && M.glassLens) {
          const act = activeOf(), s0 = st.items.includes(act) ? act : null;
          st.lens = M.glassLens(c, { from: s0, active: activeOf });
          if (s0) { const r = s0.getBoundingClientRect(); st.lens.place(r.left, r.top, r.width, r.height); st.lens.hide(s0); }
          if (M.lensFollow) st.lens.fw = M.lensFollow(st.lens.l, c); // sporet flytter seg under draget (Fiks 16.10)
        }
        try { c.setPointerCapture(e.pointerId); } catch (x) { /* */ }
      }
      e.stopPropagation();
      e.preventDefault();
      place(e.clientX, e.clientY);
    });
    const end = (e) => {
      if (!st || (e.pointerId != null && e.pointerId !== st.id)) return;
      const s0 = st; st = null;
      if (!s0.on) { if (s0.mode === 'pending' && e.type === 'pointerup') requestAnimationFrame(() => requestAnimationFrame(showActive)); return; }
      e.stopPropagation();
      try { c.releasePointerCapture(s0.id); } catch (x) { /* */ }
      if (s0.mode === 'scroll') { // slipp etter scroll: ingen fanebytte, ingen trykk-animasjon
        s0.sc.style.scrollSnapType = '';
        suppress = true; setTimeout(() => { suppress = false; }, 350);
        if (M.glassDragEnd) M.glassDragEnd();
        return;
      }
      const ok = s0.hit && e.type === 'pointerup', L = s0.lens;
      if (ok && L) { const r = s0.hit.getBoundingClientRect(); L.place(r.left, r.top, r.width, r.height); } // snap til knappen
      suppress = true; setTimeout(() => { suppress = false; }, 350);
      if (M.glassDragEnd) M.glassDragEnd(); // ingen trykk-animasjon (glassTap) etter et glass-dra
      if (ok) { M.haptic('light'); s0.hit.click(); } // knappens egen haptic faller innenfor 40 ms → én haptic
      // Fiks 24.2: fanen kan bli bredere etter byttet (ikon → ikon + navn) – mål den nye aktive fanen i neste rAF, la
      // linsen vokse dit (width .12s) og vis så ekte pille under (finish legger linsen på samme mål) → linsen tones ut
      if (L && ok) requestAnimationFrame(() => { const a = activeOf(); if (a && !L.dead && !L.fin) { const r = a.getBoundingClientRect(); L.place(r.left, r.top, r.width, r.height); } L.timers.push(setTimeout(() => L.finish(), 130)); });
      else if (L) L.finish(); // ekte pille under (to frames) → linsen tones ut
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.addEventListener('lostpointercapture', (e) => { if (e.target === c && st && st.on && e.pointerId === st.id) end(e); }); // bare vår egen capture (knappens implisitte touch-capture bobler også hit)
    c.addEventListener('click', (e) => { if (suppress && e.isTrusted) { e.stopPropagation(); e.preventDefault(); suppress = false; } }, true);
    // Trykk-animasjon (Fiks 4 · 3) i samme rad, med samme glass-sjekk. opt.tap === false = av (navbar/meny).
    if (opt.tap !== false && M.glassTap) M.glassTap(c, { enabled: on, axis: opt.axis });
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
    if (!(Array.isArray(c.bar) && c.bar.includes('kart')) && !(Array.isArray(c.more) && c.more.includes('kart'))) hidden.add('kart'); // 20.22: ny knapp, av til den slås på
    return { B, bar, more, hidden, badges: c.badges || {} };
  }
  const catOf = (N, id) => { const b = N.B[id] || {}, d = CAT[id] || ['star', id]; return [b.icon || d[0], b.label || d[1]]; };
  // Trykk-handling (Fiks 15.6): buttons.<id>.tap i HA-format ({ action: navigate, navigation_path: '#tesla' | '/sti' },
  // { action: url, url_path }, { action: none }). Uten tap: gammel nøkkel buttons.<id>.hash, ellers innebygd '#<id>'.
  const legacyHash = (N, id) => { const b = N.B[id] || {}; let h = b.hash != null && b.hash !== '' ? b.hash : b.custom ? '' : '#' + id; h = String(h || '').trim(); return h && h[0] !== '#' ? '#' + h : h; };
  const tapOf = (N, id) => { const b = N.B[id] || {}, t = M.tap && M.tap.norm(b.tap); if (t) return t; const h = legacyHash(N, id); return h ? { action: 'navigate', navigation_path: h } : null; };
  const hashOf = (N, id) => { const t = tapOf(N, id), p = t && t.action === 'navigate' ? String(t.navigation_path || '') : ''; return p[0] === '#' ? p : ''; };
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

  /* ------------------------------------------------------------ mini-spiller (Fiks 17.26) */
  // Config: mini: { on, cond: 'playing'|'always'|'entity', entity, state, hide_in_media, hide_in_popups, players: [] } (standard: på, Noe spiller)
  const miniCfg = (c) => ({ on: true, cond: 'playing', entity: '', state: 'on', hide_in_media: true, players: [], ...((c && c.mini) || {}) });
  const MINI_KEY = 'ki:mini:hidden'; // «Skjult til neste avspilling» – sessionStorage (overlever reload i samme økt)
  const mStore = {
    get() { try { return JSON.parse(sessionStorage.getItem(MINI_KEY) || 'null'); } catch (e) { return null; } },
    set(v) { try { if (v) sessionStorage.setItem(MINI_KEY, JSON.stringify(v)); else sessionStorage.removeItem(MINI_KEY); } catch (e) { /* */ } },
  };
  const mSig = (s) => { const a = (s && s.attributes) || {}; return (a.media_content_id || '') + '|' + (a.media_title || ''); };
  const mVolIcon = (a) => (a.is_volume_muted || a.volume_level === 0 ? 'mdi:volume-off' : a.volume_level == null || a.volume_level >= 0.67 ? 'mdi:volume-high' : a.volume_level >= 0.34 ? 'mdi:volume-medium' : 'mdi:volume-low');
  // Fiks 22.8: spoleposisjon (media_position + tid siden media_position_updated_at mens den spiller) og tidsformat
  const mPos = (s) => {
    const a = (s && s.attributes) || {}, dur = Number(a.media_duration), p0 = Number(a.media_position);
    if (a.media_position == null || !isFinite(p0)) return { dur: dur > 0 ? dur : 0, pos: null };
    const u = Date.parse(a.media_position_updated_at || ''), dt = s.state === 'playing' && isFinite(u) ? Math.max(0, (Date.now() - u) / 1000) : 0;
    return { dur: dur > 0 ? dur : 0, pos: dur > 0 ? Math.min(dur, p0 + dt) : p0 + dt };
  };
  const mFmt = (t) => { t = Math.max(0, Math.round(t)); const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), x = String(t % 60).padStart(2, '0'); return h ? `${h}:${String(m).padStart(2, '0')}:${x}` : `${m}:${x}`; };
  const mPic = (h, u) => { if (!u) return ''; u = String(u); if (u[0] === '/' && u[1] !== '/' && h && typeof h.hassUrl === 'function') { try { return h.hassUrl(u) || u; } catch (e) { return u; } } return u; };
  // Fiks 20.16 · «Skjul når en popup er åpen»: nav_profiles.mini_hide_popups (bruker × enhet, 19.13) vinner over mini.hide_in_popups
  const mHidePopOn = (m) => { const v = M.navProfile ? M.navProfile().mini_hide_popups : null; return v != null ? !!v : !!(m && m.hide_in_popups); };
  // Er en Bubble Card-popup åpen? Hashen matcher en pop-up i dashbordet (bubble-card config.hash), eller Bubble har
  // .is-popup-opened / bubble-card-popup-open. Ingen pop-uper funnet ennå → enhver hash regnes som popup.
  // Resultatet huskes per hash (trær gås bare gjennom ved hash-bytte, ikke ved hver hass-oppdatering).
  let mPopC = null;
  const mPopOpen = () => {
    const hh = location.hash;
    if (!hh || hh.length < 2) return false;
    if (mPopC && mPopC.h === hh && (mPopC.v || Date.now() - mPopC.t < 400)) return mPopC.v;
    const hashes = new Set();
    let opened = false;
    const walk = (r, d) => {
      if (opened || d > 14 || !r || !r.querySelectorAll) return;
      r.querySelectorAll('*').forEach((e) => {
        if (opened) return;
        if (e.localName === 'bubble-card') { const c = e.config || e._config; if (c && c.card_type === 'pop-up' && c.hash) hashes.add(String(c.hash)); }
        if (e.classList && (e.classList.contains('bubble-card-popup-open') || (e.classList.contains('bubble-pop-up') && e.classList.contains('is-popup-opened')))) opened = true;
        else if (e.shadowRoot) walk(e.shadowRoot, d + 1);
      });
    };
    walk(document, 0);
    const v = opened || document.documentElement.classList.contains('bubble-card-popup-open') || document.body.classList.contains('bubble-card-popup-open') || hashes.has(hh) || !hashes.size;
    mPopC = { h: hh, v, t: Date.now() };
    return v;
  };
  const mStateOk = (x, s) => !!s && String(x || 'on').split(/[,|]/).map((v) => v.trim().toLowerCase()).filter(Boolean).includes(String(s.state).toLowerCase());
  const MINI_CSS = `
    .mini{position:fixed;z-index:23;height:64px;border-radius:40px;overflow:hidden;isolation:isolate;touch-action:pan-x;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;font-family:${M.FONT};transform-origin:bottom center;opacity:1;transition:opacity .25s ease,transform .25s cubic-bezier(.2,.8,.3,1),height .3s cubic-bezier(.2,.8,.3,1),border-radius .3s ease}
    /* Fiks 22.8: utvidet (sveip opp på play/pause) – 172 px, bunnen står fast; omslag/tekst + ⌄ · spole-slider · ⏮ −10 ⏯ +10 ⏭ */
    .mini.exp{height:172px;border-radius:32px}
    .mrow.mx{flex-direction:column;align-items:stretch;justify-content:flex-start;gap:8px;padding:10px 12px 12px}
    .mxt{display:flex;align-items:center;gap:8px;height:48px;flex:none;min-width:0}
    .mseek{position:relative;height:40px;flex:none;border-radius:20px;overflow:hidden;display:flex;align-items:center;justify-content:space-between;padding:0 14px;font-size:13px;font-weight:600;font-variant-numeric:tabular-nums;background:rgba(0,0,0,0.08);touch-action:none;-webkit-touch-callout:none}
    .mini.glass .mseek{background:rgba(255,255,255,0.12)}
    .mseek.dis{opacity:.5}
    .mseek .mskf{position:absolute;left:0;top:0;bottom:0;background:${C.pink};border-radius:20px 0 0 20px;pointer-events:none}
    .mseek span{position:relative;z-index:1;pointer-events:none}
    .mxb{display:flex;align-items:center;justify-content:space-between;height:46px;flex:none;padding:0 2px}
    .mxb .mvb:disabled{opacity:.35}
    .mini.white{background:var(--gray1000,#e1e1e1);color:var(--gray000,#232323);box-shadow:0 10px 30px rgba(0,0,0,0.35)}
    .mini.glass{background:${'linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0.02) 45%,rgba(255,255,255,0.06))'},rgba(40,40,44,0.5);color:#fafafa;backdrop-filter:blur(22px) saturate(190%) brightness(1.1);-webkit-backdrop-filter:blur(22px) saturate(190%) brightness(1.1);box-shadow:inset 0 0 0 0.5px rgba(255,255,255,0.18),inset 0 1px 0 rgba(255,255,255,0.25),0 18px 40px rgba(0,0,0,0.45)}
    .mini.off{opacity:0;pointer-events:none;--mo:24px}
    .msw{display:flex;height:100%;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;scrollbar-width:none;overscroll-behavior-x:contain;touch-action:pan-x}
    .msw::-webkit-scrollbar{display:none}
    .mrow{flex:none;width:100%;height:100%;scroll-snap-align:start;display:flex;align-items:center;gap:8px;padding:8px 9px 8px 8px;min-width:0}
    .mhit{flex:1;min-width:0;height:48px;display:flex;align-items:center;gap:10px;text-align:left;border-radius:24px}
    .mart{position:relative;width:48px;height:48px;border-radius:50%;flex:none;display:grid;place-items:center;overflow:hidden;color:#fafafa}
    .mart img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;animation:mshMiniFade .2s ease-out}
    .mtx{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
    .mtx b{font-size:15px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.2}
    .mtx i{font-style:normal;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.25;opacity:.62}
    .mvb{width:40px;height:40px;border-radius:20px;flex:none;display:grid;place-items:center}
    .mpp{width:46px;height:46px;border-radius:23px;flex:none;display:grid;place-items:center;background:#fafafa;color:#232323;box-shadow:0 2px 8px rgba(0,0,0,0.18);transition:transform .12s}
    .mpp:active,.mvb:active{transform:scale(.92)}
    /* Fiks 20.20: dra fra play/pause → ⏮/⏭ glir ut fra knappen til midten (± 62 px); fasit m.sk */
    .mpp{touch-action:none;-webkit-touch-callout:none}
    .msk{position:absolute;inset:0;pointer-events:none;z-index:3}
    .mskb{position:absolute;width:46px;height:46px;border-radius:23px;display:grid;place-items:center;opacity:0;transform:translateX(0) scale(.4);transition:transform .22s ease,opacity .22s ease,background .15s;box-shadow:0 4px 14px rgba(0,0,0,0.3)}
    .mini.white .mskb{background:var(--gray1000,#e1e1e1);color:var(--gray000,#232323)}
    .mini.glass .mskb{background:rgba(58,58,62,0.94);color:#fafafa;box-shadow:inset 0 0 0 0.5px rgba(255,255,255,0.18),0 6px 16px rgba(0,0,0,0.4)}
    .msk.out .mskb{opacity:1;transform:translateX(var(--tx)) scale(1);transition:transform .38s cubic-bezier(.34,1.4,.64,1),opacity .2s ease,background .15s}
    .msk.out .mskb.dis{opacity:.35}
    .msk.rdy .mskb,.msk.cl .mskb{transition-delay:0s!important}
    .msk.rdy .mskb{transition:transform .15s ease,opacity .15s ease,background .15s}
    .msk.out .mskb.on{transform:translateX(var(--tx)) scale(1.14);background:linear-gradient(135deg,#f7a8d9,${C.pink});color:#232323}
    .mvp{position:relative;flex:1;min-width:0;height:40px;border-radius:20px;overflow:hidden;display:flex;align-items:center;touch-action:none;background:rgba(0,0,0,0.1)}
    .mini.glass .mvp{background:rgba(255,255,255,0.12)}
    .mvf{position:absolute;left:0;top:0;bottom:0;background:${C.pink};border-radius:20px 0 0 20px;pointer-events:none}
    .mvl{position:relative;z-index:1;flex:1;display:flex;align-items:center;gap:6px;padding:0 12px;font-size:14px;font-weight:600;pointer-events:none;white-space:nowrap}
    .mvp .mst{position:relative;z-index:1;width:36px;height:40px;flex:none;display:grid;place-items:center;touch-action:manipulation}
    .mvp.tvs{padding:0 3px;gap:4px}
    .mvp.tvs .mvf{display:none}
    .mvp.tvs .mvl{justify-content:center;padding:0 4px}
    .mvp.tvs .mst{width:34px;height:34px;border-radius:17px;background:rgba(0,0,0,0.1)}
    .mini.glass .mvp.tvs .mst{background:rgba(255,255,255,0.14)}
    .mvp.tvs .mst:active{transform:scale(.9)}
    .mdots{position:absolute;left:50%;bottom:2px;transform:translateX(-50%);display:flex;gap:0;z-index:2}
    .mdots button{width:13px;height:9px;display:grid;place-items:center}
    .mdots button span{width:5px;height:5px;border-radius:3px;background:currentColor;opacity:.3;transition:opacity .2s}
    .mdots button.on span{opacity:.9}
    @keyframes mshMiniFade{from{opacity:0}}
    @media (prefers-reduced-motion: reduce){.mini{transition:opacity .25s ease}.mini.off{--mo:0px}}
    @supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){.mini.glass{background:#2f2f2f}}
  `;

  /* ------------------------------------------------------------ CSS */
  const NAV_CSS = `
    nav.nb{position:fixed;z-index:24;display:flex;box-sizing:border-box;overflow:hidden;isolation:isolate;border-radius:40px;touch-action:none;user-select:none;-webkit-user-select:none;font-family:${M.FONT};transition:transform .55s cubic-bezier(.34,1.56,.64,1)}
    nav.nb.row{flex-direction:row;justify-content:space-between;padding:9px 14px;transform-origin:bottom center;bottom:var(--ki-nav-bottom, 8px)}
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
    nav.nb .it{-webkit-touch-callout:none}
    nav.nb.reord .it{transition:transform .2s cubic-bezier(.2,.8,.2,1)}
    nav.nb.reord .it.lift{transition:none;z-index:5;background:rgba(255,255,255,0.92);color:#232323!important;box-shadow:0 8px 22px rgba(0,0,0,0.35)}
    nav.nb.glass.reord .it.lift{background:rgba(255,255,255,0.28);color:#fafafa!important}
    nav.nb.row .it{flex:1 1 0}
    nav.nb.rail .it{flex:none}
    nav.nb.glass .it ha-icon{filter:drop-shadow(0 1px 2px rgba(0,0,0,0.3))}
    nav.nb .nm{white-space:nowrap;line-height:1.15}
    nav.nb .od{position:absolute;left:calc(50% - 2.5px);bottom:4px;width:5px;height:5px;border-radius:3px;background:var(--gray000,#232323);pointer-events:none;z-index:2;transform:scale(0);transition:transform .3s cubic-bezier(.34,1.8,.64,1)}
    nav.nb.glass .od{background:${C.pink}}
    nav.nb .it.open .od{transform:scale(1)}
    nav.nb .dot{position:absolute;left:calc(50% + 5px);top:calc(50% - 16px);width:11px;height:11px;border-radius:6px;background:var(--red,#f28073);pointer-events:none;z-index:2}
    nav.nb.row.glass{height:64px;padding:4px;border-radius:32px}
    nav.nb.row.glass .ind{border-radius:28px}
    nav.nb.row.glass .it{border-radius:28px}
    nav.nb.row.glass .dot{left:calc(50% + 4px);top:calc(50% - 20px);width:9px;height:9px;border-radius:5px}
    nav.nb.glass .od{display:none}
    nav.nb .gd-lens{position:absolute;z-index:3;pointer-events:none}
    @supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){nav.nb.glass{background:#2f2f2f}}
  `;
  const PORTAL_CSS = `
    :host{position:fixed;left:0;top:0;width:0;height:0;z-index:6;color:#fafafa;font-family:${M.FONT};-webkit-font-smoothing:antialiased;-webkit-tap-highlight-color:transparent}
    :host([data-ring]) nav.nb,:host([data-ring]) .mini{opacity:0 !important;pointer-events:none !important;transition:opacity .3s ease !important} /* 19.17: skjult mens #ringeklokke er åpen */
    :host([data-sheet]) nav.nb,:host([data-sheet]) .mini,:host([data-sheet]) .mbg,:host([data-sheet]) .mpos,:host([data-sheet]) .mpos *{pointer-events:none !important} /* 26.16: under Tilpass-arkets bakteppe */
    :host([data-vaer]) nav.nb,:host([data-vaer]) .mini{opacity:0 !important;pointer-events:none !important} /* 28.4: skjult mens #vaer er åpen */
    :host([data-vfade]) nav.nb,:host([data-vfade]) .mini{transition:opacity .2s ease !important} /* 28.4: fade 200 ms begge veier */
    :host([data-kart]) .mini{opacity:0 !important;pointer-events:none !important;transition:opacity .25s ease !important} /* 20.22: mini-spilleren skjult mens #kart er åpen */
    *,*::before,*::after{box-sizing:border-box}
    button{font:inherit;color:inherit;border:0;background:none;padding:0;margin:0;cursor:pointer;-webkit-tap-highlight-color:transparent}
    ${NAV_CSS}
    .mbg{position:fixed;inset:0;z-index:25}
    .mpos{position:fixed;z-index:26}
    .mbox{min-width:176px;max-height:calc(100vh - 120px);overflow-y:auto;scrollbar-width:none;padding:8px;border-radius:18px;background:var(--gray1000,#e1e1e1);color:var(--gray000,#232323);box-shadow:0 18px 40px rgba(0,0,0,0.45);display:flex;flex-direction:column;touch-action:none;animation:mshMenu .22s ease-out}
    .mbox::-webkit-scrollbar{display:none}
    .mbox.ic{min-width:0;padding:6px;border-radius:26px}
    .mi{touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;transition:transform .18s ease}
    .mbox.reord .mi{transition:transform .18s ease}.mbox.reord .mi.lift{transition:none;z-index:5;background:rgba(255,255,255,0.92);color:#232323!important;box-shadow:0 8px 22px rgba(0,0,0,0.35)}
    .mbox.glass.reord .mi.lift{background:rgba(255,255,255,0.28);color:#fafafa!important}
    .mbox{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
    .mi{position:relative;height:50px;padding:0 14px 0 12px;border-radius:12px;display:flex;align-items:center;gap:14px;font-size:14px;font-weight:500;white-space:nowrap;flex:none}
    .mbox.ic .mi{width:50px;padding:0;border-radius:25px;justify-content:center}
    .mi:hover{background:rgba(0,0,0,0.05)}
    .mi .mdot{width:8px;height:8px;border-radius:4px;background:var(--red,#f28073);margin-left:auto}
    .mbox.ic .mi .mdot{position:absolute;right:9px;top:9px;margin:0}
    .sep{flex:none;align-self:stretch;min-width:24px;height:1.5px;border-radius:1px;background:rgba(0,0,0,0.16);margin:8px 10px}
    .mbox{position:relative}
    /* «Mer» i liquid glass (Fiks 3 · 7c): glassSurface('menu'), radius 32, bredde 64 (kun ikoner), ikoner #fafafa 22 */
    .mbox.glass{${M.glassSurface('menu')}border-radius:32px;padding:7px}
    .mbox.glass.ic{width:64px}
    .mbox.glass .mi{color:#fafafa!important;border-radius:25px}
    .mbox.glass .mi ha-icon{color:#fafafa!important}
    .mbox.glass .mi:hover{background:rgba(255,255,255,0.08)}
    .mbox.glass .sep{background:rgba(255,255,255,0.18)}
    ${M.glassFallback('.mbox.glass', 'menu')}
    ${MINI_CSS}
    @keyframes mshMenu{from{opacity:0;transform:translateY(6px) scale(.96)}}
  `;

  /* ------------------------------------------------------------ kortet */
  class Navbar extends M.Card {
    static get cardName() { return 'Navbar'; }
    static get defaults() { return { show_names: false, menu_names: true, shrink: true, width: 'std', style: 'white', layout: 'auto', reserve_space: true, toasts: true, admin_tools: true }; }
    static get schema() {
      return [
        { type: 'navbar' },
        { type: 'nbkiosk' }, // Fiks 23.5: «Kiosk-modus» mellom «Ny knapp» og «Plassering og oppførsel» (samme data som kiosk-arket, 22.9)
        // Fiks 20.6: kortet «Plassering og oppførsel» = brytere → Visning → Bredde → Avstand fra bunnen (nbplace); «Stil» rett etter
        { type: 'section', label: 'Plassering og oppførsel', icon: 'mdi:dock-left', fields: [
          { type: 'select', name: 'layout', label: 'Oppsett', options: [['auto', 'Auto'], ['mobil', 'Bunn (mobil)'], ['stor', 'Rail (bred)']], default: 'auto', help: 'Auto måler dashbordflaten (ikke vinduet): ≥ 1000 px, eller berøring ≥ 600 px (Fold åpen, iPad) = vertikal rail til venstre.' },
          { type: 'boolean', name: 'reserve_space', label: 'Gi innholdet plass (padding i bunnen / til venstre)', default: true },
          { type: 'boolean', name: 'toasts', label: 'Bekreftelsesmeldinger', default: true },
          { type: 'boolean', name: 'admin_tools', label: 'Vis «Tilpass» i Mer-menyen', default: true },
          { type: 'nbplace' },
        ] },
        { type: 'navbar', part: 'style' },
      ];
    }
    static getConfigElement() { const e = document.createElement('msh-navbar-editor'); e.cardClass = this; return e; }
    get cardSize() { return 1; }
    set editMode(v) { this._edit = !!v; this._schedule(true); }
    set preview(v) { this._prev = !!v; this._schedule(true); }
    get _inline() { return !!(this._edit || this._prev || this.hasAttribute('preview')); }

    connectedCallback() {
      super.connectedCallback();
      this._onHashNav = () => { this._syncVaer(); this.setUI({ menu: false }); this._schedule(true); };
      this._onResize = () => this._schedule(true);
      this._onScroll = () => {
        if (M.portals && M.portals().length) return; // Fiks 20.8: ingen setState mens et Tilpass-ark er åpent
        const y = window.scrollY, d = y - (this._lastY || 0);
        if (Math.abs(d) > 6) { const c = d > 0 && y > 60; if (c !== !!this.ui.compact) this.setUI({ compact: c }); this._lastY = y; }
      };
      window.addEventListener('hashchange', this._onHashNav);
      window.addEventListener('location-changed', this._onHashNav);
      window.addEventListener('popstate', this._onHashNav);
      window.addEventListener('resize', this._onResize);
      window.addEventListener('orientationchange', this._onResize); // Fiks 23.3: ny måling av ledig flate
      window.addEventListener('ki-nav-bottom', this._onResize); // Fiks 18.6: slideren i Tilpass navbar (live)
      window.addEventListener('ki-device-info', this._onResize);
      window.addEventListener('msh-tcol', this._onResize); // fiks 18.8: høyre fliskolonne målt på nytt
      window.addEventListener('scroll', this._onScroll, { passive: true });
      // Fiks 26.16: Tilpass-ark åpent → navbar, mini-spiller og «Mer»-meny tar ikke imot trykk (ligger under bakteppet)
      this._onSheet = () => { if (this._portal) this._portal.toggleAttribute('data-sheet', !!(M.sheetOpen && M.sheetOpen())); };
      window.addEventListener('ki-sheet', this._onSheet);
    }
    disconnectedCallback() {
      super.disconnectedCallback();
      M.setNavVars(0);
      if (this._mTick) { clearInterval(this._mTick); this._mTick = null; } // 22.8
      window.removeEventListener('hashchange', this._onHashNav);
      window.removeEventListener('location-changed', this._onHashNav);
      window.removeEventListener('popstate', this._onHashNav);
      window.removeEventListener('resize', this._onResize);
      window.removeEventListener('orientationchange', this._onResize);
      window.removeEventListener('ki-nav-bottom', this._onResize);
      window.removeEventListener('ki-device-info', this._onResize);
      window.removeEventListener('msh-tcol', this._onResize);
      window.removeEventListener('scroll', this._onScroll);
      window.removeEventListener('ki-sheet', this._onSheet);
      if (this._ro) { this._ro.disconnect(); this._ro = null; this._roEl = null; }
      if (this._mRO) { this._mRO.disconnect(); this._mRO = null; this._mROel = null; }
      if (this._outside) window.removeEventListener('click', this._outside, true);
      [this._mExp, this._mHold, this._mVT, this._mVC].forEach((t) => clearTimeout(t));
      clearTimeout(this._mRep); clearInterval(this._mRep);
      this._hidePortal();
      this._dEl = null;
    }

    // Fjern portalen og gi dashbordet tilbake paddingen (kort frakoblet / annet dashbord / annen HA-side).
    _hidePortal() {
      M.setNavVars(0);
      M.setNavOcc(null, this._dEl); // Fiks 23.3
      if (this._occRO) { this._occRO.disconnect(); this._occRO = null; this._occROel = null; }
      document.documentElement.style.setProperty('--ki-mini-h', '0px');
      this._mShow = false;
      if (this._portal) { this._portal.remove(); this._portal = null; }
      this._railVars(false);
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
      return M.isFold(w); // fiks 18.7: Fold-oppsettet – ≥ 1000 px, berøring ≥ 600 px (Fold åpen, iPad, PC)
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
      // Liquid glass på bunnen (Fiks 3 · 7a): 64 px høy (padding 4, fane 56), ikon 22, navn 11/600, kapsel 56 × én fane
      const gRow = glass && !rail;
      const names = !!c.show_names || glass, itemH = gRow ? 56 : names ? SZ + (glass ? 16 : 10) : SZ, N_ = items.length;
      const compact = !rail && !inline && !!this.ui.compact && c.shrink !== false;
      let style;
      if (inline) style = rail ? `gap:${GAP}px` : '';
      else if (rail) style = `left:${geo.left + M.RAIL.gap}px;top:${geo.top + geo.height / 2}px;gap:${GAP}px;transform:translateY(-50%)`;
      else style = `left:${geo.left + geo.width / 2}px;width:${Math.round(Math.min(geo.width - 28, 392))}px;transform:translateX(-50%) scale(${compact ? 0.8 : 1}) translateY(${compact ? 8 : 0}px)`;
      const mv = this._moving && act >= 0, d = Math.min(this._dist || 0, 4);
      const indT = mv ? `scaleX(${1 + d * 0.12}) scaleY(${1 - d * 0.04})` : 'scale(1)';
      const ind = rail
        ? `top:${PAD + Math.max(0, act) * (itemH + GAP)}px;left:${PAD}px;width:${SZ}px;height:${itemH}px`
        : gRow ? `top:4px;bottom:4px;left:calc(4px + ${Math.max(0, act)} * ((100% - 8px) / ${N_}));width:calc((100% - 8px) / ${N_})`
        : `top:5px;bottom:5px;left:calc(14px + ${Math.max(0, act)} * ((100% - 28px) / ${N_}) - 6px);width:calc((100% - 28px) / ${N_} + 12px)`;
      const btns = items.map((it, i) => {
        const on = i === act;
        const col = glass ? (on ? C.pink : '#fafafa') : 'var(--gray000,#232323)';
        return `<button class="it${i === open ? ' open' : ''}" data-key="${esc(it.id)}" data-act="go" data-id="${esc(it.id)}" data-haptic="${it.id === '__more' ? 'light' : 'selection'}" title="${esc(it.label + (it.badge ? ' · ' + it.badge : ''))}" aria-label="${esc(it.label)}" style="width:${rail ? SZ + 'px' : 'auto'};height:${itemH}px;gap:${gRow ? 0 : glass ? 3 : 1}px;color:${col};font-weight:${glass ? 600 : 500}">
          ${M.icon(it.icon, gRow ? 22 : rail ? 28 : 27)}
          ${names ? `<span class="nm" style="font-size:${gRow ? 11 : glass ? 13 : 9}px;font-weight:${glass ? 600 : 500};letter-spacing:${glass ? '-0.01em' : '0'}${gRow ? ';margin-top:2px' : ''}">${esc(it.label)}</span>` : ''}
          ${glass ? '' : '<span class="od"></span>'}
          ${it.badge ? '<span class="dot"></span>' : ''}
        </button>`;
      }).join('');
      return `<nav class="nb ${rail ? 'rail' : 'row'} ${glass ? 'glass' : 'white'} ${inline ? 'inline' : ''}" data-nav style="${style}">
        ${glass ? '<span class="gl1"></span><span class="sheen"></span><span class="gl2"></span>' : ''}
        <span class="ind" style="${ind};opacity:${act >= 0 ? 1 : 0};transform:${indT}"></span>
        ${btns}
      </nav>`;
    }

    // 24.5 · «Tilpass»-arket (Hjem v3 · tilpOpen): bunnark i ki-overlay-root (M.overlay – dashbordflaten, aldri over
    // HA-sidebaren; rail-utsparing). 28.8/28.11: toppkant 50 px, går til bunnen og dekker navbaren (tilpass: true). Ett kort #3a3a3a r24 med rader
    // (64 px): Tilpass alt · Tilpass Hjem · Tilpass navbar · Tilpass header · Kiosk-modus (På/Av). Trykk lukker arket og
    // åpner editoren (ki-open-editor / M.kioskSheet). Haptic light (én per trykk).
    _tilpassSheet() {
      if (this._tpSheet && !this._tpSheet.closed) return this._tpSheet;
      const kioskOn = () => { const h = this._hass || M.lastHass || {}, e = M.kioskEntity ? M.kioskEntity() : null, st = e && h.states && h.states[e]; return !!(st && st.state === 'on'); };
      const ROWS = [
        ['alt', 'auto_awesome', 'Tilpass alt', 'Veiviser for hele dashbordet', !!M.openTilpassAlt],
        ['home', 'dashboard_customize', 'Tilpass Hjem', 'Kort, faner, popups og tekst', true],
        ['navbar', 'tune', 'Tilpass navbar', 'Knapper, plassering og stil', true],
        ['header', 'mdi:page-layout-header', 'Tilpass header', 'Hilsen, vær og personer', true],
        ['kiosk', 'mdi:fullscreen', 'Kiosk-modus', () => (kioskOn() ? 'På' : 'Av'), !!M.kioskSheet],
      ].filter((r) => r[4]);
      const html = () => `<div class="tph"><span class="tpt">Tilpass</span><button class="tpd" data-a="done">Ferdig</button></div>
        <div class="tpc">${ROWS.map(([k, icn, t, sub]) => `<button class="tpr" data-a="row" data-v="${k}" data-key="tp-${k}"><span class="tpi">${M.icon(icn, 22)}</span><span class="tpx"><b>${esc(t)}</b><i>${esc(typeof sub === 'function' ? sub() : sub)}</i></span>${M.icon('mdi:chevron-right', 22, 'color:#7f7f7f;flex:none')}</button>`).join('')}</div>`;
      // 28.8/28.11: geometrien (top 50 px, bunnforankret over navbaren, radius 28 28 0 0, bunnpadding) kommer fra M.overlay({ tilpass: true })
      const css = `.sh{background:var(--gray050,#282828)}
        .tph{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:4px 6px 14px}
        .tpt{font-size:22px;font-weight:600;letter-spacing:-0.01em}
        .tpd{${M.DONE_PILL}} /* Fiks 26: lik Ferdig-pille */
        .tpc{display:flex;flex-direction:column;border-radius:24px;background:var(--gray200,#3a3a3a);overflow:hidden}
        .tpr{display:flex;align-items:center;gap:12px;height:64px;padding:0 12px 0 14px;width:100%;box-sizing:border-box;text-align:left;color:#fafafa;border-top:1px solid rgba(255,255,255,0.06)}
        .tpr:first-child{border-top:0}
        .tpr:active{background:rgba(255,255,255,0.04)}
        .tpi{width:40px;height:40px;border-radius:20px;flex:none;display:grid;place-items:center;background:var(--gray300,#404040);color:#fafafa}
        .tpx{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
        .tpx b{font-size:15px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .tpx i{font-style:normal;font-size:12px;color:#979797;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}`;
      const ov = M.overlay({ html: html(), css, maxWidth: 480, guard: 300, tilpass: true, onClose: () => { this._tpSheet = null; } });
      ov.host.setAttribute('data-tilpass', '');
      ov.root.addEventListener('click', (e) => {
        const el = e.target.closest && e.target.closest('[data-a]');
        if (!el) return;
        M.haptic('light');
        ov.close();
        if (el.dataset.a !== 'row') return;
        const k = el.dataset.v;
        if (k === 'alt') return window.dispatchEvent(new CustomEvent('ki-open-editor', { detail: { editor: 'tilpass-alt' } }));
        if (k === 'kiosk') return M.kioskSheet && M.kioskSheet(this);
        return window.dispatchEvent(new CustomEvent('ki-open-editor', { detail: { editor: k } }));
      });
      this._tpSheet = ov;
      return ov;
    }

    _menuHtml(N, geo) {
      const c = this.config, ic = c.menu_names === false, at = this.ui.menuAt || {};
      const moreIds = N.more.filter((id) => !N.hidden.has(id));
      const item = (id, icon, label, color, act, badge) => `<button class="mi" data-act="${act}" data-id="${esc(id)}" title="${esc(label)}" style="color:${color}">${M.icon(icon, 22, `color:${color}`)}${ic ? '' : `<span>${esc(label)}</span>`}${badge ? '<span class="mdot"></span>' : ''}</button>`;
      const tools = [];
      if (c.admin_tools !== false) {
        // Fiks 17.27: verktøyene har samme farge som menypunktene over (glass: #fafafa via .mbox.glass .mi) – bare streken skiller
        // 24.5: én «Tilpass»-knapp (arket med Tilpass alt · Hjem · navbar · header · Kiosk-modus). Prikk = nye rom/funksjoner usjekket (23.7)
        tools.push(item('__tilpass', 'tune', 'Tilpass', 'var(--gray000,#232323)', 'mtool', M.tilpassAltDot && M.tilpassAltDot()));
      }
      const list = moreIds.map((id) => { const [icon, label] = catOf(N, id); return item(id, icon, label, 'var(--gray000,#232323)', 'go', this._badge(N, id)); }).join('');
      // Fiks 19.9: bunn-navbar med mini-spiller → menyen løftes over mini-spilleren (målt høyde + 10) og max-height minskes like mye
      const lift = !geo.rail && this._mShow ? (this._mHm || 64) + 10 : 0;
      let pos;
      if (geo.rail) pos = `left:${Math.round(at.right != null ? at.right + 8 : geo.left + 106)}px;bottom:${Math.round(at.bottom != null ? window.innerHeight - at.bottom : 40)}px;transform:scale(1.15);transform-origin:left bottom`;
      else if (ic) pos = `left:${Math.round(at.cx || geo.left + geo.width / 2)}px;bottom:${Math.round(window.innerHeight - (at.top || window.innerHeight - 90) + 14 + lift)}px;transform:translateX(-50%)`;
      else pos = `right:${Math.round(Math.max(12, window.innerWidth - (at.right || geo.left + geo.width / 2 + 198) - 6))}px;bottom:${Math.round(window.innerHeight - (at.top || window.innerHeight - 90) + 14 + lift)}px`;
      // bakteppet tar ikke imot trykk de første 300 ms (trykket som åpnet menyen skal ikke lukke den igjen)
      const guard = Date.now() - (this._menuT || 0) < 300;
      return `<div class="mbg" data-act="mclose" data-haptic="off" style="pointer-events:${guard ? 'none' : 'auto'}"></div>
        <div class="mpos" style="${pos}"><div class="mbox ${ic ? 'ic' : ''} ${c.style === 'glass' ? 'glass' : ''}" data-menu${lift ? ` style="max-height:calc(100vh - ${120 + lift}px)"` : geo.rail ? ` style="max-height:${Math.max(160, Math.floor(((at.bottom != null ? at.bottom : window.innerHeight - 40) - 12) / 1.15))}px"` : ''}>
          ${list}${list && tools.length ? '<div class="sep"></div>' : ''}${tools.join('')}
        </div></div>`;
    }

    render() {
      const c = this.config, N = norm(c);
      this._syncGlass();
      this.s('zone.__msh_navbar'); // fast avhengighet: rendres kun når badge-entiteter endres
      const R = this._dash(), rail = this._wide(R.width);
      const geo = { left: R.left, top: R.top, width: R.width, height: R.height, rail }; // fiks 18.7/19.11: ingen zoom
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
      // Avstand fra bunnen (mobil): CSS-variabel på dokumentet – Hjem sin bunnmarg følger den
      // Fiks 18.6: per enhet (MSH.navBottom – egen verdi eller enhetens standard), uten effekt som rail
      const off = geo.rail ? 0 : M.navBottom();
      if (document.documentElement.style.getPropertyValue('--ki-nav-bottom') !== off + 'px') document.documentElement.style.setProperty('--ki-nav-bottom', off + 'px');
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
          // Trykk på knappen til åpen popup lukker den (Fiks 4 · 1) → én haptic('light')
          const h = el.dataset.act === 'go' && this._isOpen(el.dataset.id) ? 'light' : el.getAttribute('data-haptic');
          if (h !== 'off') M.haptic(h || 'light');
          this.onAction(el.dataset.act, el, e);
        });
        this._miniBind(sr);
        this._portal = p;
        this._pFirst = true;
      }
      // Helst inni kortet (følger dashbordet); document.body kun når en forelder ødelegger position: fixed.
      this._railVars(geo.rail, geo);
      const parent = this._fixedSafe() ? this : document.body;
      if (this._portal.parentNode !== parent) parent.appendChild(this._portal);
      this._portal.toggleAttribute('data-ring', location.hash === '#ringeklokke'); // 19.17: navbar og mini-spiller skjules (#ringeklokke)
      this._syncVaer(); // 26.24 / 28.4: … og fades ut 200 ms mens #vaer er åpen
      this._portal.toggleAttribute('data-sheet', !!(M.sheetOpen && M.sheetOpen())); // 26.16
      this._portal.toggleAttribute('data-kart', location.hash === '#kart'); // 20.22: mini-spilleren skjules, navbaren vises over kartet
      const mc = miniCfg(this.config), mini = mc.on !== false ? this._miniHtml(geo, mc) : ''; // Fiks 17.26
      if (!mini) this._mShow = false;
      const html = `<style>${PORTAL_CSS}</style>${this._navHtml(N, geo, false)}${mini}${this.ui.menu ? this._menuHtml(N, geo) : ''}`;
      if (this._pFirst) { this._portal.shadowRoot.innerHTML = html; this._pFirst = false; } else M.morph(this._portal.shadowRoot, html);
      const nav = this._portal.shadowRoot.querySelector('[data-nav]');
      const glassOn = () => this.config.style === 'glass';
      if (nav && !nav.__b) {
        nav.__b = true;
        M.glassDrag(nav, { enabled: glassOn, tap: false });
        nav.addEventListener('pointermove', (e) => {
          if (!glassOn() || e.pointerType === 'touch') return;
          const r = nav.getBoundingClientRect(), sh = nav.querySelector('.sheen');
          if (sh) { sh.style.setProperty('--lx', ((e.clientX - r.left) / r.width) * 100 + '%'); sh.style.opacity = '1'; }
        });
        nav.addEventListener('pointerleave', () => { const sh = nav.querySelector('.sheen'); if (sh) sh.style.opacity = '0'; });
        this._navReorder(nav); // Fiks 19.9
      }
      const mb = this._portal.shadowRoot.querySelector('[data-menu]');
      // Fiks 22.6: glass-draget i menyen er av mens et ikon holdes/flyttes (dataset.glassDragOff) – trykket går alltid til knappen
      if (mb && !mb.__b) { mb.__b = true; M.glassDrag(mb, { enabled: () => glassOn() && mb.dataset.glassDragOff !== '1', tap: false }); this._menuReorder(mb); }
      // plass til innholdet (designet: padding-bottom 120 på mobil, padding-left 108–120 på bred)
      requestAnimationFrame(() => {
        if (!nav || !nav.isConnected) return;
        const r = nav.getBoundingClientRect();
        // popupenes bunnluft (MSH.popupBottomPad): faktisk høyde på bunn-navbaren, 0 som rail
        M.setNavVars(geo.rail ? 0 : Math.round(r.height));
        if (!geo.rail && !this.ui.compact) this._navH = Math.round(r.height);
        // Mini-spilleren (17.26): --ki-mini-h = høyden den tar over navbaren (0 når skjult), og plass i bunnen av dashbordet
        const mEl = this._mShow && this._portal && this._portal.shadowRoot.querySelector('[data-mini]'), ds = document.documentElement.style;
        // Fiks 19.9: mini-spillerens høyde måles live (ResizeObserver) – «Mer»-menyen løftes like mye
        if (mEl && window.ResizeObserver && this._mROel !== mEl) {
          if (this._mRO) this._mRO.disconnect();
          this._mRO = new ResizeObserver(() => { const hh = mEl.offsetHeight; if (hh && hh !== this._mHm) { this._mHm = hh; if (this.ui.menu) this._schedule(true); } });
          this._mRO.observe(mEl); this._mROel = mEl;
        }
        if (mEl && mEl.offsetHeight) this._mHm = mEl.offsetHeight;
        const mH = mEl ? (this._mHm || 64) + 10 : 0;
        if (ds.getPropertyValue('--ki-mini-h') !== mH + 'px') ds.setProperty('--ki-mini-h', mH + 'px');
        if (mEl) { const sw = mEl.querySelector('.msw'), L = this._mLast || [], i = L.indexOf(this._mCur); if (sw && i >= 0 && sw.clientWidth && Math.round(sw.scrollLeft / sw.clientWidth) !== i) sw.scrollLeft = i * sw.clientWidth; }
        this._measureOcc(); // Fiks 23.3
        if (geo.rail) this._reserve({ left: Math.round(r.right - geo.left + 16), bottom: mH ? mH + 16 : null });
        else this._reserve({ bottom: Math.round(geo.top + geo.height - r.top + 16) + mH });
      });
    }

    // Fiks 28.4: #vaer åpen → navbar + «Spilles nå» fades ut (200 ms), og inn igjen når popupen lukkes. Kalles fra hashchange
    // (straks, ingen polling) og fra tegningen. data-vfade gir opacity-overgangen bare mens byttet pågår.
    _syncVaer() {
      const P = this._portal, v = location.hash === '#vaer';
      if (!P || P.hasAttribute('data-vaer') === v) return;
      P.setAttribute('data-vfade', '');
      void P.offsetWidth;
      P.toggleAttribute('data-vaer', v);
      clearTimeout(this._vfT);
      this._vfT = setTimeout(() => { if (this._portal) this._portal.removeAttribute('data-vfade'); }, 260);
    }
    // Fiks 23.3: navbaren måler seg selv (ResizeObserver på <nav> + resize/orientering via _schedule) → MSH.setNavOcc
    _measureOcc() {
      const sr = this._portal && this._portal.shadowRoot, nav = sr && sr.querySelector('[data-nav]');
      if (!nav || !nav.isConnected) { M.setNavOcc(null, this._dEl); return; }
      if (window.ResizeObserver && this._occROel !== nav) {
        if (this._occRO) this._occRO.disconnect();
        this._occRO = new ResizeObserver(() => this._measureOcc());
        this._occRO.observe(nav); this._occROel = nav;
      }
      const D = M.rectOf(this._dEl), n = nav.getBoundingClientRect();
      let r = { left: n.left, top: n.top, right: n.right, bottom: n.bottom, width: n.width, height: n.height };
      const hid = this._portal && (this._portal.hasAttribute('data-kart') || this._portal.hasAttribute('data-ring') || this._portal.hasAttribute('data-vaer')); // mini-spilleren er skjult i #kart/#ringeklokke
      const mEl = this._mShow && !hid && sr.querySelector('[data-mini]');
      if (mEl && n.width >= n.height) { const m = mEl.getBoundingClientRect(); if (m.height && m.top < r.top) { r.top = m.top; r.height = r.bottom - r.top; } }
      M.setNavOcc(M.navOccFrom(r, D), this._dEl);
    }

    /* ---------------- Fiks 19.9: hold og dra for å omorganisere ikonene i navbaren (som faner i Lys, TABORD) */
    // Hold 420 ms på et ikon → haptic medium, ikonet løftes (scale 1.12, lys flate + skygge) og følger fingeren langs navbaren
    // (x i bunn-navbar, y i rail). Slipp → ny rekkefølge i config.bar (samme felt som «Tilpass navbar»), haptic success,
    // klikket etter slipp spises (350 ms). > 8 px bevegelse før holdet er ferdig = vanlig trykk/scroll. «…» flyttes ikke;
    // skjulte ikoner beholder plassen sin i config. Under draget: glass-dra av (dataset.glassDragOff), _busy (ingen render).
    _navReorder(nav) {
      let st = null, swallow = 0;
      const items = () => Array.from(nav.querySelectorAll('.it')).filter((b) => b.dataset.id && b.dataset.id !== '__more');
      const axis = () => (nav.classList.contains('rail') ? 'y' : 'x');
      const ctr = (r, ax) => (ax === 'x' ? r.left + r.width / 2 : r.top + r.height / 2);
      const clear = () => { clearTimeout(st && st.t); window.removeEventListener('pointermove', mv, true); window.removeEventListener('pointerup', up, true); window.removeEventListener('pointercancel', up, true); };
      const begin = () => {
        const its = items(), i = its.indexOf(st.el);
        if (i < 0) { clear(); st = null; return; }
        st.on = true; st.ax = axis(); st.its = its; st.i = i; st.to = i;
        st.c = its.map((b) => ctr(b.getBoundingClientRect(), st.ax));
        this._busy = true;
        nav.dataset.glassDragOff = '1';
        nav.classList.add('reord');
        st.el.classList.add('lift');
        st.el.style.transform = 'scale(1.12)';
        M.haptic('medium');
      };
      const mv = (e) => {
        if (!st || e.pointerId !== st.id) return;
        const dx = e.clientX - st.x, dy = e.clientY - st.y;
        if (!st.on) { if (Math.hypot(dx, dy) > 8) { clear(); st = null; } return; }
        e.stopPropagation(); if (e.cancelable) e.preventDefault();
        const d = st.ax === 'x' ? dx : dy, p = st.c[st.i] + d;
        let to = 0;
        st.c.forEach((c, j) => { if (j !== st.i && c < p) to++; });
        if (to !== st.to) { st.to = to; M.haptic('selection'); }
        st.its.forEach((b, j) => {
          if (j === st.i) { b.style.transform = `translate${st.ax.toUpperCase()}(${d}px) scale(1.12)`; return; }
          let k = j;
          if (st.i < st.to && j > st.i && j <= st.to) k = j - 1;
          else if (st.i > st.to && j < st.i && j >= st.to) k = j + 1;
          b.style.transform = k !== j ? `translate${st.ax.toUpperCase()}(${st.c[k] - st.c[j]}px)` : '';
        });
      };
      const up = (e) => {
        if (!st || (e.pointerId != null && e.pointerId !== st.id)) return;
        const s0 = st; st = null; clear();
        if (!s0.on) return;
        e.stopPropagation();
        swallow = Date.now();
        s0.its.forEach((b) => { b.style.transform = ''; b.classList.remove('lift'); });
        nav.classList.remove('reord');
        delete nav.dataset.glassDragOff;
        this._busy = false;
        const ids = s0.its.map((b) => b.dataset.id), [mvd] = ids.splice(s0.i, 1);
        ids.splice(s0.to, 0, mvd);
        if (e.type !== 'pointercancel' && s0.to !== s0.i) {
          M.haptic('success');
          const N = norm(this.config), bar = [...N.bar], pos = bar.map((id, j) => (N.hidden.has(id) ? -1 : j)).filter((j) => j >= 0);
          pos.forEach((j, k) => { if (ids[k] != null) bar[j] = ids[k]; }); // skjulte beholder plassen sin
          this._saveBar(bar);
        } else this._schedule(true);
      };
      nav.addEventListener('pointerdown', (e) => {
        if (e.button || st || this._inline) return;
        const el = e.composedPath().find((n) => n.classList && n.classList.contains('it'));
        if (!el || !el.dataset.id || el.dataset.id === '__more') return;
        st = { el, id: e.pointerId, x: e.clientX, y: e.clientY, on: false };
        st.t = setTimeout(() => { if (st && st.el === el) begin(); }, 420);
        window.addEventListener('pointermove', mv, true); window.addEventListener('pointerup', up, true); window.addEventListener('pointercancel', up, true);
      });
      nav.addEventListener('touchmove', (e) => { if (st && st.on) { e.stopPropagation(); if (e.cancelable) e.preventDefault(); } }, { passive: false });
      nav.addEventListener('contextmenu', (e) => e.preventDefault());
      nav.addEventListener('click', (e) => { if (Date.now() - swallow < 350) { e.stopPropagation(); e.preventDefault(); } }, true);
    }
    /* ---------------- Fiks 22.6: «Mer»-menyen – hold 380 ms og dra for å flytte et ikon (som i navbaren, 19.9) */
    // Bare punktene over streken (data-act="go"); verktøyene under står fast. Aksen bestemmes av ikonenes plassering
    // (loddrett i vanlig meny/rail, vannrett når de ligger på rad). Haptic medium ved start, light ved slipp; rekkefølgen
    // lagres i config.more (skjulte beholder plassen sin). > 8 px før holdet = ingen drag; klikket etter et drag spises (350 ms).
    _menuReorder(mb) {
      let st = null, swallow = 0;
      const items = () => Array.from(mb.querySelectorAll('.mi[data-act="go"]')).filter((b) => b.dataset.id);
      const ctr = (r, ax) => (ax === 'x' ? r.left + r.width / 2 : r.top + r.height / 2);
      const clear = () => { clearTimeout(st && st.t); window.removeEventListener('pointermove', mv, true); window.removeEventListener('pointerup', up, true); window.removeEventListener('pointercancel', up, true); };
      const begin = () => {
        const its = items(), i = its.indexOf(st.el);
        if (i < 0 || !mb.isConnected) { clear(); delete mb.dataset.glassDragOff; st = null; return; }
        const rs = its.map((b) => b.getBoundingClientRect()), a = rs[0], z = rs[rs.length - 1];
        st.on = true; st.ax = rs.length > 1 && Math.abs(z.left - a.left) > Math.abs(z.top - a.top) ? 'x' : 'y'; st.its = its; st.i = i; st.to = i;
        st.c = rs.map((r) => ctr(r, st.ax));
        this._busy = true;
        mb.classList.add('reord');
        st.el.classList.add('lift');
        st.el.style.transform = 'scale(1.08)';
        M.haptic('medium');
      };
      const mv = (e) => {
        if (!st || e.pointerId !== st.id) return;
        e.stopPropagation();
        const dx = e.clientX - st.x, dy = e.clientY - st.y;
        if (!st.on) { if (Math.hypot(dx, dy) > 8) { clear(); delete mb.dataset.glassDragOff; st = null; } return; }
        if (e.cancelable) e.preventDefault();
        const d = st.ax === 'x' ? dx : dy, p = st.c[st.i] + d;
        let to = 0;
        st.c.forEach((c, j) => { if (j !== st.i && c < p) to++; });
        if (to !== st.to) { st.to = to; M.haptic('selection'); }
        const T = st.ax.toUpperCase();
        st.its.forEach((b, j) => {
          if (j === st.i) { b.style.transform = `translate${T}(${d}px) scale(1.08)`; return; }
          let k = j;
          if (st.i < st.to && j > st.i && j <= st.to) k = j - 1;
          else if (st.i > st.to && j < st.i && j >= st.to) k = j + 1;
          b.style.transform = k !== j ? `translate${T}(${st.c[k] - st.c[j]}px)` : '';
        });
      };
      const up = (e) => {
        if (!st || (e.pointerId != null && e.pointerId !== st.id)) return;
        const s0 = st; st = null; clear();
        delete mb.dataset.glassDragOff;
        if (!s0.on) return;
        e.stopPropagation();
        swallow = this._mrSwallow = Date.now();
        s0.its.forEach((b) => { b.style.transform = ''; b.classList.remove('lift'); });
        mb.classList.remove('reord');
        this._busy = false;
        const ids = s0.its.map((b) => b.dataset.id), [mvd] = ids.splice(s0.i, 1);
        ids.splice(s0.to, 0, mvd);
        if (e.type === 'pointercancel') return this._schedule(true);
        M.haptic('light');
        if (s0.to === s0.i) return this._schedule(true);
        const N = norm(this.config), more = [...N.more], pos = more.map((id, j) => (N.hidden.has(id) ? -1 : j)).filter((j) => j >= 0);
        pos.forEach((j, k) => { if (ids[k] != null) more[j] = ids[k]; }); // skjulte beholder plassen sin (bakerst)
        this._saveBar(more, 'more');
      };
      mb.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        if (e.button || st || this._inline) return;
        const el = e.composedPath().find((n) => n.classList && n.classList.contains('mi'));
        if (!el || el.dataset.act !== 'go' || !el.dataset.id) return;
        st = { el, id: e.pointerId, x: e.clientX, y: e.clientY, on: false };
        mb.dataset.glassDragOff = '1'; // glass-draget tar verken trykket eller holdet
        st.t = setTimeout(() => { if (st && st.el === el) begin(); }, 380);
        window.addEventListener('pointermove', mv, true); window.addEventListener('pointerup', up, true); window.addEventListener('pointercancel', up, true);
      });
      ['touchstart', 'touchmove'].forEach((t) => mb.addEventListener(t, (e) => { e.stopPropagation(); if (t === 'touchmove' && st && st.on && e.cancelable) e.preventDefault(); }, { passive: t === 'touchstart' }));
      mb.addEventListener('contextmenu', (e) => e.preventDefault());
      // klikket etter slipp spises – også når fingeren slippes utenfor menyen (bakteppet ville ellers lukket den)
      const root = mb.getRootNode();
      if (root && !root.__mshMr) { root.__mshMr = true; root.addEventListener('click', (e) => { if (Date.now() - (this._mrSwallow || 0) < 350) { e.stopPropagation(); e.preventDefault(); } }, true); }
      mb.addEventListener('click', (e) => { if (Date.now() - swallow < 350) { e.stopPropagation(); e.preventDefault(); } }, true);
    }
    // Lagre ny rekkefølge i config.bar (ki-store via MSH.saveCardConfig – samme config som «Tilpass navbar»); key 'more' = Mer-menyen (22.6)
    _saveBar(bar, key = 'bar') {
      const old = this._rawConfig || this.config || {}, next = { ...old, [key]: bar };
      delete next.__eff;
      this.setConfig(M.store ? { ...next, __eff: 1 } : next); // lokalt først (som MSH.applyLive), ki-store-lagringen følger
      try { const r = M.saveCardConfig(this.hass, old, next); if (r && r.catch) r.catch((err) => console.error('msh-navbar-card', 'lagring feilet', err)); } catch (err) { console.error('msh-navbar-card', err); }
    }

    /* ---------------- mini-spiller (Fiks 17.26): eget lag i portalen (aldri inni en popup), over bunn-navbaren / nederst (rail) */
    // Spillere som skal vises: den som spiller først, deretter sist brukt. Av → ingen avhengigheter (ingen lyttere).
    _miniList(m) {
      const h = this.hass;
      if (!h || !h.states) return [];
      const mb = M.__mediaBus && M.__mediaBus['#media'];
      let ids = Array.isArray(m.players) && m.players.length ? m.players.filter((id) => h.states[id])
        : M.mediaPlayers ? M.mediaPlayers(h, (mb && mb.cfg) || {}).all.map((p) => p.id) : M.all(h, 'media_player');
      ids.forEach((id) => this.s(id));
      const st = (id) => (h.states[id] || {}).state, t = (id) => Date.parse((h.states[id] || {}).last_changed) || 0, now = Date.now();
      const sort = (L) => L.sort((a, b) => (st(b) === 'playing') - (st(a) === 'playing') || t(b) - t(a));
      // Hold på pause skjulte mini-spilleren: tilbake når en spiller går til playing fra en annen tilstand eller får nytt spor
      const hid = mStore.get();
      if (hid && hid.s) {
        let reset = false, dirty = false;
        ids.forEach((id) => {
          const s = h.states[id], o = hid.s[id];
          if (!s) return;
          if (!o) { hid.s[id] = { st: s.state, sig: mSig(s) }; dirty = true; return; }
          if ((s.state === 'playing' && o.st !== 'playing') || (mSig(s) !== o.sig && mSig(s) !== '|')) reset = true;
          else if (s.state !== o.st) { o.st = s.state; dirty = true; }
        });
        if (reset) mStore.set(null); else if (dirty) mStore.set(hid);
        if (!reset) return [];
      }
      clearTimeout(this._mExp);
      let live;
      if (m.cond === 'entity') {
        const e = m.entity && h.states[m.entity];
        if (m.entity) this.s(m.entity);
        if (!mStateOk(m.state, e)) return [];
      }
      live = ids.filter((id) => st(id) === 'playing' || (st(id) === 'paused' && now - t(id) < 600000));
      // «Noe spiller»: pause teller i 10 min – render på nytt når den går ut
      const exp = ids.filter((id) => st(id) === 'paused' && now - t(id) < 600000).map((id) => 600000 - (now - t(id)));
      if (exp.length) this._mExp = setTimeout(() => this._schedule(true), Math.min(...exp) + 100);
      if (live.length || m.cond === 'playing') return sort(live);
      const last = sort(ids.filter((id) => !/^(unavailable|unknown)$/.test(st(id) || 'unavailable')))[0];
      return last ? [last] : [];
    }
    _miniHtml(geo, m) {
      const h = this.hass, glass = this.config.style === 'glass';
      let L = this._miniList(m);
      const popHide = mHidePopOn(m) && mPopOpen(); // Fiks 20.16: dekker også Media
      // Bubble setter .is-popup-opened litt etter hash-byttet: én ny sjekk per hash (ingen polling)
      if (mHidePopOn(m) && !popHide && location.hash && this._mPopT !== location.hash) { this._mPopT = location.hash; setTimeout(() => this._schedule(true), 450); }
      const show = L.length > 0 && !popHide && !(m.hide_in_media !== false && location.hash === '#media');
      if (L.length) this._mLast = L; else L = (this._mLast || []).filter((id) => h.states[id]); // behold innholdet mens den glir ut
      this._mShow = show;
      if (!L.length) return '';
      // Fiks 20.19: ved innlasting, retur fra bakgrunn og når spilleren dukker opp igjen står den på første spiller som spiller
      // (listen er sortert: spiller først, så sist endret). Posisjonen lagres bare i minnet.
      if (!this._mVis) {
        this._mVis = (e) => { if (document.visibilityState === 'hidden') { this._mHid = true; return; } if ((e.type === 'pageshow' && e.persisted) || this._mHid) { this._mHid = false; this._mFresh = true; this._schedule(true); } };
        document.addEventListener('visibilitychange', this._mVis); window.addEventListener('pageshow', this._mVis);
      }
      if (this._mFresh !== false || !show) { if (show) { this._mCur = L[0]; this._mFresh = false; } else this._mFresh = true; }
      if (!L.includes(this._mCur)) this._mCur = L[0];
      // Fiks 22.8: utvidet kort lukkes når mini-spilleren skjules eller en annen spiller velges; teller hvert sekund bare mens utvidet + playing
      if (this._mExp && (!show || this._mExp !== this._mCur || !L.includes(this._mExp))) this._mExp = null;
      const xs = this._mExp && h.states[this._mExp], tick = !!(xs && xs.state === 'playing');
      if (tick && !this._mTick) this._mTick = setInterval(() => { if (!this._busy) this._schedule(true); }, 1000);
      else if (!tick && this._mTick) { clearInterval(this._mTick); this._mTick = null; }
      const ci = Math.max(0, L.indexOf(this._mCur));
      const W = Math.round(Math.min(geo.width - 28, 392));
      let pos;
      if (geo.rail) {
        // Fiks 18.4/18.8: nederst til høyre, nøyaktig over høyre fliskolonne i Hjem (målt av msh-hjem-faner-card → M.hjemTCol)
        const T = this._tCol(geo);
        pos = `left:${T.left}px;width:${T.width}px;bottom:max(16px, env(safe-area-inset-bottom, 0px));transform:translateY(var(--mo,0px))`;
      }
      else {
        // Følger navbarens krymping (scale .8 fra bunnen + translateY 8): samme skala, flyttet ned like mye som navbarens topp
        const compact = !!this.ui.compact && this.config.shrink !== false, nh = this._navH || (glass ? 64 : 68);
        const dy = compact ? nh * 0.2 + 6.4 : 0;
        pos = `left:${geo.left + geo.width / 2}px;width:${W}px;bottom:calc(var(--ki-nav-bottom, 8px) + var(--ki-nav-h, ${nh}px) + 10px);transform:translateX(-50%) translateY(calc(${dy.toFixed(1)}px + var(--mo,0px))) scale(${compact ? 0.8 : 1})`;
      }
      const vo = this._mVolV;
      const rows = L.map((id) => {
        const s = h.states[id], a = s.attributes || {}, playing = s.state === 'playing';
        const name = (M.mediaPlayers && (M.mediaPlayers(h, {}).all.find((p) => p.id === id) || {}).name) || a.friendly_name || id;
        const sub = [a.media_title, a.media_artist || a.media_album_artist].filter(Boolean).join(' · ') || a.app_name || a.source || (playing ? 'Spiller' : s.state === 'paused' ? 'Pauset' : M.fmtState(h, id));
        const pic = mPic(h, a.entity_picture_local || a.entity_picture), bad = this._mBad && this._mBad.has(pic);
        const T = this._miniTv(id), tv = T.tv, steps = tv && m.tv_vol !== 'slider'; // Fiks 19.15: TV → − / + i pillen
        const art = `<span class="mart" style="background:linear-gradient(135deg,${C.pink},${C.orange || '#f2b573'})">${M.icon(tv ? 'mdi:television' : 'mdi:music-note', 24)}${pic && !bad ? `<img class="mimg" data-key="img_${esc(pic.slice(-60))}" src="${esc(pic)}" alt="" draggable="false">` : ''}</span>`;
        const vol = this._mVolId === id, feat = Number(a.supported_features) || 0, drag = !steps && (!!(feat & 4) || (!feat && a.volume_level != null)); // uten volume_set / TV: −/+
        const muted = !!a.is_volume_muted;
        let mid;
        if (vol) {
          const v = vo && vo.id === id && Date.now() - vo.t < 2500 ? vo.v : Number(a.volume_level) || 0, pct = Math.round(v * 100);
          mid = `<button class="mhit" style="flex:none" data-act="mrow" data-id="${esc(id)}" data-mhold="info" aria-label="${esc(name)}">${art}</button>
            <div class="mvp${steps ? ' tvs' : ''}" data-vol="${esc(id)}" data-set="${drag ? 1 : 0}">
              <span class="mvf" style="width:${pct}%"></span>
              ${drag ? '' : `<button class="mst" data-act="mvstep" data-id="${esc(id)}" data-d="-1" data-haptic="light" aria-label="Senk volum" style="pointer-events:auto">${M.icon('mdi:minus', 20)}</button>`}
              <span class="mvl">${M.icon(mVolIcon(a), 18)}${a.volume_level != null ? `<b>${pct}%</b>` : steps ? '' : '<b>–</b>'}</span>
              ${drag ? '' : `<button class="mst" data-act="mvstep" data-id="${esc(id)}" data-d="1" data-haptic="light" aria-label="Øk volum" style="pointer-events:auto">${M.icon('mdi:plus', 20)}</button>`}
            </div>`;
        } else mid = `<button class="mhit" data-act="mrow" data-id="${esc(id)}" data-mhold="info" aria-label="${esc(name)}">${art}<span class="mtx"><b>${esc(name)}</b><i>${esc(sub)}</i></span></button>`;
        if (this._mExp === id) return this._miniExpRow(id, s, a, art, name, sub, playing, tv);
        return `<div class="mrow" data-mid="${esc(id)}" data-key="mr_${esc(id)}">${mid}
          <button class="mvb" data-act="mvol" data-id="${esc(id)}" data-mhold="mute" aria-label="${vol ? 'Lukk volum' : 'Volum'}">${M.icon(vol ? 'mdi:close' : muted ? 'mdi:volume-off' : mVolIcon(a), 24, muted && !vol ? 'color:var(--red,#f28073)' : '')}</button>
          <button class="mpp" data-act="mplay" data-id="${esc(id)}" data-mhold="hide" aria-label="${playing ? 'Pause' : 'Spill'}">${M.icon(playing ? 'mdi:pause' : 'mdi:play', 26)}</button>
        </div>`;
      }).join('');
      const dots = L.length > 1 && !this._mExp ? `<div class="mdots">${L.map((id, i) => `<button class="${i === ci ? 'on' : ''}" data-act="mdot" data-i="${i}" data-haptic="selection" aria-label="Spiller ${i + 1}"><span></span></button>`).join('')}</div>` : '';
      return `<div class="mini ${glass ? 'glass' : 'white'} ${show ? '' : 'off'}${this._mExp ? ' exp' : ''}" data-mini style="${pos}" aria-hidden="${show ? 'false' : 'true'}"><div class="msw">${rows}</div>${dots}</div>`;
    }
    // Fiks 22.8 · utvidet mini-spiller (172 px): omslag/tekst (trykk → #media) + ⌄ · spole-slider (nåtid / −gjenstår) ·
    // ⏮ · −10 s · play/pause · +10 s · ⏭. Uten varighet/posisjon eller SEEK → slider deaktivert med «–» og uten ±10 s;
    // direkte-TV uten varighet → ingen slider.
    _miniExpRow(id, s, a, art, name, sub, playing, tv) {
      const f = Number(a.supported_features) || 0, P = mPos(s), sv = this._mSeekV;
      const seekOk = !!(f & 2) && P.dur > 0 && P.pos != null;
      let pos = P.pos;
      if (sv && sv.id === id && (sv.drag || Date.now() - sv.t < 2500)) pos = sv.v;
      const pct = seekOk ? Math.max(0, Math.min(100, (pos / P.dur) * 100)) : 0;
      const seek = tv && !P.dur ? '' : `<div class="mseek${seekOk ? '' : ' dis'}" data-seek="${esc(id)}" data-dur="${P.dur}" data-set="${seekOk ? 1 : 0}" role="slider" aria-label="Spol" aria-valuemin="0" aria-valuemax="${Math.round(P.dur)}" aria-valuenow="${seekOk ? Math.round(pos) : 0}">
          <span class="mskf" style="width:${pct.toFixed(2)}%"></span><span class="msn">${seekOk ? mFmt(pos) : '–'}</span><span class="msr">${seekOk ? '−' + mFmt(P.dur - pos) : '–'}</span></div>`;
      const k = (act, d, icon, label, dis) => `<button class="mvb" data-act="${act}" data-id="${esc(id)}" data-d="${d}" data-haptic="light" aria-label="${label}"${dis ? ' disabled' : ''}>${M.icon(icon, 24)}</button>`;
      return `<div class="mrow mx" data-mid="${esc(id)}" data-key="mx_${esc(id)}">
        <div class="mxt"><button class="mhit" data-act="mrow" data-id="${esc(id)}" data-mhold="info" aria-label="${esc(name)}">${art}<span class="mtx"><b>${esc(name)}</b><i>${esc(sub)}</i></span></button>
          <button class="mvb" data-act="mexp" data-id="${esc(id)}" data-haptic="light" aria-label="Lukk">${M.icon('mdi:chevron-down', 26)}</button></div>
        ${seek}
        <div class="mxb">${k('mxtrk', -1, 'mdi:skip-previous', 'Forrige', !(f & 16))}${seekOk ? k('mx10', -10, 'mdi:rewind-10', 'Spol 10 s tilbake') : ''}
          <button class="mpp" data-act="mplay" data-id="${esc(id)}" data-mhold="hide" aria-label="${playing ? 'Pause' : 'Spill'}">${M.icon(playing ? 'mdi:pause' : 'mdi:play', 26)}</button>
          ${seekOk ? k('mx10', 10, 'mdi:fast-forward-10', 'Spol 10 s fram') : ''}${k('mxtrk', 1, 'mdi:skip-next', 'Neste', !(f & 32))}</div>
      </div>`;
    }
    // Spole-slider (22.8): trykk og dra setter posisjonen lokalt (haptic selection per 10 s), slipp → media_seek + toast
    _miniSeekDrag(el, e) {
      const id = el.dataset.seek, dur = Number(el.dataset.dur) || 0, fill = el.querySelector('.mskf'), ln = el.querySelector('.msn'), lr = el.querySelector('.msr');
      if (!dur) return;
      let b10 = null;
      const at = (ev) => {
        const r = el.getBoundingClientRect(), v = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)) * dur;
        this._mSeekV = { id, v, t: Date.now(), drag: true };
        if (fill) fill.style.width = (v / dur) * 100 + '%';
        if (ln) ln.textContent = mFmt(v);
        if (lr) lr.textContent = '−' + mFmt(dur - v);
        const bb = Math.floor(v / 10);
        if (bb !== b10) { if (b10 != null) M.haptic('selection'); b10 = bb; }
      };
      try { el.setPointerCapture(e.pointerId); } catch (x) { /* */ }
      M.haptic('selection');
      at(e);
      const mv = (ev) => { ev.stopPropagation(); at(ev); };
      const up = (ev) => {
        ev.stopPropagation();
        el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up);
        const v = this._mSeekV;
        if (!v || v.id !== id) return;
        v.drag = false; v.t = Date.now();
        if (ev.type !== 'pointerup') { this._mSeekV = null; return this._schedule(true); }
        M.call(this.hass, 'media_player', 'media_seek', { entity_id: id, seek_position: Math.round(v.v) });
        if (this.config.toasts !== false) M.toast('Spoler til ' + mFmt(v.v));
        return undefined;
      };
      el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    }
    // Høyre fliskolonne (fiks 18.8): målt verdi (siste måling beholdes på andre faner), ellers utregningen fra 18.4:
    // bredde (innholdsbredde − 8) / 2 (min. 260), høyrekant = innholdets padding-right (18).
    _tCol(geo) {
      const T = M.hjemTCol;
      if (T && T.width > 0) return T;
      const cw = geo.width - M.railPad() - 18, w = Math.max(260, (cw - 8) / 2);
      return { left: Math.round(geo.left + geo.width - 18 - w), width: Math.round(w) };
    }
    // Fiks 18.4: popups (Bubble Card) og ark sentreres på innholdsflaten til høyre for railen og dekker den ikke.
    // Bubble leser --bubble-content-inline-start (arves fra dashbordelementet); egne ark leser M.railOn.
    _railVars(rail, geo) {
      M.railOn = !!rail;
      const el = this._dEl;
      if (!el || !el.style) return;
      const v = rail ? Math.round(geo.left + M.railPad()) + 'px' : '';
      if (el.style.getPropertyValue('--bubble-content-inline-start') !== v) { if (v) el.style.setProperty('--bubble-content-inline-start', v); else el.style.removeProperty('--bubble-content-inline-start'); }
    }
    // Hendelser i mini-spilleren (kobles én gang på portalens shadow root)
    _miniBind(sr) {
      const hit = (e, sel) => { for (const n of e.composedPath()) { if (n === sr) break; if (n.matches && n.matches(sel)) return n; } return null; };
      const inMini = (e) => !!hit(e, '[data-mini]');
      // Fallgruve 2: drag/sveip i mini-spilleren skal aldri nå popupen/siden under
      ['touchstart', 'touchmove'].forEach((t) => sr.addEventListener(t, (e) => { if (inMini(e)) e.stopPropagation(); }, { passive: true }));
      sr.addEventListener('contextmenu', (e) => { if (inMini(e)) e.preventDefault(); });
      // Albumbildet feiler → ikon på farge (huskes, så det ikke prøves igjen ved neste render)
      sr.addEventListener('error', (e) => { const t = e.target; if (t && t.classList && t.classList.contains('mimg')) { (this._mBad || (this._mBad = new Set())).add(t.getAttribute('src')); t.remove(); } }, true);
      // Et hold teller ikke som trykk
      sr.addEventListener('click', (e) => { if (this._mSwallow && inMini(e)) { this._mSwallow = false; e.stopPropagation(); e.preventDefault(); } }, true);
      sr.addEventListener('scroll', (e) => {
        const sw = e.target;
        if (!sw.classList || !sw.classList.contains('msw') || !sw.clientWidth) return;
        const i = Math.round(sw.scrollLeft / sw.clientWidth), row = sw.children[i];
        if (row && row.dataset.mid) this._mCur = row.dataset.mid;
        if (this._mExp && this._mCur !== this._mExp) { this._mExp = null; this._schedule(true); } // 22.8: bytt spiller lukker
        sr.querySelectorAll('.mdots button').forEach((b, j) => b.classList.toggle('on', j === i));
      }, true);
      sr.addEventListener('pointerdown', (e) => {
        if (e.button || !inMini(e)) return;
        e.stopPropagation();
        const sk = hit(e, '.mseek[data-set="1"]');
        if (sk) return this._miniSeekDrag(sk, e); // Fiks 22.8
        if (hit(e, '.mseek')) return undefined;
        const vp = hit(e, '.mvp[data-set="1"]');
        if (vp && !hit(e, '.mst')) return this._miniVolDrag(vp, e);
        // Fiks 19.15: hold på − / + gjentar trinnet hvert 250 ms (etter 400 ms); klikket etter holdet spises
        const st = hit(e, '.mst[data-act="mvstep"]');
        if (st) {
          const x0 = e.clientX, y0 = e.clientY, sid = st.dataset.id, dir = Number(st.dataset.d);
          const stop = () => { clearTimeout(this._mRep); clearInterval(this._mRep); if (this._mSwallow) setTimeout(() => { this._mSwallow = false; }, 400); sr.removeEventListener('pointerup', stop); sr.removeEventListener('pointercancel', stop); sr.removeEventListener('pointermove', mv); };
          const mv = (ev) => { if (Math.hypot(ev.clientX - x0, ev.clientY - y0) > 8) stop(); };
          sr.addEventListener('pointerup', stop); sr.addEventListener('pointercancel', stop); sr.addEventListener('pointermove', mv);
          clearTimeout(this._mRep); clearInterval(this._mRep);
          this._mRep = setTimeout(() => {
            this._mSwallow = true;
            const tick = () => { M.haptic('light'); this._miniStep(sid, dir); };
            tick();
            this._mRep = setInterval(tick, 250);
          }, 400);
          return;
        }
        const pp = hit(e, '.mpp[data-act="mplay"]');
        if (pp) return this._miniSkipDrag(pp, e); // Fiks 20.20: trykk / hold 550 ms / dra
        const el = hit(e, '[data-mhold]');
        if (!el) return;
        const x0 = e.clientX, y0 = e.clientY, kind = el.dataset.mhold, id = el.dataset.id;
        const done = () => { clearTimeout(this._mHold); sr.removeEventListener('pointerup', done); sr.removeEventListener('pointercancel', done); sr.removeEventListener('pointermove', mv); };
        const mv = (ev) => { if (Math.hypot(ev.clientX - x0, ev.clientY - y0) > 8) done(); };
        sr.addEventListener('pointerup', done); sr.addEventListener('pointercancel', done); sr.addEventListener('pointermove', mv);
        clearTimeout(this._mHold);
        this._mHold = setTimeout(() => {
          done();
          this._mSwallow = true; setTimeout(() => { this._mSwallow = false; }, 700);
          M.haptic('medium');
          this._miniHold(kind, id);
        }, kind === 'hide' ? 550 : kind === 'mute' ? 500 : 520);
      });
    }
    // Fiks 20.20 · play/pause: trykk = spill/pause (klikket), hold 550 ms uten bevegelse = skjul (19.7), dra > 14 px =
    // ⏮/⏭ glir ut fra knappen til midten av mini-spilleren; slipp på markert knapp = forrige/neste (TV: kanal − / +).
    // Laget ligger utenfor morph (__mshKeep), så hass-oppdateringer under draget ikke fjerner det.
    _miniSkipDrag(pp, e) {
      const id = pp.dataset.id, x0 = e.clientX, y0 = e.clientY, pid = e.pointerId, mini = pp.closest('[data-mini]');
      let sk = null, sel = null, vert = false, vdone = false;
      try { pp.setPointerCapture(pid); } catch (x) { /* */ }
      const open = () => {
        const s = this.hass && this.hass.states[id], f = Number(((s && s.attributes) || {}).supported_features) || 0, tv = this._miniTv(id).tv;
        const mr = mini.getBoundingClientRect(), pr = pp.getBoundingClientRect(), k = mini.offsetWidth ? mr.width / mini.offsetWidth : 1;
        const px = (pr.left + pr.width / 2 - mr.left) / k, py = (pr.top + pr.height / 2 - mr.top) / k, cx = mini.offsetWidth / 2;
        const ok = { prev: !!(f & 16), next: !!(f & 32) };
        const btn = (side, dx, icon, delay) => `<span class="mskb${ok[side] ? '' : ' dis'}" data-sk="${side}" style="left:${(px - 23).toFixed(1)}px;top:${(py - 23).toFixed(1)}px;--tx:${(cx + dx - px).toFixed(1)}px;transition-delay:${delay}ms">${M.icon(icon, 24)}</span>`;
        const lay = document.createElement('div');
        lay.className = 'msk'; lay.__mshKeep = true;
        lay.innerHTML = btn('next', 62, tv ? 'mdi:plus' : 'mdi:skip-next', 0) + btn('prev', -62, tv ? 'mdi:minus' : 'mdi:skip-previous', 50);
        mini.__mshKeepN = (mini.__mshKeepN || 0) + 1;
        mini.appendChild(lay);
        void lay.offsetWidth; // startposisjon (i play-knappen) før de glir ut
        lay.classList.add('out');
        const t = setTimeout(() => lay.classList.add('rdy'), 440);
        sk = { lay, tv, ok, t, c: { prev: [mr.left + (cx - 62) * k, mr.top + py * k], next: [mr.left + (cx + 62) * k, mr.top + py * k] } };
      };
      const close = () => {
        if (!sk) return;
        const L = sk.lay;
        clearTimeout(sk.t);
        L.classList.remove('rdy'); L.classList.add('cl'); L.classList.remove('out');
        setTimeout(() => { L.remove(); mini.__mshKeepN = Math.max(0, (mini.__mshKeepN || 1) - 1); }, 230);
      };
      const end = () => {
        clearTimeout(this._mHold);
        pp.removeEventListener('pointermove', mv); pp.removeEventListener('pointerup', up); pp.removeEventListener('pointercancel', up);
        try { pp.releasePointerCapture(pid); } catch (x) { /* */ }
      };
      const mv = (ev) => {
        ev.stopPropagation();
        if (!sk) {
          // Fiks 22.8: retningen bestemmes ved første 14 px – loddrett = utvid/lukk (sveip opp/ned ≥ 20 px), aldri ⏮/⏭, og omvendt
          const dx = ev.clientX - x0, dy = ev.clientY - y0;
          if (!vert) {
            if (Math.hypot(dx, dy) <= 14) return;
            clearTimeout(this._mHold);
            if (Math.abs(dy) > Math.abs(dx)) vert = true;
          }
          if (vert) {
            if (vdone || Math.abs(dy) < 20) return;
            const exp = this._mExp === id;
            if (dy < 0 ? exp : !exp) return;
            vdone = true;
            this._mSwallow = true; setTimeout(() => { this._mSwallow = false; }, 500);
            M.haptic('medium');
            this._mExp = dy < 0 ? id : null;
            if (dy < 0) this._mCur = id;
            this._mVolId = null;
            this._schedule(true);
            return;
          }
          M.haptic('light');
          open();
        }
        const d = (side) => Math.hypot(ev.clientX - sk.c[side][0], ev.clientY - sk.c[side][1]);
        let n = null;
        ['prev', 'next'].forEach((side) => { if (sk.ok[side] && d(side) <= 40 && (!n || d(side) < d(n))) n = side; });
        if (n === sel) return;
        sel = n;
        sk.lay.querySelectorAll('.mskb').forEach((b) => b.classList.toggle('on', b.dataset.sk === sel));
        if (n) M.haptic('selection');
      };
      const up = (ev) => {
        ev.stopPropagation();
        end();
        if (vert) { this._mSwallow = true; setTimeout(() => { this._mSwallow = false; }, 400); return; } // 22.8: sveip gir ikke spill/pause
        if (!sk) return; // vanlig trykk → klikket gir spill/pause
        this._mSwallow = true; setTimeout(() => { this._mSwallow = false; }, 400); // klikket etter slipp spises
        if (ev.type === 'pointerup' && sel) {
          M.haptic('medium');
          M.call(this.hass, 'media_player', sel === 'prev' ? 'media_previous_track' : 'media_next_track', { entity_id: id });
          if (this.config.toasts !== false) M.toast(sk.tv ? (sel === 'prev' ? 'Kanal −' : 'Kanal +') : (sel === 'prev' ? 'Forrige spor' : 'Neste spor'));
        }
        close();
      };
      pp.addEventListener('pointermove', mv); pp.addEventListener('pointerup', up); pp.addEventListener('pointercancel', up);
      clearTimeout(this._mHold);
      this._mHold = setTimeout(() => {
        if (sk) return;
        end();
        this._mSwallow = true; setTimeout(() => { this._mSwallow = false; }, 700);
        M.haptic('medium');
        this._miniHold('hide', id);
      }, 550);
    }
    // Dra på volum-pillen → volume_set (throttlet 150 ms), pillen lukkes 3 s etter siste justering
    _miniVolDrag(vp, e) {
      const id = vp.dataset.vol, fill = vp.querySelector('.mvf'), lab = vp.querySelector('.mvl b');
      let last = 0, pend = null;
      const call = (v) => { last = Date.now(); pend = null; M.call(this.hass, 'media_player', 'volume_set', { entity_id: id, volume_level: v }); };
      const send = (v) => { const dt = Date.now() - last; clearTimeout(this._mVT); if (dt >= 150) call(v); else { pend = v; this._mVT = setTimeout(() => { if (pend != null) call(pend); }, 150 - dt); } };
      const at = (ev) => {
        const r = vp.getBoundingClientRect(), v = Math.round(Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)) * 100) / 100;
        if (this._mVolV && this._mVolV.id === id && this._mVolV.v === v) { this._mVolV.t = Date.now(); return; }
        this._mVolV = { id, v, t: Date.now() };
        if (fill) fill.style.width = v * 100 + '%';
        if (lab) lab.textContent = Math.round(v * 100) + '%';
        send(v);
        this._miniVolTimer();
      };
      try { vp.setPointerCapture(e.pointerId); } catch (x) { /* */ }
      M.haptic('selection');
      at(e);
      const mv = (ev) => { ev.stopPropagation(); at(ev); };
      const up = () => { vp.removeEventListener('pointermove', mv); vp.removeEventListener('pointerup', up); vp.removeEventListener('pointercancel', up); if (pend != null) { clearTimeout(this._mVT); call(pend); } };
      vp.addEventListener('pointermove', mv); vp.addEventListener('pointerup', up); vp.addEventListener('pointercancel', up);
    }
    // Fiks 19.15: er spilleren en TV? device_class tv, valgt som TV i Media (M.mediaPlayers / Media-kortets config) eller remote.* på samme enhet
    _miniTv(id) {
      const h = this.hass, a = ((h.states[id] || {}).attributes) || {};
      const mb = M.__mediaBus && M.__mediaBus['#media'];
      const p = M.mediaPlayers ? M.mediaPlayers(h, (mb && mb.cfg) || {}, true).all.find((x) => x.id === id) : null;
      let tv = a.device_class === 'tv' || !!(p && p.kind === 'tv');
      const e = !tv && M.regEntry ? M.regEntry(h, id) : null;
      if (e && e.device_id) tv = M.all(h, 'remote', (s, x) => (M.regEntry(h, x) || {}).device_id === e.device_id).length > 0;
      return { tv, pc: (p && p.pc) || {} };
    }
    // Ett volumtrinn (−/+): samme tjeneste som «Volum styres av» i Media (knapp/bryter/skript når valgt, ellers media_player.volume_up/down)
    _miniStep(id, dir) {
      const h = this.hass, pc = this._miniTv(id).pc, ent = pc.volume === 'buttons' ? pc[dir > 0 ? 'volume_up' : 'volume_down'] : null;
      this._miniVolTimer();
      if (ent) {
        const d = String(ent).split('.')[0], sv = d === 'button' || d === 'input_button' ? 'press' : 'turn_on';
        return M.call(h, /^(button|input_button|script|scene|switch|light|input_boolean)$/.test(d) ? d : 'homeassistant', sv, { entity_id: ent });
      }
      return M.call(h, 'media_player', dir > 0 ? 'volume_up' : 'volume_down', { entity_id: id });
    }
    _miniVolTimer() {
      clearTimeout(this._mVC);
      this._mVC = setTimeout(() => { if (this._mVolId) { this._mVolId = null; this._schedule(true); } }, 3000);
    }
    _miniHold(kind, id) {
      const h = this.hass, s = h && h.states[id];
      if (!s) return;
      const toast = (t) => { if (this.config.toasts !== false) M.toast(t); };
      if (kind === 'info') return M.moreInfo(this, id);
      if (kind === 'mute') {
        const mute = !s.attributes.is_volume_muted;
        M.call(h, 'media_player', 'volume_mute', { entity_id: id, is_volume_muted: mute });
        return toast(mute ? 'Dempet' : 'Lyd på');
      }
      if (kind === 'hide') {
        const snap = {};
        (this._mLast || []).concat(M.all(h, 'media_player')).forEach((x) => { const t = h.states[x]; if (t) snap[x] = { st: t.state, sig: mSig(t) }; });
        mStore.set({ s: snap, t: Date.now() });
        // Fiks 19.7: skjuler BARE mini-spilleren – ingen media_pause/media_play_pause, avspillingen fortsetter uendret
        this._mVolId = null;
        this._schedule(true);
        return toast('Mini-spilleren er skjult');
      }
      return undefined;
    }
    _miniAction(name, el) {
      const h = this.hass, id = el.dataset.id, sr = this._portal && this._portal.shadowRoot;
      if (name === 'mplay') return M.call(h, 'media_player', 'media_play_pause', { entity_id: id });
      if (name === 'mvol') { this._mVolId = this._mVolId === id ? null : id; if (this._mVolId) this._miniVolTimer(); return this._schedule(true); }
      if (name === 'mvstep') return this._miniStep(id, Number(el.dataset.d));
      if (name === 'mexp') { this._mExp = null; return this._schedule(true); } // 22.8: ⌄ lukker
      if (name === 'mxtrk') return M.call(h, 'media_player', Number(el.dataset.d) < 0 ? 'media_previous_track' : 'media_next_track', { entity_id: id });
      if (name === 'mx10') {
        const P = mPos(h.states[id]), sv = this._mSeekV, cur = sv && sv.id === id && Date.now() - sv.t < 2500 ? sv.v : P.pos;
        if (cur == null || !P.dur) return undefined;
        const v = Math.max(0, Math.min(P.dur, cur + Number(el.dataset.d)));
        this._mSeekV = { id, v, t: Date.now() };
        this._schedule(true);
        return M.call(h, 'media_player', 'media_seek', { entity_id: id, seek_position: Math.round(v) });
      }
      if (name === 'mdot') { const sw = sr && sr.querySelector('.msw'); if (sw) sw.scrollTo({ left: Number(el.dataset.i) * sw.clientWidth, behavior: 'smooth' }); return undefined; }
      if (name === 'mrow') {
        // Media-popupen med denne spilleren valgt (Media-kortets onOpen velger standardfane først → velg etterpå)
        M.openPopup('#media');
        const pick = () => { const b = M.__mediaBus && M.__mediaBus['#media']; if (!b || !b.main || typeof b.main.select !== 'function' || !M.mediaPlayers) return; const p = M.mediaPlayers(this.hass, b.cfg || {}).all.find((x) => x.id === id); if (p) b.main.select(p.kind, id); };
        setTimeout(pick, 150); setTimeout(pick, 500);
      }
      return undefined;
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

    // Er popupen til knappen åpen nå? (location.hash = knappens hash)
    _isOpen(id) {
      if (!id || id === '__more' || !location.hash) return false;
      const h = hashOf(norm(this.config), id);
      return !!h && h === location.hash;
    }

    onAction(name, el, ev) {
      const N = norm(this.config);
      if (name === 'go') {
        const id = el.dataset.id;
        if (id === '__more') {
          if (this._inline) return;
          if (this.ui.menu) return this._closeMenu();
          const r = el.getBoundingClientRect(), nav = el.closest('nav'), nr = nav ? nav.getBoundingClientRect() : r;
          return this._openMenu({ cx: r.left + r.width / 2, right: this._wide(this._dash().width) ? nr.right : r.right, top: r.top, bottom: nr.bottom });
        }
        this._closeMenu(true);
        this.setUI({ compact: false });
        if (hashOf(N, id) === '#media' && mStore.get()) mStore.set(null); // Fiks 19.7: Media i navbaren henter den skjulte mini-spilleren tilbake
        // Popupen til knappen er allerede åpen → lukk den (fasit Hjem v2: isOpen ? closePop() : open…).
        // Gjelder bunn, glass (slipp etter dra), rail og «Mer»-menyen – alle går via denne handlingen.
        // Dobbel hendelse ved åpning (f.eks. klikk + syntetisk klikk etter glass-slipp, dobbelttrykk): samme knapp < 400 ms
        // etter at den åpnet popupen lukker ikke – ellers fjernes hashen med én gang (Fiks 12).
        if (this._isOpen(id)) { if (this._opened && this._opened.id === id && Date.now() - this._opened.t < 400) return; M.closePopup(); this._schedule(true); return; }
        const b = N.B[id] || {};
        if (b.custom && b.action) this._run(b);
        const h = hashOf(N, id);
        if (h) { this._opened = { id, t: Date.now() }; M.openPopup(h); }
        else if (M.tap) M.tap.run(this, tapOf(N, id)); // dashbord-sti / URL
        return;
      }
      if (name[0] === 'm' && /^m(play|vol|vstep|dot|row|exp|x10|xtrk)$/.test(name)) return this._miniAction(name, el); // Fiks 17.26
      if (name === 'mclose') { if (Date.now() - (this._menuT || 0) < 300) return; return this._closeMenu(); }
      if (name === 'mtool') {
        this.setUI({ menu: false });
        if (el.dataset.id === '__tilpass') return this._tilpassSheet(); // 24.5
        if (el.dataset.id === '__all') { this.setUI({ menu: false }); return window.dispatchEvent(new CustomEvent('ki-open-editor', { detail: { editor: 'tilpass-alt' } })); } // 23.7
        if (el.dataset.id === '__edit') { this.setUI({ menu: false }); return window.dispatchEvent(new CustomEvent('ki-open-editor', { detail: { editor: 'navbar' } })); }
        if (el.dataset.id === '__kiosk') { this.setUI({ menu: false }); return M.kioskSheet && M.kioskSheet(this); }
        if (el.dataset.id === '__hdr') { this.setUI({ menu: false }); return window.dispatchEvent(new CustomEvent('ki-open-editor', { detail: { editor: 'header' } })); }
        if (el.dataset.id === '__home') { this.setUI({ menu: false }); return window.dispatchEvent(new CustomEvent('ki-open-editor', { detail: { editor: 'home' } })); }
        return;
      }
      return super.onAction(name, el, ev);
    }

    // «Mer»-menyen (Fiks 3 · 8): åpnes på click (portalens klikk-lytter stopper propagering), eksplisitt open/close.
    // Lukke-lytteren kobles på i neste frame og ignorerer alt de første 300 ms; utenfor = composedPath uten menyen/knappen.
    _openMenu(at) {
      this._menuT = Date.now();
      this.setUI({ menu: true, compact: false, menuAt: at });
      setTimeout(() => { if (this.ui.menu) this._schedule(true); }, 320); // slipp bakteppets pointer-events-vern
      if (!this._outside) {
        this._outside = (e) => {
          if (!this.ui.menu) { window.removeEventListener('click', this._outside, true); return; }
          if (Date.now() - (this._menuT || 0) < 300) return;
          const sr = this._portal && this._portal.shadowRoot, path = e.composedPath();
          if (sr && path.some((n) => n.nodeType === 1 && (n.hasAttribute('data-menu') || n.dataset.id === '__more' || n.classList.contains('mbg')))) return; // egne handlere
          this._closeMenu();
        };
      }
      requestAnimationFrame(() => { if (this.ui.menu) window.addEventListener('click', this._outside, true); });
    }
    _closeMenu(silent) {
      if (this._outside) window.removeEventListener('click', this._outside, true);
      if (this.ui.menu) this.setUI({ menu: false });
      return silent;
    }
    // Liquid glass-flagget for resten av dashbordet (MSH.glassOn): speiler navbarens config til <html data-ki-glass>
    _syncGlass() {
      const g = this.config && this.config.style === 'glass' ? '1' : '0', ds = document.documentElement.dataset;
      if (ds.kiGlass === g) return;
      ds.kiGlass = g;
      M.glassNotify(); // Tilpass-arkene følger navbar-stilen bare når Liquid Glass-temaet (theme.liquid_glass) ikke er satt
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
    msh-icon-field{--msh-if-bg:#232323;--msh-if-ic:#3a3a3a} msh-tap-picker{--msh-tp-bg:#232323}
    :host([glass]) msh-icon-field{--msh-if-bg:rgba(0,0,0,0.25);--msh-if-ic:rgba(255,255,255,0.12)} :host([glass]) msh-tap-picker{--msh-tp-bg:rgba(0,0,0,0.25)}
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
    .tg .tx2{display:flex;flex-direction:column;gap:2px;min-width:0;text-align:left}
    .tg .tx2 b{font-size:15px;font-weight:500} .tg .tx2 i{font-style:normal;font-size:12px;font-weight:400;color:#979797}
    .tg:has(.tx2){height:auto;min-height:62px;padding-top:8px;padding-bottom:8px;border-radius:24px;gap:10px}
    .trk{position:relative;width:50px;height:30px;border-radius:15px;flex:none;background:#545454;transition:background .2s}
    .trk.on{background:${M.SWITCH_ON}} /* Fiks 26: rosa brytere */
    .knb{position:absolute;top:3px;left:3px;width:24px;height:24px;border-radius:12px;background:#c7c7c7;transition:left .2s}
    .trk.on .knb{left:23px;background:#2f2f2f}
    .wseg{display:flex;gap:2px;padding:4px;border-radius:24px;background:#3a3a3a}
    .nbbot{display:flex;flex-direction:column;gap:6px;padding:10px 12px;border-radius:16px;background:#3a3a3a}
    .nbbot .ln{display:flex;align-items:center;gap:10px}
    .nbbot input[type=range]{flex:1;min-width:0;accent-color:#f285c9;touch-action:none;cursor:pointer}
    .nbbot .nbbv{flex:none;min-width:48px;text-align:right;font-size:13px;color:#fafafa;font-variant-numeric:tabular-nums}
    .nbbot .rsb{flex:none;height:36px;padding:0 14px;border-radius:18px}
    :host([glass]) .nbbot{${M.glassSurface('row')}}
    /* Fiks 20.6: inni kortet «Plassering og oppførsel» (#3a3a3a) – rader på indre flate #404040, avstand-delen skilt med tynn linje */
    .nbpl .tg,.nbpl .wseg{background:#404040}
    .nbpl .gt{padding:6px 4px 0}
    .nbpl .gt.nbbl{font-size:12px;color:#979797;margin-top:6px;padding:12px 4px 0;border-top:1px solid rgba(255,255,255,0.06)}
    .nbpl .nbbot{padding:4px 4px 0;background:none}
    :host([glass]) .nbpl .nbbot{background:none;box-shadow:none;backdrop-filter:none;-webkit-backdrop-filter:none}
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
    /* Liquid glass (glassark, se 01-editor): rader/grupper = glassSurface('row'), spor/felt rgba(0,0,0,.25), aktivt segment = glassboble */
    :host([glass]) .nrow,:host([glass]) .ned,:host([glass]) .tg,:host([glass]) .prof,:host([glass]) .rule,:host([glass]) .rsb{${M.glassSurface('row')}}
    :host([glass]) .prof.on{box-shadow:inset 0 0 0 2px ${C.pink}}
    :host([glass]) .seg,:host([glass]) .wseg,:host([glass]) .ud,:host([glass]) .i44,:host([glass]) .icp,:host([glass]) .epk,:host([glass]) .i34,:host([glass]) .i36,:host([glass]) .s44,:host([glass]) .st,:host([glass]) .rule .inp{background:rgba(0,0,0,0.25)}
    :host([glass]) .seg,:host([glass]) .wseg{touch-action:pan-y}
    :host([glass]) .seg button.on,:host([glass]) .wseg button.on{${M.GLASS_BUBBLE}}
    :host([glass]) .seg button,:host([glass]) .wseg button,:host([glass]) .gt,:host([glass]) .cap,:host([glass]) .pft .x i{color:rgba(255,255,255,0.62)}
    :host([glass]) .chp:not(.on),:host([glass]) .trk:not(.on){background:rgba(255,255,255,0.14)}
  `;

  class NavEditor extends Base {
    constructor() {
      super();
      // Fiks 18.6: «Avstand fra bunnen» oppdaterer navbaren live mens man drar (lagres ved slipp i _change)
      this.shadowRoot.addEventListener('input', (e) => {
        const t = e.target;
        if (!t.dataset || !t.dataset.nbbot) return;
        M.setNavBottom(t.value, false);
        const lb = t.parentNode && t.parentNode.querySelector('.nbbv');
        if (lb) lb.textContent = t.value + ' px';
      });
      // Fallgruve 2: dra i slideren skal ikke nå popupen/arket under
      ['pointerdown', 'touchstart', 'touchmove'].forEach((ev) => this.shadowRoot.addEventListener(ev, (e) => { if (e.target && e.target.dataset && e.target.dataset.nbbot) e.stopPropagation(); }, { passive: true }));
      // Ikonvelger (msh-icon-field) og «Handling» (msh-tap-picker) sender value-changed
      this.shadowRoot.addEventListener('value-changed', (e) => {
        const t = e.composedPath().find((n) => n.dataset && (n.dataset.nbicon || n.dataset.nbtap));
        if (!t) return;
        e.stopPropagation();
        const v = e.detail ? e.detail.value : null;
        if (t.dataset.nbicon) return this._btn(t.dataset.nbicon, { icon: v || undefined });
        const id = t.dataset.nbtap, isC = !!(norm(this._config).B[id] || {}).custom, tp = M.tap.norm(v);
        // Standard (innebygd '#<id>' / egen knapp uten handling) lagres ikke; ellers tap i HA-format, gammel hash fjernes
        const std = isC ? !tp || tp.action === 'none' : !tp || (tp.action === 'navigate' && tp.navigation_path === '#' + id);
        return this._btn(id, { tap: std ? undefined : tp, hash: undefined });
      });
    }
    _field(f, key) {
      if (f.type === 'navbar') return this._navbar(f.part);
      if (f.type === 'nbplace') return this._nbPlace(); // Fiks 20.6
      if (f.type === 'nbkiosk') return this._nbKiosk(); // Fiks 23.5
      return super._field(f, key);
    }
    _render() {
      super._render();
      if (!this.shadowRoot) return;
      this.shadowRoot.querySelectorAll('.seg,.wseg').forEach((s) => M.glassDrag(s, { axis: 'x' }));
    }
    // Fiks 23.5: kiosk-statusen følger hass (bryter-entiteten) og ki-store (kiosk.*) mens editoren er åpen
    set hass(h) {
      const ks = (x) => { const e = M.kioskEntity ? M.kioskEntity() : '', st = x && x.states && x.states[e]; return e + ':' + (st ? st.state : ''); };
      const first = !this._hass, ch = !first && ks(this._hass) !== ks(h);
      this._hass = h;
      if (first || ch) this._render();
    }
    get hass() { return this._hass; }
    connectedCallback() {
      super.connectedCallback();
      if (!this._kUnsub && M.store && M.store.subscribe) this._kUnsub = M.store.subscribe((d, p) => { if (!p || /^kiosk(\.|$)/.test(p)) this._render(); });
    }
    disconnectedCallback() { if (super.disconnectedCallback) super.disconnectedCallback(); if (this._kUnsub) { this._kUnsub(); this._kUnsub = null; } }
    // Fiks 23.5 · «Kiosk-modus»: ny vei inn til 22.9 (MSH.kioskSheet/kioskEntity/kioskCount, 53-kiosk.js) – ingen ny config.
    // Rad 1: status + bryter (input_boolean.toggle som toppkortet i kiosk-arket). Rad 2: åpner kiosk-arket oppå dette arket.
    _nbKiosk() {
      if (!M.kioskEntity) return '';
      const h = this._hass || {}, ent = M.kioskEntity(), s = h.states && h.states[ent], on = !!(s && s.state === 'on');
      const n = M.kioskCount ? M.kioskCount() : 0;
      return `<style>.nbk{display:flex;flex-direction:column;gap:2px;padding:6px;border-radius:24px;background:#3a3a3a}
        .nbk .kr{display:flex;align-items:center;gap:12px;min-height:56px;padding:6px 10px;border-radius:18px;text-align:left;color:inherit;width:100%;box-sizing:border-box}
        .nbk .kic{width:40px;height:40px;border-radius:20px;display:grid;place-items:center;flex:none;background:#404040;color:#afafaf}
        .nbk .kic.on{background:${PINK};color:#2f2f2f}
        .nbk .kt{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
        .nbk .kt b{font-size:15px;font-weight:500} .nbk .kt i{font-style:normal;font-size:12px;color:#979797;overflow-wrap:anywhere}
        .nbk .ksep{height:1px;margin:0 10px;background:rgba(255,255,255,0.06)}
        :host([glass]) .nbk{${M.glassSurface('row')}}</style>
        <div class="nbx"><span class="gt">Kiosk-modus</span></div>
        <div class="nbk" data-key="nbkiosk">
          <div class="kr"><span class="kic ${on ? 'on' : ''}">${M.icon('mdi:fit-to-screen-outline', 22)}</span><span class="kt"><b>Kiosk-modus er ${on ? 'på' : 'av'}</b><i>${esc(ent)}${s ? '' : ' · finnes ikke'} · påvirker ${n} valg</i></span>
            <button class="trk ${on ? 'on' : ''}" role="switch" aria-checked="${on}" aria-label="Kiosk-modus" data-a="nbkiosk"><span class="knb"></span></button></div>
          <div class="ksep"></div>
          <button class="kr" data-a="nbkset"><span class="kic">${M.icon('mdi:tune-variant', 22)}</span><span class="kt"><b>Kiosk-innstillinger</b><i>Hvem og hva</i></span>${M.icon('mdi:chevron-right', 22, 'color:#7f7f7f')}</button>
        </div>`;
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
    _navbar(part) {
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
            <div class="r1"><div class="seg">${OPS.map(([o, l]) => `<button class="${op === o ? 'on' : ''}" aria-selected="${op === o}" data-a="nbrop" data-id="${esc(id)}" data-i="${ri}" data-v="${esc(o)}">${l}</button>`).join('')}</div>
              <input class="i34" data-nbf="rval" data-id="${esc(id)}" data-i="${ri}" value="${esc(x.value ?? '')}" placeholder="${num ? '0' : 'on, open'}">${unit && num ? `<span style="font-size:12px;color:#979797;flex:none">${esc(unit)}</span>` : ''}</div>
            <span class="hint">${num ? 'Tallverdi – prikken vises når entiteten er over/under.' : 'Skill flere tilstander med komma – én av dem holder (||).'} Nå: <b>${esc(s ? M.fmtState(h, x.entity) + (num ? '' : ` (${s.state})`) : '–')}</b></span>
            <input class="i36" data-nbf="rtext" data-id="${esc(id)}" data-i="${ri}" value="${esc(x.text || '')}" placeholder="Tekst i varselet">
          </div>`;
        }).join('');
        const tgt = [['', 'Ingen'], ...POPS.map(([k, , l]) => ['#' + k, l]), ...M.areas(h).map((a) => ['#' + a.id, a.name]), ...M.all(h, 'person').map((p) => ['#person-' + p.split('.')[1], 'Person · ' + M.name(h, p)])];
        (M.popupOptions ? M.popupOptions(h) : []).forEach((o) => { if (!tgt.some((t) => t[0] === o[0])) tgt.push(o); }); // egne popups
        const curH = hashOf(N, id);
        if (curH && !tgt.some((t) => t[0] === curH)) tgt.push([curH, curH]);
        const acts = [...ACTS.map(([k, , l]) => [k, l]), ...M.areas(h).map((a) => ['light:' + a.id, 'Lys ' + a.name])];
        html += `<div class="ned" data-key="e_${esc(id)}">
          <div class="fl"><span class="cap">Navn</span><input class="i44" data-nbf="label" data-id="${esc(id)}" value="${esc(b.label || (isC ? '' : ''))}" placeholder="${esc(isC ? 'Navn på knappen' : base[1])}"></div>
          <div class="fl"><span class="cap">Ikon · søk i mdi og egne ikonsett</span>
            ${M.iconPicker ? M.iconPicker.html({ key: 'nbic_' + id, value: b.icon ? M.iconName(b.icon) : '', placeholder: M.iconName(base[0]), label: 'Ikon · ' + (b.label || base[1]), attrs: `data-nbicon="${esc(id)}"` })
    : `<div class="ln"><span class="icp">${M.icon(curIcon, 22)}</span><input class="i44" data-nbf="icon" data-id="${esc(id)}" value="${esc(b.icon || '')}" placeholder="${esc(base[0])}" style="flex:1"></div>`}
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
          ${M.tap ? `<div class="fl"><span class="cap">${isC ? 'Handling · og så' : 'Handling'}</span>${M.tap.html({ key: 'nbtap_' + id, value: tapOf(N, id), modes: isC ? ['popup', 'hash', 'path', 'url', 'none'] : ['popup', 'hash', 'path', 'url'], attrs: `data-nbtap="${esc(id)}"` })}</div>`
    : `<div class="fl"><span class="cap">${isC ? 'Og åpne popup' : 'Åpner popup'}</span><select class="s44" data-nbf="hash" data-id="${esc(id)}">${tgt.map(([k, l]) => `<option value="${esc(k)}" ${curH === k ? 'selected' : ''}>${esc(l)}${k ? ' · ' + esc(k) : ''}</option>`).join('')}</select></div>`}
          ${isC ? `<button class="dlb" data-a="nbdel" data-id="${esc(id)}">${M.icon('delete', 18)}Slett knappen</button>` : `<button class="rsb" data-a="nbreset" data-id="${esc(id)}">${M.icon('restart_alt', 18)}Tilbakestill til ${esc(base[1])}</button>`}
        </div>`;
        return html;
      };
      const group = (key, title) => `<span class="gt">${title}</span>${N[key].map((id, i, l) => row(key, id, i, l)).join('') || '<span class="hint" style="padding:0 6px">Ingen knapper</span>'}`;
      const style = c.style || 'white';
      const pvIcons = N.bar.filter((id) => !N.hidden.has(id)).map((id) => catOf(N, id)[0]).concat(['more_horiz']);
      // Fiks 20.6: knappene øverst · «Plassering og oppførsel» (schema-seksjonen, med Visning/Bredde/Avstand – _nbPlace) · så Stil og Mini-spiller
      if (part !== 'style') return `<style>${ED_CSS}</style><div class="nbx">
        ${group('bar', 'I navbaren')}
        ${group('more', 'Bak de tre prikkene')}
        <span class="gt">Ny knapp</span>
        <button class="add" data-a="nbadd">${M.icon('add', 22)}Legg til knapp</button>
      </div>`;
      return `<div class="nbx">
        <span class="gt">Stil</span>
        <div class="profs">${[['white', 'Standard', 'Hvit navbar'], ['glass', 'Liquid glass', 'Glass-navbar med linse']].map(([k, l, sub]) => `<button class="prof ${style === k ? 'on' : ''}" data-a="nbstyle" data-v="${k}">
          <span class="pvw ${k}">${pvIcons.slice(0, 5).map((ic) => M.icon(ic, 18)).join('')}</span>
          <span class="pft"><span class="x"><b>${l}</b><i>${sub}</i></span>${M.icon('check_circle', 24, `color:${C.pink};opacity:${style === k ? 1 : 0}`)}</span></button>`).join('')}</div>
        ${M.store ? `<button class="tg" data-a="nbtheme" data-v="${M.glassOn() ? 0 : 1}"><span class="tx2"><b>Liquid Glass-tema</b><i>Frosted glass i alle Tilpass-ark · gjelder deg på alle enheter</i></span><span class="trk ${M.glassOn() ? 'on' : ''}"><span class="knb"></span></span></button>` : ''}
        <span class="gt">Mini-spiller</span>
        ${this._mini(c)}
      </div>`;
    }
    // Fiks 20.6: siste del av kortet «Plassering og oppførsel»: Visning-bryterne → Bredde → Avstand fra bunnen (skilt med tynn linje)
    _nbPlace() {
      const c = this._config || {}, W = c.width || 'std';
      const tog = (label, name, on) => `<button class="tg" data-a="nbtog" data-k="${name}" data-v="${on ? 0 : 1}">${esc(label)}<span class="trk ${on ? 'on' : ''}"><span class="knb"></span></span></button>`;
      return `<div class="nbx nbpl" data-key="nbpl">
        <span class="gt">Visning</span>
        ${tog('Vis navn', 'show_names', !!c.show_names)}
        ${tog('Vis navn i menyen', 'menu_names', c.menu_names !== false)}
        ${tog('Krymp ved scrolling', 'shrink', c.shrink !== false)}
        <span class="gt">Bredde</span>
        <div class="wseg">${[['kompakt', 'Kompakt'], ['std', 'Standard'], ['full', 'Full']].map(([k, l]) => `<button class="${W === k ? 'on' : ''}" aria-selected="${W === k}" data-a="nbw" data-v="${k}">${l}</button>`).join('')}</div>
        ${this._nbBottom()}
      </div>`;
    }
    // Fiks 18.6 · «Avstand fra bunnen» – per enhet (MSH.navBottom, localStorage ki-nav-bottom + ki-store), ikke kortets config
    _nbBottom() {
      if (!M.navBottom) return '';
      const own = M.navBottomOwn(), def = M.navBottomDefault(), v = own == null ? def : own, dev = M.deviceInfo().model || M.deviceInfo().label;
      const rail = document.documentElement.style.getPropertyValue('--ki-nav-h') === '0px';
      return `<span class="gt nbbl">Avstand fra bunnen</span>
        <div class="nbbot" data-key="nbbot"><div class="ln"><input type="range" min="0" max="48" step="1" value="${v}" data-nbbot="1" aria-label="Avstand fra bunnen"><span class="nbbv num">${v} px</span></div>
        <div class="ln"><span class="hint" style="flex:1">${rail ? 'Navbaren står vertikalt nå – brukes når navbaren ligger i bunnen' : `Gjelder bare ${esc(dev)} · standard ${def} px`}</span>${own != null ? `<button class="rsb" data-a="nbbotstd">${M.icon('restart_alt', 18)}Standard</button>` : ''}</div></div>`;
    }
    // «Mini-spiller» (Fiks 17.26): navbar.mini – samme felt i «Tilpass navbar» og GUI-editoren (samme element)
    _mini(c) {
      const h = this._hass, m = miniCfg(c), cond = m.cond || 'playing';
      const tg = (label, key, on, sub) => `<button class="tg" data-a="nbmini" data-k="${key}" data-v="${on ? 0 : 1}">${sub ? `<span class="tx2"><b>${esc(label)}</b><i>${esc(sub)}</i></span>` : esc(label)}<span class="trk ${on ? 'on' : ''}"><span class="knb"></span></span></button>`;
      let html = tg('Vis over navbaren', 'on', m.on !== false, 'Flytende mini-spiller med play/pause og volum');
      if (m.on === false) return html;
      html += `<span class="cap" style="padding:0 6px">Vis når</span><div class="wseg">${[['playing', 'Noe spiller'], ['always', 'Alltid'], ['entity', 'Betingelse']].map(([k, l]) => `<button class="${cond === k ? 'on' : ''}" aria-selected="${cond === k}" data-a="nbmcond" data-v="${k}">${l}</button>`).join('')}</div>
        <span class="hint" style="padding:0 6px">${cond === 'playing' ? 'Når en spiller spiller, eller er pauset i inntil 10 min.' : cond === 'always' ? 'Alltid – siste spiller når ingenting spiller.' : 'Når entiteten har valgt tilstand (f.eks. input_boolean.vis_miniplayer = on).'}</span>`;
      if (cond === 'entity') {
        const s = m.entity && h.states[m.entity], hit = mStateOk(m.state, s);
        html += `<div class="ned" data-key="nbm_ent">
          <div class="r1"><div class="epk">${M.icon(m.entity ? M.domainIcon(m.entity, s) : 'toggle_on', 18, 'color:#afafaf')}<span class="v"><b>${esc(m.entity ? (s ? s.attributes.friendly_name || m.entity : m.entity) : 'Ikke valgt')}</b><i>${esc(m.entity ? m.entity + (s ? '' : ' · finnes ikke') : 'Velg entitet under')}</i></span></div>
            <span class="st ${hit ? 'amb' : ''}">${hit ? 'Slår til nå' : 'Ikke nå'}</span></div>
          ${this._search({ type: 'entity' }, 'nbmq', 'nbment', 'mini', m.entity ? 'Bytt entitet …' : 'Søk entitet …')}
          <div class="fl"><span class="cap">Tilstand · skill flere med komma</span><input class="i44" data-nbf="mstate" value="${esc(m.state || 'on')}" placeholder="on"></div>
          <span class="hint">Nå: <b>${esc(s ? s.state : '–')}</b></span>
        </div>`;
      }
      html += tg('Skjul i Media-popupen', 'hide_in_media', m.hide_in_media !== false);
      // Fiks 20.16: per bruker × enhet (nav_profiles, lagres straks som «Avstand fra bunnen»)
      html += `<button class="tg" data-a="nbmhpop" data-v="${mHidePopOn(m) ? 0 : 1}"><span class="tx2"><b>Skjul når en popup er åpen</b><i>${esc(M.deviceInfo ? 'Gjelder bare ' + (M.deviceInfo().model || M.deviceInfo().label || 'denne enheten') : 'Alle popuper, også Media')}</i></span><span class="trk ${mHidePopOn(m) ? 'on' : ''}"><span class="knb"></span></span></button>`;
      // Fiks 19.15: TV i mini-spilleren – − / + i pillen (standard) eller slider som for musikk
      const tvv = m.tv_vol === 'slider' ? 'slider' : 'steps';
      html += `<span class="cap" style="padding:0 6px">Volum for TV</span><div class="wseg">${[['steps', '− / +'], ['slider', 'Slider']].map(([k, l]) => `<button class="${tvv === k ? 'on' : ''}" aria-selected="${tvv === k}" data-a="nbmtv" data-v="${k}">${l}</button>`).join('')}</div>`;
      // Fiks 19.6: spillervalg som nedtrekksliste (MSH.entityMultiPicker) i stedet for en chip-vegg – tom = alle spillere
      if (M.entityMultiPicker) {
        html += `<span class="cap" style="padding:0 6px">Spillere</span>${M.entityMultiPicker.html({ key: 'nbm_pl', name: 'mini.players', value: Array.isArray(m.players) ? m.players : [], domains: ['media_player'], group: 'media', icon: 'mdi:speaker-multiple', emptyLabel: 'Alle spillere', emptySub: 'Mini-spilleren viser den som spiller', hint: 'Ingen valgt = alle spillere. Mini-spilleren viser den som spiller.' })}`;
      }
      return html;
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
        case 'nbhide': { const hs = new Set(N.hidden); hs.has(d.id) ? hs.delete(d.id) : hs.add(d.id); if (d.id === 'kart' && !hs.has('kart')) return this._patch({ hidden: hs.size ? [...hs] : undefined, more: N.more }); return this._set('hidden', hs.size ? [...hs] : undefined); }
        case 'nbswap': { const L = lists(), o = d.k === 'bar' ? 'more' : 'bar'; L[d.k] = L[d.k].filter((x) => x !== d.id); L[o].push(d.id); return this._patch({ [d.k]: L[d.k], [o]: L[o] }); }
        case 'nbkiosk': { // Fiks 23.5: samme som toppkortet i kiosk-arket
          const h = this._hass, ent = M.kioskEntity && M.kioskEntity();
          if (!h || !ent || !h.states[ent]) return M.toast && M.toast('Fant ikke ' + (ent || 'bryter-entiteten'));
          return M.call(h, ent.split('.')[0] === 'input_boolean' ? 'input_boolean' : 'homeassistant', 'toggle', { entity_id: ent });
        }
        case 'nbkset': { // kiosk-arket legges oppå dette arket (egen overlay i ki-overlay-root); lukkes → tilbake hit
          const ov = M.kioskSheet && M.kioskSheet({ hass: this._hass });
          if (!ov) return M.toast && M.toast('Kiosk-innstillinger er ikke tilgjengelig');
          ov.onClosed = () => this._render();
          return;
        }
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
        case 'nbmini': return this._set('mini.' + d.k, d.v === '1');
        case 'nbmcond': return this._set('mini.cond', d.v);
        case 'nbmhpop': { // Fiks 20.16: nav_profiles.mini_hide_popups på dette nivået (bruker × enhet); lik arvet verdi → fjernes
          const on = d.v === '1';
          if (!M.profileSet || !M.store) return this._set('mini.hide_in_popups', on || undefined);
          const key = M.profileKey(M.userId(), M.deviceClass()), inh = M.profileGet('nav_profiles', null, key).mini_hide_popups;
          const base = inh != null ? !!inh : !!((c.mini || {}).hide_in_popups);
          M.profileSet('nav_profiles', { mini_hide_popups: on === base ? undefined : on }, key);
          window.dispatchEvent(new CustomEvent('ki-nav-bottom'));
          return this._render();
        }
        case 'nbmtv': return this._set('mini.tv_vol', d.v === 'slider' ? 'slider' : undefined); // Fiks 19.15
        case 'nbment': this._menu = null; this._q = {}; return this._set('mini.entity', d.v);
        case 'nbmpl': {
          const all = M.mediaPlayers ? M.mediaPlayers(this._hass, {}).all.map((p) => p.id) : M.all(this._hass, 'media_player');
          const cur = Array.isArray((c.mini || {}).players) && c.mini.players.length ? c.mini.players : all;
          const next = cur.includes(d.v) ? cur.filter((x) => x !== d.v) : all.filter((x) => cur.includes(x) || x === d.v);
          if (!next.length) return undefined; // minst én spiller
          return this._set('mini.players', next.length === all.length ? undefined : next);
        }
        case 'nbbotstd': M.setNavBottom(null, true); return this._render(); // Fiks 18.6: enhetens standard igjen
        case 'nbtheme': M.setGlassTheme(d.v === '1'); return this._render(); // ki-store theme.liquid_glass – ikke kortets config
        default:
      }
      return undefined;
    }
    _change(e) {
      const t = e.target;
      if (t.dataset && t.dataset.nbbot) { M.setNavBottom(Number(t.value) === M.navBottomDefault() ? null : t.value, true); M.haptic('light'); return this._render(); } // Fiks 18.6: lagres ved slipp
      if (t.dataset && t.dataset.search && t.dataset.act === 'nbment') {
        const v = t.value.trim();
        if (/^[a-z_]+\.[a-z0-9_]+$/.test(v)) { this._q = {}; this._menu = null; this._set('mini.entity', v); }
        return;
      }
      if (t.dataset && t.dataset.nbf === 'mstate') return this._set('mini.state', t.value.trim() || undefined);
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
