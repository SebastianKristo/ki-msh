/* msh-hjem-card · Hjem-visningen som ÉN container. Kilde: Hjem v2.dc.html layoutVals()/isWide()/curZoom().
 * Tegner selv griden og oppretter barnekortene (header, prosa, faner/romkort, søppel, strømpris, gjøremål) i riktige
 * områder, sender hass videre og gir hvert barn egen config under `cards.<navn>` (type + card_id → barnas egen «Tilpass»
 * lagrer via MSH.saveCardConfig, som finner kortet via card_id hvor som helst i lovelace-configen).
 *
 * Mål (fra designet): mobil = sidemarg 18, topp 20, bunn 120 + (--ki-nav-bottom − 8) (navbar, følger navbarens avstand), 22 px mellom blokkene, maks 420 px sentrert i
 * dashbordflaten. Bred (≥1000 px, iPad ≥700 px): to kolonner .9fr/1.2fr, gap 22/20, venstre 108 (navbar-rail), høyre 24.
 * ≥1500 px: tre kolonner .95fr/1.35fr/1.05fr, gap 32/20, venstre 120, høyre 36; zoom som designet (maks 1,8).
 * Marger måles mot dashbord-containeren (ikke vinduet): kortet bryter ut av HA sections-viewets egen padding
 * (negativ margin beregnet fra egen rect mot dashbordflaten, ResizeObserver).
 */
