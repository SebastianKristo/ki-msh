/* KI MSH · Innstillinger (#settings, msh-innstillinger-card) – fiks 25.5 + 26.15 + 27.5–27.7 + 29, fasit design/Innstillinger v2.dc.html.
 * Étt kort i Bubble-popupen #settings (mal A).
 *
 * #settings (fiks 26.15): brukerens importerte ki-cards-popup «Innstillinger» (gap-card + ki-natt-card + ki-tabs-card med
 * ki-varsling-card) erstattes av DETTE kortet: MSH.POPUP_SUPERSEDE['#settings'] gjør den importerte popupen inaktiv
 * («Erstattet av Innstillinger», «Bruk egen» i Egne popups gir den tilbake), og MSH.POPUP_EXTRA['#settings'] flytter
 * oppsettet over (MSH.innstExtra): ki-natt-card natt → natt, helg (privatmodus-bryter) → privat, vekking → vekking;
 * ki-tabs-card tabs[i] (ki-varsling-card) → faner[i] med ki-varsling-card-configen 1:1 (fiks 29). Strategien
 * (04-strategy) genererer #settings med dette kortet (card_id pop-innstillinger). Dashbordinnstillingene
 * (msh-settings-card) ligger nederst under «Dashbord».
 *
 * 29 · RADENE KOMMER FRA KILDEN: MSH.finnBrytere() (src/06-varsling-kilde.js = datalogikken fra ki-varsling-card, uendret).
 *   Én fane = én ki-varsling-card-config: faner: [{ key, name, icon, hidden?, plattform, enheter, ikke_enheter, bare, ekstra,
 *   skjul?, master?, kjente?, sok? }]. Standard (som designet): Sikkerhet = ki_notifications med enheter autolås, fastkjørt,
 *   dørlys, alarm, Heimdall, ansikt · Hjem = ki_notifications unntatt de samme (ukjente regler havner her) · Strøm = alt fra
 *   ki_energi (bare varslingsbryterne, sidestilte = alle vises). Ingen mock, ingen faste entitets-ID-er.
 *   Tilpass → Faner: per fane Integrasjoner (alle plattformer med switch/input_boolean, flest først), Bare disse / Ikke disse
 *   (enhetsnavn, «Viser N brytere» live), Ekstra brytere (switch/input_boolean/automation, søk), Visning (hovedbryter,
 *   kjente navn, søkefelt) – også i «Legg til fane». GUI-editoren: ett ha-form med ett expandable per fane (samme felt som
 *   KiVarslingEditor) + ekko-vakt. Tomt: «Fant ingen brytere fra valgte integrasjoner» + «Velg integrasjoner».
 *   Trykk på rad = toggle (optimistisk + tilbakerulling som 27.6), hold 500 ms = more-info.
 * 27.6 · TOPPKORTET: nattmodus av → to kort (Nattmodus · Privatmodus). Nattmodus på → «God natt»-kortet (184 px), og om
 *   morgenen (nattmodus av, kl. 05–11 eller etter vekketid) → «God morgen» med soloppgang. Trykk på HELE kortet slår
 *   nattmodus av/på; chipsene har egen handling. Optimistisk UI: «Synker …» til hass bekrefter, ellers tilbakerulling etter
 *   10 s (MSH.innstSyncMs) + melding – også for privatmodus og radene.
 * Config:
 *   natt · privat · vekking (entitetene i toppkortet)
 *   faner (over) – eldre nøkler leses og migreres ved første lagring: tabs [{ key, title, hidden, filter }],
 *   custom_tabs [{ key, name, icon, source }], tab_order/tab_hidden/tab_names, rows.include/include (→ faner[].ekstra)
 *   rows: { exclude: [device_id|entity_id], move: { id: fane }, names, subs, icons, order: { fane: [id] } }  (rowHid/rowOrder)
 *   tab_labels (icon = ikon + tekst (standard) | name = tekst | ikon = ikoner) · start_tab · sok · show_summary (true) ·
 *   av_forst · haptikk · scene (auto | morgen | dag = kun kort | natt) · animasjoner (true) · (dashbord: utgått, fiks 33.3) · gap · pad_*
 */
