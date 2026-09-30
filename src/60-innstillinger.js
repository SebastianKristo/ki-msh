/* KI MSH · Innstillinger (#settings, msh-innstillinger-card) – fiks 25.5 + 26.15, etter prompt-teksten «Innstillinger v2»
 * (designfila finnes ikke i repoet). Étt kort i Bubble-popupen #settings (mal A).
 *
 * #settings (fiks 26.15): brukerens importerte ki-cards-popup «Innstillinger» (gap-card + ki-natt-card + ki-tabs-card med
 * ki-varsling-card) erstattes av DETTE kortet: MSH.POPUP_SUPERSEDE['#settings'] gjør den importerte popupen inaktiv
 * («Erstattet av Innstillinger», «Bruk egen» i Egne popups gir den tilbake), og MSH.POPUP_EXTRA['#settings'] flytter
 * oppsettet over (MSH.innstExtra): ki-natt-card natt → natt, helg (privatmodus-bryter) → privat, vekking → vekking;
 * ki-tabs-card tabs[i] (ki-varsling-card) → tabs[i] { key, title, filter } – fanene som svarer til Automasjoner/Varsler/Strøm
 * fordeles automatisk (filteret enheter/ikke_enheter/plattform tas ikke med, så ingen enheter:-lister i YAML), andre faner
 * beholder filteret; ekstra → rows.include (+ rows.move), skjul → rows.exclude, navn/undertekst/ikoner → rows.names/subs/icons.
 * gap-card fjernes. Strategien (04-strategy) genererer #settings med dette kortet (card_id pop-innstillinger).
 * Dashbordinnstillingene (msh-settings-card: Tilpass Hjem/navbar/header, HA, Områder, Liquid Glass, Enheter) går ikke tapt:
 * de ligger nederst i popupen under «Dashbord» (innebygd msh-settings-card; `dashbord: false` skjuler dem), og Tilpass-arkene
 * nås i tillegg fra Mer → Tilpass. (Ikke en fjerde fane: fire tekstfaner får ikke plass ved 360 px.) #innstillinger (25.5) genereres bare når noe peker dit, med samme card_id.
 *
 * Autokonfig (ingen mock – tomtilstand + «Velg entiteter» når noe mangler):
 *   Kilde: hass.entities med platform ki_notifications (KI Varslinger og sikkerhet), ki_energi (Strøm) og ki_utelys.
 *   Én enhet = én regel → én rad: hovedbryteren (erMaster-regelen fra ki-varsling-card); uten hovedbryter vises alle
 *   bryterne. ki_energi: bare varslingsbrytere (varsel|varsler|spor_), ingen master-sammenslåing (sidestilte valg).
 *   Navn/undertekst/ikon: KI_VARS_TEKST → friendly_name delt på « - » → enhetsnavnet. Fane: ki_energi → Strøm,
 *   ellers KI_VARS_TEKST-feltet fane ('auto' → Automasjoner, 'push' → Varsler) → enhetens model/entry_type → Varsler.
 *   Toppkort: natt = switch.nattmodus / input_boolean.nattmodus / input_boolean.*natt* · privat = input_boolean.privatmodus
 *   / input_boolean.*priva* (også «privace») · vekking = input_datetime.vekking / sensor.*vekking*neste*.
 * Config:
 *   natt · privat · vekking (entitetene i toppkortet)
 *   tabs: [{ key, title?, hidden?, filter?: { enheter, ikke_enheter, plattform } }]   (automasjoner · varsler · strom ·
 *     egne faner med filter). Eldre tab_order/tab_hidden/tab_names leses når tabs mangler.
 *   rows: { exclude: [device_id|entity_id], move: { id: 'auto'|'push'|'strom'|<fane> }, include: [automation.x],
 *     names: { id: navn }, subs: { id: undertekst }, icons: { id: ikon }, order: { fane: [id …] } }
 *   tab_labels (ikon|name|icon=begge) · start_tab · sok · av_forst · haptikk · scene (auto|dag|natt) · animasjoner (true) · dashbord (true)
 *   gap · pad_top · pad_bottom
 * «Tilpass Innstillinger» (kortets ark og GUI-editoren, samme skjema): Faner · Rader · Entiteter · Avansert (tekstfaner).
 * Privatmodus-kortet (26.15): overvåkingskamera som sveiper (av) / vipper ned med lukker og grønn prikk (på), lås-klikk
 * og ring ved bytte – bare transform/opacity, prefers-reduced-motion og «Animasjoner» respekteres.
 */
