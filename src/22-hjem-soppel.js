/* msh-soppel-card · Hjem-visningen, søppelkortet. Kilde: Hjem v2.dc.html (L.trash-seksjonen, trashCfg/openTrashPop,
 * ce.trash i «Popups»-fanen). Åpner en ekstern Bubble Card-popup: popup_hash (standard #soppel).
 * Config: sensor (dager til tømming – tall, dato eller attributt days/daysTo), valgfri type_sensor.
 * Autokonfig: første sensor med søppel/avfall/renovasjon/waste/garbage i navnet. Kortet vises alltid («–» uten sensor).
 * Fiks 17.14: tømmedagen (dager = 0, eller ≤ rosa_dager) → rosa kort: stort tall til venstre, tittel + avfallstyper til høyre.
 *   Tilstand «0,Restavfall,Plastavfall» (brukerens sensor.neste_tomming): første del = dager, resten = avfallstypene.
 *   Config: sensor (alias entity; standard sensor.neste_tomming hvis den finnes), rosa (standard på), rosa_dager (0 | 1),
 *   tekst_i_dag / tekst_en / tekst_flere (titlene). Trykk → popup_hash, hold → more-info.
 */
(function () {
  const M = window.MSH, esc = M.esc, C = M.C;
  const PINK = 'linear-gradient(135deg, #f294c8, #f5cfd0)';
  const TXT = { i_dag: 'Søppeltømming i dag', en: 'Dag til neste søppeltømming', flere: 'Dager til neste søppeltømming' };
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
          <div class="nw"><span class="n num" data-key="n${n == null ? 'x' : n}">${n == null ? '–' : n}</span>${anim && !pink ? `<span class="bin">${M.icon('delete', 26)}</span>` : ''}</div>
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
        /* Fiks 17.14 · tømmedagen: rosa kort (PINK), radius 40, ingen kant, ca. 208 px, stort tall 35 % til venstre */
        .tr.pink{grid-template-columns:35% 1fr;gap:12px;min-height:208px;padding:28px 24px 28px 16px;border-radius:40px;background:${PINK};color:#000;border:0}
        .pink .nw{height:auto}
        .pink .n{font-size:110px;font-weight:800;color:#000;letter-spacing:-0.05em}
        .pink .tx{gap:14px}
        .pink .l1{font-size:30px;font-weight:500;line-height:1.2;color:#000;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
        .pink .l2{font-size:19px;font-weight:500;color:#000}
        .an.due.pink .n{animation:roll .7s cubic-bezier(.34,1.56,.64,1) both}
        .tr.press:active{transform:scale(.97)}
        .nw{position:relative;display:grid;place-items:center;height:72px;overflow:visible}
        .n{display:block;text-align:center;font-size:72px;font-weight:600;letter-spacing:-0.04em;line-height:1;font-variant-numeric:tabular-nums}
        .bin{position:absolute;right:calc(50% - 64px);top:-14px;color:var(--gray700,#979797);opacity:0;transform:translateY(6px) scale(.8);transition:opacity .3s,transform .4s cubic-bezier(.34,1.6,.64,1)}
        .tx{display:flex;flex-direction:column;gap:10px;min-width:0;align-items:flex-start}
        .l1{font-size:21px;font-weight:500;line-height:1.3}
        .l2{font-size:14px;font-weight:500}
        .an .n{animation:roll .7s cubic-bezier(.34,1.56,.64,1) both}
        .an.due .n{animation:roll .7s cubic-bezier(.34,1.56,.64,1) both,nudge 3.6s ease-in-out 1s infinite}
        .an.due .bin{opacity:1;transform:none;color:var(--orange,#f2b573);animation:lid 3.6s ease-in-out 1s infinite}
        @keyframes roll{0%{opacity:0;transform:translateY(40%) scale(.7);filter:blur(4px)}60%{opacity:1;filter:blur(0)}100%{opacity:1;transform:none}}
        @keyframes nudge{0%,82%,100%{transform:none}86%{transform:rotate(-5deg) scale(1.04)}90%{transform:rotate(4deg) scale(1.04)}94%{transform:rotate(-2deg)}}
        @keyframes lid{0%,80%,100%{transform:none}85%{transform:translateY(-6px) rotate(-14deg)}92%{transform:translateY(-2px) rotate(6deg)}}
        @media (prefers-reduced-motion: reduce){.an .n,.an.due .n,.an.due .bin{animation:none}}
      `;
    }
  }
  M.define('msh-soppel-card', Soppel, 'MSH Hjem · søppel', 'Dager til neste søppeltømming. Trykk åpner søppel-popupen (#soppel).');
})();
