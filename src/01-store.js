/* KI MSH · ki-store – innstillinger fra dashbord-editorene (Tilpass Hjem/navbar/header/rom …).
 * Lagres per HA-bruker med frontend/set_user_data (nøkkel «ki_dashboard») og synkes mellom alle enhetene til
 * brukeren. Trigger ingen Lovelace-rebuild. localStorage er bare cache for rask første visning.
 *   MSH.store.get(path)            – les (sti med punktum, tom = alt)
 *   MSH.store.set(path, value)     – skriv (debounce 600 ms mot HA), varsler abonnenter straks
 *   MSH.store.subscribe(cb)        – cb(data, path) ved endring; returnerer avmelding
 *   MSH.store.load(hass)           – hent fra HA (kalles automatisk av kortene)
 * Kortconfig: cards.<card_id> = kortets config fra egen editor; effektiv config = { ...YAML, ...store }.
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
  const push = () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      timer = null;
      if (!hass || !hass.callWS) return;
      try { await hass.callWS({ type: 'frontend/set_user_data', key: KEY, value: data }); M.haptic('success'); }
      catch (e) { M.toast('Kunne ikke lagre: ' + (e.message || e)); }
    }, 600);
  };

  M.store = {
    get: (path) => get(data, path),
    set(path, value) {
      data = path ? setIn(data, path, value) : (value || {});
      cache(); emit(path); push();
    },
    subscribe(cb) { subs.add(cb); return () => subs.delete(cb); },
    get loaded() { return loaded; },
    flush() { if (timer) { clearTimeout(timer); timer = null; if (hass) hass.callWS({ type: 'frontend/set_user_data', key: KEY, value: data }).catch(() => {}); } },
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
    card: (id) => (id ? get(data, 'cards.' + id) || null : null),
    setCard(id, cfg) {
      if (!id) return;
      const { type, ...rest } = cfg || {};
      M.store.set('cards.' + id, rest);
    },
  };
  window.kiStore = M.store;
})();
