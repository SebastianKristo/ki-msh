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
 *   Egen hash = fritekst, advarer «Ingen popup med #xyz», men lagres likevel. Hendelse: value-changed { value: tap | null }.
 */
(function () {
  const M = window.MSH;
  if (!M || M.tap) return;
  const esc = M.esc;
  const MODES = { popup: 'Popup', hash: 'Egen hash', path: 'Dashbord-sti', url: 'URL', more: 'More-info', lock: 'Dørlås', none: 'Ingen' };

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
  const popupOf = (hash, hass) => { if (!hash || !M.allPopups) return null; try { return M.allPopups(hass || M.lastHass, { hidden: true }).find((p) => p.hash === hash) || null; } catch (e) { return null; } };
  function run(el, t, o = {}) {
    t = norm(t);
    if (!t) return false;
    if (t.action === 'navigate') { const p = t.navigation_path; if (p[0] === '#') M.openPopup(p); else M.navigate(p); return true; }
    if (t.action === 'url') { try { window.open(t.url_path, t.new_tab === false ? '_self' : '_blank', 'noopener'); } catch (e) { /* */ } return true; }
    if (t.action === 'more-info') { const id = t.entity || o.entity; if (id) { M.moreInfo(el, id); return true; } return false; }
    return false;
  }
  function modeOf(t, hass) {
    t = norm(t);
    if (!t || t.action === 'none') return 'none';
    if (t.action === 'url') return 'url';
    if (t.action === 'more-info') return 'more';
    if (t.action === 'lock-sheet') return 'lock';
    if (t.action === 'navigate') return t.navigation_path[0] === '#' ? (popupOf(t.navigation_path, hass) ? 'popup' : 'hash') : 'path';
    return 'none';
  }
  function label(t, hass) {
    t = norm(t);
    const m = modeOf(t, hass);
    if (m === 'popup') { const p = popupOf(t.navigation_path, hass); return 'Popup · ' + (p ? p.name : t.navigation_path); }
    if (m === 'hash' || m === 'path') return t.navigation_path;
    if (m === 'url') return 'URL · ' + t.url_path;
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
    .pls{max-height:280px;overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y;display:flex;flex-direction:column;gap:2px}
    .pr{display:flex;align-items:center;gap:10px;min-height:46px;padding:4px 10px;border-radius:12px;text-align:left;width:100%}
    .pr.on{background:rgba(255,255,255,0.08)}
    .pr .h{font-size:12px;color:#979797;font-variant-numeric:tabular-nums;flex:none}
    .gl{font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#7f7f7f;padding:6px 10px 2px}
    .hint{font-size:12px;line-height:1.4;color:#979797;padding:0 4px}
    .hint b{color:#fafafa;font-weight:500}
    .warn{color:var(--orange,#f2b573)}
    .none{font-size:12px;color:#7f7f7f;padding:10px}
  `;
  const GROUPS = { rom: 'Rom', fn: 'Funksjoner', egne: 'Egne og importerte' };
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
      sr.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); if (e.target.dataset.f === 'q') { const f = sr.querySelector('.pr[data-v]'); if (f) this._emit({ action: 'navigate', navigation_path: f.dataset.v }, 'popup'); } else e.target.blur(); } });
      ['touchstart', 'touchmove', 'pointerdown'].forEach((t) => sr.addEventListener(t, (e) => { if (e.composedPath().some((n) => n.classList && n.classList.contains('pls'))) e.stopPropagation(); }, { passive: true }));
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
    get mode() { const m = this._mode || modeOf(this.value, this.hass); return this.modes.includes(m) ? m : m === 'hash' && this.modes.includes('popup') ? 'popup' : this.modes[0]; }
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
        this._mode = m; this._open = m === 'popup' && !hashOf(this.value);
        M.haptic('selection');
        if (m === 'more') return this._emit({ action: 'more-info' }, m);
        if (m === 'none') return this._emit({ action: 'none' }, m);
        if (m === 'lock') return this._emit({ action: 'lock-sheet' }, m);
        this._render();
        if (m !== 'popup') { const i = this.shadowRoot.querySelector('.in'); if (i) i.focus(); }
        return;
      }
      if (d.p === 'open') { M.haptic('light'); this._open = !this._open; this._q = ''; this._render(); if (this._open) { const i = this.shadowRoot.querySelector('.pl .in'); if (i) i.focus(); } return; }
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
    }
    _hashHint(h, p) {
      if (!h) return 'Skriv hashen til popupen, f.eks. <b>#tesla</b>.';
      if (p) return `Åpner popupen <b>${esc(p.name)}</b> · trykk igjen lukker.`;
      return `Ingen popup med ${esc(h)} – lagres likevel (f.eks. en popup du legger til senere).`;
    }
    _list(cur) {
      const h = this.hass, all = M.allPopups ? M.allPopups(h, { hidden: true }) : [];
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
        body = `<button class="pk" data-p="open">${M.icon(p ? p.icon || 'mdi:card-outline' : 'mdi:card-search-outline', 22, 'color:#afafaf')}<span class="nm"><b>${esc(p ? p.name : cur || 'Velg popup …')}</b><i>${esc(p ? p.hash : cur ? 'Ingen popup med ' + cur : 'Alle popups – også egne og importerte')}</i></span>${M.icon(this._open ? 'mdi:chevron-up' : 'mdi:chevron-down', 20, 'color:#979797')}</button>${this._open ? this._list(cur) : ''}`;
      } else if (mode === 'hash') {
        const p = popupOf(cur, h);
        body = `<input class="in" data-f="hash" value="${esc(cur)}" placeholder="#tesla" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done"><span class="hint hw${cur && !p ? ' warn' : ''}">${this._hashHint(cur, p)}</span>`;
      } else if (mode === 'path') {
        const p = v && v.action === 'navigate' && v.navigation_path[0] !== '#' ? v.navigation_path : '';
        body = `<input class="in" data-f="path" value="${esc(p)}" placeholder="/lovelace/energi" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done"><span class="hint">Sti i Home Assistant, f.eks. <b>/lovelace/energi</b> eller <b>/dashboard-hytte/0</b>.</span>`;
      } else if (mode === 'url') {
        const u = v && v.action === 'url' ? v.url_path : '';
        body = `<input class="in" data-f="url" type="url" inputmode="url" value="${esc(u)}" placeholder="https://…" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done"><span class="hint">Åpnes i ny fane.</span>`;
      } else if (mode === 'more') body = '<span class="hint">Viser detaljene (more-info) for entiteten.</span>';
      else if (mode === 'lock') body = '<span class="hint">Åpner hurtigarket for dørlåsen.</span>';
      else body = '<span class="hint">Ingen handling ved trykk.</span>';
      const html = `<style>${CSS}</style><div class="w"><div class="seg" role="tablist">${this.modes.map((m) => `<button class="${m === mode ? 'on' : ''}" aria-selected="${m === mode}" data-p="mode" data-v="${m}">${esc(this.getAttribute('label-' + m) || MODES[m])}</button>`).join('')}</div>${body}</div>`;
      if (!this._did) { this.shadowRoot.innerHTML = html; this._did = true; } else M.morph(this.shadowRoot, html);
    }
  }
  if (!customElements.get('msh-tap-picker')) customElements.define('msh-tap-picker', MshTapPicker);

  M.tap = {
    tag: 'msh-tap-picker', MODES,
    norm, hashOf, run, popupOf, label, modeOf,
    html(o = {}) {
      const t = norm(o.value);
      return `<msh-tap-picker data-nomorph ${o.key ? `data-key="${esc(o.key)}"` : ''} value="${esc(t ? JSON.stringify(t) : '')}" modes="${esc((o.modes || ['popup', 'hash', 'path', 'url']).join(','))}"${Object.keys(o.labels || {}).map((k) => ` label-${esc(k)}="${esc(o.labels[k])}"`).join('')} ${o.attrs || ''}></msh-tap-picker>`;
    },
  };
})();
