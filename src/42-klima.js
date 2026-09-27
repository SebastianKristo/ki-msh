/* msh-klima-hero-card + msh-klima-card · Klima-popup (#klima). Fasit: Klima v3 (hero-ideer 2a) + Klima v2.dc.html,
 * funksjon/data fra KI Energi-integrasjonen (ki-klima-strom-kort.js v1.23.0).
 * Denne fila er SKALLET (fiks-4 punkt 4.0, 4.1, 4.4, 4.6, 4.7):
 *   · Hero 2a (msh-klima-hero-card, bygd inn via MSH.HEROES): ring 128 px (ytre = tid i timen, indre = effekt nå mot
 *     tillatt snitt i statusfarge), status + setning + «N min igjen av timen», timebudsjett-bar (brukt · prognose ·
 *     nå-strek) og borte-pillen. Farger etter tersklene number.ki_terskel_gul/oransje/rod (Avansert → Terskler).
 *     Animasjoner med Web Animations API når popupen åpnes og ved bytte tilbake til Oversikt; rolig puls i løkke
 *     (stoppes når popupen lukkes); live-verdier glir 300 ms; ingen animasjon ved prefers-reduced-motion.
 *   · Modus-bobler (Borte · Alle borte · Hjemkomst · Sommer · <person> ferie) → switch.ki_* i integrasjonen.
 *   · Glass-fanerad (scroller, min 58 px per fane, MSH.tabReorder = dra/omorganiser + glass-linse ved trykk) +
 *     tannhjul (46 px, samme glass) som åpner «Tilpass klima».
 *   · «Tilpass klima»: eget bunnark (MSH.overlay – solid, frosted med Liquid Glass-tema) med Visning / Faner / Blokker. Tilbakestill
 *     øverst til venstre, Ferdig lagrer (MSH.saveCardConfig, scope 'shared'). Utkastet vises live bak arket.
 * Blokkene (faneinnholdet) bygges i 42-klima-blokker.js (lastes før denne): MSH.KLIMA_TABS, klimaHasTab,
 * klimaBlockList, klimaTabHTML, klimaAct, klimaInput, klimaAfterRender, klimaOnOpen/OnClose, KLIMA_BLOCK_CSS,
 * klimaToast, klimaStatus. Alt kalles defensivt – mangler fila, vises en plassholder.
 * Config: title, remember_tab, toasts, layout: { show_hero, show_modes, tab_style: both|text|icon, tab_order[],
 *   hidden_tabs[], default_tab, block_order: { fane: [id] }, hidden_blocks: { fane: [id] } }.
 */
