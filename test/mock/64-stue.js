// Testdata for Stue-dashbordet (msh-stue-card · Fiks 58 B/2b). Endrer ingenting før testen kaller hjelperen:
//   window.mockStue() → cover.stue_markise (device_class awning) og gardinene som gruppe med to deler
//   (cover.stue_gardin_venstre / _hoyre, attributtet entity_id på cover.stue_gardin), alt i området stue.
window.mockExtend(({ add, S }) => {
  window.mockStue = () => {
    add('cover.stue_markise', 'open', { device_class: 'awning', friendly_name: 'Stue markise', current_position: 40, supported_features: 15 }, { area: 'stue' });
    add('cover.stue_gardin_venstre', 'open', { device_class: 'curtain', friendly_name: 'Gardiner venstre', current_position: 100, supported_features: 15 }, { area: 'stue' });
    add('cover.stue_gardin_hoyre', 'open', { device_class: 'curtain', friendly_name: 'Gardiner høyre', current_position: 60, supported_features: 15 }, { area: 'stue' });
    const g = S['cover.stue_gardin'];
    if (g) g.attributes.entity_id = ['cover.stue_gardin_venstre', 'cover.stue_gardin_hoyre'];
  };
});
