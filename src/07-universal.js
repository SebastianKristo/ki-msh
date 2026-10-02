/* ki-msh · universal – felles rad-/flis-maler (button-card-malene universal_* som rene JS-funksjoner).
 * MSH.universal(opts) → HTML-streng. MSH.UNIVERSAL_CSS må med i kortets styles (shadow DOM).
 * Varianter (mode): sensor · action · navigate · toggle · bar · room · button · headline. Størrelse (size): small · big.
 * Farger (universal_base): kort var(--gray100) · tekst/ikon var(--gray1000) · navn/alt samme farge opacity .7 ·
 * ikon-sirkel rgba(250,251,252,0.1) + 1px kant · badge 9×9 var(--red) oppe til høyre ved badge_condition.
 * Tilstandsregler state_rule_1..3_{value|condition, main_text, background_color, text_color, hide_bar, hide_alt_text}:
 * første treff vinner (value = entitetens state, ellers condition sann).
 * Klikk/hold: kortets data-act/data-ent-mønster (MSH.Card) – toggle → data-act="toggle" data-id, hold → more-info (data-ent).
 * opts: mode, size, entity (id), st (state-objekt, ellers fra hass), hass, icon, icon_html, icon_color, circle_color,
 * main_text, sub_text, alt_text, symbol, background_color, text_color, margin, badge_condition, badge_color, bar_value,
 * bar_symbol, bar_color, bar_invert_colors, show_timer, toggle_on_value, toggle_on, toggle_on_icon, toggle_off_icon,
 * toggle_icon_color_on/off, toggle_rotate, temp, lights, height (room), show_button_icon, match_value,
 * active_background_color, active_text_color (button), og handling: act, id, hash, path, ent (false = ingen hold),
 * haptic, key (data-key), attrs {navn: verdi}, icon_attrs {…} (ikonet blir egen knapp), cls, style,
 * side_html (liten sensor/bar: egne knapper i en kolonne til høyre, f.eks. vifte −/+ i Rom → Klima).
 */
