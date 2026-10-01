/* KI MSH · Innstillinger (#settings, msh-innstillinger-card) – fiks 25.5 + 26.15 + 27.5–27.7, fasit design/Innstillinger v2.dc.html.
 * Étt kort i Bubble-popupen #settings (mal A).
 *
 * #settings (fiks 26.15): brukerens importerte ki-cards-popup «Innstillinger» (gap-card + ki-natt-card + ki-tabs-card med
 * ki-varsling-card) erstattes av DETTE kortet: MSH.POPUP_SUPERSEDE['#settings'] gjør den importerte popupen inaktiv
 * («Erstattet av Innstillinger», «Bruk egen» i Egne popups gir den tilbake), og MSH.POPUP_EXTRA['#settings'] flytter
 * oppsettet over (MSH.innstExtra): ki-natt-card natt → natt, helg (privatmodus-bryter) → privat, vekking → vekking;
 * ki-tabs-card tabs[i] (ki-varsling-card) → tabs[i] { key, title, filter }; ekstra → rows.include (+ rows.move),
 * skjul → rows.exclude, navn/undertekst/ikoner → rows.names/subs/icons. Strategien (04-strategy) genererer #settings med
 * dette kortet (card_id pop-innstillinger). Dashbordinnstillingene (msh-settings-card) ligger nederst under «Dashbord».
 *
 * 27.5 · KUN VARSLER: listen viser bare varsel-brytere fra KI Varslinger og sikkerhet (ki_notifications, én rad per regel =
 *   hovedbryteren, erMaster), varslingsbryterne i KI Energi og input_boolean.varsel_*. Automasjoner (vekking, ansikt,
 *   autolås, dørlys, utelys), alarm-/synk-brytere (Heimdall/Alarmo) og andre entiteter vises IKKE.
 *   Fanene er varsel-KATEGORIER: Sikkerhet · Hjem · Strøm (standard). Kategori per regel: attributtet kategori/category →
 *   KI_VARS_TEKST → nøkkelord (KI_VARS_KAT: kamera, klima, hvitevarer, batteri, sikkerhet, strøm) → Hjem.
 *   Kategorier uten egen fane vises i standardfanen (Kamera → Sikkerhet, resten → Hjem).
 * 27.7 · EGNE FANER: custom_tabs: [{ key, name, icon, source }] – source = kategori i KI Varslinger (autooppdaget, med
 *   antall regler); fanen viser kategoriens varsel-brytere live, nye regler dukker opp av seg selv. Slettes/omorganiseres
 *   som de andre (rekkefølge/skjult i tabs[]). Fanelinjen tåler 4+ faner (teksten krymper, > 4 → vannrett scroll).
 * 27.6 · TOPPKORTET: nattmodus av → to kort (Nattmodus · Privatmodus). Nattmodus på → «God natt»-kortet (184 px), og om
 *   morgenen (nattmodus av, kl. 05–11 eller etter vekketid) → «God morgen» med soloppgang (himmel natt-lilla → morgen,
 *   sola stiger 2,6 s, fugler). Trykk på HELE kortet slår nattmodus av/på; chipsene har egen handling. Optimistisk UI:
 *   kortet byttes straks, «Synker …» til hass bekrefter, ellers tilbakerulling etter 10 s (MSH.innstSyncMs) + melding –
 *   også for privatmodus. Privatmodus-kortet: kamera på veggfeste (top 74 px) – av: camscan + lyskjegle + blinkende REC;
 *   på: vipper ned 38° (spring), lokket glir over linsen, REC slukker, lås «lockpop» + ring (bare transform/opacity).
 * Config:
 *   natt · privat · vekking (entitetene i toppkortet)
 *   tabs: [{ key, title?, hidden?, filter?: { enheter, ikke_enheter, plattform } }]  (sikkerhet · hjem · strom · egne)
 *   custom_tabs: [{ key, name, icon, source }]
 *   rows: { exclude: [device_id|entity_id], move: { id: fane }, include: [entity_id], names, subs, icons, order: { fane: [id] } }
 *   tab_labels (icon = ikon + tekst (standard) | name = tekst | ikon = ikoner) · start_tab · sok · show_summary (true) ·
 *   av_forst · haptikk · scene (auto | morgen | dag = kun kort | natt) · animasjoner (true) · dashbord (true) · gap · pad_*
 * Eldre nøkler leses fortsatt: tab_order/tab_hidden/tab_names, faner automasjoner → sikkerhet og varsler → hjem.
 */
