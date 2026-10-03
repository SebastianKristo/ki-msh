/* KI MSH · Søppel (#soppel, msh-avfall-card) – fiks 25.4, etter prompt-teksten «Søppel v3» (designfila finnes ikke i repoet).
 * Étt kort i Bubble-popupen #soppel (mal A). Erstatter den importerte #soppel-popupen (custom:ki-avfall-card fra ki-cards):
 * strategien genererer #soppel, oppsettet fra det gamle kortet (entities, dager_attributt …) flyttes over (MSH.avfallExtra),
 * og den importerte popupen vises som «Erstattet av Søppel» i Egne popups (MSH.POPUP_SUPERSEDE, som Kalender).
 * Hjem-kortet msh-soppel-card (22-hjem-soppel.js) beholdes og åpner #soppel.
 *
 * Data og autokonfig er flyttet uendret i logikk fra ki-cards/src/72-ki-avfall-card.js (_ider, _fraksjoner, _datoer,
 * _hentKalender) – bare tilpasset MSH-hjelperne:
 *   · entities → ellers `monster` (ankret regex) → ellers alle sensor.* med attributtet `dager_attributt` (days_to_pickup)
 *   · dager = attributt → ellers state hvis tall → ellers regnet fra `dato_attributt` (raw_date); <0 eller >730 = ikke avfall
 *   · datoer: kalender_entitet (faktiske) → ellers datoene sensoren selv gir (dates/datoer/upcoming) → ellers raw_date +
 *     n × intervall_dager (anslag, merket i kalenderen)
 *   · navn = friendly_name, ikon/farge etter navnet med KI_SOPPEL_FARGE-reglene (48-ki-soppel-card.js), mappet til
 *     temafargene med fallback: rest grå, mat/bio lime, papp/papir blå, plast lilla, glass/metall grønn, hage brun, farlig rød
 *
 * Utseende:
 *   Toppkort 184 px (#2b3039, glød i fraksjonsfargen): pille «Neste tømming» / «Tømmes i dag» (blinkende prikk), «I morgen»
 *   36 px, navn og dato, tannhjul øverst til høyre (→ «Tilpass Søppel»). Bøttene nede til høyre hopper dagen før (skal ut)
 *   og rister med lokket på tømmedagen; søppelbilen kjører på tømmedagen (`soppelbil`, av/på i Tilpass).
 *   Faner (Liquid Glass): Oversikt · Kalender · Varsler.
 *     Oversikt: 2-kol fraksjonskort (fremdriftsstrek i bunn; trykk velger fraksjon → toppkortet) + «Neste 14 dager»
 *       (i dag rosa, prikker per fraksjon, trykk viser dagens fraksjoner).
 *     Kalender: måned (piler), prikker per fraksjon, trykk viser dagen.
 *     Varsler: bryter per fraksjon + Kveld 18:00 / Kveld 20:00 / Morgen 07:00. Lagres i config (`varsler`, `varseltid`) og
 *       sendes av en blueprint/automasjon – kortet sender ingenting selv.
 * Config:
 *   entities · monster · dager_attributt (days_to_pickup) · dato_attributt (raw_date) · kalender (false = skjul Kalender-fanen)
 *   kalender_entitet · intervall_dager (14)
 *   fraksjoner: { <entity_id>: { name, color, hidden, intervall } } · fraksjon_order: [entity_id …]
 *   tab_order · tab_hidden · start_tab · varsler: { <entity_id>: true } · varseltid ('18:00' | '20:00' | '07:00')
 *   soppelbil (true) · haptikk (true) · gap · pad_top · pad_bottom
 * «Tilpass Søppel» (kortets ark og GUI-editoren, samme skjema): Faner · Fraksjoner · Entiteter · Avansert (fiks 25.6:
 *   ikonfaner i segment, seksjonskort #3a3a3a r24, dra-håndtak med touch-action:none + stopPropagation, rosa brytere 44×26).
 */
