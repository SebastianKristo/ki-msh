/* KI MSH · felles byggeklosser for sikrings-popupene (Fiks 32.3): Dørlås (#dorlas, 49-las.js) og Garasje (#garasje,
 * 62-garasje.js). Én kopi – begge kortene bruker disse, ingen egne varianter. Mål/farger 1:1 fra «Dørlås v2.dc.html» og
 * «Garasjeport.dc.html».
 *   MSH.sik.picker({ items, sel, gear, many })  velger: kort per lås/port (56 px, r 28, ikon-sirkel 40 i tilstandsfarge) + tannhjul
 *   MSH.sik.hero({ name, chip, col, state, sub, right, bottom, gap })  toppkort-skallet (r 28, #3a3a3a, radial glød)
 *   MSH.sik.badge(icon, col, spin)          56 px badge (snurrer mens låsen jobber)
 *   MSH.sik.tiles([{ icon, val, label, col, act, ent, tint }])  tre statusfliser
 *   MSH.sik.auto({ open, master, sub, rows })  sammenleggbar automatikk med hovedbryter (lukket som standard)
 *   MSH.sik.history({ sum, filters, fsel, days, more, empty })  historikk-tidslinje
 *   MSH.sik.sheet(card, { title, tabs, body, click, change, pick })  «Tilpass …»-arket (MSH.overlay tilpass + MSH.draftEditor)
 *   MSH.sik.logbook / attrHistory (bare når popupen er åpen, 5 min cache) · person · method · autoFind · isOn · flip · master
 */
