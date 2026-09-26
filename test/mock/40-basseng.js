// Testdata for Basseng-popupen (kun test).
window.mockExtend(({ add }) => {
  const A = { area: 'basseng' };
  add('climate.basseng_varmepumpe', 'heat', { temperature: 26, current_temperature: 25.1, hvac_action: 'heating', hvac_modes: ['off', 'heat'], min_temp: 15, max_temp: 35, friendly_name: 'Basseng varmepumpe' }, A);
  add('light.basseng_lys', 'on', { friendly_name: 'Basseng lys', supported_color_modes: ['onoff'] }, A);
  add('cover.basseng_tak', 'open', { friendly_name: 'Pooltak', current_position: 100 }, A);
  add('switch.basseng_spreder', 'off', { friendly_name: 'Basseng spreder' }, A);
  add('number.basseng_spreder_varighet', 10, { unit_of_measurement: 'min', min: 1, max: 60, step: 1, friendly_name: 'Spreder varighet' }, A);
  add('select.basseng_driftsmodus', 'Balansert', { options: ['Boost', 'Spreder', 'Eco', 'Balansert', 'Badeklar'], friendly_name: 'Basseng driftsmodus' }, A);
  add('input_boolean.basseng_automatikk', 'on', { friendly_name: 'Basseng automatikk' }, A);
  add('input_boolean.basseng_prisstyring', 'on', { friendly_name: 'Basseng prisstyring' }, A);
  add('input_boolean.basseng_varmeprioritet', 'off', { friendly_name: 'Basseng varmeprioritet' }, A);
  add('input_boolean.basseng_nattsenking', 'on', { friendly_name: 'Basseng nattsenking' }, A);
  add('input_boolean.basseng_vintermodus', 'off', { friendly_name: 'Basseng vintermodus' }, A);
  add('sensor.basseng_omsetninger', 2.48, { friendly_name: 'Basseng omsetninger i dag' }, A);
  add('sensor.basseng_spart_i_dag', 9, { unit_of_measurement: 'kr', friendly_name: 'Basseng spart i dag' }, A);
  add('sensor.basseng_stromkostnad', 9.2, { unit_of_measurement: 'NOK', device_class: 'monetary', friendly_name: 'Basseng strømkostnad i dag' }, A);
  add('sensor.basseng_utetemperatur', 18, { unit_of_measurement: '°C', device_class: 'temperature', friendly_name: 'Basseng utetemperatur' }, A);
  add('sensor.basseng_varmetap', 800, { unit_of_measurement: 'W', friendly_name: 'Basseng varmetap' }, A);
  add('sensor.basseng_sol_inn', 3821, { unit_of_measurement: 'W', friendly_name: 'Basseng sol inn' }, A);
  add('sensor.basseng_varmepumpe_effekt', 1250, { unit_of_measurement: 'W', device_class: 'power', friendly_name: 'Basseng varmepumpe effekt' }, A);
  add('calendar.klorlogg', 'off', { friendly_name: 'Klorlogg' }, { platform: 'local_calendar' });
});
(function () {
  const prev = window.mockHass;
  window.mockHass = function () {
    const h = prev();
    const old = h.callApi;
    h.callApi = (method, path) => {
      if (/^calendars\/calendar\.klorlogg/.test(path)) {
        const now = new Date(), ev = (dAgo, s) => { const t = new Date(now.getTime() - dAgo * 86400000); return { summary: s, uid: 'k' + dAgo, start: { dateTime: t.toISOString() }, end: { dateTime: new Date(t.getTime() + 300000).toISOString() } }; };
        return Promise.resolve([ev(15, 'Klortablett · Sebastian'), ev(8, 'Klortablett · Cybele ×2'), ev(1, 'Klortablett · Sebastian')]);
      }
      return old ? old(method, path) : Promise.resolve([]);
    };
    return h;
  };
})();
