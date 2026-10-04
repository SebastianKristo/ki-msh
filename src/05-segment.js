/* KI MSH · Fiks 47 P · felles segmentkontroll (M.segment) – «Kroner | kWh», «I dag | Måneden», periodevelgere …
 *
 * API (alle kort):
 *   M.segment.css                         → CSS-streng; legg den i kortets shadow-root-stil (én gang).
 *   M.segment.html(items, active, opts)   → HTML for ett spor.
 *       items:  [{ v, l, icon? , dis? }] eller [[v, l], …] eller ['v', …]   (v = verdi, l = etikett)
 *       active: v for valgt knapp
 *       opts:   { height: 46, font: 15, variant: 'pink' | 'light', act: 'seg', key: '', attrs: '', cls: '',
 *                 glass: true (data-glass-drag="x"), haptic: 'selection' | false (data-haptic), label: aria-label,
 *                 actAttr: 'data-act' (f.eks. 'data-sk-act' for egen delegering), vAttr: 'data-v' (f.eks. 'data-sk-v') }
 *     Spor: <div class="ki-seg" data-glass-drag="x" data-seg-key="<key>" role="tablist">
 *     Knapp: <button class="ki-seg-b [on]" data-act="<act>" data-seg-key="<key>" data-v="<v>" role="tab"
 *             aria-selected="true|false" data-haptic="<haptic>">
 *   M.segment.bind(root, onPick(key, v, btn), opts)
 *       Kobler klikk (delegert på root, én gang per root) + Liquid Glass-drag (M.glassDrag, lazy – 10-navbar.js lastes
 *       senere) på alle [data-glass-drag] .ki-seg i root. Kan kalles etter hver render (idempotent).
 *       opts: { glass: () => bool (enabled), haptic: 'selection' | true (bind sender haptic selv – bare for kort UTEN
 *       MSH.Card-klikk; MSH.Card sender allerede data-haptic via data-act) }
 *   MSH.Card-kort: trenger ikke bind for klikk – onAction(act = opts.act || 'seg', btn) kalles med btn.dataset.segKey /
 *       btn.dataset.v; kall M.segment.glass(this.shadowRoot) etter render for Liquid Glass-drag.
 *   M.segment.glass(root, opts)          → bare glass-drag på sporene (for kort som har egen klikk-delegering).
 *   M.segment.wrap(html, cols=2)         → grid med flere spor ved siden av hverandre (gap 10).
 *
 * Stil (fasit Strøm popup v3 segBtn/kSegs): `all: unset`-reset (ingen arv av HA/nettleser text-align/padding/border),
 * spor grid N like kolonner minmax(0,1fr), gap 2, padding 4 (aktiv pille har 4 px luft til kanten), radius 999,
 * --ki-surface-2; knapp flex-sentrert, høyde 46 (--ki-seg-h), padding 0 8, radius 999, 15/500, nowrap.
 * Aktiv = rosa gradient + --ki-on-accent; inaktiv = transparent + --ki-text-1. variant 'light' = hvit pille + mørk tekst.
 */
