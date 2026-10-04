/* KI MSH · Strøm v3 (#strom) – Kurser-fanen + Kurser-editoren (Del 45, modul B).
 * Kilde (1:1): design/Strøm popup v3.dc.html – malen `isKurser` (k_total / k_kat / k_kurs), `KDEF`, `kursEd`, `kYaml`.
 *
 * M.stromKurser = { KDEF, norm, html, bind, css, editorHtml, editorBind, toYaml }
 *   host = msh-strom-card (61-strom.js) – bruker host.hass, host.config, host.ui, host.setCfg(patch), host.render(),
 *          host.anim, host.haptic(type). Modulen eier config-nøklene `kurs`, `ord.kurs` og `ord.cat`.
 *   norm(kurs)                 → dyp kopi med `groups` (mangler/ugyldig/null → KDEF, brukerens nåværende YAML).
 *   html(host)                 → markup for Kurser-fanen: <div class="sk-kroot"> med seksjonene k_total, k_kat, k_kurs
 *                                (data-rk="sec-Kurser" data-rid=…, rekkefølge = ord['sec-Kurser'] via CSS order, hid skjuler).
 *   bind(host, el)             → delegerte lyttere på el (idempotent): Kroner/kWh, I dag/Måneden, prisvalg (chip),
 *                                kategori-fliser (trykk = fordeling), sikringsskap-akkordeon, hold 400 ms + dra på
 *                                fliser (ord.cat), kurser (ord.kurs) og seksjoner (ord['sec-Kurser'] – bare hvis host
 *                                ikke selv tilbyr host.secHold). Ren UI-tilstand i host.ui (kursUnit/kursPer/kursAlt når
 *                                remember_view, kursCat, kursOpen) – lokal morph av roten, ingen config-lagring.
 *   editorHtml(host, draft)    → Kurser-editoren (Tilpass → Kurser og GUI-editoren). draft = kurs-objektet (eller en
 *                                config med `kurs`); null = standard (KDEF).
 *   editorBind(host, el, draft, onChange) → alle endringer kaller onChange(nyKurs) (null = «Tilbakestill kurser»).
 *                                Ren editortilstand (åpne/redigert/Avansert/YAML) ligger på host.__skEd.
 *   toYaml(kurs)               → gyldig YAML for `custom:ki-energi-card-strom` (MSH.yaml.dump, ellers designets kYaml).
 *   css                        → stilene for begge (legg dem i kortets shadow root OG i Tilpass-arkets rot).
 *
 * Datakilde = samme skjema og semantikk som ki-energi-card-strom: verdien til et punkt er egen entitet for valgt enhet/
 * periode/pris (kr: cost_daily|cost_monthly, Norgespris: *_alt eller entitet + alt_suffix hvis den finnes; kWh:
 * energy_daily|energy_monthly), ellers summen av underpunktene. Totalen = totals.* (samme valg), ellers summen av
 * gruppe 1. Mangler entitet/verdi → «–». Ingen mock-verdier.
 * Sikringsskap (gruppe 2 +): valgfrie felt per kurs `fuse` (f.eks. «K3»), `amp` (standard 16) og `power` (effekt-
 * entitet, W/kW). Uten `power` er belastningen snitteffekt i dag = energy_daily / timer siden midnatt.
 * Klasser har prefiks `sk-k` (07-sikring.js bruker `sk-` i sin egen shadow root), attributter `data-sk-*`.
 */
