/* msh-soppel-card · Hjem-visningen, søppelkortet. Kilde: Hjem v2.dc.html (L.trash-seksjonen, trashCfg/openTrashPop,
 * ce.trash i «Popups»-fanen). Åpner en ekstern Bubble Card-popup: popup_hash (standard #soppel).
 * Config: sensor (dager til tømming – tall, dato eller attributt days/daysTo), valgfri type_sensor.
 * Autokonfig: første sensor med søppel/avfall/renovasjon/waste/garbage i navnet. Kortet vises alltid («–» uten sensor).
 * Fiks 17.14: tømmedagen (dager = 0, eller ≤ rosa_dager) → rosa kort: stort tall til venstre, tittel + avfallstyper til høyre.
 *   Tilstand «0,Restavfall,Plastavfall» (brukerens sensor.neste_tomming): første del = dager, resten = avfallstypene.
 *   Config: sensor (alias entity; standard sensor.neste_tomming hvis den finnes), rosa (standard på), rosa_dager (0 | 1),
 *   tekst_i_dag / tekst_en / tekst_flere (titlene). Trykk → popup_hash, hold → more-info.
 * Fiks 19.10: tømmedagen (Hjem v3 trashToday) er lavere: padding 24/20, ingen min-høyde (ca. 120 px), tall 60 px, tittel 19 px
 *   som brytes inni kolonnen (min-width 0, overflow-wrap anywhere) – teksten går aldri ut over kanten.
 * Fiks 18.2: ingen søppelkasse-ikon (som Hjem v3) – tallet står alene og sentrert i venstre kolonne; `ikon` i config ignoreres.
 * Fiks 20.2 (Hjem v3 · ce.trash.acts / TRASH_ACTS / openTrashPop): Trykk og Hold (550 ms) har hver sin handling i HA-format:
 *   tap_action / hold_action = { action: 'popup'|'navigate'|'more-info'|'call-service'|'url'|'none', hash, navigation_path,
 *   entity, service, url_path }. Standard: Trykk = popup #soppel, Hold = more-info (sensoren). Eldre popup_hash leses som
 *   tap_action { action: 'popup', hash }. HAs ui_action-format (perform-action/perform_action, navigate '#x') godtas også.
 *   Editoren (begge – samme schema): nedtrekksliste (ikon + navn, 44 px, #282828) + felt for handlingen + undertekst.
 */
