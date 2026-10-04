/* KI MSH · felles fanerad: vannrett scroll + langt trykk/dra = omorganiser (mus, telefon og iPad).
 *   MSH.tabReorder(row, {
 *     items: () => [knapper],          // standard: row > button
 *     idOf: (btn) => id,               // standard: data-tab-id || data-key
 *     active: () => id,                // aktiv fane (scrolles inn); standard: .on / [aria-selected=true]
 *     onReorder(newOrderIds),          // ved slipp (kun når rekkefølgen er endret) – kortet lagrer i config
 *     onSelect(id),                    // valgfritt: «liquid glass»-valg når alle faner får plass (glass: true)
 *     holdMs: 400, isEdit: () => bool, // redigeringsmodus: dra starter uten langt trykk
 *     card,                            // kortet (settes _busy under dra så render ikke river DOM-en)
 *     glass, onGlassMove(btn, x), onGlassEnd(btn|null, commit)   // egen linse (Hjem) i stedet for standardlinsen
 *     glassTap: false                  // slå av trykk-animasjonen (MSH.glassTap, 00-base.js) – på som standard
 *     itemStop: false                  // la pointer-/touch-hendelsene boble fra fanen til raden (raden stopper dem)
 *   }) → kontroller { refresh(), scrollActive(smooth), fade() }. Kall igjen etter hver render (idempotent).
 * Raden: klassen .msh-tr (CSS i MSH.TAB_ROW_CSS – legg den i kortets styles). Knappene krymper aldri og kuttes aldri.
 * Touch: touchstart/touchmove {passive:false} direkte på knappen. Under holdet avbryter > 8 px bevegelse (vanlig
 * scroll). Når draget er i gang: touchmove → preventDefault + stopPropagation, og pointercancel ignoreres (dra
 * fortsetter via touch-hendelsene). Glass-drag slås av på containeren (dataset.glassDragOff = '1') mens man drar.
 * Fiks 20.3 (fasit Hjem v3 glassTabs, pending/scroll/drag): raden har ALLTID touch-action: pan-y (loddrett side-scroll
 * er nettleserens). Flyter raden over, blir > 6 px sideveis (mus og touch) fasen «pan»: scrollLeft = start − dx i JS,
 * slipp velger ingenting. Slipp uten bevegelse = vanlig trykk. pointercancel (loddrett scroll) velger aldri.
 * Haptic: medium (dra starter) → selection (fanen passerer en annen) → light (slipp). Ingen haptic ved scroll.
 * Fiks 28.13 (alle fanelinjer med tannhjul): hold 400 ms → løft (scale 1.06, skygge 0 8px 20px rgba(0,0,0,.4), inline –
 * virker også i rader uten .msh-tr), raden pulserer (omriss via Web Animations), de andre glir unna (FLIP 180 ms),
 * fanen holder seg innenfor raden. > 6 px før 400 ms avbryter holdet. Esc avbryter og setter rekkefølgen tilbake.
 * Fanen som holdes: touch-action none; alle faner: user-select/-webkit-touch-callout none. Tannhjul/«Tilpass»-knapper
 * (.gear, [data-act=customize], [data-tr-fixed]) er aldri med i items() og kan ikke flyttes.
 *   MSH.tabMerge(visibleKeys, fullOrder) → full rekkefølge der de synlige plassene får ny rekkefølge (skjulte står).
 * Fiks 47 E (fasit Kalender v2 `tabs` → down/up/cancel) – trykk registreres alltid, felles for ALLE fanelinjer:
 *   MSH.tabPress(row, { items?, isActive?(btn), busy?(), select?(btn) }) → kontroller (idempotent; MSH.tabReorder kobler
 *   den på selv – rader uten omorganisering kaller den direkte). Fanebytte på pointerup når bevegelse < 14 px og trykk
 *   < 450 ms; pointercancel innen 250 ms bytter likevel. click er reserve (tastatur), men ignoreres innen 400 ms etter et
 *   pekervalg (ingen dobbel haptic / dobbelt bytte). Aldri under hold-for-å-omorganisere (window.__tabReorder) eller dra.
 *   Hele knappen + sporets padding/mellomrom (nærmeste fane ≤ 10 px) er trykkflate; fanene får touch-action: pan-x og
 *   ingen tap-highlight. Haptic «light» kun ved faktisk bytte (trykk på aktiv fane = ingenting); valget skjer som et
 *   syntetisk click på knappen med data-haptic midlertidig «off», så kortets egen click-kode bytter fanen.
 */
