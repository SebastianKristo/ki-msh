/* msh-server-card · Server-popup #server (Fiks 35.1 + 35.2 – 1:1 etter «Server v6.dc.html», erstatter v5-oppbyggingen fra Fiks 26).
 * Funksjons-popup (Mal A), ETT kort, Bubble eier headeren. Rekkefølge (designet):
 *   1. Vertvelger: fanelinje Nettverk · Proxmox · Unraid · HA (pill-spor --ki-surface, aktiv = rosa gradient + --ki-on-accent,
 *      høyde tab_height 32–60, std 44) + tannhjul til høyre; hold 400 ms + dra = ny rekkefølge (felles MSH.tabRow, tab_order).
 *      Alternativ `velger: kort` = 2-kolonners kort med ring (CPU / ned-last) + statusprikk – tannhjulet ligger da i toppkortet.
 *   2. Toppkort (184 px): vertsnavn + statuschip, stor verdi (44/300) for valgt måling + to små målinger (trykk = bytt graf),
 *      tidsetikett «nå · …» / «−3 t · …», graf 84 px kant til kant med scrub (touch-action none + stopPropagation).
 *   3. Prosa-setning (show_prose, std på): ÉN <p> med inline invers-piller (35.7 regel 1 – aldri containere).
 *   4. Underfaner per vert: Nettverk UDM · Enheter · Switch (Fiks 50 K; UDM = Internett-kortet (SpeedTest, del G) + UDM-kortet
 *      fra 58b-server-unifi.js; Enheter/Switch tegnes av M.serverUnifi når den finnes) · Proxmox Gjester · Lagring · Backup
 *      · Unraid Array · Gjester · HA Tillegg · Oppdateringer · System · qBittorrent Torrenter · Statistikk (Fiks 50 E).
 *   Fiks 50 F: vertvelgeren er en vannrett karusell (faner og kort): flex 1 0 auto, min 84 px, scroll-snap, fade 18 px bare på
 *      siden med skjult innhold, aktiv fane sentreres, touch-action pan-x pan-y (Fiks 56 G: vertikalt sveip på velgeren scroller
 *      popupen; fanetrykk bytter aldri ved loddrett sveip) + stopPropagation, hold-dra omorganiserer fortsatt.
 *   Fiks 50 E: qBittorrent (plattform qbittorrent, translation_key) skjules automatisk når integrasjonen mangler (qbit_force).
 *   Fiks 50 G: Internett-kortet bruker SpeedTest (speedtestdotnet): Ned/Opp Mbit/s, «Ping 6 ms · målt 14:10», «Kjør test».
 *   Fiks 62 (prompt v6): arildkristo.com (Cloudflare, 58c-server-cf.js) etter qBittorrent – skjules uten sensorene. Ikon i
 *   vert-fanene (host_icons) og «Faner viser» (tab_mode alle|aktiv|ikon); tannhjulet åpner «Tilpass server» (_tilpass) med
 *   «Flere innstillinger» → hele Tilpass-arket.
 *   Vert-grensesnitt for M.serverUnifi: card._host = { hass, config, ui, setUI, render, haptic, moreInfo, setCfg, go, confirm }.
 *   Felles utvidbar liste (35.2: Gjester/Tillegg): søk (44 px), filterchips med antall, rader 60 px med bryter (stopPropagation),
 *   trykk = utvid (6 stat-fliser, bruksstolper, brytere, handlinger). Rød-tone-handlinger krever bekreftelse (to trykk).
 * Data (autokonfig, aldri mock – mangler → «–»): UniFi Network (unifi), UniFi Protect (unifiprotect – kameraene vises ikke i Server;
 *   brukervalg 35), Proxmox VE (proxmoxve), Unraid (unraid, Glances som reserve), Home Assistant (hassio-entiteter,
 *   systemmonitor/uptime + Supervisor via WS `supervisor/api` /addons, /addons/<slug>/info|stats).
 *   Integrasjonene oppdages fra config entries (config_entries/get) + entitets-/enhetsregisteret; manuelt valg
 *   integrations: { unifi, protect, proxmox, unraid: <entry_id|'none'> } via integrasjonsvelgeren (portalt ark).
 * Config (samme skjema i «Tilpass Server» (MSH.openEditor → MSH.overlay tilpass:true) og GUI-editoren):
 *   velger: faner|kort · tab_mode · host_icons · tab_height (32–60) · show_prose · tab_order · hidden_tabs · start_tab · hero_metric { net, proxmox,
 *   unraid, ha } · integrations · overrides · exclude · gap/pad_top/pad_bottom. Gamle v5-nøkler (tabs.order/hidden/start) leses.
 * Farger: tokens fra ki-theme (src/00-a-theme.js) med dagens mørke verdi som fallback – mørk modus er uendret.
 * Fiks 52 A3 (Android-flimmer): bare aktiv vert tegnes (lazy), skjelett under Bubbles åpne-animasjon, tunge oppslag etter at
 *   popupen har satt seg, avhengigheter (_deps) bare for aktiv vert – se onOpen/_whenSettled/_changed. test/server52-check.mjs.
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
  // Verter (vertvelgeren) og underfaner (designet: HOSTS / SUBS)
  // Fiks 50 E: qBittorrent (designet: HOSTS k 'qbit') etter HA – skjules automatisk når integrasjonen mangler (qbit_force = vis likevel)
  // Fiks 62 (prompt v6): arildkristo.com (Cloudflare, 58c-server-cf.js) etter qBittorrent – skjules når sensorene mangler
  const HOSTS = [['net', 'Nettverk', 'mdi:router-network'], ['proxmox', 'Proxmox', 'mdi:cube-outline'], ['unraid', 'Unraid', 'mdi:dns'], ['ha', 'HA', 'mdi:home-assistant'], ['qbit', 'qBittorrent', 'mdi:download'], ['cf', 'arildkristo.com', 'mdi:web']];
  const HOSTL = Object.fromEntries(HOSTS.map((t) => [t[0], t]));
  const KEYS = HOSTS.map((t) => t[0]);
  const HOST_INT = { net: 'unifi', proxmox: 'proxmox', unraid: 'unraid', ha: null, qbit: null, cf: null };
  // Fiks 62 · ikon i vert-fanene og kort-velgeren (designet: HOSTS.icon / cu.hosts.opts). Lagres som Material-navn i
  // host_icons.<vert> (eller et HA-ikon med prefiks fra GUI-editoren); tegnes som <ha-icon> via tabellen under.
  const HOST_IC = { net: 'router', proxmox: 'view_in_ar', unraid: 'dns', ha: 'home', qbit: 'download', cf: 'language' };
  const IC_OPTS = ['router', 'lan', 'wifi', 'dns', 'storage', 'view_in_ar', 'deployed_code', 'home', 'download', 'language', 'cloud', 'public', 'shield', 'memory', 'dashboard', 'hub', 'movie', 'bolt'];
  const IC_MDI = { router: 'mdi:router-network', lan: 'mdi:lan', wifi: 'mdi:wifi', dns: 'mdi:dns', storage: 'mdi:database', view_in_ar: 'mdi:cube-outline', deployed_code: 'mdi:package-variant-closed',
    home: 'mdi:home', download: 'mdi:download', language: 'mdi:web', cloud: 'mdi:cloud-outline', public: 'mdi:earth', shield: 'mdi:shield-outline', memory: 'mdi:memory', dashboard: 'mdi:view-dashboard-outline',
    hub: 'mdi:hub-outline', movie: 'mdi:movie-outline', bolt: 'mdi:lightning-bolt' };
  const icMdi = (n) => IC_MDI[n] || (M.iconName ? M.iconName(n) : n);
  // «Tilpass server»: config (host_icons / tab_mode) er sannheten; localStorage 'ki-server-tilpass' er bare speil/cache
  const LS_TP = 'ki-server-tilpass';
  const tpCache = () => { try { return JSON.parse(localStorage.getItem(LS_TP) || '{}') || {}; } catch (e) { return {}; } };
  const TAB_MODES = ['alle', 'aktiv', 'ikon'];
  const tabMode = (c) => { const m = (c && c.tab_mode) || tpCache().tabMode; return TAB_MODES.includes(m) ? m : 'alle'; };
  const hostIconName = (c, k) => ((c && c.host_icons) || {})[k] || ((c && c.host_icons) ? null : (tpCache().icons || {})[k]) || HOST_IC[k];
  const hostIcon = (c, k) => icMdi(hostIconName(c, k));
  // Fiks 50 K: Nettverk-underfanene heter UDM · Enheter · Switch (gamle «internett» i lagret UI-tilstand → «udm»)
  const SUBS = {
    net: [['udm', 'UDM'], ['enheter', 'Enheter'], ['switch', 'Switch']],
    qbit: [['torrenter', 'Torrenter'], ['statistikk', 'Statistikk']],
    proxmox: [['gjester', 'Gjester'], ['lagring', 'Lagring'], ['backup', 'Backup']],
    unraid: [['array', 'Array'], ['gjester', 'Gjester']],
    ha: [['tillegg', 'Tillegg'], ['oppdateringer', 'Oppdateringer'], ['system', 'System']],
    cf: [['trafikk', 'Trafikk'], ['besok', 'Besøk'], ['ytelse', 'Ytelse'], ['sikkerhet', 'Sikkerhet']],
  };
  // Aksentfarger (designet: GR, BL, OR, RD, PU, PINK) – flater/grafer i original farge, tekst via ki-theme (--ki-*-text)
  const GR = C.green, BL = C.blue, OR = C.orange, RD = C.red, PU = C.purple, PK = C.pink;
  // Aksent som tekst/ikon (Del A pkt. 6): --ki-*-text i lys modus, ytterligere 25 % mørkere i lys modus (tekst på tone-/grå
  // flater skal holde 4,5:1). Mørk modus: --ki-tone-k er udefinert → 100 % → nøyaktig dagens farge.
  const acc = (n, hex) => `color-mix(in srgb, var(--ki-${n}-text, var(--${n}, ${hex})) calc(100% - (var(--ki-tone-k, 1) - 1) * 50%), black)`;
  const TX = { green: acc('green', '#66d19e'), blue: acc('blue', '#73b9f2'), orange: acc('orange', '#f2b573'), red: acc('red', '#f28073'), purple: acc('purple', '#ad99e6'), pink: acc('pink', '#f285c9') };
  // Tone-bakgrunn (Del A pkt. 5): .16 i mørk, × --ki-tone-k (1,5) i lys
  // Fiks 56 D: kjent aksent → opak lys tint (--ki-tint-<aksent>-circle, aksent 22 % inn i hvitt) i lys modus; mørk = fallback
  const tone = (c, a = 0.16) => {
    const old = `color-mix(in srgb, ${c} calc(${Math.round(a * 100)}% * var(--ki-tone-k, 1)), transparent)`, n = M.theme && M.theme.tint ? M.theme.tint(c).name : null;
    return n ? `var(--ki-tint-${n}-circle, ${old})` : old;
  };
  // Toppkortets målinger per vert: [nøkkel, etikett, enhet, farge] (designet: H.M)
  const HM = {
    net: [['down', 'Ned', 'Mbit', BL], ['up', 'Opp', 'Mbit', GR], ['cl', 'Klienter', '', PU]],
    proxmox: [['cpu', 'CPU', '%', RD], ['mem', 'Minne', '%', PU], ['io', 'IO wait', '%', OR]],
    unraid: [['cpu', 'CPU', '%', RD], ['mem', 'Minne', '%', PU], ['temp', 'CPU-temp', '°', OR]],
    ha: [['cpu', 'CPU', '%', RD], ['mem', 'Minne', '%', PU], ['disk', 'Disk', '%', OR]],
    qbit: [['down', 'Ned', 'MB/s', BL], ['up', 'Opp', 'MB/s', GR], ['act', 'Aktive', '', PU]],
    cf: [['visits', 'Besøk', '', PK], ['req', 'Forespørsler', '', BL], ['data', 'Data', 'MB', OR]],
  };
  const NPT = 48; // punkter i grafen (30 min, 24 t – designet: series(…) med 48 punkter)
  const DEF = {};
  const TTL = 300000;
  // Fiks 52 A3: oppdagelsen bruker bare registeret + hvilke states som finnes (og nesten-statiske attributter som device_class/
  // friendly_name) – ikke verdiene. Memo-nøkkelen er derfor antall states (+ minutt-bøtte som sikkerhetsnett), ikke states-
  // objektet: en ny verdi i én sensor gir ikke ny full gjennomgang av alle entiteter.
  const sKey = (S) => (S ? (M.stateCount ? M.stateCount(S) : Object.keys(S).length) + ':' + Math.floor(Date.now() / 60000) : '');
  const STORE_WARN = 80; // Proxmox-lagring: oransje stripe ≥ 80 %
  const TEMP_WARN = 45; // disk-temperatur i oransje (designet: temp >= 45)

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
  const CE = { data: undefined, busy: false, t: 0, total: null };
  function entries(hass) {
    if (!hass || !hass.callWS) return CE.data;
    if (!CE.busy && Date.now() - CE.t > TTL) {
      CE.busy = true;
      Promise.resolve().then(() => hass.callWS({ type: 'config_entries/get' }))
        .then((r) => { CE.total = Array.isArray(r) ? r.length : null; return (Array.isArray(r) ? r : []).filter((e) => e && DOMS.includes(e.domain)); })
        .catch(() => null)
        .then((d) => {
          CE.t = Date.now(); CE.busy = false;
          // Fiks 52 A3: uendret liste (samme entry/state/tittel) → behold objektet og ingen ny tegning
          const sig = JSON.stringify(d && d.map((e) => [e.entry_id, e.domain, e.state, e.title])) + '|' + CE.total;
          if (CE.data !== undefined && sig === CE.sig) return;
          CE.sig = sig; CE.data = d;
          window.dispatchEvent(new CustomEvent('msh-server-entries', { detail: { src: 'ce' } }));
        });
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
    const sig = JSON.stringify([ex, sel, cfg.navn_map || null]), sk = sKey(hass.states);
    if (MEMO && MEMO.E === E && MEMO.D === D && MEMO.ce === ce && MEMO.sig === sig && (MEMO.S === hass.states || MEMO.sk === sk)) return MEMO.R;
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
        netInn: finn(liste, /(network_in|net_?in|netin|network_rx)$/, 'sensor'), netUt: finn(liste, /(network_out|net_?out|netout|network_tx)$/, 'sensor'),
        cores: finn(liste, /(cpus|cores|cpu_count)$/, 'sensor'),
        onboot: finn(liste, /(onboot|on_boot|start_on_boot|autostart)/, 'switch'), protect: finn(liste, /protect/, 'switch'), bkSw: finn(liste, /backup/, 'switch'),
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
        klienter: (liste.find((x) => dom(x.entity_id) === 'sensor' && /(clients|klienter)$/.test(obj(x.entity_id)) && !/ghz/.test(obj(x.entity_id))) || {}).entity_id, latens, led, restart,
        b5: finn(liste, /5_?ghz_(clients|klienter)$/, 'sensor'), b24: finn(liste, /2_?4_?ghz_(clients|klienter)$/, 'sensor'), txp: finn(liste, /tx_power$/, 'sensor'), fan: finn(liste, /fan/, 'sensor'),
        isp: finn(liste, /isp/, 'sensor'), speedtest: finn(liste, /speed_?test/, 'button'), optim: finn(liste, /(optimi[sz]e|channel_scan|rf_scan)/, 'button'),
        brytere: liste.filter((x) => dom(x.entity_id) === 'switch' && !/port_\d+/.test(obj(x.entity_id)) && !x.entity_category).map((x) => x.entity_id),
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
            cpu: f(/cpu/, 'sensor'), mem: f(/(mem|memory|ram)/, 'sensor'), bilde: (hass.states[e.entity_id].attributes || {}).image || null,
            autostart: f(/auto_?start/, 'switch'), autoupd: f(/auto_?update/, 'switch'), bkSw: f(/backup/, 'switch') };
        }).sort((a, b) => a.navn.localeCompare(b.navn, 'nb')),
      };
    }
    // Effekt: effektsensorer (W/kW) på de funne enhetene, uten per-port-PoE
    INTEG.forEach((i) => ents[i.key].forEach((id) => {
      const s = hass.states[id];
      if (dom(id) === 'sensor' && s && s.attributes.device_class === 'power' && !/port_\d+/.test(obj(id))) R.power.push(id);
    }));
    MEMO = { E, D, ce, sig, S: hass.states, sk, R };
    return R;
  }

  // Fiks 52 A3: forrige oppdagelse uten ny gjennomgang og uten oppslag (skjelettet under åpne-animasjonen) – null hvis utdatert
  function oppdagPeek(hass, cfg) {
    if (!MEMO || !hass) return null;
    const sig = JSON.stringify([cfg.exclude || [], cfg.integrations || {}, cfg.navn_map || null]);
    return MEMO.E === (hass.entities || {}) && MEMO.D === (hass.devices || {}) && MEMO.ce === CE.data && MEMO.sig === sig && (MEMO.S === hass.states || MEMO.sk === sKey(hass.states)) ? MEMO.R : null;
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
  const STOPP = (h, U) => arrayStoppet(h, U);
  const fmtN = (v, d) => (v == null || isNaN(v) ? '–' : M.nf(v, d != null ? d : (Math.abs(v) < 10 && v % 1 ? 1 : 0)));
  // Datahastighet → Mbit/s (UniFi kan rapportere kB/s, MB/s, Mbit/s …)
  const rateF = (u) => {
    u = String(u || '').toLowerCase().replace(/\s/g, '');
    if (/^gbit|^gbps/.test(u)) return 1000; if (/^mbit|^mbps/.test(u)) return 1; if (/^kbit|^kbps/.test(u)) return 0.001; if (/^bit|^bps/.test(u)) return 1e-6;
    if (/^gi?b\/s/.test(u)) return 8000; if (/^mi?b\/s/.test(u)) return 8; if (/^ki?b\/s/.test(u)) return 0.008; if (/^b\/s/.test(u)) return 8e-6;
    return 1;
  };
  // Størrelse (sensor med enhet) → GB / TB
  const toGB = (hass, id) => { const v = numOf(hass, id); if (v == null) return null; const u = unitOf(hass, id).toLowerCase(); return /^t/.test(u) ? v * 1000 : /^m/.test(u) ? v / 1000 : /^k/.test(u) ? v / 1e6 : /^b$/.test(u) ? v / 1e9 : v; };
  const dec1 = (v) => (v >= 100 || Math.round(v * 10) % 10 === 0 ? 0 : 1);
  const sizeTxt = (gb) => (gb == null ? '–' : gb >= 1000 ? `${fmtN(gb / 1000, dec1(gb / 1000))} TB` : `${fmtN(gb, dec1(gb))} GB`);
  const has = (h, d, s) => !h || !h.services || !!(h.services[d] && h.services[d][s]);
  const fName = (hass, id) => { const s = id && hass.states[id]; return (s && s.attributes.friendly_name) || (id ? obj(id) : ''); };

  /* ------------------------------------------------------------ Home Assistant: hassio-entiteter + Supervisor (WS supervisor/api) */
  // SUP.addons: undefined = ikke hentet · null = ingen Supervisor (Container/Core) · [] = liste. info/stats hentes per tillegg.
  const SUP = { addons: undefined, t: 0, busy: false, info: {}, stats: {}, infoT: {}, core: null, os: null, host: null };
  const supWS = (hass, endpoint, method, data) => (hass && hass.callWS ? hass.callWS({ type: 'supervisor/api', endpoint, method: method || 'get', ...(data ? { data } : {}) }) : Promise.reject(new Error('ws')));
  const unwrap = (r) => (r && r.data && typeof r.data === 'object' && !Array.isArray(r.data) ? r.data : r);
  // Fiks 52 A3: hendelsen bare når Supervisor-dataene faktisk er endret (kilde 'sup' – bare HA-fanen tegner på nytt)
  const supEvt = () => {
    let sig = ''; try { sig = JSON.stringify([SUP.addons, SUP.core, SUP.os, SUP.host, SUP.info, SUP.stats]); } catch (e) { sig = String(Date.now()); }
    if (sig === SUP.sig) return;
    SUP.sig = sig;
    window.dispatchEvent(new CustomEvent('msh-server-entries', { detail: { src: 'sup' } }));
  };
  function supLoad(hass, force) {
    if (!hass || !hass.callWS || SUP.busy || (!force && Date.now() - SUP.t < 60000)) return;
    SUP.busy = true;
    const one = (ep, set) => supWS(hass, ep).then((r) => set(unwrap(r))).catch(() => set(undefined));
    Promise.all([
      one('/addons', (r) => { SUP.addons = r && Array.isArray(r.addons) ? r.addons : null; }),
      one('/core/info', (r) => { SUP.core = r && r.version ? r : null; }),
      one('/os/info', (r) => { SUP.os = r && r.version ? r : null; }),
      one('/host/info', (r) => { SUP.host = r && typeof r === 'object' && Object.keys(r).length ? r : null; }),
    ]).then(() => { SUP.t = Date.now(); SUP.busy = false; supEvt(); });
  }
  function supAddon(hass, slug, force) {
    if (!slug || !hass || !hass.callWS) return;
    if (!force && Date.now() - (SUP.infoT[slug] || 0) < 30000) return;
    SUP.infoT[slug] = Date.now();
    Promise.all([
      supWS(hass, `/addons/${slug}/info`).then((r) => { const x = unwrap(r); SUP.info[slug] = x && x.slug ? x : null; }).catch(() => { SUP.info[slug] = null; }),
      supWS(hass, `/addons/${slug}/stats`).then((r) => { const x = unwrap(r); SUP.stats[slug] = x && typeof x === 'object' && Object.keys(x).length ? x : null; }).catch(() => { SUP.stats[slug] = null; }),
    ]).then(supEvt);
  }
  let HMEMO = null;
  function oppdagHA(hass, cfg) {
    const E = hass.entities || {}, D = hass.devices || {}, S = hass.states, sig = JSON.stringify(cfg.exclude || []);
    const sk = sKey(S);
    if (HMEMO && HMEMO.E === E && HMEMO.D === D && (HMEMO.S === S || HMEMO.sk === sk) && HMEMO.t === SUP.t && HMEMO.sig === sig) return HMEMO.R;
    const per = {}, sysm = [], upt = [];
    for (const id in E) {
      const e = E[id];
      if (!e || e.disabled_by || !S[id]) continue;
      if (e.platform === 'hassio') (per[e.device_id || '_'] = per[e.device_id || '_'] || []).push(e);
      else if (e.platform === 'systemmonitor') sysm.push(e);
      else if (e.platform === 'uptime') upt.push(e);
    }
    const R = { addons: [], core: {}, os: {}, sup: {}, host: {}, sys: {}, supervisor: Array.isArray(SUP.addons) };
    const kind = (dev) => {
      const d = D[dev] || {}, s = `${d.model || ''} ${d.name || ''}`.toLowerCase(), idf = ((d.identifiers || []).find((x) => x[0] === 'hassio') || [])[1] || '';
      if (/add-?on/.test(s) && !/^(core|os|supervisor|host)$/i.test(idf)) return 'addon';
      if (idf === 'core' || /home assistant core/.test(s)) return 'core';
      if (/^os$/i.test(idf) || /operating system/.test(s)) return 'os';
      if (idf === 'supervisor' || /supervisor/.test(s)) return 'sup';
      if (idf === 'host' || /home assistant host/.test(s)) return 'host';
      return 'addon';
    };
    const verOf = (liste) => { const e = liste.find((x) => dom(x.entity_id) === 'sensor' && /_version$/.test(obj(x.entity_id)) && !/(newest|latest)/.test(obj(x.entity_id))); return e && e.entity_id; };
    for (const [dev, liste] of Object.entries(per)) {
      const k = kind(dev), d = D[dev] || {}, f = (re, dm) => finn(liste, re, dm);
      const base = { dev, cpu: f(/cpu_percent$/, 'sensor'), mem: f(/memory_percent$/, 'sensor'), ver: verOf(liste), upd: f(/./, 'update') };
      if (k === 'addon') {
        const idf = ((d.identifiers || []).find((x) => x[0] === 'hassio') || [])[1] || null;
        R.addons.push({ ...base, slug: idf, navn: d.name_by_user || d.name || tittel(idf || 'Tillegg'), run: f(/_running$/, 'binary_sensor'), sw: f(/./, 'switch') });
      } else R[k] = { ...base, diskUsed: f(/disk_used$/, 'sensor'), diskTot: f(/disk_total$/, 'sensor'), diskFree: f(/disk_free$/, 'sensor') };
    }
    // Supervisor-listen (WS) er sannheten for hvilke tillegg som er installert – entitetene gir målinger/historikk
    if (Array.isArray(SUP.addons)) {
      SUP.addons.forEach((a) => {
        let x = R.addons.find((y) => (y.slug && y.slug === a.slug) || (!y.slug && y.navn.toLowerCase() === String(a.name || '').toLowerCase()));
        if (!x) { x = { slug: a.slug, navn: a.name || a.slug }; R.addons.push(x); }
        x.slug = x.slug || a.slug; x.sup = a; if (a.name) x.navn = a.name;
      });
    }
    const ex = new Set(cfg.exclude || []);
    R.addons = R.addons.filter((a) => !ex.has(a.run) && !ex.has(a.sw) && !ex.has(a.upd)).sort((a, b) => a.navn.localeCompare(b.navn, 'nb'));
    const sm = (re, pct) => { const e = sysm.find((x) => dom(x.entity_id) === 'sensor' && re.test(obj(x.entity_id)) && (!pct || unitOf(hass, x.entity_id) === '%')); return e && e.entity_id; };
    R.sys = {
      cpu: sm(/processor_use$/) || R.core.cpu,
      mem: sm(/memory_(use_percent|usage)$/, true) || R.core.mem,
      disk: sm(/disk_(use_percent|usage)(_|$)/, true),
      uptime: (upt.find((e) => dom(e.entity_id) === 'sensor') || {}).entity_id || sm(/last_boot$/),
      db: Object.keys(S).find((id) => id.startsWith('sensor.') && /(database|db|recorder)_size$/.test(obj(id))),
    };
    HMEMO = { E, D, S, sk, t: SUP.t, sig, R };
    return R;
  }
  function oppdagHAPeek(hass, cfg) {
    if (!HMEMO || !hass) return null;
    return HMEMO.E === (hass.entities || {}) && HMEMO.D === (hass.devices || {}) && (HMEMO.S === hass.states || HMEMO.sk === sKey(hass.states)) && HMEMO.t === SUP.t && HMEMO.sig === JSON.stringify(cfg.exclude || []) ? HMEMO.R : null;
  }
  // 24 t-serier per entitet (samplet) – delt mellom kortinstansene (Bubble lager kortet på nytt ved hver åpning)
  const HIST = {};

  /* ------------------------------------------------------------ Fiks 50 E/G: qBittorrent + SpeedTest (autokonfig fra registeret) */
  // Entitetene finnes via plattform (qbittorrent / speedtestdotnet) + translation_key (eller unique_id-suffiks
  // «<entry_id>-<nøkkel>») – objekt-ID-mønsteret er bare reserve. Overstyres per nøkkel i overrides.<qbit_*|speedtest_*>.
  // [nøkkel i kortet, override-nøkkel, domene, translation_key/unique_id-nøkler, reserve-mønster for objekt-ID]
  const QB = [
    // rekkefølgen er søkerekkefølgen: spesifikke nøkler først (grense før fart, inaktive før aktive, tilkobling før status)
    ['downLim', 'qbit_down_limit', 'sensor', ['download_speed_limit', 'dl_limit'], /download_speed_limit$/],
    ['upLim', 'qbit_up_limit', 'sensor', ['upload_speed_limit', 'up_limit'], /upload_speed_limit$/],
    ['down', 'qbit_down', 'sensor', ['download_speed', 'dlspeed'], /download_speed$/],
    ['up', 'qbit_up', 'sensor', ['upload_speed', 'upspeed'], /upload_speed$/],
    ['inactive', 'qbit_inactive', 'sensor', ['inactive_torrents'], /inactive_torrents$/],
    ['active', 'qbit_active', 'sensor', ['active_torrents'], /(^|_)active_torrents$/],
    ['paused', 'qbit_paused', 'sensor', ['paused_torrents'], /paused_torrents$/],
    ['errored', 'qbit_errored', 'sensor', ['errored_torrents'], /errored_torrents$/],
    ['all', 'qbit_all', 'sensor', ['all_torrents', 'total_torrents'], /(all|total)_torrents$/],
    ['dlTot', 'qbit_dl_total', 'sensor', ['alltime_download', 'all_time_download', 'alltime_dl'], /all_?time_download$/],
    ['ulTot', 'qbit_ul_total', 'sensor', ['alltime_upload', 'all_time_upload', 'alltime_ul'], /all_?time_upload$/],
    ['ratio', 'qbit_ratio', 'sensor', ['global_ratio'], /(global_)?ratio$/],
    ['conn', 'qbit_conn', 'sensor', ['connection_status'], /connection_status$/],
    ['status', 'qbit_status', 'sensor', ['current_status', 'status'], /(^|_)(current_)?status$/],
    ['alt', 'qbit_alt', 'switch', ['alternative_speed', 'alt_speed'], /alt(ernative)?_speed/],
  ];
  const ST_K = [
    ['down', 'speedtest_down', 'sensor', ['download'], /download$/],
    ['up', 'speedtest_up', 'sensor', ['upload'], /upload$/],
    ['ping', 'speedtest_ping', 'sensor', ['ping'], /ping$/],
  ];
  // Velg entitet for én nøkkel i en kandidatliste: translation_key → unique_id-suffiks → objekt-ID-mønster
  const pickKey = (liste, [, , d, tks, re], taken) => {
    const L = liste.filter((e) => dom(e.entity_id) === d && !taken.has(e.entity_id));
    const uid = (e) => String(e.unique_id || '');
    const x = L.find((e) => e.translation_key && tks.includes(e.translation_key))
      || L.find((e) => tks.some((k) => uid(e).endsWith('-' + k) || uid(e).endsWith('_' + k)))
      || L.find((e) => re.test(obj(e.entity_id)));
    return x ? x.entity_id : undefined;
  };
  // Nøklene i listens rekkefølge; en entitet brukes bare én gang
  function pickAll(liste, K) {
    const out = {}, taken = new Set();
    K.forEach((k) => { const id = pickKey(liste, k, taken); if (id) { out[k[0]] = id; taken.add(id); } });
    return out;
  }
  const regPool = (hass, plats) => Object.values(hass.entities || {}).filter((e) => e && plats.includes(e.platform) && !e.disabled_by && hass.states[e.entity_id]);
  const QB_L = { down: 'Hastighet ned', up: 'Hastighet opp', downLim: 'Grense ned', upLim: 'Grense opp', active: 'Aktive torrenter', inactive: 'Inaktive torrenter', paused: 'Pausede torrenter',
    errored: 'Torrenter med feil', all: 'Alle torrenter', dlTot: 'Totalt lastet ned', ulTot: 'Totalt lastet opp', ratio: 'Ratio', conn: 'Tilkoblingsstatus', status: 'Status', alt: 'Alternativ hastighet (bryter)' };
  let QMEMO = null;
  // qBittorrent: { found, auto: {nøkkel → id}, ids: {nøkkel → id (med overrides)} }
  function oppdagQB(hass, cfg) {
    cfg = cfg || {};
    const E = hass.entities || {}, S = hass.states, o = cfg.overrides || {}, sig = JSON.stringify(QB.map((k) => o[k[1]] || ''));
    const sk = sKey(S);
    if (QMEMO && QMEMO.E === E && (QMEMO.S === S || QMEMO.sk === sk) && QMEMO.sig === sig) return QMEMO.R;
    const pool = regPool(hass, ['qbittorrent']);
    // flere qBittorrent-servere: den første enheten (stabil rekkefølge)
    const devs = [...new Set(pool.map((e) => e.device_id || '_'))].sort();
    const liste = devs.length > 1 ? pool.filter((e) => (e.device_id || '_') === devs[0]) : pool;
    const auto = pickAll(liste, QB), ids = {};
    QB.forEach(([k, ok_]) => { ids[k] = o[ok_] || auto[k]; });
    const R = { found: pool.length > 0 || QB.some((k) => !!o[k[1]]), auto, ids, n: pool.length };
    QMEMO = { E, S, sk, sig, R };
    return R;
  }
  let SMEMO = null;
  // SpeedTest (speedtestdotnet): { found, auto, ids } – reserve: sensor.speedtest*_download/_upload/_ping (mønster, ikke ID)
  function oppdagST(hass, cfg) {
    cfg = cfg || {};
    const E = hass.entities || {}, S = hass.states, o = cfg.overrides || {}, sig = JSON.stringify(ST_K.map((k) => o[k[1]] || ''));
    const sk = sKey(S);
    if (SMEMO && SMEMO.E === E && (SMEMO.S === S || SMEMO.sk === sk) && SMEMO.sig === sig) return SMEMO.R;
    let liste = regPool(hass, ['speedtestdotnet']);
    if (!liste.length) liste = Object.keys(S).filter((id) => /^sensor\.speed_?test(_[a-z0-9]+)*_(download|upload|ping)$/.test(id)).map((id) => E[id] || { entity_id: id });
    const auto = pickAll(liste, ST_K), ids = {};
    ST_K.forEach(([k, ok_]) => { ids[k] = o[ok_] || auto[k]; });
    const R = { found: Object.values(ids).some(Boolean), auto, ids };
    SMEMO = { E, S, sk, sig, R };
    return R;
  }
  // Datahastighet → MB/s (qBittorrent: B/s, KiB/s, kB/s, MB/s, MiB/s …; bit-enheter / 8)
  const mbsF = (u) => {
    const r = String(u || '').replace(/\s/g, '');
    if (!r) return 1;
    const l = r.toLowerCase();
    if (/bit|bps/.test(l)) return rateF(r) / 8; // Mbit/s-faktoren / 8
    const p = /^gi/.test(l) ? 1073.741824 : /^g/.test(l) ? 1000 : /^mi/.test(l) ? 1.048576 : /^m/.test(l) ? 1 : /^ki/.test(l) ? 0.001024 : /^k/.test(l) ? 0.001 : /^b/.test(l) ? 1e-6 : 1;
    return p;
  };
  // Datamengde → byte (B, kB, KiB, MB, MiB, GB, GiB, TB, TiB, PB, PiB)
  const bytesF = (u) => {
    const l = String(u || '').replace(/\s/g, '').toLowerCase();
    const P = { k: 1, m: 2, g: 3, t: 4, p: 5 }, c = l[0];
    if (!l || !P[c]) return 1;
    return Math.pow(l[1] === 'i' ? 1024 : 1000, P[c]);
  };
  const mbTxt = (v) => M.nf(v, v < 10 ? 1 : 0).replace(/,0$/, ''); // fartsgrense: «5 MB/s», «0,5 MB/s»
  const sig3 = (v) => (v >= 100 ? 0 : v >= 10 ? 1 : 2);
  const sizeOf = (b) => {
    if (b == null || isNaN(b)) return '–';
    const T = [[1e15, 'PB'], [1e12, 'TB'], [1e9, 'GB'], [1e6, 'MB'], [1e3, 'kB']].find(([f]) => b >= f) || [1, 'B'];
    const v = b / T[0];
    return `${M.nf(v, sig3(v)).replace(/,0+$/, '')} ${T[1]}`;
  };
  const MND = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des'];
  // «14:10» (i dag) · «i går 22:10» · «3. okt»
  const maltTxt = (iso, now) => {
    const t = new Date(iso); if (isNaN(t)) return '–';
    now = now || new Date();
    const hm = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
    const day = (y, m, d) => new Date(y, m, d).getTime(), dt = day(t.getFullYear(), t.getMonth(), t.getDate());
    if (dt === day(now.getFullYear(), now.getMonth(), now.getDate())) return hm;
    if (dt === day(now.getFullYear(), now.getMonth(), now.getDate() - 1)) return `i går ${hm}`;
    return `${t.getDate()}. ${MND[t.getMonth()]}`;
  };

  /* ------------------------------------------------------------ config: verter */
  function tabsCfg(c) {
    const T = c.tabs && !Array.isArray(c.tabs) ? c.tabs : {}; // v5: tabs { order, hidden, start }
    const mapK = (k) => (k === 'unifi' ? 'net' : k);
    const src = Array.isArray(c.tab_order) ? c.tab_order : (T.order || (Array.isArray(c.tabs) ? c.tabs : []));
    const o = src.map(mapK).filter((k, i, a) => KEYS.includes(k) && a.indexOf(k) === i);
    KEYS.forEach((k) => { if (!o.includes(k)) o.push(k); });
    const hidden = (Array.isArray(c.hidden_tabs) ? c.hidden_tabs : (T.hidden || c.tabs_hidden || [])).map(mapK).filter((k) => KEYS.includes(k));
    return { order: o, hidden, start: mapK(c.start_tab != null ? c.start_tab : (T.start || c.start_tab || '')) };
  }
  // 36.5: startfane (felles MSH.startTab): start_tab | 'last'; gamle tabs.start leses, '' (gammel «Sist brukt») = 'last'
  const ST_LEG = { legacy: (c) => (c.start_tab === '' ? 'last' : c.tabs && !Array.isArray(c.tabs) && c.tabs.start ? c.tabs.start : undefined), map: (k) => (k === 'unifi' ? 'net' : k) };
  // Fiks 50 E: qBittorrent-fanen skjules automatisk når integrasjonen mangler (ingen entiteter/overstyringer), med mindre
  // qbit_force (Tilpass → Faner: «Vis qBittorrent-fanen selv om integrasjonen mangler»). hass: kortets, ellers MSH.lastHass.
  const qbitOff = (c, h) => { h = h || M.lastHass; return !c.qbit_force && !(h && h.states && oppdagQB(h, c).found); };
  // Fiks 62: arildkristo.com vises bare når Cloudflare-sensorene finnes (58c-server-cf.js)
  const cfOff = (c, h) => { h = h || M.lastHass; return !(M.serverCF && h && h.states && M.serverCF.discover(h, c).found); };
  function visTabs(c, h) { const T = tabsCfg(c), qo = qbitOff(c, h), co = cfOff(c, h), V = T.order.filter((k) => !T.hidden.includes(k) && !(k === 'qbit' && qo) && !(k === 'cf' && co)); return V.length ? V : [T.order[0]]; }
  // 33.4: felles fanehøyde (MSH.tabH, 05-tab-bar.js): kortets tab_height (28–64) → global «Fanehøyde i popups» → designets 44
  const tabH = (c) => (M.tabH ? M.tabH.height(c, 44) : 44);
  const TV = (k, n) => (M.tabH ? M.tabH.v(k, n) : n + 'px');
  const thVars = (c) => `${M.tabH ? M.tabH.style(c) : ''}--sv-th:${TV('th', 44)};`;
  const isCards = (c) => /^kort$/i.test(String(c.velger || ''));
  // Fiks 52 A3: høyden på prosa (p) og fane-innhold (b) per kort/vert/underfane fra forrige fulle tegning – skjelettet
  // reserverer den, så innholdet ikke hopper når det kommer. Minne + localStorage (per enhet, ren UI-cache).
  const SKH_LS = 'ki:sv-skh';
  let SKH = null;
  const skhAll = () => { if (!SKH) { try { SKH = JSON.parse(localStorage.getItem(SKH_LS) || '{}') || {}; } catch (e) { SKH = {}; } } return SKH; };
  const skhKey = (card, host, sub) => `${(card.config && card.config.card_id) || '_'}|${host}|${sub}`;
  const skhGet = (card, host, sub) => { const x = skhAll()[skhKey(card, host, sub)] || {}; return { p: x.p > 0 ? x.p : 61, b: x.b > 0 ? x.b : 420 }; };
  function skhSet(card, host, sub, p, b) {
    const A = skhAll(), k = skhKey(card, host, sub), o = A[k] || {};
    p = Math.round(p); b = Math.round(b);
    if (o.p === p && o.b === b) return;
    A[k] = { p, b };
    const ks = Object.keys(A); if (ks.length > 60) delete A[ks[0]];
    try { localStorage.setItem(SKH_LS, JSON.stringify(A)); } catch (e) { /* */ }
  }
  const showProse = (c) => c.show_prose !== false;

  /* ------------------------------------------------------------ integrasjonsvelger (portalt ark – fallgruve 1) */
  function openPick(hass, cfg, k, onApply) {
    const I = INT[k], L = entriesFor(hass, k), au = autoEntry(hass, k);
    const cur0 = (cfg.integrations || {})[k];
    let cur = cur0 === 'none' ? 'none' : cur0 || (au ? au.entry_id : 'none');
    const api = M.overlay({ maxWidth: 520, guard: 300, tilpass: true, css: `
      .ph{display:flex;align-items:center;gap:12px;padding:4px 0 6px}.ph h2{flex:1;margin:0;font-size:22px;font-weight:600;color:var(--ki-text, #fafafa)}
      .done{${M.DONE_PILL}color:var(--ki-on-accent, #2f2f2f)}
      .sub{margin:0 0 12px;font-size:13px;color:var(--ki-text-mid, #979797)}
      .lst{display:flex;flex-direction:column;gap:8px}
      .rr{display:flex;align-items:center;gap:12px;width:100%;min-height:60px;padding:8px 14px;border-radius:22px;background:var(--ki-surface, #3a3a3a);text-align:left;color:var(--ki-text, #fafafa)}
      .rr b{font-size:14px;font-weight:500}.rr .col>span{font-size:12px;color:var(--ki-text-mid, #979797)}
      .rd{width:22px;height:22px;border-radius:11px;flex:none;box-shadow:inset 0 0 0 2px var(--ki-text-3, #7f7f7f);display:grid;place-items:center}
      .rr.on .rd{box-shadow:inset 0 0 0 2px ${PK}}.rr.on .rd::after{content:'';width:12px;height:12px;border-radius:6px;background:${PK}}
      .auto{height:22px;padding:0 9px;border-radius:11px;background:${tone(GR, 0.18)};color:${TX.green};font-size:11px;font-weight:600;display:inline-flex;align-items:center;flex:none}
      .none{padding:14px;border-radius:22px;background:var(--ki-surface, #3a3a3a);color:var(--ki-text-mid, #979797);font-size:13px}
      .add{margin-top:12px;height:48px;width:100%;border-radius:24px;background:var(--ki-surface-2, #404040);color:var(--ki-text, #fafafa);font-size:14px;font-weight:500;display:flex;align-items:center;justify-content:center;gap:8px}`, html: '' });
    const draw = () => {
      api.body.innerHTML = `<div class="ph"><h2>Velg integrasjon</h2><button class="done" data-p="apply">Bruk</button></div>
        <p class="sub">${esc(I.name)}${k === 'unraid' ? ' · Glances kan brukes som reserve (bare målinger)' : ''}</p>
        <div class="lst" role="radiogroup">${L.length ? L.map((x) => `<button class="rr${cur === x.entry_id ? ' on' : ''}" role="radio" aria-checked="${cur === x.entry_id}" data-p="sel" data-v="${esc(x.entry_id)}"><span class="rd"></span><span class="grow col"><b class="ell">${esc(x.title)}</b><span class="ell">${esc(x.domain === 'glances' ? 'Glances' : I.name)} · ${x.count} entiteter</span></span>${au && au.entry_id === x.entry_id ? '<span class="auto">Auto</span>' : ''}</button>`).join('') : `<div class="none">Fant ingen ${esc(I.name)}-integrasjon i Home Assistant.</div>`}
        <button class="rr${cur === 'none' ? ' on' : ''}" role="radio" aria-checked="${cur === 'none'}" data-p="sel" data-v="none"><span class="rd"></span><span class="grow col"><b>Ingen</b><span>Skjul ${esc(I.name)} i Server</span></span></button></div>
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

  /* ------------------------------------------------------------ bekreftelse (host.confirm, Fiks 50) – portalt ark (fallgruve 1) */
  // confirmSheet(tekst, { ok: 'Slå av', hot: true }) → Promise<bool>. Esc/bakteppe = avbryt.
  function confirmSheet(text, o) {
    o = o || {};
    if (!M.overlay) return Promise.resolve(window.confirm(text));
    return new Promise((res) => {
      let done = false;
      const fin = (v) => { if (done) return; done = true; res(v); };
      const hot = o.hot !== false;
      const api = M.overlay({ center: true, maxWidth: 360, guard: 300, onClose: () => fin(false), css: `
        .cf{display:flex;flex-direction:column;gap:16px;padding:6px 2px 2px}
        .cf p{margin:0;font-size:16px;line-height:1.45;color:var(--ki-text, #fafafa);text-wrap:pretty}
        .cfb{display:grid;grid-template-columns:1fr 1fr;gap:8px}
        .cfb button{height:48px;border-radius:24px;font-size:15px;font-weight:600;border:0;cursor:pointer}
        .no{background:var(--ki-surface-2, #404040);color:var(--ki-text, #fafafa)}
        .yes{background:${hot ? tone(RD, 0.2) : C.accent};color:${hot ? TX.red : 'var(--ki-on-accent, #2f2f2f)'}}`,
        html: `<div class="cf"><p>${esc(text)}</p><div class="cfb"><button class="no" data-c="0">${esc(o.cancel || 'Avbryt')}</button><button class="yes" data-c="1">${esc(o.ok || 'Bekreft')}</button></div></div>` });
      api.body.addEventListener('click', (e) => {
        const b = e.target.closest && e.target.closest('[data-c]'); if (!b) return;
        const v = b.dataset.c === '1';
        M.haptic(v ? (hot ? 'heavy' : 'success') : 'light');
        fin(v); api.close();
      });
    });
  }
  M.serverConfirm = confirmSheet;

  /* ------------------------------------------------------------ vertvelgeren (kortet + forhåndsvisningen i Tilpass) */
  // Fiks 50 F: fanelinjen er en vannrett karusell (designet: pickTabs/tabStop/fadeTabs) – sporet (.tbox) er uendret pille,
  // scrolleren (.tabs) har padding 4, scroll-snap, skjult scrollbar og fade bare på siden med skjult innhold.
  // Fiks 62: ikon (18 px, 6 px mellomrom, følger tekstfargen) foran navnet · tab_mode alle | aktiv (bare valgt fane har navn) |
  // ikon (bare ikoner). En fane med bare ikon: min-bredde fanehøyde + 8, padding 0 12px, title = navnet.
  // ikonet følger fanehøyden (MSH.tabH 'ti', 33.4) – 18 px ved standard 44
  const TB_IC = `--mdc-icon-size:${TV('ti', 18)};width:${TV('ti', 18)};height:${TV('ti', 18)}`;
  const hostName = (k) => `<span class="tbn"${k === 'cf' ? ' data-noi18n' : ''}>${esc(HOSTL[k][1])}</span>`;
  const tabRowHTML = (V, act, attrs, c) => { const md = tabMode(c); return `<div class="trow"><div class="tbox"><div class="tabs" role="tablist" data-mode="${md}">${V.map((k) => { const on = k === act, nm = md === 'alle' || (md === 'aktiv' && on); return `<button class="tb${on ? ' on' : ''}${nm ? '' : ' io'}" role="tab" aria-selected="${on}" data-v="${k}" title="${esc(HOSTL[k][1])}"${nm ? '' : ` aria-label="${esc(HOSTL[k][1])}"`} ${attrs ? attrs(k) : ''}>${M.icon(hostIcon(c, k), 18, TB_IC)}${nm ? hostName(k) : ''}</button>`; }).join('')}</div></div>
    <button class="gear" ${attrs ? 'data-act="customize"' : ''} aria-label="Tilpass Server" title="Tilpass">${M.icon('mdi:cog', 22)}</button></div>`; };
  // Kort-variant: ring (CPU-/ned-last) + statusprikk + navn + undertekst. X: { [k]: { pct, col, ok, none, sub } }
  const ringDash = (p) => `${((M.clamp(p || 0, 0, 100) / 100) * 106.8).toFixed(1)} 106.8`;
  const hostCardsHTML = (V, act, X, attrs, c) => `<div class="hcards">${V.map((k) => {
    const x = X[k] || {}, on = k === act;
    return `<button class="hc${on ? ' on' : ''}" data-v="${k}" data-key="hc-${k}" ${attrs ? attrs(k) : ''} aria-pressed="${on}">
      <span class="hct"><span class="ring"><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17" class="rtr"></circle><circle cx="20" cy="20" r="17" class="rfl" style="stroke:${x.none ? 'transparent' : x.ok ? x.col : OR}" stroke-dasharray="${ringDash(x.pct)}"></circle></svg>${M.icon(hostIcon(c, k), 18)}</span><span class="dot ${x.none ? 'none' : x.ok ? 'ok' : 'warn'}"></span></span>
      <span class="hcb"><b class="ell"${k === 'cf' ? ' data-noi18n' : ''}>${esc(HOSTL[k][1])}</b><span class="ell num">${esc(x.sub || '–')}</span></span></button>`;
  }).join('')}</div>`;
  const PREV_CSS = () => `.svp{padding:14px 12px;border-radius:24px;background:var(--ki-popup, #282828);display:flex;flex-direction:column;gap:10px}
    .svp .tl{font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--ki-text-3, #7f7f7f);margin:0 4px}.svp button{pointer-events:none}
    ${TAB_CSS('.svp')}`;
  const TAB_CSS = (pre) => `${pre} .trow{display:flex;align-items:center;gap:8px;min-width:0}
    ${pre} .tbox{flex:1;min-width:0;border-radius:999px;background:var(--ki-surface, #3a3a3a);box-shadow:inset 0 0 0 1px var(--ki-line, rgba(255,255,255,0.05));overflow:hidden}
    ${pre} .tabs{display:flex;gap:2px;padding:4px;min-width:0;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x proximity;scrollbar-width:none;touch-action:pan-x pan-y;overscroll-behavior-x:contain}
    ${pre} .tabs::-webkit-scrollbar,${pre} .hcards::-webkit-scrollbar{display:none}
    ${pre} .tb{flex:1 0 auto;min-width:84px;height:var(--sv-th,44px);padding:0 16px;scroll-snap-align:center;border-radius:999px;display:flex;align-items:center;justify-content:center;gap:6px;font-size:${TV('tf', 14)};font-weight:500;white-space:nowrap;color:var(--ki-text-2, #c7c7c7);transition:background .2s,color .2s}
    ${pre} .tb.on{background:${C.accent};color:var(--ki-on-accent, #3a3a3a)}
    ${pre} .tb.io{min-width:calc(var(--sv-th,44px) + 8px);padding:0 12px}
    ${pre} .tb ha-icon{color:currentColor}
    ${pre} .gear{width:calc(var(--sv-th,44px) + 8px);height:calc(var(--sv-th,44px) + 8px);border-radius:999px;flex:none;display:grid;place-items:center;background:var(--ki-surface, #3a3a3a);box-shadow:inset 0 0 0 1px var(--ki-line, rgba(255,255,255,0.05));color:var(--ki-text, #fafafa)}
    ${pre} .gear:active{transform:scale(.92)}
    ${pre} .hcards{display:flex;gap:8px;min-width:0;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x proximity;scrollbar-width:none;touch-action:pan-x pan-y;overscroll-behavior-x:contain}
    ${pre} .hc{flex:1 0 140px;min-width:140px;scroll-snap-align:center;display:flex;flex-direction:column;align-items:flex-start;gap:12px;padding:12px;border-radius:24px;background:var(--ki-surface, #3a3a3a);box-shadow:inset 0 0 0 1px var(--ki-line, rgba(255,255,255,0.05));transition:background .2s,box-shadow .2s,transform .12s;text-align:left}
    ${pre} .hc:active{transform:scale(.97)}
    ${pre} .hc.on{background:var(--ki-surface-2, #404040);box-shadow:inset 0 0 0 1.5px ${PK}}
    ${pre} .hct{display:flex;align-items:center;justify-content:space-between;width:100%}
    ${pre} .ring{position:relative;width:40px;height:40px;flex:none;display:grid;place-items:center;color:var(--ki-text-1, #e1e1e1)}
    ${pre} .ring svg{position:absolute;inset:0;width:40px;height:40px;transform:rotate(-90deg)}
    ${pre} .ring circle{fill:none;stroke-width:3}${pre} .ring .rtr{stroke:var(--ki-line, rgba(255,255,255,0.08))}${pre} .ring .rfl{stroke-linecap:round}
    ${pre} .dot{width:8px;height:8px;border-radius:4px;flex:none}
    ${pre} .dot.ok{background:${GR};box-shadow:0 0 0 3px ${M.alpha(GR, 0.2)}}${pre} .dot.warn{background:${OR};box-shadow:0 0 0 3px ${M.alpha(OR, 0.2)}}${pre} .dot.none{background:var(--ki-ctrl, #545454)}
    ${pre} .hcb{display:flex;flex-direction:column;gap:1px;min-width:0;width:100%}${pre} .hcb b{font-size:14px;font-weight:600}${pre} .hcb>span{font-size:12px;color:var(--ki-text-mid, #979797)}`;

  /* ------------------------------------------------------------ Fiks 62: «Tilpass server»-arket (designet: cu) */
  // Arket ligger øverst i popupen (top 12 px under popupens toppkant), radius 32, #2f2f2f-flate, liste #3a3a3a, utvidet rad #404040
  const TP_CSS = () => `.sh{top:var(--sv-tp-top,12px);bottom:auto;left:calc(var(--ki-rail-x,0px) + 8px);right:8px;max-width:440px;border-radius:32px;padding:16px 14px;
      max-height:calc(100% - var(--sv-tp-top,12px) - 16px);background:var(--ki-popup, #2f2f2f);box-shadow:0 16px 48px ${M.theme.blackA(0.5)};transform:translate3d(0,-10px,0)}
    :host(.on) .sh{transform:translate3d(0,0,0)}
    .body{gap:14px}
    .tph{display:flex;align-items:center;gap:10px;padding:0 4px}.tt{flex:1;font-size:20px;font-weight:600;letter-spacing:-0.02em}
    .x{width:44px;height:44px;border-radius:22px;background:var(--ki-surface-2, #404040);display:grid;place-items:center;color:var(--ki-text, #fafafa)}
    .grp{display:flex;flex-direction:column;gap:8px}.gl{padding:0 4px;font-size:13px;color:var(--ki-text-2, #afafaf)}
    .mds{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
    .md{display:flex;flex-direction:column;align-items:center;gap:8px;padding:12px 6px;border-radius:20px;min-width:0;background:var(--ki-surface, #3a3a3a);color:var(--ki-text-1, #e1e1e1);transition:background .2s,color .2s}
    .md:active,.io:active{transform:scale(.95)}
    .md.on{background:${C.accent};color:var(--ki-on-accent, #3a3a3a)}
    .dm{display:flex;align-items:center;gap:3px;height:28px}
    .dmi{display:inline-flex;align-items:center;gap:3px;height:22px;padding:0 6px;border-radius:11px;color:var(--ki-text-1, #c7c7c7)}
    .dmi i{width:14px;height:3px;border-radius:2px;background:currentColor;opacity:.7}
    .md .dmi.a{background:var(--ki-text, #fafafa);color:var(--ki-popup, #282828)}
    .md.on .dmi{color:var(--ki-on-accent, #3a3a3a)}.md.on .dmi.a{background:var(--ki-on-accent, #3a3a3a);color:var(--ki-text, #fafafa)}
    .ml{font-size:12px;font-weight:600;text-align:center;line-height:1.25}
    .hl{display:flex;flex-direction:column;gap:4px;border-radius:22px;background:var(--ki-surface, #3a3a3a);padding:4px}
    .hr{border-radius:18px;transition:background .2s}.hr.open{background:var(--ki-surface-2, #404040)}
    .hb{display:flex;align-items:center;gap:12px;min-height:56px;width:100%;padding:0 12px 0 8px;box-sizing:border-box;text-align:left;color:var(--ki-text, #fafafa)}
    .hb>ha-icon:last-child{transition:transform .2s}.hr.open .hb>ha-icon:last-child{transform:rotate(180deg)}
    .hi{width:40px;height:40px;border-radius:20px;flex:none;display:grid;place-items:center;background:var(--ki-text, #fafafa);color:var(--ki-popup, #282828)}
    .hn{flex:1;min-width:0;font-size:14px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .rs{font-size:12px;color:var(--ki-text-mid, #979797);padding:6px 8px}
    .ig{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px;padding:4px 8px 12px;animation:tpf .2s ease}
    .io{aspect-ratio:1;min-width:0;border-radius:14px;display:grid;place-items:center;background:var(--ki-surface-3, #2f2f2f);color:var(--ki-text-1, #e1e1e1)}
    .io.on{background:${C.accent};color:var(--ki-on-accent, #3a3a3a)}
    .more{display:flex;align-items:center;gap:12px;min-height:52px;padding:0 14px;border-radius:22px;background:var(--ki-surface, #3a3a3a);color:var(--ki-text, #fafafa);text-align:left;font-size:14px;font-weight:500}
    .more span{flex:1}
    @keyframes tpf{from{opacity:0}to{opacity:1}}`;

  /* ------------------------------------------------------------ «Tilpass Server» (= GUI-editoren, samme skjema) */
  const intStatus = (hh, cc, k) => {
    if (!hh) return ['–', 'var(--ki-text-mid, #979797)'];
    const R = oppdag(hh, cc), s = (cc.integrations || {})[k], n = R.ents[k].length;
    if (s === 'none') return ['Slått av (Ingen) · trykk for å velge', 'var(--ki-text-mid, #979797)'];
    if (s) return [`Valgt manuelt · ${n} entiteter`, 'var(--ki-text, #fafafa)'];
    if (R.found[k]) return [`Funnet automatisk · ${n} entiteter${k === 'unraid' && R.unraid && R.unraid.glances ? ' (Glances)' : ''}`, TX.green];
    return [R.loading ? 'Leter …' : 'Ikke funnet · trykk for å velge', TX.orange];
  };
  const autoOf = (h, c, fnc) => { if (!h) return null; try { return fnc(oppdag(h, c || {}), oppdagHA(h, c || {})) || null; } catch (e) { return null; } };

  function editorSchema(h, c) {
    c = c || {};
    const preview = { type: 'html', html: (hh, cc, key, ed) => {
      if (ed && !ed.__svInst) { ed.__svInst = true; window.addEventListener('msh-server-entries', () => { if (ed.isConnected && ed._render) ed._render(); }); }
      const V = visTabs(cc, hh), act = (M.startTab ? M.startTab.pillKey(cc, V, ST_LEG) : null) || V[0]; // 36.5: forhåndsvisningen viser startfanen
      return `<style>${PREV_CSS()}</style><div class="svp" data-key="svp" aria-hidden="true" style="${thVars(cc)}"><div class="tl">Forhåndsvisning</div>${isCards(cc) ? hostCardsHTML(V, act, {}, null, cc) : tabRowHTML(V, act, null, cc)}</div>`;
    } };
    const ints = { type: 'html', html: (hh, cc, key) => `<div class="f" style="gap:8px;padding:0;background:none;box-shadow:none">${INTEG.map((I) => {
      const [txt, col] = intStatus(hh, cc, I.key);
      return `<button data-a="fn" data-k="${key}" data-op="int" data-v="${I.key}" data-key="svi-${I.key}" style="min-height:60px;border-radius:28px;background:var(--ki-surface, #3a3a3a);display:flex;align-items:center;gap:12px;padding:8px 14px 8px 10px;text-align:left;width:100%">
        <span style="width:40px;height:40px;border-radius:20px;display:grid;place-items:center;flex:none;background:var(--ki-surface-2, #404040);color:${I.color}">${M.icon(I.icon, 20)}</span>
        <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px"><span style="font-size:14px;font-weight:500">${esc(I.name)}</span><span style="font-size:12px;color:${col}">${esc(txt)}</span></span>${M.icon('mdi:chevron-right', 20, 'color:var(--ki-text-3, #7f7f7f)')}</button>`;
    }).join('')}<span class="help">Home Assistant (HA-fanen) hentes alltid fra Supervisor og systemmonitor. Trykk for å velge en annen config entry, eller «Ingen».</span></div>`,
    click: (dd, ed) => { M.haptic('light'); openPick(ed._hass, ed._config || {}, dd.v, (v) => ed._set('integrations.' + dd.v, v)); } };
    // overrides.<nøkkel> med eget autovalg (qBittorrent / SpeedTest) – autovalget ignorerer overstyringen
    const entX = (name, label, fnc, extra) => ({ type: 'entity', name: 'overrides.' + name, label, domains: ['sensor'], auto: (hh, cc) => { if (!hh) return null; try { return fnc(hh, cc || {}) || null; } catch (e) { return null; } }, none_label: '– · Velg entitet', ...(extra || {}) });
    const ent = (name, label, fnc, extra) => ({ type: 'entity', name: 'overrides.' + name, label, domains: ['sensor'], auto: (hh, cc) => autoOf(hh, cc, fnc), none_label: '– · Velg entitet', ...(extra || {}) });
    const reset = { type: 'button', label: 'Tilbakestill til standard', icon: 'mdi:restore', run: (hh, cc, ed) => { M.haptic('warning'); const id = (cc && cc.card_id) || M.uid(); ed._config = { type: cc.type || 'custom:msh-server-card', card_id: id }; ed._set('card_id', id); } };
    const hostOpts = HOSTS.map((t) => [t[0], t[1]]);
    return [
      { type: 'tabs', id: 'server', tabs: [
        { key: 'visning', label: 'Visning', icon: 'mdi:eye-outline', focus: ['visning', 'velger'], fields: [
          { type: 'section', id: 'visning', label: 'Visning', icon: 'mdi:eye-outline', fields: [
            preview,
            { type: 'select', name: 'velger', label: 'Vertvelger', options: [['faner', 'Faner'], ['kort', 'Kort']], default: 'faner', help: 'Kort = to kolonner med last-ring og statusprikk. Tannhjulet ligger da i toppkortet.' },
            ...(M.tabH ? [M.tabH.field({ native: 44, preview: false })] : []), // 33.4: felles fanehøyde (forhåndsvisningen over følger valget)
            { type: 'select', name: 'tab_mode', label: 'Faner viser', options: [['alle', 'Ikon og navn'], ['aktiv', 'Navn på valgt fane'], ['ikon', 'Bare ikoner']], default: 'alle' }, // Fiks 62
            { type: 'boolean', name: 'show_prose', label: 'Setning under toppkortet', default: true },
          ] },
        ] },
        { key: 'faner', label: 'Faner', icon: 'mdi:tab', focus: ['tabs', 'faner', 'ikoner', 'host_icons'], fields: [
          { type: 'section', id: 'faner', label: 'Faner', icon: 'mdi:tab', fields: [
            ...(M.startTab ? [M.startTab.field({ legacy: ST_LEG, clear: ['tabs.start'], items: (hh, cc) => { const by = Object.fromEntries(hostOpts); return visTabs(cc || {}, hh).map((k) => ({ key: k, label: by[k] || k })); } })] : []), // 36.5: Startfane øverst
            preview,
            { type: 'order', name: 'tab_order', hiddenName: 'hidden_tabs', label: 'Rekkefølge', start: { legacy: ST_LEG, visible: (cc) => visTabs(cc) }, options: hostOpts,
              after: [{ type: 'boolean', name: 'qbit_force', label: 'Vis qBittorrent-fanen selv om integrasjonen mangler', default: false, help: 'Uten qBittorrent-integrasjonen skjules fanen automatisk.' }] },
            { type: 'info', label: 'Hold inne en fane i 0,4 s og dra for å endre rekkefølgen direkte i popupen.' },
          ] },
          // Fiks 62: «Ikon per server» – samme valg som i «Tilpass server»-arket (tannhjulet)
          { type: 'section', id: 'ikoner', label: 'Ikon per server', icon: 'mdi:emoticon-outline', fields: [
            { type: 'info', label: 'Trykk på tannhjulet ved fanene for å velge blant de 18 server-ikonene. Her kan du velge et hvilket som helst ikon.' },
            ...HOSTS.map(([k, l]) => ({ type: 'icon', name: 'host_icons.' + k, label: l, placeholder: icMdi(HOST_IC[k]) })),
          ] },
        ] },
        { key: 'toppkort', label: 'Toppkort', icon: 'mdi:chart-line', focus: ['toppkort'], fields: [
          { type: 'section', id: 'toppkort', label: 'Toppkort', icon: 'mdi:chart-line', fields: [
            ...HOSTS.map(([t, l]) => ({ type: 'select', name: 'hero_metric.' + t, label: `Standard måling · ${l}`, options: HM[t].map(([k, lb]) => [k, lb]), default: HM[t][0][0] })),
          ] },
        ] },
        { key: 'integrasjoner', label: 'Integrasjoner', icon: 'mdi:puzzle', focus: ['integrasjoner', 'integrations'], fields: [
          { type: 'section', id: 'integrasjoner', label: 'Integrasjoner', icon: 'mdi:puzzle', fields: [ints] },
        ] },
        { key: 'avansert', label: 'Avansert', icon: 'mdi:tune', focus: ['entities', 'overrides', 'spacing', 'advanced', 'avansert', 'speedtest', 'qbit', 'unifi'], fields: [
          { type: 'section', id: 'entities', label: 'Entiteter i toppkortet', icon: 'mdi:format-list-bulleted', fields: [
            { type: 'info', label: 'Alt er funnet automatisk. Velg en annen entitet bare der det automatiske valget er feil.' },
            ent('net_down', 'Nettverk · Ned', (RR) => (gateway(RR) || {}).rx), ent('net_up', 'Nettverk · Opp', (RR) => (gateway(RR) || {}).tx),
            ent('unifi_clients', 'Nettverk · Klienter', () => null),
            ent('proxmox_cpu', 'Proxmox · CPU', (RR) => (RR.proxmox.noder[0] || {}).cpu), ent('proxmox_mem', 'Proxmox · Minne', (RR) => (RR.proxmox.noder[0] || {}).mem), ent('proxmox_io', 'Proxmox · IO wait', (RR) => (RR.proxmox.noder[0] || {}).iowait),
            ent('unraid_cpu', 'Unraid · CPU', (RR) => (RR.unraid || {}).cpu), ent('unraid_ram', 'Unraid · Minne', (RR) => (RR.unraid || {}).ram), ent('unraid_temp', 'Unraid · CPU-temp', (RR) => (RR.unraid || {}).temp),
            ent('ha_cpu', 'HA · CPU', (RR, HH) => HH.sys.cpu), ent('ha_mem', 'HA · Minne', (RR, HH) => HH.sys.mem), ent('ha_disk', 'HA · Disk', (RR, HH) => HH.sys.disk),
            { type: 'entities', name: 'exclude', label: 'Skjul entiteter (rader og fliser)', help: 'Søk opp enheter, gjester, tillegg eller oppdateringer som ikke skal vises.' },
          ] },
          // Fiks 50 H–J: UniFi-enheter (rekkefølge/synlighet, PoE-budsjett) fra 58b-server-unifi.js – samme skjema i Tilpass og GUI
          ...(() => { const su = M.serverUnifi; if (!su || typeof su.editorFields !== 'function') return []; try { return su.editorFields(h, c) || []; } catch (e) { console.error('[ki-msh] serverUnifi.editorFields', e); return []; } })(),
          // Fiks 50 G: Internett-kortet (Nettverk → UDM) – SpeedTest-integrasjonen (speedtestdotnet)
          { type: 'section', id: 'speedtest', label: 'Internett (SpeedTest)', icon: 'mdi:speedometer', fields: [
            ...ST_K.map(([k, o]) => entX(o, { down: 'Ned (Mbit/s)', up: 'Opp (Mbit/s)', ping: 'Ping (ms)' }[k], (hh, cc) => oppdagST(hh, cc).auto[k])),
          ] },
          // Fiks 50 E: qBittorrent-fanen
          { type: 'section', id: 'qbit', label: 'qBittorrent', icon: 'mdi:download', fields: [
            { type: 'info', label: 'Funnet automatisk fra qBittorrent-integrasjonen. Velg en annen entitet bare der det automatiske valget er feil.' },
            ...QB.map(([k, o, d]) => entX(o, QB_L[k], (hh, cc) => oppdagQB(hh, cc).auto[k], d === 'switch' ? { domains: ['switch'] } : null)),
          ] },
          // Fiks 62: arildkristo.com (Cloudflare) – funnet via unique_id ki_arildkristo_*
          { type: 'section', id: 'cf', label: 'arildkristo.com (Cloudflare)', icon: 'mdi:web', fields: [
            { type: 'info', label: 'Funnet automatisk fra packages/ki_cloudflare.yaml (unique_id ki_arildkristo_*). Velg en annen entitet bare der det automatiske valget er feil.' },
            ...((M.serverCF && M.serverCF.ALL) || []).map(([k, , , l]) => entX('cf_' + k, l, (hh, cc) => M.serverCF.discover(hh, cc).auto[k])),
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
    static get uiPersist() { return ['host', 'sub', 'hm']; }
    get cardSize() { return 12; }
    constructor() {
      super();
      // Fiks 52 A3: config entries ('ce') påvirker oppdagelsen for integrasjonsvertene, Supervisor ('sup') bare HA-fanen.
      // Ingen tegning før popupen har satt seg (settle() tegner uansett).
      this._ce = (e) => {
        if (!this.isConnected || !this._settled) return;
        const src = e && e.detail && e.detail.src, host = this.tab;
        if ((src === 'sup' && host !== 'ha') || (src === 'ce' && (host === 'qbit' || host === 'cf'))) return;
        this.update();
      };
      this._hist = HIST; this._pend = {}; this._q = {}; this._flt = {}; this._armed = null; this._blink = {}; this._upd = {};
      this._settled = false; this._openGen = 0; this._paintKey = null; this._cfgV = 0;
    }
    connectedCallback() { super.connectedCallback(); window.addEventListener('msh-server-entries', this._ce); }
    disconnectedCallback() {
      super.disconnectedCallback(); window.removeEventListener('msh-server-entries', this._ce);
      if (this._pick) { this._pick.close(); this._pick = null; }
      this._holdStop();
    }
    setConfig(c) { this._cfgV = (this._cfgV || 0) + 1; super.setConfig(c); }
    /* ---------------------------------------------------------- Fiks 52 A3: åpning uten tung jobb under Bubble-animasjonen
     * Under åpne-animasjonen: høyst ÉN lett tegning (skjelett: fanelinje, toppkort/prosa – ekte verdier hvis forrige oppdagelse
     * fortsatt gjelder, ellers «–» – og fane-innholdet som flate med reservert høyde) – ingen hvis kortet allerede viser samme
     * fane. hass-oppdateringer tegner ikke. Når Bubbles åpning er ferdig (_whenSettled) «setter» kortet seg: full tegning av
     * aktiv fane (bare den – andre faner bygges når de velges), deretter oppslagene (config entries, Supervisor, 24 t historikk,
     * WAN-latens) – historikk oppdaterer bare grafen (_patch), ikke hele kortet. */
    onOpen() {
      const gen = ++this._openGen;
      this._settled = false; this._histSoon = false;
      this._cKey = null; // Fiks 50 F: aktiv fane sentreres (uten animasjon) når popupen åpnes
      this._whenSettled().then(() => {
        if (gen !== this._openGen || !this.isConnected || !this.isOpen) return;
        this._settle();
      });
    }
    _settle() {
      this._settled = true;
      CE.t = 0; entries(this.hass); // friske config entries når popupen åpnes
      supLoad(this.hass, true);
      this._histSoon = true; // 24 t historikk startes etter den fulle tegningen (afterRender)
      this.update();
    }
    onClose() { this._openGen++; this._settled = false; this._histSoon = false; if (this._pick) { this._pick.close(); this._pick = null; } this._holdStop(); }
    // Bubble bygger popupen og starter åpningen selv (klassene is-popup-opened + is-opening på .bubble-pop-up, overgang på
    // transform). Vi venter: rAF × 2 → til popupen er åpnet og is-opening er borte → rAF × 2 → til gjenværende overganger på
    // popup-elementet er ferdige. Uten Bubble-popup (vanlig kort, editor): bare rAF × 2. Maks 2 s uansett.
    // Fiks 55 A4: generalisert til MSH.whenPopupSettled (00-base.js) – samme regel (rAF × 2 → åpnet uten is-opening →
    // rAF × 2 → popup-elementets egne overganger ferdige, maks 2 s)
    _whenSettled() { return M.whenPopupSettled(this); }
    // Hva tegningen viser: vert/underfane/velger/config – samme nøkkel = DOM-en fra forrige åpning kan stå under animasjonen
    _viewKey() { return [this.tab, this._sub(this.tab), isCards(this.config) ? 'k' : 'f', this._cfgV].join('|'); }
    _render() {
      if (this._hass && this._config && !this._settled && this._firstRender && this._paintKey === this._viewKey()) return;
      super._render();
    }
    // Bare avhengighetene til AKTIV fane (registrert per tegning) – oppdateringer i skjulte faner gir ingen tegning.
    // Sammenligner state-objektene (HA lager nytt objekt ved endring) + last_updated/state som ekstra vern.
    _changed(o, n) {
      if (!this._settled) return false;
      if (o.areas !== n.areas || o.entities !== n.entities || o.devices !== n.devices) return true;
      if (o.states !== n.states && M.stateCount(o.states) !== M.stateCount(n.states)) return true;
      if (o.states === n.states) return false;
      for (const id of this._deps) {
        const a = o.states[id], b = n.states[id];
        if (a !== b && (!a || !b || a.last_updated !== b.last_updated || a.state !== b.state || a.attributes !== b.attributes)) return true;
      }
      return false;
    }
    get tabs() { return visTabs(this.config, this.hass); }
    static get startTabSpec() { return { key: 'host', tabs: (card) => visTabs(card.config, card.hass), legacy: ST_LEG.legacy, map: ST_LEG.map, get: (card) => card.tab, set: (card, id) => { if (card.ui.host !== id) card.setUI({ host: id, sel: null }, true); } }; }
    get tab() { const V = this.tabs, st = tabsCfg(this.config).start; const u = this.ui.host || this.ui.tab; return V.includes(u) ? u : V.includes(st) ? st : V[0]; }
    _sub(host) { const S = SUBS[host]; let u = (this.ui.sub || {})[host]; if (u === 'internett') u = 'udm'; return S.some((s) => s[0] === u) ? u : S[0][0]; }
    // Fiks 50 G: SpeedTest-målingen er ferdig når sensorene melder ny tilstand (last_updated) – sjekkes ved hver hass-oppdatering
    set hass(h) { super.hass = h; this._stCheck(); }
    get hass() { return super.hass; }

    /* ---------------------------------------------------------- målinger (toppkort + vertkort) */
    _metrics(R, HA, host) {
      const h = this.hass, c = this.config;
      const mk = ([k, label, unit, color], id, v, f) => ({ k, label, unit, color, id: id || null, v: v == null || isNaN(v) ? null : v, f: f || 1 });
      const [a, b, x] = HM[host];
      if (host === 'net') {
        const g = gateway(R) || {}, dn = ov(c, 'net_down') || g.rx, up = ov(c, 'net_up') || g.tx, cl = ov(c, 'unifi_clients');
        const fd = rateF(unitOf(h, dn)), fu = rateF(unitOf(h, up)), vd = numOf(h, dn), vu = numOf(h, up);
        return [mk(a, dn, vd == null ? null : vd * fd, fd), mk(b, up, vu == null ? null : vu * fu, fu), mk(x, cl, R.found.unifi ? klientTall(h, R, c) : null)];
      }
      if (host === 'proxmox') {
        const n = R.proxmox.noder[0] || {}, cp = ov(c, 'proxmox_cpu') || n.cpu, mm = ov(c, 'proxmox_mem') || n.mem, io = ov(c, 'proxmox_io') || n.iowait;
        return [mk(a, cp, pctOf(h, cp)), mk(b, mm, pctOf(h, mm, n.ramBrukt, n.ramTot)), mk(x, io, pctOf(h, io))];
      }
      if (host === 'unraid') {
        const U = R.unraid || {}, cp = ov(c, 'unraid_cpu') || U.cpu, mm = ov(c, 'unraid_ram') || U.ram, tp = ov(c, 'unraid_temp') || U.temp;
        return [mk(a, cp, pctOf(h, cp)), mk(b, mm, pctOf(h, mm)), mk(x, tp, numOf(h, tp))];
      }
      if (host === 'cf') {
        const [vi, rq, da] = M.serverCF ? M.serverCF.heroIds(h, c) : [];
        return [mk(a, vi, numOf(h, vi)), mk(b, rq, numOf(h, rq)), mk(x, da, numOf(h, da))];
      }
      if (host === 'qbit') {
        const Q = oppdagQB(h, c).ids, sp = (id) => { const v = numOf(h, id), f = mbsF(unitOf(h, id)); return [v == null ? null : v * f, f]; };
        const [vd, fd] = sp(Q.down), [vu, fu] = sp(Q.up);
        return [mk(a, Q.down, vd, fd), mk(b, Q.up, vu, fu), mk(x, Q.active, numOf(h, Q.active))];
      }
      const S = HA.sys, cp = ov(c, 'ha_cpu') || S.cpu, mm = ov(c, 'ha_mem') || S.mem, dk = ov(c, 'ha_disk') || S.disk;
      return [mk(a, cp, pctOf(h, cp)), mk(b, mm, pctOf(h, mm)), dk ? mk(x, dk, pctOf(h, dk)) : mk(x, HA.host.diskUsed, pctOf(h, null, HA.host.diskUsed, HA.host.diskTot))];
    }
    _series(m) {
      const H = m.id && this._hist[m.id];
      const s = H && H.length ? H.map((v) => v * m.f) : (m.v != null ? Array(NPT).fill(m.v) : []);
      if (s.length && m.v != null) s[NPT - 1] = m.v;
      return s;
    }
    async _loadHist() {
      if (!this.hass || !this.isOpen || !this._settled) return;
      const R = oppdag(this.hass, this.config), HA = oppdagHA(this.hass, this.config), host = this.tab;
      const ids = this._metrics(R, HA, host).map((m) => m.id).filter(Boolean);
      const key = host + '|' + ids.join();
      if (this._histKey === key && this._histAt && Date.now() - this._histAt < TTL) return;
      this._histKey = key; this._histAt = Date.now();
      if (!ids.length) return;
      const r = await M.history(this.hass, ids, 24).catch(() => ({}));
      if (this._histKey !== key) return;
      ids.forEach((id) => { this._hist[id] = M.sample(r[id] || [], NPT, 24); });
      this._patchHero(); // Fiks 52 A3: bare grafen i toppkortet – ingen ny tegning av hele kortet
    }
    // Oppdater ett avsnitt (data-key) mot ny HTML for samme avsnitt – brukes når bare grafdata er kommet
    _patch(key, html) {
      const el = this.shadowRoot && this.shadowRoot.querySelector(`[data-key="${key}"]`);
      if (!el || !html) return false;
      const t = document.createElement('template'); t.innerHTML = html;
      const n = t.content.firstElementChild;
      if (!n || n.getAttribute('data-key') !== key) return false;
      [...n.attributes].forEach((a) => { if (el.getAttribute(a.name) !== a.value) el.setAttribute(a.name, a.value); });
      M.morph(el, n.innerHTML);
      return true;
    }
    _patchHero() {
      const host = this.tab;
      if (!this._settled || this._skel || !this._R || !this._HA) return this.update();
      if (!this._patch('hero-' + host, this._hero(this._R, this._HA, host, isCards(this.config)))) this.update();
    }
    // Status per vert (chip, prikk): { t, ok, none }
    _status(R, HA, host) {
      const h = this.hass;
      if (host === 'cf') return M.serverCF ? M.serverCF.chip(h, this.config) : { t: '–', ok: false, none: true };
      if (host === 'qbit') {
        const Q = oppdagQB(h, this.config), s = Q.ids.conn && h.states[Q.ids.conn];
        if (!Q.found) return { t: 'Ikke koblet', ok: false, none: true };
        if (!ok(s)) return { t: '–', ok: false, none: true };
        const v = String(s.state).toLowerCase();
        return v === 'connected' ? { t: 'Tilkoblet', ok: true } : v === 'firewalled' ? { t: 'Brannmur', ok: false } : v === 'disconnected' ? { t: 'Frakoblet', ok: false } : { t: tittel(s.state), ok: false };
      }
      if (host === 'ha') { const n = this._updN(); return n ? { t: `${n} ${n === 1 ? 'oppdatering' : 'oppdateringer'}`, ok: false } : { t: 'Oppdatert', ok: true }; }
      const ik = HOST_INT[host];
      if (!R.found[ik]) return { t: R.loading && R.mode[ik] !== 'none' ? 'Leter …' : 'Ikke koblet', ok: false, none: true };
      if (host === 'net') { const g = gateway(R); return !g ? { t: '–', ok: false, none: true } : apOffline(h, g) ? { t: 'Frakoblet', ok: false } : { t: 'Online', ok: true }; }
      if (host === 'proxmox') {
        const n = R.proxmox.noder[0], st = n && n.status && h.states[n.status];
        if (st && ok(st) && !kjorer(st)) return { t: 'Frakoblet', ok: false };
        const G = R.proxmox.gjester; return { t: `${G.filter((g) => kjorer(h.states[g.bryter || g.status])).length} av ${G.length} kjører`, ok: true };
      }
      const U = R.unraid;
      return U && STOPP(h, U) ? { t: 'Array stoppet', ok: false } : { t: 'Alt OK', ok: true };
    }
    _updIds() {
      const h = this.hass, ex = new Set(this.config.exclude || []);
      return Object.keys(h.states).filter((id) => id.startsWith('update.') && !ex.has(id));
    }
    _updN() { const h = this.hass; return this._updIds().filter((id) => h.states[id].state === 'on').length; }

    onAction(name, el, ev) {
      const d = el.dataset, h = this.hass;
      switch (name) {
        case 'host': if (d.v && this.tabs.includes(d.v) && d.v !== this.tab) { this.setUI({ host: d.v, sel: null, port: null }); if (d.v === 'ha') supLoad(h); setTimeout(() => this._loadHist(), 0); } return;
        case 'sub': return this.setUI({ sub: { ...(this.ui.sub || {}), [this.tab]: d.v }, port: null });
        case 'hm': return this.setUI({ hm: { ...(this.ui.hm || {}), [this.tab]: d.v }, sel: null });
        case 'dx': return this.setUI({ dx: this.ui.dx === d.v ? null : d.v });
        case 'gx': { const open = this.ui.gx === d.v ? null : d.v; if (open && d.slug) supAddon(h, d.slug); return this.setUI({ gx: open }); }
        case 'swsel': return this.setUI({ swSel: d.v, port: null });
        case 'port': return this.setUI({ port: this.ui.port === d.v ? null : d.v });
        case 'bay': return M.toast(d.msg || '–');
        case 'flt': this._flt[this.tab] = d.v; return this.update();
        case 'qclr': { this._q[this.tab] = ''; const i = this.shadowRoot.querySelector('.srch input'); if (i) i.value = ''; this.update(); setTimeout(() => { const j = this.shadowRoot.querySelector('.srch input'); if (j) j.focus(); }, 30); return; }
        case 'pickint': return this._openPick(d.v);
        case 'addint': return M.navigate('/config/integrations/dashboard/add?domain=' + d.v);
        case 'gsw': if (ev) ev.stopPropagation(); return this._gsw(d.v);
        case 'arm': return this._arm(d.key, () => this._run(d));
        case 'run': return this._run(d);
        case 'tgl': return this._tgl(d);
        case 'opt': return this._opt(d);
        case 'install': return this._install(d.id);
        case 'locate': return this._locate(d);
        case 'st': return this._stRun();
        case 'qalt': return this._qAlt(d.id);
        // Fiks 62: tannhjulet åpner «Tilpass server» (faner/ikoner) – «Flere innstillinger» der åpner hele Tilpass-arket
        case 'customize': if (!d.section && !d.full) return this._tilpass(); return super.onAction(name, el, ev);
        case 'cfp': case 'cfr': case 'cfbar': if (M.serverCF) M.serverCF.onAction(this, name, el); return;
        default: return super.onAction(name, el, ev);
      }
    }
    /* ---------------------------------------------------------- Fiks 50 G: «Kjør test» (SpeedTest) */
    _stIds() { const I = oppdagST(this.hass, this.config).ids; return [I.down, I.up, I.ping].filter(Boolean); }
    _stRun() {
      const h = this.hass, ids = this._stIds();
      if (this._st || !ids.length) { if (!ids.length) M.toast('Fant ingen SpeedTest-sensorer'); return; }
      const lu = {}; ids.forEach((id) => { const s = h.states[id]; lu[id] = s ? s.last_updated : null; });
      this._st = { t: Date.now(), lu };
      clearTimeout(this._stT);
      this._stT = setTimeout(() => { if (!this._st) return; this._st = null; M.haptic('warning'); M.toast('Speedtest ga ikke svar'); this.update(); }, 180000);
      this.update();
      const svc = h.services && h.services.speedtestdotnet && h.services.speedtestdotnet.speedtest;
      const p = svc ? M.call(h, 'speedtestdotnet', 'speedtest', {}) : M.call(h, 'homeassistant', 'update_entity', { entity_id: ids });
      Promise.resolve(p).catch((e) => { clearTimeout(this._stT); this._st = null; M.toast('Feil: ' + ((e && e.message) || e)); this.update(); });
    }
    _stCheck() {
      const st = this._st, h = this.hass;
      if (!st || !h) return;
      const ids = Object.keys(st.lu), main = ids[0]; // nedlasting først (ellers den som finnes)
      const ch = (id) => { const s = h.states[id]; return !!s && s.last_updated !== st.lu[id]; };
      if (!ch(main) && !ids.every(ch)) return;
      this._st = null; clearTimeout(this._stT);
      M.haptic('success'); M.toast('Speedtest ferdig');
      this.update();
    }
    /* ---------------------------------------------------------- Fiks 50 E: alternativ hastighet (switch.toggle, optimistisk) */
    _qAlt(id) {
      const h = this.hass, s = id && h.states[id];
      if (!s) return;
      const want = !this._pendingTgl(id, s.state === 'on');
      this._want('t:' + id, want);
      M.call(h, 'switch', 'toggle', { entity_id: id }).catch((e) => M.toast('Feil: ' + ((e && e.message) || e)));
      M.toast(want ? 'Alternativ hastighet på' : 'Alternativ hastighet av');
    }
    /* ---------------------------------------------------------- vert-grensesnitt for M.serverUnifi (58b-server-unifi.js, Fiks 50 H–M) */
    // host.render() = ny tegning (kortets egen render() er malen og returnerer HTML), derfor et eget objekt.
    get _host() {
      if (this.__host) return this.__host;
      const card = this;
      this.__host = {
        card,
        get hass() { return card.hass; },
        get config() { return card.config; },
        get ui() { return card.ui; },
        setUI: (p, quiet) => card.setUI(p, quiet),
        // Fiks 52 A3: oppslag (WAN-latens) bare når popupen er åpen og har satt seg; patch = oppdater ett avsnitt (data-key)
        get isOpen() { return card.isOpen && !!card._settled; },
        get isConnected() { return card.isConnected; },
        get R() { return card._R; },
        patch: (key, html) => card._patch(key, html),
        render: () => card.update(),
        update: () => card.update(),
        haptic: (t) => M.haptic(t || 'light'),
        moreInfo: (id) => { if (id) M.moreInfo(card, id); },
        toast: (t) => M.toast(t),
        call: (d, sv, data) => M.call(card.hass, d, sv, data),
        setCfg: (patch) => card._setCfg(patch),
        go: (tab, sub, extra) => card._go(tab, sub, extra),
        confirm: (text, o) => confirmSheet(text, o),
      };
      return this.__host;
    }
    async _setCfg(patch) {
      const old = this._rawConfig || this.config, n = { ...old, ...(patch || {}) };
      Object.keys(n).forEach((k) => { if (n[k] === undefined) delete n[k]; });
      this.setConfig(n);
      try { const r = await M.saveCardConfig(this.hass, old, n, { card: this }); if (r && r.config) this.setConfig(r.config); } catch (e) { console.warn('[ki-msh] Server', e); }
    }
    // Hopp til vert/underfane (f.eks. «Porter» → go('net', 'switch', { dev })) – extra legges i UI-tilstanden
    _go(tab, sub, extra) {
      const host = tab && this.tabs.includes(tab) ? tab : this.tab, x = { ...(extra || {}) }, moved = host !== this.tab;
      if (x.dev && x.swSel == null) x.swSel = x.dev;
      const p = { host, sel: null, port: null, ...x };
      if (sub && SUBS[host] && SUBS[host].some((t) => t[0] === sub)) p.sub = { ...(this.ui.sub || {}), [host]: sub };
      this.setUI(p);
      if (moved) setTimeout(() => this._loadHist(), 0);
    }
    onInput(name, el) { if (name === 'q') { this._q[this.tab] = el.value; this.update(); } }
    // Rød-tone-handlinger: første trykk = «Bekreft · trykk igjen» (rød), andre trykk kjører, tilbakestilles etter 3 s
    _arm(key, run) {
      if (this._armed === key) { clearTimeout(this._armT); this._armed = null; M.haptic('heavy'); run(); this.update(); return; }
      this._armed = key; M.haptic('warning');
      clearTimeout(this._armT); this._armT = setTimeout(() => { this._armed = null; this.update(); }, 3000);
      this.update();
    }
    // Ventende bryter (optimistisk): vis ønsket tilstand til HA melder endring (maks 15 s)
    _want(key, want) { this._pend[key] = { want, t: Date.now() }; this.update(); setTimeout(() => this.update(), 15100); }
    _pendRun(key, actual) {
      const p = this._pend[key]; if (!p) return actual;
      if (Date.now() - p.t > 15000 || actual === p.want) { delete this._pend[key]; return actual; }
      return p.want;
    }
    // Bryteren i listeraden: start/stopp uten å åpne raden
    _gsw(id) {
      const h = this.hass, it = (this._items || []).find((x) => x.id === id);
      if (!it) return;
      if (it.lock) { M.haptic('warning'); M.toast('Start arrayet først'); return; }
      M.haptic('medium');
      const want = !it.run;
      if (it.src === 'proxmox') {
        const g = it.g, btn = want ? g.knapper.find((k) => k.a === 'start' || k.a === 'fortsett') : (g.knapper.find((k) => k.a === 'av') || g.knapper.find((k) => k.a === 'stopp'));
        if (g.bryter) { this._want(id, want); return M.call(h, 'switch', want ? 'turn_on' : 'turn_off', { entity_id: g.bryter }); }
        if (!btn) return M.toast('Fant ingen start-/stoppknapp for ' + g.navn);
        this._want(id, want); M.call(h, 'button', 'press', { entity_id: btn.id });
      } else if (it.src === 'unraid') {
        this._want(id, want); M.call(h, 'switch', want ? 'turn_on' : 'turn_off', { entity_id: it.g.bryter });
      } else {
        const a = it.a;
        if (a.sw) { this._want(id, want); M.call(h, 'switch', want ? 'turn_on' : 'turn_off', { entity_id: a.sw }); }
        else if (a.slug) { this._want(id, want); M.call(h, 'hassio', want ? 'addon_start' : 'addon_stop', { addon: a.slug }).then(() => { SUP.t = 0; supLoad(h); }).catch(() => {}); }
        else return M.toast('Fant ikke tillegget i Supervisor');
      }
      M.toast(it.name + (want ? ' startes' : ' stoppes'));
    }
    // Bryter (entitet): switch/light/input_boolean, eller opptaksmodus (select.*_recording_mode)
    _tgl(d) {
      const h = this.hass;
      if (d.sw) { const s = h.states[d.sw]; this._want('t:' + d.sw, !(s && s.state === 'on')); return M.toggle(h, d.sw); }
      if (d.sel) {
        const s = h.states[d.sel]; if (!s) return;
        const opts = s.attributes.options || [], never = opts.find((o) => /never|aldri/i.test(o)) || 'never', on = s.state !== never;
        const back = (() => { try { return localStorage.getItem('ki:sv-rec:' + d.sel); } catch (e) { return null; } })();
        if (on) { try { localStorage.setItem('ki:sv-rec:' + d.sel, s.state); } catch (e) { /* */ } }
        this._want('t:' + d.sel, !on);
        return M.call(h, 'select', 'select_option', { entity_id: d.sel, option: on ? never : (back && opts.includes(back) ? back : opts.find((o) => /always|alltid/i.test(o)) || opts.find((o) => o !== never) || 'always') });
      }
    }
    // Tillegg-valg (Supervisor /addons/<slug>/options): boot, watchdog, auto_update, ingress_panel
    _opt(d) {
      const info = SUP.info[d.slug]; if (!info) return;
      const k = d.k, cur = k === 'boot' ? info.boot === 'auto' : !!info[k], v = !cur;
      const data = { [k]: k === 'boot' ? (v ? 'auto' : 'manual') : v };
      SUP.info[d.slug] = { ...info, ...data }; this.update();
      supWS(this.hass, `/addons/${d.slug}/options`, 'post', data).then(() => M.toast(`${d.label || k} ${v ? 'på' : 'av'}`)).catch((e) => { SUP.info[d.slug] = info; this.update(); M.toast('Kunne ikke lagre: ' + ((e && e.message) || e)); });
    }
    _install(id) {
      const h = this.hass, s = h.states[id];
      if (!s || s.state !== 'on' || this._upd[id]) return;
      M.haptic('medium');
      this._upd[id] = { t: Date.now() }; this.update();
      M.call(h, 'update', 'install', { entity_id: id }).catch((e) => { delete this._upd[id]; this.update(); M.toast('Feil: ' + ((e && e.message) || e)); });
    }
    _pendingTgl(id, actual) { return this._pendRun('t:' + id, actual); }
    // «Finn»: locate-knapp/-bryter, ellers LED-blink – ikonet blinker mens den er aktiv
    _locate(d) {
      const h = this.hass, id = d.id; if (!id) return;
      const until = Date.now() + (dom(id) === 'light' ? 10000 : 30000);
      if (dom(id) === 'switch') M.toggle(h, id);
      else if (dom(id) === 'button') M.call(h, 'button', 'press', { entity_id: id });
      else M.call(h, 'light', 'turn_on', { entity_id: id, flash: 'long' }).then(() => M.toast('LED-en blinker')).catch(() => {});
      this._blink[d.dev] = until; setTimeout(() => this.update(), until - Date.now() + 50);
      this.update();
    }
    /* ---------------------------------------------------------- Fiks 62: «Tilpass server» (designet: cu) */
    // Ark øverst i popupen (portalt til ki-overlay-root – fallgruve 1) med mørkt bakteppe; trykk utenfor / ✕ / Esc lukker.
    // «Faner viser» (tab_mode) og «Ikon per server» (host_icons) lagres i kortets config og speiles i localStorage.
    _tilpass() {
      if (this._tp && !this._tp.closed) return;
      const card = this, open = { k: null };
      const top = (() => { let n = card, popTop = null; for (let i = 0; n && i < 40; i++) { if (n.classList && n.classList.contains('bubble-pop-up')) { popTop = n.getBoundingClientRect().top; break; } n = n.parentElement || (n.getRootNode && n.getRootNode().host); } return Math.round(M.clamp((popTop != null ? popTop : 0) + 12, 12, Math.max(12, window.innerHeight / 3))); })();
      const ov = (this._tp = M.overlay({ sheet: false, maxWidth: 440, guard: 350, css: TP_CSS(), html: '', onClose: () => { if (card._tp === ov) card._tp = null; } }));
      ov.host.style.setProperty('--sv-tp-top', top + 'px');
      const draw = () => {
        const c = card.config, md = tabMode(c), V = KEYS.filter((k) => card.tabs.includes(k) || (k !== 'cf' && k !== 'qbit'));
        const modes = [['alle', 'Ikon og navn', [1, 1, 1]], ['aktiv', 'Navn på valgt fane', [1, 0, 0]], ['ikon', 'Bare ikoner', [0, 0, 0]]].map(([k, l, dm]) => `<button class="md${md === k ? ' on' : ''}" data-sa="mode" data-v="${k}" aria-pressed="${md === k}">
            <span class="dm">${dm.map((t, j) => `<span class="dmi${j === 0 ? ' a' : ''}">${M.icon(icMdi(['router', 'dns', 'home'][j]), 12)}${t ? '<i></i>' : ''}</span>`).join('')}</span><span class="ml">${esc(l)}</span></button>`).join('');
        const hosts = V.map((k) => {
          const cur = hostIconName(c, k), on = open.k === k, changed = cur !== HOST_IC[k];
          return `<div class="hr${on ? ' open' : ''}" data-key="tph-${k}"><button class="hb" data-sa="toggle" data-v="${k}" aria-expanded="${on}"><span class="hi">${M.icon(icMdi(cur), 20)}</span><span class="hn"${k === 'cf' ? ' data-noi18n' : ''}>${esc(HOSTL[k][1])}</span>${changed ? `<span class="rs" data-sa="reset" data-v="${k}" role="button">Tilbakestill</span>` : ''}${M.icon('mdi:chevron-down', 20, 'color:var(--ki-text-mid, #979797)')}</button>
            ${on ? `<div class="ig">${IC_OPTS.map((ic) => `<button class="io${ic === cur ? ' on' : ''}" data-sa="icon" data-k="${k}" data-v="${ic}" title="${ic}" aria-pressed="${ic === cur}">${M.icon(icMdi(ic), 20)}</button>`).join('')}</div>` : ''}</div>`;
        }).join('');
        M.morph(ov.body, `<div class="tph"><span class="tt">Tilpass server</span><button class="x" data-sa="close" aria-label="Lukk" title="Lukk">${M.icon('mdi:close', 22)}</button></div>
          <div class="grp"><span class="gl">Faner viser</span><div class="mds">${modes}</div></div>
          <div class="grp"><span class="gl">Ikon per server</span><div class="hl">${hosts}</div></div>
          <button class="more" data-sa="full">${M.icon('mdi:tune', 20)}<span>Flere innstillinger</span>${M.icon('mdi:chevron-right', 20, 'color:var(--ki-text-mid, #979797)')}</button>`);
      };
      const save = (patch) => {
        const old = card._rawConfig || card.config, n = { ...old, ...patch };
        card._setCfg(n);
        try { localStorage.setItem(LS_TP, JSON.stringify({ icons: { ...(n.host_icons || {}) }, tabMode: n.tab_mode || 'alle' })); } catch (e) { /* */ }
        setTimeout(draw, 0);
      };
      ov.body.addEventListener('click', (e) => {
        const el = e.target.closest('[data-sa]'); if (!el) return;
        e.stopPropagation();
        const a = el.dataset.sa, v = el.dataset.v, c = card._rawConfig || card.config;
        if (a === 'close') { M.haptic('light'); return ov.close(); }
        if (a === 'full') { M.haptic('light'); ov.close(); return card.customize(); }
        if (a === 'mode') { M.haptic('selection'); return save({ tab_mode: v === 'alle' ? undefined : v }); }
        if (a === 'toggle') { M.haptic('light'); open.k = open.k === v ? null : v; return draw(); }
        const icons = { ...((c && c.host_icons) || {}) };
        if (a === 'reset') { M.haptic('light'); delete icons[v]; return save({ host_icons: Object.keys(icons).length ? icons : undefined }); }
        if (a === 'icon') { M.haptic('selection'); if (v === HOST_IC[el.dataset.k]) delete icons[el.dataset.k]; else icons[el.dataset.k] = v; return save({ host_icons: Object.keys(icons).length ? icons : undefined }); }
      });
      draw();
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
    // Handling: entitet (button.press / update.install / toggle), tjeneste (data-svc + data-data) eller navigering (data-nav)
    _run(d) {
      const h = this.hass, done = () => d.toast && M.toast(d.toast), fail = (e) => M.toast('Feil: ' + ((e && e.message) || e));
      if (d.nav) return M.navigate(d.nav);
      if (d.ids) { d.ids.split(',').filter(Boolean).forEach((id) => M.call(h, 'button', 'press', { entity_id: id })); return done(); }
      if (d.id) {
        const D = dom(d.id), call = D === 'button' ? ['button', 'press'] : D === 'update' ? ['update', 'install'] : [D, 'toggle'];
        return M.call(h, call[0], call[1], { entity_id: d.id }).then(done).catch(fail);
      }
      if (d.svc) { const [a, b] = d.svc.split('.'); let data = {}; try { data = d.data ? JSON.parse(d.data) : {}; } catch (e) { /* */ } return M.call(h, a, b, data).then(done).catch(fail); }
    }

    /* ---------------------------------------------------------- tegning */
    render() {
      const h = this.hass, c = this.config, V = this.tabs, host = this.tab, cards = isCards(c);
      this._paintKey = this._viewKey();
      // Fiks 52 A3: før popupen har satt seg – skjelett uten oppdagelse/oppslag (fanelinje, toppkort med «–», reservert høyde)
      if (!this._settled) { this._skel = true; return this._skeleton(V, host, cards); }
      this._skel = false;
      let R = oppdag(h, c);
      const HA = (this._HA = oppdagHA(h, c)), su = M.serverUnifi;
      // Fiks 50 H–M: 58b-server-unifi.js kan utvide oppdagelsen (UniFi-enheter via device_id) – bare når Nettverk vises
      if (host === 'net' && su && typeof su.discover === 'function') { try { const x = su.discover(h, R, c); if (x && typeof x === 'object' && x.unifi) R = x; } catch (e) { console.error('[ki-msh] serverUnifi.discover', e); } }
      this._R = R;
      // Fiks 52 A3: avhengigheter bare for aktiv vert (+ sammendragene i kort-modus)
      this._hostDeps(R, HA, host);
      let X = {};
      if (cards) {
        // kort-modus: billige sammendrag (første måling + status) for hver vert – ingen lister/underfaner
        V.forEach((k) => { X[k] = this._sum(R, HA, k, true); });
      }
      const pick = cards ? hostCardsHTML(V, host, X, (k) => `data-act="host" data-haptic="selection"`, c) : tabRowHTML(V, host, () => 'data-act="host" data-haptic="selection"', c);
      const ik = HOST_INT[host], found = !ik || R.found[ik], sub = this._sub(host);
      const parts = [pick, this._hero(R, HA, host, cards), showProse(c) ? this._prose(R, HA, host) : ''];
      if (!found) parts.push(this._notFound(R, ik));
      else {
        parts.push(`<div class="subs" role="tablist">${SUBS[host].map(([k, l]) => `<button class="sb${k === sub ? ' on' : ''}" role="tab" aria-selected="${k === sub}" data-act="sub" data-v="${k}" data-haptic="selection">${esc(l)}</button>`).join('')}</div>`);
        let body = '';
        try { body = this['_b_' + host + '_' + sub](R, HA); } catch (e) { body = this._failHTML(e); }
        parts.push(`<div class="pane" data-key="pane-${host}-${sub}">${body}</div>`);
      }
      return `<div class="wrap" style="${thVars(c)}">${parts.join('')}</div>`;
    }
    // Skjelettet: samme oppbygging og data-key som den fulle tegningen (morph beholder elementene – ingen ny inn-fade),
    // høyden på prosa og fane-innhold fra forrige gang (SKH, per kort/vert/underfane) så innholdet ikke hopper.
    _skeleton(V, host, cards) {
      const c = this.config, h = this.hass, sub = this._sub(host), H = skhGet(this, host, sub);
      // Forrige oppdagelse (modul-memo, f.eks. fra forrige åpning) gir ekte verdier i toppkort/prosa uten ny gjennomgang
      const R = oppdagPeek(h, c), HA = R && oppdagHAPeek(h, c), live = !!(R && HA);
      let X = {};
      if (cards && live) V.forEach((k) => { X[k] = this._sum(R, HA, k); });
      const pick = cards ? hostCardsHTML(V, host, X, () => `data-act="host" data-haptic="selection"`, c) : tabRowHTML(V, host, () => 'data-act="host" data-haptic="selection"', c);
      let prose = null;
      if (live && showProse(c)) { try { prose = this._prose(R, HA, host); } catch (e) { prose = null; } }
      const parts = [pick, live ? this._hero(R, HA, host, cards) : this._hero(null, null, host, cards, true)];
      if (showProse(c)) parts.push(prose || `<p class="prose sk" style="min-height:${H.p}px">–</p>`);
      parts.push(`<div class="subs" role="tablist">${SUBS[host].map(([k, l]) => `<button class="sb${k === sub ? ' on' : ''}" role="tab" aria-selected="${k === sub}" data-act="sub" data-v="${k}" data-haptic="selection">${esc(l)}</button>`).join('')}</div>`);
      parts.push(`<div class="pane" data-key="pane-${host}-${sub}"><div class="skp" style="height:${H.b}px" aria-hidden="true"></div></div>`);
      return `<div class="wrap" style="${thVars(c)}">${parts.join('')}</div>`;
    }
    _hostDeps(R, HA, host) {
      const D = this._deps, add = (id) => { if (typeof id === 'string' && id.includes('.')) D.add(id); };
      const P = { net: /^(net_|unifi_|speedtest_)/, proxmox: /^proxmox_/, unraid: /^unraid_/, ha: /^ha_/, qbit: /^qbit_/, cf: /^cf_/ }, ALL = /^(net_|unifi_|speedtest_|proxmox_|unraid_|ha_|qbit_|cf_)/;
      Object.entries(this.config.overrides || {}).forEach(([k, id]) => { if ((P[host] && P[host].test(k)) || !ALL.test(k)) add(id); });
      if (host === 'net') { R.ents.unifi.forEach(add); Object.values(oppdagST(this.hass, this.config).ids).forEach(add); }
      else if (host === 'proxmox' || host === 'unraid') R.ents[host].forEach(add);
      else if (host === 'qbit') Object.values(oppdagQB(this.hass, this.config).ids).forEach(add);
      else if (host === 'cf') { if (M.serverCF) M.serverCF.deps(this.hass, this.config).forEach(add); }
      else if (host === 'ha') {
        [HA.sys, HA.core, HA.os, HA.sup, HA.host].forEach((o) => Object.values(o || {}).forEach(add));
        HA.addons.forEach((a) => [a.run, a.sw, a.cpu, a.mem, a.ver, a.upd].forEach(add));
        this._updIds().forEach(add);
      }
    }
    // Kort-modus: sammendrag for vert k (første måling + status) – ring: net 100 % = 1000 Mbit · qbit 100 % = 20 MB/s (designet: v * 5)
    _sum(R, HA, k, deps) {
      const m = this._metrics(R, HA, k)[0], st = this._status(R, HA, k);
      if (deps) this._sumDeps(R, HA, k, m);
      // Fiks 62: arildkristo.com – «N besøk · 24 t», ring 100 % = 500 besøk
      return { ok: st.ok, none: st.none, col: m.color, pct: m.v == null ? 0 : k === 'net' ? Math.min(100, m.v / 10) : k === 'qbit' ? Math.min(100, m.v * 5) : k === 'cf' ? Math.min(100, m.v / 5) : m.v,
        sub: m.v == null ? '–' : k === 'net' ? `${Math.round(m.v)} Mbit ned` : k === 'qbit' ? `${fmtN(m.v, m.v < 100 ? 1 : 0)} MB/s ned` : k === 'cf' ? `${M.nf(m.v)} besøk · 24 t` : `${m.label} ${Math.round(m.v)} %` };
    }
    // Kort-modus: det sammendraget for vert k leser (første måling + status)
    _sumDeps(R, HA, k, m) {
      const add = (id) => { if (id) this._deps.add(id); };
      add(m && m.id);
      if (k === 'net') { const g = gateway(R); if (g) [g.tracker, g.tilstand, g.cpu].forEach(add); }
      else if (k === 'proxmox') { const n = R.proxmox.noder[0]; add(n && n.status); R.proxmox.gjester.forEach((g) => add(g.bryter || g.status)); }
      else if (k === 'unraid') { const U = R.unraid; if (U) [U.arrayStatus, U.arraySw].forEach(add); }
      else if (k === 'ha') this._updIds().forEach(add);
      else if (k === 'qbit') add(oppdagQB(this.hass, this.config).ids.conn);
      else if (k === 'cf' && M.serverCF) M.serverCF.status(this.hass, this.config).ids.forEach(add);
    }
    _hero(R, HA, host, cards, skel) {
      const ui = this.ui, c = this.config;
      const Ms = skel ? HM[host].map(([k, label, unit, color]) => ({ k, label, unit, color, id: null, v: null, f: 1 })) : this._metrics(R, HA, host);
      const want = (ui.hm || {})[host] || (c.hero_metric || {})[host];
      const mi = Math.max(0, Ms.findIndex((m) => m.k === want)), M0 = Ms[mi];
      const S = this._series(M0), idx = ui.sel != null ? ui.sel : NPT - 1;
      let line = `M0 60 L300 60`, mx = 300;
      if (S.length) {
        const max = Math.max(...S) * 1.15 || 1, min = Math.min(...S) * 0.7, span = max - min || 1;
        const pts = S.map((v, i) => [(i / (NPT - 1)) * 300, 80 - ((v - min) / span) * 66]);
        line = 'M' + pts.map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L');
        mx = pts[Math.min(idx, pts.length - 1)][0];
      }
      const at = (m) => { if (ui.sel == null) return m.v; const s = this._series(m); return s.length ? s[Math.min(idx, s.length - 1)] : null; };
      // MB/s (qBittorrent) med én desimal under 100 (designet: «9,2 MB/s»)
      const fv = (m, v) => (v == null || isNaN(v) ? '–' : (m.unit === '%' && v < 10) || (m.unit === 'MB/s' && v < 100) ? M.nf(v, 1) : String(Math.round(v)));
      const st = skel ? { t: '–', ok: false, none: true } : this._status(R, HA, host);
      const hrs = (NPT - 1 - idx) / 2;
      const time = ui.sel == null ? `nå · ${M0.label.toLowerCase()}` : `−${M.nf(hrs, hrs % 1 ? 1 : 0)} t · ${M0.label.toLowerCase()}`;
      const unit = (m) => (m.unit === '%' || m.unit === '°' ? m.unit : m.unit ? ' ' + m.unit : ' ' + m.label.toLowerCase());
      return `<section class="hero" aria-label="Toppkort" data-key="hero-${host}">
          <div class="htop"><span class="hn ell"${host === 'cf' ? ' data-noi18n' : ''}>${esc(HOSTL[host][1])}</span><span class="chip ${st.none ? 'none' : st.ok ? 'ok' : 'warn'}">${M.icon(st.none ? 'mdi:link-variant-off' : st.ok ? 'mdi:check' : 'mdi:alert', 13)}<span class="ell">${esc(st.t)}</span></span></div>
          ${cards ? `<button class="hcog" data-act="customize" aria-label="Tilpass Server" title="Tilpass">${M.icon('mdi:cog', 22)}</button>` : ''}
          <div class="vals"><span class="bigw"><span class="big num">${fv(M0, at(M0))}</span><span class="bu">${esc(unit(M0).trim() === M0.label.toLowerCase() ? '' : unit(M0))}</span></span>
            ${Ms.map((m, j) => (j === mi ? '' : `<button class="sv" data-act="hm" data-v="${m.k}" data-haptic="selection" aria-label="Vis ${esc(m.label)}"><span class="svv num">${fv(m, at(m))}</span><span class="svu">${esc(unit(m))}</span></button>`)).join('')}</div>
          <span class="when">${esc(time)}</span>
          <div class="graph"><svg viewBox="0 0 300 84" preserveAspectRatio="none" aria-hidden="true">
            <path d="${line} L300 84 L0 84 Z" style="fill:${M.alpha(M0.color, 0.14)}"></path>
            <path d="${line}" fill="none" style="stroke:${M0.color}" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke"></path>
            ${ui.sel != null ? `<line class="mk" x1="${mx.toFixed(1)}" x2="${mx.toFixed(1)}" y1="0" y2="84" stroke-width="1" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"></line>` : ''}</svg>
            <div class="scrub" aria-label="Scrub grafen"></div></div>
        </section>`;
    }
    // 35.7 regel 1: ÉN <p> med tekst og inline-piller – ingen flex/grid, ingen containere
    _prose(R, HA, host) {
      const h = this.hass, c = this.config, ik = HOST_INT[host], pill = (t) => `<span class="pp">${esc(t)}</span>`;
      let txt;
      if (ik && !R.found[ik]) txt = R.loading && R.mode[ik] !== 'none' ? `Leter etter ${pill(INT[ik].name)} …` : `Ingen ${pill(INT[ik].name)} er koblet til ennå.`;
      else if (host === 'cf') {
        // Fiks 62: «arildkristo.com har hatt [N besøk] og [N forespørsler] siste 24 timer.»
        const m = this._metrics(R, HA, 'cf'), v = m[0].v, r = m[1].v;
        txt = `<span data-noi18n>${esc(HOSTL.cf[1])}</span> har hatt ${pill(v == null ? '–' : `${M.nf(v)} besøk`)} og ${pill(r == null ? '–' : `${M.nf(r)} forespørsler`)} siste 24 timer.`;
      } else if (host === 'qbit') {
        const m = this._metrics(R, HA, 'qbit'), a = m[2].v;
        txt = `qBittorrent laster ned med ${pill(m[0].v == null ? '–' : `${fmtN(m[0].v, m[0].v < 100 ? 1 : 0)} MB/s`)} og har ${pill(a == null ? '–' : `${M.nf(a)} ${a === 1 ? 'aktiv torrent' : 'aktive torrenter'}`)}.`;
      } else if (host === 'net' && M.serverUnifi && typeof M.serverUnifi.prosa === 'function' && (() => { try { txt = M.serverUnifi.prosa(h, R, c) || ''; } catch (e) { console.error('[ki-msh] serverUnifi.prosa', e); txt = ''; } return !!txt; })()) {
        // Fiks 50 H: prosaen for Nettverk kommer fra 58b-server-unifi.js (ekte UniFi-enheter) – HTML (én <p> eller innhold)
        if (/^\s*<p[\s>]/.test(txt)) return txt;
      } else if (host === 'net') {
        const off = R.unifi.enheter.filter((e) => e.type !== 'enhet' && apOffline(h, e)).length, k = klientTall(h, R, c);
        txt = `Nettet er ${pill(off ? `${off} ${off === 1 ? 'enhet' : 'enheter'} frakoblet` : 'helt oppe')} og ${pill(k == null ? '–' : `${M.nf(k)} ${k === 1 ? 'klient' : 'klienter'}`)} er tilkoblet.`;
      } else if (host === 'proxmox') {
        const G = R.proxmox.gjester, on = G.filter((g) => kjorer(h.states[g.bryter || g.status])).length, p = this._pveStorePct(R);
        txt = `Proxmox kjører ${pill(`${on} av ${G.length} gjester`)} og lagringen er ${pill(p == null ? '–' : `${M.nf(p)} % full`)}.`;
      } else if (host === 'unraid') {
        const U = R.unraid || {}, stop = STOPP(h, U), p = pctOf(h, ov(c, 'unraid_array') || U.arrayBruk, U.arrayBrukt, U.arrayTot);
        txt = U.glances ? `CPU-en er ${pill(`${fmtN(pctOf(h, U.cpu), 0)} %`)} og minnet er ${pill(`${fmtN(pctOf(h, U.ram), 0)} % brukt`)}.`
          : `Arrayet er ${pill(U.arrayStatus || U.arraySw ? (stop ? 'stoppet' : 'startet') : '–')} og lagringen er ${pill(p == null || stop ? '–' : `${M.nf(p)} % full`)}.`;
      } else {
        const n = this._updN(), run = this._addonRun(HA);
        txt = `Home Assistant har ${pill(n ? `${n} ${n === 1 ? 'oppdatering' : 'oppdateringer'}` : 'ingen oppdateringer')} og ${pill(run == null ? '–' : `${run} tillegg`)} kjører.`;
      }
      return `<p class="prose">${txt}</p>`;
    }
    _pveStorePct(R) {
      const h = this.hass, n = R.proxmox.noder[0] || {};
      const L = R.proxmox.lagring.map((g) => ({ b: toGB(h, g.brukt), t: toGB(h, g.total), p: pctOf(h, g.bruk, g.brukt, g.total) }));
      const bt = L.filter((x) => x.b != null && x.t);
      if (bt.length) return (bt.reduce((a, x) => a + x.b, 0) / bt.reduce((a, x) => a + x.t, 0)) * 100;
      const d = pctOf(h, n.disk, n.diskBrukt, n.diskTot);
      if (d != null) return d;
      const P = L.filter((x) => x.p != null); return P.length ? P.reduce((a, x) => a + x.p, 0) / P.length : null;
    }
    _addonRun(HA) { if (!HA.addons.length) return HA.supervisor ? 0 : null; return HA.addons.filter((a) => this._addonOn(a)).length; }
    _addonOn(a) {
      const id = a.sw || a.run, s = id && this.s(id);
      if (s && ok(s)) return s.state === 'on' || /^(started|running)$/i.test(s.state);
      return !!(a.sup && /^started$/i.test(a.sup.state || ''));
    }
    _notFound(R, k) {
      const I = INT[k], off = R.mode[k] === 'none';
      if (R.loading && !off) return `<section class="card nf" data-key="nf-${k}">${M.icon('mdi:timer-sand', 26)}<b>Leter etter ${esc(I.name)} …</b></section>`;
      return `<section class="card nf" data-key="nf-${k}"><span class="nfi">${M.icon(off ? 'mdi:eye-off' : 'mdi:puzzle-remove-outline', 26)}</span><b>${off ? `${esc(I.name)} er slått av` : `Fant ikke ${esc(I.name)}`}</b>
        <span>${off ? 'Integrasjonen er satt til «Ingen» i Tilpass Server.' : `Legg til integrasjonen i Home Assistant, eller velg en annen config entry.${k === 'unraid' ? ' Glances brukes automatisk som reserve.' : ''}`}</span>
        <div class="nfb"><button class="pick press" data-act="pickint" data-v="${k}">${M.icon('mdi:swap-horizontal', 18)}Velg integrasjon</button><button class="pick press" data-act="addint" data-v="${esc(I.domain)}">${M.icon('mdi:plus', 18)}Legg til i HA</button></div></section>`;
    }
    _head(title, sum, icon) { return `<div class="ch">${icon ? M.icon(icon, 20, 'color:var(--ki-text-1, #c7c7c7)') : ''}<span class="ct">${esc(title)}</span>${sum != null ? `<span class="cs">${esc(sum)}</span>` : ''}</div>`; }
    // Bryter (rosa på): sm = 46×28 (detaljer), ellers 50×30 (listerad)
    _tg(on, attrs, label, opt) {
      opt = opt || {};
      return `<button class="tg${opt.sm ? ' sm' : ''}${on ? ' on' : ''}${opt.lock ? ' lock' : ''}" role="switch" aria-checked="${!!on}" aria-label="${esc(label)}" title="${esc(opt.tip || label)}" ${attrs} ${opt.dis ? 'disabled' : ''}><i></i></button>`;
    }
    // Handlingsknapp (designet: act/hAct). hot = rød tone → krever bekreftelse (to trykk)
    _ab(key, icon, label, attrs, hot, dis, cls) {
      const armed = hot && this._armed === key;
      return `<button class="ab${hot ? ' hot' : ''}${armed ? ' armed' : ''}${cls ? ' ' + cls : ''}" ${dis ? 'disabled' : `data-act="${hot ? 'arm' : 'run'}" data-key="${esc(key)}" ${attrs || ''}`} ${hot ? 'data-haptic="off"' : ''}>${M.icon(icon, 18)}${armed ? 'Bekreft · trykk igjen' : esc(label)}</button>`;
    }
    // Felles detaljvisning (35.2): 6 stat-fliser, bruksstolper, brytere, handlinger
    _detail(stats, bars, toggles, actions) {
      const st = `<div class="xs">${stats.map((x) => `<div class="xt"${x.id ? ` data-act="more" data-id="${esc(x.id)}" role="button"` : ''}><span class="xv"><span class="num ell">${esc(x.v == null || x.v === '' ? '–' : x.v)}</span><span class="xu">${esc(x.v == null || x.v === '–' ? '' : x.u || '')}</span></span><span class="xl ell">${esc(x.l)}</span></div>`).join('')}</div>`;
      const br = bars.length ? `<div class="xb">${bars.map((b) => `<div class="xbr"><span class="xbl">${esc(b.l)}</span><span class="xbt"><i style="width:${b.p == null ? 0 : M.clamp(b.p, 0, 100).toFixed(1)}%;background:${b.c}"></i></span><span class="xbv num">${esc(b.v)}</span></div>`).join('')}</div>` : '';
      const tg = toggles.length ? `<div class="xg">${toggles.map((t) => `<div class="xgr"><span class="xgi">${M.icon(t.icon, 20)}</span><span class="grow col"><b>${esc(t.label)}</b><span>${esc(t.sub || '–')}</span></span>${this._tg(t.on, t.attrs || '', t.label, { sm: true, dis: t.dis })}</div>`).join('')}</div>` : '';
      return `<div class="gx">${st}${br}${tg}${actions.length ? `<div class="xa">${actions.join('')}</div>` : ''}</div>`;
    }

    /* ---------------------------------------------------------- felles liste (35.2): Gjester (Proxmox/Unraid) og Tillegg (HA) */
    _itemsFor(R, HA, hk) {
      const h = this.hass, ex = new Set(this.config.exclude || []);
      if (hk === 'proxmox') {
        return R.proxmox.gjester.filter((g) => !ex.has(g.bryter) && !ex.has(g.status)).map((g) => {
          const vm = g.type === 'vm', sid = g.bryter || g.status;
          return { id: g.id, src: 'proxmox', g, kind: vm ? 'VM' : 'CT', tag: (vm ? 'VM' : 'CT') + (g.vmid ? ' ' + g.vmid : ''), name: g.navn, icon: vm ? 'mdi:monitor' : 'mdi:cube-outline', ent: sid,
            run: this._pendRun(g.id, kjorer(this.s(sid))), cpu: pctOf(h, g.cpu), ram: pctOf(h, g.mem, g.ramBrukt, g.ramTot) };
        });
      }
      if (hk === 'unraid') {
        const U = R.unraid; if (!U || U.glances) return [];
        const stop = STOPP(h, U);
        return U.gjester.filter((g) => !ex.has(g.bryter)).map((g) => {
          const vm = g.type === 'vm', s = this.s(g.bryter);
          return { id: g.id, src: 'unraid', g, kind: vm ? 'VM' : 'Docker', tag: vm ? 'VM' : 'Docker', name: g.navn, icon: vm ? 'mdi:monitor' : 'mdi:docker', ent: g.bryter, lock: stop,
            run: !stop && this._pendRun(g.id, !!s && s.state === 'on'), cpu: pctOf(h, g.cpu), ram: pctOf(h, g.mem), upd: g.oppdatering && h.states[g.oppdatering] && h.states[g.oppdatering].state === 'on' };
        });
      }
      return HA.addons.map((a) => {
        const S = (a.slug && SUP.stats[a.slug]) || null, ic = a.sup && a.sup.icon && String(a.sup.icon).includes(':') ? a.sup.icon : 'mdi:puzzle';
        [a.cpu, a.mem].forEach((id) => this.s(id));
        return { id: 'ha-' + (a.slug || a.dev), src: 'ha', a, kind: 'Tillegg', tag: 'Tillegg', name: a.navn, icon: ic, ent: a.sw || a.run || a.upd, slug: a.slug,
          run: this._pendRun('ha-' + (a.slug || a.dev), this._addonOn(a)), cpu: pctOf(h, a.cpu) != null ? pctOf(h, a.cpu) : S && S.cpu_percent != null ? S.cpu_percent : null,
          ram: pctOf(h, a.mem) != null ? pctOf(h, a.mem) : S && S.memory_percent != null ? S.memory_percent : null };
      });
    }
    _glist(R, HA, hk) {
      const items = this._itemsFor(R, HA, hk);
      this._items = items;
      const kinds = hk === 'proxmox' ? ['VM', 'CT'] : hk === 'unraid' ? ['Docker', 'VM'] : ['Kjører', 'Stoppet'];
      const fK = ['Alle', ...kinds].includes(this._flt[hk]) ? this._flt[hk] : 'Alle', q = (this._q[hk] || '').trim().toLowerCase();
      const isK = (it, k) => (hk === 'ha' ? (k === 'Kjører') === !!it.run : it.kind === k);
      const vis = items.filter((it) => (fK === 'Alle' || isK(it, fK)) && (!q || it.name.toLowerCase().includes(q) || it.tag.toLowerCase().includes(q)))
        .map((it, i) => [it, i]).sort((x, y) => (y[0].run ? 1 : 0) - (x[0].run ? 1 : 0) || x[1] - y[1]).map((x) => x[0]);
      const cnt = (k) => (k === 'Alle' ? items.length : items.filter((it) => isK(it, k)).length);
      const runN = items.filter((it) => it.run).length, ha = hk === 'ha';
      const sum = ha && !items.length && !HA.supervisor ? 'Ingen Supervisor' : `${runN} av ${items.length} kjører`;
      const rows = vis.map((it) => {
        const open = this.ui.gx === it.id, on = !!it.run;
        const pc = (v) => (v == null ? '–' : `${fmtN(v, 0)} %`), sub = on ? `Kjører · CPU ${pc(it.cpu)} · RAM ${pc(it.ram)}` : it.lock ? 'Stoppet · arrayet er stoppet' : 'Stoppet';
        return `<div class="gw${open ? ' open' : ''}" data-key="g-${esc(it.id)}"><div class="gr" data-act="gx" data-v="${esc(it.id)}" ${it.slug ? `data-slug="${esc(it.slug)}"` : ''} role="button" tabindex="0" aria-expanded="${open}" ${it.ent ? `data-ent="${esc(it.ent)}"` : ''}>
          <span class="gic${on ? ' on' : ''}">${M.icon(it.icon, 20)}</span>
          <span class="grow gtx"><span class="gn"><b class="ell">${esc(it.name)}</b><span class="gtag${it.upd ? ' upd' : ''}">${esc(it.upd ? 'Oppdatering' : it.tag)}</span></span><span class="gsub ell${on ? ' on' : ''}">${esc(sub)}</span></span>
          ${this._tg(on, `data-act="gsw" data-v="${esc(it.id)}" data-haptic="off"`, it.name, { lock: it.lock, tip: on ? 'Stopp' : 'Start' })}</div>${open ? this._gDetail(it, hk) : ''}</div>`;
      }).join('');
      return `<section class="card gl">${this._head(ha ? 'Tillegg' : 'Gjester', sum, ha ? 'mdi:puzzle' : 'mdi:cube-outline')}
        <label class="srch">${M.icon('mdi:magnify', 20)}<input data-input="q" type="search" placeholder="${ha ? 'Søk i tillegg' : 'Søk i gjester'}" value="${esc(this._q[hk] || '')}" aria-label="Søk" autocomplete="off" enterkeyhint="search">${q ? `<button class="clr" data-act="qclr" aria-label="Tøm søk">${M.icon('mdi:close', 18)}</button>` : ''}</label>
        <div class="chips" role="tablist">${['Alle', ...kinds].map((k) => `<button class="cp${k === fK ? ' on' : ''}" role="tab" aria-selected="${k === fK}" data-act="flt" data-v="${k}" data-haptic="selection">${esc(k)}<span class="cn">${cnt(k)}</span></button>`).join('')}</div>
        <div class="gls">${rows || '<div class="nohit">Ingen treff</div>'}</div></section>`;
    }
    _gDetail(it, hk) {
      const h = this.hass, on = !!it.run, k = it.id;
      const bar = (l, p, c, v) => ({ l, p: on || l === 'Disk' ? p : 0, c, v });
      const nope = (icon, label) => ({ icon, label, sub: '–', on: false, dis: true });
      const eT = (id, icon, label, sub) => { if (!id) return nope(icon, label); const s = this.s(id), v = this._pendingTgl(id, !!s && s.state === 'on'); return { icon, label, sub, on: v, attrs: `data-act="tgl" data-sw="${esc(id)}"`, dis: it.lock }; };
      let stats, bars, toggles, actions;
      if (hk === 'proxmox') {
        const g = it.g, K = (a) => ((g.knapper || []).find((x) => x.a === a) || {}).id;
        [g.ramBrukt, g.ramTot, g.disk, g.diskBrukt, g.diskTot, g.oppetid, g.netInn, g.netUt].forEach((id) => this.s(id));
        const rb = toGB(h, g.ramBrukt), rt = toGB(h, g.ramTot), db = toGB(h, g.diskBrukt), dt = toGB(h, g.diskTot), dp = pctOf(h, g.disk, g.diskBrukt, g.diskTot);
        const cores = g.cores && numOf(h, g.cores);
        stats = [{ v: on ? fmtN(it.cpu, 0) : '–', u: '%', l: 'CPU' + (cores ? ` · ${cores} kjerner` : ''), id: g.cpu },
          rb != null ? { v: on ? fmtN(rb, 1) : '–', u: 'GB', l: `RAM av ${fmtN(rt, 0)} GB`, id: g.ramBrukt } : { v: on ? fmtN(it.ram, 0) : '–', u: '%', l: 'RAM', id: g.mem },
          db != null ? { v: fmtN(db, 0), u: 'GB', l: `Disk av ${fmtN(dt, 0)} GB`, id: g.diskBrukt } : { v: fmtN(dp, 0), u: '%', l: 'Disk', id: g.disk },
          { v: on ? oppetid(h, g.oppetid) : '–', l: 'Oppetid', id: g.oppetid }, { v: (g.status && h.states[g.status] && h.states[g.status].attributes.ip) || '–', l: 'IP' },
          { v: g.netInn || g.netUt ? `${fmt(h, g.netInn)} / ${fmt(h, g.netUt)}` : '–', l: 'Nett ned / opp' }];
        bars = [bar('CPU', it.cpu, BL, on ? `${fmtN(it.cpu, 0)} %` : 'av'), bar('RAM', it.ram, PU, on ? (rb != null ? `${fmtN(rb, 1)} / ${fmtN(rt, 0)} GB` : `${fmtN(it.ram, 0)} %`) : 'av'), bar('Disk', dp, OR, db != null ? `${fmtN(db, 0)} / ${fmtN(dt, 0)} GB` : dp != null ? `${fmtN(dp, 0)} %` : '–')];
        toggles = [eT(g.onboot, 'mdi:power', 'Start ved oppstart', 'Når noden starter'), eT(g.protect, 'mdi:lock', 'Beskyttelse', 'Hindrer sletting'), eT(g.bkSw, 'mdi:backup-restore', 'Med i nattlig backup', 'Planlagt backup')];
        actions = [this._ab('rs-' + k, 'mdi:restart', 'Start på nytt', K('restart') ? `data-id="${esc(K('restart'))}" data-toast="${esc(it.name)} starter på nytt"` : '', true, !K('restart') || !on),
          this._ab('lg-' + k, 'mdi:text-box-outline', 'Logg', `data-act="more" data-id="${esc(it.ent || '')}"`, false, !it.ent),
          this._ab('kn-' + k, 'mdi:console', 'Konsoll', '', false, true),
          this._ab('sn-' + k, 'mdi:camera-outline', 'Snapshot', K('snapshot') ? `data-id="${esc(K('snapshot'))}" data-toast="Snapshot av ${esc(it.name)} startet"` : '', false, !K('snapshot'))];
      } else if (hk === 'unraid') {
        const g = it.g, vm = it.kind === 'VM';
        stats = [{ v: on ? fmtN(it.cpu, 0) : '–', u: '%', l: 'CPU', id: g.cpu }, { v: on ? fmtN(it.ram, 0) : '–', u: '%', l: 'RAM', id: g.mem }, { v: '–', l: 'Disk' },
          { v: '–', l: 'Oppetid' }, { v: (h.states[g.bryter] && h.states[g.bryter].attributes.ip_address) || '–', l: vm ? 'IP' : 'IP' }, { v: '–', l: 'Nett ned / opp' }];
        bars = [bar('CPU', it.cpu, BL, on ? `${fmtN(it.cpu, 0)} %` : 'av'), bar('RAM', it.ram, PU, on ? `${fmtN(it.ram, 0)} %` : 'av'), bar('Disk', null, OR, '–')];
        toggles = vm ? [eT(g.autostart, 'mdi:power', 'Autostart', 'Når arrayet starter'), eT(g.bkSw, 'mdi:backup-restore', 'Med i backup', 'Planlagt backup')]
          : [eT(g.autostart, 'mdi:power', 'Autostart', 'Når arrayet starter'), eT(g.autoupd, 'mdi:update', 'Automatisk oppdatering', 'CA Auto Update'), eT(g.bkSw, 'mdi:backup-restore', 'Med i appdata-backup', 'Planlagt backup')];
        actions = [this._ab('rs-' + k, 'mdi:restart', 'Start på nytt', g.restart ? `data-id="${esc(g.restart)}" data-toast="${esc(it.name)} starter på nytt"` : '', true, !g.restart || !on),
          this._ab('lg-' + k, 'mdi:text-box-outline', 'Logg', `data-act="more" data-id="${esc(g.bryter)}"`),
          this._ab('kn-' + k, 'mdi:console', 'Konsoll', '', false, true),
          this._ab('up-' + k, 'mdi:update', 'Oppdater', g.oppdater ? `data-id="${esc(g.oppdater)}" data-toast="${esc(it.name)} oppdateres"` : '', false, !g.oppdater || it.lock)];
      } else {
        const a = it.a, slug = a.slug, I = (slug && SUP.info[slug]) || null, S = (slug && SUP.stats[slug]) || null;
        const memU = S && S.memory_usage != null ? S.memory_usage / 1e9 : null, memL = S && S.memory_limit ? S.memory_limit / 1e9 : null;
        const mb = (x) => (x == null ? '–' : fmtN(x / 1e6, x / 1e6 < 100 ? 1 : 0));
        const ver = (I && I.version) || (a.ver && ok(h.states[a.ver]) ? h.states[a.ver].state : null) || (a.sup && a.sup.version) || '–';
        stats = [{ v: on ? fmtN(it.cpu) : '–', u: '%', l: 'CPU', id: a.cpu }, memU != null ? { v: on ? fmtN(memU, 1) : '–', u: 'GB', l: `RAM av ${fmtN(memL, memL < 10 ? 1 : 0)} GB` } : { v: on ? fmtN(it.ram, 0) : '–', u: '%', l: 'RAM', id: a.mem },
          { v: '–', l: 'Disk' }, { v: '–', l: 'Oppetid' }, { v: ver, l: 'Versjon', id: a.upd }, { v: S && S.network_rx != null ? `${mb(S.network_rx)} / ${mb(S.network_tx)}` : '–', u: 'MB', l: 'Nett ned / opp' }];
        bars = [bar('CPU', it.cpu, BL, on ? `${fmtN(it.cpu, 0)} %` : 'av'), bar('RAM', it.ram, PU, on ? (memU != null ? `${fmtN(memU, 1)} / ${fmtN(memL, 0)} GB` : `${fmtN(it.ram, 0)} %`) : 'av'), bar('Disk', null, OR, '–')];
        const sT = (key, icon, label, sub) => { if (!I) return nope(icon, label); const v = key === 'boot' ? I.boot === 'auto' : !!I[key]; return { icon, label, sub, on: v, attrs: `data-act="opt" data-slug="${esc(slug)}" data-k="${key}" data-label="${esc(label)}"` }; };
        toggles = [sT('boot', 'mdi:power', 'Start ved oppstart', 'Starter når HA starter'), sT('watchdog', 'mdi:dog-side', 'Watchdog', 'Restarter hvis den krasjer'), sT('auto_update', 'mdi:update', 'Automatisk oppdatering', 'Nye versjoner installeres'), sT('ingress_panel', 'mdi:dock-left', 'Vis i sidepanel', 'Snarvei i HA-menyen')];
        const sv = (svc, data, toast) => `data-svc="${svc}" data-data="${esc(JSON.stringify(data))}" data-toast="${esc(toast)}"`;
        actions = [this._ab('rs-' + k, 'mdi:restart', 'Start på nytt', slug ? sv('hassio.addon_restart', { addon: slug }, `${it.name} starter på nytt`) : '', true, !slug || !on || !has(h, 'hassio', 'addon_restart')),
          this._ab('lg-' + k, 'mdi:text-box-outline', 'Logg', slug ? `data-nav="/hassio/addon/${esc(slug)}/logs"` : '', false, !slug),
          this._ab('op-' + k, 'mdi:open-in-new', 'Åpne', slug ? `data-nav="${I && I.ingress ? `/hassio/ingress/${esc(slug)}` : `/hassio/addon/${esc(slug)}/info`}"` : '', false, !slug),
          this._ab('bk-' + k, 'mdi:backup-restore', 'Backup', slug ? sv('hassio.backup_partial', { addons: [slug], name: it.name }, `Backup av ${it.name} startet`) : '', false, !slug || !has(h, 'hassio', 'backup_partial'))];
      }
      return this._detail(stats, bars, toggles, actions);
    }

    /* ---------------------------------------------------------- Nettverk */
    // Fiks 50 G: Internett-kortet (designet: sec.wan / wan / stInfo) – SpeedTest-sensorene (speedtestdotnet), Mbit/s avrundet
    _internett() {
      const h = this.hass, I = oppdagST(h, this.config).ids, run = !!this._st;
      const mb = (id) => { if (run) return null; const v = numOf(h, id); return v == null ? null : v * rateF(unitOf(h, id)); };
      const ping = run ? null : numOf(h, I.ping), ds = I.down && h.states[I.down];
      const none = !I.down && !I.up && !I.ping;
      const meta = run ? 'Måler …' : none ? '– · Velg entitet' : ok(ds) || ping != null ? [`Ping ${ping == null ? '–' : M.nf(ping, ping < 10 && ping % 1 ? 1 : 0)} ms`, ok(ds) ? `målt ${maltTxt(ds.last_updated)}` : null].filter(Boolean).join(' · ') : '–';
      const tile = (icon, label, col, id) => { const v = mb(id); return `<button class="wt press" ${id ? `data-act="more" data-id="${esc(id)}" data-ent="${esc(id)}"` : 'data-act="customize" data-section="speedtest"'} data-key="wt-${label}"><span class="wl">${M.icon(icon, 16, `color:${col}`)}${esc(label)}</span><span class="wv"><span class="num">${v == null ? '–' : M.nf(Math.round(v))}</span><span>Mbit/s</span></span></button>`; };
      return `<section class="card wan" data-key="wan"><span class="wh"><span class="grow wcol"><span class="ct">Internett</span><button class="wmeta num" ${none ? 'data-act="customize" data-section="speedtest"' : I.ping && !run ? `data-act="more" data-id="${esc(I.ping)}"` : 'tabindex="-1"'}>${esc(meta)}</button></span>
          <button class="strun${run ? ' run' : ''}" data-act="st" data-haptic="medium" ${run || none ? 'disabled' : ''} aria-label="Kjør speedtest">${M.icon('mdi:speedometer', 16)}Kjør test</button></span>
        ${tile('mdi:arrow-down', 'Ned', TX.blue, I.down)}${tile('mdi:arrow-up', 'Opp', TX.green, I.up)}</section>`;
    }
    // Fiks 50 K: Nettverk-underfanene UDM · Enheter · Switch – innholdet under Internett-kortet kommer fra M.serverUnifi (S2)
    _su(sub, R) {
      const su = M.serverUnifi;
      if (!su || typeof su.html !== 'function') return null;
      try { return su.html(this._host, sub, R) || ''; } catch (e) { return this._failHTML(e); }
    }
    _b_net_udm(R) { const x = this._su('udm', R); return this._internett(R) + (x || ''); }
    _b_net_enheter(R) { const x = this._su('enheter', R); return x != null ? x : this._enheterV1(R); }
    _b_net_switch(R) { const x = this._su('switch', R); return x != null ? x : this._switchV1(R); }

    /* ---------------------------------------------------------- Fiks 50 E: qBittorrent (designet: QB_T / QB_S / qb) */
    _qb() {
      const h = this.hass, Q = oppdagQB(h, this.config).ids;
      const cnt = (id) => numOf(h, id);
      const spd = (id) => { const v = numOf(h, id); return v == null ? null : v * mbsF(unitOf(h, id)); };
      return { Q, cnt, spd };
    }
    _qbTap(id, extra) { return id ? `data-act="more" data-id="${esc(id)}" data-ent="${esc(id)}"${extra || ''}` : 'tabindex="-1"'; }
    _b_qbit_torrenter() {
      const h = this.hass, { Q, cnt, spd } = this._qb();
      const T = [['active', 'Aktive', BL], ['inactive', 'Inaktive', 'var(--ki-text-3, #7f7f7f)'], ['paused', 'Pauset', OR], ['errored', 'Feil', RD]].map(([k, l, c]) => ({ k, l, c, id: Q[k], n: cnt(Q[k]) }));
      const sum = T.reduce((a, t) => a + (t.n || 0), 0), all = cnt(Q.all) != null ? cnt(Q.all) : T.some((t) => t.n != null) ? sum : null;
      const bar = T.some((t) => t.n != null) ? T.map((t) => `<span style="flex:${Math.max(t.n || 0, 0.5)} 1 0;min-width:4px;background:${t.c}"></span>`).join('') : '<span class="qb0"></span>';
      const tiles = T.map((t) => `<button class="qt press" ${this._qbTap(t.id)} data-key="qt-${t.k}"><span class="ql"><i style="background:${t.c}"></i>${esc(t.l)}</span><span class="qn num">${t.n == null ? '–' : M.nf(t.n)}</span></button>`).join('');
      const fs = (v) => (v == null ? '–' : fmtN(v, v < 100 ? 1 : 0));
      const sp = [['Ned', Q.down, 'mdi:arrow-down', BL], ['Opp', Q.up, 'mdi:arrow-up', GR]].map(([l, id, ic, c]) => `<button class="qs press" ${this._qbTap(id)} data-key="qs-${l}"><span class="qsi" style="background:${tone(c)};color:${c === BL ? TX.blue : TX.green}">${M.icon(ic, 18)}</span><span class="qsc"><span class="qsv num">${esc(fs(spd(id)))} <span>MB/s</span></span><span class="qsl">${esc(l)}</span></span></button>`).join('');
      // alternativ hastighet: bryter 52×32 (rosa gradient når på) → switch.toggle, haptic «medium»
      const as = Q.alt && this.s(Q.alt), on = !!as && this._pendingTgl(Q.alt, as.state === 'on');
      const lim = (id) => { const v = spd(id); return v == null ? null : v === 0 ? 'ubegrenset' : `${mbTxt(v)} MB/s`; };
      const ln = lim(Q.downLim), lu = lim(Q.upLim);
      const altSub = !as || !ok(as) ? '–' : on ? `På · ${ln || '–'} ned · ${lu || '–'} opp` : 'Av · bruker vanlige grenser';
      return `<section class="card qbt" data-key="qbt"><div class="ch">${M.icon('mdi:download', 20, 'color:var(--ki-text-1, #c7c7c7)')}<span class="ct">Torrenter</span><span class="cs num">${all == null ? '–' : `${M.nf(all)} totalt`}</span></div>
          <div class="qbar">${bar}</div><div class="qg">${tiles}</div><div class="qg">${sp}</div></section>
        <button class="card qalt press${on ? ' on' : ''}" ${Q.alt && as ? `data-act="qalt" data-id="${esc(Q.alt)}" data-ent="${esc(Q.alt)}" data-haptic="medium"` : 'disabled'} role="switch" aria-checked="${on}" data-key="qalt">
          <span class="qai">${M.icon('mdi:speedometer', 20)}</span><span class="grow col"><b>Alternativ hastighet</b><span class="ell">${esc(altSub)}</span></span><span class="qtr"><i></i></span></button>`;
    }
    // Fiks 62: arildkristo.com (Cloudflare) – innholdet kommer fra 58c-server-cf.js
    _cfBody(sub) { return M.serverCF ? M.serverCF.body(this, sub) : ''; }
    _b_cf_trafikk() { return this._cfBody('trafikk'); }
    _b_cf_besok() { return this._cfBody('besok'); }
    _b_cf_ytelse() { return this._cfBody('ytelse'); }
    _b_cf_sikkerhet() { return this._cfBody('sikkerhet'); }
    _b_qbit_statistikk() {
      const h = this.hass, { Q, cnt, spd } = this._qb();
      const by = (id) => { const v = numOf(h, id); return v == null ? null : v * bytesF(unitOf(h, id)); };
      const lim = (id) => { const v = spd(id); return v == null ? '–' : v === 0 ? 'Ingen' : `${mbTxt(v)} MB/s`; };
      const ra = numOf(h, Q.ratio);
      const L = [['Totalt lastet ned', Q.dlTot, sizeOf(by(Q.dlTot))], ['Totalt lastet opp', Q.ulTot, sizeOf(by(Q.ulTot))], ['Ratio', Q.ratio, ra == null ? '–' : M.nf(ra, 2)],
        ['Alle torrenter', Q.all, cnt(Q.all) == null ? '–' : M.nf(cnt(Q.all))], ['Grense ned', Q.downLim, lim(Q.downLim)], ['Grense opp', Q.upLim, lim(Q.upLim)]];
      return `<section class="card qst" data-key="qst">${L.map(([l, id, v], i) => `<button class="qx press" ${this._qbTap(id)} data-key="qx-${i}"><span class="num ell">${esc(v)}</span><span>${esc(l)}</span></button>`).join('')}</section>`;
    }
    _devs(R) {
      const ex = new Set(this.config.exclude || []);
      const E = R.unifi.enheter.filter((e) => e.type !== 'enhet' && !ex.has(e.tracker) && !ex.has(e.cpu)).map((e) => ({ kind: e.type, e, id: e.dev }));
      const K = []; // brukervalg (35): UniFi Protect-kameraer vises ikke i Server → Enheter
      return [...E, ...K];
    }
    _camState(k) {
      const cs = this.s(k.cam), md = this.s(k.modus), sw = this.s(k.opptak);
      if (!ok(cs)) return 'off';
      if (md && ok(md)) return /never|aldri/i.test(md.state) ? 'pause' : 'rec';
      if (sw) return sw.state === 'on' ? 'rec' : 'pause';
      return cs.state === 'recording' ? 'rec' : 'pause';
    }
    _enheterV1(R) {
      const h = this.hass, L = this._devs(R);
      if (!L.length) return `<section class="card">${this._head('Enheter', '–')}<div class="none">Fant ingen enheter</div></section>`;
      const ICON = { ruter: 'mdi:router-network', ap: 'mdi:access-point', switch: 'mdi:lan', cam: 'mdi:cctv' };
      let online = 0;
      const rows = L.map(({ kind, e, id }) => {
        let off, meta, model = e.modell || '';
        if (kind === 'cam') {
          [e.cam, e.modus, e.opptak].forEach((x) => this.s(x));
          const S = this._camState(e); off = S === 'off'; meta = off ? 'Frakoblet' : S === 'rec' ? 'Opptak' : 'Pause';
          model = model || (e.ringeklokke ? 'Ringeklokke' : 'Kamera');
        } else {
          [e.tracker, e.cpu, e.klienter, e.tilstand].forEach((x) => this.s(x));
          off = apOffline(h, e);
          const n = kind === 'ruter' ? klientTall(h, R, this.config) : numOf(h, e.klienter);
          meta = off ? 'Frakoblet' : n != null ? `${M.nf(n)} ${n === 1 ? 'klient' : 'klienter'}` : kind === 'switch' && e.porter.length ? `${e.porter.length} porter` : 'Online';
        }
        if (!off) online++;
        const open = this.ui.dx === id, blink = this._blink[id] > Date.now();
        return `<div class="dw${open ? ' open' : ''}${blink ? ' blink' : ''}" data-key="d-${esc(id)}"><button class="dr" data-act="dx" data-v="${esc(id)}" ${kind === 'cam' ? `data-ent="${esc(e.cam)}"` : e.tracker ? `data-ent="${esc(e.tracker)}"` : ''} aria-expanded="${open}">
          <span class="dic${off ? ' off' : ''}">${M.icon(kind === 'cam' && e.ringeklokke ? 'mdi:doorbell-video' : ICON[kind] || 'mdi:devices', 20)}</span>
          <span class="grow col"><b class="ell">${esc(e.navn)}</b><span class="ell">${esc(model || '–')}</span></span>
          <span class="dm${off ? ' off' : ''}">${esc(meta)}</span>${M.icon('mdi:chevron-down', 20, `color:var(--ki-text-mid, #979797);transition:transform .2s;${open ? 'transform:rotate(180deg)' : ''}`)}</button>
          ${open ? this._devDetail(R, kind, e, off) : ''}</div>`;
      }).join('');
      return `<section class="card devs">${this._head('Enheter', `${online} av ${L.length} online`)}${rows}</section>`;
    }
    _devDetail(R, kind, e, off) {
      const h = this.hass, k = e.dev, st = (v, u, l, id) => ({ v, u, l, id });
      const fw = (id) => { const s = id && this.s(id); return s && s.attributes.installed_version ? s.attributes.installed_version : '–'; };
      const tgE = (id, icon, label, sub) => { const s = this.s(id), v = this._pendingTgl(id, !!s && s.state === 'on'); return { icon, label, sub, on: v, attrs: `data-act="tgl" data-sw="${esc(id)}"` }; };
      let stats = [], bars = [], toggles = [], acts = [];
      if (kind === 'cam') {
        const md = e.modus && this.s(e.modus), mv = e.bevegelse && this.s(e.bevegelse), S = this._camState(e);
        const MOD = { always: 'Alltid', detections: 'Deteksjon', never: 'Aldri', schedule: 'Plan', motion: 'Bevegelse' };
        stats = [st(md && ok(md) ? (MOD[md.state] || tittel(md.state)) : S === 'rec' ? 'På' : S === 'pause' ? 'Av' : '–', '', 'Opptaksmodus', e.modus), st(mv ? (mv.state === 'on' ? 'nå' : M.relTime(mv.last_changed)) : '–', '', 'Siste bevegelse', e.bevegelse),
          st(numOf(h, e.bitrate) != null ? fmtN(numOf(h, e.bitrate)) : '–', uShort(unitOf(h, e.bitrate)), 'Bitrate', e.bitrate), st(oppetid(h, e.oppetid), '', off ? 'Status' : 'Oppetid', e.oppetid), st(e.modell || '–', '', 'Modell'), st(off ? 'Frakoblet' : 'Online', '', 'Status')];
        if (e.modus) { const v = this._pendingTgl(e.modus, S === 'rec'); toggles.push({ icon: 'mdi:record-rec', label: 'Opptak', sub: 'Opptaksmodus i Protect', on: v, attrs: `data-act="tgl" data-sel="${esc(e.modus)}"`, dis: off }); }
        else if (e.opptak) toggles.push(tgE(e.opptak, 'mdi:record-rec', 'Opptak', 'UniFi Protect'));
        acts = [this._ab('rs-' + k, 'mdi:restart', 'Start på nytt', e.restart ? `data-id="${esc(e.restart)}" data-toast="${esc(e.navn)} starter på nytt"` : '', true, !e.restart)];
        return this._detail(stats, bars, toggles, acts);
      }
      [e.cpu, e.mem, e.temp, e.oppetid, e.kanal, e.oppdatering, e.txp, e.fan, e.budsjett, e.b5, e.b24].forEach((x) => this.s(x));
      const pc = (id) => { const v = pctOf(h, id); return v == null ? '–' : fmtN(v, 0); };
      if (kind === 'ruter') {
        const n = klientTall(h, R, this.config);
        stats = [st(pc(e.cpu), '%', 'CPU', e.cpu), st(pc(e.mem), '%', 'Minne', e.mem), st(numOf(h, e.temp) == null ? '–' : fmtN(numOf(h, e.temp), 0), '°', 'Temp', e.temp), st(n == null ? '–' : M.nf(n), '', 'Klienter'), st(oppetid(h, e.oppetid), '', 'Oppetid', e.oppetid), st(fw(e.oppdatering), '', 'Firmware', e.oppdatering)];
      } else if (kind === 'ap') {
        const n = numOf(h, e.klienter);
        stats = [st(n == null ? '–' : M.nf(n), '', 'Klienter', e.klienter), st(fmt(h, e.kanal), '', 'Kanal', e.kanal), st(fmt(h, e.txp), '', 'Sendestyrke', e.txp), st('–', '', 'Snitt signal'), st(off ? 'Frakoblet' : oppetid(h, e.oppetid), '', off ? 'Status' : 'Oppetid', e.oppetid), st(fw(e.oppdatering), '', 'Firmware', e.oppdatering)];
        const b5 = numOf(h, e.b5), b24 = numOf(h, e.b24), tot = (b5 || 0) + (b24 || 0);
        if (b5 != null || b24 != null) bars = [['5 GHz', b5], ['2,4 GHz', b24]].map(([l, v]) => ({ l, p: tot ? ((v || 0) / tot) * 100 : 0, c: BL, v: v == null ? '–' : `${M.nf(v)} klienter` }));
      } else {
        const P = e.porter, nUp = this._ports(e).filter((p) => p.up).length, poe = P.reduce((a, p) => a + (numOf(h, p.pw) || 0), 0), bud = numOf(h, e.budsjett);
        stats = [st(P.some((p) => p.pw) ? fmtN(poe, poe < 10 ? 1 : 0) : '–', 'W', `PoE${bud != null ? ` av ${M.nf(bud)} W` : ''}`, e.budsjett), st(numOf(h, e.temp) == null ? '–' : fmtN(numOf(h, e.temp), 0), '°', 'Temp', e.temp), st(fmt(h, e.fan), '', 'Vifte', e.fan),
          st(`${nUp} / ${Math.max(e.antall, 1)}`, '', 'Porter oppe'), st(off ? 'Frakoblet' : oppetid(h, e.oppetid), '', off ? 'Status' : 'Oppetid', e.oppetid), st(fw(e.oppdatering), '', 'Firmware', e.oppdatering)];
      }
      if (e.led) toggles.push(tgE(e.led, 'mdi:led-on', 'LED-lys', kind === 'switch' ? 'Port-LED-er' : 'Ring på enheten'));
      (e.brytere || []).forEach((id) => toggles.push(tgE(id, 'mdi:toggle-switch-outline', fName(h, id).replace(new RegExp('^' + e.navn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*', 'i'), '') || fName(h, id), 'UniFi')));
      const upd = e.oppdatering && h.states[e.oppdatering], updOn = upd && upd.state === 'on';
      acts.push(this._ab('rs-' + k, 'mdi:restart', 'Start på nytt', e.restart ? `data-id="${esc(e.restart)}" data-toast="${esc(e.navn)} starter på nytt"` : '', true, !e.restart || off));
      const loc = e.finn || e.led;
      acts.push(loc ? `<button class="ab" data-act="locate" data-id="${esc(loc)}" data-dev="${esc(k)}">${M.icon('mdi:crosshairs-gps', 18)}Finn</button>` : this._ab('fi-' + k, 'mdi:crosshairs-gps', 'Finn', '', false, true));
      if (kind === 'ruter' && e.speedtest) acts.push(this._ab('st-' + k, 'mdi:speedometer', 'Fartstest', `data-id="${esc(e.speedtest)}" data-toast="Fartstest kjører …"`));
      if (kind === 'ap' && e.optim) acts.push(this._ab('oc-' + k, 'mdi:tune-variant', 'Optimaliser kanal', `data-id="${esc(e.optim)}" data-toast="Kanalskanning startet"`));
      const cyc = kind === 'switch' ? e.porter.map((p) => p.cyc).filter(Boolean) : [];
      if (cyc.length) acts.push(this._ab('pc-' + k, 'mdi:power-cycle', 'PoE-sykle alle', `data-ids="${esc(cyc.join(','))}" data-toast="PoE-porter sykles"`, true, off));
      acts.push(this._ab('up-' + k, 'mdi:update', 'Oppdater', updOn ? `data-id="${esc(e.oppdatering)}" data-toast="${esc(e.navn)} oppdateres"` : '', false, !updOn));
      return this._detail(stats, bars, toggles, acts);
    }
    // Porter for en switch: [{ n, sp: g|x|f|off|'', up, poe, name, ent }]
    _ports(e) {
      const h = this.hass, P = {}; e.porter.forEach((p) => { P[p.n] = p; });
      const isOn = (id) => !!id && h.states[id] && h.states[id].state === 'on';
      const re = new RegExp('^' + e.navn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*', 'i');
      return Array.from({ length: Math.max(e.antall, 1) }, (_, i) => {
        const n = i + 1, p = P[n];
        if (!p) return { n, sp: '', up: false, poe: false, name: '' };
        [p.en, p.poe, p.pw, p.rx, p.speed].forEach((id) => this.s(id));
        const dis = p.en && !isOn(p.en), spd = numOf(h, p.speed), su = unitOf(h, p.speed);
        const mbit = spd == null ? null : /^g/i.test(su) ? spd * 1000 : spd;
        let up = false;
        if (!dis) { if (p.speed && ok(h.states[p.speed])) up = spd > 0; else if (p.rx && ok(h.states[p.rx])) up = numOf(h, p.rx) > 0; else if (p.en) up = isOn(p.en); else up = isOn(p.poe) || (numOf(h, p.pw) || 0) > 0; }
        const sp = dis ? 'off' : !up ? '' : mbit == null ? 'g' : mbit >= 2500 ? 'x' : mbit >= 1000 ? 'g' : 'f';
        const raw = fName(h, p.poe || p.en || p.cyc).replace(re, '').replace(/\s*(PoE|Power cycle|Strømsyklus)$/i, '').trim();
        const name = /^port\s*\d+$/i.test(raw) ? '' : raw;
        return { n, sp, up, poe: isOn(p.poe) && (numOf(h, p.pw) == null || numOf(h, p.pw) > 0), name, ent: p.poe || p.en || p.speed };
      });
    }
    _switchV1(R) {
      const h = this.hass, ex = new Set(this.config.exclude || []);
      const SW = R.unifi.enheter.filter((e) => e.type === 'switch' && !ex.has(e.tracker));
      if (!SW.length) return `<section class="card sw">${this._head('Switch', '–')}<div class="none">Fant ingen switcher</div></section>`;
      const SPC = { g: GR, x: BL, f: OR };
      const info = SW.map((e) => { [e.tracker, e.tilstand, e.budsjett].forEach((x) => this.s(x)); const P = this._ports(e), off = apOffline(h, e); return { e, P, off, up: P.filter((p) => p.up).length, poe: e.porter.reduce((a, p) => a + (numOf(h, p.pw) || 0), 0), hasPoe: e.porter.some((p) => p.pw), bud: numOf(h, e.budsjett) }; });
      info.sort((a, b) => (a.off ? 1 : 0) - (b.off ? 1 : 0) || b.P.length - a.P.length || a.e.navn.localeCompare(b.e.navn, 'nb'));
      const cur = info.find((x) => x.e.dev === this.ui.swSel) || info[0], e = cur.e;
      const grid = info.length > 1 ? `<div class="swg">${info.map((x) => {
        const on = x === cur;
        return `<button class="swc${on ? ' on' : ''}${x.off ? ' off' : ''}" data-act="swsel" data-v="${esc(x.e.dev)}" data-haptic="selection" aria-pressed="${on}"><span class="ell swn">${esc(x.e.navn.replace(/^Switch\s+/i, ''))}</span>
          <span class="leds">${x.P.map((p) => `<i style="background:${x.off ? M.alpha(OR, 0.35) : SPC[p.sp] || 'var(--ki-ctrl, #545454)'}"></i>`).join('')}</span>
          <span class="sws ell">${x.off ? 'Frakoblet' : `${x.up}/${x.P.length}${x.hasPoe ? ` · ${fmtN(x.poe, 0)} W PoE` : ''}`}</span></button>`;
      }).join('')}</div>` : '';
      const area = e.dev && h.devices && h.devices[e.dev] && h.devices[e.dev].area_id && h.areas && h.areas[h.devices[e.dev].area_id];
      const sum = cur.off ? 'Frakoblet' : `${cur.up} av ${cur.P.length} oppe${cur.hasPoe ? ` · ${fmtN(cur.poe, 0)}${cur.bud != null ? ` / ${M.nf(cur.bud)}` : ''} W PoE` : ''}`;
      const sel = cur.P.find((p) => String(p.n) === String(this.ui.port));
      const SPT = { g: '1 G', x: '2,5 G', f: '100 M' };
      const pinfo = sel ? [`Port ${sel.n}`, sel.sp === 'off' ? 'Deaktivert' : sel.name || (sel.up ? '' : 'Ledig'), SPT[sel.sp] || '', sel.poe ? 'PoE' : ''].filter(Boolean).join(' · ') : 'Grønn 1 G · blå 2,5 G · oransje 100 M · strek under = PoE';
      const ports = cur.P.map((p) => {
        const on = sel === p;
        return `<button class="pt${p.up ? ' up' : ''}${p.sp === 'off' ? ' dis' : ''}${on ? ' sel' : ''}${p.poe ? ' poe' : ''}" data-act="port" data-v="${p.n}" data-haptic="selection" ${p.ent ? `data-ent="${esc(p.ent)}"` : ''} aria-pressed="${on}" aria-label="Port ${p.n}${p.up ? ' oppe' : ''}${p.poe ? ', PoE' : ''}"><i style="background:${SPC[p.sp] || 'var(--ki-text-lo, #454545)'}"></i><span class="num">${p.n}</span></button>`;
      }).join('');
      return `<section class="card sw">${grid}<div class="swh"><span class="grow col"><b class="ell">${esc(e.navn)}</b><span class="ell">${esc([e.modell || '–', area ? area.name : null].filter(Boolean).join(' · '))}</span></span><span class="cs">${esc(sum)}</span></div>
        <div class="pg" style="grid-template-columns:repeat(${Math.min(8, cur.P.length)},minmax(0,1fr))">${ports}</div><span class="pinfo">${esc(pinfo)}</span></section>`;
    }

    /* ---------------------------------------------------------- Proxmox */
    _b_proxmox_gjester(R, HA) { return this._glist(R, HA, 'proxmox'); }
    _b_proxmox_lagring(R) {
      const h = this.hass, ex = new Set(this.config.exclude || []), rows = [];
      const area = (navn, id, brukt, tot) => {
        [id, brukt, tot].forEach((x) => this.s(x));
        const p = pctOf(h, id, brukt, tot), b = toGB(h, brukt), t = toGB(h, tot);
        const meta = b != null && t != null ? `${sizeTxt(b).replace(/ (GB|TB)$/, t >= 1000 === b >= 1000 ? '' : ' $1')} av ${sizeTxt(t)}` : p != null ? `${M.nf(p)} %` : '–';
        rows.push(`<div class="stg" ${id || brukt ? `data-act="more" data-id="${esc(id || brukt)}" data-ent="${esc(id || brukt)}" role="button"` : ''}><div class="stl"><b class="ell">${esc(navn)}</b><span>${esc(meta)}</span></div><div class="bar8"><i style="width:${p == null ? 0 : M.clamp(p, 0, 100).toFixed(1)}%;background:${p != null && p >= STORE_WARN ? OR : BL}"></i></div></div>`);
      };
      const n = R.proxmox.noder[0];
      if (n && (n.disk || n.diskBrukt) && !R.proxmox.lagring.some((g) => g.navn === 'local')) area('local', n.disk, n.diskBrukt, n.diskTot);
      R.proxmox.lagring.filter((g) => !ex.has(g.bruk)).forEach((g) => area(g.navn, g.bruk, g.brukt, g.total));
      return `<section class="card stc"><span class="ct">Lagring</span>${rows.join('') || '<div class="none">Fant ingen lagringsområder</div>'}</section>`;
    }
    _b_proxmox_backup(R) {
      const h = this.hass, n = R.proxmox.noder[0] || {}, id = n.backup, s = id && this.s(id);
      let title = 'Backup', sub = '–', cls = 'none';
      if (s && ok(s)) {
        if (dom(id) === 'binary_sensor') { const bad = s.attributes.device_class === 'problem' ? s.state === 'on' : s.state === 'off'; title = bad ? 'Siste backup feilet' : 'Siste backup fullført'; cls = bad ? 'bad' : 'ok'; sub = M.relTime(s.last_changed); }
        else if (s.attributes.device_class === 'timestamp' || /^\d{4}-\d\d-\d\dT/.test(s.state)) { title = 'Siste backup'; sub = M.relTime(s.state); cls = 'ok'; }
        else { title = 'Backup'; sub = fmt(h, id); cls = /fail|feil|error/i.test(s.state) ? 'bad' : 'ok'; }
      }
      const btn = ((n.knapper || []).find((k) => k.a === 'backup') || {}).id;
      return `<div class="bkr" ${id ? `data-act="more" data-id="${esc(id)}" data-ent="${esc(id)}" role="button"` : ''}><span class="bki ${cls}">${M.icon(cls === 'bad' ? 'mdi:alert' : 'mdi:backup-restore', 20)}</span><span class="grow col"><b>${esc(title)}</b><span class="ell">${esc(sub)}</span></span></div>
        ${btn ? `<div class="xa">${this._ab('bkn', 'mdi:backup-restore', 'Backup nå', `data-id="${esc(btn)}" data-toast="Backup startet"`)}</div>` : ''}`;
    }

    /* ---------------------------------------------------------- Unraid */
    _b_unraid_gjester(R, HA) {
      if (R.unraid && R.unraid.glances) return `<section class="card">${this._head('Gjester', '–', 'mdi:cube-outline')}<div class="none">Glances gir bare målinger – Docker og VM-er krever Unraid-integrasjonen</div></section>`;
      return this._glist(R, HA, 'unraid');
    }
    _b_unraid_array(R) {
      const h = this.hass, U = R.unraid || {}, ex = new Set(this.config.exclude || []);
      if (U.glances) return `<section class="card">${this._head('Array', '–')}<div class="none">Glances gir bare målinger – arrayet krever Unraid-integrasjonen</div></section>`;
      [U.arrayStatus, U.arraySw, U.arrayBruk, U.arrayBrukt, U.arrayTot].forEach((x) => this.s(x));
      const stop = STOPP(h, U), D = (U.disker || []).filter((d) => !ex.has(d.temp) && !ex.has(d.bruk));
      const hvile = (d) => { const sp = d.spin && this.s(d.spin), sw = d.spinSw && this.s(d.spinSw), t = d.temp && this.s(d.temp); if (sp && ok(sp)) return sp.state === 'off'; if (sw && ok(sw)) return sw.state === 'off'; return !!t && t.state === 'standby'; };
      const nRest = D.filter((d) => !/parity|cache/.test(d.navn) && hvile(d)).length;
      const tot = toGB(h, U.arrayTot), used = toGB(h, U.arrayBrukt), p = pctOf(h, U.arrayBruk, U.arrayBrukt, U.arrayTot);
      const sub = stop ? 'Stoppet · Docker og VM-er er av' : ['Startet', tot != null ? sizeTxt(tot) : null, `${nRest} i hvile`].filter(Boolean).join(' · ');
      const target = stop ? (U.arrayStart || U.arraySw) : (U.arrayStopp || U.arraySw);
      const bays = D.map((d) => {
        [d.temp, d.bruk, d.spin, d.spinSw].forEach((x) => this.s(x));
        const par = /^parity/.test(d.navn), cache = /^cache/.test(d.navn), pc = pctOf(h, d.bruk, d.brukt, d.total), t = numOf(h, d.temp);
        const sl = !par && !cache && (stop || hvile(d)), short = par ? 'P' : cache ? 'C' : (d.navn.match(/\d+/) || [d.navn])[0];
        const col = cache ? PU : pc != null && pc >= 85 ? OR : BL, title = diskNavn(d.navn);
        const msg = par ? `${title} · gyldig` : pc != null ? `${title} · ${M.nf(pc)} % brukt` : title;
        return `<button class="bay" data-act="bay" data-msg="${esc(msg)}" ${d.temp ? `data-ent="${esc(d.temp)}"` : ''} title="${esc(title)}" aria-label="${esc(title)}">
          <span class="bb${par ? ' par' : ''}${sl ? ' sl' : ''}"><span class="bf" style="height:${par ? 100 : pc == null ? 0 : M.clamp(pc, 0, 100).toFixed(1)}%;background:${par ? M.alpha(PK, 0.18) : M.alpha(col, sl ? 0.18 : 0.45)}"></span>${sl ? `<span class="bz">${M.icon('mdi:weather-night', 16)}</span>` : ''}<span class="bp">${par || pc == null ? '' : M.nf(pc) + '%'}</span></span>
          <span class="bn"><b>${esc(short)}</b><span class="${!sl && t != null && t >= TEMP_WARN ? 'hot' : ''}">${sl ? 'hvile' : t == null || (stop && !cache) ? '–' : M.nf(t) + '°'}</span></span></button>`;
      }).join('');
      const usedTxt = stop ? 'Utilgjengelig' : used != null ? `${sizeTxt(used)} brukt` : p != null ? `${M.nf(p)} % brukt` : '–';
      const freeTxt = stop ? '' : used != null && tot != null ? `${sizeTxt(Math.max(0, tot - used))} ledig` : '';
      return `<section class="card arr"><div class="arh"><span class="grow col"><b>Array</b><span>${esc(sub)}</span></span>
          <button class="hold${stop ? ' start' : ''}" ${target ? `data-hold="${esc(target)}" data-stop="${stop ? 0 : 1}"` : 'disabled'} data-haptic="off" aria-label="${stop ? 'Start arrayet (hold inne)' : 'Stopp arrayet (hold inne)'}"><span class="hf"></span>${M.icon(stop ? 'mdi:play' : 'mdi:stop', 18, 'position:relative')}<span class="hl">${stop ? 'Start' : 'Stopp'}</span></button></div>
        ${D.length ? `<div class="bays">${bays}</div>` : '<div class="none">Fant ingen disker</div>'}
        <div class="use"><div class="ut"><span>${esc(usedTxt)}</span><span>${esc(freeTxt)}</span></div><div class="bar8"><i style="width:${stop || p == null ? 0 : M.clamp(p, 0, 100).toFixed(1)}%;background:${BL}"></i></div></div></section>`;
    }

    /* ---------------------------------------------------------- HA */
    _b_ha_tillegg(R, HA) { return this._glist(R, HA, 'ha'); }
    _b_ha_oppdateringer(R, HA) {
      const h = this.hass, E = h.entities || {}, ids = this._updIds();
      const coreish = (id) => { const e = E[id]; if (!e || e.platform !== 'hassio') return false; const d = e.device_id && h.devices && h.devices[e.device_id]; return !d || !/add-?on/i.test(`${d.model || ''} ${d.name || ''}`); };
      const L = ids.filter((id) => h.states[id].state === 'on' || coreish(id) || this._upd[id]).sort((a, b) => (h.states[b].state === 'on') - (h.states[a].state === 'on') || fName(h, a).localeCompare(fName(h, b), 'nb'));
      let left = 0;
      const rows = L.map((id) => {
        const s = this.s(id), A = s.attributes, on = s.state === 'on', mine = this._upd[id];
        const busy = on && (A.in_progress === true || typeof A.in_progress === 'number' || (mine && Date.now() - mine.t < 600000));
        if (on && !busy) left++;
        const name = String(A.title || A.friendly_name || obj(id)).replace(/\s+(update|oppdatering)$/i, '');
        const ic = /core/i.test(id) ? 'mdi:home-assistant' : /operating_system|_os_/.test(id) ? 'mdi:dns' : /supervisor/.test(id) ? 'mdi:shield-home' : coreish(id) ? 'mdi:home-assistant' : E[id] && E[id].platform === 'hassio' ? 'mdi:puzzle' : 'mdi:package-up';
        const ver = on ? `${A.installed_version || '–'} → ${A.latest_version || '–'}` : `${A.installed_version || A.latest_version || '–'} · nyeste`;
        const lbl = busy ? 'Installerer…' : on ? 'Installer' : 'Oppdatert';
        return `<div class="ur" data-key="u-${esc(id)}"><span class="uic">${M.icon(ic, 20)}</span><span class="grow col" data-ent="${esc(id)}"><b class="ell">${esc(name)}</b><span class="num ell">${esc(ver)}</span></span>
          <button class="ub ${busy ? 'busy' : on ? 'go' : 'done'}" ${on && !busy ? `data-act="install" data-id="${esc(id)}" data-haptic="off"` : 'aria-disabled="true"'}>${esc(lbl)}</button></div>`;
      }).join('');
      return `<section class="card upd"><div class="ch pad"><span class="ct">Oppdateringer</span><span class="cs">${left ? `${left} tilgjengelig` : 'Alt oppdatert'}</span></div>${rows || '<div class="none in">Ingen oppdateringer funnet</div>'}</section>`;
    }
    _b_ha_system(R, HA) {
      const h = this.hass, iv = (o) => { const s = o && o.upd && this.s(o.upd); return s && s.attributes.installed_version; };
      const core = iv(HA.core) || (SUP.core && SUP.core.version) || (h.config && h.config.version) || '–';
      const os = iv(HA.os) || (HA.os.ver && ok(this.s(HA.os.ver)) ? this.s(HA.os.ver).state : null) || (SUP.os && SUP.os.version) || '–';
      this.s(HA.sys.uptime); this.s(HA.sys.db);
      const tiles = [[core, 'Core'], [os, 'OS'], [oppetid(h, HA.sys.uptime), 'Oppetid', HA.sys.uptime], [HA.sys.db ? fmt(h, HA.sys.db) : '–', 'Database', HA.sys.db], [M.nf(Object.keys(h.states).length), 'Entiteter'], [CE.total != null ? M.nf(CE.total) : '–', 'Integrasjoner']];
      const sv = (svc, toast) => `data-svc="${svc}" data-toast="${esc(toast)}"`;
      const bk = has(h, 'hassio', 'backup_full') && h.services ? 'hassio.backup_full' : h.services && has(h, 'backup', 'create') ? 'backup.create' : 'hassio.backup_full';
      const acts = [this._ab('ha-rs', 'mdi:restart', 'Start HA på nytt', sv('homeassistant.restart', 'Home Assistant starter på nytt'), true, !has(h, 'homeassistant', 'restart'), 'on-s'),
        this._ab('ha-cc', 'mdi:clipboard-check-outline', 'Sjekk config', sv('homeassistant.check_config', 'Sjekker konfigurasjonen …'), false, !has(h, 'homeassistant', 'check_config'), 'on-s'),
        this._ab('ha-bk', 'mdi:backup-restore', 'Ta backup', sv(bk, 'Backup startet'), false, !has(h, bk.split('.')[0], bk.split('.')[1]), 'on-s'),
        this._ab('ha-rb', 'mdi:power', 'Start vert på nytt', sv('hassio.host_reboot', 'Verten starter på nytt'), true, !has(h, 'hassio', 'host_reboot') || !HA.supervisor && !h.services, 'on-s')];
      return `<section class="card sys">${tiles.map(([v, l, id]) => `<div class="syt"${id ? ` data-act="more" data-id="${esc(id)}" data-ent="${esc(id)}" role="button"` : ''}><span class="num ell">${esc(v)}</span><span>${esc(l)}</span></div>`).join('')}</section><div class="xa">${acts.join('')}</div>`;
    }

    /* ---------------------------------------------------------- gester */
    afterRender() {
      const Rt = this.shadowRoot;
      // Fiks 52 A3: etter første fulle tegning – start 24 t-historikken; mål høyden til skjelettet neste gang (etter maling)
      if (this._settled && !this._skel) {
        if (this._histSoon) { this._histSoon = false; setTimeout(() => this._loadHist(), 0); }
        const host = this.tab, sub = this._sub(host);
        if (host === 'cf' && M.serverCF) M.serverCF.loadStats(this, sub); // Fiks 62: bare når fanen vises (fallgruve 8)
        clearTimeout(this._skhT);
        this._skhT = setTimeout(() => {
          if (!this.isConnected || this._skel || this.tab !== host) return;
          const pr = Rt.querySelector('.prose'), pa = Rt.querySelector('.pane') || Rt.querySelector('.card.nf');
          if (pa && pa.offsetHeight) skhSet(this, host, sub, pr ? pr.offsetHeight : 0, pa.offsetHeight);
        }, 600);
      }
      // Vertvelgeren (fanelinje / kort): hold 400 ms + dra = ny rekkefølge (tab_order), kort trykk bytter vert.
      // Fiks 50 F: begge er vannrette karuseller – fade på siden med skjult innhold, aktiv fane sentreres.
      const sc = Rt.querySelector('.trow .tabs[role="tablist"]') || Rt.querySelector('.hcards');
      if (sc && M.tabRow) M.tabRow(this, sc, { active: () => this.tab, order: () => tabsCfg(this.config).order, field: 'tab_order', glass: !sc.classList.contains('hcards') });
      if (sc) this._carousel(sc);
      // Fiks 50 H–M: underfanene fra 58b-server-unifi.js kobler sine egne gester (idempotent, etter hver morph)
      const su = M.serverUnifi, pane = Rt.querySelector('.pane');
      if (su && typeof su.bind === 'function' && pane && this.tab === 'net') { try { su.bind(this._host, pane, this._sub('net'), this._R); } catch (e) { console.error('[ki-msh] serverUnifi.bind', e); } }
      // søkefeltet: verdien (property) følger søket for valgt vert (morph oppdaterer bare attributtet)
      const qi = Rt.querySelector('.srch input'), qv = this._q[this.tab] || '';
      if (qi && qi.value !== qv && Rt.activeElement !== qi) qi.value = qv;
      const scr = Rt.querySelector('.scrub');
      if (scr && !scr.__b) {
        const sc = scr;
        sc.__b = true;
        M.guardDrag(sc, 'none'); // fallgruve 2: touch-action none + stopPropagation
        const pos = (e) => { const r = sc.getBoundingClientRect(); return M.clamp(Math.round(((e.clientX - r.left) / r.width) * (NPT - 1)), 0, NPT - 1); };
        let down = false;
        const stop = (e) => e.stopPropagation();
        sc.addEventListener('touchstart', stop, { passive: true });
        sc.addEventListener('touchmove', stop, { passive: true });
        sc.addEventListener('pointerdown', (e) => { e.stopPropagation(); down = true; try { sc.setPointerCapture(e.pointerId); } catch (x) { /* */ } const p = pos(e); if (p !== this.ui.sel) { M.haptic('selection'); this.setUI({ sel: p }); } });
        sc.addEventListener('pointermove', (e) => { if (!down && e.pointerType !== 'mouse') return; e.stopPropagation(); const p = pos(e); if (p !== this.ui.sel) { if (down && p % 4 === 0) M.haptic('selection'); this.setUI({ sel: p }); } });
        const end = () => { down = false; if (this.ui.sel != null) this.setUI({ sel: null }); };
        sc.addEventListener('pointerup', end);
        sc.addEventListener('pointercancel', end);
        sc.addEventListener('pointerleave', end);
      }
      // Array Start/Stopp: hold for å bekrefte (900 ms fyll)
      const hb = Rt.querySelector('.hold[data-hold]');
      if (hb && !hb.__b) {
        hb.__b = true;
        hb.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
        hb.addEventListener('contextmenu', (e) => e.preventDefault());
        hb.addEventListener('pointerdown', (e) => { if (e.button) return; e.stopPropagation(); try { hb.setPointerCapture(e.pointerId); } catch (x) { /* */ } this._holdStart(hb); });
        const up = (e) => { if (e) e.stopPropagation(); this._holdCancel(hb); };
        hb.addEventListener('pointerup', up); hb.addEventListener('pointercancel', up); hb.addEventListener('pointerleave', up);
      }
    }
    // Fiks 50 F (designet: tabStop / fadeTabs / tap → scrollTo): fade 18 px bare på siden med skjult innhold (scroll + resize),
    // aktiv fane sentreres – myk ved trykk, uten animasjon når popupen åpnes. stopPropagation på pointerdown/touchstart/touchmove
    // (fallgruve 2) ligger i MSH.tabReorder/tabPress på scrolleren; her i tillegg for kort-modus uten omorganisering.
    _carousel(sc) {
      if (!sc.__svCar) {
        sc.__svCar = true;
        const stop = (e) => e.stopPropagation();
        sc.addEventListener('pointerdown', stop); sc.addEventListener('touchstart', stop, { passive: true }); sc.addEventListener('touchmove', stop, { passive: true });
        sc.addEventListener('scroll', () => this._fade(sc), { passive: true });
        if (window.ResizeObserver) { sc.__svRO = new ResizeObserver(() => { if (!sc.isConnected) return; this._fade(sc); if (this._cKey == null) this._center(sc, false); }); sc.__svRO.observe(sc); }
      }
      this._fade(sc);
      if (this._cKey !== this.tab || this._cEl !== sc) this._center(sc, this._cKey != null && this._cEl === sc);
    }
    _fade(sc) {
      const L = sc.scrollLeft > 2, R = sc.scrollLeft + sc.clientWidth < sc.scrollWidth - 2;
      const m = L || R ? `linear-gradient(90deg,${L ? 'transparent 0,#000 18px' : '#000 0'},${R ? '#000 calc(100% - 18px),transparent 100%' : '#000 100%'})` : 'none'; // ki-hex-ok (maske, ikke farge)
      if (sc.style.maskImage !== m) { sc.style.maskImage = m; sc.style.webkitMaskImage = m; }
      sc.dataset.fade = (L ? 'l' : '') + (R ? 'r' : '');
    }
    _center(sc, smooth) {
      const b = [...sc.children].find((x) => x.dataset && x.dataset.v === this.tab);
      if (!b || !sc.clientWidth) { this._cKey = null; return; } // ikke synlig ennå (lukket popup) – prøv igjen ved resize/åpning
      this._cKey = this.tab; this._cEl = sc;
      if (sc.scrollWidth <= sc.clientWidth + 1) return;
      const l = b.getBoundingClientRect().left - sc.getBoundingClientRect().left + sc.scrollLeft;
      const left = Math.max(0, Math.min(sc.scrollWidth - sc.clientWidth, l - (sc.clientWidth - b.offsetWidth) / 2));
      if (Math.abs(left - sc.scrollLeft) < 1) return;
      sc.scrollTo({ left, behavior: smooth ? 'smooth' : 'auto' });
    }
    _holdStart(hb) {
      this._holdStop();
      M.haptic('light');
      const t0 = performance.now(), fill = hb.querySelector('.hf'), lbl = hb.querySelector('.hl'), stop = hb.dataset.stop === '1';
      this._busy = true; this._holding = { hb, lbl: lbl && lbl.textContent };
      if (lbl) lbl.textContent = 'Hold…';
      const step = () => {
        const p = Math.min(1, (performance.now() - t0) / 900);
        if (fill) fill.style.width = (p * 100).toFixed(1) + '%';
        if (p < 1) { this._holdRaf = requestAnimationFrame(step); return; }
        this._holdRaf = 0; this._holding = null; this._busy = false;
        M.haptic('medium');
        this._run({ id: hb.dataset.hold, toast: stop ? 'Arrayet stoppes' : 'Arrayet startes' });
        if (fill) fill.style.width = '0%';
        this.update();
      };
      this._holdRaf = requestAnimationFrame(step);
    }
    _holdCancel(hb) {
      if (!this._holding) return;
      const H = this._holding; this._holdStop();
      const fill = hb.querySelector('.hf'); if (fill) fill.style.width = '0%';
      if (H.lbl != null && hb.querySelector('.hl')) hb.querySelector('.hl').textContent = H.lbl;
      M.toast('Hold inne for å bekrefte');
      this.update();
    }
    _holdStop() { if (this._holdRaf) cancelAnimationFrame(this._holdRaf); this._holdRaf = 0; this._holding = null; this._busy = false; }

    get styles() {
      // Tokens (ki-theme, src/00-a-theme.js) – definert bare i lys modus; mørk = fallback (dagens farge)
      const S = 'var(--ki-surface, #3a3a3a)', S2 = 'var(--ki-surface-2, #404040)', S3 = 'var(--ki-surface-3, #2f2f2f)', CTRL = 'var(--ki-ctrl, #545454)';
      const T = 'var(--ki-text, #fafafa)', T1 = 'var(--ki-text-1, #e1e1e1)', T1b = 'var(--ki-text-1, #c7c7c7)', T2 = 'var(--ki-text-2, #afafaf)', TM = 'var(--ki-text-mid, #979797)', T3 = 'var(--ki-text-3, #7f7f7f)';
      // tekst i #7f7f7f/#696969 (designet) → --ki-text-mid i lys modus (--ki-text-3/-lo er under 4,5:1 på lyse flater)
      const T3t = 'var(--ki-text-mid, #7f7f7f)', TLt = 'var(--ki-text-mid, #696969)';
      const EDGE = 'inset 0 0 0 1px var(--ki-line, rgba(255,255,255,0.05))', LINE = 'var(--ki-line, rgba(255,255,255,0.05))', INK = 'var(--ki-on-accent, #3a3a3a)', KNOB = 'var(--ki-knob, #fafafa)';
      // Fiks 50 H–M: CSS fra 58b-server-unifi.js (klasser su-*) i samme shadow root
      const su = M.serverUnifi;
      let suCss = '';
      try { suCss = su ? (typeof su.css === 'function' ? su.css() : su.css) || '' : ''; } catch (e) { console.error('[ki-msh] serverUnifi.css', e); }
      return `
        :host{display:block;width:100%}
        .wrap{display:flex;flex-direction:column;gap:8px}
        ${M.serverCF ? M.serverCF.css() : ''}
        .pane{display:flex;flex-direction:column;gap:8px;min-width:0;animation:svf .3s ease}
        .skp{border-radius:28px;background:${S};opacity:.55;flex:none}
        .prose.sk{color:var(--ki-text-3, #7f7f7f)}
        @keyframes svf{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        @media (prefers-reduced-motion: reduce){.pane,.gx{animation:none}}
        ${TAB_CSS('')}
        .hero{position:relative;height:184px;border-radius:28px;overflow:hidden;background:${S};box-shadow:${EDGE};flex:none;width:100%}
        .htop{position:absolute;top:18px;left:18px;right:70px;display:flex;align-items:center;gap:8px;min-width:0}
        .hn{font-size:13px;color:${T2};flex:0 1 auto}
        .chip{display:inline-flex;align-items:center;gap:3px;height:22px;padding:0 9px 0 7px;border-radius:11px;font-size:12px;font-weight:500;white-space:nowrap;min-width:0;flex:0 1 auto}
        .chip.ok{background:${tone(GR)};color:${TX.green}}.chip.warn{background:${tone(OR)};color:${TX.orange}}.chip.none{background:${S2};color:${TM}}
        .hcog{position:absolute;top:16px;right:16px;width:44px;height:44px;border-radius:22px;display:grid;place-items:center;background:var(--ki-surface-2, rgba(255,255,255,0.1));color:${T};z-index:2}
        .hcog:active{transform:scale(.92)}
        .vals{position:absolute;top:54px;left:18px;right:18px;display:flex;align-items:baseline;gap:16px;white-space:nowrap;min-width:0;z-index:2;pointer-events:none}
        .bigw{display:flex;align-items:baseline;gap:3px}
        .big{font-size:44px;font-weight:300;line-height:1}
        .bu{font-size:20px;color:${T2}}
        .sv{display:flex;align-items:baseline;gap:2px;padding:4px 0;pointer-events:auto;color:${T}}
        .svv{font-size:17px}.svu{font-size:12px;color:${TM}}
        .when{position:absolute;top:104px;left:18px;font-size:12px;color:${T3t}}
        .graph{position:absolute;left:0;right:0;bottom:0;height:84px}
        .graph svg{width:100%;height:84px;display:block}
        .graph .mk{stroke:${T1}}
        .scrub{position:absolute;inset:0;touch-action:none;cursor:crosshair}
        .prose{display:block;margin:2px 6px 0;font-size:16px;line-height:1.9;color:${T1};text-wrap:pretty}
        .pp{display:inline;background:var(--ki-pill-bg, #fafafa);color:var(--ki-pill-fg, #141414);border-radius:999px;padding:2px 10px;font-weight:500;white-space:nowrap;box-shadow:var(--ki-pill-sh, none);-webkit-box-decoration-break:clone;box-decoration-break:clone}
        .subs{display:flex;gap:2px;padding:3px;border-radius:22px;background:${S};margin:2px 0}
        .sb{flex:1 1 0;min-width:0;height:38px;border-radius:19px;font-size:14px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--ki-text-2, #c7c7c7);transition:background .2s,color .2s}
        .sb.on{background:${C.accent};color:${INK}}
        .card{background:${S};border-radius:28px;min-width:0}
        .ch{display:flex;align-items:center;gap:10px;padding:2px 4px 0;min-width:0}.ch.pad{padding:8px 16px 4px}.ch.wide{grid-column:1/-1;padding:0}
        .ct{flex:1;min-width:0;font-size:15px;font-weight:600}
        .cs{font-size:12px;color:${TM};white-space:nowrap;text-align:right}
        .none{padding:14px;border-radius:20px;background:${S2};color:${TM};font-size:13px}.none.in{margin:6px 12px 8px}
        .nf{display:flex;flex-direction:column;align-items:center;text-align:center;padding:22px 16px;gap:8px;color:${TM};font-size:13px}
        .nf b{font-size:15px;color:${T};font-weight:500}
        .nfi{width:52px;height:52px;border-radius:26px;background:${S2};display:grid;place-items:center;color:${TX.orange}}
        .nfb{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:4px}
        .pick{background:${S2};color:${T}}
        /* felles liste (35.2) */
        .gl{padding:12px;display:flex;flex-direction:column;gap:10px}
        .srch{height:44px;border-radius:22px;background:${S2};display:flex;align-items:center;gap:8px;padding:0 6px 0 14px;cursor:text;color:${TM}}
        .srch input{flex:1;min-width:0;height:100%;border:0;outline:0;background:transparent;color:${T};font-size:14px}
        .srch input::placeholder{color:${TM}}.srch input::-webkit-search-cancel-button{display:none}
        .clr{width:28px;height:28px;border-radius:14px;display:grid;place-items:center;color:${T2};flex:none}
        .chips{display:flex;gap:2px;padding:3px;border-radius:22px;background:${S3}}
        .cp{flex:1 1 0;min-width:0;height:38px;border-radius:19px;display:flex;align-items:center;justify-content:center;gap:6px;font-size:14px;font-weight:600;white-space:nowrap;color:var(--ki-text-2, #c7c7c7);transition:background .2s}
        .cp.on{background:${C.accent};color:${INK}}
        .cn{font-size:11px;font-weight:500;color:${TM}}.cp.on .cn{color:var(--ki-on-accent, #5a3a48);opacity:.8}
        .gls{display:flex;flex-direction:column;gap:6px}
        .gw{border-radius:20px;background:${S2};transition:box-shadow .2s;min-width:0}
        .gw.open{box-shadow:inset 0 0 0 1.5px ${M.alpha(PK, 0.5)}}
        .gr{display:flex;align-items:center;gap:12px;min-height:60px;padding:0 12px 0 10px;cursor:pointer;min-width:0}
        .gic{width:40px;height:40px;border-radius:20px;flex:none;display:grid;place-items:center;background:${CTRL};color:${T2};transition:background .2s}
        .gic.on{background:var(--ki-pill-bg, #fafafa);color:var(--ki-pill-fg, #282828)}
        .gtx{display:flex;flex-direction:column;gap:3px}
        .gn{display:flex;align-items:center;gap:6px;min-width:0}.gn b{font-size:14px;font-weight:600}
        .gtag{flex:none;height:18px;padding:0 7px;border-radius:9px;display:inline-flex;align-items:center;font-size:10px;font-weight:600;background:${S3};color:${T1b};white-space:nowrap}
        .gtag.upd{background:${tone(OR, 0.2)};color:${TX.orange}}
        .gsub{font-size:12px;color:${T3t}}.gsub.on{color:${T2}}
        .nohit{padding:18px;text-align:center;font-size:13px;color:${TM}}
        .tg{width:50px;height:30px;border-radius:15px;flex:none;position:relative;background:${CTRL};transition:background .2s}
        .tg i{position:absolute;top:3px;left:3px;width:24px;height:24px;border-radius:12px;background:${KNOB};box-shadow:0 1px 3px ${M.theme ? M.theme.blackA(0.3) : 'rgb(0 0 0 / 0.3)'};transition:left .2s}
        .tg.on{background:${M.SWITCH_ON || PK}}.tg.on i{left:23px}
        .tg.sm{width:46px;height:28px;border-radius:14px}.tg.sm i{width:22px;height:22px;border-radius:11px}.tg.sm.on i{left:21px}
        .tg.lock{opacity:.45}.tg[disabled]{opacity:.4;cursor:default}
        .gx{display:flex;flex-direction:column;gap:10px;padding:2px 10px 12px;animation:svf .25s ease}
        .devs .gx{padding:2px 12px 14px}
        .xs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
        .xt{display:flex;flex-direction:column;gap:2px;padding:10px 12px;border-radius:16px;background:${S3};min-width:0}
        .xv{display:flex;align-items:baseline;gap:2px;min-width:0;font-size:16px}.devs .xv{font-size:17px}.xu{font-size:11px;color:${TM}}
        .xl{font-size:11px;color:${TM}}
        .xb{display:flex;flex-direction:column;gap:6px;padding:10px 12px;border-radius:16px;background:${S3}}
        .xbr{display:flex;align-items:center;gap:10px;font-size:12px}.xbl{width:44px;color:${T2};flex:none}.devs .xbl{width:52px}
        .xbt{flex:1;height:6px;border-radius:3px;background:${S2};overflow:hidden;display:flex}.xbt i{display:block;height:100%;border-radius:3px;transition:width .4s}
        .xbv{width:84px;text-align:right;color:${T1b};white-space:nowrap;flex:none}
        .xg{display:flex;flex-direction:column;border-radius:16px;background:${S3};padding:0 12px}
        .xgr{display:flex;align-items:center;gap:10px;min-height:50px}.xgr+.xgr{border-top:1px solid ${LINE}}.devs .xgr{min-height:52px}
        .xgi{color:${T1b};display:flex}.xgr b{font-size:13px;font-weight:500}.xgr .col>span{font-size:11px;color:${TM}}
        .xa{display:flex;flex-wrap:wrap;gap:6px}
        .ab{height:40px;padding:0 14px 0 10px;border-radius:20px;display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:500;background:${S3};color:${T1};transition:background .2s,color .2s,transform .12s}
        .devs .ab{background:${S2}}.ab.on-s{background:${S}}
        .ab:active{transform:scale(.96)}.ab[disabled]{opacity:.4;cursor:default}
        .ab.hot{background:${tone(RD)};color:${TX.red}}
        .ab.armed{background:${RD} !important;color:var(--ki-on-accent, #232323) !important}
        /* Nettverk */
        .wan{padding:16px;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px}
        .wh{grid-column:1/-1;display:flex;align-items:center;gap:8px;min-width:0}
        .wcol{display:flex;flex-direction:column;gap:1px;min-width:0}
        .wmeta{align-self:flex-start;font-size:12px;color:${TM};white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis;text-align:left;padding:0}
        .strun{height:32px;padding:0 12px 0 10px;border-radius:16px;display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:600;flex:none;background:${C.accent};color:${INK};transition:background .2s,color .2s,transform .12s}
        .strun:active{transform:scale(.96)}.strun.run,.strun[disabled]{background:${S2};color:${T2};cursor:default;opacity:1}
        .wt{display:flex;flex-direction:column;align-items:flex-start;gap:4px;padding:12px;border-radius:20px;background:${S2};text-align:left;min-width:0;color:${T}}
        .wl{display:flex;align-items:center;gap:6px;font-size:12px;color:${T2}}
        .wv{display:flex;align-items:baseline;gap:3px}.wv .num{font-size:28px;font-weight:300}.wv>span:last-child{font-size:12px;color:${TM}}
        .press{transition:transform .12s}.press:active{transform:scale(.97)}
        /* qBittorrent (Fiks 50 E) */
        .qbt{padding:14px;display:flex;flex-direction:column;gap:12px}.qbt>.ch{padding:0 2px}
        .qbar{display:flex;gap:3px;height:10px;border-radius:999px;overflow:hidden}.qbar>span{display:block;height:100%}.qb0{flex:1;background:${S3}}
        .qg{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
        .qt{display:flex;flex-direction:column;align-items:flex-start;gap:4px;padding:12px 14px;border-radius:18px;background:${S2};min-width:0;text-align:left;color:${T}}
        .ql{display:flex;align-items:center;gap:6px;font-size:12px;color:${T2}}.ql i{width:8px;height:8px;border-radius:4px;flex:none;display:block}
        .qn{font-size:24px;font-weight:300;line-height:1}
        .qs{display:flex;align-items:center;gap:10px;padding:8px 12px 8px 8px;border-radius:18px;background:${S2};min-width:0;color:${T}}
        .qsi{width:32px;height:32px;border-radius:16px;flex:none;display:grid;place-items:center}
        .qsc{display:flex;flex-direction:column;align-items:flex-start;min-width:0}.qsv{font-size:16px;white-space:nowrap}.qsv span,.qsl{font-size:11px;color:${TM}}
        .qalt{display:flex;align-items:center;gap:12px;min-height:68px;padding:0 14px;text-align:left;width:100%;color:${T}}
        .qalt:active{transform:scale(.98)}.qalt[disabled]{cursor:default}.qalt[disabled]:active{transform:none}
        .qalt b{font-size:14px;font-weight:500}.qalt .col>span{font-size:12px;color:${TM}}
        .qai{width:40px;height:40px;border-radius:20px;flex:none;display:grid;place-items:center;background:${S2};color:${T1b};transition:background .2s,color .2s}
        .qalt.on .qai{background:${tone(PK, 0.18)};color:${TX.pink}}
        .qtr{width:52px;height:32px;border-radius:16px;flex:none;position:relative;background:${CTRL};transition:background .2s}
        .qtr i{position:absolute;top:4px;left:4px;width:24px;height:24px;border-radius:12px;background:${KNOB};transition:left .2s cubic-bezier(.34,1.4,.64,1)}
        .qalt.on .qtr{background:${C.accent}}.qalt.on .qtr i{left:24px}
        .qst{padding:12px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
        .qx{display:flex;flex-direction:column;align-items:flex-start;gap:2px;padding:10px 12px;border-radius:16px;background:${S2};min-width:0;text-align:left;color:${T}}
        .qx .num{font-size:16px;max-width:100%}.qx>span:last-child{font-size:11px;color:${TM}}
        .devs{padding:6px 0;display:flex;flex-direction:column}.devs>.ch{padding:8px 16px 4px}
        .dw{border-radius:20px;margin:0 6px;transition:background .2s}.dw.open{background:${S2}}
        .dr{display:flex;align-items:center;gap:12px;min-height:56px;width:100%;padding:0 12px;text-align:left}
        .dr b{font-size:14px;font-weight:500}.dr .col>span{font-size:12px;color:${TM}}
        .dic{width:40px;height:40px;border-radius:20px;flex:none;display:grid;place-items:center;background:${S2};color:${T1b}}
        .dw.open .dic{background:${S3}}
        .dic.off{background:${tone(OR)};color:${TX.orange}}
        .dw.blink .dic{animation:blink 1s ease-in-out infinite}@keyframes blink{50%{opacity:.35}}
        .dm{font-size:12px;font-weight:500;white-space:nowrap;color:${TM}}.dm.off{color:${TX.orange}}
        .sw{padding:16px;display:flex;flex-direction:column;gap:12px}
        .swg{display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:6px}
        .swc{display:flex;flex-direction:column;align-items:flex-start;gap:8px;min-width:0;padding:10px 12px;border-radius:18px;background:${S3};box-shadow:inset 0 0 0 1px var(--ki-line, rgba(255,255,255,0.04));transition:background .2s,box-shadow .2s;text-align:left}
        .swc:active{transform:scale(.97)}
        .swc.on{background:${S2};box-shadow:inset 0 0 0 1.5px ${PK}}
        .swn{font-size:13px;font-weight:600;width:100%}
        .leds{display:flex;gap:2px;width:100%}.leds i{flex:1;height:4px;border-radius:2px;display:block}
        .sws{font-size:11px;color:${TM};max-width:100%}.swc.off .sws{color:${TX.orange}}
        .swh{display:flex;align-items:center;gap:8px;min-width:0}.swh b{font-size:15px;font-weight:600}.swh .col>span{font-size:12px;color:${TM}}
        .pg{display:grid;gap:5px}
        .pt{height:40px;border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font-size:11px;font-weight:500;color:${TLt};background:${S3};min-width:0}
        .pt.up{color:${T1}}
        .pt i{display:block;width:14px;height:3px;border-radius:2px}
        .pt.poe{box-shadow:inset 0 -2px 0 ${M.alpha(OR, 0.7)}}
        .pt.dis{background:repeating-linear-gradient(135deg,var(--ki-surface-2, #3f3f3f) 0 3px,var(--ki-surface-3, #333) 3px 6px)}
        .pt.sel{background:${CTRL};color:${T1};box-shadow:inset 0 0 0 1.5px ${PK}}
        .pinfo{font-size:12px;color:${T2};min-height:16px}
        /* Proxmox */
        .stc{padding:16px;display:flex;flex-direction:column;gap:14px}
        .stg{display:flex;flex-direction:column;gap:6px;cursor:pointer}
        .stl{display:flex;align-items:baseline;gap:8px;min-width:0}.stl b{flex:1;font-size:14px;font-weight:500}.stl span{font-size:12px;color:${TM};white-space:nowrap}
        .bar8{height:8px;border-radius:4px;background:${S3};overflow:hidden;display:flex}.bar8 i{display:block;height:100%;border-radius:4px;transition:width .5s}
        .bkr{display:flex;align-items:center;gap:12px;min-height:64px;padding:0 16px 0 12px;border-radius:28px;background:${S}}
        .bkr b{font-size:14px;font-weight:500}.bkr .col>span{font-size:12px;color:${TM}}
        .bki{width:40px;height:40px;border-radius:20px;flex:none;display:grid;place-items:center}
        .bki.ok{background:${tone(GR)};color:${TX.green}}.bki.bad{background:${tone(RD)};color:${TX.red}}.bki.none{background:${S2};color:${TM}}
        /* Unraid */
        .arr{padding:16px;display:flex;flex-direction:column;gap:14px}
        .arh{display:flex;align-items:center;gap:10px}.arh b{font-size:15px;font-weight:600}.arh .col>span{font-size:12px;color:${TM}}
        .hold{position:relative;overflow:hidden;height:40px;padding:0 16px 0 12px;border-radius:20px;display:flex;align-items:center;gap:6px;font-size:13px;font-weight:500;background:${CTRL};color:${T};touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;flex:none}
        .hold[disabled]{opacity:.4}
        .hold .hf{position:absolute;left:0;top:0;bottom:0;width:0;background:${M.alpha(RD, 0.6)}}.hold.start .hf{background:${M.alpha(GR, 0.6)}}
        .hold .hl{position:relative}
        .bays{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px}
        .bay{display:flex;flex-direction:column;align-items:center;gap:6px;min-width:0}.bay:active{transform:scale(.95)}
        .bb{position:relative;width:100%;height:72px;border-radius:12px;background:${S3};overflow:hidden;box-shadow:${EDGE}}
        .bb.par{box-shadow:inset 0 0 0 1.5px ${M.alpha(PK, 0.6)}}.bb.sl{opacity:.6}
        .bf{position:absolute;left:0;right:0;bottom:0;transition:height .5s}
        .bz{position:absolute;left:0;right:0;top:8px;display:flex;justify-content:center;color:${T3}}
        .bp{position:absolute;left:0;right:0;bottom:6px;text-align:center;font-size:11px;font-weight:600;color:${T}}
        .bn{display:flex;flex-direction:column;align-items:center}.bn b{font-size:12px;font-weight:600}.bn span{font-size:11px;color:${TM}}.bn span.hot{color:${TX.orange}}
        .use{display:flex;flex-direction:column;gap:6px}.ut{display:flex;justify-content:space-between;font-size:12px;color:${TM}}
        /* HA */
        .upd{padding:6px 0;display:flex;flex-direction:column}
        .ur{display:flex;align-items:center;gap:12px;min-height:64px;padding:0 12px 0 14px;border-top:1px solid ${LINE}}
        .uic{width:40px;height:40px;border-radius:20px;flex:none;display:grid;place-items:center;background:${S2};color:${T1b}}
        .ur b{font-size:14px;font-weight:500}.ur .col>span{font-size:12px;color:${TM}}
        .ub{height:36px;padding:0 14px;border-radius:18px;font-size:13px;font-weight:600;white-space:nowrap;flex:none}
        .ub.go{background:${C.accent};color:${INK}}.ub.busy{background:${CTRL};color:${T1};cursor:default}
        .ub.done{background:transparent;color:${TM};box-shadow:inset 0 0 0 1px var(--ki-line, rgba(255,255,255,0.12));cursor:default}
        .ub.go:active{transform:scale(.96)}
        .sys{padding:12px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
        .syt{display:flex;flex-direction:column;gap:2px;padding:10px 12px;border-radius:16px;background:${S2};min-width:0}
        .syt .num{font-size:16px}.syt>span:last-child{font-size:11px;color:${TM}}
        ${suCss}
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
  // brukervalg (35): UniFi Network, Proxmox VE, Unraid eller Home Assistant Supervisor (hassio) – ikke Glances eller UniFi Protect alene
  const NEED_SKIP = { glances: 1, unifiprotect: 1 };
  M.popupNeeds[HASH] = (hass) => Object.values((hass && hass.entities) || {}).some((e) => e && ((PLAT[e.platform] && !NEED_SKIP[e.platform]) || e.platform === 'hassio' || e.platform === 'qbittorrent')) || Object.keys((hass && hass.states) || {}).some((id) => id.startsWith('sensor.ki_arild_kristo_')) || (Array.isArray(CE.data) && CE.data.some((e) => !NEED_SKIP[e.domain]));
  M.server = { oppdag, oppdagHA, oppdagQB, oppdagST, visTabs, maltTxt, sizeOf, mbsF, bytesF, confirm: confirmSheet, entries, entriesFor, openPick, INTEG, HOSTS, SUBS, tabsCfg, SUP };
  M.define('msh-server-card', Server, 'MSH Server', 'Server-popup (#server): vertvelger Nettverk · Proxmox · Unraid · HA · qBittorrent · arildkristo.com (Cloudflare), toppkort med graf, prosa-setning, underfaner og felles utvidbar liste.');
})();
