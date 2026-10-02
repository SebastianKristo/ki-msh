/* KI MSH · felles fanelinje («Som popups» og «Tekst + tannhjul») – Fiks 31.4 / 31.5.
 * Én komponent for fanelinjene som ser ut som popupenes (Vanning / Innstillinger): Hjem (tab_style popup | gear,
 * 24-hjem-faner.js), forhåndsvisningen i «Tilpass Hjem» → Faner → Fanestil (27-hjem-editor.js) og Lys-popupen (43-lys.js).
 *   MSH.tabBar.html(items, cur, o) → '<div class="mtb mtb-pop|mtb-gear">…</div>'
 *     items: [{ key, label, icon?, warn? }]  (warn = rødt ikon når fanen ikke er aktiv, f.eks. Batterier med lave)
 *     o.variant: 'pop'  – flate #3a3a3a r26 pad 4 gap 2, like brede faner, aktiv rosa pille r22.
 *                         o.mode ikon|tekst|begge (standard begge): begge = 56 px (ikon 20 over tekst 12), ellers 44 px.
 *                'gear' – tekstfaner på flate #3a3a3a r28 pad 4 gap 2, faner 48 px r24 tekst 14/500 #c7c7c7, bredde
 *                         etter teksten (flex 1 1 auto, padding 0 8px – aldri kuttet; for mange → vannrett scroll),
 *                         + rund knapp 56 × 56 (#3a3a3a + innerkant) med settings 24 px.
 *     o.attrs(item, i, on) → attributter per fane (standard: data-act="tab" data-v data-i data-haptic="selection")
 *     o.gear: false = ingen tannhjul (standard: med for 'gear'); o.gearAttrs, o.gearLabel; o.preview: spans uten roller.
 *     o.rowCls / o.tabCls: ekstra klasser på raden / fanene (f.eks. 'tabs' / 'tab'); o.keyPrefix (data-key, standard 'mtb-').
 *   MSH.tabBar.CSS   – legg i kortets/arkets styles (klassene har prefiks mtb-, kolliderer ikke).
 *   MSH.tabBar.bind(card, el, opts) → MSH.tabRow på fanene (hold 400 ms + dra = flytt, Esc avbryter, glass-valg,
 *     haptic, touch-action pan-y + stopPropagation – fallgruve 2). opts som MSH.tabRow (active, order, field | save …).
 */
