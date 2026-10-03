/* KI MSH · Fiks 36.5 · startfane i alle popups med fanelinje – ÉN felles mekanisme (MSH.startTab).
 *
 * Config (kortets egen config, ki-store / YAML): `start_tab: '<fane-id>' | 'last'`.
 *   Mangler → første synlige fane i tab_order-rekkefølgen. 'last' = «Sist brukte»: siste fane per popup, husket i
 *   localStorage per HA-bruker (`ki:last_tab:<bruker-id>` → { <card_id|hash>: fane }) – bare en cache (ui-persist-mønsteret).
 *   Skjult/fjernet startfane → første synlige. Omorganisering (hold + dra) endrer aldri start_tab (lagres på fane-id).
 *   Gamle nøkler leses fortsatt via kortets legacy(cfg) (f.eks. Media default_tab, Klima layout.default_tab/remember_tab,
 *   Kalender/Sir Sweeps startTab, Tesla tabs.start, Kamera mode); første valg i editoren skriver start_tab og fjerner dem.
 *
 * Kortet kobles til med ÉN statisk beskrivelse – resten gjør basekortet (00-base.js: _checkOpen/setUI/onClose):
 *   static get startTabSpec() { return {
 *     key: 'tab',                      // ui-nøkkelen kortet leser aktiv fane fra (standard 'tab')
 *     tabs(card) → ['id', …],          // SYNLIGE faner i visningsrekkefølge (tab_order, skjulte/tomme tatt bort)
 *     legacy(cfg) → verdi | undefined, // valgfritt: gamle nøkler ('' / null = ikke satt)
 *     get(card) → id, set(card, id),   // valgfritt: egen lagring av aktiv fane (standard card.ui[key] / setUI quiet)
 *     id(card) → nøkkel for «Sist brukte» (standard card_id, ellers popupens hash)
 *     lastFallback(cfg) → fane når «Sist brukte» ikke har noe husket ennå (standard første synlige)
 *   }; }
 *   Ved åpning (hash → popupen åpnes): MSH.startTab.apply(card) setter fanen til startfanen før første tegning.
 *   Fanebytte (setUI med key) og lukking husker fanen for «Sist brukte».
 *   Kort uten MSH.Card (eller med egen logikk) kan kalle hjelperne direkte:
 *     MSH.startTab.resolve(cfg, visible, { id, legacy }) → fane-id     MSH.startTab.remember(id, fane)
 *     MSH.startTab.value(cfg, legacy) → 'last' | id | undefined       MSH.startTab.pillKey(cfg, visible, legacy) → id | null
 *
 * Editor (samme felt i kortets Tilpass-ark og i HAs GUI-editor – øverst i Tilpass → Faner):
 *   MSH.startTab.field({ items(hass, cfg) → [{ key, label, icon? }] (synlige, i tab_order-rekkefølge), legacy, clear: [gamle
 *     nøkler som fjernes ved valg], label, help, name ('start_tab') }) → skjemafelt (type html) for msh-editor.
 *     Inline-ark: chips over fanene + «Sist brukte» (haptic selection). GUI-editor: ha-selector select (samme valg).
 *   Egne ark (Klima, Lys, Tesla, Varmepumpe …): MSH.startTab.editorHTML(cfg, items, o) + MSH.startTab.bindEditor(root,
 *     { set(v) }) – chips med data-mst="<id|last>".
 *   «Start»-pill på startfanen i Faner-listen: MSH.startTab.pill(cfg, key, visibleKeys, legacy) → '<span …>Start</span>' | ''.
 */
