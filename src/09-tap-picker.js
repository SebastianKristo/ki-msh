/* KI MSH · trykk-handling i HA-format (Fiks 15.6) – Fiks 30.3: felles handlingsvelger etter Handlingsvelger.dc.html.
 * Config (HA-standard, samme verdi fungerer i GUI-editoren):
 *   { action: 'navigate', navigation_path: '#vanning' }   popup (fra listen) eller egen hash
 *   { action: 'navigate', navigation_path: '/dashboard-hjem/kart' }   sti (visning i et dashbord)
 *   { action: 'url', url_path: 'https://…', new_tab: false? }   ·   { action: 'more-info', entity? }   ·   { action: 'none' }
 *   { action: 'lock-sheet' }   (KI-intern, prosa: hurtigarket for dørlåsen – tidligere link: 'lock')
 * Bakoverkompatibelt: strenger ('#x' / '/sti' / 'https://…' / 'none') og Søppel-formatet { action: 'popup', hash } leses.
 *
 * API (window.MSH.tap):
 *   norm(t)            → gyldig tap-objekt eller null
 *   hashOf(t)          → '#x' når handlingen åpner en popup, ellers ''
 *   run(el, t, { entity }) → utfør (navigate/url/more-info/toggle/tjeneste). Returnerer true når noe ble gjort.
 *   popupOf(hash, hass) → popup-oppføringen (MSH.popupPicker.list, også aliaser som #nibe → #varmepumpe) eller null
 *   label(t, hass)     → kort tekst («Popup · Tesla», «#tesla», «/lovelace/x», «URL», …)
 *   views(hass)        → Promise<[[sti, navn, ikon]]> – dashbordets visninger (lovelace/config) + andre dashbord (hass.panels)
 *   html({ value, modes, labels, key, attrs, style: 'ruter'|'liste', stdHint, noneHint, gui, entity }) → '<msh-tap-picker …>'
 *
 * <msh-tap-picker value='{"action":…}' modes="popup,hash,path,url,more,none" action-style="ruter|liste">
 *   Fiks 30.3 (fasit Handlingsvelger.dc.html): standardstil «ruter» = rutenett med like store ruter (76 px, r20, #232323;
 *   valgt #404040 + inset 1.5 px rosa, fylt rosa ikon), 3 kolonner (aldri én rute alene på en linje – 4/2 kolonner når
 *   antallet ellers gir det), forklaring under (12 px #7f7f7f). Stil «liste» (action_style: liste) = radioliste med
 *   ikon-sirkel, navn, undertekst og hake. Under velgeren: feltet for valgt handling (fade 200 ms) og «Test · åpne …»
 *   (konturknapp 44 px, ikke for Ingen). Ekstra moduser der kortet trenger dem: std (Standard = tom verdi), toggle,
 *   service ({ action: 'perform-action', perform_action, data }), lock. Hendelse: value-changed { value: tap | null }.
 *   Haptic: selection ved bytte, light når popup-velgeren åpnes/velges, medium ved Test.
 *
 * MSH.popupPicker – ÉTT felles popup-velger-ark (Fiks 30.2) for navbar, Tilpass Hjem (Kort/Tekst), Søppel og GUI-editorene:
 *   open({ value, onPick(hash), onCustom(), title, hass, from }) → Promise<'#hash' | '' | null> (null = avbrutt)
 *     Ark over arket under (portalet, topp 50 px, radius 38 38 0 0, #282828), flex-kolonne: tittel/antall/søk/filter står
 *     fast; listen er en vanlig BLOKK (.sc: flex 1, min-height 0, overflow-y auto, overscroll contain, pan-y) med ÉN indre
 *     flex-wrapper (.scw) uten høydegrense – da presses aldri gruppeboksene sammen, og siste rad + «Bruk egen hash» nås.
 *     Grupper Rom · Funksjoner · Importert med antall, filter Alle/Rom/Funksjoner/Importert, søk i navn, #hash og aliaser.
 *     «Bruk egen hash» → onCustom() (handlingsvelgeren bytter til Egen hash), ellers et felt i arket.
 *     stopPropagation på touch/pointer i listen; arket under er låst (overflow hidden) mens velgeren er åpen.
 *   html({ name, value, placeholder, key, label, attrs }) → '<msh-popup-field …>' (ikon-sirkel, navn, #hash, «Bytt ›»).
 *   selector(hass) → ha-selector select { options, custom_value } (reserve).  list(hass) · norm(h)
 */
