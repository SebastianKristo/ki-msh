/* KI MSH · felles editor (msh-editor)
 * Brukes både som HA GUI-editor (getConfigElement → config-changed) og som kortets egen
 * tilpasningsmeny (MshCard.customize → msh-save). Samme skjema, samme config – config er sannheten.
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

  const ED_CSS = `
    :host{display:block;font-family:${M.FONT};color:#fafafa;--ed-bg:#2f2f2f}
    *{box-sizing:border-box}
    button,input,select{font:inherit;color:inherit;border:0;background:none;padding:0;margin:0;cursor:pointer}
    input,select{cursor:text;outline:none}
    select{cursor:pointer}
    .wrap{display:flex;flex-direction:column;gap:10px;padding:${'4px 0'};background:transparent}
    :host(:not([inline])) .wrap{padding:12px;border-radius:24px;background:#282828}
    .ttl{font-size:18px;font-weight:500;padding:4px 4px 6px;display:flex;align-items:center;gap:10px}
    .sec{border-radius:20px;background:#3a3a3a;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.05);overflow:hidden}
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
    .actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;position:sticky;bottom:0;padding-top:6px}
    .btn{height:52px;border-radius:26px;background:#3a3a3a;font-weight:500;font-size:14px;display:flex;align-items:center;justify-content:center;gap:8px}
    .btn.pri{background:linear-gradient(145deg, rgb(242 133 201) -10%, rgb(245 205 198) 100%);color:#2a1720}
    .small{font-size:12px;color:#979797}
    .ordrow{display:flex;align-items:center;gap:6px;height:44px;padding:0 4px 0 12px;border-radius:12px;background:#2f2f2f}
    ha-icon-picker{display:block}
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
      this.shadowRoot.addEventListener('toggle', (e) => { const d = e.target; if (d.dataset && d.dataset.sec != null) this._open[d.dataset.sec] = d.open; }, true);
      this.shadowRoot.addEventListener('value-changed', (e) => {
        const t = e.target;
        if (t.dataset && t.dataset.name) { e.stopPropagation(); this._set(t.dataset.name, e.detail.value || undefined); }
      });
    }
    set inline(v) { this._inline = v; if (v) this.setAttribute('inline', ''); }
    set hass(h) { const first = !this._hass; this._hass = h; if (first) this._render(); }
    get hass() { return this._hass; }
    setConfig(c) { this._config = { ...c }; this._render(); }
    get schema() {
      const cls = this.cardClass;
      let s = cls && cls.schema;
      if (typeof s === 'function') s = s(this._hass, this._config || {});
      return s || [];
    }
    _set(path, v) {
      let c = set(this._config || {}, path, v);
      if (!c.card_id) c.card_id = M.uid();
      c = clean(c);
      this._config = c;
      if (!this._inline) this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: c }, bubbles: true, composed: true }));
      this._render();
    }
    _render() {
      if (!this._config || !this._hass) return;
      const cls = this.cardClass || {};
      const body = this.schema.map((f, i) => this._field(f, 'r' + i)).join('');
      const html = `<style>${ED_CSS}</style><div class="wrap">
        ${this._inline ? `<div class="ttl">${M.icon('mdi:tune', 22)}${esc(cls.cardName ? 'Tilpass · ' + cls.cardName : 'Tilpass')}</div>` : ''}
        ${body || '<div class="small">Ingen innstillinger.</div>'}
        ${this._inline ? `<div class="actions"><button class="btn" data-a="cancel">Avbryt</button><button class="btn pri" data-a="save">${M.icon('mdi:check', 20)}Lagre</button></div>` : ''}
      </div>`;
      if (!this._did) { this.shadowRoot.innerHTML = html; this._did = true; } else M.morph(this.shadowRoot, html);
      this.shadowRoot.querySelectorAll('ha-icon-picker').forEach((p) => { p.hass = this._hass; const v = get(this._config, p.dataset.name) || ''; if (p.value !== v) p.value = v; });
      if (this.focusSection && !this._focused) {
        this._focused = true;
        const el = this.shadowRoot.querySelector(`[data-focus="${CSS.escape ? CSS.escape(this.focusSection) : this.focusSection}"]`);
        if (el) { el.open = true; el.scrollIntoView({ block: 'start' }); }
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
          const open = this._open[key] != null ? this._open[key] : (f.open || (this.focusSection && f.id === this.focusSection));
          return `<details class="sec" data-sec="${key}" ${f.id ? `data-focus="${esc(f.id)}"` : ''} ${open ? 'open' : ''}><summary>${f.icon ? M.icon(f.icon, 20) : ''}${esc(f.label)}<span class="chev">${M.icon('mdi:chevron-down', 20)}</span></summary><div class="in">${(f.fields || []).map((x, j) => this._field(x, key + '_' + j)).join('')}</div></details>`;
        }
        case 'boolean': {
          const on = val != null ? !!val : !!f.default;
          return `<div class="f"><div class="line"><span style="flex:1;font-size:13px">${esc(f.label)}</span><button class="sw ${on ? 'on' : ''}" role="switch" data-a="bool" data-name="${esc(f.name)}" data-v="${on ? 0 : 1}"></button></div>${help}</div>`;
        }
        case 'select': {
          const cur = val != null ? String(val) : f.default != null ? String(f.default) : '';
          return `<div class="f">${lab}<div class="chips">${(f.options || []).map(([v, l]) => `<button class="chip ${String(v) === cur ? 'on' : ''}" data-a="sel" data-name="${esc(f.name)}" data-v="${esc(v)}" data-num="${typeof v === 'number' ? 1 : 0}">${esc(l)}</button>`).join('')}</div>${help}</div>`;
        }
        case 'gap': {
          const cur = c.gap != null ? Number(c.gap) : 8;
          return `<div class="f"><label>Mellomrom</label><div class="chips">${[[4, 'Tett'], [8, 'Standard'], [18, 'Luftig']].map(([v, l]) => `<button class="chip ${v === cur ? 'on' : ''}" data-a="sel" data-name="gap" data-v="${v}" data-num="1">${l} ${v}</button>`).join('')}</div></div>`;
        }
        case 'number':
          return `<div class="f">${lab}<input class="inp" type="number" data-name="${esc(f.name)}" data-num="1" value="${val != null ? esc(val) : ''}" placeholder="${esc(auto != null ? auto : f.placeholder || f.default || '')}" ${f.min != null ? `min="${f.min}"` : ''} ${f.max != null ? `max="${f.max}"` : ''} ${f.step != null ? `step="${f.step}"` : ''}>${help}</div>`;
        case 'text':
        case 'hash':
          return `<div class="f">${lab}<input class="inp" data-name="${esc(f.name)}" value="${val != null ? esc(val) : ''}" placeholder="${esc(auto != null ? auto : f.placeholder || '')}">${help}</div>`;
        case 'icon':
          if (customElements.get('ha-icon-picker')) return `<div class="f">${lab}<ha-icon-picker data-name="${esc(f.name)}" data-nomorph placeholder="${esc(auto || f.placeholder || '')}"></ha-icon-picker>${help}</div>`;
          return `<div class="f">${lab}<div class="line">${M.icon(val || auto || 'mdi:help', 22)}<input class="inp" data-name="${esc(f.name)}" value="${esc(val || '')}" placeholder="${esc(auto || 'mdi:… / phu:… / hue:…')}"></div>${help}</div>`;
        case 'color':
          return this._color(f, val, auto);
        case 'entity':
        case 'area':
          return this._entity(f, f.name, val, auto, key);
        case 'entities': {
          const list = Array.isArray(val) ? val : [];
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
        case 'info':
          return `<div class="small" style="padding:0 6px">${esc(f.label)}</div>`;
        default:
          return '';
      }
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
      return `<div class="dd"><input class="inp" data-search="${key}" data-act="${act}" data-name="${esc(name)}" value="${esc(q)}" placeholder="${esc(placeholder || 'Søk eller skriv entity_id …')}" autocomplete="off">
        ${open ? `<div class="menu">${items.map((x) => `<button data-a="${act}" data-name="${esc(name)}" data-v="${esc(x.id)}" data-key="${esc(x.id)}"><b>${esc(x.name)}</b><i>${esc(x.id)}</i></button>`).join('') || '<div class="small" style="padding:8px">Ingen treff – trykk Enter for å bruke teksten</div>'}</div>` : ''}</div>`;
    }
    _entity(f, name, val, auto, key) {
      const lab = f.label ? `<label>${esc(f.label)}</label>` : '';
      const help = f.help ? `<span class="help">${esc(f.help)}</span>` : '';
      const cur = val ? (f.type === 'area' ? `<div class="ent">${M.icon('mdi:texture-box', 20, 'color:#afafaf')}<span class="nm"><b>${esc(M.areaName(this._hass, val))}</b><i>${esc(val)}</i></span><button class="ib" data-a="clear" data-name="${esc(name)}" title="Tilbake til auto">${M.icon('mdi:close', 18)}</button></div>`
        : this._entRow(val, `<button class="ib" data-a="clear" data-name="${esc(name)}" title="Tilbake til auto">${M.icon('mdi:close', 18)}</button>`)) : '';
      return `<div class="f">${lab}${cur}${this._search(f, key, 'setent', name, val ? 'Bytt …' : auto ? 'Auto: ' + auto : 'Velg entitet …')}${help}</div>`;
    }
    _color(f, val, auto) {
      const cur = val || '';
      const theme = M.THEME_COLORS.map(([k, hex, l]) => { const v = `var(--${k}, ${hex})`; return `<button class="dot ${cur === v || cur === `var(--${k})` ? 'on' : ''}" title="${esc(l)} · --${k}" style="background:${v}" data-a="sel" data-name="${esc(f.name)}" data-v="${esc(v)}"></button>`; }).join('');
      const ha = M.HA_COLORS.map(([k, hex, l]) => { const v = `var(--${k}-color, ${hex})`; return `<button class="dot ${cur === v ? 'on' : ''}" title="${esc(l || k)} · --${k}-color" style="background:${v}" data-a="sel" data-name="${esc(f.name)}" data-v="${esc(v)}"></button>`; }).join('');
      return `<div class="f"><label>${esc(f.label || 'Farge')}</label>
        <span class="help">Tema (My SmartHome v3)</span><div class="sws">${theme}</div>
        <span class="help">HA-farger</span><div class="sws">${ha}</div>
        <div class="line"><span class="dot" style="background:${esc(cur || auto || 'transparent')}"></span><input class="inp" data-name="${esc(f.name)}" value="${esc(cur)}" placeholder="${esc(auto || '#hex eller var(--navn)')}"><button class="ib" data-a="clear" data-name="${esc(f.name)}" title="Standard">${M.icon('mdi:restore', 18)}</button></div>
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
      return `<details class="sec" data-sec="ord_${esc(f.name)}" data-focus="sections" ${this._open['ord_' + f.name] || this.focusSection === 'sections' ? 'open' : ''}><summary>${M.icon('mdi:view-agenda-outline', 20)}${esc(f.label || 'Seksjoner')}<span class="chev">${M.icon('mdi:chevron-down', 20)}</span></summary><div class="in">
        ${order.map((k, i) => `<div class="ordrow ${hid.has(k) ? 'off' : ''}" style="${hid.has(k) ? 'opacity:.5' : ''}"><span style="flex:1;font-size:13px">${esc(lab[k])}</span>
          <button class="ib" data-a="mv" data-name="${esc(f.name)}" data-ord="${esc(order.join(','))}" data-i="${i}" data-d="-1" ${i ? '' : 'disabled style="opacity:.3"'}>${M.icon('mdi:chevron-up', 20)}</button>
          <button class="ib" data-a="mv" data-name="${esc(f.name)}" data-ord="${esc(order.join(','))}" data-i="${i}" data-d="1" ${i < order.length - 1 ? '' : 'disabled style="opacity:.3"'}>${M.icon('mdi:chevron-down', 20)}</button>
          <button class="ib" data-a="hid" data-name="${esc(f.hiddenName)}" data-v="${esc(k)}">${M.icon(hid.has(k) ? 'mdi:eye-off' : 'mdi:eye', 18)}</button></div>`).join('')}
        </div></details>`;
    }
    _click(e) {
      const b = e.composedPath().find((n) => n.dataset && n.dataset.a);
      if (!b) { if (!e.composedPath().some((n) => n.dataset && n.dataset.search)) { if (this._menu) { this._menu = null; this._render(); } } return; }
      const d = b.dataset, c = this._config;
      M.haptic('light');
      switch (d.a) {
        case 'bool': return this._set(d.name, d.v === '1');
        case 'sel': return this._set(d.name, d.num === '1' ? Number(d.v) : d.v);
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
        case 'save': return this.dispatchEvent(new CustomEvent('msh-save', { detail: { config: this._config } }));
        case 'cancel': return this.dispatchEvent(new CustomEvent('msh-cancel'));
        default:
      }
    }
    _input(e) {
      const t = e.target;
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