(function () {
  const M = window.MSH;
  if (!M) return;
  const esc = M.esc, C = M.C;

  /* ============================================================ KI Varslinger og sikkerhet (fra ki-cards 83-ki-varsling-card.js) */
  const KI_VARS_PLATTFORM = ['ki_notifications', 'ki_energi', 'ki_utelys'];
  /* Navn, beskrivelse, ikon og fane per regel (ki-varsling-card: KI_VARS_TEKST; nytt felt fane: 'auto' | 'push' | 'strom'). */
  const KI_VARS_TEKST = [
    [/vekking|vekke/, 'Vekking', 'Lys og lyd på vekketidspunkt', 'mdi:alarm', 'auto'],
    [/ansikt/, 'Ansiktsgjenkjenning', 'Låser opp ved gjenkjent ansikt', 'mdi:face-recognition', 'auto'],
    [/autolas|autolås/, 'Autolås', 'Låser døra automatisk etter lukking', 'mdi:lock-clock', 'auto'],
    [/fastkjort|fastkjørt/, 'Fastkjørt lås', 'Varsel hvis låsen ikke går i lås', 'mdi:lock-alert', 'auto'],
    [/blink|dorlys|dørlys/, 'Dørlys', 'Blinker med lyset når døra åpnes', 'mdi:monitor-shimmer', 'auto'],
    [/familie|hjemme.?borte/, 'Hjemme / borte', 'Varsler når noen kommer eller drar', 'mdi:home-account', 'push'],
    [/^alarm|alarm_/, 'Alarm', 'Aktiverer alarmsystemet', 'mdi:shield-home', 'push'],
    [/heimdall|alarmo/, 'Heimdall', 'Synk mellom Heimdall og Alarmo', 'mdi:sync', 'auto'],
    [/ruter|skolen/, 'Ruter fra skolen', 'Avgangstider hjem etter forelesning', 'mdi:bus-clock', 'push'],
    [/planter/, 'Planter', 'Varsel når plantene trenger vann', 'mdi:flower-tulip', 'push'],
    [/stovsug|støvsug/, 'Støvsuger', 'Varsel om feil og fullført runde', 'mdi:robot-vacuum', 'push'],
    [/home.?assistant|oppstart|startet/, 'Home Assistant', 'Varsel etter omstart av HA', 'mdi:home-assistant', 'push'],
    [/vaermelding|værmelding|vaer_ai/, 'Værmelding', 'Daglig værvarsel fra AI', 'mdi:weather-partly-cloudy', 'push'],
    [/stromforbruk|strømforbruk|forbruk.?rapport/, 'Strømforbruk', 'Daglig rapport', 'mdi:chart-bar', 'push'],
    /* KI Utelys. Tre brytere på samme enhet, som ellers ville hett det samme. */
    [/ki_utelys_auto/, 'Utelys automatikk', 'Styrer utelysene etter solhøyden', 'mdi:lightbulb-auto', 'auto'],
    [/ki_utelys_morgen/, 'Utelys morgen', 'Lys om morgenen til det lysner', 'mdi:weather-sunset-up', 'auto'],
    [/ki_utelys_kveld/, 'Utelys kveld', 'Lys om kvelden når det blir mørkt', 'mdi:weather-sunset-down', 'auto'],
    /* KI Energi. Hovedbryteren først. */
    [/\bki_energi_varsler\b/, 'Energivarsler', 'Hovedbryter for alle energivarsler', 'mdi:bell-outline', 'strom'],
    [/ki_varsel_effekt/, 'Effektgrense', 'Varsel når timen nærmer seg grensen', 'mdi:flash-alert', 'strom'],
    [/ki_varsel_hjemkomst/, 'Hjemkomst', 'Varsel når huset varmes opp før dere kommer', 'mdi:home-import-outline', 'strom'],
    [/ki_varsel_sommer/, 'Sommermodus', 'Varsel når sommermodus slår inn', 'mdi:white-balance-sunny', 'strom'],
    [/ki_varsel_vvb/, 'Varmtvann', 'Varsel om berederen og legionella', 'mdi:water-boiler', 'strom'],
    [/ki_varsel_hanklevarmer/, 'Håndklevarmer', 'Varsel om håndklevarmeren', 'mdi:radiator', 'strom'],
    [/ki_varsel_helg/, 'Bortemodus', 'Varsel når huset settes i bortemodus', 'mdi:bag-suitcase', 'strom'],
    [/ki_helg_spor_torsdag/, 'Spør torsdag', 'Spør om dere drar bort i helgen', 'mdi:calendar-question', 'strom'],
    [/ki_helg_spor_fredag/, 'Spør fredag', 'Spør igjen fredag hvis du ikke svarte', 'mdi:calendar-question', 'strom'],
  ];
  const KI_VARS_IKON = [
    [/fastkjort|fastkj/, 'mdi:lock-alert'], [/autolas|autolås/, 'mdi:lock-clock'], [/las|lås|dor|dør/, 'mdi:door-closed-lock'],
    [/alarm|heimdall|alarmo/, 'mdi:shield-home'], [/ansikt|face/, 'mdi:face-recognition'], [/familie|hjemme|borte|person/, 'mdi:home-account'],
    [/stovsug|støvsug|vacuum/, 'mdi:robot-vacuum'], [/vaer|vær|weather/, 'mdi:weather-partly-cloudy'], [/ruter|buss|avgang/, 'mdi:bus-clock'],
    [/strom|strøm|forbruk|energi/, 'mdi:chart-bar'], [/oppstart|restart|startup/, 'mdi:restart'], [/blink|lys|skjerm/, 'mdi:monitor-shimmer'],
    [/rapport|daglig/, 'mdi:file-document-outline'],
  ];
  const kiVarsIkon = (tekst) => { const t = String(tekst || '').toLowerCase(); for (const [m, ikon] of KI_VARS_IKON) if (m.test(t)) return ikon; return 'mdi:bell-outline'; };
  // Hovedbryteren i en regel (ki-varsling-card, uendret)
  const erMaster = (b) => /alle[ _-]?varsler|_aktivert$|_varsling$|_aktiv$|_auto$|_automatikk$/.test(b.id)
    || b.slug === b.enhet.toLowerCase().replace(/[^a-z0-9]+/g, '_')
    || /^(alle varsler|aktivert|varsling|aktiv)$/i.test(b.under || '');
  M.KI_VARS_TEKST = KI_VARS_TEKST;
  M.kiVarsErMaster = erMaster;

  /* ============================================================ faner og overstyringer */
  const BUILTIN = { automasjoner: ['Automasjoner', 'mdi:robot'], varsler: ['Varsler', 'mdi:bell'], strom: ['Strøm', 'mdi:flash'] };
  const FANE_TAB = { auto: 'automasjoner', push: 'varsler', strom: 'strom', energi: 'strom' };
  const edOrder = (keys, saved) => { const o = (Array.isArray(saved) ? saved : []).filter((k) => keys.includes(k)); keys.forEach((k) => { if (!o.includes(k)) o.push(k); }); return o; };
  const arr = (v) => (Array.isArray(v) ? v.filter((x) => x != null && x !== '').map(String) : []);
  const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  const hasFilter = (f) => !!f && ['enheter', 'ikke_enheter', 'plattform'].some((k) => arr(f[k]).length);
  // Fanene: tabs[] (26.15) – ellers 25.5-nøklene tab_order/tab_hidden/tab_names. Innebygde faner som mangler legges bakerst.
  function tabDefs(c) {
    let L;
    if (Array.isArray(c.tabs) && c.tabs.length) L = c.tabs.filter((t) => t && t.key).map((t) => ({ key: String(t.key), title: t.title ? String(t.title) : '', hidden: !!t.hidden, filter: hasFilter(t.filter) ? t.filter : null, icon: t.icon || '' }));
    else { const N = obj(c.tab_names), H = new Set(arr(c.tab_hidden)); L = edOrder(['automasjoner', 'varsler', 'strom'], c.tab_order).map((k) => ({ key: k, title: N[k] || '', hidden: H.has(k), filter: null, icon: '' })); }
    const seen = new Set();
    L = L.filter((t) => (seen.has(t.key) ? false : seen.add(t.key)));
    Object.keys(BUILTIN).forEach((k) => { if (!seen.has(k)) L.push({ key: k, title: '', hidden: false, filter: null, icon: '' }); });
    return L.map((t) => ({ ...t, builtin: !!BUILTIN[t.key], name: t.title || (BUILTIN[t.key] ? BUILTIN[t.key][0] : t.key), icon: t.icon || (BUILTIN[t.key] ? BUILTIN[t.key][1] : 'mdi:tab') }));
  }
  const tabsOut = (defs) => defs.map((t) => { const o = { key: t.key }; if (t.title) o.title = t.title; if (t.hidden) o.hidden = true; if (hasFilter(t.filter)) o.filter = t.filter; return o; });
  const visTabs = (c) => { const D = tabDefs(c), V = D.filter((t) => !t.hidden); return V.length ? V : D.slice(0, 1); };
  const tabDef = (c, k) => tabDefs(c).find((t) => t.key === k) || null;
  // rows (26.15) – ellers 25.5-nøklene include/exclude per fane
  function rowsCfg(c) {
    const r = obj(c.rows);
    const o = { exclude: arr(r.exclude), move: { ...obj(r.move) }, include: arr(r.include), names: obj(r.names), subs: obj(r.subs), icons: obj(r.icons), order: obj(r.order) };
    if (!c.rows) {
      Object.entries(obj(c.include)).forEach(([t, L]) => arr(L).forEach((id) => { if (!o.include.includes(id)) o.include.push(id); o.move[id] = t; }));
      Object.values(obj(c.exclude)).forEach((L) => arr(L).forEach((id) => { if (!o.exclude.includes(id)) o.exclude.push(id); }));
    }
    return o;
  }
  const pick = (O, r) => { for (const k of [r.key, r.id, r.dev, r.slug]) if (k && O[k] != null && O[k] !== '') return O[k]; return undefined; };
  const inList = (L, r) => [r.key, r.id, r.dev, r.slug].some((k) => k && L.includes(k));
  const moveTab = (v) => (v == null || v === '' ? null : FANE_TAB[v] || String(v));

  /* ============================================================ regler (én rad per regel) */
  let memo = null;
  function rules(h, c) {
    if (!h) return [];
    if (memo && memo.s === h.states && memo.e === h.entities && memo.d === h.devices && memo.c === c) return memo.r;
    const R = rowsCfg(c), reg = h.entities || {}, dev = h.devices || {}, ut = [];
    const legg = (id, kilde) => {
      const st = h.states[id];
      if (!st) return;
      const slug = id.split('.')[1] || id;
      const e = reg[id] || {}, D = dev[e.device_id] || {};
      const enhet = D.name_by_user || D.name || '';
      const a = st.attributes || {};
      // friendly_name deles på « - »: navnet foran, beskrivelsen bak («Alarm - Alle varsler»)
      const helt = a.friendly_name || slug, deler = helt.split(' - ');
      let navn = deler[0].trim() || slug, under = deler.length > 1 ? deler.slice(1).join(' - ').trim() : '';
      if (!under && enhet && helt.toLowerCase().startsWith(enhet.toLowerCase() + ' ')) { navn = enhet; under = helt.slice(enhet.length + 1).trim(); }
      let kjentIkon = null, fane = null;
      if (c.kjente !== false) {
        const n = `${slug} ${enhet} ${helt}`.toLowerCase();
        for (const [m, kn, ku, ki, kf] of KI_VARS_TEKST) { if (!m.test(n)) continue; navn = kn; under = ku; kjentIkon = ki; fane = kf; break; }
      }
      ut.push({ id, slug, kilde, plattform: e.platform || '', dev: e.device_id || null, enhet: enhet || 'Annet', navn: navn.trim() || enhet || slug, under, ikon: kjentIkon || a.icon || kiVarsIkon(`${slug} ${navn}`), fane, model: `${D.model || ''} ${D.entry_type || ''}` });
    };
    for (const [id, e] of Object.entries(reg)) {
      if (!e || !KI_VARS_PLATTFORM.includes(e.platform)) continue;
      if (!id.startsWith('switch.') && !id.startsWith('input_boolean.')) continue;
      if (e.platform === 'ki_energi' && !/varsel|varsler|spor_/.test(id)) continue; // bare varslingsbryterne i KI Energi
      legg(id, 'integrasjon');
    }
    R.include.forEach((id) => { if (!ut.some((b) => b.id === id)) legg(id, 'ekstra'); });
    // Én bryter per regel: hovedbryteren (ki-varsling-card). KI Energi har sidestilte valg – ingen sammenslåing der.
    const perEnhet = new Map();
    if (c.master !== false) {
      const utenMaster = ['ki_energi'];
      for (const b of ut) { if (b.kilde === 'ekstra' || utenMaster.includes(b.plattform)) continue; const g = b.dev || b.enhet; if (!perEnhet.has(g)) perEnhet.set(g, []); perEnhet.get(g).push(b); }
      const behold = new Set(ut.filter((b) => b.kilde === 'ekstra' || utenMaster.includes(b.plattform)).map((b) => b.id));
      for (const [, liste] of perEnhet) { const m = liste.length > 1 ? liste.filter(erMaster) : liste; (m.length ? m : liste).forEach((b) => behold.add(b.id)); }
      for (let i = ut.length - 1; i >= 0; i--) if (!behold.has(ut[i].id)) ut.splice(i, 1);
    }
    const perDev = new Map();
    ut.forEach((b) => { if (b.dev && b.kilde !== 'ekstra') perDev.set(b.dev, (perDev.get(b.dev) || 0) + 1); });
    const out = ut.map((b) => {
      const r = { ...b, key: b.kilde !== 'ekstra' && b.dev && perDev.get(b.dev) === 1 ? b.dev : b.id, all: b.dev ? Object.keys(reg).filter((x) => reg[x] && reg[x].device_id === b.dev) : [b.id] };
      const mf = /automasjon|automation|\block\b|lås/i.test(b.model) ? 'automasjoner' : /varsl|notif|push/i.test(b.model) ? 'varsler' : null;
      r.tab = b.plattform === 'ki_energi' ? 'strom' : (b.fane && FANE_TAB[b.fane]) || mf || (b.kilde === 'ekstra' && /^(automation|script)\./.test(b.id) ? 'automasjoner' : 'varsler');
      r.name = pick(R.names, r) || r.navn; r.sub = pick(R.subs, r) || r.under; r.icon = pick(R.icons, r) || r.ikon;
      r.hidden = inList(R.exclude, r);
      r.move = moveTab(pick(R.move, r));
      r.master = erMaster(b) || /\bki_energi_varsler\b/.test(b.id);
      return r;
    });
    memo = { s: h.states, e: h.entities, d: h.devices, c, r: out };
    return out;
  }
  M.innstRules = rules;
  const treff = (navn, liste) => liste.some((m) => String(navn).toLowerCase().includes(String(m).toLowerCase()));
  function inTab(r, t) {
    if (r.move) return r.move === t.key;
    if (hasFilter(t.filter)) {
      const f = t.filter, P = arr(f.plattform), E = arr(f.enheter), I = arr(f.ikke_enheter);
      if (P.length && r.kilde !== 'ekstra' && !P.includes(r.plattform)) return false;
      if (E.length && r.kilde !== 'ekstra' && !treff(r.enhet, E)) return false;
      if (I.length && treff(r.enhet, I)) return false;
      return true;
    }
    return t.builtin && r.tab === t.key;
  }
  // Radene i en fane: autokonfig + include − exclude, i lagret rekkefølge (rows.order) – ellers hovedbryter først og alfabetisk
  function tabRows(h, c, key, opts) {
    const t = tabDef(c, key);
    if (!t) return [];
    const R = rowsCfg(c);
    let L = rules(h, c).filter((r) => inTab(r, t));
    if (!(opts && opts.withHidden)) L = L.filter((r) => !r.hidden);
    L.sort((a, b) => (b.master && b.plattform === 'ki_energi') - (a.master && a.plattform === 'ki_energi') || a.name.localeCompare(b.name, 'nb'));
    const O = arr(R.order[key]);
    if (O.length) { const rank = new Map(O.map((k, i) => [k, i])); const rk = (r) => (rank.has(r.key) ? rank.get(r.key) : rank.has(r.id) ? rank.get(r.id) : 1e6); L = L.slice().sort((a, b) => rk(a) - rk(b)); }
    return L;
  }
  M.innstRows = tabRows;
  M.innstTabs = tabDefs;

  /* ============================================================ toppkortets entiteter */
  const pickFirst = (h, ids) => ids.find((id) => h && h.states[id]) || null;
  const byName = (h, doms, re) => Object.keys((h && h.states) || {}).filter((id) => doms.includes(id.split('.')[0]) && re.test(id)).sort()[0] || null;
  function ents(h, c) {
    const natt = c.natt || pickFirst(h, ['switch.nattmodus', 'input_boolean.nattmodus']) || byName(h, ['input_boolean', 'switch'], /\.(ki_)?nattmodus/) || byName(h, ['input_boolean'], /^input_boolean\.[a-z0-9_]*natt/);
    const privat = c.privat || pickFirst(h, ['input_boolean.privatmodus', 'switch.privatmodus']) || byName(h, ['input_boolean', 'switch'], /\.(ki_)?privatmodus/) || byName(h, ['input_boolean'], /^input_boolean\.[a-z0-9_]*priva/);
    const vekking = c.vekking || pickFirst(h, ['input_datetime.vekking']) || byName(h, ['sensor'], /^sensor\.[a-z0-9_]*vekking[a-z0-9_]*neste/);
    return { natt, privat, vekking };
  }
  M.innstEntities = ents;
  const isOn = (s) => !!s && s.state === 'on';
  const tidOf = (s) => {
    if (!s || M.unavailable(s)) return null;
    const v = String(s.state);
    const m = /(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(v);
    if (m && !/T/.test(v)) return `${M.pad(m[1])}:${m[2]}`;
    const d = new Date(v);
    return isNaN(d) ? null : `${M.pad(d.getHours())}:${M.pad(d.getMinutes())}`;
  };

  /* ============================================================ migrering fra den importerte #settings (ki-cards) */
  const HASH = '#settings';
  const cfgOf = (e) => { try { return M.customPopupConfig ? M.customPopupConfig(e).cfg : e; } catch (x) { return null; } };
  const legacyOf = (cfg) => {
    if (!cfg || typeof cfg !== 'object' || String(cfg.hash || '').trim().replace(/^#?/, '#') !== HASH) return false;
    let js = ''; try { js = JSON.stringify(cfg); } catch (e) { return false; }
    return /custom:ki-(natt|varsling)-card/.test(js);
  };
  const tabKeyOf = (title, v) => {
    const t = String(title || '').toLowerCase();
    if (/automasjon|automation/.test(t)) return 'automasjoner';
    if (/varsl|push|notif/.test(t)) return 'varsler';
    if (/str[øo]m|energi/.test(t) || (v && arr(v.enheter).length && arr(v.enheter).every((x) => /energi/i.test(x)))) return 'strom';
    return null;
  };
  function migrate(cfg) {
    const out = {}, tabs = [], R = { exclude: [], move: {}, include: [], names: {}, subs: {}, icons: {} };
    const find = (o, re, d, acc) => { if (!o || typeof o !== 'object' || d > 12) return acc; if (Array.isArray(o)) { o.forEach((x) => find(x, re, d + 1, acc)); return acc; } if (re.test(String(o.type || ''))) acc.push(o); Object.values(o).forEach((x) => { if (x && typeof x === 'object') find(x, re, d + 1, acc); }); return acc; };
    const natt = find(cfg, /^custom:ki-natt-card$/, 0, [])[0];
    if (natt) {
      if (natt.natt) out.natt = natt.natt;
      const priv = natt.privat === true || /privac|privat|kamera|camera/i.test(String(natt.helg || '') + ' ' + String(natt.navn_helg || ''));
      if (natt.helg && priv) out.privat = natt.helg;
      if (natt.vekking) out.vekking = natt.vekking;
    }
    const tc = find(cfg, /^custom:ki-tabs-card$/, 0, [])[0];
    const used = new Set();
    (tc && Array.isArray(tc.tabs) ? tc.tabs : []).forEach((t, i) => {
      const v = find(t, /^custom:ki-varsling-card$/, 0, [])[0];
      if (!v) return;
      let key = tabKeyOf(t.title, v);
      if (!key || used.has(key)) key = 'fane_' + (String(t.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || i);
      used.add(key);
      const o = { key };
      if (t.title && (!BUILTIN[key] || t.title !== BUILTIN[key][0])) o.title = String(t.title);
      if (!BUILTIN[key]) { const f = {}; ['enheter', 'ikke_enheter', 'plattform'].forEach((k) => { const L = arr([].concat(v[k] || [])); if (L.length) f[k] = L; }); if (Object.keys(f).length) o.filter = f; }
      tabs.push(o);
      arr(v.ekstra).forEach((id) => { if (!R.include.includes(id)) R.include.push(id); R.move[id] = key; });
      arr(v.skjul).forEach((s) => { if (!R.exclude.includes(s)) R.exclude.push(s); });
      Object.assign(R.names, obj(v.navn)); Object.assign(R.subs, obj(v.undertekst)); Object.assign(R.icons, obj(v.ikoner));
    });
    if (tabs.length) out.tabs = tabs;
    const rows = {}; Object.keys(R).forEach((k) => { const x = R[k]; if (Array.isArray(x) ? x.length : Object.keys(x).length) rows[k] = x; });
    if (Object.keys(rows).length) out.rows = rows;
    return out;
  }
  M.innstMigrate = migrate;
  const lists = (config) => [(M.store && (M.store.get('custom_popups') || [])) || [], (config && config.custom_popups) || []];
  M.innstExtra = function (config) {
    for (const L of lists(config)) for (const e of (Array.isArray(L) ? L : [])) { const cfg = cfgOf(e); if (legacyOf(cfg)) { const r = migrate(cfg); if (Object.keys(r).length) return r; } }
    return undefined;
  };
  M.POPUP_SUPERSEDE = M.POPUP_SUPERSEDE || {};
  M.POPUP_SUPERSEDE[HASH] = { name: 'Innstillinger', test: (cfg) => legacyOf(cfg) };
  M.POPUP_EXTRA = M.POPUP_EXTRA || {};
  M.POPUP_EXTRA[HASH] = (config) => M.innstExtra(config);

  /* ============================================================ scenene */
  const stars = (n, w, h, seed) => { let s = seed, out = ''; const r = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; for (let i = 0; i < n; i++) out += `<circle class="st" style="animation-delay:${(r() * 3).toFixed(2)}s" cx="${(r() * w).toFixed(1)}" cy="${(r() * h).toFixed(1)}" r="${(0.6 + r() * 1.1).toFixed(2)}" fill="#fff"/>`; return out; };
  const house = (x, y, lit, cam) => `<g transform="translate(${x} ${y})">
      <rect x="44" y="-6" width="10" height="20" fill="#20283d"/>
      <g class="smoke"><circle cx="49" cy="-12" r="4" fill="rgba(255,255,255,.35)"/><circle cx="52" cy="-20" r="5" fill="rgba(255,255,255,.25)"/><circle cx="47" cy="-29" r="6" fill="rgba(255,255,255,.16)"/></g>
      <path d="M0 26 L36 0 L72 26 Z" fill="#2a3450"/><rect x="6" y="24" width="60" height="44" fill="#232c44"/>
      <rect class="${lit ? 'win' : ''}" x="14" y="32" width="14" height="12" rx="2" fill="${lit ? '#f2d26f' : '#3a4563'}"/><rect class="${lit ? 'win' : ''}" x="44" y="32" width="14" height="12" rx="2" fill="${lit ? '#f2d26f' : '#3a4563'}"/>
      <rect x="30" y="48" width="12" height="20" rx="2" fill="#3a4563"/>
      ${cam ? '<circle class="cam" cx="66" cy="30" r="3" fill="#f28073"/>' : ''}</g>`;
  const birds = () => `<g class="birds" fill="none" stroke="rgba(35,45,70,.7)" stroke-width="2" stroke-linecap="round"><path class="b1" d="M0 0 q5 -5 10 0 q5 -5 10 0"/><path class="b2" d="M26 10 q4 -4 8 0 q4 -4 8 0"/></g>`;
  // Overvåkingskameraet i Privatmodus-kortet (26.15): feste mot høyre kant, linsen peker mot venstre. Vippe/sveip rundt festet.
  const camera = () => `<svg class="pcam" viewBox="0 0 64 44" aria-hidden="true">
      <defs><linearGradient id="pcone" x1="1" x2="0" y1="0" y2="0"><stop offset="0" stop-color="#f2d26f" stop-opacity=".55"/><stop offset="1" stop-color="#f2d26f" stop-opacity="0"/></linearGradient></defs>
      <g class="cm-tilt"><g class="cm-sweep">
        <path class="cm-cone" d="M10 22 L-70 0 L-70 44 Z" fill="url(#pcone)"/>
        <rect class="cm-body" x="12" y="13" width="32" height="18" rx="5"/>
        <rect class="cm-hood" x="10" y="11" width="30" height="4" rx="2"/>
        <rect class="cm-lensh" x="6" y="15" width="8" height="14" rx="2.5"/>
        <circle class="cm-lens" cx="10" cy="22" r="3.6"/><circle class="cm-glint" cx="9" cy="20.8" r="1"/>
        <rect class="cm-shut" x="5" y="15" width="10" height="14" rx="2.5"/>
        <circle class="cm-rec" cx="38" cy="18" r="2"/><circle class="cm-ok" cx="38" cy="18" r="2"/>
      </g></g>
      <rect class="cm-arm" x="44" y="20" width="12" height="4" rx="1"/>
      <rect class="cm-wall" x="56" y="12" width="7" height="20" rx="2"/>
    </svg>`;

  /* ============================================================ editoren (Tilpass Innstillinger + GUI) */
  const cid = (ed) => ((ed && ed._config && ed._config.card_id) || '_');
  const RT = new Map(), ADD = new Set(), EXP = new Map();
  // 26.15: designet for arket – tekstfaner i segmentrad (#3a3a3a, r24, pad 4), én flate per seksjon (ingen kant) med rader
  // flatt inni og skillelinjer, navnefelt (#282828, r12, 40 px) + rosa bryter i raden. Bare i denne editoren (adoptedStyleSheets).
  const INN_CSS = `
    .chips.sg.tabs{background:#3a3a3a;border-radius:24px;padding:4px;gap:2px}
    .chips.sg.tabs .chip{height:40px;border-radius:20px;font-size:14px;font-weight:500}
    .chips.sg.tsub{background:#3a3a3a;border-radius:20px;padding:4px}
    .fsh{font-size:12px}
    .fsec>.sec{border-radius:24px;background:#3a3a3a;box-shadow:none;border:0}
    .fsec>.sec>.in{padding:4px 12px}
    .fsec .sec .f{background:transparent;padding:10px 4px}
    .fsec .sec .f + .f{border-top:1px solid rgba(255,255,255,.06);border-radius:0}
    .ilist{display:flex;flex-direction:column}
    .irow{display:flex;align-items:center;gap:8px;min-height:56px;padding:8px 0}
    .irow + .irow,.irow + .isub,.isub + .irow{border-top:1px solid rgba(255,255,255,.06)}
    .irow.off .iic,.irow.off .inm{opacity:.45}
    .iic{width:32px;height:32px;display:grid;place-items:center;flex:none;color:#afafaf;--mdc-icon-size:22px}
    button.iic{border-radius:16px}
    .inm{flex:1;min-width:0;height:40px;border-radius:12px;background:#282828;padding:0 12px;font-size:14px;color:#fafafa}
    .inm::placeholder{color:#979797}
    .icnt{flex:none;font-size:12px;color:#979797;white-space:nowrap;font-variant-numeric:tabular-nums}
    .irow .sw{width:44px;height:26px;border-radius:13px;background:#545454}
    .irow .sw::after{top:3px;left:3px;width:20px;height:20px;border-radius:10px}
    .irow .sw.on{background:var(--pink,#f285c9)}.irow .sw.on::after{transform:translateX(18px)}
    .isub{display:flex;flex-direction:column;gap:8px;padding:10px 0 12px 40px}
    .isub .lb{font-size:12px;color:#afafaf}
    .ichips{display:flex;flex-wrap:wrap;gap:6px}
    .ichips button{height:32px;padding:0 12px;border-radius:16px;background:#404040;font-size:13px;white-space:nowrap}
    .ichips button.on{background:${C.accent};color:#2a1720;font-weight:500}
    .ifld{display:flex;flex-direction:column;gap:6px;padding:10px 0}
    .ifld + .ifld{border-top:1px solid rgba(255,255,255,.06)}
    .ifld .lb{font-size:12px;color:#afafaf}
    .inm.full{flex:none;width:100%}
    .iempty{padding:14px 4px;font-size:13px;color:#979797}
    .ibtn{height:44px;border-radius:22px;background:#404040;display:flex;align-items:center;justify-content:center;gap:8px;font-size:14px;font-weight:500;width:100%;margin:8px 0}
    .imeta{font-size:11px;color:#7f7f7f;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}`;
  let innSheet = null;
  function innKit(ed) {
    if (!ed || !ed.shadowRoot) return;
    if (M.edKit) M.edKit(ed);
    ed.__edDrop = ed.__edDrop || {}; ed.__edQ = ed.__edQ || {};
    const R = ed.shadowRoot;
    try { if (!innSheet) { innSheet = new CSSStyleSheet(); innSheet.replaceSync(INN_CSS); } if (!R.adoptedStyleSheets.includes(innSheet)) R.adoptedStyleSheets = [...R.adoptedStyleSheets, innSheet]; } catch (e) { /* eldre nettleser */ }
    if (ed.__innKit) return;
    ed.__innKit = true;
    // Navnefelt, ikon og filter i radene lagres ved «change» (ikke per tastetrykk – feltet beholder fokus)
    R.addEventListener('change', (e) => {
      const t = e.target;
      if (!t.dataset || t.dataset.inn == null) return;
      e.stopPropagation();
      const cc = ed._config || {}, v = String(t.value || '').trim(), k = t.dataset.v;
      if (t.dataset.inn === 'tname') { const D = tabDefs(cc).map((x) => (x.key === k ? { ...x, title: v && !(BUILTIN[k] && v === BUILTIN[k][0]) ? v : (BUILTIN[k] ? '' : x.title) } : x)); return ed._set('tabs', tabsOut(D)); }
      if (t.dataset.inn === 'rname' || t.dataset.inn === 'ricon') return setRows(ed, (R2) => { const O = t.dataset.inn === 'rname' ? R2.names : R2.icons; if (v) O[k] = v; else delete O[k]; });
      if (t.dataset.inn === 'fenh' || t.dataset.inn === 'fikke') {
        const L = v.split(',').map((x) => x.trim()).filter(Boolean), f = t.dataset.inn === 'fenh' ? 'enheter' : 'ikke_enheter';
        const D = tabDefs(cc).map((x) => { if (x.key !== k) return x; const F = { ...obj(x.filter) }; if (L.length) F[f] = L; else delete F[f]; return { ...x, filter: F }; });
        return ed._set('tabs', tabsOut(D));
      }
    }, true);
  }
  function setRows(ed, fn) {
    const cc = ed._config || {}, R = rowsCfg(cc);
    const W = { exclude: [...R.exclude], move: { ...R.move }, include: [...R.include], names: { ...R.names }, subs: { ...R.subs }, icons: { ...R.icons }, order: { ...R.order } };
    fn(W);
    const o = {}; Object.keys(W).forEach((k) => { const x = W[k]; if (Array.isArray(x) ? x.length : Object.keys(x).length) o[k] = x; });
    ed._set('rows', Object.keys(o).length ? o : undefined);
  }
  const rowTabs = (c) => tabDefs(c);
  const curTab = (ed, c) => { const T = rowTabs(c), v = RT.get(cid(ed)); return T.some((t) => t.key === v) ? v : (T[0] || {}).key; };
  const cntTxt = (n) => `${n} ${n === 1 ? 'rad' : 'rader'}`;
  const sw = (key, op, v, on, label) => `<button class="sw ${on ? 'on' : ''}" role="switch" aria-checked="${on}" aria-label="${esc(label)}" data-a="fn" data-k="${key}" data-op="${op}" data-v="${esc(v)}"></button>`;
  function editorSchema(h0, cfg0) {
    const handle = () => (M.edHandle ? M.edHandle() : '');
    // Faner: dra-håndtak, ikon 22 px, navnefelt direkte i raden, antall rader etter filter, bryter = vis/skjul
    const faner = { type: 'html', html: (hh, cc, key, ed) => {
      innKit(ed);
      ed.__edDrop['inn-tab'] = (o) => { const D = tabDefs(cc), by = new Map(D.map((t) => [t.key, t])); ed._set('tabs', tabsOut(o.map((k) => by.get(k)).filter(Boolean))); };
      return `<div class="ilist">${tabDefs(cc).map((t) => {
        const n = hh ? tabRows(hh, cc, t.key).length : 0;
        return `<div class="irow ${t.hidden ? 'off' : ''}" data-edk="${esc(t.key)}" data-elist="inn-tab" data-key="it-${esc(t.key)}">${handle()}<span class="iic">${M.icon(t.icon, 22)}</span>
          <input class="inm" data-inn="tname" data-v="${esc(t.key)}" value="${esc(t.title)}" placeholder="${esc(BUILTIN[t.key] ? BUILTIN[t.key][0] : t.key)}" aria-label="Navn på fanen" autocapitalize="off" autocorrect="off" spellcheck="false">
          <span class="icnt">${cntTxt(n)}</span>${sw(key, 'teye', t.key, !t.hidden, (t.hidden ? 'Vis ' : 'Skjul ') + t.name)}</div>`;
      }).join('')}</div>`;
    }, click: (dd, ed) => {
      const cc = ed._config || {};
      if (dd.op === 'teye') {
        const D = tabDefs(cc), t = D.find((x) => x.key === dd.v);
        if (!t) return;
        if (!t.hidden && D.filter((x) => !x.hidden).length <= 1) { M.haptic('warning'); M.toast('Minst én fane må være synlig'); return; }
        M.haptic('selection');
        return ed._set('tabs', tabsOut(D.map((x) => (x.key === dd.v ? { ...x, hidden: !x.hidden } : x))));
      }
    } };
    // Rader: undersegment (fane) + rader for valgt fane (dra, ikon → flytt/ikon, navnefelt, bryter = exclude) + «Legg til rad»
    const radSeg = { type: 'html', html: (hh, cc, key, ed) => {
      innKit(ed);
      const tab = curTab(ed, cc);
      return `<div class="chips sg tsub" role="tablist">${rowTabs(cc).map((t) => `<button class="chip ${t.key === tab ? 'on' : ''}" role="tab" aria-selected="${t.key === tab}" data-a="fn" data-k="${key}" data-op="rtab" data-v="${esc(t.key)}"><span>${esc(t.name)}</span><span class="tc">${hh ? tabRows(hh, cc, t.key).length : 0}</span></button>`).join('')}</div>`;
    }, click: (dd, ed) => { if (dd.op === 'rtab') { M.haptic('selection'); RT.set(cid(ed), dd.v); EXP.delete(cid(ed)); ADD.delete(cid(ed)); return ed._render(); } } };
    const rader = { type: 'html', html: (hh, cc, key, ed) => {
      innKit(ed);
      if (!hh) return '';
      const id = cid(ed), tab = curTab(ed, cc), R = rowsCfg(cc), T = rowTabs(cc);
      if (!tab) return '<div class="iempty">Ingen faner med rader.</div>';
      ed.__edDrop['inn-row'] = (o) => setRows(ed, (W) => { W.order = { ...W.order, [tab]: o }; });
      const L = tabRows(hh, cc, tab, { withHidden: true }), open = EXP.get(id);
      const rows = L.map((r) => {
        const own = r.kilde === 'ekstra';
        const sub = open === r.key ? `<div class="isub" data-key="irs-${esc(r.key)}">
            <span class="lb">Flytt til</span><div class="ichips">${T.map((t) => `<button class="${t.key === tab ? 'on' : ''}" data-a="fn" data-k="${key}" data-op="rmove" data-v="${esc(r.key)}" data-t="${esc(t.key)}">${esc(t.name)}</button>`).join('')}</div>
            <span class="lb">Ikon</span><input class="inm full" data-inn="ricon" data-v="${esc(r.key)}" value="${esc(R.icons[r.key] || '')}" placeholder="${esc(r.ikon)}" autocapitalize="off" autocorrect="off" spellcheck="false">
            <span class="imeta">${esc(r.id)}${r.enhet && r.kilde !== 'ekstra' ? ' · ' + esc(r.enhet) : ''}${r.all.length > 1 ? ` · ${r.all.length} entiteter (hold på raden i popupen for resten)` : ''}</span>
            ${own ? `<div class="ichips"><button data-a="fn" data-k="${key}" data-op="rrm" data-v="${esc(r.id)}">Fjern raden</button></div>` : ''}</div>` : '';
        return `<div class="irow ${r.hidden ? 'off' : ''}" data-edk="${esc(r.key)}" data-elist="inn-row" data-key="ir-${esc(r.key)}">${handle()}<button class="iic" data-a="fn" data-k="${key}" data-op="rexp" data-v="${esc(r.key)}" aria-expanded="${open === r.key}" aria-label="Flytt eller bytt ikon">${M.icon(r.icon, 22)}</button>
          <input class="inm" data-inn="rname" data-v="${esc(r.key)}" value="${esc(R.names[r.key] || '')}" placeholder="${esc(r.navn)}" aria-label="Navn på raden" autocapitalize="off" autocorrect="off" spellcheck="false">
          ${sw(key, 'reye', r.key, !r.hidden, (r.hidden ? 'Vis ' : 'Skjul ') + r.name)}</div>${sub}`;
      }).join('');
      const q = (ed.__edQ['inn-q'] || '').trim().toLowerCase(), have = new Set(L.map((r) => r.id));
      const hits = ADD.has(id) ? Object.keys(hh.states).filter((x) => ['automation', 'input_boolean', 'switch', 'script'].includes(x.split('.')[0]) && !have.has(x) && (!q || (x + ' ' + (hh.states[x].attributes.friendly_name || '')).toLowerCase().includes(q))).sort().slice(0, 8) : [];
      const add = ADD.has(id) ? `<div class="isub" style="padding-left:0" data-key="iadd"><div class="edq">${M.icon('mdi:magnify', 20, 'color:#979797')}<input data-edq="inn-q" value="${esc(ed.__edQ['inn-q'] || '')}" placeholder="Søk etter automasjon eller bryter" autocapitalize="off" autocorrect="off" spellcheck="false"></div>
        ${hits.map((x) => `<button class="edhit" data-a="fn" data-k="${key}" data-op="radd" data-v="${esc(x)}">${M.icon(M.domainIcon(x, hh.states[x]), 20, 'color:#afafaf')}<span class="nm"><b>${esc(M.name(hh, x))}</b><i>${esc(x)}</i></span></button>`).join('') || '<div class="iempty">Ingen treff</div>'}</div>` : '';
      const none = !rules(hh, cc).some((r) => r.kilde === 'integrasjon') ? 'Fant ingen regler fra KI Varslinger og sikkerhet' : 'Ingen rader i denne fanen ennå.';
      return `<div class="ilist">${rows || `<div class="iempty">${esc(none)}</div>`}${add}</div>
        <button class="ibtn" data-a="fn" data-k="${key}" data-op="radd-open" data-v="">${M.icon(ADD.has(id) ? 'mdi:close' : 'mdi:plus', 20)}${ADD.has(id) ? 'Lukk' : 'Legg til rad'}</button>
        ${arr(R.order[tab]).length ? `<button class="ibtn" data-a="fn" data-k="${key}" data-op="rsort" data-v="">${M.icon('mdi:sort-alphabetical-ascending', 18)}Automatisk rekkefølge</button>` : ''}`;
    }, click: (dd, ed) => {
      const cc = ed._config || {}, id = cid(ed), tab = curTab(ed, cc);
      if (dd.op === 'rexp') { M.haptic('selection'); if (EXP.get(id) === dd.v) EXP.delete(id); else EXP.set(id, dd.v); return ed._render(); }
      if (dd.op === 'reye') { M.haptic('selection'); return setRows(ed, (W) => { const i = W.exclude.indexOf(dd.v); if (i >= 0) W.exclude.splice(i, 1); else { const r = rules(ed._hass, cc).find((x) => x.key === dd.v); W.exclude = W.exclude.filter((x) => !r || ![r.id, r.dev, r.slug].includes(x)); if (!r || !r.hidden) W.exclude.push(dd.v); } }); }
      if (dd.op === 'rmove') {
        M.haptic('selection'); EXP.delete(id);
        const r = rules(ed._hass, cc).find((x) => x.key === dd.v);
        return setRows(ed, (W) => { [dd.v, r && r.id, r && r.dev, r && r.slug].forEach((k) => { if (k) delete W.move[k]; }); const def = r && r.tab; if (!r || dd.t !== def || r.kilde === 'ekstra' || tabDefs(cc).some((t) => t.key === def && hasFilter(t.filter))) W.move[dd.v] = dd.t; });
      }
      if (dd.op === 'rrm') { M.haptic('selection'); EXP.delete(id); return setRows(ed, (W) => { W.include = W.include.filter((x) => x !== dd.v); delete W.move[dd.v]; delete W.names[dd.v]; delete W.icons[dd.v]; }); }
      if (dd.op === 'radd-open') { M.haptic('selection'); ed.__edQ['inn-q'] = ''; if (ADD.has(id)) ADD.delete(id); else ADD.add(id); return ed._render(); }
      if (dd.op === 'radd') { M.haptic('success'); ed.__edQ['inn-q'] = ''; ADD.delete(id); return setRows(ed, (W) => { if (!W.include.includes(dd.v)) W.include.push(dd.v); W.move[dd.v] = tab; }); }
      if (dd.op === 'rsort') { M.haptic('selection'); return setRows(ed, (W) => { const O = { ...W.order }; delete O[tab]; W.order = O; }); }
    } };
    // Filter for valgt fane (samme som ki-varsling-card: enheter / ikke_enheter / plattform) – lagres i tabs[i].filter
    const filter = { type: 'html', html: (hh, cc, key, ed) => {
      innKit(ed);
      const tab = curTab(ed, cc), t = tab && tabDef(cc, tab);
      if (!t) return '';
      const F = obj(t.filter), P = arr(F.plattform);
      return `<div class="ifld"><span class="lb">Bare regler med navn som inneholder (kommaseparert)</span><input class="inm full" data-inn="fenh" data-v="${esc(tab)}" value="${esc(arr(F.enheter).join(', '))}" placeholder="Automatisk fordeling" autocapitalize="off" autocorrect="off" spellcheck="false"></div>
        <div class="ifld"><span class="lb">Ikke regler med navn som inneholder</span><input class="inm full" data-inn="fikke" data-v="${esc(tab)}" value="${esc(arr(F.ikke_enheter).join(', '))}" placeholder="Ingen" autocapitalize="off" autocorrect="off" spellcheck="false"></div>
        <div class="ifld"><span class="lb">Integrasjoner</span><div class="ichips">${KI_VARS_PLATTFORM.map((p) => `<button class="${P.includes(p) ? 'on' : ''}" aria-pressed="${P.includes(p)}" data-a="fn" data-k="${key}" data-op="fplat" data-v="${esc(tab)}" data-p="${p}">${esc({ ki_notifications: 'KI Varslinger', ki_energi: 'KI Energi', ki_utelys: 'KI Utelys' }[p])}</button>`).join('')}</div></div>`;
    }, click: (dd, ed) => {
      if (dd.op !== 'fplat') return;
      M.haptic('selection');
      const D = tabDefs(ed._config || {}).map((x) => { if (x.key !== dd.v) return x; const F = { ...obj(x.filter) }, P = new Set(arr(F.plattform)); if (P.has(dd.p)) P.delete(dd.p); else P.add(dd.p); if (P.size) F.plattform = [...P]; else delete F.plattform; return { ...x, filter: F }; });
      return ed._set('tabs', tabsOut(D));
    } };
    const auto = (k) => (hh, cc) => ents(hh, { ...cc, [k]: undefined })[k];
    const tabMeta = (h, c) => { const tab = RT.get((c && c.card_id) || '_'), T = rowTabs(c || {}), k = T.some((t) => t.key === tab) ? tab : (T[0] || {}).key; return k && h ? cntTxt(tabRows(h, c, k).length) : ''; };
    return [
      { type: 'tabs', id: 'innstillinger', tabs: [
        { key: 'faner', label: 'Faner', focus: ['faner', 'visning'], fields: [
          { type: 'section', id: 'faner', label: 'Faner · dra for rekkefølge', fields: [faner] },
          { type: 'section', id: 'visning', label: 'Visning', fields: [
            { type: 'select', name: 'tab_labels', label: 'Faner viser', options: [['ikon', 'Ikon'], ['name', 'Tekst'], ['icon', 'Begge']], default: 'name' },
            { type: 'select', name: 'start_tab', label: 'Startfane', options: tabDefs(cfg0 || {}).map((t) => [t.key, t.name]), default: 'automasjoner' },
          ] },
        ] },
        { key: 'rader', label: 'Rader', focus: ['rader', 'filter'], fields: [
          radSeg,
          { type: 'section', id: 'rader', label: 'Rader · dra for rekkefølge', meta: tabMeta, fields: [rader] },
          { type: 'section', id: 'filter', label: 'Filter for fanen', fields: [filter] },
        ] },
        { key: 'entiteter', label: 'Entiteter', focus: ['entiteter'], fields: [{ type: 'section', id: 'entiteter', label: 'Toppkortet', fields: [
          { type: 'entity', name: 'natt', label: 'Nattmodus', domain: ['input_boolean', 'switch'], auto: auto('natt') },
          { type: 'entity', name: 'privat', label: 'Privatmodus', domain: ['input_boolean', 'switch'], auto: auto('privat') },
          { type: 'entity', name: 'vekking', label: 'Vekking (tom = linjen skjules)', domain: ['input_datetime', 'sensor'], auto: auto('vekking') },
        ] }] },
        { key: 'avansert', label: 'Avansert', focus: ['avansert', 'spacing'], fields: [
          { type: 'section', id: 'avansert', label: 'Avansert', fields: [
            { type: 'boolean', name: 'animasjoner', label: 'Animasjoner', default: true },
            { type: 'boolean', name: 'dashbord', label: 'Dashbordinnstillinger nederst', help: 'Tilpass Hjem/navbar/header, Home Assistant, Liquid Glass og Enheter', default: true },
            { type: 'boolean', name: 'sok', label: 'Søkefelt', default: true },
            { type: 'boolean', name: 'av_forst', label: 'Avslåtte øverst', default: false },
            { type: 'boolean', name: 'haptikk', label: 'Haptikk', default: true },
            { type: 'select', name: 'scene', label: 'Toppkort-scene', options: [['auto', 'Følg nattmodus'], ['dag', 'Alltid dag'], ['natt', 'Alltid natt']], default: 'auto' },
          ] },
          M.spacingSchema(),
        ] },
      ] },
    ];
  }

  /* ============================================================ kortet */
  class Innstillinger extends M.Card {
    static get cardName() { return 'Innstillinger'; }
    static get editorTitle() { return 'Tilpass Innstillinger'; }
    static getStubConfig() { return { card_id: M.uid() }; }
    static get schema() { return editorSchema; }
    static get uiPersist() { return ['tab']; }
    get cardSize() { return 9; }
    get hass() { return super.hass; }
    set hass(h) { super.hass = h; if (this._dashEl && this._dashEl.hass !== h) this._dashEl.hass = h; }
    onClose() { this._ui = { ...this._ui, q: '' }; }
    get tab() { const V = visTabs(this.config).map((t) => t.key), t = this.ui.tab || this.config.start_tab; return V.includes(t) ? t : V[0]; }
    _hp(t) { return `data-haptic="${this.config.haptikk === false ? 'off' : t}"`; }
    get _anim() { return this.config.animasjoner !== false; }

    render() {
      const c = this.config, h = this.hass, E = ents(h, c);
      const nS = this.s(E.natt), pS = this.s(E.privat), vS = this.s(E.vekking);
      // Privatmodus byttet (trykk eller hass-oppdatering): lås-klikk (+ ring når den slås på) – samme overgang begge veier
      const pst = pS ? pS.state : null;
      if (this._pPrev != null && pst != null && pst !== this._pPrev) { this._pkT = Date.now(); this._pkOn = pst === 'on'; clearTimeout(this._pkTm); this._pkTm = setTimeout(() => this.update(), 760); }
      this._pPrev = pst;
      const mode = c.scene === 'dag' || c.scene === 'natt' ? c.scene : 'auto';
      const scene = mode !== 'auto' || isOn(nS);
      const top = scene ? this._scene(E, nS, pS, vS, mode === 'dag' ? 'dag' : 'natt') : this._split(E, nS, pS);
      const V = visTabs(c), t = this.tab, lab = c.tab_labels === 'ikon' ? 'i' : c.tab_labels === 'icon' ? 'b' : 't';
      const tabs = `<div class="bar"><div class="tabs" role="tablist" data-glass-drag="x">${V.map((d) => `<button class="tb ${d.key === t ? 'on' : ''}" role="tab" aria-selected="${d.key === t}" aria-label="${esc(d.name)}" data-act="tab" data-v="${esc(d.key)}" ${this._hp('selection')}>${lab !== 't' ? M.icon(d.icon, 18) : ''}${lab !== 'i' ? `<span>${esc(d.name)}</span>` : ''}</button>`).join('')}</div>
        <button class="gear press" data-act="customize" ${this._hp('light')} aria-label="Tilpass Innstillinger">${M.icon('settings', 24)}</button></div>`;
      // Dashbordets egne innstillinger (msh-settings-card) nederst – #settings mister dem ikke (26.15)
      const dash = c.dashbord !== false ? '<div class="gh" data-key="dash-h">Dashbord</div><div class="dash" data-key="dash" data-nomorph></div>' : '';
      return `<div class="wrap">${top}${tabs}<div class="pane" data-key="pane-${esc(t)}">${this._list(t)}</div>${dash}</div>`;
    }
    _pickBtn() { return `<button class="pick press" data-act="customize" data-section="entiteter" ${this._hp('light')}>${M.icon('mdi:plus', 16)}Velg entitet</button>`; }
    // Nattmodus av: to kort side om side
    _split(E, nS, pS) {
      const nOn = isOn(nS), pOn = isOn(pS), ua = !pS || M.unavailable(pS), kl = Date.now() - (this._pkT || 0) < 700;
      const natt = `<div class="mk natt press" ${E.natt ? `data-act="tg" data-id="${esc(E.natt)}" data-ent="${esc(E.natt)}" role="switch" aria-checked="${nOn}" ${this._hp('selection')}` : ''}>
        <svg class="sky" viewBox="0 0 170 90" preserveAspectRatio="xMaxYMin slice" aria-hidden="true">${stars(14, 170, 60, 7)}<circle cx="140" cy="22" r="11" fill="#f2e6b8"/><circle cx="145" cy="18" r="10" fill="#1c2644"/>${house(100, 40, true, false)}</svg>
        <span class="mt">Nattmodus</span>
        <span class="mc"><span class="ci">${M.icon('mdi:power-sleep', 24)}</span></span>
        <span class="mv num">${nS ? (nOn ? 'På' : 'Av') : '–'}</span>
        ${nS ? `<span class="sw ${nOn ? 'on' : ''}"></span>` : this._pickBtn()}</div>`;
      const cls = ['mk', 'priv', pOn ? 'on' : '', ua ? 'ua' : '', this._anim ? '' : 'na', kl ? 'kl' : '', kl && this._pkOn ? 'rg' : ''].filter(Boolean).join(' ');
      const priv = `<div class="${cls} press" data-key="priv" ${E.privat ? `data-act="tg" data-id="${esc(E.privat)}" data-ent="${esc(E.privat)}" role="switch" aria-checked="${pOn}" ${this._hp('medium')}` : ''}>
        <span class="glw" aria-hidden="true"></span>${camera()}
        <span class="mt">Privatmodus</span>
        <span class="mc"><span class="ci sm lk">${M.icon(pOn ? 'mdi:lock' : 'mdi:lock-open-variant-outline', 18)}<span class="ring" aria-hidden="true"></span></span></span>
        <span class="ms">${pS ? (ua ? 'Utilgjengelig' : pOn ? 'Kameraene er av' : 'Kameraene er på') : '–'}</span>
        <span class="mv num">${pS && !ua ? (pOn ? 'På' : 'Av') : '–'}</span>
        ${pS ? `<span class="sw ${pOn ? 'on' : ''}"></span>` : this._pickBtn()}</div>`;
      return `<div class="two" data-key="top-split">${natt}${priv}</div>`;
    }
    // Nattmodus på (eller fast scene): toppkort 184 px
    _scene(E, nS, pS, vS, sky) {
      const nOn = isOn(nS), pOn = isOn(pS), night = sky === 'natt', tid = tidOf(vS);
      const art = night
        ? `${stars(26, 400, 110, 3)}<circle cx="300" cy="40" r="17" fill="#f2e6b8"/><circle cx="308" cy="34" r="15" fill="#15203b"/>`
        : `<circle class="sun" cx="300" cy="44" r="20" fill="#f2d26f"/><circle cx="300" cy="44" r="30" fill="rgba(242,210,111,.25)"/><g transform="translate(236 22)">${birds()}</g>`;
      const chip = (id, s, label, icon, hp) => (id ? `<button class="chip ${isOn(s) ? 'on' : ''} press" data-act="tg" data-id="${esc(id)}" ${this._hp(hp || 'selection')} role="switch" aria-checked="${isOn(s)}">${M.icon(icon, 16)}${esc(label)} · ${s ? (isOn(s) ? 'på' : 'av') : '–'}</button>`
        : `<button class="chip miss press" data-act="customize" data-section="entiteter" ${this._hp('light')}>${M.icon(icon, 16)}${esc(label)} · Velg entitet</button>`);
      return `<div class="scene ${night ? 'night' : 'day'}" data-key="top-scene">
        <svg class="art" viewBox="0 0 400 184" preserveAspectRatio="xMaxYMid slice" aria-hidden="true">${art}
          <rect x="0" y="160" width="400" height="24" fill="${night ? '#141c33' : '#6e9f63'}"/>${house(300, 92, night, !pOn)}</svg>
        <div class="stx"><span class="gt">${night ? (nOn ? 'God natt' : 'Natt') : nOn ? 'Nattmodus på' : 'God dag'}</span>${tid ? `<span class="vk">${M.icon('mdi:alarm', 16)}Vekking kl. ${esc(tid)}</span>` : ''}</div>
        <div class="chips">${chip(E.natt, nS, 'Natt', 'mdi:power-sleep')}${chip(E.privat, pS, 'Privat', 'mdi:cctv-off', 'medium')}</div></div>`;
    }
    _empty(tab) {
      const h = this.hass, R = rules(h, this.config);
      const txt = !R.some((r) => r.kilde === 'integrasjon' && r.plattform === 'ki_notifications') && tab !== 'strom' ? 'Fant ingen regler fra KI Varslinger og sikkerhet'
        : tab === 'strom' && !R.some((r) => r.plattform === 'ki_energi') ? 'Fant ingen varsler fra KI Energi' : 'Ingen rader i denne fanen';
      return `<div class="empty">${M.icon('mdi:bell-off-outline', 22)}<span>${esc(txt)}</span><button class="pick press" data-act="customize" data-section="rader" ${this._hp('light')}>${M.icon('mdi:plus', 18)}Velg entiteter</button></div>`;
    }
    _list(tab) {
      const c = this.config, h = this.hass, all = tabRows(h, c, tab);
      all.forEach((r) => this.s(r.id));
      const q = (this.ui.q || '').trim().toLowerCase();
      let L = q ? all.filter((r) => `${r.name} ${r.sub} ${r.enhet} ${r.id}`.toLowerCase().includes(q)) : all;
      if (c.av_forst) L = [...L.filter((r) => !isOn(h.states[r.id])), ...L.filter((r) => isOn(h.states[r.id]))];
      const on = L.filter((r) => isOn(h.states[r.id])).length, allOn = L.length && on === L.length;
      const d = tabDef(c, tab), nm = d ? d.name : tab;
      const search = c.sok !== false && all.length ? `<label class="srch">${M.icon('mdi:magnify', 20, 'color:#979797')}<input data-input="q" data-key="q" value="${esc(this.ui.q || '')}" placeholder="Søk i ${esc(nm.toLowerCase())}" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="search">${this.ui.q ? `<button class="clr" data-act="qclr" ${this._hp('light')} aria-label="Tøm søk">${M.icon('mdi:close', 18)}</button>` : ''}</label>` : '';
      if (!all.length) return this._empty(tab);
      const head = `<div class="cnt"><span class="num">${on} av ${L.length} på</span><button class="all press" data-act="all" data-v="${allOn ? 'off' : 'on'}" ${this._hp('medium')}>${allOn ? 'Slå alle av' : 'Slå alle på'}</button></div>`;
      const rows = L.map((r) => {
        const s = h.states[r.id], o = isOn(s), un = M.unavailable(s);
        const sub = un ? 'Svarer ikke' : r.sub || '–';
        return `<button class="pr press ${o ? '' : 'off'}" data-key="r-${esc(r.key)}" data-act="tg" data-id="${esc(r.id)}" data-ent="${esc(r.id)}" role="switch" aria-checked="${o}" ${this._hp('selection')} ${un ? 'disabled' : ''}>
          <span class="pi">${M.icon(r.icon, 26)}</span>
          <span class="pt"><b>${esc(r.name)}</b><i>${o || un ? esc(sub) : 'Av · ' + esc(sub)}</i></span>
          <span class="sw ${o ? 'on' : ''}"></span></button>`;
      }).join('');
      return `${search}${head}<div class="rows">${rows || '<div class="none">Ingen treff</div>'}</div>`;
    }
    onInput(name, el) { if (name === 'q') this.setUI({ q: el.value }); }
    onAction(name, el, ev) {
      const d = el.dataset;
      switch (name) {
        case 'tab': return this.setUI({ tab: d.v, q: '' });
        case 'tg': return d.id ? M.call(this.hass, 'homeassistant', 'toggle', { entity_id: d.id }) : undefined;
        case 'qclr': return this.setUI({ q: '' });
        case 'all': {
          const c = this.config, h = this.hass, q = (this.ui.q || '').trim().toLowerCase();
          const L = tabRows(h, c, this.tab).filter((r) => !M.unavailable(h.states[r.id]) && (!q || `${r.name} ${r.sub} ${r.enhet} ${r.id}`.toLowerCase().includes(q))).map((r) => r.id);
          if (L.length) return M.call(h, 'homeassistant', d.v === 'off' ? 'turn_off' : 'turn_on', { entity_id: L });
          return undefined;
        }
        default: return super.onAction(name, el, ev);
      }
    }
    afterRender() {
      if (M.glassDrag) this.shadowRoot.querySelectorAll('.tabs').forEach((s) => M.glassDrag(s, { axis: 'x' }));
      // «Dashbord» nederst: dashbordets innstillinger (msh-settings-card) bygd inn – de forsvinner ikke fra #settings
      const slot = this.shadowRoot.querySelector('.dash');
      if (slot) {
        if (!this._dashEl && customElements.get('msh-settings-card')) { this._dashEl = document.createElement('msh-settings-card'); this._dashEl.setConfig({ type: 'custom:msh-settings-card', embedded: true }); }
        if (this._dashEl) { if (this._dashEl.parentNode !== slot) slot.appendChild(this._dashEl); if (this._dashEl.hass !== this.hass) this._dashEl.hass = this.hass; }
      }
    }
    get styles() {
      return `
        :host{display:block;width:100%}
        .wrap,.pane{display:flex;flex-direction:column;gap:var(--msh-gap,8px);min-width:0}
        .dash{display:block;min-width:0}
        .gh{font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#7f7f7f;padding:16px 8px 0}
        /* to kort (nattmodus av) */
        .two{display:grid;grid-template-columns:1fr 1fr;gap:var(--msh-gap,8px)}
        .mk{position:relative;height:164px;border-radius:28px;overflow:hidden;isolation:isolate;padding:14px 14px 12px;display:flex;flex-direction:column;align-items:flex-start;text-align:left;cursor:pointer;min-width:0;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.05)}
        .mk.natt{background:linear-gradient(160deg,#243259 0%,#141c33 100%)}
        .mk.priv{background:var(--gray200,#3a3a3a);transition:background .3s}
        .mk.priv.on{background:linear-gradient(160deg,#3f8a63 0%,#1f4a36 100%)}
        .mk .glw{position:absolute;inset:auto -30% -50% auto;width:120%;height:120%;z-index:-1;border-radius:50%;background:radial-gradient(circle, rgba(102,209,158,.45), transparent 60%);opacity:0;transition:opacity .3s}
        .mk.priv.on .glw{opacity:1}
        .sky{position:absolute;right:0;top:0;width:100%;height:92px;z-index:-1}
        .mt{font-size:13px;color:rgba(255,255,255,.75);white-space:nowrap}
        .mc{display:flex;gap:6px;margin-top:10px}
        .ci{width:44px;height:44px;border-radius:22px;display:grid;place-items:center;background:rgba(255,255,255,.14);flex:none;position:relative}
        .ci.sm{width:36px;height:36px;border-radius:18px}
        .ms{font-size:11px;color:rgba(255,255,255,.75);margin-top:4px;white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis}
        .mv{font-size:28px;font-weight:500;line-height:1;margin-top:auto}
        .mk .sw{position:absolute;right:12px;bottom:12px}
        .mk .pick{position:absolute;right:10px;bottom:10px;height:32px;padding:0 10px;font-size:12px}
        /* Privatmodus: overvåkingskamera (bare transform/opacity animeres) */
        .pcam{position:absolute;right:0;top:12px;width:64px;height:44px;overflow:visible;z-index:-1;pointer-events:none}
        .pcam .cm-body{fill:#e1e1e1}.pcam .cm-hood{fill:#c7c7c7}.pcam .cm-lensh{fill:#545454}.pcam .cm-lens{fill:#232323}.pcam .cm-glint{fill:rgba(255,255,255,.7)}
        .pcam .cm-arm{fill:#afafaf}.pcam .cm-wall{fill:#979797}
        .pcam .cm-shut{fill:#696969;transform-origin:10px 15px;transform:scaleY(0);transition:transform .45s cubic-bezier(.2,.8,.2,1) .15s}
        .pcam .cm-tilt,.pcam .cm-sweep{transform-origin:47px 22px}
        .pcam .cm-tilt{transition:transform .8s cubic-bezier(.34,1.56,.64,1)}
        .pcam .cm-sweep{animation:msh-sweep 5s ease-in-out infinite alternate}
        @keyframes msh-sweep{from{transform:rotate(-15deg)}to{transform:rotate(15deg)}}
        .pcam .cm-cone{opacity:.9;transition:opacity .4s}
        .pcam .cm-rec{fill:var(--red,#f28073);animation:msh-rec 1.2s steps(1,end) infinite}
        @keyframes msh-rec{50%{opacity:.12}}
        .pcam .cm-ok{fill:var(--green,#66d19e);opacity:0;transition:opacity .3s .3s}
        .mk.priv.on .cm-tilt{transform:rotate(-32deg)}
        .mk.priv.on .cm-sweep{animation-play-state:paused}
        .mk.priv.on .cm-cone{opacity:0}
        .mk.priv.on .cm-shut{transform:scaleY(1)}
        .mk.priv.on .cm-rec{opacity:0;animation:none}
        .mk.priv.on .cm-ok{opacity:1}
        .mk.priv.ua .cm-sweep,.mk.priv.ua .cm-rec{animation:none}
        .mk.priv.ua .cm-cone,.mk.priv.ua .cm-rec,.mk.priv.ua .cm-ok{opacity:0}
        .mk.priv.ua .cm-body,.mk.priv.ua .cm-hood{fill:#7f7f7f}
        /* lås-klikk ved bytte + ring når privatmodus slås på */
        .lk .ring{position:absolute;inset:0;border-radius:50%;box-shadow:0 0 0 2px rgba(255,255,255,.8);opacity:0;pointer-events:none}
        .mk.priv.kl .lk ha-icon{animation:msh-lock .5s cubic-bezier(.34,1.56,.64,1)}
        @keyframes msh-lock{0%{transform:scale(1)}35%{transform:scale(.72)}70%{transform:scale(1.12)}100%{transform:scale(1)}}
        .mk.priv.rg .lk .ring{animation:msh-ring .7s ease-out 1}
        @keyframes msh-ring{0%{transform:scale(.8);opacity:.9}100%{transform:scale(2.2);opacity:0}}
        .mk.priv.na .cm-sweep,.mk.priv.na .cm-rec,.mk.priv.na .lk ha-icon,.mk.priv.na .lk .ring{animation:none !important}
        .mk.priv.na .cm-tilt,.mk.priv.na .cm-shut,.mk.priv.na .cm-cone,.mk.priv.na .cm-ok{transition:none !important}
        .st{animation:tw 3s ease-in-out infinite}@keyframes tw{50%{opacity:.35}}
        .smoke circle{animation:smoke 4s ease-out infinite}.smoke circle:nth-child(2){animation-delay:1.3s}.smoke circle:nth-child(3){animation-delay:2.6s}
        @keyframes smoke{0%{transform:translateY(6px);opacity:0}30%{opacity:1}100%{transform:translate(4px,-10px);opacity:0}}
        .cam{animation:cam 1.4s ease-in-out infinite}@keyframes cam{50%{opacity:.2}}
        .win{filter:drop-shadow(0 0 4px rgba(242,210,111,.8))}
        /* scene (nattmodus på) */
        .scene{position:relative;height:184px;border-radius:28px;overflow:hidden;isolation:isolate;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.05)}
        .scene.night{background:linear-gradient(180deg,#141c33 0%,#243259 100%)}
        .scene.day{background:linear-gradient(180deg,#73b9f2 0%,#c8ddfa 100%);color:#1b2338}
        .art{position:absolute;inset:0;width:100%;height:100%;z-index:-1}
        .birds .b1,.birds .b2{animation:fly 6s ease-in-out infinite}.birds .b2{animation-delay:.6s}
        @keyframes fly{50%{transform:translate(-14px,-4px)}}
        .stx{position:absolute;left:18px;top:18px;display:flex;flex-direction:column;gap:6px}
        .gt{font-size:28px;font-weight:500;line-height:1.1}
        .vk{display:inline-flex;align-items:center;gap:6px;font-size:13px;opacity:.85}
        .scene .chips{position:absolute;left:14px;bottom:14px;right:14px;display:flex;gap:6px;flex-wrap:wrap}
        .chip{height:34px;padding:0 12px;border-radius:17px;display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:500;background:rgba(0,0,0,.28);color:#fafafa;white-space:nowrap;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
        .chip.on{background:rgba(250,250,250,.9);color:#1b2338}
        .chip.miss{background:rgba(242,181,115,.3)}
        /* faner + tannhjul */
        .bar{display:flex;align-items:center;gap:8px;min-width:0}
        .tabs{flex:1;min-width:0;display:flex;gap:2px;padding:4px;border-radius:28px;background:var(--gray200,#3a3a3a);position:relative;touch-action:pan-y}
        .tb{flex:1 1 auto;min-width:0;height:48px;padding:0 8px;border-radius:24px;font-size:14px;white-space:nowrap;color:var(--gray800,#afafaf);display:inline-flex;align-items:center;justify-content:center;gap:6px;overflow:hidden}
        .tb span{overflow:hidden;text-overflow:ellipsis}
        .tb.on{background:${C.accent};color:#2a1720;font-weight:500}
        .gear{width:56px;height:56px;border-radius:28px;background:var(--gray200,#3a3a3a);display:grid;place-items:center;flex:none}
        /* søk, teller, rader */
        .srch{display:flex;align-items:center;gap:8px;height:48px;border-radius:24px;background:var(--gray200,#3a3a3a);padding:0 6px 0 16px}
        .srch input{flex:1;min-width:0;height:100%;font-size:15px}
        .clr{width:36px;height:36px;border-radius:18px;display:grid;place-items:center;background:var(--gray300,#404040)}
        .cnt{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:2px 6px 0;font-size:13px;color:#afafaf;white-space:nowrap}
        .all{height:36px;padding:0 14px;border-radius:18px;background:var(--gray200,#3a3a3a);color:#fafafa;font-size:13px;font-weight:500;white-space:nowrap;flex:none}
        .rows{display:flex;flex-direction:column;gap:8px}
        .pr{display:flex;align-items:center;gap:12px;min-height:66px;border-radius:34px;background:var(--gray200,#3a3a3a);padding:4px 16px 4px 4px;text-align:left;width:100%}
        .pr[disabled]{opacity:.5}
        .pi{width:58px;height:58px;border-radius:29px;background:#4a4a4a;display:grid;place-items:center;flex:none}
        .pt{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
        .pt b{font-size:15px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .pt i{font-style:normal;font-size:12px;color:#979797;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .pr.off .pi{color:var(--red,#f28073)} .pr.off .pt i{color:var(--red,#f28073)}
        .sw{position:relative;width:44px;height:26px;border-radius:13px;background:var(--gray400,#545454);flex:none;transition:background .2s}
        .sw::after{content:'';position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:10px;background:#fafafa;transition:transform .2s cubic-bezier(.34,1.4,.64,1)}
        .sw.on{background:var(--pink,#f285c9)}.sw.on::after{transform:translateX(18px)}
        .none{padding:14px;color:#979797;font-size:13px;text-align:center}
        @media (max-width:380px){.tb{font-size:13px;padding:0 4px}.mv{font-size:24px}.pcam{width:54px;height:37px}}
        @media (prefers-reduced-motion: reduce){.st,.smoke circle,.cam,.birds .b1,.birds .b2,.cm-sweep,.cm-rec,.lk ha-icon,.lk .ring{animation:none !important}.cm-tilt,.cm-shut,.cm-cone,.cm-ok{transition:none !important}}`;
    }
  }
  M.define('msh-innstillinger-card', Innstillinger, 'MSH Innstillinger', 'Innstillinger-popupen (#settings): natt-/privatmodus, regler fra KI Varslinger og sikkerhet (automasjoner, varsler), strøm fra KI Energi og dashbordets innstillinger (fiks 26.15).');
})();