(function () {
  const M = window.MSH;
  if (!M) return;
  const esc = M.esc, C = M.C;
  M.innstNow = M.innstNow || (() => new Date()); // klokka (testene kan sette den)
  if (M.innstSyncMs == null) M.innstSyncMs = 10000; // tilbakerulling når hass ikke bekrefter

  /* ============================================================ KI Varslinger og sikkerhet (fra ki-cards 83-ki-varsling-card.js) */
  const KI_VARS_PLATTFORM = ['ki_notifications', 'ki_energi'];
  /* Navn, beskrivelse, ikon og kategori per regel (ki-varsling-card: KI_VARS_TEKST). Kategori 'auto' = automasjon eller
     synk (ikke et varsel) → vises ikke (27.5). */
  const KI_VARS_TEKST = [
    [/vekking|vekke/, 'Vekking', 'Lys og lyd på vekketidspunkt', 'mdi:alarm', 'auto'],
    [/ansikt/, 'Ansiktsgjenkjenning', 'Låser opp ved gjenkjent ansikt', 'mdi:face-recognition', 'auto'],
    [/autolas|autolås/, 'Autolås', 'Låser døra automatisk etter lukking', 'mdi:lock-clock', 'auto'],
    [/fastkjort|fastkjørt/, 'Fastkjørt lås', 'Varsel hvis låsen ikke går i lås', 'mdi:lock-alert', 'sikkerhet'],
    [/blink|dorlys|dørlys/, 'Dørlys', 'Blinker med lyset når døra åpnes', 'mdi:monitor-shimmer', 'auto'],
    [/dor_?last|dør_?låst|dor_?apnet|dør låst|dørlås|dorlas/, 'Dør låst/åpnet', 'Varsel med kamerabilde', 'mdi:door-closed-lock', 'sikkerhet'],
    [/ringeklokke|doorbell/, 'Ringeklokke', 'Varsel med bilde når noen ringer', 'mdi:doorbell', 'sikkerhet'],
    [/familie|hjemme.?borte/, 'Hjemme / borte', 'Varsler når noen kommer eller drar', 'mdi:home-account', 'hjem'],
    [/^alarm|alarm_/, 'Alarm', 'Varsel når alarmen går eller endres', 'mdi:shield-home', 'sikkerhet'],
    [/heimdall|alarmo/, 'Heimdall', 'Synk mellom Heimdall og Alarmo', 'mdi:sync', 'auto'],
    [/ruter|skolen/, 'Ruter fra skolen', 'Avgangstider hjem etter forelesning', 'mdi:bus-clock', 'hjem'],
    [/planter/, 'Planter', 'Varsel når plantene trenger vann', 'mdi:flower-tulip', 'hjem'],
    [/stovsug|støvsug/, 'Støvsuger', 'Varsel om feil og fullført runde', 'mdi:robot-vacuum', 'hjem'],
    [/home.?assistant|oppstart|startet/, 'Home Assistant', 'Varsel etter omstart av HA', 'mdi:home-assistant', 'hjem'],
    [/vaermelding|værmelding|vaer_ai/, 'Værmelding', 'Daglig værvarsel fra AI', 'mdi:weather-partly-cloudy', 'hjem'],
    [/stromforbruk|strømforbruk|forbruk.?rapport/, 'Strømforbruk', 'Daglig rapport', 'mdi:chart-bar', 'strom'],
    /* KI Utelys – automatikk, ikke varsler */
    [/ki_utelys/, 'Utelys', 'Styrer utelysene etter solhøyden', 'mdi:lightbulb-auto', 'auto'],
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
  // Kategori fra nøkkelord når regelen er ukjent (rekkefølgen betyr noe: kamera før sikkerhet)
  const KI_VARS_KAT = [
    [/kamera|camera|bevegelse|motion|pakke|ukjent.?person|person.?alert/, 'kamera'],
    [/fukt|humid|vindu|frost|temperatur|klima|ventilasjon/, 'klima'],
    [/vaskemaskin|torketrommel|tørketrommel|oppvask|hvitevare/, 'hvitevarer'],
    [/batteri|battery|offline|svarer.?ikke/, 'batteri'],
    [/alarm|lås|_las|dor|dør|ringeklokke|innbrudd|royk|røyk|lekk|sikkerhet/, 'sikkerhet'],
    [/strom|strøm|energi|effekt/, 'strom'],
  ];
  const KI_VARS_IKON = [
    [/fastkjort|fastkj/, 'mdi:lock-alert'], [/autolas|autolås/, 'mdi:lock-clock'], [/las|lås|dor|dør/, 'mdi:door-closed-lock'],
    [/alarm|heimdall|alarmo/, 'mdi:shield-home'], [/ansikt|face/, 'mdi:face-recognition'], [/familie|hjemme|borte|person/, 'mdi:home-account'],
    [/stovsug|støvsug|vacuum/, 'mdi:robot-vacuum'], [/vaer|vær|weather/, 'mdi:weather-partly-cloudy'], [/ruter|buss|avgang/, 'mdi:bus-clock'],
    [/strom|strøm|forbruk|energi/, 'mdi:chart-bar'], [/oppstart|restart|startup/, 'mdi:restart'], [/bevegelse|motion/, 'mdi:walk'],
    [/pakke/, 'mdi:package-variant-closed'], [/fukt|humid/, 'mdi:water-percent'], [/vindu/, 'mdi:window-open-variant'], [/frost/, 'mdi:snowflake'],
    [/vaskemaskin/, 'mdi:washing-machine'], [/torketrommel|tørketrommel/, 'mdi:tumble-dryer'], [/oppvask/, 'mdi:dishwasher'], [/batteri|battery/, 'mdi:battery-alert'],
    [/kamera|camera/, 'mdi:cctv'], [/rapport|daglig/, 'mdi:file-document-outline'],
  ];
  const kiVarsIkon = (tekst) => { const t = String(tekst || '').toLowerCase(); for (const [m, ikon] of KI_VARS_IKON) if (m.test(t)) return ikon; return 'mdi:bell-outline'; };
  // Hovedbryteren i en regel (ki-varsling-card, uendret)
  const erMaster = (b) => /alle[ _-]?varsler|_aktivert$|_varsling$|_aktiv$|_auto$|_automatikk$/.test(b.id)
    || b.slug === b.enhet.toLowerCase().replace(/[^a-z0-9]+/g, '_')
    || /^(alle varsler|aktivert|varsling|aktiv)$/i.test(b.under || '');
  M.KI_VARS_TEKST = KI_VARS_TEKST;
  M.kiVarsErMaster = erMaster;

  /* ============================================================ kategorier og faner */
  const slugOf = (t) => String(t || '').toLowerCase().replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'a').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const BUILTIN = { sikkerhet: ['Sikkerhet', 'mdi:shield'], hjem: ['Hjem', 'mdi:home'], strom: ['Strøm', 'mdi:lightning-bolt'] };
  const KAT = { ...BUILTIN, kamera: ['Kamera', 'mdi:video'], klima: ['Klima', 'mdi:thermostat'], hvitevarer: ['Hvitevarer', 'mdi:washing-machine'], batteri: ['Batteri', 'mdi:battery-alert'] };
  const KAT_TAB = { kamera: 'sikkerhet' }; // kategorier uten egen fane: Kamera → Sikkerhet, resten → Hjem
  const katName = (k) => (KAT[k] ? KAT[k][0] : String(k || '').replace(/_/g, ' ').replace(/^./, (x) => x.toUpperCase()));
  const katIcon = (k) => (KAT[k] ? KAT[k][1] : 'mdi:bell-outline');
  const katTab = (k) => (BUILTIN[k] ? k : KAT_TAB[k] || 'hjem');
  // Eldre fane-nøkler (25.5/26.15): automasjoner → sikkerhet, varsler → hjem
  const LEGACY = { automasjoner: 'sikkerhet', varsler: 'hjem', auto: 'sikkerhet', push: 'hjem', energi: 'strom' };
  const LEGACY_TITLE = /^(automasjoner|varsler)$/i;
  const keyOf = (k) => (k == null ? k : LEGACY[k] || String(k));
  const edOrder = (keys, saved) => { const o = (Array.isArray(saved) ? saved : []).map(keyOf).filter((k) => keys.includes(k)); keys.forEach((k) => { if (!o.includes(k)) o.push(k); }); return [...new Set(o)]; };
  const arr = (v) => (Array.isArray(v) ? v.filter((x) => x != null && x !== '').map(String) : []);
  const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  const hasFilter = (f) => !!f && ['enheter', 'ikke_enheter', 'plattform'].some((k) => arr(f[k]).length);
  // Egne faner (27.7): custom_tabs [{ key, name, icon, source }]
  const customTabs = (c) => (Array.isArray(c.custom_tabs) ? c.custom_tabs : []).filter((t) => t && t.key && t.source).map((t) => ({ key: String(t.key), name: String(t.name || katName(t.source)), icon: String(t.icon || katIcon(t.source)), source: String(t.source) }));
  // Fanene: tabs[] (rekkefølge/skjult/tittel) + custom_tabs – ellers 25.5-nøklene tab_order/tab_hidden/tab_names.
  function tabDefs(c) {
    const CT = customTabs(c), cmap = new Map(CT.map((t) => [t.key, t]));
    let L;
    if (Array.isArray(c.tabs) && c.tabs.length) {
      L = c.tabs.filter((t) => t && t.key).map((t) => { const k = keyOf(t.key), legacy = k !== String(t.key); let title = t.title ? String(t.title) : ''; if (legacy && LEGACY_TITLE.test(title)) title = ''; return { key: k, title, hidden: !!t.hidden, filter: hasFilter(t.filter) ? t.filter : null, icon: t.icon || '' }; });
    } else { const N = obj(c.tab_names), H = new Set(arr(c.tab_hidden).map(keyOf)); L = edOrder(Object.keys(BUILTIN), c.tab_order).map((k) => ({ key: k, title: N[k] || '', hidden: H.has(k), filter: null, icon: '' })); }
    const seen = new Set();
    L = L.filter((t) => (seen.has(t.key) || !(BUILTIN[t.key] || cmap.has(t.key) || t.filter) ? false : seen.add(t.key)));
    Object.keys(BUILTIN).forEach((k) => { if (!seen.has(k)) { seen.add(k); L.push({ key: k, title: '', hidden: false, filter: null, icon: '' }); } });
    CT.forEach((t) => { if (!seen.has(t.key)) { seen.add(t.key); L.push({ key: t.key, title: '', hidden: false, filter: null, icon: '' }); } });
    return L.map((t) => { const ct = cmap.get(t.key) || null; return { ...t, builtin: !!BUILTIN[t.key], custom: !!ct, source: ct ? ct.source : null, name: t.title || (ct ? ct.name : BUILTIN[t.key] ? BUILTIN[t.key][0] : t.key), icon: ct ? ct.icon : t.icon || (BUILTIN[t.key] ? BUILTIN[t.key][1] : 'mdi:tab') }; });
  }
  const tabsOut = (defs) => defs.map((t) => { const o = { key: t.key }; if (t.title) o.title = t.title; if (t.hidden) o.hidden = true; if (hasFilter(t.filter)) o.filter = t.filter; return o; });
  const visTabs = (c) => { const D = tabDefs(c), V = D.filter((t) => !t.hidden); return V.length ? V : D.slice(0, 1); };
  const tabDef = (c, k) => tabDefs(c).find((t) => t.key === keyOf(k)) || null;
  // rows (26.15) – ellers 25.5-nøklene include/exclude per fane
  function rowsCfg(c) {
    const r = obj(c.rows), order = {};
    Object.entries(obj(r.order)).forEach(([k, v]) => { const kk = keyOf(k); if (!order[kk]) order[kk] = v; });
    const o = { exclude: arr(r.exclude), move: { ...obj(r.move) }, include: arr(r.include), names: obj(r.names), subs: obj(r.subs), icons: obj(r.icons), order };
    if (!c.rows) {
      Object.entries(obj(c.include)).forEach(([t, L]) => arr(L).forEach((id) => { if (!o.include.includes(id)) o.include.push(id); o.move[id] = t; }));
      Object.values(obj(c.exclude)).forEach((L) => arr(L).forEach((id) => { if (!o.exclude.includes(id)) o.exclude.push(id); }));
    }
    return o;
  }
  const rowsOut = (W) => { const o = {}; Object.keys(W).forEach((k) => { const x = W[k]; if (Array.isArray(x) ? x.length : Object.keys(x).length) o[k] = x; }); return Object.keys(o).length ? o : undefined; };
  const pick = (O, r) => { for (const k of [r.key, r.id, r.dev, r.slug]) if (k && O[k] != null && O[k] !== '') return O[k]; return undefined; };
  const inList = (L, r) => [r.key, r.id, r.dev, r.slug].some((k) => k && L.includes(k));
  const moveTab = (v) => (v == null || v === '' ? null : keyOf(String(v)));

  /* ============================================================ regler (én rad per regel, bare varsler) */
  let memo = null;
  function rules(h, c) {
    if (!h) return [];
    if (memo && memo.s === h.states && memo.e === h.entities && memo.d === h.devices && memo.c === c) return memo.r;
    const R = rowsCfg(c), reg = h.entities || {}, dev = h.devices || {}, ut = [];
    const legg = (id, kilde) => {
      const st = h.states[id];
      if (!st || ut.some((b) => b.id === id)) return;
      const slug = id.split('.')[1] || id;
      const e = reg[id] || {}, D = dev[e.device_id] || {};
      const enhet = D.name_by_user || D.name || '';
      const a = st.attributes || {};
      // friendly_name deles på « - »: navnet foran, beskrivelsen bak («Alarm - Alle varsler»)
      const helt = a.friendly_name || slug, deler = helt.split(' - ');
      let navn = deler[0].trim() || slug, under = deler.length > 1 ? deler.slice(1).join(' - ').trim() : '';
      if (!under && enhet && helt.toLowerCase().startsWith(enhet.toLowerCase() + ' ')) { navn = enhet; under = helt.slice(enhet.length + 1).trim(); }
      const n = `${slug} ${enhet} ${helt}`.toLowerCase();
      let kjentIkon = null, kat = null;
      for (const [m, kn, ku, ki, kk] of KI_VARS_TEKST) {
        if (!m.test(n)) continue;
        kat = kk;
        if (c.kjente !== false) { navn = kn; under = ku; kjentIkon = ki; }
        break;
      }
      if (kat === 'auto' && kilde !== 'ekstra') return; // automasjon / synk – ikke et varsel (27.5)
      if (kat === 'auto') kat = null;
      const ak = a.kategori || a.category || a.gruppe;
      if (ak) kat = slugOf(ak) || kat;
      if (e.platform === 'ki_energi') kat = 'strom';
      if (!kat) for (const [m, kk] of KI_VARS_KAT) if (m.test(n)) { kat = kk; break; }
      ut.push({ id, slug, kilde, plattform: e.platform || '', dev: e.device_id || null, enhet: enhet || 'Annet', navn: navn.trim() || enhet || slug, under, ikon: kjentIkon || a.icon || kiVarsIkon(`${slug} ${navn}`), cat: kat || 'hjem' });
    };
    for (const [id, e] of Object.entries(reg)) {
      if (!e || !KI_VARS_PLATTFORM.includes(e.platform)) continue;
      if (!id.startsWith('switch.') && !id.startsWith('input_boolean.')) continue;
      if (e.platform === 'ki_energi' && !/varsel|varsler|spor_/.test(id)) continue; // bare varslingsbryterne i KI Energi
      legg(id, 'integrasjon');
    }
    // input_boolean.varsel_* (varsel-regler som hjelpere, uansett integrasjon)
    Object.keys(h.states).filter((id) => /^input_boolean\.varsel_/.test(id)).sort().forEach((id) => legg(id, 'integrasjon'));
    R.include.forEach((id) => legg(id, 'ekstra'));
    // Én bryter per regel: hovedbryteren (ki-varsling-card). KI Energi og regler uten enhet: ingen sammenslåing.
    const perEnhet = new Map();
    if (c.master !== false) {
      const fri = (b) => b.kilde === 'ekstra' || b.plattform === 'ki_energi' || !b.dev;
      for (const b of ut) { if (fri(b)) continue; if (!perEnhet.has(b.dev)) perEnhet.set(b.dev, []); perEnhet.get(b.dev).push(b); }
      const behold = new Set(ut.filter(fri).map((b) => b.id));
      for (const [, liste] of perEnhet) { const m = liste.length > 1 ? liste.filter(erMaster) : liste; (m.length ? m : liste).forEach((b) => behold.add(b.id)); }
      for (let i = ut.length - 1; i >= 0; i--) if (!behold.has(ut[i].id)) ut.splice(i, 1);
    }
    const perDev = new Map();
    ut.forEach((b) => { if (b.dev && b.kilde !== 'ekstra') perDev.set(b.dev, (perDev.get(b.dev) || 0) + 1); });
    const out = ut.map((b) => {
      const r = { ...b, key: b.kilde !== 'ekstra' && b.dev && perDev.get(b.dev) === 1 ? b.dev : b.id, all: b.dev ? Object.keys(reg).filter((x) => reg[x] && reg[x].device_id === b.dev) : [b.id] };
      r.tab = katTab(b.cat);
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
  // Kategoriene i KI Varslinger (autooppdaget) med antall regler – til «Legg til fane»
  function kategorier(h, c) {
    const n = new Map();
    const seen = new Set();
    rules(h, c).filter((r) => r.kilde === 'integrasjon').forEach((r) => { const g = r.cat + '|' + (r.dev || r.id); if (seen.has(g)) return; seen.add(g); n.set(r.cat, (n.get(r.cat) || 0) + 1); });
    return [...n.entries()].map(([key, count]) => ({ key, count, name: katName(key), icon: katIcon(key) })).sort((a, b) => a.name.localeCompare(b.name, 'nb'));
  }
  M.innstKategorier = kategorier;
  const treff = (navn, liste) => liste.some((m) => String(navn).toLowerCase().includes(String(m).toLowerCase()));
  function inTab(r, t, own) {
    if (r.move) return r.move === t.key;
    if (t.source) return r.cat === t.source;
    if (hasFilter(t.filter)) {
      const f = t.filter, P = arr(f.plattform), E = arr(f.enheter), I = arr(f.ikke_enheter);
      if (P.length && r.kilde !== 'ekstra' && !P.includes(r.plattform)) return false;
      if (E.length && r.kilde !== 'ekstra' && !treff(r.enhet, E)) return false;
      if (I.length && treff(r.enhet, I)) return false;
      return true;
    }
    if (!t.builtin || own.has(r.cat)) return false; // kategorien har egen (synlig) fane
    return r.tab === t.key;
  }
  // Radene i en fane: autokonfig + include − exclude, i lagret rekkefølge (rows.order) – ellers hovedbryter først og alfabetisk
  function tabRows(h, c, key, opts) {
    const D = tabDefs(c), t = D.find((x) => x.key === keyOf(key));
    if (!t) return [];
    const R = rowsCfg(c), own = new Set(D.filter((x) => x.custom && !x.hidden).map((x) => x.source));
    let L = rules(h, c).filter((r) => inTab(r, t, own));
    if (!(opts && opts.withHidden)) L = L.filter((r) => !r.hidden);
    L.sort((a, b) => (b.master && b.plattform === 'ki_energi') - (a.master && a.plattform === 'ki_energi') || a.name.localeCompare(b.name, 'nb'));
    const O = arr(R.order[t.key]);
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
  const minOf = (t) => { const m = /^(\d\d):(\d\d)$/.exec(t || ''); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };

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
    if (/sikkerhet|automasjon|automation/.test(t)) return 'sikkerhet';
    if (/varsl|push|notif|hjem/.test(t)) return 'hjem';
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
      if (t.title && (!BUILTIN[key] || (t.title !== BUILTIN[key][0] && !LEGACY_TITLE.test(String(t.title))))) o.title = String(t.title);
      if (!BUILTIN[key]) { const f = {}; ['enheter', 'ikke_enheter', 'plattform'].forEach((k) => { const L = arr([].concat(v[k] || [])); if (L.length) f[k] = L; }); if (Object.keys(f).length) o.filter = f; }
      tabs.push(o);
      arr(v.ekstra).forEach((id) => { if (!R.include.includes(id)) R.include.push(id); R.move[id] = key; });
      arr(v.skjul).forEach((s) => { if (!R.exclude.includes(s)) R.exclude.push(s); });
      Object.assign(R.names, obj(v.navn)); Object.assign(R.subs, obj(v.undertekst)); Object.assign(R.icons, obj(v.ikoner));
    });
    if (tabs.length) out.tabs = tabs;
    const rows = rowsOut(R);
    if (rows) out.rows = rows;
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

  /* ============================================================ fanelinjen (kortet + forhåndsvisningen i arket) */
  const tabMode = (c) => (c.tab_labels === 'ikon' ? 'i' : c.tab_labels === 'name' ? 't' : 'b');
  // o: { preview, hp (data-haptic for fanene), hpGear }
  function tabBar(c, V, cur, o) {
    const m = tabMode(c), pv = !!o.preview, tag = pv ? 'span' : 'button';
    const btn = (d) => `<${tag} class="tb ${d.key === cur ? 'on' : ''}" data-key="tb-${esc(d.key)}" ${pv ? '' : `role="tab" aria-selected="${d.key === cur}" aria-label="${esc(d.name)}" data-act="tab" data-v="${esc(d.key)}" ${o.hp || ''}`}>${m !== 't' ? M.icon(d.icon, 20) : ''}${m !== 'i' ? `<span class="tl">${esc(d.name)}</span>` : ''}</${tag}>`;
    const gear = pv ? `<span class="gear">${M.icon('settings', 24)}</span>` : `<button class="gear press" data-act="customize" ${o.hpGear || ''} aria-label="Tilpass Innstillinger">${M.icon('settings', 24)}</button>`;
    return `<div class="bar${pv ? ' pv' : ''}" ${pv ? 'aria-hidden="true"' : ''}><div class="tabs m-${m}${V.length > 4 ? ' many' : ''}" ${pv ? '' : 'role="tablist" data-glass-drag="x"'}>${V.map(btn).join('')}</div>${gear}</div>`;
  }
  // Design: fanelinje r26 pad 4 gap 2 (#3a3a3a + innerkant), knapper 56 px (ikon + tekst, 11 px) / 44 px (13 px), rosa aktiv.
  // 4 faner: teksten krymper (ellipsis); > 4: vannrett scroll. P = prefiks (kortet: '', arket: '.pvw ').
  const TAB_CSS = (P) => `
    ${P}.bar{display:flex;align-items:center;gap:8px;min-width:0;margin:4px 0}
    ${P}.tabs{flex:1;min-width:0;display:flex;gap:2px;padding:4px;border-radius:26px;background:var(--gray200,#3a3a3a);box-shadow:inset 0 0 0 1px rgba(255,255,255,0.05);position:relative;overflow-x:auto;scrollbar-width:none;touch-action:pan-y}
    ${P}.tabs::-webkit-scrollbar{display:none}
    ${P}.tb{flex:1 1 0;min-width:0;padding:0 4px;height:44px;border-radius:22px;display:flex;flex-direction:row;align-items:center;justify-content:center;gap:6px;font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;color:var(--gray800,#afafaf);box-sizing:border-box}
    ${P}.tabs.m-b .tb{height:56px;flex-direction:column;gap:3px;font-size:11px}
    ${P}.tb .tl{max-width:100%;overflow:hidden;text-overflow:ellipsis}
    ${P}.tb.on{background:${C.accent};color:#3a3a3a}
    ${P}.tabs.many .tb{flex:1 0 auto;min-width:60px;padding:0 10px}
    ${P}.gear{width:56px;height:56px;border-radius:28px;flex:none;background:var(--gray200,#3a3a3a);box-shadow:inset 0 0 0 1px rgba(255,255,255,0.05);display:grid;place-items:center}`;

  /* ============================================================ editoren (Tilpass Innstillinger + GUI) */
  const cid = (ed) => ((ed && ed._config && ed._config.card_id) || '_');
  const RT = new Map(), ADD = new Set(), EXP = new Map(), NT = new Map(), ENTO = new Map();
  const ENT_DEF = [['natt', 'mdi:moon-waning-crescent', 'Nattmodus', ['input_boolean', 'switch']], ['privat', 'mdi:video-off', 'Privatmodus', ['input_boolean', 'switch']], ['vekking', 'mdi:alarm', 'Vekketid', ['input_datetime', 'sensor']]];
  const SHEET_H = 'min(660px, calc(100% - 52px))'; // 27.5: samme faste høyde i alle fire faner
  // «Legg til fane»: ikoner (designets TICONS → mdi), alle prefiks via ikonvelgeren («…»)
  const TICONS = ['mdi:bell', 'mdi:video', 'mdi:thermostat', 'mdi:washing-machine', 'mdi:battery-alert', 'mdi:paw', 'mdi:garage', 'mdi:water'];
  const INN_CSS = `
    .ttl .tt{letter-spacing:-0.02em}
    /* designet: bare «Ferdig» i headeren (lukk/avbryt = bakteppet, Esc) – tittelen får plass; fanene ligger fast under */
    .ttl .hb[data-a="cancel"]{display:none}
    .wrap>.chips.sg.tabs{position:sticky;top:calc(var(--ki-grab-h, 0px) - var(--ki-sh-pt, 0px) + 47px);z-index:4;box-shadow:0 0 0 10px var(--ki-sheet-bg,#282828)}
    .chips.sg.tabs{background:#3a3a3a;border-radius:24px;padding:4px;gap:2px}
    .chips.sg.tabs .chip{height:40px;border-radius:20px;font-size:12px;font-weight:500}
    .chips.sg.tsub{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);background:#3a3a3a;border-radius:22px;padding:4px;gap:2px}
    .chips.sg.tsub .chip{height:36px;border-radius:18px;font-size:12px;font-weight:500;color:#979797;background:transparent}
    .chips.sg.tsub .chip.on{background:#404040;color:#fafafa}
    /* designet: én flate (#3a3a3a r24) per seksjon med overskriften INNI, rader flatt med skillelinjer */
    .fsec{gap:0;border-radius:24px;background:#3a3a3a}
    .fsec>.fsh{padding:14px 16px 6px;font-size:12px;font-weight:500}
    .fsec>.sec{border-radius:24px;background:transparent;box-shadow:none;border:0}
    .fsec>.sec>.in{padding:0 16px}
    .fsec .sec .f{background:transparent;padding:10px 0;border-radius:0}
    .fsec .sec .f + .f{border-top:1px solid rgba(255,255,255,.06)}
    .fsec .sec .f:has(>.line){display:grid;grid-template-columns:minmax(0,1fr) auto;column-gap:12px;row-gap:2px;align-items:center;min-height:64px;box-sizing:border-box}
    .fsec .sec .f:has(>.line)>.line{display:contents}
    .fsec .sec .f:has(>.line) .line>span{grid-column:1;grid-row:1;font-size:15px !important;font-weight:500}
    .fsec .sec .f:has(>.line) .line>.sw{grid-column:2;grid-row:1 / span 2}
    .fsec .sec .f:has(>.line)>.help{grid-column:1;grid-row:2;font-size:12px;color:#979797}
    .fsec .f>label{font-size:13px;color:#afafaf}
    .fsec .f .chips.sg:not(.tabs):not(.tsub){display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:2px;padding:4px;border-radius:22px;background:#282828}
    .fsec .f .chips.sg:not(.tabs):not(.tsub) .chip{height:36px;border-radius:18px;justify-content:center;padding:0 4px;background:transparent;color:#afafaf;font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden}
    .fsec .f .chips.sg:not(.tabs):not(.tsub) .chip.on{background:${C.accent};color:#3a3a3a}
    .ilist{display:flex;flex-direction:column}
    .irow{display:flex;align-items:center;gap:8px;min-height:56px;padding:8px 0}
    .irow + .irow,.irow + .isub,.isub + .irow{border-top:1px solid rgba(255,255,255,.06)}
    .irow.off .iic,.irow.off .inm{opacity:.45}
    .iic{width:32px;height:32px;display:grid;place-items:center;flex:none;color:#afafaf;--mdc-icon-size:22px}
    button.iic{border-radius:16px}
    .inm{flex:1;min-width:0;height:40px;border-radius:12px;background:#282828;padding:0 12px;font-size:14px;color:#fafafa}
    .inm::placeholder{color:#979797}
    .idel{width:36px;height:36px;border-radius:18px;flex:none;display:grid;place-items:center;color:var(--red,#f28073)}
    .irow .sw{width:44px;height:26px;border-radius:13px;background:#545454;flex:none}
    .irow .sw::after{top:3px;left:3px;width:20px;height:20px;border-radius:10px}
    .irow .sw.on{background:var(--pink,#f285c9)}.irow .sw.on::after{transform:translateX(18px)}
    .iadd{display:flex;align-items:center;gap:12px;width:100%;min-height:56px;padding:0 4px;border-top:1px solid rgba(255,255,255,.06);text-align:left;color:rgb(242 133 201);font-size:15px;font-weight:500}
    .ntp{display:flex;flex-direction:column;gap:10px;margin:0 -4px 8px;padding:12px;border-radius:20px;background:#282828;animation:ntfade .25s ease both}
    @keyframes ntfade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
    .ntl{font-size:12px;color:#979797;padding:0 4px}
    .nts{display:flex;flex-direction:column;gap:2px}
    .ntsrc{display:flex;align-items:center;gap:12px;min-height:52px;padding:0 14px;border-radius:16px;text-align:left;width:100%;box-sizing:border-box;background:transparent}
    .ntsrc.on{background:#545454}
    .ntsrc .nm{flex:1;min-width:0;display:flex;flex-direction:column}.ntsrc b{font-size:14px;font-weight:500}.ntsrc i{font-style:normal;font-size:11px;color:#979797}
    .ntn{height:48px;border-radius:16px;padding:0 14px;background:#3a3a3a;color:#fafafa;font-size:15px;width:100%;box-sizing:border-box}
    .ntn::placeholder{color:#979797}
    .nti{display:flex;flex-wrap:wrap;gap:6px}
    .nti button{width:44px;height:44px;border-radius:22px;display:grid;place-items:center;background:#3a3a3a;color:#e1e1e1}
    .nti button.on{background:${C.accent};color:#3a3a3a}
    .ntgo{height:48px;border-radius:24px;font-size:15px;font-weight:600;background:#3a3a3a;color:#7f7f7f;width:100%}
    .ntgo.on{background:${C.accent};color:#3a3a3a}
    .pvw{display:flex;flex-direction:column;gap:10px;padding:4px 0 14px}
    .pvw .pvb{padding:10px;border-radius:20px;background:#282828;pointer-events:none}
    .pvw .bar{margin:0}
    ${TAB_CSS('.pvw ')}
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
    .ireset{height:48px;border-radius:24px;background:#3a3a3a;font-size:14px;font-weight:500;color:var(--red,#f28073);width:100%;margin-top:8px}
    .imeta{font-size:11px;color:#7f7f7f;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .itx{flex:1;min-width:0;display:flex;flex-direction:column;text-align:left;min-height:44px;justify-content:center}
    .itx b,.ient .nm b{font-size:14px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .itx i,.ient .nm i.mono,.ihit .nm i{font-style:normal;font-size:11px;color:#7f7f7f;font-family:ui-monospace,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .irow.off .itx{opacity:.6}
    .ient{display:flex;flex-direction:column;gap:8px;padding:10px 0}
    .ient + .ient{border-top:1px solid rgba(255,255,255,.06)}
    .ienh{display:flex;align-items:center;gap:12px;width:100%;text-align:left;min-height:44px}
    .eic{width:36px;height:36px;border-radius:18px;flex:none;display:grid;place-items:center;background:#404040;color:#e1e1e1}
    .ient .nm,.ihit .nm{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
    .ient .nm i.pk{font-style:normal;font-size:11px;color:rgb(242 133 201)}
    .ientp{display:flex;flex-direction:column;gap:6px;padding:8px;border-radius:18px;background:#282828}
    .ientp .edq{height:40px;border-radius:12px;background:#3a3a3a}
    .ihit{display:flex;align-items:center;gap:10px;min-height:48px;padding:4px 10px;border-radius:12px;text-align:left;width:100%;box-sizing:border-box}
    .ihit.on{background:#3a3a3a}
    .ihit .nm b{font-size:13px;font-weight:400;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}`;
  let innSheet = null;
  const ntOf = (ed) => { const id = cid(ed); if (!NT.has(id)) NT.set(id, { open: false, src: '', name: '', icon: TICONS[0] }); return NT.get(id); };
  const ntOk = (N) => !!(N.src && String(N.name || '').trim());
  function innKit(ed) {
    if (!ed || !ed.shadowRoot) return;
    if (M.edKit) M.edKit(ed);
    ed.__edDrop = ed.__edDrop || {}; ed.__edQ = ed.__edQ || {};
    const R = ed.shadowRoot;
    try { if (!innSheet) { innSheet = new CSSStyleSheet(); innSheet.replaceSync(INN_CSS); } if (!R.adoptedStyleSheets.includes(innSheet)) R.adoptedStyleSheets = [...R.adoptedStyleSheets, innSheet]; } catch (e) { /* eldre nettleser */ }
    if (ed.__innKit) return;
    ed.__innKit = true;
    // Navn på ny fane: per tastetrykk i tilstanden (ingen ny tegning – feltet beholder fokus), knappen følger med
    R.addEventListener('input', (e) => {
      const t = e.target;
      if (!t.dataset || t.dataset.inn !== 'ntname') return;
      e.stopPropagation();
      const N = ntOf(ed); N.name = t.value;
      const b = R.querySelector('.ntgo'); if (b) { b.classList.toggle('on', ntOk(N)); b.toggleAttribute('disabled', !ntOk(N)); }
    }, true);
    // Navnefelt, ikon og filter i radene lagres ved «change» (ikke per tastetrykk – feltet beholder fokus)
    R.addEventListener('change', (e) => {
      const t = e.target;
      if (!t.dataset || t.dataset.inn == null) return;
      e.stopPropagation();
      const cc = ed._config || {}, v = String(t.value || '').trim(), k = t.dataset.v;
      if (t.dataset.inn === 'ntname') { ntOf(ed).name = t.value; return; }
      if (t.dataset.inn === 'tname') {
        const CT = customTabs(cc);
        if (CT.some((x) => x.key === k)) return setCfg(ed, { custom_tabs: CT.map((x) => (x.key === k ? { ...x, name: v || katName(x.source) } : x)) });
        const D = tabDefs(cc).map((x) => (x.key === k ? { ...x, title: v && !(BUILTIN[k] && v === BUILTIN[k][0]) ? v : '' } : x));
        return ed._set('tabs', tabsOut(D));
      }
      if (t.dataset.inn === 'rname' || t.dataset.inn === 'ricon') return setRows(ed, (R2) => { const O = t.dataset.inn === 'rname' ? R2.names : R2.icons; if (v) O[k] = v; else delete O[k]; });
      if (t.dataset.inn === 'fenh' || t.dataset.inn === 'fikke') {
        const L = v.split(',').map((x) => x.trim()).filter(Boolean), f = t.dataset.inn === 'fenh' ? 'enheter' : 'ikke_enheter';
        const D = tabDefs(cc).map((x) => { if (x.key !== k) return x; const F = { ...obj(x.filter) }; if (L.length) F[f] = L; else delete F[f]; return { ...x, filter: F }; });
        return ed._set('tabs', tabsOut(D));
      }
    }, true);
  }
  // Flere nøkler i én endring (ett msh-change / config-changed)
  function setCfg(ed, o) {
    const c = { ...(ed._config || {}) }, keys = Object.keys(o);
    keys.forEach((k) => { if (o[k] === undefined) delete c[k]; else c[k] = o[k]; });
    ed._config = c;
    const last = keys[keys.length - 1];
    ed._set(last, o[last]);
  }
  function rowsWork(cc) { const R = rowsCfg(cc); return { exclude: [...R.exclude], move: { ...R.move }, include: [...R.include], names: { ...R.names }, subs: { ...R.subs }, icons: { ...R.icons }, order: { ...R.order } }; }
  function setRows(ed, fn) { const W = rowsWork(ed._config || {}); fn(W); ed._set('rows', rowsOut(W)); }
  const curTab = (ed, c) => { const T = tabDefs(c), v = RT.get(cid(ed)); return T.some((t) => t.key === v) ? v : (T[0] || {}).key; };
  const sw = (key, op, v, on, label) => `<button class="sw ${on ? 'on' : ''}" role="switch" aria-checked="${on}" aria-label="${esc(label)}" data-a="fn" data-k="${key}" data-op="${op}" data-v="${esc(v)}"></button>`;
  function editorSchema(h0, cfg0) {
    const handle = () => (M.edHandle ? M.edHandle() : '');
    // Forhåndsvisning (27.5): fanelinjen + tannhjul live, ikke trykkbar
    const preview = { type: 'html', html: (hh, cc, key, ed) => {
      innKit(ed);
      const V = visTabs(cc), st = keyOf(cc.start_tab), cur = V.some((t) => t.key === st) ? st : V[0].key;
      return `<div class="pvw" data-key="pvw"><div class="pvb">${tabBar(cc, V, cur, { preview: true })}</div></div>`;
    } };
    // Faner: dra-håndtak, ikon, navnefelt i raden, søppelkasse (egne faner), bryter = vis/skjul; «Legg til fane» nederst
    const faner = { type: 'html', html: (hh, cc, key, ed) => {
      innKit(ed);
      ed.__edDrop['inn-tab'] = (o) => { const D = tabDefs(ed._config || cc), by = new Map(D.map((t) => [t.key, t])); ed._set('tabs', tabsOut(o.map((k) => by.get(k)).filter(Boolean))); };
      const D = tabDefs(cc), N = ntOf(ed);
      const rows = D.map((t) => `<div class="irow ${t.hidden ? 'off' : ''}" data-edk="${esc(t.key)}" data-elist="inn-tab" data-key="it-${esc(t.key)}">${handle()}<span class="iic">${M.icon(t.icon, 22)}</span>
          <input class="inm" data-inn="tname" data-v="${esc(t.key)}" value="${esc(t.custom ? t.name : t.title)}" placeholder="${esc(BUILTIN[t.key] ? BUILTIN[t.key][0] : t.name)}" aria-label="Navn på fanen" autocapitalize="off" autocorrect="off" spellcheck="false">
          ${t.custom ? `<button class="idel" data-a="fn" data-k="${key}" data-op="tdel" data-v="${esc(t.key)}" title="Slett fane" aria-label="Slett fanen ${esc(t.name)}">${M.icon('mdi:delete-outline', 20)}</button>` : ''}${sw(key, 'teye', t.key, !t.hidden, (t.hidden ? 'Vis ' : 'Skjul ') + t.name)}</div>`).join('');
      let panel = '';
      if (N.open) {
        const have = new Set(D.map((t) => (t.custom ? t.source : t.key)));
        const K = hh ? kategorier(hh, cc).filter((k) => !have.has(k.key)) : [];
        const ok = ntOk(N), icons = TICONS.includes(N.icon) || !N.icon ? TICONS : [...TICONS, N.icon];
        panel = `<div class="ntp" data-key="ntp"><span class="ntl">Varsler fra KI Varslinger</span>
          <div class="nts">${K.length ? K.map((k) => `<button class="ntsrc ${N.src === k.key ? 'on' : ''}" data-a="fn" data-k="${key}" data-op="ntsrc" data-v="${esc(k.key)}" aria-pressed="${N.src === k.key}">${M.icon(k.icon, 20, 'color:#afafaf')}<span class="nm"><b>${esc(k.name)}</b><i>${k.count} ${k.count === 1 ? 'regel' : 'regler'}</i></span>${M.icon('mdi:check', 20, `color:rgb(102 209 158);opacity:${N.src === k.key ? 1 : 0}`)}</button>`).join('') : '<div class="iempty">Fant ingen flere kategorier i KI Varslinger</div>'}</div>
          <input class="ntn" data-inn="ntname" value="${esc(N.name)}" placeholder="Navn på fanen" aria-label="Navn på fanen" autocapitalize="off" autocorrect="off" spellcheck="false">
          <div class="nti">${icons.map((ic) => `<button class="${N.icon === ic ? 'on' : ''}" data-a="fn" data-k="${key}" data-op="nticon" data-v="${esc(ic)}" aria-label="${esc(ic)}">${M.icon(ic, 20)}</button>`).join('')}${M.iconPicker ? `<button data-a="fn" data-k="${key}" data-op="ntpick" data-v="" aria-label="Velg et annet ikon">${M.icon('mdi:dots-horizontal', 20)}</button>` : ''}</div>
          <button class="ntgo ${ok ? 'on' : ''}" data-a="fn" data-k="${key}" data-op="ntadd" data-v="" ${ok ? '' : 'disabled'}>Legg til fane</button></div>`;
      }
      return `<div class="ilist">${rows}</div><button class="iadd" data-a="fn" data-k="${key}" data-op="ntopen" data-v="" aria-expanded="${N.open}">${M.icon('mdi:plus-circle', 22)}<span>Legg til fane</span></button>${panel}`;
    }, click: (dd, ed) => {
      const cc = ed._config || {}, N = ntOf(ed);
      if (dd.op === 'teye') {
        const D = tabDefs(cc), t = D.find((x) => x.key === dd.v);
        if (!t) return;
        if (!t.hidden && D.filter((x) => !x.hidden).length <= 1) { M.haptic('warning'); M.toast('Minst én fane må være synlig'); return; }
        M.haptic('selection');
        return ed._set('tabs', tabsOut(D.map((x) => (x.key === dd.v ? { ...x, hidden: !x.hidden } : x))));
      }
      if (dd.op === 'tdel') {
        M.haptic('medium');
        const CT = customTabs(cc).filter((x) => x.key !== dd.v), W = rowsWork(cc);
        delete W.order[dd.v]; Object.keys(W.move).forEach((k) => { if (W.move[k] === dd.v) delete W.move[k]; });
        return setCfg(ed, { rows: rowsOut(W), tabs: tabsOut(tabDefs(cc).filter((x) => x.key !== dd.v)), custom_tabs: CT.length ? CT : undefined });
      }
      if (dd.op === 'ntopen') { M.haptic('light'); NT.set(cid(ed), { open: !N.open, src: '', name: '', icon: TICONS[0] }); return ed._render(); }
      if (dd.op === 'ntsrc') {
        M.haptic('selection');
        const named = String(N.name || '').trim() && N.name !== katName(N.src);
        N.src = dd.v; if (!named) { N.name = katName(dd.v); N.icon = katIcon(dd.v); }
        return ed._render();
      }
      if (dd.op === 'nticon') { M.haptic('selection'); N.icon = dd.v; return ed._render(); }
      if (dd.op === 'ntpick' && M.iconPicker) { M.iconPicker.open({ value: N.icon, title: 'Ikon for fanen', onPick: (v) => { if (v) { N.icon = v; ed._render(); } } }); return; }
      if (dd.op === 'ntadd') {
        if (!ntOk(N)) return;
        M.haptic('success');
        const D = tabDefs(cc), base = 'v_' + (slugOf(N.src) || 'fane');
        let k = base, i = 2; while (D.some((t) => t.key === k)) k = base + '_' + i++;
        const CT = [...customTabs(cc), { key: k, name: String(N.name).trim(), icon: N.icon || katIcon(N.src), source: N.src }];
        NT.delete(cid(ed));
        return setCfg(ed, { custom_tabs: CT, tabs: [...tabsOut(D), { key: k }] });
      }
    } };
    // Rader: undersegment (fane) + rader for valgt fane (dra, ikon → flytt/ikon, navnefelt, bryter = exclude) + «Legg til rad»
    const radSeg = { type: 'html', html: (hh, cc, key, ed) => {
      innKit(ed);
      const tab = curTab(ed, cc);
      return `<div class="chips sg tsub" role="tablist">${tabDefs(cc).map((t) => `<button class="chip ${t.key === tab ? 'on' : ''}" role="tab" aria-selected="${t.key === tab}" data-a="fn" data-k="${key}" data-op="rtab" data-v="${esc(t.key)}"><span>${esc(t.name)}</span></button>`).join('')}</div>`;
    }, click: (dd, ed) => { if (dd.op === 'rtab') { M.haptic('selection'); RT.set(cid(ed), dd.v); EXP.delete(cid(ed)); ADD.delete(cid(ed)); return ed._render(); } } };
    const rader = { type: 'html', html: (hh, cc, key, ed) => {
      innKit(ed);
      if (!hh) return '';
      const id = cid(ed), tab = curTab(ed, cc), R = rowsCfg(cc), T = tabDefs(cc);
      if (!tab) return '<div class="iempty">Ingen faner med rader.</div>';
      ed.__edDrop['inn-row'] = (o) => setRows(ed, (W) => { W.order = { ...W.order, [tab]: o }; });
      const L = tabRows(hh, cc, tab, { withHidden: true }), open = EXP.get(id);
      const rows = L.map((r) => {
        const own = r.kilde === 'ekstra';
        const sub = open === r.key ? `<div class="isub" data-key="irs-${esc(r.key)}">
            <span class="lb">Navn</span><input class="inm full" data-inn="rname" data-v="${esc(r.key)}" value="${esc(R.names[r.key] || '')}" placeholder="${esc(r.navn)}" aria-label="Navn på raden" autocapitalize="off" autocorrect="off" spellcheck="false">
            <span class="lb">Flytt til</span><div class="ichips">${T.map((t) => `<button class="${t.key === tab ? 'on' : ''}" data-a="fn" data-k="${key}" data-op="rmove" data-v="${esc(r.key)}" data-t="${esc(t.key)}">${esc(t.name)}</button>`).join('')}</div>
            <span class="lb">Ikon</span><input class="inm full" data-inn="ricon" data-v="${esc(r.key)}" value="${esc(R.icons[r.key] || '')}" placeholder="${esc(r.ikon)}" autocapitalize="off" autocorrect="off" spellcheck="false">
            <span class="imeta">${esc(r.id)}${r.enhet && r.kilde !== 'ekstra' ? ' · ' + esc(r.enhet) : ''} · ${esc(katName(r.cat))}${r.all.length > 1 ? ` · ${r.all.length} entiteter (hold på raden i popupen for resten)` : ''}</span>
            ${own ? `<div class="ichips"><button data-a="fn" data-k="${key}" data-op="rrm" data-v="${esc(r.id)}">Fjern raden</button></div>` : ''}</div>` : '';
        return `<div class="irow ${r.hidden ? 'off' : ''}" data-edk="${esc(r.key)}" data-elist="inn-row" data-key="ir-${esc(r.key)}">${handle()}<button class="iic" data-a="fn" data-k="${key}" data-op="rexp" data-v="${esc(r.key)}" aria-expanded="${open === r.key}" aria-label="Navn, fane og ikon">${M.icon(r.icon, 20)}</button>
          <button class="itx" data-a="fn" data-k="${key}" data-op="rexp" data-v="${esc(r.key)}"><b>${esc(r.name)}</b><i>${esc(r.id)}</i></button>
          ${sw(key, 'reye', r.key, !r.hidden, (r.hidden ? 'Vis ' : 'Skjul ') + r.name)}</div>${sub}`;
      }).join('');
      // «Legg til rad»: bare brytere (input_boolean/switch) – automasjoner og skript hører ikke hjemme blant varslene
      const q = (ed.__edQ['inn-q'] || '').trim().toLowerCase(), have = new Set(L.map((r) => r.id));
      const hits = ADD.has(id) ? Object.keys(hh.states).filter((x) => ['input_boolean', 'switch'].includes(x.split('.')[0]) && !have.has(x) && (!q || (x + ' ' + (hh.states[x].attributes.friendly_name || '')).toLowerCase().includes(q))).sort().slice(0, 8) : [];
      const add = ADD.has(id) ? `<div class="isub" style="padding-left:0" data-key="iadd"><div class="edq">${M.icon('mdi:magnify', 20, 'color:#979797')}<input data-edq="inn-q" value="${esc(ed.__edQ['inn-q'] || '')}" placeholder="Søk etter varsel-bryter" autocapitalize="off" autocorrect="off" spellcheck="false"></div>
        ${hits.map((x) => `<button class="edhit" data-a="fn" data-k="${key}" data-op="radd" data-v="${esc(x)}">${M.icon(M.domainIcon(x, hh.states[x]), 20, 'color:#afafaf')}<span class="nm"><b>${esc(M.name(hh, x))}</b><i>${esc(x)}</i></span></button>`).join('') || '<div class="iempty">Ingen treff</div>'}</div>` : '';
      const none = !rules(hh, cc).some((r) => r.kilde === 'integrasjon') ? 'Fant ingen varsler fra KI Varslinger og sikkerhet' : 'Ingen rader i denne fanen ennå.';
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
        return setRows(ed, (W) => { [dd.v, r && r.id, r && r.dev, r && r.slug].forEach((k) => { if (k) delete W.move[k]; }); const def = r && r.tab; if (!r || dd.t !== def || r.kilde === 'ekstra' || tabDefs(cc).some((t) => (t.key === def && hasFilter(t.filter)) || (t.custom && r.cat === t.source))) W.move[dd.v] = dd.t; });
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
        <div class="ifld"><span class="lb">Integrasjoner</span><div class="ichips">${KI_VARS_PLATTFORM.map((p) => `<button class="${P.includes(p) ? 'on' : ''}" aria-pressed="${P.includes(p)}" data-a="fn" data-k="${key}" data-op="fplat" data-v="${esc(tab)}" data-p="${p}">${esc({ ki_notifications: 'KI Varslinger', ki_energi: 'KI Energi' }[p])}</button>`).join('')}</div></div>`;
    }, click: (dd, ed) => {
      if (dd.op !== 'fplat') return;
      M.haptic('selection');
      const D = tabDefs(ed._config || {}).map((x) => { if (x.key !== dd.v) return x; const F = { ...obj(x.filter) }, P = new Set(arr(F.plattform)); if (P.has(dd.p)) P.delete(dd.p); else P.add(dd.p); if (P.size) F.plattform = [...P]; else delete F.plattform; return { ...x, filter: F }; });
      return ed._set('tabs', tabsOut(D));
    } };
    const reset = { type: 'html', html: (hh, cc, key) => `<button class="ireset" data-a="fn" data-k="${key}" data-op="reset" data-v="">Tilbakestill til standard</button>`,
      click: (dd, ed) => { if (dd.op !== 'reset') return; M.haptic('medium'); const cc = ed._config || {}, id = cc.card_id || M.uid(); NT.delete(cid(ed)); RT.delete(cid(ed)); ed._config = { type: cc.type || 'custom:msh-innstillinger-card', card_id: id }; ed._set('card_id', id); } };
    // Entiteter (designet): ikon, navn, entitet (mono) / «Velg entitet» (rosa), chevron → søk med forslag (✓ = valgt).
    // Autokonfig vises som «… · automatisk»; «Automatisk» i lista fjerner overstyringen.
    const entiteter = { type: 'html', html: (hh, cc, key, ed) => {
      innKit(ed);
      const open = ENTO.get(cid(ed)), q = (ed.__edQ['inn-ent'] || '').trim().toLowerCase();
      return `<div class="ilist">${ENT_DEF.map(([k, icon, label, doms]) => {
        const set = cc[k] || '', au = hh ? ents(hh, { ...cc, [k]: undefined })[k] : null, cur = set || au || '';
        const txt = set || (au ? `${au} · automatisk` : 'Velg entitet');
        let body = '';
        if (open === k && hh) {
          const qs = q.replace(/ /g, '_');
          const hits = Object.keys(hh.states).filter((id) => doms.includes(id.split('.')[0]) && (!q || id.includes(qs) || String(hh.states[id].attributes.friendly_name || '').toLowerCase().includes(q)))
            .sort((a, b) => (b === cur) - (a === cur) || a.localeCompare(b)).slice(0, 8);
          body = `<div class="ientp" data-key="ientp-${k}"><div class="edq">${M.icon('mdi:magnify', 18, 'color:#7f7f7f')}<input data-edq="inn-ent" value="${esc(ed.__edQ['inn-ent'] || '')}" placeholder="Søk etter entitet …" autocapitalize="off" autocorrect="off" spellcheck="false"></div>
            ${set ? `<button class="ihit" data-a="fn" data-k="${key}" data-op="entauto" data-v="${k}">${M.icon('mdi:auto-fix', 18, 'color:#979797')}<span class="nm"><b>Automatisk</b><i>${esc(au || 'Ingen funnet')}</i></span></button>` : ''}
            ${hits.map((id) => `<button class="ihit ${id === cur ? 'on' : ''}" data-a="fn" data-k="${key}" data-op="entset" data-v="${k}" data-id="${esc(id)}">${M.icon('mdi:toggle-switch-outline', 18, 'color:#979797')}<span class="nm"><b>${esc(M.name(hh, id))}</b><i>${esc(id)}</i></span>${M.icon('mdi:check', 18, `color:rgb(102 209 158);opacity:${id === cur ? 1 : 0}`)}</button>`).join('') || '<div class="iempty">Ingen treff</div>'}</div>`;
        }
        return `<div class="ient" data-key="ient-${k}"><button class="ienh" data-a="fn" data-k="${key}" data-op="entopen" data-v="${k}" aria-expanded="${open === k}"><span class="eic">${M.icon(icon, 18)}</span><span class="nm"><b>${esc(label)}</b><i class="${cur ? 'mono' : 'pk'}">${esc(txt)}</i></span>${M.icon(open === k ? 'mdi:chevron-up' : 'mdi:chevron-down', 20, 'color:#7f7f7f')}</button>${body}</div>`;
      }).join('')}</div>`;
    }, click: (dd, ed) => {
      const id = cid(ed);
      if (dd.op === 'entopen') { M.haptic('selection'); ed.__edQ['inn-ent'] = ''; if (ENTO.get(id) === dd.v) ENTO.delete(id); else ENTO.set(id, dd.v); return ed._render(); }
      if (dd.op === 'entset') { M.haptic('selection'); ENTO.delete(id); ed.__edQ['inn-ent'] = ''; return ed._set(dd.v, dd.id); }
      if (dd.op === 'entauto') { M.haptic('selection'); ENTO.delete(id); ed.__edQ['inn-ent'] = ''; return ed._set(dd.v, undefined); }
    } };
    const summary = { type: 'boolean', name: 'show_summary', label: 'Antall på + «Slå alle»', help: 'Linjen «4 av 4 på · Slå alle av» over listen', default: true };
    return [
      { type: 'tabs', id: 'innstillinger', tabs: [
        { key: 'faner', label: 'Faner', focus: ['faner', 'visning', 'forhandsvisning'], fields: [
          { type: 'section', id: 'forhandsvisning', label: 'Forhåndsvisning', fields: [preview] },
          { type: 'section', id: 'faner', label: 'Faner · dra for rekkefølge', fields: [faner] },
          { type: 'section', id: 'visning', label: '', fields: [
            { type: 'select', name: 'tab_labels', label: 'Faner viser', options: [['icon', 'Ikon + tekst'], ['name', 'Tekst'], ['ikon', 'Ikoner']], default: 'icon' },
            { type: 'select', name: 'start_tab', label: 'Startfane', options: tabDefs(cfg0 || {}).map((t) => [t.key, t.name]), default: 'sikkerhet' },
          ] },
        ] },
        { key: 'rader', label: 'Rader', focus: ['rader', 'filter'], fields: [
          radSeg,
          { type: 'section', id: 'oppsummering', label: '', fields: [summary] },
          { type: 'section', id: 'rader', label: 'Rader · dra for rekkefølge', fields: [rader] },
          { type: 'section', id: 'filter', label: 'Filter for fanen', fields: [filter] },
        ] },
        { key: 'entiteter', label: 'Entiteter', focus: ['entiteter'], fields: [{ type: 'section', id: 'entiteter', label: 'Toppkort', fields: [entiteter] }] },
        { key: 'avansert', label: 'Avansert', focus: ['avansert', 'spacing'], fields: [
          { type: 'section', id: 'avansert', label: '', fields: [
            { type: 'boolean', name: 'sok', label: 'Søkefelt', help: 'Vis søk over listene', default: true },
            { ...summary, help: 'Vis «3 av 3 på» og Slå alle av/på' },
            { type: 'boolean', name: 'av_forst', label: 'Avslåtte øverst', help: 'Sorter det som er av først', default: false },
            { type: 'boolean', name: 'haptikk', label: 'Haptikk', help: 'Vibrasjon ved trykk', default: true },
            { type: 'boolean', name: 'animasjoner', label: 'Animasjoner', help: 'Toppkort og Privatmodus-kameraet', default: true },
            { type: 'boolean', name: 'dashbord', label: 'Dashbordinnstillinger nederst', help: 'Tilpass Hjem/navbar/header, Home Assistant, Liquid Glass og Enheter', default: true },
          ] },
          { type: 'section', id: 'scene', label: '', fields: [
            { type: 'select', name: 'scene', label: 'Toppkort-scene', options: [['auto', 'Automatisk'], ['morgen', 'God morgen'], ['dag', 'Kun kort'], ['natt', 'God natt']], default: 'auto' },
          ] },
          M.spacingSchema(),
          reset,
        ] },
      ] },
    ];
  }

  /* ============================================================ toppkortets grafikk (designet 1:1) */
  // «God natt»/«God morgen»-scenen (viewBox 240×160, xMaxYMax meet)
  const SCENE_SVG = (pOn) => `<svg class="art" viewBox="0 0 240 160" preserveAspectRatio="xMaxYMax meet" aria-hidden="true">
      <defs><mask id="moonCut2"><rect x="0" y="0" width="240" height="160" fill="#fff"/><circle cx="82" cy="30" r="12" fill="#000"/></mask></defs>
      <g class="stars">
        <circle cx="20" cy="22" r="1.2" fill="#fff" style="animation:twinkle 2.4s ease-in-out infinite"/>
        <circle cx="44" cy="58" r="1" fill="#fff" style="animation:twinkle 3.1s ease-in-out .6s infinite"/>
        <circle cx="104" cy="18" r="1.3" fill="#fff" style="animation:twinkle 2.8s ease-in-out 1.1s infinite"/>
        <circle cx="132" cy="44" r="1" fill="#fff" style="animation:twinkle 3.6s ease-in-out .3s infinite"/>
        <circle cx="160" cy="14" r="1.2" fill="#fff" style="animation:twinkle 2.2s ease-in-out 1.6s infinite"/>
        <circle cx="8" cy="70" r="1" fill="#fff" style="animation:twinkle 2.9s ease-in-out 1.3s infinite"/>
      </g>
      <g class="moon"><circle cx="74" cy="36" r="13" fill="#f6e7b4" mask="url(#moonCut2)"/></g>
      <g class="sunw"><g class="sun">
        <g class="rays"><g stroke="#fbe3a0" stroke-width="2.4" stroke-linecap="round" opacity=".8">
          <line x1="125" y1="80" x2="125" y2="70"/><line x1="147" y1="89" x2="154" y2="82"/><line x1="156" y1="112" x2="166" y2="112"/>
          <line x1="103" y1="89" x2="96" y2="82"/><line x1="94" y1="112" x2="84" y2="112"/><line x1="147" y1="135" x2="154" y2="142"/><line x1="103" y1="135" x2="96" y2="142"/><line x1="125" y1="144" x2="125" y2="154"/>
        </g></g>
        <circle cx="125" cy="112" r="21" fill="#fbe3a0"/>
      </g></g>
      <path d="M0 160 Q50 140 120 142 T240 138 V160 Z" fill="#1c1b38"/>
      <polygon points="86,152 99,106 112,152" fill="#1c1b38"/>
      <g class="smk"><circle cx="208" cy="50" r="4" fill="#c9c4dc"/></g>
      <g class="smk" style="animation-delay:1.1s"><circle cx="208" cy="50" r="4" fill="#c9c4dc"/></g>
      <g class="smk" style="animation-delay:2.2s"><circle cx="208" cy="50" r="4" fill="#c9c4dc"/></g>
      <rect x="203" y="54" width="10" height="24" fill="#3a3868"/>
      <rect x="150" y="86" width="64" height="60" fill="#3a3868"/>
      <polygon points="140,92 182,52 224,92" fill="#4b4886" stroke="#5b58a0" stroke-width="2" stroke-linejoin="round"/>
      <g class="win"><circle cx="182" cy="75" r="6"/><rect x="158" y="96" width="12" height="12" rx="1.5"/><rect x="173" y="96" width="12" height="12" rx="1.5"/><rect x="158" y="112" width="12" height="12" rx="1.5"/><rect x="173" y="112" width="12" height="12" rx="1.5"/></g>
      <g class="scam ${pOn ? '' : 'rec'}"><rect x="196" y="98" width="12" height="7" rx="2" fill="#2a2850"/><circle cx="200" cy="101.5" r="1.6"/></g>
      <rect x="192" y="114" width="14" height="32" rx="2" fill="#2a2850"/>
      <g class="birds">
        <g class="f1"><path class="fl1" d="M196 24 q4 -4 8 0 q4 -4 8 0" fill="none" stroke="#2a2548" stroke-width="1.6" stroke-linecap="round"/></g>
        <g class="f2"><path class="fl2" d="M214 18 q3.5 -3.5 7 0 q3.5 -3.5 7 0" fill="none" stroke="#2a2548" stroke-width="1.5" stroke-linecap="round"/></g>
      </g>
    </svg>`;
  // Nattmodus-kortet (to kort): viewBox 180×150, xMaxYMid meet
  const NIGHT_SVG = `<svg class="nsky" viewBox="0 0 180 150" preserveAspectRatio="xMaxYMid meet" aria-hidden="true">
      <g opacity=".5">
        <circle cx="30" cy="50" r="1" fill="#fff" style="animation:twinkle 2.6s ease-in-out infinite"/>
        <circle cx="62" cy="82" r="1" fill="#fff" style="animation:twinkle 3.1s ease-in-out .7s infinite"/>
        <circle cx="120" cy="40" r="1.1" fill="#fff" style="animation:twinkle 2.3s ease-in-out 1.2s infinite"/>
        <circle cx="46" cy="106" r="1" fill="#fff" style="animation:twinkle 3.4s ease-in-out .4s infinite"/>
      </g>
      <g><circle cx="84" cy="44" r="10" fill="#f6e7b4"/><circle cx="90" cy="39" r="8" fill="#23285a"/></g>
      <path d="M0 150 Q60 128 120 134 T180 130 V150 Z" fill="#1c1f44"/>
      <polygon points="70,140 78,112 86,140" fill="#1c1f44"/>
      <g transform="translate(-12 -40)"><rect x="112" y="104" width="44" height="36" fill="#3a3d78"/>
      <polygon points="104,108 134,82 164,108" fill="#4b4f94"/>
      <g fill="#f5cf78"><rect x="120" y="112" width="9" height="9" rx="1"/><rect x="132" y="112" width="9" height="9" rx="1"/><rect x="120" y="124" width="9" height="9" rx="1"/><rect x="132" y="124" width="9" height="9" rx="1"/></g></g>
    </svg>`;
  // Overvåkingskameraet i Privatmodus-kortet: veggfeste mot høyre kant (top 74 px), linsen peker mot venstre
  const CAMERA = `<div class="pfx" aria-hidden="true"><span class="pmount"></span><div class="ptilt"><div class="pscan">
      <span class="pcone"></span><span class="pbody"></span><span class="plens"><span class="plid"></span></span><span class="prec"></span>
    </div></div></div>`;
  const SYNC = '<span class="sync" data-key="sync"><span class="spin"></span>Synker …</span>';

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
    get tab() { const V = visTabs(this.config).map((t) => t.key), t = keyOf(this.ui.tab || this.config.start_tab); return V.includes(t) ? t : V[0]; }
    _hp(t) { return `data-haptic="${this.config.haptikk === false ? 'off' : t}"`; }
    get _anim() { return this.config.animasjoner !== false; }
    // «Tilpass Innstillinger»: samme faste høyde i alle fire faner (27.5) – arket hopper ikke ved fanebytte
    customize(focus, opts) {
      const ui = super.customize(focus, opts);
      const sh = ui && ui.overlay && ui.overlay.root && ui.overlay.root.querySelector('.sh');
      if (sh) { sh.style.height = SHEET_H; sh.dataset.innH = '1'; }
      return ui;
    }

    /* ---------- optimistisk UI (27.6): kortet byttes straks, hass bekrefter, ellers tilbakerulling */
    _on(id, s) { const o = this._opt && id && this._opt[id]; return o ? o.want : isOn(s); }
    _pend(id) { return !!(this._opt && id && this._opt[id]); }
    _confirm(h) {
      if (!this._opt || !h) return;
      Object.keys(this._opt).forEach((id) => { const o = this._opt[id], s = h.states[id]; if (s && (s.state === 'on') === o.want) { clearTimeout(o.tm); delete this._opt[id]; } });
    }
    _flip(id) {
      const h = this.hass, s = h && id && h.states[id];
      if (!s || M.unavailable(s)) return;
      this._opt = this._opt || {};
      const want = !this._on(id, s), old = this._opt[id];
      if (old) clearTimeout(old.tm);
      if ((s.state === 'on') === want) delete this._opt[id]; // tilbake til det hass allerede viser
      else {
        const o = { want };
        o.tm = setTimeout(() => {
          if (!this._opt || this._opt[id] !== o) return;
          delete this._opt[id];
          M.haptic('warning');
          M.toast(`Fikk ikke svar fra ${M.name(this.hass, id)} – rullet tilbake`);
          this.update();
        }, M.innstSyncMs);
        this._opt[id] = o;
      }
      const p = M.call(h, 'homeassistant', want ? 'turn_on' : 'turn_off', { entity_id: id });
      if (p && p.catch) p.catch(() => { const o = this._opt && this._opt[id]; if (o) { clearTimeout(o.tm); delete this._opt[id]; this.update(); } });
      this.update();
    }
    // Morgen (27.7): nattmodus av, kl. 05–11 eller etter vekketid
    _morgen(vS) {
      const now = M.innstNow(), m = now.getHours() * 60 + now.getMinutes();
      if (m >= 660) return false;
      if (m >= 300) return true;
      const w = minOf(tidOf(vS));
      return w != null && m >= w;
    }
    // Ny tegning ved neste grense (05:00, vekketid, 11:00) så toppkortet bytter selv
    _tick(vS) {
      clearTimeout(this._mt);
      const now = M.innstNow(), m = now.getHours() * 60 + now.getMinutes(), w = minOf(tidOf(vS));
      const nxt = [300, 660, w].filter((x) => x != null && x > m), to = nxt.length ? Math.min(...nxt) : 1440 + 300;
      const ms = Math.max(1000, Math.min(6 * 3600e3, (to - m) * 60000 - now.getSeconds() * 1000 + 500));
      this._mt = setTimeout(() => { if (this.isConnected) this.update(); }, ms);
    }
    disconnectedCallback() { if (super.disconnectedCallback) super.disconnectedCallback(); clearTimeout(this._mt); }

    render() {
      const c = this.config, h = this.hass, E = ents(h, c);
      const nS = this.s(E.natt), pS = this.s(E.privat), vS = this.s(E.vekking);
      this._confirm(h);
      const nOn = this._on(E.natt, nS), pOn = this._on(E.privat, pS);
      const mode = ['morgen', 'dag', 'natt'].includes(c.scene) ? c.scene : 'auto';
      const morning = mode === 'morgen' ? !nOn : mode === 'auto' && !!nS && !M.unavailable(nS) && !nOn && this._morgen(vS);
      const scene = mode === 'natt' || (mode !== 'dag' && (nOn || morning));
      if (mode === 'auto' && nS) this._tick(vS); else clearTimeout(this._mt);
      const top = scene ? this._scene(E, nS, pS, vS, mode === 'natt' || nOn, morning && mode !== 'natt', nOn, pOn) : this._split(E, nS, pS, nOn, pOn);
      const V = visTabs(c), t = this.tab;
      const tabs = tabBar(c, V, t, { hp: this._hp('selection'), hpGear: this._hp('light') });
      // Dashbordets egne innstillinger (msh-settings-card) nederst – #settings mister dem ikke (26.15)
      const dash = c.dashbord !== false ? '<div class="gh" data-key="dash-h">Dashbord</div><div class="dash" data-key="dash" data-nomorph></div>' : '';
      return `<div class="wrap">${top}${tabs}<div class="pane" data-key="pane-${esc(t)}">${this._list(t)}</div>${dash}</div>`;
    }
    _pickBtn() { return `<button class="pick press" data-act="customize" data-section="entiteter" ${this._hp('light')}>${M.icon('mdi:plus', 16)}Velg entitet</button>`; }
    // Nattmodus av: to kort side om side (164 px)
    _split(E, nS, pS, nOn, pOn) {
      const nua = !nS || M.unavailable(nS), ua = !pS || M.unavailable(pS), nP = this._pend(E.natt), pP = this._pend(E.privat);
      const natt = `<div class="mk natt press" data-key="mk-natt" ${E.natt && !nua ? `data-act="night" data-ent="${esc(E.natt)}" role="switch" aria-checked="${nOn}" ${this._hp('medium')}` : ''}>
        ${NIGHT_SVG}
        <div class="mh"><span class="mt">Nattmodus</span><span class="ci">${M.icon('mdi:moon-waning-crescent', 22)}</span></div>
        ${nP ? SYNC : ''}
        <div class="mb"><span class="mv">${nua ? '–' : nOn ? 'På' : 'Av'}</span>${nS ? `<span class="bs ${nOn ? 'on' : ''}"></span>` : this._pickBtn()}</div></div>`;
      const on = pOn && !ua;
      const cls = ['mk', 'priv', on ? 'on' : '', ua ? 'ua' : '', this._anim ? '' : 'na'].filter(Boolean).join(' ');
      const sub = !pS ? '–' : ua ? 'Utilgjengelig' : on ? 'Kameraene er av' : 'Kameraene er på';
      const priv = `<div class="${cls} press" data-key="mk-priv" ${E.privat && !ua ? `data-act="priv" data-ent="${esc(E.privat)}" role="switch" aria-checked="${on}" ${this._hp('medium')}` : ''}>
        <span class="glw" aria-hidden="true"></span>${CAMERA}
        <div class="mh"><span class="mt">Privatmodus</span><span class="ci">${M.icon(on ? 'mdi:video-off' : 'mdi:video', 22)}</span></div>
        <div class="ml"><span class="lk" data-key="lk-${on ? 'on' : 'off'}">${on ? '<span class="ring"></span>' : ''}${M.icon(on ? 'mdi:lock' : 'mdi:lock-open-variant', 28)}</span>${pP ? SYNC : `<span class="ms">${esc(sub)}</span>`}</div>
        <div class="mb"><span class="mv">${ua ? '–' : on ? 'På' : 'Av'}</span>${pS ? `<span class="bs ${on ? 'on' : ''}"></span>` : this._pickBtn()}</div></div>`;
      return `<div class="two" data-key="top-split">${natt}${priv}</div>`;
    }
    // «God natt» (nattmodus på / alltid natt) eller «God morgen» (soloppgang) – 184 px, trykk på hele kortet = nattmodus av/på
    _scene(E, nS, pS, vS, night, morning, nOn, pOn) {
      const tid = tidOf(vS), pend = this._pend(E.natt) || this._pend(E.privat), nua = !nS || M.unavailable(nS), pua = !pS || M.unavailable(pS);
      const cls = ['sc', night ? 'night' : 'day', morning ? 'morning' : '', this._anim ? '' : 'na'].filter(Boolean).join(' ');
      const kicker = nua ? 'Nattmodus –' : nOn ? 'Nattmodus på' : 'Nattmodus av';
      const sub = night ? (tid ? `Vekking kl. ${tid}` : '') : 'Ha en fin dag';
      const chip = (id, s, ua, on, kind, icon, label, hp) => (id && s && !ua
        ? `<button class="cp ${kind} ${on ? 'on' : ''}" data-act="${kind === 'n' ? 'night' : 'priv'}" data-ent="${esc(id)}" role="switch" aria-checked="${on}" ${this._hp(hp)}>${M.icon(icon, 18)}${esc(label)}</button>`
        : `<button class="cp miss" data-act="customize" data-section="entiteter" ${this._hp('light')}>${M.icon(icon, 18)}${esc(kind === 'n' ? 'Natt' : 'Privat')} · Velg entitet</button>`);
      const pOk = pOn && !pua;
      return `<div class="${cls}" data-key="top-scene" ${E.natt && !nua ? `data-act="night" data-ent="${esc(E.natt)}" role="switch" aria-checked="${nOn}" ${this._hp('medium')}` : `data-act="customize" data-section="entiteter" ${this._hp('light')}`}>
        <div class="bgg"></div><div class="nsk"></div><div class="dawn"></div>${SCENE_SVG(pOk)}
        <div class="stx"><span class="k">${esc(kicker)}</span><span class="gt">${night ? 'God natt' : 'God morgen'}</span>${sub ? `<span class="k">${esc(sub)}</span>` : ''}${pend ? SYNC : ''}</div>
        <div class="chips">${chip(E.natt, nS, nua, nOn, 'n', 'mdi:moon-waning-crescent', nOn ? 'Natt på' : 'Natt av', 'medium')}${chip(E.privat, pS, pua, pOk, 'p', pOk ? 'mdi:video-off' : 'mdi:video', pOk ? 'Privat på' : 'Kamera på', 'medium')}</div></div>`;
    }
    _empty(tab) {
      const h = this.hass, R = rules(h, this.config), d = tabDef(this.config, tab);
      const txt = !R.some((r) => r.kilde === 'integrasjon' && r.plattform !== 'ki_energi') && tab !== 'strom' ? 'Fant ingen varsler fra KI Varslinger og sikkerhet'
        : tab === 'strom' && !R.some((r) => r.plattform === 'ki_energi') ? 'Fant ingen varsler fra KI Energi'
          : d && d.custom ? `Ingen varsler i kategorien ${katName(d.source)}` : 'Ingen varsler i denne fanen';
      return `<div class="empty">${M.icon('mdi:bell-off-outline', 22)}<span>${esc(txt)}</span><button class="pick press" data-act="customize" data-section="rader" ${this._hp('light')}>${M.icon('mdi:plus', 18)}Velg entiteter</button></div>`;
    }
    _list(tab) {
      const c = this.config, h = this.hass, all = tabRows(h, c, tab);
      all.forEach((r) => this.s(r.id));
      if (!all.length) return this._empty(tab);
      const q = (this.ui.q || '').trim().toLowerCase();
      let L = q ? all.filter((r) => `${r.name} ${r.sub} ${r.enhet} ${r.id}`.toLowerCase().includes(q)) : all;
      if (c.av_forst) L = [...L.filter((r) => !isOn(h.states[r.id])), ...L.filter((r) => isOn(h.states[r.id]))];
      const on = all.filter((r) => isOn(h.states[r.id])).length, allOn = on === all.length;
      const search = c.sok !== false ? `<label class="srch" data-key="srch">${M.icon('mdi:magnify', 20, 'color:#979797')}<input data-input="q" data-key="q" value="${esc(this.ui.q || '')}" placeholder="Søk blant ${all.length}" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="search">${this.ui.q ? `<button class="clr" data-act="qclr" ${this._hp('light')} aria-label="Tøm søk">${M.icon('mdi:close', 18)}</button>` : ''}</label>` : '';
      const head = c.show_summary !== false ? `<div class="cnt" data-key="cnt"><span class="num">${on} av ${all.length} på</span><button class="all press" data-act="all" data-v="${allOn ? 'off' : 'on'}" ${this._hp('medium')}>${allOn ? 'Slå alle av' : 'Slå alle på'}</button></div>` : '';
      const rows = L.map((r, k) => {
        const s = h.states[r.id], o = isOn(s), un = M.unavailable(s);
        const sub = un ? 'Svarer ikke' : r.sub || '–';
        return `<button class="pr press ${o ? '' : 'off'}" style="animation-delay:${k * 25}ms" data-key="r-${esc(r.key)}" data-act="tg" data-id="${esc(r.id)}" data-ent="${esc(r.id)}" role="switch" aria-checked="${o}" ${this._hp('selection')} ${un ? 'disabled' : ''}>
          <span class="pi">${M.icon(r.icon, 22)}</span>
          <span class="pt"><b>${esc(r.name)}</b><i>${o || un ? esc(sub) : 'Av · ' + esc(sub)}</i></span>
          <span class="sw ${o ? 'on' : ''}"></span></button>`;
      }).join('');
      return `${search}<div class="lst">${head}${rows || '<div class="none">Ingen treff</div>'}</div>`;
    }
    onInput(name, el) { if (name === 'q') this.setUI({ q: el.value }); }
    onAction(name, el, ev) {
      const d = el.dataset;
      switch (name) {
        case 'tab': return this.setUI({ tab: d.v, q: '' });
        case 'night': return this._flip(ents(this.hass, this.config).natt);
        case 'priv': return this._flip(ents(this.hass, this.config).privat);
        case 'tg': return d.id ? M.call(this.hass, 'homeassistant', 'toggle', { entity_id: d.id }) : undefined;
        case 'qclr': return this.setUI({ q: '' });
        case 'all': {
          const c = this.config, h = this.hass;
          const L = tabRows(h, c, this.tab).filter((r) => !M.unavailable(h.states[r.id])).map((r) => r.id);
          if (L.length) return M.call(h, 'homeassistant', d.v === 'off' ? 'turn_off' : 'turn_on', { entity_id: L });
          return undefined;
        }
        default: return super.onAction(name, el, ev);
      }
    }
    afterRender() {
      if (M.glassDrag) this.shadowRoot.querySelectorAll('.bar .tabs').forEach((s) => M.glassDrag(s, { axis: 'x' }));
      // «Dashbord» nederst: dashbordets innstillinger (msh-settings-card) bygd inn – de forsvinner ikke fra #settings
      const slot = this.shadowRoot.querySelector('.dash');
      if (slot) {
        if (!this._dashEl && customElements.get('msh-settings-card')) { this._dashEl = document.createElement('msh-settings-card'); this._dashEl.setConfig({ type: 'custom:msh-settings-card', embedded: true }); }
        if (this._dashEl) { if (this._dashEl.parentNode !== slot) slot.appendChild(this._dashEl); if (this._dashEl.hass !== this.hass) this._dashEl.hass = this.hass; }
      }
    }
    get styles() {
      const T = '1.2s cubic-bezier(.5,0,.2,1)';
      return `
        :host{display:block;width:100%}
        .wrap,.pane{display:flex;flex-direction:column;gap:var(--msh-gap,8px);min-width:0}
        .dash{display:block;min-width:0}
        .gh{font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#7f7f7f;padding:16px 8px 0}
        @keyframes fade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes smoke{0%{transform:translate(0,0) scale(.6);opacity:0}25%{opacity:.55}100%{transform:translate(-10px,-34px) scale(1.6);opacity:0}}
        @keyframes fly{0%,100%{transform:translate(0,0)}50%{transform:translate(-14px,-4px)}}
        @keyframes flap{0%,100%{transform:scaleY(1)}50%{transform:scaleY(.4)}}
        @keyframes twinkle{0%,100%{opacity:.25}50%{opacity:1}}
        @keyframes glow{0%,100%{opacity:1}50%{opacity:.82}}
        @keyframes camscan{0%,100%{transform:rotate(-16deg)}50%{transform:rotate(14deg)}}
        @keyframes recblink{0%,55%{opacity:1}56%,100%{opacity:.15}}
        @keyframes lockpop{0%{transform:scale(1)}35%{transform:scale(.72) translateY(3px)}70%{transform:scale(1.12)}100%{transform:scale(1)}}
        @keyframes sunrise{0%{transform:translateY(60px);opacity:0}100%{transform:none;opacity:1}}
        @keyframes dawnsky{0%{opacity:1}100%{opacity:0}}
        @keyframes sealring{0%{transform:scale(.4);opacity:.9}100%{transform:scale(2.4);opacity:0}}
        .sync{position:relative;display:flex;align-items:center;gap:6px;font-size:11px;color:#e6e2ee;margin-top:4px;white-space:nowrap}
        .spin{width:10px;height:10px;box-sizing:content-box;border-radius:50%;border:2px solid rgba(255,255,255,.35);border-top-color:#fff;animation:spin .8s linear infinite;flex:none}
        /* to kort (nattmodus av) */
        .two{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--msh-gap,8px)}
        .mk{position:relative;height:164px;border-radius:28px;overflow:hidden;isolation:isolate;padding:16px;box-sizing:border-box;display:flex;flex-direction:column;cursor:pointer;min-width:0;text-align:left;color:#fafafa}
        .mk.natt{background:linear-gradient(180deg,#23285a,#2c2d5e)}
        .nsky{position:absolute;right:0;top:0;width:100%;height:calc(100% - 44px);pointer-events:none}
        .mh{position:relative;display:flex;justify-content:space-between;align-items:flex-start}
        .mt{font-size:14px;color:#dcdcf0;white-space:nowrap}
        .mk.priv .mt{color:#e2efe8}
        .ci{width:44px;height:44px;border-radius:22px;background:rgba(255,255,255,.12);display:grid;place-items:center;flex:none}
        .mk.priv .ci{background:rgba(255,255,255,.14)}
        .mb{position:relative;margin-top:auto;display:flex;justify-content:space-between;align-items:center;gap:6px}
        .mv{font-size:28px;font-weight:400;line-height:1.2}
        .bs{position:relative;width:50px;height:28px;border-radius:14px;flex:none;background:rgba(255,255,255,.28);box-shadow:inset 0 0 0 1px rgba(255,255,255,.2);transition:background .25s}
        .bs::after{content:'';position:absolute;top:4px;left:4px;width:20px;height:20px;border-radius:10px;background:#fafafa;transition:transform .3s,background .3s}
        .bs.on{background:rgb(102 209 158)}.bs.on::after{transform:translateX(22px);background:#1d2a22}
        .mk .pick{height:32px;padding:0 10px;font-size:12px}
        .mk.priv{background:var(--gray200,#3a3a3a);transition:background .5s}
        .mk.priv.on{background:linear-gradient(160deg,#173d31,#1f5642)}
        .glw{position:absolute;right:-20px;top:20px;width:120px;height:120px;border-radius:50%;background:radial-gradient(circle,rgba(111,210,154,.35),transparent 70%);opacity:0;transition:opacity .6s;pointer-events:none}
        .mk.priv.on .glw{opacity:1;animation:glow 3s ease-in-out infinite}
        .ml{position:relative;display:flex;flex-direction:column;gap:4px;margin-top:6px;min-width:0}
        .lk{position:relative;width:28px;height:28px;display:grid;place-items:center;color:#afafaf}
        .mk.priv.on .lk{color:#cfeadd}
        .lk ha-icon{animation:lockpop .5s cubic-bezier(.34,1.6,.64,1)}
        .lk .ring{position:absolute;inset:0;border-radius:50%;border:2px solid rgba(207,234,221,.8);animation:sealring .7s ease-out forwards;pointer-events:none}
        .ms{font-size:12px;color:#e2efe8;white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis}
        /* Privatmodus: kamera på veggfeste (bare transform/opacity animeres) */
        .pfx{position:absolute;inset:0;pointer-events:none}
        .pmount{position:absolute;right:0;top:74px;width:10px;height:26px;border-radius:4px 0 0 4px;background:#5a5a5a;transition:background .5s}
        .mk.priv.on .pmount{background:rgba(207,234,221,.35)}
        .ptilt{position:absolute;right:10px;top:78px;width:50px;height:22px;transform-origin:100% 50%;transform:rotate(0deg);transition:transform .7s cubic-bezier(.34,1.3,.64,1)}
        .mk.priv.on .ptilt{transform:rotate(38deg)}
        .pscan{position:relative;width:100%;height:100%;transform-origin:100% 50%;animation:camscan 5s ease-in-out infinite}
        .mk.priv.on .pscan{animation:none}
        .pcone{position:absolute;right:46px;top:-18px;width:96px;height:58px;clip-path:polygon(100% 42%,0 0,0 100%,100% 58%);background:linear-gradient(270deg,rgba(255,236,170,.4),transparent);opacity:1;transition:opacity .35s}
        .mk.priv.on .pcone{opacity:0}
        .pbody{position:absolute;inset:0;border-radius:7px;background:#7a7a7a;transition:background .5s}
        .mk.priv.on .pbody{background:#cfeadd;box-shadow:0 4px 14px rgba(0,0,0,.25)}
        .plens{position:absolute;left:-6px;top:2px;width:18px;height:18px;border-radius:50%;overflow:hidden;background:radial-gradient(circle at 35% 35%,#8494a2,#111 62%);box-shadow:0 0 0 2px #8a8a8a;transition:box-shadow .5s}
        .mk.priv.on .plens{box-shadow:0 0 0 2px #cfeadd}
        .plid{position:absolute;left:0;right:0;top:0;height:100%;background:#1f5642;transform:scaleY(0);transform-origin:50% 0;transition:transform .4s cubic-bezier(.4,0,.2,1) .2s}
        .mk.priv.on .plid{transform:scaleY(1)}
        .prec{position:absolute;right:7px;top:8px;width:6px;height:6px;border-radius:50%;background:rgb(242 128 115);box-shadow:0 0 6px rgb(242 128 115);animation:recblink 1.2s steps(1) infinite}
        .mk.priv.on .prec{background:#1f5642;box-shadow:none;animation:none}
        .mk.priv.ua .pscan,.mk.priv.ua .prec{animation:none}
        .mk.priv.ua .pcone{opacity:0}
        .mk.priv.ua .prec{background:#696969;box-shadow:none}
        .mk.priv.na .pscan,.mk.priv.na .prec,.mk.priv.na .glw,.mk.priv.na .lk ha-icon,.mk.priv.na .lk .ring{animation:none !important}
        .mk.priv.na .lk .ring{opacity:0}
        .mk.priv.na .ptilt,.mk.priv.na .plid,.mk.priv.na .pcone{transition:none !important}
        /* «God natt» / «God morgen» (184 px) */
        .sc{position:relative;height:184px;border-radius:28px;overflow:hidden;isolation:isolate;background:#141a3a;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.05);cursor:pointer;animation:fade .45s ease both;color:#fafafa;transition:transform .15s cubic-bezier(.34,1.5,.64,1)}
        .sc:active{transform:scale(.985)}
        .sc .bgg,.sc .nsk,.sc .dawn{position:absolute;inset:0;pointer-events:none}
        .sc .bgg{background:linear-gradient(180deg,#3a3d72 0%,#77598e 45%,#d68f86 78%,#f0b88c 100%)}
        .sc .nsk{background:linear-gradient(180deg,#0f1433 0%,#1c2250 55%,#2d2f62 100%);opacity:0;transition:opacity ${T}}
        .sc.night .nsk{opacity:1}
        .sc .dawn{background:linear-gradient(180deg,#2a2c5c 0%,#5a4778 55%,#b0727a 100%);opacity:0}
        .sc.morning .dawn{animation:dawnsky 3s ease-out both}
        .sc .art{position:absolute;right:0;bottom:0;height:100%;width:100%;overflow:visible;pointer-events:none}
        .sc .stars{opacity:0;transition:opacity ${T}}.sc.night .stars{opacity:1}
        .sc .moon{transform:translateY(70px);opacity:0;transition:transform ${T},opacity ${T}}.sc.night .moon{transform:none;opacity:1}
        .sc .sun{transform:none;opacity:1;transition:transform ${T},opacity ${T}}.sc.night .sun{transform:translateY(70px);opacity:0}
        .sc.morning .sunw{animation:sunrise 2.6s cubic-bezier(.2,.7,.2,1) both}
        .sc .rays{transform-box:fill-box;transform-origin:center;animation:spin 40s linear infinite}
        .sc .smk{transform-box:fill-box;animation:smoke 3.2s ease-out infinite}
        .sc .win{fill:#f5cf78}.sc.night .win{fill:#ffd572;filter:drop-shadow(0 0 4px rgba(255,210,110,.9));animation:glow 3s ease-in-out infinite}
        .sc .scam{fill:#545454}.sc .scam.rec{fill:rgb(242 128 115);animation:glow 1.4s ease-in-out infinite}
        .sc .birds{opacity:1;transition:opacity .8s}.sc.night .birds{opacity:0}
        .sc .f1{animation:fly 7s ease-in-out infinite}.sc .f2{animation:fly 8s ease-in-out 1s infinite}
        .sc .fl1,.sc .fl2{transform-box:fill-box;transform-origin:center;animation:flap .9s ease-in-out infinite}.sc .fl2{animation:flap 1s ease-in-out .3s infinite}
        .sc .stx{position:absolute;left:18px;top:18px;right:72px;display:flex;flex-direction:column;gap:2px;text-shadow:0 1px 6px rgba(0,0,0,.35)}
        .sc .k{font-size:13px;color:#e6e2ee}
        .sc .gt{font-size:28px;font-weight:400;line-height:1.2}
        .sc .chips{position:absolute;left:14px;bottom:14px;right:14px;display:flex;gap:6px}
        .cp{height:36px;padding:0 14px 0 10px;border-radius:18px;display:flex;align-items:center;gap:6px;font-size:13px;font-weight:600;white-space:nowrap;background:rgba(0,0,0,.32);color:#e1e1e1;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);transition:background .25s,color .25s,transform .1s;min-width:0}
        .cp:active{transform:scale(.96)}
        .cp.n.on{background:#fafafa;color:#282828}
        .cp.p.on{background:rgb(102 209 158);color:#1d2a22}
        .cp.miss{background:rgba(242,181,115,.3)}
        .sc.na,.sc.na *{animation:none !important;transition:none !important}
        /* fanelinjen + tannhjul */
        ${TAB_CSS('')}
        /* søk, teller, rader */
        .srch{display:flex;align-items:center;gap:10px;height:48px;border-radius:24px;background:var(--gray200,#3a3a3a);padding:0 6px 0 16px}
        .srch input{flex:1;min-width:0;height:100%;font-size:15px;background:transparent;border:0;outline:none;color:#fafafa}
        .srch input::placeholder{color:#979797}
        .clr{width:36px;height:36px;border-radius:18px;display:grid;place-items:center;background:var(--gray300,#404040)}
        .lst{display:flex;flex-direction:column;gap:8px}
        .cnt{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:4px 6px 0;font-size:13px;color:#afafaf;white-space:nowrap}
        .all{height:32px;padding:0 12px;border-radius:16px;background:var(--gray300,#404040);color:#fafafa;font-size:12px;font-weight:500;white-space:nowrap;flex:none}
        .pr{width:100%;display:flex;align-items:center;gap:14px;min-height:66px;padding:4px 18px 4px 4px;box-sizing:border-box;border-radius:34px;background:var(--gray200,#3a3a3a);text-align:left;animation:fade .3s ease both}
        .pr[disabled]{opacity:.5}
        .pi{width:58px;height:58px;border-radius:29px;flex:none;display:grid;place-items:center;background:#4a4a4a;color:#e1e1e1;transition:background .25s,color .25s}
        .pr.off .pi{background:rgb(242 128 115 / .16);color:var(--red,#f28073)}
        .pt{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
        .pt b{font-size:15px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .pt i{font-style:normal;font-size:12px;color:#979797;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .pr.off .pt i{color:var(--red,#f28073)}
        .sw{position:relative;width:44px;height:26px;border-radius:13px;background:var(--gray400,#545454);flex:none;transition:background .2s}
        .sw::after{content:'';position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:10px;background:#fafafa;transition:transform .2s}
        .sw.on{background:var(--pink,#f285c9)}.sw.on::after{transform:translateX(18px)}
        .none{text-align:center;font-size:14px;color:#979797;padding:24px 0}
        @media (max-width:380px){.mv{font-size:24px}}
        @media (prefers-reduced-motion: reduce){.sc,.sc *,.pr,.mk *{animation:none !important;transition:none !important}}`;
    }
  }
  M.define('msh-innstillinger-card', Innstillinger, 'MSH Innstillinger', 'Innstillinger-popupen (#settings): God natt/God morgen, natt- og privatmodus, varsler fra KI Varslinger og sikkerhet (kategorier som faner) og KI Energi, og dashbordets innstillinger (fiks 27).');
})();
