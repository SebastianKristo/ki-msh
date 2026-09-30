/* msh-server-card · Server-popup #server (fiks 26.1–26.8, erstatter 24.10 – promptets «ki-homelab-popup-card»).
 * «Server v5.dc.html» finnes ikke i repoet: bygget etter prompt-teksten. Funksjons-popup (Mal A), ETT kort, Bubble eier headeren.
 * Rekkefølge: hovedfaner Nettverk · Proxmox · Unraid (data-glass-drag, rosa boble, stil tekst/aktiv/ikon) + tannhjul (48×48)
 *   → toppkort (184 px, graf 84 px med scrub, 3 målinger per fane, trykk sekundærverdi = bytt graf) → prosalinje (hvite piller)
 *   → underfaner (segment/piller, huskes per fane) → seksjonene i valgt underfane (kort #3a3a3a r28, indre flater #404040 r22).
 * Nettverk: Enheter (gateway/AP-fliser som utvides), Kameraer (UniFi Protect, opptak/pause), Switcher (switch-kortet: portgrid
 *   8 kolonner, PoE-budsjett, portdetalj med «Port aktiv»/«PoE»-brytere og «Strømsyklus PoE» – samme funksjon som 24.10).
 * Proxmox/Unraid: Oversikt (Ytelse 4 kolonner + Systeminfo), Lagring (Array-rad, lagringsområder, disk-bays med detalj),
 *   Gjester/Docker (søk, filter, rader med bryter/spinner, utvidet rad) og Kontroller (4 runde knapper, farlige = to trykk).
 * Autokonfig (behold fra 24.10): integrasjonene oppdages fra config entries (config_entries/get) + entitets-/enhetsregisteret.
 *   Fire kilder: UniFi Network (unifi), UniFi Protect (unifiprotect), Proxmox VE (proxmoxve) og Unraid (unraid, fallback Glances
 *   med bare målinger). Manuelt valg: integrations: { unifi, protect, proxmox, unraid: <entry_id|'none'> } via integrasjonsvelgeren
 *   (portalt ark, MSH.overlay). Ingen hardkodede ID-er, aldri mock: mangler → «–».
 * Config (samme skjema i «Tilpass Server» og GUI-editoren): tabs { order, hidden, style: text|active|icon, start },
 *   subtabs { show, style: segment|pills }, sections { order, hidden, map }, hero_metric { net, proxmox, unraid },
 *   limits { disk_temp (30–70 °C), storage (50–100 %) }, integrations, overrides, exclude, gap/pad_top/pad_bottom.
 */