(function () {
  const M = window.MSH;
  if (!M || M.stromKurser) return;
  const esc = M.esc || ((s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  const ic = (n, s, st) => (M.icon ? M.icon(n, s, st) : `<ha-icon icon="${esc(n)}"></ha-icon>`);
  const T = M.theme || null;
  const wA = (a) => (T && T.whiteA ? T.whiteA(a) : `rgba(255,255,255,${a})`); // ki-hex-ok: reserve uten MSH.theme
  const bA = (a) => (T && T.blackA ? T.blackA(a) : `rgba(0,0,0,${a})`); // ki-hex-ok: reserve uten MSH.theme
  const accTxt = (c) => (T && T.accentText ? T.accentText(c) : c);
  const clone = (o) => JSON.parse(JSON.stringify(o));

  /* ------------------------------------------------------------ KDEF (designet, brukerens nåværende YAML) */
  const KE = (cs, es) => ({ cost_daily: 'sensor.um_daily_cost_' + cs, cost_monthly: 'sensor.um_monthly_cost_' + cs, energy_daily: 'sensor.' + (es || cs) + '_energy_daily', energy_monthly: 'sensor.' + (es || cs) + '_energy_monthly' });
  const KL = (name, icon, slug, es) => ({ name, ...(icon ? { icon: 'mdi:' + icon } : {}), ...KE(slug, es) });
  const KG = (name, icon, color, children, slug, es) => ({ name, icon: 'mdi:' + icon, color: 'var(--' + color + ')', ...(slug ? KE(slug, es) : {}), ...(children ? { children } : {}) });
  const KDEF = {
    title: 'Energi', price_entity: 'sensor.totalpris_strompris_kroner', price_entity_alt: 'sensor.norgespris_pris_na', alt_suffix: '_norgespris',
    default_period: 'day', default_unit: 'kr', default_price: 'alt', default_view: 'enkel', remember_view: true,
    totals: { cost_daily: 'sensor.um_daily_cost_strommaler', cost_monthly: 'sensor.um_monthly_cost_strommaler' },
    bereder: 'sensor.ki_bereder', laster: 'sensor.ki_laster', logg: 'sensor.ki_beslutningslogg', status: 'sensor.ki_energi_status', tau: 'sensor.ki_tidskonstanter',
    groups: [
      { title: 'Kategorier', subtitle: 'På tvers av rom', items: [
        KG('Oppvarming', 'heating-coil', 'red', [
          KG('Panelovner', 'radiator', 'red', [KL('Stue panelovn', 'radiator', 'stue_panelovn'), KL('Kjøkken panelovn', 'radiator', 'kjokken_panelovn'), KL('Cybele panelovn', 'radiator', 'cybele_panelovn'), KL('Trappegang panelovn', 'radiator', 'trappegang_panelovn'), KL('Sebastian panelovn', 'radiator', 'sebastian_panelovn')]),
          KG('Gulvvarme', 'heating-coil', 'orange', [KL('Bad gulvvarme', 'heating-coil', 'bad_gulvvarme'), KL('Kjøkken gulvvarme', 'heating-coil', 'kjokken_gulvvarme'), KL('Vaskegang gulvvarme', 'heating-coil', 'vaskegang_gulvvarme'), KL('Do gulvvarme', 'heating-coil', 'do_gulvvarme')]),
          KG('Håndklevarmer', 'hanger', 'pink', [KL('Håndklevarmer', 'hanger', 'hanklevarmer')]),
          KG('Øvrig varme', 'fire', 'red', [KL('Stue oljefyr', 'fire', 'stue_oljefyr'), KL('Baderomsvifte', 'fan', 'baderomsvifte'), KL('Varmtvannsbereder', 'water-boiler', 'varmtvannsbereder_enhet')]),
        ], 'oppvarming_kurs', 'oppvarming'),
        KG('Belysning', 'lamp', 'yellow', null, 'lights', 'lys'),
        KG('Hvitvarer', 'fridge', 'blue', [KL('Kjøleskap', 'fridge', 'kjoleskap'), KL('Fryseskap', 'snowflake', 'fryseskap'), KL('Komfyr', 'stove', 'komfyr'), KL('Platetopp', 'pot-steam', 'platetopp'), KL('Oppvaskmaskin', 'dishwasher', 'oppvaskmaskin_enhet'), KL('Vaskemaskin', 'washing-machine', 'vaskemaskin_enhet'), KL('Mikrobølgeovn', 'microwave', 'mikrobolgeovn'), KL('Kaffetrakter', 'coffee-maker', 'kaffetrakter'), KL('Vannkoker', 'kettle', 'vannkoker'), KL('Brødrister', 'toaster-oven', 'brodrister')], 'hvitvarer'),
        KG('Data og nettverk', 'nas', 'gray800', [
          KG('Servere', 'server', 'gray800', [KL('Server rack', 'server', 'server_rack'), KL('Stue server rack', 'server', 'stue_server_rack'), KL('Do server', 'server', 'do_server')]),
          KG('3D-printere', 'printer-3d', 'blue', [KL('Creality K2', 'printer-3d', 'creality_k2')]),
          KG('Stikkontakter', 'power-socket-de', 'purple', [['Pult stikkontakt', 'pult_stikkontakt'], ['TV stikkontakt', 'tv_stikkontakt'], ['Stue takstikkontakt', 'stue_takstikkontakt'], ['Stue piano stikkontakt', 'stue_piano_stikkontakt'], ['Spisebord stikkontakt', 'spisebord_stikkontakt'], ['Seng stikkontakt', 'seng_stikkontakt'], ['Cybele soverom stikkontakt', 'cybele_soverom_stikkontakt'], ['Rune kontor stikkontakt', 'rune_kontor_stikkontakt'], ['Rune soverom stikkontakt', 'rune_soverom_stikkontakt'], ['Verandastikkontakt', 'verandastikkontakt']].map(([n, s]) => KL(n, 'power-socket-de', s))),
        ], 'data'),
      ] },
      { title: 'Kurser', subtitle: 'Per sikringskurs', items: [
        KG('Varmtvannsbereder', 'water-boiler', 'orange', [KL('Varmtvannsbereder', 'water-boiler', 'varmtvannsbereder_enhet')], 'varmtvannsbereder_kurs'),
        KG('Stue', 'sofa', 'orange', [KL('Stue panelovn', null, 'stue_panelovn'), KL('Stue oljefyr', null, 'stue_oljefyr'), KL('Stue takstikkontakt', null, 'stue_takstikkontakt'), KL('Stue piano stikkontakt', null, 'stue_piano_stikkontakt'), KL('TV stikkontakt', null, 'tv_stikkontakt'), KL('Stue server rack', null, 'stue_server_rack')], 'stue_kurs'),
        KG('Kjøkken', 'knife', 'green', [['Kjøkken panelovn', 'kjokken_panelovn'], ['Kjøkken gulvvarme', 'kjokken_gulvvarme'], ['Kjøleskap', 'kjoleskap'], ['Fryseskap', 'fryseskap'], ['Komfyr', 'komfyr'], ['Platetopp', 'platetopp'], ['Mikrobølgeovn', 'mikrobolgeovn'], ['Kaffetrakter', 'kaffetrakter'], ['Vannkoker', 'vannkoker'], ['Brødrister', 'brodrister'], ['Spisebord stikkontakt', 'spisebord_stikkontakt']].map(([n, s]) => KL(n, null, s)), 'kjokken_kurs'),
        KG('Soverom og bad', 'bed-double-outline', 'purple', [['Cybele panelovn', 'cybele_panelovn'], ['Sebastian panelovn', 'sebastian_panelovn'], ['Bad gulvvarme', 'bad_gulvvarme'], ['Baderomsvifte', 'baderomsvifte'], ['Håndklevarmer', 'hanklevarmer'], ['Seng stikkontakt', 'seng_stikkontakt'], ['Cybele soverom stikkontakt', 'cybele_soverom_stikkontakt'], ['Rune soverom stikkontakt', 'rune_soverom_stikkontakt']].map(([n, s]) => KL(n, null, s)), 'soverom_og_bad_kurs'),
        KG('Vaskegang og do', 'shower', 'pink', [KL('Vaskegang gulvvarme', null, 'vaskegang_gulvvarme'), KL('Do gulvvarme', null, 'do_gulvvarme'), KL('Do server', null, 'do_server')], 'vaskegang_kurs', 'vaskegang_og_do_kurs'),
        KG('Gang og bod', 'door', 'blue', [KL('Trappegang panelovn', null, 'trappegang_panelovn'), KL('Server rack', null, 'server_rack')], 'gang_og_bod_kurs'),
        KG('Vaskemaskin', 'washing-machine', 'pink', [KL('Vaskemaskin', 'washing-machine', 'vaskemaskin_enhet')], 'vaskemaskin_kurs'),
        KG('Oppvaskmaskin', 'dishwasher', 'green', [KL('Oppvaskmaskin', 'dishwasher', 'oppvaskmaskin_enhet')], 'oppvaskmaskin_kurs'),
      ] },
    ],
  };
  // Designets palett (KCOL) = fallback for temafargene (config lagrer var(--navn)).
  const KCOL = { red: '#f07a6a', orange: '#f2b46f', pink: '#f28ac9', yellow: '#f2d26f', blue: '#73aef0', green: '#6fcf9c', purple: '#9a8ff0', gray800: '#c8c8c8', gray600: '#7f7f7f', teal: '#5fc4c4' }; // ki-hex-ok: fargepalett
  const DEFCOL = 'var(--gray800, #c8c8c8)'; // ki-hex-ok: designets standardfarge
  const kCol = (c) => {
    if (!c) return null;
    const s = String(c).trim(), m = /^var\(--([\w-]+)\)$/.exec(s);
    return m ? `var(--${m[1]}, ${KCOL[m[1]] || '#c8c8c8'})` : s; // ki-hex-ok
  };
  const PINK = 'linear-gradient(160deg,#f28ac9,#f6c9c4)'; // ki-hex-ok: rosa aksentflate (designet)
  const INK = 'var(--ki-on-accent, rgba(50,38,44,.95))';

  /* ------------------------------------------------------------ norm */
  function norm(k) {
    if (k && typeof k === 'object' && !Array.isArray(k) && !Array.isArray(k.groups) && k.kurs !== undefined && !('groups' in k)) k = k.kurs; // config med kurs
    if (!k || typeof k !== 'object' || !Array.isArray(k.groups)) return clone(KDEF);
    const t = clone(k);
    delete t.type;
    const fixList = (l) => (Array.isArray(l) ? l.filter((n) => n && typeof n === 'object') : []);
    const fix = (n) => { if (n.children != null) { n.children = fixList(n.children); n.children.forEach(fix); } return n; };
    t.groups = t.groups.filter((g) => g && typeof g === 'object').map((g) => ({ ...g, items: fixList(g.items).map(fix) }));
    return t;
  }

  /* ------------------------------------------------------------ verdier (samme logikk som ki-energi-card-strom) */
  const num = (hass, id) => {
    const st = id && hass && hass.states && hass.states[id];
    if (!st) return null;
    let v = parseFloat(st.state);
    if (!isFinite(v)) return null;
    const u = st.attributes && st.attributes.unit_of_measurement;
    if (u === 'Wh') v /= 1000;
    return v;
  };
  const finnKostnad = (hass, base, altBase, alt, suffix) => {
    if (!alt) return base;
    if (altBase) return altBase;
    if (suffix && base && hass && hass.states && hass.states[base + suffix]) return base + suffix;
    return base;
  };
  const entFor = (n, V) => {
    if (!n) return null;
    if (V.unit === 'kwh') return V.per === 'month' ? n.energy_monthly : n.energy_daily;
    return finnKostnad(V.hass, V.per === 'month' ? n.cost_monthly : n.cost_daily, V.per === 'month' ? n.cost_monthly_alt : n.cost_daily_alt, V.alt, V.suffix);
  };
  const valOf = (n, V) => {
    const own = num(V.hass, entFor(n, V));
    if (own !== null) return own;
    const kids = n.children || [];
    let sum = null;
    kids.forEach((c) => { const v = valOf(c, V); if (v !== null) sum = (sum || 0) + v; });
    return sum;
  };
  const fx = (n, d) => Number(n).toLocaleString('nb-NO', { minimumFractionDigits: d, maximumFractionDigits: d });
  const fmtV = (n, V) => (n == null ? '–' : `${fx(n, n >= 100 ? 0 : n >= 10 ? 1 : 2)} ${V.unit === 'kwh' ? 'kWh' : 'kr'}`);
  const pctS = (p) => (p == null ? '–' : `${Math.round(p)} %`);

  /* ------------------------------------------------------------ tilstand */
  const st = (host) => (host.__sk = host.__sk || { mem: {}, drag: null, swallow: 0 });
  const uiOf = (host) => host.ui || (host.ui = {});
  const saveUi = (host) => { try { if (typeof host.saveUi === 'function') host.saveUi(); } catch (e) { /* */ } };
  const hp = (host, t) => { try { if (typeof host.haptic === 'function') host.haptic(t); else if (M.haptic) M.haptic(t); } catch (e) { /* */ } };
  const harAlt = (K) => !!K.alt_suffix || !!K.price_entity_alt || (K.groups || []).some((g) => (g.items || []).some((i) => i.cost_daily_alt || i.cost_monthly_alt));
  function view(host) {
    const cfg = host.config || {}, K = norm(cfg.kurs), ui = uiOf(host), S = st(host);
    const mem = K.remember_view === false ? S.mem : ui;
    const unit = mem.kursUnit === 'kwh' || mem.kursUnit === 'kr' ? mem.kursUnit : K.default_unit === 'kwh' ? 'kwh' : 'kr';
    const per = mem.kursPer === 'month' || mem.kursPer === 'day' ? mem.kursPer : K.default_period === 'month' ? 'month' : 'day';
    const alt = harAlt(K) && (typeof mem.kursAlt === 'boolean' ? mem.kursAlt : (K.default_price || 'alt') === 'alt');
    return { K, cfg, ui, S, mem, unit, per, alt, hass: host.hass, suffix: K.alt_suffix };
  }
  // Rekkefølge: lagret (filtrert) + nye bakerst. Under dra: midlertidig rekkefølge.
  const ordOf = (stored, ids) => { const o = Array.isArray(stored) ? stored : []; return [...o.filter((x) => ids.includes(x)), ...ids.filter((x) => !o.includes(x))]; };
  const curOrd = (host, key, ids) => { const S = st(host); if (S.drag && S.drag.key === key && S.drag.order.some((x) => ids.includes(x))) return ordOf(S.drag.order, ids); return ordOf(((host.config || {}).ord || {})[key], ids); };
  const kursId = (gi, n) => (gi === 1 ? String(n.name || '') : `${gi}:${n.name || ''}`);

  // Fordelingen i toppkortet: kategoriene (gruppe 1) størst først; < 2 % (og en egen «Annet»-kategori) → «Annet»
  const ANNET_C = 'var(--gray600, #7a7a7a)'; // ki-hex-ok: designets «Annet»-farge
  function dist(R0) {
    const L = R0.items.map((n, i) => ({ l: String(n.name || ''), v: R0.vals[i], c: kCol(n.color) || DEFCOL })).filter((x) => x.v != null && x.v > 0);
    const tot = L.reduce((a, x) => a + x.v, 0);
    if (!(tot > 0)) return { tot: 0, L: [] };
    const out = []; let other = null;
    L.forEach((x) => { if ((x.v / tot) * 100 < 2 || /^annet$/i.test(x.l)) { if (!other) other = { l: 'Annet', v: 0, c: /^annet$/i.test(x.l) ? x.c : ANNET_C, annet: true }; if (/^annet$/i.test(x.l)) other.c = x.c; other.v += x.v; } else out.push(x); });
    if (other) out.push(other);
    out.sort((a, b) => b.v - a.v);
    out.forEach((x) => { x.p = (x.v / tot) * 100; });
    return { tot, L: out };
  }
  // Fiks 47 R: rader uten egen Norgespris-sensor bruker spotverdien – logg dem (bare i debug-modus, én gang per sett)
  let altLogged = '';
  function altLog(V, K) {
    if (!(M.debugOn && M.debugOn())) return;
    const miss = [];
    const walk = (n) => { ['cost_daily', 'cost_monthly'].forEach((f) => { const b = n[f]; if (!b) return; const alt = finnKostnad(V.hass, b, n[f + '_alt'], true, V.suffix); if (alt === b) miss.push(b); }); (n.children || []).forEach(walk); };
    (K.groups || []).forEach((g) => (g.items || []).forEach(walk));
    if (K.totals) walk(K.totals);
    const key = miss.join(',');
    if (key === altLogged) return;
    altLogged = key;
    if (miss.length) console.debug(`[ki-msh] Strøm → Kurser: ${miss.length} rader mangler Norgespris-sensor (${K.alt_suffix ? 'suffiks ' + K.alt_suffix : 'ingen alt_suffix'}) – bruker spotverdien:`, miss);
  }

  /* ------------------------------------------------------------ Kurser-fanen */
  const SECS = ['k_total', 'k_kat', 'k_kurs'];
  function inner(host) {
    const V = view(host), K = V.K, S = V.S, ui = V.ui;
    const hid = (V.cfg.hid || {});
    const sOrd = curOrd(host, 'sec-Kurser', SECS);
    const isDrag = (k, id) => !!S.drag && S.drag.key === k && S.drag.id === id;
    const kwh = V.unit === 'kwh', unitT = kwh ? 'kWh' : 'kr';
    const g0 = K.groups[0] || { title: 'Kategorier', subtitle: '', items: [] };
    const rowsOf = (g) => {
      const items = (g && g.items) || [];
      const vals = items.map((n) => valOf(n, V));
      const tot = vals.reduce((a, v) => a + (v || 0), 0);
      return { items, vals, tot, any: vals.some((v) => v !== null) };
    };
    const R0 = rowsOf(g0);
    const kidsOf = (n, c) => {
      const kids = (n.children || []).map((k, i) => ({ k, i, v: valOf(k, V) }));
      const ks = kids.reduce((a, x) => a + (x.v || 0), 0);
      kids.sort((a, b) => (a.v === null && b.v === null ? a.i - b.i : a.v === null ? 1 : b.v === null ? -1 : b.v - a.v));
      return kids.map(({ k, v }) => ({ l: k.name || '', icon: k.icon || n.icon || 'mdi:lightning-bolt', c: kCol(k.color) || c, v, p: ks > 0 && v !== null ? (v / ks) * 100 : null }));
    };

    /* --- k_total */
    const totId = (() => { const t = K.totals; if (!t) return null; if (kwh) return V.per === 'month' ? t.energy_monthly : t.energy_daily; return finnKostnad(V.hass, V.per === 'month' ? t.cost_monthly : t.cost_daily, V.per === 'month' ? t.cost_monthly_alt : t.cost_daily_alt, V.alt, V.suffix); })();
    const totS = num(V.hass, totId);
    const sumN = totS !== null ? totS : R0.any ? R0.tot : null;
    const month = new Date().toLocaleString('nb-NO', { month: 'long' });
    const sumLabel = V.per === 'month' ? month.charAt(0).toUpperCase() + month.slice(1) : 'I dag';
    const price = num(V.hass, V.alt ? K.price_entity_alt : K.price_entity);
    const chip = `${V.alt ? 'Norgespris' : 'Spotpris'} · ${price === null ? '–' : fx(price, 2) + ' kr/kWh'}`;
    // Fiks 47 Q: fordelingen (størst først, < 2 % slått sammen til «Annet»). Trykk på baren → forklaring; segment/rad → valg.
    const D = dist(R0);
    if (S.kbSel && !D.L.some((x) => x.l === S.kbSel)) S.kbSel = null;
    const kbOpen = !!S.kbOpen && D.L.length > 0, kbSel = S.kbSel || null;
    const selD = kbSel ? D.L.find((x) => x.l === kbSel) : null, big0 = D.L.find((x) => !x.annet) || D.L[0];
    const bigTxt = selD ? `${selD.l} står for ${Math.round(selD.p)} % av forbruket · ${fx(selD.v, 2)} ${unitT}` : big0 ? `Størst: ${big0.l} står for ${Math.round(big0.p)} % av forbruket` : 'Venter på sensordata';
    const stripe = D.L.length ? D.L.map((x) => `<span class="sk-kbs${kbSel && kbSel !== x.l ? ' dim' : ''}" data-sk-act="kbs" data-sk-v="${esc(x.l)}" title="${esc(x.l)} · ${Math.round(x.p)} %" style="flex:${+x.v.toFixed(4)};background:${esc(x.c)}"></span>`).join('') : '<span class="sk-kstr0"></span>';
    const legend = kbOpen ? `<div class="sk-kleg" data-key="sk-kleg">${D.L.map((x) => { const on = kbSel === x.l, dim = kbSel && !on; return `<button class="sk-klr${on ? ' on' : ''}${dim ? ' dim' : ''}" data-sk-act="kbs" data-sk-v="${esc(x.l)}" aria-pressed="${on}"><span class="sk-kld" style="background:${esc(x.c)}"></span><span class="sk-kln">${esc(x.l)}</span><span class="sk-klp">${Math.round(x.p)} %</span></button>`; }).join('')}</div>` : '';
    if (V.alt && !kwh) altLog(V, K);
    const secAttr = (id) => { const i = sOrd.indexOf(id); return `class="sk-ksec${isDrag('sec-Kurser', id) ? ' sk-klift' : ''}" data-rk="sec-Kurser" data-rid="${id}" data-sk-rk="sec-Kurser" data-sk-id="${id}" data-key="sk-${id}" style="order:${i + 1}${hid[id] ? ';display:none' : ''}"`; };
    const tot = `<div ${secAttr('k_total')}>
      <div class="sk-ktot">
        <span class="sk-ktot-top"><span class="sk-k13">${esc(sumLabel)}</span>${harAlt(K) ? `<button type="button" class="sk-kchip" data-sk-act="alt" title="Bytt prismodell" aria-label="Bytt til ${V.alt ? 'spotpris' : 'Norgespris'}">${esc(chip)}</button>` : `<span class="sk-kchip statisk">${esc(chip)}</span>`}</span>
        <span class="sk-ktot-big"><span class="sk-ksum">${sumN === null ? '–' : fx(sumN, sumN >= 100 ? 0 : 2)}</span><span class="sk-kunit">${unitT}</span></span>
        <span class="sk-k13" data-sk-info>${esc(bigTxt)}</span>
        <button type="button" class="sk-kbarb" data-sk-act="kb" title="Vis fordeling" aria-expanded="${kbOpen}"${D.L.length ? '' : ' disabled'}><span class="sk-kstripe">${stripe}</span></button>
        ${legend}
      </div>
    </div>`;

    /* --- k_kat */
    // Fiks 47 P: felles segmentkontroll (M.segment, 05-segment.js) – sentrert tekst, like brede valg, 4 px luft
    const seg = (act, cur, opts) => (M.segment ? M.segment.html(opts.map(([l, v]) => ({ v, l })), cur, { act, actAttr: 'data-sk-act', vAttr: 'data-sk-v', haptic: false, cls: 'sk-kseg', key: act })
      : `<div class="sk-kseg" data-glass-drag="x">${opts.map(([l, v]) => `<button class="${cur === v ? 'on' : ''}" data-sk-act="${act}" data-sk-v="${v}">${l}</button>`).join('')}</div>`);
    const catIds = R0.items.map((n) => String(n.name || ''));
    const cOrd = curOrd(host, 'cat', catIds);
    const firstWithKids = R0.items.find((n) => (n.children || []).length);
    const selC = typeof ui.kursCat === 'string' ? ui.kursCat : firstWithKids ? String(firstWithKids.name || '') : '';
    const tiles = R0.items.map((n, i) => {
      const id = catIds[i], c = kCol(n.color) || DEFCOL, v = R0.vals[i], p = R0.tot > 0 && v !== null ? (v / R0.tot) * 100 : null, on = id === selC && (n.children || []).length > 0, drag = isDrag('cat', id);
      return `<button class="sk-ktile${on ? ' on' : ''}${drag ? ' sk-klift' : ''}" data-sk-act="cat" data-sk-v="${esc(id)}" data-sk-rk="cat" data-sk-id="${esc(id)}" data-key="sk-cat-${esc(id)}" style="order:${cOrd.indexOf(id) + 1};--c:${esc(c)};--ct:${esc(accTxt(c))}">
        <span class="sk-ktile-top"><span class="sk-kicw">${ic(n.icon || 'mdi:lightning-bolt', 22)}</span><span class="sk-kpct">${pctS(p)}</span></span>
        <span class="sk-ktl">${esc(n.name || '')}</span>
        <span class="sk-ktv">${fmtV(v, V)}</span>
        <span class="sk-kbar"><span style="width:${p == null ? 0 : Math.max(p, 2)}%"></span></span>
      </button>`;
    }).join('');
    const selN = R0.items.find((n, i) => catIds[i] === selC && (n.children || []).length);
    const kidRow = (k, cls) => `<div class="${cls}"><span class="sk-kkic" style="color:${esc(accTxt(k.c))}">${ic(k.icon, cls === 'sk-kkid' ? 20 : 18)}</span>`
      + (cls === 'sk-kkid'
        ? `<span class="sk-kkmid"><span class="sk-kkln"><span class="sk-kkl">${esc(k.l)}</span><span class="sk-kkv">${fmtV(k.v, V)}</span></span><span class="sk-kbar sk-kbar-s"><span style="width:${k.p == null ? 0 : Math.max(k.p, 1.5)}%;background:${esc(k.c)}"></span></span></span><span class="sk-kkp">${pctS(k.p)}</span>`
        : `<span class="sk-kcl">${esc(k.l)}</span><span class="sk-kcv">${fmtV(k.v, V)}</span><span class="sk-kcp">${pctS(k.p)}</span>`) + '</div>';
    const brk = selN ? `<div class="sk-kbrk" data-key="sk-brk-${esc(selC)}">
        <div class="sk-kbrk-hd"><span>${esc(selN.name || '')} fordelt</span><button class="sk-kx" data-sk-act="catx" title="Lukk">${ic('mdi:close', 18)}</button></div>
        ${kidsOf(selN, kCol(selN.color) || DEFCOL).map((k) => kidRow(k, 'sk-kkid')).join('')}
      </div>` : '';
    const kat = `<div ${secAttr('k_kat')}>
      <div class="sk-kgrid">${seg('unit', V.unit, [['Kroner', 'kr'], ['kWh', 'kwh']])}${seg('per', V.per, [['I dag', 'day'], ['Måneden', 'month']])}</div>
      <div class="sk-khd"><span class="sk-kht">${esc(g0.title || 'Kategorier')}</span><span class="sk-khs">${esc([g0.subtitle, R0.any ? fmtV(R0.tot, V) : '–'].filter(Boolean).join(' · '))}</span></div>
      <div class="sk-kgrid sk-ktiles">${tiles}</div>
      ${brk}
    </div>`;

    /* --- k_kurs (gruppe 2 = Sikringsskap, flere grupper som egne lister) */
    const open = ui.kursOpen && typeof ui.kursOpen === 'object' ? ui.kursOpen : null;
    const hrs = Math.max(0.25, (Date.now() - new Date().setHours(0, 0, 0, 0)) / 3600000);
    const cirList = (g, gi) => {
      const R = rowsOf(g), ids = R.items.map((n) => kursId(gi, n)), o = curOrd(host, 'kurs', ids.slice());
      const firstOpen = R.items.findIndex((n) => (n.children || []).length);
      const list = R.items.map((n, i) => {
        const id = ids[i], idx = o.indexOf(id), c = kCol(n.color) || DEFCOL, kids = kidsOf(n, c), v = R.vals[i];
        const isOpen = kids.length > 0 && (open ? !!open[id] : gi === 1 && i === firstOpen);
        const amp = +n.amp > 0 ? +n.amp : 16, cap = amp * 0.23;
        let kw = null;
        if (n.power) { const p = num(V.hass, n.power), stp = V.hass && V.hass.states && V.hass.states[n.power], u = stp && stp.attributes && stp.attributes.unit_of_measurement; if (p !== null) kw = u === 'kW' ? p : p / 1000; }
        else { const e = num(V.hass, n.energy_daily); if (e !== null) kw = e / hrs; }
        const load = kw === null ? 0 : kw / cap, lc = load > 0.7 ? 'rgb(240 120 100)' : load > 0.4 ? 'rgb(242 176 79)' : 'rgb(110 200 160)';
        const fuse = n.fuse || 'K' + (i * 2 + 1);
        const drag = isDrag('kurs', id);
        return `<div class="sk-kcir${idx ? ' sk-kbt' : ''}${drag ? ' sk-klift' : ''}" data-sk-rk="kurs" data-sk-g="${gi}" data-sk-id="${esc(id)}" data-key="sk-kurs-${esc(id)}" style="order:${idx + 1};--lc:${lc}">
          <button class="sk-kcbtn" data-sk-act="kurs" data-sk-v="${esc(id)}">
            <span class="sk-kfuse"><span>${esc(fuse)}</span><span class="sk-klever"></span></span>
            <span class="sk-kcmid">
              <span class="sk-kcln"><span class="sk-kcn">${esc(n.name || '')}</span><span class="sk-kcval">${fmtV(v, V)}</span></span>
              <span class="sk-kcld"><span class="sk-kticks">${Array.from({ length: 12 }, (_, j) => `<span${j / 12 < load ? ' class="on"' : ''}></span>`).join('')}</span><span class="sk-kload">${kw === null ? '–' : fx(kw, 1)} / ${fx(cap, 1)} kW</span></span>
            </span>
            <span class="sk-kchev${isOpen ? ' open' : ''}" style="opacity:${kids.length ? 1 : 0}">${ic('mdi:chevron-down', 22)}</span>
          </button>
          ${isOpen ? `<div class="sk-kcids">${kids.map((k) => kidRow(k, 'sk-kcid')).join('')}</div>` : ''}
        </div>`;
      }).join('');
      return { R, list };
    };
    const cg = K.groups.slice(1).map((g, j) => ({ g, gi: j + 1, ...cirList(g, j + 1) }));
    const kurs = `<div ${secAttr('k_kurs')}>
      ${cg.length ? cg.map(({ g, gi, R, list }) => `<div class="sk-khd" data-key="sk-khd-${gi}"><span class="sk-kht">${gi === 1 ? 'Sikringsskap' : esc(g.title || '')}</span><span class="sk-khs">${esc([g.subtitle, R.any ? fmtV(R.tot, V) : '–'].filter(Boolean).join(' · '))}</span></div>
      <div class="sk-kbox" data-key="sk-kbox-${gi}">${list || '<div class="sk-kempty">Ingen kurser</div>'}</div>`).join('') : `<div class="sk-khd"><span class="sk-kht">Sikringsskap</span><span class="sk-khs">–</span></div><div class="sk-kbox"><div class="sk-kempty">Ingen kurser</div></div>`}
    </div>`;
    return tot + kat + kurs;
  }
  function html(host) {
    return `<div class="sk-kroot${host.anim === false || (host.config && host.config.anim === false) ? ' sk-knoanim' : ''}" data-sk-root>${inner(host)}</div>`;
  }
  const rootIn = (el) => (el && el.matches && el.matches('[data-sk-root]') ? el : el && el.querySelector ? el.querySelector('[data-sk-root]') : null);
  const local = (host, el) => {
    const r = rootIn(el);
    if (!r || !M.morph) { try { host.render(); } catch (e) { /* */ } return; }
    r.classList.toggle('sk-knoanim', host.anim === false || (host.config && host.config.anim === false));
    M.morph(r, inner(host));
    glass(host, r);
  };
  const glassOn = (host) => { if (host.glass === false || (host.config && host.config.glass === false)) return false; try { return localStorage.getItem('hjem-glass-anim') !== 'off'; } catch (e) { return true; } };
  const glass = (host, r) => { if (!M.glassDrag || !r) return; r.querySelectorAll('[data-glass-drag]').forEach((c) => { try { M.glassDrag(c, { axis: 'x', enabled: () => glassOn(host) }); } catch (e) { /* */ } }); };

  /* ------------------------------------------------------------ hold 400 ms + dra (fliser, kurser, seksjoner) */
  function saveOrd(host, key, order) {
    const ord = { ...(((host.config || {}).ord) || {}), [key]: order };
    if (typeof host.setCfg === 'function') host.setCfg({ ord });
  }
  function startHold(host, el, it, e) {
    const S = st(host), key = it.dataset.skRk, id = it.dataset.skId, grp = it.dataset.skG;
    if (key === 'sec-Kurser' && typeof host.secHold === 'function') { host.secHold(e, 'Kurser', id, it); return; }
    const sx = e.clientX, sy = e.clientY, pid = e.pointerId;
    const sibs = () => Array.from((rootIn(el) || el).querySelectorAll(`[data-sk-rk="${key}"]`)).filter((n) => (grp == null || n.dataset.skG === grp));
    const ids0 = sibs().sort((a, b) => (+a.style.order || 0) - (+b.style.order || 0)).map((n) => n.dataset.skId);
    let on = false, done = false;
    const H = {};
    const move = (x, y) => {
      if (!on) { if (Math.hypot(x - sx, y - sy) > 8) cleanup(false); return; }
      const hit = sibs().find((n) => { const r = n.getBoundingClientRect(); return r.width && y >= r.top && y <= r.bottom && (key !== 'cat' || (x >= r.left && x <= r.right)); });
      const rid = hit && hit.dataset.skId;
      if (rid && rid !== id && S.drag) {
        const cur = S.drag.order.slice(), ti = cur.indexOf(rid);
        if (ti < 0) return;
        const o = cur.filter((x2) => x2 !== id); o.splice(ti, 0, id);
        S.drag.order = o; hp(host, 'selection'); local(host, el);
      }
    };
    H.pm = (ev) => { if (ev.pointerId !== pid) return; if (on) { if (ev.cancelable) ev.preventDefault(); ev.stopPropagation(); } move(ev.clientX, ev.clientY); };
    H.tm = (ev) => { const t = ev.touches && ev.touches[0]; if (!t) return; if (on) { if (ev.cancelable) ev.preventDefault(); ev.stopPropagation(); } move(t.clientX, t.clientY); };
    H.up = () => cleanup(true);
    H.cancel = () => { if (!on) cleanup(false); }; // pointercancel under aktivt dra ignoreres (touch fortsetter)
    H.key = (ev) => { if (ev.key === 'Escape' && on) { ev.preventDefault(); cleanup(false, true); } };
    const kill = (c) => { c.stopPropagation(); c.preventDefault(); };
    function cleanup(commit, esc2) {
      if (done) return; done = true;
      clearTimeout(H.t);
      window.removeEventListener('pointermove', H.pm, true); window.removeEventListener('pointerup', H.up, true); window.removeEventListener('pointercancel', H.cancel, true);
      window.removeEventListener('touchmove', H.tm, { capture: true }); window.removeEventListener('touchend', H.up, true); window.removeEventListener('touchcancel', H.up, true); window.removeEventListener('keydown', H.key, true);
      if (!on) return;
      on = false;
      it.style.touchAction = ''; it.__mshTA = undefined;
      setTimeout(() => { window.__tabReorder = false; }, 50);
      S.swallow = Date.now() + 350;
      window.addEventListener('click', kill, { capture: true, once: true }); setTimeout(() => window.removeEventListener('click', kill, true), 350);
      const order = S.drag ? S.drag.order : null;
      S.drag = null;
      if (commit && !esc2 && order && order.join('\u0001') !== ids0.join('\u0001')) {
        hp(host, 'light');
        // lagre hele rekkefølgen (andre grupper beholdes for ord.kurs)
        let full = order;
        if (key === 'kurs') { const pv = ((host.config || {}).ord || {}).kurs, prev = Array.isArray(pv) ? pv : []; full = [...order, ...prev.filter((x) => !order.includes(x))]; }
        saveOrd(host, key, full);
      }
      local(host, el);
    }
    H.t = setTimeout(() => {
      on = true; window.__tabReorder = true;
      hp(host, 'medium');
      S.drag = { key, id, order: ids0.slice() };
      it.style.touchAction = 'none'; it.__mshTA = 'none';
      try { it.setPointerCapture(pid); } catch (x) { /* */ }
      local(host, el);
    }, 400);
    window.addEventListener('pointermove', H.pm, { capture: true, passive: false });
    window.addEventListener('pointerup', H.up, true); window.addEventListener('pointercancel', H.cancel, true);
    window.addEventListener('touchmove', H.tm, { capture: true, passive: false });
    window.addEventListener('touchend', H.up, true); window.addEventListener('touchcancel', H.up, true);
    window.addEventListener('keydown', H.key, true);
  }

  function bind(host, el) {
    if (!el) return;
    const r = rootIn(el);
    glass(host, r);
    el.__skHost = host;
    if (el.__skBound) return;
    el.__skBound = true;
    const H = () => el.__skHost || host;
    el.addEventListener('pointerdown', (e) => {
      // Fiks 47 R: pris-pillen er en knapp – ikke hold/dra og ikke Bubble-sveip (stopPropagation)
      if (e.target.closest && e.target.closest('[data-sk-act="alt"]')) { e.stopPropagation(); return; }
      const it = e.target.closest && e.target.closest('[data-sk-rk]');
      if (!it || !el.contains(it) || e.button) return;
      if (e.target.closest('input,textarea,select,[data-glass-drag]')) return;
      e.stopPropagation();
      if (window.__ki_hold) return;
      window.__ki_hold = true; setTimeout(() => { window.__ki_hold = false; }, 0);
      startHold(H(), el, it, e);
    });
    el.addEventListener('touchstart', (e) => { const it = e.target.closest && e.target.closest('[data-sk-rk]'); if (it && el.contains(it)) e.stopPropagation(); }, { passive: true });
    el.addEventListener('touchmove', (e) => { const h = H(), S = st(h); if (S.drag) { e.stopPropagation(); if (e.cancelable) e.preventDefault(); } }, { passive: false });
    el.addEventListener('click', (e) => {
      const host2 = H(), S = st(host2);
      if (S.swallow > Date.now()) { e.stopPropagation(); e.preventDefault(); return; }
      const b = e.target.closest && e.target.closest('[data-sk-act]');
      if (!b || !el.contains(b)) return;
      const act = b.dataset.skAct, v = b.dataset.skV, V = view(host2), ui = V.ui;
      if (act === 'unit' || act === 'per') {
        const k = act === 'unit' ? 'kursUnit' : 'kursPer';
        if (V.mem[k] === v && V[act] === v) return;
        V.mem[k] = v; hp(host2, 'selection');
      } else if (act === 'alt') {
        e.stopPropagation();
        V.mem.kursAlt = !V.alt; hp(host2, 'selection');
      } else if (act === 'kb') { // Fiks 47 Q: trykk på baren → vis/skjul forklaringen
        e.stopPropagation();
        S.kbOpen = !S.kbOpen; if (!S.kbOpen) S.kbSel = null; hp(host2, 'selection');
      } else if (act === 'kbs') { // segment / rad → velg kategorien (samme igjen = fjern valg)
        e.stopPropagation();
        S.kbOpen = true; S.kbSel = S.kbSel === v ? null : v; hp(host2, 'selection');
      } else if (act === 'cat') {
        const n = (V.K.groups[0] && V.K.groups[0].items || []).find((x) => String(x.name || '') === v);
        if (!n || !(n.children || []).length) { hp(host2, 'light'); return; }
        const firstWithKids = (V.K.groups[0].items || []).find((x) => (x.children || []).length);
        const cur = typeof ui.kursCat === 'string' ? ui.kursCat : firstWithKids ? String(firstWithKids.name || '') : '';
        ui.kursCat = cur === v ? '' : v; hp(host2, 'selection');
      } else if (act === 'catx') {
        ui.kursCat = ''; hp(host2, 'light');
      } else if (act === 'kurs') {
        const gi = (b.closest('[data-sk-g]') || {}).dataset ? +b.closest('[data-sk-g]').dataset.skG : 1;
        const g = V.K.groups[gi]; if (!g) return;
        const items = g.items || [], idx = items.findIndex((n) => kursId(gi, n) === v), n = items[idx];
        if (!n || !(n.children || []).length) { hp(host2, 'light'); return; }
        if (!ui.kursOpen || typeof ui.kursOpen !== 'object') { // første trykk: materialiser standard (første kurs med underpunkter åpen)
          const fo = (V.K.groups[1] && V.K.groups[1].items || []).find((x) => (x.children || []).length);
          ui.kursOpen = fo ? { [kursId(1, fo)]: true } : {};
        }
        ui.kursOpen = { ...ui.kursOpen, [v]: !ui.kursOpen[v] }; hp(host2, 'selection');
      } else return;
      saveUi(host2);
      local(host2, el);
    });
  }

  /* ------------------------------------------------------------ YAML */
  const prune = (o) => {
    if (Array.isArray(o)) return o.map(prune);
    if (o && typeof o === 'object') { const r = {}; Object.entries(o).forEach(([k, v]) => { if (v === undefined || v === null || v === '') return; const p = prune(v); if (p && typeof p === 'object' && !Array.isArray(p) && !Object.keys(p).length) return; r[k] = p; }); return r; }
    return o;
  };
  // Designets kYaml (reserve når MSH.yaml mangler)
  const kYaml = (o, ind = 0) => { const p = ' '.repeat(ind), q = (v) => (typeof v === 'string' && /[:#{}[\],&*!|>'"%@`]|^\s|\s$|^$|^(true|false|null|~|yes|no|on|off|[-+]?[\d.]+)$/i.test(v) ? JSON.stringify(v) : String(v));
    return Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => (Array.isArray(v) && !v.length ? `${p}${k}: []` : Array.isArray(v) ? `${p}${k}:\n${v.map((it) => (it && typeof it === 'object' ? p + '  - ' + kYaml(it, ind + 4).slice(ind + 4) : `${p}  - ${q(it)}`)).join('\n')}` : typeof v === 'object' ? `${p}${k}:\n${kYaml(v, ind + 2)}` : `${p}${k}: ${q(v)}`)).join('\n'); };
  function toYaml(kurs) {
    const obj = { type: 'custom:ki-energi-card-strom', ...prune(norm(kurs)) };
    if (M.yaml && M.yaml.dump) { try { return String(M.yaml.dump(obj)).replace(/\n+$/, '') + '\n'; } catch (e) { /* */ } }
    return kYaml(obj) + '\n';
  }

  /* ------------------------------------------------------------ editor */
  const ENTF = [['cost_daily', 'Kostnad dag'], ['cost_monthly', 'Kostnad måned'], ['energy_daily', 'Energi dag'], ['energy_monthly', 'Energi måned']];
  const COLS = Object.keys(KCOL);
  const FIELDS = [[['title'], 'Tittel'], [['price_entity'], 'Pris-entitet'], [['price_entity_alt'], 'Alternativ pris (Norgespris)'], [['alt_suffix'], 'Suffiks for alternativ pris'], [['totals', 'cost_daily'], 'Total kostnad dag'], [['totals', 'cost_monthly'], 'Total kostnad måned']];
  const ADV = [[['status'], 'Status'], [['laster'], 'Laster'], [['logg'], 'Beslutningslogg'], [['tau'], 'Tidskonstanter'], [['bereder'], 'Bereder'], [['totals', 'energy_daily'], 'Totalt forbruk dag (kWh)'], [['totals', 'energy_monthly'], 'Totalt forbruk måned (kWh)']];
  const SEGS = [['default_period', 'Standard periode', [['day', 'Dag'], ['month', 'Måned']]], ['default_unit', 'Standard enhet', [['kr', 'Kroner'], ['kwh', 'kWh']]], ['default_price', 'Standard pris', [['alt', 'Norgespris'], ['main', 'Spotpris']]]];
  const edSt = (host) => (host.__skEd = host.__skEd || { open: {}, edit: null, adv: false, yaml: false });
  const getP = (o, p) => p.reduce((a, k) => (a || {})[k], o);
  const nodeAt = (t, p) => { let n = t.groups[p[0]].items[p[1]]; for (let i = 2; i < p.length; i++) n = n.children[p[i]]; return n; };
  const listAt = (t, p) => (p.length === 2 ? t.groups[p[0]].items : nodeAt(t, p.slice(0, -1)).children);
  const draftKurs = (d) => (d && typeof d === 'object' && !Array.isArray(d.groups) && 'kurs' in d ? d.kurs : d);
  const entList = (hass) => {
    if (!hass || !hass.states) return [];
    return Object.keys(hass.states).filter((id) => { if (!/^(sensor|input_number)\./.test(id)) return false; const u = (hass.states[id].attributes || {}).unit_of_measurement; return /kwh|wh|kr|nok|øre/i.test(String(u || '')) || /cost|energy|pris|price|kostnad/.test(id); }).sort().slice(0, 2000);
  };
  function edInner(host, draft) {
    const T0 = norm(draftKurs(draft)), E = edSt(host);
    const inp = (cls, path, label, v, ph, list) => `<label class="sk-kfl"><span class="sk-klb">${esc(label)}</span><input class="${cls}" data-sk-f="${esc(path)}" value="${esc(v || '')}" spellcheck="false"${ph ? ` placeholder="${esc(ph)}"` : ''}${list ? ' list="sk-kents"' : ''}></label>`;
    const fld = ([path, label]) => inp('sk-kin', path.join('.'), label, getP(T0, path), '', /entity|totals|status|laster|logg|tau|bereder/.test(path.join('.')));
    const segs = SEGS.map(([key, title, opts]) => { const cur = T0[key] == null ? opts[0][0] : T0[key];
      return `<div class="sk-kfl"><span class="sk-klb">${esc(title)}</span><div class="sk-keseg" data-glass-drag="x">${opts.map(([v, l]) => `<button class="${cur === v ? 'on' : ''}" data-sk-e="seg" data-sk-k="${key}" data-sk-v="${v}">${esc(l)}</button>`).join('')}</div></div>`; }).join('');
    const groups = T0.groups.map((g, gi) => {
      const rows = [];
      const walk = (list, path, depth, parentCol) => list.forEach((n, i) => {
        const p = [...path, i], key = p.join('.'), kids = n.children || [], open = !!E.open[key], ed = E.edit === key, c = kCol(n.color) || parentCol;
        let r = `<div class="sk-kerw" data-key="sk-e-${key}">
          <div class="sk-kerow${ed ? ' ed' : depth ? ' sub' : ''}" style="padding-left:${6 + depth * 18}px">
            <button class="sk-ketg" data-sk-e="toggle" data-sk-p="${key}" title="Vis underpunkter"><span class="sk-kechev${open ? ' open' : ''}" style="opacity:${kids.length ? 1 : 0}">${ic('mdi:chevron-right', 20)}</span></button>
            <span class="sk-keic" style="--c:${esc(c)};--ct:${esc(accTxt(c))}">${ic(n.icon || 'mdi:lightning-bolt', 19)}</span>
            <span class="sk-kenm" data-sk-e="toggle" data-sk-p="${key}"><span class="sk-ken">${esc(n.name || 'Uten navn')}</span><span class="sk-kem">${esc(kids.length ? `${kids.length} underpunkt${kids.length > 1 ? 'er' : ''}` : (n.cost_daily || 'Ingen entitet valgt'))}</span></span>
            <button class="sk-kemv${i ? '' : ' off'}" data-sk-e="up" data-sk-p="${key}" title="Flytt opp">${ic('mdi:arrow-up', 20)}</button>
            <button class="sk-kemv${i < list.length - 1 ? '' : ' off'}" data-sk-e="down" data-sk-p="${key}" title="Flytt ned">${ic('mdi:arrow-down', 20)}</button>
            <button class="sk-keed${ed ? ' on' : ''}" data-sk-e="edit" data-sk-p="${key}" title="Rediger">${ic('mdi:pencil', 19)}</button>
          </div>`;
        if (ed) {
          const cols = [['', 'Arv'], ...COLS.map((k) => [k, k])].map(([k, label]) => { const on = k ? n.color === `var(--${k})` : !n.color;
            return `<button class="sk-kcol${on ? ' on' : ''}${k ? '' : ' inh'}" data-sk-e="color" data-sk-p="${key}" data-sk-v="${k}" title="${esc(label)}"${k ? ` style="background:var(--${k}, ${KCOL[k]})"` : ''}></button>`; }).join('');
          const ninp = (f, label, ph) => `<label class="sk-kfl sk-kfl-s"><span class="sk-klb sk-klb-s">${esc(label)}</span><input class="sk-kin2" data-sk-nf="${f}" data-sk-p="${key}" value="${esc(n[f] == null ? '' : n[f])}" placeholder="${esc(ph || 'sensor.…')}" spellcheck="false"${ph ? '' : ' list="sk-kents"'}></label>`;
          r += `<div class="sk-kepn">
            <label class="sk-kfl"><span class="sk-klb">Navn</span><input class="sk-kin2 sk-kin2-l" data-sk-nf="name" data-sk-p="${key}" value="${esc(n.name || '')}"></label>
            <label class="sk-kfl"><span class="sk-klb">Ikon (mdi:, hass:, phu: …)</span><span class="sk-kicr"><button class="sk-kicp" data-sk-e="icon" data-sk-p="${key}" title="Velg ikon">${ic(n.icon || 'mdi:lightning-bolt', 22)}</button><input class="sk-kin2 sk-kin2-l" data-sk-nf="icon" data-sk-p="${key}" value="${esc(n.icon || '')}" placeholder="mdi:lightning-bolt" spellcheck="false"></span></label>
            <span class="sk-klb">Farge</span>
            <div class="sk-kcols">${cols}</div>
            <span class="sk-klb sk-klb-t">Entiteter</span>
            ${ENTF.map(([f, label]) => ninp(f, label)).join('')}
            ${gi >= 1 && depth === 0 ? `<span class="sk-klb sk-klb-t">Sikringsskap</span>${ninp('fuse', 'Kurs (f.eks. K3)', 'K' + (i * 2 + 1))}${ninp('amp', 'Sikring (A)', '16')}${ninp('power', 'Effekt-entitet (W/kW)')}` : ''}
            <div class="sk-kebts"><button class="sk-keadd" data-sk-e="addChild" data-sk-p="${key}">${ic('mdi:subdirectory-arrow-right', 18)}Legg til underpunkt</button><button class="sk-kedel" data-sk-e="del" data-sk-p="${key}" title="Slett">${ic('mdi:delete', 20)}</button></div>
          </div>`;
        }
        rows.push(r + '</div>');
        if (open) walk(kids, p, depth + 1, c);
      });
      walk(g.items || [], [gi], 0, DEFCOL);
      return `<div class="sk-kegrp" data-key="sk-g-${gi}">
        <div class="sk-kegh">
          <div class="sk-kegt"><input class="sk-kgti" data-sk-gf="title" data-sk-g="${gi}" value="${esc(g.title || '')}" placeholder="Gruppenavn"><input class="sk-kgsu" data-sk-gf="subtitle" data-sk-g="${gi}" value="${esc(g.subtitle || '')}" placeholder="Undertittel"></div>
          <button class="sk-kgb${gi ? '' : ' off'}" data-sk-e="gup" data-sk-g="${gi}" title="Flytt opp">${ic('mdi:arrow-up', 22)}</button>
          <button class="sk-kgb del" data-sk-e="gdel" data-sk-g="${gi}" title="Slett gruppe">${ic('mdi:delete', 22)}</button>
        </div>
        ${rows.join('')}
        <button class="sk-kepadd" data-sk-e="add" data-sk-g="${gi}">${ic('mdi:plus', 20)}Legg til punkt</button>
      </div>`;
    }).join('');
    const ents = entList(host.hass);
    return `<div class="sk-kinfo">${ic('mdi:file-tree', 22, 'color:var(--ki-blue-text, rgb(115 185 242))')}<span>Full kontroll over kategorier og kurser – samme oppsett som ki-energi-card-strom. Trykk blyanten for å redigere navn, ikon, farge og entiteter.</span></div>
      <span class="sk-kcap">Pris og totaler</span>
      <div class="sk-kcard">
        ${FIELDS.map(fld).join('')}
        ${segs}
        <button class="sk-kadvb" data-sk-e="adv"><span>Avansert (status, laster, logg …)</span><span class="sk-kadvc${E.adv ? ' open' : ''}">${ic('mdi:chevron-down', 22)}</span></button>
        ${E.adv ? ADV.map(fld).join('') : ''}
      </div>
      ${groups}
      <button class="sk-kaddg" data-sk-e="addGroup">${ic('mdi:playlist-plus', 22)}Legg til gruppe</button>
      <div class="sk-kebr"><button class="sk-kebb" data-sk-e="yaml">${ic('mdi:code-tags', 20)}${E.yaml ? 'Skjul YAML' : 'Vis YAML'}</button><button class="sk-kebb" data-sk-e="reset">${ic('mdi:restart', 20)}Tilbakestill kurser</button></div>
      ${E.yaml ? `<pre class="sk-kyaml" data-sk-yaml>${esc(toYaml(T0))}</pre>` : ''}
      <datalist id="sk-kents" data-nomorph data-key="sk-kents">${ents.map((id) => `<option value="${esc(id)}"></option>`).join('')}</datalist>`;
  }
  function editorHtml(host, draft) {
    return `<div class="sk-ked" data-sk-ed>${edInner(host, draft)}</div>`;
  }
  const edRoot = (el) => (el && el.matches && el.matches('[data-sk-ed]') ? el : el && el.querySelector ? el.querySelector('[data-sk-ed]') : null);
  function editorBind(host, el, draft, onChange) {
    if (!el) return;
    // A sender inn sitt utkast; er det samme objekt som sist, beholdes vår nyeste versjon (A kan ligge etter).
    if (!(el.__skIn === draft && el.__skHas)) { el.__skIn = draft; el.__skCur = draftKurs(draft); }
    el.__skHas = true;
    el.__skHost = host; el.__skOn = onChange;
    const r0 = edRoot(el);
    if (M.glassDrag && r0) r0.querySelectorAll('[data-glass-drag]').forEach((c) => { try { M.glassDrag(c, { axis: 'x', enabled: () => glassOn(host) }); } catch (e) { /* */ } });
    if (el.__skEdBound) return;
    el.__skEdBound = true;
    const H = () => el.__skHost;
    const rerender = () => { const r = edRoot(el); if (!r || !M.morph) return; M.morph(r, edInner(H(), el.__skCur)); if (M.glassDrag) r.querySelectorAll('[data-glass-drag]').forEach((c) => { try { M.glassDrag(c, { axis: 'x', enabled: () => glassOn(H()) }); } catch (e) { /* */ } }); };
    const emit = (t) => { el.__skCur = t; rerender(); try { if (typeof el.__skOn === 'function') el.__skOn(t); } catch (e) { console.error('[ki-msh] strom-kurser onChange', e); } };
    const mut = (fn) => { const t = norm(el.__skCur); fn(t); emit(t); };
    const P = (s) => String(s || '').split('.').filter((x) => x !== '').map(Number);
    const E = () => edSt(H());
    el.addEventListener('input', (e) => {
      const t = e.target; if (!t || !t.dataset) return;
      const v = t.value;
      if (t.dataset.skF) { const path = t.dataset.skF.split('.'); mut((k) => { let o = k; path.slice(0, -1).forEach((x) => { if (!o[x] || typeof o[x] !== 'object') o[x] = {}; o = o[x]; }); if (v) o[path[path.length - 1]] = v; else delete o[path[path.length - 1]]; }); }
      else if (t.dataset.skGf) { const gi = +t.dataset.skG; mut((k) => { if (k.groups[gi]) k.groups[gi][t.dataset.skGf] = v; }); }
      else if (t.dataset.skNf) {
        const p = P(t.dataset.skP), f = t.dataset.skNf;
        mut((k) => { const nd = nodeAt(k, p); if (!nd) return; if (f === 'name') nd.name = v; else if (f === 'amp') { const n = parseFloat(String(v).replace(',', '.')); if (v && isFinite(n)) nd.amp = n; else delete nd.amp; } else if (v) nd[f] = v; else delete nd[f]; });
      }
    });
    el.addEventListener('click', (e) => {
      const b = e.target.closest && e.target.closest('[data-sk-e]');
      if (!b || !el.contains(b)) return;
      const host2 = H(), act = b.dataset.skE, ES = E(), key = b.dataset.skP, p = P(key), gi = +b.dataset.skG;
      const h = (t) => hp(host2, t);
      if (act === 'toggle') { const k = norm(el.__skCur), nd = nodeAt(k, p); if (!nd || !(nd.children || []).length) return; h('selection'); ES.open = { ...ES.open, [key]: !ES.open[key] }; rerender(); }
      else if (act === 'edit') { h('selection'); ES.edit = ES.edit === key ? null : key; rerender(); }
      else if (act === 'up' || act === 'down') {
        const i = p[p.length - 1], k0 = norm(el.__skCur), L0 = listAt(k0, p), j = act === 'up' ? i - 1 : i + 1;
        if (j < 0 || j >= L0.length) return;
        h('selection'); ES.edit = null;
        // åpne-tilstand følger punktene
        const base = p.slice(0, -1).join('.'), a = base + '.' + i, c = base + '.' + j, swap = {};
        Object.keys(ES.open).forEach((x) => { const y = x === a || x.startsWith(a + '.') ? c + x.slice(a.length) : x === c || x.startsWith(c + '.') ? a + x.slice(c.length) : x; swap[y] = ES.open[x]; });
        ES.open = swap;
        mut((k) => { const L = listAt(k, p); [L[j], L[i]] = [L[i], L[j]]; });
      } else if (act === 'color') { h('selection'); const kk = b.dataset.skV; mut((k) => { const nd = nodeAt(k, p); if (kk) nd.color = `var(--${kk})`; else delete nd.color; }); }
      else if (act === 'icon') {
        if (!M.iconPicker || !M.iconPicker.open) return;
        h('light');
        const k0 = norm(el.__skCur), nd = nodeAt(k0, p);
        try { const pr = M.iconPicker.open({ value: (nd && nd.icon) || '', title: 'Velg ikon', onPick: () => {} }); if (pr && pr.then) pr.then((v) => { if (v == null) return; mut((k) => { const n2 = nodeAt(k, p); if (!n2) return; if (v) n2.icon = v; else delete n2.icon; }); }); } catch (x) { /* */ }
      } else if (act === 'addChild') {
        h('success');
        const k0 = norm(el.__skCur), n0 = nodeAt(k0, p), len = (n0.children || []).length;
        ES.open = { ...ES.open, [key]: true }; ES.edit = key + '.' + len;
        mut((k) => { const nd = nodeAt(k, p); nd.children = [...(nd.children || []), { name: 'Nytt punkt', icon: 'mdi:lightning-bolt' }]; });
      } else if (act === 'del') {
        h('warning'); ES.edit = null;
        const pre = key, o2 = {};
        Object.keys(ES.open).forEach((x) => { if (!(x === pre || x.startsWith(pre + '.'))) o2[x] = ES.open[x]; });
        ES.open = o2;
        mut((k) => { listAt(k, p).splice(p[p.length - 1], 1); });
      } else if (act === 'add') {
        h('success');
        const k0 = norm(el.__skCur); ES.edit = gi + '.' + ((k0.groups[gi] && k0.groups[gi].items) || []).length;
        mut((k) => { k.groups[gi].items.push({ name: 'Nytt punkt', icon: 'mdi:lightning-bolt', color: 'var(--blue)' }); });
      } else if (act === 'gdel') { h('warning'); ES.edit = null; ES.open = {}; mut((k) => { k.groups.splice(gi, 1); }); }
      else if (act === 'gup') { if (!gi) return; h('selection'); ES.edit = null; ES.open = {}; mut((k) => { [k.groups[gi - 1], k.groups[gi]] = [k.groups[gi], k.groups[gi - 1]]; }); }
      else if (act === 'addGroup') { h('success'); mut((k) => { k.groups.push({ title: 'Ny gruppe', subtitle: '', items: [] }); }); }
      else if (act === 'seg') { const kk = b.dataset.skK, v = b.dataset.skV, cur = norm(el.__skCur)[kk]; if (cur === v) return; h('selection'); mut((k) => { k[kk] = v; }); }
      else if (act === 'adv') { h('selection'); ES.adv = !ES.adv; rerender(); }
      else if (act === 'yaml') { h('selection'); ES.yaml = !ES.yaml; rerender(); }
      else if (act === 'reset') { h('warning'); ES.edit = null; ES.open = {}; emit(null); }
    });
  }

  /* ------------------------------------------------------------ CSS */
  const S1 = 'var(--ki-surface, #3d3d3d)'; // ki-hex-ok: token med mørk fallback
  const css = `
    .sk-kroot{display:flex;flex-direction:column;gap:12px;min-width:0}
    .sk-kroot button,.sk-ked button{font:inherit;color:inherit;border:0;background:none;padding:0;margin:0;cursor:pointer;-webkit-tap-highlight-color:transparent}
    .sk-ksec{display:flex;flex-direction:column;gap:12px;border-radius:26px;transition:transform .18s,box-shadow .18s;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;min-width:0}
    .sk-klift{transform:scale(1.03);box-shadow:0 14px 30px ${bA(0.45)};position:relative;z-index:5}
    @keyframes sk-kfade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
    .sk-ktot{background:${PINK};color:${INK};border-radius:26px;padding:16px 18px;display:flex;flex-direction:column;gap:4px;animation:sk-kfade .3s ease}
    .sk-ktot-top{display:flex;justify-content:space-between;align-items:flex-start;gap:8px}
    .sk-k13{font-size:13px}
    .sk-kroot .sk-kchip{padding:5px 11px;border:0;border-radius:11px;background:${bA(0.16)};font-size:12px;font-weight:600;line-height:1.2;color:inherit;white-space:nowrap;cursor:pointer;flex:none;transition:transform .15s;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
    .sk-kroot button.sk-kchip:active{transform:scale(.96)}
    .sk-kroot .sk-kchip:focus{outline:none}.sk-kroot .sk-kchip:focus-visible{outline:2px solid ${INK};outline-offset:2px}
    .sk-kroot .sk-kchip.statisk{cursor:default}
    .sk-kroot .sk-kbarb{position:relative;display:block;width:100%;box-sizing:content-box;padding:16px 0;margin:-6px 0 -16px;background:transparent;cursor:pointer;-webkit-tap-highlight-color:transparent}
    .sk-kroot .sk-kbarb:focus{outline:none}.sk-kroot .sk-kbarb:focus-visible .sk-kstripe{outline:2px solid ${INK};outline-offset:2px}
    .sk-kroot .sk-kbarb .sk-kstripe{margin-top:0}
    .sk-kbs{transition:opacity .2s}.sk-kbs.dim{opacity:.35}
    .sk-kleg{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:6px 12px;margin-top:10px;position:relative;animation:sk-kfade .2s ease}
    .sk-kroot .sk-klr{display:flex;align-items:center;gap:8px;min-width:0;height:32px;box-sizing:border-box;padding:0 10px;border:0;border-radius:16px;font-size:13px;color:${INK};text-align:left;background:rgba(60,40,50,.08);transition:background .2s,opacity .2s}
    .sk-kroot .sk-klr.on{background:rgba(60,40,50,.18)}.sk-kroot .sk-klr.dim{opacity:.6}
    .sk-kld{width:10px;height:10px;border-radius:5px;flex:none}.sk-klr.on .sk-kld{box-shadow:0 0 0 2px rgba(50,38,44,.5)}
    .sk-kln{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .sk-klp{font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap}
    .sk-ktot-big{display:flex;align-items:baseline;gap:6px}
    .sk-ksum{font-size:36px;font-weight:600;line-height:1.1;font-variant-numeric:tabular-nums}
    .sk-kunit{font-size:16px;font-weight:500}
    .sk-kstripe{display:flex;gap:2px;height:12px;margin-top:10px;border-radius:999px;overflow:hidden}
    .sk-kstr0{flex:1;background:rgba(60,40,50,.18)}
    .sk-kgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
    ${M.segment ? M.segment.css : ''}
    .sk-kroot .ki-seg.sk-kseg{background:var(--ki-surface-2, #3d3d3d)}
    .sk-kroot .ki-seg.sk-kseg>.ki-seg-b.on{color:${INK}}
    .sk-khd{display:flex;justify-content:space-between;align-items:baseline;gap:8px;padding:8px 6px 0}
    .sk-kht{font-size:15px;font-weight:600;color:var(--ki-text, #fafafa)}
    .sk-khs{font-size:12px;color:var(--ki-text-2, #b8b8b8);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
    .sk-kroot .sk-ktile{display:flex;flex-direction:column;align-items:flex-start;gap:2px;padding:14px;min-height:150px;box-sizing:border-box;border-radius:24px;text-align:left;min-width:0;background:${S1};color:var(--ki-text, #fafafa);transition:background .25s,box-shadow .25s,transform .18s;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}
    .sk-kroot .sk-ktile:active{transform:scale(.97)}
    .sk-kroot .sk-ktile.on{background:color-mix(in oklab, var(--c) 22%, ${S1});box-shadow:inset 0 0 0 1.5px var(--c)}
    .sk-kroot .sk-ktile.sk-klift{transform:scale(1.03);box-shadow:0 14px 30px ${bA(0.45)};position:relative;z-index:5}
    .sk-kroot .sk-ktile.on.sk-klift{box-shadow:inset 0 0 0 1.5px var(--c),0 14px 30px ${bA(0.45)}}
    .sk-ktile-top{display:flex;justify-content:space-between;align-items:flex-start;width:100%}
    .sk-kicw{width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:color-mix(in oklab, var(--c) 20%, var(--ki-surface-3, #2e2e2e));color:var(--ct)}
    .sk-kpct{font-size:12px;font-weight:600;color:var(--ct)}
    .sk-ktl{margin-top:auto;font-size:13px;color:var(--ki-text-1, #d6d6d6);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .sk-ktv{font-size:22px;font-weight:500;font-variant-numeric:tabular-nums;white-space:nowrap}
    .sk-kbar{display:block;width:100%;height:4px;border-radius:2px;background:${bA(0.3)};overflow:hidden;margin-top:6px}
    .sk-kbar>span{display:block;height:100%;background:var(--c);border-radius:2px}
    .sk-kbar-s{margin-top:0}
    .sk-kbar-s>span{border-radius:3px}
    .sk-kbrk{background:${S1};border-radius:24px;padding:6px 16px;animation:sk-kfade .25s ease}
    .sk-kbrk-hd{display:flex;align-items:center;justify-content:space-between;min-height:40px;font-size:13px;color:var(--ki-text-2, #b8b8b8)}
    .sk-kroot .sk-kx{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--ki-text, #fafafa)}
    .sk-kroot .sk-kx:hover{background:${wA(0.08)}}
    .sk-kkid{display:flex;align-items:center;gap:12px;min-height:54px;border-top:1px solid ${wA(0.08)}}
    .sk-kkic{width:24px;display:flex;justify-content:center;flex:none}
    .sk-kkmid{flex:1;min-width:0;display:flex;flex-direction:column;gap:5px}
    .sk-kkln{display:flex;justify-content:space-between;gap:8px}
    .sk-kkl{font-size:14px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
    .sk-kkv{font-size:14px;font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap}
    .sk-kkp{width:34px;text-align:right;font-size:12px;color:var(--ki-text-2, #b8b8b8);flex:none}
    .sk-kbox{display:flex;flex-direction:column;background:${S1};border-radius:26px;padding:6px 14px}
    .sk-kempty{min-height:56px;display:flex;align-items:center;font-size:13px;color:var(--ki-text-2, #b8b8b8)}
    .sk-kcir{border-radius:0;transition:transform .18s,box-shadow .18s,background .18s;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}
    .sk-kcir.sk-kbt{border-top:1px solid ${wA(0.08)}}
    .sk-kcir.sk-klift{border-radius:18px;background:var(--ki-surface-2, #4a4a4a);padding:0 10px;margin:0 -10px}
    .sk-kroot .sk-kcbtn{display:flex;align-items:center;gap:12px;width:100%;min-height:68px;text-align:left;color:var(--ki-text, #fafafa)}
    .sk-kfuse{width:40px;height:48px;border-radius:10px;background:var(--ki-surface-3, #2a2a2a);border:1px solid ${wA(0.08)};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;flex:none;box-sizing:border-box}
    .sk-kfuse>span:first-child{font-size:10px;font-weight:600;color:var(--ki-text-2, #b8b8b8)}
    .sk-klever{width:12px;height:18px;border-radius:3px;background:linear-gradient(180deg,#e6e6e6 50%,#9a9a9a 50%);box-shadow:0 0 0 2px var(--lc)} /* ki-hex-ok: sikringsvippe (fysisk) */
    .sk-kcmid{flex:1;min-width:0;display:flex;flex-direction:column;gap:5px}
    .sk-kcln{display:flex;justify-content:space-between;gap:8px}
    .sk-kcn{font-size:15px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
    .sk-kcval{font-size:15px;font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap}
    .sk-kcld{display:flex;align-items:center;gap:8px}
    .sk-kticks{flex:1;display:flex;gap:2px;height:8px}
    .sk-kticks>span{flex:1;border-radius:2px;background:${bA(0.3)}}
    .sk-kticks>span.on{background:var(--lc)}
    .sk-kload{font-size:11px;color:var(--ki-text-2, #b8b8b8);white-space:nowrap;font-variant-numeric:tabular-nums}
    .sk-kchev{display:flex;color:var(--ki-text-2, #b8b8b8);transition:transform .25s;flex:none}
    .sk-kchev.open{transform:rotate(180deg)}
    .sk-kcids{display:flex;flex-direction:column;gap:2px;margin:0 0 12px 52px;animation:sk-kfade .25s ease}
    .sk-kcid{display:flex;align-items:center;gap:10px;min-height:36px}
    .sk-kcid .sk-kkic{width:22px}
    .sk-kcl{flex:1;font-size:13px;color:var(--ki-text-1, #e1e1e1);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .sk-kcv{font-size:13px;font-weight:500;font-variant-numeric:tabular-nums;white-space:nowrap}
    .sk-kcp{width:34px;text-align:right;font-size:11px;color:var(--ki-text-2, #b8b8b8);flex:none}
    .sk-knoanim,.sk-knoanim *{animation:none !important}

    /* ---- Kurser-editoren (Tilpass → Kurser) ---- */
    .sk-ked{display:grid;grid-template-columns:minmax(0,1fr);grid-auto-rows:max-content;gap:8px;min-width:0;color:var(--ki-text, #fafafa)}
    .sk-kinfo{display:flex;align-items:flex-start;gap:12px;padding:14px 16px;border-radius:24px;background:rgb(115 185 242 / 0.1);box-shadow:inset 0 0 0 1px rgb(115 185 242 / 0.22)}
    .sk-kinfo>span{font-size:13px;line-height:1.45;color:var(--ki-text-1, #c7c7c7);text-wrap:pretty}
    .sk-kcap{font-size:13px;font-weight:500;color:var(--ki-text-mid, #979797);padding:10px 8px 2px}
    .sk-kcard{display:flex;flex-direction:column;gap:10px;padding:14px;border-radius:24px;background:var(--ki-surface, #3a3a3a)}
    .sk-kfl{display:flex;flex-direction:column;gap:6px;min-width:0}
    .sk-kfl-s{gap:4px}
    .sk-klb{font-size:12px;color:var(--ki-text-mid, #979797);padding-left:4px}
    .sk-klb-s{font-size:11px}
    .sk-klb-t{padding:4px 4px 0}
    .sk-ked input{height:44px;padding:0 14px;border-radius:14px;border:0;outline:none;color:var(--ki-text, #fafafa);font:inherit;font-size:14px;min-width:0;width:100%;box-sizing:border-box}
    .sk-ked .sk-kin{background:var(--ki-surface-2, #2a2a2a)}
    .sk-ked .sk-kin2{background:var(--ki-surface, #2a2a2a);height:40px;padding:0 12px;border-radius:12px;font-size:13px}
    .sk-ked .sk-kin2-l{height:44px;padding:0 14px;border-radius:14px;font-size:14px}
    .sk-keseg{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:2px;padding:3px;border-radius:20px;background:var(--ki-surface-2, #2a2a2a)}
    .sk-ked .sk-keseg>button{display:flex;align-items:center;justify-content:center;text-align:center;min-width:0;white-space:nowrap;height:40px;border-radius:18px;font-size:13px;font-weight:500;color:var(--ki-text-2, #afafaf);transition:background .25s}
    .sk-ked .sk-keseg>button.on{background:${PINK};color:var(--ki-on-accent, #2f2f2f)}
    .sk-ked .sk-kadvb{display:flex;align-items:center;gap:8px;min-height:44px;padding:0 4px;text-align:left}
    .sk-kadvb>span:first-child{flex:1;font-size:14px;font-weight:500}
    .sk-kadvc{display:flex;color:var(--ki-text-mid, #979797);transition:transform .25s}
    .sk-kadvc.open{transform:rotate(180deg)}
    .sk-kegrp{display:flex;flex-direction:column;gap:6px;padding:10px;border-radius:28px;background:var(--ki-surface, #2f2f2f);box-shadow:inset 0 0 0 1px ${wA(0.05)};margin-top:6px}
    .sk-kegh{display:flex;align-items:center;gap:6px;padding:2px 2px 6px}
    .sk-kegt{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}
    .sk-ked .sk-kgti{height:40px;padding:0 12px;border-radius:12px;background:var(--ki-surface-2, #3a3a3a);font-size:16px;font-weight:600}
    .sk-ked .sk-kgsu{height:34px;padding:0 12px;border-radius:10px;background:var(--ki-surface-2, #333);color:var(--ki-text-1, #c7c7c7);font-size:13px}
    .sk-ked .sk-kgb{width:36px;height:40px;display:grid;place-items:center;color:var(--ki-text-1, #c7c7c7);flex:none}
    .sk-ked .sk-kgb.off{color:var(--ki-text-lo, #5a5a5a)}
    .sk-ked .sk-kgb.del{color:var(--ki-red-text, rgb(240 120 100))}
    .sk-kerw{display:flex;flex-direction:column;gap:6px}
    .sk-kerow{display:flex;align-items:center;gap:8px;min-height:56px;padding-right:4px;border-radius:18px;background:var(--ki-surface-2, #3a3a3a);transition:background .2s}
    .sk-kerow.sub{background:var(--ki-surface-2, #353535)}
    .sk-kerow.ed{background:var(--ki-surface-3, #454545)}
    .sk-ked .sk-ketg{width:24px;height:40px;flex:none;display:grid;place-items:center}
    .sk-kechev{display:flex;color:var(--ki-text-mid, #979797);transition:transform .2s}
    .sk-kechev.open{transform:rotate(90deg)}
    .sk-keic{width:34px;height:34px;border-radius:17px;flex:none;display:grid;place-items:center;background:color-mix(in oklab, var(--c) 22%, var(--ki-surface-3, #2a2a2a));color:var(--ct)}
    .sk-kenm{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px;cursor:pointer}
    .sk-ken{font-size:14px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .sk-kem{font-size:11px;color:var(--ki-text-mid, #979797);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .sk-ked .sk-kemv{width:36px;height:40px;flex:none;display:grid;place-items:center;color:var(--ki-text-1, #c7c7c7)}
    .sk-ked .sk-kemv.off{color:var(--ki-text-lo, #5a5a5a)}
    .sk-ked .sk-keed{width:40px;height:40px;flex:none;border-radius:20px;display:grid;place-items:center;color:var(--ki-text-1, #c7c7c7)}
    .sk-ked .sk-keed.on{background:${PINK};color:var(--ki-on-accent, #2f2f2f)}
    .sk-kepn{display:flex;flex-direction:column;gap:10px;padding:14px;border-radius:20px;background:var(--ki-surface-2, #404040);animation:sk-kfade .2s ease}
    .sk-kicr{display:flex;align-items:center;gap:8px}
    .sk-ked .sk-kicp{width:44px;height:44px;border-radius:14px;flex:none;background:var(--ki-surface, #2a2a2a);display:grid;place-items:center}
    .sk-kcols{display:flex;flex-wrap:wrap;gap:8px;padding:0 4px}
    .sk-ked .sk-kcol{width:30px;height:30px;border-radius:15px;flex:none;transition:box-shadow .15s}
    .sk-ked .sk-kcol.inh{background:repeating-linear-gradient(45deg,var(--ki-ctrl, #555) 0 4px,var(--ki-surface, #3a3a3a) 4px 8px)}
    .sk-ked .sk-kcol.on{box-shadow:0 0 0 2px var(--ki-popup, #282828),0 0 0 4px var(--ki-text, #fafafa)}
    .sk-kebts{display:flex;gap:8px;padding-top:4px}
    .sk-ked .sk-keadd{flex:1;height:44px;border-radius:22px;background:var(--ki-surface, #2f2f2f);display:flex;align-items:center;justify-content:center;gap:6px;font-size:13px;font-weight:500}
    .sk-ked .sk-keadd:active{transform:scale(.97)}
    .sk-ked .sk-kedel{width:44px;height:44px;border-radius:22px;background:rgba(240,120,100,.15);color:var(--ki-red-text, rgb(240 120 100));display:grid;place-items:center;flex:none}
    .sk-ked .sk-kedel:active{transform:scale(.94)}
    .sk-ked .sk-kepadd{height:48px;border-radius:18px;display:flex;align-items:center;justify-content:center;gap:6px;font-size:13px;font-weight:500;color:var(--ki-pink-text, rgb(242 133 201))}
    .sk-ked .sk-kepadd:active{transform:scale(.98)}
    .sk-ked .sk-kaddg{height:52px;border-radius:26px;background:var(--ki-surface, #3a3a3a);display:flex;align-items:center;justify-content:center;gap:8px;font-size:14px;font-weight:500}
    .sk-ked .sk-kaddg:active{transform:scale(.98)}
    .sk-kebr{display:flex;gap:8px}
    .sk-ked .sk-kebb{flex:1;height:48px;border-radius:24px;background:var(--ki-surface, #3a3a3a);display:flex;align-items:center;justify-content:center;gap:6px;font-size:13px;font-weight:500}
    .sk-kyaml{margin:0;max-height:360px;overflow:auto;padding:14px;border-radius:18px;background:var(--ki-surface-3, #1f1f1f);color:var(--ki-text-1, #c7c7c7);font:12px/1.5 ui-monospace,Menlo,monospace;white-space:pre;user-select:text;-webkit-user-select:text}
    .sk-ked :is(button,span,div){-webkit-tap-highlight-color:transparent}
  `;

  M.stromKurser = { KDEF, norm, html, bind, css, editorHtml, editorBind, toYaml, _entFor: entFor, _valOf: valOf };
})();
