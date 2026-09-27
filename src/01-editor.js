/* KI MSH · felles editor (msh-editor)
 * Brukes både som HA GUI-editor (getConfigElement → config-changed) og som kortets egen
 * tilpasningsmeny (MshCard.customize → msh-save). Samme skjema, samme config – config er sannheten.
 * Som tilpasningsmeny (inline, MSH.openEditor) redigerer den et UTKAST (MSH.draftEditor, fiks 15.13): msh-change =
 * bare utkast + live forhåndsvisning, msh-save («Ferdig») = én lagring, msh-cancel («Avbryt») = forkast.
 * _setBusy(true) deaktiverer Ferdig (spinner) mens lagringen pågår; setConfig() kalles bare ved åpning og «Last inn».
 *
 * Skjemafelt (cardClass.schema, evt. funksjon (hass, config) → array):
 *   { type:'text'|'number'|'boolean'|'select'|'icon'|'color'|'entity'|'entities'|'area'|'hash',
 *     name:'sti.til.felt', label, help, placeholder, options:[[verdi,etikett]], domain, device_class,
 *     auto:(hass,cfg)=>autoverdi (vises som placeholder), min, max, step }
 *   { type:'section', label, fields:[…], open:true }
 *   { type:'overrides', label, fields:[{ name, label, domain, device_class, auto }] } → config.overrides
 *   { type:'lists', label, lists:(hass,cfg)=>[{ key, label, ids, domains }] }    → config.exclude / config.include
 *   { type:'order', name:'sections', hiddenName:'hidden_sections', label, options:[[key,label]] }
 *   { type:'gap' } → config.gap (4 / 8 / 18)
 *   { type:'stepper', entity: id | (hass,cfg)=>id, label, help, unit, min, max, step } → «− verdi +» med systemets velger
 *       (09-pickers); skriver entitetens verdi direkte (number/time/date/datetime-tjenestene), ikke til config
 *   'icon': inline (dashbordets ark) = felles søkbar ikonvelger MSH.iconPicker (09-icon-picker); HA GUI-editor = ha-icon-picker
 *   'hash': inline = popup-velgeren MSH.popupPicker (09-tap-picker, Fiks 17.8); HA GUI-editor = ha-selector select (custom_value)
 *   { type:'tap', name, label, modes:['popup','hash','path','url','more','lock','none'], auto } → trykk-handling i HA-format
 *       ({ action: navigate, navigation_path: '#tesla' } …) via <msh-tap-picker> (09-tap-picker)
 *   { type:'action', name, label, std, apps } → HA action-format (Standard · Åpne app · Send kommando · HA-handling · Ingen)
 */
