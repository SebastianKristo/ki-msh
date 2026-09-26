// Testdata for msh-person-(hero-)card: mobile_app-enhet for Sebastian, søvnsensorer og sone-historikk.
window.mockExtend(({ add, S, D }) => {
  D.dev_seb_iphone = { id: 'dev_seb_iphone', name: 'Sebastian iPhone', model: 'iPhone 16 Pro', manufacturer: 'Apple', area_id: null };
  const R = { platform: 'mobile_app', device: 'dev_seb_iphone' };
  add('device_tracker.sebastian_iphone', 'home', { friendly_name: 'Sebastian iPhone', source_type: 'gps', latitude: 59.9, longitude: 10.7 }, R);
  add('sensor.sebastian_iphone_battery_level', 64, { unit_of_measurement: '%', device_class: 'battery' }, { ...R, category: 'diagnostic' });
  add('sensor.sebastian_iphone_battery_state', 'Not Charging', {}, { ...R, category: 'diagnostic' });
  add('sensor.sebastian_iphone_connection_type', 'Wi-Fi', {}, { ...R, category: 'diagnostic' });
  add('sensor.sebastian_iphone_ssid', 'Hjemme-5G', {}, { ...R, category: 'diagnostic' });
  add('sensor.sebastian_iphone_steps', 8412, { unit_of_measurement: 'steps' }, R);
  add('sensor.sebastian_iphone_distance', 5230, { unit_of_measurement: 'm' }, R);
  add('binary_sensor.sebastian_iphone_focus', 'off', {}, R);
  add('sensor.sebastian_iphone_geocoded_location', 'Storgata 1, 452 30 Strømstad, Sverige', { Locality: 'Strømstad' }, R);
  add('sensor.sebastian_sleep_duration', 7.2, { unit_of_measurement: 'h', device_class: 'duration' });
  add('sensor.sebastian_sleep_score', 82, {});
  const bed = new Date(); bed.setHours(0, 0, 0, 0); bed.setMinutes(-24);
  add('sensor.sebastian_sleep_start', bed.toISOString(), { device_class: 'timestamp' });
  add('sensor.sebastian_deep_sleep', 96, { unit_of_measurement: 'min' });
  add('sensor.sebastian_light_sleep', 230, { unit_of_measurement: 'min' });
  add('sensor.sebastian_rem_sleep', 86, { unit_of_measurement: 'min' });
  add('sensor.sebastian_awake', 20, { unit_of_measurement: 'min' });
  add('zone.home', 0, { friendly_name: 'Hjem', icon: 'mdi:home' });
  add('zone.skole', 0, { friendly_name: 'Skole', icon: 'mdi:school' });
  const t = new Date(); t.setHours(16, 42, 0, 0);
  add('person.sebastian', 'home', { friendly_name: 'Sebastian', entity_picture: '', source: 'device_tracker.sebastian_iphone', device_trackers: ['device_tracker.sebastian_iphone'] });
  S['person.sebastian'].last_changed = (t > new Date() ? new Date(Date.now() - 3600000) : t).toISOString();
});
(function () {
  const orig = window.mockHass;
  window.mockHass = function () {
    const h = orig();
    const ws = h.callWS;
    h.callWS = (m) => {
      if (m.type === 'history/history_during_period' && (m.entity_ids || []).includes('person.sebastian')) {
        const d = (hh, mm) => { const x = new Date(); x.setHours(hh, mm, 0, 0); return Math.min(x.getTime(), Date.now() - 60000) / 1000; };
        return Promise.resolve({ 'person.sebastian': [{ s: 'home', lu: d(0, 0) }, { s: 'not_home', lu: d(7, 40) }, { s: 'Skole', lu: d(8, 12) }, { s: 'not_home', lu: d(15, 58) }, { s: 'home', lu: d(16, 42) }] });
      }
      if (m.type === 'history/history_during_period' && (m.entity_ids || []).includes('sensor.sebastian_sleep_duration')) {
        const now = Date.now() / 1000, v = [6.8, 7.4, 6.1, 7.9, 7.2, 8.4, 7.2];
        return Promise.resolve({ 'sensor.sebastian_sleep_duration': v.map((x, i) => ({ s: String(x), lu: now - (6 - i) * 86400 - 60 })) });
      }
      return ws(m);
    };
    return h;
  };
})();
