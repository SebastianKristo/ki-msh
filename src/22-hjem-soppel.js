/* msh-soppel-card · Hjem-visningen, søppelkortet. Kilde: Hjem v2.dc.html (L.trash-seksjonen, trashCfg/openTrashPop,
 * ce.trash i «Popups»-fanen). Åpner en ekstern Bubble Card-popup: popup_hash (standard #soppel).
 * Config: sensor (dager til tømming – tall, dato eller attributt days/daysTo), valgfri type_sensor.
 * Autokonfig: første sensor med søppel/avfall/renovasjon/waste/garbage i navnet. Kortet vises alltid («–» uten sensor).
 */
(function () {
  const M = window.MSH, esc = M.esc, C = M.C;
  class Soppel extends M.Card {
    static get cardName() { return 'Hjem · søppel'; }
    static get defaults() { return { popup_hash: '#soppel' }; }
    static getConfigElement() { return M.hjemEditorEl ? M.hjemEditorEl(this) : super.getConfigElement(); }
    static get schema() {
      return [
        { type: 'info', label: 'Søppelkort · trykk åpner Bubble Card-popup' },
        { type: 'hash', name: 'popup_hash', label: 'Popup-hash', placeholder: '#soppel' },
        { type: 'entity', name: 'sensor', label: 'Sensor · dager til tømming', domain: 'sensor', auto: (h) => (M.hjemTrashAuto ? M.hjemTrashAuto(h) : null), help: 'Tall (dager), dato eller attributt days/daysTo' },
        { type: 'entity', name: 'type_sensor', label: 'Sensor · type avfall (valgfri)', domains: ['sensor', 'input_text', 'input_select'] },
        { type: 'text', name: 'title', label: 'Tekst', placeholder: 'Dager til neste søppeltømming' },
        { type: 'boolean', name: 'animate', label: 'Animasjon', default: true },
      ];
    }
    get cardSize() { return 3; }
    customize(focus) { return M.hjemCustomize ? M.hjemCustomize(this, focus) : super.customize(focus); }
    _sensor() { return this.config.sensor || (M.hjemTrashAuto ? M.hjemTrashAuto(this.hass) : null); }
    render() {
      const c = this.config, id = this._sensor(), st = this.s(id), tst = this.s(c.type_sensor);
      const n = st ? M.hjemTrashDays(st) : null;
      const type = st || tst ? M.hjemTrashType(st, tst) : null;
      const label = c.title || (n === 0 ? 'Søppeltømming i dag' : n === 1 ? 'Dag til neste søppeltømming' : 'Dager til neste søppeltømming');
      const due = n != null && n <= 1;
      const anim = c.animate !== false;
      return `<section class="tr press ${anim ? 'an' : ''} ${due ? 'due' : ''}" data-act="open" ${id ? `data-ent="${esc(id)}"` : ''}>
          <div class="nw"><span class="n num" data-key="n${n == null ? 'x' : n}">${n == null ? '–' : n}</span>${anim ? `<span class="bin">${M.icon('delete', 26)}</span>` : ''}</div>
          <div class="tx">
            <div class="l1">${esc(label)}</div>
            ${type ? `<div class="l2">${esc(type)}</div>` : !id ? `<button class="pick press" data-act="customize">${M.icon('mdi:plus', 18)}Velg sensor</button>` : ''}
          </div>
        </section>`;
    }
    onAction(name, el, ev) {
      if (name === 'open') return M.openPopup(this.config.popup_hash || '#soppel');
      return super.onAction(name, el, ev);
    }
    get styles() {
      return `
        .tr{display:grid;grid-template-columns:1fr 1fr;align-items:center;gap:16px;padding:40px 8px;cursor:pointer;-webkit-user-select:none;user-select:none}
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
