// Testdata for Energi (#energi, msh-energi-card, fiks 21.1/21.3/21.9/21.10): et realistisk Energi-oppsett i HA
// (energy/get_prefs + energy/info) og statistikk (recorder/statistics_during_period: change per time/dag/måned for
// import/eksport/kostnad/undermålere/vann, og 5-minutters middel for effekten). Bare test – kortet har aldri mock-data.
window.mockExtend(({ add }) => {
  const E = { unit_of_measurement: 'kWh', device_class: 'energy', state_class: 'total_increasing' };
  const P = { unit_of_measurement: 'W', device_class: 'power', state_class: 'measurement' };
  add('sensor.ams_import', 48213.4, { ...E, friendly_name: 'AMS import' }, { platform: 'amshan', device: 'dev_ams' });
  add('sensor.ams_eksport', 12.8, { ...E, friendly_name: 'AMS eksport' }, { platform: 'amshan', device: 'dev_ams' });
  add('sensor.ams_effekt', 3120, { ...P, friendly_name: 'AMS effekt' }, { platform: 'amshan', device: 'dev_ams' });
  add('sensor.ams_import_kostnad', 31.72, { unit_of_measurement: 'NOK', device_class: 'monetary', state_class: 'total', friendly_name: 'AMS import kostnad' }, { platform: 'energy' });
  add('sensor.easee_energi', 5120.2, { ...E, friendly_name: 'Nr 5, Kristo Energi' }, { platform: 'easee', device: 'dev_easee' });
  add('sensor.easee_effekt', 7200, { ...P, friendly_name: 'Nr 5, Kristo Effekt' }, { platform: 'easee', device: 'dev_easee' });
  add('sensor.tesla_batteri', 68, { unit_of_measurement: '%', device_class: 'battery', friendly_name: 'Tesla batteri' }, { platform: 'tesla_fleet', device: 'dev_tesla' });
  add('binary_sensor.tesla_ladekabel', 'on', { device_class: 'plug', friendly_name: 'Tesla ladekabel' }, { platform: 'tesla_fleet', device: 'dev_tesla' });
  [['varmtvannsbereder_energi', 'Varmtvannsbereder'], ['varmepumpe_energi', 'Varmepumpe'], ['gulvvarme_bad_energi', 'Gulvvarme bad'], ['oppvaskmaskin_energi', 'Oppvaskmaskin'],
    ['vaskemaskin_energi', 'Vaskemaskin'], ['torketrommel_energi', 'Tørketrommel'], ['kjoleskap_energi', 'Kjøleskap']].forEach(([id, n]) => add('sensor.' + id, 812.4, { ...E, friendly_name: n + ' energi' }, { platform: 'shelly' }));
  add('sensor.vannmaler', 1843.2, { unit_of_measurement: 'L', device_class: 'water', state_class: 'total_increasing', friendly_name: 'Vannmåler' }, { platform: 'mqtt' });
});
(function () {
  const DEVS = [['sensor.easee_energi', null, 0.3], ['sensor.varmtvannsbereder_energi', null, 0.14], ['sensor.varmepumpe_energi', null, 0.18], ['sensor.gulvvarme_bad_energi', null, 0.07],
    ['sensor.oppvaskmaskin_energi', null, 0.04], ['sensor.vaskemaskin_energi', null, 0.03], ['sensor.torketrommel_energi', null, 0.035], ['sensor.kjoleskap_energi', null, 0.02]];
  const PREFS = {
    energy_sources: [
      { type: 'grid', flow_from: [{ stat_energy_from: 'sensor.ams_import', stat_cost: 'sensor.ams_import_kostnad', entity_energy_price: 'sensor.nordpool_kwh', number_energy_price: null }],
        flow_to: [{ stat_energy_to: 'sensor.ams_eksport', stat_compensation: null, entity_energy_price: null, number_energy_price: null }], cost_adjustment_day: 0 },
      { type: 'water', stat_energy_from: 'sensor.vannmaler', stat_cost: null, entity_energy_price: null, number_energy_price: null },
    ],
    device_consumption: DEVS.map(([id, name]) => ({ stat_consumption: id, ...(name ? { name } : {}) })),
  };
  // kWh importert per time (typisk norsk enebolig: morgen- og kveldstopp, elbil lader om natten)
  const PROF = [2.9, 8.1, 8.3, 7.9, 1.2, 1.3, 2.1, 3.6, 3.2, 2.2, 1.8, 1.7, 1.6, 1.5, 1.6, 1.9, 2.6, 3.4, 3.9, 3.5, 2.8, 2.3, 1.8, 1.4];
  const WAT = [0, 0, 0, 0, 0, 2, 38, 72, 25, 8, 6, 10, 18, 6, 5, 8, 14, 26, 48, 34, 22, 40, 12, 3];
  const PRICE = (h) => 1.1 + Math.sin((h - 5) / 3.4) * 0.45;
  const HOUR = 3600000;
  const wob = (t) => 0.85 + ((Math.sin(t / 7.3e6) + 1) / 2) * 0.3; // deterministisk variasjon
  function hourVal(id, t) {
    const d = new Date(t), h = d.getHours(), base = PROF[h] * wob(t);
    if (id === 'sensor.ams_import') return base;
    if (id === 'sensor.ams_eksport') return 0;
    if (id === 'sensor.ams_import_kostnad') return base * PRICE(h);
    if (id === 'sensor.vannmaler') return WAT[h] * wob(t + 1e6);
    const dv = DEVS.find((x) => x[0] === id);
    if (!dv) return null;
    if (id === 'sensor.easee_energi') return h >= 1 && h <= 3 ? 7.1 : 0;
    return (base - (h >= 1 && h <= 3 ? 7.1 : 0) > 0 ? base - (h >= 1 && h <= 3 ? 7.1 : 0) : 0.6) * dv[2] * 1.4;
  }
  function stats(m) {
    const s = Date.parse(m.start_time), e = Math.min(Date.parse(m.end_time), Date.now()), out = {};
    (m.statistic_ids || []).forEach((id) => {
      const rows = [];
      if (m.period === '5minute') {
        if (id !== 'sensor.ams_effekt') return;
        for (let t = s; t < e; t += 300000) { const h = new Date(t).getHours(); rows.push({ start: t, end: t + 300000, mean: PROF[h] * wob(t) * (0.8 + 0.4 * ((Math.sin(t / 9e5) + 1) / 2)) }); }
      } else {
        const step = (t) => { const d = new Date(t); if (m.period === 'hour') return t + HOUR; if (m.period === 'day') return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime(); return new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime(); };
        for (let t = s; t < e; t = step(t)) {
          const t2 = Math.min(step(t), e);
          let v = 0, any = false;
          for (let u = t; u < t2; u += HOUR) { const x = hourVal(id, u); if (x != null) { v += x; any = true; } }
          if (any) rows.push({ start: t, end: step(t), change: Math.round(v * 1000) / 1000 });
        }
      }
      if (rows.length) out[id] = rows;
    });
    return out;
  }
  const prev = window.mockHass;
  window.mockHass = function () {
    const h = prev();
    const ws = h.callWS;
    h.callWS = (m) => {
      if (window.__noEnergy && /^energy\//.test(m.type)) { (window.__calls || []).push(['ws', m.type, m]); return Promise.resolve(m.type === 'energy/get_prefs' ? null : {}); }
      if (m.type === 'energy/get_prefs') { (window.__calls || []).push(['ws', m.type, m]); return Promise.resolve(JSON.parse(JSON.stringify(PREFS))); }
      if (m.type === 'energy/info') { (window.__calls || []).push(['ws', m.type, m]); return Promise.resolve({ cost_sensors: {}, solar_forecast_domains: [] }); }
      if (m.type === 'recorder/statistics_during_period') { (window.__calls || []).push(['ws', m.type, m]); return Promise.resolve(stats(m)); }
      return ws(m);
    };
    return h;
  };
})();
