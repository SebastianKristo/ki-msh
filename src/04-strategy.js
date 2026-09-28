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
 *   ki-store custom_popups[i] er enten en Bubble-config (laget i editoren) eller en importert popup (fiks 15.5):
 *     { id, hash, name, icon, yaml: '<YAML-teksten, uendret>', imported?: 'popups.html' }  → parses (MSH.yaml) ved generering;
 *     hash/name/icon er speil av YAML-en for lister (YAML-en er sannheten). Ugyldig YAML → report.invalid, popupen hoppes over.
 *   Egen popup med samme hash som en autogenerert vinner (report.replaced → «Erstattet av egen popup» i editoren);
 *   ki-store popups.<key>.prefer = 'auto' («Bruk autogenerert») snur det (report.inactive).
 * Dashbord-globale nøkler (fiks 15.8): ki-store dashboard_globals = { yaml: '<tekst>' } (eller nøklene direkte:
 *   { button_card_templates, decluttering_templates, paper_buttons_row, … }) → returneres på rotnivå fra
 *   generate(): { ...globals, title, views }. button-card/decluttering-card/paper-buttons-row leser dem fra lovelace.config.
 *   NB: button-card slår opp malene når kortet får config (setConfig), så endrede maler krever at kortene lages på nytt:
 *   ved endring av dashboard_globals oppdateres lovelace.config straks og HA bes regenerere (config-refresh, som
 *   «Oppdater» i menyen – ingen omlasting av nettleseren, men åpen popup lukkes). Popup-endringer går uten refresh.
 *   Fiks 16.9/16.12: malene leses fra ÉN kilde (MSH.getGlobals, 03-templates.js) og løses i popupene her
 *   (MSH.resolveTemplates) før configen returneres – kortene trenger da ikke lovelace.config-oppslaget i setConfig.
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
  /* Popups som alltid lages når noe peker på dem (Fiks 12 · #ruter): navbar-knapp (innebygd id = hash uten #, med mindre
   * den er skjult eller har fått annen hash; egne knapper med hash), Hjem-flis (Tilpass Hjem → overrides.<id>) eller
   * en snarvei/lenke/popup_hash hvor som helst i kortconfigene (ki-store cards.* og strategiens home/navbar).
   * Mangler entitetene viser kortet tom-tilstanden (aldri skjult popup). */
  // Popups som lages når noe peker på dem (navbarens innebygde knapper, Hjem-flis, snarveier), også uten entiteter –
  // kortene viser da tom-tilstand i stedet for at knappen peker på en popup som ikke finnes.
  M.REF_POPUPS = M.REF_POPUPS || { '#ruter': { nav: 'ruter', tile: 'ruter' }, '#vanning': { nav: 'vanning' }, '#media': { nav: 'media' }, '#klima': { nav: 'klima' }, '#basseng': { nav: 'basseng' }, '#gjoremal': { nav: 'gjoremal' } };
  const hasStr = (o, v, d) => (d > 12 || o == null ? false : typeof o === 'string' ? o.trim() === v : typeof o === 'object' ? Object.values(o).some((x) => hasStr(x, v, (d || 0) + 1)) : false);
  function popupRefs(hash, config, user) {
    const R = M.REF_POPUPS[hash];
    if (!R) return false;
    const I = M.CARD_IDS || {}, cards = (user && user.cards) || {};
    const nav = { ...(config.navbar || {}), ...(cards[I.navbar] || {}) };
    const B = nav.buttons || {}, own = B[R.nav] || {}, hidden = Array.isArray(nav.hidden) ? nav.hidden : [];
    // knappens mål: tap.navigation_path (fiks 15.6) eller den eldre hash-nøkkelen
    const target = (b) => { if (!b) return null; const t = b.tap; if (t && typeof t === 'object') return t.action === 'navigate' && /^#/.test(String(t.navigation_path || '')) ? String(t.navigation_path).trim() : ''; if (typeof t === 'string' && t.trim()) return /^#/.test(t.trim()) ? t.trim() : ''; return b.hash != null && b.hash !== '' ? '#' + String(b.hash).trim().replace(/^#/, '') : null; };
    const ot = target(own), oh = ot == null ? hash : ot;
    if (R.nav && !hidden.includes(R.nav) && oh === hash) return true; // navbarens innebygde knapp (bar/«Mer»)
    if (Object.keys(B).some((k) => B[k] && !hidden.includes(k) && target(B[k]) === hash)) return true;
    const faner = { ...(((config.home || {}).cards || {}).faner || {}), ...(cards[I.faner] || {}) };
    if (R.tile && faner.overrides && faner.overrides[R.tile]) return true; // Hjem-flis med valgt entitet
    return hasStr(cards, hash) || hasStr(config.home, hash);
  }
  M.popupRefs = popupRefs;
  // Funksjons-popups: når det finnes entiteter for dem (entiteter.md), eller noe peker på dem (M.REF_POPUPS)
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
      '#dorlas': () => has('lock'), // fiks 16.7
      '#ringeklokke': () => plat('unifiprotect') && !!(M.ringFind && M.ringFind(hass)), // fiks 19.17: binary_sensor.*_doorbell (unifiprotect)
      '#energi': () => has('sensor', (s) => ['energy', 'power', 'water'].includes(s.attributes.device_class)), // fiks 21.1: energi-/effekt-/vannmålere (Energi-oppsettet)
      '#kart': () => ['person', 'device_tracker'].some((d) => M.all(hass, d).some((id) => hass.states[id].attributes.latitude != null)), // fiks 20.22: personer/sporere med posisjon
    };
    const hide = (config.popups || {});
    const out = [];
    M.FUNCTION_POPUPS.forEach(([hash, name, icon, tag]) => {
      const key = hash.slice(1);
      if (hide[key] === false) return;
      if (cond[hash] && !cond[hash]() && !popupRefs(hash, config, user)) return;
      if (M.popupNeeds && M.popupNeeds[hash] && !M.popupNeeds[hash](hass)) return; // Dørlås: aldri uten lock.*
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
  /* Importert/egen popup lagret som YAML-tekst → Bubble-config. Mellomlagres per tekst.
   * → { cfg, err: null } | { cfg: null, err: { msg, line } } */
  const yCache = new Map();
  M.customPopupConfig = function (entry) {
    if (!isObj(entry)) return { cfg: null, err: { msg: 'er ikke et objekt', line: null } };
    if (typeof entry.yaml !== 'string' || entry.type) return { cfg: entry, err: null };
    const t = entry.yaml;
    if (yCache.has(t)) return yCache.get(t);
    let r;
    try {
      const cfg = M.yaml.parse(t);
      r = isObj(cfg) ? { cfg, err: null } : { cfg: null, err: { msg: 'YAML-en er ikke et objekt', line: null } };
    } catch (e) { r = { cfg: null, err: { msg: e.reason || e.message, line: e.line || null } }; }
    if (yCache.size > 200) yCache.clear();
    yCache.set(t, r);
    return r;
  };
  /* Dashbord-globale nøkler (button_card_templates, decluttering_templates, paper_buttons_row …) fra ki-store.
   * → { globals: {…}, err } – nøkler som tilhører strategien/visningene (views, strategy, title) tas aldri med. */
  const RESERVED_ROOT = new Set(['views', 'strategy', 'title', 'yaml']);
  // Én kilde (fiks 16.9): MSH.globalsInfo/getGlobals (03-templates.js) – editoren, advarselen og mal-løseren leser det samme
  M.dashboardGlobals = function (raw) {
    const r = M.globalsInfo ? M.globalsInfo(raw) : { globals: {}, err: null };
    return { globals: r.globals, err: r.err };
  };
  /* Fiks 15.1 · generert popup med ødelagt kortliste etter overstyring/sammenslåing → rettes, aldri tom popup:
   *   tom/manglende cards → det genererte kortet; gammelt kortnavn (ki-klima-card for msh-klima-card), et msh-kort som
   *   ikke finnes lenger, eller separat toppkort (msh-klima-hero-card) → slås sammen til ETT hovedkort (innstillinger beholdes).
   *   Egne kort (andre typer) røres ikke. Returnerer ny config eller null (ingenting å rette). */
  const tagOf = (c) => String((c && c.type) || '').replace(/^custom:/, '');
  function repairCards(cfg, gen) {
    const want = gen && Array.isArray(gen.cards) && gen.cards.length === 1 && isObj(gen.cards[0]) ? gen.cards[0] : null;
    if (!want || !isObj(cfg)) return null;
    const tag = tagOf(want), heroTag = (M.HEROES || {})[tag];
    if (!/^msh-/.test(tag)) return null;
    const list = Array.isArray(cfg.cards) ? cfg.cards.filter(isObj) : [];
    if (!list.length) return { ...cfg, cards: [clone(want)] };
    const loaded = typeof customElements !== 'undefined' && !!customElements.get(tag); // bundelen er lastet → msh-navn kan sjekkes
    const isMain = (c) => tagOf(c) === tag, isHero = (c) => !!heroTag && tagOf(c) === heroTag;
    const isOld = (c) => { const t = tagOf(c); return t === tag.replace(/^msh-/, 'ki-') || (loaded && /^msh-.*-card$/.test(t) && !customElements.get(t)); };
    const ours = list.filter((c) => isMain(c) || isHero(c) || isOld(c));
    if (!ours.length || (ours.length === 1 && isMain(ours[0]) && list.length === (cfg.cards || []).length)) return null;
    const base = ours.find(isMain) || ours.find(isOld) || ours[0];
    const strip = ({ type, card_id, ...r }) => r;
    const merged = Object.assign({}, ...ours.filter((c) => c !== base).map(strip), { ...base }, { type: 'custom:' + tag });
    if (!merged.card_id) merged.card_id = want.card_id;
    const cards = list.filter((c) => !ours.includes(c));
    cards.splice(list.slice(0, list.indexOf(ours[0])).filter((c) => !ours.includes(c)).length, 0, merged);
    return { ...cfg, cards };
  }
  M.repairPopupCards = repairCards;
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
    (Array.isArray(custom) ? custom : []).forEach((c, i) => {
      const r = M.customPopupConfig(c);
      if (r.err) { report.invalid.push({ source: 'custom', index: i, hash: isObj(c) ? normHash(c.hash) : '', reason: `har ugyldig YAML${r.err.line ? ` (linje ${r.err.line})` : ''}: ${r.err.msg}` }); return; }
      push('custom', r.cfg, i, isObj(c) && typeof c.yaml === 'string' ? { id: c.id, stored: 'yaml' } : {});
    });
    const YO = isObj(yamlOverrides) ? yamlOverrides : {}, SO = isObj(storeOverrides) ? storeOverrides : {}, UP = isObj(userPopups) ? userPopups : {};
    const ovOf = (O, hash) => (Object.prototype.hasOwnProperty.call(O, hash) ? O[hash] : Object.prototype.hasOwnProperty.call(O, hash.slice(1)) ? O[hash.slice(1)] : undefined);
    const winners = new Map();
    report.replaced = []; report.inactive = [];
    const upOf = (hash) => UP[hash.slice(1)] || UP[hash] || null;
    cand.forEach((list, hash) => {
      // høyest kilde vinner; innen samme kilde vinner første. Egen over auto, med mindre brukeren har valgt «Bruk autogenerert».
      const hasAuto = list.some((x) => x.source === 'auto'), pAuto = hasAuto && !!(upOf(hash) && upOf(hash).prefer === 'auto');
      const rank = (x) => (x.source === 'custom' && pAuto ? 0.5 : SRC_RANK[x.source]);
      const w = list.slice().sort((a, b) => rank(b) - rank(a) || a.index - b.index)[0];
      winners.set(hash, w);
      if (list.length < 2) return;
      const losers = list.filter((x) => x !== w);
      // egen ↔ generert er en bevisst erstatning, ikke en konflikt
      const kind = (w.source === 'custom' && losers.every((x) => x.source === 'auto')) || (w.source === 'auto' && pAuto && losers.every((x) => x.source === 'custom')) ? 'replace' : 'conflict';
      report.collisions.push({ hash, winner: w.source, losers: losers.map((x) => x.source), kind });
      const a = list.find((x) => x.source === 'auto'), c = list.find((x) => x.source === 'custom');
      if (w.source === 'custom' && a) report.replaced.push({ hash, key: hash.slice(1), group: a.meta.group || 'fn', name: (a.config && a.config.name) || hash, icon: (a.config && a.config.icon) || 'mdi:card-outline', index: c.index });
      if (w.source === 'auto' && pAuto && c) report.inactive.push({ hash, key: hash.slice(1), index: c.index, name: (c.config && c.config.name) || hash, icon: (c.config && c.config.icon) || 'mdi:card-outline' });
    });
    const popups = [];
    order.forEach(([hash, source, index]) => {
      const w = winners.get(hash);
      if (!w || w.source !== source || w.index !== index) return;
      const list = cand.get(hash), gen = list.find((x) => x.source === 'auto');
      let cfg = clone(w.config), override = null, overrideFrom = null, hidden = false, hiddenBy = null;
      if (cfg.hash !== hash) cfg.hash = hash; // 'ruter' / ' #ruter' → '#ruter' (Bubble Card sammenligner med location.hash)
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
      let repaired = false;
      if (gen && w.source === 'auto' && !hidden) { const fx = repairCards(cfg, gen.config); if (fx) { console.warn('[ki-msh] popup', hash, 'hadde tom/ugyldig kortliste – rettet til', fx.cards.map(tagOf).join(', ')); cfg = fx; repaired = true; } }
      const up = UP[hash.slice(1)] || UP[hash];
      if (!hidden && up && up.hidden) { hidden = true; hiddenBy = 'user'; }
      const view = cfg || {};
      report.entries.push({
        hash, key: hash.slice(1), source: w.source, index: w.index,
        group: w.source === 'auto' ? (w.meta.group || 'fn') : 'egne', person: !!w.meta.person,
        name: view.name || hash, icon: view.icon || 'mdi:card-outline', color: M.popupIconColor(view) || w.meta.color || null,
        gen: gen ? clone(gen.config) : null, base: clone(w.config), config: hidden ? null : cfg,
        override, overrideFrom, hidden, hiddenBy, repaired, losers: list.filter((x) => x !== w).map((x) => x.source),
        replacesAuto: w.source === 'custom' && !!gen, preferAuto: w.source === 'auto' && list.some((x) => x.source === 'custom'), stored: w.meta.stored || null, id: w.meta.id || null,
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
  const gSigOf = (d) => { try { return JSON.stringify(d.dashboard_globals || null); } catch (e) { return ''; } };
  let lastSig = null, sigTimer = null, lastG = null, gTimer = null;
  /* Maler/globale nøkler endret → skriv dem inn i den levende lovelace.config (så nye kort finner dem straks) og be HA
   * regenerere dashbordet (config-refresh = «Oppdater»): button-card slår opp maler i setConfig, så eksisterende kort må lages på nytt. */
  M.applyDashboardGlobals = function () {
    const G = M.dashboardGlobals().globals;
    try {
      const ha = document.querySelector('home-assistant');
      const panel = ha && M.deep && M.deep(ha.shadowRoot, 'ha-panel-lovelace');
      const ll = panel && panel.lovelace;
      if (ll && ll.config && typeof ll.config === 'object') {
        const prev = M.__kiGlobalKeys || [];
        prev.forEach((k) => { if (!(k in G)) delete ll.config[k]; });
        Object.keys(G).forEach((k) => { ll.config[k] = G[k]; });
        M.__kiGlobalKeys = Object.keys(G);
      }
      const root = panel && M.deep(panel.shadowRoot || panel, 'hui-root');
      if (root) root.dispatchEvent(new CustomEvent('config-refresh', { bubbles: true, composed: true }));
      return !!root;
    } catch (e) { console.warn('[ki-msh] dashboard_globals', e); return false; }
  };
  if (M.store && M.store.subscribe) {
    M.store.subscribe((d, path) => {
      if (!M.strategyConfig) return;
      if (!path || /^dashboard_globals(\.|$)/.test(path)) {
        const g = gSigOf(d || {});
        if (M.strategyIsDashboard && g !== lastG) { lastG = g; clearTimeout(gTimer); gTimer = setTimeout(() => M.applyDashboardGlobals(), 300); }
        else lastG = g;
      }
      if (path && !/^(custom_popups|popup_overrides|popups|devices)(\.|$)/.test(path)) return;
      const sig = sigOf(d || {});
      if (sig === lastSig) return;
      lastSig = sig;
      clearTimeout(sigTimer);
      sigTimer = setTimeout(() => M.refreshPopups(), 250);
    });
  }
  const remember = (config, dash) => { M.strategyConfig = config || {}; if (dash) M.strategyIsDashboard = true; const d = (M.store && M.store.get()) || {}; lastSig = sigOf(d); lastG = gSigOf(d); };

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
    // Fiks 16.12 · maler løses her (button-card/decluttering-card/paper-buttons-row), så kortene ikke er avhengige av at
    // lovelace.config har rotnøklene når de lages. Rotnøklene returneres i tillegg (for kort lagt til manuelt).
    if (M.resolveTemplates) {
      const G = M.getGlobals();
      if (Object.keys(G).length) res.popups = res.popups.map((p) => { try { return M.resolveTemplates(p, G); } catch (e) { console.warn('[ki-msh] maler', p && p.hash, e); return p; } });
    }
    const shown = new Set(res.popups.map((p) => p.hash));
    const fk = funcs.filter((f) => !f.person && f.hash !== '#settings' && shown.has(f.hash)).map((f) => f.hash.slice(1));
    const navbar = { type: 'custom:msh-navbar-card', card_id: I.navbar, bar: fk.slice(0, 5), more: fk.slice(5), ...(config.navbar || {}) };
    return { title: 'Hjem', path: 'hjem', icon: 'mdi:home', panel: true, cards: [{ type: 'vertical-stack', cards: [home, navbar, ...res.popups] }] };
  };

  // Logg getGlobals()-antallet (ved oppstart og når malene endres) + diagnose: finner button-card malene i lovelace.config?
  let loggedG = null;
  function logGlobals() {
    const info = M.globalsInfo ? M.globalsInfo() : null;
    if (!info) return;
    const s = M.globalsSummary(info.counts);
    if (s === loggedG) return;
    loggedG = s;
    console.info('[ki-msh] maler (ki-store dashboard_globals):', s);
    setTimeout(() => { try { console.info('[ki-msh] maler i lovelace.config:', JSON.stringify(M.templateDiagnose())); } catch (e) { /* */ } }, 4000);
  }
  // hui-root → lovelace.config: er det den genererte configen (ikke rawConfig med bare strategy:) og har den rotnøklene?
  M.templateDiagnose = function () {
    const ha = document.querySelector('home-assistant');
    const panel = ha && M.deep && M.deep(ha.shadowRoot, 'ha-panel-lovelace');
    const root = panel && M.deep(panel.shadowRoot || panel, 'hui-root');
    const ll = (root && root.lovelace) || (panel && panel.lovelace);
    const c = ll && ll.config;
    const n = (o) => (o && typeof o === 'object' ? Object.keys(o).length : 0);
    return { store: M.globalsInfo().counts, lovelace: c ? { generated: !c.strategy && Array.isArray(c.views), bct: n(c.button_card_templates), dct: n(c.decluttering_templates), pbr: n(c.paper_buttons_row && c.paper_buttons_row.presets) } : null };
  };

  class KiDashboardStrategy extends HTMLElement {
    static async generate(config, hass) {
      const view = await M.generateDashboardView(config, hass);
      remember(config, true);
      // maler og andre dashbord-globale nøkler (fiks 15.8) på rotnivå – der button-card/decluttering-card/paper-buttons-row leter
      const G = M.dashboardGlobals();
      if (G.err) console.warn('[ki-msh] dashboard_globals har ugyldig YAML – maler tas ikke med:', G.err.msg, G.err.line ? 'linje ' + G.err.line : '');
      logGlobals();
      M.__kiGlobalKeys = Object.keys(G.globals);
      return { ...G.globals, title: (config && config.title) || 'Hjem', views: [view] };
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