(function () {
  const M = window.MSH, esc = M.esc;
  const MODES = ['sensor', 'action', 'navigate', 'toggle', 'bar', 'room', 'button', 'headline'];
  const FG = 'var(--ki-text, var(--gray1000, #e1e1e1))', BG = 'var(--ki-surface, var(--gray100, #2f2f2f))'; // Fiks 34: Hjem-flis = --ki-surface/--ki-text
  const has = (v) => v !== null && v !== undefined && String(v).trim() !== '';
  const str = (v) => (v == null ? '' : String(v).trim());
  // Sannhetsverdi for condition/badge_condition: boolean, funksjon(st), tall eller tekst ('true', '1', 'on' …)
  const truthy = (c, st) => {
    if (typeof c === 'function') { try { return !!c(st); } catch (e) { return false; } }
    if (typeof c === 'string') return !['', 'false', '0', 'null', 'undefined', 'off', 'nei', 'no'].includes(c.trim().toLowerCase());
    return !!c;
  };
  M.uTruthy = truthy;
  // Tekst-mal: {state}/{name}/{w} … eller kode [[[ return … ]]] (state, entity, w, name). Brukes på config-felter.
  M.uTpl = function (v, ctx) {
    if (v == null || typeof v !== 'string') return v;
    const t = v.trim();
    if (!t) return null;
    ctx = ctx || {};
    if (t.indexOf('[[[') === 0 && t.slice(-3) === ']]]') {
      try { const r = new Function('state', 'entity', 'w', 'name', t.slice(3, -3))(ctx.state, ctx.entity, ctx.w, ctx.name); return r == null ? null : typeof r === 'boolean' ? r : String(r); } catch (e) { return '⚠ feil i kode'; }
    }
    return t.replace(/\{(\w+)\}/g, (m, k) => (ctx[k] != null && typeof ctx[k] !== 'object' ? ctx[k] : m));
  };
  // Løs alle tekstfelter i et look-objekt (per-entitet-config) mot ctx.
  M.universalLook = function (look, ctx) {
    const out = {};
    Object.keys(look || {}).forEach((k) => { const v = M.uTpl(look[k], ctx); if (v != null && v !== '') out[k] = v; }); // tomt felt = standard
    return out;
  };

  // Første regel som treffer (1..3) → { bg, fg, main, hideBar, hideAlt } eller null
  function rule(o, st) {
    for (let i = 1; i <= 3; i++) {
      const p = 'state_rule_' + i + '_', v = o[p + 'value'];
      let hit = false;
      if (has(v)) hit = !!st && (Array.isArray(v) ? v.map(String) : String(v).split('|').map((x) => x.trim())).includes(String(st.state));
      else if (o[p + 'condition'] != null) hit = truthy(o[p + 'condition'], st);
      if (hit) return { i, bg: o[p + 'background_color'], fg: o[p + 'text_color'], main: o[p + 'main_text'], hideBar: truthy(o[p + 'hide_bar']), hideAlt: truthy(o[p + 'hide_alt_text']) };
    }
    return null;
  }
  const attrs = (a) => Object.keys(a || {}).filter((k) => a[k] != null && a[k] !== false).map((k) => (a[k] === true ? k : `${k}="${esc(a[k])}"`)).join(' ');
  const sym = (s) => `<span class="u-sym">${esc(s)}</span>`;
  const cols = (s) => s.replace(/(^|\s)1fr/g, '$1minmax(0,1fr)');

  M.universal = function (o) {
    o = o || {};
    const mode = MODES.includes(o.mode) ? o.mode : 'sensor';
    const size = o.size === 'big' ? 'big' : 'small', small = size === 'small';
    const ent = o.entity || null;
    const st = o.st !== undefined ? o.st : ent && o.hass ? o.hass.states[ent] || null : null;
    const R = mode === 'button' || mode === 'headline' ? null : rule(o, st);
    const bg = M.color(R && has(R.bg) ? R.bg : o.background_color, mode === 'button' ? 'var(--ki-surface, var(--gray200, #3a3a3a))' : BG);
    const fg = M.color(R && has(R.fg) ? R.fg : o.text_color, FG);
    const icol = R && has(R.fg) ? fg : M.color(o.icon_color, fg);
    const sub = str(o.sub_text), alt = R && R.hideAlt ? '' : str(o.alt_text);
    const unav = st && (st.state === 'unavailable' || st.state === 'unknown');

    // Hovedtekst (label)
    let base;
    if (R && has(R.main)) base = String(R.main);
    else if (has(o.main_text)) base = String(o.main_text);
    else if (mode === 'bar' && has(o.bar_value)) base = String(o.bar_value);
    else if (mode === 'toggle') base = !st ? '–' : unav ? 'Utilgjengelig' : null;
    else base = st ? String(st.state) : '–';
    const on = o.toggle_on != null ? !!o.toggle_on : !!st && st.state === String(o.toggle_on_value != null ? o.toggle_on_value : 'on');
    if (base == null) base = on ? 'På' : 'Av';
    if (!small && o.show_timer && R && R.i === 1 && st && st.last_changed) base = M.relTime(st.last_changed);
    const suffix = R && has(R.main) ? null : has(o.symbol) ? String(o.symbol) : mode === 'bar' ? (o.bar_symbol != null ? String(o.bar_symbol) : '%') : null;
    let label = esc(base);
    if (suffix != null && suffix !== '') label += small ? esc(suffix) : sym(suffix);
    const name = small ? [sub, alt].filter(Boolean).join(' · ') : sub;

    // Handling (MSH.Card: data-act → onAction, data-ent → hold = more-info)
    let act = o.act, id = o.id != null ? o.id : ent;
    if (act === undefined) {
      if (mode === 'toggle' && ent) act = 'toggle';
      else if (mode === 'navigate' && (o.hash || o.path)) act = o.hash ? 'popup' : 'nav';
      else if (mode !== 'headline' && ent) act = 'more';
    }
    const A = {
      class: `u${['room', 'button', 'headline'].includes(mode) ? '' : ' u-' + size} u-m-${mode}${unav ? ' u-unav' : ''}${o.cls ? ' ' + o.cls : ''}`,
      role: act ? 'button' : null,
      'data-act': act || null, 'data-id': act ? id : null, 'data-hash': o.hash || null, 'data-path': o.path || null,
      'data-ent': o.ent === false ? null : o.ent || ent || null,
      'data-haptic': o.haptic || (act === 'toggle' ? 'success' : null),
      'data-key': o.key || null,
      ...(o.attrs || {}),
    };
    const S = [`--u-bg:${bg}`, `--u-fg:${fg}`];
    if (has(o.margin) && String(o.margin) !== '0') S.push(`margin-top:${/^-?\d+(\.\d+)?$/.test(String(o.margin)) ? o.margin + 'px' : o.margin}`);
    const badge = o.badge_condition != null && truthy(o.badge_condition, st);
    const badgeHtml = badge ? `<span class="u-badge" style="background:${M.color(o.badge_color, 'var(--red, #f28073)')}"></span>` : '';
    const iconHtml = (sz) => o.icon_html || M.icon(o.icon || (ent ? M.domainIcon(ent, st) : 'mdi:alert'), sz);
    const iconCell = (sz) => `<div class="u-i"${o.icon_attrs ? ' ' + attrs(o.icon_attrs) : ''} style="color:${icol}${has(o.circle_color) ? ';background:' + M.color(o.circle_color) : ''}">${iconHtml(sz)}</div>`;

    /* ---- room */
    if (mode === 'room') {
      let lab;
      if (has(o.main_text)) lab = esc(o.main_text);
      else {
        const t = o.temp != null && !isNaN(parseFloat(o.temp)) ? parseFloat(o.temp).toFixed(0) : st && st.attributes.temp != null ? parseFloat(st.attributes.temp).toFixed(0) : '–';
        const l = o.lights != null ? o.lights : st && st.attributes.lights != null ? parseFloat(st.attributes.lights).toFixed(0) : '–';
        lab = `${esc(t)}°${sym(has(o.alt_text) ? o.alt_text : `${l} lys på`)}`;
      }
      const hgt = parseInt(o.height, 10);
      if (!isNaN(hgt)) S.push(`height:${hgt}px`);
      return `<div ${attrs(A)} style="${S.join(';')};grid-template-areas:'n i' 'l i';grid-template-rows:1fr min-content;grid-template-columns:minmax(0,1fr) min-content${o.style ? ';' + o.style : ''}">
        <div class="u-i" style="align-self:${!isNaN(hgt) && hgt > 120 ? 'start' : 'center'}">${M.icon(o.icon || 'mdi:chevron-right', 18)}</div>
        <div class="u-n">${esc(sub)}</div><div class="u-l">${lab}</div>${badgeHtml}</div>`;
    }
    /* ---- button */
    if (mode === 'button') {
      const active = o.match_value != null && !!st && st.state === String(o.match_value);
      const showI = truthy(o.show_button_icon);
      S[0] = `--u-bg:${active ? M.color(o.active_background_color, 'var(--active-big, #f285c9)') : `linear-gradient(120deg, rgba(242, 133, 201, 0.2) 0%, ${bg} 40%)`}`;
      if (active) S[1] = `--u-fg:${M.color(o.active_text_color, 'var(--black, #000)')}`;
      return `<div ${attrs(A)} style="${S.join(';')};grid-template-areas:${showI ? "'i' 'n'" : "'n'"};grid-template-rows:${showI ? 'min-content 1fr' : '1fr'}${o.style ? ';' + o.style : ''}">
        ${showI ? `<div class="u-i">${M.icon(o.icon || 'mdi:circle', 22)}</div>` : ''}<div class="u-n"${showI ? ' style="margin-top:-6px"' : ''}>${esc(has(o.main_text) ? o.main_text : 'Knapp')}</div></div>`;
    }
    /* ---- headline */
    if (mode === 'headline') {
      return `<div ${attrs(A)} style="${S.join(';')}${o.style ? ';' + o.style : ''}"><div class="u-i">${M.icon(o.icon || 'mdi:ab-testing', 22)}</div><div class="u-n">${esc(str(o.main_text))}</div><div class="u-l">${esc(sub)}</div></div>`;
    }

    /* ---- sensor · action · navigate · toggle · bar */
    const hasSub = sub !== '', smallName = name !== '';
    let areas, colT, rows;
    const side = small && (mode === 'sensor' || mode === 'bar') && has(o.side_html);
    if (mode === 'sensor' || mode === 'bar') {
      if (side) { areas = smallName ? `'i l s' 'i n s'` : `'i l s'`; colT = '76px 1fr min-content'; rows = smallName ? '1fr 1fr' : '1fr'; }
      else if (small) { areas = smallName ? `'i l' 'i n'` : `'i l'`; colT = '76px 1fr'; rows = smallName ? '1fr 1fr' : '1fr'; }
      else if (mode === 'bar') { areas = alt ? `'i i i' 'n n n' 'l l alt' 'bar bar bar'` : `'i i i' 'n n n' 'l l l' 'bar bar bar'`; colT = '1fr 1fr min-content'; rows = '1fr min-content min-content min-content'; }
      else { areas = alt ? `'i i i' 'n n n' 'l l alt'` : `'i i i' 'n n n' 'l l l'`; colT = '1fr 1fr min-content'; rows = '1fr min-content min-content'; }
    } else {
      if (small) { areas = smallName ? `'i l mode' 'i n mode'` : `'i l mode'`; colT = mode === 'toggle' ? '76px 1fr 76px' : '76px 1fr 58px'; rows = smallName ? '1fr 1fr' : '1fr'; }
      else {
        areas = hasSub ? (alt ? `'i mode' 'n n' 'l alt'` : `'i mode' 'n n' 'l l'`) : alt ? `'i mode' 'l alt'` : `'i mode' 'l l'`;
        colT = '1fr 1fr min-content'; rows = hasSub ? '1fr min-content min-content' : '1fr min-content';
      }
    }
    const center = small ? !smallName : mode !== 'sensor' && mode !== 'bar' && !hasSub;
    let modeHtml = '';
    if (mode === 'action') modeHtml = `<div class="u-mode">${M.icon('mdi:gesture-tap', 22, 'opacity:.4')}</div>`;
    else if (mode === 'navigate') modeHtml = `<div class="u-mode u-nav">${M.icon('mdi:chevron-right', 20, 'opacity:.7')}</div>`;
    else if (mode === 'toggle') {
      const ic = on ? o.toggle_on_icon || 'mdi:toggle-switch' : o.toggle_off_icon || 'mdi:toggle-switch-off';
      const col = on ? M.color(o.toggle_icon_color_on, 'var(--green, #66d19e)') : M.color(o.toggle_icon_color_off, 'rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.35*var(--ki-wa-k,1)),var(--ki-wa-max,1)))');
      modeHtml = `<div class="u-mode u-tg${on ? ' on' : ''}">${M.icon(ic, 56, `color:${col};transform:rotate(${o.toggle_rotate || '0deg'})`)}</div>`;
    }
    let barHtml = '';
    if (mode === 'bar' && !small && !(R && R.hideBar)) {
      const raw = Number(has(o.bar_value) ? o.bar_value : st ? st.state : 0) || 0, v = Math.max(0, Math.min(100, raw));
      let col;
      if (o.bar_color === 'white') col = FG;
      else if (has(o.bar_color)) col = M.color(o.bar_color);
      else {
        const C = ['var(--red, #f28073)', 'var(--orange, #f2b573)', 'var(--yellow, #f2d26f)', 'var(--blue, #73b9f2)', 'var(--green, #66d19e)'];
        let i = [70, 50, 30, 20, 0].findIndex((t) => raw >= t);
        if (i < 0) i = 4;
        if (truthy(o.bar_invert_colors)) i = 4 - i;
        col = C[i];
      }
      barHtml = `<div class="u-bar" style="background-image:repeating-linear-gradient(45deg, transparent, transparent 2px, ${col} 3px, transparent 4px)"><div style="background:${col};width:${v}%"></div></div>`;
      S.push('height:180px');
    }
    return `<div ${attrs(A)} style="${S.join(';')};grid-template-areas:${areas};grid-template-columns:${cols(colT)};grid-template-rows:${rows}${o.style ? ';' + o.style : ''}">
      ${iconCell(30)}<div class="u-l"${center ? ' style="align-self:center"' : ''}>${label}</div>${(small ? smallName : hasSub) ? `<div class="u-n">${small && o.sub_html && !alt ? o.sub_html : esc(name)}</div>` : ''}${!small && alt ? `<div class="u-alt">${esc(alt)}</div>` : ''}${modeHtml}${side ? `<div class="u-side">${o.side_html}</div>` : ''}${barHtml}${badgeHtml}</div>`;
  };

  // «Indre rad-flate» (fiks 16.6): én kilde for flaten til sensor-/enhets-/vifte-radene og Rom → Media-spilleren,
  // så de alltid er like. bg = rad #2f2f2f på seksjon #3a3a3a, edge = tynn kant, circle/circleEdge = ikon-sirkelen.
  M.INNER_ROW = { bg: BG, edge: 'inset 0 0 0 1px rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.04*var(--ki-wa-k,1)),var(--ki-wa-max,1)))', circle: 'rgba(250,251,252,0.1)', circleEdge: '1px solid rgba(250,251,252,0.1)' };
  // Klasser: .msh-inner (flaten) og .msh-inner-c (ikon-sirkel/rund knapp på flaten).
  M.INNER_ROW_CSS = `
    .msh-inner{background:${M.INNER_ROW.bg};box-shadow:${M.INNER_ROW.edge}}
    .u.msh-inner{background:var(--u-bg);box-shadow:${M.INNER_ROW.edge}}
    .msh-inner-c{background:${M.INNER_ROW.circle};border:${M.INNER_ROW.circleEdge};box-sizing:border-box}
  `;

  // 17.5: lux-sensorer (sensor.* med device_class illuminance eller enhet lx) får egen oransje rad. Returnerer
  // standard-opts for M.universal (kaller lar egne valg vinne), eller null (ikke lux / utilgjengelig → vanlig grå rad «–»).
  // Verdi: én desimal under 10, ellers heltall («6.3 lx», «240 lx»). Klassen u-lux bytter navn (16/500) og verdi (14, .7).
  M.isLux = (st) => !!st && /^sensor\./.test(st.entity_id || 'sensor.') && (st.attributes.device_class === 'illuminance' || st.attributes.unit_of_measurement === 'lx');
  M.luxOpts = function (st) {
    if (!M.isLux(st) || st.state === 'unavailable' || st.state === 'unknown' || isNaN(parseFloat(st.state))) return null;
    const v = parseFloat(st.state);
    return { cls: 'u-lux', background_color: 'var(--orange, rgb(242 181 115))', text_color: 'var(--ki-on-accent, var(--gray000, #232323))', icon: 'mdi:brightness-7', icon_color: 'var(--ki-on-accent, #232323)', circle_color: 'rgb(255 255 255/0.18)', main_text: v < 10 ? v.toFixed(1) : String(Math.round(v)), symbol: ' lx' };
  };

  // Felles CSS – kortene har shadow DOM og må ta med denne i styles.
  M.UNIVERSAL_CSS = `
    .u{position:relative;display:grid;box-sizing:border-box;width:100%;min-width:0;border-radius:var(--ha-card-border-radius, 32px);background:var(--u-bg);color:var(--u-fg);box-shadow:var(--ki-card-sh, none);overflow:visible;text-align:left;font-size:16px;cursor:pointer;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;transition:background .25s,transform .2s}
    .u:not([data-act]){cursor:default}
    .u[data-act]:active{transform:scale(.98)}
    .u>*{min-width:0}
    .u-i{grid-area:i;display:flex;align-items:center;justify-content:center;border-radius:50%;background:var(--ki-surface-2, rgba(250,251,252,0.1));border:1px solid var(--ki-line, rgba(250,251,252,0.1));color:var(--u-fg);justify-self:start;align-self:start;box-sizing:border-box;overflow:hidden;transition:background .25s}
    .u-l{grid-area:l;justify-self:stretch;align-self:end;line-height:1.2em;color:var(--u-fg);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .u-n{grid-area:n;justify-self:stretch;text-align:left;font-size:14px;font-weight:500;color:var(--u-fg);opacity:.7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .u-alt{grid-area:alt;justify-self:end;align-self:end;font-size:14px;font-weight:500;color:var(--u-fg);opacity:.7;white-space:nowrap;margin-bottom:-12px}
    .u-sym{font-size:14px;line-height:1.5em;font-weight:500;opacity:.7;margin-left:2px}
    .u-mode{grid-area:mode;display:flex;align-items:center;justify-content:center;line-height:0;color:var(--u-fg);margin:0}
    .u-nav{rotate:-45deg}
    .u-side{grid-area:s;display:flex;align-items:center;gap:8px;padding:0 9px 0 8px;align-self:center}
    .u-badge{position:absolute;top:0;right:0;width:9px;height:9px;padding:2px;box-sizing:content-box;border-radius:50%;pointer-events:none}
    .u-unav .u-l,.u-unav .u-i{opacity:.55}
    /* small */
    .u-small{height:66px;padding:0}
    .u-small .u-i{width:56px;height:56px;margin:0 4px;align-self:center}
    .u-small .u-l{font-size:16px;font-weight:500}
    .u-small .u-n{align-self:start;padding-top:2px}
    .u-small .u-mode{justify-self:center;align-self:center}
    .u-small .u-tg{justify-self:start;margin:0 4px 0 0}
    /* 17.5: lux-rad – oransje, ingen kant, ikon-sirkel .18 + lys kant, navn øverst (16/500), verdi under (14, .7) */
    .u.u-lux.u-lux{box-shadow:none}
    .u-lux .u-i{border:none;box-shadow:inset 0 0 0 1px rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.25*var(--ki-wa-k,1)),var(--ki-wa-max,1)))}
    .u-small.u-lux .u-l{grid-area:n;align-self:start;padding-top:2px;font-size:14px;font-weight:400;opacity:.7}
    .u-small.u-lux .u-n{grid-area:l;align-self:end;padding-top:0;font-size:16px;font-weight:500;opacity:1}
    /* big */
    .u-big{height:160px;padding:20px}
    .u-big .u-i{width:52px;height:52px;translate:-10px -10px}
    .u-big .u-l{font-size:2em;font-weight:300}
    .u-big .u-n{align-self:end;padding-top:10px}
    .u-big .u-mode{justify-self:end;align-self:start}
    .u-big .u-tg{translate:10px -10px}
    /* bar */
    .u-big.u-m-bar{padding:20px 0 0 0}
    .u-big.u-m-bar .u-i{translate:10px -10px}
    .u-big.u-m-bar .u-l,.u-big.u-m-bar .u-n{padding-left:20px}
    .u-big.u-m-bar .u-alt{padding-right:20px}
    .u .u-bar{grid-area:bar;justify-self:start;position:relative;width:calc(100% - 1px);height:30px;margin-top:6px;overflow:hidden;border-bottom-left-radius:34px;border-bottom-right-radius:34px}
    .u .u-bar>div{height:30px}
    /* room */
    .u-m-room{padding:20px;height:auto}
    .u-m-room .u-i{width:18px;height:18px;justify-self:end;background:none;border:0;border-radius:0;rotate:-45deg;opacity:.7}
    .u-m-room .u-n{justify-self:start;align-self:start;font-size:16px;font-weight:500;opacity:1;padding-bottom:4px}
    .u-m-room .u-l{justify-self:start;align-self:end;font-size:2em;line-height:1em;font-weight:300;padding-top:4px}
    /* button */
    .u-m-button{aspect-ratio:1/1;height:auto;padding:0;outline:1px solid rgba(242,133,201,0.22)}
    .u-m-button .u-i{width:22px;height:22px;padding:18px 0 0 0;margin:0;justify-self:center;background:none;border:0;border-radius:0;box-sizing:content-box}
    .u-m-button .u-n{justify-self:center;align-self:center;text-align:center;font-size:14px;font-weight:500;opacity:1;padding:0}
    /* headline */
    .u-m-headline{background:none;padding:0;height:auto;grid-template-areas:'i n l';grid-template-columns:min-content min-content minmax(0,1fr);align-items:center}
    .u-m-headline .u-i{width:22px;height:auto;padding-right:12px;box-sizing:content-box;background:none;border:0;border-radius:0;color:var(--ki-text-1, var(--gray1000, #e1e1e1));align-self:center}
    .u-m-headline .u-n{font-size:16px;font-weight:500;opacity:1;color:var(--ki-text-1, var(--gray1000, #e1e1e1));align-self:center;overflow:visible}
    .u-m-headline .u-l{justify-self:start;align-self:center;padding-left:12px;font-size:14px;opacity:.7;color:var(--ki-text-1, var(--gray1000, #e1e1e1))}
    .u-m-headline[data-act]:active{transform:none}
  `;

  // Editor-felter for per-entitet-utseende (Tilpass rom / GUI). p = sti-prefiks, f.eks. 'looks.sensor.stue_temp'.
  // o.kind: 'sensor' | 'toggle' – bestemmer standard-mode i plassholderne.
  M.universalSchema = function (p, o) {
    o = o || {};
    const MODE = [['', 'Auto'], ['sensor', 'Sensor'], ['toggle', 'Bryter'], ['action', 'Handling'], ['navigate', 'Naviger'], ['bar', 'Stolpe']];
    const SIZE = [['', 'Auto'], ['small', 'Liten'], ['big', 'Stor']];
    const ph = o.placeholders || {};
    const ruleSec = (i) => ({ type: 'section', label: `Tilstandsregel ${i}`, icon: 'mdi:format-list-checks', meta: (h, c) => { const g = (k) => String(p + '.state_rule_' + i + '_' + k).split('.').reduce((a, x) => (a == null ? a : a[x]), c); return has(g('value')) ? '= ' + g('value') : has(g('condition')) ? 'kode' : (i === 1 && ph.rule1) || ''; }, fields: [
      { type: 'text', name: `${p}.state_rule_${i}_value`, label: 'Når tilstand er', placeholder: i === 1 && ph.rule1 ? ph.rule1 : 'on  (flere: on|open)' },
      { type: 'text', name: `${p}.state_rule_${i}_condition`, label: 'Eller når kode er sann', placeholder: "[[[ return Number(state) > 25 ]]]" },
      { type: 'text', name: `${p}.state_rule_${i}_main_text`, label: 'Hovedtekst', placeholder: 'Uendret' },
      { type: 'color', name: `${p}.state_rule_${i}_background_color`, label: 'Bakgrunn' },
      { type: 'color', name: `${p}.state_rule_${i}_text_color`, label: 'Tekst og ikon' },
      { type: 'boolean', name: `${p}.state_rule_${i}_hide_bar`, label: 'Skjul stolpe' },
      { type: 'boolean', name: `${p}.state_rule_${i}_hide_alt_text`, label: 'Skjul tilleggstekst' },
    ] });
    return [
      { type: 'select', name: p + '.mode', label: 'Type', options: MODE, help: `Auto = ${o.kind === 'toggle' ? 'Bryter' : 'Sensor'}` },
      { type: 'select', name: p + '.size', label: 'Størrelse', options: SIZE, help: 'Auto = Liten (66 px)' },
      { type: 'icon', name: p + '.icon', label: 'Ikon' },
      { type: 'text', name: p + '.main_text', label: 'Hovedtekst (verdi)', placeholder: ph.main_text || '{state}' },
      { type: 'text', name: p + '.sub_text', label: 'Navn', placeholder: ph.sub_text || '' },
      { type: 'text', name: p + '.alt_text', label: 'Tilleggstekst', placeholder: ph.alt_text || 'Tomt', help: 'Liten: «Navn · tillegg». Stor: nederst til høyre' },
      { type: 'text', name: p + '.symbol', label: 'Symbol etter verdien', placeholder: ph.symbol || '°, %, W …' },
      { type: 'color', name: p + '.background_color', label: 'Bakgrunn' },
      { type: 'color', name: p + '.text_color', label: 'Tekst og ikon' },
      { type: 'text', name: p + '.badge_condition', label: 'Merke (prikk) når', placeholder: "[[[ return state === 'on' ]]]  eller true" },
      { type: 'color', name: p + '.badge_color', label: 'Merkefarge' },
      { type: 'section', label: 'Stolpe', icon: 'mdi:chart-bar', fields: [
        { type: 'text', name: p + '.bar_value', label: 'Verdi (0–100)', placeholder: '{state}' },
        { type: 'color', name: p + '.bar_color', label: 'Farge', help: 'Tom = etter verdi (rød ≥70, oransje ≥50, gul ≥30, blå ≥20, grønn)' },
        { type: 'boolean', name: p + '.bar_invert_colors', label: 'Snu fargeskalaen' },
      ] },
      ruleSec(1), ruleSec(2), ruleSec(3),
    ];
  };
  // Nøkler som hører til universal-looken (for kopiering fra config)
  M.UNIVERSAL_KEYS = ['mode', 'size', 'icon', 'main_text', 'sub_text', 'alt_text', 'symbol', 'background_color', 'text_color', 'margin', 'badge_condition', 'badge_color', 'bar_value', 'bar_color', 'bar_invert_colors', 'show_timer', 'toggle_on_value',
    ...[1, 2, 3].flatMap((i) => ['value', 'condition', 'main_text', 'background_color', 'text_color', 'hide_bar', 'hide_alt_text'].map((k) => `state_rule_${i}_${k}`))];
})();
