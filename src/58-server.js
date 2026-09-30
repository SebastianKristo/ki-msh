/* msh-server-card · Server-popup #server (fiks 24.10 – promptets «ki-homelab-popup-card»).
 * Fasit «Server v4.dc.html» finnes ikke i repoet: bygget etter prompt-teksten. Funksjons-popup (Mal A), ETT kort, Bubble eier headeren.
 * Innhold (i rekkefølge): toppkort (status-pille «Alt kjører»/«n ting trenger tilsyn», effekt i W, nodekart UniFi → Proxmox/Unraid
 *   med animerte pakkelinjer og LED per node; trykk node = bytt fane) · varselkort (CPU varm = rød + puls, disk full / AP frakoblet =
 *   oransje; trykk = gå til fanen) · faner (én per funnet integrasjon) + tannhjul · per fane: 3 målere, grupper med rader (brytere for
 *   VM/LXC, containere, WLAN; UniFi-enheter åpner enhetsark) · «Konfigurert automatisk» (sammenleggbar liste over funne entiteter).
 *   Ingen integrasjoner → «Fant ingen integrasjoner».
 * Enhetsark (UniFi): portales til ki-overlay-root (MSH.overlay, fallgruve 1): status-piller, handlinger (Start på nytt, Finn enhet,
 *   LED), 4 statistikk-fliser, trafikkgraf 24 t, radioer (AP) / PoE-porter (switch) / WAN (gateway), klienter med blokker-bryter, entitetsliste.
 * Autokonfig: integrasjonene oppdages fra config entries (unifi, proxmoxve, unraid – config_entries/get) og entitetene fra
 *   entitetsregisteret (hass.entities: platform, device_id) + enhetsregisteret (hass.devices: navn, modell). Klassifiseringen er
 *   flyttet fra ki-homelab-card (ki-cards/src/82-ki-homelab-card.js · oppdag()). Ingen hardkodede ID-er, aldri mock: mangler → «–».
 * Config (samme skjema i «Tilpass» og GUI-editoren):
 *   name, tabs: [unifi, proxmox, unraid] (rekkefølge), tabs_hidden: [..], tab_style: icon_name|name|icon, content: { gauges, groups },
 *   start_tab, alerts: { cpu, disk, ap }, limits: { cpu_temp (45–70 °C), disk (80–95 %) }, overrides: { power, unifi_cpu, … },
 *   exclude: [entity_id], lines: true, auto_list: true, gap/pad_top/pad_bottom.
 */
