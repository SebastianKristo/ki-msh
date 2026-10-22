// Fiks 65 · mock for HA-innstillingene (automasjoner, scener, skript, kategorier, etiketter, oppdateringer, backup, logger …).
// Lastes etter test/mock/*.js i test/ha65-check.mjs. Alt lagres i minnet (window.__haMock) så testen kan se hva som ble sendt.
(function () {
  const base = window.mockHass;
  const now = Date.now();
  const iso = (ms) => new Date(now - ms).toISOString();
  const M = (window.__haMock = {
    cats: { automation: [{ category_id: 'c_lys', name: 'Lys', icon: 'mdi:lightbulb' }, { category_id: 'c_sik', name: 'Sikkerhet', icon: 'mdi:shield' }], scene: [{ category_id: 'c_kveld', name: 'Kveld', icon: 'mdi:weather-night' }], script: [] },
    labels: [{ label_id: 'viktig', name: 'Viktig', color: 'red', icon: null }, { label_id: 'ferie', name: 'Ferie', color: 'teal', icon: 'mdi:palm-tree' }],
    reg: {},
    cfg: {
      automation: {
        '1001': { id: '1001', alias: 'Lys på ved solnedgang', description: 'Slår på stuelyset', mode: 'single', triggers: [{ trigger: 'sun', event: 'sunset', offset: '-00:15:00' }], conditions: [{ condition: 'state', entity_id: 'person.sebastian', state: 'home' }], actions: [{ action: 'light.turn_on', target: { entity_id: ['light.stue_tak'] }, data: { brightness_pct: 70 } }, { delay: '00:05:00' }, { if: [{ condition: 'time', after: '22:00:00' }], then: [{ action: 'light.turn_off', target: { area_id: 'stue' } }] }] },
        '1002': { id: '1002', alias: 'Alarm ved dør', mode: 'restart', trigger: [{ platform: 'state', entity_id: 'binary_sensor.gang_dor', to: 'on', id: 'dor' }], condition: [], action: [{ service: 'notify.notify', data: { title: 'Dør', message: 'Døra ble åpnet' } }, { choose: [{ conditions: [{ condition: 'trigger', id: 'dor' }], sequence: [{ action: 'light.turn_on', target: { entity_id: 'light.gang' } }] }] }] },
      },
      script: { god_natt: { alias: 'God natt', icon: 'mdi:weather-night', mode: 'single', sequence: [{ action: 'light.turn_off', target: { entity_id: 'all' } }, { repeat: { count: 2, sequence: [{ delay: 1 }] } }] } },
      scene: { '2001': { id: '2001', name: 'Filmkveld', icon: 'mdi:movie', entities: { 'light.stue_tak': { state: 'on', brightness: 60 }, 'light.stue_led': { state: 'on', brightness: 120, rgb_color: [255, 100, 60] } } } },
    },
    posted: [], ws: [],
  });
  window.mockExtend(({ add, E }) => {
    add('automation.lys_pa_ved_solnedgang', 'on', { id: '1001', friendly_name: 'Lys på ved solnedgang', last_triggered: iso(3600e3 * 5), mode: 'single' });
    add('automation.alarm_ved_dor', 'off', { id: '1002', friendly_name: 'Alarm ved dør', last_triggered: null, mode: 'restart' });
    add('automation.yaml_automasjon', 'on', { friendly_name: 'Gammel YAML-automasjon', last_triggered: iso(86400e3 * 2) });
    add('script.god_natt', 'off', { friendly_name: 'God natt', icon: 'mdi:weather-night', last_triggered: iso(86400e3) });
    add('scene.filmkveld', iso(7200e3), { id: '2001', friendly_name: 'Filmkveld', icon: 'mdi:movie' });
    add('update.home_assistant_core_update', 'on', { title: 'Home Assistant Core', installed_version: '2025.9.4', latest_version: '2025.10.1', supported_features: 1 | 4 | 8 | 16, release_url: 'https://www.home-assistant.io/blog/', entity_picture: null, in_progress: false, friendly_name: 'Home Assistant Core Update' });
    add('update.mosquitto_update', 'on', { title: 'Mosquitto broker', installed_version: '6.4.0', latest_version: '6.5.1', supported_features: 1 | 8 | 16, release_summary: 'Ny versjon av **Mosquitto**', in_progress: false, friendly_name: 'Mosquitto Update' });
    add('update.hacs_update', 'off', { title: 'HACS', installed_version: '2.0.1', latest_version: '2.0.1', supported_features: 1, friendly_name: 'HACS Update' });
    add('person.sebastian', 'home', { friendly_name: 'Sebastian' });
    add('binary_sensor.gang_dor', 'off', { device_class: 'door', friendly_name: 'Gang dør' }, { area: 'gang' });
    E['automation.lys_pa_ved_solnedgang'].categories = { automation: 'c_lys' };
    E['automation.lys_pa_ved_solnedgang'].labels = ['viktig'];
    E['automation.alarm_ved_dor'].categories = { automation: 'c_sik' };
    E['automation.alarm_ved_dor'].labels = ['viktig', 'ferie'];
    E['scene.filmkveld'].categories = { scene: 'c_kveld' };
    M.E = E;
  });
  window.mockHass = function () {
    const h = base();
    const ws = h.callWS;
    h.config = { version: '2025.10.1', location_name: 'Hjemme', time_zone: 'Europe/Oslo', currency: 'NOK', country: 'NO', language: 'nb', latitude: 59.91, longitude: 10.75, elevation: 20, radius: 100, unit_system: { length: 'km', temperature: '°C' }, components: ['hassio', 'automation', 'script', 'scene', 'light', 'backup', 'hacs'], internal_url: null, external_url: null, config_dir: '/config' };
    h.services = {
      light: { turn_on: { name: 'Turn on', description: 'Slår på lys', fields: { brightness_pct: { selector: { number: { min: 0, max: 100, unit_of_measurement: '%' } }, example: 50 }, color_temp_kelvin: { selector: { color_temp: { min: 2000, max: 6500 } } }, transition: { selector: { number: { min: 0, max: 300 } } }, flash: { selector: { select: { options: ['short', 'long'] } } } }, target: { entity: [{ domain: ['light'] }] } }, turn_off: { fields: { transition: { selector: { number: { min: 0, max: 300 } } } }, target: { entity: [{ domain: ['light'] }] } }, toggle: { fields: {} } },
      notify: { notify: { fields: { message: { selector: { text: {} } }, title: { selector: { text: {} } }, data: { selector: { object: {} } } } } },
      scene: { turn_on: { fields: {}, target: { entity: [{ domain: ['scene'] }] } }, apply: { fields: {} } },
      script: { turn_on: { fields: {} }, reload: {} }, automation: { trigger: {}, turn_on: {}, turn_off: {}, reload: {} },
      homeassistant: { restart: {}, reload_all: {}, reload_core_config: {}, update_entity: {} }, update: { install: {}, skip: {}, clear_skipped: {} }, hassio: { host_reboot: {}, host_shutdown: {} }, group: { reload: {} }, input_boolean: { reload: {} }, system_log: { clear: {} },
    };
    h.callApi = (method, path, body) => {
      M.posted.push([method, path, body]);
      const m = /^config\/(automation|script|scene)\/config\/(.+)$/.exec(path);
      if (m) {
        const [, k, id] = m;
        if (method === 'GET') return M.cfg[k][id] ? Promise.resolve(JSON.parse(JSON.stringify(M.cfg[k][id]))) : Promise.reject({ body: { message: 'Resource not found' } });
        if (method === 'POST') { M.cfg[k][id] = body; return Promise.resolve({ result: 'ok' }); }
        if (method === 'DELETE') { delete M.cfg[k][id]; return Promise.resolve({ result: 'ok' }); }
      }
      if (path === 'config/core/check_config') return Promise.resolve({ result: 'valid', errors: null, warnings: null });
      return Promise.reject(new Error('mock: ' + path));
    };
    h.callWS = (m) => {
      M.ws.push(m);
      const t = m.type, R = (v) => Promise.resolve(JSON.parse(JSON.stringify(v)));
      if (t === 'config/entity_registry/list') return R(Object.values(M.E).map((e) => ({ ...e, categories: e.categories || {}, labels: e.labels || [] })));
      if (t === 'config/entity_registry/update') { const e = M.E[m.entity_id]; if (m.categories) e.categories = { ...(e.categories || {}), ...m.categories }; if (m.labels) e.labels = m.labels; if ('area_id' in m) e.area_id = m.area_id; return R({ entity_entry: e }); }
      if (t === 'config/category_registry/list') return R(M.cats[m.scope] || []);
      if (t === 'config/category_registry/create') { const c = { category_id: 'c_' + Math.random().toString(36).slice(2, 7), name: m.name, icon: m.icon }; M.cats[m.scope].push(c); return R(c); }
      if (t === 'config/category_registry/update') { const c = M.cats[m.scope].find((x) => x.category_id === m.category_id); Object.assign(c, { name: m.name, icon: m.icon }); return R(c); }
      if (t === 'config/category_registry/delete') { M.cats[m.scope] = M.cats[m.scope].filter((x) => x.category_id !== m.category_id); return R(null); }
      if (t === 'config/label_registry/list') return R(M.labels);
      if (t === 'config/label_registry/create') { const l = { label_id: m.name.toLowerCase().replace(/\W+/g, '_'), name: m.name, color: m.color, icon: m.icon, description: m.description }; M.labels.push(l); return R(l); }
      if (t === 'config/label_registry/update') { const l = M.labels.find((x) => x.label_id === m.label_id); Object.assign(l, m); return R(l); }
      if (t === 'config/label_registry/delete') { M.labels = M.labels.filter((x) => x.label_id !== m.label_id); return R(null); }
      if (t === 'repairs/list_issues') return R({ issues: [{ domain: 'hassio', issue_id: 'unhealthy', severity: 'error', translation_key: 'unhealthy', translation_placeholders: { reason: 'docker' }, is_fixable: true, ignored: false, learn_more_url: 'https://www.home-assistant.io/' }, { domain: 'mqtt', issue_id: 'deprecated_yaml', severity: 'warning', translation_key: 'deprecated_yaml', is_fixable: false, ignored: true }] });
      if (t === 'frontend/get_translations') return R({ resources: m.category === 'issues' ? { 'component.hassio.issues.unhealthy.title': 'Systemet er usunt ({reason})', 'component.hassio.issues.unhealthy.description': 'Supervisor har oppdaget et problem med **{reason}**.\n\n- Sjekk loggen\n- Start på nytt' } : { 'component.light.services.turn_on.fields.brightness_pct.name': 'Lysstyrke', 'component.light.services.turn_on.name': 'Slå på' } });
      if (t === 'backup/info') return R({ backups: [{ backup_id: 'b1', name: 'Automatisk backup 2025.10', date: iso(86400e3), with_automatic_settings: true, database_included: true, homeassistant_version: '2025.9.4', addons: [{ name: 'Mosquitto broker', slug: 'core_mosquitto', version: '6.4.0' }], folders: ['share'], agents: { 'hassio.local': { size: 734003200, protected: true } } }, { backup_id: 'b2', name: 'Før oppgradering', date: iso(86400e3 * 9), with_automatic_settings: false, database_included: false, homeassistant_version: '2025.8.1', addons: [], folders: [], agents: { 'hassio.local': { size: 52428800, protected: false }, 'cloud.cloud': { size: 52428800, protected: false } } }], last_completed_automatic_backup: iso(86400e3), next_automatic_backup: new Date(now + 3600e3 * 7).toISOString(), agent_errors: {} });
      if (t === 'backup/details') return h.callWS({ type: 'backup/info' }).then((r) => ({ backup: r.backups.find((b) => b.backup_id === m.backup_id) }));
      if (t === 'backup/config/info') return R({ config: M.bkcfg || (M.bkcfg = { schedule: { recurrence: 'daily', days: [], time: '04:45:00' }, retention: { copies: 3, days: null }, create_backup: { agent_ids: ['hassio.local'], include_database: true, include_all_addons: true, include_folders: ['share'], include_addons: [] }, automatic_backups_configured: true, last_completed_automatic_backup: iso(86400e3), next_automatic_backup: new Date(now + 3600e3 * 7).toISOString() }) });
      if (t === 'backup/config/update') { const c = M.bkcfg; Object.keys(m).filter((k) => k !== 'type').forEach((k) => { c[k] = { ...c[k], ...m[k] }; }); return R(null); }
      if (t === 'backup/agents/info') return R({ agents: [{ agent_id: 'hassio.local', name: 'Denne enheten' }, { agent_id: 'cloud.cloud', name: 'Home Assistant Cloud' }] });
      if (t === 'backup/generate_with_automatic_settings' || t === 'backup/generate') return R({ backup_job_id: 'job1' });
      if (t === 'trace/list') return R([{ run_id: 'r1', state: 'stopped', script_execution: 'finished', timestamp: { start: iso(3600e3 * 5), finish: iso(3600e3 * 5 - 1200) }, trigger: 'solnedgang', last_step: 'action/2' }, { run_id: 'r2', state: 'stopped', script_execution: 'failed_conditions', timestamp: { start: iso(86400e3), finish: iso(86400e3 - 30) }, trigger: 'solnedgang', last_step: 'condition/0' }]);
      if (t === 'trace/get') return R({ run_id: m.run_id, script_execution: 'finished', trigger: 'solnedgang', timestamp: { start: iso(3600e3 * 5), finish: iso(3600e3 * 5 - 1200) }, config: M.cfg.automation['1001'], context: {}, trace: { 'trigger/0': [{ path: 'trigger/0', timestamp: iso(3600e3 * 5) }], 'condition/0': [{ path: 'condition/0', timestamp: iso(3600e3 * 5 - 10), result: { result: true } }], 'action/0': [{ path: 'action/0', timestamp: iso(3600e3 * 5 - 20), result: {} }], 'action/1': [{ path: 'action/1', timestamp: iso(3600e3 * 5 - 30), result: { delay: 300 } }], 'action/2': [{ path: 'action/2', timestamp: iso(3600e3 * 5 - 330), result: { choice: 'else' } }] } });
      if (t === 'system_log/list') return R([{ name: 'homeassistant.components.mqtt', message: ['Kunne ikke koble til broker 192.168.1.5'], level: 'ERROR', source: ['components/mqtt/client.py', 512], timestamp: now / 1000 - 600, exception: 'Traceback …\nConnectionRefusedError', count: 4, first_occurred: now / 1000 - 7200 }, { name: 'custom_components.hacs', message: ['Rate limit'], level: 'WARNING', source: ['hacs/base.py', 33], timestamp: now / 1000 - 3600, exception: '', count: 1, first_occurred: now / 1000 - 3600 }]);
      if (t === 'test_condition') return R({ result: true });
      if (t === 'execute_script') return R({ context: {}, response: null });
      if (t === 'update/release_notes') return R('## Nytt i 2025.10\n- Raskere oppstart\n- **Ny** automasjonseditor');
      if (t === 'supervisor/api') return R({ '/supervisor/info': { version: '2025.10.0' }, '/os/info': { version: '16.2', board: 'green' }, '/host/info': { operating_system: 'Home Assistant OS 16.2', disk_total: 116.4, disk_used: 23.8 }, '/core/info': { machine: 'green' } }[m.endpoint] || {});
      if (t === 'auth/sign_path') return R({ path: m.path + (m.path.includes('?') ? '&' : '?') + 'authSig=x' });
      if (t === 'config/core/update') { Object.assign(h.config, m); return R(null); }
      if (t === 'call_service') return R({});
      return ws(m);
    };
    h.connection.subscribeMessage = ((sub) => (cb, msg) => (msg.type === 'backup/subscribe_events' ? Promise.resolve(() => {}) : sub(cb, msg)))(h.connection.subscribeMessage);
    return h;
  };
})();
