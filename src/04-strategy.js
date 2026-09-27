/* KI MSH · dashbord-strategi «custom:ki-dashboard» (og view-strategi «custom:ki-home»).
 * Dashbordets YAML blir bare:
 *   strategy:
 *     type: custom:ki-dashboard
 *     # valgfritt: exclude_areas: [bod], areas: { bod: false }, popups: { kamera: false }, home: {…}, navbar: {…}
 *     custom_popups:                     # egne Bubble Card-popups – passeres UENDRET (alle opsjoner, vilkårlige kort i cards:)
 *       - { type: custom:bubble-card, card_type: pop-up, hash: '#garasje', name: Garasje, cards: [ … ] }
 *     popup_overrides:
 *       '#vaer': { name: Været, width_desktop: 600px }       # deep-merge inn i generert popup (lister erstattes, color = ikonfarge)
 *       '#media': { replace: true, config: { … } }          # erstatt hele popupen
 *       '#basseng': false                                    # skjul popupen
 * Resultat: én panel-visning med én vertical-stack: msh-hjem-card, msh-navbar-card og alle Bubble-popups
 * (mal B per HA-område med synlige entiteter, mal A per funksjon det finnes entiteter for, per person, #settings).
 * Brukerens valg fra dashbord-editorene (ki-store / frontend user data) leses ved hver generering.
 *
 * Egne popups · tre kilder slås sammen (MSH.mergePopups), én hash én gang:
 *   1) autogenererte  2) strategi-YAML (custom_popups)  3) ki-store custom_popups (laget i «Tilpass Hjem» → Popups)
 *   Grunnlag ved lik hash: strategi-YAML → ki-store → auto (første forekomst vinner innen samme liste).
 *   Deretter popup_overrides: ki-store popup_overrides, så strategi-YAML popup_overrides (høyest prioritet).
 *   Kollisjoner og ugyldige oppføringer rapporteres i MSH.popupReport (collisions/invalid) → advarsel i editoren.
 *   Rekkefølge: rom, funksjoner, strategi-YAML-popups, ki-store-popups (i listens rekkefølge – dra i editoren).
 *   «Ett kort per popup» gjelder bare de genererte.
 * Re-generering uten omlasting: HA kjører strategien på nytt bare ved «Oppdater» (hui-root → config-refresh →
 *   ha-panel-lovelace._fetchConfig(true)), og det bygger hele visningen på nytt (alle kort lages på nytt, åpen popup
 *   lukkes/animeres). I stedet abonnerer strategien på ki-store (custom_popups/popup_overrides/popups): ved endring
 *   genereres visningen på nytt i minnet og bare Bubble-popupene i den levende stacken oppdateres (MSH.applyLivePopups):
 *   nye settes inn ved siden av de andre (samme innpakning, hui-card når HA bruker det), fjernede tas ut, endrede byttes
 *   ut – den som er åpen nå får setConfig i stedet, så den forblir åpen. Ingen navigering, ingen reload. Neste
 *   innlasting genererer det samme fra ki-store. Finnes ingen levende popups (f.eks. annet dashbord) → config-refresh.
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
      .filter((a) => !ex.has(a.area_id))
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
      if (hide[key] === false) return;
      if (cond[hash] && !cond[hash]()) return;
      out.push({ hash, name, icon, tag });
    });
    M.all(hass, 'person').forEach((pid) => {
      const hash = '#person-' + pid.split('.')[1];
      if (hide['person-' + pid.split('.')[1]] === false) return;
      out.push({ hash, name: M.name(hass, pid), icon: 'mdi:account', tag: 'msh-person-card', extra: { person: pid }, person: true });
    });
    if (hide.settings !== false) out.push({ hash: '#settings', name: 'Innstillinger', icon: 'mdi:cog', tag: 'msh-settings-card', tap: { action: 'navigate', navigation_path: '/config' } });
    return out;
  }
  function roomLook(area, hass, user) {
    const S = (user && user.cards) || {}, PO = popOf(user, area) || {};
    const rc = { ...(S[M.CARD_IDS.room(area)] || {}), ...((user && user.rooms && user.rooms[area]) || {}) }, fc = (S[M.CARD_IDS.faner] || {}).rooms || {};
    const col = PO.color || (rc.look && rc.look.col) || (fc[area] && fc[area].color) || (M.romColor ? M.romColor(area, hass) : 'var(--orange)');
    const icon = PO.icon || (rc.look && rc.look.icon) || (fc[area] && fc[area].icon) || null;
    return { col, icon };
  }

  /* ------------------------------------------------------------ egne popups: sammenslåing */
  const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
  const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));
  const normHash = (h) => { const s = String(h == null ? '' : h).trim(); return s ? (s[0] === '#' ? s : '#' + s) : ''; };
  // Deep-merge: objekter flettes rekursivt, lister og skalarer erstattes, null fjerner nøkkelen
  const deepMerge = (a, b) => {
    if (!isObj(b)) return clone(b);
    const out = isObj(a) ? clone(a) : {};
    Object.keys(b).forEach((k) => { if (b[k] === null) delete out[k]; else out[k] = isObj(b[k]) && isObj(out[k]) ? deepMerge(out[k], b[k]) : clone(b[k]); });
    return out;
  };
  M.deepMerge = deepMerge;
  // Ikonfarge (ikon-sirkelen i Bubble-headeren) ligger i styles: .icon-container {background-color:…}
  const ICON_RX = /(\.icon-container\s*\{\s*background-color\s*:\s*)([^;!}]*)/;
  function setIconColor(p, col) {
    const v = plainVar(col);
    if (typeof p.styles === 'string' && ICON_RX.test(p.styles)) p.styles = p.styles.replace(ICON_RX, `$1${v}`);
    else p.styles = `${p.styles || ''}\n.icon-container {background-color:${v}!important;}`;
  }
  M.popupIconColor = (cfg) => { const m = cfg && typeof cfg.styles === 'string' && ICON_RX.exec(cfg.styles); return m ? m[2].trim() : null; };
  const SRC_RANK = { yaml: 3, custom: 2, auto: 1 };
  /* auto: [{ config, group, color?, person? }] · yaml/custom: lister med Bubble-config · *Overrides: { '#hash': {…} | { replace, config } | false }
   * → { popups: [config …] (synlige, i rekkefølge), report: { entries, collisions, invalid } }
   *   entries[i] = { hash, key, source: auto|yaml|custom, index, group: rom|fn|egne, name, icon, color, gen (generert config),
   *                  base (vinnerens config), config (endelig, null = skjult), override: merge|replace|null, overrideFrom: yaml|store|null,
   *                  hidden, hiddenBy: yaml|store|user|null, losers: [kilde …] } */
  M.mergePopups = function ({ auto = [], yaml, custom, yamlOverrides, storeOverrides, userPopups } = {}) {
    const report = { entries: [], collisions: [], invalid: [] };
    const cand = new Map(); // hash → [{ source, index, config, meta }]
    const order = [];
    const push = (source, cfg, index, meta) => {
      const hash = isObj(cfg) ? normHash(cfg.hash) : '';
      if (!hash) { report.invalid.push({ source, index, reason: isObj(cfg) ? 'mangler hash' : 'er ikke et objekt' }); return; }
      if (!cand.has(hash)) cand.set(hash, []);
      cand.get(hash).push({ source, index, config: cfg, meta: meta || {} });
      order.push([hash, source, index]);
    };
    (auto || []).forEach((a, i) => push('auto', a.config, i, a));
    (Array.isArray(yaml) ? yaml : []).forEach((c, i) => push('yaml', c, i));
    (Array.isArray(custom) ? custom : []).forEach((c, i) => push('custom', c, i));
    const YO = isObj(yamlOverrides) ? yamlOverrides : {}, SO = isObj(storeOverrides) ? storeOverrides : {}, UP = isObj(userPopups) ? userPopups : {};
    const ovOf = (O, hash) => (Object.prototype.hasOwnProperty.call(O, hash) ? O[hash] : Object.prototype.hasOwnProperty.call(O, hash.slice(1)) ? O[hash.slice(1)] : undefined);
    const winners = new Map();
    cand.forEach((list, hash) => {
      // høyest kilde vinner; innen samme kilde vinner første
      const w = list.slice().sort((a, b) => SRC_RANK[b.source] - SRC_RANK[a.source] || a.index - b.index)[0];
      winners.set(hash, w);
      if (list.length > 1) report.collisions.push({ hash, winner: w.source, losers: list.filter((x) => x !== w).map((x) => x.source) });
    });
    const popups = [];
    order.forEach(([hash, source, index]) => {
      const w = winners.get(hash);
      if (!w || w.source !== source || w.index !== index) return;
      const list = cand.get(hash), gen = list.find((x) => x.source === 'auto');
      let cfg = clone(w.config), override = null, overrideFrom = null, hidden = false, hiddenBy = null;
      [['store', ovOf(SO, hash)], ['yaml', ovOf(YO, hash)]].forEach(([from, ov]) => {
        if (ov === undefined || ov === null || ov === true) return;
        if (ov === false || (isObj(ov) && ov.hidden === true && Object.keys(ov).length === 1)) { hidden = true; hiddenBy = from; return; }
        if (!isObj(ov)) return;
        if (ov.replace && isObj(ov.config)) { cfg = clone(ov.config); override = 'replace'; }
        else {
          const { replace, config: _c, color, ...rest } = ov;
          cfg = deepMerge(cfg, rest);
          if (color) setIconColor(cfg, color);
          override = override || 'merge';
        }
        cfg.hash = hash;
        overrideFrom = from;
      });
      const up = UP[hash.slice(1)] || UP[hash];
      if (!hidden && up && up.hidden) { hidden = true; hiddenBy = 'user'; }
      const view = cfg || {};
      report.entries.push({
        hash, key: hash.slice(1), source: w.source, index: w.index,
        group: w.source === 'auto' ? (w.meta.group || 'fn') : 'egne', person: !!w.meta.person,
        name: view.name || hash, icon: view.icon || 'mdi:card-outline', color: M.popupIconColor(view) || w.meta.color || null,
        gen: gen ? clone(gen.config) : null, base: clone(w.config), config: hidden ? null : cfg,
        override, overrideFrom, hidden, hiddenBy, losers: list.filter((x) => x !== w).map((x) => x.source),
      });
      if (!hidden) popups.push(cfg);
    });
    return { popups, report };
  };

  /* ------------------------------------------------------------ levende oppdatering (uten omlasting) */
  // Bubble-popupene i dashbordet nå: [{ el, wrap, cfg }] – wrap = hui-card-innpakningen når HA bruker den
  function liveBubbles() {
    const out = [];
    const w = (r, d) => {
      if (!r || d > 16 || !r.querySelectorAll) return;
      r.querySelectorAll('bubble-card').forEach((b) => { const c = b.config || b._config; if (c && c.card_type === 'pop-up' && c.hash && !b.__kiTemp && !(b.parentElement && b.parentElement.__kiTemp)) out.push({ el: b, cfg: c, wrap: b.parentElement && b.parentElement.localName === 'hui-card' ? b.parentElement : b }); });
      r.querySelectorAll('*').forEach((e) => { if (e.shadowRoot) w(e.shadowRoot, d + 1); });
    };
    w(document, 0);
    return out;
  }
  M.liveBubbles = liveBubbles;
  // Stack-kortet (hui-vertical-stack-card) som eier popupene: hold _cards/_config i takt, så hass når nye kort
  const stackOf = (node) => { const r = node && node.getRootNode && node.getRootNode(); const h = r && r.host; return h && Array.isArray(h._cards) ? h : null; };
  // Lag et levende popup-element med samme innpakning som de andre
  M.createLivePopup = function (cfg, hass, like) {
    const useHui = like ? like.wrap !== like.el : false;
    if (useHui && customElements.get('hui-card')) {
      const w = document.createElement('hui-card');
      w.hass = hass; w.config = cfg; if (w.load) w.load();
      return w;
    }
    const el = document.createElement('bubble-card');
    el.setConfig(cfg); el.hass = hass;
    return el;
  };
  M.applyLivePopups = function (pops, hass) {
    const live = liveBubbles();
    if (!live.length) return false;
    const want = new Map(pops.map((p) => [p.hash, p]));
    const byHash = new Map(live.map((x) => [x.cfg.hash, x]));
    const anchor = live[live.length - 1], parent = anchor.wrap.parentNode, stack = stackOf(anchor.wrap);
    const syncStack = (oldW, newW, cfg) => {
      if (!stack) return;
      try {
        const i = stack._cards.indexOf(oldW);
        if (newW && i >= 0) stack._cards[i] = newW; else if (newW) stack._cards.push(newW); else if (i >= 0) stack._cards.splice(i, 1);
        if (stack._config && Array.isArray(stack._config.cards)) {
          const cards = stack._config.cards.filter((c) => !(c && c.card_type === 'pop-up'));
          stack._config = { ...stack._config, cards: [...cards, ...pops] };
        }
      } catch (e) { /* */ }
    };
    const open = location.hash;
    live.forEach((x) => { if (!want.has(x.cfg.hash)) { x.wrap.remove(); syncStack(x.wrap, null); } });
    let last = anchor.wrap.isConnected ? anchor.wrap : null;
    pops.forEach((p) => {
      const x = byHash.get(p.hash);
      if (x) {
        last = x.wrap;
        if (JSON.stringify(x.cfg) === JSON.stringify(p)) return;
        if (open === p.hash) { try { x.el.setConfig(p); if (x.wrap !== x.el) x.wrap._config = p; } catch (e) { console.warn('[ki-msh] popup', p.hash, e); } return; } // åpen → oppdater på stedet
        const n = M.createLivePopup(p, hass, x);
        x.wrap.replaceWith(n); syncStack(x.wrap, n); last = n;
        return;
      }
      const n = M.createLivePopup(p, hass, anchor);
      if (last && last.parentNode) last.after(n); else parent.appendChild(n);
      syncStack(null, n); last = n;
    });
    return true;
  };
  // Generer på nytt fra ki-store og oppdater popupene i dashbordet
  let refreshing = null;
  M.refreshPopups = async function (hass) {
    hass = hass || M.lastHass || (document.querySelector('home-assistant') || {}).hass;
    if (!hass || !M.strategyConfig) return false;
    if (refreshing) { refreshing.again = true; return refreshing.p; }
    const run = { again: false };
    refreshing = run;
    run.p = (async () => {
      let ok = false;
      try {
        const view = await M.generateDashboardView(M.strategyConfig, hass);
        const pops = view.cards[0].cards.filter((c) => c && c.card_type === 'pop-up');
        ok = M.applyLivePopups(pops, hass);
        if (!ok) {
          const ha = document.querySelector('home-assistant'), root = ha && M.deep(ha.shadowRoot, 'hui-root');
          if (root) root.dispatchEvent(new CustomEvent('config-refresh', { bubbles: true, composed: true }));
        }
      } catch (e) { console.error('[ki-msh] popups', e); }
      window.dispatchEvent(new CustomEvent('ki-popups-updated'));
      return ok;
    })();
    const r = await run.p;
    refreshing = null;
    if (run.again) return M.refreshPopups(hass);
    return r;
  };
  // Endring i ki-store (egne popups, overstyringer, skjul/navn/ikon) → oppdater popupene (debounce 250 ms)
  const sigOf = (d) => { try { return JSON.stringify([d.custom_popups || null, d.popup_overrides || null, d.popups || null]); } catch (e) { return ''; } };
  let lastSig = null, sigTimer = null;
  if (M.store && M.store.subscribe) {
    M.store.subscribe((d, path) => {
      if (!M.strategyConfig || (path && !/^(custom_popups|popup_overrides|popups|devices)(\.|$)/.test(path))) return;
      const sig = sigOf(d || {});
      if (sig === lastSig) return;
      lastSig = sig;
      clearTimeout(sigTimer);
      sigTimer = setTimeout(() => M.refreshPopups(), 250);
    });
  }
  const remember = (config) => { M.strategyConfig = config || {}; lastSig = sigOf((M.store && M.store.get()) || {}); };

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
    const uo = (hash) => popOf(user, hash) || {}; // «Tilpass Hjem» → Popups: navn/ikon/ikonfarge på genererte
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
    const auto = [
      ...rooms.map((r) => {
        const L = roomLook(r.id, hass, user), o = uo('#' + r.id);
        const au = M.roomAuto(hass, r.id);
        const col = plainVar(o.color || L.col);
        return { group: 'rom', color: col, config: M.popupTemplateB({ name: o.name || r.name, icon: o.icon || L.icon || r.icon || (au.A && au.A.ikon) || 'mdi:home', hash: '#' + r.id, color: col, card: { type: 'custom:msh-rom-card', card_id: I.room(r.id), area: r.id, ...roomCfg(r.id) } }) };
      }),
      ...funcs.map((f) => {
        const o = uo(f.hash);
        const p = M.popupTemplateA({ name: o.name || f.name, icon: o.icon || f.icon, hash: f.hash, card: { type: 'custom:' + f.tag, card_id: 'pop-' + f.hash.slice(1), ...(f.extra || {}) } });
        if (o.color) setIconColor(p, o.color);
        if (f.tap) p.tap_action = f.tap;
        return { group: 'fn', person: !!f.person, config: p };
      }),
    ];
    const S = M.store ? M.store.get() || {} : {};
    const res = M.mergePopups({ auto, yaml: config.custom_popups, custom: S.custom_popups, yamlOverrides: config.popup_overrides, storeOverrides: S.popup_overrides, userPopups: (user && user.popups) || {} });
    M.popupReport = res.report;
    const shown = new Set(res.popups.map((p) => p.hash));
    const fk = funcs.filter((f) => !f.person && f.hash !== '#settings' && shown.has(f.hash)).map((f) => f.hash.slice(1));
    const navbar = { type: 'custom:msh-navbar-card', card_id: I.navbar, bar: fk.slice(0, 5), more: fk.slice(5), ...(config.navbar || {}) };
    return { title: 'Hjem', path: 'hjem', icon: 'mdi:home', panel: true, cards: [{ type: 'vertical-stack', cards: [home, navbar, ...res.popups] }] };
  };

  class KiDashboardStrategy extends HTMLElement {
    static async generate(config, hass) {
      const view = await M.generateDashboardView(config, hass);
      remember(config);
      return { title: (config && config.title) || 'Hjem', views: [view] };
    }
    static async getConfigElement() { return document.createElement('ki-dashboard-strategy-editor'); }
    static noEditor = false;
  }
  class KiHomeViewStrategy extends HTMLElement {
    static async generate(config, hass) { const v = await M.generateDashboardView(config, hass); remember(config); return v; }
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
