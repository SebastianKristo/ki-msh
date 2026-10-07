/* KI MSH · felles lys-rad (Fiks 41) for Rom → Lys (31-rom.js) og Lys-popupen (43-lys.js, også gruppe-radene).
 * Port 1:1 av Rom v4.dc.html, akkordeonet hasLights / lights (l.*) – markup og stil-/logikkblokken (l.sl, slFill,
 * slHandle, slTrack, xToggle, xOpen/xLabel/xVal/xBar/xKnob, swBar/swFill/swDot) og drag(down/move/up). Én renderer, så
 * Rom og Lys aldri drifter fra hverandre:
 *   Rad: lightbulb 20 px + navn 14/500 + prosent 12 px (--ki-text-mid, tabular-nums) på én linje, 8 px over kontrollen.
 *   Dimbart (dim/ct/color): slider 40 px høy, flex med gap 6: fyll (flex-grow = %, 34 px, r 14/5/5/14) · håndtak 4 × 40 r2
 *     · spor (flex-grow = 100 − %, 34 px, r 5/14/14/5); flex-grow animeres .3s (ikke under dra). Fyll: kun dimbar / varm
 *     temp = #ffc896, temp > 4500 K = #f3ebe0, farge = hsl(hue 85% 72%).
 *   Farge/temp (canX): chevron-knapp 36 × 40 (expand_more 22, roteres .2s) → panel (padding-left 11, gap 6): xLabel 11 px
 *     «Temperatur»/«Farge» + xVal 12 px («3500 K» / «30°»), xBar 28 px r14 (temp- / fargegradient), xKnob 34 px r17.
 *   Kun av/på: swBar 48 px r24 (#695b51, pad 4) med swFill 52 % × 40 r20 (power_settings_new 18) som glir til høyre
 *     (translateX 92 %, fjær .35s) når på, swDot 8 px på motsatt side. Prosent = «På» / «Av».
 * Type fra HA (supported_color_modes) i stedet for designets LT_AUTO: farge (hs/rgb/xy) → color, color_temp → ct, annen
 *   dimming → dim, ellers onoff. light_types.<objekt-id> i kortets config overstyrer.
 * Interaksjon: dra (> 5 px sidelengs) = lysstyrke 0–100 % av sliderbredden (0 = av), trykk = av/på (på = forrige nivå).
 *   touch-action pan-y + stopPropagation på pointerdown/touchstart/touchmove (fallgruve 2); loddrett bevegelse før dra =
 *   scroll. light.turn_on {brightness_pct} (ct: color_temp_kelvin, farge: hs_color) throttlet 150 ms + ved slipp,
 *   light.turn_off ved 0. Haptic selection ved dra-start (M.haptic: maks én per 40 ms). Under dra oppdateres bare raden
 *   (M.morph på raden) og kortets egne tegninger viser dra-verdien, så hass-oppdateringer aldri river slideren.
 *
 *   M.lightType(state)                       → 'color' | 'ct' | 'dim' | 'onoff'
 *   M.renderLightRow(card, L)                → HTML for én rad (card = MSH.Card, morph-trygg; kobler hendelser selv)
 *       L = { id, key?, name, icon?, iconColor?, type?, user?, fill?, kelvin?, suffix?, ids?, dim?, cls? }
 *       user = lights.<objekt-id> (brightness_min/max, hide_temperature_slider, hide_color_controls; eldre nøkler godtas)
 *       fill = egen fyllfarge (Lys «Farge på lys»), kelvin = «45% · 2700 K», ids = gruppe (dim = de dimbare)
 *   M.bindLightRows(card)                    → felles hendelser (delegert på kortets shadowRoot, én gang)
 *   M.LIGHT_ROW_CSS                          → felles CSS (.lr …)
 */
