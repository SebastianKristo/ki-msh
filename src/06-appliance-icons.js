/* KI MSH · hvitevare-ikoner med animerte deler (felles for alle kort)
 * MSH.renderApplianceIcon(type, running, opts) → inline <svg viewBox="0 0 24 24"> i currentColor med navngitte deler
 *   opts: { phase ('spin'|'dry'|'wash'|'rinse'|'boil'|'heat'|'open'…), done (nettopp ferdig → ferdig-animasjon + hake 2 s),
 *           level ('full'|'calm'|'off'), pct (vifte: 0–100 → 2–0,4 s per omdreining), size (px, standard 24), style }
 * MSH.APPLIANCE_CSS  – stilene; kortene har shadow DOM og tar dem med i `styles`.
 * MSH.applianceType(entityId, stateObj, hass) → 'washer'|'dryer'|'dishwasher'|'kettle'|'coffee'|'microwave'|'oven'|
 *   'vacuum'|'fan'|'fridge'|null (ikon → navn/enhet → domene/device_class).
 * MSH.applianceStatus(hass, entityId, cfg) → { running, phase, done, finished, paused, status, power, watts, pct, deps, source }
 *   Kilde: sensor.*_status/_program/_fase for samme HA-enhet (hass.entities → device_id) eller samme objekt-id-prefiks,
 *   ellers effekt (sensor.*_power > cfg.run_threshold_w, standard 5 W). cfg.card (MSH.Card) registrerer avhengighetene.
 * MSH.APPLIANCES[type] = { name, verb, color, icon } – typefarger fra designet. Nye typer legges til her (SVG + CSS).
 * Regler: bare deler animeres (transform/opacity/clip-path), transform-box: fill-box, prefers-reduced-motion → statisk.
 * Nivå «calm» = halv amplitude og halv fart (CSS-variablene --ma-k og --ma-t).
 */
