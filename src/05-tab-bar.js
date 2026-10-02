/* KI MSH · felles fanelinje («Som popups» og «Tekst + tannhjul») – Fiks 31.4 / 31.5, utvidet i Fiks 33.4.
 * Én komponent for fanelinjene som ser ut som popupenes: Hjem (tab_style popup | gear, 24-hjem-faner.js),
 * forhåndsvisningen i «Tilpass Hjem» → Faner → Fanestil (27-hjem-editor.js), Lys-popupen (43-lys.js) og Vanning (41-vanning.js).
 *   MSH.tabBar.html(items, cur, o) → '<div class="mtb mtb-pop|mtb-gear">…</div>'
 *     items: [{ key, label, icon?, warn? }]  (warn = rødt ikon når fanen ikke er aktiv, f.eks. Batterier med lave)
 *     o.variant: 'pop'  – flate #3a3a3a r26 pad 4 gap 2, like brede faner, aktiv rosa pille r22.
 *                         o.mode ikon|tekst|begge|aktiv (standard begge): begge = 56 px (ikon 20 over tekst 12), ellers 44 px;
 *                         aktiv = «Ikon + aktiv» (alle har ikon, bare den aktive viser navnet ved siden av, bredere).
 *                'gear' – tekstfaner på flate #3a3a3a r28 pad 4 gap 2, faner 48 px r24 tekst 14/500 #c7c7c7, bredde
 *                         etter teksten (flex 1 1 auto, padding 0 8px – aldri kuttet; for mange → vannrett scroll),
 *                         + rund knapp (#3a3a3a + innerkant) med settings 24 px.
 *     o.look: 'fylt' (standard) | 'kontur' (sporet = kortflate + innerkant .14, Vanning/Tesla/Klima «Kontur»)
 *     o.sticky: true → raden står fast øverst (sticky top 8px) med skygge 0 8px 20px under sporet og tannhjulet
 *     o.popup: true → fanehøyden følger 33.4 (MSH.tabH: kortets tab_height, ellers global «Fanehøyde i popups», ellers
 *              komponentens egen høyde). o.th = kortets egen høyde (px) → inline variabler på raden.
 *     o.attrs(item, i, on) → attributter per fane (standard: data-act="tab" data-v data-i data-haptic="selection")
 *     o.gear: false = ingen tannhjul (standard: med for 'gear'); o.gearAttrs, o.gearLabel, o.gearCls, o.gearIcon;
 *       tannhjulet er alltid like høyt som sporet (fanehøyde + 2 × innerpadding) og sentrert mot det.
 *     o.preview: spans uten roller. o.rowCls / o.tabCls / o.cls / o.trackCls: ekstra klasser (rad / faner / ytre / spor);
 *     o.keyPrefix (data-key, standard 'mtb-'); o.labelCls (ekstra klasse på navnet); o.trackAttrs (attributter på sporet).
 *   Utseendet kan justeres per kort med variabler på .mtb (standardverdiene = dagens utseende):
 *     --mtb-h0 (fanehøyde) --mtb-fs0 (tekst) --mtb-ic0 (ikon) --mtb-px0 (sidepadding) --mtb-pad (innerpadding) --mtb-gap
 *     --mtb-r (sporets radius) --mtb-tr (fanens radius) --mtb-bg / --mtb-sh (spor) --mtb-fg (inaktiv tekst) --mtb-g-bg (tannhjul)
 *   MSH.tabBar.CSS   – legg i kortets/arkets styles (klassene har prefiks mtb-, kolliderer ikke).
 *   MSH.tabBar.bind(card, el, opts) → MSH.tabRow på fanene (hold 400 ms + dra = flytt, Esc avbryter, glass-valg,
 *     haptic, touch-action pan-y + stopPropagation – fallgruve 2). opts som MSH.tabRow (active, order, field | save …).
 *
 * ===== Fiks 33.4 · fanehøyde i alle popups (MSH.tabH) – ÉN felles mekanisme for alle fanelinjer =====
 *   Trinn (som Hjem, TAB_H): Lav 32 · Standard 38 · Middels 44 · Høy 50 · Ekstra 56 px, egen verdi 28–64 px.
 *   Lagring: kortets config `tab_height` (tall = egen høyde; mangler/'auto' = «Følg global»). Global standard i ki-store
 *   `ui.popup_tab_height` («Tilpass Hjem» → Faner → «Fanehøyde i popups»; standardtrinnet er 38). Er den ikke satt,
 *   beholder hver popup sin egen høyde (mørk modus piksel-lik som før).
 *   Skalering (H = høyden): pille H, radius H/2, tekst 12 → 15 px (32 → 56), ikon 16 → 22 px, sidepadding 10 → 18 px,
 *   to-linjers faner (ikon over tekst) H + 16. Sporet følger med (H + 2 × innerpadding), tannhjulet = sporets høyde.
 *   CSS-variabler: global på <html>: --ki-ptab-th/-th2/-tf/-ti/-tp (arver inn i alle shadow roots, byttes live uten
 *   ny tegning); kortets egen verdi som inline variabler --msh-th/-th2/-tf/-ti/-tp på fanelinja (MSH.tabH.style(cfg)).
 *   Kortenes CSS bruker MSH.tabH.v('th', 44) → var(--msh-th,var(--ki-ptab-th,44px)) med sin egen høyde som reserve.
 *     MSH.tabH.own(cfg) → px | null       MSH.tabH.global() → px | null     MSH.tabH.height(cfg|card, native) → px
 *     MSH.tabH.style(cfg) → 'inline-variabler' ('' = følg global)          MSH.tabH.vars(px) → variabel-streng
 *     MSH.tabH.setGlobal(px|null)         MSH.tabH.sync()  (global → <html>)
 *     Editor (samme felt i alle Tilpass-ark og i GUI-editoren):
 *     MSH.tabH.field({ items, native, label }) → skjemafelt (type html) for msh-editor (kortets ark + getConfigElement)
 *     MSH.tabH.editorHTML(val, o) + MSH.tabH.bindEditor(root, { set(v, commit) }) → for egne ark (Klima, Lys, Varmepumpe …)
 *     Forhåndsvisning av fanelinja øverst i feltet (live), segment Følg global · Lav · Standard · Middels · Høy · Ekstra
 *     + slider 28–64 px. I HAs GUI-editor er slideren ha-selector number (28–64).
 */