(function () {
  const M = window.MSH;
  if (!M || customElements.get('msh-server-card')) return;
  const esc = M.esc, C = M.C;
  const HASH = '#server';
  // Kilder (INT): nøkkel → domene(r), plattformer, navn. Unraid faller tilbake til Glances (bare målinger).
  const INTEG = [
    { key: 'unifi', domain: 'unifi', domains: ['unifi'], platforms: ['unifi'], name: 'UniFi Network', icon: 'mdi:router-network', color: C.blue },
    { key: 'protect', domain: 'unifiprotect', domains: ['unifiprotect'], platforms: ['unifiprotect'], name: 'UniFi Protect', icon: 'mdi:cctv', color: C.blue },
    { key: 'proxmox', domain: 'proxmoxve', domains: ['proxmoxve'], platforms: ['proxmoxve', 'proxmox_sensors'], name: 'Proxmox VE', icon: 'mdi:server', color: C.orange },
    { key: 'unraid', domain: 'unraid', domains: ['unraid', 'glances'], platforms: ['unraid', 'glances'], name: 'Unraid', icon: 'mdi:nas', color: C.purple },
  ];
  const INT = Object.fromEntries(INTEG.map((i) => [i.key, i]));
  const PLAT = {}; INTEG.forEach((i) => i.platforms.forEach((p) => { PLAT[p] = i.key; }));
  const DOMS = INTEG.flatMap((i) => i.domains);
  // Hovedfaner og underfaner
  const TABS = [['net', 'Nettverk', 'mdi:lan'], ['proxmox', 'Proxmox', 'mdi:server'], ['unraid', 'Unraid', 'mdi:nas']];
  const TABL = Object.fromEntries(TABS.map((t) => [t[0], t]));
  const TAB_INT = { net: 'unifi', proxmox: 'proxmox', unraid: 'unraid' };
  const SUBS = {
    net: [['enheter', 'Enheter'], ['kameraer', 'Kameraer'], ['switcher', 'Switcher']],
    proxmox: [['oversikt', 'Oversikt'], ['lagring', 'Lagring'], ['gjester', 'Gjester'], ['kontroller', 'Kontroller']],
    unraid: [['oversikt', 'Oversikt'], ['lagring', 'Lagring'], ['docker', 'Docker'], ['kontroller', 'Kontroller']],
  };
  // Seksjoner (SECDEF): [id, navn i Tilpass, ikon, standard-underfane, tittel i kortet]
  const SECDEF = {
    net: [['gw', 'Gateway og AP-er', 'mdi:router-wireless', 'enheter'], ['cams', 'Kameraer', 'mdi:cctv', 'kameraer'], ['sw', 'Switcher', 'mdi:switch', 'switcher']],
    proxmox: [['perf', 'Nøkkeltall', 'mdi:speedometer', 'oversikt', 'Ytelse'], ['sys', 'Systeminfo', 'mdi:information-outline', 'oversikt'], ['storage', 'Lagring', 'mdi:database', 'lagring', 'Lagringsområder'], ['disks', 'Disker', 'mdi:harddisk', 'lagring'], ['guests', 'Gjester', 'mdi:monitor-multiple', 'gjester'], ['controls', 'Kontroller', 'mdi:tune-vertical', 'kontroller']],
    unraid: [['perf', 'Nøkkeltall', 'mdi:speedometer', 'oversikt', 'Ytelse'], ['sys', 'Systeminfo', 'mdi:information-outline', 'oversikt'], ['storage', 'Lagring', 'mdi:database', 'lagring', 'Lagringsområder'], ['disks', 'Disker', 'mdi:harddisk', 'lagring'], ['docker', 'Docker', 'mdi:docker', 'docker'], ['controls', 'Kontroller', 'mdi:tune-vertical', 'kontroller']],
  };
  const SEC = {}; Object.entries(SECDEF).forEach(([t, L]) => L.forEach(([id, label, icon, sub, title]) => { SEC[t + '.' + id] = { id: t + '.' + id, key: id, tab: t, label, icon, sub, title: title || label }; }));
  // Toppkortets målinger per fane: [nøkkel, etikett, farge]
  const HM = {
    net: [['down', 'Ned', C.blue], ['up', 'Opp', C.green], ['lat', 'Latens', C.orange]],
    proxmox: [['cpu', 'CPU', C.blue], ['mem', 'Minne', C.green], ['power', 'Strøm', C.orange]],
    unraid: [['cpu', 'CPU', C.blue], ['mem', 'Minne', C.green], ['temp', 'Temp', C.red]],
  };
  const LIM = { disk_temp: 50, storage: 85 };
  const DEF = {};
  const TTL = 300000;
  const INK = '#2a1720';

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
  const RUN = ['running', 'on', 'online', 'started', 'home', 'connected', 'true', 'recording', 'streaming', 'idle'];
  const kjorer = (s) => !!s && RUN.includes(String(s.state).toLowerCase());

  /* ------------------------------------------------------------ config entries (config_entries/get) */
  // undefined = ikke hentet ennå · null = ikke tilgang (ikke admin) → bare entitets-/enhetsregisteret. Hentes på nytt etter 5 min.
  const CE = { data: undefined, busy: false, t: 0 };
  function entries(hass) {
    if (!hass || !hass.callWS) return CE.data;
    if (!CE.busy && Date.now() - CE.t > TTL) {
      CE.busy = true;
      Promise.resolve().then(() => hass.callWS({ type: 'config_entries/get' }))
        .then((r) => { CE.data = (Array.isArray(r) ? r : []).filter((e) => e && DOMS.includes(e.domain)); })
        .catch(() => { CE.data = null; })
        .then(() => { CE.t = Date.now(); CE.busy = false; window.dispatchEvent(new CustomEvent('msh-server-entries')); });
    }
    return CE.data;
  }
  const regOf = (hass, e) => { const d = e && e.device_id && hass.devices && hass.devices[e.device_id]; return (d && d.config_entries) || (e && e.config_entry_id ? [e.config_entry_id] : []); };
  // Config entries for en kilde (openPick): fra config_entries/get, ellers utledet fra enhetsregisteret (ikke-admin)
  function entriesFor(hass, k) {
    const I = INT[k], E = (hass && hass.entities) || {}, D = (hass && hass.devices) || {};
    const L = Array.isArray(CE.data) ? CE.data.filter((e) => I.domains.includes(e.domain)).map((e) => ({ entry_id: e.entry_id, title: e.title || e.domain, domain: e.domain, state: e.state })) : [];
    if (!Array.isArray(CE.data)) {
      const seen = new Set();
      Object.values(E).forEach((e) => {
        if (!e || !I.platforms.includes(e.platform)) return;
        regOf(hass, e).forEach((id) => { if (seen.has(id)) return; seen.add(id); const d = D[e.device_id]; L.push({ entry_id: id, title: (d && (d.name_by_user || d.name)) || e.platform, domain: e.platform === 'glances' ? 'glances' : I.domain }); });
      });
    }
    L.forEach((x) => { x.count = Object.values(E).filter((e) => e && I.platforms.includes(e.platform) && !e.disabled_by && regOf(hass, e).includes(x.entry_id)).length; });
    return L.sort((a, b) => (a.domain === I.domain ? 0 : 1) - (b.domain === I.domain ? 0 : 1));
  }
  const autoEntry = (hass, k) => { const L = entriesFor(hass, k); return L.find((x) => x.count > 0) || L[0] || null; };

  /* ------------------------------------------------------------ oppdagelse */
  let MEMO = null;
  function oppdag(hass, cfg) {
    const E = hass.entities || {}, D = hass.devices || {}, ce = entries(hass);
    const ex = cfg.exclude || [], sel = cfg.integrations || {};
    const sig = JSON.stringify([ex, sel]);
    if (MEMO && MEMO.E === E && MEMO.D === D && MEMO.ce === ce && MEMO.sig === sig && MEMO.S === hass.states) return MEMO.R;
    // 1) kandidater per kilde (plattform), 2) valgt config entry / «Ingen» / auto
    const pool = { unifi: [], protect: [], proxmox: [], unraid: [], glances: [] };
    for (const id in E) {
      const e = E[id]; const key = e && PLAT[e.platform];
      if (!key || e.hidden || e.hidden_by || e.disabled_by || !hass.states[id]) continue;
      pool[e.platform === 'glances' ? 'glances' : key].push(e);
    }
    const chosen = {}, mode = {};
    INTEG.forEach((i) => {
      const s = sel[i.key];
      const cand = i.key === 'unraid' ? [...pool.unraid, ...pool.glances] : pool[i.key];
      if (s === 'none') { chosen[i.key] = []; mode[i.key] = 'none'; return; }
      if (s) { chosen[i.key] = cand.filter((e) => regOf(hass, e).includes(s)); mode[i.key] = 'manual'; return; }
      chosen[i.key] = i.key === 'unraid' ? (pool.unraid.length ? pool.unraid : pool.glances) : cand;
      mode[i.key] = 'auto';
    });
    const per = {}, ents = {};
    INTEG.forEach((i) => {
      per[i.key] = {}; ents[i.key] = [];
      chosen[i.key].forEach((e) => { (per[i.key][e.device_id || '_'] = per[i.key][e.device_id || '_'] || []).push(e); ents[i.key].push(e.entity_id); });
    });
    const found = {};
    // «funnet» = entiteter plukket opp (en config entry uten entiteter gir «Fant ikke …» + velger)
    INTEG.forEach((i) => { found[i.key] = mode[i.key] !== 'none' && ents[i.key].length > 0; });
    const devNavn = (id) => { const d = D[id]; return d ? (d.name_by_user || d.name || '') : ''; };
    const devModell = (id) => { const d = D[id]; return d ? `${d.manufacturer || ''} ${d.model || ''}`.toLowerCase() : ''; };
    const nm = cfg.navn_map || {};
    const R = { found, mode, ents, per, devNavn, loading: ce === undefined, proxmox: { noder: [], gjester: [], lagring: [], varsler: [], diskerMap: {}, disker: [] }, unifi: { enheter: [], wlan: [], klienter: [] }, protect: { kameraer: [] }, unraid: null, power: [] };

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
      navn = nm[vmid] || nm[raa] || nm[navn] || (type === 'ct' || type === 'vm' ? navn.replace(/^./, (c) => c.toUpperCase()) : navn); // node/lagring: Proxmox-navnet uendret (pve, local-lvm)
      const g = {
        id: 'px-' + dev, dev, kilde: 'proxmox', type, navn, vmid, nokkel: raa, modell: (D[dev] && D[dev].model) || '',
        status: finn(liste, /(node_)?status$/, 'sensor') || finn(liste, /(status|running)$/, 'binary_sensor'),
        cpu: finn(liste, /cpu_usage$/, 'sensor'),
        mem: finn(liste, /(memory|ram)_usage$/, 'sensor'),
        disk: finn(liste, /disk_usage$/, 'sensor'),
        temp: finn(liste, /(cpu_)?temp(erature)?$/, 'sensor'),
        ramBrukt: finn(liste, /(ram|memory)_used$/, 'sensor'), ramTot: finn(liste, /(ram|memory)_total$/, 'sensor'),
        diskBrukt: finn(liste, /disk_used$/, 'sensor'), diskTot: finn(liste, /disk_total$/, 'sensor'),
        oppetid: finn(liste, /uptime$/, 'sensor'),
        bruk: finn(liste, /_usage$/, 'sensor'), brukt: finn(liste, /_used$/, 'sensor'), total: finn(liste, /_(total|size)$/, 'sensor'),
        // 26.5: Ytelse / Systeminfo
        last: finn(liste, /(load(_avg(erage)?)?(_1m?)?|cpu_load)$/, 'sensor'), swap: finn(liste, /swap_(usage|used_percent|percent)$/, 'sensor'),
        iowait: finn(liste, /io_?wait$/, 'sensor'), power: liste.find((e) => dom(e.entity_id) === 'sensor' && hass.states[e.entity_id].attributes.device_class === 'power') ? liste.find((e) => dom(e.entity_id) === 'sensor' && hass.states[e.entity_id].attributes.device_class === 'power').entity_id : undefined,
        versjon: finn(liste, /(pve_)?version$/, 'sensor'), kernel: finn(liste, /kernel/, 'sensor'),
        oppd: finn(liste, /updates?(_available|_packages|_count)?$/, 'sensor') || finn(liste, /update/, 'binary_sensor') || finn(liste, /./, 'update'),
        backup: finn(liste, /backup/, 'sensor') || finn(liste, /backup/, 'binary_sensor'),
        bryter: finn(liste, /./, 'switch'),
        knapper: liste.filter((e) => dom(e.entity_id) === 'button').map((e) => {
          const o = obj(e.entity_id).slice(pre.length);
          const a = /^start(_all)?$|^start/.test(o) ? 'start' : /^stop/.test(o) ? 'stopp' : /^(reboot|restart)/.test(o) ? 'restart' : /^shutdown/.test(o) ? 'av'
            : /^pause|suspend/.test(o) ? 'pause' : /^resume/.test(o) ? 'fortsett' : /^hibernate/.test(o) ? 'dvale' : /^reset/.test(o) ? 'reset'
              : /(update|upgrade|refresh)/.test(o) ? 'oppdater' : /(backup|vzdump)/.test(o) ? 'backup' : null;
          return a ? { a, id: e.entity_id } : null;
        }).filter(Boolean),
      };
      if (type === 'node') R.proxmox.noder.push(g);
      else if (type === 'ct' || type === 'vm') R.proxmox.gjester.push(g);
      else if (type === 'storage') R.proxmox.lagring.push(g);
      else if (type === 'disks' || type === 'disk' || type === 'annet') {
        liste.filter((e) => ['sensor', 'binary_sensor'].includes(dom(e.entity_id))).forEach((e) => {
          const o = obj(e.entity_id);
          const m = o.match(/(airflow_temperature|temperature|temp|size|health|smart_status|smart|wearout|life_left|power_on_hours|usage)$/); if (!m) return;
          const k = o.slice(0, o.length - m[1].length).replace(/_$/, '').replace(/^\d+_disks?_/, '').replace(/^disks?_/, '');
          const d = (R.proxmox.diskerMap[k] = R.proxmox.diskerMap[k] || { id: 'pd-' + k, nokkel: k });
          const f = /temp/.test(m[1]) ? 'temp' : m[1] === 'size' ? 'storrelse' : /health|smart/.test(m[1]) ? 'helse' : /wearout|life/.test(m[1]) ? 'slitasje' : m[1] === 'usage' ? 'bruk' : 'timer';
          if (!d[f]) d[f] = e.entity_id;
        });
      }
    }
    R.proxmox.disker = Object.values(R.proxmox.diskerMap).map((d) => { d.navn = nm[d.nokkel] || tittel(d.nokkel); return d; });
    const rek = { start: 0, restart: 1, stopp: 2, av: 3, pause: 4, fortsett: 5, dvale: 6, reset: 7, oppdater: 8, backup: 9 };
    [...R.proxmox.gjester, ...R.proxmox.noder].forEach((g) => g.knapper.sort((a, b) => rek[a.a] - rek[b.a]));
    R.proxmox.gjester.sort((a, b) => String(a.vmid || a.navn).localeCompare(String(b.vmid || b.navn), 'nb', { numeric: true }));
    const pxPw = ents.proxmox.filter((id) => dom(id) === 'sensor' && hass.states[id].attributes.device_class === 'power');
    R.proxmox.power = (R.proxmox.noder[0] && R.proxmox.noder[0].power) || pxPw[0];

    /* UniFi Network (ki-homelab-card, + klienter, trafikk, kanal, porter med PoE til switch-kortet) */
    for (const [dev, liste] of Object.entries(per.unifi)) {
      const navn = devNavn(dev) || 'UniFi';
      const bilde = finn(liste, /./, 'image');
      const wlanKlienter = finn(liste, /(wlan_clients|clients|klienter)$/, 'sensor');
      if (bilde || (liste.length <= 4 && finn(liste, /(aktivert|enabled|wlan)/, 'switch'))) {
        R.unifi.wlan.push({ id: 'wl-' + dev, dev, navn, qr: bilde, klienter: wlanKlienter, bryter: finn(liste, /./, 'switch') });
        continue;
      }
      const cpu = finn(liste, /cpu_utili[sz]ation$/, 'sensor'), mem = finn(liste, /memory_utili[sz]ation$/, 'sensor');
      const restart = finn(liste, /(restart|omstart|reboot)$/, 'button');
      // porter: n → { en (port av/på), poe, cyc (strømsyklus), pw (PoE W), rx/tx, speed }
      const P = {};
      const pp = (n) => (P[n] = P[n] || { n });
      liste.forEach((e) => {
        const o = obj(e.entity_id), d = dom(e.entity_id); let m;
        if (d === 'switch' && (m = o.match(/port_(\d+)_poe$/))) pp(+m[1]).poe = e.entity_id;
        else if (d === 'switch' && (m = o.match(/port_(\d+)$/))) pp(+m[1]).en = e.entity_id;
        else if (d === 'button' && (m = o.match(/port_(\d+)_power_cycle$/))) pp(+m[1]).cyc = e.entity_id;
        else if (d === 'sensor' && (m = o.match(/port_(\d+)_poe_power$/))) pp(+m[1]).pw = e.entity_id;
        else if (d === 'sensor' && (m = o.match(/port_(\d+)_(rx|tx)$/))) pp(+m[1])[m[2]] = e.entity_id;
        else if (d === 'sensor' && (m = o.match(/port_(\d+)_(link_)?speed$/))) pp(+m[1]).speed = e.entity_id;
      });
      const led = finn(liste, /./, 'light');
      const nPort = Object.keys(P).length;
      if (!cpu && !mem && !restart && !nPort && !led) {
        // klient: sporer + blokker-bryter
        const tr = finn(liste, /./, 'device_tracker');
        if (tr || finn(liste, /./, 'switch')) R.unifi.klienter.push({ id: 'cl-' + dev, dev, navn, tracker: tr, bryter: finn(liste, /./, 'switch') });
        continue;
      }
      const latens = alle(liste, /wan_latency$/, 'sensor');
      const m = devModell(dev);
      const type = latens.length || /dream|gateway|udm|udr|ucg|uxg|usg|cloud key/.test(m) ? 'ruter'
        : nPort || /switch|usw|flex|\bus[- ]?\d/.test(m) ? 'switch'
          : /access point|u6|u7|uap|mesh|nanohd|lite|pro ap|in-wall/.test(m) ? 'ap' : 'enhet';
      const porter = Object.values(P).sort((a, b) => a.n - b.n);
      const modell = (D[dev] && D[dev].model) || '';
      const mN = (modell.match(/\b(5|8|10|16|24|48)\b/) || [])[1];
      R.unifi.enheter.push({
        id: 'uf-' + dev, dev, navn, type, modell,
        tracker: finn(liste, /./, 'device_tracker'), cpu, mem,
        temp: finn(liste, /temperat/, 'sensor'), oppetid: finn(liste, /(uptime|oppetid)$/, 'sensor'),
        klienter: finn(liste, /(clients|klienter)$/, 'sensor'), latens, led, restart,
        finn: finn(liste, /(locate|identify|finn)/, 'button') || finn(liste, /(locate|identify|finn)/, 'switch'),
        kanal: finn(liste, /channel|kanal/, 'sensor'),
        tilstand: finn(liste, /_state$/, 'sensor'),
        oppdatering: finn(liste, /./, 'update'),
        rx: finn(liste, /(wan_rx|_rx|rx_rate|download|_rx_bytes|throughput_rx)$/, 'sensor'), tx: finn(liste, /(wan_tx|_tx|tx_rate|upload|_tx_bytes|throughput_tx)$/, 'sensor'),
        budsjett: finn(liste, /(ac_power_budget|poe_budget|power_budget)$/, 'sensor'), forbruk: finn(liste, /(ac_power_consumption|poe_power_consumption|power_consumption)$/, 'sensor'),
        porter, antall: Math.max(mN ? +mN : 0, porter.length ? porter[porter.length - 1].n : 0), alle: liste.map((e) => e.entity_id),
      });
    }
    const typeRek = { ruter: 0, switch: 1, ap: 2, enhet: 3 };
    R.unifi.enheter.sort((a, b) => typeRek[a.type] - typeRek[b.type] || a.navn.localeCompare(b.navn, 'nb'));
    R.unifi.klienter.sort((a, b) => a.navn.localeCompare(b.navn, 'nb'));

    /* UniFi Protect (26.4): én flis per kamera/ringeklokke (enheter med camera.*) */
    for (const [dev, liste] of Object.entries(per.protect)) {
      const cams = alle(liste, /./, 'camera').sort((a, b) => (/(package|insecure|_low|_medium)/.test(obj(a)) ? 1 : 0) - (/(package|insecure|_low|_medium)/.test(obj(b)) ? 1 : 0));
      if (!cams.length) continue;
      const modell = (D[dev] && D[dev].model) || '';
      R.protect.kameraer.push({
        id: 'pc-' + dev, dev, navn: devNavn(dev) || tittel(obj(cams[0])), modell, cam: cams[0],
        ringeklokke: /doorbell|ringeklokke/i.test(modell) || !!finn(liste, /doorbell/, 'binary_sensor'),
        modus: finn(liste, /recording_mode$/, 'select'), opptak: finn(liste, /(_recording|record)$/, 'switch'),
        bevegelse: finn(liste, /motion$/, 'binary_sensor') || finn(liste, /(motion|person|detected)/, 'binary_sensor'),
        bitrate: finn(liste, /(bitrate|data_rate|received_data)$/, 'sensor'),
        restart: finn(liste, /(restart|reboot)/, 'button'), oppetid: finn(liste, /uptime$/, 'sensor'),
      });
    }
    R.protect.kameraer.sort((a, b) => (a.ringeklokke ? 1 : 0) - (b.ringeklokke ? 1 : 0) || a.navn.localeCompare(b.navn, 'nb'));

    /* Unraid (ki-homelab-card) – eller Glances (bare målinger) */
    const ur = Object.entries(per.unraid);
    if (ur.length) {
      const liste = ur.flatMap(([, l]) => l);
      const glances = liste.every((e) => e.platform === 'glances');
      const serverNavn = devNavn(ur[0][0]) || (glances ? 'Glances' : 'Unraid');
      const fn = (id) => { const s = hass.states[id]; return (s && s.attributes.friendly_name) || obj(id); };
      const kortNavn = (id) => { let t = fn(id); for (const [d] of ur) { const n = devNavn(d); if (n && t.toLowerCase().startsWith(n.toLowerCase())) t = t.slice(n.length); } return t.replace(/^[\s:–-]+/, '').trim() || tittel(obj(id)); };
      const system = /(array|parity|spin|share|mover|service|notification|flash|ups|plugin|fan|zfs|disk\d|cache)/;
      const brytere = glances ? [] : liste.filter((e) => dom(e.entity_id) === 'switch' && !e.entity_category && !system.test(obj(e.entity_id)));
      const disker = {};
      liste.forEach((e) => {
        const o = obj(e.entity_id), d = dom(e.entity_id);
        const m = o.match(/(disk\d+|parity\d*|cache[a-z0-9]*)_(usage|temperature|temp|smart(_status)?|spinning|spin(_state)?|standby|status|state|used|size|total)$/);
        if (!m || (d === 'switch' && !/spin/.test(m[2]))) return;
        const f = /^(usage)$/.test(m[2]) ? 'bruk' : /temp/.test(m[2]) ? 'temp' : /smart/.test(m[2]) ? 'smart' : /spin|standby/.test(m[2]) ? (d === 'switch' ? 'spinSw' : 'spin') : /status|state/.test(m[2]) ? 'status' : m[2] === 'used' ? 'brukt' : 'total';
        const x = (disker[m[1]] = disker[m[1]] || { navn: m[1] });
        if (!x[f]) x[f] = e.entity_id;
      });
      const upsPw = liste.find((e) => dom(e.entity_id) === 'sensor' && hass.states[e.entity_id].attributes.device_class === 'power');
      R.unraid = {
        navn: serverNavn, glances,
        cpu: finn(liste, /cpu_(usage|utili[sz]ation|use_percent|used)$/, 'sensor') || finn(liste, /cpu_load$/, 'sensor'),
        ram: finn(liste, /(ram|memory)_(usage|utili[sz]ation|used_percent|use_percent|percent)$/, 'sensor'),
        temp: finn(liste, /(cpu|package|core|k10temp|coretemp|tctl).*temp(erature)?$/, 'sensor'),
        oppetid: finn(liste, /uptime$/, 'sensor'),
        last: finn(liste, /(load(_avg(erage)?)?(_1m?)?|processor_load|cpu_load)$/, 'sensor'),
        strom: upsPw && upsPw.entity_id, ups: finn(liste, /ups_(load|load_percent|battery|charge)$/, 'sensor'),
        nett: finn(liste, /(network|net|eth\d+|bond\d+|br\d+)_(rx|in|inbound|download|received)$/, 'sensor'),
        versjon: finn(liste, /(unraid_|os_)?version$/, 'sensor') || finn(liste, /./, 'update'), kernel: finn(liste, /kernel/, 'sensor'),
        oppd: finn(liste, /updates?(_available|_count)?$/, 'sensor') || finn(liste, /(update|plugin)/, 'binary_sensor'),
        flash: finn(liste, /flash/, 'sensor') || finn(liste, /flash/, 'binary_sensor'),
        arrayBruk: finn(liste, /array_(usage|utili[sz]ation)$/, 'sensor'),
        arrayBrukt: finn(liste, /array_used$/, 'sensor'), arrayTot: finn(liste, /array_(total|size)$/, 'sensor'),
        arrayStatus: finn(liste, /array_(state|status)$/, 'sensor') || finn(liste, /array_(started|state)$/, 'binary_sensor'),
        arraySw: finn(liste, /array$/, 'switch'),
        arrayStart: finn(liste, /array_start$/, 'button'), arrayStopp: finn(liste, /array_stop$/, 'button'),
        dockerImg: finn(liste, /docker_(img|image|vdisk)_(usage|utili[sz]ation)$/, 'sensor'),
        paritet: finn(liste, /parity_check(_start)?$/, 'button'), paritetStopp: finn(liste, /parity_check_(stop|cancel)$/, 'button'),
        paritetFrem: finn(liste, /parity_(check_)?(progress|percent)$/, 'sensor'),
        spinNed: finn(liste, /spin_down(_all)?$/, 'button'), mover: finn(liste, /mover(_start)?$/, 'button'),
        omstart: liste.filter((e) => dom(e.entity_id) === 'button' && /(reboot|restart)$/.test(obj(e.entity_id)) && !/(docker|vm_)/.test(obj(e.entity_id))).map((e) => e.entity_id)[0],
        avslag: liste.filter((e) => dom(e.entity_id) === 'button' && /shutdown$/.test(obj(e.entity_id)) && !/(docker|vm_)/.test(obj(e.entity_id))).map((e) => e.entity_id)[0],
        disker: Object.values(disker).sort((a, b) => (/parity/.test(a.navn) ? 0 : /disk/.test(a.navn) ? 1 : 2) - (/parity/.test(b.navn) ? 0 : /disk/.test(b.navn) ? 1 : 2) || a.navn.localeCompare(b.navn, 'nb', { numeric: true })),
        gjester: brytere.map((e) => {
          const o = obj(e.entity_id);
          const vm = /(^|_)vm(_|$)/.test(o) || /vm/.test(e.translation_key || '');
          const n = kortNavn(e.entity_id);
          const rel = liste.filter((x) => x !== e && obj(x.entity_id).startsWith(o + '_'));
          const f = (re, d) => { const x = rel.find((y) => dom(y.entity_id) === d && re.test(obj(y.entity_id).slice(o.length))); return x && x.entity_id; };
          return { id: 'ur-' + e.entity_id, kilde: 'unraid', type: vm ? 'vm' : 'docker', navn: nm[n] || n.replace(/^./, (c) => c.toUpperCase()), bryter: e.entity_id,
            restart: f(/restart/, 'button'), oppdater: f(/update/, 'button'), oppdatering: f(/update/, 'binary_sensor') || f(/./, 'update'),
            cpu: f(/cpu/, 'sensor'), mem: f(/(mem|memory|ram)/, 'sensor'), bilde: (hass.states[e.entity_id].attributes || {}).image || null };
        }).sort((a, b) => a.navn.localeCompare(b.navn, 'nb')),
      };
    }
    // Effekt: effektsensorer (W/kW) på de funne enhetene, uten per-port-PoE
    INTEG.forEach((i) => ents[i.key].forEach((id) => {
      const s = hass.states[id];
      if (dom(id) === 'sensor' && s && s.attributes.device_class === 'power' && !/port_\d+/.test(obj(id))) R.power.push(id);
    }));
    MEMO = { E, D, ce, sig, S: hass.states, R };
    return R;
  }

  /* ------------------------------------------------------------ tall og tekst */
  const nf = (v, d = 0) => (v == null || isNaN(v) ? '–' : M.nf(v, d));
  const pctOf = (hass, id, brukt, tot) => {
    const v = tall(id && hass.states[id]);
    if (!isNaN(v)) return v;
    const b = tall(brukt && hass.states[brukt]), t = tall(tot && hass.states[tot]);
    return !isNaN(b) && !isNaN(t) && t > 0 ? (b / t) * 100 : null;
  };
  const numOf = (hass, id) => { const v = tall(id && hass.states[id]); return isNaN(v) ? null : v; };
  const unitOf = (hass, id) => { const s = id && hass.states[id]; return (s && s.attributes.unit_of_measurement) || ''; };
  const uShort = (u) => String(u || '').replace(/^Mbit\/s$/i, 'Mbps').replace(/^kbit\/s$/i, 'kbps').replace(/^Gbit\/s$/i, 'Gbps');
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
  const diskNavn = (k) => String(k).replace(/^disk(\d+)$/, 'Disk $1').replace(/^parity(\d*)$/, (a, n) => 'Paritet' + (n ? ' ' + n : '')).replace(/^cache(.*)$/, (a, n) => 'Cache' + (n ? ' ' + n : ''));
  const TYPE = { ruter: ['Gateway', 'mdi:router-network'], switch: ['Switch', 'mdi:switch'], ap: ['Aksesspunkt', 'mdi:access-point'], enhet: ['Enhet', 'mdi:devices'] };
  const gateway = (R) => R.unifi.enheter.find((e) => e.type === 'ruter') || null;
  const apOffline = (hass, e) => {
    const t = e.tracker && hass.states[e.tracker], st = e.tilstand && hass.states[e.tilstand];
    if (st && ok(st)) return /disconnect|offline|frakoblet/i.test(st.state);
    if (t) return !ok(t) || t.state === 'not_home';
    const c = e.cpu && hass.states[e.cpu];
    return !!c && !ok(c);
  };
  const apStarter = (hass, e) => { const st = e.tilstand && hass.states[e.tilstand]; return !!st && /(pending|adopt|provision|upgrad|start|restart|getting)/i.test(st.state); };
  function klientTall(hass, R, c) {
    const o = ov(c, 'unifi_clients');
    if (o) return numOf(hass, o);
    if (R.unifi.klienter.length) return R.unifi.klienter.filter((k) => k.tracker && hass.states[k.tracker] && hass.states[k.tracker].state === 'home').length;
    const v = R.unifi.enheter.filter((e) => e.type !== 'ruter').map((e) => numOf(hass, e.klienter)).filter((x) => x != null);
    return v.length ? v.reduce((a, b) => a + b, 0) : null;
  }
  const arrayStoppet = (hass, U) => {
    if (!U || U.glances) return false;
    const s = U.arrayStatus && hass.states[U.arrayStatus];
    if (s && ok(s)) return dom(U.arrayStatus) === 'binary_sensor' ? s.state === 'off' : /stop/i.test(s.state);
    const w = U.arraySw && hass.states[U.arraySw];
    return !!w && w.state === 'off';
  };
  const limitsOf = (c) => ({ ...LIM, ...(c.limits || {}) });
  const tempCol = (t, lim) => (t == null ? '#696969' : t >= lim ? C.red : t >= lim - 6 ? C.orange : C.green);

  /* ------------------------------------------------------------ config: faner, underfaner og seksjoner */
  function tabsCfg(c) {
    const T = c.tabs && !Array.isArray(c.tabs) ? c.tabs : {};
    const mapK = (k) => (k === 'unifi' ? 'net' : k);
    const keys = TABS.map((t) => t[0]);
    const o = (T.order || (Array.isArray(c.tabs) ? c.tabs : [])).map(mapK).filter((k, i, a) => keys.includes(k) && a.indexOf(k) === i);
    keys.forEach((k) => { if (!o.includes(k)) o.push(k); });
    const hidden = (T.hidden || c.tabs_hidden || []).map(mapK);
    const oldSt = { name: 'text', icon: 'icon', icon_name: 'text' }[c.tab_style];
    return { order: o, hidden, style: T.style || oldSt || 'text', start: mapK(T.start || c.start_tab || '') };
  }
  function visTabs(c) {
    const T = tabsCfg(c), V = T.order.filter((k) => !T.hidden.includes(k));
    return V.length ? V : [T.order[0]];
  }
  const subCfg = (c) => ({ show: !(c.subtabs && c.subtabs.show === false), style: (c.subtabs && c.subtabs.style) || 'segment' });
  // Seksjoner for en fane i rekkefølge: [{ id, key, label, icon, sub, title, hidden }]
  function secList(c, tab) {
    const S = c.sections || {}, ord = (S.order || []).filter((id) => SEC[id] && SEC[id].tab === tab);
    SECDEF[tab].forEach(([k]) => { const id = tab + '.' + k; if (!ord.includes(id)) ord.push(id); });
    const hid = S.hidden || [], map = S.map || {};
    return ord.map((id) => ({ ...SEC[id], sub: SUBS[tab].some((s) => s[0] === map[id]) ? map[id] : SEC[id].sub, hidden: hid.includes(id) }));
  }
  const visSubs = (c, tab) => { const L = secList(c, tab).filter((s) => !s.hidden); return SUBS[tab].filter(([k]) => L.some((s) => s.sub === k)); };

  /* ------------------------------------------------------------ fanelinjen (kortet + forhåndsvisningen i Tilpass) */
  function tabBtn(c, k, on, attrs) {
    const [, label, icon] = TABL[k], st = tabsCfg(c).style;
    const showIcon = st !== 'text', showLabel = st === 'text' || (st === 'active' && on);
    return `<button class="tb${on ? ' on' : ''}${!showLabel && st === 'active' ? ' io' : ''}" role="tab" aria-selected="${on}" aria-label="${esc(label)}" title="${esc(label)}" ${attrs || ''}>${showIcon ? M.icon(icon, 20) : ''}${showLabel ? `<span>${esc(label)}</span>` : ''}</button>`;
  }
  const subRow = (c, tab, cur, attrs) => {
    const st = subCfg(c).style;
    return `<div class="subs ${st === 'pills' ? 'pills' : 'segm'}" role="tablist">${visSubs(c, tab).map(([k, l]) => `<button class="sb${k === cur ? ' on' : ''}" role="tab" aria-selected="${k === cur}" ${attrs ? attrs(k) : ''}>${esc(l)}</button>`).join('')}</div>`;
  };
  const TAB_CSS = (pre) => `${pre} .trow{display:flex;align-items:center;gap:8px;min-width:0}
    ${pre} .tabs{flex:1;min-width:0;display:flex;gap:2px;padding:4px;border-radius:24px;background:var(--gray200,#3a3a3a);position:relative;touch-action:pan-y;overflow:hidden}
    ${pre} .tb{flex:1 1 0;min-width:0;height:40px;padding:0 8px;border-radius:20px;display:inline-flex;align-items:center;justify-content:center;gap:6px;font-size:14px;font-weight:500;color:var(--gray800,#afafaf);white-space:nowrap;overflow:hidden;transition:background .2s,color .2s}
    ${pre} .tb.io{flex:0 0 auto;min-width:48px}
    ${pre} .tb span{overflow:hidden;text-overflow:ellipsis}
    ${pre} .tb.on{flex:1 1 0;background:${C.accent};color:${INK}}
    ${pre} .gear{width:48px;height:48px;border-radius:24px;flex:none;display:grid;place-items:center;background:var(--gray200,#3a3a3a);box-shadow:${C.edge};color:var(--white,#fafafa)}
    ${pre} .gear:active{transform:scale(.92)}
    ${pre} .subs{display:flex;gap:2px;min-width:0}
    ${pre} .subs.segm{padding:3px;border-radius:22px;background:var(--gray200,#3a3a3a)}
    ${pre} .subs.pills{gap:6px;overflow-x:auto;scrollbar-width:none}
    ${pre} .sb{flex:1 1 0;min-width:0;height:38px;padding:0 10px;border-radius:19px;font-size:13px;font-weight:500;color:var(--gray800,#afafaf);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:background .2s,color .2s}
    ${pre} .subs.pills .sb{flex:0 0 auto;background:var(--gray200,#3a3a3a);padding:0 16px}
    ${pre} .sb.on,${pre} .subs.pills .sb.on{background:var(--white,#fafafa);color:#141414}`;

  /* ------------------------------------------------------------ integrasjonsvelger (26.6, portalt ark – fallgruve 1) */
  function openPick(hass, cfg, k, onApply) {
    const I = INT[k], L = entriesFor(hass, k), au = autoEntry(hass, k);
    const cur0 = (cfg.integrations || {})[k];
    let cur = cur0 === 'none' ? 'none' : cur0 || (au ? au.entry_id : 'none');
    const api = M.overlay({ maxWidth: 520, guard: 300, css: `
      .ph{display:flex;align-items:center;gap:12px;padding:4px 0 6px}.ph h2{flex:1;margin:0;font-size:22px;font-weight:600;color:#fafafa}
      .done{${M.DONE_PILL || `height:40px;padding:0 18px;border-radius:20px;background:${C.accent};color:#2f2f2f;font-size:14px;font-weight:600`}}
      .sub{margin:0 0 12px;font-size:13px;color:#979797}
      .lst{display:flex;flex-direction:column;gap:8px}
      .rr{display:flex;align-items:center;gap:12px;width:100%;min-height:60px;padding:8px 14px;border-radius:22px;background:#3a3a3a;text-align:left;color:#fafafa}
      .rr b{font-size:14px;font-weight:500}.rr .col>span{font-size:12px;color:#979797}
      .rd{width:22px;height:22px;border-radius:11px;flex:none;box-shadow:inset 0 0 0 2px #7f7f7f;display:grid;place-items:center}
      .rr.on .rd{box-shadow:inset 0 0 0 2px ${C.pink}}.rr.on .rd::after{content:'';width:12px;height:12px;border-radius:6px;background:${C.pink}}
      .auto{height:22px;padding:0 9px;border-radius:11px;background:${M.alpha(C.green, 0.18)};color:${C.green};font-size:11px;font-weight:600;display:inline-flex;align-items:center;flex:none}
      .none{padding:14px;border-radius:22px;background:#3a3a3a;color:#979797;font-size:13px}
      .add{margin-top:12px;height:48px;width:100%;border-radius:24px;background:#404040;color:#fafafa;font-size:14px;font-weight:500;display:flex;align-items:center;justify-content:center;gap:8px}`, html: '' });
    const draw = () => {
      api.body.innerHTML = `<div class="ph"><h2>Velg integrasjon</h2><button class="done" data-p="apply">Bruk</button></div>
        <p class="sub">${esc(I.name)}${k === 'unraid' ? ' · Glances kan brukes som reserve (bare målinger)' : ''}</p>
        <div class="lst" role="radiogroup">${L.length ? L.map((x) => `<button class="rr${cur === x.entry_id ? ' on' : ''}" role="radio" aria-checked="${cur === x.entry_id}" data-p="sel" data-v="${esc(x.entry_id)}"><span class="rd"></span><span class="grow col"><b class="ell">${esc(x.title)}</b><span class="ell">${esc(x.domain === 'glances' ? 'Glances' : I.name)} · ${x.count} entiteter</span></span>${au && au.entry_id === x.entry_id ? '<span class="auto">Auto</span>' : ''}</button>`).join('') : `<div class="none">Fant ingen ${esc(I.name)}-integrasjon i Home Assistant.</div>`}
        <button class="rr${cur === 'none' ? ' on' : ''}" role="radio" aria-checked="${cur === 'none'}" data-p="sel" data-v="none"><span class="rd"></span><span class="grow col"><b>Ingen</b><span>Skjul seksjonene for ${esc(I.name)}</span></span></button></div>
        <button class="add" data-p="add">${M.icon('mdi:plus', 20)}Legg til integrasjon i Home Assistant</button>`;
    };
    api.body.addEventListener('click', (ev) => {
      const b = ev.target.closest && ev.target.closest('[data-p]');
      if (!b) return;
      const p = b.dataset.p;
      if (p === 'sel') { M.haptic('selection'); cur = b.dataset.v; draw(); return; }
      if (p === 'add') { M.haptic('light'); api.close(); M.navigate('/config/integrations/dashboard/add?domain=' + I.domain); return; }
      if (p === 'apply') { M.haptic('success'); api.close(); onApply(cur !== 'none' && au && cur === au.entry_id ? undefined : cur); }
    });
    draw();
    return api;
  }
  M.serverPick = openPick;

  /* ------------------------------------------------------------ «Tilpass Server»: dra for rekkefølge (fallgruve 2) */
  function installEd(ed) {
    if (!ed || ed.__svInst || !ed.shadowRoot) return;
    ed.__svInst = true;
    window.addEventListener('msh-server-entries', () => { if (ed.isConnected && ed._render) ed._render(); });
    const Rt = ed.shadowRoot;
    let d = null;
    const hit = (e) => e.target && e.target.closest && e.target.closest('[data-svdrag]');
    Rt.addEventListener('touchstart', (e) => { if (hit(e)) e.stopPropagation(); }, { passive: true });
    Rt.addEventListener('touchmove', (e) => { if (d || hit(e)) { e.stopPropagation(); if (d && e.cancelable) e.preventDefault(); } }, { passive: false });
    const movable = (list) => [...list.children].filter((x) => x.dataset && (x.dataset.svk || x.dataset.svsub));
    Rt.addEventListener('pointerdown', (e) => {
      const hd = hit(e);
      if (!hd || e.button) return;
      const item = hd.closest('[data-svk]');
      if (!item) return;
      e.stopPropagation(); e.preventDefault();
      try { hd.setPointerCapture(e.pointerId); } catch (x) { /* */ }
      d = { item, list: item.parentElement, id: e.pointerId, y0: e.clientY, ty: 0, start: movable(item.parentElement).map((x) => x.dataset.svk || '#' + x.dataset.svsub).join() };
      window.__tabReorder = true;
      Object.assign(item.style, { position: 'relative', zIndex: '3', background: '#404040', boxShadow: '0 10px 24px rgba(0,0,0,.45)', transition: 'none' });
      M.haptic('medium');
    });
    Rt.addEventListener('pointermove', (e) => {
      if (!d || e.pointerId !== d.id) return;
      e.stopPropagation(); e.preventDefault();
      const rows = movable(d.list), i = rows.indexOf(d.item);
      const r = d.item.getBoundingClientRect(), center = r.top - d.ty + r.height / 2 + (e.clientY - d.y0);
      const mid = (el) => { const b = el.getBoundingClientRect(); return b.top + b.height / 2; };
      let swap = null;
      if (rows[i + 1] && center > mid(rows[i + 1])) { swap = rows[i + 1]; d.list.insertBefore(swap, d.item); }
      // aldri over første underfane-overskrift
      else if (rows[i - 1] && center < mid(rows[i - 1]) && !(i - 1 === 0 && rows[0].dataset.svsub)) { swap = rows[i - 1]; d.list.insertBefore(d.item, swap); }
      if (swap) { const r2 = d.item.getBoundingClientRect(); d.y0 += (r2.top - r.top); M.haptic('selection'); }
      d.ty = e.clientY - d.y0;
      d.item.style.transform = `translateY(${d.ty}px)`;
    });
    const end = (e) => {
      if (!d || (e && e.pointerId !== d.id)) return;
      const Dd = d; d = null;
      window.__tabReorder = false;
      Object.assign(Dd.item.style, { transform: '', position: '', zIndex: '', background: '', boxShadow: '', transition: '' });
      const rows = movable(Dd.list);
      M.haptic('light');
      if (rows.map((x) => x.dataset.svk || '#' + x.dataset.svsub).join() === Dd.start) { ed._render(); return; }
      const cc = ed._config || {};
      if (Dd.list.dataset.svlist === 'tabs') { ed._set('tabs', { ...(cc.tabs && !Array.isArray(cc.tabs) ? cc.tabs : {}), order: rows.map((x) => x.dataset.svk) }); return; }
      // seksjoner: rekkefølge + underfane (overskriften over raden) → sections.order / sections.map
      const tab = Dd.list.dataset.svtab, S = cc.sections || {}, map = { ...(S.map || {}) }, ord = [];
      let cur = null;
      rows.forEach((x) => { if (x.dataset.svsub) cur = x.dataset.svsub; else { ord.push(x.dataset.svk); if (cur === SEC[x.dataset.svk].sub) delete map[x.dataset.svk]; else map[x.dataset.svk] = cur; } });
      const other = TABS.map((t) => t[0]).filter((t) => t !== tab).flatMap((t) => secList(cc, t).map((s) => s.id));
      const all = [...TABS.map((t) => t[0])].flatMap((t) => (t === tab ? ord : other.filter((id) => SEC[id].tab === t)));
      ed._set('sections', { ...S, order: all, map: Object.keys(map).length ? map : undefined });
    };
    Rt.addEventListener('pointerup', end);
    Rt.addEventListener('pointercancel', end);
  }
  const hdl = () => `<span data-svdrag="1" title="Dra for rekkefølge" style="touch-action:none;cursor:grab;display:inline-flex;color:#979797;padding:8px 6px">${M.icon('mdi:drag', 22)}</span>`;
  const eye = (key, op, v, hid, label) => `<button data-a="fn" data-k="${key}" data-op="${op}" data-v="${esc(v)}" aria-label="${hid ? 'Vis' : 'Skjul'} ${esc(label)}" aria-pressed="${!hid}" style="width:40px;height:40px;border-radius:20px;display:grid;place-items:center;flex:none">${M.icon(hid ? 'mdi:eye-off-outline' : 'mdi:eye-outline', 20, `color:${hid ? '#696969' : '#fafafa'}`)}</button>`;
  const intStatus = (hh, cc, k) => {
    if (!hh) return ['–', '#979797'];
    const R = oppdag(hh, cc), s = (cc.integrations || {})[k], n = R.ents[k].length;
    if (s === 'none') return ['Slått av (Ingen) · trykk for å velge', '#979797'];
    if (s) return [`Valgt manuelt · ${n} entiteter`, '#fafafa'];
    if (R.found[k]) return [`Funnet automatisk · ${n} entiteter${k === 'unraid' && R.unraid && R.unraid.glances ? ' (Glances)' : ''}`, C.green];
    return [R.loading ? 'Leter …' : 'Ikke funnet · trykk for å velge', C.orange];
  };
  const autoOf = (h, c, fnc) => { if (!h) return null; try { return fnc(oppdag(h, c || {})) || null; } catch (e) { return null; } };

  function editorSchema(h, c) {
    c = c || {};
    // Faner: live forhåndsvisning (faktiske faner, rosa boble, tannhjul) + dra-liste med øye
    const preview = { type: 'html', html: (hh, cc) => {
      const V = visTabs(cc), T = tabsCfg(cc), act = V.includes(T.start) ? T.start : V[0];
      return `<style>${TAB_CSS('.svp')}.svp{padding:14px 12px;border-radius:24px;background:#282828;display:flex;flex-direction:column;gap:10px}.svp .tl{font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#7f7f7f;margin:0 4px}.svp button{pointer-events:none}</style>
        <div class="svp" data-key="svp" aria-hidden="true"><div class="tl">Forhåndsvisning</div><div class="trow"><div class="tabs">${V.map((k) => tabBtn(cc, k, k === act)).join('')}</div><span class="gear">${M.icon('mdi:cog', 22)}</span></div></div>`;
    } };
    const order = { type: 'html', html: (hh, cc, key, ed) => {
      installEd(ed);
      const T = tabsCfg(cc);
      return `<div class="f" style="gap:8px;padding:0;background:none;box-shadow:none"><div data-svlist="tabs" style="display:flex;flex-direction:column;gap:8px">${T.order.map((k) => {
        const [, label, icon] = TABL[k], hid = T.hidden.includes(k), n = hh ? oppdag(hh, cc).ents[TAB_INT[k]].length : 0;
        return `<div data-svk="${k}" data-key="svt-${k}" style="height:56px;border-radius:28px;background:#3a3a3a;display:flex;align-items:center;gap:8px;padding:0 6px 0 4px;${hid ? 'opacity:.5' : ''}">${hdl()}
          <span style="width:36px;height:36px;border-radius:18px;display:grid;place-items:center;background:#404040;flex:none">${M.icon(icon, 20)}</span>
          <span style="flex:1;min-width:0;display:flex;flex-direction:column"><span style="font-size:14px;font-weight:500">${esc(label)}</span><span style="font-size:11px;color:#979797">${hh ? (n ? `${n} entiteter` : 'Ikke koblet') : ''}</span></span>${eye(key, 'tab', k, hid, label)}</div>`;
      }).join('')}</div><span class="help">Dra i håndtaket for rekkefølge, øyet skjuler. Minst én fane må være synlig.</span></div>`;
    }, click: (dd, ed) => {
      const cc = ed._config || {}, T = tabsCfg(cc), hid = new Set(T.hidden);
      if (!hid.has(dd.v) && T.order.filter((k) => !hid.has(k)).length <= 1) { M.haptic('warning'); M.toast('Minst én fane må være synlig'); return; }
      if (hid.has(dd.v)) hid.delete(dd.v); else hid.add(dd.v);
      M.haptic('selection');
      ed._set('tabs', { ...(cc.tabs && !Array.isArray(cc.tabs) ? cc.tabs : {}), order: T.order, hidden: hid.size ? [...hid] : undefined });
    } };
    const subPreview = { type: 'html', html: (hh, cc) => {
      const V = visTabs(cc), T = tabsCfg(cc), t = V.includes(T.start) ? T.start : V[0], S = visSubs(cc, t), on = subCfg(cc).show && S.length > 1;
      return `<style>${TAB_CSS('.svs')}.svs{padding:14px 12px;border-radius:24px;background:#282828;display:flex;flex-direction:column;gap:10px}.svs .tl{font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#7f7f7f;margin:0 4px}.svs button{pointer-events:none}</style>
        <div class="svs" data-key="svs" aria-hidden="true"><div class="tl">Underfaner · ${esc(TABL[t][1])}</div>${on ? subRow(cc, t, S[0][0]) : `<div style="font-size:12px;color:#979797;margin:0 4px">${S.length > 1 ? 'Underfaneraden er skjult – alle seksjonene vises under hverandre' : 'Bare én underfane – raden skjules'}</div>`}</div>`;
    } };
    // Seksjoner for valgt fane: underfane-overskrifter + dra-rader (flytt mellom underfaner ved å dra forbi en overskrift)
    const secs = { type: 'html', html: (hh, cc, key, ed) => {
      installEd(ed);
      const V = TABS.map((t) => t[0]), t = V.includes(ed.__svTab) ? ed.__svTab : visTabs(cc)[0];
      const L = secList(cc, t);
      const seg = `<div class="chips sg" role="tablist" style="margin-bottom:10px">${TABS.map(([k, l]) => `<button class="chip ${k === t ? 'on' : ''}" role="tab" aria-selected="${k === t}" data-a="fn" data-k="${key}" data-op="stab" data-v="${k}">${esc(l)}</button>`).join('')}</div>`;
      const rows = SUBS[t].map(([sk, sl]) => `<div data-svsub="${sk}" data-key="svh-${t}-${sk}" style="padding:10px 8px 2px;font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:#979797">${esc(sl)}</div>${L.filter((s) => s.sub === sk).map((s) => `<div data-svk="${s.id}" data-key="svr-${s.id}" style="height:56px;border-radius:28px;background:#3a3a3a;display:flex;align-items:center;gap:8px;padding:0 6px 0 4px;${s.hidden ? 'opacity:.5' : ''}">${hdl()}
          <span style="width:36px;height:36px;border-radius:18px;display:grid;place-items:center;background:#404040;flex:none">${M.icon(s.icon, 20)}</span>
          <span style="flex:1;min-width:0;font-size:14px;font-weight:500">${esc(s.label)}</span>${eye(key, 'sec', s.id, s.hidden, s.label)}</div>`).join('')}`).join('');
      return `<div class="f" style="gap:6px;padding:0;background:none;box-shadow:none">${seg}<div data-svlist="secs" data-svtab="${t}" style="display:flex;flex-direction:column;gap:8px">${rows}</div><span class="help">Dra for rekkefølge – dra forbi en overskrift for å flytte seksjonen til en annen underfane. En underfane uten synlige seksjoner skjules.</span></div>`;
    }, click: (dd, ed) => {
      const cc = ed._config || {};
      if (dd.op === 'stab') { M.haptic('selection'); ed.__svTab = dd.v; ed._render(); return; }
      const S = cc.sections || {}, hid = new Set(S.hidden || []);
      if (hid.has(dd.v)) hid.delete(dd.v); else hid.add(dd.v);
      M.haptic('selection');
      ed._set('sections', { ...S, hidden: hid.size ? [...hid] : undefined });
    } };
    const ints = { type: 'html', html: (hh, cc, key) => `<div class="f" style="gap:8px;padding:0;background:none;box-shadow:none">${INTEG.map((I) => {
      const [txt, col] = intStatus(hh, cc, I.key);
      return `<button data-a="fn" data-k="${key}" data-op="int" data-v="${I.key}" data-key="svi-${I.key}" style="min-height:60px;border-radius:28px;background:#3a3a3a;display:flex;align-items:center;gap:12px;padding:8px 14px 8px 10px;text-align:left;width:100%">
        <span style="width:40px;height:40px;border-radius:20px;display:grid;place-items:center;flex:none;background:#404040;color:${I.color}">${M.icon(I.icon, 20)}</span>
        <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px"><span style="font-size:14px;font-weight:500">${esc(I.name)}</span><span style="font-size:12px;color:${col}">${esc(txt)}</span></span>${M.icon('mdi:chevron-right', 20, 'color:#7f7f7f')}</button>`;
    }).join('')}<span class="help">Trykk for å velge en annen config entry, eller «Ingen» for å skjule seksjonene.</span></div>`,
    click: (dd, ed) => { M.haptic('light'); openPick(ed._hass, ed._config || {}, dd.v, (v) => ed._set('integrations.' + dd.v, v)); } };
    const ent = (name, label, fnc, extra) => ({ type: 'entity', name: 'overrides.' + name, label, domains: ['sensor'], auto: (hh, cc) => autoOf(hh, cc, fnc), none_label: '– · Velg entitet', ...(extra || {}) });
    const reset = { type: 'button', label: 'Tilbakestill til standard', icon: 'mdi:restore', run: (hh, cc, ed) => { M.haptic('warning'); const id = (cc && cc.card_id) || M.uid(); ed._config = { type: cc.type || 'custom:msh-server-card', card_id: id }; ed._set('card_id', id); } };
    return [
      { type: 'tabs', id: 'server', tabs: [
        { key: 'faner', label: 'Faner', icon: 'mdi:tab', focus: ['tabs', 'faner'], fields: [
          { type: 'section', id: 'faner', label: 'Faner', icon: 'mdi:tab', fields: [
            preview,
            { type: 'select', name: 'tabs.style', label: 'Stil', options: [['text', 'Tekst'], ['active', 'Aktiv'], ['icon', 'Ikon']], default: 'text', help: 'Aktiv = ikon + navn på aktiv fane, ikon på de andre.' },
            { type: 'select', name: 'tabs.start', label: 'Startfane', options: [['', 'Sist brukt'], ...TABS.map((t) => [t[0], t[1]])], default: '' },
            order,
          ] },
          { type: 'section', id: 'underfaner', label: 'Underfaner', icon: 'mdi:tab-minus', fields: [
            subPreview,
            { type: 'boolean', name: 'subtabs.show', label: 'Vis underfaneraden', default: true },
            { type: 'select', name: 'subtabs.style', label: 'Stil', options: [['segment', 'Segment'], ['pills', 'Piller']], default: 'segment' },
          ] },
        ] },
        { key: 'seksjoner', label: 'Seksjoner', icon: 'mdi:view-agenda', focus: ['sections', 'seksjoner'], fields: [
          { type: 'section', id: 'seksjoner', label: 'Seksjoner', icon: 'mdi:view-agenda', fields: [secs] },
        ] },
        { key: 'toppkort', label: 'Toppkort', icon: 'mdi:chart-line', focus: ['toppkort', 'varsler', 'limits'], fields: [
          { type: 'section', id: 'toppkort', label: 'Toppkort', icon: 'mdi:chart-line', fields: [
            ...TABS.map(([t, l]) => ({ type: 'select', name: 'hero_metric.' + t, label: `Standard måling · ${l}`, options: HM[t].map(([k, lb]) => [k, lb]), default: HM[t][0][0] })),
          ] },
          { type: 'section', id: 'varsler', label: 'Varsler', icon: 'mdi:bell-alert', fields: [
            { type: 'range', name: 'limits.disk_temp', label: 'Disktemperatur-grense', icon: 'mdi:thermometer', min: 30, max: 70, step: 2, default: LIM.disk_temp, unit: '°C', presets: [[40, '40'], [50, '50'], [60, '60']] },
            { type: 'range', name: 'limits.storage', label: 'Lagring full', icon: 'mdi:harddisk', min: 50, max: 100, step: 5, default: LIM.storage, unit: '%', presets: [[75, '75'], [85, '85'], [95, '95']] },
            { type: 'info', label: 'Grensene styrer fargene på disker (LED/temperatur) og stolper (oransje over grensen).' },
          ] },
        ] },
        { key: 'integrasjoner', label: 'Integrasjoner', icon: 'mdi:puzzle', focus: ['integrasjoner', 'integrations'], fields: [
          { type: 'section', id: 'integrasjoner', label: 'Integrasjoner', icon: 'mdi:puzzle', fields: [ints] },
        ] },
        { key: 'avansert', label: 'Avansert', icon: 'mdi:tune', focus: ['entities', 'overrides', 'spacing', 'advanced', 'avansert'], fields: [
          { type: 'section', id: 'entities', label: 'Entiteter i toppkortet', icon: 'mdi:format-list-bulleted', fields: [
            { type: 'info', label: 'Alt er funnet automatisk. Velg en annen entitet bare der det automatiske valget er feil.' },
            ent('net_down', 'Nettverk · Ned', (RR) => (gateway(RR) || {}).rx), ent('net_up', 'Nettverk · Opp', (RR) => (gateway(RR) || {}).tx), ent('net_lat', 'Nettverk · Latens', (RR) => ((gateway(RR) || {}).latens || [])[0]),
            ent('unifi_clients', 'Nettverk · Antall klienter', () => null),
            ent('proxmox_cpu', 'Proxmox · CPU', (RR) => (RR.proxmox.noder[0] || {}).cpu), ent('proxmox_mem', 'Proxmox · Minne', (RR) => (RR.proxmox.noder[0] || {}).mem), ent('proxmox_power', 'Proxmox · Strøm', (RR) => RR.proxmox.power, { device_class: 'power' }),
            ent('unraid_cpu', 'Unraid · CPU', (RR) => (RR.unraid || {}).cpu), ent('unraid_ram', 'Unraid · Minne', (RR) => (RR.unraid || {}).ram), ent('unraid_temp', 'Unraid · Temp', (RR) => (RR.unraid || {}).temp),
            { type: 'entities', name: 'exclude', label: 'Skjul entiteter (rader og fliser)', help: 'Søk opp enheter, gjester eller disker som ikke skal vises.' },
          ] },
          M.spacingSchema(),
          { type: 'section', id: 'avansert', label: 'Tilbakestill', icon: 'mdi:restore', fields: [reset] },
        ] },
      ] },
    ];
  }

  /* ============================================================ kortet */
  class Server extends M.Card {
    static get cardName() { return 'Server'; }
    static get defaults() { return { ...DEF }; }
    static getStubConfig() { return { card_id: M.uid() }; }
    static get schema() { return editorSchema; }
    static get uiPersist() { return ['tab', 'sub']; }
    get cardSize() { return 12; }
    constructor() {
      super();
      this._ce = () => { if (this.isConnected) this.update(); };
      this._hist = {}; this._pend = {}; this._q = {}; this._flt = {}; this._armed = null; this._blink = {};
    }
    connectedCallback() { super.connectedCallback(); window.addEventListener('msh-server-entries', this._ce); }
    disconnectedCallback() {
      super.disconnectedCallback(); window.removeEventListener('msh-server-entries', this._ce);
      if (this._pick) { this._pick.close(); this._pick = null; }
    }
    onOpen() {
      CE.t = 0; entries(this.hass); // friske config entries når popupen åpnes
      const st = tabsCfg(this.config).start;
      if (st && visTabs(this.config).includes(st) && this.ui.tab !== st) this.setUI({ tab: st, sel: null });
      this._loadHist();
    }
    onClose() { if (this._pick) { this._pick.close(); this._pick = null; } }
    get tabs() { return visTabs(this.config); }
    get tab() { const V = this.tabs, st = tabsCfg(this.config).start; return V.includes(this.ui.tab) ? this.ui.tab : V.includes(st) ? st : V[0]; }
    _sub(tab) {
      const S = visSubs(this.config, tab), u = (this.ui.sub || {})[tab];
      return S.some((s) => s[0] === u) ? u : S[0] ? S[0][0] : null;
    }

    /* ---------------------------------------------------------- toppkort: målinger + historikk (fallgruve 8) */
    _metrics(R, tab) {
      const h = this.hass, c = this.config;
      const mk = ([k, label, color], id, v, unit, dec) => ({ k, label, color, id: id || null, v: v == null || isNaN(v) ? null : v, unit, dec });
      if (tab === 'net') {
        const g = gateway(R) || {}, [d, u, l] = HM.net;
        const dn = ov(c, 'net_down') || g.rx, up = ov(c, 'net_up') || g.tx, lt = ov(c, 'net_lat') || (g.latens || [])[0];
        return [mk(d, dn, numOf(h, dn), uShort(unitOf(h, dn)) || 'Mbps'), mk(u, up, numOf(h, up), uShort(unitOf(h, up)) || 'Mbps'), mk(l, lt, numOf(h, lt), unitOf(h, lt) || 'ms', 0)];
      }
      if (tab === 'proxmox') {
        const n = R.proxmox.noder[0] || {}, [a, b, p] = HM.proxmox;
        const cp = ov(c, 'proxmox_cpu') || n.cpu, mm = ov(c, 'proxmox_mem') || n.mem, pw = ov(c, 'proxmox_power') || R.proxmox.power;
        return [mk(a, cp, pctOf(h, cp), '%', 0), mk(b, mm, pctOf(h, mm, n.ramBrukt, n.ramTot), '%', 0), mk(p, pw, numOf(h, pw), unitOf(h, pw) || 'W', 0)];
      }
      const U = R.unraid || {}, [a, b, t] = HM.unraid;
      const cp = ov(c, 'unraid_cpu') || U.cpu, mm = ov(c, 'unraid_ram') || U.ram, tp = ov(c, 'unraid_temp') || U.temp;
      return [mk(a, cp, pctOf(h, cp), '%', 0), mk(b, mm, pctOf(h, mm), '%', 0), mk(t, tp, numOf(h, tp), '°C', 0)];
    }
    async _loadHist() {
      if (!this.hass || !this.isOpen) return;
      const R = oppdag(this.hass, this.config), tab = this.tab, ids = this._metrics(R, tab).map((m) => m.id).filter(Boolean);
      const key = tab + '|' + ids.join();
      if (this._histKey === key && this._histAt && Date.now() - this._histAt < TTL) return;
      this._histKey = key; this._histAt = Date.now();
      if (!ids.length) return;
      const r = await M.history(this.hass, ids, 24).catch(() => ({}));
      if (this._histKey !== key) return;
      ids.forEach((id) => { this._hist[id] = M.sample(r[id] || [], 49, 24); });
      this.update();
    }

    onAction(name, el, ev) {
      const d = el.dataset, h = this.hass;
      switch (name) {
        case 'tab': if (d.v && this.tabs.includes(d.v) && d.v !== this.tab) { this.setUI({ tab: d.v, sel: null }); setTimeout(() => this._loadHist(), 0); } return;
        case 'sub': return this.setUI({ sub: { ...(this.ui.sub || {}), [this.tab]: d.v } });
        case 'hm': return this.setUI({ hm: { ...(this.ui.hm || {}), [this.tab]: d.v }, sel: null });
        case 'dx': return this.setUI({ dx: this.ui.dx === d.v ? null : d.v });
        case 'cx': return this.setUI({ cx: this.ui.cx === d.v ? null : d.v });
        case 'gx': return this.setUI({ gx: this.ui.gx === d.v ? null : d.v });
        case 'swsel': return this.setUI({ swSel: d.v, port: null });
        case 'port': return this.setUI({ port: this.ui.port === d.v ? null : d.v });
        case 'disk': return this.setUI({ disk: { ...(this.ui.disk || {}), [this.tab]: d.v } });
        case 'flt': this._flt[this.tab] = d.v; return this.update();
        case 'qclr': this._q[this.tab] = ''; return this.update();
        case 'pickint': return this._openPick(d.v);
        case 'addint': return M.navigate('/config/integrations/dashboard/add?domain=' + d.v);
        case 'press': return d.id && M.call(h, 'button', 'press', { entity_id: d.id });
        case 'arm': return this._arm(d.key, () => this._run(d));
        case 'run': return this._run(d);
        case 'tgl': return this._tgl(d);
        case 'locate': return this._locate(d);
        default: return super.onAction(name, el, ev);
      }
    }
    onInput(name, el) { if (name === 'q') { this._q[this.tab] = el.value; this.update(); } }
    // Farlige handlinger: første trykk = rød «Bekreft · trykk igjen», tilbakestilles etter 3 s
    _arm(key, run) {
      if (this._armed === key) { clearTimeout(this._armT); this._armed = null; M.haptic('heavy'); run(); this.update(); return; }
      this._armed = key; M.haptic('warning');
      clearTimeout(this._armT); this._armT = setTimeout(() => { this._armed = null; this.update(); }, 3000);
      this.update();
    }
    // Bryter med spinner mens den venter (state endres → spinneren forsvinner, maks 15 s)
    _tgl(d) {
      const h = this.hass;
      const mark = (id) => { const s = h.states[id]; this._pend[id] = { s: s && s.state, t: Date.now() }; this.update(); setTimeout(() => this.update(), 15100); };
      if (d.sw) { mark(d.sw); return M.toggle(h, d.sw); }
      if (d.sel) { // opptak via select.*_recording_mode
        const s = h.states[d.sel]; if (!s) return;
        const opts = s.attributes.options || [], never = opts.find((o) => /never|aldri/i.test(o)) || 'never';
        const on = s.state !== never;
        const back = (() => { try { return localStorage.getItem('ki:sv-rec:' + d.sel); } catch (e) { return null; } })();
        if (on) { try { localStorage.setItem('ki:sv-rec:' + d.sel, s.state); } catch (e) { /* */ } }
        mark(d.sel);
        return M.call(h, 'select', 'select_option', { entity_id: d.sel, option: on ? never : (back && opts.includes(back) ? back : opts.find((o) => /always|alltid/i.test(o)) || opts.find((o) => o !== never) || 'always') });
      }
      const g = this._R && this._R.proxmox.gjester.find((x) => x.id === d.g);
      if (!g) return;
      const on = kjorer(h.states[g.status]);
      const btn = on ? (g.knapper.find((k) => k.a === 'av') || g.knapper.find((k) => k.a === 'stopp')) : g.knapper.find((k) => k.a === 'start' || k.a === 'fortsett');
      if (btn) { mark(g.status); M.call(h, 'button', 'press', { entity_id: btn.id }); }
      else M.toast('Fant ingen start-/stoppknapp for ' + g.navn);
    }
    _pending(id) {
      const p = id && this._pend[id]; if (!p) return false;
      const s = this.hass.states[id];
      if (Date.now() - p.t > 15000 || (s && s.state !== p.s)) { delete this._pend[id]; return false; }
      return true;
    }
    // «Finn»: locate-knapp/-bryter, ellers LED-blink – flisen blinker mens den er aktiv
    _locate(d) {
      const h = this.hass, id = d.id; if (!id) return;
      const until = Date.now() + (dom(id) === 'light' ? 10000 : 30000);
      if (dom(id) === 'switch') M.toggle(h, id);
      else if (dom(id) === 'button') M.call(h, 'button', 'press', { entity_id: id });
      else M.call(h, 'light', 'turn_on', { entity_id: id, flash: 'long' }).then(() => M.toast('LED-en blinker')).catch(() => {});
      if (dom(id) !== 'switch') { this._blink[d.dev] = until; setTimeout(() => this.update(), until - Date.now() + 50); }
      this.update();
    }
    _openPick(k) {
      if (this._pick) this._pick.close();
      this._pick = openPick(this.hass, this._rawConfig || this.config, k, async (v) => {
        const old = this._rawConfig || this.config, integ = { ...(old.integrations || {}) };
        if (v === undefined) delete integ[k]; else integ[k] = v;
        const n = { ...old, integrations: Object.keys(integ).length ? integ : undefined };
        if (!n.integrations) delete n.integrations;
        this.setConfig(n);
        try { const r = await M.saveCardConfig(this.hass, old, n, { card: this }); if (r && r.config) this.setConfig(r.config); } catch (e) { console.warn('[ki-msh] Server', e); }
      });
      this._pick.onClosed = () => { this._pick = null; };
    }

    /* ---------------------------------------------------------- tegning */
    render() {
      const h = this.hass, c = this.config;
      const R = (this._R = oppdag(h, c));
      const V = this.tabs, tab = this.tab;
      INTEG.forEach((i) => R.ents[i.key].forEach((id) => this._deps.add(id)));
      Object.values(c.overrides || {}).forEach((id) => { if (id) this._deps.add(id); });
      const parts = [this._tabRow(V, tab), this._hero(R, tab), this._prose(R, tab), ...this._body(R, tab)];
      return `<div class="wrap">${parts.join('')}</div>`;
    }
    _tabRow(V, tab) {
      return `<div class="trow"><div class="tabs" role="tablist" data-glass-drag="x">${V.map((k) => tabBtn(this.config, k, k === tab, `data-act="tab" data-v="${k}" data-haptic="selection"`)).join('')}</div>
        <button class="gear press" data-act="customize" aria-label="Tilpass Server">${M.icon('mdi:cog', 22)}</button></div>`;
    }
    _hero(R, tab) {
      const h = this.hass, c = this.config, ui = this.ui, ik = TAB_INT[tab], found = R.found[ik];
      const Ms = this._metrics(R, tab);
      const want = (ui.hm || {})[tab] || (c.hero_metric || {})[tab];
      const main = Ms.find((m) => m.k === want) || Ms[0], rest = Ms.filter((m) => m !== main);
      // serie: historikk (49 punkter, 30 min) + live siste punkt; flat når data mangler
      const ser = (m) => { const s = (m.id && this._hist[m.id] && this._hist[m.id].length ? this._hist[m.id].slice() : (m.v != null ? Array(49).fill(m.v) : [])); if (s.length && m.v != null) s[48] = m.v; return s; };
      const S = ser(main), sel = ui.sel != null ? ui.sel : 48;
      let pts = '0,60 300,60';
      if (S.length) {
        let lo = Math.min(...S), hi = Math.max(...S); const pad = (hi - lo) * 0.15 || Math.max(1, Math.abs(hi) * 0.1);
        lo -= pad; hi += pad;
        pts = S.map((v, i) => `${((i / 48) * 300).toFixed(1)},${(92 - ((v - lo) / (hi - lo)) * 72).toFixed(1)}`).join(' ');
      }
      const at = (m) => { if (sel === 48) return m.v; const s = ser(m); return s.length ? s[sel] : null; };
      const fv = (m, v) => (v == null ? '–' : nf(v, m.dec != null ? m.dec : Math.abs(v) < 10 && v % 1 ? 1 : 0));
      const hrs = (48 - sel) / 2;
      const when = sel === 48 ? `${main.label} · nå` : `−${M.nf(hrs, hrs % 1 ? 1 : 0)} t`;
      // tittel, status-chip og tekst til høyre
      let title, chip, right = '';
      if (tab === 'net') {
        const g = gateway(R), off = g && apOffline(h, g);
        title = 'Internett';
        chip = !found ? ['none', 'Ikke koblet'] : !g ? ['none', '–'] : off ? ['red', 'Frakoblet'] : ['ok', g.oppetid && ok(h.states[g.oppetid]) ? `Online · ${oppetid(h, g.oppetid)}` : 'Online'];
        const k = found ? klientTall(h, R, c) : null; right = k != null ? `${nf(k)} klienter` : '';
      } else if (tab === 'proxmox') {
        const n = R.proxmox.noder[0];
        title = n ? `${n.navn} · node 1` : 'Proxmox';
        const st = n && n.status && h.states[n.status];
        chip = !found ? ['none', 'Ikke koblet'] : !n ? ['none', '–'] : st && !kjorer(st) ? ['red', 'Frakoblet'] : ['ok', n.oppetid && ok(h.states[n.oppetid]) ? `Online · ${oppetid(h, n.oppetid)}` : 'Online'];
        const G = R.proxmox.gjester; right = found && G.length ? `${G.filter((g) => kjorer(h.states[g.bryter || g.status])).length} kjører` : '';
      } else {
        const U = R.unraid;
        title = U ? `${U.navn} · ${U.glances ? 'Glances' : 'Unraid'}` : 'Unraid';
        chip = !found ? ['none', 'Ikke koblet'] : !U ? ['none', '–'] : arrayStoppet(h, U) ? ['warn', 'Array stoppet'] : ['ok', U.oppetid && ok(h.states[U.oppetid]) ? `Online · ${oppetid(h, U.oppetid)}` : 'Online'];
        if (U) {
          const b = numOf(h, U.arrayBrukt), u = unitOf(h, U.arrayBrukt);
          const tb = b == null ? null : /^t/i.test(u) ? b : /^g/i.test(u) ? b / 1000 : /^m/i.test(u) ? b / 1e6 : null;
          const p = pctOf(h, ov(c, 'unraid_array') || U.arrayBruk);
          right = tb != null ? `${nf(tb, 1)} TB brukt` : p != null ? `${nf(p)} % brukt` : '';
        }
      }
      const gc = main.color;
      return `<section class="hero" aria-label="Toppkort" data-key="hero-${tab}">
          <div class="graph"><svg viewBox="0 0 300 100" preserveAspectRatio="none" aria-hidden="true">
            <polyline points="0,100 ${pts} 300,100" style="fill:${M.alpha(gc, 0.2)};stroke:none"></polyline>
            <polyline points="${pts}" fill="none" style="stroke:${gc};stroke-width:2" stroke-linejoin="round" vector-effect="non-scaling-stroke"></polyline></svg>
            ${ui.sel != null ? `<div class="cursor" style="left:${(sel / 48) * 100}%;border-left:1px dashed ${M.alpha(gc, 0.7)}"></div>` : ''}<div class="scrub" aria-label="Scrub grafen"></div></div>
          <div class="htop"><span class="hn ell">${esc(title)}</span><span class="chip ${chip[0]}">${chip[0] === 'ok' ? M.icon('mdi:check-circle', 13) : chip[0] === 'none' ? '' : M.icon('mdi:alert', 13)}<span class="ell">${esc(chip[1])}</span></span><span class="grow"></span>${right ? `<span class="hr ell">${esc(right)}</span>` : ''}</div>
          <div class="vals"><div class="line"><span class="big num">${fv(main, at(main))}</span><span class="bu">${esc(main.unit || '')}</span>
            ${rest.map((m) => `<button class="sv" data-act="hm" data-v="${m.k}" data-haptic="selection" aria-label="Vis ${esc(m.label)}"><span class="svv num">${fv(m, at(m))}</span><span class="svu">${esc(m.unit || '')}</span><span class="svl">${esc(m.label)}</span></button>`).join('')}</div>
            <span class="when">${esc(when)}</span></div>
        </section>`;
    }
    _prose(R, tab) {
      const h = this.hass, c = this.config, ik = TAB_INT[tab], pill = (t, bad) => `<b class="pp${bad ? ' bad' : ''}">${esc(t)}</b>`;
      let txt;
      if (!R.found[ik]) txt = R.loading && R.mode[ik] !== 'none' ? `Leter etter ${pill(INT[ik].name)} …` : `Ingen ${pill(INT[ik].name)} er koblet til ennå.`;
      else if (tab === 'net') {
        const g = gateway(R), off = g && apOffline(h, g), k = klientTall(h, R, c);
        txt = `Internett er ${pill(!g ? '–' : off ? 'frakoblet' : 'online', off)} og ${pill(k == null ? '–' : `${nf(k)} ${k === 1 ? 'klient' : 'klienter'}`)} er tilkoblet.`;
      } else if (tab === 'proxmox') {
        const n = R.proxmox.noder[0] || {}, pw = ov(c, 'proxmox_power') || R.proxmox.power, W = numOf(h, pw);
        const G = R.proxmox.gjester, on = G.filter((g) => kjorer(h.states[g.bryter || g.status])).length;
        txt = `Oppetiden er ${pill(oppetid(h, n.oppetid))} og ` + (W != null ? `strømforbruket er ${pill(`${nf(W)} ${unitOf(h, pw) || 'W'}`)}.` : `${pill(`${on} av ${G.length}`)} gjester kjører.`);
      } else {
        const U = R.unraid || {}, stop = arrayStoppet(h, U), p = pctOf(h, ov(c, 'unraid_array') || U.arrayBruk), L = limitsOf(c);
        const st = U.glances ? null : U.arrayStatus || U.arraySw ? (stop ? 'stoppet' : 'startet') : '–';
        txt = st ? `Arrayet er ${pill(st, stop)} og lagringen er ${pill(p == null ? '–' : `${nf(p)} % full`, p != null && p >= L.storage)}.`
          : `CPU-en er ${pill(`${nf(pctOf(h, U.cpu))} %`)} og minnet er ${pill(`${nf(pctOf(h, U.ram))} % brukt`)}.`;
      }
      return `<p class="prose">${txt}</p>`;
    }
    _body(R, tab) {
      const c = this.config, ik = TAB_INT[tab], out = [];
      const netCams = tab === 'net' && R.found.protect;
      if (!R.found[ik]) {
        out.push(this._notFound(R, ik));
        // Nettverk uten UniFi Network, men med Protect: bare kameraene
        const cs = netCams && secList(c, tab).find((s) => s.key === 'cams' && !s.hidden);
        if (cs) out.push(`<div class="pane" data-key="pane-net-cams">${this._s_cams(R, tab, cs)}</div>`);
        return out;
      }
      const S = visSubs(c, tab);
      if (!S.length) return [...out, `<div class="empty">${M.icon('mdi:eye-off', 22)}<span>Alle seksjonene er skjult</span><button class="pick press" data-act="customize" data-section="seksjoner">${M.icon('mdi:cog', 18)}Tilpass</button></div>`];
      const sub = this._sub(tab), row = subCfg(c).show && S.length > 1;
      if (row) out.push(subRow(c, tab, sub, (k) => `data-act="sub" data-v="${k}" data-haptic="selection"`));
      const L = secList(c, tab).filter((s) => !s.hidden && (!row || s.sub === sub));
      const html = L.map((s) => { try { return this['_s_' + s.key](R, tab, s); } catch (e) { return this._failHTML(e); } }).filter(Boolean);
      out.push(`<div class="pane" data-key="pane-${tab}-${row ? sub : 'alle'}">${html.join('') || `<div class="empty">${M.icon('mdi:information-outline', 22)}<span>Ingenting å vise her</span></div>`}</div>`);
      return out;
    }
    _notFound(R, k) {
      const I = INT[k], off = R.mode[k] === 'none';
      if (R.loading && !off) return `<section class="sec nf" data-key="nf-${k}">${M.icon('mdi:timer-sand', 26)}<b>Leter etter ${esc(I.name)} …</b></section>`;
      return `<section class="sec nf" data-key="nf-${k}"><span class="nfi">${M.icon(off ? 'mdi:eye-off' : 'mdi:puzzle-remove-outline', 26)}</span><b>${off ? `${esc(I.name)} er slått av` : `Fant ikke ${esc(I.name)}`}</b>
        <span>${off ? 'Integrasjonen er satt til «Ingen» i Tilpass Server.' : `Legg til integrasjonen i Home Assistant, eller velg en annen config entry.${k === 'unraid' ? ' Glances brukes automatisk som reserve.' : ''}`}</span>
        <div class="nfb"><button class="pick press" data-act="pickint" data-v="${k}">${M.icon('mdi:swap-horizontal', 18)}Velg integrasjon</button><button class="pick press" data-act="addint" data-v="${esc(I.domain)}">${M.icon('mdi:plus', 18)}Legg til i HA</button></div></section>`;
    }
    _sec(s, meta, body, cls) {
      return `<section class="sec ${cls || ''}" data-key="s-${s.id}" aria-label="${esc(s.title)}"><div class="sh">${M.icon(s.icon, 20)}<span class="st">${esc(s.title)}</span>${meta ? `<span class="sm">${esc(meta)}</span>` : ''}</div>${body}</section>`;
    }
    _sw(on, attrs, label, dis) {
      const pend = /data-sw="([^"]+)"/.exec(attrs || ''), p = pend && this._pending(pend[1]);
      return `<button class="sw ${on ? 'on' : ''} ${p ? 'pend' : ''}" role="switch" aria-checked="${!!on}" aria-label="${esc(label)}" data-act="tgl" ${attrs} ${dis ? 'disabled' : ''}><i>${p ? '<span class="spin"></span>' : ''}</i></button>`;
    }
    _kpi(label, v, id) { return `<div class="kp" ${id ? `data-act="more" data-id="${esc(id)}" data-ent="${esc(id)}" role="button"` : ''}><b class="num ell">${esc(v)}</b><span>${esc(label)}</span></div>`; }
    _dangerBtn(key, label, attrs, icon) {
      const on = this._armed === key;
      return `<button class="ab danger ${on ? 'armed' : ''}" data-act="arm" data-key="${esc(key)}" ${attrs} data-haptic="off">${M.icon(icon || 'mdi:restart', 18)}${on ? 'Bekreft · trykk igjen' : esc(label)}</button>`;
    }

    /* ---------------------------------------------------------- Nettverk */
    _s_gw(R, tab, s) {
      const h = this.hass, ex = new Set(this.config.exclude || []);
      const E = R.unifi.enheter.filter((e) => (e.type === 'ruter' || e.type === 'ap') && !ex.has(e.tracker) && !ex.has(e.cpu));
      if (!E.length) return this._sec(s, '', `<div class="none">Fant ingen gateway eller aksesspunkt</div>`);
      const online = E.filter((e) => !apOffline(h, e)).length;
      const tiles = E.map((e) => {
        [e.tracker, e.cpu, e.klienter, e.tilstand, e.temp, e.oppetid, e.kanal, e.led, e.finn].forEach((id) => this.s(id));
        const off = apOffline(h, e), start = !off && apStarter(h, e), open = this.ui.dx === e.dev, [tl, ic] = TYPE[e.type];
        const [stTxt, stCol] = off ? ['Frakoblet', C.red] : start ? ['Starter …', C.orange] : ['Online', C.green];
        const blink = this._blink[e.dev] > Date.now() || (e.finn && dom(e.finn) === 'switch' && h.states[e.finn] && h.states[e.finn].state === 'on');
        let ex2 = '';
        if (open) {
          const tr = e.tracker && h.states[e.tracker], upd = e.oppdatering && h.states[e.oppdatering];
          const meta = [tr && tr.attributes.ip, e.oppetid && ok(h.states[e.oppetid]) ? 'Oppe ' + oppetid(h, e.oppetid) : null, upd && upd.attributes.installed_version ? 'v' + upd.attributes.installed_version : null].filter(Boolean).join(' · ') || tl;
          const kp = e.type === 'ruter'
            ? this._kpi('Klienter', nf(klientTall(h, R, this.config)), null) + this._kpi('CPU', fmt(h, e.cpu), e.cpu) + this._kpi('Temp', fmt(h, e.temp), e.temp)
            : this._kpi('Klienter', nf(numOf(h, e.klienter)), e.klienter) + this._kpi('Kanal', fmt(h, e.kanal), e.kanal) + this._kpi('Last', fmt(h, e.cpu), e.cpu);
          const loc = e.finn || e.led;
          ex2 = `<div class="dx"><div class="dxm"><span class="badge">${esc(e.modell || tl)}</span><span class="ell">${esc(meta)}</span></div><div class="kps">${kp}</div>
            <div class="acts">${e.restart ? this._dangerBtn('rs-' + e.dev, 'Omstart', `data-id="${esc(e.restart)}" data-toast="Starter på nytt …"`) : ''}${e.type === 'ap' && loc ? `<button class="ab" data-act="locate" data-id="${esc(loc)}" data-dev="${esc(e.dev)}">${M.icon('mdi:crosshairs-gps', 18)}Finn</button>` : ''}</div></div>`;
        }
        return `<div class="ti ${open ? 'open' : ''} ${blink ? 'blink' : ''}" data-key="ti-${esc(e.dev)}"><button class="tih" data-act="dx" data-v="${esc(e.dev)}" ${e.tracker ? `data-ent="${esc(e.tracker)}"` : ''} aria-expanded="${open}">
          <span class="tic ${off ? 'off' : ''}">${M.icon(ic, 22)}</span><span class="grow col"><b class="ell">${esc(e.navn)}</b><span class="ell" style="color:${stCol}">${stTxt}</span></span></button>${ex2}</div>`;
      }).join('');
      return this._sec(s, `${online} av ${E.length} online`, `<div class="grid2">${tiles}</div>`);
    }
    _s_cams(R, tab, s) {
      const h = this.hass, ex = new Set(this.config.exclude || []);
      if (!R.found.protect) {
        return this._sec(s, '', `<button class="missrow" data-act="pickint" data-v="protect">${M.icon('mdi:cctv-off', 20)}<span class="grow ell">${R.mode.protect === 'none' ? 'UniFi Protect slått av' : 'UniFi Protect ikke funnet'} · kameraer skjult</span><span class="mv">Velg</span></button>`);
      }
      const K = R.protect.kameraer.filter((k) => !ex.has(k.cam));
      if (!K.length) return this._sec(s, '', '<div class="none">Fant ingen kameraer</div>');
      const st = (k) => {
        const cs = this.s(k.cam), md = this.s(k.modus), sw = this.s(k.opptak);
        if (!ok(cs)) return 'off';
        if (md && ok(md)) return /never|aldri/i.test(md.state) ? 'pause' : 'rec';
        if (sw) return sw.state === 'on' ? 'rec' : 'pause';
        return cs.state === 'recording' ? 'rec' : 'pause';
      };
      const MOD = { always: 'Alltid', detections: 'Deteksjon', never: 'Aldri', schedule: 'Plan', motion: 'Bevegelse' };
      const tiles = K.map((k) => {
        [k.bevegelse, k.bitrate, k.oppetid].forEach((id) => this.s(id));
        const S = st(k), open = this.ui.cx === k.dev;
        const [txt, col] = S === 'off' ? ['Frakoblet', C.red] : S === 'rec' ? ['Opptak', C.red] : ['Pause', C.orange];
        let ex2 = '';
        if (open) {
          const md = k.modus && h.states[k.modus], mv = k.bevegelse && h.states[k.bevegelse];
          const kp = this._kpi('Opptaksmodus', md && ok(md) ? (MOD[md.state] || tittel(md.state)) : S === 'rec' ? 'På' : S === 'pause' ? 'Av' : '–', k.modus)
            + this._kpi('Siste bevegelse', mv ? (mv.state === 'on' ? 'nå' : M.relTime(mv.last_changed)) : '–', k.bevegelse) + this._kpi('Bitrate', fmt(h, k.bitrate), k.bitrate);
          const rec = k.modus ? `data-sel="${esc(k.modus)}"` : k.opptak ? `data-sw="${esc(k.opptak)}"` : '';
          ex2 = `<div class="dx"><div class="dxm"><span class="badge">${esc(k.modell || (k.ringeklokke ? 'Ringeklokke' : 'Kamera'))}</span><span class="ell">${esc([k.ringeklokke ? 'Ringeklokke' : null, k.oppetid && ok(h.states[k.oppetid]) ? 'Oppe ' + oppetid(h, k.oppetid) : null].filter(Boolean).join(' · ') || 'UniFi Protect')}</span></div><div class="kps">${kp}</div>
            <div class="acts">${k.restart ? this._dangerBtn('rs-' + k.dev, 'Omstart', `data-id="${esc(k.restart)}" data-toast="Starter på nytt …"`) : ''}${rec && S !== 'off' ? `<button class="ab" data-act="tgl" ${rec}>${M.icon(S === 'rec' ? 'mdi:pause' : 'mdi:record-rec', 18)}${S === 'rec' ? 'Pause opptak' : 'Start opptak'}</button>` : ''}</div></div>`;
        }
        return `<div class="ti ${open ? 'open' : ''}" data-key="ci-${esc(k.dev)}"><button class="tih" data-act="cx" data-v="${esc(k.dev)}" data-ent="${esc(k.cam)}" aria-expanded="${open}">
          <span class="tic ${S === 'off' ? 'off' : ''}">${M.icon(k.ringeklokke ? 'mdi:doorbell-video' : 'mdi:cctv', 22)}</span><span class="grow col"><b class="ell">${esc(k.navn)}</b><span class="ell cst" style="color:${col}">${S === 'rec' ? '<i class="rec"></i>' : ''}${txt}</span></span></button>${ex2}</div>`;
      }).join('');
      const on = K.filter((k) => st(k) !== 'off').length;
      return this._sec(s, `${on} av ${K.length} online`, `<div class="grid2">${tiles}</div>`);
    }
    // Switch-kortet (24.10-funksjonen: port av/på, PoE-bryter, strømsyklus) – ny plassering og nye mål (26.4)
    _s_sw(R, tab, s) {
      const h = this.hass, ex = new Set(this.config.exclude || []);
      const SW = R.unifi.enheter.filter((e) => e.type === 'switch' && (/usw|switch/i.test(e.modell) || e.porter.length) && !ex.has(e.tracker));
      if (!SW.length) return this._sec(s, '', '<div class="none">Fant ingen switcher</div>');
      const e = SW.find((x) => x.dev === this.ui.swSel) || SW[0];
      [e.tracker, e.oppetid, e.budsjett, e.forbruk].forEach((id) => this.s(id));
      const P = {}; e.porter.forEach((p) => { P[p.n] = p; [p.en, p.poe, p.pw, p.rx, p.tx, p.speed].forEach((id) => this.s(id)); });
      const N = Math.max(e.antall, 1);
      const isOn = (id) => !!id && h.states[id] && h.states[id].state === 'on';
      const up = (p) => {
        if (!p) return false;
        const sp = numOf(h, p.speed); if (p.speed && ok(h.states[p.speed])) return sp > 0;
        if (p.rx && ok(h.states[p.rx])) return true;
        if (p.en) return isOn(p.en);
        if (p.poe) return isOn(p.poe);
        return (numOf(h, p.pw) || 0) > 0;
      };
      const poeW = (p) => (p && numOf(h, p.pw)) || 0;
      const nUp = Array.from({ length: N }, (_, i) => up(P[i + 1])).filter(Boolean).length;
      const sumPoe = e.porter.reduce((a, p) => a + poeW(p), 0), bud = numOf(h, e.budsjett);
      const seg = SW.length > 1 ? `<div class="subs segm swseg" role="tablist">${SW.map((x) => `<button class="sb${x === e ? ' on' : ''}" role="tab" aria-selected="${x === e}" data-act="swsel" data-v="${esc(x.dev)}" data-haptic="selection">${esc(x.navn)}</button>`).join('')}</div>` : '';
      const grid = Array.from({ length: N }, (_, i) => {
        const n = i + 1, p = P[n], u = up(p), poe = p && (isOn(p.poe) || poeW(p) > 0), selp = String(this.ui.port) === String(n);
        return `<button class="pt ${u ? 'up' : ''} ${p ? '' : 'nop'} ${selp ? 'sel' : ''}" data-act="port" data-v="${n}" data-haptic="selection" aria-label="Port ${n}${u ? ' oppe' : ' nede'}${poe ? ', PoE' : ''}" aria-pressed="${selp}"><i class="pl"></i><span class="pn num">${n}</span><span class="pb">${poe ? M.icon('mdi:lightning-bolt', 12) : ''}</span></button>`;
      }).join('');
      let det = '';
      const sp = this.ui.port != null && +this.ui.port <= N ? +this.ui.port : null;
      if (sp) {
        const p = P[sp] || { n: sp }, en = p.en ? isOn(p.en) : up(p), noPoe = !p.poe || (p.en && !isOn(p.en));
        const spTxt = (q) => { const v = numOf(h, q.speed), u = unitOf(h, q.speed); if (!q.speed || v == null) return up(q) ? '–' : 'Ingen link'; if (!v) return 'Ingen link'; return /^m/i.test(u) || !u ? (v >= 1000 ? `${nf(v / 1000, v % 1000 ? 1 : 0)} Gbps` : `${nf(v)} Mbps`) : fmt(h, q.speed); };
        const rate = (id) => (id && ok(h.states[id]) ? `${nf(numOf(h, id), numOf(h, id) < 10 ? 1 : 0)}` : '–');
        det = `<div class="pd" data-key="pd-${esc(e.dev)}-${sp}"><div class="pdh"><b>Port ${sp}</b><span>${up(p) ? 'Oppe' : 'Nede'}</span></div>
          <div class="kps">${this._kpi('Hastighet', spTxt(p), p.speed)}${this._kpi('PoE', p.pw ? `${nf(poeW(p), 1)} W` : '–', p.pw)}${this._kpi('Mbps ned/opp', `${rate(p.rx)} / ${rate(p.tx)}`, p.rx)}</div>
          <div class="pdr"><span class="grow">Port aktiv</span>${p.en ? this._sw(isOn(p.en), `data-sw="${esc(p.en)}"`, `Port ${sp} aktiv`) : '<span class="mv">–</span>'}</div>
          <div class="pdr"><span class="grow col"><span>PoE</span>${noPoe ? '<small>Porten er av eller enheten bruker ikke PoE</small>' : ''}</span>${p.poe ? this._sw(isOn(p.poe), `data-sw="${esc(p.poe)}"`, `PoE port ${sp}`, noPoe && !isOn(p.poe)) : '<span class="mv">–</span>'}</div>
          ${p.cyc ? `<button class="ab wide" data-act="run" data-id="${esc(p.cyc)}" data-toast="Strømsykler port ${sp} …" ${!p.poe || isOn(p.poe) ? '' : 'disabled'}>${M.icon('mdi:power-cycle', 18)}Strømsyklus PoE</button>` : ''}</div>`;
      }
      const hasPoe = e.porter.some((p) => p.poe || p.pw) || bud != null;
      const card = `<div class="swc"><div class="swl"><b class="ell">${esc(e.modell || e.navn)}</b><span class="ell">${nUp}/${N} oppe · ${esc(oppetid(h, e.oppetid))}</span></div>
        ${hasPoe ? `<div class="poer"><span class="poep">${M.icon('mdi:lightning-bolt', 12)}PoE ${nf(sumPoe, 1)}${bud != null ? ` / ${nf(bud)}` : ''} W</span>${bud != null ? `<div class="poeb"><i style="width:${M.clamp((sumPoe / Math.max(bud, 1)) * 100, 0, 100).toFixed(1)}%"></i></div>` : ''}</div>` : ''}
        <div class="pg">${grid}</div>
        <div class="lg"><span><i class="pl up"></i>Oppe</span><span><i class="pl"></i>Nede</span><span>${M.icon('mdi:lightning-bolt', 12, `color:${C.yellow}`)}PoE</span><span><i class="rg"></i>Valgt</span></div></div>`;
      return this._sec(s, `${SW.length} ${SW.length === 1 ? 'switch' : 'switcher'}`, seg + card + det);
    }

    /* ---------------------------------------------------------- Proxmox / Unraid */
    _node(R, tab) { return tab === 'proxmox' ? (R.proxmox.noder[0] || {}) : (R.unraid || {}); }
    _s_perf(R, tab, s) {
      const h = this.hass, n = this._node(R, tab);
      const col = (label, id, pct, unitTxt) => {
        this.s(id);
        const v = numOf(h, id), p = pct != null ? pct : null;
        const txt = v == null ? '–' : `${nf(v, Math.abs(v) < 10 && v % 1 ? 1 : 0)}${unitTxt != null ? unitTxt : (unitOf(h, id) ? ' ' + uShort(unitOf(h, id)) : '')}`;
        return `<div class="pc" ${id ? `data-act="more" data-id="${esc(id)}" data-ent="${esc(id)}" role="button"` : ''}><b class="num ell">${esc(txt)}</b><span class="ell">${esc(label)}</span><span class="tb2"><i style="width:${p == null ? 0 : M.clamp(p, 0, 100).toFixed(1)}%;background:${p != null && p > 80 ? C.orange : C.blue}"></i></span></div>`;
      };
      const pv = (id) => { const u = unitOf(h, id), v = numOf(h, id); return v == null ? null : u === '%' ? v : null; };
      let cols;
      if (tab === 'proxmox') {
        const load = numOf(h, n.last);
        cols = [col('Last', n.last || n.cpu, n.last ? (load != null ? Math.min(100, load * 25) : null) : pctOf(h, n.cpu), n.last ? '' : ' %'), col('Swap', n.swap, pv(n.swap)), col('IO wait', n.iowait, pv(n.iowait)), col('CPU-temp', n.temp, numOf(h, n.temp) != null ? numOf(h, n.temp) : null)];
      } else {
        const load = numOf(h, n.last);
        cols = [col('Last', n.last || n.cpu, n.last ? (load != null ? Math.min(100, load * 25) : null) : pctOf(h, n.cpu), n.last ? '' : ' %'), col('Strøm', n.strom, null), col('UPS', n.ups, pv(n.ups)), col('Nett', n.nett, null)];
      }
      return this._sec(s, '', `<div class="perf">${cols.join('')}</div>`);
    }
    _s_sys(R, tab, s) {
      const h = this.hass, n = this._node(R, tab), rows = [];
      const row = (icon, label, val, id, col) => rows.push(`<div class="lr" ${id ? `data-act="more" data-id="${esc(id)}" data-ent="${esc(id)}" role="button"` : ''}><span class="lic">${M.icon(icon, 18)}</span><span class="grow ell">${esc(label)}</span><b class="ell" ${col ? `style="color:${col}"` : ''}>${esc(val)}</b></div>`);
      const ver = (id) => { const st = id && this.s(id); if (!st) return '–'; if (dom(id) === 'update') return st.attributes.installed_version || '–'; return fmt(h, id); };
      row('mdi:tag-outline', 'Versjon', ver(n.versjon), n.versjon);
      if (n.kernel) row('mdi:chip', 'Kernel', fmt(h, n.kernel), n.kernel);
      if (n.oppd) {
        const st = this.s(n.oppd); let v = '–', col = null;
        if (st && ok(st)) { if (dom(n.oppd) === 'sensor') { const x = numOf(h, n.oppd); v = x != null ? (x ? `${nf(x)} tilgjengelig` : 'Oppdatert') : st.state; col = x ? C.orange : null; } else { v = st.state === 'on' ? 'Tilgjengelig' : 'Oppdatert'; col = st.state === 'on' ? C.orange : null; } }
        row('mdi:update', 'Oppdateringer', v, n.oppd, col);
      }
      if (tab === 'proxmox' && n.backup) row('mdi:backup-restore', 'Backup', dom(n.backup) === 'binary_sensor' ? (this.s(n.backup) && this.s(n.backup).state === 'on' ? 'Feil' : 'OK') : fmt(h, n.backup), n.backup);
      if (tab === 'unraid' && n.flash) row('mdi:usb-flash-drive', 'Flash-backup', dom(n.flash) === 'binary_sensor' ? (this.s(n.flash) && this.s(n.flash).state === 'on' ? 'OK' : 'Mangler') : fmt(h, n.flash), n.flash);
      this.s(n.oppetid);
      row('mdi:timer-outline', 'Oppetid', oppetid(h, n.oppetid), n.oppetid);
      return this._sec(s, '', `<div class="lst">${rows.join('')}</div>`);
    }
    _s_storage(R, tab, s) {
      const h = this.hass, c = this.config, L = limitsOf(c), ex = new Set(c.exclude || []), out = [];
      if (tab === 'unraid' && R.unraid && !R.unraid.glances) {
        const U = R.unraid; [U.arrayStatus, U.arraySw].forEach((id) => this.s(id));
        const stop = arrayStoppet(h, U), st = U.arrayStatus && h.states[U.arrayStatus];
        const canStart = U.arrayStart || U.arraySw, canStop = U.arrayStopp || U.arraySw;
        const btn = stop ? (canStart ? `<button class="ab" data-act="run" data-id="${esc(U.arrayStart || U.arraySw)}" data-toast="Starter arrayet …">${M.icon('mdi:play', 18)}Start</button>` : '')
          : (canStop ? `<button class="ab danger ${this._armed === 'arr' ? 'armed' : ''}" data-act="arm" data-key="arr" data-id="${esc(U.arrayStopp || U.arraySw)}" data-toast="Stopper arrayet …" data-haptic="off">${M.icon('mdi:stop', 18)}${this._armed === 'arr' ? 'Bekreft stopp' : 'Stopp'}</button>` : '');
        out.push(`<div class="arr" data-key="arr"><span class="aic ${stop ? 'warn' : 'ok'}">${M.icon('mdi:harddisk-plus', 20)}</span><span class="grow col"><b>Array</b><span style="color:${stop ? C.orange : C.green}">${stop ? 'Stoppet' : st && ok(st) && dom(U.arrayStatus) === 'sensor' ? tittel(st.state) === 'Started' ? 'Startet' : tittel(st.state) : 'Startet'}</span></span>${btn}</div>`);
      }
      const rows = [];
      const area = (icon, navn, type, id, brukt, tot) => {
        [id, brukt, tot].forEach((x) => this.s(x));
        const p = pctOf(h, id, brukt, tot), bt = brukt || tot ? `${fmt(h, brukt)} / ${fmt(h, tot)}` : p != null ? `${nf(p)} %` : '–';
        rows.push(`<div class="sa" ${id || brukt ? `data-act="more" data-id="${esc(id || brukt)}" data-ent="${esc(id || brukt)}" role="button"` : ''}><span class="lic">${M.icon(icon, 18)}</span><span class="grow col"><span class="sal"><b class="ell">${esc(navn)}</b><span class="ell">${esc(type)}</span><span class="grow"></span><span class="sab num ell">${esc(bt)}</span></span>
          <span class="tb2"><i style="width:${p == null ? 0 : M.clamp(p, 0, 100).toFixed(1)}%;background:${p != null && p >= L.storage ? C.orange : C.blue}"></i></span></span></div>`);
      };
      if (tab === 'proxmox') {
        const typ = (n) => (/zfs/i.test(n) ? 'ZFS' : /nfs/i.test(n) ? 'NFS' : /cifs|smb/i.test(n) ? 'SMB' : /lvm/i.test(n) ? 'LVM-thin' : /ceph|rbd/i.test(n) ? 'Ceph' : /pbs|backup/i.test(n) ? 'PBS' : 'Katalog');
        const n = R.proxmox.noder[0];
        if (n && (n.disk || n.diskBrukt) && !R.proxmox.lagring.some((g) => g.navn === 'local')) area('mdi:folder', 'local', 'Katalog', n.disk, n.diskBrukt, n.diskTot);
        R.proxmox.lagring.filter((g) => !ex.has(g.bruk)).forEach((g) => area(/zfs/i.test(g.navn) ? 'mdi:database' : /nfs|cifs|smb/i.test(g.navn) ? 'mdi:folder-network' : 'mdi:database-outline', g.navn, typ(g.navn), g.bruk, g.brukt, g.total));
      } else if (R.unraid) {
        const U = R.unraid;
        area('mdi:harddisk', 'Array', 'XFS-array', ov(c, 'unraid_array') || U.arrayBruk, U.arrayBrukt, U.arrayTot);
        U.disker.filter((d) => /^cache/.test(d.navn) && d.bruk).forEach((d) => area('mdi:flash', diskNavn(d.navn), 'Cache-pool', d.bruk, d.brukt, d.total));
        if (U.dockerImg) area('mdi:docker', 'docker.img', 'Docker', U.dockerImg);
      }
      out.push(rows.length ? `<div class="lst">${rows.join('')}</div>` : '<div class="none">Fant ingen lagringsområder</div>');
      return this._sec(s, rows.length ? `${rows.length} områder` : '', out.join(''));
    }
    _s_disks(R, tab, s) {
      const h = this.hass, c = this.config, L = limitsOf(c), ex = new Set(c.exclude || []);
      const U = R.unraid, stop = tab === 'unraid' && arrayStoppet(h, U);
      const D = (tab === 'proxmox' ? R.proxmox.disker.map((d) => ({ key: d.id, navn: d.navn, temp: d.temp, bruk: d.bruk, smart: d.helse, extra: d.slitasje, timer: d.timer, size: d.storrelse }))
        : ((U && U.disker) || []).map((d) => ({ key: 'ud-' + d.navn, navn: diskNavn(d.navn), raw: d.navn, temp: d.temp, bruk: d.bruk, smart: d.smart, spin: d.spin, spinSw: d.spinSw, status: d.status, brukt: d.brukt, size: d.total }))).filter((d) => !ex.has(d.temp) && !ex.has(d.bruk));
      if (!D.length) return this._sec(s, '', '<div class="none">Fant ingen disker</div>');
      const hvile = (d) => { const sp = d.spin && this.s(d.spin), sw = d.spinSw && this.s(d.spinSw), t = d.temp && this.s(d.temp); if (sp && ok(sp)) return sp.state === 'off'; if (sw && ok(sw)) return sw.state === 'off'; return !!t && (t.state === 'standby' || (!ok(t) && t.state !== 'unavailable')); };
      const cur = (this.ui.disk || {})[tab], selD = D.find((d) => d.key === cur) || D[0];
      const bays = D.map((d) => {
        [d.temp, d.bruk].forEach((x) => this.s(x));
        const t = numOf(h, d.temp), p = pctOf(h, d.bruk), rest = hvile(d), on = d === selD;
        return `<button class="bay ${rest ? 'rest' : ''} ${on ? 'sel' : ''}" data-act="disk" data-v="${esc(d.key)}" data-haptic="selection" ${d.temp ? `data-ent="${esc(d.temp)}"` : ''} aria-pressed="${on}" aria-label="${esc(d.navn)}">
          <span class="bf" style="height:${p == null ? 0 : M.clamp(p, 0, 100).toFixed(1)}%;background:${p != null && p >= L.storage ? M.alpha(C.orange, 0.35) : 'rgba(255,255,255,0.09)'}"></span>
          <i class="bl" style="background:${rest ? '#545454' : tempCol(t, L.disk_temp)}"></i><span class="bt num">${rest ? 'Hvile' : t == null ? '–' : `${nf(t)}°`}</span><span class="bn ell">${esc(d.navn)}</span></button>`;
      }).join('');
      // detaljkort for valgt disk
      const d = selD, t = numOf(h, d.temp), p = pctOf(h, d.bruk), rest = hvile(d);
      [d.smart, d.spin, d.spinSw, d.status, d.extra, d.size].forEach((x) => this.s(x));
      const sm = d.smart && h.states[d.smart];
      const smTxt = !sm || !ok(sm) ? '–' : dom(d.smart) === 'binary_sensor' ? (sm.attributes.device_class === 'problem' ? (sm.state === 'on' ? 'Feil' : 'OK') : (sm.state === 'on' ? 'OK' : 'Feil')) : String(sm.state).toUpperCase() === 'PASSED' ? 'OK' : fmt(h, d.smart);
      const par = /parity/.test(d.raw || '');
      const status = stop ? 'Array stoppet' : rest ? 'Hvile' : d.status && ok(h.states[d.status]) ? fmt(h, d.status) : 'Aktiv';
      const model = (d.temp && h.states[d.temp] && (h.states[d.temp].attributes.model || h.states[d.temp].attributes.device_model)) || (d.size ? fmt(h, d.size) : d.navn);
      const hdd = tab === 'unraid' && !/^cache/.test(d.raw || '') && !!d.spinSw;
      const detail = `<div class="dd" data-key="dd-${esc(d.key)}"><div class="ddh"><span class="grow col"><b class="ell">${esc(d.navn)}</b><span class="ell">${esc(model)}</span></span><span class="tp" style="color:${tempCol(t, L.disk_temp)};background:${M.alpha(tempCol(t, L.disk_temp), 0.18)}">${rest ? 'Hvile' : t == null ? '–' : `${nf(t)} °C`}</span></div>
        <div class="kps">${this._kpi(par ? 'Rolle' : 'Brukt', par ? 'Paritet' : p == null ? '–' : `${nf(p)} %`, d.bruk)}${this._kpi('SMART', smTxt, d.smart)}${this._kpi('Status', status, d.status || d.spin)}</div>
        ${hdd ? `<div class="pdr"><span class="grow col"><span>Aktiv (spinner)</span>${stop ? '<small>Låst mens arrayet er stoppet</small>' : ''}</span>${this._sw(h.states[d.spinSw] && h.states[d.spinSw].state === 'on', `data-sw="${esc(d.spinSw)}"`, `${d.navn} aktiv`, stop)}</div>` : ''}</div>`;
      const n = Math.min(6, D.length);
      return this._sec(s, `${D.filter((x) => !hvile(x)).length} av ${D.length} aktive`, `<div class="bays" style="grid-template-columns:repeat(${n},minmax(0,1fr))">${bays}</div>${detail}`);
    }
    _s_guests(R, tab, s) { return this._guests(R, tab, s); }
    _s_docker(R, tab, s) { return this._guests(R, tab, s); }
    _guests(R, tab, s) {
      const h = this.hass, ex = new Set(this.config.exclude || []);
      const px = tab === 'proxmox', U = R.unraid, lock = !px && arrayStoppet(h, U);
      const all = (px ? R.proxmox.gjester : ((U && U.gjester) || [])).filter((g) => !ex.has(g.bryter) && !ex.has(g.status));
      if (!px && U && U.glances) return this._sec(s, '', '<div class="none">Glances gir bare målinger – Docker og VM-er krever Unraid-integrasjonen</div>');
      const F = px ? [['alle', 'Alle'], ['vm', 'VM'], ['ct', 'CT']] : [['docker', 'Docker'], ['vm', 'VM']];
      const f = F.some((x) => x[0] === this._flt[tab]) ? this._flt[tab] : F[0][0];
      const q = (this._q[tab] || '').trim().toLowerCase();
      const G = all.filter((g) => (f === 'alle' || g.type === f) && (!q || g.navn.toLowerCase().includes(q) || String(g.vmid || '').includes(q)));
      const search = `<div class="srch">${M.icon('mdi:magnify', 20, 'color:#979797')}<input data-input="q" type="search" placeholder="Søk i ${px ? 'gjester' : 'containere'}" value="${esc(this._q[tab] || '')}" aria-label="Søk" autocomplete="off" enterkeyhint="search">${q ? `<span class="hits">${G.length} treff</span><button class="clr" data-act="qclr" aria-label="Tøm søk">${M.icon('mdi:close-circle', 18)}</button>` : ''}</div>`;
      const seg = `<div class="subs segm fseg" role="tablist">${F.map(([k, l]) => `<button class="sb${k === f ? ' on' : ''}" role="tab" aria-selected="${k === f}" data-act="flt" data-v="${k}" data-haptic="selection">${esc(l)} <span class="fc">${all.filter((g) => k === 'alle' || g.type === k).length}</span></button>`).join('')}</div>`;
      const rows = G.map((g) => {
        const sid = g.bryter || g.status, st = this.s(sid), on = px ? kjorer(this.s(g.bryter || g.status)) : !!st && st.state === 'on';
        [g.cpu, g.mem, g.oppdatering].forEach((x) => this.s(x));
        const upd = g.oppdatering && h.states[g.oppdatering] && h.states[g.oppdatering].state === 'on';
        const badge = px ? `${g.type === 'vm' ? 'VM' : 'CT'}${g.vmid ? ' ' + g.vmid : ''}` : upd ? 'Oppdatering' : g.type === 'vm' ? 'VM' : '';
        const cpu = pctOf(h, g.cpu), mem = pctOf(h, g.mem, g.ramBrukt, g.ramTot);
        const meta = lock ? 'Låst · array stoppet' : [on ? 'Kjører' : 'Stoppet', on && cpu != null ? `CPU ${nf(cpu)} %` : null, on && mem != null ? `RAM ${nf(mem)} %` : null].filter(Boolean).join(' · ');
        const can = g.bryter || (g.knapper || []).some((k) => ['start', 'stopp', 'av'].includes(k.a));
        const pend = this._pending(sid);
        const sw = can ? (pend ? `<span class="spinw" aria-label="Venter"><span class="spin"></span></span>` : this._sw(on, g.bryter ? `data-sw="${esc(g.bryter)}"` : `data-g="${esc(g.id)}"`, g.navn, lock)) : '';
        const open = this.ui.gx === g.id;
        let ex2 = '';
        if (open) {
          const bar = (l, v) => `<div class="gb"><span>${l}</span><span class="tb2"><i style="width:${v == null ? 0 : M.clamp(v, 0, 100).toFixed(1)}%;background:${v != null && v > 80 ? C.orange : C.blue}"></i></span><b class="num">${v == null ? '–' : nf(v) + ' %'}</b></div>`;
          const K = (a) => (g.knapper || []).find((k) => k.a === a);
          const acts = [];
          if (px) {
            if (on) { if (K('restart')) acts.push(this._dangerBtn('g-rs-' + g.id, 'Omstart', `data-id="${esc(K('restart').id)}"`)); if (K('av')) acts.push(this._dangerBtn('g-av-' + g.id, 'Slå av', `data-id="${esc(K('av').id)}"`, 'mdi:power')); if (K('stopp')) acts.push(this._dangerBtn('g-st-' + g.id, 'Stopp', `data-id="${esc(K('stopp').id)}"`, 'mdi:stop')); }
            else if (K('start')) acts.push(`<button class="ab" data-act="run" data-id="${esc(K('start').id)}">${M.icon('mdi:play', 18)}Start</button>`);
          } else if (!lock) {
            if (on && g.restart) acts.push(this._dangerBtn('g-rs-' + g.id, 'Omstart', `data-id="${esc(g.restart)}"`));
            if (g.oppdater) acts.push(`<button class="ab" data-act="run" data-id="${esc(g.oppdater)}">${M.icon('mdi:update', 18)}Oppdater</button>`);
            acts.push(on ? this._dangerBtn('g-st-' + g.id, 'Stopp', `data-sw="${esc(g.bryter)}"`, 'mdi:stop') : `<button class="ab" data-act="tgl" data-sw="${esc(g.bryter)}">${M.icon('mdi:play', 18)}Start</button>`);
          }
          ex2 = `<div class="gex">${bar('CPU', on ? cpu : null)}${bar('Minne', on ? mem : null)}${acts.length ? `<div class="acts">${acts.join('')}</div>` : ''}</div>`;
        }
        return `<div class="gr ${open ? 'open' : ''} ${lock ? 'lock' : ''}" data-key="g-${esc(g.id)}"><div class="grh" data-act="gx" data-v="${esc(g.id)}" role="button" tabindex="0" ${sid ? `data-ent="${esc(sid)}"` : ''} aria-expanded="${open}">
          <span class="gic ${on ? 'on' : ''}">${M.icon(g.type === 'vm' ? 'mdi:monitor' : px ? 'mdi:cube-outline' : 'mdi:docker', 20)}</span>
          <span class="grow col"><span class="gn"><b class="ell">${esc(g.navn)}</b>${badge ? `<span class="bdg ${upd ? 'upd' : ''}">${esc(badge)}</span>` : ''}</span><span class="ell">${esc(meta)}</span></span>${sw}</div>${ex2}</div>`;
      }).join('');
      const nOn = all.filter((g) => (px ? kjorer(h.states[g.bryter || g.status]) : h.states[g.bryter] && h.states[g.bryter].state === 'on')).length;
      return this._sec(s, `${nOn} av ${all.length} kjører`, `${search}${seg}<div class="lst gl">${rows || `<div class="none">${q ? 'Ingen treff' : 'Ingen her'}</div>`}</div>`);
    }
    _s_controls(R, tab, s) {
      const h = this.hass, n = this._node(R, tab), svc = (d, names) => { const S = h.services && h.services[d]; const x = S && names.find((k) => S[k]); return x ? `${d}.${x}` : null; };
      const B = [];
      const add = (key, icon, label, sub, act, danger) => { if (act) B.push({ key, icon, label, sub, act, danger }); };
      if (tab === 'proxmox') {
        const K = (a) => ((n.knapper || []).find((k) => k.a === a) || {}).id;
        add('upd', 'mdi:update', 'Oppdater', n.oppd && h.states[n.oppd] && numOf(h, n.oppd) ? `${nf(numOf(h, n.oppd))} pakker` : 'Pakker', K('oppdater') ? { id: K('oppdater'), toast: 'Oppdaterer …' } : null);
        add('bak', 'mdi:backup-restore', 'Backup nå', 'Alle gjester', K('backup') ? { id: K('backup'), toast: 'Backup startet' } : null);
        add('rs', 'mdi:restart', 'Omstart', 'Noden', K('restart') ? { id: K('restart'), toast: 'Starter på nytt …' } : null, true);
        add('av', 'mdi:power', 'Slå av', 'Noden', K('av') ? { id: K('av'), toast: 'Slår av …' } : null, true);
      } else if (R.unraid && !R.unraid.glances) {
        const U = R.unraid, fr = numOf(h, U.paritetFrem); this.s(U.paritetFrem);
        const running = fr != null && fr > 0 && fr < 100;
        add('par', running ? 'mdi:stop' : 'mdi:shield-sync', 'Paritetssjekk', running ? `${nf(fr)} % · stopp` : 'Start',
          running ? (U.paritetStopp ? { id: U.paritetStopp } : svc('unraid', ['stop_parity_check', 'parity_check_stop']) ? { svc: svc('unraid', ['stop_parity_check', 'parity_check_stop']) } : null)
            : (U.paritet ? { id: U.paritet, toast: 'Paritetssjekk startet' } : svc('unraid', ['start_parity_check', 'parity_check_start', 'parity_check']) ? { svc: svc('unraid', ['start_parity_check', 'parity_check_start', 'parity_check']), toast: 'Paritetssjekk startet' } : null), running);
        add('spin', 'mdi:sleep', 'Spinn ned', 'Alle disker', U.spinNed ? { id: U.spinNed } : svc('unraid', ['spin_down_all', 'spin_down']) ? { svc: svc('unraid', ['spin_down_all', 'spin_down']) } : null);
        add('mov', 'mdi:folder-move', 'Mover', 'Cache → array', U.mover ? { id: U.mover, toast: 'Mover startet' } : svc('unraid', ['start_mover', 'mover_start']) ? { svc: svc('unraid', ['start_mover', 'mover_start']), toast: 'Mover startet' } : null);
        add('rs', 'mdi:restart', 'Omstart', 'Serveren', U.omstart ? { id: U.omstart, toast: 'Starter på nytt …' } : svc('unraid', ['reboot', 'system_reboot']) ? { svc: svc('unraid', ['reboot', 'system_reboot']) } : null, true);
      }
      if (!B.length) return this._sec(s, '', `<div class="none">Integrasjonen har ingen kontroller</div>`);
      const btns = B.map((b) => {
        const at = `${b.act.id ? `data-id="${esc(b.act.id)}"` : ''} ${b.act.svc ? `data-svc="${esc(b.act.svc)}"` : ''} ${b.act.toast ? `data-toast="${esc(b.act.toast)}"` : ''}`;
        const k = tab + '-' + b.key, armed = this._armed === k;
        return `<div class="cb"><button class="cbb ${b.danger ? 'danger' : ''} ${armed ? 'armed' : ''}" ${b.danger ? `data-act="arm" data-key="${esc(k)}" data-haptic="off"` : 'data-act="run"'} ${at} aria-label="${esc(b.label)}">${M.icon(armed ? 'mdi:alert' : b.icon, 24)}</button><span class="cbl ell">${armed ? 'Bekreft' : esc(b.label)}</span><span class="cbs ell">${armed ? 'trykk igjen' : esc(b.sub)}</span></div>`;
      }).join('');
      return this._sec(s, '', `<div class="ctl">${btns}</div>`);
    }

    afterRender() {
      const Rt = this.shadowRoot;
      if (M.glassDrag) Rt.querySelectorAll('.tabs').forEach((s) => M.glassDrag(s, { axis: 'x' }));
      const sc = Rt.querySelector('.scrub');
      if (sc && !sc.__b) {
        sc.__b = true;
        M.guardDrag(sc, 'none'); // fallgruve 2: touch-action none + stopPropagation
        const pos = (e) => { const r = sc.getBoundingClientRect(); return M.clamp(Math.round(((e.clientX - r.left) / r.width) * 48), 0, 48); };
        let down = false;
        sc.addEventListener('pointerdown', (e) => { e.stopPropagation(); down = true; try { sc.setPointerCapture(e.pointerId); } catch (x) { /* */ } const p = pos(e); if (p !== this.ui.sel) { M.haptic('selection'); this.setUI({ sel: p }); } });
        sc.addEventListener('pointermove', (e) => { if (!down && e.pointerType !== 'mouse') return; e.stopPropagation(); const p = pos(e); if (p !== this.ui.sel) { if (down) M.haptic('selection'); this.setUI({ sel: p }); } });
        const end = () => { down = false; if (this.ui.sel != null) this.setUI({ sel: null }); };
        sc.addEventListener('pointerup', end);
        sc.addEventListener('pointercancel', end);
        sc.addEventListener('pointerleave', end);
      }
    }
    // Kjør en handling: knapp (button.press), tjeneste (domene.tjeneste) eller bryter (data-sw, armert «Stopp» i Docker)
    _run(d) {
      if (d.sw && !d.id && !d.svc) return this._tgl({ sw: d.sw });
      const h = this.hass;
      if (d.id) return M.call(h, dom(d.id) === 'button' ? 'button' : dom(d.id), dom(d.id) === 'button' ? 'press' : 'toggle', { entity_id: d.id }).then(() => d.toast && M.toast(d.toast)).catch(() => {});
      if (d.svc) { const [a, b] = d.svc.split('.'); return M.call(h, a, b, {}).then(() => d.toast && M.toast(d.toast)).catch(() => {}); }
    }
    get styles() {
      return `
        :host{display:block;width:100%}
        .wrap{display:flex;flex-direction:column;gap:12px}
        .pane{display:flex;flex-direction:column;gap:12px;min-width:0}
        ${TAB_CSS('')}
        .hero{position:relative;height:184px;border-radius:28px;overflow:hidden;background:var(--gray200,#3a3a3a);box-shadow:${C.edge};width:100%}
        .graph{position:absolute;left:0;right:0;bottom:0;height:84px}
        .graph svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
        .cursor{position:absolute;top:0;bottom:0;pointer-events:none}
        .scrub{position:absolute;inset:0;touch-action:none;cursor:crosshair}
        .htop{position:absolute;left:18px;right:16px;top:16px;display:flex;align-items:center;gap:8px;min-width:0}
        .hn{font-size:13px;color:var(--gray800,#afafaf);flex:0 1 auto}
        .chip{height:24px;padding:0 9px 0 7px;border-radius:12px;display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;white-space:nowrap;flex:0 1 auto;min-width:0}
        .chip.ok{background:${M.alpha(C.green, 0.18)};color:${C.green}}.chip.warn{background:${M.alpha(C.orange, 0.2)};color:${C.orange}}
        .chip.red{background:${M.alpha(C.red, 0.22)};color:${C.red}}.chip.none{background:var(--gray300,#404040);color:var(--gray700,#979797);padding:0 9px}
        .hr{font-size:12px;color:var(--gray700,#979797);flex:none;max-width:40%}
        .vals{position:absolute;left:18px;right:16px;top:54px;display:flex;flex-direction:column;gap:2px;pointer-events:none}
        .line{display:flex;align-items:baseline;gap:4px;white-space:nowrap;min-width:0}
        .big{font-size:44px;font-weight:300;letter-spacing:-0.04em;line-height:1}
        .bu{font-size:18px;font-weight:300;color:var(--gray800,#afafaf);margin-right:10px}
        .sv{pointer-events:auto;display:inline-flex;align-items:baseline;gap:2px;height:28px;padding:0 9px;border-radius:14px;color:var(--gray900,#c7c7c7);position:relative;z-index:2}
        .sv:active{background:rgba(255,255,255,0.08)}
        .svv{font-size:17px;font-weight:400;color:var(--white,#fafafa)}.svu{font-size:12px;color:var(--gray700,#979797)}.svl{font-size:11px;color:var(--gray600,#7f7f7f);margin-left:4px}
        .when{font-size:12px;color:var(--gray600,#7f7f7f);white-space:nowrap}
        .prose{margin:0;padding:0 4px;font-size:16px;line-height:1.9;color:var(--white,#fafafa)}
        .pp{display:inline-flex;align-items:center;height:26px;padding:0 10px;border-radius:13px;background:var(--gray1000,#e1e1e1);color:#282828;font-weight:500;line-height:1;vertical-align:baseline}
        .pp.bad{background:${M.alpha(C.red, 0.25)};color:${C.red}}
        .sec{display:flex;flex-direction:column;gap:8px;padding:14px 12px 12px;border-radius:28px;background:var(--gray200,#3a3a3a);box-shadow:${C.edge};min-width:0}
        .sh{display:flex;align-items:center;gap:8px;padding:0 4px 2px;color:var(--gray800,#afafaf)}
        .st{font-size:15px;font-weight:500;color:var(--white,#fafafa);flex:1;min-width:0}
        .sm{font-size:12px;color:var(--gray700,#979797);white-space:nowrap}
        .none{padding:14px;border-radius:22px;background:var(--gray300,#404040);color:var(--gray700,#979797);font-size:13px}
        .nf{align-items:center;text-align:center;padding:22px 16px;gap:8px;color:var(--gray700,#979797);font-size:13px}
        .nf b{font-size:15px;color:var(--white,#fafafa);font-weight:500}
        .nfi{width:52px;height:52px;border-radius:26px;background:var(--gray300,#404040);display:grid;place-items:center;color:${C.orange}}
        .nfb{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:4px}
        .missrow{display:flex;align-items:center;gap:10px;width:100%;min-height:52px;padding:6px 14px;border-radius:22px;background:var(--gray300,#404040);font-size:13px;color:var(--gray900,#c7c7c7);text-align:left}
        .mv{font-size:13px;font-weight:600;color:${C.pink}}
        .grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
        .ti{border-radius:26px;background:var(--gray300,#404040);min-width:0;transition:background .2s}
        .ti.open{grid-column:1/-1}
        .tih{display:flex;align-items:center;gap:10px;width:100%;min-height:60px;padding:8px 12px 8px 10px;text-align:left}
        .tih b{font-size:14px;font-weight:500}.tih .col>span{font-size:12px}
        .tic{width:40px;height:40px;border-radius:20px;display:grid;place-items:center;flex:none;background:var(--gray1000,#e1e1e1);color:#282828}
        .tic.off{background:var(--gray400,#545454);color:var(--gray700,#979797)}
        .ti.blink .tic{animation:blink 1s ease-in-out infinite}
        .cst{display:inline-flex;align-items:center;gap:6px}
        .rec{width:8px;height:8px;border-radius:4px;background:${C.red};animation:puls 1.4s ease-out infinite;flex:none}
        @keyframes blink{50%{opacity:.35}}
        @keyframes puls{0%{box-shadow:0 0 0 0 ${M.alpha(C.red, 0.6)}}70%{box-shadow:0 0 0 7px ${M.alpha(C.red, 0)}}100%{box-shadow:0 0 0 0 ${M.alpha(C.red, 0)}}}
        @media (prefers-reduced-motion: reduce){.rec,.ti.blink .tic{animation:none}}
        .dx{display:flex;flex-direction:column;gap:8px;padding:0 10px 10px}
        .dxm{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--gray700,#979797);min-width:0}
        .badge{height:22px;padding:0 9px;border-radius:11px;background:var(--gray200,#3a3a3a);color:var(--gray900,#c7c7c7);font-size:11px;font-weight:600;display:inline-flex;align-items:center;flex:none;max-width:55%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
        .kps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
        .kp{display:flex;flex-direction:column;gap:2px;padding:9px 11px;border-radius:18px;background:var(--gray200,#3a3a3a);min-width:0;cursor:pointer}
        .kp b{font-size:15px;font-weight:500}.kp span{font-size:11px;color:var(--gray700,#979797)}
        .acts{display:flex;flex-wrap:wrap;gap:6px}
        .ab{height:40px;padding:0 14px;border-radius:20px;background:var(--gray200,#3a3a3a);display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:500;color:var(--white,#fafafa);transition:background .2s,color .2s,transform .15s}
        .ab:active{transform:scale(.96)}.ab[disabled]{opacity:.4;cursor:default}
        .ab.wide{width:100%;justify-content:center;background:var(--gray200,#3a3a3a)}
        .ab.danger{background:${M.alpha(C.red, 0.16)};color:${C.red}}
        .ab.armed,.cbb.armed{background:${C.red} !important;color:#232323 !important}
        .subs.swseg{margin:0 0 2px}
        .swc{display:flex;flex-direction:column;gap:10px;padding:14px 12px 12px;border-radius:22px;background:linear-gradient(160deg,#2c2c2c 0%,#1d1d1d 100%);box-shadow:inset 0 0 0 1px rgba(255,255,255,0.06)}
        .swl{display:flex;align-items:center;gap:8px;min-width:0;font-size:12px;color:var(--gray700,#979797)}
        .swl b{font-size:14px;font-weight:500;color:var(--white,#fafafa);flex:0 1 auto;min-width:0}
        .swl>span.ell{flex:0 1 auto;min-width:0}
        .poer{display:flex;align-items:center;gap:10px}.poer .poeb{flex:1}
        .poep{height:22px;padding:0 8px;border-radius:11px;background:${M.alpha(C.yellow, 0.16)};color:${C.yellow};font-size:11px;font-weight:600;display:inline-flex;align-items:center;gap:3px;flex:none;white-space:nowrap}
        .poeb{height:4px;border-radius:2px;background:rgba(255,255,255,0.1);overflow:hidden}.poeb i{display:block;height:100%;border-radius:2px;background:${C.yellow}}
        .pg{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:4px}
        .pt{height:56px;min-width:0;border-radius:12px;background:rgba(255,255,255,0.06);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:4px 0;color:var(--gray700,#979797)}
        .pt.up{background:rgba(255,255,255,0.1);color:var(--white,#fafafa)}
        .pt.nop{opacity:.45}
        .pt.sel{box-shadow:0 0 0 2px ${C.pink}}
        .pl{display:block;width:8px;height:8px;border-radius:4px;background:#545454;flex:none}
        .pt.up .pl,.pl.up{background:${C.green};box-shadow:0 0 6px ${M.alpha(C.green, 0.8)}}
        .pn{font-size:12px;font-weight:600;line-height:1}
        .pb{height:12px;display:flex;align-items:center;color:${C.yellow};--mdc-icon-size:12px}
        .lg{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:11px;color:var(--gray700,#979797)}
        .lg span{display:inline-flex;align-items:center;gap:5px}
        .rg{display:inline-block;width:10px;height:10px;border-radius:4px;box-shadow:inset 0 0 0 2px ${C.pink}}
        .pd{display:flex;flex-direction:column;gap:8px;padding:12px;border-radius:22px;background:var(--gray300,#404040)}
        .pdh{display:flex;align-items:center;justify-content:space-between;padding:0 4px}.pdh b{font-size:15px;font-weight:500}.pdh span{font-size:12px;color:var(--gray700,#979797)}
        .pdr{display:flex;align-items:center;gap:10px;min-height:48px;padding:4px 6px 4px 12px;border-radius:18px;background:var(--gray200,#3a3a3a);font-size:14px}
        .pdr small{font-size:11px;color:var(--gray700,#979797)}
        .perf{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-radius:22px;background:var(--gray300,#404040);padding:12px 0}
        .pc{display:flex;flex-direction:column;gap:3px;padding:0 10px;min-width:0;cursor:pointer}
        .pc+.pc{box-shadow:inset 1px 0 0 rgba(255,255,255,0.08)}
        .pc b{font-size:20px;font-weight:400}.pc>span.ell{font-size:11px;color:var(--gray700,#979797)}
        .tb2{display:block;height:4px;border-radius:2px;background:var(--gray400,#545454);overflow:hidden;margin-top:3px}.tb2 i{display:block;height:100%;border-radius:2px}
        .lst{display:flex;flex-direction:column;border-radius:22px;background:var(--gray300,#404040);padding:4px 0;min-width:0}
        .lr,.sa{display:flex;align-items:center;gap:12px;min-height:52px;padding:6px 14px;cursor:pointer;min-width:0}
        .lr+.lr,.sa+.sa{box-shadow:inset 0 1px 0 rgba(255,255,255,0.06)}
        .lr b{font-size:13px;font-weight:500;color:var(--gray900,#c7c7c7);max-width:55%;flex:none}
        .lr .grow{font-size:14px}
        .lic{width:36px;height:36px;border-radius:18px;display:grid;place-items:center;flex:none;background:var(--gray200,#3a3a3a);color:var(--gray900,#c7c7c7)}
        .sal{display:flex;align-items:baseline;gap:8px;min-width:0}.sal b{font-size:14px;font-weight:500;flex:0 1 auto}.sal>span.ell{font-size:12px;color:var(--gray700,#979797);flex:0 1 auto}
        .sab{font-size:12px;color:var(--gray900,#c7c7c7);flex:0 1 auto}
        .arr{display:flex;align-items:center;gap:12px;min-height:60px;padding:6px 10px 6px 12px;border-radius:22px;background:var(--gray300,#404040)}
        .arr b{font-size:14px;font-weight:500}.arr .col>span{font-size:12px}
        .aic{width:40px;height:40px;border-radius:20px;display:grid;place-items:center;flex:none}
        .aic.ok{background:${M.alpha(C.green, 0.18)};color:${C.green}}.aic.warn{background:${M.alpha(C.orange, 0.2)};color:${C.orange}}
        .bays{display:grid;gap:6px}
        .bay{position:relative;height:96px;border-radius:16px;background:var(--gray300,#404040);overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:2px;padding:0 4px 8px;min-width:0}
        .bay .bf{position:absolute;left:0;right:0;bottom:0;pointer-events:none}
        .bay .bl{position:absolute;top:8px;left:50%;transform:translateX(-50%);width:14px;height:4px;border-radius:2px}
        .bt{position:relative;font-size:17px;font-weight:400}.bn{position:relative;font-size:11px;color:var(--gray700,#979797);max-width:100%}
        .bay.rest .bt{font-size:13px;color:var(--gray600,#7f7f7f)}.bay.rest{opacity:.75}
        .bay.sel{box-shadow:0 0 0 2px ${C.pink}}
        .dd{display:flex;flex-direction:column;gap:8px;padding:12px;border-radius:22px;background:var(--gray300,#404040)}
        .ddh{display:flex;align-items:center;gap:10px;padding:0 2px}.ddh b{font-size:15px;font-weight:500}.ddh .col>span{font-size:12px;color:var(--gray700,#979797)}
        .tp{height:26px;padding:0 10px;border-radius:13px;display:inline-flex;align-items:center;font-size:12px;font-weight:600;flex:none}
        .srch{display:flex;align-items:center;gap:8px;height:48px;padding:0 8px 0 14px;border-radius:24px;background:var(--gray300,#404040)}
        .srch input{flex:1;min-width:0;height:100%;font-size:15px;background:none}
        .srch input::-webkit-search-cancel-button{display:none}
        .hits{font-size:12px;color:var(--gray700,#979797);flex:none}
        .clr{width:36px;height:36px;border-radius:18px;display:grid;place-items:center;color:var(--gray700,#979797);flex:none}
        .fc{font-size:11px;opacity:.6;margin-left:2px}
        .gl{padding:4px 0}
        .gr{min-width:0}.gr+.gr{box-shadow:inset 0 1px 0 rgba(255,255,255,0.06)}
        .grh{display:flex;align-items:center;gap:12px;min-height:60px;padding:6px 10px 6px 12px;cursor:pointer;min-width:0}
        .grh .col>span{font-size:12px;color:var(--gray700,#979797)}
        .gn{display:flex;align-items:center;gap:6px;min-width:0}.gn b{font-size:14px;font-weight:500}
        .bdg{height:20px;padding:0 7px;border-radius:10px;background:var(--gray200,#3a3a3a);color:var(--gray900,#c7c7c7);font-size:10px;font-weight:600;display:inline-flex;align-items:center;flex:none;white-space:nowrap}
        .bdg.upd{background:${M.alpha(C.orange, 0.2)};color:${C.orange}}
        .gic{width:40px;height:40px;border-radius:20px;display:grid;place-items:center;flex:none;background:var(--gray400,#545454);color:var(--gray700,#979797)}
        .gic.on{background:var(--gray1000,#e1e1e1);color:#282828}
        .gr.lock .grh{opacity:.6}
        .gex{display:flex;flex-direction:column;gap:8px;padding:0 12px 12px 64px}
        .gb{display:grid;grid-template-columns:48px 1fr 52px;align-items:center;gap:8px;font-size:12px;color:var(--gray700,#979797)}.gb .tb2{margin:0}.gb b{font-weight:500;color:var(--gray900,#c7c7c7);text-align:right}
        .sw{position:relative;width:44px;height:26px;border-radius:13px;flex:none;background:var(--gray400,#545454);transition:background .2s}
        .sw i{position:absolute;left:3px;top:3px;width:20px;height:20px;border-radius:10px;background:#fafafa;transition:transform .2s cubic-bezier(.34,1.4,.64,1);display:grid;place-items:center}
        .sw.on{background:${M.SWITCH_ON || C.pink}}.sw.on i{transform:translateX(18px)}
        .sw[disabled]{opacity:.4;cursor:default}
        .spin{width:12px;height:12px;border-radius:50%;border:2px solid rgba(0,0,0,0.25);border-top-color:#282828;animation:spn .8s linear infinite;display:block}
        .spinw{width:44px;height:26px;display:grid;place-items:center;flex:none}.spinw .spin{width:18px;height:18px;border-color:rgba(255,255,255,0.2);border-top-color:${C.pink}}
        @keyframes spn{to{transform:rotate(360deg)}}
        .ctl{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;padding:6px 0 2px}
        .cb{display:flex;flex-direction:column;align-items:center;gap:4px;min-width:0;text-align:center}
        .cbb{width:56px;height:56px;border-radius:28px;display:grid;place-items:center;background:var(--gray300,#404040);color:var(--white,#fafafa);transition:background .2s,color .2s,transform .15s}
        .cbb:active{transform:scale(.94)}
        .cbb.danger{background:${M.alpha(C.red, 0.16)};color:${C.red}}
        .cbl{font-size:12px;font-weight:500;max-width:100%}.cbs{font-size:11px;color:var(--gray700,#979797);max-width:100%}
        @media (max-width:360px){.kps{grid-template-columns:repeat(3,minmax(0,1fr))}.pc b{font-size:17px}}
      `;
    }
  }

  M.POPUP_CARDS = M.POPUP_CARDS || [];
  if (!M.POPUP_CARDS.includes('msh-server-card')) M.POPUP_CARDS.push('msh-server-card'); // «Mellomrom» ligger i Avansert-fanen
  // Den gamle importerte #server (ki-homelab-card o.l.) erstattes av denne – til brukeren velger «Bruk egen» (04-strategy)
  M.POPUP_SUPERSEDE = M.POPUP_SUPERSEDE || {};
  M.POPUP_SUPERSEDE[HASH] = { name: 'Server', test: (cfg) => /custom:ki-(homelab|server|pve|unifi|rack)-card/.test(JSON.stringify(cfg || {})) };
  // Vilkår (strategi/allPopups): minst én av integrasjonene – entiteter i registeret eller en config entry
  M.popupNeeds = M.popupNeeds || {};
  M.popupNeeds[HASH] = (hass) => Object.values((hass && hass.entities) || {}).some((e) => e && PLAT[e.platform] && e.platform !== 'glances') || (Array.isArray(CE.data) && CE.data.some((e) => e.domain !== 'glances'));
  M.server = { oppdag, entries, entriesFor, openPick, INTEG, SECDEF, tabsCfg, secList };
  M.define('msh-server-card', Server, 'MSH Server', 'Server-popup (#server): Nettverk (UniFi Network + Protect), Proxmox VE og Unraid – toppkort med graf, prosalinje, underfaner og seksjoner.');
})();
