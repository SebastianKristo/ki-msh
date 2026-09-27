// Testdata for Dørlås (#dorlas, msh-las-card): lock.inngangsdor med batteri (sensor på samme enhet, 46-mocken),
// auto-lås (number + switch på samme enhet), «Lås når alle drar» / «Lås om natten», lock.bod med code_format (PIN),
// og logbook-svar for låsene (context_user_id → person.sebastian).
window.mockExtend(({ add, S, E }) => {
  add('number.inngangsdor_auto_lock_time', 2, { unit_of_measurement: 'min', min: 0, max: 30, step: 1, friendly_name: 'Inngangsdør auto lock tid' }, { device: 'dev_lock_inngang', category: 'config' });
  add('switch.inngangsdor_auto_lock', 'on', { friendly_name: 'Inngangsdør auto lock' }, { device: 'dev_lock_inngang', category: 'config' });
  add('automation.las_dora_nar_alle_drar', 'on', { friendly_name: 'Lås døra når alle drar' });
  add('automation.las_dora_om_natten', 'off', { friendly_name: 'Lås døra om natten' });
  if (S['lock.bod']) S['lock.bod'].attributes.code_format = '^\\d{4}$';
  if (S['person.sebastian']) S['person.sebastian'].attributes.user_id = 'u1';
  if (E['lock.inngangsdor']) E['lock.inngangsdor'].device_id = 'dev_lock_inngang';
});
(function () {
  const orig = window.mockHass;
  window.mockHass = function () {
    const h = orig();
    const ws = h.callWS;
    h.callWS = (m) => {
      if (m.type === 'logbook/get_events' && Array.isArray(m.entity_ids) && m.entity_ids.every((id) => id.startsWith('lock.'))) {
        const t = Date.now() / 1000;
        window.__calls.push(['ws', m.type, m]);
        return Promise.resolve([
          { entity_id: 'lock.inngangsdor', state: 'locked', when: t - 1200, context_user_id: 'u1' },
          { entity_id: 'lock.inngangsdor', state: 'unlocked', when: t - 5400, context_user_id: 'u1' },
          { entity_id: 'lock.inngangsdor', state: 'locked', when: t - 86400 - 3600, context_entity_id: 'automation.las_dora_om_natten' },
          { entity_id: 'lock.bod', state: 'unlocked', when: t - 7200 },
        ]);
      }
      return ws(m);
    };
    return h;
  };
})();