(function () {
  const M = window.MSH;
  if (!M || M.tap) return;
  const esc = M.esc;
  const PK = 'rgb(242 133 201)', GRAD = 'linear-gradient(145deg, rgb(242 133 201) -10%, rgb(245 205 198) 100%)';
  // [etikett, ikon av, ikon på, undertekst]
  const MODES = { std: 'Standard', toggle: 'Veksle', popup: 'Popup', hash: 'Egen hash', path: 'Sti', url: 'URL', more: 'More-info', service: 'Tjeneste', lock: 'Dørlås', none: 'Ingen' };
  const MICON = {
    popup: ['mdi:application-outline', 'mdi:application'], hash: ['mdi:pound', 'mdi:pound'], path: ['mdi:sign-direction', 'mdi:sign-direction'],
    url: ['mdi:link-variant', 'mdi:link-variant'], more: ['mdi:information-outline', 'mdi:information'], none: ['mdi:cancel', 'mdi:cancel'],
    std: ['mdi:star-circle-outline', 'mdi:star-circle'], toggle: ['mdi:toggle-switch-off-outline', 'mdi:toggle-switch'], service: ['mdi:play-circle-outline', 'mdi:play-circle'], lock: ['mdi:lock-outline', 'mdi:lock'],
  };
  const MSUB = { popup: 'Åpner en popup i dashbordet', hash: 'Skriv en #hash selv', path: 'Går til en annen visning', url: 'Åpner en nettside', more: 'Viser entitetens dialog', none: 'Ingen handling', std: 'Kortets standard', toggle: 'Veksler entiteten', service: 'Kaller en tjeneste', lock: 'Åpner hurtigarket for dørlåsen' };
  const DESIGN = ['popup', 'hash', 'path', 'url', 'more', 'none']; // fasitens seks – faste etiketter (Sti, ikke «Navigate»)
  // Kolonner i rutenettet: 3, men aldri én rute alene på siste linje
  const colsFor = (n) => (n <= 3 ? Math.max(1, n) : n % 3 !== 1 ? 3 : n % 4 !== 1 ? 4 : 2);

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
    if (a === 'popup') { const h = normHash(t.hash); return h ? { action: 'navigate', navigation_path: h } : null; } // Søppel 20.2-formatet
    if (a === 'url') { const u = String(t.url_path || '').trim(); return u ? { ...t, url_path: u } : null; }
    if (a === 'more-info' || a === 'none' || a === 'lock-sheet' || a === 'toggle' || a === 'call-service' || a === 'perform-action') return { ...t };
    return null;
  }
  const hashOf = (t) => { t = norm(t); const p = t && t.action === 'navigate' ? t.navigation_path : ''; return p && p[0] === '#' ? p : ''; };
  const canon = (h) => (M.canonHash ? M.canonHash(h) : h);
  const popupOf = (hash, hass) => { if (!hash) return null; try { const L = popupList(hass), c = canon(hash); return L.find((p) => p.hash === hash) || L.find((p) => p.hash === c) || null; } catch (e) { return null; } };
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
    if (t.action === 'lock-sheet' && M.lockSheet) { try { M.lockSheet(el, o.entity); return true; } catch (e) { return false; } }
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

  /* ------------------------------------------------------------ popup-listen (strategiens liste + dashbordets egne) */
  const PGROUPS = { rom: 'Rom', fn: 'Funksjoner', imp: 'Importert' };
  const fold = (s) => String(s || '').toLowerCase().replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'a');
  const normHash = (s) => { const r = String(s == null ? '' : s).trim(); return r ? '#' + r.replace(/^#+/, '').replace(/\s+/g, '-') : ''; };
  // Fiks 26.9: alle Bubble pop-up-hasher i dashbordet – også manuelle popups utenfor strategien (lovelace-configen)
  const dashPopups = () => {
    const out = [];
    try {
      const ha = document.querySelector('home-assistant'), panel = ha && M.deep && M.deep(ha.shadowRoot, 'ha-panel-lovelace');
      const cfg = panel && panel.lovelace && panel.lovelace.config;
      const walk = (c, d) => {
        if (!c || typeof c !== 'object' || d > 12) return;
        if (Array.isArray(c)) { c.forEach((x) => walk(x, d + 1)); return; }
        if (c.type === 'custom:bubble-card' && c.card_type === 'pop-up' && c.hash) out.push({ hash: normHash(c.hash), name: c.name || normHash(c.hash), icon: c.icon, group: 'imp', source: 'dash' });
        ['views', 'cards', 'sections', 'card', 'elements'].forEach((k) => { if (c[k]) walk(c[k], d + 1); });
      };
      walk(cfg, 0);
    } catch (e) { /* ingen lovelace (GUI-editor utenfor dashbordet) */ }
    return out;
  };
  // [{ hash, name, icon, group: rom|fn|imp, color, aliases, hidden }] – alle popups, ingen maks-antall
  const popupList = (hass) => {
    const h = hass || M.lastHass;
    let L = [];
    try { L = M.allPopups ? M.allPopups(h, { hidden: true }) : []; } catch (e) { L = []; }
    const seen = new Set(L.map((p) => p.hash));
    dashPopups().forEach((p) => { if (!seen.has(p.hash)) { seen.add(p.hash); L.push(p); } });
    return L.map((p) => {
      const group = p.group === 'rom' || p.group === 'fn' ? p.group : 'imp'; // egne/importerte/ukjente → Importert
      let color = p.color || null;
      if (!color && group === 'rom' && M.romColor) { try { color = M.romColor(String(p.hash).slice(1), h); } catch (e) { color = null; } }
      const aliases = M.hashAliasesOf ? M.hashAliasesOf(p.hash) : [];
      return { ...p, group, color: group === 'rom' ? color : null, aliases };
    });
  };
  const MISSING = 'Popupen finnes ikke i dette dashbordet';

  /* ------------------------------------------------------------ Fiks 30.2 · popup-velger-arket */
  const PSHEET_CSS = `
    *{box-sizing:border-box}
    button,input{font:inherit;color:inherit;border:0;background:none;padding:0;margin:0;cursor:pointer;-webkit-tap-highlight-color:transparent}
    input{cursor:text;outline:none;-webkit-user-select:text;user-select:text}
    /* arket: flex-kolonne, ingen egen scroll – bare .sc scroller */
    .sh.tp{display:flex;flex-direction:column;overflow:hidden;padding:0;border-radius:38px 38px 0 0;box-shadow:0 -20px 50px rgb(0 0 0/max(var(--ki-ka-min,0),calc(0.5*var(--ki-ka-k,1))))}
    :host(:not([data-glass])) .sh.tp{background:var(--ki-popup, #282828)}
    .sh.tp>.gz{position:relative;top:auto;flex:none;height:auto;margin:0;padding:8px 0 0;background:none;-webkit-backdrop-filter:none;backdrop-filter:none}
    .sh.tp>.gz .grab{width:36px;height:5px;border-radius:3px;background:var(--ki-ctrl, #545454)}
    .sh.tp>.body{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;overflow:hidden}
    .body>*{flex:none}
    .hd{display:flex;align-items:center;gap:8px;padding:10px 18px 12px}
    .hd .tt{flex:1;min-width:0;display:flex;flex-direction:column}
    .hd .tt b{font-size:22px;font-weight:600;color:var(--ki-text, #fafafa);line-height:1.25}
    .hd .tt i{font-style:normal;font-size:12px;color:var(--ki-text-mid, #979797)}
    .hd .x{width:40px;height:40px;border-radius:20px;display:grid;place-items:center;background:var(--ki-surface, #3a3a3a);color:var(--ki-text, #fafafa);flex:none}
    .top{display:flex;flex-direction:column;gap:10px;padding:0 14px 10px}
    .sr{display:flex;align-items:center;gap:10px;height:46px;padding:0 8px 0 16px;border-radius:23px;background:var(--ki-surface, #3a3a3a);color:var(--ki-text, #fafafa)}
    .sr input{flex:1;min-width:0;height:100%;font-size:15px;color:var(--ki-text, #fafafa)}
    .sr input::placeholder,.own input::placeholder{color:var(--ki-text-3, #7f7f7f)}
    .sr .qx{width:32px;height:32px;border-radius:16px;display:grid;place-items:center;color:var(--ki-text-mid, #979797)}
    .sr .qx[hidden]{display:none}
    .flt{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:2px;padding:4px;border-radius:22px;background:var(--ki-surface, #3a3a3a);touch-action:pan-y}
    .flt button{height:36px;border-radius:18px;font-size:13px;font-weight:500;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 4px;color:#c7c7c7;transition:background .2s}
    .flt button.on{background:${GRAD};color:var(--ki-on-accent, #2f2f2f)}
    /* 30.2 · scrollområdet er en vanlig BLOKK (ikke flex/grid) med ÉN indre flex-wrapper uten høydegrense */
    .body>.sc{display:block;flex:1 1 0;min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y;scrollbar-width:none;padding:0 14px calc(40px + env(safe-area-inset-bottom, 0px))}
    .sc::-webkit-scrollbar{display:none}
    .scw{display:flex;flex-direction:column;gap:8px}
    .grs{display:contents}
    .lb{font-size:12px;font-weight:500;letter-spacing:.08em;text-transform:uppercase;color:var(--ki-text-3, #7f7f7f);padding:8px 6px 0}
    .gb{display:flex;flex-direction:column;border-radius:22px;background:var(--ki-surface, #3a3a3a);overflow:hidden}
    .pr{flex:none;display:flex;align-items:center;gap:12px;min-height:60px;padding:8px 14px 8px 10px;text-align:left;width:100%;color:var(--ki-text, #fafafa)}
    .pr+.pr{border-top:1px solid rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.06*var(--ki-wa-k,1)),var(--ki-wa-max,1)))}
    .pr.on{background:var(--ki-surface-2, #404040)}
    .pr:active{background:rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.06*var(--ki-wa-k,1)),var(--ki-wa-max,1)))}
    .pr .ci{width:40px;height:40px;border-radius:20px;flex:none;display:grid;place-items:center;background:var(--ki-surface-3, #2f2f2f);color:var(--ki-text-1, #e1e1e1)}
    .pr .nm{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
    .pr .nm b{font-weight:500;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .pr .h{font-size:12px;color:var(--ki-text-mid, #979797);font-family:ui-monospace,Menlo,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .pr .ck{opacity:0;color:${PK};flex:none}
    .pr.on .ck{opacity:1}
    .none{padding:20px 6px;font-size:14px;color:var(--ki-text-mid, #979797);text-align:center}
    .cust{display:flex;align-items:center;gap:12px;min-height:56px;padding:8px 14px;border-radius:22px;box-shadow:inset 0 0 0 1.5px rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.14*var(--ki-wa-k,1)),var(--ki-wa-max,1)));margin-top:4px;text-align:left;width:100%;color:var(--ki-text, #fafafa)}
    .cust .nm{flex:1;display:flex;flex-direction:column}
    .cust .nm b{font-size:14px;font-weight:500}
    .cust .nm i{font-style:normal;font-size:12px;color:var(--ki-text-mid, #979797)}
    .own{display:flex;flex-direction:column;gap:8px}
    .own[hidden]{display:none}
    .own .ln{display:flex;gap:8px;align-items:center}
    .own .hf{flex:1;min-width:0;display:flex;align-items:center;height:48px;border-radius:16px;background:var(--ki-surface, #3a3a3a);padding:0 14px;gap:2px}
    .own .hf span{font:15px ui-monospace,Menlo,monospace;color:var(--ki-text-3, #7f7f7f)}
    .own input{flex:1;min-width:0;height:100%;color:var(--ki-text, #fafafa);font:15px ui-monospace,Menlo,monospace}
    .own .ok{height:48px;padding:0 18px;border-radius:24px;background:${GRAD};color:var(--ki-on-accent, #2f2f2f);font-weight:600;font-size:14px;flex:none}
    .wr{display:flex;align-items:center;gap:6px;font-size:12px;color:#f2c073;padding:0 2px;min-height:16px}
    .wr.okc{color:#66d19e}
    :host([data-glass]) .sr,:host([data-glass]) .flt,:host([data-glass]) .gb,:host([data-glass]) .hd .x,:host([data-glass]) .own .hf{background:rgb(0 0 0/max(var(--ki-ka-min,0),calc(0.25*var(--ki-ka-k,1))))}
  `;
  // Åpent modalt <dialog> (HAs GUI-editor i top-layer) rundt elementet → arket legges inni dialogen, ellers er det inert
  const modalOf = (el) => {
    let n = el;
    for (let d = 0; n && d < 40; d++) {
      if (n.localName === 'dialog' && n.open) { try { if (n.matches(':modal')) return n; } catch (e) { return n; } }
      n = n.parentNode || (n.host || null);
      if (n && n.nodeType === 11) n = n.host || null;
    }
    return null;
  };
  // Åpner arket. o: { value, onPick(hash), onCustom(), title, hass, from } → Promise<'#hash' | '' (tømt) | null (avbrutt)>
  function openPopupPicker(o = {}) {
    const hass = o.hass || M.lastHass, cur = normHash(o.value), all = popupList(hass);
    const curC = canon(cur), known = (h) => !!h && all.some((p) => p.hash === h || p.hash === canon(h));
    const nameOf = (h) => { const p = all.find((x) => x.hash === h || x.hash === canon(h)); return p ? p.name : ''; };
    const S = M.overlay({ css: PSHEET_CSS, maxWidth: 540, tilpass: true, html: `
      <div class="hd" data-sheet-head><span class="tt"><b>${esc(o.title || 'Velg popup')}</b><i>${all.length} popups i dashbordet</i></span><button class="x" data-p="close" title="Lukk" aria-label="Lukk">${M.icon('mdi:close', 22)}</button></div>
      <div class="top">
        <div class="sr">${M.icon('mdi:magnify', 20, 'color:var(--ki-text-mid, #979797)')}<input class="q" placeholder="Søk navn eller #hash" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="search"><button class="qx" data-p="qx" title="Tøm" hidden>${M.icon('mdi:close-circle', 18)}</button></div>
        <div class="flt" role="tablist" data-glass-drag="x">${[['alle', 'Alle'], ['rom', 'Rom'], ['fn', 'Funksjoner'], ['imp', 'Importert']].map(([k, l]) => `<button class="${k === 'alle' ? 'on' : ''}" data-p="f" data-v="${k}" role="tab" aria-selected="${k === 'alle'}">${l}</button>`).join('')}</div>
      </div>
      <div class="sc"><div class="scw"><div class="grs"></div>
        <button class="cust" data-p="custom">${M.icon('mdi:pound', 20, 'color:var(--ki-text-2, #afafaf)')}<span class="nm"><b>Bruk egen hash</b><i>For popups som ikke finnes ennå</i></span>${M.icon('mdi:chevron-right', 20, 'color:var(--ki-text-mid, #979797)')}</button>
        <div class="own" ${cur && !known(cur) ? '' : 'hidden'}><div class="ln"><div class="hf"><span>#</span><input class="oh" placeholder="tesla" value="${esc(cur && !known(cur) ? cur.slice(1) : '')}" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done"></div><button class="ok" data-p="own">Bruk</button></div><div class="wr">${cur && !known(cur) ? M.icon('mdi:alert', 16) + MISSING + ' – lagres likevel' : ''}</div></div>
      </div></div>` });
    const R = S.root, qi = R.querySelector('.q'), sc = R.querySelector('.sc'), grs = R.querySelector('.grs'), oh = R.querySelector('.oh'), wr = R.querySelector('.wr'), own = R.querySelector('.own'), qx = R.querySelector('.qx');
    // HAs GUI-editor i en modal <dialog>: flytt arket inn i dialogen (top-layer), ellers kan det ikke trykkes på
    const dlg = o.from ? modalOf(o.from) : null;
    if (dlg) { try { dlg.appendChild(S.host); } catch (e) { /* */ } }
    const cb = o.onPick || o.onChange || o.onSelect;
    let picked = null, resolveP, filt = 'alle';
    const P = new Promise((r) => { resolveP = r; });
    // Lås arket under (og eventuelle andre ark) mens velgeren er åpen
    const locked = M.portals().filter((h) => h !== S.host).map((h) => h.shadowRoot && h.shadowRoot.querySelector('.sh')).filter(Boolean).map((sh) => { const v = sh.style.overflowY; sh.style.overflowY = 'hidden'; return [sh, v]; });
    S.onClosed = () => { locked.forEach(([sh, v]) => { sh.style.overflowY = v; }); resolveP(picked); };
    const done = (v) => { M.haptic('light'); picked = v || ''; S.close(); if (cb) cb(picked); };
    const draw = () => {
      const qs = qi.value.trim(), q = fold(qs);
      qx.hidden = !qs;
      const hits = all.filter((p) => (filt === 'alle' || p.group === filt) && (!q || fold(`${p.name} ${p.hash} ${(p.aliases || []).join(' ')}`).includes(q)));
      const row = (p) => {
        const on = p.hash === cur || p.hash === curC, col = p.color;
        return `<button class="pr ${on ? 'on' : ''}" data-v="${esc(p.hash)}" aria-pressed="${on}"><span class="ci" ${col ? `style="background:${esc(col)};color:var(--ki-on-accent, #2f2f2f)"` : ''}>${M.icon(p.icon || 'mdi:card-outline', 20)}</span><span class="nm"><b>${esc(p.name)}</b><span class="h">${esc(p.hash)}${p.hidden ? ' · skjult' : ''}</span></span><span class="ck">${M.icon('mdi:check-circle', 22)}</span></button>`;
      };
      grs.innerHTML = Object.keys(PGROUPS).map((g) => { const L = hits.filter((p) => p.group === g); return L.length ? `<span class="lb" data-g="${g}">${PGROUPS[g]} · ${L.length}</span><div class="gb">${L.map(row).join('')}</div>` : ''; }).join('')
        || `<span class="none">${qs ? `Ingen popup heter «${esc(qs)}»` : 'Ingen popups i dette dashbordet'}</span>`;
    };
    const ownMsg = () => {
      const h = normHash(oh.value);
      wr.classList.toggle('okc', !!h && known(h));
      wr.innerHTML = !h ? '' : known(h) ? M.icon('mdi:check', 16) + 'Åpner ' + esc(nameOf(h)) : M.icon('mdi:alert', 16) + MISSING + ' – lagres likevel';
    };
    qi.addEventListener('input', draw);
    // 30.2 · listen eier gesten: Bubble Card/arket under lukkes eller scrolles ikke (aldri preventDefault – scroll virker)
    ['touchstart', 'touchmove', 'pointerdown', 'wheel'].forEach((t) => sc.addEventListener(t, (e) => e.stopPropagation(), { passive: true }));
    oh.addEventListener('input', ownMsg);
    R.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); M.haptic('light'); S.close(); return; }
      if (e.key !== 'Enter') return;
      e.preventDefault(); e.stopPropagation();
      if (e.target === oh) { const h = normHash(oh.value); if (h) done(h); return; }
      const f = grs.querySelector('[data-v]'); if (f) done(f.dataset.v);
    });
    R.addEventListener('click', (e) => {
      const b = e.composedPath().find((n) => n.dataset && (n.dataset.v != null || n.dataset.p));
      if (!b) return;
      const p = b.dataset.p;
      if (!p) return done(b.dataset.v);
      if (p === 'close') { M.haptic('light'); return S.close(); }
      if (p === 'qx') { qi.value = ''; M.haptic('selection'); draw(); qi.focus(); return; }
      if (p === 'f') { if (filt === b.dataset.v) return; filt = b.dataset.v; M.haptic('selection'); R.querySelectorAll('.flt button').forEach((x) => { const on = x.dataset.v === filt; x.classList.toggle('on', on); x.setAttribute('aria-selected', on); }); draw(); sc.scrollTop = 0; return; }
      if (p === 'custom') {
        M.haptic('light');
        if (o.onCustom) { picked = null; S.close(); o.onCustom(); return; }
        own.hidden = !own.hidden;
        if (!own.hidden) { ownMsg(); requestAnimationFrame(() => { sc.scrollTop = sc.scrollHeight; try { oh.focus({ preventScroll: true }); } catch (x) { oh.focus(); } }); }
        return;
      }
      if (p === 'own') { const h = normHash(oh.value); if (h) done(h); else oh.focus(); }
    });
    if (M.glassDrag) { try { M.glassDrag(R.querySelector('.flt'), { axis: 'x' }); } catch (e) { /* */ } }
    draw();
    // Valgt rad scrolles inn ved åpning (scrollTop, ikke scrollIntoView – det scroller arket/siden også)
    const toSel = () => { const on = grs.querySelector('.pr.on'); if (!on || !sc.clientHeight) return; const r = on.getBoundingClientRect(), b = sc.getBoundingClientRect(); sc.scrollTop += r.top - b.top - (sc.clientHeight - r.height) / 2; };
    requestAnimationFrame(() => { toSel(); if (window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches) { try { qi.focus({ preventScroll: true }); } catch (e) { qi.focus(); } } });
    P.close = S.close; P.sheet = S;
    return P;
  }

  /* ------------------------------------------------------------ <msh-popup-field> (popup_hash-felt) */
  const PF_CSS = `
    :host{display:block;font-family:${M.FONT};color:var(--ki-text, #fafafa);min-width:0}
    *{box-sizing:border-box}
    button{font:inherit;color:inherit;border:0;background:none;padding:0;margin:0;cursor:pointer;-webkit-tap-highlight-color:transparent}
    .f{display:flex;align-items:center;gap:6px;min-width:0}
    .pk{flex:1;min-width:0;display:flex;align-items:center;gap:12px;min-height:60px;padding:8px 12px 8px 8px;border-radius:18px;background:var(--msh-if-bg,var(--msh-tp-bg,var(--ki-bg, #232323)));text-align:left}
    .pk:active{transform:scale(.99)}
    .ci{width:44px;height:44px;border-radius:22px;flex:none;display:grid;place-items:center;background:var(--ki-surface, #3a3a3a);color:var(--ki-text-1, #e1e1e1)}
    .nm{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
    .nm b{font-weight:500;font-size:15px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .nm i{font-style:normal;font-size:12px;line-height:1.2;color:var(--ki-text-mid, #979797);font-family:ui-monospace,Menlo,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .nm i.w{color:#f2c073}
    .nm.ph b{color:var(--ki-text-mid, #979797)}
    .by{height:32px;padding:0 6px 0 12px;border-radius:16px;background:var(--ki-surface-2, #404040);display:flex;align-items:center;gap:2px;font-size:13px;font-weight:500;flex:none}
    .x{width:36px;height:36px;border-radius:18px;flex:none;display:grid;place-items:center;color:var(--ki-text-mid, #979797)}
  `;
  // Feltet (fasit: «Popup»-feltet i Handlingsvelger.dc.html): ikon-sirkel (romfarge), navn, #hash og «Bytt ›» → arket.
  // × (når en verdi er satt og feltet har standard) tømmer til standard. value-changed { value: '#hash' | '' }
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
        this._sheet = openPopupPicker({ value: this.value || normHash(this.getAttribute('placeholder')), title: this.getAttribute('label') || 'Velg popup', hass: this._hass, from: this, onPick: (v) => this._emit(v) });
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
      const p = h ? popupOf(h, this._hass) : null, col = p && p.color;
      const sub = v ? (p ? v : `${v} · ${MISSING}`) : ph ? `Standard · ${ph}` : 'Alle popups i dashbordet';
      const html = `<style>${PF_CSS}</style><div class="f"><button class="pk" data-p="open" title="Velg popup"><span class="ci" ${col ? `style="background:${esc(col)};color:var(--ki-on-accent, #2f2f2f)"` : ''}>${M.icon(p ? p.icon || 'mdi:card-outline' : 'mdi:card-search-outline', 22, h ? '' : 'opacity:.55')}</span>`
        + `<span class="nm${h ? '' : ' ph'}"><b>${esc(p ? p.name : v || 'Velg popup …')}</b><i class="${v && !p ? 'w' : ''}">${esc(sub)}</i></span><span class="by">Bytt${M.icon('mdi:chevron-right', 18)}</span></button>`
        + `${v && ph ? `<button class="x" data-p="x" title="Tilbake til standard">${M.icon('mdi:close', 18)}</button>` : ''}</div>`;
      if (!this._did) { this.shadowRoot.innerHTML = html; this._did = true; } else M.morph(this.shadowRoot, html);
    }
  }
  if (!customElements.get('msh-popup-field')) customElements.define('msh-popup-field', MshPopupField);
  M.popupPicker = {
    tag: 'msh-popup-field', GROUPS: PGROUPS, MISSING,
    open: openPopupPicker, list: popupList, norm: normHash,
    // ha-selector select (reserve): samme liste, egen verdi tillatt
    selector: (hass) => ({ select: { mode: 'dropdown', custom_value: true, options: popupList(hass).map((p) => ({ value: p.hash, label: `${p.name} · ${p.hash}${p.group === 'imp' ? ' (importert)' : ''}` })) } }),
    html(o = {}) {
      return `<msh-popup-field data-nomorph ${o.key ? `data-key="${esc(o.key)}"` : ''} ${o.name ? `data-name="${esc(o.name)}"` : ''} value="${esc(normHash(o.value))}" placeholder="${esc(o.placeholder || '')}"${o.label ? ` label="${esc(o.label)}"` : ''} ${o.attrs || ''}></msh-popup-field>`;
    },
  };

  /* ------------------------------------------------------------ sti-forslag fra lovelace/config (ikke hardkodet) */
  const viewIcon = (v) => v.icon || (v.panel ? 'mdi:view-dashboard' : 'mdi:view-dashboard-outline');
  const dashBase = () => '/' + (location.pathname.split('/')[1] || 'lovelace');
  let VC = { key: '', t: 0, list: null, p: null };
  function viewsSync(hass) {
    const out = [], seen = new Set(), add = (v, l, ic) => { if (v && !seen.has(v)) { seen.add(v); out.push([v, l || v, ic || 'mdi:view-dashboard-outline']); } };
    const base = dashBase();
    (VC.list || []).forEach((x) => add(...x));
    try {
      const ha = document.querySelector('home-assistant'), panel = ha && M.deep && M.deep(ha.shadowRoot, 'ha-panel-lovelace');
      const root = panel && panel.shadowRoot && panel.shadowRoot.querySelector('hui-root');
      const views = (root && root.lovelace && root.lovelace.config && root.lovelace.config.views) || (panel && panel.lovelace && panel.lovelace.config && panel.lovelace.config.views) || [];
      views.forEach((v, i) => add(`${base}/${v.path || i}`, v.title || v.path || 'Visning ' + (i + 1), viewIcon(v)));
    } catch (e) { /* */ }
    const P = (hass && hass.panels) || {};
    Object.keys(P).forEach((k) => { const p = P[k]; if (p && p.component_name === 'lovelace' && '/' + (p.url_path || k) !== base) add('/' + (p.url_path || k), p.title || p.url_path || k, p.icon || 'mdi:view-dashboard'); });
    return out;
  }
  // Henter dashbordets visninger via WS lovelace/config (mellomlagret 60 s). Strategi-dashbord gir ingen visninger der –
  // da brukes den genererte configen (hui-root) og andre dashbord fra hass.panels.
  function views(hass) {
    const h = hass || M.lastHass, base = dashBase(), key = base;
    if (VC.key === key && VC.list && Date.now() - VC.t < 60000) return Promise.resolve(viewsSync(h));
    if (VC.key === key && VC.p) return VC.p;
    VC = { key, t: 0, list: VC.key === key ? VC.list : null, p: null };
    const url = base.slice(1) === 'lovelace' ? null : base.slice(1);
    VC.p = (async () => {
      let list = [];
      try {
        if (h && h.callWS) {
          const lc = await h.callWS({ type: 'lovelace/config', url_path: url });
          if (lc && Array.isArray(lc.views)) list = lc.views.map((v, i) => [`${base}/${v.path || i}`, v.title || v.path || 'Visning ' + (i + 1), viewIcon(v)]);
        }
      } catch (e) { list = []; }
      VC.list = list; VC.t = Date.now(); VC.p = null;
      return viewsSync(h);
    })();
    return VC.p;
  }
  const services = (hass) => { const S = (hass && hass.services) || {}, out = []; Object.keys(S).sort().forEach((d) => Object.keys(S[d] || {}).sort().forEach((sv) => out.push(d + '.' + sv))); return out.slice(0, 2000); };

  /* ------------------------------------------------------------ <msh-tap-picker> · handlingsvelgeren (Fiks 30.3) */
  const CSS = `
    :host{display:block;font-family:${M.FONT};color:var(--ki-text, #fafafa);min-width:0}
    *{box-sizing:border-box}
    button,input{font:inherit;color:inherit;border:0;background:none;padding:0;margin:0;cursor:pointer;-webkit-tap-highlight-color:transparent}
    input{cursor:text;outline:none;-webkit-user-select:text;user-select:text}
    @keyframes tpfade{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
    .w{display:flex;flex-direction:column;gap:14px}
    .sel{display:flex;flex-direction:column;gap:8px}
    .grid{display:grid;gap:6px}
    .tl{height:76px;border-radius:20px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;background:var(--msh-tp-bg,var(--ki-bg, #232323));color:#c7c7c7;min-width:0;padding:0 4px;transition:background .2s,box-shadow .2s}
    .tl .ti{color:var(--ki-text-mid, #979797);transition:color .2s;display:inline-flex}
    .tl .tn{font-size:13px;font-weight:500;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .tl.on{background:var(--ki-surface-2, #404040);box-shadow:inset 0 0 0 1.5px ${PK};color:var(--ki-text, #fafafa)}
    .tl.on .ti{color:${PK}}
    .tl:active{transform:scale(.97)}
    .sub{font-size:12px;color:var(--ki-text-3, #7f7f7f);padding:0 2px;line-height:1.4}
    .lst{display:flex;flex-direction:column;padding:4px;border-radius:18px;background:var(--msh-tp-bg,var(--ki-bg, #232323))}
    .lr{display:flex;align-items:center;gap:12px;min-height:60px;padding:8px 12px 8px 8px;border-radius:14px;text-align:left;width:100%;transition:background .2s}
    .lr.on{background:var(--ki-surface-2, #404040)}
    .lr .ci{width:40px;height:40px;border-radius:20px;flex:none;display:grid;place-items:center;background:var(--ki-surface-2, #404040);color:var(--ki-text-1, #e1e1e1)}
    .lr.on .ci{background:${GRAD};color:var(--ki-on-accent, #2f2f2f)}
    .lr .nm{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
    .lr .nm b{font-size:14px;font-weight:500}
    .lr .nm i{font-style:normal;font-size:12px;color:var(--ki-text-mid, #979797)}
    .lr .ck{color:${PK};opacity:0;transition:opacity .2s;flex:none}
    .lr.on .ck{opacity:1}
    .fld{display:flex;flex-direction:column;gap:8px;animation:tpfade .2s ease both}
    .cap{font-size:12px;color:var(--ki-text-mid, #979797);padding:0 2px}
    .pf{display:flex;align-items:center;gap:12px;min-height:60px;padding:8px 12px 8px 8px;border-radius:18px;background:var(--msh-tp-bg,var(--ki-bg, #232323));text-align:left;width:100%}
    .pf:active{transform:scale(.99)}
    .pf .ci{width:44px;height:44px;border-radius:22px;flex:none;display:grid;place-items:center;background:var(--ki-surface, #3a3a3a);color:var(--ki-text-1, #e1e1e1)}
    .pf .nm{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
    .pf .nm b{font-size:15px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .pf .nm i{font-style:normal;font-size:12px;color:var(--ki-text-mid, #979797);font-family:ui-monospace,Menlo,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .pf .nm.ph b{color:var(--ki-text-mid, #979797)}
    .pf .by{height:32px;padding:0 6px 0 12px;border-radius:16px;background:var(--ki-surface-2, #404040);display:flex;align-items:center;gap:2px;font-size:13px;font-weight:500;flex:none}
    .hf{display:flex;align-items:center;height:48px;border-radius:16px;background:var(--msh-tp-bg,var(--ki-bg, #232323));padding:0 14px;gap:2px}
    .hf span{font:15px ui-monospace,Menlo,monospace;color:var(--ki-text-3, #7f7f7f)}
    .hf input{flex:1;min-width:0;height:100%;color:var(--ki-text, #fafafa);font:15px ui-monospace,Menlo,monospace}
    .in{height:48px;width:100%;border-radius:16px;padding:0 14px;background:var(--msh-tp-bg,var(--ki-bg, #232323));color:var(--ki-text, #fafafa);font-size:15px}
    .in.mono{font:15px ui-monospace,Menlo,monospace}
    .in::placeholder,.hf input::placeholder{color:var(--ki-text-3, #7f7f7f)}
    textarea.in{height:auto;min-height:72px;padding:10px 14px;font:13px/1.45 ui-monospace,Menlo,Consolas,monospace;resize:vertical;cursor:text;-webkit-user-select:text;user-select:text;outline:none;border:0}
    .msg{display:flex;align-items:center;gap:6px;font-size:12px;padding:0 2px}
    .msg.ok{color:#66d19e} .msg.warn{color:#f2c073}
    .chips{display:flex;gap:6px;flex-wrap:wrap}
    .chips button{height:34px;padding:0 12px;border-radius:17px;display:flex;align-items:center;gap:6px;font-size:13px;font-weight:500;background:var(--msh-tp-bg,var(--ki-bg, #232323));color:#c7c7c7;max-width:100%}
    .chips button span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .chips button.on{background:${GRAD};color:var(--ki-on-accent, #2f2f2f)}
    .tg{display:flex;align-items:center;gap:12px;height:48px;padding:0 14px;border-radius:16px;background:var(--msh-tp-bg,var(--ki-bg, #232323));width:100%}
    .tg .t{flex:1;text-align:left;font-size:14px}
    .trk{position:relative;width:44px;height:26px;border-radius:13px;flex:none;background:var(--ki-ctrl, #545454);transition:background .2s}
    .trk.on{background:${PK}}
    .trk i{position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:10px;background:var(--ki-knob, #fafafa);transition:left .2s}
    .trk.on i{left:21px}
    .hint{font-size:13px;color:var(--ki-text-mid, #979797);line-height:1.45;padding:0 2px}
    .hint b{color:var(--ki-text, #fafafa);font-weight:500}
    .hint.warn{color:#f2c073}
    .tst{height:44px;border-radius:22px;display:flex;align-items:center;justify-content:center;gap:6px;font-size:14px;font-weight:500;box-shadow:inset 0 0 0 1.5px rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.18*var(--ki-wa-k,1)),var(--ki-wa-max,1)));width:100%;min-width:0}
    .tst span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
    .tst:active{transform:scale(.98)}
    ha-selector{display:block}
  `;

  class MshTapPicker extends HTMLElement {
    static get observedAttributes() { return ['value', 'modes', 'action-style']; }
    constructor() {
      super();
      this._mode = null;
      const sr = this.attachShadow({ mode: 'open' });
      sr.addEventListener('click', (e) => this._click(e));
      sr.addEventListener('input', (e) => { e.stopPropagation(); this._inp(e.target, false); });
      sr.addEventListener('change', (e) => { e.stopPropagation(); this._inp(e.target, true); });
      // entitet-velgeren (More-info) sender value-changed – fang den her, ellers når den verten som en tap-verdi
      sr.addEventListener('value-changed', (e) => { e.stopPropagation(); const t = e.composedPath().find((n) => n.dataset && n.dataset.f === 'ent'); if (t) { const v = (e.detail && e.detail.value) || ''; this._emit(v ? { action: 'more-info', entity: v } : { action: 'more-info' }, 'more'); } });
      sr.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); e.target.blur(); } });
    }
    set hass(h) { const first = !this._hass; this._hass = h; if (first) this._render(); else this._syncSel(); }
    get hass() { return this._hass || M.lastHass || null; }
    get value() { try { return norm(JSON.parse(this.getAttribute('value') || 'null')); } catch (e) { return norm(this.getAttribute('value')); } }
    set value(v) { this.setAttribute('value', v ? JSON.stringify(v) : ''); }
    get modes() { const m = String(this.getAttribute('modes') || 'popup,hash,path,url,more,none').split(',').map((x) => x.trim()).filter((x) => MODES[x]); return m.length ? m : ['popup']; }
    get actionStyle() { let g = ''; try { g = M.store && M.store.get ? M.store.get('action_style') : ''; } catch (e) { g = ''; } const a = this.getAttribute('action-style') || g || 'ruter'; return String(a).toLowerCase() === 'liste' ? 'liste' : 'ruter'; }
    connectedCallback() { this._render(); }
    attributeChangedCallback(n, o, v) {
      if (o === v) return;
      if (n === 'value') { const nm = modeOf(this.value, this.hass); if (!(this._mode && (nm === this._mode || ((nm === 'popup' || nm === 'hash') && (this._mode === 'popup' || this._mode === 'hash')) || (nm === 'none' && !this.value)))) this._mode = null; }
      this._render();
    }
    get mode() { const v = this.value, m = this._mode || (!v && this.modes.includes('std') ? 'std' : modeOf(v, this.hass)); return this.modes.includes(m) ? m : m === 'hash' && this.modes.includes('popup') ? 'popup' : m === 'popup' && this.modes.includes('hash') ? 'hash' : this.modes[0]; }
    _lab(m) { return DESIGN.includes(m) ? MODES[m] : this.getAttribute('label-' + m) || MODES[m]; }
    _emit(v, mode, quiet) {
      if (mode) this._mode = mode;
      this.setAttribute('value', v ? JSON.stringify(v) : '');
      if (!quiet) M.haptic('selection');
      this._render();
      this.dispatchEvent(new CustomEvent('value-changed', { detail: { value: v || null }, bubbles: true, composed: true }));
    }
    _openPicker() {
      M.haptic('light');
      openPopupPicker({ value: hashOf(this.value), hass: this.hass, from: this, title: 'Velg popup',
        onPick: (h) => this._emit(h ? { action: 'navigate', navigation_path: h } : null, h && popupOf(h, this.hass) ? 'popup' : 'hash', true),
        onCustom: this.modes.includes('hash') ? () => { this._mode = 'hash'; M.haptic('selection'); this._render(); const i = this.shadowRoot.querySelector('[data-f="hash"]'); if (i) i.focus(); } : null });
    }
    _click(e) {
      const b = e.composedPath().find((n) => n.dataset && n.dataset.p);
      if (!b) return;
      const d = b.dataset;
      if (d.p === 'mode') {
        const m = d.v;
        if (m === this.mode) return;
        this._mode = m;
        M.haptic('selection');
        if (m === 'more') return this._emit({ action: 'more-info' }, m, true);
        if (m === 'none') return this._emit({ action: 'none' }, m, true);
        if (m === 'lock') return this._emit({ action: 'lock-sheet' }, m, true);
        if (m === 'std') return this._emit(null, m, true);
        if (m === 'toggle') return this._emit({ action: 'toggle' }, m, true);
        this._render();
        if (m === 'hash' || m === 'path' || m === 'url') { const i = this.shadowRoot.querySelector('.fld input'); if (i && window.matchMedia && matchMedia('(hover: hover)').matches) i.focus(); }
        return;
      }
      if (d.p === 'open') return this._openPicker();
      if (d.p === 'chip') return this._emit({ action: 'navigate', navigation_path: d.v }, 'path');
      if (d.p === 'newtab') { const v = this.value; if (!v || v.action !== 'url') { this._newTab = this._newTab === false; return this._render(); } const nt = v.new_tab === false; const n = { ...v }; if (nt) delete n.new_tab; else n.new_tab = false; return this._emit(n, 'url'); }
      if (d.p === 'test') {
        const v = this.value;
        if (!v) return;
        M.haptic('medium');
        run(this, v, { entity: this.getAttribute('entity') || undefined, hass: this.hass });
      }
    }
    _inp(t, commit) {
      const f = t.dataset && t.dataset.f;
      if (!f) return;
      const raw = t.value.trim();
      if (f === 'hash') {
        const h = raw ? '#' + raw.replace(/^#+/, '').replace(/\s+/g, '-') : '';
        if (!commit) { const w = this.shadowRoot.querySelector('.hm'); if (w) { const p = popupOf(h, this.hass); w.outerHTML = this._hashMsg(h, p); } return; }
        return this._emit(h ? { action: 'navigate', navigation_path: h } : null, 'hash');
      }
      if (!commit) return;
      if (f === 'path') { const p = raw && raw[0] !== '/' && raw[0] !== '#' ? '/' + raw : raw; return this._emit(p ? { action: 'navigate', navigation_path: p } : null, 'path'); }
      if (f === 'url') { const v = raw ? { action: 'url', url_path: raw } : null; if (v && this._newTab === false) v.new_tab = false; return this._emit(v, 'url'); }
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
    _hashMsg(h, p) {
      if (!h) return '<span class="msg hm"></span>';
      if (p) return `<span class="msg ok hm">${M.icon('mdi:check', 16)}Åpner ${esc(p.name)}</span>`;
      return `<span class="msg warn hm">${M.icon('mdi:alert', 16)}Popupen finnes ikke i dette dashbordet – lagres likevel</span>`;
    }
    _testLabel(mode, v) {
      const h = hashOf(v);
      return { popup: h ? 'Test · åpne ' + h : '', hash: h ? 'Test · åpne ' + h : '', path: v && v.action === 'navigate' ? 'Test · gå til visning' : '', url: v && v.action === 'url' ? 'Test · åpne nettside' : '', more: 'Test · vis dialog', toggle: 'Test · veksle', service: v && (v.perform_action || v.service) ? 'Test · kjør tjenesten' : '', lock: 'Test · åpne dørlåsen' }[mode] || '';
    }
    _field(mode, v) {
      const h = this.hass, cur = hashOf(v);
      if (mode === 'popup') {
        const p = popupOf(cur, h), col = p && p.color, n = popupList(h).length;
        return `<span class="cap">Popup</span><button class="pf" data-p="open"><span class="ci" ${col ? `style="background:${esc(col)};color:var(--ki-on-accent, #2f2f2f)"` : ''}>${M.icon(p ? p.icon || 'mdi:card-outline' : 'mdi:card-search-outline', 22)}</span><span class="nm${p || cur ? '' : ' ph'}"><b>${esc(p ? p.name : cur || 'Velg popup …')}</b><i>${esc(p ? p.hash : cur || n + ' popups i dashbordet')}</i></span><span class="by">${cur ? 'Bytt' : 'Velg'}${M.icon('mdi:chevron-right', 18)}</span></button>`;
      }
      if (mode === 'hash') {
        const p = popupOf(cur, h);
        return `<span class="cap">Hash</span><div class="hf"><span>#</span><input data-f="hash" value="${esc(cur.replace(/^#/, ''))}" placeholder="tesla" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done"></div>${this._hashMsg(cur, p)}`;
      }
      if (mode === 'path') {
        const pth = v && v.action === 'navigate' && v.navigation_path[0] !== '#' ? v.navigation_path : '';
        const vp = this._views || viewsSync(h);
        if (!this._viewsP) this._viewsP = views(h).then((l) => { this._views = l; this._render(); }).catch(() => {});
        return `<span class="cap">Sti</span><input class="in mono" data-f="path" value="${esc(pth)}" placeholder="${esc(dashBase())}/0" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done">
          ${vp.length ? `<div class="chips">${vp.map(([p, l, ic]) => `<button class="${p === pth ? 'on' : ''}" data-p="chip" data-v="${esc(p)}" title="${esc(p)}">${M.icon(ic, 16)}<span>${esc(l)}</span></button>`).join('')}</div>` : ''}`;
      }
      if (mode === 'url') {
        const u = v && v.action === 'url' ? v.url_path : '', nt = v && v.action === 'url' ? v.new_tab !== false : this._newTab !== false;
        return `<span class="cap">Adresse</span><input class="in" data-f="url" type="url" inputmode="url" value="${esc(u)}" placeholder="https://" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done">
          <button class="tg" data-p="newtab" role="switch" aria-checked="${nt}"><span class="t">Åpne i ny fane</span><span class="trk ${nt ? 'on' : ''}"><i></i></span></button>`;
      }
      if (mode === 'more') {
        const ent = v && v.action === 'more-info' ? v.entity || '' : '';
        const gui = this.hasAttribute('gui') && customElements.get('ha-selector');
        return `<span class="cap">Entitet</span>${gui ? `<ha-selector data-f="ent" data-nomorph data-key="tp-ent-gui"></ha-selector>`
          : M.entityPicker ? M.entityPicker.html({ key: 'tp-ent', value: ent, placeholder: 'Kortets egen entitet', attrs: 'data-f="ent"' }) : `<input class="in mono" data-f="ent" value="${esc(ent)}" placeholder="light.stue" autocomplete="off" autocapitalize="off" spellcheck="false">`}
          ${ent ? '' : '<span class="hint" style="font-size:12px">Tom = kortets egen entitet.</span>'}`;
      }
      if (mode === 'none') return `<span class="hint">${esc(this.getAttribute('none-hint') || 'Knappen gjør ingenting ved trykk. Hold-handlingen gjelder fortsatt.')}</span>`;
      if (mode === 'lock') return '<span class="hint">Åpner hurtigarket for dørlåsen.</span>';
      if (mode === 'std') return `<span class="hint">${esc(this.getAttribute('std-hint') || 'Standard for kortet.')}</span>`;
      if (mode === 'toggle') return '<span class="hint">Veksler entiteten (lås/lås opp, på/av …).</span>';
      if (mode === 'service') {
        const sv = v && (v.action === 'perform-action' || v.action === 'call-service') ? v.perform_action || v.service || '' : '';
        const data = v && v.data && Object.keys(v.data).length ? (M.yaml && M.yaml.dump ? M.yaml.dump(v.data) : JSON.stringify(v.data)) : '';
        return `<span class="cap">Tjeneste</span><input class="in mono" data-f="svc" list="tp-svc" value="${esc(sv)}" placeholder="script.alarm_toggle" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done"><datalist id="tp-svc">${services(h).map((x) => `<option value="${esc(x)}"></option>`).join('')}</datalist>
          <textarea class="in" data-f="data" placeholder="data (YAML), f.eks.&#10;entity_id: lock.inngang" autocapitalize="off" spellcheck="false">${esc(String(data).replace(/\n$/, ''))}</textarea>
          <span class="hint${this._dataErr ? ' warn' : ''}" style="font-size:12px">${this._dataErr ? 'Feil i data: ' + esc(this._dataErr) : 'Kaller tjenesten med data. Tom data = ingen data.'}</span>`;
      }
      return '';
    }
    // ha-selector (GUI-editoren): egenskaper settes etter render
    _syncSel() {
      const s = this.shadowRoot && this.shadowRoot.querySelector('ha-selector[data-f="ent"]');
      if (!s) return;
      const v = this.value;
      s.hass = this.hass; s.selector = { entity: {} }; s.label = 'Entitet'; s.value = v && v.action === 'more-info' ? v.entity || '' : '';
    }
    _render() {
      if (!this.shadowRoot) return;
      const v = this.value, mode = this.mode, modes = this.modes, list = this.actionStyle === 'liste';
      const ic = (m, on, s) => M.icon(MICON[m][on ? 1 : 0], s);
      const sel = list
        ? `<div class="lst" role="radiogroup">${modes.map((m) => `<button class="lr ${m === mode ? 'on' : ''}" role="radio" aria-checked="${m === mode}" data-p="mode" data-v="${m}"><span class="ci">${ic(m, true, 20)}</span><span class="nm"><b>${esc(this._lab(m))}</b><i>${esc(MSUB[m])}</i></span><span class="ck">${M.icon('mdi:check-circle', 22)}</span></button>`).join('')}</div>`
        : `<div class="grid" role="radiogroup" style="grid-template-columns:repeat(${colsFor(modes.length)},minmax(0,1fr))">${modes.map((m) => `<button class="tl ${m === mode ? 'on' : ''}" role="radio" aria-checked="${m === mode}" data-p="mode" data-v="${m}"><span class="ti">${ic(m, m === mode, 24)}</span><span class="tn">${esc(this._lab(m))}</span></button>`).join('')}</div><span class="sub">${esc(MSUB[mode] || '')}</span>`;
      const tl = this._testLabel(mode, v);
      const html = `<style>${CSS}</style><div class="w" data-style="${list ? 'liste' : 'ruter'}"><div class="sel">${sel}</div>`
        + `<div class="fld" data-key="fld-${mode}" data-mode="${mode}">${this._field(mode, v)}</div>`
        + (mode !== 'none' && mode !== 'std' && tl ? `<button class="tst" data-p="test" data-key="tst">${M.icon('mdi:play', 19)}<span>${esc(tl)}</span></button>` : '')
        + '</div>';
      if (!this._did) { this.shadowRoot.innerHTML = html; this._did = true; } else M.morph(this.shadowRoot, html);
      this._syncSel();
    }
  }
  if (!customElements.get('msh-tap-picker')) customElements.define('msh-tap-picker', MshTapPicker);

  M.tap = {
    tag: 'msh-tap-picker', MODES, DESIGN, colsFor,
    norm, hashOf, run, popupOf, label, modeOf, views,
    html(o = {}) {
      const t = norm(o.value);
      const st = o.style || o.actionStyle;
      return `<msh-tap-picker data-nomorph ${o.key ? `data-key="${esc(o.key)}"` : ''} value="${esc(t ? JSON.stringify(t) : '')}" modes="${esc((o.modes || DESIGN).join(','))}"${st ? ` action-style="${esc(st)}"` : ''}${o.stdHint ? ` std-hint="${esc(o.stdHint)}"` : ''}${o.noneHint ? ` none-hint="${esc(o.noneHint)}"` : ''}${o.entity ? ` entity="${esc(o.entity)}"` : ''}${o.gui ? ' gui' : ''}${Object.keys(o.labels || {}).map((k) => ` label-${esc(k)}="${esc(o.labels[k])}"`).join('')} ${o.attrs || ''}></msh-tap-picker>`;
    },
  };
})();
