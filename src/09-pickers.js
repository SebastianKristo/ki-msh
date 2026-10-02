/* KI MSH · systemets innebygde velgere i input-felt (fiks-4 punkt 4.5).
 * Stepper «− verdi +»: verdien er selv trykkbar og ligger over et usynlig, fullflates native felt
 * (opacity 0, font-size 16px så iOS ikke zoomer, color-scheme dark) → iOS-/Android-hjulet og desktop-velgeren.
 *   time / input_datetime (bare tid) → <input type="time" step>   (step i sekunder)
 *   number / input_number            → <select> med gyldige verdier min–max i step (maks 300 rundt nåverdien)
 *   datetime / input_datetime (dato+tid) → <input type="datetime-local">,  date / input_datetime (bare dato) → type="date"
 * Mangler entiteten → «–» og deaktivert. Radene med steppere er <div>, aldri <button> (native felt virker ikke i knapper).
 *
 *   M.stepperHTML(hass, entityId, opts) → HTML. opts: { label?, sub?, unit?, decimals?, key?, min?, max?, step?, jump?, disabled? }
 *       label gir en hel rad (.msh-stp-row); uten label bare kontrollen. step for tid = sekunder (native felt),
 *       jump = hopp for −/+ på tid/dato-tid (sek, standard = step om gitt, ellers 15 min).
 *     Lokal modus (config-verdi, ingen entitet): entityId = null og opts.kind ('number'|'time'|'date'|'datetime'),
 *       opts.value, opts.placeholder (auto-verdi, vises dempet når tom), opts.empty (tekst for tomt valg, f.eks. 'Auto'),
 *       opts.attrs (ekstra attributter på det native feltet, f.eks. data-f/data-t). Endringer sendes som vanlig
 *       'change'-event på det native feltet (også ved −/+), så verten lagrer selv.
 *   M.STEPPER_CSS                     → CSS (kortene har shadow DOM og må inkludere den)
 *   M.bindSteppers(root, card)        → idempotent, delegert på root (overlever morph). −/+ og valg → riktig tjeneste
 *       (number/input_number.set_value, time.set_value, date.set_value, datetime.set_value, input_datetime.set_datetime),
 *       haptic('selection'). card._pickerFocus = true mens et native felt har fokus (MshCard._render venter).
 *   M.pickerBusy(root)                → true når fokus er i et native velgerfelt i root
 *   M.pickerInputHTML(opts)           → vanlig <input> for fritekst/entitets-ID (inputmode, autocapitalize=off).
 *       opts: { value?, placeholder?, attrs?, inputmode?, type?, list?, cls?, label?, key? }
 *   M.pickerWrite(hass, id, value, kind?) → skriv en verdi til entiteten med riktig tjeneste
 */
