/* msh-strompris-card · Hjem, «Strømpriser» (spesifikasjon punkt 14): header-rad med tittel + I dag / I morgen utenfor
 * kortflaten; kortflate med verdirad (Spot nå / valgt time · Norgespris), legende, trinnlinje-graf i øre/kWh (teal, oransje
 * over terskel, fylt område, stiplet Norgespris-linje, valgt time med bånd + prikk) og x-akse. Scrub på grafen velger time.
 * Data: MSH.powerPrice (15-strompris-kilde.js) – én felles kilde/config (ki-store `power_price`, «Tilpass Hjem» → Popups →
 * Strømpris) for kortet, prosa-boblen og strøm-sliden. Profil Norge (spot / totalpris m/ nettleie / Norgespris, kr eller
 * øre) eller Sverige (SEK, alltid kr/kWh, graf i öre, ingen Norgespris – høyre verdi = snitt). Nettleie i morgen (↑/↓ +
 * differanse) som rad under verdiene når Pris som vises = Norgespris/Totalpris. Fane «I dag / I morgen»: standard utseende (glassflate
 * bare med stil glass + Liquid Glass-tema), alltid Liquid Glass-drag; tekststørrelse/høyde/bredde fra power_price.tab. Kortets YAML: threshold, show_norgespris (+ valgfritt
 * power_price / gamle entity, norgespris_entity, norgespris som grunnlag under ki-store). GUI-editoren viser samme
 * power_price-felt (msh-strompris-editor) og skriver dem til ki-store. Mangler data → «–» og tom graf (bare rutenettet).
 */