(function () {
  const M = window.MSH;
  if (!M) return;
  const esc = M.esc, C = M.C;
  const HASH = '#soppel';
  // Fiks 35 (tema): gjennomsiktig hvit/svart etter regel 4/3 (mørk modus = som før). Toppkortet er en mørk øy.
  const TH = M.theme || {};
  const WA = (a) => (TH.whiteA ? TH.whiteA(a) : `rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(${a}*var(--ki-wa-k,1)),var(--ki-wa-max,1)))`);
  const OA = 'var(--ki-on-accent, #2a1720)';

  /* ============================================================ felles for Tilpass-arkene (25.6) – brukes også av 60-innstillinger.js */
  // Rosa brytere 44×26, segmenter på #282828, seksjonskort #3a3a3a r24 – bare i editorer for disse kortene (adoptedStyleSheets,
  // morph rører dem ikke).
  const ED_EXTRA = `
    .sw{width:44px;height:26px;border-radius:13px}
    .sw::after{top:3px;left:3px;width:20px;height:20px;border-radius:10px}
    .sw.on{background:var(--pink,#f285c9)} .sw.on::after{transform:translateX(18px)}
    .chips.sg.tabs,.chips.sg.tsub{background:var(--ki-surface-3, #282828)}
    .fsec>.sec{border-radius:24px;background:var(--ki-surface, #3a3a3a)}
    .ordrow{touch-action:pan-y}
    .edrow{display:flex;align-items:center;gap:8px;min-height:56px;border-radius:28px;background:var(--ki-surface-2, #404040);padding:4px 6px 4px 8px}
    .edrow.off{opacity:.5}
    .edrow .nm{flex:1;min-width:0;display:flex;flex-direction:column}
    .edrow .nm b{font-size:14px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .edrow .nm i{font-style:normal;font-size:11px;color:var(--ki-text-mid, #979797);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .edh{touch-action:none;cursor:grab;display:inline-flex;color:var(--ki-text-mid, #979797);padding:8px 2px;flex:none}
    .edic{width:36px;height:36px;border-radius:18px;display:grid;place-items:center;flex:none;background:var(--ki-surface, #3a3a3a)}
    .edsub{display:flex;flex-direction:column;gap:8px;padding:10px 12px 12px;margin:-4px 0 4px 28px;border-radius:22px;background:var(--ki-surface-3, #353535)}
    .edsw{display:flex;flex-wrap:wrap;gap:6px}
    .edsw button{width:28px;height:28px;border-radius:14px;box-shadow:inset 0 0 0 1px ${WA(0.12)}}
    .edsw button.on{box-shadow:0 0 0 2px var(--ki-popup, #282828),0 0 0 4px var(--ki-text, #fafafa)}
    .edq{display:flex;align-items:center;gap:8px;height:44px;border-radius:22px;background:var(--ki-surface-3, #2f2f2f);padding:0 6px 0 14px}
    .edq input{flex:1;min-width:0;height:100%;background:none;border:0;color:var(--ki-text, #fafafa);font-size:14px}
    .edhit{min-height:48px;border-radius:24px;background:var(--ki-surface-2, #404040);display:flex;align-items:center;gap:10px;padding:6px 14px;text-align:left;width:100%}
    .edhit .nm{flex:1;min-width:0;display:flex;flex-direction:column}
    .edhit .nm b{font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .edhit .nm i{font-style:normal;font-size:11px;color:var(--ki-text-mid, #979797);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .edlist{display:flex;flex-direction:column;gap:8px}`;
  let edSheet = null;
  // Installer i en editor (én gang): ekstra CSS, dra-for-rekkefølge og søkefelt.
  //   Dra: element med data-edk (nøkkel) + data-elist (liste) og et håndtak [data-edrag]. Ved slipp: ed.__edDrop[liste](ny rekkefølge).
  //   Søk: <input data-edq="nøkkel"> → ed.__edQ[nøkkel] = tekst, ny tegning (fokus beholdes av morph).
  M.edKit = M.edKit || function (ed) {
    if (!ed || !ed.shadowRoot) return;
    ed.__edDrop = ed.__edDrop || {}; ed.__edQ = ed.__edQ || {};
    if (ed.__edKit) return;
    ed.__edKit = true;
    const R = ed.shadowRoot;
    try { if (!edSheet) { edSheet = new CSSStyleSheet(); edSheet.replaceSync(ED_EXTRA); } if (!R.adoptedStyleSheets.includes(edSheet)) R.adoptedStyleSheets = [...R.adoptedStyleSheets, edSheet]; } catch (e) { /* eldre nettleser: standardstil */ }
    let d = null;
    const onHandle = (e) => !!(e.target && e.target.closest && e.target.closest('[data-edrag]'));
    R.addEventListener('touchstart', (e) => { if (onHandle(e)) e.stopPropagation(); }, { passive: true });
    R.addEventListener('touchmove', (e) => { if (d || onHandle(e)) { e.stopPropagation(); if (d && e.cancelable) e.preventDefault(); } }, { passive: false });
    R.addEventListener('input', (e) => { const t = e.target; if (!t.dataset || t.dataset.edq == null) return; e.stopPropagation(); ed.__edQ[t.dataset.edq] = t.value; ed._render(); }, true);
    R.addEventListener('pointerdown', (e) => {
      const hd = e.target.closest && e.target.closest('[data-edrag]');
      if (!hd || e.button) return;
      const item = hd.closest('[data-edk]');
      if (!item) return;
      e.stopPropagation(); e.preventDefault(); // fallgruve 2: popupen/arket skal ikke dras eller lukkes
      d = { list: item.dataset.elist, k: item.dataset.edk, item, y0: e.clientY, id: e.pointerId, over: null };
      try { hd.setPointerCapture(e.pointerId); } catch (x) { /* */ }
      item.style.position = 'relative'; item.style.zIndex = '2'; item.style.boxShadow = '0 6px 18px ' + (TH.blackA ? TH.blackA(0.4, TH.mode()) : 'rgb(0 0 0 / .4)'); // konkret (regel 3) – bare under draget
      M.haptic('medium');
    });
    R.addEventListener('pointermove', (e) => {
      if (!d || e.pointerId !== d.id) return;
      e.stopPropagation(); e.preventDefault();
      d.item.style.transform = `translateY(${e.clientY - d.y0}px)`;
      d.item.style.pointerEvents = 'none';
      const el = R.elementFromPoint ? R.elementFromPoint(e.clientX, e.clientY) : null;
      d.item.style.pointerEvents = '';
      const ov = el && el.closest && el.closest('[data-edk]');
      const ok = ov && ov !== d.item && ov.dataset.elist === d.list ? ov : null;
      if (ok !== d.over) { if (d.over) d.over.style.outline = ''; d.over = ok; if (ok) { ok.style.outline = '2px solid rgba(242,133,201,.6)'; M.haptic('selection'); } }
    });
    const end = (e) => {
      if (!d || (e && e.pointerId !== d.id)) return;
      e.stopPropagation();
      const D = d; d = null;
      D.item.style.transform = ''; D.item.style.zIndex = ''; D.item.style.boxShadow = ''; D.item.style.position = '';
      if (D.over) D.over.style.outline = '';
      if (!D.over) return;
      const arr = [...R.querySelectorAll('[data-elist]')].filter((x) => x.dataset.elist === D.list).map((x) => x.dataset.edk);
      const to = D.over.dataset.edk, i = arr.indexOf(D.k), j0 = arr.indexOf(to);
      const o = arr.filter((x) => x !== D.k), j = o.indexOf(to);
      o.splice(i <= j0 ? j + 1 : j, 0, D.k);
      M.haptic('success');
      const fn = ed.__edDrop[D.list];
      if (fn) fn(o); else ed._render();
    };
    R.addEventListener('pointerup', end);
    R.addEventListener('pointercancel', end);
  };
  M.edHandle = () => `<span class="edh" data-edrag title="Dra for rekkefølge">${M.icon('mdi:drag', 20)}</span>`;
  M.edEye = (key, op, v, hid, label) => `<button class="ib" data-a="fn" data-k="${key}" data-op="${op}" data-v="${esc(v)}" aria-label="${hid ? 'Vis' : 'Skjul'} ${esc(label)}">${M.icon(hid ? 'mdi:eye-off-outline' : 'mdi:eye-outline', 20, `color:${hid ? 'var(--ki-text-lo, #696969)' : 'var(--ki-text, #fafafa)'}`)}</button>`;
  // Rekkefølge: lagret rekkefølge først (bare kjente nøkler), resten i standardrekkefølge
  M.edOrder = (keys, saved) => { const o = (Array.isArray(saved) ? saved : []).filter((k) => keys.includes(k)); keys.forEach((k) => { if (!o.includes(k)) o.push(k); }); return o; };

  /* ============================================================ data (fra ki-avfall-card, uendret logikk) */
  // KI_SOPPEL_FARGE-reglene (rekkefølgen betyr noe: «rest» først) → temafarger med fallback
  const SLAG = [
    { treff: /rest/i, navn: 'Restavfall', ikon: 'mdi:trash-can-outline', farge: C.gray700 },
    { treff: /mat|bio/i, navn: 'Matavfall', ikon: 'mdi:food-apple-outline', farge: C.lime },
    { treff: /papp|papir|kartong/i, navn: 'Papir og papp', ikon: 'mdi:newspaper-variant-outline', farge: C.blue },
    { treff: /plast/i, navn: 'Plast', ikon: 'mdi:recycle', farge: C.purple },
    { treff: /glass|metall/i, navn: 'Glass og metall', ikon: 'mdi:bottle-soda-classic-outline', farge: C.green },
    { treff: /hage|park/i, navn: 'Hageavfall', ikon: 'mdi:leaf', farge: C.brown },
    { treff: /farlig|spesial/i, navn: 'Farlig avfall', ikon: 'mdi:biohazard', farge: C.red },
  ];
  const slagOf = (navn, id) => { const t = `${navn || ''} ${id || ''}`; return SLAG.find((s) => s.treff.test(t)) || { navn: navn || id, ikon: 'mdi:trash-can-outline', farge: C.gray700 }; };
  M.avfallSlag = slagOf;
  const DAY = 864e5;
  const d0 = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const dk = (d) => `${d.getFullYear()}-${M.pad(d.getMonth() + 1)}-${M.pad(d.getDate())}`;
  const today = () => d0(new Date());
  const cfgAttr = (c) => ({ dager: c.dager_attributt || 'days_to_pickup', dato: c.dato_attributt || 'raw_date' });

  // Enten en eksplisitt liste, eller alt som treffer mønsteret, eller (autokonfig) alle sensor.* med dager-attributtet.
  // Mønsteret ankres med ^ og $, og ved søk kreves dager-attributtet (ellers blir tilfeldige tallsensorer «fraksjoner»).
  function ider(h, c) {
    if (Array.isArray(c.entities) && c.entities.length) return c.entities.map((x) => (typeof x === 'string' ? x : x && x.entity)).filter(Boolean);
    if (!h) return [];
    let re = null;
    if (c.monster) {
      let m = String(c.monster);
      if (!m.startsWith('^')) m = `^${m}`;
      if (!m.endsWith('$')) m = `${m}$`;
      try { re = new RegExp(m, 'i'); } catch (e) { console.warn('[ki-msh] Søppel: ugyldig monster', c.monster, e); return []; }
    }
    const attr = cfgAttr(c).dager;
    return Object.keys(h.states).filter((id) => {
      if (!id.startsWith('sensor.') || (re && !re.test(id))) return false;
      const a = (h.states[id] || {}).attributes || {};
      return a[attr] !== undefined && a[attr] !== null;
    }).sort();
  }
  M.avfallIds = ider;
  // Alle fraksjoner (også skjulte, merket hidden), sortert etter hvor nær de er
  function fraksjoner(h, c) {
    if (!h) return [];
    const A = cfgAttr(c), F = c.fraksjoner || {}, t0 = today(), ut = [];
    for (const id of ider(h, c)) {
      const st = h.states[id];
      if (!st) continue;
      const a = st.attributes || {};
      // Dagene står vanligvis som attributt, men noen integrasjoner har dem i tilstanden
      let dager = a[A.dager];
      if (dager === undefined || dager === null || dager === '') dager = parseFloat(st.state);
      dager = isNaN(parseFloat(dager)) ? null : Math.round(parseFloat(dager));
      const raw = a[A.dato] || null;
      if (dager === null && raw) { const d = new Date(raw); if (!isNaN(d)) dager = Math.round((d0(d) - t0) / DAY); }
      // Negative dager / over to år fram: ikke tømming (eller utdatert dato)
      if (dager !== null && (dager < 0 || dager > 730)) continue;
      const slag = slagOf(a.friendly_name, id), o = F[id] || {};
      let dato = raw ? new Date(raw) : null;
      if (dato && isNaN(dato)) dato = null;
      if (!dato && dager !== null) dato = new Date(t0.getTime() + dager * DAY);
      const flere = ['dates', 'datoer', 'upcoming', 'next_dates'].map((k) => a[k]).find((v) => Array.isArray(v) && v.length) || null;
      ut.push({ id, dager, dato, raw, flere, navn: o.name || a.friendly_name || slag.navn, ikon: a.icon || slag.ikon, farge: M.color(o.color, slag.farge), hidden: !!o.hidden, intervall: Number(o.intervall) || 0 });
    }
    return ut.sort((x, y) => (x.dager ?? 9999) - (y.dager ?? 9999));
  }
  M.avfallFraksjoner = fraksjoner;
  // Rekkefølge i Oversikt/Tilpass: fraksjon_order, ellers nærmest først
  const ordered = (L, c) => { const o = M.edOrder(L.map((f) => f.id), c.fraksjon_order); return o.map((id) => L.find((f) => f.id === id)); };

  // Alle kjente tømmedatoer: kalenderentitet (faktiske) → sensorens egne datoer → framskriving fra intervallet (anslag)
  function datoer(alle, c, kal) {
    const ut = [];
    for (const hv of kal || []) {
      const treff = alle.find((f) => { const n = String(hv.summary || '').toLowerCase(); return n && String(f.navn).toLowerCase().split(' ').some((o) => o.length > 3 && n.includes(o)); });
      ut.push({ dato: hv.dato, id: treff ? treff.id : null, navn: hv.summary || (treff && treff.navn) || 'Tømming', farge: (treff && treff.farge) || C.gray700, ekte: true });
    }
    if (ut.length) return ut;
    const global = Number(c.intervall_dager) || 0;
    const slutt = new Date(); slutt.setMonth(slutt.getMonth() + 4);
    for (const f of alle) {
      if (f.flere) { f.flere.forEach((x) => { const d = new Date(x && typeof x === 'object' ? x.date || x.dato : x); if (!isNaN(d)) ut.push({ dato: d, id: f.id, navn: f.navn, farge: f.farge, ekte: true }); }); continue; }
      if (!f.dato) continue;
      const iv = f.intervall || global;
      let d = new Date(f.dato);
      if (isNaN(d)) continue;
      ut.push({ dato: new Date(d), id: f.id, navn: f.navn, farge: f.farge, ekte: true });
      if (iv > 0) for (let i = 0; i < 20; i++) { d = new Date(d.getTime() + iv * DAY); if (d > slutt) break; ut.push({ dato: new Date(d), id: f.id, navn: f.navn, farge: f.farge, ekte: false }); }
    }
    return ut;
  }
  M.avfallDatoer = datoer;
  // Kalenderentitet (valgfri): hentes når popupen er åpen, mellomlagres 5 min (fallgruve 8)
  const KAL = new Map();
  function hentKalender(h, id, done) {
    if (!id || !h || !h.callApi) return null;
    const x = KAL.get(id);
    if (x && Date.now() - x.t < 3e5) return x.list;
    if (x && x.busy) return x.list;
    const fra = new Date(); fra.setMonth(fra.getMonth() - 1); fra.setHours(0, 0, 0, 0);
    const til = new Date(); til.setMonth(til.getMonth() + 4);
    KAL.set(id, { t: 0, busy: true, list: x ? x.list : null });
    h.callApi('GET', `calendars/${id}?start=${encodeURIComponent(fra.toISOString())}&end=${encodeURIComponent(til.toISOString())}`).then((svar) => {
      const list = (svar || []).map((e) => { const raa = (e.start && (e.start.dateTime || e.start.date)) || e.start; const d = new Date(raa); return isNaN(d) ? null : { dato: d, summary: e.summary }; }).filter(Boolean);
      KAL.set(id, { t: Date.now(), list });
      done && done();
    }).catch((e) => { console.warn('[ki-msh] Søppel: fikk ikke hentet kalenderen', e); KAL.set(id, { t: Date.now(), list: [] }); done && done(); });
    return x ? x.list : null;
  }

  /* ============================================================ tekster */
  const tekst = (d) => (d === null || d === undefined || isNaN(d) ? '–' : d <= 0 ? 'I dag' : d === 1 ? 'I morgen' : `Om ${d} dager`);
  const kort = (d) => (d === null || d === undefined || isNaN(d) ? '–' : d <= 0 ? 'I dag' : d === 1 ? 'I morgen' : `${d} dager`);
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const datoTxt = (d) => (d && !isNaN(d) ? `${cap(d.toLocaleDateString('nb-NO', { weekday: 'long' }))} ${d.getDate()}. ${d.toLocaleDateString('nb-NO', { month: 'long' })}` : '');
  const og = (a) => (a.length > 1 ? `${a.slice(0, -1).join(', ')} og ${a[a.length - 1]}` : a[0] || '');
  const WD = ['ma', 'ti', 'on', 'to', 'fr', 'lø', 'sø'];

  /* ============================================================ faner */
  const TABS = [['oversikt', 'Oversikt', 'mdi:view-grid-outline'], ['kalender', 'Kalender', 'mdi:calendar-month-outline'], ['varsler', 'Varsler', 'mdi:bell-outline']];
  const TV = (k, n) => (M.tabH ? M.tabH.v(k, n) : n + 'px'); // 33.4: fanehøyde-variabler (05-tab-bar.js)
  const TABL = Object.fromEntries(TABS.map((t) => [t[0], t]));
  const tabOrder = (c) => M.edOrder(TABS.map((t) => t[0]), c.tab_order);
  // `kalender: false` (gammel config) skjuler Kalender-fanen til brukeren velger faner selv (tab_hidden)
  const tabHidden = (c) => new Set(Array.isArray(c.tab_hidden) ? c.tab_hidden : c.kalender === false ? ['kalender'] : []);
  const visTabs = (c) => { const hid = tabHidden(c); const o = tabOrder(c).filter((k) => !hid.has(k)); return o.length ? o : ['oversikt']; };
  const TIDER = [['18:00', 'Kveld 18:00'], ['20:00', 'Kveld 20:00'], ['07:00', 'Morgen 07:00']];

  /* ============================================================ gammel config (den importerte #soppel-popupen) */
  const OLD_RX = /custom:ki-(avfall|soppel)-card|template_sensor_big_alt/;
  const KEEP = ['entities', 'monster', 'dager_attributt', 'dato_attributt', 'kalender', 'kalender_entitet', 'intervall_dager'];
  const cfgOf = (e) => { try { return M.customPopupConfig ? M.customPopupConfig(e).cfg : e; } catch (x) { return null; } };
  function legacyOf(cfg) {
    if (!cfg || typeof cfg !== 'object') return null;
    if (String(cfg.hash || '').trim().replace(/^#?/, '#') !== HASH) return null;
    let js = ''; try { js = JSON.stringify(cfg); } catch (e) { return null; }
    if (!OLD_RX.test(js)) return null;
    let out = null;
    const walk = (o, d) => {
      if (out || !o || typeof o !== 'object' || d > 30) return;
      if (Array.isArray(o)) { o.forEach((x) => walk(x, d + 1)); return; }
      if (o.type === 'custom:ki-avfall-card') { out = {}; KEEP.forEach((k) => { if (o[k] != null) out[k] = o[k]; }); return; }
      Object.keys(o).forEach((k) => { if (o[k] && typeof o[k] === 'object') walk(o[k], d + 1); });
    };
    walk(cfg, 0);
    return out || {};
  }
  const lists = (config) => [(M.store && (M.store.get('custom_popups') || [])) || [], (config && config.custom_popups) || []];
  M.avfallExtra = function (config) {
    for (const L of lists(config)) for (const e of (Array.isArray(L) ? L : [])) { const r = legacyOf(cfgOf(e)); if (r && Object.keys(r).length) return r; }
    return undefined;
  };
  M.avfallLegacy = (config) => lists(config).some((L) => (Array.isArray(L) ? L : []).some((e) => !!legacyOf(cfgOf(e))));
  M.POPUP_SUPERSEDE = M.POPUP_SUPERSEDE || {};
  M.POPUP_SUPERSEDE[HASH] = { name: 'Søppel', test: (cfg) => !!legacyOf(cfg) };
  M.POPUP_EXTRA = M.POPUP_EXTRA || {};
  M.POPUP_EXTRA[HASH] = (config) => M.avfallExtra(config);

  /* ============================================================ toppkortets tegninger */
  // Én bøtte (48×58) i fraksjonsfargen: kropp, riller og lokk (lokket rister på tømmedagen)
  const bin = (farge, i) => `<svg class="bin" style="--i:${i}" viewBox="0 0 48 58" aria-hidden="true">
      <rect x="6" y="14" width="36" height="40" rx="6" fill="${farge}"/>
      <path d="M16 22v24M24 22v24M32 22v24" stroke="rgba(0,0,0,.22)" stroke-width="2.4" stroke-linecap="round"/><!-- ki-hex-ok: illustrasjon i mørk øy -->
      <circle cx="13" cy="54" r="4" fill="#1b1d22"/><circle cx="35" cy="54" r="4" fill="#1b1d22"/>
      <g class="lid"><rect x="2" y="7" width="44" height="8" rx="4" fill="${farge}"/><rect x="18" y="3" width="12" height="5" rx="2.5" fill="${farge}"/></g></svg>`;
  const truck = () => `<svg class="truck" viewBox="0 0 150 60" aria-hidden="true">
      <rect x="4" y="10" width="92" height="34" rx="6" fill="#e1e1e1"/><rect x="10" y="16" width="80" height="10" rx="3" fill="rgba(0,0,0,.12)"/><!-- ki-hex-ok: illustrasjon i mørk øy -->
      <path d="M96 20h28l16 16v8H96z" fill="#c7c7c7"/><rect x="102" y="24" width="18" height="11" rx="2" fill="#73b9f2" opacity=".8"/>
      <circle class="wh" cx="28" cy="48" r="8" fill="#1b1d22"/><circle class="wh" cx="72" cy="48" r="8" fill="#1b1d22"/><circle class="wh" cx="120" cy="48" r="8" fill="#1b1d22"/>
      <circle cx="28" cy="48" r="3" fill="#696969"/><circle cx="72" cy="48" r="3" fill="#696969"/><circle cx="120" cy="48" r="3" fill="#696969"/></svg>`;

  /* ============================================================ editoren (Tilpass Søppel + GUI) */
  const cid = (ed) => ((ed && ed._config && ed._config.card_id) || '_');
  const EXP = new Map(); // utvidet fraksjon i Fraksjoner (card_id → entity_id)
  const SWAP = new Map(); // fraksjon som byttes / «ny» i Entiteter (card_id → entity_id | '+')
  const PALETTE = ['gray700', 'blue', 'purple', 'green', 'lime', 'brown', 'red', 'orange', 'yellow', 'pink', 'light-blue', 'gray1000'];
  function editorSchema() {
    const faner = { type: 'html', html: (hh, cc, key, ed) => {
      M.edKit(ed);
      ed.__edDrop['sop-tab'] = (o) => ed._set('tab_order', o);
      const hid = tabHidden(cc);
      return `<div class="edlist">${tabOrder(cc).map((k) => { const [, label, icon] = TABL[k]; return `<div class="edrow ${hid.has(k) ? 'off' : ''}" data-edk="${k}" data-elist="sop-tab" data-key="st-${k}">${M.edHandle()}<span class="edic">${M.icon(icon, 20)}</span><span class="nm"><b>${esc(label)}</b></span>${M.startTab ? M.startTab.pill(cc, k, visTabs(cc)) : ''}${M.edEye(key, 'teye', k, hid.has(k), label)}</div>`; }).join('')}
        <span class="help" style="font-size:11px;color:var(--ki-text-3, #7f7f7f);padding:0 6px">Dra i håndtaket for rekkefølge, øyet skjuler. Minst én fane må være synlig.</span></div>`;
    }, click: (dd, ed) => {
      const cc = ed._config || {};
      if (dd.op === 'teye') {
        const hid = tabHidden(cc);
        if (!hid.has(dd.v) && TABS.filter((t) => !hid.has(t[0])).length <= 1) { M.haptic('warning'); M.toast('Minst én fane må være synlig'); return; }
        if (hid.has(dd.v)) hid.delete(dd.v); else hid.add(dd.v);
        M.haptic('selection');
        return ed._set('tab_hidden', [...hid]);
      }
    } };
    const frak = { type: 'html', html: (hh, cc, key, ed) => {
      M.edKit(ed);
      ed.__edDrop['sop-frak'] = (o) => ed._set('fraksjon_order', o);
      const L = ordered(fraksjoner(hh, cc), cc), open = EXP.get(cid(ed));
      if (!L.length) return `<div class="small" style="padding:0 6px">Fant ingen fraksjoner. Velg sensorene under «Entiteter».</div>`;
      return `<div class="edlist">${L.map((f) => {
        const isO = open === f.id, o = (cc.fraksjoner || {})[f.id] || {};
        const row = `<div class="edrow ${f.hidden ? 'off' : ''}" data-edk="${esc(f.id)}" data-elist="sop-frak" data-key="sf-${esc(f.id)}">${M.edHandle()}
          <span class="edic" style="background:${M.alpha(f.farge, 0.22)};color:${f.farge}">${M.icon(f.ikon, 20)}</span>
          <span class="nm"><b>${esc(f.navn)}</b><i>${esc(f.id)}</i></span>
          <button class="ib" data-a="fn" data-k="${key}" data-op="fexp" data-v="${esc(f.id)}" aria-expanded="${isO}" aria-label="Rediger ${esc(f.navn)}">${M.icon(isO ? 'mdi:chevron-up' : 'mdi:pencil-outline', 20)}</button>
          ${M.edEye(key, 'feye', f.id, f.hidden, f.navn)}</div>`;
        const sub = isO ? `<div class="edsub" data-key="sfs-${esc(f.id)}"><span style="font-size:12px;color:var(--ki-text-2, #afafaf)">Navn</span>
          <div class="edq"><input data-sopname="${esc(f.id)}" value="${esc(o.name || '')}" placeholder="${esc((hh.states[f.id] && hh.states[f.id].attributes.friendly_name) || f.navn)}" autocapitalize="off" autocorrect="off" spellcheck="false"></div>
          <span style="font-size:12px;color:var(--ki-text-2, #afafaf)">Farge</span>
          <div class="edsw">${PALETTE.map((p) => { const v = `var(--${p})`, on = (o.color || '') === v; return `<button class="${on ? 'on' : ''}" data-a="fn" data-k="${key}" data-op="fcol" data-v="${esc(f.id)}" data-c="${esc(v)}" aria-label="${esc(p)}" style="background:${M.color(v)}"></button>`; }).join('')}
          <button data-a="fn" data-k="${key}" data-op="fcol" data-v="${esc(f.id)}" data-c="" aria-label="Automatisk" title="Automatisk" style="display:grid;place-items:center;background:var(--ki-surface-3, #2f2f2f)">${M.icon('mdi:auto-fix', 16)}</button></div></div>` : '';
        return row + sub;
      }).join('')}<span class="help" style="font-size:11px;color:var(--ki-text-3, #7f7f7f);padding:0 6px">Dra for rekkefølge i Oversikt. Blyanten gir navn og farge fra temaet, øyet skjuler fraksjonen.</span></div>`;
    }, click: (dd, ed) => {
      const cc = ed._config || {}, id = cid(ed), F = { ...(cc.fraksjoner || {}) };
      const put = (fid, patch) => { const o = { ...(F[fid] || {}), ...patch }; Object.keys(o).forEach((k) => { if (o[k] === undefined || o[k] === '' || o[k] === false) delete o[k]; }); if (Object.keys(o).length) F[fid] = o; else delete F[fid]; ed._set('fraksjoner', Object.keys(F).length ? F : undefined); };
      if (dd.op === 'fexp') { M.haptic('selection'); if (EXP.get(id) === dd.v) EXP.delete(id); else EXP.set(id, dd.v); return ed._render(); }
      if (dd.op === 'feye') { M.haptic('selection'); return put(dd.v, { hidden: !(F[dd.v] || {}).hidden }); }
      if (dd.op === 'fcol') { M.haptic('selection'); return put(dd.v, { color: dd.c || undefined }); }
    } };
    // Entitet per fraksjon (søk): bytt, fjern, legg til · «Bruk automatisk» tømmer entities
    const ent = { type: 'html', html: (hh, cc, key, ed) => {
      M.edKit(ed);
      if (!ed.__sopName) { // navnefeltet i Fraksjoner: lagres ved endring (ikke per tastetrykk)
        ed.__sopName = true;
        ed.shadowRoot.addEventListener('change', (e) => { const t = e.target; if (!t.dataset || t.dataset.sopname == null) return; e.stopPropagation(); const c2 = ed._config || {}, F = { ...(c2.fraksjoner || {}) }, o = { ...(F[t.dataset.sopname] || {}) }; const v = t.value.trim(); if (v) o.name = v; else delete o.name; if (Object.keys(o).length) F[t.dataset.sopname] = o; else delete F[t.dataset.sopname]; ed._set('fraksjoner', Object.keys(F).length ? F : undefined); }, true);
      }
      if (!hh) return '';
      const auto = !(Array.isArray(cc.entities) && cc.entities.length), ids = ider(hh, cc), sw = SWAP.get(cid(ed)), q = (ed.__edQ['sop-q'] || '').trim().toLowerCase();
      const attr = cfgAttr(cc).dager;
      const hits = () => {
        const all = Object.keys(hh.states).filter((id) => id.startsWith('sensor.') && !ids.includes(id));
        const f = q ? all.filter((id) => (id + ' ' + (hh.states[id].attributes.friendly_name || '')).toLowerCase().includes(q)) : all.filter((id) => hh.states[id].attributes[attr] != null || /avfall|s(o|ø)ppel|renovasjon|papir|plast|glass|rest/i.test(id));
        return f.sort().slice(0, 8);
      };
      const search = (target) => `<div class="edsub" data-key="sq-${esc(target)}" style="margin-left:0"><div class="edq">${M.icon('mdi:magnify', 20, 'color:var(--ki-text-mid, #979797)')}<input data-edq="sop-q" value="${esc(ed.__edQ['sop-q'] || '')}" placeholder="Søk etter sensor" autocapitalize="off" autocorrect="off" spellcheck="false"></div>
        ${hits().map((id) => `<button class="edhit" data-a="fn" data-k="${key}" data-op="epick" data-v="${esc(target)}" data-id="${esc(id)}">${M.icon(M.domainIcon(id, hh.states[id]), 20, 'color:var(--ki-text-2, #afafaf)')}<span class="nm"><b>${esc(M.name(hh, id))}</b><i>${esc(id)}${hh.states[id].attributes[attr] != null ? ' · ' + esc(attr) + ' = ' + esc(hh.states[id].attributes[attr]) : ''}</i></span></button>`).join('') || '<div class="small" style="padding:4px 6px">Ingen treff</div>'}</div>`;
      return `<div class="edlist"><div class="small" style="padding:0 6px">${auto ? `Automatisk: alle sensorer med attributtet «${esc(attr)}» (${ids.length} funnet).` : `${ids.length} valgte sensorer.`}</div>
        ${ids.map((id) => { const s = hh.states[id]; return `<div class="edrow" data-key="se-${esc(id)}"><span class="edic">${M.icon(s ? M.domainIcon(id, s) : 'mdi:help-circle-outline', 20)}</span><span class="nm"><b>${esc(s ? M.name(hh, id) : id)}</b><i>${esc(id)}${s ? '' : ' · finnes ikke'}</i></span>
          <button class="ib" data-a="fn" data-k="${key}" data-op="eswap" data-v="${esc(id)}" aria-label="Bytt entitet">${M.icon(sw === id ? 'mdi:close' : 'mdi:swap-horizontal', 20)}</button>
          <button class="ib" data-a="fn" data-k="${key}" data-op="erm" data-v="${esc(id)}" aria-label="Fjern">${M.icon('mdi:minus-circle-outline', 20)}</button></div>${sw === id ? search(id) : ''}`; }).join('')}
        ${sw === '+' ? search('+') : ''}
        <button class="btn" style="height:48px" data-a="fn" data-k="${key}" data-op="eswap" data-v="+">${M.icon(sw === '+' ? 'mdi:close' : 'mdi:plus', 20)}${sw === '+' ? 'Lukk' : 'Legg til fraksjon'}</button>
        ${auto ? '' : `<button class="btn" style="height:44px" data-a="fn" data-k="${key}" data-op="eauto" data-v="">${M.icon('mdi:restore', 18)}Bruk automatisk</button>`}</div>`;
    }, click: (dd, ed) => {
      const hh = ed._hass, cc = ed._config || {}, id = cid(ed), cur = ider(hh, cc);
      if (dd.op === 'eswap') { M.haptic('selection'); ed.__edQ['sop-q'] = ''; if (SWAP.get(id) === dd.v) SWAP.delete(id); else SWAP.set(id, dd.v); return ed._render(); }
      if (dd.op === 'epick') { M.haptic('success'); SWAP.delete(id); ed.__edQ['sop-q'] = ''; const L = dd.v === '+' ? [...cur, dd.id] : cur.map((x) => (x === dd.v ? dd.id : x)); return ed._set('entities', [...new Set(L)]); }
      if (dd.op === 'erm') { M.haptic('selection'); const L = cur.filter((x) => x !== dd.v); return ed._set('entities', L.length ? L : undefined); }
      if (dd.op === 'eauto') { M.haptic('selection'); return ed._set('entities', undefined); }
    } };
    const spacing = M.spacingSchema();
    return [
      { type: 'tabs', id: 'soppel', tabs: [
        { key: 'faner', label: 'Faner', icon: 'mdi:tab', focus: ['faner'], fields: [
          ...(M.startTab ? [M.startTab.field({ items: (hh, cc) => visTabs(cc || {}).map((k) => ({ key: k, label: TABL[k][1], icon: TABL[k][2] })) })] : []), // 36.5: Startfane øverst (felles MSH.startTab)
          { type: 'section', id: 'faner', label: 'Faner', fields: [faner] },
          { type: 'section', id: 'visning', label: 'Visning', fields: [...(M.tabH ? [M.tabH.field({ items: (hh, cc) => visTabs(cc || {}).map((k) => TABL[k][1]), mode: 'tekst', native: 40, gear: false })] : [])] }, // 33.4: fanehøyde
        ] },
        { key: 'fraksjoner', label: 'Fraksjoner', icon: 'mdi:delete-variant', focus: ['fraksjoner'], fields: [{ type: 'section', id: 'fraksjoner', label: 'Fraksjoner', fields: [frak] }] },
        { key: 'entiteter', label: 'Entiteter', icon: 'mdi:database-search-outline', focus: ['entiteter'], fields: [
          { type: 'section', id: 'entiteter', label: 'Sensor per fraksjon', fields: [ent] },
          { type: 'section', id: 'data', label: 'Data', fields: [
            { type: 'text', name: 'dager_attributt', label: 'Attributt for dager', placeholder: 'days_to_pickup' },
            { type: 'text', name: 'dato_attributt', label: 'Attributt for dato', placeholder: 'raw_date' },
            { type: 'number', name: 'intervall_dager', label: 'Intervall (dager) for datoene fram i tid', placeholder: '14', min: 0, max: 90, help: 'Brukes bare når sensoren ikke gir flere datoer selv. Datoene merkes som anslag.' },
            { type: 'entity', name: 'kalender_entitet', label: 'Kalender fra renovasjonsselskapet (valgfri)', domain: 'calendar' },
          ] },
        ] },
        { key: 'avansert', label: 'Avansert', icon: 'mdi:tune-variant', focus: ['avansert', 'spacing'], fields: [
          { type: 'section', id: 'avansert', label: 'Avansert', fields: [
            { type: 'boolean', name: 'soppelbil', label: 'Søppelbil-animasjon på tømmedagen', default: true },
            { type: 'boolean', name: 'haptikk', label: 'Haptikk', default: true },
            { type: 'select', name: 'varseltid', label: 'Standard varseltid', options: TIDER, default: '18:00' },
          ] },
          spacing,
        ] },
      ] },
    ];
  }

  /* ============================================================ kortet */
  class Avfall extends M.Card {
    static get cardName() { return 'Søppel'; }
    static getStubConfig() { return { card_id: M.uid() }; }
    static get schema() { return editorSchema; }
    static get uiPersist() { return ['tab']; }
    get cardSize() { return 9; }
    onOpen() { this.update(); }
    onClose() { this._ui = { ...this._ui, sel: null, day: null, mnd: 0 }; }
    get tab() { const V = visTabs(this.config), t = this.ui.tab || this.config.start_tab; return V.includes(t) ? t : V[0]; }
    static get startTabSpec() { return { tabs: (card) => visTabs(card.config) }; } // 36.5: startfane ved åpning
    _hp(t) { return `data-haptic="${this.config.haptikk === false ? 'off' : t}"`; }
    async _save(patch) {
      const old = this._rawConfig || this.config, n = { ...old, ...patch };
      Object.keys(patch).forEach((k) => { if (patch[k] === undefined) delete n[k]; });
      this.setConfig(n);
      try { const r = await M.saveCardConfig(this.hass, old, n, { card: this }); if (r && r.config) this.setConfig(r.config); } catch (e) { console.warn('[ki-msh] Søppel', e); }
    }
    _data() {
      const c = this.config, h = this.hass;
      const all = fraksjoner(h, c);
      all.forEach((f) => this.s(f.id));
      const vis = all.filter((f) => !f.hidden);
      const kal = c.kalender_entitet && this.isOpen ? hentKalender(h, c.kalender_entitet, () => this.update()) : KAL.get(c.kalender_entitet) ? KAL.get(c.kalender_entitet).list : null;
      const D = datoer(vis, c, kal);
      const per = {};
      D.forEach((x) => { const k = dk(d0(x.dato)); (per[k] = per[k] || []); if (!per[k].some((y) => (y.id && y.id === x.id) || y.navn === x.navn)) per[k].push(x); });
      return { all, vis, D, per };
    }

    render() {
      const c = this.config, Dt = this._data(), t = this.tab, V = visTabs(c);
      const tabs = `<div class="tabs" role="tablist" data-glass-drag="x"${M.tabH && M.tabH.style(c) ? ` style="${M.tabH.style(c)}"` : ''}>${V.map((k) => `<button class="tb ${k === t ? 'on' : ''}" role="tab" aria-selected="${k === t}" data-act="tab" data-v="${k}" ${this._hp('selection')}>${esc(TABL[k][1])}</button>`).join('')}</div>`;
      let body;
      try { body = this['_t_' + t](Dt); } catch (e) { body = this._failHTML(e); }
      return `<div class="wrap">${this._hero(Dt)}${V.length > 1 ? tabs : ''}<div class="pane" data-key="pane-${t}">${body}</div></div>`;
    }

    _hero(Dt) {
      const c = this.config, L = Dt.vis;
      const sel = this.ui.sel && L.find((f) => f.id === this.ui.sel);
      const top = sel || L.find((f) => f.dager !== null) || null;
      const same = top && top.dager !== null ? L.filter((f) => f.dager === top.dager) : top ? [top] : [];
      if (sel) { same.splice(same.indexOf(sel), 1); same.unshift(sel); }
      const d = top ? top.dager : null, idag = d === 0, snart = d === 1;
      const farge = top ? top.farge : C.gray600;
      const bins = (same.length ? same : [{ farge: C.gray500 }]).slice(0, 4).map((f, i) => bin(f.farge, i)).join('');
      const names = top ? og(same.map((f) => f.navn)) : '';
      const car = idag && c.soppelbil !== false ? `<div class="road" aria-hidden="true">${truck()}</div>` : '';
      return `<div class="hero ${idag ? 'idag' : ''} ${snart ? 'snart' : ''}" style="--f:${farge}" data-key="hero" data-ki-island>
        <div class="glow" aria-hidden="true"></div>
        <div class="hl">
          <span class="pill ${idag ? 'on' : ''}"><i class="blink"></i>${idag ? 'Tømmes i dag' : 'Neste tømming'}</span>
          <div class="big num">${esc(tekst(d))}</div>
          ${top ? `<div class="nm">${esc(names)}</div><div class="dt">${esc(datoTxt(top.dato))}</div>` : `<div class="nm miss"><button class="pick press" data-act="customize" data-section="entiteter">${M.icon('mdi:plus', 18)}Velg entitet</button></div>`}
        </div>
        <button class="gear press" data-act="customize" ${this._hp('light')} aria-label="Tilpass Søppel">${M.icon('settings', 22)}</button>
        ${car}
        <div class="bins ${snart ? 'hop' : ''} ${idag ? 'shake' : ''}" aria-hidden="true">${bins}</div>
      </div>`;
    }

    /* ---------------------------------------------------------- Oversikt */
    _t_oversikt(Dt) {
      const c = this.config, L = ordered(Dt.vis, c);
      if (!L.length) return M.emptyState('Fant ingen avfallssensorer (days_to_pickup)', 'entiteter');
      const sel = this.ui.sel;
      const cards = L.map((f) => {
        const iv = f.intervall || Number(c.intervall_dager) || 14;
        const p = f.dager === null ? 0 : M.clamp(1 - f.dager / iv, 0, 1);
        return `<button class="fk press ${sel === f.id ? 'on' : ''} ${f.dager === 0 ? 'idag' : ''}" style="--f:${f.farge}" data-act="sel" data-v="${esc(f.id)}" data-ent="${esc(f.id)}" ${this._hp('selection')} aria-pressed="${sel === f.id}">
          <span class="fi">${M.icon(f.ikon, 22)}</span>
          <span class="fn">${esc(f.navn)}</span>
          <span class="fd num">${esc(kort(f.dager))}</span>
          <span class="fdt">${esc(f.dato ? f.dato.toLocaleDateString('nb-NO', { weekday: 'short', day: 'numeric', month: 'short' }) : '–')}</span>
          <span class="bar"><i style="width:${(p * 100).toFixed(1)}%"></i></span></button>`;
      }).join('');
      const t0 = today(), day = this.ui.day;
      const cells = Array.from({ length: 14 }, (_, i) => {
        const d = new Date(t0.getTime() + i * DAY), k = dk(d), E = Dt.per[k] || [];
        return `<button class="dc ${i === 0 ? 'td' : ''} ${day === k ? 'on' : ''}" data-act="day" data-v="${k}" ${this._hp('selection')} aria-label="${esc(datoTxt(d))}${E.length ? ': ' + esc(og(E.map((x) => x.navn))) : ''}">
          <span class="wd">${WD[(d.getDay() + 6) % 7]}</span><span class="dn num">${d.getDate()}</span><span class="dots">${E.slice(0, 4).map((x) => `<i style="background:${x.farge}"></i>`).join('')}</span></button>`;
      }).join('');
      return `<div class="grid2">${cards}</div>
        <div class="sec"><div class="sh"><span>Neste 14 dager</span></div><div class="days">${cells}</div>${this._dayPanel(Dt, day)}</div>`;
    }
    _dayPanel(Dt, k) {
      if (!k) return '';
      const E = Dt.per[k] || [], [y, m, d] = k.split('-').map(Number), dt = new Date(y, m - 1, d);
      return `<div class="dp" data-key="dp-${k}"><div class="dph">${esc(datoTxt(dt))}</div>${E.length ? E.map((x) => `<div class="dpr"><i style="background:${x.farge}"></i><span>${esc(x.navn)}</span>${x.ekte ? '' : '<em>anslag</em>'}</div>`).join('') : '<div class="dpr none">Ingen tømming</div>'}</div>`;
    }

    /* ---------------------------------------------------------- Kalender */
    _t_kalender(Dt) {
      const off = Number(this.ui.mnd) || 0, t0 = today();
      const vist = new Date(t0.getFullYear(), t0.getMonth() + off, 1);
      const start = new Date(vist); start.setDate(1 - ((vist.getDay() + 6) % 7));
      const day = this.ui.day, cells = [];
      for (let i = 0; i < 42; i++) {
        const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
        if (i >= 35 && d.getMonth() !== vist.getMonth()) break;
        const k = dk(d), E = Dt.per[k] || [], other = d.getMonth() !== vist.getMonth();
        cells.push(`<button class="mc ${other ? 'oth' : ''} ${k === dk(t0) ? 'td' : ''} ${day === k ? 'on' : ''}" data-act="day" data-v="${k}" ${this._hp('selection')}><span class="dn num">${d.getDate()}</span><span class="dots">${E.slice(0, 4).map((x) => (x.ekte ? `<i style="background:${x.farge}"></i>` : `<i class="est" style="box-shadow:inset 0 0 0 1.5px ${x.farge}"></i>`)).join('')}</span></button>`);
      }
      const anslag = Dt.D.some((x) => !x.ekte);
      const legend = Dt.vis.map((f) => `<span class="lg"><i style="background:${f.farge}"></i>${esc(f.navn)}</span>`).join('');
      return `<div class="sec cal"><div class="mh"><button class="nb press" data-act="mnd" data-v="-1" ${this._hp('light')} aria-label="Forrige måned">${M.icon('mdi:chevron-left', 22)}</button><span class="mt">${esc(cap(vist.toLocaleDateString('nb-NO', { month: 'long', year: 'numeric' })))}</span><button class="nb press" data-act="mnd" data-v="1" ${this._hp('light')} aria-label="Neste måned">${M.icon('mdi:chevron-right', 22)}</button></div>
        <div class="wdr">${WD.map((w) => `<span>${w}</span>`).join('')}</div><div class="mg">${cells.join('')}</div>${this._dayPanel(Dt, day)}
        ${legend ? `<div class="lgs">${legend}</div>` : ''}${anslag ? '<div class="note">Hule prikker er anslag fra intervallet, ikke hentet fra renovasjonsselskapet. Velg en kalender i Tilpass for faktiske datoer.</div>' : ''}</div>`;
    }

    /* ---------------------------------------------------------- Varsler */
    _t_varsler(Dt) {
      const c = this.config, L = ordered(Dt.vis, c), V = c.varsler || {}, tid = c.varseltid || '18:00';
      const rows = L.length ? L.map((f) => { const on = !!V[f.id]; return `<button class="vr press" data-act="varsel" data-v="${esc(f.id)}" ${this._hp('selection')} role="switch" aria-checked="${on}"><span class="fi" style="--f:${f.farge}">${M.icon(f.ikon, 22)}</span><span class="vt"><b>${esc(f.navn)}</b><i>${esc(f.dato ? 'Neste: ' + datoTxt(f.dato) : '–')}</i></span><span class="sw ${on ? 'on' : ''}"></span></button>`; }).join('') : M.emptyState('Fant ingen fraksjoner', 'entiteter');
      return `<div class="vl">${rows}</div>
        <div class="sec"><div class="sh"><span>Når</span></div><div class="seg" role="radiogroup" data-glass-drag="x">${TIDER.map(([v, l]) => `<button class="sg ${v === tid ? 'on' : ''}" role="radio" aria-checked="${v === tid}" data-act="tid" data-v="${v}" ${this._hp('selection')}>${esc(l)}</button>`).join('')}</div>
        <div class="note">Varslene sendes av en automasjon/blueprint som leser «varsler» og «varseltid» fra kortets oppsett. Kortet sender ingenting selv.</div></div>`;
    }

    onAction(name, el, ev) {
      const d = el.dataset;
      switch (name) {
        case 'tab': return this.setUI({ tab: d.v, day: null });
        case 'sel': return this.setUI({ sel: this.ui.sel === d.v ? null : d.v });
        case 'day': return this.setUI({ day: this.ui.day === d.v ? null : d.v });
        case 'mnd': return this.setUI({ mnd: (Number(this.ui.mnd) || 0) + Number(d.v), day: null });
        case 'varsel': { const V = { ...(this.config.varsler || {}) }; if (V[d.v]) delete V[d.v]; else V[d.v] = true; return this._save({ varsler: Object.keys(V).length ? V : undefined }); }
        case 'tid': return this._save({ varseltid: d.v });
        default: return super.onAction(name, el, ev);
      }
    }
    afterRender() {
      const R = this.shadowRoot;
      if (M.glassDrag) R.querySelectorAll('.seg').forEach((s) => M.glassDrag(s, { axis: 'x' }));
      // Fiks 28.13: fanelinjen – hold 400 ms + dra = omorganiser (tab_order), sideveis dra = Liquid Glass-valg
      if (M.tabRow) M.tabRow(this, R.querySelector('.tabs[role="tablist"]'), { active: () => this.tab, order: () => tabOrder(this.config), field: 'tab_order' });
    }
    get styles() {
      return `
        :host{display:block;width:100%}
        .wrap,.pane{display:flex;flex-direction:column;gap:var(--msh-gap,8px);min-width:0}
        /* toppkort */
        .hero{position:relative;height:184px;border-radius:28px;background:#2b3039;color:var(--ki-text, var(--white,#fafafa));box-shadow:inset 0 0 0 1px ${WA(0.05)};overflow:hidden;isolation:isolate} /* mørk øy (data-ki-island) */
        .glow{position:absolute;inset:0;z-index:-1;background:radial-gradient(120% 90% at 88% 100%, color-mix(in srgb, var(--f) 42%, transparent), transparent 62%),radial-gradient(70% 60% at 0% 0%, color-mix(in srgb, var(--f) 14%, transparent), transparent 70%);transition:background .5s}
        .hero.idag .glow{background:radial-gradient(130% 100% at 85% 100%, color-mix(in srgb, var(--f) 62%, transparent), transparent 66%),radial-gradient(80% 70% at 0% 0%, color-mix(in srgb, var(--f) 24%, transparent), transparent 70%)}
        .hl{position:absolute;left:18px;top:16px;right:120px;display:flex;flex-direction:column;align-items:flex-start;gap:4px;min-width:0}
        .pill{height:26px;padding:0 11px 0 9px;border-radius:13px;display:inline-flex;align-items:center;gap:7px;font-size:12px;font-weight:500;background:${WA(0.1)};color:var(--ki-text-1, #e1e1e1);white-space:nowrap}
        .pill i{width:8px;height:8px;border-radius:4px;background:var(--f)}
        .pill.on{background:color-mix(in srgb, var(--f) 30%, ${WA(0.08)})}
        .pill.on i{animation:blink 1.1s ease-in-out infinite}
        @keyframes blink{50%{opacity:.15}}
        .big{font-size:36px;font-weight:500;line-height:1.1;letter-spacing:-.02em;margin-top:8px;white-space:nowrap}
        .nm{font-size:15px;font-weight:500;color:var(--ki-text, #fafafa);max-width:100%;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow-wrap:anywhere}
        .nm.miss{display:block;margin-top:4px}
        .dt{font-size:13px;color:var(--ki-text-2, #afafaf);white-space:nowrap}
        .gear{position:absolute;top:16px;right:16px;width:44px;height:44px;border-radius:22px;background:${WA(0.1)};display:grid;place-items:center;z-index:3}
        .bins{position:absolute;right:14px;bottom:10px;display:flex;align-items:flex-end;gap:2px;z-index:2}
        .bin{width:38px;height:46px;overflow:visible}
        .bins.hop .bin{animation:hop 1.6s cubic-bezier(.3,.7,.4,1) infinite;animation-delay:calc(var(--i) * .18s)}
        @keyframes hop{0%,55%,100%{transform:translateY(0)}20%{transform:translateY(-12px)}35%{transform:translateY(0)}45%{transform:translateY(-4px)}}
        .bins.shake .lid{transform-box:fill-box;transform-origin:10% 100%;animation:lid 1.2s ease-in-out infinite;animation-delay:calc(var(--i) * .2s)}
        @keyframes lid{0%,60%,100%{transform:rotate(0)}10%{transform:rotate(-22deg)}20%{transform:rotate(-6deg)}30%{transform:rotate(-18deg)}40%{transform:rotate(0)}}
        .road{position:absolute;left:0;right:0;bottom:6px;height:40px;z-index:1;pointer-events:none;overflow:hidden}
        .truck{position:absolute;bottom:0;left:0;width:96px;height:40px;animation:drive 7s linear infinite}
        .truck .wh{transform-box:fill-box;transform-origin:center}
        @keyframes drive{0%{transform:translateX(-110px)}100%{transform:translateX(calc(100cqw + 20px))}}
        .road{container-type:inline-size}
        /* faner */
        /* 33.4: fanehøyde (MSH.tabH) – pille H (40), sporet H + 8 */
        .tabs{display:flex;gap:2px;padding:4px;border-radius:calc(${TV('th', 40)} / 2 + 4px);background:var(--ki-surface-3, var(--gray200,#3a3a3a));position:relative;touch-action:pan-y}
        .tb{flex:1 1 0;min-width:0;height:${TV('th', 40)};padding:0 ${TV('tp', 8)};border-radius:calc(${TV('th', 40)} / 2);font-size:${TV('tf', 14)};white-space:nowrap;color:var(--ki-text-2, var(--gray800,#afafaf))}
        .tb.on{background:${C.accent};color:${OA};font-weight:500}
        /* Oversikt */
        .grid2{display:grid;grid-template-columns:1fr 1fr;gap:var(--msh-gap,8px)}
        .fk{position:relative;min-width:0;min-height:128px;border-radius:24px;background:var(--ki-surface, var(--gray200,#3a3a3a));box-shadow:inset 0 0 0 1px ${WA(0.05)};padding:14px 14px 20px;display:flex;flex-direction:column;align-items:flex-start;gap:2px;text-align:left;overflow:hidden}
        .fk.on{box-shadow:inset 0 0 0 2px var(--f)}
        .fk .fi,.vr .fi{width:40px;height:40px;border-radius:20px;display:grid;place-items:center;background:color-mix(in srgb, var(--f) 22%, transparent);color:var(--f);margin-bottom:8px;flex:none}
        .fk .fn{font-size:14px;font-weight:500;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .fk .fd{font-size:20px;font-weight:500}
        .fk.idag .fd{color:var(--f)}
        .fk .fdt{font-size:12px;color:var(--ki-text-mid, #979797);white-space:nowrap}
        .bar{position:absolute;left:14px;right:14px;bottom:10px;height:4px;border-radius:2px;background:var(--ki-surface-3, rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.08*var(--ki-wa-k,1)),var(--ki-wa-max,1))));overflow:hidden}
        .bar i{display:block;height:100%;border-radius:2px;background:var(--f)}
        .sec{border-radius:24px;background:var(--ki-surface, var(--gray200,#3a3a3a));box-shadow:inset 0 0 0 1px ${WA(0.05)};padding:14px;display:flex;flex-direction:column;gap:10px;min-width:0}
        .sh{font-size:13px;font-weight:500;color:var(--ki-text-2, #afafaf)}
        .days{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px}
        .dc,.mc{min-width:0;height:62px;border-radius:18px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;background:var(--ki-surface-2, var(--gray300,#404040))}
        .dc .wd{font-size:11px;color:var(--ki-text-mid, #979797)}
        .dc .dn,.mc .dn{font-size:15px;font-weight:500}
        .dc.td,.mc.td{background:${C.accent};color:${OA}}.dc.td .wd{color:${OA}}
        .dc.on,.mc.on{box-shadow:inset 0 0 0 2px var(--ki-text, #fafafa)}
        .dots{display:flex;gap:3px;height:7px}
        .dots i{width:7px;height:7px;border-radius:4px}
        .dots i.est{background:transparent}
        .dp{border-radius:18px;background:var(--ki-surface-2, var(--gray300,#404040));padding:10px 12px;display:flex;flex-direction:column;gap:6px}
        .dph{font-size:13px;font-weight:500}
        .dpr{display:flex;align-items:center;gap:8px;font-size:13px}.dpr i{width:10px;height:10px;border-radius:5px;flex:none}
        .dpr em{font-style:normal;font-size:11px;color:var(--ki-text-mid, #979797);margin-left:auto}.dpr.none{color:var(--ki-text-mid, #979797)}
        /* Kalender */
        .mh{display:flex;align-items:center;gap:8px}.mh .mt{flex:1;text-align:center;font-size:15px;font-weight:500}
        .nb{width:40px;height:40px;border-radius:20px;background:var(--ki-surface-2, var(--gray300,#404040));display:grid;place-items:center}
        .wdr{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));font-size:11px;color:var(--ki-text-mid, #979797);text-align:center}
        .mg{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px}
        .mc{height:48px;background:transparent}.mc.oth{opacity:.35}
        .lgs{display:flex;flex-wrap:wrap;gap:6px 12px}.lg{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--ki-text-2, #afafaf)}.lg i{width:9px;height:9px;border-radius:5px}
        .note{font-size:12px;color:var(--ki-text-mid, #979797);line-height:1.4}
        /* Varsler */
        .vl{display:flex;flex-direction:column;gap:var(--msh-gap,8px)}
        .vr{display:flex;align-items:center;gap:12px;min-height:66px;border-radius:33px;background:var(--ki-surface, var(--gray200,#3a3a3a));padding:8px 16px 8px 10px;text-align:left}
        .vr .fi{margin:0}
        .vt{flex:1;min-width:0;display:flex;flex-direction:column}.vt b{font-size:15px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.vt i{font-style:normal;font-size:12px;color:var(--ki-text-mid, #979797);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .sw{position:relative;width:44px;height:26px;border-radius:13px;background:var(--ki-ctrl, var(--gray400,#545454));flex:none;transition:background .2s}
        .sw::after{content:'';position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:10px;background:var(--ki-knob, #fafafa);transition:transform .2s cubic-bezier(.34,1.4,.64,1)}
        .sw.on{background:var(--pink,#f285c9)}.sw.on::after{transform:translateX(18px)}
        .seg{display:flex;gap:2px;padding:4px;border-radius:22px;background:var(--ki-surface-3, #282828);touch-action:pan-y}
        .sg{flex:1 1 0;min-width:0;height:38px;border-radius:19px;font-size:13px;white-space:nowrap;color:var(--ki-text-2, #afafaf);padding:0 4px}
        .sg.on{background:${C.accent};color:${OA};font-weight:500}
        @media (max-width:380px){.sg{font-size:12px}.big{font-size:32px}}
        @media (prefers-reduced-motion: reduce){.bins .bin,.bins .lid,.truck,.pill.on i{animation:none !important}}`;
    }
  }
  M.define('msh-avfall-card', Avfall, 'MSH Søppel', 'Søppel-popupen (#soppel): neste tømming med søppelbil, fraksjoner, kalender og varsler (fiks 25.4).');
})();
