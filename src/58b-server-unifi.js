/* Server → Nettverk · UniFi (Fiks 50 del H, I, J og M) – egen modul som msh-server-card (58-server.js) kaller.
 *   M.serverUnifi = { css, discover(hass, R, cfg), prosa(hass, R, cfg), html(host, sub, R), bind(host, el, sub, R), editorFields(hass, cfg) }
 *   sub: 'udm' (M: enhetskort · WAN-latens 24 t · handlinger – under Internett-kortet som 58-server tegner),
 *        'enheter' (H: utvidbar rad per UniFi-enhet), 'switch' (H/J/I: velgerfliser, portkort, portdetaljer, hold-meny).
 * Oppdagelse: én enhet per UniFi-enhet i enhetsregisteret (R.per.unifi = registeroppføringer gruppert på device_id, ellers
 *   hass.entities med platform unifi). Entitetene finnes via device_id – aldri gjettede navn. Typer gw/sw/ap. Porter fra
 *   *_port_N_link_speed, switch.*_port_N, switch.*_port_N_poe, sensor.*_port_N_poe_power, button.*_port_N_power_cycle og
 *   SFP fra *_sfp_N_*. Duplikat-suffiks (_2) på enhetssensorer godtas (cpu_utilisation_2 …).
 * Config: unifi_order (enhets-ID-er i rekkefølge) · unifi_hidden (skjulte enhets-ID-er) · poe_budget (tall, eller
 *   { <device_id>: W }) – i Tilpass og GUI-editoren via editorFields (samme skjema). exclude (58-server) respekteres også.
 * Vertsgrensesnitt (host = server-kortet): hass, config, ui, setUI(patch), update()/render(), haptic(t), moreInfo(id),
 *   go(tab, sub, extra) (extra flettes inn i host.ui – «Porter» sender { dev }), confirm(text) → Promise<bool>.
 *   Mangler confirm/moreInfo/haptic brukes egne reserver (portalt bekreftelsesark, MSH.moreInfo, MSH.haptic).
 * UI-tilstand i host.ui: suDx (utvidet enhet), suSw (valgt switch), suPort (valgt port), dev (fra go()).
 * Klasser su-*, attributter data-su-*. Farger: tokens med mørk fallback (ki-theme), aksent-tekst via --ki-*-text.
 */