(function () {
  const M = window.MSH;
  if (!M || M.tabReorder) return;

  M.TAB_ROW_CSS = `
    .msh-tr{display:flex;gap:4px;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x proximity;scrollbar-width:none;white-space:nowrap;touch-action:pan-y;overscroll-behavior-x:contain;min-width:0;max-width:100%;
      -webkit-mask-image:linear-gradient(to right,transparent 0,#000 var(--tr-fl,0px),#000 calc(100% - var(--tr-fr,0px)),transparent 100%);mask-image:linear-gradient(to right,transparent 0,#000 var(--tr-fl,0px),#000 calc(100% - var(--tr-fr,0px)),transparent 100%)}
    .msh-tr::-webkit-scrollbar{display:none}
    .msh-tr.tr-fitglass{touch-action:pan-y}
    .msh-tr>button{flex:0 0 auto;min-width:max-content;scroll-snap-align:start;white-space:nowrap;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent}
    .msh-tr.tr-drag,.msh-tr.tr-pan{scroll-snap-type:none}
    .msh-tr.tr-drag>button{transition:transform .2s cubic-bezier(.2,.8,.2,1)}
    .msh-tr.tr-drag>button.tr-lift{transition:none;position:relative;z-index:5;box-shadow:0 8px 20px rgb(0 0 0/max(var(--ki-ka-min,0),calc(.4*var(--ki-ka-k,1))))}
    .msh-tr.tr-drag>button.tr-lift:not(.on){background:var(--ki-surface-2, var(--gray300,#404040)) !important;color:var(--ki-text, var(--white,#fafafa)) !important}
    .msh-tr.tr-settle>button{transition:none !important}
  `;

  // Glass-drag (10-navbar.js: M.glassDrag) respekterer dataset.glassDragOff = '1' på containeren.
  (function () {
    const wrap = (fn) => {
      if (typeof fn !== 'function' || fn.__trWrap) return fn;
      const w = function (c, opt) {
        opt = opt || {};
        const en = opt.enabled;
        return fn.call(this, c, { ...opt, enabled: () => !(c && c.dataset && c.dataset.glassDragOff === '1') && (!en || en()) });
      };
      w.__trWrap = true;
      return w;
    };
    let inner = wrap(M.glassDrag);
    try { Object.defineProperty(M, 'glassDrag', { configurable: true, enumerable: true, get: () => inner, set: (fn) => { inner = wrap(fn); } }); } catch (e) { /* */ }
  })();

  // Liquid Glass-FLATEN på fanerader/segmenter (Fiks 15.2): bare med Liquid Glass-temaet (MSH.glassOn()). Drag-/linse-
  // effekten (MSH.glassDrag, MSH.glassTap/glassMorph, tabReorder glass) er ALLTID på – uavhengig av temaet.
  // Animasjonen kan likevel slås av for hele dashbordet (MSH.animOff, «Tilpass Hjem» → Faner, Fiks 17.18).
  // Temaet speiles som arvede CSS-variabler på <html> (arver inn i alle shadow roots, byttes live uten ny render):
  //   --ki-tr-bg / --ki-tr-blur / --ki-tr-sh  (udefinert uten temaet → kortets standardflate)
  // Bruk: `.tbox{${MSH.tabSurface('transparent', 'inset 0 0 0 1px rgba(255,255,255,0.12)')}}` → standardflaten uten tema,
  // glass (rgba(255,255,255,.06) + blur(22px) saturate(190%) + glasskant) med tema.
  M.TAB_GLASS_VARS = {
    '--ki-tr-bg': 'linear-gradient(180deg,rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.08*var(--ki-wa-k,1)),var(--ki-wa-max,1))),rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0*var(--ki-wa-k,1)),var(--ki-wa-max,1))) 45%),rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.06*var(--ki-wa-k,1)),var(--ki-wa-max,1)))',
    '--ki-tr-blur': 'blur(22px) saturate(190%)',
    '--ki-tr-sh': 'inset 0 0 0 0.5px rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.14*var(--ki-wa-k,1)),var(--ki-wa-max,1))),inset 0 1px 0 rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.22*var(--ki-wa-k,1)),var(--ki-wa-max,1)))',
  };
  M.tabSurface = (bg, sh) => `background:var(--ki-tr-bg,${bg || 'transparent'});-webkit-backdrop-filter:var(--ki-tr-blur,none);backdrop-filter:var(--ki-tr-blur,none);box-shadow:var(--ki-tr-sh,${sh || 'none'});`;
  M.tabGlassSync = function () {
    const s = document.documentElement && document.documentElement.style;
    if (!s) return;
    let on = false;
    try { on = !!(M.glassOn && M.glassOn()); } catch (e) { /* */ }
    Object.entries(M.TAB_GLASS_VARS).forEach(([k, v]) => { if (on) s.setProperty(k, v); else s.removeProperty(k); });
  };
  window.addEventListener('ki-glass-change', M.tabGlassSync);
  M.tabGlassSync();
  // ki-store lastes asynkront (theme.liquid_glass) – følg endringer også uten åpne ark
  (function sub(n) {
    if (M.store && M.store.subscribe) { M.store.subscribe((d, p) => { if (!p || /^(theme|cards\.ki-navbar)(\.|$)/.test(p)) { M.tabGlassSync(); if (M.glassNotify) M.glassNotify(); } }); M.tabGlassSync(); return; }
    if (n < 40) setTimeout(() => sub(n + 1), 250);
  })(0);

  const SLOP = 6; // Fiks 28.13: > 6 px før 400 ms avbryter holdet
  const FIXED = '.gear,[data-act="customize"],[data-tr-fixed]';
  // Ny full rekkefølge: synlige plasser i fullOrder fylles med keys (ny rekkefølge), skjulte/andre står der de var.
  M.tabMerge = function (keys, full) {
    keys = (keys || []).slice();
    const K = new Set(keys), out = [];
    (full || []).forEach((k) => { if (K.has(k)) { const n = keys.shift(); if (n != null) out.push(n); } else out.push(k); });
    keys.forEach((k) => { if (!out.includes(k)) out.push(k); });
    return out;
  };
  let lastHap = 0;
  const hap = (type) => { lastHap = Date.now(); M.haptic(type); };
  // M.haptic slipper maks én per 40 ms – slipp-haptic skal ikke forsvinne rett etter en «selection».
  const hapLater = (type) => { const w = 45 - (Date.now() - lastHap); if (w > 0) setTimeout(() => hap(type), w); else hap(type); };
  // Alle containere som kan ha glass-drag: raden, kortet og forfedre (også gjennom shadow roots).
  const glassHosts = (row, card) => {
    const out = [row];
    if (card) out.push(card);
    let n = row.parentNode || row.host, d = 0;
    while (n && d++ < 60) {
      if (n.nodeType === 1 && (n.__gd || (n.hasAttribute && n.hasAttribute('data-glass-drag')))) out.push(n);
      n = n.parentNode || n.host;
    }
    return out;
  };
  /* ---------------- Fiks 47 E · trykk (pointerup/pointercancel) */
  const P_MOVE = 14, P_MS = 450, P_CANCEL = 250, P_EAT = 400, P_NEAR = 10;
  const ownTabs = (row) => Array.from(row.children).filter((b) => (b.tagName === 'BUTTON' || b.getAttribute('role') === 'tab') && !(b.matches && b.matches(FIXED)));
  class TabPress {
    constructor(row, o) {
      this.row = row; this.o = o || {}; this.p = null; this.at = 0; this.synth = false;
      const cap = { capture: true };
      row.addEventListener('pointerdown', (e) => this._down(e), cap);
      row.addEventListener('pointerup', (e) => this._up(e), cap);
      row.addEventListener('pointercancel', (e) => this._cancel(e), cap);
      row.addEventListener('click', (e) => {
        if (this.synth || Date.now() - this.at >= P_EAT) return;
        if (!this._btn(e, true)) return;
        e.stopImmediatePropagation(); e.preventDefault(); // pekeren har allerede valgt fanen
      }, cap);
    }
    items() { return (this.o.items ? Array.from(this.o.items() || []) : ownTabs(this.row)).filter((b) => b && b.isConnected && !(b.matches && b.matches(FIXED))); }
    style() {
      this.items().forEach((b) => {
        if (!b.style.touchAction) b.style.touchAction = 'pan-x';
        if (!b.style.webkitTapHighlightColor) b.style.webkitTapHighlightColor = 'transparent';
      });
    }
    // Knappen trykket traff: selve fanen, ellers (sporets padding/mellomrom) nærmeste fane innen 10 px. Tannhjul o.l. = ingen.
    _btn(e, exact) {
      const path = e.composedPath ? e.composedPath() : [e.target], its = this.items();
      for (const n of path) {
        if (n === this.row) break;
        if (its.includes(n)) return n;
        if (n && n.matches && n.matches(FIXED)) return null;
      }
      if (exact || !path.includes(this.row)) return null;
      let best = null, bd = P_NEAR + 0.01;
      its.forEach((b) => { const r = b.getBoundingClientRect(), d = e.clientX < r.left ? r.left - e.clientX : e.clientX > r.right ? e.clientX - r.right : 0; if (d < bd && e.clientY >= r.top - 12 && e.clientY <= r.bottom + 12) { bd = d; best = b; } });
      return best;
    }
    busy() { return !!window.__tabReorder || !!(this.o.busy && this.o.busy()); }
    _down(e) {
      if (e.button || e.isPrimary === false) { this.p = null; return; }
      const b = this._btn(e);
      this.p = b && !b.disabled ? { b, pid: e.pointerId, x: e.clientX, y: e.clientY, t: Date.now() } : null;
    }
    _up(e) {
      const p = this.p;
      if (!p || p.pid !== e.pointerId) return;
      this.p = null;
      if (this.busy()) return;
      if (Math.hypot(e.clientX - p.x, e.clientY - p.y) < P_MOVE && Date.now() - p.t < P_MS) this.pick(p.b);
    }
    _cancel(e) {
      const p = this.p;
      if (!p || p.pid !== e.pointerId) return;
      this.p = null;
      if (Date.now() - p.t < P_CANCEL && !this.busy()) this.pick(p.b); // scroll/glass/swipe-to-close tok pekeren – bytt likevel
    }
    active(b) {
      if (this.o.isActive) return !!this.o.isActive(b);
      return b.classList.contains('on') || b.getAttribute('aria-selected') === 'true' || (b.hasAttribute('data-active') && b.getAttribute('data-active') !== 'false');
    }
    pick(b) {
      this.at = Date.now();
      if (!b || !b.isConnected || b.disabled || this.active(b)) return false;
      M.haptic('light');
      if (this.o.select) { this.o.select(b); return true; }
      const h = b.getAttribute('data-haptic');
      b.setAttribute('data-haptic', 'off');
      this.synth = true;
      try { b.click(); } finally {
        this.synth = false;
        if (h == null) b.removeAttribute('data-haptic'); else b.setAttribute('data-haptic', h);
      }
      if (M.glassDragEnd) M.glassDragEnd(); // trykk-animasjonen (MSH.glassTap) er vist – ikke én gang til på pekerens eget click
      return true;
    }
  }
  M.tabPress = function (row, o) {
    if (!row) return null;
    let P = row.__tabPress;
    if (P) { if (o) P.o = { ...P.o, ...o }; } else P = row.__tabPress = new TabPress(row, o);
    P.style();
    return P;
  };

  class TabReorder {
    constructor(row, opts) {
      this.row = row;
      this.opts = opts;
      this.st = null;
      this.eatUntil = 0;
      this._bindRow();
      // Fiks 47 E: trykk = pointerup/-cancel (felles M.tabPress); ikke under dra/glass-dra (de velger selv)
      this.press = M.tabPress(row, {
        items: () => this.items(),
        isActive: (b) => { const a = this.activeBtn(); return a ? a === b : b.classList.contains('on') || b.getAttribute('aria-selected') === 'true'; },
        busy: () => !!(this.st && (this.st.phase === 'drag' || this.st.phase === 'glass')),
      });
    }
    get o() { return { holdMs: 400, styleRow: true, ...this.opts }; }
    items() { const f = this.o.items; return (f ? Array.from(f() || []) : Array.from(this.row.children).filter((b) => b.tagName === 'BUTTON')).filter((b) => b && b.isConnected && !(b.matches && b.matches(FIXED))); }
    idOf(b) { return this.o.idOf ? this.o.idOf(b) : (b.dataset.tabId || b.dataset.key); }
    overflow() { return this.row.scrollWidth > this.row.clientWidth + 1; }
    canReorder() { return !!this.o.onReorder && this.items().length > 1; }

    /* ---------------- oppsett */
    _bindRow() {
      const row = this.row, stop = (e) => e.stopPropagation();
      // Bubble Card (swipe-to-close), karusell og dashbord skal ikke få gestene
      row.addEventListener('pointerdown', stop);
      row.addEventListener('touchstart', stop, { passive: true });
      row.addEventListener('touchmove', stop, { passive: true });
      row.addEventListener('contextmenu', (e) => e.preventDefault());
      // Raden (eller kortets egen fane-kode) har tatt pekeren (setPointerCapture): følg den herfra også
      const foreign = (e) => { const st = this.st; return st && e.pointerId === st.pid && !(st.b === e.target || st.b.contains(e.target)) ? st : null; };
      row.addEventListener('pointermove', (e) => { if (foreign(e)) this._move(e.clientX, e.clientY, e, false); });
      row.addEventListener('pointerup', (e) => { if (foreign(e)) this._end(true, e.clientX); });
      row.addEventListener('pointercancel', (e) => { const st = foreign(e); if (st && !st.touchLock) { if (st.phase === 'hold') this._abortHold(); else this._end(false); } });
      // Ingen click / fanebytte etter et drag
      row.addEventListener('click', (e) => { if (this.press && this.press.synth) return; if (Date.now() < this.eatUntil || this.eatClick) { this.eatUntil = 0; this.eatClick = false; e.stopPropagation(); e.preventDefault(); } }, true);
      row.addEventListener('scroll', () => {
        this.fade();
        const st = this.st;
        if (st && st.phase === 'hold' && st.type !== 'mouse') this._abortHold(); // native scroll → ikke langt trykk
      }, { passive: true });
      // Fiks 16.10: sporet endrer størrelse/plass under et glass-dra (innhold med annen høyde) → mål på nytt, ikke gamle rects
      if (window.ResizeObserver) { this._ro = new ResizeObserver(() => { this.fade(); const st = this.st; if (st && st.phase === 'glass' && st.x != null) this._glassMove(st.x); }); this._ro.observe(row); }
    }
    _bindBtn(b) {
      if (b.__trB === this) return;
      b.__trB = this;
      b.addEventListener('contextmenu', (e) => e.preventDefault());
      // Ingen tekstmarkering / iOS-meny ved langt trykk (også i rader uten .msh-tr-CSS)
      b.style.userSelect = 'none'; b.style.webkitUserSelect = 'none'; b.style.webkitTouchCallout = 'none';
      b.addEventListener('pointerdown', (e) => this._down(e, b));
      b.addEventListener('pointermove', (e) => { const st = this.st; if (st && st.b === b && e.pointerId === st.pid) this._move(e.clientX, e.clientY, e, false); });
      b.addEventListener('pointerup', (e) => { const st = this.st; if (st && st.b === b && e.pointerId === st.pid) this._end(true, e.clientX); });
      b.addEventListener('pointercancel', (e) => {
        const st = this.st;
        if (!st || st.b !== b || e.pointerId !== st.pid) return;
        if ((st.phase === 'drag' || st.phase === 'glass' || st.phase === 'pan') && st.touchLock) return; // touch-lytteren har stoppet scrollen – dra videre
        if (st.phase === 'hold') this._abortHold(); else this._end(false);
      });
      b.addEventListener('touchstart', (e) => {
        if (this.o.itemStop !== false) e.stopPropagation();
        const t = e.changedTouches[0];
        if (!t) return;
        if (!this.st || this.st.b !== b) this._begin(b, t.clientX, t.clientY, null, 'touch');
        if (this.st) this.st.tid = t.identifier;
      }, { passive: false });
      b.addEventListener('touchmove', (e) => {
        if (this.o.itemStop !== false) e.stopPropagation();
        const st = this.st;
        if (!st || st.b !== b) return;
        const t = [...e.touches].find((x) => st.tid == null || x.identifier === st.tid) || e.touches[0];
        if (!t) return;
        if (st.phase === 'drag' || st.phase === 'glass' || st.phase === 'pan') { if (e.cancelable) e.preventDefault(); st.touchLock = true; }
        this._move(t.clientX, t.clientY, e, true);
      }, { passive: false });
      b.addEventListener('touchend', (e) => { const st = this.st; if (st && st.b === b && (st.phase === 'drag' || st.phase === 'glass' || st.phase === 'pan')) { const t = e.changedTouches[0]; this._end(true, t ? t.clientX : st.x); } });
      b.addEventListener('touchcancel', () => { const st = this.st; if (st && st.b === b && st.phase !== 'hold') this._end(false); });
    }
    refresh() {
      const row = this.row;
      if (this.o.styleRow !== false && !row.classList.contains('msh-tr')) row.classList.add('msh-tr');
      if (this.st && this.st.phase === 'drag') return;
      this.items().forEach((b) => this._bindBtn(b));
      if (this.press) this.press.style();
      this.fade();
      this.scrollActive();
    }
    // Myk fade (12 px) på kanten som har mer innhold; touch-action etter om raden scroller.
    fade() {
      const row = this.row, max = row.scrollWidth - row.clientWidth, sl = row.scrollLeft, ovf = max > 1;
      const set = (k, v) => { if (row.style.getPropertyValue(k) !== v) row.style.setProperty(k, v); };
      set('--tr-fl', ovf && sl > 1 ? '12px' : '0px');
      set('--tr-fr', ovf && sl < max - 1 ? '12px' : '0px');
      row.classList.toggle('tr-fitglass', !ovf && !!this.o.glass);
    }
    activeBtn() {
      const a = this.o.active ? this.o.active() : null, its = this.items();
      if (a != null) return its.find((b) => this.idOf(b) === a) || null;
      return its.find((b) => b.classList.contains('on') || b.getAttribute('aria-selected') === 'true' || b.hasAttribute('data-active')) || null;
    }
    // Aktiv fane inn i synlig område (row.scrollTo smooth; første gang uten animasjon).
    scrollActive(force) {
      const row = this.row, b = this.activeBtn();
      if (!b) return;
      const id = this.idOf(b);
      if (!force && this._shown === id) return;
      const init = this._shown == null;
      this._shown = id;
      const cw = row.clientWidth, sl = row.scrollLeft, l = b.getBoundingClientRect().left - row.getBoundingClientRect().left + sl, r = l + b.offsetWidth, m = 24;
      if (!cw || row.scrollWidth <= cw + 1 || !/(auto|scroll)/.test(getComputedStyle(row).overflowX)) return; // overflow: hidden (f.eks. ikonfaner under bredde-animasjon) scrolles ikke
      let left = null;
      if (l - m < sl) left = Math.max(0, l - m);
      else if (r + m > sl + cw) left = Math.min(row.scrollWidth - cw, r + m - cw);
      if (left != null) row.scrollTo({ left, behavior: init ? 'auto' : 'smooth' });
    }

    /* ---------------- gest */
    _begin(b, x, y, pid, type) {
      if (this.st && this.st.phase !== 'hold') return;
      this._clearHold();
      this.eatClick = false;
      const st = (this.st = { b, pid, type, x0: x, y0: y, x, y, sl0: this.row.scrollLeft, phase: 'hold', edit: !!(this.o.isEdit && this.o.isEdit()), off: !!(M.animOff && M.animOff()) }); // off: Liquid Glass-animasjon av (Fiks 17.18)
      if (this.canReorder()) st.timer = setTimeout(() => { if (this.st === st && st.phase === 'hold') this._startDrag(); }, this.o.holdMs);
    }
    _down(e, b) {
      if (e.button) return;
      if (this.o.itemStop !== false) e.stopPropagation(); // itemStop: false → kortets egen rad-kode får hendelsen (raden stopper den)
      if (this.st && this.st.b === b && this.st.phase === 'hold' && this.st.pid == null) this.st.pid = e.pointerId; // touchstart kom først
      else this._begin(b, e.clientX, e.clientY, e.pointerId, e.pointerType);
      if (this.st) { this.st.pid = e.pointerId; this.st.type = e.pointerType || this.st.type; }
      try { b.setPointerCapture(e.pointerId); } catch (x) { /* */ }
    }
    _clearHold() { if (this.st && this.st.timer) { clearTimeout(this.st.timer); this.st.timer = null; } }
    _abortHold() { this._clearHold(); this.st = null; }
    _move(x, y, e, touch) {
      const st = this.st;
      if (!st) return;
      st.x = x; st.y = y;
      const dx = x - st.x0, dy = y - st.y0;
      if (st.phase === 'hold') {
        const ovf = this.overflow();
        if (Math.hypot(dx, dy) <= SLOP) return;
        this._clearHold();
        const horiz = Math.abs(dx) >= Math.abs(dy);
        if (st.edit && horiz && this.canReorder()) this._startDrag();
        else if (horiz && this.o.glass && this.o.onSelect && !ovf && this.items().length > 1) this._startGlass();
        else if (horiz && ovf) { st.phase = 'pan'; this.row.classList.add('tr-pan'); if (st.pid != null) { try { st.b.setPointerCapture(st.pid); } catch (x) { /* */ } } }
        else { this.st = null; return; } // vanlig scroll (touch: native)
        if (touch && e.cancelable) { e.preventDefault(); st.touchLock = true; }
      }
      if (st.phase === 'hold') return;
      if (!touch && e.cancelable) e.preventDefault();
      if (st.phase === 'pan') { this.row.scrollLeft = st.sl0 - dx; return; }
      if (st.phase === 'glass') { this._glassMove(x, y); return; }
      if (st.phase === 'drag') this._layout(st);
    }

    // Kortet tegnes ikke på nytt under et dra: _busy stopper vanlige render, og kortets update() (som ellers tvinger en
    // render, f.eks. når data lastes) utsettes til slipp – ellers river morph løftet/klassene midt i draget.
    _hold(on) {
      const c = this.o.card;
      if (!c) return;
      if (on) {
        c._busy = true;
        if (!Object.prototype.hasOwnProperty.call(c, 'update')) { c.update = function () { this.__trUpd = true; }; c.__trOwn = true; }
        return;
      }
      c._busy = false;
      if (c.__trOwn) { delete c.update; delete c.__trOwn; }
      if (c.__trUpd) { c.__trUpd = false; if (c.update) c.update(); }
    }

    /* ---------------- omorganisering */
    _glassOff(on) {
      const st = this.st;
      if (on) {
        st.gh = glassHosts(this.row, this.o.card).filter((n) => n.dataset && n.dataset.glassDragOff !== '1');
        st.gh.forEach((n) => { n.dataset.glassDragOff = '1'; });
      } else if (st && st.gh) st.gh.forEach((n) => { delete n.dataset.glassDragOff; });
    }
    _startDrag() {
      const st = this.st, row = this.row, its = this.items();
      const from = its.indexOf(st.b);
      if (from < 0 || its.length < 2) { this.st = null; return; }
      this._clearHold();
      st.phase = 'drag';
      const rr = row.getBoundingClientRect();
      st.its = its;
      st.ids = its.map((b) => this.idOf(b));
      st.rects = its.map((b) => { const r = b.getBoundingClientRect(); return { l: r.left - rr.left + row.scrollLeft, w: r.width }; });
      const cs = getComputedStyle(row);
      st.gap = parseFloat(cs.columnGap) || parseFloat(cs.gap) || (its[1] ? Math.max(0, st.rects[1].l - st.rects[0].l - st.rects[0].w) : 0);
      st.from = from; st.to = from;
      st.sl0 = row.scrollLeft; st.x0 = st.x;
      this._hold(true);
      window.__tabReorder = true;
      this._glassOff(true);
      row.classList.add('tr-drag');
      st.b.classList.add('tr-lift');
      this._lift(st, true);
      if (st.pid != null) { try { st.b.setPointerCapture(st.pid); } catch (x) { /* */ } }
      hap('medium');
      const tick = () => {
        if (this.st !== st || st.phase !== 'drag') return;
        const r = row.getBoundingClientRect(), E = 28;
        let v = 0;
        if (st.x < r.left + E) v = -Math.ceil((r.left + E - st.x) / 4);
        else if (st.x > r.right - E) v = Math.ceil((st.x - (r.right - E)) / 4);
        if (v) { const before = row.scrollLeft; row.scrollLeft = before + v; if (row.scrollLeft !== before) this._layout(st); }
        st.raf = requestAnimationFrame(tick);
      };
      st.raf = requestAnimationFrame(tick);
    }
    // Løft/slipp (inline, så det virker i alle rader): fanen scale(1.06) + skygge, de andre FLIP 180 ms, raden pulserer,
    // Esc avbryter. on = false: gjenoppretter alt; changed = true → ingen glid (nodene er allerede flyttet).
    _lift(st, on, changed) {
      const row = this.row, b = st.b, E = 'transform 180ms cubic-bezier(.2,.8,.2,1)';
      if (on) {
        st.tr0 = new Map();
        st.its.forEach((x) => { st.tr0.set(x, x.style.transition); if (x !== b) x.style.transition = E; });
        const cs = getComputedStyle(b), S = b.style;
        st.l0 = { boxShadow: S.boxShadow, position: S.position, zIndex: S.zIndex, touchAction: S.touchAction, background: S.background };
        S.transition = 'none'; S.transform = 'scale(1.06)'; S.boxShadow = '0 8px 20px ' + (M.theme ? M.theme.blackA(0.4, M.theme.mode()) : 'rgb(0 0 0 / .4)'); // konkret (regel 3) – løftet varer bare under draget
        if (cs.position === 'static') S.position = 'relative';
        S.zIndex = '5'; S.touchAction = 'none';
        if (/^(transparent|rgba\(0, 0, 0, 0\))$/.test(cs.backgroundColor) && !b.classList.contains('on')) S.background = 'var(--ki-surface-2, var(--gray300,#404040))';
        st.oo0 = row.style.outlineOffset;
        row.style.outlineOffset = '-1.5px';
        const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (row.animate) {
          const a = 'rgba(242,133,201,0.18)', z = 'rgba(242,133,201,0.62)';
          st.pulse = reduce ? row.animate([{ outline: `1.5px solid ${z}` }, { outline: `1.5px solid ${z}` }], { duration: 1000, iterations: Infinity })
            : row.animate([{ outline: `1.5px solid ${a}` }, { outline: `1.5px solid ${z}` }], { duration: 700, direction: 'alternate', iterations: Infinity, easing: 'ease-in-out' });
        }
        st.esc = (e) => {
          if (e.key !== 'Escape' || this.st !== st) return;
          e.stopPropagation(); e.preventDefault();
          this.eatClick = true; // musa er fortsatt nede – slippet skal ikke bytte fane
          this._end(false);
        };
        window.addEventListener('keydown', st.esc, true);
        return;
      }
      if (st.esc) window.removeEventListener('keydown', st.esc, true);
      if (st.pulse) { try { st.pulse.cancel(); } catch (x) { /* */ } }
      row.style.outlineOffset = st.oo0 || '';
      Object.assign(b.style, st.l0 || {});
      if (changed) st.its.forEach((x) => { x.style.transition = 'none'; });
      else {
        b.style.transition = E;
        setTimeout(() => { st.its.forEach((x) => { if (x.isConnected) x.style.transition = st.tr0.get(x) || ''; }); }, 200);
      }
    }
    _layout(st) {
      const row = this.row;
      const dx = st.x - st.x0 + (row.scrollLeft - st.sl0);
      const R = st.rects, f = st.from, wf = R[f].w + st.gap;
      const minDx = -R[f].l, maxDx = R[R.length - 1].l + R[R.length - 1].w - (R[f].l + R[f].w);
      const cdx = Math.max(minDx, Math.min(maxDx, dx)); // holder seg innenfor raden
      st.b.style.transform = `translateX(${cdx}px) scale(1.06)`;
      const c = R[f].l + R[f].w / 2 + Math.max(minDx - R[f].w, Math.min(maxDx + R[f].w, dx)); // målplass fra fingeren (ulike bredder)
      let to = 0;
      R.forEach((r, i) => { if (i !== f && r.l + r.w / 2 < c) to++; });
      if (to === st.to) return;
      st.to = to;
      hap('selection');
      st.its.forEach((b, i) => {
        if (i === f) return;
        const s = i > f && i <= to ? -wf : i < f && i >= to ? wf : 0;
        b.style.transform = s ? `translateX(${s}px)` : '';
      });
    }
    _end(commit, x) {
      const st = this.st;
      if (!st) return;
      this.st = null;
      this._clearHold();
      if (st.phase === 'hold') return; // vanlig trykk → M.tabPress har byttet fanen på pointerup (click = reserve)
      this.eatUntil = Date.now() + 350;
      if (M.glassDragEnd) M.glassDragEnd(); // ingen trykk-animasjon etter dra/glass-dra
      if (st.phase === 'pan') { this.row.classList.remove('tr-pan'); return; }
      if (st.phase === 'glass') return this._glassEnd(st, commit);
      // drag
      cancelAnimationFrame(st.raf);
      if (x != null && commit) { st.x = x; this._layout(st); }
      const row = this.row, ids = st.ids.slice(), [m] = ids.splice(st.from, 1);
      ids.splice(st.to, 0, m);
      const changed = commit && ids.join('\u0001') !== st.ids.join('\u0001');
      // Legg nodene i ny rekkefølge straks (morph finner dem via data-key) → ingen blink før re-render
      row.classList.add('tr-settle');
      if (changed) {
        const order = st.its.slice(), [bm] = order.splice(st.from, 1);
        order.splice(st.to, 0, bm);
        const anchor = st.its[st.its.length - 1].nextSibling;
        order.forEach((b) => row.insertBefore(b, anchor));
      }
      if (!changed) row.classList.remove('tr-settle'); // avbrutt/uendret: fanene glir tilbake (180 ms)
      this._lift(st, false, changed);
      st.its.forEach((b) => { b.style.transform = ''; b.classList.remove('tr-lift'); });
      row.classList.remove('tr-drag');
      void row.offsetWidth;
      requestAnimationFrame(() => { row.classList.remove('tr-settle'); if (changed) st.its.forEach((b) => { b.style.transition = st.tr0.get(b) || ''; }); });
      this._glassOff(false);
      window.__tabReorder = false;
      this._hold(false);
      if (commit) hapLater('light');
      if (changed && this.o.onReorder) this.o.onReorder(ids);
      else if (this.o.card && this.o.card.update) this.o.card.update();
    }

    /* ---------------- liquid glass-valg (når alle faner får plass) */
    _startGlass() {
      const st = this.st;
      st.phase = 'glass';
      this._hold(true);
      this._glassOff(true);
      // Fiks 17.19: linsen ER den rosa pillen (MSH.glassLens) – aktiv pille skjules, linsen følger fingeren 1:1.
      // Liquid Glass-animasjon av (MSH.animOff, Fiks 17.18) → ingen linse; slipp velger fanen direkte.
      if (!this.o.onGlassMove && !st.off && M.glassLens) {
        const act = this.activeBtn();
        st.lens = M.glassLens(this.row, { from: act, active: () => this.activeBtn() });
        if (act) { const r = act.getBoundingClientRect(); st.lens.place(r.left, r.top, r.width, r.height); st.lens.hide(act); }
        if (M.lensFollow) st.lens.fw = M.lensFollow(st.lens.l, this.row); // linsen følger raden hver frame (Fiks 16.10)
      }
      if (st.pid != null) { try { st.b.setPointerCapture(st.pid); } catch (x) { /* */ } }
    }
    _nearest(x) {
      let best = null, bd = Infinity;
      this.items().forEach((b) => { const r = b.getBoundingClientRect(), d = x < r.left ? r.left - x : x > r.right ? x - r.right : 0; if (d < bd) { bd = d; best = b; } });
      return best;
    }
    _glassMove(x) {
      const st = this.st, hit = this._nearest(x);
      if (!hit) return;
      if (hit !== st.hit) { st.hit = hit; hap('selection'); }
      if (st.off) return; // Liquid Glass-animasjon av: ingen linse/indikator under draget
      if (this.o.onGlassMove) return this.o.onGlassMove(hit, x);
      if (!st.lens) return;
      const r = hit.getBoundingClientRect(), cr = this.row.getBoundingClientRect();
      const L = Math.max(cr.left + 2, Math.min(cr.right - r.width - 2, x - r.width / 2));
      st.lens.place(L, r.top, r.width, r.height);
    }
    _glassEnd(st, commit) {
      const hit = commit ? st.hit : null;
      // Slipp: linsen settes på valgt knapp (ferske mål), fanen velges, ekte pille vises etter to frames og linsen tones ut
      const r = st.lens && hit && hit.isConnected ? hit.getBoundingClientRect() : null;
      if (r) st.lens.place(r.left, r.top, r.width, r.height);
      this._glassOff(false);
      this._hold(false);
      if (this.o.onGlassEnd) this.o.onGlassEnd(hit, commit);
      if (hit) { hapLater('light'); this.o.onSelect(this.idOf(hit)); } else if (this.o.card && this.o.card.update) this.o.card.update();
      if (st.lens) {
        // Valgt fane kan endre mål når den blir aktiv (ikonfaner: ikon → ikon + navn) – vent til fanebyttet er tegnet
        // (maks 3 frames), og la linsen gli til fanens endelige mål før den tones ut (ellers ender boblen på det gamle målet).
        const L = st.lens, want = hit ? this.idOf(hit) : null;
        let n = 0;
        const go = () => {
          if (L.dead || L.fin) return;
          const a = this.activeBtn();
          if (want != null && (!a || this.idOf(a) !== want) && n++ < 3) { requestAnimationFrame(go); return; }
          if (L.glideTo) L.glideTo(a); else L.finish();
        };
        if (hit) { requestAnimationFrame(go); L.timers.push(setTimeout(() => L.finish(), 500)); } else L.finish(); // reserve: rAF kommer aldri
      }
    }
  }

  /* Fiks 28.13: standardkobling for en fanelinje med tannhjul (knappene er direkte barn av row, data-v = fane-id,
   * trykk = kortets egen click-handler). Liquid Glass-valg ved sideveis dra når alt får plass (erstatter M.glassDrag på raden).
   *   MSH.tabRow(card, row, { active: () => id, order: () => [alle id-er i lagret rekkefølge, også skjulte],
   *     field: 'tab_order' | save(fullOrder, visibleKeys), idOf?, items?, onSelect?, glass? }) */
  M.tabRow = function (card, row, o) {
    if (!row || !o) return null;
    const idOf = o.idOf || ((b) => b.dataset.v);
    const its = () => (o.items ? Array.from(o.items() || []) : Array.from(row.children).filter((b) => b.tagName === 'BUTTON' && !b.matches(FIXED)));
    const T = M.tabReorder(row, {
      card, glass: o.glass !== false, styleRow: false, items: its, idOf, active: o.active,
      onSelect: o.onSelect || ((k) => {
        if (o.active && k === o.active()) return;
        const b = its().find((x) => idOf(x) === k);
        if (b) { T.eatUntil = 0; b.click(); T.eatUntil = Date.now() + 350; } // pekerens eget click på startfanen spises fortsatt
      }),
      onReorder: (keys) => {
        const full = M.tabMerge(keys, o.order ? o.order() : keys);
        if (o.save) return o.save(full, keys);
        const patch = { [o.field || 'tab_order']: full };
        if (M.mshPatchConfig) return M.mshPatchConfig(card, patch);
        const old = card._rawConfig || card._config || {}, next = { ...old, ...patch };
        card.setConfig(next);
        return M.saveCardConfig && M.saveCardConfig(card.hass, old, next, { card });
      },
    });
    return T;
  };

  M.tabReorder = function (row, opts) {
    if (!row) return null;
    let T = row.__tabReorder;
    if (T) { T.opts = { ...T.opts, ...(opts || {}) }; T.refresh(); return T; }
    T = row.__tabReorder = new TabReorder(row, opts || {});
    // Liquid glass ved trykk (Fiks 4 · 3): alle fanerader får MSH.glassTap (glassTap: false = av)
    if (M.glassTap) M.glassTap(row, { axis: 'x', items: () => T.items(), enabled: () => T.o.glassTap !== false && !window.__tabReorder });
    T.refresh();
    return T;
  };
})();
