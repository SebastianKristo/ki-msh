// Testdata for msh-gjoremal-card: liste med beskrivelse-støtte (supported_features 127) og elementer per liste.
window.mockExtend(({ add }) => {
  add('todo.prosjekter', 3, { friendly_name: 'Prosjekter', supported_features: 127 });
});
(function () {
  const ITEMS = {
    'todo.prosjekter': [
      { uid: 'p1', summary: 'Legg til expand under menyer for servere og panelovner', status: 'needs_action', description: '[m] Sebastian' },
      { uid: 'p2', summary: 'VVB må ordnes, står bare på i 50 min', status: 'needs_action', description: '[h] Rune', due: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10) },
      { uid: 'p3', summary: 'Legg til innstillinger for autolås', status: 'needs_action', description: '[l]' },
      { uid: 'p4', summary: 'Bytt filter i ventilasjon', status: 'completed', description: '[m] Cybele' },
    ],
  };
  const orig = window.mockHass;
  window.mockHass = function () {
    const h = orig();
    const sub = h.connection.subscribeMessage;
    h.connection = { ...h.connection, subscribeMessage: (cb, m) => {
      if (m.type === 'todo/item/subscribe' && ITEMS[m.entity_id]) { setTimeout(() => cb({ items: ITEMS[m.entity_id] }), 10); return Promise.resolve(() => {}); }
      return sub(cb, m);
    } };
    return h;
  };
})();