(function () {
  const M = window.MSH;
  if (!M || M.tabBar) return;
  const esc = (s) => (M.esc ? M.esc(s) : String(s == null ? '' : s));
  const PINK = (M.C && M.C.accent) || 'linear-gradient(145deg, rgb(242 133 201) -10%, rgb(245 205 198) 100%)';
  const mode = (v) => (v === 'ikon' || v === 'i' ? 'i' : v === 'tekst' || v === 't' ? 't' : 'b');

  function html(items, cur, o) {
    o = o || {};
    const kp = o.keyPrefix != null ? o.keyPrefix : 'mtb-';
    const v = o.variant === 'gear' ? 'gear' : 'pop', m = v === 'gear' ? 't' : mode(o.mode), pv = !!o.preview, tag = pv ? 'span' : 'button';
    const btn = (t, i) => {
      const on = t.key === cur;
      const a = o.attrs ? o.attrs(t, i, on) : `data-act="${o.act || 'tab'}" data-v="${esc(t.key)}" data-i="${i}" data-haptic="selection"`;
      const ic = m !== 't' ? `<span class="mtb-ic">${M.icon(t.icon || 'mdi:tab', m === 'i' ? 22 : 20)}</span>` : '';
      const lb = m !== 'i' ? `<span class="mtb-l">${esc(t.label)}</span>` : '';
      return `<${tag} class="mtb-t${o.tabCls ? ' ' + o.tabCls : ''}${on ? ' on' : ''}${t.warn ? ' warn' : ''}" ${pv ? '' : `role="tab" aria-selected="${on}"`} aria-label="${esc(t.label)}" data-key="${esc(kp)}${esc(t.key)}" ${a}>${ic}${lb}</${tag}>`;
    };
    const withGear = o.gear != null ? !!o.gear : v === 'gear';
    const gt = pv ? 'span' : 'button';
    const gear = withGear ? `<${gt} class="gear mtb-g" data-key="mtb-gear" ${o.gearAttrs || 'data-act="customize" data-haptic="light"'} aria-label="${esc(o.gearLabel || 'Tilpass')}">${M.icon('settings', 24)}</${gt}>` : '';
    return `<div class="mtb mtb-${v}" data-key="${esc(o.key || 'mtb')}"><div class="mtb-tabs m-${m}${o.rowCls ? ' ' + o.rowCls : ''}" ${pv ? 'aria-hidden="true"' : 'role="tablist"'} data-gd-skip>${(items || []).map(btn).join('')}</div>${gear}</div>`;
  }

  const CSS = `
    .mtb{display:flex;align-items:center;gap:8px;min-width:0;width:100%;box-sizing:border-box}
    .mtb-tabs{flex:1;min-width:0;display:flex;gap:2px;padding:4px;box-sizing:border-box;background:var(--ki-surface-3, var(--gray200,#3a3a3a));box-shadow:inset 0 0 0 1px rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.05*var(--ki-wa-k,1)),var(--ki-wa-max,1)));overflow-x:auto;overflow-y:hidden;scrollbar-width:none;touch-action:pan-y;overscroll-behavior-x:contain;user-select:none;-webkit-user-select:none}
    .mtb-tabs::-webkit-scrollbar{display:none}
    .mtb-pop .mtb-tabs{border-radius:26px}
    .mtb-gear .mtb-tabs{border-radius:28px}
    .mtb-t{display:flex;align-items:center;justify-content:center;box-sizing:border-box;margin:0;border:0;white-space:nowrap;font-family:inherit;font-weight:500;line-height:1.2;color:var(--ki-text-2, var(--gray900,#c7c7c7));background:transparent;cursor:pointer;-webkit-tap-highlight-color:transparent;-webkit-touch-callout:none;user-select:none;-webkit-user-select:none;transition:background .2s,color .2s}
    .mtb-t.on{background:${PINK};color:var(--ki-on-accent, var(--gray100,#2f2f2f))}
    .mtb-gear .mtb-t{flex:1 1 auto;min-width:max-content;height:48px;padding:0 8px;border-radius:24px;font-size:14px}
    .mtb-pop .mtb-t{flex:1 1 0;min-width:44px;height:44px;padding:0 4px;border-radius:22px;gap:6px;font-size:14px;overflow:hidden}
    .mtb-pop .m-b .mtb-t{height:56px;flex-direction:column;gap:2px;font-size:12px}
    .mtb-l{max-width:100%;overflow:hidden;text-overflow:ellipsis}
    .mtb-ic{display:inline-flex;flex:none;line-height:0}
    .mtb-t.warn:not(.on) .mtb-ic{color:var(--ki-red-text, var(--red,#f28073))}
    .mtb-g{width:56px;height:56px;border-radius:28px;flex:none;display:grid;place-items:center;margin:0;padding:0;border:0;background:var(--ki-surface, var(--gray200,#3a3a3a));box-shadow:inset 0 0 0 1px rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.05*var(--ki-wa-k,1)),var(--ki-wa-max,1)));color:var(--ki-text, var(--white,#fafafa));cursor:pointer;-webkit-tap-highlight-color:transparent;transition:transform .15s cubic-bezier(.34,1.5,.64,1)}
    .mtb-g:active{transform:scale(.92)}
  `;

  function bind(card, el, opts) {
    if (!el || !M.tabRow) return null;
    const row = el.classList && el.classList.contains('mtb-tabs') ? el : el.querySelector('.mtb-tabs');
    if (!row) return null;
    return M.tabRow(card, row, { items: () => Array.from(row.querySelectorAll('.mtb-t')), ...(opts || {}) });
  }

  M.tabBar = { html, CSS, bind, mode };
})();
