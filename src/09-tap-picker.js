/* KI MSH · trykk-handling i HA-format (Fiks 15.6): navbar-knapper og prosa-piller.
 * Config (HA-standard, samme verdi fungerer i GUI-editoren):
 *   tap: { action: 'navigate', navigation_path: '#tesla' }   popup (fra listen) eller egen hash
 *   tap: { action: 'navigate', navigation_path: '/lovelace/energi' }   dashbord-sti
 *   tap: { action: 'url', url_path: 'https://…' }   ·   tap: { action: 'more-info', entity? }   ·   tap: { action: 'none' }
 *   tap: { action: 'lock-sheet' }   (KI-intern, prosa: hurtigarket for dørlåsen – tidligere link: 'lock')
 * Bakoverkompatibelt: mangler tap, leses de gamle nøklene (navbar: buttons.<id>.hash, prosa: link + act: 'more').
 *
 * API (window.MSH.tap):
 *   norm(t)            → gyldig tap-objekt eller null (streng '#x' / '/sti' / 'https://…' / 'none' godtas også)
 *   hashOf(t)          → '#x' når handlingen åpner en popup, ellers ''
 *   run(el, t, { entity }) → utfør (navigate/url/more-info). Returnerer true når noe ble gjort.
 *   popupOf(hash, hass) → popup-oppføringen fra MSH.allPopups (inkl. egne/importerte) eller null
 *   label(t, hass)     → kort tekst («Popup · Tesla», «#tesla», «/lovelace/x», «URL», …)
 *   html({ value, modes, labels: { path: 'Sti' }, key, attrs }) → '<msh-tap-picker …>'
 * <msh-tap-picker value='{"action":…}' modes="popup,hash,path,url,more,lock,none">: segment Popup · Egen hash ·
 *   Dashbord-sti · URL (· More-info · Dørlås · Ingen). Popup = søkbar liste over ALLE popups (ikon, navn, #hash).
 *   Fiks 16.11 (Hjem-fliser): modes kan også ha std (Standard = tom verdi/null), toggle ({ action: 'toggle' }) og service
 *   ({ action: 'perform-action', perform_action: 'script.x', data: {…} } – data skrives som YAML).
 *   Egen hash = fritekst, advarer «Ingen popup med #xyz», men lagres likevel. Hendelse: value-changed { value: tap | null }.
 * Fiks 17.8: Popup åpner popup-velgeren (ark, MSH.popupPicker) med «Test»; Dashbord-sti får forslag fra dashbordets
 *   visninger, Tjeneste forslag fra hass.services, More-info en entitet-velger (tom = kortets egen entitet).
 *
 * MSH.popupPicker (Fiks 17.8) – gjenbrukbar popup-velger for alle rad-editorer og GUI-editoren:
 *   open({ value, onPick(hash), title, hass }) → Promise<'#hash' | '' | null>  · arket: søk, liste Rom · Funksjoner ·
 *     Andre (MSH.allPopups = strategiens liste + alle andre Bubble pop-up-hasher i dashbordets config; Fiks 26.9: ingen
 *     maks-antall, listen scroller med touch/hjul/trackpad og valgt rad scrolles inn med scrollTop), «Egen hash» med advarsel «Popupen finnes ikke i dette dashbordet»
 *     (lagres likevel) og «Test» (location.hash).
 *   html({ name, value, placeholder, key, label, attrs }) → '<msh-popup-field …>' (ikon, navn, #hash · Test · ×).
 *     Hendelse value-changed { value: '#hash' | '' } – msh-editor lagrer via data-name.
 *   selector(hass) → ha-selector select { options, custom_value: true } for HAs GUI-editor.  list(hass) · norm(h)
 */
