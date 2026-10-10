/* KI MSH · «Tilpass Hjem» → Popups → Strømpris (fiks-4 punkt 5–6). Ark for den felles strømpris-kilden
 * (MSH.powerPrice, 15-strompris-kilde.js). Kobles inn i Popups-panelet (28-popup-editor.js) som visningen u.pv = 'strom'
 * via MSH.powerPricePanel { render, act, input, after }.
 *   Profil (segment, glass-dra alltid) Norge · Sverige
 *   Norge:   kilde (Nord Pool · Tibber · Strømpris · Egen sensor), spotpris-sensor (msh-entity-picker, forslag for kilde/område),
 *            prisområde NO1–NO5, Norgespris-sensor + fast sats, nettleie-sensor (+ forhåndsvisning av nettleie i morgen),
 *            pris som vises (Spot · Totalpris m/ nettleie · Norgespris), enhet (kr/øre)
 *   Sverige: kilde (Nord Pool · Tibber · Egen), Nord Pool-sensor (SEK), elområde SE1–SE4, sensorens enhet (auto · öre · kr),
 *            nettleie, pris som vises (Spot · Totalpris) – alltid kr/kWh, ingen Norgespris
 *   Fane «I dag / I morgen»: Standard · Liquid glass (bare utseendet; glassflate kun med temaet, drag alltid), tekststørrelse 11–18, høyde 24–48, bredde 8–40 med live forhåndsvisning
 *   Statuslinje: «sensor.x · 24 timer i dag, 24 i morgen» / «Mangler i morgen-priser» / feil i rødt.
 * Lagres med MSH.store.set('power_price', …) i «Tilpass Hjem»-utkastet (MSH.store.transaction) – kortet, prosa-boblen
 * og sliden oppdateres straks (store.subscribe); til HA sendes det først ved Ferdig i Tilpass Hjem (fiks 15.13).
 */
