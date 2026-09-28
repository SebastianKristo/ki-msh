/* msh-klima-hero-card + msh-klima-card · Klima-popup (#klima). Fasit: Klima v3 (hero-ideer 2a) + Klima v2.dc.html,
 * funksjon/data fra KI Energi-integrasjonen (ki-klima-strom-kort.js v1.23.0).
 * Denne fila er SKALLET (fiks-4 punkt 4.0, 4.1, 4.4, 4.6, 4.7):
 *   · Hero 2a (msh-klima-hero-card, bygd inn via MSH.HEROES): ring 128 px (ytre = tid i timen, indre = effekt nå mot
 *     tillatt snitt i statusfarge), status + setning + «N min igjen av timen», timebudsjett-bar (brukt · prognose ·
 *     nå-strek) og borte-pillen. Farger etter tersklene number.ki_sone_gul/oransje/rod (Avansert → Terskler).
 *     Entitetene finnes via registeret (platform ki_energi, MSH.kiEnergi/klimaMapId i blokk-filen, fiks 15.12).
 *     Animasjoner med Web Animations API når popupen åpnes og ved bytte tilbake til Oversikt; rolig puls i løkke
 *     (stoppes når popupen lukkes); live-verdier glir 300 ms; ingen animasjon ved prefers-reduced-motion.
 *   · Modus-bobler (Borte · Alle borte · Hjemkomst · Sommer · <person> ferie) → switch.ki_* i integrasjonen.
 *   · Glass-fanerad (scroller, min 58 px per fane, MSH.tabReorder = dra/omorganiser + glass-linse ved trykk) +
 *     tannhjul (46 px, samme glass) som åpner «Tilpass klima».
 *   · «Tilpass klima»: eget bunnark (MSH.overlay – solid, frosted med Liquid Glass-tema) med Visning / Faner / Blokker. Tilbakestill
 *     øverst til venstre, Ferdig lagrer én gang (MSH.draftEditor → MSH.saveCardConfig, scope 'shared'). Utkastet vises
 *     live bak arket; ingen autolagring; utenfor/Esc forkaster; «Endret et annet sted – Last inn» (fiks 15.13).
 * Blokkene (faneinnholdet) bygges i 42-klima-blokker.js (lastes før denne): MSH.KLIMA_TABS, klimaHasTab,
 * klimaBlockList, klimaTabHTML, klimaAct, klimaInput, klimaAfterRender, klimaOnOpen/OnClose, KLIMA_BLOCK_CSS,
 * klimaToast, klimaStatus. Alt kalles defensivt – mangler fila, vises en plassholder.
 * Config: title, toasts, hero_style: ring|hus|batteri|maaler|puls|blokker (17.29), gap/pad_top/pad_bottom (17.28,
 *   standard 16/20/40), layout: { show_hero, show_modes, tab_style: both|text|icon, tab_order[],
 *   hidden_tabs[], default_tab, remember_tab, block_order: { fane: [id] }, hidden_blocks: { fane: [id] } }.
 *   19.8: default_tab = «Åpne med» (skjult → første synlige), remember_tab (std av) = åpne med sist valgte fane (per enhet,
 *   localStorage ki:<card_id>:ui); av = alltid «Åpne med» når popupen åpnes. Eldre rotnøkkel remember_tab leses fortsatt.
 *   Fanelinjen: fast #3a3a3a-flate (ingen backdrop-filter), radius 30, padding 6, gap 4; tannhjul 52 px i samme flate.
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
    try { const res = await M.saveCardConfig(card.hass, old, next); if (res && res.config && res.config.card_id !== next.card_id) card.setConfig(res.config); } catch (e) { console.error('msh-klima-card', 'lagring feilet', e); }
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
  // All lesing går via mapId → faktisk entitets-ID fra registeret (fiks 15.12, M.klimaMapId i blokk-filen)
  const ki = (card, id) => card.s(mapId(id));
  const attrs = (card, id) => { const s = ki(card, id); return (s && s.attributes) || {}; };
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
    const s = ki(card, 'sensor.ki_lading_status');
    return !!s && !['ingen', 'unavailable', 'unknown'].includes(s.state);
  };
  const hasTab = (card, id) => {
    if (M.klimaHasTab) { try { return !!M.klimaHasTab(card, id); } catch (e) { console.error('msh-klima-card', e); } }
    return id !== 'lading' || harLading(card);
  };
  const safe = (fn, fb) => { try { return fn(); } catch (e) { console.error('msh-klima-card', e); return fb; } };
  const blockList = (card, tab) => (M.klimaBlockList ? safe(() => M.klimaBlockList(card, tab) || [], []) : []);

  // 17.28 · Mellomrom (samme komponent og felter som Rom: gap, pad_top, pad_bottom; MSH._applySpacing + MSH.popupBottomPad)
  const SPACING = { gap: 16, pad_top: 20, pad_bottom: 40 };
  const SPACING_FIELDS = [
    { type: 'range', name: 'gap', label: 'Mellom seksjonene', icon: 'mdi:arrow-split-horizontal', min: 0, max: 48, default: SPACING.gap, presets: [[8, 'Tett 8'], [16, 'Standard 16'], [24, 'Luftig 24']] },
    { type: 'range', name: 'pad_top', label: 'Fra popup-headeren til første kort', icon: 'mdi:format-vertical-align-top', min: -4, max: 120, default: SPACING.pad_top, presets: [[-4, 'Inntil −4'], [6, 'Tett 6'], [20, 'Standard 20'], [44, 'Luftig 44']], help: 'Negativ verdi trekker innholdet opp mot popup-headeren' },
    { type: 'range', name: 'pad_bottom', label: 'Luft i bunnen', icon: 'mdi:format-vertical-align-bottom', min: 0, max: 160, default: SPACING.pad_bottom, presets: [[0, 'Ingen 0'], [40, 'Standard 40'], [96, 'Stor 96']], help: 'Kommer i tillegg til navbaren og safe area' },
  ];
  M.KLIMA_SPACING = SPACING;
  // 17.29 · Toppkort-stil (hero_style). Alle viser samme data; «ring» er standard.
  const HERO_STYLES = [['ring', 'Ringer', 'mdi:circle-double'], ['hus', 'Hus', 'mdi:home-lightning-bolt-outline'], ['batteri', 'Batteri', 'mdi:battery-charging-medium'],
    ['maaler', 'Måler', 'mdi:speedometer'], ['puls', 'Puls', 'mdi:pulse'], ['blokker', 'Klosser', 'mdi:view-grid-outline']];
  const heroStyleOf = (c) => { const v = c && c.hero_style; return HERO_STYLES.some(([k]) => k === v) ? v : 'ring'; };
  M.KLIMA_HERO_STYLES = HERO_STYLES;

  // Layout (config.layout) med standardverdier. Eldre rotnøkler (tab_order, hidden_tabs, start_tab) leses fortsatt.
  const LAY_DEF = { show_hero: true, show_modes: true, tab_style: 'both' };
  function layoutOf(c) {
    c = c || {};
    const L = c.layout && typeof c.layout === 'object' ? c.layout : {};
    const out = { ...LAY_DEF, ...L };
    if (!Array.isArray(out.tab_order) && Array.isArray(c.tab_order)) out.tab_order = c.tab_order.map(tabId);
    if (!Array.isArray(out.hidden_tabs) && Array.isArray(c.hidden_tabs)) out.hidden_tabs = c.hidden_tabs.map(tabId);
    if (!out.default_tab && c.start_tab) out.default_tab = tabId(c.start_tab);
    if (out.remember_tab == null && c.remember_tab != null) out.remember_tab = c.remember_tab;
    out.remember_tab = out.remember_tab === true || out.remember_tab === 'true';
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
  // Tersklene for fargesonene (% av tillatt effekt): number.ki_sone_* i integrasjonen (number.ki_terskel_* godtas), ellers 75/88/97
  function thresholds(card) {
    const t = (k, d) => { for (const id of [`number.ki_sone_${k}`, `number.ki_terskel_${k}`]) { const n = card.n(mapId(id)); if (n != null) return n; } return d; };
    return { yellow: t('gul', 75), orange: t('oransje', 88), red: t('rod', 97) };
  }
  M.klimaThresholds = thresholds;
  // Lokal beregning (brukes når blokk-filens MSH.klimaStatus mangler, og for felt den ikke gir)
  function statusLocal(card) {
    const s = ki(card, ST), a = (s && s.attributes) || {};
    const d = new Date(), minClock = 60 - d.getMinutes() - d.getSeconds() / 60;
    // Attributtnavnene er integrasjonens (engine.py → sensor.ki_energi_status), ingen gjetting
    const kw = firstNum(a, ['forventet_effekt_kw']);
    const allowed = firstNum(a, ['tillatt_effekt_kw']);
    const usedKwh = firstNum(a, ['forbrukt_kwh']);
    const limitKwh = firstNum(a, ['grense_kwh']);
    const minLeft = firstNum(a, ['minutter_igjen']) != null ? firstNum(a, ['minutter_igjen']) : Math.max(0, Math.round(minClock));
    let forecastKwh = card.n(mapId('sensor.ki_estimert_timesforbruk'));
    if (forecastKwh == null && usedKwh != null && kw != null) forecastKwh = usedKwh + kw * (minLeft / 60);
    let freeKw = firstNum(a, ['ledig_kw']);
    if (freeKw == null && allowed != null && kw != null) freeKw = Math.max(0, allowed - kw);
    const pct = kw != null && allowed ? (kw / allowed) * 100 : null;
    const laster = Array.isArray(attrs(card, LASTER).laster) ? attrs(card, LASTER).laster : [];
    const lowered = laster.filter((l) => l && l.handling === 'senket').map((l) => l.navn).filter(Boolean);
    const cand = laster.filter((l) => l && l.type !== 'bryter' && l.handling === 'normal');
    const nextZone = cand.length ? cand[cand.length - 1].navn : null;
    const T = thresholds(card), st = s ? String(s.state).toLowerCase() : '';
    const hb = ki(card, 'switch.ki_energi_hovedbryter');
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
    // Tid i timen = klokken (ytre ring og nå-streken); «N min igjen» fra motoren når den finnes
    const d = new Date();
    S.timeFrac = Math.min(1, Math.max(0, (d.getMinutes() * 60 + d.getSeconds()) / 3600));
    // Ingen/utilgjengelig statussensor → «–» og flat ring (ikke «Motoren er av»/«Trygg fallback»)
    const st = ki(card, ST);
    if (!st || M.unavailable(st)) S.zone = 'none';
    // «Venter på KI Energi» bare når integrasjonen mangler eller statusen er utilgjengelig (15.12 punkt 4)
    const info = M.kiEnergi ? safe(() => M.kiEnergi(card), null) : null;
    S.installert = info ? info.installert : !!st;
    S.venter = info ? info.venter : (!st || st.state === 'unavailable');
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
      default: return S.venter
        ? `Venter på KI Energi.${S.installert ? ' Integrasjonen svarer ikke akkurat nå.' : ''}`
        : 'Motoren har ikke rapportert ennå. Verdiene fylles inn ved neste runde.';
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
    _awayId() { const id = mapId('switch.ki_helgemodus'); return this.s(id) ? id : null; }
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
      const tsId = mapId('sensor.ki_tilstedevaerelse'), ts = this.s(tsId), tt = ts && ts.attributes && ts.attributes.tekst;
      const pill = awayId
        ? `<button class="away press" data-act="kaway" data-id="${esc(awayId)}" data-ent="${esc(awayId)}" data-haptic="success" style="background:${away ? M.alpha('var(--blue, #73b9f2)', 0.22) : 'var(--gray100,#2f2f2f)'};color:${away ? '#e6eef8' : 'var(--gray800,#afafaf)'}">${M.icon(away ? 'mdi:bag-suitcase' : 'mdi:home', 16)}${esc(away ? (hytte ? 'Tom hytte · frostsikring' : 'Borte · bortemodus') : (tt || 'Hjemme · normal komfort'))}</button>`
        : ts ? `<button class="away press" data-act="more" data-id="${esc(tsId)}" data-ent="${esc(tsId)}" style="background:var(--gray100,#2f2f2f);color:var(--gray800,#afafaf)">${M.icon('mdi:home-account', 16)}${esc(tt || ts.state)}</button>` : '';
      // 17.29: alternative toppkort (samme data, egen visualisering)
      const hs = heroStyleOf(this.config);
      this._hs = hs;
      if (hs !== 'ring') return this._altHero(hs, S, Z, { lim, used, fc, usedPct, fcPct, tFrac, off, pill });
      const ring = (cls, r, w, C, frac) => `<circle class="${cls}" cx="100" cy="100" r="${r}" stroke-width="${w}" data-c="${C.toFixed(2)}" style="stroke-dasharray:${C.toFixed(2)}px;stroke-dashoffset:${(C * (1 - frac)).toFixed(2)}px;opacity:${frac > 0.001 ? 1 : 0}"></circle>`;
      const crit = S.zone === 'critical';
      return `<section class="kh${crit ? ' crit' : ''}${off ? ' dull' : ''}" style="--zc:${col}" data-zone="${S.zone}">
        <div class="top">
          <div class="ring press" data-act="more" data-id="${esc(mapId(ST))}" data-ent="${esc(mapId(ST))}" role="img" aria-label="Effekt nå ${kwTxt(S.kw)} kW av ${kwTxt(S.allowed)} kW tillatt">
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
            ${S.zone === 'none' && S.venter ? `<button class="setup press" data-act="nav" data-path="${esc(M.KI_ENERGI_OPPSETT || '/config/integrations/integration/ki_energi')}" data-haptic="light">${M.icon('mdi:cog-outline', 14)}Sett opp KI Energi</button>` : ''}
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

    /* ---------------- 17.29 · alternative toppkort (Hus · Batteri · Måler · Puls · Klosser) */
    // Felles: status (Z.t) i statusfarge, «N min igjen av timen», nøkkeltall Brukt · Prognose · Grense og borte-pillen.
    // Mangler data: «–» og flat/tom visualisering – kortet vises alltid. Animasjonene er CSS-@keyframes (styles), står
    // stille når popupen er lukket (:host(:not([data-run]))) og er av ved prefers-reduced-motion.
    _altHero(hs, S, Z, o) {
      const st = mapId(ST), crit = S.zone === 'critical';
      const minTxt = `${S.minLeft != null ? Math.round(S.minLeft) : '–'} min igjen av timen`;
      const ml = `<div class="ml">${M.icon('mdi:clock-outline', 14)}<span class="num">${minTxt}</span></div>`;
      const setup = S.zone === 'none' && S.venter ? `<button class="setup press" data-act="nav" data-path="${esc(M.KI_ENERGI_OPPSETT || '/config/integrations/integration/ki_energi')}" data-haptic="light">${M.icon('mdi:cog-outline', 14)}Sett opp KI Energi</button>` : '';
      const keys = `<div class="kk num">${[[o.used, 'Brukt'], [o.fc, 'Prognose'], [o.lim, 'Grense']].map(([v, l]) => `<div><b>${kwTxt(v)}<small> kWh</small></b><span>${l}</span></div>`).join('')}</div>`;
      const pill = o.pill ? `<div class="pw">${o.pill}</div>` : '';
      const kwNum = (cls) => `<span class="${cls} num" data-n="kw" data-v="${S.kw != null ? S.kw : ''}">${kwTxt(S.kw)}</span>`;
      const more = `data-act="more" data-id="${esc(st)}" data-ent="${esc(st)}"`;
      const head = (inner) => `<section class="kh alt a-${hs}${crit ? ' crit' : ''}${o.off ? ' dull' : ''}" style="--zc:${Z.c}" data-zone="${S.zone}" data-style="${hs}">${inner}</section>`;
      const cl = (v) => Math.min(1, Math.max(0, v));
      switch (hs) {
        case 'hus': {
          // Fyllnivå = prognose mot grense (grensen = toppen av veggene, over 100 % stiger det inn i taket)
          const lv = o.lim && o.fc != null ? Math.min(1.35, Math.max(0, o.fc / o.lim)) : 0;
          return head(`<div class="top">
            <div class="hus press" ${more} role="img" aria-label="Effekt nå ${kwTxt(S.kw)} kW, prognose ${kwTxt(o.fc)} av ${kwTxt(o.lim)} kWh" style="--lv:${lv.toFixed(3)}">
              <span class="pipe"></span><span class="smoke"><i></i><i></i><i></i></span>
              <div class="hb">${lv > 0 ? '<span class="wv w2"></span><span class="wv w1"></span><span class="bb" style="left:30%"></span><span class="bb" style="left:48%;animation-delay:1.4s"></span><span class="bb" style="left:64%;animation-delay:2.6s"></span><span class="bb" style="left:40%;animation-delay:3.5s"></span><span class="fl"></span>' : ''}
                <div class="hc">${kwNum('kw')}<span class="kl">kW nå</span></div></div>
            </div>
            <div class="tx"><div class="stt">${esc(Z.t)}</div><div class="sen">${sentence(S)}</div>${setup}${ml}</div>
          </div>${keys}${pill}`);
        }
        case 'batteri': {
          // Ladningen = det som er igjen av timebudsjettet etter prognosen; hvit markør = brukt
          const ch = o.lim && o.fc != null ? cl((o.lim - o.fc) / o.lim) : 0;
          return head(`<div class="bh2"><div class="bbig press" ${more}><span class="big num" data-n="free" data-v="${S.freeKw != null ? S.freeKw : ''}">${kwTxt(S.freeKw)}</span><span class="bu">kW</span><span class="bl">ledig i timen</span></div>
              <div class="tx r"><div class="stt">${esc(Z.t)}</div>${ml}</div></div>
            <div class="batt" role="img" aria-label="Igjen av timebudsjettet etter prognosen: ${Math.round(ch * 100)} %"><div class="bcell"><div class="bc" style="width:${(ch * 100).toFixed(1)}%">${ch > 0 ? '<span class="gl"></span>' : ''}</div>
              ${o.usedPct != null ? `<span class="bm" style="left:${o.usedPct.toFixed(1)}%"></span>` : ''}<span class="bolt">${M.icon('mdi:lightning-bolt', 22)}</span></div><span class="tip"></span></div>
            <div class="sen">${sentence(S)}</div>${setup}${keys}${pill}`);
        }
        case 'maaler': {
          const T = thresholds(this), p = S.pct != null ? cl(S.pct / 100) : 0;
          const pt = (f, r) => { const a = Math.PI * (1 - f); return [(100 + r * Math.cos(a)).toFixed(2), (100 - r * Math.sin(a)).toFixed(2)]; };
          const arc = (f0, f1, c) => { if (f1 <= f0) return ''; const [x0, y0] = pt(f0, 80), [x1, y1] = pt(f1, 80); return `<path d="M${x0} ${y0} A80 80 0 0 1 ${x1} ${y1}" stroke="${c}"></path>`; };
          const g = cl(T.yellow / 100), r0 = cl(T.red / 100);
          const ticks = Array.from({ length: 11 }, (_, i) => { const f = i / 10, big = i % 5 === 0, [x0, y0] = pt(f, big ? 58 : 62), [x1, y1] = pt(f, 68); return `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" class="${big ? 'tb' : ''}"></line>`; }).join('');
          const deg = ((p - 0.5) * 180).toFixed(1);
          return head(`<div class="gauge press" ${more} role="img" aria-label="Effekt nå ${kwTxt(S.kw)} kW av ${kwTxt(S.allowed)} kW tillatt">
              <svg viewBox="0 0 200 112" aria-hidden="true"><g class="zn">${arc(0, g, 'var(--green, rgb(102 209 158))')}${arc(g, r0, 'var(--orange, rgb(242 181 115))')}${arc(r0, 1, 'var(--red, rgb(242 128 115))')}</g>
                <g class="tk">${ticks}</g>
                <g class="nd${S.pct != null ? ' sway' : ''}" style="--a:${deg}deg"><line x1="100" y1="100" x2="100" y2="38"></line></g><circle class="hub" cx="100" cy="100" r="7"></circle></svg>
            </div>
            <div class="gv">${kwNum('big')}<span class="bu">kW av ${kwTxt(S.allowed)} kW</span></div>
            <div class="gs"><div class="stt">${esc(Z.t)}</div><div class="sen">${sentence(S)}</div>${setup}${ml}</div>${keys}${pill}`);
        }
        case 'puls': {
          const bars = this._pulsBars(S), allowed = S.allowed;
          const top = Math.max(0.5, ...(bars.filter((v) => v != null)), allowed != null ? allowed * 1.15 : 0);
          const bh = (v) => (v == null ? 0 : cl(v / top) * 100);
          const barHTML = bars.map((v) => `<i class="${allowed && v != null && v > allowed * 0.7 ? 'hi' : ''}" style="height:${Math.max(v == null ? 0 : 3, bh(v)).toFixed(1)}%"></i>`).join('');
          return head(`<div class="ph"><span class="live"><i></i>Live effekt</span><span class="chip">${esc(Z.t)}</span></div>
            <div class="gv press" ${more}>${kwNum('big')}<span class="bu">kW nå</span></div>
            <div class="chart" role="img" aria-label="Effekt siste 60 minutter"><div class="bars">${barHTML}</div>${allowed != null ? `<span class="lim" style="bottom:${bh(allowed).toFixed(1)}%"><em>${kwTxt(allowed)} kW</em></span>` : ''}</div>
            <div class="ax"><span>−60 min</span><span>nå</span></div>
            <div class="sen">${sentence(S)}</div>${setup}
            <div class="tb2"><span style="width:${o.usedPct != null ? o.usedPct.toFixed(1) : 0}%"></span>${o.fcPct != null ? `<i style="left:${o.fcPct.toFixed(1)}%"></i>` : ''}</div>
            ${ml}${keys}${pill}`);
        }
        case 'blokker': {
          // 0,5 kWh per kloss (antall = grense / 0,5); brukt = fylt, prognose = striper, kant = nå i timen
          const n = o.lim ? Math.max(1, Math.min(24, Math.round(o.lim / 0.5))) : 11;
          const now = Math.min(n - 1, Math.floor((o.tFrac || 0) * n));
          const cells = Array.from({ length: n }, (_, i) => {
            const a = i * 0.5, u = o.used != null ? cl((o.used - a) / 0.5) : 0, f = o.fc != null ? cl((o.fc - a) / 0.5) : 0;
            const cls = u >= 1 ? 'u' : f > 0 ? 'p' : '';
            const part = u > 0 && u < 1 ? `<span class="pu" style="width:${(u * 100).toFixed(0)}%"></span>` : '';
            return `<span class="kc ${cls}${i === now ? ' now' : ''}" style="animation-delay:${i * 45}ms">${part}</span>`;
          }).join('');
          return head(`<div class="bh2"><div class="bbig press" ${more}>${kwNum('big')}<span class="bu">kW nå</span></div><div class="tx r"><div class="stt">${esc(Z.t)}</div>${ml}</div></div>
            <div class="kgrid" role="img" aria-label="Timebudsjett ${kwTxt(o.used)} av ${kwTxt(o.lim)} kWh brukt, prognose ${kwTxt(o.fc)}" style="grid-template-columns:repeat(${Math.min(n, 12)},minmax(0,1fr))">${cells}</div>
            <div class="lg"><span><i class="d1"></i>Brukt</span><span><i class="d2"></i>Prognose</span><span><i class="d4"></i>Nå i timen</span><span>1 kloss = 0,5 kWh</span></div>
            <div class="sen">${sentence(S)}</div>${setup}${keys}${pill}`);
        }
        default: return '';
      }
    }
    // Puls: 30 søyler à 2 min (siste 60 min). Historikk (uregulert + styrt effekt, W) hentes bare når popupen er åpen;
    // mangler den, brukes live-verdier samlet mens kortet er åpent. Siste søyle = effekt nå.
    _pulsBars(S) {
      const NB = 30, now = Date.now(), t0 = now - 3600000, out = new Array(NB).fill(null);
      const H = this._plHist;
      if (H && H.series.some((x) => x.length)) {
        for (let i = 0; i < NB; i++) {
          const end = t0 + (i + 1) * 120000;
          let sum = null;
          H.series.forEach((pts) => { let v = null; for (const p of pts) { if (p.t <= end) v = p.v; else break; } if (v != null) sum = (sum || 0) + v / 1000; });
          out[i] = sum;
        }
      }
      const L = (this._plLive = (this._plLive || []).filter((p) => p.t > t0));
      if (S.kw != null && (!L.length || now - L[L.length - 1].t > 20000)) L.push({ t: now, v: S.kw });
      L.forEach((p) => { const i = Math.min(NB - 1, Math.floor((p.t - t0) / 120000)); if (out[i] == null || !H) out[i] = p.v; });
      if (S.kw != null) out[NB - 1] = S.kw;
      return out;
    }
    _pulsFetch() {
      if (this._hs !== 'puls' || !this.isOpen || !M.history || this._plBusy) return;
      if (this._plHist && Date.now() - this._plHist.t < 120000) return;
      const ids = ['sensor.ki_uregulert_effekt', 'sensor.ki_styrt_effekt'].map(mapId).filter((id) => this.s(id));
      if (!ids.length) { this._plHist = { t: Date.now(), series: [] }; return; }
      this._plBusy = true;
      M.history(this.hass, ids, 1).then((d) => {
        this._plHist = { t: Date.now(), series: ids.map((id) => ((d && d[id]) || []).slice().sort((a, b) => a.t - b.t)) };
      }).catch((e) => { console.warn('msh-klima-hero-card', e); this._plHist = { t: Date.now(), series: [] }; })
        .then(() => { this._plBusy = false; if (this.isOpen) this.update(); });
    }
    _run() { this.toggleAttribute('data-run', !!this.isOpen && !document.hidden); }
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
    onOpen() { this._pendingIntro = true; this._introRaf(); this._run(); this._pulsFetch(); }
    onClose() { cancelAnimationFrame(this._iRaf); this._stopAnims(); this._introAt = 0; this._run(); }
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
      // Fiks 16.13: bare når popupen er åpen, fanen synlig og kortet har størrelse – ellers står innholdet statisk (synlig)
      const r = this.getBoundingClientRect();
      if (!this.isOpen || document.hidden || !r.width || !r.height) return;
      try { this._intro0(); } catch (e) { console.error('msh-klima-card', e); this._stopAnims(); }
    }
    _intro0() {
      this._stopAnims();
      const q = (s) => this.shadowRoot.querySelector(s), A = [];
      // Fiks 16.13: ingen fill (tidligere 'backwards' holdt opacity 0/scaleX(0) i forsinkelsen). Forsinkelsen bakes inn i
      // nøkkelrammene, så elementet står i sin CSS-tilstand (synlig) før start, etter slutt og etter cancel().
      const an = (el, kf, o) => {
        if (!el || !el.animate) return null;
        const d = o.delay || 0, tot = d + o.duration, a = kf[0], b = kf[kf.length - 1];
        const frames = d ? [{ ...a, offset: 0 }, { ...a, offset: d / tot, easing: o.easing }, { ...b, offset: 1 }] : [{ ...a, easing: o.easing }, b];
        const x = el.animate(frames, { duration: tot, fill: 'none' }); A.push(x); return x;
      };
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
      // Vakt: en animasjon som ikke er ferdig etter forventet tid (tidslinje stoppet, skjult fane …) spoles til slutt
      clearTimeout(this._introT);
      this._introT = setTimeout(() => A.forEach((x) => { if (x.playState !== 'finished' && x.playState !== 'idle') { console.warn('msh-klima-hero-card', 'animasjon hang – spoles til slutt', x.playState, x.currentTime); try { x.finish(); } catch (e) { console.warn('msh-klima-hero-card', e); x.cancel(); } } }), 2200);
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
      (this._loop || []).forEach((x) => { try { x.cancel(); } catch (e) { console.warn('msh-klima-hero-card', e); } });
      const L = [], ef = this.shadowRoot.querySelector('.ef'), pg = this.shadowRoot.querySelector('.bar .pg');
      if (ef && ef.animate && this._S && this._S.zone !== 'off') L.push(ef.animate([{ opacity: 1 }, { opacity: 0.72 }], { duration: 2600, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' }));
      if (pg && pg.animate) L.push(pg.animate([{ opacity: 1 }, { opacity: 0.45 }], { duration: 2200, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' }));
      this._loop = L;
    }
    _stopAnims() {
      clearTimeout(this._loopT);
      [...(this._intro || []), ...(this._loop || [])].forEach((x) => { try { x.cancel(); } catch (e) { console.warn('msh-klima-hero-card', e); } });
      clearTimeout(this._introT);
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
      this._run();
      this._pulsFetch();
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
        .setup{display:inline-flex;align-items:center;gap:6px;align-self:flex-start;height:30px;padding:0 12px;border-radius:15px;font-size:12px;font-weight:500;background:var(--gray300,#404040);color:var(--white,#fafafa)}
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
        /* 17.29 · alternative toppkort */
        .alt .kk{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
        .alt .kk>div{display:flex;flex-direction:column;gap:2px;padding:10px 12px;border-radius:18px;background:var(--gray100,#2f2f2f);min-width:0}
        .alt .kk b{font-size:17px;font-weight:500;color:#fafafa;white-space:nowrap}
        .alt .kk b small{font-size:11px;font-weight:400;color:var(--gray700,#979797)}
        .alt .kk span{font-size:11px;color:var(--gray700,#979797);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .alt .big{font-size:44px;font-weight:300;letter-spacing:-0.03em;line-height:1;white-space:nowrap}
        .alt .bu{font-size:13px;color:var(--gray700,#979797);white-space:nowrap}
        .alt .tx.r{flex:0 1 auto;align-items:flex-end;text-align:right}
        .alt .tx.r .stt{white-space:nowrap;font-size:20px}
        .alt .bh2{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;min-width:0}
        .alt .bbig{display:flex;flex-wrap:wrap;align-items:baseline;column-gap:6px;min-width:0;cursor:pointer}
        .alt .bbig .bl{flex-basis:100%;font-size:12px;color:var(--gray700,#979797)}
        .alt .stt{font-size:22px}
        /* Hus */
        .hus{position:relative;width:132px;height:132px;flex:none;cursor:pointer}
        .hus .pipe{position:absolute;left:66%;top:12%;width:11%;height:22%;border-radius:2px 2px 0 0;background:var(--gray100,#2f2f2f)}
        .hus .smoke{position:absolute;left:66%;top:0;width:11%;height:14%}
        .hus .smoke i{position:absolute;left:25%;bottom:0;width:7px;height:7px;border-radius:50%;background:rgba(255,255,255,0.28);opacity:0;animation:khSmoke 4.5s ease-out infinite}
        .hus .smoke i:nth-child(2){animation-delay:1.5s}.hus .smoke i:nth-child(3){animation-delay:3s}
        .hus .hb{position:absolute;inset:0;overflow:hidden;background:var(--gray100,#2f2f2f);clip-path:polygon(50% 4%,97% 45%,88% 45%,88% 96%,12% 96%,12% 45%,3% 45%)}
        .hus .wv{position:absolute;left:50%;width:280%;height:280%;margin-left:-140%;top:calc(96% - var(--lv) * 51% - 6px);border-radius:43%;background:var(--zc);opacity:.9;animation:khSpin 9s linear infinite;transition:top .6s ease-out,background-color .4s}
        .hus .wv.w2{border-radius:40%;opacity:.4;top:calc(96% - var(--lv) * 51% - 10px);animation-duration:13s;animation-direction:reverse}
        .hus .bb{position:absolute;bottom:6%;width:5px;height:5px;border-radius:50%;background:rgba(255,255,255,0.55);opacity:0;animation:khBub 4.4s ease-in infinite}
        .hus .fl{position:absolute;left:12%;right:12%;top:calc(96% - var(--lv) * 51%);border-top:1.5px dashed rgba(255,255,255,0.75);transition:top .6s ease-out}
        .hus .hc{position:absolute;left:12%;right:12%;top:44%;bottom:4%;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none;text-shadow:0 1px 6px rgba(0,0,0,.45)}
        .hus .hc .kw{font-size:26px}
        .hus .hc .kl{color:#e1e1e1}
        /* Batteri */
        .batt{position:relative;display:flex;align-items:center;gap:4px}
        .bcell{position:relative;flex:1;height:64px;border-radius:18px;background:var(--gray100,#2f2f2f);box-shadow:inset 0 0 0 2px rgba(255,255,255,0.08);overflow:hidden}
        .bc{position:absolute;top:5px;bottom:5px;left:5px;max-width:calc(100% - 10px);border-radius:13px;background:var(--zc);overflow:hidden;transition:width .6s ease-out,background-color .4s}
        .bc .gl{position:absolute;inset:0;background:linear-gradient(100deg,transparent 30%,rgba(255,255,255,0.38) 50%,transparent 70%);transform:translateX(-100%);animation:khGlint 3.4s ease-in-out infinite}
        .bm{position:absolute;top:0;bottom:0;width:3px;margin-left:-1.5px;background:#fafafa;box-shadow:0 0 6px rgba(255,255,255,.8);transition:left .6s ease-out}
        .bolt{position:absolute;inset:0;display:grid;place-items:center;color:#fafafa;pointer-events:none;animation:khBolt 1.8s ease-in-out infinite;filter:drop-shadow(0 1px 4px rgba(0,0,0,.5))}
        .tip{width:7px;height:24px;border-radius:0 4px 4px 0;background:var(--gray100,#2f2f2f);flex:none}
        /* Måler */
        .gauge{position:relative;width:100%;max-width:300px;align-self:center;cursor:pointer}
        .gauge svg{display:block;width:100%;height:auto;overflow:visible}
        .gauge .zn path{fill:none;stroke-width:14;opacity:.9}
        .gauge .tk line{stroke:rgba(255,255,255,0.35);stroke-width:1.5;stroke-linecap:round}
        .gauge .tk line.tb{stroke:rgba(255,255,255,0.7);stroke-width:2}
        .gauge .nd{transform-box:view-box;transform-origin:100px 100px;transform:rotate(var(--a));transition:transform .6s ease-out}
        .gauge .nd.sway{animation:khSway 4s ease-in-out infinite alternate}
        .gauge .nd line{stroke:var(--zc);stroke-width:4;stroke-linecap:round;filter:drop-shadow(0 0 4px var(--zc))}
        .gauge .hub{fill:#fafafa}
        .alt .gv{display:flex;align-items:baseline;justify-content:center;gap:6px;margin-top:-6px}
        .a-puls .gv{justify-content:flex-start;margin:0;cursor:pointer}
        .alt .gs{display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center}
        /* Puls */
        .ph{display:flex;align-items:center;justify-content:space-between;gap:10px}
        .live{display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:500;color:var(--gray800,#afafaf)}
        .live i{position:relative;width:9px;height:9px;border-radius:50%;background:var(--zc)}
        .live i::after{content:'';position:absolute;inset:0;border-radius:50%;background:var(--zc);animation:khPing 1.8s ease-out infinite}
        .chip{height:26px;padding:0 10px;border-radius:13px;display:inline-flex;align-items:center;font-size:12px;font-weight:600;color:var(--zc);background:color-mix(in srgb, var(--zc) 18%, transparent);white-space:nowrap}
        .chart{position:relative;height:84px;overflow:hidden;border-radius:12px}
        .bars{position:absolute;inset:0 0 0 0;display:flex;align-items:flex-end;gap:3px;width:calc(100% + 100% / 30);animation:khScroll 120s linear infinite}
        .bars i{flex:1;min-width:0;border-radius:3px 3px 1px 1px;background:color-mix(in srgb, var(--zc) 75%, transparent);transition:height .4s ease-out}
        .bars i.hi{background:var(--orange,#f2b573)}
        .bars i:last-child{background:var(--zc);box-shadow:0 0 8px var(--zc)}
        .lim{position:absolute;left:0;right:0;border-top:1.5px dashed rgb(240 86 110)}
        .lim em{position:absolute;right:0;bottom:2px;font-style:normal;font-size:10px;color:rgb(240 86 110)}
        .ax{display:flex;justify-content:space-between;font-size:10px;color:var(--gray600,#7f7f7f);margin-top:-10px}
        .tb2{position:relative;height:4px;border-radius:2px;background:var(--gray100,#2f2f2f)}
        .tb2 span{position:absolute;left:0;top:0;bottom:0;border-radius:2px;background:var(--zc)}
        .tb2 i{position:absolute;top:-3px;bottom:-3px;width:2px;margin-left:-1px;background:color-mix(in srgb, var(--zc) 55%, #fafafa)}
        /* Klosser */
        .kgrid{display:grid;gap:5px}
        .kc{position:relative;height:30px;border-radius:8px;background:var(--gray100,#2f2f2f);overflow:hidden;animation:khPop .55s cubic-bezier(.34,1.6,.64,1) backwards}
        .kc.u{background:var(--zc)}
        .kc.p{background:repeating-linear-gradient(-45deg,color-mix(in srgb, var(--zc) 45%, transparent) 0 5px,color-mix(in srgb, var(--zc) 18%, transparent) 5px 10px);background-size:14.14px 14.14px;animation:khPop .55s cubic-bezier(.34,1.6,.64,1) backwards,khStripe 1.2s linear infinite}
        .kc .pu{position:absolute;left:0;top:0;bottom:0;background:var(--zc)}
        .kc.now{box-shadow:inset 0 0 0 2px #fafafa}
        .lg .d4{width:8px;height:8px;border-radius:2px;box-shadow:inset 0 0 0 1.5px #fafafa}
        .a-blokker .lg .d2{background:repeating-linear-gradient(-45deg,color-mix(in srgb, var(--zc) 60%, transparent) 0 2px,transparent 2px 4px)}
        @keyframes khSpin{to{transform:rotate(360deg)}}
        @keyframes khBub{0%{opacity:0;transform:translateY(0)}20%{opacity:.8}100%{opacity:0;transform:translateY(calc(var(--lv) * -58px))}}
        @keyframes khSmoke{0%{opacity:0;transform:translate(0,0) scale(.6)}25%{opacity:.7}100%{opacity:0;transform:translate(6px,-18px) scale(1.8)}}
        @keyframes khGlint{0%,35%{transform:translateX(-100%)}75%,100%{transform:translateX(100%)}}
        @keyframes khBolt{0%,100%{opacity:.75;transform:scale(.94)}50%{opacity:1;transform:scale(1.08)}}
        @keyframes khSway{from{transform:rotate(calc(var(--a) - 2.5deg))}to{transform:rotate(calc(var(--a) + 2.5deg))}}
        @keyframes khPing{0%{transform:scale(1);opacity:.7}100%{transform:scale(2.6);opacity:0}}
        @keyframes khScroll{from{transform:translateX(0)}to{transform:translateX(calc(-100% / 31))}}
        @keyframes khPop{from{transform:scale(.4) translateY(8px);opacity:0}}
        @keyframes khStripe{from{background-position:0 0}to{background-position:14.14px 0}}
        :host(:not([data-run])) .kh *,:host(:not([data-run])) .kh *::after{animation-play-state:paused!important}
        @media (prefers-reduced-motion: reduce){.kh *,.kh{transition:none!important}.alt *,.alt *::after{animation:none!important}}
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
      [mapId('binary_sensor.ki_alle_borte'), hytte ? 'Hytta tom' : 'Alle borte', 'mdi:logout', false],
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
            { type: 'select', name: 'hero_style', label: 'Toppkort-stil', options: HERO_STYLES.map(([k, l]) => [k, l]), default: 'ring' },
            { type: 'boolean', name: 'layout.show_modes', label: 'Modus-bobler', default: true },
            { type: 'select', name: 'layout.tab_style', label: 'Fanestil', options: [['both', 'Ikon + tekst'], ['text', 'Tekst'], ['icon', 'Ikon']], default: 'both' },
          ] },
          { type: 'section', id: 'faner', label: 'Faner', icon: 'mdi:tab', fields: [
            { type: 'select', name: 'layout.default_tab', label: 'Åpne med', options: (() => { const v = visibleTabs(pc, layoutOf(c)); return T.filter((t) => v.includes(t.id)).map((t) => [t.id, t.label]); })(), default: 'oversikt' },
            { type: 'boolean', name: 'layout.remember_tab', label: 'Husk siste fane', help: 'På: åpner med fanen du sist var på (per enhet). Av: alltid «Åpne med».', default: false },
            { type: 'order', name: 'layout.tab_order', hiddenName: 'layout.hidden_tabs', label: 'Faner (rekkefølge og synlighet)', options: T.map((t) => [t.id, t.label]) },
          ] },
          ...(blocks.length ? [{ type: 'section', id: 'blokker', label: 'Blokker', icon: 'mdi:view-agenda-outline', fields: blocks }] : []),
          { type: 'section', id: 'spacing', label: 'Mellomrom', icon: 'mdi:arrow-expand-vertical', meta: (hh, cc) => `${cc.gap != null ? cc.gap : SPACING.gap} px mellom`, fields: SPACING_FIELDS },
          { type: 'boolean', name: 'toasts', label: 'Bekreftelsesmeldinger', default: true },
        ];
      };
    }
    constructor() {
      super();
      // Ikke tegn på nytt mens et felt har fokus (som _ventTegn i JS-kortet) – tegn når feltet forlates
      this.shadowRoot.addEventListener('focusout', () => { if (this._waitDraw) { this._waitDraw = false; setTimeout(() => this.update(), 250); } });
    }
    // 17.28: standard mellomrom i Bubble-popupen (MSH.Card._applySpacing)
    static get spacingDefaults() { return SPACING; }
    get cardSize() { return 14; }
    get layout() { return layoutOf(this.config); }
    // Fiks 16.13 – ÅRSAKEN til tom #klima: HAs hui-card (_loadElement) gjør `element.layout = 'grid'` uten try/catch. Med bare
    // getter kastet det («Cannot set property layout of #<Klima> which has only a getter»), Bubble logget bare en advarsel
    // («Failed to create card element») og popupen ble tom. HAs verdi lagres separat; this.layout er fortsatt kortets layout.
    set layout(v) { this._haLayout = v; }
    setConfig(c) { super.setConfig(c); this._skeleton(); this._applySpacing(); }
    connectedCallback() {
      this._skeleton();
      if (!this._hass) {
        const ha = document.querySelector('home-assistant');
        if (ha && ha.hass) { console.info('msh-klima-card', 'hass hentet fra <home-assistant>'); this.hass = ha.hass; }
      }
      super.connectedCallback();
      this._armWatch();
    }
    // Diagnoseskjelett (hero med «–» + faner) før alt annet: synlig fra første øyeblikk, også uten hass/data
    _skeleton() {
      if (this._firstRender || !this.shadowRoot || this.shadowRoot.childElementCount) return;
      const tabs = tabDefs().map((t) => `<span class="sk-t">${esc(t.label)}</span>`).join('');
      this.shadowRoot.innerHTML = `<style>${M.BASE_CSS}.sk{display:flex;flex-direction:column;gap:8px}.sk-h{display:flex;align-items:center;gap:18px;min-height:170px;box-sizing:border-box;padding:20px 18px;border-radius:32px;background:var(--gray200,#3a3a3a);color:var(--gray800,#afafaf);font-size:13px}.sk-r{flex:0 0 auto;width:110px;height:110px;border-radius:50%;box-shadow:inset 0 0 0 12px var(--gray300,#404040);display:grid;place-items:center;font-size:30px;font-weight:300;color:var(--white,#fafafa)}.sk-s{font-size:20px;color:var(--white,#fafafa)}.sk-ts{display:flex;gap:6px;overflow:hidden}.sk-t{flex:0 0 auto;padding:12px 14px;border-radius:22px;background:var(--gray200,#3a3a3a);color:var(--gray800,#afafaf);font-size:13px}</style><ha-card><div class="sk" data-skeleton><div class="sk-h"><div class="sk-r">–</div><div><div class="sk-s">–</div><div>Klima lastes …</div></div></div><div class="sk-ts">${tabs}</div></div></ha-card>`;
    }
    // Vakt: 3 s etter tilkobling/åpning – er kortet fortsatt usynlig (høyde 0 / opacity 0), tegnes et feilkort med diagnosen
    _armWatch() { clearTimeout(this._watchT); this._watchT = setTimeout(() => this._watch(), 3000); }
    _watch() {
      if (!this.isConnected) return;
      const cont = M.popupContainer(this);
      // Popupen er lukket/skjult (Bubble viser den ikke): høyde 0 er riktig – ny sjekk ved neste åpning
      if (!M.isPopupOpen(this) || document.hidden || (cont && !cont.getBoundingClientRect().height)) return;
      const d = this.diagnose();
      if (d.synlig) { if (this._blank) { this._blank = null; this.update(); } return; }
      const first = !this._blank;
      this._blank = d;
      if (first) console.error('msh-klima-card', 'ingenting synlig etter 3 s', JSON.stringify(d));
      const hc = this.shadowRoot.querySelector('ha-card');
      if (hc) { hc.querySelectorAll(':scope > [data-blank]').forEach((x) => x.remove()); hc.insertAdjacentHTML('afterbegin', this._blankHTML(true)); }
      else this.shadowRoot.innerHTML = `<style>${M.BASE_CSS}</style><ha-card>${this._blankHTML(true)}</ha-card>`;
      this._armWatch();
    }
    _blankHTML(post) {
      if (!this._blank) return '';
      return `<div class="empty msh-fail" data-blank ${post ? 'data-post' : ''} role="alert" style="color:var(--red,#f28073);text-align:left;align-items:flex-start;flex-direction:column">${M.icon('mdi:alert-circle-outline', 22)}<span>Klima-kortet viser ingenting etter 3 s. Diagnose (send denne):</span><pre style="margin:0;max-width:100%;max-height:300px;overflow:auto;white-space:pre-wrap;font-size:11px;color:var(--gray900,#c7c7c7)">${esc(JSON.stringify(this._blank, null, 1))}</pre></div>`;
    }
    // Diagnoseobjektet (samme felter som docs/klima-diagnose.md): størrelse, opasitet og animasjoner
    diagnose() {
      const sr = this.shadowRoot, hs = this._heroEl && this._heroEl.shadowRoot;
      const op = (el) => {
        let o = 1;
        for (let n = el, i = 0; n && n.nodeType === 1 && i < 40; i++) {
          const c = getComputedStyle(n);
          if (c.display === 'none' || c.visibility === 'hidden') return 0;
          o *= Number(c.opacity);
          if (n === this) break;
          n = n.parentNode && n.parentNode.nodeType === 11 ? n.parentNode.host : n.parentNode;
        }
        return Math.round(o * 1000) / 1000;
      };
      const box = (el) => (el ? { h: Math.round(el.getBoundingClientRect().height), op: op(el) } : null);
      const vis = (b) => !!b && b.h > 0 && b.op > 0.05;
      const anims = [];
      [sr, hs].forEach((root) => { if (root && root.getAnimations) root.getAnimations().forEach((a) => { const t = a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming() : {}, tg = a.effect && a.effect.target; anims.push({ el: tg ? tg.localName + (tg.getAttribute('class') ? '.' + tg.getAttribute('class').split(' ')[0] : '') : null, playState: a.playState, fill: t.fill, delay: t.delay, currentTime: a.currentTime == null ? null : Math.round(a.currentTime), progress: t.progress }); }); });
      const r = this.getBoundingClientRect(), cs = getComputedStyle(this);
      const tabs = sr.querySelector('.trow') || sr.querySelector('.sk-ts'), fail = sr.querySelector('.msh-fail:not([data-blank])');
      const kh = hs && hs.querySelector('.kh');
      const st = M.kiEnergi ? safe(() => M.kiEnergi(this), null) : null;
      const d = {
        versjon: window.KI_MSH_VERSION || '', open: !!this._open, firstRender: !!this._firstRender, hasHass: !!this._hass, config: !!this._config,
        host: { h: Math.round(r.height), w: Math.round(r.width), op: Number(cs.opacity), vis: cs.visibility, display: cs.display },
        haCard: box(sr.querySelector('ha-card')), hero: box(kh), tabs: box(tabs), feilkort: box(fail), html: sr.innerHTML.length,
        anims, hidden: document.hidden, status: st && st.status ? st.status.state : null,
      };
      d.synlig = r.height > 0 && (vis(d.tabs) || vis(d.feilkort)) && (!kh || vis(d.hero) || vis(d.feilkort));
      return d;
    }
    customize(focus) { return openSheet(this, focus); }
    _render() {
      const ae = this._firstRender && this.shadowRoot.activeElement;
      if (ae && /^(INPUT|SELECT|TEXTAREA)$/.test(ae.tagName)) { this._waitDraw = true; return; }
      super._render();
    }
    _curTab() {
      const L = this.layout, tabs = visibleTabs(this, L);
      const sel = L.remember_tab ? this.ui.tab : this._tab;
      const s = sel ? tabId(sel) : null;
      return tabs.includes(s) ? s : tabs.includes(L.default_tab) ? L.default_tab : tabs[0];
    }

    render() {
      if (M.kiEnergi) safe(() => M.kiEnergi(this), null); // registeroppslag + oppstartslogg (15.12)
      const c = this.config, L = this.layout;
      const T = Object.fromEntries(tabDefs().map((t) => [t.id, t]));
      const tabs = visibleTabs(this, L), tab = this._curTab();
      this._shownTab = tab;
      const st = ['both', 'text', 'icon'].includes(L.tab_style) ? L.tab_style : 'both';
      const body = !tab ? '' : M.klimaTabHTML
        ? safe(() => M.klimaTabHTML(this, tab, L), `<div class="empty">Kunne ikke tegne fanen</div>`)
        : `<div class="empty">${M.icon('mdi:timer-sand', 22)}<span>Innholdet i «${esc((T[tab] || {}).label || tab)}» lastes …</span></div>`;
      return `<div class="wrap">${this._blankHTML(false)}
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
      // 19.8: sist valgte fane lagres alltid per enhet (ui.tab), men brukes bare ved åpning når «Husk siste fane» er på
      this._tab = k; this.setUI({ tab: k });
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
    onOpen() {
      // 19.8: «Husk siste fane» av → popupen åpner alltid med «Åpne med»-fanen
      if (!this.layout.remember_tab) this._tab = null;
      if (M.klimaOnOpen) safe(() => M.klimaOnOpen(this)); this._armWatch();
    }
    onClose() { if (M.klimaOnClose) safe(() => M.klimaOnClose(this)); }
    disconnectedCallback() { super.disconnectedCallback(); this._open = false; clearTimeout(this._watchT); }
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
        .msh-hero-slot{margin-bottom:var(--msh-gap,${SPACING.gap}px)}
        .wrap{display:flex;flex-direction:column;gap:var(--msh-gap,${SPACING.gap}px)}
        .ttl{font-size:15px;font-weight:500;color:var(--gray800,#afafaf);padding:0 6px}
        .modes{display:flex;gap:12px;overflow-x:auto;padding:4px 2px;margin:0}
        .mode{flex:none;display:flex;flex-direction:column;align-items:center;gap:6px;width:66px}
        .mb{width:58px;height:58px;border-radius:29px;display:grid;place-items:center;transition:transform .35s cubic-bezier(.34,1.8,.64,1),background .25s,box-shadow .25s}
        .mode:active .mb{transform:scale(.94)!important}
        .ml{font-size:11px;font-weight:500;white-space:nowrap;max-width:66px}
        ${M.TAB_ROW_CSS || ''}
        .trow{display:flex;align-items:center;gap:8px;min-width:0}
        /* Fiks 15.2: glassflate bare med Liquid Glass-temaet (MSH.tabSurface), ellers transparent + ring; glass-dra alltid */
        /* 19.8: fast flate #3a3a3a + tynn ring, ingen glass/backdrop-filter; glass-linsen (tabReorder) virker oppå */
        .tbox{flex:1;min-width:0;padding:6px;border-radius:30px;background:var(--gray200,#3a3a3a);box-shadow:inset 0 0 0 1px rgba(255,255,255,0.05);-webkit-backdrop-filter:none;backdrop-filter:none;overflow:hidden}
        .tabs{position:relative;gap:4px;border-radius:24px}
        .tabs>.tab{flex:1 0 auto;min-width:58px;padding:0 10px;height:54px;border-radius:24px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;color:var(--gray700,#979797);background:transparent;transition:background .25s,color .25s}
        .tabs>.tab.on{background:${PINK};color:${INK}}
        .tabs.s-text>.tab{height:40px;padding:0 14px}
        .tabs.s-text .tl{font-size:13px}
        .tabs.s-icon>.tab{height:46px;padding:0 12px}
        .tl{font-size:10px;font-weight:500;white-space:nowrap}
        .gear{width:52px;height:52px;border-radius:26px;flex:none;display:grid;place-items:center;background:var(--gray200,#3a3a3a);box-shadow:inset 0 0 0 1px rgba(255,255,255,0.05);-webkit-backdrop-filter:none;backdrop-filter:none;color:var(--white,#fafafa)}
        .gear:active{transform:scale(.92)}
        .kbody{display:flex;flex-direction:column;gap:var(--msh-gap,${SPACING.gap}px);min-width:0}
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
    const st = { btab: card._shownTab || 'oversikt', busy: false, reset: false };
    let ov = null;
    // Felles utkast (MSH.draftEditor, fiks 15.13): ingen autolagring, Ferdig lagrer én gang, «Last inn»-banner
    const ctl = M.draftEditor(card, {
      config: clone(orig), saved: orig,
      prepare: (d) => { const n = clone(d); tidy(n); return n; },
      saveOpts: { scope: 'shared' },
      banner: () => ov && ov.body,
      alive: () => !ov || ov.host.isConnected,
      close: () => ov && ov.close(),
      onBusy: (b) => { st.busy = b; draw(); },
      onReload: () => { st.reset = false; draw(); },
    });
    Object.defineProperty(st, 'draft', { get: () => ctl.draft, set: (v) => ctl.set(v) });
    const preview = () => ctl.preview();
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
      // 19.8: «Åpne med» = default_tab når den er synlig, ellers første synlige (stjernen og nedtrekkslisten er den samme verdien)
      const visT = visibleTabs(P, L), defTab = L.default_tab && visT.includes(L.default_tab) ? L.default_tab : visT[0];
      const dt = byId[defTab] || { label: defTab || '–', icon: 'mdi:tab' };
      const openWith = `<div class="r"><span class="rl">Åpne med</span><label class="dsel press">${M.icon(dt.icon, 18)}<span class="ell">${esc(dt.label)}</span>${M.icon('mdi:chevron-down', 18)}
          <select data-deftab="1" aria-label="Åpne med">${visT.map((k) => `<option value="${esc(k)}"${k === defTab ? ' selected' : ''}>${esc((byId[k] || { label: k }).label)}</option>`).join('')}</select></label></div>`;
      const remRow = `<button class="r" data-a="remember" data-v="${L.remember_tab ? 0 : 1}" role="switch" aria-checked="${L.remember_tab}"><span class="rl col"><span>Husk siste fane</span><span class="rs">${L.remember_tab ? 'Åpner med fanen du sist var på (denne enheten)' : 'Åpner alltid med «Åpne med»-fanen'}</span></span><span class="sw${L.remember_tab ? ' on' : ''}"><span></span></span></button>`;
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
      // 17.29: toppkort-stil (3×2, valgt = rosa)
      const hs = heroStyleOf(d);
      const heroGrid = `<div class="hsg" role="radiogroup" aria-label="Toppkort-stil">${HERO_STYLES.map(([k, l, ic]) => `<button class="hso${k === hs ? ' on' : ''}" data-a="hero" data-v="${k}" role="radio" aria-checked="${k === hs}">${M.icon(ic, 24)}<span>${esc(l)}</span></button>`).join('')}</div>`;
      // 17.28: Mellomrom (slider + forvalg, live bak arket)
      const spRows = SPACING_FIELDS.map((f) => {
        const cur = d[f.name] != null && isFinite(Number(d[f.name])) ? Number(d[f.name]) : f.default;
        return `<div class="r sp" data-key="sp-${f.name}"><div class="spl"><span class="ti">${M.icon(f.icon, 18)}</span><span class="rl">${esc(f.label)}</span><span class="spv" data-spv="${f.name}">${cur} px</span></div>
          <input type="range" min="${f.min}" max="${f.max}" step="1" value="${cur}" data-sp="${f.name}" aria-label="${esc(f.label)}">
          <div class="spp">${f.presets.map(([v, l]) => `<button class="${v === cur ? 'on' : ''}" data-a="sp" data-k="${f.name}" data-v="${v}">${esc(l)}</button>`).join('')}</div>
          ${f.help ? `<span class="rs">${esc(f.help)}</span>` : ''}</div>`;
      }).join('');
      box.innerHTML = `<div class="nav"><button class="nb" data-a="reset">Tilbakestill</button><span class="nt">Tilpass klima</span><button class="nd press" data-a="done" ${st.busy ? 'disabled' : ''}>${st.busy ? 'Lagrer …' : 'Ferdig'}</button></div>
        ${st.reset ? '<p class="note top">Tilbakestilt til standardoppsett i utkastet – trykk Ferdig for å lagre.</p>' : ''}
        <span class="cap">Visning</span>
        <div class="grp">
          ${swRow('Hero-kort', 'Ring, status og timebudsjett øverst', 'show_hero', L.show_hero !== false)}
          ${swRow('Modus-bobler', 'Borte · Alle borte · Hjemkomst · Sommer …', 'show_modes', L.show_modes !== false)}
          <div class="r col2"><span class="rl">Toppkort-stil</span>${heroGrid}</div>
        </div>
        <span class="cap">Faner</span>
        <div class="grp">
          <div class="r"><span class="rl">Fanestil</span><div class="seg" data-glass-drag="x">${[['both', 'Ikon + tekst'], ['text', 'Tekst'], ['icon', 'Ikon']].map(([v, l]) => `<button class="${v === style ? 'on' : ''}" data-a="style" data-v="${v}" aria-selected="${v === style}">${esc(l)}</button>`).join('')}</div></div>
          ${openWith}
          ${remRow}
        </div>
        <div class="grp">${tabRows}</div>
        <p class="note">Stjerne = standardfane. Minst én fane må vises. Rekkefølgen er den samme som når du drar i fane-raden.</p>
        <span class="cap">Blokker</span>
        <div class="bseg noscroll" data-glass-drag="x">${T.map((t) => `<button class="${t.id === st.btab ? 'on' : ''}" data-a="btab" data-v="${esc(t.id)}" aria-selected="${t.id === st.btab}">${esc(t.label)}</button>`).join('')}</div>
        <div class="grp">${blkRows || `<div class="r"><span class="rl rs">${M.klimaBlockList ? 'Ingen blokker i denne fanen' : 'Blokkene lastes …'}</span></div>`}</div>
        <p class="note">Faste toppblokker kan skjules, men ikke flyttes. Skjulte blokker kan vises igjen her.</p>
        <span class="cap">Mellomrom</span>
        <div class="grp">${spRows}</div>
        <p class="note">Endringene vises live bak arket. Luften i bunnen kommer i tillegg til navbaren.</p>`;
      const bs = box.querySelector('.bseg'), on = bs && bs.querySelector('.on');
      if (bs && M.glassTap) { M.glassTap(bs); M.glassTap(box.querySelector('.seg')); }
      if (on && bs && st.scrollSeg !== st.btab) { st.scrollSeg = st.btab; bs.scrollLeft = Math.max(0, on.offsetLeft - bs.clientWidth / 2 + on.offsetWidth / 2); }
      if (sh && st.keepScroll) sh.scrollTop = top;
      st.keepScroll = true;
    };

    // Ferdig: én lagring (dobbelttrykk ignoreres mens den pågår); feil → arket står med utkastet
    const done = () => ctl.done();

    ov = M.overlay({ html: '', css: SHEET_CSS, maxWidth: 520, onClose: () => { ctl.dispose(); card._sheet = null; } });
    // Arkets innhold i én fast beholder; _config = utkastet (samme config som GUI-editoren, sjekkes i test/checklist.mjs)
    const box = document.createElement('div');
    box.className = 'klima-sheet';
    Object.defineProperty(box, '_config', { get: () => st.draft });
    ov.body.appendChild(box);
    // 17.28: slider – live mens man drar (ingen ny tegning under drag), full tegning ved slipp
    const spInput = (e, end) => {
      const el = e.target;
      if (!el || !el.dataset || !el.dataset.sp) return;
      const f = SPACING_FIELDS.find((x) => x.name === el.dataset.sp), v = Number(el.value);
      if (!f || !isFinite(v)) return;
      const dr = st.draft;
      if (v === f.default) delete dr[f.name]; else dr[f.name] = v;
      const lab = box.querySelector(`[data-spv="${f.name}"]`);
      if (lab) lab.textContent = v + ' px';
      box.querySelectorAll(`[data-a="sp"][data-k="${f.name}"]`).forEach((b) => b.classList.toggle('on', Number(b.dataset.v) === v));
      preview();
      if (end) { M.haptic('selection'); draw(); }
    };
    // 19.8: «Åpne med» → layout.default_tab, bytt til fanen med én gang (stjernen i listen følger samme verdi)
    const goTab = (k) => { card._tab = k; card.setUI({ tab: k }); };
    ov.root.addEventListener('change', (e) => {
      const el = e.target;
      if (!el || !el.dataset || !el.dataset.deftab || !el.value) return;
      const k = el.value;
      upd((d) => { lay(d).default_tab = k; }, 'selection');
      goTab(k);
    });
    ov.root.addEventListener('input', (e) => spInput(e, false));
    ov.root.addEventListener('change', (e) => spInput(e, true));
    // Sliderne skal ikke dra arket (swipe-to-close) eller Bubble-popupen bak
    ['pointerdown', 'touchstart', 'touchmove'].forEach((t) => ov.root.addEventListener(t, (e) => { if (e.target && e.target.dataset && e.target.dataset.sp) e.stopPropagation(); }, { passive: true }));
    ov.root.addEventListener('click', (e) => {
      const el = e.target.closest && e.target.closest('[data-a]');
      if (!el || el.disabled) return;
      const a = el.dataset.a, k = el.dataset.k;
      const T = tabDefs(), all = T.map((t) => t.id);
      switch (a) {
        case 'done': return done();
        case 'reset': st.reset = true; return upd((d) => { delete d.layout; delete d.remember_tab; delete d.tab_order; delete d.hidden_tabs; delete d.start_tab; delete d.hero_style; delete d.gap; delete d.pad_top; delete d.pad_bottom; }, 'warning');
        case 'hero': return upd((d) => { if (el.dataset.v === 'ring') delete d.hero_style; else d.hero_style = el.dataset.v; }, 'selection');
        case 'sp': return upd((d) => { const f = SPACING_FIELDS.find((x) => x.name === k), v = Number(el.dataset.v); if (!f) return; if (v === f.default) delete d[k]; else d[k] = v; }, 'selection');
        case 'sw': return upd((d) => { const L = lay(d); if (el.dataset.v === '1') delete L[k]; else L[k] = false; }, 'selection');
        case 'style': return upd((d) => { const L = lay(d); if (el.dataset.v === 'both') delete L.tab_style; else L.tab_style = el.dataset.v; }, 'selection');
        case 'star': upd((d) => { const L = lay(d); L.default_tab = k; if (Array.isArray(L.hidden_tabs)) L.hidden_tabs = L.hidden_tabs.filter((x) => x !== k); }, 'selection'); return goTab(k);
        case 'remember': return upd((d) => { const L = lay(d); delete d.remember_tab; if (el.dataset.v === '1') L.remember_tab = true; else delete L.remember_tab; }, 'selection');
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
    .dsel{position:relative;display:inline-flex;align-items:center;gap:6px;height:36px;max-width:60%;padding:0 10px 0 12px;border-radius:18px;flex:none;margin-left:auto;background:var(--ki-sheet-seg,#282828);color:var(--gray1000,#e1e1e1);font-size:13px;font-weight:500;cursor:pointer;--mdc-icon-size:18px}
    .dsel>ha-icon:last-of-type{color:var(--gray700,#979797)}
    .dsel select{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer;font-size:16px;border:none;-webkit-appearance:none;appearance:none}
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
    .r.col2{flex-direction:column;align-items:stretch;gap:10px;padding:12px 12px 12px 16px}
    .hsg{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
    .hso{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-height:72px;border-radius:18px;background:var(--ki-sheet-seg,#282828);color:var(--ki-g-t2,var(--gray800,#afafaf));font-size:12px;font-weight:500;transition:background .2s,color .2s,transform .15s}
    .hso:active{transform:scale(.96)}
    .hso.on{background:${PINK};color:${INK}}
    .r.sp{flex-direction:column;align-items:stretch;gap:8px;padding:12px 12px 12px 16px}
    .spl{display:flex;align-items:center;gap:10px}
    .spv{flex:none;font-size:13px;font-weight:600;color:var(--white,#fafafa);font-variant-numeric:tabular-nums}
    .r.sp input[type=range]{width:100%;margin:0;accent-color:rgb(242 133 201);touch-action:pan-y;height:28px}
    .spp{display:flex;flex-wrap:wrap;gap:6px}
    .spp button{height:30px;padding:0 12px;border-radius:15px;background:var(--ki-sheet-seg,#282828);font-size:12px;font-weight:500;color:var(--ki-g-t2,var(--gray800,#afafaf))}
    .spp button.on{background:${PINK};color:${INK}}
  `;
})();