(function () {
  const M = window.MSH, esc = M.esc, C = M.C;
  const PINK = 'linear-gradient(145deg, rgb(242 146 204), rgb(245 205 206))'; // Hjem v3 · trashToday (fiks 19.10)
  const TXT = { i_dag: 'Søppel tømmes i dag', en: 'Dag til neste søppeltømming', flere: 'Dager til neste søppeltømming' };
  const og = (a) => (a.length > 1 ? `${a.slice(0, -1).join(', ')} og ${a[a.length - 1]}` : a[0] || '');
  // «0,Restavfall,Plastavfall» → { days: 0, types: 'Restavfall og Plastavfall' }; ellers som før (M.hjemTrashDays/Type)
  M.hjemTrashParse = function (st, typeSt) {
    if (!st || M.unavailable(st)) return { days: null, types: typeSt ? M.hjemTrashType(null, typeSt) : null };
    const parts = String(st.state).split(',').map((x) => x.trim());
    if (parts.length > 1 && /^-?\d+$/.test(parts[0])) {
      const t = parts.slice(1).filter(Boolean);
      return { days: Number(parts[0]), types: typeSt ? M.hjemTrashType(st, typeSt) : t.length ? og(t) : M.hjemTrashType(st, null) };
    }
    return { days: M.hjemTrashDays(st), types: M.hjemTrashType(st, typeSt) };
  };
  // Standard: sensor.neste_tomming når den finnes (brukerens sensor), ellers autokonfig
  const autoSensor = (h) => (h && h.states && h.states['sensor.neste_tomming'] ? 'sensor.neste_tomming' : M.hjemTrashAuto ? M.hjemTrashAuto(h) : null);
  // Fiks 20.2 · handlinger for trykk og hold (Hjem v3 TRASH_ACTS): [id, navn, ikon, undertekst]
  const ACTS = [
    ['none', 'Ingen', 'mdi:cancel', 'Ingenting skjer.'],
    ['popup', 'Åpne popup', 'mdi:card-outline', 'Åpner Bubble Card-popupen med denne hashen (location.hash).'],
    ['navigate', 'Naviger til visning', 'mdi:compass-outline', 'Går til en annen visning i Home Assistant, f.eks. /dashboard-hjem/avfall.'],
    ['more-info', 'More-info', 'mdi:information-outline', 'Viser detaljene for entiteten. Tomt = sensoren for dager til tømming.'],
    ['call-service', 'Kjør tjeneste / script', 'mdi:play-circle-outline', 'Kaller tjenesten (domene.tjeneste). script.* kjøres som script.turn_on.'],
    ['url', 'Åpne URL', 'mdi:open-in-new', 'Åpner adressen i en ny fane.'],
  ];
  const ACT_DEF = { tap_action: 'popup', hold_action: 'more-info' };
  // Effektiv handling: tap_action/hold_action (også HA ui_action-format), ellers popup_hash (migrering) / standard
  M.hjemTrashAct = function (c, kind) {
    c = c || {};
    let a = c[kind];
    if (typeof a === 'string') a = { action: a };
    if (!a || typeof a !== 'object') a = kind === 'tap_action' && c.popup_hash ? { action: 'popup', hash: c.popup_hash } : {};
    let act = String(a.action || ACT_DEF[kind]);
    if (act === 'perform-action') act = 'call-service';
    const r = { ...a, action: ACTS.some((x) => x[0] === act) ? act : ACT_DEF[kind] };
    if (r.action === 'navigate' && String(r.navigation_path || '')[0] === '#') { r.action = 'popup'; r.hash = r.hash || r.navigation_path; }
    if (r.action === 'popup' && !r.hash) r.hash = kind === 'tap_action' && c.popup_hash ? c.popup_hash : '#soppel';
    if (r.action === 'call-service' && !r.service) r.service = r.perform_action || '';
    return r;
  };
  // Utfør handlingen (el = kortet, sensor = standard-entiteten for more-info)
  M.hjemTrashRun = function (el, a, sensor, hass) {
    const h = hass || M.lastHass;
    switch (a.action) {
      case 'popup': return M.openPopup(a.hash || '#soppel');
      case 'navigate': { const p = String(a.navigation_path || '').trim(); if (!p) return; if (p[0] === '#') return M.openPopup(p); history.pushState(null, '', p); window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: false } })); return; }
      case 'more-info': return M.moreInfo(el, a.entity || sensor);
      case 'call-service': {
        const sv = String(a.service || '').trim(), i = sv.indexOf('.');
        if (i < 1 || !h) return;
        const dom = sv.slice(0, i), svc = sv.slice(i + 1), data = { ...(a.data || a.service_data || {}), ...(a.target || {}) };
        const isSvc = h.services && h.services[dom] && h.services[dom][svc];
        if (dom === 'script' && !isSvc) return M.call(h, 'script', 'turn_on', { ...data, entity_id: sv }).catch(() => {});
        return M.call(h, dom, svc, data).catch(() => {});
      }
      case 'url': { const u = String(a.url_path || '').trim(); if (u) { try { window.open(u, '_blank', 'noopener'); } catch (e) { /* */ } } return; }
      default:
    }
  };
  // Editor-felt (msh-hjem-editor 'html' → render(hass, cfg)): nedtrekksliste + felt under + undertekst
  const actField = (kind, label) => ({
    type: 'html',
    render(h, c) {
      const a = M.hjemTrashAct(c, kind), A = ACTS.find((x) => x[0] === a.action) || ACTS[0], k = kind;
      const inp = (f, v, ph, extra) => `<input class="inp" style="height:44px;border-radius:14px;background:var(--ki-surface-3, #282828);padding:0 14px" autocapitalize="off" autocorrect="off" spellcheck="false" inputmode="text" data-name="${k}.${f}" value="${esc(v || '')}" placeholder="${esc(ph)}" ${extra || ''}>`;
      let sub = '';
      if (a.action === 'popup') sub = M.popupPicker ? M.popupPicker.html({ key: 'tr-ph-' + k, name: k + '.hash', value: a.hash || '', placeholder: '#soppel', label: 'Popup' }) : inp('hash', a.hash, '#soppel');
      else if (a.action === 'navigate') sub = inp('navigation_path', a.navigation_path, '/dashboard-hjem/avfall');
      else if (a.action === 'more-info') sub = M.entityPicker ? M.entityPicker.html({ key: 'tr-me-' + k, name: k + '.entity', value: a.entity || '', placeholder: 'Sensoren for dager til tømming' }) : inp('entity', a.entity, 'sensor.neste_tomming');
      else if (a.action === 'call-service') {
        const sv = h && h.services ? Object.keys(h.services).flatMap((d) => Object.keys(h.services[d]).map((x) => d + '.' + x)).concat(Object.keys((h && h.states) || {}).filter((x) => x.startsWith('script.'))).sort() : [];
        sub = inp('service', a.service, 'script.hent_soppel', `list="tr-sv-${k}"`) + `<datalist id="tr-sv-${k}">${sv.slice(0, 400).map((x) => `<option value="${esc(x)}"></option>`).join('')}</datalist>`;
      } else if (a.action === 'url') sub = inp('url_path', a.url_path, 'https://…', 'type="url" inputmode="url"');
      return `<div class="f" data-key="tract-${k}"><label>${esc(label)}</label>
        <label class="tract" style="position:relative;display:flex;align-items:center;gap:10px;height:44px;padding:0 12px;border-radius:14px;background:var(--ki-surface-3, #282828);color:var(--ki-text, #fafafa);font-size:14px;font-weight:500;cursor:pointer">${M.icon(A[2], 20, 'color:var(--ki-text-2, #afafaf);flex:none')}<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(A[1])}</span>${M.icon('mdi:unfold-more-horizontal', 18, 'color:var(--ki-text-mid, #979797);flex:none')}
          <select data-name="${k}.action" aria-label="${esc(label)}" style="position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer;font-size:16px;-webkit-appearance:none;appearance:none">${ACTS.map(([v, l]) => `<option value="${v}" ${v === a.action ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
        ${sub}<span class="help">${esc(A[3])}</span></div>`;
    },
    html(h, c) { return this.render(h, c); }, // felles msh-editor ('html' → f.html)
  });
  const TAP_MODES = ['std', 'popup', 'hash', 'path', 'url', 'more', 'service', 'none'];
  class Soppel extends M.Card {
    static get cardName() { return 'Hjem · søppel'; }
    static get defaults() { return { rosa: true, rosa_dager: 0 }; }
    static getConfigElement() { return M.hjemEditorEl ? M.hjemEditorEl(this) : super.getConfigElement(); }
    static get schema() {
      return [
        { type: 'info', label: 'Søppelkort · velg hva trykk og hold gjør' },
        // Fiks 30.3: felles handlingsvelger (msh-tap-picker, HA-format) – samme valg som «Tilpass Hjem» → Søppelkort.
        // Gamle former (popup_hash, { action: popup, hash }, call-service) leses fortsatt (M.tap.norm / M.hjemTrashAct).
        { type: 'tap', name: 'tap_action', label: 'Trykk', modes: TAP_MODES, stdHint: 'Standard: åpner popupen #soppel', auto: (h, c) => (!c.tap_action && c.popup_hash ? { action: 'navigate', navigation_path: c.popup_hash } : null) },
        { type: 'tap', name: 'hold_action', label: 'Hold', modes: TAP_MODES, stdHint: 'Standard: more-info for sensoren', noneHint: 'Ingen handling ved hold.' },
        { type: 'select', name: 'action_style', label: 'Handlingsvelger', options: [['ruter', 'Ruter'], ['liste', 'Liste']], default: 'ruter' },
        { type: 'entity', name: 'sensor', label: 'Entitet · dager til tømming', domain: 'sensor', auto: autoSensor, help: 'Tall (dager), «0,Restavfall,Plastavfall», dato eller attributt days/daysTo' },
        { type: 'entity', name: 'type_sensor', label: 'Sensor · type avfall (valgfri)', domains: ['sensor', 'input_text', 'input_select'] },
        { type: 'boolean', name: 'rosa', label: 'Rosa på tømmedagen', default: true },
        { type: 'select', name: 'rosa_dager', label: 'Rosa også dagen før', options: [[0, 'Bare i dag'], [1, 'Også dagen før']], default: 0 },
        { type: 'text', name: 'tekst_i_dag', label: 'Tittel · i dag (0)', placeholder: TXT.i_dag },
        { type: 'text', name: 'tekst_en', label: 'Tittel · 1 dag', placeholder: TXT.en },
        { type: 'text', name: 'tekst_flere', label: 'Tittel · flere dager', placeholder: TXT.flere },
        { type: 'text', name: 'title', label: 'Fast tittel (overstyrer de tre over)', placeholder: '' },
        { type: 'boolean', name: 'animate', label: 'Animasjon', default: true },
      ];
    }
    get cardSize() { return 3; }
    customize(focus) { return M.hjemCustomize ? M.hjemCustomize(this, focus) : super.customize(focus); }
    _sensor() { return this.config.sensor || this.config.entity || autoSensor(this.hass); }
    render() {
      const c = this.config, id = this._sensor(), st = this.s(id), tst = this.s(c.type_sensor);
      const P = M.hjemTrashParse(st, tst), n = st ? P.days : null;
      const type = st || tst ? P.types : null;
      const label = c.title || (n === 0 ? c.tekst_i_dag || TXT.i_dag : n === 1 ? c.tekst_en || TXT.en : c.tekst_flere || TXT.flere);
      const due = n != null && n <= 1;
      const pink = c.rosa !== false && n != null && n >= 0 && n <= (Number(c.rosa_dager) || 0); // Fiks 17.14
      const anim = c.animate !== false;
      return `<section class="tr press ${anim ? 'an' : ''} ${due ? 'due' : ''} ${pink ? 'pink' : ''}" data-act="open" ${id ? `data-ent="${esc(id)}"` : ''}>
          <div class="nw"><span class="n num" data-key="n${n == null ? 'x' : n}">${n == null ? '–' : n}</span></div>
          <div class="tx">
            <div class="l1">${esc(label)}</div>
            ${type ? `<div class="l2">${esc(type)}</div>` : !st ? `<button class="pick press" data-act="customize">${M.icon('mdi:plus', 18)}Velg entitet</button>` : ''}
          </div>
        </section>`;
    }
    onAction(name, el, ev) {
      if (name === 'open') return M.hjemTrashRun(this, M.hjemTrashAct(this.config, 'tap_action'), this._sensor(), this.hass);
      return super.onAction(name, el, ev);
    }
    // Fiks 20.2: hold 550 ms → hold_action (haptic medium når holdet slår til; klikket etter holdet spises av _onClick)
    _onDown(e) {
      if (e.button) return;
      const el = this._el(e, '.tr', true);
      if (!el || this._el(e, '.pick', true)) return;
      this._hx = e.clientX; this._hy = e.clientY;
      this._cancelHold();
      this._hold = setTimeout(() => {
        this._hold = null;
        this._swallow = true;
        setTimeout(() => { this._swallow = false; }, 600);
        M.haptic('medium');
        M.hjemTrashRun(this, M.hjemTrashAct(this.config, 'hold_action'), this._sensor(), this.hass);
      }, 550);
    }
    connectedCallback() {
      super.connectedCallback();
      if (!this._ctx) { this._ctx = true; this.shadowRoot.addEventListener('contextmenu', (e) => { if (this._el(e, '.tr', true)) e.preventDefault(); }); }
    }
    get styles() {
      return `
        /* Fiks 57 A · lys modus: ÉN dekkende flate (--ki-surface #fff, radius 28 som Låst/Stue/Strømpris, --ki-card-sh = kant
           inset 0 0 0 1px rgba(0,0,0,.05) + svak skygge), ingen alfa/backdrop-filter – ingen skjøt fra bakgrunnen bak kan synes
           gjennom. Mørk modus: tokenene er udefinert → transparent, ingen skygge, samme padding (uendret). */
        :host{--sop-pad:var(--ki-lt) 40px 20px}
        .tr{display:grid;grid-template-columns:1fr 1fr;align-items:center;gap:16px;padding:var(--sop-pad, 40px 8px);cursor:pointer;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;box-sizing:border-box;border-radius:28px;background:var(--ki-surface, transparent);box-shadow:var(--ki-card-sh, none);-webkit-backdrop-filter:none;backdrop-filter:none;transition:background .3s,border-radius .3s,padding .3s,color .3s,box-shadow .3s}
        /* Fiks 19.10 · tømmedagen (Hjem v3 trashToday): rosa kort, radius 30, padding 24/20, høyden følger innholdet (ca. 120 px) */
        .tr.pink{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px;align-items:center;min-height:0;padding:24px 20px;border-radius:30px;background:${PINK};color:var(--ki-on-accent, #2a1720);border:0;box-shadow:none}
        .pink .nw{height:auto}
        .pink .n{font-size:60px;font-weight:600;color:var(--ki-on-accent, #2a1720);letter-spacing:-0.04em}
        .pink .tx{gap:6px;min-width:0}
        .pink .l1{font-size:19px;font-weight:500;line-height:1.25;color:var(--ki-on-accent, #2a1720);text-wrap:balance;overflow-wrap:anywhere;white-space:normal;max-width:100%}
        .pink .l2{font-size:13px;font-weight:500;line-height:1.3;color:var(--ki-on-accent, #2a1720);overflow-wrap:anywhere;max-width:100%}
        .an.due.pink .n{animation:roll .7s cubic-bezier(.34,1.56,.64,1) both}
        .tr.press:active{transform:scale(.97)}
        .nw{position:relative;display:grid;place-items:center;height:72px;overflow:visible}
        .n{display:block;text-align:center;font-size:72px;font-weight:600;letter-spacing:-0.04em;line-height:1;font-variant-numeric:tabular-nums}
        .tx{display:flex;flex-direction:column;gap:10px;min-width:0;align-items:flex-start}
        .l1{font-size:21px;font-weight:500;line-height:1.3}
        .l2{font-size:14px;font-weight:500}
        .an .n{animation:roll .7s cubic-bezier(.34,1.56,.64,1) both}
        .an.due .n{animation:roll .7s cubic-bezier(.34,1.56,.64,1) both,nudge 3.6s ease-in-out 1s infinite}
        @keyframes roll{0%{opacity:0;transform:translateY(40%) scale(.7);filter:blur(4px)}60%{opacity:1;filter:blur(0)}100%{opacity:1;transform:none}}
        @keyframes nudge{0%,82%,100%{transform:none}86%{transform:rotate(-5deg) scale(1.04)}90%{transform:rotate(4deg) scale(1.04)}94%{transform:rotate(-2deg)}}
        @media (prefers-reduced-motion: reduce){.an .n,.an.due .n{animation:none}}
      `;
    }
  }
  M.define('msh-soppel-card', Soppel, 'MSH Hjem · søppel', 'Dager til neste søppeltømming. Trykk og hold kan velges (popup, visning, more-info, tjeneste, URL).');
})();