(function () {
  if (customElements.get('msh-editor')) return;
  const M = window.MSH, esc = M.esc;
  const get = (o, p) => String(p).split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  const set = (o, p, v) => {
    const ks = String(p).split('.'), out = { ...o };
    let cur = out;
    ks.forEach((k, i) => {
      if (i === ks.length - 1) { if (v === undefined || v === '' || v === null) delete cur[k]; else cur[k] = v; }
      else { cur[k] = Array.isArray(cur[k]) ? [...cur[k]] : { ...(cur[k] || {}) }; cur = cur[k]; }
    });
    return out;
  };
  const clean = (o) => {
    ['overrides', 'include'].forEach((k) => {
      if (o[k] && typeof o[k] === 'object') {
        Object.keys(o[k]).forEach((x) => { const v = o[k][x]; if (v == null || v === '' || (Array.isArray(v) && !v.length)) delete o[k][x]; });
        if (!Object.keys(o[k]).length) delete o[k];
      }
    });
    if (Array.isArray(o.exclude) && !o.exclude.length) delete o.exclude;
    return o;
  };

  /* ------------------------------------------------------------ felles entitetsvelger (Rom v4 · Klima, Hjem · Tekst)
   * <msh-entity-picker> – knapp (48 px, #282828, r14: ikon · navn · entity_id) som åpner en inline liste
   * (#282828, r18): søkefelt (42 px, #3a3a3a, autofokus) → filter-chips (Alle · Sensor · Binær · Vær · Lys ·
   * Bryter · Klima) → «Automatisk» (når auto-mode) → «Bruk «…»» (gyldig, ukjent entity_id) → treff (maks 280 px).
   * Søket matcher friendly_name, entity_id, område-navn og device_class, uten store/små bokstaver og med æøå normalisert.
   * Attributter: value, auto (auto-entitet), auto-mode="1" (vis «Automatisk»), domains="sensor,weather",
   *   device-class="temperature", area (sorteres først), mode="set"|"add", placeholder, auto-label.
   * Egenskap: hass (ellers MSH.lastHass). Hendelse: value-changed { value } ('' = Automatisk / fjern).
   * Bruk: MSH.entityPicker.html({ name, value, auto, autoMode, domains, deviceClass, area, mode, placeholder, key, attrs }). */
  const PK_FLT = [['', 'Alle'], ['sensor', 'Sensor', ['sensor']], ['binary_sensor', 'Binær', ['binary_sensor']], ['weather', 'Vær', ['weather']], ['light', 'Lys', ['light']], ['switch', 'Bryter', ['switch', 'input_boolean']], ['climate', 'Klima', ['climate']]];
  const norm = (s) => String(s == null ? '' : s).toLowerCase().replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'a').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[_.\-]+/g, ' ');
  const ENT_RE = /^[a-z_]+\.[a-z0-9_]+$/;
  const idxCache = new WeakMap();
  // Søkeindeks per hass-objekt: [{ id, dom, name, hay }]
  function pickIndex(h) {
    if (!h || !h.states) return [];
    let I = idxCache.get(h.states);
    if (I) return I;
    I = Object.keys(h.states).map((id) => {
      const s = h.states[id], a = s.attributes || {}, name = a.friendly_name || id, ar = M.areaOf(h, id);
      const an = ar && h.areas && h.areas[ar] ? h.areas[ar].name : '';
      return { id, dom: id.split('.')[0], name, area: ar, nn: norm(name), hay: norm(`${name} ${id} ${an} ${a.device_class || ''}`) };
    });
    idxCache.set(h.states, I);
    return I;
  }
  // Treff for et søk. opts: { domains, deviceClass, flt, area }
  M.entitySearch = function (h, q, opts = {}) {
    const doms = opts.domains && opts.domains.length ? opts.domains : null, dcs = opts.deviceClass && opts.deviceClass.length ? opts.deviceClass : null;
    const F = PK_FLT.find((x) => x[0] === opts.flt), fd = F && F[2];
    const toks = norm(q).split(/\s+/).filter(Boolean);
    const out = pickIndex(h).filter((x) => (!doms || doms.includes(x.dom)) && (!fd || fd.includes(x.dom))
      && (!dcs || dcs.includes((h.states[x.id].attributes || {}).device_class)) && toks.every((t) => x.hay.includes(t)));
    const t0 = toks[0] || '';
    const score = (x) => (opts.area && x.area === opts.area ? 0 : 4) + (!t0 ? 0 : x.nn.startsWith(t0) ? 0 : x.nn.includes(t0) ? 1 : 2);
    return out.sort((a, b) => score(a) - score(b) || a.name.localeCompare(b.name, 'nb'));
  };
  const PK_CSS = `
    :host{display:block;font-family:${M.FONT};color:#fafafa}
    *{box-sizing:border-box}
    button,input{font:inherit;color:inherit;border:0;background:none;padding:0;margin:0;cursor:pointer;-webkit-tap-highlight-color:transparent}
    input{cursor:text;outline:none;-webkit-user-select:text;user-select:text}
    .pk{width:100%;height:48px;display:flex;align-items:center;gap:10px;padding:0 12px;border-radius:14px;background:#282828;text-align:left}
    .pk:active{transform:scale(.99)}
    .nm{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
    .nm b{font-weight:500;font-size:14px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .nm i{font-style:normal;font-size:11px;line-height:1.2;color:#7f7f7f;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .pl{display:flex;flex-direction:column;gap:8px;padding:8px;border-radius:18px;background:#282828}
    .sr{position:relative;display:flex;align-items:center}
    .pks{height:42px;padding:0 42px 0 14px;border-radius:14px;background:#3a3a3a;font-size:15px;width:100%}
    .pks::placeholder{color:#7f7f7f}
    .x{position:absolute;right:4px;top:3px;width:36px;height:36px;border-radius:18px;display:grid;place-items:center;color:#979797}
    .fl{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;touch-action:pan-x;padding:0 1px}
    .fl::-webkit-scrollbar{display:none}
    .fc{flex:none;height:30px;padding:0 12px;border-radius:15px;background:#3a3a3a;font-size:12px;font-weight:500;color:#c7c7c7;white-space:nowrap}
    .fc.on{background:#fafafa;color:#282828}
    .pls{max-height:280px;overflow-y:auto;overscroll-behavior:contain;display:flex;flex-direction:column;gap:2px;touch-action:pan-y}
    .pr{display:flex;align-items:center;gap:10px;min-height:48px;padding:4px 10px;border-radius:12px;text-align:left;width:100%}
    .pr:hover{background:rgba(255,255,255,0.05)}
    .pr.on{background:rgba(255,255,255,0.08)}
    .val{font-size:12px;color:#afafaf;white-space:nowrap;flex:none;max-width:40%;overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums}
    .none{font-size:12px;color:#7f7f7f;padding:10px}
    .more{font-size:11px;color:#7f7f7f;padding:6px 10px}
  `;
  class MshEntityPicker extends HTMLElement {
    static get observedAttributes() { return ['value', 'auto', 'auto-mode', 'domains', 'device-class', 'area', 'mode', 'placeholder', 'auto-label']; }
    constructor() {
      super();
      this._open = false; this._q = ''; this._flt = '';
      const sr = this.attachShadow({ mode: 'open' });
      sr.addEventListener('click', (e) => this._click(e));
      sr.addEventListener('input', (e) => { e.stopPropagation(); if (e.target.classList.contains('pks')) { this._q = e.target.value; this._render(); } });
      sr.addEventListener('keydown', (e) => this._key(e));
      // Vannrett chip-rad og liste: ikke la Bubble Card lukke/scrolle popupen
      ['touchstart', 'touchmove', 'pointerdown'].forEach((t) => sr.addEventListener(t, (e) => { if (e.composedPath().some((n) => n.classList && (n.classList.contains('fl') || n.classList.contains('pls')))) e.stopPropagation(); }, { passive: true }));
      this._outside = (e) => { if (this._open && !e.composedPath().includes(this)) this.close(); };
    }
    set hass(h) { const o = this._hass; this._hass = h; if (!o || !this._open) this._render(); }
    get hass() { return this._hass || M.lastHass || null; }
    get value() { return this.getAttribute('value') || ''; }
    set value(v) { this.setAttribute('value', v || ''); }
    connectedCallback() { this._render(); }
    disconnectedCallback() { window.removeEventListener('pointerdown', this._outside, true); }
    attributeChangedCallback(n, o, v) { if (o !== v) this._render(); }
    _list(a) { return String(this.getAttribute(a) || '').split(',').map((x) => x.trim()).filter(Boolean); }
    open() {
      if (this._open) return;
      this._open = true; this._q = ''; this._flt = '';
      window.addEventListener('pointerdown', this._outside, true);
      this._render();
      const i = this.shadowRoot.querySelector('.pks');
      if (i) requestAnimationFrame(() => { try { i.focus({ preventScroll: true }); } catch (e) { i.focus(); } });
    }
    close() {
      if (!this._open) return;
      this._open = false;
      window.removeEventListener('pointerdown', this._outside, true);
      this._render();
    }
    _pick(v) {
      M.haptic('selection');
      const mode = this.getAttribute('mode') || 'set';
      if (mode !== 'add') this.setAttribute('value', v || '');
      this._open = false;
      window.removeEventListener('pointerdown', this._outside, true);
      this._render();
      this.dispatchEvent(new CustomEvent('value-changed', { detail: { value: v || '' }, bubbles: true, composed: true }));
    }
    _click(e) {
      const b = e.composedPath().find((n) => n.dataset && n.dataset.p);
      if (!b) return;
      const d = b.dataset;
      if (d.p === 'open') { M.haptic('light'); return this.open(); }
      if (d.p === 'x') { if (this._q) { this._q = ''; this._render(); const i = this.shadowRoot.querySelector('.pks'); if (i) { i.value = ''; i.focus(); } } else this.close(); return; }
      if (d.p === 'flt') { this._flt = d.v; M.haptic('selection'); return this._render(); }
      if (d.p === 'pick') return this._pick(d.v);
    }
    _key(e) {
      if (e.key === 'Escape') { e.stopPropagation(); this.close(); return; }
      if (e.key !== 'Enter' || !e.target.classList.contains('pks')) return;
      e.preventDefault(); e.stopPropagation();
      const q = this._q.trim();
      if (ENT_RE.test(q)) return this._pick(q);
      const first = this.shadowRoot.querySelector('.pr[data-hit]');
      if (first) this._pick(first.dataset.v);
    }
    _btn(h) {
      const v = this.value, s = v && h ? h.states[v] : null, mode = this.getAttribute('mode') || 'set';
      const chev = M.icon('mdi:chevron-down', 20, 'color:#979797');
      if (mode === 'add') return `<button class="pk" data-p="open">${M.icon('mdi:plus', 22, 'color:#afafaf')}<span class="nm"><b>${esc(this.getAttribute('placeholder') || 'Legg til …')}</b><i>Søk etter navn, rom eller entity_id</i></span>${chev}</button>`;
      if (v) return `<button class="pk" data-p="open">${M.icon(M.domainIcon(v, s), 22, 'color:#afafaf')}<span class="nm"><b>${esc(s ? s.attributes.friendly_name || v : v)}</b><i>${esc(v)}${s ? '' : ' · finnes ikke'}</i></span>${chev}</button>`;
      const auto = this.getAttribute('auto') || '';
      if (this.getAttribute('auto-mode') === '1') {
        const as = auto && h ? h.states[auto] : null;
        return `<button class="pk" data-p="open">${M.icon('mdi:auto-fix', 22, 'color:#afafaf')}<span class="nm"><b>${esc(this.getAttribute('auto-label') || 'Automatisk')}</b><i>${esc(auto ? (as && as.attributes.friendly_name ? as.attributes.friendly_name + ' · ' : '') + auto : 'fant ingen')}</i></span>${chev}</button>`;
      }
      return `<button class="pk" data-p="open">${M.icon('mdi:magnify', 22, 'color:#afafaf')}<span class="nm"><b>${esc(this.getAttribute('placeholder') || 'Velg entitet …')}</b><i>Søk etter navn, rom eller entity_id</i></span>${chev}</button>`;
    }
    _panel(h) {
      const v = this.value, q = this._q.trim(), doms = this._list('domains'), mode = this.getAttribute('mode') || 'set';
      const chips = PK_FLT.filter((f) => !f[2] || !doms.length || f[2].some((d) => doms.includes(d)));
      const flt = chips.some((f) => f[0] === this._flt) ? this._flt : '';
      const hits = h ? M.entitySearch(h, q, { domains: doms, deviceClass: this._list('device-class'), flt, area: this.getAttribute('area') || '' }) : [];
      const row = (x) => `<button class="pr ${x.id === v ? 'on' : ''}" data-p="pick" data-hit="1" data-v="${esc(x.id)}" data-key="${esc(x.id)}">${M.icon(M.domainIcon(x.id, h.states[x.id]), 22, 'color:#afafaf')}<span class="nm"><b>${esc(x.name)}</b><i>${esc(x.id)}</i></span><span class="val">${esc(M.fmtState(h, x.id))}</span></button>`;
      const auto = this.getAttribute('auto') || '';
      const autoRow = mode !== 'add' && this.getAttribute('auto-mode') === '1' && !q ? `<button class="pr ${v ? '' : 'on'}" data-p="pick" data-v="" data-key="__auto">${M.icon('mdi:auto-fix', 22, 'color:#afafaf')}<span class="nm"><b>${esc(this.getAttribute('auto-label') || 'Automatisk')}</b><i>${esc(auto || 'fant ingen')}</i></span>${auto && h && h.states[auto] ? `<span class="val">${esc(M.fmtState(h, auto))}</span>` : ''}</button>` : '';
      const useIt = ENT_RE.test(q) && !(h && h.states[q]) ? `<button class="pr" data-p="pick" data-v="${esc(q)}" data-key="__use">${M.icon('mdi:keyboard-return', 22, 'color:#afafaf')}<span class="nm"><b>Bruk «${esc(q)}»</b><i>Finnes ikke nå – brukes likevel</i></span></button>` : '';
      const MAX = 120;
      return `<div class="pl">
        <div class="sr"><input class="pks" value="${esc(this._q)}" placeholder="Søk: navn, rom, entity_id …" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done"><button class="x" data-p="x" title="${this._q ? 'Tøm' : 'Lukk'}">${M.icon(this._q ? 'mdi:close-circle' : 'mdi:chevron-up', 20)}</button></div>
        ${chips.length > 2 ? `<div class="fl">${chips.map(([k, l]) => `<button class="fc ${flt === k ? 'on' : ''}" data-p="flt" data-v="${k}" data-key="f-${k || 'alle'}">${l}</button>`).join('')}</div>` : ''}
        <div class="pls">${autoRow}${useIt}${hits.slice(0, MAX).map(row).join('')}${hits.length > MAX ? `<div class="more">+ ${hits.length - MAX} til – skriv mer for å snevre inn</div>` : ''}${!hits.length && !useIt ? '<div class="none">Ingen treff</div>' : ''}</div>
      </div>`;
    }
    _render() {
      if (!this.shadowRoot) return;
      const h = this.hass;
      const html = `<style>${PK_CSS}</style>${this._open ? this._panel(h) : this._btn(h)}`;
      if (!this._did) { this.shadowRoot.innerHTML = html; this._did = true; } else M.morph(this.shadowRoot, html);
    }
  }
  if (!customElements.get('msh-entity-picker')) customElements.define('msh-entity-picker', MshEntityPicker);
  M.entityPicker = {
    tag: 'msh-entity-picker',
    // HTML for innbygging (morph-trygg: data-key + data-nomorph). Sett .hass på elementet etter render.
    html(o = {}) {
      const a = (k, v) => (v == null || v === '' ? `${k}=""` : `${k}="${esc([].concat(v).join(','))}"`);
      return `<msh-entity-picker data-nomorph ${o.key ? `data-key="${esc(o.key)}"` : ''} ${o.name ? `data-name="${esc(o.name)}"` : ''} ${a('value', o.value)} ${a('auto', o.auto)} auto-mode="${o.autoMode ? 1 : 0}" ${a('domains', o.domains)} ${a('device-class', o.deviceClass)} ${a('area', o.area)} mode="${o.mode || 'set'}" ${a('placeholder', o.placeholder)} ${a('auto-label', o.autoLabel)} ${o.attrs || ''}></msh-entity-picker>`;
    },
  };

  const ED_CSS = `
    :host{display:block;font-family:${M.FONT};color:#fafafa;--ed-bg:#2f2f2f}
    *{box-sizing:border-box}
    button,input,select{font:inherit;color:inherit;border:0;background:none;padding:0;margin:0;cursor:pointer}
    input,select{cursor:text;outline:none}
    select{cursor:pointer}
    .wrap{display:flex;flex-direction:column;gap:10px;padding:4px 0 0;background:transparent}
    :host(:not([inline])) .wrap{padding:12px;border-radius:24px;background:#282828}
    /* Tittelrad: sticky rett under håndtaket (arkets flate fra MSH.sheetVars), med «Lagret»-pillen til høyre (Fiks 11) */
    .ttl{position:sticky;top:calc(var(--ki-grab-h, 0px) - var(--ki-sh-pt, 0px) - 1px);z-index:5;font-size:18px;font-weight:500;display:flex;align-items:center;gap:10px;min-height:44px;
      margin:-4px calc(-1 * var(--ki-sh-px, 0px)) 0;padding:2px calc(4px + var(--ki-sh-px, 0px)) 6px;background:var(--ki-sheet-bg, transparent);-webkit-backdrop-filter:var(--ki-sheet-blur, none);backdrop-filter:var(--ki-sheet-blur, none)}
    .ttl .tt{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .ttl .stat{flex:none;height:26px;padding:0 11px;border-radius:13px;display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:600;background:var(--gray1000,#e1e1e1);color:var(--gray000,#232323);opacity:0;transform:translateY(-4px) scale(.94);transition:opacity .2s,transform .25s cubic-bezier(.34,1.4,.64,1);pointer-events:none}
    .ttl .stat.on{opacity:1;transform:none}
    .ttl .stat.ok{background:var(--green,#66d19e);color:#12291d}
    .ttl .stat.err{background:var(--red,#f28073);color:#2c1411}
    .sec{border-radius:24px;background:var(--ki-sheet-grp,#3a3a3a);box-shadow:inset 0 0 0 1px rgba(255,255,255,0.05);overflow:hidden;scroll-margin-top:calc(var(--ki-grab-h, 0px) + 56px)}
    .sec>summary{list-style:none;display:flex;align-items:center;gap:10px;height:52px;padding:0 16px;font-size:14px;font-weight:500;cursor:pointer}
    .sec>summary::-webkit-details-marker{display:none}
    .sec>summary .chev{margin-left:auto;transition:transform .2s;color:#979797}
    .sec[open]>summary .chev{transform:rotate(180deg)}
    .sec .in{display:flex;flex-direction:column;gap:8px;padding:0 12px 12px}
    .f{display:flex;flex-direction:column;gap:6px;padding:10px 12px;border-radius:16px;background:#404040}
    .f label{font-size:12px;color:#afafaf}
    .f .help{font-size:11px;color:#7f7f7f}
    .inp{height:40px;padding:0 12px;border-radius:12px;background:#2f2f2f;font-size:14px;width:100%}
    .inp::placeholder{color:#7f7f7f}
    .line{display:flex;align-items:center;gap:8px}
    .sw{position:relative;width:46px;height:28px;border-radius:14px;background:#545454;flex:none;transition:background .2s}
    .sw::after{content:'';position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:11px;background:#fafafa;transition:transform .2s cubic-bezier(.34,1.4,.64,1)}
    .sw.on{background:var(--green,#66d19e)} .sw.on::after{transform:translateX(18px)}
    .chips{display:flex;flex-wrap:wrap;gap:6px}
    .chip{height:32px;padding:0 12px;border-radius:16px;background:#2f2f2f;font-size:12px;font-weight:500;color:#afafaf;display:inline-flex;align-items:center;gap:6px}
    .chip.on{background:#fafafa;color:#282828}
    .sws{display:flex;flex-wrap:wrap;gap:6px}
    .dot{width:26px;height:26px;border-radius:13px;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.12);flex:none}
    .dot.on{box-shadow:0 0 0 2px #282828,0 0 0 4px #fafafa}
    .ent{display:flex;align-items:center;gap:10px;min-height:44px;padding:4px 4px 4px 10px;border-radius:12px;background:#2f2f2f}
    .ent .nm{flex:1;min-width:0;display:flex;flex-direction:column}
    .ent .nm b{font-weight:500;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .ent .nm i{font-style:normal;font-size:11px;color:#7f7f7f;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .ent.off{opacity:.45}
    .ib{width:36px;height:36px;border-radius:18px;display:grid;place-items:center;color:#afafaf;flex:none}
    .ib:hover{background:#404040}
    .dd{position:relative}
    .menu{position:absolute;left:0;right:0;top:44px;z-index:5;max-height:260px;overflow:auto;border-radius:14px;background:#232323;box-shadow:0 12px 30px rgba(0,0,0,.5);padding:4px}
    .menu button{display:flex;width:100%;text-align:left;flex-direction:column;padding:8px 10px;border-radius:10px}
    .menu button:hover{background:#3a3a3a}
    .menu b{font-weight:500;font-size:13px} .menu i{font-style:normal;font-size:11px;color:#7f7f7f}
    /* Sticky bunnlinje (Fiks 11): egen flate (#282828 / glass med Liquid Glass-tema), toppskille, safe-area. Tar plass i flyten,
       så siste rad kan scrolles helt fram over den. */
    .actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;position:sticky;bottom:0;z-index:5;margin:0 calc(-1 * var(--ki-sh-px, 0px));
      padding:12px 16px calc(12px + env(safe-area-inset-bottom, 0px));background:var(--ki-sheet-bg,#282828);-webkit-backdrop-filter:var(--ki-sheet-blur, none);backdrop-filter:var(--ki-sheet-blur, none);box-shadow:inset 0 1px 0 rgba(255,255,255,0.06)}
    .btn{height:52px;border-radius:26px;background:#3a3a3a;font-weight:500;font-size:14px;display:flex;align-items:center;justify-content:center;gap:8px}
    .actions .btn{height:48px;border-radius:24px}
    .btn.pri{background:linear-gradient(145deg, rgb(242 133 201) -10%, rgb(245 205 198) 100%);color:#2a1720}
    .btn.pri[disabled]{opacity:.7;cursor:progress}
    .spin{width:18px;height:18px;border-radius:50%;border:2.5px solid rgba(42,23,32,0.25);border-top-color:#2a1720;animation:edspin .8s linear infinite;flex:none}
    @keyframes edspin{to{transform:rotate(360deg)}}
    .small{font-size:12px;color:#979797}
    .ordrow{display:flex;align-items:center;gap:6px;height:44px;padding:0 4px 0 12px;border-radius:12px;background:#2f2f2f}
    ha-icon-picker,ha-selector{display:block}
    .sec>summary .meta{margin-left:auto;font-size:12px;font-weight:400;color:#979797;white-space:nowrap}
    .sec>summary .meta+.chev{margin-left:8px}
    msh-entity-picker{display:block}
    /* slider med snarvalg – egen pekerstyrt slider (Fiks 11): tar bare over ved bevisst vannrett drag (> 6 px og mer
       vannrett enn loddrett), trykk på sporet endrer ingenting, loddrett bevegelse scroller arket (touch-action: pan-y).
       Den skjulte <input type=range> gir tastatur/skjermleser (piltaster) og samme input/change-hendelser. */
    .rg .rv{font-size:13px;color:#fafafa;font-variant-numeric:tabular-nums}
    .sl{position:relative;height:32px;touch-action:pan-y;cursor:grab;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}
    .sl.drag{cursor:grabbing}
    .sl .tr{position:absolute;left:11px;right:11px;top:13px;height:6px;border-radius:3px;background:#545454;overflow:hidden}
    .sl .fi{position:absolute;left:0;top:0;bottom:0;width:var(--p,0%);background:#afafaf}
    .sl .th{position:absolute;top:5px;left:calc((100% - 22px) * var(--f, 0));width:22px;height:22px;border-radius:11px;background:#fafafa;box-shadow:0 2px 6px rgba(0,0,0,.4);transition:transform .15s}
    .sl.drag .th{transform:scale(1.15)}
    .sl input[type=range]{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;pointer-events:none}
    .sl:focus-within .th{box-shadow:0 0 0 3px rgba(242,133,201,.55),0 2px 6px rgba(0,0,0,.4)}
    .pill{height:30px;padding:0 12px;border-radius:15px;font-size:12px;font-weight:500;background:#545454;color:#fafafa}
    .pill.on{background:linear-gradient(145deg, rgb(242 133 201) -10%, rgb(245 205 198) 100%);color:#3a3a3a}
    /* Liquid glass (navbar-stil glass, attributtet settes når editoren ligger i et glassark fra MSH.overlay):
       rader/grupper = glassSurface('row'), felt/segmentspor rgba(0,0,0,.25), aktivt segment = glassboble, tekst #fafafa / .62.
       Ferdig-knappen (rosa gradient) er uendret. Standard-profilen bruker reglene over. */
    :host([glass]){--ed-bg:transparent}
    :host([glass]) .sec,:host([glass]) .f,:host([glass]) .ent,:host([glass]) .ordrow{${M.glassSurface('row')}}
    :host([glass]) .inp{background:rgba(0,0,0,0.25)}
    :host([glass]) .f label,:host([glass]) .small,:host([glass]) .sec>summary .chev,:host([glass]) .sec>summary .meta,:host([glass]) .ent .nm i,:host([glass]) .f .help{color:rgba(255,255,255,0.62)}
    :host([glass]) .chips.sg{${M.glassSurface('segment')}padding:3px;border-radius:19px;gap:2px;touch-action:pan-y}
    :host([glass]) .chips.sg .chip{background:transparent;color:rgba(255,255,255,0.62);border-radius:16px;transition:background .2s,color .2s}
    :host([glass]) .chips.sg .chip.on{${M.GLASS_BUBBLE}}
    :host([glass]) .chip,:host([glass]) .pill{background:rgba(255,255,255,0.1)}
    :host([glass]) .btn:not(.pri){${M.glassSurface('row')}}
    :host([glass]) .ib:hover,:host([glass]) .menu button:hover{background:rgba(255,255,255,0.08)}
    :host([glass]) .menu{${M.glassSurface('menu')}}
    ${M.glassFallback(':host([glass]) .menu', 'menu')}
    :host([glass]) .sw:not(.on),:host([glass]) .sl .tr{background:rgba(255,255,255,0.18)}
  `;

  class MshEditor extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._open = {};
      this._q = {};
      this.shadowRoot.addEventListener('click', (e) => this._click(e));
      this.shadowRoot.addEventListener('input', (e) => this._input(e));
      this.shadowRoot.addEventListener('change', (e) => this._change(e));
      this.shadowRoot.addEventListener('focusin', (e) => { const t = e.target; if (t.dataset && t.dataset.search) { this._menu = t.dataset.search; this._render(); } });
      // Åpne seksjoner = UI-tilstand (per kort i localStorage ki:<card_id>:ed:ui, aldri i config) – overlever lagring og ny åpning
      this.shadowRoot.addEventListener('toggle', (e) => {
        const d = e.target;
        if (!d.dataset || d.dataset.sec == null || this._open[d.dataset.sec] === d.open) return;
        this._open[d.dataset.sec] = d.open;
        if (this._uiKey) M.uiStore(this._uiKey + ':ed', { open: this._open });
      }, true);
      this._bindSliders();
      this.shadowRoot.addEventListener('value-changed', (e) => {
        const t = e.target;
        if (t.dataset && t.dataset.name) {
          e.stopPropagation();
          const v = e.detail.value;
          // entitetsvelger i «legg til»-modus: legg valgt entitet til listen
          if (t.dataset.mode === 'add') { if (!v) return; const l = [...(this._val ? this._val(t.dataset.name) || [] : get(this._config, t.dataset.name) || [])]; if (!l.includes(v)) l.push(v); return this._set(t.dataset.name, l); }
          this._set(t.dataset.name, v === '' || v == null ? undefined : v);
        }
      });
    }
    set inline(v) { this._inline = v; if (v) this.setAttribute('inline', ''); }
    set uiKey(k) { this._uiKey = k || null; if (k) { const u = M.uiLoad(k + ':ed'); if (u && u.open) this._open = { ...u.open, ...this._open }; } }
    get uiKey() { return this._uiKey; }
    // Slider (Fiks 11): pekerstyrt, relativt drag. pointerdown noterer bare startpunktet; draget tas over først når
    // bevegelsen er > 6 px og mer vannrett enn loddrett (da: pointer capture + stopPropagation, fallgruve 2). Loddrett →
    // slippes, og arket scroller (touch-action: pan-y → nettleseren sender pointercancel). Trykk uten drag endrer ingenting.
    // Live under drag (commit=false), lagres ved slipp.
    _bindSliders() {
      const R = this.shadowRoot;
      const end = (e) => {
        const g = this._sl;
        if (!g || (e && e.pointerId !== g.id)) return;
        this._sl = null;
        if (g.el.isConnected) g.el.classList.remove('drag');
        if (g.taken) { if (e) e.stopPropagation(); this._set(g.name, g.v, true); }
      };
      R.addEventListener('pointerdown', (e) => {
        const el = e.composedPath().find((n) => n.classList && n.classList.contains('sl'));
        if (!el || e.button) return;
        const d = el.dataset, v0 = Number(d.v);
        this._sl = { el, id: e.pointerId, x0: e.clientX, y0: e.clientY, v0, v: v0, name: d.name, min: Number(d.min), max: Number(d.max), step: Number(d.step) || 1, w: Math.max(40, el.getBoundingClientRect().width - 22), taken: false };
      });
      R.addEventListener('pointermove', (e) => {
        const g = this._sl;
        if (!g || e.pointerId !== g.id) return;
        const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
        if (!g.taken) {
          if (Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy)) {
            g.taken = true; g.x0 = e.clientX; // ingen hopp ved overtakelse
            try { g.el.setPointerCapture(e.pointerId); } catch (x) { /* */ }
            g.el.classList.add('drag');
          } else if (Math.abs(dy) > 6) { this._sl = null; return; } // loddrett: arket scroller
          else return;
        }
        e.stopPropagation(); if (e.cancelable) e.preventDefault();
        const raw = g.v0 + ((e.clientX - g.x0) / g.w) * (g.max - g.min);
        const v = M.clamp(Math.round((raw - g.min) / g.step) * g.step + g.min, g.min, g.max);
        const vv = Number(v.toFixed(4));
        if (vv !== g.v) { g.v = vv; this._set(g.name, vv, false); }
      });
      R.addEventListener('pointerup', end);
      R.addEventListener('pointercancel', (e) => { const g = this._sl; if (g && e.pointerId === g.id && !g.taken) { this._sl = null; return; } end(e); });
      // Etter overtakelse: ikke la Bubble Card / arket få touch-bevegelsen
      ['touchmove'].forEach((t) => R.addEventListener(t, (e) => { if (this._sl && this._sl.taken) e.stopPropagation(); }, { passive: true }));
    }
    // «Lagrer …» / «Lagret» / «Kunne ikke lagre»: liten pille i tittelraden – oppdateres direkte uten ny render.
    // «Lagret» vises i 1,5 s. Pillen har fast plass (bare opasitet endres), så den dytter ingenting.
    _setStatus(t, kind) {
      this.status = t; this.statusKind = kind || '';
      this._statOn = !!t;
      clearTimeout(this._statT);
      if (kind === 'ok') this._statT = setTimeout(() => { this._statOn = false; const e = this.shadowRoot && this.shadowRoot.querySelector('.stat'); if (e) e.classList.remove('on'); }, 1500);
      const el = this.shadowRoot && this.shadowRoot.querySelector('.stat');
      if (!el) return;
      if (el.textContent !== (t || '')) el.textContent = t || '';
      el.className = `stat ${this.statusKind}${this._statOn ? ' on' : ''}`;
    }
    // Ferdig mens lagringen pågår: deaktivert + spinner (MSH.draftBusy). Settes direkte, og tegnes likt ved ny render.
    _setBusy(b) {
      this._busy = !!b;
      const el = this.shadowRoot && this.shadowRoot.querySelector('[data-a="save"]');
      if (!el) return;
      el.disabled = this._busy; el.toggleAttribute('aria-busy', this._busy);
      el.innerHTML = this._saveBtnInner();
    }
    _saveBtnInner() { return this._busy ? '<span class="spin" aria-hidden="true"></span>Lagrer …' : `${M.icon('mdi:check', 20)}Ferdig`; }
    connectedCallback() { this._glassSync(); }
    // Liquid glass-UTSEENDET: kun i et glassark (MSH.overlay med Liquid Glass-tema → vertens data-glass).
    // Segmentvelgerne får Liquid Glass-drag (linse ved trykk og dra) ALLTID, også i standardarket og GUI-editoren (Fiks 15.2).
    _glassSync() {
      const rn = this.getRootNode && this.getRootNode(), gh = rn && rn.host;
      const glass = !!(this._inline && gh && gh.hasAttribute && gh.hasAttribute('data-glass'));
      if (glass !== this.hasAttribute('glass')) this.toggleAttribute('glass', glass);
      if (M.glassDrag && this.shadowRoot) this.shadowRoot.querySelectorAll('.chips.sg').forEach((sg) => M.glassDrag(sg, { axis: 'x' }));
    }
    set hass(h) { const first = !this._hass; this._hass = h; if (first) this._render(); }
    get hass() { return this._hass; }
    setConfig(c) { this._config = { ...(!this._inline && window.MSH.effectiveConfig ? window.MSH.effectiveConfig(c, null, { shared: true }) : c) }; this._render(); } // GUI-editoren: felles oppsett (uten enhetslaget)
    get schema() {
      const cls = this.cardClass;
      let s = cls && cls.schema;
      if (typeof s === 'function') s = s(this._hass, this._config || {});
      return s || [];
    }
    _set(path, v, commit = true) {
      let c = set(this._config || {}, path, v);
      if (!c.card_id) c.card_id = M.uid();
      c = clean(c);
      this._config = c;
      if (!this._inline) { this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: c }, bubbles: true, composed: true })); if (M.store && c.card_id && M.store.card(c.card_id)) M.store.setCard(c.card_id, c); } // GUI ↔ egen editor
      else this.dispatchEvent(new CustomEvent('msh-change', { detail: { config: c, commit } })); // live; commit=false under slider-drag
      this._render();
    }
    _render() {
      if (!this._config || !this._hass) return;
      if (M.pickerBusy && M.pickerBusy(this.shadowRoot)) return; // native velger har fokus (09-pickers) – tegnes ved blur
      const cls = this.cardClass || {};
      const body = this.schema.map((f, i) => this._field(f, 'r' + i)).join('');
      const html = `<style>${ED_CSS}${M.STEPPER_CSS || ''}.f.stp{padding:0}</style><div class="wrap">
        ${this._inline ? `<div class="ttl">${M.icon('mdi:tune', 22)}<span class="tt">${esc(cls.cardName ? 'Tilpass · ' + cls.cardName : 'Tilpass')}</span><span class="stat ${this.statusKind || ''}${this._statOn ? ' on' : ''}" role="status" aria-live="polite">${esc(this.status || '')}</span></div>` : ''}
        ${body || '<div class="small">Ingen innstillinger.</div>'}
        ${!this._inline && M.store && M.isPerDevice && M.isPerDevice(this._config, null) ? '<div class="small">Enheter kan ha eget oppsett i dashbordet («Tilpass …» → Denne enheten). Her endres felles oppsett.</div>' : ''}
        ${this._inline ? `<div class="actions"><button class="btn" data-a="cancel">Avbryt</button><button class="btn pri" data-a="save" ${this._busy ? 'disabled aria-busy' : ''}>${this._saveBtnInner()}</button></div>` : ''}
      </div>`;
      if (!this._did) { this.shadowRoot.innerHTML = html; this._did = true; if (M.bindSteppers) M.bindSteppers(this.shadowRoot, this); } else M.morph(this.shadowRoot, html);
      this._glassSync();
      this.shadowRoot.querySelectorAll('ha-icon-picker').forEach((p) => { p.hass = this._hass; const v = get(this._config, p.dataset.name) || ''; if (p.value !== v) p.value = v; });
      this.shadowRoot.querySelectorAll('ha-selector').forEach((p) => {
        p.hass = this._hass;
        if (p.dataset.selector !== p.__selJson) { p.__selJson = p.dataset.selector; p.selector = JSON.parse(p.dataset.selector); }
        p.label = p.dataset.label || ''; p.helper = p.dataset.helper || ''; p.required = false;
        const raw = this._val ? this._val(p.dataset.name) : get(this._config, p.dataset.name), v = raw != null ? raw : (p.dataset.def !== undefined && p.dataset.def !== '' ? Number(p.dataset.def) : undefined);
        if (p.value !== v) p.value = v;
      });
      this.shadowRoot.querySelectorAll('msh-entity-picker').forEach((p) => { p.hass = this._hass; });
      if (this.focusSection && !this._focused) {
        this._focused = true;
        const el = this.shadowRoot.querySelector(`[data-focus="${CSS.escape ? CSS.escape(this.focusSection) : this.focusSection}"]`);
        if (el) { el.open = true; if (el.dataset.sec) this._open[el.dataset.sec] = true; el.scrollIntoView({ block: 'start' }); }
      }
    }
    _field(f, key) {
      const h = this._hass, c = this._config;
      const val = f.name ? get(c, f.name) : undefined;
      const auto = f.auto ? (() => { try { return f.auto(h, c); } catch (e) { return null; } })() : null;
      const lab = f.label ? `<label>${esc(f.label)}</label>` : '';
      const help = f.help ? `<span class="help">${esc(f.help)}</span>` : '';
      switch (f.type) {
        case 'section': {
          const sk = f.id ? 'id:' + f.id : key; // stabil nøkkel for åpen-tilstanden
          const open = (!this._focused && this.focusSection && f.id === this.focusSection) || (this._open[sk] != null ? this._open[sk] : !!f.open);
          return `<details class="sec" data-sec="${esc(sk)}" ${f.id ? `data-focus="${esc(f.id)}"` : ''} ${open ? 'open' : ''}><summary>${f.icon ? M.icon(f.icon, 20) : ''}${esc(f.label)}${f.meta ? `<span class="meta">${esc(typeof f.meta === 'function' ? (() => { try { return f.meta(h, c); } catch (e) { return ''; } })() : f.meta)}</span>` : ''}<span class="chev">${M.icon('mdi:chevron-down', 20)}</span></summary><div class="in">${(f.fields || []).map((x, j) => this._field(x, key + '_' + j)).join('')}</div></details>`;
        }
        case 'boolean': {
          if (f.get && f.set) { // verdi utenfor kort-configen (f.eks. ki-store ui.glass_anim, Fiks 17.18): f.get(hass, cfg) / f.set(v, hass, cfg)
            (this._btns = this._btns || {})[key] = f;
            const on2 = !!f.get(h, c);
            return `<div class="f"><div class="line"><span style="flex:1;font-size:13px">${esc(f.label)}</span><button class="sw ${on2 ? 'on' : ''}" role="switch" aria-checked="${on2}" data-a="boolfn" data-k="${esc(key)}" data-v="${on2 ? 0 : 1}"></button></div>${help}</div>`;
          }
          const on = val != null ? !!val : !!f.default;
          return `<div class="f"><div class="line"><span style="flex:1;font-size:13px">${esc(f.label)}</span><button class="sw ${on ? 'on' : ''}" role="switch" data-a="bool" data-name="${esc(f.name)}" data-v="${on ? 0 : 1}"></button></div>${help}</div>`;
        }
        case 'select': {
          const cur = val != null ? String(val) : f.default != null ? String(f.default) : '';
          return `<div class="f">${lab}<div class="chips sg">${(f.options || []).map(([v, l]) => `<button class="chip ${String(v) === cur ? 'on' : ''}" aria-selected="${String(v) === cur}" data-a="sel" data-name="${esc(f.name)}" data-v="${esc(v)}" data-num="${typeof v === 'number' ? 1 : 0}">${esc(l)}</button>`).join('')}</div>${help}</div>`;
        }
        case 'gap': {
          const cur = c.gap != null ? Number(c.gap) : 8;
          return `<div class="f"><label>Mellomrom</label><div class="chips sg">${[[4, 'Tett'], [8, 'Standard'], [18, 'Luftig']].map(([v, l]) => `<button class="chip ${v === cur ? 'on' : ''}" aria-selected="${v === cur}" data-a="sel" data-name="gap" data-v="${v}" data-num="1">${l} ${v}</button>`).join('')}</div></div>`;
        }
        case 'range': {
          const cur = val != null ? Number(val) : f.default;
          if (!this._inline && customElements.get('ha-selector')) {
            const sel = { number: { min: f.min, max: f.max, step: f.step || 1, mode: 'slider', unit_of_measurement: f.unit || 'px' } };
            return `<div class="f"><ha-selector data-name="${esc(f.name)}" data-nomorph data-def="${f.default != null ? f.default : ''}" data-selector="${esc(JSON.stringify(sel))}" data-label="${esc(f.label || '')}" data-helper="${esc(f.help || (f.default != null ? 'Standard ' + f.default + ' ' + (f.unit || 'px') : ''))}"></ha-selector></div>`;
          }
          const pills = (f.presets || []).map(([v, l]) => `<button class="pill ${Number(v) === cur ? 'on' : ''}" data-a="sel" data-num="1" data-name="${esc(f.name)}" data-v="${v}">${esc(l)}</button>`).join('');
          const v = cur != null ? cur : f.min, fr = f.max > f.min ? M.clamp((v - f.min) / (f.max - f.min), 0, 1) : 0;
          const drag = this._sl && this._sl.taken && this._sl.name === f.name;
          return `<div class="f rg"><div class="line">${f.icon ? M.icon(f.icon, 20, 'color:#afafaf') : ''}<span style="flex:1;font-size:13px">${esc(f.label)}</span><span class="rv">${cur != null ? cur : '–'} ${esc(f.unit || 'px')}</span></div>
            <div class="sl${drag ? ' drag' : ''}" data-key="sl-${esc(f.name)}" data-name="${esc(f.name)}" data-v="${v}" data-min="${f.min}" data-max="${f.max}" data-step="${f.step || 1}" style="--f:${fr.toFixed(4)};--p:${(fr * 100).toFixed(2)}%"><div class="tr"><div class="fi"></div></div><div class="th"></div>
              <input type="range" aria-label="${esc(f.label || f.name)}" data-name="${esc(f.name)}" data-num="1" data-range="1" min="${f.min}" max="${f.max}" step="${f.step || 1}" value="${v}"></div>
            ${pills ? `<div class="chips">${pills}</div>` : ''}${help}</div>`;
        }
        case 'stepper': { // verdien til en entitet (number/input_number/time/date/datetime/input_datetime) – skrives rett til HA
          const id = typeof f.entity === 'function' ? (() => { try { return f.entity(h, c); } catch (e) { return null; } })() : f.entity || val || auto;
          return `<div class="f stp">${M.stepperHTML(h, id, { label: f.label || (id ? M.name(h, id) : 'Velg entitet'), sub: f.help, unit: f.unit, min: f.min, max: f.max, step: f.step, key: 'stp-' + key })}</div>`;
        }
        case 'number':
          return `<div class="f">${lab}<input class="inp" type="number" inputmode="decimal" data-name="${esc(f.name)}" data-num="1" value="${val != null ? esc(val) : ''}" placeholder="${esc(auto != null ? auto : f.placeholder || f.default || '')}" ${f.min != null ? `min="${f.min}"` : ''} ${f.max != null ? `max="${f.max}"` : ''} ${f.step != null ? `step="${f.step}"` : ''}>${help}</div>`;
        case 'text':
          return `<div class="f">${lab}<input class="inp" autocapitalize="off" autocorrect="off" spellcheck="false" inputmode="text" data-name="${esc(f.name)}" value="${val != null ? esc(val) : ''}" placeholder="${esc(auto != null ? auto : f.placeholder || '')}">${help}</div>`;
        case 'hash': { // forslag: alle popups inkl. egne (MSH.allPopups)
          // Fiks 17.8: HAs GUI-editor → ha-selector select (samme liste, egen verdi); dashbordets ark → popup-velgeren (09-tap-picker)
          if (M.popupPicker && !this._inline && customElements.get('ha-selector')) return `<div class="f"><ha-selector data-name="${esc(f.name)}" data-nomorph data-selector="${esc(JSON.stringify(M.popupPicker.selector(this._hass)))}" data-label="${esc(f.label || 'Popup')}" data-helper="${esc(f.help || (auto || f.placeholder ? 'Standard ' + (auto || f.placeholder) : ''))}"></ha-selector></div>`;
          if (M.popupPicker) return `<div class="f">${lab}${M.popupPicker.html({ key: 'ph-' + key, name: f.name, value: val || '', placeholder: auto || f.placeholder || '', label: f.label })}${help}</div>`;
          const dl = 'hl-' + key, opts = M.popupOptions ? M.popupOptions(this._hass) : [];
          return `<div class="f">${lab}<input class="inp" autocapitalize="off" autocorrect="off" spellcheck="false" inputmode="text" data-name="${esc(f.name)}" list="${dl}" value="${val != null ? esc(val) : ''}" placeholder="${esc(auto != null ? auto : f.placeholder || '')}"><datalist id="${dl}">${opts.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('')}</datalist>${help}</div>`;
        }
        case 'icon':
          // HAs GUI-editor: ha-icon-picker. Dashbordets egne ark (inline): felles søkbar ikonvelger (09-icon-picker, Fiks 15.7)
          if (!this._inline && customElements.get('ha-icon-picker')) return `<div class="f">${lab}<ha-icon-picker data-name="${esc(f.name)}" data-nomorph placeholder="${esc(auto || f.placeholder || '')}"></ha-icon-picker>${help}</div>`;
          if (M.iconPicker) return `<div class="f">${lab}${M.iconPicker.html({ key: 'ic-' + key, name: f.name, value: val || '', placeholder: auto || f.placeholder || '', label: f.label })}${help}</div>`;
          return `<div class="f">${lab}<div class="line">${M.icon(val || auto || 'mdi:help', 22)}<input class="inp" autocapitalize="off" autocorrect="off" spellcheck="false" inputmode="text" data-name="${esc(f.name)}" value="${esc(val || '')}" placeholder="${esc(auto || 'mdi:… / phu:… / hue:…')}"></div>${help}</div>`;
        case 'tap': // trykk-handling i HA-format (09-tap-picker, Fiks 15.6): { action: navigate|url|more-info|none … }; auto = standard
          if (M.tap) return `<div class="f">${lab}${M.tap.html({ key: 'tap-' + key, value: val || auto || null, modes: f.modes, labels: f.labels, stdHint: f.stdHint, attrs: `data-name="${esc(f.name)}"` })}${help}</div>`;
          return '';
        case 'color':
          return this._color(f, val, auto);
        case 'entity':
        case 'area':
          return this._entity(f, f.name, val, auto, key);
        case 'entities': {
          const list = Array.isArray(val) ? val : [];
          // f.multiple: HA GUI-editor → ha-selector entity { domain: [...], multiple: true } (kortets eget ark har egen velger)
          if (f.multiple && !this._inline && customElements.get('ha-selector')) {
            const sel = { entity: { multiple: true, ...(f.domains || f.domain ? { domain: [].concat(f.domains || f.domain) } : {}) } };
            return `<div class="f"><ha-selector data-name="${esc(f.name)}" data-nomorph data-selector="${esc(JSON.stringify(sel))}" data-label="${esc(f.label || '')}" data-helper="${esc(f.help || '')}"></ha-selector></div>`;
          }
          if (f.addLabel) {
            return `<div class="f">${lab}${list.map((id, i) => this._entRow(id, `<button class="ib" data-a="rmlist" data-name="${esc(f.name)}" data-i="${i}" title="Fjern">${M.icon('mdi:minus-circle-outline', 20)}</button>`)).join('')}
              ${this._picker(f, f.name, '', null, key, 'add')}${help}</div>`;
          }
          return `<div class="f">${lab}${list.map((id, i) => this._entRow(id, `<button class="ib" data-a="rmlist" data-name="${esc(f.name)}" data-i="${i}" title="Fjern">${M.icon('mdi:close', 18)}</button>`)).join('')}${this._search(f, key, 'addlist', f.name)}${help}</div>`;
        }
        case 'overrides':
          return `<details class="sec" data-sec="${key}" data-focus="overrides" ${this._open[key] || this.focusSection === 'overrides' ? 'open' : ''}><summary>${M.icon('mdi:swap-horizontal', 20)}${esc(f.label || 'Bytt entiteter')}<span class="chev">${M.icon('mdi:chevron-down', 20)}</span></summary><div class="in">${(f.fields || []).map((x, j) => {
            const a = x.auto ? (() => { try { return x.auto(h, c); } catch (e) { return null; } })() : null;
            return this._entity({ ...x, help: x.help || (a ? 'Auto: ' + a : 'Auto: fant ingen') }, 'overrides.' + x.name, get(c, 'overrides.' + x.name), a, key + '_' + j);
          }).join('')}</div></details>`;
        case 'lists':
          return this._lists(f, key);
        case 'order':
          return this._order(f);
        case 'button':
          (this._btns = this._btns || {})[key] = f;
          return `<button class="btn" style="height:48px" data-a="run" data-k="${key}">${f.icon ? M.icon(f.icon, 20) : ''}${esc(f.label)}</button>${help}`;
        case 'action':
          return this._action(f, val, key);
        case 'info':
          return `<div class="small" style="padding:0 6px">${esc(f.label)}</div>`;
        case 'html': // egen HTML fra kortet (Fiks 17.22): f.html(hass, cfg, key, editor); knapper med data-a="fn" data-k=key → f.click(dataset, editor)
          (this._htmlF = this._htmlF || {})[key] = f;
          try { return f.html(h, c, key, this) || ''; } catch (e) { return ''; }
        default:
          return '';
      }
    }
    // Handling (HA action-format) med modusvalg: Standard · Åpne app · Send kommando · HA-handling · Ingen.
    // f: { name, label, help, std: 'Standard-etikett' (utelat = ingen standard → «Ingen» er tom verdi), apps: [navn], cmdPlaceholder }
    // Lagres som { action:'none' } | perform-action media_player.select_source {data.source} | remote.send_command {data.command}
    // (uten target – kortet fyller inn spiller/remote) | vilkårlig HA-handling (ui_action-selector).
    _action(f, val, key) {
      const std = f.std != null, a = val && typeof val === 'object' ? val : null;
      const pa = a && (a.perform_action || a.service), tgt = a && a.target && Object.keys(a.target).length;
      const mode = !a ? (std ? 'std' : 'none') : a.action === 'none' ? 'none'
        : (a.action === 'perform-action' || a.action === 'call-service') && pa === 'media_player.select_source' && !tgt ? 'app'
          : (a.action === 'perform-action' || a.action === 'call-service') && pa === 'remote.send_command' && !tgt ? 'cmd' : 'ha';
      const apps = (f.apps || []).filter(Boolean);
      const V = {
        std: undefined, none: std ? { action: 'none' } : undefined,
        app: { action: 'perform-action', perform_action: 'media_player.select_source', data: { source: apps[0] || '' } },
        cmd: { action: 'perform-action', perform_action: 'remote.send_command', data: { command: '' } },
        ha: { action: 'perform-action', perform_action: '' },
      };
      const modes = [...(std ? [['std', f.std]] : []), ['app', 'Åpne app'], ['cmd', 'Send kommando'], ['ha', 'HA-handling'], ['none', 'Ingen']];
      const chip = ([m, l]) => `<button class="chip ${m === mode ? 'on' : ''}" data-a="sel" data-name="${esc(f.name)}" data-json="1" data-v="${esc(JSON.stringify(m === mode && a ? a : V[m] === undefined ? null : V[m]))}">${esc(l)}</button>`;
      let sub = '';
      if (mode === 'app') {
        const cur = (a.data && a.data.source) || '';
        sub = apps.length ? `<div class="chips">${[...new Set([...apps, ...(cur && !apps.includes(cur) ? [cur] : [])])].map((n) => `<button class="pill ${n === cur ? 'on' : ''}" data-a="sel" data-name="${esc(f.name)}.data.source" data-v="${esc(n)}">${esc(n)}</button>`).join('')}</div>`
          : `<input class="inp" autocapitalize="off" autocorrect="off" spellcheck="false" inputmode="text" data-name="${esc(f.name)}.data.source" value="${esc(cur)}" placeholder="Appnavn (source)">`;
      } else if (mode === 'cmd') {
        sub = `<input class="inp" autocapitalize="off" autocorrect="off" spellcheck="false" inputmode="text" data-name="${esc(f.name)}.data.command" value="${esc((a.data && a.data.command) || '')}" placeholder="${esc(f.cmdPlaceholder || 'Kommando, f.eks. menu')}">`;
      } else if (mode === 'ha') {
        sub = customElements.get('ha-selector')
          ? `<ha-selector data-name="${esc(f.name)}" data-nomorph data-selector="${esc(JSON.stringify({ ui_action: {} }))}" data-label=""></ha-selector>`
          : `<input class="inp" autocapitalize="off" autocorrect="off" spellcheck="false" inputmode="text" data-name="${esc(f.name)}.perform_action" value="${esc(pa || '')}" placeholder="domene.tjeneste, f.eks. script.tv_kveld">`;
      }
      return `<div class="f">${f.label ? `<label>${esc(f.label)}</label>` : ''}<div class="chips sg">${modes.map(chip).join('')}</div>${sub}${f.help ? `<span class="help">${esc(f.help)}</span>` : ''}</div>`;
    }
    _entRow(id, tail, off) {
      const s = this._hass.states[id];
      return `<div class="ent ${off ? 'off' : ''}">${M.icon(M.domainIcon(id, s), 20, 'color:#afafaf')}<span class="nm"><b>${esc(s ? s.attributes.friendly_name || id : id)}</b><i>${esc(id)}${s ? '' : ' · finnes ikke'}</i></span>${tail || ''}</div>`;
    }
    _matches(f, q) {
      const h = this._hass, doms = f.domains || (f.domain ? [].concat(f.domain) : null);
      if (f.type === 'area') return Object.values(h.areas || {}).filter((a) => !q || (a.name + ' ' + a.area_id).toLowerCase().includes(q)).slice(0, 40).map((a) => ({ id: a.area_id, name: a.name }));
      const ql = (q || '').toLowerCase();
      return Object.keys(h.states).filter((id) => (!doms || doms.includes(id.split('.')[0])) && (!f.device_class || h.states[id].attributes.device_class === f.device_class || [].concat(f.device_class).includes(h.states[id].attributes.device_class)) && (!f.platform || (h.entities && h.entities[id] && h.entities[id].platform === f.platform)))
        .filter((id) => !ql || (id + ' ' + (h.states[id].attributes.friendly_name || '')).toLowerCase().includes(ql))
        .sort().slice(0, 40).map((id) => ({ id, name: h.states[id].attributes.friendly_name || id }));
    }
    _search(f, key, act, name, placeholder) {
      const q = this._q[key] || '';
      const open = this._menu === key;
      const items = open ? this._matches(f, q) : [];
      return `<div class="dd"><input class="inp" autocapitalize="off" autocorrect="off" spellcheck="false" inputmode="text" data-search="${key}" data-act="${act}" data-name="${esc(name)}" value="${esc(q)}" placeholder="${esc(placeholder || 'Søk eller skriv entity_id …')}" autocomplete="off">
        ${open ? `<div class="menu">${items.map((x) => `<button data-a="${act}" data-name="${esc(name)}" data-v="${esc(x.id)}" data-key="${esc(x.id)}"><b>${esc(x.name)}</b><i>${esc(x.id)}</i></button>`).join('') || '<div class="small" style="padding:8px">Ingen treff – trykk Enter for å bruke teksten</div>'}</div>` : ''}</div>`;
    }
    _entity(f, name, val, auto, key) {
      const lab = f.label ? `<label>${esc(f.label)}</label>` : '';
      const help = f.help ? `<span class="help">${esc(f.help)}</span>` : '';
      if (f.type === 'area') {
        const cur = val ? `<div class="ent">${M.icon('mdi:texture-box', 20, 'color:#afafaf')}<span class="nm"><b>${esc(M.areaName(this._hass, val))}</b><i>${esc(val)}</i></span><button class="ib" data-a="clear" data-name="${esc(name)}" title="Tilbake til auto">${M.icon('mdi:close', 18)}</button></div>` : '';
        return `<div class="f">${lab}${cur}${this._search(f, key, 'setent', name, val ? 'Bytt …' : auto ? 'Auto: ' + auto : 'Velg område …')}${help}</div>`;
      }
      // HA GUI-editor: ha-selector (entity) med «Automatisk»-hjelpetekst
      if (!this._inline && customElements.get('ha-selector')) {
        const ent = {};
        if (f.domain) ent.domain = f.domain;
        if (f.device_class) ent.device_class = f.device_class;
        return `<div class="f"><ha-selector data-name="${esc(name)}" data-nomorph data-selector="${esc(JSON.stringify({ entity: ent }))}" data-label="${esc(f.label || '')}" data-helper="${esc(val ? '' : 'Automatisk' + (auto ? ' · ' + auto : ' · fant ingen'))}"></ha-selector></div>`;
      }
      // Egen velger (Rom v4): felles <msh-entity-picker> – knapp → inline liste med søk, filter og «Automatisk» først
      const now = f.now && val && this._hass.states[val] ? `<span class="help">Nå: ${esc(M.fmtState(this._hass, val))}</span>` : '';
      return `<div class="f">${lab}${this._picker(f, name, val, auto, key, 'set')}${now}${help}</div>`;
    }
    // Felles entitetsvelger. f.required → ingen «Automatisk»-rad.
    _picker(f, name, val, auto, key, mode) {
      const h = this._hass, c = this._config;
      const area = (typeof f.area === 'function' ? (() => { try { return f.area(h, c); } catch (e) { return null; } })() : f.area) || this.areaCtx || c.area || '';
      return M.entityPicker.html({ key: 'pk-' + key, name, value: val || '', auto: auto || '', autoMode: mode === 'set' && !f.required, domains: f.domains || f.domain || '', deviceClass: f.device_class || '', area, mode, placeholder: mode === 'add' ? f.addLabel : f.placeholder, attrs: mode === 'add' ? 'data-mode="add"' : '' });
    }
    _color(f, val, auto) {
      const cur = val || '';
      const theme = M.THEME_COLORS.map(([k, hex, l]) => { const v = `var(--${k}, ${hex})`; return `<button class="dot ${cur === v || cur === `var(--${k})` ? 'on' : ''}" title="${esc(l)} · --${k}" style="background:${v}" data-a="sel" data-name="${esc(f.name)}" data-v="${esc(v)}"></button>`; }).join('');
      const ha = M.HA_COLORS.map(([k, hex, l]) => { const v = `var(--${k}-color, ${hex})`; return `<button class="dot ${cur === v ? 'on' : ''}" title="${esc(l || k)} · --${k}-color" style="background:${v}" data-a="sel" data-name="${esc(f.name)}" data-v="${esc(v)}"></button>`; }).join('');
      return `<div class="f"><label>${esc(f.label || 'Farge')}</label>
        <span class="help">Tema (My SmartHome v3)</span><div class="sws">${theme}</div>
        <span class="help">HA-farger</span><div class="sws">${ha}</div>
        <div class="line"><span class="dot" style="background:${esc(cur || auto || 'transparent')}"></span><input class="inp" autocapitalize="off" autocorrect="off" spellcheck="false" inputmode="text" data-name="${esc(f.name)}" value="${esc(cur)}" placeholder="${esc(auto || '#hex eller var(--navn)')}"><button class="ib" data-a="clear" data-name="${esc(f.name)}" title="Standard">${M.icon('mdi:restore', 18)}</button></div>
        ${f.help ? `<span class="help">${esc(f.help)}</span>` : ''}</div>`;
    }
    _lists(f, key) {
      const h = this._hass, c = this._config;
      let lists = [];
      try { lists = f.lists(h, c) || []; } catch (e) { lists = []; }
      const ex = new Set(c.exclude || []);
      return `<details class="sec" data-sec="${key}" data-focus="entities" ${this._open[key] || this.focusSection === 'entities' ? 'open' : ''}><summary>${M.icon('mdi:eye-outline', 20)}${esc(f.label || 'Entiteter')}<span class="chev">${M.icon('mdi:chevron-down', 20)}</span></summary><div class="in">
        ${lists.map((L, j) => {
          const inc = (c.include && c.include[L.key]) || [];
          const all = [...new Set([...(L.ids || []), ...inc])];
          return `<div class="f"><div class="line"><label style="flex:1">${esc(L.label)} · ${all.filter((i) => !ex.has(i)).length}/${all.length}</label>
            <button class="chip" data-a="showall" data-k="${esc(L.key)}" data-ids="${esc(all.join(','))}">Vis alle</button><button class="chip" data-a="hideall" data-ids="${esc(all.join(','))}">Skjul alle</button></div>
            ${all.map((id) => this._entRow(id, `${inc.includes(id) ? `<button class="ib" data-a="uninc" data-k="${esc(L.key)}" data-v="${esc(id)}" title="Fjern">${M.icon('mdi:close', 18)}</button>` : ''}<button class="ib" data-a="eye" data-v="${esc(id)}" title="${ex.has(id) ? 'Vis' : 'Skjul'}">${M.icon(ex.has(id) ? 'mdi:eye-off' : 'mdi:eye', 18)}</button>`, ex.has(id))).join('') || '<span class="small">Autokonfig fant ingen</span>'}
            ${this._search({ domains: L.domains, type: 'entity' }, key + '_' + j, 'include', L.key, 'Legg til … (søk eller skriv entity_id)')}</div>`;
        }).join('')}</div></details>`;
    }
    _order(f) {
      const c = this._config;
      const keys = f.options.map((o) => o[0]);
      let order = Array.isArray(get(c, f.name)) ? get(c, f.name).filter((k) => keys.includes(k)) : [];
      keys.forEach((k) => { if (!order.includes(k)) order.push(k); });
      const hid = new Set(get(c, f.hiddenName) || []);
      const lab = Object.fromEntries(f.options);
      // Valgfritt: f.openName/openKeys/openDefault(cfg, key) → bryter «Åpen ved start» per rad; f.after = felt under radene
      const opn = (k) => {
        if (!f.openName || !(f.openKeys || []).includes(k)) return '';
        const v = get(c, f.openName + '.' + k), on = v != null ? !!v : !!(f.openDefault && f.openDefault(c, k));
        return `<button class="sw ${on ? 'on' : ''}" role="switch" aria-checked="${on}" title="Åpen ved start" aria-label="${esc(lab[k])}: åpen ved start" data-a="bool" data-name="${esc(f.openName + '.' + k)}" data-v="${on ? 0 : 1}" ${hid.has(k) ? 'disabled' : ''} style="transform:scale(.85)"></button>`;
      };
      const after = (f.after || []).map((x, j) => (x.type === 'boolean' && x.on != null
        ? (() => { const on = get(c, x.name) === x.on; return `<div class="f"><div class="line"><span style="flex:1;font-size:13px">${esc(x.label)}</span><button class="sw ${on ? 'on' : ''}" role="switch" aria-checked="${on}" data-a="sel" data-name="${esc(x.name)}" data-v="${esc(on ? x.off : x.on)}"></button></div>${x.help ? `<div class="small">${esc(x.help)}</div>` : ''}</div>`; })()
        : this._field(x, 'ord_' + f.name + '_' + j))).join('');
      return `<details class="sec" data-sec="ord_${esc(f.name)}" data-focus="sections" ${this._open['ord_' + f.name] || this.focusSection === 'sections' ? 'open' : ''}><summary>${M.icon('mdi:view-agenda-outline', 20)}${esc(f.label || 'Seksjoner')}<span class="chev">${M.icon('mdi:chevron-down', 20)}</span></summary><div class="in">
        ${f.openName ? '<div class="small" style="padding:0 6px">Bryteren = «Åpen ved start»: seksjonen er utvidet hver gang popupen åpnes. Øye = vis/skjul, piler = rekkefølge.</div>' : ''}
        ${order.map((k, i) => `<div class="ordrow ${hid.has(k) ? 'off' : ''}" style="${hid.has(k) ? 'opacity:.5' : ''}"><span style="flex:1;font-size:13px">${esc(lab[k])}</span>${opn(k)}
          <button class="ib" data-a="mv" data-name="${esc(f.name)}" data-ord="${esc(order.join(','))}" data-i="${i}" data-d="-1" ${i ? '' : 'disabled style="opacity:.3"'}>${M.icon('mdi:chevron-up', 20)}</button>
          <button class="ib" data-a="mv" data-name="${esc(f.name)}" data-ord="${esc(order.join(','))}" data-i="${i}" data-d="1" ${i < order.length - 1 ? '' : 'disabled style="opacity:.3"'}>${M.icon('mdi:chevron-down', 20)}</button>
          <button class="ib" data-a="hid" data-name="${esc(f.hiddenName)}" data-v="${esc(k)}">${M.icon(hid.has(k) ? 'mdi:eye-off' : 'mdi:eye', 18)}</button></div>`).join('')}
        ${after}</div></details>`;
    }
    _click(e) {
      const b = e.composedPath().find((n) => n.dataset && n.dataset.a);
      if (!b) { if (!e.composedPath().some((n) => n.dataset && n.dataset.search)) { if (this._menu) { this._menu = null; this._render(); } } return; }
      const d = b.dataset, c = this._config;
      if (b.classList && b.classList.contains('pill')) M.haptic('light'); // bare snarvalg gir haptic
      switch (d.a) {
        case 'run': { const f = (this._btns || {})[d.k]; if (f && f.run) Promise.resolve(f.run(this._hass, this._config, this)).catch((e) => M.toast('Feil: ' + e.message)); return; }
        case 'bool': return this._set(d.name, d.v === '1');
        case 'boolfn': { const f = (this._btns || {})[d.k]; if (f && f.set) { M.haptic('selection'); f.set(d.v === '1', this._hass, this._config, this); } return this._render(); }
        case 'sel': return this._set(d.name, d.json === '1' ? JSON.parse(d.v) : d.num === '1' ? Number(d.v) : d.v);
        case 'clear': this._menu = null; return this._set(d.name, undefined);
        case 'setent': this._menu = null; this._q = {}; return this._set(d.name, d.v);
        case 'addlist': { this._menu = null; this._q = {}; const l = [...(get(c, d.name) || [])]; if (!l.includes(d.v)) l.push(d.v); return this._set(d.name, l); }
        case 'rmlist': { const l = [...(get(c, d.name) || [])]; l.splice(Number(d.i), 1); return this._set(d.name, l); }
        case 'include': { this._menu = null; this._q = {}; const l = [...((c.include || {})[d.name] || [])]; if (!l.includes(d.v)) l.push(d.v); const ex = (c.exclude || []).filter((x) => x !== d.v); this._config = { ...c, exclude: ex }; return this._set('include.' + d.name, l); }
        case 'uninc': { const l = ((c.include || {})[d.k] || []).filter((x) => x !== d.v); return this._set('include.' + d.k, l); }
        case 'eye': { const ex = new Set(c.exclude || []); ex.has(d.v) ? ex.delete(d.v) : ex.add(d.v); return this._set('exclude', [...ex]); }
        case 'showall': { const ids = new Set(d.ids.split(',')); return this._set('exclude', (c.exclude || []).filter((x) => !ids.has(x))); }
        case 'hideall': { const ex = new Set(c.exclude || []); d.ids.split(',').filter(Boolean).forEach((x) => ex.add(x)); return this._set('exclude', [...ex]); }
        case 'mv': { const o = d.ord.split(','), i = Number(d.i), j = i + Number(d.d); if (j < 0 || j >= o.length) return; [o[i], o[j]] = [o[j], o[i]]; M.haptic('selection'); return this._set(d.name, o); }
        case 'hid': { const hs = new Set(get(c, d.name) || []); hs.has(d.v) ? hs.delete(d.v) : hs.add(d.v); return this._set(d.name, [...hs]); }
        case 'save': if (this._busy || b.disabled) return; return this.dispatchEvent(new CustomEvent('msh-save', { detail: { config: this._config } }));
        case 'cancel': M.haptic('light'); return this.dispatchEvent(new CustomEvent('msh-cancel'));
        case 'fn': { const f = (this._htmlF || {})[d.k]; if (f && f.click) f.click(d, this); return; }
        default:
      }
    }
    _input(e) {
      const t = e.target;
      if (t.dataset.range) { const v = Number(t.value); if (v !== get(this._config, t.dataset.name)) { this._set(t.dataset.name, v, false); } return; }
      if (t.dataset.search) { this._q[t.dataset.search] = t.value; this._menu = t.dataset.search; this._render(); }
    }
    _change(e) {
      const t = e.target;
      if (t.dataset.search) {
        const v = t.value.trim();
        if (/^[a-z_]+\.[a-z0-9_]+$/.test(v)) {
          const act = t.dataset.act, name = t.dataset.name;
          this._q = {}; this._menu = null;
          if (act === 'setent') return this._set(name, v);
          if (act === 'addlist') { const l = [...(get(this._config, name) || [])]; if (!l.includes(v)) l.push(v); return this._set(name, l); }
          if (act === 'include') { const l = [...((this._config.include || {})[name] || [])]; if (!l.includes(v)) l.push(v); return this._set('include.' + name, l); }
        }
        return;
      }
      if (!t.dataset.name) return;
      let v = t.value;
      if (t.dataset.num === '1') v = v === '' ? undefined : Number(v);
      this._set(t.dataset.name, v === '' ? undefined : v);
    }
  }
  customElements.define('msh-editor', MshEditor);
})();
