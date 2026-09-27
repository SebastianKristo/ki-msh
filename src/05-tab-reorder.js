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
 *   }) → kontroller { refresh(), scrollActive(smooth), fade() }. Kall igjen etter hver render (idempotent).
 * Raden: klassen .msh-tr (CSS i MSH.TAB_ROW_CSS – legg den i kortets styles). Knappene krymper aldri og kuttes aldri.
 * Touch: touchstart/touchmove {passive:false} direkte på knappen. Under holdet avbryter > 8 px bevegelse (vanlig
 * scroll). Når draget er i gang: touchmove → preventDefault + stopPropagation, og pointercancel ignoreres (dra
 * fortsetter via touch-hendelsene). Glass-drag slås av på containeren (dataset.glassDragOff = '1') mens man drar.
 * Haptic: medium (dra starter) → selection (fanen passerer en annen) → light (slipp). Ingen haptic ved scroll.
 */
(function () {
  const M = window.MSH;
  if (!M || M.tabReorder) return;

  M.TAB_ROW_CSS = `
    .msh-tr{display:flex;gap:4px;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x proximity;scrollbar-width:none;white-space:nowrap;touch-action:pan-x;overscroll-behavior-x:contain;min-width:0;max-width:100%;
      -webkit-mask-image:linear-gradient(to right,transparent 0,#000 var(--tr-fl,0px),#000 calc(100% - var(--tr-fr,0px)),transparent 100%);mask-image:linear-gradient(to right,transparent 0,#000 var(--tr-fl,0px),#000 calc(100% - var(--tr-fr,0px)),transparent 100%)}
    .msh-tr::-webkit-scrollbar{display:none}
    .msh-tr.tr-fitglass{touch-action:pan-y}
    .msh-tr>button{flex:0 0 auto;min-width:max-content;scroll-snap-align:start;white-space:nowrap;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent}
    .msh-tr.tr-drag{scroll-snap-type:none}
    .msh-tr.tr-drag>button{transition:transform .2s cubic-bezier(.2,.8,.2,1)}
    .msh-tr.tr-drag>button.tr-lift{transition:none;position:relative;z-index:5;box-shadow:0 8px 20px rgba(0,0,0,0.45),inset 0 0 0 1.5px var(--pink,#f285c9)}
    .msh-tr.tr-drag>button.tr-lift:not(.on){background:var(--gray300,#404040) !important;color:var(--white,#fafafa) !important}
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
  // Temaet speiles som arvede CSS-variabler på <html> (arver inn i alle shadow roots, byttes live uten ny render):
  //   --ki-tr-bg / --ki-tr-blur / --ki-tr-sh  (udefinert uten temaet → kortets standardflate)
  // Bruk: `.tbox{${MSH.tabSurface('transparent', 'inset 0 0 0 1px rgba(255,255,255,0.12)')}}` → standardflaten uten tema,
  // glass (rgba(255,255,255,.06) + blur(22px) saturate(190%) + glasskant) med tema.
  M.TAB_GLASS_VARS = {
    '--ki-tr-bg': 'linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0) 45%),rgba(255,255,255,0.06)',
    '--ki-tr-blur': 'blur(22px) saturate(190%)',
    '--ki-tr-sh': 'inset 0 0 0 0.5px rgba(255,255,255,0.14),inset 0 1px 0 rgba(255,255,255,0.22)',
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

  const SLOP = 8;
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
  const lensEl = () => {
    const l = document.createElement('span');
    Object.assign(l.style, { position: 'fixed', zIndex: '9998', pointerEvents: 'none', borderRadius: '999px', background: 'linear-gradient(180deg, rgba(255,255,255,0.32), rgba(255,255,255,0.1))', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.65), inset 0 -1px 1px rgba(255,255,255,0.18), inset 0 0 0 0.5px rgba(255,255,255,0.4), 0 10px 24px rgba(0,0,0,0.35)', backdropFilter: 'blur(4px) saturate(220%) brightness(1.15)', WebkitBackdropFilter: 'blur(4px) saturate(220%) brightness(1.15)', opacity: '0', transform: 'scale(.8)', transition: 'left .16s cubic-bezier(.34,1.5,.64,1), top .16s cubic-bezier(.34,1.5,.64,1), width .2s, height .2s, opacity .15s, transform .3s cubic-bezier(.34,1.8,.64,1)' });
    document.body.appendChild(l);
    requestAnimationFrame(() => { l.style.opacity = '1'; l.style.transform = 'scale(1.1)'; });
    return l;
  };

  class TabReorder {
    constructor(row, opts) {
      this.row = row;
      this.opts = opts;
      this.st = null;
      this.eatUntil = 0;
      this._bindRow();
    }
    get o() { return { holdMs: 400, styleRow: true, ...this.opts }; }
    items() { const f = this.o.items; return (f ? Array.from(f() || []) : Array.from(this.row.children).filter((b) => b.tagName === 'BUTTON')).filter((b) => b && b.isConnected); }
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
      // Ingen click / fanebytte etter et drag
      row.addEventListener('click', (e) => { if (Date.now() < this.eatUntil) { this.eatUntil = 0; e.stopPropagation(); e.preventDefault(); } }, true);
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
      b.addEventListener('pointerdown', (e) => this._down(e, b));
      b.addEventListener('pointermove', (e) => { const st = this.st; if (st && st.b === b && e.pointerId === st.pid) this._move(e.clientX, e.clientY, e, false); });
      b.addEventListener('pointerup', (e) => { const st = this.st; if (st && st.b === b && e.pointerId === st.pid) this._end(true, e.clientX); });
      b.addEventListener('pointercancel', (e) => {
        const st = this.st;
        if (!st || st.b !== b || e.pointerId !== st.pid) return;
        if ((st.phase === 'drag' || st.phase === 'glass') && st.touchLock) return; // touch-lytteren har stoppet scrollen – dra videre
        if (st.phase === 'hold') this._abortHold(); else this._end(false);
      });
      b.addEventListener('touchstart', (e) => {
        e.stopPropagation();
        const t = e.changedTouches[0];
        if (!t) return;
        if (!this.st || this.st.b !== b) this._begin(b, t.clientX, t.clientY, null, 'touch');
        if (this.st) this.st.tid = t.identifier;
      }, { passive: false });
      b.addEventListener('touchmove', (e) => {
        e.stopPropagation();
        const st = this.st;
        if (!st || st.b !== b) return;
        const t = [...e.touches].find((x) => st.tid == null || x.identifier === st.tid) || e.touches[0];
        if (!t) return;
        if (st.phase === 'drag' || st.phase === 'glass') { if (e.cancelable) e.preventDefault(); st.touchLock = true; }
        this._move(t.clientX, t.clientY, e, true);
      }, { passive: false });
      b.addEventListener('touchend', (e) => { const st = this.st; if (st && st.b === b && (st.phase === 'drag' || st.phase === 'glass')) { const t = e.changedTouches[0]; this._end(true, t ? t.clientX : st.x); } });
      b.addEventListener('touchcancel', () => { const st = this.st; if (st && st.b === b && st.phase !== 'hold') this._end(false); });
    }
    refresh() {
      const row = this.row;
      if (this.o.styleRow !== false && !row.classList.contains('msh-tr')) row.classList.add('msh-tr');
      if (this.st && this.st.phase === 'drag') return;
      this.items().forEach((b) => this._bindBtn(b));
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
      if (!cw || row.scrollWidth <= cw + 1) return;
      let left = null;
      if (l - m < sl) left = Math.max(0, l - m);
      else if (r + m > sl + cw) left = Math.min(row.scrollWidth - cw, r + m - cw);
      if (left != null) row.scrollTo({ left, behavior: init ? 'auto' : 'smooth' });
    }

    /* ---------------- gest */
    _begin(b, x, y, pid, type) {
      if (this.st && this.st.phase !== 'hold') return;
      this._clearHold();
      const st = (this.st = { b, pid, type, x0: x, y0: y, x, y, sl0: this.row.scrollLeft, phase: 'hold', edit: !!(this.o.isEdit && this.o.isEdit()) });
      if (this.canReorder()) st.timer = setTimeout(() => { if (this.st === st && st.phase === 'hold') this._startDrag(); }, this.o.holdMs);
    }
    _down(e, b) {
      if (e.button) return;
      e.stopPropagation();
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
        if (Math.hypot(dx, dy) <= SLOP) return;
        this._clearHold();
        const horiz = Math.abs(dx) >= Math.abs(dy);
        if (st.edit && horiz && this.canReorder()) this._startDrag();
        else if (horiz && this.o.glass && this.o.onSelect && !this.overflow() && this.items().length > 1) this._startGlass();
        else if (horiz && st.type === 'mouse' && this.overflow()) { st.phase = 'pan'; }
        else { this.st = null; return; } // vanlig scroll (touch: native)
        if (touch && e.cancelable) { e.preventDefault(); st.touchLock = true; }
      }
      if (st.phase === 'hold') return;
      if (!touch && e.cancelable) e.preventDefault();
      if (st.phase === 'pan') { this.row.scrollLeft = st.sl0 - dx; return; }
      if (st.phase === 'glass') { this._glassMove(x, y); return; }
      if (st.phase === 'drag') this._layout(st);
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
      if (this.o.card) this.o.card._busy = true;
      window.__tabReorder = true;
      this._glassOff(true);
      row.classList.add('tr-drag');
      st.b.classList.add('tr-lift');
      st.b.style.transform = 'scale(1.06)';
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
    _layout(st) {
      const row = this.row;
      const dx = st.x - st.x0 + (row.scrollLeft - st.sl0);
      const R = st.rects, f = st.from, wf = R[f].w + st.gap;
      const minDx = -R[f].l, maxDx = R[R.length - 1].l + R[R.length - 1].w - (R[f].l + R[f].w);
      const cdx = Math.max(minDx - 12, Math.min(maxDx + 12, dx));
      st.b.style.transform = `translateX(${cdx}px) scale(1.06)`;
      const c = R[f].l + R[f].w / 2 + cdx;
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
      if (st.phase === 'hold') return; // vanlig trykk → click tar seg av fanebytte (+ MSH.glassTap-animasjon)
      this.eatUntil = Date.now() + 350;
      if (M.glassDragEnd) M.glassDragEnd(); // ingen trykk-animasjon etter dra/glass-dra
      if (st.phase === 'pan') return;
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
      st.its.forEach((b) => { b.style.transform = ''; b.classList.remove('tr-lift'); });
      row.classList.remove('tr-drag');
      void row.offsetWidth;
      requestAnimationFrame(() => row.classList.remove('tr-settle'));
      this._glassOff(false);
      window.__tabReorder = false;
      if (this.o.card) this.o.card._busy = false;
      if (commit) hapLater('light');
      if (changed && this.o.onReorder) this.o.onReorder(ids);
      else if (this.o.card && this.o.card.update) this.o.card.update();
    }

    /* ---------------- liquid glass-valg (når alle faner får plass) */
    _startGlass() {
      const st = this.st;
      st.phase = 'glass';
      if (this.o.card) this.o.card._busy = true;
      this._glassOff(true);
      if (!this.o.onGlassMove) { st.lens = lensEl(); st.fw = M.lensFollow ? M.lensFollow(st.lens, this.row) : null; } // linsen følger raden hver frame
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
      if (this.o.onGlassMove) return this.o.onGlassMove(hit, x);
      const r = hit.getBoundingClientRect(), cr = this.row.getBoundingClientRect();
      const L = Math.max(cr.left + 2, Math.min(cr.right - r.width - 2, x - r.width / 2));
      Object.assign(st.lens.style, { left: L + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', borderRadius: Math.min(r.width, r.height) / 2 + 'px' });
      if (st.fw) st.fw.reset();
    }
    _glassEnd(st, commit) {
      const hit = commit ? st.hit : null;
      if (st.lens) {
        // Slipp: linsen snapper til valgt knapp (ferske mål) og tones ut der – følger raden hvis innholdet under endrer høyde
        const l = st.lens, r = hit && hit.isConnected ? hit.getBoundingClientRect() : null;
        if (r) { Object.assign(l.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' }); if (st.fw) st.fw.reset(); }
        setTimeout(() => { l.style.opacity = '0'; l.style.transform = 'scale(.9)'; }, r ? 160 : 0);
        setTimeout(() => { l.remove(); if (st.fw) st.fw.stop(); }, r ? 380 : 220);
      }
      this._glassOff(false);
      if (this.o.card) this.o.card._busy = false;
      if (this.o.onGlassEnd) this.o.onGlassEnd(hit, commit);
      if (hit) { hapLater('light'); this.o.onSelect(this.idOf(hit)); } else if (this.o.card && this.o.card.update) this.o.card.update();
    }
  }

  M.tabReorder = function (row, opts) {
    if (!row) return null;
    let T = row.__tabReorder;
    if (T) { T.opts = { ...T.opts, ...(opts || {}) }; T.refresh(); return T; }
    T = row.__tabReorder = new TabReorder(row, opts || {});
    // Liquid glass ved trykk (Fiks 4 · 3): alle fanerader får MSH.glassTap (glassTap: false = av)
    if (M.glassTap) M.glassTap(row, { items: () => T.items(), active: () => T.activeBtn(), enabled: () => T.o.glassTap !== false && !window.__tabReorder });
    T.refresh();
    return T;
  };
})();
