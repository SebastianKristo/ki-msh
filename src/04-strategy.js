/* KI MSH · dashbord-strategi «custom:ki-dashboard» (og view-strategi «custom:ki-home»).
 * Dashbordets YAML blir bare:
 *   strategy:
 *     type: custom:ki-dashboard
 *     # valgfritt: exclude_areas: [bod], areas: { bod: false }, popups: { kamera: false },
 *     #            popup_overrides: { '#stue': { name: Stua, icon: mdi:sofa, color: 'var(--red)' } }, home: {…}, navbar: {…}
 * Resultat: én panel-visning med én vertical-stack: msh-hjem-card, msh-navbar-card og alle Bubble-popups
 * (mal B per HA-område med synlige entiteter, mal A per funksjon det finnes entiteter for, per person, #settings).
 * Brukerens valg fra dashbord-editorene (ki-store / frontend user data) leses ved hver generering.
 */
(function () {
  const M = window.MSH;
  if (!M || customElements.get('ll-strategy-dashboard-ki-dashboard')) return;

  async function registries(hass) {
    const ws = (type) => hass.callWS({ type }).catch(() => null);
    const [areas, floors, devices, entities] = await Promise.all([ws('config/area_registry/list'), ws('config/floor_registry/list'), ws('config/device_registry/list'), ws('config/entity_registry/list')]);
    const arr = (x, fb) => (Array.isArray(x) ? x : Object.values(fb || {}));
    return { areas: arr(areas, hass.areas), floors: arr(floors, hass.floors), devices: arr(devices, hass.devices), entities: arr(entities, hass.entities) };
  }
  // Synlige entiteter per område – samme regler som KI Rom (skjulte/deaktiverte, config/diagnostic og grupper hoppes over)
  function entitiesByArea(R, hass) {
    const dev = {}; R.devices.forEach((d) => { dev[d.id] = d; });
    const out = {};
    R.entities.forEach((e) => {
      const id = e.entity_id, st = hass.states[id];
      if (!st || e.hidden_by || e.hidden || e.disabled_by || e.entity_category) return;
      if (Array.isArray(st.attributes.entity_id) && !id.startsWith('media_player.')) return;
      const area = e.area_id || (e.device_id && dev[e.device_id] && dev[e.device_id].area_id);
      if (!area) return;
      (out[area] = out[area] || []).push(id);
    });
    return out;
  }
  // Popup-valg fra «Tilpass Hjem» → Popups: nøkkel = hash uten # (eldre: med #)
  const popOf = (user, hash) => { const P = (user && user.popups) || {}; return P[String(hash).replace(/^#/, '')] || P[hash] || null; };
  const plainVar = (col) => { const m = /^var\((--[\w-]+)\s*,[^)]*\)$/.exec(String(col || '').trim()); return m ? `var(${m[1]})` : col; };

  // Rom (sortert etter etasje, deltil navn)
  function buildRooms(R, hass, config, user) {
    const byArea = entitiesByArea(R, hass);
    const lvl = {}; R.floors.forEach((f) => { lvl[f.floor_id] = f.level != null ? f.level : 99; });
    const ex = new Set([...(config.exclude_areas || []), ...Object.keys(config.areas || {}).filter((k) => config.areas[k] === false)]);
    return R.areas
      .filter((a) => !ex.has(a.area_id) && !(popOf(user, a.area_id) || {}).hidden)
      .filter((a) => (byArea[a.area_id] || []).length > 0 || (M.kiRom(hass, a.area_id, 'oversikt') && Number(M.kiRom(hass, a.area_id, 'oversikt').state) > 0))
      .sort((a, b) => (lvl[a.floor_id] ?? 99) - (lvl[b.floor_id] ?? 99) || a.name.localeCompare(b.name, 'nb'))
      .map((a) => ({ id: a.area_id, name: a.name, icon: a.icon }));
  }
  // Funksjons-popups: bare når det finnes entiteter for dem (entiteter.md)
  function buildFunctionPopups(R, hass, config, user) {
    const has = (dom, f) => M.all(hass, dom, f).length > 0;
    const plat = (...p) => R.entities.some((e) => p.includes(e.platform) && hass.states[e.entity_id]);
    const rx = (re, doms) => Object.keys(hass.states).some((id) => (!doms || doms.includes(id.split('.')[0])) && (re.test(id) || re.test(String(hass.states[id].attributes.friendly_name || '').toLowerCase())));
    const cond = {
      '#media': () => has('media_player'),
      '#klima': () => has(['climate', 'fan']),
      '#kamera': () => has('camera'),
      '#sikkerhet': () => has(['alarm_control_panel', 'lock']),
      '#basseng': () => !!M.findArea(hass, 'basseng', 'pool') || rx(/basseng|pool/, ['sensor', 'switch', 'climate', 'water_heater']),
      '#ruter': () => plat('entur', 'entur_public_transport', 'entur_sx'),
      '#vanning': () => has('valve') || plat('opensprinkler') || rx(/vanning|sprinkler|drypp|irrigation/, ['switch', 'valve', 'input_boolean']),
      '#vaer': () => has('weather'),
      '#lys': () => has('light'),
      '#gjoremal': () => has('todo'),
    };
    const hide = (config.popups || {});
    const out = [];
    M.FUNCTION_POPUPS.forEach(([hash, name, icon, tag]) => {
      const key = hash.slice(1);
      if (hide[key] === false || (popOf(user, hash) || {}).hidden) return;
      if (cond[hash] && !cond[hash]()) return;
      out.push({ hash, name, icon, tag });
    });
    M.all(hass, 'person').forEach((pid) => {
      const hash = '#person-' + pid.split('.')[1];
      if (hide['person-' + pid.split('.')[1]] === false || (popOf(user, hash) || {}).hidden) return;
      out.push({ hash, name: M.name(hass, pid), icon: 'mdi:account', tag: 'msh-person-card', extra: { person: pid }, person: true });
    });
    if (hide.settings !== false && !(popOf(user, '#settings') || {}).hidden) out.push({ hash: '#settings', name: 'Innstillinger', icon: 'mdi:cog', tag: 'msh-settings-card', tap: { action: 'navigate', navigation_path: '/config' } });
    return out;
  }
  function roomLook(area, hass, user) {
    const S = (user && user.cards) || {}, PO = popOf(user, area) || {};
    const rc = { ...(S[M.CARD_IDS.room(area)] || {}), ...((user && user.rooms && user.rooms[area]) || {}) }, fc = (S[M.CARD_IDS.faner] || {}).rooms || {};
    const col = PO.color || (rc.look && rc.look.col) || (fc[area] && fc[area].color) || (M.romColor ? M.romColor(area, hass) : 'var(--orange)');
    const icon = PO.icon || (rc.look && rc.look.icon) || (fc[area] && fc[area].icon) || null;
    return { col, icon };
  }

  // «Tilpass rom»-verdiene (ki-store rooms.<area>) tas med i kortets config, så GUI-editoren viser dem
  const roomCfg = (area) => { const r = (M.store && M.store.eff('rooms.' + area)) || {}; const o = {}; Object.keys(r).forEach((k) => { if (r[k] !== null && k !== 'type' && k !== 'card_id' && k !== 'area') o[k] = r[k]; }); return o; };
  M.generateDashboardView = async function (config, hass) {
    config = config || {};
    M.FALLBACK = { temperature: config.fallback_temperature || 'sensor.hus_temperature', humidity: config.fallback_humidity || 'sensor.hus_fuktighet' };
    if (M.store) await M.store.load(hass);
    const user = (M.store && (M.store.view ? M.store.view() : M.store.get())) || {};
    const R = await registries(hass);
    const funcs = buildFunctionPopups(R, hass, config, user);
    const fHash = new Set(funcs.map((f) => f.hash));
    const rooms = buildRooms(R, hass, config, user).filter((r) => !fHash.has('#' + r.id)); // samme hash som en funksjon (f.eks. Basseng) → funksjons-popupen vinner
    const ov = (hash) => ({ ...((config.popup_overrides || {})[hash] || {}), ...(popOf(user, hash) || {}) });
    const I = M.CARD_IDS;
    const home = { type: 'custom:msh-hjem-card', card_id: I.home, ...(config.home || {}), cards: {
      header: { type: 'custom:msh-hjem-header-card', card_id: I.header },
      prosa: { type: 'custom:msh-prosa-card', card_id: I.prosa },
      faner: { type: 'custom:msh-hjem-faner-card', card_id: I.faner },
      soppel: { type: 'custom:msh-soppel-card', card_id: I.soppel, popup_hash: '#soppel' },
      strom: { type: 'custom:msh-strompris-card', card_id: I.strom },
      gjoremal: { type: 'custom:msh-hjem-gjoremal-card', card_id: I.gjoremal },
      ...(((config.home || {}).cards) || {}),
    } };
    const fk = funcs.filter((f) => !f.person && f.hash !== '#settings').map((f) => f.hash.slice(1));
    const navbar = { type: 'custom:msh-navbar-card', card_id: I.navbar, bar: fk.slice(0, 5), more: fk.slice(5), ...(config.navbar || {}) };
    const popups = [
      ...rooms.map((r) => {
        const L = roomLook(r.id, hass, user), o = ov('#' + r.id);
        const au = M.roomAuto(hass, r.id);
        return M.popupTemplateB({ name: o.name || r.name, icon: o.icon || L.icon || r.icon || (au.A && au.A.ikon) || 'mdi:home', hash: '#' + r.id, color: plainVar(o.color || L.col), card: { type: 'custom:msh-rom-card', card_id: I.room(r.id), area: r.id, ...roomCfg(r.id) } });
      }),
      ...funcs.map((f) => {
        const o = ov(f.hash);
        const p = M.popupTemplateA({ name: o.name || f.name, icon: o.icon || f.icon, hash: f.hash, card: { type: 'custom:' + f.tag, card_id: 'pop-' + f.hash.slice(1), ...(f.extra || {}) } });
        if (o.color) p.styles = p.styles.replace(/(\.icon-container\s*\{background-color:)[^!]*/, `$1${plainVar(o.color)}`);
        if (f.tap) p.tap_action = f.tap;
        return p;
      }),
    ];
    return { title: 'Hjem', path: 'hjem', icon: 'mdi:home', panel: true, cards: [{ type: 'vertical-stack', cards: [home, navbar, ...popups] }] };
  };

  class KiDashboardStrategy extends HTMLElement {
    static async generate(config, hass) {
      const view = await M.generateDashboardView(config, hass);
      return { title: (config && config.title) || 'Hjem', views: [view] };
    }
    static async getConfigElement() { return document.createElement('ki-dashboard-strategy-editor'); }
    static noEditor = false;
  }
  class KiHomeViewStrategy extends HTMLElement {
    static async generate(config, hass) { return M.generateDashboardView(config, hass); }
    static async getConfigElement() { return document.createElement('ki-dashboard-strategy-editor'); }
  }
  customElements.define('ll-strategy-dashboard-ki-dashboard', KiDashboardStrategy);
  if (!customElements.get('ll-strategy-view-ki-home')) customElements.define('ll-strategy-view-ki-home', KiHomeViewStrategy);

  // Strategiens GUI-editor: globale valg (hvilke rom/popups som tas med, oppsett). Lagres i strategy:-blokken.
  class StrategyEditor extends HTMLElement {
    set hass(h) { this._hass = h; this._render(); }
    setConfig(c) { this._cfg = { ...(c || {}) }; this._render(); }
    _render() {
      if (!this._hass || !this._cfg) return;
      const h = this._hass, c = this._cfg;
      const areaOn = (id) => !(c.exclude_areas || []).includes(id) && !(c.areas && c.areas[id] === false);
      const schema = [
        { type: 'info', label: 'Dashbordet bygges automatisk fra HA-områder og entiteter. Valgene fra «Tilpass Hjem/navbar/header/rom» lagres per bruker (synkes mellom enhetene dine).' },
        { type: 'section', id: 'rooms', label: 'Rom-popups', icon: 'mdi:texture-box', open: true, fields: M.areas(h).map((a) => ({ type: 'boolean', name: 'areas.' + a.id, label: a.name, default: true })) },
        { type: 'section', id: 'funcs', label: 'Funksjons-popups', icon: 'mdi:layers-outline', fields: [...M.FUNCTION_POPUPS.map(([hash, name]) => ({ type: 'boolean', name: 'popups.' + hash.slice(1), label: name, default: true })), { type: 'boolean', name: 'popups.settings', label: 'Innstillinger', default: true }] },
        { type: 'section', id: 'home', label: 'Hjem', icon: 'mdi:home', fields: [
          { type: 'select', name: 'home.layout_mode', label: 'Layout', options: [['auto', 'Auto'], ['mobil', 'Mobil'], ['stor', 'Stor skjerm']], default: 'auto' },
          { type: 'select', name: 'navbar.style', label: 'Navbar', options: [['white', 'Standard'], ['glass', 'Liquid Glass']], default: 'white' },
          { type: 'entity', name: 'fallback_temperature', label: 'Temperatur når rommet mangler sensor', domain: 'sensor', device_class: 'temperature', auto: () => 'sensor.hus_temperature' },
          { type: 'entity', name: 'fallback_humidity', label: 'Fukt når rommet mangler sensor', domain: 'sensor', device_class: 'humidity', auto: () => 'sensor.hus_fuktighet' },
        ] },
      ];
      if (!this._ed) {
        this._ed = document.createElement('msh-editor');
        this._ed.addEventListener('config-changed', (e) => {
          e.stopPropagation();
          const { card_id, ...cfg } = e.detail.config;
          if (cfg.areas) { cfg.exclude_areas = Object.keys(cfg.areas).filter((k) => cfg.areas[k] === false); if (!cfg.exclude_areas.length) delete cfg.exclude_areas; delete cfg.areas; }
          this._cfg = cfg;
          this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: cfg }, bubbles: true, composed: true }));
        });
        this.appendChild(this._ed);
      }
      this._ed.cardClass = { schema };
      this._ed.hass = h;
      const view = { ...c, areas: Object.fromEntries(M.areas(h).map((a) => [a.id, areaOn(a.id)])) };
      this._ed.setConfig({ ...view, card_id: 'strategy' });
    }
  }
  if (!customElements.get('ki-dashboard-strategy-editor')) customElements.define('ki-dashboard-strategy-editor', StrategyEditor);
})();
