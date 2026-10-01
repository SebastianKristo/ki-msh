// Testdata for Dørlås (#dorlas, msh-las-card · Fiks 32.1): lock.inngangsdor (batteri på samme enhet, auto-lås number + switch,
// dørsensor binary_sensor.inngangsdor i samme område), lock.bod (code_format → PIN), automasjoner «Lås døra når alle drar» /
// «Lås døra om natten», logbook-hendelser (i dag / i går – plassert relativt til midnatt, så testene ikke avhenger av klokka)
// og attributter (changed_by/method/code_slot) via history_during_period.
// Hjelpere for testene (endrer ikke de andre testenes data):
//   window.mockLas(n)        → 1, 2 eller 4 låser (4: + lock.terrassedor, lock.kjellerdor)
//   window.mockLasBrytere()  → KI Varslinger og sikkerhet: enhetene Autolås, Fastkjørt lås, Lås når alle drar, Nattlås
window.mockExtend(({ add, S, E, D }) => {
  add('number.inngangsdor_auto_lock_time', 2, { unit_of_measurement: 'min', min: 0, max: 30, step: 1, friendly_name: 'Inngangsdør auto lock tid' }, { device: 'dev_lock_inngang', category: 'config' });
  add('switch.inngangsdor_auto_lock', 'on', { friendly_name: 'Inngangsdør auto lock' }, { device: 'dev_lock_inngang', category: 'config' });
  add('automation.las_dora_nar_alle_drar', 'on', { friendly_name: 'Lås døra når alle drar' });
  add('automation.las_dora_om_natten', 'off', { friendly_name: 'Lås døra om natten' });
  add('automation.autolas_inngang', 'on', { friendly_name: 'Autolås inngang' });
  if (S['lock.bod']) S['lock.bod'].attributes.code_format = '^\\d{4}$';
  if (S['person.sebastian']) S['person.sebastian'].attributes.user_id = 'u1';
  if (S['person.cybele']) S['person.cybele'].attributes.user_id = 'u2';
  if (E['lock.inngangsdor']) E['lock.inngangsdor'].device_id = 'dev_lock_inngang';
  const mid = new Date().setHours(0, 0, 0, 0), now = Date.now(), T = (f) => mid + f * (now - mid), Yd = (h, m) => mid - 86400000 + (h * 60 + m) * 60000;
  window.__lasT = { T, Yd, mid };
  const iso = (t) => new Date(t).toISOString();
  if (S['lock.inngangsdor']) { S['lock.inngangsdor'].last_changed = iso(T(0.95)); S['lock.inngangsdor'].last_updated = iso(T(0.95)); }
  if (S['lock.bod']) { S['lock.bod'].last_changed = iso(T(0.8)); S['lock.bod'].last_updated = iso(T(0.8)); }
  if (S['binary_sensor.inngangsdor']) { S['binary_sensor.inngangsdor'].last_changed = iso(T(0.91)); }
  window.mockLas = (n) => {
    if (n >= 4) {
      add('lock.terrassedor', 'locked', { friendly_name: 'Terrassedør', battery_level: 92 }, { area: 'stue' });
      add('lock.kjellerdor', 'locked', { friendly_name: 'Kjellerdør', battery_level: 18 });
    } else { delete S['lock.terrassedor']; delete S['lock.kjellerdor']; delete E['lock.terrassedor']; delete E['lock.kjellerdor']; }
    if (n <= 1) { if (S['lock.bod']) window.__bod = S['lock.bod']; delete S['lock.bod']; } else if (!S['lock.bod'] && window.__bod) S['lock.bod'] = window.__bod;
  };
  window.mockLasBrytere = () => {
    const sw = (dev, name, id, state) => { D[dev] = { id: dev, name, area_id: null }; add(id, state, { friendly_name: name }, { platform: 'ki_notifications', device: dev }); };
    sw('dev_kv_autolas', 'Autolås', 'switch.autolas_aktivert', 'on');
    sw('dev_kv_fastkjort', 'Fastkjørt lås', 'switch.dorlas_fastkjort', 'on');
    sw('dev_kv_alledrar', 'Lås når alle drar', 'switch.las_nar_alle_drar', 'on');
    sw('dev_kv_nattlas', 'Nattlås', 'switch.nattlas', 'off');
  };
});
(function () {
  const orig = window.mockHass;
  window.mockHass = function () {
    const h = orig();
    const ws = h.callWS;
    h.callWS = (m) => {
      const ids = Array.isArray(m.entity_ids) ? m.entity_ids : [];
      if (ids.length && ids.some((id) => id.startsWith('lock.')) && ids.every((id) => id.startsWith('lock.') || id === 'binary_sensor.inngangsdor')) {
        const { T, Yd } = window.__lasT, s = (t) => t / 1000;
        if (m.type === 'logbook/get_events') {
          window.__calls.push(['ws', m.type, m]);
          return Promise.resolve([
            { entity_id: 'lock.inngangsdor', state: 'locked', when: s(T(0.95)), context_entity_id: 'automation.autolas_inngang', context_entity_id_name: 'Autolås inngang' },
            { entity_id: 'binary_sensor.inngangsdor', state: 'on', when: s(T(0.9)) },
            { entity_id: 'binary_sensor.inngangsdor', state: 'off', when: s(T(0.91)) },
            { entity_id: 'lock.inngangsdor', state: 'unlocked', when: s(T(0.85)), context_user_id: 'u1' },
            { entity_id: 'lock.bod', state: 'unlocked', when: s(T(0.8)), context_user_id: 'u1' },
            { entity_id: 'lock.inngangsdor', state: 'unlocked', when: s(T(0.6)) },
            { entity_id: 'lock.inngangsdor', state: 'locked', when: s(T(0.3)), context_entity_id: 'automation.las_dora_nar_alle_drar', context_entity_id_name: 'Lås døra når alle drar' },
            { entity_id: 'lock.inngangsdor', state: 'jammed', when: s(Yd(23, 1)), context_entity_id: 'automation.las_dora_om_natten', context_entity_id_name: 'Lås døra om natten' },
            { entity_id: 'lock.inngangsdor', state: 'locked', when: s(Yd(23, 0)), context_entity_id: 'automation.las_dora_om_natten', context_entity_id_name: 'Lås døra om natten' },
            { entity_id: 'lock.inngangsdor', state: 'unlocked', when: s(Yd(17, 45)), context_user_id: 'u2' },
            { entity_id: 'lock.bod', state: 'locked', when: s(Yd(7, 58)), context_user_id: 'u2' },
          ].filter((e) => ids.includes(e.entity_id)));
        }
        if (m.type === 'history/history_during_period' && m.no_attributes === false) {
          window.__calls.push(['ws', m.type, m]);
          const r = {};
          ids.forEach((id) => { r[id] = []; });
          if (r['lock.inngangsdor']) r['lock.inngangsdor'] = [{ s: 'unlocked', a: { friendly_name: 'Inngangsdør', changed_by: 'Sebastian', method: 'keypad', code_slot: 1 }, lu: s(T(0.85)) }];
          return Promise.resolve(r);
        }
      }
      return ws(m);
    };
    return h;
  };
})();