(function () {
  const M = window.MSH;
  if (!M || M.tap) return;
  const esc = M.esc;
  const MODES = { std: 'Standard', toggle: 'Veksle', popup: 'Popup', hash: 'Egen hash', path: 'Dashbord-sti', url: 'URL', more: 'More-info', service: 'Tjeneste', lock: 'Dørlås', none: 'Ingen' };

  function norm(t) {
    if (t == null || t === '') return null;
    if (typeof t === 'string') {
      const s = t.trim();
      if (!s) return null;
      if (s === 'none') return { action: 'none' };
      if (/^https?:\/\//i.test(s)) return { action: 'url', url_path: s };
      return { action: 'navigate', navigation_path: s };
    }
    if (typeof t !== 'object' || !t.action) return null;
    const a = String(t.action);
    if (a === 'navigate') { const p = String(t.navigation_path || '').trim(); return p ? { ...t, navigation_path: p } : null; }
    if (a === 'url') { const u = String(t.url_path || '').trim(); return u ? { ...t, url_path: u } : null; }
    if (a === 'more-info' || a === 'none' || a === 'lock-sheet' || a === 'toggle' || a === 'call-service' || a === 'perform-action') return { ...t };
    return null;
  }
  const hashOf = (t) => { t = norm(t); const p = t && t.action === 'navigate' ? t.navigation_path : ''; return p && p[0] === '#' ? p : ''; };
  const popupOf = (hash, hass) => { if (!hash) return null; try { return popupList(hass).find((p) => p.hash === hash) || null; } catch (e) { return null; } }; // 26.9: også manuelle dashbord-popups
  function run(el, t, o = {}) {
    t = norm(t);
    if (!t) return false;
    if (t.action === 'navigate') { const p = t.navigation_path; if (p[0] === '#') M.openPopup(p); else M.navigate(p); return true; }
    if (t.action === 'url') { try { window.open(t.url_path, t.new_tab === false ? '_self' : '_blank', 'noopener'); } catch (e) { /* */ } return true; }
    if (t.action === 'more-info') { const id = t.entity || o.entity; if (id) { M.moreInfo(el, id); return true; } return false; }
    if (t.action === 'toggle') { if (o.toggle) { o.toggle(); return true; } const id = t.entity || o.entity; if (id && M.lastHass) { M.toggle(M.lastHass, id); return true; } return false; }
    if (t.action === 'perform-action' || t.action === 'call-service') {
      const sv = String(t.perform_action || t.service || ''), i = sv.indexOf('.'), h = o.hass || M.lastHass;
      if (i < 1 || !h) return false;
      M.call(h, sv.slice(0, i), sv.slice(i + 1), { ...(t.data || t.service_data || {}), ...(t.target || {}) }).catch(() => {});
      return true;
    }
    return false;
  }
  function modeOf(t, hass) {
    t = norm(t);
    if (!t || t.action === 'none') return 'none';
    if (t.action === 'url') return 'url';
    if (t.action === 'more-info') return 'more';
    if (t.action === 'lock-sheet') return 'lock';
    if (t.action === 'toggle') return 'toggle';
    if (t.action === 'perform-action' || t.action === 'call-service') return 'service';
    if (t.action === 'navigate') return t.navigation_path[0] === '#' ? (popupOf(t.navigation_path, hass) ? 'popup' : 'hash') : 'path';
    return 'none';
  }
  function label(t, hass) {
    t = norm(t);
    const m = modeOf(t, hass);
    if (m === 'popup') { const p = popupOf(t.navigation_path, hass); return 'Popup · ' + (p ? p.name : t.navigation_path); }
    if (m === 'hash' || m === 'path') return t.navigation_path;
    if (m === 'url') return 'URL · ' + t.url_path;
    if (m === 'service') return 'Tjeneste · ' + (t.perform_action || t.service || '–');
    if (m === 'none' && !t) return MODES.std;
    return MODES[m];
  }

  const CSS = `
    :host{display:block;font-family:${M.FONT};color:#fafafa;min-width:0}
    *{box-sizing:border-box}
    button,input{font:inherit;color:inherit;border:0;background:none;padding:0;margin:0;cursor:pointer;-webkit-tap-highlight-color:transparent}
    input{cursor:text;outline:none;-webkit-user-select:text;user-select:text}
    .w{display:flex;flex-direction:column;gap:8px}
    .seg{display:flex;flex-wrap:wrap;gap:4px;padding:3px;border-radius:17px;background:var(--msh-tp-bg,#232323)}
    .seg button{flex:1 1 auto;height:30px;padding:0 10px;border-radius:14px;font-size:12px;font-weight:500;white-space:nowrap;color:#afafaf}
    .seg button.on{background:var(--pink,#f285c9);color:#2f2f2f}
    .pk{width:100%;height:48px;display:flex;align-items:center;gap:10px;padding:0 12px;border-radius:14px;background:var(--msh-tp-bg,#232323);text-align:left}
    .nm{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
    .nm b{font-weight:500;font-size:14px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .nm i{font-style:normal;font-size:11px;line-height:1.2;color:#7f7f7f;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .in{height:44px;width:100%;border-radius:14px;padding:0 14px;background:var(--msh-tp-bg,#232323);color:#fafafa;font-size:15px}
    .in::placeholder{color:#7f7f7f}
    .pl{display:flex;flex-direction:column;gap:6px;padding:8px;border-radius:16px;background:var(--msh-tp-bg,#232323)}
    .pl .in{height:40px;background:#3a3a3a;font-size:15px}
    .pls{max-height:280px;min-height:0;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y;display:flex;flex-direction:column;gap:2px}
    .pr{display:flex;align-items:center;gap:10px;min-height:46px;padding:4px 10px;border-radius:12px;text-align:left;width:100%}
    .pr.on{background:rgba(255,255,255,0.08)}
    .pr .h{font-size:12px;color:#979797;font-variant-numeric:tabular-nums;flex:none}
    .gl{font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#7f7f7f;padding:6px 10px 2px}
    .hint{font-size:12px;line-height:1.4;color:#979797;padding:0 4px}
    .hint b{color:#fafafa;font-weight:500}
    .warn{color:var(--orange,#f2b573)!important}
    .pkr{display:flex;align-items:center;gap:6px}
    .pkr .pk{flex:1;min-width:0}
    .tst{flex:none;height:48px;padding:0 14px;border-radius:14px;background:var(--msh-tp-bg,#232323);color:var(--pink,#f285c9);font-size:13px;font-weight:500}
    .none{font-size:12px;color:#7f7f7f;padding:10px}
    textarea.in{height:auto;min-height:72px;padding:10px 14px;font:13px/1.45 ui-monospace,Menlo,Consolas,monospace;resize:vertical;cursor:text;-webkit-user-select:text;user-select:text;outline:none;border:0}
  `;
  const GROUPS = { rom: 'Rom', fn: 'Funksjoner', egne: 'Andre' };
  const fold = (s) => String(s || '').toLowerCase().replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'a');

  class MshTapPicker extends HTMLElement {
    static get observedAttributes() { return ['value', 'modes']; }
    constructor() {
      super();
      this._open = false; this._q = ''; this._mode = null;
      const sr = this.attachShadow({ mode: 'open' });
      sr.addEventListener('click', (e) => this._click(e));
      sr.addEventListener('input', (e) => { e.stopPropagation(); this._inp(e.target, false); });
      sr.addEventListener('change', (e) => { e.stopPropagation(); this._inp(e.target, true); });
      // entitet-velgeren (More-info) sender value-changed – fang den her, ellers når den verten som en tap-verdi
      sr.addEventListener('value-changed', (e) => { e.stopPropagation(); const t = e.composedPath().find((n) => n.dataset && n.dataset.f === 'ent'); if (t) { const v = (e.detail && e.detail.value) || ''; this._emit(v ? { action: 'more-info', entity: v } : { action: 'more-info' }, 'more'); } });
      sr.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); if (e.target.dataset.f === 'q') { const f = sr.querySelector('.pr[data-v]'); if (f) this._emit({ action: 'navigate', navigation_path: f.dataset.v }, 'popup'); } else e.target.blur(); } });
      ['touchstart', 'touchmove', 'pointerdown', 'wheel'].forEach((t) => sr.addEventListener(t, (e) => { if (e.composedPath().some((n) => n.classList && n.classList.contains('pls'))) e.stopPropagation(); }, { passive: true })); // 26.9: aldri preventDefault
    }
    set hass(h) { this._hass = h; if (!this._open) this._render(); }
    get hass() { return this._hass || M.lastHass || null; }
    get value() { try { return norm(JSON.parse(this.getAttribute('value') || 'null')); } catch (e) { return norm(this.getAttribute('value')); } }
    set value(v) { this.setAttribute('value', v ? JSON.stringify(v) : ''); }
    get modes() { const m = String(this.getAttribute('modes') || 'popup,hash,path,url').split(',').map((x) => x.trim()).filter((x) => MODES[x]); return m.length ? m : ['popup']; }
    connectedCallback() { this._render(); }
    attributeChangedCallback(n, o, v) {
      if (o === v) return;
      if (n === 'value') { const nm = modeOf(this.value, this.hass); if (!(this._mode && (nm === this._mode || ((nm === 'popup' || nm === 'hash') && (this._mode === 'popup' || this._mode === 'hash'))))) this._mode = null; }
      this._render();
    }
    get mode() { const v = this.value, m = this._mode || (!v && this.modes.includes('std') ? 'std' : modeOf(v, this.hass)); return this.modes.includes(m) ? m : m === 'hash' && this.modes.includes('popup') ? 'popup' : this.modes[0]; }
    _emit(v, mode) {
      if (mode) this._mode = mode;
      this._open = false; this._q = '';
      this.setAttribute('value', v ? JSON.stringify(v) : '');
      M.haptic('selection');
      this._render();
      this.dispatchEvent(new CustomEvent('value-changed', { detail: { value: v || null }, bubbles: true, composed: true }));
    }
    _click(e) {
      const b = e.composedPath().find((n) => n.dataset && n.dataset.p);
      if (!b) return;
      const d = b.dataset;
      if (d.p === 'mode') {
        const m = d.v;
        if (m === this.mode) return;
        this._mode = m; this._open = false;
        M.haptic('selection');
        if (m === 'more') return this._emit({ action: 'more-info' }, m);
        if (m === 'none') return this._emit({ action: 'none' }, m);
        if (m === 'lock') return this._emit({ action: 'lock-sheet' }, m);
        if (m === 'std') return this._emit(null, m);
        if (m === 'toggle') return this._emit({ action: 'toggle' }, m);
        this._render();
        if (m === 'popup' && !hashOf(this.value) && M.popupPicker) return this._click({ composedPath: () => [{ dataset: { p: 'open' } }] });
        if (m !== 'popup') { const i = this.shadowRoot.querySelector('.in'); if (i) i.focus(); }
        return;
      }
      if (d.p === 'open') { // Fiks 17.8: popup-velgeren (ark) i stedet for innebygd liste
        M.haptic('light');
        if (!M.popupPicker) { this._open = !this._open; this._q = ''; this._render(); return; }
        M.popupPicker.open({ value: hashOf(this.value), hass: this.hass, onPick: (h) => this._emit(h ? { action: 'navigate', navigation_path: h } : null, 'popup') });
        return;
      }
      if (d.p === 'test') { const h = hashOf(this.value); if (h) { M.haptic('light'); M.openPopup(h); } return; }
      if (d.p === 'pick') return this._emit({ action: 'navigate', navigation_path: d.v }, 'popup');
    }
    _inp(t, commit) {
      const f = t.dataset && t.dataset.f;
      if (!f) return;
      if (f === 'q') { if (!commit) { this._q = t.value; this._render(); } return; }
      const raw = t.value.trim();
      if (f === 'hash') {
        const h = raw ? '#' + raw.replace(/^#+/, '').replace(/\s+/g, '-') : '';
        if (!commit) { const w = this.shadowRoot.querySelector('.hw'); if (w) { const p = popupOf(h, this.hass); w.className = 'hint hw' + (h && !p ? ' warn' : ''); w.innerHTML = this._hashHint(h, p); } return; }
        return this._emit(h ? { action: 'navigate', navigation_path: h } : null, 'hash');
      }
      if (!commit) return;
      if (f === 'path') { const p = raw && raw[0] !== '/' && raw[0] !== '#' ? '/' + raw : raw; return this._emit(p ? { action: 'navigate', navigation_path: p } : null, 'path'); }
      if (f === 'url') return this._emit(raw ? { action: 'url', url_path: raw } : null, 'url');
      if (f === 'ent') return this._emit(raw ? { action: 'more-info', entity: raw } : { action: 'more-info' }, 'more');
      if (f === 'svc' || f === 'data') {
        const cur = this.value || {}, sv = f === 'svc' ? raw : String(cur.perform_action || cur.service || '');
        let data = cur.data;
        if (f === 'data') {
          if (!raw) data = undefined;
          else { try { data = M.yaml ? M.yaml.parse(t.value) : JSON.parse(t.value); } catch (e) { this._dataErr = (e && e.message) || 'Ugyldig YAML'; this._render(); return; } }
          if (data != null && (typeof data !== 'object' || Array.isArray(data))) { this._dataErr = 'Data må være nøkkel: verdi'; this._render(); return; }
        }
        this._dataErr = '';
        if (!sv) { this._svcDraft = f === 'data' ? data : undefined; return this._render(); }
        const v = { action: 'perform-action', perform_action: sv };
        if (data && Object.keys(data).length) v.data = data;
        else if (f === 'svc' && this._svcDraft) v.data = this._svcDraft;
        return this._emit(v, 'service');
      }
    }
    _hashHint(h, p) {
      if (!h) return 'Skriv hashen til popupen, f.eks. <b>#tesla</b>.';
      if (p) return `Åpner popupen <b>${esc(p.name)}</b> · trykk igjen lukker.`;
      return `Ingen popup med ${esc(h)} – lagres likevel (f.eks. en popup du legger til senere).`;
    }
    _list(cur) {
      const h = this.hass, all = popupList(h); // 26.9: samme liste som popup-velgeren (alle popups, ingen maks)
      const q = fold(this._q.trim());
      const hits = all.filter((p) => !q || fold(`${p.name} ${p.hash}`).includes(q));
      const g = {};
      hits.forEach((p) => { (g[p.group] = g[p.group] || []).push(p); });
      const row = (p) => `<button class="pr ${p.hash === cur ? 'on' : ''}" data-p="pick" data-v="${esc(p.hash)}" data-key="${esc(p.hash)}">${M.icon(p.icon || 'mdi:card-outline', 22, 'color:#afafaf')}<span class="nm"><b>${esc(p.name)}</b>${p.hidden ? '<i>Skjult</i>' : ''}</span><span class="h">${esc(p.hash)}</span></button>`;
      const body = Object.keys(g).sort((a, b) => Object.keys(GROUPS).indexOf(a) - Object.keys(GROUPS).indexOf(b)).map((k) => `<div class="gl">${esc(GROUPS[k] || k)}</div>${g[k].map(row).join('')}`).join('');
      return `<div class="pl"><input class="in" data-f="q" value="${esc(this._q)}" placeholder="Søk popup – navn eller #hash" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done">
        <div class="pls">${body || `<div class="none">Ingen popups${q ? ' matcher' : ''}</div>`}</div></div>`;
    }
    _render() {
      if (!this.shadowRoot) return;
      const v = this.value, mode = this.mode, h = this.hass, cur = hashOf(v);
      let body = '';
      if (mode === 'popup') {
        const p = popupOf(cur, h);
        body = `<div class="pkr"><button class="pk" data-p="open">${M.icon(p ? p.icon || 'mdi:card-outline' : 'mdi:card-search-outline', 22, 'color:#afafaf')}<span class="nm"><b>${esc(p ? p.name : cur || 'Velg popup …')}</b><i class="${cur && !p ? 'warn' : ''}">${esc(p ? p.hash : cur ? cur + ' · Popupen finnes ikke i dette dashbordet' : 'Alle popups – også egne og importerte')}</i></span>${M.icon(this._open ? 'mdi:chevron-up' : 'mdi:chevron-down', 20, 'color:#979797')}</button>${cur ? '<button class="tst" data-p="test" title="Åpne popupen">Test</button>' : ''}</div>${this._open ? this._list(cur) : ''}`;
      } else if (mode === 'hash') {
        const p = popupOf(cur, h);
        body = `<input class="in" data-f="hash" value="${esc(cur)}" placeholder="#tesla" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done"><span class="hint hw${cur && !p ? ' warn' : ''}">${this._hashHint(cur, p)}</span>`;
      } else if (mode === 'path') {
        const p = v && v.action === 'navigate' && v.navigation_path[0] !== '#' ? v.navigation_path : '';
        const vp = viewPaths(h); // Fiks 17.8: forslag fra dashbordets visninger
        body = `<input class="in" data-f="path" list="tp-views" value="${esc(p)}" placeholder="/lovelace/energi" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done"><datalist id="tp-views">${vp.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('')}</datalist><span class="hint">Sti i Home Assistant, f.eks. <b>/lovelace/energi</b> eller <b>/dashboard-hytte/0</b>.${vp.length ? ` ${vp.length} forslag fra dashbordet.` : ''}</span>`;
      } else if (mode === 'url') {
        const u = v && v.action === 'url' ? v.url_path : '';
        body = `<input class="in" data-f="url" type="url" inputmode="url" value="${esc(u)}" placeholder="https://…" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done"><span class="hint">Åpnes i ny fane.</span>`;
      } else if (mode === 'more') { // Fiks 17.8: entitet-velger (tom = kortets/flisens egen entitet)
        const ent = v && v.action === 'more-info' ? v.entity || '' : '';
        body = `${M.entityPicker ? M.entityPicker.html({ key: 'tp-ent', value: ent, placeholder: 'Kortets egen entitet', attrs: 'data-f="ent"' }) : `<input class="in" data-f="ent" value="${esc(ent)}" placeholder="light.stue" autocomplete="off" autocapitalize="off" spellcheck="false">`}<span class="hint">Viser detaljene (more-info) for entiteten${ent ? '' : ' · tom = kortets egen'}.</span>`;
      }
      else if (mode === 'lock') body = '<span class="hint">Åpner hurtigarket for dørlåsen.</span>';
      else if (mode === 'std') body = `<span class="hint">${esc(this.getAttribute('std-hint') || 'Standard for kortet.')}</span>`;
      else if (mode === 'toggle') body = '<span class="hint">Veksler entiteten (lås/lås opp, på/av …).</span>';
      else if (mode === 'service') {
        const sv = v && (v.action === 'perform-action' || v.action === 'call-service') ? v.perform_action || v.service || '' : '';
        const data = v && v.data && Object.keys(v.data).length ? (M.yaml && M.yaml.dump ? M.yaml.dump(v.data) : JSON.stringify(v.data)) : '';
        body = `<input class="in" data-f="svc" list="tp-svc" value="${esc(sv)}" placeholder="domene.tjeneste, f.eks. script.alarm_toggle" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done"><datalist id="tp-svc">${services(h).map((x) => `<option value="${esc(x)}"></option>`).join('')}</datalist>
          <textarea class="in" data-f="data" placeholder="data (YAML), f.eks.&#10;entity_id: lock.inngang" autocapitalize="off" spellcheck="false">${esc(String(data).replace(/\n$/, ''))}</textarea>
          <span class="hint${this._dataErr ? ' warn' : ''}">${this._dataErr ? 'Feil i data: ' + esc(this._dataErr) : 'Kaller tjenesten med data. Tom data = ingen data.'}</span>`;
      }
      else body = '<span class="hint">Ingen handling ved trykk.</span>';
      const html = `<style>${CSS}</style><div class="w"><div class="seg" role="tablist">${this.modes.map((m) => `<button class="${m === mode ? 'on' : ''}" aria-selected="${m === mode}" data-p="mode" data-v="${m}">${esc(this.getAttribute('label-' + m) || MODES[m])}</button>`).join('')}</div>${body}</div>`;
      if (!this._did) { this.shadowRoot.innerHTML = html; this._did = true; } else M.morph(this.shadowRoot, html);
    }
  }
  if (!customElements.get('msh-tap-picker')) customElements.define('msh-tap-picker', MshTapPicker);

  /* ------------------------------------------------------------ Fiks 17.8 · popup-velger (ark) + <msh-popup-field> */
  // Kilde: MSH.allPopups (strategiens popup-liste – samme som «Tilpass Hjem» → Popups), gruppert Rom · Funksjoner · Andre.
  const PGROUPS = { rom: 'Rom', fn: 'Funksjoner', egne: 'Andre' };
  // Fiks 26.9: alle Bubble pop-up-hasher i dashbordet – også manuelle popups utenfor strategien (lovelace-configen)
  const dashPopups = () => {
    const out = [];
    try {
      const ha = document.querySelector('home-assistant'), panel = ha && M.deep && M.deep(ha.shadowRoot, 'ha-panel-lovelace');
      const cfg = panel && panel.lovelace && panel.lovelace.config;
      const walk = (c, d) => {
        if (!c || typeof c !== 'object' || d > 12) return;
        if (Array.isArray(c)) { c.forEach((x) => walk(x, d + 1)); return; }
        if (c.type === 'custom:bubble-card' && c.card_type === 'pop-up' && c.hash) out.push({ hash: normHash(c.hash), name: c.name || normHash(c.hash), icon: c.icon, group: 'egne', source: 'dash' });
        ['views', 'cards', 'sections', 'card', 'elements'].forEach((k) => { if (c[k]) walk(c[k], d + 1); });
      };
      walk(cfg, 0);
    } catch (e) { /* ingen lovelace (GUI-editor utenfor dashbordet) */ }
    return out;
  };
  const popupList = (hass) => {
    let L = [];
    try { L = M.allPopups ? M.allPopups(hass || M.lastHass, { hidden: true }) : []; } catch (e) { L = []; }
    const seen = new Set(L.map((p) => p.hash));
    dashPopups().forEach((p) => { if (!seen.has(p.hash)) { seen.add(p.hash); L.push(p); } });
    return L.map((p) => (PGROUPS[p.group] ? p : { ...p, group: 'egne' })); // ukjent gruppe → «Andre»
  };
  const normHash = (s) => { const r = String(s == null ? '' : s).trim(); return r ? '#' + r.replace(/^#+/, '').replace(/\s+/g, '-') : ''; };
  const MISSING = 'Popupen finnes ikke i dette dashbordet';
  const PSHEET_CSS = `
    .sh{display:flex;flex-direction:column;overflow:hidden!important;height:min(680px, calc(100% - 24px - env(safe-area-inset-top, 0px)))}
    /* Fiks 26.9: flex-kolonne – header/søk/egen hash faste (flex:none), bare listen (.sc) scroller */
    .sh>.body{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;gap:10px;overflow:hidden}
    .body>*{flex:none}
    *{box-sizing:border-box}
    button,input{font:inherit;color:inherit;border:0;background:none;padding:0;margin:0;cursor:pointer;-webkit-tap-highlight-color:transparent}
    input{cursor:text;outline:none;-webkit-user-select:text;user-select:text}
    .hd{display:flex;align-items:center;gap:10px;min-height:40px}
    .hd b{flex:1;font-size:18px;font-weight:500;color:#fafafa}
    .hd .x{width:36px;height:36px;border-radius:18px;display:grid;place-items:center;background:var(--ki-sheet-grp,#3a3a3a);color:#fafafa}
    .sr{display:flex;align-items:center;gap:8px;height:44px;padding:0 6px 0 14px;border-radius:14px;background:var(--ki-sheet-grp,#3a3a3a);color:#fafafa;flex:none}
    .sr input{flex:1;min-width:0;height:100%;font-size:16px}
    .sr input::placeholder,.own input::placeholder{color:#7f7f7f}
    .sr .qx{width:32px;height:32px;border-radius:16px;display:grid;place-items:center;color:#979797}
    .body>.sc{flex:1 1 0;min-height:120px;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y;scrollbar-width:thin;display:flex;flex-direction:column;gap:2px;padding-bottom:4px}
    .sc::-webkit-scrollbar{width:4px}.sc::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.18);border-radius:2px}
    .lb{font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#7f7f7f;padding:8px 2px 4px;flex:none}
    .pr{display:flex;align-items:center;gap:12px;min-height:52px;padding:4px 10px 4px 6px;border-radius:14px;text-align:left;width:100%;flex:none}
    .pr:active{transform:scale(.99)}
    .pr.on{background:rgba(255,255,255,0.1)}
    .pr .ci{width:40px;height:40px;border-radius:20px;flex:none;display:grid;place-items:center;background:var(--ki-sheet-grp,#3a3a3a);color:#fafafa}
    .pr .nm{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
    .pr .nm b{font-weight:500;font-size:14px;color:#fafafa;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .pr .nm i{font-style:normal;font-size:11px;color:#7f7f7f}
    .pr .h{font-size:12px;color:#979797;font-variant-numeric:tabular-nums;flex:none}
    .note{font-size:12px;color:#979797;line-height:1.45;padding:8px 2px}
    .own{display:flex;gap:8px;align-items:center;flex:none}
    .own input{flex:1;min-width:0;height:44px;border-radius:14px;padding:0 12px;background:var(--ki-sheet-grp,#3a3a3a);color:#fafafa;font-size:15px}
    .own .ok{height:44px;padding:0 16px;border-radius:22px;background:var(--pink,#f285c9);color:#2f2f2f;font-weight:600;font-size:14px}
    .wr{font-size:12px;color:var(--orange,#f2b573);padding:0 2px;flex:none;min-height:16px}
    .ft{display:flex;align-items:center;justify-content:space-between;gap:8px;flex:none;min-height:32px}
    .lnk{font-size:13px;color:var(--pink,#f285c9);font-weight:500;padding:6px 2px}
    .cur{font-size:12px;color:#979797;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
    :host([data-glass]) .sr,:host([data-glass]) .own input,:host([data-glass]) .hd .x,:host([data-glass]) .pr .ci{background:rgba(0,0,0,0.25)}
  `;
  // Åpner arket. o: { value, onPick(hash), title, hass } → Promise<'#hash' | '' (tømt) | null (avbrutt)>
  function openPopupPicker(o = {}) {
    const hass = o.hass || M.lastHass, cur = normHash(o.value), all = popupList(hass), known = (h) => all.some((p) => p.hash === h);
    const S = M.overlay({ css: PSHEET_CSS, maxWidth: 440, html: `
      <div class="hd"><b>${esc(o.title || 'Velg popup')}</b><button class="x" data-p="close" title="Lukk">${M.icon('mdi:close', 20)}</button></div>
      <div class="sr">${M.icon('mdi:magnify', 20, 'color:#7f7f7f')}<input class="q" placeholder="Søk popup – navn eller #hash" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="search"><button class="qx" data-p="qx" title="Tøm">${M.icon('mdi:close-circle', 18)}</button></div>
      <div class="sc"></div>
      <div class="lb" style="padding-top:0">Egen hash</div>
      <div class="own"><input class="oh" placeholder="#tesla" value="${esc(cur && !known(cur) ? cur : '')}" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done"><button class="ok" data-p="own">Bruk</button></div>
      <div class="wr">${cur && !known(cur) ? MISSING : ''}</div>
      <div class="ft"><span class="cur">${cur ? 'Nå: ' + esc(cur) : 'Ikke valgt'}</span><span style="display:flex;gap:14px">${cur ? '<button class="lnk" data-p="clear">Tøm</button>' : ''}<button class="lnk" data-p="test">Test</button></span></div>` });
    const R = S.root, qi = R.querySelector('.q'), sc = R.querySelector('.sc'), oh = R.querySelector('.oh'), wr = R.querySelector('.wr');
    const cb = o.onPick || o.onChange || o.onSelect;
    let picked = null, resolveP;
    const P = new Promise((r) => { resolveP = r; });
    S.onClosed = () => resolveP(picked);
    const done = (v) => { M.haptic('success'); picked = v || ''; S.close(); if (cb) cb(picked); };
    const draw = () => {
      const q = fold(qi.value.trim());
      const hits = all.filter((p) => !q || fold(`${p.name} ${p.hash}`).includes(q));
      const g = {};
      hits.forEach((p) => { (g[p.group] = g[p.group] || []).push(p); });
      const row = (p) => `<button class="pr ${p.hash === cur ? 'on' : ''}" data-v="${esc(p.hash)}"><span class="ci">${M.icon(p.icon || 'mdi:card-outline', 22)}</span><span class="nm"><b>${esc(p.name)}</b>${p.hidden ? '<i>Skjult</i>' : ''}</span><span class="h">${esc(p.hash)}</span></button>`;
      const order = Object.keys(PGROUPS);
      sc.innerHTML = Object.keys(g).sort((a, b) => (order.indexOf(a) + 99) % 99 - (order.indexOf(b) + 99) % 99).map((k) => `<div class="lb">${esc(PGROUPS[k] || k)}</div>${g[k].map(row).join('')}`).join('')
        || `<div class="note">Ingen popups${q ? ` matcher «${esc(qi.value.trim())}»` : ' i dette dashbordet'}. Bruk «Egen hash» under.</div>`;
    };
    qi.addEventListener('input', draw);
    // Fiks 26.9: listen eier scroll-gesten – Bubble-popupen/arket fanger den ikke (aldri preventDefault)
    ['touchstart', 'touchmove', 'wheel'].forEach((t) => sc.addEventListener(t, (e) => e.stopPropagation(), { passive: true }));
    oh.addEventListener('input', () => { const h = normHash(oh.value); wr.textContent = h && !known(h) ? MISSING : ''; });
    R.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); M.haptic('light'); S.close(); return; }
      if (e.key !== 'Enter') return;
      e.preventDefault(); e.stopPropagation();
      if (e.target === oh) { const h = normHash(oh.value); if (h) done(h); return; }
      const f = sc.querySelector('[data-v]'); if (f) done(f.dataset.v);
    });
    R.addEventListener('click', (e) => {
      const b = e.composedPath().find((n) => n.dataset && (n.dataset.v != null || n.dataset.p));
      if (!b) return;
      const p = b.dataset.p;
      if (!p) return done(b.dataset.v);
      if (p === 'close') { M.haptic('light'); return S.close(); }
      if (p === 'qx') { qi.value = ''; M.haptic('selection'); draw(); qi.focus(); return; }
      if (p === 'clear') return done('');
      if (p === 'own') { const h = normHash(oh.value); if (h) done(h); else oh.focus(); return; }
      if (p === 'test') { const h = normHash(oh.value) || cur; if (!h) return M.toast ? M.toast('Velg en popup først') : null; M.haptic('light'); S.close(); M.openPopup(h); }
    });
    draw();
    // Valgt rad scrolles inn i synsfeltet ved åpning (scrollTop, ikke scrollIntoView – det scroller arket/siden også)
    const toSel = () => { const on = sc.querySelector('.pr.on'); if (!on || !sc.clientHeight) return; const r = on.getBoundingClientRect(), b = sc.getBoundingClientRect(); sc.scrollTop += r.top - b.top - (sc.clientHeight - r.height) / 2; };
    requestAnimationFrame(() => { toSel(); try { qi.focus({ preventScroll: true }); } catch (e) { qi.focus(); } });
    P.close = S.close; P.sheet = S;
    return P;
  }
  const PF_CSS = `
    :host{display:block;font-family:${M.FONT};color:#fafafa;min-width:0}
    *{box-sizing:border-box}
    button{font:inherit;color:inherit;border:0;background:none;padding:0;margin:0;cursor:pointer;-webkit-tap-highlight-color:transparent}
    .f{display:flex;align-items:center;gap:4px;height:var(--msh-if-h,48px);padding:0 4px;border-radius:14px;background:var(--msh-if-bg,var(--msh-tp-bg,#282828));min-width:0}
    .pk{flex:1;min-width:0;height:100%;display:flex;align-items:center;gap:10px;padding:0 4px;text-align:left}
    .pk:active{transform:scale(.99)}
    .ci{width:38px;height:38px;border-radius:19px;flex:none;display:grid;place-items:center;background:var(--msh-if-ic,#3a3a3a)}
    .nm{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
    .nm b{font-weight:500;font-size:14px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .nm i{font-style:normal;font-size:11px;line-height:1.2;color:#7f7f7f;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .nm i.w{color:var(--orange,#f2b573)}
    .nm.ph b{color:#979797}
    .x,.t{height:36px;border-radius:18px;flex:none;display:grid;place-items:center;color:#979797}
    .x{width:36px}
    .t{padding:0 10px;font-size:12px;font-weight:500;color:var(--pink,#f285c9)}
  `;
  // Feltet: popupens ikon, navn og #hash. Trykk → arket, × tømmer, «Test» åpner popupen. value-changed { value: '#hash' | '' }
  class MshPopupField extends HTMLElement {
    static get observedAttributes() { return ['value', 'placeholder', 'label']; }
    constructor() {
      super();
      const sr = this.attachShadow({ mode: 'open' });
      sr.addEventListener('click', (e) => {
        const b = e.composedPath().find((n) => n.dataset && n.dataset.p);
        if (!b) return;
        e.stopPropagation();
        M.haptic('light');
        if (b.dataset.p === 'x') return this._emit('');
        if (b.dataset.p === 't') { const h = this.value || normHash(this.getAttribute('placeholder')); if (h) M.openPopup(h); return; }
        this._sheet = openPopupPicker({ value: this.value, title: this.getAttribute('label') || 'Velg popup', hass: this._hass, onPick: (v) => this._emit(v) });
      });
    }
    set hass(h) { this._hass = h; }
    get value() { return normHash(this.getAttribute('value')); }
    set value(v) { this.setAttribute('value', v || ''); }
    connectedCallback() { this._render(); }
    attributeChangedCallback(n, o, v) { if (o !== v) this._render(); }
    _emit(v) {
      this.setAttribute('value', v || '');
      this.dispatchEvent(new CustomEvent('value-changed', { detail: { value: v || '' }, bubbles: true, composed: true }));
    }
    _render() {
      if (!this.shadowRoot) return;
      const v = this.value, ph = normHash(this.getAttribute('placeholder')), h = v || ph;
      const p = h ? popupOf(h, this._hass) : null;
      const sub = v ? (p ? v : `${v} · ${MISSING}`) : ph ? `Standard · ${ph}` : 'Alle popups i dashbordet';
      const html = `<style>${PF_CSS}</style><div class="f"><button class="pk" data-p="open" title="Velg popup"><span class="ci">${M.icon(p ? p.icon || 'mdi:card-outline' : 'mdi:card-search-outline', 22, v ? '' : 'opacity:.55')}</span>`
        + `<span class="nm${v ? '' : ' ph'}"><b>${esc(p ? p.name : v || 'Velg popup …')}</b><i class="${v && !p ? 'w' : ''}">${esc(sub)}</i></span>${M.icon('mdi:chevron-down', 20, 'color:#979797')}</button>`
        + `${h ? '<button class="t" data-p="t" title="Åpne popupen">Test</button>' : ''}${v ? `<button class="x" data-p="x" title="Tøm">${M.icon('mdi:close', 18)}</button>` : ''}</div>`;
      if (!this._did) { this.shadowRoot.innerHTML = html; this._did = true; } else M.morph(this.shadowRoot, html);
    }
  }
  if (!customElements.get('msh-popup-field')) customElements.define('msh-popup-field', MshPopupField);
  M.popupPicker = {
    tag: 'msh-popup-field', GROUPS: PGROUPS, MISSING,
    open: openPopupPicker, list: popupList, norm: normHash,
    // ha-selector select (GUI-editoren): samme liste, egen verdi tillatt
    selector: (hass) => ({ select: { mode: 'dropdown', custom_value: true, options: popupList(hass).map((p) => ({ value: p.hash, label: `${p.name} · ${p.hash}${p.group === 'egne' ? ' (andre)' : ''}` })) } }),
    html(o = {}) {
      return `<msh-popup-field data-nomorph ${o.key ? `data-key="${esc(o.key)}"` : ''} ${o.name ? `data-name="${esc(o.name)}"` : ''} value="${esc(normHash(o.value))}" placeholder="${esc(o.placeholder || '')}"${o.label ? ` label="${esc(o.label)}"` : ''} ${o.attrs || ''}></msh-popup-field>`;
    },
  };
  // Forslag til dashbord-sti (Navigate): visningene i dette dashbordet + andre dashbord (hass.panels)
  function viewPaths(hass) {
    const out = [], seen = new Set(), add = (v, l) => { if (v && !seen.has(v)) { seen.add(v); out.push([v, l || v]); } };
    try {
      const base = '/' + (location.pathname.split('/')[1] || 'lovelace');
      const ha = document.querySelector('home-assistant'), panel = ha && M.deep && M.deep(ha.shadowRoot, 'ha-panel-lovelace');
      const root = panel && panel.shadowRoot && panel.shadowRoot.querySelector('hui-root');
      const views = (root && root.lovelace && root.lovelace.config && root.lovelace.config.views) || (panel && panel.lovelace && panel.lovelace.config && panel.lovelace.config.views) || [];
      views.forEach((v, i) => add(`${base}/${v.path || i}`, v.title || v.path || 'Visning ' + (i + 1)));
    } catch (e) { /* */ }
    const P = (hass && hass.panels) || {};
    Object.keys(P).forEach((k) => { const p = P[k]; if (p && p.component_name === 'lovelace') add('/' + (p.url_path || k), p.title || p.url_path || k); });
    return out;
  }
  const services = (hass) => { const S = (hass && hass.services) || {}, out = []; Object.keys(S).sort().forEach((d) => Object.keys(S[d] || {}).sort().forEach((sv) => out.push(d + '.' + sv))); return out.slice(0, 2000); };

  M.tap = {
    tag: 'msh-tap-picker', MODES,
    norm, hashOf, run, popupOf, label, modeOf,
    html(o = {}) {
      const t = norm(o.value);
      return `<msh-tap-picker data-nomorph ${o.key ? `data-key="${esc(o.key)}"` : ''} value="${esc(t ? JSON.stringify(t) : '')}" modes="${esc((o.modes || ['popup', 'hash', 'path', 'url']).join(','))}"${o.stdHint ? ` std-hint="${esc(o.stdHint)}"` : ''}${Object.keys(o.labels || {}).map((k) => ` label-${esc(k)}="${esc(o.labels[k])}"`).join('')} ${o.attrs || ''}></msh-tap-picker>`;
    },
  };
})();
