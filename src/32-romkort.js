/* msh-romkort-card · Romkort på Hjem (åpner Rom-popupen #<area_id>). Kilde: Romkort.dc.html + romkortene i Hjem v2.dc.html.
 * Deler render-logikken med msh-hjem-faner-card via M.romData / M.romkortHTML / M.romkortCSS / M.romkortAction.
 * Varianter: graf (Romkort.dc.html – 184 px, graf med scrub, glød-ikon, chip, partikler), karusell (220 px),
 *            L (stor 246 px), M (medium 140/210 px), S (liten rad 66 px).
 * Data: KI Rom (sensor.<rom>_oversikt → temperatur/fuktighet/klima/lys/media, sensor.<rom>_effekt) → ellers HA-registre.
 */
(function () {
  const M = window.MSH, esc = M.esc, C = M.C;
  // Standard romfarge: temapaletten i rekkefølge etter rommets indeks (M.areas), med mindre config sier noe annet.
  const PAL = [C.orange, C.blue, C.green, C.purple, C.pink, C.yellow, C.red, C.lime, C.lightBlue, C.brown];
  const OUT_RX = /(^|_)(ute|utendors|utvendig|outdoor|outside|hage|garden|yard|terrasse|uteomrade)(_|$)/;
  const get = (o, p) => String(p).split('.').reduce((a, k) => (a == null ? a : a[k]), o);

  /* ------------------------------------------------------------ romdata */
  // Standardfarge per rom: temapalett (oransje, blå, grønn, lilla, rosa, gul, rød, lime …) etter rommets indeks i
  // M.areas(hass). Uten hass (eller ukjent rom): stabil hash av area_id.
  M.romColor = function (area, hass) {
    const list = hass ? M.areas(hass) : [];
    const i = list.findIndex((a) => a.id === area);
    if (i >= 0) return PAL[i % PAL.length];
    let h = 0;
    String(area || '').split('').forEach((c) => { h = (h * 31 + c.charCodeAt(0)) >>> 0; });
    return PAL[h % PAL.length];
  };
  // Romfarge fra config: look.col / look.color (rooms.<id>.color) → romColor.
  M.romCol = function (hass, area, look) { look = look || {}; return M.color(look.col || look.color, M.romColor(area, hass)); };
  const autoOf = (hass, area) => {
    if (M.roomAuto) return M.roomAuto(hass, area);
    const ov = M.kiRom(hass, area, 'oversikt'), A = (ov && ov.attributes) || {}, first = (a) => M.ids(a)[0] || null;
    return {
      A, temp: first(A.temperatur) || M.byClass(hass, 'sensor', 'temperature', area)[0] || null,
      hum: first(A.fuktighet) || M.byClass(hass, 'sensor', 'humidity', area)[0] || null,
      thermo: first(A.klima) || M.all(hass, 'climate', (s, id) => M.areaOf(hass, id) === area)[0] || null,
      lights: A.lys ? M.ids(A.lys) : M.all(hass, 'light', (s, id) => M.areaOf(hass, id) === area),
    };
  };
  // Alt et romkort trenger. card: kortet (s()/n() registrerer avhengigheter). cfg: { overrides, look:{icon,color,name}, hash }
  M.romData = function (card, area, cfg) {
    cfg = cfg || {};
    const hass = card.hass;
    if (!hass || !area || !hass.areas || !hass.areas[area]) return null;
    const A = hass.areas[area], F = A.floor_id && hass.floors ? hass.floors[A.floor_id] : null;
    const au = autoOf(hass, area), OA = au.A || {}, ov = cfg.overrides || {}, look = cfg.look || {};
    // Klima via M.roomClimate (30-rom-klima.js): KI Rom-attributtene temperatur/fuktighet kan være tall, entity_id eller liste.
    // Overstyring: overrides.temperature|humidity|climate (nye) eller temperatur|fuktighet|termostat (gamle).
    const RC = M.roomClimate ? M.roomClimate(hass, area, { overrides: ov, include: cfg.include }) : null;
    const tempId = RC ? RC.temp.id : (ov.temperature || ov.temperatur || au.temp);
    const humId = RC ? RC.hum.id : (ov.humidity || ov.fuktighet || au.hum);
    const thermo = RC ? RC.climate : (ov.climate || ov.termostat || au.thermo);
    const val = (x, id) => { if (id) { const n = card.n(id); return n != null ? n : (x && x.v != null ? x.v : null); } return x && x.v != null ? Number(x.v) : null; };
    const lights = (au.lights || []).filter((id) => hass.states[id]);
    const media = (OA.media ? M.ids(OA.media) : M.all(hass, 'media_player', (s, id) => M.areaOf(hass, id) === area)).filter((id) => hass.states[id]);
    const doors = M.all(hass, 'binary_sensor', (s, id) => ['door', 'garage_door', 'opening'].includes(s.attributes.device_class) && M.areaOf(hass, id) === area);
    const ts = card.s(thermo), temp = RC ? val(RC.temp, tempId) : card.n(tempId), hum = RC ? val(RC.hum, humId) : card.n(humId);
    const lightsOn = lights.filter((id) => { const s = card.s(id); return s && s.state === 'on'; }).length;
    const mediaOn = media.filter((id) => { const s = card.s(id); return s && s.state === 'playing'; }).length;
    const set = ts && M.isNum(ts.attributes.temperature) ? Number(ts.attributes.temperature) : null;
    const cur = ts && M.isNum(ts.attributes.current_temperature) ? Number(ts.attributes.current_temperature) : temp;
    const heating = !!ts && (ts.attributes.hvac_action === 'heating' || (ts.attributes.hvac_action == null && ts.state === 'heat' && cur != null && set != null && cur < set));
    const wattId = M.kiRomId(hass, area, 'effekt');
    const doorOpen = doors.some((id) => { const s = card.s(id); return s && s.state === 'on'; });
    const fs = F ? M.slug(F.name) + ' ' + M.slug(F.floor_id) : '';
    const outdoor = F ? fs.split(' ').some((x) => OUT_RX.test(x)) : OUT_RX.test(area) || OUT_RX.test(M.slug(A.name));
    return {
      id: area, name: look.name || A.name || area, icon: look.icon || A.icon || OA.ikon || 'mdi:texture-box', col: M.romCol(hass, area, look),
      temp, hum, tempId, humId, thermo: ts ? thermo : null, set, step: ts ? Number(ts.attributes.target_temp_step) || 0.5 : 0.5, heating,
      lights, lightsOn, media, mediaOn, doors, doorOpen, wattId, watt: card.n(wattId), floor: A.floor_id || null, floorName: F ? F.name : null, level: F ? F.level : null,
      outdoor, hash: cfg.hash || '#' + area, ent: (ts && thermo) || tempId || lights[0] || null,
    };
  };

  /* ------------------------------------------------------------ rom-merker (varsler) */
  // [type, etikett, ikon, enhet]
  M.BADGE_TYPES = [['temp', 'Temperatur', 'thermometer', '°C'], ['hum', 'Luftfuktighet', 'humidity_percentage', '%'], ['door', 'Dør åpen', 'door_open', ''], ['light', 'Lys på', 'lightbulb', ''], ['ent', 'Egen entitet', 'link', ''], ['entNum', 'Entitet-verdi', 'data_thresholding', ''], ['entState', 'Entitet-tilstand', 'rule', ''], ['price', 'Strømpris', 'bolt', 'kr'], ['watt', 'Effekt', 'electric_meter', 'W'], ['lightsN', 'Antall lys på', 'lightbulb', 'stk'], ['unlocked', 'Dør ulåst', 'lock_open', ''], ['alarmOff', 'Alarm av', 'shield', '']];
  const NUMB = ['temp', 'hum', 'price', 'watt', 'lightsN', 'entNum'];
  const BDOM = { entState: null, entNum: 'sensor', door: 'binary_sensor', temp: 'sensor', hum: 'sensor', light: 'light', unlocked: 'lock', ent: null, alarmOff: 'alarm_control_panel' };
  M.romBadgeDefaults = (r) => [...(r && r.doors && r.doors.length ? [{ type: 'door', text: 'Døren er åpen' }] : []), ...(r && !r.outdoor ? [{ type: 'hum', op: '>', val: 60, text: 'Høy luftfuktighet' }, { type: 'temp', op: '>', val: 25, text: 'Høy temperatur' }] : [])];
  // Strømpris-sensor: samme valg som prosa og strømpriskortet (M.priceSensor i 26-hjem-strompris.js).
  M.hjemPriceId = function (hass) { return hass && M.priceSensor ? M.priceSensor(hass, {}) : null; };
  M.romBadgeHit = function (card, x, r) {
    const hass = card.hass, num = (v) => { const n = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isNaN(n) ? null : n; };
    const cmp = (v, op, t) => { if (v == null || t == null) return false; return op === '<' ? v < t : op === '=' ? v === t : op === '!=' ? v !== t : v > t; };
    const t = num(x.val), st = (id) => card.s(id), n = (id) => card.n(id);
    switch (x.type) {
      case 'temp': return cmp(x.ent ? n(x.ent) : r.temp, x.op || '>', t);
      case 'hum': return cmp(x.ent ? n(x.ent) : r.hum, x.op || '>', t);
      case 'door': return x.ent ? M.isOn(st(x.ent)) : !!r.doorOpen;
      case 'light': return x.ent ? M.isOn(st(x.ent)) : r.lightsOn > 0;
      case 'ent': return !!x.ent && M.isOn(st(x.ent));
      case 'entNum': return !!x.ent && cmp(n(x.ent), x.op || '>', t);
      case 'entState': {
        const s = st(x.ent); if (!s) return false;
        const vals = String(x.val == null ? '' : x.val).split(/[,|]/).map((v) => v.trim()).filter(Boolean), m = vals.includes(s.state);
        return x.op === '!=' ? !m : m;
      }
      case 'price': return cmp(n(x.ent || M.hjemPriceId(hass)), x.op || '>', t);
      case 'watt': return cmp(n(x.ent || M.kiRomId(hass, null, 'effekt')), x.op || '>', t);
      case 'lightsN': {
        const id = x.ent || M.kiRomId(hass, null, 'lys');
        const v = id ? n(id) : M.all(hass, 'light').filter((l) => { const s = st(l); return s && s.state === 'on'; }).length;
        return cmp(v, x.op || '>', t);
      }
      case 'unlocked': return (x.ent ? [x.ent] : M.all(hass, 'lock')).some((id) => { const s = st(id); return s && s.state === 'unlocked'; });
      case 'alarmOff': { const id = x.ent || M.all(hass, 'alarm_control_panel')[0]; const s = st(id); return !!s && s.state === 'disarmed'; }
      default: return false;
    }
  };
  M.romRules = (own, rules, r) => (own ? Object.keys(rules || {}).sort().map((k) => rules[k]).filter((x) => x && x.type && x.type !== 'off') : M.romBadgeDefaults(r));
  M.romAlert = function (card, r, own, rules) {
    const hit = M.romRules(own, rules, r).find((x) => { try { return M.romBadgeHit(card, x, r); } catch (e) { return false; } });
    return hit ? (hit.text || 'Varsel') : '';
  };
  // Editorfelt for varsel-vilkår (dynamisk: eksisterende vilkår + ett tomt).
  M.romBadgeFields = function (hass, cfg, ownPath, rulesPath, r) {
    const own = !!get(cfg, ownPath);
    const defs = M.romBadgeDefaults(r).map((x) => { const T = M.BADGE_TYPES.find((b) => b[0] === x.type); return T[1] + (x.op ? ` ${x.op === '<' ? 'under' : 'over'} ${x.val}${T[3] ? ' ' + T[3] : ''}` : ''); });
    const out = [{ type: 'boolean', name: ownPath, label: 'Egne varsel-vilkår', help: own ? 'Første vilkår som slår til vises som «!» på rommet. Ingen vilkår = aldri varsel.' : `Standard: ${defs.join(' · ') || 'ingen'}` }];
    if (!own) return out;
    const R = get(cfg, rulesPath) || {}, keys = Object.keys(R).sort();
    const nextN = keys.reduce((m, k) => Math.max(m, parseInt(k.replace(/\D/g, ''), 10) || 0), 0) + 1;
    [...keys, 'v' + String(nextN).padStart(2, '0')].forEach((k, i) => {
      const x = R[k] || {}, p = `${rulesPath}.${k}`, T = M.BADGE_TYPES.find((b) => b[0] === x.type);
      out.push({ type: 'select', name: p + '.type', label: `Vilkår ${i + 1}${x.type ? '' : ' · nytt'}`, options: [['off', 'Av'], ...M.BADGE_TYPES.map((b) => [b[0], b[1]])] });
      if (!T) return;
      if (NUMB.includes(x.type)) {
        out.push({ type: 'select', name: p + '.op', label: 'Sammenligning', options: [['>', 'Over'], ['<', 'Under'], ['=', 'Er']], default: '>' });
        out.push({ type: 'text', name: p + '.val', label: `Verdi${T[3] ? ' (' + T[3] + ')' : ''}`, placeholder: '0' });
      }
      if (x.type === 'entState') {
        out.push({ type: 'select', name: p + '.op', label: 'Tilstand', options: [['=', 'Er'], ['!=', 'Er ikke']], default: '=' });
        out.push({ type: 'text', name: p + '.val', label: 'Tilstander', placeholder: 'on, open', help: 'Skill flere tilstander med komma – én av dem holder' });
      }
      if (x.type in BDOM) out.push({ type: 'entity', name: p + '.ent', label: ['ent', 'entNum', 'entState'].includes(x.type) ? 'Entitet' : 'Kilde (tom = standard fra rommet)', domain: BDOM[x.type] || undefined });
      out.push({ type: 'text', name: p + '.text', label: 'Tekst i varselet', placeholder: T[1] });
    });
    return out;
  };

  /* ------------------------------------------------------------ render */
  // Temperatur: «23°» ved hel grad, ellers én desimal med komma («22,5°»). Fukt: heltall.
  const deg = (v, d = 1) => {
    if (v == null || isNaN(v)) return '–';
    if (d === 0) return M.nf(v, 0);
    const r = Math.round(Number(v) * 10) / 10;
    return M.nf(r, r % 1 ? 1 : 0);
  };
  const setTxt = (v) => (v == null ? '–' : M.nf(v, v % 1 ? 1 : 0));
  const bang = (alert) => (alert ? `<span class="rk-bang" title="${esc(alert)}">!</span>` : '');
  const lightBtn = (r, cls, alert) => `<button class="${cls}" data-act="rk-light" data-area="${esc(r.id)}" title="Lys" style="background:${r.lightsOn ? r.col : 'var(--gray200,#3a3a3a)'};color:${r.lightsOn ? 'var(--gray000,#232323)' : 'var(--gray600,#7f7f7f)'}">${M.icon(r.icon, 24)}${bang(alert)}</button>`;
  const kv = (r) => `<div class="rk-kv"><button class="rk-kb" data-act="rk-set" data-id="${esc(r.thermo)}" data-d="1" title="Opp">${M.icon('expand_less', 20)}</button><span class="num">${setTxt(r.set)}°</span><button class="rk-kb" data-act="rk-set" data-id="${esc(r.thermo)}" data-d="-1" title="Ned">${M.icon('expand_more', 20)}</button></div>`;
  const openAttrs = (r, key) => `data-act="rk-open" data-hash="${esc(r.hash)}" ${r.ent ? `data-ent="${esc(r.ent)}"` : ''} data-key="${esc(key || 'rk-' + r.id)}"`;

  // r: M.romData(...). o: { variant, klima, alert, key, graph:{t:[],h:[]}, ui:{gTab,gSel}, cfg, motes }
  M.romkortHTML = function (r, o) {
    o = o || {};
    const v = o.variant || 'karusell', alert = o.alert || '', kl = !!o.klima && r.thermo && r.set != null;
    if (v === 'karusell') {
      return `<div class="rk rk-car ${kl ? 'kl' : ''}" ${openAttrs(r, o.key)}>
        <div class="rk-name ell">${esc(r.name)}</div>${lightBtn(r, 'rk-ic', alert)}
        <div class="rk-tv"><span class="rk-t num">${deg(r.temp)}°</span><span class="rk-h">${deg(r.hum, 0)} %</span></div>${kl ? kv(r) : ''}</div>`;
    }
    if (v === 'S') {
      return `<div class="rk rk-s" ${openAttrs(r, o.key)}>${lightBtn(r, 'rk-ic rk-ics', alert)}
        <div class="rk-sx"><span class="rk-sn ell">${esc(r.name)}</span><span class="rk-sl">${deg(r.temp)}° · ${deg(r.hum, 0)}%</span></div></div>`;
    }
    if (v === 'M' || v === 'L') {
      const h = v === 'L' ? 246 : kl ? 210 : 140;
      return `<div class="rk rk-big ${kl ? 'kl' : ''}" style="height:${h}px" ${openAttrs(r, o.key)}>
        <div class="rk-name ell">${esc(r.name)}</div>${lightBtn(r, 'rk-ic', alert)}
        <div class="rk-tv"><span class="rk-t num" style="font-size:${v === 'L' ? 44 : 40}px">${deg(r.temp)}°</span><span class="rk-h" style="color:var(--gray700,#979797)">${deg(r.hum, 0)}%</span></div>${kl ? kv(r) : ''}</div>`;
    }
    // graf (Romkort.dc.html)
    const cfg = o.cfg || {}, ui = o.ui || {}, g = o.graph || { t: [], h: [] };
    const lit = r.lightsOn > 0, hc = r.heating ? C.red : lit ? C.yellow : r.col;
    const cc = r.heating ? C.red : lit ? C.yellow : C.blue; // termostat-chip: blå i ro (CLAUDE.md), glyf/partikler i romfarge
    const ser0 = { t: g.t && g.t.length ? g.t.slice() : r.temp != null ? Array(25).fill(r.temp) : [], h: g.h && g.h.length ? g.h.slice() : r.hum != null ? Array(25).fill(r.hum) : [] };
    if (r.temp != null && ser0.t.length) ser0.t[ser0.t.length - 1] = r.temp;
    if (r.hum != null && ser0.h.length) ser0.h[ser0.h.length - 1] = r.hum;
    const isT = (ui.gTab || 't') === 't' || (!ser0.h.length && ser0.t.length);
    const ser = isT ? ser0.t : ser0.h, N = Math.max(1, ser.length - 1), sel = ui.gSel != null ? Math.min(ui.gSel, N) : N;
    const gc = isT ? M.color(cfg.graph_t, C.orange) : M.color(cfg.graph_h, C.blue);
    let line = '0,60 300,60', area = '0,100 0,60 300,60 300,100', yv = () => 60, mn = null, mx = null;
    if (ser.length) {
      mn = Math.min(...ser); mx = Math.max(...ser);
      const lo = Math.floor(mn - (isT ? 0.3 : 2)), hi = Math.ceil(mx + (isT ? 0.3 : 2));
      yv = (x) => 92 - ((x - lo) / (hi - lo || 1)) * 72;
      const pts = ser.map((x, i) => `${((i / N) * 300).toFixed(1)},${yv(x).toFixed(1)}`).join(' ');
      line = pts; area = `0,100 ${pts} 300,100`;
    }
    const tSer = ser0.t, hSer = ser0.h, tv = tSer.length ? tSer[Math.min(sel, tSer.length - 1)] : null, hv = hSer.length ? hSer[Math.min(sel, hSer.length - 1)] : null;
    const when = sel === N ? (ser.length ? `Nå · ${isT ? `${M.nf(mn, 1)}–${M.nf(mx, 1)}°` : `${M.nf(mn, 0)}–${M.nf(mx, 0)} %`} siste døgn` : 'Nå') : `−${N - sel} t`;
    const chipIcon = r.heating ? 'local_fire_department' : lit ? 'lightbulb' : 'check';
    const chipText = r.heating ? `Varmer til ${M.nf(r.set, 1)}°` : r.set != null ? `Holder ${M.nf(r.set, 1)}°` : lit ? `${r.lightsOn} lys på` : 'Alt er rolig';
    const glyph = r.heating ? 'heat' : lit ? 'lightbulb' : 'air';
    const motes = o.motes === false ? '' : [[12, 0], [24, 1.4], [36, 0.6], [48, 2.2], [60, 0.9], [70, 1.8], [80, 0.3], [30, 2.8], [54, 3.3], [18, 2]].map(([x, d], i) => `<span class="rk-mote" style="left:${x}%;width:${i % 3 ? 2 : 3}px;height:${i % 3 ? 2 : 3}px;background:${hc};box-shadow:0 0 6px ${hc};animation-duration:${(r.heating ? 3 : 6) + (i % 3) * 0.8}s;animation-delay:${d}s"></span>`).join('');
    return `<section class="rk rk-graf" ${openAttrs(r, o.key)} style="background:${M.color(cfg.background, 'var(--gray100,#2f2f2f)')}">
      <div class="rk-motes" aria-hidden="true">${motes}</div>
      <div class="rk-g">
        <svg viewBox="0 0 300 100" preserveAspectRatio="none"><polyline points="${area}" style="fill:${M.alpha(gc, 0.2)};stroke:none"></polyline><polyline points="${line}" fill="none" style="stroke:${gc}" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke"></polyline></svg>
        <div class="rk-cur" style="left:${(sel / N) * 100}%;border-left:1px dashed ${M.alpha(gc, 0.6)}"><span class="rk-dot" style="top:calc(${yv(ser[sel] != null ? ser[sel] : 0).toFixed(1)}% - 5px);box-shadow:0 0 0 3px ${M.alpha(gc, 0.5)}"></span></div>
        <div class="rk-scrub" data-n="${N}"></div>
      </div>
      <span class="rk-glyph" style="color:${hc};filter:drop-shadow(0 0 14px ${M.alpha(hc, 0.7)})">${M.icon(glyph, 30)}</span>
      <button class="rk-gear" data-act="customize" title="Tilpass">${M.icon('settings', 22)}${bang(alert)}</button>
      <div class="rk-top"><span class="rk-gn ell">${esc(r.name)}</span><span class="rk-chip" style="background:${M.alpha(cc, 0.18)};color:${cc}">${M.icon(chipIcon, 14)}${esc(chipText)}</span></div>
      <div class="rk-vals">
        <div class="rk-line">
          <button class="rk-tb" data-act="rk-gt" data-t="t" style="color:${isT ? 'var(--white,#fafafa)' : 'var(--gray600,#7f7f7f)'}"><span class="rk-gbig num">${deg(tv)}</span><span class="rk-deg">°</span></button>
          <button class="rk-hb" data-act="rk-gt" data-t="h" style="background:${isT ? 'transparent' : M.alpha(C.blue, 0.2)};color:${isT ? 'var(--gray800,#afafaf)' : 'var(--white,#fafafa)'}"><span class="rk-hv num">${deg(hv, 0)}</span><span class="rk-pc">%</span></button>
        </div>
        <span class="rk-when">${esc(when)}</span>
      </div>
    </section>`;
  };

  M.romkortCSS = `
    .rk{position:relative;cursor:pointer;box-sizing:border-box;border-radius:28px;background:var(--gray100,#2f2f2f);box-shadow:inset 0 0 0 1px rgba(255,255,255,0.04);color:var(--white,#fafafa);user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent}
    .rk-car{flex:none;width:100%;height:220px;border-radius:36px}
    .rk-car,.rk-big{container-type:inline-size}
    @container (max-width: 250px){.kl .rk-tv{flex-direction:column;align-items:flex-start;gap:4px}}
    .rk-name{position:absolute;left:18px;top:18px;right:70px;font-size:15px;font-weight:500;line-height:1.3}
    .rk-ic{position:absolute;right:6px;top:6px;width:58px;height:58px;border-radius:29px;display:grid;place-items:center;transition:background .25s,color .25s,transform .2s}
    .rk-ic:active{transform:scale(.92)}
    .rk-ics{position:relative;right:auto;top:auto;flex:none}
    .rk-bang{position:absolute;right:-3px;top:-6px;width:24px;height:24px;border-radius:12px;background:var(--red,#f28073);color:#fff;display:grid;place-items:center;font-size:14px;font-weight:700;box-shadow:0 0 0 3px var(--gray000,#232323);z-index:2;line-height:1}
    .rk-tv{position:absolute;left:18px;bottom:16px;display:flex;align-items:baseline;gap:4px;white-space:nowrap}
    .rk-t{font-size:40px;font-weight:300;letter-spacing:-0.04em;line-height:1}
    .rk-h{font-size:12px;color:var(--gray600,#7f7f7f)}
    .rk-kv{position:absolute;right:10px;bottom:10px;width:52px;height:116px;border-radius:26px;background:rgba(255,255,255,0.04);box-shadow:inset 0 0 0 1.5px rgba(255,255,255,0.24);display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:4px 0;box-sizing:border-box}
    .rk-kv .rk-kb{width:52px;height:36px;display:grid;place-items:center;color:var(--gray900,#c7c7c7)}
    .rk-kv .rk-kb:active{transform:scale(.88)}
    .rk-kv span{font-size:14px}
    .rk-s{display:flex;align-items:center;gap:12px;height:66px;padding:0 6px 0 4px;border-radius:33px;box-shadow:none}
    .rk-sx{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
    .rk-sn{font-size:15px;font-weight:500}
    .rk-sl{font-size:12px;color:var(--gray700,#979797);white-space:nowrap}
    .rk-big{box-shadow:none}
    .rk-graf{height:184px;overflow:hidden;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.05);transition:background .8s}
    .rk-motes{position:absolute;inset:0;pointer-events:none;overflow:hidden}
    .rk-mote{position:absolute;bottom:-4px;border-radius:2px;opacity:0;animation-name:rk-drift;animation-timing-function:linear;animation-iteration-count:infinite}
    @keyframes rk-drift{0%{transform:translate(0,0);opacity:0}20%{opacity:.9}100%{transform:translate(18px,-110px);opacity:0}}
    @media (prefers-reduced-motion: reduce){.rk-mote{animation:none;display:none}}
    .rk-g{position:absolute;left:0;right:0;bottom:0;height:84px}
    .rk-g svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
    .rk-cur{position:absolute;top:0;bottom:0;pointer-events:none}
    .rk-dot{position:absolute;left:-6px;width:10px;height:10px;border-radius:5px;background:var(--white,#fafafa)}
    .rk-scrub{position:absolute;inset:0;touch-action:none;cursor:crosshair}
    .rk-glyph{position:absolute;right:74px;top:22px;display:inline-flex;pointer-events:none}
    .rk-gear{position:absolute;right:16px;top:16px;width:44px;height:44px;border-radius:22px;background:rgba(255,255,255,0.1);display:grid;place-items:center;color:var(--white,#fafafa);transition:transform .15s}
    .rk-gear:active{transform:scale(.92)}
    .rk-top{position:absolute;left:18px;top:18px;right:120px;display:flex;align-items:center;gap:8px;min-width:0}
    .rk-gn{font-size:13px;color:var(--gray800,#afafaf);min-width:0}
    .rk-chip{height:26px;padding:0 10px 0 8px;border-radius:13px;display:flex;align-items:center;gap:5px;font-size:11px;font-weight:600;white-space:nowrap;flex:none}
    .rk-vals{position:absolute;left:18px;top:54px;display:flex;flex-direction:column;gap:2px}
    .rk-line{display:flex;align-items:baseline;gap:8px;white-space:nowrap}
    .rk-tb{display:flex;align-items:flex-start;transition:color .25s}
    .rk-gbig{font-size:44px;font-weight:300;letter-spacing:-0.04em;line-height:1}
    .rk-deg{font-size:24px;font-weight:300}
    .rk-hb{display:flex;align-items:baseline;gap:1px;height:26px;padding:0 9px;border-radius:13px;transition:background .25s,color .25s}
    .rk-hv{font-size:17px;font-weight:400}
    .rk-pc{font-size:12px;color:var(--gray700,#979797)}
    .rk-when{font-size:12px;color:var(--gray600,#7f7f7f);white-space:nowrap}
  `;

  // Felles handlinger for romkort (returnerer true når håndtert).
  M.romkortAction = function (card, name, el) {
    const d = el.dataset, hass = card.hass, toastOn = card.config.toasts !== false;
    if (name === 'rk-open') { M.openPopup(d.hash); return true; }
    if (name === 'rk-light') {
      const r = M.romData(card, d.area, card.roomCfg ? card.roomCfg(d.area) : {});
      if (!r || !r.lights.length) { if (r) M.openPopup(r.hash); return true; }
      const on = r.lightsOn > 0;
      M.call(hass, 'light', on ? 'turn_off' : 'turn_on', { entity_id: r.lights });
      if (toastOn) M.toast(`Lys i ${r.name} ${on ? 'av' : 'på'}`);
      return true;
    }
    if (name === 'rk-set') {
      const s = hass && hass.states[d.id];
      if (!s) return true;
      const step = Number(s.attributes.target_temp_step) || 0.5, cur = Number(s.attributes.temperature);
      if (isNaN(cur)) return true;
      const mn = Number(s.attributes.min_temp), mx = Number(s.attributes.max_temp);
      let t = Math.round((cur + Number(d.d) * step) * 10) / 10;
      if (!isNaN(mn)) t = Math.max(mn, t);
      if (!isNaN(mx)) t = Math.min(mx, t);
      M.haptic('selection');
      M.call(hass, 'climate', 'set_temperature', { entity_id: d.id, temperature: t });
      return true;
    }
    return false;
  };

  /* ------------------------------------------------------------ kort */
  const VARIANTS = [['graf', 'Graf (Romkort)'], ['karusell', 'Karusell 220'], ['L', 'Stor'], ['M', 'Medium'], ['S', 'Liten']];
  class Romkort extends M.Card {
    static get cardName() { return 'Romkort'; }
    static get defaults() { return { variant: 'graf', motes: true, graph_t: 'var(--orange, #f2b573)', graph_h: 'var(--blue, #73b9f2)' }; }
    static getStubConfig(hass) { const a = hass ? M.areas(hass)[0] : null; return { card_id: M.uid(), ...this.defaults, ...(a ? { area: a.id } : {}) }; }
    static get schema() {
      return (hass, c) => {
        const card = { hass, s: (id) => (id && hass && hass.states[id]) || null, n: (id) => M.num(hass, id), config: c };
        const r = c.area && hass ? M.romData(card, c.area, {}) : null;
        const au = (h, cc) => (cc.area && h ? autoOf(h, cc.area) : {});
        return [
          { type: 'section', id: 'rom', label: 'Rom', icon: 'mdi:texture-box', open: true, fields: [
            { type: 'area', name: 'area', label: 'Rom (område)', help: 'Trykk på kortet åpner Rom-popupen #<område>' },
            { type: 'select', name: 'variant', label: 'Variant', options: VARIANTS, default: 'graf' },
            { type: 'text', name: 'name', label: 'Navn', auto: (h, cc) => (cc.area ? M.areaName(h, cc.area) : '') },
            { type: 'hash', name: 'hash', label: 'Popup (hash)', auto: (h, cc) => (cc.area ? '#' + cc.area : '#<område>') },
            { type: 'boolean', name: 'klima', label: 'Klima-knapp (+/−) på kortet', help: 'Karusell/stor/medium, krever termostat', default: true },
          ] },
          { type: 'section', id: 'look', label: 'Ikon og farge', icon: 'mdi:palette', fields: [
            { type: 'icon', name: 'icon', label: 'Ikon', auto: () => (r ? r.icon : '') },
            { type: 'color', name: 'color', label: 'Romfarge (ikon når lys er på)', auto: () => (c.area ? M.romColor(c.area, hass) : '') },
          ] },
          { type: 'overrides', label: 'Bytt sensor/termostat', fields: [
            { name: 'temperature', label: 'Temperatur', domain: 'sensor', device_class: 'temperature', auto: (h, cc) => (cc.overrides || {}).temperatur || au(h, cc).temp },
            { name: 'humidity', label: 'Luftfuktighet', domain: 'sensor', device_class: 'humidity', auto: (h, cc) => (cc.overrides || {}).fuktighet || au(h, cc).hum },
            { name: 'climate', label: 'Termostat', domain: 'climate', auto: (h, cc) => (cc.overrides || {}).termostat || au(h, cc).thermo },
          ] },
          { type: 'section', id: 'badges', label: 'Varsler på rommet', icon: 'mdi:alert-circle-outline', fields: M.romBadgeFields(hass, c, 'badges_own', 'badges', r) },
          { type: 'section', id: 'graf', label: 'Graf (variant graf)', icon: 'mdi:chart-line', fields: [
            { type: 'color', name: 'graph_t', label: 'Linje · temperatur' },
            { type: 'color', name: 'graph_h', label: 'Linje · fukt' },
            { type: 'color', name: 'background', label: 'Bakgrunn', help: 'Standard var(--gray100)' },
            { type: 'boolean', name: 'motes', label: 'Svevende partikler (animasjon)', default: true },
          ] },
          { type: 'boolean', name: 'toasts', label: 'Bekreftelsesmeldinger', default: true },
        ];
      };
    }
    get cardSize() { return { graf: 4, karusell: 5, L: 5, M: 3, S: 1 }[this.config.variant] || 4; }
    roomCfg() { const c = this.config; return { overrides: c.overrides, look: { icon: c.icon, color: c.color, name: c.name }, hash: c.hash }; }
    onOpen() { if ((this.config.variant || 'graf') === 'graf') this._loadHist(); }
    async _loadHist() {
      const r = M.romData(this, this.config.area, this.roomCfg());
      if (!r || (!r.tempId && !r.humId)) return;
      const h = await M.history(this.hass, [r.tempId, r.humId].filter(Boolean), 24);
      this._hist = { t: r.tempId ? M.sample(h[r.tempId], 25) : [], h: r.humId ? M.sample(h[r.humId], 25) : [] };
      this.update();
    }
    render() {
      const c = this.config;
      const r = M.romData(this, c.area, this.roomCfg());
      if (!r) return M.emptyState(c.area ? `Fant ikke rommet «${c.area}»` : 'Velg et rom for kortet', 'rom');
      const alert = M.romAlert(this, r, c.badges_own, c.badges);
      return M.romkortHTML(r, { variant: c.variant || 'graf', klima: c.klima !== false, alert, graph: this._hist, ui: this.ui, cfg: c, motes: c.motes !== false });
    }
    onAction(name, el, ev) {
      if (name === 'rk-gt') { ev.stopPropagation(); return this.setUI({ gTab: el.dataset.t, gSel: null }); }
      if (M.romkortAction(this, name, el)) return;
      return super.onAction(name, el, ev);
    }
    afterRender() {
      const sc = this.shadowRoot.querySelector('.rk-scrub');
      if (!sc || sc.__b) return;
      sc.__b = true;
      M.guardDrag(sc, 'none');
      let down = null;
      const pos = (e) => { const r = sc.getBoundingClientRect(), n = Number(sc.dataset.n) || 24; return M.clamp(Math.round(((e.clientX - r.left) / r.width) * n), 0, n); };
      const put = (p) => { if (p !== this.ui.gSel) { if (down) M.haptic('selection'); this.setUI({ gSel: p }); } };
      sc.addEventListener('pointerdown', (e) => { down = { x: e.clientX, moved: false }; try { sc.setPointerCapture(e.pointerId); } catch (x) { /* */ } });
      sc.addEventListener('pointermove', (e) => {
        if (down) { if (Math.abs(e.clientX - down.x) > 5) down.moved = true; if (down.moved) put(pos(e)); } else if (e.pointerType === 'mouse') put(pos(e));
      });
      const end = (e) => { if (down && down.moved) { this._swallow = true; setTimeout(() => { this._swallow = false; }, 400); } down = null; if (!e || e.type !== 'pointerup' || e.pointerType !== 'mouse') this.setUI({ gSel: null }); };
      sc.addEventListener('pointerup', end);
      sc.addEventListener('pointercancel', end);
      sc.addEventListener('pointerleave', () => { down = null; this.setUI({ gSel: null }); });
    }
    get styles() { return M.romkortCSS; }
  }
  M.define('msh-romkort-card', Romkort, 'MSH Romkort', 'Romkort for Hjem: temperatur, fukt, lys, termostat og varsler. Trykk åpner Rom-popupen.');
})();
