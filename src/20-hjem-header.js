/* msh-hjem-header-card · Hjem-visningen, header. Kilde: Hjem v2.dc.html (<header>, peopleVals, hdr/hdrVals,
 * he.* header-editor, quick.* person-hurtigark, servermeny, lockVals).
 * Autokonfig (entiteter.md «Hjem-header»): person.*, weather.* (første), zone.* (soner).
 * Felles for Hjem-kortene (20–23): utvidet editor (msh-hjem-editor), dørlås-hurtigark (M.hjemLockSheet),
 * søppel-oppslag (M.hjemTrash*), værtekst (M.hjemCond).
 */
(function () {
  const M = window.MSH, esc = M.esc, C = M.C;
  const PINK = C.accent;
  const get = (o, p) => String(p).split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  const setIn = (o, p, v) => {
    const ks = String(p).split('.');
    let cur = o;
    ks.forEach((k, i) => {
      if (i === ks.length - 1) { if (v === undefined || v === '' || v === null) delete cur[k]; else cur[k] = v; }
      else { cur[k] = { ...(cur[k] || {}) }; cur = cur[k]; }
    });
    return o;
  };
  const toasts = (card) => ({ enabled: !(card && card.config && card.config.toasts === false) });
  M.hjemToast = (card, text) => M.toast(text, toasts(card));

  /* ------------------------------------------------------------ avstand header → prosa (fiks 16.2) */
  // header.prose_gap (px, −20–60, standard 16): mellomrommet mellom headeren og prosaen i msh-hjem-card.
  // Én kilde: header-kortets config (ki-store cards.ki-home-header). Redigeres i «Tilpass header» → Størrelser og
  // «Tilpass Hjem» → Tekst.
  M.HJEM_PROSE_GAP = { min: -20, max: 60, step: 2, def: 16 };
  M.HJEM_PROSE_GAP_PRESETS = [[4, 'Tett 4'], [16, 'Standard 16'], [32, 'Luftig 32']];
  M.hjemProseGap = function (c) {
    const v = c && c.prose_gap, n = Number(v), G = M.HJEM_PROSE_GAP;
    return v === '' || v == null || !isFinite(n) ? G.def : Math.max(G.min, Math.min(G.max, n));
  };

  /* ------------------------------------------------------------ «Bytt sted» (Fiks 37 – erstatter 16.3 / 31.7 / 34.2) */
  // Felles servervelger: MSH.servervelger (src/06-server.js) – servere, server_sti, server_navn, server_plass,
  // server_meny_med, greeting_*_action. Eldre servers/this_server/place_name/title_actions leses (SV.cfg) og skrives om
  // til de nye nøklene én gang (_migrateServers).
  const SV = M.servervelger;
  // server_plass når den ikke er satt: Sted/Hjem/Profil = stedsnavnet som tittel, ellers hilsenen/navnet (navn)
  M.hjemServerPlassStd = (mode) => (['sted', 'hjem', 'profil'].includes(mode) ? 'tittel' : 'navn');

  /* ------------------------------------------------------------ handlinger på tittelen (Fiks 9 → Fiks 37) */
  // server_meny_med = gesten som åpner «Bytt sted»; de andre gestene kjører greeting_<gest>_action (HA-handling).
  // Kortets egne handlinger: { action: 'kiosk' } (kiosk_entity av/på), { action: 'edit' } (rediger dashbord),
  // { action: 'tilpass' } (Tilpass header). Standard: trykk = meny, dobbelttrykk = /config, hold = kiosk-modus.
  const TACTS = [['server', 'Bytt sted', 'mdi:swap-horizontal'], ['kiosk', 'Kiosk-modus av/på', 'mdi:fullscreen'], ['config', 'Innstillinger', 'mdi:cog'], ['edit', 'Rediger dashbord', 'mdi:pencil'], ['header', 'Tilpass header', 'mdi:page-layout-header'], ['vaer', 'Åpne Vær', 'mdi:weather-partly-cloudy'], ['none', 'Ingen', 'mdi:cancel'], ['egen', 'Egen handling (YAML)', 'mdi:code-braces']];
  const TACT_L = Object.fromEntries(TACTS.map(([k, l]) => [k, l]));
  const TGESTS = [['tap', 'Trykk', 'mdi:gesture-tap'], ['double_tap', 'Dobbelttrykk', 'mdi:gesture-double-tap'], ['hold', 'Hold', 'mdi:gesture-tap-hold']];
  const GSTD = { double_tap: { action: 'navigate', navigation_path: '/config' }, hold: { action: 'kiosk' } };
  M.HJEM_GREET_STD = GSTD;
  const KIOSK_DEF = 'input_boolean.kiosk_mode';
  M.HJEM_TITLE_ACTIONS = TACTS;
  // Nedtrekksverdien for en handling
  const presetOf = (h, c) => {
    const a = h && h.action;
    if (!a || a === 'none') return 'none';
    if (a === 'kiosk') return 'kiosk';
    if (a === 'edit') return 'edit';
    if (a === 'tilpass') return 'header';
    if (a === 'navigate') {
      const p = String(h.navigation_path || '');
      if (p === '/config') return 'config';
      if (p === ((c && c.weather_hash) || '#vaer') || p === '#vaer') return 'vaer';
    }
    return 'egen';
  };
  // Effektive valg per gest: { tap, double_tap, hold } → 'server' | preset | 'egen'. Ren funksjon.
  M.hjemTitleActions = function (c) {
    const cc = SV.cfg(c || {}), meny = SV.menyMed(cc), out = {};
    TGESTS.forEach(([g]) => { out[g] = meny === g ? 'server' : presetOf(SV.handling(cc, g, GSTD), cc); });
    return out;
  };
  /* ------------------------------------------------------------ handlinger på personbildene (Fiks 22.7) */
  // person_actions: { tap, double, hold } – hver er én av PACTS. Erstatter person_tap (20.22): gammel person_tap
  // migreres (popup/quick → trykk; kart var standarden → nå person-popup). Gjelder alle personbilder i headeren.
  const PACTS = [['popup', 'Person-popup', 'mdi:account-box'], ['quick', 'Hurtigark', 'mdi:card-account-details'], ['kart', 'Vis på kart', 'mdi:map-marker-account'], ['more', 'More-info', 'mdi:information-outline'], ['none', 'Ingen', 'mdi:cancel']];
  const PACT_L = Object.fromEntries(PACTS.map(([k, l]) => [k, l]));
  const PGESTS = [['tap', 'Trykk', 'mdi:gesture-tap'], ['double', 'Dobbelttrykk', 'mdi:gesture-double-tap'], ['hold', 'Hold', 'mdi:gesture-tap-hold']];
  // Fiks 26.22 snur 22.7-standarden: trykk = hurtigark (som før 22.7), langt trykk = person-popup.
  const PACT_DEF = { tap: 'quick', double: 'none', hold: 'popup' };
  M.HJEM_PERSON_ACTIONS = PACTS;
  // Effektive handlinger (ukjente/manglende → standard, gammel person_tap migreres). Ren funksjon.
  M.hjemPersonActions = function (c) {
    const t = (c && c.person_actions) || {}, out = {};
    const old = c && !c.person_actions && (c.person_tap === 'popup' || c.person_tap === 'quick') ? { tap: c.person_tap } : {};
    Object.keys(PACT_DEF).forEach((k) => { out[k] = PACT_L[t[k]] ? t[k] : old[k] || PACT_DEF[k]; });
    return out;
  };
  // Kontrakt mot msh-kart-card (51-kart.js), «Vis på kart»: M.kartFocus(personId) legger ønsket i
  // M.kartFocusReq = { entity_id, t } (Date.now()) og sender window-event 'msh-kart-focus' { detail: { entity_id } },
  // og åpner så #kart. Kartet bør sentrere på personen ved eventet, og ved oppstart lese M.kartFocusReq hvis t er
  // ferskere enn ~5 s (popupen kan bygge kartet etter eventet). Kartet kan nullstille M.kartFocusReq når det er brukt.
  M.kartFocus = M.kartFocus || function (entityId) {
    M.kartFocusReq = { entity_id: entityId, t: Date.now() };
    window.dispatchEvent(new CustomEvent('msh-kart-focus', { detail: { entity_id: entityId } }));
  };
  M.hjemKioskEntity = (c) => ((M.store && M.store.get('kiosk.entity')) || null) || (c && c.kiosk_entity) || (c && c.overrides && c.overrides.kiosk) || KIOSK_DEF;

  /* ------------------------------------------------------------ vær */
  const COND = { 'clear-night': 'Klart', cloudy: 'Skyet', exceptional: 'Ekstremvær', fog: 'Tåke', hail: 'Hagl', lightning: 'Torden', 'lightning-rainy': 'Torden og regn', partlycloudy: 'Delvis skyet', pouring: 'Styrtregn', rainy: 'Regn', snowy: 'Snø', 'snowy-rainy': 'Sludd', sunny: 'Sol', windy: 'Vind', 'windy-variant': 'Vind og skyer' };
  M.hjemCond = M.hjemCond || function (state) { return COND[state] || (state ? String(state) : '–'); };

  /* ------------------------------------------------------------ søppel (delt av prosa + søppelkort) */
  const TRASH_RE = /s(o|ø)ppel|avfall|renovasjon|waste|garbage|trash|t(o|ø)mming|restavfall|papir|plast/i;
  M.hjemTrashDays = function (st) {
    if (!st || M.unavailable(st)) return null;
    if (M.isNum(st.state)) return Math.round(Number(st.state));
    const a = st.attributes || {};
    for (const k of ['days', 'daysTo', 'days_to', 'days_until', 'days_left']) if (M.isNum(a[k])) return Math.round(Number(a[k]));
    const dt = /^\d{4}-\d{2}-\d{2}/.test(st.state) ? st.state : (a.next_date || a.date || null);
    if (dt) {
      const d = new Date(dt), t = new Date();
      if (!isNaN(d)) { d.setHours(0, 0, 0, 0); t.setHours(0, 0, 0, 0); return Math.round((d - t) / 86400000); }
    }
    const m = /(\d+)\s*(d|dag|day)/i.exec(st.state);
    return m ? Number(m[1]) : null;
  };
  M.hjemTrashAuto = function (hass) {
    const c = M.all(hass, 'sensor', (s, id) => TRASH_RE.test(id + ' ' + (s.attributes.friendly_name || '')));
    return c.find((id) => M.hjemTrashDays(hass.states[id]) != null) || c[0] || null;
  };
  M.hjemTrashType = function (st, typeSt) {
    const nice = (arr) => { const l = arr.map((x, i) => (i ? String(x).toLowerCase() : String(x))); return l.length > 1 ? l.slice(0, -1).join(', ') + ' og ' + l[l.length - 1] : l[0] || ''; };
    if (typeSt && !M.unavailable(typeSt)) { const v = typeSt.state; return Array.isArray(typeSt.attributes.types) ? nice(typeSt.attributes.types) : v; }
    const a = (st && st.attributes) || {};
    if (Array.isArray(a.types) && a.types.length) return nice(a.types);
    return a.garbage_type || a.type || a.waste_type || null;
  };

  /* ------------------------------------------------------------ utvidet editor */
  // Arver msh-editor (samme skjema/config-flyt) og legger til felttyper Hjem-kortene trenger:
  //   rows   { name, label, title(row), sub(row), chip(row)→html, fields:[… rowWhen(row)], newRow(h,c), defaults(h,c), hide, addLabel }
  //   modes  { name, options:[[v,label,icon,sub]] }   range { name, min, max, step, fmt }
  //   tokens { target, tokens:[[label,text,prepend]] } swatches { name, options:[[v,css,label]] }
  //   html   { render(h,c) }                            button { label, icon, run(row,h,c) }
  // Alle felt kan ha when(h,c).
  const XCSS = `
    .xrows{display:flex;flex-direction:column;gap:6px}
    .xr{display:flex;align-items:center;gap:4px;min-height:54px;padding:0 6px 0 12px;border-radius:26px;background:var(--ki-surface-3, #2f2f2f)}
    .xr.on{background:var(--ki-ctrl, #545454)}
    .xrh{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:2px;text-align:left;padding:6px 0;min-height:54px}
    .xrh b{font-size:14px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .xrh i{font-style:normal;font-size:11px;color:var(--ki-text-mid, #979797);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .xsq{width:32px;height:32px;border-radius:16px;flex:none;display:grid;place-items:center;background:var(--ki-bg, #232323);color:var(--ki-text, #fafafa)}
    .xsq[disabled]{background:transparent;color:var(--ki-text-lo, #545454);pointer-events:none}
    .xsq.del{background:rgb(242 128 115 / 0.2);color:var(--ki-red-text, var(--red,#f28073))}
    .xrb{display:flex;flex-direction:column;gap:8px;padding:12px;border-radius:22px;background:var(--ki-surface, #3a3a3a)}
    .xrb .f{background:var(--ki-surface-3, #2f2f2f)}
    .xrb .f .inp{background:var(--ki-bg, #232323)}
    .xadd{height:48px;border-radius:24px;display:flex;align-items:center;justify-content:center;gap:8px;font-size:14px;font-weight:500;box-shadow:inset 0 0 0 1.5px rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.18*var(--ki-wa-k,1)),var(--ki-wa-max,1)))}
    .xmodes{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
    .xmode{min-height:118px;padding:12px;border-radius:22px;display:flex;flex-direction:column;align-items:flex-start;text-align:left;background:var(--ki-surface, #3a3a3a);color:var(--ki-text, #fafafa)}
    .xmode .iw{width:36px;height:36px;border-radius:18px;display:grid;place-items:center;background:var(--ki-ctrl, #545454)}
    .xmode b{font-size:15px;font-weight:600;padding-top:10px}
    .xmode i{font-style:normal;font-size:11px;line-height:1.3;color:var(--ki-text-mid, #979797)}
    .xmode.on{background:${PINK};color:var(--ki-on-accent, #2f2f2f)}
    .xmode.on .iw{background:rgba(42,23,32,0.12)} .xmode.on i{color:rgba(42,23,32,0.75)}
    .xtoks{display:flex;gap:4px;flex-wrap:wrap;max-height:88px;overflow-y:auto}
    .xtok{height:28px;padding:0 10px;border-radius:14px;background:var(--ki-ctrl, #545454);font-size:12px;white-space:nowrap;color:var(--ki-text-1, #e1e1e1)}
    .xrng{width:100%;accent-color:rgb(242 133 201)}
    .xsw{display:flex;gap:10px;flex-wrap:wrap;padding:2px}
    .xsw button{width:34px;height:34px;border-radius:17px;flex:none;box-shadow:inset 0 0 0 1px rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.2*var(--ki-wa-k,1)),var(--ki-wa-max,1)))}
    .xsw button.on{box-shadow:0 0 0 2px var(--ki-surface-3, #2f2f2f),0 0 0 4px var(--ki-text, #fafafa)}
    .xbtn{height:42px;border-radius:21px;display:flex;align-items:center;justify-content:center;gap:6px;font-size:14px;font-weight:600;background:${PINK};color:var(--ki-on-accent, #2f2f2f)}
    .xprev{padding:14px 16px;border-radius:24px;background:var(--ki-bg, #232323);font-size:16px;line-height:1.95;text-wrap:pretty}
    .xprev .pc{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 11px;border-radius:14px;color:var(--ki-on-accent, #232323);font-weight:600;vertical-align:middle;white-space:nowrap;font-variant-numeric:tabular-nums}
    .xprev .pd{width:8px;height:8px;border-radius:4px;display:inline-block}
    .xchip{width:36px;height:36px;border-radius:18px;flex:none;display:grid;place-items:center;color:#fff}
    .xta{display:flex;flex-direction:column;gap:6px}
    .xtr{display:flex;align-items:center;gap:12px;min-height:56px;padding:0 8px 0 10px;border-radius:26px;background:var(--ki-surface-3, #2f2f2f)}
    .xtr .ti{width:36px;height:36px;border-radius:18px;flex:none;display:grid;place-items:center;background:var(--ki-bg, #232323);color:var(--ki-text-2, #afafaf)}
    .xtr b{flex:1;min-width:0;font-size:14px;font-weight:500}
    .xpill{position:relative;flex:none;display:flex;align-items:center;gap:6px;height:38px;max-width:62%;padding:0 8px 0 14px;border-radius:19px;background:var(--ki-ctrl, #545454);color:var(--ki-text, #fafafa);font-size:13px;font-weight:500;white-space:nowrap}
    .xpill.none{background:transparent;color:var(--ki-text-mid, #979797);box-shadow:inset 0 0 0 1.5px rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.18*var(--ki-wa-k,1)),var(--ki-wa-max,1)))}
    .xpill span{overflow:hidden;text-overflow:ellipsis}
    .xpill select{position:absolute;inset:0;width:100%;height:100%;margin:0;padding:0;border:0;opacity:0;cursor:pointer;font-size:16px;-webkit-appearance:none;appearance:none;background:transparent;color:var(--ki-on-accent, #232323)}
    .xtsel{display:flex;flex-direction:column;gap:8px}
    /* Personer (Fiks 15.11): rad = avatar 40 · navn/status · ▲▼ · vis/skjul · chevron; utvidet innhold innrykket under avataren */
    .xpl{display:flex;flex-direction:column;gap:2px;padding:4px 10px;border-radius:24px;background:var(--ki-surface-3, #2f2f2f)}
    .xp{display:flex;flex-direction:column}
    .xp+.xp{border-top:1px solid rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.05*var(--ki-wa-k,1)),var(--ki-wa-max,1)))}
    .xph{display:flex;align-items:center;gap:6px;min-height:56px;padding:8px 0}
    .xpo{flex:1;min-width:0;display:flex;align-items:center;gap:10px;text-align:left}
    .xpw{position:relative;flex:none;display:block}
    .xpa{width:40px;height:40px;border-radius:20px;flex:none;display:grid;place-items:center;overflow:hidden;background:var(--ki-ctrl, #545454);font-weight:600;color:var(--ki-on-accent, #232323)}
    .xpa img{display:block;width:100%;height:100%;object-fit:cover;pointer-events:none}
    .xpbd{position:absolute;right:-3px;top:-3px;width:18px;height:18px;border-radius:9px;display:grid;place-items:center;box-shadow:0 0 0 2px var(--ki-surface-3, #2f2f2f);transition:background .3s}
    .xpt{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
    .xpt b{font-size:15px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .xpt i{font-style:normal;font-size:12px;color:var(--ki-text-mid, #979797);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .xph .sw{transform:scale(.9)}
    .xph .sw.on,.xnz .sw.on{background:linear-gradient(145deg, rgb(242 133 201) -10%, rgb(245 205 198) 100%)}
    .xpc{background:transparent;color:var(--ki-text-mid, #979797)}
    .xpc ha-icon{transition:transform .2s}
    .xpc.on ha-icon{transform:rotate(180deg)}
    .xpb{display:flex;flex-direction:column;gap:8px;padding:0 0 12px 50px}
    .xpb .f{background:var(--ki-popup, #282828);border-radius:18px}
    .xpb .f .inp{background:var(--ki-surface, #3a3a3a)}
    .xnf{display:flex;flex-direction:column;gap:4px}
    .xnl{font-size:12px;color:var(--ki-text-2, #afafaf);padding:0 4px}
    .xnp{position:relative;display:flex;align-items:center;gap:10px;min-height:52px;padding:6px 12px;border-radius:18px;background:var(--ki-popup, #282828);width:100%;text-align:left;cursor:pointer}
    .xnp:active{transform:scale(.99)}
    .xnm{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
    .xnm b{font-size:14px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .xnm i{font-style:normal;font-size:11px;color:var(--ki-text-3, #7f7f7f);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .xnp select{position:absolute;inset:0;width:100%;height:100%;margin:0;padding:0;border:0;opacity:0;cursor:pointer;font-size:16px;-webkit-appearance:none;appearance:none;background:transparent;color:var(--ki-on-accent, #232323)}
    .xpdel{height:40px;border-radius:20px;display:flex;align-items:center;justify-content:center;gap:6px;font-size:13px;font-weight:500;background:rgb(242 128 115 / 0.16);color:var(--ki-red-text, var(--red,#f28073))}
    /* Fiks 19.13: «Redigerer: bruker · enhet ▾» + Kopier fra / Tilbakestill + forhåndsvisning i enhetens bredde */
    .xprof{display:flex;flex-direction:column;gap:10px;padding:12px;margin:0 0 12px;border-radius:22px;background:var(--ki-surface, #3a3a3a)}
    .xpl1{display:flex;align-items:center;flex-wrap:wrap;gap:4px;font-size:14px;color:#c7c7c7;min-width:0}
    .xplab{margin-right:2px}
    .xpsel{position:relative;display:inline-flex;align-items:center;min-width:0;color:var(--ki-text, #fafafa);cursor:pointer}
    .xpsel b{font-weight:600;white-space:nowrap}
    .xpsel b i{font-style:normal;font-weight:500;font-size:11px;color:var(--ki-on-accent, #2f2f2f);background:${PINK};border-radius:8px;padding:1px 6px;margin-left:4px;vertical-align:2px}
    .xpsel select,.xpb2 select{position:absolute;inset:0;width:100%;height:100%;margin:0;padding:0;border:0;opacity:0;cursor:pointer;font-size:16px;-webkit-appearance:none;appearance:none;background:transparent;color:var(--ki-on-accent, #232323)}
    .xpdot{color:var(--ki-text, #fafafa)}
    .xpown{width:8px;height:8px;border-radius:4px;background:${PINK};margin-left:4px}
    .xpbtns{display:flex;gap:8px}
    .xpb2{position:relative;flex:1;min-width:0;height:38px;border-radius:19px;display:flex;align-items:center;justify-content:center;gap:6px;font-size:13px;font-weight:500;background:var(--ki-ctrl, #545454);color:var(--ki-text, #fafafa);white-space:nowrap}
    .xpb2[disabled],.xpb2.off{opacity:.45;pointer-events:none}
    .xpv{border-radius:16px;background:var(--ki-bg, #232323);overflow:hidden;padding:8px 8px 10px}
    .xprof .help{font-size:11px;color:var(--ki-text-mid, #979797);padding:0 4px}
  `;
  let XSHEET = null;
  const Base = customElements.get('msh-editor');
  if (Base && !customElements.get('msh-hjem-editor')) {
    class HjemEditor extends Base {
      constructor() {
        super(); this._ropen = {}; this._btns = {};
        this.shadowRoot.addEventListener('change', (e) => {
          const d = e.target && e.target.dataset;
          if (d && (d.tact || d.pact || d.np)) M.haptic('selection');
          if (d && d.tact && !d.name) this._setGest(d.tact, e.target.value); // Fiks 37
        });
        this.shadowRoot.addEventListener('focusout', (e) => { if (this._pend && e.target && e.target.tagName === 'SELECT') { this._pend = false; setTimeout(() => this._render(), 0); } });
        // Fiks 20.9: live forhåndsvisning (prosa) per tastetrykk – bare forhåndsvisningen tegnes, lagring skjer på change
        this.shadowRoot.addEventListener('input', (e) => {
          const t = e.target, L = this._liveF, n = t && t.dataset && t.dataset.name;
          if (!L || !n || !(t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
          const m = new RegExp('^' + L.live + '\\.(\\d+)\\.(.+)$').exec(n);
          if (!m) return;
          const f = this._findRows(L.live);
          if (!f) return;
          const list = this._rowsOf(f).map((x) => JSON.parse(JSON.stringify(x || {})));
          if (!list[+m[1]]) return;
          setIn(list[+m[1]], m[2], t.value === '' ? undefined : t.value);
          this._pzLive({ ...(this._config || {}), [L.live]: list });
        });
        // Fiks 19.13: bruker/enhet og «Kopier fra …» øverst
        this.shadowRoot.addEventListener('change', (e) => {
          const t = e.target, d = t && t.dataset;
          if (!d || !(d.psel || d.pcopy)) return;
          e.stopPropagation();
          M.haptic('selection');
          if (d.psel) { this._sel = { ...this._psel(), [d.psel]: t.value }; return this._render(); }
          const src = M.profileRaw(HPROF, t.value), key = this._pkey();
          if (!src) return;
          M.profileSet(HPROF, null, key);
          M.profileSet(HPROF, JSON.parse(JSON.stringify(src)), key);
          const [u, c] = t.value.split('/');
          M.toast('Kopiert fra ' + this._uName(u) + ' · ' + M.deviceClassName(c));
          this._render();
        });
      }
      _css() {
        if (this._cssOk || !this.shadowRoot) return;
        try {
          if (!XSHEET) { XSHEET = new CSSStyleSheet(); XSHEET.replaceSync(XCSS); }
          this.shadowRoot.adoptedStyleSheets = [...this.shadowRoot.adoptedStyleSheets, XSHEET];
          this._cssOk = true;
        } catch (e) { this._cssFallback = true; }
      }
      _render() {
        this._css();
        this._btns = {};
        this._scHold = null; this._rendering = true;
        // Fiks 37: header-config med eldre steder/tittel-handlinger vises (og lagres) med de nye nøklene
        if (this._config && this.cardClass && this.cardClass.cardName === 'Hjem · header' && SV.harGammel(this._config)) this._config = SV.cfg(this._config);
        // Fiks 19.13: feltene i PROF_KEYS viser verdien for valgt bruker × enhet (med arv); resten = kortets config
        const base = this._config;
        if (base && this._profOn()) { const P = M.hjemHeaderProfile(this._psel()), o = { ...base }; PROF_KEYS.forEach((k) => { if (P[k] != null) o[k] = k === 'status' ? mergeStatus(base.status, P.status) : P[k]; }); this._config = o; }
        this._liveF = null;
        try { super._render(); } finally { this._rendering = false; this._scHold = null; this._config = base; }
        if (this._liveF && M.prosaPreviewScroll) M.prosaPreviewScroll(this.shadowRoot); // Fiks 20.9
        this._pvSync();
        if (this.shadowRoot) this.shadowRoot.querySelectorAll('select[data-np]').forEach((el) => { if (el.value !== el.dataset.v) el.value = el.dataset.v; });
        // Personbilde som ikke laster → ikon/initialer (huskes per URL, som i headeren)
        if (this.shadowRoot) this.shadowRoot.querySelectorAll('.xpa img[data-pic]').forEach((img) => {
          if (img.__e) return;
          img.__e = true;
          const fail = () => { if ((this._picBad = this._picBad || new Set()).has(img.dataset.pic)) return; this._picBad.add(img.dataset.pic); this._render(); };
          img.addEventListener('error', fail);
          if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) setTimeout(fail, 0);
        });
        if (this.shadowRoot) {
          const A = M.hjemTitleActions(this._config || {});
          this.shadowRoot.querySelectorAll('[data-tact]').forEach((el) => { const v = A[el.dataset.tact]; if (el.value !== v) el.value = v; });
          const PA = M.hjemPersonActions(this._config || {});
          this.shadowRoot.querySelectorAll('[data-pact]').forEach((el) => { const v = PA[el.dataset.pact]; if (el.value !== v) el.value = v; });
        }
        if (this._cssFallback && this.shadowRoot && !this.shadowRoot.getElementById('xcss')) {
          const s = document.createElement('style'); s.id = 'xcss'; s.textContent = XCSS; this.shadowRoot.appendChild(s);
        }
      }
      // Fiks 20.9: tegn bare den levende forhåndsvisningen på nytt (utkast-config c) og scroll til delen som redigeres
      _pzLive(c) {
        const L = this._liveF, R = this.shadowRoot, old = R && R.querySelector('[data-pzprev]');
        if (!L || !old) return;
        let html = '';
        try { html = L.render(this._hass, c, this) || ''; } catch (e) { return; }
        const tmp = document.createElement('div'); tmp.innerHTML = html;
        const nb = tmp.querySelector('[data-pzprev] .pz'), ob = old.querySelector('.pz');
        if (nb && ob) { ob.innerHTML = nb.innerHTML; ob.setAttribute('style', nb.getAttribute('style') || ''); }
        if (M.prosaPreviewScroll) M.prosaPreviewScroll(R);
      }
      /* ---------- Fiks 19.13: header-profil per bruker × enhetsklasse ---------- */
      _profOn() { return !!(M.store && M.profileSet && M.deviceClass); }
      // Valgt profil: denne brukeren + denne enheten (forhåndsvalgt). Ikke-admin kan bare redigere egne profiler.
      _psel() {
        const h = this._hass, me = (h && h.user && h.user.id) || M.userId() || '*', admin = !!(h && h.user && h.user.is_admin);
        if (!this._sel) this._sel = { user: me, cls: M.deviceClass() };
        if (!admin && this._sel.user !== me) this._sel = { ...this._sel, user: me };
        return this._sel;
      }
      _pkey() { const s = this._psel(); return M.profileKey(s.user, s.cls); }
      // HA-brukere: deg selv; admin ser også de andre (config/auth/list, ellers personer med user_id)
      _profUsers() {
        const h = this._hass, L = [];
        const add = (id, name) => { if (id && !L.some((u) => u.id === id)) L.push({ id, name: name || id }); };
        if (h && h.user) add(h.user.id, h.user.name || 'Meg');
        if (h && h.user && h.user.is_admin) {
          (M._hdrUsers || []).forEach((u) => add(u.id, u.name));
          Object.keys(h.states).forEach((id) => { if (id.startsWith('person.')) { const a = h.states[id].attributes || {}; add(a.user_id, a.friendly_name); } });
          if (!M._hdrUsersP && h.callWS) {
            M._hdrUsersP = Promise.resolve().then(() => h.callWS({ type: 'config/auth/list' })).then((r) => {
              if (!Array.isArray(r)) return;
              M._hdrUsers = r.filter((u) => u && u.id && !u.system_generated && u.is_active !== false).map((u) => ({ id: u.id, name: u.name }));
              if (this.isConnected) this._render();
            }).catch(() => {});
          }
        }
        return L;
      }
      _uName(id) {
        if (!id || id === '*') return 'Alle brukere';
        const u = this._profUsers().find((x) => x.id === id);
        return u ? firstName(u.name) || u.name : id;
      }
      _pName(k) { const [u, c] = String(k).split('/'); return this._uName(u) + ' · ' + M.deviceClassName(c); }
      // Nærmeste nivå med egen profil etter det valgte (eller kortets oppsett)
      _inhName(sel) {
        const k = M.profileChain(sel).slice(1).find((x) => M.profileHas(HPROF, x));
        return k ? this._pName(k) : 'kortets oppsett';
      }
      _profBar() {
        if (!this._profOn()) return '';
        const h = this._hass, sel = this._psel(), admin = !!(h && h.user && h.user.is_admin), me = h && h.user ? h.user.id : null;
        const users = this._profUsers(), here = M.deviceClass(), R = M.store.get(HPROF) || {};
        const has = (k) => M.profileHas(HPROF, k);
        const uOpts = [...users.map((u) => [u.id, firstName(u.name) || u.name]), ...(admin ? [['*', 'Alle brukere']] : [])]
          .map(([v, l]) => `<option value="${esc(v)}" ${v === sel.user ? 'selected' : ''}>${Object.keys(R).some((k) => k.startsWith(v + '/') && has(k)) ? '● ' : ''}${esc(l)}</option>`).join('');
        const cOpts = [...M.DEVICE_CLASSES.map(([k]) => k), '*']
          .map((k) => `<option value="${k}" ${k === sel.cls ? 'selected' : ''}>${has(M.profileKey(sel.user, k)) ? '● ' : ''}${esc(M.deviceClassName(k) + (k === here ? ' · denne' : ''))}</option>`).join('');
        const key = M.profileKey(sel.user, sel.cls), own = has(key);
        const copy = Object.keys(R).filter((k) => k !== key && has(k) && (admin || k.startsWith(me + '/') || k.startsWith('*/')))
          .map((k) => `<option value="${esc(k)}">${esc(this._pName(k))}</option>`).join('');
        const W = M.deviceClassWidth(sel.cls === '*' ? here : sel.cls);
        return `<div class="xprof" data-key="xprof">
          <div class="xpl1"><span class="xplab">Redigerer:</span>
            <label class="xpsel"><b>${esc(this._uName(sel.user))}</b><select data-psel="user" aria-label="Bruker">${uOpts}</select></label><b class="xpdot">·</b>
            <label class="xpsel"><b>${esc(M.deviceClassName(sel.cls))}${sel.cls === here ? '<i>denne</i>' : ''}</b><select data-psel="cls" aria-label="Enhet">${cOpts}</select></label>
            ${M.icon('mdi:chevron-down', 18, 'color:var(--ki-text-2, #afafaf);flex:none')}${own ? '<span class="xpown" title="Egen profil"></span>' : ''}</div>
          <div class="xpbtns">
            <label class="xpb2 ${copy ? '' : 'off'}">${M.icon('mdi:content-copy', 16)}Kopier fra …<select data-pcopy="1" aria-label="Kopier fra" ${copy ? '' : 'disabled'}><option value="" selected disabled>Kopier fra …</option>${copy}</select></label>
            <button class="xpb2" data-a="x-preset" ${own ? '' : 'disabled'}>${M.icon('mdi:backup-restore', 16)}Tilbakestill til arvet</button>
          </div>
          <div class="xpv" data-nomorph data-w="${W}"></div>
          <span class="help">${own ? 'Egen profil for dette valget.' : 'Arver fra ' + esc(this._inhName(sel)) + '.'} Forhåndsvisning i ${W} px bredde.</span>
        </div>`;
      }
      // Forhåndsvisning: headeren i valgt enhetsklasses bredde (iPhone 393 … PC 1280), skalert ned til arket
      _pvSync() {
        const box = this.shadowRoot && this.shadowRoot.querySelector('.xpv');
        if (!box || !this._hass || !this._config || !customElements.get('msh-hjem-header-card')) return;
        let inner = box.firstElementChild;
        if (!inner) { inner = document.createElement('div'); inner.className = 'xpvi'; inner.appendChild(document.createElement('msh-hjem-header-card')); box.appendChild(inner); }
        const card = inner.firstElementChild, sel = this._psel(), W = M.deviceClassWidth(sel.cls === '*' ? M.deviceClass() : sel.cls);
        const ps = { user: sel.user, cls: sel.cls === '*' ? M.deviceClass() : sel.cls };
        const { card_id, ...cfg } = this._config;
        const j = JSON.stringify(cfg) + '|' + ps.user + '/' + ps.cls;
        card._profSel = ps;
        card.mshFold = W >= 600;
        if (card.__pvJ !== j) { card.__pvJ = j; card._hFit = null; card._hN = 0; try { card.setConfig({ ...cfg, type: 'custom:msh-hjem-header-card', __eff: 1 }); } catch (e) { /* */ } }
        if (card.hass !== this._hass) card.hass = this._hass;
        else if (card.update) card.update();
        const fit = () => {
          const avail = box.clientWidth - 16 || 340, sc = Math.min(1, avail / W);
          inner.style.cssText = `width:${W}px;transform:scale(${sc.toFixed(4)});transform-origin:0 0;pointer-events:none;margin-bottom:${-Math.round(inner.offsetHeight * (1 - sc))}px`;
        };
        fit(); requestAnimationFrame(fit); setTimeout(fit, 250);
      }
      _findRows(name, list) {
        for (const f of list || this.schema) {
          if (f.type === 'rows' && f.name === name) return f;
          if (f.fields && f.type !== 'rows') { const r = this._findRows(name, f.fields); if (r) return r; }
        }
        return null;
      }
      _rowsOf(f) {
        const c = this._config || {}, v = get(c, f.name);
        let list;
        if (Array.isArray(v)) list = v;
        else if (v && typeof v === 'object' && f.toList) { try { list = f.toList(v, this._hass); } catch (e) { list = []; } }
        else { try { list = (f.defaults && f.defaults(this._hass, c)) || []; } catch (e) { list = []; } }
        if (f.norm) { try { list = f.norm(list, c); } catch (e) { /* */ } }
        if (f.kind === 'people' && !this._noProf && this._profOn()) list = profPeople(list, M.hjemHeaderProfile(this._psel())); // Fiks 19.13
        return list;
      }
      _val(path) {
        const m = /^(\w+)\.(\d+)\.(.+)$/.exec(path || '');
        if (m) { const f = this._findRows(m[1]); if (f) return get(this._rowsOf(f)[+m[2]] || {}, m[3]); }
        return get(this._config || {}, path);
      }
      _set(path, v, commit) {
        if (this._profOn() && /^status\./.test(path || '')) { // Fiks 20.5: Status og soner → valgt profil (hele status-objektet)
          const P = M.hjemHeaderProfile(this._psel()), st = mergeStatus((this._config || {}).status, P.status) || {};
          const [, k, fld] = String(path).split('.');
          if (k && fld) { st[k] = { ...(st[k] || {}) }; if (v === '' || v == null) delete st[k][fld]; else st[k][fld] = v; }
          M.profileSet(HPROF, { status: mergeStatus(st) }, this._pkey(), { commit: commit !== false });
          return this._render();
        }
        if (this._profOn() && PROF_KEYS.includes(path)) { // Fiks 19.13: valgt profil, lagres straks (ikke med i Ferdig/Avbryt)
          M.profileSet(HPROF, { [path]: v === '' ? undefined : v }, this._pkey(), { commit: commit !== false });
          return this._render();
        }
        const m = /^(\w+)\.(\d+)\.(.+)$/.exec(path || '');
        if (m) {
          const f = this._findRows(m[1]);
          if (f) {
            const list = this._rowsOf(f).map((x) => JSON.parse(JSON.stringify(x || {})));
            if (list[+m[2]]) setIn(list[+m[2]], m[3], v);
            return this._rowsSave(f, list, commit);
          }
        }
        return super._set(path, v, commit);
      }
      // Rader lagres som liste, eller i feltets eget format (fromList, f.eks. zones-map)
      _rowsSave(f, list, commit) {
        if (f.kind === 'people' && this._profOn()) {
          // Fiks 19.13: rekkefølge og skjulte personer gjelder valgt profil; personene og feltene deres er felles
          M.profileSet(HPROF, { people_order: list.map((r) => r && r.person).filter(Boolean), people_hidden: list.filter((r) => r && r.hidden && r.person).map((r) => r.person) }, this._pkey(), { commit: commit !== false });
          this._noProf = true;
          let baseRows;
          try { baseRows = this._rowsOf(f); } finally { this._noProf = false; }
          const bi = new Map(baseRows.map((r, i) => [r && r.person, i])), hid = new Map(baseRows.map((r) => [r && r.person, !!(r && r.hidden)]));
          const pos = (r, i) => (r && bi.has(r.person) ? bi.get(r.person) : 1e4 + i);
          list = list.map((r, i) => [r || {}, i]).sort((a, b) => pos(a[0], a[1]) - pos(b[0], b[1])).map(([r]) => { const o = { ...r }; if (hid.get(r.person)) o.hidden = true; else delete o.hidden; return o; });
          const J = (l) => JSON.stringify(l.map((r) => { const o = { ...(r || {}) }; delete o.home_switch; if (o.zone === true) delete o.zone; return o; }));
          if (J(list) === J(baseRows)) return this._render();
        }
        if (f.kind === 'people') {
          // Én kanonisk modell: people[]. Eldre overrides.hjemme_/sover_<id> er flyttet inn i radene (norm) og fjernes her.
          const ov = { ...((this._config || {}).overrides || {}) };
          let ch = false;
          list = list.map((r) => {
            const o = { ...(r || {}) };
            delete o.home_switch;
            if (o.zone === true) delete o.zone;
            if (o.person) ['hjemme_', 'sover_'].forEach((k) => { const key = k + objId(o.person); if (key in ov) { delete ov[key]; ch = true; } });
            return o;
          });
          if (ch) this._config = { ...this._config, overrides: ov };
        }
        return super._set(f.name, f.fromList ? f.fromList(list) : list, commit);
      }
      // Live status i Personer-radene: tegn på nytt når personene, bryterne, søvn eller sonene endrer seg.
      set hass(h) {
        const first = !this._hass;
        super.hass = h;
        if (first || !this._config) return;
        let sig = '';
        try { sig = this._liveSig(h); } catch (e) { sig = ''; }
        if (sig === this._sig) return;
        this._sig = sig;
        const a = this.shadowRoot && this.shadowRoot.activeElement;
        if (a && a.tagName === 'SELECT') { this._pend = true; return; } // OS-velgeren er åpen – tegnes ved blur
        this._render();
      }
      get hass() { return this._hass; }
      _liveSig(h) {
        const f = this._findRows('people');
        if (!f || !h) return '';
        const ids = [];
        this._rowsOf(f).forEach((r) => { if (r && r.person) ids.push(r.person, r.home, r.sleep || M.hjemSleepAuto(h, r.person)); });
        Object.keys(h.states).forEach((id) => { if (id.startsWith('zone.')) ids.push(id); });
        return ids.map((id) => (id && h.states[id] ? id + '=' + h.states[id].state : '')).join('|');
      }
      // Skjemaet regnes ut én gang per tegning (felt med rad-stier slår opp radene flere ganger)
      get schema() {
        if (this._rendering && this._scHold) return this._scHold;
        const sc = super.schema;
        if (this._rendering) this._scHold = sc;
        return sc;
      }
      // Handlinger på tittelen: tre rader med en pille som er en usynlig native <select> (OS-velgeren).
      // HA GUI-editoren: ha-selector select per gest.
      // Fiks 22.7: pers = «Handlinger på personbilder» (person_actions, data-pact), samme UI.
      _titleActs(pers) {
        const A = pers ? M.hjemPersonActions(this._config || {}) : M.hjemTitleActions(this._config || {});
        const [ACTS0, GESTS, L, DEF, key, dk, rk] = pers ? [PACTS, PGESTS, PACT_L, PACT_DEF, 'person_actions', 'data-pact', 'pa'] : [TACTS, TGESTS, TACT_L, { tap: 'server', double_tap: 'config', hold: 'kiosk' }, 'title_actions', 'data-tact', 'ta'];
        // Fiks 37: tittelen lagrer server_meny_med + greeting_*_action (ingen data-name – _setGest skriver begge)
        const ACTS = (g) => (pers ? ACTS0 : ACTS0.filter(([k]) => k !== 'egen' || A[g] === 'egen'));
        const nm = (g) => (pers ? `data-name="${key}.${g}"` : '');
        if (pers && !this._inline && customElements.get('ha-selector')) {
          const sel = JSON.stringify({ select: { mode: 'dropdown', options: ACTS0.map(([v, l]) => ({ value: v, label: l })) } });
          return `<div class="xtsel">${GESTS.map(([g, l]) => `<div class="f"><ha-selector data-name="${key}.${g}" ${dk}="${g}" data-nomorph data-selector="${esc(sel)}" data-label="${esc(l)}" data-helper="Standard: ${esc(L[DEF[g]])}"></ha-selector></div>`).join('')}</div>`;
        }
        return `<div class="xta">${GESTS.map(([g, l, ic]) => {
          const v = A[g];
          return `<div class="xtr" data-key="${rk}-${g}"><span class="ti">${M.icon(ic, 20)}</span><b>${esc(l)}</b><label class="xpill ${v === 'none' ? 'none' : ''}"><span>${esc(L[v])}</span>${M.icon('mdi:unfold-more-horizontal', 16, 'color:var(--ki-text-2, #afafaf);flex:none')}<select ${nm(g)} ${dk}="${g}" aria-label="${esc(l)}">${ACTS(g).map(([k, kl]) => `<option value="${k}" ${k === v ? 'selected' : ''}>${esc(kl)}</option>`).join('')}</select></label></div>`;
        }).join('')}</div>`;
      }
      // Fiks 37: valg i «Handlinger på tittelen» → server_meny_med / greeting_<gest>_action (eldre nøkler skrives om først)
      _setGest(g, v) {
        if (!g || !v || v === 'egen') return;
        const c = SV.cfg(this._config || {});
        this._config = c;
        if (v === 'server') return this._set('server_meny_med', g);
        if (SV.menyMed(c) === g) this._config = { ...c, server_meny_med: 'ingen' };
        const P = SV.PRESET[v];
        this._set('greeting_' + g + '_action', P ? P(c) : { action: 'none' });
      }
      _field(f, key) {
        // Felt med rad-sti (people.0.home) utenfor radene («Bytt entiteter»): les fra radlisten (også standardradene)
        const rm = f.name && !this._inRows ? /^(\w+)\.\d+\./.exec(f.name) : null;
        const rf = rm ? this._findRows(rm[1]) : null;
        if (rf) {
          const saved = this._config;
          this._config = { ...saved, [rf.name]: this._rowsOf(rf) };
          this._inRows = true;
          try { return this._field(f, key); } finally { this._inRows = false; this._config = saved; }
        }
        const h = this._hass, c = this._config || {};
        if (f.when) { let ok = true; try { ok = f.when(h, c); } catch (e) { /* */ } if (!ok) return ''; }
        const lab = f.label ? `<label>${esc(f.label)}</label>` : '';
        const help = f.help ? `<span class="help">${esc(f.help)}</span>` : '';
        switch (f.type) {
          case 'rows': return this._rows(f, key);
          case 'xstat': return this._statRow(f, key);
          case 'titleacts': return this._titleActs();
          case 'personacts': return this._titleActs(true);
          case 'profilebar': return this._profBar();
          case 'modes': {
            let cur = get(c, f.name) != null ? String(get(c, f.name)) : String(f.default || '');
            if (!f.options.some(([v]) => String(v) === cur)) cur = String(f.default || ''); // fjernet oppsett (under/kompakt) → standard
            return `<div class="f" style="background:transparent;padding:4px 0">${lab}<div class="xmodes">${f.options.map(([v, l, ic, sub]) => `<button class="xmode ${String(v) === cur ? 'on' : ''}" data-a="sel" data-name="${esc(f.name)}" data-v="${esc(v)}"><span class="iw">${M.icon(ic, 20)}</span><b>${esc(l)}</b><i>${esc(sub || '')}</i></button>`).join('')}</div>${help}</div>`;
          }
          case 'range': {
            // Felles range (presets + enhet; ha-selector i HA GUI-editoren) når feltet er skrevet for msh-editor
            if (f.presets || f.unit) return super._field(f, key);
            const v = get(c, f.name) != null ? Number(get(c, f.name)) : Number(f.default);
            return `<div class="f"><div class="line" style="justify-content:space-between;font-size:13px"><span style="color:#c7c7c7">${esc(f.label)}</span><b style="font-weight:500" class="num">${esc(f.fmt ? f.fmt(v) : v)}</b></div><input type="range" class="xrng" data-name="${esc(f.name)}" data-num="1" min="${f.min}" max="${f.max}" step="${f.step || 1}" value="${v}">${help}</div>`;
          }
          case 'tokens':
            return `<div class="xtoks">${(f.tokens || []).map(([l, t, pre]) => `<button class="xtok" data-a="x-tok" data-name="${esc(f.target)}" data-v="${esc(t)}" data-pre="${pre ? 1 : 0}">${esc(l)}</button>`).join('')}</div>`;
          case 'swatches': {
            const cur = get(c, f.name) != null ? String(get(c, f.name)) : String(f.default || '');
            return `<div class="f">${lab}<div class="xsw">${f.options.map(([v, css, l]) => `<button class="${String(v) === cur ? 'on' : ''}" title="${esc(l)}" style="background:${css}" data-a="sel" data-name="${esc(f.name)}" data-v="${esc(v)}"></button>`).join('')}</div>${help}</div>`;
          }
          case 'html': { if (f.live) this._liveF = f; try { return f.render(h, c, this) || ''; } catch (e) { return ''; } }
          case 'button':
            this._btns[key] = f;
            return `<button class="xbtn" data-a="x-btn" data-k="${esc(key)}">${f.icon ? M.icon(f.icon, 18) : ''}${esc(f.label)}</button>`;
          default: return super._field(f, key);
        }
      }
      /* Fiks 20.5: «Status og soner» – Hjemme / Sover / Borte som sone-radene (ikon-sirkel i valgt farge + navn),
       * åpen: ikonvelger (rutenett + «Alle ikoner») og fargevelger (tema- og HA-farger). Kan ikke slettes/flyttes. */
      _statRow(f, key) {
        const c = this._config || {}, k = f.k, S = M.hjemStatusStyle(c, k), open = this._ropen.__status === k;
        const T = { home: ['Hjemme', 'Personen er i zone.home'], sleep: ['Sover', 'Når sove-sensoren er på'], away: ['Borte · annen sone', 'Ikke hjemme og ikke i en av sonene over'] }[k];
        const AUTO = { home: HOME_ST, sleep: SLEEP_ST, away: { icon: AWAY_ICON, color: AWAY_COL } }[k];
        const head = `<div class="xr ${open ? 'on' : ''}" data-key="xst-${k}"><span class="xchip" style="background:${S.color};transition:background .3s">${M.icon(S.icon, 18, 'color:var(--ki-text, #fafafa)')}</span>
          <button class="xrh" data-a="x-sopen" data-k="${k}"><b>${esc(T[0])}</b><i>${esc(T[1] + (S.own ? '' : ' · standard'))}</i></button>
          <button class="xsq" data-a="x-sopen" data-k="${k}">${M.icon(open ? 'mdi:chevron-up' : 'mdi:chevron-down', 18)}</button></div>`;
        if (!open) return `<div class="f" style="background:transparent;padding:2px 0"><div class="xrows">${head}</div></div>`;
        // Borte: eldre zone_away vises som verdi til den lagres som status.away
        const saved = this._config, za = k === 'away' ? ((saved && (saved.zone_away || saved.zAway)) || {}) : {};
        const cur = statusCfg(saved, k);
        this._config = { ...saved, status: { ...((saved && saved.status) || {}), [k]: { icon: cur.icon || za.icon, color: cur.color || za.color } } };
        let body = '';
        try {
          body = this._field({ type: 'icon', name: `status.${k}.icon`, label: 'Ikon', auto: () => M.iconName ? M.iconName(AUTO.icon) : AUTO.icon }, `${key}_i`)
            + this._field({ type: 'color', name: `status.${k}.color`, label: 'Farge', auto: () => AUTO.color }, `${key}_c`);
        } finally { this._config = saved; }
        return `<div class="f" style="background:transparent;padding:2px 0"><div class="xrows">${head}<div class="xrb" data-key="xst-${k}-b">${body}</div></div></div>`;
      }
      _rows(f, key) {
        if (f.kind === 'people') return this._peopleRows(f, key);
        const h = this._hass, saved = this._config || {};
        const list = this._rowsOf(f);
        const open = this._ropen[f.name];
        this._config = { ...saved, [f.name]: list };
        let body = '';
        try {
          body = list.map((r, i) => {
            const t = f.title ? f.title(r, i, h, saved) : (r.name || r.id || `#${i + 1}`);
            const sub = f.sub ? f.sub(r, i, h, saved) : '';
            const isOpen = open === i;
            const head = `<div class="xr ${isOpen ? 'on' : ''}" style="${r && r.hidden ? 'opacity:.55' : ''}" data-key="${esc(f.name)}-${i}">
              ${f.chip ? f.chip(r, i, h, saved) : ''}
              <button class="xrh" data-a="x-ropen" data-n="${esc(f.name)}" data-i="${i}"><b>${esc(t)}</b>${sub ? `<i>${esc(sub)}</i>` : ''}</button>
              ${f.sortable === false ? '' : `<button class="xsq" data-a="x-rmv" data-n="${esc(f.name)}" data-i="${i}" data-d="-1" ${i ? '' : 'disabled'}>${M.icon('mdi:chevron-up', 18)}</button><button class="xsq" data-a="x-rmv" data-n="${esc(f.name)}" data-i="${i}" data-d="1" ${i < list.length - 1 ? '' : 'disabled'}>${M.icon('mdi:chevron-down', 18)}</button>`}
              ${f.hide ? `<button class="xsq" data-a="x-rhide" data-n="${esc(f.name)}" data-i="${i}">${M.icon(r && r.hidden ? 'mdi:eye-off' : 'mdi:eye', 18, `color:${r && r.hidden ? 'var(--ki-text-lo, #696969)' : 'var(--ki-text, #fafafa)'}`)}</button>` : ''}
              <button class="xsq del" data-a="x-rdel" data-n="${esc(f.name)}" data-i="${i}" title="Slett">${M.icon('mdi:delete', 18)}</button></div>`;
            if (!isOpen) return head;
            const sub2 = (f.fields || []).filter((sf) => { try { return !sf.rowWhen || sf.rowWhen(r || {}, h, saved); } catch (e) { return true; } }).map((sf, j) => {
              const nf = { ...sf, rowWhen: undefined };
              if (sf.name) nf.name = `${f.name}.${i}.${sf.name}`;
              if (sf.target) nf.target = `${f.name}.${i}.${sf.target}`;
              if (sf.run) nf.run = () => sf.run(r || {}, h, saved);
              if (sf.render) nf.render = () => sf.render(r || {}, h, saved);
              if (sf.auto) nf.auto = (hh) => sf.auto(r || {}, hh || h, saved); // auto per rad (f.eks. prosa ent_override)
              return this._field(nf, `${key}_${i}_${j}`);
            }).join('');
            return head + `<div class="xrb" data-key="${esc(f.name)}-b${i}">${sub2}</div>`;
          }).join('');
        } finally { this._config = saved; }
        return `<div class="f" style="background:transparent;padding:4px 0">${f.label ? `<label>${esc(f.label)}</label>` : ''}<div class="xrows">${body || '<span class="small">Ingen</span>'}
          ${f.newRow ? `<button class="xadd" data-a="x-radd" data-n="${esc(f.name)}">${M.icon('mdi:plus', 20)}${esc(f.addLabel || 'Legg til')}</button>` : ''}</div>${f.help ? `<span class="help">${esc(f.help)}</span>` : ''}</div>`;
      }
      /* Entitetsvelger med usynlig native <select> over (OS-velgeren): ikon · navn · entity_id · chevron.
       * o: { name, value, label, auto, autoLabel, autoSub, domains, re, slugs, required, placeholder, key }
       * Valg: «Automatisk (auto)» (ikke required) → Forslag (id matcher re og navnet) → resten alfabetisk. */
      _natPick(o) {
        const h = this._hass, cur = o.value || '', st = cur ? h.states[cur] : null;
        const nm = (id) => (h.states[id] && h.states[id].attributes.friendly_name) || id;
        const ids = Object.keys(h.states).filter((id) => o.domains.includes(id.split('.')[0]));
        const byName = (a, b) => nm(a).localeCompare(nm(b), 'nb') || a.localeCompare(b);
        const sug = o.re ? ids.filter((id) => o.re.test(id) && (!o.slugs || o.slugs.some((x) => x && id.includes(x)))).sort(byName) : [];
        const rest = ids.filter((id) => !sug.includes(id)).sort(byName);
        const opt = (id) => `<option value="${esc(id)}"${id === cur ? ' selected' : ''}>${esc(nm(id) + ' · ' + id)}</option>`;
        const first = o.required ? `<option value=""${cur ? '' : ' selected'} disabled>${esc(o.placeholder || 'Velg …')}</option>` : `<option value=""${cur ? '' : ' selected'}>${esc(`${o.autoLabel || 'Automatisk'} (${o.auto || 'fant ingen'})`)}</option>`;
        const miss = cur && !st ? `<option value="${esc(cur)}" selected>${esc(cur + ' · finnes ikke')}</option>` : '';
        const opts = first + miss + (sug.length ? `<optgroup label="Forslag">${sug.map(opt).join('')}</optgroup>` : '') + (rest.length ? `<optgroup label="${sug.length ? 'Alle' : 'Velg'}">${rest.map(opt).join('')}</optgroup>` : '');
        const ic = cur ? M.domainIcon(cur, st) : o.required ? 'mdi:magnify' : 'mdi:auto-fix';
        const b = cur ? nm(cur) : o.required ? (o.placeholder || 'Velg …') : (o.autoLabel || 'Automatisk');
        const i = cur ? cur + (st ? '' : ' · finnes ikke') : o.required ? '' : (o.autoSub || o.auto || 'fant ingen');
        return `<div class="xnf" data-key="${esc(o.key)}">${o.label ? `<span class="xnl">${esc(o.label)}</span>` : ''}<label class="xnp">${M.icon(ic, 22, 'color:var(--ki-text-2, #afafaf);flex:none')}<span class="xnm"><b>${esc(b)}</b>${i ? `<i>${esc(i)}</i>` : ''}</span>${M.icon('mdi:chevron-down', 20, 'color:var(--ki-text-mid, #979797);flex:none')}<select data-name="${esc(o.name)}" data-np="1" data-v="${esc(cur)}" aria-label="${esc(o.label || b)}">${opts}</select></label></div>`;
      }
      // Personer (dashbordets ark og GUI-editoren): avatar · navn · live status · ▲▼ · vis/skjul · chevron. Én rad åpen om gangen.
      _peopleRows(f, key) {
        const h = this._hass, saved = this._config || {};
        const list = this._rowsOf(f);
        const open = this._ropen[f.name];
        const cfg = { ...saved, [f.name]: list };
        this._config = cfg;
        this._inRows = true;
        let body = '';
        try {
          body = list.map((r, i) => {
            r = r || {};
            const pid = r.person && h.states[r.person] ? r.person : null;
            const p = pid ? M.hjemPersonInfo(h, pid, cfg) : null;
            const name = r.person ? M.name(h, r.person) || objId(r.person) : 'Velg person';
            const first = firstName(name);
            const status = !r.person ? 'person.*' : !p ? 'Finnes ikke' : p.sleep ? 'Sover' : p.status.kind === 'unknown' ? '–' : p.place;
            const isOpen = open === i, hid = !!r.hidden;
            const av = p ? `<span class="xpa" style="background:${p.bg};font-size:${faceTxt(p, this._picBad) ? 16 : 0}px">${faceInner(p, 40, this._picBad)}</span>` : `<span class="xpa">${M.icon('mdi:account', 22, 'color:var(--ki-text-mid, #979797)')}</span>`;
            const bd = p && p.badge ? `<span class="xpbd" style="background:${p.stCol}">${M.icon(p.glyph, 11, 'color:var(--ki-text, #fafafa)')}</span>` : '';
            const sq = (d, on) => `<button class="xsq" data-a="x-rmv" data-n="${esc(f.name)}" data-i="${i}" data-d="${d}" ${on ? '' : 'disabled'}>${M.icon(d < 0 ? 'mdi:chevron-up' : 'mdi:chevron-down', 20)}</button>`;
            const head = `<div class="xph" style="${hid ? 'opacity:.55' : ''}">
                <button class="xpo" data-a="x-ropen" data-n="${esc(f.name)}" data-i="${i}"><span class="xpw">${av}${bd}</span><span class="xpt"><b>${esc(name)}</b><i class="xps">${esc(status)}${hid ? ' · skjult' : ''}</i></span></button>
                ${sq(-1, i > 0)}${sq(1, i < list.length - 1)}
                <button class="sw ${hid ? '' : 'on'}" role="switch" aria-checked="${!hid}" aria-label="Vis ${esc(name)}" data-a="x-rhide" data-n="${esc(f.name)}" data-i="${i}"></button>
                <button class="xsq xpc ${isOpen ? 'on' : ''}" data-a="x-ropen" data-n="${esc(f.name)}" data-i="${i}" aria-expanded="${isOpen}" aria-label="Utvid ${esc(name)}">${M.icon('mdi:chevron-down', 22)}</button></div>`;
            if (!isOpen) return `<div class="xp" data-key="${esc(f.name)}-${i}">${head}</div>`;
            const pre = `${f.name}.${i}`;
            const slugs = r.person ? [objId(r.person), M.slug(first)] : null;
            const sa = r.person ? M.hjemSleepAuto(h, r.person) : null;
            const zOn = r.zone !== false;
            const extra = (f.fields || []).filter((sf) => { try { return !sf.rowWhen || sf.rowWhen(r, h, saved); } catch (e) { return true; } }).map((sf, j) => {
              const nf = { ...sf, rowWhen: undefined };
              if (sf.name) nf.name = `${pre}.${sf.name}`;
              if (sf.auto) nf.auto = (hh) => sf.auto(r, hh || h, saved);
              return this._field(nf, `${key}_${i}_${j}`);
            }).join('');
            const inner = [
              this._natPick({ key: `np-${i}-home`, name: `${pre}.home`, value: r.home, label: `${first || name} · hjemme`, auto: r.person || 'person.*', autoSub: `${r.person || 'person.*'} · GPS og soner`, domains: HOME_DOMS, re: PRES_RE, slugs }),
              this._natPick({ key: `np-${i}-sleep`, name: `${pre}.sleep`, value: r.sleep, label: `${first || name} · søvn`, auto: sa, domains: SLEEP_DOMS, re: SLEEP_RE, slugs }),
              `<div class="xnf" data-key="np-${i}-zone"><button class="xnp xnz" data-a="x-pzone" data-n="${esc(f.name)}" data-i="${i}" role="switch" aria-checked="${zOn}">${M.icon('mdi:map-marker-radius', 22, 'color:var(--ki-text-2, #afafaf);flex:none')}<span class="xnm"><b>Bruk HA-sone når borte</b><i>${zOn ? 'Bryter av + i en sone → sonens ikon og farge' : 'Av → vanlig «Borte»'}</i></span><span class="sw ${zOn ? 'on' : ''}"></span></button></div>`,
              this._natPick({ key: `np-${i}-person`, name: `${pre}.person`, value: r.person, label: 'Person', domains: ['person'], required: true, placeholder: 'Velg person …' }),
              extra,
              `<button class="xpdel" data-a="x-rdel" data-n="${esc(f.name)}" data-i="${i}">${M.icon('mdi:delete', 18)}Fjern fra headeren</button>`,
            ].join('');
            return `<div class="xp on" data-key="${esc(f.name)}-${i}">${head}<div class="xpb" data-key="${esc(f.name)}-b${i}">${inner}</div></div>`;
          }).join('');
        } finally { this._config = saved; this._inRows = false; }
        return `<div class="f" style="background:transparent;padding:4px 0">${f.label ? `<label>${esc(f.label)}</label>` : ''}<div class="xpl">${body || '<span class="small">Ingen</span>'}</div>
          ${f.newRow ? `<button class="xadd" style="margin-top:6px" data-a="x-radd" data-n="${esc(f.name)}">${M.icon('mdi:account-plus', 20)}${esc(f.addLabel || 'Legg til')}</button>` : ''}</div>`;
      }
      _click(e) {
        const b = e.composedPath().find((n) => n.dataset && n.dataset.a);
        if (!b || b.dataset.a.indexOf('x-') !== 0) return super._click(e);
        M.haptic('light');
        const d = b.dataset, f = d.n ? this._findRows(d.n) : null;
        const list = f ? this._rowsOf(f).map((x) => JSON.parse(JSON.stringify(x || {}))) : [];
        const i = Number(d.i);
        switch (d.a) {
          case 'x-pzsel': this._ropen.prose = i; this._render(); { const el = this.shadowRoot.querySelector('[data-key="prose-' + i + '"]'); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } return;
          case 'x-sopen': this._ropen.__status = this._ropen.__status === d.k ? null : d.k; return this._render();
          case 'x-ropen': this._ropen[d.n] = this._ropen[d.n] === i ? null : i; return this._render();
          case 'x-rmv': { const j = i + Number(d.d); if (j < 0 || j >= list.length) return; [list[i], list[j]] = [list[j], list[i]]; if (this._ropen[d.n] === i) this._ropen[d.n] = j; M.haptic('selection'); return this._rowsSave(f, list); }
          case 'x-pzone': if (list[i].zone === false) delete list[i].zone; else list[i].zone = false; return this._rowsSave(f, list);
          case 'x-rhide': list[i].hidden = !list[i].hidden; if (!list[i].hidden) delete list[i].hidden; return this._rowsSave(f, list);
          case 'x-rdel': list.splice(i, 1); if (this._ropen[d.n] === i) this._ropen[d.n] = null; return this._rowsSave(f, list);
          case 'x-radd': { let r = {}; try { r = f.newRow(this._hass, this._config || {}, list) || {}; } catch (x) { /* */ } list.push(r); this._ropen[d.n] = list.length - 1; return this._rowsSave(f, list); }
          case 'x-preset': { // Fiks 19.13: slett nivået → arves fra neste
            const sel = this._psel();
            M.profileSet(HPROF, null, this._pkey());
            M.toast('Tilbakestilt – arver fra ' + this._inhName(sel));
            return this._render();
          }
          case 'x-tok': { const cur = String(this._val(d.name) || ''); const v = d.pre === '1' ? d.v + cur : `${cur} ${d.v}`.trim(); return this._set(d.name, v); }
          case 'x-btn': { const bf = this._btns[d.k]; if (bf && bf.run) { try { bf.run(this._hass, this._config, this); } catch (x) { M.toast('Feil: ' + x.message); } } return; }
          default:
        }
      }
    }
    customElements.define('msh-hjem-editor', HjemEditor);
  }
  // Kortets egen tilpasning med den utvidede editoren (samme flyt som MSH.Card.customize).
  M.hjemCustomize = function (card, focus) {
    const tag = customElements.get('msh-hjem-editor') ? 'msh-hjem-editor' : 'msh-editor';
    const r = M.openEditor(card, { cardClass: card.constructor, focus, tag });
    return r && r.overlay;
  };
  M.hjemEditorEl = function (cls) {
    const e = document.createElement(customElements.get('msh-hjem-editor') ? 'msh-hjem-editor' : 'msh-editor');
    e.cardClass = cls;
    return e;
  };

  /* Fiks 47 C · navbar-profilen «Liquid Glass» (msh-navbar-card style: 'glass', speilet til <html data-ki-glass>; uten navbar
   * på siden: ki-store cards.ki-navbar.style). NB: ikke MSH.glassOn – den slår også inn via Liquid Glass-temaet for arkene. */
  M.navGlassOn = function () {
    const d = document.documentElement.dataset.kiGlass;
    if (d === '1' || d === '0') return d === '1';
    try { const c = M.store && M.store.card && M.store.card('ki-navbar'); return !!(c && c.style === 'glass'); } catch (e) { return false; }
  };
  /* ------------------------------------------------------------ hurtigark: felles ramme */
  const SHEET_CSS = `
    .sh{overflow:visible;width:calc(100% - 40px);max-width:300px;padding:62px 14px 14px;border-radius:30px;background:var(--ki-surface, var(--gray200,#3a3a3a));box-shadow:inset 0 1px 0 rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.08*var(--ki-wa-k,1)),var(--ki-wa-max,1))),0 30px 60px rgb(0 0 0/max(var(--ki-ka-min,0),calc(0.5*var(--ki-ka-k,1))))}
    /* Fiks 23.1: arket ligger i ki-overlay-root (document.body, ingen transform/overflow/contain over seg) og selve arket
       klipper ikke (contain: none, overflow: visible) → avataren (96, top −48, ring) vises alltid helt. Plassering innenfor
       ledig flate: --ki-nav-occ-* (navbaren, 23.3) + dashbordets topp (--ki-hy) og vertens venstre-forskyvning (--ki-hx,
       rail). Toppen ≥ occ-top + 48 + 12, bunnen ≥ occ-bottom + 12. Sentrert i det som er igjen (margin auto, høyde =
       innholdet); lav skjerm → max-height, og innholdet under navnet (.scr) scroller – ikke arket, så avataren ikke klippes. */
    :host{--ki-q-t:calc(var(--ki-hy,0px) + max(var(--ki-nav-occ-top,0px), env(safe-area-inset-top,0px)) + 60px);--ki-q-b:calc(max(var(--ki-nav-occ-bottom,0px), env(safe-area-inset-bottom,0px)) + 12px);
      --ki-q-l:max(0px, var(--ki-nav-occ-left,0px) - var(--ki-hx,0px));--ki-q-r:var(--ki-nav-occ-right,0px)}
    .sh{display:flex;flex-direction:column;contain:none;overflow:visible;top:var(--ki-q-t);bottom:var(--ki-q-b);left:var(--ki-q-l);right:var(--ki-q-r);margin:auto;width:300px;max-width:calc(100% - var(--ki-q-l) - var(--ki-q-r) - 40px);
      height:-webkit-fit-content;height:fit-content;max-height:calc(100% - var(--ki-q-t) - var(--ki-q-b));transform:scale(.96)}
    :host(.on) .sh{transform:none}
    .body{flex:0 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain}
    .scr{display:flex;flex-direction:column;gap:10px;flex:0 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y}
    .body:has(> .scr){overflow:visible}
    .scr>*,.body>*{flex-shrink:0} .body>.scr{flex-shrink:1}
    .body{display:flex;flex-direction:column;gap:10px}
    .orb{position:absolute;left:50%;top:-48px;transform:translateX(-50%);width:96px;height:96px;border-radius:48px;display:grid;place-items:center;overflow:hidden}
    .orb.pic{background-size:cover;background-position:center;font-size:36px;font-weight:600;color:var(--ki-on-accent, #232323)}
    .orb.pic img{display:block;width:100%;height:100%;object-fit:cover}
    .nm{display:flex;flex-direction:column;align-items:center;gap:3px;padding-bottom:4px;text-align:center}
    .nm b{font-size:22px;font-weight:600;letter-spacing:-0.01em}
    .nm span{font-size:13px;color:var(--ki-text-3, var(--gray600,#7f7f7f))}
    .seg{position:relative;display:grid;grid-template-columns:1fr 1fr;padding:4px;border-radius:26px;background:var(--ki-bg, var(--gray000,#232323));touch-action:none;user-select:none;cursor:pointer}
    .seg .ind{position:absolute;top:4px;bottom:4px;width:calc((100% - 8px) / 2);border-radius:22px;pointer-events:none;transition:left .5s cubic-bezier(.34,1.4,.64,1),transform .45s cubic-bezier(.34,1.8,.64,1),background .35s}
    .seg.drag .ind{background:linear-gradient(180deg,rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.3*var(--ki-wa-k,1)),var(--ki-wa-max,1))),rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.1*var(--ki-wa-k,1)),var(--ki-wa-max,1))))!important;box-shadow:inset 0 1px 0 rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.6*var(--ki-wa-k,1)),var(--ki-wa-max,1))),inset 0 0 0 .5px rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.35*var(--ki-wa-k,1)),var(--ki-wa-max,1))),0 8px 20px rgb(0 0 0/max(var(--ki-ka-min,0),calc(0.35*var(--ki-ka-k,1))));transform:scale(1.08,1.12);transition:transform .25s cubic-bezier(.34,1.8,.64,1),background .2s}
    .seg .o{position:relative;z-index:1;height:48px;border-radius:22px;display:flex;align-items:center;justify-content:center;gap:8px;font-size:14px;font-weight:600;color:var(--ki-text-2, #afafaf);transition:color .25s}
    .seg .o.on{color:var(--ki-on-accent, #232323)}
    .seg.ro{cursor:default}
    .seg.off{opacity:.45}
    .hint{margin-top:-4px;font-size:12px;line-height:1.3;color:var(--ki-text-3, var(--gray600,#7f7f7f));text-align:center}
    .opts{display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:4px;border-radius:26px;background:var(--ki-bg, var(--gray000,#232323))}
    .opt{height:48px;border-radius:22px;display:flex;align-items:center;justify-content:center;gap:6px;font-size:14px;font-weight:500;color:var(--ki-text-mid, #979797);transition:background .25s}
    .lst{display:flex;flex-direction:column;padding:4px 10px;border-radius:22px;background:var(--ki-bg, var(--gray000,#232323))}
    .li{display:flex;align-items:center;gap:10px;height:44px;border-top:1px solid rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.05*var(--ki-wa-k,1)),var(--ki-wa-max,1)));text-align:left;width:100%}
    .li:first-child{border-top:0;height:48px}
    .li .t{flex:1;font-size:14px;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .li .v{font-size:13px;color:var(--ki-text-2, var(--gray800,#afafaf))}
    .trk{position:relative;width:44px;height:26px;border-radius:13px;flex:none;background:var(--ki-surface, var(--gray200,#3a3a3a));transition:background .2s}
    .trk.on{background:var(--pink,#f285c9)}
    .trk i{position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:10px;background:var(--ki-knob, #fafafa);transition:left .2s}
    .trk.on i{left:21px}
    .done{height:52px;border-radius:26px;background:${PINK};color:var(--ki-on-accent, #2f2f2f);font-size:15px;font-weight:600}
    .more{height:36px;display:flex;align-items:center;justify-content:center;gap:4px;font-size:13px;color:var(--ki-text-mid, var(--gray700,#979797))}
    button:active{transform:scale(.97)}
    /* Fiks 47 C · Liquid Glass (Hjem v3 · quick.glass / glassSeg GL) – KUN når navbar-profilen «Liquid Glass» er valgt
       (M.navGlassOn). Ellers solid #3a3a3a, spor #232323 og ingen glans (reglene over). */
    :host(.lgq) .bg{background:rgb(0 0 0/max(var(--ki-ka-min,0),calc(0.35*var(--ki-ka-k,1))));backdrop-filter:none;-webkit-backdrop-filter:none}
    .sh.lg{background:var(--ki-glass, rgba(52,52,56,0.42));backdrop-filter:blur(28px) saturate(190%) brightness(1.08);-webkit-backdrop-filter:blur(28px) saturate(190%) brightness(1.08);box-shadow:inset 0 1px 0 rgb(255 255 255/0.35),inset 0 -1px 1px rgb(255 255 255/0.08),inset 0 0 0 0.5px rgb(255 255 255/0.22),0 30px 60px rgb(0 0 0/max(var(--ki-ka-min,0),calc(0.5*var(--ki-ka-k,1))))}
    .sh.lg::before{content:'';position:absolute;inset:0;border-radius:inherit;background:linear-gradient(180deg,rgb(255 255 255/0.14),rgb(255 255 255/0.02) 40%,rgb(255 255 255/0.05));pointer-events:none;z-index:-1}
    .sh.lg .seg{background:rgb(0 0 0/max(var(--ki-ka-min,0),calc(0.28*var(--ki-ka-k,1))));box-shadow:inset 0 1px 2px rgb(0 0 0/max(var(--ki-ka-min,0),calc(0.3*var(--ki-ka-k,1)))),inset 0 0 0 0.5px rgb(255 255 255/0.08)}
    .sh.lg .seg:not(.drag) .ind{background-image:linear-gradient(180deg,rgb(255 255 255/0.32),rgb(255 255 255/0) 55%)!important;box-shadow:inset 0 1px 0 rgb(255 255 255/0.5),inset 0 -1px 1px rgb(0 0 0/0.12),0 4px 12px rgb(0 0 0/max(var(--ki-ka-min,0),calc(0.25*var(--ki-ka-k,1))))}
    @supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){.sh.lg{background:var(--ki-surface, #3a3a3a)}} @container style(--ki-perf: lite){.sh.lg{background:var(--ki-surface, #3a3a3a)}} /* ytelsesmodus (00-b-perf.js): samme reserve uten blur */
    @keyframes pop{from{transform:translateY(-40%) scale(.9);opacity:0}}
  `;
  // Åpner et sentrert hurtigark. render() → html, onAct(name, el, sheet) håndterer data-a. Oppdateres av kortet via sheet.update().
  // glass (valgfri, funksjon → bool): Liquid Glass-utseende på arket (Fiks 47 C, person-hurtigarket) – følges live.
  M.hjemSheet = function (card, { render, onAct, drag, glass }) {
    const gl0 = glass ? !!glass() : undefined;
    const ov = M.overlay({ html: render(), css: SHEET_CSS, center: true, sheet: false, maxWidth: 300, ...(glass ? { glass: gl0 } : {}) });
    const lg = () => { if (!glass) return; const g = !!glass(), shEl = ov.root.querySelector('.sh'); if (shEl) shEl.classList.toggle('lg', g); ov.host.classList.toggle('lgq', g); };
    lg();
    const sheet = { ov, update() { if (ov.host.isConnected) { lg(); M.morph(ov.body, render()); } } };
    if (glass) window.addEventListener('ki-glass-change', sheet.update);
    // Fiks 23.1: vertens forskyvning mot dashbordflaten (topp: HA-toolbar; venstre: rail-utsparing i M.overlay) – arket
    // trekker den fra --ki-nav-occ-* (målt mot dashbord-containeren). Følger resize, orientering og ny navbar-måling.
    const fit = () => { if (!ov.host.isConnected) return; const D = M.dashRect(), hr = ov.host.getBoundingClientRect(); ov.host.style.setProperty('--ki-hy', Math.max(0, Math.round(D.top)) + 'px'); ov.host.style.setProperty('--ki-hx', Math.max(0, Math.round(hr.left - D.left)) + 'px'); };
    fit(); requestAnimationFrame(fit);
    ['resize', 'orientationchange', 'ki-nav-rect'].forEach((t) => window.addEventListener(t, fit));
    ov.root.addEventListener('click', (e) => {
      const el = e.target.closest && e.target.closest('[data-a]');
      if (!el) return;
      M.haptic(el.dataset.haptic || 'light');
      if (el.dataset.a === 'close') return ov.close();
      onAct && onAct(el.dataset.a, el, sheet, e);
    });
    if (drag) ov.root.addEventListener('pointerdown', (e) => { const seg = e.target.closest && e.target.closest('.seg[data-seg]'); if (seg && !seg.classList.contains('ro')) drag(seg, e, sheet); });
    card._sheets = card._sheets || new Set();
    card._sheets.add(sheet);
    const close0 = ov.close;
    ov.close = () => { card._sheets.delete(sheet); ['resize', 'orientationchange', 'ki-nav-rect'].forEach((t) => window.removeEventListener(t, fit)); if (glass) window.removeEventListener('ki-glass-change', sheet.update); close0(); };
    return sheet;
  };
  // Glass-segment: dra indikatoren, slipp → velg nærmeste. pick(i)
  M.hjemSegDrag = function (seg, e, pick) {
    const r = seg.getBoundingClientRect(), n = 2, ind = seg.querySelector('.ind');
    const xOf = (ev) => M.clamp((ev.clientX - r.left - 4) / Math.max(1, r.width - 8), 0, 1);
    const place = (x) => { const pos = M.clamp(x, 0.5 / n, 1 - 0.5 / n); if (ind) ind.style.left = `calc(4px + (100% - 8px) * ${pos - 0.5 / n})`; };
    try { seg.setPointerCapture(e.pointerId); } catch (x) { /* */ }
    seg.classList.add('drag');
    let last = Math.floor(xOf(e) * n);
    place(xOf(e));
    const mv = (ev) => { place(xOf(ev)); const k = Math.min(n - 1, Math.floor(xOf(ev) * n)); if (k !== last) { last = k; M.haptic('selection'); } };
    const up = (ev) => {
      seg.removeEventListener('pointermove', mv); seg.removeEventListener('pointerup', up); seg.removeEventListener('pointercancel', up);
      seg.classList.remove('drag');
      const i = Math.min(n - 1, Math.floor(xOf(ev) * n));
      if (ind) ind.style.left = '';
      seg.__dragged = true; setTimeout(() => { seg.__dragged = false; }, 50);
      pick(i);
    };
    seg.addEventListener('pointermove', mv); seg.addEventListener('pointerup', up); seg.addEventListener('pointercancel', up);
  };

  /* ------------------------------------------------------------ dørlås-hurtigark (lock.*) */
  const devSib = (hass, id, test) => {
    const e = M.regEntry(hass, id);
    if (!e || !e.device_id) return null;
    return Object.keys(hass.entities || {}).find((x) => x !== id && hass.entities[x].device_id === e.device_id && hass.states[x] && test(x, hass.states[x])) || null;
  };
  M.hjemLockAuto = (hass) => M.all(hass, 'lock')[0] || null;
  M.hjemLockSheet = function (card, lockId) {
    lockId = lockId || M.hjemLockAuto(card.hass);
    if (!lockId) { M.hjemToast(card, 'Fant ingen dørlås'); return null; }
    let spin = 0;
    const R = () => card.s ? card.s.bind(card) : (id) => card.hass.states[id];
    const render = () => {
      const s = R()(lockId), h = card.hass;
      const L = !s || s.state === 'locked' || s.state === 'locking';
      const busy = s && (s.state === 'locking' || s.state === 'unlocking');
      const col = L ? C.green : C.orange;
      const name = M.name(h, lockId);
      const auto = devSib(h, lockId, (x) => /auto/.test(x) && /^(switch|input_boolean)\./.test(x));
      const bat = devSib(h, lockId, (x, st) => st.attributes.device_class === 'battery' && x.startsWith('sensor.'));
      const batV = bat ? M.num(h, bat) : (s && M.isNum(s.attributes.battery_level) ? Number(s.attributes.battery_level) : null);
      const aOn = auto && R()(auto) && R()(auto).state === 'on';
      const by = s && (s.attributes.changed_by || s.attributes.last_changed_by);
      const t = s ? new Date(s.last_changed).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' }) : '–';
      const opt = (on, icon, label, c, act) => `<button class="opt" data-a="${act}" data-haptic="success" style="${on ? `background:${M.alpha(c, 0.18)};color:var(--ki-text, #fafafa);box-shadow:inset 0 0 0 1px ${M.alpha(c, 0.4)}` : ''}">${M.icon(icon, 19, `color:${on ? c : 'var(--ki-text-3, #7f7f7f)'}`)}${label}</button>`;
      return `<button class="orb" data-a="toggle" data-haptic="success" style="background:${M.alpha(col, 0.2)};box-shadow:0 0 0 6px var(--ki-surface, var(--gray200,#3a3a3a)),0 12px 30px ${M.alpha(col, 0.35)};transition:background .4s,box-shadow .4s">
          <span style="position:absolute;inset:6px;border-radius:50%;background:conic-gradient(${col} ${L ? 360 : 90}deg, transparent 0);-webkit-mask:radial-gradient(circle, transparent 38px, #000 39px);mask:radial-gradient(circle, transparent 38px, #000 39px);transform:rotate(${spin * 360}deg);transition:transform .8s cubic-bezier(.34,1.3,.64,1),background .4s"></span>
          ${M.icon(L ? 'lock' : 'lock_open', 40, `position:relative;color:${M.theme ? M.theme.accentText(col) : col};transform:${L ? 'scale(1)' : 'scale(1.08) rotate(-8deg)'};transition:transform .5s cubic-bezier(.34,1.8,.64,1),color .3s`)}
        </button>
        <div class="nm"><b>${!s ? '–' : busy ? (L ? 'Låser …' : 'Låser opp …') : L ? 'Låst' : 'Ulåst'}</b><span>${esc(name)} · ${L ? 'sikret' : 'åpen for inngang'}</span></div>
        <div class="opts">${opt(L, 'lock', 'Lås', C.green, 'lock')}${opt(!L, 'lock_open', 'Lås opp', C.orange, 'unlock')}</div>
        <div class="lst">
          <button class="li" data-a="auto" ${auto ? '' : 'disabled'}>${M.icon('lock_clock', 20, 'color:var(--ki-text-mid, #979797)')}<span class="t">${auto ? esc(M.name(h, auto, name)) : 'Autolås'}</span>${auto ? `<span class="trk ${aOn ? 'on' : ''}"><i></i></span>` : '<span class="v">–</span>'}</button>
          <div class="li">${M.icon('battery_5_bar', 20, 'color:var(--ki-text-mid, #979797)')}<span class="t">Batteri</span><span class="v num">${batV != null ? M.nf(batV, 0) + ' %' : '–'}</span></div>
          <div class="li">${M.icon('history', 20, 'color:var(--ki-text-mid, #979797)')}<span class="t">${L ? 'Låst' : 'Låst opp'}${by ? ' av ' + esc(by) : ''}</span><span class="v num">${esc(t)}</span></div>
        </div>
        <button class="done" data-a="close">Ferdig</button>`;
    };
    const run = (lock) => {
      const s = card.hass.states[lockId];
      if (!lock && s && s.attributes.code_format) { M.moreInfo(card, lockId); return; }
      spin++;
      M.call(card.hass, 'lock', lock ? 'lock' : 'unlock', { entity_id: lockId }).then(() => M.hjemToast(card, lock ? 'Dørlås låst' : 'Dørlås låst opp')).catch(() => {});
    };
    return M.hjemSheet(card, {
      render,
      onAct(a, el, sheet) {
        const s = card.hass.states[lockId], L = !s || s.state === 'locked';
        if (a === 'toggle') run(!L);
        if (a === 'lock') run(true);
        if (a === 'unlock') run(false);
        if (a === 'auto') { const au = devSib(card.hass, lockId, (x) => /auto/.test(x) && /^(switch|input_boolean)\./.test(x)); if (au) M.toggle(card.hass, au); }
        sheet.update();
      },
    });
  };

  /* ------------------------------------------------------------ personer og soner */
  const PCOLS = ['orange', 'pink', 'blue', 'green', 'purple', 'yellow', 'red', 'light-blue'].map((k) => C[k.replace(/-(\w)/g, (_, x) => x.toUpperCase())]);
  // Standardpalett for soner uten egen farge: stabil hash av sone-ID → My SmartHome-farge (grønn er forbeholdt Hjemme).
  // (rekkefølgen gir f.eks. zone.skole → blå)
  const ZPAL = [C.purple, C.orange, C.pink, C.yellow, C.red, C.lightBlue, C.blue, C.lime].filter(Boolean);
  const ZCOLS = ZPAL;
  const ZICONS = ['location_city', 'stethoscope', 'apartment', 'agriculture', 'sailing', 'work', 'school', 'cottage', 'fitness_center', 'flight', 'home', 'shopping_cart', 'restaurant', 'local_hospital', 'directions_car', 'logout'];
  const HOME_ST = { icon: 'mdi:home', color: C.green };
  // Fiks 20.5: standard for «Borte · annen sone» (Status og soner). Sover: bedtime lilla.
  const AWAY_ICON = 'mdi:airplane', AWAY_COL = C.purple;
  const SLEEP_ST = { icon: 'bedtime', color: C.purple };
  /* Fiks 20.5: «Status og soner» – status: { home: { icon, color }, sleep: { icon, color }, away: { icon, color } }
   * (del av header-profilen, 19.13). Borte leser også eldre zone_away / zAway. */
  const statusCfg = (c, k) => { const s = c && c.status && typeof c.status === 'object' ? c.status[k] : null; return s && typeof s === 'object' ? s : {}; };
  M.hjemStatusStyle = function (c, k) {
    const z = statusCfg(c, k);
    if (k === 'home') return { icon: z.icon || HOME_ST.icon, color: M.color(z.color, null) || HOME_ST.color, own: !!(z.icon || z.color) };
    if (k === 'sleep') return { icon: z.icon || SLEEP_ST.icon, color: M.color(z.color, null) || SLEEP_ST.color, own: !!(z.icon || z.color) };
    const a = { ...((c && (c.zone_away || c.zAway)) || {}), ...Object.fromEntries(Object.entries(z).filter(([, v]) => v)) };
    return { icon: a.icon || AWAY_ICON, color: M.color(a.color, null) || AWAY_COL, own: !!(a.icon || a.color) };
  };
  // Status-objektet slås sammen per tilstand (kortets config ← profil), så én tilstand i profilen ikke fjerner de andre.
  const mergeStatus = (a, b) => {
    const out = {};
    [a, b].forEach((s) => { if (s && typeof s === 'object') Object.keys(s).forEach((k) => { out[k] = { ...(out[k] || {}), ...(s[k] || {}) }; }); });
    Object.keys(out).forEach((k) => { Object.keys(out[k]).forEach((f) => { if (out[k][f] == null || out[k][f] === '') delete out[k][f]; }); if (!Object.keys(out[k]).length) delete out[k]; });
    return Object.keys(out).length ? out : undefined;
  };
  M.hjemZonePal = function (zid) {
    let h = 0;
    for (const ch of String(zid || '')) h = (h * 31 + ch.codePointAt(0)) >>> 0;
    return ZPAL[h % ZPAL.length];
  };
  // Sone-oppsett i config: zones: { 'zone.skole': { icon, color } } (også eldre liste [{ zone, icon, color }]).
  const zoneCfg = (c, zid) => {
    const z = c && c.zones;
    if (!z || !zid) return {};
    if (Array.isArray(z)) return z.find((x) => x && x.zone === zid) || {};
    return (typeof z === 'object' && (z[zid] || z[String(zid).replace(/^zone\./, '')])) || {};
  };
  // Ikon og farge for en sone. zone.home er låst til Hjemme-stilen (grønt hus).
  M.hjemZoneStyle = function (hass, c, zid, rd) {
    if (zid === 'zone.home') { const H = M.hjemStatusStyle(c, 'home'); return { icon: H.icon, color: H.color }; }
    const st = zid ? (rd ? rd(zid) : hass && hass.states[zid]) : null;
    const z = zoneCfg(c, zid);
    return { icon: z.icon || (st && st.attributes.icon) || 'mdi:map-marker', color: M.color(z.color, null) || M.hjemZonePal(zid) };
  };
  const autoZones = (hass) => M.all(hass, 'zone', (s, id) => id !== 'zone.home').map((id) => ({ zone: id }));
  const firstName = (n) => String(n || '').trim().split(/\s+/)[0] || '';
  const clampN = (v, lo, hi, d) => { const n = Number(v); return v === '' || v == null || !isFinite(n) ? d : Math.max(lo, Math.min(hi, n)); };
  const objId = (id) => String(id).split('.')[1];
  const SLEEP_RE = /sov|sleep|seng|natt/;
  const PRES_RE = /hjemme|home|tilstede|presence/;
  const sibling = (hass, pid, re, doms) => {
    const slug = objId(pid);
    // = filter(domene, slug, re, usable).sort()[0] – via M.all (sortert, mellomlagret domeneliste; ytelse)
    return M.all(hass, doms, (s, id) => id.includes(slug) && re.test(id))[0] || null;
  };
  const DISPLAYS = ['picture', 'icon', 'initials'];
  const HOME_DOMS = ['switch', 'input_boolean', 'binary_sensor'], SLEEP_DOMS = ['input_boolean', 'binary_sensor', 'switch'];
  /* Personoppsett (Fiks 15.11) – kanonisk modell: people: [{ person, home, sleep, zone, use_gps_when_off, display, picture, hidden }]
   *   home  = hjemme-bryter (switch/input_boolean/binary_sensor; tom = Automatisk → person.* og sonene)
   *   sleep = søvn-entitet (tom = Automatisk → *_sover/*_sleep ved siden av personen)
   *   zone  = «Bruk HA-sone når borte» (standard på; lagres bare som false)
   * Leses bakoverkompatibelt: people[].home_switch, overrides.hjemme_<id> / overrides.sover_<id> og
   * persons: { <id>: { home, sleep, zone, display, picture } } (map). Editorene skriver alltid til people[]. */
  const personsMap = (c) => (c && c.persons && typeof c.persons === 'object' && !Array.isArray(c.persons) ? c.persons : null);
  const pmOf = (c, id) => { const m = personsMap(c); return (m && (m[objId(id)] || m[id])) || {}; };
  // people-rad → normalisert rad (eldre felt flyttet inn, home_switch fjernet). Ren funksjon.
  M.hjemPeopleNorm = function (c, r) {
    if (!r || typeof r !== 'object') return r;
    const { home_switch: hs, ...o } = r;
    if (!o.person) { if (!o.home && hs) o.home = hs; return o; }
    const pm = pmOf(c, o.person), ov = (c && c.overrides) || {}, k = objId(o.person);
    if (!o.home) { const v = hs || pm.home || ov['hjemme_' + k]; if (v) o.home = v; }
    if (!o.sleep) { const v = pm.sleep || ov['sover_' + k]; if (v) o.sleep = v; }
    if (o.zone == null && pm.zone === false) o.zone = false;
    if (o.zone === true) delete o.zone;
    return o;
  };
  // people: [{ person, home, sleep, zone, … }] – raden for en person (eller null).
  M.hjemPeopleRow = (c, id) => (Array.isArray(c && c.people) ? c.people : []).find((r) => r && r.person === id) || null;
  // Effektive valg for én person: { home, sleep, zone, use_gps_when_off } (home/sleep = null → Automatisk).
  M.hjemPersonOpts = function (c, id) {
    const r = M.hjemPeopleNorm(c, M.hjemPeopleRow(c, id) || { person: id }) || {};
    return { home: r.home || null, sleep: r.sleep || null, zone: r.zone !== false, use_gps_when_off: r.use_gps_when_off === true, sleep_invert: r.sleep_invert === true };
  };
  M.hjemPersonCfg = function (c, id) {
    const o = objId(id), list = Array.isArray(c && c.persons) ? c.persons : [];
    const y = list.find((x) => x && (x.entity === id || x.entity === o)) || {};
    const g = (c && c.persons_cfg && c.persons_cfg[o]) || {};
    const pm = pmOf(c, id);
    const r = M.hjemPeopleRow(c, id) || {};
    const out = { ...y };
    [{ display: pm.display, picture: pm.picture }, g, { display: r.display, picture: r.picture }].forEach((src) => Object.keys(src).forEach((k) => { if (src[k] != null && src[k] !== '') out[k] = src[k]; }));
    return out;
  };
  // Hjemme-bryteren til en person (se hjemPersonOpts). Aldri gjettet.
  M.hjemHomeSwitch = (c, id) => M.hjemPersonOpts(c, id).home;
  // Søvn-entiteten til en person: valgt (people[].sleep / eldre overrides.sover_<id>) eller søsken-entitet (*_sover, *_sleep …).
  M.hjemSleepAuto = (hass, id) => (hass ? sibling(hass, id, SLEEP_RE, ['input_boolean', 'binary_sensor', 'switch']) : null);
  // «Borte · annen sone» (Soner-seksjonen): zone_away: { icon, color } (designets zAway leses også).
  // Fiks 20.5: status.away (Status og soner) vinner over eldre zone_away.
  M.hjemAwayStyle = function (c) {
    const A = M.hjemStatusStyle(c, 'away');
    return { icon: A.icon, color: A.color, badge: c && c.away_marker != null ? c.away_marker === true : A.own };
  };
  /* Fiks 26.22 · statusmerket i Hilsen/Sted (ren funksjon): { icon, color } eller null (Hjemme / ukjent → ingen merke).
   *   Reiser/fly (sone/sted *fly*|travel|reise|airport) → lilla fly · Jobb/skole (*jobb*|work|skole|school|kontor|office) →
   *   blå kontorbygg · annen sone / Borte → blå kartnål · Sover → lilla måne. Egne farger/ikoner i «Status og soner»
   *   (hjemme, sover, borte, sone) vinner – et eget Hjemme-ikon gir merke også hjemme. info = M.hjemPersonInfo(…). */
  const HB_PURPLE = 'var(--purple, #ad99e6)', HB_BLUE = 'var(--blue, #73b9f2)';
  const HB_TRAVEL = /fly|travel|reise|airport|lufthavn/i, HB_WORK = /jobb|work|skole|school|kontor|office/i;
  M.hjemHilBadge = function (info, c) {
    const st = (info && info.status) || {};
    if (info && info.sleep) return info.sleepOwn ? { icon: info.glyph, color: info.stCol } : { icon: 'mdi:weather-night', color: HB_PURPLE };
    if (st.kind === 'zone') {
      const z = zoneCfg(c, st.zone);
      if (z.icon || z.color) return { icon: st.icon || 'mdi:map-marker', color: st.color || HB_BLUE };
      const key = `${st.zone || ''} ${st.place || ''}`;
      if (HB_TRAVEL.test(key)) return { icon: 'mdi:airplane', color: HB_PURPLE };
      if (HB_WORK.test(key)) return { icon: 'mdi:office-building', color: HB_BLUE };
      return { icon: 'mdi:map-marker', color: HB_BLUE };
    }
    if (st.kind === 'away') return M.hjemStatusStyle(c, 'away').own ? { icon: st.icon, color: st.color } : { icon: 'mdi:map-marker', color: HB_BLUE };
    if (st.kind === 'home' && M.hjemStatusStyle(c, 'home').own) return { icon: st.icon, color: st.color }; // eget Hjemme-ikon (20.5) vises
    return null;
  };
  /* Status for én person (ren funksjon – testbar). p = 'person.x' eller en people-rad. rd = state-leser (valgfri).
   * 1) Hjemme-bryter på → Hjemme (vinner over GPS/sone).
   * 2) person.* i en annen sone enn home og «Bruk HA-sone når borte» på (zone ≠ false) → sonens ikon + farge
   *    (Soner-seksjonen → standardpalett). zone: false → vanlig Borte.
   * 3) not_home, eller bryter av + GPS «home» (uten use_gps_when_off) → Borte: dempet, «Borte · annen sone»-utseendet
   *    (zone_away; merke bare med away_marker eller eget ikon/farge).
   * 4) Mangler person og bryter → ingen merke, aldri gjettet status.
   * → { kind: home|zone|away|unknown, src: switch|gps|none, icon, color, place, zone, badge, dim, switchId }
   * Fiks 20.5: + sleep (søvn-bryteren på), label («Sover» / «Hjemme» / sonen / «Borte») og når personen sover
   * er icon/color Sover-stilen (Status og soner). cfg utelatt → header-kortets effektive config (M.hjemHeaderCfg),
   * så andre kort (f.eks. kartet) kan kalle MSH.personStatus(hass, 'person.x') og få samme ikon/farge som headeren. */
  M.personStatus = function (hass, p, cfg, rd) {
    cfg = cfg || (M.hjemHeaderCfg && M.hjemHeaderCfg()) || {};
    rd = rd || ((x) => (hass && hass.states[x]) || null);
    const st = personStatus0(hass, p, cfg, rd);
    const pid = typeof p === 'string' ? p : p && p.person;
    const PO = pid ? M.hjemPersonOpts(cfg, pid) : {};
    const sid = pid ? PO.sleep || M.hjemSleepAuto(hass, pid) : null;
    const sl = sid ? rd(sid) : null;
    const sleep = !!sl && !M.unavailable(sl) && (sl.state === 'on') !== !!PO.sleep_invert;
    if (!sleep) return { ...st, sleep: false, sleepId: sid, label: st.place };
    const S = M.hjemStatusStyle(cfg, 'sleep');
    return { ...st, sleep: true, sleepId: sid, icon: S.icon, color: S.color, label: 'Sover' };
  };
  const personStatus0 = function (hass, p, cfg, rd) {
    rd = rd || ((x) => (hass && hass.states[x]) || null);
    const pid = typeof p === 'string' ? p : p && p.person;
    const base = pid ? M.hjemPeopleRow(cfg, pid) || { person: pid } : {};
    const row = M.hjemPeopleNorm(cfg, { ...base, ...(typeof p === 'object' && p ? p : {}) }) || {};
    const swId = row.home || null;
    const s = pid ? rd(pid) : null;
    const sw = swId ? rd(swId) : null;
    const swOk = !!sw && !M.unavailable(sw);
    const A = M.hjemAwayStyle(cfg);
    const H = M.hjemStatusStyle(cfg, 'home');
    const home = { kind: 'home', icon: H.icon, color: H.color, place: 'Hjemme', zone: 'zone.home', badge: true, dim: false, switchId: swId };
    const away = { kind: 'away', icon: A.icon, color: A.color, place: 'Borte', zone: null, badge: A.badge, dim: true, switchId: swId };
    if (swOk && sw.state === 'on') return { ...home, src: 'switch' };
    const pOk = !!s && !M.unavailable(s);
    if (!pOk) return swOk ? { ...away, src: 'switch' } : { kind: 'unknown', src: 'none', icon: null, color: null, place: '–', zone: null, badge: false, dim: false, switchId: swId };
    if (s.state === 'home') return swOk && row.use_gps_when_off !== true ? { ...away, src: 'switch' } : { ...home, src: 'gps' };
    if (s.state === 'not_home' || row.zone === false) return { ...away, src: swOk ? 'switch' : 'gps' };
    const all = hass && hass.states ? Object.keys(hass.states) : [];
    const zid = all.find((z) => z.startsWith('zone.') && z !== 'zone.home' && hass.states[z].attributes.friendly_name === s.state)
      || all.find((z) => z.startsWith('zone.') && z !== 'zone.home' && objId(z) === M.slug(s.state)) || null;
    const zs = zid ? (rd(zid), M.hjemZoneStyle(hass, cfg, zid, rd)) : { icon: 'mdi:map-marker', color: M.hjemZonePal('zone.' + M.slug(s.state)) };
    return { kind: 'zone', src: 'gps', icon: zs.icon, color: zs.color, place: zid ? hass.states[zid].attributes.friendly_name || s.state : s.state, zone: zid, badge: true, dim: false, switchId: swId };
  };
  // Bilde-URL: /local/… og /api/… via hass.hassUrl (riktig base i appen / ekstern tilgang).
  M.hjemPicUrl = function (hass, u) {
    u = String(u || '').trim();
    if (!u) return null;
    if (u[0] === '/' && u[1] !== '/' && hass && typeof hass.hassUrl === 'function') { try { return hass.hassUrl(u) || u; } catch (e) { return u; } }
    return u;
  };
  // Personer som vises: people-listen (rekkefølge + skjult) når den finnes, ellers autokonfig (person.*, include/exclude, person_order).
  M.hjemPersons = function (hass, c) {
    const all = M.all(hass, 'person');
    if (Array.isArray(c.people)) {
      const rows = c.people.filter((r) => r && typeof r.person === 'string' && r.person.startsWith('person.'));
      const ids = [...new Set(rows.map((r) => r.person))];
      const hid = new Set(rows.filter((r) => r.hidden).map((r) => r.person));
      return { all, ids, visible: ids.filter((x) => !hid.has(x)) };
    }
    const inc = (c.include && c.include.personer) || [];
    let ids = M.applyLists(c, 'personer', all);
    inc.forEach((x) => { if (!ids.includes(x)) ids.push(x); });
    const ord = Array.isArray(c.person_order) ? c.person_order.filter((x) => ids.includes(x)) : [];
    ids = [...ord, ...ids.filter((x) => !ord.includes(x))];
    const hid = new Set(c.hidden_persons || []);
    return { all, ids, visible: ids.filter((x) => !hid.has(x)) };
  };
  // Standardrader for «Personer» i editoren (før people er lagret): dagens personer med eldre valg.
  const peopleDefaults = (hass, c) => {
    if (!hass) return [];
    const P = M.hjemPersons(hass, { ...c, people: undefined }), hid = new Set(c.hidden_persons || []);
    return P.ids.map((id) => {
      const pc = M.hjemPersonCfg(c, id), r = { person: id };
      const o = M.hjemPersonOpts(c, id);
      if (o.home) r.home = o.home;
      if (o.sleep) r.sleep = o.sleep;
      if (!o.zone) r.zone = false;
      if (pc.display && pc.display !== 'picture') r.display = pc.display;
      if (pc.picture) r.picture = pc.picture;
      if (hid.has(id)) r.hidden = true;
      return r;
    });
  };
  M.hjemPersonInfo = function (hass, id, c, rd) {
    rd = rd || ((x) => hass.states[x]);
    const s = rd(id), a = (s && s.attributes) || {};
    const o = objId(id);
    const PO = M.hjemPersonOpts(c, id);
    const sleepId = PO.sleep || M.hjemSleepAuto(hass, id);
    const st = M.personStatus(hass, id, c, rd);
    // Hurtigarket (fiks 16.14): Hjemme/Borte skriver bare til valgt hjemme-bryter (people[].home). Uten bryter → bare visning.
    const presId = st.switchId || null;
    const home = st.kind === 'home';
    // Søvn: på = sover, eller omvendt med «På = våken» (people[].sleep_invert – noen Homey-brytere er omvendt)
    const sleepInv = PO.sleep_invert;
    const sleep = !!st.sleep;
    // Fiks 20.5: ikon/farge fra «Status og soner» (personStatus gir Sover-stilen når personen sover)
    const stCol = st.color || 'transparent';
    const glyph = st.icon || 'mdi:account';
    const sleepOwn = sleep && M.hjemStatusStyle(c, 'sleep').own;
    const all = M.all(hass, 'person');
    const me = !!(hass.user && a.user_id && a.user_id === hass.user.id);
    // Visning per person: people[] / persons_cfg.<object_id> (editorene) over persons: [{ entity, display, picture }] (YAML).
    const pc = M.hjemPersonCfg(c, id);
    const display = DISPLAYS.includes(pc.display) ? pc.display : 'picture';
    const raw = pc.picture || a.entity_picture || null;
    const pic = display === 'picture' && raw ? M.hjemPicUrl(hass, raw) : null;
    return { id, o, s, name: a.friendly_name || o, first: firstName(a.friendly_name || o), display, pic, icon: a.icon || 'mdi:account', initial: (a.friendly_name || o).trim().charAt(0).toUpperCase(), bg: PCOLS[Math.max(0, all.indexOf(id)) % PCOLS.length], home, sleep, place: st.place, stCol, glyph, badge: sleep || st.badge, dim: !sleep && st.dim, status: st, me, sleepId, presId, sleepInv, sleepOwn };
  };

  /* ------------------------------------------------------------ header-kortet */
  // Fiks 16.4: «Under» og «Kompakt» er fjernet (3 + 3 i rutenettet). Fiks 17.13: «Familie» er erstattet av «Hilsen».
  // Lagret under/kompakt/familie → hilsen (se _migrateMode).
  const OLD_MODES = ['under', 'kompakt', 'familie'];
  const modeOf = (c) => { const m = (c && c.mode) || 'hilsen'; return OLD_MODES.includes(m) ? 'hilsen' : m; };
  // Fiks 17.13/17.15: Hilsen og Sted = én rad, stor tittel + store bilder med status-merker (designets faces «hil»)
  const isHil = (m) => m === 'hilsen' || m === 'sted';
  // Fiks 26.22: hilsen 44 px/500 + menu-down 24 px på én linje; avatarer 80 px runde side om side (8 px, aldri overlapp);
  // statusmerke 34 px. Under 420 px dashbordbredde: 56 px avatarer og 26 px merke (HIL_NARROW). Maks 3 bilder + «+N».
  const HIL_DEF = { hFont: 44, hAv: 80, hBadge: 34, hGap: 8, hTGap: 16 };
  const HIL_NARROW = { w: 420, av: 56 / 80, badge: 26 / 34 }, HIL_MAX = 3;
  // Fiks 18.4: i Fold-oppsettet (fold = true) skaleres tekst, bilder og merker med 0,72 og mellomrom mellom bildene med 0,8
  // (58 → 42, 62 → 45, 24 → 17 px) – oppå brukerens egne verdier; config endres ikke.
  const hilSizes = (c, fold) => {
    const n = (k, lo, hi) => { const v = c && c[k] != null && c[k] !== '' ? Number(c[k]) : NaN; return isNaN(v) ? HIL_DEF[k] : Math.min(hi, Math.max(lo, v)); };
    const S = { font: n('hFont', 24, 72), av: n('hAv', 32, 96), badge: n('hBadge', 12, 40), gap: n('hGap', 0, 24), tgap: n('hTGap', 0, 48) };
    if (fold) { S.font = Math.round(S.font * 0.72); S.av = Math.round(S.av * 0.72); S.badge = Math.round(S.badge * 0.72); S.gap = Math.round(S.gap * 0.8); }
    return S;
  };
  /* Fiks 26.22 (erstatter 19.12-tilpasningen med overlapp/krymping av bildene): bildene har fast størrelse (80 px, 56 px når
   * dashbordet er smalere enn 420 px), står side om side med hGap (≥ 0, aldri overlapp) og vises maks 3 + «+N».
   * Får ikke hilsen + bilder plass på én rad: ① hilsenen krymper ned til 32 px ② bildene flyttes til egen rad under
   * (høyrejustert, wrap) og hilsenen får hele bredden igjen ③ først da kortes navnet med «…» (min. 26 px).
   * Fiks 37.4: før alt dette skjules ▾ (pil = false) når navn + pil ikke får plass i full størrelse.
   * W = radens bredde, tw1 = tekstbredde per px skrift, arr = ▾ + mellomrom (0 = ingen pil), n = antall personer.
   * → { fs, av, gap, k, bs, wrap, cut, pil } (k = bilder som vises; k < n → «+(n − k)»-sirkel etter dem) */
  const HIL_MIN = { fs: 32, wrapFs: 26 }, HIL_ARR = 28; // HIL_ARR = ▾ 24 px + 4 px mellomrom
  const hilBadge = (S, av, narrow) => Math.max(8, Math.min(Math.round(av / 2), narrow ? Math.round(S.badge * HIL_NARROW.badge) : S.badge));
  const fitHil = (W, tw1, arr, n, S, narrow) => {
    const av = narrow ? Math.round(S.av * HIL_NARROW.av) : S.av, gap = S.gap, bs = hilBadge(S, av, narrow);
    let k = Math.min(n, HIL_MAX);
    let a = arr;
    const R = (fs, wrap, cut) => ({ fs, av, gap, k, bs, wrap: !!wrap, cut: !!cut, pil: a === arr });
    if (!(W > 0) || !(tw1 > 0) || !n) return R(S.font);
    const row = (kk) => { const m = kk < n ? kk + 1 : kk; return m ? m * av + (m - 1) * gap + Math.round(bs * 0.25) : 0; };
    const fsIn = (w) => Math.min(S.font, Math.floor(((w - a - 2) / (tw1 * 1.01)) * 10) / 10);
    let one = fsIn(W - row(k) - S.tgap);
    if (one >= S.font) return R(one); // alt får plass – også pila
    a = 0; // Fiks 37.4 ⓪: får ikke navn + pil plass → pila skjules først (trykk på navnet åpner fortsatt menyen)
    one = fsIn(W - row(k) - S.tgap);
    if (one >= Math.min(S.font, HIL_MIN.fs)) return R(one);
    while (k > 1 && row(k) > W) k--; // egen rad: så mange bilder som får plass (normalt alle 3 + «+N»)
    const fs = fsIn(W), min = Math.min(S.font, HIL_MIN.wrapFs);
    return fs >= min ? R(fs, true) : R(min, true, true);
  };
  M.hjemFitHil = fitHil;
  // Fiks 19.13: header-profiler per bruker × enhetsklasse (ki-store header_profiles, MSH.profileGet/profileSet i
  // 00-base). Feltene i PROF_KEYS + personenes rekkefølge/skjulte (people_order / people_hidden) kan ha egen verdi per
  // profil; resten av configen (personer, soner, steder, hilsen …) er felles. Oppslag: bruker + enhet → bruker →
  // enhet → standard (*/*) → kortets config.
  const HPROF = 'header_profiles';
  const PROF_KEYS = ['mode', 'hFont', 'hAv', 'hBadge', 'hGap', 'hTGap', 'badge', 'size', 'show_name', 'show_place', 'ring_me', 'g_font', 'g_avatar', 'g_badge', 'g_gap', 'pic_size', 'persons_size', 'title_size', 'status'];
  const profPeople = (rows, P) => {
    let out = rows.map((r) => ({ ...(r || {}) }));
    if (Array.isArray(P.people_order)) {
      const o = P.people_order, ix = (r) => { const i = o.indexOf(r.person); return i < 0 ? o.length : i; };
      out = out.map((r, i) => [r, i]).sort((a, b) => (ix(a[0]) - ix(b[0])) || (a[1] - b[1])).map((x) => x[0]);
    }
    if (Array.isArray(P.people_hidden)) { const hs = new Set(P.people_hidden); out.forEach((r) => { if (hs.has(r.person)) r.hidden = true; else delete r.hidden; }); }
    return out;
  };
  const applyProf = (c, P, hass) => {
    const out = { ...c };
    PROF_KEYS.forEach((k) => { if (P[k] != null) out[k] = k === 'status' ? mergeStatus(c.status, P.status) : P[k]; });
    if (P.people_order || P.people_hidden) {
      const rows = Array.isArray(c.people) ? c.people : peopleDefaults(hass, c);
      if (rows.length) out.people = profPeople(rows, P);
    }
    return out;
  };
  M.hjemHeaderProfile = (sel) => (M.store && M.profileGet ? M.profileGet(HPROF, sel) : {});
  // Fiks 20.5: effektiv header-config for andre kort (kartet o.l.): siste header-kort på siden, ellers bare profilen.
  let lastHdr = null;
  M.hjemHeaderCfg = () => {
    if (lastHdr && lastHdr.isConnected) return lastHdr.config || {};
    const P = M.hjemHeaderProfile();
    return P && P.status ? { status: P.status } : {};
  };
  M.HJEM_HEADER_PROF_KEYS = PROF_KEYS;
  // Estimert tekstbredde i em (samme tegnvekt-estimat som Stor hilsen)
  const emWidth = (t) => [...String(t || '')].reduce((a, ch) => a + (/\s/.test(ch) ? 0.27 : /[iltjf!.,:;'|]/.test(ch) ? 0.3 : /[mwMW]/.test(ch) ? 0.82 : /[A-ZÆØÅ]/.test(ch) ? 0.64 : /[a-zæøå0-9?]/.test(ch) ? 0.56 : ch.codePointAt(0) > 0x2000 ? 1.15 : 0.55), 0);
  const MODES = [['hilsen', 'Hilsen', 'mdi:human-greeting-variant', 'Stor hilsen og store bilder på én linje'], ['sted', 'Sted', 'location_on', 'Stedsnavn og store bilder på én linje'], ['navn', 'Navn', 'person', 'Navnet ditt som tittel'], ['hjem', 'Hjem', 'home_pin', 'Sted, vær og personer'], ['stor', 'Stor hilsen', 'waving_hand', 'Stor hilsen og bilder side om side'], ['profil', 'Profil', 'account_circle', 'Stort sted, deg øverst og familien under']];
  // Innholdet i avatar-klippet: <img> (object-fit: cover) · ikon · initialer. Mangler/feiler bildet → ikon.
  const faceInner = (p, n, bad) => {
    if (p.pic && !(bad && bad.has(p.pic))) return `<img src="${esc(p.pic)}" alt="" draggable="false" data-pic="${esc(p.pic)}">`;
    if (p.display === 'initials') return esc(p.initial);
    return M.icon(p.icon || 'mdi:account', Math.round(n * 0.5), 'color:#232323');
  };
  const faceTxt = (p, bad) => p.display === 'initials' && !(p.pic && !(bad && bad.has(p.pic)));

  // 20.22/22.7: #kart finnes (strategien laget den / manuell popup) – ellers faller trykk tilbake til hurtigarket
  const kartOk = (h) => !!customElements.get('msh-kart-card') && (!M.allPopups || M.allPopups(h).some((p) => p.hash === '#kart'));
  class HjemHeader extends M.Card {
    static get cardName() { return 'Hjem · header'; }
    static get defaults() {
      return { mode: 'hilsen', ...HIL_DEF, greeting: '👋 {name}!', size: 'M', badge: 'icon', show_name: false, show_place: false, ring_me: false, weather_tap: true, weather_hash: '#vaer', g_font: 4.5, g_avatar: 50, g_badge: 20, g_gap: -8, pic_size: 60, persons_size: 46, title_size: 36, prose_gap: 16 };
    }
    static getConfigElement() { return M.hjemEditorEl(this); }
    static get schema() {
      return (hass, c) => {
        const D = HjemHeader.defaults;
        // Samme liste (og indekser) som Personer-radene i editoren: lagret people[] eller standardrader
        // Fiks 16.2: «Avstand til prosa» (header.prose_gap) – samme felt i «Tilpass Hjem» → Tekst. Brukes av msh-hjem-card.
        const PROSE_GAP = { type: 'range', name: 'prose_gap', label: 'Avstand til prosa', icon: 'mdi:arrow-expand-vertical', min: -20, max: 60, step: 2, default: D.prose_gap, unit: 'px', presets: M.HJEM_PROSE_GAP_PRESETS, help: 'Mellomrommet mellom headeren og prosaen. Minus trekker prosaen opp mot headeren.' };
        const PL = (Array.isArray(c && c.people) ? c.people : peopleDefaults(hass, c || {})).map((r) => M.hjemPeopleNorm(c || {}, r));
        return [
          { type: 'profilebar' }, // Fiks 19.13: «Redigerer: bruker · enhet ▾» (msh-hjem-editor)
          { type: 'modes', name: 'mode', label: 'Oppsett', options: MODES, default: D.mode },
          { type: 'section', id: 'title_actions', label: 'Handlinger på tittelen', icon: 'mdi:gesture-tap', meta: (h, cc) => { const A = M.hjemTitleActions(cc); return TACT_L[A.tap]; }, fields: [
            { type: 'titleacts' },
            { type: 'entity', name: 'kiosk_entity', label: 'Kiosk-modus-entitet', domain: 'input_boolean', auto: (h, cc) => ((cc.overrides || {}).kiosk) || KIOSK_DEF },
            { type: 'info', label: 'Standard: trykk åpner «Bytt sted», dobbelttrykk åpner innstillinger, hold slår kiosk-modus av/på. Hold uten handling åpner Tilpass header. Uten steder (Steder) åpnes ingen meny.' },
            { type: 'button', label: 'Kiosk-innstillinger', icon: 'mdi:fullscreen', run: () => M.kioskSheet && M.kioskSheet() }, // Fiks 22.9 (bryter-entiteten i arket vinner over kiosk_entity)
          ] },
          // Fiks 22.7: rett under «Handlinger på tittelen»
          { type: 'section', id: 'person_actions', label: 'Handlinger på personbilder', icon: 'mdi:account-circle', meta: (h, cc) => PACT_L[M.hjemPersonActions(cc).tap], fields: [
            { type: 'personacts' },
            { type: 'info', label: 'Standard: trykk åpner hurtigarket, langt trykk åpner person-popupen (#person-<id>), dobbelttrykk gjør ingenting.' },
          ] },
          { type: 'section', label: 'Størrelser', icon: 'mdi:format-size', when: (h, cc) => modeOf(cc) === 'stor', open: true, fields: [
            { type: 'range', name: 'g_font', label: 'Maks tekst', min: 1.6, max: 6, step: 0.1, default: D.g_font, fmt: (v) => `${M.nf(v, 1)} em` },
            { type: 'range', name: 'g_avatar', label: 'Bilder', min: 36, max: 64, step: 1, default: D.g_avatar, fmt: (v) => `${v} px` },
            { type: 'range', name: 'g_badge', label: 'Merke', min: 14, max: 28, step: 1, default: D.g_badge, fmt: (v) => `${v} px` },
            { type: 'range', name: 'g_gap', label: 'Avstand (minus = overlapp)', min: -16, max: 16, step: 1, default: D.g_gap, fmt: (v) => `${v} px` },
            PROSE_GAP,
            { type: 'info', label: 'Navnet blir så stort som skjermen tillater, opp til maks.' },
          ] },
          { type: 'section', id: 'psizes', label: 'Størrelser', icon: 'mdi:format-size', when: (h, cc) => modeOf(cc) === 'profil', open: true, fields: [
            { type: 'range', name: 'pic_size', label: 'Profilbilde', min: 40, max: 72, step: 1, default: D.pic_size, fmt: (v) => `${v} px` },
            { type: 'range', name: 'persons_size', label: 'Personer', min: 32, max: 56, step: 1, default: D.persons_size, fmt: (v) => `${v} px` },
            { type: 'range', name: 'title_size', label: 'Tittel', min: 28, max: 48, step: 1, default: D.title_size, fmt: (v) => `${v} px` },
            PROSE_GAP,
          ] },
          // Fiks 17.15: Hilsen og Sted – egne verdier (uavhengig av Stor hilsen), live i headeren mens man drar
          { type: 'section', id: 'hsizes', label: 'Størrelser', icon: 'mdi:format-size', when: (h, cc) => isHil(modeOf(cc)), open: true, fields: [
            { type: 'range', name: 'hFont', label: 'Tekststørrelse (maks)', icon: 'mdi:format-size', min: 24, max: 72, step: 1, default: HIL_DEF.hFont, unit: 'px' },
            { type: 'range', name: 'hAv', label: 'Bildestørrelse', icon: 'mdi:account-circle', min: 32, max: 96, step: 1, default: HIL_DEF.hAv, unit: 'px', help: 'Under 420 px bredde krymper bildene til 70 % (80 → 56 px).' },
            { type: 'range', name: 'hBadge', label: 'Merke (ikon-sirkel)', icon: 'mdi:circle-medium', min: 12, max: 40, step: 1, default: HIL_DEF.hBadge, unit: 'px', help: 'Merket blir aldri større enn halve bildet.' },
            { type: 'range', name: 'hGap', label: 'Mellom bildene', icon: 'mdi:arrow-expand-horizontal', min: 0, max: 24, step: 1, default: HIL_DEF.hGap, unit: 'px', help: 'Bildene står side om side (ingen overlapp). Flere enn 3 personer → 3 bilder + «+N».' },
            { type: 'range', name: 'hTGap', label: 'Mellom tekst og bilder', icon: 'mdi:format-letter-spacing', min: 0, max: 48, step: 1, default: HIL_DEF.hTGap, unit: 'px' },
            PROSE_GAP,
            { type: 'info', label: 'Teksten krymper for å få plass før den kortes med «…».' },
          ] },
          { type: 'section', id: 'sizes', label: 'Størrelser', icon: 'mdi:format-size', when: (h, cc) => !['stor', 'profil'].includes(modeOf(cc)) && !isHil(modeOf(cc)), fields: [PROSE_GAP] },
          { type: 'section', id: 'people', label: 'Personer', icon: 'mdi:account-multiple', fields: [
            // kind 'people': egne rader (avatar · navn · live status · ▲▼ · vis/skjul · chevron) – se HjemEditor._peopleRows.
            // Utvidet: «{fornavn} · hjemme», «{fornavn} · søvn», «Bruk HA-sone når borte», deretter feltene under.
            { type: 'rows', kind: 'people', name: 'people', label: 'Personer i headeren', defaults: (h, cc) => peopleDefaults(h, cc), addLabel: 'Legg til person', hide: true,
              norm: (list, cc) => list.map((r) => M.hjemPeopleNorm(cc, r)),
              title: (r, i, h) => (r.person ? M.name(h, r.person) : '') || 'Velg person',
              newRow: (h, cc, list) => { const used = new Set(list.map((x) => x.person)); return { person: M.all(h, 'person').find((x) => !used.has(x)) || '' }; },
              fields: [
                { type: 'boolean', name: 'sleep_invert', label: 'Søvn-bryter: På = våken', default: false, help: 'For brytere som er omvendt (f.eks. Homey «sovn_vaken»). Av: på = sover.', rowWhen: (r, h) => !!(r.sleep || (h && r.person && M.hjemSleepAuto(h, r.person))) },
                { type: 'boolean', name: 'use_gps_when_off', label: 'Bruk GPS når bryteren er av', default: false, help: 'Av: bryter av = Borte selv om GPS sier hjemme.', rowWhen: (r) => !!r.home },
                { type: 'select', name: 'display', label: 'Visning', options: [['picture', 'Bilde'], ['icon', 'Ikon'], ['initials', 'Initialer']], default: 'picture' },
                { type: 'text', name: 'picture', label: 'Bilde', auto: (r, h) => (r.person && h && h.states[r.person] && h.states[r.person].attributes.entity_picture) || '/local/bilde.jpg', help: 'Tom = bildet fra personen i HA (entity_picture). Mangler bilde → ikon.', rowWhen: (r) => (r.display || 'picture') === 'picture' },
              ] },
          ] },
          { type: 'section', id: 'zones', label: 'Status og soner', icon: 'mdi:map-marker-radius', fields: [
            { type: 'info', label: 'Ikon og farge på personbildene for hver status. Hjemme, Sover og Borte kan ikke slettes.' },
            { type: 'xstat', k: 'home' },
            { type: 'xstat', k: 'sleep' },
            { type: 'rows', name: 'zones', label: 'Soner med eget ikon og farge', defaults: (h) => autoZones(h), addLabel: 'Legg til sone',
              // Lagres som map: zones: { 'zone.skole': { icon, color } } (eldre liste leses også)
              toList: (v) => Object.keys(v).map((k) => ({ zone: k.includes('.') ? k : 'zone.' + k, ...(v[k] || {}) })),
              fromList: (list) => { const o = {}; list.forEach((r) => { if (!r) return; const { zone, ...rest } = r; o[zone || ''] = rest; }); return o; },
              title: (r, i, h) => (r.zone && h.states[r.zone] ? h.states[r.zone].attributes.friendly_name : r.zone) || 'Velg sone',
              sub: (r, i, h, cc) => (r.zone ? r.zone + (r.icon || r.color ? '' : ' · standard') : ''),
              chip: (r, i, h) => { const z = M.hjemZoneStyle(h, { zones: [r] }, r.zone); return `<span class="xchip" style="background:${z.color};transition:background .3s">${M.icon(z.icon, 18, 'color:#fafafa')}</span>`; },
              newRow: (h, cc, list) => { const used = new Set(list.map((z) => z.zone)); const z = M.all(h, 'zone', (s, id) => id !== 'zone.home' && !used.has(id))[0]; return { zone: z || '' }; },
              fields: [
                { type: 'entity', name: 'zone', label: 'Sone', domain: 'zone', required: true },
                { type: 'icon', name: 'icon', label: 'Ikon', auto: (r, h) => (r.zone && h && h.states[r.zone] && h.states[r.zone].attributes.icon) || 'mdi:map-marker', help: 'Tom = sonens eget ikon i HA' },
                { type: 'select', name: 'icon', label: 'Hurtigvalg', options: ZICONS.map((ic) => [M.iconName(ic), ic.replace(/_/g, ' ')]) },
                { type: 'color', name: 'color', label: 'Farge', auto: (r) => M.hjemZonePal(r.zone), help: 'Tom = fast farge fra paletten for sonen' },
              ] },
            { type: 'xstat', k: 'away' },
            { type: 'boolean', name: 'away_marker', label: 'Borte · vis merke', default: M.hjemAwayStyle(c || {}).badge, help: 'Av: borte-personer vises dempet uten merke. Standard på når Borte har eget ikon eller farge.' },
          ] },
          { type: 'section', label: 'Hilsen', icon: 'mdi:hand-wave', fields: [
            { type: 'text', name: 'greeting', label: 'Hilsen', placeholder: D.greeting },
            { type: 'tokens', target: 'greeting', tokens: [['+ Fornavn', '{name}'], ['+ Sted', '{server}'], ['+ Temp', '{temp}'], ['+ Vær', '{vaer}'], ['+ 👋', '👋 ', true]] },
            { type: 'text', name: 'undertekst', label: 'Undertekst (valgfri)', placeholder: '{temp} • {vaer}', help: 'Linja under tittelen. Tom = været i «Hjem» og «Profil», ingen linje ellers.' },
            { type: 'info', label: '{name} blir fornavnet ditt, {server} stedet du er på, {temp} og {vaer} været.' },
          ] },
          { type: 'section', label: 'Bilder', icon: 'mdi:account-circle', fields: [
            { type: 'select', name: 'size', label: 'Størrelse', options: [['S', 'Liten'], ['M', 'Middels'], ['L', 'Stor']], default: D.size },
            { type: 'select', name: 'badge', label: 'Merke', options: [['icon', 'Ikon'], ['dot', 'Prikk'], ['ring', 'Ring'], ['none', 'Ingen']], default: D.badge },
            { type: 'boolean', name: 'show_name', label: 'Vis navn', default: false },
            { type: 'boolean', name: 'show_place', label: 'Vis sted · Hjemme, sonen eller Borte under bildet', default: false },
            { type: 'boolean', name: 'ring_me', label: 'Ring rundt meg · markerer bildet ditt', default: false },
            { type: 'boolean', name: 'weather_tap', label: 'Trykk på været åpner Vær · gjelder «Hjem» og «Profil»', default: true },
            { type: 'hash', name: 'weather_hash', label: 'Vær-popup', placeholder: D.weather_hash },
          ] },
          // Fiks 37: servere / server_navn / server_sti / server_plass / server_meny_med (MSH.servervelger, 06-server.js)
          { type: 'section', id: 'servers', label: 'Steder', icon: 'mdi:swap-horizontal', meta: (h, cc) => { const n = SV.list(cc).length; return n ? n + ' steder' : 'Ingen'; }, fields: [
            { type: 'rows', name: 'servere', label: 'Bytt sted – Home Assistant-servere', defaults: (h, cc) => SV.list(cc), addLabel: 'Legg til sted',
              help: 'Trykk i Companion-appen bytter server med homeassistant://navigate/<dashbord>?server=<navn>. «Navn i appen» må være NØYAKTIG som i appens serverliste (ø/ö skrives som de er). Ikke satt = standardstedene Oslo, Toten og Strømstad. Slett alle steder for å fjerne menyen og pila.',
              norm: (list) => SV.parse(list).map((r) => { const o = { navn: r.navn }; if (r.server && r.server !== r.navn) o.server = r.server; ['ikon', 'farge', 'sti'].forEach((k) => { if (r[k]) o[k] = r[k]; }); return o; }),
              title: (r) => r.navn || 'Nytt sted', sub: (r) => (!r.navn ? 'Mangler navn' : [r.server && r.server !== r.navn ? 'I appen: ' + r.server : '', r.sti ? '/' + String(r.sti).replace(/^\/+/, '') : 'Samme dashbord'].filter(Boolean).join(' · ')),
              chip: (r, i) => { const st = SV.stil(r, i); return `<span class="xchip" style="border-radius:11px;background:${M.alpha(st.farge, 0.22)};color:${M.theme ? M.theme.accentText(st.farge) : st.farge}">${M.icon(st.ikon, 18)}</span>`; },
              newRow: () => ({ navn: '' }),
              fields: [
                { type: 'text', name: 'navn', label: 'Navn' },
                { type: 'text', name: 'server', label: 'Navn i appen (valgfri)', help: 'Tom = samme som navnet. F.eks. Strömstad → Strømstad.' },
                { type: 'icon', name: 'ikon', label: 'Ikon', auto: (r) => SV.stil(r, 0).ikon },
                { type: 'color', name: 'farge', label: 'Farge' },
                { type: 'text', name: 'sti', label: 'Dashbord-sti (valgfri)', help: 'Tom = server_sti, ellers samme dashbord som du står på. Eks. «dashboard-mysmarthome».' },
              ] },
            { type: 'text', name: 'server_navn', label: 'Denne serverens navn (valgfri)', auto: (h, cc) => SV.navn({ ...SV.cfg(cc), server_navn: undefined }, h) || 'fant ingen', help: 'Tom = gjenkjennes fra navnet på Home Assistant-installasjonen (store/små bokstaver og ø/ö spiller ingen rolle).' },
            { type: 'text', name: 'server_sti', label: 'Side som åpnes (valgfri)', placeholder: 'lovelace', help: 'Tom = samme dashbord som du står på nå.' },
            { type: 'select', name: 'server_plass', label: 'Hvor stedsnavnet står', options: [['tittel', 'Tittel – stedet er den store linja'], ['under', 'Under – på linja under hilsenen'], ['navn', 'Navn – ingen stedsnavn, trykk på hilsenen']], default: M.hjemServerPlassStd(modeOf(c || {})) },
            { type: 'select', name: 'server_meny_med', label: 'Menyen åpnes med', options: [['tap', 'Trykk'], ['double_tap', 'Dobbelttrykk'], ['hold', 'Langt trykk'], ['ingen', 'Ingen']], default: 'tap' },
          ] },
          // «Bytt entiteter»: vær + per person «· hjemme», «· søvn» og «Sone når borte» (samme people[]-felt som Personer).
          { type: 'section', id: 'overrides', label: 'Bytt entiteter', icon: 'mdi:swap-horizontal', fields: [
            { type: 'entity', name: 'overrides.weather', label: 'Vær', domain: 'weather', auto: (h) => M.all(h, 'weather')[0], help: (() => { const w = hass && M.all(hass, 'weather')[0]; return w ? 'Auto: ' + w : 'Auto: fant ingen'; })() },
            ...PL.flatMap((r, i) => {
              if (!r || !r.person) return [];
              const nm = hass ? M.name(hass, r.person) : r.person, sa = M.hjemSleepAuto(hass, r.person);
              return [
                { type: 'entity', name: `people.${i}.home`, label: `${nm} · hjemme`, domain: HOME_DOMS, domains: HOME_DOMS, auto: () => r.person, help: 'På = hjemme, av = borte. Automatisk = ' + r.person + ' og sonene.' },
                { type: 'entity', name: `people.${i}.sleep`, label: `${nm} · søvn`, domain: SLEEP_DOMS, domains: SLEEP_DOMS, auto: () => sa, help: sa ? 'Auto: ' + sa : 'Auto: fant ingen' },
                { type: 'boolean', name: `people.${i}.zone`, label: `${nm} · sone når borte`, default: true, help: 'Bryter av og personen i en HA-sone → sonens ikon og farge. Av → vanlig «Borte».' },
              ];
            }),
          ] },
        ];
      };
    }
    get cardSize() { return 2; }
    customize(focus) { return M.hjemCustomize(this, focus); }
    // Fiks 37: effektiv steds-config (eldre nøkler lest som nye) og stedet vi står på (SV.navn, som _serverNavn)
    _sc() { return SV.cfg(this.config); }
    _plassStd() { return M.hjemServerPlassStd(modeOf(this.config)); }
    _server() {
      const c = this._sc(), list = SV.list(c), name = SV.navn(c, this.hass);
      if (!this._srvW && list.length && this.hass) { this._srvW = 1; SV.varm({ liste: list, her: name || 'Hjem', tilpass: true }); } // Fiks 52: forvarm menyen i ledig tid
      return { name: name || 'Hjem', list, cur: list.findIndex((x) => x.navn === name), plass: SV.plass(c, this._plassStd()), meny: SV.gest(c, this._plassStd()) };
    }
    _weather() {
      const id = M.pick(this.config, 'weather', M.all(this.hass, 'weather')[0]);
      const s = this.s(id);
      const v = SV.vaer(this.hass, id);
      if (!s || M.unavailable(s)) return { id, text: '', temp: '', vaer: '' };
      const t = s.attributes.temperature;
      return { id, text: `${t != null ? M.nf(Number(t), 0) + ' °C · ' : ''}${M.hjemCond(s.state)}`, temp: v.temp, vaer: v.vaer };
    }
    // Fiks 18.4/18.7: Fold-oppsett? Satt av msh-hjem-card (mshFold); frittstående header måler dashbordflaten selv.
    _isFold() { return this.mshFold != null ? !!this.mshFold : !!(M.isFold && M.isFold()); }
    render() {
      const c = this.config, h = this.hass, Md = modeOf(c);
      const rd = (id) => this.s(id);
      const P = M.hjemPersons(h, c);
      let people = P.visible.map((id) => M.hjemPersonInfo(h, id, c, rd));
      const meP = people.find((p) => p.me);
      if (isHil(Md) && meP) people = [meP, ...people.filter((p) => p !== meP)]; // 26.22: den innloggede først
      const userFirst = firstName((h.user && h.user.name) || (meP && meP.name) || '');
      // Fiks 37 (37.4): stedsnavnets plass (tittel | under | navn), plassholdere {server} {name}/{first_name} {temp} {vaer}
      const srv = this._server(), sc = this._sc(), plass = srv.plass;
      const W = this._weather();
      const fill = (t) => SV.fyll(t, { server: srv.name, name: userFirst, temp: W.temp, vaer: W.vaer });
      const hilsen = c.greeting != null ? c.greeting : '👋 {name}!';
      const greet = fill(hilsen);
      const title = plass === 'tittel' ? fill(SV.tittelMal(sc, this._plassStd(), hilsen)) : Md === 'navn' ? userFirst || greet : greet;
      const ut = c.undertekst ? SV.rydd(fill(c.undertekst)) : '';
      const sub = ut || ((Md === 'hjem' || Md === 'profil') ? (W.text || '–') : '');
      // Pil på den store linja bare når den åpner menyen (servere + tittel/navn); uten servere: ingen meny, ingen pil
      const pilOn = srv.list.length > 0 && plass !== 'under';
      const under = plass === 'under', underMeny = under && srv.list.length > 0, apen = !!this._srv;
      const big = Md === 'stor', hil = isHil(Md), HS = hilSizes(c, this._isFold());
      // 26.22: smal dashbordflate (< 420 px) → 56 px bilder og 26 px merke
      const narrow = hil && (M.dashRect ? M.dashRect().width : window.innerWidth) < HIL_NARROW.w;
      // Fiks 17.20: målt tilpasning (tittel, bilder, mellomrom) gjelder bare samme tittel/antall/størrelser
      const hSig = hil ? [title, people.length, HS.font, HS.av, HS.badge, HS.gap, HS.tgap, narrow, pilOn].join('|') : '';
      if (this._hSig !== hSig) { this._hSig = hSig; this._hFit = null; this._hN = 0; }
      // Fiks 19.12: målt tilpasning (_hFitNow); før første måling et estimat fra radens bredde (tegnvekt-estimat)
      const HF = hil ? this._hFit || fitHil(this._hroW || 0, emWidth(title) + 0.1, pilOn ? HIL_ARR : 0, people.length, HS, narrow) : {};
      // 37.4: får ikke navn + pil plass – pila skjules først (trykk virker fortsatt)
      const uPil = pilOn && (hil ? HF.pil === false : !!(this._tFit && this._tFit.upil));
      this._hNarrow = narrow;
      const hGapN = HF.gap != null ? HF.gap : HS.gap;
      const hAvN = HF.av || HS.av, hSZ = hAvN + 'px', hBs = HF.bs || hilBadge(HS, hAvN, narrow), hK = HF.k != null ? HF.k : Math.min(people.length, HIL_MAX);
      this._hNum = hil ? people.length : 0;
      // tittelstil (designets hdr.titleStyle)
      let fs = '30px', fw = 600, ls = '-0.03em', ht = '34px', pb = '0';
      const prof = Md === 'profil';
      const pTitle = clampN(c.title_size, 28, 48, 36), pPic = clampN(c.pic_size, 40, 72, 60), pPers = clampN(c.persons_size, 32, 56, 46);
      if (prof) { fs = pTitle + 'px'; fw = 500; ls = '-0.02em'; ht = 'auto'; pb = '0'; }
      else if (hil) { fs = (HF.fs || HS.font) + 'px'; fw = 500; ls = '-0.02em'; ht = 'auto'; pb = '0'; } // 26.22: 44 px/500 (fitHil)
      else if (big) {
        const r = [...greet].reduce((t, ch) => t + (/\s/.test(ch) ? 0.27 : /[iltjf!.,:;'|]/.test(ch) ? 0.3 : /[mwMW]/.test(ch) ? 0.82 : /[A-ZÆØÅ]/.test(ch) ? 0.64 : /[a-zæøå0-9?]/.test(ch) ? 0.56 : ch.codePointAt(0) > 0x2000 ? 1.15 : 0.55), 0) + 0.9;
        fs = this._gFit ? this._gFit + 'px' : `min(${(97 / Math.max(r, 1)).toFixed(2)}cqw, ${Number(c.g_font) || 4.5}em)`; fw = 500; ls = '-0.02em'; ht = 'auto'; pb = '4px';
      }
      const gAv = Number(c.g_avatar) || 50, gBadge = Number(c.g_badge) || 20, gGap = c.g_gap != null && c.g_gap !== '' && !isNaN(Number(c.g_gap)) ? Number(c.g_gap) : -8;
      // Avatar som originalen: 55×55, border-radius 25 (skaleres likt for Liten/Stor og de store oppsettene).
      const szN = hil ? HS.av : big ? gAv : ({ S: 40, M: 55, L: 64 }[c.size] || 55);
      const SZ = hil ? hSZ : big ? `clamp(30px, ${(gAv / 4.2).toFixed(2)}cqw, ${gAv}px)` : szN + 'px';
      const RAD = hil ? '50%' : big ? `calc(${SZ} * ${(25 / 55).toFixed(4)})` : Math.round((szN * 25) / 55) + 'px'; // 26.22: runde bilder i Hilsen
      const bad = this._picBad;
      const ov = !c.show_name && !c.show_place && !big && !hil;
      const face = (p, k, dress) => {
        const ring = c.badge === 'ring' && !dress && !hil && p.badge ? `, 0 0 0 5px ${p.stCol}` : '';
        const meRing = p.me && c.ring_me && !dress && !hil ? `, 0 0 0 7px ${C.pink}` : '';
        const sz = dress ? dress.sz + 'px' : SZ, rad = dress ? '50%' : RAD, n = dress ? dress.sz : szN;
        // Profil: runde bilder; uten bilde → initialer 18 px/500 på grå 300 (ikon bare når visning = Ikon).
        const ini = dress && p.display !== 'icon' && !(p.pic && !(bad && bad.has(p.pic)));
        const av = ini
          ? `width:${sz};height:${sz};border-radius:50%;background:var(--ki-surface-2, var(--gray300,#404040));opacity:${p.dim ? 0.55 : 1};font-size:18px;font-weight:500;color:var(--ki-text, var(--white,#fafafa));transition:opacity .3s`
          : `width:${sz};height:${sz};border-radius:${rad};background:${p.bg};box-shadow:${dress || hil ? 'none' : `0 0 0 3px ${C.dash}${ring}${meRing}`};opacity:${p.dim && !hil ? 0.55 : 1};font-size:${faceTxt(p, bad) ? `calc(${sz} * 0.38)` : '0'};font-weight:600;color:var(--ki-on-accent, #232323);transition:opacity .3s,box-shadow .3s`;
        let bd = '', bi = '';
        // Status-merke (profil): 21 px sirkel grå 100 øverst til høyre, ikon 12 px grønt (hjemme) / grå 700 (borte).
        // Merke = status (M.personStatus): hjemme-bryter → sone → borte. Borte uten away_marker / ukjent → ingen merke.
        const hb = hil && !dress && c.badge !== 'none' ? M.hjemHilBadge(p, c) : null;
        if (hil && !dress) {
          // 26.22: 34 px (smal: 26) sirkel øverst til høyre, overlapper kanten ca. 25 %, hvitt ikon 18 px (smal: 14), uten ring
          if (hb) {
            const o = -Math.round(hBs * 0.25), is = Math.round((hBs * 18) / 34);
            bd = `right:${o}px;top:${o}px;width:${hBs}px;height:${hBs}px;border-radius:50%;background:${hb.color};z-index:1`;
            bi = M.icon(hb.icon, is, `color:var(--ki-text, #fafafa);--mdc-icon-size:${is}px;width:auto;height:auto`);
          }
        }
        else if (!p.badge) { /* ingen merke */ }
        else if (dress) { bd = `right:0;top:0;transform:translate(30%,-15%);width:${dress.bs}px;height:${dress.bs}px;border-radius:50%;background:var(--ki-surface-3, var(--gray100,#2f2f2f));z-index:1`; bi = M.icon(p.glyph, 12, `color:${M.theme ? M.theme.accentText(p.stCol) : p.stCol};transition:color .3s`); }
        else if (big) { bd = `right:${-gBadge * 0.3}px;top:${-gBadge * 0.3}px;width:${gBadge}px;height:${gBadge}px;border-radius:${gBadge / 2}px;background:${p.stCol};z-index:1`; bi = M.icon(p.glyph, Math.round(gBadge * 0.6), 'color:var(--ki-text, #fafafa)'); }
        else if (c.badge === 'icon') { bd = `right:-4px;top:-4px;width:22px;height:22px;border-radius:11px;background:${p.stCol};box-shadow:0 0 0 2px ${C.dash}`; bi = M.icon(p.glyph, 13, 'color:var(--ki-text, #fafafa)'); }
        else if (c.badge === 'dot') bd = `right:1px;top:1px;width:12px;height:12px;border-radius:6px;background:${p.stCol};box-shadow:0 0 0 2px ${C.dash}`;
        const ml = dress ? 0 : k ? (ov ? -8 : hil ? hGapN : big ? gGap : 6) : 0; // stor: g_gap < 0 = overlapp (standard −8 som MySmartHome)
        const lbl = !dress && !ov && (c.show_name || c.show_place) ? `<span class="lb">${c.show_name ? `<span class="ln">${esc(p.first)}</span>` : ''}${c.show_place ? `<span class="lp">${esc(p.place)}</span>` : ''}</span>` : '';
        return `<button class="face press" data-key="${esc(p.id)}" data-act="person" data-haptic="off" data-id="${esc(p.id)}" data-ent="${esc(p.id)}" title="${esc(p.name)} · ${esc(p.place)}" style="margin-left:${ml}px${hil && k === faces.length - 1 && !hMore ? `;margin-right:${Math.round(hBs * 0.25)}px` : ''}">
          <span class="fw"><span class="av" style="${av}">${ini ? esc(p.initial) : faceInner(p, n, bad)}</span>${bd ? `<span class="bd" style="${bd}">${bi}</span>` : ''}</span>${lbl}</button>`;
      };
      let faces = people, row2 = [], hMore = 0;
      if (Md === 'profil') { const me = meP || people[0]; faces = me ? [me] : []; row2 = people.filter((p) => p !== me); }
      if (hil && hK < people.length) { hMore = people.length - hK; faces = people.slice(0, hK); } // Fiks 19.12 ④
      const more = hMore ? people[hK] : null;
      const moreHTML = more ? `<button class="face more press" data-key="__more" data-act="person" data-haptic="off" data-id="${esc(more.id)}" data-ent="${esc(more.id)}" title="${esc(people.slice(hK).map((p) => p.name).join(', '))}" style="margin-left:${hK ? hGapN : 0}px"><span class="fw"><span class="av" style="width:${hSZ};height:${hSZ};border-radius:50%;background:var(--ki-surface-2, var(--gray300,#404040));font-size:${Math.round(hAvN * 0.34)}px;font-weight:600;color:var(--ki-text, var(--white,#fafafa))">+${hMore}</span></span></button>` : '';
      const facesHTML = (Md === 'profil' ? faces.map((p) => face(p, 0, { sz: pPic, bs: 21 })).join('') : faces.map((p, k) => face(p, k)).join('')) + moreHTML;
      const empty = !people.length ? `<button class="nop press" data-act="customize" data-section="entities">${M.icon('person_add', 20)}</button>` : '';
      this._sheets && this._sheets.forEach((sh) => sh.update());
      const TA = M.hjemTitleActions(c);
      const tTip = TGESTS.filter(([g]) => TA[g] !== 'none').map(([g, l]) => `${l}: ${TACT_L[TA[g]]}`).join(' · ') || esc(title);
      const arrow = big ? M.icon('arrow_drop_down', 26, 'color:var(--ki-text-2, #afafaf);--mdc-icon-size:.62em;width:.5em;height:.62em;margin-left:-.06em;overflow:visible') : prof ? M.icon('mdi:chevron-down', 14, 'color:var(--ki-text-2, var(--gray800,#afafaf));flex:none') : hil ? M.icon('mdi:menu-down', 24, 'color:var(--ki-text-2, #afafaf);flex:none') : M.icon('mdi:menu-down', 26, 'color:var(--ki-text-2, #afafaf)');
      const wBtn = (t) => `<button class="sub" ${c.weather_tap !== false ? `data-act="popup" data-hash="${esc(c.weather_hash || '#vaer')}"` : ''} ${W.id ? `data-ent="${esc(W.id)}"` : ''} style="cursor:${c.weather_tap !== false ? 'pointer' : 'default'}">${esc(t)}</button>`;
      const subT = under && sub === '–' ? '' : sub;
      // 37.4 «under»: stedsnavn + liten pil (20 px) på linja under, «•» før evt. værtekst; uten servere ren tekst
      const subHTML = under
        ? `<div class="sub2">${underMeny ? `<button class="svv" data-act="srvmenu" data-haptic="off" aria-haspopup="menu" aria-expanded="${apen}">${esc(srv.name)}<span class="pil liten${apen ? ' apen' : ''}">${M.icon('mdi:menu-down', 20)}</span></button>` : `<span class="svn">${esc(srv.name)}</span>`}${subT ? `<span class="sk">•</span>${wBtn(subT)}` : ''}</div>`
        : sub ? wBtn(sub) : '';
      return `<header class="hd${prof ? ' prof' : ''}${hil ? ' hil' : ''}${hil && HF.cut ? ' hcut' : ''}${hil && HF.wrap ? ' hwrap' : ''}${uPil ? ' upil' : ''}" data-ent="__tilpass">
        <div class="top" ${hil ? `style="gap:${HS.tgap}px"` : ''}>
          <div class="lc" data-gcol="1">
            <button class="ttl" data-act="title" style="font-size:${fs};font-weight:${fw};letter-spacing:${ls};height:${ht};padding-block:${pb}${this._tFit && this._tFit.fs && !hil && !big ? `;font-size:${this._tFit.fs}px` : ''}" data-haptic="off" ${srv.meny ? `aria-haspopup="menu" aria-expanded="${apen}"` : ''} title="${esc(tTip)}">
              <span class="tx">${esc(title)}</span>${pilOn ? `<span class="pil${apen ? ' apen' : ''}">${arrow}</span>` : ''}
            </button>
            ${subHTML}
          </div>
          <div class="faces">${facesHTML}${empty}</div>
        </div>
        ${row2.length ? `<div class="row2">${row2.map((p) => face(p, 0, { sz: pPers, bs: 21 })).join('')}</div>` : ''}
      </header>`;
    }
    constructor() {
      super();
      // Fiks 37: gestene på tittelen (port av family-status-card): hold 500 ms, trykk i click, dobbelttrykk-frist 320 ms
      this._g = SV.gester({
        meny: () => this._server().meny,
        handling: (g) => SV.handling(this._sc(), g, GSTD),
        apen: () => !!this._srv,
        veksle: () => (this._srv ? this._srvClose() : this._serverMenu()),
        lukk: (uten) => this._srvClose(uten),
        kjor: (h) => this._kjor(h),
        tilpass: () => this._tilpass(),
      });
      const stop = () => this._g.up();
      this.shadowRoot.addEventListener('pointerup', stop);
      this.shadowRoot.addEventListener('pointercancel', stop);
      // pointerleave (fsc): fingeren/pekeren forlater tittelen → ingen hold
      this.shadowRoot.addEventListener('pointerout', (e) => { const t = this._el(e, '.ttl'); if (t && !(e.relatedTarget && t.contains(e.relatedTarget))) this._g.cancel(); });
      this.shadowRoot.addEventListener('pointermove', (e) => this._g.move(e));
      this.shadowRoot.addEventListener('contextmenu', (e) => { if (this._el(e, '.ttl') || this._el(e, '[data-act="person"]')) e.preventDefault(); });
      this.shadowRoot.addEventListener('selectstart', (e) => { if (this._el(e, '.ttl')) e.preventDefault(); });
    }
    // Tittelen har egne gester; resten av headeren bruker basekortets hold (→ «Tilpass header»).
    _onDown(e) {
      const t = this._el(e, '.ttl');
      if (!t) return super._onDown(e);
      this._cancelHold();
      this._g.down(e);
      if (!this._srv) this._srvPrep();
    }
    // Kjør en handling på hilsenen (SV.kjor) – kortets egne: kiosk, edit (rediger dashbord), tilpass (Tilpass header)
    _kjor(h) {
      this._srvClose();
      SV.kjor(this, h, {
        kiosk: () => this._kiosk(),
        edit: () => M.navigate(location.pathname + '?edit=1'),
        tilpass: () => this._tilpass(),
        navigate: (x) => { const p = String(x.navigation_path || ''); return p[0] === '#' ? M.openPopup(p) : M.navigate(p[0] === '?' ? location.pathname + p : p); },
      });
    }
    _tilpass() { this._srvClose(true); window.dispatchEvent(new CustomEvent('ki-open-editor', { detail: { editor: 'header' } })); }
    // Kiosk-modus av/på: veksler kiosk_entity (standard input_boolean.kiosk_mode) – samme entitet som kiosk-mode / UIX bruker.
    _kiosk() {
      const id = M.hjemKioskEntity(this.config), s = this.hass && this.hass.states[id];
      if (!s) { M.hjemToast(this, 'Velg kiosk-entitet i Tilpass header'); return; }
      const on = s.state === 'on', d = id.split('.')[0];
      M.call(this.hass, d === 'input_boolean' ? 'input_boolean' : 'homeassistant', 'toggle', { entity_id: id });
      M.hjemToast(this, `Kiosk-modus ${on ? 'av' : 'på'}`);
    }
    onAction(name, el, ev) {
      if (name === 'title') return this._g.click(ev);
      if (name === 'srvmenu') { // «under»: stedsnavnet på linja under åpner/lukker menyen
        if (ev) ev.stopPropagation();
        M.haptic('light');
        return this._srv ? this._srvClose() : this._serverMenu(el);
      }
      if (name === 'person') {
        return this._personTap(el.dataset.id);
      }
      return super.onAction(name, el, ev);
    }
    // Langt trykk ellers i headeren (ikke tittelen – den har egne gester) → «Tilpass header».
    // Fiks 22.7: trykk på personbilde. Dobbelttrykk = Ingen → kjøres med én gang, ellers venter trykket 260 ms på
    // et nytt trykk på samme person. Haptic light ved første trykk.
    _personTap(id) {
      const A = M.hjemPersonActions(this.config);
      if (this._pTap && this._pTap.id === id) { clearTimeout(this._pTap.t); this._pTap = null; this._personRun(A.double, id); return; }
      if (this._pTap) { clearTimeout(this._pTap.t); const o = this._pTap.id; this._pTap = null; this._personRun(A.tap, o); }
      if (A.tap !== 'none' || A.double !== 'none') M.haptic('light');
      if (A.double === 'none') { this._personRun(A.tap, id); return; }
      this._pTap = { id, t: setTimeout(() => { this._pTap = null; this._personRun(A.tap, id); }, 260) };
    }
    _personRun(act, id) {
      if (!id) return;
      switch (act) {
        case 'popup': { const hs = '#person-' + objId(id); if (M.allPopups && !M.allPopups(this.hass).some((p) => p.hash === hs)) return this._quick(id); return M.openPopup(hs); } // mangler popupen → hurtigarket
        case 'quick': return this._quick(id);
        case 'kart': if (!kartOk(this.hass)) return this._quick(id); M.kartFocus(id); return M.openPopup('#kart');
        case 'more': return M.moreInfo(this, id);
        default:
      }
    }
    onHold(id, el) {
      // Fiks 22.7: hold på personbilde (basekortets hold, haptic medium, stopper klikket) → person_actions.hold
      if (el && el.dataset && el.dataset.act === 'person') { if (this._pTap) { clearTimeout(this._pTap.t); this._pTap = null; } this._personRun(M.hjemPersonActions(this.config).hold, el.dataset.id); return true; }
      if (id !== '__tilpass') return undefined;
      window.dispatchEvent(new CustomEvent('ki-open-editor', { detail: { editor: 'header' } }));
      return true;
    }
    // Fiks 37 · «Bytt sted»-menyen (MSH.servervelger.meny): portalt lag over dashbord-containeren, 260 px ark med spiss
    // under navnet, «Bytt sted», én rad per sted (fargeflis, navn, «Du er her» / chevron), «Tilpass …» nederst.
    // Trykk utenfor / Esc lukker; andre trykk innen 320 ms (dobbelttrykk) lukker uten utgangsanimasjon.
    _serverMenu(anchor) {
      const S = this._server();
      if (!S.list.length) return null; // ingen servere → ingen meny
      const a = anchor || this.shadowRoot.querySelector(S.plass === 'under' ? '.svv' : '.ttl .tx') || this.shadowRoot.querySelector('.ttl');
      const ov = SV.meny({
        anchor: a, liste: S.list, her: S.name, tilpass: true,
        onVelg: (srv) => this._goServer(srv),
        onTilpass: () => this._tilpass(),
        onBakgrunn: () => this._g.bakgrunn(),
        onArk: () => this._g.ark(),
        onLukk: () => { if (this._srv === ov) { this._srv = null; this._srvPil(); } },
      });
      this._srv = ov;
      this._srvPil(); // pila roterer
      return ov;
    }
    // Fiks 52: åpne/lukke tegner IKKE headeren på nytt (det ga et hakk i samme frame som menyen kom, og afterRender
    // målte tittelen på nytt) – bare pila og aria-expanded settes direkte. render() leser samme tilstand (this._srv).
    _srvPil() {
      const apen = !!this._srv, R = this.shadowRoot;
      R.querySelectorAll('.ttl .pil, .svv .pil').forEach((x) => x.classList.toggle('apen', apen));
      R.querySelectorAll('.ttl[aria-haspopup], .svv').forEach((x) => x.setAttribute('aria-expanded', String(apen)));
    }
    // Bygg menyen allerede ved pointerdown på navnet (gjenbrukes ved trykket) – SV.forbered
    _srvPrep() { const S = this._server(); if (S.list.length && S.meny) SV.forbered({ liste: S.list, her: S.name, tilpass: true }); }
    _srvClose(uten) { if (this._srv) this._srv.lukk(uten); }
    // Bytt server (SV.bytt): window.open(homeassistant://navigate/<sti>?server=<navn>) – aldri location.href
    _goServer(v) { return v ? SV.bytt(v, this._sc()) : ''; }
    // Person-hurtigarket (fiks 16.14): Hjemme/Borte styrer people[].home, Våken/Sover styrer people[].sleep (toveis).
    // Aktivt segment = entitetens faktiske tilstand (live). Trykk/dra → optimistisk bytte + tjenestekall; har entiteten
    // ikke endret seg innen 5 s, går segmentet tilbake med «Kunne ikke endre {navn}». binary_sensor → «Styres av {navn}».
    // Uten hjemme-bryter: person.* vises (ikke skrivbar) med hint; uten søvn-bryter er Våken/Sover deaktivert.
    _quick(pid) {
      const card = this, pend = {};
      const onOf = (st) => !!st && st.state === 'on';
      const info = () => {
        const c = card.config, h = card.hass, p = M.hjemPersonInfo(h, pid, c, (x) => card.s(x));
        const seg = (key, ent) => {
          const st = ent ? card.s(ent) : null, d = ent ? ent.split('.')[0] : null, nm = ent ? M.name(h, ent) || ent : '';
          const ro = !ent || d === 'binary_sensor' || !st || M.unavailable(st);
          const hint = !ent ? (key === 'zone' ? 'Velg hjemme-bryter i Tilpass header' : 'Velg søvn-bryter i Tilpass header')
            : d === 'binary_sensor' ? `Styres av ${nm}` : !st || M.unavailable(st) ? `${nm} er utilgjengelig` : '';
          return { ent, st, d, nm, ro, hint, off: key === 'sleep' && !ent };
        };
        return { p, h, Z: seg('zone', p.presId), S: seg('sleep', p.sleepId) };
      };
      // Ønsket tilstand for bryteren: Hjemme → på; Sover → på (omvendt med «På = våken»)
      const want = (key, i, p) => (key === 'zone' ? i === 0 : (i === 1) !== !!p.sleepInv);
      const settle = (key, X) => {
        const q = pend[key];
        if (q && onOf(X.st) === q.want) { clearTimeout(q.timer); delete pend[key]; }
      };
      const segH = (key, idx, opts, X) => `<div class="seg ${X.ro ? 'ro' : ''} ${X.off ? 'off' : ''}" data-seg="${key}" aria-disabled="${X.ro}"><span class="ind" style="left:calc(4px + (100% - 8px) * ${idx / 2});background:${opts[idx][3]}"></span>${opts.map(([icon, label], i) => `<span class="o ${i === idx ? 'on' : ''}" ${X.ro ? '' : `data-a="seg" data-seg="${key}" data-i="${i}" data-haptic="selection"`} role="button" aria-pressed="${i === idx}">${M.icon(icon, 20)}${esc(label)}</span>`).join('')}</div>${X.hint ? `<span class="hint">${esc(X.hint)}</span>` : ''}`;
      const render = () => {
        const { p, Z, S } = info();
        settle('zone', Z); settle('sleep', S);
        const zi = pend.zone ? pend.zone.i : p.home ? 0 : 1;
        const si = pend.sleep ? pend.sleep.i : p.sleep ? 1 : 0;
        const place = pend.zone ? (zi === 0 ? 'Hjemme' : 'Borte') : p.place;
        const slp = pend.sleep ? si === 1 : p.sleep;
        // Fiks 20.5: ring og valgene bruker ikon/farge fra «Status og soner»
        const cc = card.config || {}, HS = M.hjemStatusStyle(cc, 'home'), SS = M.hjemStatusStyle(cc, 'sleep'), AS = M.hjemStatusStyle(cc, 'away');
        const ringC = slp ? SS.color : zi === 0 ? HS.color : p.status.kind === 'zone' && !pend.zone ? p.status.color : AS.color;
        const ringS = M.navGlassOn() ? `0 0 0 4px rgb(20 20 22/0.55),0 0 0 6px ${ringC},0 10px 24px rgb(0 0 0/0.35)` : `0 0 0 4px var(--ki-bg, var(--gray000,#232323)),0 0 0 6px ${ringC}`; // 47 C
        return `<div class="orb pic" style="background:${p.bg};font-size:${faceTxt(p, card._picBad) ? 36 : 0}px;box-shadow:${ringS}">${faceInner(p, 96, card._picBad)}</div>
          <div class="nm"><b>${esc(p.name)}</b><span data-st>${esc(place)} · ${slp ? 'Sover' : 'Våken'}</span></div>
          <div class="scr" data-key="scr">
          ${segH('zone', zi, [[HS.icon, 'Hjemme', 0, HS.color], [AS.icon, 'Borte', 1, AS.color]], Z)}
          ${segH('sleep', si, [['light_mode', 'Våken', 0, C.orange], [SS.icon, 'Sover', 1, SS.color]], S)}
          <button class="done" data-a="close">Ferdig</button>
          <button class="more" data-a="details">Mobil, soner og søvn${M.icon('chevron_right', 18)}</button>
          </div>`;
      };
      let sheet = null;
      const setSeg = (key, i) => {
        const { p, h, Z, S } = info(), X = key === 'zone' ? Z : S;
        if (X.ro) { if (X.hint) M.hjemToast(card, X.hint); return; }
        const w = want(key, i, p);
        if (pend[key]) { clearTimeout(pend[key].timer); delete pend[key]; }
        if (onOf(X.st) === w) { if (sheet) sheet.update(); return; }
        const fail = () => {
          if (!pend[key] || pend[key].id !== q.id) return;
          clearTimeout(pend[key].timer); delete pend[key];
          M.hjemToast(card, `Kunne ikke endre ${X.nm}`);
          M.haptic('failure');
          if (sheet) sheet.update();
        };
        const q = { i, want: w, ent: X.ent, id: M.uid(), timer: 0 };
        q.timer = setTimeout(fail, 5000);
        pend[key] = q;
        if (sheet) sheet.update();
        const dom = X.d === 'switch' || X.d === 'input_boolean' ? X.d : 'homeassistant';
        try { Promise.resolve(h.callService(dom, w ? 'turn_on' : 'turn_off', { entity_id: X.ent })).catch(fail); } catch (e) { fail(); }
      };
      sheet = M.hjemSheet(card, {
        render,
        onAct(a, el, sh) {
          if (a === 'seg') { const seg = el.closest('.seg'); if (seg && seg.__dragged) return; setSeg(el.dataset.seg, Number(el.dataset.i)); }
          if (a === 'details') { sh.ov.close(); setTimeout(() => card._openPeople(pid), 30); }
        },
        drag(seg, e, sh) { M.hjemSegDrag(seg, e, (i) => { setSeg(seg.dataset.seg, i); sh.update(); }); },
        glass: () => M.navGlassOn(), // 47 C: glass bare med navbar-profilen «Liquid Glass»
      });
      return sheet;
    }
    // «Mobil, soner og søvn ›»: «Tilpass header» → Personer med denne personen utvidet
    _openPeople(pid) {
      const tag = customElements.get('msh-hjem-editor') ? 'msh-hjem-editor' : 'msh-editor';
      const r = M.openEditor(this, { cardClass: this.constructor, focus: 'people', tag });
      const ed = r && r.editor;
      if (!ed || !ed._findRows) return r;
      const f = ed._findRows('people');
      const i = f ? ed._rowsOf(f).findIndex((x) => x && x.person === pid) : -1;
      if (i >= 0) { ed._ropen.people = i; ed._render(); }
      return r;
    }
    // Fiks 16.4/17.13: lagret mode under/kompakt/familie vises som Hilsen og skrives tilbake én gang (ki-store), uten melding.
    _migrateMode() {
      const raw = this._rawConfig || {};
      if (this._modeMig || !OLD_MODES.includes(raw.mode)) return;
      if (!this.hass || !M.store || !M.store.loaded || M.draftOf(this)) return;
      const key = this._yamlConfig ? M.storeKey(this._yamlConfig, this) : null;
      if (!key) return;
      this._modeMig = true;
      try { Promise.resolve(M.store.set(key + '.mode', 'hilsen')).catch(() => {}); } catch (e) { /* */ }
    }
    // Fiks 37: eldre steder/tittel-handlinger (servers, servers_init, this_server, place_name, title_actions) skrives om
    // til servere / server_navn / server_meny_med / greeting_*_action i ki-store ÉN gang (de gamle nøklene fjernes).
    // Til det er gjort leses begge (SV.cfg). Fiks 40: uten servere-nøkkel brukes standardstedene (SV.STD);
    // eksplisitt tom liste (servere: [] / '') – ingen meny og ingen pil.
    _migrateServers() {
      const raw = this._rawConfig || {};
      if (this._srvMig || !SV.harGammel(raw)) return;
      if (!this.hass || !M.store || !M.store.loaded || M.draftOf(this)) return;
      const key = this._yamlConfig ? M.storeKey(this._yamlConfig, this) : null;
      if (!key) return;
      this._srvMig = true;
      SV.migrer(raw, (k, v) => Promise.resolve(M.store.set(key + '.' + k, v)).catch(() => {}));
    }
    afterRender() {
      this._migrateMode();
      this._migrateServers();
      // Fiks 16.2: msh-hjem-card setter avstanden til prosaen (prose_gap) – si fra når headerens config er tegnet
      const host = this.getRootNode && this.getRootNode().host;
      if (host && typeof host._proseGap === 'function') host._proseGap();
      // Bilde som ikke laster → ikon (huskes per URL)
      this.shadowRoot.querySelectorAll('img[data-pic]').forEach((img) => {
        if (img.__e) return;
        img.__e = true;
        const fail = () => { (this._picBad = this._picBad || new Set()).add(img.dataset.pic); this.update(); };
        img.addEventListener('error', fail);
        if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) fail();
      });
      // Stor hilsen: tilpass skriftstørrelsen til tilgjengelig bredde (som gFitNow i designet)
      if (modeOf(this.config) === 'stor') {
        const col = this.shadowRoot.querySelector('.lc');
        if (col && !this._ro && window.ResizeObserver) { this._ro = new ResizeObserver((en) => { const w = Math.round(en[0].contentRect.width); if (w === this._roW) return; const first = this._roW === undefined && this._gFit == null; this._roW = w; if (first) return; /* ytelse: første varsel (start) endrer ingenting – ingen ekstra tegning */ this._gFit = null; this.update(); }); this._ro.observe(col); }
        requestAnimationFrame(() => {
          const sp = this.shadowRoot.querySelector('.ttl .tx'), cl = this.shadowRoot.querySelector('.lc');
          if (!sp || !cl) return;
          // chevron ▾ etter navnet (0,5em + 6 px kolonnegap) trekkes fra tilgjengelig bredde
          const fs = parseFloat(getComputedStyle(sp).fontSize) || 30, w = sp.scrollWidth + fs * 0.5 + 6, avail = cl.clientWidth - 2;
          if (!w || !avail) return;
          const max = (Number(this.config.g_font) || 4.5) * 16, n = Math.max(20, Math.min(max, Math.floor(((fs * avail) / w) * 0.985 * 10) / 10));
          if (Math.abs(n - (this._gFit || fs)) > 0.4) { this._gFit = n; this.update(); }
        });
      } else if (this._ro) { this._ro.disconnect(); this._ro = null; this._gFit = null; }
      // Fiks 17.20: Hilsen/Sted – tittelen krymper for å passe (målt, som gFitNow), deretter bildene, så overlapp
      if (isHil(modeOf(this.config))) {
        const top = this.shadowRoot.querySelector('.top');
        if (top && window.ResizeObserver && this._hroEl !== top) {
          if (this._hro) this._hro.disconnect();
          this._hroEl = top;
          this._hro = new ResizeObserver((en) => { const w = Math.round(en[0].contentRect.width); if (w === this._hroW) return; const first = this._hroW === undefined && this._hFit == null && !this._hN; this._hroW = w; if (first) return; /* ytelse: første varsel (start) endrer ingenting – ingen ekstra tegning */ this._hFit = null; this._hN = 0; this.update(); });
          this._hro.observe(top);
        }
        cancelAnimationFrame(this._hRaf);
        this._hRaf = requestAnimationFrame(() => this._hFitNow());
      } else if (this._hro) { this._hro.disconnect(); this._hro = this._hroEl = null; this._hFit = null; }
      // Fiks 37.4: andre oppsett (Hjem/Profil/Navn) – pila skjules først, så krymper teksten (min. 85 %), til slutt «…»
      if (!isHil(modeOf(this.config)) && modeOf(this.config) !== 'stor') {
        cancelAnimationFrame(this._tRaf);
        this._tRaf = requestAnimationFrame(() => this._tFitNow());
      } else this._tFit = null;
    }
    _tFitNow() {
      const R = this.shadowRoot, t = R.querySelector('.ttl'), sp = t && t.querySelector('.tx'), lc = R.querySelector('.lc');
      if (!sp || !lc || !sp.isConnected) return;
      const cur = this._tFit || {}, pil = t.querySelector('.pil');
      const fsNow = parseFloat(getComputedStyle(sp).fontSize) || 30, fs0 = cur.fs ? cur.fs0 : fsNow;
      const tw1 = sp.scrollWidth / fsNow, avail = lc.clientWidth;
      if (!tw1 || !avail) return;
      const pw = pil ? (pil.offsetWidth ? pil.offsetWidth + (parseFloat(getComputedStyle(t).columnGap) || 6) : cur.pw || 32) : 0;
      const next = { pw };
      if (tw1 * fs0 + pw > avail + 0.5) {
        next.upil = !!pil;
        if (tw1 * fs0 > avail + 0.5) { next.fs0 = fs0; next.fs = Math.round(Math.max(0.85 * fs0, (avail / tw1) * 0.99) * 10) / 10; }
      }
      if (!!cur.upil === !!next.upil && (cur.fs || 0) === (next.fs || 0)) { this._tFit = next; this._tN = 0; return; }
      if ((this._tN = (this._tN || 0) + 1) > 12) return;
      this._tFit = next;
      this.update();
    }
    // Fiks 19.12: mål tekstens bredde (per px skrift) og radens bredde, og regn ut fitHil: navnet vises alltid helt;
    // bildene overlapper, krymper (40 px), så krymper teksten (28 px), til slutt «+N».
    _hFitNow() {
      const R = this.shadowRoot, sp = R.querySelector('.hil .ttl .tx'), top = R.querySelector('.hil .top');
      if (!sp || !top || !sp.isConnected) return;
      const HS = hilSizes(this.config, this._isFold()), cur = this._hFit || {};
      const fs = parseFloat(getComputedStyle(sp).fontSize) || 30, tw = sp.scrollWidth, W = top.clientWidth; // offset*/client* = uten CSS-zoom
      if (!tw || !W) return;
      const arr = sp.nextElementSibling ? HIL_ARR : 0; // fast bredde – pila kan være skjult (37.4)
      const next = fitHil(W, tw / fs, arr, this._hNum || 0, HS, !!this._hNarrow);
      const ch = !cur.fs || Math.abs(next.fs - cur.fs) > 0.4 || next.av !== cur.av || next.gap !== cur.gap || next.k !== cur.k || next.bs !== cur.bs || !!next.wrap !== !!cur.wrap || !!next.cut !== !!cur.cut || next.pil !== cur.pil;
      if (!ch || (this._hN = (this._hN || 0) + 1) > 12) return;
      this._hFit = next;
      this.update();
    }
    // Fiks 19.13: effektiv config = kortets config + header-profilen for denne brukeren × enhetsklassen
    // (forhåndsvisningen i editoren setter _profSel = { user, cls }). Mellomlagres per ki-store-revisjon.
    get config() {
      const c = this._config || {};
      if (!M.store || !M.profileGet) return c;
      const sel = this._profSel || null;
      const sig = [M.store.rev, sel ? sel.user + '/' + sel.cls : '', M.deviceClass(), M.userId(), !!this._hass].join('|');
      if (this._pc && this._pc.c === c && this._pc.sig === sig) return this._pc.v;
      const P = M.profileGet(HPROF, sel);
      const v = Object.keys(P).length ? applyProf(c, P, this._hass) : c;
      this._pc = { c, sig, v };
      if (!sel) lastHdr = this; // Fiks 20.5: M.hjemHeaderCfg() (personStatus uten cfg)
      return v;
    }
    connectedCallback() {
      super.connectedCallback();
      if (M.store && !this._hpOff) this._hpOff = M.store.subscribe((d, path) => { if (!path || String(path).startsWith(HPROF)) { this._hFit = null; this._hN = 0; this.update(); } });
      if (!this._onCls) this._onCls = () => { this._hFit = null; this._hN = 0; this.update(); };
      window.addEventListener('ki-device-class', this._onCls); // bretting: ny enhetsklasse → ny profil uten reload
    }
    disconnectedCallback() {
      super.disconnectedCallback();
      if (this._hpOff) { this._hpOff(); this._hpOff = null; }
      if (this._onCls) window.removeEventListener('ki-device-class', this._onCls);
      if (this._ro) { this._ro.disconnect(); this._ro = null; }
      if (this._hro) { this._hro.disconnect(); this._hro = this._hroEl = null; }
      cancelAnimationFrame(this._hRaf);
      if (this._g) this._g.stopp();
      this._srvClose(true);
    }
    get styles() {
      return `
        .hd{display:flex;flex-direction:column;gap:18px;padding-top:8px}
        .top{container-type:inline-size;display:flex;align-items:center;justify-content:space-between;gap:10px}
        .lc{display:flex;flex-direction:column;gap:6px;min-width:0;flex:1 1 0}
        .ttl{display:flex;flex-wrap:nowrap;align-items:center;column-gap:6px;row-gap:0;line-height:1;white-space:nowrap;min-width:0;max-width:100%;overflow:hidden;text-align:left;color:var(--ki-text, var(--white,#fafafa));touch-action:manipulation;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent}
        .ttl .tx{flex:0 1 auto;min-width:0;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .sub{align-self:flex-start;font-size:15px;color:var(--ki-text-mid, var(--gray700,#979797));white-space:nowrap;text-align:left}
        .sub:active{opacity:.6}
        .faces{display:flex;flex:none;align-items:flex-start}
        .face{position:relative;display:flex;flex-direction:column;align-items:center;gap:4px;flex:none}
        .fw{position:relative;display:block}
        .av{display:grid;place-items:center;overflow:hidden;position:relative}
        .av img{display:block;width:100%;height:100%;object-fit:cover;border-radius:inherit;-webkit-user-drag:none;user-select:none;pointer-events:none}
        .bd{z-index:1}
        .bd{position:absolute;display:grid;place-items:center;transition:background-color .3s,color .3s}
        .lb{display:flex;flex-direction:column;align-items:center}
        .ln{font-size:11px;font-weight:500}
        .lp{font-size:10px;color:var(--ki-text-mid, var(--gray700,#979797))}
        .row2{display:flex;flex-wrap:wrap;gap:14px;padding:4px 0 0 2px}
        /* Profil. Personer → prosa: 22 px synlig avstand (containerens gap 22 + prosaens luft over første linje − 8) */
        .prof{gap:22px;margin-bottom:-8px}
        .prof .top{align-items:flex-start}
        .prof .ttl{line-height:1.1;column-gap:10px;flex-wrap:wrap}
        /* chevron ▾ alltid rett etter navnet (samme linje); navnet kortes heller med … */
        .prof .sub{color:var(--ki-text-2, var(--gray800,#afafaf))}
        .prof .row2{gap:14px;padding:0}
        /* Fiks 17.13/17.20: Hilsen/Sted – én rad, vertikalt sentrert; ▾ rett etter teksten (4 px); ingen klipping av emoji/descendere */
        .hil .top{align-items:center}
        .hil .ttl{line-height:1.15;column-gap:4px;max-width:none;overflow:visible}
        .hil .faces{align-items:center}
        /* Fiks 26.22: bildene har fast størrelse (side om side, aldri overlapp); hilsen + ▾ på én linje, langt navn → «…» */
        .hil .lc{flex:1 1 0;min-width:0}
        .hil .faces{flex:none}
        .hil .ttl{overflow:hidden;max-width:100%;color:var(--ki-text, #fafafa)}
        .hil .ttl .tx{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        /* ikke plass på én rad (smal skjerm / mange personer): bildene på egen rad under hilsenen, høyrejustert */
        .hil.hwrap .top{flex-wrap:wrap;row-gap:12px}
        .hil.hwrap .lc{flex:1 0 100%}
        .hil.hwrap .faces{margin-left:auto}
        /* Fiks 37: pila (åpner «Bytt sted») roterer når menyen er åpen; skjules først når navnet ikke får plass */
        .pil{display:inline-flex;align-items:center;flex:none;align-self:center;transition:transform .2s ease}
        .pil.apen{transform:rotate(180deg)}
        .upil .ttl .pil{display:none}
        /* «under»: stedsnavn + liten pil (20 px) på linja under, «•» før værteksten */
        .sub2{display:flex;align-items:center;gap:6px;min-width:0;font-size:15px;color:var(--ki-text-mid, var(--gray700,#979797));white-space:nowrap}
        .svv,.svn{display:inline-flex;align-items:center;gap:2px;flex:none;color:var(--ki-text, #fafafa);font-weight:500;font-size:15px;-webkit-tap-highlight-color:transparent}
        .svv{cursor:pointer}
        .sk{opacity:.6;flex:none}
        .sub2 .sub{min-width:0;overflow:hidden;text-overflow:ellipsis}
        .nop{width:52px;height:52px;border-radius:26px;display:grid;place-items:center;background:var(--ki-surface, var(--gray200,#3a3a3a));color:var(--ki-text-mid, var(--gray700,#979797))}
      `;
    }
  }
  M.define('msh-hjem-header-card', HjemHeader, 'MSH Hjem · header', 'Hilsen, vær og personprofiler med soner, hurtigark og servermeny. Ligger på Hjem-visningen.');
})();
