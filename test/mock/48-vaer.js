// Testdata for Vær (#vaer): sol, måne, pollen, farevarsel + dagsprognose. Teller av-/påmeldinger av prognose.
window.mockExtend(({ add }) => {
  const now = Date.now(), H = 3600000;
  add('sun.sun', 'above_horizon', { next_rising: new Date(now + 10 * H).toISOString(), next_setting: new Date(now + 3 * H).toISOString(), elevation: 18.4, friendly_name: 'Sol' }, { platform: 'sun' });
  add('sensor.moon_phase', 'first_quarter', { device_class: 'enum', options: ['new_moon', 'waxing_crescent', 'first_quarter', 'waxing_gibbous', 'full_moon', 'waning_gibbous', 'last_quarter', 'waning_crescent'], friendly_name: 'Månefase' }, { platform: 'moon' });
  add('sensor.pollen_bjork_oslo_today', 'Ingen', { friendly_name: 'Pollen bjørk', attribution: 'NAAF' }, { platform: 'naaf_pollen' });
  add('sensor.pollen_gress_oslo_today', 'Beskjeden', { friendly_name: 'Pollen gress' }, { platform: 'naaf_pollen' });
  add('sensor.pollen_burot_oslo_today', 'Moderat', { friendly_name: 'Pollen burot' }, { platform: 'naaf_pollen' });
  add('sensor.pollen_burot_oslo_tomorrow', 'Kraftig', { friendly_name: 'Pollen burot i morgen' }, { platform: 'naaf_pollen' });
  add('sensor.met_alerts', 1, { friendly_name: 'Farevarsler', alerts: [
    { title: 'Gult farevarsel · Kraftige vindkast', event: 'wind', awareness_level: '2; yellow; Moderate', starttime: new Date(now - 2 * H).toISOString(), endtime: new Date(now + 12 * H).toISOString(), description: 'Vindkast opp mot 20 m/s langs kysten.', instruction: 'Sikre løse gjenstander.', consequences: 'Løse gjenstander kan blåse vekk.', area: 'Østfold', map_url: 'https://www.yr.no' },
    { title: 'Jord- og flomskredfare · lav', event: 'landslide', awareness_level: '1; green; Minor' },
  ] }, { platform: 'met_alerts' });
  // NVE-varsel via generisk sensor.*_farevarsel (starter i morgen tidlig → «Fra … kl …»)
  add('sensor.halden_farevarsel', 'Gult', { friendly_name: 'Farevarsel Halden', title: 'Gult flomvarsel · Halden og Aremark', event: 'flood', level: 'yellow', source: 'NVE', starttime: new Date(now + 14 * H).toISOString(), endtime: new Date(now + 40 * H).toISOString(), description: 'Mye regn kan gi stor vannføring i mindre elver og bekker.', consequences: 'Oversvømmelse av veier og lavtliggende områder.', instruction: 'Hold stikkrenner og sluk åpne.', municipality: ['Halden', 'Aremark'] });
  // Meteoalarm uten aktivt varsel (binary_sensor off) → ignoreres
  add('binary_sensor.meteoalarm', 'off', { friendly_name: 'Meteoalarm' }, { platform: 'meteoalarm' });
  // Flere pollenarter (NAAF)
  add('sensor.pollen_hassel_oslo_today', 'Ingen', { friendly_name: 'Pollen hassel' }, { platform: 'naaf_pollen' });
  add('sensor.pollen_or_oslo_today', 'Ingen', { friendly_name: 'Pollen or' }, { platform: 'naaf_pollen' });
  // 26.25: sted nr. 2 (stedsvelgeren / «Legg til sted»)
  add('weather.hytta', 'snowy', { temperature: -3.2, humidity: 88, wind_speed: 6.1, wind_bearing: 10, pressure: 1003, friendly_name: 'Hytta', temperature_unit: '°C', wind_speed_unit: 'm/s', supported_features: 3 }, { platform: 'met' });
  add('sensor.pollen_salix_oslo_today', 'Beskjeden', { friendly_name: 'Pollen salix' }, { platform: 'naaf_pollen' });
});
(function () {
  const orig = window.mockHass;
  window.__wxSubs = 0; window.__wxUnsubs = 0;
  const now0 = () => { const d = new Date(); d.setMinutes(0, 0, 0); return d.getTime(); };
  window.mockHass = function () {
    const h = orig();
    const sub = h.connection.subscribeMessage;
    h.connection = { subscribeMessage: (cb, m) => {
      if (m.type !== 'weather/subscribe_forecast') return sub(cb, m);
      window.__wxSubs++;
      const unsub = () => { window.__wxUnsubs++; };
      if (m.forecast_type === 'daily') {
        const d0 = new Date(); d0.setHours(12, 0, 0, 0);
        setTimeout(() => cb({ type: 'daily', forecast: Array.from({ length: 8 }, (_, i) => ({ datetime: new Date(d0.getTime() + i * 86400000).toISOString(), temperature: 16 + (i % 3), templow: 9 + (i % 2), condition: ['sunny', 'cloudy', 'rainy', 'partlycloudy', 'lightning-rainy', 'snowy-rainy', 'fog', 'sunny'][i], precipitation: [0, 0, 1.2, 0, 4.8, 2.3, 0, 0][i], wind_speed: 4 + i, wind_bearing: 200 + i * 10, precipitation_probability: [5, 10, 80, 20, 90, 70, 15, 5][i], uv_index: [3, 1.5, 0.8, 2.4, 0.5, 0.3, 1, 3.2][i], humidity: 60 + i * 4 })) }), 10);
        return Promise.resolve(unsub);
      }
      // Timeprognose med trykk, UV, vindkast og nedbør (met.no-format)
      setTimeout(() => cb({ type: 'hourly', forecast: Array.from({ length: 30 }, (_, i) => ({ datetime: new Date(now0() + i * 3600000).toISOString(), temperature: 12 + Math.sin(i / 4) * 4, condition: ['partlycloudy', 'sunny', 'cloudy', 'rainy', 'rainy', 'cloudy', 'fog'][i % 7], precipitation: [0, 0, 0.1, 0.6, 1.2, 0, 0][i % 7], wind_speed: 4 + (i % 5) * 0.6, wind_gust_speed: 8 + (i % 4), pressure: 1012 - i * 0.6, uv_index: Math.max(0, 3 - i * 0.4), cloud_coverage: 40, is_daytime: i < 6 })) }), 10);
      return Promise.resolve(unsub);
    } };
    h.states['weather.home'].attributes = { ...h.states['weather.home'].attributes, wind_gust_speed: 11.4, cloud_coverage: 18, uv_index: 0.8, dew_point: 7.2, precipitation_unit: 'mm', pressure_unit: 'hPa' };
    return h;
  };
})();