(function () {
  const M = window.MSH;
  if (!M || M.renderApplianceIcon) return;

  M.APPLIANCES = {
    washer: { name: 'Vaskemaskin', verb: 'Vasker', color: 'rgb(115 185 242)', icon: 'mdi:washing-machine' },
    dryer: { name: 'Tørketrommel', verb: 'Tørker', color: 'rgb(242 181 115)', icon: 'mdi:tumble-dryer' },
    dishwasher: { name: 'Oppvaskmaskin', verb: 'Vasker opp', color: 'rgb(102 209 158)', icon: 'mdi:dishwasher' },
    kettle: { name: 'Vannkoker', verb: 'Koker vann', color: 'rgb(242 128 115)', icon: 'mdi:kettle' },
    coffee: { name: 'Kaffemaskin', verb: 'Trakter kaffe', color: '#c8a27a', icon: 'mdi:coffee-maker' },
    microwave: { name: 'Mikrobølgeovn', verb: 'Varmer', color: 'rgb(242 210 111)', icon: 'mdi:microwave' },
    oven: { name: 'Stekeovn', verb: 'Steker', color: 'rgb(242 181 115)', icon: 'mdi:stove' },
    vacuum: { name: 'Robotstøvsuger', verb: 'Rengjør', color: 'rgb(102 209 158)', icon: 'mdi:robot-vacuum' },
    fan: { name: 'Vifte', verb: 'Går', color: 'rgb(200 221 250)', icon: 'mdi:fan' },
    fridge: { name: 'Kjøleskap', verb: 'Kjøler', color: 'rgb(200 221 250)', icon: 'mdi:fridge' },
  };

  /* ------------------------------------------------------------ type (autokonfig) */
  // Ikon først (brukerens eget valg), så navn/enhet, så domene. Designfilenes Material Symbols-navn er med.
  const BY_ICON = [
    [/dishwasher/, 'dishwasher'], [/tumble-dryer|dry_cleaning/, 'dryer'], [/washing-machine|local_laundry_service/, 'washer'],
    [/kettle|emoji_food_beverage/, 'kettle'], [/coffee/, 'coffee'], [/microwave/, 'microwave'], [/stove|toaster-oven|oven/, 'oven'],
    [/robot-vacuum|robot_2|vacuum/, 'vacuum'], [/fridge|kitchen|severe_cold|snowflake/, 'fridge'], [/(^|:)fan($|-)|mode_fan|air-conditioner|heat-pump|hvac/, 'fan'],
  ];
  const BY_NAME = [
    [/oppvask|dish.?wash/, 'dishwasher'], [/t[øo]rketrommel|t[øo]rkeskap|tumble|dryer/, 'dryer'], [/vaskemaskin|washing.?machine|washer|laundry/, 'washer'],
    [/vannkoker|kettle|\bboil/, 'kettle'], [/kaffe|coffee|espresso|barista/, 'coffee'], [/mikro|microwave/, 'microwave'],
    [/stekeovn|komfyr|\bovn\b|\boven\b|\bstove\b/, 'oven'], [/st[øo]vsuger|robot.?vac|vacuum|roborock|roomba|deebot|dreame/, 'vacuum'],
    [/kj[øo]leskap|kj[øo]l\b|fryser?\b|fridge|freezer|refrigerator/, 'fridge'], [/vifte|\bfan\b|varmepumpe|heat.?pump|ventilat/, 'fan'],
  ];
  const obj = (id) => String(id || '').split('.').slice(1).join('.');
  M.applianceType = function (entityId, stateObj, hass) {
    const id = String(entityId || ''), dom = id.split('.')[0];
    const s = stateObj || (hass && hass.states && hass.states[id]) || null, a = (s && s.attributes) || {};
    const reg = (hass && hass.entities && hass.entities[id]) || {};
    const dev = reg.device_id && hass.devices ? hass.devices[reg.device_id] : null;
    const icon = String(a.icon || reg.icon || reg.original_icon || '').toLowerCase();
    if (icon) { const hit = BY_ICON.find((x) => x[0].test(icon)); if (hit) return hit[1]; }
    if (dom === 'vacuum') return 'vacuum';
    const txt = [obj(id).replace(/_/g, ' '), a.friendly_name, reg.name, dev && (dev.name_by_user || dev.name), dev && dev.model].filter(Boolean).join(' ').toLowerCase();
    const hit = BY_NAME.find((x) => x[0].test(txt));
    if (hit) return hit[1];
    if (dom === 'fan' || (dom === 'climate' && /fan|vifte/.test(txt))) return 'fan';
    return null;
  };

  /* ------------------------------------------------------------ status/fase */
  const IDLE = /^(off|idle|standby|ready|klar|av|inactive|none|stopped|stoppet|0|false|disconnected|power_?off|unavailable|unknown|inaktiv|venter|waiting)$/;
  const DONE = /finish|done|ferdig|complete|slutt|end$|ended|klar til|t[øo]m|empty/;
  M.appliancePhase = function (txt) {
    const t = String(txt || '').toLowerCase();
    if (/spin|sentrifug|centrifug|slyng/.test(t)) return 'spin';
    if (/t[øo]rk|\bdry|drying/.test(t)) return 'dry';
    if (/skyll|rinse/.test(t)) return 'rinse';
    if (/kok|boil/.test(t)) return 'boil';
    if (/forvask|pre.?wash|soak|bl[øo]t/.test(t)) return 'prewash';
    if (/vask|wash|main|clean/.test(t)) return 'wash';
    if (/varm|heat|warm/.test(t)) return 'heat';
    return '';
  };
  // Nettopp ferdig: overgang kjører → ikke kjører (eller status → ferdig) innen 2 s. Delt mellom kort (per nøkkel).
  const PREV = (M._applPrev = M._applPrev || new Map());
  M.applianceDone = function (key, running, finished) {
    if (!key) return false;
    const now = Date.now(), p = PREV.get(key) || { run: null, fin: null, at: 0 };
    let at = p.at;
    if ((p.run === true && !running) || (p.fin === false && finished)) at = now;
    PREV.set(key, { run: !!running, fin: !!finished, at });
    return !running && at > 0 && now - at < 2000;
  };
  const RX_STATUS = /_(status|state|tilstand|operation_?state|job_?state|run_?state|machine_?state|drift|operating_?status)$/;
  const RX_PROG = /_(program|programme|prog|cycle|syklus|active_program|selected_program)$/;
  const RX_FASE = /_(fase|phase|stage|trinn|program_?phase|progress|cycle_?phase|step)$/;
  const SUFFIX = /_(status|state|tilstand|program|fase|phase|power|effekt|switch|plug|stikk|smart_plug|operation_state|job_state|door|dor|d[øo]r)$/;
  function related(hass, id) {
    const E = hass.entities || {}, e = E[id], out = new Set();
    if (e && e.device_id) Object.keys(E).forEach((k) => { if (k !== id && E[k].device_id === e.device_id) out.add(k); });
    const base = obj(id).replace(SUFFIX, '');
    if (base.length > 2) Object.keys(hass.states).forEach((k) => { if (k !== id && /^(sensor|binary_sensor|select)\./.test(k) && obj(k).startsWith(base + '_')) out.add(k); });
    return [...out].filter((k) => hass.states[k]);
  }
  const txtState = (s) => (s && !M.unavailable(s) && !M.isNum(s.state) ? String(s.state) : '');
  M.applianceStatus = function (hass, entityId, cfg) {
    cfg = cfg || {};
    const out = { running: false, phase: '', done: false, finished: false, paused: false, status: null, power: null, watts: null, pct: null, deps: [], source: null };
    if (!hass || !entityId || !hass.states) return out;
    const read = (id) => { if (!id) return null; out.deps.push(id); if (cfg.card && cfg.card.s) return cfg.card.s(id); return hass.states[id] || null; };
    const self = read(entityId), dom = entityId.split('.')[0];
    const type = cfg.type || M.applianceType(entityId, self, hass);
    const rel = related(hass, entityId);
    const find = (rx, pre) => rel.find((k) => (!pre || pre.test(k)) && rx.test(obj(k)) && !M.isNum(hass.states[k].state));
    // Kjøleskap/fryser: «kjører» = døren er åpen
    if (type === 'fridge') {
      const isDoor = (k) => /^binary_sensor\./.test(k) && ['door', 'opening'].includes((hass.states[k].attributes || {}).device_class);
      const door = cfg.door || (isDoor(entityId) ? entityId : rel.find(isDoor));
      const d = read(door);
      if (d) { out.source = 'door'; out.running = d.state === 'on'; out.phase = out.running ? 'open' : ''; }
      out.done = false;
      return out;
    }
    if (dom === 'vacuum' && self) {
      out.source = 'state'; out.running = self.state === 'cleaning'; out.paused = self.state === 'paused';
      out.finished = self.state === 'returning'; out.phase = self.state === 'cleaning' ? 'clean' : '';
    } else if (dom === 'fan' && self) {
      out.source = 'state'; out.running = self.state === 'on';
      const p = Number(self.attributes && self.attributes.percentage);
      out.pct = isNaN(p) ? null : p;
    } else {
      const statusId = cfg.status_entity || (dom === 'sensor' && txtState(self) ? entityId : null) || find(RX_STATUS, /^sensor\./) || find(RX_STATUS, /^select\./);
      const progId = cfg.program_entity || find(RX_PROG);
      const faseId = cfg.phase_entity || find(RX_FASE);
      const st = read(statusId), pr = read(progId), fa = read(faseId);
      const sTxt = txtState(st).toLowerCase(), fTxt = txtState(fa).toLowerCase(), pTxt = txtState(pr).toLowerCase();
      const powerId = cfg.power || rel.find((k) => /^sensor\./.test(k) && ((hass.states[k].attributes || {}).device_class === 'power' || /^k?W$/.test((hass.states[k].attributes || {}).unit_of_measurement || '')))
        || (hass.states[`sensor.${obj(entityId).replace(SUFFIX, '')}_power`] ? `sensor.${obj(entityId).replace(SUFFIX, '')}_power` : null);
      const pw = read(powerId);
      if (pw && M.isNum(pw.state)) { let w = Number(pw.state); if (/^kW$/i.test(pw.attributes.unit_of_measurement || '')) w *= 1000; out.watts = w; out.power = powerId; }
      const thr = cfg.run_threshold_w != null && cfg.run_threshold_w !== '' ? Number(cfg.run_threshold_w) : 5;
      const main = sTxt || fTxt;
      if (main) {
        out.source = 'status'; out.status = statusId || faseId;
        if (/pause/.test(main)) out.paused = true;
        else if (DONE.test(main)) out.finished = true;
        else if (!IDLE.test(main)) out.running = true;
        // status sier «av» men maskinen trekker effekt → kjører
        if (!out.running && !out.paused && !out.finished && out.watts != null && out.watts > thr) out.running = true;
      } else if (out.watts != null) {
        out.source = 'power'; out.running = out.watts > thr;
      } else {
        const run = rel.find((k) => /^binary_sensor\./.test(k) && (hass.states[k].attributes || {}).device_class === 'running');
        const r = read(run);
        if (r) { out.source = 'running'; out.running = r.state === 'on'; }
        else if (dom === 'binary_sensor' && self) { out.source = 'state'; out.running = self.state === 'on'; }
      }
      if (out.running) out.phase = M.appliancePhase(fTxt) || M.appliancePhase(sTxt) || M.appliancePhase(pTxt);
      else if (out.finished) out.phase = 'done';
    }
    out.done = M.applianceDone(entityId, out.running, out.finished);
    return out;
  };

  /* ------------------------------------------------------------ SVG per type */
  // Alle deler med animasjon har klassen «p» (transform-box: fill-box). Stil: strek 1,7 i currentColor, «f» = fylt.
  const BADGE = '<g class="p ma-badge"><circle class="f" cx="18.6" cy="18.6" r="4.9"/><path d="M16.5 18.7l1.5 1.5 2.8-3" style="stroke:var(--ma-check,#fafafa)" stroke-width="1.6"/></g>';
  const STEAM2 = (x1, x2, y) => `<path class="p ma-steam ma-s1" d="M${x1} ${y}q-.9-.8 0-1.6t0-1.6"/><path class="p ma-steam ma-s2" d="M${x2} ${y}q-.9-.8 0-1.6t0-1.6"/>`;
  const SVG = {
    washer: () => `<g class="p ma-body"><rect x="3.2" y="2.2" width="17.6" height="19.6" rx="3"/><path d="M3.2 6.6h17.6"/><circle class="f" cx="6.4" cy="4.4" r=".85"/><circle class="f" cx="9.2" cy="4.4" r=".85"/><circle cx="12" cy="14.2" r="5.3"/>
      <g class="p ma-drum"><circle cx="12" cy="14.2" r="3.5" stroke-width="1.1" stroke-dasharray="1.6 1.2"/><circle class="f" cx="12" cy="11.4" r="1"/><circle class="f" cx="12" cy="17" r="1"/></g></g>`,
    dryer: () => `<g class="ma-heatw">${[8, 12, 16].map((x, i) => `<path class="p ma-hw ma-h${i + 1}" d="M${x} 4.4q-.8-.7 0-1.4t0-1.4"/>`).join('')}</g>
      <g class="p ma-body"><rect x="3.2" y="5.6" width="17.6" height="16.2" rx="3"/><path d="M3.2 9.2h17.6"/><circle class="f" cx="6.4" cy="7.4" r=".8"/><circle cx="12" cy="15.4" r="4.9"/>
      <g class="p ma-drum"><circle cx="12" cy="15.4" r="3.7" stroke-width="1" stroke-dasharray="1.4 1.3"/></g>
      <rect class="p f ma-c ma-c1" x="9.4" y="15.6" width="2.4" height="1.6" rx=".6"/><rect class="p f ma-c ma-c2" x="12.5" y="15.9" width="2.2" height="1.5" rx=".6"/><rect class="p f ma-c ma-c3" x="11" y="13" width="2" height="1.4" rx=".6"/></g>`,
    dishwasher: () => `${STEAM2(9.5, 14.5, 4)}<g class="p ma-body"><rect x="3.2" y="4.6" width="17.6" height="17.2" rx="3"/><path d="M3.2 8.6h17.6"/><circle class="f" cx="6.4" cy="6.6" r=".8"/><path d="M13.5 6.6h4"/>
      <rect class="ma-door" x="6" y="10.8" width="12" height="8.6" rx="1.6"/>
      ${[9, 12, 15].map((x, i) => `<path class="p f ma-drop ma-d${i + 1}" d="M${x} 13.3c.8 1 1.15 1.6 1.15 2.05a1.15 1.15 0 0 1-2.3 0c0-.45.35-1.05 1.15-2.05z"/>`).join('')}</g>`,
    kettle: () => `${STEAM2(9.8, 13.2, 5.6)}<g class="p ma-body"><path d="M6.2 20.6L7.6 10.4h7.8l1.4 10.2z"/><path d="M15.2 11.8h1.3a2.3 2.3 0 0 1 2.3 2.3v1.6a2.3 2.3 0 0 1-2.3 2.3h-.6"/><path d="M7.6 12L4.8 10"/><path d="M5 21.4h13"/></g>
      <g class="p ma-lid"><path d="M7.4 9.1h8.2"/><rect class="f" x="10.6" y="6.9" width="1.8" height="1.6" rx=".6"/></g>`,
    coffee: () => `<g class="p ma-body"><rect x="3.4" y="2.6" width="17" height="4.6" rx="1.4"/><path d="M4.6 7.2v13.2"/><path d="M3.4 21h17"/><rect class="f" x="12.6" y="7.2" width="3.4" height="1.4" rx=".4"/></g>
      <path class="p ma-stream" d="M14.3 9.2v5.4" stroke-width="1.2"/>
      <g class="ma-cupg"><path class="ma-cup" d="M10.4 14.8h7.8v2.6a2.6 2.6 0 0 1-2.6 2.6h-2.6a2.6 2.6 0 0 1-2.6-2.6z"/><path d="M18.2 15.6h.6a1.3 1.3 0 0 1 0 2.6h-.6"/>
      <path class="p f ma-fill" d="M11.2 15.6h6.2v1.8a1.9 1.9 0 0 1-1.9 1.9h-2.4a1.9 1.9 0 0 1-1.9-1.9z"/></g>${STEAM2(12.8, 15.8, 13.2)}`,
    microwave: () => `<g class="p ma-body"><rect x="2.2" y="4.6" width="19.6" height="14.8" rx="2.4"/><path d="M4.6 21v-1.6M19.4 21v-1.6"/>
      <rect class="ma-win" x="4.6" y="7" width="10.8" height="10" rx="1.2"/><rect class="p ma-glow" x="5.4" y="7.8" width="9.2" height="8.4" rx=".8"/>
      <g class="p ma-plate"><ellipse cx="10" cy="14.6" rx="3.4" ry="1" stroke-width="1.2"/><rect class="f" x="10.6" y="12.3" width="2" height="1.6" rx=".5"/></g>
      <circle class="p f ma-light" cx="18.6" cy="8.4" r="1"/><path d="M17.6 11.6h2M17.6 14h2"/></g>`,
    oven: () => `<g class="p ma-body"><rect x="3.2" y="2.2" width="17.6" height="19.6" rx="2.6"/><path d="M3.2 6.6h17.6"/>${[6.4, 9.4, 14.6, 17.6].map((x) => `<circle class="f" cx="${x}" cy="4.4" r=".8"/>`).join('')}
      <rect class="ma-win" x="6" y="9.4" width="12" height="9.4" rx="1.4"/>
      ${[9.4, 12, 14.6].map((x, i) => `<path class="p ma-hw ma-h${i + 1}" d="M${x} 14.6q-.7-.6 0-1.2t0-1.2" stroke-width="1.1"/>`).join('')}
      <path class="p ma-heat" d="M7.6 17.2l1.1-.9 1.1.9 1.1-.9 1.1.9 1.1-.9 1.1.9 1.1-.9 1.1.9" stroke-width="1.2"/></g>`,
    vacuum: () => `<g class="p ma-body"><circle cx="12" cy="12" r="8.6"/><circle cx="12" cy="10.6" r="2.4"/><path d="M6.6 6.2a8 8 0 0 1 10.8 0" stroke-width="1.1"/><circle class="f" cx="15.6" cy="15.6" r=".8"/>
      <g class="p ma-brush"><path d="M7.4 15.2v3.2M5.8 16.8h3.2M6.3 15.7l2.2 2.2M8.5 15.7l-2.2 2.2" stroke-width="1"/></g></g>`,
    fan: () => `<circle cx="12" cy="12" r="10" stroke-width="1.2"/><g class="p ma-blades">${[0, 120, 240].map((r) => `<path class="f" transform="rotate(${r} 12 12)" d="M12 12c-.4-2.6-.3-5.9 1.7-7 1.6-.9 3.3.4 2.8 2.1-.5 1.9-2.4 3.3-4.5 4.9z"/>`).join('')}<circle cx="12" cy="12" r="1.6" class="f"/><circle cx="12" cy="12" r="7.8" stroke="none" fill="none"/></g>`,
    fridge: () => `<g class="p ma-body"><rect x="5" y="2.2" width="14" height="19.6" rx="2.4"/></g>
      <g class="p ma-door"><rect x="5" y="2.2" width="14" height="19.6" rx="2.4"/><path d="M5 9h14"/><path d="M8 4.6v2.2M8 11.4v3.6"/></g>
      <g class="p ma-snow"><path d="M15.6 12.2v3.6M13.8 14h3.6M14.3 12.7l2.6 2.6M16.9 12.7l-2.6 2.6" stroke-width=".9"/></g>`,
  };

  const LEVEL = { full: '', calm: ' calm', off: ' off' };
  M.renderApplianceIcon = function (type, running, opts) {
    const o = opts || {}, f = SVG[type];
    if (!f) return M.icon((M.APPLIANCES[type] || {}).icon || 'mdi:power-plug', o.size || 24, o.style || '');
    const s = Number(o.size) || 24;
    const lvl = LEVEL[o.level] != null ? LEVEL[o.level] : '';
    const ph = o.phase ? ' ph-' + String(o.phase).replace(/[^a-z]/g, '') : '';
    let vars = '';
    if (type === 'fan') { const p = Number(o.pct); vars = `--ma-fan:${(isNaN(p) || p <= 0 ? 1.2 : 2 - (Math.min(p, 100) / 100) * 1.6).toFixed(2)}s;`; }
    return `<svg class="ma ma-${type}${running ? ' run' : ''}${o.done ? ' done' : ''}${lvl}${ph}" viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="${vars}${o.style || ''}"><g class="p ma-art">${f()}</g>${BADGE}</svg>`;
  };

  /* ------------------------------------------------------------ CSS */
  const D = (s) => `calc(${s}s * var(--ma-t, 1))`;
  const K = (v, u) => `calc(${v}${u} * var(--ma-k, 1))`;
  M.APPLIANCE_CSS = `
    .ma{display:block;flex:none;overflow:visible;--ma-k:1;--ma-t:1}
    .ma.calm{--ma-k:.5;--ma-t:2}
    .ma .f{fill:currentColor;stroke:none}
    .ma .p{transform-box:fill-box;transform-origin:center}
    .ma .ma-steam,.ma .ma-hw,.ma .ma-drop,.ma .ma-stream,.ma .ma-fill,.ma .ma-glow,.ma .ma-snow,.ma .ma-badge{opacity:0}
    .ma .ma-glow{fill:var(--ma-glow,#fff3c4);stroke:none}
    .ma .ma-light{opacity:.35}
    .ma .ma-heat{opacity:.55}
    /* vaskemaskin: trommel 1,2 s (sentrifugering 0,5 s + kroppen rister ±0,6 px) */
    .ma-washer.run .ma-drum{animation:ma-rot ${D(1.2)} linear infinite}
    .ma-washer.run.ph-spin .ma-drum{animation-duration:${D(0.5)}}
    .ma-washer.run.ph-spin .ma-body{animation:ma-shake ${D(0.18)} linear infinite}
    /* tørketrommel: trommel 2,4 s, klær tumler forskjøvet, varmebølger stiger */
    .ma-dryer.run .ma-drum{animation:ma-rot ${D(2.4)} linear infinite}
    .ma-dryer.run .ma-c{animation:ma-tumble ${D(1.2)} ease-in-out infinite}
    .ma-dryer.run .ma-c2{animation-delay:${D(0.3)}}
    .ma-dryer.run .ma-c3{animation-delay:${D(0.6)}}
    .ma-dryer.run .ma-hw{animation:ma-rise ${D(1.6)} ease-out infinite}
    .ma-dryer.run .ma-h2{animation-delay:${D(0.5)}}
    .ma-dryer.run .ma-h3{animation-delay:${D(1)}}
    /* oppvask: dråper faller i vinduet; tørking → damp fra toppen */
    .ma-dishwasher.run:not(.ph-dry) .ma-drop{animation:ma-drop ${D(0.9)} ease-in infinite}
    .ma-dishwasher.run .ma-d2{animation-delay:${D(0.3)}}
    .ma-dishwasher.run .ma-d3{animation-delay:${D(0.6)}}
    .ma-dishwasher.run.ph-dry .ma-steam{animation:ma-steam ${D(1.4)} ease-out infinite}
    .ma-dishwasher.run.ph-dry .ma-s2{animation-delay:${D(0.7)}}
    /* vannkoker: lokket hopper uregelmessig, damp bølger; kokt → tre raske hopp */
    .ma-kettle.run .ma-lid{transform-origin:20% 100%;animation:ma-lid ${D(1.4)} ease-in-out infinite}
    .ma-kettle.run .ma-steam{animation:ma-steam ${D(1.4)} ease-out infinite}
    .ma-kettle.run .ma-s2{animation-delay:${D(0.7)}}
    .ma-kettle.done .ma-lid{transform-origin:20% 100%;animation:ma-hop3 .9s ease-in-out 1}
    /* kaffe: stråle renner (scaleY fra topp), koppen fylles nedenfra; ferdig → damp fra koppen */
    .ma-coffee.run .ma-stream{transform-origin:50% 0;animation:ma-stream ${D(1.2)} ease-in infinite}
    .ma-coffee.run .ma-fill{animation:ma-fill ${D(2.4)} linear infinite}
    .ma-coffee.done .ma-fill{opacity:1}
    .ma-coffee.done .ma-steam{animation:ma-steam 1.4s ease-out 2}
    .ma-coffee.done .ma-s2{animation-delay:.5s}
    /* mikro: tallerken roterer (scaleX-flipp), vinduet gløder, lys på; ferdig → «ding» */
    .ma-microwave.run .ma-plate{animation:ma-flip ${D(2)} linear infinite}
    .ma-microwave.run .ma-glow{animation:ma-glow ${D(1.5)} ease-in-out infinite}
    .ma-microwave.run .ma-light{opacity:1}
    .ma-microwave.done .ma-body{animation:ma-ding .45s ease-out 2}
    /* stekeovn: varmeelementet pulserer oransje, varmebølger i vinduet */
    .ma-oven.run .ma-heat{stroke:var(--ma-heat,#ff7a2e);animation:ma-pulse ${D(1.4)} ease-in-out infinite}
    .ma-oven.run .ma-hw{animation:ma-rise ${D(1.6)} ease-out infinite}
    .ma-oven.run .ma-h2{animation-delay:${D(0.55)}}
    .ma-oven.run .ma-h3{animation-delay:${D(1.1)}}
    /* robotstøvsuger: kjører fram og tilbake, børsten spinner */
    .ma-vacuum.run .ma-body{animation:ma-drive ${D(2)} ease-in-out infinite}
    .ma-vacuum.run .ma-brush{animation:ma-rot ${D(0.4)} linear infinite}
    /* vifte / varmepumpe: fart etter percentage (--ma-fan, 0,4–2 s) */
    .ma-fan.run .ma-blades{animation:ma-rot calc(var(--ma-fan, 1.2s) * var(--ma-t, 1)) linear infinite}
    /* kjøleskap: bare ved åpen dør – døren vipper, snøfnugg driver ut */
    .ma-fridge.run .ma-door{transform-origin:0 50%;animation:ma-door ${D(0.5)} ease-out forwards}
    .ma-fridge.run .ma-body{opacity:.45}
    .ma-fridge.run .ma-snow{animation:ma-snow ${D(2.6)} ease-out infinite}
    /* ferdig (overgang kjører → ferdig): kort sprett + hake i 2 s */
    .ma.done:not(.ma-kettle):not(.ma-microwave) .ma-art{animation:ma-pop .5s ease-out 1}
    .ma.done .ma-badge{animation:ma-check 2s ease-out forwards}
    .ma.off *,.ma.off{animation:none !important}
    @media (prefers-reduced-motion: reduce){.ma *,.ma{animation:none !important}}
    @keyframes ma-rot{to{transform:rotate(360deg)}}
    @keyframes ma-shake{0%,100%{transform:translate(0,0)}25%{transform:translate(${K(0.6, 'px')},${K(-0.3, 'px')})}50%{transform:translate(${K(-0.6, 'px')},0)}75%{transform:translate(${K(0.3, 'px')},${K(0.3, 'px')})}}
    @keyframes ma-tumble{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(${K(-2, 'px')}) rotate(${K(-70, 'deg')})}}
    @keyframes ma-rise{0%{opacity:0;transform:translateY(0)}40%{opacity:1}100%{opacity:0;transform:translateY(${K(-4, 'px')})}}
    @keyframes ma-steam{0%{opacity:0;transform:translate(0,0)}30%{opacity:.95;transform:translate(${K(0.6, 'px')},${K(-1.4, 'px')})}70%{opacity:.6;transform:translate(${K(-0.6, 'px')},${K(-2.8, 'px')})}100%{opacity:0;transform:translate(0,${K(-4, 'px')})}}
    @keyframes ma-drop{0%{opacity:0;transform:translateY(${K(-3, 'px')})}25%,75%{opacity:1}100%{opacity:0;transform:translateY(${K(3, 'px')})}}
    @keyframes ma-lid{0%,26%,52%,78%,100%{transform:none}12%{transform:translateY(${K(-1.5, 'px')}) rotate(${K(-6, 'deg')})}38%{transform:translateY(${K(-0.8, 'px')}) rotate(${K(-3, 'deg')})}88%{transform:translateY(${K(-1.2, 'px')}) rotate(${K(-5, 'deg')})}}
    @keyframes ma-hop3{0%,33%,66%,100%{transform:none}16%,49%,82%{transform:translateY(-2px) rotate(-7deg)}}
    @keyframes ma-stream{0%{opacity:1;transform:scaleY(0)}45%{transform:scaleY(1)}85%{opacity:1;transform:scaleY(1)}100%{opacity:0;transform:scaleY(1)}}
    @keyframes ma-fill{0%{opacity:1;clip-path:inset(100% 0 0 0)}85%{opacity:1;clip-path:inset(8% 0 0 0)}100%{opacity:0;clip-path:inset(8% 0 0 0)}}
    @keyframes ma-flip{0%{transform:scaleX(1)}50%{transform:scaleX(-1)}100%{transform:scaleX(1)}}
    @keyframes ma-glow{0%,100%{opacity:.35}50%{opacity:.6}}
    @keyframes ma-ding{0%,100%{transform:scale(1)}35%{transform:scale(1.08)}}
    @keyframes ma-pulse{0%,100%{opacity:.4}50%{opacity:1}}
    @keyframes ma-drive{0%,100%{transform:translateX(${K(-2, 'px')})}50%{transform:translateX(${K(2, 'px')})}}
    @keyframes ma-door{from{transform:perspective(40px) rotateY(0)}to{transform:perspective(40px) rotateY(${K(-15, 'deg')})}}
    @keyframes ma-snow{0%{opacity:0;transform:translate(0,0) rotate(0)}25%{opacity:1}100%{opacity:0;transform:translate(${K(5, 'px')},${K(-3, 'px')}) rotate(90deg)}}
    @keyframes ma-pop{0%,100%{transform:scale(1)}35%{transform:scale(1.06)}}
    @keyframes ma-check{0%{opacity:0;transform:scale(.4)}12%{opacity:1;transform:scale(1.12)}22%{transform:scale(1)}82%{opacity:1}100%{opacity:0;transform:scale(1)}}
    .ma-cell{overflow:hidden}
  `;
})();
