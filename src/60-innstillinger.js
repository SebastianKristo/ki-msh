/* KI MSH · Innstillinger (#innstillinger, msh-innstillinger-card) – fiks 25.5, etter prompt-teksten «Innstillinger v2»
 * (designfila finnes ikke i repoet). Étt kort i Bubble-popupen #innstillinger (mal A).
 *
 * Forholdet til #settings: #settings (msh-settings-card i 03-editors.js) er dashbordets egne innstillinger – snarveier til
 * Tilpass Hjem/navbar/header, HA-innstillinger, Liquid Glass-tema og Enheter (eget oppsett per enhet for Kamera/Person).
 * Brukerens importerte ki-cards-popup «Innstillinger» (examples/innstillinger-popup.yaml i ki-cards) bruker også
 * hash #settings og vinner der som egen popup. Den nye popupen legges derfor på en EGEN hash, #innstillinger, ved siden
 * av: ingenting i #settings (eller den importerte popupen) endres eller skjules, og lenker/navbar-knapper som peker på
 * #settings virker som før. Brukeren kan peke navbaren/«Mer» på #innstillinger når hun vil.
 *
 * Autokonfig (ingen mock – «–» + «Velg entitet» når noe mangler):
 *   Automasjoner: alle automation.* (unntatt de som hører til Varsler/Strøm), gruppert etter område → etikett
 *   Varsler: input_boolean.* med varsel/notify i id-en eller etiketten «Varsler» · automation.* med push/varsel/notify i
 *     id-en eller etiketten «Varsler» (brukerens automation.push_automation* sto under Varsler i ki-cards-oppsettet)
 *   Strøm: input_boolean.* / automation.* med etiketten «Strøm»/«Energi»
 *   Tittel = friendly_name · undertekst = description (automasjon) eller «–» · ikon = icon-attributt → mdi:robot/bell/flash
 *   Natt/privat: input_boolean.nattmodus / input_boolean.privatmodus (ellers switch.* med samme navn) · vekking:
 *     input_datetime.vekking (ellers skjules linjen). Overstyres i Tilpass → Entiteter (natt, privat, vekking).
 *   Etiketter: hass.entities[id].labels (+ navn fra config/label_registry/list, én gang).
 * Utseende:
 *   Toppkort (utelates aldri): nattmodus av → to kort side om side (164 px, r28): Nattmodus (mørkeblå, stjerner, måne og hus
 *   med lysende vinduer) og Privatmodus (grønn gradient + glød når på, #3a3a3a når av). Trykk = av/på.
 *   Nattmodus på → toppkort 184 px med dag/natt-scene (sol/måne, fugler, røyk, lysende vinduer, rød kamera-prikk når
 *   privatmodus er av), «God natt», «Vekking kl. 07:00» og chipsene Natt/Privat nederst.
 *   `scene`: auto (følg nattmodus) · dag (alltid scene med dag) · natt (alltid scene med natt).
 *   Faner (Liquid Glass) + 56 px tannhjul (#3a3a3a) → «Tilpass Innstillinger». Søkefelt, «N av M på» + «Slå alle av/på».
 *   Hver rad er et eget pillekort (#3a3a3a, r34, min 66, 8 px mellom): 58 px ikonsirkel (#4a4a4a), tittel 15/500,
 *   undertekst 12 og bryter. Av: ikon + undertekst rødt med «Av · …». Trykk = homeassistant.toggle.
 * Config:
 *   natt · privat · vekking · tab_order · tab_hidden · tab_names: { fane: navn } · tab_labels (name|icon) · start_tab
 *   include: { fane: [id …] } · exclude: { fane: [id …] } · row_order: { fane: [id …] }
 *   sok (true) · av_forst (false) · haptikk (true) · scene (auto|dag|natt) · gap · pad_top · pad_bottom
 * «Tilpass Innstillinger» (kortets ark og GUI-editoren, samme skjema): Faner · Rader · Entiteter · Avansert (fiks 25.6).
 */