(function () {
  const M = window.MSH;
  if (!M || M.sik) return;
  const esc = M.esc;
  const G = 'rgb(102 209 158)', O = 'rgb(242 181 115)', R = 'rgb(242 128 115)', Y = 'rgb(242 210 111)', B = 'rgb(115 185 242)', P = 'rgb(242 133 201)', GR = '#afafaf';
  const PK = 'linear-gradient(145deg, rgb(242 133 201) -10%, rgb(245 205 198) 100%)';
  const a = (c, x) => (/^rgb\(/.test(String(c)) ? String(c).replace(')', ` / ${x})`) : `color-mix(in srgb, ${c} ${Math.round(x * 100)}%, transparent)`);
  const hm = (t) => { const d = new Date(t); return `${M.pad(d.getHours())}:${M.pad(d.getMinutes())}`; };
  const dayKey = (t) => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
  const isToday = (t) => dayKey(t) === dayKey(Date.now());
  const isYday = (t) => dayKey(t) === dayKey(new Date(new Date().setHours(0, 0, 0, 0) - 3600000));
  const dayLabel = (t) => { if (isToday(t)) return 'I dag'; if (isYday(t)) return 'I går'; const s = new Date(t).toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' }); return s.charAt(0).toUpperCase() + s.slice(1); };
  const when = (t) => (!t || isNaN(t) ? '–' : isToday(t) ? hm(t) : isYday(t) ? 'i går ' + hm(t) : new Date(t).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' }) + ' ' + hm(t));
  const durS = (ms) => { const m = Math.max(0, Math.floor(ms / 60000)); if (m < 60) return `${m} min`; const h = Math.floor(m / 60); if (h < 24) return m % 60 ? `${h} t ${m % 60} m` : `${h} t`; const d = Math.floor(h / 24); return h % 24 ? `${d} d ${h % 24} t` : `${d} d`; };
  const dur = (ms) => { const m = Math.max(0, Math.round(ms / 60000)); if (m < 60) return `${m} min`; const h = Math.floor(m / 60), r = m % 60; if (h < 24) return r ? `${h} t ${r} min` : `${h} t`; const d = Math.floor(h / 24); return `${d} d${h % 24 ? ` ${h % 24} t` : ''}`; };
  const mmss = (s) => { s = Math.max(0, Math.round(s)); return `${Math.floor(s / 60)}:${M.pad(s % 60)}`; };

  /* ------------------------------------------------------------ velger + tannhjul */
  // items: [{ id, name, icon, state, col }]. Velgeren vises bare med mer enn ett element – tannhjulet alltid (høyrestilt).
  // 1–2: kortene deler bredden · 3+ (eller many: navnet ville blitt kuttet): raden scroller (kort ≥ 164 px, scroll-snap, fade).
  // mode: 'eq' (deler bredden likt) → 'fit' (deler bredden etter navnelengde) → 'many' (scroll). Kortet går videre til neste
  // trinn når et navn ville blitt kuttet (MSH.sik.pickerFits) – ingen navn kuttes ved 390 px, tannhjulet står alltid fast.
  function picker({ items = [], sel, gear = 'Tilpass', mode } = {}) {
    const m = items.length > 2 ? 'many' : mode || 'eq';
    const row = items.length > 1 ? `<div class="sk-prow ${m}" data-key="sk-prow" role="tablist">${items.map((it) => {
      const on = it.id === sel, c = it.col || GR;
      return `<button class="sk-pc ${on ? 'on' : ''}" role="tab" aria-selected="${on}" data-act="pick" data-id="${esc(it.id)}" data-haptic="selection" data-key="pc-${esc(it.id)}">`
        + `<span class="sk-pcc" style="background:${on ? c : a(c, 0.16)};color:${on ? '#232323' : c}">${M.icon(it.icon, 20)}</span>`
        + `<span class="sk-pct"><span class="sk-pcn">${esc(it.name)}</span><span class="sk-pcs" style="color:${c}">${esc(it.state)}</span></span></button>`;
    }).join('')}</div>` : '<span class="sk-pfill"></span>';
    return `<div class="sk-pick" data-key="sk-pick">${row}<button class="sk-gear" data-act="customize" title="${esc(gear)}" aria-label="${esc(gear)}">${M.icon('mdi:cog', 24)}</button></div>`;
  }
  // false når et navn i velgeren er kuttet (bare for eq/fit – scroll-modus kutter aldri)
  function pickerFits(root) {
    const row = root && root.querySelector('.sk-prow:not(.many)');
    if (!row) return true;
    return [...row.querySelectorAll('.sk-pcn')].every((n) => n.scrollWidth <= n.clientWidth + 1);
  }

  /* ------------------------------------------------------------ toppkort-skallet */
  function hero({ name, chip, col = GR, state, sub, right = '', bottom = '', gap = 10, key = 'sk-hero' } = {}) {
    const cc = (chip && chip.col) || col;
    return `<section class="sk-hero" data-key="${key}"><span class="sk-glow" style="background:radial-gradient(circle, ${a(col, 0.18)} 0%, transparent 70%)"></span>
      <div class="sk-htop" style="gap:${gap}px"><div class="sk-hl">
        <div class="sk-hn"><span class="sk-hname">${esc(name)}</span>${chip ? `<span class="sk-chip ${chip.blink ? 'blink' : ''}" style="background:${a(cc, 0.16)};color:${cc}">${M.icon(chip.icon, 14)}${esc(chip.text)}</span>` : ''}</div>
        <span class="sk-hstate">${esc(state)}</span><span class="sk-hsub">${esc(sub)}</span></div>${right}</div>${bottom}</section>`;
  }
  const badge = (icon, col, spin, ent) => `<span class="sk-badge ${spin ? 'spin' : 'pop'}" ${ent ? `data-ent="${esc(ent)}"` : ''} style="background:${a(col, 0.16)};color:${col}">${M.icon(icon, 28)}</span>`;

  /* ------------------------------------------------------------ statusfliser */
  function tiles(list) {
    return `<div class="sk-tiles" data-key="sk-tiles">${list.map((k, i) => {
      const t = k.act ? 'button' : 'div';
      return `<${t} class="sk-tile ${k.act ? 'act' : ''}" data-key="tile-${i}" ${k.act ? `data-act="${k.act}" data-haptic="${k.haptic || 'light'}"` : ''} ${k.id ? `data-id="${esc(k.id)}"` : ''} ${k.ent ? `data-ent="${esc(k.ent)}"` : ''} ${k.tint ? `style="background:${a(k.tint, 0.14)}"` : ''}>`
        + `${M.icon(k.icon, 22, `color:${k.col || GR}`)}<span class="sk-tt"><span class="sk-tv num">${esc(k.val)}</span><span class="sk-tl">${esc(k.label)}</span></span></${t}>`;
    }).join('')}</div>`;
  }

  /* ------------------------------------------------------------ automatikk (sammenleggbar, hovedbryter) */
  // rows: [{ k, icon, label, sub, ent, on, mins: { opts, cur, disabled } }]. Hovedbryteren er en egen knapp (stopPropagation
  // i kortet), så den påvirker aldri utfoldingen. Av → radene dempes (.4) og tar ikke imot trykk.
  const swH = (on) => `<span class="sk-sw ${on ? 'on' : ''}"><i></i></span>`;
  function auto({ open, master, sub, rows = [] } = {}) {
    return `<section class="sk-auto" data-key="sk-auto"><div class="sk-ahd">
      <button class="sk-atog" data-act="am-open" data-haptic="selection" aria-expanded="${!!open}"><span class="sk-ac" style="background:${master ? a(P, 0.18) : '#2f2f2f'};color:${master ? P : '#7f7f7f'}">${M.icon('mdi:auto-mode', 22)}</span>
        <span class="sk-at"><span class="sk-atn">Automatikk</span><span class="sk-ats">${esc(sub)}</span></span><span class="sk-chev ${open ? 'up' : ''}">${M.icon('mdi:chevron-down', 22)}</span></button>
      <button class="sk-sw sk-master ${master ? 'on' : ''}" data-act="am-master" data-haptic="medium" role="switch" aria-checked="${!!master}" title="Automatikk av/på" aria-label="Automatikk av/på"><i></i></button></div>
      ${open ? `<div class="sk-alist ${master ? '' : 'off'}" data-key="sk-alist" ${master ? '' : 'aria-disabled="true"'}>${rows.map((r) => `<div class="sk-ar" data-key="ar-${r.k}">
        <button class="sk-arb" data-act="am-row" data-k="${r.k}" data-haptic="selection" ${master ? '' : 'tabindex="-1"'} role="switch" aria-checked="${!!r.on}">${M.icon(r.icon, 22, 'color:#afafaf')}<span class="sk-at"><span class="sk-arl">${esc(r.label)}</span><span class="sk-ats">${esc(r.ent ? r.sub : 'Velg entitet')}</span></span>${r.ent ? swH(r.on) : `<span class="sk-miss">–</span>`}</button>
        ${r.mins ? `<div class="sk-mins">${r.mins.opts.map((m) => `<button class="${m === r.mins.cur ? 'on' : ''}" data-act="am-min" data-k="${r.k}" data-v="${m}" data-haptic="selection" ${r.mins.disabled ? 'disabled' : ''}>${m} min</button>`).join('')}</div>` : ''}</div>`).join('')}</div>` : ''}
    </section>`;
  }

  /* ------------------------------------------------------------ historikk-tidslinje */
  // days: [{ key, label, rows: [{ key, time, title, col, kind: 'dot'|'ring'|'warn', who: { ini, col }, method: { icon, label }, extra }] }]
  function hrow(h, first, last) {
    const ring = h.kind === 'ring', warn = h.kind === 'warn';
    const dot = `background:${ring ? '#3a3a3a' : h.col};${ring ? 'border:2px solid #7f7f7f;' : ''}box-shadow:0 0 0 4px #3a3a3a${warn ? `, 0 0 0 6px ${a(R, 0.3)}` : ''}`;
    const meta = (h.who ? `<span class="sk-av" style="background:${h.who.col}">${esc(h.who.ini)}</span>` : '') + (h.method ? `<span class="sk-mc">${M.icon(h.method.icon, 13)}${esc(h.method.label)}</span>` : '') + (h.extra ? `<span class="sk-hx">${esc(h.extra)}</span>` : '');
    return `<div class="sk-hr" data-key="${esc(h.key)}" data-kind="${esc(h.type || '')}"><span class="sk-ht num">${esc(h.time)}</span><span class="sk-hd"><span class="sk-l1" style="background:${first ? 'transparent' : '#4a4a4a'}"></span><span class="sk-l2" style="background:${last ? 'transparent' : '#4a4a4a'}"></span><span class="sk-dot" style="${dot}"></span></span>
      <div class="sk-hb"><span class="sk-htt">${esc(h.title)}</span>${meta ? `<span class="sk-hm">${meta}</span>` : ''}</div></div>`;
  }
  function history({ sum = '', filters, fsel, days = [], more, empty = 'Ingen hendelser' } = {}) {
    const fl = filters ? `<div class="sk-hf" data-key="sk-hf" data-glass-drag="x">${filters.map((f) => { const on = f.k === fsel; return `<button class="sk-fc ${on ? 'on' : ''} ${!on && f.warn && f.n ? 'warn' : ''}" data-act="h-filter" data-k="${f.k}" data-haptic="selection" aria-pressed="${on}">${M.icon(f.icon, 16)}${esc(f.label)}<span class="sk-fn">${f.n}</span></button>`; }).join('')}</div>` : '';
    const body = days.map((d) => `<div class="sk-day" data-key="day-${esc(d.key)}"><span class="sk-dl">${esc(d.label)}</span>${d.rows.map((h, i) => hrow(h, i === 0, i === d.rows.length - 1)).join('')}</div>`).join('');
    return `<section class="sk-hist" data-key="sk-hist"><div class="sk-hh"><span class="sk-cap">Historikk</span><span class="sk-hs">${esc(sum)}</span></div>${fl}
      <div class="sk-hlist">${body || `<span class="sk-hnone">${esc(empty)}</span>`}</div>
      ${more ? `<button class="sk-more" data-act="h-more" data-haptic="light">${esc(more.label)}${M.icon(more.up ? 'mdi:chevron-up' : 'mdi:chevron-down', 18)}</button>` : ''}</section>`;
  }
  // Hendelser (nyeste først) → dager med rader (mk(e) → rad)
  function groupDays(evs, mk) {
    const out = [];
    evs.forEach((e) => { const k = dayKey(e.t); let d = out[out.length - 1]; if (!d || d.key !== k) { d = { key: k, label: dayLabel(e.t), rows: [] }; out.push(d); } d.rows.push(mk(e)); });
    return out;
  }

  /* ------------------------------------------------------------ data: logbook + attributter (bare når popupen er åpen) */
  const LB = new Map(), AH = new Map(), TTL = 300000;
  function logbook(hass, ids, days = 7, force) {
    ids = [...new Set((ids || []).filter(Boolean))].sort();
    if (!ids.length || !hass || !hass.callWS) return Promise.resolve([]);
    const key = ids.join(',') + '|' + days, c = LB.get(key);
    if (c && !force && Date.now() - c.t < TTL) return c.p;
    const p = Promise.resolve().then(() => hass.callWS({ type: 'logbook/get_events', start_time: new Date(Date.now() - days * 86400000).toISOString(), end_time: new Date().toISOString(), entity_ids: ids }))
      .then((r) => (Array.isArray(r) ? r : []).filter((e) => e && e.entity_id && e.state != null && e.when != null)
        .map((e) => ({ id: e.entity_id, state: String(e.state), t: typeof e.when === 'number' ? e.when * 1000 : new Date(e.when).getTime(), user: e.context_user_id || null, ctxEnt: e.context_entity_id || null, ctxName: e.context_entity_id_name || e.context_name || null, ctxDomain: e.context_domain || null }))
        .sort((x, y) => y.t - x.t))
      .catch(() => []);
    LB.set(key, { t: Date.now(), p });
    return p;
  }
  // Attributtene per tilstandsendring (changed_by, method, code_slot …) – låsene bare, 5 min cache
  function attrHistory(hass, ids, days = 7) {
    ids = [...new Set((ids || []).filter(Boolean))].sort();
    if (!ids.length || !hass || !hass.callWS) return Promise.resolve({});
    const key = ids.join(',') + '|' + days, c = AH.get(key);
    if (c && Date.now() - c.t < TTL) return c.p;
    const p = Promise.resolve().then(() => hass.callWS({ type: 'history/history_during_period', start_time: new Date(Date.now() - days * 86400000).toISOString(), entity_ids: ids, minimal_response: false, no_attributes: false, significant_changes_only: false }))
      .then((r) => { const out = {}; ids.forEach((id) => { out[id] = ((r && r[id]) || []).map((x) => ({ t: ((x.lu || x.lc || 0) * 1000) || new Date(x.last_changed || x.last_updated || 0).getTime(), s: x.s != null ? String(x.s) : String(x.state), a: x.a || x.attributes || {} })).filter((x) => x.a && Object.keys(x.a).length); }); return out; })
      .catch(() => ({}));
    AH.set(key, { t: Date.now(), p });
    return p;
  }
  const attrsAt = (AHmap, e) => { const L = (AHmap && AHmap[e.id]) || []; let best = null; L.forEach((x) => { if (x.s === e.state && Math.abs(x.t - e.t) < 5000 && (!best || Math.abs(x.t - e.t) < Math.abs(best.t - e.t))) best = x; }); return best ? best.a : null; };

  /* ------------------------------------------------------------ person + metode */
  const PAL = [P, 'rgb(182 155 242)', B, G, O, Y];
  // key = context_user_id eller et navn (changed_by). Bare kjente personer/brukere gir en person.
  function person(hass, key) {
    if (!hass || !key) return null;
    const ps = M.all(hass, 'person');
    let id = ps.find((p) => hass.states[p].attributes.user_id === key);
    if (!id) { const k = String(key).trim().toLowerCase(); id = ps.find((p) => M.name(hass, p).toLowerCase() === k || p.split('.')[1] === M.slug(key)); }
    let name = id ? M.name(hass, id) : null;
    if (!name && hass.user && hass.user.id === key) name = hass.user.name || null;
    if (!name) return null;
    const i = id ? ps.indexOf(id) : [...name].reduce((s, ch) => s + ch.charCodeAt(0), 0);
    return { name, ini: name.trim().charAt(0).toUpperCase(), col: PAL[Math.abs(i) % PAL.length] };
  }
  const METHOD = {
    code: ['mdi:dialpad', 'Kode'], app: ['mdi:cellphone', 'Appen'], auto: ['mdi:lock-clock', 'Autolås'], key: ['mdi:key-variant', 'Nøkkel'], face: ['mdi:face-recognition', 'Ansikt'],
    away: ['mdi:walk', 'Alle dro'], night: ['mdi:weather-night', 'Nattlås'], sensor: ['mdi:access-point', 'Sensor'],
    autoclose: ['mdi:timer-outline', 'Autolukk'], car: ['mdi:car-electric', 'Tesla'], remote: ['mdi:remote', 'Fjernkontroll'],
  };
  const mth = (k, label) => ({ k, icon: (METHOD[k] || ['mdi:robot'])[0], label: label || (METHOD[k] || [0, 'Automasjon'])[1] });
  // Metode for en hendelse: attributtene (method, changed_by, code_slot) → automasjonen som utløste den → Appen (bruker).
  // kind: 'lock' | 'garage'. Ukjent automasjon → automasjonsnavnet.
  function method(hass, e, attrs, kind) {
    const A = attrs || {}, t = `${A.method || ''} ${A.lock_source || ''} ${A.operation_source || ''} ${A.changed_by || ''}`.toLowerCase();
    if (kind === 'lock') {
      if ((A.code_slot != null && A.code_slot !== '' && Number(A.code_slot) !== 0) || /keypad|kode|code|pin|tastatur/.test(t)) return mth('code');
      if (/face|ansikt/.test(t)) return mth('face');
      if (/auto/.test(t)) return mth('auto');
      if (/manual|manuell|n[oø]kkel|key|thumb|vri/.test(t)) return mth('key');
      if (/\brf\b|app|remote|ble|bluetooth|wifi|digital|zigbee|z-?wave/.test(t)) return mth('app');
    }
    const ce = e && e.ctxEnt;
    if (ce && /^(automation|script)\./.test(ce)) {
      const n = String(e.ctxName || M.name(hass, ce) || ce), s = n.toLowerCase() + ' ' + ce;
      if (kind === 'lock') { if (/autol[aå]s|auto.?lock|relock/.test(s)) return mth('auto'); if (/alle.?dr|borte|away|leav/.test(s)) return mth('away'); if (/natt|night/.test(s)) return mth('night'); if (/ansikt|face/.test(s)) return mth('face'); }
      else { if (/autolukk|auto.?close|auto.?lukk/.test(s)) return mth('autoclose'); if (/tesla|ankom|arriv|bil\b|car/.test(s)) return mth('car'); if (/alle.?dr|borte|away|leav/.test(s)) return mth('away'); }
      return { k: 'automation', icon: 'mdi:robot-outline', label: n };
    }
    if (e && e.user) return mth('app');
    return kind === 'garage' ? mth('remote') : mth('app');
  }

  /* ------------------------------------------------------------ automatikk-brytere (KI Varslinger og sikkerhet, 29.1) */
  // defs: [{ k, rx, not, fb(hass) }]. Overstyring ov[k] (entitet, 'none' = ingen) → MSH.finnBrytere (enhetsnavn/navn/slug) → fb.
  function autoFind(hass, defs, ov) {
    const L = hass && M.finnBrytere ? M.finnBrytere(hass) : [], out = {};
    (defs || []).forEach((d) => {
      const o = ov && ov[d.k];
      if (o === 'none') { out[d.k] = null; return; }
      if (o && hass.states[o]) { out[d.k] = o; return; }
      const b = L.find((x) => { const t = `${x.enhet} ${x.navn} ${x.slug}`.toLowerCase(); return d.rx.test(t) && !(d.not && d.not.test(t)); });
      out[d.k] = (b && b.id) || (d.fb ? d.fb(hass) : null) || null;
    });
    return out;
  }
  // Tall-entitet (minutter) på samme enhet som bryteren
  function minsOn(hass, swId, rx) {
    const e = swId && hass.entities && hass.entities[swId];
    if (!e || !e.device_id) return null;
    return Object.keys(hass.entities).find((x) => /^(number|input_number)\./.test(x) && hass.entities[x].device_id === e.device_id && hass.states[x] && (!rx || rx.test(x + ' ' + (hass.states[x].attributes.friendly_name || '')) || /min/.test(String(hass.states[x].attributes.unit_of_measurement || '')))) || null;
  }
  // Minutter fra en tall-entitet (s/h-enheter regnes om)
  function minsOf(hass, id) {
    const s = id && hass.states[id];
    if (!s || !M.isNum(s.state)) return null;
    const v = Number(s.state), u = String(s.attributes.unit_of_measurement || 'min');
    return /^s/.test(u) ? Math.round(v / 60) : /^(h|t)/.test(u) ? v * 60 : v;
  }
  function setMins(hass, id, m) {
    const s = id && hass.states[id];
    if (!s) return Promise.resolve();
    const u = String(s.attributes.unit_of_measurement || 'min'), A = s.attributes;
    let v = /^s/.test(u) ? m * 60 : /^(h|t)/.test(u) ? m / 60 : m;
    v = M.clamp(v, A.min != null ? Number(A.min) : -Infinity, A.max != null ? Number(A.max) : Infinity);
    return M.call(hass, id.split('.')[0], 'set_value', { entity_id: id, value: v });
  }

  /* ------------------------------------------------------------ optimistisk av/på med tilbakerulling (27.6) */
  const SYNC_MS = 10000;
  function isOn(card, id) {
    const s = card.hass && id && card.hass.states[id];
    if (!s) return false;
    const real = s.state === 'on', o = card._opt && card._opt[id];
    if (o) { if (real === o.want) { clearTimeout(o.tm); delete card._opt[id]; return real; } return o.want; }
    return real;
  }
  function flip(card, id, want) {
    const h = card.hass, s = h && id && h.states[id];
    if (!s || M.unavailable(s)) return;
    if (want == null) want = !isOn(card, id);
    card._opt = card._opt || {};
    const old = card._opt[id];
    if (old) clearTimeout(old.tm);
    if ((s.state === 'on') === want) delete card._opt[id];
    else {
      const o = { want };
      o.tm = setTimeout(() => { if (!card._opt || card._opt[id] !== o) return; delete card._opt[id]; M.haptic('warning'); M.toast(`Fikk ikke svar fra ${M.name(card.hass, id)} – rullet tilbake`); card.update(); }, M.sik.SYNC_MS);
      card._opt[id] = o;
    }
    const p = M.call(h, 'homeassistant', want ? 'turn_on' : 'turn_off', { entity_id: id });
    if (p && p.catch) p.catch(() => { const o = card._opt && card._opt[id]; if (o) { clearTimeout(o.tm); delete card._opt[id]; card.update(); } });
    card.update();
  }
  // Hovedbryter: på = minst én bryter på. Av → husker hvilke som var på (ui.amMem) og slår alle av; på → slår de huskede
  // (eller alle) på igjen. De enkelte valgene beholdes.
  function masterOn(card, ids) { return ids.some((id) => isOn(card, id)); }
  function master(card, ids) {
    if (!ids.length) return;
    const mem = { ...(card.ui.amMem || {}) };
    if (masterOn(card, ids)) {
      const was = ids.filter((id) => isOn(card, id));
      mem.ids = was;
      card.setUI({ amMem: mem }, true);
      was.forEach((id) => flip(card, id, false));
    } else {
      const want = (mem.ids || []).filter((id) => ids.includes(id));
      (want.length ? want : ids).forEach((id) => flip(card, id, true));
    }
  }
  // Vist på/av for en rad: hovedbryter på → faktisk (optimistisk) tilstand; av → det som huskes
  const rowOn = (card, id, mOn) => (mOn ? isOn(card, id) : ((card.ui.amMem || {}).ids || []).includes(id));

  /* ------------------------------------------------------------ «Tilpass …»-arket */
  // Ark 50 px fra toppen, til bunnen, samme høyde i alle faner (MSH.overlay tilpass: true). Utkast (MSH.draftEditor):
  // endringer vises straks i popupen og lagres i kortets config ved Ferdig (rosa pille). Bakteppe/Esc = Avbryt.
  //   o.tabs: [[k, label]] | () => …   o.body(tab, draft, api) → HTML   o.click(a, el, api)   o.change(el, api)   o.pick(el, value, api)
  //   api: { st, D(), set(patch, haptic), path(p, v, haptic), draw() }   (undefined fjerner nøkkelen)
  const setPath = (obj, p, v) => {
    const ks = String(p).split('.'), out = { ...obj }; let cur = out;
    for (let i = 0; i < ks.length - 1; i++) { cur[ks[i]] = { ...(cur[ks[i]] && typeof cur[ks[i]] === 'object' ? cur[ks[i]] : {}) }; cur = cur[ks[i]]; }
    if (v === undefined) delete cur[ks[ks.length - 1]]; else cur[ks[ks.length - 1]] = v;
    // tomme objekter ryddes bort
    const prune = (o, path) => { if (!path.length) return; const [k, ...r] = path; if (o[k] && typeof o[k] === 'object' && !Array.isArray(o[k])) { prune(o[k], r); if (!Object.keys(o[k]).length) delete o[k]; } };
    prune(out, ks.slice(0, -1));
    return out;
  };
  function sheet(card, o) {
    if (card._sheet && card._sheet.ov && !card._sheet.ov.closed) return card._sheet;
    let ov = null, box = null;
    const st = { tab: o.tab || (typeof o.tabs === 'function' ? o.tabs() : o.tabs)[0][0], busy: false, pick: null };
    const ctl = M.draftEditor(card, {
      saveOpts: { scope: 'shared' },
      banner: () => ov && ov.body,
      alive: () => !ov || ov.host.isConnected,
      close: () => ov && ov.close(),
      onBusy: (b) => { st.busy = b; draw(); },
      onReload: () => draw(),
    });
    const D = () => ctl.draft || {};
    const api = {
      st, D, ctl, card,
      set(patch, hap) { if (st.busy) return; let n = { ...D() }; Object.keys(patch).forEach((k) => { n = setPath(n, k, patch[k]); }); ctl.set(n); if (hap) M.haptic(hap); draw(); },
      draw: () => draw(),
    };
    api.path = (p, v, hap) => api.set({ [p]: v }, hap);
    const draw = () => {
      if (!ov || !box) return;
      const sh = ov.root.querySelector('.sh'), top = sh ? sh.scrollTop : 0;
      const tabs = typeof o.tabs === 'function' ? o.tabs() : o.tabs;
      M.morph(box, `<div class="sk-sh-hd"><span class="sk-sh-tt">${esc(o.title)}</span><button class="sk-ok" data-a="done" ${st.busy ? 'disabled aria-busy="true"' : ''}>${st.busy ? 'Lagrer …' : 'Ferdig'}</button></div>
        <div class="sk-sh-tabs" role="tablist" data-glass-drag="x" style="grid-template-columns:repeat(${tabs.length},minmax(0,1fr))">${tabs.map(([k, l]) => `<button class="sk-sh-tab ${k === st.tab ? 'on' : ''}" role="tab" aria-selected="${k === st.tab}" data-a="tab" data-k="${k}">${esc(l)}</button>`).join('')}</div>
        <div class="sk-sh-pane" data-tab="${st.tab}">${o.body(st.tab, D(), api)}</div>`);
      if (sh) sh.scrollTop = top;
      box.querySelectorAll('msh-entity-picker').forEach((p) => { p.hass = card.hass; if (!p.__op) { p.__op = 1; setTimeout(() => { try { p.open(); } catch (e) { /* */ } }, 0); } });
    };
    ov = M.overlay({ html: '', css: SHEET_CSS, maxWidth: 440, tall: true, tilpass: true, onClose: () => { ctl.dispose(); card._sheet = null; } });
    box = document.createElement('div');
    box.className = 'sk-sheet';
    Object.defineProperty(box, '_config', { get: () => ctl.draft }); // utkastet (samme config som GUI-editoren, checklist)
    ov.body.appendChild(box);
    ov.root.addEventListener('click', (e) => {
      const el = e.composedPath().find((n) => n && n.dataset && n.dataset.a);
      if (!el || el.disabled) return;
      const k = el.dataset.a;
      if (k === 'done') { M.haptic('success'); return ctl.done(); }
      if (k === 'tab') { if (el.dataset.k !== st.tab) { st.tab = el.dataset.k; st.pick = null; M.haptic('selection'); draw(); } return undefined; }
      if (k === 'bytt') { st.pick = st.pick === el.dataset.k ? null : el.dataset.k; M.haptic('light'); return draw(); }
      return o.click ? o.click(k, el, api) : undefined;
    });
    ov.root.addEventListener('change', (e) => { const t = e.composedPath()[0]; if (t && t.dataset && t.dataset.in && o.change) o.change(t, api); });
    ov.root.addEventListener('value-changed', (e) => { const t = e.composedPath().find((n) => n && n.dataset && n.dataset.pk); if (!t || !o.pick) return; st.pick = null; o.pick(t, (e.detail || {}).value, api); });
    if (M.glassDrag) setTimeout(() => { const t = ov.root.querySelector('.sk-sh-tabs'); if (t) M.glassDrag(t, { axis: 'x' }); }, 0);
    card._sheet = { ov, st, box, api };
    draw();
    return card._sheet;
  }
  // Byggeklosser i arket
  const shSw = (on, attrs) => `<button class="sk-sw ${on ? 'on' : ''}" role="switch" aria-checked="${!!on}" ${attrs || ''}><i></i></button>`;
  const shSeg = (opts, cur, attrs) => `<div class="sk-seg" style="grid-template-columns:repeat(${opts.length},minmax(0,1fr))">${opts.map(([v, l]) => `<button class="${String(v) === String(cur) ? 'on' : ''}" aria-pressed="${String(v) === String(cur)}" ${attrs(v)}>${esc(l)}</button>`).join('')}</div>`;
  const shSec = (cap, inner, cls) => `<section class="sk-sec ${cls || ''}">${cap ? `<span class="sk-cap">${esc(cap)}</span>` : ''}${inner}</section>`;
  const shRow = ({ icon, label, sub, on, attrs }) => `<button class="sk-srow" ${attrs || ''} role="switch" aria-checked="${!!on}">${M.icon(icon, 22, 'color:#afafaf')}<span class="sk-at"><span class="sk-arl">${esc(label)}</span>${sub ? `<span class="sk-ats">${esc(sub)}</span>` : ''}</span>${swH(on)}</button>`;
  // Entitetsrad: «Auto» (funnet selv) / «Valgt» (overstyrt) / «Mangler» + «Bytt» (innebygd søkbar velger)
  function shEnt(api, { k, icon, label, id, own, auto, domains, deviceClass, noneLabel }) {
    const chip = id ? (own ? ['Valgt', B] : ['Auto', G]) : ['Mangler', O];
    const open = api.st.pick === k;
    return `<div class="sk-ent" data-key="ent-${esc(k)}"><div class="sk-entr">${M.icon(icon, 18, 'color:#979797')}<span class="sk-at"><span class="sk-ats">${esc(label)}</span><span class="sk-eid">${esc(id || 'Velg entitet')}</span></span>
      <span class="sk-echip" style="background:${a(chip[1], 0.18)};color:${chip[1]}">${chip[0]}</span><button class="sk-bytt" data-a="bytt" data-k="${esc(k)}" aria-expanded="${open}">Bytt</button></div>
      ${open && M.entityPicker ? `<div class="sk-epk">${M.entityPicker.html({ key: 'pk-' + k, value: own || '', auto: auto || '', autoMode: true, domains, deviceClass, noneLabel, placeholder: 'Velg entitet', attrs: `data-pk="${esc(k)}"` })}</div>` : ''}</div>`;
  }

  /* ------------------------------------------------------------ CSS */
  const CSS = `
    .sk-wrap{display:flex;flex-direction:column;gap:var(--msh-gap, 8px)}
    .num{font-variant-numeric:tabular-nums}
    .sk-pick{display:flex;align-items:stretch;gap:8px}
    .sk-pfill{flex:1}
    .sk-prow{flex:1;min-width:0;display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;touch-action:pan-x pan-y;scroll-snap-type:x mandatory}
    .sk-prow::-webkit-scrollbar{display:none}
    .sk-prow.many{-webkit-mask-image:linear-gradient(90deg,#000 85%,transparent);mask-image:linear-gradient(90deg,#000 85%,transparent);padding-right:24px}
    .sk-pc{flex:1 1 0;min-width:0;height:56px;padding:0 12px 0 8px;border-radius:28px;display:flex;align-items:center;gap:8px;background:var(--gray200,#3a3a3a);box-shadow:inset 0 0 0 1px rgba(255,255,255,0.05);scroll-snap-align:start;transition:background .2s,box-shadow .2s;text-align:left}
    .sk-prow.fit .sk-pc{flex:1 1 auto}
    .sk-prow.many .sk-pc{flex:0 0 auto;min-width:164px;max-width:280px}
    .sk-pc.on{background:var(--gray300,#404040);box-shadow:inset 0 0 0 1.5px ${P}}
    .sk-pcc{width:40px;height:40px;border-radius:20px;flex:none;display:grid;place-items:center;transition:background .2s}
    .sk-pct{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
    .sk-pcn{font-size:14px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .sk-pcs{font-size:12px;white-space:nowrap;font-variant-numeric:tabular-nums}
    .sk-gear{width:56px;height:56px;border-radius:28px;flex:none;background:var(--gray200,#3a3a3a);box-shadow:inset 0 0 0 1px rgba(255,255,255,0.05);display:grid;place-items:center;color:var(--white,#fafafa)}
    .sk-gear:active,.sk-pc:active,.sk-tile.act:active{transform:scale(.97)}
    .sk-hero{position:relative;overflow:hidden;display:flex;flex-direction:column;gap:18px;padding:18px;border-radius:28px;background:var(--gray200,#3a3a3a);box-shadow:inset 0 0 0 1px rgba(255,255,255,0.05)}
    .sk-glow{position:absolute;top:-80px;right:-60px;width:240px;height:240px;border-radius:50%;pointer-events:none;transition:background .4s}
    .sk-htop{position:relative;display:flex;align-items:flex-start}
    .sk-hl{flex:1;min-width:0;display:flex;flex-direction:column;gap:8px}
    .sk-hn{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
    .sk-hname{font-size:13px;color:var(--gray800,#afafaf)}
    .sk-chip{display:inline-flex;align-items:center;gap:4px;height:24px;padding:0 10px 0 7px;border-radius:12px;font-size:12px;font-weight:500;white-space:nowrap}
    .sk-chip.blink ha-icon{animation:sk-blink 1s ease-in-out infinite}
    .sk-hstate{font-size:44px;font-weight:300;letter-spacing:-0.03em;line-height:1}
    .sk-hsub{font-size:13px;color:var(--gray700,#979797)}
    .sk-badge{width:56px;height:56px;border-radius:28px;flex:none;display:grid;place-items:center;transition:background .3s,color .3s}
    .sk-badge.pop{animation:sk-pop .4s ease}
    .sk-badge.spin ha-icon{animation:sk-spin 1s linear infinite}
    .sk-tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
    .sk-tile{display:flex;flex-direction:column;align-items:flex-start;gap:10px;padding:14px;border-radius:24px;background:var(--gray200,#3a3a3a);box-shadow:inset 0 0 0 1px rgba(255,255,255,0.05);min-width:0;text-align:left;transition:background .2s}
    .sk-tt{display:flex;flex-direction:column;gap:2px;min-width:0;max-width:100%}
    .sk-tv{font-size:17px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .sk-tl{font-size:12px;color:var(--gray700,#979797)}
    .sk-auto{display:flex;flex-direction:column;border-radius:24px;background:var(--gray200,#3a3a3a);box-shadow:inset 0 0 0 1px rgba(255,255,255,0.05)}
    .sk-ahd{display:flex;align-items:center;gap:12px;padding:0 16px 0 12px}
    .sk-atog{flex:1;min-width:0;display:flex;align-items:center;gap:12px;min-height:72px;text-align:left}
    .sk-ac{width:40px;height:40px;border-radius:20px;flex:none;display:grid;place-items:center;transition:background .2s}
    .sk-at{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;text-align:left}
    .sk-atn,.sk-arl{font-size:15px;font-weight:500}
    .sk-ats{font-size:12px;color:var(--gray700,#979797);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .sk-chev{display:inline-flex;color:var(--gray700,#979797);transition:transform .25s}
    .sk-chev.up{transform:rotate(180deg)}
    .sk-sw{position:relative;display:inline-block;width:50px;height:30px;border-radius:15px;flex:none;background:var(--gray400,#545454);transition:background .2s}
    .sk-sw i{position:absolute;top:3px;left:3px;width:24px;height:24px;border-radius:12px;background:var(--white,#fafafa);box-shadow:0 2px 6px rgba(0,0,0,0.3);transition:left .2s}
    .sk-sw.on{background:${PK}}
    .sk-sw.on i{left:23px}
    .sk-alist{padding:0 16px 6px;display:flex;flex-direction:column;border-top:1px solid rgba(255,255,255,0.06);transition:opacity .2s;animation:sk-fade .2s ease}
    .sk-alist.off{opacity:.4;pointer-events:none}
    .sk-ar{display:flex;flex-direction:column}
    .sk-ar + .sk-ar{border-top:1px solid rgba(255,255,255,0.06)}
    .sk-arb{display:flex;align-items:center;gap:12px;min-height:60px;width:100%;text-align:left}
    .sk-arb>ha-icon{width:24px}
    .sk-miss{font-size:13px;color:var(--gray600,#7f7f7f);flex:none;padding:0 6px}
    .sk-mins{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:2px;padding:3px;margin:0 0 12px 36px;border-radius:18px;background:var(--gray100,#2f2f2f)}
    .sk-mins button{height:34px;border-radius:15px;font-size:13px;font-weight:500;color:var(--gray800,#afafaf);transition:background .2s}
    .sk-mins button.on{background:var(--gray300,#404040);box-shadow:inset 0 0 0 1.5px ${P};color:var(--white,#fafafa)}
    .sk-mins button:disabled{opacity:.4}
    .sk-hist{display:flex;flex-direction:column;gap:12px;padding:14px 0 10px;border-radius:24px;background:var(--gray200,#3a3a3a);box-shadow:inset 0 0 0 1px rgba(255,255,255,0.05)}
    .sk-hh{display:flex;align-items:baseline;justify-content:space-between;gap:8px;padding:0 16px}
    .sk-cap{font-size:12px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;color:var(--gray600,#7f7f7f)}
    .sk-hs{font-size:12px;color:var(--gray700,#979797)}
    .sk-hf{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding:0 16px;touch-action:pan-x pan-y}
    .sk-hf::-webkit-scrollbar{display:none}
    .sk-fc{flex:none;height:34px;padding:0 6px 0 10px;border-radius:17px;display:flex;align-items:center;gap:6px;font-size:13px;font-weight:500;white-space:nowrap;background:var(--gray100,#2f2f2f);color:var(--gray900,#c7c7c7)}
    .sk-fc.on{background:${PK};color:#2f2f2f}
    .sk-fc.warn{color:${R}}
    .sk-fn{min-width:22px;height:22px;padding:0 6px;box-sizing:border-box;border-radius:11px;display:grid;place-items:center;font-size:11px;font-weight:600;background:var(--gray300,#404040)}
    .sk-fc.on .sk-fn{background:rgba(47,47,47,0.14)}
    .sk-hlist{display:flex;flex-direction:column;padding:0 16px}
    .sk-day{display:flex;flex-direction:column}
    .sk-dl{padding:6px 0 6px 60px;font-size:12px;font-weight:500;color:var(--gray800,#afafaf)}
    .sk-hr{display:grid;grid-template-columns:44px 16px minmax(0,1fr);column-gap:8px;align-items:stretch}
    .sk-ht{padding-top:12px;font-size:13px;color:var(--gray700,#979797);text-align:right}
    .sk-hd{position:relative;display:flex;justify-content:center}
    .sk-l1{position:absolute;left:7px;top:0;height:14px;width:2px}
    .sk-l2{position:absolute;left:7px;top:14px;bottom:0;width:2px}
    .sk-dot{position:relative;z-index:1;margin-top:13px;width:12px;height:12px;border-radius:6px;box-sizing:border-box}
    .sk-hb{display:flex;flex-direction:column;justify-content:center;gap:3px;padding:8px 0;min-height:44px;min-width:0}
    .sk-htt{font-size:14px;font-weight:500}
    .sk-hm{display:flex;align-items:center;gap:6px;min-width:0}
    .sk-av{width:18px;height:18px;border-radius:9px;flex:none;display:grid;place-items:center;font-size:10px;font-weight:600;color:#232323}
    .sk-mc{display:inline-flex;align-items:center;gap:4px;height:20px;padding:0 8px 0 6px;border-radius:10px;font-size:11px;font-weight:500;white-space:nowrap;background:var(--gray100,#2f2f2f);color:var(--gray900,#c7c7c7);min-width:0;overflow:hidden;text-overflow:ellipsis}
    .sk-hx{font-size:11px;color:var(--gray600,#7f7f7f);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .sk-hnone{padding:16px 0;text-align:center;font-size:13px;color:var(--gray700,#979797)}
    .sk-more{margin:0 16px;height:44px;border-radius:22px;display:flex;align-items:center;justify-content:center;gap:6px;font-size:14px;font-weight:500;box-shadow:inset 0 0 0 1.5px rgba(255,255,255,0.14)}
    @keyframes sk-spin{to{transform:rotate(360deg)}}
    @keyframes sk-pop{0%{transform:scale(.9)}60%{transform:scale(1.08)}100%{transform:scale(1)}}
    @keyframes sk-fade{from{opacity:0}}
    @keyframes sk-blink{0%,100%{opacity:1}50%{opacity:.25}}
    @media (prefers-reduced-motion: reduce){.sk-badge.spin ha-icon,.sk-chip.blink ha-icon,.sk-badge.pop{animation:none}}
  `;
  const SHEET_CSS = `
    button{font:inherit;color:inherit;border:0;background:none;padding:0;cursor:pointer;-webkit-tap-highlight-color:transparent}
    input{font:inherit}
    .sk-sheet{display:flex;flex-direction:column;gap:0;min-height:100%}
    .sk-sh-hd{display:flex;align-items:center;gap:8px;padding:2px 6px 14px}
    .sk-sh-tt{flex:1;min-width:0;font-size:22px;font-weight:600;letter-spacing:-0.02em}
    .sk-ok{${M.DONE_PILL}}
    .sk-ok:disabled{opacity:.6}
    .sk-sh-tabs{position:relative;display:grid;gap:2px;padding:4px;border-radius:24px;background:var(--ki-g-seg,var(--gray200,#3a3a3a));box-shadow:inset 0 0 0 1px rgba(255,255,255,0.05);margin-bottom:10px;touch-action:pan-y}
    .sk-sh-tab{height:40px;border-radius:20px;font-size:13px;font-weight:500;min-width:0;color:var(--gray900,#c7c7c7);transition:background .2s}
    .sk-sh-tab.on{background:${PK};color:#2f2f2f}
    .sk-sh-pane{display:flex;flex-direction:column;gap:8px;padding-bottom:40px}
    .sk-sec{display:flex;flex-direction:column;gap:8px;padding:14px;border-radius:24px;background:var(--ki-g-row,var(--gray200,#3a3a3a))}
    .sk-sec.rows{gap:0;padding:14px 16px 4px}
    .sk-sec.rows>.sk-cap{padding-bottom:4px}
    .sk-cap{font-size:12px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;color:var(--gray600,#7f7f7f)}
    .sk-note{font-size:12px;color:var(--gray600,#7f7f7f);line-height:1.45;padding:2px 8px 0}
    .sk-sec .sk-note{padding:0}
    .sk-note code{font-size:12px}
    .sk-seg{display:grid;gap:2px;padding:3px;border-radius:20px;background:#282828}
    .sk-seg button{height:36px;border-radius:17px;font-size:13px;font-weight:500;min-width:0;color:var(--gray900,#c7c7c7);transition:background .2s}
    .sk-seg button.on{background:${PK};color:#2f2f2f}
    .sk-srow{display:flex;align-items:center;gap:12px;min-height:60px;width:100%;text-align:left}
    .sk-srow + .sk-srow{border-top:1px solid rgba(255,255,255,0.06)}
    .sk-at{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;text-align:left}
    .sk-arl{font-size:15px;font-weight:500}
    .sk-ats{font-size:12px;color:var(--gray700,#979797);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .sk-sw{position:relative;display:inline-block;width:50px;height:30px;border-radius:15px;flex:none;background:var(--gray400,#545454);transition:background .2s}
    .sk-sw i{position:absolute;top:3px;left:3px;width:24px;height:24px;border-radius:12px;background:var(--white,#fafafa);box-shadow:0 2px 6px rgba(0,0,0,0.3);transition:left .2s}
    .sk-sw.on{background:${PK}}
    .sk-sw.on i{left:23px}
    .sk-sw:disabled{opacity:.5}
    .sk-lhd{display:flex;align-items:center;gap:10px}
    .sk-in{flex:1;min-width:0;height:44px;border-radius:14px;border:0;outline:none;padding:0 14px;background:#282828;color:#fafafa;font-size:15px;box-sizing:border-box}
    .sk-ent{display:flex;flex-direction:column;border-top:1px solid rgba(255,255,255,0.06)}
    .sk-entr{display:flex;align-items:center;gap:10px;min-height:48px;padding:0 4px}
    .sk-eid{font-size:13px;font-family:ui-monospace,Menlo,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .sk-echip{height:20px;padding:0 8px;border-radius:10px;font-size:10px;font-weight:600;display:inline-flex;align-items:center;flex:none}
    .sk-bytt{height:32px;padding:0 12px;border-radius:16px;background:var(--gray300,#404040);display:flex;align-items:center;font-size:12px;font-weight:500;flex:none}
    .sk-epk{padding:0 0 10px}
  `;

  M.sik = {
    COL: { G, O, R, Y, B, P, GR, PK }, a, hm, when, dur, durS, mmss, dayKey, dayLabel, isToday, SYNC_MS,
    picker, pickerFits, hero, badge, tiles, auto, history, groupDays, sw: swH,
    logbook, attrHistory, attrsAt, person, method, METHOD, autoFind, minsOn, minsOf, setMins, isOn, flip, master, masterOn, rowOn,
    sheet, setPath, shSw, shSeg, shSec, shRow, shEnt, CSS, SHEET_CSS,
  };
})();