(function () {
  const M = window.MSH;
  if (!M) return;
  const esc = M.esc, C = M.C;
  M.innstNow = M.innstNow || (() => new Date()); // klokka (testene kan sette den)
  if (M.innstSyncMs == null) M.innstSyncMs = 10000; // tilbakerulling når hass ikke bekrefter

  /* ============================================================ faner (29.2: én fane = én ki-varsling-card-config) */
  const finn = (h, c) => (M.finnBrytere ? M.finnBrytere(h, c) : []);
  const erMaster = (b) => (M.kiVarsErMaster ? M.kiVarsErMaster(b) : false);
  const slugOf = (t) => String(t || '').toLowerCase().replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'a').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const arr = (v) => (Array.isArray(v) ? v.filter((x) => x != null && x !== '').map(String) : v != null && v !== '' && typeof v !== 'object' ? [String(v)] : []);
  const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  const BUILTIN = { sikkerhet: ['Sikkerhet', 'mdi:shield'], hjem: ['Hjem', 'mdi:home'], strom: ['Strøm', 'mdi:lightning-bolt'] };
  // Kjente regler i Sikkerhet (enhetsnavn, delvis treff som ki-varsling-card); Hjem = resten av KI Varslinger
  const DEF_SIK = ['Autolås', 'Fastkjørt', 'Dørlys', 'Alarm', 'Heimdall', 'Ansikt'];
  const DEF_FILTER = { sikkerhet: { plattform: ['ki_notifications'], enheter: DEF_SIK }, hjem: { plattform: ['ki_notifications'], ikke_enheter: DEF_SIK }, strom: { plattform: ['ki_energi'] } };
  const LIST_KEYS = ['plattform', 'enheter', 'ikke_enheter', 'bare', 'ekstra', 'skjul'];
  const BOOL_KEYS = ['master', 'kjente', 'sok'];
  const plattformNavn = (h, p) => (M.varslingPlattformNavn ? M.varslingPlattformNavn(h, p) : p);
  // 27.7-kategorier (custom_tabs.source) → enhetsnavn-ord (migrering)
  const SRC_ORD = { kamera: ['Kamera', 'Bevegelse', 'Pakke'], klima: ['Fukt', 'Vindu', 'Frost', 'Temperatur', 'Klima'], hvitevarer: ['Vaskemaskin', 'Tørketrommel', 'Oppvask'], batteri: ['Batteri'], sikkerhet: DEF_SIK };
  const KAT_NAVN = { kamera: ['Kamera', 'mdi:video'], klima: ['Klima', 'mdi:thermostat'], hvitevarer: ['Hvitevarer', 'mdi:washing-machine'], batteri: ['Batteri', 'mdi:battery-alert'] };
  const katName = (k) => (KAT_NAVN[k] ? KAT_NAVN[k][0] : String(k || '').replace(/_/g, ' ').replace(/^./, (x) => x.toUpperCase()));
  // Eldre fane-nøkler (25.5/26.15): automasjoner → sikkerhet, varsler → hjem
  const LEGACY = { automasjoner: 'sikkerhet', varsler: 'hjem', auto: 'sikkerhet', push: 'hjem', energi: 'strom' };
  const LEGACY_TITLE = /^(automasjoner|varsler)$/i;
  const keyOf = (k) => (k == null ? k : LEGACY[k] || String(k));
  const edOrder = (keys, saved) => { const o = (Array.isArray(saved) ? saved : []).map(keyOf).filter((k) => keys.includes(k)); keys.forEach((k) => { if (!o.includes(k)) o.push(k); }); return [...new Set(o)]; };
  const hasFilter = (f) => !!f && ['enheter', 'ikke_enheter', 'plattform'].some((k) => arr(f[k]).length);
  const hasSrc = (t) => ['plattform', 'enheter', 'ikke_enheter', 'bare'].some((k) => t[k] !== undefined);
  // Én fane, renset: lister som arrays, brytere som true/false/undefined, navn/ikon fra standardfanen
  function normFane(t) {
    const k = String(t.key), o = { key: k, name: String(t.name || t.title || ''), icon: String(t.icon || ''), hidden: !!t.hidden };
    LIST_KEYS.forEach((x) => { if (t[x] !== undefined && t[x] !== null) o[x] = arr(t[x]); });
    BOOL_KEYS.forEach((x) => { if (t[x] === false) o[x] = false; });
    if (BUILTIN[k] && !hasSrc(o)) Object.assign(o, JSON.parse(JSON.stringify(DEF_FILTER[k])));
    return o;
  }
  // Catch-all-faner (uten enheter/bare) gir fra seg enhetene en egen fane tar (ikke_enheter) – ingen dobbeltrader
  function claim(F, t) {
    const E = arr(t.enheter);
    if (!E.length) return F;
    const P = arr(t.plattform).length ? arr(t.plattform) : M.KI_VARS_PLATTFORM || [];
    return F.map((x) => {
      if (x.key === t.key || arr(x.enheter).length || arr(x.bare).length) return x;
      const XP = x.plattform !== undefined ? arr(x.plattform) : M.KI_VARS_PLATTFORM || [];
      if (!XP.some((p) => P.includes(p))) return x;
      const I = arr(x.ikke_enheter);
      E.forEach((e) => { if (!I.some((y) => y.toLowerCase() === e.toLowerCase())) I.push(e); });
      return { ...x, ikke_enheter: I };
    });
  }
  function release(F, t) {
    const E = arr(t.enheter).map((e) => e.toLowerCase());
    if (!E.length) return F;
    const keep = new Set(F.filter((x) => x.key !== t.key).flatMap((x) => arr(x.enheter).map((e) => e.toLowerCase())));
    return F.map((x) => (x.key === t.key || x.ikke_enheter === undefined ? x : { ...x, ikke_enheter: arr(x.ikke_enheter).filter((e) => !E.includes(e.toLowerCase()) || keep.has(e.toLowerCase())) }));
  }
  // Eldre oppsett (25.5–28): tabs[] + custom_tabs (+ filter) → faner
  function legacyFaner(c) {
    const CT = (Array.isArray(c.custom_tabs) ? c.custom_tabs : []).filter((t) => t && t.key && t.source), cmap = new Map(CT.map((t) => [String(t.key), t]));
    let L;
    if (Array.isArray(c.tabs) && c.tabs.length) {
      L = c.tabs.filter((t) => t && t.key).map((t) => { const k = keyOf(t.key), legacy = k !== String(t.key); let title = t.title ? String(t.title) : ''; if (legacy && LEGACY_TITLE.test(title)) title = ''; return { key: k, title, hidden: !!t.hidden, filter: hasFilter(t.filter) ? t.filter : null, icon: t.icon || '' }; });
    } else { const N = obj(c.tab_names), H = new Set(arr(c.tab_hidden).map(keyOf)); L = edOrder(Object.keys(BUILTIN), c.tab_order).map((k) => ({ key: k, title: N[k] || '', hidden: H.has(k), filter: null, icon: '' })); }
    const seen = new Set();
    L = L.filter((t) => (seen.has(t.key) || !(BUILTIN[t.key] || cmap.has(t.key) || t.filter) ? false : seen.add(t.key)));
    Object.keys(BUILTIN).forEach((k) => { if (!seen.has(k)) { seen.add(k); L.push({ key: k, title: '', hidden: false, filter: null, icon: '' }); } });
    CT.forEach((t) => { if (!seen.has(String(t.key))) { seen.add(String(t.key)); L.push({ key: String(t.key), title: '', hidden: false, filter: null, icon: '' }); } });
    let F = L.map((t) => {
      const ct = cmap.get(t.key), f = t.filter || {};
      if (ct) { const src = String(ct.source); return { key: t.key, name: String(ct.name || katName(src)), icon: String(ct.icon || (KAT_NAVN[src] ? KAT_NAVN[src][1] : 'mdi:bell-outline')), hidden: t.hidden, plattform: ['ki_notifications'], enheter: [...(SRC_ORD[src] || [katName(src)])] }; }
      const o = { key: t.key, name: t.title || (BUILTIN[t.key] ? BUILTIN[t.key][0] : t.key), icon: t.icon || (BUILTIN[t.key] ? BUILTIN[t.key][1] : 'mdi:tab'), hidden: t.hidden };
      if (BUILTIN[t.key]) Object.assign(o, JSON.parse(JSON.stringify(DEF_FILTER[t.key])));
      if (arr(f.plattform).length) o.plattform = arr(f.plattform);
      if (arr(f.enheter).length || arr(f.ikke_enheter).length) { delete o.enheter; delete o.ikke_enheter; if (arr(f.enheter).length) o.enheter = arr(f.enheter); if (arr(f.ikke_enheter).length) o.ikke_enheter = arr(f.ikke_enheter); }
      return o;
    });
    CT.forEach((t) => { const x = F.find((y) => y.key === String(t.key)); if (x && !x.hidden) F = claim(F, x); });
    return F;
  }
  // Fanene (29.2): faner[] – ellers migrert fra de eldre nøklene. Ekstra rader fra 26.15 (rows.include + move) → ekstra.
  const fmemo = new WeakMap();
  function fanerOf(c) {
    c = c || {};
    if (fmemo.has(c)) return fmemo.get(c);
    let F;
    if (Array.isArray(c.faner) && c.faner.some((t) => t && t.key != null)) { const seen = new Set(); F = c.faner.filter((t) => t && t.key != null && !seen.has(String(t.key)) && seen.add(String(t.key))).map(normFane); }
    else F = legacyFaner(c);
    const r = obj(c.rows), inc = [...arr(r.include)], mv = { ...obj(r.move) };
    if (!c.rows) Object.entries(obj(c.include)).forEach(([t, L]) => arr(L).forEach((id) => { if (!inc.includes(id)) inc.push(id); mv[id] = t; }));
    inc.forEach((id) => { const k = keyOf(mv[id]), t = F.find((x) => x.key === k) || F[0]; if (t && !arr(t.ekstra).includes(id)) t.ekstra = [...arr(t.ekstra), id]; });
    F = F.map((t) => ({ ...t, builtin: !!BUILTIN[t.key], custom: !BUILTIN[t.key], name: t.name || (BUILTIN[t.key] ? BUILTIN[t.key][0] : t.key), icon: t.icon || (BUILTIN[t.key] ? BUILTIN[t.key][1] : 'mdi:tab') }));
    fmemo.set(c, F);
    return F;
  }
  // Til config: samme nøkler som ki-varsling-card (plattform alltid med, standardverdier ut)
  const fanerOut = (F) => F.map((t) => {
    const o = { key: t.key, name: t.name || (BUILTIN[t.key] ? BUILTIN[t.key][0] : t.key), icon: t.icon || (BUILTIN[t.key] ? BUILTIN[t.key][1] : 'mdi:tab') };
    if (t.hidden) o.hidden = true;
    o.plattform = t.plattform !== undefined ? arr(t.plattform) : [...(M.KI_VARS_PLATTFORM || [])];
    ['enheter', 'ikke_enheter', 'bare', 'ekstra', 'skjul'].forEach((x) => { if (arr(t[x]).length) o[x] = arr(t[x]); });
    BOOL_KEYS.forEach((x) => { if (t[x] === false) o[x] = false; });
    return o;
  });
  M.innstFaner = fanerOf;
  M.innstFanerOut = fanerOut;
  const visTabs = (c) => { const D = fanerOf(c), V = D.filter((t) => !t.hidden); return V.length ? V : D.slice(0, 1); };
  const tabDef = (c, k) => fanerOf(c).find((t) => t.key === keyOf(k)) || null;
  // Kortnivå-valg som gjelder alle faner + fanens egne nøkler → én ki-varsling-card-config
  const CARD_KEYS = ['skille', 'kjente', 'master', 'ikke_master', 'navn', 'undertekst', 'ikoner', 'skjul'];
  function faneCfg(c, t) {
    const o = {};
    CARD_KEYS.forEach((k) => { if (c[k] != null) o[k] = c[k]; });
    LIST_KEYS.forEach((k) => { if (t[k] !== undefined) o[k] = k === 'skjul' ? [...arr(o.skjul), ...arr(t.skjul)] : arr(t[k]); });
    BOOL_KEYS.forEach((k) => { if (t[k] === false) o[k] = false; });
    return o;
  }
  M.innstFaneCfg = faneCfg;
  // rows (26.15) – rad-overstyringer oppå kilden (rowHid/rowOrder/navn/ikon/flytt); 25.5-nøklene exclude per fane leses
  function rowsCfg(c) {
    const r = obj(c.rows), order = {};
    Object.entries(obj(r.order)).forEach(([k, v]) => { const kk = keyOf(k); if (!order[kk]) order[kk] = v; });
    const o = { exclude: arr(r.exclude), move: { ...obj(r.move) }, include: arr(r.include), names: obj(r.names), subs: obj(r.subs), icons: obj(r.icons), order };
    if (!c.rows) Object.values(obj(c.exclude)).forEach((L) => arr(L).forEach((id) => { if (!o.exclude.includes(id)) o.exclude.push(id); }));
    return o;
  }
  const rowsOut = (W) => { const o = {}; Object.keys(W).forEach((k) => { if (k === 'include') return; const x = W[k]; if (Array.isArray(x) ? x.length : Object.keys(x).length) o[k] = x; }); return Object.keys(o).length ? o : undefined; };
  const pick = (O, r) => { for (const k of [r.key, r.id, r.dev, r.slug]) if (k && O[k] != null && O[k] !== '') return O[k]; return undefined; };
  const inList = (L, r) => [r.key, r.id, r.dev, r.slug].some((k) => k && L.includes(k));
  const moveTab = (v) => (v == null || v === '' ? null : keyOf(String(v)));

  /* ============================================================ radene (kilde: MSH.finnBrytere per fane) */
  let memo = null;
  function compute(h, c) {
    if (!h) return { F: fanerOf(c), per: new Map(), rows: [], byId: new Map() };
    if (memo && memo.s === h.states && memo.e === h.entities && memo.d === h.devices && memo.c === c) return memo.x;
    const F = fanerOf(c), R = rowsCfg(c), reg = h.entities || {}, per = new Map(), byId = new Map();
    F.forEach((t) => {
      const L = finn(h, faneCfg(c, t));
      per.set(t.key, L.map((b) => b.id));
      L.forEach((b) => { if (!byId.has(b.id)) byId.set(b.id, { ...b, tabs: [] }); byId.get(b.id).tabs.push(t.key); });
    });
    const perDev = new Map();
    byId.forEach((b) => { const d = (reg[b.id] && reg[b.id].device_id) || null; b.dev = d; if (d && b.kilde !== 'ekstra') perDev.set(d, (perDev.get(d) || 0) + 1); });
    byId.forEach((b, id) => {
      const r = b;
      r.key = b.kilde !== 'ekstra' && b.dev && perDev.get(b.dev) === 1 ? b.dev : b.id;
      r.all = b.dev ? Object.keys(reg).filter((x) => reg[x] && reg[x].device_id === b.dev) : [b.id];
      r.name = pick(R.names, r) || b.navn; r.sub = pick(R.subs, r) || b.under; r.icon = pick(R.icons, r) || b.ikon;
      r.hidden = inList(R.exclude, r);
      r.move = moveTab(pick(R.move, r));
      r.master = erMaster(b) || /\bki_energi_varsler\b/.test(b.id);
      byId.set(id, r);
    });
    const x = { F, per, rows: [...byId.values()], byId };
    memo = { s: h.states, e: h.entities, d: h.devices, c, x };
    return x;
  }
  const rules = (h, c) => compute(h, c).rows;
  M.innstRules = rules;
  // Signaturen til det åpne Tilpass-arket: brytersettet (id) per fane + plattformene i registeret
  const ruleSig = (h, c) => { const X = compute(h, c); return [...X.per.entries()].map(([k, L]) => k + ':' + L.join('+')).join('|') + '#' + (M.varslingPlattformer ? M.varslingPlattformer(h).map((p) => p.label).join(',') : ''); };
  // Kortets signatur: [id, pa] (+ borte) for alle rader – registerendringer tegner bare når denne endres
  const cardSig = (h, c) => JSON.stringify(rules(h, c).map((r) => [r.id, r.pa, r.borte, r.tabs.join()]));
  // Radene i en fane: kilden (+ flyttet hit) − skjult, i lagret rekkefølge (rows.order) – ellers kildens rekkefølge,
  // KI Energis hovedbryter øverst
  function tabRows(h, c, key, opts) {
    const X = compute(h, c), t = X.F.find((x) => x.key === keyOf(key));
    if (!t) return [];
    const moved = (r) => (r.move && X.F.some((x) => x.key === r.move) ? r.move : null);
    let L = (X.per.get(t.key) || []).map((id) => X.byId.get(id)).filter((r) => r && (!moved(r) || moved(r) === t.key));
    X.rows.forEach((r) => { if (moved(r) === t.key && !L.includes(r)) L.push(r); });
    if (!(opts && opts.withHidden)) L = L.filter((r) => !r.hidden);
    if (!arr(t.bare).length) L = L.map((r, i) => [r, i]).sort((a, b) => (b[0].master && b[0].plattform === 'ki_energi') - (a[0].master && a[0].plattform === 'ki_energi') || a[1] - b[1]).map((x) => x[0]);
    const O = arr(rowsCfg(c).order[t.key]);
    if (O.length) { const rank = new Map(O.map((k, i) => [k, i])); const rk = (r) => (rank.has(r.key) ? rank.get(r.key) : rank.has(r.id) ? rank.get(r.id) : 1e6); L = L.slice().sort((a, b) => rk(a) - rk(b)); }
    return L;
  }
  M.innstRows = tabRows;
  M.innstTabs = fanerOf;
  // Enhetene (= regler) fra valgte integrasjoner, med antall brytere – «Legg til fane» (29.3)
  function enheterOf(h, cfg) {
    const n = new Map();
    finn(h, { plattform: cfg.plattform, master: cfg.master, ikke_master: cfg.ikke_master, kjente: cfg.kjente }).forEach((b) => { if (b.kilde !== 'integrasjon') return; const e = n.get(b.enhet) || { enhet: b.enhet, n: 0, ikon: b.ikon }; e.n++; n.set(b.enhet, e); });
    return [...n.values()].sort((a, b) => b.n - a.n || a.enhet.localeCompare(b.enhet, 'nb'));
  }
  M.innstEnheter = enheterOf;

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
    const out = {}, faner = [];
    const find = (o, re, d, acc) => { if (!o || typeof o !== 'object' || d > 12) return acc; if (Array.isArray(o)) { o.forEach((x) => find(x, re, d + 1, acc)); return acc; } if (re.test(String(o.type || ''))) acc.push(o); Object.values(o).forEach((x) => { if (x && typeof x === 'object') find(x, re, d + 1, acc); }); return acc; };
    const natt = find(cfg, /^custom:ki-natt-card$/, 0, [])[0];
    if (natt) {
      if (natt.natt) out.natt = natt.natt;
      const priv = natt.privat === true || /privac|privat|kamera|camera/i.test(String(natt.helg || '') + ' ' + String(natt.navn_helg || ''));
      if (natt.helg && priv) out.privat = natt.helg;
      if (natt.vekking) out.vekking = natt.vekking;
    }
    const tc = find(cfg, /^custom:ki-tabs-card$/, 0, [])[0];
    const used = new Set(), R = { names: {}, subs: {}, icons: {} };
    // Fiks 29: hver ki-varsling-card blir én fane med samme nøkler (plattform, enheter, ikke_enheter, bare, ekstra, skjul …)
    (tc && Array.isArray(tc.tabs) ? tc.tabs : []).forEach((t, i) => {
      const v = find(t, /^custom:ki-varsling-card$/, 0, [])[0];
      if (!v) return;
      let key = tabKeyOf(t.title, v);
      if (!key || used.has(key)) key = 'fane_' + (String(t.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || i);
      used.add(key);
      const o = { key, name: t.title && !LEGACY_TITLE.test(String(t.title)) ? String(t.title) : BUILTIN[key] ? BUILTIN[key][0] : String(t.title || key), icon: t.icon || (BUILTIN[key] ? BUILTIN[key][1] : 'mdi:tab') };
      LIST_KEYS.forEach((k) => { if (v[k] != null && arr([].concat(v[k])).length) o[k] = arr([].concat(v[k])); });
      if (!o.plattform) o.plattform = [...(M.KI_VARS_PLATTFORM || [])];
      BOOL_KEYS.forEach((k) => { if (v[k] === false) o[k] = false; });
      faner.push(o);
      Object.assign(R.names, obj(v.navn)); Object.assign(R.subs, obj(v.undertekst)); Object.assign(R.icons, obj(v.ikoner));
    });
    if (faner.length) out.faner = faner;
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
    ${P}.tabs{flex:1;min-width:0;display:flex;gap:2px;padding:4px;border-radius:26px;background:var(--ki-surface, #3a3a3a);box-shadow:inset 0 0 0 1px rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.05*var(--ki-wa-k,1)),var(--ki-wa-max,1)));position:relative;overflow-x:auto;scrollbar-width:none;touch-action:pan-y}
    ${P}.tabs::-webkit-scrollbar{display:none}
    ${P}.tb{flex:1 1 0;min-width:0;padding:0 4px;height:44px;border-radius:22px;display:flex;flex-direction:row;align-items:center;justify-content:center;gap:6px;font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;color:var(--ki-text-2, #afafaf);box-sizing:border-box}
    ${P}.tabs.m-b .tb{height:56px;flex-direction:column;gap:3px;font-size:11px}
    ${P}.tb .tl{max-width:100%;overflow:hidden;text-overflow:ellipsis}
    ${P}.tb.on{background:${C.accent};color:var(--ki-on-accent, #3a3a3a)}
    ${P}.tabs.many .tb{flex:1 0 auto;min-width:60px;padding:0 10px}
    ${P}.gear{width:56px;height:56px;border-radius:28px;flex:none;background:var(--ki-surface, #3a3a3a);box-shadow:inset 0 0 0 1px rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.05*var(--ki-wa-k,1)),var(--ki-wa-max,1)));display:grid;place-items:center}`;

  /* ============================================================ editoren (Tilpass Innstillinger + GUI) */
  const cid = (ed) => ((ed && ed._config && ed._config.card_id) || '_');
  const RT = new Map(), ADD = new Set(), EXP = new Map(), NT = new Map(), ENTO = new Map();
  const ENT_DEF = [['natt', 'mdi:moon-waning-crescent', 'Nattmodus', ['input_boolean', 'switch']], ['privat', 'mdi:video-off', 'Privatmodus', ['input_boolean', 'switch']], ['vekking', 'mdi:alarm', 'Vekketid', ['input_datetime', 'sensor']]];
  // «Legg til fane»: ikoner (designets TICONS → mdi), alle prefiks via ikonvelgeren («…»)
  const TICONS = ['mdi:bell', 'mdi:video', 'mdi:thermostat', 'mdi:washing-machine', 'mdi:battery-alert', 'mdi:paw', 'mdi:garage', 'mdi:water'];
  const INN_CSS = `
    .ttl .tt{letter-spacing:-0.02em}
    /* designet: bare «Ferdig» i headeren (lukk/avbryt = bakteppet, Esc) – tittelen får plass; fanene ligger fast under */
    .ttl .hb[data-a="cancel"]{display:none}
    .wrap>.chips.sg.tabs{position:sticky;top:calc(var(--ki-grab-h, 0px) - var(--ki-sh-pt, 0px) + 47px);z-index:4;box-shadow:0 0 0 10px var(--ki-sheet-bg,#282828)}
    .chips.sg.tabs{background:var(--ki-surface, #3a3a3a);border-radius:24px;padding:4px;gap:2px}
    .chips.sg.tabs .chip{height:40px;border-radius:20px;font-size:12px;font-weight:500}
    .chips.sg.tsub{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);background:var(--ki-surface, #3a3a3a);border-radius:22px;padding:4px;gap:2px}
    .chips.sg.tsub .chip{height:36px;border-radius:18px;font-size:12px;font-weight:500;color:var(--ki-text-mid, #979797);background:transparent}
    .chips.sg.tsub .chip.on{background:var(--ki-surface-2, #404040);color:var(--ki-text, #fafafa)}
    /* designet: én flate (#3a3a3a r24) per seksjon med overskriften INNI, rader flatt med skillelinjer */
    .fsec{gap:0;border-radius:24px;background:var(--ki-surface, #3a3a3a)}
    .fsec>.fsh{padding:14px 16px 6px;font-size:12px;font-weight:500}
    .fsec>.sec{border-radius:24px;background:transparent;box-shadow:none;border:0}
    .fsec>.sec>.in{padding:0 16px}
    .fsec .sec .f{background:transparent;padding:10px 0;border-radius:0}
    .fsec .sec .f + .f{border-top:1px solid rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.06*var(--ki-wa-k,1)),var(--ki-wa-max,1)))}
    .fsec .sec .f:has(>.line){display:grid;grid-template-columns:minmax(0,1fr) auto;column-gap:12px;row-gap:2px;align-items:center;min-height:64px;box-sizing:border-box}
    .fsec .sec .f:has(>.line)>.line{display:contents}
    .fsec .sec .f:has(>.line) .line>span{grid-column:1;grid-row:1;font-size:15px !important;font-weight:500}
    .fsec .sec .f:has(>.line) .line>.sw{grid-column:2;grid-row:1 / span 2}
    .fsec .sec .f:has(>.line)>.help{grid-column:1;grid-row:2;font-size:12px;color:var(--ki-text-mid, #979797)}
    .fsec .f>label{font-size:13px;color:var(--ki-text-2, #afafaf)}
    .fsec .f .chips.sg:not(.tabs):not(.tsub){display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:2px;padding:4px;border-radius:22px;background:var(--ki-popup, #282828)}
    .fsec .f .chips.sg:not(.tabs):not(.tsub) .chip{height:36px;border-radius:18px;justify-content:center;padding:0 4px;background:transparent;color:var(--ki-text-2, #afafaf);font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden}
    .fsec .f .chips.sg:not(.tabs):not(.tsub) .chip.on{background:${C.accent};color:var(--ki-on-accent, #3a3a3a)}
    .ilist{display:flex;flex-direction:column}
    .irow{display:flex;align-items:center;gap:8px;min-height:56px;padding:8px 0}
    .irow + .irow,.irow + .isub,.isub + .irow{border-top:1px solid rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.06*var(--ki-wa-k,1)),var(--ki-wa-max,1)))}
    .irow.off .iic,.irow.off .inm{opacity:.45}
    .iic{width:32px;height:32px;display:grid;place-items:center;flex:none;color:var(--ki-text-2, #afafaf);--mdc-icon-size:22px}
    button.iic{border-radius:16px}
    .inm{flex:1;min-width:0;height:40px;border-radius:12px;background:var(--ki-popup, #282828);padding:0 12px;font-size:14px;color:var(--ki-text, #fafafa)}
    .inm::placeholder{color:var(--ki-text-mid, #979797)}
    .idel{width:36px;height:36px;border-radius:18px;flex:none;display:grid;place-items:center;color:var(--ki-red-text, var(--red,#f28073))}
    .irow .sw{width:44px;height:26px;border-radius:13px;background:var(--ki-ctrl, #545454);flex:none}
    .irow .sw::after{top:3px;left:3px;width:20px;height:20px;border-radius:10px}
    .irow .sw.on{background:var(--pink,#f285c9)}.irow .sw.on::after{transform:translateX(18px)}
    .iadd{display:flex;align-items:center;gap:12px;width:100%;min-height:56px;padding:0 4px;border-top:1px solid rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.06*var(--ki-wa-k,1)),var(--ki-wa-max,1)));text-align:left;color:var(--ki-pink-text, rgb(242 133 201));font-size:15px;font-weight:500}
    .ntp{display:flex;flex-direction:column;gap:10px;margin:0 -4px 8px;padding:12px;border-radius:20px;background:var(--ki-popup, #282828);animation:ntfade .25s ease both}
    @keyframes ntfade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
    .ntl{font-size:12px;color:var(--ki-text-mid, #979797);padding:0 4px}
    .nts{display:flex;flex-direction:column;gap:2px}
    .ntsrc{display:flex;align-items:center;gap:12px;min-height:52px;padding:0 14px;border-radius:16px;text-align:left;width:100%;box-sizing:border-box;background:transparent}
    .ntsrc.on{background:var(--ki-ctrl, #545454)}
    .ntsrc .nm{flex:1;min-width:0;display:flex;flex-direction:column}.ntsrc b{font-size:14px;font-weight:500}.ntsrc i{font-style:normal;font-size:11px;color:var(--ki-text-mid, #979797)}
    .ntn{height:48px;border-radius:16px;padding:0 14px;background:var(--ki-surface, #3a3a3a);color:var(--ki-text, #fafafa);font-size:15px;width:100%;box-sizing:border-box}
    .ntn::placeholder{color:var(--ki-text-mid, #979797)}
    .nti{display:flex;flex-wrap:wrap;gap:6px}
    .nti button{width:44px;height:44px;border-radius:22px;display:grid;place-items:center;background:var(--ki-surface, #3a3a3a);color:var(--ki-text-1, #e1e1e1)}
    .nti button.on{background:${C.accent};color:var(--ki-on-accent, #3a3a3a)}
    .ntgo{height:48px;border-radius:24px;font-size:15px;font-weight:600;background:var(--ki-surface, #3a3a3a);color:var(--ki-text-3, #7f7f7f);width:100%}
    .ntgo.on{background:${C.accent};color:var(--ki-on-accent, #3a3a3a)}
    .pvw{display:flex;flex-direction:column;gap:10px;padding:4px 0 14px}
    .pvw .pvb{padding:10px;border-radius:20px;background:var(--ki-popup, #282828);pointer-events:none}
    .pvw .bar{margin:0}
    ${TAB_CSS('.pvw ')}
    .isub{display:flex;flex-direction:column;gap:8px;padding:10px 0 12px 40px}
    .isub .lb{font-size:12px;color:var(--ki-text-2, #afafaf)}
    .ichips{display:flex;flex-wrap:wrap;gap:6px}
    .ichips button{height:32px;padding:0 12px;border-radius:16px;background:var(--ki-surface-2, #404040);font-size:13px;white-space:nowrap}
    .ichips button.on{background:${C.accent};color:#2a1720;font-weight:500}
    .ifld{display:flex;flex-direction:column;gap:6px;padding:10px 0}
    .ifld + .ifld{border-top:1px solid rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.06*var(--ki-wa-k,1)),var(--ki-wa-max,1)))}
    .ifld .lb{font-size:12px;color:var(--ki-text-2, #afafaf)}
    .inm.full{flex:none;width:100%}
    .iempty{padding:14px 4px;font-size:13px;color:var(--ki-text-mid, #979797)}
    .ibtn{height:44px;border-radius:22px;background:var(--ki-surface-2, #404040);display:flex;align-items:center;justify-content:center;gap:8px;font-size:14px;font-weight:500;width:100%;margin:8px 0}
    .ireset{height:48px;border-radius:24px;background:var(--ki-surface, #3a3a3a);font-size:14px;font-weight:500;color:var(--ki-red-text, var(--red,#f28073));width:100%;margin-top:8px}
    .imeta{font-size:11px;color:var(--ki-text-3, #7f7f7f);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .itx{flex:1;min-width:0;display:flex;flex-direction:column;text-align:left;min-height:44px;justify-content:center}
    .itx b,.ient .nm b{font-size:14px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .itx i,.ient .nm i.mono,.ihit .nm i{font-style:normal;font-size:11px;color:var(--ki-text-3, #7f7f7f);font-family:ui-monospace,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .irow.off .itx{opacity:.6}
    .ient{display:flex;flex-direction:column;gap:8px;padding:10px 0}
    .ient + .ient{border-top:1px solid rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.06*var(--ki-wa-k,1)),var(--ki-wa-max,1)))}
    .ienh{display:flex;align-items:center;gap:12px;width:100%;text-align:left;min-height:44px}
    .eic{width:36px;height:36px;border-radius:18px;flex:none;display:grid;place-items:center;background:var(--ki-surface-2, #404040);color:var(--ki-text-1, #e1e1e1)}
    .ient .nm,.ihit .nm{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
    .ient .nm i.pk{font-style:normal;font-size:11px;color:var(--ki-pink-text, rgb(242 133 201))}
    .ientp{display:flex;flex-direction:column;gap:6px;padding:8px;border-radius:18px;background:var(--ki-popup, #282828)}
    .ientp .edq{height:40px;border-radius:12px;background:var(--ki-surface, #3a3a3a)}
    .ihit{display:flex;align-items:center;gap:10px;min-height:48px;padding:4px 10px;border-radius:12px;text-align:left;width:100%;box-sizing:border-box}
    .ihit.on{background:var(--ki-surface, #3a3a3a)}
    .ihit .nm b{font-size:13px;font-weight:400;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    /* 29.3 · per fane: Integrasjoner · Bare/Ikke disse · Ekstra brytere · Visning (arkstil: indre flate #282828, rader med bryter) */
    .ifp{display:flex;flex-direction:column;gap:8px;padding:2px 0 14px}
    .ifs{display:flex;flex-direction:column;padding:4px 14px 8px;border-radius:18px;background:var(--ki-popup, #282828)}
    .ifs>.lb{font-size:12px;color:var(--ki-text-mid, #979797);padding:8px 0 6px}
    .iprow{display:flex;align-items:center;gap:12px;min-height:52px}
    .iprow + .iprow{border-top:1px solid rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.06*var(--ki-wa-k,1)),var(--ki-wa-max,1)))}
    .iprow .ipn{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;text-align:left}
    .iprow .ipn b{font-size:14px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .iprow .ipn i{font-style:normal;font-size:11px;color:var(--ki-text-3, #7f7f7f);font-family:ui-monospace,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .iprow .sw{width:44px;height:26px;border-radius:13px;background:var(--ki-ctrl, #545454);flex:none}
    .iprow .sw::after{top:3px;left:3px;width:20px;height:20px;border-radius:10px}
    .iprow .sw.on{background:var(--pink,#f285c9)}.iprow .sw.on::after{transform:translateX(18px)}
    .ifs .inm{background:var(--ki-surface, #3a3a3a)}
    .icount{font-size:12px;color:var(--ki-pink-text, rgb(242 133 201));padding:8px 0 2px}
    .ixch{display:flex;flex-wrap:wrap;gap:6px;padding:0 0 8px}
    .ixch:empty{display:none}
    .ixch button{height:32px;padding:0 6px 0 12px;border-radius:16px;background:var(--ki-surface-2, #404040);font-size:12px;display:flex;align-items:center;gap:4px;max-width:100%}
    .ixch button span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .ifs .edq{background:var(--ki-surface, #3a3a3a)}
    .ifs .nts{margin:0 -10px}
    .ifs .nti{padding:2px 0 6px}
    .ntp .ifp{padding:0}
    .ntp .ifs{background:var(--ki-surface, #3a3a3a)}
    .ntp .ifs .inm,.ntp .ifs .edq{background:var(--ki-popup, #282828)}
    .ntp .ifs .ntsrc.on{background:var(--ki-ctrl, #545454)}`;
  let innSheet = null;
  const NY = '__ny'; // «Legg til fane»-utkastet (29.3) bruker samme panel som en fane
  const EXPF = new Map(); // åpent fanepanel per kort
  const ntOf = (ed) => { const id = cid(ed); if (!NT.has(id)) NT.set(id, { open: false, key: NY, name: '', icon: TICONS[0], plattform: ['ki_notifications'], enheter: [], ikke_enheter: [], ekstra: [] }); return NT.get(id); };
  const ntOk = (N) => !!String(N.name || '').trim();
  const liste = (t) => String(t || '').split(',').map((x) => x.trim()).filter(Boolean);
  // Fanen et felt gjelder: utkastet eller en fane i config
  const faneAv = (ed, k) => (k === NY ? ntOf(ed) : fanerOf(ed._config || {}).find((t) => t.key === k));
  const telle = (ed, t) => (ed._hass ? finn(ed._hass, faneCfg(ed._config || {}, t)).length : 0);
  const visesTxt = (n) => `Viser ${n} ${n === 1 ? 'bryter' : 'brytere'}`;
  function innKit(ed) {
    if (!ed || !ed.shadowRoot) return;
    if (M.edKit) M.edKit(ed);
    ed.__edDrop = ed.__edDrop || {}; ed.__edQ = ed.__edQ || {};
    const R = ed.shadowRoot;
    try { if (!innSheet) { innSheet = new CSSStyleSheet(); innSheet.replaceSync(INN_CSS); } if (!R.adoptedStyleSheets.includes(innSheet)) R.adoptedStyleSheets = [...R.adoptedStyleSheets, innSheet]; } catch (e) { /* eldre nettleser */ }
    if (ed.__innKit) return;
    ed.__innKit = true;
    // Per tastetrykk (ingen ny tegning – feltet beholder fokus): navn på ny fane, og «Viser N brytere» for Bare/Ikke disse
    R.addEventListener('input', (e) => {
      const t = e.target;
      if (!t.dataset || t.dataset.inn == null) return;
      if (t.dataset.inn === 'ntname') {
        e.stopPropagation();
        const N = ntOf(ed); N.name = t.value;
        const b = R.querySelector('.ntgo'); if (b) { b.classList.toggle('on', ntOk(N)); b.toggleAttribute('disabled', !ntOk(N)); }
        return;
      }
      if (t.dataset.inn === 'fenh' || t.dataset.inn === 'fikke') {
        e.stopPropagation();
        const k = t.dataset.v, f = faneAv(ed, k);
        if (!f) return;
        const d = { ...f, [t.dataset.inn === 'fenh' ? 'enheter' : 'ikke_enheter']: liste(t.value) };
        const el = R.querySelector(`.icount[data-v="${CSS.escape ? CSS.escape(k) : k}"]`);
        if (el) el.textContent = visesTxt(telle(ed, d));
      }
    }, true);
    // Navnefelt, ikon og filter lagres ved «change» (ikke per tastetrykk – feltet beholder fokus)
    R.addEventListener('change', (e) => {
      const t = e.target;
      if (!t.dataset || t.dataset.inn == null) return;
      e.stopPropagation();
      const cc = ed._config || {}, v = String(t.value || '').trim(), k = t.dataset.v;
      if (t.dataset.inn === 'ntname') { ntOf(ed).name = t.value; return; }
      if (t.dataset.inn === 'tname') return saveFaner(ed, fanerOf(cc).map((x) => (x.key === k ? { ...x, name: v || (BUILTIN[k] ? BUILTIN[k][0] : x.name) } : x)));
      if (t.dataset.inn === 'rname' || t.dataset.inn === 'ricon') return setRows(ed, (R2) => { const O = t.dataset.inn === 'rname' ? R2.names : R2.icons; if (v) O[k] = v; else delete O[k]; });
      if (t.dataset.inn === 'fenh' || t.dataset.inn === 'fikke') {
        const f = t.dataset.inn === 'fenh' ? 'enheter' : 'ikke_enheter', L = liste(v);
        if (k === NY) { ntOf(ed)[f] = L; return ed._render(); }
        return editFane(ed, k, (x) => { const o = { ...x }; if (L.length) o[f] = L; else delete o[f]; return o; });
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
  // Fanene lagres alltid som faner[] – første lagring migrerer de eldre nøklene (tabs/custom_tabs/tab_*/rows.include) én gang
  function saveFaner(ed, F, extra) {
    const cc = ed._config || {}, o = { faner: fanerOut(F) };
    ['tabs', 'custom_tabs', 'tab_order', 'tab_hidden', 'tab_names', 'include'].forEach((k) => { if (cc[k] !== undefined) o[k] = undefined; });
    const R = obj(cc.rows);
    if (arr(R.include).length) { const W = rowsWork(cc); W.include.forEach((id) => { delete W.move[id]; }); o.rows = rowsOut(W); }
    Object.assign(o, extra || {});
    setCfg(ed, o);
  }
  // Én fane endres: enheter den gir fra seg/tar fra catch-all-fanene (Hjem) følger med
  function editFane(ed, k, fn) {
    let F = fanerOf(ed._config || {});
    const old = F.find((x) => x.key === k);
    if (!old) return undefined;
    const nu = fn(old);
    if (JSON.stringify(arr(old.enheter)) !== JSON.stringify(arr(nu.enheter)) || JSON.stringify(arr(old.plattform)) !== JSON.stringify(arr(nu.plattform))) { F = release(F, old); F = F.map((x) => (x.key === k ? nu : x)); F = claim(F, nu); }
    else F = F.map((x) => (x.key === k ? nu : x));
    return saveFaner(ed, F);
  }
  // Rad-overstyringer (rows). Står det eldre rows.include/include igjen, migreres fanene samtidig (→ faner[].ekstra).
  function setRows(ed, fn) {
    const cc = ed._config || {}, W = rowsWork(cc); fn(W);
    if (arr(obj(cc.rows).include).length || cc.include) { W.include.forEach((id) => { delete W.move[id]; }); return saveFaner(ed, fanerOf(cc), { rows: rowsOut(W) }); }
    return ed._set('rows', rowsOut(W));
  }
  const curTab = (ed, c) => { const T = fanerOf(c), v = RT.get(cid(ed)); return T.some((t) => t.key === v) ? v : (T[0] || {}).key; };
  const sw = (key, op, v, on, label, p) => `<button class="sw ${on ? 'on' : ''}" role="switch" aria-checked="${on}" aria-label="${esc(label)}" data-a="fn" data-k="${key}" data-op="${op}" data-v="${esc(v)}"${p != null ? ` data-p="${esc(p)}"` : ''}></button>`;
  const iconChips = (key, op, v, cur) => { const icons = TICONS.includes(cur) || !cur ? TICONS : [...TICONS, cur]; return `<div class="nti">${icons.map((ic) => `<button class="${cur === ic ? 'on' : ''}" data-a="fn" data-k="${key}" data-op="${op}" data-v="${esc(v)}" data-ic="${esc(ic)}" aria-label="${esc(ic)}">${M.icon(ic, 20)}</button>`).join('')}${M.iconPicker ? `<button data-a="fn" data-k="${key}" data-op="${op}pick" data-v="${esc(v)}" aria-label="Velg et annet ikon">${M.icon('mdi:dots-horizontal', 20)}</button>` : ''}</div>`; };
  // 29.3 · panelet for én fane (eller «Legg til fane»-utkastet): Integrasjoner · Bare/Ikke disse · Ekstra brytere · Visning
  function fanePanel(hh, cc, key, ed, t) {
    const k = t.key, ny = k === NY, ek = esc(k);
    const P = t.plattform !== undefined ? arr(t.plattform) : [...(M.KI_VARS_PLATTFORM || [])];
    const PL = hh && M.varslingPlattformer ? M.varslingPlattformer(hh) : [];
    P.forEach((p) => { if (!PL.some((x) => x.value === p)) PL.push({ value: p, label: `${plattformNavn(hh, p)} (0)` }); });
    const plat = PL.map((p) => `<div class="iprow" data-key="ip-${ek}-${esc(p.value)}"><span class="ipn"><b>${esc(p.label)}</b><i>${esc(p.value)}</i></span>${sw(key, 'fplat', k, P.includes(p.value), p.label, p.value)}</div>`).join('') || '<div class="iempty">Fant ingen integrasjoner med brytere</div>';
    let enh = '';
    if (ny && hh) {
      const K = enheterOf(hh, t), sel = arr(t.enheter);
      enh = `<div class="ifs" data-key="ifs-enh"><span class="lb">Regler og enheter fra valgte integrasjoner</span><div class="nts">${K.length ? K.map((x) => { const on = sel.includes(x.enhet); return `<button class="ntsrc ${on ? 'on' : ''}" data-a="fn" data-k="${key}" data-op="nenh" data-v="${NY}" data-x="${esc(x.enhet)}" aria-pressed="${on}">${M.icon(x.ikon, 20, 'color:var(--ki-text-2, #afafaf)')}<span class="nm"><b>${esc(x.enhet)}</b><i>${x.n} ${x.n === 1 ? 'bryter' : 'brytere'}</i></span>${M.icon('mdi:check', 20, `color:var(--ki-green-text, rgb(102 209 158));opacity:${on ? 1 : 0}`)}</button>`; }).join('') : '<div class="iempty">Fant ingen brytere fra valgte integrasjoner</div>'}</div></div>`;
    }
    const X = arr(t.ekstra), qk = 'inn-x-' + k, q = String(ed.__edQ[qk] || '').trim().toLowerCase(), qs = q.replace(/ /g, '_');
    const hits = q && hh ? Object.keys(hh.states).filter((id) => ['switch', 'input_boolean', 'automation'].includes(id.split('.')[0]) && !X.includes(id) && (id.includes(qs) || String(hh.states[id].attributes.friendly_name || '').toLowerCase().includes(q))).sort().slice(0, 6) : [];
    const vis = [['master', 'Bare hovedbryter per regel', 'Én bryter per regel i KI Varslinger'], ['kjente', 'Kjente navn', 'Forklarende navn og ikoner for kjente regler'], ['sok', 'Søkefelt', 'Søk over listen i fanen']];
    return `<div class="ifp" data-key="ifp-${ek}">
      <div class="ifs" data-key="ifs-plat"><span class="lb">Integrasjoner</span>${plat}</div>
      ${enh}
      <div class="ifs" data-key="ifs-filter"><span class="lb">Bare disse (enhetsnavn, skilt med komma)</span><input class="inm full" data-inn="fenh" data-v="${ek}" value="${esc(arr(t.enheter).join(', '))}" placeholder="Alle" aria-label="Bare disse" autocapitalize="off" autocorrect="off" spellcheck="false">
        <span class="lb">Ikke disse</span><input class="inm full" data-inn="fikke" data-v="${ek}" value="${esc(arr(t.ikke_enheter).join(', '))}" placeholder="Ingen" aria-label="Ikke disse" autocapitalize="off" autocorrect="off" spellcheck="false">
        <span class="icount" data-v="${ek}" data-key="icount-${ek}" aria-live="polite">${esc(visesTxt(hh ? finn(hh, faneCfg(cc, t)).length : 0))}</span></div>
      <div class="ifs" data-key="ifs-ekstra"><span class="lb">Ekstra brytere</span><div class="ixch">${X.map((id) => `<button data-a="fn" data-k="${key}" data-op="xrm" data-v="${ek}" data-x="${esc(id)}" aria-label="Fjern ${esc(id)}"><span>${esc(hh && hh.states[id] ? M.name(hh, id) : id)}</span>${M.icon('mdi:close', 16)}</button>`).join('')}</div>
        <div class="edq">${M.icon('mdi:magnify', 18, 'color:var(--ki-text-mid, #979797)')}<input data-edq="${esc(qk)}" value="${esc(ed.__edQ[qk] || '')}" placeholder="Søk etter bryter eller automasjon" autocapitalize="off" autocorrect="off" spellcheck="false"></div>
        ${hits.map((id) => `<button class="ihit" data-a="fn" data-k="${key}" data-op="xadd" data-v="${ek}" data-x="${esc(id)}">${M.icon(M.domainIcon(id, hh.states[id]), 18, 'color:var(--ki-text-mid, #979797)')}<span class="nm"><b>${esc(M.name(hh, id))}</b><i>${esc(id)}</i></span></button>`).join('') || (q ? '<div class="iempty">Ingen treff</div>' : '')}</div>
      <div class="ifs" data-key="ifs-vis"><span class="lb">Visning</span>${vis.map(([p, l, hl]) => `<div class="iprow"><span class="ipn"><b>${esc(l)}</b><i style="font-family:inherit">${esc(hl)}</i></span>${sw(key, 'fvis', k, t[p] !== false, l, p)}</div>`).join('')}</div>
      ${ny ? '' : `<div class="ifs" data-key="ifs-ikon"><span class="lb">Ikon</span>${iconChips(key, 'ticon', k, t.icon)}</div>`}
    </div>`;
  }
  // GUI-editoren (29.3): ett ha-form med ett expandable per fane – samme felt som KiVarslingEditor. Ekko-vakt: f.data settes
  // tilbake etter value-changed, og når HA sender samme config tilbake bygges ingenting om (avkrysning/markør står).
  const hafData = (F) => Object.fromEntries(F.map((t) => ['f_' + t.key, { plattform: t.plattform !== undefined ? arr(t.plattform) : [...(M.KI_VARS_PLATTFORM || [])], enheter: arr(t.enheter).join(', '), ikke_enheter: arr(t.ikke_enheter).join(', '), ekstra: arr(t.ekstra), master: t.master !== false, kjente: t.kjente !== false, sok: t.sok !== false }]));
  const HAF_LABEL = { plattform: 'Integrasjoner', enheter: 'Bare disse (skilt med komma)', ikke_enheter: 'Ikke disse (skilt med komma)', ekstra: 'Ekstra brytere', master: 'Bare hovedbryteren per regel', kjente: 'Kjente navn', sok: 'Søkefelt' };
  function mountForm(ed) {
    const slot = ed.shadowRoot && ed.shadowRoot.querySelector('.ihaf');
    if (!slot || !ed._hass) return;
    const F = fanerOf(ed._config || {}), h = ed._hass;
    const opts = (M.varslingPlattformer ? M.varslingPlattformer(h) : []).map((p) => ({ value: p.value, label: p.label }));
    F.forEach((t) => arr(t.plattform).forEach((p) => { if (!opts.some((o) => o.value === p)) opts.push({ value: p, label: `${plattformNavn(h, p)} (0)` }); }));
    const schema = F.map((t) => ({ name: 'f_' + t.key, type: 'expandable', title: t.name, icon: t.icon, schema: [
      { name: 'plattform', selector: { select: { multiple: true, mode: 'list', options: opts } } },
      { name: 'enheter', selector: { text: {} } },
      { name: 'ikke_enheter', selector: { text: {} } },
      { name: 'ekstra', selector: { entity: { multiple: true, domain: ['switch', 'input_boolean', 'automation'] } } },
      { name: 'master', selector: { boolean: {} } },
      { name: 'kjente', selector: { boolean: {} } },
      { name: 'sok', selector: { boolean: {} } },
    ] }));
    let f = slot.querySelector('ha-form');
    if (!f) {
      f = document.createElement('ha-form');
      f.computeLabel = (x) => HAF_LABEL[x.name] || x.title || x.name;
      f.addEventListener('value-changed', (e) => {
        e.stopPropagation();
        const v = (e.detail && e.detail.value) || {}, cur = fanerOf(ed._config || {});
        let F2 = cur.map((t) => {
          const d = v['f_' + t.key];
          if (!d) return t;
          const o = { ...t, plattform: arr(d.plattform), ekstra: arr(d.ekstra) }, E = liste(d.enheter), I = liste(d.ikke_enheter);
          if (E.length) o.enheter = E; else delete o.enheter;
          if (I.length) o.ikke_enheter = I; else delete o.ikke_enheter;
          ['master', 'kjente', 'sok'].forEach((k) => { if (d[k] === false) o[k] = false; else delete o[k]; });
          return o;
        });
        F2 = F2.map((t) => ({ ...t }));
        // Skjemaet MÅ få verdiene tilbake (ha-form styres av data) – som skrevet, så tekstfeltet ikke mister komma/markør
        f.data = { ...hafData(F2), ...v };
        ed.__hafOut = JSON.stringify(hafData(F2));
        saveFaner(ed, F2);
      });
      slot.appendChild(f);
    }
    f.hass = h;
    const sj = JSON.stringify(schema);
    if (f.__sj !== sj) { f.__sj = sj; f.schema = schema; }
    const data = hafData(F), dj = JSON.stringify(data);
    if (ed.__hafOut !== dj) { ed.__hafOut = dj; f.data = data; } // samme config tilbake fra HA → ingen ombygging
  }
  function editorSchema(h0, cfg0) {
    const handle = () => (M.edHandle ? M.edHandle() : '');
    // Forhåndsvisning (27.5): fanelinjen + tannhjul live, ikke trykkbar
    const preview = { type: 'html', html: (hh, cc, key, ed) => {
      innKit(ed);
      const V = visTabs(cc), st = keyOf(cc.start_tab), cur = V.some((t) => t.key === st) ? st : V[0].key;
      return `<div class="pvw" data-key="pvw"><div class="pvb">${tabBar(cc, V, cur, { preview: true })}</div></div>`;
    } };
    // Faner: dra-håndtak, ikon (→ fanepanelet), navnefelt, søppelkasse (egne faner), bryter = vis/skjul; «Legg til fane» nederst
    const faner = { type: 'html', html: (hh, cc, key, ed) => {
      innKit(ed);
      ed.__edDrop['inn-tab'] = (o) => { const D = fanerOf(ed._config || cc), by = new Map(D.map((t) => [t.key, t])); saveFaner(ed, o.map((k) => by.get(k)).filter(Boolean)); };
      const D = fanerOf(cc), N = ntOf(ed), open = EXPF.get(cid(ed));
      const rows = D.map((t) => `<div class="irow ${t.hidden ? 'off' : ''}" data-edk="${esc(t.key)}" data-elist="inn-tab" data-key="it-${esc(t.key)}">${handle()}<button class="iic" data-a="fn" data-k="${key}" data-op="texp" data-v="${esc(t.key)}" aria-expanded="${open === t.key}" aria-label="Integrasjoner og filter for ${esc(t.name)}">${M.icon(t.icon, 22)}</button>
          <input class="inm" data-inn="tname" data-v="${esc(t.key)}" value="${esc(BUILTIN[t.key] && t.name === BUILTIN[t.key][0] ? '' : t.name)}" placeholder="${esc(BUILTIN[t.key] ? BUILTIN[t.key][0] : t.name)}" aria-label="Navn på fanen" autocapitalize="off" autocorrect="off" spellcheck="false">
          ${t.custom ? `<button class="idel" data-a="fn" data-k="${key}" data-op="tdel" data-v="${esc(t.key)}" title="Slett fane" aria-label="Slett fanen ${esc(t.name)}">${M.icon('mdi:delete-outline', 20)}</button>` : ''}${sw(key, 'teye', t.key, !t.hidden, (t.hidden ? 'Vis ' : 'Skjul ') + t.name)}</div>${open === t.key ? fanePanel(hh, cc, key, ed, t) : ''}`).join('');
      let panel = '';
      if (N.open) {
        const ok = ntOk(N);
        panel = `<div class="ntp" data-key="ntp"><span class="ntl">Ny fane</span>
          <input class="ntn" data-inn="ntname" value="${esc(N.name)}" placeholder="Navn på fanen" aria-label="Navn på fanen" autocapitalize="off" autocorrect="off" spellcheck="false">
          ${iconChips(key, 'nticon', NY, N.icon)}
          ${fanePanel(hh, cc, key, ed, N)}
          <button class="ntgo ${ok ? 'on' : ''}" data-a="fn" data-k="${key}" data-op="ntadd" data-v="" ${ok ? '' : 'disabled'}>Legg til fane</button></div>`;
      }
      return `<div class="ilist">${rows}</div><button class="iadd" data-a="fn" data-k="${key}" data-op="ntopen" data-v="" aria-expanded="${N.open}">${M.icon('mdi:plus-circle', 22)}<span>Legg til fane</span></button>${panel}`;
    }, click: (dd, ed) => {
      const cc = ed._config || {}, N = ntOf(ed), k = dd.v, id = cid(ed);
      const draft = (fn) => { fn(N); return ed._render(); };
      if (dd.op === 'texp') { M.haptic('selection'); if (EXPF.get(id) === k) EXPF.delete(id); else EXPF.set(id, k); return ed._render(); }
      if (dd.op === 'teye') {
        const D = fanerOf(cc), t = D.find((x) => x.key === k);
        if (!t) return undefined;
        if (!t.hidden && D.filter((x) => !x.hidden).length <= 1) { M.haptic('warning'); M.toast('Minst én fane må være synlig'); return undefined; }
        M.haptic('selection');
        return saveFaner(ed, D.map((x) => (x.key === k ? { ...x, hidden: !x.hidden } : x)));
      }
      if (dd.op === 'tdel') {
        M.haptic('medium');
        let F = fanerOf(cc); const t = F.find((x) => x.key === k);
        if (!t) return undefined;
        F = release(F, t).filter((x) => x.key !== k);
        const W = rowsWork(cc); delete W.order[k]; Object.keys(W.move).forEach((x) => { if (W.move[x] === k) delete W.move[x]; }); W.include = [];
        if (EXPF.get(id) === k) EXPF.delete(id);
        return saveFaner(ed, F, { rows: rowsOut(W) });
      }
      if (dd.op === 'fplat') {
        M.haptic('selection');
        const tog = (L) => { const S = new Set(L); if (S.has(dd.p)) S.delete(dd.p); else S.add(dd.p); return [...S]; };
        if (k === NY) return draft((x) => { x.plattform = tog(arr(x.plattform)); x.enheter = arr(x.enheter).filter((e) => enheterOf(ed._hass, x).some((y) => y.enhet === e)); });
        return editFane(ed, k, (x) => ({ ...x, plattform: tog(x.plattform !== undefined ? arr(x.plattform) : [...(M.KI_VARS_PLATTFORM || [])]) }));
      }
      if (dd.op === 'fvis') {
        M.haptic('selection');
        const flip = (x) => { const o = { ...x }; if (o[dd.p] === false) delete o[dd.p]; else o[dd.p] = false; return o; };
        if (k === NY) return draft((x) => { Object.assign(x, flip(x)); if (x[dd.p] !== false) delete x[dd.p]; });
        return editFane(ed, k, flip);
      }
      if (dd.op === 'xadd' || dd.op === 'xrm') {
        M.haptic(dd.op === 'xadd' ? 'success' : 'selection');
        ed.__edQ['inn-x-' + k] = '';
        const upd = (L) => (dd.op === 'xadd' ? [...L.filter((x) => x !== dd.x), dd.x] : L.filter((x) => x !== dd.x));
        if (k === NY) return draft((x) => { x.ekstra = upd(arr(x.ekstra)); });
        return editFane(ed, k, (x) => { const o = { ...x, ekstra: upd(arr(x.ekstra)) }; if (!o.ekstra.length) delete o.ekstra; return o; });
      }
      if (dd.op === 'ticon') { M.haptic('selection'); return editFane(ed, k, (x) => ({ ...x, icon: dd.ic })); }
      if (dd.op === 'ticonpick' && M.iconPicker) { const t = faneAv(ed, k); M.iconPicker.open({ value: t && t.icon, title: 'Ikon for fanen', onPick: (v) => { if (v) editFane(ed, k, (x) => ({ ...x, icon: v })); } }); return undefined; }
      if (dd.op === 'ntopen') { M.haptic('light'); NT.delete(id); const n = ntOf(ed); n.open = !N.open; return ed._render(); }
      if (dd.op === 'nticon') { M.haptic('selection'); return draft((x) => { x.icon = dd.ic; }); }
      if (dd.op === 'nticonpick' && M.iconPicker) { M.iconPicker.open({ value: N.icon, title: 'Ikon for fanen', onPick: (v) => { if (v) { N.icon = v; ed._render(); } } }); return undefined; }
      if (dd.op === 'nenh') {
        M.haptic('selection');
        return draft((x) => {
          const E = arr(x.enheter), on = E.includes(dd.x);
          x.enheter = on ? E.filter((e) => e !== dd.x) : [...E, dd.x];
          if (!on && !String(x.name || '').trim()) { x.name = dd.x; const hit = enheterOf(ed._hass, x).find((y) => y.enhet === dd.x); if (hit && hit.ikon) x.icon = hit.ikon; }
        });
      }
      if (dd.op === 'ntadd') {
        if (!ntOk(N)) return undefined;
        M.haptic('success');
        let F = fanerOf(cc);
        const base = 'f_' + (slugOf(N.name) || 'fane');
        let nk = base, i = 2; while (F.some((t) => t.key === nk)) nk = base + '_' + i++;
        const t = { key: nk, name: String(N.name).trim(), icon: N.icon || 'mdi:bell', plattform: arr(N.plattform) };
        ['enheter', 'ikke_enheter', 'ekstra'].forEach((x) => { if (arr(N[x]).length) t[x] = arr(N[x]); });
        BOOL_KEYS.forEach((x) => { if (N[x] === false) t[x] = false; });
        F = claim([...F, t], t);
        NT.delete(id);
        return saveFaner(ed, F);
      }
      return undefined;
    } };
    // GUI-editoren: ha-form per fane (bare i HAs visuelle editor – arket har panelet over)
    const gui = { type: 'html', html: (hh, cc, key, ed) => {
      if (ed._inline || !customElements.get('ha-form')) return '';
      Promise.resolve().then(() => mountForm(ed));
      return '<div class="ihaf" data-key="ihaf" data-nomorph></div>';
    } };
    // Rader: undersegment (fane) + rader for valgt fane (dra, ikon → flytt/ikon, navnefelt, bryter = skjul) + «Legg til rad»
    const radSeg = { type: 'html', html: (hh, cc, key, ed) => {
      innKit(ed);
      const tab = curTab(ed, cc);
      return `<div class="chips sg tsub" role="tablist">${fanerOf(cc).map((t) => `<button class="chip ${t.key === tab ? 'on' : ''}" role="tab" aria-selected="${t.key === tab}" data-a="fn" data-k="${key}" data-op="rtab" data-v="${esc(t.key)}"><span>${esc(t.name)}</span></button>`).join('')}</div>`;
    }, click: (dd, ed) => { if (dd.op === 'rtab') { M.haptic('selection'); RT.set(cid(ed), dd.v); EXP.delete(cid(ed)); ADD.delete(cid(ed)); return ed._render(); } return undefined; } };
    const rader = { type: 'html', html: (hh, cc, key, ed) => {
      innKit(ed);
      if (!hh) return '';
      const id = cid(ed), tab = curTab(ed, cc), R = rowsCfg(cc), T = fanerOf(cc);
      if (!tab) return '<div class="iempty">Ingen faner med rader.</div>';
      ed.__edDrop['inn-row'] = (o) => setRows(ed, (W) => { W.order = { ...W.order, [tab]: o }; });
      const L = tabRows(hh, cc, tab, { withHidden: true }), open = EXP.get(id);
      const rows = L.map((r) => {
        const own = r.kilde === 'ekstra';
        const sub = open === r.key ? `<div class="isub" data-key="irs-${esc(r.key)}">
            <span class="lb">Navn</span><input class="inm full" data-inn="rname" data-v="${esc(r.key)}" value="${esc(R.names[r.key] || '')}" placeholder="${esc(r.navn)}" aria-label="Navn på raden" autocapitalize="off" autocorrect="off" spellcheck="false">
            <span class="lb">Flytt til</span><div class="ichips">${T.map((t) => `<button class="${t.key === tab ? 'on' : ''}" data-a="fn" data-k="${key}" data-op="rmove" data-v="${esc(r.key)}" data-t="${esc(t.key)}">${esc(t.name)}</button>`).join('')}</div>
            <span class="lb">Ikon</span><input class="inm full" data-inn="ricon" data-v="${esc(r.key)}" value="${esc(R.icons[r.key] || '')}" placeholder="${esc(r.ikon)}" autocapitalize="off" autocorrect="off" spellcheck="false">
            <span class="imeta">${esc(r.id)}${r.kilde !== 'ekstra' ? ' · ' + esc(r.enhet) + ' · ' + esc(plattformNavn(hh, r.plattform)) : ' · ekstra'}${r.all.length > 1 ? ` · ${r.all.length} entiteter (hold på raden i popupen for resten)` : ''}</span>
            ${own ? `<div class="ichips"><button data-a="fn" data-k="${key}" data-op="rrm" data-v="${esc(r.id)}">Fjern raden</button></div>` : ''}</div>` : '';
        return `<div class="irow ${r.hidden ? 'off' : ''}" data-edk="${esc(r.key)}" data-elist="inn-row" data-key="ir-${esc(r.key)}">${handle()}<button class="iic" data-a="fn" data-k="${key}" data-op="rexp" data-v="${esc(r.key)}" aria-expanded="${open === r.key}" aria-label="Navn, fane og ikon">${M.icon(r.icon, 20)}</button>
          <button class="itx" data-a="fn" data-k="${key}" data-op="rexp" data-v="${esc(r.key)}"><b>${esc(r.name)}</b><i>${esc(r.id)}</i></button>
          ${sw(key, 'reye', r.key, !r.hidden, (r.hidden ? 'Vis ' : 'Skjul ') + r.name)}</div>${sub}`;
      }).join('');
      // «Legg til rad» = fanens Ekstra brytere (switch/input_boolean/automation, som ki-varsling-card)
      const q = (ed.__edQ['inn-q'] || '').trim().toLowerCase(), have = new Set(L.map((r) => r.id));
      const hits = ADD.has(id) ? Object.keys(hh.states).filter((x) => ['input_boolean', 'switch', 'automation'].includes(x.split('.')[0]) && !have.has(x) && (!q || (x + ' ' + (hh.states[x].attributes.friendly_name || '')).toLowerCase().includes(q))).sort().slice(0, 8) : [];
      const add = ADD.has(id) ? `<div class="isub" style="padding-left:0" data-key="iadd"><div class="edq">${M.icon('mdi:magnify', 20, 'color:var(--ki-text-mid, #979797)')}<input data-edq="inn-q" value="${esc(ed.__edQ['inn-q'] || '')}" placeholder="Søk etter bryter eller automasjon" autocapitalize="off" autocorrect="off" spellcheck="false"></div>
        ${hits.map((x) => `<button class="edhit" data-a="fn" data-k="${key}" data-op="radd" data-v="${esc(x)}">${M.icon(M.domainIcon(x, hh.states[x]), 20, 'color:var(--ki-text-2, #afafaf)')}<span class="nm"><b>${esc(M.name(hh, x))}</b><i>${esc(x)}</i></span></button>`).join('') || '<div class="iempty">Ingen treff</div>'}</div>` : '';
      const none = !rules(hh, cc).length ? 'Fant ingen brytere fra valgte integrasjoner' : 'Ingen rader i denne fanen ennå.';
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
        return setRows(ed, (W) => { [dd.v, r && r.id, r && r.dev, r && r.slug].forEach((k) => { if (k) delete W.move[k]; }); if (!r || !r.tabs.includes(dd.t)) W.move[dd.v] = dd.t; });
      }
      if (dd.op === 'rrm') { M.haptic('selection'); EXP.delete(id); return editFane(ed, tab, (x) => { const o = { ...x, ekstra: arr(x.ekstra).filter((e) => e !== dd.v) }; if (!o.ekstra.length) delete o.ekstra; return o; }); }
      if (dd.op === 'radd-open') { M.haptic('selection'); ed.__edQ['inn-q'] = ''; if (ADD.has(id)) ADD.delete(id); else ADD.add(id); return ed._render(); }
      if (dd.op === 'radd') { M.haptic('success'); ed.__edQ['inn-q'] = ''; ADD.delete(id); return editFane(ed, tab, (x) => ({ ...x, ekstra: [...arr(x.ekstra).filter((e) => e !== dd.v), dd.v] })); }
      if (dd.op === 'rsort') { M.haptic('selection'); return setRows(ed, (W) => { const O = { ...W.order }; delete O[tab]; W.order = O; }); }
      return undefined;
    } };
    const reset = { type: 'html', html: (hh, cc, key) => `<button class="ireset" data-a="fn" data-k="${key}" data-op="reset" data-v="">Tilbakestill til standard</button>`,
      click: (dd, ed) => { if (dd.op !== 'reset') return; M.haptic('medium'); const cc = ed._config || {}, id = cc.card_id || M.uid(); NT.delete(cid(ed)); RT.delete(cid(ed)); EXPF.delete(cid(ed)); ed._config = { type: cc.type || 'custom:msh-innstillinger-card', card_id: id }; ed._set('card_id', id); } };
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
          body = `<div class="ientp" data-key="ientp-${k}"><div class="edq">${M.icon('mdi:magnify', 18, 'color:var(--ki-text-3, #7f7f7f)')}<input data-edq="inn-ent" value="${esc(ed.__edQ['inn-ent'] || '')}" placeholder="Søk etter entitet …" autocapitalize="off" autocorrect="off" spellcheck="false"></div>
            ${set ? `<button class="ihit" data-a="fn" data-k="${key}" data-op="entauto" data-v="${k}">${M.icon('mdi:auto-fix', 18, 'color:var(--ki-text-mid, #979797)')}<span class="nm"><b>Automatisk</b><i>${esc(au || 'Ingen funnet')}</i></span></button>` : ''}
            ${hits.map((id) => `<button class="ihit ${id === cur ? 'on' : ''}" data-a="fn" data-k="${key}" data-op="entset" data-v="${k}" data-id="${esc(id)}">${M.icon('mdi:toggle-switch-outline', 18, 'color:var(--ki-text-mid, #979797)')}<span class="nm"><b>${esc(M.name(hh, id))}</b><i>${esc(id)}</i></span>${M.icon('mdi:check', 18, `color:var(--ki-green-text, rgb(102 209 158));opacity:${id === cur ? 1 : 0}`)}</button>`).join('') || '<div class="iempty">Ingen treff</div>'}</div>`;
        }
        return `<div class="ient" data-key="ient-${k}"><button class="ienh" data-a="fn" data-k="${key}" data-op="entopen" data-v="${k}" aria-expanded="${open === k}"><span class="eic">${M.icon(icon, 18)}</span><span class="nm"><b>${esc(label)}</b><i class="${cur ? 'mono' : 'pk'}">${esc(txt)}</i></span>${M.icon(open === k ? 'mdi:chevron-up' : 'mdi:chevron-down', 20, 'color:var(--ki-text-3, #7f7f7f)')}</button>${body}</div>`;
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
          { type: 'section', id: 'faner', label: 'Faner · dra for rekkefølge', fields: [faner, gui] },
          { type: 'section', id: 'visning', label: '', fields: [
            { type: 'select', name: 'tab_labels', label: 'Faner viser', options: [['icon', 'Ikon + tekst'], ['name', 'Tekst'], ['ikon', 'Ikoner']], default: 'icon' },
            { type: 'select', name: 'start_tab', label: 'Startfane', options: fanerOf(cfg0 || {}).map((t) => [t.key, t.name]), default: 'sikkerhet' },
          ] },
        ] },
        { key: 'rader', label: 'Rader', focus: ['rader'], fields: [
          radSeg,
          { type: 'section', id: 'oppsummering', label: '', fields: [summary] },
          { type: 'section', id: 'rader', label: 'Rader · dra for rekkefølge', fields: [rader] },
        ] },
        { key: 'entiteter', label: 'Entiteter', focus: ['entiteter'], fields: [{ type: 'section', id: 'entiteter', label: 'Toppkort', fields: [entiteter] }] },
        { key: 'avansert', label: 'Avansert', focus: ['avansert', 'spacing'], fields: [
          { type: 'section', id: 'avansert', label: '', fields: [
            { type: 'boolean', name: 'sok', label: 'Søkefelt', help: 'Vis søk over listene', default: true },
            { ...summary, help: 'Vis «3 av 3 på» og Slå alle av/på' },
            { type: 'boolean', name: 'av_forst', label: 'Avslåtte øverst', help: 'Sorter det som er av først', default: false },
            { type: 'boolean', name: 'haptikk', label: 'Haptikk', help: 'Vibrasjon ved trykk', default: true },
            { type: 'boolean', name: 'animasjoner', label: 'Animasjoner', help: 'Toppkort og Privatmodus-kameraet', default: true },
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
  const RISE_MS = 3000; // soloppgangen: sola 2,6 s, himmelen 3 s
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
    set hass(h) { super.hass = h; this._edLive(h); }
    // Soloppgangen (28.6) spilles bare én gang per åpning: neste åpning starter den på nytt
    onClose() { this._ui = { ...this._ui, q: '' }; this._riseAt = 0; clearTimeout(this._riseT); const sc = this.shadowRoot && this.shadowRoot.querySelector('.sc.rise'); if (sc) sc.classList.remove('rise'); }
    onOpen() { this._riseAt = 0; this.update(); }
    get holdMs() { return 500; } // 29.2: hold 500 ms = more-info (som ki-varsling-card)
    // Registeret endres ofte i HA: tegn bare når bryterne ([id, på] per fane) faktisk endres (29.1 «Live»)
    _changed(o, n) {
      if (o.areas === n.areas && o.states === n.states && (o.entities !== n.entities || o.devices !== n.devices) && this._vsig != null) {
        try { if (cardSig(n, this.config) === this._vsig) return false; } catch (e) { /* tegn */ }
      }
      return super._changed(o, n);
    }
    get tab() { const V = visTabs(this.config).map((t) => t.key), t = keyOf(this.ui.tab || this.config.start_tab); return V.includes(t) ? t : V[0]; }
    _hp(t) { return `data-haptic="${this.config.haptikk === false ? 'off' : t}"`; }
    get _anim() { return this.config.animasjoner !== false; }
    // «Tilpass Innstillinger»: arkhøyden er felles for alle Tilpass-ark (28.11, MSH.overlay) – ingen egen overstyring her
    customize(focus, opts) {
      const ui = super.customize(focus, opts);
      this._edUi = ui || null;
      if (ui && ui.editor && this.hass) ui.editor.__innSig = ruleSig(this.hass, ui.editor._config || this.config);
      return ui;
    }
    // 28.5/29: åpent Tilpass-ark får fersk hass – nye regler/brytere/integrasjoner dukker opp i fanepanelet, «Legg til fane»
    // og Rader uten reload. Ny tegning bare når brytersettet per fane (eller plattformlisten) faktisk endres.
    _edLive(h) {
      const ui = this._edUi, ed = ui && ui.editor;
      if (!ed || !h) return;
      if (!ed.isConnected || (ui.overlay && ui.overlay.closed)) { this._edUi = null; return; }
      ed.hass = h;
      const sig = ruleSig(h, ed._config || this.config);
      if (ed.__innSig != null && sig !== ed.__innSig && ed._render) ed._render();
      ed.__innSig = sig;
    }

    /* ---------- optimistisk UI (27.6): kortet byttes straks, hass bekrefter, ellers tilbakerulling */
    _on(id, s) { const o = this._opt && id && this._opt[id]; return o ? o.want : isOn(s); }
    _pend(id) { return !!(this._opt && id && this._opt[id]); }
    _confirm(h) {
      if (!this._opt || !h) return;
      Object.keys(this._opt).forEach((id) => { const o = this._opt[id], s = h.states[id]; if (s && (s.state === 'on') === o.want) { clearTimeout(o.tm); delete this._opt[id]; } });
    }
    // svc = 'toggle' for radene (29.2: trykk = toggle), ellers turn_on/turn_off (toppkortet)
    _flip(id, svc) {
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
      const p = M.call(h, 'homeassistant', svc || (want ? 'turn_on' : 'turn_off'), { entity_id: id });
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
      // Fiks 33.3: popupen slutter etter brytersettene – DASHBORD (Tilpass Hjem/navbar/header, HA, Områder), Utseende
      // (Liquid Glass) og Enheter + fotteksten er fjernet fra visningen. Funksjonene finnes fortsatt: Tilpass-arkene via
      // navbarens «Mer» → «Tilpass» (24.5), Liquid Glass i «Tilpass navbar», eget oppsett per enhet i Kamera/Person-
      // arkene (msh-scope-bar). Lagringen (ki-store, enhetsoverstyringer) er urørt. `dashbord` i gammel config ignoreres.
      return `<div class="wrap">${top}${tabs}<div class="pane" data-key="pane-${esc(t)}">${this._list(t)}</div></div>`;
    }
    _pickBtn() { return `<button class="pick press" data-act="customize" data-section="entiteter" ${this._hp('light')}>${M.icon('mdi:plus', 16)}Velg entitet</button>`; }
    // Nattmodus av: to kort side om side (164 px)
    _split(E, nS, pS, nOn, pOn) {
      const nua = !nS || M.unavailable(nS), ua = !pS || M.unavailable(pS), nP = this._pend(E.natt), pP = this._pend(E.privat);
      const natt = `<div class="mk natt press" data-key="mk-natt" data-theme="dark" data-ki-island ${E.natt && !nua ? `data-act="night" data-ent="${esc(E.natt)}" role="switch" aria-checked="${nOn}" ${this._hp('medium')}` : ''}>
        ${NIGHT_SVG}
        <div class="mh"><span class="mt">Nattmodus</span><span class="ci">${M.icon('mdi:moon-waning-crescent', 22)}</span></div>
        ${nP ? SYNC : ''}
        <div class="mb"><span class="mv">${nua ? '–' : nOn ? 'På' : 'Av'}</span>${nS ? `<span class="bs ${nOn ? 'on' : ''}"></span>` : this._pickBtn()}</div></div>`;
      const on = pOn && !ua;
      const cls = ['mk', 'priv', on ? 'on' : '', ua ? 'ua' : '', this._anim ? '' : 'na'].filter(Boolean).join(' ');
      const sub = !pS ? '–' : ua ? 'Utilgjengelig' : on ? 'Kameraene er av' : 'Kameraene er på';
      const priv = `<div class="${cls} press" data-key="mk-priv" data-theme="dark" data-ki-island ${E.privat && !ua ? `data-act="priv" data-ent="${esc(E.privat)}" role="switch" aria-checked="${on}" ${this._hp('medium')}` : ''}>
        <span class="glw" aria-hidden="true"></span>${CAMERA}
        <div class="mh"><span class="mt">Privatmodus</span><span class="ci">${M.icon(on ? 'mdi:video-off' : 'mdi:video', 22)}</span></div>
        <div class="ml"><span class="lk" data-key="lk-${on ? 'on' : 'off'}">${on ? '<span class="ring"></span>' : ''}${M.icon(on ? 'mdi:lock' : 'mdi:lock-open-variant', 28)}</span>${pP ? SYNC : `<span class="ms">${esc(sub)}</span>`}</div>
        <div class="mb"><span class="mv">${ua ? '–' : on ? 'På' : 'Av'}</span>${pS ? `<span class="bs ${on ? 'on' : ''}"></span>` : this._pickBtn()}</div></div>`;
      return `<div class="two" data-key="top-split">${natt}${priv}</div>`;
    }
    // «God natt» (nattmodus på / alltid natt) eller «God morgen» (soloppgang) – 184 px, trykk på hele kortet = nattmodus av/på
    _scene(E, nS, pS, vS, night, morning, nOn, pOn) {
      const tid = tidOf(vS), pend = this._pend(E.natt) || this._pend(E.privat), nua = !nS || M.unavailable(nS), pua = !pS || M.unavailable(pS);
      // Soloppgang (2,6 s + himmel 3 s) kun første gang morgenkortet vises i denne åpningen – senere tegninger (Synker,
      // natt av/på igjen, ny hass) viser sola stående uten å spille den på nytt
      let rise = false;
      if (morning && this._anim) {
        const now = Date.now();
        if (!this._riseAt) { this._riseAt = now; clearTimeout(this._riseT); this._riseT = setTimeout(() => { if (this.isConnected) this.update(); }, RISE_MS + 50); }
        rise = now - this._riseAt < RISE_MS;
      }
      const cls = ['sc', night ? 'night' : 'day', morning ? 'morning' : '', rise ? 'rise' : '', this._anim ? '' : 'na'].filter(Boolean).join(' ');
      const kicker = nua ? 'Nattmodus –' : nOn ? 'Nattmodus på' : 'Nattmodus av';
      const sub = night ? (tid ? `Vekking kl. ${tid}` : '') : 'Ha en fin dag';
      const chip = (id, s, ua, on, kind, icon, label, hp) => (id && s && !ua
        ? `<button class="cp ${kind} ${on ? 'on' : ''}" data-act="${kind === 'n' ? 'night' : 'priv'}" data-ent="${esc(id)}" role="switch" aria-checked="${on}" ${this._hp(hp)}>${M.icon(icon, 18)}${esc(label)}</button>`
        : `<button class="cp miss" data-act="customize" data-section="entiteter" ${this._hp('light')}>${M.icon(icon, 18)}${esc(kind === 'n' ? 'Natt' : 'Privat')} · Velg entitet</button>`);
      const pOk = pOn && !pua;
      return `<div class="${cls}" data-key="top-scene" data-theme="dark" data-ki-island ${E.natt && !nua ? `data-act="night" data-ent="${esc(E.natt)}" role="switch" aria-checked="${nOn}" ${this._hp('medium')}` : `data-act="customize" data-section="entiteter" ${this._hp('light')}`}>
        <div class="bgg"></div><div class="nsk"></div><div class="dawn"></div>${SCENE_SVG(pOk)}
        <div class="stx"><span class="k">${esc(kicker)}</span><span class="gt">${night ? 'God natt' : 'God morgen'}</span>${sub ? `<span class="k">${esc(sub)}</span>` : ''}${pend ? SYNC : ''}</div>
        <div class="chips">${chip(E.natt, nS, nua, nOn, 'n', 'mdi:moon-waning-crescent', nOn ? 'Natt på' : 'Natt av', 'medium')}${chip(E.privat, pS, pua, pOk, 'p', pOk ? 'mdi:video-off' : 'mdi:video', pOk ? 'Privat på' : 'Kamera på', 'medium')}</div></div>`;
    }
    // 29.2: tom kilde → aldri mock; «Velg integrasjoner» åpner fanepanelet (29.3) for denne fanen
    _empty(tab) {
      const d = tabDef(this.config, tab), src = this.hass ? finn(this.hass, faneCfg(this.config, d || {})).length : 0;
      const txt = !src ? 'Fant ingen brytere fra valgte integrasjoner' : 'Alle bryterne i fanen er skjult';
      return `<div class="empty" data-key="empty">${M.icon('mdi:bell-off-outline', 22)}<span>${esc(txt)}</span><button class="pick press" data-act="pickint" data-v="${esc(tab)}" ${this._hp('light')}>${M.icon('mdi:tune-variant', 18)}Velg integrasjoner</button></div>`;
    }
    _list(tab) {
      const c = this.config, h = this.hass, all = tabRows(h, c, tab), d = tabDef(c, tab) || {};
      all.forEach((r) => this.s(r.id));
      if (!all.length) return this._empty(tab);
      const pa = (r) => this._on(r.id, h.states[r.id]);
      const q = (this.ui.q || '').trim().toLowerCase();
      let L = q ? all.filter((r) => `${r.name} ${r.sub} ${r.enhet} ${r.id}`.toLowerCase().includes(q)) : all;
      if (c.av_forst) L = [...L.filter((r) => !pa(r)), ...L.filter((r) => pa(r))];
      const on = all.filter(pa).length, allOn = on === all.length;
      const search = c.sok !== false && d.sok !== false ? `<label class="srch" data-key="srch">${M.icon('mdi:magnify', 20, 'color:var(--ki-text-mid, #979797)')}<input data-input="q" data-key="q" value="${esc(this.ui.q || '')}" placeholder="Søk blant ${all.length}" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="search">${this.ui.q ? `<button class="clr" data-act="qclr" ${this._hp('light')} aria-label="Tøm søk">${M.icon('mdi:close', 18)}</button>` : ''}</label>` : '';
      const head = c.show_summary !== false ? `<div class="cnt" data-key="cnt"><span class="num">${on} av ${all.length} på</span><button class="all press" data-act="all" data-v="${allOn ? 'off' : 'on'}" ${this._hp('medium')}>${allOn ? 'Slå alle av' : 'Slå alle på'}</button></div>` : '';
      const rows = L.map((r, k) => {
        const s = h.states[r.id], o = pa(r), un = !s || M.unavailable(s);
        const sub = un ? 'Svarer ikke' : r.sub || '–';
        // trykk = toggle (optimistisk), hold 500 ms = more-info (data-ent), borte = dempet + «Svarer ikke»
        return `<button class="pr press ${o ? '' : 'off'} ${un ? 'borte' : ''} ${this._pend(r.id) ? 'pend' : ''}" style="animation-delay:${k * 25}ms" data-key="r-${esc(r.key)}" data-act="tg" data-id="${esc(r.id)}" data-ent="${esc(r.id)}" role="switch" aria-checked="${o}" ${un ? 'aria-disabled="true"' : ''} ${this._hp('selection')}>
          <span class="pi">${M.icon(r.icon, 22)}</span>
          <span class="pt"><b>${esc(r.name)}</b><i>${o || un ? esc(sub) : 'Av · ' + esc(sub)}</i></span>
          <span class="sw ${o ? 'on' : ''}"></span></button>`;
      }).join('');
      this._vsig = cardSig(h, c);
      return `${search}<div class="lst" data-key="lst">${head}${rows || '<div class="none">Ingen treff</div>'}</div>`;
    }
    onInput(name, el) { if (name === 'q') this.setUI({ q: el.value }); }
    onAction(name, el, ev) {
      const d = el.dataset;
      switch (name) {
        case 'tab': return this.setUI({ tab: d.v, q: '' });
        case 'night': return this._flip(ents(this.hass, this.config).natt);
        case 'priv': return this._flip(ents(this.hass, this.config).privat);
        case 'tg': return d.id ? this._flip(d.id, 'toggle') : undefined; // 29.2: optimistisk + tilbakerulling (27.6)
        case 'pickint': { const ui = this.customize('faner'); if (ui && ui.editor) { EXPF.set(cid(ui.editor), keyOf(d.v)); if (ui.editor._render) ui.editor._render(); } return undefined; }
        case 'qclr': return this.setUI({ q: '' });
        case 'all': {
          const c = this.config, h = this.hass;
          const L = tabRows(h, c, this.tab).filter((r) => h.states[r.id] && !M.unavailable(h.states[r.id])).map((r) => r.id);
          if (L.length) return M.call(h, 'homeassistant', d.v === 'off' ? 'turn_off' : 'turn_on', { entity_id: L });
          return undefined;
        }
        default: return super.onAction(name, el, ev);
      }
    }
    afterRender() {
      // Fiks 28.13: fanelinjen – hold 400 ms + dra = omorganiser (faner[]), sideveis dra = Liquid Glass-valg; tannhjulet står fast
      if (M.tabRow) M.tabRow(this, this.shadowRoot.querySelector('.bar:not(.pv)>.tabs[role="tablist"]'), {
        active: () => this.tab, order: () => fanerOf(this.config).map((t) => t.key),
        save: (full) => { const D = fanerOf(this.config); return M.mshPatchConfig(this, { faner: fanerOut(full.map((k) => D.find((t) => t.key === k)).filter(Boolean)), tabs: undefined, custom_tabs: undefined, tab_order: undefined, tab_hidden: undefined, tab_names: undefined }); },
      });
      // Fallgruve 2: trykk/hold på radene skal ikke nå Bubble Cards swipe-to-close (scroll i listen virker som før)
      const lst = this.shadowRoot.querySelector('.lst');
      if (lst && !lst.__mshStop) { lst.__mshStop = true; ['pointerdown', 'touchstart', 'touchmove'].forEach((t) => lst.addEventListener(t, (e) => e.stopPropagation(), { passive: true })); }
    }
    get styles() {
      const T = '1.2s cubic-bezier(.5,0,.2,1)';
      return `
        :host{display:block;width:100%}
        .wrap,.pane{display:flex;flex-direction:column;gap:var(--msh-gap,8px);min-width:0}
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
        .spin{width:10px;height:10px;box-sizing:content-box;border-radius:50%;border:2px solid rgba(255,255,255,.35);border-top-color:#fff;animation:spin .8s linear infinite;flex:none} /* ki-hex-ok: mørk øy */
        /* to kort (nattmodus av) */
        .two{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--msh-gap,8px)}
        .mk{position:relative;height:164px;border-radius:28px;overflow:hidden;isolation:isolate;padding:16px;box-sizing:border-box;display:flex;flex-direction:column;cursor:pointer;min-width:0;text-align:left;color:#fafafa} /* ki-hex-ok: mørk øy */
        .mk.natt{background:linear-gradient(180deg,#23285a,#2c2d5e)}
        .nsky{position:absolute;right:0;top:0;width:100%;height:calc(100% - 44px);pointer-events:none}
        .mh{position:relative;display:flex;justify-content:space-between;align-items:flex-start}
        .mt{font-size:14px;color:#dcdcf0;white-space:nowrap}
        .mk.priv .mt{color:#e2efe8}
        .ci{width:44px;height:44px;border-radius:22px;background:rgba(255,255,255,.12);display:grid;place-items:center;flex:none} /* ki-hex-ok: mørk øy */
        .mk.priv .ci{background:rgba(255,255,255,.14)} /* ki-hex-ok: mørk øy */
        .mb{position:relative;margin-top:auto;display:flex;justify-content:space-between;align-items:center;gap:6px}
        .mv{font-size:28px;font-weight:400;line-height:1.2}
        .bs{position:relative;width:50px;height:28px;border-radius:14px;flex:none;background:rgba(255,255,255,.28);box-shadow:inset 0 0 0 1px rgba(255,255,255,.2);transition:background .25s} /* ki-hex-ok: mørk øy */
        .bs::after{content:'';position:absolute;top:4px;left:4px;width:20px;height:20px;border-radius:10px;background:#fafafa;transition:transform .3s,background .3s} /* ki-hex-ok: mørk øy */
        .bs.on{background:rgb(102 209 158)}.bs.on::after{transform:translateX(22px);background:#1d2a22}
        .mk .pick{height:32px;padding:0 10px;font-size:12px}
        .mk.priv{background:#3a3a3a;transition:background .5s} /* toppkortene er mørke øyer (Del A): samme flate og lys tekst i begge moduser */ /* ki-hex-ok: mørk øy */
        .mk.priv.on{background:linear-gradient(160deg,#173d31,#1f5642)}
        .glw{position:absolute;right:-20px;top:20px;width:120px;height:120px;border-radius:50%;background:radial-gradient(circle,rgba(111,210,154,.35),transparent 70%);opacity:0;transition:opacity .6s;pointer-events:none}
        .mk.priv.on .glw{opacity:1;animation:glow 3s ease-in-out infinite}
        .ml{position:relative;display:flex;flex-direction:column;gap:4px;margin-top:6px;min-width:0}
        .lk{position:relative;width:28px;height:28px;display:grid;place-items:center;color:#afafaf} /* ki-hex-ok: mørk øy */
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
        .mk.priv.on .pbody{background:#cfeadd;box-shadow:0 4px 14px rgba(0,0,0,.25)} /* ki-hex-ok: mørk øy */
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
        .sc{position:relative;height:184px;border-radius:28px;overflow:hidden;isolation:isolate;background:#141a3a;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.05);cursor:pointer;animation:fade .45s ease both;color:#fafafa;transition:transform .15s cubic-bezier(.34,1.5,.64,1)} /* ki-hex-ok: mørk øy */
        .sc:active{transform:scale(.985)}
        .sc .bgg,.sc .nsk,.sc .dawn{position:absolute;inset:0;pointer-events:none}
        .sc .bgg{background:linear-gradient(180deg,#3a3d72 0%,#77598e 45%,#d68f86 78%,#f0b88c 100%)}
        .sc .nsk{background:linear-gradient(180deg,#0f1433 0%,#1c2250 55%,#2d2f62 100%);opacity:0;transition:opacity ${T}}
        .sc.night .nsk{opacity:1}
        .sc .dawn{background:linear-gradient(180deg,#2a2c5c 0%,#5a4778 55%,#b0727a 100%);opacity:0}
        .sc.morning.rise .dawn{animation:dawnsky 3s ease-out both}
        .sc .art{position:absolute;right:0;bottom:0;height:100%;width:100%;overflow:visible;pointer-events:none}
        .sc .stars{opacity:0;transition:opacity ${T}}.sc.night .stars{opacity:1}
        .sc .moon{transform:translateY(70px);opacity:0;transition:transform ${T},opacity ${T}}.sc.night .moon{transform:none;opacity:1}
        .sc .sun{transform:none;opacity:1;transition:transform ${T},opacity ${T}}.sc.night .sun{transform:translateY(70px);opacity:0}
        .sc.morning.rise .sunw{animation:sunrise 2.6s cubic-bezier(.2,.7,.2,1) both}
        .sc .rays{transform-box:fill-box;transform-origin:center;animation:spin 40s linear infinite}
        .sc .smk{transform-box:fill-box;animation:smoke 3.2s ease-out infinite}
        .sc .win{fill:#f5cf78}.sc.night .win{fill:#ffd572;filter:drop-shadow(0 0 4px rgba(255,210,110,.9));animation:glow 3s ease-in-out infinite}
        .sc .scam{fill:#545454}.sc .scam.rec{fill:rgb(242 128 115);animation:glow 1.4s ease-in-out infinite} /* ki-hex-ok: mørk øy */
        .sc .birds{opacity:1;transition:opacity .8s}.sc.night .birds{opacity:0}
        .sc .f1{animation:fly 7s ease-in-out infinite}.sc .f2{animation:fly 8s ease-in-out 1s infinite}
        .sc .fl1,.sc .fl2{transform-box:fill-box;transform-origin:center;animation:flap .9s ease-in-out infinite}.sc .fl2{animation:flap 1s ease-in-out .3s infinite}
        .sc .stx{position:absolute;left:18px;top:18px;right:72px;display:flex;flex-direction:column;gap:2px;text-shadow:0 1px 6px rgba(0,0,0,.35)} /* ki-hex-ok: mørk øy */
        .sc .k{font-size:13px;color:#e6e2ee}
        .sc .gt{font-size:28px;font-weight:400;line-height:1.2}
        .sc .chips{position:absolute;left:14px;bottom:14px;right:14px;display:flex;gap:6px}
        .cp{height:36px;padding:0 14px 0 10px;border-radius:18px;display:flex;align-items:center;gap:6px;font-size:13px;font-weight:600;white-space:nowrap;background:rgba(0,0,0,.32);color:#e1e1e1;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);transition:background .25s,color .25s,transform .1s;min-width:0} /* ki-hex-ok: mørk øy */
        .cp:active{transform:scale(.96)}
        .cp.n.on{background:#fafafa;color:#282828} /* ki-hex-ok: mørk øy */
        .cp.p.on{background:rgb(102 209 158);color:#1d2a22}
        .cp.miss{background:rgba(242,181,115,.3)}
        .sc.na,.sc.na *{animation:none !important;transition:none !important}
        /* fanelinjen + tannhjul */
        ${TAB_CSS('')}
        /* søk, teller, rader */
        .srch{display:flex;align-items:center;gap:10px;height:48px;border-radius:24px;background:var(--ki-surface, #3a3a3a);padding:0 6px 0 16px}
        .srch input{flex:1;min-width:0;height:100%;font-size:15px;background:transparent;border:0;outline:none;color:var(--ki-text, #fafafa)}
        .srch input::placeholder{color:var(--ki-text-mid, #979797)}
        .clr{width:36px;height:36px;border-radius:18px;display:grid;place-items:center;background:var(--ki-surface-2, #404040)}
        .lst{display:flex;flex-direction:column;gap:8px}
        .cnt{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:4px 6px 0;font-size:13px;color:var(--ki-text-2, #afafaf);white-space:nowrap}
        .all{height:32px;padding:0 12px;border-radius:16px;background:var(--ki-surface-2, #404040);color:var(--ki-text, #fafafa);font-size:12px;font-weight:500;white-space:nowrap;flex:none}
        .pr{width:100%;display:flex;align-items:center;gap:14px;min-height:66px;padding:4px 18px 4px 4px;box-sizing:border-box;border-radius:34px;background:var(--ki-surface, #3a3a3a);text-align:left;animation:fade .3s ease backwards}
        .pr{touch-action:pan-y;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
        .pr.borte{opacity:.45}
        .pi{width:58px;height:58px;border-radius:29px;flex:none;display:grid;place-items:center;background:var(--ki-surface-2, #4a4a4a);color:var(--ki-text-1, #e1e1e1);transition:background .25s,color .25s}
        .pr.off .pi{background:rgb(242 128 115 / .16);color:var(--ki-red-text, var(--red,#f28073))}
        .pt{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
        .pt b{font-size:15px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .pt i{font-style:normal;font-size:12px;color:var(--ki-text-mid, #979797);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .pr.off .pt i{color:var(--ki-red-text, var(--red,#f28073))}
        .sw{position:relative;width:44px;height:26px;border-radius:13px;background:var(--ki-ctrl, #545454);flex:none;transition:background .2s}
        .sw::after{content:'';position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:10px;background:var(--ki-knob, #fafafa);transition:transform .2s}
        .sw.on{background:var(--pink,#f285c9)}.sw.on::after{transform:translateX(18px)}
        .none{text-align:center;font-size:14px;color:var(--ki-text-mid, #979797);padding:24px 0}
        @media (max-width:380px){.mv{font-size:24px}}
        @media (prefers-reduced-motion: reduce){.sc,.sc *,.pr,.mk *{animation:none !important;transition:none !important}}`;
    }
  }
  M.define('msh-innstillinger-card', Innstillinger, 'MSH Innstillinger', 'Innstillinger-popupen (#settings): God natt/God morgen, natt- og privatmodus, varsler fra KI Varslinger og sikkerhet (kategorier som faner) og KI Energi (fiks 27; dashbord-delen fjernet i fiks 33.3).');
})();