(function () {
  const M = window.MSH;
  if (!M || M.renderLightRow) return;
  const esc = M.esc;
  const COLOR = ['hs', 'rgb', 'rgbw', 'rgbww', 'xy'];

  M.lightType = function (s) {
    const m = (s && s.attributes.supported_color_modes) || [];
    if (m.some((x) => COLOR.includes(x))) return 'color';
    if (m.includes('color_temp')) return 'ct';
    if (m.some((x) => x !== 'onoff') || (!m.length && s && s.attributes.brightness != null)) return 'dim';
    return 'onoff';
  };
  // 19.2 · Lampens egen farge (Lys v4 → LC(k)/KEL()) – «Lys på»-sirklene og fargeprikkene i Tilpass lys.
  const KEL = [[2400, [242, 181, 115]], [3000, [242, 210, 111]], [4200, [242, 228, 185]], [Infinity, [222, 232, 245]]];
  const YEL = [242, 210, 111];
  const lumOf = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const rgbOf = (v) => {
    if (Array.isArray(v)) return v.length >= 3 ? v.slice(0, 3).map(Number) : null;
    const s = String(v || '');
    let m = /#([0-9a-f]{6}|[0-9a-f]{3})\b/i.exec(s);
    if (m) { let h = m[1]; if (h.length === 3) h = h.split('').map((x) => x + x).join(''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); }
    m = /rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(s);
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
  };
  const hsRgb = (hs) => {
    if (!Array.isArray(hs) || hs.length < 2) return null;
    const h = ((Number(hs[0]) % 360) + 360) % 360 / 60, s = Math.max(0, Math.min(100, Number(hs[1]) || 0)) / 100, x = s * (1 - Math.abs((h % 2) - 1));
    const [r, g, b] = h < 1 ? [s, x, 0] : h < 2 ? [x, s, 0] : h < 3 ? [0, s, x] : h < 4 ? [0, x, s] : h < 5 ? [x, 0, s] : [s, 0, x];
    return [r, g, b].map((v) => Math.round(255 * (v + 1 - s)));
  };
  M.lampColor = function (s, override, preview) {
    const out = (rgb, css) => ({ css: css || `rgb(${rgb.join(' ')})`, lum: rgb ? lumOf(rgb) : 0.5 });
    if (override) { const css = M.color(override); return out(rgbOf(css), css); }
    const pr = preview && rgbOf(preview);
    if (pr) return out(pr);
    const a = (s && s.attributes) || {}, mode = a.color_mode;
    if (COLOR.includes(mode)) { const c = rgbOf(a.rgb_color) || hsRgb(a.hs_color); if (c) return out(c); }
    if (mode === 'color_temp') {
      const k = Number(a.color_temp_kelvin) || (Number(a.color_temp) ? 1e6 / Number(a.color_temp) : 0);
      if (k > 0) return out(KEL.find(([t]) => k <= t)[1]);
    }
    return out(YEL, `var(--yellow, rgb(${YEL.join(' ')}))`);
  };
  // Fyll-maske (19.2) for «Lys på»-radene i Lys-popupen
  M.lampMask = (lum) => (lum < 0.35 ? 'linear-gradient(90deg, rgb(0 0 0 / .3), rgb(0 0 0 / .6))' : 'linear-gradient(90deg, rgb(0 0 0 / .22), rgb(0 0 0 / .5))');

  /* ------------------------------------------------------------ designfargene (Rom v4, lights l.*) */
  // Aksentflater i slideren/bryteren (varme toner) – like i lys og mørk modus. Tekst/ikoner bruker --ki-*-tokens.
  const FILL_WARM = '#ffc896'; // ki-hex-ok slFill (dimbar / temp ≤ 4500 K)
  const FILL_COOL = '#f3ebe0'; // ki-hex-ok slFill (temp > 4500 K)
  const FILL_HUE = (h) => `hsl(${h} 85% 72%)`;
  const KNOB_CT = '#ffcf9e'; // ki-hex-ok xKnob (temperatur)
  const KNOB_HUE = (h) => `hsl(${h} 90% 65%)`;
  const BAR_CT = 'linear-gradient(90deg, #ff9f45, #ffd9a8, #fff6ea, #d6e6ff)'; // ki-hex-ok xBar (temperatur)
  const BAR_HUE = 'linear-gradient(90deg, hsl(0 85% 60%), hsl(60 85% 60%), hsl(120 70% 55%), hsl(180 70% 55%), hsl(240 75% 65%), hsl(300 75% 62%), hsl(360 85% 60%))';
  const SW_INK = '#e8c9a8'; // ki-hex-ok power_settings_new / swDot
  // Fiks 56 M · lys modus: fyll/på-tommel = lampens farge som gradient (varmhvit #f6c48a → #f2a65a), pære-ikonet = lampefargen
  // mørknet til ≥ 4,5:1 mot hvitt (MSH.theme.lampInk, OKLCH L ≈ 0,55). Verdiene settes per element med
  // MSH.theme.lightOnly (space toggle --ki-lt), så mørk modus beholder Rom v4-fargene over (fallback).
  const L_WARM = ['#f6c48a', '#f2a65a']; // ki-hex-ok lys modus: varmhvit fyll
  const L_COOL = ['#dbe6f6', '#b5cbec']; // ki-hex-ok lys modus: kaldhvit fyll (temp > 4500 K)
  const L_HUE = (h) => [`hsl(${h} 85% 68%)`, `hsl(${h} 85% 58%)`];
  const hslRgb = (h, s, l) => { s /= 100; l /= 100; const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l); return [0, 8, 4].map((n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))))); };
  const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const inkC = new Map(); // lampefarge → mørknet ikonfarge (cache)
  function lightLook(L, st) {
    const TH = M.theme;
    let g, base;
    if (L.fill) {
      const p = TH && TH.parse(M.color(L.fill));
      g = [L.fill, `color-mix(in srgb, ${L.fill} 82%, black)`];
      base = p ? p.slice(0, 3) : hexRgb(L_WARM[1]);
    } else if (st.type === 'color') { g = L_HUE(st.hue); base = hslRgb(st.hue, 85, 58); }
    else if (st.type === 'ct' && st.ct > 4500) { g = L_COOL; base = hexRgb(L_COOL[1]); }
    else { g = L_WARM; base = hexRgb(L_WARM[1]); }
    const ck = base.join(',');
    let ink = inkC.get(ck);
    if (!ink && TH && TH.lampInk) { ink = TH.lampInk(base); if (inkC.size > 200) inkC.clear(); inkC.set(ck, ink); }
    return { grad: `linear-gradient(90deg, ${g[0]}, ${g[1]})`, ink: ink || 'var(--ki-text, #fafafa)' };
  }
  const LO = (v) => (M.theme && M.theme.lightOnly ? M.theme.lightOnly(v) : 'var(--ki-lt) ' + v);

  /* ------------------------------------------------------------ tilstand */
  const pctOf = (s) => (!s || s.state !== 'on' ? 0 : s.attributes.brightness != null ? Math.max(1, Math.round((s.attributes.brightness / 255) * 100)) : 100);
  const kOf = (a) => Number(a.color_temp_kelvin) || (Number(a.color_temp) ? 1e6 / Number(a.color_temp) : 0);
  const hueOf = (a) => {
    if (Array.isArray(a.hs_color)) return Math.round(Number(a.hs_color[0]) || 0);
    const c = rgbOf(a.rgb_color);
    if (!c) return 30;
    const [r, g, b] = c.map((v) => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    if (!d) return 0;
    let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
    return Math.round(h < 0 ? h + 360 : h);
  };
  const B = (v) => v === true || v === 'true';
  const TYPES = ['dim', 'ct', 'color', 'onoff'];
  const lrs = (card) => card.__lr || (card.__lr = { open: {}, pend: {}, rows: {}, drag: null });
  const keyOf = (L) => String(L.key || L.id || (L.ids || []).join(','));

  function rowState(card, L) {
    const h = card.hass, rs = lrs(card), key = keyOf(L);
    const grp = Array.isArray(L.ids) && L.ids.length > 0, ids = grp ? L.ids.slice() : [L.id];
    const get = (id) => (card.s ? card.s(id) : (h && h.states[id]) || null);
    const S = ids.map(get), have = S.filter(Boolean), onS = have.filter((s) => s.state === 'on');
    const missing = !have.length, unav = !missing && have.every((s) => M.unavailable(s));
    const u = L.user || {};
    let type = TYPES.includes(L.type) ? L.type : grp ? (have.some((s) => M.lightType(s) !== 'onoff') ? 'dim' : 'onoff') : M.lightType(S[0]);
    if (grp && type !== 'onoff') type = 'dim';
    const onoff = type === 'onoff';
    let p = onoff ? (onS.length ? 100 : 0) : grp ? (onS.length ? Math.max(1, Math.round(S.reduce((t, s) => t + pctOf(s), 0) / ids.length)) : 0) : pctOf(S[0]);
    const now = Date.now(), pd = rs.pend[key] || {};
    if (pd.p != null) { if (now - pd.pt > 3000 || Math.abs(pd.p - p) <= 1) pd.p = null; else p = pd.p; }
    const d = rs.drag && rs.drag.key === key ? rs.drag : null;
    if (d && d.kind === 'main' && d.v != null) p = d.v;
    const ref = onS[0] || S[0], a = (ref && ref.attributes) || {};
    const kmin = Number(a.min_color_temp_kelvin) || 2200, kmax = Math.max(kmin + 100, Number(a.max_color_temp_kelvin) || 6500);
    let ct = Math.round(kOf(a)) || 3500, hue = hueOf(a);
    if (pd.ct != null) { if (now - pd.xt > 3000 || Math.abs(pd.ct - ct) <= 60) pd.ct = null; else ct = pd.ct; }
    if (pd.hue != null) { if (now - pd.xt > 3000 || Math.abs(pd.hue - hue) <= 3) pd.hue = null; else hue = pd.hue; }
    if (d && d.kind === 'ct' && d.v != null) ct = d.v;
    if (d && d.kind === 'hue' && d.v != null) hue = d.v;
    const canX = !grp && !missing && ((type === 'ct' && !B(u.hide_temperature_slider)) || (type === 'color' && !B(u.hide_color_controls)));
    const open = canX && !!rs.open[key];
    const K = onS.length ? Math.round(kOf(onS[0].attributes || {})) : 0;
    const name = L.name || (S[0] ? M.name(h, ids[0]) : ids[0]);
    const val = missing ? 'Finnes ikke' : unav ? 'Utilgjengelig' : (onoff ? (p ? 'På' : 'Av') : `${p}%${L.kelvin && p && K > 0 ? ` · ${K} K` : ''}`) + (L.suffix || '');
    const fill = L.fill || (type === 'color' ? FILL_HUE(hue) : type === 'ct' && ct > 4500 ? FILL_COOL : FILL_WARM);
    return { key, ids, S, grp, type, onoff, p, on: onS.length > 0, ct, hue, kmin, kmax, canX, open, name, val, fill, dis: missing || unav, drag: !!(d && d.moved) };
  }

  /* ------------------------------------------------------------ markup (Rom v4 lights) */
  function inner(card, L, st) {
    const lk = lightLook(L, st);
    // pære-ikonet: mørk = Rom v4 (arvet tekstfarge / iconColor på gruppe), lys = lampefarge mørknet / --ki-lr-bulb-off
    const ic = M.icon(L.icon || 'lightbulb', 20, `--lr-b:${LO(st.on ? lk.ink : 'var(--ki-lr-bulb-off)')};color:var(--lr-b, ${st.on && L.iconColor ? L.iconColor : 'currentColor'})`);
    const ent = !st.grp && st.S[0] ? ` data-ent="${esc(st.ids[0])}"` : '';
    let h = `<div class="lr-h"${ent}>${ic}<span class="lr-n">${esc(st.name)}</span><span class="lr-p">${esc(st.val)}</span></div>`;
    if (!st.onoff) {
      const p = st.p;
      h += `<div class="lr-c"><div class="lr-sl" role="slider" tabindex="0" aria-label="${esc(st.name)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p}" aria-valuetext="${esc(st.val)}">`
        + `<span class="lr-f" style="flex:${p} 1 0;display:${p > 0 ? 'block' : 'none'};--lr-fl:${LO(lk.grad)};background:var(--lr-fl, ${st.fill})"></span><span class="lr-k"></span>`
        + `<span class="lr-t" style="flex:${100 - p} 1 0;display:${p < 100 ? 'block' : 'none'}"></span></div>`
        + (st.canX ? `<button class="lr-cv" type="button" aria-label="${st.type === 'ct' ? 'Temperatur' : 'Farge'}" aria-expanded="${st.open}">${M.icon('expand_more', 22, `transform:${st.open ? 'rotate(180deg)' : 'none'};transition:transform .2s`)}</button>` : '')
        + '</div>';
    } else {
      h += `<button class="lr-sw${st.p > 0 ? ' on' : ''}" type="button" role="switch" aria-checked="${st.p > 0}" aria-label="${esc(st.name)}" style="--lr-on:${LO(lk.grad)}"><span class="lr-swf">${M.icon('power_settings_new', 18)}</span><span class="lr-swd"></span></button>`;
    }
    if (st.open) {
      const ct = st.type === 'ct';
      const xv = M.clamp(ct ? ((st.ct - st.kmin) / (st.kmax - st.kmin)) * 100 : st.hue / 3.6, 0, 100);
      h += `<div class="lr-x"><div class="lr-xh"><span class="lr-xl">${ct ? 'Temperatur' : 'Farge'}</span><span class="lr-xv">${ct ? `${st.ct} K` : `${st.hue}°`}</span></div>`
        + `<div class="lr-xb" role="slider" aria-label="${ct ? 'Temperatur' : 'Farge'}" style="background:${ct ? BAR_CT : BAR_HUE}"><span class="lr-xk" style="left:calc(${Math.round(xv * 10) / 10}% - 17px);background:${ct ? KNOB_CT : KNOB_HUE(st.hue)}"></span></div></div>`;
    }
    return h;
  }
  const cls = (L, st) => `lr${st.drag ? ' lr-drag' : ''}${st.dis ? ' lr-dis' : ''}${L.cls ? ' ' + L.cls : ''}`;

  M.renderLightRow = function (card, L) {
    const rs = lrs(card), st = rowState(card, L);
    rs.rows[st.key] = L;
    M.bindLightRows(card);
    return `<div class="${cls(L, st)}" data-lr="${esc(st.key)}" data-key="lr-${esc(st.key)}">${inner(card, L, st)}</div>`;
  };
  // Tegn bare én rad på nytt (under dra / etter trykk) – samme markup som kortets render, morph bevarer nodene.
  function refresh(card, key) {
    const R = card.shadowRoot, L = lrs(card).rows[key];
    if (!R || !L) return;
    const row = [...R.querySelectorAll('.lr[data-lr]')].find((e) => e.dataset.lr === key);
    if (!row) return;
    const st = rowState(card, L), c = cls(L, st);
    if (row.className !== c) row.className = c;
    M.morph(row, inner(card, L, st));
  }

  /* ------------------------------------------------------------ tjenestekall */
  // p: 0 = av, -1 = på (forrige nivå), 1–100 = lysstyrke. Ikke-lys (switch/input_boolean i en gruppe) via homeassistant.*
  function callMain(card, L, p) {
    const h = card.hass, grp = Array.isArray(L.ids) && L.ids.length > 0, ids = grp ? L.ids : [L.id];
    if (!h || !ids.length) return;
    const D = (id) => (String(id).startsWith('light.') ? 'light' : 'homeassistant');
    const by = (list, svc, extra) => {
      const Ls = list.filter((id) => D(id) === 'light'), O = list.filter((id) => D(id) !== 'light');
      if (Ls.length) M.call(h, 'light', svc, { entity_id: grp ? Ls : Ls[0], ...(extra || {}) });
      if (O.length) M.call(h, 'homeassistant', svc, { entity_id: grp ? O : O[0] });
    };
    if (!p) return by(ids, 'turn_off');
    const st = rowState(card, L);
    if (p < 0 || st.onoff) return by(ids, 'turn_on');
    if (!grp) return by(ids, 'turn_on', { brightness_pct: p });
    const dim = Array.isArray(L.dim) ? ids.filter((id) => L.dim.includes(id)) : ids.filter((id) => h.states[id] && M.lightType(h.states[id]) !== 'onoff');
    if (dim.length) M.call(h, 'light', 'turn_on', { entity_id: dim, brightness_pct: p });
    const plain = ids.filter((id) => !dim.includes(id));
    if (plain.length) by(plain, 'turn_on');
  }
  function fire(card, L, kind, v) {
    if (kind === 'main') return callMain(card, L, v);
    const id = L.id;
    if (!id || !String(id).startsWith('light.')) return undefined;
    return M.call(card.hass, 'light', 'turn_on', kind === 'ct' ? { entity_id: id, color_temp_kelvin: v } : { entity_id: id, hs_color: [v, 100] });
  }
  // throttlet 150 ms mens man drar, alltid én gang ved slipp
  function send(card, L, d, final) {
    const now = Date.now();
    d.q = d.v;
    const go = () => { d.sentAt = Date.now(); const q = d.q; if (!final && d.last === q) return; d.last = q; fire(card, L, d.kind, q); };
    if (final) { if (d.tm) { clearTimeout(d.tm); d.tm = null; } go(); return; }
    if (now - d.sentAt >= 150) { if (d.tm) { clearTimeout(d.tm); d.tm = null; } go(); return; }
    if (!d.tm) d.tm = setTimeout(() => { d.tm = null; if (!d.done) go(); }, 150 - (now - d.sentAt));
  }

  /* ------------------------------------------------------------ drag (designets drag(down/move/up)) */
  function down(card, el, e) {
    if (e.button) return;
    const rs = lrs(card), row = el.closest('.lr'), key = row && row.dataset.lr, L = key != null && rs.rows[key];
    if (!L || (rs.drag && rs.drag.id !== e.pointerId)) return;
    const st = rowState(card, L);
    if (st.dis) return;
    const x = el.classList.contains('lr-xb');
    const d = { key, el, id: e.pointerId, x0: e.clientX, y0: e.clientY, moved: false, v: null, kind: x ? (st.type === 'ct' ? 'ct' : 'hue') : 'main', st, sentAt: 0, tm: null, last: null, done: false };
    const val = (cx) => { const r = el.getBoundingClientRect(); return Math.round(M.clamp((cx - r.left) / Math.max(1, r.width), 0, 1) * 100); };
    const set = (v) => {
      let nv;
      if (d.kind === 'main') {
        nv = v;
        const u = L.user || {}, lo = Math.max(1, Number(u.brightness_min) || 1), hi = Math.max(lo, Number(u.brightness_max) || 100);
        if (nv > 0) nv = M.clamp(nv, lo, hi);
      } else nv = d.kind === 'ct' ? Math.round(st.kmin + (v / 100) * (st.kmax - st.kmin)) : Math.round(v * 3.6);
      if (nv === d.v) return;
      d.v = nv;
      refresh(card, key);
      send(card, L, d, false);
    };
    const mv = (ev) => {
      if (ev.pointerId !== d.id) return;
      ev.stopPropagation();
      const dx = ev.clientX - d.x0, dy = ev.clientY - d.y0;
      if (!d.moved) {
        if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { end(ev, true); return; } // loddrett = scroll
        if (Math.abs(dx) <= 5) return;
        d.moved = true;
        rs.drag = d;
        try { el.setPointerCapture(d.id); } catch (z) { /* */ }
        M.haptic('selection');
      }
      if (ev.cancelable) ev.preventDefault();
      set(val(ev.clientX));
    };
    const end = (ev, abort) => {
      if (ev && ev.pointerId !== d.id) return;
      window.removeEventListener('pointermove', mv, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', cn, true);
      if (rs.drag === d) rs.drag = null;
      d.done = true;
      if (d.moved && d.v != null) {
        const pd = (rs.pend[key] = rs.pend[key] || {});
        if (d.kind === 'main') { pd.p = d.v; pd.pt = Date.now(); } else { pd[d.kind] = d.v; pd.xt = Date.now(); }
        send(card, L, d, true);
      } else if (!abort && ev && ev.type === 'pointerup' && d.kind === 'main') tap(card, L, key);
      refresh(card, key);
    };
    const up = (ev) => end(ev, false), cn = (ev) => end(ev, true);
    window.addEventListener('pointermove', mv, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', cn, true);
  }
  // trykk på slideren / bryteren = av/på (på = forrige nivå fra HA)
  function tap(card, L, key) {
    const rs = lrs(card), st = rowState(card, L), pd = (rs.pend[key] = rs.pend[key] || {});
    M.haptic('light');
    if (st.p > 0) { pd.p = 0; pd.pt = Date.now(); callMain(card, L, 0); return; }
    if (st.onoff) { pd.p = 100; pd.pt = Date.now(); }
    callMain(card, L, -1);
  }

  M.bindLightRows = function (card) {
    const R = card && card.shadowRoot;
    if (!R || R.__lrBound) return;
    R.__lrBound = true;
    const ctl = (e) => (e.target && e.target.closest ? e.target.closest('.lr-sl,.lr-xb') : null);
    // fallgruve 2: Bubble Cards swipe-to-close / scroll skal aldri se dragene
    const stop = (e) => { if (ctl(e)) e.stopPropagation(); };
    R.addEventListener('touchstart', stop, { passive: true });
    R.addEventListener('touchmove', stop, { passive: true });
    R.addEventListener('pointerdown', (e) => { const el = ctl(e); if (!el) return; e.stopPropagation(); down(card, el, e); });
    R.addEventListener('click', (e) => {
      const b = e.target && e.target.closest ? e.target.closest('.lr-cv,.lr-sw') : null;
      if (!b) return;
      const row = b.closest('.lr'), key = row && row.dataset.lr, rs = lrs(card), L = key != null && rs.rows[key];
      if (!L) return;
      e.stopPropagation();
      if (b.classList.contains('lr-cv')) { M.haptic('selection'); rs.open[key] = !rs.open[key]; refresh(card, key); return; }
      if (rowState(card, L).dis) return;
      tap(card, L, key);
      refresh(card, key);
    });
    R.addEventListener('keydown', (e) => {
      const el = e.target && e.target.classList && e.target.classList.contains('lr-sl') ? e.target : null;
      if (!el) return;
      const row = el.closest('.lr'), key = row && row.dataset.lr, rs = lrs(card), L = key != null && rs.rows[key];
      if (!L) return;
      const st = rowState(card, L);
      if (st.dis) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tap(card, L, key); refresh(card, key); return; }
      const dl = { ArrowRight: 5, ArrowUp: 5, ArrowLeft: -5, ArrowDown: -5 }[e.key];
      if (!dl) return;
      e.preventDefault();
      const p = M.clamp(st.p + dl, 0, 100), pd = (rs.pend[key] = rs.pend[key] || {});
      pd.p = p; pd.pt = Date.now();
      callMain(card, L, p);
      refresh(card, key);
    });
  };

  /* ------------------------------------------------------------ CSS (Rom v4 lights) */
  M.LIGHT_ROW_CSS = `
    .lr{display:flex;flex-direction:column;gap:8px;min-width:0}
    .lr-h{display:flex;align-items:center;gap:12px;min-width:0}
    .lr-n{flex:1;min-width:0;font-size:14px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .lr-p{font-size:12px;color:var(--ki-lr-p, var(--ki-text-mid, #979797));font-variant-numeric:tabular-nums;white-space:nowrap}
    .lr-c{display:flex;gap:8px;align-items:center}
    .lr-sl{flex:1;min-width:0;height:40px;display:flex;align-items:center;gap:6px;touch-action:pan-y;cursor:pointer;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;outline:none}
    .lr-sl:focus-visible{box-shadow:0 0 0 2px var(--ki-text-2, #afafaf);border-radius:14px}
    .lr-f{height:34px;min-width:0;border-radius:14px 5px 5px 14px;transition:flex-grow .3s;box-shadow:var(--ki-lr-fill-sh, none)}
    .lr-k{width:var(--ki-lr-kw, 4px);height:40px;border-radius:2px;flex:none;background:var(--ki-lr-k, #b08a68);box-shadow:var(--ki-lr-ksh, none)} /* ki-hex-ok slHandle */
    .lr-t{height:34px;min-width:0;border-radius:5px 14px 14px 5px;background:var(--ki-track, #6b5b50);box-shadow:var(--ki-track-sh, none);transition:flex-grow .3s} /* ki-hex-ok slTrack */
    .lr-drag .lr-f,.lr-drag .lr-t{transition:none}
    .lr-cv{width:36px;height:40px;display:grid;place-items:center;flex:none;color:var(--ki-text-2, #afafaf)}
    .lr-sw{position:relative;height:48px;width:100%;border-radius:24px;background:var(--ki-track, #695b51);box-shadow:var(--ki-track-sh, none);display:flex;align-items:center;padding:4px;box-sizing:border-box;cursor:pointer} /* ki-hex-ok swBar */
    .lr-swf{height:40px;width:52%;border-radius:20px;display:flex;align-items:center;padding-left:14px;box-sizing:border-box;background:var(--ki-lr-off, #8e7563);box-shadow:var(--ki-lr-off-sh, none);transition:transform .35s cubic-bezier(.34,1.4,.64,1),background .25s} /* ki-hex-ok swFill av */
    .lr-sw.on .lr-swf{background:var(--lr-on, linear-gradient(90deg, #b8875a, #e0b27e));box-shadow:var(--ki-lr-fill-sh, none);transform:translateX(92%)} /* ki-hex-ok swFill på */
    .lr-swf>ha-icon{color:var(--ki-lr-ic-off, ${SW_INK})}
    .lr-sw.on .lr-swf>ha-icon{color:var(--ki-lr-ic-on, ${SW_INK})}
    .lr-swd{position:absolute;right:18px;left:auto;top:20px;width:8px;height:8px;border-radius:4px;background:var(--ki-lr-dot, ${SW_INK});opacity:var(--ki-lr-dot-op, .8)}
    .lr-sw.on .lr-swd{right:auto;left:18px}
    .lr-x{display:flex;flex-direction:column;gap:6px;padding-left:11px}
    .lr-xh{display:flex;justify-content:space-between}
    .lr-xl{font-size:11px;color:var(--ki-text-3, #7f7f7f)}
    .lr-xv{font-size:12px;color:var(--ki-text-2, #afafaf);font-variant-numeric:tabular-nums}
    .lr-xb{position:relative;height:28px;border-radius:14px;touch-action:pan-y;cursor:pointer;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
    .lr-xk{position:absolute;top:-3px;width:34px;height:34px;border-radius:17px;box-shadow:0 0 0 3px var(--ki-knob, #fafafa),0 2px 8px rgb(0 0 0 / .4);pointer-events:none}
    .lr-dis .lr-sl,.lr-dis .lr-sw,.lr-dis .lr-cv{opacity:.5;pointer-events:none}
    @media (prefers-reduced-motion:reduce){.lr-f,.lr-t,.lr-swf{transition:none}}
  `;
})();
