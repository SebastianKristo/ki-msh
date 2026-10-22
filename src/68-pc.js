/* KI-MSH · PC-dashbord (msh-pc-card) – Fiks 64, prompt v8, designet: PC-dashbord.dc.html.
 * Oversikt for store skjermer: venstre helt-panel (bilde, navn, fire tall, romchips – bredde dras i høyre kant, 300–760 px,
 * dobbeltklikk = 480, localStorage 'ki-pc-bredde') og høyre del (søk, fanerad med flytende glass + hold for å flytte,
 * dato/klokke, varsler, profil, tittel + «I dag · Tilpass · Analyser», kortrutenett auto-fit minmax(240px, 1fr)).
 * Faner: Oversikt · Klima · Energi · Sikkerhet · Enheter · Rom og apper (rekkefølge: tab_order i config, speilet i
 * localStorage 'ki-pc-faner'). Data: MSH.pcData (68-pc-data.js) – samme entiteter som mobilkortene, aldri eksempeldata.
 * Popups åpnes i et sidepanel (portalt, høyre kant, bredde min(460px, 100vw − 24px)) der popupens kort tegnes innebygd
 * (attributtet embedded) – Bubble-headeren og dens lukkeknapp er ikke med, så det blir ingen dobbel X; panelet har popupens
 * bakgrunn (--ki-popup). «Åpne i egen fane» åpner den vanlige Bubble-popupen.
 * Valg av dashbord (MSH.pc): localStorage 'ki-pc-oppsett' = 'pc' | 'mobil' (per maskin). msh-hjem-card viser PC-dashbordet
 * når 'pc' og dashbordflaten er ≥ 1100 px bred (navbaren skjules da); smalere = alltid mobilvisningen.
 */
