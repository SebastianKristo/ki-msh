/* KI MSH · ki-store – innstillinger fra dashbord-editorene (Tilpass Hjem/navbar/header/rom …).
 * Lagres per HA-bruker med frontend/set_user_data (nøkkel «ki_dashboard») og synkes mellom alle enhetene til
 * brukeren. Trigger ingen Lovelace-rebuild. localStorage er bare cache for rask første visning.
 *   MSH.store.get(path)            – les (sti med punktum, tom = alt)
 *   MSH.store.set(path, value)     – skriv (debounce 600 ms mot HA), varsler abonnenter straks
 *   MSH.store.subscribe(cb)        – cb(data, path) ved endring; returnerer avmelding
 *   MSH.store.load(hass)           – hent fra HA (kalles automatisk av kortene)
 *   MSH.store.set(path, value, { confirm, src }) – confirm: localStorage-cachen skrives og abonnentene varsles først
 *                                    når HA har bekreftet (feil → stien rulles tilbake). src = avsendermerke, sendes
 *                                    videre til abonnentene som 3. argument (tilpass-arkene kjenner igjen egen lagring).
 *   MSH.store.transaction({ onExternal }) – utkastmodus for ark som skriver mange nøkler («Tilpass Hjem»): set()
 *                                    oppdaterer data og kort live, men ingenting sendes til HA før tx.commit() (ÉN
 *                                    frontend/set_user_data). tx.rollback() setter de berørte stiene tilbake. Endringer
 *                                    fra andre enheter mens utkastet er åpent overskriver det ikke → onExternal(), og
 *                                    tx.reload() tar dem inn (forkaster utkastet).
 *   MSH.store.rev                    – teller, økes ved hver endring av data (lokalt eller fra HA)
 * Fjernverdier (get_user_data / subscribe_user_data) tas ikke inn mens egne endringer venter, skrives eller ligger i
 * et utkast – ellers kan et ekko av en eldre lagring overskrive en nyere (fiks 15.13).
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
  let writing = 0, tx = null, rev = 0;
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
  const emit = (path, src) => { rev++; subs.forEach((cb) => { try { cb(data, path, src); } catch (e) { console.error('[ki-store]', e); } }); };
  // Egne endringer venter / skrives / ligger i et utkast → ikke ta inn fjernverdier nå
  const busy = () => !!(timer || writing || tx);
  // Verdi fra HA (get_user_data / subscribe_user_data). Under et utkast: bare merk at noe er endret et annet sted.
  const remote = (v) => {
    if (!v || typeof v !== 'object') return;
    const j = JSON.stringify(v);
    if (tx) { if (j !== JSON.stringify(tx.snap) && j !== JSON.stringify(data)) { tx.remote = v; if (tx.onExternal) try { tx.onExternal(); } catch (e) { /* */ } } return; }
    if (busy() || j === JSON.stringify(data)) return;
    data = v; cache(); emit('');
  };
  const cache = () => { try { localStorage.setItem(CACHE, JSON.stringify(data)); } catch (e) { /* */ } };
  // Lagring mot HA: debounce 600 ms; alle som venter får samme svar ({ ok, error }) når callWS har returnert.
  let waiters = [];
  const write = async () => {
    clearTimeout(timer); timer = null;
    if (tx) return; // utkast åpent: ingenting sendes før tx.commit() (ventende svar tas med da)
    const ws = waiters; waiters = [];
    let res;
    if (!hass || !hass.callWS) res = { ok: false, error: 'Ingen forbindelse til Home Assistant' };
    else {
      writing++;
      try { await hass.callWS({ type: 'frontend/set_user_data', key: KEY, value: data }); res = { ok: true }; }
      catch (e) { res = { ok: false, error: (e && e.message) || String(e) }; }
      finally { writing--; }
    }
    ws.forEach((fn) => fn(res));
    return res;
  };
  const push = (immediate) => new Promise((res) => {
    waiters.push(res);
    if (tx) return;
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
    get rev() { return rev; },
    // set → oppdaterer cache og kort straks; returnerer Promise<{ ok, error }> når HA har bekreftet lagringen
    set(path, value, opts) {
      opts = opts || {};
      const before = path ? get(data, path) : data;
      data = path ? setIn(data, path, value) : (value || {});
      // now: lagres straks også mens et utkast er åpent (eksplisitte handlinger som import) – bare denne stien sendes,
      // resten av utkastet venter på Ferdig, og Avbryt ruller ikke stien tilbake.
      if (tx && opts.now && path) {
        tx.snap = setIn(tx.snap, path, value); tx.touched.delete(path);
        emit(path, opts.src);
        if (!hass || !hass.callWS) return Promise.resolve({ ok: false, error: 'Ingen forbindelse til Home Assistant' });
        return hass.callWS({ type: 'frontend/set_user_data', key: KEY, value: tx.snap }).then(() => { cache(); return { ok: true }; }, (e) => ({ ok: false, error: (e && e.message) || String(e) }));
      }
      if (tx) { tx.touched.add(path || ''); emit(path, opts.src); return Promise.resolve({ ok: true, draft: true }); } // utkast: sendes ved tx.commit()
      if (!opts.confirm) { cache(); emit(path, opts.src); return push(opts.immediate); }
      // confirm (tilpass-arkenes Ferdig): cache + varsel først når HA har bekreftet; feil → stien rulles tilbake
      const mine = path ? get(data, path) : data;
      return push(true).then((res) => {
        if (res && res.ok) { cache(); emit(path, opts.src); }
        else if ((path ? get(data, path) : data) === mine) data = path ? setIn(data, path, before) : before;
        return res;
      });
    },
    // Utkastmodus (se toppen). Bare ett utkast om gangen; et nytt kall mens et er åpent gir det samme.
    transaction(opts) {
      if (tx) return tx.api;
      const t = { snap: data, touched: new Set(), remote: null, onExternal: opts && opts.onExternal };
      const end = () => { if (tx === t) tx = null; };
      t.api = {
        get active() { return tx === t; },
        get dirty() { return t.touched.size > 0; },
        get external() { return !!t.remote; },
        // Ferdig: ÉN lagring av alt i utkastet. Feil → utkastet står (tx er fortsatt åpen).
        async commit() {
          if (tx !== t) return { ok: true };
          end();
          if (!t.touched.size) return { ok: true, unchanged: true };
          const res = await push(true);
          if (res && res.ok) cache();
          else if (!tx) tx = t; // bli stående i utkastet
          return res;
        },
        // Avbryt: berørte stier tilbake til verdien før utkastet
        rollback() {
          if (tx !== t) return;
          end();
          if (!t.touched.size) { if (waiters.length) push(false); return; }
          [...t.touched].forEach((p) => { data = p ? setIn(data, p, get(t.snap, p)) : t.snap; });
          emit('');
          if (waiters.length) push(false); // endringer fra før utkastet som ventet
        },
        // «Last inn»: forkast utkastet og ta inn endringen fra den andre kilden
        reload() {
          if (tx !== t) return;
          const v = t.remote;
          t.remote = null; t.touched.clear();
          if (v) { data = v; t.snap = v; cache(); }
          else data = t.snap;
          emit('');
        },
      };
      tx = t;
      return t.api;
    },
    // Tving lagring nå (Lagre-knappen) og vent på svar
    save() { return tx ? Promise.resolve({ ok: true, draft: true }) : push(true); },
    get pending() { return !!timer; },
    // Hent på nytt fra HA (ved åpning av popup) – ikke mens egne endringer venter
    async refresh(h) {
      if (h) hass = h;
      if (!hass || !hass.callWS || busy()) return data;
      try {
        const r = await hass.callWS({ type: 'frontend/get_user_data', key: KEY });
        if (r) remote(r.value);
      } catch (e) { /* */ }
      return data;
    },
    subscribe(cb) { subs.add(cb); return () => subs.delete(cb); },
    get loaded() { return loaded; },
    flush() { if (timer && !tx) write(); },
    async load(h) {
      if (h) hass = h;
      if (loaded || !hass || !hass.callWS) return data;
      if (loading) return loading;
      loading = (async () => {
        try {
          const r = await hass.callWS({ type: 'frontend/get_user_data', key: KEY });
          if (r && r.value && typeof r.value === 'object' && !busy()) { data = r.value; cache(); emit(''); }
        } catch (e) { /* eldre HA: behold cache */ }
        loaded = true;
        try { if (M.migrateNavProfiles) M.migrateNavProfiles(); } catch (e) { /* */ } // Fiks 19.13: 18.5/18.6 → nav_profiles
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
              remote(msg && msg.value);
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
  // Fiks 19.13: nav_profiles (haptic av / avstand fra bunnen per bruker × enhet) endret her eller fra en annen enhet →
  // haptic-flagget og navbaren oppdateres straks
  M.store.subscribe((d, path) => {
    if (path && !String(path).startsWith('nav_profiles')) return;
    try { if (M.hapticOff) M.hapticOff(); window.dispatchEvent(new CustomEvent('ki-nav-bottom')); } catch (e) { /* */ }
  });
})();
