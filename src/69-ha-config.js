/* KI MSH · Home Assistant-innstillinger i appen (Fiks 65) – erstatning for HAs egne innstillingssider der det lar seg gjøre.
 * Ett helhøyt Tilpass-ark (MSH.overlay({ tilpass: true })) med egen sidestabel (dytt/tilbake med glid-animasjon):
 *   Innstillinger (hub) → Automasjoner · Scener · Skript (lister med mapper = HA-kategorier, etiketter, område, søk) →
 *   visuell editor / YAML · Mapper · Etiketter · Oppdateringer · Sikkerhetskopier · System (start på nytt, sjekk
 *   konfigurasjon, logger, reparasjoner, generelt). Sider appen ikke har egen versjon av åpner HAs side (↗).
 *
 * API:
 *   MSH.ha.open(side?, args?)   åpner arket (side: 'hub' | 'automation' | 'scene' | 'script' | 'updates' | 'backups' | 'system' …)
 *   MSH.ha.page(id, def)        registrerer en side: { title(ctx, args), render(ctx, args) → HTML, act(ctx, a, el, args),
 *                               input(ctx, el, args), load(ctx, args) → Promise, back(ctx, args) → false for å stoppe tilbake, wide }
 *   ctx = { h (hass), ws(type, data), api(method, path, body), reg (registercache), push(id, args), pop(), render(),
 *           toast, confirm(key) (to trykk), busy(key, promise), state (per side), sheet (velgerark i arket) }
 * Data hentes bare når arket er åpent (ingen polling i bakgrunnen). Alle endringer går rett til HA (WebSocket/REST).
 * Felles UI: MSH.ha.ui (rad, gruppe, bryter, chips, felt) – samme flater som Tilpass-arkene (tokens med mørk fallback).
 */