(function () {
  const M = window.MSH;
  if (!M || M.tabBar) return;
  const esc = (s) => (M.esc ? M.esc(s) : String(s == null ? '' : s));
  const PINK = (M.C && M.C.accent) || 'linear-gradient(145deg, rgb(242 133 201) -10%, rgb(245 205 198) 100%)';
  const TH = M.theme || {};
  const WA = (a) => (TH.whiteA ? TH.whiteA(a) : `rgb(255 255 255 / ${a})`);
  const KA = (a) => (TH.blackA ? TH.blackA(a) : `rgb(0 0 0 / ${a})`);
  const mode = (v) => (v === 'ikon' || v === 'i' || v === 'ikoner' ? 'i' : v === 'tekst' || v === 't' ? 't' : v === 'aktiv' || v === 'a' ? 'a' : v === 'rad' || v === 'r' ? 'r' : 'b'); // r = ikon + tekst på én linje (forhåndsvisning)

  /* ================================================================ 33.4 · fanehøyde */
  const MIN = 28, MAX = 64, STEPS = [[32, 'Lav'], [38, 'Standard'], [44, 'Middels'], [50, 'Høy'], [56, 'Ekstra']], STD = 38;
  const GKEY = 'ui.popup_tab_height', LS = 'ki:popup_tab_height';
  const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
  const num = (v) => {
    if (v == null || v === '' || v === 'auto' || v === true || v === false) return null;
    const n = Number(v);
    return isFinite(n) && n > 0 ? clampN(Math.round(n), MIN, MAX) : null;
  };
  const r1 = (x) => Math.round(x * 10) / 10;
  const scale = (px) => {
    const h = num(px);
    if (h == null) return null;
    const t = (h - 32) / 24;
    return { h, h2: h + 16, f: r1(clampN(12 + 3 * t, 11, 16.5)), i: Math.round(clampN(16 + 6 * t, 14, 24)), p: Math.round(clampN(10 + 8 * t, 8, 20)) };
  };
  const vars = (px, pre) => {
    const s = scale(px);
    if (!s) return '';
    pre = pre || '--msh-';
    return `${pre}th:${s.h}px;${pre}th2:${s.h2}px;${pre}tf:${s.f}px;${pre}ti:${s.i}px;${pre}tp:${s.p}px;`;
  };
  const cfgOf = (x) => (x && x.nodeType === 1 ? (x.config || x._config || {}) : x || {});
  const own = (x) => num(cfgOf(x).tab_height);
  const global = () => {
    const S = M.store;
    let v;
    try { v = S && S.get ? S.get(GKEY) : undefined; } catch (e) { v = undefined; }
    if (v != null || (S && S.loaded)) {
      const n = num(v);
      try { const o = localStorage.getItem(LS); if (n == null) { if (o != null) localStorage.removeItem(LS); } else if (o !== String(n)) localStorage.setItem(LS, String(n)); } catch (e) { /* */ }
      return n;
    }
    try { return num(localStorage.getItem(LS)); } catch (e) { return null; }
  };
  const height = (x, native) => { const o = own(x); if (o != null) return o; const g = global(); return g != null ? g : (native != null ? num(native) || native : null); };
  const style = (x) => vars(own(x));
  // CSS-hjelper: v('th', 44) → var(--msh-th,var(--ki-ptab-th,44px)); n kan også være en CSS-verdi ('var(--x)')
  const v = (k, n) => `var(--msh-${k},var(--ki-ptab-${k},${typeof n === 'number' ? n + 'px' : n}))`;
  const sync = () => {
    const s = document.documentElement && document.documentElement.style;
    if (!s) return;
    const sc = scale(global());
    ['th', 'th2', 'tf', 'ti', 'tp'].forEach((k) => {
      const nv = sc ? { th: sc.h, th2: sc.h2, tf: sc.f, ti: sc.i, tp: sc.p }[k] + 'px' : null;
      if (nv) { if (s.getPropertyValue('--ki-ptab-' + k) !== nv) s.setProperty('--ki-ptab-' + k, nv); } else s.removeProperty('--ki-ptab-' + k);
    });
  };
  // Global verdi: følger utkastet i «Tilpass Hjem» (Ferdig lagrer, Avbryt ruller tilbake – ki-store-transaksjonen)
  const setGlobal = (px, opts) => {
    const n = num(px);
    try { if (n == null) localStorage.removeItem(LS); else localStorage.setItem(LS, String(n)); } catch (e) { /* */ }
    const r = M.store && M.store.set ? M.store.set(GKEY, n == null ? undefined : n, opts) : null;
    sync();
    try { window.dispatchEvent(new CustomEvent('ki-tabh-change', { detail: { px: n } })); } catch (e) { /* */ }
    return r;
  };
  sync();
  (function sub(n) {
    if (M.store && M.store.subscribe) { M.store.subscribe((d, p) => { if (!p || p === 'ui' || p.startsWith(GKEY) || GKEY.startsWith(p + '.')) sync(); }); sync(); return; }
    if (n < 40) setTimeout(() => sub(n + 1), 250);
  })(0);

  /* ---------------------------------------------------------------- fanelinja */
  function html(items, cur, o) {
    o = o || {};
    const kp = o.keyPrefix != null ? o.keyPrefix : 'mtb-';
    const vr = o.variant === 'gear' ? 'gear' : 'pop', m = vr === 'gear' ? 't' : mode(o.mode), pv = !!o.preview, tag = pv ? 'span' : 'button';
    const icS = m === 'i' ? 22 : 20;
    const btn = (t, i) => {
      const on = t.key === cur;
      const a = o.attrs ? o.attrs(t, i, on) : `data-act="${o.act || 'tab'}" data-v="${esc(t.key)}" data-i="${i}" data-haptic="selection"`;
      const ic = m !== 't' ? `<span class="mtb-ic">${M.icon(t.icon || 'mdi:tab', icS)}</span>` : '';
      const lb = m !== 'i' && (m !== 'a' || on) ? `<span class="mtb-l${o.labelCls ? ' ' + o.labelCls : ''}">${esc(t.label)}</span>` : '';
      return `<${tag} class="mtb-t${o.tabCls ? ' ' + o.tabCls : ''}${on ? ' on' : ''}${t.warn ? ' warn' : ''}" ${pv ? '' : `role="tab" aria-selected="${on}"`} ${on && !pv ? 'data-active' : ''} aria-label="${esc(t.label)}" data-key="${esc(kp)}${esc(t.key)}" ${a}>${ic}${lb}</${tag}>`;
    };
    const withGear = o.gear != null ? !!o.gear : vr === 'gear';
    const gt = pv ? 'span' : 'button';
    const gear = withGear ? `<${gt} class="gear mtb-g${o.gearCls ? ' ' + o.gearCls : ''}" data-key="mtb-gear" ${pv ? '' : o.gearAttrs || 'data-act="customize" data-haptic="light"'} aria-label="${esc(o.gearLabel || 'Tilpass')}">${M.icon(o.gearIcon || 'settings', 24)}</${gt}>` : '';
    const cls = `mtb mtb-${vr} mtb-m-${m}${o.look === 'kontur' ? ' mtb-kontur' : ''}${o.sticky ? ' mtb-sticky' : ''}${o.popup ? ' mtb-ph' : ''}${o.cls ? ' ' + o.cls : ''}`;
    const st = (o.popup && o.th != null ? vars(o.th) : '') + (o.style || '');
    const rowA = pv ? 'aria-hidden="true"' : `role="tablist" data-gd-skip${o.label ? ` aria-label="${esc(o.label)}"` : ''}`;
    return `<div class="${cls}" data-key="${esc(o.key || 'mtb')}"${o.look ? ` data-look="${esc(o.look)}"` : ''}${st ? ` style="${st}"` : ''}${o.outerAttrs ? ' ' + o.outerAttrs : ''}><div class="mtb-tabs m-${m}${o.rowCls ? ' ' + o.rowCls : ''}" ${rowA}${o.trackAttrs ? ' ' + o.trackAttrs : ''}>${(items || []).map(btn).join('')}</div>${gear}</div>`;
  }

  // Høyden: --mtb-h0 = komponentens egen; med o.popup følger den 33.4-variablene (kortets egen → global → egen).
  const CSS = `
    .mtb{--mtb-pad:4px;--mtb-gap:2px;--mtb-h0:44px;--mtb-fs0:14px;--mtb-ic0:20px;--mtb-px0:4px;--mtb-r:26px;--mtb-tr:calc(var(--mtb-h) / 2);
      --mtb-h:var(--mtb-h0);--mtb-fs:var(--mtb-fs0);--mtb-ic:var(--mtb-ic0);--mtb-px:var(--mtb-px0);
      display:flex;align-items:center;gap:8px;min-width:0;width:100%;box-sizing:border-box}
    .mtb-pop.mtb-m-b{--mtb-h0:56px;--mtb-fs0:12px;--mtb-tr:22px}
    .mtb-pop.mtb-m-i{--mtb-ic0:22px}
    .mtb-gear{--mtb-h0:48px;--mtb-px0:8px;--mtb-r:28px}
    .mtb-ph{--mtb-h:${v('th', 'var(--mtb-h0)')};--mtb-fs:${v('tf', 'var(--mtb-fs0)')};--mtb-ic:${v('ti', 'var(--mtb-ic0)')};--mtb-px:${v('tp', 'var(--mtb-px0)')}}
    .mtb-ph.mtb-m-b{--mtb-h:${v('th2', 'var(--mtb-h0)')};--mtb-tr:calc(${v('th', 44)} / 2)}
    .mtb-tabs{position:relative;flex:1;min-width:0;display:flex;gap:var(--mtb-gap);padding:var(--mtb-pad);box-sizing:border-box;border-radius:var(--mtb-r);background:var(--mtb-bg,var(--ki-surface-3, var(--gray200,#3a3a3a)));box-shadow:var(--mtb-sh,inset 0 0 0 1px ${WA(0.05)});overflow-x:auto;overflow-y:hidden;scrollbar-width:none;touch-action:pan-y;overscroll-behavior-x:contain;user-select:none;-webkit-user-select:none}
    .mtb-tabs::-webkit-scrollbar{display:none}
    .mtb-kontur{--mtb-bg:var(--mtb-k-bg,var(--ki-surface, var(--gray200,#3a3a3a)));--mtb-sh:inset 0 0 0 1px ${WA(0.14)}}
    .mtb-sticky{position:sticky;top:8px;z-index:6}
    .mtb-sticky .mtb-tabs{box-shadow:var(--mtb-sh,inset 0 0 0 1px ${WA(0.05)}),0 8px 20px ${KA(0.3)}}
    .mtb-t{display:flex;align-items:center;justify-content:center;box-sizing:border-box;margin:0;border:0;white-space:nowrap;font-family:inherit;font-weight:500;line-height:1.2;color:var(--mtb-fg,var(--ki-text-2, var(--gray900,#c7c7c7)));background:transparent;cursor:pointer;-webkit-tap-highlight-color:transparent;-webkit-touch-callout:none;user-select:none;-webkit-user-select:none;transition:background .2s,color .2s}
    .mtb-t.on{background:${PINK};color:var(--mtb-on-fg,var(--ki-on-accent, var(--gray100,#2f2f2f)))}
    .mtb-gear .mtb-t{flex:1 1 auto;min-width:max-content;height:var(--mtb-h);padding:0 var(--mtb-px);border-radius:var(--mtb-tr);font-size:var(--mtb-fs)}
    .mtb-pop .mtb-t{flex:1 1 0;min-width:44px;height:var(--mtb-h);padding:0 var(--mtb-px);border-radius:var(--mtb-tr);gap:6px;font-size:var(--mtb-fs);overflow:hidden}
    .mtb-pop.mtb-m-b .mtb-t{flex-direction:column;gap:2px}
    .mtb-pop.mtb-m-a .mtb-t{flex-direction:row;gap:6px;transition:background .25s,color .25s,flex-grow .25s}
    .mtb-pop.mtb-m-a .mtb-t.on{flex:2.4 1 auto;padding:0 12px}
    .mtb-ph .mtb-ic ha-icon{--mdc-icon-size:var(--mtb-ic) !important;width:var(--mtb-ic) !important;height:var(--mtb-ic) !important}
    .mtb-l{max-width:100%;overflow:hidden;text-overflow:ellipsis}
    .mtb-ic{display:inline-flex;flex:none;line-height:0}
    .mtb-t.warn:not(.on) .mtb-ic{color:var(--ki-red-text, var(--red,#f28073))}
    .mtb-g{--g:calc(var(--mtb-h) + 2 * var(--mtb-pad));width:var(--g);height:var(--g);border-radius:calc(var(--g) / 2);flex:none;align-self:center;display:grid;place-items:center;margin:0;padding:0;border:0;background:var(--mtb-g-bg,var(--ki-surface, var(--gray200,#3a3a3a)));box-shadow:var(--mtb-g-sh,inset 0 0 0 1px ${WA(0.05)});color:var(--ki-text, var(--white,#fafafa));cursor:pointer;-webkit-tap-highlight-color:transparent;transition:transform .15s cubic-bezier(.34,1.5,.64,1)}
    .mtb-kontur .mtb-g{--mtb-g-sh:inset 0 0 0 1px ${WA(0.14)}}
    .mtb-sticky .mtb-g{box-shadow:var(--mtb-g-sh,inset 0 0 0 1px ${WA(0.05)}),0 8px 20px ${KA(0.3)}}
    .mtb-g:active{transform:scale(.92)}
  `;

  function bind(card, el, opts) {
    if (!el || !M.tabRow) return null;
    const row = el.classList && el.classList.contains('mtb-tabs') ? el : el.querySelector('.mtb-tabs');
    if (!row) return null;
    return M.tabRow(card, row, { items: () => Array.from(row.querySelectorAll('.mtb-t')), ...(opts || {}) });
  }

  M.tabBar = { html, CSS, bind, mode };

  /* ---------------------------------------------------------------- 33.4 · editorfeltet (felles) */
  const ED_CSS = `
    .mth{display:flex;flex-direction:column;gap:10px;min-width:0}
    .mth-hd{display:flex;align-items:baseline;gap:8px;padding:0 2px}
    .mth-l{flex:1;font-size:13px;font-weight:500;color:var(--ki-text, #fafafa)}
    .mth-v{font-size:13px;color:var(--ki-text-2, #afafaf);font-variant-numeric:tabular-nums;white-space:nowrap}
    .mth-pv{padding:10px;border-radius:20px;background:var(--ki-popup, #282828);box-shadow:inset 0 0 0 1px ${WA(0.05)};overflow:hidden;pointer-events:none}
    .mth-pv .mtb-t{min-width:0}
    .mth-ch{display:flex;flex-wrap:wrap;gap:6px}
    .mth-c{height:34px;padding:0 12px;border:0;border-radius:17px;font:inherit;font-size:13px;font-weight:500;white-space:nowrap;cursor:pointer;background:var(--ki-surface-2, var(--gray300,#404040));color:var(--ki-text-1, #e1e1e1);-webkit-tap-highlight-color:transparent}
    .mth-c.on{background:${PINK};color:var(--ki-on-accent, #2a1720)}
    .mth-c small{font-size:11px;font-weight:400;opacity:.8;margin-left:4px}
    .mth-sl{display:flex;align-items:center;gap:10px;min-width:0}
    .mth-sl span{font-size:12px;color:var(--ki-text-3, #7f7f7f);font-variant-numeric:tabular-nums}
    .mth-r{flex:1;min-width:0;height:28px;margin:0;accent-color:var(--pink,#f285c9);touch-action:pan-y;cursor:pointer}
    .mth-h{font-size:12px;color:var(--ki-text-mid, #979797);padding:0 2px;line-height:1.4}
  `;
  const STYLE = `<style>${CSS}${ED_CSS}</style>`;
  const DEF_ITEMS = ['Oversikt', 'Detaljer', 'Logg'];
  // Forhåndsvisning: fanelinja i valgt høyde (felles MSH.tabBar, kortets egne fanenavn)
  const preview = (px, o) => {
    const labs = (o.items && o.items.length ? o.items : DEF_ITEMS).slice(0, 4).map((l, i) => (typeof l === 'string' ? { key: 'p' + i, label: l } : { key: l.key || 'p' + i, label: l.label, icon: l.icon }));
    return html(labs, labs[0].key, { variant: o.variant || 'pop', mode: o.mode || (labs.some((x) => x.icon) ? 'aktiv' : 'tekst'), preview: true, popup: true, th: px, gear: o.gear !== false, key: 'mth-bar', look: o.look });
  };
  // val: kortets tab_height (eller den globale verdien med o.global). o: { items, native, global, gui, name, label, help }
  // Valg kan være funksjoner av configen (o.cfg): native/mode/look/gear/variant(cfg), items(hass, cfg)
  const resolve = (o) => {
    const c = o.cfg || {}, out = { ...o };
    ['native', 'mode', 'look', 'gear', 'variant'].forEach((k) => { if (typeof o[k] === 'function') { try { out[k] = o[k](c); } catch (e) { out[k] = undefined; } } });
    if (typeof o.items === 'function') { try { out.items = o.items(o.hass || M.lastHass || null, c); } catch (e) { out.items = null; } }
    return out;
  };
  function editorHTML(val, o) {
    o = resolve(o || {});
    const cur = num(val), g = global(), isG = !!o.global;
    const base = isG ? (o.native != null ? o.native : STD) : (g != null ? g : (o.native != null ? num(o.native) : STD));
    const eff = cur != null ? cur : base;
    const name = o.name || (isG ? 'popup_tab_height' : 'tab_height');
    const chip = (vv, l, on, extra) => `<button type="button" class="mth-c${on ? ' on' : ''}" data-mth="${vv}" aria-pressed="${on}" data-haptic="off">${esc(l)}${extra ? `<small>${esc(extra)}</small>` : ''}</button>`;
    const first = isG ? chip('auto', 'Popupens egen', cur == null) : chip('auto', 'Følg global', cur == null, `${base} px`);
    const chips = first + STEPS.map(([px, l]) => chip(px, l, cur === px, `${px}`)).join('');
    const label = o.label || (isG ? 'Fanehøyde i popups' : 'Fanehøyde');
    const help = o.help != null ? o.help : isG ? (cur == null ? 'Hver popup bruker sin egen fanehøyde til du velger en standard her. Popups på «Følg global» følger denne.' : 'Gjelder alle popups med faner som står på «Følg global».') : (cur == null ? (g != null ? `Følger «Fanehøyde i popups» i Tilpass Hjem (${g} px).` : 'Følger «Fanehøyde i popups» i Tilpass Hjem (ikke satt – popupens egen høyde).') : 'Egen høyde for denne popupen.');
    const slider = o.gui && !isG && customElements.get('ha-selector')
      ? `<ha-selector data-name="${esc(name)}" data-nomorph data-def="${eff}" data-selector="${esc(JSON.stringify({ number: { min: MIN, max: MAX, step: 1, mode: 'slider', unit_of_measurement: 'px' } }))}" data-label="Egen fanehøyde" data-helper="28–64 px · Følg global = ta bort egen verdi"></ha-selector>`
      : `<div class="mth-sl"><span>${MIN}</span><input class="mth-r" type="range" min="${MIN}" max="${MAX}" step="1" value="${eff}" data-mth-r="1" aria-label="${esc(label)} i px"><span>${MAX}</span></div>`;
    return `${STYLE}<div class="mth" data-key="mth-${esc(name)}" data-mth-field="${esc(name)}">
      <div class="mth-hd"><span class="mth-l">${esc(label)}</span><span class="mth-v" data-mth-val>${eff} px</span></div>
      ${o.preview === false ? '' : `<div class="mth-pv" data-mth-pv aria-hidden="true">${preview(eff, o)}</div>`}
      <div class="mth-ch" role="group" aria-label="${esc(label)}">${chips}</div>
      ${slider}
      ${help ? `<div class="mth-h">${esc(help)}</div>` : ''}
    </div>`;
  }
  // Kobler segment + slider i roten (delegert, idempotent). api.set(v, commit): v = px eller undefined (= følg global)
  function bindEditor(root, api) {
    if (!root) return;
    root.__mthApi = api;
    if (root.__mthBound) return;
    root.__mthBound = true;
    const A = () => root.__mthApi || {};
    const field = (el) => el && el.closest && el.closest('[data-mth-field]');
    root.addEventListener('click', (e) => {
      const b = e.target && e.target.closest && e.target.closest('[data-mth]');
      if (!b || !field(b)) return;
      e.stopPropagation();
      const vv = b.dataset.mth === 'auto' ? undefined : num(b.dataset.mth);
      if (M.haptic) M.haptic('selection');
      if (A().set) A().set(vv, true);
    });
    const live = (el, commit) => {
      const f = field(el), px = num(el.value);
      if (!f || px == null) return;
      const lab = f.querySelector('[data-mth-val]');
      if (lab) lab.textContent = px + ' px';
      // forhåndsvisningen følger slideren straks (også før arket tegnes på nytt)
      const bar = f.querySelector('[data-mth-pv] .mtb');
      if (bar) { const s = scale(px); ['th', 'th2', 'tf', 'ti', 'tp'].forEach((k) => bar.style.setProperty('--msh-' + k, { th: s.h, th2: s.h2, tf: s.f, ti: s.i, tp: s.p }[k] + 'px')); }
      f.querySelectorAll('[data-mth]').forEach((c) => { const on = num(c.dataset.mth) === px; c.classList.toggle('on', on); c.setAttribute('aria-pressed', String(on)); });
      if (A().set) A().set(px, commit);
    };
    root.addEventListener('input', (e) => { const t = e.target; if (t && t.dataset && t.dataset.mthR) { e.stopPropagation(); live(t, false); } }, true);
    root.addEventListener('change', (e) => { const t = e.target; if (t && t.dataset && t.dataset.mthR) { e.stopPropagation(); live(t, true); } }, true);
    // fallgruve 2: slideren eier vannrett dra – arket/Bubble-popupen får ikke gesten
    ['pointerdown', 'touchstart', 'touchmove'].forEach((t) => root.addEventListener(t, (e) => { const x = e.target; if (x && x.dataset && x.dataset.mthR) e.stopPropagation(); }, { passive: true }));
  }
  // Skjemafelt for msh-editor (kortets eget Tilpass-ark og HAs GUI-editor bruker samme skjema)
  function field(o) {
    o = o || {};
    const name = o.name || 'tab_height';
    return {
      type: 'html', id: 'tab_height', name: undefined, label: o.label || 'Fanehøyde',
      html(h, c, key, ed) {
        if (ed && ed.shadowRoot) {
          bindEditor(ed.shadowRoot, { set: (vv, commit) => { if (ed._set) ed._set(name, vv, commit !== false); } });
          if (!ed.__mthSub) { ed.__mthSub = true; window.addEventListener('ki-tabh-change', () => { if (ed.isConnected && ed._render) ed._render(); }); }
        }
        return `<div class="f" style="padding:6px 2px">${editorHTML(c && c[name], { ...o, cfg: c || {}, hass: h, gui: !(ed && ed._inline) })}</div>`;
      },
    };
  }
  M.tabH = { MIN, MAX, STEPS, STD, KEY: GKEY, num, scale, vars, own, global, height, style, v, sync, setGlobal, editorHTML, bindEditor, field, preview };
})();
