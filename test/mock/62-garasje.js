// Testdata for Garasje (#garasje, msh-garasje-card · Fiks 32.2): cover.garasjeport (24-hjem-mocken) får current_position og
// stopp/posisjon, logbook-hendelser i dag / i går (relativt til midnatt – uavhengig av klokka; i går 17:31–22:05 gir
// «Åpen etter 22:00»), automasjonene bak metodene (Autolukk, Alle dro, Tesla).
// Hjelpere for testene (endrer ikke de andre testenes data):
//   window.mockGarasje({ light, motion, two, brytere })  → light.garasje / binary_sensor.garasje_bevegelse i garasjen,
//     cover.garasjeport_2 (andre port), KI Varslinger-bryterne Autolukk (+ number for minutter), Lukk når alle drar,
//     Tesla ankomst, Åpen etter 22:00.
window.mockExtend(({ add, S, D }) => {
  const mid = new Date().setHours(0, 0, 0, 0), now = Date.now(), T = (f) => mid + f * (now - mid), Yd = (h, m) => mid - 86400000 + (h * 60 + m) * 60000;
  window.__garT = { T, Yd };
  const g = S['cover.garasjeport'];
  if (g) { g.attributes.current_position = 0; g.attributes.supported_features = 15; g.last_changed = new Date(T(0.75)).toISOString(); g.last_updated = g.last_changed; }
  add('automation.garasje_autolukk', 'on', { friendly_name: 'Garasje autolukk' });
  add('automation.garasje_lukk_nar_alle_drar', 'on', { friendly_name: 'Garasje lukk når alle drar' });
  add('automation.garasje_tesla_ankomst', 'on', { friendly_name: 'Garasje åpne når Tesla kommer' });
  window.mockGarasje = (o = {}) => {
    if (o.light) add('light.garasje', o.light === true ? 'off' : o.light, { friendly_name: 'Garasje tak', supported_color_modes: ['onoff'] }, { area: 'garasje' });
    if (o.motion) add('binary_sensor.garasje_bevegelse', o.motion === true ? 'off' : o.motion, { device_class: 'motion', friendly_name: 'Garasje bevegelse' }, { area: 'garasje' });
    if (o.two) add('cover.garasjeport_2', 'open', { device_class: 'garage', friendly_name: 'Port 2', current_position: 100, supported_features: 15 }, { area: 'garasje' });
    if (o.brytere) {
      const sw = (dev, name, id, state) => { D[dev] = { id: dev, name, area_id: null }; add(id, state, { friendly_name: name }, { platform: 'ki_notifications', device: dev }); };
      sw('dev_kv_autolukk', 'Autolukk', 'switch.garasje_autolukk', 'on');
      add('number.garasje_autolukk_tid', 10, { unit_of_measurement: 'min', min: 1, max: 60, step: 1, friendly_name: 'Autolukk tid' }, { platform: 'ki_notifications', device: 'dev_kv_autolukk' });
      sw('dev_kv_garasje_alle', 'Garasje lukk når alle drar', 'switch.garasje_lukk_alle_drar', 'on');
      sw('dev_kv_garasje_tesla', 'Garasje Tesla ankomst', 'switch.garasje_tesla_ankomst', 'on');
      sw('dev_kv_garasje_22', 'Garasje åpen etter 22', 'switch.garasje_apen_etter_22', 'off');
    }
  };
});
(function () {
  const orig = window.mockHass;
  window.mockHass = function () {
    const h = orig();
    const ws = h.callWS;
    h.callWS = (m) => {
      const ids = Array.isArray(m.entity_ids) ? m.entity_ids : [];
      if (m.type === 'logbook/get_events' && ids.length && ids.every((id) => id.startsWith('cover.garasjeport'))) {
        window.__calls.push(['ws', m.type, m]);
        const { T, Yd } = window.__garT, s = (t) => t / 1000;
        return Promise.resolve([
          { entity_id: 'cover.garasjeport', state: 'closed', when: s(T(0.75)) },
          { entity_id: 'cover.garasjeport', state: 'open', when: s(T(0.7)), context_entity_id: 'automation.garasje_tesla_ankomst', context_entity_id_name: 'Garasje åpne når Tesla kommer' },
          { entity_id: 'cover.garasjeport', state: 'opening', when: s(T(0.69)), context_entity_id: 'automation.garasje_tesla_ankomst' },
          { entity_id: 'cover.garasjeport', state: 'closed', when: s(T(0.25)), context_entity_id: 'automation.garasje_lukk_nar_alle_drar', context_entity_id_name: 'Garasje lukk når alle drar' },
          { entity_id: 'cover.garasjeport', state: 'open', when: s(T(0.2)), context_user_id: 'u1' },
          { entity_id: 'cover.garasjeport', state: 'closed', when: s(Yd(22, 5)), context_entity_id: 'automation.garasje_autolukk', context_entity_id_name: 'Garasje autolukk' },
          { entity_id: 'cover.garasjeport', state: 'open', when: s(Yd(17, 31)) },
          { entity_id: 'cover.garasjeport_2', state: 'open', when: s(T(0.5)), context_user_id: 'u1' },
        ].filter((e) => ids.includes(e.entity_id)));
      }
      return ws(m);
    };
    return h;
  };
})();