(function () {
  const M = window.MSH;
  if (!M) return;
  const esc = M.esc, C = M.C;

  const TABS = [['automasjoner', 'Automasjoner', 'mdi:robot'], ['varsler', 'Varsler', 'mdi:bell'], ['strom', 'Strøm', 'mdi:flash']];
  const TABL = Object.fromEntries(TABS.map((t) => [t[0], t]));
  const edOrder = (keys, saved) => { const o = (Array.isArray(saved) ? saved : []).filter((k) => keys.includes(k)); keys.forEach((k) => { if (!o.includes(k)) o.push(k); }); return o; };
  const tabOrder = (c) => edOrder(TABS.map((t) => t[0]), c.tab_order);
  const tabHidden = (c) => new Set(Array.isArray(c.tab_hidden) ? c.tab_hidden : []);
  const visTabs = (c) => { const hid = tabHidden(c); const o = tabOrder(c).filter((k) => !hid.has(k)); return o.length ? o : ['automasjoner']; };
  const tabName = (c, k) => ((c.tab_names || {})[k] || TABL[k][1]);

  /* ============================================================ etiketter */
  let LAB = null, labBusy = false;
  const labWait = new Set();
  function labelReg(h) {
    if (h && h.labels && typeof h.labels === 'object') return h.labels;
    if (!LAB && !labBusy && h && h.callWS) {
      labBusy = true;
      h.callWS({ type: 'config/label_registry/list' }).then((r) => { LAB = {}; (Array.isArray(r) ? r : []).forEach((l) => { if (l && l.label_id) LAB[l.label_id] = l; }); })
        .catch(() => { LAB = {}; }).finally(() => { labBusy = false; labWait.forEach((c) => c.isConnected && c.update()); labWait.clear(); });
    }
    return LAB || {};
  }
  const norm = (s) => String(s || '').toLowerCase().replace(/ø/g, 'o').replace(/æ/g, 'ae').replace(/å/g, 'a');
  function labelsOf(h, id) {
    const e = h && h.entities && h.entities[id];
    const L = (e && Array.isArray(e.labels) ? e.labels : []), R = labelReg(h);
    return L.map((l) => ({ id: l, name: (R[l] && R[l].name) || l }));
  }
  const hasLabel = (h, id, re) => labelsOf(h, id).some((l) => re.test(norm(l.id)) || re.test(norm(l.name)));
  const RE_VARSEL = /^(varsler|varsel|varslinger|notify|notifications?)$/;
  const RE_STROM = /^(strom|energi|energy|power)$/;

  /* ============================================================ autokonfig */
  const pickFirst = (h, ids) => ids.find((id) => h && h.states[id]) || null;
  const byName = (h, doms, re) => Object.keys((h && h.states) || {}).filter((id) => doms.includes(id.split('.')[0]) && re.test(id)).sort()[0] || null;
  function ents(h, c) {
    const natt = c.natt || pickFirst(h, ['input_boolean.nattmodus', 'switch.nattmodus']) || byName(h, ['input_boolean', 'switch'], /\.(ki_)?nattmodus/);
    const privat = c.privat || pickFirst(h, ['input_boolean.privatmodus', 'switch.privatmodus']) || byName(h, ['input_boolean', 'switch'], /\.(ki_)?privatmodus/);
    const vekking = c.vekking || pickFirst(h, ['input_datetime.vekking']);
    return { natt, privat, vekking };
  }
  M.innstEntities = ents;
  // Automatiske rader per fane
  function autoRows(h, c) {
    const E = ents(h, c), skip = new Set([E.natt, E.privat].filter(Boolean));
    const ids = Object.keys((h && h.states) || {}).filter((id) => !skip.has(id) && M.usable(h, id)).sort();
    const dom = (id) => id.split('.')[0];
    const strom = ids.filter((id) => ['input_boolean', 'automation'].includes(dom(id)) && hasLabel(h, id, RE_STROM));
    const sS = new Set(strom);
    const varsler = ids.filter((id) => !sS.has(id) && ((dom(id) === 'input_boolean' && (/varsel|notify/.test(id) || hasLabel(h, id, RE_VARSEL))) || (dom(id) === 'automation' && (/push|varsel|notify/.test(id) || hasLabel(h, id, RE_VARSEL)))));
    const vS = new Set(varsler);
    const automasjoner = ids.filter((id) => dom(id) === 'automation' && !sS.has(id) && !vS.has(id));
    return { automasjoner, varsler, strom };
  }
  M.innstAutoRows = autoRows;
  // Radene i en fane: auto + include − exclude, i lagret rekkefølge (row_order) – ellers gruppert og alfabetisk
  function rowsOf(h, c, tab, opts) {
    const A = autoRows(h, c)[tab] || [], inc = ((c.include || {})[tab] || []).filter((id) => h && h.states[id]);
    const exc = new Set((c.exclude || {})[tab] || []);
    const all = [...new Set([...A, ...inc])];
    const list = (opts && opts.withHidden) ? all : all.filter((id) => !exc.has(id));
    const RO = (c.row_order || {})[tab];
    if (Array.isArray(RO) && RO.length) return { list: edOrder(list, RO), grouped: false, exc };
    const grp = (id) => { const a = M.areaOf(h, id); if (a) return M.areaName(h, a); const l = labelsOf(h, id)[0]; return l ? l.name : ''; };
    const nm = (id) => M.name(h, id).toLowerCase();
    const sorted = list.slice().sort((x, y) => { const gx = grp(x), gy = grp(y); if (gx !== gy) return !gx ? 1 : !gy ? -1 : gx.localeCompare(gy, 'nb'); return nm(x).localeCompare(nm(y), 'nb'); });
    return { list: sorted, grouped: new Set(sorted.map(grp)).size > 1, grp, exc };
  }
  M.innstRows = rowsOf;
  const DEF_ICON = { automasjoner: 'mdi:robot', varsler: 'mdi:bell', strom: 'mdi:flash' };
  const isOn = (s) => !!s && s.state === 'on';
  const tidOf = (s) => {
    if (!s || M.unavailable(s)) return null;
    const v = String(s.state);
    let m = /(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(v);
    if (m && !/T/.test(v)) return `${M.pad(m[1])}:${m[2]}`;
    const d = new Date(v);
    return isNaN(d) ? null : `${M.pad(d.getHours())}:${M.pad(d.getMinutes())}`;
  };

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

  /* ============================================================ editoren (Tilpass Innstillinger + GUI) */
  const cid = (ed) => ((ed && ed._config && ed._config.card_id) || '_');
  const EXP = new Map(), RT = new Map(), ADD = new Set();
  function editorSchema() {
    const kit = (ed) => { if (M.edKit) M.edKit(ed); ed.__edDrop = ed.__edDrop || {}; ed.__edQ = ed.__edQ || {}; };
    const handle = () => (M.edHandle ? M.edHandle() : '');
    const eye = (key, op, v, hid, label) => (M.edEye ? M.edEye(key, op, v, hid, label) : '');
    const faner = { type: 'html', html: (hh, cc, key, ed) => {
      kit(ed);
      ed.__edDrop['inn-tab'] = (o) => ed._set('tab_order', o);
      if (!ed.__innName) {
        ed.__innName = true;
        ed.shadowRoot.addEventListener('change', (e) => { const t = e.target; if (!t.dataset || t.dataset.innname == null) return; e.stopPropagation(); const N = { ...((ed._config || {}).tab_names || {}) }; const v = t.value.trim(); if (v) N[t.dataset.innname] = v; else delete N[t.dataset.innname]; ed._set('tab_names', Object.keys(N).length ? N : undefined); }, true);
      }
      const hid = tabHidden(cc), open = EXP.get(cid(ed));
      return `<div class="edlist">${tabOrder(cc).map((k) => {
        const [, label, icon] = TABL[k], n = hh ? rowsOf(hh, cc, k).list.length : 0, isO = open === k;
        return `<div class="edrow ${hid.has(k) ? 'off' : ''}" data-edk="${k}" data-elist="inn-tab" data-key="it-${k}">${handle()}<span class="edic">${M.icon(icon, 20)}</span><span class="nm"><b>${esc(tabName(cc, k))}</b><i>${n} ${n === 1 ? 'rad' : 'rader'}${(cc.tab_names || {})[k] ? ' · ' + esc(label) : ''}</i></span>
          <button class="ib" data-a="fn" data-k="${key}" data-op="texp" data-v="${k}" aria-expanded="${isO}" aria-label="Gi nytt navn">${M.icon(isO ? 'mdi:chevron-up' : 'mdi:pencil-outline', 20)}</button>${eye(key, 'teye', k, hid.has(k), label)}</div>
          ${isO ? `<div class="edsub" data-key="its-${k}"><span style="font-size:12px;color:#afafaf">Navn</span><div class="edq"><input data-innname="${k}" value="${esc((cc.tab_names || {})[k] || '')}" placeholder="${esc(label)}" autocapitalize="off" autocorrect="off" spellcheck="false"></div></div>` : ''}`;
      }).join('')}<span class="help" style="font-size:11px;color:#7f7f7f;padding:0 6px">Dra for rekkefølge, blyanten gir fanen nytt navn, øyet skjuler. Minst én fane må være synlig.</span></div>`;
    }, click: (dd, ed) => {
      const cc = ed._config || {}, id = cid(ed);
      if (dd.op === 'texp') { M.haptic('selection'); if (EXP.get(id) === dd.v) EXP.delete(id); else EXP.set(id, dd.v); return ed._render(); }
      if (dd.op === 'teye') {
        const hid = tabHidden(cc);
        if (!hid.has(dd.v) && TABS.filter((t) => !hid.has(t[0])).length <= 1) { M.haptic('warning'); M.toast('Minst én fane må være synlig'); return; }
        if (hid.has(dd.v)) hid.delete(dd.v); else hid.add(dd.v);
        M.haptic('selection'); return ed._set('tab_hidden', hid.size ? [...hid] : undefined);
      }
    } };
    // Rader per fane: undersegment (fane), rader med dra + øye (exclude), egne rader (include) med fjern, «Legg til rad» med søk
    const rader = { type: 'html', html: (hh, cc, key, ed) => {
      kit(ed);
      if (!hh) return '';
      const id = cid(ed), tab = RT.get(id) || visTabs(cc)[0];
      ed.__edDrop['inn-row'] = (o) => ed._set('row_order', { ...(cc.row_order || {}), [tab]: o });
      const R = rowsOf(hh, cc, tab, { withHidden: true }), inc = new Set((cc.include || {})[tab] || []), auto = new Set(autoRows(hh, cc)[tab] || []);
      const seg = `<div class="chips sg tsub" role="tablist">${tabOrder(cc).map((k) => `<button class="chip ${k === tab ? 'on' : ''}" role="tab" aria-selected="${k === tab}" data-a="fn" data-k="${key}" data-op="rtab" data-v="${k}">${esc(tabName(cc, k))}</button>`).join('')}</div>`;
      const rows = R.list.map((rid) => { const s = hh.states[rid], hid = R.exc.has(rid), own = inc.has(rid) && !auto.has(rid); return `<div class="edrow ${hid ? 'off' : ''}" data-edk="${esc(rid)}" data-elist="inn-row" data-key="ir-${esc(rid)}">${handle()}<span class="edic">${M.icon((s && s.attributes.icon) || DEF_ICON[tab], 20)}</span><span class="nm"><b>${esc(M.name(hh, rid))}</b><i>${esc(rid)}${own ? ' · lagt til' : ''}</i></span>${own ? `<button class="ib" data-a="fn" data-k="${key}" data-op="rrm" data-v="${esc(rid)}" aria-label="Fjern">${M.icon('mdi:minus-circle-outline', 20)}</button>` : eye(key, 'reye', rid, hid, M.name(hh, rid))}</div>`; }).join('');
      const q = (ed.__edQ['inn-q'] || '').trim().toLowerCase(), have = new Set(R.list);
      const hits = ADD.has(id) ? Object.keys(hh.states).filter((x) => ['automation', 'input_boolean', 'switch', 'script'].includes(x.split('.')[0]) && !have.has(x) && (!q || (x + ' ' + (hh.states[x].attributes.friendly_name || '')).toLowerCase().includes(q))).sort().slice(0, 8) : [];
      const add = ADD.has(id) ? `<div class="edsub" style="margin-left:0" data-key="iadd"><div class="edq">${M.icon('mdi:magnify', 20, 'color:#979797')}<input data-edq="inn-q" value="${esc(ed.__edQ['inn-q'] || '')}" placeholder="Søk etter automasjon eller bryter" autocapitalize="off" autocorrect="off" spellcheck="false"></div>
        ${hits.map((x) => `<button class="edhit" data-a="fn" data-k="${key}" data-op="radd" data-v="${esc(x)}">${M.icon(M.domainIcon(x, hh.states[x]), 20, 'color:#afafaf')}<span class="nm"><b>${esc(M.name(hh, x))}</b><i>${esc(x)}</i></span></button>`).join('') || '<div class="small" style="padding:4px 6px">Ingen treff</div>'}</div>` : '';
      return `<div class="edlist">${seg}${rows || '<div class="small" style="padding:0 6px">Ingen rader i denne fanen ennå.</div>'}${add}
        <button class="btn" style="height:48px" data-a="fn" data-k="${key}" data-op="radd-open" data-v="">${M.icon(ADD.has(id) ? 'mdi:close' : 'mdi:plus', 20)}${ADD.has(id) ? 'Lukk' : 'Legg til rad'}</button>
        ${(cc.row_order || {})[tab] ? `<button class="btn" style="height:44px" data-a="fn" data-k="${key}" data-op="rsort" data-v="">${M.icon('mdi:sort-alphabetical-ascending', 18)}Automatisk rekkefølge</button>` : ''}
        <span class="help" style="font-size:11px;color:#7f7f7f;padding:0 6px">Dra for rekkefølge, øyet skjuler raden (exclude). Rader du legger til lagres som include.</span></div>`;
    }, click: (dd, ed) => {
      const cc = ed._config || {}, id = cid(ed), tab = RT.get(id) || visTabs(cc)[0];
      const setL = (k, fn) => { const O = { ...(cc[k] || {}) }; const L = fn(new Set(O[tab] || [])); if (L.size) O[tab] = [...L]; else delete O[tab]; ed._set(k, Object.keys(O).length ? O : undefined); };
      if (dd.op === 'rtab') { M.haptic('selection'); RT.set(id, dd.v); return ed._render(); }
      if (dd.op === 'reye') { M.haptic('selection'); return setL('exclude', (s) => { if (s.has(dd.v)) s.delete(dd.v); else s.add(dd.v); return s; }); }
      if (dd.op === 'rrm') { M.haptic('selection'); return setL('include', (s) => { s.delete(dd.v); return s; }); }
      if (dd.op === 'radd-open') { M.haptic('selection'); ed.__edQ['inn-q'] = ''; if (ADD.has(id)) ADD.delete(id); else ADD.add(id); return ed._render(); }
      if (dd.op === 'radd') { M.haptic('success'); ed.__edQ['inn-q'] = ''; return setL('include', (s) => s.add(dd.v)); }
      if (dd.op === 'rsort') { M.haptic('selection'); const O = { ...(cc.row_order || {}) }; delete O[tab]; return ed._set('row_order', Object.keys(O).length ? O : undefined); }
    } };
    const auto = (k) => (hh, cc) => ents(hh, { ...cc, [k]: undefined })[k];
    return [
      { type: 'tabs', id: 'innstillinger', tabs: [
        { key: 'faner', label: 'Faner', icon: 'mdi:tab', focus: ['faner'], fields: [
          { type: 'section', id: 'faner', label: 'Faner', fields: [faner] },
          { type: 'section', id: 'visning', label: 'Visning', fields: [
            { type: 'select', name: 'tab_labels', label: 'Faner viser', options: [['name', 'Navn'], ['icon', 'Ikon og navn']], default: 'name' },
            { type: 'select', name: 'start_tab', label: 'Startfane', options: TABS.map((t) => [t[0], t[1]]), default: 'automasjoner' },
          ] },
        ] },
        { key: 'rader', label: 'Rader', icon: 'mdi:format-list-bulleted', focus: ['rader'], fields: [{ type: 'section', id: 'rader', label: 'Rader per fane', fields: [rader] }] },
        { key: 'entiteter', label: 'Entiteter', icon: 'mdi:database-search-outline', focus: ['entiteter'], fields: [{ type: 'section', id: 'entiteter', label: 'Toppkortet', fields: [
          { type: 'entity', name: 'natt', label: 'Nattmodus', domain: ['input_boolean', 'switch'], auto: auto('natt') },
          { type: 'entity', name: 'privat', label: 'Privatmodus', domain: ['input_boolean', 'switch'], auto: auto('privat') },
          { type: 'entity', name: 'vekking', label: 'Vekking (tom = linjen skjules)', domain: ['input_datetime', 'sensor'], auto: auto('vekking') },
        ] }] },
        { key: 'avansert', label: 'Avansert', icon: 'mdi:tune-variant', focus: ['avansert', 'spacing'], fields: [
          { type: 'section', id: 'avansert', label: 'Avansert', fields: [
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
    static getStubConfig() { return { card_id: M.uid() }; }
    static get schema() { return editorSchema; }
    static get uiPersist() { return ['tab']; }
    get cardSize() { return 9; }
    connectedCallback() { super.connectedCallback(); labWait.add(this); }
    onClose() { this._ui = { ...this._ui, q: '' }; }
    get tab() { const V = visTabs(this.config), t = this.ui.tab || this.config.start_tab; return V.includes(t) ? t : V[0]; }
    _hp(t) { return `data-haptic="${this.config.haptikk === false ? 'off' : t}"`; }

    render() {
      const c = this.config, h = this.hass, E = ents(h, c);
      const nS = this.s(E.natt), pS = this.s(E.privat), vS = this.s(E.vekking);
      if (!LAB && h) { labelReg(h); if (!LAB) labWait.add(this); }
      const mode = c.scene === 'dag' || c.scene === 'natt' ? c.scene : 'auto';
      const scene = mode !== 'auto' || isOn(nS);
      const top = scene ? this._scene(E, nS, pS, vS, mode === 'dag' ? 'dag' : 'natt') : this._split(E, nS, pS);
      const V = visTabs(c), t = this.tab, icons = c.tab_labels === 'icon';
      const tabs = `<div class="bar"><div class="tabs" role="tablist" data-glass-drag="x">${V.map((k) => `<button class="tb ${k === t ? 'on' : ''}" role="tab" aria-selected="${k === t}" data-act="tab" data-v="${k}" ${this._hp('selection')}>${icons ? M.icon(TABL[k][2], 18) : ''}<span>${esc(tabName(c, k))}</span></button>`).join('')}</div>
        <button class="gear press" data-act="customize" ${this._hp('light')} aria-label="Tilpass Innstillinger">${M.icon('settings', 24)}</button></div>`;
      return `<div class="wrap">${top}${tabs}<div class="pane" data-key="pane-${t}">${this._list(t)}</div></div>`;
    }
    _pickBtn() { return `<button class="pick press" data-act="customize" data-section="entiteter" ${this._hp('light')}>${M.icon('mdi:plus', 16)}Velg entitet</button>`; }
    // Nattmodus av: to kort side om side
    _split(E, nS, pS) {
      const nOn = isOn(nS), pOn = isOn(pS);
      const natt = `<div class="mk natt press" ${E.natt ? `data-act="tg" data-id="${esc(E.natt)}" data-ent="${esc(E.natt)}" role="switch" aria-checked="${nOn}" ${this._hp('selection')}` : ''}>
        <svg class="sky" viewBox="0 0 170 90" preserveAspectRatio="xMaxYMin slice" aria-hidden="true">${stars(14, 170, 60, 7)}<circle cx="140" cy="22" r="11" fill="#f2e6b8"/><circle cx="145" cy="18" r="10" fill="#1c2644"/>${house(100, 40, true, false)}</svg>
        <span class="mt">Nattmodus</span>
        <span class="mc"><span class="ci">${M.icon('mdi:power-sleep', 24)}</span></span>
        <span class="mv num">${nS ? (nOn ? 'På' : 'Av') : '–'}</span>
        ${nS ? `<span class="sw ${nOn ? 'on' : ''}"></span>` : this._pickBtn()}</div>`;
      const priv = `<div class="mk priv ${pOn ? 'on' : ''} press" ${E.privat ? `data-act="tg" data-id="${esc(E.privat)}" data-ent="${esc(E.privat)}" role="switch" aria-checked="${pOn}" ${this._hp('selection')}` : ''}>
        <span class="glw" aria-hidden="true"></span>
        <span class="mt">Privatmodus</span>
        <span class="mc"><span class="ci">${M.icon(pOn ? 'mdi:cctv-off' : 'mdi:cctv', 24)}</span><span class="ci sm">${M.icon(pOn ? 'mdi:lock' : 'mdi:lock-open-variant-outline', 18)}</span></span>
        <span class="ms">${pS ? (pOn ? 'Kameraene er av' : 'Kameraene er på') : '–'}</span>
        <span class="mv num">${pS ? (pOn ? 'På' : 'Av') : '–'}</span>
        ${pS ? `<span class="sw ${pOn ? 'on' : ''}"></span>` : this._pickBtn()}</div>`;
      return `<div class="two" data-key="top-split">${natt}${priv}</div>`;
    }
    // Nattmodus på (eller fast scene): toppkort 184 px
    _scene(E, nS, pS, vS, sky) {
      const nOn = isOn(nS), pOn = isOn(pS), night = sky === 'natt', tid = tidOf(vS);
      const art = night
        ? `${stars(26, 400, 110, 3)}<circle cx="300" cy="40" r="17" fill="#f2e6b8"/><circle cx="308" cy="34" r="15" fill="#15203b"/>`
        : `<circle class="sun" cx="300" cy="44" r="20" fill="#f2d26f"/><circle cx="300" cy="44" r="30" fill="rgba(242,210,111,.25)"/><g transform="translate(236 22)">${birds()}</g>`;
      const chip = (id, s, label, icon) => (id ? `<button class="chip ${isOn(s) ? 'on' : ''} press" data-act="tg" data-id="${esc(id)}" ${this._hp('selection')} role="switch" aria-checked="${isOn(s)}">${M.icon(icon, 16)}${esc(label)} · ${s ? (isOn(s) ? 'på' : 'av') : '–'}</button>`
        : `<button class="chip miss press" data-act="customize" data-section="entiteter" ${this._hp('light')}>${M.icon(icon, 16)}${esc(label)} · Velg entitet</button>`);
      return `<div class="scene ${night ? 'night' : 'day'}" data-key="top-scene">
        <svg class="art" viewBox="0 0 400 184" preserveAspectRatio="xMaxYMid slice" aria-hidden="true">${art}
          <rect x="0" y="160" width="400" height="24" fill="${night ? '#141c33' : '#6e9f63'}"/>${house(300, 92, night, !pOn)}</svg>
        <div class="stx"><span class="gt">${night ? (nOn ? 'God natt' : 'Natt') : nOn ? 'Nattmodus på' : 'God dag'}</span>${tid ? `<span class="vk">${M.icon('mdi:alarm', 16)}Vekking kl. ${esc(tid)}</span>` : ''}</div>
        <div class="chips">${chip(E.natt, nS, 'Natt', 'mdi:power-sleep')}${chip(E.privat, pS, 'Privat', 'mdi:cctv-off')}</div></div>`;
    }
    _list(tab) {
      const c = this.config, h = this.hass, R = rowsOf(h, c, tab);
      R.list.forEach((id) => this.s(id));
      const q = (this.ui.q || '').trim().toLowerCase();
      let L = q ? R.list.filter((id) => (id + ' ' + M.name(h, id)).toLowerCase().includes(q)) : R.list;
      if (c.av_forst) L = [...L.filter((id) => !isOn(h.states[id])), ...L.filter((id) => isOn(h.states[id]))];
      const on = L.filter((id) => isOn(h.states[id])).length, allOn = L.length && on === L.length;
      const search = c.sok !== false ? `<label class="srch">${M.icon('mdi:magnify', 20, 'color:#979797')}<input data-input="q" data-key="q" value="${esc(this.ui.q || '')}" placeholder="Søk i ${esc(tabName(c, tab).toLowerCase())}" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="search">${this.ui.q ? `<button class="clr" data-act="qclr" ${this._hp('light')} aria-label="Tøm søk">${M.icon('mdi:close', 18)}</button>` : ''}</label>` : '';
      if (!R.list.length) return `${search}${M.emptyState(tab === 'automasjoner' ? 'Fant ingen automasjoner' : tab === 'varsler' ? 'Fant ingen varsler (input_boolean med varsel/notify eller etiketten «Varsler»)' : 'Fant ingen brytere med etiketten «Strøm»/«Energi»', 'rader')}`;
      const head = `<div class="cnt"><span class="num">${on} av ${L.length} på</span><button class="all press" data-act="all" data-v="${allOn ? 'off' : 'on'}" ${this._hp('medium')}>${allOn ? 'Slå alle av' : 'Slå alle på'}</button></div>`;
      let last = null;
      const rows = L.map((id) => {
        let hd = '';
        if (R.grouped && !q && !c.av_forst) { const g = R.grp(id) || 'Andre'; if (g !== last) { last = g; hd = `<div class="gh">${esc(g)}</div>`; } }
        const s = h.states[id], o = isOn(s), un = M.unavailable(s);
        const sub = un ? 'Utilgjengelig' : (id.startsWith('automation.') && s.attributes.description) || '–';
        return `${hd}<button class="pr press ${o ? '' : 'off'}" data-act="tg" data-id="${esc(id)}" data-ent="${esc(id)}" role="switch" aria-checked="${o}" ${this._hp('selection')} ${un ? 'disabled' : ''}>
          <span class="pi">${M.icon(s.attributes.icon || DEF_ICON[tab], 26)}</span>
          <span class="pt"><b>${esc(M.name(h, id))}</b><i>${o ? esc(sub) : 'Av · ' + esc(sub)}</i></span>
          <span class="sw ${o ? 'on' : ''}"></span></button>`;
      }).join('');
      return `${search}${head}<div class="rows">${rows || '<div class="none">Ingen treff</div>'}</div>`;
    }
    onInput(name, el) { if (name === 'q') this.setUI({ q: el.value }); }
    onAction(name, el, ev) {
      const d = el.dataset;
      switch (name) {
        case 'tab': return this.setUI({ tab: d.v });
        case 'tg': return d.id ? M.call(this.hass, 'homeassistant', 'toggle', { entity_id: d.id }) : undefined;
        case 'qclr': return this.setUI({ q: '' });
        case 'all': {
          const c = this.config, h = this.hass, q = (this.ui.q || '').trim().toLowerCase();
          const L = rowsOf(h, c, this.tab).list.filter((id) => !M.unavailable(h.states[id]) && (!q || (id + ' ' + M.name(h, id)).toLowerCase().includes(q)));
          if (L.length) return M.call(h, 'homeassistant', d.v === 'off' ? 'turn_off' : 'turn_on', { entity_id: L });
          return undefined;
        }
        default: return super.onAction(name, el, ev);
      }
    }
    afterRender() { if (M.glassDrag) this.shadowRoot.querySelectorAll('.tabs').forEach((s) => M.glassDrag(s, { axis: 'x' })); }
    get styles() {
      return `
        :host{display:block;width:100%}
        .wrap,.pane{display:flex;flex-direction:column;gap:var(--msh-gap,8px);min-width:0}
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
        .ci{width:44px;height:44px;border-radius:22px;display:grid;place-items:center;background:rgba(255,255,255,.14);flex:none}
        .ci.sm{width:32px;height:32px;border-radius:16px;align-self:center}
        .ms{font-size:11px;color:rgba(255,255,255,.75);margin-top:4px;white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis}
        .mv{font-size:28px;font-weight:500;line-height:1;margin-top:auto}
        .mk .sw{position:absolute;right:12px;bottom:12px}
        .mk .pick{position:absolute;right:10px;bottom:10px;height:32px;padding:0 10px;font-size:12px}
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
        .gh{font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#7f7f7f;padding:8px 8px 0}
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
        @media (max-width:380px){.tb{font-size:13px;padding:0 4px}.mv{font-size:24px}}
        @media (prefers-reduced-motion: reduce){.st,.smoke circle,.cam,.birds .b1,.birds .b2{animation:none !important}}`;
    }
  }
  M.define('msh-innstillinger-card', Innstillinger, 'MSH Innstillinger (automasjoner)', 'Innstillinger-popupen (#innstillinger): natt-/privatmodus, automasjoner, varsler og strøm (fiks 25.5).');
})();
