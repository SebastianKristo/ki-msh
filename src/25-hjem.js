/* msh-hjem-card · Hjem-visningen som ÉN container. Kilde: Hjem v3.dc.html (mobil + Fold-oppsettet, isFold).
 * Tegner selv griden og oppretter barnekortene (header, prosa, faner/romkort, søppel, strømpris, gjøremål) i riktige
 * områder, sender hass videre og gir hvert barn egen config under `cards.<navn>` (type + card_id → barnas egen «Tilpass»
 * lagrer via MSH.saveCardConfig, som finner kortet via card_id hvor som helst i lovelace-configen).
 *
 * Mål (fra designet): mobil = sidemarg 18, topp 20, bunn 120 + (--ki-nav-bottom − 8) (navbar, følger navbarens avstand), 22 px mellom blokkene, full bredde av
 * dashbordflaten (fiks 17.20: ingen maks 420 px).
 * Fold (fiks 18.4/18.7, MSH.isFold: ≥1000 px, eller berøring ≥600 px – Fold åpen, iPad, PC; layout «Stor»): samme telefon-
 * innhold i én kolonne i full bredde, padding-left = navbar-rail + 2 × avstand (MSH.railPad()), høyre = telefonens sidemarg,
 * ingen max-width og ingen zoom. Den brede griden (2/3 kolonner + zoom) er fjernet.
 * Marger måles mot dashbord-containeren (ikke vinduet): kortet bryter ut av HA sections-viewets egen padding
 * (negativ margin beregnet fra egen rect mot dashbordflaten, ResizeObserver).
 */
