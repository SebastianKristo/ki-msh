/* KI MSH · Hurtigpanel (Fiks 58 A) – nedtrekkspanel i Android-stil. Kilde: prompt «Hurtigpanel og Stue» (designfilen
 * Hurtigpanel.dc.html finnes ikke i repoet – bygget etter prompt-teksten).
 * ÉN komponent for begge variantene (gestlogikken finnes bare her):
 *   variant 'mobil'     – Hjem (msh-hjem-card, M.hurtig.attach): to nivåer (runde fliser → stor seksjon med «Alle lys»,
 *                         8 fliser og minispiller), varsler, sveip-innstillinger.
 *   variant 'nettbrett' – Stue-dashbordet (msh-stue-card, 64-stue.js): to kolonner (delt) eller én (sentrert), skjermens
 *                         lysstyrke, 8 fliser (Nattmodus i stedet for Natta), minispiller, varsler til høyre.
 * Panelet portales til ki-overlay-root (fallgruve 1) og plasseres mot dashbordflaten (MSH.dashRect) – aldri over HA-sidebaren.
 *
 *   const ctl = M.hurtig.create(owner, { variant, cfg: () => panelConfig, canOpen: () => bool, onEdit, props })
 *   ctl.update(hass) · ctl.open(level) · ctl.close() · ctl.destroy() · ctl.isOpen
 *
 * Åpne-gest (må være bevisst): siden helt øverst (≤ 2 px) og i ro i `rest` ms, start i sonen (kant 80 px | øvre 45 % |
 * overalt), ikke i vannrette karuseller/inputfelt, dy > 10 og mer loddrett enn vannrett, dødsone `dead` px, åpner ved slipp
 * når trekket > min(open, panelhøyde − 40), > panelhøyde + 90 → rett i nivå 2. Musehjul: opp-scroll i toppen akkumuleres
 * over `wheel`; etterskli sperres (`rest` ms når siden når toppen, +160 ms per hjul-event i sperren).
 * Sveip-innstillinger per enhet: localStorage «hurtigpanel-cfg» (nettbrett: «hurtigpanel-cfg:nettbrett»).
 *   Rekkefølge: standard → props (zone, openDistance, deadZone, topRest, wheel) → localStorage → endringer i økten.
 * Panelconfig (i kortets config, redigeres i GUI-editoren / «Tilpass Hjem» → Hurtigpanel):
 *   { enabled, show_hint, tiles: [nøkler], hidden_tiles: [..], entities: { alarm, lock, garage, dnd, heat, vac, guest,
 *     night, screen, screen_switch }, hidden_notifs: [..], players: [media_player…] }
 * Flisenes entiteter autokonfigureres (ingen hardkodede ID-er); finnes ingen → «–», trykk åpner editoren.
 * Varsler: ringeklokke, hvitevarer, dyr strømtime, Tesla-lading, støvsuger utilgjengelig, søppel i morgen og
 *   persistent_notification (abonnement kun mens panelet er åpent). Fjernede varsler huskes (localStorage, per signatur).
 */