(function () {
  const M = window.MSH, esc = M.esc, nf = M.nf;
  const PINK = M.C.accent, INK = '#3a3a3a';

  /* ------------------------------------------------------------ felles hjelpere (også brukt av 43-lys) */
  // Lagre en endring i kortets config (fersk lovelace-config → kun dette kortet). Oppdaterer kortet straks.
  M.mshPatchConfig = M.mshPatchConfig || async function (card, patch) {
    const old = card._rawConfig || card._config || {};
    const next = { ...old, ...patch };
    Object.keys(patch).forEach((k) => { if (patch[k] === undefined || patch[k] === null) delete next[k]; });
    card.setConfig(next);
    try { const res = await M.saveCardConfig(card.hass, old, next); if (res && res.config && res.config.card_id !== next.card_id) card.setConfig(res.config); } catch (e) { /* */ }
  };
  // Bakoverkompatibel tynn wrapper rundt MSH.tabReorder (05-tab-reorder.js): langt trykk + dra = omorganiser
  // (onReorder(keys)); valgfritt «liquid glass»-valg (onSelect(key), glass: true). Knappene må ha data-key.
  M.mshTabDrag = M.mshTabDrag || function (card, nav, { onReorder, onSelect, glass } = {}) {
    if (!nav) return null;
    return M.tabReorder(nav, { card, onReorder, onSelect, glass, styleRow: false, items: () => Array.from(nav.querySelectorAll('[data-key]')) });
  };
  // Ordne liste etter lagret rekkefølge; skjulte fjernes.
  M.mshOrder = M.mshOrder || function (keys, order, hidden) {
    const hid = new Set(hidden || []);
    const out = (Array.isArray(order) ? order.filter((k) => keys.includes(k)) : []);
    keys.forEach((k) => { if (!out.includes(k)) out.push(k); });
    return out.filter((k) => !hid.has(k));
  };

  /* ------------------------------------------------------------ integrasjonen (KI Energi) */
  const ST = 'sensor.ki_energi_status', LASTER = 'sensor.ki_laster';
  // input_* fra pakke-tiden → integrasjonens entiteter (samme som mapId i JS-kortet)
  const DATO_TID = new Set(['ki_vvb_siste_godkjente_syklus', 'ki_vvb_oppvarming_startet', 'ki_vvb_boost_til', 'ki_hjemkomst_planlagt']);
  const mapId = (id) => {
    if (M.klimaMapId) return M.klimaMapId(id);
    if (!id || typeof id !== 'string') return id;
    const [dom, obj] = id.split('.');
    if (dom === 'input_boolean') return `switch.${obj}`;
    if (dom === 'input_number') return `number.${obj}`;
    if (dom === 'input_text') return `text.${obj}`;
    if (dom === 'input_datetime') return `${DATO_TID.has(obj) ? 'datetime' : 'time'}.${obj}`;
    return id;
  };
  const num = (v) => { if (v == null || v === '') return null; const n = Number(v); return isFinite(n) ? n : null; };
  const firstNum = (a, keys) => { for (const k of keys) { const n = num(a[k]); if (n != null) return n; } return null; };
  const attrs = (card, id) => { const s = card.s(id); return (s && s.attributes) || {}; };
  const reduced = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };

  // Faner (fallback til blokk-filen finnes)
  const TABS_FALLBACK = [
    { id: 'oversikt', label: 'Oversikt', icon: 'mdi:view-dashboard' },
    { id: 'soner', label: 'Soner', icon: 'mdi:home-thermometer' },
    { id: 'energi', label: 'Energi', icon: 'mdi:flash' },
    { id: 'vann', label: 'Vann og bad', icon: 'mdi:water-boiler' },
    { id: 'lading', label: 'Lading', icon: 'mdi:ev-station' },
    { id: 'tanker', label: 'Tanker', icon: 'mdi:head-cog' },
    { id: 'oppsett', label: 'Oppsett', icon: 'mdi:tune' },
    { id: 'avansert', label: 'Avansert', icon: 'mdi:wrench-cog' },
  ];
  const tabDefs = () => (Array.isArray(M.KLIMA_TABS) && M.KLIMA_TABS.length ? M.KLIMA_TABS : TABS_FALLBACK);
  // Eldre fane-nøkler (7-fane-versjonen) → nye
  const OLD_TAB = { ov: 'oversikt', so: 'soner', en: 'energi', vb: 'vann', ta: 'tanker', op: 'oppsett', av: 'avansert' };
  const tabId = (k) => OLD_TAB[k] || k;
  // Lading bare når laderen er koblet til integrasjonen (_harLading i JS-kortet)
  const harLading = (card) => {
    const f = attrs(card, ST).lading;
    if (f !== null && f !== undefined) return !!f;
    const s = card.s('sensor.ki_lading_status');
    return !!s && !['ingen', 'unavailable', 'unknown'].includes(s.state);
  };
  const hasTab = (card, id) => {
    if (M.klimaHasTab) { try { return !!M.klimaHasTab(card, id); } catch (e) { /* */ } }
    return id !== 'lading' || harLading(card);
  };
  const safe = (fn, fb) => { try { return fn(); } catch (e) { console.error('msh-klima-card', e); return fb; } };
  const blockList = (card, tab) => (M.klimaBlockList ? safe(() => M.klimaBlockList(card, tab) || [], []) : []);

  // Layout (config.layout) med standardverdier. Eldre rotnøkler (tab_order, hidden_tabs, start_tab) leses fortsatt.
  const LAY_DEF = { show_hero: true, show_modes: true, tab_style: 'both' };
  function layoutOf(c) {
    c = c || {};
    const L = c.layout && typeof c.layout === 'object' ? c.layout : {};
    const out = { ...LAY_DEF, ...L };
    if (!Array.isArray(out.tab_order) && Array.isArray(c.tab_order)) out.tab_order = c.tab_order.map(tabId);
    if (!Array.isArray(out.hidden_tabs) && Array.isArray(c.hidden_tabs)) out.hidden_tabs = c.hidden_tabs.map(tabId);
    if (!out.default_tab && c.start_tab) out.default_tab = tabId(c.start_tab);
    out.block_order = L.block_order && typeof L.block_order === 'object' ? L.block_order : {};
    out.hidden_blocks = L.hidden_blocks && typeof L.hidden_blocks === 'object' ? L.hidden_blocks : {};
    return out;
  }
  M.klimaLayout = layoutOf;
  // Synlige faner i rekkefølge (minst én)
  function visibleTabs(card, L) {
    const all = tabDefs().map((t) => t.id);
    const vis = M.mshOrder(all, L.tab_order, L.hidden_tabs).filter((id) => hasTab(card, id));
    if (vis.length) return vis;
    return all.filter((id) => hasTab(card, id)).slice(0, 1);
  }

  /* ------------------------------------------------------------ status og sone (hero) */
  const ZONES = {
    ok: { t: 'God margin', c: 'var(--green, rgb(102 209 158))' },
    yellow: { t: 'Nærmer seg grensen', c: 'var(--yellow, rgb(242 210 111))' },
    orange: { t: 'Liten margin', c: 'var(--orange, rgb(242 181 115))' },
    red: { t: 'Fare for ny topp', c: 'var(--red, rgb(242 128 115))' },
    critical: { t: 'Kritisk', c: 'rgb(240 86 110)' },
    fallback: { t: 'Trygg fallback', c: 'var(--blue, rgb(115 185 242))' },
    off: { t: 'Motoren er av', c: '#979797' },
    none: { t: '–', c: '#979797' },
  };
  M.KLIMA_ZONES = ZONES;
  // Integrasjonens sone-navn (SONE_TEKST) → skallets
  const ZONE_OF = { gronn: 'ok', gul: 'yellow', oransje: 'orange', rod: 'red', kritisk: 'critical', fallback: 'fallback', av: 'off' };
  // Tersklene for fargesonene (% av tillatt effekt): number.ki_terskel_* (eldre: number.ki_sone_*), ellers 75/88/97
  function thresholds(card) {
    const t = (k, d) => { for (const id of [`number.ki_terskel_${k}`, `number.ki_sone_${k}`]) { const n = card.n(id); if (n != null) return n; } return d; };
    return { yellow: t('gul', 75), orange: t('oransje', 88), red: t('rod', 97) };
  }
  M.klimaThresholds = thresholds;
  // Lokal beregning (brukes når blokk-filens MSH.klimaStatus mangler, og for felt den ikke gir)
  function statusLocal(card) {
    const s = card.s(ST), a = (s && s.attributes) || {};
    const d = new Date(), minClock = 60 - d.getMinutes() - d.getSeconds() / 60;
    const kw = firstNum(a, ['effekt_kw', 'effekt_na_kw', 'naa_kw', 'malt_effekt_kw', 'malt_kw', 'forventet_effekt_kw']);
    const allowed = firstNum(a, ['tillatt_effekt_kw']);
    const usedKwh = firstNum(a, ['forbrukt_kwh']);
    const limitKwh = firstNum(a, ['grense_kwh']);
    const minLeft = firstNum(a, ['minutter_igjen']) != null ? firstNum(a, ['minutter_igjen']) : Math.max(0, Math.round(minClock));
    let forecastKwh = firstNum(a, ['prognose_kwh', 'forventet_kwh', 'prognose_time_kwh']);
    if (forecastKwh == null && usedKwh != null && kw != null) forecastKwh = usedKwh + kw * (minLeft / 60);
    let freeKw = firstNum(a, ['ledig_kw']);
    if (freeKw == null && allowed != null && kw != null) freeKw = Math.max(0, allowed - kw);
    const pct = kw != null && allowed ? (kw / allowed) * 100 : null;
    const laster = Array.isArray(attrs(card, LASTER).laster) ? attrs(card, LASTER).laster : [];
    const lowered = laster.filter((l) => l && l.handling === 'senket').map((l) => l.navn).filter(Boolean);
    const cand = laster.filter((l) => l && l.type !== 'bryter' && l.handling === 'normal');
    const nextZone = a.neste_sone || a.neste_senking || (cand.length ? cand[cand.length - 1].navn : null);
    const T = thresholds(card), st = s ? String(s.state).toLowerCase() : '';
    const hb = card.s('switch.ki_energi_hovedbryter');
    let zone;
    if (!s || M.unavailable(s)) zone = 'none';
    else if (st === 'av' || (hb && hb.state === 'off')) zone = 'off';
    else if (st === 'fallback' || pct == null) zone = 'fallback';
    else if (st === 'kritisk' || pct > 100 || (limitKwh != null && usedKwh != null && usedKwh > limitKwh)) zone = 'critical';
    else if (pct >= T.red) zone = 'red';
    else if (pct >= T.orange) zone = 'orange';
    else if (pct >= T.yellow) zone = 'yellow';
    else zone = 'ok';
    return { kw, allowed, usedKwh, limitKwh, forecastKwh, freeKw, minLeft, pct, zone, lowered, nextZone, timeFrac: Math.min(1, Math.max(0, 1 - minLeft / 60)) };
  }
  M.klimaStatusLocal = statusLocal;
  function statusOf(card) {
    const S = statusLocal(card);
    if (!M.klimaStatus) return S;
    const r = safe(() => M.klimaStatus(card), null);
    if (!r || typeof r !== 'object') return S;
    Object.keys(r).forEach((k) => { if (r[k] !== undefined && r[k] !== null) S[k] = r[k]; });
    S.zone = ZONES[S.zone] ? S.zone : (ZONE_OF[S.zone] || 'none');
    if (S.minLeft != null) S.timeFrac = Math.min(1, Math.max(0, 1 - S.minLeft / 60));
    // Ingen/utilgjengelig statussensor → «–» og flat ring (ikke «Motoren er av»/«Trygg fallback»)
    const st = card.s(ST);
    if (!st || M.unavailable(st)) S.zone = 'none';
    return S;
  }
  // Setningen under statusen (4.0)
  const kwTxt = (v) => (v == null ? '–' : nf(v, 2));
  const listTxt = (l) => { l = (l || []).map(String); return l.length <= 1 ? (l[0] || '') : l.slice(0, -1).join(', ') + ' og ' + l[l.length - 1]; };
  function sentence(S) {
    switch (S.zone) {
      case 'ok': return `Du kan slå på <b>${kwTxt(S.freeKw)} kW</b> til uten å passere ${kwTxt(S.limitKwh)} kWh.`;
      case 'yellow': return `Du har <b>${kwTxt(S.freeKw)} kW</b> å gå på. Vent med store apparater.`;
      case 'orange': return `Unngå å slå på mer. Motoren senker ${esc(S.nextZone ? String(S.nextZone).toLowerCase() : 'neste sone')} snart.`;
      case 'red': return `Motoren senker ${esc(S.lowered && S.lowered.length ? listTxt(S.lowered).toLowerCase() : 'soner')} nå for å holde timen.`;
      case 'critical': return 'Timen går over grensen. Slå av det du kan.';
      case 'fallback': return 'Styrer etter fast reserve til måleren svarer igjen.';
      case 'off': return 'Ingenting styres. Slå på under Oppsett → Motor.';
      default: return 'Venter på KI Energi (sensor.ki_energi_status).';
    }
  }

  /* ============================================================ HERO (4.0 · 2a) */
  const R_OUT = 92, R_IN = 72, C_OUT = 2 * Math.PI * R_OUT, C_IN = 2 * Math.PI * R_IN;
  const EASE = 'cubic-bezier(.3,.9,.3,1)';
  class KlimaHero extends M.Card {
    static get cardName() { return 'Klima · hero'; }
    static get defaults() { return {}; }
    static get schema() {
      return [
        { type: 'info', label: 'Hero-kortet i Klima-popupen (første seksjon i msh-klima-card). Data fra KI Energi: sensor.ki_energi_status og sensor.ki_laster. Tersklene settes i Avansert → Terskler.' },
        { type: 'boolean', name: 'toasts', label: 'Bekreftelsesmeldinger', default: true },
      ];
    }
    get cardSize() { return 4; }
    _awayId() { return this.s('switch.ki_helgemodus') ? 'switch.ki_helgemodus' : null; }
    render() {
      const S = statusOf(this), Z = ZONES[S.zone] || ZONES.none, col = Z.c;
      this._S = S;
      const a = attrs(this, ST), hytte = a.hustype === 'fritidsbolig';
      const effFrac = S.pct != null ? Math.min(1, Math.max(0, S.pct / 100)) : 0;
      const tFrac = S.timeFrac || 0;
      const lim = S.limitKwh, used = S.usedKwh, fc = S.forecastKwh;
      const usedPct = lim && used != null ? Math.min(100, Math.max(0, (used / lim) * 100)) : null;
      const fcPct = lim && fc != null ? Math.min(100, Math.max(0, (fc / lim) * 100)) : null;
      const over = S.zone === 'critical' && lim != null && fc != null && fc > lim;
      const off = S.zone === 'off' || S.zone === 'none';
      // Borte-pillen: switch.ki_helgemodus (Bortemodus), tekst fra sensor.ki_tilstedevaerelse når den finnes
      const awayId = this._awayId(), aw = this.s(awayId), away = M.isOn(aw);
      const ts = this.s('sensor.ki_tilstedevaerelse'), tt = ts && ts.attributes && ts.attributes.tekst;
      const pill = awayId
        ? `<button class="away press" data-act="kaway" data-id="${esc(awayId)}" data-ent="${esc(awayId)}" data-haptic="success" style="background:${away ? M.alpha('var(--blue, #73b9f2)', 0.22) : 'var(--gray100,#2f2f2f)'};color:${away ? '#e6eef8' : 'var(--gray800,#afafaf)'}">${M.icon(away ? 'mdi:bag-suitcase' : 'mdi:home', 16)}${esc(away ? (hytte ? 'Tom hytte · frostsikring' : 'Borte · bortemodus') : (tt || 'Hjemme · normal komfort'))}</button>`
        : ts ? `<button class="away press" data-act="more" data-id="sensor.ki_tilstedevaerelse" data-ent="sensor.ki_tilstedevaerelse" style="background:var(--gray100,#2f2f2f);color:var(--gray800,#afafaf)">${M.icon('mdi:home-account', 16)}${esc(tt || ts.state)}</button>` : '';
      const ring = (cls, r, w, C, frac) => `<circle class="${cls}" cx="100" cy="100" r="${r}" stroke-width="${w}" data-c="${C.toFixed(2)}" style="stroke-dasharray:${C.toFixed(2)}px;stroke-dashoffset:${(C * (1 - frac)).toFixed(2)}px;opacity:${frac > 0.001 ? 1 : 0}"></circle>`;
      const crit = S.zone === 'critical';
      return `<section class="kh${crit ? ' crit' : ''}${off ? ' dull' : ''}" style="--zc:${col}" data-zone="${S.zone}">
        <div class="top">
          <div class="ring press" data-act="more" data-id="${ST}" data-ent="${ST}" role="img" aria-label="Effekt nå ${kwTxt(S.kw)} kW av ${kwTxt(S.allowed)} kW tillatt">
            <svg viewBox="0 0 200 200" aria-hidden="true"><g transform="rotate(-90 100 100)">
              <circle class="trk" cx="100" cy="100" r="${R_OUT}" stroke-width="7"></circle>
              ${ring('tm', R_OUT, 7, C_OUT, tFrac)}
              <circle class="trk" cx="100" cy="100" r="${R_IN}" stroke-width="20"></circle>
              ${ring('ef', R_IN, 20, C_IN, effFrac)}
            </g></svg>
            <div class="rc"><span class="kw num" data-n="kw" data-v="${S.kw != null ? S.kw : ''}">${kwTxt(S.kw)}</span><span class="kl">kW nå</span></div>
          </div>
          <div class="tx">
            <div class="stt">${esc(Z.t)}</div>
            <div class="sen">${sentence(S)}</div>
            <div class="ml">${M.icon('mdi:clock-outline', 14)}<span class="num">${S.minLeft != null ? Math.round(S.minLeft) : '–'} min igjen av timen</span></div>
          </div>
        </div>
        <div class="bud">
          <div class="bh"><span>Timebudsjett</span><span class="num"><b data-n="used" data-v="${used != null ? used : ''}">${kwTxt(used)}</b> av ${kwTxt(lim)} kWh</span></div>
          <div class="bar">
            ${fcPct != null ? `<span class="pg${over ? ' over' : ''}" style="width:${fcPct.toFixed(2)}%"></span>` : ''}
            ${usedPct != null ? `<span class="us" style="width:max(12px, ${usedPct.toFixed(2)}%)"></span>` : ''}
            <span class="nl" style="left:${(tFrac * 100).toFixed(2)}%"></span>
          </div>
          <div class="lg"><span><i class="d1"></i>Brukt</span><span><i class="d2"></i>Prognose ${kwTxt(fc)}</span><span><i class="d3"></i>Tid i timen</span></div>
        </div>
        ${pill ? `<div class="pw">${pill}</div>` : ''}
      </section>`;
    }
    onAction(name, el, ev) {
      if (name === 'kaway') {
        const id = el.dataset.id, on = M.isOn(this.s(id));
        M.call(this.hass, 'switch', on ? 'turn_off' : 'turn_on', { entity_id: id });
        const t = on ? 'Hjemme · normal komfort' : 'Bortemodus på';
        if (this.config.toasts !== false) { if (M.klimaToast) M.klimaToast(this._host || this, t); else M.toast(t); }
        return;
      }
      return super.onAction(name, el, ev);
    }

    /* ---------------- animasjon (Web Animations API) */
    // Animasjonen startes i requestAnimationFrame etter tegningen, bare når popupen er åpen (og på nytt ved ny åpning)
    onOpen() { this._pendingIntro = true; this._introRaf(); }
    onClose() { cancelAnimationFrame(this._iRaf); this._stopAnims(); this._introAt = 0; }
    _introRaf() {
      cancelAnimationFrame(this._iRaf);
      this._iRaf = requestAnimationFrame(() => { if (this.isOpen && this.isConnected && this._pendingIntro) this.animateIn(); });
    }
    // Bubble Card tar popup-innholdet ut av DOM-en når den lukkes: neste tilkobling er en ny åpning
    disconnectedCallback() { super.disconnectedCallback(); this._open = false; }
    animateIn() {
      if (reduced()) { this._pendingIntro = false; return; }
      if (!this.isConnected || !this.shadowRoot.querySelector('.kh')) { this._pendingIntro = true; return; }
      this._pendingIntro = false;
      try { this._intro0(); } catch (e) { console.error('msh-klima-card', e); this._stopAnims(); }
    }
    _intro0() {
      this._stopAnims();
      const q = (s) => this.shadowRoot.querySelector(s), A = [];
      const an = (el, kf, o) => { if (el && el.animate) { const x = el.animate(kf, { fill: 'backwards', ...o }); A.push(x); return x; } return null; };
      // Ringene tegnes opp (tid-ringen +150, effekt-ringen +350)
      [['.tm', 150], ['.ef', 350]].forEach(([s, delay]) => { const el = q(s); if (el) an(el, [{ strokeDashoffset: el.dataset.c + 'px' }, { strokeDashoffset: getComputedStyle(el).strokeDashoffset }], { duration: 1100, delay, easing: EASE }); });
      // Status og setning fader inn fra 8 px under
      an(q('.stt'), [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 600, delay: 250, easing: 'ease-out' });
      an(q('.sen'), [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 600, delay: 400, easing: 'ease-out' });
      an(q('.ml'), [{ opacity: 0 }, { opacity: 1 }], { duration: 600, delay: 500, easing: 'ease-out' });
      // Barene vokser fra venstre, nå-streken glir inn
      an(q('.bar .us'), [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 900, delay: 550, easing: EASE });
      an(q('.bar .pg'), [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 900, delay: 700, easing: EASE });
      const nl = q('.bar .nl'); if (nl) an(nl, [{ left: '0%' }, { left: nl.style.left }], { duration: 1000, delay: 550, easing: EASE });
      this._intro = A;
      this._introAt = Date.now();
      // Tall teller opp fra 0 (1100 ms, ease-out, norsk komma)
      this.shadowRoot.querySelectorAll('[data-n]').forEach((el) => { const v = num(el.dataset.v); if (v != null) this._tween(el, 0, v, 1100, 0); });
      // Etterpå, i løkke: effekt-ringen pulserer rolig, prognosen «puster»
      clearTimeout(this._loopT);
      this._loopT = setTimeout(() => this._loops(), 1500);
    }
    _loops() {
      if (reduced() || !this.isOpen || !this.isConnected) return;
      try { this._loops0(); } catch (e) { console.error('msh-klima-card', e); }
    }
    _loops0() {
      (this._loop || []).forEach((x) => { try { x.cancel(); } catch (e) { /* */ } });
      const L = [], ef = this.shadowRoot.querySelector('.ef'), pg = this.shadowRoot.querySelector('.bar .pg');
      if (ef && ef.animate && this._S && this._S.zone !== 'off') L.push(ef.animate([{ opacity: 1 }, { opacity: 0.72 }], { duration: 2600, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' }));
      if (pg && pg.animate) L.push(pg.animate([{ opacity: 1 }, { opacity: 0.45 }], { duration: 2200, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' }));
      this._loop = L;
    }
    _stopAnims() {
      clearTimeout(this._loopT);
      [...(this._intro || []), ...(this._loop || [])].forEach((x) => { try { x.cancel(); } catch (e) { /* */ } });
      this._intro = []; this._loop = [];
      Object.values(this._tw || {}).forEach((t) => cancelAnimationFrame(t.raf));
      this._tw = {};
    }
    // Tall-tween (rAF): fra → til over dur ms, ease-out; skriver norsk komma
    _tween(el, from, to, dur, delay) {
      const key = el.dataset.n, d = 2;
      this._tw = this._tw || {};
      if (this._tw[key]) cancelAnimationFrame(this._tw[key].raf);
      const t0 = performance.now() + (delay || 0), rec = { raf: 0, to };
      this._tw[key] = rec;
      const step = (now) => {
        const cur = this.shadowRoot.querySelector(`[data-n="${key}"]`);
        if (!cur) return;
        const p = Math.min(1, Math.max(0, (now - t0) / dur)), e = 1 - Math.pow(1 - p, 3), v = from + (to - from) * e;
        cur.textContent = nf(v, d);
        (this._shown = this._shown || {})[key] = v;
        if (p < 1) rec.raf = requestAnimationFrame(step); else delete this._tw[key];
      };
      el.textContent = nf(from, d);
      rec.raf = requestAnimationFrame(step);
    }
    afterRender() {
      if (this._pendingIntro && this.isOpen) { this._introRaf(); return; }
      // Live-oppdatering: nye verdier glir mykt (300 ms) i stedet for å hoppe
      this._shown = this._shown || {};
      this.shadowRoot.querySelectorAll('[data-n]').forEach((el) => {
        const k = el.dataset.n, v = num(el.dataset.v), tw = this._tw && this._tw[k];
        if (tw) { if (v != null && tw.to !== v) { const from = this._shown[k] != null ? this._shown[k] : v; this._tween(el, from, v, 300, 0); } else { el.textContent = nf(this._shown[k], 2); } return; }
        const prev = this._shown[k];
        if (v != null && prev != null && Math.abs(prev - v) > 1e-6 && !reduced()) this._tween(el, prev, v, 300, 0);
        else this._shown[k] = v;
      });
      // Effekt-ringen får pulsen tilbake om sonen skiftet fra «av»
      if (this.isOpen && this._introAt && Date.now() - this._introAt > 1500 && this._S && this._loopZone !== this._S.zone) { this._loopZone = this._S.zone; this._loops(); }
    }
    get styles() {
      return `
        .kh{position:relative;display:flex;flex-direction:column;gap:16px;padding:20px 18px 18px;border-radius:32px;background:var(--gray200,#3a3a3a);overflow:hidden;transition:box-shadow .4s,background .4s}
        .kh.crit{background:linear-gradient(160deg, rgba(240,86,110,0.16), var(--gray200,#3a3a3a) 62%);box-shadow:inset 0 0 0 1px rgb(240 86 110)}
        .top{display:flex;align-items:center;gap:16px;min-width:0}
        .ring{position:relative;width:128px;height:128px;flex:none;cursor:pointer}
        .ring svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
        .ring circle{fill:none;stroke-linecap:round;transition:stroke-dashoffset .3s ease-out,stroke .4s,filter .4s,opacity .3s}
        .ring .trk{stroke:var(--gray100,#2f2f2f)}
        .ring .tm{stroke:rgba(255,255,255,0.55)}
        .ring .ef{stroke:var(--zc);filter:drop-shadow(0 0 6px var(--zc))}
        .kh.dull .ring .ef{filter:none}
        .rc{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;pointer-events:none}
        .kw{font-size:30px;font-weight:300;letter-spacing:-0.03em;line-height:1.05;white-space:nowrap}
        .kl{font-size:10px;color:var(--gray700,#979797)}
        .tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px}
        .stt{font-size:26px;font-weight:500;letter-spacing:-0.02em;line-height:1.1;color:var(--zc);transition:color .4s;text-wrap:balance}
        .sen{font-size:13px;line-height:1.4;color:var(--gray900,#c7c7c7);text-wrap:pretty}
        .sen b{font-weight:600;color:#fafafa;white-space:nowrap}
        .ml{display:flex;align-items:center;gap:5px;font-size:12px;color:var(--gray700,#979797)}
        .bud{display:flex;flex-direction:column;gap:8px}
        .bh{display:flex;justify-content:space-between;align-items:baseline;gap:10px;font-size:12px;color:var(--gray700,#979797)}
        .bh b{font-weight:600;color:#fafafa}
        .bar{position:relative;height:22px;border-radius:11px;background:var(--gray100,#2f2f2f);overflow:hidden}
        .bar>span{position:absolute;top:0;bottom:0;left:0;border-radius:11px;transform-origin:left center}
        .bar .pg{background:color-mix(in srgb, var(--zc) 30%, transparent);transition:width .3s ease-out,background-color .4s}
        .bar .pg.over{box-shadow:inset -3px 0 0 rgb(240 86 110)}
        .bar .us{background:var(--zc);transition:width .3s ease-out,background-color .4s}
        .bar .nl{width:2px;border-radius:1px;background:#fafafa;box-shadow:0 0 6px rgba(255,255,255,0.8),0 0 2px rgba(255,255,255,0.9);margin-left:-1px;transition:left .3s ease-out}
        .lg{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:11px;color:var(--gray700,#979797)}
        .lg span{display:inline-flex;align-items:center;gap:5px;white-space:nowrap}
        .lg i{width:8px;height:8px;border-radius:4px;flex:none;transition:background-color .4s}
        .lg .d1{background:var(--zc)}
        .lg .d2{background:color-mix(in srgb, var(--zc) 30%, transparent)}
        .lg .d3{width:2px;height:10px;border-radius:1px;background:#fafafa;box-shadow:0 0 4px rgba(255,255,255,0.8)}
        .pw{display:flex;justify-content:center}
        .away{height:36px;padding:0 14px;border-radius:18px;display:flex;align-items:center;gap:6px;font-size:12px;font-weight:500;white-space:nowrap;transition:background .3s}
        @media (max-width:360px){.stt{font-size:22px}.top{gap:12px}}
        @media (prefers-reduced-motion: reduce){.kh *,.kh{transition:none!important}}
      `;
    }
  }
  M.define('msh-klima-hero-card', KlimaHero, 'MSH Klima · hero', 'Ring med tid i timen og effekt nå mot tillatt, status, setning, timebudsjett og bortemodus. Første seksjon i Klima-popupen.');

  /* ============================================================ HOVEDKORT */
  // Modus-bobler (4.1): Borte · Alle borte · Hjemkomst · Sommer · <ungdom> ferie (bare de som finnes i integrasjonen)
  function modeList(card) {
    const a = attrs(card, ST), hytte = a.hustype === 'fritidsbolig';
    const short = (n) => { n = String(n || ''); return n.length > 6 ? n.slice(0, 3) + '.' : n; };
    const pers = (Array.isArray(a.personer) ? a.personer : []).filter((p) => p && p.type === 'ungdom' && p.key);
    return [
      [mapId('input_boolean.ki_helgemodus'), hytte ? 'Tom hytte' : 'Borte', 'mdi:bag-suitcase', true],
      ['binary_sensor.ki_alle_borte', hytte ? 'Hytta tom' : 'Alle borte', 'mdi:logout', false],
      [mapId('input_boolean.ki_hjemkomst_aktiv'), hytte ? 'Ankomst' : 'Hjemkomst', 'mdi:home-import-outline', true],
      [mapId('input_boolean.ki_sommermodus'), 'Sommer', 'mdi:white-balance-sunny', true],
      ...pers.map((p) => [mapId(`input_boolean.ki_${p.key}_ferie`), `${short(p.navn || p.key)} ferie`, 'mdi:school-outline', true]),
    ].filter(([id]) => card.s(id));
  }
  const GLASS = 'background:linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0) 45%),rgba(255,255,255,0.06);-webkit-backdrop-filter:blur(22px) saturate(190%);backdrop-filter:blur(22px) saturate(190%);box-shadow:inset 0 0 0 0.5px rgba(255,255,255,0.14),inset 0 1px 0 rgba(255,255,255,0.22);';
  const TRS = M.tabSurface ? M.tabSurface('transparent', 'inset 0 0 0 1px rgba(255,255,255,0.12)') : GLASS;

  class Klima extends M.Card {
    static get cardName() { return 'Klima'; }
    static get defaults() { return {}; }
    // UI-tilstand i localStorage (ki:<card_id>:ui): fane + blokk-filens nøkler (kollaps, sone, segment …)
    static get uiPersist() { return ['tab', ...(Array.isArray(M.KLIMA_UI_PERSIST) ? M.KLIMA_UI_PERSIST : ['klima_collapsed', 'zone', 'water'])]; }
    static get schema() {
      return (h, c) => {
        const pc = proxyCard(h, c), T = tabDefs();
        const blocks = T.map((t) => {
          const list = blockList(pc, t.id);
          if (!list.length) return null;
          const lab = (b) => `${b.title || b.id}${b.group ? ` · ${b.group === 'bad' ? 'Bad' : 'Bereder'}` : ''}${b.fixed ? ' · fast øverst' : ''}`;
          return { type: 'order', name: `layout.block_order.${t.id}`, hiddenName: `layout.hidden_blocks.${t.id}`, label: `${t.label} · blokker`, options: list.map((b) => [b.id, lab(b)]) };
        }).filter(Boolean);
        return [
          { type: 'text', name: 'title', label: 'Tittel (valgfri)', placeholder: 'Bubble-headeren viser navnet' },
          { type: 'section', id: 'visning', label: 'Visning', icon: 'mdi:eye-outline', fields: [
            { type: 'boolean', name: 'layout.show_hero', label: 'Hero-kort', default: true },
            { type: 'boolean', name: 'layout.show_modes', label: 'Modus-bobler', default: true },
            { type: 'select', name: 'layout.tab_style', label: 'Fanestil', options: [['both', 'Ikon + tekst'], ['text', 'Tekst'], ['icon', 'Ikon']], default: 'both' },
          ] },
          { type: 'section', id: 'faner', label: 'Faner', icon: 'mdi:tab', fields: [
            { type: 'select', name: 'layout.default_tab', label: 'Standardfane', options: T.map((t) => [t.id, t.label]), default: 'oversikt' },
            { type: 'boolean', name: 'remember_tab', label: 'Husk sist valgte fane', default: true },
            { type: 'order', name: 'layout.tab_order', hiddenName: 'layout.hidden_tabs', label: 'Faner (rekkefølge og synlighet)', options: T.map((t) => [t.id, t.label]) },
          ] },
          ...(blocks.length ? [{ type: 'section', id: 'blokker', label: 'Blokker', icon: 'mdi:view-agenda-outline', fields: blocks }] : []),
          { type: 'boolean', name: 'toasts', label: 'Bekreftelsesmeldinger', default: true },
        ];
      };
    }
    constructor() {
      super();
      // Ikke tegn på nytt mens et felt har fokus (som _ventTegn i JS-kortet) – tegn når feltet forlates
      this.shadowRoot.addEventListener('focusout', () => { if (this._waitDraw) { this._waitDraw = false; setTimeout(() => this.update(), 250); } });
    }
    get cardSize() { return 14; }
    get layout() { return layoutOf(this.config); }
    customize(focus) { return openSheet(this, focus); }
    _render() {
      const ae = this._firstRender && this.shadowRoot.activeElement;
      if (ae && /^(INPUT|SELECT|TEXTAREA)$/.test(ae.tagName)) { this._waitDraw = true; return; }
      super._render();
    }
    _curTab() {
      const L = this.layout, tabs = visibleTabs(this, L);
      const sel = this.config.remember_tab === false ? this._tab : this.ui.tab;
      const s = sel ? tabId(sel) : null;
      return tabs.includes(s) ? s : tabs.includes(L.default_tab) ? L.default_tab : tabs[0];
    }

    render() {
      const c = this.config, L = this.layout;
      const T = Object.fromEntries(tabDefs().map((t) => [t.id, t]));
      const tabs = visibleTabs(this, L), tab = this._curTab();
      this._shownTab = tab;
      const st = ['both', 'text', 'icon'].includes(L.tab_style) ? L.tab_style : 'both';
      const body = !tab ? '' : M.klimaTabHTML
        ? safe(() => M.klimaTabHTML(this, tab, L), `<div class="empty">Kunne ikke tegne fanen</div>`)
        : `<div class="empty">${M.icon('mdi:timer-sand', 22)}<span>Innholdet i «${esc((T[tab] || {}).label || tab)}» lastes …</span></div>`;
      return `<div class="wrap">
        ${c.title ? `<div class="ttl">${esc(c.title)}</div>` : ''}
        ${L.show_modes !== false ? this._modes() : ''}
        <div class="trow">
          <div class="tbox"><div class="tabs msh-tr s-${st}" data-glass-drag="x" role="tablist" aria-label="Klima-faner">${tabs.map((k) => {
            const t = T[k] || { id: k, label: k, icon: 'mdi:tab' }, on = k === tab;
            return `<button class="tab${on ? ' on' : ''}" data-act="ktab" data-key="${esc(k)}" data-haptic="selection" role="tab" aria-selected="${on}"${on ? ' data-active' : ''} aria-label="${esc(t.label)}">${st !== 'text' ? M.icon(t.icon, st === 'icon' ? 22 : 20) : ''}${st !== 'icon' ? `<span class="tl">${esc(t.label)}</span>` : ''}</button>`;
          }).join('')}</div></div>
          <button class="gear press" data-act="customize" data-haptic="light" aria-label="Tilpass klima">${M.icon('mdi:cog', 22)}</button>
        </div>
        <div class="kbody" data-tab="${esc(tab || '')}">${body}</div>
      </div>`;
    }
    _modes() {
      const list = modeList(this);
      if (!list.length) return '';
      return `<section class="modes noscroll">${list.map(([id, label, icon, canToggle]) => {
        const s = this.s(id), on = M.isOn(s);
        return `<button class="mode" data-act="${canToggle ? 'kmode' : 'more'}" data-id="${esc(id)}" data-ent="${esc(id)}" data-key="${esc(id)}" data-haptic="${canToggle ? 'success' : 'light'}" aria-pressed="${on}">
          <span class="mb" style="background:${on ? PINK : 'var(--gray200,#3a3a3a)'};color:${on ? INK : 'var(--gray800,#afafaf)'};box-shadow:${on ? '0 6px 18px rgba(240,140,190,0.3)' : 'inset 0 0 0 1px rgba(255,255,255,0.05)'};transform:scale(${on ? 1.06 : 1})">${M.icon(icon, 24)}</span>
          <span class="ml ell" style="color:${on ? '#fafafa' : 'var(--gray600,#7f7f7f)'}">${esc(label)}</span></button>`;
      }).join('')}</section>`;
    }
    _toast(t) { if (this.config.toasts === false) return; if (M.klimaToast) M.klimaToast(this, t); else M.toast(t); }
    _selectTab(k) {
      const prev = this._shownTab;
      if (!k || k === prev) return;
      if (this.config.remember_tab === false) { this._tab = k; this.update(); } else this.setUI({ tab: k });
      if (k === 'oversikt' && prev && this._heroEl && this._heroEl.animateIn) this._heroEl.animateIn();
    }

    /* ---------------- handlinger: blokkene først, så skallet */
    onAction(name, el, ev) {
      if (M.klimaAct && safe(() => M.klimaAct(this, name, el, ev), false)) return;
      const d = el.dataset;
      switch (name) {
        case 'ktab': return this._selectTab(d.key);
        case 'kmode': {
          const on = M.isOn(this.s(d.id));
          M.call(this.hass, d.id.split('.')[0] === 'input_boolean' ? 'input_boolean' : 'switch', on ? 'turn_off' : 'turn_on', { entity_id: d.id });
          const lab = el.querySelector('.ml');
          this._toast(`${lab ? lab.textContent.trim() : M.name(this.hass, d.id)} ${on ? 'av' : 'på'}`);
          return;
        }
        default: return super.onAction(name, el, ev);
      }
    }
    onInput(name, el, ev, kind) {
      if (M.klimaInput && safe(() => M.klimaInput(this, name, el, ev, kind), false)) return;
    }
    onOpen() { if (M.klimaOnOpen) safe(() => M.klimaOnOpen(this)); }
    onClose() { if (M.klimaOnClose) safe(() => M.klimaOnClose(this)); }
    disconnectedCallback() { super.disconnectedCallback(); this._open = false; }
    afterRender() {
      const row = this.shadowRoot.querySelector('.tabs');
      if (row && M.tabReorder) safe(() => M.tabReorder(row, {
          card: this, glass: true,
          items: () => Array.from(row.querySelectorAll('.tab')),
          active: () => this._curTab(),
          onSelect: (k) => this._selectTab(k),
          onReorder: (keys) => {
            const raw = (this._rawConfig && this._rawConfig.layout) || {}, hid = (raw.hidden_tabs || []).filter((k) => !keys.includes(k));
            const rest = tabDefs().map((t) => t.id).filter((k) => !keys.includes(k) && !hid.includes(k));
            M.mshPatchConfig(this, { layout: { ...raw, tab_order: [...keys, ...rest, ...hid] } });
          },
        }));
      if (M.klimaAfterRender) safe(() => M.klimaAfterRender(this));
    }
    get styles() {
      const L = this.layout;
      return `
        ${L.show_hero === false ? '.msh-hero-slot{display:none!important}' : ''}
        .wrap{display:flex;flex-direction:column;gap:var(--msh-gap,8px)}
        .ttl{font-size:15px;font-weight:500;color:var(--gray800,#afafaf);padding:0 6px}
        .modes{display:flex;gap:12px;overflow-x:auto;padding:4px 2px;margin:0}
        .mode{flex:none;display:flex;flex-direction:column;align-items:center;gap:6px;width:66px}
        .mb{width:58px;height:58px;border-radius:29px;display:grid;place-items:center;transition:transform .35s cubic-bezier(.34,1.8,.64,1),background .25s,box-shadow .25s}
        .mode:active .mb{transform:scale(.94)!important}
        .ml{font-size:11px;font-weight:500;white-space:nowrap;max-width:66px}
        ${M.TAB_ROW_CSS || ''}
        .trow{display:flex;align-items:center;gap:8px;min-width:0}
        /* Fiks 15.2: glassflate bare med Liquid Glass-temaet (MSH.tabSurface), ellers transparent + ring; glass-dra alltid */
        .tbox{flex:1;min-width:0;padding:4px;border-radius:26px;${TRS}overflow:hidden}
        .tabs{position:relative;gap:2px;border-radius:22px}
        .tabs>.tab{flex:1 0 auto;min-width:58px;padding:0 10px;height:54px;border-radius:22px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;color:var(--gray700,#979797);background:transparent;transition:background .25s,color .25s}
        .tabs>.tab.on{background:${PINK};color:${INK}}
        .tabs.s-text>.tab{height:40px;padding:0 14px}
        .tabs.s-text .tl{font-size:13px}
        .tabs.s-icon>.tab{height:46px;padding:0 12px}
        .tl{font-size:10px;font-weight:500;white-space:nowrap}
        .gear{width:46px;height:46px;border-radius:23px;flex:none;display:grid;place-items:center;${TRS}color:var(--white,#fafafa)}
        .gear:active{transform:scale(.92)}
        .kbody{display:flex;flex-direction:column;gap:var(--msh-gap,8px);min-width:0}
        ${M.KLIMA_BLOCK_CSS || ''}
        ${M.STEPPER_CSS || ''}
      `;
    }
  }
  M.define('msh-klima-card', Klima, 'MSH Klima', 'KI Energi: hero med ring og timebudsjett, moduser, 8 faner (Oversikt, Soner, Energi, Vann og bad, Lading, Tanker, Oppsett, Avansert) og «Tilpass klima».');

  // Et kort-lignende objekt for blokk-listene i GUI-editoren/arket (config = utkastet)
  function proxyCard(hass, cfg, base) {
    if (base) return Object.create(base, { _config: { value: { ...cfg } }, _rawConfig: { value: cfg }, config: { get() { return this._config; } } });
    return {
      hass, _hass: hass, _config: { ...(cfg || {}) }, _rawConfig: cfg || {}, get config() { return this._config; }, ui: {}, _ui: {}, _deps: new Set(),
      s(id) { return (id && hass && hass.states[id]) || null; },
      n(id) { const s = this.s(id); return s && M.isNum(s.state) ? Number(s.state) : null; },
      setUI() {}, update() {},
    };
  }

  /* ============================================================ «Tilpass klima» (4.6) */
  const clone = (o) => JSON.parse(JSON.stringify(o || {}));
  const lay = (d) => { if (!d.layout || typeof d.layout !== 'object' || Array.isArray(d.layout)) d.layout = {}; return d.layout; };
  const tidy = (d) => {
    const L = d.layout;
    if (!L) return;
    ['hidden_tabs'].forEach((k) => { if (Array.isArray(L[k]) && !L[k].length) delete L[k]; });
    ['block_order', 'hidden_blocks'].forEach((k) => {
      if (L[k] && typeof L[k] === 'object') { Object.keys(L[k]).forEach((t) => { if (!Array.isArray(L[k][t]) || !L[k][t].length) delete L[k][t]; }); if (!Object.keys(L[k]).length) delete L[k]; }
    });
    if (!Object.keys(L).length) delete d.layout;
  };
  // Blokkene i en fane slik de vises: faste først (standardrekkefølge), så resten etter block_order
  function orderedBlocks(list, L, tab) {
    const fixed = list.filter((b) => b.fixed), rest = list.filter((b) => !b.fixed);
    const ids = M.mshOrder(rest.map((b) => b.id), (L.block_order || {})[tab], []);
    return [...fixed, ...ids.map((id) => rest.find((b) => b.id === id))];
  }

  function openSheet(card, focus) {
    if (card._sheet && !card._sheet.ov.closed) return card._sheet;
    const orig = card._rawConfig || card.config;
    const st = { draft: clone(orig), btab: card._shownTab || 'oversikt', saved: false, busy: false, reset: false };
    let ov = null;
    const preview = () => card.setConfig({ ...st.draft, __eff: 1 });
    const upd = (fn, hap) => { fn(st.draft); tidy(st.draft); preview(); if (hap) M.haptic(hap); draw(); };
    const hass = () => card.hass;
    const pc = () => proxyCard(hass(), st.draft, card);

    const swRow = (label, sub, key, on) => `<button class="r" data-a="sw" data-k="${key}" data-v="${on ? 0 : 1}" role="switch" aria-checked="${on}"><span class="rl col"><span>${esc(label)}</span>${sub ? `<span class="rs">${esc(sub)}</span>` : ''}</span><span class="sw${on ? ' on' : ''}"><span></span></span></button>`;
    const ib = (a, k, icon, label, extra, dis) => `<button class="ib" data-a="${a}" data-k="${esc(k)}" ${extra || ''} aria-label="${esc(label)}" ${dis ? 'disabled' : ''}>${M.icon(icon, 20)}</button>`;

    const draw = () => {
      if (!ov) return;
      const d = st.draft, L = layoutOf(d), T = tabDefs(), P = pc();
      const sh = ov.root.querySelector('.sh'), top = sh ? sh.scrollTop : 0;
      // Faner: alle 8 i nåværende rekkefølge
      const order = M.mshOrder(T.map((t) => t.id), L.tab_order, []), hidT = new Set(L.hidden_tabs || []);
      const byId = Object.fromEntries(T.map((t) => [t.id, t]));
      const defTab = L.default_tab && order.includes(L.default_tab) ? L.default_tab : visibleTabs(P, L)[0];
      const tabRows = order.map((k, i) => {
        const t = byId[k], hid = hidT.has(k), avail = hasTab(P, k), star = k === defTab;
        return `<div class="r tr${hid ? ' off' : ''}" data-key="t-${esc(k)}">
          <button class="ib star${star ? ' on' : ''}" data-a="star" data-k="${esc(k)}" aria-label="${star ? 'Standardfane' : 'Gjør til standardfane'}: ${esc(t.label)}" aria-pressed="${star}">${M.icon(star ? 'mdi:star' : 'mdi:star-outline', 20)}</button>
          <span class="ti">${M.icon(t.icon, 18)}</span>
          <span class="rl col"><span class="ell">${esc(t.label)}</span>${!avail ? `<span class="rs">${k === 'lading' ? 'Vises når laderen er satt opp' : 'Ikke tilgjengelig her'}</span>` : ''}</span>
          ${ib('tab', k, hid ? 'mdi:eye-off-outline' : 'mdi:eye-outline', (hid ? 'Vis ' : 'Skjul ') + t.label, '', false)}
          ${ib('tmv', k, 'mdi:chevron-up', 'Flytt opp', 'data-d="-1"', i === 0)}
          ${ib('tmv', k, 'mdi:chevron-down', 'Flytt ned', 'data-d="1"', i === order.length - 1)}
        </div>`;
      }).join('');
      // Blokker i valgt fane
      if (!byId[st.btab]) st.btab = T[0].id;
      const list = blockList(P, st.btab), blocks = orderedBlocks(list, L, st.btab), hidB = new Set((L.hidden_blocks || {})[st.btab] || []);
      const rest = blocks.filter((b) => !b.fixed);
      const blkRows = blocks.map((b) => {
        const hid = hidB.has(b.id), ri = rest.indexOf(b);
        const tag = b.group ? `<span class="tag ${b.group === 'bad' ? 'bad' : 'ber'}">${b.group === 'bad' ? 'Bad' : 'Bereder'}</span>` : '';
        return `<div class="r br${hid ? ' off' : ''}" data-key="b-${esc(b.id)}">
          <span class="ti">${M.icon(b.icon || 'mdi:view-agenda-outline', 18)}</span>
          <span class="rl col"><span class="ell">${esc(b.title || b.id)}${tag}</span>${b.fixed ? `<span class="rs">${M.icon('mdi:pin-outline', 12)} Fast øverst</span>` : ''}</span>
          ${ib('blk', b.id, hid ? 'mdi:eye-off-outline' : 'mdi:eye-outline', (hid ? 'Vis ' : 'Skjul ') + (b.title || b.id), '', false)}
          ${b.fixed ? '<span class="ib ph"></span><span class="ib ph"></span>' : `${ib('bmv', b.id, 'mdi:chevron-up', 'Flytt opp', 'data-d="-1"', ri === 0)}${ib('bmv', b.id, 'mdi:chevron-down', 'Flytt ned', 'data-d="1"', ri === rest.length - 1)}`}
        </div>`;
      }).join('');
      const style = ['both', 'text', 'icon'].includes(L.tab_style) ? L.tab_style : 'both';
      box.innerHTML = `<div class="nav"><button class="nb" data-a="reset">Tilbakestill</button><span class="nt">Tilpass klima</span><button class="nd press" data-a="done" ${st.busy ? 'disabled' : ''}>${st.busy ? 'Lagrer …' : 'Ferdig'}</button></div>
        ${st.reset ? '<p class="note top">Tilbakestilt til standardoppsett i utkastet – trykk Ferdig for å lagre.</p>' : ''}
        <span class="cap">Visning</span>
        <div class="grp">
          ${swRow('Hero-kort', 'Ring, status og timebudsjett øverst', 'show_hero', L.show_hero !== false)}
          ${swRow('Modus-bobler', 'Borte · Alle borte · Hjemkomst · Sommer …', 'show_modes', L.show_modes !== false)}
          <div class="r"><span class="rl">Fanestil</span><div class="seg" data-glass-drag="x">${[['both', 'Ikon + tekst'], ['text', 'Tekst'], ['icon', 'Ikon']].map(([v, l]) => `<button class="${v === style ? 'on' : ''}" data-a="style" data-v="${v}" aria-selected="${v === style}">${esc(l)}</button>`).join('')}</div></div>
        </div>
        <span class="cap">Faner</span>
        <div class="grp">${tabRows}</div>
        <p class="note">Stjerne = standardfane. Minst én fane må vises. Rekkefølgen er den samme som når du drar i fane-raden.</p>
        <span class="cap">Blokker</span>
        <div class="bseg noscroll" data-glass-drag="x">${T.map((t) => `<button class="${t.id === st.btab ? 'on' : ''}" data-a="btab" data-v="${esc(t.id)}" aria-selected="${t.id === st.btab}">${esc(t.label)}</button>`).join('')}</div>
        <div class="grp">${blkRows || `<div class="r"><span class="rl rs">${M.klimaBlockList ? 'Ingen blokker i denne fanen' : 'Blokkene lastes …'}</span></div>`}</div>
        <p class="note">Faste toppblokker kan skjules, men ikke flyttes. Skjulte blokker kan vises igjen her.</p>`;
      const bs = box.querySelector('.bseg'), on = bs && bs.querySelector('.on');
      if (bs && M.glassTap) { M.glassTap(bs); M.glassTap(box.querySelector('.seg')); }
      if (on && bs && st.scrollSeg !== st.btab) { st.scrollSeg = st.btab; bs.scrollLeft = Math.max(0, on.offsetLeft - bs.clientWidth / 2 + on.offsetWidth / 2); }
      if (sh && st.keepScroll) sh.scrollTop = top;
      st.keepScroll = true;
    };

    const done = async () => {
      if (st.busy) return;
      const next = clone(st.draft);
      tidy(next);
      if (JSON.stringify(next) === JSON.stringify(orig)) { st.saved = true; M.haptic('success'); ov.close(); return; }
      st.busy = true; draw();
      let r = null;
      try { r = await M.saveCardConfig(hass(), orig, next, { card, immediate: true, scope: 'shared' }); } catch (e) { r = { ok: false, error: e && e.message }; }
      if (r && r.ok === false) { st.busy = false; draw(); M.haptic('failure'); M.toast('Kunne ikke lagre' + (r.error ? ' – ' + r.error : '')); return; }
      st.saved = true;
      if (!M.store) card.setConfig({ ...next, __eff: 1 });
      M.haptic('success');
      if (next.toasts !== false) M.toast('Lagret');
      ov.close();
    };

    ov = M.overlay({ html: '', css: SHEET_CSS, maxWidth: 520, onClose: () => { if (!st.saved) card.setConfig({ ...orig, __eff: 1 }); card._sheet = null; } });
    // Arkets innhold i én fast beholder; _config = utkastet (samme config som GUI-editoren, sjekkes i test/checklist.mjs)
    const box = document.createElement('div');
    box.className = 'klima-sheet';
    Object.defineProperty(box, '_config', { get: () => st.draft });
    ov.body.appendChild(box);
    ov.root.addEventListener('click', (e) => {
      const el = e.target.closest && e.target.closest('[data-a]');
      if (!el || el.disabled) return;
      const a = el.dataset.a, k = el.dataset.k;
      const T = tabDefs(), all = T.map((t) => t.id);
      switch (a) {
        case 'done': return done();
        case 'reset': st.reset = true; return upd((d) => { delete d.layout; delete d.remember_tab; delete d.tab_order; delete d.hidden_tabs; delete d.start_tab; }, 'warning');
        case 'sw': return upd((d) => { const L = lay(d); if (el.dataset.v === '1') delete L[k]; else L[k] = false; }, 'selection');
        case 'style': return upd((d) => { const L = lay(d); if (el.dataset.v === 'both') delete L.tab_style; else L.tab_style = el.dataset.v; }, 'selection');
        case 'star': return upd((d) => { const L = lay(d); L.default_tab = k; if (Array.isArray(L.hidden_tabs)) L.hidden_tabs = L.hidden_tabs.filter((x) => x !== k); }, 'selection');
        case 'tab': {
          const L0 = layoutOf(st.draft), hid = new Set(L0.hidden_tabs || []), hide = !hid.has(k);
          const P = pc(), visible = all.filter((x) => !hid.has(x) && hasTab(P, x));
          if (hide && visible.length <= 1 && visible.includes(k)) { M.haptic('failure'); M.toast('Minst én fane må vises'); return; }
          return upd((d) => { const L = lay(d); const s = new Set(L0.hidden_tabs || []); if (hide) s.add(k); else s.delete(k); L.hidden_tabs = [...s]; }, 'selection');
        }
        case 'tmv': {
          const L0 = layoutOf(st.draft), o = M.mshOrder(all, L0.tab_order, []), i = o.indexOf(k), j = i + Number(el.dataset.d);
          if (i < 0 || j < 0 || j >= o.length) return;
          [o[i], o[j]] = [o[j], o[i]];
          return upd((d) => { lay(d).tab_order = o; }, 'selection');
        }
        case 'btab': st.btab = el.dataset.v; M.haptic('selection'); return draw();
        case 'blk': return upd((d) => { const L = lay(d); L.hidden_blocks = { ...(L.hidden_blocks || {}) }; const s = new Set(L.hidden_blocks[st.btab] || []); if (s.has(k)) s.delete(k); else s.add(k); L.hidden_blocks[st.btab] = [...s]; }, 'selection');
        case 'bmv': {
          const L0 = layoutOf(st.draft), bl = orderedBlocks(blockList(pc(), st.btab), L0, st.btab);
          const fixed = bl.filter((b) => b.fixed).map((b) => b.id), rest = bl.filter((b) => !b.fixed).map((b) => b.id);
          const i = rest.indexOf(k), j = i + Number(el.dataset.d);
          if (i < 0 || j < 0 || j >= rest.length) return;
          [rest[i], rest[j]] = [rest[j], rest[i]];
          return upd((d) => { const L = lay(d); L.block_order = { ...(L.block_order || {}), [st.btab]: [...fixed, ...rest] }; }, 'selection');
        }
        default: return undefined;
      }
    });
    card._sheet = { ov, st };
    if (focus && tabDefs().some((t) => t.id === focus)) st.btab = focus;
    draw();
    return card._sheet;
  }
  // Bunnark (Fiks 6, som «Tilpass lys»): flaten kommer fra MSH.overlay (MSH.sheetStyle/sheetVars) – solid #282828 som
  // standard, frosted glass bare med Liquid Glass-temaet (byttes live). Grupper = --ki-sheet-grp, segmentspor = --ki-sheet-seg.
  const SHEET_CSS = `
    .sh{--ki-sh-pt:8px;--ki-sh-px:16px}
    .nav{position:sticky;top:calc(var(--ki-grab-h, 0px) - var(--ki-sh-pt, 0px) - 1px);z-index:3;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px;min-height:52px;margin:0 -16px 6px;padding:4px 16px;background:var(--ki-sheet-bg,#282828);-webkit-backdrop-filter:var(--ki-sheet-blur,none);backdrop-filter:var(--ki-sheet-blur,none)}
    .nb{justify-self:start;display:inline-flex;align-items:center;height:36px;padding:0 4px;font-size:15px;font-weight:500;color:var(--red,#f28073)}
    .nt{font-size:16px;font-weight:600;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .nd{justify-self:end;height:36px;padding:0 18px;border-radius:18px;background:${PINK};color:${INK};font-size:14px;font-weight:600}
    .nd:disabled{opacity:.6}
    .cap{display:block;font-size:12px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;color:var(--gray600,#7f7f7f);padding:16px 8px 8px}
    .grp{background:var(--ki-sheet-grp,#3a3a3a);box-shadow:var(--ki-sheet-grp-sh,none);border-radius:24px;overflow:hidden}
    .grp>*+*{border-top:1px solid rgba(255,255,255,0.06)}
    .r{display:flex;align-items:center;gap:10px;min-height:56px;padding:6px 8px 6px 16px;width:100%;text-align:left;box-sizing:border-box}
    .r.tr,.r.br{padding-left:8px}
    .r.off>:not(.ib[data-a="tab"]):not(.ib[data-a="blk"]){opacity:.45}
    .rl{flex:1;min-width:0;font-size:15px;font-weight:500;color:var(--white,#fafafa)}
    .rs{display:inline-flex;align-items:center;gap:3px;font-size:12px;font-weight:400;color:var(--ki-g-t2,var(--gray700,#979797))}
    .ti{width:32px;height:32px;border-radius:16px;display:grid;place-items:center;flex:none;background:rgba(255,255,255,0.08);color:var(--gray900,#c7c7c7)}
    .ib{width:40px;height:40px;border-radius:20px;display:grid;place-items:center;flex:none;color:var(--gray900,#c7c7c7);transition:transform .15s}
    .ib:active{transform:scale(.9)} .ib:disabled{opacity:.25} .ib.ph{visibility:hidden}
    .star.on{color:var(--yellow,#f2d26f)}
    .tag{display:inline-block;margin-left:8px;padding:2px 7px;border-radius:7px;font-size:10px;font-weight:600;vertical-align:middle}
    .tag.ber{background:${M.alpha('var(--orange, #f2b573)', 0.18)};color:var(--orange,#f2b573)}
    .tag.bad{background:${M.alpha('var(--blue, #73b9f2)', 0.18)};color:var(--blue,#73b9f2)}
    .seg{display:flex;gap:2px;padding:3px;border-radius:17px;background:var(--ki-sheet-seg,#282828);flex:none;position:relative}
    .seg button{height:30px;padding:0 11px;border-radius:15px;font-size:12px;font-weight:500;color:var(--ki-g-t2,var(--gray800,#afafaf));white-space:nowrap;transition:background .2s}
    .seg button.on,.bseg button.on{background:${PINK};color:${INK}}
    :host(.glass) .seg button.on,:host(.glass) .bseg button.on{${M.GLASS_BUBBLE}}
    .bseg{position:relative;display:flex;gap:2px;padding:3px;margin-bottom:8px;border-radius:19px;background:var(--ki-sheet-seg,#282828);overflow-x:auto;touch-action:pan-x}
    .bseg button{flex:none;height:34px;padding:0 13px;border-radius:17px;font-size:13px;font-weight:500;color:var(--ki-g-t2,var(--gray800,#afafaf));white-space:nowrap;transition:background .2s}
    .note{margin:0;padding:10px 10px 0;font-size:12px;line-height:1.45;color:var(--gray700,#979797)}
    .note.top{padding:0 8px 4px;color:var(--orange,#f2b573)}
    .sw{position:relative;width:52px;height:30px;border-radius:15px;flex:none;background:#4a4a4d;transition:background .2s}
    .sw span{position:absolute;top:4px;left:4px;width:22px;height:22px;border-radius:11px;background:#d8d6d1;transition:left .2s}
    .sw.on{background:var(--green,#66d19e)} .sw.on span{left:26px;background:#2a2a2c}
    .noscroll::-webkit-scrollbar{display:none} .noscroll{scrollbar-width:none}
  `;
})();
