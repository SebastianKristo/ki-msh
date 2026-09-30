// Testdata for Tesla (#tesla, msh-tesla-card, fiks 24.8): Tesla-integrasjonen (tesla_model_y_* / folkevogn_*), laderen
// (elbillader_*), KI Tesla (sensor.ki_tesla_*) og KI Drivstoff (sensor.ki_drivstoff_*), + statistikk per dag for daglig
// kjøring og spart i år. Navnene følger ki-cards/examples og den importerte popupen. Bare test – kortet har aldri mock-data.
(function () {
  window.mockExtend(({ add }) => {
    const T = { platform: 'tesla_custom' };
    add('sensor.tesla_model_y_batteri_batteriniva', 64, { unit_of_measurement: '%', friendly_name: 'Tesla Batterinivå' }, T);
    add('sensor.tesla_model_y_batteri_estimert_batterirekkevidde', 312, { unit_of_measurement: 'km', friendly_name: 'Tesla Estimert rekkevidde' }, T);
    add('sensor.tesla_model_y_batteri_charge_power', 7.4, { unit_of_measurement: 'kW', friendly_name: 'Tesla Ladeeffekt' }, T);
    add('select.tesla_model_y_batteri_charging_state', 'charging', { options: ['disconnected', 'charging', 'complete', 'stopped'], friendly_name: 'Tesla Ladestatus' }, T);
    add('switch.tesla_model_y_batteri_charging_port', 'on', { friendly_name: 'Tesla Ladeport' }, T);
    add('switch.elbillader_charging', 'on', { friendly_name: 'Elbillader lading' }, { platform: 'easee' });
    add('sensor.elbillader_charge_power', 7.4, { unit_of_measurement: 'kW', friendly_name: 'Elbillader effekt' }, { platform: 'easee' });
    add('input_number.tesla_model_y_ladegrense', 80, { min: 50, max: 100, step: 5, unit_of_measurement: '%', friendly_name: 'Tesla Ladegrense' });
    add('switch.tesla_model_y_car_doors_locked', 'on', { friendly_name: 'Tesla Dører låst' }, T);
    add('button.folkevogn_honk_horn', 'unknown', { friendly_name: 'Folkevogn Tut' }, T);
    add('switch.tesla_model_y_klima_climate_defrost', 'on', { friendly_name: 'Tesla Defrost' }, T);
    add('switch.tesla_model_y_car_trunk_front', 'off', { friendly_name: 'Tesla Frunk' }, T);
    add('switch.tesla_model_y_car_trunk_rear', 'on', { friendly_name: 'Tesla Bagasjerom' }, T);
    add('switch.tesla_model_y_klima_climate_window_vent', 'off', { friendly_name: 'Tesla Vinduer på gløtt' }, T);
    add('sensor.tesla_model_y_car_drive_speed', 0, { unit_of_measurement: 'km/h', friendly_name: 'Tesla Fart' }, T);
    add('sensor.tesla_model_y_kilometerteller', 48213, { unit_of_measurement: 'km', friendly_name: 'Tesla Kilometerteller' }, T);
    add('sensor.tesla_model_y_daglig_kjoring', 23, { unit_of_measurement: 'km', friendly_name: 'Tesla Daglig kjøring' }, T);
    add('sensor.ki_tesla_ladetid_gjenstaende', 95, { unit_of_measurement: 'min', friendly_name: 'KI Tesla Ladetid gjenstående' }, { platform: 'ki_tesla' });
    add('sensor.ki_tesla_ladepris_estimat', 38, { unit_of_measurement: 'kr', friendly_name: 'KI Tesla Ladepris estimat' }, { platform: 'ki_tesla' });
    add('sensor.ki_tesla_forrige_lading_kostnad', 112, { unit_of_measurement: 'kr', friendly_name: 'KI Tesla Forrige lading' }, { platform: 'ki_tesla' });
    const D = { platform: 'ki_drivstoff' };
    add('sensor.ki_drivstoff_spart_denne_maneden', 612, { unit_of_measurement: 'kr', diesel_ville_kostet: 1040, strom_kostet: 428, kjort_km: 820, friendly_name: 'Spart denne måneden' }, D);
    add('sensor.ki_drivstoff_spart_i_ar', 8450, { unit_of_measurement: 'kr', diesel_ville_kostet: 14100, strom_kostet: 5650, kjort_km: 11200, friendly_name: 'Spart i år' }, D);
    add('sensor.ki_drivstoff_kostnad_per_mil_tesla_model_y', 5.04, { unit_of_measurement: 'kr/mil', forbruk: '1,68 kWh/mil', friendly_name: 'Kostnad per mil – Tesla Model Y' }, D);
    add('sensor.ki_drivstoff_kostnad_per_mil_audi_a6_avant_2011', 12.6, { unit_of_measurement: 'kr/mil', forbruk: '0,62 L/mil', friendly_name: 'Kostnad per mil – Audi A6 Avant' }, D);
    add('sensor.ki_drivstoff_liter_diesel_spart_i_ar', 695, { unit_of_measurement: 'L', friendly_name: 'Liter diesel spart i år' }, D);
    add('sensor.ki_drivstoff_co2_spart_i_ar', 1840, { unit_of_measurement: 'kg', friendly_name: 'CO₂ spart i år' }, D);
    add('sensor.ki_drivstoff_dieselpris', 'unknown', { unit_of_measurement: 'kr/L', friendly_name: 'Dieselpris' }, D);
    add('sensor.ki_drivstoff_ladepris', 1.12, { unit_of_measurement: 'kr/kWh', friendly_name: 'Ladepris' }, D);
  });
  const day = (n) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + n); return d.getTime(); };
  const prev = window.mockHass;
  window.mockHass = function () {
    const h = prev();
    const ws = h.callWS;
    h.callWS = (m) => {
      if (m.type === 'recorder/statistics_during_period' && (m.statistic_ids || []).some((id) => /tesla_model_y_daglig|ki_drivstoff_spart/.test(id))) {
        (window.__calls || []).push(['ws', m.type, m]);
        const out = {};
        (m.statistic_ids || []).forEach((id) => {
          if (/daglig/.test(id)) out[id] = [31, 12, 0, 54, 18, 40].map((v, i) => ({ start: day(i - 6), end: day(i - 5), max: v }));
          else out[id] = Array.from({ length: 30 }, (_, i) => ({ start: day(i - 30), end: day(i - 29), change: [22, 18, 0, 31, 25, 12, 40][i % 7] }));
        });
        return Promise.resolve(out);
      }
      return ws(m);
    };
    return h;
  };
})();
