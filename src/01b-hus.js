/* Runde 2 · Husmodellen fra integrasjonen (custom_components/ki_msh) – MSH.hus
 *
 * Med integrasjonen installert samler serveren alt dashbordet trenger i ÉN modell (websocket ki_msh/hus): rommene som er
 * valgt i Konfigurer → Rom (med KI Rom-kartleggingen og HAs egne klimasensorer for området), etasjer, funksjons-popups,
 * kilder (KI Rom, KI Energi, KI Varslinger …), Energi-oppsettet og reservesensorene for hus/rom uten egen sensor.
 * Uten integrasjonen (ren frontend-ressurs) svarer HA «unknown_command» → MSH.hus.data er null og alt virker som før
 * (registre + KI Rom-sensorene direkte).
 *
 *   await MSH.hus.load(hass)  → modellen eller null (ett kall om gangen, gjenbrukes – live-oppdatert via abonnement)
 *   MSH.hus.data · .rom(area) · .romIds() · .reserve('temperatur'|'fuktighet') · .kilde('ki_energi') · .energi()
 *   window 'ki-hus' (detail = modellen) når rev endres – nytt rom, ny enhet, KI Rom lagt til/fjernet …
 *
 * Live: ki_msh/hus/abonner sender modellen nå og ved hver ny rev → popupene genereres på nytt (MSH.refreshPopups),
 * uten omlasting. Abonnementet startes bare når dashbordet faktisk har lest modellen (ingen polling).
 */
(() => {
  const M = window.MSH;
  if (!M || M.hus) return;
  const H = (M.hus = { data: null, ok: null });
  let pending = null, conn = null, unsub = null, failT = 0;
  const valid = (d) => !!(d && typeof d === 'object' && Array.isArray(d.rom));
  // Ny modell → true når den erstatter en eldre med annen rev (da må popupene genereres på nytt)
  const set = (d) => {
    if (!valid(d)) return false;
    const old = H.data;
    H.data = d; H.ok = true;
    if (old && old.rev === d.rev) return false;
    try { window.dispatchEvent(new CustomEvent('ki-hus', { detail: d })); } catch (e) { /* */ }
    return !!old;
  };
  const stop = () => { const u = unsub; unsub = null; conn = null; if (u) u.then((f) => f && f()).catch(() => {}); };

  H.load = function (hass) {
    if (!hass || !hass.callWS) return Promise.resolve(H.data);
    if (conn && hass.connection && hass.connection !== conn) { stop(); H.data = null; H.ok = null; } // ny tilkobling (ny innlogging/server)
    if (H.data) { H.subscribe(hass); return Promise.resolve(H.data); }
    if (H.ok === false || Date.now() - failT < 30000) return Promise.resolve(null);
    if (pending) return pending;
    pending = hass.callWS({ type: 'ki_msh/hus' }).then((d) => {
      if (!valid(d)) { H.ok = false; return null; } // svaret er ikke husmodellen (eldre integrasjon / test)
      set(d); H.subscribe(hass); return H.data;
    }, (e) => {
      // unknown_command = integrasjonen er ikke installert → ren frontend for resten av økten. not_loaded o.l. → prøv igjen senere.
      if (e && e.code === 'unknown_command') H.ok = false; else failT = Date.now();
      return null;
    }).finally(() => { pending = null; });
    return pending;
  };

  H.subscribe = function (hass) {
    const c = hass && hass.connection;
    if (!c || !c.subscribeMessage || (unsub && conn === c)) return;
    stop();
    conn = c;
    unsub = Promise.resolve(c.subscribeMessage((d) => {
      if (set(d) && M.strategyConfig && M.refreshPopups) M.refreshPopups();
    }, { type: 'ki_msh/hus/abonner' })).catch(() => { unsub = null; return null; });
  };

  H.rom = (area) => (H.data && H.data.rom.find((r) => r.area_id === area)) || null;
  H.romIds = () => (H.data ? H.data.rom.map((r) => r.area_id) : null);
  H.reserve = (k) => (H.data && H.data.reserve && H.data.reserve[k]) || null;
  H.kilde = (n) => (H.data && H.data.kilder && H.data.kilder[n]) || null;
  H.energi = () => (H.data && H.data.energi && H.data.energi.lastet ? H.data.energi : null);
  // Test / feilsøking
  H._set = (d) => { H.ok = null; return set(d); };
  H._reset = () => { stop(); H.data = null; H.ok = null; failT = 0; pending = null; };
})();
