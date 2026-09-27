// Register-WS (config/*_registry/list) og frontend user data for strategi-/store-testene.
(function () {
  const base = window.mockHass;
  window.__userData = window.__userData || {};
  window.mockHass = function () {
    const h = base();
    const ws = h.callWS;
    h.callWS = (m) => {
      if (m.type === 'config/area_registry/list') return Promise.resolve(Object.values(h.areas));
      if (m.type === 'config/floor_registry/list') return Promise.resolve(Object.values(h.floors));
      if (m.type === 'config/device_registry/list') return Promise.resolve(Object.values(h.devices || {}).map((d, i) => ({ id: d.id || Object.keys(h.devices)[i], ...d })));
      if (m.type === 'config/entity_registry/list') return Promise.resolve(Object.values(h.entities).map((e) => ({ ...e, hidden_by: e.hidden ? 'user' : null, disabled_by: null })));
      if (m.type === 'frontend/get_user_data') { (window.__calls || []).push(['ws', m.type]); return Promise.resolve({ value: window.__userData[m.key] || null }); }
      if (m.type === 'frontend/set_user_data') { (window.__calls || []).push(['ws', m.type, m.value]); window.__userData[m.key] = JSON.parse(JSON.stringify(m.value)); return Promise.resolve(null); }
      return ws(m);
    };
    return h;
  };
})();