(function () {
  const M = window.MSH;
  if (!M || M.serverUnifi) return;
  const esc = M.esc, C = M.C;
  const GR = C.green, BL = C.blue, OR = C.orange, RD = C.red, PU = C.purple, PK = C.pink;
  const acc = (n, hex) => `color-mix(in srgb, var(--ki-${n}-text, var(--${n}, ${hex})) calc(100% - (var(--ki-tone-k, 1) - 1) * 50%), black)`;
  const TX = { green: acc('green', '#66d19e'), blue: acc('blue', '#73b9f2'), orange: acc('orange', '#f2b573'), red: acc('red', '#f28073'), purple: acc('purple', '#ad99e6') };
  const TXC = (c) => (c === GR ? TX.green : c === BL ? TX.blue : c === OR ? TX.orange : c === RD ? TX.red : c === PU ? TX.purple : c);
  const tone = (c, a = 0.16) => `color-mix(in srgb, ${c} calc(${Math.round(a * 100)}% * var(--ki-tone-k, 1)), transparent)`;
  const S = 'var(--ki-surface, #3a3a3a)', S2 = 'var(--ki-surface-2, #404040)', S3 = 'var(--ki-surface-3, #2f2f2f)', CTRL = 'var(--ki-ctrl, #545454)';
  const T = 'var(--ki-text, #fafafa)', T1 = 'var(--ki-text-1, #e1e1e1)', T1b = 'var(--ki-text-1, #c7c7c7)', T2 = 'var(--ki-text-2, #afafaf)', TM = 'var(--ki-text-mid, #979797)', T3t = 'var(--ki-text-mid, #7f7f7f)';
  const LINE = 'var(--ki-line, rgba(255,255,255,0.05))';
  const TTL = 300000;

  /* ------------------------------------------------------------ hjelpere */
  const BAD = ['unavailable', 'unknown', '', 'none', null, undefined];
  const okS = (s) => !!s && !BAD.includes(s.state);
  const obj = (id) => id.slice(id.indexOf('.') + 1);
  const dom = (id) => id.slice(0, id.indexOf('.'));
  const tittel = (t) => String(t).replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/^./, (c) => c.toUpperCase());
  const stOf = (h, id) => (h && id && h.states[id]) || null;
  const numOf = (h, id) => { const s = stOf(h, id); if (!okS(s)) return null; const v = parseFloat(String(s.state).replace(',', '.')); return isNaN(v) ? null : v; };
  const unitOf = (h, id) => { const s = stOf(h, id); return (s && s.attributes && s.attributes.unit_of_measurement) || ''; };
  const nf = (v, d = 0) => (v == null || isNaN(v) ? '–' : M.nf(v, d));
  const isOn = (h, id) => { const s = stOf(h, id); return !!s && s.state === 'on'; };
  const PORT_RE = /(?:^|_)(port|sfp)_(\d+)(?:_(link_speed|speed|poe_power|poe|power_cycle|rx|tx))?(?:_\d+)?$/;
  const isPortEnt = (o) => /(?:^|_)(port|sfp)_\d+(?:_|$)/.test(o);
  // enhetsnivå: objekt-ID (med eller uten duplikat-suffiks _2) eller translation_key – aldri port-entiteter
  const fx = (list, d, re) => {
    const e = list.find((x) => dom(x.entity_id) === d && !isPortEnt(obj(x.entity_id)) && (re.test(obj(x.entity_id)) || re.test(obj(x.entity_id).replace(/_\d+$/, '')) || (x.translation_key && re.test(x.translation_key))));
    return e ? e.entity_id : undefined;
  };
  // Oppetid (tidsstempel eller varighet) → «23 d 4 t» · «4 t 12 min» · «12 min»
  function oppetid(h, id) {
    const s = stOf(h, id);
    if (!okS(s)) return '–';
    let sek = null;
    if ((s.attributes && s.attributes.device_class === 'timestamp') || /^\d{4}-\d\d-\d\dT/.test(s.state)) { const t = Date.parse(s.state); if (!isNaN(t)) sek = Math.max(0, (Date.now() - t) / 1000); }
    else { const v = parseFloat(s.state), u = String((s.attributes && s.attributes.unit_of_measurement) || 's').toLowerCase(); if (!isNaN(v)) sek = v * (u.startsWith('d') ? 86400 : u.startsWith('h') || u === 't' ? 3600 : u.startsWith('min') ? 60 : 1); }
    if (sek == null) return String(s.state);
    const d = Math.floor(sek / 86400), t = Math.floor((sek % 86400) / 3600), m = Math.floor((sek % 3600) / 60);
    return d ? `${d} d ${t} t` : t ? `${t} t ${m} min` : `${m} min`;
  }
  // Link-hastighet → Mbit/s
  const mbitOf = (h, id) => { const v = numOf(h, id); if (v == null) return null; const u = unitOf(h, id); return /^g/i.test(u) ? v * 1000 : /^k/i.test(u) ? v / 1000 : /^b/i.test(u) && !/^bit/i.test(u) ? v * 8e-6 : v; };
  const spdTxt = (mb) => (mb == null || !(mb > 0) ? '–' : mb >= 1000 ? `${M.nf(mb / 1000, (mb / 1000) % 1 ? 1 : 0)} Gbit/s` : `${M.nf(mb)} Mbit/s`);
  const spdCls = (mb) => (mb == null ? 'g' : mb >= 2500 ? 'x' : mb >= 1000 ? 'g' : 'f');
  const SPC = { g: GR, x: BL, f: OR };
  const fw = (h, id) => { const s = stOf(h, id); if (!s) return null; return { on: s.state === 'on', ver: (s.attributes && (s.attributes.installed_version || s.attributes.current_version)) || null, latest: s.attributes && s.attributes.latest_version }; };
  const STATE_NB = { connected: 'Online', disconnected: 'Frakoblet', offline: 'Frakoblet', pending: 'Venter', upgrading: 'Oppgraderer', provisioning: 'Klargjør', adopting: 'Adopterer', heartbeat_missed: 'Mistet kontakt', firmware_mismatch: 'Feil fastvare', inform_error: 'Kontaktfeil', isolated: 'Isolert', deleting: 'Slettes', adoption_failed: 'Adopsjon feilet', getting_ready: 'Gjør klar', unavailable: 'Utilgjengelig', unknown: 'Ukjent' };
  // PoE-budsjett etter modell (W) – brukes når hverken config poe_budget eller en budsjett-sensor finnes
  const POE_MODEL = [[/pro.?max.?16.?poe/i, 180], [/pro.?max.?24.?poe/i, 400], [/pro.?max.?48.?poe/i, 720], [/pro.?8.?poe/i, 120], [/pro.?24.?poe/i, 400], [/pro.?48.?poe/i, 600],
    [/enterprise.?8.?poe/i, 120], [/enterprise.?24.?poe/i, 400], [/enterprise.?48.?poe/i, 720], [/lite.?8.?poe/i, 52], [/lite.?16.?poe/i, 45], [/usw.?16.?poe/i, 42],
    [/usw.?24.?poe/i, 95], [/usw.?48.?poe/i, 195], [/ultra.?210w/i, 210], [/ultra.?60w/i, 60], [/ultra/i, 42], [/flex.?2\.5g.?8.?poe/i, 60], [/(\d{2,3})w\b/i, null]];
  const modelBudget = (modell) => { for (const [re, w] of POE_MODEL) { const m = String(modell || '').match(re); if (m) return w != null ? w : +m[1]; } return null; };

  /* ------------------------------------------------------------ oppdagelse */
  let MEMO = null;
  function discover(hass, R, cfg) {
    cfg = cfg || {};
    const h = hass || {}, E = h.entities || {}, D = h.devices || {};
    let per = R && R.per && R.per.unifi;
    if (!per) {
      per = {};
      Object.values(E).forEach((e) => { if (e && e.platform === 'unifi' && !e.hidden && !e.hidden_by && !e.disabled_by && h.states && h.states[e.entity_id]) (per[e.device_id || '_'] = per[e.device_id || '_'] || []).push(e); });
    }
    const sig = JSON.stringify([Object.keys(per).map((k) => k + ':' + per[k].length), cfg.unifi_order || [], cfg.unifi_hidden || [], cfg.exclude || []]);
    if (MEMO && MEMO.E === E && MEMO.D === D && MEMO.sig === sig) return MEMO.out;
    const all = [];
    for (const [dev, list] of Object.entries(per)) {
      if (dev === '_') continue;
      const d = D[dev] || {};
      if (d.entry_type === 'service' || /wlan|network application|controller/i.test(d.model || '')) continue;
      const modell = d.model || '', navn = d.name_by_user || d.name || modell || 'UniFi';
      const f = (dd, re) => fx(list, dd, re);
      const cpu = f('sensor', /cpu_utili[sz]ation$/), mem = f('sensor', /memory_utili[sz]ation$/);
      const state = f('sensor', /(^|_)state$|device_state$/), restart = f('button', /(^|_)(restart|reboot)$/), upd = f('update', /./), led = f('light', /./);
      const P = {};
      list.forEach((e) => {
        const o = obj(e.entity_id), dd = dom(e.entity_id), m = o.match(PORT_RE);
        if (!m) return;
        const sfp = m[1] === 'sfp', n = +m[2], kind = m[3], key = (sfp ? 'S' : '') + n;
        const p = (P[key] = P[key] || { key, n, sfp, label: (sfp ? 'SFP ' : 'Port ') + n });
        const set = (k) => { if (!p[k]) p[k] = e.entity_id; };
        if (dd === 'switch' && !kind) set('en');
        else if (dd === 'switch' && kind === 'poe') set('poe');
        else if (dd === 'button' && kind === 'power_cycle') set('cyc');
        else if (dd === 'sensor' && kind === 'poe_power') set('pw');
        else if (dd === 'sensor' && (kind === 'link_speed' || kind === 'speed')) set('speed');
        else if (dd === 'sensor' && (kind === 'rx' || kind === 'tx')) set(kind);
      });
      let ports = Object.values(P);
      if (!cpu && !mem && !state && !restart && !upd && !ports.length && !led) continue; // klient (bare sporer/blokkering)
      const LN = { cloudflare: 'Cloudflare', google: 'Google', microsoft: 'Microsoft' }, LO = Object.keys(LN);
      const lat = list.filter((e) => dom(e.entity_id) === 'sensor' && /(^|_)wan\d?_latency(_\d+)?$/.test(obj(e.entity_id))).map((e) => {
        const m = obj(e.entity_id).match(/(?:^|_)([a-z0-9]+)_wan(\d?)_latency(?:_\d+)?$/), k = m ? m[1] : 'wan';
        return { id: e.entity_id, key: k, label: (LN[k] || tittel(k)) + (m && m[2] ? ' ' + m[2] : '') };
      }).sort((a, b) => (LO.indexOf(a.key) + 99) % 99 - (LO.indexOf(b.key) + 99) % 99 || a.label.localeCompare(b.label, 'nb'));
      const md = modell.toLowerCase();
      const type = lat.length || /dream|udm|udr|ucg|uxg|usg|gateway|\bux\b|express|cloud gateway/.test(md) ? 'gw'
        : ports.some((p) => !p.sfp) || /usw|switch|flex|\bus-|^us\d/.test(md) ? 'sw' : 'ap';
      // tomme porter mellom 1 og høyeste nummer (og modellens portantall for switcher) vises som «Ledig»
      const norm = ports.filter((p) => !p.sfp), maxN = norm.reduce((a, p) => Math.max(a, p.n), 0);
      const mN = type === 'sw' ? +((modell.match(/\b(5|8|10|16|24|48)\b/) || [])[1] || 0) : 0;
      for (let i = 1; i <= Math.max(maxN, mN); i++) if (!P[String(i)]) ports.push({ key: String(i), n: i, sfp: false, label: 'Port ' + i });
      ports = ports.sort((a, b) => (a.sfp ? 1 : 0) - (b.sfp ? 1 : 0) || a.n - b.n);
      // portnavn fra UniFi (vennlig navn uten enhetsnavn og «PoE»/«Power cycle»)
      const reN = new RegExp('^' + navn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*', 'i');
      ports.forEach((p) => {
        const id = p.poe || p.en || p.cyc; const fn = id && h.states[id] && h.states[id].attributes && h.states[id].attributes.friendly_name;
        const raw = fn ? String(fn).replace(reN, '').replace(/\s*(PoE|Power cycle|Strømsyklus|Link speed)$/i, '').trim() : '';
        p.name = !raw || raw === id || /^[a-z_]+\.[a-z0-9_]+$/.test(raw) || /^(port|sfp\+?)\s*\d+$/i.test(raw) ? '' : raw;
      });
      const area = d.area_id && h.areas && h.areas[d.area_id] ? h.areas[d.area_id].name : '';
      all.push({
        id: dev, navn, modell, area, type, ports, lat,
        tracker: f('device_tracker', /./), state, restart, upd, led, cpu, mem,
        clients: list.filter((e) => dom(e.entity_id) === 'sensor' && !isPortEnt(obj(e.entity_id)) && /(^|_)clients$/.test(obj(e.entity_id).replace(/_\d+$/, '')) && !/ghz|wlan|guest/.test(obj(e.entity_id))).map((e) => e.entity_id)[0],
        cpuTemp: f('sensor', /cpu_temperature$/), localTemp: f('sensor', /local_temperature$/),
        temp: (list.find((e) => dom(e.entity_id) === 'sensor' && !isPortEnt(obj(e.entity_id)) && /(^|_)temperature$/.test(obj(e.entity_id).replace(/_\d+$/, '')) && !/(cpu|local)_temperature/.test(obj(e.entity_id))) || {}).entity_id,
        uptime: f('sensor', /uptime$/), speedtest: f('button', /speed_?test/),
        budget: f('sensor', /(ac_power_budget|poe_budget|power_budget)$/), usage: f('sensor', /(ac_power_consumption|poe_power_consumption|power_consumption)$/),
      });
    }
    const ex = new Set(cfg.exclude || []), hid = new Set(cfg.unifi_hidden || []), ord = Array.isArray(cfg.unifi_order) ? cfg.unifi_order : [];
    const rek = { gw: 0, sw: 1, ap: 2 };
    all.sort((a, b) => {
      const ia = ord.indexOf(a.id), ib = ord.indexOf(b.id);
      if (ia !== -1 || ib !== -1) return (ia === -1 ? 1e6 : ia) - (ib === -1 ? 1e6 : ib);
      return rek[a.type] - rek[b.type] || a.navn.localeCompare(b.navn, 'nb');
    });
    const devs = all.filter((x) => !hid.has(x.id) && !(x.tracker && ex.has(x.tracker)) && !(x.cpu && ex.has(x.cpu)));
    const out = { all, devs, gw: devs.find((x) => x.type === 'gw') || null };
    MEMO = { E, D, sig, out };
    return out;
  }

  /* ------------------------------------------------------------ tilstand */
  const PEND = {}; // optimistiske brytere: id → { want, t }
  const pend = (h, id) => { const p = PEND[id], act = isOn(h, id); if (!p) return act; if (Date.now() - p.t > 15000 || act === p.want) { delete PEND[id]; return act; } return p.want; };
  const offline = (h, d) => {
    const st = stOf(h, d.state), tr = stOf(h, d.tracker);
    if (st && st.state !== 'connected' && st.state !== 'unknown') return true;
    if (tr && tr.state === 'not_home') return true;
    return false;
  };
  const stateLabel = (h, d) => { const st = stOf(h, d.state); if (st) return STATE_NB[st.state] || tittel(st.state); const tr = stOf(h, d.tracker); return tr ? (tr.state === 'home' ? 'Online' : 'Frakoblet') : '–'; };
  // Porter med tilstand: { …p, dis, up, mb, sp, poeCap, poeOn, w }
  function portsOf(h, d) {
    return d.ports.map((p) => {
      const dis = !!p.en && pend(h, p.en) === false && okS(stOf(h, p.en));
      const mb = mbitOf(h, p.speed);
      let up = false;
      if (!dis) {
        if (p.speed && okS(stOf(h, p.speed))) up = mb > 0;
        else if ((p.rx && okS(stOf(h, p.rx))) || (p.tx && okS(stOf(h, p.tx)))) up = (numOf(h, p.rx) || 0) + (numOf(h, p.tx) || 0) > 0;
        else up = (numOf(h, p.pw) || 0) > 0;
      }
      const w = numOf(h, p.pw), poeCap = !!(p.poe || p.pw);
      const poeOn = p.poe ? pend(h, p.poe) : (w || 0) > 0;
      return { ...p, dis, up, mb, sp: dis ? 'off' : up ? spdCls(mb) : '', poeCap, poeOn, w, live: up && poeCap && (w || 0) > 0 };
    });
  }
  const poeSum = (P) => P.reduce((a, p) => a + (p.w || 0), 0);
  const budgetOf = (h, cfg, d) => {
    const b = cfg && cfg.poe_budget;
    if (b != null && typeof b === 'object' && b[d.id] != null && +b[d.id] > 0) return +b[d.id];
    const sn = numOf(h, d.budget); if (sn != null && sn > 0) return sn;
    const mb = modelBudget(d.modell); if (mb) return mb;
    if (b != null && typeof b !== 'object' && +b > 0) return +b;
    return null;
  };

  /* ------------------------------------------------------------ prosa */
  function prosa(hass, R, cfg) {
    const h = hass, X = discover(h, R, cfg), pill = (t) => `<span class="pp">${esc(t)}</span>`;
    const off = X.devs.filter((d) => offline(h, d)).length;
    const ov = cfg && cfg.overrides && cfg.overrides.unifi_clients;
    let k = ov ? numOf(h, ov) : X.gw ? numOf(h, X.gw.clients) : null;
    if (k == null && !ov) { const v = X.devs.filter((d) => d.type !== 'gw').map((d) => numOf(h, d.clients)).filter((x) => x != null); k = v.length ? v.reduce((a, b) => a + b, 0) : null; }
    return `Nettet er ${pill(off ? `${off} ${off === 1 ? 'enhet' : 'enheter'} frakoblet` : 'helt oppe')} og ${pill(k == null ? '–' : `${M.nf(k)} ${k === 1 ? 'klient' : 'klienter'}`)} er tilkoblet.`;
  }

  /* ------------------------------------------------------------ WAN-latens: 24 timesnitt (history/history_during_period) */
  const LAT = { key: '', t: 0, busy: false, data: {} };
  function latLoad(host, ids) {
    const h = host.hass, key = ids.join(',');
    if (!ids.length || !h || !h.callWS || LAT.busy || host.isOpen === false) return;
    if (LAT.key === key && Date.now() - LAT.t < TTL) return;
    LAT.busy = true; LAT.key = key; LAT.t = Date.now();
    Promise.resolve().then(() => M.history(h, ids, 24)).catch(() => ({})).then((r) => {
      LAT.busy = false; LAT.data = r || {};
      if (host.isConnected === false) return;
      if (host.update) host.update(); else if (host.render) host.render();
    });
  }
  // Tidsvektet snitt per klokketime: 23 hele timer bak + inneværende time («nå»)
  function hourly(pts, now) {
    const h0 = new Date(now); h0.setMinutes(0, 0, 0);
    const start = h0.getTime() - 23 * 3600000, P = (pts || []).filter((p) => p && !isNaN(p.v)).sort((a, b) => a.t - b.t), out = [];
    for (let i = 0; i < 24; i++) {
      const a = start + i * 3600000, b = Math.min(a + 3600000, now);
      let sum = 0, dur = 0;
      for (let j = 0; j < P.length; j++) {
        const t0 = Math.max(P[j].t, a), t1 = Math.min(j + 1 < P.length ? P[j + 1].t : now, b);
        if (t1 > t0) { sum += P[j].v * (t1 - t0); dur += t1 - t0; }
      }
      out.push(dur > 0 ? sum / dur : null);
    }
    return { vals: out, start };
  }
  const latCol = (ms) => (ms > 60 ? RD : ms > 12 ? OR : GR);

  /* ------------------------------------------------------------ deler */
  const ic = (n, s, st) => M.icon(n, s, st || '');
  const tg = (on, attrs, label) => `<button class="su-tg${on ? ' on' : ''}" role="switch" aria-checked="${!!on}" aria-label="${esc(label)}" ${attrs}><i></i></button>`;
  const moreAttr = (id) => (id ? `data-su-act="more" data-su-id="${esc(id)}"` : 'data-su-act="none"');
  const pctTxt = (h, id) => { const v = numOf(h, id); return v == null ? '–' : M.nf(Math.round(v)); };
  const tempTxt = (h, id) => { const v = numOf(h, id); return v == null ? '–' : M.nf(Math.round(v)); };

  // M · UDM
  function udmHTML(host, X) {
    const h = host.hass, g = X.gw;
    if (!g) {
      return `<div class="su-udm" data-key="su-udm"><section class="su-card su-dev"><div class="su-top"><span class="su-ic44">${ic('mdi:router-network', 22)}</span><span class="su-tt"><b class="su-ell">Gateway</b><span class="su-ell">Fant ingen UniFi-gateway · Velg integrasjon i Tilpass</span></span><span class="su-chip none"><i></i>–</span></div></section></div>`;
    }
    const off = offline(h, g), lbl = stateLabel(h, g), chip = !g.state && !g.tracker ? 'none' : off || lbl !== 'Online' ? 'warn' : 'ok';
    const seg10 = (v, col) => Array.from({ length: 10 }, (_, i) => `<i style="background:${v != null && i < Math.max(1, Math.round(M.clamp(v, 0, 100) / 10)) ? col : S3}"></i>`).join('');
    const meter = (l, id, unit, colF) => { const v = numOf(h, id); return `<button class="su-mt" ${moreAttr(id)}><span class="su-ml">${esc(l)}</span><span class="su-mv"><span class="num">${v == null ? '–' : M.nf(Math.round(v))}</span><span>${v == null ? '' : unit}</span></span><span class="su-seg">${seg10(v, colF(v || 0))}</span></button>`; };
    const P = portsOf(h, g), upN = P.filter((p) => p.up).length;
    const sfp = P.filter((p) => p.sfp && p.speed), sfpP = sfp.find((p) => p.up) || sfp[0];
    const F = fw(h, g.upd);
    const cl = numOf(h, g.clients), lt = numOf(h, g.localTemp);
    const spec = (icon, l, v, id, cls) => `<button class="su-sp" ${moreAttr(id)}>${ic(icon, 20, `color:${TM}`)}<span class="su-spl">${esc(l)}</span><span class="su-spv${cls ? ' ' + cls : ''}">${esc(v)}</span></button>`;
    const firstPort = (P.find((p) => p.speed) || P.find((p) => p.en) || {});
    const specs = [
      spec('mdi:account-multiple', 'Klienter', cl == null ? '–' : M.nf(cl), g.clients),
      spec('mdi:clock-outline', 'Oppetid', oppetid(h, g.uptime), g.uptime),
      spec('mdi:lan', 'Porter', P.length ? `${upN} / ${P.length}` : '–', firstPort.speed || firstPort.en),
      spec('mdi:swap-vertical', 'SFP+', !sfpP ? '–' : sfpP.dis ? 'Av' : sfpP.up ? spdTxt(sfpP.mb) : 'Ledig', sfpP && sfpP.speed),
      spec('mdi:thermometer', 'Lokal temp', lt == null ? '–' : `${M.nf(Math.round(lt))}°`, g.localTemp),
      spec('mdi:check-decagram', 'Fastvare', !F ? '–' : F.on ? 'Ny' : 'Nyeste', g.upd, F && F.on ? 'warn' : ''),
    ];
    const dev = `<section class="su-card su-dev" data-key="su-udm-dev">
        <div class="su-top"><span class="su-ic44">${ic('mdi:router-network', 22)}</span><span class="su-tt"><b class="su-ell">${esc(g.navn)}</b><span class="su-ell">${esc([g.modell, g.area].filter(Boolean).join(' · ') || '–')}</span></span>
          <span class="su-chip ${chip}" ${moreAttr(g.state || g.tracker)}><i></i>${esc(chip === 'none' ? '–' : lbl)}</span></div>
        <div class="su-mts">${meter('CPU', g.cpu, '%', (v) => (v > 85 ? RD : v > 65 ? OR : GR))}${meter('Minne', g.mem, '%', () => PU)}${meter('CPU-temp', g.cpuTemp || g.temp, '°C', (v) => (v > 75 ? RD : v > 60 ? OR : BL))}</div>
        <div class="su-sps">${specs.join('')}</div></section>`;
    // WAN-latens
    latLoad(host, g.lat.map((l) => l.id));
    const now = Date.now();
    let tot = 0, nT = 0, t0 = null;
    const rows = g.lat.map((l) => {
      const cur = numOf(h, l.id), pts = (LAT.data[l.id] || []).slice();
      if (cur != null) pts.push({ t: now, v: cur });
      const H = hourly(pts, now); t0 = H.start;
      H.vals.forEach((v) => { if (v != null) { tot += v; nT++; } });
      const segs = H.vals.map((v, i) => `<i style="background:${v == null ? S3 : i === 23 ? latCol(v) : M.alpha(latCol(v), 0.5)}"></i>`).join('');
      return `<button class="su-lr" ${moreAttr(l.id)}><span class="su-ll su-ell">${esc(l.label)}</span><span class="su-ls">${segs}</span><span class="su-lv"><span class="num">${cur == null ? '–' : M.nf(Math.round(cur))}</span><span>ms</span></span></button>`;
    });
    if (!nT) g.lat.forEach((l) => { const v = numOf(h, l.id); if (v != null) { tot += v; nT++; } });
    const hh = t0 != null ? String(new Date(t0).getHours()).padStart(2, '0') + ':00' : '–';
    const lat = `<section class="su-card su-lat" data-key="su-udm-lat"><div class="su-lh"><span>WAN-latens</span><span>siste 24 t · snitt ${nT ? M.nf(Math.round(tot / nT)) + ' ms' : '–'}</span></div>
        ${rows.length ? rows.join('') + `<div class="su-lax"><span></span><span><span>${hh}</span><span>nå</span></span><span></span></div>` : '<div class="su-none">– · Fant ingen WAN-latens-sensorer</div>'}</section>`;
    const upd = F && F.on;
    const acts = `<div class="su-acts" data-key="su-udm-acts">
        <button class="su-ap" data-su-act="go" data-su-tab="net" data-su-sub="switch" data-su-dev="${esc(g.id)}" data-su-hap="selection">${ic('mdi:lan', 20)}<span>Porter</span></button>
        <button class="su-ap" ${g.upd ? `data-su-act="${upd ? 'install' : 'more'}" data-su-id="${esc(g.upd)}" data-su-name="${esc(g.navn)}"` : 'disabled'}>${ic(upd ? 'mdi:download' : 'mdi:tray-arrow-down', 20)}<span>${upd ? 'Oppdater' : 'Fastvare'}</span></button>
        <button class="su-ap hot" ${g.restart ? `data-su-act="press" data-su-id="${esc(g.restart)}" data-su-confirm="${esc(`Starte ${g.navn} på nytt? Nettet blir borte noen minutter.`)}" data-su-toast="${esc(g.navn)} starter på nytt"` : 'disabled'}>${ic('mdi:restart', 20)}<span>Start på nytt</span></button></div>`;
    return `<div class="su-udm" data-key="su-udm">${dev}${lat}${acts}</div>`;
  }

  // H · Enheter
  function enheterHTML(host, X) {
    const h = host.hass, ui = host.ui || {}, cfg = host.config || {}, L = X.devs;
    if (!L.length) return `<section class="su-card su-devs"><div class="su-ch"><span>Enheter</span><span>–</span></div><div class="su-none in">– · Fant ingen UniFi-enheter</div></section>`;
    const ICON = { gw: 'mdi:router-network', sw: 'mdi:lan', ap: 'mdi:wifi' };
    let online = 0;
    const rows = L.map((d) => {
      const off = offline(h, d); if (!off) online++;
      const P = portsOf(h, d), upN = P.filter((p) => p.up).length, poeCap = P.some((p) => p.poeCap), poe = poeSum(P), cl = numOf(h, d.clients);
      const meta = off ? 'Frakoblet' : d.type === 'sw' ? (poeCap ? `${upN} porter · ${nf(poe, poe < 10 && poe % 1 ? 1 : 0)} W PoE` : `${upN} porter oppe`) : cl != null ? `${M.nf(cl)} ${cl === 1 ? 'klient' : 'klienter'}` : '–';
      const open = ui.suDx === d.id;
      return `<div class="su-dw${open ? ' open' : ''}" data-key="su-d-${esc(d.id)}"><button class="su-dr" data-su-act="dx" data-su-v="${esc(d.id)}" aria-expanded="${open}">
          <span class="su-dic${off ? ' off' : ''}">${ic(ICON[d.type], 20)}</span>
          <span class="su-tt"><b class="su-ell">${esc(d.navn)}</b><span class="su-ell">${esc(d.modell || '–')}</span></span>
          <span class="su-dm${off ? ' off' : ''}">${esc(meta)}</span>${ic('mdi:chevron-down', 20, `color:${TM};transition:transform .2s;${open ? 'transform:rotate(180deg)' : ''}`)}</button>
          ${open ? devDetail(h, cfg, d, P, off) : ''}</div>`;
    }).join('');
    return `<section class="su-card su-devs"><div class="su-ch"><span>Enheter</span><span>${online} av ${L.length} online</span></div>${rows}</section>`;
  }
  function devDetail(h, cfg, d, P, off) {
    const st = (v, u, l, id) => `<button class="su-xt" ${moreAttr(id)}><span class="su-xv"><span class="num su-ell">${esc(v == null || v === '' ? '–' : v)}</span><span class="su-xu">${esc(v == null || v === '–' || v === '' ? '' : u || '')}</span></span><span class="su-xl su-ell">${esc(l)}</span></button>`;
    const cl = numOf(h, d.clients), F = fw(h, d.upd), upN = P.filter((p) => p.up).length, poeP = P.filter((p) => p.poeCap), poe = poeSum(P);
    const fwT = st(!F ? '–' : F.on ? 'Ny' : F.ver || '–', '', F && F.on ? 'Fastvare · oppdatering' : 'Fastvare', d.upd);
    const tilst = st(off ? 'Frakoblet' : stateLabel(h, d), '', 'Tilstand', d.state || d.tracker);
    const cpu = st(pctTxt(h, d.cpu), '%', 'CPU', d.cpu), mem = st(pctTxt(h, d.mem), '%', 'Minne', d.mem), kl = st(cl == null ? '–' : M.nf(cl), '', 'Klienter', d.clients);
    const portUp = st(P.length ? `${upN} / ${P.length}` : '–', '', 'Porter oppe', (P.find((p) => p.speed) || {}).speed), up = st(off ? '–' : oppetid(h, d.uptime), '', 'Oppetid', d.uptime);
    let stats;
    if (d.type === 'gw') stats = [kl, cpu, mem, st(tempTxt(h, d.cpuTemp || d.temp), '°', 'CPU-temp', d.cpuTemp || d.temp), st(tempTxt(h, d.localTemp), '°', 'Lokal temp', d.localTemp), portUp, up, fwT, tilst];
    else if (d.type === 'sw') stats = [kl, cpu, mem, portUp, ...(poeP.length ? [st(nf(poe, poe < 10 && poe % 1 ? 1 : 0), 'W', 'PoE', (poeP.find((p) => p.pw) || {}).pw)] : []), up, fwT, tilst];
    else stats = [kl, cpu, mem, up, fwT, tilst];
    let bars = '';
    if (d.type === 'gw' && d.lat.length) {
      bars = `<div class="su-xb">${d.lat.map((l) => { const v = numOf(h, l.id); return `<button class="su-xbr" ${moreAttr(l.id)}><span class="su-xbl su-ell">${esc(l.label)} WAN</span><span class="su-xbt"><i style="width:${v == null ? 0 : Math.min(100, v * 5)}%;background:${v != null && v > 30 ? OR : GR}"></i></span><span class="su-xbv num">${v == null ? '–' : M.nf(Math.round(v)) + ' ms'}</span></button>`; }).join('')}</div>`;
    }
    const tgs = [];
    if (d.led) { const on = pend(h, d.led); tgs.push(`<div class="su-xgr">${ic('mdi:led-on', 20, `color:${T1b}`)}<span class="su-tt"><b>LED</b><span class="su-ell">${esc(d.led)}</span></span>${tg(on, `data-su-act="tgl" data-su-id="${esc(d.led)}"`, 'LED')}</div>`); }
    const poeSw = poeP.map((p) => p.poe).filter(Boolean);
    if (poeSw.length) {
      const on = poeSw.every((id) => pend(h, id));
      tgs.push(`<div class="su-xgr">${ic('mdi:flash', 20, `color:${T1b}`)}<span class="su-tt"><b>PoE på alle porter</b><span class="su-ell">${poeSw.length} PoE-porter · ${nf(poe, poe < 10 && poe % 1 ? 1 : 0)} W</span></span>${tg(on, `data-su-act="poeall" data-su-v="${esc(d.id)}"`, 'PoE på alle porter')}</div>`);
    }
    const acts = [];
    const ab = (icon, label, attrs, hot) => `<button class="su-ab${hot ? ' hot' : ''}" ${attrs}>${ic(icon, 18)}${esc(label)}</button>`;
    acts.push(ab('mdi:restart', 'Start på nytt', d.restart && !off ? `data-su-act="press" data-su-id="${esc(d.restart)}" data-su-confirm="${esc(`Starte ${d.navn} på nytt?`)}" data-su-toast="${esc(d.navn)} starter på nytt"` : 'disabled', true));
    if (d.type === 'gw') acts.push(ab('mdi:speedometer', 'Fartstest', 'data-su-act="go" data-su-tab="net" data-su-sub="udm"'));
    if (d.type !== 'ap' && P.some((p) => p.cyc)) acts.push(ab('mdi:power-cycle', 'PoE-sykle port', `data-su-act="go" data-su-tab="net" data-su-sub="switch" data-su-dev="${esc(d.id)}"`, true));
    acts.push(ab('mdi:update', F && F.on ? 'Oppdater fastvare' : 'Fastvare', d.upd ? `data-su-act="${F && F.on ? 'install' : 'more'}" data-su-id="${esc(d.upd)}" data-su-name="${esc(d.navn)}"` : 'disabled'));
    return `<div class="su-gx"><div class="su-xs">${stats.join('')}</div>${bars}${tgs.length ? `<div class="su-xg">${tgs.join('')}</div>` : ''}<div class="su-xa">${acts.join('')}</div></div>`;
  }

  // H/J/I · Switch
  function switchHTML(host, X) {
    const h = host.hass, ui = host.ui || {}, cfg = host.config || {};
    const SW = X.devs.filter((d) => d.ports.length);
    if (!SW.length) return `<section class="su-card su-sw"><div class="su-none">– · Fant ingen switcher med porter</div></section>`;
    const info = SW.map((d) => { const P = portsOf(h, d); return { d, P, off: offline(h, d), up: P.filter((p) => p.up).length, poe: poeSum(P), hasPoe: P.some((p) => p.poeCap) }; });
    const want = ui.dev || ui.suSw;
    // kort-etikett = første ord i navnet; like første ord (f.eks. «Switch Garasje» / «Switch Kontor») → resten av navnet
    const first = (d) => d.navn.split(/\s+/)[0], dup = (d) => info.filter((x) => first(x.d) === first(d)).length > 1;
    const short = (d) => (dup(d) ? d.navn.split(/\s+/).slice(1).join(' ') || d.navn : first(d));
    const cur = info.find((x) => x.d.id === want) || info[0], d = cur.d;
    const grid = info.length > 1 ? `<div class="su-swg">${info.map((x) => {
      const on = x === cur;
      return `<button class="su-swc${on ? ' on' : ''}${x.off ? ' off' : ''}" data-su-act="swsel" data-su-v="${esc(x.d.id)}" aria-pressed="${on}"><span class="su-swn su-ell">${esc(short(x.d))}</span>
        <span class="su-leds">${x.P.map((p) => `<i style="background:${x.off ? M.alpha(OR, 0.35) : SPC[p.sp] || CTRL}"></i>`).join('')}</span>
        <span class="su-sws su-ell">${x.off ? 'Frakoblet' : `${x.up}/${x.P.length}${x.hasPoe ? ` · ${nf(x.poe, 0)} W` : ''}`}</span></button>`;
    }).join('')}</div>` : '';
    const bud = cur.hasPoe ? budgetOf(h, cfg, d) : null, pct = bud ? Math.min(100, (cur.poe / bud) * 100) : 0;
    const sub = `${d.uptime ? `Oppetid ${oppetid(h, d.uptime)} · ` : ''}${cur.up} av ${cur.P.length} porter oppe`;
    const poePill = cur.hasPoe ? `<span class="su-poe" ${moreAttr(d.usage || (cur.P.find((p) => p.pw) || {}).pw)}>${ic('mdi:flash', 18)}<span class="num">${nf(cur.poe, cur.poe < 10 && cur.poe % 1 ? 1 : 0)} / ${bud ? M.nf(bud) : '–'} W</span></span>` : '';
    const poeBar = cur.hasPoe ? `<div class="su-pb"><i style="width:${pct.toFixed(1)}%;background:${pct > 80 ? RD : `color-mix(in srgb, ${OR} 70%, white)`}"></i></div>` : '';
    const sel = cur.P.find((p) => p.key === String(ui.suPort));
    const ports = cur.P.map((p) => {
      const on = sel === p, col = SPC[p.sp];
      return `<button class="su-pt${p.up ? ' up' : ''}${p.dis ? ' dis' : ''}${on ? ' sel' : ''}" data-su-act="port" data-su-port="${esc(p.key)}" data-su-dev="${esc(d.id)}" aria-pressed="${on}" aria-label="${esc(p.label)}${p.dis ? ', deaktivert' : p.up ? ', oppe' : ', ledig'}${p.live ? ', PoE' : ''}">
        <i class="su-led" style="background:${p.up && col ? col : 'var(--ki-ctrl, #454545)'};${p.up && col ? `box-shadow:0 0 8px ${M.alpha(col, 0.6)}` : ''}"></i><span class="num">${esc(p.sfp ? 'S' + p.n : p.n)}</span>${ic('mdi:flash', 13, `position:absolute;bottom:6px;color:${OR};opacity:${p.live ? 1 : 0}`)}</button>`;
    }).join('');
    const legend = `<div class="su-lg"><span><i style="background:${BL}"></i>2,5 G+</span><span><i style="background:${GR}"></i>1 G</span><span><i style="background:${OR}"></i>100 M</span><span>${ic('mdi:flash', 14, `color:${OR}`)}PoE</span><span><i class="hatch"></i>Deaktivert</span></div>`;
    return `<section class="su-card su-sw" data-key="su-sw">${grid}
      <div class="su-swh"><span class="su-tt"><b class="su-ell">${esc(d.navn)}</b><span class="su-ell">${esc(cur.off ? 'Frakoblet' : sub)}</span></span>${poePill}</div>${poeBar}
      <div class="su-pg" style="grid-template-columns:repeat(${Math.min(8, cur.P.length)},minmax(0,1fr))">${ports}</div>${legend}
      ${sel ? portDetail(h, d, sel) : '<span class="su-pinfo">Trykk på en port for detaljer</span>'}</section>`;
  }
  const offTxt = (p) => `Slå av ${p.sfp ? 'SFP ' + p.n : 'port ' + p.n}? Enheten mister nett.`;
  function portDetail(h, d, p) {
    const col = p.dis || !p.up ? null : SPC[p.sp] || GR;
    const status = p.dis ? 'Deaktivert' : p.up ? ['Tilkoblet', spdTxt(p.mb) === '–' ? null : spdTxt(p.mb), p.poeCap && p.poeOn ? 'PoE' : null].filter(Boolean).join(' · ') : 'Ingen kobling';
    const icon = p.sfp ? 'mdi:swap-vertical' : p.poeCap ? 'mdi:power-plug' : 'mdi:lan';
    const tile = (v, l, id) => `<button class="su-pdt" ${moreAttr(id)}><span class="su-ell">${esc(v)}</span><span>${esc(l)}</span></button>`;
    const stats = [tile(!p.en ? (p.up ? 'Oppe' : '–') : p.dis ? 'Av' : p.up ? 'Oppe' : 'Ledig', 'Status', p.en),
      tile(p.speed ? (p.up ? spdTxt(p.mb) : '–') : '–', 'Hastighet', p.speed),
      p.poeCap ? tile(p.w != null && p.w > 0 ? `${M.nf(p.w, p.w < 10 ? 1 : 0)} W` : '–', 'PoE-strøm', p.pw) : tile(p.name || (p.up ? 'Ukjent' : '–'), 'Klient', p.en || p.speed)];
    const tgs = [];
    if (p.en) tgs.push(`<div class="su-xgr">${ic('mdi:ethernet', 20, `color:${T1b}`)}<span class="su-tt"><b>Port aktiv</b><span class="su-ell">${esc(p.en)}</span></span>${tg(!p.dis, `data-su-act="tgl" data-su-id="${esc(p.en)}" data-su-confirm="${esc(offTxt(p))}"`, 'Port aktiv')}</div>`);
    if (p.poe) tgs.push(`<div class="su-xgr">${ic('mdi:flash', 20, `color:${T1b}`)}<span class="su-tt"><b>PoE</b><span class="su-ell">${esc(p.poe)}</span></span>${tg(p.poeOn, `data-su-act="tgl" data-su-id="${esc(p.poe)}" data-su-confirm="${esc(`Slå av PoE på ${p.label.toLowerCase()}? Enheten mister strøm.`)}"`, 'PoE')}</div>`);
    const acts = [];
    if (p.cyc) acts.push(`<button class="su-ab hot" data-su-act="press" data-su-id="${esc(p.cyc)}" data-su-confirm="${esc(`PoE-sykle ${p.label.toLowerCase()}? Enheten starter på nytt.`)}" data-su-toast="${esc(p.label)} PoE sykles">${ic('mdi:power-cycle', 18)}PoE-sykle</button>`);
    if (p.speed || p.en) acts.push(`<button class="su-ab" ${moreAttr(p.speed || p.en)}>${ic('mdi:chart-line', 18)}Historikk</button>`);
    return `<div class="su-pd" data-key="su-pd-${esc(d.id)}-${esc(p.key)}">
        <div class="su-pdh"><span class="su-pdi" style="${col ? `background:${tone(col, 0.18)};color:${TXC(col)}` : ''}">${ic(icon, 20)}</span>
          <span class="su-tt"><b class="su-ell">${esc(p.label + (p.name ? ' · ' + p.name : ''))}</b><span class="su-ell" style="color:${col ? TXC(col) : TM};font-weight:500">${esc(status)}</span></span>
          <button class="su-pdx" data-su-act="pclose" title="Lukk" aria-label="Lukk">${ic('mdi:close', 18)}</button></div>
        <div class="su-pds">${stats.join('')}</div>${tgs.length ? `<div class="su-xg">${tgs.join('')}</div>` : ''}${acts.length ? `<div class="su-xa">${acts.join('')}</div>` : ''}</div>`;
  }

  function html(host, sub, R) {
    const X = discover(host.hass, R, host.config || {});
    try {
      if (sub === 'udm') return udmHTML(host, X);
      if (sub === 'enheter') return enheterHTML(host, X);
      if (sub === 'switch') return switchHTML(host, X);
    } catch (e) { console.error('[ki-msh] serverUnifi', e); return `<section class="su-card"><div class="su-none">Kunne ikke tegne UniFi (${esc(e && e.message)})</div></section>`; }
    return '';
  }

  /* ------------------------------------------------------------ handlinger */
  const hap = (host, t) => (host && host.haptic ? host.haptic(t) : M.haptic(t));
  const more = (host, id) => { if (!id) return; if (host && host.moreInfo) host.moreInfo(id); else M.moreInfo(host, id); };
  const upd = (host) => (host.update ? host.update() : host.render && host.render());
  // Bekreftelse: host.confirm(text) → Promise<bool>; reserve = portalt ark (fallgruve 1)
  function ask(host, text) {
    if (host && typeof host.confirm === 'function') return Promise.resolve(host.confirm(text)).then((v) => !!v);
    return new Promise((res) => {
      let done = false;
      const api = M.overlay({ maxWidth: 420, guard: 250, css: `.su-q{display:flex;flex-direction:column;gap:14px;padding:6px 4px 4px}.su-q p{margin:0;font-size:16px;line-height:1.4;color:var(--ki-text, #fafafa)}
        .su-qb{display:grid;grid-template-columns:1fr 1fr;gap:8px}.su-qb button{height:48px;border-radius:24px;font-size:15px;font-weight:500;border:0;cursor:pointer;color:var(--ki-text, #fafafa);background:var(--ki-surface, #3a3a3a)}
        .su-qb .ok{background:${RD};color:var(--ki-on-accent, #232323)}`,
      html: `<div class="su-q"><p>${esc(text)}</p><div class="su-qb"><button data-q="0">Avbryt</button><button class="ok" data-q="1">Bekreft</button></div></div>` });
      const fin = (v) => { if (done) return; done = true; res(v); };
      api.onClosed = () => fin(false);
      api.body.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('[data-q]'); if (!b) return; M.haptic(b.dataset.q === '1' ? 'heavy' : 'light'); fin(b.dataset.q === '1'); api.close(); });
    });
  }
  const call = (host, d, s, data) => M.call(host.hass, d, s, data);
  async function setSw(host, id, want, confirmTxt) {
    if (!want && confirmTxt && !(await ask(host, confirmTxt))) return;
    PEND[id] = { want, t: Date.now() }; upd(host); setTimeout(() => upd(host), 15100);
    const D = dom(id);
    return call(host, D === 'light' ? 'light' : D === 'switch' ? 'switch' : 'homeassistant', want ? 'turn_on' : 'turn_off', { entity_id: id }).catch(() => { delete PEND[id]; upd(host); });
  }
  async function press(host, id, confirmTxt, toast) {
    if (confirmTxt && !(await ask(host, confirmTxt))) return;
    return call(host, 'button', 'press', { entity_id: id }).then(() => { if (toast) M.toast(toast); }).catch(() => {});
  }
  function install(host, id, name) {
    const s = stOf(host.hass, id);
    if (!s || s.state !== 'on') return more(host, id);
    return call(host, 'update', 'install', { entity_id: id }).then(() => M.toast(`${name || 'Fastvaren'} oppdateres`)).catch(() => {});
  }
  function findDev(st, id) { const X = discover(st.host.hass, st.R, st.host.config || {}); return X.devs.find((d) => d.id === id) || X.all.find((d) => d.id === id); }

  async function onAct(st, b) {
    const host = st.host, h = host.hass, dd = b.dataset, a = dd.suAct;
    switch (a) {
      case 'none': return;
      case 'more': hap(host, 'light'); return more(host, dd.suId);
      case 'dx': hap(host, 'light'); return host.setUI({ suDx: (host.ui || {}).suDx === dd.suV ? null : dd.suV });
      case 'swsel': hap(host, 'selection'); return host.setUI({ suSw: dd.suV, dev: null, suPort: null });
      case 'port': hap(host, 'selection'); return host.setUI({ suPort: String((host.ui || {}).suPort) === dd.suPort ? null : dd.suPort, suSw: dd.suDev, dev: null });
      case 'pclose': hap(host, 'light'); return host.setUI({ suPort: null });
      case 'go': hap(host, dd.suHap || 'selection'); return host.go ? host.go(dd.suTab, dd.suSub, dd.suDev ? { dev: dd.suDev, suSw: dd.suDev, suPort: null } : {}) : null;
      case 'tgl': hap(host, 'medium'); return setSw(host, dd.suId, !pend(h, dd.suId), dd.suConfirm);
      case 'poeall': {
        hap(host, 'medium');
        const d = findDev(st, dd.suV); if (!d) return;
        const ids = d.ports.map((p) => p.poe).filter(Boolean), on = ids.every((id) => pend(h, id)), want = !on;
        if (!want && !(await ask(host, `Slå av PoE på alle ${ids.length} porter på ${d.navn}? Enhetene mister strøm.`))) return;
        ids.forEach((id) => { PEND[id] = { want, t: Date.now() }; });
        upd(host); setTimeout(() => upd(host), 15100);
        return call(host, 'switch', want ? 'turn_on' : 'turn_off', { entity_id: ids }).catch(() => { ids.forEach((id) => delete PEND[id]); upd(host); });
      }
      case 'press': hap(host, 'medium'); return press(host, dd.suId, dd.suConfirm, dd.suToast);
      case 'install': hap(host, 'medium'); return install(host, dd.suId, dd.suName);
      default: return;
    }
  }
  // Hold 500 ms på en port → meny (portalt ark): port av/på, PoE av/på, PoE-sykle
  function portMenu(st, devId, key) {
    const host = st.host, h = host.hass, d = findDev(st, devId); if (!d) return;
    const p = portsOf(h, d).find((x) => x.key === key); if (!p) return;
    const items = [];
    if (p.en) items.push(['en', p.dis ? 'mdi:ethernet' : 'mdi:ethernet-off', p.dis ? `Slå på ${p.label.toLowerCase()}` : `Slå av ${p.label.toLowerCase()}`, false]);
    if (p.poe) items.push(['poe', 'mdi:flash', p.poeOn ? 'Slå av PoE' : 'Slå på PoE', false]);
    if (p.cyc) items.push(['cyc', 'mdi:power-cycle', 'PoE-sykle', true]);
    host.setUI({ suPort: key, suSw: devId, dev: null });
    const api = M.overlay({ maxWidth: 420, guard: 300, css: `.su-mh{display:flex;flex-direction:column;gap:2px;padding:4px 4px 12px}.su-mh b{font-size:18px;font-weight:600;color:var(--ki-text, #fafafa)}.su-mh span{font-size:12px;color:var(--ki-text-mid, #979797)}
      .su-ml{display:flex;flex-direction:column;gap:6px}.su-mi{display:flex;align-items:center;gap:12px;height:52px;padding:0 16px;border-radius:26px;border:0;background:var(--ki-surface, #3a3a3a);color:var(--ki-text, #fafafa);font-size:15px;font-weight:500;cursor:pointer;text-align:left}
      .su-mi.hot{background:${tone(RD)};color:${TX.red}}.su-mi:active{transform:scale(.97)}.su-mn{padding:14px;border-radius:20px;background:var(--ki-surface, #3a3a3a);color:var(--ki-text-mid, #979797);font-size:13px}`,
    html: `<div class="su-mh"><b>${esc(p.label)}</b><span>${esc(d.navn)}</span></div><div class="su-ml">${items.length ? items.map(([k, icn, l, hot]) => `<button class="su-mi${hot ? ' hot' : ''}" data-m="${k}">${ic(icn, 20)}${esc(l)}</button>`).join('') : '<div class="su-mn">– · Porten har ingen brytere i UniFi</div>'}</div>` });
    api.body.addEventListener('click', (e) => {
      const b = e.target.closest && e.target.closest('[data-m]'); if (!b) return;
      M.haptic('medium'); api.close();
      const k = b.dataset.m;
      if (k === 'en') setSw(host, p.en, p.dis, offTxt(p));
      else if (k === 'poe') setSw(host, p.poe, !p.poeOn, `Slå av PoE på ${p.label.toLowerCase()}? Enheten mister strøm.`);
      else if (k === 'cyc') press(host, p.cyc, `PoE-sykle ${p.label.toLowerCase()}? Enheten starter på nytt.`, `${p.label} PoE sykles`);
    });
    return api;
  }

  function bind(host, el, sub, R) {
    if (!el) return;
    el.__su = { host, sub, R };
    if (el.__suB) return;
    el.__suB = true;
    const st = () => el.__su;
    let hold = null, hx = 0, hy = 0, swallow = false;
    const stopHold = () => { if (hold) { clearTimeout(hold); hold = null; } };
    el.addEventListener('click', (e) => {
      if (swallow) { swallow = false; e.stopPropagation(); e.preventDefault(); return; }
      const b = e.target.closest && e.target.closest('[data-su-act]');
      if (!b || b.disabled || !el.contains(b)) return;
      e.stopPropagation();
      onAct(st(), b);
    });
    el.addEventListener('pointerdown', (e) => {
      if (e.button) return;
      const b = e.target.closest && e.target.closest('[data-su-port]'); if (!b) return;
      hx = e.clientX; hy = e.clientY; stopHold();
      hold = setTimeout(() => {
        hold = null; swallow = true; setTimeout(() => { swallow = false; }, 700);
        hap(st().host, 'medium');
        portMenu(st(), b.dataset.suDev, b.dataset.suPort);
      }, 500);
    });
    el.addEventListener('pointermove', (e) => { if (hold && (Math.abs(e.clientX - hx) > 8 || Math.abs(e.clientY - hy) > 8)) stopHold(); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((n) => el.addEventListener(n, stopHold));
    el.addEventListener('contextmenu', (e) => { if (e.target.closest && e.target.closest('[data-su-port]')) e.preventDefault(); });
  }

  /* ------------------------------------------------------------ editor (Tilpass + getConfigElement – samme skjema) */
  function editorFields(h, c) {
    if (!h) return [];
    c = c || {};
    let X; try { X = discover(h, M.server && M.server.oppdag ? M.server.oppdag(h, c) : null, { ...c, unifi_hidden: [], exclude: [] }); } catch (e) { return []; }
    if (!X.all.length) return [{ type: 'section', id: 'unifi', label: 'UniFi-enheter', icon: 'mdi:router-network', fields: [{ type: 'info', label: 'Fant ingen UniFi-enheter ennå.' }] }];
    const T = { gw: 'Gateway', sw: 'Switch', ap: 'Aksesspunkt' };
    const sws = X.all.filter((d) => d.ports.some((p) => p.poe || p.pw));
    return [{ type: 'section', id: 'unifi', label: 'UniFi-enheter', icon: 'mdi:router-network', fields: [
      { type: 'order', name: 'unifi_order', hiddenName: 'unifi_hidden', label: 'Enheter (rekkefølge og synlighet)', options: X.all.map((d) => [d.id, `${d.navn} · ${T[d.type]}`]) },
      { type: 'info', label: 'Gjelder Enheter, Switch og UDM. Skjulte enheter telles ikke i setningen under toppkortet.' },
      ...sws.map((d) => ({ type: 'number', name: 'poe_budget.' + d.id, label: `PoE-budsjett · ${d.navn} (W)`, min: 0, max: 3000, step: 1, auto: () => { const v = numOf(h, d.budget) || modelBudget(d.modell); return v == null ? null : v; }, placeholder: String(numOf(h, d.budget) || modelBudget(d.modell) || '') })),
    ] }];
  }

  /* ------------------------------------------------------------ CSS (inkluderes i server-kortets shadow root) */
  const css = `
    .su-card{background:${S};border-radius:28px;min-width:0;color:${T}}
    .su-ell{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
    .su-tt{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px;text-align:left}
    .su-tt b{font-size:14px;font-weight:500}.su-tt>span{font-size:12px;color:${TM}}
    .su-none{padding:14px;border-radius:20px;background:${S2};color:${TM};font-size:13px}.su-none.in{margin:6px 12px 8px}
    [data-su-act]{cursor:pointer}[data-su-act="none"]{cursor:default}
    button[disabled]{opacity:.4;cursor:default}
    .su-tg{width:46px;height:28px;border-radius:14px;flex:none;position:relative;background:${CTRL};transition:background .2s}
    .su-tg i{position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:11px;background:var(--ki-knob, #fafafa);transition:left .2s}
    .su-tg.on{background:${GR}}.su-tg.on i{left:21px}
    /* M · UDM */
    .su-udm{display:flex;flex-direction:column;gap:8px}
    .su-dev{padding:16px;display:flex;flex-direction:column;gap:16px}
    .su-top{display:flex;align-items:center;gap:12px;min-width:0}
    .su-top .su-tt{gap:2px}.su-top .su-tt b{font-size:16px;font-weight:600}
    .su-ic44{width:44px;height:44px;border-radius:22px;flex:none;display:grid;place-items:center;background:${S2};color:${T1}}
    .su-chip{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 12px;border-radius:14px;font-size:12px;font-weight:600;flex:none;white-space:nowrap}
    .su-chip i{width:7px;height:7px;border-radius:4px;background:currentColor}
    .su-chip.ok{background:${tone(GR)};color:${TX.green}}.su-chip.ok i{background:${GR}}
    .su-chip.warn{background:${tone(OR)};color:${TX.orange}}.su-chip.warn i{background:${OR}}
    .su-chip.none{background:${S2};color:${TM}}
    .su-mts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;padding:0 4px}
    .su-mt{display:flex;flex-direction:column;align-items:stretch;gap:6px;min-width:0;text-align:left;color:${T}}
    .su-ml{font-size:13px;color:${T2}}
    .su-mv{display:flex;align-items:baseline;gap:3px}.su-mv .num{font-size:40px;font-weight:300;line-height:1;letter-spacing:-0.02em;font-variant-numeric:tabular-nums}.su-mv>span:last-child{font-size:13px;color:${TM}}
    .su-seg{display:flex;gap:3px;margin-top:4px}.su-seg i{flex:1;height:8px;border-radius:2px;display:block}
    .su-sps{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
    .su-sp{display:flex;align-items:center;gap:10px;height:56px;padding:0 16px;border-radius:20px;background:${S2};min-width:0;color:${T};transition:transform .12s}
    .su-sp:active{transform:scale(.97)}
    .su-spl{flex:1;min-width:0;font-size:14px;color:${T2};text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .su-spv{font-size:16px;font-weight:600;flex:none;white-space:nowrap;font-variant-numeric:tabular-nums;color:${T}}.su-spv.warn{color:${TX.orange}}
    .su-lat{padding:16px;display:flex;flex-direction:column;gap:12px}
    .su-lh{display:flex;align-items:baseline;gap:8px}.su-lh>span:first-child{flex:1;font-size:17px;font-weight:600}.su-lh>span:last-child{font-size:12px;color:${TM};white-space:nowrap}
    .su-lr{display:grid;grid-template-columns:88px minmax(0,1fr) 52px;align-items:center;gap:10px;width:100%;min-height:36px;text-align:left;color:${T}}
    .su-ll{font-size:14px;color:${T1b}}
    .su-ls{display:flex;gap:3px;height:22px;min-width:0}.su-ls i{flex:1;min-width:0;border-radius:3px;display:block}
    .su-lv{display:flex;align-items:baseline;justify-content:flex-end;gap:2px}.su-lv .num{font-size:20px;font-variant-numeric:tabular-nums}.su-lv>span:last-child{font-size:11px;color:${TM}}
    .su-lax{display:grid;grid-template-columns:88px minmax(0,1fr) 52px;gap:10px;font-size:11px;color:${T3t}}.su-lax>span:nth-child(2){display:flex;justify-content:space-between}
    .su-acts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
    .su-ap{height:64px;border-radius:32px;display:flex;align-items:center;justify-content:center;gap:8px;min-width:0;padding:0 12px;background:${S2};color:${T};transition:transform .12s}
    .su-ap>span{font-size:15px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
    .su-ap:active{transform:scale(.96)}.su-ap.hot{background:${tone(RD)};color:${TX.red}}
    /* H · Enheter */
    .su-devs{padding:6px 0;display:flex;flex-direction:column}
    .su-ch{display:flex;align-items:center;gap:10px;padding:8px 16px 4px}.su-ch>span:first-child{flex:1;font-size:15px;font-weight:600}.su-ch>span:last-child{font-size:12px;color:${TM};white-space:nowrap}
    .su-dw{border-radius:20px;margin:0 6px;transition:background .2s}.su-dw.open{background:${S2}}
    .su-dr{display:flex;align-items:center;gap:12px;min-height:56px;width:100%;padding:0 12px;text-align:left;color:${T}}
    .su-dic{width:40px;height:40px;border-radius:20px;flex:none;display:grid;place-items:center;background:${S2};color:${T1b}}
    .su-dw.open .su-dic{background:${S3}}
    .su-dic.off{background:${tone(OR)};color:${TX.orange}}
    .su-dm{font-size:12px;font-weight:500;white-space:nowrap;color:${TM}}.su-dm.off{color:${TX.orange}}
    .su-gx{display:flex;flex-direction:column;gap:10px;padding:2px 12px 14px;animation:sufade .25s ease}
    @keyframes sufade{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
    @media (prefers-reduced-motion: reduce){.su-gx,.su-pd{animation:none}}
    .su-xs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
    .su-xt{display:flex;flex-direction:column;align-items:stretch;gap:2px;padding:10px 12px;border-radius:16px;background:${S3};min-width:0;text-align:left;color:${T}}
    .su-xv{display:flex;align-items:baseline;gap:2px;min-width:0}.su-xv .num{font-size:17px;font-variant-numeric:tabular-nums}.su-xu{font-size:11px;color:${TM}}
    .su-xl{font-size:11px;color:${TM}}
    .su-xb{display:flex;flex-direction:column;gap:6px;padding:10px 12px;border-radius:16px;background:${S3}}
    .su-xbr{display:flex;align-items:center;gap:10px;font-size:12px;width:100%;text-align:left;color:${T}}
    .su-xbl{width:104px;color:${T2};flex:none}
    .su-xbt{flex:1;height:6px;border-radius:3px;background:${S2};overflow:hidden;display:flex}.su-xbt i{display:block;height:100%;border-radius:3px;transition:width .4s}
    .su-xbv{width:76px;text-align:right;color:${T1b};white-space:nowrap;flex:none}
    .su-xg{display:flex;flex-direction:column;border-radius:16px;background:${S3};padding:0 12px}
    .su-xgr{display:flex;align-items:center;gap:10px;min-height:52px}.su-xgr+.su-xgr{border-top:1px solid ${LINE}}
    .su-xgr b{font-size:13px;font-weight:500}.su-xgr .su-tt>span{font-size:11px}
    .su-xa{display:flex;flex-wrap:wrap;gap:6px}
    .su-ab{height:40px;padding:0 14px 0 10px;border-radius:20px;display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:500;background:${S2};color:${T1};transition:transform .12s}
    .su-pd .su-ab{background:${CTRL}}
    .su-ab:active{transform:scale(.96)}.su-ab.hot,.su-pd .su-ab.hot{background:${tone(RD)};color:${TX.red}}
    /* J · Switch */
    .su-sw{padding:16px;display:flex;flex-direction:column;gap:12px}
    .su-swg{display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:6px}
    .su-swc{display:flex;flex-direction:column;align-items:flex-start;gap:8px;min-width:0;padding:10px 12px;border-radius:18px;background:${S3};box-shadow:inset 0 0 0 1px var(--ki-line, rgba(255,255,255,0.04));transition:background .2s,box-shadow .2s,transform .12s;text-align:left;color:${T}}
    .su-swc:active{transform:scale(.97)}.su-swc.on{background:${S2};box-shadow:inset 0 0 0 1.5px ${PK}}
    .su-swn{font-size:13px;font-weight:600;width:100%}
    .su-leds{display:flex;gap:2px;width:100%}.su-leds i{flex:1;height:4px;border-radius:2px;display:block}
    .su-sws{font-size:11px;color:${TM};max-width:100%}.su-swc.off .su-sws{color:${TX.orange}}
    .su-swh{display:flex;align-items:flex-start;gap:10px;min-width:0}
    .su-swh .su-tt{gap:3px}.su-swh .su-tt b{font-size:18px;font-weight:600;letter-spacing:-0.01em}.su-swh .su-tt>span{font-size:13px}
    .su-poe{flex:none;display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 14px 0 10px;border-radius:18px;background:${tone(OR)};color:${TX.orange};font-size:14px;font-weight:600;font-variant-numeric:tabular-nums}
    .su-pb{height:8px;border-radius:4px;background:${S3};overflow:hidden}.su-pb i{display:block;height:100%;border-radius:4px;transition:width .4s}
    .su-pg{display:grid;gap:6px}
    .su-pt{height:60px;border-radius:14px;position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;min-width:0;padding:0;color:var(--ki-text-lo, #696969);background:${S3};box-shadow:inset 0 0 0 1px var(--ki-line, rgba(255,255,255,0.07));transition:box-shadow .15s,transform .12s;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}
    .su-pt.up{color:${T}}
    .su-pt .num{font-size:15px;font-weight:500;line-height:1}
    .su-pt:active{transform:scale(.95)}
    .su-pt.dis{background:repeating-linear-gradient(135deg,${S} 0 4px,${S3} 4px 8px)}
    .su-pt.sel{box-shadow:inset 0 0 0 2px ${PK}}
    .su-led{position:absolute;top:8px;left:50%;transform:translateX(-50%);width:18px;height:4px;border-radius:2px;display:block}
    .su-lg{display:flex;flex-wrap:wrap;align-items:center;gap:6px 14px;font-size:12px;color:${TM}}
    .su-lg>span{display:inline-flex;align-items:center;gap:6px}.su-lg i{width:12px;height:4px;border-radius:2px;display:block}
    .su-lg i.hatch{height:12px;border-radius:3px;background:repeating-linear-gradient(135deg,${CTRL} 0 2px,transparent 2px 4px)}
    .su-pinfo{font-size:12px;color:${T2};min-height:16px}
    /* I · portdetaljer */
    .su-pd{display:flex;flex-direction:column;gap:10px;padding:12px;border-radius:20px;background:${S2};animation:sufade .2s ease}
    .su-pdh{display:flex;align-items:center;gap:10px;min-width:0}.su-pdh .su-tt b{font-size:15px;font-weight:600}
    .su-pdi{width:40px;height:40px;border-radius:20px;flex:none;display:grid;place-items:center;background:${CTRL};color:${T1b}}
    .su-pdx{width:36px;height:36px;border-radius:18px;background:${CTRL};display:grid;place-items:center;flex:none;color:${T}}
    .su-pds{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
    .su-pdt{display:flex;flex-direction:column;align-items:stretch;gap:2px;padding:9px 10px;border-radius:14px;background:${S3};min-width:0;width:100%;text-align:left;color:${T}}
    .su-pdt>span:first-child{font-size:15px;font-variant-numeric:tabular-nums}.su-pdt>span:last-child{font-size:11px;color:${TM}}
    /* smale popuper (telefon): pillene og handlingene krymper litt så tekstene får plass – mål kortet, ikke vinduet */
    .su-dev,.su-acts{container-type:inline-size}
    @container (max-width: 400px){.su-sp{padding:0 12px;gap:8px}.su-spl{font-size:13px}.su-spv{font-size:15px}.su-ap{padding:0 6px;gap:4px}.su-ap>span{font-size:14px}}
    @container (max-width: 330px){.su-sp>ha-icon,.su-ap>ha-icon{display:none}}
  `;

  M.serverUnifi = { css, discover, prosa, html, bind, editorFields, _hourly: hourly, _lat: LAT, _pend: PEND, _modelBudget: modelBudget };
})();
