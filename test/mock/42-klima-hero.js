// Testdata for Klima-popupens skall (hero, status, moduser, terskler) – KI Energi-integrasjonen (kun test).
// Eies av skallet (src/42-klima.js). Blokkenes øvrige entiteter ligger i test/mock/42-klima.js.
// Tilstand kan byttes i testene med window.__klimaHero(tilstand), tilstand = ok|yellow|orange|red|critical|fallback|off.
window.mockExtend(({ add, S }) => {
  const P = { platform: 'ki_energi' };
  const base = {
    friendly_name: 'KI Energi status', hustype: 'bolig', personer: [{ key: 'sebastian', navn: 'Sebastian', type: 'ungdom' }, { key: 'cybele', navn: 'Cybele', type: 'barn' }],
    effekt_kw: 1.42, tillatt_effekt_kw: 5.5, forventet_effekt_kw: 1.42, forbrukt_kwh: 0.31, grense_kwh: 5.5, igjen_kwh: 5.19, ledig_kw: 4.08, minutter_igjen: 33,
    uregulert_kw: 0.9, vvb_reservert_kw: 0, malekilde: 'sensor.ki_time_energi', forklaring: 'Bruker 1,42 kW av 5,50 kW tillatt.', skyggemodus: false, lading: false,
  };
  add('sensor.ki_energi_status', 'gronn', base, P);
  add('sensor.ki_laster', 7, { friendly_name: 'KI laster', laster: [
    { key: 'stue', navn: 'Stue', type: 'klima', handling: 'normal', settpunkt: 21 },
    { key: 'kjokken_gulv', navn: 'Kjøkken gulvvarme', type: 'klima', handling: 'normal', settpunkt: 22 },
    { key: 'bad_gulv', navn: 'Bad gulvvarme', type: 'klima', handling: 'normal', settpunkt: 23 },
    { key: 'sebastian', navn: 'Sebastian panelovn', type: 'klima', handling: 'normal', settpunkt: 21, person: true, person_type: 'ungdom' },
  ] }, P);
  add('number.ki_terskel_gul', 75, { unit_of_measurement: '%', min: 0, max: 120, step: 1, friendly_name: 'Gul fra' }, P);
  add('number.ki_terskel_oransje', 88, { unit_of_measurement: '%', min: 0, max: 120, step: 1, friendly_name: 'Oransje fra' }, P);
  add('number.ki_terskel_rod', 97, { unit_of_measurement: '%', min: 0, max: 120, step: 1, friendly_name: 'Rød fra' }, P);
  add('switch.ki_energi_hovedbryter', 'on', { friendly_name: 'Energimotor' }, P);
  add('switch.ki_helgemodus', 'off', { friendly_name: 'Bortemodus' }, P);
  add('binary_sensor.ki_alle_borte', 'off', { friendly_name: 'Alle borte' }, P);
  add('switch.ki_hjemkomst_aktiv', 'off', { friendly_name: 'Hjemkomst' }, P);
  add('switch.ki_sommermodus', 'off', { friendly_name: 'Sommermodus' }, P);
  add('switch.ki_sebastian_ferie', 'on', { friendly_name: 'Sebastian ferie' }, P);
  add('sensor.ki_tilstedevaerelse', 'hjemme', { friendly_name: 'Tilstedeværelse', tekst: 'Hjemme · 3 personer' }, P);

  // Tilstandene i heroen (brukes av Playwright-sjekken): endrer mock-verdiene på stedet
  const Z = {
    ok: ['gronn', { effekt_kw: 1.42, ledig_kw: 4.08, forbrukt_kwh: 0.31 }, {}],
    yellow: ['gul', { effekt_kw: 4.4, ledig_kw: 1.1, forbrukt_kwh: 1.9 }, {}],
    orange: ['oransje', { effekt_kw: 5.0, ledig_kw: 0.5, forbrukt_kwh: 2.6 }, {}],
    red: ['rod', { effekt_kw: 5.4, ledig_kw: 0.1, forbrukt_kwh: 3.1 }, { senk: ['bad_gulv', 'kjokken_gulv'] }],
    critical: ['kritisk', { effekt_kw: 6.6, ledig_kw: 0, forbrukt_kwh: 5.7, forventet_effekt_kw: 6.6 }, { senk: ['bad_gulv', 'kjokken_gulv', 'stue'] }],
    fallback: ['fallback', { effekt_kw: null, tillatt_effekt_kw: null, forventet_effekt_kw: null, ledig_kw: null }, {}],
    off: ['av', {}, { motorOff: true }],
  };
  window.__klimaHero = (z) => {
    const [state, a, o] = Z[z] || Z.ok;
    const at = { ...base, ...a };
    Object.keys(at).forEach((k) => { if (at[k] === null) delete at[k]; });
    S['sensor.ki_energi_status'] = { ...S['sensor.ki_energi_status'], state, attributes: at, last_updated: new Date().toISOString() };
    const L = S['sensor.ki_laster'];
    S['sensor.ki_laster'] = { ...L, attributes: { ...L.attributes, laster: L.attributes.laster.map((l) => ({ ...l, handling: (o.senk || []).includes(l.key) ? 'senket' : 'normal' })) } };
    S['switch.ki_energi_hovedbryter'] = { ...S['switch.ki_energi_hovedbryter'], state: o.motorOff ? 'off' : 'on' };
  };
});
