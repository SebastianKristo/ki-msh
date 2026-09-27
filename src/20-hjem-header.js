/* msh-hjem-header-card · Hjem-visningen, header. Kilde: Hjem v2.dc.html (<header>, peopleVals, hdr/hdrVals,
 * he.* header-editor, quick.* person-hurtigark, servermeny, lockVals).
 * Autokonfig (entiteter.md «Hjem-header»): person.*, weather.* (første), zone.* (soner).
 * Felles for Hjem-kortene (20–23): utvidet editor (msh-hjem-editor), dørlås-hurtigark (M.hjemLockSheet),
 * søppel-oppslag (M.hjemTrash*), værtekst (M.hjemCond).
 */
(function () {
  const M = window.MSH, esc = M.esc, C = M.C;
  const PINK = C.accent;
  const get = (o, p) => String(p).split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  const setIn = (o, p, v) => {
    const ks = String(p).split('.');
    let cur = o;
    ks.forEach((k, i) => {
      if (i === ks.length - 1) { if (v === undefined || v === '' || v === null) delete cur[k]; else cur[k] = v; }
      else { cur[k] = { ...(cur[k] || {}) }; cur = cur[k]; }
    });
    return o;
  };
  const toasts = (card) => ({ enabled: !(card && card.config && card.config.toasts === false) });
  M.hjemToast = (card, text) => M.toast(text, toasts(card));

  /* ------------------------------------------------------------ handlinger på tittelen (Fiks 9) */
  // title_actions: { tap, double_tap, hold } – hver er én av TACTS. kiosk_entity: input_boolean (standard input_boolean.kiosk_mode).
  const TACTS = [['server', 'Bytt sted', 'mdi:swap-horizontal'], ['kiosk', 'Kiosk-modus av/på', 'mdi:fullscreen'], ['config', 'Innstillinger', 'mdi:cog'], ['edit', 'Rediger dashbord', 'mdi:pencil'], ['header', 'Tilpass header', 'mdi:page-layout-header'], ['vaer', 'Åpne Vær', 'mdi:weather-partly-cloudy'], ['none', 'Ingen', 'mdi:cancel']];
  const TACT_L = Object.fromEntries(TACTS.map(([k, l]) => [k, l]));
  const TGESTS = [['tap', 'Trykk', 'mdi:gesture-tap'], ['double_tap', 'Dobbelttrykk', 'mdi:gesture-double-tap'], ['hold', 'Hold', 'mdi:gesture-tap-hold']];
  const TACT_DEF = { tap: 'server', double_tap: 'config', hold: 'kiosk' };
  const KIOSK_DEF = 'input_boolean.kiosk_mode';
  M.HJEM_TITLE_ACTIONS = TACTS;
  // Effektive handlinger (ukjente/manglende verdier → standard). Ren funksjon.
  M.hjemTitleActions = function (c) {
    const t = (c && c.title_actions) || {}, out = {};
    Object.keys(TACT_DEF).forEach((k) => { out[k] = TACT_L[t[k]] ? t[k] : TACT_DEF[k]; });
    return out;
  };
  M.hjemKioskEntity = (c) => (c && c.kiosk_entity) || (c && c.overrides && c.overrides.kiosk) || KIOSK_DEF;

  /* ------------------------------------------------------------ vær */
  const COND = { 'clear-night': 'Klart', cloudy: 'Skyet', exceptional: 'Ekstremvær', fog: 'Tåke', hail: 'Hagl', lightning: 'Torden', 'lightning-rainy': 'Torden og regn', partlycloudy: 'Delvis skyet', pouring: 'Styrtregn', rainy: 'Regn', snowy: 'Snø', 'snowy-rainy': 'Sludd', sunny: 'Sol', windy: 'Vind', 'windy-variant': 'Vind og skyer' };
  M.hjemCond = M.hjemCond || function (state) { return COND[state] || (state ? String(state) : '–'); };

  /* ------------------------------------------------------------ søppel (delt av prosa + søppelkort) */
  const TRASH_RE = /s(o|ø)ppel|avfall|renovasjon|waste|garbage|trash|t(o|ø)mming|restavfall|papir|plast/i;
  M.hjemTrashDays = function (st) {
    if (!st || M.unavailable(st)) return null;
    if (M.isNum(st.state)) return Math.round(Number(st.state));
    const a = st.attributes || {};
    for (const k of ['days', 'daysTo', 'days_to', 'days_until', 'days_left']) if (M.isNum(a[k])) return Math.round(Number(a[k]));
    const dt = /^\d{4}-\d{2}-\d{2}/.test(st.state) ? st.state : (a.next_date || a.date || null);
    if (dt) {
      const d = new Date(dt), t = new Date();
      if (!isNaN(d)) { d.setHours(0, 0, 0, 0); t.setHours(0, 0, 0, 0); return Math.round((d - t) / 86400000); }
    }
    const m = /(\d+)\s*(d|dag|day)/i.exec(st.state);
    return m ? Number(m[1]) : null;
  };
  M.hjemTrashAuto = function (hass) {
    const c = M.all(hass, 'sensor', (s, id) => TRASH_RE.test(id + ' ' + (s.attributes.friendly_name || '')));
    return c.find((id) => M.hjemTrashDays(hass.states[id]) != null) || c[0] || null;
  };
  M.hjemTrashType = function (st, typeSt) {
    const nice = (arr) => { const l = arr.map((x, i) => (i ? String(x).toLowerCase() : String(x))); return l.length > 1 ? l.slice(0, -1).join(', ') + ' og ' + l[l.length - 1] : l[0] || ''; };
    if (typeSt && !M.unavailable(typeSt)) { const v = typeSt.state; return Array.isArray(typeSt.attributes.types) ? nice(typeSt.attributes.types) : v; }
    const a = (st && st.attributes) || {};
    if (Array.isArray(a.types) && a.types.length) return nice(a.types);
    return a.garbage_type || a.type || a.waste_type || null;
  };

  /* ------------------------------------------------------------ utvidet editor */
  // Arver msh-editor (samme skjema/config-flyt) og legger til felttyper Hjem-kortene trenger:
  //   rows   { name, label, title(row), sub(row), chip(row)→html, fields:[… rowWhen(row)], newRow(h,c), defaults(h,c), hide, addLabel }
  //   modes  { name, options:[[v,label,icon,sub]] }   range { name, min, max, step, fmt }
  //   tokens { target, tokens:[[label,text,prepend]] } swatches { name, options:[[v,css,label]] }
  //   html   { render(h,c) }                            button { label, icon, run(row,h,c) }
  // Alle felt kan ha when(h,c).
  const XCSS = `
    .xrows{display:flex;flex-direction:column;gap:6px}
    .xr{display:flex;align-items:center;gap:4px;min-height:54px;padding:0 6px 0 12px;border-radius:26px;background:#2f2f2f}
    .xr.on{background:#545454}
    .xrh{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:2px;text-align:left;padding:6px 0;min-height:54px}
    .xrh b{font-size:14px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .xrh i{font-style:normal;font-size:11px;color:#979797;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .xsq{width:32px;height:32px;border-radius:16px;flex:none;display:grid;place-items:center;background:#232323;color:#fafafa}
    .xsq[disabled]{background:transparent;color:#545454;pointer-events:none}
    .xsq.del{background:rgb(242 128 115 / 0.2);color:var(--red,#f28073)}
    .xrb{display:flex;flex-direction:column;gap:8px;padding:12px;border-radius:22px;background:#3a3a3a}
    .xrb .f{background:#2f2f2f}
    .xrb .f .inp{background:#232323}
    .xadd{height:48px;border-radius:24px;display:flex;align-items:center;justify-content:center;gap:8px;font-size:14px;font-weight:500;box-shadow:inset 0 0 0 1.5px rgba(255,255,255,0.18)}
    .xmodes{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
    .xmode{min-height:118px;padding:12px;border-radius:22px;display:flex;flex-direction:column;align-items:flex-start;text-align:left;background:#3a3a3a;color:#fafafa}
    .xmode .iw{width:36px;height:36px;border-radius:18px;display:grid;place-items:center;background:#545454}
    .xmode b{font-size:15px;font-weight:600;padding-top:10px}
    .xmode i{font-style:normal;font-size:11px;line-height:1.3;color:#979797}
    .xmode.on{background:${PINK};color:#2f2f2f}
    .xmode.on .iw{background:rgba(42,23,32,0.12)} .xmode.on i{color:rgba(42,23,32,0.75)}
    .xtoks{display:flex;gap:4px;flex-wrap:wrap;max-height:88px;overflow-y:auto}
    .xtok{height:28px;padding:0 10px;border-radius:14px;background:#545454;font-size:12px;white-space:nowrap;color:#e1e1e1}
    .xrng{width:100%;accent-color:rgb(242 133 201)}
    .xsw{display:flex;gap:10px;flex-wrap:wrap;padding:2px}
    .xsw button{width:34px;height:34px;border-radius:17px;flex:none;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.2)}
    .xsw button.on{box-shadow:0 0 0 2px #2f2f2f,0 0 0 4px #fafafa}
    .xbtn{height:42px;border-radius:21px;display:flex;align-items:center;justify-content:center;gap:6px;font-size:14px;font-weight:600;background:${PINK};color:#2f2f2f}
    .xprev{padding:14px 16px;border-radius:24px;background:#232323;font-size:16px;line-height:1.95;text-wrap:pretty}
    .xprev .pc{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 11px;border-radius:14px;color:#232323;font-weight:600;vertical-align:middle;white-space:nowrap;font-variant-numeric:tabular-nums}
    .xprev .pd{width:8px;height:8px;border-radius:4px;display:inline-block}
    .xchip{width:36px;height:36px;border-radius:18px;flex:none;display:grid;place-items:center;color:#fff}
    .xta{display:flex;flex-direction:column;gap:6px}
    .xtr{display:flex;align-items:center;gap:12px;min-height:56px;padding:0 8px 0 10px;border-radius:26px;background:#2f2f2f}
    .xtr .ti{width:36px;height:36px;border-radius:18px;flex:none;display:grid;place-items:center;background:#232323;color:#afafaf}
    .xtr b{flex:1;min-width:0;font-size:14px;font-weight:500}
    .xpill{position:relative;flex:none;display:flex;align-items:center;gap:6px;height:38px;max-width:62%;padding:0 8px 0 14px;border-radius:19px;background:#545454;color:#fafafa;font-size:13px;font-weight:500;white-space:nowrap}
    .xpill.none{background:transparent;color:#979797;box-shadow:inset 0 0 0 1.5px rgba(255,255,255,0.18)}
    .xpill span{overflow:hidden;text-overflow:ellipsis}
    .xpill select{position:absolute;inset:0;width:100%;height:100%;margin:0;padding:0;border:0;opacity:0;cursor:pointer;font-size:16px;-webkit-appearance:none;appearance:none;background:transparent;color:#232323}
    .xtsel{display:flex;flex-direction:column;gap:8px}
  `;
  let XSHEET = null;
  const Base = customElements.get('msh-editor');
  if (Base && !customElements.get('msh-hjem-editor')) {
    class HjemEditor extends Base {
      constructor() {
        super(); this._ropen = {}; this._btns = {};
        this.shadowRoot.addEventListener('change', (e) => { if (e.target && e.target.dataset && e.target.dataset.tact) M.haptic('selection'); });
      }
      _css() {
        if (this._cssOk || !this.shadowRoot) return;
        try {
          if (!XSHEET) { XSHEET = new CSSStyleSheet(); XSHEET.replaceSync(XCSS); }
          this.shadowRoot.adoptedStyleSheets = [...this.shadowRoot.adoptedStyleSheets, XSHEET];
          this._cssOk = true;
        } catch (e) { this._cssFallback = true; }
      }
      _render() {
        this._css();
        this._btns = {};
        super._render();
        if (this.shadowRoot) {
          const A = M.hjemTitleActions(this._config || {});
          this.shadowRoot.querySelectorAll('[data-tact]').forEach((el) => { const v = A[el.dataset.tact]; if (el.value !== v) el.value = v; });
        }
        if (this._cssFallback && this.shadowRoot && !this.shadowRoot.getElementById('xcss')) {
          const s = document.createElement('style'); s.id = 'xcss'; s.textContent = XCSS; this.shadowRoot.appendChild(s);
        }
      }
      _findRows(name, list) {
        for (const f of list || this.schema) {
          if (f.type === 'rows' && f.name === name) return f;
          if (f.fields && f.type !== 'rows') { const r = this._findRows(name, f.fields); if (r) return r; }
        }
        return null;
      }
      _rowsOf(f) {
        const v = get(this._config || {}, f.name);
        if (Array.isArray(v)) return v;
        if (v && typeof v === 'object' && f.toList) { try { return f.toList(v, this._hass); } catch (e) { return []; } }
        try { return (f.defaults && f.defaults(this._hass, this._config || {})) || []; } catch (e) { return []; }
      }
      _val(path) {
        const m = /^(\w+)\.(\d+)\.(.+)$/.exec(path || '');
        if (m) { const f = this._findRows(m[1]); if (f) return get(this._rowsOf(f)[+m[2]] || {}, m[3]); }
        return get(this._config || {}, path);
      }
      _set(path, v, commit) {
        const m = /^(\w+)\.(\d+)\.(.+)$/.exec(path || '');
        if (m) {
          const f = this._findRows(m[1]);
          if (f) {
            const list = this._rowsOf(f).map((x) => JSON.parse(JSON.stringify(x || {})));
            if (list[+m[2]]) setIn(list[+m[2]], m[3], v);
            return this._rowsSave(f, list, commit);
          }
        }
        return super._set(path, v, commit);
      }
      // Rader lagres som liste, eller i feltets eget format (fromList, f.eks. zones-map)
      _rowsSave(f, list, commit) { return super._set(f.name, f.fromList ? f.fromList(list) : list, commit); }
      // Handlinger på tittelen: tre rader med en pille som er en usynlig native <select> (OS-velgeren).
      // HA GUI-editoren: ha-selector select per gest.
      _titleActs() {
        const A = M.hjemTitleActions(this._config || {});
        if (!this._inline && customElements.get('ha-selector')) {
          const sel = JSON.stringify({ select: { mode: 'dropdown', options: TACTS.map(([v, l]) => ({ value: v, label: l })) } });
          return `<div class="xtsel">${TGESTS.map(([g, l]) => `<div class="f"><ha-selector data-name="title_actions.${g}" data-tact="${g}" data-nomorph data-selector="${esc(sel)}" data-label="${esc(l)}" data-helper="Standard: ${esc(TACT_L[TACT_DEF[g]])}"></ha-selector></div>`).join('')}</div>`;
        }
        return `<div class="xta">${TGESTS.map(([g, l, ic]) => {
          const v = A[g];
          return `<div class="xtr" data-key="ta-${g}"><span class="ti">${M.icon(ic, 20)}</span><b>${esc(l)}</b><label class="xpill ${v === 'none' ? 'none' : ''}"><span>${esc(TACT_L[v])}</span>${M.icon('mdi:unfold-more-horizontal', 16, 'color:#afafaf;flex:none')}<select data-name="title_actions.${g}" data-tact="${g}" aria-label="${esc(l)}">${TACTS.map(([k, kl]) => `<option value="${k}" ${k === v ? 'selected' : ''}>${esc(kl)}</option>`).join('')}</select></label></div>`;
        }).join('')}</div>`;
      }
      _field(f, key) {
        const h = this._hass, c = this._config || {};
        if (f.when) { let ok = true; try { ok = f.when(h, c); } catch (e) { /* */ } if (!ok) return ''; }
        const lab = f.label ? `<label>${esc(f.label)}</label>` : '';
        const help = f.help ? `<span class="help">${esc(f.help)}</span>` : '';
        switch (f.type) {
          case 'rows': return this._rows(f, key);
          case 'titleacts': return this._titleActs();
          case 'modes': {
            const cur = get(c, f.name) != null ? String(get(c, f.name)) : String(f.default || '');
            return `<div class="f" style="background:transparent;padding:4px 0">${lab}<div class="xmodes">${f.options.map(([v, l, ic, sub]) => `<button class="xmode ${String(v) === cur ? 'on' : ''}" data-a="sel" data-name="${esc(f.name)}" data-v="${esc(v)}"><span class="iw">${M.icon(ic, 20)}</span><b>${esc(l)}</b><i>${esc(sub || '')}</i></button>`).join('')}</div>${help}</div>`;
          }
          case 'range': {
            // Felles range (presets + enhet; ha-selector i HA GUI-editoren) når feltet er skrevet for msh-editor
            if (f.presets || f.unit) return super._field(f, key);
            const v = get(c, f.name) != null ? Number(get(c, f.name)) : Number(f.default);
            return `<div class="f"><div class="line" style="justify-content:space-between;font-size:13px"><span style="color:#c7c7c7">${esc(f.label)}</span><b style="font-weight:500" class="num">${esc(f.fmt ? f.fmt(v) : v)}</b></div><input type="range" class="xrng" data-name="${esc(f.name)}" data-num="1" min="${f.min}" max="${f.max}" step="${f.step || 1}" value="${v}">${help}</div>`;
          }
          case 'tokens':
            return `<div class="xtoks">${(f.tokens || []).map(([l, t, pre]) => `<button class="xtok" data-a="x-tok" data-name="${esc(f.target)}" data-v="${esc(t)}" data-pre="${pre ? 1 : 0}">${esc(l)}</button>`).join('')}</div>`;
          case 'swatches': {
            const cur = get(c, f.name) != null ? String(get(c, f.name)) : String(f.default || '');
            return `<div class="f">${lab}<div class="xsw">${f.options.map(([v, css, l]) => `<button class="${String(v) === cur ? 'on' : ''}" title="${esc(l)}" style="background:${css}" data-a="sel" data-name="${esc(f.name)}" data-v="${esc(v)}"></button>`).join('')}</div>${help}</div>`;
          }
          case 'html': { try { return f.render(h, c) || ''; } catch (e) { return ''; } }
          case 'button':
            this._btns[key] = f;
            return `<button class="xbtn" data-a="x-btn" data-k="${esc(key)}">${f.icon ? M.icon(f.icon, 18) : ''}${esc(f.label)}</button>`;
          default: return super._field(f, key);
        }
      }
      _rows(f, key) {
        const h = this._hass, saved = this._config || {};
        const list = this._rowsOf(f);
        const open = this._ropen[f.name];
        this._config = { ...saved, [f.name]: list };
        let body = '';
        try {
          body = list.map((r, i) => {
            const t = f.title ? f.title(r, i, h, saved) : (r.name || r.id || `#${i + 1}`);
            const sub = f.sub ? f.sub(r, i, h, saved) : '';
            const isOpen = open === i;
            const head = `<div class="xr ${isOpen ? 'on' : ''}" style="${r && r.hidden ? 'opacity:.55' : ''}" data-key="${esc(f.name)}-${i}">
              ${f.chip ? f.chip(r, i, h, saved) : ''}
              <button class="xrh" data-a="x-ropen" data-n="${esc(f.name)}" data-i="${i}"><b>${esc(t)}</b>${sub ? `<i>${esc(sub)}</i>` : ''}</button>
              ${f.sortable === false ? '' : `<button class="xsq" data-a="x-rmv" data-n="${esc(f.name)}" data-i="${i}" data-d="-1" ${i ? '' : 'disabled'}>${M.icon('mdi:chevron-up', 18)}</button><button class="xsq" data-a="x-rmv" data-n="${esc(f.name)}" data-i="${i}" data-d="1" ${i < list.length - 1 ? '' : 'disabled'}>${M.icon('mdi:chevron-down', 18)}</button>`}
              ${f.hide ? `<button class="xsq" data-a="x-rhide" data-n="${esc(f.name)}" data-i="${i}">${M.icon(r && r.hidden ? 'mdi:eye-off' : 'mdi:eye', 18, `color:${r && r.hidden ? '#696969' : '#fafafa'}`)}</button>` : ''}
              <button class="xsq del" data-a="x-rdel" data-n="${esc(f.name)}" data-i="${i}" title="Slett">${M.icon('mdi:delete', 18)}</button></div>`;
            if (!isOpen) return head;
            const sub2 = (f.fields || []).filter((sf) => { try { return !sf.rowWhen || sf.rowWhen(r || {}, h, saved); } catch (e) { return true; } }).map((sf, j) => {
              const nf = { ...sf, rowWhen: undefined };
              if (sf.name) nf.name = `${f.name}.${i}.${sf.name}`;
              if (sf.target) nf.target = `${f.name}.${i}.${sf.target}`;
              if (sf.run) nf.run = () => sf.run(r || {}, h, saved);
              if (sf.render) nf.render = () => sf.render(r || {}, h, saved);
              if (sf.auto) nf.auto = (hh) => sf.auto(r || {}, hh || h, saved); // auto per rad (f.eks. prosa ent_override)
              return this._field(nf, `${key}_${i}_${j}`);
            }).join('');
            return head + `<div class="xrb" data-key="${esc(f.name)}-b${i}">${sub2}</div>`;
          }).join('');
        } finally { this._config = saved; }
        return `<div class="f" style="background:transparent;padding:4px 0">${f.label ? `<label>${esc(f.label)}</label>` : ''}<div class="xrows">${body || '<span class="small">Ingen</span>'}
          ${f.newRow ? `<button class="xadd" data-a="x-radd" data-n="${esc(f.name)}">${M.icon('mdi:plus', 20)}${esc(f.addLabel || 'Legg til')}</button>` : ''}</div>${f.help ? `<span class="help">${esc(f.help)}</span>` : ''}</div>`;
      }
      _click(e) {
        const b = e.composedPath().find((n) => n.dataset && n.dataset.a);
        if (!b || b.dataset.a.indexOf('x-') !== 0) return super._click(e);
        M.haptic('light');
        const d = b.dataset, f = d.n ? this._findRows(d.n) : null;
        const list = f ? this._rowsOf(f).map((x) => JSON.parse(JSON.stringify(x || {}))) : [];
        const i = Number(d.i);
        switch (d.a) {
          case 'x-ropen': this._ropen[d.n] = this._ropen[d.n] === i ? null : i; return this._render();
          case 'x-rmv': { const j = i + Number(d.d); if (j < 0 || j >= list.length) return; [list[i], list[j]] = [list[j], list[i]]; if (this._ropen[d.n] === i) this._ropen[d.n] = j; M.haptic('selection'); return this._rowsSave(f, list); }
          case 'x-rhide': list[i].hidden = !list[i].hidden; if (!list[i].hidden) delete list[i].hidden; return this._rowsSave(f, list);
          case 'x-rdel': list.splice(i, 1); if (this._ropen[d.n] === i) this._ropen[d.n] = null; return this._rowsSave(f, list);
          case 'x-radd': { let r = {}; try { r = f.newRow(this._hass, this._config || {}, list) || {}; } catch (x) { /* */ } list.push(r); this._ropen[d.n] = list.length - 1; return this._rowsSave(f, list); }
          case 'x-tok': { const cur = String(this._val(d.name) || ''); const v = d.pre === '1' ? d.v + cur : `${cur} ${d.v}`.trim(); return this._set(d.name, v); }
          case 'x-btn': { const bf = this._btns[d.k]; if (bf && bf.run) { try { bf.run(this._hass, this._config); } catch (x) { M.toast('Feil: ' + x.message); } } return; }
          default:
        }
      }
    }
    customElements.define('msh-hjem-editor', HjemEditor);
  }
  // Kortets egen tilpasning med den utvidede editoren (samme flyt som MSH.Card.customize).
  M.hjemCustomize = function (card, focus) {
    const tag = customElements.get('msh-hjem-editor') ? 'msh-hjem-editor' : 'msh-editor';
    const r = M.openEditor(card, { cardClass: card.constructor, focus, tag });
    return r && r.overlay;
  };
  M.hjemEditorEl = function (cls) {
    const e = document.createElement(customElements.get('msh-hjem-editor') ? 'msh-hjem-editor' : 'msh-editor');
    e.cardClass = cls;
    return e;
  };

  /* ------------------------------------------------------------ hurtigark: felles ramme */
  const SHEET_CSS = `
    .sh{overflow:visible;width:calc(100% - 40px);max-width:300px;padding:62px 14px 14px;border-radius:30px;background:var(--gray200,#3a3a3a);box-shadow:inset 0 1px 0 rgba(255,255,255,0.08),0 30px 60px rgba(0,0,0,0.5)}
    .body{display:flex;flex-direction:column;gap:10px}
    .orb{position:absolute;left:50%;top:-48px;transform:translateX(-50%);width:96px;height:96px;border-radius:48px;display:grid;place-items:center;overflow:hidden}
    .orb.pic{background-size:cover;background-position:center;font-size:36px;font-weight:600;color:#232323}
    .orb.pic img{display:block;width:100%;height:100%;object-fit:cover}
    .nm{display:flex;flex-direction:column;align-items:center;gap:3px;padding-bottom:4px;text-align:center}
    .nm b{font-size:22px;font-weight:600;letter-spacing:-0.01em}
    .nm span{font-size:13px;color:var(--gray600,#7f7f7f)}
    .seg{position:relative;display:grid;grid-template-columns:1fr 1fr;padding:4px;border-radius:26px;background:var(--gray000,#232323);touch-action:none;user-select:none;cursor:pointer}
    .seg .ind{position:absolute;top:4px;bottom:4px;width:calc((100% - 8px) / 2);border-radius:22px;pointer-events:none;transition:left .5s cubic-bezier(.34,1.4,.64,1),transform .45s cubic-bezier(.34,1.8,.64,1),background .35s}
    .seg.drag .ind{background:linear-gradient(180deg,rgba(255,255,255,0.3),rgba(255,255,255,0.1))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,0.6),inset 0 0 0 .5px rgba(255,255,255,0.35),0 8px 20px rgba(0,0,0,0.35);transform:scale(1.08,1.12);transition:transform .25s cubic-bezier(.34,1.8,.64,1),background .2s}
    .seg .o{position:relative;z-index:1;height:48px;border-radius:22px;display:flex;align-items:center;justify-content:center;gap:8px;font-size:14px;font-weight:600;color:#afafaf;transition:color .25s}
    .seg .o.on{color:#232323}
    .seg.ro{cursor:default}
    .opts{display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:4px;border-radius:26px;background:var(--gray000,#232323)}
    .opt{height:48px;border-radius:22px;display:flex;align-items:center;justify-content:center;gap:6px;font-size:14px;font-weight:500;color:#979797;transition:background .25s}
    .lst{display:flex;flex-direction:column;padding:4px 10px;border-radius:22px;background:var(--gray000,#232323)}
    .li{display:flex;align-items:center;gap:10px;height:44px;border-top:1px solid rgba(255,255,255,0.05);text-align:left;width:100%}
    .li:first-child{border-top:0;height:48px}
    .li .t{flex:1;font-size:14px;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .li .v{font-size:13px;color:var(--gray800,#afafaf)}
    .trk{position:relative;width:44px;height:26px;border-radius:13px;flex:none;background:var(--gray200,#3a3a3a);transition:background .2s}
    .trk.on{background:var(--pink,#f285c9)}
    .trk i{position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:10px;background:#fafafa;transition:left .2s}
    .trk.on i{left:21px}
    .done{height:52px;border-radius:26px;background:${PINK};color:#2f2f2f;font-size:15px;font-weight:600}
    .more{height:36px;display:flex;align-items:center;justify-content:center;gap:4px;font-size:13px;color:var(--gray700,#979797)}
    button:active{transform:scale(.97)}
    @keyframes pop{from{transform:translateY(-40%) scale(.9);opacity:0}}
  `;
  // Åpner et sentrert hurtigark. render() → html, onAct(name, el, sheet) håndterer data-a. Oppdateres av kortet via sheet.update().
  M.hjemSheet = function (card, { render, onAct, drag }) {
    const ov = M.overlay({ html: render(), css: SHEET_CSS, center: true, sheet: false, maxWidth: 300 });
    const sheet = { ov, update() { if (ov.host.isConnected) M.morph(ov.body, render()); } };
    ov.root.addEventListener('click', (e) => {
      const el = e.target.closest && e.target.closest('[data-a]');
      if (!el) return;
      M.haptic(el.dataset.haptic || 'light');
      if (el.dataset.a === 'close') return ov.close();
      onAct && onAct(el.dataset.a, el, sheet, e);
    });
    if (drag) ov.root.addEventListener('pointerdown', (e) => { const seg = e.target.closest && e.target.closest('.seg[data-seg]'); if (seg && !seg.classList.contains('ro')) drag(seg, e, sheet); });
    card._sheets = card._sheets || new Set();
    card._sheets.add(sheet);
    const close0 = ov.close;
    ov.close = () => { card._sheets.delete(sheet); close0(); };
    return sheet;
  };
  // Glass-segment: dra indikatoren, slipp → velg nærmeste. pick(i)
  M.hjemSegDrag = function (seg, e, pick) {
    const r = seg.getBoundingClientRect(), n = 2, ind = seg.querySelector('.ind');
    const xOf = (ev) => M.clamp((ev.clientX - r.left - 4) / Math.max(1, r.width - 8), 0, 1);
    const place = (x) => { const pos = M.clamp(x, 0.5 / n, 1 - 0.5 / n); if (ind) ind.style.left = `calc(4px + (100% - 8px) * ${pos - 0.5 / n})`; };
    try { seg.setPointerCapture(e.pointerId); } catch (x) { /* */ }
    seg.classList.add('drag');
    let last = Math.floor(xOf(e) * n);
    place(xOf(e));
    const mv = (ev) => { place(xOf(ev)); const k = Math.min(n - 1, Math.floor(xOf(ev) * n)); if (k !== last) { last = k; M.haptic('selection'); } };
    const up = (ev) => {
      seg.removeEventListener('pointermove', mv); seg.removeEventListener('pointerup', up); seg.removeEventListener('pointercancel', up);
      seg.classList.remove('drag');
      const i = Math.min(n - 1, Math.floor(xOf(ev) * n));
      if (ind) ind.style.left = '';
      seg.__dragged = true; setTimeout(() => { seg.__dragged = false; }, 50);
      pick(i);
    };
    seg.addEventListener('pointermove', mv); seg.addEventListener('pointerup', up); seg.addEventListener('pointercancel', up);
  };
  const segHTML = (key, idx, opts, ro) => `<div class="seg ${ro ? 'ro' : ''}" data-seg="${key}"><span class="ind" style="left:calc(4px + (100% - 8px) * ${idx / 2});background:${opts[idx][3]}"></span>${opts.map(([icon, label, v], i) => `<span class="o ${i === idx ? 'on' : ''}" data-a="seg" data-seg="${key}" data-i="${i}" data-haptic="selection">${M.icon(icon, 20)}${esc(label)}</span>`).join('')}</div>`;

  /* ------------------------------------------------------------ dørlås-hurtigark (lock.*) */
  const devSib = (hass, id, test) => {
    const e = M.regEntry(hass, id);
    if (!e || !e.device_id) return null;
    return Object.keys(hass.entities || {}).find((x) => x !== id && hass.entities[x].device_id === e.device_id && hass.states[x] && test(x, hass.states[x])) || null;
  };
  M.hjemLockAuto = (hass) => M.all(hass, 'lock')[0] || null;
  M.hjemLockSheet = function (card, lockId) {
    lockId = lockId || M.hjemLockAuto(card.hass);
    if (!lockId) { M.hjemToast(card, 'Fant ingen dørlås'); return null; }
    let spin = 0;
    const R = () => card.s ? card.s.bind(card) : (id) => card.hass.states[id];
    const render = () => {
      const s = R()(lockId), h = card.hass;
      const L = !s || s.state === 'locked' || s.state === 'locking';
      const busy = s && (s.state === 'locking' || s.state === 'unlocking');
      const col = L ? C.green : C.orange;
      const name = M.name(h, lockId);
      const auto = devSib(h, lockId, (x) => /auto/.test(x) && /^(switch|input_boolean)\./.test(x));
      const bat = devSib(h, lockId, (x, st) => st.attributes.device_class === 'battery' && x.startsWith('sensor.'));
      const batV = bat ? M.num(h, bat) : (s && M.isNum(s.attributes.battery_level) ? Number(s.attributes.battery_level) : null);
      const aOn = auto && R()(auto) && R()(auto).state === 'on';
      const by = s && (s.attributes.changed_by || s.attributes.last_changed_by);
      const t = s ? new Date(s.last_changed).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' }) : '–';
      const opt = (on, icon, label, c, act) => `<button class="opt" data-a="${act}" data-haptic="success" style="${on ? `background:${M.alpha(c, 0.18)};color:#fafafa;box-shadow:inset 0 0 0 1px ${M.alpha(c, 0.4)}` : ''}">${M.icon(icon, 19, `color:${on ? c : '#7f7f7f'}`)}${label}</button>`;
      return `<button class="orb" data-a="toggle" data-haptic="success" style="background:${M.alpha(col, 0.2)};box-shadow:0 0 0 6px var(--gray200,#3a3a3a),0 12px 30px ${M.alpha(col, 0.35)};transition:background .4s,box-shadow .4s">
          <span style="position:absolute;inset:6px;border-radius:50%;background:conic-gradient(${col} ${L ? 360 : 90}deg, transparent 0);-webkit-mask:radial-gradient(circle, transparent 38px, #000 39px);mask:radial-gradient(circle, transparent 38px, #000 39px);transform:rotate(${spin * 360}deg);transition:transform .8s cubic-bezier(.34,1.3,.64,1),background .4s"></span>
          ${M.icon(L ? 'lock' : 'lock_open', 40, `position:relative;color:${col};transform:${L ? 'scale(1)' : 'scale(1.08) rotate(-8deg)'};transition:transform .5s cubic-bezier(.34,1.8,.64,1),color .3s`)}
        </button>
        <div class="nm"><b>${!s ? '–' : busy ? (L ? 'Låser …' : 'Låser opp …') : L ? 'Låst' : 'Ulåst'}</b><span>${esc(name)} · ${L ? 'sikret' : 'åpen for inngang'}</span></div>
        <div class="opts">${opt(L, 'lock', 'Lås', C.green, 'lock')}${opt(!L, 'lock_open', 'Lås opp', C.orange, 'unlock')}</div>
        <div class="lst">
          <button class="li" data-a="auto" ${auto ? '' : 'disabled'}>${M.icon('lock_clock', 20, 'color:#979797')}<span class="t">${auto ? esc(M.name(h, auto, name)) : 'Autolås'}</span>${auto ? `<span class="trk ${aOn ? 'on' : ''}"><i></i></span>` : '<span class="v">–</span>'}</button>
          <div class="li">${M.icon('battery_5_bar', 20, 'color:#979797')}<span class="t">Batteri</span><span class="v num">${batV != null ? M.nf(batV, 0) + ' %' : '–'}</span></div>
          <div class="li">${M.icon('history', 20, 'color:#979797')}<span class="t">${L ? 'Låst' : 'Låst opp'}${by ? ' av ' + esc(by) : ''}</span><span class="v num">${esc(t)}</span></div>
        </div>
        <button class="done" data-a="close">Ferdig</button>`;
    };
    const run = (lock) => {
      const s = card.hass.states[lockId];
      if (!lock && s && s.attributes.code_format) { M.moreInfo(card, lockId); return; }
      spin++;
      M.call(card.hass, 'lock', lock ? 'lock' : 'unlock', { entity_id: lockId }).then(() => M.hjemToast(card, lock ? 'Dørlås låst' : 'Dørlås låst opp')).catch(() => {});
    };
    return M.hjemSheet(card, {
      render,
      onAct(a, el, sheet) {
        const s = card.hass.states[lockId], L = !s || s.state === 'locked';
        if (a === 'toggle') run(!L);
        if (a === 'lock') run(true);
        if (a === 'unlock') run(false);
        if (a === 'auto') { const au = devSib(card.hass, lockId, (x) => /auto/.test(x) && /^(switch|input_boolean)\./.test(x)); if (au) M.toggle(card.hass, au); }
        sheet.update();
      },
    });
  };

  /* ------------------------------------------------------------ personer og soner */
  const PCOLS = ['orange', 'pink', 'blue', 'green', 'purple', 'yellow', 'red', 'light-blue'].map((k) => C[k.replace(/-(\w)/g, (_, x) => x.toUpperCase())]);
  // Standardpalett for soner uten egen farge: stabil hash av sone-ID → My SmartHome-farge (grønn er forbeholdt Hjemme).
  // (rekkefølgen gir f.eks. zone.skole → blå)
  const ZPAL = [C.purple, C.orange, C.pink, C.yellow, C.red, C.lightBlue, C.blue, C.lime].filter(Boolean);
  const ZCOLS = ZPAL;
  const ZICONS = ['location_city', 'stethoscope', 'apartment', 'agriculture', 'sailing', 'work', 'school', 'cottage', 'fitness_center', 'flight', 'home', 'shopping_cart', 'restaurant', 'local_hospital', 'directions_car', 'logout'];
  const HOME_ST = { icon: 'mdi:home', color: C.green };
  const AWAY_ICON = 'mdi:map-marker-off', AWAY_COL = 'var(--gray500, #696969)';
  M.hjemZonePal = function (zid) {
    let h = 0;
    for (const ch of String(zid || '')) h = (h * 31 + ch.codePointAt(0)) >>> 0;
    return ZPAL[h % ZPAL.length];
  };
  // Sone-oppsett i config: zones: { 'zone.skole': { icon, color } } (også eldre liste [{ zone, icon, color }]).
  const zoneCfg = (c, zid) => {
    const z = c && c.zones;
    if (!z || !zid) return {};
    if (Array.isArray(z)) return z.find((x) => x && x.zone === zid) || {};
    return (typeof z === 'object' && (z[zid] || z[String(zid).replace(/^zone\./, '')])) || {};
  };
  // Ikon og farge for en sone. zone.home er låst til Hjemme-stilen (grønt hus).
  M.hjemZoneStyle = function (hass, c, zid, rd) {
    if (zid === 'zone.home') return { ...HOME_ST };
    const st = zid ? (rd ? rd(zid) : hass && hass.states[zid]) : null;
    const z = zoneCfg(c, zid);
    return { icon: z.icon || (st && st.attributes.icon) || 'mdi:map-marker', color: M.color(z.color, null) || M.hjemZonePal(zid) };
  };
  const autoZones = (hass) => M.all(hass, 'zone', (s, id) => id !== 'zone.home').map((id) => ({ zone: id }));
  const firstName = (n) => String(n || '').trim().split(/\s+/)[0] || '';
  const clampN = (v, lo, hi, d) => { const n = Number(v); return v === '' || v == null || !isFinite(n) ? d : Math.max(lo, Math.min(hi, n)); };
  const objId = (id) => String(id).split('.')[1];
  const SLEEP_RE = /sov|sleep|seng|natt/;
  const PRES_RE = /hjemme|home|tilstede|presence/;
  const sibling = (hass, pid, re, doms) => {
    const slug = objId(pid);
    return Object.keys(hass.states).filter((id) => doms.includes(id.split('.')[0]) && id.includes(slug) && re.test(id) && M.usable(hass, id)).sort()[0] || null;
  };
  const DISPLAYS = ['picture', 'icon', 'initials'];
  // people: [{ person, home_switch, use_gps_when_off, display, picture, hidden }] – raden for en person (eller null).
  M.hjemPeopleRow = (c, id) => (Array.isArray(c && c.people) ? c.people : []).find((r) => r && r.person === id) || null;
  M.hjemPersonCfg = function (c, id) {
    const o = objId(id), list = Array.isArray(c && c.persons) ? c.persons : [];
    const y = list.find((x) => x && (x.entity === id || x.entity === o)) || {};
    const g = (c && c.persons_cfg && c.persons_cfg[o]) || {};
    const r = M.hjemPeopleRow(c, id) || {};
    const out = { ...y };
    [g, { display: r.display, picture: r.picture }].forEach((src) => Object.keys(src).forEach((k) => { if (src[k] != null && src[k] !== '') out[k] = src[k]; }));
    return out;
  };
  // Hjemme-bryteren til en person: people[].home_switch (eldre: overrides.hjemme_<id>). Aldri gjettet.
  M.hjemHomeSwitch = function (c, id) {
    const r = M.hjemPeopleRow(c, id);
    if (r && r.home_switch) return r.home_switch;
    const ov = (c && c.overrides) || {};
    return ov['hjemme_' + objId(id)] || null;
  };
  /* Status for én person (ren funksjon – testbar). p = 'person.x' eller en people-rad. rd = state-leser (valgfri).
   * 1) Hjemme-bryter på → Hjemme (vinner over GPS/sone).
   * 2) person.* i en annen sone enn home → sonens ikon + farge (config → standardpalett).
   * 3) not_home, eller bryter av + GPS «home» (uten use_gps_when_off) → Borte: dempet, ingen merke (away_marker: grå markør).
   * 4) Mangler person og bryter → ingen merke, aldri gjettet status.
   * → { kind: home|zone|away|unknown, src: switch|gps|none, icon, color, place, zone, badge, dim, switchId } */
  M.personStatus = function (hass, p, cfg, rd) {
    cfg = cfg || {};
    rd = rd || ((x) => (hass && hass.states[x]) || null);
    const pid = typeof p === 'string' ? p : p && p.person;
    const row = { ...(pid ? M.hjemPeopleRow(cfg, pid) || {} : {}), ...(typeof p === 'object' && p ? p : {}) };
    const swId = row.home_switch || (pid ? M.hjemHomeSwitch(cfg, pid) : null);
    const s = pid ? rd(pid) : null;
    const sw = swId ? rd(swId) : null;
    const swOk = !!sw && !M.unavailable(sw);
    const home = { kind: 'home', icon: HOME_ST.icon, color: HOME_ST.color, place: 'Hjemme', zone: 'zone.home', badge: true, dim: false, switchId: swId };
    const away = { kind: 'away', icon: AWAY_ICON, color: AWAY_COL, place: 'Borte', zone: null, badge: cfg.away_marker === true, dim: true, switchId: swId };
    if (swOk && sw.state === 'on') return { ...home, src: 'switch' };
    const pOk = !!s && !M.unavailable(s);
    if (!pOk) return swOk ? { ...away, src: 'switch' } : { kind: 'unknown', src: 'none', icon: null, color: null, place: '–', zone: null, badge: false, dim: false, switchId: swId };
    if (s.state === 'home') return swOk && row.use_gps_when_off !== true ? { ...away, src: 'switch' } : { ...home, src: 'gps' };
    if (s.state === 'not_home') return { ...away, src: swOk ? 'switch' : 'gps' };
    const all = hass && hass.states ? Object.keys(hass.states) : [];
    const zid = all.find((z) => z.startsWith('zone.') && z !== 'zone.home' && hass.states[z].attributes.friendly_name === s.state)
      || all.find((z) => z.startsWith('zone.') && z !== 'zone.home' && objId(z) === M.slug(s.state)) || null;
    const zs = zid ? (rd(zid), M.hjemZoneStyle(hass, cfg, zid, rd)) : { icon: 'mdi:map-marker', color: M.hjemZonePal('zone.' + M.slug(s.state)) };
    return { kind: 'zone', src: 'gps', icon: zs.icon, color: zs.color, place: zid ? hass.states[zid].attributes.friendly_name || s.state : s.state, zone: zid, badge: true, dim: false, switchId: swId };
  };
  // Bilde-URL: /local/… og /api/… via hass.hassUrl (riktig base i appen / ekstern tilgang).
  M.hjemPicUrl = function (hass, u) {
    u = String(u || '').trim();
    if (!u) return null;
    if (u[0] === '/' && u[1] !== '/' && hass && typeof hass.hassUrl === 'function') { try { return hass.hassUrl(u) || u; } catch (e) { return u; } }
    return u;
  };
  // Personer som vises: people-listen (rekkefølge + skjult) når den finnes, ellers autokonfig (person.*, include/exclude, person_order).
  M.hjemPersons = function (hass, c) {
    const all = M.all(hass, 'person');
    if (Array.isArray(c.people)) {
      const rows = c.people.filter((r) => r && typeof r.person === 'string' && r.person.startsWith('person.'));
      const ids = [...new Set(rows.map((r) => r.person))];
      const hid = new Set(rows.filter((r) => r.hidden).map((r) => r.person));
      return { all, ids, visible: ids.filter((x) => !hid.has(x)) };
    }
    const inc = (c.include && c.include.personer) || [];
    let ids = M.applyLists(c, 'personer', all);
    inc.forEach((x) => { if (!ids.includes(x)) ids.push(x); });
    const ord = Array.isArray(c.person_order) ? c.person_order.filter((x) => ids.includes(x)) : [];
    ids = [...ord, ...ids.filter((x) => !ord.includes(x))];
    const hid = new Set(c.hidden_persons || []);
    return { all, ids, visible: ids.filter((x) => !hid.has(x)) };
  };
  // Standardrader for «Personer» i editoren (før people er lagret): dagens personer med eldre valg.
  const peopleDefaults = (hass, c) => {
    if (!hass) return [];
    const P = M.hjemPersons(hass, { ...c, people: undefined }), hid = new Set(c.hidden_persons || []);
    return P.ids.map((id) => {
      const pc = M.hjemPersonCfg(c, id), r = { person: id };
      const sw = (c.overrides || {})['hjemme_' + objId(id)];
      if (sw) r.home_switch = sw;
      if (pc.display && pc.display !== 'picture') r.display = pc.display;
      if (pc.picture) r.picture = pc.picture;
      if (hid.has(id)) r.hidden = true;
      return r;
    });
  };
  M.hjemPersonInfo = function (hass, id, c, rd) {
    rd = rd || ((x) => hass.states[x]);
    const s = rd(id), a = (s && s.attributes) || {};
    const o = objId(id);
    const sleepId = M.pick(c, 'sover_' + o, sibling(hass, id, SLEEP_RE, ['input_boolean', 'binary_sensor', 'switch']));
    const st = M.personStatus(hass, id, c, rd);
    // Hurtigarket: Hjemme/Borte skriver til hjemme-bryteren (eller en manuell input_boolean ved siden av personen)
    const presId = st.switchId || sibling(hass, id, PRES_RE, ['input_boolean']);
    const sl = sleepId ? rd(sleepId) : null;
    const home = st.kind === 'home';
    const sleep = !!sl && sl.state === 'on';
    const stCol = sleep ? C.purple : st.color || 'transparent';
    const glyph = sleep ? 'bedtime' : st.icon || 'mdi:account';
    const all = M.all(hass, 'person');
    const me = !!(hass.user && a.user_id && a.user_id === hass.user.id);
    // Visning per person: people[] / persons_cfg.<object_id> (editorene) over persons: [{ entity, display, picture }] (YAML).
    const pc = M.hjemPersonCfg(c, id);
    const display = DISPLAYS.includes(pc.display) ? pc.display : 'picture';
    const raw = pc.picture || a.entity_picture || null;
    const pic = display === 'picture' && raw ? M.hjemPicUrl(hass, raw) : null;
    return { id, o, s, name: a.friendly_name || o, first: firstName(a.friendly_name || o), display, pic, icon: a.icon || 'mdi:account', initial: (a.friendly_name || o).trim().charAt(0).toUpperCase(), bg: PCOLS[Math.max(0, all.indexOf(id)) % PCOLS.length], home, sleep, place: st.place, stCol, glyph, badge: sleep || st.badge, dim: !sleep && st.dim, status: st, me, sleepId, presId };
  };

  /* ------------------------------------------------------------ header-kortet */
  const MODES = [['familie', 'Familie', 'groups', 'Hilsen og bilder'], ['sted', 'Sted', 'location_on', 'Stedet som tittel'], ['navn', 'Navn', 'person', 'Navnet ditt som tittel'], ['under', 'Under', 'vertical_align_top', 'Stedet under hilsenen'], ['kompakt', 'Kompakt', 'view_agenda', 'Lav og tett'], ['hjem', 'Hjem', 'home_pin', 'Sted, vær og personer'], ['stor', 'Stor hilsen', 'waving_hand', 'Stor hilsen og bilder side om side'], ['profil', 'Profil', 'account_circle', 'Stort sted, deg øverst og familien under']];
  // Innholdet i avatar-klippet: <img> (object-fit: cover) · ikon · initialer. Mangler/feiler bildet → ikon.
  const faceInner = (p, n, bad) => {
    if (p.pic && !(bad && bad.has(p.pic))) return `<img src="${esc(p.pic)}" alt="" draggable="false" data-pic="${esc(p.pic)}">`;
    if (p.display === 'initials') return esc(p.initial);
    return M.icon(p.icon || 'mdi:account', Math.round(n * 0.5), 'color:#232323');
  };
  const faceTxt = (p, bad) => p.display === 'initials' && !(p.pic && !(bad && bad.has(p.pic)));

  class HjemHeader extends M.Card {
    static get cardName() { return 'Hjem · header'; }
    static get defaults() {
      return { mode: 'familie', greeting: '👋 {name}!', size: 'M', badge: 'icon', show_name: false, show_place: false, ring_me: false, weather_tap: true, weather_hash: '#vaer', person_tap: 'quick', g_font: 4.5, g_avatar: 50, g_badge: 20, g_gap: -8, pic_size: 60, persons_size: 46, title_size: 36 };
    }
    static getConfigElement() { return M.hjemEditorEl(this); }
    static get schema() {
      return (hass, c) => {
        const D = HjemHeader.defaults;
        const P = hass ? M.hjemPersons(hass, c || {}) : { all: [], ids: [] };
        return [
          { type: 'modes', name: 'mode', label: 'Oppsett', options: MODES, default: D.mode },
          { type: 'section', id: 'title_actions', label: 'Handlinger på tittelen', icon: 'mdi:gesture-tap', meta: (h, cc) => { const A = M.hjemTitleActions(cc); return TACT_L[A.tap]; }, fields: [
            { type: 'titleacts' },
            { type: 'entity', name: 'kiosk_entity', label: 'Kiosk-modus-entitet', domain: 'input_boolean', auto: (h, cc) => ((cc.overrides || {}).kiosk) || KIOSK_DEF },
            { type: 'info', label: 'Standard: trykk åpner «Bytt sted», hold slår kiosk-modus av/på, dobbelttrykk åpner innstillinger.' },
          ] },
          { type: 'section', label: 'Størrelser', icon: 'mdi:format-size', when: (h, cc) => (cc.mode || D.mode) === 'stor', open: true, fields: [
            { type: 'range', name: 'g_font', label: 'Maks tekst', min: 1.6, max: 6, step: 0.1, default: D.g_font, fmt: (v) => `${M.nf(v, 1)} em` },
            { type: 'range', name: 'g_avatar', label: 'Bilder', min: 36, max: 64, step: 1, default: D.g_avatar, fmt: (v) => `${v} px` },
            { type: 'range', name: 'g_badge', label: 'Merke', min: 14, max: 28, step: 1, default: D.g_badge, fmt: (v) => `${v} px` },
            { type: 'range', name: 'g_gap', label: 'Avstand (minus = overlapp)', min: -16, max: 16, step: 1, default: D.g_gap, fmt: (v) => `${v} px` },
            { type: 'info', label: 'Navnet blir så stort som skjermen tillater, opp til maks.' },
          ] },
          { type: 'section', id: 'psizes', label: 'Størrelser', icon: 'mdi:format-size', when: (h, cc) => (cc.mode || D.mode) === 'profil', open: true, fields: [
            { type: 'range', name: 'pic_size', label: 'Profilbilde', min: 40, max: 72, step: 1, default: D.pic_size, fmt: (v) => `${v} px` },
            { type: 'range', name: 'persons_size', label: 'Personer', min: 32, max: 56, step: 1, default: D.persons_size, fmt: (v) => `${v} px` },
            { type: 'range', name: 'title_size', label: 'Tittel', min: 28, max: 48, step: 1, default: D.title_size, fmt: (v) => `${v} px` },
          ] },
          { type: 'section', id: 'people', label: 'Personer', icon: 'mdi:account-multiple', fields: [
            { type: 'rows', name: 'people', label: 'Personer i headeren', defaults: (h, cc) => peopleDefaults(h, cc), addLabel: 'Legg til person', hide: true,
              title: (r, i, h) => (r.person ? M.name(h, r.person) : '') || 'Velg person',
              sub: (r, i, h, cc) => { if (!r.person) return 'person.*'; const st = M.personStatus(h, r, cc); return `${st.place}${r.home_switch ? ' · bryter ' + (h.states[r.home_switch] ? (h.states[r.home_switch].state === 'on' ? 'på' : 'av') : 'mangler') : ''}`; },
              chip: (r, i, h, cc) => { const st = M.personStatus(h, r, cc); return `<span class="xchip" style="background:${st.badge ? st.color : 'var(--gray400,#545454)'};opacity:${st.dim ? 0.55 : 1}">${M.icon(st.badge ? st.icon : 'mdi:account', 18, 'color:#fafafa')}</span>`; },
              newRow: (h, cc, list) => { const used = new Set(list.map((x) => x.person)); return { person: M.all(h, 'person').find((x) => !used.has(x)) || '' }; },
              fields: [
                { type: 'entity', name: 'person', label: 'Person', domain: 'person', required: true },
                { type: 'entity', name: 'home_switch', label: 'Hjemme-bryter', domain: ['switch', 'input_boolean', 'binary_sensor'], domains: ['switch', 'input_boolean', 'binary_sensor'], placeholder: 'Ingen bryter', help: 'På = hjemme, av = borte. Bryteren vinner over GPS. Uten bryter brukes person.* og sonene.' },
                { type: 'boolean', name: 'use_gps_when_off', label: 'Bruk GPS når bryteren er av', default: false, help: 'Av: bryter av = Borte selv om GPS sier hjemme. Andre soner vises alltid.', rowWhen: (r) => !!r.home_switch },
                { type: 'select', name: 'display', label: 'Visning', options: [['picture', 'Bilde'], ['icon', 'Ikon'], ['initials', 'Initialer']], default: 'picture' },
                { type: 'text', name: 'picture', label: 'Bilde', auto: (r, h) => (r.person && h && h.states[r.person] && h.states[r.person].attributes.entity_picture) || '/local/bilde.jpg', help: 'Tom = bildet fra personen i HA (entity_picture). Mangler bilde → ikon.', rowWhen: (r) => (r.display || 'picture') === 'picture' },
              ] },
          ] },
          { type: 'section', id: 'zones', label: 'Soner', icon: 'mdi:map-marker-radius', fields: [
            { type: 'rows', name: 'zones', label: 'Soner med eget ikon og farge', defaults: (h) => autoZones(h), addLabel: 'Legg til sone',
              // Lagres som map: zones: { 'zone.skole': { icon, color } } (eldre liste leses også)
              toList: (v) => Object.keys(v).map((k) => ({ zone: k.includes('.') ? k : 'zone.' + k, ...(v[k] || {}) })),
              fromList: (list) => { const o = {}; list.forEach((r) => { if (!r) return; const { zone, ...rest } = r; o[zone || ''] = rest; }); return o; },
              title: (r, i, h) => (r.zone && h.states[r.zone] ? h.states[r.zone].attributes.friendly_name : r.zone) || 'Velg sone',
              sub: (r, i, h, cc) => (r.zone ? r.zone + (r.icon || r.color ? '' : ' · standard') : ''),
              chip: (r, i, h) => { const z = M.hjemZoneStyle(h, { zones: [r] }, r.zone); return `<span class="xchip" style="background:${z.color};transition:background .3s">${M.icon(z.icon, 18, 'color:#fafafa')}</span>`; },
              newRow: (h, cc, list) => { const used = new Set(list.map((z) => z.zone)); const z = M.all(h, 'zone', (s, id) => id !== 'zone.home' && !used.has(id))[0]; return { zone: z || '' }; },
              fields: [
                { type: 'entity', name: 'zone', label: 'Sone', domain: 'zone', required: true },
                { type: 'icon', name: 'icon', label: 'Ikon', auto: (r, h) => (r.zone && h && h.states[r.zone] && h.states[r.zone].attributes.icon) || 'mdi:map-marker', help: 'Tom = sonens eget ikon i HA' },
                { type: 'select', name: 'icon', label: 'Hurtigvalg', options: ZICONS.map((ic) => [M.iconName(ic), ic.replace(/_/g, ' ')]) },
                { type: 'color', name: 'color', label: 'Farge', auto: (r) => M.hjemZonePal(r.zone), help: 'Tom = fast farge fra paletten for sonen' },
              ] },
            { type: 'info', label: 'Hjemme (zone.home) har alltid grønt hus.' },
            { type: 'boolean', name: 'away_marker', label: 'Borte · vis grå markør', default: false, help: 'Av: borte-personer vises dempet uten merke.' },
          ] },
          { type: 'section', label: 'Hilsen', icon: 'mdi:hand-wave', fields: [
            { type: 'text', name: 'greeting', label: 'Hilsen', placeholder: D.greeting },
            { type: 'tokens', target: 'greeting', tokens: [['+ Fornavn', '{name}'], ['+ Sted', '{server}'], ['+ 👋', '👋 ', true]] },
            { type: 'info', label: '{name} blir fornavnet ditt, {server} stedet du er på.' },
          ] },
          { type: 'section', label: 'Bilder', icon: 'mdi:account-circle', fields: [
            { type: 'select', name: 'size', label: 'Størrelse', options: [['S', 'Liten'], ['M', 'Middels'], ['L', 'Stor']], default: D.size },
            { type: 'select', name: 'badge', label: 'Merke', options: [['icon', 'Ikon'], ['dot', 'Prikk'], ['ring', 'Ring'], ['none', 'Ingen']], default: D.badge },
            { type: 'boolean', name: 'show_name', label: 'Vis navn', default: false },
            { type: 'boolean', name: 'show_place', label: 'Vis sted · Hjemme, sonen eller Borte under bildet', default: false },
            { type: 'boolean', name: 'ring_me', label: 'Ring rundt meg · markerer bildet ditt', default: false },
            { type: 'boolean', name: 'weather_tap', label: 'Trykk på været åpner Vær · gjelder «Hjem» og «Profil»', default: true },
            { type: 'hash', name: 'weather_hash', label: 'Vær-popup', placeholder: D.weather_hash },
            { type: 'select', name: 'person_tap', label: 'Trykk på person', options: [['quick', 'Hurtigark'], ['popup', 'Åpne #person-<id>']], default: D.person_tap },
          ] },
          { type: 'section', label: 'Steder (servermeny)', icon: 'mdi:swap-horizontal', fields: [
            { type: 'rows', name: 'servers', label: 'Bytt sted – Home Assistant-installasjoner (også denne)', defaults: () => [], addLabel: 'Legg til sted',
              help: 'Trykk på stedsnavnet/hilsenen åpner menyen (se «Handlinger på tittelen»). «Du er her» settes på stedet med samme adresse (origin) som dashbordet eller hassUrl – ingen treff gir «Denne serveren · <host>». Trykk på et annet sted åpner samme dashbord og popup der (adresse + sti + #hash).',
              title: (r) => r.name || 'Nytt sted', sub: (r) => r.url || '',
              chip: (r) => `<span class="xchip" style="border-radius:12px;background:${M.alpha(M.color(r.color, C.blue), 0.35)};color:${M.color(r.color, C.blue)}">${M.icon(r.icon || 'mdi:home', 18)}</span>`,
              newRow: (h, cc, list) => ({ name: '', icon: 'mdi:home', color: ZCOLS[(list.length + 2) % ZCOLS.length], url: '' }),
              fields: [{ type: 'text', name: 'name', label: 'Navn' }, { type: 'text', name: 'url', label: 'Adresse', placeholder: 'https://…' }, { type: 'icon', name: 'icon', label: 'Ikon' }, { type: 'color', name: 'color', label: 'Farge' }] },
            { type: 'text', name: 'place_name', label: 'Navn på dette stedet', auto: (h) => (h && h.config && h.config.location_name) || 'Hjem' },
          ] },
          { type: 'overrides', label: 'Bytt entiteter', fields: [
            { name: 'weather', label: 'Vær', domain: 'weather', auto: (h) => M.all(h, 'weather')[0] },
            ...P.ids.flatMap((id) => [
              { name: 'sover_' + objId(id), label: `${M.name(hass, id)} · søvn`, domains: ['input_boolean', 'binary_sensor', 'switch'], auto: (h) => sibling(h, id, SLEEP_RE, ['input_boolean', 'binary_sensor', 'switch']) },
            ]),
          ] },
        ];
      };
    }
    get cardSize() { return 2; }
    customize(focus) { return M.hjemCustomize(this, focus); }
    // Gjeldende server = den der new URL(url).origin er lik location.origin eller origin til hass.auth.data.hassUrl.
    // Ingen treff → cur = -1 (ingen «Du er her»; menyen viser «Denne serveren · <host>»). Ingen lokal «valgt»-tilstand.
    _server() {
      const c = this.config, h = this.hass;
      const here = c.place_name || (h && h.config && h.config.location_name) || 'Hjem';
      const list = Array.isArray(c.servers) ? c.servers.filter((x) => x && x.name) : [];
      const org = (u) => { try { return new URL(u).origin; } catch (e) { return null; } };
      const mine = [location.origin, org(h && h.auth && h.auth.data && h.auth.data.hassUrl)].filter(Boolean);
      const cur = list.findIndex((x) => x.url && mine.includes(org(x.url)));
      return { name: cur >= 0 ? list[cur].name : here, list, cur, host: location.host || here };
    }
    _weather() {
      const id = M.pick(this.config, 'weather', M.all(this.hass, 'weather')[0]);
      const s = this.s(id);
      if (!s || M.unavailable(s)) return { id, text: '' };
      const t = s.attributes.temperature;
      return { id, text: `${t != null ? M.nf(Number(t), 0) + ' °C · ' : ''}${M.hjemCond(s.state)}` };
    }
    render() {
      const c = this.config, h = this.hass, Md = c.mode || 'familie';
      const rd = (id) => this.s(id);
      const P = M.hjemPersons(h, c);
      const people = P.visible.map((id) => M.hjemPersonInfo(h, id, c, rd));
      const meP = people.find((p) => p.me);
      const userFirst = firstName((h.user && h.user.name) || (meP && meP.name) || '');
      const srv = this._server();
      const fill = (t) => String(t || '').replace(/\{name\}/g, userFirst).replace(/\{server\}/g, srv.name);
      const greet = fill(c.greeting != null ? c.greeting : '👋 {name}!');
      const title = ['sted', 'hjem', 'profil'].includes(Md) ? srv.name : Md === 'navn' ? userFirst || greet : greet;
      const W = this._weather();
      const sub = Md === 'under' ? srv.name : (Md === 'hjem' || Md === 'profil') ? (W.text || '–') : '';
      const big = Md === 'stor';
      // tittelstil (designets hdr.titleStyle)
      let fs = '30px', fw = 600, ls = '-0.03em', ht = '34px', pb = '0';
      const prof = Md === 'profil';
      const pTitle = clampN(c.title_size, 28, 48, 36), pPic = clampN(c.pic_size, 40, 72, 60), pPers = clampN(c.persons_size, 32, 56, 46);
      if (prof) { fs = pTitle + 'px'; fw = 500; ls = '-0.02em'; ht = 'auto'; pb = '0'; }
      else if (Md === 'kompakt') { fs = '22px'; ht = '26px'; }
      else if (big) {
        const r = [...greet].reduce((t, ch) => t + (/\s/.test(ch) ? 0.27 : /[iltjf!.,:;'|]/.test(ch) ? 0.3 : /[mwMW]/.test(ch) ? 0.82 : /[A-ZÆØÅ]/.test(ch) ? 0.64 : /[a-zæøå0-9?]/.test(ch) ? 0.56 : ch.codePointAt(0) > 0x2000 ? 1.15 : 0.55), 0) + 0.9;
        fs = this._gFit ? this._gFit + 'px' : `min(${(97 / Math.max(r, 1)).toFixed(2)}cqw, ${Number(c.g_font) || 4.5}em)`; fw = 500; ls = '-0.02em'; ht = 'auto'; pb = '4px';
      }
      const gAv = Number(c.g_avatar) || 50, gBadge = Number(c.g_badge) || 20, gGap = c.g_gap != null && c.g_gap !== '' && !isNaN(Number(c.g_gap)) ? Number(c.g_gap) : -8;
      // Avatar som originalen: 55×55, border-radius 25 (skaleres likt for Liten/Stor og de store oppsettene).
      const szN = big ? gAv : ({ S: 40, M: 55, L: 64 }[c.size] || 55);
      const SZ = big ? `clamp(30px, ${(gAv / 4.2).toFixed(2)}cqw, ${gAv}px)` : szN + 'px';
      const RAD = big ? `calc(${SZ} * ${(25 / 55).toFixed(4)})` : Math.round((szN * 25) / 55) + 'px';
      const bad = this._picBad;
      const ov = !c.show_name && !c.show_place && !big;
      const face = (p, k, dress) => {
        const ring = c.badge === 'ring' && !dress && p.badge ? `, 0 0 0 5px ${p.stCol}` : '';
        const meRing = p.me && c.ring_me && !dress ? `, 0 0 0 7px ${C.pink}` : '';
        const sz = dress ? dress.sz + 'px' : SZ, rad = dress ? '50%' : RAD, n = dress ? dress.sz : szN;
        // Profil: runde bilder; uten bilde → initialer 18 px/500 på grå 300 (ikon bare når visning = Ikon).
        const ini = dress && p.display !== 'icon' && !(p.pic && !(bad && bad.has(p.pic)));
        const av = ini
          ? `width:${sz};height:${sz};border-radius:50%;background:var(--gray300,#404040);opacity:${p.dim ? 0.55 : 1};font-size:18px;font-weight:500;color:var(--white,#fafafa);transition:opacity .3s`
          : `width:${sz};height:${sz};border-radius:${rad};background:${p.bg};box-shadow:${dress ? 'none' : `0 0 0 3px ${C.dash}${ring}${meRing}`};opacity:${p.dim ? 0.55 : 1};font-size:${faceTxt(p, bad) ? `calc(${sz} * 0.38)` : '0'};font-weight:600;color:#232323;transition:opacity .3s,box-shadow .3s`;
        let bd = '', bi = '';
        // Status-merke (profil): 21 px sirkel grå 100 øverst til høyre, ikon 12 px grønt (hjemme) / grå 700 (borte).
        // Merke = status (M.personStatus): hjemme-bryter → sone → borte. Borte uten away_marker / ukjent → ingen merke.
        if (!p.badge) { /* ingen merke */ }
        else if (dress) { bd = `right:0;top:0;transform:translate(30%,-15%);width:${dress.bs}px;height:${dress.bs}px;border-radius:50%;background:var(--gray100,#2f2f2f);z-index:1`; bi = M.icon(p.glyph, 12, `color:${p.stCol};transition:color .3s`); }
        else if (big) { bd = `right:${-gBadge * 0.3}px;top:${-gBadge * 0.3}px;width:${gBadge}px;height:${gBadge}px;border-radius:${gBadge / 2}px;background:${p.stCol};z-index:1`; bi = M.icon(p.glyph, Math.round(gBadge * 0.6), 'color:#fafafa'); }
        else if (c.badge === 'icon') { bd = `right:-4px;top:-4px;width:22px;height:22px;border-radius:11px;background:${p.stCol};box-shadow:0 0 0 2px ${C.dash}`; bi = M.icon(p.glyph, 13, 'color:#fafafa'); }
        else if (c.badge === 'dot') bd = `right:1px;top:1px;width:12px;height:12px;border-radius:6px;background:${p.stCol};box-shadow:0 0 0 2px ${C.dash}`;
        const ml = dress ? 0 : k ? (ov ? -8 : big ? gGap : 6) : 0; // stor: g_gap < 0 = overlapp (standard −8 som MySmartHome)
        const lbl = !dress && !ov && (c.show_name || c.show_place) ? `<span class="lb">${c.show_name ? `<span class="ln">${esc(p.first)}</span>` : ''}${c.show_place ? `<span class="lp">${esc(p.place)}</span>` : ''}</span>` : '';
        return `<button class="face press" data-key="${esc(p.id)}" data-act="person" data-id="${esc(p.id)}" data-ent="${esc(p.id)}" title="${esc(p.name)} · ${esc(p.place)}" style="margin-left:${ml}px">
          <span class="fw"><span class="av" style="${av}">${ini ? esc(p.initial) : faceInner(p, n, bad)}</span>${bd ? `<span class="bd" style="${bd}">${bi}</span>` : ''}</span>${lbl}</button>`;
      };
      let faces = people, row2 = [];
      if (Md === 'profil') { const me = meP || people[0]; faces = me ? [me] : []; row2 = people.filter((p) => p !== me); }
      const facesHTML = Md === 'profil' ? faces.map((p) => face(p, 0, { sz: pPic, bs: 21 })).join('') : faces.map((p, k) => face(p, k)).join('');
      const empty = !people.length ? `<button class="nop press" data-act="customize" data-section="entities">${M.icon('person_add', 20)}</button>` : '';
      this._sheets && this._sheets.forEach((sh) => sh.update());
      const TA = M.hjemTitleActions(c);
      const tTip = TGESTS.filter(([g]) => TA[g] !== 'none').map(([g, l]) => `${l}: ${TACT_L[TA[g]]}`).join(' · ') || esc(title);
      return `<header class="hd${prof ? ' prof' : ''}" data-ent="__tilpass">
        <div class="top">
          <div class="lc" data-gcol="1">
            <button class="ttl" data-act="title" style="font-size:${fs};font-weight:${fw};letter-spacing:${ls};height:${ht};padding-block:${pb}" data-haptic="off" ${TA.tap === 'server' ? 'aria-haspopup="menu"' : ''} title="${esc(tTip)}">
              <span class="tx">${esc(title)}</span>${big ? M.icon('arrow_drop_down', 26, 'color:#afafaf;--mdc-icon-size:.62em;width:.5em;height:.62em;margin-left:-.06em;overflow:visible') : prof ? M.icon('mdi:chevron-down', 14, 'color:var(--gray800,#afafaf);flex:none') : M.icon('arrow_drop_down', 26, 'color:#afafaf')}
            </button>
            ${sub ? `<button class="sub" ${c.weather_tap !== false && Md !== 'under' ? `data-act="popup" data-hash="${esc(c.weather_hash || '#vaer')}"` : ''} ${W.id && Md !== 'under' ? `data-ent="${esc(W.id)}"` : ''} style="cursor:${c.weather_tap !== false && Md !== 'under' ? 'pointer' : 'default'}">${esc(sub)}</button>` : ''}
          </div>
          <div class="faces">${facesHTML}${empty}</div>
        </div>
        ${row2.length ? `<div class="row2">${row2.map((p) => face(p, 0, { sz: pPers, bs: 21 })).join('')}</div>` : ''}
      </header>`;
    }
    constructor() {
      super();
      // Tittel-gester: hold avbrytes ved slipp / flytt > 8 px / pointercancel
      const stop = () => { if (this._tHold) { clearTimeout(this._tHold); this._tHold = null; } };
      this.shadowRoot.addEventListener('pointerup', stop);
      this.shadowRoot.addEventListener('pointercancel', stop);
      this.shadowRoot.addEventListener('pointermove', (e) => { if (this._tHold && (Math.abs(e.clientX - this._tx) > 8 || Math.abs(e.clientY - this._ty) > 8)) stop(); });
      this.shadowRoot.addEventListener('contextmenu', (e) => { if (this._el(e, '.ttl')) e.preventDefault(); });
      this.shadowRoot.addEventListener('selectstart', (e) => { if (this._el(e, '.ttl')) e.preventDefault(); });
    }
    // Tittelen har egne gester (title_actions); resten av headeren bruker basekortets hold (→ «Tilpass header»).
    _onDown(e) {
      const t = this._el(e, '.ttl');
      if (!t) return super._onDown(e);
      this._cancelHold();
      if (e.button) return;
      this._tHeld = false;
      if (this._tHold) clearTimeout(this._tHold);
      this._tHold = null;
      const A = M.hjemTitleActions(this.config);
      if (A.hold === 'none') return;
      this._tx = e.clientX; this._ty = e.clientY;
      this._tHold = setTimeout(() => {
        this._tHold = null;
        this._tHeld = true; // slippet etter hold utløser ikke trykk
        if (this._tTap) { clearTimeout(this._tTap); this._tTap = null; }
        M.haptic('medium');
        this._titleRun(A.hold);
      }, 500);
    }
    // Trykk (click): med dobbelttrykk = Ingen kjøres trykket med én gang, ellers venter det maks 260 ms.
    // Én haptic per gest: ved første trykk (ikke igjen ved dobbelttrykk / når handlingen kjøres).
    _titleTap() {
      if (this._tHeld) { this._tHeld = false; return; }
      const A = M.hjemTitleActions(this.config);
      if (this._tTap) { clearTimeout(this._tTap); this._tTap = null; this._titleRun(A.double_tap); return; }
      if (A.tap !== 'none' || A.double_tap !== 'none') M.haptic('light');
      if (A.double_tap === 'none') { this._titleRun(A.tap); return; }
      this._tTap = setTimeout(() => { this._tTap = null; this._titleRun(A.tap); }, 260);
    }
    _titleRun(act) {
      const c = this.config;
      switch (act) {
        case 'server': { if (this._srv) return this._srvClose(); const t = this.shadowRoot.querySelector('.ttl'); if (t) this._serverMenu(t); return; }
        case 'kiosk': return this._kiosk();
        case 'config': this._srvClose(); return M.navigate('/config');
        case 'edit': this._srvClose(); return M.navigate(location.pathname + '?edit=1');
        case 'header': this._srvClose(); window.dispatchEvent(new CustomEvent('ki-open-editor', { detail: { editor: 'header' } })); return;
        case 'vaer': this._srvClose(); return M.openPopup(c.weather_hash || '#vaer');
        default:
      }
    }
    // Kiosk-modus av/på: veksler kiosk_entity (standard input_boolean.kiosk_mode) – samme entitet som kiosk-mode / UIX bruker.
    _kiosk() {
      const id = M.hjemKioskEntity(this.config), s = this.hass && this.hass.states[id];
      if (!s) { M.hjemToast(this, 'Velg kiosk-entitet i Tilpass header'); return; }
      const on = s.state === 'on', d = id.split('.')[0];
      M.call(this.hass, d === 'input_boolean' ? 'input_boolean' : 'homeassistant', 'toggle', { entity_id: id });
      M.hjemToast(this, `Kiosk-modus ${on ? 'av' : 'på'}`);
    }
    onAction(name, el, ev) {
      if (name === 'title') {
        if (ev) ev.stopPropagation();
        return this._titleTap();
      }
      if (name === 'person') {
        const id = el.dataset.id;
        if (this.config.person_tap === 'popup') return M.openPopup('#person-' + objId(id));
        return this._quick(id);
      }
      return super.onAction(name, el, ev);
    }
    // Langt trykk ellers i headeren (ikke tittelen – den har egne gester) → «Tilpass header».
    onHold(id) {
      if (id !== '__tilpass') return undefined;
      window.dispatchEvent(new CustomEvent('ki-open-editor', { detail: { editor: 'header' } }));
      return true;
    }
    // Bakteppet ignorerer trykk de første 300 ms (guard), så trykket som åpnet (touch → click) aldri lukker menyen igjen.
    // Haptic gis av gesten (_titleTap), ingen ved lukking via bakteppet.
    _srvClose() { if (this._srv) this._srv.close(); }
    _serverMenu(anchor) {
      const R = M.dashRect(), a = anchor.getBoundingClientRect();
      const S = this._server();
      const top = S.cur < 0 ? `<div class="me">${M.icon('mdi:map-marker-outline', 16, 'color:#7f7f7f')}<span>Denne serveren · ${esc(S.host)}</span></div>` : '';
      const rows = S.list.map((v, i) => {
        const act = i === S.cur, col = M.color(v.color, C.blue);
        return `<button class="sv" data-a="go" data-i="${i}" style="background:${act ? 'rgba(255,255,255,0.08)' : 'transparent'}"><span class="iw" style="background:${M.alpha(col, 0.35)};color:${col}">${M.icon(v.icon || 'mdi:home', 20)}</span><span class="nm">${esc(v.name)}</span>${act ? '<span class="here">Du er her</span>' : M.icon('chevron_right', 20, 'color:#979797')}</button>`;
      }).join('');
      const css = `.bg{background:transparent}
        .sh{left:${Math.max(8, a.left - R.left)}px;right:auto;top:${a.bottom + 8}px;bottom:auto;width:256px;max-width:calc(100% - 16px);margin:0;padding:10px 6px 6px;border-radius:24px;background:rgba(58,58,58,0.92);backdrop-filter:blur(24px) saturate(190%);-webkit-backdrop-filter:blur(24px) saturate(190%);box-shadow:inset 0 1px 0 rgba(255,255,255,0.18),0 18px 40px rgba(0,0,0,0.5);
          opacity:0;transform:scale(.96);transform-origin:top left;transition:opacity .14s ease-out,transform .14s ease-out}
        :host(.on) .sh{opacity:1;transform:none}
        .body{display:flex;flex-direction:column;gap:2px}
        .hd{font-size:11px;font-weight:500;color:#979797;padding:0 10px 4px}
        .me{display:flex;align-items:center;gap:8px;min-height:32px;padding:0 10px;font-size:12px;color:#7f7f7f;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .me span{min-width:0;overflow:hidden;text-overflow:ellipsis}
        .sv{height:52px;padding:0 8px;border-radius:14px;display:flex;align-items:center;gap:12px;width:100%;text-align:left}
        .sv:hover{background:rgba(255,255,255,0.06)}
        .iw{width:38px;height:38px;border-radius:11px;flex:none;display:grid;place-items:center}
        .nm{flex:1;min-width:0;font-size:15px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .here{height:22px;padding:0 9px;border-radius:11px;display:flex;align-items:center;font-size:11px;font-weight:600;background:rgb(115 185 242);color:#1f2a36;white-space:nowrap;flex:none}`;
      const ov = M.overlay({ html: `<span class="hd">Bytt sted</span>${top}${rows}`, css, sheet: false, maxWidth: 256, guard: 300, bgHaptic: false, onClose: () => { if (this._srv === ov) this._srv = null; } });
      this._srv = ov;
      ov.root.addEventListener('click', (e) => {
        const b = e.composedPath().find((n) => n && n.dataset && n.dataset.a);
        if (!b) return;
        const i = Number(b.dataset.i), v = S.list[i];
        M.haptic('light');
        ov.close();
        // Samme dashbord og popup (hash) på den andre serveren
        if (v && v.url && i !== S.cur) window.location.href = String(v.url).replace(/\/$/, '') + location.pathname + location.hash;
      });
    }
    _quick(pid) {
      const card = this;
      const render = () => {
        const c = card.config, h = card.hass, p = M.hjemPersonInfo(h, pid, c, (x) => card.s(x));
        const zi = p.home ? 0 : 1, si = p.sleep ? 1 : 0;
        return `<div class="orb pic" style="background:${p.bg};font-size:${faceTxt(p, card._picBad) ? 36 : 0}px;box-shadow:0 0 0 4px var(--gray000,#232323),0 0 0 6px ${p.home ? C.green : C.purple}">${faceInner(p, 96, card._picBad)}</div>
          <div class="nm"><b>${esc(p.name)}</b><span>${esc(p.home ? 'Hjemme' : p.place)} · ${p.sleep ? 'Sover' : 'Våken'}</span></div>
          ${segHTML('zone', zi, [['home', 'Hjemme', 0, C.green], ['logout', 'Borte', 1, C.blue]], !p.presId)}
          ${segHTML('sleep', si, [['light_mode', 'Våken', 0, C.orange], ['bedtime', 'Sover', 1, C.purple]], !p.sleepId)}
          <button class="done" data-a="close">Ferdig</button>
          <button class="more" data-a="details">Mobil, soner og søvn${M.icon('chevron_right', 18)}</button>`;
      };
      const setSeg = (key, i) => {
        const p = M.hjemPersonInfo(card.hass, pid, card.config);
        const ent = key === 'zone' ? p.presId : p.sleepId;
        if (!ent) { M.hjemToast(card, key === 'zone' ? 'Hjemme/borte styres av sporing' : 'Velg søvn-entitet i tilpasning'); return; }
        const on = key === 'zone' ? i === 0 : i === 1;
        const d = ent.split('.')[0];
        if (d === 'binary_sensor') { M.moreInfo(card, ent); return; }
        M.call(card.hass, d === 'switch' ? 'switch' : 'input_boolean', on ? 'turn_on' : 'turn_off', { entity_id: ent });
      };
      M.hjemSheet(card, {
        render,
        onAct(a, el, sheet) {
          if (a === 'seg') { const seg = el.closest('.seg'); if (seg && seg.__dragged) return; setSeg(el.dataset.seg, Number(el.dataset.i)); }
          if (a === 'details') { sheet.ov.close(); setTimeout(() => M.openPopup('#person-' + objId(pid)), 30); }
        },
        drag(seg, e, sheet) { M.hjemSegDrag(seg, e, (i) => { setSeg(seg.dataset.seg, i); sheet.update(); }); },
      });
    }
    afterRender() {
      // Bilde som ikke laster → ikon (huskes per URL)
      this.shadowRoot.querySelectorAll('img[data-pic]').forEach((img) => {
        if (img.__e) return;
        img.__e = true;
        const fail = () => { (this._picBad = this._picBad || new Set()).add(img.dataset.pic); this.update(); };
        img.addEventListener('error', fail);
        if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) fail();
      });
      // Stor hilsen: tilpass skriftstørrelsen til tilgjengelig bredde (som gFitNow i designet)
      if ((this.config.mode || 'familie') === 'stor') {
        const col = this.shadowRoot.querySelector('.lc');
        if (col && !this._ro && window.ResizeObserver) { this._ro = new ResizeObserver((en) => { const w = Math.round(en[0].contentRect.width); if (w === this._roW) return; this._roW = w; this._gFit = null; this.update(); }); this._ro.observe(col); }
        requestAnimationFrame(() => {
          const sp = this.shadowRoot.querySelector('.ttl .tx'), cl = this.shadowRoot.querySelector('.lc');
          if (!sp || !cl) return;
          // chevron ▾ etter navnet (0,5em + 6 px kolonnegap) trekkes fra tilgjengelig bredde
          const fs = parseFloat(getComputedStyle(sp).fontSize) || 30, w = sp.scrollWidth + fs * 0.5 + 6, avail = cl.clientWidth - 2;
          if (!w || !avail) return;
          const max = (Number(this.config.g_font) || 4.5) * 16, n = Math.max(20, Math.min(max, Math.floor(((fs * avail) / w) * 0.985 * 10) / 10));
          if (Math.abs(n - (this._gFit || fs)) > 0.4) { this._gFit = n; this.update(); }
        });
      } else if (this._ro) { this._ro.disconnect(); this._ro = null; this._gFit = null; }
    }
    disconnectedCallback() {
      super.disconnectedCallback();
      if (this._ro) { this._ro.disconnect(); this._ro = null; }
      clearTimeout(this._tHold); clearTimeout(this._tTap); this._tHold = this._tTap = null;
    }
    get styles() {
      return `
        .hd{display:flex;flex-direction:column;gap:18px;padding-top:8px}
        .top{container-type:inline-size;display:flex;align-items:center;justify-content:space-between;gap:10px}
        .lc{display:flex;flex-direction:column;gap:6px;min-width:0;flex:1 1 0}
        .ttl{display:flex;flex-wrap:nowrap;align-items:center;column-gap:6px;row-gap:0;line-height:1;white-space:nowrap;min-width:0;max-width:100%;overflow:hidden;text-align:left;color:var(--white,#fafafa);touch-action:manipulation;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent}
        .ttl .tx{flex:0 1 auto;min-width:0;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .sub{align-self:flex-start;font-size:15px;color:var(--gray700,#979797);white-space:nowrap;text-align:left}
        .sub:active{opacity:.6}
        .faces{display:flex;flex:none;align-items:flex-start}
        .face{position:relative;display:flex;flex-direction:column;align-items:center;gap:4px;flex:none}
        .fw{position:relative;display:block}
        .av{display:grid;place-items:center;overflow:hidden;position:relative}
        .av img{display:block;width:100%;height:100%;object-fit:cover;border-radius:inherit;-webkit-user-drag:none;user-select:none;pointer-events:none}
        .bd{z-index:1}
        .bd{position:absolute;display:grid;place-items:center;transition:background-color .3s,color .3s}
        .lb{display:flex;flex-direction:column;align-items:center}
        .ln{font-size:11px;font-weight:500}
        .lp{font-size:10px;color:var(--gray700,#979797)}
        .row2{display:flex;flex-wrap:wrap;gap:14px;padding:4px 0 0 2px}
        /* Profil. Personer → prosa: 22 px synlig avstand (containerens gap 22 + prosaens luft over første linje − 8) */
        .prof{gap:22px;margin-bottom:-8px}
        .prof .top{align-items:flex-start}
        .prof .ttl{line-height:1.1;column-gap:10px;flex-wrap:wrap}
        /* chevron ▾ alltid rett etter navnet (samme linje); navnet kortes heller med … */
        .prof .sub{color:var(--gray800,#afafaf)}
        .prof .row2{gap:14px;padding:0}
        .nop{width:52px;height:52px;border-radius:26px;display:grid;place-items:center;background:var(--gray200,#3a3a3a);color:var(--gray700,#979797)}
      `;
    }
  }
  M.define('msh-hjem-header-card', HjemHeader, 'MSH Hjem · header', 'Hilsen, vær og personprofiler med soner, hurtigark og servermeny. Ligger på Hjem-visningen.');
})();