(function () {
  const M = window.MSH;
  if (!M || customElements.get('msh-server-card')) return;
  const esc = M.esc, C = M.C;
  const HASH = '#server';
  const INTEG = [
    { key: 'unifi', domain: 'unifi', platforms: ['unifi'], name: 'UniFi', icon: 'mdi:router-network', color: C.blue },
    { key: 'proxmox', domain: 'proxmoxve', platforms: ['proxmoxve', 'proxmox_sensors'], name: 'Proxmox', icon: 'mdi:server', color: C.orange },
    { key: 'unraid', domain: 'unraid', platforms: ['unraid'], name: 'Unraid', icon: 'mdi:nas', color: C.purple },
  ];
  const IK = Object.fromEntries(INTEG.map((i) => [i.key, i]));
  const PLAT = {}; INTEG.forEach((i) => i.platforms.forEach((p) => { PLAT[p] = i.key; }));
  const DEF = { tab_style: 'icon_name', lines: true, auto_list: true };
  const LIM = { cpu_temp: 60, disk: 90 };
  const TTL = 300000;

  /* ------------------------------------------------------------ hjelpere (fra ki-homelab-card) */
  const DAARLIG = ['unavailable', 'unknown', '', 'none', null, undefined];
  const ok = (s) => s && !DAARLIG.includes(s.state);
  const tall = (s) => { if (!ok(s)) return NaN; const v = parseFloat(String(s.state).replace(',', '.')); return isNaN(v) ? NaN : v; };
  const obj = (id) => id.slice(id.indexOf('.') + 1);
  const dom = (id) => id.slice(0, id.indexOf('.'));
  const tittel = (t) => String(t).replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/^./, (c) => c.toUpperCase());
  const finn = (liste, re, domene) => {
    const e = liste.find((x) => (!domene || dom(x.entity_id) === domene) && (re.test(obj(x.entity_id)) || (x.translation_key && re.test(x.translation_key))));
    return e ? e.entity_id : undefined;
  };
  const alle = (liste, re, domene) => liste.filter((x) => (!domene || dom(x.entity_id) === domene) && (re.test(obj(x.entity_id)) || (x.translation_key && re.test(x.translation_key)))).map((x) => x.entity_id);
  const RUN = ['running', 'on', 'online', 'started', 'home', 'connected', 'true'];
  const kjorer = (s) => !!s && RUN.includes(String(s.state).toLowerCase());

  /* ------------------------------------------------------------ config entries (config_entries/get) */
  // undefined = ikke hentet ennå · null = ikke tilgang (ikke admin) → bare entitetsregisteret. Hentes på nytt etter 5 min.
  const CE = { data: undefined, busy: false, t: 0 };
  function entries(hass) {
    if (!hass || !hass.callWS) return CE.data;
    if (!CE.busy && Date.now() - CE.t > TTL) {
      CE.busy = true;
      Promise.resolve().then(() => hass.callWS({ type: 'config_entries/get' }))
        .then((r) => { CE.data = (Array.isArray(r) ? r : []).filter((e) => e && INTEG.some((i) => i.domain === e.domain)); })
        .catch(() => { CE.data = null; })
        .then(() => { CE.t = Date.now(); CE.busy = false; window.dispatchEvent(new CustomEvent('msh-server-entries')); });
    }
    return CE.data;
  }

  /* ------------------------------------------------------------ oppdagelse */
  let MEMO = null;
  function oppdag(hass, cfg) {
    const E = hass.entities || {}, D = hass.devices || {}, ce = entries(hass);
    const ex = cfg.exclude || [];
    if (MEMO && MEMO.E === E && MEMO.D === D && MEMO.ce === ce && MEMO.ex === JSON.stringify(ex) && MEMO.S === hass.states) return MEMO.R;
    const per = { unifi: {}, proxmox: {}, unraid: {} }, ents = { unifi: [], proxmox: [], unraid: [] };
    for (const id in E) {
      const e = E[id]; const key = e && PLAT[e.platform];
      if (!key || e.hidden || e.hidden_by || e.disabled_by || !hass.states[id]) continue;
      (per[key][e.device_id || '_'] = per[key][e.device_id || '_'] || []).push(e);
      ents[key].push(id);
    }
    const found = {};
    INTEG.forEach((i) => { found[i.key] = ents[i.key].length > 0 || (Array.isArray(ce) && ce.some((x) => x.domain === i.domain)); });
    const devNavn = (id) => { const d = D[id]; return d ? (d.name_by_user || d.name || '') : ''; };
    const devModell = (id) => { const d = D[id]; return d ? `${d.manufacturer || ''} ${d.model || ''}`.toLowerCase() : ''; };
    const nm = cfg.navn_map || {};
    const R = { found, ents, per, devNavn, loading: ce === undefined, proxmox: { noder: [], gjester: [], lagring: [], varsler: [], diskerMap: {}, disker: [] }, unifi: { enheter: [], wlan: [], klienter: [] }, unraid: null, power: [] };

    /* Proxmox (ki-homelab-card, + binary_sensor-status/temperatur/bryter fra kjerne-integrasjonen proxmoxve) */
    for (const [dev, liste] of Object.entries(per.proxmox)) {
      const ids = liste.map((e) => obj(e.entity_id));
      let type = null;
      for (const o of ids) { const m = o.match(/^\d+_(node|ct|lxc|vm|qemu|storage|disks?|mounted_disks)_/); if (m) { type = m[1]; break; } }
      const mod = devModell(dev) + ' ' + devNavn(dev).toLowerCase();
      if (!type) type = /lxc|container/.test(mod) ? 'ct' : /qemu|virtual|\bvm\b/.test(mod) ? 'vm' : /storage|lagring/.test(mod) ? 'storage' : /node/.test(mod) ? 'node' : 'annet';
      if (type === 'lxc') type = 'ct'; if (type === 'qemu') type = 'vm';
      alle(liste, /(stressed|overloaded|overbelast|stress)/, 'binary_sensor').forEach((id) => R.proxmox.varsler.push(id));
      const medNr = ids.filter((o) => /^\d+_/.test(o)); const grunnlag = medNr.length ? medNr : ids;
      let pre = grunnlag.reduce((a, b) => { let i = 0; while (i < a.length && a[i] === b[i]) i++; return a.slice(0, i); }, grunnlag[0] || '');
      pre = pre.slice(0, pre.lastIndexOf('_') + 1);
      const nokkel = pre.replace(/^\d+_(node|ct|lxc|vm|qemu|storage|disks?|mounted_disks)_/, '').replace(/_$/, '');
      const vmid = (nokkel.match(/_(\d{3,})$/) || [])[1];
      const raa = nokkel.replace(/_\d{3,}$/, '');
      let navn = devNavn(dev).replace(/^(\d+\s*[-_:]?\s*)?(lxc|ct|vm|qemu|node|storage)\s*[-_:]?\s*/i, '').replace(/\s*\(\d+\)\s*$/, '').trim() || tittel(raa || 'Proxmox');
      navn = nm[vmid] || nm[raa] || nm[navn] || navn.replace(/^./, (c) => c.toUpperCase());
      const g = {
        id: 'px-' + dev, dev, kilde: 'proxmox', type, navn, vmid, nokkel: raa,
        status: finn(liste, /(node_)?status$/, 'sensor') || finn(liste, /(status|running)$/, 'binary_sensor'),
        cpu: finn(liste, /cpu_usage$/, 'sensor'),
        mem: finn(liste, /(memory|ram)_usage$/, 'sensor'),
        disk: finn(liste, /disk_usage$/, 'sensor'),
        temp: finn(liste, /(cpu_)?temp(erature)?$/, 'sensor'),
        ramBrukt: finn(liste, /(ram|memory)_used$/, 'sensor'), ramTot: finn(liste, /(ram|memory)_total$/, 'sensor'),
        diskBrukt: finn(liste, /disk_used$/, 'sensor'), diskTot: finn(liste, /disk_total$/, 'sensor'),
        oppetid: finn(liste, /uptime$/, 'sensor'),
        bruk: finn(liste, /_usage$/, 'sensor'), brukt: finn(liste, /_used$/, 'sensor'), total: finn(liste, /_total$/, 'sensor'),
        bryter: finn(liste, /./, 'switch'),
        knapper: liste.filter((e) => dom(e.entity_id) === 'button').map((e) => {
          const o = obj(e.entity_id).slice(pre.length);
          const a = /^start/.test(o) ? 'start' : /^stop/.test(o) ? 'stopp' : /^(reboot|restart)/.test(o) ? 'restart' : /^shutdown/.test(o) ? 'av'
            : /^pause|suspend/.test(o) ? 'pause' : /^resume/.test(o) ? 'fortsett' : /^hibernate/.test(o) ? 'dvale' : /^reset/.test(o) ? 'reset' : null;
          return a ? { a, id: e.entity_id } : null;
        }).filter(Boolean),
      };
      if (type === 'node') R.proxmox.noder.push(g);
      else if (type === 'ct' || type === 'vm') R.proxmox.gjester.push(g);
      else if (type === 'storage') R.proxmox.lagring.push(g);
      else if (type === 'disks' || type === 'disk' || type === 'annet') {
        liste.filter((e) => dom(e.entity_id) === 'sensor').forEach((e) => {
          const o = obj(e.entity_id);
          const m = o.match(/(airflow_temperature|temperature|temp|size|health|smart_status|wearout|life_left|power_on_hours)$/); if (!m) return;
          const k = o.slice(0, o.length - m[1].length).replace(/_$/, '').replace(/^\d+_disks?_/, '').replace(/^disks?_/, '');
          const d = (R.proxmox.diskerMap[k] = R.proxmox.diskerMap[k] || { id: 'pd-' + k, nokkel: k });
          const f = /temp/.test(m[1]) ? 'temp' : m[1] === 'size' ? 'storrelse' : /health|smart/.test(m[1]) ? 'helse' : /wearout|life/.test(m[1]) ? 'slitasje' : 'timer';
          if (!d[f]) d[f] = e.entity_id;
        });
      }
    }
    R.proxmox.disker = Object.values(R.proxmox.diskerMap).map((d) => { d.navn = nm[d.nokkel] || tittel(d.nokkel); return d; });
    const rek = { start: 0, restart: 1, stopp: 2, av: 3, pause: 4, fortsett: 5, dvale: 6, reset: 7 };
    [...R.proxmox.gjester, ...R.proxmox.noder].forEach((g) => g.knapper.sort((a, b) => rek[a.a] - rek[b.a]));
    R.proxmox.gjester.sort((a, b) => String(a.vmid || a.navn).localeCompare(String(b.vmid || b.navn), 'nb', { numeric: true }));

    /* UniFi (ki-homelab-card, + klienter, trafikk, radioer, WAN og PoE-effekt til enhetsarket) */
    for (const [dev, liste] of Object.entries(per.unifi)) {
      const navn = devNavn(dev) || 'UniFi';
      const bilde = finn(liste, /./, 'image');
      const wlanKlienter = finn(liste, /(wlan_clients|clients|klienter)$/, 'sensor');
      if (bilde || (liste.length <= 4 && finn(liste, /(aktivert|enabled|wlan)/, 'switch'))) {
        R.unifi.wlan.push({ id: 'wl-' + dev, dev, navn, qr: bilde, klienter: wlanKlienter, bryter: finn(liste, /./, 'switch') });
        continue;
      }
      const cpu = finn(liste, /cpu_utili[sz]ation$/, 'sensor'), mem = finn(liste, /memory_utili[sz]ation$/, 'sensor');
      const restart = finn(liste, /(restart|omstart)$/, 'button');
      const portKnapper = liste.filter((e) => /port_(\d+)_power_cycle$/.test(obj(e.entity_id))).map((e) => ({ n: +obj(e.entity_id).match(/port_(\d+)_power_cycle$/)[1], id: e.entity_id, type: 'syklus' }));
      const portBrytere = liste.filter((e) => dom(e.entity_id) === 'switch' && /port_(\d+)(_poe)?$/.test(obj(e.entity_id))).map((e) => ({ n: +obj(e.entity_id).match(/port_(\d+)(_poe)?$/)[1], id: e.entity_id, type: 'bryter' }));
      const led = finn(liste, /./, 'light');
      if (!cpu && !mem && !restart && !portKnapper.length && !portBrytere.length && !led) {
        // klient: sporer + blokker-bryter
        const tr = finn(liste, /./, 'device_tracker');
        if (tr || finn(liste, /./, 'switch')) R.unifi.klienter.push({ id: 'cl-' + dev, dev, navn, tracker: tr, bryter: finn(liste, /./, 'switch') });
        continue;
      }
      const latens = alle(liste, /wan_latency$/, 'sensor');
      const m = devModell(dev);
      const type = latens.length || /dream|gateway|udm|udr|ucg|uxg|usg|cloud key/.test(m) ? 'ruter'
        : portKnapper.length || portBrytere.length || /switch|usw|flex|\bus[- ]?\d/.test(m) ? 'switch'
          : /access point|u6|u7|uap|mesh|nanohd|lite|pro ap|in-wall/.test(m) ? 'ap' : 'enhet';
      const porter = (portBrytere.length ? portBrytere : portKnapper).sort((a, b) => a.n - b.n).map((p) => ({ ...p, effekt: finn(liste, new RegExp(`port_${p.n}_poe_power$`), 'sensor') }));
      R.unifi.enheter.push({
        id: 'uf-' + dev, dev, navn, type, modell: (D[dev] && D[dev].model) || '',
        tracker: finn(liste, /./, 'device_tracker'), cpu, mem,
        temp: finn(liste, /temperat/, 'sensor'), oppetid: finn(liste, /(uptime|oppetid)$/, 'sensor'),
        klienter: finn(liste, /(clients|klienter)$/, 'sensor'), latens, led, restart,
        finn: finn(liste, /(locate|identify|finn)/, 'button'),
        tilstand: finn(liste, /_state$/, 'sensor'),
        oppdatering: finn(liste, /./, 'update'),
        rx: finn(liste, /(_rx|rx_rate|download|_rx_bytes|throughput_rx)$/, 'sensor'), tx: finn(liste, /(_tx|tx_rate|upload|_tx_bytes|throughput_tx)$/, 'sensor'),
        radioer: alle(liste, /(2_4|2g|_ng_|5g|5_ghz|5ghz|_na_|6g|6e|radio)/, 'sensor'),
        wan: alle(liste, /wan/, 'sensor').filter((x) => !latens.includes(x) && !/(_rx|_tx)$/.test(obj(x))),
        porter, alle: liste.map((e) => e.entity_id),
      });
    }
    const typeRek = { ruter: 0, switch: 1, ap: 2, enhet: 3 };
    R.unifi.enheter.sort((a, b) => typeRek[a.type] - typeRek[b.type] || a.navn.localeCompare(b.navn, 'nb'));
    R.unifi.klienter.sort((a, b) => a.navn.localeCompare(b.navn, 'nb'));

    /* Unraid (ki-homelab-card) */
    const ur = Object.entries(per.unraid);
    if (ur.length) {
      const liste = ur.flatMap(([, l]) => l);
      const serverNavn = devNavn(ur[0][0]) || 'Unraid';
      const fn = (id) => { const s = hass.states[id]; return (s && s.attributes.friendly_name) || obj(id); };
      const kortNavn = (id) => { let t = fn(id); for (const [d] of ur) { const n = devNavn(d); if (n && t.toLowerCase().startsWith(n.toLowerCase())) t = t.slice(n.length); } return t.replace(/^[\s:–-]+/, '').trim() || tittel(obj(id)); };
      const system = /(array|parity|spin|share|mover|service|notification|flash|ups|plugin|fan|zfs|disk\d|cache)/;
      const brytere = liste.filter((e) => dom(e.entity_id) === 'switch' && !e.entity_category && !system.test(obj(e.entity_id)));
      const disker = {};
      liste.filter((e) => dom(e.entity_id) === 'sensor').forEach((e) => {
        const m = obj(e.entity_id).match(/(disk\d+|parity\d*|cache[a-z0-9]*)_(usage|temperature|temp)$/);
        if (m) { (disker[m[1]] = disker[m[1]] || { navn: m[1] })[m[2] === 'usage' ? 'bruk' : 'temp'] = e.entity_id; }
      });
      R.unraid = {
        navn: serverNavn,
        cpu: finn(liste, /cpu_(usage|utili[sz]ation)$/, 'sensor'),
        ram: finn(liste, /(ram|memory)_(usage|utili[sz]ation|used_percent|percent)$/, 'sensor'),
        temp: finn(liste, /cpu_temp(erature)?$/, 'sensor'),
        oppetid: finn(liste, /uptime$/, 'sensor'),
        arrayBruk: finn(liste, /array_(usage|utili[sz]ation)$/, 'sensor'),
        arrayStatus: finn(liste, /array_(state|status)$/, 'sensor') || finn(liste, /array_(started|state)$/, 'binary_sensor'),
        disker: Object.values(disker).sort((a, b) => a.navn.localeCompare(b.navn, 'nb', { numeric: true })),
        gjester: brytere.map((e) => {
          const vm = /(^|_)vm(_|$)/.test(obj(e.entity_id)) || /vm/.test(e.translation_key || '');
          const n = kortNavn(e.entity_id);
          const slug = obj(e.entity_id).split('_').pop();
          const restart = liste.find((x) => dom(x.entity_id) === 'button' && obj(x.entity_id).includes(slug) && /restart/.test(obj(x.entity_id)));
          const oppd = liste.find((x) => dom(x.entity_id) === 'binary_sensor' && obj(x.entity_id).includes(slug) && /update/.test(obj(x.entity_id)));
          return { id: 'ur-' + e.entity_id, kilde: 'unraid', type: vm ? 'vm' : 'docker', navn: nm[n] || n.replace(/^./, (c) => c.toUpperCase()), bryter: e.entity_id, restart: restart && restart.entity_id, oppdatering: oppd && oppd.entity_id };
        }).sort((a, b) => a.navn.localeCompare(b.navn, 'nb')),
      };
    }
    // Effekt: effektsensorer (W/kW) på de funne enhetene, uten per-port-PoE (inngår i enhetens totale forbruk)
    INTEG.forEach((i) => ents[i.key].forEach((id) => {
      const s = hass.states[id];
      if (dom(id) === 'sensor' && s && s.attributes.device_class === 'power' && !/port_\d+/.test(obj(id))) R.power.push(id);
    }));
    MEMO = { E, D, ce, ex: JSON.stringify(ex), S: hass.states, R };
    return R;
  }

  /* ------------------------------------------------------------ tall og tekst */
  const nf = (v, d = 0) => (v == null || isNaN(v) ? '–' : M.nf(v, d));
  const watt = (s) => { const v = tall(s); if (isNaN(v)) return NaN; return /kw/i.test(s.attributes.unit_of_measurement || '') ? v * 1000 : v; };
  const pctOf = (hass, id, brukt, tot) => {
    const s = id && hass.states[id];
    const v = tall(s);
    if (!isNaN(v)) return v;
    const b = tall(brukt && hass.states[brukt]), t = tall(tot && hass.states[tot]);
    return !isNaN(b) && !isNaN(t) && t > 0 ? (b / t) * 100 : null;
  };
  const numOf = (hass, id) => { const v = tall(id && hass.states[id]); return isNaN(v) ? null : v; };
  function oppetid(hass, id) {
    const s = id && hass.states[id];
    if (!ok(s)) return '–';
    let sek = null;
    if (s.attributes.device_class === 'timestamp' || /^\d{4}-\d\d-\d\dT/.test(s.state)) { const t = Date.parse(s.state); if (!isNaN(t)) sek = (Date.now() - t) / 1000; }
    else { const v = tall(s), u = String(s.attributes.unit_of_measurement || 's').toLowerCase(); if (!isNaN(v)) sek = v * (u.startsWith('d') ? 86400 : u.startsWith('h') || u === 't' ? 3600 : u.startsWith('min') ? 60 : 1); }
    if (sek == null) return String(s.state);
    const d = Math.floor(sek / 86400), h = Math.floor((sek % 86400) / 3600), m = Math.floor((sek % 3600) / 60);
    return d ? `${d} d ${h} t` : h ? `${h} t ${m} min` : `${m} min`;
  }
  const fmt = (hass, id) => (id && hass.states[id] ? (ok(hass.states[id]) ? M.fmtState(hass, id) : '–') : '–');
  const ov = (c, k) => ((c.overrides || {})[k]) || null;

  /* ------------------------------------------------------------ status, varsler og målere */
  const apOffline = (hass, e) => {
    const t = e.tracker && hass.states[e.tracker], st = e.tilstand && hass.states[e.tilstand];
    if (st && ok(st)) return /disconnect|offline|frakoblet|pending|adopt/i.test(st.state);
    if (t) return !ok(t) || t.state === 'not_home';
    const c = e.cpu && hass.states[e.cpu];
    return !!c && !ok(c);
  };
  function varsler(hass, R, c) {
    const A = [], on = c.alerts || {}, L = { ...LIM, ...(c.limits || {}) };
    const tLim = Number(L.cpu_temp), dLim = Number(L.disk), ex = new Set(c.exclude || []);
    if (on.cpu !== false) {
      const T = [];
      if (R.unraid) T.push(['unraid', R.unraid.navn, ov(c, 'unraid_temp') || R.unraid.temp]);
      R.proxmox.noder.forEach((n, i) => T.push(['proxmox', n.navn, (i === 0 && ov(c, 'proxmox_temp')) || n.temp]));
      R.unifi.enheter.forEach((e) => { if (e.temp) T.push(['unifi', e.navn, e.temp]); });
      T.forEach(([tab, navn, id]) => {
        if (!id || ex.has(id)) return;
        const v = numOf(hass, id);
        if (v != null && v >= tLim) A.push({ type: 'cpu', level: 'red', tab, id, icon: 'mdi:thermometer-alert', title: `CPU varm · ${navn}`, sub: `${nf(v, 0)} °C · grense ${tLim} °C` });
      });
    }
    if (on.disk !== false) {
      const Dk = [];
      R.proxmox.lagring.forEach((g) => Dk.push(['proxmox', g.navn, g.bruk, g.brukt, g.total]));
      R.proxmox.noder.forEach((n, i) => Dk.push(['proxmox', n.navn + ' disk', (i === 0 && ov(c, 'proxmox_disk')) || n.disk, n.diskBrukt, n.diskTot]));
      if (R.unraid) {
        Dk.push(['unraid', 'Array', ov(c, 'unraid_array') || R.unraid.arrayBruk]);
        R.unraid.disker.forEach((d) => Dk.push(['unraid', diskNavn(d.navn), d.bruk]));
      }
      Dk.forEach(([tab, navn, id, b, t]) => {
        if (id && ex.has(id)) return;
        const v = pctOf(hass, id, b, t);
        if (v != null && v >= dLim) A.push({ type: 'disk', level: 'orange', tab, id: id || b, icon: 'mdi:harddisk', title: `Disk nesten full · ${navn}`, sub: `${nf(v, 0)} % brukt · grense ${dLim} %` });
      });
    }
    if (on.ap !== false) {
      R.unifi.enheter.filter((e) => e.type === 'ap' && !ex.has(e.tracker) && apOffline(hass, e)).forEach((e) => {
        const s = hass.states[e.tracker || e.tilstand || e.cpu];
        const siden = s && s.last_changed ? M.nf((Date.now() - Date.parse(s.last_changed)) / 60000, 0) : null;
        A.push({ type: 'ap', level: 'orange', tab: 'unifi', id: e.tracker || e.tilstand, dev: e.dev, icon: 'mdi:access-point-off', title: `AP frakoblet · ${e.navn}`, sub: siden != null && siden !== '–' ? `Frakoblet i ${siden} min` : 'Ikke tilkoblet kontrolleren' });
      });
    }
    return A.sort((a, b) => (a.level === 'red' ? 0 : 1) - (b.level === 'red' ? 0 : 1));
  }
  const gateway = (R) => R.unifi.enheter.find((e) => e.type === 'ruter') || R.unifi.enheter[0] || null;
  function klientTall(hass, R, c) {
    const o = ov(c, 'unifi_clients');
    if (o) return numOf(hass, o);
    if (R.unifi.klienter.length) return R.unifi.klienter.filter((k) => k.tracker && hass.states[k.tracker] && hass.states[k.tracker].state === 'home').length;
    const v = R.unifi.enheter.filter((e) => e.type !== 'ruter').map((e) => numOf(hass, e.klienter)).filter((x) => x != null);
    return v.length ? v.reduce((a, b) => a + b, 0) : null;
  }
  function malere(hass, R, c, key) {
    if (key === 'unifi') {
      const g = gateway(R) || {};
      return [
        { label: 'CPU', v: pctOf(hass, ov(c, 'unifi_cpu') || g.cpu), unit: '%', id: ov(c, 'unifi_cpu') || g.cpu },
        { label: 'Minne', v: pctOf(hass, ov(c, 'unifi_mem') || g.mem), unit: '%', id: ov(c, 'unifi_mem') || g.mem },
        { label: 'Klienter', v: klientTall(hass, R, c), unit: '', full: true, id: ov(c, 'unifi_clients') || null },
      ];
    }
    if (key === 'proxmox') {
      const n = R.proxmox.noder[0] || {}, st = R.proxmox.lagring[0] || {};
      const dId = ov(c, 'proxmox_disk') || n.disk || st.bruk;
      return [
        { label: 'CPU', v: pctOf(hass, ov(c, 'proxmox_cpu') || n.cpu), unit: '%', id: ov(c, 'proxmox_cpu') || n.cpu },
        { label: 'Minne', v: pctOf(hass, ov(c, 'proxmox_mem') || n.mem, n.ramBrukt, n.ramTot), unit: '%', id: ov(c, 'proxmox_mem') || n.mem },
        { label: 'Disk', v: pctOf(hass, dId, dId === n.disk ? n.diskBrukt : st.brukt, dId === n.disk ? n.diskTot : st.total), unit: '%', id: dId },
      ];
    }
    const U = R.unraid || {};
    return [
      { label: 'CPU', v: pctOf(hass, ov(c, 'unraid_cpu') || U.cpu), unit: '%', id: ov(c, 'unraid_cpu') || U.cpu },
      { label: 'RAM', v: pctOf(hass, ov(c, 'unraid_ram') || U.ram), unit: '%', id: ov(c, 'unraid_ram') || U.ram },
      { label: 'Array', v: pctOf(hass, ov(c, 'unraid_array') || U.arrayBruk), unit: '%', id: ov(c, 'unraid_array') || U.arrayBruk },
    ];
  }
  const diskNavn = (k) => String(k).replace(/^disk(\d+)$/, 'Disk $1').replace(/^parity(\d*)$/, (a, n) => 'Paritet' + (n ? ' ' + n : '')).replace(/^cache(.*)$/, (a, n) => 'Cache' + (n ? ' ' + n : ''));
  const orderOf = (c) => { const k = INTEG.map((i) => i.key); const o = (Array.isArray(c.tabs) ? c.tabs : []).filter((x) => k.includes(x)); k.forEach((x) => { if (!o.includes(x)) o.push(x); }); return o; };
  const visTabs = (R, c) => orderOf(c).filter((k) => R.found[k] && !(c.tabs_hidden || []).includes(k));
  const TYPE = { ruter: ['Gateway', 'mdi:router-network'], switch: ['Switch', 'mdi:switch'], ap: ['Aksesspunkt', 'mdi:access-point'], enhet: ['Enhet', 'mdi:devices'] };

  /* ------------------------------------------------------------ editor (Tilpass server) */
  function installEd(ed) {
    if (!ed || ed.__svInst || !ed.shadowRoot) return;
    ed.__svInst = true;
    window.addEventListener('msh-server-entries', () => { if (ed.isConnected && ed._render) ed._render(); });
    const Rt = ed.shadowRoot;
    let d = null;
    const stop = (e) => { if (e.target.closest && e.target.closest('[data-svdrag]')) e.stopPropagation(); };
    Rt.addEventListener('touchstart', stop, { passive: true });
    Rt.addEventListener('touchmove', stop, { passive: true });
    Rt.addEventListener('pointerdown', (e) => {
      const hd = e.target.closest && e.target.closest('[data-svdrag]');
      if (!hd || e.button) return;
      const item = hd.closest('[data-svk]');
      if (!item) return;
      e.stopPropagation(); e.preventDefault();
      d = { k: item.dataset.svk, item, y0: e.clientY, id: e.pointerId, over: null };
      try { hd.setPointerCapture(e.pointerId); } catch (x) { /* */ }
      item.style.position = 'relative'; item.style.zIndex = '2'; item.style.boxShadow = '0 6px 18px rgba(0,0,0,.4)';
      M.haptic('medium');
    });
    Rt.addEventListener('pointermove', (e) => {
      if (!d || e.pointerId !== d.id) return;
      e.stopPropagation(); e.preventDefault();
      d.item.style.transform = `translateY(${e.clientY - d.y0}px)`;
      d.item.style.pointerEvents = 'none';
      const el = Rt.elementFromPoint ? Rt.elementFromPoint(e.clientX, e.clientY) : null;
      d.item.style.pointerEvents = '';
      const o = el && el.closest && el.closest('[data-svk]');
      const hit = o && o !== d.item ? o : null;
      if (hit !== d.over) { if (d.over) d.over.style.outline = ''; d.over = hit; if (hit) { hit.style.outline = '2px solid rgba(242,133,201,.6)'; M.haptic('selection'); } }
    });
    const end = (e) => {
      if (!d || (e && e.pointerId !== d.id)) return;
      const Dd = d; d = null;
      Dd.item.style.transform = ''; Dd.item.style.zIndex = ''; Dd.item.style.boxShadow = '';
      if (Dd.over) Dd.over.style.outline = '';
      if (!Dd.over) return;
      const arr = orderOf(ed._config || {}), to = Dd.over.dataset.svk, i = arr.indexOf(Dd.k), j0 = arr.indexOf(to);
      const o = arr.filter((x) => x !== Dd.k), j = o.indexOf(to);
      o.splice(i <= j0 ? j + 1 : j, 0, Dd.k);
      M.haptic('success');
      ed._set('tabs', o);
    };
    Rt.addEventListener('pointerup', end);
    Rt.addEventListener('pointercancel', end);
  }
  const hdl = () => `<span data-svdrag="1" title="Dra for rekkefølge" style="touch-action:none;cursor:grab;display:inline-flex;color:#979797;padding:6px 0">${M.icon('mdi:drag', 20)}</span>`;
  const autoOf = (h, c, fnc) => { if (!h) return null; try { return fnc(oppdag(h, c || {})) || null; } catch (e) { return null; } };

  function editorSchema(h, c) {
    c = c || {};
    const R = h ? oppdag(h, c) : null;
    const tabStyle = (k, on, st) => {
      const I = IK[k];
      return `<span style="flex:1 1 0;min-width:0;height:34px;border-radius:17px;display:inline-flex;align-items:center;justify-content:center;gap:6px;font-size:12px;${on ? `background:${C.accent};color:#2a1720;font-weight:600` : 'color:#afafaf'}">${st !== 'name' ? M.icon(I.icon, 18) : ''}${st !== 'icon' || on ? `<span>${esc(I.name)}</span>` : ''}</span>`;
    };
    const faner = [
      { type: 'html', html: (hh, cc, key, ed) => {
        installEd(ed);
        const RR = hh ? oppdag(hh, cc) : null, V = RR ? visTabs(RR, cc) : [], st = cc.tab_style || DEF.tab_style;
        return `<div class="f"><label>Forhåndsvisning</label><div style="display:flex;align-items:center;gap:8px"><div style="flex:1;min-width:0;display:flex;gap:2px;padding:4px;border-radius:21px;background:#282828">${V.length ? V.map((k, i) => tabStyle(k, i === 0, st)).join('') : '<span style="flex:1;text-align:center;font-size:12px;color:#979797;line-height:34px">Ingen synlige faner</span>'}</div><span style="width:42px;height:42px;border-radius:21px;background:#282828;display:grid;place-items:center;color:#afafaf;flex:none">${M.icon('mdi:cog', 20)}</span></div></div>`;
      } },
      { type: 'html', html: (hh, cc, key, ed) => {
        installEd(ed);
        const RR = hh ? oppdag(hh, cc) : null, hid = cc.tabs_hidden || [];
        return `<div class="f" style="gap:6px"><label>Integrasjoner</label>${orderOf(cc).map((k) => {
          const I = IK[k], fnd = RR && RR.found[k], off = hid.includes(k), n = RR ? RR.ents[k].length : 0;
          return `<div data-svk="${k}" data-found="${fnd ? 1 : 0}" style="display:flex;align-items:center;height:52px;gap:10px;padding:0 6px;border-radius:16px;background:#2f2f2f;${!fnd ? 'opacity:.4' : off ? 'opacity:.6' : ''}">${hdl()}
            <span style="width:32px;height:32px;border-radius:16px;display:grid;place-items:center;flex:none;background:${I.color};color:#232323">${M.icon(I.icon, 18)}</span>
            <span style="flex:1;min-width:0;display:flex;flex-direction:column"><span style="font-size:14px">${esc(I.name)}</span><span style="font-size:11px;color:#979797">${fnd ? `${n} entiteter` : 'Ikke funnet'}</span></span>
            ${fnd ? `<button class="ib" data-a="fn" data-k="${key}" data-v="${k}" aria-label="${off ? 'Vis' : 'Skjul'} ${esc(I.name)}" aria-pressed="${!off}">${M.icon(off ? 'mdi:eye-off' : 'mdi:eye', 18)}</button>` : ''}</div>`;
        }).join('')}<span class="help">Dra i håndtaket for rekkefølge. Øyet skjuler fanen. Integrasjoner som ikke er funnet vises nedtonet.</span></div>`;
      }, click: (dd, ed) => { const s = new Set(ed._config.tabs_hidden || []); if (s.has(dd.v)) s.delete(dd.v); else s.add(dd.v); M.haptic('selection'); ed._set('tabs_hidden', s.size ? [...s] : undefined); } },
      { type: 'select', name: 'tab_style', label: 'Stil', options: [['icon_name', 'Ikon og navn'], ['name', 'Bare navn'], ['icon', 'Bare ikon']], default: 'icon_name' },
      { type: 'boolean', name: 'content.gauges', label: 'Innhold: målere', default: true },
      { type: 'boolean', name: 'content.groups', label: 'Innhold: grupper og rader', default: true },
      { type: 'select', name: 'start_tab', label: 'Startfane', options: [['', 'Sist brukt'], ...INTEG.map((i) => [i.key, i.name])], default: '' },
    ];
    const varselF = [
      { type: 'boolean', name: 'alerts.cpu', label: 'CPU varm (rød)', default: true },
      { type: 'range', name: 'limits.cpu_temp', label: 'Grense CPU-temperatur', icon: 'mdi:thermometer', min: 45, max: 70, default: LIM.cpu_temp, unit: '°C', presets: [[50, '50'], [60, '60'], [70, '70']] },
      { type: 'boolean', name: 'alerts.disk', label: 'Disk nesten full (oransje)', default: true },
      { type: 'range', name: 'limits.disk', label: 'Grense disk', icon: 'mdi:harddisk', min: 80, max: 95, default: LIM.disk, unit: '%', presets: [[80, '80'], [90, '90'], [95, '95']] },
      { type: 'boolean', name: 'alerts.ap', label: 'Aksesspunkt frakoblet (oransje)', default: true },
    ];
    const ent = (name, label, fnc, extra) => ({ type: 'entity', name: 'overrides.' + name, label, domains: ['sensor'], auto: (hh, cc) => autoOf(hh, cc, fnc), ...(extra || {}) });
    const entF = [
      { type: 'section', id: 'e_felles', label: 'Felles', icon: 'mdi:flash', fields: [ent('power', 'Effekt i toppkortet (tomt = summen av effektsensorene)', (RR) => RR.power[0], { device_class: 'power' })] },
      { type: 'section', id: 'e_unifi', label: 'UniFi', icon: IK.unifi.icon, fields: [
        ent('unifi_cpu', 'Gateway CPU', (RR) => (gateway(RR) || {}).cpu), ent('unifi_mem', 'Gateway minne', (RR) => (gateway(RR) || {}).mem), ent('unifi_clients', 'Antall klienter', () => null)] },
      { type: 'section', id: 'e_proxmox', label: 'Proxmox', icon: IK.proxmox.icon, fields: [
        ent('proxmox_cpu', 'Node CPU', (RR) => (RR.proxmox.noder[0] || {}).cpu), ent('proxmox_mem', 'Node minne', (RR) => (RR.proxmox.noder[0] || {}).mem),
        ent('proxmox_disk', 'Disk', (RR) => (RR.proxmox.noder[0] || {}).disk || (RR.proxmox.lagring[0] || {}).bruk), ent('proxmox_temp', 'CPU-temperatur', (RR) => (RR.proxmox.noder[0] || {}).temp)] },
      { type: 'section', id: 'e_unraid', label: 'Unraid', icon: IK.unraid.icon, fields: [
        ent('unraid_cpu', 'CPU', (RR) => (RR.unraid || {}).cpu), ent('unraid_ram', 'RAM', (RR) => (RR.unraid || {}).ram),
        ent('unraid_array', 'Array', (RR) => (RR.unraid || {}).arrayBruk), ent('unraid_temp', 'CPU-temperatur', (RR) => (RR.unraid || {}).temp)] },
      { type: 'entities', name: 'exclude', label: 'Skjul entiteter (rader og varsler)', help: 'Søk opp rader eller sensorer som ikke skal vises.' },
    ];
    const avansert = [
      { type: 'text', name: 'name', label: 'Navn i toppkortet', placeholder: 'Homelab' },
      { type: 'boolean', name: 'lines', label: 'Nettverkslinjer i nodekartet', default: true },
      { type: 'boolean', name: 'auto_list', label: 'Vis «Konfigurert automatisk»', default: true },
      M.spacingSchema(),
      { type: 'button', label: 'Tilbakestill', icon: 'mdi:restore', run: (hh, cc, ed) => { M.haptic('warning'); const id = (cc && cc.card_id) || M.uid(); ed._config = { type: cc.type || 'custom:msh-server-card', card_id: id }; ed._set('card_id', id); } },
    ];
    const n = R ? INTEG.filter((i) => R.found[i.key]).length : 0;
    return [
      ...(R && !n ? [{ type: 'info', label: R.loading ? 'Leter etter integrasjoner …' : 'Fant ingen integrasjoner (UniFi, Proxmox VE eller Unraid).' }] : []),
      { type: 'tabs', id: 'server', tabs: [
        { key: 'faner', label: 'Faner', icon: 'mdi:tab', focus: ['tabs'], fields: faner },
        { key: 'varsler', label: 'Varsler', icon: 'mdi:bell-alert', focus: ['alerts'], fields: varselF },
        { key: 'entiteter', label: 'Entiteter', icon: 'mdi:format-list-bulleted', focus: ['entities', 'overrides'], fields: entF },
        { key: 'avansert', label: 'Avansert', icon: 'mdi:tune', focus: ['spacing', 'advanced'], fields: avansert },
      ] },
    ];
  }

  /* ============================================================ kortet */
  class Server extends M.Card {
    static get cardName() { return 'Server'; }
    static get defaults() { return { ...DEF }; }
    static getStubConfig() { return { card_id: M.uid() }; }
    static get schema() { return editorSchema; }
    static get uiPersist() { return ['tab', 'autoOpen']; }
    get cardSize() { return 12; }
    constructor() {
      super();
      this._ce = () => { if (this.isConnected) this.update(); };
      this._mapW = 340;
    }
    connectedCallback() { super.connectedCallback(); window.addEventListener('msh-server-entries', this._ce); }
    disconnectedCallback() {
      super.disconnectedCallback(); window.removeEventListener('msh-server-entries', this._ce);
      if (this._ro) { this._ro.disconnect(); this._ro = null; }
      if (this._sheet) { this._sheet.api.close(); this._sheet = null; }
    }
    onOpen() {
      CE.t = 0; entries(this.hass); // friske config entries når popupen åpnes
      const st = this.config.start_tab;
      if (st && this._R && visTabs(this._R, this.config).includes(st) && this.ui.tab !== st) this.setUI({ tab: st });
    }
    onClose() { if (this._sheet) { this._sheet.api.close(); this._sheet = null; } }
    get tabs() { return this._R ? visTabs(this._R, this.config) : []; }
    get tab() { const V = this.tabs; const st = this.config.start_tab; return V.includes(this.ui.tab) ? this.ui.tab : V.includes(st) ? st : V[0] || null; }

    onAction(name, el, ev) {
      const d = el.dataset, h = this.hass;
      switch (name) {
        case 'tab': case 'node': case 'alert':
          if (d.dev && name === 'alert') { this.setUI({ tab: d.v }); return this._openDev(d.dev); }
          if (d.v && this.tabs.includes(d.v)) return this.setUI({ tab: d.v });
          return;
        case 'auto': return this.setUI({ autoOpen: !this.ui.autoOpen });
        case 'dev': return this._openDev(d.v);
        case 'gtoggle': return this._toggle(d);
        case 'press': return d.id && M.call(h, 'button', 'press', { entity_id: d.id });
        default: return super.onAction(name, el, ev);
      }
    }
    // Bryter for VM/LXC (Proxmox: switch eller start/stopp-knapp), Docker/VM (Unraid) og WLAN
    _toggle(d) {
      const h = this.hass;
      if (d.sw) return M.toggle(h, d.sw);
      const g = this._R && this._R.proxmox.gjester.find((x) => x.id === d.g);
      if (!g) return;
      const on = kjorer(h.states[g.status]);
      const btn = on ? (g.knapper.find((k) => k.a === 'av') || g.knapper.find((k) => k.a === 'stopp')) : g.knapper.find((k) => k.a === 'start' || k.a === 'fortsett');
      if (btn) M.call(h, 'button', 'press', { entity_id: btn.id });
      else M.toast('Fant ingen start-/stoppknapp for ' + g.navn);
    }

    /* ---------------------------------------------------------- tegning */
    render() {
      const h = this.hass, c = this.config;
      const R = (this._R = oppdag(h, c));
      const V = visTabs(R, c), tab = this.tab;
      const A = varsler(h, R, c);
      // alle funne entiteter (og overstyringer) er avhengigheter – varsler/LED/effekt følger hver endring
      INTEG.forEach((i) => R.ents[i.key].forEach((id) => this._deps.add(id)));
      Object.values(c.overrides || {}).forEach((id) => { if (id) this._deps.add(id); });
      const parts = [this._top(R, A)];
      if (A.length) parts.push(this._alerts(A));
      const anyFound = INTEG.some((i) => R.found[i.key]);
      if (!anyFound) {
        parts.push(`<div class="empty nf">${M.icon(R.loading ? 'mdi:timer-sand' : 'mdi:server-off', 26)}<b>${R.loading ? 'Leter etter integrasjoner …' : 'Fant ingen integrasjoner'}</b><span>Støtter UniFi Network, Proxmox VE og Unraid. Legg til integrasjonen i Home Assistant, så dukker den opp her automatisk.</span><button class="pick press" data-act="customize">${M.icon('mdi:cog', 18)}Tilpass</button></div>`);
      } else {
        parts.push(this._tabRow(V, tab));
        if (!tab) parts.push(`<div class="empty">${M.icon('mdi:eye-off', 22)}<span>Alle fanene er skjult</span><button class="pick press" data-act="customize" data-section="tabs">${M.icon('mdi:cog', 18)}Tilpass</button></div>`);
        else parts.push(this._pane(R, tab));
      }
      if (this._sheet && !this._sheet.api.closed) queueMicrotask(() => this._sheet && this._sheet.draw());
      return `<div class="wrap">${parts.join('')}</div>`;
    }
    _led(R, A, key) {
      const h = this.hass;
      if (!R.found[key] || !R.ents[key].length) return 'off';
      const mine = A.filter((a) => a.tab === key);
      if (mine.some((a) => a.level === 'red')) return 'red';
      if (key === 'unifi') { const g = gateway(R); if (g && g.tracker && h.states[g.tracker] && !kjorer(h.states[g.tracker])) return 'off'; }
      if (key === 'proxmox') { const n = R.proxmox.noder[0]; if (n && n.status && h.states[n.status] && !kjorer(h.states[n.status])) return 'off'; }
      if (key === 'unraid' && R.unraid) { const s = h.states[R.unraid.cpu]; if (s && !ok(s)) return 'off'; }
      return mine.length ? 'orange' : 'green';
    }
    _nodeSub(R, key) {
      const h = this.hass;
      if (key === 'unifi') { const k = klientTall(h, R, this.config); return k == null ? `${R.unifi.enheter.length} enheter` : `${nf(k)} klienter`; }
      if (key === 'proxmox') { const G = R.proxmox.gjester; return G.length ? `${G.filter((g) => g.bryter ? kjorer(h.states[g.bryter]) : kjorer(h.states[g.status])).length}/${G.length} kjører` : `${R.proxmox.noder.length} noder`; }
      const G = (R.unraid && R.unraid.gjester) || [];
      return G.length ? `${G.filter((g) => kjorer(h.states[g.bryter])).length}/${G.length} kjører` : '–';
    }
    _top(R, A) {
      const h = this.hass, c = this.config;
      const pw = ov(c, 'power') ? [ov(c, 'power')] : R.power;
      pw.forEach((id) => this.s(id));
      const ws = pw.map((id) => watt(h.states[id])).filter((v) => !isNaN(v));
      const W = ws.length ? ws.reduce((a, b) => a + b, 0) : null;
      const red = A.some((a) => a.level === 'red');
      const pill = !INTEG.some((i) => R.found[i.key]) ? `<span class="pl none">${M.icon('mdi:help-circle-outline', 14)}${R.loading ? 'Leter …' : 'Ingen integrasjoner'}</span>` : !A.length ? `<span class="pl ok">${M.icon('mdi:check-circle', 14)}Alt kjører</span>`
        : `<span class="pl ${red ? 'red' : 'warn'}">${M.icon('mdi:alert', 14)}${A.length === 1 ? '1 ting trenger tilsyn' : `${A.length} ting trenger tilsyn`}</span>`;
      const pwTxt = W == null ? '–' : W >= 10000 ? M.nf(W / 1000, 1) : M.nf(W, 0), pwU = W != null && W >= 10000 ? 'kW' : 'W';
      return `<section class="top" aria-label="Status">
        <div class="th"><div class="tl"><span class="tn">${esc(c.name || 'Homelab')}</span>${pill}</div>
          <div class="tp" ${pw[0] ? `data-act="more" data-id="${esc(pw[0])}" data-ent="${esc(pw[0])}"` : ''}><span class="tv num">${pwTxt}${W == null ? '' : `<small>${pwU}</small>`}</span><span class="tpl">Effekt nå</span></div></div>
        ${this._map(R, A)}
      </section>`;
    }
    _map(R, A) {
      const keys = INTEG.map((i) => i.key).filter((k) => R.found[k]);
      if (!keys.length) return `<div class="map none">${M.icon('mdi:lan-disconnect', 22)}<span>Ingen noder</span></div>`;
      const W = Math.max(240, this._mapW || 340), hasU = keys.includes('unifi'), right = keys.filter((k) => k !== 'unifi');
      const Hh = hasU && right.length === 2 ? 176 : 112;
      const pos = {};
      if (hasU && right.length) {
        pos.unifi = [48, Hh / 2 - 8];
        right.forEach((k, i) => { pos[k] = [W - 48, right.length === 2 ? (i ? Hh - 50 : 34) : Hh / 2 - 8]; });
      } else keys.forEach((k, i) => { pos[k] = [((i + 1) / (keys.length + 1)) * W, Hh / 2 - 8]; });
      const tab = this.tab, leds = Object.fromEntries(keys.map((k) => [k, this._led(R, A, k)]));
      const lines = this.config.lines !== false && hasU ? right.map((k, i) => {
        const [x1, y1] = pos.unifi, [x2, y2] = pos[k], a = x1 + 30, b = x2 - 30, mx = (a + b) / 2;
        const d = `M${a} ${y1} C${mx} ${y1} ${mx} ${y2} ${b} ${y2}`, dead = leds[k] === 'off', col = dead ? '#696969' : IK[k].color;
        const dots = dead ? '' : [0, 1].map((j) => `<circle r="3" fill="${col}"><animateMotion dur="2.4s" begin="-${(j * 1.2 + i * 0.4).toFixed(1)}s" repeatCount="indefinite" path="${d}"/></circle>`).join('')
          + `<circle r="2.5" fill="#fafafa" opacity=".7"><animateMotion dur="3s" begin="-${(0.6 + i * 0.5).toFixed(1)}s" repeatCount="indefinite" keyPoints="1;0" keyTimes="0;1" calcMode="linear" path="${d}"/></circle>`;
        return `<path d="${d}" fill="none" stroke="${col}" stroke-opacity="${dead ? 0.5 : 0.35}" stroke-width="2" ${dead ? 'stroke-dasharray="4 5"' : ''} stroke-linecap="round"/><g class="pk">${dots}</g>`;
      }).join('') : '';
      const nodes = keys.map((k) => {
        const I = IK[k], [x, y] = pos[k], L = leds[k];
        const nm = k === 'unifi' ? ((gateway(R) || {}).navn || I.name) : k === 'proxmox' ? ((R.proxmox.noder[0] || {}).navn || I.name) : ((R.unraid || {}).navn || I.name);
        return `<button class="nd ${k === tab ? 'on' : ''}" style="left:${x}px;top:${y - 24}px" data-act="node" data-v="${k}" data-haptic="selection" aria-label="${esc(I.name)}: ${esc(nm)}" aria-pressed="${k === tab}">
          <span class="ndc" style="--nc:${I.color}">${M.icon(I.icon, 22)}<i class="led ${L}"></i></span><span class="ndl ell">${esc(nm)}</span><span class="nds ell">${esc(this._nodeSub(R, k))}</span></button>`;
      }).join('');
      return `<div class="map" style="height:${Hh}px"><svg viewBox="0 0 ${W} ${Hh}" width="${W}" height="${Hh}" aria-hidden="true">${lines}</svg>${nodes}</div>`;
    }
    _alerts(A) {
      return `<section class="card alerts" aria-label="Varsler">${A.map((a) => `<button class="al ${a.level}" data-act="alert" data-v="${a.tab}" ${a.dev ? `data-dev="${esc(a.dev)}"` : ''} ${a.id ? `data-ent="${esc(a.id)}"` : ''}>
        <span class="ali">${M.icon(a.icon, 20)}</span><span class="grow col"><b class="ell">${esc(a.title)}</b><span class="ell">${esc(a.sub)}</span></span><span class="alt">${esc(IK[a.tab].name)}</span>${M.icon('mdi:chevron-right', 20, 'color:#7f7f7f')}</button>`).join('')}</section>`;
    }
    _tabRow(V, tab) {
      const st = this.config.tab_style || DEF.tab_style;
      const btn = (k) => {
        const I = IK[k], on = k === tab;
        if (st === 'icon') return M.iconTabs.btn({ label: I.name, icon: I.icon }, on, `data-act="tab" data-v="${k}" data-haptic="selection"`, on ? 'on' : '');
        return `<button class="tb ${on ? 'on' : ''}" role="tab" aria-selected="${on}" data-act="tab" data-v="${k}" data-haptic="selection">${st !== 'name' ? M.icon(I.icon, 20) : ''}<span>${esc(I.name)}</span></button>`;
      };
      return `<div class="trow"><div class="tabs ${st === 'icon' ? 'itabs' : ''}" role="tablist" data-glass-drag="x">${V.map(btn).join('')}</div>
        <button class="gear press" data-act="customize" aria-label="Tilpass server">${M.icon('mdi:cog', 22)}</button></div>`;
    }
    _pane(R, key) {
      const c = this.config, ct = c.content || {}, h = this.hass, out = [];
      if (!R.ents[key].length) {
        out.push(`<div class="empty">${M.icon('mdi:help-circle-outline', 22)}<span>${esc(IK[key].name)} er lagt til, men fant ingen entiteter ennå.</span><button class="pick press" data-act="customize" data-section="entities">${M.icon('mdi:plus', 18)}Velg entitet</button></div>`);
        return `<div class="pane">${out.join('')}</div>`;
      }
      if (ct.gauges !== false) out.push(this._gauges(malere(h, R, c, key), key));
      if (ct.groups !== false) out.push(...this._groups(R, key));
      if (c.auto_list !== false) out.push(this._autoList(R, key));
      return `<div class="pane" data-key="pane-${key}">${out.join('')}</div>`;
    }
    _gauges(G, key) {
      const col = IK[key].color;
      return `<section class="card gauges">${G.map((g) => {
        if (g.id) this.s(g.id);
        const p = g.v == null ? 0 : g.full ? 1 : M.clamp(g.v / 100, 0, 1);
        const cc = g.v == null ? '#545454' : g.full ? col : g.v >= 90 ? C.red : g.v >= 75 ? C.orange : col;
        const r = 26, L = 2 * Math.PI * r;
        return `<button class="ga" ${g.id ? `data-act="more" data-id="${esc(g.id)}" data-ent="${esc(g.id)}"` : 'data-act="customize" data-section="entities"'} aria-label="${esc(g.label)} ${g.v == null ? 'mangler' : nf(g.v)}">
          <span class="gr"><svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="${r}" fill="none" stroke="#545454" stroke-width="6"/><circle cx="32" cy="32" r="${r}" fill="none" stroke="${cc}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${(L * p).toFixed(1)} ${L.toFixed(1)}" transform="rotate(-90 32 32)"/></svg>
          <span class="gv num">${g.v == null ? '–' : nf(g.v)}${g.v != null && g.unit ? `<small>${g.unit}</small>` : ''}</span></span><span class="gl">${esc(g.label)}</span></button>`;
      }).join('')}</section>`;
    }
    _row({ icon, color, name, sub, right, act, ent, dim }) {
      return `<div class="rw ${dim ? 'dim' : ''}" ${act || ''} ${ent ? `data-ent="${esc(ent)}"` : ''}><span class="ic" style="--ic:${color || '#afafaf'}">${M.icon(icon, 20)}</span><span class="grow col"><b class="ell">${esc(name)}</b>${sub ? `<span class="ell">${sub}</span>` : ''}</span>${right || ''}</div>`;
    }
    _sw(on, attrs, label) { return `<button class="sw ${on ? 'on' : ''}" role="switch" aria-checked="${!!on}" aria-label="${esc(label)}" data-act="gtoggle" ${attrs}><i></i></button>`; }
    _bar(v) { return v == null ? '<span class="val">–</span>' : `<span class="bar"><i style="width:${M.clamp(v, 0, 100).toFixed(1)}%;background:${v >= Number({ ...LIM, ...(this.config.limits || {}) }.disk) ? C.orange : C.blue}"></i></span><span class="val num">${nf(v)} %</span>`; }
    _grp(title, rows, count) { return rows.length ? `<section class="grp"><div class="gt"><span>${esc(title)}</span>${count != null ? `<span class="gc">${esc(count)}</span>` : ''}</div><div class="card rows">${rows.join('')}</div></section>` : ''; }
    _groups(R, key) {
      const h = this.hass, ex = new Set(this.config.exclude || []), keep = (...ids) => !ids.some((id) => id && ex.has(id));
      const out = [];
      if (key === 'unifi') {
        const E = R.unifi.enheter.filter((e) => keep(e.tracker, e.cpu));
        out.push(this._grp('Enheter', E.map((e) => {
          [e.tracker, e.cpu, e.klienter, e.tilstand].forEach((id) => this.s(id));
          const off = apOffline(h, e), [tl, ic] = TYPE[e.type], k = numOf(h, e.klienter);
          const sub = off ? `<span style="color:${C.orange}">Frakoblet</span>` : esc([tl, k != null ? `${nf(k)} klienter` : null, e.cpu && ok(h.states[e.cpu]) ? `CPU ${fmt(h, e.cpu)}` : null].filter(Boolean).join(' · '));
          return this._row({ icon: ic, color: off ? '#7f7f7f' : C.blue, name: e.navn, sub, act: `data-act="dev" data-v="${esc(e.dev)}" role="button" tabindex="0"`, ent: e.tracker, right: `<i class="dot ${off ? 'orange' : 'green'}"></i>${M.icon('mdi:chevron-right', 20, 'color:#7f7f7f')}` });
        }), E.length));
        const Wl = R.unifi.wlan.filter((w) => keep(w.bryter));
        out.push(this._grp('WLAN', Wl.map((w) => {
          const s = this.s(w.bryter), k = numOf(h, w.klienter); this.s(w.klienter);
          return this._row({ icon: 'mdi:wifi', color: s && s.state === 'on' ? C.blue : '#7f7f7f', name: w.navn, sub: esc(k != null ? `${nf(k)} klienter` : s && s.state === 'on' ? 'På' : 'Av'), ent: w.bryter, right: w.bryter ? this._sw(s && s.state === 'on', `data-sw="${esc(w.bryter)}"`, w.navn) : '' });
        })));
      } else if (key === 'proxmox') {
        out.push(this._grp('Noder', R.proxmox.noder.filter((n) => keep(n.status, n.cpu)).map((n) => {
          const s = this.s(n.status), cpu = pctOf(h, n.cpu); this.s(n.cpu);
          const on = s ? kjorer(s) : cpu != null;
          return this._row({ icon: 'mdi:server', color: on ? C.orange : '#7f7f7f', name: n.navn, sub: esc([on ? 'Online' : 'Frakoblet', cpu != null ? `CPU ${nf(cpu)} %` : null, n.oppetid ? 'Oppe ' + oppetid(h, n.oppetid) : null].filter(Boolean).join(' · ')), act: `data-act="more" data-id="${esc(n.status || n.cpu)}"`, ent: n.status || n.cpu, right: `<i class="dot ${on ? 'green' : 'gray'}"></i>` });
        })));
        const gj = (t) => R.proxmox.gjester.filter((g) => g.type === t && keep(g.status, g.bryter)).map((g) => {
          const s = this.s(g.bryter || g.status), on = kjorer(s), cpu = pctOf(h, g.cpu); this.s(g.cpu);
          const can = g.bryter || g.knapper.some((k) => ['start', 'stopp', 'av'].includes(k.a));
          return this._row({ icon: t === 'vm' ? 'mdi:monitor' : 'mdi:cube-outline', color: on ? C.orange : '#7f7f7f', name: g.navn + (g.vmid ? ` · ${g.vmid}` : ''), sub: esc([on ? 'Kjører' : 'Stoppet', on && cpu != null ? `CPU ${nf(cpu)} %` : null].filter(Boolean).join(' · ')), act: `data-act="more" data-id="${esc(g.status || g.bryter)}"`, ent: g.status || g.bryter, right: can ? this._sw(on, g.bryter ? `data-sw="${esc(g.bryter)}"` : `data-g="${esc(g.id)}"`, g.navn) : '' });
        });
        const vm = gj('vm'), ct = gj('ct');
        out.push(this._grp('Virtuelle maskiner', vm, vm.length), this._grp('Containere (LXC)', ct, ct.length));
        out.push(this._grp('Lagring', R.proxmox.lagring.filter((g) => keep(g.bruk)).map((g) => { this.s(g.bruk); return this._row({ icon: 'mdi:database', color: C.orange, name: g.navn, act: `data-act="more" data-id="${esc(g.bruk || g.brukt)}"`, ent: g.bruk, right: this._bar(pctOf(h, g.bruk, g.brukt, g.total)) }); })));
        out.push(this._grp('Disker', R.proxmox.disker.filter((d) => keep(d.temp)).map((d) => { this.s(d.temp); return this._row({ icon: 'mdi:harddisk', color: '#afafaf', name: d.navn, sub: esc(d.helse ? fmt(h, d.helse) : ''), act: `data-act="more" data-id="${esc(d.temp || d.helse)}"`, ent: d.temp, right: `<span class="val num">${esc(fmt(h, d.temp))}</span>` }); })));
      } else if (key === 'unraid' && R.unraid) {
        const U = R.unraid;
        const gj = (t) => U.gjester.filter((g) => g.type === t && keep(g.bryter)).map((g) => {
          const s = this.s(g.bryter), on = s && s.state === 'on', up = g.oppdatering && this.s(g.oppdatering) && h.states[g.oppdatering].state === 'on';
          return this._row({ icon: t === 'vm' ? 'mdi:monitor' : 'mdi:docker', color: on ? C.purple : '#7f7f7f', name: g.navn, sub: (on ? 'Kjører' : 'Stoppet') + (up ? ` · <span style="color:${C.orange}">Oppdatering tilgjengelig</span>` : ''), ent: g.bryter, right: this._sw(on, `data-sw="${esc(g.bryter)}"`, g.navn) });
        });
        const dk = gj('docker'), vm = gj('vm');
        out.push(this._grp('Containere (Docker)', dk, dk.length), this._grp('Virtuelle maskiner', vm, vm.length));
        out.push(this._grp('Disker', U.disker.filter((d) => keep(d.bruk, d.temp)).map((d) => {
          this.s(d.bruk); this.s(d.temp);
          return this._row({ icon: /parity/.test(d.navn) ? 'mdi:shield-check' : /cache/.test(d.navn) ? 'mdi:flash' : 'mdi:harddisk', color: '#afafaf', name: diskNavn(d.navn), sub: esc(d.temp ? fmt(h, d.temp) : ''), act: `data-act="more" data-id="${esc(d.bruk || d.temp)}"`, ent: d.bruk || d.temp, right: d.bruk ? this._bar(pctOf(h, d.bruk)) : '' });
        })));
      }
      return out.filter(Boolean);
    }
    _autoList(R, key) {
      const h = this.hass, open = !!this.ui.autoOpen, ids = R.ents[key];
      let body = '';
      if (open) {
        const by = {};
        ids.forEach((id) => { const d = (h.entities[id] || {}).device_id || '_'; (by[d] = by[d] || []).push(id); });
        body = `<div class="alb">${Object.entries(by).sort((a, b) => R.devNavn(a[0]).localeCompare(R.devNavn(b[0]), 'nb')).map(([d, L]) => `<div class="ald">${esc(R.devNavn(d) || 'Uten enhet')}<span>${L.length}</span></div>${L.sort().map((id) => `<button class="ale" data-act="more" data-id="${esc(id)}"><span class="grow col"><b class="ell">${esc(M.name(h, id))}</b><span class="ell">${esc(id)}</span></span><span class="alv ell">${esc(fmt(h, id))}</span></button>`).join('')}`).join('')}</div>`;
      }
      return `<section class="card auto"><button class="alh" data-act="auto" aria-expanded="${open}">${M.icon('mdi:auto-fix', 20, 'color:#afafaf')}<span class="grow col"><b>Konfigurert automatisk</b><span>${ids.length} entiteter fra ${esc(IK[key].name)}</span></span>${M.icon(open ? 'mdi:chevron-up' : 'mdi:chevron-down', 22, 'color:#afafaf')}</button>${body}</section>`;
    }

    /* ---------------------------------------------------------- enhetsark (UniFi, portalt – fallgruve 1) */
    _openDev(devId) {
      const R = this._R, e = R && R.unifi.enheter.find((x) => x.dev === devId);
      if (!e) return;
      if (this._sheet) this._sheet.api.close();
      const api = M.overlay({ maxWidth: 520, guard: 350, css: SHEET_CSS, html: '' });
      const sh = { api, dev: devId, hist: null, draw: () => {} };
      sh.draw = () => {
        if (api.closed) return;
        const RR = this._R, E = RR && RR.unifi.enheter.find((x) => x.dev === devId);
        if (!E) return api.close();
        api.body.innerHTML = this._devHTML(RR, E, sh.hist);
        const g = api.body.querySelector('.gph');
        if (g) g.addEventListener('pointerdown', (ev) => ev.stopPropagation());
      };
      api.body.addEventListener('click', (ev) => {
        const b = ev.target.closest && ev.target.closest('[data-d]');
        if (!b) return;
        const h = this.hass, dd = b.dataset;
        M.haptic('light');
        if (dd.d === 'close') return api.close();
        if (dd.d === 'restart' && dd.id) return M.call(h, 'button', 'press', { entity_id: dd.id }).then(() => M.toast('Starter på nytt …')).catch(() => {});
        if (dd.d === 'locate') { if (dd.id && dd.id.startsWith('button.')) return M.call(h, 'button', 'press', { entity_id: dd.id }); if (dd.id) return M.call(h, 'light', 'turn_on', { entity_id: dd.id, flash: 'long' }).then(() => M.toast('LED-en blinker')).catch(() => {}); return; }
        if (dd.d === 'tgl' && dd.id) return M.toggle(h, dd.id);
        if (dd.d === 'ent' && dd.id) return M.moreInfo(this, dd.id);
      });
      api.onClosed = () => { if (this._sheet === sh) this._sheet = null; };
      this._sheet = sh;
      sh.draw();
      const ids = [e.rx, e.tx].filter(Boolean);
      if (ids.length) M.history(this.hass, ids, 24).then((r) => { sh.hist = r; sh.draw(); }).catch(() => {});
    }
    _devHTML(R, e, hist) {
      const h = this.hass, [tl, ic] = TYPE[e.type], off = apOffline(h, e);
      [e.tracker, e.cpu, e.mem, e.temp, e.oppetid, e.klienter, e.led, e.oppdatering, e.rx, e.tx].forEach((id) => this.s(id));
      const tr = e.tracker && h.states[e.tracker], upd = e.oppdatering && h.states[e.oppdatering], led = e.led && h.states[e.led];
      const pills = [`<span class="sp ${off ? 'warn' : 'ok'}">${off ? 'Frakoblet' : 'Online'}</span>`, `<span class="sp">${esc(tl)}</span>`,
        upd && upd.state === 'on' ? `<span class="sp warn">Oppdatering ${esc(upd.attributes.latest_version || 'tilgjengelig')}</span>` : upd ? `<span class="sp">${esc(upd.attributes.installed_version || 'Oppdatert')}</span>` : '',
        tr && tr.attributes.ip ? `<span class="sp">${esc(tr.attributes.ip)}</span>` : ''].filter(Boolean).join('');
      const act = (d, icon, label, id, on) => `<button class="ac ${on ? 'on' : ''}" data-d="${d}" ${id ? `data-id="${esc(id)}"` : 'disabled'}>${M.icon(icon, 22)}<span>${label}</span></button>`;
      const actions = `<div class="acts">${act('restart', 'mdi:restart', 'Start på nytt', e.restart)}${act('locate', 'mdi:crosshairs-gps', 'Finn enhet', e.finn || e.led)}${act('tgl', led && led.state === 'on' ? 'mdi:led-on' : 'mdi:led-off', 'LED', e.led, led && led.state === 'on')}</div>`;
      const tile = (label, v, id) => `<button class="st" data-d="ent" ${id ? `data-id="${esc(id)}"` : ''}><span>${label}</span><b class="num">${esc(v)}</b></button>`;
      const k = numOf(h, e.klienter);
      const tiles = `<div class="sts">${tile('CPU', fmt(h, e.cpu), e.cpu)}${tile('Minne', fmt(h, e.mem), e.mem)}${e.temp ? tile('Temperatur', fmt(h, e.temp), e.temp) : tile('Klienter', k == null ? '–' : nf(k), e.klienter)}${tile('Oppetid', oppetid(h, e.oppetid), e.oppetid)}</div>`;
      // trafikkgraf 24 t
      let graf;
      if (!e.rx && !e.tx) graf = '<div class="none">Fant ingen trafikksensor for enheten</div>';
      else {
        const S = (id) => (hist && id ? M.sample(hist[id] || [], 48, 24) : []);
        const a = S(e.rx), b = S(e.tx), mx = Math.max(1, ...a, ...b), Wg = 300, Hg = 90;
        const pts = (arr) => arr.map((v, i) => `${((i / 47) * Wg).toFixed(1)},${(Hg - 4 - (v / mx) * (Hg - 12)).toFixed(1)}`).join(' ');
        const u = (e.rx && h.states[e.rx] && h.states[e.rx].attributes.unit_of_measurement) || '';
        graf = `<div class="gph"><div class="gl2"><span><i style="background:${C.blue}"></i>Ned ${esc(fmt(h, e.rx))}</span><span><i style="background:${C.purple}"></i>Opp ${esc(fmt(h, e.tx))}</span></div>
          <svg viewBox="0 0 ${Wg} ${Hg}" preserveAspectRatio="none" aria-label="Trafikk siste 24 timer">${a.length ? `<polygon points="0,${Hg} ${pts(a)} ${Wg},${Hg}" fill="${C.blue}" fill-opacity=".15"/><polyline points="${pts(a)}" fill="none" stroke="${C.blue}" stroke-width="2" vector-effect="non-scaling-stroke"/>` : ''}${b.length ? `<polyline points="${pts(b)}" fill="none" stroke="${C.purple}" stroke-width="2" vector-effect="non-scaling-stroke"/>` : ''}${!a.length && !b.length ? `<line x1="0" y1="${Hg / 2}" x2="${Wg}" y2="${Hg / 2}" stroke="#545454" stroke-dasharray="4 4"/>` : ''}</svg>
          <div class="gx"><span>−24 t</span><span>−12 t</span><span>nå</span></div><div class="gmax">${hist ? `maks ${esc(nf(mx, mx < 10 ? 1 : 0))} ${esc(u)}` : 'Henter historikk …'}</div></div>`;
      }
      // type-spesifikt
      let spes = '';
      if (e.type === 'ap') {
        const rad = e.radioer.map((id) => `<button class="ln" data-d="ent" data-id="${esc(id)}"><span class="grow ell">${esc(M.name(h, id))}</span><b class="num">${esc(fmt(h, id))}</b></button>`).join('');
        const wl = R.unifi.wlan.map((w) => { const s = h.states[w.bryter]; return `<div class="ln"><span class="grow col"><span class="ell">${esc(w.navn)}</span><small>${w.klienter ? esc(fmt(h, w.klienter)) + ' klienter' : ''}</small></span>${w.bryter ? `<button class="sw ${s && s.state === 'on' ? 'on' : ''}" role="switch" aria-checked="${!!(s && s.state === 'on')}" aria-label="${esc(w.navn)}" data-d="tgl" data-id="${esc(w.bryter)}"><i></i></button>` : ''}</div>`; }).join('');
        spes = `<h4>Radioer</h4><div class="lst">${rad || wl || '<div class="none">Ingen radio-sensorer</div>'}</div>`;
      } else if (e.type === 'switch') {
        spes = `<h4>PoE-porter</h4><div class="lst">${e.porter.length ? e.porter.map((p) => { const s = h.states[p.id], on = s && s.state === 'on'; return `<div class="ln"><span class="pn num">${p.n}</span><span class="grow col"><span>Port ${p.n}</span><small>${p.effekt ? esc(fmt(h, p.effekt)) : p.type === 'syklus' ? 'Strømsyklus' : ''}</small></span>${p.type === 'bryter' ? `<button class="sw ${on ? 'on' : ''}" role="switch" aria-checked="${!!on}" aria-label="PoE port ${p.n}" data-d="tgl" data-id="${esc(p.id)}"><i></i></button>` : `<button class="mini" data-d="restart" data-id="${esc(p.id)}">${M.icon('mdi:power-cycle', 18)}Syklus</button>`}</div>`; }).join('') : '<div class="none">Ingen PoE-porter</div>'}</div>`;
      } else if (e.type === 'ruter') {
        const wan = [...e.latens, ...e.wan];
        spes = `<h4>WAN</h4><div class="lst">${wan.length ? wan.map((id) => `<button class="ln" data-d="ent" data-id="${esc(id)}"><span class="grow ell">${esc(M.name(h, id, true))}</span><b class="num">${esc(fmt(h, id))}</b></button>`).join('') : '<div class="none">Ingen WAN-sensorer</div>'}</div>`;
      }
      // klienter med blokker-bryter
      const mac = tr && (tr.attributes.mac || '').toLowerCase();
      const K = R.unifi.klienter.filter((kl) => {
        const s = kl.tracker && h.states[kl.tracker]; if (!s) return e.type === 'ruter';
        const A = s.attributes;
        if (e.type === 'ap') return !!mac && String(A.ap_mac || '').toLowerCase() === mac;
        if (e.type === 'switch') return !!mac && String(A.sw_mac || '').toLowerCase() === mac;
        return true;
      });
      const kl = `<h4>Klienter <span class="cnt">${K.length}</span></h4><div class="lst">${K.length ? K.map((x) => {
        const s = x.tracker && h.states[x.tracker], b = x.bryter && h.states[x.bryter], blokkert = b && b.state === 'off';
        return `<div class="ln"><span class="kic">${M.icon(s && s.attributes.is_wired ? 'mdi:ethernet' : 'mdi:cellphone', 18)}</span><button class="grow col tl" data-d="ent" data-id="${esc(x.tracker || x.bryter)}"><span class="ell">${esc(x.navn)}</span><small class="ell">${esc([s && s.state === 'home' ? 'Tilkoblet' : 'Borte', s && s.attributes.ip].filter(Boolean).join(' · '))}</small></button>${b ? `<span class="bl">Blokker</span><button class="sw ${blokkert ? 'on' : ''}" role="switch" aria-checked="${!!blokkert}" aria-label="Blokker ${esc(x.navn)}" data-d="tgl" data-id="${esc(x.bryter)}"><i></i></button>` : ''}</div>`;
      }).join('') : '<div class="none">Ingen klienter</div>'}</div>`;
      const ents = `<h4>Entiteter <span class="cnt">${e.alle.length}</span></h4><div class="lst">${e.alle.slice().sort().map((id) => `<button class="ln" data-d="ent" data-id="${esc(id)}"><span class="grow col"><span class="ell">${esc(M.name(h, id))}</span><small class="ell">${esc(id)}</small></span><b class="ell num">${esc(fmt(h, id))}</b></button>`).join('')}</div>`;
      return `<div class="dv" data-dev="${esc(e.dev)}"><div class="dh"><span class="dic">${M.icon(ic, 26)}</span><span class="grow col"><b class="ell">${esc(e.navn)}</b><span class="ell">${esc(e.modell || tl)}</span></span><button class="x" data-d="close" aria-label="Lukk">${M.icon('mdi:close', 22)}</button></div>
        <div class="sps">${pills}</div>${actions}${tiles}<h4>Trafikk siste 24 t</h4>${graf}${spes}${kl}${ents}</div>`;
    }

    afterRender() {
      const Rt = this.shadowRoot;
      if (M.glassDrag) Rt.querySelectorAll('.tabs').forEach((s) => M.glassDrag(s, { axis: 'x' }));
      const map = Rt.querySelector('.top');
      if (map && !this._ro && window.ResizeObserver) {
        this._ro = new ResizeObserver(() => { const m = this.shadowRoot.querySelector('.top'); const w = m ? Math.round(m.clientWidth - 36) : 0; if (w > 0 && Math.abs(w - this._mapW) > 2) { this._mapW = w; this.update(); } });
        this._ro.observe(map);
      }
      const w = map ? Math.round(map.clientWidth - 36) : 0;
      if (w > 0 && Math.abs(w - this._mapW) > 2) { this._mapW = w; this.update(); }
    }
    get styles() {
      return `
        :host{display:block;width:100%}
        .wrap{display:flex;flex-direction:column;gap:var(--msh-gap,8px)}
        .pane{display:flex;flex-direction:column;gap:var(--msh-gap,8px);min-width:0}
        .top{position:relative;border-radius:28px;background:var(--gray200,#3a3a3a);box-shadow:${C.edge};overflow:hidden;padding:18px 18px 14px}
        .th{display:flex;align-items:flex-start;gap:12px}
        .tl{flex:1;min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:8px}
        .tn{font-size:13px;color:var(--gray800,#afafaf)}
        .pl{display:inline-flex;align-items:center;gap:5px;height:26px;padding:0 11px 0 8px;border-radius:13px;font-size:12px;font-weight:600;white-space:nowrap}
        .pl.none{background:var(--gray300,#404040);color:var(--gray700,#979797)}
        .pl.ok{background:${M.alpha(C.green, 0.18)};color:${C.green}}
        .pl.warn{background:${M.alpha(C.orange, 0.2)};color:${C.orange}}
        .pl.red{background:${M.alpha(C.red, 0.22)};color:${C.red}}
        .tp{display:flex;flex-direction:column;align-items:flex-end;flex:none;cursor:pointer}
        .tv{font-size:36px;font-weight:300;line-height:1}.tv small{font-size:16px;margin-left:3px;color:var(--gray700,#979797)}
        .tpl{font-size:12px;color:var(--gray600,#7f7f7f);margin-top:4px}
        .map{position:relative;margin-top:10px;width:100%}
        .map svg{position:absolute;left:0;top:0;overflow:visible}
        .map.none{height:72px;display:flex;align-items:center;justify-content:center;gap:8px;color:var(--gray600,#7f7f7f);font-size:13px}
        .nd{position:absolute;transform:translateX(-50%);width:104px;display:flex;flex-direction:column;align-items:center;gap:2px;-webkit-tap-highlight-color:transparent}
        .ndc{position:relative;width:48px;height:48px;border-radius:24px;display:grid;place-items:center;background:var(--gray300,#404040);color:var(--nc);transition:box-shadow .2s,transform .15s}
        .nd:active .ndc{transform:scale(.94)}
        .nd.on .ndc{background:color-mix(in srgb, var(--nc) 22%, #404040);box-shadow:inset 0 0 0 2px var(--nc)}
        .ndl{font-size:12px;font-weight:500;max-width:104px;margin-top:4px}.nds{font-size:11px;color:var(--gray700,#979797);max-width:104px}
        .led{position:absolute;right:1px;top:1px;width:11px;height:11px;border-radius:6px;background:#696969;box-shadow:0 0 0 2px var(--gray200,#3a3a3a)}
        .led.green{background:${C.green};box-shadow:0 0 0 2px var(--gray200,#3a3a3a),0 0 8px ${C.green}}
        .led.orange{background:${C.orange};box-shadow:0 0 0 2px var(--gray200,#3a3a3a),0 0 8px ${C.orange}}
        .led.red{background:${C.red};box-shadow:0 0 0 2px var(--gray200,#3a3a3a),0 0 10px ${C.red};animation:blink 1.2s ease-in-out infinite}
        @keyframes blink{50%{opacity:.35}}
        @keyframes puls{0%{box-shadow:0 0 0 0 ${M.alpha(C.red, 0.55)}}70%{box-shadow:0 0 0 10px ${M.alpha(C.red, 0)}}100%{box-shadow:0 0 0 0 ${M.alpha(C.red, 0)}}}
        @media (prefers-reduced-motion: reduce){.pk{display:none}.led.red,.al.red .ali{animation:none}}
        .alerts{display:flex;flex-direction:column;padding:4px}
        .al{display:flex;align-items:center;gap:12px;width:100%;min-height:60px;padding:6px 10px;border-radius:20px;text-align:left}
        .al+.al{box-shadow:inset 0 1px 0 rgba(255,255,255,.05)}
        .ali{width:40px;height:40px;border-radius:20px;display:grid;place-items:center;flex:none}
        .al.red .ali{background:${M.alpha(C.red, 0.22)};color:${C.red};animation:puls 1.6s ease-out infinite}
        .al.orange .ali{background:${M.alpha(C.orange, 0.2)};color:${C.orange}}
        .al b{font-size:14px;font-weight:500}.al .col>span{font-size:12px;color:var(--gray700,#979797)}
        .al.red b{color:${C.red}}
        .alt{font-size:11px;color:var(--gray600,#7f7f7f);flex:none}
        .trow{display:flex;align-items:center;gap:8px;min-width:0}
        .tabs{flex:1;min-width:0;display:flex;gap:2px;padding:4px;border-radius:24px;background:var(--gray200,#3a3a3a);position:relative;touch-action:pan-y;overflow:hidden}
        .tb{flex:1 1 0;min-width:0;height:40px;padding:0 6px;border-radius:20px;display:inline-flex;align-items:center;justify-content:center;gap:5px;font-size:13px;color:var(--gray800,#afafaf);white-space:nowrap;overflow:hidden}
        .tb span{overflow:hidden;text-overflow:ellipsis}
        .tabs .tb.on,.tabs .itab.on{background:${C.accent};color:#2a1720;font-weight:500}
        .tabs .itab{color:var(--gray800,#afafaf)}
        ${M.iconTabs.css('.tabs.itabs')}
        .gear{width:48px;height:48px;border-radius:24px;flex:none;display:grid;place-items:center;background:var(--gray200,#3a3a3a);box-shadow:${C.edge}}
        .gauges{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;padding:14px 8px}
        .ga{display:flex;flex-direction:column;align-items:center;gap:6px;min-width:0}
        .gr{position:relative;width:72px;height:72px;display:grid;place-items:center}
        .gr svg{position:absolute;inset:0;width:100%;height:100%}
        .gv{position:relative;font-size:17px;font-weight:500}.gv small{font-size:11px;color:var(--gray700,#979797);margin-left:1px}
        .gl{font-size:12px;color:var(--gray700,#979797)}
        .grp{display:flex;flex-direction:column;gap:6px}
        .gt{display:flex;align-items:center;gap:8px;padding:6px 8px 0;font-size:13px;color:var(--gray800,#afafaf)}
        .gc{height:20px;min-width:20px;padding:0 6px;border-radius:10px;background:var(--gray300,#404040);font-size:11px;display:inline-grid;place-items:center}
        .rows{display:flex;flex-direction:column;padding:4px 0}
        .rw{display:flex;align-items:center;gap:12px;min-height:60px;padding:6px 14px;cursor:pointer}
        .rw+.rw{box-shadow:inset 0 1px 0 rgba(255,255,255,.05)}
        .rw .ic{width:40px;height:40px;border-radius:20px;display:grid;place-items:center;flex:none;background:var(--gray300,#404040);color:var(--ic)}
        .rw b{font-size:14px;font-weight:500}.rw .col>span{font-size:12px;color:var(--gray700,#979797)}
        .val{font-size:13px;color:var(--gray900,#c7c7c7);flex:none}
        .bar{width:64px;height:6px;border-radius:3px;background:var(--gray400,#545454);overflow:hidden;flex:none}.bar i{display:block;height:100%;border-radius:3px}
        .dot{width:9px;height:9px;border-radius:5px;flex:none;background:#696969}.dot.green{background:${C.green}}.dot.orange{background:${C.orange}}
        .sw{position:relative;width:44px;height:26px;border-radius:13px;flex:none;background:var(--gray400,#545454);transition:background .2s}
        .sw i{position:absolute;left:3px;top:3px;width:20px;height:20px;border-radius:10px;background:#fafafa;transition:transform .2s cubic-bezier(.34,1.4,.64,1)}
        .sw.on{background:${C.pink}}.sw.on i{transform:translateX(18px)}
        .auto{display:flex;flex-direction:column}
        .alh{display:flex;align-items:center;gap:12px;width:100%;min-height:60px;padding:6px 14px;text-align:left}
        .alh b{font-size:14px;font-weight:500}.alh .col>span{font-size:12px;color:var(--gray700,#979797)}
        .alb{display:flex;flex-direction:column;padding:0 8px 10px}
        .ald{display:flex;justify-content:space-between;padding:10px 8px 4px;font-size:12px;color:var(--gray700,#979797)}
        .ale{display:flex;align-items:center;gap:10px;width:100%;min-height:44px;padding:4px 8px;border-radius:14px;text-align:left}
        .ale b{font-size:13px;font-weight:500}.ale .col>span{font-size:11px;color:var(--gray600,#7f7f7f)}
        .alv{font-size:12px;color:var(--gray900,#c7c7c7);max-width:40%;flex:none}
        .nf{padding:28px 18px}.nf b{font-size:15px;color:var(--white,#fafafa);font-weight:500}
      `;
    }
  }

  const SHEET_CSS = `
    .dv{display:flex;flex-direction:column;gap:12px;padding-bottom:calc(var(--ki-nav-h, 68px) + var(--ki-nav-bottom, 8px))}
    .dh{display:flex;align-items:center;gap:12px}
    .dic{width:52px;height:52px;border-radius:26px;display:grid;place-items:center;background:${M.alpha(C.blue, 0.2)};color:${C.blue};flex:none}
    .dh b{font-size:20px;font-weight:600}.dh .col>span{font-size:13px;color:#979797}
    .x{width:44px;height:44px;border-radius:22px;background:#404040;display:grid;place-items:center;flex:none}
    .sps{display:flex;flex-wrap:wrap;gap:6px}
    .sp{height:26px;padding:0 11px;border-radius:13px;background:#404040;font-size:12px;display:inline-flex;align-items:center;color:#c7c7c7}
    .sp.ok{background:${M.alpha(C.green, 0.18)};color:${C.green};font-weight:600}.sp.warn{background:${M.alpha(C.orange, 0.2)};color:${C.orange};font-weight:600}
    .acts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
    .ac{height:68px;border-radius:22px;background:#3a3a3a;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font-size:12px;color:#fafafa}
    .ac:active{transform:scale(.96)}.ac[disabled]{opacity:.4;cursor:default}
    .ac.on{background:${M.alpha(C.blue, 0.22)};color:${C.blue}}
    .sts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
    .st{display:flex;flex-direction:column;align-items:flex-start;gap:4px;padding:10px 12px;border-radius:18px;background:#3a3a3a;text-align:left;min-width:0}
    .st span{font-size:11px;color:#979797}.st b{font-size:14px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
    h4{margin:6px 4px 0;font-size:13px;font-weight:500;color:#afafaf;display:flex;align-items:center;gap:8px}
    .cnt{height:20px;min-width:20px;padding:0 6px;border-radius:10px;background:#404040;font-size:11px;display:inline-grid;place-items:center;color:#c7c7c7}
    .gph{position:relative;padding:12px;border-radius:22px;background:#3a3a3a;touch-action:pan-y}
    .gph svg{display:block;width:100%;height:90px}
    .gl2{display:flex;gap:14px;font-size:12px;color:#c7c7c7;margin-bottom:6px}.gl2 i{display:inline-block;width:8px;height:8px;border-radius:4px;margin-right:6px}
    .gx{display:flex;justify-content:space-between;font-size:11px;color:#7f7f7f;margin-top:4px}
    .gmax{position:absolute;right:12px;top:12px;font-size:11px;color:#7f7f7f}
    .lst{display:flex;flex-direction:column;border-radius:22px;background:#3a3a3a;padding:4px 0}
    .ln{display:flex;align-items:center;gap:10px;width:100%;min-height:52px;padding:4px 14px;text-align:left;color:#fafafa}
    .ln+.ln{box-shadow:inset 0 1px 0 rgba(255,255,255,.05)}
    .ln small{font-size:11px;color:#979797}.ln b{font-size:13px;font-weight:500;color:#c7c7c7;max-width:45%}
    .ln .tl{text-align:left;min-width:0}
    .pn{width:28px;height:28px;border-radius:8px;background:#404040;display:grid;place-items:center;font-size:12px;flex:none}
    .kic{width:32px;height:32px;border-radius:16px;background:#404040;display:grid;place-items:center;flex:none;color:#afafaf}
    .bl{font-size:11px;color:#979797}
    .mini{height:32px;padding:0 12px;border-radius:16px;background:#404040;font-size:12px;display:inline-flex;align-items:center;gap:6px}
    .none{padding:14px;color:#979797;font-size:13px}
    .sw{position:relative;width:44px;height:26px;border-radius:13px;flex:none;background:#545454;transition:background .2s}
    .sw i{position:absolute;left:3px;top:3px;width:20px;height:20px;border-radius:10px;background:#fafafa;transition:transform .2s cubic-bezier(.34,1.4,.64,1)}
    .sw.on{background:${C.pink}}.sw.on i{transform:translateX(18px)}
    @media (max-width:380px){.sts{grid-template-columns:repeat(2,minmax(0,1fr))}}`;

  M.POPUP_CARDS = M.POPUP_CARDS || [];
  if (!M.POPUP_CARDS.includes('msh-server-card')) M.POPUP_CARDS.push('msh-server-card'); // «Mellomrom» ligger i Avansert-fanen
  // Den gamle importerte #server (ki-homelab-card o.l.) erstattes av denne – til brukeren velger «Bruk egen» (04-strategy)
  M.POPUP_SUPERSEDE = M.POPUP_SUPERSEDE || {};
  M.POPUP_SUPERSEDE[HASH] = { name: 'Server', test: (cfg) => /custom:ki-(homelab|server|pve|unifi|rack)-card/.test(JSON.stringify(cfg || {})) };
  // Vilkår (strategi/allPopups): minst én av integrasjonene – entiteter i registeret eller en config entry
  M.popupNeeds = M.popupNeeds || {};
  M.popupNeeds[HASH] = (hass) => Object.values((hass && hass.entities) || {}).some((e) => e && PLAT[e.platform]) || (Array.isArray(CE.data) && CE.data.length > 0);
  M.server = { oppdag, varsler, malere, entries, INTEG };
  M.define('msh-server-card', Server, 'MSH Server', 'Server-popup (#server): homelab med UniFi, Proxmox VE og Unraid – nodekart, varsler, målere og enhetsark.');
})();
