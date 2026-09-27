/* KI MSH · maler og dashbord-globale nøkler (fiks 16.9/16.12).
 * ÉN kilde for malene: ki-store «dashboard_globals» (samme nøkkel/bruker som editoren skriver til) = { yaml: '<tekst>' }
 * (eller nøklene direkte som objekt). Editoren («Maler og globale innstillinger»), advarselen «maler som mangler»,
 * strategien (rotnøklene) og mal-løseren leser alle herfra:
 *   MSH.getGlobals(raw?)        – parset objekt { button_card_templates, decluttering_templates, paper_buttons_row, … }
 *                                 (views/strategy/title/yaml tas aldri med). Mellomlagret på teksten. Aldri null.
 *   MSH.globalsInfo(raw?)       – { globals, err: { msg, line } | null, counts: { bct, dct, pbr } }
 *   MSH.globalsSummary(counts)  – «40 button-card-maler, 6 decluttering-maler, 1 paper-buttons-preset»
 *   MSH.templateRefs(cfg)       – maler en config bruker direkte: { bc: Set, dc: Set }
 *   MSH.missingTemplates(list, G?) – maler som brukes (også via arv: template: [universal_base], og i decluttering-
 *                                 malenes kort) men ikke finnes i globals → [navn]
 *   MSH.resolveTemplates(cfg, G?, opts?) – ny config der malene er slått inn (originalen røres ikke; uendrede
 *                                 grener beholdes som samme objekt). opts.warn(msg) får advarsler (ellers console.warn).
 * Løsningen (samme semantikk som kortene selv, kildekode: button-card helpers.ts mergeDeep/mergeStatesById +
 * _configFromLLTemplates, decluttering-card deep-replace.ts, paper-buttons-row presets.ts):
 *   custom:button-card + template (streng eller liste): malene løses rekursivt (malens egen template først), slås sammen
 *     fra eldste til nyeste og kortet sist. Objekter flettes dypt, lister legges etter hverandre (som button-card),
 *     skalarer: nyere vinner. state-lister: samme id → flettes (nyere vinner); uten id på begge → samme value/operator
 *     flettes; resten legges til. extra_styles fra alle nivåer beholdes (slått sammen i rekkefølge). template fjernes,
 *     [[[ … ]]]-JS røres ikke. Syklus (mal som arver seg selv) → hoppes over med advarsel. Mangler en mal → kortet
 *     står uendret (button-card viser da sin egen feilmelding).
 *   custom:decluttering-card: decluttering_templates[X].card (eller .element) med [[var]] byttet ut (variables, så
 *     malens default:) – tall/boolske/objekter erstatter hele «"[[var]]"»-verdien, ellers tekstbytte – og deretter løst
 *     videre (button-card-maler inni).
 *   custom:paper-buttons-row: preset (per knapp, ellers radens) → paper_buttons_row.presets.<navn> flettes inn i knappen
 *     (preset først, knappen sist, lister etter hverandre som deepmerge); preset-nøkkelen fjernes når den er løst.
 * Rekursivt gjennom alle nestede kort (cards, card, elements, custom_fields, stacks, expander-card, Bubble Card, conditional …).
 */
