/* Basseng-kortet msh-basseng-card. Kilde: Basseng v4 popup, variant a (fiks 26.14/28.14/30.1). Basseng v3 er utgått
 * (bare den gamle localStorage-nøkkelen basseng-v3-cfg leses én gang for migrering).
 * ÉTT kort i popupen: msh-basseng-card tegner toppkort (msh-basseng-hero-card, innebygd via MSH.HEROES) → prosalinje
 * «Vannet er …» → glass-faner (Oversikt · Varme · Klor · Spreder) → innholdet i fanen (Oversikt: hurtigknapper Lys ·
 * Pumpe · Varme · Stille (lyd av) · Stikkontakt, nøkkeltall, I dag, temperaturgraf med maks/min, moduser, brytere).
 * Autokonfig (M.poolAuto): 1) område «Basseng»/«Pool»/«Badebasseng», 2) navn/id med basseng|baseng|pool, 3) domene +
 * device_class. Overstyring: overrides.<rolle> (bytt), exclude: [rolle|entitet], include: [{ entity, navn, ikon }] /
 * include.hurtig (ekstra hurtigknapper), include.flagg / include.personer. Gammel config (`hurtig:`, ki-basseng-nøkler,
 * basseng-v3-cfg i localStorage) migreres én gang til config (M.poolNorm). Bunnluft: MSH.popupBottomPad (ingen gap-card).
 * Bassengpopupene (#badebasseng/#basseng) er slettet: strategien lager dem ikke lenger – kortet legges manuelt i en egen
 * Bubble-popup (README → Manuelt). Se «bassengpopupene er slettet» nederst (engangsmigrering av ki-store).
 */