(function () {
  const M = window.MSH;
  if (!M || M.ha) return;
  const esc = M.esc;
  const T = (n, e) => (window.kiT ? window.kiT(n, e) : n);
  const hassNow = () => M.lastHass || ((document.querySelector('home-assistant') || {}).hass) || null;
  const PAGES = {};

  /* ------------------------------------------------------------ HA-versjon og kall */
  const verOf = (h) => {
    const v = String((h && h.config && h.config.version) || '0.0').split('.');
    return Number(v[0]) * 100 + Number(v[1] || 0); // 2024.10 → 202410
  };
  const errText = (e) => (e && (e.body && e.body.message || e.message || e.error || e.code)) || String(e || 'ukjent feil');

  /* ------------------------------------------------------------ registercache (hentes ved åpning, oppdateres etter endringer) */
  const reg = {
    ents: null, labels: [], cats: {}, at: 0,
    async load(h, force) {
      if (!h) return;
      if (!force && this.ents && Date.now() - this.at < 15000) return;
      const ws = (t, d) => h.callWS({ type: t, ...(d || {}) }).catch(() => null);
      const [ents, labels, ca, cs, cc] = await Promise.all([ws('config/entity_registry/list'), ws('config/label_registry/list'),
        ws('config/category_registry/list', { scope: 'automation' }), ws('config/category_registry/list', { scope: 'scene' }), ws('config/category_registry/list', { scope: 'script' })]);
      const m = {};
      (ents || []).forEach((e) => { m[e.entity_id] = e; });
      this.ents = m; this.labels = labels || []; this.cats = { automation: ca || [], scene: cs || [], script: cc || [] }; this.at = Date.now();
    },
    ent(id) { return (this.ents && this.ents[id]) || (hassNow() && hassNow().entities && hassNow().entities[id]) || null; },
    label(id) { return this.labels.find((l) => l.label_id === id) || null; },
    cat(scope, id) { return (this.cats[scope] || []).find((c) => c.category_id === id) || null; },
  };

  /* ------------------------------------------------------------ fargeverdier for etiketter (HA: navn eller hex) */
  const LABEL_COLORS = ['red', 'pink', 'purple', 'deep-purple', 'indigo', 'blue', 'light-blue', 'cyan', 'teal', 'green', 'light-green', 'lime', 'yellow', 'amber', 'orange', 'deep-orange', 'brown', 'grey', 'blue-grey'];
  const labelColor = (c) => (!c ? 'var(--ki-text-3, #7f7f7f)' : /^#|^rgb/.test(c) ? c : `var(--${c}-color, var(--ki-text-3, #7f7f7f))`);

  /* ------------------------------------------------------------ felles UI-byggeklosser */
  const ui = {
    ic: (n, s, st) => M.icon(n, s || 22, st || ''),
    // rad: { a, v, icon, iconBg, title, sub, right, chev, key, cls, attrs, ext }
    row(o) {
      const tag = o.a ? 'button' : 'div';
      const right = o.right != null ? o.right : '';
      const chev = o.ext ? ui.ic('mdi:open-in-new', 18, 'color:var(--ki-text-3, #7f7f7f);flex:none') : o.chev ? ui.ic('mdi:chevron-right', 22, 'color:var(--ki-text-3, #7f7f7f);flex:none') : '';
      return `<${tag} class="hr ${o.cls || ''}" ${o.a ? `data-a="${esc(o.a)}"` : ''} ${o.v != null ? `data-v="${esc(o.v)}"` : ''} ${o.key ? `data-key="${esc(o.key)}"` : ''} ${o.attrs || ''}>
        ${o.icon ? `<span class="hi" ${o.iconBg ? `style="background:${o.iconBg};color:var(--ki-on-accent, #2a1720)"` : ''}>${ui.ic(o.icon, 22)}</span>` : ''}
        <span class="ht"><b>${o.titleHtml || esc(o.title || '')}</b>${o.sub || o.subHtml ? `<i>${o.subHtml || esc(o.sub)}</i>` : ''}</span>${right}${chev}</${tag}>`;
    },
    group: (rows, key) => (rows ? `<div class="hg" ${key ? `data-key="${esc(key)}"` : ''}>${rows}</div>` : ''),
    sec: (t, right) => `<div class="hs"><span>${esc(t)}</span>${right || ''}</div>`,
    sw: (on, a, v, dis) => `<button class="sw ${on ? 'on' : ''}" role="switch" aria-checked="${!!on}" data-a="${esc(a)}" ${v != null ? `data-v="${esc(v)}"` : ''} ${dis ? 'disabled' : ''}><i></i></button>`,
    chip: (label, on, a, v, extra) => `<button class="ch ${on ? 'on' : ''}" data-a="${esc(a)}" ${v != null ? `data-v="${esc(v)}"` : ''} aria-pressed="${!!on}" ${extra || ''}>${label}</button>`,
    btn: (label, a, v, cls, icon, extra) => `<button class="bt ${cls || ''}" data-a="${esc(a)}" ${v != null ? `data-v="${esc(v)}"` : ''} ${extra || ''}>${icon ? ui.ic(icon, 18) : ''}<span>${esc(label)}</span></button>`,
    // tekstfelt: { f, value, ph, type, label, mono, area, rows, attrs, list }
    field(o) {
      const lab = o.label ? `<span class="fl">${esc(o.label)}</span>` : '';
      const common = `data-f="${esc(o.f)}" ${o.t ? `data-t="${esc(o.t)}"` : ''} placeholder="${esc(o.ph || '')}" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" ${o.attrs || ''}`;
      const inp = o.area
        ? `<textarea class="in ${o.mono ? 'mono' : ''}" rows="${o.rows || 3}" ${common} data-key="ta-${esc(o.f)}">${esc(o.value == null ? '' : o.value)}</textarea>`
        : `<input class="in ${o.mono ? 'mono' : ''}" type="${o.type || 'text'}" ${o.step ? `step="${o.step}"` : ''} value="${esc(o.value == null ? '' : o.value)}" ${common} ${o.list ? `list="${esc(o.list)}"` : ''} data-key="in-${esc(o.f)}">`;
      return `<label class="fd ${o.cls || ''}">${lab}${inp}${o.hint ? `<span class="fh">${esc(o.hint)}</span>` : ''}</label>`;
    },
    // nedtrekk: { f, value, opts: [[v, tekst]], label }
    select(o) {
      return `<label class="fd ${o.cls || ''}">${o.label ? `<span class="fl">${esc(o.label)}</span>` : ''}<span class="sel"><select class="in" data-f="${esc(o.f)}" ${o.t ? `data-t="${esc(o.t)}"` : ''} data-key="se-${esc(o.f)}">${o.opts.map(([v, t]) => `<option value="${esc(v)}" ${String(v) === String(o.value == null ? '' : o.value) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>${ui.ic('mdi:chevron-down', 18, 'color:var(--ki-text-mid, #979797)')}</span></label>`;
    },
    seg(f, value, opts) {
      return `<div class="sg" role="tablist">${opts.map(([v, t]) => `<button class="${String(v) === String(value) ? 'on' : ''}" data-a="seg" data-f="${esc(f)}" data-v="${esc(v)}" aria-selected="${String(v) === String(value)}">${esc(t)}</button>`).join('')}</div>`;
    },
    empty: (icon, text, extra) => `<div class="em">${ui.ic(icon, 30, 'color:var(--ki-text-3, #7f7f7f)')}<span>${esc(text)}</span>${extra || ''}</div>`,
    spin: (text) => `<div class="em">${'<span class="spn"></span>'}<span>${esc(text || T('Henter …', 'Loading …'))}</span></div>`,
    labelChip: (l) => (l ? `<span class="lb" style="--lc:${labelColor(l.color)}">${l.icon ? ui.ic(l.icon, 14) : '<i></i>'}${esc(l.name)}</span>` : ''),
    badge: (n, warn) => (n ? `<span class="bd ${warn ? 'w' : ''}">${n}</span>` : ''),
    entPick: (o) => (M.entityPicker ? M.entityPicker.html({ key: o.key, value: o.value || '', domains: o.domains || '', placeholder: o.ph || T('Velg entitet', 'Choose entity'), attrs: `data-f="${esc(o.f)}" ${o.t ? `data-t="${esc(o.t)}"` : ''}` }) : ui.field({ f: o.f, value: o.value, ph: 'light.stue', mono: true })),
    entMulti: (o) => (M.entityMultiPicker ? M.entityMultiPicker.html({ key: o.key, value: o.value || [], domains: o.domains || '', label: o.label || T('Entiteter', 'Entities'), icon: o.icon, hint: o.hint, attrs: `data-f="${esc(o.f)}"` }) : ui.field({ f: o.f, value: [].concat(o.value || []).join(', '), ph: 'light.stue, light.kjokken', mono: true })),
  };
  // M.entityMultiPicker.html har ikke attrs – legg data-f på selv
  const multiHtml = (o) => {
    if (!M.entityMultiPicker) return ui.field({ f: o.f, value: [].concat(o.value || []).join(', '), ph: 'light.stue, light.kjokken', mono: true, t: 'list' });
    return M.entityMultiPicker.html({ key: o.key, value: o.value || [], domains: o.domains || '', label: o.label || T('Entiteter', 'Entities'), icon: o.icon || 'mdi:shape-outline', hint: o.hint || ' ' }).replace('<msh-entity-multi ', `<msh-entity-multi data-f="${esc(o.f)}" data-t="list" `);
  };
  ui.entMulti = multiHtml;

  /* ------------------------------------------------------------ CSS */
  const WA = (a) => `rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(${a}*var(--ki-wa-k,1)),var(--ki-wa-max,1)))`;
  const ACC = M.SWITCH_ON || 'var(--pink,#f285c9)';
  const CSS = `
    .sh{background:var(--ki-popup, var(--gray050,#282828))}
    .sh.tp{--ki-sh-px:16px}
    .body{display:block}
    button,input,select,textarea{font:inherit;color:inherit;border:0;background:none;padding:0;margin:0}
    button{cursor:pointer;-webkit-tap-highlight-color:transparent}
    button:disabled{opacity:.45;cursor:default}
    .pgw{position:relative;min-height:calc(100% - 4px)}
    .pg{display:flex;flex-direction:column;gap:10px;padding-bottom:calc(96px + env(safe-area-inset-bottom, 0px))}
    .pg.fw{animation:pgIn .32s cubic-bezier(.2,.8,.2,1)} .pg.bk{animation:pgBack .32s cubic-bezier(.2,.8,.2,1)}
    @keyframes pgIn{from{transform:translate3d(36px,0,0);opacity:0}to{transform:none;opacity:1}}
    @keyframes pgBack{from{transform:translate3d(-36px,0,0);opacity:0}to{transform:none;opacity:1}}
    @media (prefers-reduced-motion: reduce){.pg.fw,.pg.bk{animation:none}}
    /* header (sticky under håndtaket) */
    .hh{position:sticky;top:calc(var(--ki-grab-h, 0px) - var(--ki-sh-pt, 0px) - 1px);z-index:5;display:flex;align-items:center;gap:8px;min-height:48px;
      margin:-4px calc(-1 * var(--ki-sh-px, 16px)) 0;padding:2px var(--ki-sh-px, 16px) 8px;background:var(--ki-sheet-bg, var(--ki-popup, #282828))}
    .hh .tt{flex:1;min-width:0;display:flex;flex-direction:column}
    .hh .tt b{font-size:22px;font-weight:600;letter-spacing:-0.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .hh .tt i{font-style:normal;font-size:12px;color:var(--ki-text-mid, #979797);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .hb{flex:none;width:40px;height:40px;border-radius:20px;background:var(--ki-surface, #3a3a3a);display:grid;place-items:center;color:var(--ki-text, #fafafa);transition:transform .15s}
    .hb:active,.bt:active,.hr:active,.ch:active,.fab:active{transform:scale(.96)}
    .hd{flex:none;${M.DONE_PILL}}
    .hd.ghost{background:var(--ki-surface, #3a3a3a);color:var(--ki-text, #fafafa)}
    .hd[disabled]{opacity:.55}
    /* grupper og rader */
    .hs{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:13px;font-weight:500;color:var(--ki-text-mid, #979797);padding:8px 8px 0}
    .hs button{font-size:13px;color:var(--ki-pink-text, var(--pink,#f285c9));font-weight:500}
    .hg{border-radius:24px;background:var(--ki-surface, var(--gray200,#3a3a3a));overflow:hidden;display:flex;flex-direction:column}
    .hr{width:100%;display:flex;align-items:center;gap:12px;min-height:60px;padding:8px 14px;text-align:left;box-sizing:border-box;color:var(--ki-text, #fafafa);transition:background .15s, transform .15s}
    .hr+.hr,.hg>*+.hr,.hr+.blk,.hg>.sub+.hr{border-top:1px solid ${WA(0.06)}}
    button.hr:active{background:${WA(0.04)}}
    .hi{width:40px;height:40px;border-radius:20px;flex:none;display:grid;place-items:center;background:var(--ki-surface-2, var(--gray300,#404040));color:var(--ki-text, #fafafa);transition:background .25s,color .25s}
    .hi.on{background:${ACC};color:var(--ki-on-accent, #2a1720)}
    .ht{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
    .ht b{font-size:15px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .ht i{font-style:normal;font-size:12px;color:var(--ki-text-mid, #979797);display:flex;flex-wrap:wrap;gap:4px 6px;align-items:center;line-height:1.35}
    .hr.off .ht b{color:var(--ki-text-2, #afafaf)}
    .hr.dis{opacity:.55}
    .hr.danger,.hr.danger .hi{color:var(--ki-red-text, var(--red,#f28073))}
    /* bryter */
    .sw{position:relative;width:50px;height:30px;border-radius:15px;flex:none;background:var(--ki-ctrl, var(--gray400,#545454));transition:background .2s}
    .sw.on{background:${ACC}}
    .sw i{position:absolute;top:3px;left:3px;width:24px;height:24px;border-radius:12px;background:var(--ki-knob, #fafafa);transition:left .22s cubic-bezier(.3,1.4,.6,1);box-shadow:0 1px 3px rgba(0,0,0,.25)}
    .sw.on i{left:23px}
    /* knapper / chips */
    .bt{height:40px;padding:0 14px;border-radius:20px;background:var(--ki-surface-2, var(--gray300,#404040));display:inline-flex;align-items:center;justify-content:center;gap:6px;font-size:14px;font-weight:500;white-space:nowrap;transition:transform .15s,background .2s}
    .bt.pri{background:${ACC};color:var(--ki-on-accent, #2a1720)}
    .bt.warn{background:rgba(242,128,115,.16);color:var(--ki-red-text, var(--red,#f28073))}
    .bt.sm{height:34px;padding:0 12px;font-size:13px}
    .bt.ic{width:40px;padding:0}
    .bt.sm.ic{width:34px}
    .bts{display:flex;flex-wrap:wrap;gap:8px}
    .chs{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding:2px 0;margin:0 -2px;touch-action:pan-x pan-y}
    .chs::-webkit-scrollbar{display:none}
    .chs.wrap{flex-wrap:wrap;overflow:visible}
    .ch{flex:none;height:34px;padding:0 13px;border-radius:17px;background:var(--ki-surface, #3a3a3a);display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:500;white-space:nowrap;transition:background .2s,color .2s,transform .15s}
    .ch.on{background:var(--ki-pill-bg, #e1e1e1);color:var(--ki-pill-fg, #232323)}
    .ch .dt{width:8px;height:8px;border-radius:4px;background:var(--lc)}
    .sg{display:flex;gap:4px;padding:4px;border-radius:22px;background:var(--ki-surface-3, #2f2f2f)}
    .sg button{flex:1;height:34px;border-radius:17px;font-size:13px;font-weight:500;color:var(--ki-text-2, #afafaf);transition:background .2s,color .2s;white-space:nowrap;padding:0 8px}
    .sg button.on{background:var(--ki-surface, #3a3a3a);color:var(--ki-text, #fafafa);box-shadow:0 1px 4px rgba(0,0,0,.2)}
    /* etiketter / merker */
    .lb{display:inline-flex;align-items:center;gap:4px;height:20px;padding:0 8px 0 6px;border-radius:10px;font-size:11px;font-weight:500;color:var(--ki-text, #fafafa);background:color-mix(in srgb, var(--lc) 22%, transparent)}
    .lb i{width:7px;height:7px;border-radius:4px;background:var(--lc)}
    .lb ha-icon{color:var(--lc)}
    .bd{min-width:22px;height:22px;padding:0 7px;border-radius:11px;display:inline-grid;place-items:center;font-size:12px;font-weight:600;background:var(--ki-surface-2, #404040);color:var(--ki-text, #fafafa);box-sizing:border-box;flex:none}
    .bd.w{background:${ACC};color:var(--ki-on-accent, #2a1720)}
    .tag{font-size:11px;font-weight:600;padding:2px 7px;border-radius:9px;background:var(--ki-surface-2, #404040);color:var(--ki-text-2, #afafaf)}
    /* felt */
    .fd{display:flex;flex-direction:column;gap:6px;min-width:0}
    .fl{font-size:12px;font-weight:500;color:var(--ki-text-mid, #979797);padding:0 4px}
    .fh{font-size:11px;color:var(--ki-text-3, #7f7f7f);padding:0 4px;line-height:1.4}
    .in{width:100%;box-sizing:border-box;min-height:44px;border-radius:14px;background:var(--ki-surface-2, var(--gray300,#404040));padding:10px 12px;font-size:15px;outline:none;transition:box-shadow .15s;color-scheme:dark}
    :host([data-ki-theme=light]) .in{color-scheme:light}
    .in:focus{box-shadow:0 0 0 2px ${ACC}}
    .in.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;line-height:1.45}
    textarea.in{resize:vertical;min-height:72px;line-height:1.45}
    textarea.in.mono{white-space:pre;overflow:auto;tab-size:2;min-height:88px}
    textarea.in.yaml{min-height:320px}
    .sel{position:relative;display:flex;align-items:center}
    .sel select{appearance:none;-webkit-appearance:none;padding-right:36px;cursor:pointer}
    .sel ha-icon{position:absolute;right:12px;pointer-events:none}
    .frm{display:grid;grid-template-columns:minmax(0,1fr);gap:10px;padding:12px 14px 14px}
    .frm.two{grid-template-columns:repeat(2,minmax(0,1fr))}
    .r2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
    .r3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
    .tr{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:44px;font-size:14px}
    .tr span{flex:1;min-width:0}
    .tr small{display:block;font-size:12px;color:var(--ki-text-mid, #979797)}
    /* søk */
    .sq{display:flex;align-items:center;gap:8px;height:44px;border-radius:22px;background:var(--ki-surface, #3a3a3a);padding:0 14px;color:var(--ki-text-mid, #979797)}
    .sq input{flex:1;min-width:0;height:100%;font-size:15px;color:var(--ki-text, #fafafa);outline:none}
    .sq button{display:grid;place-items:center}
    /* tomt / spinner */
    .em{display:flex;flex-direction:column;align-items:center;gap:10px;padding:34px 20px;text-align:center;color:var(--ki-text-mid, #979797);font-size:14px;line-height:1.45}
    .spn{width:26px;height:26px;border-radius:50%;border:3px solid ${WA(0.15)};border-top-color:${ACC};animation:spn .8s linear infinite}
    .spn.s{width:16px;height:16px;border-width:2px}
    @keyframes spn{to{transform:rotate(360deg)}}
    /* flytende «+»-knapp */
    .fab{position:sticky;bottom:calc(14px + env(safe-area-inset-bottom, 0px));align-self:flex-end;margin-top:-56px;z-index:4;height:52px;padding:0 20px 0 16px;border-radius:26px;background:${ACC};color:var(--ki-on-accent, #2a1720);display:inline-flex;align-items:center;gap:8px;font-size:15px;font-weight:600;box-shadow:0 10px 28px rgba(0,0,0,.35);transition:transform .2s cubic-bezier(.3,1.4,.6,1)}
    /* mappe-overskrift */
    .fo{display:flex;align-items:center;gap:8px;width:100%;padding:12px 8px 4px;font-size:13px;font-weight:600;color:var(--ki-text-2, #afafaf);text-align:left}
    .fo .cv{transition:transform .25s}
    .fo[aria-expanded="false"] .cv{transform:rotate(-90deg)}
    .fo .n{font-weight:500;color:var(--ki-text-3, #7f7f7f)}
    .fo span.g{flex:1}
    /* info-kort */
    .card{border-radius:24px;background:var(--ki-surface, #3a3a3a);padding:16px;display:flex;flex-direction:column;gap:10px}
    .card h3{margin:0;font-size:17px;font-weight:600}
    .card p{margin:0;font-size:13px;line-height:1.5;color:var(--ki-text-2, #afafaf)}
    .kv{display:grid;grid-template-columns:auto minmax(0,1fr);gap:6px 14px;font-size:13px}
    .kv span{color:var(--ki-text-mid, #979797)} .kv b{font-weight:500;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .pre{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:1.45;white-space:pre-wrap;word-break:break-word;background:var(--ki-surface-2, #404040);border-radius:14px;padding:10px 12px;margin:0;max-height:300px;overflow:auto}
    .md{font-size:13px;line-height:1.55;color:var(--ki-text-1, #e1e1e1);overflow-wrap:anywhere}
    .md h1,.md h2,.md h3,.md h4{font-size:15px;margin:12px 0 4px}.md ul{padding-left:18px;margin:4px 0}.md a{color:var(--ki-blue-text, var(--blue,#73b9f2))}
    .md code{font-family:ui-monospace,monospace;font-size:12px;background:var(--ki-surface-2, #404040);padding:1px 5px;border-radius:6px}
    .pb{height:6px;border-radius:3px;background:var(--ki-surface-3, #2f2f2f);overflow:hidden}
    .pb i{display:block;height:100%;background:${ACC};border-radius:3px;transition:width .4s}
    .pb.ind i{width:35%;animation:pbi 1.2s ease-in-out infinite}
    @keyframes pbi{from{transform:translateX(-100%)}to{transform:translateX(300%)}}
    .err{color:var(--ki-red-text, var(--red,#f28073))}
    .ok{color:var(--ki-green-text, var(--green,#8fd18f))}
    .mut{color:var(--ki-text-mid, #979797);font-size:12px}
    /* velgerark inni arket (handlinger, mapper, typer …) */
    .ps{position:absolute;inset:0;z-index:20;display:flex;align-items:flex-end;justify-content:center;pointer-events:none}
    .ps .psb{position:absolute;inset:0;background:rgba(0,0,0,.35);opacity:0;transition:opacity .2s;pointer-events:auto}
    .ps .psc{position:relative;width:100%;max-width:440px;max-height:78%;overflow-y:auto;overscroll-behavior:contain;box-sizing:border-box;border-radius:30px 30px 0 0;background:var(--ki-popup, #282828);
      padding:10px 14px calc(18px + env(safe-area-inset-bottom, 0px));transform:translate3d(0,100%,0);transition:transform .3s cubic-bezier(.2,.8,.2,1);pointer-events:auto;box-shadow:0 -10px 40px rgba(0,0,0,.35);display:flex;flex-direction:column;gap:10px}
    .ps.on .psb{opacity:1} .ps.on .psc{transform:none}
    .ps .pgr{width:40px;height:5px;border-radius:3px;background:${WA(0.25)};margin:0 auto 4px;flex:none}
    .ps h4{margin:0 4px;font-size:18px;font-weight:600}
    .ps .pst{font-size:12px;color:var(--ki-text-mid, #979797);margin:-6px 4px 0}
    .tg{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
    .ty{display:flex;align-items:center;gap:10px;min-height:56px;padding:8px 12px;border-radius:18px;background:var(--ki-surface, #3a3a3a);text-align:left;font-size:13px;font-weight:500;line-height:1.25;transition:transform .15s}
    .ty .hi{width:34px;height:34px}
    .ty:active{transform:scale(.96)}
    @media (max-width:360px){.tg{grid-template-columns:minmax(0,1fr)}}
    /* hub-fliser */
    .tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
    .tile{position:relative;display:flex;flex-direction:column;align-items:flex-start;gap:10px;padding:14px 12px;border-radius:22px;background:var(--ki-surface, #3a3a3a);text-align:left;min-height:96px;box-sizing:border-box;transition:transform .2s cubic-bezier(.3,1.4,.6,1)}
    .tile:active{transform:scale(.95)}
    .tile b{font-size:14px;font-weight:600}.tile i{font-style:normal;font-size:11px;color:var(--ki-text-mid, #979797);margin-top:-6px}
    .tile .bd{position:absolute;top:10px;right:10px}
    .tile .hi{width:38px;height:38px}
    .stg{animation:stg .38s cubic-bezier(.2,.8,.2,1) both}
    @keyframes stg{from{opacity:0;transform:translate3d(0,8px,0)}to{opacity:1;transform:none}}
    @media (prefers-reduced-motion: reduce){.stg{animation:none}}
  `;

  /* ------------------------------------------------------------ kontrolleren (ett åpent ark) */
  let cur = null;
  class Ctl {
    constructor(page, args) {
      this.stack = [{ id: page || 'hub', args: args || {}, st: {} }];
      this.dir = 'fw';
      this.ov = M.overlay({ html: '<div class="pgw" data-pgw></div><div class="ps" data-ps></div>', css: CSS, tilpass: true, maxWidth: 600, guard: 300, onClose: () => this._closed() });
      this.ov.host.setAttribute('data-ha-cfg', '');
      this.root = this.ov.root;
      this.wrap = this.root.querySelector('[data-pgw]');
      this.psEl = this.root.querySelector('[data-ps]');
      this.root.appendChild(this.psEl); // utenfor arkets scroll-flate (.sh har transform og scroller) – dekker hele arket
      this.root.addEventListener('click', (e) => this._click(e));
      this.root.addEventListener('input', (e) => this._input(e, false));
      this.root.addEventListener('change', (e) => this._input(e, true));
      this.root.addEventListener('value-changed', (e) => this._input(e, true));
      this.root.addEventListener('keydown', (e) => { if (e.key === 'Tab' && e.target && e.target.localName === 'textarea') { e.preventDefault(); const t = e.target, s = t.selectionStart; t.setRangeText('  ', s, t.selectionEnd, 'end'); t.dispatchEvent(new Event('input', { bubbles: true })); } });
      this._hv = null;
      this._iv = setInterval(() => this._hassTick(), 1000); // fersk hass mens arket er åpent (ingen polling av HA – bare lokal sammenligning)
      this.ctx = this._mkCtx();
      this.show();
    }
    get top() { return this.stack[this.stack.length - 1]; }
    get h() { return hassNow(); }
    _mkCtx() {
      const self = this;
      return {
        get h() { return self.h; },
        get state() { return self.top.st; },
        get args() { return self.top.args; },
        reg, ui, T, esc, ver: () => verOf(self.h),
        ws: (type, data) => { const h = self.h; if (!h) return Promise.reject(new Error('Ingen forbindelse')); return h.callWS({ type, ...(data || {}) }); },
        api: (method, path, body) => { const h = self.h; if (!h) return Promise.reject(new Error('Ingen forbindelse')); return h.callApi(method, path, body); },
        call: (d, s, data) => { const h = self.h; return h ? h.callService(d, s, data || {}) : Promise.reject(new Error('Ingen forbindelse')); },
        push: (id, args) => self.push(id, args),
        pop: () => self.pop(),
        replace: (id, args) => self.replace(id, args),
        render: () => self.render(),
        close: () => self.ov.close(),
        toast: (t, o) => M.toast(t, o),
        err: (e, pre) => { M.haptic('failure'); M.toast((pre ? pre + ': ' : '') + errText(e), { type: 'error' }); },
        errText,
        // to trykk for farlige handlinger: første trykk viser «Sikker?» i 3,5 s
        confirm(key) {
          const st = self.top.st;
          if (st.__cf === key) { st.__cf = null; clearTimeout(self._cft); return true; }
          st.__cf = key; M.haptic('warning'); clearTimeout(self._cft);
          self._cft = setTimeout(() => { if (st.__cf === key) { st.__cf = null; self.render(); } }, 3500);
          self.render();
          return false;
        },
        armed: (key) => self.top.st.__cf === key,
        // kjør et løfte med «opptatt»-markering på en nøkkel (knapper viser spinner)
        async busy(key, p) {
          const st = self.top.st; st.__busy = { ...(st.__busy || {}), [key]: true }; self.render();
          try { return await p; } finally { const b = { ...(st.__busy || {}) }; delete b[key]; st.__busy = b; self.render(); }
        },
        isBusy: (key) => !!(self.top.st.__busy && self.top.st.__busy[key]),
        sheet: (o) => self.sheet(o),
        closeSheet: () => self.closeSheet(),
        nav: (path) => { self.ov.close(); setTimeout(() => M.navigate(path), 60); },
        hassPath: (p) => p,
      };
    }
    show() { this._load(); this.render(); }
    async _load() {
      const t = this.top, P = PAGES[t.id];
      if (!P || !P.load || t.loaded) return;
      t.loaded = true;
      try { await P.load(this.ctx, t.args); } catch (e) { t.st.__err = errText(e); }
      if (this.top === t) this.render();
    }
    push(id, args) {
      if (!PAGES[id]) return;
      M.haptic('light');
      this._saveScroll();
      this.stack.push({ id, args: args || {}, st: {} });
      this.dir = 'fw'; this.closeSheet(true);
      this.show(); this._scrollTo(0);
    }
    replace(id, args) { this.stack[this.stack.length - 1] = { id, args: args || {}, st: {} }; this.dir = 'fw'; this.show(); }
    pop() {
      const P = PAGES[this.top.id];
      if (P && P.back && P.back(this.ctx, this.top.args) === false) return;
      if (this.stack.length <= 1) { this.ov.close(); return; }
      M.haptic('light');
      this.stack.pop();
      this.dir = 'bk'; this.closeSheet(true);
      const t = this.top;
      if (PAGES[t.id] && PAGES[t.id].reload) { t.loaded = false; this._load(); }
      this.render();
      this._scrollTo(t.scroll || 0);
    }
    _sc() { return this.root.querySelector('.sh'); }
    _saveScroll() { const s = this._sc(); if (s) this.top.scroll = s.scrollTop; }
    _scrollTo(y) { const s = this._sc(); if (s) requestAnimationFrame(() => { s.scrollTop = y; }); }
    _hassTick() {
      const h = this.h;
      if (!h || this.ov.closed) return;
      if (this._hv === h.states) return;
      this._hv = h.states;
      const P = PAGES[this.top.id];
      if (P && P.live !== false && !this._typing()) this.render();
    }
    _typing() { const a = this.root.activeElement; return !!(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)); }
    render() {
      if (this.ov.closed) return;
      const t = this.top, P = PAGES[t.id];
      if (!P) return;
      const c = this.ctx, depth = this.stack.length;
      let title = '', sub = '', body = '', right = '';
      try {
        title = typeof P.title === 'function' ? P.title(c, t.args) : P.title || '';
        sub = P.sub ? P.sub(c, t.args) || '' : '';
        right = P.right ? P.right(c, t.args) || '' : '';
        body = t.st.__err && !P.ownErr ? ui.empty('mdi:alert-circle-outline', t.st.__err, `<div class="bts">${ui.btn(T('Prøv igjen', 'Try again'), 'retry', null, 'sm')}${P.haPath ? ui.btn(T('Åpne i Home Assistant', 'Open in Home Assistant'), 'haopen', null, 'sm', 'mdi:open-in-new') : ''}</div>`) : P.render(c, t.args);
      } catch (e) { console.error('[ki-msh] ha', t.id, e); body = ui.empty('mdi:alert-circle-outline', errText(e)); }
      const back = depth > 1 ? `<button class="hb" data-a="back" aria-label="${esc(T('Tilbake', 'Back'))}">${ui.ic('mdi:chevron-left', 26)}</button>` : `<button class="hb" data-a="close" aria-label="${esc(T('Lukk', 'Close'))}">${ui.ic('mdi:close', 22)}</button>`;
      const key = `pg-${depth}-${t.id}`;
      const html = `<div class="pg" data-key="${esc(key)}"><div class="hh">${back}<span class="tt"><b ${P.userTitle ? 'data-noi18n' : ''}>${esc(title)}</b>${sub ? `<i>${esc(sub)}</i>` : ''}</span>${right}</div>${body}</div>`;
      const old = this.wrap.firstElementChild;
      const fresh = !old || old.getAttribute('data-key') !== key;
      M.morph(this.wrap, html);
      const pg = this.wrap.firstElementChild;
      if (fresh && pg) { pg.classList.remove('fw', 'bk'); void pg.offsetWidth; pg.classList.add(this.dir); }
      const h = this.h;
      this.root.querySelectorAll('msh-entity-picker, msh-entity-multi, msh-icon-field').forEach((e) => { if (h && e.hass !== h) e.hass = h; });
      if (P.after) try { P.after(c, t.args, this.root); } catch (e) { /* */ }
    }
    /* ---------- velgerark: { title, sub, html, onAct(a, el) → true lukker } */
    sheet(o) {
      this._sheetO = o;
      const ps = this.psEl;
      ps.innerHTML = `<div class="psb" data-a="__psx"></div><div class="psc"><div class="pgr"></div>${o.title ? `<h4>${esc(o.title)}</h4>` : ''}${o.sub ? `<div class="pst">${esc(o.sub)}</div>` : ''}<div class="psi">${o.html || ''}</div></div>`;
      const h = this.h; ps.querySelectorAll('msh-entity-picker, msh-entity-multi, msh-icon-field').forEach((e) => { e.hass = h; });
      requestAnimationFrame(() => ps.classList.add('on'));
      ['pointerdown', 'touchstart', 'touchmove', 'wheel'].forEach((ty) => ps.addEventListener(ty, (e) => e.stopPropagation(), { passive: true }));
    }
    sheetHtml(html) { const i = this.psEl.querySelector('.psi'); if (i) M.morph(i, html); }
    closeSheet(now) {
      const ps = this.psEl; if (!ps || !this._sheetO) return;
      const o = this._sheetO; this._sheetO = null;
      ps.classList.remove('on');
      if (now) ps.innerHTML = ''; else setTimeout(() => { if (!this._sheetO) ps.innerHTML = ''; }, 300);
      if (o.onClose) o.onClose();
    }
    _click(e) {
      const el = e.target.closest && e.target.closest('[data-a]');
      if (!el || el.disabled) return;
      const a = el.dataset.a;
      if (a === '__psx') { M.haptic('light'); return this.closeSheet(); }
      if (this._sheetO && this.psEl.contains(el)) {
        const r = this._sheetO.onAct && this._sheetO.onAct(a, el, e);
        if (r === true) this.closeSheet();
        return;
      }
      if (a === 'back') return this.pop();
      if (a === 'close') { M.haptic('light'); return this.ov.close(); }
      if (a === 'retry') { this.top.st.__err = null; this.top.loaded = false; this._load(); return this.render(); }
      if (a === 'haopen') { const P = PAGES[this.top.id]; return this.ctx.nav(typeof P.haPath === 'function' ? P.haPath(this.ctx, this.top.args) : P.haPath); }
      if (a === 'go') { const [id, arg] = String(el.dataset.v || '').split('|'); return this.push(id, arg ? { kind: arg } : {}); }
      if (a === 'ext') { M.haptic('light'); return this.ctx.nav(el.dataset.v); }
      const P = PAGES[this.top.id];
      if (P && P.act) { const r = P.act(this.ctx, a, el, this.top.args, e); if (r && r.then) r.catch((x) => this.ctx.err(x)); }
    }
    _input(e, commit) {
      const path = e.composedPath ? e.composedPath() : [e.target];
      const el = path.find((x) => x && x.dataset && x.dataset.f != null);
      if (!el) return;
      if (e.type === 'value-changed') e.stopPropagation();
      const val = e.type === 'value-changed' ? e.detail.value : el.type === 'checkbox' ? el.checked : el.value;
      if (this._sheetO && this.psEl.contains(el)) { if (this._sheetO.onInput) this._sheetO.onInput(el, val, commit); return; }
      const P = PAGES[this.top.id];
      if (P && P.input) P.input(this.ctx, el, val, commit, this.top.args);
    }
    _closed() {
      clearInterval(this._iv);
      if (cur === this) cur = null;
    }
  }

  M.ha = {
    reg, ui, LABEL_COLORS, labelColor, verOf, errText,
    page(id, def) { PAGES[id] = def; },
    pages: PAGES,
    open(page, args) {
      if (cur && !cur.ov.closed) { if (page && PAGES[page]) cur.push(page, args); return cur; }
      const h = hassNow();
      if (h && h.user && h.user.is_admin === false) { M.toast(T('Bare administratorer kan endre Home Assistant-innstillinger', 'Only administrators can change Home Assistant settings'), { type: 'error' }); return null; }
      reg.load(h, true).then(() => { if (cur) cur.render(); });
      cur = new Ctl(page && PAGES[page] ? page : 'hub', args);
      if (page && page !== 'hub' && PAGES[page]) { cur.stack.unshift({ id: 'hub', args: {}, st: {} }); }
      return cur;
    },
    get current() { return cur; },
  };
  window.addEventListener('ki-open-ha', (e) => { const d = (e && e.detail) || {}; M.ha.open(d.page, d.args); });
})();