(function () {
  const M = window.MSH = window.MSH || {};
  if (M.segment) return;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const PINK = 'linear-gradient(160deg, #f28ac9, #f6c9c4)'; // ki-hex-ok aksentflate (fasit segBtn pink)
  const css = `
.ki-seg{all:unset;box-sizing:border-box;display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);grid-template-columns:repeat(var(--ki-seg-n,2),minmax(0,1fr));gap:2px;padding:4px;border-radius:999px;background:var(--ki-surface-2, #3d3d3d);min-width:0;width:100%;touch-action:pan-y;-webkit-tap-highlight-color:transparent;position:relative}
.ki-seg>.ki-seg-b{all:unset;box-sizing:border-box;display:flex;align-items:center;justify-content:center;gap:6px;width:100%;min-width:0;height:var(--ki-seg-h,46px);padding:0 8px;margin:0;border:0;border-radius:999px;font-family:inherit;font-size:var(--ki-seg-f,15px);font-weight:500;line-height:1;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;background:transparent;color:var(--ki-text-1, #d6d6d6);transition:background .25s,color .25s,transform .12s;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none}
.ki-seg>.ki-seg-b>span{overflow:hidden;text-overflow:ellipsis;min-width:0}
.ki-seg>.ki-seg-b ha-icon{--mdc-icon-size:18px;flex:none}
.ki-seg>.ki-seg-b.on{background:${PINK};color:var(--ki-on-accent, #2a1720)}
.ki-seg.light>.ki-seg-b.on{background:var(--ki-knob, #fafafa);color:var(--ki-on-accent, #2a1720)}
.ki-seg>.ki-seg-b:active{transform:scale(.97)}
.ki-seg>.ki-seg-b:focus{outline:none}
.ki-seg>.ki-seg-b:focus-visible{outline:2px solid var(--ki-text, #fafafa);outline-offset:-2px}
.ki-seg>.ki-seg-b[disabled]{opacity:.4;pointer-events:none}
.ki-segs{display:grid;grid-template-columns:repeat(var(--ki-segs-n,2),minmax(0,1fr));gap:10px;min-width:0}
`;
  const norm = (items) => (items || []).map((it) => (Array.isArray(it) ? { v: it[0], l: it[1], icon: it[2] } : (it && typeof it === 'object') ? it : { v: it, l: it }));
  const html = (items, active, o = {}) => {
    const its = norm(items), h = o.height || 46, f = o.font || 15;
    const st = `--ki-seg-n:${its.length || 2};${h !== 46 ? `--ki-seg-h:${h}px;` : ''}${f !== 15 ? `--ki-seg-f:${f}px;` : ''}${o.style || ''}`;
    const key = o.key != null ? ` data-seg-key="${esc(o.key)}"` : '';
    return `<div class="ki-seg ${o.variant === 'light' ? 'light' : ''} ${o.cls || ''}" role="tablist"${o.label ? ` aria-label="${esc(o.label)}"` : ''}${o.glass === false ? '' : ' data-glass-drag="x"'}${key} style="${st}" ${o.attrs || ''}>${its.map((it) => {
      const on = String(it.v) === String(active);
      const ic = it.icon && M.icon ? M.icon(it.icon, 18) : '';
      return `<button type="button" class="ki-seg-b${on ? ' on' : ''}" role="tab" aria-selected="${on}" ${o.actAttr || 'data-act'}="${esc(o.act || 'seg')}"${key} ${o.vAttr || 'data-v'}="${esc(it.v)}"${o.haptic === false ? '' : ` data-haptic="${esc(o.haptic || 'selection')}"`}${it.dis ? ' disabled' : ''}>${ic}<span>${esc(it.l)}</span></button>`;
    }).join('')}</div>`;
  };
  const wrap = (inner, cols = 2) => `<div class="ki-segs" style="--ki-segs-n:${cols}">${Array.isArray(inner) ? inner.join('') : inner}</div>`;
  const glass = (root, o = {}) => {
    if (!root || !M.glassDrag) return;
    root.querySelectorAll('.ki-seg[data-glass-drag]').forEach((s) => { try { M.glassDrag(s, { axis: 'x', touchAction: 'pan-y', ...(o.glass ? { enabled: o.glass } : {}) }); } catch (e) { /* */ } });
  };
  const bind = (root, onPick, o = {}) => {
    if (!root) return;
    if (!root.__kiSeg) {
      root.__kiSeg = { onPick };
      root.addEventListener('click', (e) => {
        const p = e.composedPath ? e.composedPath() : [e.target];
        const b = p.find((n) => n && n.classList && n.classList.contains('ki-seg-b'));
        if (!b || b.disabled) return;
        if (o.haptic && M.haptic) M.haptic(typeof o.haptic === 'string' ? o.haptic : 'selection');
        const fn = root.__kiSeg.onPick;
        if (fn) fn(b.dataset.segKey || '', b.getAttribute(o.vAttr || 'data-v'), b);
      });
    } else root.__kiSeg.onPick = onPick;
    glass(root, o);
  };
  M.segment = { css, html, bind, glass, wrap, norm };
})();
