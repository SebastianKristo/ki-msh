/* Felles Tilpass-design (v2) – ett offisielt uttrykk for alle «Tilpass …»-ark i dashbordet.
 * Hvert kort bygger fortsatt sitt eget ark (egne klasser); dette laget legges oppå som adoptert stilark i arkets shadow
 * root (MSH.overlay) og i alle shadow roots inni arket (msh-editor, ki-spacing-editor, egne editorer) – aldri i kortene
 * på dashbordet. Bare kjente strukturer treffes (ingen generiske regler som kan knekke rader).
 *   Header: stor tittel venstre · Nullstill (spøkelsespille) · × (sirkel) · rosa Ferdig – sticky med uskarp bakgrunn
 *   Lister: grupperte rader 60 px med fargede ikonfliser, chevron, trykk-feedback
 *   Kontroller: brytere 50×30 rosa, faner/segmenter med rosa aktiv, chips, felt, slidere og knapper i samme mål
 *   Bevegelse: innholdet glir inn trinnvis når arket åpnes, fjærende trykk, myke overganger (av ved «reduser bevegelse»)
 * Slå av: localStorage['ki-tp-ui'] = 'off'.
 */
(function () {
  const M = window.MSH;
  if (!M || !M.overlay || M.__tpUi) return;
  M.__tpUi = true;
  try { if (localStorage.getItem('ki-tp-ui') === 'off') return; } catch (e) { /* */ }

  const PK = 'linear-gradient(145deg,rgb(242 133 201) -10%,rgb(245 205 198) 100%)';
  const I = '!important';
  const EASE = 'cubic-bezier(.2,.85,.25,1)', SPRING = 'cubic-bezier(.34,1.45,.64,1)';
  // Header-varianter: msh-editor (.ttl), Lys (.hdr), Klima (.nav.main), Strøm (.tph>.tt), Tilpass-hub (.tph>.tpt), Kamera/Hjem/Ringeklokke (.hd)
  const HDR = ':is(.ttl:has(> .tt):not(.hdr .ttl),.hdr[data-sheet-head],.nav.main,.tph,.hd:has(> .done),.hd:has(> .ok))';
  const TITLE = ':is(.ttl:not(.hdr .ttl) > .tt,.hdr .ttl > .tt,.nav.main > .nt,.tph > .tt,.tph > .tpt,.hd > .htx > b,.hd .col.grow > .tt,.hd > .t)';
  const TITLEBOX = ':is(.ttl:not(.hdr .ttl) > .tt,.hdr[data-sheet-head] > .ttl,.nav.main > .nt,.tph > .tt,.tph > .tpt,.hd > .htx,.hd > .col.grow,.hd > .t)';
  const SUB = ':is(.hdr .ttl > .ts,.hd > .htx > i,.hd .col.grow > .st)';
  const RESET = ':is([data-a="reset"],[data-a="hreset"])';
  const CANCEL = '[data-a="cancel"]';
  const DONE = ':is([data-a="done"],[data-a="save"])';
  const TABS = ':is(.chips.sg.tabs,.et[role="tablist"],.tabs[role="tablist"],.tpt[data-glass-drag],.tpt:has(> button))';
  // Brytere: bare sporene (ingen rader) – .trk/.sw med én knott, eller msh-editorens .sw::after
  const TRACK = ':is(.trk:not(:has(> :not(i))),.sw:not(:has(> :not(i,span:empty))):not(.sw:has(> b)),.tgl:has(> i):not(:has(> :not(i))))';
  const PAL = ['#f285c9', '#73b9f2', '#66d19e', '#f2b573', '#ad99e6', '#f2d26f', '#5fc4c4', '#f28073'];

  const CSS = `
  /* ---------- arket ---------- */
  .sh.tp{border-radius:38px 38px 0 0${I};box-shadow:0 -18px 50px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.06)${I}}
  .gz{height:28px${I}}
  .grab{width:44px${I};height:5px${I};border-radius:3px${I};background:rgba(255,255,255,.22)${I};transition:width .2s ${EASE},background .2s${I}}
  .gz:hover .grab,.gz:active .grab{width:56px${I};background:rgba(255,255,255,.4)${I}}
  .body>*{animation:tpIn .42s ${EASE} both}
  .body>*:nth-child(2){animation-delay:.03s}.body>*:nth-child(3){animation-delay:.06s}.body>*:nth-child(4){animation-delay:.09s}.body>*:nth-child(5){animation-delay:.12s}.body>*:nth-child(n+6){animation-delay:.15s}
  .wrap>*,.ed>*,.secs>*,.tpc,.w>*{animation:tpIn .42s ${EASE} both}
  .wrap>*:nth-child(2),.ed>*:nth-child(2),.secs>*:nth-child(2),.w>*:nth-child(2){animation-delay:.04s}
  .wrap>*:nth-child(3),.ed>*:nth-child(3),.secs>*:nth-child(3),.w>*:nth-child(3){animation-delay:.08s}
  .wrap>*:nth-child(n+4),.ed>*:nth-child(n+4),.secs>*:nth-child(n+4),.w>*:nth-child(n+4){animation-delay:.12s}
  @keyframes tpIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
  /* ---------- header ---------- */
  ${HDR}{display:flex${I};align-items:center${I};gap:8px${I};min-height:58px${I};flex-wrap:nowrap${I};justify-content:flex-start${I};padding-top:2px${I};padding-bottom:10px${I}}
  ${TITLEBOX}{order:0${I};flex:1 1 0${I};min-width:0${I};width:auto${I};max-width:none${I};overflow:hidden${I};text-align:left${I};margin:0${I}}
  .hdr[data-sheet-head] > .ttl,.hd > .htx,.hd > .col.grow{display:flex${I};flex-direction:column${I};align-items:flex-start${I};gap:2px${I}}
  ${TITLE}{display:block${I};font-size:26px${I};font-weight:600${I};letter-spacing:-.02em${I};line-height:1.12${I};color:var(--ki-text,#fafafa)${I};white-space:nowrap${I};overflow:hidden${I};text-overflow:ellipsis${I};max-width:none${I};width:auto${I};padding-right:2px${I}}
  ${SUB}{display:block${I};font-size:12.5px${I};font-weight:400${I};font-style:normal${I};color:var(--ki-text-mid,#979797)${I};white-space:nowrap${I};overflow:hidden${I};text-overflow:ellipsis${I};max-width:100%}
  ${HDR} > .stat{order:1}
  ${HDR} > ${RESET}{order:2${I};flex:none${I};width:auto${I};height:40px${I};padding:0 14px${I};border-radius:20px${I};background:transparent${I};box-shadow:inset 0 0 0 1px rgba(255,255,255,.14)${I};color:var(--ki-text-2,#c7c7c7)${I};font-size:0${I};display:inline-flex${I};align-items:center${I};justify-content:center${I};transition:background .2s,transform .2s ${SPRING}${I}}
  ${HDR} > ${RESET}::after{content:'Nullstill';font-size:14px;font-weight:500;letter-spacing:0}
  ${HDR} > ${RESET}:hover{background:rgba(255,255,255,.06)${I}}
  ${HDR} > ${CANCEL}{order:3${I};flex:none${I};width:40px${I};height:40px${I};padding:0${I};border-radius:20px${I};background:var(--ki-surface,#3a3a3a)${I};color:var(--ki-text-2,#c7c7c7)${I};font-size:0${I};display:grid${I};place-items:center${I};box-shadow:none${I};transition:transform .2s ${SPRING}${I}}
  ${HDR} > ${CANCEL} > *{display:none${I}}
  ${HDR} > ${CANCEL}::after{content:'';width:15px;height:15px;background:currentColor;-webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z'/%3E%3C/svg%3E") center/contain no-repeat;mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z'/%3E%3C/svg%3E") center/contain no-repeat}
  ${HDR} > :is(${DONE},.tpd){order:4${I};flex:none${I};width:auto${I};height:40px${I};padding:0 18px${I};border-radius:20px${I};background:${PK}${I};color:#2a1720${I};font-size:15px${I};font-weight:600${I};display:inline-flex${I};align-items:center${I};justify-content:center${I};gap:6px${I};box-shadow:0 6px 18px rgba(242,133,201,.28)${I};transition:transform .2s ${SPRING},box-shadow .2s${I}}
  ${HDR} > :is(${DONE},.tpd)[disabled]{opacity:.7${I}}
  ${HDR} > :is(${RESET},${CANCEL},${DONE},.tpd):active{transform:scale(.93)${I}}
  /* ---------- grupperte lister (Tilpass-hub og lignende) ---------- */
  .tpc{border-radius:26px${I};background:var(--ki-surface-3,#2f2f2f)${I};box-shadow:inset 0 0 0 1px rgba(255,255,255,.05)${I};overflow:hidden${I}}
  .tpr{height:62px${I};gap:14px${I};padding:0 14px 0 12px${I};border-top:1px solid rgba(255,255,255,.05)${I};transition:background .15s${I}}
  .tpr:first-child{border-top:0${I}}
  .tpr:hover{background:rgba(255,255,255,.03)${I}}
  .tpr:active{background:rgba(255,255,255,.07)${I}}
  .tpr:active .tpi{transform:scale(.9)${I}}
  .tpi{width:40px${I};height:40px${I};border-radius:13px${I};color:#232323${I};transition:transform .25s ${SPRING}${I};--mdc-icon-size:21px}
  ${PAL.map((c, i) => `.tpr:nth-child(${PAL.length}n+${i + 1}) .tpi{background:${c}${I}}`).join('')}
  .tpx b{font-size:15.5px${I};font-weight:500${I}}
  .tpx i{font-size:12.5px${I}}
  .tpr > ha-icon:last-child{transition:transform .25s ${EASE}}
  .tpr:hover > ha-icon:last-child{transform:translateX(2px)}
  /* ---------- faner og segmenter ---------- */
  ${TABS}{display:flex${I};flex-wrap:nowrap${I};gap:2px${I};padding:4px${I};border-radius:26px${I};background:var(--ki-surface-3,#2f2f2f)${I};box-shadow:inset 0 0 0 1px rgba(255,255,255,.05)${I}}
  ${TABS} > :is(button,.chip){flex:1 1 0${I};min-width:0${I};height:44px${I};border-radius:22px${I};padding:0 8px${I};font-size:14px${I};font-weight:500${I};color:var(--ki-text-2,#afafaf)${I};background:transparent${I};display:flex${I};align-items:center${I};justify-content:center${I};gap:6px${I};white-space:nowrap${I};transition:flex .3s ${EASE},background .25s,color .2s${I};--mdc-icon-size:20px}
  ${TABS} > :is(button,.chip):hover{color:var(--ki-text,#fafafa)${I}}
  ${TABS} > :is(button,.chip):is(.on,[aria-selected="true"]){flex:1.7 1 0${I};background:${PK}${I};color:#2a1720${I};box-shadow:0 6px 16px rgba(242,133,201,.25)${I}}
  .chips.sg:not(.tabs) > .chip.on,.seg > button:is(.on,[aria-pressed="true"]),.ss > button.on-pk{background:${PK}${I};color:#2a1720${I}}
  /* ---------- seksjoner ---------- */
  .fsh{font-size:11px${I};font-weight:600${I};letter-spacing:.09em${I};text-transform:uppercase${I};color:var(--ki-text-3,#7f7f7f)${I};padding:8px 8px 2px${I}}
  details.sec{border-radius:24px${I};background:var(--ki-sheet-grp,#3a3a3a)${I};box-shadow:inset 0 0 0 1px rgba(255,255,255,.05)${I};transition:background .2s${I}}
  details.sec>summary{height:56px${I};font-size:15px${I};font-weight:500${I};padding:0 18px${I}}
  details.sec>summary:hover{background:rgba(255,255,255,.03)}
  details.sec>summary .chev{transition:transform .3s ${SPRING}${I}}
  details.sec[open]>.in{animation:tpIn .3s ${EASE} both}
  .f{border-radius:20px${I}}
  /* ---------- brytere ---------- */
  ${TRACK}{position:relative${I};flex:none${I};width:50px${I};height:30px${I};border-radius:15px${I};background:var(--ki-ctrl,#545454)${I};transition:background .22s${I};display:block${I};padding:0${I}}
  ${TRACK}.on{background:var(--pink,#f285c9)${I}}
  ${TRACK}::after,${TRACK} > i,${TRACK} > span{position:absolute${I};top:3px${I};left:3px${I};width:24px${I};height:24px${I};border-radius:12px${I};background:#fafafa${I};box-shadow:0 1px 4px rgba(0,0,0,.35)${I};transform:none${I};transition:left .28s ${SPRING}${I}}
  ${TRACK}:has(> i)::after,${TRACK}:has(> span)::after{content:none${I}}
  ${TRACK}.on::after,${TRACK}.on > i,${TRACK}.on > span{left:23px${I}}
  /* ---------- knapper, chips, felt, slidere ---------- */
  .btn{border-radius:26px${I};transition:transform .2s ${SPRING},background .2s${I}}
  .btn.pri{background:${PK}${I};color:#2a1720${I};font-weight:600${I};box-shadow:0 6px 18px rgba(242,133,201,.22)${I}}
  .btn:active,.chip:active,.pill:active,.press:active,.ib:active,.hb:active{transform:scale(.95)${I}}
  .chip.on:not(${TABS} > .chip),.pill.on,.on-pk,.sm.on{background:${PK}${I};color:#2a1720${I}}
  input.inp,input.in,select.inp,.fld input,.fld select{min-height:46px${I};border-radius:16px${I};font-size:14.5px${I};transition:box-shadow .2s${I}}
  input.inp:focus,input.in:focus,.fld input:focus,textarea:focus{box-shadow:inset 0 0 0 1.5px var(--pink,#f285c9)${I}}
  .sl .tr{background:var(--ki-ctrl,#545454)${I}}
  .sl .fi{background:${PK}${I}}
  .sl .th{box-shadow:0 2px 8px rgba(0,0,0,.4)${I}}
  input[type=range]{accent-color:var(--pink,#f285c9)}
  @media (prefers-reduced-motion:reduce){.body>*,.wrap>*,.ed>*,.secs>*,.tpc,.w>*,details.sec[open]>.in{animation:none${I}}}
  `;

  let sheet = null;
  try { sheet = new CSSStyleSheet(); sheet.replaceSync(CSS); } catch (e) { sheet = null; }
  const seen = new WeakSet();
  const adopt = (root) => {
    if (!root || seen.has(root)) return;
    seen.add(root);
    try {
      if (sheet && 'adoptedStyleSheets' in root) root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
      else { const st = document.createElement('style'); st.textContent = CSS; root.appendChild(st); }
    } catch (e) { /* */ }
    const scan = (n) => { if (n && n.shadowRoot) adopt(n.shadowRoot); if (n && n.querySelectorAll) n.querySelectorAll('*').forEach((c) => { if (c.shadowRoot) adopt(c.shadowRoot); }); };
    scan(root);
    try { new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => { if (n.nodeType === 1) scan(n); }))).observe(root, { childList: true, subtree: true }); } catch (e) { /* */ }
  };
  // Haptikk på brytere/faner/chips i arkene (én per trykk)
  const hapt = (root) => root.addEventListener('click', (e) => {
    const t = e.composedPath && e.composedPath().find((n) => n && n.matches && n.matches('.trk,.sw,.tgl,.chip,.tpr,[role="tab"],.seg>button'));
    if (t && M.haptic) try { M.haptic('selection'); } catch (_) { /* */ }
  }, true);
  M.tilpassUiAdopt = adopt;
  M.TILPASS_UI_CSS = CSS;
  const orig = M.overlay;
  M.overlay = function () {
    const api = orig.apply(this, arguments);
    try { const r = api && (api.root || (api.host && api.host.shadowRoot)); if (r) { adopt(r); hapt(r); } } catch (e) { /* */ }
    return api;
  };
})();
