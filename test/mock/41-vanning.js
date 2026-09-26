// Testdata for Vanning-popupen (kun test): OpenSprinkler-stasjoner/program, kalenderplan, vannmåler.
window.mockExtend(({ add }) => {
  const OS = { platform: 'opensprinkler' };
  add('sensor.plen_nord_station_status', 'idle', { friendly_name: 'Plen nord Station Status' }, OS);
  add('switch.plen_nord_station_enabled', 'on', { friendly_name: 'Plen nord Station Enabled' }, OS);
  add('sensor.plen_sor_station_status', 'waiting', { friendly_name: 'Plen sør Station Status' }, OS);
  add('switch.plen_sor_station_enabled', 'on', { friendly_name: 'Plen sør Station Enabled' }, OS);
  add('sensor.lavendelbed_station_status', 'disabled', { friendly_name: 'Lavendelbed Station Status' }, OS);
  add('switch.lavendelbed_station_enabled', 'off', { friendly_name: 'Lavendelbed Station Enabled' }, OS);
  add('switch.opensprinkler_enabled', 'on', { friendly_name: 'OpenSprinkler Enabled' }, OS);
  add('binary_sensor.opensprinkler_rain_delay_active', 'off', { friendly_name: 'Rain Delay Active' }, OS);
  add('sensor.opensprinkler_current_draw', 410, { unit_of_measurement: 'mA', friendly_name: 'Current Draw' }, OS);
  add('switch.morgenrunde_program_enabled', 'on', { friendly_name: 'Morgenrunde Program Enabled' }, OS);
  add('binary_sensor.morgenrunde_program_running', 'off', { friendly_name: 'Morgenrunde Program Running' }, OS);
  add('sensor.hage_vannmaler', 15320, { unit_of_measurement: 'L', device_class: 'water', state_class: 'total_increasing', friendly_name: 'Hage vannmåler' }, { area: 'hage' });
  add('input_boolean.vanning_hopp_over', 'off', { friendly_name: 'Vanning hopp over neste' }, { area: 'hage' });
  add('calendar.vanning', 'off', { friendly_name: 'Vanning' }, { platform: 'local_calendar' });
  add('automation.vanning_plen_morgen', 'on', { friendly_name: 'Vanning plen morgen', last_triggered: new Date(Date.now() - 86400000).toISOString() }, { platform: 'automation' });
});
(function () {
  const prev = window.mockHass;
  window.mockHass = function () {
    const h = prev();
    const oldApi = h.callApi, oldWS = h.callWS;
    const at = (dd, hh, mm) => { const d = new Date(); d.setHours(hh, mm, 0, 0); d.setDate(d.getDate() + dd); return d; };
    const ev = (dd, hh, mm, min, summary) => { const a = at(dd, hh, mm); return { summary, uid: 'v' + dd + hh + mm, start: { dateTime: a.toISOString() }, end: { dateTime: new Date(a.getTime() + min * 60000).toISOString() } }; };
    h.callApi = (method, path) => {
      if (/^calendars\/calendar\.vanning/.test(path)) return Promise.resolve([ev(-3, 5, 0, 20, 'Plen foran'), ev(1, 5, 0, 25, 'Plen nord'), ev(2, 5, 0, 60, 'Runde: Plen foran, Bed bak, Vanning drypp'), ev(5, 5, 25, 25, 'Plen sør')]);
      return oldApi ? oldApi(method, path) : Promise.resolve([]);
    };
    h.callWS = (m) => {
      if (m.type === 'recorder/statistics_during_period' && (m.statistic_ids || []).includes('sensor.hage_vannmaler')) {
        const rows = Array.from({ length: 20 }, (_, i) => { const d = at(-19 + i, 0, 0); return { start: d.getTime(), end: d.getTime() + 86400000, change: [0, 0, 420, 0, 0, 962, 0, 0, 310, 0, 0, 0, 640, 0, 0, 0, 380, 0, 0, 120][i] }; });
        return Promise.resolve({ 'sensor.hage_vannmaler': rows });
      }
      if (m.type === 'history/history_during_period' && (m.entity_ids || []).includes('valve.hage_sone_1')) {
        return oldWS(m).then((r) => {
          const pts = [];
          [-16, -12, -8, -3].forEach((dd) => { pts.push({ s: 'open', lu: at(dd, 5, 0).getTime() / 1000 }, { s: 'closed', lu: at(dd, 5, 20).getTime() / 1000 }); });
          return { ...r, 'valve.hage_sone_1': pts, 'valve.hage_sone_2': [{ s: 'open', lu: at(-2, 5, 20).getTime() / 1000 }, { s: 'closed', lu: at(-2, 5, 40).getTime() / 1000 }, { s: 'open', lu: Date.now() / 1000 - 240 }] };
        });
      }
      return oldWS(m);
    };
    return h;
  };
})();
