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
  class Soppel extends M.Card {
    static get cardName() { return 'Hjem · søppel'; }
    static get defaults() { return { popup_hash: '#soppel', rosa: true, rosa_dager: 0 }; }
    static getConfigElement() { return M.hjemEditorEl ? M.hjemEditorEl(this) : super.getConfigElement(); }
    static get schema() {
      return [
        { type: 'info', label: 'Søppelkort · trykk åpner Bubble Card-popup' },
        { type: 'hash', name: 'popup_hash', label: 'Popup-hash', placeholder: '#soppel' },
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
      if (name === 'open') return M.openPopup(this.config.popup_hash || '#soppel');
      return super.onAction(name, el, ev);
    }
    get styles() {
      return `
        .tr{display:grid;grid-template-columns:1fr 1fr;align-items:center;gap:16px;padding:40px 8px;cursor:pointer;-webkit-user-select:none;user-select:none;box-sizing:border-box;border-radius:0;background:transparent;transition:background .3s,border-radius .3s,padding .3s,color .3s}
        /* Fiks 19.10 · tømmedagen (Hjem v3 trashToday): rosa kort, radius 30, padding 24/20, høyden følger innholdet (ca. 120 px) */
        .tr.pink{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px;align-items:center;min-height:0;padding:24px 20px;border-radius:30px;background:${PINK};color:#2a1720;border:0}
        .pink .nw{height:auto}
        .pink .n{font-size:60px;font-weight:600;color:#2a1720;letter-spacing:-0.04em}
        .pink .tx{gap:6px;min-width:0}
        .pink .l1{font-size:19px;font-weight:500;line-height:1.25;color:#2a1720;text-wrap:balance;overflow-wrap:anywhere;white-space:normal;max-width:100%}
        .pink .l2{font-size:13px;font-weight:500;line-height:1.3;color:#2a1720;overflow-wrap:anywhere;max-width:100%}
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
  M.define('msh-soppel-card', Soppel, 'MSH Hjem · søppel', 'Dager til neste søppeltømming. Trykk åpner søppel-popupen (#soppel).');
})();
