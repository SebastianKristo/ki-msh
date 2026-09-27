/* KI MSH · ki-store – innstillinger fra dashbord-editorene (Tilpass Hjem/navbar/header/rom …).
 * Lagres per HA-bruker med frontend/set_user_data (nøkkel «ki_dashboard») og synkes mellom alle enhetene til
 * brukeren. Trigger ingen Lovelace-rebuild. localStorage er bare cache for rask første visning.
 *   MSH.store.get(path)            – les (sti med punktum, tom = alt)
 *   MSH.store.set(path, value)     – skriv (debounce 600 ms mot HA), varsler abonnenter straks
 *   MSH.store.subscribe(cb)        – cb(data, path) ved endring; returnerer avmelding
 *   MSH.store.load(hass)           – hent fra HA (kalles automatisk av kortene)
 * Kortconfig: cards.<card_id> = kortets config fra egen editor; effektiv config = { ...YAML, ...store }.
 *
 * Én felles config for alle kort (rotnivå). UNNTAK: Kamera og Person kan ha oppsett per enhet:
 *   { <felles nøkler: cards/rooms/popups …>, devices: { <enhets-id>: { name, seen, cards: { <kamera/person-kort> } } } }
 *   Oppslag for Kamera/Person: devices[id][kort] ?? felles[kort] ?? YAML, felt for felt (null = fjernet).
 *   Migrering ved oppstart: annet enhetsoppsett flyttes til felles (hvis felles mangler) og slettes fra alle enheter.
 *   MSH.store.deviceId / deviceName    – denne enheten (browser_mod-ID, ellers egen stabil ID i localStorage ki-device-id)
 *   MSH.store.scope                    – 'device' (standard i Tilpass-menyene) eller 'shared'
 *   MSH.store.eff(key)                 – config for en nøkkel (felles; + denne enheten for Kamera/Person)
 *   MSH.store.view()                   – hele den felles configen (strategien bruker denne)
 *   MSH.store.perDeviceKey(key)        – om nøkkelen kan ha oppsett per enhet (Kamera/Person)
 *   MSH.store.hasOwn(key) / clearOwn(key) / copyToAll(key) – «Eget oppsett», «Bruk felles oppsett», «Kopier til alle»
 */
