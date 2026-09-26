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
});
(function () {
  const orig = window.mockHass;
  window.__wxSubs = 0; window.__wxUnsubs = 0;
  window.mockHass = function () {
    const h = orig();
    const sub = h.connection.subscribeMessage;
    h.connection = { subscribeMessage: (cb, m) => {
      if (m.type !== 'weather/subscribe_forecast') return sub(cb, m);
      window.__wxSubs++;
      const unsub = () => { window.__wxUnsubs++; };
      if (m.forecast_type === 'daily') {
        const d0 = new Date(); d0.setHours(12, 0, 0, 0);
        setTimeout(() => cb({ type: 'daily', forecast: Array.from({ length: 8 }, (_, i) => ({ datetime: new Date(d0.getTime() + i * 86400000).toISOString(), temperature: 16 + (i % 3), templow: 9 + (i % 2), condition: ['sunny', 'cloudy', 'rainy', 'partlycloudy', 'lightning-rainy', 'snowy-rainy', 'fog', 'sunny'][i], precipitation: [0, 0, 1.2, 0, 4.8, 2.3, 0, 0][i], wind_speed: 4 + i })) }), 10);
        return Promise.resolve(unsub);
      }
      return sub(cb, m).then(() => unsub);
    } };
    h.states['weather.home'].attributes = { ...h.states['weather.home'].attributes, wind_gust_speed: 11.4, cloud_coverage: 18, uv_index: 0.8, dew_point: 7.2, precipitation_unit: 'mm', pressure_unit: 'hPa' };
    return h;
  };
})();