(function () {
  const M = window.MSH;
  if (!M || M.startTab) return;
  const esc = (s) => (M.esc ? M.esc(s) : String(s == null ? '' : s));
  const PINK = (M.C && M.C.accent) || 'linear-gradient(145deg, rgb(242 133 201) -10%, rgb(245 205 198) 100%)';
  const LAST = 'last';
  const LS = 'ki:last_tab:';
  const isLast = (v) => v === LAST || v === 'sist' || v === 'last_used' || v === '__last';

  // Verdien i config: start_tab først, ellers kortets gamle nøkler. '' / null = ikke satt.
  // legacy kan også være { legacy(cfg), map(id) } (map: gamle fane-id-er → nye, f.eks. 'unifi' → 'net')
  function value(cfg, legacy) {
    cfg = cfg || {};
    const L = legacy && typeof legacy === 'object' ? legacy : { legacy };
    let v = cfg.start_tab;
    if ((v == null || v === '') && L.legacy) { try { v = L.legacy(cfg); } catch (e) { v = undefined; } }
    if (v == null || v === '' || v === false) return undefined;
    if (isLast(v)) return LAST;
    if (L.map) { try { v = L.map(v); } catch (e) { /* */ } }
    return String(v);
  }
  const user = () => { const h = M.lastHass; return (h && h.user && h.user.id) || 'anon'; };
  const readAll = () => { try { return JSON.parse(localStorage.getItem(LS + user()) || 'null') || {}; } catch (e) { return {}; } };
  function lastOf(id) { if (!id) return undefined; const v = readAll()[id]; return v == null ? undefined : String(v); }
  function remember(id, tab) {
    if (!id || tab == null || tab === '') return;
    const all = readAll();
    if (all[id] === String(tab)) return;
    all[id] = String(tab);
    try { localStorage.setItem(LS + user(), JSON.stringify(all)); } catch (e) { /* */ }
  }
  // Startfanen blant de synlige fanene (visible = rekkefølgen i fanelinja)
  function resolve(cfg, visible, o) {
    o = o || {};
    const V = (visible || []).map(String);
    if (!V.length) return undefined;
    const v = value(cfg, o.legacy);
    if (v === LAST) { const l = lastOf(o.id); if (l != null && V.includes(l)) return l; const f = o.lastFallback ? (() => { try { return o.lastFallback(cfg || {}); } catch (e) { return null; } })() : null; return f != null && V.includes(String(f)) ? String(f) : V[0]; }
    return v != null && V.includes(v) ? v : V[0];
  }
  // Fanen som får «Start»-pillen i Faner-listen (null ved «Sist brukte»)
  function pillKey(cfg, visible, legacy) {
    const V = (visible || []).map(String), v = value(cfg, legacy);
    if (v === LAST) return null;
    return v != null && V.includes(v) ? v : V[0] || null;
  }
  const PILL_ST = `display:inline-flex;align-items:center;flex:none;height:20px;padding:0 8px;border-radius:10px;font-size:11px;font-weight:600;letter-spacing:.02em;line-height:1;background:${PINK};color:var(--ki-on-accent, #2a1720);white-space:nowrap`;
  function pill(cfg, key, visible, legacy) {
    return String(key) === pillKey(cfg, visible, legacy) ? `<span class="mst-pill" data-mst-pill="${esc(key)}" style="${PILL_ST}">Start</span>` : '';
  }

  /* ---------------------------------------------------------------- kortene (via basekortet) */
  const specOf = (card) => { try { return (card && card.constructor && card.constructor.startTabSpec) || null; } catch (e) { return null; } };
  const cfgOf = (card) => (card && (card._config || card.config)) || {};
  const idOf = (card, spec) => {
    if (spec && spec.id) { try { const v = spec.id(card); if (v) return v; } catch (e) { /* */ } }
    const c = (card && card._rawConfig) || cfgOf(card);
    if (c && c.card_id) return c.card_id;
    const h = M.popupHash ? M.popupHash(card) : null;
    return h ? String(h).replace(/^#/, '') : null;
  };
  const visOf = (card, spec) => { try { return (spec.tabs(card) || []).filter((x) => x != null && x !== '').map(String); } catch (e) { return []; } };
  const curOf = (card, spec) => { try { return spec.get ? spec.get(card) : (card.ui || card._ui || {})[spec.key || 'tab']; } catch (e) { return undefined; } };
  // Popupen åpnes: vis startfanen
  function apply(card) {
    const spec = specOf(card);
    if (!spec || !spec.tabs) return null;
    const V = visOf(card, spec);
    if (!V.length) return null;
    const t = resolve(cfgOf(card), V, { id: idOf(card, spec), lastFallback: spec.lastFallback, legacy: spec.map ? { legacy: spec.legacy, map: spec.map } : spec.legacy });
    if (t == null) return null;
    card.__stApply = true;
    try {
      if (spec.set) spec.set(card, t);
      else if (card.setUI) card.setUI({ [spec.key || 'tab']: t }, true);
    } catch (e) { console.error(card.localName, e); } finally { card.__stApply = false; }
    if (card._schedule) card._schedule(true);
    return t;
  }
  // Basekortet: setUI(p) med fanenøkkelen → husk (ikke når apply selv setter fanen)
  function onUI(card, p) {
    if (card.__stApply || !p) return;
    const spec = specOf(card);
    if (!spec) return;
    const k = spec.key || 'tab';
    if (k in p && p[k] != null) remember(idOf(card, spec), p[k]);
  }
  // Lukking: husk fanen som var aktiv (også for kort som bytter fane uten setUI)
  function closed(card) {
    const spec = specOf(card);
    if (!spec) return;
    const cur = curOf(card, spec);
    if (cur == null || cur === '') return;
    const V = visOf(card, spec);
    if (!V.length || V.includes(String(cur))) remember(idOf(card, spec), cur);
  }

  /* ---------------------------------------------------------------- editorfeltet */
  const CSS = `
    .mst{display:flex;flex-direction:column;gap:8px;min-width:0}
    .mst-hd{display:flex;align-items:baseline;gap:8px;padding:0 2px}
    .mst-l{flex:1;font-size:13px;font-weight:500;color:var(--ki-text, #fafafa)}
    .mst-v{font-size:12px;color:var(--ki-text-2, #afafaf);white-space:nowrap}
    .mst-ch{display:flex;flex-wrap:wrap;gap:6px}
    .mst-c{display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 12px;border:0;border-radius:17px;font:inherit;font-size:13px;font-weight:500;white-space:nowrap;cursor:pointer;background:var(--ki-surface-2, var(--gray300,#404040));color:var(--ki-text-1, #e1e1e1);-webkit-tap-highlight-color:transparent;transition:transform .15s cubic-bezier(.34,1.5,.64,1)}
    .mst-c:active{transform:scale(.95)}
    .mst-c.on{background:${PINK};color:var(--ki-on-accent, #2a1720)}
    .mst-c.last{box-shadow:inset 0 0 0 1px rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.12*var(--ki-wa-k,1)),var(--ki-wa-max,1)))}
    .mst-c.on.last{box-shadow:none}
    .mst-c ha-icon{--mdc-icon-size:16px;width:16px;height:16px;display:inline-flex}
    .mst-h{font-size:12px;color:var(--ki-text-mid, #979797);padding:0 2px;line-height:1.4}
  `;
  const norm = (items) => (items || []).filter(Boolean).map((t) => (typeof t === 'string' ? { key: t, label: t } : { key: String(t.key), label: t.label != null ? String(t.label) : String(t.key), icon: t.icon }));
  // Chips: synlige faner i rekkefølge + «Sist brukte». attrs(v) → attributter per chip (standard data-mst).
  function editorHTML(cfg, items, o) {
    o = o || {};
    const I = norm(items), V = I.map((t) => t.key), raw = value(cfg, o.legacy);
    const cur = raw === LAST ? LAST : raw != null && V.includes(raw) ? raw : V[0];
    const at = o.attrs || ((v) => `data-mst="${esc(v)}"`);
    const chip = (v, l, ic, extra) => `<button type="button" class="mst-c${v === cur ? ' on' : ''}${extra || ''}" role="radio" aria-checked="${v === cur}" data-key="mst-${esc(v)}" data-haptic="off" ${at(v)}>${ic ? (M.icon ? M.icon(ic, 16) : '') : ''}<span>${esc(l)}</span></button>`;
    const label = o.label || 'Startfane';
    const curL = cur === LAST ? 'Sist brukte' : ((I.find((t) => t.key === cur) || {}).label || '');
    const help = o.help != null ? o.help : cur === LAST ? 'Popupen åpner med fanen du brukte sist (husket på denne enheten).' : raw != null && raw !== LAST && !V.includes(raw) ? 'Startfanen er skjult – popupen åpner med første synlige fane.' : 'Fanen popupen viser hver gang den åpnes.';
    return `<style>${CSS}</style><div class="mst" data-key="mst-${esc(o.name || 'start_tab')}" data-mst-field="${esc(o.name || 'start_tab')}">
      <div class="mst-hd"><span class="mst-l">${esc(label)}</span><span class="mst-v">${esc(curL)}</span></div>
      <div class="mst-ch" role="radiogroup" aria-label="${esc(label)}">${I.map((t) => chip(t.key, t.label, o.icons === false ? null : t.icon)).join('')}${chip(LAST, 'Sist brukte', o.icons === false ? null : 'mdi:history', ' last')}</div>
      ${help ? `<div class="mst-h">${esc(help)}</div>` : ''}
    </div>`;
  }
  // Egne ark: delegert klikk på [data-mst] → api.set(v) (idempotent)
  function bindEditor(root, api) {
    if (!root) return;
    root.__mstApi = api;
    if (root.__mstBound) return;
    root.__mstBound = true;
    root.addEventListener('click', (e) => {
      const b = e.target && e.target.closest && e.target.closest('[data-mst]');
      if (!b || !b.closest('[data-mst-field]')) return;
      e.stopPropagation();
      if (M.haptic) M.haptic('selection');
      const A = root.__mstApi || {};
      if (A.set) A.set(b.dataset.mst);
    });
  }
  // Sti-sletting uten å mutere (gamle nøkler, f.eks. 'layout.default_tab')
  const unset = (o, path) => {
    const ks = String(path).split('.');
    const rec = (x, i) => {
      if (!x || typeof x !== 'object' || !(ks[i] in x)) return x;
      const y = Array.isArray(x) ? x.slice() : { ...x };
      if (i === ks.length - 1) delete y[ks[i]]; else y[ks[i]] = rec(y[ks[i]], i + 1);
      return y;
    };
    return rec(o, 0);
  };
  function clearLegacy(cfg, keys) { let c = cfg || {}; (keys || []).forEach((k) => { c = unset(c, k); }); return c; }
  function field(o) {
    o = o || {};
    const name = o.name || 'start_tab';
    const itemsOf = (h, c) => { try { return norm(typeof o.items === 'function' ? o.items(h || M.lastHass || null, c || {}) : o.items); } catch (e) { return []; } };
    return {
      type: 'html', id: 'start_tab', label: o.label || 'Startfane',
      html(h, c, key, ed) {
        c = c || {};
        const I = itemsOf(h, c);
        if (!I.length) return '';
        if (ed && !ed._inline && customElements.get('ha-selector')) {
          const raw = value(c, o.legacy), V = I.map((t) => t.key);
          const eff = raw === LAST ? LAST : raw != null && V.includes(raw) ? raw : V[0];
          const sel = { select: { mode: 'dropdown', options: [...I.map((t) => ({ value: t.key, label: t.label })), { value: LAST, label: 'Sist brukte' }] } };
          return `<div class="f"><ha-selector data-name="${esc(name)}" data-nomorph data-sdef="${esc(eff)}" data-selector="${esc(JSON.stringify(sel))}" data-label="${esc(o.label || 'Startfane')}" data-helper="${esc(o.guiHelp || 'Fanen popupen åpner med · «Sist brukte» = siste fane på enheten')}"></ha-selector></div>`;
        }
        return `<div class="f" style="padding:6px 2px">${editorHTML(c, I, { ...o, name, attrs: (v) => `data-a="fn" data-k="${esc(key)}" data-v="${esc(v)}"` })}</div>`;
      },
      click(dd, ed) {
        if (!ed) return;
        if (M.haptic) M.haptic('selection');
        const v = dd.v === LAST ? LAST : dd.v;
        if (o.clear && o.clear.length) ed._config = clearLegacy(ed._config, o.clear);
        if (o.set) return o.set(v, ed);
        return ed._set(name, v);
      },
    };
  }

  M.startTab = { LAST, value, resolve, pillKey, pill, remember, lastOf, apply, onUI, closed, field, editorHTML, bindEditor, clearLegacy, CSS, specOf, idOf };
})();