(function () {
  const M = window.MSH;
  if (!M || M.store) return;
  const KEY = 'ki_dashboard', CACHE = 'ki:store';
  let data = {};
  try { data = JSON.parse(localStorage.getItem(CACHE) || '{}') || {}; } catch (e) { data = {}; }
  let hass = null, loaded = false, loading = null, timer = null, subs = new Set(), unsubRemote = null;
  const get = (o, p) => (!p ? o : String(p).split('.').reduce((a, k) => (a == null ? a : a[k]), o));
  const setIn = (o, p, v) => {
    const ks = String(p).split('.'), root = { ...o };
    let cur = root;
    ks.forEach((k, i) => {
      if (i === ks.length - 1) { if (v === undefined) delete cur[k]; else cur[k] = v; }
      else { cur[k] = cur[k] && typeof cur[k] === 'object' && !Array.isArray(cur[k]) ? { ...cur[k] } : {}; cur = cur[k]; }
    });
    return root;
  };
  const emit = (path) => { subs.forEach((cb) => { try { cb(data, path); } catch (e) { console.error('[ki-store]', e); } }); };
  const cache = () => { try { localStorage.setItem(CACHE, JSON.stringify(data)); } catch (e) { /* */ } };
  // Lagring mot HA: debounce 600 ms; alle som venter får samme svar ({ ok, error }) når callWS har returnert.
  let waiters = [];
  const write = async () => {
    clearTimeout(timer); timer = null;
    const ws = waiters; waiters = [];
    let res;
    if (!hass || !hass.callWS) res = { ok: false, error: 'Ingen forbindelse til Home Assistant' };
    else {
      try { await hass.callWS({ type: 'frontend/set_user_data', key: KEY, value: data }); res = { ok: true }; }
      catch (e) { res = { ok: false, error: (e && e.message) || String(e) }; }
    }
    ws.forEach((fn) => fn(res));
    return res;
  };
  const push = (immediate) => new Promise((res) => {
    waiters.push(res);
    clearTimeout(timer);
    timer = setTimeout(write, immediate ? 0 : 600);
  });

  /* ------------------------------------------------------------ enheter */
  const guessName = () => {
    const ua = navigator.userAgent || '';
    if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'iPad';
    if (/iPhone/.test(ua)) return 'iPhone';
    if (/Android/.test(ua)) return /Mobile/.test(ua) ? 'Android-telefon' : 'Android-nettbrett';
    if (/Macintosh|Mac OS X/.test(ua)) return 'Mac';
    if (/Windows/.test(ua)) return 'Windows';
    if (/Linux/.test(ua)) return 'Linux';
    return 'Ukjent enhet';
  };
  const deviceId = (() => {
    try {
      const bm = localStorage.getItem('browser_mod-browser-id');
      if (bm) return String(bm).replace(/^"|"$/g, '').replace(/[^\w-]/g, '_');
      let id = localStorage.getItem('ki-device-id');
      if (!id) { id = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); localStorage.setItem('ki-device-id', id); }
      return id;
    } catch (e) { return 'ukjent'; }
  })();
  const devKey = (key) => 'devices.' + deviceId + '.' + key;
  // Kamera- og Person-kort (card_id fra strategien: pop-kamera, pop-person-<id>; egne id-er med kamera/camera/person)
  const perDeviceKey = (key) => /^cards\./.test(String(key)) && /(^|[-_.])(kamera|camera|person)/i.test(String(key).slice(6));
  const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
  // Felt for felt: b vinner, null i b fjerner feltet
  const mergeFields = (a, b) => {
    if (!isObj(b)) return isObj(a) ? a : (b === undefined ? a : b);
    const out = isObj(a) ? { ...a } : {};
    Object.keys(b).forEach((k) => { out[k] = b[k]; });
    return out;
  };
  let scope = 'shared';

  // Én felles config: flytt enhetsoppsett (utenom Kamera/Person) til felles hvis felles mangler, og slett det fra alle enheter.
  const migrate = () => {
    const D = get(data, 'devices');
    if (!isObj(D)) return false;
    let changed = false;
    Object.keys(D).forEach((id) => {
      const d = D[id] || {};
      Object.keys(d).forEach((g) => {
        if (g === 'name' || g === 'seen' || !isObj(d[g])) return;
        Object.keys(d[g]).forEach((k) => {
          const key = g + '.' + k;
          if (perDeviceKey(key)) return;
          const own = d[g][k];
          if (get(data, key) == null && isObj(own)) {
            const clean = {}; Object.keys(own).forEach((f) => { if (own[f] !== null) clean[f] = own[f]; });
            if (Object.keys(clean).length) data = setIn(data, key, clean);
          }
          data = setIn(data, 'devices.' + id + '.' + key, undefined);
          changed = true;
        });
        const left = get(data, 'devices.' + id + '.' + g);
        if (isObj(left) && !Object.keys(left).length) data = setIn(data, 'devices.' + id + '.' + g, undefined);
      });
    });
    return changed;
  };

  M.store = {
    get deviceId() { return deviceId; },
    get deviceName() { return get(data, 'devices.' + deviceId + '.name') || guessName(); },
    setDeviceName(name, id) { return M.store.set('devices.' + (id || deviceId) + '.name', name || undefined, { immediate: true }); },
    get scope() { return scope; },
    set scope(v) { scope = v === 'device' ? 'device' : 'shared'; },
    // nøkkel for lagring i valgt omfang (Tilpass-menyene): devices.<id>.<key> eller <key>
    scoped: (key, sc) => ((sc || scope) === 'device' ? devKey(key) : key),
    devKey,
    eff: (key) => (perDeviceKey(key) ? mergeFields(get(data, key), get(data, devKey(key))) : get(data, key)),
    view: () => { const out = { ...data }; delete out.devices; return out; },
    perDeviceKey,
    hasOwn: (key, id) => { const v = get(data, 'devices.' + (id || deviceId) + '.' + key); return isObj(v) ? Object.keys(v).length > 0 : v != null; },
    clearOwn: (key, id) => M.store.set('devices.' + (id || deviceId) + '.' + key, undefined, { immediate: true }),
    copyToAll(key) {
      const own = get(data, devKey(key));
      if (own == null) return Promise.resolve({ ok: true });
      const merged = mergeFields(get(data, key), own);
      if (isObj(merged)) Object.keys(merged).forEach((k) => { if (merged[k] === null) delete merged[k]; });
      data = setIn(data, key, merged);
      return M.store.set(devKey(key), undefined, { immediate: true });
    },
    // Kjente enheter: [{ id, name, seen, own (antall kort med eget oppsett), current }]
    devices() {
      const D = get(data, 'devices') || {};
      if (!D[deviceId]) D[deviceId] = {};
      return Object.keys(D).map((id) => {
        const d = D[id] || {};
        let own = 0;
        Object.keys((d.cards && isObj(d.cards)) ? d.cards : {}).forEach((k) => { if (perDeviceKey('cards.' + k)) own++; });
        return { id, name: d.name || (id === deviceId ? guessName() : 'Enhet ' + id.slice(0, 6)), seen: d.seen || null, own, current: id === deviceId };
      }).sort((a, b) => (b.current - a.current) || ((b.seen || 0) - (a.seen || 0)));
    },
    removeDevice: (id) => M.store.set('devices.' + id, undefined, { immediate: true }),
    get: (path) => get(data, path),
    // set → oppdaterer cache og kort straks; returnerer Promise<{ ok, error }> når HA har bekreftet lagringen
    set(path, value, opts) {
      data = path ? setIn(data, path, value) : (value || {});
      cache(); emit(path);
      return push(opts && opts.immediate);
    },
    // Tving lagring nå (Lagre-knappen) og vent på svar
    save() { return push(true); },
    get pending() { return !!timer; },
    // Hent på nytt fra HA (ved åpning av popup) – ikke mens egne endringer venter
    async refresh(h) {
      if (h) hass = h;
      if (!hass || !hass.callWS || timer) return data;
      try {
        const r = await hass.callWS({ type: 'frontend/get_user_data', key: KEY });
        if (r && r.value && typeof r.value === 'object' && !timer && JSON.stringify(r.value) !== JSON.stringify(data)) { data = r.value; cache(); emit(''); }
      } catch (e) { /* */ }
      return data;
    },
    subscribe(cb) { subs.add(cb); return () => subs.delete(cb); },
    get loaded() { return loaded; },
    flush() { if (timer) write(); },
    async load(h) {
      if (h) hass = h;
      if (loaded || !hass || !hass.callWS) return data;
      if (loading) return loading;
      loading = (async () => {
        try {
          const r = await hass.callWS({ type: 'frontend/get_user_data', key: KEY });
          if (r && r.value && typeof r.value === 'object' && !timer) { data = r.value; cache(); emit(''); }
        } catch (e) { /* eldre HA: behold cache */ }
        loaded = true;
        if (migrate()) { cache(); emit(''); push(false); }
        // sist sett (maks hver 6. time, så det ikke gir unødige skriv)
        try {
          const seen = get(data, 'devices.' + deviceId + '.seen') || 0;
          if (Date.now() - seen > 6 * 3600e3) {
            data = setIn(data, 'devices.' + deviceId + '.seen', Date.now());
            if (!get(data, 'devices.' + deviceId + '.name')) data = setIn(data, 'devices.' + deviceId + '.name', guessName());
            cache(); push(false);
          }
        } catch (e) { /* */ }
        // endringer fra andre enheter/faner
        try {
          if (hass.connection && hass.connection.subscribeMessage && !unsubRemote) {
            unsubRemote = await hass.connection.subscribeMessage((msg) => {
              const v = msg && msg.value;
              if (v && typeof v === 'object' && !timer && JSON.stringify(v) !== JSON.stringify(data)) { data = v; cache(); emit(''); }
            }, { type: 'frontend/subscribe_user_data', key: KEY });
          }
        } catch (e) { /* ikke støttet */ }
        return data;
      })();
      return loading;
    },
    // Kortconfig fra editorene
    card: (id) => (id ? get(data, String(id).includes('.') ? id : 'cards.' + id) || null : null),
    setCard(id, cfg, opts) {
      if (!id) return Promise.resolve({ ok: false });
      const { type, ...rest } = cfg || {};
      return M.store.set(String(id).includes('.') ? id : 'cards.' + id, rest, opts);
    },
  };
  window.kiStore = M.store;
})();