(function () {
  const M = window.MSH, esc = M.esc;
  const hh = (h) => String(h).padStart(2, '0');

  /* ------------------------------------------------------------ kort */
  const TEAL = 'oklch(0.78 0.13 175)', ORANGE = 'oklch(0.74 0.17 55)', PINK = 'oklch(0.78 0.13 350)';
  const VW = 480, VH = 150, PT = 6, PB = 6; // viewBox + innrykk topp/bunn for rutenettet
  const num = (v) => (v === '' || v == null || isNaN(Number(v)) ? null : Number(v));
  // «Pen» y-skala med 5 verdier (4 steg) som dekker lo..hi.
  const scale = (lo, hi) => {
    if (!(hi > lo)) hi = lo + 100;
    const raw = (hi - lo) / 4, p = Math.pow(10, Math.floor(Math.log10(raw)));
    for (const m of [1, 2, 2.5, 3, 4, 5, 6, 8, 10, 20]) {
      const st = m * p, y0 = Math.floor(lo / st) * st;
      if (y0 + 4 * st >= hi - 1e-9) return { y0, st };
    }
    return { y0: lo, st: raw };
  };

  const GREEN = 'var(--green, rgb(102 209 158))', RED = 'var(--red, rgb(242 128 115))';
  const avg = (a) => { const v = (a || []).filter((x) => x != null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
  // Nettleie i morgen: pil, farge og tekst (null når i morgen-data mangler)
  M.gridTrend = function (P) {
    const g = P && P.grid;
    if (!g || g.diff == null) return null;
    const d = g.diff, up = d > 0.005, dn = d < -0.005;
    const sign = up ? '+' : dn ? '−' : '±';
    const abs = Math.abs(d), txt = P.unit === 'øre/kWh' ? `${sign}${M.nf(abs * 100, 1)} øre/kWh` : `${sign}${M.nf(abs, 2)} kr/kWh`;
    return { arrow: up ? '↑' : dn ? '↓' : '→', color: up ? RED : dn ? GREEN : '#979797', text: txt, diff: d, today: g.todayAvg, tomorrow: g.tomorrowAvg };
  };
  // Fanen «I dag / I morgen» (kortet og forhåndsvisningen i editoren): { style, font, height, padding }
  // Fiks 15.2: standard utseende (spor #2f2f2f, rosa aktiv pille, ingen blur/glasskant) uavhengig av temaet.
  // «Stil» styrer bare utseendet: glass = glassflate KUN når Liquid Glass-temaet er på (MSH.tabSurface-variablene).
  // Liquid Glass-drag-effekten (data-glass-drag, MSH.glassDrag: linse/strekk ved trykk og dra) er alltid på.
  M.powerTabHTML = function (tab, isToday, hasM, attrs) {
    const t = tab || {}, glass = t.style === 'glass';
    return `<div class="seg ${glass ? 'glass' : 'std'}" role="tablist" data-glass-drag="x" ${attrs || ''}>${[['today', 'I dag', true], ['tomorrow', 'I morgen', hasM]].map(([k, l, ok]) => {
      const on = (k === 'today') === isToday;
      return `<button class="sg ${on ? 'on' : ''}" role="tab" aria-selected="${on}" ${on ? 'data-active="1"' : ''} data-act="day" data-d="${k}" ${ok ? '' : 'title="Prisene for i morgen kommer ca. kl. 13:00"'}>${l}</button>`;
    }).join('')}</div>`;
  };
  M.powerTabCSS = (t) => {
    const h = t.height, f = t.font, p = t.padding;
    return `.seg{display:flex;gap:2px;padding:4px;border-radius:${h / 2 + 4}px;flex:none;position:relative;touch-action:pan-y;background:var(--gray100,#2f2f2f);backdrop-filter:none;-webkit-backdrop-filter:none;box-shadow:none}
      .seg.glass{${M.tabSurface ? M.tabSurface('var(--gray100,#2f2f2f)', 'none') : ''}}
      .sg{height:${h}px;padding:0 ${p}px;border-radius:${h / 2}px;font-size:${f}px;font-weight:400;white-space:nowrap;color:var(--gray800,#afafaf);background:transparent;transition:background .25s,color .25s,opacity .25s}
      .sg.on{background:${M.C.accent};color:var(--gray100,#2f2f2f)}
      .sg:disabled{opacity:.4;cursor:default}`;
  };

  class Strompris extends M.Card {
    static get cardName() { return 'Hjem · strømpriser'; }
    static get defaults() { return { show_norgespris: true }; }
    static getConfigElement() { const e = document.createElement(customElements.get('msh-strompris-editor') ? 'msh-strompris-editor' : 'msh-editor'); e.cardClass = this; return e; }
    // Samme felt som «Tilpass Hjem» → Popups → Strømpris (power_price.* lagres i ki-store av msh-strompris-editor)
    static get schema() {
      return (h, c) => {
        const pp = { ...M.POWER_PRICE_DEF, ...(c.power_price || {}) }, se = pp.profile === 'se';
        const P = h ? M.powerPrice(h, M.powerPriceCfg({}, c.power_price || {})) : null;
        const pf = (n) => 'power_price.' + n;
        const areas = [['', 'Auto'], ...M.POWER_AREAS[se ? 'se' : 'no'].map((a) => [a, a])];
        const tr = P ? M.gridTrend(P) : null;
        return [
          { type: 'section', id: 'kilde', label: 'Strømpris-kilde', icon: 'mdi:flash', open: true, meta: () => (se ? 'Sverige' : 'Norge'), fields: [
            { type: 'select', name: pf('profile'), label: 'Profil', options: [['no', 'Norge'], ['se', 'Sverige']], default: 'no' },
            { type: 'select', name: pf('source'), label: 'Kilde', options: [['', 'Auto'], ...M.POWER_SOURCES.filter((x) => !se || x[0] !== 'strompris')], default: '' },
            se
              ? { type: 'entity', name: pf('se_entity'), label: 'Nord Pool-sensor (SEK)', domain: 'sensor', auto: (hh) => M.powerPriceAuto(hh, M.powerPriceCfg({}, { ...(c.power_price || {}), se_entity: '' })) }
              : { type: 'entity', name: pf('spot_entity'), label: 'Spotpris-sensor', domain: 'sensor', auto: (hh) => M.powerPriceAuto(hh, M.powerPriceCfg({}, { ...(c.power_price || {}), spot_entity: '' })) },
            { type: 'select', name: pf(se ? 'se_area' : 'area'), label: se ? 'Elområde' : 'Prisområde', options: areas, default: '' },
            ...(se ? [{ type: 'select', name: pf('se_unit'), label: 'Sensorens enhet', options: [['auto', 'Automatisk'], ['ore', 'öre'], ['kr', 'kr']], default: 'auto', help: 'Vises alltid som kr/kWh' }] : [
              { type: 'entity', name: pf('norgespris_entity'), label: 'Norgespris-sensor', domain: 'sensor', auto: (hh) => M.norgesprisAuto(hh) },
              { type: 'number', name: pf('norgespris'), label: 'Norgespris uten sensor (kr/kWh)', step: 0.01, placeholder: '0.50' },
            ]),
            { type: 'entity', name: pf('grid_entity'), label: 'Nettleie-sensor (valgfri, today/tomorrow)', domain: 'sensor', auto: () => '' },
            { type: 'select', name: pf('mode'), label: 'Pris som vises', options: se ? [['spot', 'Spotpris'], ['total', 'Totalpris m/ nettleie']] : [['spot', 'Spotpris'], ['total', 'Totalpris m/ nettleie'], ['norgespris', 'Norgespris']], default: 'spot' },
            ...(se ? [] : [{ type: 'select', name: pf('unit'), label: 'Enhet', options: [['kr', 'kr/kWh'], ['ore', 'øre/kWh']], default: 'kr' }]),
            { type: 'info', label: P ? P.status + (tr ? ` · nettleie i morgen ${tr.arrow} ${tr.text}` : '') : '' },
          ] },
          { type: 'section', id: 'fane', label: 'Fane «I dag / I morgen»', icon: 'mdi:tab', fields: [
            { type: 'select', name: pf('tab.style'), label: 'Stil', options: [['standard', 'Standard'], ['glass', 'Liquid glass']], default: 'standard', help: 'Liquid glass-flaten vises bare med Liquid Glass-temaet. Dra-effekten er alltid på.' },
            { type: 'range', name: pf('tab.font'), label: 'Tekststørrelse', min: 11, max: 18, default: 14, presets: [[12, 'Liten'], [14, 'Standard'], [16, 'Stor']] },
            { type: 'range', name: pf('tab.height'), label: 'Høyde', min: 24, max: 48, default: 30, presets: [[26, 'Lav'], [30, 'Standard'], [38, 'Høy']] },
            { type: 'range', name: pf('tab.padding'), label: 'Bredde (sidemarg per knapp)', min: 8, max: 40, default: 20, presets: [[12, 'Smal'], [20, 'Standard'], [30, 'Bred']] },
          ] },
          { type: 'section', id: 'kort', label: 'Graf', icon: 'mdi:chart-line', fields: [
            { type: 'number', name: 'threshold', label: 'Oransje linje over (kr/kWh)', step: 0.05, placeholder: se ? 'snitt' : 'Norgespris', help: 'Tomt = referanselinjen (Norgespris) / snitt i Sverige' },
            ...(se ? [] : [{ type: 'boolean', name: 'show_norgespris', label: 'Vis referanselinje (Norgespris / spot)', default: true }]),
          ] },
        ];
      };
    }
    get cardSize() { return 5; }
    // Kortets tannhjul / «Velg entitet» → «Tilpass Hjem» → Popups → Strømpris
    customize(focus) {
      if (M.openHomeEditor && M.popupsPanel) {
        const ed = M.openHomeEditor({ focus: 'pop' });
        if (ed && ed.u) { ed.u.pv = 'strom'; ed.u.pd = null; ed.render(); return ed; }
      }
      return super.customize(focus);
    }
    render() {
      const c = this.config, ui = this.ui;
      const P = M.powerPrice(this.hass, M.powerPriceCfg(this._rawConfig || c), this);
      const se = P.profile === 'se', st = P.state;
      const hasT = P.hasToday, hasM = P.hasTomorrow;
      // Fiks 20.10: «I morgen» virker alltid (også før Nord Pool publiserer ca. kl. 13) – valget ligger på instansen (this._ui)
      // og beholdes ved hass-oppdateringer; uten data vises tom graf + «Prisene for i morgen kommer ca. kl. 13:00».
      const isToday = ui.day !== 'tomorrow';
      const ser = isToday ? P.today : P.tomorrow, has = isToday ? hasT : hasM;
      const refSer = P.ref && c.show_norgespris !== false ? (isToday ? P.ref.today : P.ref.tomorrow) : null;
      const showRef = !se && !!refSer;
      const nowH = new Date().getHours();
      const scrub = ui.sel != null && has;
      const sel = scrub ? ui.sel : isToday && has ? nowH : null;
      const ML = { spot: 'Spot', total: 'Totalpris', norgespris: 'Norgespris' }[P.mode];
      const srcL = (M.POWER_SOURCES.find((x) => x[0] === P.source) || [0, ''])[1];
      const dayL = isToday ? 'i dag' : 'i morgen';

      // Verdirad (valgt enhet)
      let label, val;
      if (scrub) { label = isToday ? `${ML} ${dayL} kl. ${hh(sel)}` : `I morgen kl. ${hh(sel)}–${hh(sel + 1)}`; val = ser[sel]; }
      else if (isToday) { label = `${ML} nå`; val = P.now != null ? P.now : ser[nowH]; }
      else { label = `${ML} snitt i morgen`; val = avg(ser); }
      let rLabel, rVal;
      if (se) { rLabel = `Snitt ${dayL}`; rVal = avg(ser); }
      else if (!isToday && !scrub) { const m = P.cheapest({ day: 'tomorrow' }); rLabel = m ? `Billigst kl. ${hh(m.h)}–${hh(m.h + 1)}` : 'Billigst i morgen'; rVal = m ? m.v : null; }
      else if (showRef) { rLabel = P.ref.label; rVal = scrub ? refSer[sel] : isToday ? P.ref.now : avg(refSer); }
      const tr = !se && (P.mode === 'norgespris' || P.mode === 'total') ? M.gridTrend(P) : null;

      // Graf (øre/öre per kWh)
      const ore = ser.map((v) => (v == null ? null : v * 100)), vals = ore.filter((v) => v != null);
      const refO = showRef ? refSer.map((v) => (v == null ? null : v * 100)) : null, refVals = refO ? refO.filter((v) => v != null) : [];
      const thrKr = num(c.threshold) != null ? num(c.threshold) : showRef && P.ref.now != null ? P.ref.now : avg(P.today);
      const thrO = thrKr != null ? thrKr * 100 : Infinity;
      const lo = Math.min(0, ...vals, ...refVals), hi = vals.length ? Math.max(...vals, ...refVals) * 1.05 : 100;
      const { y0, st: step } = scale(lo, hi), span = 4 * step;
      const Y = (v) => PT + (1 - (v - y0) / span) * (VH - PT - PB);
      const X = (h) => (h * VW) / 24;
      const f1 = (n) => Math.round(n * 10) / 10;
      const ticks = [0, 1, 2, 3, 4].map((i) => y0 + i * step);
      const base = f1(Y(Math.max(y0, Math.min(0, y0 + span))));
      const stepPath = (arr, withFill) => {
        let line = '', fill = '', run = false;
        arr.forEach((v, h) => {
          if (v == null) { if (run && withFill) fill += `V${base}Z`; run = false; return; }
          const y = f1(Y(v));
          if (!run) { run = true; line += `M${f1(X(h))} ${y}`; fill += `M${f1(X(h))} ${base}V${y}`; } else { line += `V${y}`; fill += `V${y}`; }
          line += `H${f1(X(h + 1))}`; fill += `H${f1(X(h + 1))}`;
        });
        if (run && withFill) fill += `V${base}Z`;
        return { line, fill };
      };
      const main = stepPath(ore, true), refP = refO && refVals.length ? stepPath(refO, false).line : '';
      const tOff = M.clamp((thrO === Infinity ? 0 : Y(thrO)) / VH, 0, 1).toFixed(4);
      const grid = ticks.map((v) => `<line x1="0" x2="${VW}" y1="${f1(Y(v))}" y2="${f1(Y(v))}" class="gl"/>`).join('');
      const gid = 'sp' + (this._gid || (this._gid = Math.random().toString(36).slice(2, 8)));
      const svg = `<svg viewBox="0 0 ${VW} ${VH}" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="${gid}s" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${VH}"><stop offset="0" stop-color="${ORANGE}"/><stop offset="${tOff}" stop-color="${ORANGE}"/><stop offset="${tOff}" stop-color="${TEAL}"/><stop offset="1" stop-color="${TEAL}"/></linearGradient>
          <linearGradient id="${gid}f" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${VH}"><stop offset="0" stop-color="${ORANGE}" stop-opacity="0.28"/><stop offset="${tOff}" stop-color="${ORANGE}" stop-opacity="0.12"/><stop offset="${tOff}" stop-color="${TEAL}" stop-opacity="0.14"/><stop offset="1" stop-color="${TEAL}" stop-opacity="0"/></linearGradient>
        </defs>
        ${grid}
        ${has ? `<path class="fill" d="${main.fill}" fill="url(#${gid}f)"/>
        <path class="spot" d="${main.line}" stroke="url(#${gid}s)"/>
        ${refP ? `<path class="np" d="${refP}"/>` : ''}` : ''}
      </svg>`;
      let marker = '';
      if (sel != null && ore[sel] != null) {
        const col = ore[sel] > thrO ? ORANGE : TEAL, top = (Y(ore[sel]) / VH) * 100, left = ((sel + 0.5) / 24) * 100;
        marker = `<span class="band" style="left:${((sel / 24) * 100).toFixed(3)}%"></span>
          <span class="halo" style="left:${left.toFixed(3)}%;top:${top.toFixed(2)}%;background:color-mix(in oklch, ${col} 30%, transparent)"></span>
          <span class="dot" style="left:${left.toFixed(3)}%;top:${top.toFixed(2)}%;background:${col}"></span>`;
      }
      const yax = ticks.map((v) => `<span style="top:${((Y(v) / VH) * 100).toFixed(2)}%">${M.nf(v, step % 1 ? 1 : 0)}</span>`).join('');
      const xax = [0, 4, 8, 12, 16, 20, 24].map((h) => `<span style="left:${((h / 24) * 100).toFixed(3)}%">${hh(h)}</span>`).join('');
      const mainLeg = P.mode === 'spot' ? `${srcL && P.source !== 'custom' ? srcL + ' ' : ''}spot${se && P.area ? ' ' + P.area : ''}` : P.mode === 'total' ? 'Totalpris m/ nettleie' : 'Norgespris';
      const uS = `<small> ${P.unit}</small>`;
      return `<div class="sp" data-ent="__energi">
        <div class="hdr">
          <span class="ttl ell">Strømpriser</span>
          ${M.powerTabHTML(P.cfg.tab, isToday, hasM)}
        </div>
        <div class="srf">
          <div class="vr">
            <div class="vc" ${P.entity ? `data-ent="${esc(P.entity)}"` : ''}>
              <span class="lb">${esc(label)}</span>
              <span class="v num">${P.val(val)}${uS}</span>
            </div>
            ${rLabel ? `<div class="vc r" ${!se && P.norgespris && P.norgespris.entity && P.mode !== 'norgespris' ? `data-ent="${esc(P.norgespris.entity)}"` : ''}>
              <span class="lb">${esc(rLabel)}</span>
              <span class="v num ${se ? '' : 'np'}">${P.val(rVal)}${uS}</span>
            </div>` : ''}
          </div>
          ${tr ? `<div class="gt" data-ent="${esc(P.grid.entity)}"><span class="lb">Nettleie i morgen</span><span class="ar" style="color:${tr.color}">${tr.arrow}</span><span class="gd num" style="color:${tr.color}">${esc(tr.text)}</span><span class="gs num">snitt ${P.val(tr.today)} → ${P.val(tr.tomorrow)}</span></div>` : ''}
          <div class="lg"><span class="li"><i style="background:${TEAL}"></i>${esc(mainLeg)}</span>${showRef ? `<span class="li"><i class="dash"></i>${esc(P.ref.label)}</span>` : ''}<span class="unit">${P.graphUnit}</span></div>
          <div class="gr">
            <div class="ya num">${yax}</div>
            <div class="plot" role="img" aria-label="${esc(ML)} per time ${dayL} i ${P.graphUnit}">${svg}${marker}
              ${st && !has && !isToday ? '<span class="tmr-note">Prisene for i morgen kommer ca. kl. 13:00</span>' : ''}
              ${st ? '' : `<button class="pick" data-act="customize" data-section="kilde">${M.icon('mdi:plus', 18)}Velg entitet</button>`}</div>
          </div>
          <div class="xa num">${xax}</div>
        </div>
      </div>`;
    }
    // 21.1: hold på kortet (også på pris-verdiene) åpner Energi-popupen
    onHold() { M.openPopup('#energi'); return true; }
    onAction(name, el, ev) {
      if (name === 'day') return this.setUI({ day: el.dataset.d, sel: null }); // haptic light kommer fra _onClick
      return super.onAction(name, el, ev);
    }
    afterRender() {
      // Liquid Glass-drag alltid (Fiks 15.2) – touch-action pan-y + stopPropagation ligger i glassDrag (fallgruve 2)
      const seg = this.shadowRoot.querySelector('.seg');
      if (seg && M.glassDrag) M.glassDrag(seg, { axis: 'x' });
      const p = this.shadowRoot.querySelector('.plot');
      if (!p || p.__sc) return;
      p.__sc = true;
      M.guardDrag(p, 'x'); // touch-action: pan-y + stopPropagation (Bubble Card swipe-to-close)
      let down = false;
      const pick = (e) => {
        const r = p.getBoundingClientRect();
        if (!r.width || !p.querySelector('path.spot')) return;
        const h = M.clamp(Math.floor(((e.clientX - r.left) / r.width) * 24), 0, 23);
        if (h !== this.ui.sel) { M.haptic('selection'); this.setUI({ sel: h }); }
      };
      const reset = () => { down = false; if (this.ui.sel != null) this.setUI({ sel: null }); };
      p.addEventListener('pointerdown', (e) => {
        if (e.button || (e.target.closest && e.target.closest('button'))) return;
        down = true;
        try { p.setPointerCapture(e.pointerId); } catch (x) { /* */ }
        pick(e);
      });
      p.addEventListener('pointermove', (e) => { if (down || e.pointerType === 'mouse') pick(e); });
      p.addEventListener('pointerup', reset);
      p.addEventListener('pointercancel', reset);
      p.addEventListener('pointerleave', reset);
    }
    get styles() {
      const t = M.powerPriceCfg(this._rawConfig || this.config).tab;
      return `
        .sp{display:flex;flex-direction:column;gap:12px}
        .hdr{display:flex;align-items:center;justify-content:space-between;gap:10px;min-width:0}
        .ttl{min-width:0;font-size:18px;font-weight:500}
        ${M.powerTabCSS(t)}
        .srf{display:flex;flex-direction:column;gap:12px;padding:18px 16px;border-radius:28px;background:#303030}
        .vr{display:flex;justify-content:space-between;align-items:flex-end;gap:12px}
        .vc{display:flex;flex-direction:column;gap:4px;min-width:0}
        .vc.r{align-items:flex-end;text-align:right}
        .lb{font-size:12px;color:#8e8d89;white-space:nowrap}
        .v{font-size:28px;font-weight:300;letter-spacing:-0.025em;line-height:1.05;white-space:nowrap}
        .v small{font-size:13px;letter-spacing:0;color:#8e8d89}
        .v.np{color:${PINK}}
        .gt{display:flex;align-items:baseline;gap:6px;min-width:0;padding:8px 12px;border-radius:14px;background:rgba(255,255,255,0.04);white-space:nowrap}
        .gt .ar{font-size:15px;font-weight:600;line-height:1}
        .gt .gd{font-size:13px;font-weight:500}
        .gt .gs{margin-left:auto;font-size:11px;color:#6d6c69;overflow:hidden;text-overflow:ellipsis}
        .lg{display:flex;align-items:center;gap:14px;padding-left:26px;font-size:11px;color:#8e8d89;white-space:nowrap;min-width:0}
        .li{display:inline-flex;align-items:center;gap:6px;min-width:0}
        .li i{display:block;width:14px;height:2.5px;border-radius:2px;flex:none}
        .li i.dash{background:repeating-linear-gradient(90deg, ${PINK} 0 5px, transparent 5px 8px)}
        .unit{margin-left:auto;color:#6d6c69}
        .gr{display:flex;gap:6px;height:150px}
        .ya{position:relative;flex:none;width:20px;font-size:9px;color:#6d6c69}
        .ya span{position:absolute;right:0;transform:translateY(-50%);line-height:1;white-space:nowrap}
        .plot{position:relative;flex:1;min-width:0;height:150px;cursor:crosshair;touch-action:pan-y;user-select:none;-webkit-user-select:none}
        .plot svg{position:absolute;inset:0;width:100%;height:100%;display:block;overflow:visible}
        .plot svg *{vector-effect:non-scaling-stroke}
        .gl{stroke:rgba(255,255,255,0.07);stroke-width:1}
        .spot{fill:none;stroke-width:2.5;stroke-linejoin:round;stroke-linecap:round}
        .np{fill:none;stroke:${PINK};stroke-width:2;stroke-dasharray:5 4}
        .band{position:absolute;top:0;bottom:0;width:calc(100% / 24);border-radius:4px;background:rgba(255,255,255,0.12);pointer-events:none;transition:left .15s}
        .halo,.dot{position:absolute;border-radius:50%;transform:translate(-50%,-50%);pointer-events:none;transition:left .15s,top .15s,background .15s}
        .halo{width:34px;height:34px}
        .dot{width:14px;height:14px;box-shadow:0 0 0 3px #303030}
        .pick{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%)}
        .tmr-note{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);max-width:90%;text-align:center;font-size:13px;color:#8e8d89;pointer-events:none}
        .xa{position:relative;height:11px;margin-left:26px;font-size:9px;color:#6d6c69}
        .xa span{position:absolute;top:0;transform:translateX(-50%);line-height:11px}
        .xa span:first-child{transform:none}
        .xa span:last-child{transform:translateX(-100%)}
      `;
    }
  }
  M.define('msh-strompris-card', Strompris, 'MSH Hjem · strømpriser', 'Strømpris nå og per time i dag / i morgen (Norge: spot, totalpris eller Norgespris; Sverige: SEK i kr/kWh), nettleie i morgen og referanselinje. Dra på grafen for å se en time.');

  /* ------------------------------------------------------------ GUI-editor: power_price.* → ki-store (én felles config) */
  const Base = customElements.get('msh-editor');
  if (Base && !customElements.get('msh-strompris-editor')) {
    const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
    const setIn = (o, p, v) => {
      const ks = String(p).split('.'), root = { ...(o || {}) };
      let cur = root;
      ks.forEach((k, i) => {
        if (i === ks.length - 1) { if (v === undefined || v === null || v === '') delete cur[k]; else cur[k] = v; }
        else { cur[k] = isObj(cur[k]) ? { ...cur[k] } : {}; cur = cur[k]; }
      });
      return root;
    };
    class StromprisEditor extends Base {
      connectedCallback() {
        if (super.connectedCallback) super.connectedCallback();
        if (M.store && !this._ppOff) this._ppOff = M.store.subscribe((d, path) => { if (this._ppSaving || !this._config) return; if (!path || String(path).startsWith('power_price')) { this._config = this._withStore(this._config); this._render(); } });
      }
      disconnectedCallback() { if (this._ppOff) { this._ppOff(); this._ppOff = null; } }
      _withStore(c) { const st = M.store && M.store.get('power_price'); return { ...c, power_price: { ...(isObj(c.power_price) ? c.power_price : {}), ...(isObj(st) ? st : {}) } }; }
      setConfig(c) { super.setConfig(c); this._config = this._withStore(this._config || {}); this._render(); }
      _set(path, v, commit = true) {
        if (!String(path).startsWith('power_price.')) {
          const { power_price, ...rest } = this._config || {};
          this._config = rest;
          super._set(path, v, commit);
          this._config = this._withStore(this._config);
          return this._render();
        }
        const sub = String(path).slice('power_price.'.length);
        let pp = setIn((M.store && M.store.get('power_price')) || {}, sub, typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v) && /norgespris$|tab\./.test(sub) ? Number(v) : v);
        if (isObj(pp.tab) && !Object.keys(pp.tab).length) delete pp.tab;
        this._config = { ...this._config, power_price: pp };
        if (commit !== false && M.store) {
          this._ppSaving = true;
          try { if (this._hass) M.store.load(this._hass); M.store.set('power_price', Object.keys(pp).length ? pp : undefined); } finally { this._ppSaving = false; }
        }
        this._render();
      }
    }
    customElements.define('msh-strompris-editor', StromprisEditor);
  }
})();
