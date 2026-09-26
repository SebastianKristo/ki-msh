// Testdata for Sikkerhet (#sikkerhet): flere dør-/vindus-/bevegelsessensorer, lås med batteri, logbook-svar.
window.mockExtend(({ add, E }) => {
  add('binary_sensor.soverom_vindu', 'on', { device_class: 'window', friendly_name: 'Soverom vindu' }, { area: 'soverom' });
  add('binary_sensor.gang_bevegelse', 'off', { device_class: 'motion', friendly_name: 'Gang bevegelse' }, { area: 'gang' });
  add('binary_sensor.kjokken_vindu', 'off', { device_class: 'window', friendly_name: 'Kjøkkenvindu' }, { area: 'kjokken' });
  add('binary_sensor.garasjeport', 'off', { device_class: 'garage_door', friendly_name: 'Garasjeport' });
  add('binary_sensor.stue_tilstede', 'on', { device_class: 'occupancy', friendly_name: 'Stue tilstede' }, { area: 'stue' });
  add('lock.bod', 'unlocked', { friendly_name: 'Boddør' });
  add('sensor.inngangsdor_batteri', 40, { device_class: 'battery', unit_of_measurement: '%' }, { area: 'gang', device: 'dev_lock_inngang' });
  E['lock.inngangsdor'].device_id = 'dev_lock_inngang';
  E['sensor.inngangsdor_batteri'].device_id = 'dev_lock_inngang';
});
(function () {
  const orig = window.mockHass;
  window.mockHass = function () {
    const h = orig();
    const ws = h.callWS;
    h.callWS = (m) => {
      if (m.type === 'logbook/get_events') {
        const t = Date.now() / 1000;
        window.__calls.push(['ws', m.type, m]);
        return Promise.resolve([
          { entity_id: 'binary_sensor.soverom_vindu', state: 'on', when: t - 600 },
          { entity_id: 'alarm_control_panel.hjem', state: 'armed_away', when: t - 3000, context_user_id: 'u1' },
          { entity_id: 'lock.inngangsdor', state: 'locked', when: t - 3060 },
          { entity_id: 'binary_sensor.stue_bevegelse', state: 'on', when: t - 3500 },
          { entity_id: 'alarm_control_panel.hjem', state: 'disarmed', when: t - 7200 },
        ]);
      }
      return ws(m);
    };
    return h;
  };
})();