(function () {
  const M = window.MSH;
  if (!M) return;
  const esc = M.esc, C = M.C;
  const kiT = (no, en) => (window.kiT ? window.kiT(no, en) : no);
  const PK = C.pink, BL = C.blue, GR = C.green, OR = C.orange, RD = C.red;
  const GRAD = C.accent;
  const LS = { mode: 'ki-pc-oppsett', w: 'ki-pc-bredde', tabs: 'ki-pc-faner', cards: 'ki-pc-kort' };
  const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* */ } };
  const MIN_W = 1100;

  /* ------------------------------------------------------------ valg av dashbord */
  M.pc = {
    mode: () => (lsGet(LS.mode) === 'pc' ? 'pc' : 'mobil'),
    set(m) { lsSet(LS.mode, m === 'pc' ? 'pc' : 'mobil'); window.dispatchEvent(new CustomEvent('ki-pc-change', { detail: { mode: M.pc.mode() } })); },
    // Adaptiv layout måler dashbordflaten (ikke vinduet)
    wide: () => { const R = M.dashRect ? M.dashRect() : { width: window.innerWidth }; return (R.width || window.innerWidth) >= MIN_W; },
    active: () => M.pc.mode() === 'pc' && M.pc.wide(),
    MIN_W,
  };
  window.addEventListener('storage', (e) => { if (e.key === LS.mode) window.dispatchEvent(new CustomEvent('ki-pc-change', { detail: { mode: M.pc.mode() } })); });

  /* ------------------------------------------------------------ faner, kort og apper */
  const TABS = [['oversikt', 'Oversikt', 'mdi:view-grid-outline'], ['klima', 'Klima', 'mdi:thermostat'], ['energi', 'Energi', 'mdi:lightning-bolt'], ['sikkerhet', 'Sikkerhet', 'mdi:shield-outline'], ['enheter', 'Enheter', 'mdi:devices'], ['apper', 'Rom og apper', 'mdi:apps']];
  const TABL = Object.fromEntries(TABS.map((t) => [t[0], t]));
  const KEYS = TABS.map((t) => t[0]);
  const KORT = [['temp', 'Temperatur i huset'], ['fukt', 'Luftfuktighet'], ['score', 'Hjemmescore'], ['sikk', 'Sikkerhet'], ['stromk', 'Strøm i dag'], ['luftk', 'Luftkvalitet'], ['pers', 'Hvem er hjemme']];
  // «Rom og apper»: [gruppe, ikon, farge, [[navn, ikon, mål]]] – mål: '#hash' (vises bare når popupen finnes) eller handling
  const GRUPPER = [
    ['Rom', 'mdi:door-open', PK, [['Stue', 'mdi:sofa-outline', 'room:stue'], ['Rom', 'mdi:view-grid-outline', 'room:'], ['Romkort', 'mdi:view-dashboard-outline', 'mobil'], ['Etasjer', 'mdi:stairs', 'mobil'], ['Hjem (mobil)', 'mdi:home-outline', 'mobil'], ['Hurtigpanel', 'mdi:lightning-bolt', 'hurtig']]],
    ['Klima og vær', 'mdi:thermostat', BL, [['Klima', 'mdi:thermostat', '#klima'], ['Varmepumpe', 'mdi:heat-pump-outline', '#varmepumpe'], ['Vær', 'mdi:weather-partly-cloudy', '#vaer'], ['Søvn', 'mdi:bed-outline', '#sovn'], ['Planter', 'mdi:flower-outline', '#planter']]],
    ['Energi', 'mdi:lightning-bolt', OR, [['Strøm', 'mdi:lightning-bolt', '#strom'], ['Strømpriser', 'mdi:chart-line', '#strom'], ['Strømregning', 'mdi:receipt-text-outline', '#stromregning'], ['Nettverk', 'mdi:router-network', '#server'], ['Server', 'mdi:dns', '#server']]],
    ['Sikkerhet', 'mdi:shield-outline', GR, [['Sikkerhet', 'mdi:shield-outline', '#sikkerhet'], ['Dørlås', 'mdi:lock-outline', '#dorlas'], ['Kamera', 'mdi:video-outline', '#kamera'], ['Ringeklokke', 'mdi:doorbell-video', '#ringeklokke'], ['Ringeopptak', 'mdi:filmstrip-box-multiple', 'ringrec'], ['Garasjeport', 'mdi:garage', '#garasje'], ['Personer', 'mdi:account-outline', 'person']]],
    ['Bil og hage', 'mdi:car-outline', PK, [['Tesla', 'mdi:car-electric-outline', '#tesla'], ['Gressklipper', 'mdi:robot-mower-outline', '#gressklipper'], ['Vanning', 'mdi:water-outline', '#vanning'], ['Basseng', 'mdi:pool', '#basseng'], ['Sir Sweeps', 'mdi:robot-vacuum', '#rolf'], ['3D-printer', 'mdi:printer-3d', '#3d-printer']]],
    ['Hverdag', 'mdi:calendar-today', BL, [['Lys', 'mdi:lightbulb-outline', '#lys'], ['Media', 'mdi:play-circle-outline', '#media'], ['Kalender', 'mdi:calendar-today', '#kalender'], ['Gjøremål', 'mdi:format-list-checks', '#gjoremal'], ['Søppel', 'mdi:trash-can-outline', '#soppel'], ['Innstillinger', 'mdi:cog-outline', '#settings']]],
  ];
  const WX = { sunny: 'mdi:weather-sunny', 'clear-night': 'mdi:weather-night', partlycloudy: 'mdi:weather-partly-cloudy', cloudy: 'mdi:weather-cloudy', rainy: 'mdi:weather-rainy', pouring: 'mdi:weather-pouring', snowy: 'mdi:weather-snowy', 'snowy-rainy': 'mdi:weather-snowy-rainy', fog: 'mdi:weather-fog', hail: 'mdi:weather-hail', windy: 'mdi:weather-windy', 'windy-variant': 'mdi:weather-windy-variant', lightning: 'mdi:weather-lightning', 'lightning-rainy': 'mdi:weather-lightning-rainy', exceptional: 'mdi:alert-circle-outline' };
  const WXN = { sunny: 'Sol', 'clear-night': 'Klart', partlycloudy: 'Lettskyet', cloudy: 'Skyet', rainy: 'Regn', pouring: 'Kraftig regn', snowy: 'Snø', 'snowy-rainy': 'Sludd', fog: 'Tåke', hail: 'Hagl', windy: 'Vind', 'windy-variant': 'Vind', lightning: 'Torden', 'lightning-rainy': 'Torden og regn', exceptional: 'Ekstremvær' };
  const MND = ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember'];
  const MND_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const p2 = (n) => String(n).padStart(2, '0');
  const hm = (t) => { const d = new Date(t); return isNaN(d) ? '–' : `${p2(d.getHours())}:${p2(d.getMinutes())}`; };
  const nf = (v, d) => (v == null || isNaN(v) ? '–' : M.nf(v, d != null ? d : 0));
  const nf1 = (v) => (v == null || isNaN(v) ? '–' : M.nf(v, Math.abs(v) < 100 && v % 1 ? 1 : 0));

  /* ------------------------------------------------------------ små tegnehjelpere (designet: bars / spark / rows / pill) */
  const bars = (vals, color, r) => {
    const v = (vals || []).map((x) => (x == null || isNaN(x) ? null : Number(x)));
    const have = v.filter((x) => x != null);
    if (!have.length) return `<div class="bars nil" aria-hidden="true"></div>`;
    const mx = Math.max(...have), mn = Math.min(...have), sp = mx - mn || 1;
    return `<div class="bars">${v.map((x, i) => `<span style="height:${x == null ? 6 : (14 + ((x - mn) / sp) * 86).toFixed(1)}%;border-radius:${r || 2}px;background:${x == null ? 'var(--ki-surface-3, #2f2f2f)' : i === v.length - 1 ? color : `color-mix(in srgb, ${color} 42%, transparent)`}"></span>`).join('')}</div>`;
  };
  const spark = (vals, w, h) => {
    const v = (vals || []).filter((x) => x != null && !isNaN(x));
    if (v.length < 2) return { d: `M0 ${h / 2} L${w} ${h / 2}`, fill: '' };
    const mx = Math.max(...v), mn = Math.min(...v), sp = mx - mn || 1;
    const pts = v.map((x, i) => [(i / (v.length - 1)) * w, h - 6 - ((x - mn) / sp) * (h - 14)]);
    let d = 'M' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
    for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], cx = (x0 + x1) / 2; d += ` C${cx.toFixed(1)} ${y0.toFixed(1)} ${cx.toFixed(1)} ${y1.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`; }
    return { d, fill: `${d} L${w} ${h} L0 ${h} Z` };
  };
  const pill = (txt, color, key) => `<span class="pill" style="background:color-mix(in srgb, ${color} 20%, transparent);color:${color}"${key ? ` data-key="${key}"` : ''}>${esc(txt)}</span>`;
  const btn = (act, v, icon, title, big) => `<button class="hb${big ? ' big' : ''}" data-act="${act}"${v != null ? ` data-v="${esc(v)}"` : ''} title="${esc(title || '')}" aria-label="${esc(title || '')}">${M.icon(icon, big ? 18 : 16)}</button>`;
  const head = (title, sub, extra, big) => `<div class="ah"><span class="at"><b class="${big ? 'big' : ''}">${esc(title)}</b><i>${sub}</i></span>${extra || ''}</div>`;
  const art = (key, body, big, delay) => `<article class="card${big ? ' span2' : ''}" data-key="pc-${key}" style="animation-delay:${(delay || 0) * 0.04}s">${body}</article>`;
  const kv = (icon, color, v, u) => `<span class="kv">${M.icon(icon, 20, `color:${color}`)}<span class="num kvv" data-noi18n>${esc(v)}</span><span class="kvu" data-noi18n>${esc(u || '')}</span></span>`;
  const rowsBar = (list, color, unit) => { const mx = Math.max(1e-9, ...list.map((r) => r[1] || 0)); return list.map(([n, v], i) => `<span class="rb" data-key="rb-${i}"><span class="ell" data-noi18n>${esc(n)}</span><span class="tr"><span style="width:${((v || 0) / mx) * 100}%;background:${color}"></span></span><span class="num rv" data-noi18n>${esc(nf1(v) + (unit || ''))}</span></span>`).join(''); };

  /* ============================================================ kortet */
  class PC extends M.Card {
    static get cardName() { return 'PC-dashbord'; }
    static getStubConfig() { return { card_id: 'ki-pc' }; }
    static get uiPersist() { return ['tab', 'room']; }
    static get schema() {
      return [
        { type: 'section', id: 'pc', label: 'PC-dashbord', icon: 'mdi:monitor-dashboard', fields: [
          { type: 'info', label: 'PC-dashbordet vises i Hjem når «Dashbord på PC» er valgt i Tilpass og skjermen er minst 1100 px bred.' },
          { type: 'text', name: 'photo', label: 'Bilde i helt-panelet (URL)', placeholder: '/local/hus.jpg' },
          { type: 'number', name: 'budget', label: 'Strømbudsjett per måned (kr)', min: 0, step: 50 },
          { type: 'entity', name: 'power', label: 'Effekt nå (hele huset)', domains: ['sensor'], none_label: 'Automatisk' },
          { type: 'entity', name: 'outdoor_temp', label: 'Utetemperatur', domains: ['sensor'], none_label: 'Automatisk (vær)' },
          { type: 'entity', name: 'co2', label: 'Luftkvalitet (CO₂)', domains: ['sensor'], none_label: 'Automatisk' },
          { type: 'entity', name: 'heat_pump', label: 'Varmepumpe', domains: ['climate'], none_label: 'Automatisk' },
          { type: 'entity', name: 'ventilation', label: 'Ventilasjon', domains: ['fan'], none_label: 'Automatisk' },
          { type: 'entities', name: 'exclude', label: 'Skjul entiteter' },
        ] },
      ];
    }
    get cardSize() { return 12; }
    constructor() {
      super();
      this._onClock = () => { if (this.isConnected) this._clock(); };
      this._onEP = () => { if (this.isConnected) this.update(); };
      this._fc = null; this._fcUnsub = null; this._arm = null;
    }
    connectedCallback() {
      super.connectedCallback();
      this._tick = setInterval(this._onClock, 20000);
      window.addEventListener('msh-energi-prefs', this._onEP);
    }
    disconnectedCallback() {
      super.disconnectedCallback();
      clearInterval(this._tick);
      window.removeEventListener('msh-energi-prefs', this._onEP);
      if (this._fcUnsub) { try { this._fcUnsub(); } catch (e) { /* */ } this._fcUnsub = null; }
      ['_panel', '_sheet'].forEach((k) => { if (this[k]) { this[k].close(); this[k] = null; } });
    }
    get tab() { const t = this.ui.tab; return KEYS.includes(t) ? t : 'oversikt'; }
    _order() {
      const c = this.config, src = Array.isArray(c.tab_order) ? c.tab_order : (() => { try { const o = JSON.parse(lsGet(LS.tabs) || 'null'); return Array.isArray(o) ? o.map((x) => (typeof x === 'number' ? KEYS[x] : x)) : []; } catch (e) { return []; } })();
      const o = src.filter((k, i, a) => KEYS.includes(k) && a.indexOf(k) === i); KEYS.forEach((k) => { if (!o.includes(k)) o.push(k); });
      return o;
    }
    _hidden() { try { return JSON.parse(lsGet(LS.cards) || '{}') || {}; } catch (e) { return {}; } }
    _width() { const b = +lsGet(LS.w); return b >= 300 && b <= 760 ? b : 480; }
    _clock() { const el = this.shadowRoot && this.shadowRoot.querySelector('.clk'); if (el) el.textContent = this._now(); }
    _now() {
      const d = new Date(), en = (window.kiLang ? window.kiLang() : 'no') === 'en';
      return en ? `${d.getDate()} ${MND_EN[d.getMonth()]} · ${p2(d.getHours())}:${p2(d.getMinutes())}` : `${d.getDate()}. ${MND[d.getMonth()]} · ${p2(d.getHours())}:${p2(d.getMinutes())}`;
    }

    /* ---------------------------------------------------------- tegning */
    render() {
      const h = this.hass, D = M.pcData.collect(h, this);
      if (!D) return '<div class="wrap"></div>';
      // registrer avhengigheter (oppdatering ved endring)
      [D.mainPow, D.outId, D.co2Id, D.pumpId, D.fanId, D.A && D.A.entity, D.weather, ...D.tempIds, ...D.humIds, ...D.persons.map((p) => p.id)].forEach((id) => id && this.s(id));
      const t = this.tab;
      if (this.isConnected) M.pcData.load(h, this, t);
      const S = M.pcData.series(h, this);
      this._D = D; this._S = S;
      return `<div class="wrap">${this._hero(D)}<section class="main">${this._top()}${this._title(t)}${this._body(t, D, S)}</section></div>`;
    }
    _hero(D) {
      const room = this.ui.room && D.rooms.find((r) => r.id === this.ui.room) || null;
      const w = this._width(), c = this.config;
      const img = room && room.picture ? room.picture : c.photo || '';
      const url = img && this.hass && this.hass.hassUrl && img[0] === '/' && img[1] !== '/' ? this.hass.hassUrl(img) : img;
      const A = D.A || {};
      const inne = room ? room.temp : D.inside;
      const stat = [['Inne', inne == null ? '–' : `${nf1(inne)} °C`, 'mdi:thermometer', PK], ['Ute', D.outside == null ? '–' : `${nf1(D.outside)} °C`, 'mdi:weather-partly-cloudy', BL],
        ['Strøm', D.powKw == null ? '–' : `${M.nf(D.powKw, 1)} kW`, 'mdi:lightning-bolt', OR], ['Alarm', A.mode ? A.text : '–', 'mdi:shield-check-outline', A.armed ? OR : GR]];
      const chips = [`<button class="rc${!room ? ' on' : ''}" data-act="room" data-v="" data-haptic="selection">Hele huset</button>`,
        ...D.rooms.map((r) => `<button class="rc${room && room.id === r.id ? ' on' : ''}" data-act="room" data-v="${esc(r.id)}" data-haptic="selection" data-noi18n>${esc(r.name)}</button>`)].join('');
      const sub = room ? `<span>${M.icon('mdi:door-open', 16)}${esc(room.ents.length + ' ' + kiT('enheter', 'devices') + ' · ' + room.on + ' ' + kiT('på', 'on'))}</span>` : `<span>${M.icon('mdi:home-outline', 16)}${esc(`${D.rooms.length} ${kiT('rom', 'rooms')} · ${D.ctrlAll} ${kiT('enheter', 'devices')}`)}</span>`;
      return `<section class="hero" data-key="hero" style="flex:1 1 ${w}px;width:${w}px">
        <div class="hw" data-drag="w" title="Dra for å endre bredden"></div>
        ${url ? `<img class="hi" src="${esc(url)}" alt="" loading="lazy">` : '<div class="hi ph" data-ki-island></div>'}
        <div class="hg" aria-hidden="true"></div>
        <div class="hrow"><span class="logo">${M.icon('mdi:hub', 22, `color:${PK}`)}<span data-noi18n>KI Hjem</span></span><button class="hmb" data-act="pop" data-v="#settings" title="Meny" aria-label="Meny">${M.icon('mdi:menu', 22)}</button></div>
        <div class="hcol"><div class="hname"><span class="big"${room ? ' data-noi18n' : ''}>${esc(room ? room.name : kiT('Hjem', 'Home'))}</span><span class="hsub">${sub}</span></div>
          <div class="hstat">${stat.map(([l, v, ic, col]) => `<span class="hs"><span class="hl">${M.icon(ic, 14, `color:${col}`)}${esc(l)}</span><span class="num hv">${esc(v)}</span></span>`).join('')}</div>
          <div class="chips">${chips}<button class="rc add" data-act="pop" data-v="#settings" title="Legg til rom" aria-label="Legg til rom">${M.icon('mdi:plus', 20)}</button></div></div>
      </section>`;
    }
    _top() {
      const u = (this.hass && this.hass.user) || {}, ini = String(u.name || '?').trim().charAt(0).toUpperCase();
      const t = this.tab, O = this._order();
      return `<div class="top">
        <button class="ib" data-act="search" title="Søk" aria-label="Søk">${M.icon('mdi:magnify', 20)}</button>
        <nav class="tabs" role="tablist" data-key="tabs">${O.map((k) => `<button class="tb${k === t ? ' on' : ''}" role="tab" aria-selected="${k === t}" data-act="tab" data-v="${k}" data-haptic="selection" title="${esc(TABL[k][1])}">${M.icon(TABL[k][2], 18)}<span>${esc(TABL[k][1])}</span></button>`).join('')}</nav>
        <span class="sp"></span><span class="clk">${esc(this._now())}</span>
        <button class="ib" data-act="notif" title="Varsler" aria-label="Varsler">${M.icon('mdi:bell-outline', 20)}${this._notifN() ? '<span class="dot"></span>' : ''}</button>
        <button class="ib me" data-act="me" title="${esc(u.name || '')}" data-noi18n>${esc(ini)}</button></div>`;
    }
    _notifN() { const h = this.hass; return Object.keys(h.states).filter((id) => id.startsWith('persistent_notification.')).length + (this._D ? this._D.upd.length : 0); }
    _title(t) {
      return `<div class="ttl"><h1>${esc(TABL[t][1])}</h1><div class="tbtns">
        <button class="pb" data-act="ana">${M.icon('mdi:calendar-today', 18)}<span>I dag</span></button>
        <button class="pb" data-act="tilpass">${M.icon('mdi:pencil-outline', 18)}<span>Tilpass</span></button>
        <button class="pb" data-act="ana">${M.icon('mdi:chart-timeline-variant', 18)}<span>Analyser</span></button></div></div>`;
    }
    _body(t, D, S) {
      try {
        if (t === 'klima') return `<div class="grid" data-key="g-klima">${this._klima(D, S)}</div>`;
        if (t === 'energi') return `<div class="grid" data-key="g-energi">${this._energi(D, S)}</div>`;
        if (t === 'sikkerhet') return `<div class="grid" data-key="g-sik">${this._sik(D, S)}</div>`;
        if (t === 'enheter') return `<div class="grid" data-key="g-enh">${this._enheter(D, S)}</div>`;
        if (t === 'apper') return `<div class="apps" data-key="g-apper">${this._apper()}</div>`;
        return `<div class="grid" data-key="g-oversikt">${this._oversikt(D, S)}</div>`;
      } catch (e) { console.error('[ki-msh] msh-pc-card', e); return `<div class="grid">${art('err', head('Kunne ikke tegne fanen', esc(String(e && e.message || e))))}</div>`; }
    }

    /* ---------------------------------------------------------- Oversikt */
    _oversikt(D, S) {
      const hid = this._hidden(), out = [];
      const cold = D.rooms.filter((r) => r.temp != null && r.target != null && r.temp < r.target - 1).sort((a, b) => (a.temp - a.target) - (b.temp - b.target))[0];
      const ki = this._kiOpt();
      if (!hid.temp) {
        const sp = spark(S.temp24, 320, 90), n = D.rooms.filter((r) => r.temp != null).length;
        const ticks = [24, 18, 12, 6, 0].map((x) => { const d = new Date(Date.now() - x * 3600000); return `${p2(d.getHours())}:00`; });
        out.push(art('temp', `${head('Temperatur i huset', esc(cold ? kiT('Litt kjølig i §', 'A bit cool in §').replace('§', cold.name) : D.inside == null ? '–' : kiT('Jevn temperatur', 'Even temperature')), btn('refresh', null, 'mdi:refresh', 'Oppdater', true) + btn('pop', '#klima', 'mdi:chevron-right', 'Åpne klima', true), true)}
          <div class="bigrow"><span class="bigv"><span class="num" data-noi18n>${esc(nf1(D.inside))}</span><span class="bu" data-noi18n>°C</span></span><span class="sp"></span><span class="ic40" style="color:${PK}">${M.icon('mdi:thermometer', 20)}</span></div>
          <span class="mut">${esc(n ? kiT('Snitt av § rom', 'Average of § rooms').replace('§', n) : '–')}${D.outside != null ? esc(' · ' + kiT('ute', 'outside') + ' ' + nf1(D.outside) + ' °C') : ''}</span>
          <svg class="spk" viewBox="0 0 320 90" preserveAspectRatio="none" aria-hidden="true"><path d="${sp.fill}" style="fill:color-mix(in srgb, ${PK} 16%, transparent)"></path><path d="${sp.d}" fill="none" style="stroke:${PK}" stroke-width="2" stroke-linecap="round" vector-effect="non-scaling-stroke"></path></svg>
          <div class="ticks">${ticks.map((x) => `<span data-noi18n>${x}</span>`).join('')}</div><span class="grow"></span>
          <div class="brow"><button class="cta" data-act="pop" data-v="#klima">Endre</button><button class="sec" data-act="pop" data-v="#klima">Klimaoversikt</button></div>
          <div class="kio"><span class="at"><b class="sm">KI-optimalisering</b><i>${esc(ki.txt)}</i></span><button class="hb big" data-act="kiopt" style="color:${PK}" title="Kjør igjen" aria-label="Kjør igjen">${M.icon('mdi:auto-fix', 18)}</button></div>`, true, 0));
      }
      if (!hid.fukt) {
        const sub = D.hum == null ? '–' : D.hum < 30 ? kiT('Tørt', 'Dry') : D.hum > 60 ? kiT('Fuktig', 'Humid') : kiT('Normal', 'Normal');
        out.push(art('fukt', `${head('Luftfuktighet', esc(sub), btn('pop', '#klima', 'mdi:chevron-right', 'Åpne'))}${kv('mdi:water-percent', BL, nf(D.hum), '%')}<span class="grow"></span>${bars(S.hum28, BL)}`, false, 1));
      }
      if (!hid.score) out.push(art('score', `${head('Hjemmescore', esc(D.score >= 85 ? kiT('Alt i orden', 'All good') : D.score >= 60 ? kiT('Noen ting å se på', 'A few things to check') : kiT('Trenger oppmerksomhet', 'Needs attention')), btn('mobil', null, 'mdi:chevron-right', 'Åpne'))}${kv('mdi:heart-outline', GR, String(D.score), '/100')}<span class="grow"></span>${bars(S.score, GR, 3)}`, false, 2));
      if (!hid.sikk) {
        const A = D.A || {};
        const sub = `${A.mode ? A.text : '–'} · ${D.unlocked.length ? kiT('§ ulåst', '§ unlocked').replace('§', D.unlocked.length) : D.locks.length ? kiT('alt låst', 'all locked') : kiT('ingen låser', 'no locks')}`;
        const tiles = [['Dører', D.locks.length ? (D.unlocked.length ? kiT('§ ulåst', '§ unlocked').replace('§', D.unlocked.length) : kiT('Låst', 'Locked')) : D.openDoors.length ? kiT('§ åpen', '§ open').replace('§', D.openDoors.length) : D.doors.length ? kiT('Lukket', 'Closed') : '–', 'mdi:lock-outline', D.unlocked.length || D.openDoors.length ? OR : GR],
          ['Vinduer', D.wins.length ? (D.openWins.length ? kiT('§ åpent', '§ open').replace('§', D.openWins.length) : kiT('Lukket', 'Closed')) : '–', 'mdi:window-closed-variant', D.openWins.length ? OR : GR],
          ['Kamera', D.cams.length ? kiT('§ på', '§ on').replace('§', D.cams.length) : '–', 'mdi:video-outline', BL]];
        out.push(art('sikk', `${head('Sikkerhet', esc(sub), btn('pop', '#sikkerhet', 'mdi:chevron-right', 'Åpne'))}<span class="grow"></span><div class="t3">${tiles.map(([l, v, ic, col]) => `<span class="tile">${M.icon(ic, 18, `color:${col}`)}<span class="tl">${esc(l)}</span><span class="tv">${esc(v)}</span></span>`).join('')}</div>`, false, 3));
      }
      if (!hid.stromk) {
        const cur = (D.P && D.P.cur) || 'kr';
        out.push(art('stromk', `${head('Strøm i dag', esc(S.cost == null ? '–' : kiT('§ så langt', '§ so far').replace('§', `${M.nf(S.cost, 2)} ${cur}`)), btn('pop', '#strom', 'mdi:chevron-right', 'Åpne'))}${kv('mdi:lightning-bolt', PK, nf1(S.today), 'kWh')}<span class="grow"></span>${bars(S.kwhH, PK, 3)}`, false, 4));
      }
      if (!hid.luftk) {
        const q = D.co2 == null ? null : D.co2 < 1000 ? ['God', GR] : D.co2 < 1400 ? ['Ok', OR] : ['Dårlig', RD];
        const sp = spark(S.co2, 220, 60);
        out.push(art('luftk', `${head('Luftkvalitet', esc(D.co2 == null ? '–' : `CO₂ ${M.nf(D.co2)} ppm`), btn('pop', '#varmepumpe', 'mdi:fan', 'Luft ut'))}
          <span class="kv2"><span class="ic28" style="background:color-mix(in srgb, ${q ? q[1] : 'var(--ki-ctrl, #545454)'} 18%, transparent);color:${q ? q[1] : 'var(--ki-text-mid, #979797)'}">${M.icon('mdi:weather-windy', 17)}</span><span class="kv2t">${esc(q ? q[0] : '–')}</span></span>
          <span class="grow"></span><svg class="spk sm" viewBox="0 0 220 60" preserveAspectRatio="none" aria-hidden="true"><path d="${sp.d}" fill="none" style="stroke:${BL}" stroke-width="2" stroke-linecap="round" vector-effect="non-scaling-stroke"></path></svg>`, false, 5));
      }
      if (!hid.pers) out.push(art('pers', this._persons(D), false, 6));
      return out.join('') || `<div class="none">${esc(kiT('Alle kortene er skjult. Slå dem på i Tilpass.', 'All cards are hidden. Turn them on in Customize.'))}</div>`;
    }
    _persons(D) {
      const home = D.persons.filter((p) => p.home).length;
      return `${head('Hvem er hjemme', esc(D.persons.length ? kiT('§ av §', '§ of §').replace('§', home).replace('§', D.persons.length) : '–'), btn('person', null, 'mdi:chevron-right', 'Åpne'))}<span class="grow"></span>
        <div class="plist">${D.persons.map((p) => `<span class="prow" data-key="p-${esc(p.id)}"><span class="av${p.home ? ' on' : ''}" data-noi18n>${esc(p.name.charAt(0).toUpperCase())}</span><span class="ell pn" data-noi18n>${esc(p.name)}</span><span class="mut">${esc(p.label)}</span></span>`).join('') || '<span class="mut">–</span>'}</div>`;
    }
    _kiOpt() {
      const h = this.hass, id = Object.keys(h.states).find((x) => /^(script|automation)\./.test(x) && /optimal|ki_klima|ki_energi_opt/.test(x));
      if (!id) return { id: null, txt: '–' };
      const lt = h.states[id].attributes.last_triggered;
      if (!lt) return { id, txt: kiT('Ikke kjørt ennå', 'Not run yet') };
      const days = Math.floor((Date.now() - new Date(lt)) / 86400000);
      return { id, txt: days <= 0 ? kiT('Kjørt i dag', 'Ran today') : days === 1 ? kiT('Kjørt i går', 'Ran yesterday') : kiT('Kjørt for § dager siden', 'Ran § days ago').replace('§', days) };
    }

    /* ---------------------------------------------------------- Klima */
    _klima(D, S) {
      const h = this.hass, out = [];
      const R = D.rooms.filter((r) => r.temp != null);
      out.push(art('romklima', `${head('Rom for rom', 'Nå og måltemperatur', btn('pop', '#klima', 'mdi:tune-variant', 'Åpne', true), true)}
        <div class="rlist">${R.map((r) => `<button class="rk" data-act="pop" data-v="#${esc(r.id)}" data-key="rk-${esc(r.id)}"><span class="rkh"><span class="ell rkn" data-noi18n>${esc(r.name)}</span><span class="num rkt" data-noi18n>${esc(nf1(r.temp))}</span><span class="mut sm">${esc(r.target != null ? kiT('mål §', 'target §').replace('§', nf1(r.target)) : '')}</span></span><span class="tr"><span style="width:${M.clamp(((r.temp - 15) / 12) * 100, 3, 100)}%;background:${GRAD}"></span></span></button>`).join('') || '<span class="mut">–</span>'}</div>
        <span class="grow"></span><button class="cta self" data-act="pop" data-v="#klima">Still inn alle</button>`, true, 0));
      // Varmepumpe
      const P = D.pump, pa = P ? P.attributes : {};
      const set = P && M.isNum(pa.temperature) ? Number(pa.temperature) : null;
      const pw = D.pumpPow ? M.pcData.num(h, D.pumpPow) : null;
      const pu = D.pumpPow && h.states[D.pumpPow] ? String(h.states[D.pumpPow].attributes.unit_of_measurement || 'W') : 'W';
      const modes = pa.hvac_modes || [], autoM = modes.includes('auto') ? 'auto' : modes.includes('heat_cool') ? 'heat_cool' : null;
      const md = [['Auto', autoM], ['Varme', modes.includes('heat') ? 'heat' : null], ['Av', 'off']].filter((x) => x[1]);
      const sub = P ? [WXN_HVAC(P.state), pa.fan_mode ? kiT('vifte §', 'fan §').replace('§', String(pa.fan_mode).toLowerCase()) : ''].filter(Boolean).join(' · ') : kiT('Fant ingen varmepumpe', 'No heat pump found');
      out.push(art('pumpe', `${head('Varmepumpe', esc(sub), btn('pop', '#varmepumpe', 'mdi:chevron-right', 'Åpne'))}
        <div class="prow2">${M.icon('mdi:heat-pump-outline', 20, `color:${OR}`)}<span class="bigv md"><span class="num" data-noi18n>${esc(set == null ? '–' : M.nf(set, 1))}</span><span class="bu sm" data-noi18n>°C</span></span>
          <button class="rb40" data-act="pset" data-v="-0.5" title="Ned" aria-label="Ned" ${P ? '' : 'disabled'}>${M.icon('mdi:minus', 20)}</button><button class="rb40" data-act="pset" data-v="0.5" title="Opp" aria-label="Opp" ${P ? '' : 'disabled'}>${M.icon('mdi:plus', 20)}</button></div>
        <div class="t3">${[['Rom nå', M.isNum(pa.current_temperature) ? `${nf1(Number(pa.current_temperature))} °C` : '–'], ['Effekt', pw == null ? '–' : /kw/i.test(pu) ? `${M.nf(pw, 1)} kW` : pw >= 1000 ? `${M.nf(pw / 1000, 1)} kW` : `${M.nf(pw)} W`], ['I dag', this._pumpToday()]].map(([l, v]) => `<span class="tile"><span class="tl ell">${esc(l)}</span><span class="tv num" data-noi18n>${esc(v)}</span></span>`).join('')}</div>
        <span class="grow"></span><div class="seg">${md.map(([l, m]) => `<button class="sg${P && P.state === m ? ' on' : ''}" data-act="pmode" data-v="${m}" ${P ? '' : 'disabled'}>${esc(l)}</button>`).join('')}</div>`, false, 1));
      // Været ute
      const ws = D.ws, wa = ws ? ws.attributes : {};
      const fc = (this._fc || []).slice(0, 12).filter((_, i) => i % 2 === 0).slice(0, 6);
      const wt = M.isNum(wa.temperature) ? Number(wa.temperature) : D.outside;
      const today = (this._fcDay || [])[0];
      const det = [['Nedbør', fc.length ? `${M.nf(fc.reduce((t, x) => t + (Number(x.precipitation) || 0), 0), 1)} mm` : '–', 'mdi:weather-rainy', BL], ['Fuktighet', M.isNum(wa.humidity) ? `${M.nf(Number(wa.humidity))} %` : '–', 'mdi:water-percent', BL], ['Vind', M.isNum(wa.wind_speed) ? `${M.nf(this._ms(wa.wind_speed, wa.wind_speed_unit), 0)} m/s` : '–', 'mdi:weather-windy', GR]];
      const mmx = Math.max(1, ...fc.map((x) => Number(x.precipitation) || 0));
      out.push(art('vaer', `${head('Været ute', esc(ws ? `${(WXN[ws.state] || ws.state)}${M.vaerFeels ? (() => { try { const f = M.vaerFeels(this.hass, {}); return f != null ? ' · ' + kiT('føles som § °C', 'feels like § °C').replace('§', nf1(f)) : ''; } catch (e) { return ''; } })() : ''}` : '–'), btn('pop', '#vaer', 'mdi:chevron-right', 'Åpne'))}
        <div class="prow2">${M.icon(WX[ws && ws.state] || 'mdi:weather-partly-cloudy', 32, `color:${BL}`)}<span class="bigv md"><span class="num" data-noi18n>${esc(nf1(wt))}</span><span class="bu sm" data-noi18n>°C</span></span><span class="sp"></span>
          <span class="hilo"><span class="mut sm">Høyest / lavest</span><span class="num" data-noi18n>${esc(today ? `${nf1(today.temperature)}° / ${nf1(today.templow)}°` : '–')}</span></span></div>
        <div class="chiprow">${det.map(([l, v, ic, col]) => `<span class="dchip" title="${esc(l)}">${M.icon(ic, 13, `color:${col}`)}<span class="num" data-noi18n>${esc(v)}</span></span>`).join('')}</div>
        <span class="grow"></span><div class="fc">${fc.length ? fc.map((x) => { const r = Number(x.precipitation) || 0; return `<span class="fch" title="${esc(r ? M.nf(r, 1) + ' mm' : '')}"><span class="mut xs" data-noi18n>${esc(p2(new Date(x.datetime).getHours()))}</span>${M.icon(WX[x.condition] || 'mdi:weather-cloudy', 18, `color:${r > 0.3 ? BL : 'var(--ki-text-1, #c7c7c7)'}`)}<span class="num xs b" data-noi18n>${esc(nf(x.temperature))}°</span><span class="rbar"><span style="height:${r ? Math.max(8, (r / mmx) * 100) : 0}%"></span></span></span>`; }).join('') : '<span class="mut">–</span>'}</div>`, false, 2));
      // Gulvvarme
      const F = D.floor.map((id) => { const s = h.states[id], a = s.attributes, on = s.state !== 'off' && s.state !== 'unavailable'; return { id, n: M.name(h, id).replace(/\s*(gulvvarme|gulv|floor heating)\s*/i, ' ').trim() || M.name(h, id), on, t: M.isNum(a.current_temperature) ? Number(a.current_temperature) : M.isNum(a.temperature) ? Number(a.temperature) : null, pw: M.powerOf ? M.powerOf(h, id) : null }; });
      const fOn = F.filter((x) => x.on).length, fPow = F.map((x) => (x.pw ? M.pcData.num(h, x.pw) : null)).filter((x) => x != null), fAvg = F.map((x) => x.t).filter((x) => x != null);
      out.push(art('gulv', `${head('Gulvvarme', esc(F.length ? kiT('§ av § soner på', '§ of § zones on').replace('§', fOn).replace('§', F.length) : kiT('Fant ingen gulvvarme', 'No floor heating found')), btn('pop', '#klima', 'mdi:chevron-right', 'Åpne'))}
        <div class="zl">${F.slice(0, 5).map((z) => `<button class="zone" data-act="more" data-id="${esc(z.id)}" data-key="z-${esc(z.id)}">${M.icon(z.on ? 'mdi:check-circle' : 'mdi:radiobox-blank', 18, `color:${z.on ? GR : 'var(--ki-text-mid, #979797)'}`)}<span class="ell zn" data-noi18n>${esc(z.n)}</span><span class="mut sm">${esc(z.on ? `${kiT('På', 'On')}${z.t != null ? ` · ${nf1(z.t)} °C` : ''}` : kiT('Av', 'Off'))}</span></button>`).join('')}</div>
        <span class="grow"></span><span class="foot">${M.icon('mdi:lightning-bolt', 15, `color:${OR}`)}${esc(`${fPow.length ? M.nf(fPow.reduce((a, b) => a + b, 0) / 1000, 1) + ' kW ' + kiT('nå', 'now') : '–'} · ${kiT('snitt gulv', 'avg floor')} ${fAvg.length ? nf1(fAvg.reduce((a, b) => a + b, 0) / fAvg.length) + ' °C' : '–'}`)}</span>`, false, 3));
      // Inne mot ute
      const si = spark(S.inne24, 320, 70), su = spark(S.ute24, 320, 70);
      out.push(art('inneute', `${head('Inne mot ute', esc(kiT('Siste 24 timer', 'Last 24 hours')))}
        <svg class="spk fill" viewBox="0 0 320 70" preserveAspectRatio="none" aria-hidden="true"><path d="${si.d}" fill="none" style="stroke:${PK}" stroke-width="2" stroke-linecap="round" vector-effect="non-scaling-stroke"></path><path d="${su.d}" fill="none" style="stroke:${BL}" stroke-width="2" stroke-dasharray="4 4" stroke-linecap="round" vector-effect="non-scaling-stroke"></path></svg>
        <div class="leg"><span><i style="background:${PK}"></i>Inne</span><span><i style="background:${BL}"></i>Ute</span></div>`, false, 4));
      // Ventilasjon
      const fan = D.fanId && h.states[D.fanId];
      out.push(art('vent', `${head('Ventilasjon', esc(fan ? (fan.state === 'on' ? (fan.attributes.preset_mode ? String(fan.attributes.preset_mode) : kiT('På', 'On')) : kiT('Av', 'Off')) : kiT('Fant ingen ventilasjon', 'No ventilation found')), btn('more', null, 'mdi:fan', 'Luft ut', false).replace('data-act="more"', `data-act="more" data-id="${esc(D.fanId || '')}"`))}${kv('mdi:fan', BL, nf(D.fanPct), '%')}<span class="grow"></span>${bars(D.fanPct == null ? [] : Array(20).fill(D.fanPct), BL, 3)}`, false, 5));
      return out.join('');
    }
    _pumpToday() {
      const h = this.hass, id = this._D && this._D.pumpId, e = id && h.entities && h.entities[id];
      if (!e || !e.device_id) return '–';
      const en = Object.keys(h.entities).find((k) => h.entities[k].device_id === e.device_id && h.states[k] && h.states[k].attributes.device_class === 'energy' && /(today|daily|i_dag|idag|day)/.test(k));
      const v = en ? M.pcData.num(h, en) : null;
      return v == null ? '–' : `${M.nf(v, 1)} kWh`;
    }
    _ms(v, u) { v = Number(v); return /km\/h/i.test(u || '') ? v / 3.6 : /mph/i.test(u || '') ? v * 0.447 : v; }

    /* ---------------------------------------------------------- Energi */
    _energi(D, S) {
      const P = D.P || {}, cur = P.cur || 'kr', out = [];
      const diff = S.today != null && S.yest ? Math.round(((S.today - S.yest) / S.yest) * 100) : null;
      const sub = diff == null ? '–' : diff <= 0 ? kiT('§ % lavere enn i går', '§ % lower than yesterday').replace('§', Math.abs(diff)) : kiT('§ % høyere enn i går', '§ % higher than yesterday').replace('§', diff);
      out.push(art('forbruk', `${head('Forbruk i dag', esc(sub), btn('pop', '#strom', 'mdi:chevron-right', 'Åpne', true), true)}
        <div class="bigrow"><span class="bigv"><span class="num" data-noi18n>${esc(nf1(S.today))}</span><span class="bu" data-noi18n>kWh</span></span><span class="sp"></span><span class="ic40" style="color:${PK}">${M.icon('mdi:lightning-bolt', 20)}</span></div>
        <span class="mut">${esc(`${S.cost == null ? '–' : M.nf(S.cost, 2) + ' ' + cur}${P.now != null ? ' · ' + (P.fmt ? P.fmt(P.now, { unit: true }) : M.nf(P.now, 2)) + ' ' + kiT('nå', 'now') : ''}`)}</span>
        <div class="bars-big">${bars(S.kwhH, PK, 3)}</div><div class="ticks">${['00', '06', '12', '18', '23'].map((x) => `<span data-noi18n>${x}</span>`).join('')}</div><span class="grow"></span>
        <div class="brow"><button class="cta" data-act="pop" data-v="#strom">Se timepriser</button><button class="sec" data-act="pop" data-v="#stromregning">Strømregning</button></div>`, true, 0));
      const ch = P.cheapest ? P.cheapest() : null;
      out.push(art('pris', `${head('Strømpris', esc(ch ? kiT('Billigst kl. §', 'Cheapest at §').replace('§', `${p2(ch.h)}–${p2((ch.h + 1) % 24)}`) : '–'), btn('pop', '#strom', 'mdi:chevron-right', 'Åpne'))}${kv('mdi:lightning-bolt', PK, P.val ? P.val(P.now) : nf(P.now, 2), P.unit || 'kr/kWh')}<span class="grow"></span>${bars(P.today || [], PK, 3)}`, false, 1));
      const STEPS = [2, 5, 10, 15, 20, 25, 50, 75, 100], ref = Math.max(D.powKw || 0, S.peakKw || 0), si = STEPS.findIndex((x) => ref <= x), lim = STEPS[si < 0 ? STEPS.length - 1 : si];
      const pct = D.powKw == null ? null : Math.round((D.powKw / lim) * 100);
      out.push(art('effekt', `${head('Effekt nå', esc(S.peakKw == null ? '–' : kiT('Topptime § kW', 'Peak hour § kW').replace('§', M.nf(S.peakKw, 1))))}${kv('mdi:speedometer', OR, D.powKw == null ? '–' : M.nf(D.powKw, 1), 'kW')}<span class="grow"></span>
        <span class="tr big"><span style="width:${pct == null ? 0 : M.clamp(pct, 0, 100)}%;background:${OR}"></span></span><span class="mut xs">${esc(pct == null ? '–' : kiT('§ % av grensen for trinn §', '§ % of the limit for step §').replace('§', pct).replace('§', (si < 0 ? STEPS.length : si + 1)))}</span>`, false, 2));
      out.push(art('topp', `${head('Størst forbruk', esc(kiT('Siste døgn', 'Last 24 hours')))}<span class="grow"></span><div class="rbl">${S.top.length ? rowsBar(S.top.map((x) => [x.n, x.v]), PK, ' kWh') : '<span class="mut">–</span>'}</div>`, false, 3));
      const solH = (S.solarH || []).slice(5, 21);
      out.push(art('sol', `${head('Solceller', esc(kiT('Produsert i dag', 'Produced today')))}${kv('mdi:solar-power', GR, nf1(S.solarT), 'kWh')}<span class="grow"></span>${bars(S.solarT == null ? [] : solH, GR, 3)}`, false, 4));
      const now = new Date(), en = (window.kiLang ? window.kiLang() : 'no') === 'en';
      const mCost = S.monthCost != null ? S.monthCost : null, bud = Number(this.config.budget) || 0;
      out.push(art('mnd', `${head('Denne måneden', esc(en ? MND_EN[now.getMonth()] : MND[now.getMonth()].charAt(0).toUpperCase() + MND[now.getMonth()].slice(1)), btn('pop', '#stromregning', 'mdi:chevron-right', 'Åpne'))}${kv('mdi:receipt-text-outline', PK, mCost == null ? '–' : M.nf(mCost), cur)}<span class="grow"></span>
        <span class="mut sm">${esc(`${S.month == null ? '–' : M.nf(S.month) + ' kWh'}${bud && mCost != null ? ' · ' + kiT('§ % av budsjettet', '§ % of the budget').replace('§', Math.round((mCost / bud) * 100)) : ''}`)}</span>
        ${bud && mCost != null ? `<span class="tr big"><span style="width:${M.clamp((mCost / bud) * 100, 0, 100)}%;background:${PK}"></span></span>` : ''}`, false, 5));
      return out.join('');
    }

    /* ---------------------------------------------------------- Sikkerhet */
    _sik(D, S) {
      const h = this.hass, A = D.A || {}, out = [];
      const st = A.st, by = st && st.attributes && st.attributes.changed_by;
      const sub = st ? `${kiT('Endret kl. §', 'Changed at §').replace('§', hm(st.last_changed))}${by ? ' ' + kiT('av §', 'by §').replace('§', by) : ''}` : '–';
      const MD = [['av', 'Av', 'mdi:shield-off-outline'], ['hjemme', 'Hjemme', 'mdi:home-outline'], ['borte', 'Borte', 'mdi:bag-suitcase-outline']];
      const ev = this._events(D);
      out.push(art('alarm', `${head('Alarm', esc(sub), btn('pop', '#sikkerhet', 'mdi:chevron-right', 'Åpne', true), true)}
        <div class="alrow"><span class="ic64" style="background:color-mix(in srgb, ${A.color || GR} 18%, transparent);color:${A.color || GR}">${M.icon(A.icon || 'mdi:shield-check', 32)}</span><span class="at"><b class="xl">${esc(A.mode ? A.text : '–')}</b><i>${esc(D.locks.length ? (D.unlocked.length ? kiT('§ dører ulåst', '§ doors unlocked').replace('§', D.unlocked.length) : kiT('Alle dører låst', 'All doors locked')) : '')}</i></span></div>
        <div class="amodes">${MD.map(([k, l, ic]) => `<button class="am${A.mode === k ? ' on' : ''}" data-act="alarm" data-v="${k}" ${A.alarm ? '' : 'disabled'}>${M.icon(ic, 20)}<span>${esc(l)}</span>${M.icon('mdi:check', 18, `opacity:${A.mode === k ? 1 : 0}`)}</button>`).join('')}</div>
        <span class="grow"></span><div class="evs"><b class="sm">Siste hendelser</b>${ev.map((e, i) => `<span class="evr" data-key="ev-${i}">${M.icon(e.icon, 16, `color:${e.col}`)}<span class="ell evn">${esc(e.n)}</span><span class="mut xs" data-noi18n>${esc(e.t)}</span></span>`).join('') || '<span class="mut">–</span>'}</div>`, true, 0));
      const OP = [...D.locks.map((id) => ({ id, open: h.states[id].state === 'unlocked', lab: h.states[id].state === 'unlocked' ? kiT('Ulåst', 'Unlocked') : kiT('Låst', 'Locked'), ic: 'mdi:lock-outline' })),
        ...D.garages.map((id) => ({ id, open: h.states[id].state !== 'closed', lab: h.states[id].state === 'closed' ? kiT('Lukket', 'Closed') : kiT('Åpen', 'Open'), ic: 'mdi:garage' })),
        ...[...D.doors, ...D.wins].map((id) => ({ id, open: h.states[id].state === 'on', lab: h.states[id].state === 'on' ? kiT('Åpent', 'Open') : kiT('Lukket', 'Closed'), ic: D.wins.includes(id) ? (h.states[id].state === 'on' ? 'mdi:window-open-variant' : 'mdi:window-closed-variant') : 'mdi:door' }))]
        .sort((a, b) => b.open - a.open).slice(0, 5);
      const nOpen = D.openWins.length + D.openDoors.length;
      out.push(art('dorer', `${head('Dører og vinduer', esc(nOpen ? kiT('§ åpne', '§ open').replace('§', nOpen) : OP.length ? kiT('Alt lukket', 'All closed') : '–'))}<span class="grow"></span>
        <div class="zl">${OP.map((x) => `<button class="zone" data-act="more" data-id="${esc(x.id)}" data-key="o-${esc(x.id)}">${M.icon(x.ic, 18, `color:${x.open ? OR : GR}`)}<span class="ell zn" data-noi18n>${esc(M.name(h, x.id))}</span>${pill(x.lab, x.open ? OR : GR)}</button>`).join('') || '<span class="mut">–</span>'}</div>`, false, 1));
      const cams = D.cams.slice(0, 4);
      out.push(art('kam', `${head('Kameraer', esc(D.cams.length ? kiT('§ tilkoblet', '§ connected').replace('§', D.cams.length) : '–'), btn('pop', '#kamera', 'mdi:video-outline', 'Se live'))}<span class="grow"></span>
        <div class="cams">${cams.map((id) => { const s = h.states[id], pic = s && s.attributes.entity_picture, u = pic && h.hassUrl ? h.hassUrl(pic) : pic; return `<button class="cam" data-act="pop" data-v="#kamera" data-key="c-${esc(id)}"><span class="cimg" data-ki-island>${u ? `<img src="${esc(u)}" alt="" loading="lazy">` : M.icon('mdi:video-off-outline', 22)}</span><span class="cn"><i style="background:${s && s.state !== 'unavailable' ? GR : 'var(--ki-ctrl, #545454)'}"></i><span class="ell" data-noi18n>${esc(M.name(h, id))}</span></span></button>`; }).join('') || '<span class="mut">–</span>'}</div>`, false, 2));
      const V = [['Røyk', D.smoke, 'mdi:smoke-detector-variant'], ['Vann', D.water, 'mdi:water-alert-outline'], ['Gass', D.gas, 'mdi:molecule-co']].map(([l, L, ic]) => { const bad = L.filter((id) => h.states[id].state === 'on').length; return [l, L.length ? (bad ? kiT('§ utløst', '§ triggered').replace('§', bad) : kiT('§ ok', '§ ok').replace('§', L.length)) : '–', ic, bad ? RD : L.length ? GR : 'var(--ki-text-mid, #979797)', bad]; });
      out.push(art('royk', `${head('Røyk og vann', esc(V.some((v) => v[4]) ? kiT('Alarm!', 'Alarm!') : V.some((v) => v[1] !== '–') ? kiT('Alt i orden', 'All good') : '–'))}<span class="grow"></span><div class="t3">${V.map(([l, v, ic, col]) => `<span class="tile">${M.icon(ic, 18, `color:${col}`)}<span class="tl">${esc(l)}</span><span class="tv">${esc(v)}</span></span>`).join('')}</div>`, false, 3));
      out.push(art('bev', `${head('Bevegelse', esc(kiT('Siste 24 timer', 'Last 24 hours')))}${kv('mdi:motion-sensor', BL, S.motN == null ? '–' : String(S.motN), '').replace('<span class="kvu" data-noi18n></span>', `<span class="kvu">${esc(kiT('utslag', 'triggers'))}</span>`)}<span class="grow"></span>${bars(S.mot || [], BL, 3)}`, false, 4));
      out.push(art('pers', this._persons(D), false, 5));
      return out.join('');
    }
    _events(D) {
      const h = this.hass, L = [];
      D.locks.forEach((id) => L.push([id, h.states[id].state === 'locked' ? kiT('§ låst', '§ locked') : kiT('§ ulåst', '§ unlocked'), 'mdi:lock-outline', h.states[id].state === 'locked' ? GR : OR]));
      D.doors.forEach((id) => L.push([id, h.states[id].state === 'on' ? kiT('§ åpnet', '§ opened') : kiT('§ lukket', '§ closed'), 'mdi:door', h.states[id].state === 'on' ? OR : GR]));
      D.garages.forEach((id) => L.push([id, h.states[id].state === 'closed' ? kiT('§ lukket', '§ closed') : kiT('§ åpnet', '§ opened'), 'mdi:garage', h.states[id].state === 'closed' ? GR : OR]));
      D.motion.forEach((id) => { if (h.states[id].state === 'on') L.push([id, kiT('Bevegelse: §', 'Motion: §'), 'mdi:motion-sensor', BL]); });
      return L.map(([id, txt, icon, col]) => ({ id, n: txt.replace('§', M.name(h, id)), icon, col, ts: new Date(h.states[id].last_changed).getTime() }))
        .filter((e) => !isNaN(e.ts)).sort((a, b) => b.ts - a.ts).slice(0, 4).map((e) => ({ ...e, t: this._when(e.ts) }));
    }
    _when(ts) {
      const d = new Date(ts), n = new Date(), y = new Date(n); y.setDate(y.getDate() - 1);
      const same = (a, b) => a.toDateString() === b.toDateString();
      return same(d, n) ? hm(ts) : same(d, y) ? `${kiT('i går', 'yesterday')} ${hm(ts)}` : `${d.getDate()}.${d.getMonth() + 1}.`;
    }

    /* ---------------------------------------------------------- Enheter */
    _enheter(D) {
      const h = this.hass, out = [];
      const R = D.rooms.filter((r) => r.ents.length);
      out.push(art('perrom', `${head('Enheter per rom', esc(kiT('§ enheter · § på', '§ devices · § on').replace('§', D.ctrlAll).replace('§', D.onAll)), btn('pop', '#settings', 'mdi:chevron-right', 'Åpne', true), true)}
        <div class="zl">${R.map((r) => `<button class="zone big" data-act="pop" data-v="#${esc(r.id)}" data-key="er-${esc(r.id)}">${M.icon(r.icon, 18, `color:${r.on ? PK : 'var(--ki-text-mid, #979797)'}`)}<span class="ell zn" data-noi18n>${esc(r.name)}</span><span class="mut sm" data-noi18n>${r.ents.length}</span>${pill(r.on ? kiT('På: §', 'On: §').replace('§', r.on) : kiT('Av', 'Off'), r.on ? PK : 'var(--ki-text-2, #bebebe)')}</button>`).join('') || '<span class="mut">–</span>'}</div>
        <span class="grow"></span><button class="cta self${this._arm === 'off' ? ' armed' : ''}" data-act="alloff" data-haptic="off">${esc(this._arm === 'off' ? kiT('Trykk igjen for å slå av', 'Tap again to turn off') : kiT('Slå av alt', 'Turn everything off'))}</button>`, true, 0));
      const B = D.batt.slice(0, 5), low = D.batt.filter((b) => b.v < 20).length;
      out.push(art('batt', `${head('Batterinivå', esc(D.batt.length ? (low ? kiT('§ under 20 %', '§ below 20 %').replace('§', low) : kiT('Alle over 20 %', 'All above 20 %')) : '–'))}<span class="grow"></span>
        <div class="rbl">${B.map((b, i) => `<span class="rb b" data-key="bt-${i}"><span class="ell" data-noi18n>${esc(M.name(h, b.id).replace(/\s*(battery|batteri)(\s*level|nivå)?\s*$/i, ''))}</span><span class="tr"><span style="width:${M.clamp(b.v, 2, 100)}%;background:${b.v < 20 ? RD : b.v < 50 ? OR : GR}"></span></span><span class="num rv" data-noi18n>${esc(M.nf(b.v) + ' %')}</span></span>`).join('') || '<span class="mut">–</span>'}</div>`, false, 1));
      const nT = D.net.reduce((t, x) => t + x[1], 0);
      out.push(art('nett', `${head('Tilkobling', esc(nT ? kiT('§ enheter', '§ devices').replace('§', nT) : '–'))}<span class="grow"></span><div class="t3">${D.net.map(([l, v, ic], i) => `<span class="tile">${M.icon(ic, 18, `color:${[PK, BL, GR][i]}`)}<span class="tl" data-noi18n>${esc(l)}</span><span class="tv" data-noi18n>${esc(v ? String(v) : '–')}</span></span>`).join('')}</div>`, false, 2));
      out.push(art('oppd', `${head('Oppdateringer', esc(D.upd.length ? kiT('§ tilgjengelige', '§ available').replace('§', D.upd.length) : kiT('Alt oppdatert', 'Up to date')), btn('pop', '#server', 'mdi:chevron-right', 'Åpne'))}<span class="grow"></span>
        <div class="zl">${D.upd.slice(0, 4).map((id) => `<button class="zone" data-act="more" data-id="${esc(id)}" data-key="u-${esc(id)}">${M.icon('mdi:package-up', 18, `color:${OR}`)}<span class="ell zn" data-noi18n>${esc(String(h.states[id].attributes.title || M.name(h, id)))}</span><span class="mut xs" data-noi18n>${esc(String(h.states[id].attributes.latest_version || ''))}</span></button>`).join('') || '<span class="mut">–</span>'}</div>`, false, 3));
      return out.join('');
    }

    /* ---------------------------------------------------------- Rom og apper */
    _apps() {
      const h = this.hass, have = new Set((M.allPopups ? M.allPopups(h) : []).map((p) => M.canonHash ? M.canonHash(p.hash) : p.hash));
      const D = this._D || M.pcData.collect(h, this);
      const ok = (t) => {
        if (t[0] === '#') return have.has(t) || have.has(M.canonHash ? M.canonHash(t) : t) || (M.HASH_ALIAS && M.HASH_ALIAS[t] && have.has(M.HASH_ALIAS[t]));
        if (t === 'room:stue') return !!D.rooms.find((r) => /^(stue|living)/i.test(r.id) || /^stue|living/i.test(r.name));
        if (t === 'room:') return D.rooms.length > 0;
        if (t === 'hurtig') return !!(this._hjem && this._hjem.__hurtig);
        if (t === 'ringrec') return !!M.ringRec && have.has('#ringeklokke');
        if (t === 'person') return D.persons.length > 0;
        return true;
      };
      return GRUPPER.map(([g, gi, col, items]) => [g, gi, col, items.filter((x) => ok(x[2]))]).filter((x) => x[3].length);
    }
    _apper() {
      return this._apps().map(([g, gi, col, items]) => `<div class="grp" data-key="ag-${esc(g)}"><span class="gh">${M.icon(gi, 17)}${esc(g)}</span>
        <div class="agrid">${items.map(([n, ic, t]) => `<button class="app" data-act="app" data-v="${esc(t)}" data-n="${esc(n)}" title="${esc(n)}"><span class="aic" style="background:color-mix(in srgb, ${col} 18%, transparent);color:${col}">${M.icon(ic, 18)}</span><span class="ell an">${esc(n)}</span></button>`).join('')}</div></div>`).join('');
    }
    _runApp(t, n) {
      const D = this._D;
      if (t[0] === '#') return this._openPanel(t, n);
      if (t === 'mobil') return this._mobile();
      if (t === 'hurtig') { const q = this._hjem && this._hjem.__hurtig; if (q) q.open(1); return; }
      if (t === 'ringrec') { if (M.ringRec) M.ringRec.open({}); return; }
      if (t === 'person') { const p = D && D.persons[0]; if (p) this._openPanel('#person-' + p.id.split('.')[1], p.name); return; }
      if (t.startsWith('room:')) {
        const k = t.slice(5), r = k ? D.rooms.find((x) => /^(stue|living)/i.test(x.id) || /^stue|living/i.test(x.name)) : (D.rooms.find((x) => x.id === this.ui.room) || D.rooms[0]);
        if (r) this._openPanel('#' + r.id, r.name);
      }
    }
    _mobile() { M.pc.set('mobil'); M.toast(kiT('Mobilvisning', 'Mobile view')); }

    /* ---------------------------------------------------------- handlinger */
    onAction(name, el, ev) {
      const d = el.dataset, h = this.hass;
      switch (name) {
        case 'tab': if (KEYS.includes(d.v) && d.v !== this.tab) this.setUI({ tab: d.v }); return;
        case 'room': { const v = d.v || null; if (v && v === this.ui.room) { const r = this._D.rooms.find((x) => x.id === v); return this._openPanel('#' + v, r ? r.name : v); } return this.setUI({ room: v }); }
        case 'pop': return this._openPanel(d.v, el.getAttribute('title') || el.textContent.trim());
        case 'app': return this._runApp(d.v, d.n);
        case 'mobil': return this._openPanel('mobil', kiT('Hjem (mobil)', 'Home (mobile)'));
        case 'person': return this._runApp('person');
        case 'search': return this._search();
        case 'tilpass': return this._tilpass();
        case 'ana': return this._analyse();
        case 'notif': { const q = this._hjem && this._hjem.__hurtig; if (q) return q.open(1); return this._openPanel('#settings', 'Innstillinger'); }
        case 'me': { const u = h.user && h.user.name, p = this._D.persons.find((x) => u && x.name.toLowerCase() === u.toLowerCase()) || this._D.persons[0]; if (p) return this._openPanel('#person-' + p.id.split('.')[1], p.name); return; }
        case 'refresh': { const ids = this._D.tempIds; if (ids.length) M.call(h, 'homeassistant', 'update_entity', { entity_id: ids }).catch(() => {}); M.pcData.cacheClear(); return this.update(); }
        case 'kiopt': { const k = this._kiOpt(); if (!k.id) return this._openPanel('#klima', 'Klima'); const dm = k.id.split('.')[0]; M.call(h, dm, dm === 'script' ? 'turn_on' : 'trigger', { entity_id: k.id }).then(() => M.toast(kiT('KI-optimalisering startet', 'AI optimisation started'))).catch((e) => M.toast(String(e.message || e))); return; }
        case 'pset': { const P = this._D.pump; if (!P) return; const cur = Number(P.attributes.temperature); const v = M.clamp(Math.round(((isNaN(cur) ? 22 : cur) + Number(d.v)) * 2) / 2, 16, 28); M.call(h, 'climate', 'set_temperature', { entity_id: this._D.pumpId, temperature: v }).catch((e) => M.toast(String(e.message || e))); return; }
        case 'pmode': { if (!this._D.pumpId) return; M.call(h, 'climate', 'set_hvac_mode', { entity_id: this._D.pumpId, hvac_mode: d.v }).catch((e) => M.toast(String(e.message || e))); return; }
        case 'alarm': {
          const A = this._D.A || {}, cfg = (M.sikCfg && M.sikCfg()) || {}, st = A.alarm && h.states[A.alarm];
          if (st && st.attributes.code_format && st.attributes.code_arm_required !== false) return this._openPanel('#sikkerhet', 'Sikkerhet'); // kode → tastaturet i Sikkerhet-popupen
          if (M.sikSetMode) M.sikSetMode(h, cfg, d.v).catch((e) => M.toast(String(e.message || e)));
          return;
        }
        case 'alloff': {
          if (this._arm !== 'off') { this._arm = 'off'; M.haptic('warning'); clearTimeout(this._armT); this._armT = setTimeout(() => { this._arm = null; this.update(); }, 3000); return this.update(); }
          this._arm = null; clearTimeout(this._armT); M.haptic('heavy');
          const on = Object.keys(h.states).filter((id) => id.startsWith('light.') && h.states[id].state === 'on' && !(this.config.exclude || []).includes(id));
          if (on.length) M.call(h, 'light', 'turn_off', { entity_id: on }).catch(() => {});
          M.toast(on.length ? kiT('§ lys slås av', '§ lights turning off').replace('§', on.length) : kiT('Alt er allerede av', 'Everything is already off'));
          return this.update();
        }
        default: return super.onAction(name, el, ev);
      }
    }

    /* ---------------------------------------------------------- sidepanel for popups */
    // Popupens kort tegnes innebygd i et portalt panel (fallgruve 1): kortets config hentes fra den levende Bubble-popupen
    // med samme hash. Finnes ikke kortet (tredjepartspopup) → vanlig Bubble-popup via hash.
    _cardOf(hash) {
      if (hash === 'mobil') { const hj = this._hjem; return hj ? { tag: 'msh-hjem-card', cfg: { ...(hj._rawConfig || hj.config), no_pc: true } } : null; }
      const h = M.canonHash ? M.canonHash(hash) : hash, L = M.liveBubbles ? M.liveBubbles() : [];
      const b = L.find((x) => x.cfg.hash === h || x.cfg.hash === hash);
      const c = b && Array.isArray(b.cfg.cards) && b.cfg.cards[0];
      if (!c || typeof c.type !== 'string' || !c.type.startsWith('custom:')) return null;
      const tag = c.type.slice(7);
      return customElements.get(tag) ? { tag, cfg: c, name: b.cfg.name } : null;
    }
    _openPanel(hash, name) {
      if (!hash) return;
      const C0 = this._cardOf(hash);
      if (!C0) { if (hash !== 'mobil') M.openPopup(hash); return; }
      if (this._panel) this._panel.close();
      const nm = C0.name || String(name || '').trim() || hash;
      const html = `<div class="ph"><span class="pt ell">${esc(nm)}</span>${hash !== 'mobil' ? `<button class="px" data-pa="tab" title="Åpne i egen fane" aria-label="Åpne i egen fane">${M.icon('mdi:open-in-new', 20)}</button>` : ''}<button class="px" data-pa="close" title="Lukk" aria-label="Lukk">${M.icon('mdi:close', 22)}</button></div><div class="pb" data-pb></div>`;
      const css = `.sh{top:12px;right:12px;bottom:12px;left:auto;width:min(460px, calc(100% - 24px));max-width:none;max-height:none;margin:0;padding:0;border-radius:32px;display:flex;flex-direction:column;overflow:hidden;
          background:var(--ki-popup, #282828);box-shadow:0 24px 70px ${M.theme.blackA(0.6)};transform:translate3d(24px,0,0);opacity:0}
        :host(.on) .sh{transform:none;opacity:1}
        .body{display:flex;flex-direction:column;flex:1;min-height:0}
        .ph{display:flex;align-items:center;gap:10px;padding:12px 12px 8px 20px;flex:none}
        .pt{flex:1;min-width:0;font-size:16px;font-weight:600}
        .px{width:40px;height:40px;border-radius:20px;display:grid;place-items:center;background:${M.theme.whiteA(0.1)};color:var(--ki-text, #fafafa);flex:none}
        .px:hover{background:${M.theme.whiteA(0.18)}}
        .pb{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:8px 14px 24px}
        .pb>*{display:block;width:100%}`;
      const ov = M.overlay({ html, css, sheet: false, maxWidth: 460, guard: 300, onClose: () => { if (this._panel === ov) this._panel = null; } });
      ov.host.setAttribute('data-pc-panel', hash);
      const el = document.createElement(C0.tag);
      el.setAttribute('embedded', '');
      try { el.setConfig(C0.cfg); } catch (e) { console.error('[ki-msh] msh-pc-card panel', e); }
      el.hass = this.hass;
      ov.root.querySelector('[data-pb]').appendChild(el);
      ov.root.addEventListener('click', (e) => {
        const b = e.target.closest && e.target.closest('[data-pa]'); if (!b) return;
        M.haptic('light');
        if (b.dataset.pa === 'tab') { ov.close(); M.openPopup(hash); return; }
        ov.close();
      });
      ov.card = el;
      this._panel = ov;
    }
    set hass(h) { super.hass = h; if (this._panel && this._panel.card) this._panel.card.hass = h; this._fcSub(); }
    get hass() { return super.hass; }
    _fcSub() {
      const D = this._D, w = D && D.weather;
      if (!w || !M.wxForecast || this._fcW === w) return;
      if (this._fcUnsub) { try { this._fcUnsub(); } catch (e) { /* */ } }
      this._fcW = w;
      this._fcUnsub = M.wxForecast(this.hass, w, 'hourly', (fc) => { this._fc = (fc || []).filter((x) => new Date(x.datetime) >= Date.now() - 3600000); if (this.tab === 'klima') this.update(); });
      const u2 = M.wxForecast(this.hass, w, 'daily', (fc) => { this._fcDay = fc || []; if (this.tab === 'klima') this.update(); });
      const u1 = this._fcUnsub; this._fcUnsub = () => { u1(); u2(); };
    }

    /* ---------------------------------------------------------- søk */
    _flat() {
      const out = [];
      this._apps().forEach(([g, , col, items]) => items.forEach(([n, ic, t]) => out.push({ n, g, ic, t, col })));
      (this._D ? this._D.rooms : []).forEach((r) => out.push({ n: r.name, g: kiT('Rom', 'Rooms'), ic: r.icon, t: '#' + r.id, col: PK, room: true }));
      return out;
    }
    _search() {
      if (this._sheet) this._sheet.close();
      const L = this._flat();
      const css = `.sh{top:72px;bottom:auto;left:50%;right:auto;width:min(620px, calc(100% - 32px));max-width:none;max-height:72vh;margin:0;padding:0;border-radius:30px;display:flex;flex-direction:column;overflow:hidden;
          background:var(--ki-surface-3, #2f2f2f);box-shadow:0 24px 70px ${M.theme.blackA(0.6)};transform:translate3d(-50%,-8px,0);opacity:0}
        :host(.on) .sh{transform:translate3d(-50%,0,0);opacity:1}
        .body{display:flex;flex-direction:column;min-height:0;flex:1}
        .sr{display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid ${M.theme.whiteA(0.08)}}
        .sr input{flex:1;min-width:0;height:36px;border:0;background:none;color:var(--ki-text, #fafafa);font:inherit;font-size:15px;outline:none}
        .x{width:36px;height:36px;border-radius:18px;display:grid;place-items:center;background:var(--ki-surface, #3a3a3a);color:var(--ki-text, #fafafa)}
        .hits{flex:1;overflow-y:auto;padding:8px;display:flex;flex-direction:column;gap:2px}
        .hit{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:18px;width:100%;text-align:left;color:var(--ki-text, #fafafa)}
        .hit:hover,.hit.first{background:var(--ki-surface, #3a3a3a)}
        .hi{width:32px;height:32px;flex:none;border-radius:16px;display:grid;place-items:center;background:var(--ki-surface, #3a3a3a);color:${PK}}
        .hn{flex:1;min-width:0;font-size:14px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .hg{font-size:12px;color:var(--ki-text-mid, #979797)}
        .no{padding:24px;text-align:center;font-size:13px;color:var(--ki-text-mid, #979797)}`;
      const ov = M.overlay({ html: `<div class="sr">${M.icon('mdi:magnify', 22, 'color:var(--ki-text-mid, #979797)')}<input type="search" data-q placeholder="Søk etter rom, enhet eller app" autocomplete="off" spellcheck="false"><button class="x" data-sa="close" title="Lukk" aria-label="Lukk">${M.icon('mdi:close', 20)}</button></div><div class="hits" data-hits></div>`,
        css, sheet: false, center: false, maxWidth: 620, guard: 250, onClose: () => { if (this._sheet === ov) this._sheet = null; } });
      ov.host.setAttribute('data-pc-search', '');
      const inp = ov.root.querySelector('[data-q]'), hits = ov.root.querySelector('[data-hits]');
      let cur = [];
      const draw = () => {
        const q = inp.value.trim().toLowerCase();
        cur = (q ? L.filter((x) => x.n.toLowerCase().includes(q) || x.g.toLowerCase().includes(q)) : L).slice(0, 40);
        hits.innerHTML = cur.length ? cur.map((x, i) => `<button class="hit${i === 0 && q ? ' first' : ''}" data-i="${i}"><span class="hi">${M.icon(x.ic, 18)}</span><span class="hn"${x.room ? ' data-noi18n' : ''}>${esc(x.n)}</span><span class="hg">${esc(x.g)}</span></button>`).join('') : `<span class="no">${esc(kiT('Ingen treff', 'No results'))}</span>`;
      };
      const go = (x) => { if (!x) return; M.haptic('light'); ov.close(); this._runApp(x.t, x.n); };
      inp.addEventListener('input', draw);
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go(cur[0]); } else if (e.key === 'Escape') ov.close(); });
      ov.root.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('[data-i],[data-sa]'); if (!b) return; if (b.dataset.sa) { M.haptic('light'); return ov.close(); } go(cur[+b.dataset.i]); });
      draw();
      setTimeout(() => { try { inp.focus(); } catch (e) { /* */ } }, 40);
      this._sheet = ov;
    }

    /* ---------------------------------------------------------- Tilpass oversikten */
    _tilpass() {
      if (this._sheet) this._sheet.close();
      const en = () => (window.kiLang ? window.kiLang() : 'no') === 'en';
      const css = `${this._dlgCss(520)}
        .menu{display:flex;flex-direction:column;border-radius:22px;overflow:hidden;background:var(--ki-surface, #3a3a3a);margin-bottom:10px}
        .mr{display:flex;align-items:center;gap:14px;min-height:62px;padding:0 16px;width:100%;box-sizing:border-box;text-align:left;color:var(--ki-text, #fafafa);border-top:1px solid ${M.theme.whiteA(0.06)}}
        .mr:first-child{border-top:0}.mr:hover{background:var(--ki-surface-2, #454545)}
        .mx{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}.mx b{font-size:14px;font-weight:500}.mx i{font-style:normal;font-size:12px;color:var(--ki-text-mid, #979797)}
        .lbl{padding:2px 14px 6px;font-size:12px;font-weight:600;color:var(--ki-text-2, #afafaf)}
        .kr{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:20px;background:var(--ki-surface, #3a3a3a);text-align:left;width:100%;box-sizing:border-box;color:var(--ki-text, #fafafa);margin-bottom:4px}
        .kr:hover{background:var(--ki-surface-2, #454545)}
        .kr span{flex:1;min-width:0;font-size:14px;font-weight:500}
        .trk{width:52px;height:32px;flex:none;box-sizing:border-box;border-radius:16px;padding:3px;display:flex;justify-content:flex-start;background:var(--ki-ctrl, #4e4e4e);box-shadow:inset 0 0 0 1px ${M.theme.whiteA(0.12)};transition:background .2s}
        .trk.on{justify-content:flex-end;background:${GRAD};box-shadow:none}
        .knb{width:26px;height:26px;border-radius:13px;display:grid;place-items:center;background:var(--ki-knob, #fafafa);box-shadow:0 1px 3px ${M.theme.blackA(0.45)};color:var(--ki-on-accent, #282828)}
        .knb ha-icon{opacity:0;transition:opacity .2s}.trk.on .knb ha-icon{opacity:1}
        .ft{padding:10px 14px 0;font-size:12px;color:var(--ki-text-mid, #7f7f7f)}`;
      const ov = M.overlay({ html: '', css, sheet: false, maxWidth: 520, guard: 250, onClose: () => { if (this._sheet === ov) this._sheet = null; } });
      ov.host.setAttribute('data-pc-tilpass', '');
      const draw = () => {
        const hid = this._hidden();
        const rows = [['mdi:translate', 'Språk · Language', en() ? 'English' : 'Norsk', 'lang'], ['mdi:monitor', 'Dashbord på PC', kiT('Oversikt for PC', 'Overview for PC'), 'pc'],
          ['mdi:auto-fix', 'Tilpass alt', kiT('Veiviser for hele dashbordet', 'Wizard for the whole dashboard'), 'alt'], ['mdi:view-dashboard-edit-outline', 'Tilpass Hjem', kiT('Kort, faner, popups og tekst', 'Cards, tabs, popups and text'), 'home'],
          ['mdi:tune-variant', 'Innstillinger', kiT('Enheter, varsler og integrasjoner', 'Devices, notifications and integrations'), 'settings']];
        ov.body.innerHTML = `<div class="dh kt-head" data-sheet-head>${M.tp.head({ title: 'Tilpass oversikten', sub: 'Snarveier til alle Tilpass-menyene', done: 'close', act: 'ta' })}</div><div class="db">
          <div class="menu">${rows.map(([ic, n, sub, k]) => `<button class="mr" data-ta="${k}">${M.icon(ic, 22, 'color:var(--ki-text-1, #c7c7c7)')}<span class="mx"><b${k === 'lang' ? ' data-noi18n' : ''}>${esc(n)}</b><i${k === 'lang' ? ' data-noi18n' : ''}>${esc(sub)}</i></span>${M.icon('mdi:chevron-right', 20, 'color:var(--ki-text-3, #7f7f7f)')}</button>`).join('')}</div>
          <span class="lbl">Kort i oversikten</span>
          ${KORT.map(([k, n]) => `<button class="kr" data-ta="kort" data-k="${k}" role="switch" aria-checked="${!hid[k]}"><span>${esc(n)}</span><span class="trk${hid[k] ? '' : ' on'}"><span class="knb">${M.icon('mdi:check', 16)}</span></span></button>`).join('')}
          <span class="ft">Valget lagres på denne maskinen.</span></div>`;
      };
      ov.root.addEventListener('click', (e) => {
        const b = e.target.closest && e.target.closest('[data-ta]'); if (!b) return;
        const k = b.dataset.ta;
        if (k === 'kort') { M.haptic('selection'); const H = this._hidden(); if (H[b.dataset.k]) delete H[b.dataset.k]; else H[b.dataset.k] = true; lsSet(LS.cards, JSON.stringify(H)); draw(); this.update(); return; }
        M.haptic('light');
        if (k === 'lang') { if (window.kiSetLang) window.kiSetLang(en() ? 'no' : 'en'); draw(); return; }
        ov.close();
        if (k === 'pc') return this._mobile();
        if (k === 'alt') return window.dispatchEvent(new CustomEvent('ki-open-editor', { detail: { editor: 'tilpass-alt' } }));
        if (k === 'home') return window.dispatchEvent(new CustomEvent('ki-open-editor', { detail: { editor: 'home' } }));
        if (k === 'settings') return this._openPanel('#settings', 'Innstillinger');
      });
      draw();
      this._sheet = ov;
    }
    _dlgCss(w) {
      return `.sh{top:72px;bottom:auto;left:50%;right:auto;width:min(${w}px, calc(100% - 32px));max-width:none;max-height:78vh;margin:0;padding:0;border-radius:30px;display:flex;flex-direction:column;overflow:hidden;
          background:var(--ki-surface-3, #2f2f2f);box-shadow:0 24px 70px ${M.theme.blackA(0.6)};transform:translate3d(-50%,-8px,0);opacity:0}
        :host(.on) .sh{transform:translate3d(-50%,0,0);opacity:1}
        .body{display:flex;flex-direction:column;min-height:0;flex:1}
        .dh{display:flex;align-items:center;gap:12px;padding:16px 16px 14px 20px;flex:none}
        ${M.tp.CSS} /* felles Tilpass-header (MSH.tp) */
        .dt{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;font-size:19px;font-weight:600;letter-spacing:-0.02em}
        .dt i{font-style:normal;font-size:12px;font-weight:400;color:var(--ki-text-mid, #979797);letter-spacing:0}
        .x{width:40px;height:40px;border-radius:20px;display:grid;place-items:center;background:var(--ki-surface, #3a3a3a);color:var(--ki-text, #fafafa);flex:none}
        .db{flex:1;overflow-y:auto;padding:0 12px 16px;display:flex;flex-direction:column}`;
    }

    /* ---------------------------------------------------------- Analyse */
    _analyse() {
      if (this._sheet) this._sheet.close();
      const PER = [['7 dager', 7], ['30 dager', 30], ['90 dager', 90], ['1 år', 364]];
      let pi = 1;
      const css = `${this._dlgCss(760)}.sh{top:64px;max-height:80vh;border-radius:32px}
        .pr{padding:0 16px;display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:2px;flex:none}
        .pp{height:36px;min-width:0;border-radius:18px;font-size:13px;font-weight:600;white-space:nowrap;background:var(--ki-surface, #3a3a3a);color:var(--ki-text-1, #c7c7c7)}
        .pp.on{background:${GRAD};color:var(--ki-on-accent, #282828)}
        .db{padding:16px;gap:10px}
        .ch{display:flex;flex-direction:column;gap:8px;padding:14px;border-radius:22px;background:var(--ki-surface, #3a3a3a)}
        .cht{display:flex;align-items:baseline;gap:8px}.cht span:first-child{flex:1;font-size:13px;color:var(--ki-text-2, #afafaf)}.cht .v{font-size:20px;font-weight:300;font-variant-numeric:tabular-nums}.cht .u{font-size:11px;color:var(--ki-text-mid, #979797)}
        .cb{display:flex;align-items:flex-end;gap:2px;height:84px}.cb span{flex:1;min-width:0}
        .cax{display:flex;justify-content:space-between;font-size:11px;color:var(--ki-text-mid, #7f7f7f)}
        .no{padding:20px;text-align:center;font-size:13px;color:var(--ki-text-mid, #979797)}`;
      const ov = M.overlay({ html: '', css, sheet: false, maxWidth: 760, guard: 250, onClose: () => { if (this._sheet === ov) { this._sheet = null; this._anaDraw = null; } } });
      ov.host.setAttribute('data-pc-analyse', '');
      const draw = () => {
        const nD = PER[pi][1], R = M.pcData.analyse(this.hass, this, this.tab, nD);
        const ch = R.map((c) => {
          const f = (v) => (v == null ? '–' : M.nf(v, Math.abs(v) < 100 ? 1 : 0));
          return `<div class="ch" data-n="${c.vals.length}"><div class="cht"><span>${esc(c.n)}</span><span class="v" data-noi18n>${esc(f(c.sum))}</span><span class="u" data-noi18n>${esc(c.u)}</span></div>
            ${bars(c.vals, c.c, 2).replace('class="bars', 'class="cb bars')}
            <div class="cax"><span>${esc(kiT('§ siden', '§ ago').replace('§', PER[pi][0]))}</span><span>${esc(kiT('snitt § / dag', 'avg § / day').replace('§', f(c.avg) + (c.u ? ' ' + c.u : '')))}</span><span>${esc(kiT('i dag', 'today'))}</span></div></div>`;
        }).join('');
        ov.body.innerHTML = `<div class="dh"><span class="dt">Analyse<i>${esc(TABL[this.tab][1])}</i></span><button class="x" data-aa="close" title="Lukk" aria-label="Lukk">${M.icon('mdi:close', 22)}</button></div>
          <div class="pr">${PER.map(([l], i) => `<button class="pp${i === pi ? ' on' : ''}" data-aa="per" data-v="${i}">${esc(l)}</button>`).join('')}</div>
          <div class="db">${ch || `<span class="no">${esc(kiT('Ingen statistikk for denne fanen ennå.', 'No statistics for this tab yet.'))}</span>`}</div>`;
      };
      ov.root.addEventListener('click', (e) => {
        const b = e.target.closest && e.target.closest('[data-aa]'); if (!b) return;
        if (b.dataset.aa === 'close') { M.haptic('light'); return ov.close(); }
        M.haptic('selection'); pi = +b.dataset.v; draw();
      });
      this._anaDraw = draw;
      draw();
      this._sheet = ov;
    }
    update() { super.update(); if (this._anaDraw) this._anaDraw(); }

    /* ---------------------------------------------------------- gester */
    afterRender() {
      const R = this.shadowRoot;
      // Fanerad: flytende glass ved dra + hold 400 ms og dra = ny rekkefølge (felles MSH.tabRow → tab_order i config)
      const nav = R.querySelector('nav.tabs');
      if (nav && M.tabRow) M.tabRow(this, nav, { active: () => this.tab, order: () => this._order(), field: 'tab_order', glass: true });
      if (Array.isArray(this.config.tab_order)) lsSet(LS.tabs, JSON.stringify(this._order()));
      // Helt-panelets bredde: dra i høyre kant (14 px), dobbeltklikk = 480
      const hw = R.querySelector('.hw');
      if (hw && !hw.__b) {
        hw.__b = true;
        hw.addEventListener('pointerdown', (e) => {
          e.preventDefault(); e.stopPropagation();
          const hero = R.querySelector('.hero'), x0 = e.clientX, b0 = this._width();
          try { hw.setPointerCapture(e.pointerId); } catch (x) { /* */ }
          this._busy = true;
          const mv = (ev) => { const v = Math.round(M.clamp(b0 + ev.clientX - x0, 300, 760)); this._wDrag = v; if (hero) { hero.style.width = v + 'px'; hero.style.flexBasis = v + 'px'; } };
          const up = () => { hw.removeEventListener('pointermove', mv); hw.removeEventListener('pointerup', up); hw.removeEventListener('pointercancel', up); this._busy = false; if (this._wDrag) lsSet(LS.w, String(this._wDrag)); this._wDrag = null; M.haptic('light'); this.update(); };
          hw.addEventListener('pointermove', mv); hw.addEventListener('pointerup', up); hw.addEventListener('pointercancel', up);
        });
        hw.addEventListener('dblclick', () => { lsSet(LS.w, '480'); M.haptic('light'); this.update(); });
      }
    }

    get styles() {
      const S = 'var(--ki-surface, #3a3a3a)', S2 = 'var(--ki-surface-2, #454545)', S3 = 'var(--ki-surface-3, #2f2f2f)';
      const T = 'var(--ki-text, #fafafa)', T1 = 'var(--ki-text-1, #c7c7c7)', T2 = 'var(--ki-text-2, #afafaf)', TM = 'var(--ki-text-mid, #979797)', T3 = 'var(--ki-text-mid, #7f7f7f)';
      const INK = 'var(--ki-on-accent, #282828)';
      return `
        :host{display:block;width:100%}
        .wrap{min-height:100vh;box-sizing:border-box;padding:16px;display:flex;flex-wrap:wrap;gap:16px;font-size:14px;color:${T};align-items:stretch}
        @keyframes pcf{from{opacity:0;transform:translateY(6px)}}
        .ell{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
        .num{font-variant-numeric:tabular-nums}
        .mut{font-size:12px;color:${TM}}.mut.sm{font-size:12px}.mut.xs,.xs{font-size:11px}.b{font-weight:500}
        .grow{flex:1}.sp{flex:1 1 20px}
        /* helt-panel */
        .hero{max-width:100%;min-height:640px;position:relative;border-radius:36px;overflow:hidden;background:${S3};display:flex;flex-direction:column;justify-content:space-between;padding:24px;box-sizing:border-box;color:#fafafa} /* ki-hex-ok (tekst på bilde/mørk gradient) */
        .hw{position:absolute;top:0;right:0;bottom:0;width:14px;z-index:4;cursor:col-resize;touch-action:none}
        .hi{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
        .hi.ph{background:radial-gradient(120% 90% at 20% 0%, color-mix(in srgb, ${PK} 28%, #2f2f2f), #262626 70%)} /* ki-hex-ok */
        .hg{position:absolute;inset:0;background:linear-gradient(180deg,rgb(25 25 25 / .72) 0%,rgb(25 25 25 / .25) 38%,rgb(25 25 25 / .88) 100%);pointer-events:none}
        .hrow{position:relative;display:flex;align-items:center;justify-content:space-between;gap:12px}
        .logo{display:flex;align-items:center;gap:8px;font-size:17px;font-weight:600;letter-spacing:-0.01em}
        .hmb{width:44px;height:44px;border-radius:22px;display:grid;place-items:center;background:rgb(250 250 250 / .14);backdrop-filter:blur(10px);color:#fafafa} /* ki-hex-ok */
        .hmb:hover{background:rgb(250 250 250 / .24)}
        .hcol{position:relative;display:flex;flex-direction:column;gap:18px}
        .hname{display:flex;flex-direction:column;gap:6px}.hname .big{font-size:54px;font-weight:300;line-height:1;letter-spacing:-0.03em}
        .hsub span{display:flex;align-items:center;gap:6px;font-size:13px;color:#c7c7c7} /* ki-hex-ok */
        .hstat{display:flex;flex-wrap:wrap;gap:12px 20px;padding:14px 16px;border-radius:22px;background:rgb(25 25 25 / .55);backdrop-filter:blur(10px)}
        .hs{display:flex;flex-direction:column;gap:3px;min-width:0}.hl{display:flex;align-items:center;gap:5px;font-size:11px;color:#afafaf}.hv{font-size:17px} /* ki-hex-ok */
        .chips{display:flex;flex-wrap:wrap;gap:6px}
        .rc{height:36px;padding:0 16px;border-radius:18px;font-size:13px;font-weight:500;white-space:nowrap;background:rgb(250 250 250 / .14);color:#fafafa;backdrop-filter:blur(10px);transition:background .2s} /* ki-hex-ok */
        .rc.on{background:#fafafa;color:#282828}.rc.add{width:38px;height:38px;padding:0;border-radius:19px;display:grid;place-items:center} /* ki-hex-ok */
        .rc:hover:not(.on){background:rgb(250 250 250 / .26)}
        /* høyre del */
        .main{flex:9999 1 480px;min-width:0;display:flex;flex-direction:column;gap:16px}
        .top{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
        .ib{width:44px;height:44px;flex:none;border-radius:22px;display:grid;place-items:center;background:${S};color:${T};position:relative}
        .ib:hover{background:${S2}}
        .ib .dot{position:absolute;top:10px;right:11px;width:8px;height:8px;border-radius:4px;background:${PK};box-shadow:0 0 0 2px ${S}}
        .ib.me{background:${GRAD};color:${INK};font-weight:600}
        .tabs{display:flex;flex-wrap:wrap;gap:2px;padding:4px;border-radius:26px;background:${S3};min-width:0;box-shadow:inset 0 0 0 1px var(--ki-line, rgb(255 255 255 / .06));user-select:none;touch-action:pan-y;position:relative}
        .tb{height:38px;padding:0 16px;border-radius:19px;display:flex;align-items:center;gap:7px;font-size:13px;font-weight:500;white-space:nowrap;color:${T1};transition:background .2s,transform .18s,box-shadow .2s}
        .tb.on{background:${GRAD};color:${INK}}
        .tb:hover:not(.on){background:var(--ki-line, rgb(255 255 255 / .06))}
        .clk{font-size:13px;color:${TM};white-space:nowrap}
        .ttl{display:flex;align-items:flex-end;gap:12px;flex-wrap:wrap}
        .ttl h1{flex:1 1 200px;margin:0;font-size:40px;font-weight:300;letter-spacing:-0.03em}
        .tbtns{display:flex;gap:8px;flex-wrap:wrap}
        .pb{height:40px;padding:0 16px;border-radius:20px;display:flex;align-items:center;gap:8px;font-size:13px;font-weight:500;background:${S};color:${T}}
        .pb:hover{background:${S2}}
        /* kortrutenett */
        .grid{flex:1;display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));grid-auto-rows:minmax(170px,auto);gap:12px;align-content:start}
        .card{display:flex;flex-direction:column;gap:10px;padding:18px;border-radius:30px;background:${S};animation:pcf .3s ease backwards;min-width:0;box-sizing:border-box}
        .card{container-type:inline-size}
        .card.span2{grid-row:span 2;gap:14px;padding:20px}
        .ah{display:flex;align-items:flex-start;gap:10px}
        .at{flex:1;display:flex;flex-direction:column;gap:2px;min-width:0}
        .at b{font-size:14px;font-weight:600}.at b.big{font-size:15px}.at b.sm,b.sm{font-size:13px;font-weight:500}.at b.xl{font-size:32px;font-weight:300;line-height:1;letter-spacing:-0.02em}
        .at i{font-style:normal;font-size:12px;color:${TM}}
        .hb{width:30px;height:30px;border-radius:15px;display:grid;place-items:center;background:${S2};color:${T};flex:none}
        .hb.big{width:34px;height:34px;border-radius:17px}
        .hb:hover,.zone:hover,.rk:hover,.sec:hover,.app:hover{filter:brightness(1.12)}
        .bigrow,.prow2{display:flex;align-items:center;gap:10px}
        .bigrow{align-items:flex-start}
        .bigv{display:flex;align-items:flex-start;gap:4px}.bigv .num{font-size:min(72px, 26cqw);font-weight:200;line-height:.9;letter-spacing:-0.04em}.bu{font-size:22px;font-weight:300;color:${T1}}
        .bigv.md{flex:1;align-items:baseline}.bigv.md .num{font-size:34px;font-weight:300;line-height:1;letter-spacing:0}.bu.sm{font-size:14px;color:${TM}}
        .ic40{width:40px;height:40px;border-radius:20px;display:grid;place-items:center;background:${S2};flex:none}
        .ic28{width:28px;height:28px;border-radius:14px;flex:none;display:grid;place-items:center}
        .ic64{width:64px;height:64px;flex:none;border-radius:32px;display:grid;place-items:center}
        .kv{display:flex;align-items:baseline;gap:8px}.kvv{font-size:34px;font-weight:300;line-height:1}.kvu{font-size:13px;color:${TM}}
        .kv2{display:flex;align-items:center;gap:8px}.kv2t{font-size:28px;font-weight:300;line-height:1}
        .spk{width:100%;height:92px;overflow:visible;display:block}.spk.sm{height:56px}.spk.fill{flex:1;min-height:76px;height:auto}
        .ticks{display:flex;justify-content:space-between;font-size:11px;color:${T3}}
        .bars{display:flex;align-items:flex-end;gap:3px;height:52px}.bars>span{flex:1;min-width:0}.bars.nil{background:linear-gradient(transparent calc(100% - 2px), ${S3} 0)}
        .bars-big .bars{height:96px}
        .brow{display:flex;gap:8px;flex-wrap:wrap}
        .cta{height:44px;padding:0 24px;border-radius:22px;font-size:14px;font-weight:600;color:${INK};background:${GRAD}}
        .cta.self{align-self:flex-start}.cta.armed{background:${RD}}
        .cta:hover{filter:brightness(1.06)}
        .sec{height:44px;padding:0 20px;border-radius:22px;font-size:13px;font-weight:500;background:${S2};color:${T}}
        .kio{display:flex;align-items:center;gap:10px;padding-top:10px;border-top:1px solid var(--ki-line, rgb(250 250 250 / .08))}
        .t3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
        .tile{display:flex;flex-direction:column;gap:4px;padding:10px;border-radius:16px;background:${S2};min-width:0}
        .tl{font-size:11px;color:${T2}}.tv{font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .plist,.zl,.rlist,.rbl,.evs{display:flex;flex-direction:column;gap:6px}.rlist{gap:8px}.rbl{gap:8px}
        .prow{display:flex;align-items:center;gap:10px;min-width:0}.pn{flex:1;font-size:13px}
        .av{width:28px;height:28px;border-radius:14px;flex:none;display:grid;place-items:center;font-size:12px;font-weight:600;color:${INK};background:var(--ki-ctrl, #555)}
        .av.on{background:${GRAD}}
        .rk{display:flex;flex-direction:column;gap:8px;padding:12px 14px;border-radius:20px;background:${S2};text-align:left;color:${T}}
        .rkh{display:flex;align-items:baseline;gap:8px;width:100%}.rkn{flex:1;font-size:13px;font-weight:500}.rkt{font-size:19px;font-weight:300}
        .tr{display:flex;height:6px;width:100%;border-radius:3px;background:${S3};overflow:hidden}.tr>span{height:100%;border-radius:3px}
        .tr.big{height:8px;border-radius:4px}
        .rb40{width:40px;height:40px;border-radius:20px;display:grid;place-items:center;background:${S2};color:${T};flex:none}
        .rb40:disabled,.sg:disabled,.am:disabled{opacity:.45}
        .seg{display:flex;gap:6px;flex-wrap:wrap}
        .sg{height:34px;padding:0 14px;border-radius:17px;font-size:12px;font-weight:500;background:${S2};color:${T}}
        .sg.on{background:${GRAD};color:${INK}}
        .hilo{display:flex;flex-direction:column;gap:2px;text-align:right;font-size:13px}
        .chiprow{display:flex;flex-wrap:wrap;gap:6px}
        .dchip{display:flex;align-items:center;gap:6px;height:32px;padding:0 12px;border-radius:16px;background:${S2};white-space:nowrap;font-size:13px;font-weight:500}
        .fc{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:4px;padding:10px 4px 0;border-top:1px solid var(--ki-line, rgb(250 250 250 / .08))}
        .fch{display:grid;grid-template-rows:14px 20px 16px 14px;justify-items:center;align-items:center;gap:4px;min-width:0}
        .rbar{display:flex;align-items:flex-end;height:14px;width:6px}.rbar>span{width:100%;border-radius:3px;background:color-mix(in srgb, ${BL} 75%, transparent)}
        .zone{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:14px;background:${S2};text-align:left;color:${T};min-width:0}
        .zone.big{padding:12px;border-radius:18px}
        .zn{flex:1;font-size:13px}
        .pill{padding:3px 9px;border-radius:11px;font-size:11px;font-weight:500;white-space:nowrap;flex:none}
        .foot{display:flex;align-items:center;gap:6px;font-size:12px;color:${TM}}
        .leg{display:flex;gap:14px;font-size:11px;color:${TM}}.leg span{display:flex;align-items:center;gap:5px}.leg i{width:10px;height:3px;border-radius:2px}
        .alrow{display:flex;align-items:center;gap:14px}
        .amodes{display:flex;flex-direction:column;gap:6px}
        .am{display:flex;align-items:center;gap:10px;height:46px;padding:0 14px;border-radius:23px;font-size:13px;font-weight:500;background:${S2};color:${T};transition:background .2s}
        .am span{flex:1;text-align:left}.am.on{background:${GRAD};color:${INK}}
        .evs{gap:8px;padding-top:12px;border-top:1px solid var(--ki-line, rgb(250 250 250 / .08))}
        .evr{display:flex;align-items:center;gap:10px;min-width:0}.evn{flex:1;font-size:12px}
        .cams{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
        .cam{display:flex;flex-direction:column;gap:6px;text-align:left;min-width:0;color:${T}}
        .cimg{display:grid;place-items:center;width:100%;height:112px;border-radius:14px;overflow:hidden;background:#2f2f2f;color:#979797} /* ki-hex-ok (kameraplassholder) */
        .cimg img{width:100%;height:100%;object-fit:cover}
        .cn{display:flex;align-items:center;gap:5px;font-size:12px;font-weight:500;min-width:0}.cn i{width:6px;height:6px;border-radius:3px;flex:none}
        .rb{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) 60px;align-items:center;gap:10px;font-size:13px}.rb.b{grid-template-columns:minmax(0,1fr) minmax(0,1fr) 44px}
        .rv{font-size:12px;color:${T1};text-align:right}
        .none{padding:24px;color:${TM}}
        /* Rom og apper */
        .apps{flex:1;display:flex;flex-direction:column;gap:18px}
        .grp{display:flex;flex-direction:column;gap:10px}
        .gh{display:flex;align-items:center;gap:8px;padding:0 4px;font-size:13px;font-weight:600;color:${T2}}
        .agrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
        .app{display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:20px;background:${S};text-align:left;min-width:0;color:${T}}
        .aic{width:32px;height:32px;flex:none;border-radius:16px;display:grid;place-items:center}
        .an{flex:1;font-size:13px;font-weight:500}
        @media (prefers-reduced-motion: reduce){.card{animation:none}}
      `;
    }
  }
  const WXN_HVAC = (s) => ({ auto: kiT('Auto', 'Auto'), heat: kiT('Varme', 'Heat'), cool: kiT('Kjøling', 'Cool'), heat_cool: kiT('Auto', 'Auto'), dry: kiT('Tørking', 'Dry'), fan_only: kiT('Vifte', 'Fan'), off: kiT('Av', 'Off') }[s] || s);
  M.define('msh-pc-card', PC, 'MSH PC-dashbord', 'Oversikt for store skjermer (≥ 1100 px): helt-panel, faner Oversikt · Klima · Energi · Sikkerhet · Enheter · Rom og apper, popups i sidepanel, søk, Tilpass og Analyse (Fiks 64).');
})();