(function () {
  const M = window.MSH, esc = M.esc;
  // [nøkkel, tag, navn, område i bred layout]
  const BLOCKS = [
    ['header', 'msh-hjem-header-card', 'Header (hilsen, vær, personer)', 'head'],
    ['prosa', 'msh-prosa-card', 'Prosa', 'head'],
    ['faner', 'msh-hjem-faner-card', 'Faner og romkort', 'rooms'],
    ['soppel', 'msh-soppel-card', 'Søppel', 'trash'],
    ['strom', 'msh-strompris-card', 'Strømpris', 'strom'],
    ['gjoremal', 'msh-hjem-gjoremal-card', 'Gjøremål', 'todo'],
  ];
  const KEYS = BLOCKS.map((b) => b[0]);
  const byKey = (k) => BLOCKS.find((b) => b[0] === k);

  // Dashbordflaten i HA (samme oppslag som MSH.dashRect, men rå rect + padding-top for toppmargen).
  let dashEl = null;
  const findDash = () => {
    if (dashEl && dashEl.isConnected) return dashEl;
    const ha = document.querySelector('home-assistant');
    if (!ha) return null;
    const panel = M.deep(ha.shadowRoot, 'ha-panel-lovelace');
    const root = panel && panel.shadowRoot && panel.shadowRoot.querySelector('hui-root');
    dashEl = (root && root.shadowRoot && (root.shadowRoot.querySelector('#view') || root.shadowRoot.querySelector('hui-view-container'))) || panel || null;
    return dashEl;
  };

  // Barn uten card_id/type i YAML: «Tilpass» i barnet lagres via containeren (cards.<nøkkel>) i stedet.
  if (!M.__hjemSaveWrap) {
    M.__hjemSaveWrap = true;
    const orig = M.saveCardConfig;
    M.saveCardConfig = async function (hass, oldCfg, newCfg) {
      const link = oldCfg && oldCfg.__mshHjem;
      if (!link || !link.parent) return orig.apply(this, arguments);
      const P = link.parent, pOld = P._rawConfig || P.config;
      const kid = { ...newCfg, type: newCfg.type || oldCfg.type };
      if (!kid.card_id) kid.card_id = M.uid();
      const pNew = { ...pOld, cards: { ...(pOld.cards || {}), [link.key]: kid } };
      const r = await orig.call(this, hass, pOld, pNew, arguments[3]);
      P.setConfig(r.config || pNew);
      return { ...r, config: ((r.config || pNew).cards || {})[link.key] || kid };
    };
  }

  // Grid-områder for bred layout ut fra hvilke blokker som vises – skjulte blokker (f.eks. gjøremål) gir ingen tom celle.
  function wideAreas(used, pc) {
    const has = (a) => used.includes(a), q = (rows) => rows.map((r) => `'${r.join(' ')}'`).join(' ');
    if (!pc) {
      const left = ['head', 'trash', 'strom', 'todo'].filter(has);
      if (!has('rooms')) return `grid-template-columns:minmax(0,1fr);grid-template-areas:${q(left.map((a) => [a]))};grid-template-rows:${left.map(() => 'auto').join(' ')}`;
      if (!left.length) return `grid-template-columns:minmax(0,1fr);grid-template-areas:'rooms';grid-template-rows:auto`;
      return `grid-template-areas:${q(left.map((a) => [a, 'rooms']))};grid-template-rows:${left.map((a, i) => (i === left.length - 1 ? '1fr' : 'auto')).join(' ')}`;
    }
    // tre kolonner: venstre head/trash, midten rooms, høyre strom/todo
    const L = ['head', 'trash'].filter(has), R = ['strom', 'todo'].filter(has);
    const cols = [L.length ? 'L' : null, has('rooms') ? 'M' : null, R.length ? 'R' : null].filter(Boolean);
    const n = Math.max(L.length, R.length, 1);
    const colOf = (list, i) => (list.length ? list[Math.min(i, list.length - 1)] : null);
    const rows = Array.from({ length: n + 1 }, (_, i) => cols.map((cc) => (cc === 'M' ? 'rooms' : colOf(cc === 'L' ? L : R, i))));
    const W = { L: 'minmax(0,.95fr)', M: 'minmax(0,1.35fr)', R: 'minmax(0,1.05fr)' };
    return `grid-template-columns:${cols.map((cc) => W[cc]).join(' ')};grid-template-areas:${q(rows)};grid-template-rows:${Array.from({ length: n + 1 }, (_, i) => (i < n ? 'auto' : '1fr')).join(' ')}`;
  }

  class Hjem extends M.Card {
    constructor() { super(); this._kids = {}; this._geo = null; }
    static get cardName() { return 'Hjem'; }
    static get defaults() { return { layout_mode: 'auto', zoom: true, breakout: true, show_todo: true }; }
    static getStubConfig() {
      const cards = {};
      BLOCKS.forEach(([k, tag]) => { cards[k] = { type: 'custom:' + tag, card_id: M.uid() }; });
      cards.soppel.popup_hash = '#soppel';
      return { card_id: M.uid(), layout_mode: 'auto', cards };
    }
    static get schema() {
      return [
        { type: 'info', label: 'Hjem-visningen i ett kort. Hvert delkort har egen «Tilpass» (hold / tannhjul) og lagres under cards.<navn>.' },
        { type: 'section', id: 'layout', label: 'Layout', icon: 'mdi:page-layout-body', open: true, fields: [
          { type: 'select', name: 'layout_mode', label: 'Layout', options: [['auto', 'Auto (mål dashbordet)'], ['mobil', 'Mobil'], ['stor', 'Stor skjerm']], default: 'auto' },
          { type: 'boolean', name: 'zoom', label: 'Skaler opp på store skjermer (opptil 1,8×)', default: true },
          { type: 'boolean', name: 'breakout', label: 'Mål margene mot dashbordflaten (bryt ut av seksjonens padding)', default: true },
        ] },
        { type: 'section', id: 'kort', label: 'Kort', icon: 'mdi:view-dashboard-outline', open: true, fields: [
          { type: 'boolean', name: 'show_todo', label: 'Vis gjøremål', help: 'Av = gjøremål-kortet vises ikke og tar ingen plass', default: true },
        ] },
        { type: 'order', name: 'order', hiddenName: 'hidden', label: 'Blokker (rekkefølge på mobil · skjul)', options: BLOCKS.map((b) => [b[0], b[2]]) },
        { type: 'section', id: 'popups', label: 'Popups', icon: 'mdi:layers-outline', fields: [
          { type: 'info', label: 'Lager én Bubble Card-popup per rom (mal B) og per funksjon/person (mal A), med ett kort hver. Finnes hashen fra før, oppdateres bare cards – dine styles står urørt.' },
          { type: 'button', label: 'Opprett / oppdater popups', icon: 'mdi:auto-fix', run: (h) => M.buildPopups(h) },
        ] },
      ];
    }
    get cardSize() { return 14; }
    set hass(h) {
      const first = !this._hass;
      this._hass = h;
      Object.values(this._kids).forEach((k) => { k.hass = h; });
      if (first) { this._schedule(true); this._checkOpen(); }
      else if (this._lastAreas !== h.areas) this._schedule(true);
    }
    get hass() { return this._hass; }
    connectedCallback() {
      super.connectedCallback();
      if (!this._ro && window.ResizeObserver) {
        this._ro = new ResizeObserver(() => this._measure());
        this._ro.observe(this);
        const d = findDash(); if (d) this._ro.observe(d); else if (this.parentElement) this._ro.observe(this.parentElement);
      }
      if (!this._onRs) { this._onRs = () => this._measure(); window.addEventListener('resize', this._onRs); }
      requestAnimationFrame(() => this._measure());
    }
    disconnectedCallback() {
      super.disconnectedCallback();
      if (this._ro) { this._ro.disconnect(); this._ro = null; }
      if (this._onRs) { window.removeEventListener('resize', this._onRs); this._onRs = null; }
    }
    // Egen rect mot dashbordflaten → negative marger (sidemarg måles fra dashbordkanten) + bredde/zoom.
    _calc() {
      const c = this.config, host = this.getBoundingClientRect();
      const de = findDash();
      let D;
      if (de) {
        const r = de.getBoundingClientRect(), cs = getComputedStyle(de);
        D = { l: r.left + (parseFloat(cs.paddingLeft) || 0), r: r.right - (parseFloat(cs.paddingRight) || 0), t: r.top + (parseFloat(cs.paddingTop) || 0), sc: de.scrollTop || 0 };
      } else {
        const p = this.parentElement, r = p ? p.getBoundingClientRect() : { left: 0, right: window.innerWidth, top: 0 };
        D = { l: r.left, r: r.right, t: r.top, sc: 0 };
      }
      D.l = Math.max(0, D.l); D.r = Math.min(window.innerWidth || D.r, D.r);
      const out = c.breakout !== false;
      const offL = out ? Math.max(0, Math.round(host.left - D.l)) : 0, offR = out ? Math.max(0, Math.round(D.r - host.right)) : 0;
      const w = Math.round(host.width) + offL + offR;
      // Toppmarg: trekk opp HA-viewets egen luft (maks 64 px) – kun målt øverst på siden.
      let offT = this._geo ? this._geo.offT : 0;
      if (out && (window.scrollY || 0) === 0 && !D.sc) { const t = Math.round(host.top - D.t); offT = t >= 0 && t <= 64 ? t : 0; }
      const L = M.hjemLayout ? M.hjemLayout(c.layout_mode || 'auto', w) : { wide: w >= 1000, pc: w >= 1500, zoom: 1 };
      const zoom = c.zoom === false || !L.wide ? 1 : L.zoom;
      return { offL, offR, offT, w, wide: !!L.wide, pc: !!L.pc, zoom };
    }
    _measure() {
      if (!this.isConnected || !this._config) return;
      const g = this._calc(), o = this._geo;
      if (!o || ['offL', 'offR', 'offT', 'w', 'wide', 'pc', 'zoom'].some((k) => o[k] !== g[k])) { this._geo = g; this.update(); }
    }
    _order() {
      const c = this.config, hid = Array.isArray(c.hidden) ? c.hidden : [];
      const ord = Array.isArray(c.order) ? c.order.filter((k) => KEYS.includes(k)) : [];
      return [...ord, ...KEYS.filter((k) => !ord.includes(k))].filter((k) => !hid.includes(k) && !(k === 'gjoremal' && c.show_todo === false));
    }
    _kidCfg(k) {
      const [, tag] = byKey(k);
      const raw = ((this.config.cards || {})[k]) || {};
      const cfg = raw.type && raw.card_id ? raw : { type: 'custom:' + tag, ...raw };
      if (!raw.type || !raw.card_id) Object.defineProperty(cfg, '__mshHjem', { value: { parent: this, key: k }, enumerable: false });
      return cfg;
    }
    _kid(k, G) {
      const [, tag] = byKey(k);
      let el = this._kids[k];
      if (!el) {
        if (!customElements.get(tag)) { customElements.whenDefined(tag).then(() => this.update()); return null; }
        el = document.createElement(tag);
        el.setAttribute('data-block', k);
        this._kids[k] = el;
      }
      if (k === 'faner') {
        const e = { wide: G.wide, pc: G.pc };
        if (!el.mshEmbedded || el.mshEmbedded.wide !== e.wide || el.mshEmbedded.pc !== e.pc) { el.mshEmbedded = e; if (el.__cfgJson) el.update && el.update(); }
      }
      const cfg = this._kidCfg(k), js = JSON.stringify(cfg);
      if (el.__cfgJson !== js) {
        el.__cfgJson = js;
        try { el.setConfig(cfg); } catch (e) { console.error('[ki-msh] msh-hjem-card', k, e); }
      }
      if (this._hass && el.hass !== this._hass) el.hass = this._hass;
      return el;
    }
    render() {
      this._lastAreas = this.hass && this.hass.areas;
      const G = this._geo || (this._geo = this._calc());
      const vis = this._order();
      this._vis = vis;
      const slot = (k) => `<div class="s s-${k}" data-key="s-${k}" data-slot="${k}" data-nomorph></div>`;
      let inner;
      if (!G.wide) inner = vis.map(slot).join('');
      else {
        const head = vis.filter((k) => byKey(k)[3] === 'head');
        const area = (a) => vis.filter((k) => byKey(k)[3] === a).map(slot).join('');
        const used = ['head', 'rooms', 'trash', 'strom', 'todo'].filter((a) => vis.some((k) => byKey(k)[3] === a));
        inner = used.map((a) => (a === 'head' ? `<div class="a a-head" data-key="a-head">${head.map(slot).join('')}</div>` : `<div class="a a-${a}" data-key="a-${a}">${area(a)}</div>`)).join('');
        this._areas = wideAreas(used, G.pc);
      }
      const gs = G.wide ? `zoom:${G.zoom};width:${(G.w / G.zoom).toFixed(2)}px;${this._areas}` : '';
      return `<div class="out" style="margin:${-G.offT}px ${-G.offR}px 0 ${-G.offL}px">
        <div class="g ${G.wide ? 'wide' : 'mob'} ${G.pc ? 'pc' : ''}" style="${gs}">${inner}</div>
      </div>`;
    }
    afterRender() {
      const G = this._geo || {};
      (this._vis || []).forEach((k) => {
        const s = this.shadowRoot.querySelector(`[data-slot="${k}"]`), el = this._kid(k, G);
        if (s && el && el.parentNode !== s) s.appendChild(el);
      });
      // skjulte blokker: fjern fra DOM (beholdes i minnet)
      Object.keys(this._kids).forEach((k) => { if (!(this._vis || []).includes(k) && this._kids[k].parentNode) this._kids[k].remove(); });      this._proseGap();
    }
    // Fiks 16.2: «Avstand til prosa» (header.prose_gap, −20–60 px, standard 16) = synlig mellomrom mellom header og prosa,
    // som margin-top på prosa-sloten når den står rett under headeren (mobil og bred). Kilden er header-kortets config
    // (også utkastet mens «Tilpass header»/«Tilpass Hjem» er åpent); headeren kaller denne etter hver tegning.
    _proseGap() {
      const s = this.shadowRoot && this.shadowRoot.querySelector('[data-slot="prosa"]');
      if (!s) return;
      const hd = this._kids.header, prev = s.previousElementSibling;
      const on = !!(hd && prev && prev.dataset && prev.dataset.slot === 'header');
      const gap = on && M.hjemProseGap ? M.hjemProseGap(hd.config) : null;
      const mt = gap == null ? '' : `${gap - 22}px`; // containerens gap er 22 px
      if (s.style.marginTop !== mt) s.style.marginTop = mt;
    }
    get styles() {
      return `
        :host{display:flow-root}
        ha-card{display:flow-root}
        .out{position:relative}
        .g{box-sizing:border-box}
        .g.mob{width:100%;max-width:420px;margin:0 auto;padding:20px 18px calc(120px + var(--ki-nav-bottom, 8px) - 8px);display:flex;flex-direction:column;gap:22px}
        .s{display:block;min-width:0}
        .s>*{display:block;width:100%}
        .g.wide{display:grid;margin:0;padding:24px 24px 40px 108px;grid-template-columns:minmax(0,.9fr) minmax(0,1.2fr);grid-template-rows:auto auto auto 1fr;
          grid-template-areas:"head rooms" "trash rooms" "strom rooms" "todo rooms";column-gap:22px;row-gap:20px;align-items:start}
        .g.wide.pc{padding:32px 36px 40px 120px;grid-template-columns:minmax(0,.95fr) minmax(0,1.35fr) minmax(0,1.05fr);grid-template-rows:auto auto 1fr;
          grid-template-areas:"head rooms strom" "trash rooms todo" "trash rooms todo";column-gap:32px}
        .a{min-width:0}
        .a-head{grid-area:head;display:flex;flex-direction:column;gap:22px}
        .a-rooms{grid-area:rooms;position:sticky;top:24px}
        .a-trash{grid-area:trash}
        .a-strom{grid-area:strom}
        .a-todo{grid-area:todo}
        .a:empty{display:none}
      `;
    }
  }
  M.define('msh-hjem-card', Hjem, 'MSH Hjem', 'Hele Hjem-visningen i ett kort: header, prosa, faner/romkort, søppel, strømpris og gjøremål med designets marger (mobil og bred).');
})();