(function () {
  const M = window.MSH;
  if (!M || M.hurtig) return;
  const esc = M.esc, C = M.C;

  /* ------------------------------------------------------------ sveip-innstillinger (per enhet) */
  const DEF = { zone: 'ovre', open: 180, dead: 40, rest: 400, wheel: 140 };
  const LIM = { open: [80, 400, 10], dead: [0, 140, 5], rest: [0, 1200, 50], wheel: [40, 500, 10] };
  const ZONES = [['kant', 'Øverste kant'], ['ovre', 'Øvre del'], ['overalt', 'Hele skjermen']];
  const lsKey = (variant) => 'hurtigpanel-cfg' + (variant === 'nettbrett' ? ':nettbrett' : '');
  const lsGet = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* */ } };
  const clampSet = (o) => {
    const out = {};
    if (o && ZONES.some((z) => z[0] === o.zone)) out.zone = o.zone;
    Object.keys(LIM).forEach((k) => { if (o && M.isNum(o[k])) out[k] = M.clamp(Number(o[k]), LIM[k][0], LIM[k][1]); });
    return out;
  };
  const propsOf = (p) => clampSet({ zone: p && p.zone, open: p && p.openDistance, dead: p && p.deadZone, rest: p && p.topRest, wheel: p && p.wheel });
  M.hurtigSwipe = (variant, props) => ({ ...DEF, ...propsOf(props), ...clampSet(lsGet(lsKey(variant))) });

  /* ------------------------------------------------------------ fliser */
  // [nøkkel, navn, ikon av, ikon på, tekst på, tekst av]
  const TILES = [
    ['alarm', 'Alarm', 'mdi:shield-outline', 'mdi:shield', 'Borte', 'Av'],
    ['lock', 'Dørlås', 'mdi:lock-open-variant', 'mdi:lock', 'Låst', 'Ulåst'],
    ['garage', 'Garasjeport', 'mdi:garage', 'mdi:garage-open', 'Åpen', 'Lukket'],
    ['dnd', 'Ikke forstyrr', 'mdi:bell-off-outline', 'mdi:bell-off', 'Ringeklokke stille', 'Av'],
    ['heat', 'Varmepumpe', 'mdi:heat-pump-outline', 'mdi:heat-pump', 'Varmer', 'Av'],
    ['vac', 'Sir Sweeps', 'mdi:robot-vacuum', 'mdi:robot-vacuum', 'Rengjør', 'Ved dokk'],
    ['guest', 'Gjeste-Wi-Fi', 'mdi:wifi-off', 'mdi:wifi', 'På · vis QR', 'Av'],
    ['night', 'Natta', 'mdi:weather-night', 'mdi:weather-night', 'På', 'Av'],
  ];
  const TILE_KEYS = TILES.map((t) => t[0]);
  const rx = (re) => (s, id) => re.test(id) || re.test(String((s.attributes || {}).friendly_name || '').toLowerCase());
  const platOf = (h, id) => ((M.regEntry(h, id) || {}).platform || '');
  const AUTO = {
    alarm: (h) => M.all(h, 'alarm_control_panel')[0] || null,
    lock: (h) => (M.hjemLockAuto ? M.hjemLockAuto(h) : M.all(h, 'lock')[0]) || null,
    garage: (h) => M.all(h, 'cover', (s) => s.attributes.device_class === 'garage')[0] || null,
    dnd: (h) => M.all(h, ['input_boolean', 'switch'], rx(/ikke.?forstyrr|do.?not.?disturb|\bdnd\b|_dnd|ringeklokke.?stille|stille.?modus|doorbell.?(mute|silent)/))[0] || null,
    heat: (h) => M.all(h, 'climate', (s, id) => /nibe|myuplink/.test(platOf(h, id)) || rx(/varmepumpe|heat.?pump|luft.?til.?luft/)(s, id))[0] || null,
    vac: (h) => M.all(h, 'vacuum')[0] || null,
    guest: (h) => { const L = M.all(h, 'switch', rx(/gjest|guest/)); return L.find((id) => platOf(h, id) === 'unifi') || L.find((id) => /wifi|wlan|ssid|nett/.test(id)) || L[0] || null; },
    night: (h, v) => {
      const ib = M.all(h, 'input_boolean', rx(/nattmodus|natt.?modus|night.?mode|natta|sleep.?mode/))[0];
      const sc = M.all(h, 'script', rx(/natta|god.?natt|nattmodus|night|leggetid|bedtime/))[0];
      const sn = M.all(h, 'scene', rx(/natta|god.?natt|nattmodus|night|leggetid/))[0];
      return (v === 'nettbrett' ? ib || sc || sn : sc || ib || sn) || null;
    },
    screen: (h) => M.all(h, ['light', 'number'], rx(/screen.?brightness|skjerm.?lysstyrke|_screen$|_skjerm$/))[0] || null,
    screen_switch: (h) => M.all(h, 'switch', rx(/_screen$|_skjerm$|screen.?on|skjerm/))[0] || null,
  };
  const entOf = (h, pc, k, v) => {
    const o = ((pc || {}).entities || {})[k];
    if (o === 'none') return null;
    if (o && h && h.states[o]) return o;
    return h && AUTO[k] ? AUTO[k](h, v) : null;
  };
  M.hurtigEntity = entOf;
  const isToggle = (id) => /^(input_boolean|switch|light|fan)\./.test(id || '');
  // Én flis → { key, name, icon, on, status, id, dead }
  function tileModel(h, pc, k, v) {
    const T = TILES.find((t) => t[0] === k);
    if (!T) return null;
    const id = entOf(h, pc, k, v), st = id && h ? h.states[id] : null;
    const name = (((pc || {}).names || {})[k]) || (k === 'night' && v === 'nettbrett' ? 'Nattmodus' : k === 'vac' && st ? M.name(h, id) : T[1]);
    const m = { key: k, name, icon: T[2], on: false, status: '–', id, dead: !st };
    if (!st) { m.status = id ? 'Utilgjengelig' : '–'; return m; }
    if (M.unavailable(st)) { m.status = 'Utilgjengelig'; m.dead = true; return m; }
    const s = st.state, a = st.attributes || {};
    switch (k) {
      case 'alarm': {
        const A = M.alarmState ? M.alarmState(h, {}, id) : { armed: s !== 'disarmed', text: s };
        m.on = !!A.armed; m.status = m.on ? A.text || T[4] : T[5]; break;
      }
      case 'lock': m.on = s === 'locked'; m.status = s === 'locked' ? T[4] : s === 'jammed' ? 'Fastkjørt' : /lock(ing)$/.test(s) ? 'Låser …' : s === 'unlocking' ? 'Låser opp …' : T[5]; m.icon = m.on ? T[3] : T[2]; return m;
      case 'garage': m.on = /^(open|opening)$/.test(s); m.status = s === 'opening' ? 'Åpner …' : s === 'closing' ? 'Lukker …' : m.on ? T[4] : T[5]; break;
      case 'heat': {
        m.on = s !== 'off';
        const tt = a.temperature != null ? M.nf(a.temperature, a.temperature % 1 ? 1 : 0) + '°' : '';
        const act = a.hvac_action, word = act === 'heating' ? 'Varmer' : act === 'cooling' ? 'Kjøler' : act === 'idle' ? 'Hviler' : s === 'heat' ? 'Varme' : s === 'cool' ? 'Kjøling' : s === 'auto' || s === 'heat_cool' ? 'Auto' : 'På';
        m.status = m.on ? word + (tt ? ' · ' + tt : '') : T[5]; break;
      }
      case 'vac': m.on = s === 'cleaning'; m.status = s === 'cleaning' ? T[4] : s === 'returning' ? 'På vei hjem' : s === 'paused' ? 'Pauset' : s === 'error' ? 'Feil' : T[5]; break;
      case 'night':
        // Skript/scene = engangshandling: aldri aktiv-tilstand (prosjektregel). input_boolean viser på/av.
        if (/^(script|scene)\./.test(id)) { m.status = 'Kjør'; m.oneShot = true; return { ...m, icon: T[3] }; }
        m.on = s === 'on'; m.status = m.on ? T[4] : T[5]; break;
      default: m.on = s === 'on'; m.status = m.on ? T[4] : T[5];
    }
    m.icon = m.on ? T[3] : T[2];
    return m;
  }
  const tileOrder = (pc) => {
    const o = Array.isArray((pc || {}).tiles) ? pc.tiles.filter((k) => TILE_KEYS.includes(k)) : [];
    const hid = new Set((pc || {}).hidden_tiles || []);
    return [...o, ...TILE_KEYS.filter((k) => !o.includes(k))].filter((k) => !hid.has(k));
  };
  M.hurtigTiles = (h, pc, v) => tileOrder(pc).map((k) => tileModel(h, pc, k, v)).filter(Boolean);
  M.HURTIG_TILES = TILES;

  function tileAct(ctl, k) {
    const h = ctl.hass, pc = ctl.pc(), v = ctl.variant;
    const m = tileModel(h, pc, k, v);
    if (!m) return;
    if (!m.id) { M.haptic('light'); ctl.edit('tiles'); return; }
    const id = m.id, st = h.states[id], dom = id.split('.')[0];
    if (!st || M.unavailable(st)) { M.haptic('failure'); M.toast(m.name + ' er utilgjengelig'); return; }
    M.haptic('medium');
    const done = (txt) => (p) => Promise.resolve(p).then(() => { if (txt) M.toast(txt); }).catch((e) => { M.haptic('failure'); M.toast('Feil: ' + (e && e.message ? e.message : e)); });
    switch (k) {
      case 'alarm': {
        const code = st.attributes.code_format && st.attributes.code_arm_required !== false;
        if (m.on) { if (st.attributes.code_format) { ctl.close(); M.moreInfo(ctl.owner, id); return; } done('Alarm av')(M.call(h, 'alarm_control_panel', 'alarm_disarm', { entity_id: id })); return; }
        if (code) { ctl.close(); M.moreInfo(ctl.owner, id); return; }
        done('Alarm satt på · Borte')(M.call(h, 'alarm_control_panel', 'alarm_arm_away', { entity_id: id })); return;
      }
      case 'lock':
        if (m.on) { if (M.lockUnlock) M.lockUnlock({ hass: h }, id); else done('Låst opp')(M.call(h, 'lock', 'unlock', { entity_id: id })); return; }
        done('Låst')(M.call(h, 'lock', 'lock', { entity_id: id })); return;
      case 'garage': done(m.on ? 'Lukker garasjeporten' : 'Åpner garasjeporten')(M.call(h, 'cover', 'toggle', { entity_id: id })); return;
      case 'heat': done(m.on ? 'Varmepumpen slås av' : 'Varmepumpen slås på')(M.call(h, 'climate', m.on ? 'turn_off' : 'turn_on', { entity_id: id })); return;
      case 'vac': done(m.on ? 'Sendt hjem til dokken' : 'Rengjøring startet')(M.call(h, 'vacuum', m.on ? 'return_to_base' : 'start', { entity_id: id })); return;
      case 'guest':
        if (m.on) { guestSheet(ctl, id); return; }
        done('Gjeste-Wi-Fi på')(M.call(h, dom, 'turn_on', { entity_id: id })); return;
      case 'night':
        if (m.oneShot) { done(m.name + ' kjørt')(M.call(h, dom, 'turn_on', { entity_id: id })); return; }
        done(m.name + (m.on ? ' av' : ' på'))(M.call(h, 'homeassistant', m.on ? 'turn_off' : 'turn_on', { entity_id: id })); return;
      default:
        if (isToggle(id)) done(m.name + (m.on ? ' av' : ' på'))(M.call(h, 'homeassistant', 'toggle', { entity_id: id }));
        else { ctl.close(); M.moreInfo(ctl.owner, id); }
    }
  }
  // Gjeste-Wi-Fi: QR fra UniFi (image.*qr* på samme enhet) eller SSID/passord fra attributtene, + «Slå av»
  function guestSheet(ctl, id) {
    const h = ctl.hass, reg = M.regEntry(h, id) || {}, dev = reg.device_id;
    const same = dev ? Object.keys(h.entities || {}).filter((x) => h.entities[x].device_id === dev && h.states[x]) : [];
    const img = same.find((x) => /^image\./.test(x) && /qr/.test(x)) || M.all(h, 'image', (s, x) => /qr/.test(x) && /gjest|guest/.test(x))[0];
    const a = h.states[id].attributes || {}, pic = img && h.states[img] ? h.states[img].attributes.entity_picture : null;
    const ssid = a.ssid || a.name || M.name(h, id), pw = a.password || a.passphrase || a.x_passphrase || '';
    const ov = M.overlay({
      center: true, maxWidth: 360,
      css: `.w{display:flex;flex-direction:column;align-items:center;gap:14px;text-align:center}.t{font-size:20px;font-weight:600}.s{font-size:14px;color:var(--ki-text-2, #afafaf)}
        .qr{width:220px;height:220px;border-radius:24px;background:#fff;display:grid;place-items:center;overflow:hidden}/* ki-hex-ok: QR trenger hvit bunn */
        .qr img{width:200px;height:200px;image-rendering:pixelated}.nq{width:220px;padding:22px 16px;border-radius:24px;background:var(--ki-surface, #383838);font-size:14px;color:var(--ki-text-2, #afafaf)}
        .b{width:100%;height:48px;border-radius:24px;border:0;font:inherit;font-size:15px;font-weight:600;cursor:pointer;background:var(--ki-surface-2, #4a4a4a);color:var(--ki-text, #fafafa)}`,
      html: `<div class="w"><span class="t">${esc(ssid)}</span>${pic ? `<div class="qr"><img alt="QR-kode" src="${esc(M.hjemPicUrl ? M.hjemPicUrl(h, pic) : pic)}"></div>` : `<div class="nq">Fant ingen QR-kode (image.*_qr_code fra UniFi).</div>`}${pw ? `<span class="s">Passord: <b>${esc(pw)}</b></span>` : ''}<button class="b" data-a="off">Slå av gjeste-Wi-Fi</button></div>`,
    });
    const r = ov && (ov.root || ov.el || ov.shadowRoot);
    const btn = r && r.querySelector ? r.querySelector('[data-a=off]') : null;
    if (btn) btn.addEventListener('click', () => { M.haptic('medium'); M.call(h, id.split('.')[0], 'turn_off', { entity_id: id }).then(() => M.toast('Gjeste-Wi-Fi av')); if (ov.close) ov.close(); });
  }

  /* ------------------------------------------------------------ varsler */
  const DIS = 'hurtigpanel-dismissed';
  const dismissed = () => lsGet(DIS) || {};
  const dismiss = (id, sig) => { const d = dismissed(); d[id] = sig; const ks = Object.keys(d); if (ks.length > 80) ks.slice(0, ks.length - 80).forEach((k) => delete d[k]); lsSet(DIS, d); };
  const hm = (t) => { const d = new Date(t); return isNaN(d) ? '' : `${M.pad(d.getHours())}:${M.pad(d.getMinutes())}`; };
  const dayKey = (d) => { const x = d || new Date(); return x.getFullYear() + '-' + (x.getMonth() + 1) + '-' + x.getDate(); };
  const APPL_RX = /(vaskemaskin|washing.?machine|washer|torketrommel|tørketrommel|dryer|oppvaskmaskin|oppvask|dishwasher)/;
  const REM_RX = /(remaining|gjenst|time.?left|finish|ferdig|end.?time|completion)/;
  const applKind = (id) => { const m = APPL_RX.exec(id) || []; const w = m[1] || ''; return /oppvask|dish/.test(w) ? 'dish' : /tørk|tork|dryer/.test(w) ? 'dry' : 'wash'; };
  // Én per apparat: samme enhet (device_id), ellers samme type (vask/oppvask/tørk). Status-entiteten foretrekkes.
  function appliances(h) {
    const seen = new Set(), out = [];
    const rank = (id) => (/_(status|state|tilstand|run_state|machine_state|operation)/.test(id) ? 0 : /^switch\./.test(id) ? 2 : 1);
    M.all(h, ['sensor', 'binary_sensor', 'switch', 'select', 'input_select'], (s, id) => APPL_RX.test(id) && !REM_RX.test(id) && !/power|effekt|energy|energi|kwh|current|voltage|temp|door|dor|lock|child/.test(id))
      .sort((a, b) => rank(a) - rank(b) || (a < b ? -1 : 1)).forEach((id) => {
        const dev = (M.regEntry(h, id) || {}).device_id || null, key = dev || applKind(id);
        if (seen.has(key)) return;
        seen.add(key);
        out.push({ id, dev, kind: applKind(id) });
      });
    return out;
  }
  function remainingMin(h, id, dev, kind) {
    const L = dev ? Object.keys(h.entities || {}).filter((x) => h.entities[x].device_id === dev && x.startsWith('sensor.') && REM_RX.test(x))
      : M.all(h, 'sensor', (s, x) => REM_RX.test(x) && APPL_RX.test(x) && applKind(x) === kind);
    for (const x of L) {
      const s = h.states[x];
      if (!s || M.unavailable(s)) continue;
      if (s.attributes.device_class === 'timestamp') { const t = new Date(s.state).getTime(); if (!isNaN(t)) return Math.max(0, Math.round((t - Date.now()) / 60000)); }
      if (M.isNum(s.state)) { const u = String(s.attributes.unit_of_measurement || 'min'); const v = Number(s.state); return Math.round(/^h/.test(u) ? v * 60 : /^s/.test(u) ? v / 60 : v); }
      const m = /^(\d+):(\d\d)/.exec(s.state); if (m) return Number(m[1]) * 60 + Number(m[2]);
    }
    return null;
  }
  function buildNotifs(ctl) {
    const h = ctl.hass, pc = ctl.pc(), hid = new Set(pc.hidden_notifs || []), D = dismissed(), L = [];
    if (!h) return L;
    // Fjernet: med signatur → skjult til signaturen endres; uten (pågående, f.eks. «Lader») → skjult ut dagen
    const add = (n) => { if (hid.has(n.kind)) return; if (D[n.id] === (n.sig != null ? String(n.sig) : '*' + dayKey())) return; L.push(n); };
    // 1. Ringeklokke (amber)
    try {
      if (M.ringActive && M.ringActive()) {
        const rc = M.ringCfg ? M.ringCfg() : {}, A = M.ringAuto(h, rc), cam = A.camera && h.states[A.camera];
        add({ kind: 'ring', id: 'ring', sig: String((M.ring || {}).t || ''), app: 'Ringeklokke', icon: 'mdi:doorbell-video', color: C.orange, t: (M.ring || {}).t, title: 'Noen er ved inngangen', body: 'Det ringer på døren.', img: cam ? cam.attributes.entity_picture : null,
          actions: [['Se kamera', () => ctl.go('#ringeklokke')], ['Snakk', () => { ctl.close(); if (M.ringCustom) M.ringCustom(h, A, rc); else ctl.go('#ringeklokke'); }]], onDismiss: () => M.ringDismiss && M.ringDismiss() });
      }
    } catch (e) { /* */ }
    // 2. Hvitevarer (blå)
    try {
      appliances(h).forEach(({ id, dev, kind }) => {
        const S = M.applianceStatus ? M.applianceStatus(h, id) : null, st = h.states[id];
        if (!S || !st) return;
        const nm = (dev && h.devices && h.devices[dev] && (h.devices[dev].name_by_user || h.devices[dev].name)) || { dish: 'Oppvaskmaskin', dry: 'Tørketrommel', wash: 'Vaskemaskin' }[kind];
        const rem = S.running ? remainingMin(h, id, dev, kind) : null;
        if (S.running) {
          add({ kind: 'appliance', id: 'appl:' + id, sig: null, app: nm, icon: 'mdi:washing-machine', color: C.blue, t: st.last_changed, title: rem != null ? `Ferdig om ${rem} min` : 'Kjører', body: S.phase ? String(S.phase) : '', progress: S.pct != null ? S.pct : null });
        } else if (S.done || S.finished) {
          add({ kind: 'appliance', id: 'appl:' + id, sig: st.last_changed, app: nm, icon: 'mdi:washing-machine', color: C.blue, t: st.last_changed, title: 'Ferdig', body: 'Klar til å tømmes.', progress: 100, actions: [['Ok', 'dismiss']] });
        }
      });
    } catch (e) { /* */ }
    // 3. Strøm: dyr time de neste 6 timene (rød)
    try {
      const P = M.powerPrice ? M.powerPrice(h) : null;
      if (P && P.entity && P.hasToday) {
        const arr = P.today, n = arr.length || 24, per = 1440 / n, now = new Date(), i0 = Math.floor((now.getHours() * 60 + now.getMinutes()) / per);
        const vals = arr.filter((x) => x != null), avg = vals.reduce((a, b) => a + b, 0) / (vals.length || 1);
        let j = -1;
        for (let i = i0; i < Math.min(n, i0 + Math.round(360 / per)); i++) if (arr[i] != null && arr[i] >= avg * 1.25 && arr[i] > 0) { j = i; break; }
        if (j >= 0) {
          const mins = j * per, at = `${M.pad(Math.floor(mins / 60))}:${M.pad(mins % 60)}`;
          const T = M.tesla && M.teslaHas && M.teslaHas(h) ? M.tesla.entOf(h, {}, 'charger') : null;
          const acts = T && h.states[T] ? [['Utsett lading', () => M.call(h, T.split('.')[0], 'turn_off', { entity_id: T }).then(() => M.toast('Lading utsatt'))], ['Lad nå', () => M.call(h, T.split('.')[0], 'turn_on', { entity_id: T }).then(() => M.toast('Lading startet'))]] : [];
          add({ kind: 'power', id: 'power', sig: dayKey() + ':' + j, app: 'Strøm', icon: 'mdi:flash', color: C.red, t: Date.now(), title: j === i0 ? 'Dyr time nå' : `Dyr time fra ${at}`, body: `${P.fmt(arr[j], { unit: true })} · snitt i dag ${P.fmt(avg, { unit: true })}`, actions: acts });
        }
      }
    } catch (e) { /* */ }
    // 4. Tesla lader (gul)
    try {
      if (M.tesla && M.teslaHas && M.teslaHas(h)) {
        const ch = M.tesla.charging(h, {}), b = M.tesla.entOf(h, {}, 'battery'), bv = b ? M.num(h, b) : null;
        if (ch && ch.lader) add({ kind: 'tesla', id: 'tesla', sig: null, app: 'Tesla', icon: 'mdi:car-electric', color: C.yellow, t: b && h.states[b] ? h.states[b].last_changed : Date.now(), title: `Lader · ${bv != null ? Math.round(bv) + ' %' : '–'}`, body: ch.eff != null ? M.nf(ch.eff, 1) + ' kW' : '', progress: bv });
      }
    } catch (e) { /* */ }
    // 5. Støvsuger utilgjengelig/feil (fiolett)
    M.all(h, 'vacuum').forEach((id) => {
      const st = h.states[id];
      if (!st || !(M.unavailable(st) || st.state === 'error')) return;
      add({ kind: 'vacuum', id: 'vac:' + id, sig: st.last_changed, app: M.name(h, id), icon: 'mdi:robot-vacuum-alert', color: C.purple, t: st.last_changed, title: st.state === 'error' ? 'Feil' : 'Utilgjengelig', body: st.state === 'error' ? String(st.attributes.error || st.attributes.status || 'Sjekk støvsugeren.') : 'Får ikke kontakt med støvsugeren.',
        actions: [['Prøv igjen', () => M.call(h, 'homeassistant', 'reload_config_entry', { entity_id: id }).then(() => M.toast('Laster inn på nytt'))]] });
    });
    // 6. Søppel i morgen / i dag (grønn)
    try {
      const sc = M.store && M.store.eff ? M.store.eff('cards.pop-soppel') || {} : {};
      (M.avfallFraksjoner ? M.avfallFraksjoner(h, sc) : []).filter((f) => !f.hidden && (f.dager === 0 || f.dager === 1)).forEach((f) => {
        add({ kind: 'avfall', id: 'avfall:' + f.id, sig: f.dato ? dayKey(new Date(f.dato)) : dayKey(), app: 'Søppel', icon: 'mdi:trash-can', color: C.green, t: Date.now(), title: `${f.navn} hentes ${f.dager === 0 ? 'i dag' : 'i morgen'}`, body: 'Husk å sette dunken ut.', actions: [['Satt ut', 'dismiss']] });
      });
    } catch (e) { /* */ }
    // 7. persistent_notification (abonnement mens panelet er åpent)
    Object.values(ctl._pn || {}).forEach((n) => {
      add({ kind: 'ha', id: 'pn:' + n.notification_id, sig: null, app: 'Home Assistant', icon: 'mdi:bell', color: C.blue, t: n.created_at, title: n.title || 'Varsel', body: String(n.message || '').replace(/[*_`#>]/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'),
        onDismiss: () => M.call(h, 'persistent_notification', 'dismiss', { notification_id: n.notification_id }) });
    });
    return L;
  }
  M.hurtigNotifs = buildNotifs;

  /* ------------------------------------------------------------ vær/hjemme-linje */
  const COND = { 'clear-night': 'klart', cloudy: 'skyet', exceptional: 'ekstremvær', fog: 'tåke', hail: 'hagl', lightning: 'torden', 'lightning-rainy': 'torden og regn', partlycloudy: 'delvis skyet', pouring: 'styrtregn', rainy: 'regn', snowy: 'snø', 'snowy-rainy': 'sludd', sunny: 'sol', windy: 'vind', 'windy-variant': 'vind' };
  M.hurtigWx = function (h) {
    const id = h ? (M.vaerAuto ? M.vaerAuto(h, {}).weather : M.all(h, 'weather')[0]) : null, st = id && h.states[id];
    if (!st) return { id: null, t: null, txt: '–', cond: '' };
    const t = Number(st.attributes.temperature);
    return { id, t: isNaN(t) ? null : t, cond: COND[st.state] || st.state, icon: M.domainIcon(id, st), txt: `${isNaN(t) ? '–' : M.nf(t, 1)}° ${COND[st.state] || st.state}` };
  };
  const homeCount = (h) => M.all(h, 'person', (s) => s.state === 'home').length;

  /* ------------------------------------------------------------ CSS */
  const PINK = C.accent, ON_PINK = 'var(--ki-on-accent, #2a1720)';
  const CSS = `
    :host{position:fixed;left:0;top:0;width:0;height:0;z-index:1000;font-family:${M.FONT};color:var(--ki-text, #fafafa);-webkit-font-smoothing:antialiased;-webkit-tap-highlight-color:transparent}
    *{box-sizing:border-box}
    button{font:inherit;color:inherit;border:0;background:none;padding:0;cursor:pointer;-webkit-tap-highlight-color:transparent}
    .ell{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
    .num{font-variant-numeric:tabular-nums}
    .hint{position:fixed;width:44px;height:4px;border-radius:2px;background:${M.theme.whiteA(0.22)};z-index:1000;pointer-events:none;opacity:0;transition:opacity .25s ease}
    .hint.on{opacity:1}
    .scrim{position:fixed;top:0;bottom:0;z-index:1000;background:rgb(0 0 0/0.5);opacity:0;pointer-events:none;-webkit-backdrop-filter:blur(var(--hp-blur,0px));backdrop-filter:blur(var(--hp-blur,0px))}
    .scrim.on{pointer-events:auto}
    .pn{position:fixed;top:0;z-index:1001;max-height:100dvh;overflow-y:auto;overscroll-behavior:contain;background:var(--ki-popup, #2a2a2a);border-radius:0 0 36px 36px;padding:calc(env(safe-area-inset-top, 0px) + 18px) 16px 10px;box-shadow:0 18px 50px rgb(0 0 0/0.45);transform:translateY(calc(-100% - 24px));will-change:transform;touch-action:none;user-select:none;-webkit-user-select:none;visibility:hidden}
    .pn.vis{visibility:visible}
    .pn.anim{transition:transform .32s cubic-bezier(.2,.8,.2,1)}
    .tb{display:flex;align-items:flex-start;gap:10px;padding:0 4px 14px;touch-action:none}
    .tb .ck{font-size:40px;font-weight:300;line-height:1;letter-spacing:-.5px}
    .tb .dt{font-size:13px;color:var(--ki-text-2, #afafaf);margin-top:6px}
    .tb .sub{font-size:13px;color:var(--ki-text-3, #7f7f7f);margin-top:2px}
    .tb .sp{flex:1}
    .ib{width:44px;height:44px;border-radius:22px;background:var(--ki-surface, #383838);display:grid;place-items:center;flex:none;transition:transform .12s ease}
    .ib:active,.press:active{transform:scale(.94)}
    .ib.on{background:${PINK};color:${ON_PINK}}
    .rr{display:grid;grid-template-columns:repeat(6,minmax(0,56px));justify-content:space-between;gap:4px;padding:0 2px;overflow:hidden;opacity:calc(1 - var(--exp,0));max-height:calc((1 - var(--exp,0)) * 76px)}
    .rt{width:100%;aspect-ratio:1;max-width:56px;border-radius:50%;background:var(--ki-surface, #383838);display:grid;place-items:center;flex:none;transition:transform .12s ease,background .2s}
    .rt.on{background:${PINK};color:${ON_PINK}}
    .rt.dead{opacity:.45}
    .ex{overflow:hidden;opacity:var(--exp,0);max-height:calc(var(--exp,0) * 470px);display:flex;flex-direction:column;gap:10px}
    .exi{display:flex;flex-direction:column;gap:10px;padding:2px 0 12px}
    .sl{position:relative;height:56px;border-radius:28px;background:var(--ki-surface, #383838);overflow:hidden;touch-action:none;display:flex;align-items:center;gap:10px;padding:0 18px}
    .sl .fl{position:absolute;left:0;top:0;bottom:0;background:${PINK};border-radius:28px;min-width:56px;pointer-events:none}
    .sl .lb{position:relative;z-index:1;display:flex;align-items:center;gap:10px;font-size:15px;font-weight:600;pointer-events:none;flex:1;min-width:0}
    .sl .pv{position:relative;z-index:1;font-size:14px;font-weight:600;pointer-events:none}
    .sl.dim .lb,.sl.dim .pv{color:var(--ki-text-3, #7f7f7f)}
    .sl.dim .fl{display:none}
    .sl.lit .lb{color:${ON_PINK}}
    .tg{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .tp{height:64px;border-radius:32px;background:var(--ki-surface, #383838);display:flex;align-items:center;gap:10px;padding:0 12px 0 8px;text-align:left;min-width:0;transition:transform .12s ease,background .2s}
    .tp .ci{width:48px;height:48px;border-radius:24px;background:var(--ki-surface-2, #4a4a4a);display:grid;place-items:center;flex:none}
    .tp .tx{display:flex;flex-direction:column;min-width:0;gap:1px}
    .tp .nm{font-size:14px;font-weight:600}
    .tp .st{font-size:12px;color:var(--ki-text-2, #afafaf)}
    .tp.on{background:${PINK};color:${ON_PINK}}
    .tp.on .ci{background:rgb(255 255 255/0.35)}
    .tp.on .st{color:${ON_PINK};opacity:.8}
    .tp.dead{opacity:.55}
    .mp{height:60px;border-radius:30px;background:var(--ki-pill-bg, #e6e6e6);color:var(--ki-pill-fg, #232323);display:flex;align-items:center;gap:10px;padding:0 8px 0 10px}
    .mp .art{width:44px;height:44px;border-radius:22px;background:rgb(0 0 0/0.12);background-size:cover;background-position:center;display:grid;place-items:center;flex:none}
    .mp .mt{display:flex;flex-direction:column;flex:1;min-width:0;text-align:left}
    .mp .m1{font-size:14px;font-weight:600}
    .mp .m2{font-size:12px;opacity:.7}
    .mp .pp{width:44px;height:44px;border-radius:22px;background:var(--ki-pill-fg, #232323);color:var(--ki-pill-bg, #e6e6e6);display:grid;place-items:center;flex:none}
    .nh{display:flex;align-items:center;gap:8px;padding:14px 6px 8px}
    .nh .t{font-size:15px;font-weight:600;flex:1;min-width:0}
    .nh .ca{flex:none;white-space:nowrap;height:36px;padding:0 14px;border-radius:18px;background:var(--ki-surface, #383838);font-size:13px;font-weight:600}
    .nl{display:flex;flex-direction:column;gap:8px;overflow-y:auto;overscroll-behavior:contain;max-height:max(160px, calc(100dvh - var(--hp-nl-off, 600px)));touch-action:pan-y;padding-bottom:2px}
    .nc{position:relative;background:var(--ki-surface, #383838);border-radius:24px;padding:14px;display:flex;gap:12px;touch-action:pan-y;transition:transform .25s ease,opacity .25s ease}
    .nc.drag{transition:none}
    .nc .ni{width:40px;height:40px;border-radius:20px;display:grid;place-items:center;flex:none}
    .nc .nb{display:flex;flex-direction:column;gap:3px;flex:1;min-width:0}
    .nc .na{font-size:12px;color:var(--ki-text-3, #7f7f7f)}
    .nc .nt{font-size:15px;font-weight:600}
    .nc .nx{font-size:13px;color:var(--ki-text-2, #afafaf)}
    .nc .pg{height:6px;border-radius:3px;background:var(--ki-surface-3, #2c2c2c);overflow:hidden;margin-top:6px}
    .nc .pg span{display:block;height:100%;border-radius:3px}
    .nc .acts{display:flex;gap:8px;margin-top:8px;flex-wrap:wrap}
    .nc .ab{height:36px;min-width:44px;padding:0 14px;border-radius:18px;background:var(--ki-surface-2, #4a4a4a);font-size:13px;font-weight:600;white-space:nowrap}
    .nc .snap{width:84px;height:64px;border-radius:14px;background:#2f2f2f center/cover no-repeat;flex:none}/* ki-hex-ok: kamera-plassholder */
    .empty{padding:18px;text-align:center;font-size:14px;color:var(--ki-text-3, #7f7f7f);background:var(--ki-surface-3, #2c2c2c);border-radius:24px}
    .hd{touch-action:none;display:flex;flex-direction:column;align-items:center;gap:6px;padding:12px 0 4px;font-size:12px;color:var(--ki-text-3, #7f7f7f)}
    .hd .hb{width:44px;height:5px;border-radius:3px;background:var(--ki-text-lo, #696969)}
    .set{background:var(--ki-surface, #383838);border-radius:24px;padding:14px;margin:0 0 12px;display:flex;flex-direction:column;gap:12px}
    .set .sh{display:flex;align-items:center;gap:8px;font-size:15px;font-weight:600}
    .set .sh span{flex:1}
    .set .lab{font-size:13px;color:var(--ki-text-2, #afafaf);display:flex;justify-content:space-between}
    .seg{display:flex;gap:4px;background:var(--ki-surface-3, #2c2c2c);border-radius:22px;padding:4px}
    .seg button{flex:1;height:36px;border-radius:18px;font-size:13px;font-weight:600;color:var(--ki-text-2, #afafaf)}
    .seg button.on{background:${PINK};color:${ON_PINK}}
    .set input[type=range]{width:100%;accent-color:var(--pink, #f285c9);height:28px;touch-action:none}
    .rs{align-self:flex-start;height:36px;padding:0 16px;border-radius:18px;background:var(--ki-surface-2, #4a4a4a);font-size:13px;font-weight:600}
    /* nettbrett */
    .pn.tab{border-radius:0 0 40px 40px;padding:calc(env(safe-area-inset-top, 0px) + 24px) 24px 12px;max-height:100vh}
    .pn.tab .tb .ck{font-size:56px}
    .cols{display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start}
    .pn.cen .cols{grid-template-columns:1fr}
    .lc{display:flex;flex-direction:column;gap:10px}
    .pn.tab .nl{max-height:max(160px, calc(100vh - 230px))}
  `;

  /* ------------------------------------------------------------ hjelpere for gest */
  const now = () => Date.now();
  const inHScroll = (path) => path.some((n) => n && n.nodeType === 1 && (n.hasAttribute('data-snap') || n.hasAttribute('data-hs') || n.__mshHS || /^(INPUT|TEXTAREA|SELECT)$/.test(n.tagName) || n.isContentEditable
    || (n.scrollWidth > n.clientWidth + 2 && /(auto|scroll)/.test(getComputedStyle(n).overflowX))));
  const PANEL_TAGS = new Set(['KI-HURTIGPANEL']);
  // HAs kortredigering (forhåndsvisning) og redigeringsmodus: aldri panel
  function inPreview(el) {
    let n = el, i = 0;
    while (n && i++ < 60) {
      if (n.preview === true || n.editMode === true || /^(hui-card-preview|hui-dialog-edit-card|hui-card-options)$/i.test(n.localName || '')) return true;
      n = n.parentNode || n.host;
    }
    return false;
  }
  // Sidens scroll: vinduet, ellers første rullende forelder til eierkortet (HA-versjoner varierer)
  function scrollTopOf(owner) {
    let y = window.scrollY || (document.scrollingElement && document.scrollingElement.scrollTop) || 0;
    let n = owner, i = 0;
    while (n && i++ < 40) {
      if (n.nodeType === 1 && n.scrollTop > 0) y = Math.max(y, n.scrollTop);
      n = n.parentNode || n.host;
    }
    return y;
  }

  /* ------------------------------------------------------------ kontrolleren */
  class Ctl {
    constructor(owner, o) {
      this.owner = owner; this.o = o || {}; this.variant = this.o.variant === 'nettbrett' ? 'nettbrett' : 'mobil';
      this.isOpen = false; this.exp = 0; this.pull = 0; this.setOpen = false; this._pn = {};
      this._topAt = now(); this._wasTop = true; this._wheelLock = 0; this._wAcc = 0; this._wT = 0;
      this.host = document.createElement('ki-hurtigpanel');
      this.root = this.host.attachShadow({ mode: 'open' });
      this.root.innerHTML = `<style>${CSS}${M.theme && M.theme.CSS ? M.theme.CSS : ''}</style><div class="hint"></div><div class="scrim"></div><div class="pn${this.variant === 'nettbrett' ? ' tab' : ''}" role="dialog" aria-label="Hurtigpanel"></div>`;
      this.hint = this.root.querySelector('.hint'); this.scrim = this.root.querySelector('.scrim'); this.pn = this.root.querySelector('.pn');
      M.overlayRoot().appendChild(this.host);
      this._bind();
      this._hintSoon();
    }
    get hass() { return this.owner.hass || M.lastHass; }
    pc() { try { return (this.o.cfg && this.o.cfg()) || {}; } catch (e) { return {}; } }
    sw() { return M.hurtigSwipe(this.variant, typeof this.o.props === 'function' ? this.o.props() : this.o.props); }
    enabled() { return this.pc().enabled !== false; }
    active() {
      if (!this.enabled() || !this.owner.isConnected || !this.owner.getClientRects().length || inPreview(this.owner)) return false;
      if (location.hash && location.hash.length > 1) return false; // en popup er åpen
      if (M.sheetOpen && M.sheetOpen()) return false;
      if (M.portals && M.portals().length) return false; // Tilpass-ark, tastatur, lås, kart-ark …
      return this.o.canOpen ? !!this.o.canOpen() : true;
    }
    edit(focus) { this.close(); if (this.o.onEdit) setTimeout(() => this.o.onEdit(focus), 120); }
    go(hash) { this.close(); setTimeout(() => { if (M.openPopup) M.openPopup(hash); else location.hash = hash; }, 160); }
    geo() {
      const D = M.dashRect(), tab = this.variant === 'nettbrett';
      const maxW = tab ? (this.pc().shade_layout === 'sentrert' ? 680 : 1280) : 560;
      const w = Math.min(maxW, D.width - (tab ? 32 : D.width > 560 ? 24 : 0));
      return { D, w, left: D.left + (D.width - w) / 2 };
    }
    _place() {
      const G = this.geo();
      Object.assign(this.pn.style, { left: G.left + 'px', width: G.w + 'px' });
      Object.assign(this.scrim.style, { left: G.D.left + 'px', width: G.D.width + 'px' });
      Object.assign(this.hint.style, { left: G.D.left + G.D.width / 2 - 22 + 'px', top: G.D.top + 6 + 'px' });
      this.pn.classList.toggle('cen', this.pc().shade_layout === 'sentrert');
    }
    _hintSoon() { cancelAnimationFrame(this._hr); this._hr = requestAnimationFrame(() => this._hintUpd()); }
    _hintUpd() {
      const pc = this.pc();
      const on = !this.isOpen && pc.show_hint !== false && this.active() && scrollTopOf(this.owner) <= 2;
      if (on) this._place();
      this.hint.classList.toggle('on', on);
    }
    // Fremdrift 0..1 for scrim/blur under trekket
    _paint(pull, anim) {
      const H = this.pn.offsetHeight || 400;
      this.pn.classList.toggle('anim', !!anim);
      this.pn.classList.add('vis');
      const p = M.clamp(pull, 0, H + 260);
      this.pn.style.transform = `translateY(calc(-100% - 24px + ${Math.min(p, H + 24)}px))`;
      const f = M.clamp(p / Math.max(1, H), 0, 1);
      this.scrim.style.transition = anim ? 'opacity .32s ease' : 'none';
      this.scrim.style.opacity = String(f);
      this.scrim.style.setProperty('--hp-blur', (8 * f).toFixed(1) + 'px');
      if (this.variant === 'mobil' && p > H + 24) this._setExp(M.clamp((p - H - 24) / 220, 0, 1));
    }
    _setExp(e, anim) {
      this.exp = e;
      this.pn.style.setProperty('--exp', e.toFixed(3));
      const ex = this.root.querySelector('.ex'), rr = this.root.querySelector('.rr');
      [ex, rr].forEach((x) => { if (x) x.style.transition = anim ? 'max-height .3s ease, opacity .3s ease' : 'none'; });
      const hd = this.root.querySelector('.hd .ht');
      if (hd && this.variant === 'mobil') hd.textContent = e > 0.5 ? 'Dra opp for å lukke' : 'Dra ned for flere fliser';
      this.pn.style.setProperty('--hp-nl-off', e > 0.5 ? '600px' : '230px');
      if (anim || e === 0 || e === 1) this._fit(e > 0.5 ? 1 : 0);
    }
    // Varsellisten får plassen som er igjen (min 160 px), så panelet selv sjelden må rulle og dra opp/ned virker overalt.
    // target = nivået panelet er på vei til (runde rad ↔ stor seksjon).
    _fit(target) {
      const nl = this.root.querySelector('.nl');
      if (!nl) return;
      const ex = this.root.querySelector('.ex'), rr = this.root.querySelector('.rr'), exi = this.root.querySelector('.exi');
      const vh = window.innerHeight || 800;
      let fixed = this.pn.scrollHeight - nl.offsetHeight;
      if (this.variant === 'mobil' && ex && rr) {
        fixed += -ex.offsetHeight - rr.offsetHeight + (target ? (exi ? exi.offsetHeight : 0) : rr.scrollHeight || 60);
      }
      nl.style.maxHeight = Math.max(160, Math.floor(vh - fixed - 4)) + 'px';
      this.pn.style.touchAction = 'none';
      requestAnimationFrame(() => { this.pn.style.touchAction = this.pn.scrollHeight > this.pn.clientHeight + 2 ? 'pan-y' : 'none'; });
    }
    // ---- åpne/lukke
    open(level) {
      if (this.isOpen && level == null) return;
      this.isOpen = true;
      this.hint.classList.remove('on');
      this._place();
      this._render(true);
      this._setExp(level === 2 ? 1 : 0, true);
      requestAnimationFrame(() => {
        this.pn.classList.add('anim', 'vis');
        this.pn.style.transform = 'translateY(0)';
        this.scrim.style.transition = 'opacity .32s ease';
        this.scrim.style.opacity = '1';
        this.scrim.style.setProperty('--hp-blur', '8px');
        this.scrim.classList.add('on');
      });
      this._subPN();
      clearInterval(this._tick);
      this._tick = setInterval(() => { if (!this.active()) this.close(); else this._clock(); }, 500);
      this._kd = (e) => { if (e.key === 'Escape') { e.stopPropagation(); this.close(); } };
      window.addEventListener('keydown', this._kd, true);
      document.documentElement.setAttribute('data-ki-hurtig', '1');
    }
    close(anim = true) {
      const was = this.isOpen;
      this.isOpen = false; this.setOpen = false;
      clearInterval(this._tick); this._tick = null;
      if (this._kd) { window.removeEventListener('keydown', this._kd, true); this._kd = null; }
      this._unsubPN();
      this.scrim.classList.remove('on');
      this.pn.classList.toggle('anim', !!anim);
      this.pn.style.transform = 'translateY(calc(-100% - 24px))';
      this.scrim.style.transition = anim ? 'opacity .28s ease' : 'none';
      this.scrim.style.opacity = '0';
      this.scrim.style.setProperty('--hp-blur', '0px');
      clearTimeout(this._hideT);
      this._hideT = setTimeout(() => { if (!this.isOpen && !this._g) this.pn.classList.remove('vis'); this._hintUpd(); }, anim ? 340 : 0);
      document.documentElement.removeAttribute('data-ki-hurtig');
      if (was) M.haptic('light');
    }
    // ---- persistent_notification (bare mens panelet er åpent – fallgruve 8)
    _subPN() {
      const h = this.hass;
      if (this._pnU || !h || !h.connection || !h.connection.subscribeMessage) return;
      try {
        this._pnU = h.connection.subscribeMessage((m) => {
          const L = (m && m.notifications) || {};
          if (m.type === 'removed') Object.keys(L).forEach((k) => delete this._pn[k]);
          else Object.assign(this._pn, L);
          if (this.isOpen) this._render();
        }, { type: 'persistent_notification/subscribe' });
        if (this._pnU && this._pnU.catch) this._pnU.catch(() => { this._pnU = null; });
      } catch (e) { this._pnU = null; }
    }
    _unsubPN() { const u = this._pnU; this._pnU = null; this._pn = {}; if (u) Promise.resolve(u).then((f) => { if (typeof f === 'function') f(); }).catch(() => {}); }
    update() {
      if (this.isOpen) { cancelAnimationFrame(this._rf); this._rf = requestAnimationFrame(() => this._render()); }
    }
    destroy() {
      this.close(false);
      this._unbind();
      cancelAnimationFrame(this._hr); cancelAnimationFrame(this._rf);
      if (this.host.parentNode) this.host.parentNode.removeChild(this.host);
    }
    _clock() {
      const ck = this.root.querySelector('.ck');
      if (!ck) return;
      const d = new Date(), t = `${M.pad(d.getHours())}:${M.pad(d.getMinutes())}`;
      if (ck.textContent !== t) ck.textContent = t;
    }

    /* ---- rendering */
    _render(force) {
      if (!this.isOpen && !force) return;
      if (this._busy) { this._dirty = true; return; }
      const h = this.hass;
      if (!h) return;
      const html = this.variant === 'nettbrett' ? this._htmlTab(h) : this._htmlMob(h);
      M.morph(this.pn, html);
      this._setExp(this.variant === 'nettbrett' ? 1 : this.exp);
      this._fit(this.variant === 'nettbrett' ? 1 : this.exp > 0.5 ? 1 : 0);
    }
    _top(h, sub, btns) {
      const d = new Date();
      const date = d.toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' });
      return `<div class="tb"><div><div class="ck num">${M.pad(d.getHours())}:${M.pad(d.getMinutes())}</div><div class="dt">${esc(date.charAt(0).toUpperCase() + date.slice(1))}</div><div class="sub ell">${esc(sub)}</div></div><span class="sp"></span>${btns}</div>`;
    }
    _settings() {
      if (!this.setOpen) return '';
      const S = this.sw();
      const row = (k, label, unit) => `<div><div class="lab"><span>${label}</span><span class="num">${S[k]}${unit}</span></div><input type="range" data-set="${k}" min="${LIM[k][0]}" max="${LIM[k][1]}" step="${LIM[k][2]}" value="${S[k]}"></div>`;
      return `<div class="set" data-nodrag><div class="sh">${M.icon('mdi:gesture-swipe-down', 20)}<span>Innstillinger for sveip</span><button class="ib press" data-a="set" aria-label="Lukk innstillinger">${M.icon('mdi:close', 20)}</button></div>
        <div class="lab"><span>Hvor sveipet kan starte</span></div><div class="seg">${ZONES.map(([v, l]) => `<button class="${S.zone === v ? 'on' : ''}" data-a="zone" data-v="${v}">${l}</button>`).join('')}</div>
        ${row('open', 'Avstand for å åpne', ' px')}${row('dead', 'Dødsone', ' px')}${row('rest', 'Ro i toppen', ' ms')}${row('wheel', 'Musehjul / styreflate', '')}
        <button class="rs press" data-a="reset">Tilbakestill</button></div>`;
    }
    _tileP(m) { return `<button class="tp press${m.on ? ' on' : ''}${m.dead ? ' dead' : ''}" data-a="tile" data-k="${m.key}" data-key="tp-${m.key}" aria-pressed="${m.on}"><span class="ci">${M.icon(m.icon, 22)}</span><span class="tx"><span class="nm ell">${esc(m.name)}</span><span class="st ell">${esc(m.status)}</span></span></button>`; }
    _lights(h) {
      const L = M.all(h, 'light', (s) => !Array.isArray(s.attributes.entity_id) && !M.unavailable(s));
      const on = L.filter((id) => h.states[id].state === 'on');
      const br = on.map((id) => h.states[id].attributes.brightness).filter((b) => b != null);
      const pct = this._slv != null ? this._slv : on.length ? Math.round((br.length ? br.reduce((a, b) => a + b, 0) / br.length : 255) / 2.55) : 0;
      return { L, on, pct };
    }
    _slider(kind, label, icon, pct, dim, val) {
      return `<div class="sl${dim ? ' dim' : ''}${pct > 30 ? ' lit' : ''}" data-sl="${kind}" data-key="sl-${kind}" role="slider" aria-label="${esc(label)}" aria-valuenow="${pct}"><span class="fl" style="width:${dim ? 0 : M.clamp(pct, 0, 100)}%"></span><span class="lb">${M.icon(icon, 22)}<span class="ell">${esc(label)}</span></span><span class="pv num">${esc(val)}</span></div>`;
    }
    _mini(h) {
      const pc = this.pc();
      const ids = Array.isArray(pc.players) && pc.players.length ? pc.players.filter((x) => h.states[x]) : M.all(h, 'media_player', (s) => !M.unavailable(s));
      if (!ids.length) return '';
      const rank = (id) => ({ playing: 0, paused: 1, buffering: 1, on: 2, idle: 3 }[h.states[id].state] ?? 4);
      const id = ids.slice().sort((a, b) => rank(a) - rank(b))[0], st = h.states[id], a = st.attributes || {};
      const play = st.state === 'playing';
      const t2 = [a.media_title, a.media_artist || a.app_name].filter(Boolean).join(' · ') || (play ? 'Spiller' : 'Ingenting spilles');
      const art = a.entity_picture ? `background-image:url('${esc(M.hjemPicUrl ? M.hjemPicUrl(h, a.entity_picture) : a.entity_picture)}')` : '';
      return `<div class="mp" data-key="mp"><button class="art press" data-a="media" aria-label="Åpne Media" style="${art}">${art ? '' : M.icon('mdi:music-note', 20)}</button><button class="mt" data-a="media"><span class="m1 ell">${esc(M.name(h, id))}</span><span class="m2 ell">${esc(t2)}</span></button><button class="pp press" data-a="pp" data-e="${esc(id)}" aria-label="${play ? 'Pause' : 'Spill av'}">${M.icon(play ? 'mdi:pause' : 'mdi:play', 22)}</button></div>`;
    }
    _notifs() {
      const L = (this._nl = buildNotifs(this));
      const card = (n) => {
        const acts = (n.actions || []).map(([l], i) => `<button class="ab press" data-a="nact" data-n="${esc(n.id)}" data-i="${i}">${esc(l)}</button>`).join('');
        const pg = n.progress != null ? `<div class="pg"><span style="width:${M.clamp(Number(n.progress) || 0, 0, 100)}%;background:${n.color}"></span></div>` : '';
        const img = n.img ? `<span class="snap" style="background-image:url('${esc(M.hjemPicUrl ? M.hjemPicUrl(this.hass, n.img) : n.img)}')"></span>` : '';
        const tone = M.theme && M.theme.tone ? M.theme.tone(n.color).bg : `color-mix(in srgb, ${n.color} 18%, transparent)`;
        return `<div class="nc" data-nc="${esc(n.id)}" data-key="nc-${esc(n.id)}"><span class="ni" style="background:${tone};color:${M.theme && M.theme.accentText ? M.theme.accentText(n.color) : n.color}">${M.icon(n.icon, 22)}</span><div class="nb"><span class="na ell">${esc(n.app)}${n.t ? ' · ' + hm(n.t) : ''}</span><span class="nt">${esc(n.title)}</span>${n.body ? `<span class="nx">${esc(n.body)}</span>` : ''}${pg}${acts ? `<div class="acts">${acts}</div>` : ''}</div>${img}</div>`;
      };
      return `<div class="nh"><span class="t">Varsler · ${L.length}</span>${L.length ? '<button class="ca press" data-a="clear">Fjern alle</button>' : ''}</div>
        <div class="nl" data-key="nl">${L.length ? L.map(card).join('') : '<div class="empty">Ingen varsler</div>'}</div>`;
    }
    _htmlMob(h) {
      const T = M.hurtigTiles(h, this.pc(), 'mobil'), wx = M.hurtigWx(h), n = homeCount(h);
      const lt = this._lights(h);
      return this._top(h, `${wx.txt} · ${n} hjemme`, `<button class="ib press" data-a="edit" aria-label="Rediger fliser">${M.icon('mdi:pencil-outline', 20)}</button><button class="ib press${this.setOpen ? ' on' : ''}" data-a="set" aria-label="Innstillinger for sveip">${M.icon('mdi:tune-variant', 20)}</button>`)
        + this._settings()
        + `<div class="rr">${T.slice(0, 6).map((m) => `<button class="rt press${m.on ? ' on' : ''}${m.dead ? ' dead' : ''}" data-a="tile" data-k="${m.key}" data-key="rt-${m.key}" aria-label="${esc(m.name + ': ' + m.status)}" aria-pressed="${m.on}">${M.icon(m.icon, 24)}</button>`).join('')}</div>`
        + `<div class="ex"><div class="exi">${this._slider('lights', 'Alle lys', 'mdi:lightbulb-group', lt.pct, !lt.on.length, lt.on.length ? lt.pct + ' %' : 'Av')}<div class="tg">${T.map((m) => this._tileP(m)).join('')}</div>${this._mini(h)}</div></div>`
        + this._notifs()
        + `<div class="hd"><span class="hb"></span><span class="ht">${this.exp > 0.5 ? 'Dra opp for å lukke' : 'Dra ned for flere fliser'}</span></div>`;
    }
    _htmlTab(h) {
      const pc = this.pc(), T = M.hurtigTiles(h, pc, 'nettbrett'), wx = M.hurtigWx(h);
      const scr = entOf(h, pc, 'screen'), ss = scr && h.states[scr];
      let sp = this._slv != null ? this._slv : null;
      if (sp == null && ss) sp = scr.startsWith('light.') ? (ss.state === 'on' ? Math.round((ss.attributes.brightness || 255) / 2.55) : 0) : M.isNum(ss.state) ? Math.round((Number(ss.state) - (ss.attributes.min || 0)) / (((ss.attributes.max || 255) - (ss.attributes.min || 0)) || 1) * 100) : 0;
      const off = entOf(h, pc, 'screen_switch') || (scr && scr.startsWith('light.') ? scr : null);
      return this._top(h, `${pc.panel_name || 'Stue-panel'} · ${wx.txt}`, `<button class="ib press" data-a="edit" aria-label="Rediger">${M.icon('mdi:pencil-outline', 20)}</button><button class="ib press${this.setOpen ? ' on' : ''}" data-a="set" aria-label="Innstillinger for sveip">${M.icon('mdi:tune-variant', 20)}</button><button class="ib press" data-a="settings" aria-label="Innstillinger">${M.icon('mdi:cog-outline', 20)}</button>${off ? `<button class="ib press" data-a="scroff" data-e="${esc(off)}" aria-label="Skjerm av">${M.icon('mdi:monitor-off', 20)}</button>` : ''}`)
        + this._settings()
        + `<div class="cols"><div class="lc">${this._slider('screen', ss ? 'Skjermens lysstyrke' : 'Skjermens lysstyrke · velg entitet', 'mdi:brightness-6', sp || 0, !ss, ss ? (sp || 0) + ' %' : '–')}<div class="tg">${T.map((m) => this._tileP(m)).join('')}</div>${this._mini(h)}</div><div class="rc">${this._notifs()}</div></div>`
        + `<div class="hd"><span class="hb"></span><span class="ht">Dra opp for å lukke</span></div>`;
    }

    /* ---- hendelser */
    _bind() {
      const W = window;
      this._L = [];
      const on = (t, ev, fn, o) => { t.addEventListener(ev, fn, o); this._L.push([t, ev, fn, o]); };
      // Scroll: tidspunktet siden nådde toppen (ro i toppen) + sperre for musehjul-etterskli
      on(W, 'scroll', () => {
        const top = scrollTopOf(this.owner) <= 2;
        if (top && !this._wasTop) { this._topAt = now(); this._wheelLock = now() + this.sw().rest; }
        this._wasTop = top;
        this._hintSoon();
      }, { passive: true, capture: true });
      on(W, 'hashchange', () => { if (this.isOpen && !this.active()) this.close(); this._hintSoon(); });
      on(W, 'ki-sheet', () => this._hintSoon());
      on(W, 'resize', () => { if (this.isOpen) this._place(); this._hintSoon(); });
      // ---- åpne-gest: touch
      on(W, 'touchstart', (e) => this._gStart(e, e.touches[0], 'touch'), { passive: true, capture: true });
      on(W, 'touchmove', (e) => this._gMove(e, e.touches[0]), { passive: false, capture: true });
      on(W, 'touchend', (e) => this._gEnd(e), { passive: true, capture: true });
      on(W, 'touchcancel', (e) => this._gEnd(e, true), { passive: true, capture: true });
      // ---- mus (pointer)
      on(W, 'pointerdown', (e) => { if (e.pointerType === 'mouse' && e.button === 0) this._gStart(e, e, 'mouse'); }, { capture: true });
      on(W, 'pointermove', (e) => { if (e.pointerType === 'mouse') this._gMove(e, e); }, { capture: true });
      on(W, 'pointerup', (e) => { if (e.pointerType === 'mouse') this._gEnd(e); }, { capture: true });
      on(W, 'click', (e) => { if (this._eat && now() < this._eat) { e.preventDefault(); e.stopPropagation(); this._eat = 0; } }, { capture: true });
      // ---- musehjul / styreflate
      on(W, 'wheel', (e) => this._wheel(e), { passive: true, capture: true });
      // ---- inni panelet
      const R = this.root;
      on(R, 'click', (e) => this._click(e));
      on(R, 'input', (e) => { const r = e.target.closest && e.target.closest('[data-set]'); if (r) this._setVal(r.dataset.set, Number(r.value), true); });
      on(R, 'change', (e) => { const r = e.target.closest && e.target.closest('[data-set]'); if (r) this._setVal(r.dataset.set, Number(r.value)); });
      on(this.scrim, 'click', () => this.close());
      on(this.pn, 'pointerdown', (e) => this._pDown(e));
      on(this.pn, 'pointermove', (e) => this._pMove(e));
      on(this.pn, 'pointerup', (e) => this._pUp(e));
      on(this.pn, 'pointercancel', (e) => this._pUp(e, true));
      on(this.pn, 'touchmove', (e) => { if (this._p && this._p.mode && this._p.mode !== 'scroll') e.preventDefault(); }, { passive: false });
      on(this.pn, 'wheel', (e) => this._pWheel(e), { passive: true });
    }
    _unbind() { (this._L || []).forEach(([t, ev, fn, o]) => t.removeEventListener(ev, fn, o)); this._L = []; }
    _canStart(e, pt) {
      if (this.isOpen || !pt) return false;
      const path = e.composedPath ? e.composedPath() : [];
      if (path.some((n) => n && PANEL_TAGS.has(n.tagName))) return false;
      if (!this.active()) return false;
      if (scrollTopOf(this.owner) > 2) return false;
      if (now() - this._topAt < this.sw().rest) return false;
      const S = this.sw(), D = M.dashRect(), y = pt.clientY - D.top;
      if (pt.clientX < D.left || pt.clientX > D.left + D.width) return false;
      if (S.zone === 'kant' && y > 80) return false;
      if (S.zone === 'ovre' && y > D.height * 0.45) return false;
      if (inHScroll(path)) return false;
      return true;
    }
    _gStart(e, pt, src) {
      if (!this._canStart(e, pt)) { this._g = null; return; }
      this._g = { x: pt.clientX, y: pt.clientY, src, mode: 'pending', id: e.pointerId };
    }
    _gMove(e, pt) {
      const g = this._g;
      if (!g || !pt) return;
      const dx = pt.clientX - g.x, dy = pt.clientY - g.y;
      if (g.mode === 'pending') {
        if (Math.abs(dy) <= 10 && Math.abs(dx) <= 10) return;
        if (dy > 10 && dy > Math.abs(dx)) { g.mode = 'pull'; this._place(); this._render(true); this._setExp(0); this.pn.classList.add('vis'); this.scrim.classList.remove('on'); this.hint.classList.remove('on'); }
        else { this._g = null; return; }
      }
      if (e.cancelable) e.preventDefault();
      const S = this.sw();
      g.pull = Math.max(0, dy - S.dead);
      this._paint(g.pull, false);
    }
    _gEnd(e, cancel) {
      const g = this._g;
      this._g = null;
      if (!g || g.mode !== 'pull') return;
      this._eat = now() + 400;
      const S = this.sw(), H = this.pn.offsetHeight || 400, p = g.pull || 0;
      if (!cancel && p > Math.min(S.open, H - 40)) { M.haptic('medium'); this.open(this.variant === 'mobil' && p > H + 90 ? 2 : 1); }
      else { this._paint(0, true); setTimeout(() => { if (!this.isOpen) { this.pn.classList.remove('vis'); this._setExp(0); } }, 340); }
    }
    _wheel(e) {
      if (this.isOpen) return;
      const t = now();
      if (e.deltaY > 0) { this._wAcc = 0; return; }
      if (t < this._wheelLock) { this._wheelLock = t + 160; this._wAcc = 0; return; }
      if (!this.active() || scrollTopOf(this.owner) > 2 || t - this._topAt < this.sw().rest) { this._wAcc = 0; return; }
      const path = e.composedPath ? e.composedPath() : [];
      if (path.some((n) => n && PANEL_TAGS.has(n.tagName))) return;
      if (t - this._wT > 300) this._wAcc = 0;
      this._wT = t;
      this._wAcc += -e.deltaY * (e.deltaMode === 1 ? 16 : 1);
      if (this._wAcc > this.sw().wheel) { this._wAcc = 0; M.haptic('medium'); this.open(1); }
    }
    _pWheel(e) {
      if (!this.isOpen) return;
      const path = e.composedPath ? e.composedPath() : [];
      if (path.some((n) => n && n.classList && (n.classList.contains('nl') || n.classList.contains('set')))) return;
      if (this.pn.scrollHeight > this.pn.clientHeight + 2) return;
      const t = now();
      if (t - (this._pwT || 0) > 300) this._pwA = 0;
      this._pwT = t;
      this._pwA = (this._pwA || 0) + e.deltaY * (e.deltaMode === 1 ? 16 : 1);
      if (this._pwA > 60) { this._pwA = 0; if (this.variant === 'mobil' && this.exp > 0.5) this._setExp(0, true); else this.close(); }
      else if (this._pwA < -60 && this.variant === 'mobil' && this.exp < 0.5) { this._pwA = 0; M.haptic('light'); this._setExp(1, true); }
    }
    // Dra inni panelet: nivå 1 ↔ 2, lukk ved dra opp; sveip varsler sideveis; slidere
    _pDown(e) {
      if (!this.isOpen || (e.pointerType === 'mouse' && e.button !== 0)) return;
      const path = e.composedPath();
      const el = (sel) => path.find((n) => n && n.nodeType === 1 && n.matches && n.matches(sel));
      if (el('input,select,textarea')) return;
      const sl = el('[data-sl]');
      if (sl) { if (sl.classList.contains('dim')) { if (sl.dataset.sl === 'screen' && !entOf(this.hass, this.pc(), 'screen')) { M.haptic('light'); this.edit('hurtigpanel'); } return; } e.stopPropagation(); this._p = { mode: 'slide', sl, kind: sl.dataset.sl, id: e.pointerId }; try { sl.setPointerCapture(e.pointerId); } catch (x) { /* */ } this._busy = true; this._slide(e); return; }
      const nc = el('[data-nc]'), nl = el('.nl');
      const scrollable = this.pn.scrollHeight > this.pn.clientHeight + 2;
      this._p = { x: e.clientX, y: e.clientY, mode: null, id: e.pointerId, nc, nl, base: this.exp > 0.5 ? 1 : 0, scrollable, onHd: !!el('.hd,.tb'), noDrag: !!el('[data-nodrag]') };
    }
    _pMove(e) {
      const p = this._p;
      if (!p || e.pointerId !== p.id) return;
      if (p.mode === 'slide') { this._slide(e); return; }
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      if (!p.mode) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        if (Math.abs(dx) > Math.abs(dy) && p.nc) { p.mode = 'swipe'; p.nc.classList.add('drag'); }
        else if (Math.abs(dy) >= Math.abs(dx)) {
          // Rullbar varselliste / rullbart panel (lave skjermer) / innstillingene: nettleseren ruller, panelet står
          const listScroll = p.nl && p.nl.scrollHeight > p.nl.clientHeight + 2;
          if (listScroll || p.noDrag || (p.scrollable && !p.onHd)) { p.mode = 'scroll'; return; }
          p.mode = 'drag';
        } else { p.mode = 'scroll'; return; }
        try { this.pn.setPointerCapture(e.pointerId); } catch (x) { /* */ }
      }
      if (p.mode === 'scroll') return;
      if (p.mode === 'swipe') {
        p.dx = dx;
        p.nc.style.transform = `translateX(${dx}px)`;
        p.nc.style.opacity = String(M.clamp(1 - Math.abs(dx) / 300, 0.2, 1));
        return;
      }
      // drag
      p.dy = dy;
      const R = 220;
      let lift = 0, ex = this.exp;
      if (this.variant === 'nettbrett') { lift = Math.min(0, dy); }
      else if (dy >= 0) ex = M.clamp(p.base + dy / R, 0, 1);
      else if (p.base === 1) { ex = M.clamp(1 + dy / R, 0, 1); lift = Math.min(0, dy + R); }
      else lift = dy;
      if (this.variant === 'mobil') this._setExp(ex);
      p.lift = lift;
      this.pn.classList.remove('anim');
      this.pn.style.transform = `translateY(${lift}px)`;
      const H = this.pn.offsetHeight || 400;
      this.scrim.style.transition = 'none';
      this.scrim.style.opacity = String(M.clamp(1 + lift / H, 0, 1));
    }
    _pUp(e, cancel) {
      const p = this._p;
      if (!p || e.pointerId !== p.id) return;
      this._p = null;
      if (p.mode === 'slide') { this._busy = false; if (!cancel) this._slideEnd(p); else { this._slv = null; } if (this._dirty) { this._dirty = false; this._render(); } return; }
      if (p.mode === 'swipe') {
        const lim = this.variant === 'nettbrett' ? 130 : 110;
        p.nc.classList.remove('drag');
        if (!cancel && Math.abs(p.dx || 0) > lim) {
          p.nc.style.transform = `translateX(${(p.dx > 0 ? 1 : -1) * 420}px)`; p.nc.style.opacity = '0';
          M.haptic('light');
          setTimeout(() => this._dismissN(p.nc.dataset.nc), 220);
        } else { p.nc.style.transform = ''; p.nc.style.opacity = ''; }
        this._eat = now() + 300;
        return;
      }
      if (p.mode !== 'drag') return;
      this._eat = now() + 300;
      const close = this.variant === 'nettbrett' ? 110 : 90;
      if ((p.lift || 0) < -close) { this.close(); return; }
      this.pn.classList.add('anim');
      this.pn.style.transform = 'translateY(0)';
      this.scrim.style.transition = 'opacity .3s ease';
      this.scrim.style.opacity = '1';
      if (this.variant === 'mobil') {
        const thr = p.base === 0 ? 0.3 : 0.7, to = this.exp >= thr ? 1 : 0;
        if ((to === 1) !== (p.base === 1)) M.haptic('light');
        this._setExp(to, true);
      }
    }
    // ---- slidere (Alle lys / skjermens lysstyrke)
    _slide(e) {
      const p = this._p, r = p.sl.getBoundingClientRect();
      const v = Math.round(M.clamp((e.clientX - r.left) / r.width, 0.01, 1) * 100);
      this._slv = v;
      const fl = p.sl.querySelector('.fl'), pv = p.sl.querySelector('.pv');
      if (fl) fl.style.width = v + '%';
      if (pv) pv.textContent = v + ' %';
      p.sl.classList.toggle('lit', v > 30);
      if (p.lastH == null || Math.abs(p.lastH - v) >= 10) { p.lastH = v; M.haptic('selection'); }
    }
    _slideEnd(p) {
      const h = this.hass, v = this._slv;
      this._slv = null;
      if (v == null || !h) return;
      if (p.kind === 'lights') {
        const on = this._lights(h).on;
        if (on.length) M.call(h, 'light', 'turn_on', { entity_id: on, brightness_pct: v });
      } else if (p.kind === 'screen') {
        const id = entOf(h, this.pc(), 'screen');
        if (!id) return;
        if (id.startsWith('light.')) M.call(h, 'light', 'turn_on', { entity_id: id, brightness_pct: v });
        else { const a = h.states[id].attributes || {}, mn = Number(a.min || 0), mx = Number(a.max || 255); M.call(h, id.split('.')[0], 'set_value', { entity_id: id, value: Math.round(mn + (mx - mn) * v / 100) }); }
      }
    }
    _setVal(k, v, live) {
      const cur = clampSet(lsGet(lsKey(this.variant))) || {};
      const next = clampSet({ ...cur, [k]: v });
      lsSet(lsKey(this.variant), next);
      const lab = this.root.querySelector(`[data-set="${k}"]`);
      const sp = lab && lab.parentNode.querySelector('.lab .num');
      if (sp) sp.textContent = next[k] + (k === 'open' || k === 'dead' ? ' px' : k === 'rest' ? ' ms' : '');
      if (!live) M.haptic('selection');
    }
    _dismissN(id) {
      const n = (this._nl || []).find((x) => x.id === id);
      if (n) { if (n.onDismiss) { try { n.onDismiss(); } catch (e) { /* */ } } dismiss(n.id, n.sig != null ? String(n.sig) : '*' + dayKey()); if (n.kind === 'ha') delete this._pn[n.id.slice(3)]; }
      this._render();
    }
    _click(e) {
      const b = e.target.closest && e.target.closest('[data-a]');
      if (!b) return;
      const a = b.dataset.a, h = this.hass;
      switch (a) {
        case 'tile': return tileAct(this, b.dataset.k);
        case 'edit': M.haptic('light'); return this.edit('hurtigpanel');
        case 'set': M.haptic('light'); this.setOpen = !this.setOpen; return this._render();
        case 'zone': M.haptic('selection'); this._setVal('zone', b.dataset.v); return this._render();
        case 'reset': M.haptic('medium'); lsSet(lsKey(this.variant), null); M.toast('Sveip-innstillingene er tilbakestilt'); return this._render();
        case 'media': M.haptic('light'); return this.go('#media');
        case 'pp': M.haptic('light'); return M.call(h, 'media_player', 'media_play_pause', { entity_id: b.dataset.e });
        case 'settings': M.haptic('light'); return this.go('#settings');
        case 'scroff': M.haptic('medium'); this.close(); return M.call(h, b.dataset.e.split('.')[0], 'turn_off', { entity_id: b.dataset.e });
        case 'clear': {
          M.haptic('medium');
          const L = (this._nl || []).slice();
          this.root.querySelectorAll('.nc').forEach((x, i) => { x.style.transitionDelay = i * 30 + 'ms'; x.style.transform = 'translateX(420px)'; x.style.opacity = '0'; });
          setTimeout(() => { L.forEach((n) => { if (n.onDismiss) { try { n.onDismiss(); } catch (x) { /* */ } } dismiss(n.id, n.sig != null ? String(n.sig) : '*' + dayKey()); }); this._pn = {}; this._render(); }, 260);
          return;
        }
        case 'nact': {
          const n = (this._nl || []).find((x) => x.id === b.dataset.n), A = n && (n.actions || [])[Number(b.dataset.i)];
          if (!A) return;
          M.haptic('light');
          if (A[1] === 'dismiss') { const c = b.closest('.nc'); if (c) { c.style.transform = 'translateX(420px)'; c.style.opacity = '0'; } setTimeout(() => this._dismissN(n.id), 220); return; }
          try { const r = A[1](); if (r && r.catch) r.catch((x) => M.toast('Feil: ' + (x && x.message ? x.message : x))); } catch (x) { M.toast('Feil: ' + x.message); }
          return;
        }
      }
    }
  }

  /* ------------------------------------------------------------ editor-skjema (GUI-editor = kortets egen «Tilpass») */
  // pre = sti-prefiks til panelconfigen i kortets config ('hurtigpanel.' i msh-hjem-card / msh-stue-card)
  const DOMS = { alarm: ['alarm_control_panel'], lock: ['lock'], garage: ['cover'], dnd: ['input_boolean', 'switch'], heat: ['climate'], vac: ['vacuum'], guest: ['switch'], night: ['input_boolean', 'script', 'scene'], screen: ['light', 'number'], screen_switch: ['switch', 'light'] };
  const NOTIF_KINDS = [['ring', 'Ringeklokke'], ['appliance', 'Hvitevarer'], ['power', 'Dyr strømtime'], ['tesla', 'Tesla lader'], ['vacuum', 'Støvsuger utilgjengelig'], ['avfall', 'Søppel i morgen'], ['ha', 'Home Assistant-varsler']];
  M.hurtigSchema = function (pre, variant) {
    const ent = (k, label) => ({ type: 'entity', name: pre + 'entities.' + k, label, domain: DOMS[k], domains: DOMS[k].join(','), auto: (h, c) => (h && AUTO[k] ? AUTO[k](h, variant) : null) });
    const tab = variant === 'nettbrett';
    return { type: 'section', id: 'hurtigpanel', label: 'Hurtigpanel (dra ned)', icon: 'mdi:gesture-swipe-down', fields: [
      { type: 'info', label: tab ? 'Nedtrekkspanelet på nettbrettet: dra ned fra headeren i Hjem-fanen (eller musehjul opp i toppen).' : 'Dra ned fra toppen av Hjem (siden må stå i ro øverst) for hurtigfliser og varsler. Sveip-innstillingene (sone, avstand, dødsone …) ligger i panelet (tune-knappen) og gjelder bare denne enheten.' },
      { type: 'boolean', name: pre + 'enabled', label: 'Hurtigpanel', default: true },
      { type: 'boolean', name: pre + 'show_hint', label: 'Vis hint-streken øverst', default: true },
      ...(tab ? [{ type: 'select', name: pre + 'shade_layout', label: 'Oppsett', options: [['delt', 'Delt (to kolonner)'], ['sentrert', 'Sentrert (én kolonne)']], default: 'delt' }, { type: 'text', name: pre + 'panel_name', label: 'Navn i toppfeltet', placeholder: 'Stue-panel' }] : []),
      { type: 'order', name: pre + 'tiles', hiddenName: pre + 'hidden_tiles', label: tab ? 'Fliser (rekkefølge · skjul)' : 'Fliser (de 6 første vises som runde i nivå 1)', options: TILES.map((t) => [t[0], t[0] === 'night' && tab ? 'Nattmodus' : t[1]]) },
      ent('alarm', 'Alarm'), ent('lock', 'Dørlås'), ent('garage', 'Garasjeport'), ent('dnd', 'Ikke forstyrr'), ent('heat', 'Varmepumpe'), ent('vac', 'Støvsuger'), ent('guest', 'Gjeste-Wi-Fi'), ent('night', tab ? 'Nattmodus' : 'Natta'),
      ...(tab ? [ent('screen', 'Skjermens lysstyrke'), ent('screen_switch', 'Skjerm av (bryter)')] : []),
      { type: 'entities', name: pre + 'players', label: 'Minispiller (tom = alle mediespillere)', domain: 'media_player', domains: 'media_player', multiple: true },
      { type: 'order', name: pre + 'notif_order', hiddenName: pre + 'hidden_notifs', label: 'Varsler (skjul typer)', options: NOTIF_KINDS },
      { type: 'button', label: 'Nullstill fjernede varsler', icon: 'mdi:bell-ring-outline', run: () => { lsSet(DIS, null); M.toast('Fjernede varsler vises igjen'); } },
    ].filter(Boolean) };
  };

  M.hurtig = {
    DEF, LIM, ZONES, TILES, TILE_KEYS, lsKey,
    create: (owner, o) => new Ctl(owner, o),
    // Hjem (mobil): ett panel per msh-hjem-card
    attach(hj) {
      if (hj.__hurtig) return hj.__hurtig;
      hj.__hurtig = new Ctl(hj, {
        variant: 'mobil',
        cfg: () => (hj.config || {}).hurtigpanel || {},
        onEdit: () => { if (M.openEditor) M.openEditor(hj, { focus: 'hurtigpanel' }); },
        props: () => (hj.config || {}).hurtigpanel || {},
      });
      return hj.__hurtig;
    },
    detach(hj) { if (hj.__hurtig) { hj.__hurtig.destroy(); hj.__hurtig = null; } },
  };
})();