(function () {
  const M = window.MSH, esc = M.esc, C = M.C;

  /* ------------------------------------------------------------ felles hjelpere (kan brukes av andre kort) */
  M.txt = M.txt || function (hass, id) {
    const s = hass && hass.states[id];
    return (id + ' ' + ((s && s.attributes.friendly_name) || '')).toLowerCase();
  };
  M.cap = M.cap || ((t) => (t ? String(t).charAt(0).toUpperCase() + String(t).slice(1) : t));
  // Tilstands-historikk (strenger, ikke tall) – kun når popupen åpnes. Cache 5 min.
  const SH = new Map();
  M.stateHistory = M.stateHistory || async function (hass, ids, startMs, endMs) {
    ids = (ids || []).filter((id) => id && hass && hass.states[id]);
    if (!ids.length || !hass.callWS) return {};
    endMs = endMs || Date.now();
    const key = ids.join(',') + '|' + Math.round(startMs / 300000) + '|' + Math.round(endMs / 300000);
    const c = SH.get(key);
    if (c && Date.now() - c.t < 300000) return c.d;
    let d = {};
    try {
      const r = await hass.callWS({ type: 'history/history_during_period', start_time: new Date(startMs).toISOString(), end_time: new Date(endMs).toISOString(), entity_ids: ids, minimal_response: true, no_attributes: true, significant_changes_only: false });
      ids.forEach((id) => {
        d[id] = ((r && r[id]) || []).map((p) => ({ t: p.lu != null ? p.lu * 1000 : p.lc != null ? p.lc * 1000 : new Date(p.last_changed || p.last_updated).getTime(), s: p.s != null ? p.s : p.state })).filter((p) => !isNaN(p.t));
      });
    } catch (e) { d = {}; }
    SH.set(key, { t: Date.now(), d });
    return d;
  };
  // Sekunder «på» i [from,to] ut fra tilstandsserie.
  M.onSeconds = M.onSeconds || function (pts, isOn, from, to, liveOn) {
    if (!pts || !pts.length) return 0;
    let tot = 0;
    for (let i = 0; i < pts.length; i++) {
      if (!isOn(pts[i].s)) continue;
      const a = Math.max(from, pts[i].t), b = Math.min(to, i + 1 < pts.length ? pts[i + 1].t : (liveOn === false ? pts[i].t : to));
      if (b > a) tot += b - a;
    }
    return tot / 1000;
  };
  // Kalenderhendelser (REST via hass.callApi). Returnerer [] ved feil.
  M.calEvents = M.calEvents || async function (hass, id, startMs, endMs) {
    if (!hass || !id || !hass.callApi) return [];
    try {
      const r = await hass.callApi('GET', `calendars/${id}?start=${encodeURIComponent(new Date(startMs).toISOString())}&end=${encodeURIComponent(new Date(endMs).toISOString())}`);
      return (r || []).map((e) => ({ ...e, t0: new Date((e.start && (e.start.dateTime || e.start.date)) || e.start).getTime(), t1: new Date((e.end && (e.end.dateTime || e.end.date)) || e.end).getTime() })).filter((e) => !isNaN(e.t0)).sort((a, b) => a.t0 - b.t0);
    } catch (e) { return []; }
  };
  // Myk SVG-sti (catmull-rom → bezier) gjennom punkter [[x,y]…].
  M.smoothPath = M.smoothPath || function (P) {
    if (!P.length) return '';
    let d = `M${P[0][0].toFixed(1)},${P[0][1].toFixed(1)}`;
    for (let i = 0; i < P.length - 1; i++) {
      const p0 = P[i - 1] || P[i], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] || p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    return d;
  };
  M.hm = M.hm || ((t) => { const d = new Date(t); return M.pad(d.getHours()) + ':' + M.pad(d.getMinutes()); });
  M.parseNum = M.parseNum || ((v, d) => { const n = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isNaN(n) ? d : n; });
  M.parseHM = M.parseHM || ((v, d) => { const m = /(\d{1,2})[:.](\d{2})/.exec(String(v || '')); return m ? Number(m[1]) + Number(m[2]) / 60 : d; });
  // Vannrett scroll-rad inni popup: native scroll, men ikke la Bubble tolke sveipet.
  M.guardScroll = M.guardScroll || function (el) {
    if (!el || el.__mshScroll) return;
    el.__mshScroll = true;
    el.style.touchAction = 'pan-x';
    const stop = (e) => e.stopPropagation();
    el.addEventListener('touchstart', stop, { passive: true });
    el.addEventListener('touchmove', stop, { passive: true });
    el.addEventListener('pointerdown', stop);
  };
  // Sett en måltemperatur/verdi på climate/water_heater/number/input_number.
  M.setValue = M.setValue || function (hass, id, v) {
    const d = id.split('.')[0];
    if (d === 'climate') return M.call(hass, 'climate', 'set_temperature', { entity_id: id, temperature: v });
    if (d === 'water_heater') return M.call(hass, 'water_heater', 'set_temperature', { entity_id: id, temperature: v });
    if (d === 'number' || d === 'input_number') return M.call(hass, d, 'set_value', { entity_id: id, value: v });
    return Promise.resolve();
  };
  M.onState = M.onState || function (s) {
    if (!s) return false;
    const d = s.entity_id.split('.')[0];
    if (d === 'climate') return s.state !== 'off' && (s.attributes.hvac_action ? ['heating', 'preheating', 'defrosting'].includes(s.attributes.hvac_action) : s.state !== 'off');
    if (d === 'cover') return ['closed', 'closing'].includes(s.state); // tak lukket = «på»
    if (d === 'water_heater') return s.state !== 'off';
    return M.isOn(s);
  };

  /* ------------------------------------------------------------ autokonfig (fiks 26.14 · rollene i ENTS) */
  // Hver rolle søkes i rekkefølge: 1) entiteter i området «Basseng»/«Pool»/«Badebasseng», 2) entiteter der navn eller id
  // inneholder basseng|baseng|pool (typoen «baseng» tas med), 3) domene + device_class innenfor de to settene.
  const DOMS = ['sensor', 'switch', 'input_boolean', 'fan', 'climate', 'water_heater', 'cover', 'binary_sensor', 'light', 'valve', 'select', 'input_select', 'number', 'input_number', 'input_datetime', 'counter'];
  const POOL_RX = /basseng|baseng|pool|svommebasseng|svømmebasseng/;
  M.poolArea = (hass, cfg) => (cfg && cfg.area) || M.findArea(hass, 'basseng', 'pool', 'badebasseng', 'svommebasseng');
  // Rolle ut fra én entitet (brukes av migreringen av gamle `hurtig:`)
  const QUIET_RX = /stille|silent|quiet|lyd_av|mute/, PUMP_RX = /pump|filter|sirkul/, HEAT_RX = /varme|heat/, SOCK_RX = /stikkontakt|outlet|socket|(^|[_ .])plug/;
  M.poolRoleOf = function (hass, id) {
    const d = String(id || '').split('.')[0], s = hass && hass.states[id], t = M.txt(hass, id), dc = s && s.attributes.device_class;
    if (d === 'light') return 'light';
    if (d === 'climate' || d === 'water_heater') return 'heat';
    if (d === 'cover') return 'cover';
    if (d === 'valve' || /spreder|sprinkler/.test(t)) return ['switch', 'valve', 'input_boolean'].includes(d) ? 'spr' : null;
    if (!['switch', 'input_boolean', 'fan'].includes(d)) return null;
    if (QUIET_RX.test(t)) return 'quiet';
    if (dc === 'outlet' || SOCK_RX.test(t)) return 'sock';
    if (PUMP_RX.test(t) && !HEAT_RX.test(t)) return 'pump';
    if (/lys|light/.test(t)) return 'light';
    if (HEAT_RX.test(t)) return 'heat';
    return null;
  };
  M.poolAuto = function (hass, cfg) {
    const area = M.poolArea(hass, cfg), o = { area };
    if (!hass) return o;
    const T = (id) => M.txt(hass, id), dc = (id) => hass.states[id].attributes.device_class;
    const A1 = area ? M.all(hass, DOMS, (s, id) => M.areaOf(hass, id) === area) : [];
    // 2) navn/id – bare når området ikke er valgt eksplisitt (et valgt område er fasit)
    const A2 = cfg && cfg.area ? [] : M.all(hass, DOMS, (s, id) => !A1.includes(id) && POOL_RX.test(T(id)));
    const ids = A1.concat(A2);
    const used = new Set();
    // første treff i område-settet, deretter i navne-settet
    const f = (doms, re, not, pred) => {
      for (const L of [A1, A2]) {
        const id = L.find((x) => doms.includes(x.split('.')[0]) && !used.has(x) && (!re || re.test(T(x))) && (!not || !not.test(T(x))) && (!pred || pred(x)));
        if (id) return id;
      }
      return null;
    };
    const take = (id) => { if (id) used.add(id); return id || null; };
    const sens = ids.filter((id) => id.startsWith('sensor.'));
    const temps = sens.filter((id) => dc(id) === 'temperature');
    const OUT = /(^|[_ .])ute|outdoor|outside|luft|(^|[_ .])air/;
    o.water = temps.find((id) => !OUT.test(T(id)) && /vann|water|basseng|baseng|pool/.test(T(id))) || temps.find((id) => !OUT.test(T(id))) || null;
    // Utetemperatur: bassengets egen ute-sensor, ellers samme som Hjem (ute-temperatursensor / weather.*)
    o.ute = temps.find((id) => OUT.test(T(id))) || M.all(hass, 'sensor', (s, id) => s.attributes.device_class === 'temperature' && /(^|[_ .])ute|outdoor|outside/.test(T(id)))[0] || M.all(hass, 'weather')[0] || null;
    // Stille-/lyd av-bryteren først, så den ikke tas som pumpe eller varme
    o.quiet = take(f(['switch', 'input_boolean'], QUIET_RX));
    o.heat = take(f(['climate']) || f(['water_heater']) || f(['switch', 'input_boolean'], HEAT_RX, /prio|natt|night|senk|vinter|winter/));
    o.pump = take(f(['switch', 'input_boolean', 'fan'], PUMP_RX, HEAT_RX));
    o.light = take(f(['light']) || f(['switch'], /lys|light|(^|[_ .])led/));
    o.spr = take(f(['switch', 'valve', 'input_boolean'], /spreder|sprinkler|fontene|fountain|dusj/));
    o.sock = take(f(['switch'], null, null, (id) => dc(id) === 'outlet') || f(['switch'], SOCK_RX));
    o.cover = take(f(['cover']) || f(['switch', 'input_boolean', 'binary_sensor'], /(^|[_ .])tak|pooltak|cover|lokk|presenning/, SOCK_RX));
    // Effekt: device_class power på pumpe-/varmeenheten, ellers navnet
    const devOf = (id) => { const e = id && M.regEntry(hass, id); return (e && e.device_id) || null; };
    const pw = sens.filter((id) => dc(id) === 'power');
    const onDev = (dev) => (dev ? pw.find((id) => devOf(id) === dev) : null);
    o.power = onDev(devOf(o.pump)) || pw.find((id) => PUMP_RX.test(T(id)) && !HEAT_RX.test(T(id))) || pw.find((id) => !HEAT_RX.test(T(id))) || null;
    o.heat_power = (onDev(devOf(o.heat)) !== o.power && onDev(devOf(o.heat))) || pw.find((id) => HEAT_RX.test(T(id)) && id !== o.power) || null;
    o.ph = sens.find((id) => dc(id) === 'ph' || /(^|[_ .])ph($|[_ .])/.test(T(id))) || null;
    o.klor = sens.find((id) => /klor|chlor|orp|redox/.test(T(id))) || null;
    o.savings = sens.find((id) => /spart|saving/.test(T(id))) || null;
    o.cost = sens.find((id) => (dc(id) === 'monetary' || /kost|cost|kroner/.test(T(id))) && !/spart|saving/.test(T(id))) || null;
    o.turnover = sens.find((id) => /omsetning|turnover/.test(T(id))) || null;
    o.pumped = sens.find((id) => /pumpet|runtime|driftstid|kjoretid|kjøretid|run_time/.test(T(id))) || null;
    o.mode = f(['select', 'input_select'], /modus|mode|profil|drift/) || f(['select', 'input_select']);
    o.auto = f(['switch', 'input_boolean'], /automat|auto/);
    o.price = f(['switch', 'input_boolean'], /pris|price|billig|nordpool/);
    o.prio = f(['switch', 'input_boolean'], /prio/);
    o.night = f(['switch', 'input_boolean'], /natt|night|senk/);
    o.winter = f(['switch', 'input_boolean'], /vinter|winter/);
    o.heat_loss = sens.find((id) => /varmetap|heat_loss|heatloss/.test(T(id))) || null;
    o.solar = sens.find((id) => dc(id) === 'irradiance' || /(^|[_ .])sol|solar/.test(T(id))) || null;
    o.target = (o.heat && /^(climate|water_heater)\./.test(o.heat)) ? o.heat : f(['number', 'input_number'], /mal|mål|target|settpunkt|setpunkt|setpoint/);
    o.spr_duration = f(['number', 'input_number'], /varighet|duration/);
    // Klorkalender: calendar.* med klor i navnet, ellers input_datetime/counter for siste klortablett
    o.klor_calendar = M.all(hass, 'calendar', (s, id) => /klor|chlor/.test(M.txt(hass, id)))[0] || M.all(hass, 'calendar', (s, id) => POOL_RX.test(M.txt(hass, id)))[0] || null;
    o.klor_last = o.klor_calendar ? null : (M.all(hass, ['input_datetime', 'counter'], (s, id) => /klor|chlor/.test(M.txt(hass, id)))[0] || null);
    o.flags = [o.auto, o.price, o.prio].filter(Boolean);
    o.people = M.all(hass, 'person');
    return o;
  };
  // Rollenavn fra designet (ENTS/CTL) → nøklene her
  const ROLE_ALIAS = { out: 'ute', cal: 'klor_calendar', mute: 'quiet', stille: 'quiet', stikkontakt: 'sock', lys: 'light', pumpe: 'pump', varme: 'heat' };
  const roleKey = (k) => ROLE_ALIAS[k] || k;
  // Ekstra hurtigknapper: include: [{ entity, navn, ikon }] (YAML) eller include.hurtig: [id] (editoren) + labels.<id>
  M.poolExtras = function (cfg) {
    const c = cfg || {}, L = c.labels || {}, out = [], seen = new Set();
    const add = (x) => {
      const it = typeof x === 'string' ? { entity: x } : x;
      const id = it && (it.entity || it.entity_id);
      if (!id || seen.has(id) || (c.exclude || []).includes(id)) return;
      seen.add(id);
      out.push({ entity: id, navn: it.navn || it.name || (L[id] && L[id].navn) || null, ikon: it.ikon || it.icon || (L[id] && L[id].ikon) || null });
    };
    if (Array.isArray(c.include)) c.include.forEach(add);
    else if (c.include && Array.isArray(c.include.hurtig)) c.include.hurtig.forEach(add);
    return out;
  };
  // Endelig oppsett: overrides vinner, exclude (rolle eller entitet) fjerner auto-valg.
  M.poolEnts = function (hass, cfg) {
    cfg = cfg || {};
    const a = M.poolAuto(hass, cfg), e = { area: a.area, auto: a };
    const ov = {};
    Object.keys(cfg.overrides || {}).forEach((k) => { if (cfg.overrides[k]) ov[roleKey(k)] = cfg.overrides[k]; });
    const ex = new Set((Array.isArray(cfg.exclude) ? cfg.exclude : []).map(roleKey));
    Object.keys(a).forEach((k) => { if (k === 'area' || Array.isArray(a[k])) return; e[k] = ex.has(k) ? null : ov[k] || (a[k] && !ex.has(a[k]) ? a[k] : null); });
    e.flags = M.applyLists(Array.isArray(cfg.include) ? { ...cfg, include: {} } : cfg, 'flagg', a.flags || []);
    e.people = M.applyLists(Array.isArray(cfg.include) ? { ...cfg, include: {} } : cfg, 'personer', a.people || []);
    e.extra = M.poolExtras(cfg);
    return e;
  };
  const OVR = [
    ['water', 'Vanntemperatur', 'sensor', 'temperature'], ['ute', 'Utetemperatur', ['sensor', 'weather']], ['pump', 'Pumpe', ['switch', 'input_boolean', 'fan']], ['heat', 'Varme (varmepumpe)', ['climate', 'water_heater', 'switch', 'input_boolean']],
    ['quiet', 'Stille (lyd av)', ['switch', 'input_boolean']], ['sock', 'Stikkontakt', ['switch', 'input_boolean']],
    ['cover', 'Pooltak', ['cover', 'switch', 'input_boolean', 'binary_sensor']], ['light', 'Lys', ['light', 'switch']], ['spr', 'Spreder', ['switch', 'valve', 'input_boolean']], ['power', 'Effekt · pumpe', 'sensor', 'power'],
    ['heat_power', 'Effekt · varmepumpe', 'sensor', 'power'], ['ph', 'pH', 'sensor'], ['klor', 'Klor (mg/L / ORP)', 'sensor'], ['target', 'Måltemperatur', ['climate', 'water_heater', 'number', 'input_number']],
    ['turnover', 'Omsetninger i dag', 'sensor'], ['pumped', 'Pumpet i dag (timer)', 'sensor'], ['savings', 'Spart i dag', 'sensor'], ['cost', 'Strømkostnad i dag', 'sensor'],
    ['mode', 'Driftsmodus', ['select', 'input_select']], ['night', 'Nattsenking', ['switch', 'input_boolean']], ['winter', 'Vintermodus', ['switch', 'input_boolean']], ['heat_loss', 'Varmetap', 'sensor'],
    ['solar', 'Sol inn', 'sensor'], ['spr_duration', 'Spreder · varighet', ['number', 'input_number']], ['klor_calendar', 'Klorkalender (logg)', 'calendar'], ['klor_last', 'Siste klortablett (uten kalender)', ['input_datetime', 'counter']],
  ];
  const ovrFields = (keys) => OVR.filter((x) => !keys || keys.includes(x[0])).map(([name, label, domain, device_class]) => ({ name, label, domains: [].concat(domain), device_class, auto: (h, c) => M.poolAuto(h, c)[name] }));
  const AREA_F = { type: 'area', name: 'area', label: 'Område', help: 'Tomt = område «Basseng»/«pool»', auto: (h, c) => M.poolArea(h, {}) };

  /* ============================================================ HERO */
  class BassengHero extends M.Card {
    static get cardName() { return 'Basseng · hero'; }
    static get defaults() { return { anim: true, chips: true }; }
    static get schema() {
      return [
        AREA_F,
        { type: 'text', name: 'name', label: 'Navn', placeholder: 'Bassenget' },
        { type: 'overrides', label: 'Bytt entiteter', fields: ovrFields(['water', 'pump', 'heat', 'cover', 'light', 'turnover', 'target']) },
        { type: 'section', label: 'Animasjon', icon: 'mdi:animation', open: true, fields: [
          { type: 'boolean', name: 'anim', label: 'Animasjoner (bølger, bobler, vifte og varme)', default: true },
          { type: 'boolean', name: 'chips', label: 'Statusikoner (pumpe, varme, tak og lys i bildet)', default: true },
          { type: 'text', name: 'vals.turnovers', label: 'Omsetninger per døgn (mål)', placeholder: '3,75' },
        ] },
      ];
    }
    get cardSize() { return 4; }
    render() {
      const c = M.poolNorm(this.config, this.hass), e = M.poolEnts(this.hass, c), A = c.anim !== false;
      const on = (k) => M.onState(this.s(e[k]));
      const pump = on('pump'), heat = on('heat'), cover = on('cover'), light = on('light');
      const P = pump && A, H = heat && A;
      const tw = this.n(e.water);
      const tgtS = this.s(e.target);
      const tgt = tgtS ? (/^(climate|water_heater)\./.test(e.target) ? tgtS.attributes.temperature : M.isNum(tgtS.state) ? Number(tgtS.state) : null) : null;
      const turn = this.n(e.turnover), turnT = M.parseNum(c.vals && c.vals.turnovers, 3.75);
      const sub = [turn != null ? `${M.nf(turn, 2)} av ${M.nf(turnT, 2)} omsetninger` : null, tgt != null ? `mål ${M.nf(tgt, Number(tgt) % 1 ? 1 : 0)}°` : null].filter(Boolean).join(' · ') || (e.water ? '' : 'Velg vanntemperatur i tilpass');
      const pumpS = this.s(e.pump);
      const status = !pumpS ? ['help', 'Ingen pumpe'] : pump ? ['autorenew', 'Filtrerer'] : ['pause', 'Står'];
      const chips = [['pump', 'water_pump', 'Pumpe', C.pink], ['heat', 'heat_pump', 'Varmepumpe', C.red], ['cover', 'roofing', 'Pooltak', C.blue], ['light', 'lightbulb', 'Lys', C.yellow]]
        .filter(([k]) => e[k]).map(([k, ic, l, col]) => { const o = on(k); return `<span class="chip" data-key="${k}" title="${esc(l + ': ' + (o ? 'på' : 'av'))}" style="background:${o ? col : 'rgba(0,0,0,0.3)'};color:${o ? '#282828' : '#7f8c90'}">${M.icon(ic, 14)}</span>`; }).join('');
      const bubbles = [18, 40, 62, 84, 106].map((x, i) => `<span class="bub" style="left:${x}px;width:${4 + (i % 2) * 2}px;height:${4 + (i % 2) * 2}px;animation:${P ? `bub ${1.6 + (i % 3) * 0.4}s ease-in ${i * 0.35}s infinite` : 'none'}"></span>`).join('');
      const waves = [0, 1, 2].map((i) => `<span class="hw" style="right:${16 + i * 9}px;animation:${H ? `heatw 1.8s ease-out ${i * 0.5}s infinite` : 'none'}"></span>`).join('');
      return `
        <section class="hero press0" data-ent="${esc(e.water || e.pump || '')}">
          <div class="scene">
            <div class="pool">
              <span class="glow" style="opacity:${light ? 1 : 0};animation:${light && A ? 'glowp 3s ease-in-out infinite' : 'none'}"></span>
              <span class="wave" style="animation:${A ? `wave ${pump ? 2.5 : 12}s linear infinite` : 'none'}"></span>
              ${bubbles}
              <span class="cov" style="width:${cover ? '100%' : '0%'}"></span>
            </div>
            <svg class="pipe" viewBox="0 0 60 40"><path d="M52 34 C52 10, 30 6, 4 14" fill="none" stroke-width="3" stroke-linecap="round" stroke-dasharray="6 6" style="stroke:${heat ? C.red : '#5d6b70'};animation:${P ? 'flow .8s linear infinite' : 'none'};transition:stroke .4s"></path></svg>
            <div class="hp" style="box-shadow:${heat ? `0 0 16px ${M.alpha(C.red, 0.45)}` : 'none'}">${M.icon('mode_fan', 20, `color:${heat ? 'rgb(242 160 150)' : '#c9d6d9'};animation:${H ? 'spin 1.1s linear infinite' : 'none'}`)}</div>
            ${waves}
            <div class="pm"><span class="ring" style="animation:${P ? 'ring 1.6s ease-out infinite' : 'none'}"></span>${M.icon('autorenew', 16, `color:${pump ? C.pink : '#8a979b'};animation:${P ? 'spin 2.4s linear infinite' : 'none'}`)}</div>
          </div>
          <div class="tl">
            <span class="lbl">${esc(c.name || c.navn || 'Bassenget')}</span>
            <span class="st">${M.icon(status[0], 13)}${esc(status[1])}</span>
            ${c.chips !== false && chips ? `<div class="chips">${chips}</div>` : ''}
          </div>
          <div class="bl">
            <span class="t num">${tw != null ? M.nf(tw, 1) : '–'}<span class="u">°C</span></span>
            ${sub ? `<span class="sub">${esc(sub)}</span>` : ''}
          </div>
        </section>`;
    }
    get styles() {
      return `
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes wave{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        @keyframes bub{0%{transform:translateY(0);opacity:0}20%{opacity:.85}100%{transform:translateY(-44px);opacity:0}}
        @keyframes heatw{0%{transform:translateY(0) scaleX(1);opacity:0}30%{opacity:.75}100%{transform:translateY(-28px) scaleX(1.4);opacity:0}}
        @keyframes glowp{0%,100%{opacity:.6}50%{opacity:1}}
        @keyframes flow{to{stroke-dashoffset:-24}}
        @keyframes ring{from{transform:scale(.7);opacity:.8}to{transform:scale(1.6);opacity:0}}
        .hero{position:relative;height:176px;border-radius:30px;overflow:hidden;background:linear-gradient(160deg,#1b2b30,#22383e 60%,#1e3237);width:100%}
        .scene{position:absolute;inset:0;pointer-events:none}
        .pool{position:absolute;right:56px;bottom:22px;width:150px;height:58px;border-radius:8px;overflow:hidden;background:linear-gradient(180deg,#48a3ba,#2b6f84);box-shadow:inset 0 3px 0 rgba(255,255,255,0.22),0 0 0 3px #4d5b60}
        .glow{position:absolute;inset:-20px;background:radial-gradient(60% 70% at 50% 60%,rgb(140 240 255 / 0.9),transparent 70%);transition:opacity .6s}
        .wave{position:absolute;left:0;top:0;height:10px;width:200%;background:repeating-radial-gradient(circle at 10px -4px,rgba(255,255,255,0.35) 0 6px,transparent 7px 20px);background-size:20px 10px}
        .bub{position:absolute;bottom:4px;border-radius:50%;background:rgba(255,255,255,0.7);opacity:0}
        .cov{position:absolute;left:0;top:0;bottom:0;background:repeating-linear-gradient(90deg,#8e9ba0 0 9px,#76858a 9px 11px);box-shadow:2px 0 6px rgba(0,0,0,0.4);transition:width .9s cubic-bezier(.4,0,.2,1)}
        .pipe{position:absolute;right:20px;bottom:30px;width:60px;height:40px;overflow:visible}
        .hp{position:absolute;right:12px;bottom:22px;width:34px;height:58px;border-radius:6px;background:#39464a;display:grid;place-items:center;transition:box-shadow .4s}
        .hw{position:absolute;bottom:84px;width:4px;height:12px;border-radius:2px;background:${M.alpha(C.red, 0.7)};opacity:0}
        .pm{position:absolute;right:214px;bottom:26px;width:26px;height:26px;border-radius:13px;background:#39464a;display:grid;place-items:center}
        .ring{position:absolute;inset:-2px;border-radius:50%;border:2px solid ${M.alpha(C.pink, 0.7)};opacity:0}
        .tl{position:absolute;left:16px;top:16px;display:flex;flex-direction:column;gap:8px}
        .lbl{font-size:12px;color:#c9d6d9}
        .st{height:22px;padding:0 9px 0 7px;border-radius:11px;background:rgba(0,0,0,0.3);display:flex;align-items:center;gap:5px;font-size:11px;font-weight:600;align-self:flex-start;white-space:nowrap}
        .chips{display:flex;gap:4px}
        .chip{width:26px;height:26px;border-radius:13px;display:grid;place-items:center;transition:background .3s}
        .bl{position:absolute;left:16px;bottom:14px;display:flex;flex-direction:column;gap:3px}
        .t{font-size:30px;font-weight:300;letter-spacing:-0.03em;line-height:1}
        .u{font-size:13px}
        .sub{font-size:11px;color:#c9d6d9}
      `;
    }
  }
  M.define('msh-basseng-hero-card', BassengHero, 'MSH Basseng · hero', 'Toppkortet i msh-basseng-card (innebygd via MSH.HEROES, fiks 26.14): vanntemperatur, status og animert pumpe/varmepumpe/tak/lys. Legges ikke som eget kort i popupen.');

  /* ============================================================ HOVEDKORT */
  // Hurtigknapper (v4: q.light/pump/heat/quiet/sock) – vises bare for roller som ble funnet. Pooltak/Spreder kan slås på i Tilpass.
  const CTL = { light: ['lightbulb', 'Lys', C.gray1000], pump: ['water_pump', 'Pumpe', C.accent], heat: ['heat', 'Varme', C.red], quiet: ['volume_off', 'Stille', C.gray1000, 'Lyd av'], sock: ['mdi:power-socket-eu', 'Stikkontakt', C.yellow], cover: ['roofing', 'Pooltak', C.blue], spr: ['sprinkler', 'Spreder', C.green] };
  const CTL_STD = ['light', 'pump', 'heat', 'quiet', 'sock', 'cover', 'spr'], CTL_HID = ['cover', 'spr'];
  const TABS = { ov: 'Oversikt', heat: 'Varme', klor: 'Klor', spr: 'Spreder' };
  // Designets «Styring og verdier» → config.vals.<nøkkel> (placeholder = standard).
  const CFG = [
    ['tune', 'Styring', [['profile', 'Driftsprofil', 'Setter mål og puls i ett grep', 'Egen'], ['turnovers', 'Omsetninger per døgn', 'Hvor mye vann som skal gjennom filteret', '3,75'], ['pulse', 'Vedlikeholdspuls', 'Sirkulasjon hver time når målet er nådd', '15 min/t'], ['day_hours', 'Dagtimer i planen', 'Timer om dagen pumpa skal gå', '5 t'], ['price_ctrl', 'Prisstyring', 'Pumper i de billigste timene', true], ['heat_prio', 'Varmeprioritet', 'Pumper når varmepumpa trenger det', true]]],
    ['water_pump', 'Pumpe', [['min_run', 'Minste kjøretid', 'Kortere starter sliter pumpa av', '15 min'], ['base_load', 'Basislast', 'Pumpas effekt når den går', '800 W'], ['override', 'Manuell overstyring varer', 'Så lenge automatikken venter', '60 min']]],
    ['heat', 'Varme', [['ctrl_heat', 'Styr varmepumpa', 'Varme bare når vannet sirkulerer', true], ['ctrl_setpoint', 'Styr settpunkt', 'Holder varmepumpa på ønsket temperatur', true], ['heat_from', 'Varmevindu fra', 'Bassenget skal være klart', '5:00'], ['heat_to', 'Varmevindu til', 'Natta starter', '22:00'], ['away_drop', 'Senking når ingen er hjemme', '', '2,0°'], ['solar', 'Solvarme', 'Pumper når sola varmer (med solfanger)', true], ['targets', 'Hurtigvalg mål (°C)', 'Kommaseparert', '23 24 25 26 27']]],
    ['functions', 'Varmemodell', [['loss_open', 'Varmetap uten tak', '', '15,0 W/m²K'], ['loss_closed', 'Varmetap med tak', '', '5,0 W/m²K'], ['sun_through', 'Sol gjennom taket', '', '60 %']]],
    ['pill', 'Klor', [['klor_every', 'Klortablett hver (dager)', 'Kortere i varmt vann', '7,0 d']]],
    ['sprinkler', 'Spreder', [['spr_every', 'Start hver', 'Mellom 10 og 20', '4 t'], ['spr_max', 'Maks per døgn', 'Spreder stopper når tiden er brukt', '60 min'], ['spr_durs', 'Varigheter (min)', 'Kommaseparert', '5 10 15 20 30'], ['spr_frost', 'Frostvakt', 'Starter ikke når det er under 2 °C ute', true]]],
  ];
  const VDEF = {};
  CFG.forEach(([, , rows]) => rows.forEach(([k, , , v]) => { VDEF[k] = v; }));
  const nums = (v, d) => { const a = String(v == null ? d : v).split(/[\s,;]+/).map((x) => parseFloat(x)).filter((x) => !isNaN(x)); return a.length ? a : d.split(' ').map(Number); };
  const MODE_IC = [[/boost|turbo|maks/, 'mode_fan'], [/spre|sprink|fontene/, 'sprinkler'], [/eco|spar/, 'eco'], [/bal|normal|auto/, 'balance'], [/bade|bad|swim|komfort/, 'star'], [/av|off|stopp/, 'power_settings_new'], [/natt|night/, 'bedtime'], [/vinter|winter/, 'ac_unit']];
  const modeIcon = (o) => { const t = String(o).toLowerCase(); const m = MODE_IC.find(([re]) => re.test(t)); return m ? m[1] : 'tune'; };

  /* ------------------------------------------------------------ migrering (fiks 26.14) */
  // Gammel config (ki-basseng-card/ki-basseng-hero-card, `hurtig:`, designets ctl/ctlHide/ents, basseng-v3-cfg fra
  // localStorage) → ny config. Rolle-entiteter som autokonfig finner selv skrives IKKE inn (overrides bare ved avvik).
  const LEG_ROLE = { varmepumpe: 'heat', pumpe: 'pump', lys: 'light', stillemodus: 'quiet', stikkontakt: 'sock', vanntemp: 'water', ute: 'ute', pooltak: 'cover' };
  const LEG_KEYS = ['navn', 'hurtig', 'hurtig_navn', 'hero', 'forvalg', 'ctl', 'ctlHide', 'tabHide', 'ents'];
  const LBL = {};
  CFG.forEach(([, , rows]) => rows.forEach(([k, l]) => { LBL[l] = k; }));
  const hidList = (v) => (Array.isArray(v) ? v : v && typeof v === 'object' ? Object.keys(v).filter((k) => v[k]) : []);
  M.poolLegacy = (cfg) => !!cfg && (LEG_KEYS.some((k) => k in cfg) || Object.keys(LEG_ROLE).some((k) => typeof cfg[k] === 'string' && cfg[k].includes('.')) || Array.isArray(cfg.include));
  M.POOL_LS = 'basseng-v3-cfg';
  M.poolLS = () => { try { return JSON.parse(localStorage.getItem(M.POOL_LS) || 'null'); } catch (e) { return null; } };
  M.poolNorm = function (cfg, hass, pc) {
    if (!cfg || (!M.poolLegacy(cfg) && !pc)) return cfg;
    const n = { ...cfg }, ov = { ...(cfg.overrides || {}) }, claimed = new Set(Object.keys(ov));
    let auto = null;
    const A = () => auto || (auto = M.poolAuto(hass, { ...cfg, overrides: {} }));
    const role = (k, id) => {
      k = roleKey(k);
      if (!id || typeof id !== 'string' || claimed.has(k)) return false;
      claimed.add(k);
      if (!(hass && A()[k] === id)) ov[k] = id;
      return true;
    };
    const labels = { ...(cfg.labels || {}) }, inc = cfg.include && !Array.isArray(cfg.include) ? { ...cfg.include } : {}, extra = [...(inc.hurtig || [])];
    const addExtra = (it) => {
      const id = it && (it.entity || it.entity_id);
      if (!id || extra.includes(id)) return;
      extra.push(id);
      const nv = it.navn || it.name, ik = it.ikon || it.icon;
      if (nv || ik) labels[id] = { ...(nv ? { navn: nv } : {}), ...(ik ? { ikon: ik } : {}) };
    };
    if ('navn' in cfg) { if (!n.name && cfg.navn) n.name = cfg.navn; delete n.navn; }
    Object.keys(LEG_ROLE).forEach((k) => { if (typeof cfg[k] === 'string' && cfg[k].includes('.')) { role(LEG_ROLE[k], cfg[k]); delete n[k]; } });
    if (Array.isArray(cfg.hurtig)) cfg.hurtig.forEach((x) => {
      const it = typeof x === 'string' ? { entity: x } : x || {}, id = it.entity;
      if (!id) return;
      const r = M.poolRoleOf(hass, id);
      if (!(r && role(r, id))) addExtra(it);
    });
    if (Array.isArray(cfg.include)) cfg.include.forEach((x) => addExtra(typeof x === 'string' ? { entity: x } : x));
    if (cfg.ents && typeof cfg.ents === 'object') Object.keys(cfg.ents).forEach((k) => role(k, cfg.ents[k]));
    if (Array.isArray(cfg.forvalg) && cfg.forvalg.length && !(cfg.vals && cfg.vals.targets)) n.vals = { ...(n.vals || {}), targets: cfg.forvalg.join(' ') };
    if (Array.isArray(cfg.ctl) && !cfg.controls) n.controls = cfg.ctl.map(roleKey).filter((k) => CTL[k]);
    if (cfg.ctlHide && !cfg.hidden_controls) n.hidden_controls = hidList(cfg.ctlHide).map(roleKey);
    if (cfg.tabHide && !cfg.hidden_tabs) n.hidden_tabs = hidList(cfg.tabHide);
    // basseng-v3-cfg (designets localStorage) – bare det config ikke har fra før
    if (pc && typeof pc === 'object') {
      if (pc.ents) Object.keys(pc.ents).forEach((k) => role(k, pc.ents[k]));
      if (Array.isArray(pc.ctl) && !n.controls) n.controls = pc.ctl.map(roleKey).filter((k) => CTL[k]);
      if (pc.ctlHide && !n.hidden_controls && hidList(pc.ctlHide).length) n.hidden_controls = hidList(pc.ctlHide).map(roleKey);
      if (Array.isArray(pc.tabs) && !n.tabs) n.tabs = pc.tabs.filter((k) => TABS[k]);
      if (pc.tabHide && !n.hidden_tabs && hidList(pc.tabHide).length) n.hidden_tabs = hidList(pc.tabHide);
      if (pc.vals && typeof pc.vals === 'object') {
        const v = { ...(n.vals || {}) };
        Object.keys(pc.vals).forEach((l) => { const k = LBL[l] || (VDEF[l] !== undefined ? l : null); if (k && v[k] == null && pc.vals[l] !== '') v[k] = pc.vals[l]; });
        if (Object.keys(v).length) n.vals = v;
      }
      ['anim', 'chips'].forEach((k) => { if (pc[k] === false && n[k] == null) n[k] = false; });
    }
    LEG_KEYS.forEach((k) => { delete n[k]; });
    if (Object.keys(ov).length) n.overrides = ov; else delete n.overrides;
    if (extra.length) n.include = { ...inc, hurtig: extra }; else if (Array.isArray(cfg.include)) delete n.include;
    if (Object.keys(labels).length) n.labels = labels;
    return n;
  };
  // Popup-oppsett fra et importert/gammelt Bubble-popup (med ki-basseng-card, ki-basseng-hero-card og
  // gap-card) → config for ÉTT msh-basseng-card. null = ikke et gammelt basseng-popup.
  const LEG_TAGS = ['ki-basseng-card', 'ki-basseng-hero-card', 'msh-basseng-hero-card'];
  const tagOfC = (c) => String((c && c.type) || '').replace(/^custom:/, '');
  const cardsDeep = (o, out = [], d = 0) => {
    if (!o || typeof o !== 'object' || d > 12) return out;
    if (Array.isArray(o)) { o.forEach((x) => cardsDeep(x, out, d + 1)); return out; }
    if (o.type) out.push(o);
    if (Array.isArray(o.cards)) cardsDeep(o.cards, out, d + 1);
    if (o.card && typeof o.card === 'object') cardsDeep(o.card, out, d + 1);
    return out;
  };
  M.bassengLegacyCard = function (popup) {
    const list = cardsDeep(popup && popup.cards);
    const main = list.find((c) => tagOfC(c) === 'ki-basseng-card'), hero = list.find((c) => ['ki-basseng-hero-card', 'msh-basseng-hero-card'].includes(tagOfC(c)));
    if (!main && !hero) return null;
    const strip = (c) => { if (!c) return {}; const { type, card_id, view_layout, grid_options, layout_options, ...r } = c; return r; };
    const h = strip(hero), m = strip(main), out = { ...h, ...m };
    if (h.navn && !m.navn) out.navn = h.navn; // navn flyttes fra toppkortet
    const own = list.find((c) => tagOfC(c) === 'msh-basseng-card');
    return { ...strip(own), ...out };
  };
  M.bassengLegacyTest = (popup) => cardsDeep(popup && popup.cards).some((c) => LEG_TAGS.includes(tagOfC(c)));

  class Basseng extends M.Card {
    static get cardName() { return 'Basseng'; }
    static get defaults() { return { controls: CTL_STD.slice(), hidden_controls: CTL_HID.slice(), tabs: ['ov', 'heat', 'klor', 'spr'] }; }
    static getStubConfig() { return { card_id: 'pop-basseng' }; }
    // Bunnluft over navbaren (fiks 26.14: minst 120 px + safe area; ingen gap-card): nav-h 68 + 8 + 44
    static get spacingDefaults() { return { ...(M.SPACING || {}), pad_bottom: 44 }; }
    static get schema() {
      return [
        AREA_F,
        { type: 'text', name: 'name', label: 'Navn i toppkortet', placeholder: 'Bassenget' },
        { type: 'overrides', id: 'overrides', label: 'Entiteter', fields: ovrFields() },
        { type: 'lists', id: 'entities', label: 'Hurtigknapper, brytere og navn', lists: (h, c) => { const a = M.poolAuto(h, c); return [{ key: 'hurtig', label: 'Ekstra hurtigknapper', ids: [], domains: ['switch', 'light', 'input_boolean', 'fan', 'script', 'scene', 'cover', 'valve'] }, { key: 'flagg', label: 'Brytere (Oversikt)', ids: a.flags, domains: ['switch', 'input_boolean'] }, { key: 'personer', label: 'Navn i klorloggen', ids: a.people, domains: ['person'] }]; } },
        { type: 'order', name: 'controls', hiddenName: 'hidden_controls', label: 'Hurtigknapper (vises når rollen finnes)', options: Object.keys(CTL).map((k) => [k, CTL[k][3] ? `${CTL[k][1]} (${CTL[k][3]})` : CTL[k][1]]) },
        { type: 'order', name: 'tabs', hiddenName: 'hidden_tabs', label: 'Faner', options: Object.keys(TABS).map((k) => [k, TABS[k]]) },
        { type: 'section', id: 'styr', label: 'Styring og verdier', icon: 'mdi:tune', fields: CFG.flatMap(([, title, rows]) => [{ type: 'info', label: title.toUpperCase() }].concat(rows.map(([k, l, sub, v]) => (typeof v === 'boolean' ? { type: 'boolean', name: 'vals.' + k, label: l, help: sub, default: v } : { type: 'text', name: 'vals.' + k, label: l, help: sub, placeholder: String(v) })))) },
        { type: 'section', label: 'Animasjon', icon: 'mdi:animation', fields: [
          { type: 'boolean', name: 'anim', label: 'Animasjoner (bølger, bobler, vifte og varme)', default: true },
          { type: 'boolean', name: 'chips', label: 'Statusikoner (pumpe, varme, tak og lys i bildet)', default: true },
        ] },
        { type: 'section', label: 'Visning', icon: 'mdi:eye-outline', fields: [{ type: 'boolean', name: 'toasts', label: 'Bekreftelsesmeldinger', default: true }, { type: 'gap' }] },
      ];
    }
    get cardSize() { return 10; }
    // Gammel config (hurtig:, navn, ctl/ctlHide …) leses normalisert til den er migrert og lagret (se _migrate)
    get config() {
      const c = this._config || {};
      if (this._normSrc !== c) { this._normSrc = c; this._norm = M.poolLegacy(c) ? { ...Basseng.defaults, ...M.poolNorm(c, this._hass) } : c; }
      return this._norm;
    }
    // Fiks 26.14 · migrering, lagres én gang per kort: `hurtig:`/ki-basseng-nøkler → overrides/include, og designets
    // basseng-v3-cfg (localStorage) → config. Bare det levende kortet, ikke mens et utkast er åpent.
    _migrate() {
      const raw = this._rawConfig, id = raw && raw.card_id, h = this._hass;
      if (!id || !this.isConnected || !h || !Object.keys(h.states || {}).length || !M.store || !M.store.loaded || (M.draftOf && M.draftOf(this))) return;
      const pc = M.poolLS();
      if (!M.poolLegacy(raw) && !pc) return;
      const done = (M._poolMig = M._poolMig || new Set());
      if (done.has(id)) return;
      done.add(id);
      const nc = M.poolNorm(raw, h, pc);
      Promise.resolve(M.saveCardConfig(h, raw, nc, { toasts: false, card: this }))
        .then(() => { if (pc) { try { localStorage.removeItem(M.POOL_LS); } catch (e) { /* */ } } })
        .catch((e) => console.warn('[ki-msh] basseng-migrering', e));
    }
    _v(k) { const v = this.config.vals && this.config.vals[k]; return v != null && v !== '' ? v : VDEF[k]; }
    _toast(t) { M.toast(t, { enabled: this.config.toasts !== false }); }
    onOpen() { this._loadHist(); this._loadKlor(); }
    async _loadHist() {
      const e = M.poolEnts(this.hass, this.config);
      const d0 = new Date(); d0.setHours(0, 0, 0, 0);
      if (e.water) { const h = await M.history(this.hass, [e.water], 24); this._hist = h[e.water] || []; }
      if (e.pump && !e.pumped) {
        const h = await M.stateHistory(this.hass, [e.pump], d0.getTime());
        const pts = h[e.pump] || [];
        this._pumpedSec = pts.length ? M.onSeconds(pts, (s) => ['on', 'open'].includes(s), d0.getTime(), Date.now()) : null;
      }
      this.update();
    }
    async _loadKlor() {
      const e = M.poolEnts(this.hass, this.config);
      if (!e.klor_calendar) { this._klor = null; return; }
      const now = new Date(), a = new Date(now.getFullYear(), now.getMonth() - 2, 1), b = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      this._klor = await M.calEvents(this.hass, e.klor_calendar, a.getTime(), b.getTime());
      this.update();
    }
    // Faner uten data skjules automatisk (Spreder uten spreder …)
    _tabs(e) {
      const c = this.config, hid = new Set(c.hidden_tabs || []);
      const has = { ov: true, heat: !!(e.heat || e.water || e.target), klor: !!(e.klor_calendar || e.klor_last || e.klor || e.ph), spr: !!e.spr };
      const order = (Array.isArray(c.tabs) ? c.tabs : []).filter((k) => TABS[k]);
      Object.keys(TABS).forEach((k) => { if (!order.includes(k)) order.push(k); });
      return order.filter((k) => !hid.has(k) && has[k]);
    }
    // Hurtigknapper: rekkefølge (controls) og skjuling (hidden_controls); bare roller som ble funnet
    _ctls(e) {
      const c = this.config, hid = new Set((Array.isArray(c.hidden_controls) ? c.hidden_controls : CTL_HID).map(roleKey));
      const order = (Array.isArray(c.controls) ? c.controls.map(roleKey) : []).filter((k) => CTL[k]);
      CTL_STD.forEach((k) => { if (!order.includes(k)) order.push(k); });
      return order.filter((k, i) => order.indexOf(k) === i && !hid.has(k) && e[k]);
    }
    _target(e) {
      const s = this.s(e.target);
      if (!s) return null;
      if (/^(climate|water_heater)\./.test(e.target)) return s.attributes.temperature != null ? Number(s.attributes.temperature) : null;
      return M.isNum(s.state) ? Number(s.state) : null;
    }
    render() {
      const c = this.config, e = M.poolEnts(this.hass, c);
      this._e = e;
      this._migrate();
      const tl = this._tabs(e), cur = tl.includes(this.ui.tab) ? this.ui.tab : tl[0] || 'ov';
      this._tl = tl; this._cur = cur;
      const idx = Math.max(0, tl.indexOf(cur)), n = tl.length || 1;
      const tabs = tl.map((k, i) => `<span class="gti" role="tab" aria-selected="${i === idx}" data-key="${k}" style="color:${i === idx ? '#3a3a3a' : '#afafaf'}">${esc(TABS[k])}</span>`).join('');
      const body = cur === 'heat' ? this._heat(e) : cur === 'klor' ? this._klorTab(e) : cur === 'spr' ? this._spr(e) : this._ov(e);
      // toppkort (MSH.HEROES-sloten) → prosalinje → faner → innholdet i fanen
      return `<div class="wrap">
        <div class="prose ptop" data-key="prose">${this._prose(e)}</div>
        <div class="tabrow">
          ${tl.length ? `<div class="gt"><div class="gtg" style="grid-template-columns:repeat(${n},minmax(64px,1fr))"><span class="ind" style="left:${(idx / n) * 100}%;width:${100 / n}%"></span>${tabs}</div></div>` : ''}
          <button class="cfg press" data-act="customize" title="Tilpass basseng" aria-label="Tilpass basseng">${M.icon('settings', 20)}</button>
        </div>
        ${tl.length ? body : M.emptyState('Alle faner er skjult', 'sections')}
      </div>`;
    }
    // Prosalinjen under toppkortet: «Vannet er 27,5° og 1,5° over målet. Pumpa går nå.»
    _prose(e) {
      const tw = this.n(e.water), tgt = this._target(e), pumpS = this.s(e.pump), pump = M.onState(pumpS);
      let rel = '';
      if (tw != null && tgt != null) { const d = tw - tgt; rel = Math.abs(d) <= 0.3 ? ' og på målet' : d < 0 ? ` og ${M.nf(-d, 1)}° under målet` : ` og ${M.nf(d, 1)}° over målet`; }
      return tw != null
        ? `Vannet er <span class="pill num">${M.nf(tw, 1)}°</span>${rel}. ${pumpS ? (pump ? 'Pumpa går nå.' : 'Pumpa står.') : ''}`
        : `Vannet er <span class="pill num">–</span>. <button class="lnk" data-act="customize" data-section="overrides">Velg entitet</button>`;
    }
    // Hurtigknapper (Lys · Pumpe · Varme · Stille · Stikkontakt + ekstra fra include)
    _quick(e) {
      const cl = this._ctls(e);
      const btn = (key, id, ic, l, bg, title) => {
        const st = this.s(id), on = M.onState(st);
        return `<button class="tile press" data-key="${esc(key)}" data-act="ctl" data-k="${esc(key)}" data-ent="${esc(id)}" title="${esc(title || l)}" aria-pressed="${on}" style="background:${on ? bg : C.card};color:${on ? '#3a3a3a' : '#fafafa'}">${M.icon(ic, 24)}<span class="tl ell">${esc(l)}</span></button>`;
      };
      const L = cl.map((k) => { const [ic, l, bg, t] = CTL[k]; return btn(k, e[k], ic, l, bg, t ? `${l} · ${t}` : l); });
      (e.extra || []).forEach((x) => { const s = this.s(x.entity); L.push(btn('x:' + x.entity, x.entity, x.ikon || (s && s.attributes.icon) || M.domainIcon(x.entity, s), x.navn || M.name(this.hass, x.entity, M.areaName(this.hass, e.area)), C.accent)); });
      if (!L.length) return `<div class="qempty">${M.emptyState('Fant ingen hurtigknapper (lys, pumpe, varme …)', 'overrides')}</div>`;
      return `<div class="ctl" style="grid-template-columns:repeat(${Math.min(L.length, 5)},minmax(0,1fr))">${L.join('')}</div>`;
    }
    /* ---------------- Oversikt */
    _ov(e) {
      const tw = this.n(e.water), tgt = this._target(e);
      const val = (id, d = 1) => { const v = this.n(id); return v != null ? M.nf(v, d) : '–'; };
      const unit = (id, u) => { const s = this.s(id); return (s && s.attributes.unit_of_measurement) || u; };
      const cards = [['water', 'Vann', tw != null ? M.nf(tw, 1) : '–', '°C', e.water]];
      if (e.savings) cards.push(['savings', 'Spart i dag', val(e.savings, 0), unit(e.savings, 'kr'), e.savings]);
      else cards.push(['bolt', 'Effekt nå', val(e.power, 0), unit(e.power, 'W'), e.power]);
      if (e.ph) cards.push(['science', 'pH', val(e.ph, 1), '', e.ph]);
      if (e.klor) cards.push(['pill', 'Klor', val(e.klor, 1), unit(e.klor, ''), e.klor]);
      const ovCards = cards.map(([ic, l, v, u, id]) => `<div class="kc" data-key="${l}" ${id ? `data-ent="${esc(id)}"` : ''}><span class="kci">${M.icon(ic, 24)}</span><span class="grow"></span><span class="kcl">${esc(l)}</span><span class="kcv num">${esc(v)}<span class="kcu"> ${esc(u)}</span></span></div>`).join('');
      const date = M.cap(new Date().toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' }));
      // i dag
      let pumped = '–';
      if (e.pumped) { const v = this.n(e.pumped), u = unit(e.pumped, 'h'); pumped = v == null ? '–' : M.nf(/min/.test(u) ? v / 60 : v, 1); }
      else if (this._pumpedSec != null) pumped = M.nf(this._pumpedSec / 3600, 1);
      const turnT = M.parseNum(this._v('turnovers'), 3.75);
      const today = [
        ['Pumpet', pumped, 't', 'chevron_right', '#979797', e.pumped || e.pump],
        ['Omsetninger', val(e.turnover, 2), `av ${M.nf(turnT, 2)}`, 'arrow_forward', C.orange, e.turnover],
        ['Spart', val(e.savings, 0), unit(e.savings, 'kr'), 'expand_more', C.green, e.savings],
      ].map(([l, v, u, ic, col, id], i) => `<div class="tr ${i ? 'bt' : ''}" data-key="${l}" ${id ? `data-act="more" data-id="${esc(id)}"` : ''}><span class="trl">${esc(l)}</span><span class="trv num">${esc(v)}</span><span class="tru">${esc(u)}</span>${M.icon(ic, 18, `color:${col};margin-left:6px;align-self:center`)}</div>`).join('');
      // moduser
      const ms = this.s(e.mode), opts = (ms && ms.attributes.options) || [];
      const modes = ms ? `<div class="hs noscroll">${opts.map((o) => `<button class="md press" data-key="${esc(o)}" data-act="mode" data-v="${esc(o)}" data-haptic="selection" style="background:${ms.state === o ? C.accent : C.card};color:${ms.state === o ? '#3a3a3a' : '#fafafa'}">${M.icon(modeIcon(o), 24)}<span class="ell" style="max-width:80px">${esc(o)}</span></button>`).join('')}</div>` : M.emptyState('Fant ingen driftsmodus (select) i bassengområdet', 'overrides');
      // brytere
      const known = { [e.auto]: ['smart_toy', 'Automatikk'], [e.price]: ['price_change', 'Prisstyring'], [e.prio]: ['heat', 'Varmeprioritet'] };
      const flags = e.flags.map((id) => {
        const s = this.s(id), on = M.isOn(s), k = known[id] || [M.domainIcon(id, s), M.name(this.hass, id, M.areaName(this.hass, e.area))];
        return `<button class="fl press" data-key="${esc(id)}" data-act="toggle" data-id="${esc(id)}" data-ent="${esc(id)}" style="background:${on ? C.accent : C.card};color:${on ? '#3a3a3a' : '#fafafa'}"><span class="fli" style="background:${on ? 'rgba(42,23,32,0.12)' : C.inner}">${M.icon(k[0], 22)}</span><span class="flt"><span class="fln ell">${esc(k[1])}</span><span class="fls">${s ? (on ? 'På' : 'Av') : '–'}</span></span></button>`;
      });
      if (this._tl.includes('klor')) {
        const last = this._lastKlor();
        flags.push(`<button class="fl press" data-key="klor" data-act="gotab" data-t="klor" style="background:${C.card}"><span class="fli" style="background:${C.inner}">${M.icon('pill', 22)}</span><span class="flt"><span class="fln">Klor</span><span class="fls">${last ? esc(M.relTime(new Date(last.t0).toISOString())) : '–'}</span></span></button>`);
      }
      // temperaturgraf siste døgn med maks og min
      const g = this._chart(e, tw, tgt);
      const graph = `<div class="hc" data-key="ovgraf" ${e.water ? `data-ent="${esc(e.water)}"` : ''}>
          <div class="hch"><span class="col" style="gap:3px"><span style="font-size:13px;font-weight:500">Vanntemperatur</span><span style="font-size:11px;color:#979797">Siste døgn</span><span class="num" style="font-size:22px;color:${g.dcol}">${esc(g.delta)}</span></span><span class="num" style="font-size:11px;color:#979797;text-align:right;line-height:1.5">${esc(g.mx || 'maks –')}<br>${esc(g.mn || 'min –')}</span></div>
          ${g.chart}
        </div>`;
      return `
        ${this._quick(e)}
        <div class="g2">${ovCards}</div>
        <div class="dh">${M.icon('home', 20)}<span class="dht">I dag</span><span class="dhd">${esc(date)}</span></div>
        <div class="today">${today}</div>
        ${graph}
        ${modes}
        ${flags.length ? `<div class="g2">${flags.join('')}</div>` : ''}`;
    }
    /* ---------------- temperaturgraf siste døgn (maks/min) – Oversikt og Varme */
    _chart(e, tw, tgt) {
      const H = (this._hist || []).slice();
      const t1 = Date.now(), t0 = t1 - 86400000;
      let chart = '', delta = '–', dcol = C.blue, mx = '', mn = '';
      const pts = H.filter((p) => p.t >= t0);
      if (tw != null && !pts.length) pts.push({ t: t0, v: tw }, { t: t1, v: tw });
      if (pts.length) {
        const vs = pts.map((p) => p.v).concat(tgt != null ? [tgt] : []);
        let lo = Math.min(...vs), hi = Math.max(...vs);
        if (hi - lo < 1) { lo -= 0.5; hi += 0.5; }
        const pad = (hi - lo) * 0.15; lo -= pad; hi += pad;
        const X = (t) => ((t - t0) / 86400000) * 300, Y = (v) => 90 - ((v - lo) / (hi - lo)) * 90;
        const ser = M.sample(pts, 36, 24).map((v, i) => [(i / 35) * 300, Y(v)]);
        const path = M.smoothPath(ser);
        const first = pts[0].v, last = pts[pts.length - 1].v, d = last - first;
        delta = (d > 0 ? '+' : d < 0 ? '−' : '') + M.nf(Math.abs(d), 1) + '°';
        dcol = d > 0 ? C.orange : C.blue;
        const pmx = pts.reduce((a, b) => (b.v > a.v ? b : a)), pmn = pts.reduce((a, b) => (b.v < a.v ? b : a));
        mx = `maks ${M.nf(pmx.v, 1)}° ${M.hm(pmx.t)}`; mn = `min ${M.nf(pmn.v, 1)}° ${M.hm(pmn.t)}`;
        // skravert: natt utenfor varmevinduet (til → fra)
        const hf = M.parseHM(this._v('heat_from'), 5), ht = M.parseHM(this._v('heat_to'), 22);
        let rects = '';
        for (let k = -1; k <= 1; k++) {
          const day = new Date(); day.setHours(0, 0, 0, 0); day.setDate(day.getDate() + k);
          const a = day.getTime() + ht * 3600000, b = day.getTime() + (hf < ht ? 24 + hf : hf) * 3600000;
          const xa = Math.max(0, X(a)), xb = Math.min(300, X(b));
          if (xb > xa) rects += `<rect x="${xa.toFixed(1)}" y="0" width="${(xb - xa).toFixed(1)}" height="90" fill="rgba(255,255,255,0.05)"></rect>`;
        }
        chart = `<svg viewBox="0 0 300 90" preserveAspectRatio="none" class="chart">${rects}
          ${tgt != null ? `<line x1="0" x2="300" y1="${Y(tgt).toFixed(1)}" y2="${Y(tgt).toFixed(1)}" stroke="rgba(255,255,255,0.35)" stroke-dasharray="4 4" vector-effect="non-scaling-stroke"></line>` : ''}
          <path d="${path} L300,90 L0,90 Z" style="fill:${M.alpha(C.green, 0.18)}"></path>
          <path d="${path}" fill="none" stroke-width="2" vector-effect="non-scaling-stroke" style="stroke:${C.green}"></path></svg>`;
      } else chart = `<svg viewBox="0 0 300 90" preserveAspectRatio="none" class="chart"><line x1="0" x2="300" y1="45" y2="45" stroke="rgba(255,255,255,0.2)" stroke-dasharray="4 4" vector-effect="non-scaling-stroke"></line></svg>`;
      return { chart, delta, dcol, mx, mn };
    }
    /* ---------------- Varme */
    _heat(e) {
      const c = this.config, tw = this.n(e.water), tgt = this._target(e), hs = this.s(e.heat), heat = M.onState(hs);
      const hp = this.n(e.heat_power);
      const cards = [['device_thermostat', 'Mål', tgt != null ? M.nf(tgt, tgt % 1 ? 1 : 0) : '–', '°C', e.target], ['bolt', 'Effekt nå', hp != null ? M.nf(hp, 0) : '–', 'W', e.heat_power]]
        .map(([ic, l, v, u, id]) => `<div class="kc" data-key="${l}" ${id ? `data-ent="${esc(id)}"` : ''}><span class="kci">${M.icon(ic, 24)}</span><span class="grow"></span><span class="kcl">${esc(l)}</span><span class="kcv num">${esc(v)}<span class="kcu"> ${esc(u)}</span></span></div>`).join('');
      const temps = nums(this._v('targets'), '23 24 25 26 27').slice(0, 5).map((t) => `<button class="sq press" data-key="${t}" data-act="target" data-v="${t}" data-haptic="selection" style="${tgt === t ? `background:${C.accent};color:#3a3a3a` : ''}">${M.nf(t, t % 1 ? 1 : 0)}°</button>`).join('');
      const cost = this.s(e.cost);
      const pill = (t) => `<span class="pill num">${esc(t)}</span>`;
      let prose = tw != null ? `Vannet er ${pill(M.nf(tw, 1) + '°')}` : 'Vanntemperaturen er ukjent';
      if (tgt != null) prose += tw != null && tw < tgt - 0.3 ? ` og varmes mot ${pill(M.nf(tgt, tgt % 1 ? 1 : 0) + '°')}.` : ` og holder målet på ${pill(M.nf(tgt, tgt % 1 ? 1 : 0) + '°')}.`;
      else prose += '.';
      if (hs) prose += heat ? ' Varmepumpa varmer.' : ' Varmepumpa hviler.';
      if (cost && M.isNum(cost.state)) prose += ` Strømmen har kostet ${pill(M.nf(Number(cost.state), 0) + ' ' + (/(nok|kr|sek)/i.test(cost.attributes.unit_of_measurement || '') || !cost.attributes.unit_of_measurement ? 'kroner' : cost.attributes.unit_of_measurement))} i dag.`;
      const { chart, delta, dcol, mx, mn } = this._chart(e, tw, tgt);
      const outS = this.s(e.ute);
      const outV = outS ? (outS.entity_id.startsWith('weather.') ? outS.attributes.temperature : M.isNum(outS.state) ? Number(outS.state) : null) : null;
      const fmtU = (id, d) => { const s = this.s(id); if (!s || !M.isNum(s.state)) return '–'; const v = Number(s.state), u = s.attributes.unit_of_measurement || ''; return u === 'W' && v >= 1000 && d === 'kw' ? `${M.nf(v / 1000, 1)} kW` : `${M.nf(v, v % 1 && v < 100 ? 1 : 0)} ${u}`.trim(); };
      const stats = [[outV != null ? M.nf(outV, 1) + '°' : '–', 'Ute', e.ute], [fmtU(e.heat_loss, 'kw'), 'Varmetap', e.heat_loss], [fmtU(e.solar), 'Sol inn', e.solar]]
        .map(([v, l, id]) => `<div class="hsx" data-key="${l}" ${id ? `data-ent="${esc(id)}"` : ''}><span class="num" style="font-size:15px">${esc(v)}</span><span style="font-size:11px;color:#979797">${esc(l)}</span></div>`).join('');
      const sw = (on, col) => `<span class="trk" style="background:${on ? col || '#fafafa' : C.ctrl}"><span class="knb" style="left:${on ? 21 : 3}px;background:${on ? '#282828' : '#c7c7c7'}"></span></span>`;
      const tg = [['night', 'Nattsenking', (on) => (on ? 'Senker' : 'Holder varmen'), 'Gjenoppvarming koster like mye som den sparer'], ['cover', 'Pooltak', (on) => (on ? 'Lukket' : 'Åpent'), 'Sparer varme når det er lukket'], ['winter', 'Vintermodus', (on) => (on ? 'På' : 'Av'), '']]
        .map(([k, l, vf, sub]) => {
          const id = e[k], s = this.s(id), on = M.onState(s);
          return `<button class="htg press" data-key="${k}" ${id ? `data-act="ctl" data-k="${k}" data-ent="${esc(id)}"` : 'data-act="customize" data-section="overrides"'} style="${k === 'night' ? 'grid-column:span 2;' : ''}${k === 'winter' ? 'background:linear-gradient(180deg,#232a4a,#303a60);' : ''}">
            <span style="font-size:12px;color:#afafaf;text-align:left">${esc(l)}</span><span class="grow"></span>
            <span class="htb"><span class="col" style="text-align:left"><span style="font-size:24px">${s ? esc(vf(on)) : '–'}</span><span style="font-size:10px;color:#979797">${esc(s ? sub : 'Velg entitet')}</span></span>${sw(on)}</span></button>`;
        }).join('');
      return `
        <div class="g2">${cards}</div>
        <div class="g5">${temps}</div>
        ${/^(number|input_number)\./.test(e.target || '') ? `<div class="stpc">${M.stepperHTML(this.hass, e.target, { label: 'Måltemperatur', key: 'stp-target' })}</div>` : ''}
        <div class="prose">${prose}</div>
        <div class="hc" ${e.water ? `data-ent="${esc(e.water)}"` : ''}>
          <div class="hch"><span class="col" style="gap:3px"><span style="font-size:13px;font-weight:500">Vanntemperatur</span><span style="font-size:11px;color:#979797">Endring siste døgn</span><span class="num" style="font-size:22px;color:${dcol}">${esc(delta)}</span></span><span class="num" style="font-size:11px;color:#979797;text-align:right;line-height:1.5">${esc(mx)}<br>${esc(mn)}</span></div>
          ${chart}
          <div class="g3">${stats}</div>
        </div>
        <div class="g2">${tg}</div>`;
    }
    /* ---------------- Klor */
    _klorEvents() { return (this._klor || []).filter((ev) => /klor|chlor|tablett/i.test(ev.summary || '') || this._e.klor_calendar && /klor|chlor/.test(this._e.klor_calendar)); }
    _lastKlor() {
      const L = this._klorEvents().filter((ev) => ev.t0 <= Date.now());
      if (L.length) return L[L.length - 1];
      // uten klorkalender: input_datetime (tidspunkt) eller counter (sist endret) for siste klortablett
      const s = this._e && this._e.klor_last && this.s(this._e.klor_last);
      if (!s) return null;
      const t = s.entity_id.startsWith('input_datetime.') ? new Date(String(s.state).replace(' ', 'T')).getTime() : new Date(s.last_changed).getTime();
      return isNaN(t) ? null : { t0: t, summary: '' };
    }
    _qtyOf(ev) { const m = /[×x](\d+)|(\d+)\s*stk/i.exec(ev.summary || ''); return m ? Number(m[1] || m[2]) : 1; }
    _klorTab(e) {
      const c = this.config, cal = e.klor_calendar, names = e.people.map((id) => M.name(this.hass, id));
      const every = M.parseNum(this._v('klor_every'), 7), last = this._lastKlor();
      const next = last ? new Date(last.t0 + every * 86400000) : null;
      const lastWho = last ? names.find((nm) => (last.summary || '').toLowerCase().includes(nm.toLowerCase())) : null;
      const now = new Date(), y = now.getFullYear(), m = now.getMonth();
      const monthEv = this._klorEvents().filter((ev) => { const d = new Date(ev.t0); return d.getFullYear() === y && d.getMonth() === m; });
      const qty = this.ui.qty || 1;
      const people = e.people.map((id, i) => {
        const nm = names[i], cnt = monthEv.filter((ev) => (ev.summary || '').toLowerCase().includes(nm.toLowerCase())).reduce((t, ev) => t + this._qtyOf(ev), 0);
        return `<button class="pp press" data-key="${esc(id)}" data-act="log" data-name="${esc(nm)}" data-haptic="success"><span class="ppa">${M.icon('person', 20)}</span><span class="ppn ell">${esc(nm)}</span><span style="font-size:12px;color:#979797">${cal ? cnt : '–'}</span></button>`;
      }).join('');
      const qtys = [[1, '1 stk', 'pill'], [2, '2 stk', 'pill'], [3, '3 stk', 'pill'], [0, 'Angre siste', 'undo']].map(([q, l, ic]) => `<button class="qt press" data-key="q${q}" data-act="${q ? 'qty' : 'undo'}" data-q="${q}" data-haptic="selection" style="${qty === q ? `background:${C.accent};color:#3a3a3a` : ''}">${M.icon(ic, 16)}${esc(l)}</button>`).join('');
      const off = (new Date(y, m, 1).getDay() + 6) % 7, dim = new Date(y, m + 1, 0).getDate();
      const logged = new Set(monthEv.map((ev) => new Date(ev.t0).getDate()));
      const days = Array.from({ length: Math.ceil((off + dim) / 7) * 7 }, (_, i) => {
        const d = i - off + 1, inM = d >= 1 && d <= dim, lg = inM && logged.has(d), td = d === now.getDate();
        return `<span class="cd" style="background:${lg ? C.green : 'transparent'};color:${lg ? '#3a3a3a' : '#afafaf'};${td && inM ? 'box-shadow:inset 0 0 0 1.5px #fafafa;' : ''}font-weight:${lg || td ? 600 : 400}">${inM ? d : ''}</span>`;
      }).join('');
      const monthName = now.toLocaleDateString('nb-NO', { month: 'long' });
      const left = next ? Math.ceil((next.getTime() - Date.now()) / 86400000) : null;
      const rows = [
        ['notifications_active', 'Påminnelse', `Hver ${M.nf(every, every % 1 ? 1 : 0)}. dag${left != null ? ` · ${left > 0 ? `om ${left} d` : left === 0 ? 'i dag' : `${-left} d på overtid`}` : ''}`, 'styr'],
        ['event_note', 'Klorloggen', cal ? M.name(this.hass, cal) : 'Velg en kalender under Tilpass', 'overrides'],
        ['groups', 'Navn i klorloggen', names.join(', ') || 'Ingen personer', 'entities'],
      ].map(([ic, l, sub, sec]) => `<button class="kr press" data-key="${l}" data-act="customize" data-section="${sec}"><span class="kri">${M.icon(ic, 22)}</span><span class="col grow" style="gap:1px;text-align:left"><span style="font-size:14px;font-weight:600">${esc(l)}</span><span class="ell" style="font-size:11px;color:#979797">${esc(sub)}</span></span>${M.icon('chevron_right', 22, 'color:#979797')}</button>`).join('');
      const nextTxt = next ? `Neste klortablett ${next.toLocaleDateString('nb-NO', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\.(?=\s)/, '')}` : cal ? 'Ingen klortablett logget ennå' : 'Neste klortablett –';
      const lastTxt = last ? `${M.cap(M.relTime(new Date(last.t0).toISOString()))}${lastWho ? ` · ${lastWho} la i sist` : ''}` : cal ? 'Logg første tablett under' : 'Velg klorkalender for å logge';
      return `
        <div class="kn"><span class="kni">${M.icon('pill', 22)}</span><span class="col" style="gap:1px"><span style="font-size:14px;font-weight:600">${esc(nextTxt)}</span><span style="font-size:11px;color:#979797">${esc(lastTxt)}</span></span></div>
        <span class="hint">Hvem la i? Trykk på navnet.</span>
        ${people ? `<div class="g2">${people}</div>` : ''}
        <button class="la press" data-act="log" data-name="" data-haptic="success"><span class="lai">${M.icon('pill', 22)}</span>Logg klortablett uten navn</button>
        <div class="qts">${qtys}</div>
        <div class="kal">
          <div class="row" style="gap:10px">${M.icon('calendar_month', 20)}<span class="grow" style="font-size:15px;font-weight:500">Kalender</span><span style="font-size:12px;color:#979797">${cal ? `${monthEv.reduce((t, ev) => t + this._qtyOf(ev), 0)} stk i ${esc(monthName)}` : '–'}</span></div>
          <div class="calg">${['ma', 'ti', 'on', 'to', 'fr', 'lø', 'sø'].map((w) => `<span class="wd">${w}</span>`).join('')}${days}</div>
        </div>
        ${rows}`;
    }
    /* ---------------- Spreder */
    _spr(e) {
      const id = e.spr, s = this.s(id), on = M.onState(s);
      const durs = nums(this._v('spr_durs'), '5 10 15 20 30').slice(0, 5);
      const ds = this.s(e.spr_duration);
      let dur = ds && M.isNum(ds.state) ? null : this.ui.dur; // varighets-entitet er sannheten (stepperen skriver til den)
      if (dur == null && ds && M.isNum(ds.state)) dur = Number(ds.state) / (/s$|sek/.test(ds.attributes.unit_of_measurement || '') ? 60 : 1);
      if (dur == null) dur = durs[0];
      this._dur = dur;
      const frost = this._v('spr_frost');
      const rows = [['schedule', 'Start hver', 'Mellom 10 og 20', this._v('spr_every')], ['hourglass_top', 'Maks per døgn', 'Spreder stopper når tiden er brukt', this._v('spr_max')], ['timer', 'Varighet', 'Hvor lenge den går hver gang', `${M.nf(dur, 0)} min`], ['ac_unit', 'Frostvakt', 'Starter ikke når det er under 2 °C ute', frost === true || frost === 'true' ? 'På' : 'Av']]
        .map(([ic, l, sub, v]) => `<button class="kr sr press" data-key="${l}" data-act="customize" data-section="styr"><span class="kri" style="width:44px;height:44px">${M.icon(ic, 20)}</span><span class="col grow" style="gap:1px;text-align:left"><span style="font-size:14px;font-weight:600">${esc(l)}</span><span class="ell" style="font-size:11px;color:#979797">${esc(sub)}</span></span><span style="font-size:13px">${esc(String(v))}</span>${M.icon('expand_more', 20, 'color:#979797')}</button>`).join('');
      return `
        <div class="spx" ${id ? `data-ent="${esc(id)}"` : ''}>
          <span class="sun"></span>
          <svg viewBox="0 0 300 50" preserveAspectRatio="none" class="spw"><path d="M0,20 C50,5 100,35 150,20 S250,5 300,20 L300,50 L0,50 Z" fill="#3a93bf" opacity="0.7"></path></svg>
          <span class="pole"></span>
          <span class="spl">Spreder</span>
          <span class="sps"><span style="font-size:26px">${s ? (on ? 'Sprer' : 'Står') : '–'}</span><span style="font-size:11px;color:#c9d6e2">${s ? `Klar for ${M.nf(dur, 0)} min` : 'Velg spreder i tilpass'}</span></span>
        </div>
        <button class="sb press" data-act="sprstart" data-haptic="success"><span class="sbi">${M.icon(on ? 'stop' : 'play_arrow', 22)}</span>${s ? (on ? 'Stopp' : `Start i ${M.nf(dur, 0)} min`) : 'Velg spreder'}</button>
        <div class="g5">${durs.map((d) => `<button class="sq press" data-key="${d}" data-act="dur" data-v="${d}" data-haptic="selection" style="${d === dur ? `background:${C.accent};color:#3a3a3a` : ''}">${M.nf(d, 0)}</button>`).join('')}</div>
        ${e.spr_duration ? `<div class="stpc">${M.stepperHTML(this.hass, e.spr_duration, { label: 'Varighet', sub: 'Hvor lenge spreder går hver gang', key: 'stp-spr' })}</div>` : ''}
        ${rows}`;
    }
    /* ---------------- handlinger */
    async onAction(name, el, ev) {
      const d = el.dataset, e = this._e || M.poolEnts(this.hass, this.config), h = this.hass;
      if (name === 'ctl') {
        const id = String(d.k || '').startsWith('x:') ? d.k.slice(2) : e[d.k];
        if (!id) return this.customize('overrides');
        const dom = id.split('.')[0];
        if (dom === 'binary_sensor') return M.moreInfo(this, id);
        if (dom === 'climate') { const s = h.states[id]; return M.call(h, 'climate', s.state === 'off' ? 'turn_on' : 'turn_off', { entity_id: id }); }
        if (dom === 'water_heater') { const s = h.states[id]; return M.call(h, 'water_heater', s.state === 'off' ? 'turn_on' : 'turn_off', { entity_id: id }); }
        return M.toggle(h, id);
      }
      if (name === 'gotab') return this.setUI({ tab: d.t });
      if (name === 'mode') { if (!e.mode) return; return M.call(h, e.mode.split('.')[0], 'select_option', { entity_id: e.mode, option: d.v }); }
      if (name === 'target') {
        if (!e.target) return this.customize('overrides');
        await M.setValue(h, e.target, Number(d.v));
        return this._toast(`Mål satt til ${d.v}°`);
      }
      if (name === 'qty') return this.setUI({ qty: Number(d.q) });
      if (name === 'log') {
        if (!e.klor_calendar) return this.customize('overrides');
        const q = this.ui.qty || 1, t = new Date();
        const summary = `Klortablett${d.name ? ' · ' + d.name : ''}${q > 1 ? ' ×' + q : ''}`;
        await M.call(h, 'calendar', 'create_event', { entity_id: e.klor_calendar, summary, start_date_time: t.toISOString(), end_date_time: new Date(t.getTime() + 300000).toISOString() });
        this._toast(`${q} klortablett${q > 1 ? 'er' : ''} logget${d.name ? ' · ' + d.name : ''}`);
        setTimeout(() => this._loadKlor(), 800);
        return;
      }
      if (name === 'undo') {
        const last = this._lastKlor();
        if (!last || !last.uid || !e.klor_calendar) return this._toast('Ingenting å angre');
        try { await h.callWS({ type: 'calendar/event/delete', entity_id: e.klor_calendar, uid: last.uid, ...(last.recurrence_id ? { recurrence_id: last.recurrence_id } : {}) }); this._toast('Siste klortablett fjernet'); } catch (x) { this._toast('Kunne ikke angre'); }
        setTimeout(() => this._loadKlor(), 800);
        return;
      }
      if (name === 'dur') {
        const v = Number(d.v);
        this.setUI({ dur: v });
        if (e.spr_duration) { const ds = h.states[e.spr_duration]; M.setValue(h, e.spr_duration, /s$|sek/.test((ds && ds.attributes.unit_of_measurement) || '') ? v * 60 : v); }
        return;
      }
      if (name === 'sprstart') {
        if (!e.spr) return this.customize('overrides');
        const s = h.states[e.spr], on = M.onState(s), dom = e.spr.split('.')[0];
        if (on) { await M.call(h, dom === 'valve' ? 'valve' : 'homeassistant', dom === 'valve' ? 'close_valve' : 'turn_off', { entity_id: e.spr }); return this._toast('Spreder stoppet'); }
        if (e.spr_duration) { const ds = h.states[e.spr_duration]; await M.setValue(h, e.spr_duration, /s$|sek/.test((ds && ds.attributes.unit_of_measurement) || '') ? this._dur * 60 : this._dur); }
        await M.call(h, dom === 'valve' ? 'valve' : 'homeassistant', dom === 'valve' ? 'open_valve' : 'turn_on', { entity_id: e.spr });
        return this._toast(`Spreder startet · ${M.nf(this._dur, 0)} min`);
      }
      return super.onAction(name, el, ev);
    }
    afterRender() {
      const gt = this.shadowRoot.querySelector('.gt');
      if (gt && !gt.__b) {
        gt.__b = true;
        M.guardDrag(gt, 'none');
        const g = () => gt.querySelector('.gtg');
        const xOf = (ev) => { const r = g().getBoundingClientRect(); return (ev.clientX - r.left) / r.width; };
        let drag = null, near = -1;
        const paint = (x) => {
          const n = this._tl.length, pos = Math.max(0.5 / n, Math.min(1 - 0.5 / n, x)), nr = Math.max(0, Math.min(n - 1, Math.floor(x * n)));
          const ind = gt.querySelector('.ind');
          Object.assign(ind.style, { left: ((pos - 0.5 / n) * 100) + '%', background: 'linear-gradient(180deg, rgba(255,255,255,0.3), rgba(255,255,255,0.1))', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -1px 1px rgba(255,255,255,0.15), inset 0 0 0 0.5px rgba(255,255,255,0.35), 0 8px 20px rgba(0,0,0,0.35)', backdropFilter: 'blur(6px) saturate(200%)', transform: 'scale(1.12, 1.1)', transition: 'transform .25s cubic-bezier(.34,1.8,.64,1), background .2s' });
          gt.querySelectorAll('.gti').forEach((s, i) => { s.style.color = i === nr ? '#fff' : '#afafaf'; });
          if (nr !== near) { if (near >= 0) M.haptic('selection'); near = nr; }
        };
        // Dra (≥ 8 px) = glassboblen følger fingeren; vanlig trykk = linse-animasjon (MSH.glassMorph, Fiks 4 · 3)
        gt.addEventListener('pointerdown', (ev) => { if (ev.button) return; drag = { x: xOf(ev), cx: ev.clientX, on: false }; near = -1; this._busy = true; try { gt.setPointerCapture(ev.pointerId); } catch (x) { /* */ } });
        const trOn = () => { const T = gt.__tabReorder; return !!T && ((T.st && T.st.phase === 'drag') || Date.now() < T.eatUntil); }; // Fiks 28.13: fane-flytting pågår
        gt.addEventListener('pointermove', (ev) => { if (!drag || trOn()) return; ev.preventDefault(); drag.x = xOf(ev); if (!drag.on && Math.abs(ev.clientX - drag.cx) < 8) return; drag.on = true; paint(drag.x); });
        const up = (ev, cancel) => {
          if (!drag) return;
          if (trOn()) { drag = null; return; } // hold + dra flyttet fanen (MSH.tabReorder) – ikke et fanebytte
          const n = this._tl.length, i = Math.max(0, Math.min(n - 1, Math.floor(drag.x * n))), tap = !drag.on;
          drag = null; this._busy = false;
          if (tap && !cancel && this._tl[i] && this._tl[i] !== this._cur && M.glassMorph) { const sp = gt.querySelectorAll('.gti'); M.glassMorph(g(), sp[this._tl.indexOf(this._cur)], sp[i], { axis: 'x' }); }
          const ind = gt.querySelector('.ind');
          ind.removeAttribute('style');
          gt.querySelectorAll('.gti').forEach((s) => s.removeAttribute('style'));
          if (!cancel && this._tl[i] && this._tl[i] !== this._cur) { M.haptic('selection'); this.setUI({ tab: this._tl[i] }); } else this.update();
        };
        gt.addEventListener('pointerup', (ev) => up(ev, false));
        gt.addEventListener('pointercancel', (ev) => up(ev, true));
      }
      // Fiks 28.13: hold 400 ms + dra = omorganiser fanene (tabs); glassboblen/trykk over er fortsatt kortets egen kode
      if (gt && M.tabReorder) M.tabReorder(gt, {
        card: this, styleRow: false, glassTap: false, itemStop: false,
        items: () => Array.from(gt.querySelectorAll('.gti')), idOf: (b) => b.dataset.key, active: () => this._cur,
        onReorder: (keys) => { const c = this.config, all = (Array.isArray(c.tabs) ? c.tabs : []).filter((k) => TABS[k]); Object.keys(TABS).forEach((k) => { if (!all.includes(k)) all.push(k); }); M.mshPatchConfig(this, { tabs: M.tabMerge(keys, all) }); },
      });
      this.shadowRoot.querySelectorAll('.hs').forEach((el) => M.guardScroll(el));
    }
    get styles() {
      return (M.STEPPER_CSS || '') + `
        .stpc{border-radius:24px;background:${C.card}}
        .wrap{display:flex;flex-direction:column;gap:var(--msh-gap,10px)}
        .ctl{display:grid;gap:8px}
        .tile{height:72px;border-radius:22px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;min-width:0;padding:0 4px;transition:background .2s,color .2s}
        .tile .tl{font-size:10.5px;font-weight:500;max-width:100%;opacity:.85}
        .ptop{padding:2px 6px 0}
        .tabrow{display:flex;justify-content:center;align-items:center;gap:6px;min-width:0}
        .gt{padding:4px;border-radius:24px;${M.tabSurface ? M.tabSurface('transparent', 'inset 0 0 0 1px rgba(255,255,255,0.18)') : 'box-shadow:inset 0 0 0 1px rgba(255,255,255,0.18);'}max-width:calc(100% - 50px);overflow-x:auto;scrollbar-width:none;touch-action:none;user-select:none;-webkit-user-select:none;cursor:pointer}
        .gt::-webkit-scrollbar{display:none}
        .gtg{position:relative;display:grid;width:max-content}
        .ind{position:absolute;top:0;bottom:0;border-radius:999px;pointer-events:none;background:${C.accent};transition:left .5s cubic-bezier(.34,1.4,.64,1),transform .45s cubic-bezier(.34,1.8,.64,1),background .35s}
        .gti{position:relative;z-index:1;height:34px;padding:0 12px;display:grid;place-items:center;font-size:13px;font-weight:500;white-space:nowrap;transition:color .25s}
        .cfg{width:42px;height:42px;border-radius:21px;flex:none;display:grid;place-items:center;background:${C.card};color:#c7c7c7}
        .g2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
        .g3{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
        .g5{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}
        .kc{height:150px;padding:12px;border-radius:28px;background:${C.card};display:flex;flex-direction:column;min-width:0}
        .kci{width:48px;height:48px;border-radius:24px;background:${C.inner};display:grid;place-items:center}
        .kcl{font-size:13px;color:#afafaf;padding-left:6px}
        .kcv{font-size:30px;font-weight:300;line-height:1.1;padding-left:6px;white-space:nowrap}
        .kcu{font-size:12px}
        .prose{font-size:19px;line-height:1.9;padding:0 6px}
        .pill{display:inline-flex;height:30px;padding:0 12px;border-radius:15px;background:#fafafa;color:#282828;font-weight:600;align-items:center;vertical-align:middle;line-height:1}
        .lnk{text-decoration:underline;font-size:inherit}
        .dh{display:flex;align-items:center;gap:8px;padding:4px 8px 0}
        .dht{font-size:15px;font-weight:500}
        .dhd{font-size:12px;color:#979797}
        .today{display:flex;flex-direction:column;padding:0 16px;border-radius:26px;background:${C.card}}
        .tr{display:flex;align-items:baseline;gap:6px;padding:16px 0;cursor:pointer}
        .bt{border-top:1px solid rgba(255,255,255,0.07)}
        .trl{flex:1;font-size:14px;color:#afafaf}
        .trv{font-size:22px;font-weight:300}
        .tru{font-size:11px;color:#979797}
        .hs{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none}
        .hs::-webkit-scrollbar{display:none}
        .md{flex:none;width:90px;height:84px;border-radius:24px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;font-size:13px;font-weight:500}
        .fl{display:flex;align-items:center;gap:10px;height:60px;padding:0 12px 0 6px;border-radius:30px;min-width:0}
        .fli{width:46px;height:46px;border-radius:23px;flex:none;display:grid;place-items:center}
        .flt{display:flex;flex-direction:column;gap:1px;text-align:left;min-width:0}
        .fln{font-size:14px;font-weight:600}
        .fls{font-size:11px;opacity:.75}
        .sq{height:70px;border-radius:22px;font-size:15px;font-weight:500;background:${C.card};color:#fafafa;box-shadow:inset 0 6px 0 -4px rgba(255,255,255,0.08)}
        .hc{display:flex;flex-direction:column;gap:10px;padding:16px;border-radius:28px;background:${C.card}}
        .hch{display:flex;justify-content:space-between;align-items:flex-start}
        .chart{width:100%;height:110px;display:block}
        .hsx{padding:10px 12px;border-radius:14px;background:var(--gray100,#2f2f2f);display:flex;flex-direction:column;gap:2px;min-width:0}
        .htg{height:140px;padding:14px;border-radius:26px;display:flex;flex-direction:column;background:${C.card};min-width:0}
        .htb{display:flex;align-items:flex-end;justify-content:space-between;width:100%;gap:6px}
        .trk{position:relative;width:44px;height:26px;border-radius:13px;flex:none;transition:background .2s}
        .knb{position:absolute;top:3px;width:20px;height:20px;border-radius:10px;transition:left .2s}
        .kn{display:flex;align-items:center;gap:12px;height:62px;padding:0 16px 0 6px;border-radius:31px;background:${C.card}}
        .kni{width:50px;height:50px;border-radius:25px;background:${M.alpha(C.green, 0.25)};color:${C.green};display:grid;place-items:center;flex:none}
        .hint{font-size:12px;color:#979797;padding:0 8px}
        .pp{display:flex;align-items:center;gap:10px;height:60px;padding:0 14px 0 8px;border-radius:30px;background:${C.card};min-width:0}
        .ppa{width:40px;height:40px;border-radius:20px;background:${C.inner};display:grid;place-items:center;flex:none}
        .ppn{flex:1;font-size:15px;font-weight:500;text-align:left}
        .la{display:flex;align-items:center;gap:12px;height:60px;padding:0 16px 0 6px;border-radius:30px;background:${C.green};color:#3a3a3a;font-size:15px;font-weight:600}
        .lai{width:48px;height:48px;border-radius:24px;background:rgba(0,0,0,0.1);display:grid;place-items:center}
        .qts{display:flex;gap:6px;flex-wrap:wrap}
        .qt{height:38px;padding:0 14px 0 10px;border-radius:19px;display:flex;align-items:center;gap:6px;white-space:nowrap;flex:none;font-size:13px;font-weight:500;background:${C.card}}
        .kal{display:flex;flex-direction:column;gap:10px;padding:14px;border-radius:26px;background:${C.card}}
        .calg{display:grid;grid-template-columns:repeat(7,1fr);gap:5px;padding:10px;border-radius:18px;background:var(--gray100,#2f2f2f)}
        .wd{text-align:center;font-size:10px;color:#7f7f7f}
        .cd{height:38px;border-radius:10px;display:grid;place-items:center;font-size:12px}
        .kr{display:flex;align-items:center;gap:12px;min-height:62px;padding:0 16px 0 6px;border-radius:31px;background:${C.card};width:100%}
        .kr.sr{min-height:60px;border-radius:30px}
        .kri{width:48px;height:48px;border-radius:24px;background:${C.inner};display:grid;place-items:center;flex:none}
        .spx{position:relative;height:130px;border-radius:28px;overflow:hidden;background:linear-gradient(180deg,#1b2a3c,#23405a 60%,#2f6c8f)}
        .sun{position:absolute;right:30px;top:12px;width:22px;height:22px;border-radius:11px;background:#e6dfc4}
        .spw{position:absolute;left:0;right:0;bottom:0;width:100%;height:60px}
        .pole{position:absolute;left:50%;top:26px;width:6px;height:44px;margin-left:-3px;border-radius:3px;background:#b8c4cc}
        .spl{position:absolute;left:14px;top:12px;font-size:12px;color:#c9d6e2}
        .sps{position:absolute;left:14px;bottom:12px;display:flex;flex-direction:column}
        .sb{display:flex;align-items:center;gap:12px;height:56px;padding:0 16px 0 6px;border-radius:28px;background:${C.blue};color:#12243a;font-size:15px;font-weight:600}
        .sbi{width:44px;height:44px;border-radius:22px;background:rgba(255,255,255,0.25);display:grid;place-items:center}
      `;
    }
  }
  M.define('msh-basseng-card', Basseng, 'MSH Basseng', 'Basseng (ÉTT kort, legges manuelt i en egen popup): toppkort, prosalinje, faner (Oversikt, Varme, Klor, Spreder), hurtigknapper (Lys, Pumpe, Varme, Stille, Stikkontakt) autokonfigurert, klorlogg og spreder.');

  /* ------------------------------------------------------------ bassengpopupene er slettet (brukerens beslutning) */
  // Strategien lager ingen bassengpopup lenger – verken #badebasseng eller #basseng – og ingen rom-popup for et område
  // som heter «Basseng»/«Pool» (MSH.ROOM_BLOCK). Navbaren har ingen innebygd basseng-knapp, og onboarding foreslår den
  // ikke. msh-basseng-card finnes fortsatt og kan legges manuelt i en egen popup (README → Manuelt); alias-elementene
  // ki-basseng-card/ki-basseng-hero-card rendrer det for manuelle dashbord. Omdirigeringen #basseng → #badebasseng er
  // fjernet (det finnes ikke noe mål).
  //   · MSH.POPUP_DROP.basseng: gamle/importerte bassengpopups i dashbord-config (strategi-YAML custom_popups, ki-store
  //     custom_popups) droppes av strategien (MSH.mergePopups → report.dropped) i stedet for å tas over.
  //   · M.bassengMigrateStore: engangsmigrering av ki-store (migrations.basseng_fjernet), se under.
  const ALL_HASH = ['#badebasseng', '#basseng', '#pool', '#svommebasseng'];
  M.BASSENG_HASHES = ALL_HASH;
  const cfgOf = (e) => { try { return M.customPopupConfig ? M.customPopupConfig(e).cfg : e; } catch (x) { return null; } };
  const hashN = (cfg) => { const s = String((cfg && cfg.hash) || '').trim(); return s ? s.replace(/^#?/, '#') : ''; };
  const isPoolHash = (v) => { const s = String(v == null ? '' : v).trim(); return !!s && ALL_HASH.includes(s.replace(/^#?/, '#')); };
  const hasMainC = (cfg) => cardsDeep(cfg && cfg.cards).some((c) => tagOfC(c) === 'msh-basseng-card');
  // Ser ut som en bassengpopup: gamle/nye bassengkort, eller navn/ikon/innhold om basseng (f.eks. decluttering-maler)
  const POOLISH_RX = /basseng|baseng|pool|sv[øo]mme/i;
  const poolish = (cfg) => !!cfg && typeof cfg === 'object' && (M.bassengLegacyTest(cfg) || hasMainC(cfg) || POOLISH_RX.test(`${cfg.name || ''} ${cfg.icon || ''}`) || (() => { try { return POOLISH_RX.test(JSON.stringify(cfg.cards || [])); } catch (e) { return false; } })());
  // Gammel/importert bassengpopup (droppes av strategien): de gamle kortene (ki-basseng-*, msh-basseng-hero-card), eller
  // basseng-aktig på en av bassenghashene uten msh-basseng-card. En egen popup med msh-basseng-card (manuelt) beholdes.
  M.bassengIsOldPopup = (cfg) => !!cfg && typeof cfg === 'object' && (M.bassengLegacyTest(cfg) || (ALL_HASH.includes(hashN(cfg)) && !hasMainC(cfg) && poolish(cfg)));
  // Alle bassengpopups (engangsmigreringen av ki-store): også de med msh-basseng-card, på hvilken som helst hash
  M.bassengIsPoolPopup = (cfg) => !!cfg && typeof cfg === 'object' && (M.bassengIsOldPopup(cfg) || hasMainC(cfg) || (ALL_HASH.includes(hashN(cfg)) && poolish(cfg)));
  M.POPUP_DROP = M.POPUP_DROP || {};
  M.POPUP_DROP.basseng = { name: 'Basseng (slettet)', test: (cfg) => M.bassengIsOldPopup(cfg) };
  // Ingen rom-popup for et område som heter basseng/pool (id eller navn)
  const POOL_AREA_RX = /basseng|baseng|(^|[\s_-])pool([\s_-]|$)|sv[øo]mmebasseng/i;
  M.ROOM_BLOCK = M.ROOM_BLOCK || [];
  M.ROOM_BLOCK.push((hass, id) => { const a = (hass && hass.areas && hass.areas[id]) || {}; return POOL_AREA_RX.test(String(id || '')) || POOL_AREA_RX.test(String(a.name || '')); });

  /* Engangsmigrering av ki-store (frontend/set_user_data, per HA-bruker). Kjøres av strategien ved generering; merket i
   * ki-store `migrations.basseng_fjernet` (kjører aldri igjen) og logget i konsollen:
   *   1. custom_popups: ALLE bassengpopups fjernes (gamle kort, msh-basseng-card, eller basseng-aktig på #basseng/
   *      #badebasseng/#pool/#svommebasseng). Andre popups (også en helt annen popup på #basseng) beholdes.
   *   2. popup_overrides.basseng/badebasseng/pool/svommebasseng (med og uten #) fjernes.
   *   3. popups.<samme nøkler> (Tilpass Hjem → Popups: navn/ikon/farge/skjult) fjernes.
   *   4. Navbar: knappen «basseng» (bar/more/hidden/buttons.basseng) og egne knapper som peker på en bassenghash fjernes.
   *   5. Lenker til bassenghashene i alle kortconfiger (Hjem-kort, prosa-piller, popup_hash, tap_action …) fjernes;
   *      selve kortet/pillen beholdes.
   *   6. Admin: Lovelace-ressursene ki-basseng-card.js/ki-basseng-hero-card.js slettes (lovelace/resources/delete).
   * Service worker-/nettleser-cachen for de gamle filene tømmes ved hver oppstart (M.bassengClearCache). */
  const MIG_KEY = 'migrations.basseng_fjernet';
  const OLD_FILE_RX = /(^|\/)ki-basseng(-hero)?-card\.js(\?|$)/;
  const LINK_KEYS = ['navigation_path', 'popup_hash', 'hash', 'link', 'path', 'card_hash', 'icon_hash', 'alarm_hash', 'trash_hash'];
  // en lenke til en bassenghash: '#basseng' (alle nøkler), 'basseng' uten # (bare lenkenøkler), eller { action: navigate, navigation_path }
  const isPoolLink = (v, key) => {
    if (typeof v === 'string') { const t = v.trim(); return t[0] === '#' ? isPoolHash(t) : !!key && LINK_KEYS.includes(key) && isPoolHash(t); }
    return !!v && typeof v === 'object' && !Array.isArray(v) && v.action === 'navigate' && typeof v.navigation_path === 'string' && isPoolHash(v.navigation_path);
  };
  const stripLinks = (o, d = 0, key = null) => {
    if (d > 14 || o == null || typeof o !== 'object') return { v: o, n: 0 };
    if (Array.isArray(o)) {
      let n = 0;
      const v = [];
      o.forEach((x) => { if (isPoolLink(x, null)) { n++; return; } const r = stripLinks(x, d + 1); n += r.n; v.push(r.v); });
      return n ? { v, n } : { v: o, n: 0 };
    }
    let n = 0;
    const v = {};
    Object.keys(o).forEach((k) => { if (isPoolLink(o[k], k)) { n++; return; } const r = stripLinks(o[k], d + 1, k); n += r.n; v[k] = r.v; });
    return n ? { v, n } : { v: o, n: 0 };
  };
  // knappens mål (navbar): tap_action/tap (HA-format eller streng) eller den gamle hash-nøkkelen
  const btnPool = (b) => { if (!b || typeof b !== 'object') return false; const t = b.tap_action || b.tap; if (t && typeof t === 'object') return isPoolLink(t); if (typeof t === 'string' && t.trim()) return isPoolHash(t); return b.hash != null && b.hash !== '' && isPoolHash(b.hash); };
  const navStrip = (c, log, id) => {
    if (!c || typeof c !== 'object' || Array.isArray(c) || !(c.buttons || Array.isArray(c.bar) || Array.isArray(c.more))) return c;
    const out = { ...c }, gone = new Set(['basseng']);
    if (out.buttons && typeof out.buttons === 'object') {
      const B = { ...out.buttons };
      Object.keys(B).forEach((k) => { if (k === 'basseng' || (B[k] && B[k].custom && btnPool(B[k]))) { delete B[k]; gone.add(k); log.push(`navbar-knappen «${k}» fjernet (${id})`); } });
      out.buttons = B;
    }
    ['bar', 'more', 'hidden'].forEach((k) => { if (Array.isArray(out[k]) && out[k].some((x) => gone.has(x))) { out[k] = out[k].filter((x) => !gone.has(x)); log.push(`navbar ${k}: basseng fjernet (${id})`); } });
    return out;
  };
  M.bassengMigrateStore = function (hass) {
    if (M._poolStoreMig || !M.store || !M.store.loaded || typeof M.store.get !== 'function') return false;
    M._poolStoreMig = true;
    if (M.store.get(MIG_KEY)) return false;
    const log = [];
    // 1 · custom_popups
    const CP = M.store.get('custom_popups');
    if (Array.isArray(CP)) {
      const keep = CP.filter((e) => { const cfg = cfgOf(e); if (!M.bassengIsPoolPopup(cfg)) return true; log.push('custom_popups ' + (hashN(cfg) || '?') + ' fjernet'); return false; });
      if (keep.length !== CP.length) M.store.set('custom_popups', keep);
    }
    // 2 · popup_overrides · 3 · popups.<key>
    [['popup_overrides', 'popup_overrides'], ['popups', 'popups']].forEach(([key, lbl]) => {
      const O = M.store.get(key);
      if (!O || typeof O !== 'object') return;
      const n = { ...O };
      let ch = false;
      Object.keys(O).forEach((k) => { if (isPoolHash(k)) { delete n[k]; ch = true; log.push(lbl + '.' + k + ' fjernet'); } });
      if (ch) M.store.set(key, n);
    });
    // 4 · navbar-knapper · 5 · lenker i kortconfigene
    const CD = M.store.get('cards');
    if (CD && typeof CD === 'object') {
      let ch = false;
      const n = {};
      Object.keys(CD).forEach((id) => { const v = navStrip(CD[id], log, id); if (v !== CD[id]) ch = true; n[id] = v; });
      const r = stripLinks(n);
      if (r.n) log.push(r.n + ' lenke(r) til #basseng/#badebasseng fjernet i kortconfigene');
      if (ch || r.n) M.store.set('cards', r.v);
    }
    M.store.set(MIG_KEY, { at: new Date().toISOString(), log }, { immediate: true });
    console.info('[ki-msh] Basseng-popupene er slettet – migrering kjørt én gang:', log.length ? log.join(' · ') : 'ingenting å endre');
    // 6 · gamle Lovelace-ressurser (bare admin)
    if (hass && hass.user && hass.user.is_admin && hass.callWS) {
      hass.callWS({ type: 'lovelace/resources' }).then((list) => Promise.all((Array.isArray(list) ? list : []).filter((r) => r && OLD_FILE_RX.test(String(r.url || '').split('#')[0])).map((r) => hass.callWS({ type: 'lovelace/resources/delete', resource_id: r.id }).then(() => console.info('[ki-msh] Basseng: Lovelace-ressursen', r.url, 'er slettet (gammelt kort)')))))
        .catch((e) => console.warn('[ki-msh] Basseng: kunne ikke rydde Lovelace-ressursene (YAML-modus?)', e && (e.message || e.code)));
    }
    return true;
  };
  // Service worker-/Cache Storage: fjern de gamle filene (ki-basseng-card.js, ki-basseng-hero-card.js) fra alle cacher.
  M.bassengClearCache = function () {
    try {
      if (!window.caches || !caches.keys) return Promise.resolve(0);
      return caches.keys().then((ks) => Promise.all(ks.map((k) => caches.open(k).then((c) => c.keys().then((reqs) => Promise.all(reqs.filter((r) => OLD_FILE_RX.test(new URL(r.url).pathname)).map((r) => c.delete(r))))))))
        .then((a) => { const n = a.flat().filter(Boolean).length; if (n) console.info('[ki-msh] Basseng: ' + n + ' gamle filer fjernet fra service worker-cachen'); return n; })
        .catch(() => 0);
    } catch (e) { return Promise.resolve(0); }
  };

  /* Fiks 30.1 · alias-elementer for gammel config: `type: custom:ki-basseng-card` / `custom:ki-basseng-hero-card` rendrer
   * msh-basseng-card med samme config (+ én advarsel i konsollen). Hero-aliaset rendrer ingenting når det står i samme
   * popup som et bassengkort. Defineres bare hvis taggen ikke finnes, og litt etter oppstart, så en gammel ki-cards-ressurs
   * som fortsatt lastes ikke krasjer (HA tegner kortet på nytt når elementet blir definert). */
  const warned = new Set();
  const deepFind = (root, self, d = 0) => {
    if (!root || d > 10 || !root.querySelectorAll) return false;
    for (const e of root.querySelectorAll('*')) {
      if (e !== self && !self.contains(e) && ['msh-basseng-card', 'ki-basseng-card'].includes(e.localName) && !(e.parentNode && e.parentNode.host === self)) return true;
      if (e.shadowRoot && e !== self && deepFind(e.shadowRoot, self, d + 1)) return true;
    }
    return false;
  };
  const popupOfEl = (el) => { let n = el; for (let i = 0; i < 60 && n; i++) { if (n.localName === 'bubble-card' || (n.classList && n.classList.contains('bubble-pop-up-container'))) return n; n = n.parentNode || n.host; } return null; };
  // samme popup = nærmeste Bubble-popup over elementet; uten popup (vanlig visning): kortene i samme stack/rot
  M.bassengHeroBeside = (el) => { const p = popupOfEl(el); if (p) return deepFind(p, el) || deepFind(p.shadowRoot, el); const r = el.getRootNode && el.getRootNode(); return !!r && r !== document && deepFind(r, el); };
  const aliasClass = (tag, hero) => class extends HTMLElement {
    static getStubConfig() { return { card_id: 'pop-basseng' }; }
    setConfig(c) {
      this._cfg = { ...(c || {}), type: 'custom:msh-basseng-card' };
      if (!warned.has(tag)) { warned.add(tag); console.warn(`[ki-msh] «custom:${tag}» er utgått – rendres som msh-basseng-card${hero ? ' (ingenting hvis popupen allerede har et bassengkort)' : ''}. Bytt til «type: custom:msh-basseng-card» i popupen.`); }
      if (this._inner) this._inner.setConfig(this._cfg);
      else if (this.isConnected) this._mount();
    }
    set hass(h) { this._hass = h; if (this._inner) this._inner.hass = h; }
    get hass() { return this._hass; }
    connectedCallback() { this.style.display = 'block'; this._mount(); }
    getCardSize() { return this._inner && this._inner.getCardSize ? this._inner.getCardSize() : hero ? 0 : 10; }
    getGridOptions() { return { columns: 'full' }; }
    _mount() {
      if (!this._cfg || this._inner) return;
      const make = () => {
        if (this._inner || !this.isConnected) return;
        const el = document.createElement('msh-basseng-card');
        try { el.setConfig(this._cfg); } catch (e) { console.warn('[ki-msh]', tag, e); return; }
        if (this._hass) el.hass = this._hass;
        this._inner = el;
        this.appendChild(el);
      };
      if (!hero) return make();
      // hero: vent til nabokortene er tegnet; står et bassengkort i samme popup → ingenting
      this.style.display = 'none';
      clearTimeout(this._t);
      const check = (n) => {
        if (!this.isConnected) return;
        if (M.bassengHeroBeside(this)) { this._beside = true; if (this._inner) { this._inner.remove(); this._inner = null; } return; }
        if (n > 0) { this._t = setTimeout(() => check(n - 1), 250); return; }
        this._beside = false; this.style.display = 'block'; make();
      };
      this._t = setTimeout(() => check(3), 0);
    }
    disconnectedCallback() { clearTimeout(this._t); }
  };
  M.bassengDefineAliases = function () {
    [['ki-basseng-card', false], ['ki-basseng-hero-card', true]].forEach(([tag, hero]) => {
      if (customElements.get(tag)) return;
      try { customElements.define(tag, aliasClass(tag, hero)); } catch (e) { /* definert av en annen ressurs i mellomtiden */ }
    });
  };

  if (!window.__mshPoolHash) {
    window.__mshPoolHash = true;
    setTimeout(() => M.bassengDefineAliases(), 1500);
    setTimeout(() => M.bassengClearCache(), 3000);
  }
})();