(function () {
  const M = window.MSH, esc = M.esc;
  // [nøkkel, tag, navn]
  const BLOCKS = [
    ['header', 'msh-hjem-header-card', 'Header (hilsen, vær, personer)'],
    ['prosa', 'msh-prosa-card', 'Prosa'],
    ['faner', 'msh-hjem-faner-card', 'Faner og romkort'],
    ['soppel', 'msh-soppel-card', 'Søppel'],
    ['strom', 'msh-strompris-card', 'Strømpris'],
    ['gjoremal', 'msh-hjem-gjoremal-card', 'Gjøremål'],
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

  class Hjem extends M.Card {
    constructor() { super(); this._kids = {}; this._geo = null; }
    static get cardName() { return 'Hjem'; }
    static get defaults() { return { layout_mode: 'auto', breakout: true, show_todo: true }; }
    static getStubConfig() {
      const cards = {};
      BLOCKS.forEach(([k, tag]) => { cards[k] = { type: 'custom:' + tag, card_id: M.uid() }; });
      cards.soppel.popup_hash = '#soppel';
      if (M.hjemTiles && M.hjemTiles.CAM_NAV) cards.faner.tile_cfg = { cam: { tap_card: { ...M.hjemTiles.CAM_NAV } } }; // fiks 19.3
      return { card_id: M.uid(), layout_mode: 'auto', cards };
    }
    static get schema() {
      return [
        { type: 'info', label: 'Hjem-visningen i ett kort. Hvert delkort har egen «Tilpass» (hold / tannhjul) og lagres under cards.<navn>.' },
        { type: 'section', id: 'layout', label: 'Layout', icon: 'mdi:page-layout-body', open: true, fields: [
          { type: 'select', name: 'layout_mode', label: 'Layout', options: [['auto', 'Auto (mål dashbordet)'], ['mobil', 'Mobil'], ['stor', 'Stor skjerm']], default: 'auto', help: 'Stor skjerm = Fold-oppsettet: telefon-innholdet i full bredde med navbaren til venstre (auto: ≥ 1000 px, berøring ≥ 600 px).' },
          { type: 'boolean', name: 'breakout', label: 'Mål margene mot dashbordflaten (bryt ut av seksjonens padding)', default: true },
        ] },
        { type: 'section', id: 'kort', label: 'Kort', icon: 'mdi:view-dashboard-outline', open: true, fields: [
          { type: 'boolean', name: 'show_todo', label: 'Vis gjøremål', help: 'Av = gjøremål-kortet vises ikke og tar ingen plass', default: true },
        ] },
        // Fiks 17.18: global bryter (ki-store ui.glass_anim), samme som «Tilpass Hjem» → Faner
        { type: 'section', id: 'faner', label: 'Faner', icon: 'mdi:tab', fields: [
          { type: 'boolean', label: 'Liquid Glass-animasjon', help: 'Glass-linse når du drar eller trykker i faner og segmenter i hele dashbordet', get: () => (M.glassAnimOn ? M.glassAnimOn() : true), set: (v) => { if (M.setGlassAnim) M.setGlassAnim(v); } },
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
      if (M.ringTick) M.ringTick(h); // 19.18: ringeklokke (50-ringeklokke.js)
      if (this._ring) this._ring.hass = h;
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
      if (M.ringHjemBind) M.ringHjemBind(this); // 19.18/19.19: ringe-kort + #ringeklokke fra URL ved kaldstart
    }
    disconnectedCallback() {
      super.disconnectedCallback();
      if (this._ro) { this._ro.disconnect(); this._ro = null; }
      if (this._onRs) { window.removeEventListener('resize', this._onRs); this._onRs = null; }
    }
    // Egen rect mot dashbordflaten → negative marger (sidemarg måles fra dashbordkanten) + bredde og Fold-oppsett.
    _calc() {
      const c = this.config, host = this.getBoundingClientRect();
      const de = findDash();
      let D, full;
      if (de) {
        const r = de.getBoundingClientRect(), cs = getComputedStyle(de);
        D = { l: r.left + (parseFloat(cs.paddingLeft) || 0), r: r.right - (parseFloat(cs.paddingRight) || 0), t: r.top + (parseFloat(cs.paddingTop) || 0), sc: de.scrollTop || 0 };
        full = { l: r.left, w: r.width };
      } else {
        const p = this.parentElement, r = p ? p.getBoundingClientRect() : { left: 0, right: window.innerWidth, top: 0 };
        D = { l: r.left, r: r.right, t: r.top, sc: 0 }; full = { l: r.left, w: r.width };
      }
      D.l = Math.max(0, D.l); D.r = Math.min(window.innerWidth || D.r, D.r);
      // Fiks 18.7: Fold avgjøres av hele dashbordflaten (samme mål som navbaren), ikke innholdsboksen etter railens padding
      const lm = c.layout_mode || 'auto', fw = full ? full.w : D.r - D.l;
      const fold = lm === 'stor' ? true : lm === 'mobil' ? false : M.isFold(fw);
      // I Fold regnes venstremargen fra dashbordkanten (railens reserverte padding tas tilbake – vi legger egen padding-left)
      if (fold && full) D.l = Math.max(0, full.l);
      const out = c.breakout !== false;
      const offL = out ? Math.max(0, Math.round(host.left - D.l)) : 0, offR = out ? Math.max(0, Math.round(D.r - host.right)) : 0;
      const w = Math.round(host.width) + offL + offR;
      // Toppmarg: trekk opp HA-viewets egen luft (maks 64 px) – kun målt øverst på siden.
      let offT = this._geo ? this._geo.offT : 0;
      if (out && (window.scrollY || 0) === 0 && !D.sc) { const t = Math.round(host.top - D.t); offT = t >= 0 && t <= 64 ? t : 0; }
      return { offL, offR, offT, w, fold, pad: fold ? M.railPad() : 0, lm, cw: Math.round(fw) };
    }
    _measure() {
      if (!this.isConnected || !this._config) return;
      const g = this._calc(), o = this._geo;
      if (!o || ['offL', 'offR', 'offT', 'w', 'fold', 'pad'].some((k) => o[k] !== g[k])) { this._geo = g; this._logLayout(g); this.update(); }
    }
    // Fiks 19.11: logg valgt layout én gang (og ved bytte) – «[ki-home] layout=fold 840px» + bredde og berøringspunkter
    _logLayout(g) {
      const k = (g.fold ? 'fold' : 'mobil') + ' ' + g.cw + 'px';
      if (g.cw <= 0 || this._logK === k) return;
      this._logK = k;
      console.info(`[ki-home] layout=${k}`, { containerWidth: g.cw, maxTouchPoints: navigator.maxTouchPoints || 0, layout_mode: g.lm });
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
        const e = { fold: !!G.fold };
        if (!el.mshEmbedded || el.mshEmbedded.fold !== e.fold) { el.mshEmbedded = e; if (el.__cfgJson) el.update && el.update(); }
      }
      // Fiks 18.4: headeren skaleres (0,72 / mellomrom 0,8) i Fold – oppå brukerens egne størrelser, config endres ikke
      if (k === 'header' && el.mshFold !== !!G.fold) { el.mshFold = !!G.fold; if (el.__cfgJson) el.update && el.update(); }
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
      // layout «Mobil»/«Stor» endret i editoren → mål på nytt (Fold-oppsettet følger valget straks)
      const G = this._geo && this._geo.lm === (this.config.layout_mode || 'auto') ? this._geo : (this._geo = this._calc());
      this._logLayout(G);
      const vis = this._order();
      this._vis = vis;
      const slot = (k) => `<div class="s s-${k}" data-key="s-${k}" data-slot="${k}" data-nomorph></div>`;
      // 19.18: ringe-kortet – i fanekortets slot under fanelinjen; egen slot øverst bare når fanekortet er skjult
      const inner = (M.ringShowCard && M.ringShowCard() && !vis.includes('faner') ? slot('ring') : '') + vis.map(slot).join('');
      const gs = G.fold ? `padding-left:${G.pad}px` : '';
      return `<div class="out" style="margin:${-G.offT}px ${-G.offR}px 0 ${-G.offL}px">
        <div class="g mob ${G.fold ? 'fold' : ''}" style="${gs}">${inner}</div>
      </div>`;
    }
    afterRender() {
      const G = this._geo || {};
      (this._vis || []).forEach((k) => {
        const s = this.shadowRoot.querySelector(`[data-slot="${k}"]`), el = this._kid(k, G);
        if (s && el && el.parentNode !== s) s.appendChild(el);
      });
      // skjulte blokker: fjern fra DOM (beholdes i minnet)
      Object.keys(this._kids).forEach((k) => { if (!(this._vis || []).includes(k) && this._kids[k].parentNode) this._kids[k].remove(); });
      if (M.ringHjem) M.ringHjem(this); // 19.18
      this._proseGap();
    }
    // Fiks 16.2: «Avstand til prosa» (header.prose_gap, −20–60 px, standard 16) = synlig mellomrom mellom header og prosa,
    // som margin-top på prosa-sloten når den står rett under headeren (mobil og Fold). Kilden er header-kortets config
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
        .g.mob{width:100%;margin:0;padding:20px 18px calc(120px + var(--ki-nav-bottom, 8px) - 8px);display:flex;flex-direction:column;gap:22px}
        .s{display:block;min-width:0}
        .s>*{display:block;width:100%}
        .g.fold{padding-bottom:calc(40px + var(--ki-mini-h, 0px));--msh-prosa-max:28px}
      `;
    }
  }
  M.define('msh-hjem-card', Hjem, 'MSH Hjem', 'Hele Hjem-visningen i ett kort: header, prosa, faner/romkort, søppel, strømpris og gjøremål med designets marger (mobil og Fold).');
})();
