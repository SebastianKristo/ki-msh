/* msh-klima-hero-card + msh-klima-card · Klima-popup (#klima). Kilde: Klima v2.dc.html.
 * Hero: effektmåler (bue) mot timegrense, 3 nøkkeltall og bortemodus-pill.
 * Hovedkort: moduser, 7 faner (Oversikt, Soner, Energi, Vann og bad, Tanker, Oppsett, Avansert – kan
 * omorganiseres med langt trykk + dra, lagres i config.tab_order) og alt innhold per fane.
 * Autokonfig: alle climate.* + fan.* gruppert per område (M.areaOf/M.areas), romtemperatur fra KI Rom
 * (sensor.<rom>_oversikt → temperatur/fuktighet) eller sensor med device_class i rommet. Effekt fra KI Rom
 * (sensor.hele_huset_effekt) eller måler (tibber/ams), pris fra nordpool/tibber, bereder fra water_heater.*,
 * øvrige brytere/tider/verdier via navn eller integrasjon (config.platform, standard «ki_klima»).
 */
(function () {
  const M = window.MSH, esc = M.esc, C = M.C;
  const PINK = C.accent, INK = '#3a3a3a';
  const G = C.green, OR = C.orange, R = C.red, B = C.blue, Y = C.yellow;

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

  /* ------------------------------------------------------------ tall og tid */
  const nf = M.nf;
  const kwOf = (v, unit) => { if (v == null || isNaN(v)) return null; const u = String(unit || 'W').toLowerCase(); return u === 'kw' ? +v : u === 'mw' ? +v * 1000 : +v / 1000; };
  const kwhOf = (v, unit) => { if (v == null || isNaN(v)) return null; const u = String(unit || 'kWh').toLowerCase(); return u === 'wh' ? +v / 1000 : u === 'mwh' ? +v * 1000 : +v; };
  const hhmm = (d) => `${M.pad(d.getHours())}:${M.pad(d.getMinutes())}`;
  const txt = (s) => String(s || '').toLowerCase();
  const HVAC = { off: 'Av', heat: 'Varme', cool: 'Kjøl', heat_cool: 'Auto', auto: 'Auto', dry: 'Tørk', fan_only: 'Vifte' };
  const ACTION = { heating: 'Varmer', cooling: 'Kjøler', idle: 'Tomgang', off: 'Av', drying: 'Tørker', fan: 'Vifter', preheating: 'Forvarmer', defrosting: 'Tiner' };
  const PRESET = { eco: 'Øko', away: 'Borte', boost: 'Boost', comfort: 'Komfort', home: 'Hjemme', sleep: 'Natt', activity: 'Aktiv', none: 'Ingen' };
  const cap = (s) => { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' '); };
  const lbl = (map, v) => map[v] || cap(v);
  // Tidsvektet snitt av en trinnserie [{t,v}] i intervallet [a,b].
  const twMean = function (pts, a, b) {
    if (!pts || !pts.length || b <= a) return null;
    let cur = null, sum = 0, dur = 0, last = a;
    for (const p of pts) {
      if (p.t <= a) { cur = p.v; continue; }
      if (p.t >= b) break;
      if (cur != null) { sum += cur * (p.t - last); dur += p.t - last; }
      cur = p.v; last = p.t;
    }
    if (cur != null) { sum += cur * (b - last); dur += b - last; }
    return dur > 0 ? sum / dur : null;
  };

  /* ------------------------------------------------------------ autokonfig */
  const RX = {
    mode: /(borte|away|ferie|vacation|sommer|summer|hjemkomst|helg|gjest|guest)/,
    bed: /(leggetid|legger|sove|sover|nattsenk|sleep|bedtime)/,
    heater: /(bereder|vvb|varmtvann|varmtvatn|water_heater|legionella)/,
    towel: /(handkle|håndkle|towel)/,
    legio: /legionella/,
    saving: /(spar|saving)/,
    limit: /(grense|limit|reserve|senking|terskel|komfort|trinn)/,
    klima: /(klima|varme|ovn|termostat|gulvvarme|panel|effekt|bereder|vvb|handkle|håndkle|nattsenk|motor|adaptiv|varsel|legionella)/,
    power: /(hele_huset|hele huset|total|ams|han|maler|måler|meter|main|forbruk)/,
    hour: /(current_hour|denne_time|this_hour|timeforbruk|time_forbruk|hour)/,
    glim: /(effektgrense|timegrense|power_limit|kapasitet|grense)/,
    bath: /(^|_|\s)(bad|bath|dusj|vaskerom|wc|toalett)/,
  };
  const hay = (hass, id) => txt(id + ' ' + ((hass.states[id] && hass.states[id].attributes.friendly_name) || ''));
  const find = (hass, doms, re, f) => M.all(hass, doms, (s, id) => re.test(hay(hass, id)) && (!f || f(s, id)));

  M.klimaAuto = function (hass, cfg) {
    cfg = cfg || {};
    const out = { groups: [] };
    if (!hass) return out;
    const plat = cfg.platform || 'ki_klima';
    const platIds = M.byPlatform(hass, plat).filter((id) => M.usable(hass, id));
    // soner
    const zonesAuto = M.all(hass, ['climate', 'fan']);
    out.zonesAuto = zonesAuto;
    out.zones = M.applyLists(cfg, 'soner', zonesAuto);
    const byArea = {};
    out.zones.forEach((id) => { const a = M.areaOf(hass, id) || '_'; (byArea[a] = byArea[a] || []).push(id); });
    M.areas(hass).forEach((a) => { if (byArea[a.id]) out.groups.push({ area: a.id, name: a.name, icon: a.icon, floor: a.floorName, ids: byArea[a.id] }); });
    if (byArea._) out.groups.push({ area: null, name: 'Uten rom', icon: 'mdi:home-outline', ids: byArea._ });
    // effekt / energi / grense / pris
    const kiEff = M.kiRomId(hass, null, 'effekt');
    const tib = M.all(hass, 'sensor', (s, id) => s.attributes.device_class === 'power' && ['tibber', 'amshan', 'ams', 'han'].includes((M.regEntry(hass, id) || {}).platform));
    out.autoPower = kiEff || tib[0] || find(hass, 'sensor', RX.power, (s) => s.attributes.device_class === 'power')[0] || null;
    out.power = M.pick(cfg, 'effekt', out.autoPower);
    out.autoEnergy = find(hass, 'sensor', RX.hour, (s) => s.attributes.device_class === 'energy' || /wh$/i.test(s.attributes.unit_of_measurement || ''))[0] || null;
    out.energy = M.pick(cfg, 'forbruk', out.autoEnergy);
    out.autoLimit = find(hass, ['number', 'input_number', 'sensor'], RX.glim, (s) => /^(k?wh?|kw)$/i.test(s.attributes.unit_of_measurement || ''))[0] || null;
    out.limitEnt = M.pick(cfg, 'grense', out.autoLimit);
    const np = M.byPlatform(hass, 'nordpool', 'sensor')[0] || M.all(hass, 'sensor', (s) => Array.isArray(s.attributes.today) && /kwh/i.test(s.attributes.unit_of_measurement || ''))[0];
    out.autoPrice = np || null;
    out.price = M.pick(cfg, 'pris', out.autoPrice);
    // bereder / bad
    out.autoHeater = M.all(hass, 'water_heater')[0] || null;
    out.heater = M.pick(cfg, 'bereder', out.autoHeater);
    out.autoLegio = find(hass, ['sensor', 'binary_sensor'], RX.legio)[0] || null;
    out.legio = M.pick(cfg, 'legionella', out.autoLegio);
    out.autoTowel = find(hass, ['switch', 'input_boolean'], RX.towel)[0] || null;
    out.towel = M.pick(cfg, 'handkle', out.autoTowel);
    out.bathAreas = M.areas(hass).filter((a) => RX.bath.test(M.slug(a.name)) || RX.bath.test(a.id)).map((a) => a.id);
    // lister
    const modesAuto = find(hass, 'input_boolean', RX.mode);
    const bedAuto = find(hass, 'input_boolean', RX.bed, (s, id) => !modesAuto.includes(id));
    const vannAuto = find(hass, ['switch', 'input_boolean'], RX.heater, (s, id) => id !== out.towel && !out.zones.includes(id));
    out.modesAuto = modesAuto; out.bedAuto = bedAuto; out.vannAuto = vannAuto;
    out.modes = M.applyLists(cfg, 'moduser', modesAuto);
    out.bed = M.applyLists(cfg, 'leggetid', bedAuto);
    out.vann = M.applyLists(cfg, 'vann', vannAuto);
    const used = new Set([...out.modes, ...out.bed, ...out.vann, out.towel].filter(Boolean));
    const plat2 = (doms) => platIds.filter((id) => doms.includes(id.split('.')[0]));
    const uniq = (a) => a.filter((v, i) => a.indexOf(v) === i);
    out.setupAuto = uniq([...plat2(['switch', 'input_boolean', 'automation']), ...find(hass, ['input_boolean', 'switch', 'automation'], RX.klima)]).filter((id) => !used.has(id));
    out.setup = M.applyLists(cfg, 'oppsett', out.setupAuto);
    out.limitsAuto = uniq([...plat2(['number', 'input_number']), ...find(hass, ['number', 'input_number'], RX.limit)]).filter((id) => id !== out.limitEnt);
    out.limits = M.applyLists(cfg, 'grenser', out.limitsAuto);
    out.timesAuto = uniq([...plat2(['input_datetime', 'time']), ...find(hass, ['input_datetime', 'time'], RX.klima)]);
    out.times = M.applyLists(cfg, 'tider', out.timesAuto);
    out.valuesAuto = uniq([...plat2(['select', 'input_select', 'sensor']), ...find(hass, ['number', 'input_number', 'input_select', 'select'], RX.klima)]).filter((id) => !out.limits.includes(id) && id !== out.limitEnt && id !== out.power);
    out.values = M.applyLists(cfg, 'verdier', out.valuesAuto);
    out.savingsAuto = M.all(hass, 'sensor', (s, id) => /^(kr|nok|sek|dkk)$/i.test(s.attributes.unit_of_measurement || '') && RX.saving.test(hay(hass, id)));
    out.savings = M.applyLists(cfg, 'sparing', out.savingsAuto);
    return out;
  };
  // Romtemperatur/fukt for et område: KI Rom → device_class i rommet.
  M.klimaRoom = function (hass, area) {
    if (!area) return {};
    const ov = M.kiRom(hass, area, 'oversikt');
    const a = (ov && ov.attributes) || {};
    return { temp: M.ids(a.temperatur)[0] || M.byClass(hass, 'sensor', 'temperature', area)[0] || null, hum: M.ids(a.fuktighet)[0] || M.byClass(hass, 'sensor', 'humidity', area)[0] || null };
  };

  /* ------------------------------------------------------------ beregning (effekt mot grense) */
  const hourStart = () => { const d = new Date(); d.setMinutes(0, 0, 0); return d.getTime(); };
  M.klimaCalc = function (card, A, pts) {
    const hass = card.hass, c = card.config;
    const ps = card.s(A.power), es = card.s(A.energy), ls = card.s(A.limitEnt);
    const now = ps && M.isNum(ps.state) ? kwOf(+ps.state, ps.attributes.unit_of_measurement) : null;
    let limit = null;
    if (ls && M.isNum(ls.state)) { const u = String(ls.attributes.unit_of_measurement || 'kWh').toLowerCase(); limit = /^(w|wh)$/.test(u) ? +ls.state / 1000 : +ls.state; }
    else if (c.limit != null && c.limit !== '') limit = Number(c.limit);
    const h0 = hourStart(), t = Date.now(), minLeft = Math.max(0, Math.round((h0 + 3600000 - t) / 60000));
    let used = es && M.isNum(es.state) ? kwhOf(+es.state, es.attributes.unit_of_measurement) : null;
    if (used == null && pts && pts.length) { const live = now != null ? pts.concat([{ t, v: now }]) : pts; const m = twMean(live, h0, t); used = m != null ? m * ((t - h0) / 3600000) : null; }
    const left = limit != null && used != null ? Math.max(0, limit - used) : null;
    const allowed = left != null ? Math.min(limit, minLeft > 0 ? left / (minLeft / 60) : limit) : null;
    const free = allowed != null && now != null ? Math.max(0, allowed - now) : null;
    const expect = used != null && now != null ? used + now * (minLeft / 60) : null;
    const frac = limit ? M.clamp((now || 0) / limit, 0, 1.2) : 0;
    const ty = Number(c.terskel_gul ?? 75) / 100, to = Number(c.terskel_oransje ?? 88) / 100, tr = Number(c.terskel_rod ?? 97) / 100;
    const col = !limit || now == null ? G : frac > tr ? R : frac > to ? OR : frac > ty ? Y : G;
    const status = now == null ? 'Ingen måler' : !limit ? 'Uten grense' : frac > tr ? 'Over grensen' : frac > ty ? 'Nær grensen' : 'God margin';
    return { now, limit, used, left, allowed, free, expect, minLeft, frac, col, status };
  };

  /* ------------------------------------------------------------ felles byggeklosser (HTML) */
  const sw = (on) => `<span class="trk" style="background:${on ? C.pink : C.inner}"><span class="knb" style="left:${on ? 21 : 3}px"></span></span>`;
  // Generisk kort (ekstrakort i designet): {icon,title,meta,rows,stats,bars,lines,note,body}
  function xcard(o) {
    const rows = (o.rows || []).map((r, i) => {
      const tag = r.act ? 'button' : 'div';
      return `<${tag} class="xr${i ? ' bt' : ''}" ${r.act ? `data-act="${esc(r.act)}"` : ''} ${r.id ? `data-id="${esc(r.id)}" data-ent="${esc(r.id)}"` : ''} ${r.data || ''} ${r.tog != null ? 'data-haptic="success"' : ''} data-key="${esc(r.key || r.id || r.k)}">
        ${r.dot ? `<span class="xdot" style="background:${r.dot}"></span>` : ''}
        <span class="xtx"><span class="xk">${esc(r.k)}${r.chip ? `<span class="xchip" style="background:${M.alpha(r.chip[1], 0.18)};color:${r.chip[1]}">${esc(r.chip[0])}</span>` : ''}</span>${r.sub ? `<span class="xs">${esc(r.sub)}</span>` : ''}</span>
        ${r.v != null && r.v !== '' ? `<span class="xv num${r.pill ? ' pill' : ''}">${esc(r.v)}</span>` : ''}
        ${r.tog != null ? sw(r.tog) : ''}</${tag}>`;
    }).join('');
    const stats = o.stats ? `<div class="xst" style="grid-template-columns:repeat(${o.stats.length === 4 ? 4 : 3},1fr)">${o.stats.map(([v, k]) => `<div class="xsc"><b class="num">${esc(v)}</b><span>${esc(k)}</span></div>`).join('')}</div>` : '';
    const bars = o.bars ? `<div class="xbars">${o.bars.map((b) => `<span style="height:${b.h}%;background:${b.c}"></span>`).join('')}</div>` : '';
    const lines = o.lines ? `${o.lines.map(([name, segs]) => `<div class="xl"><span class="xln ell">${esc(name)}</span><div class="xlt">${segs.map(([a0, b0, t, c]) => `<span class="xseg" style="left:${(a0 / 24) * 100}%;width:${((b0 - a0) / 24) * 100}%;background:${M.alpha(c, 0.55)}">${esc(t)}</span>`).join('')}<span class="xnow" style="left:${(o.nowH / 24) * 100}%"></span></div></div>`).join('')}<div class="xax num"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div>` : '';
    return `<section class="sec" data-key="x-${esc(o.key || o.title)}">
      <div class="xh"><span class="xt">${M.icon(o.icon, 18, 'color:var(--gray700,#979797)')}${esc(o.title)}</span><span class="xm">${esc(o.meta || '')}</span></div>
      ${stats}${lines}${bars}${o.body || ''}${rows ? `<div class="col">${rows}</div>` : ''}
      ${o.note ? `<div class="note">${esc(o.note)}</div>` : ''}
    </section>`;
  }
  // Pill-rad med stor ikonboble og bryter (Vann og bad / Oppsett).
  function pillRow(card, id, col) {
    const s = card.s(id), on = M.isOn(s) || (s && s.state === 'on');
    const ic = M.domainIcon(id, s);
    const sub = s ? `${on ? 'På' : M.unavailable(s) ? 'Utilgjengelig' : 'Av'} · ${M.relTime(s.last_changed)}` : 'Finnes ikke';
    return `<button class="pr press" data-act="toggle" data-id="${esc(id)}" data-ent="${esc(id)}" data-key="${esc(id)}" data-haptic="success">
      <span class="pri" style="background:${on ? col : C.inner};color:${on ? '#282828' : 'var(--gray600,#7f7f7f)'}">${M.icon(ic, 20)}</span>
      <span class="grow col" style="text-align:left"><span class="t14 ell">${esc(M.name(card.hass, id))}</span><span class="t11 dim ell">${esc(sub)}</span></span>
      ${sw(on)}</button>`;
  }
  const hdr = (t, m) => `<div class="hd"><span class="t15">${esc(t)}</span><span class="t12 dim">${esc(m || '')}</span></div>`;

  const SHARED_CSS = `
    .t15{font-size:15px;font-weight:500} .t14{font-size:14px;font-weight:500} .t13{font-size:13px} .t12{font-size:12px} .t11{font-size:11px} .t10{font-size:10px}
    .dim{color:var(--gray600,#7f7f7f)}
    .sec{display:flex;flex-direction:column;gap:10px;padding:16px;border-radius:28px;background:var(--gray200,#3a3a3a)}
    .hd{display:flex;justify-content:space-between;align-items:baseline;gap:10px}
    .xh{display:flex;justify-content:space-between;align-items:baseline;gap:10px}
    .xt{display:flex;align-items:center;gap:8px;font-size:15px;font-weight:500}
    .xm{font-size:12px;color:var(--gray600,#7f7f7f);text-align:right}
    .xst{display:grid;gap:6px}
    .xsc{display:flex;flex-direction:column;align-items:center;gap:2px;padding:12px 4px;border-radius:18px;background:var(--gray200,#3a3a3a);text-align:center}
    .xsc b{font-size:17px;font-weight:600;white-space:nowrap} .xsc span{font-size:10px;color:var(--gray600,#7f7f7f)}
    .xr{display:flex;align-items:center;gap:10px;padding:10px 0;width:100%;text-align:left}
    .xr.bt{border-top:1px solid rgba(255,255,255,0.05)}
    button.xr{cursor:pointer}
    .xdot{width:7px;height:7px;border-radius:4px;flex:none}
    .xtx{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
    .xk{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:13px;font-weight:500}
    .xchip{font-size:10px;font-weight:600;padding:2px 7px;border-radius:7px;white-space:nowrap}
    .xs{font-size:11px;color:var(--gray600,#7f7f7f)}
    .xv{font-size:12px;font-weight:600;white-space:nowrap}
    .xv.pill{padding:6px 11px;border-radius:12px;background:var(--gray200,#3a3a3a)}
    .trk{position:relative;width:44px;height:26px;border-radius:13px;flex:none;transition:background .2s}
    .knb{position:absolute;top:3px;width:20px;height:20px;border-radius:10px;background:#fafafa;transition:left .2s}
    .xbars{display:flex;align-items:flex-end;gap:2px;height:80px}
    .xbars span{flex:1;border-radius:3px;min-height:3px}
    .xl{display:flex;align-items:center;gap:8px}
    .xln{width:72px;flex:none;font-size:11px;color:var(--gray800,#afafaf)}
    .xlt{position:relative;flex:1;height:22px;border-radius:8px;background:var(--gray200,#3a3a3a);overflow:hidden}
    .xseg{position:absolute;top:2px;bottom:2px;border-radius:6px;color:#fafafa;font-size:9px;font-weight:600;display:flex;align-items:center;padding-left:5px;overflow:hidden;white-space:nowrap;box-sizing:border-box}
    .xnow{position:absolute;top:0;bottom:0;width:2px;background:#fafafa}
    .xax{display:flex;justify-content:space-between;padding-left:80px;font-size:9px;color:var(--gray500,#696969)}
    .note{font-size:11px;line-height:1.5;color:var(--gray600,#7f7f7f);text-wrap:pretty}
    .pr{display:flex;align-items:center;gap:12px;min-height:62px;padding:6px 14px 6px 6px;border-radius:31px;background:var(--gray200,#3a3a3a);width:100%}
    .pri{width:50px;height:50px;border-radius:25px;flex:none;display:grid;place-items:center;transition:background .25s}
    .empty.in{background:transparent;padding:10px 0 0}
  `;

  /* ============================================================ HERO */
  class KlimaHero extends M.Card {
    static get cardName() { return 'Klima · effekt (hero)'; }
    static get defaults() { return { terskel_gul: 75, terskel_oransje: 88, terskel_rod: 97 }; }
    static get schema() {
      const au = (k) => (h, c) => M.klimaAuto(h, c)[k];
      return [
        { type: 'overrides', label: 'Bytt entiteter', fields: [
          { name: 'effekt', label: 'Effekt nå (W/kW)', domain: 'sensor', device_class: 'power', auto: au('autoPower') },
          { name: 'forbruk', label: 'Forbruk denne timen (kWh)', domain: 'sensor', auto: au('autoEnergy') },
          { name: 'grense', label: 'Timegrense (kWh)', domain: ['number', 'input_number', 'sensor'], auto: au('autoLimit') },
          { name: 'borte', label: 'Bortemodus', domain: ['input_boolean', 'switch'], auto: (h, c) => M.klimaAuto(h, c).modes.find((id) => /borte|away/.test(hay(h, id))) || null },
        ] },
        { type: 'number', name: 'limit', label: 'Timegrense (kWh) uten entitet', step: 0.1, min: 0, placeholder: 'f.eks. 5,5' },
        { type: 'section', label: 'Terskler for fargesonene', id: 'terskler', icon: 'mdi:palette', fields: [
          { type: 'number', name: 'terskel_gul', label: 'Gul fra (%)', min: 0, max: 120 },
          { type: 'number', name: 'terskel_oransje', label: 'Oransje fra (%)', min: 0, max: 120 },
          { type: 'number', name: 'terskel_rod', label: 'Rød fra (%)', min: 0, max: 120 },
        ] },
        { type: 'boolean', name: 'toasts', label: 'Bekreftelsesmeldinger', default: true },
      ];
    }
    get cardSize() { return 5; }
    onOpen() { this._load(); }
    async _load() {
      const A = M.klimaAuto(this.hass, this.config);
      if (!A.power) return;
      const h = await M.history(this.hass, [A.power], 24);
      const u = this.hass.states[A.power] && this.hass.states[A.power].attributes.unit_of_measurement;
      this._pts = (h[A.power] || []).map((p) => ({ t: p.t, v: kwOf(p.v, u) }));
      this.update();
    }
    _away(A) { return M.pick(this.config, 'borte', A.modes.find((id) => /borte|away/.test(hay(this.hass, id))) || A.modes[0] || null); }
    render() {
      const A = M.klimaAuto(this.hass, this.config), k = M.klimaCalc(this, A, this._pts);
      const awayId = this._away(A), aw = this.s(awayId), away = M.isOn(aw);
      const deg = Math.max(4, Math.min(1, k.frac) * 180);
      return `<section class="hero" data-ent="${esc(A.power || '')}">
        <div class="glow" style="background:radial-gradient(closest-side, ${M.alpha(k.col, 0.2)}, transparent)"></div>
        <div class="gauge">
          <div class="clip"><div class="arc" style="background:conic-gradient(from -90deg, var(--gray300,#404040) 0 180deg, transparent 180deg)"></div>
            <div class="arc" style="background:conic-gradient(from -90deg, ${k.col} 0 ${k.now == null || !k.limit ? 0 : deg}deg, transparent 0);filter:drop-shadow(0 0 8px ${M.alpha(k.col, 0.6)})"></div></div>
          <div class="read">
            <span class="tag" style="color:${k.col}">${esc(k.status)}</span>
            <span class="kw num">${k.now != null ? nf(k.now, 2) : '–'}<span class="u"> kW</span></span>
            <span class="lim">${k.limit != null ? `av ${nf(k.limit, 2)} kW tillatt` : 'ingen grense satt'}</span>
          </div>
        </div>
        <div class="stats">
          <div class="st"><b class="num">${k.left != null ? nf(k.left, 2) : '–'}</b><span>kWh igjen</span></div>
          <div class="st"><b class="num">${k.free != null ? nf(k.free, 2) : '–'}</b><span>kW ledig</span></div>
          <div class="st"><b class="num">${k.minLeft} min</b><span>igjen av timen</span></div>
        </div>
        ${!this.s(A.power) ? `<button class="pick press" data-act="customize" data-section="overrides">${M.icon('mdi:plus', 18)}Velg effektmåler</button>` : ''}
        ${aw ? `<button class="away press" data-act="away" data-id="${esc(awayId)}" data-haptic="success" style="background:${away ? M.alpha(B, 0.22) : 'var(--gray200,#3a3a3a)'};color:${away ? '#e6eef8' : 'var(--gray800,#afafaf)'}">${M.icon(away ? 'luggage' : 'home', 16)}${away ? 'Borte · bortemodus på' : 'Hjemme · normal komfort'}</button>`
          : `<button class="away press" data-act="customize" data-section="overrides" style="background:var(--gray200,#3a3a3a);color:var(--gray800,#afafaf)">${M.icon('home', 16)}Hjemme · velg bortemodus</button>`}
      </section>`;
    }
    onAction(name, el, ev) {
      if (name === 'away') { const on = M.isOn(this.s(el.dataset.id)); M.toggle(this.hass, el.dataset.id); if (this.config.toasts !== false) M.toast(on ? 'Hjemme · normal komfort' : 'Bortemodus på'); return; }
      return super.onAction(name, el, ev);
    }
    get styles() {
      return `
        .hero{position:relative;display:flex;flex-direction:column;align-items:center;gap:12px;padding:20px 16px 16px;border-radius:32px;background:var(--gray200,#3a3a3a);overflow:hidden}
        .glow{position:absolute;left:50%;top:-40px;width:320px;height:240px;margin-left:-160px;border-radius:50%;pointer-events:none;transition:background .4s}
        .gauge{position:relative;width:250px;height:136px}
        .clip{position:absolute;inset:0;overflow:hidden}
        .arc{position:absolute;left:0;top:0;width:250px;height:250px;border-radius:50%;-webkit-mask:radial-gradient(circle, transparent 98px, #000 99px);mask:radial-gradient(circle, transparent 98px, #000 99px)}
        .read{position:absolute;left:-20px;right:-20px;bottom:6px;display:flex;flex-direction:column;align-items:center}
        .tag{font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase}
        .kw{font-size:44px;font-weight:300;letter-spacing:-0.04em;line-height:1.05;white-space:nowrap}
        .u{font-size:15px;color:var(--gray600,#7f7f7f);letter-spacing:0}
        .lim{font-size:12px;color:var(--gray600,#7f7f7f);white-space:nowrap}
        .stats{position:relative;display:grid;grid-template-columns:repeat(3,1fr);gap:6px;width:100%}
        .st{display:flex;flex-direction:column;align-items:center;gap:2px;padding:10px 4px;border-radius:18px;background:var(--gray200,#3a3a3a)}
        .st b{font-size:17px;font-weight:600;white-space:nowrap} .st span{font-size:10px;color:var(--gray600,#7f7f7f)}
        .away{position:relative;height:36px;padding:0 14px;border-radius:18px;display:flex;align-items:center;gap:6px;font-size:12px;font-weight:500;white-space:nowrap;transition:background .3s}
        .pick{position:relative}
      `;
    }
  }
  M.define('msh-klima-hero-card', KlimaHero, 'MSH Klima · hero', 'Effekt nå mot timegrensen (bue), kWh igjen, kW ledig og bortemodus. Første kort i Klima-popupen.');

  /* ============================================================ HOVEDKORT */
  const TABS = [['ov', 'Oversikt', 'dashboard'], ['so', 'Soner', 'roofing'], ['en', 'Energi', 'bolt'], ['vb', 'Vann og bad', 'water_heater'], ['ta', 'Tanker', 'psychology'], ['op', 'Oppsett', 'tune'], ['av', 'Avansert', 'build']];
  const STEPS = [2, 5, 10, 15, 20, 25, 50, 75, 100]; // kapasitetsledd (nettleie, kW)
  const MODE_ICON = [[/alle/, 'mdi:logout'], [/borte|away/, 'luggage'], [/hjemkomst|home/, 'home'], [/sommer|summer/, 'light_mode'], [/ferie|vacation/, 'school'], [/helg/, 'mdi:calendar-weekend'], [/gjest|guest/, 'groups']];

  class Klima extends M.Card {
    static get cardName() { return 'Klima'; }
    static get defaults() { return { terskel_gul: 75, terskel_oransje: 88, terskel_rod: 97, legionella_frist: 7, platform: 'ki_klima' }; }
    static get schema() {
      const au = (k) => (h, c) => M.klimaAuto(h, c)[k];
      return [
        { type: 'lists', label: 'Entiteter', lists: (h, c) => { const a = M.klimaAuto(h, c); return [
          { key: 'soner', label: 'Soner (termostater og vifter)', ids: a.zonesAuto, domains: ['climate', 'fan'] },
          { key: 'moduser', label: 'Moduser', ids: a.modesAuto, domains: ['input_boolean', 'switch'] },
          { key: 'leggetid', label: 'Leggetid', ids: a.bedAuto, domains: ['input_boolean', 'switch'] },
          { key: 'vann', label: 'Varmtvann (brytere)', ids: a.vannAuto, domains: ['switch', 'input_boolean', 'button', 'script'] },
          { key: 'oppsett', label: 'Oppsett (brytere/automasjoner)', ids: a.setupAuto, domains: ['input_boolean', 'switch', 'automation'] },
          { key: 'grenser', label: 'Grenser (tall)', ids: a.limitsAuto, domains: ['number', 'input_number'] },
          { key: 'tider', label: 'Tider', ids: a.timesAuto, domains: ['input_datetime', 'time'] },
          { key: 'verdier', label: 'Verdier og valg', ids: a.valuesAuto, domains: ['number', 'input_number', 'input_select', 'select', 'sensor'] },
          { key: 'sparing', label: 'Sparing (kr)', ids: a.savingsAuto, domains: ['sensor'] },
        ]; } },
        { type: 'overrides', label: 'Bytt entiteter', fields: [
          { name: 'effekt', label: 'Effekt nå (W/kW)', domain: 'sensor', device_class: 'power', auto: au('autoPower') },
          { name: 'forbruk', label: 'Forbruk denne timen (kWh)', domain: 'sensor', auto: au('autoEnergy') },
          { name: 'grense', label: 'Timegrense (kWh)', domain: ['number', 'input_number', 'sensor'], auto: au('autoLimit') },
          { name: 'pris', label: 'Strømpris', domain: 'sensor', auto: au('autoPrice') },
          { name: 'bereder', label: 'Varmtvannsbereder', domain: ['water_heater', 'switch'], auto: au('autoHeater') },
          { name: 'legionella', label: 'Legionella', domain: ['sensor', 'binary_sensor'], auto: au('autoLegio') },
          { name: 'handkle', label: 'Håndklevarmer', domain: ['switch', 'input_boolean'], auto: au('autoTowel') },
        ] },
        { type: 'number', name: 'limit', label: 'Timegrense (kWh) uten entitet', step: 0.1, min: 0, placeholder: 'f.eks. 5,5' },
        { type: 'order', name: 'tab_order', hiddenName: 'hidden_tabs', label: 'Faner (rekkefølge og synlighet)', options: TABS.map(([k, l]) => [k, l]) },
        { type: 'select', name: 'start_tab', label: 'Startfane', options: TABS.map(([k, l]) => [k, l]) },
        { type: 'section', label: 'Terskler for fargesonene', id: 'terskler', icon: 'mdi:palette', fields: [
          { type: 'number', name: 'terskel_gul', label: 'Gul fra (%)', min: 0, max: 120 },
          { type: 'number', name: 'terskel_oransje', label: 'Oransje fra (%)', min: 0, max: 120 },
          { type: 'number', name: 'terskel_rod', label: 'Rød fra (%)', min: 0, max: 120 },
        ] },
        { type: 'section', label: 'Avansert', icon: 'mdi:wrench', fields: [
          { type: 'number', name: 'legionella_frist', label: 'Legionella-frist (dager)', min: 1, max: 30 },
          { type: 'text', name: 'platform', label: 'Integrasjon for innstillinger', help: 'Entiteter fra denne integrasjonen havner i Oppsett/Grenser (standard ki_klima)' },
        ] },
        { type: 'gap' },
        { type: 'boolean', name: 'toasts', label: 'Bekreftelsesmeldinger', default: true },
      ];
    }
    get cardSize() { return 12; }
    onOpen() { this._load(); }

    /* ---------------- data (kun når popupen åpnes) */
    async _load() {
      const h = this.hass, A = M.klimaAuto(h, this.config), now = Date.now();
      const jobs = [];
      if (A.power) jobs.push(this._loadPower(A.power));
      const rooms = A.groups.map((g) => M.klimaRoom(h, g.area).temp).filter(Boolean);
      if (rooms.length) jobs.push(M.history(h, rooms, 24).then((r) => { this._temps = r; }));
      const raw = [A.heater, A.towel].filter(Boolean);
      if (raw.length) jobs.push(this._rawHist(raw).then((r) => { this._raw = r; }));
      const logIds = [...A.zones, ...A.modes, ...A.bed].slice(0, 60);
      if (logIds.length && h.callWS) jobs.push(h.callWS({ type: 'logbook/get_events', start_time: new Date(now - 12 * 3600000).toISOString(), end_time: new Date(now).toISOString(), entity_ids: logIds }).then((r) => { this._log = Array.isArray(r) ? r : []; }).catch(() => { this._log = []; }));
      await Promise.all(jobs.map((j) => j.catch(() => {})));
      this.update();
    }
    async _loadPower(id) {
      const h = this.hass, u = h.states[id] && h.states[id].attributes.unit_of_measurement, now = Date.now();
      const ms = new Date(); ms.setDate(1); ms.setHours(0, 0, 0, 0);
      let hours = [];
      try {
        const r = await h.callWS({ type: 'recorder/statistics_during_period', start_time: new Date(Math.min(ms.getTime(), now - 13 * 3600000)).toISOString(), end_time: new Date(now).toISOString(), statistic_ids: [id], period: 'hour', types: ['mean'] });
        hours = ((r && r[id]) || []).map((p) => ({ t: typeof p.start === 'number' ? p.start : new Date(p.start).getTime(), v: kwOf(p.mean, u) })).filter((p) => p.v != null && !isNaN(p.v));
      } catch (e) { hours = []; }
      const hh = await M.history(h, [id], 24);
      const pts = (hh[id] || []).map((p) => ({ t: p.t, v: kwOf(p.v, u) }));
      const h0 = hourStart();
      if (!hours.length && pts.length) for (let t = h0 - 23 * 3600000; t < h0; t += 3600000) { const m = twMean(pts, t, t + 3600000); if (m != null) hours.push({ t, v: m }); }
      hours = hours.filter((p) => p.t < h0);
      this._en = { hours, pts };
    }
    async _rawHist(ids) {
      const h = this.hass, d0 = new Date(); d0.setHours(0, 0, 0, 0);
      try {
        const r = await h.callWS({ type: 'history/history_during_period', start_time: d0.toISOString(), end_time: new Date().toISOString(), entity_ids: ids, minimal_response: true, no_attributes: true, significant_changes_only: false });
        const out = {};
        ids.forEach((id) => { out[id] = ((r && r[id]) || []).map((p) => ({ t: p.lu != null ? p.lu * 1000 : new Date(p.last_changed || p.last_updated).getTime(), s: p.s != null ? p.s : p.state })); });
        return out;
      } catch (e) { return {}; }
    }
    // På-segmenter i dag (timer 0–24) fra rå historikk + live state.
    _segs(id) {
      const s = this.s(id), pts = ((this._raw && this._raw[id]) || []).slice();
      const d0 = new Date(); d0.setHours(0, 0, 0, 0);
      if (s && !pts.length) pts.push({ t: Math.max(d0.getTime(), new Date(s.last_changed).getTime() || 0), s: s.state });
      if (s) pts.push({ t: Date.now(), s: s.state });
      const on = (x) => x && x !== 'off' && x !== 'unavailable' && x !== 'unknown' && x !== 'idle';
      const out = []; let st = null;
      pts.forEach((p, i) => {
        const hr = Math.max(0, (p.t - d0.getTime()) / 3600000);
        if (on(p.s) && st == null) st = hr;
        if ((!on(p.s) || i === pts.length - 1) && st != null) { out.push([st, Math.max(st + 0.1, hr)]); st = null; }
      });
      return out;
    }

    /* ---------------- render */
    render() {
      const c = this.config, h = this.hass, A = M.klimaAuto(h, c), ui = this.ui;
      this._A = A;
      const K = M.klimaCalc(this, A, this._en && this._en.pts);
      const tabs = M.mshOrder(TABS.map((t) => t[0]), c.tab_order, c.hidden_tabs);
      const tab = tabs.includes(ui.tab) ? ui.tab : tabs.includes(c.start_tab) ? c.start_tab : tabs[0];
      const T = Object.fromEntries(TABS.map((t) => [t[0], t]));
      const body = { ov: () => this._ov(A, K), so: () => this._so(A), en: () => this._en2(A, K), vb: () => this._vb(A), ta: () => this._ta(A, K), op: () => this._op(A), av: () => this._av(A, K) }[tab];
      return `<div class="wrap">
        ${this._modes(A)}
        ${tabs.length ? `<div class="tbox"><nav class="tabs msh-tr" data-gd-skip>${tabs.map((k) => { const act = k === tab; return `<button class="tab${act ? ' on' : ''}" data-act="tab" data-key="${k}" data-haptic="selection" style="background:${act ? PINK : 'transparent'};color:${act ? INK : 'var(--gray700,#979797)'}">${M.icon(T[k][2], 20)}<span class="tl">${esc(T[k][1])}</span></button>`; }).join('')}</nav></div>` : ''}
        ${body ? body() : ''}
      </div>`;
    }
    _modes(A) {
      const items = A.modes.map((id) => {
        const s = this.s(id), on = M.isOn(s), hy = hay(this.hass, id);
        const ic = (s && s.attributes.icon) || (MODE_ICON.find(([re]) => re.test(hy)) || [0, 'mdi:toggle-switch'])[1];
        const name = M.name(this.hass, id).replace(/\s*modus$/i, '').replace(/^modus\s*/i, '');
        return `<button class="mode" data-act="toggle" data-id="${esc(id)}" data-ent="${esc(id)}" data-key="${esc(id)}" data-haptic="success">
          <span class="mb" style="background:${on ? PINK : 'var(--gray200,#3a3a3a)'};color:${on ? INK : 'var(--gray800,#afafaf)'};box-shadow:${on ? '0 6px 18px rgba(240,140,190,0.3)' : 'inset 0 0 0 1px rgba(255,255,255,0.05)'};transform:scale(${on ? 1.06 : 1})">${M.icon(ic, 24)}</span>
          <span class="ml ell" style="color:${on ? '#fafafa' : 'var(--gray600,#7f7f7f)'}">${esc(cap(name))}</span></button>`;
      }).join('');
      const add = `<button class="mode" data-act="customize" data-section="entities" data-key="_add"><span class="mb" style="background:var(--gray200,#3a3a3a);color:var(--gray800,#afafaf);box-shadow:inset 0 0 0 1px rgba(255,255,255,0.05)">${M.icon('add', 24)}</span><span class="ml" style="color:var(--gray600,#7f7f7f)">${A.modes.length ? 'Tilpass' : 'Legg til'}</span></button>`;
      return `<section class="modes noscroll">${items}${add}</section>`;
    }

    /* ---------------- Oversikt */
    _ov(A, K) {
      const en = this._en || { hours: [], pts: [] };
      let out = '';
      // Siste 12 timer
      if (!this.s(A.power)) out += `<section class="sec">${hdr('Siste 12 timer', '–')}${M.emptyState('Fant ingen effektmåler', 'overrides').replace('class="empty"', 'class="empty in"')}</section>`;
      else {
        const h0 = hourStart(), H = [];
        for (let i = 11; i >= 0; i--) { const t = h0 - i * 3600000; const p = en.hours.find((x) => x.t === t); H.push({ t, v: i === 0 ? K.used : p ? p.v : null }); }
        const mx = Math.max(...H.map((x) => x.v || 0), 0.1), scale = K.limit || mx * 1.1;
        out += `<section class="sec">${hdr('Siste 12 timer', K.limit ? `grense ${nf(K.limit, 2)} kWh` : 'kWh per time')}
          <div class="bars">${K.limit ? '<span class="lim"></span>' : ''}${H.map((b, i) => `<span style="height:${Math.max(3, Math.min(96, ((b.v || 0) / scale) * 88))}px;background:${i === 11 ? G : K.limit && b.v > K.limit ? R : C.inner}"></span>`).join('')}</div>
          <div class="bl num">${H.map((b) => `<span>${new Date(b.t).getHours()}</span>`).join('')}</div></section>`;
      }
      // Forventet effekt
      {
        const p = en.pts || [], t = Date.now();
        const a60 = twMean(p.concat(K.now != null ? [{ t, v: K.now }] : []), t - 3600000, t);
        const base = K.now != null ? K.now : a60;
        const tr = a60 != null && base != null ? base - a60 : 0;
        const F = [['15 min', 0.25], ['30 min', 0.5], ['1 t', 1], ['2 t', 2]].map(([k, hrs]) => [k, base == null ? null : Math.max(0, base + tr * Math.min(1, hrs) * 0.5 * (hrs >= 1 ? 1 : hrs))]);
        const scale = K.limit || Math.max(...F.map((f) => f[1] || 0), 0.1) * 1.2;
        const peak = K.limit && F.some((f) => f[1] != null && f[1] > K.limit * (Number(this.config.terskel_gul ?? 75) / 100));
        out += `<section class="sec">${hdr('Forventet effekt', base == null ? '–' : peak ? 'topp i sikte' : 'ingen topp i sikte')}
          <div class="fc">${F.map(([k, v]) => `<div class="fcc"><span class="fb"><span style="height:${v == null ? 0 : Math.min(100, (v / scale) * 100 + 6)}%;background:${K.limit && v > K.limit ? R : G}"></span></span><b class="num">${v == null ? '–' : nf(v, 1)}</b><span>${k}</span></div>`).join('')}</div></section>`;
      }
      // Leggetid
      out += `<section class="col" style="gap:10px"><div class="hd" style="padding:0 6px"><span class="t15">Leggetid</span><span class="t12 dim">trykk når noen legger seg</span></div>
        ${A.bed.length ? `<div class="g2">${A.bed.map((id) => { const on = M.isOn(this.s(id)); const ar = M.areaOf(this.hass, id); return `<button class="bed press" data-act="toggle" data-id="${esc(id)}" data-ent="${esc(id)}" data-key="${esc(id)}" data-haptic="success" style="background:${on ? PINK : 'var(--gray200,#3a3a3a)'};color:${on ? INK : '#fafafa'}">
          <span class="bi" style="background:${on ? 'rgba(42,23,32,0.12)' : C.inner}">${M.icon('bed', 20)}</span>
          <span class="col grow" style="text-align:left"><span class="t14 ell">${esc(M.name(this.hass, id))}</span><span class="t11 ell" style="opacity:.7">${on ? 'Nattsenking aktiv' : ar ? esc(M.areaName(this.hass, ar)) : 'Av'}</span></span></button>`; }).join('')}</div>`
          : M.emptyState('Fant ingen leggetid-brytere', 'entities')}</section>`;
      // Varmtvann
      const hs = this.s(A.heater), lg = this.s(A.legio);
      const rows = [];
      if (hs) { const on = hs.state !== 'off' && !M.unavailable(hs); const act = hs.attributes.current_operation || hs.state; rows.push({ k: M.name(this.hass, A.heater), id: A.heater, act: 'more', dot: on ? OR : C.ctrl, sub: hs.attributes.current_temperature != null ? `Nå ${nf(hs.attributes.current_temperature, 0)}°${hs.attributes.temperature != null ? ` · mål ${nf(hs.attributes.temperature, 0)}°` : ''}` : `Endret ${M.relTime(hs.last_changed)}`, v: on ? (A.heater.startsWith('water_heater.') ? lbl(PRESET, act) : 'På') : 'Står stille', pill: 1 }); }
      if (lg) { const L = this._legio(lg); rows.push({ k: `Legionella: ${L.ok ? 'Sikret' : 'Forfalt'}`, id: A.legio, act: 'more', dot: L.ok ? G : R, sub: L.sub }); }
      out += xcard({ icon: 'water_heater', title: 'Varmtvann', meta: hs ? (hs.state === 'off' ? 'står stille' : 'i drift') : '–', rows, body: rows.length ? '' : M.emptyState('Fant ingen bereder', 'overrides').replace('class="empty"', 'class="empty in"') });
      // Bortemodus
      const awayId = A.modes.find((id) => /borte|away/.test(hay(this.hass, id))) || null, aw = this.s(awayId);
      const cl = A.zones.filter((id) => id.startsWith('climate.')).map((id) => this.s(id)).filter(Boolean);
      const tg = cl.map((s) => s.attributes.temperature).filter((v) => v != null);
      out += xcard({ icon: 'luggage', title: 'Bortemodus', meta: aw ? (M.isOn(aw) ? 'på nå' : 'av') : 'ingen bryter funnet', stats: [[aw ? (M.isOn(aw) ? 'På' : 'Av') : '–', 'bortemodus'], [String(cl.length), 'termostater'], [tg.length ? nf(tg.reduce((a, b) => a + b, 0) / tg.length, 1) + '°' : '–', 'snitt mål'], [String(cl.filter((s) => s.attributes.hvac_action === 'heating').length), 'varmer nå']] });
      return out;
    }
    _legio(s) {
      const frist = Number(this.config.legionella_frist || 7);
      if (!s) return { ok: false, frac: 0, sub: '–', mid: '–' };
      if (s.entity_id.startsWith('binary_sensor.')) { const ok = s.state !== 'on'; return { ok, frac: ok ? 1 : 1, sub: `Endret ${M.relTime(s.last_changed)}`, mid: ok ? 'OK' : 'Feil' }; }
      let days = null;
      if (s.attributes.device_class === 'timestamp' || /^\d{4}-\d\d-\d\d/.test(s.state)) { const t = new Date(s.state).getTime(); if (!isNaN(t)) days = (Date.now() - t) / 86400000; }
      else if (M.isNum(s.state)) { const u = txt(s.attributes.unit_of_measurement); days = /^h/.test(u) ? +s.state / 24 : +s.state; }
      if (days == null) return { ok: !/(forfalt|due|fail|feil)/.test(txt(s.state)), frac: 1, sub: cap(s.state), mid: cap(s.state) };
      const ok = days <= frist;
      return { ok, frac: M.clamp(days / frist, 0.02, 1), sub: `${nf(days, 1)} av ${frist} dager siden sist sikret`, mid: `${nf(days, 1)} / ${frist} d` };
    }

    /* ---------------- Soner */
    _zoneInfo(id) {
      const s = this.s(id), dom = id.split('.')[0], at = (s && s.attributes) || {};
      const area = M.areaOf(this.hass, id), room = M.klimaRoom(this.hass, area);
      if (dom === 'fan') {
        const on = s && s.state === 'on', pct = at.percentage != null ? at.percentage : on ? 100 : 0;
        return { s, dom, on, man: !on, temp: this.n(room.temp), pct, goal: on ? 'Vifte på' : 'Vifte av', tag: on ? (at.preset_mode ? lbl(PRESET, at.preset_mode) : 'På') : 'Av', heat: false, icon: at.icon || 'mdi:fan', area };
      }
      const off = !s || s.state === 'off' || M.unavailable(s);
      const cur = at.current_temperature != null ? at.current_temperature : this.n(room.temp);
      const set = at.temperature != null ? at.temperature : at.target_temp_low != null ? at.target_temp_low : null;
      const heat = at.hvac_action === 'heating';
      const nm = hay(this.hass, id);
      const icon = at.icon || (/gulv|floor/.test(nm) ? 'mdi:heating-coil' : /varmepumpe|heat_pump|heatpump/.test(nm) ? 'heat_pump' : 'mdi:radiator');
      return { s, dom, on: !off, man: off, temp: cur, set, goal: off ? (s ? 'Av' : 'Finnes ikke') : set != null ? `mål ${nf(set, 1)}°` : lbl(HVAC, s.state), tag: heat ? 'Varmer' : off ? 'Av' : at.preset_mode && at.preset_mode !== 'none' ? lbl(PRESET, at.preset_mode) : lbl(HVAC, s.state), heat, icon, area };
    }
    _so(A) {
      const sel = this.ui.zone && A.zones.includes(this.ui.zone) ? this.ui.zone : null;
      let out = sel ? this._zoneDetail(sel) : '';
      if (!A.zones.length) return out + M.emptyState('Fant ingen termostater eller vifter', 'entities');
      out += A.groups.map((g) => {
        const r = M.klimaRoom(this.hass, g.area), t = this.n(r.temp), hu = this.n(r.hum);
        return `<section class="col" style="gap:8px" data-key="g-${esc(g.area || '_')}">
          <div class="gh">${M.icon(g.icon || 'mdi:texture-box', 18, 'color:var(--gray700,#979797)')}<span class="grow t15 ell">${esc(g.name)}</span><span class="t12 dim num">${t != null ? nf(t, 1) + '°' : ''}${hu != null ? ` · ${nf(hu, 0)} %` : ''}</span></div>
          <div class="g2">${g.ids.map((id) => this._zoneCard(id, id === sel)).join('')}</div></section>`;
      }).join('');
      return out;
    }
    _zoneCard(id, act) {
      const z = this._zoneInfo(id), pend = this._pend && this._pend[id];
      const val = z.dom === 'fan' ? `${nf(pend != null ? pend : z.pct, 0)}<span class="zu"> %</span>` : `${z.temp != null ? nf(z.temp, 1) : '–'}°`;
      const goal = z.dom === 'climate' && pend != null ? `mål ${nf(pend, 1)}°` : z.goal;
      return `<button class="zc" data-act="zone" data-id="${esc(id)}" data-ent="${esc(id)}" data-key="${esc(id)}" style="background:${act ? M.alpha(G, 0.12) : 'var(--gray200,#3a3a3a)'};box-shadow:${act ? `inset 0 0 0 1px ${M.alpha(G, 0.45)}` : 'none'}">
        <span class="zt"><span class="zi" style="background:${z.man ? C.inner : M.alpha(G, 0.2)};color:${z.man ? 'var(--gray600,#7f7f7f)' : G}">${M.icon(z.icon, 18)}</span>
          <span class="ztag" style="background:${z.heat ? M.alpha(C.pink, 0.2) : 'var(--gray200,#3a3a3a)'};color:${z.heat ? C.pink : 'var(--gray700,#979797)'}">${esc(z.tag)}</span></span>
        <span class="zv num">${val}</span>
        <span class="col" style="gap:1px;text-align:left;min-width:0;width:100%"><span class="t13 ell" style="font-weight:500">${esc(M.name(this.hass, id))}</span><span class="t11 dim">${esc(goal)}</span></span></button>`;
    }
    _zoneDetail(id) {
      const z = this._zoneInfo(id), s = z.s, at = (s && s.attributes) || {}, pend = this._pend && this._pend[id];
      const areaN = z.area ? M.areaName(this.hass, z.area) : '';
      let val, sub, chips = [], chips2 = [];
      if (z.dom === 'fan') {
        val = `${nf(pend != null ? pend : z.pct, 0)} %`;
        sub = z.on ? 'hastighet' : 'vifta er av';
        if (Array.isArray(at.preset_modes) && at.preset_modes.length) chips = at.preset_modes.map((p) => [p, lbl(PRESET, p), at.preset_mode === p, 'fpreset']);
        else chips = [[33, 'Lav', false, 'fpct'], [66, 'Middels', false, 'fpct'], [100, 'Høy', false, 'fpct']].map((x) => { x[2] = z.on && Math.abs(z.pct - x[0]) < 10; return x; });
      } else {
        const set = pend != null ? pend : z.set;
        val = at.temperature == null && at.target_temp_low != null && pend == null ? `${nf(at.target_temp_low, 1)}–${nf(at.target_temp_high, 1)}°` : `${set != null ? nf(set, 1) : '–'}°`;
        sub = pend != null ? 'sendes …' : `${at.hvac_action ? lbl(ACTION, at.hvac_action).toLowerCase() + ' · ' : ''}${z.on ? 'settpunkt' : 'termostaten er av'}`;
        chips = (at.hvac_modes || []).map((m) => [m, lbl(HVAC, m), s && s.state === m, 'hvac']);
        if (Array.isArray(at.preset_modes) && at.preset_modes.length) chips2 = at.preset_modes.map((p) => [p, lbl(PRESET, p), at.preset_mode === p, 'preset']);
      }
      const chipRow = (L) => L.length ? `<div class="durs">${L.map(([v, l, on, a]) => `<button class="dur" data-act="${a}" data-id="${esc(id)}" data-v="${esc(v)}" data-key="${esc(a + v)}" data-haptic="selection" style="background:${on ? PINK : 'var(--gray200,#3a3a3a)'};color:${on ? INK : 'var(--gray800,#afafaf)'}"><span class="ell">${esc(l)}</span></button>`).join('')}</div>` : '';
      return `<section class="zd" data-key="zd">
        <div class="row" style="gap:12px">
          <span class="zdi" style="background:${z.man ? C.inner : G};color:${z.man ? 'var(--gray700,#979797)' : '#282828'}">${M.icon(z.icon, 22)}</span>
          <span class="grow col"><span style="font-size:16px;font-weight:600" class="ell">${esc(M.name(this.hass, id))}</span><span class="t12 dim">${esc([areaN, z.temp != null ? `nå ${nf(z.temp, 1)}°` : '', s ? M.relTime(s.last_changed) : 'finnes ikke'].filter(Boolean).join(' · '))}</span></span>
          <button class="zx press" data-act="zone" data-id="" title="Lukk">${M.icon('close', 18)}</button>
        </div>
        <div class="stp">
          <button class="sb" data-act="step" data-id="${esc(id)}" data-d="-1" data-haptic="selection">${M.icon('remove', 22)}</button>
          <span class="col" style="align-items:center"><span class="sv num">${val}</span><span class="t11 dim">${esc(sub)}</span></span>
          <button class="sb" data-act="step" data-id="${esc(id)}" data-d="1" data-haptic="selection">${M.icon('add', 22)}</button>
        </div>
        ${chipRow(chips)}${chipRow(chips2)}
        <button class="row" style="gap:12px;text-align:left;width:100%" data-act="power" data-id="${esc(id)}" data-haptic="success">
          ${M.icon('power_settings_new', 20, 'color:var(--gray700,#979797)')}
          <span class="grow col"><span class="t14">${z.dom === 'fan' ? 'Vifta er på' : 'Termostaten er på'}</span><span class="t11 dim">Av = ${z.dom === 'fan' ? 'vifta stopper' : 'sonen varmes ikke'}</span></span>
          ${sw(z.on)}</button>
        <button class="more press" data-act="more" data-id="${esc(id)}">${M.icon('open_in_new', 16)}Detaljer</button>
      </section>`;
    }

    /* ---------------- Energi */
    _en2(A, K) {
      const en = this._en || { hours: [], pts: [] }, hrs = en.hours.slice();
      const h0 = hourStart(), d0 = new Date(); d0.setHours(0, 0, 0, 0);
      if (K.used != null) hrs.push({ t: h0, v: K.used });
      const today = hrs.filter((x) => x.t >= d0.getTime());
      const dmax = today.reduce((m, x) => (!m || x.v > m.v ? x : m), null);
      const perDay = {};
      hrs.forEach((x) => { const k = new Date(x.t).toDateString(); if (new Date(x.t).getMonth() === d0.getMonth() && (!perDay[k] || x.v > perDay[k])) perDay[k] = x.v; });
      const top = Object.values(perDay).sort((a, b) => b - a).slice(0, 3);
      const top3 = top.length ? top.reduce((a, b) => a + b, 0) / top.length : null;
      const nextStep = top3 != null ? STEPS.find((s) => s > top3) : null;
      let out = `<section class="sec" style="gap:12px">${hdr('Dynamisk grense', nextStep ? `neste trinn ved ${nextStep} kW` : '')}
        <div class="row" style="align-items:baseline;gap:6px"><span class="big num">${K.limit != null ? nf(K.limit, 2) : '–'}</span><span class="t14 dim">kWh denne timen</span></div>
        <div class="xst" style="grid-template-columns:repeat(3,1fr)">${[[dmax ? nf(dmax.v, 2) : '–', dmax ? `døgnmaks kl. ${M.pad(new Date(dmax.t).getHours())}` : 'døgnmaks'], [top3 != null ? nf(top3, 2) : '–', 'snitt topp 3'], [K.expect != null ? nf(K.expect, 2) : '–', 'forventet nå']].map(([v, k]) => `<div class="xsc" style="padding:10px 4px"><b class="num" style="font-size:16px">${v}</b><span>${esc(k)}</span></div>`).join('')}</div>
        <div class="t12 dim" style="text-wrap:pretty">${esc(K.limit == null ? 'Ingen timegrense satt – velg en entitet eller skriv inn grensen i tilpasning.' : top.length ? `Topp tre denne måneden: ${top.map((v) => nf(v, 2)).join(' / ')} kWh.` : 'Ingen timeverdier ennå denne måneden.')}</div>
        ${K.limit == null ? `<button class="pick press" data-act="customize" data-section="overrides" style="align-self:flex-start">${M.icon('mdi:plus', 18)}Velg grense</button>` : ''}</section>`;
      // KI sparer
      const sv = A.savings.map((id) => ({ id, v: this.n(id) })).filter((x) => x.v != null);
      const sum = sv.reduce((a, b) => a + b.v, 0), mx = Math.max(...sv.map((x) => x.v), 1);
      out += `<section class="sec" style="gap:12px">${hdr('KI sparer', sv.length ? `${sv.length} kilder` : '')}
        ${sv.length ? `<div class="row" style="align-items:baseline;gap:6px"><span class="big num">${nf(sum, 0)}</span><span class="t14 dim">kr spart</span></div>
        <div class="col" style="gap:10px">${sv.map((x) => `<button class="col svr" data-act="more" data-id="${esc(x.id)}" data-key="${esc(x.id)}" style="gap:5px;width:100%;text-align:left"><span class="row t13" style="justify-content:space-between;width:100%"><span class="row" style="gap:8px">${M.icon(M.domainIcon(x.id, this.s(x.id)) === 'mdi:eye' ? 'savings' : M.domainIcon(x.id, this.s(x.id)), 17, 'color:var(--gray700,#979797)')}${esc(M.name(this.hass, x.id))}</span><b class="num">${nf(x.v, 0)} kr</b></span><span class="svb"><span style="width:${Math.max(0, (x.v / mx) * 100)}%"></span></span></button>`).join('')}</div>`
          : M.emptyState('Fant ingen sparesensorer (kr)', 'entities').replace('class="empty"', 'class="empty in"')}</section>`;
      // Månedstall
      const monthKwh = hrs.filter((x) => new Date(x.t).getMonth() === d0.getMonth()).reduce((a, b) => a + b.v, 0);
      const dayKwh = today.reduce((a, b) => a + b.v, 0);
      const over = K.limit ? hrs.filter((x) => x.v > K.limit).length : null;
      const ps = this.s(A.price), prices = this._prices(ps);
      const costDay = prices ? today.reduce((a, x) => a + x.v * (prices[new Date(x.t).getHours()] || 0), 0) : null;
      const mstats = [[hrs.length ? nf(dayKwh, 1) : '–', 'kWh i dag'], [hrs.length ? nf(monthKwh, 0) : '–', 'kWh denne mnd'], [over != null && hrs.length ? String(over) : '–', 'timer over grensen'], [top.length ? nf(top[0], 2) : '–', 'maks time mnd'], [ps && M.isNum(ps.state) ? nf(+ps.state, 2) : '–', 'pris nå'], [costDay != null && hrs.length ? nf(costDay, 0) : '–', 'kr i dag (est.)']];
      out += `<section class="mg">${mstats.map(([v, k]) => `<div class="mgc"><b class="num">${v}</b><span>${esc(k)}</span></div>`).join('')}</section>`;
      // Effekt siste 6 timer (18 × 20 min)
      const t = Date.now(), pts = (en.pts || []).concat(K.now != null ? [{ t, v: K.now }] : []), B = [];
      for (let i = 17; i >= 0; i--) { const b = t - (i + 1) * 1200000; B.push(twMean(pts, b, b + 1200000)); }
      const bm = Math.max(...B.map((v) => v || 0), 0.1), avg = B.filter((v) => v != null).reduce((a, b, _, arr) => a + b / arr.length, 0);
      out += xcard({ icon: 'ssid_chart', title: 'Effekt siste 6 timer', meta: 'snitt per 20 min', bars: pts.length ? B.map((v) => ({ h: Math.max(3, ((v || 0) / bm) * 100), c: v > avg ? OR : M.alpha(OR, 0.5) })) : null, body: pts.length ? '' : M.emptyState('Ingen effekthistorikk', 'overrides').replace('class="empty"', 'class="empty in"'), note: K.now != null ? `Oransje = over snittet (${nf(avg, 2)} kW). Nå ${nf(K.now, 2)} kW.` : '' });
      // Grenser
      const rows = [{ k: 'Absolutt timegrense', v: K.limit != null ? `${nf(K.limit, 2)} kWh` : '–', pill: 1, act: A.limitEnt ? 'more' : 'customize', id: A.limitEnt || '', data: A.limitEnt ? '' : 'data-section="overrides"', key: '_lim' }];
      A.limits.forEach((id) => rows.push({ k: M.name(this.hass, id), v: M.fmtState(this.hass, id), pill: 1, act: 'more', id }));
      out += xcard({ icon: 'rule', title: 'Grenser', meta: nextStep ? `trinn ${nextStep} kW` : '', rows });
      return out;
    }
    _prices(ps) {
      if (!ps) return null;
      let arr = ps.attributes.today || ps.attributes.raw_today;
      if (!Array.isArray(arr) || !arr.length) return null;
      arr = arr.map((x) => (typeof x === 'object' && x ? (x.value != null ? x.value : x.total != null ? x.total : x.price) : x)).map(Number);
      if (arr.length > 24) { const k = Math.round(arr.length / 24), o = []; for (let i = 0; i < 24; i++) { const sl = arr.slice(i * k, i * k + k); o.push(sl.reduce((a, b) => a + b, 0) / sl.length); } arr = o; }
      return arr;
    }

    /* ---------------- Vann og bad */
    _vb(A) {
      const wt = this.ui.water || 'ber';
      let out = `<div class="seg">${[['ber', 'Bereder', 'water_heater'], ['bad', 'Bad', 'bathtub']].map(([k, l, ic]) => `<button data-act="water" data-key="${k}" data-v="${k}" data-haptic="selection" style="background:${wt === k ? PINK : 'transparent'};color:${wt === k ? INK : 'var(--gray700,#979797)'}">${M.icon(ic, 19)}${l}</button>`).join('')}</div>`;
      if (wt === 'ber') {
        const hs = this.s(A.heater), lg = this.s(A.legio), L = this._legio(lg);
        if (!hs && !lg) out += `<section class="sec">${M.emptyState('Fant ingen varmtvannsbereder', 'overrides').replace('class="empty"', 'class="empty in"')}</section>`;
        else {
          const on = hs && hs.state !== 'off' && !M.unavailable(hs);
          const heating = hs && (hs.attributes.hvac_action === 'heating' || (hs.attributes.current_temperature != null && hs.attributes.temperature != null && hs.attributes.current_temperature < hs.attributes.temperature - 1 && on));
          const col = lg ? (L.ok ? G : R) : on ? OR : C.ctrl;
          out += `<section class="sec lg" data-ent="${esc(A.legio || A.heater)}">
            <div class="ring"><div class="rg" style="background:conic-gradient(${col} 0 ${(lg ? L.frac : 1) * 360}deg, var(--gray300,#404040) 0)"></div>
              <div class="rin">${M.icon(lg ? (L.ok ? 'verified_user' : 'warning') : 'water_heater', 22, `color:${col}`)}<span class="t10 dim num">${esc(lg ? L.mid : hs ? M.fmtState(this.hass, A.heater) : '–')}</span></div></div>
            <div class="grow col" style="gap:4px">
              <span class="cap" style="color:${col}">${lg ? (L.ok ? 'Legionella sikret' : 'Legionella forfalt') : 'Varmtvann'}</span>
              <span style="font-size:16px;font-weight:600">${hs ? (heating ? 'Bereder varmer' : on ? 'Bereder er på' : 'Bereder står stille') : esc(M.name(this.hass, A.legio))}</span>
              <span class="t12 dim" style="text-wrap:pretty">${esc([hs && hs.attributes.current_temperature != null ? `Nå ${nf(hs.attributes.current_temperature, 0)}°${hs.attributes.temperature != null ? `, mål ${nf(hs.attributes.temperature, 0)}°` : ''}.` : '', lg ? L.sub + '.' : ''].filter(Boolean).join(' '))}</span>
            </div></section>`;
        }
        // Prisstyring
        const ps = this.s(A.price), pr = this._prices(ps);
        if (!pr) out += `<section class="sec">${hdr('Prisstyring', '–')}${M.emptyState('Fant ingen strømpris', 'overrides').replace('class="empty"', 'class="empty in"')}</section>`;
        else {
          const run = new Set(), segs = A.heater ? this._segs(A.heater) : [];
          segs.forEach(([a, b]) => { for (let hh = Math.floor(a); hh < Math.ceil(b); hh++) run.add(hh); });
          const pm = Math.max(...pr, 0.01), nowH = new Date().getHours();
          out += `<section class="sec">${hdr('Prisstyring', 'grønn = bereder kjører')}
            <div class="pb">${pr.map((v, i) => `<span style="height:${Math.max(3, (v / pm) * 100)}%;background:${run.has(i) ? G : C.inner};${i === nowH ? 'box-shadow:inset 0 0 0 1.5px #fafafa' : ''}"></span>`).join('')}</div>
            <div class="pl num"><span>00</span><span>06</span><span>12</span><span>18</span><span>23</span></div></section>`;
        }
        // Brytere
        out += `<section class="col" style="gap:8px">${A.vann.length ? A.vann.map((id, i) => pillRow(this, id, [OR, G, G, B][i % 4])).join('') : M.emptyState('Fant ingen bereder-brytere', 'entities')}</section>`;
        // Knapper
        const btns = [];
        const w = A.heater && A.heater.startsWith('water_heater.') ? this.s(A.heater) : null;
        if (w && Array.isArray(w.attributes.operation_list)) w.attributes.operation_list.filter((m) => m !== 'off').slice(0, 2).forEach((m) => btns.push({ act: 'wmode', v: m, icon: /boost|high|perf/.test(m) ? 'bolt' : /eco|heat_pump/.test(m) ? 'eco' : 'sync', label: lbl(PRESET, m), on: w.attributes.operation_mode === m || w.state === m }));
        if (!btns.length && A.heater) btns.push({ act: 'toggle', v: '', id: A.heater, icon: 'bolt', label: M.isOn(this.s(A.heater)) ? 'Slå av' : 'Slå på', on: M.isOn(this.s(A.heater)) }, { act: 'more', v: '', id: A.heater, icon: 'sync', label: 'Detaljer', on: false });
        if (btns.length) out += `<section class="g2">${btns.map((b) => `<button class="wb press" data-act="${b.act}" data-id="${esc(b.id || A.heater)}" data-v="${esc(b.v)}" data-key="${esc(b.act + b.v)}" data-haptic="success" style="background:${b.on ? PINK : 'var(--gray200,#3a3a3a)'};color:${b.on ? INK : '#fafafa'}">${M.icon(b.icon, 18)}${esc(b.label)}</button>`).join('')}</section>`;
        return out;
      }
      // Bad
      const tw = this.s(A.towel);
      const bathZones = A.zones.filter((id) => A.bathAreas.includes(M.areaOf(this.hass, id)));
      if (!tw && !bathZones.length) return out + M.emptyState('Fant ingen håndklevarmer eller varme på bad', 'overrides');
      if (A.towel) {
        const on = M.isOn(tw) || (tw && tw.state === 'on'), segs = this._segs(A.towel), onH = segs.reduce((a, [x, y]) => a + (y - x), 0);
        const pw = M.all(this.hass, 'sensor', (s, id) => s.attributes.device_class === 'power' && ((M.regEntry(this.hass, id) || {}).device_id && (M.regEntry(this.hass, id) || {}).device_id === (M.regEntry(this.hass, A.towel) || {}).device_id || RX.towel.test(hay(this.hass, id))))[0];
        const w = pw ? this.n(pw) : null;
        out += xcard({ icon: 'dry_cleaning', title: 'Håndklevarmer', meta: tw ? (on ? 'På' : 'Av') : '–', rows: [
          { k: on ? 'Står på' : 'Står av', dot: on ? G : C.ctrl, sub: tw ? `Endret ${M.relTime(tw.last_changed)}` : 'Finnes ikke', v: w != null ? `${nf(w, 0)} W` : '', act: 'more', id: A.towel, key: '_tws' },
          { k: 'Bryteren nå', sub: 'Slå håndklevarmeren av eller på', tog: on, act: 'toggle', id: A.towel, key: '_twt' }] });
        out += xcard({ icon: 'savings', title: 'Håndklevarmer i dag', meta: `${segs.length} økter`, stats: [[`${nf(onH, 1)} t`, 'på i dag'], [w != null ? nf((w / 1000) * onH, 2) : '–', 'kWh (est.)'], [`${nf(Math.max(0, new Date().getHours() + new Date().getMinutes() / 60 - onH), 1)} t`, 'av i dag']], note: w != null ? `Estimert fra effekten nå (${nf(w, 0)} W) × tid på i dag.` : '' });
        out += xcard({ icon: 'shower', title: 'Påslått i dag', meta: segs.length ? segs.map(([a, b]) => `${M.pad(Math.floor(a))}:${M.pad(Math.round((a % 1) * 60))}–${M.pad(Math.floor(b))}:${M.pad(Math.round((b % 1) * 60))}`).slice(0, 2).join(' · ') : 'ikke på i dag', lines: [['Håndklevarmer', segs.map(([a, b]) => [a, b, b - a > 2.5 ? `${M.pad(Math.floor(a))}–${M.pad(Math.floor(b))}` : '', G])]], nowH: new Date().getHours() + new Date().getMinutes() / 60 });
      }
      bathZones.forEach((id) => {
        const z = this._zoneInfo(id);
        out += xcard({ key: id, icon: z.dom === 'fan' ? 'mode_fan' : 'mdi:heating-coil', title: M.name(this.hass, id), meta: `${z.temp != null ? nf(z.temp, 1) + '°' : '–'}${z.set != null ? ` · mål ${nf(z.set, 1)}°` : ''}`, rows: [{ k: z.tag, dot: z.heat ? OR : z.on ? G : C.ctrl, sub: z.heat ? 'Varmer mot målet' : z.on ? 'Rommet er på måltemperatur' : 'Av', v: z.dom === 'fan' ? `${nf(z.pct, 0)} %` : '', act: 'zonego', id, key: '_' + id }] });
      });
      return out;
    }

    /* ---------------- Tanker */
    _ta(A, K) {
      const think = [['Grensen denne timen', A.limitEnt ? 'Fra ' + M.name(this.hass, A.limitEnt) : 'Fra kortets innstilling', K.limit != null ? `${nf(K.limit, 2)} kWh` : '–'], ['Brukt så langt', A.energy ? 'Fra energimåler' : 'Beregnet fra effekten', K.used != null ? `${nf(K.used, 2)} kWh` : '–'], ['Tillatt snitt resten av timen', `${K.minLeft} minutter igjen`, K.allowed != null ? `${nf(K.allowed, 2)} kW` : '–'], ['Effekt nå', A.power ? M.name(this.hass, A.power) : 'Ingen måler', K.now != null ? `${nf(K.now, 2)} kW` : '–'], ['Ledig til varme', 'Tillatt snitt minus effekt nå', K.free != null ? `${nf(K.free, 2)} kW` : '–']];
      let out = `<section class="sec" style="gap:4px"><div class="t15" style="padding-bottom:6px">Slik tenker motoren nå</div>${think.map(([k, sub, v]) => `<div class="row" style="gap:10px;padding:6px 0"><span class="grow col"><span class="t13">${esc(k)}</span><span class="t11" style="color:var(--gray500,#696969)">${esc(sub)}</span></span><span class="t13 num" style="font-weight:600;white-space:nowrap">${esc(v)}</span></div>`).join('')}</section>`;
      const log = (this._log || []).filter((e) => e && e.when).slice().sort((a, b) => b.when - a.when);
      const colOf = (st) => (/heat|on|heating/.test(st) ? OR : /off/.test(st) ? C.ctrl : /cool/.test(st) ? B : G);
      out += `<section class="sec" style="gap:0"><div class="hd" style="padding-bottom:10px"><span class="t15">Beslutningslogg</span><span class="t12 dim">${this._log ? `${log.length} oppføringer` : 'henter …'}</span></div>
        ${log.length ? log.slice(0, 8).map((e, i, arr) => { const c = colOf(String(e.state || '')); const tm = new Date(typeof e.when === 'number' ? e.when * 1000 : e.when); return `<div class="lg2"><span class="lgl"><span class="lgd" style="background:${c};box-shadow:0 0 0 3px ${M.alpha(c, 0.2)}"></span><span class="lgline" style="background:${i === arr.length - 1 ? 'transparent' : C.inner}"></span></span>
          <span class="grow col" style="gap:2px;padding-bottom:14px"><span class="row" style="gap:8px;align-items:baseline"><span class="t12 dim num">${hhmm(tm)}</span><span class="t13" style="font-weight:500">${esc(e.name || M.name(this.hass, e.entity_id))}</span></span><span class="t11 dim">${esc(e.message || (e.state != null ? `endret til ${lbl(HVAC, e.state)}` : ''))}</span></span></div>`; }).join('')
          : `<div class="t12" style="color:var(--gray500,#696969);padding:6px 0">${this._log ? 'Ingen hendelser siste 12 timer' : 'Loggen hentes når popupen åpnes'}</div>`}</section>`;
      const cl = A.zones.filter((id) => id.startsWith('climate.'));
      out += xcard({ icon: 'checklist', title: 'Vurdering per sone', meta: `${cl.length} termostater`, rows: cl.map((id) => { const z = this._zoneInfo(id), at = (z.s && z.s.attributes) || {}; const ac = at.hvac_action; const col = ac === 'heating' ? OR : z.on ? G : 'var(--gray700,#979797)'; return { k: M.name(this.hass, id), id, act: 'zonego', dot: ac === 'heating' ? OR : z.on ? G : C.ctrl, chip: [ac ? lbl(ACTION, ac) : z.on ? lbl(HVAC, z.s.state) : 'Av', col], sub: [z.area ? M.areaName(this.hass, z.area) : '', z.set != null ? `mål ${nf(z.set, 1)}°` : ''].filter(Boolean).join(' · '), v: z.temp != null ? `${nf(z.temp, 1)}°` : '–' }; }), body: cl.length ? '' : M.emptyState('Fant ingen termostater', 'entities').replace('class="empty"', 'class="empty in"') });
      // Temperaturtrend (fra romsensorer, siste 3 t)
      const tr = A.groups.map((g) => { const id = M.klimaRoom(this.hass, g.area).temp; if (!id) return null; const pts = (this._temps && this._temps[id]) || []; const t = Date.now(); const a = twMean(pts, t - 3.5 * 3600000, t - 2.5 * 3600000), b = this.n(id); return { g, id, n: pts.length, rate: a != null && b != null ? (b - a) / 3 : null }; }).filter(Boolean);
      out += xcard({ icon: 'timer', title: 'Temperaturtrend', meta: 'endring siste 3 timer', rows: tr.map((x) => ({ k: x.g.name, id: x.id, act: 'more', sub: `${x.n} målinger siste døgn`, v: x.rate != null ? `${x.rate >= 0 ? '+' : '−'}${nf(Math.abs(x.rate), 1)} °C/t` : '–' })), body: tr.length ? '' : M.emptyState('Fant ingen romtemperaturer', 'entities').replace('class="empty"', 'class="empty in"'), note: 'Trenden viser hvor raskt rommet endrer temperatur. Treg endring betyr at rommet holder godt på varmen, så nattsenking sjelden lønner seg.' });
      return out;
    }

    /* ---------------- Oppsett */
    _op(A) {
      const cols = [G, B, OR, R, C.pink];
      let out = `<section class="col" style="gap:8px"><div class="t15" style="padding:0 6px">Motor og vann</div>${A.setup.length ? A.setup.map((id, i) => pillRow(this, id, cols[i % cols.length])).join('') : M.emptyState('Fant ingen brytere eller automasjoner for klima', 'entities')}</section>`;
      if (A.times.length) out += xcard({ icon: 'schedule', title: 'Tider', meta: `${A.times.length} tider`, rows: A.times.map((id) => ({ k: M.name(this.hass, id), id, act: 'more', v: this._timeVal(id), pill: 1 })) });
      if (A.values.length) out += xcard({ icon: 'tune', title: 'Verdier og valg', meta: '', rows: A.values.map((id) => ({ k: M.name(this.hass, id), id, act: 'more', v: M.fmtState(this.hass, id), pill: 1 })) });
      if (!A.times.length && !A.values.length) out += xcard({ icon: 'schedule', title: 'Tider og verdier', meta: '', body: M.emptyState('Fant ingen tider eller verdier', 'entities').replace('class="empty"', 'class="empty in"') });
      return out;
    }
    _timeVal(id) {
      const s = this.s(id);
      if (!s) return '–';
      if (/^\d\d:\d\d/.test(s.state)) return s.state.slice(0, 5);
      const m = /(\d\d:\d\d)/.exec(s.state);
      return m ? m[1] : M.fmtState(this.hass, id);
    }

    /* ---------------- Avansert */
    _av(A, K) {
      const c = this.config;
      let out = xcard({ icon: 'palette', title: 'Terskler for fargesonene', meta: 'prosent av tillatt effekt', rows: [['Gul fra', Y, c.terskel_gul ?? 75], ['Oransje fra', OR, c.terskel_oransje ?? 88], ['Rød fra', R, c.terskel_rod ?? 97]].map(([k, col, v]) => ({ k, dot: col, v: `${v} %`, pill: 1, act: 'customize', data: 'data-section="terskler"', key: k })), note: 'Fargene styrer buen og statusen i toppkortet. Motoren senker først når den ikke får plass i budsjettet – fargene styrer varsling, ikke selve utkoblingen.' });
      const hv = ((this._en && this._en.hours) || []).slice(-24).map((x) => x.v);
      const mean = hv.length ? hv.reduce((a, b) => a + b, 0) / hv.length : null;
      const sd = hv.length > 1 ? Math.sqrt(hv.reduce((a, b) => a + (b - mean) ** 2, 0) / (hv.length - 1)) : null;
      out += xcard({ icon: 'query_stats', title: 'Prognose og reserver', meta: hv.length < 8 ? 'usikkert grunnlag' : `${hv.length} timer grunnlag`, stats: [[K.expect != null ? nf(K.expect, 2) : '–', 'forventet (kWh)'], [sd != null ? '+' + nf(sd, 2) : '–', 'usikkerhet (kWh)'], [K.left != null ? nf(K.left, 2) : '–', 'igjen (kWh)']], rows: [{ k: 'Snitt siste døgn', v: mean != null ? `${nf(mean, 2)} kWh` : '–', pill: 1, key: '_m' }, { k: 'Høyeste time siste døgn', v: hv.length ? `${nf(Math.max(...hv), 2)} kWh` : '–', pill: 1, key: '_x' }, { k: 'Laveste time siste døgn', v: hv.length ? `${nf(Math.min(...hv), 2)} kWh` : '–', pill: 1, key: '_n' }], note: 'Forventet = brukt så langt + effekt nå × resten av timen. Usikkerheten er standardavviket for timeforbruket siste døgn.' });
      const cl = A.zones.filter((id) => id.startsWith('climate.'));
      out += xcard({ icon: 'event_repeat', title: 'Moduser og unntak', meta: `${cl.length} soner`, rows: cl.map((id) => { const s = this.s(id); return { k: M.name(this.hass, id), id, act: 'zonego', sub: s && s.attributes.preset_mode && s.attributes.preset_mode !== 'none' ? `Forhåndsvalg: ${lbl(PRESET, s.attributes.preset_mode)}` : '', v: s ? lbl(HVAC, s.state) : '–', pill: 1 }; }), body: cl.length ? '' : M.emptyState('Fant ingen termostater', 'entities').replace('class="empty"', 'class="empty in"') });
      const ents = [['Effekt', A.power], ['Forbruk denne timen', A.energy], ['Timegrense', A.limitEnt], ['Strømpris', A.price], ['Bereder', A.heater], ['Legionella', A.legio], ['Håndklevarmer', A.towel]];
      out += xcard({ icon: 'forum', title: 'Entiteter', meta: 'autokonfig', rows: ents.map(([k, id]) => ({ k, sub: id || 'ikke funnet', v: id ? M.fmtState(this.hass, id) : '–', pill: 1, act: id ? 'more' : 'customize', id: id || '', data: id ? '' : 'data-section="overrides"', key: k })), note: 'Bytt entiteter under Tilpass → Bytt entiteter. Skjul eller legg til under Entiteter.' });
      return out + `<button class="pick press" data-act="customize" style="align-self:center">${M.icon('tune', 18)}Tilpass</button>`;
    }

    /* ---------------- handlinger */
    onAction(name, el, ev) {
      const d = el.dataset, h = this.hass;
      const toast = (t) => { if (this.config.toasts !== false) M.toast(t); };
      switch (name) {
        case 'tab': return this.setUI({ tab: d.key });
        case 'water': return this.setUI({ water: d.v });
        case 'zone': return this.setUI({ zone: d.id && this.ui.zone !== d.id ? d.id : null });
        case 'zonego': this.setUI({ tab: 'so', zone: d.id }); return;
        case 'step': return this._step(d.id, Number(d.d));
        case 'hvac': toast(`${M.name(h, d.id)}: ${lbl(HVAC, d.v)}`); return M.call(h, 'climate', 'set_hvac_mode', { entity_id: d.id, hvac_mode: d.v });
        case 'preset': return M.call(h, 'climate', 'set_preset_mode', { entity_id: d.id, preset_mode: d.v });
        case 'fpreset': return M.call(h, 'fan', 'set_preset_mode', { entity_id: d.id, preset_mode: d.v });
        case 'fpct': return M.call(h, 'fan', 'set_percentage', { entity_id: d.id, percentage: Number(d.v) });
        case 'wmode': return M.call(h, 'water_heater', 'set_operation_mode', { entity_id: d.id, operation_mode: d.v });
        case 'power': {
          const dom = d.id.split('.')[0], s = this.s(d.id), on = dom === 'fan' ? s && s.state === 'on' : s && s.state !== 'off';
          toast(`${M.name(h, d.id)} ${on ? 'slått av' : 'slått på'}`);
          return M.call(h, dom, on ? 'turn_off' : 'turn_on', { entity_id: d.id });
        }
        default: return super.onAction(name, el, ev);
      }
    }
    _step(id, dir) {
      const s = this.s(id);
      if (!s) return;
      const at = s.attributes, dom = id.split('.')[0];
      this._pend = this._pend || {};
      this._timers = this._timers || {};
      let nv;
      if (dom === 'fan') {
        const step = at.percentage_step || 10, cur = this._pend[id] != null ? this._pend[id] : at.percentage || 0;
        nv = M.clamp(Math.round((cur + dir * step) / step) * step, 0, 100);
      } else {
        const step = at.target_temp_step || 0.5;
        if (at.temperature == null && at.target_temp_low != null && this._pend[id] == null) {
          const lo = at.target_temp_low + dir * step, hi = at.target_temp_high + dir * step;
          return M.call(this.hass, 'climate', 'set_temperature', { entity_id: id, target_temp_low: lo, target_temp_high: hi });
        }
        const cur = this._pend[id] != null ? this._pend[id] : at.temperature != null ? at.temperature : at.current_temperature || 20;
        nv = M.clamp(Math.round((cur + dir * step) / step) * step, at.min_temp != null ? at.min_temp : 5, at.max_temp != null ? at.max_temp : 35);
      }
      this._pend[id] = nv;
      this.update();
      clearTimeout(this._timers[id]);
      this._timers[id] = setTimeout(() => {
        const v = this._pend[id];
        const p = dom === 'fan' ? M.call(this.hass, 'fan', 'set_percentage', { entity_id: id, percentage: v }) : M.call(this.hass, 'climate', 'set_temperature', { entity_id: id, temperature: v });
        if (dom !== 'fan' && this.config.toasts !== false) M.toast(`${M.name(this.hass, id)} satt til ${nf(v, 1)}°`);
        Promise.resolve(p).catch(() => {}).then(() => setTimeout(() => { if (this._pend) { delete this._pend[id]; this.update(); } }, 1500));
      }, 650);
    }
    afterRender() {
      const nav = this.shadowRoot.querySelector('.tabs');
      M.tabReorder(nav, { card: this, onReorder: (keys) => { const hid = this.config.hidden_tabs || []; M.mshPatchConfig(this, { tab_order: keys.concat(hid.filter((k) => !keys.includes(k))) }); } });
      const md = this.shadowRoot.querySelector('.modes');
      if (md && !md.__b) { md.__b = true; const st = (e) => e.stopPropagation(); md.addEventListener('touchstart', st, { passive: true }); md.addEventListener('touchmove', st, { passive: true }); }
    }
    get styles() {
      return SHARED_CSS + `
        .wrap{display:flex;flex-direction:column;gap:var(--msh-gap,8px)}
        .modes{display:flex;gap:12px;overflow-x:auto;padding:2px 4px}
        .mode{flex:none;display:flex;flex-direction:column;align-items:center;gap:6px;width:66px}
        .mb{width:58px;height:58px;border-radius:29px;display:grid;place-items:center;transition:transform .35s cubic-bezier(.34,1.8,.64,1),background .25s}
        .mode:active .mb{transform:scale(.94)!important}
        .ml{font-size:11px;font-weight:500;white-space:nowrap;max-width:66px}
        ${M.TAB_ROW_CSS || ''}
        .tbox{padding:4px;border-radius:24px;background:var(--gray200,#3a3a3a);min-width:0;overflow:hidden}
        .tabs{gap:2px;border-radius:20px}
        .tabs>.tab{flex:1 0 auto;min-width:56px;padding:0 8px;height:54px;border-radius:20px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;transition:background .25s}
        .tl{font-size:9.5px;font-weight:500;white-space:nowrap}
        .bars{position:relative;display:flex;align-items:flex-end;gap:4px;height:96px}
        .bars>span:not(.lim){flex:1;border-radius:6px;transition:height .4s}
        .bars .lim{position:absolute;left:0;right:0;bottom:88px;border-top:1px dashed var(--gray400,#545454)}
        .bl{display:flex;gap:4px} .bl span{flex:1;text-align:center;font-size:9px;color:var(--gray500,#696969)}
        .fc{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
        .fcc{display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px 4px;border-radius:18px;background:var(--gray200,#3a3a3a)}
        .fcc b{font-size:14px;font-weight:600} .fcc>span:last-child{font-size:10px;color:var(--gray600,#7f7f7f)}
        .fb{position:relative;width:8px;height:44px;border-radius:4px;background:var(--gray300,#404040);overflow:hidden}
        .fb span{position:absolute;left:0;right:0;bottom:0;border-radius:4px}
        .g2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
        .bed{display:flex;align-items:center;gap:10px;height:62px;padding:0 12px 0 6px;border-radius:31px;transition:background .25s,transform .2s;min-width:0}
        .bi{width:50px;height:50px;border-radius:25px;flex:none;display:grid;place-items:center}
        .gh{display:flex;align-items:center;gap:10px;padding:4px 6px 0}
        .zc{display:flex;flex-direction:column;align-items:flex-start;gap:8px;padding:12px;border-radius:26px;transition:background .25s,transform .2s;min-width:0}
        .zc:active{transform:scale(.97)}
        .zt{display:flex;justify-content:space-between;align-items:center;width:100%}
        .zi{width:38px;height:38px;border-radius:19px;display:grid;place-items:center}
        .ztag{font-size:10px;font-weight:600;padding:3px 8px;border-radius:8px;white-space:nowrap}
        .zv{font-size:26px;font-weight:300;letter-spacing:-0.03em}
        .zu{font-size:14px;color:var(--gray600,#7f7f7f);letter-spacing:0}
        .zd{display:flex;flex-direction:column;gap:14px;padding:16px;border-radius:28px;background:var(--gray200,#3a3a3a);box-shadow:inset 0 0 0 1px rgba(255,255,255,0.06)}
        .zdi{width:48px;height:48px;border-radius:24px;flex:none;display:grid;place-items:center}
        .zx{width:36px;height:36px;border-radius:18px;background:var(--gray200,#3a3a3a);display:grid;place-items:center;flex:none}
        .stp{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px;border-radius:30px;background:var(--gray200,#3a3a3a)}
        .sb{width:48px;height:48px;border-radius:24px;background:var(--gray200,#3a3a3a);display:grid;place-items:center;transition:transform .15s}
        .sb:active{transform:scale(.92)}
        .sv{font-size:30px;font-weight:300;letter-spacing:-0.03em}
        .durs{display:flex;gap:6px}
        .dur{flex:1;min-width:0;height:38px;border-radius:19px;font-size:13px;font-weight:500;padding:0 6px;display:flex;align-items:center;justify-content:center}
        .more{align-self:center;height:32px;padding:0 12px;border-radius:16px;display:flex;align-items:center;gap:6px;font-size:12px;color:var(--gray700,#979797)}
        .big{font-size:40px;font-weight:300;letter-spacing:-0.04em}
        .svb{display:block;height:8px;border-radius:4px;background:var(--gray300,#404040);overflow:hidden;width:100%} .svb span{display:block;height:100%;border-radius:4px;background:${G}}
        .mg{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
        .mgc{display:flex;flex-direction:column;gap:2px;padding:12px;border-radius:20px;background:var(--gray200,#3a3a3a)} .mgc b{font-size:18px;font-weight:600} .mgc span{font-size:10px;color:var(--gray600,#7f7f7f)}
        .seg{display:grid;grid-template-columns:1fr 1fr;gap:2px;padding:4px;border-radius:26px;background:var(--gray200,#3a3a3a)}
        .seg button{height:48px;border-radius:22px;display:flex;align-items:center;justify-content:center;gap:8px;font-size:14px;font-weight:500;transition:background .25s}
        .lg{flex-direction:row;align-items:center;gap:16px}
        .ring{position:relative;width:96px;height:96px;flex:none}
        .rg{position:absolute;inset:0;border-radius:50%;-webkit-mask:radial-gradient(circle, transparent 37px, #000 38px);mask:radial-gradient(circle, transparent 37px, #000 38px)}
        .rin{position:absolute;inset:10px;border-radius:50%;background:var(--gray200,#3a3a3a);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px}
        .cap{font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase}
        .pb{display:flex;align-items:flex-end;gap:2px;height:70px} .pb span{flex:1;border-radius:3px;transition:background .3s}
        .pl{display:flex;justify-content:space-between;font-size:10px;color:var(--gray500,#696969)}
        .wb{height:52px;border-radius:26px;display:flex;align-items:center;justify-content:center;gap:6px;font-size:13px;font-weight:600;transition:background .25s,transform .2s}
        .lg2{display:flex;gap:12px}
        .lgl{display:flex;flex-direction:column;align-items:center;width:12px;flex:none}
        .lgd{width:10px;height:10px;border-radius:5px;margin-top:4px;flex:none}
        .lgline{flex:1;width:2px;margin-top:4px}
      `;
    }
  }
  M.define('msh-klima-card', Klima, 'MSH Klima', 'Alle termostater og vifter gruppert per rom, moduser, energi mot timegrensen, varmtvann, logg og oppsett (7 faner).');
})();