(function () {
  const M = window.MSH;
  if (!M || M.stepperHTML) return;
  const esc = M.esc, pad = (n) => String(n).padStart(2, '0');
  const PEND = {}; // entity → { v, t } (optimistisk verdi mens HA svarer)

  const decOf = (x) => { const s = String(x); return s.includes('e-') ? Number(s.split('e-')[1]) : (s.split('.')[1] || '').length; };
  const round = (v, d) => Number(Number(v).toFixed(d));

  M.pickerKind = function (hass, id) {
    const d = String(id || '').split('.')[0], s = M.st(hass, id);
    if (d === 'number' || d === 'input_number') return 'number';
    if (d === 'time' || d === 'date' || d === 'datetime') return d;
    if (d === 'input_datetime') { const a = (s && s.attributes) || {}; return a.has_date && a.has_time ? 'datetime' : a.has_date ? 'date' : 'time'; }
    return null;
  };

  // Tilstand → native verdi
  function nativeOf(kind, dom, state, secs) {
    if (state == null || state === '' || state === 'unknown' || state === 'unavailable') return '';
    const s = String(state);
    if (kind === 'number') return M.isNum(s) ? Number(s) : '';
    if (kind === 'time') { const m = /(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(s); return m ? `${pad(m[1])}:${m[2]}${secs ? ':' + (m[3] || '00') : ''}` : ''; }
    if (kind === 'date') { const m = /^(\d{4}-\d{2}-\d{2})/.exec(s); return m ? m[1] : ''; }
    if (kind === 'datetime') {
      if (dom === 'input_datetime' || !/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) { const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/.exec(s); return m ? m[1] + 'T' + m[2] : ''; }
      const t = new Date(s);
      return isNaN(t) ? '' : `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}T${pad(t.getHours())}:${pad(t.getMinutes())}`;
    }
    return '';
  }
  // Native verdi → visningstekst
  function fmt(kind, v, dec, unit) {
    if (v === '' || v == null) return '–';
    if (kind === 'number') return M.nf(Number(v), dec) + (unit ? (unit === '%' || unit === '°' ? '' : ' ') + unit : '');
    if (kind === 'time') return String(v).slice(0, String(v).length > 5 && !/:00$/.test(v) ? 8 : 5);
    if (kind === 'date') { const t = new Date(v + 'T12:00:00'); return isNaN(t) ? String(v) : t.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: t.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined }); }
    if (kind === 'datetime') { const t = new Date(v); return isNaN(t) ? String(v) : `${t.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })} ${pad(t.getHours())}:${pad(t.getMinutes())}`; }
    return String(v);
  }
  // Gyldige tallverdier for <select> (maks 300 rundt nåverdien)
  function numOptions(v, min, max, step, dec) {
    const base = v != null && v !== '' ? Number(v) : min != null ? min : 0;
    if (min == null) min = base - 150 * step;
    if (max == null) max = base + 150 * step;
    const n = Math.max(1, Math.floor((max - min) / step + 1e-9) + 1);
    let a = 0, b = n;
    if (n > 300) { const i0 = Math.round((base - min) / step); a = M.clamp(i0 - 150, 0, n - 300); b = a + 300; }
    const out = [];
    for (let i = a; i < b; i++) out.push(round(min + i * step, dec));
    if (v !== '' && v != null && !out.includes(round(v, dec))) { out.push(round(v, dec)); out.sort((x, y) => x - y); }
    return out;
  }
  const toSecs = (v) => { const m = /(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(String(v || '')); return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3] || 0) : null; };
  const fromSecs = (s, secs) => { s = ((s % 86400) + 86400) % 86400; const h = Math.floor(s / 3600), mi = Math.floor((s % 3600) / 60), se = s % 60; return `${pad(h)}:${pad(mi)}${secs ? ':' + pad(se) : ''}`; };
  const localDT = (t) => `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}T${pad(t.getHours())}:${pad(t.getMinutes())}`;

  M.stepperHTML = function (hass, entityId, opts) {
    opts = opts || {};
    const local = !entityId && !!opts.kind;
    const s = entityId ? M.st(hass, entityId) : null;
    const dom = entityId ? entityId.split('.')[0] : '';
    const kind = local ? opts.kind : M.pickerKind(hass, entityId);
    const a = (s && s.attributes) || {};
    const dead = !local && (!s || !kind || M.unavailable(s));
    const dis = dead || !!opts.disabled;
    const num = (x) => (x != null && x !== '' && !isNaN(Number(x)) ? Number(x) : null);
    const min = num(opts.min != null ? opts.min : a.min), max = num(opts.max != null ? opts.max : a.max);
    const secsT = kind === 'time' && num(opts.step) != null && Number(opts.step) < 60;
    const step = kind === 'number' ? (num(opts.step != null ? opts.step : a.step) || 1) : (num(opts.step) || 60);
    const jump = kind === 'number' ? step : num(opts.jump) || (opts.step != null ? step : kind === 'date' ? 86400 : 900);
    const dec = opts.decimals != null ? Number(opts.decimals) : kind === 'number' ? decOf(step) : 0;
    const unit = opts.unit != null ? opts.unit : a.unit_of_measurement || '';
    let v = local ? (opts.value == null ? '' : opts.value) : dead ? '' : nativeOf(kind, dom, s.state, secsT);
    if (!local && !dead) { const p = PEND[entityId]; if (p && Date.now() - p.t < 2000) v = p.v; }
    if (kind === 'number' && v !== '') v = Number(v);
    const ph = local ? (opts.placeholder == null ? '' : opts.placeholder) : '';
    const shown = v !== '' ? v : ph;
    const text = dead ? '–' : v === '' && opts.empty && ph === '' ? opts.empty : fmt(kind, shown, dec, unit);
    const muted = !dead && v === '' && (ph !== '' || opts.empty);
    const lab = opts.label || (s && a.friendly_name) || '';
    const attrs = local ? ' ' + (opts.attrs || '') : '';
    let field = '';
    if (kind === 'number') {
      const nv = shown === '' ? '' : Number(shown);
      const list = numOptions(nv, min, max, step, dec);
      const cur = v === '' ? (local && opts.empty != null ? '' : nv) : v;
      field = `<select class="msh-stp-n" value="${esc(cur)}" aria-label="${esc(lab)}"${dis ? ' disabled' : ''}${attrs}>`
        + (local && opts.empty != null ? `<option value=""${cur === '' ? ' selected' : ''}>${esc(opts.empty)}${ph !== '' ? ' · ' + esc(fmt(kind, ph, dec, unit)) : ''}</option>` : '')
        + list.map((x) => `<option value="${x}"${x === cur ? ' selected' : ''}>${esc(fmt('number', x, dec, unit))}</option>`).join('') + '</select>';
    } else if (kind) {
      const type = kind === 'time' ? 'time' : kind === 'date' ? 'date' : 'datetime-local';
      const nv = v !== '' ? v : /^\d/.test(String(ph)) ? ph : '';
      const st = kind === 'date' ? '' : ` step="${kind === 'time' ? step : Math.max(60, step)}"`;
      field = `<input class="msh-stp-n" type="${type}"${st} value="${esc(nv)}" aria-label="${esc(lab)}"${dis ? ' disabled' : ''}${attrs}>`;
    }
    const data = `data-stp="${esc(local ? '' : entityId || '')}" data-kind="${esc(kind || '')}" data-step="${step}" data-jump="${jump}" data-dec="${dec}" data-unit="${esc(unit)}"${min != null ? ` data-min="${min}"` : ''}${max != null ? ` data-max="${max}"` : ''}${ph !== '' ? ` data-ph="${esc(ph)}"` : ''}${secsT ? ' data-secs="1"' : ''}`;
    const ctl = `<div class="msh-stp${dis ? ' dis' : ''}" ${data}${!opts.label && opts.key ? ` data-key="${esc(opts.key)}"` : ''}>
      <button type="button" class="msh-stp-b" data-stp-d="-1" aria-label="Senk ${esc(lab)}"${dis ? ' disabled' : ''}>${M.icon('mdi:minus', 18)}</button>
      <span class="msh-stp-v"><span class="msh-stp-t${muted ? ' ph' : ''}">${esc(text)}</span>${dead ? '' : field}</span>
      <button type="button" class="msh-stp-b" data-stp-d="1" aria-label="Øk ${esc(lab)}"${dis ? ' disabled' : ''}>${M.icon('mdi:plus', 18)}</button></div>`;
    if (!opts.label) return ctl;
    return `<div class="msh-stp-row"${opts.key ? ` data-key="${esc(opts.key)}"` : ''}><span class="msh-stp-l"><span class="msh-stp-ln">${esc(opts.label)}</span>${opts.sub ? `<span class="msh-stp-ls">${esc(opts.sub)}</span>` : ''}</span>${ctl}</div>`;
  };

  M.pickerInputHTML = function (opts) {
    opts = opts || {};
    const inp = `<input class="msh-pick-in${opts.cls ? ' ' + esc(opts.cls) : ''}" type="${esc(opts.type || 'text')}" inputmode="${esc(opts.inputmode || 'text')}" autocapitalize="off" autocorrect="off" autocomplete="off" spellcheck="false" enterkeyhint="done"`
      + ` value="${esc(opts.value == null ? '' : opts.value)}" placeholder="${esc(opts.placeholder || '')}"${opts.list ? ` list="${esc(opts.list)}"` : ''}${opts.label ? ` aria-label="${esc(opts.label)}"` : ''}${opts.key ? ` data-key="${esc(opts.key)}"` : ''} ${opts.attrs || ''}>`;
    return inp;
  };

  M.pickerWrite = function (hass, id, value, kind) {
    if (!hass || !id) return Promise.resolve();
    const d = id.split('.')[0];
    kind = kind || M.pickerKind(hass, id);
    const e = { entity_id: id };
    if (d === 'number' || d === 'input_number') return M.call(hass, d, 'set_value', { ...e, value: Number(value) });
    if (kind === 'time') { const t = fromSecs(toSecs(value) || 0, true); return d === 'input_datetime' ? M.call(hass, d, 'set_datetime', { ...e, time: t }) : M.call(hass, 'time', 'set_value', { ...e, time: t }); }
    if (kind === 'date') return d === 'input_datetime' ? M.call(hass, d, 'set_datetime', { ...e, date: value }) : M.call(hass, 'date', 'set_value', { ...e, date: value });
    if (kind === 'datetime') {
      if (d === 'input_datetime') return M.call(hass, d, 'set_datetime', { ...e, datetime: String(value).replace('T', ' ').slice(0, 16) + ':00' });
      const t = new Date(value);
      return M.call(hass, 'datetime', 'set_value', { ...e, datetime: isNaN(t) ? value : t.toISOString() });
    }
    return Promise.resolve();
  };

  M.pickerBusy = function (root) {
    const a = root && root.activeElement;
    return !!(a && a.classList && a.classList.contains('msh-stp-n'));
  };

  function setText(w, v) {
    const t = w.querySelector('.msh-stp-t');
    if (!t) return;
    const d = w.dataset;
    const ph = d.ph != null ? d.ph : '';
    t.textContent = fmt(d.kind, v !== '' ? v : ph, Number(d.dec) || 0, d.unit || '');
    t.classList.toggle('ph', v === '' && ph !== '');
  }
  // Neste verdi for −/+
  function next(w, cur, dir) {
    const d = w.dataset, kind = d.kind, jump = Number(d.jump) || 1;
    if (cur === '' && d.ph != null) cur = d.ph;
    if (kind === 'number') {
      const step = Number(d.step) || 1, dec = Number(d.dec) || 0, min = d.min != null ? Number(d.min) : null, max = d.max != null ? Number(d.max) : null;
      let v = cur === '' ? (dir > 0 ? min : max) : Number(cur) + dir * step;
      if (v == null || isNaN(v)) v = 0;
      if (min != null) v = min + Math.round((v - min) / step) * step;
      v = round(M.clamp(v, min != null ? min : -Infinity, max != null ? max : Infinity), dec);
      return v;
    }
    if (kind === 'time') { const s = toSecs(cur); const base = s == null ? toSecs(new Date().toTimeString()) : s; return fromSecs(Math.round((base + dir * jump) / jump) * jump, !!d.secs); }
    if (kind === 'date') { const t = cur ? new Date(cur + 'T12:00:00') : new Date(); t.setDate(t.getDate() + dir); return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`; }
    if (kind === 'datetime') { const t = cur ? new Date(cur) : new Date(); const ms = jump * 1000; return localDT(new Date(Math.round((t.getTime() + dir * ms) / ms) * ms)); }
    return cur;
  }
  function ensureOption(sel, v, d) {
    if ([...sel.options].some((o) => o.value === String(v))) return;
    const o = document.createElement('option');
    o.value = String(v); o.textContent = fmt('number', v, Number(d.dec) || 0, d.unit || '');
    const after = [...sel.options].find((x) => x.value !== '' && Number(x.value) > Number(v));
    sel.insertBefore(o, after || null);
  }

  M.bindSteppers = function (root, card) {
    if (!root || root.__mshStp) return;
    root.__mshStp = true;
    const hassOf = () => (card && (card._hass || card.hass)) || M.lastHass;
    let ptype = '';
    const commit = (w, v, fromNative) => {
      const d = w.dataset, n = w.querySelector('.msh-stp-n');
      if (!d.stp) { // lokal modus: verten lagrer via 'change'
        if (!fromNative && n) {
          if (n.tagName === 'SELECT') ensureOption(n, v, d);
          n.value = String(v);
          setText(w, String(v));
          n.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
        } else setText(w, n ? n.value : v);
        return;
      }
      if (v === '' || v == null) return;
      M.haptic('selection');
      PEND[d.stp] = { v: d.kind === 'number' ? Number(v) : v, t: Date.now() };
      if (n && !fromNative) { if (n.tagName === 'SELECT') ensureOption(n, v, d); n.value = String(v); }
      setText(w, String(v));
      M.pickerWrite(hassOf(), d.stp, v, d.kind).catch(() => { delete PEND[d.stp]; if (card && card._schedule) card._schedule(true); });
    };
    root.addEventListener('click', (e) => {
      const b = e.target.closest && e.target.closest('.msh-stp-b');
      if (b) {
        const w = b.closest('.msh-stp');
        if (!w || b.disabled || w.classList.contains('dis')) return;
        e.stopPropagation();
        const n = w.querySelector('.msh-stp-n');
        const p = w.dataset.stp && PEND[w.dataset.stp];
        const cur = p && Date.now() - p.t < 2000 ? String(p.v) : n ? n.value : '';
        commit(w, next(w, cur, Number(b.dataset.stpD) || 1), false);
        return;
      }
      const n = e.target.classList && e.target.classList.contains('msh-stp-n') ? e.target : null;
      // Mus på PC: åpne velgeren direkte (touch åpner hjulet selv)
      if (n && n.tagName === 'INPUT' && ptype === 'mouse' && n.showPicker) { try { n.showPicker(); } catch (x) { /* */ } }
    });
    root.addEventListener('pointerdown', (e) => { ptype = e.pointerType || ''; }, true);
    root.addEventListener('change', (e) => {
      const n = e.target;
      if (!n || !n.classList || !n.classList.contains('msh-stp-n')) return;
      const w = n.closest('.msh-stp');
      if (w) commit(w, n.value, true);
    });
    root.addEventListener('focusin', (e) => { if (e.target && e.target.classList && e.target.classList.contains('msh-stp-n') && card) card._pickerFocus = true; });
    root.addEventListener('focusout', (e) => {
      if (!e.target || !e.target.classList || !e.target.classList.contains('msh-stp-n') || !card) return;
      card._pickerFocus = false;
      setTimeout(() => { if (M.pickerBusy(root)) return; if (card._schedule) card._schedule(true); else if (card._render) card._render(); }, 0);
    });
  };

  M.STEPPER_CSS = `
    .msh-stp{display:inline-flex;align-items:center;gap:6px;flex:none}
    .msh-stp-b{width:32px;height:32px;border-radius:50%;border:0;padding:0;margin:0;background:var(--ki-surface-3, var(--gray100,#2f2f2f));color:var(--ki-text, var(--white,#fafafa));display:flex;align-items:center;justify-content:center;flex:none;cursor:pointer;-webkit-tap-highlight-color:transparent;--mdc-icon-size:18px;transition:transform .12s ease,opacity .15s}
    .msh-stp-b:active{transform:scale(.9)}
    .msh-stp-b:disabled{opacity:.35;cursor:default}
    .msh-stp-v{position:relative;min-width:56px;height:32px;padding:0 4px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;border-radius:10px}
    .msh-stp-v:focus-within{background:rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(.08*var(--ki-wa-k,1)),var(--ki-wa-max,1)))}
    .msh-stp-t{font-size:13px;font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap;color:var(--ki-text, var(--white,#fafafa));pointer-events:none}
    .msh-stp-t.ph,.msh-stp.dis .msh-stp-t{color:var(--ki-text-mid, var(--gray700,#979797));font-weight:500}
    .msh-stp-n{position:absolute;inset:0;width:100%;height:100%;box-sizing:border-box;margin:0;padding:0;border:0;opacity:0;font-size:16px;color-scheme:dark;background:transparent;color:var(--ki-text, #fafafa);cursor:pointer;-webkit-appearance:none;appearance:none;z-index:1}
    .msh-stp-n:disabled{cursor:default}
    .msh-stp-row{display:flex;align-items:center;gap:12px;min-height:52px;padding:8px 12px 8px 16px;box-sizing:border-box;width:100%}
    .msh-stp-l{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
    .msh-stp-ln{font-size:14px;font-weight:500;color:var(--ki-text-1, var(--gray1000,#e1e1e1));overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .msh-stp-ls{font-size:12px;color:var(--ki-text-3, var(--gray600,#7f7f7f));overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .msh-pick-in{font:inherit;font-size:16px;color-scheme:dark}
  `;
})();
