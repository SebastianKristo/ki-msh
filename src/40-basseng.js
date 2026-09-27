/* Basseng-popup (#basseng). Kilde: Basseng v3.dc.html.
 *   msh-basseng-hero-card – hero med apparat-animasjoner (bølger, bobler, pumpe, varmepumpe, tak, lys)
 *   msh-basseng-card      – kontroller, glass-faner (Oversikt · Varme · Klor · Spreder) og innholdet i hver fane
 * Autokonfig: entiteter i område «Basseng»/«pool» (M.findArea) – temperatur, pumpe, varmepumpe, tak, lys,
 * spreder, pH/klor, effekt, modus-select, brytere. Klorlogg i calendar.* (klor/basseng/pool), personer = person.*.
 * Alt kan overstyres: overrides.<felt>, exclude, include.flagg / include.personer.
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

  /* ------------------------------------------------------------ autokonfig */
  const DOMS = ['sensor', 'switch', 'input_boolean', 'fan', 'climate', 'water_heater', 'cover', 'binary_sensor', 'light', 'valve', 'select', 'input_select', 'number', 'input_number'];
  M.poolArea = (hass, cfg) => (cfg && cfg.area) || M.findArea(hass, 'basseng', 'pool', 'svommebasseng');
  M.poolAuto = function (hass, cfg) {
    const area = M.poolArea(hass, cfg), o = { area };
    if (!hass) return o;
    const ids = area ? M.all(hass, DOMS, (s, id) => M.areaOf(hass, id) === area) : [];
    const T = (id) => M.txt(hass, id), dc = (id) => hass.states[id].attributes.device_class;
    const f = (doms, re, not) => ids.find((id) => doms.includes(id.split('.')[0]) && (!re || re.test(T(id))) && (!not || !not.test(T(id)))) || null;
    const sens = ids.filter((id) => id.startsWith('sensor.'));
    const temps = sens.filter((id) => dc(id) === 'temperature');
    const OUT = /(^|[_ .])ute|outdoor|outside|luft|(^|[_ .])air/;
    o.water = temps.find((id) => !OUT.test(T(id)) && /vann|water|basseng|pool/.test(T(id))) || temps.find((id) => !OUT.test(T(id))) || null;
    o.ute = temps.find((id) => OUT.test(T(id))) || M.all(hass, 'weather')[0] || null;
    o.pump = f(['switch', 'input_boolean', 'fan'], /pump|filter|sirkul/, /varme|heat/);
    o.heat = f(['climate']) || f(['water_heater']) || f(['switch', 'input_boolean'], /varme|heat/);
    o.cover = f(['cover']) || f(['switch', 'input_boolean', 'binary_sensor'], /tak|cover|lokk|presenning/);
    o.light = f(['light']) || f(['switch'], /(^|[_ .])lys|light|led/);
    o.spr = f(['switch', 'valve', 'input_boolean'], /spreder|sprinkler|fontene|fountain|dusj/);
    const pw = sens.filter((id) => dc(id) === 'power');
    o.power = pw.find((id) => /pump/.test(T(id)) && !/varme|heat/.test(T(id))) || pw.find((id) => !/varme|heat/.test(T(id))) || null;
    o.heat_power = pw.find((id) => /varme|heat/.test(T(id))) || null;
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
    o.klor_calendar = M.all(hass, 'calendar', (s, id) => /klor|chlor/.test(M.txt(hass, id)))[0] || M.all(hass, 'calendar', (s, id) => /basseng|pool/.test(M.txt(hass, id)))[0] || null;
    o.flags = [o.auto, o.price, o.prio].filter(Boolean);
    o.people = M.all(hass, 'person');
    return o;
  };
  // Endelig oppsett: overrides vinner, exclude fjerner auto-valg.
  M.poolEnts = function (hass, cfg) {
    const a = M.poolAuto(hass, cfg), ex = new Set((cfg && cfg.exclude) || []), e = { area: a.area, auto: a };
    Object.keys(a).forEach((k) => { if (k === 'area' || Array.isArray(a[k])) return; e[k] = M.pick(cfg, k, a[k] && !ex.has(a[k]) ? a[k] : null); });
    e.flags = M.applyLists(cfg, 'flagg', a.flags || []);
    e.people = M.applyLists(cfg, 'personer', a.people || []);
    return e;
  };
  const OVR = [
    ['water', 'Vanntemperatur', 'sensor', 'temperature'], ['ute', 'Utetemperatur', ['sensor', 'weather']], ['pump', 'Pumpe', ['switch', 'input_boolean', 'fan']], ['heat', 'Varmepumpe', ['climate', 'water_heater', 'switch', 'input_boolean']],
    ['cover', 'Pooltak', ['cover', 'switch', 'input_boolean', 'binary_sensor']], ['light', 'Lys', ['light', 'switch']], ['spr', 'Spreder', ['switch', 'valve', 'input_boolean']], ['power', 'Effekt · pumpe', 'sensor', 'power'],
    ['heat_power', 'Effekt · varmepumpe', 'sensor', 'power'], ['ph', 'pH', 'sensor'], ['klor', 'Klor (mg/L / ORP)', 'sensor'], ['target', 'Måltemperatur', ['climate', 'water_heater', 'number', 'input_number']],
    ['turnover', 'Omsetninger i dag', 'sensor'], ['pumped', 'Pumpet i dag (timer)', 'sensor'], ['savings', 'Spart i dag', 'sensor'], ['cost', 'Strømkostnad i dag', 'sensor'],
    ['mode', 'Driftsmodus', ['select', 'input_select']], ['night', 'Nattsenking', ['switch', 'input_boolean']], ['winter', 'Vintermodus', ['switch', 'input_boolean']], ['heat_loss', 'Varmetap', 'sensor'],
    ['solar', 'Sol inn', 'sensor'], ['spr_duration', 'Spreder · varighet', ['number', 'input_number']], ['klor_calendar', 'Klorkalender (logg)', 'calendar'],
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
      const c = this.config, e = M.poolEnts(this.hass, c), A = c.anim !== false;
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
            <span class="lbl">${esc(c.name || 'Bassenget')}</span>
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
  M.define('msh-basseng-hero-card', BassengHero, 'MSH Basseng · hero', 'Basseng-hero med vanntemperatur, status og animert pumpe/varmepumpe/tak/lys. Første kort i #basseng.');

  /* ============================================================ HOVEDKORT */
  const CTL = { light: ['lightbulb', 'Lys', C.gray1000], pump: ['water_pump', 'Pumpe', C.accent], heat: ['heat', 'Varme', C.red], cover: ['roofing', 'Pooltak', C.blue], spr: ['sprinkler', 'Spreder', C.green] };
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

  class Basseng extends M.Card {
    static get cardName() { return 'Basseng'; }
    static get defaults() { return { controls: ['light', 'pump', 'heat', 'cover', 'spr'], tabs: ['ov', 'heat', 'klor', 'spr'] }; }
    static get schema() {
      return [
        AREA_F,
        { type: 'overrides', label: 'Entiteter', fields: ovrFields() },
        { type: 'lists', label: 'Brytere og navn', lists: (h, c) => { const a = M.poolAuto(h, c); return [{ key: 'flagg', label: 'Brytere (Oversikt)', ids: a.flags, domains: ['switch', 'input_boolean'] }, { key: 'personer', label: 'Navn i klorloggen', ids: a.people, domains: ['person'] }]; } },
        { type: 'order', name: 'controls', hiddenName: 'hidden_controls', label: 'Kontroller', options: Object.keys(CTL).map((k) => [k, CTL[k][1]]) },
        { type: 'order', name: 'tabs', hiddenName: 'hidden_tabs', label: 'Faner', options: Object.keys(TABS).map((k) => [k, TABS[k]]) },
        { type: 'section', id: 'styr', label: 'Styring og verdier', icon: 'mdi:tune', fields: CFG.flatMap(([, title, rows]) => [{ type: 'info', label: title.toUpperCase() }].concat(rows.map(([k, l, sub, v]) => (typeof v === 'boolean' ? { type: 'boolean', name: 'vals.' + k, label: l, help: sub, default: v } : { type: 'text', name: 'vals.' + k, label: l, help: sub, placeholder: String(v) })))) },
        { type: 'section', label: 'Visning', icon: 'mdi:eye-outline', fields: [{ type: 'boolean', name: 'toasts', label: 'Bekreftelsesmeldinger', default: true }, { type: 'gap' }] },
      ];
    }
    get cardSize() { return 10; }
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
    _tabs() {
      const c = this.config, hid = new Set(c.hidden_tabs || []);
      const order = (Array.isArray(c.tabs) ? c.tabs : []).filter((k) => TABS[k]);
      Object.keys(TABS).forEach((k) => { if (!order.includes(k)) order.push(k); });
      return order.filter((k) => !hid.has(k));
    }
    _ctls() {
      const c = this.config, hid = new Set(c.hidden_controls || []);
      const order = (Array.isArray(c.controls) ? c.controls : []).filter((k) => CTL[k]);
      Object.keys(CTL).forEach((k) => { if (!order.includes(k)) order.push(k); });
      return order.filter((k) => !hid.has(k));
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
      const tl = this._tabs(), cur = tl.includes(this.ui.tab) ? this.ui.tab : tl[0] || 'ov';
      this._tl = tl; this._cur = cur;
      const cl = this._ctls();
      const ctrls = cl.map((k) => {
        const [ic, l, bg] = CTL[k], id = e[k], st = this.s(id), on = M.onState(st);
        return `<button class="tile press" data-key="${k}" data-act="ctl" data-k="${k}" ${id ? `data-ent="${esc(id)}"` : ''} title="${esc(l)}" style="background:${on ? bg : C.card};color:${on ? '#3a3a3a' : '#fafafa'};${id ? '' : 'opacity:.55'}">${M.icon(ic, 24)}</button>`;
      }).join('');
      const idx = Math.max(0, tl.indexOf(cur)), n = tl.length || 1;
      const tabs = tl.map((k, i) => `<span class="gti" role="tab" aria-selected="${i === idx}" data-key="${k}" style="color:${i === idx ? '#3a3a3a' : '#afafaf'}">${esc(TABS[k])}</span>`).join('');
      const body = cur === 'heat' ? this._heat(e) : cur === 'klor' ? this._klorTab(e) : cur === 'spr' ? this._spr(e) : this._ov(e);
      return `<div class="wrap">
        ${cl.length ? `<div class="ctl" style="grid-template-columns:repeat(${cl.length},minmax(0,1fr))">${ctrls}</div>` : ''}
        <div class="tabrow">
          ${tl.length ? `<div class="gt"><div class="gtg" style="grid-template-columns:repeat(${n},minmax(64px,1fr))"><span class="ind" style="left:${(idx / n) * 100}%;width:${100 / n}%"></span>${tabs}</div></div>` : ''}
          <button class="cfg press" data-act="customize" title="Tilpass">${M.icon('settings', 20)}</button>
        </div>
        ${tl.length ? body : M.emptyState('Alle faner er skjult', 'sections')}
      </div>`;
    }
    /* ---------------- Oversikt */
    _ov(e) {
      const c = this.config, tw = this.n(e.water), tgt = this._target(e), pumpS = this.s(e.pump), pump = M.onState(pumpS);
      const val = (id, d = 1) => { const v = this.n(id); return v != null ? M.nf(v, d) : '–'; };
      const unit = (id, u) => { const s = this.s(id); return (s && s.attributes.unit_of_measurement) || u; };
      const cards = [['water', 'Vann', tw != null ? M.nf(tw, 1) : '–', '°C', e.water]];
      if (e.savings) cards.push(['savings', 'Spart i dag', val(e.savings, 0), unit(e.savings, 'kr'), e.savings]);
      else cards.push(['bolt', 'Effekt nå', val(e.power, 0), unit(e.power, 'W'), e.power]);
      if (e.ph) cards.push(['science', 'pH', val(e.ph, 1), '', e.ph]);
      if (e.klor) cards.push(['pill', 'Klor', val(e.klor, 1), unit(e.klor, ''), e.klor]);
      const ovCards = cards.map(([ic, l, v, u, id]) => `<div class="kc" data-key="${l}" ${id ? `data-ent="${esc(id)}"` : ''}><span class="kci">${M.icon(ic, 24)}</span><span class="grow"></span><span class="kcl">${esc(l)}</span><span class="kcv num">${esc(v)}<span class="kcu"> ${esc(u)}</span></span></div>`).join('');
      // prosa
      let rel = '';
      if (tw != null && tgt != null) { const d = tw - tgt; rel = Math.abs(d) <= 0.3 ? ' og på målet' : d < 0 ? ` og ${M.nf(-d, 1)}° under målet` : ` og ${M.nf(d, 1)}° over målet`; }
      const prose = tw != null
        ? `Vannet er <span class="pill num">${M.nf(tw, 1)}°</span>${rel}. ${pumpS ? (pump ? 'Pumpa går nå.' : 'Pumpa står.') : ''}`
        : `Vanntemperaturen er ukjent. <button class="lnk" data-act="customize" data-section="overrides">Velg sensor</button>`;
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
      return `
        <div class="g2">${ovCards}</div>
        <div class="prose">${prose}</div>
        <div class="dh">${M.icon('home', 20)}<span class="dht">I dag</span><span class="dhd">${esc(date)}</span></div>
        <div class="today">${today}</div>
        ${modes}
        ${flags.length ? `<div class="g2">${flags.join('')}</div>` : ''}`;
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
      // graf
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
    _lastKlor() { const L = this._klorEvents().filter((ev) => ev.t0 <= Date.now()); return L[L.length - 1] || null; }
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
        const id = e[d.k];
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
        gt.addEventListener('pointermove', (ev) => { if (!drag) return; ev.preventDefault(); drag.x = xOf(ev); if (!drag.on && Math.abs(ev.clientX - drag.cx) < 8) return; drag.on = true; paint(drag.x); });
        const up = (ev, cancel) => {
          if (!drag) return;
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
      this.shadowRoot.querySelectorAll('.hs').forEach((el) => M.guardScroll(el));
    }
    get styles() {
      return (M.STEPPER_CSS || '') + `
        .stpc{border-radius:24px;background:${C.card}}
        .wrap{display:flex;flex-direction:column;gap:var(--msh-gap,10px)}
        .ctl{display:grid;gap:8px}
        .tile{height:64px;border-radius:22px;display:grid;place-items:center;transition:background .2s,color .2s}
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
  M.define('msh-basseng-card', Basseng, 'MSH Basseng', 'Basseng-popup: kontroller, faner (Oversikt, Varme, Klor, Spreder), klorlogg og spreder. Legg under msh-basseng-hero-card i #basseng.');
})();
