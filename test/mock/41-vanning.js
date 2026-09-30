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
// Innstillinger (4.5 · systemets velgere): tall og klokkeslett i hageområdet
window.mockExtend(({ add }) => {
  add('number.vanning_regnpause', 24, { unit_of_measurement: 'h', min: 0, max: 96, step: 1, mode: 'box', friendly_name: 'Vanning regnpause' }, { area: 'hage' });
  add('input_number.vanning_kjoretid', 12.5, { unit_of_measurement: 'min', min: 0, max: 600, step: 0.5, friendly_name: 'Vanning kjøretid' }, { area: 'hage' });
  add('time.vanning_start', '05:30:00', { friendly_name: 'Vanning start' }, { area: 'hage' });
  add('input_datetime.vanning_neste', '2026-10-02 06:00:00', { has_date: true, has_time: true, friendly_name: 'Vanning neste' }, { area: 'hage' });
});
// KI Vann (Fiks 25.2): husets vannforbruk i dag per kategori (ki-cards 71-ki-vann-card), prefiks sensor.hjemme_
window.mockExtend(({ add }) => {
  const kv = { platform: 'ki_vann' }, A = { integrasjon: 'ki_vann', unit_of_measurement: 'L', state_class: 'total_increasing' };
  const t = (h, m) => { const d = new Date(); d.setHours(h, m, 0, 0); return d.toISOString(); };
  add('sensor.hjemme_vann_i_dag', 286, { ...A, friendly_name: 'Hjemme Vann i dag', per_person: 143, hendelser: [{ tid: t(7, 5), kategori: 'dusj', liter: 62 }, { tid: t(7, 40), kategori: 'toalett', liter: 6 }, { tid: t(9, 10), kategori: 'oppvaskmaskin', liter: 12 }] }, kv);
  [['dusj', 118], ['toalett', 54], ['handvask', 9], ['oppvask_og_matlaging', 21], ['vaskemaskin', 44], ['oppvaskmaskin', 12], ['utendors', 0], ['basis_og_udefinert', 28]]
    .forEach(([k, v]) => add(`sensor.hjemme_${k}_i_dag`, v, { ...A, friendly_name: `Hjemme ${k} i dag` }, kv));
  add('sensor.hjemme_vannkostnad_i_dag', 11.8, { integrasjon: 'ki_vann', unit_of_measurement: 'kr', friendly_name: 'Hjemme Vannkostnad i dag' }, kv);
  add('sensor.hjemme_modell', 'Lært', { integrasjon: 'ki_vann', timer_i_vindu: 36, friendly_name: 'Hjemme Modell' }, kv);
  add('sensor.hjemme_forklart_av_sensorene', 72, { integrasjon: 'ki_vann', unit_of_measurement: '%', friendly_name: 'Hjemme Forklart av sensorene' }, kv);
  add('sensor.hjemme_storste_forbruker_i_dag', 'Dusj', { integrasjon: 'ki_vann', friendly_name: 'Hjemme Største forbruker i dag' }, kv);
});