(function () {
  const M = window.MSH;
  if (!M || M.powerPricePanel) return;
  const esc = M.esc, C = M.C;
  const ic = (n, s, st) => M.icon(n, s || 20, st || '');
  const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
  const cur = () => { const v = M.store && M.store.get('power_price'); return isObj(v) ? v : {}; };
  // patch: { felt: verdi } ('' / undefined / null = fjern); tab.* flettes
  function save(ed, patch) {
    let o = { ...cur() };
    Object.keys(patch).forEach((k) => {
      const v = patch[k];
      if (k.startsWith('tab.')) {
        const t = { ...(isObj(o.tab) ? o.tab : {}) }, f = k.slice(4);
        if (v === '' || v == null) delete t[f]; else t[f] = v;
        if (Object.keys(t).length) o.tab = t; else delete o.tab;
      } else if (v === '' || v == null) delete o[k];
      else o[k] = v;
    });
    if (ed && ed.hass) M.store.load(ed.hass);
    M.store.set('power_price', Object.keys(o).length ? o : undefined);
  }

  const CSS = `
    .pw{display:flex;flex-direction:column;gap:12px}
    .pw .pphd{display:flex;align-items:center;gap:8px}
    .pw .pphd .t{flex:1;min-width:0;font-size:17px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .pwc{display:flex;flex-direction:column;gap:10px;padding:14px;border-radius:24px;background:var(--ki-surface, var(--gray200,#3a3a3a))}
    .pwh{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;color:var(--ki-text, #fafafa)}
    .pwh i{margin-left:auto;font-style:normal;font-size:11px;font-weight:400;color:var(--ki-text-3, #7f7f7f)}
    .pwl{font-size:12px;color:var(--ki-text-mid, #979797)}
    .pwseg{display:flex;gap:2px;padding:3px;border-radius:20px;background:var(--ki-bg, var(--gray000,#232323));touch-action:pan-y;position:relative;overflow:hidden}
    .pwseg>button{flex:1;min-width:0;height:34px;padding:0 8px;border-radius:17px;font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--ki-text-2, #afafaf);transition:background .2s,color .2s}
    .pwseg>button.on{background:${C.accent};color:var(--ki-on-accent, #2f2f2f)}
    .pwseg.gl{background:${M.theme.blackA(0.25)};box-shadow:inset 0 0 0 .5px ${M.theme.whiteA(0.1)}}
    .pwseg.gl>button{color:var(--ki-text-2, rgba(255,255,255,0.62))}
    .pwseg.gl>button.on{${M.GLASS_BUBBLE || `background:${M.theme.whiteA(0.2)};color:var(--ki-text, #fafafa);`}}
    .pwchips{display:flex;flex-wrap:wrap;gap:6px}
    .pwchips>button{height:30px;padding:0 12px;border-radius:15px;background:var(--ki-bg, var(--gray000,#232323));font-size:12px;font-weight:500;color:var(--ki-text-1, #c7c7c7);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .pwchips>button.on{background:var(--ki-pill-bg, #fafafa);color:var(--ki-pill-fg, #282828)}
    .pwsug{display:flex;flex-direction:column;gap:4px}
    .pwsug>button{display:flex;align-items:center;gap:8px;min-height:40px;padding:4px 10px;border-radius:12px;background:var(--ki-bg, var(--gray000,#232323));text-align:left;width:100%}
    .pwsug>button b{flex:1;min-width:0;font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .pwsug>button span{font-size:11px;color:var(--ki-text-mid, #979797);white-space:nowrap;font-variant-numeric:tabular-nums}
    .pwsug>button.on{box-shadow:inset 0 0 0 1.5px ${C.accent}}
    .pwin{height:40px;border-radius:12px;padding:0 12px;background:var(--ki-bg, var(--gray000,#232323));color:var(--ki-text, #fafafa);font-size:15px;width:100%;min-width:0}
    .pwrow{display:flex;align-items:center;gap:10px}
    .pwrow .pwl{flex:1}
    .pwrg{display:flex;flex-direction:column;gap:4px}
    .pwrg .pwrow b{font-size:13px;font-weight:500;font-variant-numeric:tabular-nums}
    .pwrg input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:28px;background:transparent;touch-action:pan-y;cursor:pointer}
    .pwrg input[type=range]::-webkit-slider-runnable-track{height:6px;border-radius:3px;background:var(--ki-ctrl, #545454)}
    .pwrg input[type=range]::-moz-range-track{height:6px;border-radius:3px;background:var(--ki-ctrl, #545454)}
    .pwrg input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:22px;height:22px;margin-top:-8px;border-radius:11px;background:var(--ki-knob, #fafafa);box-shadow:0 2px 6px ${M.theme.blackA(0.4)}}
    .pwrg input[type=range]::-moz-range-thumb{width:22px;height:22px;border:0;border-radius:11px;background:var(--ki-knob, #fafafa)}
    .pwprev{display:flex;justify-content:flex-end;padding:14px;border-radius:18px;background:var(--ki-bg, #282828);min-height:40px}
    .pwtr{display:flex;align-items:baseline;gap:6px;padding:8px 12px;border-radius:12px;background:var(--ki-bg, var(--gray000,#232323));font-size:12px;color:var(--ki-text-mid, #979797)}
    .pwtr b{font-size:15px}
    .pwst{font-size:12px;line-height:1.4;padding:10px 12px;border-radius:14px;background:var(--ki-bg, var(--gray000,#232323));color:var(--ki-green-text, ${C.green});word-break:break-word}
    .pwst.warn{color:var(--ki-yellow-text, ${C.yellow})}
    .pwst.err{color:var(--ki-red-text, ${C.red})}
    msh-entity-picker{display:block}
  `;
  // Segmenter (Fiks 15.2): Liquid Glass-drag alltid; glass-utseendet (.gl) bare med Liquid Glass-temaet (MSH.glassOn()).
  const seg = (f, opts, val) => `<div class="pwseg ${M.glassOn && M.glassOn() ? 'gl' : ''}" data-glass-drag="x" data-key="pwseg-${f}">${opts.map(([v, l]) => `<button class="${String(v) === String(val) ? 'on' : ''}" ${String(v) === String(val) ? 'aria-selected="true" data-active="1"' : ''} data-a="pwset" data-f="${f}" data-v="${esc(v)}" data-h="selection">${esc(l)}</button>`).join('')}</div>`;
  const fmtNow = (hass, id) => (hass && hass.states[id] ? M.fmtState(hass, id) : '');

  function render(ed) {
    const hass = ed.hass, raw = cur(), c = M.powerPriceCfg(), se = c.profile === 'se';
    const P = M.powerPrice(hass, c);
    const entF = se ? 'se_entity' : 'spot_entity', entV = raw[entF] || '';
    const autoId = M.powerPriceAuto(hass, M.powerPriceCfg({}, { [entF]: '' }));
    const srcOpts = M.POWER_SOURCES.filter((x) => !se || x[0] !== 'strompris');
    const srcCur = c.source || (P.entity ? P.source : '');
    const cand = M.powerPriceCandidates(hass, c).slice(0, 4);
    const areaF = se ? 'se_area' : 'area', areas = M.POWER_AREAS[se ? 'se' : 'no'];
    const npAuto = M.norgesprisAuto(hass);
    const gridSug = M.gridCandidates(hass).filter((id) => id !== raw.grid_entity).slice(0, 3);
    const tr = M.gridTrend ? M.gridTrend(P) : null;
    const t = c.tab;
    const sug = (f, ids) => (ids.length ? `<div class="pwsug" data-key="pwsug-${f}">${ids.map((id) => `<button class="${raw[f] === id ? 'on' : ''}" data-a="pwset" data-f="${f}" data-v="${esc(id)}" data-h="selection">${ic(M.domainIcon ? M.domainIcon(id, hass.states[id]) : 'mdi:flash', 18, 'color:var(--ki-text-2, #afafaf)')}<b>${esc(M.name ? M.name(hass, id) : id)}<br><span>${esc(id)}</span></b><span>${esc(fmtNow(hass, id))}</span></button>`).join('')}</div>` : '');
    const rng = (f, l, min, max) => `<div class="pwrg"><div class="pwrow"><span class="pwl">${l}</span><b class="pwrv-${f}">${t[f]} px</b></div><input type="range" data-in="pwtab" data-f="${f}" min="${min}" max="${max}" step="1" value="${t[f]}"></div>`;
    return `<div class="pw" data-key="pw"><style>${CSS}</style>
      <div class="pphd"><button class="b40" data-a="pwback" title="Tilbake">${ic('mdi:chevron-left', 18)}</button><span class="t">Strømpris</span></div>
      <span class="hint">Én felles kilde for strømpriskortet, prosa-boblen «Strømpris», strøm-sliden på Hjem og «billigst kl.» i Klima. Endringer vises straks.</span>
      <div class="pwc" data-key="pw-prof"><div class="pwh">${ic('mdi:earth', 18)}Profil</div>${seg('profile', [['no', 'Norge'], ['se', 'Sverige']], c.profile)}</div>
      <div class="pwc" data-key="pw-src">
        <div class="pwh">${ic('mdi:flash', 18)}${se ? 'Nord Pool-sensor (SEK)' : 'Spotpris'}<i>${esc(P.source ? (M.POWER_SOURCES.find((x) => x[0] === P.source) || [0, ''])[1] : '')}</i></div>
        <span class="pwl">Kilde${c.source ? '' : ' · automatisk'}</span>${seg('source', srcOpts.map(([v, l]) => [v, v === 'custom' ? 'Egen' : l]), srcCur)}
        <span class="pwl">${se ? 'Nord Pool-sensor (SEK)' : 'Prisentitet'}</span>
        ${M.entityPicker.html({ key: 'pk-pw-' + entF, value: entV, auto: autoId || '', autoMode: true, domains: 'sensor', placeholder: 'Velg pris-sensor …', attrs: `data-in="pwent" data-f="${entF}"` })}
        ${cand.length > 1 || (cand.length && entV && entV !== cand[0]) ? `<span class="pwl">Forslag${c.source && c.source !== 'custom' ? ' for ' + esc((srcOpts.find((x) => x[0] === c.source) || [0, ''])[1]) : ''}${c[areaF] ? ' · ' + esc(c[areaF]) : ''}</span>${sug(entF, cand)}` : ''}
        <span class="pwl">${se ? 'Elområde' : 'Prisområde'}</span>
        <div class="pwchips" data-key="pw-area">${[['', 'Auto'], ...areas.map((a) => [a, a])].map(([v, l]) => `<button class="${(c[areaF] || '') === v ? 'on' : ''}" data-a="pwset" data-f="${areaF}" data-v="${v}" data-h="selection">${l}</button>`).join('')}</div>
        ${se ? `<span class="pwl">Sensorens enhet</span>${seg('se_unit', [['auto', 'Automatisk'], ['ore', 'öre'], ['kr', 'kr']], c.se_unit)}<span class="hint">Vises alltid som kr/kWh (öre ÷ 100) – grafen i öre/kWh.</span>` : ''}
      </div>
      ${se ? '' : `<div class="pwc" data-key="pw-np">
        <div class="pwh">${ic('mdi:cash-lock', 18)}Norgespris<i>${P.norgespris ? P.fmt(P.norgespris.v, { unit: true }) : ''}</i></div>
        <span class="pwl">Norgespris-sensor</span>
        ${M.entityPicker.html({ key: 'pk-pw-np', value: raw.norgespris_entity || '', auto: npAuto || '', autoMode: true, autoLabel: npAuto ? 'Automatisk' : 'Fast sats', domains: 'sensor', attrs: 'data-in="pwent" data-f="norgespris_entity"' })}
        <div class="pwrow"><span class="pwl">Fast sats uten sensor (kr/kWh)</span><input class="pwin" style="width:110px" type="number" inputmode="decimal" step="0.01" min="0" data-in="pwnum" data-f="norgespris" value="${esc(raw.norgespris != null ? raw.norgespris : '')}" placeholder="0,50"></div>
      </div>`}
      <div class="pwc" data-key="pw-grid">
        <div class="pwh">${ic('mdi:transmission-tower', 18)}Nettleie<i>${P.grid && P.grid.now != null ? P.fmt(P.grid.now, { unit: true }) + ' nå' : ''}</i></div>
        ${M.entityPicker.html({ key: 'pk-pw-grid', value: raw.grid_entity || '', auto: '', autoMode: true, autoLabel: 'Ingen nettleie', domains: 'sensor', attrs: 'data-in="pwent" data-f="grid_entity"' })}
        ${gridSug.length ? `<span class="pwl">Forslag</span>${sug('grid_entity', gridSug)}` : ''}
        ${raw.grid_entity ? (tr ? `<div class="pwtr" data-key="pw-tr"><span>Nettleie i morgen</span><b style="color:${tr.color}">${tr.arrow}</b><b style="color:${tr.color};font-size:13px">${esc(tr.text)}</b><span style="margin-left:auto">snitt ${P.val(tr.today)} → ${P.val(tr.tomorrow)}</span></div>` : '<div class="pwtr" data-key="pw-tr"><span>Mangler i morgen-data for nettleie – raden skjules i kortet</span></div>') : ''}
      </div>
      <div class="pwc" data-key="pw-mode">
        <div class="pwh">${ic('mdi:tag-outline', 18)}Pris som vises</div>
        ${seg('mode', se ? [['spot', 'Spotpris'], ['total', 'Totalpris']] : [['spot', 'Spotpris'], ['total', 'Totalpris'], ['norgespris', 'Norgespris']], c.mode)}
        <span class="hint">${c.mode === 'total' ? 'Spot + nettleie time for time.' : c.mode === 'norgespris' ? 'Fast sats (+ nettleie hvis valgt). Grafen viser spot som referanselinje.' : se ? 'Nord Pool-spot omregnet til kr/kWh.' : 'Grafen viser Norgespris som referanselinje.'}</span>
        ${se ? '' : `<span class="pwl">Enhet</span>${seg('unit', [['kr', `${P.cur}/kWh`], ['ore', `${P.sub}/kWh`]], c.unit)}`}
      </div>
      <div class="pwc" data-key="pw-chart">
        <div class="pwh">${ic('mdi:chart-line', 18)}Kortet viser</div>
        ${seg('chart', [['both', se ? 'Nord Pool' : 'Nord Pool + Norgespris'], ['nordpool', 'Bare Nord Pool'], ['static', 'Statisk']], c.chart)}
        <span class="hint">${c.chart === 'static' ? 'Grafen viser én pris for hele døgnet («Fast pris»).' : c.chart === 'nordpool' ? 'Norgespris skjules i kortet og grafen.' : 'Nord Pool med Norgespris som stiplet linje.'}</span>
        ${c.chart === 'static' ? `<span class="pwl">Statisk sensor</span>
          ${M.entityPicker.html({ key: 'pk-pw-static', value: raw.static_entity || '', auto: '', autoMode: true, autoLabel: 'Fast pris', domains: 'sensor,input_number', attrs: 'data-in="pwent" data-f="static_entity"' })}
          <div class="pwrow"><span class="pwl">Fast pris uten sensor (${esc(P.cur)}/kWh)</span><input class="pwin" style="width:110px" type="number" inputmode="decimal" step="0.01" min="0" data-in="pwnum" data-f="static_val" value="${esc(raw.static_val != null ? raw.static_val : '')}" placeholder="1"></div>` : ''}
      </div>
      <div class="pwc" data-key="pw-cur">
        <div class="pwh">${ic('mdi:cash', 18)}Valuta<i>${esc(P.cur)}/kWh · ${esc(P.sub)}/kWh</i></div>
        ${seg('cur', [['kr', 'kr'], ['$', '$'], ['€', '€'], ['custom', 'Egen']], c.cur)}
        ${c.cur === 'custom' ? `<div class="pwrow"><span class="pwl">Valuta</span><input class="pwin" style="width:110px" data-in="pwtxt" data-f="cur_txt" value="${esc(raw.cur_txt || '')}" placeholder="SEK"></div>
          <div class="pwrow"><span class="pwl">Hundredel</span><input class="pwin" style="width:110px" data-in="pwtxt" data-f="sub_txt" value="${esc(raw.sub_txt || '')}" placeholder="cent"></div>` : ''}
        <span class="hint">Hundredelen brukes på grafaksen: kr → øre, $ og € → cent.</span>
      </div>
      <div class="pwc" data-key="pw-tab">
        <div class="pwh">${ic('mdi:tab', 18)}Fane «I dag / I morgen»</div>
        ${seg('tab.style', [['standard', 'Standard'], ['glass', 'Liquid glass']], t.style)}
        <span class="hint">Stil styrer bare utseendet: Liquid glass-flaten vises bare med Liquid Glass-temaet. Dra-effekten (linse ved trykk og dra) er alltid på.</span>
        ${rng('font', 'Tekststørrelse', 11, 18)}${rng('height', 'Høyde', 24, 48)}${rng('padding', 'Bredde (sidemarg per knapp)', 8, 40)}
        <div class="pwprev" data-nomorph data-key="pw-prev"></div>
      </div>
      <div class="pwst ${P.statusKind === 'ok' ? '' : P.statusKind}" data-key="pw-st">${esc(P.status)}</div>
      <button class="b40" style="align-self:flex-start" data-a="pwreset" data-h="warning">${ic('mdi:restore', 18)} Tilbakestill til automatisk</button>
    </div>`;
  }
  // Forhåndsvisning av fanen i egen shadow root (arkets .seg-stil skal ikke lekke inn)
  function paintPreview(ed, over) {
    const box = ed.root.querySelector('.pwprev');
    if (!box) return;
    const t = { ...M.powerPriceCfg().tab, ...(over || {}) };
    const sr = box.shadowRoot || box.attachShadow({ mode: 'open' });
    sr.innerHTML = `<style>:host{display:block;font-family:${M.FONT}}*{box-sizing:border-box}button{font:inherit;color:inherit;border:0;background:none;padding:0;margin:0;cursor:pointer}${M.powerTabCSS(t)}</style>${M.powerTabHTML(t, !ed.u.pwTmr, true)}`;
    const s = sr.querySelector('.seg');
    if (s) {
      s.addEventListener('click', (e) => { const b = e.composedPath().find((n) => n.dataset && n.dataset.d); if (!b) return; M.haptic('selection'); ed.u.pwTmr = b.dataset.d === 'tomorrow'; paintPreview(ed, over); });
      if (M.glassDrag) M.glassDrag(s, { axis: 'x' }); // Liquid Glass-drag alltid (Fiks 15.2)
    }
  }

  M.powerPricePanel = {
    render,
    after(ed) {
      if (!ed.__pwBound) {
        ed.__pwBound = true;
        ed.root.addEventListener('value-changed', (e) => {
          const el = e.composedPath().find((n) => n.dataset && n.dataset.in === 'pwent');
          if (!el || ed.u.pv !== 'strom') return;
          save(ed, { [el.dataset.f]: (e.detail && e.detail.value) || undefined });
        });
      }
      ed.root.querySelectorAll('.pwseg').forEach((s) => { if (M.glassDrag) M.glassDrag(s, { axis: 'x' }); });
      // Slidere: ikke la arket/Bubble scrolle eller lukke mens man drar (fallgruve 2)
      ed.root.querySelectorAll('.pwrg input[type=range]').forEach((r) => {
        if (r.__pwG) return;
        r.__pwG = true;
        ['pointerdown', 'touchstart', 'touchmove'].forEach((t) => r.addEventListener(t, (e) => e.stopPropagation(), { passive: true }));
      });
      paintPreview(ed);
    },
    act(ed, a, d) {
      switch (a) {
        case 'pwback': case 'pwdone':
          if (M.store && M.store.flush) M.store.flush();
          ed.u.pv = null; ed.render(); return true;
        case 'pwset': {
          const f = d.f, raw = cur();
          let v = d.v;
          if (f === 'source' && raw.source === v) v = ''; // trykk på valgt kilde → auto
          const patch = { [f]: v };
          if (f === 'profile' && raw.mode === 'norgespris' && v === 'se') patch.mode = 'spot';
          if (f === 'source') patch[cur().profile === 'se' ? 'se_entity' : 'spot_entity'] = undefined; // ny kilde → foreslått sensor
          save(ed, patch);
          return true;
        }
        case 'pwreset':
          save(ed, { chart: undefined, static_entity: undefined, static_val: undefined, cur: undefined, cur_txt: undefined, sub_txt: undefined, profile: undefined, source: undefined, spot_entity: undefined, entity: undefined, se_entity: undefined, area: undefined, se_area: undefined, se_unit: undefined, mode: undefined, unit: undefined, norgespris_entity: undefined, grid_entity: undefined });
          M.toast('Strømpris: automatisk oppsett');
          return true;
        default: return false;
      }
    },
    input(ed, el, kind) {
      const k = el.dataset.in;
      if (k === 'pwnum') {
        if (kind !== 'change') return true;
        const v = String(el.value).replace(',', '.').trim();
        save(ed, { [el.dataset.f]: v === '' || isNaN(Number(v)) ? undefined : Number(v) });
        return true;
      }
      if (k === 'pwtxt') { // 61.3: egen valuta / hundredel
        if (kind !== 'change') return true;
        save(ed, { [el.dataset.f]: String(el.value).trim() || undefined });
        return true;
      }
      if (k === 'pwtab') {
        const f = el.dataset.f, v = Number(el.value);
        const lab = ed.root.querySelector('.pwrv-' + f); if (lab) lab.textContent = v + ' px';
        paintPreview(ed, { [f]: v });
        if (kind === 'change') { M.haptic('selection'); save(ed, { ['tab.' + f]: v }); }
        return true;
      }
      return false;
    },
  };
})();