(function () {
  const M = window.MSH;
  if (!M || M.resolveTemplates) return;
  const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
  const clone = (v) => (v == null || typeof v !== 'object' ? v : JSON.parse(JSON.stringify(v)));
  const RESERVED = new Set(['views', 'strategy', 'title', 'yaml']);
  const EMPTY = Object.freeze({ globals: Object.freeze({}), err: null, counts: Object.freeze({ bct: 0, dct: 0, pbr: 0 }) });

  /* ------------------------------------------------------------ globals (én kilde) */
  let last = { ref: undefined, text: undefined, info: EMPTY };
  const nKeys = (o) => (isObj(o) ? Object.keys(o).length : 0);
  const countsOf = (G) => ({
    bct: nKeys(G.button_card_templates),
    dct: nKeys(G.decluttering_templates),
    pbr: isObj(G.paper_buttons_row) ? nKeys(G.paper_buttons_row.presets) : 0,
  });
  M.globalsInfo = function (raw) {
    const g = raw === undefined ? (M.store && M.store.get('dashboard_globals')) : raw;
    if (!isObj(g)) return EMPTY;
    if (g === last.ref) return last.info;
    const text = typeof g.yaml === 'string' ? 'y' + g.yaml : 'o' + JSON.stringify(g);
    if (text === last.text) { last.ref = g; return last.info; }
    let obj = g, err = null;
    if (typeof g.yaml === 'string') {
      try {
        obj = M.yaml.parse(g.yaml);
        if (obj != null && !isObj(obj)) { err = { msg: 'Må være nøkler på rotnivå (button_card_templates:, decluttering_templates: …)', line: null }; obj = {}; }
      } catch (e) { err = { msg: e.reason || e.message, line: e.line || null }; obj = {}; }
    }
    const globals = {};
    Object.keys(obj || {}).forEach((k) => { if (!RESERVED.has(k) && obj[k] != null) globals[k] = obj[k]; });
    const info = { globals, err, counts: countsOf(globals) };
    last = { ref: g, text, info };
    return info;
  };
  M.getGlobals = (raw) => M.globalsInfo(raw).globals;
  M.globalsSummary = (c) => {
    c = c || M.globalsInfo().counts;
    const pl = (n, en, fl) => `${n} ${n === 1 ? en : fl}`;
    return [pl(c.bct, 'button-card-mal', 'button-card-maler'), pl(c.dct, 'decluttering-mal', 'decluttering-maler'), pl(c.pbr, 'paper-buttons-preset', 'paper-buttons-presets')].join(', ');
  };

  /* ------------------------------------------------------------ maler i bruk / manglende */
  const typeOf = (v) => String((v && v.type) || '');
  const tplNames = (t) => (typeof t === 'string' ? [t] : Array.isArray(t) ? t : []).filter((x) => typeof x === 'string').map((x) => x.trim()).filter((x) => x && !/[[{]/.test(x));
  M.templateRefs = function (v, out, d) {
    out = out || { bc: new Set(), dc: new Set() };
    d = d || 0;
    if (d > 60 || v == null || typeof v !== 'object') return out;
    if (Array.isArray(v)) { v.forEach((x) => M.templateRefs(x, out, d + 1)); return out; }
    if ('template' in v) {
      const names = tplNames(v.template);
      if (typeOf(v) === 'custom:decluttering-card') names.forEach((n) => out.dc.add(n));
      else names.forEach((n) => out.bc.add(n));
    }
    Object.keys(v).forEach((k) => { if (k !== 'template' && v[k] && typeof v[k] === 'object') M.templateRefs(v[k], out, d + 1); });
    return out;
  };
  M.missingTemplates = function (list, G) {
    G = G || M.getGlobals();
    const BCT = isObj(G.button_card_templates) ? G.button_card_templates : {};
    const DCT = isObj(G.decluttering_templates) ? G.decluttering_templates : {};
    const miss = new Set(), seenB = new Set(), seenD = new Set();
    const bc = (n) => {
      if (seenB.has(n)) return;
      seenB.add(n);
      if (!Object.prototype.hasOwnProperty.call(BCT, n) || !isObj(BCT[n])) { if (!Object.prototype.hasOwnProperty.call(DCT, n)) miss.add(n); return; }
      walk(BCT[n]); // arv (template: [universal_base]) og nestede kort i malen
    };
    const dc = (n) => {
      if (seenD.has(n)) return;
      seenD.add(n);
      if (!isObj(DCT[n])) { miss.add(n); return; }
      walk(DCT[n].card || DCT[n].element);
    };
    const walk = (cfg) => { const r = M.templateRefs(cfg); r.bc.forEach(bc); r.dc.forEach(dc); };
    (Array.isArray(list) ? list : [list]).forEach((c) => { if (c) walk(c); });
    return [...miss];
  };

  /* ------------------------------------------------------------ sammenslåing (button-card) */
  // button-card mergeDeep: lister etter hverandre, objekter rekursivt, ellers nyere vinner
  function mergeDeep(a, b) {
    const out = isObj(a) ? { ...a } : {};
    Object.keys(b || {}).forEach((k) => {
      const p = out[k], o = b[k];
      if (Array.isArray(p) && Array.isArray(o)) out[k] = p.concat(o);
      else if (isObj(p) && isObj(o)) out[k] = mergeDeep(p, o);
      else out[k] = o;
    });
    return out;
  }
  const opOf = (s) => String(s.operator || '==');
  const sameState = (a, b) => {
    if (!isObj(a) || !isObj(b)) return false;
    if (a.id != null || b.id != null) return a.id != null && b.id != null && String(a.id) === String(b.id);
    return 'value' in a && 'value' in b && JSON.stringify(a.value) === JSON.stringify(b.value) && opOf(a) === opOf(b);
  };
  // button-card mergeStatesById (+ value/operator når ingen av dem har id): into (eldre) ← from (nyere)
  function mergeStates(into, from) {
    into = Array.isArray(into) ? into : [];
    from = Array.isArray(from) ? from : [];
    const out = into.map((s) => { let x = s; from.forEach((f) => { if (sameState(s, f)) x = mergeDeep(x, f); }); return x; });
    return out.concat(from.filter((f) => !into.some((s) => sameState(s, f))));
  }
  const joinStyles = (a, b) => (a == null ? b : b == null ? a : typeof a === 'string' && typeof b === 'string' ? `${a}\n${b}` : b);

  // Én mal (med arv) → sammenslått config uten template. stack = navn under løsning (syklus-vakt).
  function flatTemplate(name, BCT, stack, warn, missing) {
    if (stack.includes(name)) { warn(`Button-card-malen «${name}» arver seg selv (${[...stack, name].join(' → ')}) – hoppet over`); return null; }
    const t = BCT[name];
    if (!isObj(t)) { missing.add(name); return null; }
    return flatConfig(t, BCT, [...stack, name], warn, missing);
  }
  function flatConfig(cfg, BCT, stack, warn, missing) {
    const names = tplNames(cfg.template);
    if (!('template' in cfg)) return cfg;
    let res = {}, states, extra;
    names.forEach((n) => {
      const r = flatTemplate(n, BCT, stack, warn, missing);
      if (!r) return;
      extra = joinStyles(extra, r.extra_styles);
      const { extra_styles, ...rest } = r;
      res = mergeDeep(res, rest);
      states = mergeStates(states, r.state);
    });
    const { template, extra_styles, ...own } = cfg;
    res = mergeDeep(res, own);
    const st = mergeStates(states, cfg.state);
    if (st.length) res.state = st; else delete res.state;
    extra = joinStyles(extra, extra_styles);
    if (extra != null) res.extra_styles = extra;
    return res;
  }

  /* ------------------------------------------------------------ decluttering-card */
  const escRx = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function declutter(cfg, DCT, warn) {
    const name = typeof cfg.template === 'string' ? cfg.template.trim() : '';
    const tpl = DCT[name];
    if (!isObj(tpl) || !(tpl.card || tpl.element)) { warn(`Decluttering-malen «${name}» mangler`); return null; }
    let vars = Array.isArray(cfg.variables) ? cfg.variables.slice(0) : isObj(cfg.variables) ? Object.keys(cfg.variables).map((k) => ({ [k]: cfg.variables[k] })) : [];
    if (Array.isArray(tpl.default)) vars = vars.concat(tpl.default);
    let json = JSON.stringify(tpl.card || tpl.element);
    vars.forEach((v) => {
      if (!isObj(v)) return;
      const key = Object.keys(v)[0];
      if (key == null) return;
      const val = v[key], k = escRx(key);
      if (typeof val === 'number' || typeof val === 'boolean' || (val && typeof val === 'object')) json = json.replace(new RegExp(`"\\[\\[${k}\\]\\]"`, 'g'), () => JSON.stringify(val));
      if (val === null) json = json.replace(new RegExp(`"\\[\\[${k}\\]\\]"`, 'g'), () => 'null');
      if (val == null || typeof val !== 'object') json = json.replace(new RegExp(`\\[\\[${k}\\]\\]`, 'g'), () => JSON.stringify(val == null ? '' : String(val)).slice(1, -1));
    });
    try { return JSON.parse(json); } catch (e) { warn(`Decluttering-malen «${name}»: ugyldig resultat (${e.message})`); return null; }
  }

  /* ------------------------------------------------------------ paper-buttons-row */
  // deepmerge (npm) som paper-buttons-row bruker: lister etter hverandre, objekter rekursivt
  const pbrMerge = (a, b) => mergeDeep(clone(a), b);
  function paperRow(cfg, P) {
    if (!Array.isArray(cfg.buttons)) return cfg;
    let changed = false;
    const rowPreset = typeof cfg.preset === 'string' ? cfg.preset : null;
    const one = (b) => {
      const btn = typeof b === 'string' ? { entity: b } : b;
      if (!isObj(btn)) return b;
      const name = typeof btn.preset === 'string' ? btn.preset : rowPreset;
      if (!name || !isObj(P[name])) return b;
      changed = true;
      const { preset, ...rest } = btn;
      return pbrMerge(P[name], rest);
    };
    const buttons = cfg.buttons.map((row) => (Array.isArray(row) ? row.map(one) : one(row)));
    if (!changed) return cfg;
    const out = { ...cfg, buttons };
    // radens preset er nå brukt på knappene (knapper med egen, ukjent preset beholder sin)
    if (rowPreset && isObj(P[rowPreset])) delete out.preset;
    return out;
  }

  /* ------------------------------------------------------------ løsning */
  M.resolveTemplates = function (cfg, G, opts) {
    G = G || M.getGlobals();
    opts = opts || {};
    const warned = new Set();
    const warn = (msg) => { if (warned.has(msg)) return; warned.add(msg); if (opts.warn) opts.warn(msg); else console.warn('[ki-msh] maler:', msg); };
    const BCT = isObj(G.button_card_templates) ? G.button_card_templates : {};
    const DCT = isObj(G.decluttering_templates) ? G.decluttering_templates : {};
    const P = isObj(G.paper_buttons_row) && isObj(G.paper_buttons_row.presets) ? G.paper_buttons_row.presets : {};
    const walk = (v, d) => {
      if (d > 60 || v == null || typeof v !== 'object') return v;
      if (Array.isArray(v)) {
        let ch = false;
        const out = v.map((x) => { const y = walk(x, d + 1); if (y !== x) ch = true; return y; });
        return ch ? out : v;
      }
      let cur = v;
      const type = typeOf(cur);
      if (type === 'custom:decluttering-card' && typeof cur.template === 'string') {
        const r = declutter(cur, DCT, warn);
        if (r) return walk(r, d + 1);
      } else if (type === 'custom:button-card' && 'template' in cur) {
        const names = tplNames(cur.template), missing = new Set(names.filter((n) => !isObj(BCT[n])));
        // mangler en mal kortet bruker direkte → kortet står uendret (button-card viser sin egen feil)
        if (!missing.size) cur = clone(flatConfig(cur, BCT, [], warn, missing));
        if (missing.size) warn(`Button-card-mal mangler: ${[...missing].join(', ')}`);
      } else if (type === 'custom:paper-buttons-row') {
        cur = paperRow(cur, P);
      }
      let out = cur;
      Object.keys(cur).forEach((k) => {
        const x = cur[k];
        if (!x || typeof x !== 'object') return;
        const y = walk(x, d + 1);
        if (y !== x) { if (out === v) out = { ...cur }; out[k] = y; }
      });
      if (out === cur && cur !== v) out = { ...cur };
      return out;
    };
    return walk(cfg, 0);
  };
})();
